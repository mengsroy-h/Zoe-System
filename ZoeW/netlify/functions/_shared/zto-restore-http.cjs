'use strict';

class RestoreFailure extends Error {
    constructor(code, status = 503) { super(code); this.code = code; this.status = status; }
}

function deadlineBudget(signal, durationMs = 45000, now = Date.now) {
    const deadline = now() + durationMs;
    return {
        signal,
        remaining() { return Math.max(0, deadline - now()); },
        assert() {
            if (signal && signal.aborted) throw new RestoreFailure('ZTO_RESTORE_CANCELLED', 499);
            if (now() >= deadline) throw new RestoreFailure('ZTO_RESTORE_TIMEOUT', 504);
        }
    };
}

async function readBoundedJson(response, maximumBytes, controller) {
    const length = response.headers.get('content-length');
    if (length !== null && (!/^\d+$/.test(length) || Number(length) > maximumBytes)) {
        throw new RestoreFailure('ZTO_RESTORE_RESPONSE_TOO_LARGE');
    }
    const type = response.headers.get('content-type') || '';
    if (!/^application\/(?:[a-z0-9.+-]+\+)?json(?:\s*;|\s*$)/i.test(type)) throw new RestoreFailure('ZTO_RESTORE_INVALID_RESPONSE');
    if (!response.body || typeof response.body.getReader !== 'function') throw new RestoreFailure('ZTO_RESTORE_INVALID_RESPONSE');
    const reader = response.body.getReader();
    const cancel = () => { Promise.resolve(reader.cancel()).catch(() => {}); };
    controller.signal.addEventListener('abort', cancel, { once: true });
    const pieces = [];
    let bytes = 0;
    try {
        for (;;) {
            const next = await reader.read();
            if (next.done) break;
            bytes += next.value.byteLength;
            if (bytes > maximumBytes) throw new RestoreFailure('ZTO_RESTORE_RESPONSE_TOO_LARGE');
            pieces.push(Buffer.from(next.value));
        }
        let value;
        try { value = JSON.parse(Buffer.concat(pieces, bytes).toString('utf8')); }
        catch (_) { throw new RestoreFailure('ZTO_RESTORE_INVALID_RESPONSE'); }
        return value;
    } finally {
        controller.signal.removeEventListener('abort', cancel);
        cancel();
        try { reader.releaseLock(); } catch (_) {  }
    }
}

async function fetchJson(url, init, budget, { maximumBytes = 4 * 1024 * 1024, timeoutMs = 6000, fetchImpl = fetch } = {}) {
    budget.assert();
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    if (budget.signal) budget.signal.addEventListener('abort', onAbort, { once: true });
    let timer;
    try {
        const work = (async () => {
            const response = await fetchImpl(url, { ...init, redirect: 'error', signal: controller.signal });
            if (response.status >= 300 && response.status < 400) throw new RestoreFailure('ZTO_RESTORE_REDIRECT_REJECTED');
            if (response.status === 401 || response.status === 403) throw new RestoreFailure('ZTO_RESTORE_AUTH_REQUIRED', 401);
            if (!response.ok) throw new RestoreFailure('ZTO_RESTORE_BACKEND_UNAVAILABLE');
            const value = await readBoundedJson(response, maximumBytes, controller);
            budget.assert();
            return { value, etag: response.headers.get('etag') || '' };
        })();
        const timed = new Promise((_, reject) => {
            timer = setTimeout(() => { controller.abort(); reject(new RestoreFailure('ZTO_RESTORE_TIMEOUT', 504)); },
                Math.max(1, Math.min(timeoutMs, budget.remaining())));
        });
        return await Promise.race([work, timed]);
    } catch (error) {
        if (error instanceof RestoreFailure) throw error;
        if (budget.signal && budget.signal.aborted) throw new RestoreFailure('ZTO_RESTORE_CANCELLED', 499);
        throw new RestoreFailure('ZTO_RESTORE_BACKEND_UNAVAILABLE');
    } finally {
        clearTimeout(timer);
        controller.abort();
        if (budget.signal) budget.signal.removeEventListener('abort', onAbort);
    }
}

function configuredOrigin(raw, kind) {
    let url;
    try { url = new URL(String(raw || '').trim()); } catch (_) { throw new RestoreFailure('ZTO_RESTORE_NOT_CONFIGURED'); }
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || !['', '/'].includes(url.pathname)) {
        throw new RestoreFailure('ZTO_RESTORE_NOT_CONFIGURED');
    }
    if (kind === 'firebase' && !/^(?:[a-z0-9-]+\.firebaseio\.com|[a-z0-9-]+\.[a-z0-9-]+\.firebasedatabase\.app)$/.test(url.hostname)) {
        throw new RestoreFailure('ZTO_RESTORE_NOT_CONFIGURED');
    }
    return url.origin;
}

async function requestJson(request, maximumBytes = 8192, budget = deadlineBudget(request.signal)) {
    const type = request.headers.get('content-type') || '';
    if (!/^application\/json(?:\s*;|\s*$)/i.test(type)) throw new RestoreFailure('ZTO_RESTORE_INVALID_REQUEST', 400);
    const controller = new AbortController();
    let timer;
    const onAbort = () => controller.abort();
    if (request.signal) request.signal.addEventListener('abort', onAbort, { once: true });
    try {
        budget.assert();
        const timeout = new Promise((_, reject) => {
            timer = setTimeout(() => { controller.abort(); reject(new RestoreFailure('ZTO_RESTORE_TIMEOUT', 504)); }, Math.max(1, budget.remaining()));
        });
        return await Promise.race([readBoundedJson(request, maximumBytes, controller), timeout]);
    }
    catch (error) {
        if (error.code === 'ZTO_RESTORE_TIMEOUT') throw error;
        throw new RestoreFailure(error.code === 'ZTO_RESTORE_RESPONSE_TOO_LARGE' ? 'ZTO_RESTORE_REQUEST_TOO_LARGE' : 'ZTO_RESTORE_INVALID_REQUEST', 400);
    } finally { clearTimeout(timer); controller.abort(); if (request.signal) request.signal.removeEventListener('abort', onAbort); }
}

module.exports = { RestoreFailure, deadlineBudget, readBoundedJson, fetchJson, configuredOrigin, requestJson };
