const CACHE_VERSION = 'zoekeygen-v38';

const APP_SHELL = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './firebase-loader.js',
    './license-verify.js',
    './error-reporting.js',
    './qrcode.js',
    './manifest.json',
    './icon-192.png',
    './icon-512.png'
];

const CDN_HOSTS = [
    'www.gstatic.com',
    'fonts.googleapis.com',
    'fonts.gstatic.com',
    'js.sentry-cdn.com',
    'browser.sentry-cdn.com'
];

const CDN_PRECACHE = [
    'https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js',
    'https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js',
    'https://www.gstatic.com/firebasejs/12.17.1/firebase-database.js',
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Kantumruy+Pro:wght@400;500;600;700&display=swap',
    'https://js.sentry-cdn.com/f03cf063db8e4b61057c43271019892d.min.js'
];

function isCacheableRequest(url) {
    if (url.origin === self.location.origin) return true;
    return CDN_HOSTS.indexOf(url.hostname) !== -1;
}

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_VERSION)
            .then((cache) => Promise.all(
                APP_SHELL.concat(CDN_PRECACHE).map((url) => cache.add(url).catch(() => {}))
            ))
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((key) => key.startsWith('zoekeygen-') && key !== CACHE_VERSION).map((key) => caches.delete(key)))
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);
    if (!isCacheableRequest(url)) return;

    event.respondWith(
        caches.open(CACHE_VERSION).then((cache) =>
            cache.match(request).then((cached) => {
                const networkFetch = fetch(request)
                    .then((response) => {
                        if (response && response.ok) cache.put(request, response.clone()).catch(() => {});
                        return response;
                    })
                    .catch(() => null);

                if (!cached) {
                    return networkFetch.then((response) => {
                        if (response) return response;
                        if (request.mode === 'navigate') return caches.match('./index.html');
                        return Response.error();
                    });
                }

                return Promise.race([
                    networkFetch.then((response) => response || cached),
                    new Promise((resolve) => setTimeout(() => resolve(cached), 3000))
                ]);
            })
        )
    );
});
