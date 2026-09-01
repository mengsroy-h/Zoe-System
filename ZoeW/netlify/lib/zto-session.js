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
const LOGIN_FORM_WAIT_DEFAULT_MS = 12 * 1000;
const PROXY_URL_RE = /^(?:https?|socks4|socks5):\/\/[A-Za-z0-9.-]{1,253}(?::\d{1,5})?$/;
const LOGIN_POLL_RESERVE_MS = 8 * 1000;
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
const STORE_STAGE_RE = /^[a-z]{3,16}$/;
const STORE_REASON_RE = /^[A-Za-z0-9_.-]{1,64}$/;
const LOG_PREFIX = '[zto-session] ';

let memorySession = null;
let memoryFailure = null;
let activeRefresh = null;

class ZtoSessionError extends Error {
    constructor(code, statusCode, reason) {
        super(code);
        this.name = 'ZtoSessionError';
        this.code = code;
        this.statusCode = Number(statusCode) || 503;
        if (reason) this.reason = String(reason);
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
        formWaitMs: boundedInteger(source.ZTO_LOGIN_FORM_WAIT_MS, LOGIN_FORM_WAIT_DEFAULT_MS, 5000, 20000),
        proxyServer: readProxyServer(source.ZTO_LOGIN_PROXY),
        proxyUsername: String(source.ZTO_LOGIN_PROXY_USERNAME || ''),
        proxyPassword: String(source.ZTO_LOGIN_PROXY_PASSWORD || ''),
        maxAgeMs: maxAgeMinutes > 0 ? maxAgeMinutes * 60 * 1000 : 0
    };
}

function readProxyServer(raw) {
    const value = String(raw || '').trim().replace(/\/+$/, '');
    if (!value) return '';
    if (!PROXY_URL_RE.test(value)) throw new ZtoSessionError('ZTO_AUTO_LOGIN_NOT_CONFIGURED', 503, 'proxy:invalid');
    return value;
}

function proxyHostLabel(proxyServer) {
    try { return safeHostLabel(new URL(proxyServer).hostname); } catch (_) { return 'unknown'; }
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

function requiredCookieValue(cookies, requiredName) {
    const found = (Array.isArray(cookies) ? cookies : []).find((cookie) => cookie && cookie.name === requiredName);
    return found ? String(found.value || '') : '';
}

function loginIsConfirmed(cookies, requiredName, priorValue, urlAtSubmit, urlNow) {
    if (String(urlNow || '') !== String(urlAtSubmit || '')) return true;
    const current = requiredCookieValue(cookies, requiredName);
    return !!current && current !== String(priorValue || '');
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

function hostSuffix(host) {
    return host && host !== 'unknown' ? '@' + host : '';
}

async function loginFrameSummary(page) {
    const parts = [];
    for (const frame of loginFrames(page)) {
        let inputs = -1;
        let passwords = -1;
        try {
            inputs = (await frame.$$('input')).length;
            passwords = (await frame.$$('input[type="password"]')).length;
        } catch (_) {}
        let host = '';
        try { host = safeHostLabel(new URL(frame.url()).hostname); } catch (_) {}
        parts.push((host || '?') + ':' + inputs + '/' + passwords);
        if (parts.length >= 6) break;
    }
    return parts.join(' ');
}

function logLoginProblem(deps, step, host, elapsedMs, view, frameView, error, proxyHost) {
    const log = (deps && deps.logger) || console.warn;
    if (typeof log !== 'function') return;
    const shape = loginViewIsUsable(view)
        ? ' inputs=' + view.inputs + ' password=' + view.passwords + ' buttons=' + view.buttons
            + ' frames=' + view.frames + ' text=' + view.chars + ' ready=' + view.ready
            + ' params=[' + String(view.params || '') + ']'
        : ' (ទំព័រអានមិនបាន)';
    const frames = frameView ? ' frames=[' + frameView + ']' : '';
    const proxy = proxyHost ? ' proxy=' + proxyHost : '';
    try {
        log(LOG_PREFIX + 'ZTO login failed at ' + step + (host ? ' on ' + host : '')
            + ' after ' + Math.round(elapsedMs) + 'ms: ' + safeReasonText(error) + shape + frames + proxy);
    } catch (_) {}
}

function safeHostLabel(hostname) {
    const host = String(hostname || '').toLowerCase();
    return /^[a-z0-9.-]{1,60}$/.test(host) ? host : 'unknown';
}

function assertAllowedLoginUrl(raw) {
    let parsed;
    try { parsed = new URL(String(raw || '')); } catch (_) {
        throw new ZtoSessionError('ZTO_LOGIN_UNAVAILABLE', 502, 'url:unparsable');
    }
    if (parsed.protocol !== 'https:') {
        throw new ZtoSessionError('ZTO_LOGIN_UNAVAILABLE', 502, 'scheme:' + parsed.protocol.replace(':', ''));
    }
    if (!ALLOWED_LOGIN_HOSTS.has(parsed.hostname)) {
        throw new ZtoSessionError('ZTO_LOGIN_UNAVAILABLE', 502, 'host:' + safeHostLabel(parsed.hostname));
    }
    return parsed;
}

function launchArgsWithProxy(baseArgs, proxyServer) {
    const args = Array.isArray(baseArgs) ? baseArgs.slice() : [];
    if (!proxyServer) return args;
    const filtered = args.filter((arg) => !/^--proxy-server=/.test(String(arg)));
    filtered.push('--proxy-server=' + proxyServer);
    return filtered;
}

async function defaultLaunchBrowser(config) {
    const [puppeteerModule, chromiumModule] = await Promise.all([
        import('puppeteer-core'),
        import('@sparticuz/chromium')
    ]);
    const puppeteer = puppeteerModule.default || puppeteerModule;
    const chromium = chromiumModule.default || chromiumModule;
    chromium.setGraphicsMode = false;
    const headlessType = 'shell';
    return puppeteer.launch({
        args: launchArgsWithProxy(
            await puppeteer.defaultArgs({ args: chromium.args, headless: headlessType }),
            config && config.proxyServer
        ),
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

function loginFrames(page) {
    try {
        const frames = typeof page.frames === 'function' ? page.frames() : null;
        if (Array.isArray(frames) && frames.length) return frames;
    } catch (_) {}
    return [page];
}

async function frameHasLoginForm(frame) {
    try {
        return (await visibleHandles(frame, 'input[type="password"]')).length > 0;
    } catch (_) {
        return false;
    }
}

async function waitForLoginFrame(page, deps, deadlineAt) {
    const now = deps.now || Date.now;
    const sleep = deps.sleep || delay;
    for (;;) {
        for (const frame of loginFrames(page)) {
            if (await frameHasLoginForm(frame)) return frame;
        }
        if (now() >= deadlineAt) {
            const error = new Error('login form not found');
            error.name = 'TimeoutError';
            throw error;
        }
        await sleep(Math.min(250, Math.max(1, deadlineAt - now())));
    }
}

async function findUsernameInput(page) {
    const preferred = await visibleHandles(page, 'input[placeholder="Username"]');
    if (preferred.length === 1) return preferred[0];
    const candidates = await visibleHandles(page,
        'input[type="text"], input[type="email"], input[autocomplete="username"]');
    if (candidates.length !== 1) {
        throw new ZtoSessionError('ZTO_LOGIN_UNAVAILABLE', 502, 'form:username-' + candidates.length);
    }
    return candidates[0];
}

async function findPasswordInput(page) {
    const candidates = await visibleHandles(page, 'input[type="password"]');
    if (candidates.length !== 1) {
        throw new ZtoSessionError('ZTO_LOGIN_UNAVAILABLE', 502, 'form:password-' + candidates.length);
    }
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
    throw new ZtoSessionError('ZTO_LOGIN_UNAVAILABLE', 502, 'form:button-' + buttons.length);
}

async function inspectLoginState(page) {
    const merged = { challenge: false, rejected: false };
    for (const frame of loginFrames(page)) {
        const state = await inspectFrameLoginState(frame);
        if (state.challenge) merged.challenge = true;
        if (state.rejected) merged.rejected = true;
    }
    return merged;
}

async function inspectFrameLoginState(page) {
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

async function loginDiagnostics(page) {
    try {
        return await page.evaluate(() => ({
            title: String(document.title || '').slice(0, 80),
            ready: String(document.readyState || ''),
            inputs: document.querySelectorAll('input').length,
            passwords: document.querySelectorAll('input[type="password"]').length,
            buttons: document.querySelectorAll('button').length,
            frames: window.frames.length,
            chars: String(document.body && document.body.innerText || '').trim().length,
            params: Array.from(new URLSearchParams(location.search).keys()).sort().slice(0, 12).join(',')
        }));
    } catch (_) {
        return null;
    }
}

function loginViewIsUsable(view) {
    return !!view && typeof view.inputs === 'number' && typeof view.passwords === 'number';
}

async function performArgusLogin(config, dependencies) {
    const deps = dependencies || {};
    const now = deps.now || Date.now;
    const sleep = deps.sleep || delay;
    const launchBrowser = deps.launchBrowser || defaultLaunchBrowser;
    const deadline = now() + config.loginTimeoutMs;
    const started = now();
    let browser = null;
    let page = null;
    let step = 'launch';
    let navigated = true;

    const remainingRaw = () => deadline - now();
    const remaining = () => Math.max(1, remainingRaw());
    const hostNow = () => {
        try { return safeHostLabel(new URL(page.url()).hostname); } catch (_) { return ''; }
    };
    try {
        browser = await withTimeout(Promise.resolve().then(() => launchBrowser(config)), remaining(), 'ZTO_LOGIN_TIMEOUT');
        step = 'newpage';
        page = await browser.newPage();
        if (config.proxyServer && config.proxyUsername && typeof page.authenticate === 'function') {
            await page.authenticate({ username: config.proxyUsername, password: config.proxyPassword });
        }
        await page.setUserAgent({ userAgent: ZTO_USER_AGENT, platform: 'Linux x86_64' });
        page.setDefaultTimeout(Math.min(15000, remaining()));
        page.setDefaultNavigationTimeout(Math.min(20000, remaining()));

        step = 'goto';
        try {
            await page.goto(ARGUS_LOGIN_URL, {
                waitUntil: 'domcontentloaded',
                timeout: Math.min(20000, remaining())
            });
        } catch (_) {
            navigated = false;
            assertAllowedLoginUrl(page.url());
        }
        assertAllowedLoginUrl(page.url());
        step = navigated ? 'wait-password' : 'wait-password-nonav';
        const formWaitMs = Math.max(1, Math.min(config.formWaitMs, remaining() - LOGIN_POLL_RESERVE_MS, remaining()));
        const formFrame = await waitForLoginFrame(page, deps, now() + formWaitMs);

        step = 'find-form';
        const usernameInput = await findUsernameInput(formFrame);
        const passwordInput = await findPasswordInput(formFrame);
        const loginButton = await findLoginButton(formFrame);
        step = 'fill';
        await fillCredential(usernameInput, config.username, page);
        await fillCredential(passwordInput, config.password, page);
        step = 'submit';
        const priorCookie = requiredCookieValue(await page.browserContext().cookies(), config.cookieName);
        const urlAtSubmit = page.url();
        await loginButton.click();

        step = 'poll';
        let lastCookieCheckAt = 0;
        let sawCookieOnly = false;
        while (remainingRaw() > 0) {
            await sleep(Math.min(300, remaining()));
            assertAllowedLoginUrl(page.url());

            if (now() - lastCookieCheckAt >= 500) {
                lastCookieCheckAt = now();
                const cookies = await page.browserContext().cookies();
                try {
                    const session = cookieHeaderFromBrowser(cookies, config.cookieName, now());
                    if (loginIsConfirmed(cookies, config.cookieName, priorCookie, urlAtSubmit, page.url())) {
                        return capSessionExpiry({
                            cookie: session.cookie,
                            createdAt: now(),
                            expiresAt: session.expiresAt,
                            identityId: config.identityId
                        }, config);
                    }
                    sawCookieOnly = true;
                    step = 'poll-unconfirmed';
                } catch (error) {
                    if (!(error instanceof ZtoSessionError) || error.code !== 'ZTO_LOGIN_NO_SESSION') throw error;
                }
            }

            const state = await inspectLoginState(page);
            if (state.challenge) throw new ZtoSessionError('ZTO_LOGIN_CHALLENGE', 409);
            if (state.rejected) throw new ZtoSessionError('ZTO_LOGIN_REJECTED', 401);
        }
        if (sawCookieOnly) {
            throw new ZtoSessionError('ZTO_LOGIN_NO_SESSION', 502, 'login:cookie-unconfirmed' + hostSuffix(hostNow()));
        }
        throw new ZtoSessionError('ZTO_LOGIN_TIMEOUT', 504, 'login:' + step + hostSuffix(hostNow()));
    } catch (error) {
        const host = page ? hostNow() : '';
        if (page) {
            const view = await loginDiagnostics(page);
            const frameView = await loginFrameSummary(page);
            logLoginProblem(deps, step, host, now() - started, view, frameView, error,
                config.proxyServer ? proxyHostLabel(config.proxyServer) : '');
        }
        if (error instanceof ZtoSessionError) throw error;
        throw new ZtoSessionError('ZTO_LOGIN_UNAVAILABLE', 502,
            'login:' + step + hostSuffix(host) + ':' + safeReasonText(error));
    } finally {
        await closeBrowserQuietly(browser, sleep);
    }
}

function safeReasonText(error) {
    if (!error) return 'UnknownError';
    const code = String(error.code || '').trim();
    if (/^[A-Z][A-Z0-9_]{2,63}$/.test(code)) return code;
    const name = String(error.name || '').trim();
    return STORE_REASON_RE.test(name) ? name : 'UnknownError';
}

function logStoreProblem(deps, stage, error) {
    const log = (deps && deps.logger) || console.warn;
    if (typeof log !== 'function') return;
    const detail = String((error && error.message) || '')
        .replace(/[\u0000-\u001f\u007f]+/g, ' ')
        .replace(/\?[^\s]*/g, '?[redacted]')
        .replace(/[A-Za-z0-9_-]{24,}/g, '[redacted]')
        .trim()
        .slice(0, 200);
    try {
        log(LOG_PREFIX + 'Netlify Blobs ' + stage + ' failed: ' + safeReasonText(error) + (detail ? ' — ' + detail : ''));
    } catch (_) {}
}

function storeUnavailable(deps, stage, error) {
    if (error instanceof ZtoSessionError) return error;
    logStoreProblem(deps, stage, error);
    const label = STORE_STAGE_RE.test(stage) ? stage : 'store';
    return new ZtoSessionError('ZTO_SESSION_STORE_UNAVAILABLE', 503, label + ':' + safeReasonText(error));
}

function connectLambdaBlobs(blobs, lambdaEvent) {
    if (!blobs || typeof blobs.connectLambda !== 'function') return false;
    if (!lambdaEvent || typeof lambdaEvent !== 'object') return false;
    if (typeof lambdaEvent.blobs !== 'string' || !lambdaEvent.blobs) return false;
    if (!lambdaEvent.headers || typeof lambdaEvent.headers !== 'object') return false;
    try {
        blobs.connectLambda(lambdaEvent);
        return true;
    } catch (_) {
        return false;
    }
}

async function defaultOpenStore(context) {
    const ctx = context || {};
    const importBlobs = ctx.importBlobs || (() => import('@netlify/blobs'));
    let blobs;
    try {
        blobs = await importBlobs();
    } catch (error) {
        throw storeUnavailable(ctx, 'import', error);
    }
    if (!blobs || typeof blobs.getStore !== 'function') {
        throw storeUnavailable(ctx, 'export', new Error('missing getStore'));
    }
    connectLambdaBlobs(blobs, ctx.lambdaEvent);
    try {
        return blobs.getStore({ name: STORE_NAME, consistency: 'strong' });
    } catch (error) {
        throw storeUnavailable(ctx, 'getstore', error);
    }
}

async function openStore(deps, context) {
    const ctx = Object.assign({}, context, {
        importBlobs: deps.importBlobs || (context && context.importBlobs),
        logger: deps.logger
    });
    try {
        return await (deps.openStore || defaultOpenStore)(ctx);
    } catch (error) {
        throw storeUnavailable(deps, 'open', error);
    }
}

async function loadStoredSession(store, config, now, deps) {
    let raw;
    try { raw = await store.get(SESSION_KEY, { type: 'text' }); } catch (error) {
        throw storeUnavailable(deps, 'read', error);
    }
    if (!raw) return null;
    try {
        const session = decryptSession(raw, config.encryptionKey);
        return sessionIsFresh(session, config, now) ? session : null;
    } catch (_) {
        return null;
    }
}

async function saveStoredSession(store, config, session, deps) {
    try {
        await store.set(SESSION_KEY, encryptSession(session, config.encryptionKey), {
            metadata: {
                createdAt: session.createdAt,
                expiresAt: session.expiresAt || 0,
                encrypted: true
            }
        });
        return true;
    } catch (error) {
        logStoreProblem(deps, 'write', error);
        return false;
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

async function acquireLoginLock(store, nonce, now, deps) {
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
    } catch (error) {
        throw storeUnavailable(deps, 'lock', error);
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
        const session = await loadStoredSession(store, config, now(), deps);
        if (session && (!rejectedCookie || session.cookie !== rejectedCookie)) return session;
        const failure = await loadFailure(store, config, now());
        if (failure) throw new ZtoSessionError(failure.code, failure.statusCode);
        let lock = null;
        try { lock = await store.getWithMetadata(LOGIN_LOCK_KEY, { type: 'text' }); } catch (_) {}
        if (!lock || Number(lock.metadata && lock.metadata.expiresAt) <= now()) break;
    }
    throw new ZtoSessionError('ZTO_LOGIN_BUSY', 503);
}

function noteMemoryFailure(config, error, now) {
    if (!error || !SAFE_FAILURE_CODES.has(error.code)) {
        memoryFailure = null;
        return;
    }
    memoryFailure = {
        code: error.code,
        statusCode: error.statusCode,
        reason: error.reason || '',
        retryAfter: now + backoffMs(error.code),
        identityId: config.identityId
    };
}

function readMemoryFailure(config, now) {
    if (!memoryFailure || memoryFailure.identityId !== config.identityId) return null;
    if (!(memoryFailure.retryAfter > now)) return null;
    return memoryFailure;
}

async function refreshWithStore(store, config, options, deps) {
    const now = deps.now || Date.now;
    let rejectedCookie = String(options.rejectedCookie || '');

    const existing = await loadStoredSession(store, config, now(), deps);
    if (options.forceRefresh && !rejectedCookie && existing) rejectedCookie = existing.cookie;
    if (existing && (!options.forceRefresh || existing.cookie !== rejectedCookie)) {
        memorySession = existing;
        return existing;
    }

    const failure = await loadFailure(store, config, now());
    if (failure) throw new ZtoSessionError(failure.code, failure.statusCode);

    const nonce = crypto.randomUUID();
    const ownsLock = await acquireLoginLock(store, nonce, now(), deps);
    if (!ownsLock) return waitForPeerRefresh(store, config, rejectedCookie, deps);

    try {
        const afterLock = await loadStoredSession(store, config, now(), deps);
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
        await saveStoredSession(store, config, session, deps);
        await clearFailure(store);
        memoryFailure = null;
        memorySession = session;
        return session;
    } finally {
        await releaseLoginLock(store, nonce);
    }
}

async function refreshWithoutStore(config, options, deps, storeError) {
    const now = deps.now || Date.now;
    const log = deps.logger || console.warn;
    if (typeof log === 'function') {
        try {
            log(LOG_PREFIX + 'session store unavailable ('
                + ((storeError && storeError.reason) || 'unknown')
                + ') — serving this container from memory only');
        } catch (_) {}
    }

    const rejectedCookie = String(options.rejectedCookie || '');
    if (memorySession && sessionIsFresh(memorySession, config, now())
        && (!options.forceRefresh || memorySession.cookie !== rejectedCookie)) {
        return memorySession;
    }

    const failure = readMemoryFailure(config, now());
    if (failure) throw new ZtoSessionError(failure.code, failure.statusCode, failure.reason);

    const login = deps.login || performArgusLogin;
    let session;
    try {
        session = await login(config, deps);
    } catch (error) {
        const safeError = error instanceof ZtoSessionError
            ? error
            : new ZtoSessionError('ZTO_LOGIN_UNAVAILABLE', 502);
        noteMemoryFailure(config, safeError, now());
        throw safeError;
    }
    if (!sessionIsFresh(session, config, now())) {
        const error = new ZtoSessionError('ZTO_LOGIN_NO_SESSION', 502);
        noteMemoryFailure(config, error, now());
        throw error;
    }
    memoryFailure = null;
    memorySession = session;
    return session;
}

async function refreshSession(config, options, deps) {
    let store = null;
    try {
        store = await openStore(deps, { lambdaEvent: options.lambdaEvent });
    } catch (error) {
        return refreshWithoutStore(config, options, deps, storeUnavailable(deps, 'open', error));
    }
    try {
        return await refreshWithStore(store, config, options, deps);
    } catch (error) {
        if (error instanceof ZtoSessionError && error.code === 'ZTO_SESSION_STORE_UNAVAILABLE') {
            return refreshWithoutStore(config, options, deps, error);
        }
        throw error;
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
    memoryFailure = null;
    activeRefresh = null;
}

module.exports = {
    ZTO_USER_AGENT,
    ZtoSessionError,
    isAutoLoginEnabled,
    getAutoSessionCookie,
    _test: {
        connectLambdaBlobs,
        launchArgsWithProxy,
        proxyHostLabel,
        readProxyServer,
        loginIsConfirmed,
        cookieHeaderFromBrowser,
        defaultOpenStore,
        decodeEncryptionKey,
        decryptSession,
        encryptSession,
        performArgusLogin,
        readConfig,
        resetStateForTests,
        sessionIsFresh
    }
};
