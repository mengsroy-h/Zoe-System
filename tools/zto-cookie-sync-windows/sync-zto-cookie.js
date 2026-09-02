'use strict';

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const TOOL_DIR = __dirname;
const ARGUS_URL = 'https://argus.ztoglobal.com/';
const API_HOST = 'aargus-api.ztoglobal.com';
const CAPTURE_TIMEOUT_MS = 10 * 60 * 1000;

const NETLIFY_API_ORIGIN = 'https://api.netlify.com';
const BLOB_STORE_NAME = 'zto-auth';
const BLOB_KEY = 'cookie';
const SIGNED_URL_ACCEPT = 'application/json;type=signed-url';
const SIGNED_URL_MAX_LENGTH = 4096;
const DIAG_PATH = '/.netlify/functions/zto-order-detail?diag=1';
const PROXY_KEY_HEADER = 'X-Zoe-Proxy-Key';
const VERIFY_TIMEOUT_MS = 10 * 1000;
const VERIFY_DEADLINE_MS = 75 * 1000;
const VERIFY_GAP_MS = 5 * 1000;
const VERIFY_MAX_ATTEMPTS = 32;
const SITE_URL_MAX_LENGTH = 512;
const NETLIFY_TIMEOUT_MS = 30 * 1000;
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

function codedError(code) {
    const error = new Error(code);
    error.code = code;
    return error;
}

function isTargetApiUrl(raw) {
    try {
        const url = new URL(String(raw || ''));
        return url.protocol === 'https:' && url.hostname === API_HOST;
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
            dropped.push(COOKIE_NAME_RE.test(name) ? name : '(ឈ្មោះខូច)');
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
    if (dropped.length) lastDroppedCookieNames = dropped.slice(0, 12);
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

function timedFetch(url, options, controls) {
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
            if (error) reject(error);
            else resolve(response);
        };
        const timer = setTimeout(() => {
            try { controller.abort(); } catch (_) {}
            finish(codedError('NETLIFY_TIMEOUT'));
        }, timeoutMs);

        let pending;
        try {
            pending = fetchImpl(url, Object.assign({ redirect: 'error' }, options, {
                signal: controller.signal
            }));
        } catch (_) {
            finish(codedError('NETLIFY_NETWORK'));
            return;
        }
        Promise.resolve(pending).then(
            (response) => finish(null, response),
            () => finish(codedError('NETLIFY_NETWORK'))
        );
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
            await response.body.cancel();
        }
    } catch (_) {}
}

async function readSmallJson(response, errorCode) {
    const code = errorCode || 'NETLIFY_SITE_INVALID_RESPONSE';
    let text;
    try {
        text = await response.text();
    } catch (_) {
        throw codedError(code);
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
    const response = await timedFetch(
        netlifyApiUrl('/api/v1/sites/' + encodeURIComponent(cleanSiteId)),
        { method: 'GET', headers: netlifyHeaders(token) },
        controls
    );
    if (!response || !response.ok) {
        await discardResponse(response);
        throw codedError('NETLIFY_SITE_REJECTED');
    }
    const site = await readSmallJson(response);
    const accountId = validateSiteId(site && site.account_id, 'NETLIFY_SITE_INVALID_RESPONSE');
    return { accountId };
}

async function requestBlobUploadUrl(siteId, token, controls) {
    const cleanSiteId = validateSiteId(siteId);
    const pathname = '/api/v1/blobs/' + encodeURIComponent(cleanSiteId)
        + '/' + BLOB_STORE_NAME + '/' + BLOB_KEY;
    const response = await timedFetch(netlifyApiUrl(pathname), {
        method: 'PUT',
        headers: {
            accept: SIGNED_URL_ACCEPT,
            Authorization: 'Bearer ' + validateToken(token)
        }
    }, controls);
    if (!response || !response.ok) {
        await discardResponse(response);
        throw codedError('NETLIFY_BLOB_URL_FAILED');
    }
    const payload = await readSmallJson(response, 'NETLIFY_BLOB_URL_INVALID');
    return validateSignedUrl(payload && payload.url);
}

async function uploadCookieToBlob(signedUrl, cookieHeader, controls) {
    const cleanCookie = validateCookieHeader(cookieHeader);
    const response = await timedFetch(signedUrl, {
        method: 'PUT',
        redirect: 'manual',
        headers: { 'cache-control': 'max-age=0, stale-while-revalidate=60' },
        body: cleanCookie
    }, controls);
    if (response && response.status >= 300 && response.status < 400) {
        await discardResponse(response);
        throw codedError('NETLIFY_BLOB_REDIRECT');
    }
    if (!response || !response.ok) {
        await discardResponse(response);
        throw codedError('NETLIFY_BLOB_UPLOAD_FAILED');
    }
    await discardResponse(response);
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
    const response = await timedFetch(origin + DIAG_PATH, {
        method: 'GET',
        headers
    }, Object.assign({ timeoutMs: VERIFY_TIMEOUT_MS }, controls));
    if (!response || !response.ok) {
        await discardResponse(response);
        throw codedError('DIAG_REJECTED');
    }
    return readSmallJson(response, 'DIAG_INVALID');
}

function diagnosticsCookie(payload) {
    const info = (payload && payload.cookie) || {};
    return {
        source: typeof info.source === 'string' ? info.source : '',
        fingerprint: typeof info.fingerprint === 'string' ? info.fingerprint : '',
        ageMs: typeof info.ageMs === 'number' ? info.ageMs : null,
        renewals: typeof info.renewals === 'number' ? info.renewals : 0,
        authRejectedAgeMs: typeof info.authRejectedAgeMs === 'number' ? info.authRejectedAgeMs : null
    };
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
    let last = { status: 'unreachable', source: '', fingerprint: '' };

    for (;;) {
        attempts++;
        try {
            const info = diagnosticsCookie(await readDiagnostics(siteUrl, proxyKey, config));
            if (info.fingerprint && info.fingerprint === wanted) {
                return {
                    status: 'match',
                    attempts,
                    source: info.source,
                    fingerprint: info.fingerprint
                };
            }
            last = { status: 'mismatch', source: info.source, fingerprint: info.fingerprint };
        } catch (_) {
            last = { status: 'unreachable', source: '', fingerprint: '' };
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
    return Object.assign({
        status: 'ok',
        healthy: usable && info.authRejectedAgeMs === null
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

async function syncNetlifyCookie(cookieHeader, options) {
    let cleanCookie = validateCookieHeader(cookieHeader);
    const credentials = await resolveCredentials(options);
    try {
        const signedUrl = await requestBlobUploadUrl(credentials.siteId, credentials.token, options);
        await uploadCookieToBlob(signedUrl, cleanCookie, options);
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

function waitForOrderCookie(context, timeoutMs) {
    return new Promise((resolve, reject) => {
        let settled = false;
        const finish = (error, value) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            context.off('request', onRequest);
            context.off('close', onClose);
            if (error) reject(error);
            else resolve(value);
        };
        const onRequest = async (request) => {
            if (settled || !isTargetApiUrl(request.url())) return;
            try {
                const cookie = await cookieHeaderFromRequest(request);
                if (cookie) finish(null, cookie);
            } catch (error) {
                // Request មុន Login អាចមានតែ UI cookie។ រង់ចាំ request ថ្មី
                // ក្រោយ Login ជំនួសការបញ្ចប់ helper ឬ upload cookie ឥត session។
                if (error && error.code === 'COOKIE_SESSION_MISSING') return;
                finish(error);
            }
        };
        const onClose = () => finish(codedError('BROWSER_CLOSED'));
        const timer = setTimeout(() => finish(codedError('CAPTURE_TIMEOUT')), timeoutMs);
        context.on('request', onRequest);
        context.on('close', onClose);
    });
}

async function captureCookieHeader() {
    const launched = await launchLocalBrowser();
    const context = launched.context;
    let waiter;
    try {
        waiter = waitForOrderCookie(context, CAPTURE_TIMEOUT_MS);
        waiter.catch(() => {});
        const pages = context.pages();
        const page = pages[0] || await context.newPage();
        console.log('🌐 បើក Argus ក្នុង ' + (launched.channel === 'msedge' ? 'Microsoft Edge' : 'Google Chrome') + ' រួចរាល់។');
        console.log('   បើត្រូវការ សូម Login ហើយបើក/ស្វែងរកកញ្ចប់ណាមួយក្នុង Argus។');
        console.log('   ឧបករណ៍នឹងបន្តដោយខ្លួនឯងពេលឃើញសំណើ Order Detail។');
        try {
            await page.goto(ARGUS_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
        } catch (_) {
            console.log('⚠️ Argus មិនទាន់ឆ្លើយ — ទំព័រនៅបើកឲ្យអ្នកសាក Login/Refresh។');
        }
        return await waiter;
    } finally {
        try { await context.close(); } catch (_) {}
    }
}

function safeFailureMessage(code) {
    const messages = {
        CAPTURE_TIMEOUT: 'រង់ចាំ ១០ នាទីហើយមិនឃើញ Order Detail request។ សូម Login Argus ហើយបើកកញ្ចប់មួយ។',
        BROWSER_CLOSED: 'Browser ត្រូវបានបិទមុនចាប់ Cookie។ សូមសាកម្តងទៀត។',
        BROWSER_LAUNCH_FAILED: 'បើក Edge/Chrome មិនបាន។ សូមបិទបង្អួច ZTO Cookie Sync ចាស់ ឬដំឡើង Edge/Chrome។',
        BROWSER_NOT_FOUND: 'រកមិនឃើញ Microsoft Edge ឬ Google Chrome។',
        NETLIFY_CONFIG_MISSING: 'មិនទាន់មាន Netlify config។ សូមបើក setup.cmd។',
        NETLIFY_CONFIG_INVALID: 'Netlify Site ID ខូចទម្រង់។ សូមបើក setup.cmd ឡើងវិញ។',
        NETLIFY_TOKEN_MISSING: 'មិនទាន់មាន Netlify token។ សូមបើក setup.cmd។',
        NETLIFY_TOKEN_READER_MISSING: 'បាត់ read-token.ps1។ សូមទាញថតឧបករណ៍ឡើងវិញ។',
        NETLIFY_TOKEN_READ_FAILED: 'Windows មិនអាចដោះសោ Netlify token បាន។ សូមបើក setup.cmd ឡើងវិញក្នុង Windows user ដដែល។',
        NETLIFY_TOKEN_INVALID: 'Netlify token ខូចទម្រង់។ សូមបើក setup.cmd ឡើងវិញ។',
        NETLIFY_NETWORK: 'មិនអាចភ្ជាប់ Netlify API បាន។ សូមពិនិត្យអ៊ីនធឺណិត។',
        NETLIFY_TIMEOUT: 'Netlify API ឆ្លើយយឺតលើស ៣០ វិនាទី។ សូមសាកម្តងទៀត។',
        NETLIFY_SITE_REJECTED: 'Netlify បដិសេធ Site ID ឬ Token។ សូមបើក setup.cmd ហើយបញ្ចូលថ្មី។',
        NETLIFY_SITE_INVALID_RESPONSE: 'Netlify ឆ្លើយទម្រង់មិនត្រឹមត្រូវ។ មិនបានប្តូរ Cookie ទេ។',
        NETLIFY_BLOB_URL_FAILED: 'Netlify មិនអនុញ្ញាតឲ្យសរសេរ Cookie store បានទេ។ សូមពិនិត្យ Site ID និងសិទ្ធិរបស់ PAT។',
        NETLIFY_BLOB_URL_INVALID: 'Netlify ឆ្លើយផ្លូវ upload មិនត្រឹមត្រូវ។ Cookie មិនត្រូវបានផ្ញើទេ។',
        NETLIFY_BLOB_UPLOAD_FAILED: 'ការសរសេរ Cookie ចូល Netlify Blobs បរាជ័យ។ សូមសាកម្តងទៀត។',
        NETLIFY_BLOB_REDIRECT: 'Netlify បញ្ជូនផ្លូវ upload ទៅ host ផ្សេង។ Cookie មិនត្រូវបានផ្ញើទេ ដើម្បីសុវត្ថិភាព។',
        SITE_URL_INVALID: 'Site URL ខូចទម្រង់ (ត្រូវជា https)។ សូមបើក setup.cmd ឡើងវិញ។',
        DIAG_REJECTED: 'Function បដិសេធការផ្ទៀងផ្ទាត់។ សូមពិនិត្យ ZTO_PROXY_KEY ក្នុង setup.cmd និង Netlify។',
        DIAG_INVALID: 'Function ឆ្លើយទម្រង់មិនត្រឹមត្រូវពេលផ្ទៀងផ្ទាត់។',
        COOKIE_TOO_SHORT: 'Cookie ដែលចាប់បានខ្លីពេក។ សូម Login Argus ឡើងវិញ។',
        COOKIE_TOO_LONG: 'Cookie ដែលចាប់បានវែងលើសពិដានសុវត្ថិភាព។',
        COOKIE_CONTROL_CHAR: 'Cookie ដែលចាប់បានមានតួអក្សរគ្រប់គ្រង — បានបដិសេធដើម្បីទប់ header injection។',
        COOKIE_TOO_MANY_PAIRS: 'Cookie ដែលចាប់បានមានផ្នែកច្រើនលើសពិដាន។',
        COOKIE_SESSION_MISSING: 'Request មិនមាន BOS-MAN-SESSION ដែលត្រឹមត្រូវ។ សូម Login Argus ឡើងវិញ។',
        COOKIE_PAIR_SHAPE: 'Cookie ដែលចាប់បានខូចទម្រង់។',
        COOKIE_NAME_SHAPE: 'ឈ្មោះ Cookie ដែលចាប់បានខូចទម្រង់។',
        COOKIE_VALUE_SHAPE: 'តម្លៃ Cookie ដែលចាប់បានខូចទម្រង់។'
    };
    return messages[code] || 'មានកំហុសដែលមិនស្គាល់។';
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
        siteUrl: 'ZoeW Site URL (ឧ. https://zoew.netlify.app)',
        proxyKey: 'ZTO_PROXY_KEY (តម្លៃដដែលនឹងក្នុង Netlify)'
    };
    if (!missing.length) {
        return '✅ Site URL និងសោ Proxy រួចរាល់សម្រាប់របៀប --auto។';
    }
    const lines = ['❌ របៀប --auto ត្រូវការតម្លៃដែលនៅខ្វះ ៖'];
    missing.forEach((key) => lines.push('   • ' + (labels[key] || key)));
    lines.push('');
    lines.push('សូមរត់ setup.cmd ម្តងទៀត។ វារក្សា Site ID និង Netlify token ចាស់ទុក —');
    lines.push('ចុច Enter កាត់ prompt ដែលមានតម្លៃរួច រួចបំពេញតែ ២ ខាងលើ។');
    if (missing.indexOf('siteUrl') !== -1) {
        lines.push('⛔ prompt ZTO_PROXY_KEY លេចឡើង **តែក្រោយ** បំពេញ Site URL។');
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
        return 'ℹ️ មិនបានពិនិត្យ — Site URL និងសោ Proxy មិនទាន់កំណត់ក្នុង setup.cmd។';
    }
    if (health.status === 'unreachable') {
        return '⚠️ ភ្ជាប់ Function មិនបាន។ សូមពិនិត្យអ៊ីនធឺណិត ឬ Site URL។';
    }
    const parts = [
        'ប្រភព: ' + (health.source || 'none'),
        'បន្តអាយុ: ' + health.renewals + ' ដង'
    ];
    if (health.authRejectedAgeMs !== null) {
        parts.push('ZTO បដិសេធនៅ ' + Math.round(health.authRejectedAgeMs / 1000) + ' វិ. មុន');
    }
    return (health.healthy ? '✅ Cookie នៅដំណើរការ។ ' : '⚠️ ត្រូវយក Cookie ថ្មី។ ') + parts.join(' · ');
}

async function reportVerification(cookieHeader) {
    let verification;
    try {
        verification = await resolveVerification();
    } catch (_) {
        verification = { siteUrl: '', proxyKey: '' };
    }
    if (!verification.siteUrl || !verification.proxyKey) {
        console.log('   ℹ️ មិនបានផ្ទៀងផ្ទាត់ចុងក្រោយ — សូមបញ្ចូល Site URL និងសោ Proxy ក្នុង setup.cmd។');
        console.log('   ការស្កេនថ្មីនឹងប្រើ Cookie នេះក្នុងរយៈពេលមួយនាទី។');
        return;
    }
    console.log('   🔎 កំពុងផ្ទៀងផ្ទាត់ថា Function ឃើញ Cookie ថ្មី...');
    let result;
    try {
        result = await verifyCookieLive(cookieHeader, verification);
    } catch (_) {
        result = { status: 'unverifiable', attempts: 0 };
    }
    if (result.status === 'match') {
        console.log('   ✅ ផ្ទៀងផ្ទាត់រួច — Function កំពុងប្រើ Cookie ថ្មី (ប្រភព: '
            + (result.source || 'blob') + ' · ' + result.fingerprint + ')។');
        return;
    }
    if (result.status === 'unreachable') {
        console.log('   ⚠️ ភ្ជាប់ Function មិនបាន។ Cookie ត្រូវសរសេររួច — សូមសាកស្កេនក្នុងមួយនាទី។');
        return;
    }
    console.log('   ⚠️ Function នៅមិនទាន់ឃើញ Cookie ថ្មី (រង់ចាំ ' + result.attempts + ' ដង)។');
    console.log('      Cookie ត្រូវសរសេររួច — សូមសាកស្កេនក្នុងមួយនាទី។');
}

async function main() {
    if (process.argv.includes('--auto-ready')) {
        const readiness = autoReadiness(await resolveVerification());
        console.log(describeAutoReadiness(readiness));
        if (!readiness.ready) process.exitCode = 1;
        return;
    }

    if (process.argv.includes('--check')) {
        console.log('🔎 កំពុងពិនិត្យសុខភាព Cookie ZTO...');
        console.log(describeHealth(await checkCookieHealth(await resolveVerification())));
        return;
    }

    if (process.argv.includes('--auto')) {
        const health = await checkCookieHealth(await resolveVerification());
        console.log(describeHealth(health));
        if (!shouldRefreshInAuto(health)) {
            console.log('⛔ មិនបើក browser ទេ។');
            return;
        }
        console.log('➜ កំពុងយក Cookie ថ្មី...');
    }

    if (process.argv.includes('--verify-setup')) {
        console.log('🔎 កំពុងផ្ទៀងផ្ទាត់ Netlify Site ID និង token...');
        await verifyNetlifySetup();
        console.log('✅ Setup រួចរាល់។ ចាប់ពីពេលនេះ double-click sync-zto-cookie.cmd ពេល Cookie ផុត។');
        return;
    }

    console.log('🔎 កំពុងចាប់ Cookie ពី Request Header ពិត — មិនប្រើ DevTools និងមិនប្រើ extension...');
    let cookieHeader = await captureCookieHeader();
    console.log('✅ ចាប់ Cookie បាន។ តម្លៃមិនត្រូវបានបង្ហាញ ឬសរសេរចូលឯកសារទេ។');
    // ⛔ ការរំលងគូត្រូវ **មើលឃើញ** — ការរំលងស្ងាត់ធ្វើឲ្យបញ្ហាថ្ងៃក្រោយ
    // វិនិច្ឆ័យមិនបាន។ បោះពុម្ព **ឈ្មោះ** ប៉ុណ្ណោះ មិនដែលបោះតម្លៃឡើយ។
    const skipped = droppedCookieNames();
    if (skipped.length) {
        console.log('   ℹ️ រំលងគូ cookie ដែលមិនស៊ីទម្រង់ ' + skipped.length + ' ៖ '
            + skipped.join(', ') + ' (BOS-MAN-SESSION នៅគ្រប់)។');
    }
    try {
        console.log('🔐 កំពុងសរសេរ Cookie ចូល Netlify Blobs...');
        await syncNetlifyCookie(cookieHeader);
        console.log('\n✅ Cookie ថ្មីចូល Netlify Blobs រួចរាល់ — ⛔ មិនចាំបាច់ redeploy ទេ។');
        await reportVerification(cookieHeader);
    } finally {
        cookieHeader = '';
    }
}

if (require.main === module) {
    main().catch((error) => {
        console.error('\n❌ ' + safeFailureMessage(error && error.code));
        process.exitCode = 1;
    });
}

module.exports = {
    autoReadiness,
    droppedCookieNames,
    checkCookieHealth,
    cookieFingerprint,
    cookieHeaderFromHeaders,
    cookieHeaderFromRequest,
    getNetlifySite,
    isTargetApiUrl,
    loadConfig,
    localStateRoot,
    netlifyApiUrl,
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
    waitForOrderCookie
};
