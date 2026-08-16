(function (global) {
    'use strict';

    const DSN_STORAGE_KEY = 'zoe_sentry_dsn';
    const SENTRY_SDK_URL = 'https://browser.sentry-cdn.com/7.120.3/bundle.min.js';

    let loadPromise = null;

    function loadSentrySdk() {
        if (global.Sentry) return Promise.resolve(global.Sentry);
        if (loadPromise) return loadPromise;
        loadPromise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = SENTRY_SDK_URL;
            script.crossOrigin = 'anonymous';
            script.onload = () => resolve(global.Sentry);
            script.onerror = () => { loadPromise = null; reject(new Error('Sentry SDK failed to load')); };
            document.head.appendChild(script);
        });
        return loadPromise;
    }

    async function init(appName, release) {
        const dsn = getDsn();
        if (!dsn) return false;
        try {
            const Sentry = await loadSentrySdk();
            if (!Sentry) return false;
            Sentry.init({
                dsn: dsn,
                environment: appName || 'unknown',
                release: release || undefined,
                sendDefaultPii: false,
                sampleRate: 1.0,
                tracesSampleRate: 0
            });
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
