// ថ្នាក់កំហុស៖ **service worker activate ដោយ APP_SHELL មិនពេញ**។
//
// `install` ប្រើ `cache.add(url).catch(() => {})` ➜ **រាល់ការបរាជ័យត្រូវលេប**។
// បើបណ្តាញដាច់ ឬយឺតកណ្តាល install (ជារឿងធម្មតាលើទូរស័ព្ទ) នោះឯកសារខ្លះ
// មិនចូល cache ខណៈ SW **activate ដោយជោគជ័យ** ហើយចាប់យក client។
// លទ្ធផលពិត៖ App បើកបានធម្មតា តែ `zxing_reader.wasm` បាត់ ➜ **ការស្កេន
// កាមេរ៉ាស្លាប់ស្ងាត់ៗពេលបណ្តាញដាច់** — ជាថ្នាក់កំហុសដដែលដែល CLAUDE.md
// ព្រមានផ្ទាល់ («បាត់មួយណា ➜ ការស្កេនស្លាប់ ខណៈ App នៅបើកបានធម្មតា»)។
//
// `offline-shell-test.js` មិនចាប់វាទេ ព្រោះវាតេស្តតែផ្លូវដែល install
// **ជោគជ័យទាំងស្រុង**។ តេស្តនេះធ្វើឲ្យធនធានស្នូលបរាជ័យដោយចេតនា រួច
// អះអាងថា SW **បដិសេធ install** ជំនួសការ activate ដោយសំបកខូច។
const fs = require('fs'), http = require('http'), path = require('path');
const ROOT = process.env.SWINTEG_APP_DIR || path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm', '.png': 'image/png' };

let pass = 0, fail = 0;
function ok(label, cond, detail) {
    if (cond) { pass++; console.log('   ok    ' + label); }
    else { fail++; console.log('   FAIL  ' + label + (detail !== undefined ? '\n         ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : '')); }
}

// === ផ្នែកទី ១ — រចនាសម្ព័ន្ធ sw.js ===
for (const app of ['ZoeW', 'ZoeKeyGen']) {
    const sw = fs.readFileSync(path.join(ROOT, app, 'sw.js'), 'utf8');
    ok(app + ': sw.js បែងចែកធនធានស្នូល ដែលការបរាជ័យត្រូវធ្វើឲ្យ install ធ្លាក់',
        /CORE_SHELL/.test(sw), 'រកមិនឃើញ CORE_SHELL');
    ok(app + ': ធនធានស្នូលមិនលេបការបរាជ័យទេ (គ្មាន .catch ទទេលើផ្លូវស្នូល)',
        /CORE_SHELL[\s\S]{0,400}?cache\.addAll\(/.test(sw) ||
        /addAll\(CORE_SHELL\)/.test(sw), 'ធនធានស្នូលត្រូវប្រើ addAll ដែលធ្លាក់ជាក្រុម');
}
{
    const sw = fs.readFileSync(path.join(ROOT, 'ZoeW', 'sw.js'), 'utf8');
    const core = /const CORE_SHELL = \[([\s\S]*?)\];/.exec(sw);
    const list = core ? core[1] : '';
    for (const need of ['./index.html', './app.js', './style.css', './vendor/zxing-wasm.js', './vendor/zxing_reader.wasm', './license-verify.js', './firebase-loader.js']) {
        ok('ZoeW: «' + need + '» ជាធនធានស្នូល (បាត់ ➜ install ត្រូវធ្លាក់)',
            list.indexOf("'" + need + "'") !== -1, list.trim().slice(0, 200));
    }
    ok('ZoeW: navigate fallback មិនអាចត្រឡប់ undefined ចូល respondWith',
        !/return caches\.match\('\.\/index\.html'\);/.test(sw),
        'caches.match អាចត្រឡប់ undefined ➜ respondWith(undefined) បោះ TypeError');
}

// === ផ្នែកទី ២ — Browser ពិត ===
let chromium;
try { chromium = require('playwright-core').chromium; } catch (e) {
    console.log('\nSKIP ផ្នែក browser — ត្រូវការ playwright-core');
    console.log('\n' + (fail ? '❌ ធ្លាក់ ' + fail + ' (ជោគជ័យ ' + pass + ')' : '✅ ជោគជ័យ ' + pass));
    process.exit(fail ? 1 : 0);
}
const CHROME = process.env.SWINTEG_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
if (!fs.existsSync(CHROME)) {
    console.log('\nSKIP ផ្នែក browser — រកមិនឃើញ Chromium');
    console.log('\n' + (fail ? '❌ ធ្លាក់ ' + fail + ' (ជោគជ័យ ' + pass + ')' : '✅ ជោគជ័យ ' + pass));
    process.exit(fail ? 1 : 0);
}

// ម៉ាស៊ីនបម្រើដែលអាច «ធ្វើឲ្យធនធានមួយបាត់» តាមតម្រូវការ — ធ្វើត្រាប់តាម
// បណ្តាញដែលដាច់កណ្តាល install (ជារឿងធម្មតាលើទូរស័ព្ទ)។
function serve(dir, blocked) {
    return new Promise((res) => {
        const s = http.createServer((req, rsp) => {
            let p = decodeURIComponent(req.url.split('?')[0]);
            if (p === '/') p = '/index.html';
            if (blocked.has(p)) { rsp.writeHead(503); return rsp.end('blocked'); }
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
    const blocked = new Set(['/vendor/zxing_reader.wasm']);
    const server = await serve(dir, blocked);
    const port = server.address().port;
    const origin = 'http://127.0.0.1:' + port;

    const browser = await chromium.launch({ executablePath: CHROME });
    const ctx = await browser.newContext({ viewport: { width: 412, height: 780 } });
    const page = await ctx.newPage();
    await ctx.route('**', (r) => r.request().url().startsWith(origin) ? r.continue() : r.abort());
    await page.goto(origin + '/', { waitUntil: 'load', timeout: 30000 });

    // ជុំទី ១ — engine WASM បាត់។ SW **មិនត្រូវ** activate ដោយសំបកខូចទេ។
    const partial = await page.evaluate(async () => {
        if (!navigator.serviceWorker) return { err: 'គ្មាន serviceWorker' };
        let installFailed = false;
        try {
            const reg = await navigator.serviceWorker.register('./sw.js');
            const sw = reg.installing || reg.waiting || reg.active;
            if (sw) {
                await new Promise((res) => {
                    if (sw.state === 'activated' || sw.state === 'redundant') return res();
                    sw.addEventListener('statechange', () => {
                        if (sw.state === 'activated' || sw.state === 'redundant') res();
                    });
                    setTimeout(res, 8000);
                });
                installFailed = sw.state === 'redundant';
            }
        } catch (e) { installFailed = true; }
        const keys = await caches.keys();
        let cachedWasm = false, cachedAppJs = false;
        for (const k of keys) {
            const c = await caches.open(k);
            if (await c.match('./vendor/zxing_reader.wasm')) cachedWasm = true;
            if (await c.match('./app.js')) cachedAppJs = true;
        }
        return { installFailed, cachedWasm, cachedAppJs, controlling: !!navigator.serviceWorker.controller };
    });

    ok('ធនធានស្នូលបាត់ ➜ install ធ្លាក់ (SW មិន activate ដោយសំបកខូច)',
        partial.installFailed === true, partial);
    ok('ធនធានស្នូលបាត់ ➜ មិនបន្សល់ cache ដែលខ្វះ engine ស្កេន',
        !(partial.cachedAppJs && !partial.cachedWasm), partial);

    // ជុំទី ២ — បណ្តាញត្រឡប់មកធម្មតា ➜ install ត្រូវជោគជ័យពេញលេញ
    blocked.clear();
    await page.goto(origin + '/', { waitUntil: 'load', timeout: 30000 });
    const healthy = await page.evaluate(async () => {
        const reg = await navigator.serviceWorker.register('./sw.js');
        await navigator.serviceWorker.ready;
        for (let i = 0; i < 60; i++) {
            const keys = await caches.keys();
            for (const k of keys) {
                const c = await caches.open(k);
                if ((await c.match('./vendor/zxing_reader.wasm')) && (await c.match('./app.js')) &&
                    (await c.match('./index.html'))) return { ok: true, key: k };
            }
            await new Promise((r) => setTimeout(r, 250));
        }
        return { ok: false };
    });
    ok('បណ្តាញត្រឡប់មកធម្មតា ➜ install ជោគជ័យ ហើយ engine ចូល cache ពេញលេញ',
        healthy.ok === true, healthy);

    // ជុំទី ៣ — បិទម៉ាស៊ីនបម្រើ ➜ ការស្កេនត្រូវនៅដើរពីក្នុង cache
    await new Promise((r) => server.close(r));
    await page.goto(origin + '/', { waitUntil: 'load', timeout: 30000 }).catch(() => {});
    const offline = await page.evaluate(() => ({
        hasShell: !!document.getElementById('appPages'),
        reader: typeof window.ZXingWASM !== 'undefined' && typeof window.ZXingWASM.readBarcodes === 'function'
    }));
    ok('ក្រោយ install ពេញលេញ ➜ បណ្តាញដាច់ តែការស្កេននៅដើរ', offline.hasShell && offline.reader, offline);

    await browser.close();
    console.log('\n' + (fail ? '❌ ធ្លាក់ ' + fail + ' (ជោគជ័យ ' + pass + ')' : '✅ ជោគជ័យ ' + pass));
    process.exit(fail ? 1 : 0);
})();
