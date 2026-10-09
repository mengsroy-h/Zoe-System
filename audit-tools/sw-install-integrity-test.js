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
        /addAll\(CORE_SHELL[).]/.test(sw), 'ធនធានស្នូលត្រូវប្រើ addAll ដែលធ្លាក់ជាក្រុម');
}
{
    const sw = fs.readFileSync(path.join(ROOT, 'ZoeW', 'sw.js'), 'utf8');
    const core = /const CORE_SHELL = \[([\s\S]*?)\];/.exec(sw);
    const list = core ? core[1] : '';
    // ⛔ App React ៖ `app.js` · `style.css` ដើមក្លាយជា asset តាម hash ➜ ដេរីវេពី `<script>`/`<link>` ដែល index.html ពិតផ្ទុក
    const shell = require('./react-view').swShell(ROOT);
    for (const need of ['./index.html', shell.appJs, shell.appCss, './vendor/zxing-wasm.js', './vendor/zxing_reader.wasm', './license-verify.js', './firebase-loader.js']) {
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
    // ⛔ asset JS ស្នូល ដេរីវេពី `CORE_SHELL` ពិត (App React ៖ `assets/index-<hash>.js`)
    const APP_JS_PATH = require('./react-view').swShell(ROOT).appJs;
    const partial = await page.evaluate(async (APP_JS) => {
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
            if (await c.match(APP_JS)) cachedAppJs = true;
        }
        return { installFailed, cachedWasm, cachedAppJs, controlling: !!navigator.serviceWorker.controller };
    }, APP_JS_PATH);

    ok('ធនធានស្នូលបាត់ ➜ install ធ្លាក់ (SW មិន activate ដោយសំបកខូច)',
        partial.installFailed === true, partial);
    ok('ធនធានស្នូលបាត់ ➜ មិនបន្សល់ cache ដែលខ្វះ engine ស្កេន',
        !(partial.cachedAppJs && !partial.cachedWasm), partial);

    // ជុំទី ២ — បណ្តាញត្រឡប់មកធម្មតា ➜ install ត្រូវជោគជ័យពេញលេញ
    blocked.clear();
    await page.goto(origin + '/', { waitUntil: 'load', timeout: 30000 });
    const healthy = await page.evaluate(async (APP_JS) => {
        const reg = await navigator.serviceWorker.register('./sw.js');
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
            const keys = await caches.keys();
            for (const k of keys) {
                const c = await caches.open(k);
                if ((await c.match('./vendor/zxing_reader.wasm')) && (await c.match(APP_JS)) &&
                    (await c.match('./index.html'))) return { ok: true, key: k };
            }
            await new Promise((r) => setTimeout(r, 250));
        }
        return { ok: false };
    }, APP_JS_PATH);
    ok('បណ្តាញត្រឡប់មកធម្មតា ➜ install ជោគជ័យ ហើយ engine ចូល cache ពេញលេញ',
        healthy.ok === true, healthy);

    // ជុំទី ៣ — បិទម៉ាស៊ីនបម្រើ ➜ ការស្កេនត្រូវនៅដើរពីក្នុង cache
    // ⛔ `server.close(cb)` ហៅ cb តែពេល **គ្រប់ការតភ្ជាប់បិទអស់** — Chromium
    // រក្សា socket keep-alive ➜ ការរង់ចាំនេះអាចមិនចេះចប់។ បិទវាដោយបង្ខំ។
    await new Promise((r) => {
        server.close(r);
        if (typeof server.closeAllConnections === 'function') server.closeAllConnections();
    });
    await page.goto(origin + '/', { waitUntil: 'load', timeout: 30000 }).catch(() => {});
    const offline = await page.evaluate(() => ({
        hasShell: !!document.getElementById('appPages'),
        reader: typeof window.ZXingWASM !== 'undefined' && typeof window.ZXingWASM.readBarcodes === 'function'
    }));
    ok('ក្រោយ install ពេញលេញ ➜ បណ្តាញដាច់ តែការស្កេននៅដើរ', offline.hasShell && offline.reader, offline);

    // ជុំទី ៤ — HTTP cache ចាស់ **មិនត្រូវ** ពុល cache របស់ SW។
    // ⛔ `vendor/zxing_reader.wasm` គ្មាន hash ក្នុងឈ្មោះ ➜ ឧបករណ៍ដែលធ្លាប់ទទួលវាជាមួយ
    //    `immutable` កាន់កំណែចាស់ក្នុង HTTP cache ១ ឆ្នាំ។ SW ដែលទាញ `CORE_SHELL` (ឬធ្វើឲ្យស្រស់ខាងក្រោយ)
    //    ដោយ cache mode លំនាំដើម ទទួល `.wasm` ចាស់នោះ ខណៈ `zxing-wasm.js` (no-cache) ជាកំណែថ្មី
    //    ➜ `LinkError` ➜ iPhone (គ្មាន BarcodeDetector) ស្កេនមិនបាន។ ការវាស់ដាក់ header **អាក្រក់**
    //    (`immutable`) លើគ្រប់កំណែដោយចេតនា ➜ វាស់ SW តែម្នាក់ឯង មិនពឹងលើ `netlify.toml`។
    {
        const realSw = fs.readFileSync(path.join(dir, 'sw.js'), 'utf8');
        const cvMatch = /zoew-v\d+/.exec(realSw);
        ok('ជុំទី ៤ ៖ រក CACHE_VERSION ក្នុង sw.js ពិតឃើញ', !!cvMatch);
        const realWasm = fs.readFileSync(path.join(dir, 'vendor', 'zxing_reader.wasm'));
        // custom section (id 0) ➜ wasm នៅត្រឹមត្រូវ តែ byte ចុងក្រោយជាស្លាកកំណែ
        const marked = (tag) => Buffer.concat([realWasm, Buffer.from([0x00, 0x0a, 0x08]), Buffer.from('zoe-mark' + tag, 'latin1')]);
        const state = { tag: 'A', swTag: 'A', wasmHits: 0, swHits: 0, delayPath: null };
        // ⛔ install ដាក់ `CORE_SHELL` (រួម `.wasm`) សិន រួចទើប `OPTIONAL_SHELL` ➜ `skipWaiting()` ➜ `clients.claim()` ➜ `.wasm` នៅក្នុង cache
        //    ថ្មី ≠ SW ថ្មីគ្រប់គ្រងទំព័រ។ ពេលម៉ាស៊ីនរវល់ ចន្លោះនោះលើស ១២ វិ. ➜ ជំហាន C ឆ្លង SW **ចាស់** (ដែលបដិសេធ revalidate ត្រឹមត្រូវ ព្រោះ
        //    deploy ប្តូរ) ➜ ធ្លាក់ម្តងម្កាល (វាស់បាន ៖ `serverSwHits: 1 · serverWasmHits: 0 · effectiveType: 4g`)។ ដូច្នេះការវាស់ពន្យារ
        //    ឯកសារ `OPTIONAL_SHELL` ទី ១ (ដេរីវេពី sw.js ពិត) ពេល install B ➜ ចន្លោះនោះកើត **ជានិច្ច** ហើយ checker ត្រូវរង់ចាំ B ចាប់យកទំព័រពិត។
        const optMatch = /OPTIONAL_SHELL\s*=\s*\[\s*['"]\.\/([^'"]+)['"]/.exec(realSw);
        const optionalFirst = optMatch ? '/' + optMatch[1] : null;
        ok('ជុំទី ៤ ៖ រក `OPTIONAL_SHELL` ក្នុង sw.js ពិតឃើញ', !!optionalFirst);
        const poison = await new Promise((res) => {
            const s = http.createServer((req, rsp) => {
                let p = decodeURIComponent(req.url.split('?')[0]);
                if (p === '/') p = '/index.html';
                if (state.delayPath && p === state.delayPath) {
                    state.delayPath = null;
                    const f = path.join(dir, p);
                    return setTimeout(() => {
                        rsp.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'text/plain', 'Cache-Control': 'no-cache' });
                        rsp.end(fs.existsSync(f) ? fs.readFileSync(f) : '');
                    }, 13000);
                }
                if (p === '/vendor/zxing_reader.wasm') {
                    state.wasmHits++;
                    const etag = '"w-' + state.tag + '"';
                    if (req.headers['if-none-match'] === etag) { rsp.writeHead(304, { ETag: etag }); return rsp.end(); }
                    rsp.writeHead(200, { 'Content-Type': 'application/wasm', 'Cache-Control': 'public, max-age=31536000, immutable', ETag: etag });
                    return rsp.end(marked(state.tag));
                }
                if (p === '/sw.js' && cvMatch) {
                    state.swHits++;
                    rsp.writeHead(200, { 'Content-Type': 'application/javascript', 'Cache-Control': 'no-cache' });
                    return rsp.end(realSw.split(cvMatch[0]).join(cvMatch[0] + '-' + state.swTag.toLowerCase()));
                }
                const f = path.join(dir, p);
                if (!f.startsWith(dir) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rsp.writeHead(404); return rsp.end(); }
                rsp.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'text/plain', 'Cache-Control': 'no-cache' });
                rsp.end(fs.readFileSync(f));
            });
            s.listen(0, '127.0.0.1', () => res(s));
        });
        const pOrigin = 'http://127.0.0.1:' + poison.address().port;
        // ⛔ គ្មាន `route()` ៖ ការស្ទាក់សំណើរបស់ Playwright **បិទ HTTP cache** ➜ ស្ថានភាព «cache ចាស់» មិនដែលកើត
        //    ➜ ជុំនេះឆ្លងលើ tree ដែលមានកំហុស (វាស់រួច)។ host ខាងក្រៅត្រូវបិទតាម resolver វិញ។
        const pbrowser = await chromium.launch({ executablePath: CHROME, args: ['--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1'] });
        const pctx = await pbrowser.newContext({ viewport: { width: 412, height: 780 } });
        const ppage = await pctx.newPage();
        await ppage.goto(pOrigin + '/', { waitUntil: 'load', timeout: 30000 });

        // អាន byte ចុងក្រោយនៃ `.wasm` ក្នុង cache SW ដែលឈ្មោះបញ្ចប់ដោយ suffix (ពិដានពេល ➜ មិនព្យួរ)
        const readTag = (suffix, poke) => ppage.evaluate(async ({ suffix, poke }) => {
            for (let i = 0; i < 48; i++) {
                if (poke) { try { await fetch('./vendor/zxing_reader.wasm'); } catch (e) {} }
                for (const k of await caches.keys()) {
                    if (!k.endsWith(suffix)) continue;
                    const r = await (await caches.open(k)).match('./vendor/zxing_reader.wasm');
                    if (!r) continue;
                    const b = new Uint8Array(await r.arrayBuffer());
                    const tag = String.fromCharCode(b[b.length - 1]);
                    if (!poke || tag === poke) return { key: k, tag };
                    if (i === 47) return { key: k, tag };
                }
                await new Promise((r) => setTimeout(r, 250));
            }
            return { key: null, tag: null };
        }, { suffix, poke: poke || null });

        await ppage.evaluate(() => navigator.serviceWorker.register('./sw.js').then(() => Promise.race([
            navigator.serviceWorker.ready, new Promise((r) => setTimeout(r, 20000))
        ])));
        const first = await readTag('-a');
        ok('ជុំទី ៤ ៖ SW ដំបូងចាក់ `.wasm` កំណែ A ចូល cache', first.tag === 'A', first);

        // កំណែ B ចេញ (SW ថ្មី) ខណៈ HTTP cache នៅកាន់ A ជាមួយ `immutable`
        state.tag = 'B';
        state.swTag = 'B';
        const hitsBefore = state.wasmHits;
        state.delayPath = optionalFirst;
        await ppage.evaluate(() => navigator.serviceWorker.getRegistration().then((reg) => reg && reg.update()).catch(() => {}));
        const second = await readTag('-b');
        ok('ជុំទី ៤ ៖ SW ថ្មី install ទាញ `.wasm` ពី server មិនមែនពី HTTP cache ចាស់ (A ➜ B)',
            second.tag === 'B', Object.assign({ serverHits: state.wasmHits - hitsBefore }, second));
        const racing = await ppage.evaluate(() => navigator.serviceWorker.getRegistration()
            .then((reg) => !!(reg && (reg.installing || reg.waiting)))).catch(() => false);
        ok('ជុំទី ៤ ៖ លក្ខខណ្ឌចាំបាច់ ៖ `.wasm` B នៅក្នុង cache ខណៈ SW B **មិនទាន់** គ្រប់គ្រង (ចន្លោះប្រណាំងកើតពិត)', racing);
        const taken = await ppage.evaluate(async () => {
            for (let i = 0; i < 160; i++) {
                const reg = await navigator.serviceWorker.getRegistration();
                const keys = await caches.keys();
                if (reg && !reg.installing && !reg.waiting && navigator.serviceWorker.controller
                    && keys.some((k) => k.endsWith('-b')) && !keys.some((k) => k.endsWith('-a'))) return true;
                await new Promise((r) => setTimeout(r, 250));
            }
            return false;
        }).catch(() => false);
        ok('ជុំទី ៤ ៖ លក្ខខណ្ឌចាំបាច់ ៖ SW B ចាប់យកទំព័រ (cache `-a` លុប) មុនជំហាន C', taken);

        // កំណែ C ចេញ ដោយគ្មាន SW ថ្មី ➜ ការធ្វើឲ្យស្រស់ខាងក្រោយត្រូវនាំ C មក (មិនមែនជាប់ B ពី HTTP cache)
        state.tag = 'C';
        const wasmBefore = state.wasmHits;
        const swBefore = state.swHits;
        const third = await readTag('-b', 'C');
        // ⛔ ការធ្លាក់ត្រូវប្រាប់ *មូលហេតុ* ៖ revalidate មិនដែលទៅដល់ server (link «frugal» · សាលក្រម deploy ចាស់ ·
        //    SW ដែលគ្រប់គ្រងខុស) ធៀបនឹង server ឆ្លើយ C តែ cache មិនប្រែ
        const why = third.tag === 'C' ? null : await ppage.evaluate(() => {
            const link = navigator.connection || {};
            const ctl = navigator.serviceWorker.controller;
            return { effectiveType: link.effectiveType || null, saveData: link.saveData === true, rtt: link.rtt, controller: ctl ? ctl.scriptURL.split('/').pop() + ':' + ctl.state : null };
        }).catch((e) => ({ probe: String(e && e.message) }));
        ok('ជុំទី ៤ ៖ ការធ្វើឲ្យស្រស់ខាងក្រោយ (revalidate) ទាញពី server មិនមែនពី HTTP cache ចាស់ (B ➜ C)',
            third.tag === 'C', Object.assign({ serverWasmHits: state.wasmHits - wasmBefore, serverSwHits: state.swHits - swBefore }, third, why || {}));

        await pbrowser.close();
        await new Promise((r) => {
            poison.close(r);
            if (typeof poison.closeAllConnections === 'function') poison.closeAllConnections();
        });
    }

    // ជុំទី ៥ — ⛔⛔ deploy ថ្មីដែល SW ថ្មី install **មិនជោគជ័យ** (បណ្តាញយឺត/ដាច់ពាក់កណ្តាល · អ្នកប្រើបិទ App កណ្តាល
    //    install ~៣ MB) ➜ SW ចាស់នៅគ្រប់គ្រង ➜ ការធ្វើឲ្យស្រស់ខាងក្រោយ **មិនត្រូវចាក់ឯកសារកំណែថ្មី ចូល cache កំណែចាស់**។
    //    ⛔ `index.html` ថ្មីយោង asset ថ្មី (ឈ្មោះ hash ថ្មី) ដែលមិនមាននៅក្នុង cache ចាស់ ➜ បើកក្រៅបណ្តាញ ➜ **App ស**
    //    (ថ្នាក់ដដែលនឹង `zxing-wasm.js` ថ្មី + `.wasm` ចាស់ ➜ `LinkError` ➜ iPhone ស្កេនមិនបាន) ។ កំណែថ្មីមកតាម
    //    `CACHE_VERSION` (install ជាក្រុម · atomic) តែមួយផ្លូវគត់។
    {
        const realSw = fs.readFileSync(path.join(dir, 'sw.js'), 'utf8');
        const cvMatch = /zoew-v\d+/.exec(realSw);
        const realIndex = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
        const appJs = (/\.\/assets\/index-[A-Za-z0-9_-]+\.js/.exec(realIndex) || [])[0] || '';
        const appJsB = appJs.replace(/\.js$/, '-b.js');
        ok('ជុំទី ៥ ៖ រក asset ចម្បង និង CACHE_VERSION ក្នុង build ពិតឃើញ', !!(cvMatch && appJs && realSw.indexOf("'" + appJs + "'") !== -1), { cv: cvMatch && cvMatch[0], appJs });
        const state = { v: 'A', failGuide: false, down: false };
        const sockets = new Set();
        const srv = await new Promise((res) => {
            const s = http.createServer((req, rsp) => {
                if (state.down) { req.socket.destroy(); return; }
                let p = decodeURIComponent(req.url.split('?')[0]);
                if (p === '/') p = '/index.html';
                const head = { 'Cache-Control': 'no-cache' };
                if (p === '/index.html') {
                    rsp.writeHead(200, Object.assign({ 'Content-Type': 'text/html' }, head));
                    return rsp.end(state.v === 'A' ? realIndex : realIndex.split(appJs).join(appJsB));
                }
                if (p === '/sw.js' && cvMatch) {
                    let body = realSw.split(cvMatch[0]).join(cvMatch[0] + '-' + state.v.toLowerCase());
                    if (state.v === 'B') body = body.split("'" + appJs + "'").join("'" + appJsB + "'");
                    rsp.writeHead(200, Object.assign({ 'Content-Type': 'application/javascript' }, head));
                    return rsp.end(body);
                }
                if (p === '/guide.html' && state.failGuide) { rsp.writeHead(503); return rsp.end('busy'); }
                if (appJsB && p === appJsB.slice(1)) p = appJs.slice(1);
                const f = path.join(dir, p);
                if (!f.startsWith(dir) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rsp.writeHead(404); return rsp.end(); }
                rsp.writeHead(200, Object.assign({ 'Content-Type': TYPES[path.extname(f)] || 'text/plain' }, head));
                rsp.end(fs.readFileSync(f));
            });
            s.on('connection', (c) => { sockets.add(c); c.on('close', () => sockets.delete(c)); });
            s.listen(0, '127.0.0.1', () => res(s));
        });
        const vOrigin = 'http://127.0.0.1:' + srv.address().port;
        const vbrowser = await chromium.launch({ executablePath: CHROME, args: ['--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1'] });
        const vctx = await vbrowser.newContext({ viewport: { width: 412, height: 780 } });
        const vpage = await vctx.newPage();
        const cachedIndex = () => vpage.evaluate(async () => {
            const out = {};
            for (const k of await caches.keys()) {
                const r = await (await caches.open(k)).match('./index.html');
                out[k] = r ? ((await r.text()).indexOf('-b.js') !== -1 ? 'B' : 'A') : null;
            }
            return out;
        }).catch(() => ({}));
        await vpage.goto(vOrigin + '/', { waitUntil: 'load', timeout: 30000 });
        await vpage.evaluate(() => navigator.serviceWorker.register('./sw.js').then(() => Promise.race([
            navigator.serviceWorker.ready, new Promise((r) => setTimeout(r, 20000))
        ])));
        await vpage.waitForTimeout(1500);
        const keysA = Object.keys(await cachedIndex());
        ok('ជុំទី ៥ ៖ លក្ខខណ្ឌចាំបាច់ ៖ SW កំណែ A ដំឡើង ហើយ cache សំបក', keysA.some((k) => /-a$/.test(k)), keysA);

        state.v = 'B';
        state.failGuide = true;
        await vpage.reload({ waitUntil: 'load', timeout: 30000 }).catch(() => {});
        await vpage.evaluate(() => navigator.serviceWorker.getRegistration().then((reg) => reg && reg.update()).catch(() => {}));
        await vpage.waitForTimeout(4000);
        const afterB = await cachedIndex();
        const activeKeys = Object.keys(afterB);
        ok('ជុំទី ៥ ៖ លក្ខខណ្ឌចាំបាច់ ៖ SW កំណែ B install មិនជោគជ័យ ➜ cache A នៅគ្រប់គ្រង',
            activeKeys.some((k) => /-a$/.test(k) && afterB[k]) && !activeKeys.some((k) => /-b$/.test(k) && afterB[k]),
            afterB);

        state.down = true;
        sockets.forEach((c) => c.destroy());
        await vpage.reload({ waitUntil: 'load', timeout: 30000 }).catch(() => {});
        await vpage.waitForTimeout(2500);
        // ⛔ `index.html` របស់ build វាស់មាន markup ស្រាប់ ➜ `#appPages` មិនមែនភស្តុតាងថា JS រត់ ➜ វាស់ថា asset
        //    ដែល HTML ក្នុង cache យោង **ទាញបានក្រៅបណ្តាញ** (ឆ្លង SW ដដែល)
        const offline = await vpage.evaluate(async () => {
            const out = [];
            const refs = Array.from(document.querySelectorAll('script[src], link[rel="stylesheet"][href], link[rel="modulepreload"][href]'))
                .map((x) => x.getAttribute('src') || x.getAttribute('href') || '').filter((u) => /assets\//.test(u));
            for (const u of refs) {
                try { const r = await fetch(u); out.push({ u, ok: r.ok }); } catch (e) { out.push({ u, ok: false }); }
            }
            return out;
        }).catch((e) => [{ u: 'evaluate', ok: false, error: String(e) }]);
        ok('ជុំទី ៥ ⛔⛔ ៖ deploy ថ្មីដែល install មិនជោគជ័យ ➜ ក្រៅបណ្តាញ asset ទាំងអស់ដែលសំបកយោង មាននៅក្នុង cache (មិនលាយកំណែ)',
            offline.length >= 1 && offline.every((x) => x.ok), { caches: afterB, assets: offline });

        await vbrowser.close();
        await new Promise((r) => { srv.close(r); sockets.forEach((c) => c.destroy()); });
    }

    // ជុំទី ៦ — ⛔ ធនធាន OPTIONAL **ព្យួរ** (បណ្តាញ «ភ្ជាប់តែស្លាប់» កណ្តាល install ៖ server ទទួល socket តែមិនឆ្លើយ) ➜ `.catch(() => {})` មិនជួយទេ
    //    (ការព្យួរ ≠ ការបរាជ័យ) ➜ SW ជាប់ `installing` ➜ គ្មាន offline · deploy ថ្មីមិនដល់ ខណៈ CORE ចូល cache រួចហើយ។ OPTIONAL ត្រូវមានពិដាន
    //    (`OPTIONAL_INSTALL_TIMEOUT_MS` ដេរីវេពី sw.js ពិត) ➜ SW activate ក្នុងពិដាន + ៨ វិ.។ ទិសផ្ទុយ ៖ CORE ព្យួរ ➜ **មិន** activate (CORE នៅជាក្រុម
    //    atomic · ការកែមិនត្រូវប្រែ CORE ជា optional)។ App ទាំង ២ · ធនធានដេរីវេពី `OPTIONAL_SHELL`/`CORE_SHELL` ពិត · ៤ សេណារីយ៉ូរត់ស្របគ្នា (origin ដាច់)។
    {
        const MARGIN_MS = 8000;
        const CEILING_MAX_MS = 60000;
        const shellList = (sw, name) => {
            const m = new RegExp(name + '\\s*=\\s*\\[([\\s\\S]*?)\\]').exec(sw);
            return m ? (m[1].match(/['"]\.\/[^'"]*['"]/g) || []).map((x) => x.slice(1, -1)) : [];
        };
        const scenario = async (app, kind) => {
            const appDir = path.join(ROOT, app);
            const sw = fs.readFileSync(path.join(appDir, 'sw.js'), 'utf8');
            const ceilingMatch = /OPTIONAL_INSTALL_TIMEOUT_MS\s*=\s*(\d+)/.exec(sw);
            const ceiling = ceilingMatch ? Number(ceilingMatch[1]) : 20000;
            const optional = shellList(sw, 'OPTIONAL_SHELL');
            const core = shellList(sw, 'CORE_SHELL').filter((u) => u !== './' && u !== './index.html');
            const target = kind === 'optional' ? optional[0] : core[core.length - 1];
            const hangPath = target ? target.slice(1) : null;
            const state = { hangHits: 0, armed: false };
            const held = new Set();
            const srv = await new Promise((res) => {
                const s = http.createServer((req, rsp) => {
                    let p = decodeURIComponent(req.url.split('?')[0]);
                    if (p === '/') p = '/index.html';
                    if (state.armed && p === hangPath) { state.hangHits++; held.add(rsp); return; }
                    const f = path.join(appDir, p);
                    if (!f.startsWith(appDir) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rsp.writeHead(404); return rsp.end(); }
                    rsp.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'text/plain', 'Cache-Control': 'no-cache' });
                    rsp.end(fs.readFileSync(f));
                });
                const sockets = new Set();
                s.on('connection', (c) => { sockets.add(c); c.on('close', () => sockets.delete(c)); });
                s.stopAll = () => new Promise((r) => { held.clear(); sockets.forEach((c) => c.destroy()); s.close(r); });
                s.listen(0, '127.0.0.1', () => res(s));
            });
            const o = 'http://127.0.0.1:' + srv.address().port;
            const b = await chromium.launch({ executablePath: CHROME });
            const ctx6 = await b.newContext({ viewport: { width: 412, height: 780 } });
            const page6 = await ctx6.newPage();
            await ctx6.route('**', (r) => (r.request().url().startsWith(o) ? r.continue() : r.abort()));
            let out = { err: 'មិនបានរត់' };
            try {
                await page6.goto(o + '/', { waitUntil: 'load', timeout: 30000 });
                state.armed = true;
                out = await page6.evaluate(async (waitMs) => {
                    const t0 = Date.now();
                    const reg = await navigator.serviceWorker.register('./sw.js');
                    const w = reg.installing || reg.waiting || reg.active;
                    if (!w) return { err: 'គ្មាន worker' };
                    await new Promise((res) => {
                        const done = () => w.state === 'activated' || w.state === 'redundant';
                        if (done()) return res();
                        w.addEventListener('statechange', () => { if (done()) res(); });
                        setTimeout(res, waitMs);
                    });
                    let cachedIndex = false;
                    for (const k of await caches.keys()) {
                        if (await (await caches.open(k)).match('./index.html')) cachedIndex = true;
                    }
                    return { state: w.state, ms: Date.now() - t0, cachedIndex };
                }, Math.min(ceiling, CEILING_MAX_MS) + MARGIN_MS);
            } catch (e) {
                out = { err: String(e && e.message || e) };
            }
            await b.close().catch(() => {});
            await srv.stopAll();
            return { app, kind, target, ceiling, fromCode: !!ceilingMatch, hangHits: state.hangHits, out };
        };
        const runs = await Promise.all(['ZoeW', 'ZoeKeyGen'].flatMap((app) => [scenario(app, 'optional'), scenario(app, 'core')]));
        for (const r of runs) {
            const label = 'ជុំទី ៦ ៖ ' + r.app + ' ៖ ';
            ok(label + 'លក្ខខណ្ឌចាំបាច់ ៖ ធនធាន ' + r.kind.toUpperCase() + ' «' + r.target + '» ត្រូវបានស្នើ ហើយព្យួរពិត', !!r.target && r.hangHits >= 1, r);
            if (r.kind === 'optional') {
                ok(label + 'OPTIONAL ព្យួរ ➜ SW activate ក្នុងពិដាន `OPTIONAL_INSTALL_TIMEOUT_MS` + ' + MARGIN_MS / 1000 + ' វិ. (មិនជាប់ installing)',
                    r.out.state === 'activated' && r.out.ms <= r.ceiling + MARGIN_MS && r.out.cachedIndex === true, r);
                ok(label + 'ពិដាន OPTIONAL ដេរីវេពី sw.js ពិត (`OPTIONAL_INSTALL_TIMEOUT_MS`) ហើយ ≤ ' + CEILING_MAX_MS / 1000 + ' វិ. (តឹងជាងការសម្លាប់ event ~៥ នាទីរបស់ browser)',
                    r.fromCode && r.ceiling > 0 && r.ceiling <= CEILING_MAX_MS, r);
            } else {
                ok(label + 'ទិសផ្ទុយ ៖ CORE ព្យួរ ➜ SW **មិន** activate (CORE នៅជាក្រុម atomic)', r.out.state !== 'activated' && !r.out.err, r);
            }
        }
    }

    // ជុំទី ៧ — ⛔⛔ deploy ថ្មីចូលផ្សាយ **កណ្តាល install** ៖ asset ឈ្មោះ hash របស់ deploy ចាស់លែងមាន ➜ Netlify (`/* ➜ /index.html 200`) ឆ្លើយ
    //    `index.html` (200 · text/html) ➜ `cache.addAll()` ទទួល (status ok) ហើយរក្សា HTML ក្រោម key JS ➜ SW activate ➜ cache-first ផ្តល់ HTML ជំនួស
    //    JS ចម្បង ➜ App ស រហូតដល់ SW បន្ទាប់។ ច្បាប់ `responseFitsKey()` (HTML មិនចូលក្រោម key មិនមែន HTML) ត្រូវកាន់ install ដែរ ៖ install ត្រូវធ្លាក់
    //    (SW redundant ➜ browser សាក sw.js ថ្មីពេលក្រោយ) · OPTIONAL ដែលជា HTML មិននៅក្នុង cache។ ទិសផ្ទុយ ៖ ម៉ាស៊ីនបម្រើធម្មតា ➜ install ដដែល (cache ឈ្មោះដដែល)
    //    activate ហើយ JS ចម្បងជា JS ពិត។ ZoeW (ZoeKeyGen គ្មានឈ្មោះ hash ➜ គ្មាន fallback ក្រោមឈ្មោះចាស់)។
    //    ⛔ App ពិតចុះឈ្មោះ sw.js ខ្លួនឯងពេលផ្ទុក ➜ deploy ជាន់ត្រូវមានមុន `goto` (មិនដូច្នោះ install ចប់មុនការជាន់ ➜ វាស់ផ្លូវធម្មតា)។
    {
        const realIndex = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
        const appJs = (/\.\/assets\/index-[A-Za-z0-9_-]+\.js/.exec(realIndex) || [])[0] || '';
        const swText = fs.readFileSync(path.join(dir, 'sw.js'), 'utf8');
        const optionalMatch = /const OPTIONAL_SHELL = \[([\s\S]*?)\];/.exec(swText);
        const optionalJs = ((optionalMatch ? optionalMatch[1] : '').match(/'\.\/[^']+\.js'/) || [''])[0].slice(1, -1);
        ok('ជុំទី ៧ ៖ លក្ខខណ្ឌចាំបាច់ ៖ JS ចម្បង (CORE) និង JS OPTIONAL ក្នុង build ពិត', !!appJs && swText.indexOf("'" + appJs + "'") !== -1 && !!optionalJs,
            { appJs, optionalJs });
        const state = { flipped: false, fallbackHits: 0 };
        const fallbackPaths = new Set([appJs.slice(1), optionalJs.slice(1)]);
        const srv7 = await new Promise((res) => {
            const s = http.createServer((req, rsp) => {
                let p = decodeURIComponent(req.url.split('?')[0]);
                if (p === '/') p = '/index.html';
                if (state.flipped && fallbackPaths.has(p)) {
                    state.fallbackHits++;
                    rsp.writeHead(200, { 'Content-Type': 'text/html; charset=UTF-8', 'Cache-Control': 'no-cache' });
                    return rsp.end(realIndex);
                }
                const f = path.join(dir, p);
                if (!f.startsWith(dir) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rsp.writeHead(404); return rsp.end(); }
                rsp.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'text/plain', 'Cache-Control': 'no-cache' });
                rsp.end(fs.readFileSync(f));
            });
            const sockets = new Set();
            s.on('connection', (c) => { sockets.add(c); c.on('close', () => sockets.delete(c)); });
            s.stopAll = () => new Promise((r) => { sockets.forEach((c) => c.destroy()); s.close(r); });
            s.listen(0, '127.0.0.1', () => res(s));
        });
        const o7 = 'http://127.0.0.1:' + srv7.address().port;
        const b7 = await chromium.launch({ executablePath: CHROME });
        const ctx7 = await b7.newContext({ viewport: { width: 412, height: 780 } });
        const page7 = await ctx7.newPage();
        await ctx7.route('**', (r) => (r.request().url().startsWith(o7) ? r.continue() : r.abort()));
        const installOnce = () => page7.evaluate(async ({ js, opt }) => {
            const reg = await navigator.serviceWorker.register('./sw.js');
            const w = reg.installing || reg.waiting || reg.active;
            if (!w) return { err: 'គ្មាន worker' };
            await new Promise((res) => {
                const done = () => w.state === 'activated' || w.state === 'redundant';
                if (done()) return res();
                w.addEventListener('statechange', () => { if (done()) res(); });
                setTimeout(res, 40000);
            });
            const entries = {};
            for (const k of await caches.keys()) {
                const c = await caches.open(k);
                const typeOf = async (u) => { const r = await c.match(u); return r ? String(r.headers.get('content-type') || '') : null; };
                entries[k] = { js: await typeOf(js), opt: await typeOf(opt) };
            }
            return { state: w.state, entries, controlled: !!navigator.serviceWorker.controller };
        }, { js: appJs, opt: optionalJs }).catch((e) => ({ err: String(e && e.message || e) }));
        let flipped = { err: 'មិនបានរត់' };
        let healed = { err: 'មិនបានរត់' };
        try {
            state.flipped = true;
            await page7.goto(o7 + '/', { waitUntil: 'load', timeout: 30000 });
            flipped = await installOnce();
            state.flipped = false;
            healed = await installOnce();
        } catch (e) {
            flipped = flipped.err ? { err: String(e && e.message || e) } : flipped;
        }
        await b7.close().catch(() => {});
        await srv7.stopAll();
        const htmlUnder = (out, field) => Object.values(out.entries || {}).some((e) => /text\/html/i.test(String(e[field] || '')));
        ok('ជុំទី ៧ ៖ លក្ខខណ្ឌចាំបាច់ ៖ install ស្នើ JS ចម្បង ហើយទទួល index.html (deploy ជាន់)', state.fallbackHits >= 1 && !flipped.err, { hits: state.fallbackHits, flipped });
        ok('ជុំទី ៧ ⛔⛔ ៖ HTML ក្រោម key JS ចម្បង (CORE) ➜ install ធ្លាក់ (SW មិន activate · មិនគ្រប់គ្រងទំព័រ)',
            flipped.state === 'redundant' && !flipped.controlled, flipped);
        ok('ជុំទី ៧ ⛔ ៖ គ្មាន cache ណាផ្តល់ HTML ជំនួស JS ចម្បងដល់ SW ដែល activate', !(flipped.state === 'activated' && htmlUnder(flipped, 'js')), flipped);
        ok('ជុំទី ៧ ទិសផ្ទុយ ៖ ម៉ាស៊ីនបម្រើធម្មតា ➜ install ដដែល activate · JS ចម្បង និង OPTIONAL ជា JS ពិត (មិនមែន HTML សល់ពីលើកមុន)',
            healed.state === 'activated' && !htmlUnder(healed, 'js') && !htmlUnder(healed, 'opt')
            && Object.values(healed.entries || {}).some((e) => /javascript/i.test(String(e.js || ''))), healed);
    }

    // ជុំទី ៧ខ — OPTIONAL ដែលទទួល HTML (CORE ធម្មតា) ៖ SW activate (OPTIONAL មិនរារាំង install) តែ HTML មិនចូល cache ក្រោម key OPTIONAL
    {
        const swText = fs.readFileSync(path.join(dir, 'sw.js'), 'utf8');
        const optionalMatch = /const OPTIONAL_SHELL = \[([\s\S]*?)\];/.exec(swText);
        const optionalJs = ((optionalMatch ? optionalMatch[1] : '').match(/'\.\/[^']+\.js'/) || [''])[0].slice(1, -1);
        const realIndex = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
        let hits = 0;
        const srv7b = await new Promise((res) => {
            const s = http.createServer((req, rsp) => {
                let p = decodeURIComponent(req.url.split('?')[0]);
                if (p === '/') p = '/index.html';
                if (optionalJs && p === optionalJs.slice(1)) {
                    hits++;
                    rsp.writeHead(200, { 'Content-Type': 'text/html; charset=UTF-8', 'Cache-Control': 'no-cache' });
                    return rsp.end(realIndex);
                }
                const f = path.join(dir, p);
                if (!f.startsWith(dir) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rsp.writeHead(404); return rsp.end(); }
                rsp.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'text/plain', 'Cache-Control': 'no-cache' });
                rsp.end(fs.readFileSync(f));
            });
            const sockets = new Set();
            s.on('connection', (c) => { sockets.add(c); c.on('close', () => sockets.delete(c)); });
            s.stopAll = () => new Promise((r) => { sockets.forEach((c) => c.destroy()); s.close(r); });
            s.listen(0, '127.0.0.1', () => res(s));
        });
        const o = 'http://127.0.0.1:' + srv7b.address().port;
        const b = await chromium.launch({ executablePath: CHROME });
        const c7 = await b.newContext({ viewport: { width: 412, height: 780 } });
        const p7 = await c7.newPage();
        await c7.route('**', (r) => (r.request().url().startsWith(o) ? r.continue() : r.abort()));
        let out = { err: 'មិនបានរត់' };
        try {
            await p7.goto(o + '/', { waitUntil: 'load', timeout: 30000 });
            out = await p7.evaluate(async (opt) => {
                const reg = await navigator.serviceWorker.register('./sw.js');
                const w = reg.installing || reg.waiting || reg.active;
                await new Promise((res) => {
                    const done = () => w.state === 'activated' || w.state === 'redundant';
                    if (done()) return res();
                    w.addEventListener('statechange', () => { if (done()) res(); });
                    setTimeout(res, 40000);
                });
                const types = [];
                for (const k of await caches.keys()) {
                    const r = await (await caches.open(k)).match(opt);
                    if (r) types.push(String(r.headers.get('content-type') || ''));
                }
                return { state: w.state, types };
            }, optionalJs);
        } catch (e) {
            out = { err: String(e && e.message || e) };
        }
        await b.close().catch(() => {});
        await srv7b.stopAll();
        ok('ជុំទី ៧ខ ៖ លក្ខខណ្ឌចាំបាច់ ៖ install ស្នើ OPTIONAL «' + optionalJs + '» ហើយទទួល HTML', hits >= 1 && !out.err, { hits, out });
        ok('ជុំទី ៧ខ ⛔ ៖ OPTIONAL ទទួល HTML ➜ SW នៅ activate តែ HTML មិននៅក្នុង cache ក្រោម key OPTIONAL',
            out.state === 'activated' && Array.isArray(out.types) && !out.types.some((t) => /text\/html/i.test(t)), out);
    }

    // ជុំទី ៨ — ⛔⛔ deploy ថ្មីចូលផ្សាយ **កណ្តាល install** លើឯកសារ **គ្មាន hash** (`index.html` · `boot-flags.js` · vendor · ZoeKeyGen ទាំងមូល) ៖ Netlify ឆ្លើយ
    //    ឯកសារឈ្មោះដដែលពី deploy ថ្មី (200 · ប្រភេទត្រឹមត្រូវ) ➜ `responseFitsKey()`/`shellEntriesFit()` មើលមិនឃើញ ➜ cache កំណែ N ផ្ទុកសំបក N+1 លាយ N
    //    (ក្រៅបណ្តាញ ៖ `index.html` N+1 យោង asset ដែលគ្មានក្នុង cache) រហូតដល់ SW បន្ទាប់។ ភស្តុតាងតែមួយថា deploy មិនប្តូរ ៖ sw.js ដែលកំពុងផ្សាយ **ក្រោយ** cache ពេញ
    //    នៅតែមាន `CACHE_VERSION` របស់ SW ដែលកំពុង install (Netlify deploy ជា atomic ➜ ដដែលនៅចុង = ដដែលពេញ install)។ ប្តូរ ➜ install ធ្លាក់ (browser
    //    install sw.js ថ្មីពេលពិនិត្យបន្ទាប់)។ ⛔ «អានមិនបាន» ≠ «ប្តូរ» ៖ 503 · ព្យួរ (ពិដានដេរីវេពី sw.js ពិត) ➜ install នៅជោគជ័យ។ ទិសផ្ទុយ ៖ deploy មិនប្តូរ ➜ activate។
    //    ការស្នើ script របស់ browser (header `Service-Worker: script`) ទទួល sw.js ពិតជានិច្ច ➜ មានតែការអានពីក្នុង SW ដែលឃើញ deploy ថ្មី។ App ទាំង ២ · ស្របគ្នា។
    {
        const MARGIN_MS = 8000;
        const scenario = async (app, kind) => {
            const appDir = path.join(ROOT, app);
            const swReal = fs.readFileSync(path.join(appDir, 'sw.js'), 'utf8');
            const cv = (/const CACHE_VERSION = '([a-z]+-v)(\d+)';/.exec(swReal) || []);
            const nextSw = cv[0] ? swReal.replace(cv[0], "const CACHE_VERSION = '" + cv[1] + (Number(cv[2]) + 1000) + "';") : swReal;
            const ceilingMatch = /INSTALL_DEPLOY_CHECK_TIMEOUT_MS\s*=\s*(\d+)/.exec(swReal);
            const ceiling = ceilingMatch ? Number(ceilingMatch[1]) : 10000;
            const state = { mode: kind, inSwReads: 0 };
            const held = new Set();
            const srv = await new Promise((res) => {
                const s = http.createServer((req, rsp) => {
                    let p = decodeURIComponent(req.url.split('?')[0]);
                    if (p === '/') p = '/index.html';
                    if (p === '/sw.js' && req.headers['service-worker'] !== 'script' && state.mode !== 'same') {
                        state.inSwReads++;
                        if (state.mode === 'down') { rsp.writeHead(503); return rsp.end('down'); }
                        if (state.mode === 'hang') { held.add(rsp); return; }
                        rsp.writeHead(200, { 'Content-Type': 'application/javascript', 'Cache-Control': 'no-cache' });
                        return rsp.end(nextSw);
                    }
                    const f = path.join(appDir, p);
                    if (!f.startsWith(appDir) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rsp.writeHead(404); return rsp.end(); }
                    rsp.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'text/plain', 'Cache-Control': 'no-cache' });
                    rsp.end(fs.readFileSync(f));
                });
                const sockets = new Set();
                s.on('connection', (c) => { sockets.add(c); c.on('close', () => sockets.delete(c)); });
                s.stopAll = () => new Promise((r) => { held.clear(); sockets.forEach((c) => c.destroy()); s.close(r); });
                s.listen(0, '127.0.0.1', () => res(s));
            });
            const o = 'http://127.0.0.1:' + srv.address().port;
            const b = await chromium.launch({ executablePath: CHROME });
            const c8 = await b.newContext({ viewport: { width: 412, height: 780 } });
            const p8 = await c8.newPage();
            await c8.route('**', (r) => (r.request().url().startsWith(o) ? r.continue() : r.abort()));
            const installOnce = (waitMs) => p8.evaluate(async (ms) => {
                const t0 = Date.now();
                const reg = await navigator.serviceWorker.register('./sw.js');
                const w = reg.installing || reg.waiting || reg.active;
                if (!w) return { err: 'គ្មាន worker' };
                await new Promise((res) => {
                    const done = () => w.state === 'activated' || w.state === 'redundant';
                    if (done()) return res();
                    w.addEventListener('statechange', () => { if (done()) res(); });
                    setTimeout(res, ms);
                });
                return { state: w.state, ms: Date.now() - t0, controlled: !!navigator.serviceWorker.controller };
            }, waitMs).catch((e) => ({ err: String(e && e.message || e) }));
            let out = { err: 'មិនបានរត់' };
            let healed = null;
            try {
                await p8.goto(o + '/', { waitUntil: 'load', timeout: 30000 });
                out = await installOnce(ceiling + MARGIN_MS + 20000);
                if (kind === 'flip') {
                    state.mode = 'same';
                    healed = await installOnce(40000);
                }
            } catch (e) {
                out = { err: String(e && e.message || e) };
            }
            await b.close().catch(() => {});
            await srv.stopAll();
            return { app, kind, versioned: !!cv[0], ceiling, fromCode: !!ceilingMatch, inSwReads: state.inSwReads, out, healed };
        };
        const runs = await Promise.all(['ZoeW', 'ZoeKeyGen'].flatMap((app) => [scenario(app, 'flip'), scenario(app, 'down'), scenario(app, 'hang')]));
        for (const r of runs) {
            const label = 'ជុំទី ៨ ៖ ' + r.app + ' ៖ ';
            if (r.kind === 'flip') {
                ok(label + 'លក្ខខណ្ឌចាំបាច់ ៖ រក `CACHE_VERSION` ក្នុង sw.js ពិតឃើញ (deploy ថ្មី = កំណែផ្សេង)', r.versioned, r);
                ok(label + '⛔⛔ sw.js ដែលផ្សាយក្រោយ cache ពេញមាន `CACHE_VERSION` ផ្សេង (deploy ប្តូរកណ្តាល install) ➜ install ធ្លាក់ (មិន activate · មិនគ្រប់គ្រងទំព័រ)',
                    r.inSwReads >= 1 && r.out.state === 'redundant' && !r.out.controlled, r);
                ok(label + 'ទិសផ្ទុយ ៖ deploy មិនប្តូរ ➜ install ដដែល activate', !!r.healed && r.healed.state === 'activated', r);
            } else if (r.kind === 'down') {
                ok(label + 'ទិសផ្ទុយ ៖ អាន sw.js មិនបាន (503) ≠ deploy ប្តូរ ➜ install នៅ activate', r.out.state === 'activated', r);
            } else {
                ok(label + 'ពិដានពិនិត្យ deploy ដេរីវេពី sw.js ពិត (`INSTALL_DEPLOY_CHECK_TIMEOUT_MS`) ≤ 15 វិ.', r.fromCode && r.ceiling > 0 && r.ceiling <= 15000, r);
                ok(label + 'ទិសផ្ទុយ ៖ ការអាន sw.js ព្យួរ ➜ install activate ក្នុងពិដាន + ' + MARGIN_MS / 1000 + ' វិ. (ព្យួរ ≠ ប្តូរ · មិនជាប់ installing)',
                    r.inSwReads >= 1 && r.out.state === 'activated' && r.out.ms <= r.ceiling + MARGIN_MS, r);
            }
        }
    }

    await browser.close();
    console.log('\n' + (fail ? '❌ ធ្លាក់ ' + fail + ' (ជោគជ័យ ' + pass + ')' : '✅ ជោគជ័យ ' + pass));
    process.exit(fail ? 1 : 0);
})();
