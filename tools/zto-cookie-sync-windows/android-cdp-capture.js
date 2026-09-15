'use strict';

const { spawn } = require('child_process');

const CDP_PORT = 9222;
const CDP_ORIGIN = `http://127.0.0.1:${CDP_PORT}`;
const TARGET_POLL_MS = 900;
const ARGUS_OPEN_DELAY_MS = 7000;
const CDP_COMMAND_TIMEOUT_MS = 10000;
const ADB_COMMAND_TIMEOUT_MS = 20000;

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function codedErrorFallback(code) {
    const error = new Error(code);
    error.code = code;
    return error;
}

function adbPrefix() {
    const serial = String(process.env.ANDROID_SERIAL || '').trim();
    return serial ? ['-s', serial] : [];
}

function runAdb(args, options) {
    const config = options || {};
    const timeoutMs = Number.isFinite(config.timeoutMs) ? config.timeoutMs : ADB_COMMAND_TIMEOUT_MS;
    return new Promise((resolve, reject) => {
        const child = spawn('adb', adbPrefix().concat(args), {
            stdio: ['ignore', 'pipe', 'pipe'],
            windowsHide: true
        });
        let stdout = '';
        let stderr = '';
        let settled = false;
        const finish = (error, value) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            if (error) reject(error);
            else resolve(value);
        };
        const timer = setTimeout(() => {
            try { child.kill(); } catch (_) {}
            const error = new Error('ADB_TIMEOUT');
            error.code = 'ADB_TIMEOUT';
            finish(error);
        }, timeoutMs);
        child.stdout.on('data', (chunk) => { if (stdout.length < 65536) stdout += String(chunk); });
        child.stderr.on('data', (chunk) => { if (stderr.length < 65536) stderr += String(chunk); });
        child.on('error', finish);
        child.on('close', (code) => {
            if (code === 0) return finish(null, { stdout: stdout.trim(), stderr: stderr.trim() });
            const error = new Error((stderr || stdout || `adb exited with ${code}`).trim());
            error.code = 'ADB_FAILED';
            error.exitCode = code;
            finish(error);
        });
    });
}

async function fetchJson(pathname, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs || 5000);
    try {
        const response = await fetch(CDP_ORIGIN + pathname, {
            signal: controller.signal,
            cache: 'no-store'
        });
        if (!response.ok) throw new Error('HTTP_' + response.status);
        return await response.json();
    } finally {
        clearTimeout(timer);
    }
}

function normalizeWsUrl(raw) {
    const url = new URL(String(raw || ''));
    if (url.protocol !== 'ws:' && url.protocol !== 'wss:') throw new Error('BAD_WS_URL');
    // The DevTools JSON endpoint sometimes advertises localhost. Pin it to the
    // loopback endpoint created by `adb forward` so no remote host is contacted.
    url.hostname = '127.0.0.1';
    url.port = String(CDP_PORT);
    return url.toString();
}

class CdpSocket {
    constructor(url, onEvent) {
        this.url = normalizeWsUrl(url);
        this.onEvent = typeof onEvent === 'function' ? onEvent : () => {};
        this.ws = null;
        this.nextId = 1;
        this.pending = new Map();
        this.closed = false;
    }

    async connect() {
        if (typeof WebSocket !== 'function') throw new Error('WEBSOCKET_UNAVAILABLE');
        await new Promise((resolve, reject) => {
            const ws = new WebSocket(this.url);
            this.ws = ws;
            const timer = setTimeout(() => reject(new Error('CDP_CONNECT_TIMEOUT')), 8000);
            const cleanup = () => clearTimeout(timer);
            ws.addEventListener('open', () => { cleanup(); resolve(); }, { once: true });
            ws.addEventListener('error', () => { cleanup(); reject(new Error('CDP_CONNECT_FAILED')); }, { once: true });
            ws.addEventListener('message', (event) => this._handleMessage(event));
            ws.addEventListener('close', () => this._handleClose());
        });
    }

    async _handleMessage(event) {
        let raw = event.data;
        try {
            if (typeof raw !== 'string') {
                if (raw && typeof raw.text === 'function') raw = await raw.text();
                else if (Buffer.isBuffer(raw)) raw = raw.toString('utf8');
                else raw = String(raw);
            }
            const message = JSON.parse(raw);
            if (message.id) {
                const pending = this.pending.get(message.id);
                if (!pending) return;
                this.pending.delete(message.id);
                clearTimeout(pending.timer);
                if (message.error) pending.reject(new Error(message.error.message || 'CDP_COMMAND_FAILED'));
                else pending.resolve(message.result || {});
                return;
            }
            if (message.method) {
                Promise.resolve(this.onEvent(message.method, message.params || {}, this)).catch(() => {});
            }
        } catch (_) {}
    }

    _handleClose() {
        this.closed = true;
        for (const pending of this.pending.values()) {
            clearTimeout(pending.timer);
            pending.reject(new Error('CDP_CLOSED'));
        }
        this.pending.clear();
    }

    command(method, params, timeoutMs) {
        if (!this.ws || this.closed || this.ws.readyState !== WebSocket.OPEN) {
            return Promise.reject(new Error('CDP_NOT_OPEN'));
        }
        const id = this.nextId++;
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pending.delete(id);
                reject(new Error('CDP_COMMAND_TIMEOUT'));
            }, timeoutMs || CDP_COMMAND_TIMEOUT_MS);
            this.pending.set(id, { resolve, reject, timer });
            try {
                this.ws.send(JSON.stringify({ id, method, params: params || {} }));
            } catch (error) {
                clearTimeout(timer);
                this.pending.delete(id);
                reject(error);
            }
        });
    }

    close() {
        this.closed = true;
        try { if (this.ws) this.ws.close(); } catch (_) {}
    }
}

function headerValue(headers, name) {
    if (!headers || typeof headers !== 'object') return '';
    const wanted = String(name || '').toLowerCase();
    for (const [key, value] of Object.entries(headers)) {
        if (String(key).toLowerCase() === wanted) return String(value ?? '');
    }
    return '';
}

function setCookieLines(headers) {
    const raw = headerValue(headers, 'set-cookie');
    if (!raw) return [];
    return raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function isJsonMime(headers) {
    const type = headerValue(headers, 'content-type');
    return /^application\/(?:[\w.+-]+\+)?json\b/i.test(type);
}

function validContentLength(headers, limit) {
    const raw = headerValue(headers, 'content-length');
    if (!raw) return true;
    const value = Number(raw);
    return !Number.isFinite(value) || value <= limit;
}

async function listPageTargets() {
    const targets = await fetchJson('/json', 5000);
    if (!Array.isArray(targets)) return [];
    return targets.filter((target) => target && target.type === 'page' && target.webSocketDebuggerUrl);
}

async function waitForChromeCdp(timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    let lastError = null;
    while (Date.now() < deadline) {
        try {
            const version = await fetchJson('/json/version', 2500);
            if (version && version.webSocketDebuggerUrl) return version;
        } catch (error) {
            lastError = error;
        }
        await sleep(500);
    }
    throw lastError || new Error('CDP_UNAVAILABLE');
}

// `adb shell` hands the arguments to a shell ON THE DEVICE, so a URL carrying
// a shell metacharacter would be re-parsed there: `#` in particular starts a
// comment, which would silently swallow the `-p com.android.chrome` that pins
// the intent to Chrome. Today both URLs are plain constants, so this only has
// to stay that way - assert it instead of trusting the next edit.
function safeIntentUrl(raw) {
    const url = String(raw || '');
    let parsed;
    try { parsed = new URL(url); } catch (_) { throw codedErrorFallback('ANDROID_CHROME_OPEN_FAILED'); }
    if (parsed.protocol !== 'https:') throw codedErrorFallback('ANDROID_CHROME_OPEN_FAILED');
    if (/[\s"'`\\$&|;<>()*?#\[\]{}~!]/.test(url)) throw codedErrorFallback('ANDROID_CHROME_OPEN_FAILED');
    return url;
}

async function openChromeUrl(url) {
    await runAdb([
        'shell', 'am', 'start',
        '-a', 'android.intent.action.VIEW',
        '-d', safeIntentUrl(url),
        '-p', 'com.android.chrome'
    ]);
}

function trafficSummary(tally) {
    const lines = ['Seen on the ZTO API: ' + tally.seen + ' answer(s), ' + tally.ok
        + ' OK, ' + tally.denied + ' not-signed-in, ' + tally.other + ' other.'];
    if (!tally.seen) {
        lines.push('   Chrome never called the ZTO API. Open Argus from the gate page');
        lines.push('   (the branch card), then scan one Waybill.');
    } else if (!tally.ok) {
        lines.push('   ZTO refused every call. Log in again in Chrome, then retry.');
    } else {
        lines.push('   ZTO answered, but no signed-in success carried a usable session cookie.');
        lines.push('   Open Scan Management -> Arrival Scan and scan one Waybill, then retry.');
    }
    return lines;
}

async function captureAndroidCookie(config) {
    const codedError = config.codedError || codedErrorFallback;
    const timeoutMs = Number(config.timeoutMs) || (10 * 60 * 1000);
    const responseTimeoutMs = Number(config.responseTimeoutMs) || 10000;
    const responseMaxBytes = Number(config.responseMaxBytes) || (1024 * 1024);
    const captureMethods = Array.isArray(config.captureMethods) ? config.captureMethods : ['GET', 'POST'];
    const targetSockets = new Map();
    const tally = { seen: 0, ok: 0, denied: 0, other: 0 };
    let settled = false;
    let scanTimer = null;
    let timeoutTimer = null;
    let argusTimer = null;
    let scanning = false;
    let resolveResult;
    let rejectResult;

    const resultPromise = new Promise((resolve, reject) => {
        resolveResult = resolve;
        rejectResult = reject;
    });

    const finish = (error, value) => {
        if (settled) return;
        settled = true;
        clearInterval(scanTimer);
        clearTimeout(timeoutTimer);
        clearTimeout(argusTimer);
        for (const item of targetSockets.values()) item.socket.close();
        targetSockets.clear();
        if (error) rejectResult(error);
        else resolveResult(value);
    };

    const makeTargetHandler = (state) => async (method, params, socket) => {
        if (settled) return;
        const requestId = String(params.requestId || '');
        if (method === 'Network.requestWillBeSent') {
            if (!requestId) return;
            const request = params.request || {};
            const row = state.requests.get(requestId) || {};
            row.url = String(request.url || '');
            row.method = String(request.method || '').toUpperCase();
            row.requestHeaders = request.headers || row.requestHeaders || {};
            row.isTarget = !!(config.isTargetApiUrl(row.url) && captureMethods.includes(row.method));
            state.requests.set(requestId, row);
            return;
        }
        if (method === 'Network.requestWillBeSentExtraInfo') {
            if (!requestId) return;
            const row = state.requests.get(requestId) || {};
            row.extraRequestHeaders = params.headers || {};
            state.requests.set(requestId, row);
            return;
        }
        if (method === 'Network.responseReceivedExtraInfo') {
            if (!requestId) return;
            const row = state.requests.get(requestId) || {};
            row.extraResponseHeaders = params.headers || {};
            state.requests.set(requestId, row);
            return;
        }
        if (method !== 'Network.responseReceived' || !requestId) return;

        const row = state.requests.get(requestId) || {};
        const response = params.response || {};
        if (!row.url) row.url = String(response.url || '');
        if (!row.isTarget && row.method) row.isTarget = !!(config.isTargetApiUrl(row.url) && captureMethods.includes(row.method));
        if (!row.isTarget) {
            state.requests.set(requestId, row);
            return;
        }

        const status = Number(response.status) || 0;
        tally.seen++;
        if (status >= 200 && status < 300) tally.ok++;
        else if (status === 401 || status === 403) tally.denied++;
        else tally.other++;
        if (status < 200 || status >= 300) return;

        row.responseHeaders = response.headers || {};
        row.responseSeenAt = Date.now();
        state.requests.set(requestId, row);
        if (row.inspecting) return;
        row.inspecting = true;

        // Give ExtraInfo a brief chance to arrive; Chrome places Cookie/Set-Cookie
        // there when those headers are hidden from the basic events.
        await sleep(120);
        if (settled) return;
        const current = state.requests.get(requestId) || row;
        const responseHeaders = Object.assign({}, current.responseHeaders || {}, current.extraResponseHeaders || {});
        if (!isJsonMime(responseHeaders) || !validContentLength(responseHeaders, responseMaxBytes)) return;

        const requestHeaders = Object.assign({}, current.requestHeaders || {}, current.extraRequestHeaders || {});
        const rawCookie = headerValue(requestHeaders, 'cookie');
        if (!rawCookie) return;

        let cookie;
        try { cookie = config.validateCookieHeader(rawCookie); } catch (_) { return; }

        let bodyResult;
        try {
            bodyResult = await Promise.race([
                socket.command('Network.getResponseBody', { requestId }, responseTimeoutMs),
                sleep(responseTimeoutMs).then(() => { throw new Error('BODY_TIMEOUT'); })
            ]);
        } catch (_) {
            return;
        }
        if (settled) return;
        let body = String(bodyResult.body || '');
        if (bodyResult.base64Encoded) {
            try { body = Buffer.from(body, 'base64').toString('utf8'); } catch (_) { return; }
        }
        if (Buffer.byteLength(body, 'utf8') > responseMaxBytes) return;
        let payload;
        try { payload = JSON.parse(body); } catch (_) { return; }
        if (!config.captureResponseSucceeded(payload)) return;

        // ExtraInfo may land just after responseReceived/body. Wait one short turn
        // before applying Set-Cookie mutations to the captured request cookie.
        await sleep(120);
        const latest = state.requests.get(requestId) || current;
        const latestHeaders = Object.assign({}, latest.responseHeaders || {}, latest.extraResponseHeaders || {});
        try {
            cookie = config.cookieAfterResponse(cookie, setCookieLines(latestHeaders), current.url);
        } catch (_) {
            return;
        }
        if (cookie) finish(null, cookie);
    };

    const attachTarget = async (target) => {
        const id = String(target.id || target.targetId || target.webSocketDebuggerUrl);
        if (!id || targetSockets.has(id) || settled) return;
        const state = { requests: new Map() };
        const socket = new CdpSocket(target.webSocketDebuggerUrl, makeTargetHandler(state));
        targetSockets.set(id, { socket, state, url: String(target.url || '') });
        try {
            await socket.connect();
            await socket.command('Network.enable', {
                maxTotalBufferSize: responseMaxBytes * 2,
                maxResourceBufferSize: responseMaxBytes
            });
            await socket.command('Page.enable', {});
        } catch (_) {
            socket.close();
            targetSockets.delete(id);
        }
    };

    const scanTargets = async () => {
        if (scanning || settled) return;
        scanning = true;
        try {
            const targets = await listPageTargets();
            await Promise.all(targets.map((target) => attachTarget(target)));
        } catch (_) {
            // Temporary target-list failures are expected during navigation.
        } finally {
            scanning = false;
        }
    };

    try {
        try {
            const state = await runAdb(['get-state']);
            if (!/\bdevice\b/i.test(state.stdout)) throw new Error('NOT_DEVICE');
        } catch (_) {
            throw codedError('ANDROID_ADB_NOT_CONNECTED');
        }

        try {
            await openChromeUrl(config.portalUrl);
        } catch (_) {
            throw codedError('ANDROID_CHROME_OPEN_FAILED');
        }

        try {
            await runAdb(['forward', `tcp:${CDP_PORT}`, 'localabstract:chrome_devtools_remote']);
            await waitForChromeCdp(12000);
        } catch (_) {
            throw codedError('ANDROID_CDP_UNAVAILABLE');
        }

        console.log('The ZTO gate page is open in Chrome on Android.');
        console.log('   1. The gate usually keeps your session. Log in only if ZTO asks.');
        console.log('   2. This tool opens Argus shortly. If it does not, tap the branch card.');
        console.log('   3. Stay in Chrome. This tool continues as soon as ZTO answers');
        console.log('      one signed-in API call with success.');
        console.log('   4. If it keeps waiting, open Scan Management -> Arrival Scan and');
        console.log('      type or scan one Waybill.');

        await scanTargets();
        scanTimer = setInterval(scanTargets, TARGET_POLL_MS);
        timeoutTimer = setTimeout(() => {
            for (const line of trafficSummary(tally)) console.log(line);
            finish(codedError('CAPTURE_TIMEOUT'));
        }, timeoutMs);
        argusTimer = setTimeout(() => {
            if (settled) return;
            openChromeUrl(config.argusUrl).then(() => {
                console.log('   Opened Argus in Chrome. Waiting for a signed-in answer...');
                return scanTargets();
            }).catch(() => {
                console.log('   Could not open Argus automatically. Tap the branch card yourself.');
            });
        }, ARGUS_OPEN_DELAY_MS);

        return await resultPromise;
    } catch (error) {
        finish(error);
        throw error;
    } finally {
        if (!settled) finish(codedError('BROWSER_CLOSED'));
        try { await runAdb(['forward', '--remove', `tcp:${CDP_PORT}`], { timeoutMs: 5000 }); } catch (_) {}
        if (settled && resultPromise) resultPromise.catch(() => {});
    }
}

module.exports = {
    captureAndroidCookie,
    headerValue,
    safeIntentUrl,
    setCookieLines,
    isJsonMime,
    normalizeWsUrl,
    trafficSummary
};
