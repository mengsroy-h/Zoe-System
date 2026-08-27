(function (global) {
    'use strict';

    const DSN_STORAGE_KEY = 'zoe_sentry_dsn';
    const SENTRY_SDK_URL = 'https://browser.sentry-cdn.com/7.120.3/bundle.min.js';
    const SDK_LOAD_TIMEOUT_MS = 10000;
    const MAX_QUEUED_EVENTS = 20;
    const SECRET_PARAM_PATTERN = '(?:auth|authorization|access_token|id_token|refresh_token|session_token|key|apikey|api_key|token|secret|password|passwd|passphrase|passcode|pwd|pin|credential|bearer|jwt|sig|signature|setup)';
    const REDACT_MAX_DEPTH = 12;
    const REDACT_MAX_NODES = 5000;

    let loadPromise = null;
    let sentryReady = false;
    let initGeneration = 0;
    let lateInitRequest = null;
    const queuedEvents = [];

    function loadSentrySdk() {
        if (global.Sentry) return Promise.resolve(global.Sentry);
        if (loadPromise) return loadPromise;
        loadPromise = new Promise((resolve, reject) => {
            let settled = false;
            const timer = setTimeout(() => {
                if (settled) return;
                settled = true;
                loadPromise = null;
                reject(new Error('Sentry SDK load timed out'));
            }, SDK_LOAD_TIMEOUT_MS);
            const script = document.createElement('script');
            script.src = SENTRY_SDK_URL;
            script.crossOrigin = 'anonymous';
            script.onload = () => {
                clearTimeout(timer);
                if (settled) { runLateInit(); return; }
                settled = true;
                resolve(global.Sentry);
            };
            script.onerror = () => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                loadPromise = null;
                reject(new Error('Sentry SDK failed to load'));
            };
            document.head.appendChild(script);
        });
        return loadPromise;
    }

    const SECRET_WORD_RE = new RegExp(
        '(?:^|_)' + SECRET_PARAM_PATTERN + '(?:$|_)', 'i');

    function isSecretParamName(name) {
        if (!name) return false;
        const split = String(name)
            .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
            .replace(/[.-]/g, '_');
        return SECRET_WORD_RE.test('_' + split + '_');
    }

    function redactPairs(text, leadClass, valueClass) {
        return text.replace(
            new RegExp('(' + leadClass + ')([A-Za-z0-9_.\\-]{1,64})=(' + valueClass + '+)', 'g'),
            (whole, lead, name) => (isSecretParamName(name) ? lead + name + '=[redacted]' : whole)
        );
    }

    function redactUrl(url) {
        if (typeof url !== 'string') return url;
        let out = redactPairs(url, '[?&#]', '[^&#\\s"\'<>]');
        out = redactPairs(out, '^|[\\s"\'([,;{|]', '[^&#\\s"\'<>,;)\\]}|]');
        return out
            .replace(/(\/macros\/s\/)[^/\s"']+/g, '$1[redacted]')
            .replace(/(\b[a-zA-Z][a-zA-Z0-9+.-]*:\/\/)[^/\s:@]+:[^/\s@]+@/g, '$1[redacted]@');
    }

    const SECRET_KEY_PATTERN = '(?:password|passwd|passphrase|passcode|pwd|pin|secret|'
        + 'token|apikey|api_key|access_token|id_token|refresh_token|session_token|'
        + 'credential|authorization|bearer|jwt|setup)';
    const SECRET_KEY_RE = new RegExp('(?:^|_)' + SECRET_KEY_PATTERN + '(?:$|_)', 'i');

    function isSecretKeyName(name) {
        if (!name) return false;
        const split = String(name)
            .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
            .replace(/[.-]/g, '_');
        return SECRET_KEY_RE.test('_' + split + '_');
    }

    function redactDeep(value, depth, seen, budget) {
        if (typeof value === 'string') return redactUrl(value);
        if (!value || typeof value !== 'object') return value;
        if (depth >= REDACT_MAX_DEPTH || budget.n >= REDACT_MAX_NODES) return '[truncated]';
        if (seen.has(value)) return value;
        seen.add(value);
        budget.n++;
        if (Array.isArray(value)) {
            for (let i = 0; i < value.length; i++) {
                if (budget.n >= REDACT_MAX_NODES) break;
                value[i] = redactDeep(value[i], depth + 1, seen, budget);
            }
            return value;
        }
        const keys = Object.keys(value);
        for (let i = 0; i < keys.length; i++) {
            if (budget.n >= REDACT_MAX_NODES) break;
            try {
                if (isSecretKeyName(keys[i]) && value[keys[i]] !== null && value[keys[i]] !== undefined
                    && typeof value[keys[i]] !== 'function') {
                    value[keys[i]] = '[redacted]';
                    continue;
                }
                value[keys[i]] = redactDeep(value[keys[i]], depth + 1, seen, budget);
            } catch (e) {}
        }
        return value;
    }

    function redactBreadcrumb(crumb) {
        try { redactDeep(crumb, 0, new Set(), { n: 0 }); } catch (e) {}
        return crumb;
    }

    function redactEvent(event) {
        try {
            if (!event) return event;
            redactDeep(event, 0, new Set(), { n: 0 });
        } catch (e) {}
        return event;
    }

    function guardedOptions(appName, release) {
        return {
            environment: appName || 'unknown',
            release: release || undefined,
            sendDefaultPii: false,
            beforeBreadcrumb: redactBreadcrumb,
            beforeSend: redactEvent
        };
    }

    function tagApp(appName, release) {
        if (!global.Sentry) return;
        if (typeof global.Sentry.onLoad !== 'function') {
            try {
                if (typeof global.Sentry.setTag === 'function') global.Sentry.setTag('app', appName || 'unknown');
            } catch (e) {}
            return;
        }
        global.Sentry.onLoad(() => {
            try {
                if (typeof global.Sentry.init === 'function') global.Sentry.init(guardedOptions(appName, release));
                if (typeof global.Sentry.setTag === 'function') global.Sentry.setTag('app', appName || 'unknown');
            } catch (e) {}
        });
    }

    function sendToSentry(err, extra) {
        try { global.Sentry.captureException(err, extra ? { extra: extra } : undefined); } catch (e) {}
    }

    function flushQueuedEvents() {
        if (!sentryReady || !queuedEvents.length) return;
        const pending = queuedEvents.splice(0, queuedEvents.length);
        pending.forEach((item) => sendToSentry(item.err, item.extra));
    }

    function applySentryInit(appName, release, dsn) {
        if (!global.Sentry || typeof global.Sentry.init !== 'function') return false;
        try {
            const options = guardedOptions(appName, release);
            options.dsn = dsn;
            options.sampleRate = 1.0;
            options.tracesSampleRate = 0;
            global.Sentry.init(options);
            if (typeof global.Sentry.setTag === 'function') global.Sentry.setTag('app', appName || 'unknown');
        } catch (e) {
            return false;
        }
        sentryReady = true;
        lateInitRequest = null;
        flushQueuedEvents();
        return true;
    }

    function runLateInit() {
        const request = lateInitRequest;
        lateInitRequest = null;
        if (!request || request.generation !== initGeneration) return;
        applySentryInit(request.appName, request.release, request.dsn);
    }

    function detachSentry() {
        sentryReady = false;
        lateInitRequest = null;
        queuedEvents.length = 0;
        if (!global.Sentry) return;
        try {
            if (typeof global.Sentry.getCurrentHub === 'function') {
                const hub = global.Sentry.getCurrentHub();
                if (hub && typeof hub.bindClient === 'function') { hub.bindClient(undefined); return; }
            }
        } catch (e) {}
        try {
            if (typeof global.Sentry.close === 'function') global.Sentry.close();
        } catch (e) {}
    }

    async function init(appName, release) {
        const myGeneration = ++initGeneration;
        tagApp(appName, release);

        const dsn = getDsn();
        if (!dsn) {
            detachSentry();
            return false;
        }
        try {
            const Sentry = await loadSentrySdk();
            if (myGeneration !== initGeneration) return false;
            if (!Sentry || typeof Sentry.init !== 'function') return false;
            return applySentryInit(appName, release, dsn);
        } catch (e) {
            if (myGeneration !== initGeneration) return false;
            lateInitRequest = { appName: appName, release: release, dsn: dsn, generation: myGeneration };
            console.error('Sentry init failed:', e);
            return false;
        }
    }

    function capture(err, extra) {
        if (sentryReady && global.Sentry && typeof global.Sentry.captureException === 'function') {
            sendToSentry(err, extra);
            return;
        }
        if (queuedEvents.length >= MAX_QUEUED_EVENTS) queuedEvents.shift();
        queuedEvents.push({ err: err, extra: extra });
    }

    function setDsn(dsn) {
        const trimmed = (dsn || '').trim();
        try {
            if (trimmed) localStorage.setItem(DSN_STORAGE_KEY, trimmed);
            else localStorage.removeItem(DSN_STORAGE_KEY);
        } catch (e) {}
    }

    function getDsn() {
        try {
            return localStorage.getItem(DSN_STORAGE_KEY) || '';
        } catch (e) {
            return '';
        }
    }

    global.ZoeErrors = { init: init, capture: capture, setDsn: setDsn, getDsn: getDsn, redactUrl: redactUrl, redactEvent: redactEvent };
})(window);
