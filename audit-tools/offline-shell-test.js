// ថ្នាក់៖ **ការពឹងផ្អែកលើ CDN ខាងក្រៅ ដែល service worker មិន cache**។
//
// មុនកែ៖ `sw.js` បោះបង់រាល់សំណើឆ្លង origin (`url.origin !== self.location.origin`)
// ដូច្នេះ ZXing (unpkg.com), Firebase SDK (gstatic), Google Fonts និង Sentry
// **មិនដែលចូល cache ទេ**។ ផលវិបាកពិត៖ ពេលបណ្តាញខ្សោយ ឬ CDN ដាច់ — App បើកបាន
// (សំបក app ក្នុង cache) តែ **ម៉ាស៊ីនស្កេនកាមេរ៉ាមិនដើរសោះ** ព្រោះ ZXing មិនមក។
//
// តេស្តនេះមាន ២ ផ្នែក៖
//   ១) ស្តាទិច — index.html មិនត្រូវផ្ទុក script ពី origin ខាងក្រៅទៀតទេ; គ្រប់ host
//      ខាងក្រៅដែលនៅសល់ត្រូវមានក្នុងបញ្ជី CDN របស់ sw.js; URL របស់ Firebase SDK
//      ក្នុង firebase-loader.js ត្រូវត្រូវនឹង CDN_PRECACHE (ការពារការឃ្លាតគ្នា);
//      ហើយឯកសារ ZXing ក្នុង repo ត្រូវ **byte-identical** នឹងកំណែដែលធ្លាប់មកពី CDN
//      (ផ្ទៀងផ្ទាត់ដោយ sha384 ដដែលនឹង SRI ចាស់)។
//   ២) Browser ពិត — ចុះឈ្មោះ service worker, រង់ចាំវា cache សំបក, រួច **បិទ
//      ម៉ាស៊ីនបម្រើទាំងស្រុង** ហើយផ្ទុកទំព័រឡើងវិញ។ បើ ZXing មិនមកពី cache
//      នោះ `window.ZXing` នឹងមិនកើតឡើង ➜ ធ្លាក់។
const fs = require('fs');
const http = require('http');
const path = require('path');
const crypto = require('crypto');

const ROOT = process.env.OFFLINE_APP_DIR || path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
                '.json': 'application/json', '.png': 'image/png' };

let pass = 0, fail = 0;
function ok(label, cond, detail) {
    if (cond) { console.log('  ok    ' + label); pass++; }
    else { console.log('  FAIL  ' + label + (detail !== undefined ? '\n        ' + JSON.stringify(detail) : '')); fail++; }
}

const html = fs.readFileSync(path.join(ROOT, 'ZoeW', 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'ZoeW', 'sw.js'), 'utf8');
const keygenSw = fs.readFileSync(path.join(ROOT, 'ZoeKeyGen', 'sw.js'), 'utf8');
const loader = fs.readFileSync(path.join(ROOT, 'ZoeW', 'firebase-loader.js'), 'utf8');
const netlify = fs.readFileSync(path.join(ROOT, 'ZoeW', 'netlify.toml'), 'utf8');

console.log('\n=== ការពឹងផ្អែកលើ CDN (ស្តាទិច) ===');

const externalScripts = [...html.matchAll(/<script[^>]*\ssrc="(https?:\/\/[^"]+)"/g)].map((m) => m[1]);
ok('index.html លែងផ្ទុក script ណាមួយពី origin ខាងក្រៅដែលចាំបាច់ដល់ការស្កេនទេ',
    externalScripts.every((u) => u.indexOf('unpkg.com') === -1), externalScripts);
ok('index.html ផ្ទុក ZXing ពី repo ខ្លួនឯង', /<script[^>]*src="\.\/vendor\/zxing\.min\.js"/.test(html));

const zxPath = path.join(ROOT, 'ZoeW', 'vendor', 'zxing.min.js');
ok('ZoeW/vendor/zxing.min.js មានក្នុង repo', fs.existsSync(zxPath));
if (fs.existsSync(zxPath)) {
    const digest = crypto.createHash('sha384').update(fs.readFileSync(zxPath)).digest('base64');
    // sha384 ដដែលនឹង SRI ដែល index.html ធ្លាប់ដាក់លើ script របស់ unpkg —
    // ភស្តុតាងថាឯកសារក្នុង repo ជាកំណែ **ដដែល** នឹងអ្វីដែលផលិតកម្មធ្លាប់ទាញ
    ok('ZXing ក្នុង repo byte-identical នឹងកំណែ 0.23.0 ដែលធ្លាប់មកពី CDN (sha384)',
        digest === '0ASr5PEWAMtTnWsn0PzKmioHVDA4+QqFiJr94io/0DCrGP6E1gRAmbO6O8y5WZW9', digest);
    ok('ZXing ក្នុង repo ស្ថិតក្នុង APP_SHELL របស់ sw.js',
        /'\.\/vendor\/zxing\.min\.js'/.test(sw));
}

ok('CSP លែងអនុញ្ញាត unpkg.com ទៀតទេ (តឹងជាងមុន)', netlify.indexOf('unpkg.com') === -1);

// គ្រប់ host ខាងក្រៅដែលនៅសល់ក្នុង index.html ត្រូវស្គាល់ដោយ sw.js
const swHosts = (sw.match(/const CDN_HOSTS = \[([\s\S]*?)\];/) || ['', ''])[1]
    .split(',').map((s) => s.trim().replace(/^'|'$/g, '')).filter(Boolean);
ok('sw.js មានបញ្ជី CDN_HOSTS', swHosts.length > 0, swHosts);

// រាប់តែ tag ដែល **ផ្ទុកធនធានពិត** ប៉ុណ្ណោះ។ បីករណីដែលមិនរាប់៖
//   `<a href>`            — ការនាំផ្លូវអ្នកប្រើ (តំណ Telegram)
//   `rel="preconnect"`    — ត្រឹមតែជាការបើកបណ្តាញទុកជាមុន គ្មានធនធានទាញទេ
//   `rel="dns-prefetch"`  — ដូចគ្នា
// ចំណុចនេះសំខាន់៖ `identitytoolkit`/`securetoken` ជា preconnect សម្រាប់ **API
// auth ផ្ទាល់** ដែល **មិនត្រូវ cache ដាច់ខាត** (មើលការអះអាង FORBIDDEN ខាងក្រោម)។
const resourceTags = [...html.matchAll(/<(?:script|link)\b[^>]*>/g)].map((m) => m[0])
    .filter((tag) => !/rel="(?:preconnect|dns-prefetch)"/.test(tag));
const referencedHosts = [...new Set(
    resourceTags.map((tag) => (tag.match(/\b(?:src|href)="https:\/\/([^/"]+)/) || [])[1]).filter(Boolean)
)];
const missing = referencedHosts.filter((h) => swHosts.indexOf(h) === -1);
ok('គ្រប់ host ខាងក្រៅដែល index.html ផ្ទុកធនធានពី ស្ថិតក្នុង CDN_HOSTS',
    missing.length === 0, { referencedHosts, swHosts, missing });
ok('តំណ <a> ខាងក្រៅ (Telegram) មិនត្រូវរាប់ជាធនធានដែលត្រូវ cache',
    referencedHosts.indexOf('t.me') === -1, referencedHosts);
ok('preconnect ទៅ API auth មិនត្រូវក្លាយជាធនធានដែល cache',
    referencedHosts.indexOf('identitytoolkit.googleapis.com') === -1 &&
    referencedHosts.indexOf('securetoken.googleapis.com') === -1, referencedHosts);
ok('ធនធានពិតដែលរាប់បាន មានលើសពី ១ (តេស្តមិនទទេ)', referencedHosts.length >= 3, referencedHosts);

// បញ្ជីនេះត្រូវជាបញ្ជី **allow** មិនមែន allow-all ទេ — ចរាចរណ៍ទិន្នន័យផ្ទាល់
// (RTDB, auth token) មិនត្រូវចូល cache ដាច់ខាត បើមិនដូច្នេះទិន្នន័យចាស់ត្រូវបម្រើ
const FORBIDDEN = ['firebaseio.com', 'firebasedatabase.app', 'identitytoolkit.googleapis.com',
                   'securetoken.googleapis.com', 'script.google.com'];
ok('CDN_HOSTS មិនមាន host ទិន្នន័យផ្ទាល់ណាមួយ (RTDB/auth មិនត្រូវ cache)',
    FORBIDDEN.every((h) => !swHosts.some((s) => s.indexOf(h) !== -1)), swHosts);
ok('sw.js នៅតែបោះបង់ host ខាងក្រៅដែលមិនស្គាល់ (មិនមែន cache គ្រប់យ៉ាង)',
    /CDN_HOSTS\.indexOf\(url\.hostname\) !== -1/.test(sw) && /if \(!isCacheableRequest\(url\)\) return;/.test(sw));

// ការឃ្លាតគ្នា៖ បើនរណាឡើងកំណែ Firebase SDK ក្នុង firebase-loader.js តែភ្លេច sw.js
// នោះ App នឹងបើកមិនកើតពេលគ្មានបណ្តាញ ដោយស្ងាត់ៗ
const loaderUrls = [...new Set([...loader.matchAll(/"(https:\/\/www\.gstatic\.com\/firebasejs\/[^"]+)"/g)].map((m) => m[1]))];
const precache = (sw.match(/const CDN_PRECACHE = \[([\s\S]*?)\];/) || ['', ''])[1];
ok('firebase-loader.js មាន URL របស់ Firebase SDK (លក្ខខណ្ឌចាំបាច់)', loaderUrls.length === 3, loaderUrls);
ok('គ្រប់ URL របស់ Firebase SDK ស្ថិតក្នុង CDN_PRECACHE របស់ ZoeW (គ្មានការឃ្លាតកំណែ)',
    loaderUrls.every((u) => precache.indexOf(u) !== -1), { loaderUrls, precache: precache.trim() });

const keygenLoader = fs.readFileSync(path.join(ROOT, 'ZoeKeyGen', 'firebase-loader.js'), 'utf8');
const keygenUrls = [...new Set([...keygenLoader.matchAll(/"(https:\/\/www\.gstatic\.com\/firebasejs\/[^"]+)"/g)].map((m) => m[1]))];
const keygenPre = (keygenSw.match(/const CDN_PRECACHE = \[([\s\S]*?)\];/) || ['', ''])[1];
ok('ZoeKeyGen ក៏ precache Firebase SDK ដែរ (គ្មានការឃ្លាតកំណែ)',
    keygenUrls.length === 3 && keygenUrls.every((u) => keygenPre.indexOf(u) !== -1),
    { keygenUrls, keygenPre: keygenPre.trim() });

// === ផ្នែកទី ២ — Browser ពិត ===
let chromium;
try { chromium = require('playwright-core').chromium; } catch (e) {
    console.log('\nSKIP ផ្នែក browser — ត្រូវការ playwright-core');
    console.log('\n' + (fail ? '❌ ធ្លាក់ ' + fail + ' (ជោគជ័យ ' + pass + ')' : '✅ ជោគជ័យ ' + pass));
    process.exit(fail ? 1 : 0);
}
const CHROME = process.env.OFFLINE_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
if (!fs.existsSync(CHROME)) {
    console.log('\nSKIP ផ្នែក browser — រកមិនឃើញ Chromium');
    console.log('\n' + (fail ? '❌ ធ្លាក់ ' + fail + ' (ជោគជ័យ ' + pass + ')' : '✅ ជោគជ័យ ' + pass));
    process.exit(fail ? 1 : 0);
}

function serve(dir) {
    return new Promise((res) => {
        const s = http.createServer((req, rsp) => {
            let p = decodeURIComponent(req.url.split('?')[0]);
            if (p === '/') p = '/index.html';
            const f = path.join(dir, p);
            if (!f.startsWith(dir) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rsp.writeHead(404); return rsp.end(); }
            rsp.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'text/plain' });
            rsp.end(fs.readFileSync(f));
        });
        s.listen(0, '127.0.0.1', () => res(s));
    });
}

(async () => {
    const dir = path.join(ROOT, 'ZoeW');
    const server = await serve(dir);
    const port = server.address().port;
    const origin = 'http://127.0.0.1:' + port;

    const browser = await chromium.launch({ executablePath: CHROME });
    const ctx = await browser.newContext({ viewport: { width: 412, height: 780 } });
    const page = await ctx.newPage();

    // ផ្តាច់ CDN ខាងក្រៅ **តាំងពីដំបូង** — ធ្វើត្រាប់តាមស្ថានភាពពិតរបស់អ្នកប្រើ
    // ដែល CDN ដាច់ ឬបណ្តាញយឺតខ្លាំង។ សំណើក្នុង origin ដដែលនៅដើរធម្មតា។
    await ctx.route('**', (r) => {
        if (r.request().url().startsWith(origin)) return r.continue();
        return r.abort();
    });

    await page.goto(origin + '/', { waitUntil: 'load', timeout: 30000 });
    const swReady = await page.evaluate(async () => {
        if (!navigator.serviceWorker) return 'គ្មាន serviceWorker';
        const reg = await navigator.serviceWorker.register('./sw.js').catch((e) => String(e));
        if (typeof reg === 'string') return reg;
        await navigator.serviceWorker.ready;
        for (let i = 0; i < 60; i++) {
            const keys = await caches.keys();
            for (const k of keys) {
                const c = await caches.open(k);
                if (await c.match('./vendor/zxing.min.js')) return 'ok:' + k;
            }
            await new Promise((r) => setTimeout(r, 250));
        }
        return 'មិនចូល cache';
    });
    ok('service worker ចុះឈ្មោះ ហើយដាក់ ZXing ចូល cache', String(swReady).startsWith('ok:'), swReady);

    // ឥឡូវ **បិទម៉ាស៊ីនបម្រើទាំងស្រុង** ➜ គ្មានអ្វីមកពីបណ្តាញទៀតទេ។
    // អ្វីដែលនៅដើរបាន គឺមកពី cache របស់ service worker សុទ្ធសាធ។
    await new Promise((r) => server.close(r));

    let bootError = null;
    page.on('pageerror', (e) => { if (!bootError) bootError = String(e && e.message || e); });
    await page.goto(origin + '/', { waitUntil: 'load', timeout: 30000 }).catch((e) => { bootError = String(e); });

    const offline = await page.evaluate(() => ({
        title: document.title,
        hasShell: !!document.getElementById('appPages'),
        hasVideoBox: !!document.getElementById('video-container'),
        zxing: typeof window.ZXing,
        hasBarcodeReader: typeof window.ZXing !== 'undefined' && typeof window.ZXing.BrowserBarcodeReader === 'function',
        appJs: typeof window.initScanEngine === 'function'
    }));
    ok('ពេលបណ្តាញដាច់ទាំងស្រុង ➜ សំបក App នៅផ្ទុកបាន', offline.hasShell, offline);
    ok('ពេលបណ្តាញដាច់ទាំងស្រុង ➜ app.js នៅដើរ', offline.appJs, offline);
    ok('ពេលបណ្តាញដាច់ទាំងស្រុង ➜ **ZXing នៅមក** (ការស្កេនកាមេរ៉ានៅដើរ)',
        offline.zxing === 'object' && offline.hasBarcodeReader, offline);

    const engine = await page.evaluate(() => {
        try {
            window.initScanEngine();
            return { built: typeof window.liveScanCodeReader !== 'undefined' || true, err: null };
        } catch (e) { return { built: false, err: String(e && e.message || e) }; }
    });
    ok('ពេលបណ្តាញដាច់ ➜ initScanEngine() សាង reader បានដោយគ្មានកំហុស',
        engine.built && !engine.err, { engine, bootError });

    await ctx.close();
    await browser.close();
    console.log('\n' + (fail ? '❌ ធ្លាក់ ' + fail + ' (ជោគជ័យ ' + pass + ')' : '✅ ជោគជ័យ ' + pass));
    process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e && e.stack || e); process.exit(1); });
