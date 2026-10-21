// ថ្នាក់ ៖ **គម្រោង Supabase តែមួយ · ហាងច្រើន · ឧបករណ៍ ៣ ក្នុងហាងនីមួយៗ** (ដូចពេលអតិថិជនច្រើន សាខាច្រើន ប្រើ ២–៣ ទូរស័ព្ទក្នុងសាខា)
//        ធ្វើប្រតិបត្តិការលុយ **ស្របគ្នា** — វាស់លើ **App ZoeW ពិត (build វាស់) + adapter Supabase ពិត + supabase-js ពិត + Postgres ពិត
//        (migration ពិត · rules ពិតដែល compile · RLS)** ក្នុង Chromium (context មួយក្នុងឧបករណ៍មួយ)។
//
// ⛔ ហេតុអ្វីតេស្តនេះចាំបាច់ ៖ `emu/money-multidevice-emu-test` វាស់ឧបករណ៍ច្រើនលើ **Firebase** តែប៉ុណ្ណោះ (គម្រោងមួយ = ហាងមួយ) ·
//    `supabase-app-network-e2e-test` វាស់ **ឧបករណ៍ ១** · `supabase-rls-test` វាស់ការបំបែកហាងលើ SQL តែមិនមែនតាម App ពិត ➜ គ្មាននរណាវាស់
//    ហាងច្រើនដែលសរសេរព្រមគ្នាលើ `zoe_write` (សោ tenant · CAS · `op_id` ដដែលពេលផ្ញើឡើងវិញ) ក្នុងពេល ឧបករណ៍ក្នុងហាងប្រជែងគ្នាលើលុយដដែល។
//
// ជុំនីមួយៗ ៖ ឧបករណ៍គ្រប់ហាងចាប់ផ្តើមប្រតិបត្តិការព្រមគ្នា (ស្កេន · បិទ · ដក · លុប · ស្តារ · កែតម្លៃ · ការសម្អាត ២h/៧ថ្ងៃប្រជែង ·
// ZTO ស្កេនត្រឡប់ ➜ ធុងសំរាម «ត្រឡប់» លើ barcode ដដែលពីគ្រប់ឧបករណ៍ក្នុងហាង) ខណៈ adapter offline (`fb.goOffline(db)`) រួចភ្ជាប់វិញ ឬ **reload**
// (queue បាត់ ➜ journal ផ្ញើ `op_id` ដដែលឡើងវិញ) · ក្រោយឧបករណ៍ស្ងប់ អានដើមឈើ `zoe_docs` របស់ហាងនីមួយៗពី Postgres ហើយផ្ទៀង ៖
//   ១. អថេរលុយរួម (`money-multidevice-core.js`) ក្នុងហាងនីមួយៗ ៖ ledger ថ្ងៃ = ផលបូក barcode មិនទាន់ដក · ខែ = ផលបូកថ្ងៃ · ស្ថិតិយក = barcode បិទ ·
//      barcode មិនស្ទួន · registry មិនកំព្រា · barcode ដែលដល់ server មិនបាត់
//   ២. ហាងមិនលេចចូលគ្នា ៖ barcode របស់ហាងមួយមិនមាននៅ server ឬក្នុងទិដ្ឋភាព (`scanHistory` · `deletedItems`) របស់ឧបករណ៍ហាងផ្សេង
//   ៣. គ្មានឧបករណ៍ `blocked` · journal ទទេ · គ្មានកំហុស runtime / unhandledrejection
// ⛔ ជាន់អប្បបរមា ៖ ប្រតិបត្តិការស្របគ្នាឆ្លងហាង · «ZTO ត្រឡប់» ប្រជែង · ការចាក់ offline+reload · offline+online ត្រូវបាញ់ពិត។
// ⛔ Realtime មិនធ្វើត្រាប់ (fake server) ➜ ទិដ្ឋភាពឧបករណ៍ចាស់រហូតដល់ `goOnline` ➜ ប្រតិបត្តិការលើទិដ្ឋភាពចាស់ = CAS conflict ពិត (ជាផ្នែកនៃការវាស់)។
// Cookie/Palm destruction matrix ពេញលេញលើហាង ០ (គ្រប់ flow × network × auth) ៖ ក្រោយជំហាននីមួយៗ ដើមឈើ server ទាំងមូលនៃហាងជិតខាងត្រូវនៅដដែល។
// បន្ទាប់មកជុំស្របគ្នាខាងក្រោមនៅតែវាស់គ្រប់ហាង និងគ្រប់ឧបករណ៍។ មិនដំណើរការ matrix ដដែលស្ទួនក្នុងហាងជិតខាងទេ។
//
//   npm ci --prefix supabase · npm ci --prefix ZoeW
//   M=$(ZOE_MEASURE_ONLY=1 bash audit-tools/run-all.sh | tail -1); (cd "$M" && node audit-tools/supabase-money-multishop-test.js)
// env ៖ SBMONEY_APP_DIR · SBMONEY_STRICT (ឬ SUPABASE_STRICT) · SBMONEY_CHROME · SBMONEY_SHOPS · SBMONEY_DEVICES · SBMONEY_OPS · SBMONEY_RUN0 · SBMONEY_DEBUG=1
'use strict';

process.exitCode = 1;

const fs = require('fs');
const http = require('http');
const path = require('path');
const assert = require('node:assert/strict');
const { createPgHarness } = require('./supabase-pg.js');
const { startFakeSupabase } = require('./supabase-fake-server.js');
const { r2, rng, LICENSE_STUB, invariant, invariantBroken, openBarcodeTargets, PAGE_OPS } = require('./money-multidevice-core.js');
const { cookieFixture, networkGate, restoreFlows } = require('./money-cookie-blob.js');

const ROOT = process.env.SBMONEY_APP_DIR ? path.resolve(process.env.SBMONEY_APP_DIR) : path.join(__dirname, '..');
const REPO = process.env.ZOE_REPO_ROOT ? path.resolve(process.env.ZOE_REPO_ROOT) : ROOT;
const DIR = path.join(ROOT, 'ZoeW');
const CHROME = process.env.SBMONEY_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const STRICT = process.env.SBMONEY_STRICT === '1' || process.env.SUPABASE_STRICT === '1';
const SHOPS = Math.max(2, Math.min(16, parseInt(process.env.SBMONEY_SHOPS || '2', 10) || 2));
const DEVICES = Math.max(2, Math.min(4, parseInt(process.env.SBMONEY_DEVICES || '3', 10) || 3));
const OPS = Math.max(2, parseInt(process.env.SBMONEY_OPS || '6', 10) || 6);
const RUN0 = parseInt(process.env.SBMONEY_RUN0 || '0', 10) || 0;
const DEBUG = process.env.SBMONEY_DEBUG === '1';
const DEPS_DIRS = [process.env.SUPABASE_DEPS_DIR, path.join(ROOT, 'supabase', 'node_modules'), path.join(REPO, 'supabase', 'node_modules')].filter(Boolean);
const ZOEW_MODULES = [path.join(ROOT, 'ZoeW', 'node_modules'), path.join(REPO, 'ZoeW', 'node_modules')].find((d) => fs.existsSync(path.join(d, 'playwright-core')));
const ONLINE_TEXT = 'ភ្ជាប់ Server រួចរាល់';
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json',
    '.png': 'image/png', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.webmanifest': 'application/manifest+json' };
const OPNAMES = ['scan', 'closeOrder', 'closeBarcode', 'removeBarcode', 'deleteItem', 'restore', 'editPrice', 'sweep', 'closeBarcode', 'removeBarcode', 'restore', 'zreturn'];

let pass = 0, fail = 0;
const check = (c, label, detail) => {
    if (c) { pass++; console.log('  ok    ' + label); }
    else { fail++; console.log('  FAIL  ' + label + (detail !== undefined ? '\n        ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : '')); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    console.log('=== supabase-money-multishop — ហាង ' + SHOPS + ' × ឧបករណ៍ ' + DEVICES + ' · App ពិត · adapter ពិត · Postgres ពិត · លុយស្របគ្នា ===');
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

    let fake = null, pool = null, client = null, browser = null, staticServer = null, cookie = null;
    const contexts = [];
    try {
        await H.start();
        const { c, name } = await H.freshDb('default-grants');
        client = c;
        c.on('error', () => {});
        const migDir = path.join(REPO, 'supabase', 'migrations');
        await c.query(fs.readdirSync(migDir).filter((f) => /^\d{14}_[a-z0-9_]+\.sql$/.test(f)).sort().map((f) => fs.readFileSync(path.join(migDir, f), 'utf8')).join('\n;\n'));
        pool = new H.PG.Pool({ host: '127.0.0.1', port: c.connectionParameters.port, user: 'postgres', database: name, max: 16 });
        pool.on('error', () => {});
        fake = await startFakeSupabase({ pool, jwtIssuer: true });
        cookie = cookieFixture(ROOT, { supabaseUrl: fake.url, supabaseKey: 'sb_publishable_' + 'mms'.repeat(10) });

        const now = Date.now();
        const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Phnom_Penh', year: 'numeric', month: '2-digit', day: '2-digit' });
        const dateKey = fmt.format(now);
        const monthKey = dateKey.slice(0, 7);
        let opSeq = 0;
        const serverWrite = (tenant, ops) => pool.query('select private.zoe_apply($1::uuid, $2, $3::jsonb, false, false) as r',
            [tenant, 'sbmoney' + String(++opSeq).padStart(12, '0'), JSON.stringify(ops)]);
        const tree = async (tenant) => {
            const rows = (await pool.query('select root, key, value from public.zoe_docs where tenant_id = $1 and value is not null', [tenant])).rows;
            const t = {};
            for (const row of rows) { if (!t[row.root]) t[row.root] = {}; t[row.root][row.key] = row.value; }
            return t;
        };

        const shops = [];
        for (let s = 0; s < SHOPS; s++) {
            const tenant = (await c.query("insert into public.tenants (name, branch_code, expires_at) values ($1, $2, now() + interval '30 days') returning id",
                ['Shop ' + s, String(200101 + s)])).rows[0].id;
            const r = rng(9100 + RUN0 * 31 + s * 7);
            const items = {}; const registry = {}; const knownCodes = [];
            let cod = 0, dod = 0, cnt = 0;
            for (let i = 0; i < 5; i++) {
                const n = 1 + Math.floor(r() * 3);
                const bcs = [];
                for (let k = 0; k < n; k++) {
                    const code = 'S' + s + 'M' + i + '_' + k;
                    bcs.push({ code, cod: Math.round(r() * 3000) / 100, dod: Math.round(r() * 400) / 100 });
                    registry[code] = true; knownCodes.push(code);
                }
                const id = 's' + s + 'm' + i;
                items[id] = {
                    id, phone: '0120' + String(100000 + s * 100 + i * 7), scanDate: dateKey, createdAt: now - 3600000, time: '09:00:00 (' + dateKey + ')',
                    isClosed: false, isCalled: false, count: bcs.length, barcode: bcs[bcs.length - 1].code,
                    cod: r2(bcs.reduce((a, b) => a + b.cod, 0)), dod: r2(bcs.reduce((a, b) => a + b.dod, 0)), price: r2(bcs.reduce((a, b) => a + b.cod + b.dod, 0)),
                    barcodes: bcs.map((b) => ({ code: b.code, time: '09:00:00 (' + dateKey + ')', cod: b.cod, dod: b.dod, locker: 'A1', isClosed: false, isDeducted: false, isFromDeletion: false, createdAt: now - 3600000 }))
                };
                bcs.forEach((b) => { cod += b.cod; dod += b.dod; cnt++; });
            }
            const ops = [];
            Object.keys(items).forEach((id) => ops.push({ k: 'set', p: ['zoew_scan_history_cod_dod', id], v: items[id] }));
            Object.keys(registry).forEach((code) => ops.push({ k: 'set', p: ['zoew_barcode_registry', code], v: true }));
            ops.push({ k: 'set', p: ['zoew_settings', 'exchange_rate'], v: 4100 });
            ops.push({ k: 'set', p: ['zoew_daily_revenue_cod_dod', dateKey], v: { codDollar: r2(cod), dodDollar: r2(dod), totalCount: cnt } });
            ops.push({ k: 'set', p: ['zoew_monthly_revenue_cod_dod', monthKey], v: { codDollar: r2(cod), dodDollar: r2(dod), totalCount: cnt } });
            await serverWrite(tenant, ops);
            const users = [];
            for (let d = 0; d < DEVICES; d++) {
                const username = 's' + s + 'd' + d;
                const email = username + '@users.zoew.invalid';
                const uid = await H.makeAuthUser(c, email);
                await c.query('insert into public.tenant_members (user_id, tenant_id, username, role) values ($1, $2, $3, $4)', [uid, tenant, username, d === 0 ? 'owner' : 'member']);
                fake.addUser(email, 'pass-' + username, uid);
                users.push({ username, password: 'pass-' + username });
            }
            shops.push({ index: s, tenant, users, knownCodes, r, devices: [], trail: [] });
        }
        const seeded = await Promise.all(shops.map(async (shop) => Object.keys((await tree(shop.tenant)).zoew_scan_history_cod_dod || {}).length));
        check(seeded.every((n) => n === 5), 'សាប history ៥ ជួរក្នុងហាងនីមួយៗលើ Postgres ពិត (private.zoe_apply)', seeded);

        staticServer = await new Promise((res) => {
            const srv = http.createServer((req, rsp) => {
                if (req.url.startsWith('/.netlify/functions/zto-order-detail')) { void cookie.serve(req, rsp); return; }
                let p = decodeURIComponent(req.url.split('?')[0]);
                if (p === '/') p = '/index.html';
                let f = path.join(DIR, p);
                if (!f.startsWith(DIR) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = indexFile;
                rsp.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'text/plain', 'Cache-Control': 'no-cache' });
                rsp.end(fs.readFileSync(f));
            });
            srv.listen(0, '127.0.0.1', () => res(srv));
        });
        const origin = 'http://127.0.0.1:' + staticServer.address().port;
        const config = { supabaseUrl: fake.url, supabaseKey: 'sb_publishable_' + 'mms'.repeat(10), loginDomain: 'users.zoew.invalid' };
        browser = await chromium.launch({ executablePath: CHROME, args: ['--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1'] });

        const makeDevice = async (shop, user) => {
            const ctx = await browser.newContext({ viewport: { width: 412, height: 780 }, serviceWorkers: 'block' });
            contexts.push(ctx);
            const gate = await networkGate(ctx, 'supabase');
            await ctx.route(/\/license-verify\.js(\?|$)/, (route) => route.fulfill({ status: 200, contentType: 'application/javascript', body: LICENSE_STUB }));
            await ctx.addInitScript((cfg) => {
                try { if (!localStorage.getItem('zoew_firebase_config')) localStorage.setItem('zoew_firebase_config', cfg); } catch (e) {}
                const realSetInterval = window.setInterval.bind(window);
                window.setInterval = function (fn, ms) { if (typeof fn === 'function' && Number(ms) >= 60000) return 0; return realSetInterval.apply(window, arguments); };
                window.addEventListener('unhandledrejection', function (ev) {
                    let m; try { m = String((ev.reason && (ev.reason.message || ev.reason)) || 'unknown'); } catch (x) { m = 'unknown'; }
                    setTimeout(function () { throw new Error('unhandledrejection: ' + m); }, 0);
                });
            }, JSON.stringify(config));
            await ctx.addInitScript('(' + PAGE_OPS.toString() + ')();');
            let page = await ctx.newPage();
            const errors = [];
            page.on('pageerror', (e) => errors.push(String(e && e.message)));
            page.on('dialog', (d) => d.accept().catch(() => {}));
            const dev = { ctx, page, errors, shop, gate, name: user.username };
            dev.reopen = async () => {
                page = await ctx.newPage(); dev.page = page;
                page.on('pageerror', (e) => errors.push(String(e && e.message)));
                page.on('dialog', (d) => d.accept().catch(() => {}));
                await page.goto(origin + '/', { waitUntil: 'load' });
                if (await dev.waitOnline(40000) < 0) throw new Error('Cookie reopen: ' + JSON.stringify(await dev.state()));
            };
            dev.opLog = [];
            dev.state = () => page.evaluate(() => window.__state()).then((st) => {
                if (st && Array.isArray(st.results) && st.results.length) dev.opLog = dev.opLog.concat(st.results).slice(-12);
                return st;
            }).catch((e) => ({ status: 'evaluate failed: ' + (e && e.message), phase: null, pending: -1, blocked: -1, rows: -1, history: -1, codes: [], results: [] }));
            dev.waitOnline = async (ms, minHistory) => {
                const t0 = Date.now();
                for (;;) {
                    const st = await dev.state();
                    if (st.status === ONLINE_TEXT && st.phase === 'ready' && (minHistory === undefined || st.history >= minHistory)) return Date.now() - t0;
                    if (Date.now() - t0 > ms) return -1;
                    await sleep(250);
                }
            };
            dev.login = async () => {
                await page.goto(origin + '/', { waitUntil: 'load' });
                const t0 = Date.now();
                let shown = false;
                while (!shown && Date.now() - t0 < 20000) {
                    shown = await page.evaluate(() => { const m = document.getElementById('loginModal'); return !!m && getComputedStyle(m).display !== 'none'; }).catch(() => false);
                    if (!shown) await sleep(200);
                }
                if (!shown) return false;
                await page.fill('#loginEmailInput', user.username);
                await page.fill('#loginPasswordInput', user.password);
                await page.click('#loginBtn');
                return true;
            };
            dev.sync = () => page.evaluate(() => { try { fb.goOnline(db); } catch (e) {} }).catch(() => {});
            return dev;
        };

        const injections = { crossShopConcurrent: 0, returnRace: 0, sweepRace: 0, offlineOnline: 0, offlineReload: 0 };
        let broke = null;
        for (const shop of shops) {
            for (const user of shop.users) shop.devices.push(await makeDevice(shop, user));
        }
        const devices = shops.flatMap((shop) => shop.devices);
        for (const dev of devices) { if (!(await dev.login())) { broke = 'ប្រអប់ចូលមិនលេច (' + dev.name + ')'; break; } }
        if (!broke) {
            const online = await Promise.all(devices.map((dev) => dev.waitOnline(40000, 5)));
            const late = devices.filter((dev, k) => online[k] < 0);
            if (late.length) broke = 'ឧបករណ៍មិនដល់ «' + ONLINE_TEXT + '» + history ៥ ជួរ ៖ ' + late.map((d) => d.name).join(' · ') + ' ' + JSON.stringify(await late[0].state());
        }
        check(!broke, 'ឧបករណ៍ ' + devices.length + ' (ហាង ' + SHOPS + ' × ' + DEVICES + ') ចូលប្រព័ន្ធ ហើយឃើញតែទិន្នន័យហាងខ្លួន', broke);

        const settle = async () => {
            const t0 = Date.now();
            let syncedAt = 0;
            for (;;) {
                if (Date.now() - syncedAt > 3000) { syncedAt = Date.now(); await Promise.all(devices.map((d) => d.sync())); }
                const states = await Promise.all(devices.map((d) => d.state()));
                const done = await Promise.all(devices.map((d) => d.page.evaluate(() => window.__settled()).catch(() => true)));
                states.forEach((st, k) => { if (DEBUG && st.results.length) console.log('      ' + devices[k].name + ' ' + JSON.stringify(st.results)); });
                if (states.every((st, k) => done[k] && st.pending === 0 && st.rows === 0 && st.phase === 'ready' && st.cleanupJournal === 0 && st.pickupJournal === 0 && st.blocked === 0)) return null;
                if (Date.now() - t0 > 60000) return states;
                await sleep(300);
            }
        };

        if (!broke) {
            assert.equal(await settle(), null, 'ឧបករណ៍ទាំងអស់ត្រូវស្ងប់មុន matrix');
            const shop = shops[0];
            const neighbors = shops.slice(1);
            const snapshots = await Promise.all(neighbors.map((neighbor) => tree(neighbor.tenant)));
            let isolationChecks = 0, matrixSteps = 0;
            const onCheckpoint = async (label) => {
                const current = await Promise.all(neighbors.map((neighbor) => tree(neighbor.tenant)));
                neighbors.forEach((neighbor, i) => assert.deepEqual(current[i], snapshots[i], label + ': ហាងជិតខាង ' + neighbor.index + ' ត្រូវនៅដដែល'));
                isolationChecks++;
            };
            for (const authMode of ['cookie', 'palm']) {
                const result = await restoreFlows({ devices: shop.devices, read: () => tree(shop.tenant),
                    write: (ops) => serverWrite(shop.tenant, ops), dateKey, monthKey, knownCodes: shop.knownCodes,
                    fixture: cookie, origin, site: String(200101 + shop.index), tag: 's' + shop.index, backend: 'supabase', authMode, onCheckpoint });
                matrixSteps += result.steps;
            }
            check(matrixSteps > 0 && isolationChecks === matrixSteps,
                'matrix ពេញលេញលើហាង ០ · snapshot ហាងជិតខាងមិនប្រែប្រួលក្រោយគ្រប់ជំហាន (' + isolationChecks + ')', { matrixSteps, isolationChecks });
        }

        for (let i = 0; i < OPS && !broke; i++) {
            const plans = [];
            for (const shop of shops) {
                const r = shop.r;
                const plan = shop.devices.map((dev) => {
                    const pick = r();
                    const wanted = i === 1 ? 'zreturn' : OPNAMES[Math.floor(r() * OPNAMES.length)];
                    const mode = r() < 0.55 ? 'online' : (r() < 0.5 ? 'offline-online' : 'offline-reload');
                    const code = 'S' + shop.index + 'C' + i + '_' + Math.floor(pick * 1e5);
                    return { shop, dev, wanted, pick, amt: Math.round(r() * 4000) / 100, mode, code, phone: pick > 0.5 ? '0120100' + shop.index + '00' : '09' + Math.floor(pick * 1e8), reloadAfter: 150 + Math.floor(r() * 1400) };
                });
                const t = await tree(shop.tenant);
                if (plan.some((p) => p.wanted === 'zreturn')) {
                    const open = openBarcodeTargets(t);
                    const target = open.length ? Object.assign({ at: Date.now() }, open[Math.floor(r() * open.length) % open.length]) : null;
                    plan.forEach((p) => { if (target) { p.wanted = 'zreturn'; p.target = target; } else if (p.wanted === 'zreturn') p.wanted = 'sweep'; });
                    if (target) { shop.trail.push('ztoReturn:' + target.code); injections.returnRace++; }
                } else if (plan.some((p) => p.wanted === 'sweep')) {
                    const hist = t.zoew_scan_history_cod_dod || {};
                    const ids = Object.keys(hist).sort();
                    if (ids.length) {
                        const id = ids[Math.floor(r() * ids.length) % ids.length];
                        const item = JSON.parse(JSON.stringify(hist[id]));
                        const bcs = Array.isArray(item.barcodes) ? item.barcodes : [];
                        if (item.isClosed || bcs.some((b) => b && b.isClosed)) {
                            const ripe = Date.now() - 3 * 3600 * 1000;
                            if (item.isClosed) item.closedAt = ripe;
                            bcs.forEach((b) => { if (b && b.isClosed) b.closedAt = ripe; });
                            shop.trail.push('age:pickup:' + id);
                        } else {
                            const old = Date.now() - 9 * 24 * 3600 * 1000;
                            item.createdAt = old;
                            bcs.forEach((b) => { if (b) b.createdAt = old; });
                            shop.trail.push('age:abandon:' + id);
                        }
                        await serverWrite(shop.tenant, [{ k: 'set', p: ['zoew_scan_history_cod_dod', id], v: item }]);
                        await Promise.all(shop.devices.map((d) => d.sync()));
                        await sleep(1500);
                        plan.forEach((p) => { p.wanted = 'sweep'; p.mode = p.mode === 'offline-reload' ? 'online' : p.mode; });
                        injections.sweepRace++;
                    }
                }
                plans.push(...plan);
            }
            for (const p of plans) if (p.mode !== 'online') await p.dev.page.evaluate(() => { fb.goOffline(db); }).catch(() => {});
            const started = await Promise.all(plans.map((p) => p.dev.page.evaluate((args) => window.__startOp(args), { wanted: p.wanted, pick: p.pick, amt: p.amt, code: p.code, phone: p.phone, target: p.target })
                .catch((e) => 'threw:evaluate:' + (e && e.message))));
            plans.forEach((p, k) => { if (started[k]) p.shop.trail.push(p.dev.name + ':' + started[k] + (p.mode === 'online' ? '' : '[' + p.mode + ']')); });
            if (shops.every((shop) => plans.some((p, k) => p.shop === shop && started[k] && String(started[k]).indexOf('threw:') !== 0))) injections.crossShopConcurrent++;
            if (started.some((s) => String(s).indexOf('threw:') === 0)) broke = 'op បោះកំហុស ៖ ' + started.filter((s) => String(s).indexOf('threw:') === 0).join(' · ');
            await Promise.all(plans.map(async (p, k) => {
                if (p.mode === 'online') return;
                if (p.mode === 'offline-online') {
                    await sleep(300 + Math.floor(p.shop.r() * 700));
                    await p.dev.sync();
                    if (started[k]) injections.offlineOnline++;
                    return;
                }
                await sleep(p.reloadAfter);
                await p.dev.page.reload({ waitUntil: 'load' }).catch(() => {});
                if (started[k]) injections.offlineReload++;
                if ((await p.dev.waitOnline(40000)) < 0) {
                    const st = await p.dev.state();
                    const loginOpen = await p.dev.page.evaluate(() => { const m = document.getElementById('loginModal'); return !!m && getComputedStyle(m).display !== 'none'; }).catch(() => false);
                    if (loginOpen) broke = broke || 'ឧបករណ៍ ' + p.dev.name + ' ធ្លាក់ទៅប្រអប់ចូលក្រោយ reload (session Supabase មិនរស់) ៖ ' + JSON.stringify(st);
                    else broke = broke || 'ឧបករណ៍ ' + p.dev.name + ' មិនដល់ ready ក្រោយ reload ៖ ' + JSON.stringify(st);
                }
            }));
            if (broke) break;
            let stuck = await settle();
            if (stuck) {
                await Promise.all(devices.map((d) => d.page.evaluate(() => { try { window.runScheduledCleanup(); window.resumeInterruptedCleanups(); } catch (e) {} }).catch(() => {})));
                stuck = await settle();
            }
            if (stuck) {
                broke = 'ឧបករណ៍មិនស្ងប់ក្នុង ៦០ វិ. (pending · journal · blocked · cleanup journal) ក្រោយជុំ ' + i + '\n        '
                    + JSON.stringify(stuck.map((s, k) => ({ dev: devices[k].name, status: s.status, phase: s.phase, pending: s.pending, blocked: s.blocked, rows: s.rows, cleanupJournal: s.cleanupJournal, pickupJournal: s.pickupJournal })));
                break;
            }
            const views = await Promise.all(devices.map((d) => d.state()));
            const trees = await Promise.all(shops.map((shop) => tree(shop.tenant)));
            const invs = shops.map((shop, k) => invariant(trees[k], dateKey, monthKey, shop.knownCodes));
            const serverCodes = invs.map((inv) => new Set(Object.keys(inv.seenCodes)));
            for (const shop of shops) {
                const foreign = shops.filter((other) => other !== shop).flatMap((other) => [...serverCodes[other.index]]);
                const leakServer = foreign.filter((code) => serverCodes[shop.index].has(code));
                const leakView = shop.devices.flatMap((d) => views[devices.indexOf(d)].codes.filter((code) => foreign.indexOf(code) !== -1 && !serverCodes[shop.index].has(code)));
                if (leakServer.length || leakView.length) { broke = 'ហាង ' + shop.index + ' ៖ ទិន្នន័យហាងផ្សេងលេចចូល ៖ server ' + JSON.stringify(leakServer.slice(0, 5)) + ' · ទិដ្ឋភាព ' + JSON.stringify(leakView.slice(0, 5)); break; }
            }
            if (broke) break;
            for (const shop of shops) {
                const inv = invs[shop.index];
                Object.keys(inv.seenCodes).forEach((code) => { if (shop.knownCodes.indexOf(code) === -1) shop.knownCodes.push(code); });
                const why = invariantBroken(inv);
                if (DEBUG) console.log('    #' + i + ' shop ' + shop.index + ' ' + shop.trail.slice(-DEVICES).join(' | ') + ' -> ' + JSON.stringify(Object.assign({}, inv, { seenCodes: undefined })));
                if (why) { broke = 'ហាង ' + shop.index + ' ៖ ' + why + ' ក្រោយ [' + shop.trail.join(' > ') + ']\n        ' + JSON.stringify(Object.assign({}, inv, { seenCodes: undefined }))
                    + '\n        ផលប្រតិបត្តិការចុងក្រោយ ៖ ' + JSON.stringify(shop.devices.map((d) => [d.name, d.opLog])); break; }
            }
        }
        const noisy = devices.flatMap((d) => d.errors).filter((e) => !/sentry|gstatic|fonts\.googleapis|ERR_|Failed to fetch|NetworkError|timed out|websocket|realtime/i.test(e));
        if (!broke && noisy.length) broke = 'កំហុស runtime / unhandledrejection ៖ ' + noisy.slice(0, 3).join(' · ');
        shops.forEach((shop) => console.log('  ហាង ' + shop.index + ' · ' + shop.trail.length + ' ops · ' + shop.trail.join(' > ').slice(0, 400)));
        check(!broke, 'អថេរលុយ · ស្ថិតិ · registry · barcode រក្សាបានក្នុងហាងនីមួយៗ · ហាងមិនលេចចូលគ្នា ក្នុង ' + OPS + ' ជុំ (ហាង ' + SHOPS + ' × ឧបករណ៍ ' + DEVICES + ' ស្របគ្នា)', broke);
        check(injections.crossShopConcurrent > 0, 'ជាន់អប្បបរមា ៖ ប្រតិបត្តិការលុយស្របគ្នាឆ្លងហាងបានបាញ់ពិត (' + injections.crossShopConcurrent + ')', injections);
        check(injections.returnRace >= SHOPS, 'ជាន់អប្បបរមា ៖ «ZTO ត្រឡប់» ប្រជែងពី ' + DEVICES + ' ឧបករណ៍លើ barcode ដដែលក្នុងហាងនីមួយៗ (' + injections.returnRace + ')', injections);
        check(injections.offlineOnline > 0 && injections.offlineReload > 0, 'ជាន់អប្បបរមា ៖ ការចាក់ offline+online (' + injections.offlineOnline + ') និង offline+reload (' + injections.offlineReload + ') បានបាញ់ពិត', injections);
        const writes = fake.requests.filter((req) => req.path === '/rest/v1/rpc/zoe_write').length;
        check(writes >= SHOPS * DEVICES, 'លក្ខខណ្ឌចាំបាច់ ៖ App សរសេរតាម `zoe_write` ពិតលើ Postgres (' + writes + ' សំណើ)', writes);
    } finally {
        for (const ctx of contexts) await ctx.close().catch(() => {});
        if (browser) await browser.close().catch(() => {});
        if (staticServer) await new Promise((resolve) => staticServer.close(resolve));
        if (fake) await fake.close().catch(() => {});
        if (cookie) cookie.close();
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
