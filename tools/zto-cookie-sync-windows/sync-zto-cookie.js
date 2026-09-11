'use strict';

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const TOOL_DIR = __dirname;
// ⛔ **ចំណុចចាប់ផ្តើម ≠ គោលដៅចាប់** ៖ `gate.ztoglobal.com` រក្សា session
// ចំណែក `argus.ztoglobal.com` សុំ Login **រាល់ដង** (វាស់ដោយម្ចាស់គម្រោង
// 2026-09-09 និងបញ្ជាក់ឡើងវិញ 2026-09-11) ➜ helper បើក gate រួចអ្នកប្រើចុច
// កាតសាខា ➜ Argus បើកដោយមិនវាយ password ➜ session ដែលទើបកើតថ្មី។
// ⛔ ការចាប់ **មិនប្តូរសោះ** — វានៅតែឈរលើ `API_HOST` ខាងក្រោម។ `ARGUS_URL`
// នៅតែបោះពុម្ពជា **ផ្លូវបម្រុង** សម្រាប់ថ្ងៃដែល gate បើកមិនកើត។
const PORTAL_URL = 'https://gate.ztoglobal.com/';
const ARGUS_URL = 'https://argus.ztoglobal.com/';
const ARGUS_HOST = new URL(ARGUS_URL).hostname;
const PORTAL_OPEN_TIMEOUT_MS = 20 * 1000;
const PORTAL_OPEN_POLL_MS = 1000;
const API_HOST = 'aargus-api.ztoglobal.com';
// ⛔ OPTIONS (preflight) និង HEAD មិនបញ្ជាក់ថា ZTO ទទួលយក session ទេ —
// preflight មិនផ្ញើ Cookie សោះ។ មានតែ GET និង POST ដែល ZTO
// ឆ្លើយមកដោយ envelope ជោគជ័យ ទើបជាភស្តុតាង។
const CAPTURE_METHODS = ['GET', 'POST'];
const CAPTURE_TIMEOUT_MS = 10 * 60 * 1000;
const CAPTURE_RESPONSE_TIMEOUT_MS = 10 * 1000;

const NETLIFY_API_ORIGIN = 'https://api.netlify.com';
const BLOB_STORE_NAME = 'zto-auth';
const BLOB_KEY = 'cookie';
// ⛔ `@netlify/blobs` v11 ដាក់បច្ច័យ `site:` ចូលឈ្មោះ store ខាងក្នុង ៖
// `getStore('zto-auth')` ➜ `site:zto-auth` ទាំងផ្លូវ edge (Function អាន)
// ទាំងផ្លូវ API (helper សរសេរ)។ ការសរសេរទៅឈ្មោះ **ឥតបច្ច័យ** ធ្លាក់ចូល
// legacy namespace ➜ Netlify ឆ្លើយ 200 តែ Function អានមិនឃើញជារៀងរហូត។
const SITE_STORE_PREFIX = 'site:';
const BLOB_STORE_PATH = SITE_STORE_PREFIX + BLOB_STORE_NAME;
const SIGNED_URL_ACCEPT = 'application/json;type=signed-url';
const SIGNED_URL_MAX_LENGTH = 4096;
const DIAG_PATH = '/.netlify/functions/zto-order-detail?diag=1';
// ⛔ `fresh=1` រំលង cache ៦០ វិនាទីរបស់ Function ➜ ការផ្ទៀងផ្ទាត់អាន blob
// ពិតភ្លាម ជំនួសការរង់ចាំ cache ផុតកំណត់។ វាត្រូវបានទទួលស្គាល់តែជាមួយ
// `diag=1` (ដែលការពារដោយ proxy key) ➜ ផ្លូវ lookup មិនអាចត្រូវបង្ខំឲ្យ
// អាន blob រាល់ការស្កេនបានឡើយ។
const DIAG_FRESH_PATH = DIAG_PATH + '&fresh=1';
const PROXY_KEY_HEADER = 'X-Zoe-Proxy-Key';
const VERIFY_TIMEOUT_MS = 10 * 1000;
const VERIFY_DEADLINE_MS = 75 * 1000;
const VERIFY_GAP_MS = 5 * 1000;
const VERIFY_MAX_ATTEMPTS = 32;
const SITE_URL_MAX_LENGTH = 512;
const NETLIFY_TIMEOUT_MS = 30 * 1000;
const NETLIFY_RETRY_ATTEMPTS = 3;
const NETLIFY_RETRY_BASE_MS = 800;
const NETLIFY_RESPONSE_MAX_BYTES = 1024 * 1024;

const COOKIE_NAME_RE = /^[A-Za-z0-9!#$%&'*+\-.^_`|~]{1,128}$/;
const COOKIE_VALUE_RE = /^[\x21-\x3a\x3c-\x7e]{0,4096}$/;
const COOKIE_MIN_LENGTH = 8;
const COOKIE_MAX_LENGTH = 8192;
const COOKIE_MAX_PAIRS = 64;
const REQUIRED_COOKIE_NAME = 'BOS-MAN-SESSION';
const SITE_ID_RE = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/;
const TOKEN_RE = /^[\x21-\x7e]{16,4096}$/;

// ⛔ ឈ្មោះប៉ុណ្ណោះ — តម្លៃ cookie មិនត្រូវរក្សា ឬបោះពុម្ពឡើយ។
let lastDroppedCookieNames = [];

function droppedCookieNames() {
    return lastDroppedCookieNames.slice();
}

function codedError(code, transient) {
    const error = new Error(code);
    error.code = code;
    error.transient = !!transient;
    return error;
}

// ការធ្លាក់ **បណ្តោះអាសន្ន** ៖ 408 · 425 · 429 · 5xx ។ 4xx ដទៃទៀត (401 · 403 ·
// 404 · 422) ជាសាលក្រម **ស្ថាពរ** ៖ PAT ខុស ឬ site id ខុស — ការព្យាយាមឡើងវិញ
// មិនជួយអ្វីទេ ហើយធ្វើឲ្យអ្នកប្រើរង់ចាំយូរដោយឥតប្រយោជន៍។
function statusIsTransient(status) {
    const code = Number(status) || 0;
    if (code === 408 || code === 425 || code === 429) return true;
    return code >= 500 && code < 600;
}

// ⛔ Cookie ជារបស់ **domain** មិនមែន **path** — សំណើណាមួយទៅ
// API host ក៏ផ្ទុក `BOS-MAN-SESSION` ដដែល។ ការទាមទារ path
// `/scan/get/order/detail` មិនបន្ថែមការការពារណាមួយទេ — ការការពារពិត
// ឈរនៅក្នុង **ចម្លើយ** (2xx · JSON · envelope ជោគជ័យ · មិនមែន
// 401/403 និងមិនមែនទំព័រ Login) — ចំណែក path ត្រឹមតែបង្ខំអ្នកប្រើ
// ឲ្យស្កេនកញ្ចប់មួយរាល់ដង (រង្វាស់នៅ 2.31.2 ➜ អ្នកប្រើរាយការណ៍)។
function isTargetApiUrl(raw) {
    try {
        const url = new URL(String(raw || ''));
        return url.protocol === 'https:' && url.hostname === API_HOST
            && !url.port && !url.username && !url.password;
    } catch (_) {
        return false;
    }
}

function validateCookieHeader(raw) {
    const original = String(raw || '');
    if (/[\u0000-\u001f\u007f]/.test(original)) throw codedError('COOKIE_CONTROL_CHAR');
    const text = original.trim();
    if (text.length < COOKIE_MIN_LENGTH) throw codedError('COOKIE_TOO_SHORT');
    if (text.length > COOKIE_MAX_LENGTH) throw codedError('COOKIE_TOO_LONG');

    // ⛔ គូ **តែមួយ** ដែលមិនពាក់ព័ន្ធ (analytics តម្លៃមានចន្លោះ · flag គ្មាន
    // `=` · jar ធំ) មិនត្រូវសម្លាប់ការចាប់ទាំងមូល — វាស់បាន 2026-09-02 ៖
    // `BOS-MAN-SESSION` នៅត្រឹមត្រូវ តែ helper ស្លាប់ដោយសារ cookie របស់អ្នកដទៃ
    // ដែលអ្នកប្រើកែមិនបាន។ ដូច្នេះគូដែលផ្ទៀងផ្ទាត់មិនបាន ត្រូវ **រំលង**
    // (កុំផ្ញើ byte ដែលមិនបានផ្ទៀងផ្ទាត់) ចំណែកការការពារពិតនៅដដែល ៖
    // control char ➜ បដិសេធទាំងស្រុងខាងលើ; អវត្តមាន session ➜ បដិសេធខាងក្រោម។
    const rawPairs = text.split(';');
    const pairs = [];
    const dropped = [];
    let hasSession = false;
    for (const rawPair of rawPairs) {
        const pair = rawPair.trim();
        if (!pair) continue;
        const equalsAt = pair.indexOf('=');
        const name = equalsAt < 1 ? pair : pair.slice(0, equalsAt).trim();
        const value = equalsAt < 1 ? null : pair.slice(equalsAt + 1);
        const shaped = value !== null
            && COOKIE_NAME_RE.test(name)
            && COOKIE_VALUE_RE.test(value);
        if (!shaped) {
            dropped.push(COOKIE_NAME_RE.test(name) ? name : '(malformed name)');
            continue;
        }
        if (pairs.length >= COOKIE_MAX_PAIRS) {
            dropped.push(name);
            continue;
        }
        if (name === REQUIRED_COOKIE_NAME && value.length >= 8) hasSession = true;
        pairs.push(name + '=' + value);
    }
    if (!hasSession) throw codedError('COOKIE_SESSION_MISSING');
    lastDroppedCookieNames = dropped.slice(0, 12);
    return pairs.join('; ');
}

function cookieHeaderFromHeaders(headers) {
    if (!headers || typeof headers !== 'object') return '';
    for (const [name, value] of Object.entries(headers)) {
        if (String(name).toLowerCase() === 'cookie') return String(value || '');
    }
    return '';
}

async function cookieHeaderFromRequest(request) {
    if (!request || typeof request.url !== 'function' || !isTargetApiUrl(request.url())) return '';
    const headers = await request.allHeaders();
    const raw = cookieHeaderFromHeaders(headers);
    return raw ? validateCookieHeader(raw) : '';
}

function localStateRoot() {
    const base = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    return path.join(base, 'Zoe-System', 'ZTO-Cookie-Sync');
}

function statePaths() {
    const root = localStateRoot();
    return {
        root,
        config: path.join(root, 'config.json'),
        token: path.join(root, 'netlify-token.dpapi'),
        proxyKey: path.join(root, 'proxy-key.dpapi')
    };
}

function validateSiteUrl(raw) {
    const text = String(raw || '').trim();
    if (!text) return '';
    if (text.length > SITE_URL_MAX_LENGTH) throw codedError('SITE_URL_INVALID');
    let url;
    try {
        url = new URL(text);
    } catch (_) {
        throw codedError('SITE_URL_INVALID');
    }
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) {
        throw codedError('SITE_URL_INVALID');
    }
    return url.origin;
}

function cookieFingerprint(cookie) {
    return crypto.createHash('sha256').update(String(cookie || '')).digest('hex').slice(0, 8);
}

function profileRoot(channel) {
    return path.join(localStateRoot(), channel + '-profile');
}

function validateSiteId(raw, errorCode) {
    const siteId = String(raw || '').trim();
    if (!SITE_ID_RE.test(siteId)) throw codedError(errorCode || 'NETLIFY_CONFIG_INVALID');
    return siteId;
}

function validateToken(raw) {
    const token = String(raw || '');
    if (!TOKEN_RE.test(token)) throw codedError('NETLIFY_TOKEN_INVALID');
    return token;
}

function loadConfig(configPath) {
    const target = configPath || statePaths().config;
    let parsed;
    try {
        const text = fs.readFileSync(target, 'utf8').replace(/^\uFEFF/, '');
        parsed = JSON.parse(text);
    } catch (_) {
        throw codedError('NETLIFY_CONFIG_MISSING');
    }
    let siteUrl = '';
    try {
        siteUrl = validateSiteUrl(parsed && parsed.siteUrl);
    } catch (_) {
        siteUrl = '';
    }
    return { siteId: validateSiteId(parsed && parsed.siteId), siteUrl };
}

function readTokenViaPowerShell(options) {
    const config = options || {};
    const spawnImpl = config.spawnImpl || spawn;
    const tokenPath = config.tokenPath || statePaths().token;
    const scriptPath = config.scriptPath || path.join(TOOL_DIR, 'read-token.ps1');
    if (!fs.existsSync(tokenPath)) return Promise.reject(codedError('NETLIFY_TOKEN_MISSING'));
    if (!fs.existsSync(scriptPath)) return Promise.reject(codedError('NETLIFY_TOKEN_READER_MISSING'));

    return new Promise((resolve, reject) => {
        let settled = false;
        let total = 0;
        const chunks = [];
        const finish = (error, value) => {
            if (settled) return;
            settled = true;
            for (const chunk of chunks) chunk.fill(0);
            chunks.length = 0;
            if (error) reject(error);
            else resolve(value);
        };

        let child;
        try {
            child = spawnImpl('powershell.exe', [
                '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
                '-File', scriptPath, '-TokenPath', tokenPath
            ], {
                cwd: TOOL_DIR,
                env: process.env,
                shell: false,
                windowsHide: true,
                stdio: ['ignore', 'pipe', 'ignore']
            });
        } catch (_) {
            finish(codedError('NETLIFY_TOKEN_READ_FAILED'));
            return;
        }

        child.stdout.on('data', (rawChunk) => {
            const chunk = Buffer.from(rawChunk);
            if (settled) {
                chunk.fill(0);
                return;
            }
            total += chunk.length;
            if (total > 4096) {
                chunk.fill(0);
                try { child.kill(); } catch (_) {}
                finish(codedError('NETLIFY_TOKEN_INVALID'));
                return;
            }
            chunks.push(chunk);
        });
        child.on('error', () => finish(codedError('NETLIFY_TOKEN_READ_FAILED')));
        child.on('close', (exitCode) => {
            if (settled) return;
            if (exitCode !== 0) {
                finish(codedError('NETLIFY_TOKEN_READ_FAILED'));
                return;
            }
            let token;
            const combined = Buffer.concat(chunks);
            try {
                token = validateToken(combined.toString('utf8'));
            } catch (error) {
                combined.fill(0);
                finish(error);
                return;
            }
            combined.fill(0);
            finish(null, token);
        });
    });
}

function timedFetch(url, options, controls, consume) {
    const config = controls || {};
    const fetchImpl = config.fetchImpl || globalThis.fetch;
    const timeoutMs = Number.isFinite(config.timeoutMs)
        ? Math.max(1, Math.floor(config.timeoutMs))
        : NETLIFY_TIMEOUT_MS;
    if (typeof fetchImpl !== 'function') return Promise.reject(codedError('NETLIFY_NETWORK'));

    return new Promise((resolve, reject) => {
        const controller = new AbortController();
        let settled = false;
        const finish = (error, response) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            if (error) {
                try { controller.abort(); } catch (_) {}
                reject(error);
            }
            else resolve(response);
        };
        const timer = setTimeout(() => {
            try { controller.abort(); } catch (_) {}
            finish(codedError('NETLIFY_TIMEOUT', true));
        }, timeoutMs);

        let pending;
        try {
            pending = fetchImpl(url, Object.assign({ redirect: 'error' }, options, {
                signal: controller.signal
            }));
        } catch (_) {
            finish(codedError('NETLIFY_NETWORK', true));
            return;
        }
        Promise.resolve(pending).then(
            (response) => {
                if (settled) return;
                return typeof consume === 'function' ? consume(response) : response;
            },
            () => { throw codedError('NETLIFY_NETWORK', true); }
        ).then((value) => finish(null, value), (error) => finish(error));
    });
}

function netlifyApiUrl(pathname) {
    return NETLIFY_API_ORIGIN + pathname;
}

function netlifyHeaders(token) {
    return {
        Accept: 'application/json',
        Authorization: 'Bearer ' + validateToken(token)
    };
}

async function discardResponse(response) {
    try {
        if (response && response.body && typeof response.body.cancel === 'function') {
            Promise.resolve(response.body.cancel()).catch(() => {});
        }
    } catch (_) {}
}

async function readSmallJson(response, errorCode) {
    const code = errorCode || 'NETLIFY_SITE_INVALID_RESPONSE';
    let text;
    try {
        if (response.body && typeof response.body.getReader === 'function') {
            const reader = response.body.getReader();
            const chunks = [];
            let bytes = 0;
            try {
                for (;;) {
                    const part = await reader.read();
                    if (part.done) break;
                    bytes += part.value.byteLength;
                    if (bytes > NETLIFY_RESPONSE_MAX_BYTES) {
                        Promise.resolve(reader.cancel()).catch(() => {});
                        throw codedError(code);
                    }
                    chunks.push(Buffer.from(part.value));
                }
                text = Buffer.concat(chunks, bytes).toString('utf8');
            } finally {
                reader.releaseLock();
            }
        } else {
            text = await response.text();
        }
    } catch (error) {
        if (error && error.code === code) throw error;
        throw codedError('NETLIFY_NETWORK', true);
    }
    if (Buffer.byteLength(text, 'utf8') > NETLIFY_RESPONSE_MAX_BYTES) {
        throw codedError(code);
    }
    try {
        return JSON.parse(text);
    } catch (_) {
        throw codedError(code);
    }
}

function validateSignedUrl(raw) {
    const text = String(raw || '');
    if (!text || text.length > SIGNED_URL_MAX_LENGTH) throw codedError('NETLIFY_BLOB_URL_INVALID');
    let signed;
    try {
        signed = new URL(text);
    } catch (_) {
        throw codedError('NETLIFY_BLOB_URL_INVALID');
    }
    if (signed.protocol !== 'https:') throw codedError('NETLIFY_BLOB_URL_INVALID');
    return signed.href;
}

async function getNetlifySite(siteId, token, controls) {
    const cleanSiteId = validateSiteId(siteId);
    return timedFetch(
        netlifyApiUrl('/api/v1/sites/' + encodeURIComponent(cleanSiteId)),
        { method: 'GET', headers: netlifyHeaders(token) },
        controls,
        async (response) => {
            if (!response || !response.ok) {
                const status = response ? response.status : 0;
                await discardResponse(response);
                throw codedError('NETLIFY_SITE_REJECTED', statusIsTransient(status));
            }
            const site = await readSmallJson(response);
            const accountId = validateSiteId(site && site.account_id, 'NETLIFY_SITE_INVALID_RESPONSE');
            return { accountId };
        }
    );
}

async function requestBlobUploadUrl(siteId, token, controls) {
    const cleanSiteId = validateSiteId(siteId);
    const pathname = '/api/v1/blobs/' + encodeURIComponent(cleanSiteId)
        + '/' + BLOB_STORE_PATH + '/' + BLOB_KEY;
    return timedFetch(netlifyApiUrl(pathname), {
        method: 'PUT',
        headers: {
            accept: SIGNED_URL_ACCEPT,
            Authorization: 'Bearer ' + validateToken(token)
        }
    }, controls, async (response) => {
        if (!response || !response.ok) {
            const status = response ? response.status : 0;
            await discardResponse(response);
            throw codedError('NETLIFY_BLOB_URL_FAILED', statusIsTransient(status));
        }
        const payload = await readSmallJson(response, 'NETLIFY_BLOB_URL_INVALID');
        return validateSignedUrl(payload && payload.url);
    });
}

async function uploadCookieToBlob(signedUrl, cookieHeader, controls) {
    const cleanCookie = validateCookieHeader(cookieHeader);
    await timedFetch(signedUrl, {
        method: 'PUT',
        redirect: 'manual',
        headers: { 'cache-control': 'max-age=0, stale-while-revalidate=60' },
        body: cleanCookie
    }, controls, async (response) => {
        if (response && response.status >= 300 && response.status < 400) {
            await discardResponse(response);
            throw codedError('NETLIFY_BLOB_REDIRECT');
        }
        if (!response || !response.ok) {
            const status = response ? response.status : 0;
            await discardResponse(response);
            throw codedError('NETLIFY_BLOB_UPLOAD_FAILED', statusIsTransient(status));
        }
        await discardResponse(response);
    });
}

async function resolveCredentials(options) {
    const config = options || {};
    const loaded = config.siteId === undefined
        ? loadConfig(config.configPath)
        : { siteId: validateSiteId(config.siteId) };
    const token = config.token === undefined
        ? await readTokenViaPowerShell(config)
        : validateToken(config.token);
    return { siteId: loaded.siteId, token };
}

async function readDiagnostics(siteUrl, proxyKey, controls) {
    const origin = validateSiteUrl(siteUrl);
    if (!origin) throw codedError('SITE_URL_INVALID');
    const headers = { Accept: 'application/json' };
    headers[PROXY_KEY_HEADER] = String(proxyKey || '');
    const path = (controls && controls.fresh === false) ? DIAG_PATH : DIAG_FRESH_PATH;
    return timedFetch(origin + path, {
        method: 'GET',
        headers
    }, Object.assign({ timeoutMs: VERIFY_TIMEOUT_MS }, controls), async (response) => {
        if (!response || !response.ok) {
            await discardResponse(response);
            throw codedError('DIAG_REJECTED');
        }
        return readSmallJson(response, 'DIAG_INVALID');
    });
}

function diagnosticsCookie(payload) {
    const info = (payload && payload.cookie) || {};
    // ⛔ `auth` និង `storeReason` ជា ២ វាលដែល **ពន្យល់មូលហេតុ** នៃការមិន
    // ត្រូវគ្នា។ ជំនាន់មុនបោះចោលពួកវា ➜ សារចុងក្រោយប្រាប់តែ «មិនទាន់ឃើញ»
    // ដែលអ្នកប្រើកែមិនបាន (វាស់រួច 2026-09-02)។
    return {
        auth: typeof (payload && payload.auth) === 'string' ? payload.auth : '',
        source: typeof info.source === 'string' ? info.source : '',
        fingerprint: typeof info.fingerprint === 'string' ? info.fingerprint : '',
        storeReason: typeof info.storeReason === 'string' ? info.storeReason : '',
        ageMs: typeof info.ageMs === 'number' ? info.ageMs : null,
        renewals: typeof info.renewals === 'number' ? info.renewals : 0,
        authRejectedAgeMs: Number.isFinite(info.authRejectedAgeMs) && info.authRejectedAgeMs >= 0 ? info.authRejectedAgeMs : null,
        authAcceptedAgeMs: Number.isFinite(info.authAcceptedAgeMs) && info.authAcceptedAgeMs >= 0 ? info.authAcceptedAgeMs : null
    };
}

function cookieValidity(info) {
    if (info.authRejectedAgeMs !== null) return 'rejected';
    return info.authAcceptedAgeMs !== null ? 'accepted' : 'unknown';
}

// ⛔ `resolveCookieCredential()` ចេញ **ភ្លាម** ពេលមាន ZTO_AUTHORIZATION ឬ
// ZTO_TOKEN ➜ store មិនដែលត្រូវអានសោះ ➜ fingerprint នៃ blob **មិនអាច
// ត្រូវគ្នាបានជារៀងរហូត**។ ការរង់ចាំ ៧៥ វិ. លើករណីនោះ ជាការរង់ចាំរឿង
// ដែលមិនអាចកើតឡើងបាន — ត្រូវឈប់ភ្លាម ហើយប្រាប់មូលហេតុពិត។
function verificationIsImpossible(info) {
    return info.auth === 'token' || info.auth === 'authorization';
}

async function verifyCookieLive(cookieHeader, options) {
    const config = options || {};
    const siteUrl = String(config.siteUrl || '');
    const proxyKey = String(config.proxyKey || '');
    if (!siteUrl || !proxyKey) {
        return { status: 'unconfigured', attempts: 0, source: '', fingerprint: '' };
    }
    // ⛔ ការផ្ទៀងផ្ទាត់មិនត្រូវប្រែការសរសេរដែលជោគជ័យ ទៅជាការធ្លាក់ឡើយ។
    let wanted;
    try {
        wanted = cookieFingerprint(validateCookieHeader(cookieHeader));
    } catch (_) {
        return { status: 'unverifiable', attempts: 0, source: '', fingerprint: '' };
    }
    const deadlineMs = Number.isFinite(config.deadlineMs) ? config.deadlineMs : VERIFY_DEADLINE_MS;
    const gapMs = Number.isFinite(config.gapMs) ? config.gapMs : VERIFY_GAP_MS;
    const maxAttempts = Number.isFinite(config.maxAttempts) ? config.maxAttempts : VERIFY_MAX_ATTEMPTS;
    const sleepImpl = config.sleepImpl
        || ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    const startedAt = Date.now();
    let attempts = 0;
    let last = { status: 'unreachable', source: '', fingerprint: '', storeReason: '' };

    for (;;) {
        attempts++;
        try {
            const info = diagnosticsCookie(await readDiagnostics(siteUrl, proxyKey, config));
            if (info.fingerprint && info.fingerprint === wanted) {
                const validity = cookieValidity(info);
                return {
                    status: validity === 'rejected' ? 'rejected' : 'match',
                    validity,
                    attempts,
                    source: info.source,
                    fingerprint: info.fingerprint,
                    storeReason: info.storeReason
                };
            }
            if (verificationIsImpossible(info)) {
                return {
                    status: 'auth-override',
                    attempts,
                    source: info.source,
                    fingerprint: info.fingerprint,
                    storeReason: info.storeReason,
                    auth: info.auth
                };
            }
            last = {
                status: 'mismatch',
                source: info.source,
                fingerprint: info.fingerprint,
                storeReason: info.storeReason
            };
        } catch (_) {
            last = { status: 'unreachable', source: '', fingerprint: '', storeReason: '' };
        }
        if (attempts >= maxAttempts) break;
        const elapsed = Date.now() - startedAt;
        if (elapsed < 0 || elapsed >= deadlineMs) break;
        await sleepImpl(gapMs);
    }
    return Object.assign({ attempts }, last);
}

async function checkCookieHealth(options) {
    const config = options || {};
    const siteUrl = String(config.siteUrl || '');
    const proxyKey = String(config.proxyKey || '');
    if (!siteUrl || !proxyKey) return { status: 'unconfigured', healthy: false };
    let payload;
    try {
        payload = await readDiagnostics(siteUrl, proxyKey, config);
    } catch (_) {
        return { status: 'unreachable', healthy: false };
    }
    const info = diagnosticsCookie(payload);
    const usable = info.source === 'blob' || info.source === 'env';
    const validity = cookieValidity(info);
    return Object.assign({
        status: 'ok',
        validity,
        healthy: !usable || validity === 'rejected' ? false : validity === 'accepted' ? true : null
    }, info);
}

async function resolveVerification(options) {
    const config = options || {};
    if (config.siteUrl !== undefined || config.proxyKey !== undefined) {
        return { siteUrl: String(config.siteUrl || ''), proxyKey: String(config.proxyKey || '') };
    }
    let siteUrl = '';
    try {
        siteUrl = loadConfig(config.configPath).siteUrl;
    } catch (_) {
        siteUrl = '';
    }
    if (!siteUrl) return { siteUrl: '', proxyKey: '' };
    let proxyKey = '';
    try {
        proxyKey = await readTokenViaPowerShell(
            Object.assign({}, config, { tokenPath: statePaths().proxyKey })
        );
    } catch (_) {
        proxyKey = '';
    }
    return { siteUrl, proxyKey };
}

async function verifyNetlifySetup(options) {
    const credentials = await resolveCredentials(options);
    try {
        await getNetlifySite(credentials.siteId, credentials.token, options);
    } finally {
        credentials.token = '';
    }
}

// ⛔ ជំហានថ្លៃជាងគេគឺ **ការចាប់ Cookie ដោយដៃ** (បើក browser ➜ Login ➜ Arrival
// Scan)។ ការធ្លាក់បណ្តោះអាសន្នមួយភ្លែតរបស់ Netlify API មិនត្រូវបង្ខំអ្នកប្រើ
// ធ្វើជំហាននោះឡើងវិញទេ។ រាល់ជុំព្យាយាមស្នើ **signed URL ថ្មី** ព្រោះ URL
// ដែលចេញរួច មានអាយុខ្លី។ ⛔ ការព្យាយាមមានពិដានពិត — គ្មានរង្វិលជុំគ្មានទីបញ្ចប់។
async function syncNetlifyCookie(cookieHeader, options) {
    const config = options || {};
    let cleanCookie = validateCookieHeader(cookieHeader);
    const credentials = await resolveCredentials(options);
    const maxAttempts = Number.isFinite(config.retryAttempts)
        ? Math.max(1, Math.floor(config.retryAttempts))
        : NETLIFY_RETRY_ATTEMPTS;
    const baseMs = Number.isFinite(config.retryBaseMs)
        ? Math.max(0, Math.floor(config.retryBaseMs))
        : NETLIFY_RETRY_BASE_MS;
    const sleepImpl = config.sleepImpl
        || ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    try {
        for (let attempt = 1; ; attempt++) {
            try {
                const signedUrl = await requestBlobUploadUrl(credentials.siteId, credentials.token, options);
                await uploadCookieToBlob(signedUrl, cleanCookie, options);
                return;
            } catch (error) {
                if (!error || !error.transient || attempt >= maxAttempts) throw error;
                await sleepImpl(baseMs * attempt);
            }
        }
    } finally {
        cleanCookie = '';
        credentials.token = '';
    }
}

async function launchLocalBrowser() {
    const { chromium } = require('playwright-core');
    const channels = process.env.ZTO_SYNC_BROWSER === 'chrome'
        ? ['chrome', 'msedge']
        : ['msedge', 'chrome'];
    let lastFailure = null;
    for (const channel of channels) {
        const userDataDir = profileRoot(channel);
        fs.mkdirSync(userDataDir, { recursive: true });
        try {
            const context = await chromium.launchPersistentContext(userDataDir, {
                channel,
                headless: false,
                viewport: null,
                args: ['--start-maximized']
            });
            return { channel, context };
        } catch (_) {
            lastFailure = codedError('BROWSER_LAUNCH_FAILED');
        }
    }
    throw lastFailure || codedError('BROWSER_NOT_FOUND');
}

function captureResponseSucceeded(payload) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false;
    const code = String(payload.code ?? payload.errorCode ?? payload.statusCode ?? '').trim().toLowerCase();
    const message = [payload.error, payload.message, payload.msg, payload.errorMsg]
        .filter((value) => typeof value === 'string').join(' ').slice(0, 4096);
    if (/^(?:401|403|unauthorized|forbidden|not[_-]?login|login[_-]?required)$/.test(code)) return false;
    if (/https?:\/\/[^\s"']*(?:oauth|\/login\b|\/signin\b|sso[.\/]|iam[-.])/i.test(message)) return false;
    if (/(?:session|token|cookie|login|auth).{0,32}(?:expired|invalid|required|missing|failed)|(?:expired|invalid).{0,16}(?:session|token|cookie)|not\s+(?:logged|signed)\s+in|unauthori[sz]ed|未登录|登录失效|登录过期/i.test(message)) return false;
    if (payload.success === false || payload.status === false || payload.result === false) return false;
    if (code && !/^(?:0+|200|success|succeed|ok|true)$/.test(code)) return false;
    return !!code || payload.success === true || payload.status === true || payload.result === true;
}

function cookieAfterResponse(cookieHeader, lines, targetUrl) {
    const dropped = droppedCookieNames();
    const base = validateCookieHeader(cookieHeader);
    if (!Array.isArray(lines) || lines.length > COOKIE_MAX_PAIRS) throw codedError('COOKIE_PAIR_SHAPE');
    const target = new URL(targetUrl);
    const pairs = new Map();
    for (const part of base.split('; ')) {
        const at = part.indexOf('=');
        const name = part.slice(0, at);
        const value = part.slice(at + 1);
        if (name === REQUIRED_COOKIE_NAME && pairs.has(name) && pairs.get(name) !== value) {
            throw codedError('COOKIE_PAIR_SHAPE');
        }
        pairs.set(name, value);
    }
    for (const raw of lines) {
        const line = String(raw || '');
        if (line.length > COOKIE_MAX_LENGTH || /[\u0000-\u001f\u007f]/.test(line)) throw codedError('COOKIE_CONTROL_CHAR');
        const parts = line.split(';');
        const head = parts.shift().trim();
        const at = head.indexOf('=');
        if (at < 1) { dropped.push('(malformed name)'); continue; }
        const name = head.slice(0, at).trim();
        const value = head.slice(at + 1).trim();
        if (!COOKIE_NAME_RE.test(name) || !COOKIE_VALUE_RE.test(value)) {
            if (name === REQUIRED_COOKIE_NAME) throw codedError('COOKIE_PAIR_SHAPE');
            dropped.push(COOKIE_NAME_RE.test(name) ? name : '(malformed name)');
            continue;
        }
        const attributes = new Map();
        for (const part of parts) {
            const equalsAt = part.indexOf('=');
            attributes.set((equalsAt < 0 ? part : part.slice(0, equalsAt)).trim().toLowerCase(),
                equalsAt < 0 ? '' : part.slice(equalsAt + 1).trim());
        }
        const domain = String(attributes.get('domain') || target.hostname).replace(/^\./, '').toLowerCase();
        if (domain !== target.hostname && !target.hostname.endsWith('.' + domain)) continue;
        const defaultPath = target.pathname.slice(0, target.pathname.lastIndexOf('/')) || '/';
        const rawPath = attributes.get('path');
        const cookiePath = rawPath && rawPath.startsWith('/') ? rawPath : defaultPath;
        if (target.pathname !== cookiePath && !(target.pathname.startsWith(cookiePath)
            && (cookiePath.endsWith('/') || target.pathname[cookiePath.length] === '/'))) continue;
        const maxAge = attributes.get('max-age');
        const expires = Date.parse(attributes.get('expires') || '');
        const removed = /^-?\d+$/.test(maxAge || '') ? Number(maxAge) <= 0 : Number.isFinite(expires) && expires <= Date.now();
        if (removed || !value) pairs.delete(name);
        else pairs.set(name, value);
    }
    const result = validateCookieHeader(Array.from(pairs, ([name, value]) => name + '=' + value).join('; '));
    lastDroppedCookieNames = Array.from(new Set(dropped.concat(droppedCookieNames()))).slice(0, 12);
    return result;
}

// ⛔ «ចាប់មិនកើត» ជា **ពាក្យ** មិនមែនរង្វាស់ ៖ ជុំ 2026-09-09 ដកចំណុច
// ចាប់ផ្តើម gate ចេញវិញ ដោយ **មូលហេតុឫសគល់មិនទាន់វាស់** ព្រោះ helper
// មិនប្រាប់ថា browser បានទៅដល់ណា។ អ្នករាប់នេះឆ្លើយសំណួរនោះពេលអស់ម៉ោង ៖
// គ្មានការហៅ API សោះ (មិនទាន់បើក Argus) · មាន តែ ZTO បដិសេធ (session ងាប់) ·
// ឬមាន ២xx (ការជាប់ឋិតនៅជំហានក្រោយ)។
// ⛔ វាឈរ **ក្រៅផ្លូវចាប់ទាំងស្រុង** ៖ listener ដាច់ដោយឡែក · ចុះឈ្មោះ
// **ក្រោយ** អ្នកចាប់ · គ្រប់ការអានរុំក្នុង try ➜ getter ដែលបោះ មិនអាច
// កាត់ផ្តាច់ការចាប់បានទេ។ ⛔ **លេខប៉ុណ្ណោះ** — គ្មាន URL គ្មាន Cookie។
function watchApiTraffic(context) {
    const tally = { seen: 0, ok: 0, denied: 0, other: 0 };
    const onResponse = (response) => {
        try {
            if (new URL(String(response.url() || '')).hostname !== API_HOST) return;
            tally.seen++;
            const status = Number(response.status()) || 0;
            if (status >= 200 && status < 300) tally.ok++;
            else if (status === 401 || status === 403) tally.denied++;
            else tally.other++;
        } catch (_) {}
    };
    context.on('response', onResponse);
    return {
        tally: () => Object.assign({}, tally),
        summary: () => {
            const lines = ['Seen on the ZTO API: ' + tally.seen + ' answer(s), ' + tally.ok
                + ' OK, ' + tally.denied + ' not-signed-in, ' + tally.other + ' other.'];
            if (!tally.seen) {
                lines.push('   The browser never called the ZTO API. Open Argus from the gate page');
                lines.push('   (the branch card), then scan one Waybill.');
            } else if (!tally.ok) {
                lines.push('   ZTO refused every call. Log in again in the browser window, then retry.');
            } else {
                lines.push('   ZTO answered, but no signed-in success carried a usable session cookie.');
                lines.push('   Open Scan Management -> Arrival Scan and scan one Waybill, then retry.');
            }
            return lines;
        },
        stop: () => { context.off('response', onResponse); }
    };
}

function waitForOrderCookie(context, timeoutMs, options) {
    const configuredTimeout = options && options.responseTimeoutMs;
    const responseTimeoutMs = Number.isFinite(configuredTimeout)
        ? Math.max(1, Math.min(CAPTURE_RESPONSE_TIMEOUT_MS, configuredTimeout)) : CAPTURE_RESPONSE_TIMEOUT_MS;
    return new Promise((resolve, reject) => {
        let settled = false;
        const pending = new Set();
        const finish = (error, value) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            context.off('response', onResponse);
            context.off('close', onClose);
            for (const job of pending) job.cancel();
            pending.clear();
            if (error) reject(error);
            else resolve(value);
        };
        const onResponse = (response) => {
            if (settled || pending.size >= 4 || !isTargetApiUrl(response.url())) return;
            const request = response.request();
            if (!request || !isTargetApiUrl(request.url())) return;
            if (CAPTURE_METHODS.indexOf(String(request.method() || '').toUpperCase()) < 0) return;
            const status = response.status();
            if (status < 200 || status >= 300) return;
            const job = { active: true, cancel: () => {} };
            const deadline = new Promise((done) => {
                const responseTimer = setTimeout(() => job.cancel(), responseTimeoutMs);
                job.cancel = () => { job.active = false; clearTimeout(responseTimer); done(''); };
            });
            pending.add(job);
            const inspect = async () => {
                const headers = await response.allHeaders();
                if (!job.active || settled) return '';
                if (!/^application\/(?:[\w.+-]+\+)?json\b/i.test(headers['content-type'] || '')) return '';
                const declaredLength = Number(headers['content-length']);
                if (Number.isFinite(declaredLength) && declaredLength > NETLIFY_RESPONSE_MAX_BYTES) return '';
                const body = await response.body();
                if (!job.active || settled || body.length > NETLIFY_RESPONSE_MAX_BYTES) return '';
                if (!captureResponseSucceeded(JSON.parse(body.toString('utf8')))) return '';
                const cookie = await cookieHeaderFromRequest(request);
                if (!job.active || settled || !cookie) return '';
                const lines = await response.headerValues('set-cookie');
                if (!job.active || settled) return '';
                return cookieAfterResponse(cookie, lines, request.url());
            };
            Promise.race([inspect(), deadline]).then((cookie) => {
                if (cookie && job.active && !settled) finish(null, cookie);
            }, () => {}).finally(() => { job.cancel(); pending.delete(job); });
        };
        const onClose = () => finish(codedError('BROWSER_CLOSED'));
        const timer = setTimeout(() => finish(codedError('CAPTURE_TIMEOUT')), timeoutMs);
        context.on('response', onResponse);
        context.on('close', onClose);
    });
}

// ⛔ ច្រកទ្វារ **អត្តសញ្ញាណ** មិនមែន `endsWith` ធូរ ៖ `aargus-api.ztoglobal.com`
// មិនត្រូវរាប់ជា Argus ហើយ `argus.ztoglobal.com.evil.test` ក៏ដូចគ្នា។
function isArgusHost(hostname) {
    const host = String(hostname || '').toLowerCase();
    return host === ARGUS_HOST || host.endsWith('.' + ARGUS_HOST);
}

// ⛔ **ការចុចជំនួសអ្នកប្រើ ត្រូវ fail-open ទាំងស្រុង** ៖ រកតំណមិនឃើញ · ទំព័រ
// ប្តូរ · evaluate បោះ ➜ ឧបករណ៍ត្រឡប់ទៅឥរិយាបថចាស់បេះបិទ (អ្នកប្រើចុចដោយដៃ)។
// ⛔ វាដើរតាម **អត្តសញ្ញាណ host** មិនមែនតាម *លំដាប់កាត* ឬ *ពាក្យក្នុងចំណងជើង*
// (ទំព័រ gate ប្តូរភាសាបាន ➜ ការផ្គូផ្គងតាមអក្សរធ្លាក់ស្ងាត់ៗ)។
// ⛔ ច្រកទ្វារ ៣ មុនចុច ៖ ទំព័រនៅលើ gate · គ្មាន tab ណាឈរលើ Argus រួច
// (អ្នកប្រើចុចមុន ➜ កុំបើកស្ទួន) · ការចាប់មិនទាន់ចប់។
async function openArgusFromPortal(context, page, isDone, options) {
    const config = options || {};
    const timeoutMs = Number.isFinite(config.timeoutMs)
        ? Math.max(1, Math.min(PORTAL_OPEN_TIMEOUT_MS, config.timeoutMs)) : PORTAL_OPEN_TIMEOUT_MS;
    const pollMs = Number.isFinite(config.pollMs)
        ? Math.max(1, Math.min(PORTAL_OPEN_POLL_MS, config.pollMs)) : PORTAL_OPEN_POLL_MS;
    const deadline = Date.now() + timeoutMs;
    let links = 0;
    while (!isDone() && Date.now() < deadline) {
        let here = '';
        try { here = new URL(page.url()).hostname.toLowerCase(); } catch (_) { return { opened: false, links, reason: 'page' }; }
        if (isArgusHost(here)) return { opened: false, links, reason: 'already' };
        for (const other of context.pages()) {
            let host = '';
            try { host = new URL(other.url()).hostname.toLowerCase(); } catch (_) { continue; }
            if (isArgusHost(host)) return { opened: false, links, reason: 'already' };
        }
        let found = null;
        try {
            found = await page.evaluate((host) => {
                const points = (value) => {
                    try {
                        const name = new URL(value, location.href).hostname.toLowerCase();
                        return name === host || name.endsWith('.' + host);
                    } catch (_) { return false; }
                };
                const links = Array.from(document.querySelectorAll('a[href]'));
                const direct = links.filter((node) => points(node.href));
                if (direct.length) { direct[0].click(); return { total: links.length, clicked: true, via: 'href' }; }
                for (const node of Array.from(document.querySelectorAll('*'))) {
                    for (const attr of Array.from(node.attributes || [])) {
                        const value = String(attr.value || '');
                        if (value.indexOf(host) !== -1 && points(value)) {
                            node.click();
                            return { total: links.length, clicked: true, via: 'attr' };
                        }
                    }
                }
                return { total: links.length, clicked: false, via: '' };
            }, ARGUS_HOST);
        } catch (_) { found = null; }
        if (found) {
            links = Number(found.total) || 0;
            if (found.clicked) return { opened: true, links, reason: String(found.via || 'link') };
        }
        try { await page.waitForTimeout(pollMs); } catch (_) { return { opened: false, links, reason: 'page' }; }
    }
    return { opened: false, links, reason: isDone() ? 'done' : 'no-link' };
}

async function captureCookieHeader() {
    const launched = await launchLocalBrowser();
    const context = launched.context;
    let waiter;
    let watcher = null;
    try {
        waiter = waitForOrderCookie(context, CAPTURE_TIMEOUT_MS);
        waiter.catch(() => {});
        watcher = watchApiTraffic(context);
        const pages = context.pages();
        const page = pages[0] || await context.newPage();
        console.log('The ZTO gate page is open in ' + (launched.channel === 'msedge' ? 'Microsoft Edge' : 'Google Chrome') + '.');
        console.log('   1. The gate usually keeps your session. Log in only if ZTO asks.');
        console.log('   2. This tool opens Argus for you. If it does not, click the branch card.');
        console.log('   3. Stay on the page. This tool continues by itself as soon as ZTO');
        console.log('      answers one signed-in API call with success.');
        console.log('   4. If it keeps waiting, open Scan Management -> Arrival Scan and');
        console.log('      type or scan one Waybill.');
        console.log('   If the gate page does not open, type ' + ARGUS_URL + ' in the address bar.');
        try {
            await page.goto(PORTAL_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
        } catch (_) {
            console.log('WARNING: the ZTO gate did not answer yet. The page stays open, so log in or refresh.');
        }
        let captured = false;
        waiter.then(() => { captured = true; }, () => { captured = true; });
        try {
            const opened = await openArgusFromPortal(context, page, () => captured);
            if (opened.opened) console.log('   Opened Argus for you. Waiting for a signed-in answer...');
            else if (opened.reason === 'no-link') {
                console.log('   Could not find the Argus link on the gate page (' + opened.links + ' link(s) seen).');
                console.log('   Please click the branch card yourself. Everything else keeps working.');
            }
        } catch (_) {
            console.log('   Could not open Argus automatically. Please click the branch card yourself.');
        }
        return await waiter;
    } catch (error) {
        if (watcher) for (const line of watcher.summary()) console.log(line);
        throw error;
    } finally {
        if (watcher) watcher.stop();
        try { await context.close(); } catch (_) {}
    }
}

function safeFailureMessage(code) {
    const messages = {
        CAPTURE_TIMEOUT: 'Waited 10 minutes and saw no signed-in ZTO API answer. Open Argus from the gate page, then scan one Waybill.',
        BROWSER_CLOSED: 'The browser was closed before the cookie was captured. Please try again.',
        BROWSER_LAUNCH_FAILED: 'Could not start Edge/Chrome. Close any old ZTO Cookie Sync window, or install Edge/Chrome.',
        BROWSER_NOT_FOUND: 'Microsoft Edge or Google Chrome was not found.',
        NETLIFY_CONFIG_MISSING: 'No Netlify configuration yet. Run setup.cmd.',
        NETLIFY_CONFIG_INVALID: 'The Netlify Site ID has a bad shape. Run setup.cmd again.',
        NETLIFY_TOKEN_MISSING: 'No Netlify token yet. Run setup.cmd.',
        NETLIFY_TOKEN_READER_MISSING: 'read-token.ps1 is missing. Download the tool folder again.',
        NETLIFY_TOKEN_READ_FAILED: 'Windows could not unlock the Netlify token. Run setup.cmd again as the same Windows user.',
        NETLIFY_TOKEN_INVALID: 'The Netlify token has a bad shape. Run setup.cmd again.',
        NETLIFY_NETWORK: 'Could not reach the Netlify API. Check your internet connection.',
        NETLIFY_TIMEOUT: 'The Netlify API took longer than 30 seconds. Please try again.',
        NETLIFY_SITE_REJECTED: 'Netlify rejected the Site ID or token. Run setup.cmd and enter them again.',
        NETLIFY_SITE_INVALID_RESPONSE: 'Netlify answered in an unexpected shape. The cookie was not changed.',
        NETLIFY_BLOB_URL_FAILED: 'Netlify refused to write the cookie store. Check the Site ID and the PAT scope.',
        NETLIFY_BLOB_URL_INVALID: 'Netlify returned a bad upload path. The cookie was not sent.',
        NETLIFY_BLOB_UPLOAD_FAILED: 'Writing the cookie into Netlify Blobs failed. Please try again.',
        NETLIFY_BLOB_REDIRECT: 'Netlify redirected the upload to another host. The cookie was not sent, for safety.',
        SITE_URL_INVALID: 'The Site URL has a bad shape (https is required). Run setup.cmd again.',
        DIAG_REJECTED: 'The Function refused the check. Verify ZTO_PROXY_KEY in setup.cmd and in Netlify.',
        DIAG_INVALID: 'The Function answered in an unexpected shape during the check.',
        COOKIE_TOO_SHORT: 'The captured cookie is too short. Log in to Argus again.',
        COOKIE_TOO_LONG: 'The captured cookie is longer than the safety limit.',
        COOKIE_CONTROL_CHAR: 'The captured cookie contains control characters. Rejected to block header injection.',
        COOKIE_TOO_MANY_PAIRS: 'The captured cookie has more pairs than the safety limit.',
        COOKIE_SESSION_MISSING: 'The request carries no valid BOS-MAN-SESSION. Log in to Argus again.',
        COOKIE_PAIR_SHAPE: 'The captured cookie has a bad shape.',
        COOKIE_NAME_SHAPE: 'A captured cookie name has a bad shape.',
        COOKIE_VALUE_SHAPE: 'A captured cookie value has a bad shape.'
    };
    return messages[code] || 'Unknown error.';
}

// ⛔ ច្រកទ្វារ --auto ត្រូវវាស់ **តម្លៃដែលដោះសោបាន** មិនមែនវត្តមានឯកសារ។
// សោដែលនៅលើថាសតែដោះមិនចេញ (ប្តូរ Windows user · DPAPI ខូច) ធ្វើឲ្យការពិនិត្យ
// តាមឯកសារជា **ការការពារដែលងាប់** ៖ schtasks ចុះឈ្មោះជោគជ័យ រួច --auto
// ស្ងាត់រាល់ការចូល Windows។ ហើយសារត្រូវ **ដាក់ឈ្មោះអ្វីដែលខ្វះ** ព្រោះ
// «ខ្វះទាំង ២» និង «ខ្វះតែសោ» ជាការកែ ២ ផ្សេងគ្នាសម្រាប់អ្នកប្រើ។
function autoReadiness(verification) {
    const source = verification || {};
    const missing = [];
    if (!String(source.siteUrl || '')) missing.push('siteUrl');
    if (!String(source.proxyKey || '')) missing.push('proxyKey');
    return { ready: missing.length === 0, missing };
}

function describeAutoReadiness(readiness) {
    const missing = (readiness && readiness.missing) || [];
    const labels = {
        siteUrl: 'ZoeW Site URL (for example https://zoew.netlify.app)',
        proxyKey: 'ZTO_PROXY_KEY (the same value as in Netlify)'
    };
    if (!missing.length) {
        return 'OK: Site URL and proxy key are ready for --auto mode.';
    }
    const lines = ['ERROR: --auto mode needs these missing values:'];
    missing.forEach((key) => lines.push('   - ' + (labels[key] || key)));
    lines.push('');
    lines.push('Run setup.cmd again. It keeps the old Site ID and Netlify token:');
    lines.push('press Enter to skip every prompt that already has a value.');
    if (missing.indexOf('siteUrl') !== -1) {
        lines.push('NOTE: the ZTO_PROXY_KEY prompt appears only AFTER the Site URL.');
    }
    return lines.join('\n');
}

// ⛔ របៀប --auto រត់ **ដោយគ្មានមនុស្ស** ➜ ការបើក browser ដោយមិនដឹងស្ថានភាព
// ពិត គឺជាការរំខានរាល់ការចូល Windows។ ដូច្នេះវាបើកតែពេលមានសាលក្រមច្បាស់ថា
// Cookie ស្លាប់ប៉ុណ្ណោះ។
function shouldRefreshInAuto(health) {
    return !!health && health.status === 'ok' && health.healthy === false;
}

function describeHealth(health) {
    if (health.status === 'unconfigured') {
        return 'INFO: not checked - Site URL and proxy key are not set in setup.cmd yet.';
    }
    if (health.status === 'unreachable') {
        return 'WARNING: could not reach the Function. Check your internet or the Site URL.';
    }
    if (health.healthy === null) {
        return 'INFO: the cookie is stored, but ZTO acceptance is not yet verified. Try a parcel lookup.';
    }
    const parts = [
        'source: ' + (health.source || 'none'),
        'renewals: ' + health.renewals
    ];
    if (health.storeReason) parts.push('store: ' + health.storeReason);
    if (health.authRejectedAgeMs !== null) {
        parts.push('ZTO rejected it ' + Math.round(health.authRejectedAgeMs / 1000) + 's ago');
    }
    return (health.healthy ? 'OK: the cookie still works. ' : 'WARNING: a new cookie is needed. ')
        + parts.join(' | ');
}

async function reportVerification(cookieHeader) {
    let verification;
    try {
        verification = await resolveVerification();
    } catch (_) {
        verification = { siteUrl: '', proxyKey: '' };
    }
    if (!verification.siteUrl || !verification.proxyKey) {
        console.log('   INFO: final check skipped - add the Site URL and proxy key in setup.cmd.');
        console.log('   New scans will use this cookie within about a minute.');
        return;
    }
    console.log('   Checking that the Function can see the new cookie...');
    let result;
    try {
        result = await verifyCookieLive(cookieHeader, verification);
    } catch (_) {
        result = { status: 'unverifiable', attempts: 0 };
    }
    if (result.status === 'match') {
        console.log('   OK: stored cookie verified in the Function (source: '
            + (result.source || 'blob') + ', ' + result.fingerprint + ').');
        console.log(result.validity === 'accepted'
            ? '   ZTO accepted this cookie on a recent lookup.'
            : '   ZTO acceptance from Netlify is not yet verified. Try a parcel lookup.');
        return;
    }
    if (result.status === 'rejected') {
        console.log('   WARNING: the stored cookie matches, but ZTO rejected it.');
        console.log('   Log in to Argus again, complete a successful parcel lookup, then sync again.');
        return;
    }
    if (result.status === 'unreachable') {
        console.log('   WARNING: could not reach the Function. The cookie is written - try a scan in a minute.');
        return;
    }
    if (result.status === 'auth-override') {
        console.log('   STOP: Netlify env has ZTO_AUTHORIZATION or ZTO_TOKEN, so the Function');
        console.log('         uses that token and NEVER reads the cookie store. The cookie was');
        console.log('         written, but it stays unused until you delete those env values.');
        return;
    }
    console.log('   WARNING: the Function does not see the new cookie yet (checked '
        + result.attempts + ' times).');
    // ⛔ សារត្រូវប្រាប់ **អ្វីដែលឃើញពិត** — បើអត់ អ្នកប្រើកែមិនបាន។
    if (result.source === 'env') {
        console.log('      It is still reading ZTO_COOKIE (env), not the blob'
            + (result.storeReason ? ' - store reason: ' + result.storeReason : '') + '.');
        console.log('      If this stays the same after a minute: check that the newest deploy is');
        console.log('      live and that Netlify Blobs is enabled for this site.');
    } else if (result.source === 'blob') {
        console.log('      It reads the blob, but the value is still the old one (60s cache + edge).');
    } else if (result.storeReason) {
        console.log('      Cookie store is stuck at: ' + result.storeReason + '.');
    }
    console.log('      The cookie is written - try a scan in a minute.');
}

// ⛔ **សំណើអ្នកប្រើ (2026-09-02)** ៖ *«សូមអោយបង្ហាញ cookie ដែលយកបានពី argus
// ក្នុង cmd ផង»*។ តម្លៃនេះជា session ZTO របស់អ្នកប្រើផ្ទាល់ ដែលគាត់កាន់ស្រាប់
// ក្នុង browser ➜ ការបង្ហាញវាលើអេក្រង់របស់គាត់មិនបន្ថែមអ្នកកាន់ថ្មីទេ ហើយវា
// ចាំបាច់ពេលត្រូវ paste ចូល `ZTO_COOKIE` ជាផ្លូវបម្រុង។
// ⛔ **Netlify PAT និង ZTO_PROXY_KEY នៅតែហាមបង្ហាញដាច់ខាត** — `zto-cookie-sync-test.js`
// ចាក់សោទាំង ២ ទិស ៖ Cookie ត្រូវបង្ហាញ · សោមិនត្រូវបង្ហាញ។
function describeCapturedCookie(cookieHeader) {
    const lines = [
        '',
        '--- Cookie captured from Argus (paste into ZTO_COOKIE if you ever need a fallback) ---',
        String(cookieHeader || ''),
        '--- end of cookie ---',
        ''
    ];
    return lines.join('\n');
}

async function main() {
    if (process.argv.includes('--auto-ready')) {
        const readiness = autoReadiness(await resolveVerification());
        console.log(describeAutoReadiness(readiness));
        if (!readiness.ready) process.exitCode = 1;
        return;
    }

    if (process.argv.includes('--check')) {
        console.log('Checking the health of the ZTO cookie...');
        console.log(describeHealth(await checkCookieHealth(await resolveVerification())));
        return;
    }

    if (process.argv.includes('--auto')) {
        const health = await checkCookieHealth(await resolveVerification());
        console.log(describeHealth(health));
        if (!shouldRefreshInAuto(health)) {
            console.log('No browser needed. Nothing to do.');
            return;
        }
        console.log('Getting a new cookie...');
    }

    if (process.argv.includes('--verify-setup')) {
        console.log('Checking the Netlify Site ID and token...');
        await verifyNetlifySetup();
        console.log('OK: setup is complete. From now on, double-click sync-zto-cookie.cmd when the cookie expires.');
        return;
    }

    console.log('Capturing the cookie from a real request header - no DevTools, no extension...');
    let cookieHeader = await captureCookieHeader();
    console.log('OK: cookie captured.');
    console.log(describeCapturedCookie(cookieHeader));
    // ⛔ ការរំលងគូត្រូវ **មើលឃើញ** — ការរំលងស្ងាត់ធ្វើឲ្យបញ្ហាថ្ងៃក្រោយ
    // វិនិច្ឆ័យមិនបាន។ បោះពុម្ព **ឈ្មោះ** ប៉ុណ្ណោះ មិនដែលបោះតម្លៃឡើយ។
    const skipped = droppedCookieNames();
    if (skipped.length) {
        console.log('   INFO: skipped ' + skipped.length + ' cookie pair(s) with an odd shape: '
            + skipped.join(', ') + ' (BOS-MAN-SESSION is still there).');
    }
    try {
        console.log('Writing the cookie into Netlify Blobs...');
        await syncNetlifyCookie(cookieHeader);
        console.log('\nOK: the new cookie is in Netlify Blobs - no redeploy needed.');
        await reportVerification(cookieHeader);
    } finally {
        cookieHeader = '';
    }
}

if (require.main === module) {
    main().catch((error) => {
        console.error('\nERROR: ' + safeFailureMessage(error && error.code));
        process.exitCode = 1;
    });
}

module.exports = {
    autoReadiness,
    describeCapturedCookie,
    diagnosticsCookie,
    describeHealth,
    droppedCookieNames,
    checkCookieHealth,
    cookieFingerprint,
    cookieHeaderFromHeaders,
    cookieHeaderFromRequest,
    getNetlifySite,
    isArgusHost,
    isTargetApiUrl,
    loadConfig,
    localStateRoot,
    netlifyApiUrl,
    NETLIFY_RETRY_ATTEMPTS,
    profileRoot,
    readDiagnostics,
    readTokenViaPowerShell,
    requestBlobUploadUrl,
    resolveVerification,
    shouldRefreshInAuto,
    safeFailureMessage,
    statePaths,
    syncNetlifyCookie,
    timedFetch,
    uploadCookieToBlob,
    validateCookieHeader,
    validateSignedUrl,
    validateSiteId,
    validateSiteUrl,
    verifyCookieLive,
    validateToken,
    verifyNetlifySetup,
    openArgusFromPortal,
    waitForOrderCookie,
    watchApiTraffic
};
