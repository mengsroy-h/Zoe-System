const CACHE_VERSION = 'zoew-v92';

// ធនធាន **ស្នូល** — បើមួយណាមិនចូល cache នោះ install ត្រូវ **ធ្លាក់** ដើម្បី
// កុំឲ្យ SW ចាប់យក client ដោយសំបកខូច។ មុននេះគ្រប់ធនធានប្រើ
// `cache.add(url).catch(() => {})` ➜ ការបរាជ័យត្រូវលេប ➜ SW activate ដោយ
// `zxing_reader.wasm` បាត់ ➜ **App បើកបានធម្មតា តែការស្កេនស្លាប់ស្ងាត់ៗ
// ពេលបណ្តាញដាច់** — ជាថ្នាក់កំហុសដដែលដែលការនាំ ZXing ចូល repo ដោះស្រាយ។
// `addAll()` ជា atomic៖ ធ្លាក់មួយ ➜ ធ្លាក់ទាំងក្រុម ➜ SW ចាស់នៅដដែល
// ហើយ browser នឹងព្យាយាមម្តងទៀតលើកក្រោយ។
const CORE_SHELL = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './firebase-loader.js',
    './license-verify.js',
    './error-reporting.js',
    './vendor/zxing-wasm.js',
    './vendor/zxing_reader.wasm'
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
            Promise.all(keys.filter((key) => (key.startsWith('zoew-') || key.startsWith('zoeadmin-')) && key !== CACHE_VERSION).map((key) => caches.delete(key)))
        )
    );
    self.clients.claim();
});

// សំណើ navigate ត្រូវប្រើ './index.html' ជាកូនសោ cache **ជានិច្ច**។ បើទុក
// `request` ជាកូនសោ នោះ URL ពេញ រួមទាំង `?setup=<config អាជីវកម្ម>` ចូល
// Cache Storage ➜ វា **រស់រានក្រោយចាកចេញ** (ផ្ទុយនឹងច្បាប់ Setup Link) ហើយ
// អានបានតាម DevTools ➜ Application ➜ Cache Storage។ ការឆ្លើយតបគឺ index.html
// ដដែលសម្រាប់គ្រប់ផ្លូវ (Netlify rewrite) ដូច្នេះកូនសោតែមួយត្រឹមត្រូវ។
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
                        // ហើយវាក៏មិនមែនជាសំបកត្រឹមត្រូវសម្រាប់កូនសោ navigate ដែរ។
                        if (response && response.ok && !response.redirected) cache.put(cacheKey, response.clone()).catch(() => {});
                        return response;
                    })
                    .catch(() => null);

                if (!cached) {
                    return networkFetch.then((response) => {
                        if (response) return response;
                        if (request.mode !== 'navigate') return Response.error();
                        // `caches.match` អាចត្រឡប់ `undefined` ➜ `respondWith(undefined)`
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
