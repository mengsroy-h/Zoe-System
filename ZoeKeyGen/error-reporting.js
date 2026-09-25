(function (global) {
    'use strict';

    const DSN_STORAGE_KEY = 'zoe_sentry_dsn';
    const SENTRY_SDK_URL = 'https://browser.sentry-cdn.com/10.75.3/bundle.min.js';
    const SDK_LOAD_TIMEOUT_MS = 10000;
    const MAX_QUEUED_EVENTS = 20;
    const SECRET_PARAM_PATTERN = '(?:auth|authorization|access_token|id_token|refresh_token|session_token|key|apikey|api_key|token|secret|password|passwd|passphrase|passcode|pwd|pin|credential|bearer|jwt|sig|signature|setup|cookie|header_value|bos_man_session)';
    const REDACT_MAX_DEPTH = 12;
    const REDACT_MAX_NODES = 5000;
    const REDACT_MAX_JSON_CHARS = 64 * 1024;

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
        try { name = decodeURIComponent(name); } catch (e) {}
        const split = String(name)
            .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
            .replace(/[.-]/g, '_');
        return SECRET_WORD_RE.test('_' + split + '_');
    }

    function redactPairs(text, leadClass, valueClass) {
        return text.replace(
            new RegExp('(' + leadClass + ')([A-Za-z0-9_.%\\-]{1,64})=(' + valueClass + '+)', 'g'),
            (whole, lead, name) => (isSecretParamName(name) ? lead + name + '=[redacted]' : whole)
        );
    }

    const COLON_PAIR_RE = new RegExp(
        '(^|[\\s"\'([,;{|])("?)([A-Za-z0-9_.\\-]{1,64})("?)(\\s*:\\s*)("?)[^\\s"\'<>,;)\\]}|]+', 'g');

    function redactColonPairs(text) {
        return text.replace(COLON_PAIR_RE, (whole, lead, openQuote, name, closeQuote, sep, valueQuote) =>
            (isSecretParamName(name)
                ? lead + openQuote + name + closeQuote + sep + valueQuote + '[redacted]'
                : whole));
    }

    function isPrivateJwk(value) {
        const kty = value.kty;
        const fields = kty === 'RSA' ? ['d', 'p', 'q', 'dp', 'dq', 'qi', 'oth']
            : (kty === 'EC' || kty === 'OKP') ? ['d'] : kty === 'oct' ? ['k'] : null;
        return !!(fields && fields.some((key) => Object.prototype.hasOwnProperty.call(value, key)));
    }

    function redactEmbeddedJwks(text) {
        const first = text.indexOf('{');
        if (first < 0) return text;
        const limit = Math.min(text.length, REDACT_MAX_JSON_CHARS);
        const stack = [], ranges = [];
        let quoted = false, escaped = false, cut = limit, fragments = 0, remaining = REDACT_MAX_JSON_CHARS;
        for (let i = first; i < limit; i++) {
            const char = text[i];
            if (quoted) {
                if (escaped) escaped = false;
                else if (char === '\\') escaped = true;
                else if (char === '"') quoted = false;
                continue;
            }
            if (char === '"' && stack.length) { quoted = true; continue; }
            if (char === '{') {
                if (stack.length >= REDACT_MAX_DEPTH) { cut = stack[0]; break; }
                stack.push(i);
            } else if (char === '}' && stack.length) {
                const start = stack.pop(), length = i - start + 1;
                if (++fragments > REDACT_MAX_NODES || length > remaining) { cut = stack.length ? stack[0] : start; break; }
                remaining -= length;
                try {
                    if (isPrivateJwk(JSON.parse(text.slice(start, i + 1)))) {
                        while (ranges.length && ranges[ranges.length - 1].start >= start) ranges.pop();
                        ranges.push({ start, end: i + 1 });
                    }
                } catch (e) {}
            }
        }
        if (cut === limit && limit < text.length && stack.length) cut = stack[0];
        let out = '', at = 0;
        for (const range of ranges) {
            if (range.start >= cut) break;
            out += text.slice(at, range.start) + '"[redacted]"';
            at = range.end;
        }
        return out + text.slice(at, cut) + (cut < text.length ? '[truncated]' : '');
    }

    function redactUrl(url) {
        if (typeof url !== 'string') return url;
        url = redactEmbeddedJwks(url);
        if (/^\s*[\[{]/.test(url)) {
            try {
                const parsed = JSON.parse(url);
                const before = JSON.stringify(parsed);
                const after = JSON.stringify(redactDeep(parsed, 0, new Map(), { n: 0 }));
                if (before !== after) url = after;
            } catch (e) {}
        }
        let out = url
            .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{8,}/gi, '$1 [redacted]')
            .replace(/(^|[\s{])((?:set-)?cookie[ \t]*:[ \t]*)[^\r\n]*/gi, '$1$2[redacted]')
            .replace(/(^|[\s"'([,;{|])(["']?)([A-Za-z0-9_.%\-]{1,64})\2(\s*[:=]\s*)("(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*')/g,
                (whole, lead, quote, name, sep, value) => isSecretParamName(name)
                    ? lead + quote + name + quote + sep + value[0] + '[redacted]' + value[0] : whole);
        out = redactPairs(out, '[?&#]', '[^&#\\s"\'<>]');
        out = redactPairs(out, '^|[\\s"\'([,;{|]', '[^&#\\s"\'<>,;)\\]}|]');
        out = redactColonPairs(out);
        return out
            .replace(/(\/macros\/s\/)[^/\s"']+/g, '$1[redacted]')
            .replace(/(\b[a-zA-Z][a-zA-Z0-9+.-]*:\/\/)[^/\s:@]+:[^/\s@]+@/g, '$1[redacted]@')
            .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{8,}/gi, '$1 [redacted]')
            .replace(/\beyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{4,}/g, '[redacted]');
    }

    const SECRET_KEY_PATTERN = '(?:password|passwd|passphrase|passcode|pwd|pin|secret|'
        + 'token|apikey|api_key|access_token|id_token|refresh_token|session_token|'
        + 'credential|authorization|bearer|jwt|setup|cookie|private_key|signing_key|'
        + 'header_value|proxy_key|bos_man_session|activation_key|license_key|key_string)';
    const SECRET_KEY_RE = new RegExp('(?:^|_)' + SECRET_KEY_PATTERN + '(?:$|_)', 'i');

    function isSecretKeyName(name) {
        if (!name) return false;
        const split = String(name)
            .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
            .replace(/[.-]/g, '_');
        return SECRET_KEY_RE.test('_' + split + '_');
    }

    function redactOverBudget(value) {
        if (typeof value === 'string') return redactUrl(value);
        if (value && typeof value === 'object') return '[truncated]';
        return value;
    }

    function shallowCopy(value) {
        if (Array.isArray(value)) return value.slice();
        const out = {};
        const keys = Object.keys(value);
        for (let i = 0; i < keys.length; i++) {
            try { out[keys[i]] = value[keys[i]]; } catch (e) {}
        }
        return out;
    }

    function redactDeep(value, depth, seen, budget) {
        if (typeof value === 'string') return redactUrl(value);
        if (!value || typeof value !== 'object') return value;
        try {
            if (isPrivateJwk(value)) return '[redacted]';
        } catch (e) { return '[truncated]'; }
        if (depth >= REDACT_MAX_DEPTH || budget.n >= REDACT_MAX_NODES) return '[truncated]';
        if (seen.has(value)) return seen.get(value) || '[circular]';
        seen.set(value, null);
        budget.n++;

        let target = value;
        const put = (key, next) => {
            if (target === value) {
                try {
                    target[key] = next;
                    if (target[key] === next) return;
                } catch (e) {}
                target = shallowCopy(value);
            }
            try { target[key] = next; } catch (e) {}
        };

        if (Array.isArray(value)) {
            for (let i = 0; i < value.length; i++) {
                if (budget.n >= REDACT_MAX_NODES) { put(i, redactOverBudget(value[i])); continue; }
                put(i, redactDeep(value[i], depth + 1, seen, budget));
            }
            seen.set(value, target);
            return target;
        }
        const keys = Object.keys(value);
        for (let i = 0; i < keys.length; i++) {
            try {
                if (isSecretKeyName(keys[i]) && value[keys[i]] !== null && value[keys[i]] !== undefined
                    && typeof value[keys[i]] !== 'function') {
                    put(keys[i], '[redacted]');
                    continue;
                }
                if (budget.n >= REDACT_MAX_NODES) { put(keys[i], redactOverBudget(value[keys[i]])); continue; }
                put(keys[i], redactDeep(value[keys[i]], depth + 1, seen, budget));
            } catch (e) {}
        }
        seen.set(value, target);
        return target;
    }

    function redactBreadcrumb(crumb) {
        try { return redactDeep(crumb, 0, new Map(), { n: 0 }); } catch (e) {}
        return crumb;
    }

    function redactEvent(event) {
        try {
            if (!event) return event;
            return redactDeep(event, 0, new Map(), { n: 0 });
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
        try {
            let scope;
            if (extra) {
                scope = { extra: extra };
                const zone = extra.zone;
                if (typeof zone === 'string' && /^[a-z][a-z0-9-]{0,23}$/.test(zone)) scope.tags = { zone: zone };
            }
            global.Sentry.captureException(err, scope);
        } catch (e) {}
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
