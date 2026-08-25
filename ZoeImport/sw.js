const CACHE_VERSION = 'zoeimport-v1';

// ធនធាន **ស្នូល** — ប្រើ `addAll()` ដែលជា atomic៖ ធ្លាក់មួយ ➜ ធ្លាក់ទាំងក្រុម
// ➜ install បរាជ័យ ➜ SW ចាស់នៅដដែល ហើយ browser ព្យាយាមម្តងទៀត។ បើប្រើ
// `cache.add().catch(() => {})` លើគ្រប់ធនធានវិញ នោះ SW អាច activate ដោយ
// `vendor/xlsx.full.min.js` បាត់ ➜ App បើកបានធម្មតា តែការអានឯកសារ Excel
// ស្លាប់ស្ងាត់ៗពេលក្រៅបណ្តាញ។
const CORE_SHELL = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './vendor/xlsx.full.min.js'
];

// ធនធានតុបតែង — បាត់ក៏ App នៅដំណើរការគ្រប់មុខងារដដែល
const OPTIONAL_SHELL = [
    './manifest.json',
    './icon-192.png',
    './icon-512.png'
];

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
            Promise.all(keys.filter((key) => key.startsWith('zoeimport-') && key !== CACHE_VERSION).map((key) => caches.delete(key)))
        )
    );
    self.clients.claim();
});

// សំណើ navigate ត្រូវប្រើ './index.html' ជាកូនសោ cache **ជានិច្ច** ដើម្បីកុំឲ្យ
// query string ណាមួយចូល Cache Storage ហើយរស់រានក្រោយចាកចេញ។
function cacheKeyFor(request) {
    return request.mode === 'navigate' ? './index.html' : request;
}

self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;

    const cacheKey = cacheKeyFor(request);

    event.respondWith(
        caches.open(CACHE_VERSION).then((cache) =>
            cache.match(cacheKey).then((cached) => {
                const networkFetch = fetch(request)
                    .then((response) => {
                        // `redirected` មិនអាចដាក់ចូល cache បានទេ (បោះ TypeError)
                        if (response && response.ok && !response.redirected) cache.put(cacheKey, response.clone()).catch(() => {});
                        return response;
                    })
                    .catch(() => null);

                if (!cached) {
                    return networkFetch.then((response) => {
                        if (response) return response;
                        if (request.mode !== 'navigate') return Response.error();
                        // `cache.match` អាចត្រឡប់ `undefined` ➜ `respondWith(undefined)`
                        // បោះ TypeError ➜ ទំព័រទទេជំនួសសំបកដែល cache ទុក
                        return cache.match('./index.html').then((fallback) => fallback || Response.error());
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
