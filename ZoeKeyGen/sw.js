const CACHE_VERSION = 'zoekeygen-v97';

const CORE_SHELL = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './boot-flags.js',
    './firebase-loader.js',
    './license-verify.js',
    './error-reporting.js',
    './qrcode.js'
];

const OPTIONAL_SHELL = [
    './manifest.json',
    './icon-192.png',
    './icon-512.png'
];

const SHELL_PATHS = new Set(
    CORE_SHELL.concat(OPTIONAL_SHELL).map((url) => new URL(url, self.location.href).pathname)
);

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_VERSION)
            .then((cache) => cache.addAll(CORE_SHELL).then(() => Promise.all(
                OPTIONAL_SHELL.map((url) => cache.add(url).catch(() => {}))
            )))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((key) => key.startsWith('zoekeygen-') && key !== CACHE_VERSION).map((key) => caches.delete(key)))
        ).then(() => self.clients.claim())
    );
});

function cacheKeyFor(request) {
    if (request.mode === 'navigate') return './index.html';
    const url = new URL(request.url);
    return SHELL_PATHS.has(url.pathname) ? url.pathname : request;
}

function linkIsFrugal() {
    const link = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (!link) return false;
    if (link.saveData === true) return true;
    const type = String(link.effectiveType || '');
    return type === 'slow-2g' || type === '2g';
}

const REVALIDATE_TIMEOUT_MS = 6000;
const REVALIDATE_MAX_IN_FLIGHT = 3;
const revalidateInFlight = new Set();

function revalidateShell(cache, request, cacheKey) {
    if (navigator.onLine === false) return Promise.resolve();
    if (linkIsFrugal()) return Promise.resolve();
    const key = typeof cacheKey === 'string' ? cacheKey : request.url;
    if (revalidateInFlight.has(key)) return Promise.resolve();
    if (revalidateInFlight.size >= REVALIDATE_MAX_IN_FLIGHT) return Promise.resolve();
    revalidateInFlight.add(key);

    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    let released = false;
    const release = () => {
        if (released) return;
        released = true;
        clearTimeout(timer);
        revalidateInFlight.delete(key);
    };
    const timer = setTimeout(() => {
        if (controller) { try { controller.abort(); } catch (e) {} }
        release();
    }, REVALIDATE_TIMEOUT_MS);

    const target = typeof cacheKey === 'string' ? cacheKey : request;
    return fetch(target, controller ? { signal: controller.signal } : undefined).then((response) => {
        if (!response || !response.ok || response.redirected) { release(); return; }
        return cache.put(cacheKey, response.clone()).then(release, release);
    }, release);
}

const NETWORK_TIMEOUT_MS = 20000;

function timedFetch(request, options) {
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const sourceSignal = (options && options.signal) || (request && request.signal) || null;
    const opts = controller ? Object.assign({}, options || {}, { signal: controller.signal }) : options;
    return new Promise((resolve, reject) => {
        let settled = false;
        let timer = null;
        const stop = () => {
            if (timer !== null) {
                clearTimeout(timer);
                timer = null;
            }
            if (sourceSignal && typeof sourceSignal.removeEventListener === 'function') {
                sourceSignal.removeEventListener('abort', abortFromSource);
            }
        };
        const abortFromSource = () => {
            if (settled) return;
            settled = true;
            if (controller) { try { controller.abort(); } catch (e) {} }
            stop();
            const err = new Error('Aborted');
            err.name = 'AbortError';
            reject(err);
        };
        if (sourceSignal && typeof sourceSignal.addEventListener === 'function') {
            if (sourceSignal.aborted) {
                abortFromSource();
                return;
            }
            sourceSignal.addEventListener('abort', abortFromSource, { once: true });
        }
        timer = setTimeout(() => {
            timer = null;
            if (settled) return;
            settled = true;
            if (controller) { try { controller.abort(); } catch (e) {} }
            stop();
            const err = new Error('Network timed out');
            err.name = 'AbortError';
            reject(err);
        }, NETWORK_TIMEOUT_MS);
        fetch(request, opts).then((response) => {
            if (settled) return;
            settled = true;
            stop();
            resolve(response);
        }, (err) => {
            if (settled) return;
            settled = true;
            stop();
            reject(err);
        });
    });
}

function networkOnly(request, options) {
    return timedFetch(request, options).then((response) => response || Response.error(), () => Response.error());
}

self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;

    const cacheKey = cacheKeyFor(request);
    const isShell = typeof cacheKey === 'string';
    const networkTarget = request.mode === 'navigate' ? cacheKey : request;
    const networkOptions = request.mode === 'navigate' ? { signal: request.signal } : undefined;

    event.respondWith(
        caches.open(CACHE_VERSION).then((cache) =>
            cache.match(cacheKey).then((cached) => {
                if (cached && isShell) {
                    try { event.waitUntil(revalidateShell(cache, request, cacheKey)); }
                    catch (e) { revalidateShell(cache, request, cacheKey); }
                    return cached;
                }

                const networkFetch = timedFetch(networkTarget, networkOptions)
                    .then((response) => {
                        if (isShell && response && response.ok && !response.redirected) cache.put(cacheKey, response.clone()).catch(() => {});
                        return response;
                    })
                    .catch(() => null);

                if (!cached) {
                    return networkFetch.then((response) => {
                        if (response) return response;
                        if (request.mode !== 'navigate') return Response.error();
                        return cache.match('./index.html').then((fallback) => fallback || Response.error(), () => Response.error());
                    });
                }

                return Promise.race([
                    networkFetch.then((response) => response || cached),
                    new Promise((resolve) => setTimeout(() => resolve(cached), 3000))
                ]);
            }, () => networkOnly(networkTarget, networkOptions))
        ).catch(() => networkOnly(networkTarget, networkOptions))
    );
});
