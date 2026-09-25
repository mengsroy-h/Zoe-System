// ថ្នាក់កំហុស៖ **សំបកដែល cache ទុករួច នៅតែរង់ចាំបណ្តាញមុនបង្ហាញ។**
//
// កំណែមុន sw.js ប្រណាំងរាល់សំណើនឹងបណ្តាញ ៣ វិនាទី៖
//     Promise.race([ networkFetch, setTimeout(() => cached, 3000) ])
// លើបណ្តាញខ្សោយ ការពន្យារនោះ **គុណតាមខ្សែសង្វាក់ផ្ទុក** —
// `index.html` (៣ វិ.) ➜ `app.js`/`style.css`/… (៣ វិ.) ➜ … —
// ដូច្នេះ App ដែលមានឯកសារ **គ្រប់ទាំងអស់ក្នុង cache** នៅតែត្រូវការ
// **៩ វិនាទី** ដើម្បីបើក។ វាស់បានលើ Chromium ពិត (server ពន្យារ ៥ វិ.)៖
//     មុនកែ ៩០៤០ ms   ➜   ក្រោយកែ ៧០ ms
// កំណែថ្មីរបស់សំបកមកតាមផ្លូវ `CACHE_VERSION` (install ទាញឡើងវិញទាំងក្រុម)
// មិនមែនតាមការប្រណាំងក្នុងមួយសំណើទេ ដូច្នេះការរង់ចាំនោះគ្មានតម្លៃអ្វីសោះ។
//
// តេស្តនេះក៏ចាក់សោការរឹតបន្តឹងទី ២ ដែរ៖ **មានតែផ្លូវរបស់សំបក ប៉ុណ្ណោះ
// ដែលអាចសរសេរចូល Cache Storage បាន**។ មុននេះ `cache.put()` ទទួលយក
// សំណើ same-origin **ណាមួយ** ដែល `ok` ➜ endpoint ទិន្នន័យនៅថ្ងៃក្រោយនឹង
// ធ្លាក់ចូល cache ហើយ **រស់រានក្រោយចាកចេញ** — ជាថ្នាក់កំហុសដដែលនឹងការ
// លេចធ្លាយ Setup Link ក្នុងកំណែ 2.11.6។
const fs = require('fs');
const http = require('http');
const path = require('path');

const ROOT = process.env.SWLATENCY_APP_DIR || path.join(__dirname, '..');
let pass = 0, fail = 0;
function ok(label, cond, detail) {
    if (cond) { pass++; console.log('  ok    ' + label); }
    else { fail++; console.log('  FAIL  ' + label + (detail !== undefined ? '\n        ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : '')); }
}

// === ផ្នែកទី ១ — រចនាសម្ព័ន្ធ sw.js ទាំង ៣ App ===
for (const app of ['ZoeW', 'ZoeKeyGen']) {
    const swPath = path.join(ROOT, app, 'sw.js');
    if (!fs.existsSync(swPath)) continue;
    const sw = fs.readFileSync(swPath, 'utf8');
    ok(app + ': sw.js មានបញ្ជីផ្លូវរបស់សំបក (SHELL_PATHS)', /const SHELL_PATHS = new Set\(/.test(sw));
    ok(app + ': **សំបកដែល cache ទុក ឆ្លើយតបភ្លាម មិនប្រណាំងនឹងបណ្តាញ**',
        /if \(cached && isShell\) \{/.test(sw), 'រកមិនឃើញផ្លូវ cache-first');
    ok(app + ': មានការធ្វើឲ្យស្រស់ខាងក្រោយ (revalidateShell)',
        /function revalidateShell\(/.test(sw) && /event\.waitUntil\(revalidateShell\(/.test(sw));
    ok(app + ': ការធ្វើឲ្យស្រស់រំលងពេលក្រៅបណ្តាញ (មិនដាស់វិទ្យុឥតបានការ)',
        /revalidateShell[\s\S]{0,220}navigator\.onLine === false/.test(sw));
    ok(app + ': **មានតែផ្លូវរបស់សំបកទេដែលសរសេរចូល Cache Storage បាន**',
        /if \(isShell && response && response\.ok/.test(sw), 'cache.put មិនត្រូវបានរឹតបន្តឹងតាម isShell');
    ok(app + ': clients.claim() ស្ថិតក្នុង waitUntil (activate មិនចប់មុនចាប់យក client)',
        /\)\.then\(\(\) => self\.clients\.claim\(\)\)/.test(sw));
}

// === ផ្នែកទី ២ — វាស់លើ Chromium ពិត ===
let chromium;
try { chromium = require('playwright-core').chromium; } catch (e) {
    console.log('\nSKIP ផ្នែក browser — ត្រូវការ playwright-core');
    console.log('\n' + (fail ? '❌ ធ្លាក់ ' + fail + ' (ជោគជ័យ ' + pass + ')' : '✅ ជោគជ័យ ' + pass));
    process.exit(fail ? 1 : 0);
}
const CHROME = process.env.SWLATENCY_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
if (!fs.existsSync(CHROME)) {
    console.log('\nSKIP ផ្នែក browser — រកមិនឃើញ Chromium');
    console.log('\n' + (fail ? '❌ ធ្លាក់ ' + fail + ' (ជោគជ័យ ' + pass + ')' : '✅ ជោគជ័យ ' + pass));
    process.exit(fail ? 1 : 0);
}

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm', '.png': 'image/png' };
const SERVER_DELAY_MS = 5000;      // បណ្តាញខ្សោយពិត — RTT ខ្ពស់
const WARM_BUDGET_MS = 2000;       // តិចជាងពិដានប្រណាំង ៣ វិ. យ៉ាងច្បាស់
let slow = false;

function serve(dir) {
    return new Promise((res) => {
        const s = http.createServer((req, rsp) => {
            const raw = req.url.split('?')[0];
            let p = decodeURIComponent(raw);
            // endpoint ទិន្នន័យ same-origin ក្លែងក្លាយ — វា **មិនត្រូវ** ចូល cache
            if (p === '/__data') {
                rsp.writeHead(200, { 'Content-Type': 'application/json' });
                return rsp.end('{"secretRow":"MUST-NOT-BE-CACHED"}');
            }
            if (p === '/') p = '/index.html';
            const f = path.join(dir, p);
            const send = () => {
                if (!f.startsWith(dir) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rsp.writeHead(404); return rsp.end(); }
                rsp.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'text/plain', 'Cache-Control': 'no-cache' });
                rsp.end(fs.readFileSync(f));
            };
            // `sw.js` ត្រូវឆ្លើយលឿនជានិច្ច ដើម្បីកុំវាស់ការចុះឈ្មោះជំនួសការបើក App
            if (slow && p !== '/sw.js') setTimeout(send, SERVER_DELAY_MS); else send();
        });
        s.listen(0, '127.0.0.1', () => res(s));
    });
}

(async () => {
    const dir = path.join(ROOT, 'ZoeW');
    const server = await serve(dir);
    const origin = 'http://127.0.0.1:' + server.address().port;
    const browser = await chromium.launch({ executablePath: CHROME });
    const ctx = await browser.newContext({ viewport: { width: 412, height: 780 } });
    await ctx.route('**', (r) => (r.request().url().startsWith(origin) ? r.continue() : r.abort()));
    const page = await ctx.newPage();

    // --- ជុំទី ១ ៖ បណ្តាញធម្មតា ➜ ចុះឈ្មោះ SW និងបំពេញ cache ---
    await page.goto(origin + '/', { waitUntil: 'load', timeout: 60000 });
    // ⛔ asset JS ស្នូល ដេរីវេពី `CORE_SHELL` ពិត (App React ៖ `assets/index-<hash>.js`)
    const swReady = await page.evaluate(async (APP_JS) => {
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
        for (let i = 0; i < 100; i++) {
            const keys = await caches.keys();
            for (const k of keys) { const c = await caches.open(k); if (await c.match(APP_JS)) return 'ok:' + k; }
            await new Promise((r) => setTimeout(r, 200));
        }
        return 'មិនចូល cache';
    }, require('./react-view').swShell(ROOT).appJs);
    ok('service worker ចុះឈ្មោះ ហើយសំបកចូល cache', String(swReady).startsWith('ok:'), swReady);
    const controlled = await page.evaluate(async () => {
        for (let i = 0; i < 100; i++) { if (navigator.serviceWorker.controller) return true; await new Promise((r) => setTimeout(r, 100)); }
        return false;
    });
    ok('service worker ចាប់យក client', controlled === true);

    // --- ជុំទី ២ ៖ បណ្តាញខ្សោយខ្លាំង តែ cache ពេញ ➜ ត្រូវបើកភ្លាម ---
    slow = true;
    const t0 = Date.now();
    await page.goto(origin + '/', { waitUntil: 'load', timeout: 180000 });
    const warmMs = Date.now() - t0;
    await require('./react-view').waitAuditBridge(page);
    const shell = await page.evaluate(() => ({
        hasShell: !!document.getElementById('appPages'),
        appJs: typeof window.initScanEngine === 'function'
    }));
    ok('**cache ពេញ + បណ្តាញយឺត ៥ វិ. ➜ App បើកក្នុង ' + warmMs + ' ms (ពិដាន ' + WARM_BUDGET_MS + ')**',
        warmMs < WARM_BUDGET_MS, 'warmMs=' + warmMs + ' — សំបកកំពុងរង់ចាំបណ្តាញម្តងទៀត');
    ok('សំបកបង្ហាញពេញលេញលើផ្លូវ cache-first', shell.hasShell && shell.appJs, shell);

    // --- ជុំទី ៣ ៖ សំណើ same-origin ក្រៅសំបក មិនត្រូវចូល Cache Storage ---
    slow = false;
    const dataProbe = await page.evaluate(async () => {
        const res = await fetch('/__data?secret=abc').catch(() => null);
        const body = res ? await res.text() : '';
        await new Promise((r) => setTimeout(r, 400));
        const keys = await caches.keys();
        const leaked = [];
        for (const k of keys) {
            const c = await caches.open(k);
            for (const req of await c.keys()) if (req.url.indexOf('__data') !== -1) leaked.push(req.url);
        }
        return { body: body.slice(0, 40), leaked };
    });
    ok('សំណើ same-origin ក្រៅសំបក នៅតែឆ្លងកាត់ដល់បណ្តាញធម្មតា',
        dataProbe.body.indexOf('MUST-NOT-BE-CACHED') !== -1, dataProbe.body);
    ok('**endpoint ទិន្នន័យ same-origin មិនធ្លាក់ចូល Cache Storage**',
        dataProbe.leaked.length === 0, dataProbe.leaked);

    // --- ជុំទី ៤ ៖ បណ្តាញដាច់ទាំងស្រុង ➜ សំបកនៅដើរ (កុំឲ្យការកែបំបែក offline) ---
    // `close()` រង់ចាំ connection keep-alive ដាច់ជាមុន — បើមិនបង្ខំវាទេ តេស្ត
    // អាចព្យួរដោយចៃដន្យ ហើយមើលទៅដូចកំហុសកូដ
    await new Promise((r) => {
        server.close(r);
        if (typeof server.closeAllConnections === 'function') server.closeAllConnections();
    });
    let bootError = null;
    page.on('pageerror', (e) => { if (!bootError) bootError = String(e && e.message || e); });
    await page.addInitScript(`window.addEventListener('unhandledrejection', function (ev) {
            var m; try { m = String((ev.reason && (ev.reason.message || ev.reason)) || 'unknown'); } catch (x) { m = 'unknown'; }
            setTimeout(function () { throw new Error('unhandledrejection: ' + m); }, 0);
        });`);
    await page.goto(origin + '/', { waitUntil: 'load', timeout: 60000 }).catch((e) => { bootError = String(e); });
    await require('./react-view').waitAuditBridge(page);
    const offline = await page.evaluate(() => ({
        hasShell: !!document.getElementById('appPages'),
        appJs: typeof window.initScanEngine === 'function',
        reader: typeof window.ZXingWASM === 'object'
    }));
    ok('បណ្តាញដាច់ទាំងស្រុង ➜ សំបក App នៅផ្ទុកបាន', offline.hasShell && offline.appJs, { offline, bootError });
    ok('បណ្តាញដាច់ទាំងស្រុង ➜ engine ស្កេននៅមកដដែល', offline.reader, offline);

    await ctx.close();
    await browser.close();
    console.log('\n' + (fail ? '❌ ធ្លាក់ ' + fail + ' (ជោគជ័យ ' + pass + ')' : '✅ ជោគជ័យ ' + pass));
    process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e && e.stack || e); process.exit(1); });
