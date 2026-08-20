(function (global) {
    'use strict';

    const DSN_STORAGE_KEY = 'zoe_sentry_dsn';
    const SENTRY_SDK_URL = 'https://browser.sentry-cdn.com/7.120.3/bundle.min.js';
    const SDK_LOAD_TIMEOUT_MS = 10000;

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
        return url.replace(/([?&](?:auth|access_token|id_token|key)=)[^&#]+/gi, '$1[redacted]');
    }

    function redactBreadcrumb(crumb) {
        try {
            if (crumb && crumb.data && typeof crumb.data.url === 'string') crumb.data.url = redactUrl(crumb.data.url);
            if (crumb && typeof crumb.message === 'string') crumb.message = redactUrl(crumb.message);
        } catch (e) {}
        return crumb;
    }

    function tagApp(appName) {
        if (!global.Sentry || typeof global.Sentry.onLoad !== 'function') return;
        global.Sentry.onLoad(() => {
            try {
                if (typeof global.Sentry.setTag === 'function') global.Sentry.setTag('app', appName || 'unknown');
            } catch (e) {}
        });
    }

    async function init(appName, release) {
        tagApp(appName);

        const dsn = getDsn();
        if (!dsn) return !!global.Sentry;
        try {
            const Sentry = await loadSentrySdk();
            if (!Sentry || typeof Sentry.init !== 'function') return false;
            Sentry.init({
                dsn: dsn,
                environment: appName || 'unknown',
                release: release || undefined,
                sendDefaultPii: false,
                sampleRate: 1.0,
                tracesSampleRate: 0,
                beforeBreadcrumb: redactBreadcrumb
            });
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
        if (trimmed) localStorage.setItem(DSN_STORAGE_KEY, trimmed);
        else localStorage.removeItem(DSN_STORAGE_KEY);
    }

    function getDsn() {
        return localStorage.getItem(DSN_STORAGE_KEY) || '';
    }

    global.ZoeErrors = { init: init, capture: capture, setDsn: setDsn, getDsn: getDsn };
})(window);
