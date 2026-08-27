const CACHE_VERSION = 'zoew-v116';

const CORE_SHELL = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './boot-flags.js',
    './firebase-loader.js',
    './license-verify.js',
    './error-reporting.js',
    './vendor/zxing-wasm.js',
    './vendor/zxing_reader.wasm'
];

const OPTIONAL_SHELL = [
    './vendor/xlsx.full.min.js',
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
            Promise.all(keys.filter((key) => (key.startsWith('zoew-') || key.startsWith('zoeadmin-')) && key !== CACHE_VERSION).map((key) => caches.delete(key)))
        ).then(() => self.clients.claim())
    );
});

function cacheKeyFor(request) {
    return request.mode === 'navigate' ? './index.html' : request;
}

function linkIsFrugal() {
    const link = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (!link) return false;
    if (link.saveData === true) return true;
    const type = String(link.effectiveType || '');
    return type === 'slow-2g' || type === '2g';
}

const REVALIDATE_TIMEOUT_MS = 6000;
const REVALIDATE_MAX_IN_FLIGHT = 4;
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

    const target = cacheKey === './index.html' ? './index.html' : request;
    return fetch(target, controller ? { signal: controller.signal } : undefined).then((response) => {
        if (!response || !response.ok || response.redirected) { release(); return; }
        return cache.put(cacheKey, response.clone()).then(release, release);
    }, release);
}

function networkOnly(request) {
    return fetch(request).then((response) => response || Response.error(), () => Response.error());
}

self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;

    const cacheKey = cacheKeyFor(request);
    const isShell = cacheKey === './index.html' || SHELL_PATHS.has(url.pathname);

    event.respondWith(
        caches.open(CACHE_VERSION).then((cache) =>
            cache.match(cacheKey).then((cached) => {
                if (cached && isShell) {
                    try { event.waitUntil(revalidateShell(cache, request, cacheKey)); }
                    catch (e) { revalidateShell(cache, request, cacheKey); }
                    return cached;
                }

                const networkFetch = fetch(request)
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
            }, () => networkOnly(request))
        ).catch(() => networkOnly(request))
    );
});
