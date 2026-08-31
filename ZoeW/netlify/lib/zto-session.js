'use strict';

const crypto = require('crypto');

const ARGUS_LOGIN_URL = 'https://argus.ztoglobal.com/';
const ZTO_API_URL = new URL('https://aargus-api.ztoglobal.com/scan/get/order/detail');
const ZTO_USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36';
const ALLOWED_LOGIN_HOSTS = new Set([
    'argus.ztoglobal.com',
    'aargus-api.ztoglobal.com',
    'iam-web.zto.com'
]);
const DEFAULT_COOKIE_NAME = 'BOS-MAN-SESSION';
const STORE_NAME = 'zoew-zto-private-session-v1';
const SESSION_KEY = 'argus-session';
const LOGIN_LOCK_KEY = 'argus-login-lock';
const LOGIN_FAILURE_KEY = 'argus-login-failure';
const SESSION_AAD = Buffer.from('zoew:zto-session:v1');
const LOGIN_LOCK_MS = 50 * 1000;
const LOGIN_WAIT_MS = 35 * 1000;
const COOKIE_EXPIRY_SKEW_MS = 30 * 1000;
const COOKIE_TOKEN_RE = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;
const SAFE_FAILURE_CODES = new Set([
    'ZTO_LOGIN_CHALLENGE',
    'ZTO_LOGIN_REJECTED',
    'ZTO_LOGIN_TIMEOUT',
    'ZTO_LOGIN_UNAVAILABLE',
    'ZTO_LOGIN_NO_SESSION'
]);

let memorySession = null;
let activeRefresh = null;

class ZtoSessionError extends Error {
    constructor(code, statusCode) {
        super(code);
        this.name = 'ZtoSessionError';
        this.code = code;
        this.statusCode = Number(statusCode) || 503;
    }
}

function boolEnv(value) {
    return /^(?:1|true|yes|on)$/i.test(String(value || '').trim());
}

function isAutoLoginEnabled(env) {
    return boolEnv((env || process.env).ZTO_AUTO_LOGIN);
}

function boundedInteger(value, fallback, min, max) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(min, Math.min(max, Math.round(parsed)));
}

function decodeEncryptionKey(raw) {
    const value = String(raw || '').trim();
    let key = null;
    if (/^[0-9a-f]{64}$/i.test(value)) {
        key = Buffer.from(value, 'hex');
    } else {
        const compact = value.replace(/\s+/g, '');
        if (/^[A-Za-z0-9+/]+={0,2}$/.test(compact) && compact.length % 4 === 0) {
            key = Buffer.from(compact, 'base64');
        }
    }
    if (!key || key.length !== 32) {
        throw new ZtoSessionError('ZTO_SESSION_KEY_INVALID', 503);
    }
    return key;
}

function readConfig(env) {
    const source = env || process.env;
    if (!isAutoLoginEnabled(source)) {
        throw new ZtoSessionError('ZTO_AUTO_LOGIN_NOT_ENABLED', 503);
    }

    const username = String(source.ZTO_USERNAME || '');
    const password = String(source.ZTO_PASSWORD || '');
    if (!username || !password || !source.ZTO_SESSION_ENCRYPTION_KEY) {
        throw new ZtoSessionError('ZTO_AUTO_LOGIN_NOT_CONFIGURED', 503);
    }
    if (username.length > 256 || password.length > 1024) {
        throw new ZtoSessionError('ZTO_AUTO_LOGIN_NOT_CONFIGURED', 503);
    }

    const cookieName = String(source.ZTO_SESSION_COOKIE_NAME || DEFAULT_COOKIE_NAME).trim();
    if (!COOKIE_TOKEN_RE.test(cookieName) || cookieName.length > 80) {
        throw new ZtoSessionError('ZTO_AUTO_LOGIN_NOT_CONFIGURED', 503);
    }

    const encryptionKey = decodeEncryptionKey(source.ZTO_SESSION_ENCRYPTION_KEY);
    const identityId = crypto.createHmac('sha256', encryptionKey)
        .update(username)
        .update('\0')
        .update(password)
        .digest('base64url');
    const maxAgeMinutes = boundedInteger(source.ZTO_SESSION_MAX_AGE_MINUTES, 0, 0, 7 * 24 * 60);
    return {
        username,
        password,
        encryptionKey,
        identityId,
        cookieName,
        loginTimeoutMs: boundedInteger(source.ZTO_LOGIN_TIMEOUT_MS, 30000, 15000, 35000),
        maxAgeMs: maxAgeMinutes > 0 ? maxAgeMinutes * 60 * 1000 : 0
    };
}

function base64Url(buffer) {
    return Buffer.from(buffer).toString('base64url');
}

function fromBase64Url(value) {
    if (!/^[A-Za-z0-9_-]+$/.test(String(value || ''))) throw new Error('invalid encoding');
    return Buffer.from(value, 'base64url');
}

function encryptSession(session, key) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    cipher.setAAD(SESSION_AAD);
    const plaintext = Buffer.from(JSON.stringify({
        v: 1,
        cookie: String(session.cookie || ''),
        createdAt: Number(session.createdAt) || Date.now(),
        expiresAt: Number(session.expiresAt) || 0,
        identityId: String(session.identityId || '')
    }));
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    return JSON.stringify({
        v: 1,
        alg: 'A256GCM',
        iv: base64Url(iv),
        tag: base64Url(cipher.getAuthTag()),
        data: base64Url(ciphertext)
    });
}

function decryptSession(raw, key) {
    const envelope = JSON.parse(String(raw || ''));
    if (!envelope || envelope.v !== 1 || envelope.alg !== 'A256GCM') throw new Error('invalid envelope');
    const iv = fromBase64Url(envelope.iv);
    const tag = fromBase64Url(envelope.tag);
    const data = fromBase64Url(envelope.data);
    if (iv.length !== 12 || tag.length !== 16 || data.length === 0 || data.length > 64 * 1024) {
        throw new Error('invalid envelope');
    }
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAAD(SESSION_AAD);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(data), decipher.final()]);
    const session = JSON.parse(plaintext.toString('utf8'));
    if (!session || session.v !== 1 || typeof session.cookie !== 'string'
        || !session.cookie || /[\r\n]/.test(session.cookie) || session.cookie.length > 32 * 1024) {
        throw new Error('invalid session');
    }
    return {
        cookie: session.cookie,
        createdAt: Number(session.createdAt) || 0,
        expiresAt: Number(session.expiresAt) || 0,
        identityId: String(session.identityId || '')
    };
}

function sessionIsFresh(session, config, now) {
    if (!session || !session.cookie || /[\r\n]/.test(session.cookie)) return false;
    if (config.identityId && session.identityId !== config.identityId) return false;
    if (session.expiresAt > 0 && session.expiresAt <= now + COOKIE_EXPIRY_SKEW_MS) return false;
    if (config.maxAgeMs > 0 && (!session.createdAt || session.createdAt + config.maxAgeMs <= now)) return false;
    return true;
}

function domainMatches(hostname, cookieDomain) {
    const domain = String(cookieDomain || hostname).replace(/^\./, '').toLowerCase();
    const host = String(hostname || '').toLowerCase();
    return host === domain || host.endsWith('.' + domain);
}

function pathMatches(pathname, cookiePath) {
    const path = String(cookiePath || '/');
    if (pathname === path) return true;
    if (!pathname.startsWith(path)) return false;
    return path.endsWith('/') || pathname.charAt(path.length) === '/';
}

function cookieHeaderFromBrowser(cookies, requiredName, nowMs) {
    const nowSeconds = nowMs / 1000;
    const matching = (Array.isArray(cookies) ? cookies : []).filter((cookie) => {
        if (!cookie || !COOKIE_TOKEN_RE.test(String(cookie.name || ''))) return false;
        if (typeof cookie.value !== 'string' || /[;\r\n]/.test(cookie.value)) return false;
        if (!domainMatches(ZTO_API_URL.hostname, cookie.domain)) return false;
        if (!pathMatches(ZTO_API_URL.pathname, cookie.path || '/')) return false;
        if (Number(cookie.expires) > 0 && Number(cookie.expires) <= nowSeconds) return false;
        return true;
    }).sort((left, right) => String(right.path || '/').length - String(left.path || '/').length);

    const required = matching.find((cookie) => cookie.name === requiredName);
    if (!required) throw new ZtoSessionError('ZTO_LOGIN_NO_SESSION', 502);

    const header = matching.map((cookie) => cookie.name + '=' + cookie.value).join('; ');
    if (!header || /[\r\n]/.test(header)) throw new ZtoSessionError('ZTO_LOGIN_NO_SESSION', 502);
    return {
        cookie: header,
        expiresAt: Number(required.expires) > 0 ? Math.floor(Number(required.expires) * 1000) : 0
    };
}

function capSessionExpiry(session, config) {
    if (!config.maxAgeMs) return session;
    const cap = session.createdAt + config.maxAgeMs;
    return Object.assign({}, session, {
        expiresAt: session.expiresAt > 0 ? Math.min(session.expiresAt, cap) : cap
    });
}

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout(promise, ms, code) {
    let timer = null;
    return Promise.race([
        promise,
        new Promise((_, reject) => {
            timer = setTimeout(() => reject(new ZtoSessionError(code, 504)), ms);
        })
    ]).finally(() => {
        if (timer) clearTimeout(timer);
    });
}

function assertAllowedLoginUrl(raw) {
    let parsed;
    try { parsed = new URL(String(raw || '')); } catch (_) {
        throw new ZtoSessionError('ZTO_LOGIN_UNAVAILABLE', 502);
    }
    if (parsed.protocol !== 'https:' || !ALLOWED_LOGIN_HOSTS.has(parsed.hostname)) {
        throw new ZtoSessionError('ZTO_LOGIN_UNAVAILABLE', 502);
    }
    return parsed;
}

async function defaultLaunchBrowser() {
    const [puppeteerModule, chromiumModule] = await Promise.all([
        import('puppeteer-core'),
        import('@sparticuz/chromium')
    ]);
    const puppeteer = puppeteerModule.default || puppeteerModule;
    const chromium = chromiumModule.default || chromiumModule;
    chromium.setGraphicsMode = false;
    const headlessType = 'shell';
    return puppeteer.launch({
        args: await puppeteer.defaultArgs({ args: chromium.args, headless: headlessType }),
        defaultViewport: {
            deviceScaleFactor: 1,
            hasTouch: false,
            height: 900,
            isLandscape: true,
            isMobile: false,
            width: 1280
        },
        executablePath: await chromium.executablePath(),
        headless: headlessType
    });
}

async function handleIsVisible(handle) {
    if (!handle) return false;
    try {
        return await handle.evaluate((element) => {
            const style = window.getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            return !element.disabled && style.visibility !== 'hidden' && style.display !== 'none'
                && rect.width > 0 && rect.height > 0;
        });
    } catch (_) {
        return false;
    }
}

async function visibleHandles(page, selector) {
    const handles = await page.$$(selector);
    const visible = [];
    for (const handle of handles) {
        if (await handleIsVisible(handle)) visible.push(handle);
    }
    return visible;
}

async function findUsernameInput(page) {
    const preferred = await visibleHandles(page, 'input[placeholder="Username"]');
    if (preferred.length === 1) return preferred[0];
    const candidates = await visibleHandles(page,
        'input[type="text"], input[type="email"], input[autocomplete="username"]');
    if (candidates.length !== 1) throw new ZtoSessionError('ZTO_LOGIN_UNAVAILABLE', 502);
    return candidates[0];
}

async function findPasswordInput(page) {
    const candidates = await visibleHandles(page, 'input[type="password"]');
    if (candidates.length !== 1) throw new ZtoSessionError('ZTO_LOGIN_UNAVAILABLE', 502);
    return candidates[0];
}

async function findLoginButton(page) {
    const buttons = await visibleHandles(page, 'button');
    const preferred = [];
    for (const button of buttons) {
        let text = '';
        try { text = await button.evaluate((element) => String(element.textContent || '').trim().toLowerCase()); } catch (_) {}
        if (/^(?:login|log in|sign in|登录|登入)$/.test(text)) preferred.push(button);
    }
    if (preferred.length === 1) return preferred[0];
    if (buttons.length === 1) return buttons[0];
    throw new ZtoSessionError('ZTO_LOGIN_UNAVAILABLE', 502);
}

async function inspectLoginState(page) {
    try {
        return await page.evaluate(() => {
            const visible = (element) => {
                if (!element) return false;
                const style = window.getComputedStyle(element);
                const rect = element.getBoundingClientRect();
                return style.visibility !== 'hidden' && style.display !== 'none'
                    && rect.width > 0 && rect.height > 0;
            };
            const text = String(document.body && document.body.innerText || '').slice(0, 20000).toLowerCase();
            const challengeControl = Array.from(document.querySelectorAll(
                'input[autocomplete="one-time-code"], input[name*="captcha" i], input[id*="captcha" i], iframe[src*="captcha" i], [class*="captcha" i], [id*="captcha" i]'
            )).some(visible);
            return {
                challenge: challengeControl
                    || /captcha|verify you are human|security verification|verification code|sms code|one[- ]time code|滑动.{0,12}验证|验证码|安全验证|二次验证/.test(text),
                rejected: /incorrect (?:username|password)|invalid (?:username|password)|login failed|account.{0,24}locked|用户名.{0,12}(?:错误|不存在)|密码.{0,12}错误|账号.{0,12}锁定/.test(text)
            };
        });
    } catch (_) {
        return { challenge: false, rejected: false };
    }
}

async function fillCredential(handle, value, page) {
    await handle.click({ clickCount: 3 });
    await page.keyboard.press('Backspace');
    await handle.type(value, { delay: 0 });
}

async function closeBrowserQuietly(browser, sleep) {
    if (!browser) return;
    try {
        const pages = await browser.pages();
        await Promise.allSettled(pages.map((page) => page.close().catch(() => {})));
    } catch (_) {}
    try {
        await Promise.race([browser.close(), sleep(1500)]);
    } catch (_) {}
}

async function performArgusLogin(config, dependencies) {
    const deps = dependencies || {};
    const now = deps.now || Date.now;
    const sleep = deps.sleep || delay;
    const launchBrowser = deps.launchBrowser || defaultLaunchBrowser;
    const deadline = now() + config.loginTimeoutMs;
    let browser = null;

    const remaining = () => Math.max(1, deadline - now());
    try {
        browser = await withTimeout(Promise.resolve().then(() => launchBrowser()), remaining(), 'ZTO_LOGIN_TIMEOUT');
        const page = await browser.newPage();
        await page.setUserAgent({ userAgent: ZTO_USER_AGENT, platform: 'Linux x86_64' });
        page.setDefaultTimeout(Math.min(15000, remaining()));
        page.setDefaultNavigationTimeout(Math.min(20000, remaining()));

        try {
            await page.goto(ARGUS_LOGIN_URL, {
                waitUntil: 'domcontentloaded',
                timeout: Math.min(20000, remaining())
            });
        } catch (_) {
            assertAllowedLoginUrl(page.url());
        }
        assertAllowedLoginUrl(page.url());
        await page.waitForSelector('input[type="password"]', {
            visible: true,
            timeout: Math.min(12000, remaining())
        });

        const usernameInput = await findUsernameInput(page);
        const passwordInput = await findPasswordInput(page);
        const loginButton = await findLoginButton(page);
        await fillCredential(usernameInput, config.username, page);
        await fillCredential(passwordInput, config.password, page);
        await loginButton.click();

        let lastCookieCheckAt = 0;
        while (remaining() > 0) {
            await sleep(Math.min(300, remaining()));
            assertAllowedLoginUrl(page.url());

            if (now() - lastCookieCheckAt >= 500) {
                lastCookieCheckAt = now();
                const cookies = await page.browserContext().cookies();
                try {
                    const session = cookieHeaderFromBrowser(cookies, config.cookieName, now());
                    return capSessionExpiry({
                        cookie: session.cookie,
                        createdAt: now(),
                        expiresAt: session.expiresAt,
                        identityId: config.identityId
                    }, config);
                } catch (error) {
                    if (!(error instanceof ZtoSessionError) || error.code !== 'ZTO_LOGIN_NO_SESSION') throw error;
                }
            }

            const state = await inspectLoginState(page);
            if (state.challenge) throw new ZtoSessionError('ZTO_LOGIN_CHALLENGE', 409);
            if (state.rejected) throw new ZtoSessionError('ZTO_LOGIN_REJECTED', 401);
        }
        throw new ZtoSessionError('ZTO_LOGIN_TIMEOUT', 504);
    } catch (error) {
        if (error instanceof ZtoSessionError) throw error;
        throw new ZtoSessionError('ZTO_LOGIN_UNAVAILABLE', 502);
    } finally {
        await closeBrowserQuietly(browser, sleep);
    }
}

async function defaultOpenStore() {
    try {
        const blobs = await import('@netlify/blobs');
        if (!blobs || typeof blobs.getStore !== 'function') throw new Error('missing getStore');
        return blobs.getStore({ name: STORE_NAME, consistency: 'strong' });
    } catch (_) {
        throw new ZtoSessionError('ZTO_SESSION_STORE_UNAVAILABLE', 503);
    }
}

async function openStore(deps) {
    try {
        return await (deps.openStore || defaultOpenStore)();
    } catch (error) {
        if (error instanceof ZtoSessionError) throw error;
        throw new ZtoSessionError('ZTO_SESSION_STORE_UNAVAILABLE', 503);
    }
}

async function loadStoredSession(store, config, now) {
    let raw;
    try { raw = await store.get(SESSION_KEY, { type: 'text' }); } catch (_) {
        throw new ZtoSessionError('ZTO_SESSION_STORE_UNAVAILABLE', 503);
    }
    if (!raw) return null;
    try {
        const session = decryptSession(raw, config.encryptionKey);
        return sessionIsFresh(session, config, now) ? session : null;
    } catch (_) {
        return null;
    }
}

async function saveStoredSession(store, config, session) {
    try {
        await store.set(SESSION_KEY, encryptSession(session, config.encryptionKey), {
            metadata: {
                createdAt: session.createdAt,
                expiresAt: session.expiresAt || 0,
                encrypted: true
            }
        });
    } catch (_) {
        throw new ZtoSessionError('ZTO_SESSION_STORE_UNAVAILABLE', 503);
    }
}

async function loadFailure(store, config, now) {
    try {
        const raw = await store.get(LOGIN_FAILURE_KEY, { type: 'text' });
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || parsed.identityId !== config.identityId
            || !SAFE_FAILURE_CODES.has(parsed.code) || Number(parsed.retryAfter) <= now) return null;
        return parsed;
    } catch (_) {
        return null;
    }
}

function backoffMs(code) {
    if (code === 'ZTO_LOGIN_REJECTED') return 10 * 60 * 1000;
    if (code === 'ZTO_LOGIN_CHALLENGE') return 5 * 60 * 1000;
    return 45 * 1000;
}

async function saveFailure(store, config, error, now) {
    if (!error || !SAFE_FAILURE_CODES.has(error.code)) return;
    try {
        await store.set(LOGIN_FAILURE_KEY, JSON.stringify({
            v: 1,
            code: error.code,
            statusCode: error.statusCode,
            retryAfter: now + backoffMs(error.code),
            identityId: config.identityId
        }));
    } catch (_) {}
}

async function clearFailure(store) {
    try { await store.delete(LOGIN_FAILURE_KEY); } catch (_) {}
}

async function acquireLoginLock(store, nonce, now) {
    try {
        const current = await store.getWithMetadata(LOGIN_LOCK_KEY, { type: 'text' });
        if (current && Number(current.metadata && current.metadata.expiresAt) > now) return false;
        const conditions = current && current.etag
            ? { onlyIfMatch: current.etag }
            : { onlyIfNew: true };
        const result = await store.set(LOGIN_LOCK_KEY, nonce, Object.assign({
            metadata: { expiresAt: now + LOGIN_LOCK_MS }
        }, conditions));
        return !!(result && result.modified);
    } catch (_) {
        throw new ZtoSessionError('ZTO_SESSION_STORE_UNAVAILABLE', 503);
    }
}

async function releaseLoginLock(store, nonce) {
    try {
        const current = await store.getWithMetadata(LOGIN_LOCK_KEY, { type: 'text' });
        if (current && current.data === nonce && current.etag) {
            await store.set(LOGIN_LOCK_KEY, 'released', {
                metadata: { expiresAt: 0 },
                onlyIfMatch: current.etag
            });
        }
    } catch (_) {}
}

async function waitForPeerRefresh(store, config, rejectedCookie, deps) {
    const now = deps.now || Date.now;
    const sleep = deps.sleep || delay;
    const deadline = now() + Math.min(LOGIN_WAIT_MS, config.loginTimeoutMs + 5000);
    while (now() < deadline) {
        await sleep(Math.min(400, Math.max(1, deadline - now())));
        const session = await loadStoredSession(store, config, now());
        if (session && (!rejectedCookie || session.cookie !== rejectedCookie)) return session;
        const failure = await loadFailure(store, config, now());
        if (failure) throw new ZtoSessionError(failure.code, failure.statusCode);
        let lock = null;
        try { lock = await store.getWithMetadata(LOGIN_LOCK_KEY, { type: 'text' }); } catch (_) {}
        if (!lock || Number(lock.metadata && lock.metadata.expiresAt) <= now()) break;
    }
    throw new ZtoSessionError('ZTO_LOGIN_BUSY', 503);
}

async function refreshSession(config, options, deps) {
    const now = deps.now || Date.now;
    const store = await openStore(deps);
    let rejectedCookie = String(options.rejectedCookie || '');

    const existing = await loadStoredSession(store, config, now());
    if (options.forceRefresh && !rejectedCookie && existing) rejectedCookie = existing.cookie;
    if (existing && (!options.forceRefresh || existing.cookie !== rejectedCookie)) {
        memorySession = existing;
        return existing;
    }

    const failure = await loadFailure(store, config, now());
    if (failure) throw new ZtoSessionError(failure.code, failure.statusCode);

    const nonce = crypto.randomUUID();
    const ownsLock = await acquireLoginLock(store, nonce, now());
    if (!ownsLock) return waitForPeerRefresh(store, config, rejectedCookie, deps);

    try {
        const afterLock = await loadStoredSession(store, config, now());
        if (afterLock && (!options.forceRefresh || afterLock.cookie !== rejectedCookie)) {
            memorySession = afterLock;
            return afterLock;
        }

        const login = deps.login || performArgusLogin;
        let session;
        try {
            session = await login(config, deps);
        } catch (error) {
            const safeError = error instanceof ZtoSessionError
                ? error
                : new ZtoSessionError('ZTO_LOGIN_UNAVAILABLE', 502);
            await saveFailure(store, config, safeError, now());
            throw safeError;
        }
        if (!sessionIsFresh(session, config, now())) {
            const error = new ZtoSessionError('ZTO_LOGIN_NO_SESSION', 502);
            await saveFailure(store, config, error, now());
            throw error;
        }
        await saveStoredSession(store, config, session);
        await clearFailure(store);
        memorySession = session;
        return session;
    } finally {
        await releaseLoginLock(store, nonce);
    }
}

async function getAutoSessionCookie(options) {
    const opts = options || {};
    const env = opts.env || process.env;
    const deps = opts.dependencies || {};
    const now = deps.now || Date.now;
    const config = readConfig(env);

    if (!opts.forceRefresh && sessionIsFresh(memorySession, config, now())) {
        return memorySession.cookie;
    }
    if (opts.forceRefresh) memorySession = null;

    if (activeRefresh) {
        const inFlightSession = await activeRefresh;
        if (!opts.forceRefresh || !opts.rejectedCookie || inFlightSession.cookie !== opts.rejectedCookie) {
            return inFlightSession.cookie;
        }
    }

    if (!activeRefresh) {
        activeRefresh = refreshSession(config, opts, deps).finally(() => {
            activeRefresh = null;
        });
    }
    const session = await activeRefresh;
    return session.cookie;
}

function resetStateForTests() {
    memorySession = null;
    activeRefresh = null;
}

module.exports = {
    ZTO_USER_AGENT,
    ZtoSessionError,
    isAutoLoginEnabled,
    getAutoSessionCookie,
    _test: {
        cookieHeaderFromBrowser,
        decodeEncryptionKey,
        decryptSession,
        encryptSession,
        performArgusLogin,
        readConfig,
        resetStateForTests,
        sessionIsFresh
    }
};
