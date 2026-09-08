// ថ្នាក់៖ **URL រសើបជាប់ក្នុង Cache Storage ជារៀងរហូត**។
//
// `sw.js` ធ្លាប់ប្រើ `request` ខ្លួនវាជាកូនសោ cache សម្រាប់គ្រប់សំណើ រួមទាំង
// **navigation**។ Setup Link របស់ ZoeKeyGen មានទម្រង់
// `https://<site>/?setup=<base64 config អាជីវកម្ម>` ➜ ការបើកវាដាក់ **URL ពេញ
// ជាកូនសោ** ចូល Cache Storage។ ផល ៣៖
//   ១. `history.replaceState()` លុប URL ចេញពីរបា address តែ **មិនប៉ះ cache** ➜
//      payload នៅរស់ក្រោយអ្នកប្រើចាកចេញ ផ្ទុយនឹងច្បាប់ Setup Link របស់គម្រោង។
//   ២. អ្នកណាក៏អានវាបានតាម DevTools ➜ Application ➜ Cache Storage (ឬ
//      `caches.keys()` ក្នុង console) ដោយមិនចាំបាច់ដឹង PIN។
//   ៣. រាល់ផ្លូវ SPA ខុសៗគ្នាបង្កើត entry ថ្មី ➜ cache រីកឥតប្រយោជន៍។
//
// ដំណោះស្រាយ៖ សំណើ navigate ធម្មតា និង URL ដែលមាន payload ត្រូវប្រើ
// `./index.html` ជាកូនសោ។ ឯកសារ static ដែលរាយច្បាស់ ដូចជា guide.html អាចមាន
// កូនសោផ្ទាល់ខ្លួន ប៉ុន្តែមិនត្រូវរក្សា query string ក្នុង Cache Storage។
const fs = require('fs');
const http = require('http');
const path = require('path');
const vm = require('vm');

const ROOT = process.env.SWKEY_APP_DIR || path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
                '.json': 'application/json', '.png': 'image/png', '.wasm': 'application/wasm' };

let pass = 0, fail = 0;
function ok(label, cond, detail) {
    if (cond) { console.log('  ok    ' + label); pass++; }
    else { console.log('  FAIL  ' + label + (detail !== undefined ? '\n        ' + JSON.stringify(detail) : '')); fail++; }
}

// === ផ្នែកទី ១ — ស្តាទិច (ទាំង ២ App) ===
console.log('\n=== កូនសោ cache របស់ sw.js (ស្តាទិច) ===');
['ZoeW', 'ZoeKeyGen'].forEach((app) => {
    const sw = fs.readFileSync(path.join(ROOT, app, 'sw.js'), 'utf8');
    const fnAt = sw.indexOf('function cacheKeyFor');
    const guideAt = sw.lastIndexOf('const GUIDE_PATH', fnAt);
    const endAt = sw.indexOf('function linkIsFrugal', fnAt);
    let keys = null;
    if (fnAt !== -1 && endAt > fnAt) {
        const startAt = guideAt === -1 ? fnAt : guideAt;
        const origin = 'https://example.test/' + app + '/';
        const sandbox = {
            self: { location: { href: origin + 'sw.js' } },
            URL,
            SHELL_PATHS: new Set([new URL('app.js', origin).pathname])
        };
        vm.runInNewContext(sw.slice(startAt, endAt) + `
            result = {
                setup: cacheKeyFor({ mode: 'navigate', url: '${origin}?setup=secret' }),
                deep: cacheKeyFor({ mode: 'navigate', url: '${origin}some/deep/route' }),
                guide: cacheKeyFor({ mode: 'navigate', url: '${origin}guide.html?setup=secret' }),
                prettyGuide: cacheKeyFor({ mode: 'navigate', url: '${origin}guide' }),
                directAppJs: cacheKeyFor({ mode: 'navigate', url: '${origin}app.js' }),
                staticAppJs: cacheKeyFor({ mode: 'cors', url: '${origin}app.js?setup=static-secret' })
            };
        `, sandbox);
        keys = sandbox.result;
    }
    ok(app + '/sw.js ធ្វើឲ្យ Setup Link និងផ្លូវ SPA ប្រើកូនសោ index.html',
        !!keys && keys.setup === './index.html' && keys.deep === './index.html', keys);
    ok(app + '/sw.js មិនរក្សា query រសើបជាកូនសោ navigation',
        !!keys && (keys.guide === './index.html' || keys.guide === './guide.html'), keys);
    ok(app + '/sw.js មិនរក្សា query រសើបជាកូនសោ static shell',
        !!keys && typeof keys.staticAppJs === 'string' && keys.staticAppJs.indexOf('?') === -1,
        keys && keys.staticAppJs);
    ok(app + '/sw.js បង្វែរ navigation ត្រង់ទៅ app.js មក index.html ដដែល',
        !!keys && keys.directAppJs === './index.html', keys);
    if (app === 'ZoeW') ok('ZoeW/sw.js រក្សា guide.html និង Netlify /guide ដាច់ពី index.html',
        !!keys && keys.guide === './guide.html' && keys.prettyGuide === './guide.html', keys);
    ok(app + '/sw.js មិនប្រើ `request` ឆៅជាកូនសោ cache.put ទៀតទេ', !/cache\.put\(request,/.test(sw));
    ok(app + '/sw.js មិនប្រើ `request` ឆៅជាកូនសោ cache.match ទៀតទេ', !/cache\.match\(request\)/.test(sw));
    ok(app + '/sw.js មិន cache ការឆ្លើយតបដែល redirect', /!response\.redirected/.test(sw));
});

// === ផ្នែកទី ២ — Browser ពិត ===
let chromium;
try { chromium = require('playwright-core').chromium; } catch (e) {
    console.log('\nSKIP ផ្នែក browser — ត្រូវការ playwright-core');
    console.log('\n' + (fail ? '❌ ធ្លាក់ ' + fail + ' (ជោគជ័យ ' + pass + ')' : '✅ ជោគជ័យ ' + pass));
    process.exit(fail ? 1 : 0);
}
const CHROME = process.env.SWKEY_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
if (!fs.existsSync(CHROME)) {
    console.log('\nSKIP ផ្នែក browser — រកមិនឃើញ Chromium');
    console.log('\n' + (fail ? '❌ ធ្លាក់ ' + fail + ' (ជោគជ័យ ' + pass + ')' : '✅ ជោគជ័យ ' + pass));
    process.exit(fail ? 1 : 0);
}

// ធ្វើត្រាប់តាម Netlify៖ ផ្លូវដែលមិនមែនជាឯកសារ ➜ index.html ដោយ status 200
function serve(dir) {
    return new Promise((res) => {
        const s = http.createServer((req, rsp) => {
            let p = decodeURIComponent(req.url.split('?')[0]);
            if (p === '/') p = '/index.html';
            let f = path.join(dir, p);
            if (!f.startsWith(dir) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(dir, 'index.html');
            rsp.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'text/plain' });
            rsp.end(fs.readFileSync(f));
        });
        s.listen(0, '127.0.0.1', () => res(s));
    });
}

// payload Setup Link ពិត — config អាជីវកម្មដែលមិនត្រូវជាប់ក្នុង Cache Storage
const SETUP_JSON = JSON.stringify({
    apiKey: 'AIzaSyDEMO-secret-business-key-000',
    databaseURL: 'https://demo-biz-default-rtdb.firebaseio.com',
    projectId: 'demo-biz'
});
const SETUP_B64 = Buffer.from(SETUP_JSON, 'utf8').toString('base64');

(async () => {
    const dir = path.join(ROOT, 'ZoeW');
    const server = await serve(dir);
    const port = server.address().port;
    const origin = 'http://127.0.0.1:' + port;

    const browser = await chromium.launch({ executablePath: CHROME });
    const ctx = await browser.newContext({ viewport: { width: 412, height: 780 } });
    const page = await ctx.newPage();
    await ctx.route('**', (r) => (r.request().url().startsWith(origin) ? r.continue() : r.abort()));

    await page.goto(origin + '/', { waitUntil: 'load', timeout: 30000 });
    const swReady = await page.evaluate(async () => {
        if (!navigator.serviceWorker) return 'គ្មាន serviceWorker';
        const reg = await navigator.serviceWorker.register('./sw.js').catch((e) => String(e));
        if (typeof reg === 'string') return reg;
        // ⛔ `.ready` **គ្មានទីបញ្ចប់** បើ SW ជាប់ 'installing' ឬក្លាយជា
        // 'redundant' ដោយគ្មានអ្នកជំនួស។ `page.evaluate()` ក៏គ្មាន timeout ដែរ
        // ➜ CI ត្រូវ cancel នៅនាទីទី ៣០ ដោយគ្មានឈ្មោះ checker សោះ
        // (កើតឡើងពិត៖ `main` a465af9 · PR #96)។ រង្វិលជុំខាងក្រោមមានពិដាន
        // ស្រាប់ ➜ ការផុតកំណត់ក្លាយជាការធ្លាក់ដែលអានបាន មិនមែនការព្យួរ។
        await Promise.race([
            navigator.serviceWorker.ready,
            new Promise((r) => setTimeout(r, 20000))
        ]);
        for (let i = 0; i < 60; i++) {
            if (navigator.serviceWorker.controller) return 'ok';
            await new Promise((r) => setTimeout(r, 250));
        }
        return 'មិនចាប់យក client';
    });
    ok('service worker ចុះឈ្មោះ ហើយចាប់យក client', swReady === 'ok', swReady);

    if (swReady === 'ok') {
        await page.reload({ waitUntil: 'load', timeout: 30000 });
    }

    await page.goto(origin + '/guide', { waitUntil: 'load', timeout: 30000 });
    const guidePage = await page.evaluate(async () => {
        let cachedGuideTitle = '';
        for (const name of await caches.keys()) {
            const cache = await caches.open(name);
            const hit = await cache.match('./guide.html');
            if (hit) {
                const text = await hit.text();
                cachedGuideTitle = (text.match(/<title>([^<]*)<\/title>/i) || [])[1] || '';
                break;
            }
        }
        return {
            path: location.pathname,
            title: document.title,
            hasGuide: !!document.getElementById('main-content'),
            hasApp: !!document.getElementById('appPages'),
            controller: navigator.serviceWorker.controller && navigator.serviceWorker.controller.scriptURL,
            cachedGuideTitle
        };
    });
    ok('navigation ទៅ Netlify /guide បង្ហាញសៀវភៅ មិនមែន index.html',
        guidePage.path === '/guide' && guidePage.title === 'សៀវភៅណែនាំ ZoeW' &&
        guidePage.hasGuide && !guidePage.hasApp, guidePage);

    await page.waitForTimeout(500);
    await page.goto(origin + '/', { waitUntil: 'load', timeout: 30000 });
    await page.goto(origin + '/guide', { waitUntil: 'load', timeout: 30000 });
    const guideAfterRevalidate = await page.evaluate(() => ({
        title: document.title,
        hasGuide: !!document.getElementById('main-content'),
        hasApp: !!document.getElementById('appPages')
    }));
    ok('revalidate /guide មិនសរសេរ index.html ជាន់ guide cache',
        guideAfterRevalidate.title === 'សៀវភៅណែនាំ ZoeW' &&
        guideAfterRevalidate.hasGuide && !guideAfterRevalidate.hasApp,
        guideAfterRevalidate);

    // អ្នកប្រើបើក Setup Link ដែលអ្នកលក់ផ្ញើឲ្យ
    await page.goto(origin + '/?setup=' + encodeURIComponent(SETUP_B64), { waitUntil: 'load', timeout: 30000 });
    // ហើយបើកផ្លូវ SPA មួយទៀត (Netlify rewrite ➜ index.html ដដែល)
    await page.goto(origin + '/some/deep/route', { waitUntil: 'load', timeout: 30000 });
    await page.evaluate(() => fetch('./app.js?setup=static-secret').then((r) => r.text()));
    await page.waitForTimeout(600);

    const cacheState = await page.evaluate(async (o) => {
        const out = { keys: [], hasIndex: false };
        for (const name of await caches.keys()) {
            const c = await caches.open(name);
            for (const req of await c.keys()) out.keys.push(req.url);
            if (await c.match(o + '/index.html')) out.hasIndex = true;
        }
        return out;
    }, origin);

    const leaked = cacheState.keys.filter((u) => u.indexOf('setup=') !== -1);
    ok('**គ្មាន Setup Link ជាប់ក្នុង Cache Storage**', leaked.length === 0, leaked);
    const b64Leak = cacheState.keys.filter((u) => u.indexOf(SETUP_B64.slice(0, 24)) !== -1);
    ok('**គ្មាន payload config ជាប់ក្នុងកូនសោ cache**', b64Leak.length === 0, b64Leak);
    const spaLeak = cacheState.keys.filter((u) => u.indexOf('/some/deep/route') !== -1);
    ok('ផ្លូវ SPA មិនបង្កើត entry ថ្មីក្នុង cache', spaLeak.length === 0, spaLeak);
    const staticLeak = cacheState.keys.filter((u) => u.indexOf('static-secret') !== -1);
    ok('static shell មិនរក្សា query រសើបក្នុង cache', staticLeak.length === 0, staticLeak);
    ok('សំបក index.html នៅតែស្ថិតក្នុង cache (ក្រៅបណ្តាញនៅដើរ)', cacheState.hasIndex, cacheState.keys);

    // លុបតែ HTML ដែល cache ទុក ដើម្បីត្រាប់តាម eviction ខណៈ SW នៅ active។
    const eviction = await page.evaluate(async () => {
        let removed = 0, remaining = 0;
        for (const name of await caches.keys()) {
            const cache = await caches.open(name);
            if (await cache.delete(location.origin + '/index.html')) removed++;
            if (await cache.match(location.origin + '/index.html')) remaining++;
        }
        return { removed, remaining, controlled: !!navigator.serviceWorker.controller };
    });
    ok('សេណារីយ៉ូ eviction លុប HTML ពិត ខណៈ SW នៅ active',
        eviction.removed > 0 && eviction.remaining === 0 && eviction.controlled, eviction);
    await page.goto(origin + '/app.js?setup=asset-navigation-secret', { waitUntil: 'load', timeout: 30000 });
    const evictedNavigation = await page.evaluate(async () => {
        let cachedHtml = false;
        for (const name of await caches.keys()) {
            const cache = await caches.open(name);
            const res = await cache.match(location.origin + '/index.html');
            if (res) cachedHtml = /<html[\s>]/i.test(await res.text());
        }
        return { hasShell: !!document.getElementById('appPages'), cachedHtml };
    });
    ok('ក្រោយ HTML cache បាត់ navigation /app.js បង្ហាញ App ពិត', evictedNavigation.hasShell, evictedNavigation);
    ok('ក្រោយ eviction មិន cache JavaScript ជា index.html', evictedNavigation.cachedHtml, evictedNavigation);

    await page.goto(origin + '/', { waitUntil: 'load', timeout: 30000 });
    // ស្តារ fixture ឲ្យផ្លូវ offline ខាងក្រោមអាចវាស់ឯករាជ្យពីការធ្លាក់នេះ។
    await page.evaluate(async (o) => {
        for (const name of await caches.keys()) {
            const cache = await caches.open(name);
            await cache.delete(o + '/index.html');
        }
        const res = await fetch(o + '/index.html');
        for (const name of await caches.keys()) {
            const cache = await caches.open(name);
            await cache.put(o + '/index.html', res.clone());
        }
    }, origin);

    // ក្រៅបណ្តាញ៖ ការបើក Setup Link ត្រូវនៅតែផ្តល់សំបក App មិនមែនទំព័រទទេ
    // ⛔ `server.close(cb)` ហៅ cb តែពេល **គ្រប់ការតភ្ជាប់បិទអស់** — Chromium
    // រក្សា socket keep-alive ➜ ការរង់ចាំនេះអាចមិនចេះចប់។ បិទវាដោយបង្ខំ។
    await new Promise((r) => {
        server.close(r);
        if (typeof server.closeAllConnections === 'function') server.closeAllConnections();
    });
    await page.goto(origin + '/?setup=' + encodeURIComponent(SETUP_B64), { waitUntil: 'load', timeout: 30000 })
        .catch(() => {});
    const offlineShell = await page.evaluate(() => ({
        hasShell: !!document.getElementById('appPages'),
        appJs: typeof window.initScanEngine === 'function'
    }));
    ok('ក្រៅបណ្តាញ ៖ Setup Link នៅតែផ្តល់សំបក App ពី cache', offlineShell.hasShell && offlineShell.appJs, offlineShell);

    await ctx.close();
    await browser.close();
    console.log('\n' + (fail ? '❌ ធ្លាក់ ' + fail + ' (ជោគជ័យ ' + pass + ')' : '✅ ជោគជ័យ ' + pass));
    process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e && e.stack || e); process.exit(1); });
