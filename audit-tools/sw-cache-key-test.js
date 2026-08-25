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
// ដំណោះស្រាយ៖ សំណើ navigate ត្រូវប្រើ `./index.html` ជាកូនសោ **ជានិច្ច** —
// ការឆ្លើយតបគឺ index.html ដដែលសម្រាប់គ្រប់ផ្លូវ (Netlify rewrite)។
const fs = require('fs');
const http = require('http');
const path = require('path');

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
    ok(app + '/sw.js ធ្វើឲ្យកូនសោ navigate ធម្មតា', /request\.mode === 'navigate' \? '\.\/index\.html'/.test(sw));
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
        await navigator.serviceWorker.ready;
        for (let i = 0; i < 60; i++) {
            if (navigator.serviceWorker.controller) return 'ok';
            await new Promise((r) => setTimeout(r, 250));
        }
        return 'មិនចាប់យក client';
    });
    ok('service worker ចុះឈ្មោះ ហើយចាប់យក client', swReady === 'ok', swReady);

    // អ្នកប្រើបើក Setup Link ដែលអ្នកលក់ផ្ញើឲ្យ
    await page.goto(origin + '/?setup=' + encodeURIComponent(SETUP_B64), { waitUntil: 'load', timeout: 30000 });
    // ហើយបើកផ្លូវ SPA មួយទៀត (Netlify rewrite ➜ index.html ដដែល)
    await page.goto(origin + '/some/deep/route', { waitUntil: 'load', timeout: 30000 });
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
    ok('សំបក index.html នៅតែស្ថិតក្នុង cache (ក្រៅបណ្តាញនៅដើរ)', cacheState.hasIndex, cacheState.keys);

    // ក្រៅបណ្តាញ៖ ការបើក Setup Link ត្រូវនៅតែផ្តល់សំបក App មិនមែនទំព័រទទេ
    await new Promise((r) => server.close(r));
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
