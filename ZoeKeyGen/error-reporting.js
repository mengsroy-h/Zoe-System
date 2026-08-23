(function (global) {
    'use strict';

    const DSN_STORAGE_KEY = 'zoe_sentry_dsn';
    const SENTRY_SDK_URL = 'https://browser.sentry-cdn.com/7.120.3/bundle.min.js';
    const SDK_LOAD_TIMEOUT_MS = 10000;
    const SECRET_PARAM_PATTERN = '(?:auth|access_token|id_token|key|apikey|api_key|token|secret|password|passwd|pwd|sig|signature|setup)';

    let loadPromise = null;

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
                if (settled) return;
                settled = true;
                clearTimeout(timer);
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

    function redactUrl(url) {
        if (typeof url !== 'string') return url;
        return url
            .replace(new RegExp('([?&#]' + SECRET_PARAM_PATTERN + '=)[^&#\\s]+', 'gi'), '$1[redacted]')
            .replace(new RegExp('(^|[\\s"\'])' + SECRET_PARAM_PATTERN + '=[^&#\\s"\']+', 'gi'), '$1[redacted]');
    }

    function redactBreadcrumb(crumb) {
        try {
            if (crumb && crumb.data && typeof crumb.data.url === 'string') crumb.data.url = redactUrl(crumb.data.url);
            if (crumb && crumb.data && typeof crumb.data.to === 'string') crumb.data.to = redactUrl(crumb.data.to);
            if (crumb && crumb.data && typeof crumb.data.from === 'string') crumb.data.from = redactUrl(crumb.data.from);
            if (crumb && typeof crumb.message === 'string') crumb.message = redactUrl(crumb.message);
        } catch (e) {}
        return crumb;
    }

    function redactEvent(event) {
        try {
            if (!event) return event;
            if (event.request && typeof event.request.url === 'string') event.request.url = redactUrl(event.request.url);
            if (typeof event.message === 'string') event.message = redactUrl(event.message);
            if (event.exception && Array.isArray(event.exception.values)) {
                event.exception.values.forEach((entry) => {
                    if (entry && typeof entry.value === 'string') entry.value = redactUrl(entry.value);
                });
            }
            if (Array.isArray(event.breadcrumbs)) event.breadcrumbs.forEach(redactBreadcrumb);
            if (event.extra) {
                Object.keys(event.extra).forEach((key) => {
                    if (typeof event.extra[key] === 'string') event.extra[key] = redactUrl(event.extra[key]);
                });
            }
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

    async function init(appName, release) {
        tagApp(appName, release);

        const dsn = getDsn();
        if (!dsn) return !!global.Sentry;
        try {
            const Sentry = await loadSentrySdk();
            if (!Sentry || typeof Sentry.init !== 'function') return false;
            const options = guardedOptions(appName, release);
            options.dsn = dsn;
            options.sampleRate = 1.0;
            options.tracesSampleRate = 0;
            Sentry.init(options);
            if (typeof Sentry.setTag === 'function') Sentry.setTag('app', appName || 'unknown');
            return true;
        } catch (e) {
            console.error('Sentry init failed:', e);
            return false;
        }
    }

    function capture(err, extra) {
        if (global.Sentry && typeof global.Sentry.captureException === 'function') {
            try { global.Sentry.captureException(err, extra ? { extra: extra } : undefined); } catch (e) {}
        }
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

    global.ZoeErrors = { init: init, capture: capture, setDsn: setDsn, getDsn: getDsn, redactUrl: redactUrl };
})(window);
