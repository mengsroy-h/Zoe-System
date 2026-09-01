'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const TOOL_DIR = __dirname;
const ARGUS_URL = 'https://argus.ztoglobal.com/';
const API_HOST = 'aargus-api.ztoglobal.com';
const ORDER_DETAIL_PATH = '/scan/get/order/detail';
const CAPTURE_TIMEOUT_MS = 10 * 60 * 1000;

const NETLIFY_API_ORIGIN = 'https://api.netlify.com';
const NETLIFY_ENV_KEY = 'ZTO_COOKIE';
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

function codedError(code) {
    const error = new Error(code);
    error.code = code;
    return error;
}

function isTargetApiUrl(raw) {
    try {
        const url = new URL(String(raw || ''));
        return url.protocol === 'https:'
            && url.hostname === API_HOST
            && (url.pathname === ORDER_DETAIL_PATH || url.pathname.startsWith(ORDER_DETAIL_PATH + '/'));
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

    const rawPairs = text.split(';');
    if (rawPairs.length > COOKIE_MAX_PAIRS) throw codedError('COOKIE_TOO_MANY_PAIRS');
    const pairs = [];
    let hasSession = false;
    for (const rawPair of rawPairs) {
        const pair = rawPair.trim();
        const equalsAt = pair.indexOf('=');
        if (equalsAt < 1) throw codedError('COOKIE_PAIR_SHAPE');
        const name = pair.slice(0, equalsAt).trim();
        const value = pair.slice(equalsAt + 1);
        if (!COOKIE_NAME_RE.test(name)) throw codedError('COOKIE_NAME_SHAPE');
        if (!COOKIE_VALUE_RE.test(value)) throw codedError('COOKIE_VALUE_SHAPE');
        if (name === REQUIRED_COOKIE_NAME && value.length >= 8) hasSession = true;
        pairs.push(name + '=' + value);
    }
    if (!hasSession) throw codedError('COOKIE_SESSION_MISSING');
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
        token: path.join(root, 'netlify-token.dpapi')
    };
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
    return { siteId: validateSiteId(parsed && parsed.siteId) };
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
            pending = fetchImpl(url, Object.assign({}, options, {
                signal: controller.signal,
                redirect: 'error'
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

function netlifyHeaders(token, hasJsonBody) {
    const headers = {
        Accept: 'application/json',
        Authorization: 'Bearer ' + validateToken(token)
    };
    if (hasJsonBody) headers['Content-Type'] = 'application/json';
    return headers;
}

async function discardResponse(response) {
    try {
        if (response && response.body && typeof response.body.cancel === 'function') {
            await response.body.cancel();
        }
    } catch (_) {}
}

async function readSmallJson(response) {
    let text;
    try {
        text = await response.text();
    } catch (_) {
        throw codedError('NETLIFY_SITE_INVALID_RESPONSE');
    }
    if (Buffer.byteLength(text, 'utf8') > NETLIFY_RESPONSE_MAX_BYTES) {
        throw codedError('NETLIFY_SITE_INVALID_RESPONSE');
    }
    try {
        return JSON.parse(text);
    } catch (_) {
        throw codedError('NETLIFY_SITE_INVALID_RESPONSE');
    }
}

async function getNetlifySite(siteId, token, controls) {
    const cleanSiteId = validateSiteId(siteId);
    const response = await timedFetch(
        netlifyApiUrl('/api/v1/sites/' + encodeURIComponent(cleanSiteId)),
        { method: 'GET', headers: netlifyHeaders(token, false) },
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

async function updateNetlifyCookie(accountId, siteId, token, cookieHeader, controls) {
    const cleanAccountId = validateSiteId(accountId, 'NETLIFY_SITE_INVALID_RESPONSE');
    const cleanSiteId = validateSiteId(siteId);
    const cleanCookie = validateCookieHeader(cookieHeader);
    const pathname = '/api/v1/accounts/' + encodeURIComponent(cleanAccountId)
        + '/env/' + NETLIFY_ENV_KEY
        + '?site_id=' + encodeURIComponent(cleanSiteId);
    const response = await timedFetch(netlifyApiUrl(pathname), {
        method: 'PATCH',
        headers: netlifyHeaders(token, true),
        body: JSON.stringify({ context: 'production', value: cleanCookie })
    }, controls);
    if (!response || !response.ok) {
        await discardResponse(response);
        throw codedError('NETLIFY_ENV_UPDATE_FAILED');
    }
    await discardResponse(response);
}

async function triggerNetlifyBuild(siteId, token, controls) {
    const cleanSiteId = validateSiteId(siteId);
    const response = await timedFetch(
        netlifyApiUrl('/api/v1/sites/' + encodeURIComponent(cleanSiteId) + '/builds'),
        {
            method: 'POST',
            headers: netlifyHeaders(token, false)
        },
        controls
    );
    if (!response || !response.ok) {
        await discardResponse(response);
        throw codedError('NETLIFY_BUILD_TRIGGER_FAILED');
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
        const site = await getNetlifySite(credentials.siteId, credentials.token, options);
        await updateNetlifyCookie(
            site.accountId,
            credentials.siteId,
            credentials.token,
            cleanCookie,
            options
        );
        try {
            await triggerNetlifyBuild(credentials.siteId, credentials.token, options);
        } catch (_) {
            throw codedError('NETLIFY_ENV_UPDATED_BUILD_FAILED');
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
        NETLIFY_ENV_UPDATE_FAILED: 'Netlify មិនអាច update ZTO_COOKIE បាន។ Deploy មិនត្រូវបាន trigger ទេ។',
        NETLIFY_BUILD_TRIGGER_FAILED: 'Netlify មិនអាច trigger deploy បាន។',
        NETLIFY_ENV_UPDATED_BUILD_FAILED: 'ZTO_COOKIE ត្រូវបាន update រួច ប៉ុន្តែ trigger deploy បរាជ័យ។ សូម Trigger deploy ក្នុង Netlify ម្តង។',
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

async function main() {
    if (process.argv.includes('--verify-setup')) {
        console.log('🔎 កំពុងផ្ទៀងផ្ទាត់ Netlify Site ID និង token...');
        await verifyNetlifySetup();
        console.log('✅ Setup រួចរាល់។ ចាប់ពីពេលនេះ double-click sync-zto-cookie.cmd ពេល Cookie ផុត។');
        return;
    }

    console.log('🔎 កំពុងចាប់ Cookie ពី Request Header ពិត — មិនប្រើ DevTools និងមិនប្រើ extension...');
    let cookieHeader = await captureCookieHeader();
    console.log('✅ ចាប់ Cookie បាន។ តម្លៃមិនត្រូវបានបង្ហាញ ឬសរសេរចូលឯកសារទេ។');
    try {
        console.log('🔐 កំពុង update ZTO_COOKIE ជា Netlify secret ហើយ trigger deploy...');
        await syncNetlifyCookie(cookieHeader);
        console.log('\n✅ Cookie ថ្មីចូល Netlify ហើយ deploy ត្រូវបាន trigger រួចរាល់។');
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
    cookieHeaderFromHeaders,
    cookieHeaderFromRequest,
    getNetlifySite,
    isTargetApiUrl,
    loadConfig,
    localStateRoot,
    netlifyApiUrl,
    profileRoot,
    readTokenViaPowerShell,
    safeFailureMessage,
    statePaths,
    syncNetlifyCookie,
    timedFetch,
    triggerNetlifyBuild,
    updateNetlifyCookie,
    validateCookieHeader,
    validateSiteId,
    validateToken,
    verifyNetlifySetup,
    waitForOrderCookie
};
