'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const supabase = require('./supabase.js');

const DEFAULT_TOKEN_URI = 'https://oauth2.googleapis.com/token';
const FIREBASE_SCOPES = [
    'https://www.googleapis.com/auth/firebase.database',
    'https://www.googleapis.com/auth/userinfo.email'
];
const DEFAULT_REQUEST_TIMEOUT_MS = 120000;
const DEFAULT_RETRY_COUNT = 2;
const DEFAULT_RETRY_DELAY_MS = 1000;
const DEFAULT_LOCK_STALE_MS = 12 * 60 * 60 * 1000;
const RETRYABLE_HTTP_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

function integerOption(config, key, fallback, min, max) {
    const value = config[key] === undefined ? fallback : config[key];
    if (!Number.isInteger(value) || value < min || value > max) {
        throw new Error(`Invalid "${key}" in config — must be a whole number from ${min} to ${max}.`);
    }
    return value;
}

function networkOptions(config) {
    return {
        timeoutMs: integerOption(config, 'requestTimeoutMs', DEFAULT_REQUEST_TIMEOUT_MS, 1000, 600000),
        retryCount: integerOption(config, 'retryCount', DEFAULT_RETRY_COUNT, 0, 5),
        retryDelayMs: integerOption(config, 'retryDelayMs', DEFAULT_RETRY_DELAY_MS, 100, 30000)
    };
}

function base64Url(value) {
    return Buffer.from(value).toString('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
}

function normalizeTokenUri(raw) {
    let parsed;
    try {
        parsed = new URL(raw || DEFAULT_TOKEN_URI);
    } catch (e) {
        throw new Error('Service account has an invalid token_uri.');
    }
    const allowedHost = parsed.hostname === 'oauth2.googleapis.com'
        || parsed.hostname === 'www.googleapis.com';
    if (parsed.protocol !== 'https:' || !allowedHost || parsed.username || parsed.password) {
        throw new Error('Service account token_uri must be an official HTTPS Google OAuth endpoint.');
    }
    return parsed.href;
}

function validateServiceAccount(raw) {
    if (!raw || typeof raw !== 'object') {
        throw new Error('Service account file must contain a JSON object.');
    }
    if (typeof raw.client_email !== 'string' || !raw.client_email.trim()) {
        throw new Error('Service account is missing client_email.');
    }
    if (typeof raw.private_key !== 'string' || !raw.private_key.includes('PRIVATE KEY')) {
        throw new Error('Service account is missing a valid private_key.');
    }
    return {
        clientEmail: raw.client_email.trim(),
        privateKey: raw.private_key,
        tokenUri: normalizeTokenUri(raw.token_uri)
    };
}

function normalizeDatabaseUrl(raw) {
    let parsed;
    try {
        parsed = new URL(raw);
    } catch (e) {
        throw new Error('databaseURL is not a valid URL.');
    }
    const host = parsed.hostname.toLowerCase();
    const firebaseHost = host.endsWith('.firebaseio.com')
        || host.endsWith('.firebasedatabase.app');
    if (parsed.protocol !== 'https:' || !firebaseHost || parsed.username || parsed.password
        || parsed.search || parsed.hash || (parsed.pathname !== '/' && parsed.pathname !== '')) {
        throw new Error('databaseURL must be an HTTPS Firebase Realtime Database root URL.');
    }
    return parsed.origin;
}

function createServiceAccountJwt(serviceAccount, nowMs) {
    const nowSeconds = Math.floor((nowMs === undefined ? Date.now() : nowMs) / 1000);
    const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const claims = base64Url(JSON.stringify({
        iss: serviceAccount.clientEmail,
        sub: serviceAccount.clientEmail,
        scope: FIREBASE_SCOPES.join(' '),
        aud: serviceAccount.tokenUri,
        iat: nowSeconds,
        exp: nowSeconds + 3600
    }));
    const unsigned = `${header}.${claims}`;
    const signature = crypto.sign('RSA-SHA256', Buffer.from(unsigned), serviceAccount.privateKey);
    return `${unsigned}.${base64Url(signature)}`;
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url, init, timeoutMs, fetchImpl, consumeResponse) {
    const controller = new AbortController();
    let timer;
    const deadline = new Promise((resolve, reject) => {
        timer = setTimeout(() => {
            const error = new Error('Request timed out.');
            error.name = 'AbortError';
            reject(error);
            controller.abort();
        }, timeoutMs);
    });
    try {
        return await Promise.race([
            Promise.resolve().then(async () => {
                const response = await fetchImpl(url, Object.assign({}, init, { signal: controller.signal }));
                return consumeResponse(response);
            }),
            deadline
        ]);
    } finally {
        clearTimeout(timer);
        controller.abort();
    }
}

async function requestJsonWithRetry(label, url, init, options, dependencies) {
    const deps = dependencies || {};
    const fetchImpl = deps.fetchImpl || globalThis.fetch;
    const sleepImpl = deps.sleepImpl || sleep;
    if (typeof fetchImpl !== 'function') {
        throw new Error('Node.js 18 or newer is required (global fetch is unavailable).');
    }

    let lastError = null;
    for (let attempt = 0; attempt <= options.retryCount; attempt += 1) {
        try {
            return await fetchWithTimeout(url, init, options.timeoutMs, fetchImpl, async (response) => {
                if (!response || typeof response.status !== 'number') {
                    const invalidResponse = new Error(`${label} returned an invalid HTTP response.`);
                    invalidResponse.retryable = true;
                    throw invalidResponse;
                }
                if (!response.ok) {
                    const httpError = new Error(`${label} failed (HTTP ${response.status}).`);
                    httpError.retryable = RETRYABLE_HTTP_STATUS.has(response.status);
                    throw httpError;
                }
                try {
                    return await response.json();
                } catch (e) {
                    const jsonError = new Error(`${label} returned invalid JSON.`);
                    jsonError.retryable = true;
                    throw jsonError;
                }
            });
        } catch (e) {
            lastError = e && e.name === 'AbortError'
                ? Object.assign(new Error(`${label} timed out after ${options.timeoutMs} ms.`), { retryable: true })
                : e;
            const canRetry = lastError && lastError.retryable !== false && attempt < options.retryCount;
            if (!canRetry) throw lastError;
            await sleepImpl(options.retryDelayMs * Math.pow(2, attempt));
        }
    }
    throw lastError || new Error(`${label} failed.`);
}

async function getAccessToken(serviceAccount, options, dependencies) {
    const assertion = createServiceAccountJwt(serviceAccount,
        dependencies && dependencies.nowMs !== undefined ? dependencies.nowMs : undefined);
    const body = new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion
    }).toString();
    const tokenResponse = await requestJsonWithRetry('OAuth token request', serviceAccount.tokenUri, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(body).toString()
        },
        body
    }, options, dependencies);
    if (!tokenResponse || typeof tokenResponse.access_token !== 'string' || !tokenResponse.access_token) {
        throw new Error('OAuth token response did not include an access_token.');
    }
    return tokenResponse.access_token;
}

async function readDatabase(databaseUrl, accessToken, options, dependencies) {
    return requestJsonWithRetry('Firebase database read', `${databaseUrl}/.json`, {
        method: 'GET',
        headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${accessToken}`
        }
    }, options, dependencies);
}

function resolveBusinessDir(backupRoot, name) {
    if (typeof name !== 'string' || !name.trim()) {
        throw new Error('Business entry is missing a "name".');
    }
    if (!/^[A-Za-z0-9._-]+$/.test(name) || name === '.' || name === '..') {
        throw new Error(`Unsafe business name "${name}" — use only letters, digits, dot, dash, underscore.`);
    }
    return path.join(backupRoot, name);
}

function pruneOldBackups(dir, keepCount) {
    const files = fs.readdirSync(dir)
        .filter((file) => file.endsWith('.json.gz'))
        .sort();
    while (files.length > keepCount) {
        const oldest = files.shift();
        fs.unlinkSync(path.join(dir, oldest));
    }
}

function writeBackup(outDir, data, keepCount) {
    fs.mkdirSync(outDir, { recursive: true, mode: 0o700 });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const nonce = crypto.randomBytes(3).toString('hex');
    const outFile = path.join(outDir, `${timestamp}-${nonce}.json.gz`);
    const tmpFile = `${outFile}.${process.pid}.partial`;
    try {
        const json = JSON.stringify(data === null ? {} : data);
        fs.writeFileSync(tmpFile, zlib.gzipSync(json), { flag: 'wx', mode: 0o600 });
        fs.renameSync(tmpFile, outFile);
    } catch (writeError) {
        if (fs.existsSync(tmpFile)) {
            try { fs.unlinkSync(tmpFile); } catch (cleanupError) {}
        }
        throw writeError;
    }
    pruneOldBackups(outDir, keepCount);
    return outFile;
}

function acquireRunLock(backupRoot, staleMs) {
    fs.mkdirSync(backupRoot, { recursive: true, mode: 0o700 });
    const lockPath = path.join(backupRoot, '.zoe-backup.lock');
    const token = `${process.pid}:${Date.now()}:${crypto.randomBytes(8).toString('hex')}`;

    for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
            const fd = fs.openSync(lockPath, 'wx', 0o600);
            try { fs.writeFileSync(fd, token, 'utf8'); } finally { fs.closeSync(fd); }
            return function releaseRunLock() {
                try {
                    if (fs.readFileSync(lockPath, 'utf8') === token) fs.unlinkSync(lockPath);
                } catch (e) {
                    if (!e || e.code !== 'ENOENT') throw e;
                }
            };
        } catch (e) {
            if (!e || e.code !== 'EEXIST') throw e;
            let stat;
            try { stat = fs.lstatSync(lockPath); } catch (statError) {
                if (statError && statError.code === 'ENOENT') continue;
                throw statError;
            }
            if (attempt === 0 && stat.isFile() && Date.now() - stat.mtimeMs > staleMs) {
                fs.unlinkSync(lockPath);
                continue;
            }
            throw new Error(`Another backup run is active (lock: ${lockPath}).`);
        }
    }
    throw new Error('Could not acquire the backup run lock.');
}

function validateBusinesses(config, backupRoot) {
    if (!Array.isArray(config.businesses) || config.businesses.length === 0) {
        throw new Error('config.json has no "businesses" entries.');
    }
    const names = new Set();
    for (const business of config.businesses) {
        const dir = resolveBusinessDir(backupRoot, business && business.name);
        const key = path.basename(dir).toLowerCase();
        if (names.has(key)) throw new Error(`Duplicate business name "${business.name}" in config.`);
        names.add(key);
        if (business.type === 'supabase') {
            if (typeof business.secretKeyPath !== 'string' || !business.secretKeyPath.trim()) {
                throw new Error(`Business "${business.name}" is missing secretKeyPath.`);
            }
            supabase.normalizeSupabaseUrl(business.url);
            continue;
        }
        if (business.type !== undefined && business.type !== 'firebase') {
            throw new Error(`Business "${business.name}" has an unknown type (use "firebase" or "supabase").`);
        }
        if (typeof business.serviceAccountPath !== 'string' || !business.serviceAccountPath.trim()) {
            throw new Error(`Business "${business.name}" is missing serviceAccountPath.`);
        }
        normalizeDatabaseUrl(business.databaseURL);
    }
}

async function backupSupabase(business, context, dependencies) {
    const deps = dependencies || {};
    const outDir = resolveBusinessDir(context.backupRoot, business.name);
    const keyPath = path.resolve(context.configDir, business.secretKeyPath);
    if (!fs.existsSync(keyPath)) {
        throw new Error(`Secret key file not found: ${keyPath}`);
    }
    const client = supabase.createClient({
        url: business.url,
        key: fs.readFileSync(keyPath, 'utf8'),
        timeoutMs: context.network.timeoutMs,
        retryCount: context.network.retryCount,
        retryDelayMs: context.network.retryDelayMs,
        fetchImpl: deps.fetchImpl,
        sleepImpl: deps.sleepImpl
    });
    const tenants = await supabase.listTenants(client);
    const files = [];
    const failed = [];
    for (const tenant of tenants) {
        try {
            const exported = await supabase.exportTenant(client, tenant.id);
            files.push(writeBackup(path.join(outDir, tenant.id), supabase.buildArchive(tenant, exported, client.host), context.keepCount));
        } catch (e) {
            failed.push(`${tenant.id}: ${e && e.message ? e.message : 'Unknown error'}`);
        }
    }
    return { files, tenants: tenants.length, failed };
}

async function backupOne(business, context, dependencies) {
    if (business.type === 'supabase') return backupSupabase(business, context, dependencies);
    const outDir = resolveBusinessDir(context.backupRoot, business.name);
    const serviceAccountPath = path.resolve(context.configDir, business.serviceAccountPath);
    if (!fs.existsSync(serviceAccountPath)) {
        throw new Error(`Service account file not found: ${serviceAccountPath}`);
    }
    let rawServiceAccount;
    try {
        rawServiceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    } catch (e) {
        throw new Error(`Service account file is not valid JSON: ${serviceAccountPath}`);
    }
    const serviceAccount = validateServiceAccount(rawServiceAccount);
    const databaseUrl = normalizeDatabaseUrl(business.databaseURL);
    const token = await getAccessToken(serviceAccount, context.network, dependencies);
    const data = await readDatabase(databaseUrl, token, context.network, dependencies);
    return writeBackup(outDir, data, context.keepCount);
}

function loadConfig(configPath) {
    if (!fs.existsSync(configPath)) {
        throw new Error(`Config file not found: ${configPath}\nCopy config.example.json to config.json and fill in your businesses first.`);
    }
    try {
        return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (e) {
        throw new Error(`Config file is not valid JSON: ${configPath}`);
    }
}

async function main(argv) {
    const args = argv || process.argv;
    const configPath = args[2]
        ? path.resolve(process.cwd(), args[2])
        : path.join(__dirname, 'config.json');
    const config = loadConfig(configPath);
    const configDir = path.dirname(configPath);
    if (config.backupDir !== undefined && (typeof config.backupDir !== 'string' || !config.backupDir.trim())) {
        throw new Error('Invalid "backupDir" in config — must be a non-empty path.');
    }
    const backupRoot = path.resolve(configDir, config.backupDir || './backups');
    const keepCount = integerOption(config, 'keepCount', 30, 1, 10000);
    const network = networkOptions(config);
    const lockStaleMs = integerOption(config, 'lockStaleMs', DEFAULT_LOCK_STALE_MS, 60000, 604800000);
    validateBusinesses(config, backupRoot);

    const releaseLock = acquireRunLock(backupRoot, lockStaleMs);
    let failures = 0;
    try {
        for (const business of config.businesses) {
            try {
                const outcome = await backupOne(business, {
                    backupRoot,
                    configDir,
                    keepCount,
                    network
                });
                const outFiles = typeof outcome === 'string' ? [outcome] : outcome.files;
                for (const outFile of outFiles) {
                    const sizeKb = (fs.statSync(outFile).size / 1024).toFixed(1);
                    console.log(`[OK]   ${business.name} -> ${outFile} (${sizeKb} KB)`);
                }
                if (typeof outcome !== 'string') {
                    if (outcome.failed.length) {
                        throw new Error(`${outcome.failed.length} of ${outcome.tenants} tenant(s) failed: ${outcome.failed.join(' | ')}`);
                    }
                    if (!outcome.tenants) console.log(`[OK]   ${business.name}: no tenants yet`);
                }
            } catch (e) {
                failures += 1;
                console.error(`[FAIL] ${business.name}: ${e && e.message ? e.message : 'Unknown error'}`);
            }
        }
    } finally {
        releaseLock();
    }

    if (failures > 0) {
        throw new Error(`${failures} of ${config.businesses.length} backup(s) failed.`);
    }
    console.log(`\nAll ${config.businesses.length} backup(s) completed.`);
}

if (require.main === module) {
    main().catch((e) => {
        console.error(e && e.message ? e.message : e);
        process.exitCode = 1;
    });
}

module.exports = {
    acquireRunLock,
    backupOne,
    backupSupabase,
    createServiceAccountJwt,
    getAccessToken,
    main,
    networkOptions,
    normalizeDatabaseUrl,
    normalizeTokenUri,
    pruneOldBackups,
    readDatabase,
    requestJsonWithRetry,
    resolveBusinessDir,
    validateBusinesses,
    validateServiceAccount,
    writeBackup
};
