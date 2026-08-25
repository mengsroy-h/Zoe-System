const CACHE_VERSION = 'zoekeygen-v59';

// ធនធាន **ស្នូល** — បើមួយណាមិនចូល cache នោះ install ត្រូវ **ធ្លាក់** ដើម្បី
// កុំឲ្យ SW ចាប់យក client ដោយសំបកខូច (ឧ. `qrcode.js` បាត់ ➜ QR របស់
// Setup Link គូរមិនចេញ ខណៈ App មើលទៅដំណើរការធម្មតា)។
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

// ធនធានតុបតែង — បាត់ក៏ App នៅដំណើរការគ្រប់មុខងារដដែល
const OPTIONAL_SHELL = [
    './manifest.json',
    './icon-192.png',
    './icon-512.png'
];

// សំណុំផ្លូវរបស់សំបក — ជាអ្នកកំណត់ **ទាំង** អ្វីដែលឆ្លើយតបពី cache មុន
// **និង** អ្វីដែលអនុញ្ញាតឲ្យសរសេរចូល Cache Storage។ ការកំណត់ព្រំដែននេះ
// ធ្វើឲ្យសំណើ same-origin ណាមួយក្រៅបញ្ជីនេះ (ឧ. endpoint ទិន្នន័យនៅថ្ងៃក្រោយ)
// **មិនអាចធ្លាក់ចូល cache ដោយចៃដន្យ** ហើយរស់រានក្រោយចាកចេញបានទេ។
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

// សំណើ navigate ត្រូវប្រើ './index.html' ជាកូនសោ cache **ជានិច្ច**។ បើទុក
// `request` ជាកូនសោ នោះ URL ពេញ រួមទាំង `?setup=<config អាជីវកម្ម>` ចូល
// Cache Storage ➜ វា **រស់រានក្រោយចាកចេញ** (ផ្ទុយនឹងច្បាប់ Setup Link) ហើយ
// អានបានតាម DevTools ➜ Application ➜ Cache Storage។ ការឆ្លើយតបគឺ index.html
// ដដែលសម្រាប់គ្រប់ផ្លូវ (Netlify rewrite) ដូច្នេះកូនសោតែមួយត្រឹមត្រូវ។
function cacheKeyFor(request) {
    return request.mode === 'navigate' ? './index.html' : request;
}

// ការធ្វើឲ្យស្រស់ខាងក្រោយ — **មិនត្រូវរង់ចាំវាមុនឆ្លើយតបឡើយ**។ សម្រាប់សំណើ
// navigate យើងទាញ './index.html' ត្រង់ៗ ជំនួសការផ្ញើ URL ពេញ (ដែលអាចផ្ទុក
// query string រសើប) ទៅម៉ាស៊ីនបម្រើម្តងទៀត។
function revalidateShell(cache, request, cacheKey) {
    if (navigator.onLine === false) return Promise.resolve();
    const target = cacheKey === './index.html' ? './index.html' : request;
    return fetch(target)
        .then((response) => {
            if (response && response.ok && !response.redirected) return cache.put(cacheKey, response.clone()).catch(() => {});
        })
        .catch(() => {});
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
                // **សំបកដែល cache ទុក ត្រូវឆ្លើយតបភ្លាម។** មុននេះរាល់ធនធាន
                // ប្រណាំងនឹងបណ្តាញ ៣ វិនាទី ➜ លើបណ្តាញខ្សោយ ការពន្យារនោះ
                // **គុណតាមខ្សែសង្វាក់ផ្ទុក** (index.html ➜ script ➜ …) ➜ វាស់
                // បាន **៩ វិនាទី** ដើម្បីបើក App ខណៈគ្រប់ឯកសារនៅក្នុង cache
                // រួចស្រេច។ កំណែថ្មីរបស់សំបកមកតាមផ្លូវ `CACHE_VERSION` (install
                // ទាញឡើងវិញទាំងអស់) មិនមែនតាមការប្រណាំងក្នុងមួយសំណើទេ។
                if (cached && isShell) {
                    try { event.waitUntil(revalidateShell(cache, request, cacheKey)); }
                    catch (e) { revalidateShell(cache, request, cacheKey); }
                    return cached;
                }

                const networkFetch = fetch(request)
                    .then((response) => {
                        // `redirected` មិនអាចដាក់ចូល cache បានទេ (បោះ TypeError)
                        // ហើយវាក៏មិនមែនជាសំបកត្រឹមត្រូវសម្រាប់កូនសោ navigate ដែរ។
                        if (isShell && response && response.ok && !response.redirected) cache.put(cacheKey, response.clone()).catch(() => {});
                        return response;
                    })
                    .catch(() => null);

                if (!cached) {
                    return networkFetch.then((response) => {
                        if (response) return response;
                        if (request.mode !== 'navigate') return Response.error();
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
