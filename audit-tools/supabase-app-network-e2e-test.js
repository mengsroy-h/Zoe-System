// ថ្នាក់ ៖ **ហាង Supabase ពេលបណ្តាញខូច** ➜ App ជាប់ «ភ្ជាប់ Server រួចរាល់» ខណៈ server ស្លាប់ · មិនភ្ជាប់វិញដោយខ្លួនឯង · ទិន្នន័យដែលប្រែពេលដាច់
//        មិនមកដល់ — វាស់លើ **App ZoeW ពិត (build វាស់) + adapter Supabase ពិត + supabase-js ពិត + Postgres ពិត** ក្នុង Chromium។
//
// ⛔ ហេតុអ្វីតេស្តនេះចាំបាច់ ៖ `emu/app-network-e2e-test` វាស់ App ពិតលើ **Firebase** តែប៉ុណ្ណោះ · Supabase វាស់តែកម្រិត adapter ក្នុង node
//    (`emu/supabase-adapter-parity` · `ZoeW/tests/supabase-*.test.ts`) ➜ ថ្នេរ adapter ↔ App (`.info/connected` · ការវាស់ភាពរស់ ·
//    `forceDatabaseReconnect()` ➜ `goOffline/goOnline` · `onBrowserOnline` · ចំណុចស្ថានភាព) គ្មាននរណារត់ពីចុងមួយទៅចុងមួយទៀត។
//
// ឯកសារនេះរត់ ៖ fake GoTrue + PostgREST (`supabase-fake-server.js`) លើ Postgres ពិត (migration ពិត · rules ពិតដែល compile) ·
// Config Supabase ក្នុង localStorage · ចូលដោយឈ្មោះអ្នកប្រើ · realtime មិនក្លែង (upgrade ត្រូវបិទ) ➜ adapter ពឹងការទាញតាមវដ្ត ៖
//   ក. ចាប់ផ្តើម ➜ ចូលប្រព័ន្ធ ➜ «ភ្ជាប់ Server រួចរាល់» + history ពី Postgres
//   ខ. browser offline ➜ «ក្រៅបណ្ដាញ» · ការប្រែលើ server ពេលដាច់ ➜ online ➜ ភ្ជាប់វិញ + ទិន្នន័យមកដល់
//   គ. server ធ្លាក់ (socket បិទ) ពេល App ស្ងៀម ➜ វដ្ត ៦០ វិ. ឈប់រាយបៃតង ➜ server មកវិញ ➜ ភ្ជាប់វិញ + ទិន្នន័យ
//   ឃ. server **ព្យួរ** (មិនឆ្លើយ) ➜ វដ្ត ៦០ វិ. ឈប់រាយបៃតងក្នុងពិដាន (ការវាស់ ១០ វិ.) ➜ មកវិញ ➜ ភ្ជាប់វិញ
//   ង. ភ្ញាក់ពី background លើ server ព្យួរ ➜ ឈប់រាយបៃតង ➜ មកវិញ ➜ ភ្ជាប់វិញ
//   ច. realtime មិនដើរ + App ស្ងៀម ➜ ការប្រែលើ server មកដល់តាមការទាញតាមវដ្ត (មិនត្រូវចុចអ្វី)
//   ជ. បើក App ក្រោយ ៦.៥ ម៉ោង (token ផុត ➜ refresh · ម៉ោងចូលលើស ៤ ម៉ោង) ➜ cache ➜ ទាញ delta ➜ ផុតកំណត់ចាកចេញកណ្តាលការទាញ ➜ ចូលវិញដោយ
//      ពាក្យសម្ងាត់ដែលចងចាំ ➜ ទិន្នន័យគ្រប់ (ចម្លើយចាស់មិនដាក់ cursor លើសម័យថ្មី)
//   ឆ. គ្មានកំហុស runtime / unhandledrejection
//
//   npm ci --prefix supabase · npm ci --prefix ZoeW
//   M=$(ZOE_MEASURE_ONLY=1 bash audit-tools/run-all.sh | tail -1); (cd "$M" && node audit-tools/supabase-app-network-e2e-test.js)
'use strict';

process.exitCode = 1;

const fs = require('fs');
const http = require('http');
const path = require('path');
const { createPgHarness } = require('./supabase-pg.js');
const { startFakeSupabase } = require('./supabase-fake-server.js');

const ROOT = process.env.SBNETE2E_APP_DIR ? path.resolve(process.env.SBNETE2E_APP_DIR) : path.join(__dirname, '..');
const REPO = process.env.ZOE_REPO_ROOT ? path.resolve(process.env.ZOE_REPO_ROOT) : ROOT;
const DIR = path.join(ROOT, 'ZoeW');
const CHROME = process.env.SBNETE2E_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const STRICT = process.env.SBNETE2E_STRICT === '1' || process.env.SUPABASE_STRICT === '1';
const DEPS_DIRS = [process.env.SUPABASE_DEPS_DIR, path.join(ROOT, 'supabase', 'node_modules'), path.join(REPO, 'supabase', 'node_modules')].filter(Boolean);
const ZOEW_MODULES = [path.join(ROOT, 'ZoeW', 'node_modules'), path.join(REPO, 'ZoeW', 'node_modules')].find((d) => fs.existsSync(path.join(d, 'playwright-core')));
const ONLINE_TEXT = 'ភ្ជាប់ Server រួចរាល់';
const OFFLINE_TEXT = 'ក្រៅបណ្ដាញ';
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json',
    '.png': 'image/png', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.webmanifest': 'application/manifest+json' };

let pass = 0, fail = 0;
const check = (c, label, detail) => {
    if (c) { pass++; console.log('  ok    ' + label); }
    else { fail++; console.log('  FAIL  ' + label + (detail !== undefined ? '\n        ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : '')); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    console.log('=== supabase-app-network-e2e — App ពិត · adapter Supabase ពិត · Postgres ពិត · បណ្តាញខូច ===');

    const indexFile = path.join(DIR, 'index.html');
    const indexHtml = fs.existsSync(indexFile) ? fs.readFileSync(indexFile, 'utf8') : '';
    const bundle = (/src="\.\/(assets\/index-[^"]+\.js)"/.exec(indexHtml) || [])[1] || '';
    const bundleSize = bundle && fs.existsSync(path.join(DIR, bundle)) ? fs.statSync(path.join(DIR, bundle)).size : 0;
    check(bundleSize > 200000, 'ជាន់អប្បបរមា ៖ bundle ពិតរបស់ App (build វាស់ ZoeW/) មិនទទេ', { bundle, bundleSize });
    const backendChunk = fs.existsSync(path.join(DIR, 'assets')) && fs.readdirSync(path.join(DIR, 'assets')).some((f) => /^supabase-backend-.*\.js$/.test(f));
    check(backendChunk, 'ជាន់អប្បបរមា ៖ chunk `supabase-backend` (adapter ពិត) មានក្នុង build', backendChunk);

    const H = createPgHarness({ depsDirs: DEPS_DIRS, shimDir: path.join(__dirname, 'supabase-shim'),
        wantMajor: parseInt((fs.readFileSync(path.join(REPO, 'supabase', 'config.toml'), 'utf8').match(/^major_version\s*=\s*(\d+)\s*$/m) || [])[1] || '0', 10) });
    let chromium = null;
    try { chromium = require(path.join(ZOEW_MODULES || '', 'playwright-core')).chromium; } catch (e) { chromium = null; }
    const missing = !chromium || !fs.existsSync(CHROME) ? 'គ្មាន playwright-core (ZoeW/node_modules) ឬ Chromium' : H.unavailableReason();
    if (missing) {
        if (STRICT) { check(false, 'STRICT ➜ ' + missing + ' ត្រូវរាប់ជាការធ្លាក់'); console.log('\n❌ ធ្លាក់ ' + fail + ' / ok ' + pass); return; }
        console.log('SKIP — ' + missing);
        process.exitCode = fail ? 1 : 0;
        return;
    }
    if (fail) { console.log('\n❌ ធ្លាក់ ' + fail + ' / ok ' + pass); return; }

    let fake = null, pool = null, client = null, browser = null, staticServer = null;
    try {
        await H.start();
        const { c, name } = await H.freshDb('default-grants');
        client = c;
        c.on('error', () => {});
        const migDir = path.join(REPO, 'supabase', 'migrations');
        await c.query(fs.readdirSync(migDir).filter((f) => /^\d{14}_[a-z0-9_]+\.sql$/.test(f)).sort().map((f) => fs.readFileSync(path.join(migDir, f), 'utf8')).join('\n;\n'));
        const tenant = (await c.query("insert into public.tenants (name, branch_code, expires_at) values ('E2E', '200001', now() + interval '30 days') returning id")).rows[0].id;
        const uid = await H.makeAuthUser(c, 'sokha@users.zoew.invalid');
        await c.query("insert into public.tenant_members (user_id, tenant_id, username, role) values ($1, $2, 'sokha', 'owner')", [uid, tenant]);
        pool = new H.PG.Pool({ host: '127.0.0.1', port: c.connectionParameters.port, user: 'postgres', database: name, max: 12 });
        pool.on('error', () => {});
        fake = await startFakeSupabase({ pool });
        fake.addUser('sokha@users.zoew.invalid', 'pass-sokha-1', uid);

        const now = Date.now();
        const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Phnom_Penh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
        const mkItem = (id, phone, code, cod) => ({
            id, phone, cod, dod: 0, price: cod, count: 1, isClosed: false, isCalled: false,
            barcodes: [{ code, cod, dod: 0, locker: '', isClosed: false, isDeducted: false, isFromDeletion: false, createdAt: now - 3600000, time: '09:00:00 (' + day + ')' }],
            time: '09:00:00 (' + day + ')', scanDate: day, createdAt: now - 3600000
        });
        let opSeq = 0;
        const serverWrite = (ops) => pool.query('select private.zoe_apply($1::uuid, $2, $3::jsonb, false, false) as r',
            [tenant, 'e2eseed' + String(++opSeq).padStart(12, '0'), JSON.stringify(ops)]);
        const addServerItem = (id, phone, code) => serverWrite([{ k: 'set', p: ['zoew_scan_history_cod_dod', id], v: mkItem(id, phone, code, 3) }]);
        await serverWrite([
            { k: 'set', p: ['zoew_scan_history_cod_dod', 'n1'], v: mkItem('n1', '012000001', 'SBN1', 5) },
            { k: 'set', p: ['zoew_scan_history_cod_dod', 'n2'], v: mkItem('n2', '012000002', 'SBN2', 7) },
            { k: 'set', p: ['zoew_barcode_registry', 'SBN1'], v: true },
            { k: 'set', p: ['zoew_barcode_registry', 'SBN2'], v: true }
        ]);
        const seeded = (await pool.query("select count(*)::int as n from public.zoe_docs where tenant_id = $1 and root = 'zoew_scan_history_cod_dod' and value is not null", [tenant])).rows[0].n;
        check(seeded === 2, 'សាប history ២ ជួរលើ Postgres ពិត (private.zoe_apply)', seeded);

        staticServer = await new Promise((res) => {
            const s = http.createServer((req, rsp) => {
                let p = decodeURIComponent(req.url.split('?')[0]);
                if (p === '/') p = '/index.html';
                let f = path.join(DIR, p);
                if (!f.startsWith(DIR) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = indexFile;
                rsp.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'text/plain', 'Cache-Control': 'no-cache' });
                rsp.end(fs.readFileSync(f));
            });
            s.listen(0, '127.0.0.1', () => res(s));
        });
        const origin = 'http://127.0.0.1:' + staticServer.address().port;
        const config = { supabaseUrl: fake.url, supabaseKey: 'sb_publishable_' + 'e2e'.repeat(10), loginDomain: 'users.zoew.invalid' };

        browser = await chromium.launch({ executablePath: CHROME, args: ['--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1'] });
        const ctx = await browser.newContext({ viewport: { width: 412, height: 780 }, serviceWorkers: 'block' });
        await ctx.route(/\/license-verify\.js(\?|$)/, (route) => route.fulfill({ status: 200, contentType: 'application/javascript', body: `window.ZoeLicense = {
            getStatus: function () { return Promise.resolve({ state: 'active' }); },
            setServerTimeOffset: function () {},
            syncServerTime: function () { return Promise.resolve(); },
            activate: function () { return Promise.resolve({ valid: true }); },
            checkOnline: function () { return Promise.resolve({ ok: true }); },
            announcementsUrl: function () { return ''; },
            clearActivation: function () {}
        };` }));
        await ctx.addInitScript((cfg) => {
            try { if (!localStorage.getItem('zoew_firebase_config')) localStorage.setItem('zoew_firebase_config', cfg); } catch (e) {}
            window.__hiddenOverride = null;
            const desc = (prop, fallback) => ({ configurable: true, get() { return window.__hiddenOverride === null ? fallback.call(document) : (prop === 'hidden' ? window.__hiddenOverride : (window.__hiddenOverride ? 'hidden' : 'visible')); } });
            const hid = Object.getOwnPropertyDescriptor(Document.prototype, 'hidden');
            const vis = Object.getOwnPropertyDescriptor(Document.prototype, 'visibilityState');
            if (hid && vis) {
                Object.defineProperty(document, 'hidden', desc('hidden', hid.get));
                Object.defineProperty(document, 'visibilityState', desc('visibilityState', vis.get));
            }
            // ⛔ វដ្ត ≥ ៦០ វិ. ចាប់ទុក ➜ តេស្តបាញ់វាពេលដែលខ្លួនចង់ (ដូច emu/app-network-e2e) ៖ បើមិនដូច្នេះវដ្តអាចរកឃើញការដាច់ជំនួសទ្វារ
            //    ដែលផ្នែកនីមួយៗវាស់ ➜ mutation រស់រានដោយចៃដន្យ
            const realSetInterval = window.setInterval.bind(window);
            const captured = [];
            window.setInterval = function (fn, ms) {
                if (typeof fn === 'function' && Number(ms) >= 60000) { captured.push({ fn, ms: Number(ms) }); return 0; }
                return realSetInterval.apply(window, arguments);
            };
            window.__fireIntervals = (ms) => { let n = 0; captured.forEach((c) => { if (c.ms === ms) { n++; try { c.fn(); } catch (e) {} } }); return n; };
            const realNow = Date.now.bind(Date);
            let skew = 0;
            Date.now = () => realNow() + skew;
            window.__zoeSkew = (ms) => { skew += ms; };
        }, JSON.stringify(config));
        await ctx.addInitScript(`window.addEventListener('unhandledrejection', function (ev) {
                var m; try { m = String((ev.reason && (ev.reason.message || ev.reason)) || 'unknown'); } catch (x) { m = 'unknown'; }
                setTimeout(function () { throw new Error('unhandledrejection: ' + m); }, 0);
            });`);

        const page = await ctx.newPage();
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e && e.message)));
        const statusText = () => page.evaluate(() => { const el = document.getElementById('firebaseStatusText'); return el ? el.textContent : ''; }).catch(() => '');
        const historyCount = () => page.evaluate(() => (Array.isArray(window.scanHistory) ? window.scanHistory.length : -1)).catch(() => -1);
        const waitUntil = async (fn, ms) => {
            const t0 = Date.now();
            while (Date.now() - t0 < ms) {
                if (await fn()) return Date.now() - t0;
                await sleep(200);
            }
            return (await fn()) ? Date.now() - t0 : -1;
        };
        const setHidden = (hidden) => page.evaluate((h) => { window.__hiddenOverride = h; document.dispatchEvent(new Event('visibilitychange')); }, hidden);
        const timings = {};

        // ── ក ──
        console.log('\n── ក. ចាប់ផ្តើម · ចូលប្រព័ន្ធ (Supabase) · ទិន្នន័យមកដល់ ──');
        await page.goto(origin + '/', { waitUntil: 'load' });
        const loginShown = await waitUntil(() => page.evaluate(() => { const m = document.getElementById('loginModal'); return !!m && getComputedStyle(m).display !== 'none'; }).catch(() => false), 20000);
        check(loginShown >= 0, 'ប្រអប់ចូលប្រព័ន្ធលេច (Config Supabase · chunk adapter ផ្ទុកបាន)', { loginShown, status: await statusText() });
        await page.fill('#loginEmailInput', 'sokha');
        await page.fill('#loginPasswordInput', 'pass-sokha-1');
        await page.click('#loginBtn');
        const bootOnline = await waitUntil(async () => (await statusText()) === ONLINE_TEXT && (await historyCount()) === 2, 30000);
        check(bootOnline >= 0, '«' + ONLINE_TEXT + '» + history ២ ជួរពី Postgres ពិត', { status: await statusText(), history: await historyCount() });
        const rpcCalls = fake.requests.filter((r) => /^\/rest\/v1\/rpc\/zoe_pull$/.test(r.path)).length;
        check(rpcCalls >= 1, 'លក្ខខណ្ឌចាំបាច់ ៖ App ទាញតាម `zoe_pull` លើ fake server (មិនមែន cache/ឯកសារក្លែង)', rpcCalls);

        // ── ខ ──
        console.log('\n── ខ. browser offline ➜ online ──');
        await ctx.setOffline(true);
        const offlineAt = await waitUntil(async () => (await statusText()) === OFFLINE_TEXT, 5000);
        check(offlineAt >= 0, 'offline ➜ «' + OFFLINE_TEXT + '» ក្នុង ៥ វិ.', { ms: offlineAt, status: await statusText() });
        await addServerItem('n3', '012000003', 'SBN3');
        await sleep(1500);
        await ctx.setOffline(false);
        const backAt = await waitUntil(async () => (await statusText()) === ONLINE_TEXT && (await historyCount()) === 3, 20000);
        timings.offline = { statusMs: offlineAt, onlineMs: backAt };
        check(backAt >= 0, 'online ➜ «' + ONLINE_TEXT + '» + ការប្រែលើ server ពេលដាច់មកដល់ ក្នុង ២០ វិ.', { ms: backAt, status: await statusText(), history: await historyCount() });

        // ── គ ──
        console.log('\n── គ. server ធ្លាក់ (socket បិទ) ពេល App ស្ងៀម ➜ វដ្ត ៦០ វិ. ──');
        await sleep(1500);
        fake.setMode('down');
        await page.evaluate(() => window.__zoeSkew(120000));
        const downTicks = await page.evaluate(() => window.__fireIntervals(60000));
        const downLeft = await waitUntil(async () => (await statusText()) !== ONLINE_TEXT, 25000);
        check(downTicks >= 1 && downLeft >= 0, '⛔ server ធ្លាក់ ➜ វដ្ត ៦០ វិ. ឈប់រាយ «' + ONLINE_TEXT + '» ក្នុង ២៥ វិ.', { ticks: downTicks, ms: downLeft, status: await statusText() });
        await addServerItem('n4', '012000004', 'SBN4');
        fake.setMode('ok');
        const downBack = await waitUntil(async () => (await statusText()) === ONLINE_TEXT && (await historyCount()) === 4, 75000);
        timings.down = { leftGreenMs: downLeft, recoveredMs: downBack };
        check(downBack >= 0, 'server មកវិញ ➜ ភ្ជាប់វិញដោយខ្លួនឯង + ទិន្នន័យថ្មីមកដល់ ក្នុង ៧៥ វិ.', { ms: downBack, status: await statusText(), history: await historyCount() });

        // ── ឃ ──
        console.log('\n── ឃ. server ព្យួរ (មិនឆ្លើយ) ពេល App ស្ងៀម ➜ វដ្ត ៦០ វិ. ──');
        await sleep(1500);
        fake.setMode('hang');
        await page.evaluate(() => window.__zoeSkew(120000));
        const hangTicks = await page.evaluate(() => window.__fireIntervals(60000));
        const hangLeft = await waitUntil(async () => (await statusText()) !== ONLINE_TEXT, 15000);
        check(hangTicks >= 1 && hangLeft >= 0, '⛔ server ព្យួរ ➜ ឈប់រាយ «' + ONLINE_TEXT + '» ក្នុង ១៥ វិ. (ការវាស់ភាពរស់ ១០ វិ. · មិនមែនពិដាន RPC ២០ វិ.)', { ticks: hangTicks, ms: hangLeft, status: await statusText() });
        await addServerItem('n5', '012000005', 'SBN5');
        fake.setMode('ok');
        const hangBack = await waitUntil(async () => (await statusText()) === ONLINE_TEXT && (await historyCount()) === 5, 75000);
        timings.hang = { leftGreenMs: hangLeft, recoveredMs: hangBack };
        check(hangBack >= 0, 'server មកវិញ ➜ ភ្ជាប់វិញ + ទិន្នន័យថ្មីមកដល់ ក្នុង ៧៥ វិ.', { ms: hangBack, status: await statusText(), history: await historyCount() });

        // ── ង ──
        console.log('\n── ង. ភ្ញាក់ពី background លើ server ព្យួរ ──');
        await sleep(1500);
        await setHidden(true);
        fake.setMode('hang');
        await page.evaluate(() => window.__zoeSkew(120000));
        await setHidden(false);
        const resumeLeft = await waitUntil(async () => (await statusText()) !== ONLINE_TEXT, 15000);
        check(resumeLeft >= 0, '⛔ ភ្ញាក់ពី background លើ server ព្យួរ ➜ ឈប់រាយ «' + ONLINE_TEXT + '» ក្នុង ១៥ វិ.', { ms: resumeLeft, status: await statusText() });
        await addServerItem('n6', '012000006', 'SBN6');
        fake.setMode('ok');
        const resumeBack = await waitUntil(async () => (await statusText()) === ONLINE_TEXT && (await historyCount()) === 6, 75000);
        timings.resume = { leftGreenMs: resumeLeft, recoveredMs: resumeBack };
        check(resumeBack >= 0, 'server មកវិញ ➜ ភ្ជាប់វិញ + ទិន្នន័យថ្មីមកដល់ ក្នុង ៧៥ វិ.', { ms: resumeBack, status: await statusText(), history: await historyCount() });

        // ── ច ──
        console.log('\n── ច. realtime មិនដើរ + App ស្ងៀម ➜ ការទាញតាមវដ្ត ──');
        await sleep(1000);
        await addServerItem('n7', '012000007', 'SBN7');
        const pollAt = await waitUntil(async () => (await historyCount()) === 7, 45000);
        timings.poll = { ms: pollAt };
        check(pollAt >= 0, 'ការប្រែលើ server (ឧបករណ៍ផ្សេង) មកដល់ដោយមិនចុចអ្វី ក្នុង ៤៥ វិ. (realtime ងាប់ ➜ ការទាញតាមវដ្ត)', { ms: pollAt, history: await historyCount() });
        check((await statusText()) === ONLINE_TEXT, 'ទិសផ្ទុយ ៖ realtime មិនដើរ តែ server ល្អ ➜ ស្ថានភាពនៅបៃតង', await statusText());

        // ── ជ ──
        console.log('\n── ជ. បើក App ក្រោយ ៦.៥ ម៉ោង ➜ ផុតកំណត់ ៤ ម៉ោង ➜ ចូលវិញដោយពាក្យសម្ងាត់ដែលចងចាំ ──');
        const loginVisible = () => page.evaluate(() => { const m = document.getElementById('loginModal'); return !!m && getComputedStyle(m).display !== 'none'; }).catch(() => null);
        const pullsOf = (from) => fake.requests.slice(from).filter((r) => r.path === '/rest/v1/rpc/zoe_pull').map((r) => (r.body && r.body.p_since !== undefined ? Number(r.body.p_since) : -1));
        const wholeHistory = await historyCount();
        await sleep(2500);
        const authStore = await page.evaluate(() => {
            for (const kind of ['localStorage', 'sessionStorage']) {
                const raw = window[kind].getItem('zoew-sb-auth');
                if (raw) return { kind, raw };
            }
            return null;
        });
        check(!!authStore && wholeHistory === 7, 'លក្ខខណ្ឌចាំបាច់ ៖ session supabase-js នៅក្នុង storage + history ៧ ជួរ', { store: authStore && authStore.kind, history: wholeHistory });
        const oldSession = JSON.parse((authStore && authStore.raw) || '{}');
        oldSession.expires_at = Math.floor(Date.now() / 1000) - 60;
        await page.evaluate(([kind, v]) => window[kind].setItem('zoew-sb-auth', v), [(authStore && authStore.kind) || 'localStorage', JSON.stringify(oldSession)]);
        fake.setAuthAge(Math.round(6.5 * 3600));
        const reloadMark = fake.requests.length;
        await page.reload({ waitUntil: 'load' });
        const expiredAt = await waitUntil(async () => (await loginVisible()) === true, 30000);
        await sleep(1500);
        const logoutAt = fake.requests.slice(reloadMark).findIndex((r) => /\/auth\/v1\/logout/.test(r.path));
        const pullsAroundExpiry = pullsOf(reloadMark);
        const refreshed = fake.requests.slice(reloadMark).filter((r) => /grant_type=refresh_token/.test(r.search || '')).length;
        check(expiredAt >= 0 && refreshed >= 1 && logoutAt >= 0, 'លក្ខខណ្ឌចាំបាច់ ៖ token ផុត ➜ refresh ➜ ការផុតកំណត់ ៤ ម៉ោងចាកចេញ ➜ ប្រអប់ចូលលេច', { expiredAt, refreshed, logoutAt });
        check(pullsAroundExpiry.some((since) => since > 0), 'លក្ខខណ្ឌចាំបាច់ ៖ ការទាញ delta ពី cache (`p_since > 0`) ឆ្លងកាត់ការចាកចេញ (ស្ថានភាពដែលផ្នែកនេះវាស់)', pullsAroundExpiry);
        fake.setAuthAge(0);
        const prefilled = await page.evaluate(() => ({ email: document.getElementById('loginEmailInput').value, pw: (document.getElementById('loginPasswordInput').value || '').length }));
        check(prefilled.email === 'sokha' && prefilled.pw > 0, 'ប្រអប់ចូលបំពេញឈ្មោះ និងពាក្យសម្ងាត់ដែលចងចាំ', prefilled);
        if (!prefilled.pw) await page.fill('#loginPasswordInput', 'pass-sokha-1');
        const reloginMark = fake.requests.length;
        await page.click('#loginBtn');
        const reloginAt = await waitUntil(async () => (await statusText()) === ONLINE_TEXT && (await historyCount()) === wholeHistory, 30000);
        const reloginPulls = pullsOf(reloginMark);
        timings.expiry = { ms: reloginAt, pulls: reloginPulls };
        check(reloginAt >= 0, '⛔ ចូលវិញក្រោយផុតកំណត់ ➜ history ' + wholeHistory + ' ជួរគ្រប់ (មិនមែន «គ្មាន» ឬ «តែ ២-៣») ក្នុង ៣០ វិ.',
            { ms: reloginAt, history: await historyCount(), status: await statusText(), pulls: reloginPulls });
        check(reloginPulls.length > 0 && reloginPulls[0] === 0, '⛔ ការទាញដំបូងក្រោយចូលវិញចាប់ពីដើម (`p_since = 0`) — cursor សម័យចាស់មិនរស់', reloginPulls);

        // ── ឆ ──
        console.log('\n── ឆ. កំហុស runtime ──');
        const noisy = errors.filter((e) => !/sentry|gstatic|fonts\.googleapis|ERR_|Failed to fetch|NetworkError|websocket|realtime/i.test(e));
        check(noisy.length === 0, 'គ្មានកំហុស runtime / unhandledrejection', noisy.slice(0, 5));
        console.log('      ⏱  ' + JSON.stringify(timings));
    } finally {
        if (browser) await browser.close().catch(() => {});
        if (staticServer) staticServer.close();
        if (fake) await fake.close().catch(() => {});
        if (pool) await pool.end().catch(() => {});
        if (client) await client.end().catch(() => {});
        try { await H.stop(); } catch (e) {}
    }

    console.log('\n' + (fail ? '❌ ធ្លាក់ ' + fail + ' / ok ' + pass : '✅ ជោគជ័យ ' + pass + ' ការអះអាង'));
    process.exitCode = fail ? 1 : 0;
    setTimeout(() => process.exit(process.exitCode), 50).unref();
})().catch((e) => {
    console.log('  FAIL  checker គាំង ៖ ' + (e && e.stack || e));
    process.exitCode = 1;
    setTimeout(() => process.exit(1), 50).unref();
});
