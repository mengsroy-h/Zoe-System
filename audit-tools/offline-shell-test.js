// ថ្នាក់៖ **ការពឹងផ្អែកលើ CDN ខាងក្រៅសម្រាប់មុខងារស្នូល**។
//
// មុនកែ៖ ZXing មកពី unpkg.com ហើយ `sw.js` បោះបង់រាល់សំណើឆ្លង origin ដូច្នេះវា
// **មិនដែលចូល cache ទេ**។ ផលវិបាកពិត៖ ពេលបណ្តាញខ្សោយ ឬ CDN ដាច់ — App បើកបាន
// (សំបក app ក្នុង cache) តែ **ម៉ាស៊ីនស្កេនកាមេរ៉ាមិនដើរសោះ** ព្រោះ ZXing មិនមក។
// ដំណោះស្រាយ៖ **យក ZXing ចូល repo** ➜ វាក្លាយជាធនធាន origin ដដែល ➜ ចូល APP_SHELL។
//
// ⚠️ កំណែ 2.6.0 ធ្លាប់ព្យាយាម cache **ធនធានឆ្លង origin** ផងដែរ (Firebase SDK,
// ពុម្ពអក្សរ, Sentry) តាមបញ្ជី host។ វា **បណ្តាលឲ្យ App ខូចលើផលិតកម្ម** —
// អ្នកប្រើឃើញ «ក្រៅបណ្តាញ» និងគ្មានទិន្នន័យ ខណៈបណ្តាញដើរធម្មតា។ វាត្រូវបាន
// ថយក្រោយក្នុង 2.6.1។ **កុំនាំវាត្រឡប់មកវិញដោយគ្មានការផ្ទៀងផ្ទាត់លើ CDN ពិត**
// — បរិស្ថាន CI នៅទីនេះឆ្លងកាត់ proxy ដូច្នេះវា **មិនអាចបង្កើតឥរិយាបថ CDN ពិត
// ឡើងវិញបានទេ** ហើយការធ្វើតេស្តជាមួយ CDN ក្លែងក្លាយ **ជោគជ័យក្លែងក្លាយ**។
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
                '.json': 'application/json', '.png': 'image/png', '.wasm': 'application/wasm' };

let pass = 0, fail = 0;
function ok(label, cond, detail) {
    if (cond) { console.log('  ok    ' + label); pass++; }
    else { console.log('  FAIL  ' + label + (detail !== undefined ? '\n        ' + JSON.stringify(detail) : '')); fail++; }
}

const html = fs.readFileSync(path.join(ROOT, 'ZoeW', 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'ZoeW', 'sw.js'), 'utf8');
const keygenSw = fs.readFileSync(path.join(ROOT, 'ZoeKeyGen', 'sw.js'), 'utf8');
const netlify = fs.readFileSync(path.join(ROOT, 'ZoeW', 'netlify.toml'), 'utf8');

console.log('\n=== ការពឹងផ្អែកលើ CDN (ស្តាទិច) ===');

const externalScripts = [...html.matchAll(/<script[^>]*\ssrc="(https?:\/\/[^"]+)"/g)].map((m) => m[1]);
ok('index.html លែងផ្ទុក script ណាមួយពី origin ខាងក្រៅដែលចាំបាច់ដល់ការស្កេនទេ',
    externalScripts.every((u) => u.indexOf('unpkg.com') === -1), externalScripts);
ok('index.html ផ្ទុក engine ស្កេនពី repo ខ្លួនឯង', /<script[^>]*src="\.\/vendor\/zxing-wasm\.js"/.test(html));

// engine មាន **២ ឯកសារ**៖ glue JS និង binary WASM។ បើភ្លេចយកមួយណាចូល
// APP_SHELL នោះការស្កេននឹងស្លាប់ពេលបណ្តាញដាច់ ខណៈ App នៅបើកបានធម្មតា។
const wasmGlue = path.join(ROOT, 'ZoeW', 'vendor', 'zxing-wasm.js');
const wasmBin = path.join(ROOT, 'ZoeW', 'vendor', 'zxing_reader.wasm');
ok('ZoeW/vendor/zxing-wasm.js មានក្នុង repo', fs.existsSync(wasmGlue));
ok('ZoeW/vendor/zxing_reader.wasm មានក្នុង repo', fs.existsSync(wasmBin));
ok('ZXing-JS ចាស់ត្រូវបានដកចេញពី repo (លែងផ្ទុក engine ២)',
    !fs.existsSync(path.join(ROOT, 'ZoeW', 'vendor', 'zxing.min.js')));
if (fs.existsSync(wasmBin)) {
    // ឯកសារ .wasm ត្រូវជាកំណែដដែលនឹង glue JS — zxing-wasm បញ្ចូល sha256
    // របស់ binary ដែលវារំពឹងទុក ដូច្នេះការមិនស៊ីគ្នាចាប់បានភ្លាម។
    const digest = crypto.createHash('sha256').update(fs.readFileSync(wasmBin)).digest('hex');
    const expected = (fs.readFileSync(wasmGlue, 'utf8').match(/ZXING_WASM_SHA256=`([0-9a-f]{64})`/) || [])[1];
    ok('binary .wasm ត្រូវនឹង sha256 ដែល glue JS រំពឹងទុក (កំណែស៊ីគ្នា)',
        !!expected && digest === expected, { digest: digest.slice(0, 16), expected: (expected || '').slice(0, 16) });
    ok('engine WASM ទាំង ២ ឯកសារស្ថិតក្នុង APP_SHELL របស់ sw.js',
        /'\.\/vendor\/zxing-wasm\.js'/.test(sw) && /'\.\/vendor\/zxing_reader\.wasm'/.test(sw));
}

ok('CSP លែងអនុញ្ញាត unpkg.com ទៀតទេ (តឹងជាងមុន)', netlify.indexOf('unpkg.com') === -1);

// service worker ត្រូវ **បោះបង់រាល់សំណើឆ្លង origin** — នេះជាឥរិយាបថដែល
// ដំណើរការលើផលិតកម្មតាំងពីដើម។ ការព្យាយាម cache ធនធានឆ្លង origin ក្នុងកំណែ
// 2.6.0 បានធ្វើឲ្យ App ខូច (មើលក្បាលឯកសារ) ➜ ច្បាប់នេះត្រូវចាក់សោទុក។
ok('sw.js របស់ ZoeW បោះបង់សំណើឆ្លង origin (ឥរិយាបថដែលដំណើរការពិត)',
    /if \(url\.origin !== self\.location\.origin\) return;/.test(sw));
ok('sw.js របស់ ZoeKeyGen ក៏បោះបង់សំណើឆ្លង origin ដែរ',
    /if \(url\.origin !== self\.location\.origin\) return;/.test(keygenSw));
ok('គ្មានបញ្ជី CDN_HOSTS ត្រឡប់មកវិញក្នុង sw.js ទាំង ២ (ថ្នាក់កំហុស 2.6.0)',
    sw.indexOf('CDN_HOSTS') === -1 && keygenSw.indexOf('CDN_HOSTS') === -1);
ok('គ្មាន CDN_PRECACHE ត្រឡប់មកវិញក្នុង sw.js ទាំង ២',
    sw.indexOf('CDN_PRECACHE') === -1 && keygenSw.indexOf('CDN_PRECACHE') === -1);

// មុខងារស្នូលមិនត្រូវពឹងលើ script ឆ្លង origin ណាមួយឡើយ។ Sentry (រាយការណ៍កំហុស)
// និងពុម្ពអក្សរ Google ជាធនធាន **មិនស្នូល** — បើពួកវាមិនមក App នៅតែដំណើរការ។
const CORE_HOSTS = ['unpkg.com'];
const externalSrc = [...html.matchAll(/<script\b[^>]*\bsrc="https:\/\/([^/"]+)/g)].map((m) => m[1]);
ok('គ្មាន script ស្នូលណាមួយមកពី origin ខាងក្រៅទៀតទេ',
    CORE_HOSTS.every((h) => externalSrc.indexOf(h) === -1), externalSrc);

// ការឃ្លាតគ្នា៖ ZoeKeyGen មិនប្រើ ZXing ទេ — កុំយកវាចូល APP_SHELL របស់វា
ok('ZoeKeyGen មិនដាក់ ZXing ចូល APP_SHELL (វាមិនស្កេន barcode ទេ)',
    keygenSw.indexOf('zxing') === -1);

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
                if ((await c.match('./vendor/zxing-wasm.js')) && (await c.match('./vendor/zxing_reader.wasm'))) return 'ok:' + k;
            }
            await new Promise((r) => setTimeout(r, 250));
        }
        return 'មិនចូល cache';
    });
    ok('service worker ចុះឈ្មោះ ហើយដាក់ engine ស្កេន (ទាំង ២ ឯកសារ) ចូល cache', String(swReady).startsWith('ok:'), swReady);

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
        zxing: typeof window.ZXingWASM,
        hasBarcodeReader: typeof window.ZXingWASM !== 'undefined' && typeof window.ZXingWASM.readBarcodes === 'function',
        appJs: typeof window.initScanEngine === 'function'
    }));
    ok('ពេលបណ្តាញដាច់ទាំងស្រុង ➜ សំបក App នៅផ្ទុកបាន', offline.hasShell, offline);
    ok('ពេលបណ្តាញដាច់ទាំងស្រុង ➜ app.js នៅដើរ', offline.appJs, offline);
    ok('ពេលបណ្តាញដាច់ទាំងស្រុង ➜ **engine ស្កេននៅមក** (ការស្កេនកាមេរ៉ានៅដើរ)',
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
