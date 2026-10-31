'use strict';
// ថ្នាក់ ៖ **ឧបករណ៍ ៣ ពិតក្នុងសាខាមួយ (`MONEYMD_DEVICES`) · SDK Firebase ពិត · rules ពិត · emulator ពិត** ធ្វើប្រតិបត្តិការលុយ **ស្របគ្នា** លើទិន្នន័យតែមួយ
// (បិទ · ដក · លុប · ស្តារ · កែតម្លៃ · ស្កេន · ការសម្អាតស្វ័យប្រវត្តិ ២h/៧ថ្ងៃ · ZTO ស្កេនត្រឡប់ ➜ ធុងសំរាម «ត្រឡប់» លើ barcode តែមួយពីគ្រប់ឧបករណ៍)
// ខណៈបណ្តាញដាច់ (`goOffline`) ហើយ
// (ក) ភ្ជាប់វិញ (queue របស់ SDK ចុះ) ឬ (ខ) **reload** (queue បាត់ ➜ journal ត្រូវសម្រេច)។
// ⛔ `revenue-fuzz` វាស់ឧបករណ៍ ១ លើ fake SDK (ឧបករណ៍ផ្សេង = ការចាក់) · `emu/app-network-e2e` វាស់ការសរសេរ ១ ក្រោយ reload ·
//    គ្មាន checker ណាវាស់ **transaction ពិតពីរឧបករណ៍ប្រជែងគ្នាលើ rules ពិត** និង **App ស្លាប់ពាក់កណ្តាលប្រតិបត្តិការលុយ**។
// អថេរ (អានពី server តាម REST owner ក្រោយឧបករណ៍ទាំងពីរស្ងប់) ៖
//   ១. ledger ថ្ងៃ = ផលបូក barcode ដែល `isDeducted !== true` (ប្រវត្តិ + ធុងសំរាម) · ចំនួនដូចគ្នា
//   ២. ledger ខែ = ផលបូក ledger ថ្ងៃ
//   ៣. `packagesPickedUp` = barcode បិទ · sum(pickedUpPhones) = packagesPickedUp
//   ៤. barcode មិនស្ថិតទាំងប្រវត្តិនិងធុងសំរាម · កូនសោ registry មិនកំព្រា
//   ៥. ឧបករណ៍ណាមិននៅ `blocked` · journal ទទេ · គ្មាន barcode បាត់ (ស្កេនរួច ➜ នៅប្រវត្តិ ឬធុងសំរាម)
// ⛔ ជាន់អប្បបរមា ៖ ការចាក់ offline+reload · offline+online · ការសម្អាតប្រជែង ត្រូវបាញ់ពិត (បើមិនបាញ់ = បៃតងក្លែងក្លាយ)។
// ⛔ ជុំទី ១ នៃលំដាប់នីមួយៗជាការប្រជែង «ZTO ត្រឡប់» ជានិច្ច (ឧបករណ៍ទាំងអស់ហៅទ្វារលុយដដែល `claimAndCleanupItem(… 'abandon', { codes, returnedAt })`
//    លើ barcode ដដែលព្រមគ្នា ដូចពេលឧបករណ៍ ៣ ក្នុងសាខាឃើញបញ្ជីត្រឡប់ដដែល) ➜ ការដកលុយត្រូវកើតម្តងតែប៉ុណ្ណោះ។
// អថេរ · PAGE_OPS រួមជាមួយ `supabase-money-multishop-test` ➜ `../money-multidevice-core.js`។
// Sheet/Cookie/Palm ៖ Lookup និងស្កេនពិត រួច Remove→Restore→Delete→Restore លើ barcode ដដែល; Palm/Sign ស្តារត្រូវបដិសេធតាមទ្វារពិត។
// SKIP ≠ PASS ៖ គ្មាន emulator ➜ SKIPPED (STRICT ➜ FAIL)។ env ៖ MONEYMD_RUNS · MONEYMD_OPS · MONEYMD_RUN0 · MONEYMD_DEVICES · MONEYMD_DEBUG=1

process.exitCode = 1;

const fs = require('fs');
const http = require('http');
const path = require('path');
const { emuNamespace } = require('./ns.js');
const { r2, rng, LICENSE_STUB, invariant, invariantBroken, openBarcodeTargets, PAGE_OPS, recoveryEvidence, devicesSettled } = require('../money-multidevice-core.js');
const { cookieFixture, networkGate, restoreFlows } = require('../money-cookie-blob.js');
const fx = require('../idtoken-fixture.js');

const ROOT = process.env.MONEYMD_APP_DIR ? path.resolve(process.env.MONEYMD_APP_DIR) : path.join(__dirname, '..', '..');
const DIR = path.join(ROOT, 'ZoeW');
const EMU_PORT = parseInt(process.env.MONEYMD_EMU_PORT || '9000', 10);
const CHROME = process.env.MONEYMD_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const STRICT = process.env.MONEYMD_STRICT === '1' || process.env.CRUD_FLOW_STRICT === '1';
const RUNS = parseInt(process.env.MONEYMD_RUNS || '3', 10);
const OPS = parseInt(process.env.MONEYMD_OPS || '12', 10);
const RUN0 = parseInt(process.env.MONEYMD_RUN0 || '0', 10);
const DEVICES = Math.max(2, Math.min(5, parseInt(process.env.MONEYMD_DEVICES || '3', 10) || 3));
const DEBUG = process.env.MONEYMD_DEBUG === '1';
const ONLINE_TEXT = 'ភ្ជាប់ Server រួចរាល់';
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json',
    '.png': 'image/png', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.webmanifest': 'application/manifest+json' };

let pass = 0, fail = 0;
const check = (c, label, detail) => {
    if (c) { pass++; console.log('  ok    ' + label); }
    else { fail++; console.log('  FAIL  ' + label + (detail !== undefined ? '\n        ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : '')); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function emulatorUp() {
    return fetch('http://127.0.0.1:' + EMU_PORT + '/.json?ns=demo-zoe-probe').then((r) => r.ok, () => false);
}



function sweepAgePatch(item, registry, now) {
    const entries = Object.entries(item.barcodes || {}).filter(([, b]) => b);
    const patch = {};
    if (item.isClosed || entries.some(([, b]) => b.isClosed)) {
        const ripe = now - 3 * 3600 * 1000;
        if (item.isClosed) patch.closedAt = ripe;
        entries.forEach(([key, b]) => { if (b.isClosed) patch['barcodes/' + key + '/closedAt'] = ripe; });
    } else {
        const regKey = code => String(code || '').trim().toUpperCase().replace(/[%.#$\[\]\/\x00-\x1F\x7F]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0'));
        if (!entries.length || item.scanPending || entries.some(([, b]) => !b.code || b.scanIntent !== undefined || registry[regKey(b.code)] !== true)) return null;
        const old = now - 9 * 24 * 3600 * 1000;
        patch.createdAt = old;
        entries.forEach(([key]) => { patch['barcodes/' + key + '/createdAt'] = old; });
    }
    return patch;
}

async function waitForHistoricalSettlement(devices, read, accepts, limitMs = 45000, now = Date.now, pause = sleep) {
    const started = now();
    for (;;) {
        const states = await Promise.all(devices.map(device => device.state()));
        const done = await Promise.all(devices.map(device => device.page.evaluate(() => window.__settled()).catch(() => false)));
        const dump = await read();
        if (devicesSettled(states, done) && accepts(dump)) return dump;
        if (now() - started >= limitMs) throw new Error('Historical v2 operation did not settle with its expected server state');
        await pause(300);
    }
}

(async () => {
    console.log('=== emu/money-multidevice — ឧបករណ៍ ' + DEVICES + ' ពិត · SDK ពិត · rules ពិត · ប្រតិបត្តិការលុយស្របគ្នា · offline · reload ===');
    let sdkDir = '', chromium = null;
    try { sdkDir = path.dirname(require.resolve('firebase/package.json')); } catch (e) { check(false, 'SDK Firebase ពិតត្រូវមាន (npm ci --prefix ZoeW)', String(e && e.message)); }
    try { chromium = require('playwright-core').chromium; } catch (e) { chromium = null; }
    check(!!chromium && fs.existsSync(CHROME), 'មាន playwright-core និង Chromium', { chromium: !!chromium, chrome: CHROME });
    const indexFile = path.join(DIR, 'index.html');
    check(fs.existsSync(indexFile), 'build វាស់ ZoeW/ មាន', indexFile);
    if (!(await emulatorUp())) {
        if (STRICT) { check(false, 'STRICT ➜ គ្មាន RTDB emulator នៅ 127.0.0.1:' + EMU_PORT); console.log('\n❌ ធ្លាក់ ' + fail + ' / ok ' + pass); return; }
        console.log('SKIPPED — គ្មាន RTDB emulator នៅ 127.0.0.1:' + EMU_PORT); process.exitCode = fail ? 1 : 0; return;
    }
    if (fail) { console.log('\n❌ ធ្លាក់ ' + fail + ' / ok ' + pass); return; }

    const PROJECT = 'demo-zoe-moneymd';
    const cookie = cookieFixture(ROOT, { project: PROJECT });
    const staticServer = await new Promise((res) => {
        const s = http.createServer((req, rsp) => {
            if (req.url.startsWith('/.netlify/functions/zto-order-detail')) { void cookie.serve(req, rsp); return; }
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
    const browser = await chromium.launch({ executablePath: CHROME, args: ['--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1'] });
    const rules = JSON.parse(fs.readFileSync(path.join(ROOT, 'firebase-database.rules.json'), 'utf8'));
    const now = Date.now();
    const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Phnom_Penh', year: 'numeric', month: '2-digit', day: '2-digit' });
    const dateKey = fmt.format(now);
    const monthKey = dateKey.slice(0, 7);
    const injections = { offlineOnline: 0, offlineReload: 0, sweepRace: 0, returnRace: 0, restoreRace: 0, concurrent: 0 };
    let brokenRuns = 0, runsDone = 0, stuckDevices = 0;
    const runFailures = [];

    const makeDevice = async (ns, uid, email) => {
        const ctx = await browser.newContext({ viewport: { width: 412, height: 780 }, serviceWorkers: 'block' });
        const gate = await networkGate(ctx, 'firebase');
        await ctx.route('https://www.gstatic.com/firebasejs/**', (route) => {
            const file = route.request().url().split('/').pop().split('?')[0];
            const src = path.join(sdkDir, file);
            if (!/^firebase-[a-z-]+\.js$/.test(file) || !fs.existsSync(src)) return route.abort();
            return route.fulfill({ status: 200, contentType: 'application/javascript', headers: { 'Access-Control-Allow-Origin': '*' }, body: fs.readFileSync(src) });
        });
        const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS' };
        await ctx.route(/^https:\/\/(identitytoolkit|securetoken)\.googleapis\.com\//, (route) => {
            const req = route.request();
            if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors, body: '' });
            const url = req.url();
            const token = fx.tokenFor(email, { aud: PROJECT, claims: { sub: uid, user_id: uid, auth_time: Math.floor(Date.now() / 1000), firebase: { identities: { email: [email] }, sign_in_provider: 'password' } } });
            let body;
            if (/accounts:signInWithPassword/.test(url)) body = { kind: 'identitytoolkit#VerifyPasswordResponse', localId: uid, email, displayName: '', idToken: token, registered: true, refreshToken: 'refresh-' + uid, expiresIn: '3600' };
            else if (/accounts:lookup/.test(url)) { const t = String(Date.now()); body = { kind: 'identitytoolkit#GetAccountInfoResponse', users: [{ localId: uid, email, emailVerified: false, passwordHash: 'x', passwordUpdatedAt: Number(t), providerUserInfo: [{ providerId: 'password', federatedId: email, email, rawId: email }], validSince: String(Math.floor(Number(t) / 1000)), lastLoginAt: t, createdAt: t, lastRefreshAt: new Date().toISOString() }] }; }
            else if (/securetoken\.googleapis\.com/.test(url)) body = { access_token: token, expires_in: '3600', token_type: 'Bearer', refresh_token: 'refresh-' + uid, id_token: token, user_id: uid, project_id: PROJECT };
            else body = {};
            return route.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify(body) });
        });
        await ctx.route(/\/license-verify\.js(\?|$)/, (route) => route.fulfill({ status: 200, contentType: 'application/javascript', body: LICENSE_STUB }));
        const config = { apiKey: 'fake-api-key', authDomain: PROJECT + '.firebaseapp.com', projectId: PROJECT, appId: '1:1:web:1', databaseURL: 'http://127.0.0.1:' + EMU_PORT + '?ns=' + ns };
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
        const dev = { ctx, page, uid, email, errors, gate, name: uid };
        dev.reopen = async () => {
            page = await ctx.newPage(); dev.page = page;
            page.on('pageerror', (e) => errors.push(String(e && e.message)));
            page.on('dialog', (d) => d.accept().catch(() => {}));
            await page.goto(origin + '/', { waitUntil: 'load' });
            if (await dev.waitOnline(40000) < 0) throw new Error('Cookie reopen: ' + JSON.stringify(await dev.state()));
        };
        dev.state = () => page.evaluate(() => window.__state()).catch((e) => ({ status: 'evaluate failed: ' + (e && e.message), phase: null, pending: -1, blocked: -1, rows: -1, history: -1, results: [] }));
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
            const shown = await (async () => { const t0 = Date.now(); while (Date.now() - t0 < 20000) { if (await page.evaluate(() => { const m = document.getElementById('loginModal'); return !!m && getComputedStyle(m).display !== 'none'; }).catch(() => false)) return true; await sleep(200); } return false; })();
            if (!shown) return false;
            await page.fill('#loginEmailInput', email);
            await page.fill('#loginPasswordInput', 'password-123');
            await page.click('#loginBtn');
            return true;
        };
        return dev;
    };

    const OPNAMES = ['scan', 'closeOrder', 'closeBarcode', 'removeBarcode', 'deleteItem', 'restore', 'editPrice', 'sweep', 'closeBarcode', 'removeBarcode', 'restore', 'zreturn'];
    for (let run = RUN0; run < RUN0 + RUNS; run++) {
        const NS = emuNamespace('demo-zoe-moneymd');
        const owner = (p, method, body) => fetch('http://127.0.0.1:' + EMU_PORT + '/' + p + '?ns=' + NS, {
            method: method || 'GET', headers: { Authorization: 'Bearer owner' }, body: body === undefined ? undefined : JSON.stringify(body)
        });
        const rulesRes = await owner('.settings/rules.json', 'PUT', rules);
        if (!rulesRes.ok) { check(false, 'ដាក់ rules ពិតលើ namespace ' + NS, rulesRes.status); break; }
        const r = rng(7000 + run * 13);
        const mkItem = (id, phone, bcs) => ({
            id, phone, scanDate: dateKey, createdAt: now - 3600000, time: '09:00:00 (' + dateKey + ')', isClosed: false, isCalled: false,
            cod: r2(bcs.reduce((s, b) => s + b.cod, 0)), dod: r2(bcs.reduce((s, b) => s + b.dod, 0)), price: r2(bcs.reduce((s, b) => s + b.cod + b.dod, 0)),
            count: bcs.length, barcode: bcs[bcs.length - 1].code,
            barcodes: bcs.map((b) => ({ code: b.code, time: '09:00:00 (' + dateKey + ')', cod: b.cod, dod: b.dod, locker: 'A1', isClosed: false, isDeducted: false, isFromDeletion: false, createdAt: now - 3600000 }))
        });
        const items = {}; const registry = {}; const knownCodes = [];
        let cod = 0, dod = 0, cnt = 0;
        for (let i = 0; i < 5; i++) {
            const n = 1 + Math.floor(r() * 3);
            const bcs = [];
            for (let k = 0; k < n; k++) { const code = 'MD' + run + '_' + i + '_' + k; bcs.push({ code, cod: Math.round(r() * 3000) / 100, dod: Math.round(r() * 400) / 100 }); registry[code] = true; knownCodes.push(code); }
            const id = 'md' + run + '_' + i;
            items[id] = mkItem(id, '0120' + String(100000 + i * 7), bcs);
            bcs.forEach((b) => { cod += b.cod; dod += b.dod; cnt++; });
        }
        await owner('.json', 'PUT', {
            zoew_scan_history_cod_dod: items, zoew_recently_deleted_cod_dod: {}, zoew_barcode_registry: registry, zoew_settings: { exchange_rate: 4100 },
            zoew_daily_revenue_cod_dod: { [dateKey]: { codDollar: r2(cod), dodDollar: r2(dod), totalCount: cnt } },
            zoew_monthly_revenue_cod_dod: { [monthKey]: { codDollar: r2(cod), dodDollar: r2(dod), totalCount: cnt } }
        });
        const devices = [];
        for (let d = 0; d < DEVICES; d++) devices.push(await makeDevice(NS, 'moneymd-' + 'abcde'[d] + '-' + run, 'abcde'[d] + '@zoew1.com'));
        let broke = null; const trail = []; let returnTarget = null;
        try {
            for (const dev of devices) { if (!(await dev.login())) { broke = 'ប្រអប់ចូលមិនលេច (' + dev.name + ')'; break; } }
            if (!broke) for (const dev of devices) { if ((await dev.waitOnline(30000, 5)) < 0) { broke = 'ឧបករណ៍ ' + dev.name + ' មិនដល់ «' + ONLINE_TEXT + '» + ប្រវត្តិ ៥ ជួរ ៖ ' + JSON.stringify(await dev.state()); break; } }
            if (!broke && run === RUN0) {
                const code = 'HISTV2_' + run;
                const birth = now - 9 * 24 * 3600 * 1000;
                const read = async () => (await (await owner('.json')).json()) || {};
                const admitted = await devices[0].page.evaluate(async ({ code, birth }) => window.addOrUpdateEntry(code, '099887766', 10, 2, 'A1', birth), { code, birth });
                check(admitted === true, 'historical v2 ៖ public admission បញ្ចប់ពិត', admitted);
                let dump = await read();
                const registryOwner = (dump.zoew_barcode_registry || {})[code];
                const receipt = registryOwner && (dump.zoew_scan_operations || {})[registryOwner.intent];
                if (admitted !== true || !receipt || receipt.phase !== 'committed' || receipt.birth !== birth) throw new Error('Historical v2 admission missing immutable receipt');
                const originalReceipt = JSON.stringify(receipt), originalOwner = JSON.stringify(registryOwner);
                const inspectHistorical = (value) => invariant(value, receipt.scanDate, receipt.month, [code], 'http://127.0.0.1:' + EMU_PORT + '?ns=' + NS);
                check(!invariantBroken(inspectHistorical(dump)), 'historical v2 ៖ admission strict oracle', inspectHistorical(dump));
                knownCodes.push(code);
                await devices[0].page.evaluate(async id => window.claimAndCleanupItem(id, 'abandon'), receipt.targetId);
                dump = await waitForHistoricalSettlement(devices, read, value => Object.values(value.zoew_recently_deleted_cod_dod || {})
                    .some(item => Object.values(item.barcodes || {}).some(b => b.code === code && b.isDeducted === true)));
                const trash = Object.values(dump.zoew_recently_deleted_cod_dod || {}).find(it => Object.values(it.barcodes || {}).some(b => b.code === code));
                check(!!trash && Object.values(trash.barcodes || {}).some(b => b.code === code && b.isDeducted === true && b.createdAt === birth && b.scanIntent === receipt.id), 'historical v2 ៖ abandon ដកម្តងដោយរក្សា birth');
                if (!trash) throw new Error('Historical v2 abandon did not reach trash');
                check(!invariantBroken(inspectHistorical(dump)), 'historical v2 ៖ abandon strict oracle', inspectHistorical(dump));
                await devices[0].page.evaluate(async id => { window.promptRestoreDeletedItem(id); await window.executeRestoreItem(); }, trash.id);
                dump = await waitForHistoricalSettlement(devices, read, value => Object.values(value.zoew_scan_history_cod_dod || {})
                    .some(item => Object.values(item.barcodes || {}).some(b => b.code === code && b.isDeducted === false)));
                const restored = Object.values(dump.zoew_scan_history_cod_dod || {}).find(it => Object.values(it.barcodes || {}).some(b => b.code === code));
                check(!!restored && Object.values(restored.barcodes || {}).some(b => b.code === code && b.isDeducted === false && b.createdAt === birth && b.scanIntent === receipt.id), 'historical v2 ៖ Restore ស្តារម្តងដោយរក្សា birth');
                check(JSON.stringify((dump.zoew_scan_operations || {})[receipt.id]) === originalReceipt && JSON.stringify((dump.zoew_barcode_registry || {})[code]) === originalOwner, 'historical v2 ៖ receipt/registry មិនត្រូវកែ');
                check(!invariantBroken(inspectHistorical(dump)), 'historical v2 ៖ Restore strict oracle', inspectHistorical(dump));
                if (!restored) throw new Error('Historical v2 Restore did not reach history');
                const negative = JSON.parse(JSON.stringify(dump));
                Object.values(negative.zoew_scan_history_cod_dod[restored.id].barcodes).find(b => b.code === code).createdAt++;
                check(inspectHistorical(negative).registryMissing.includes(code), 'historical v2 ៖ wrong-birth ក្នុង copy ត្រូវបដិសេធ');
                trail.push('historicalV2:admit>abandon>restore:' + code);
            }
            if (!broke && run === RUN0) for (const authMode of ['sheet', 'cookie', 'palm']) await restoreFlows({ devices, read: async () => (await (await owner('.json')).json()) || {},
                write: async (ops) => {
                    const patch = Object.fromEntries(ops.map((o) => [o.p.join('/'), o.v]));
                    const out = await owner('.json', 'PATCH', patch); if (!out.ok) throw new Error('Cookie seed: ' + out.status);
                }, dateKey, monthKey, knownCodes, fixture: cookie, origin, site: '1', tag: 'firebase', backend: 'firebase', authMode });
            for (let i = 0; i < OPS && !broke; i++) {
                const plan = devices.map((dev) => {
                    const pick = r();
                    const wanted = i === 1 ? 'zreturn' : OPNAMES[Math.floor(r() * OPNAMES.length)];
                    const mode = r() < 0.55 ? 'online' : (r() < 0.5 ? 'offline-online' : 'offline-reload');
                    const code = 'SC' + run + '_' + i + '_' + Math.floor(pick * 1e5);
                    return { dev, wanted, pick, amt: Math.round(r() * 4000) / 100, mode, code, phone: pick > 0.5 ? '0120100000' : '09' + Math.floor(pick * 1e8), reloadAfter: 150 + Math.floor(r() * 1400) };
                });
                if (i === 2 && returnTarget) {
                    plan.forEach((p, k) => { p.wanted = 'restore'; p.target = { code: returnTarget.code }; if (k === 0) p.mode = 'online'; });
                    trail.push('restoreRace:' + returnTarget.code);
                }
                if (plan.some((p) => p.wanted === 'sweep')) {
                    const ageDump = (await (await owner('.json')).json()) || {};
                    const ageRegistry = ageDump.zoew_barcode_registry || {};
                    const ids = Object.keys(ageDump.zoew_scan_history_cod_dod || {}).filter(id => sweepAgePatch(ageDump.zoew_scan_history_cod_dod[id], ageRegistry, Date.now()) !== null);
                    if (ids.length) {
                        const id = ids[Math.floor(r() * ids.length) % ids.length];
                        const item = await (await owner('zoew_scan_history_cod_dod/' + id + '.json')).json();
                        if (item) {
                            const patch = sweepAgePatch(item, ageRegistry, Date.now());
                            if (!patch) throw new Error('Age fixture eligibility changed');
                            trail.push((patch.createdAt ? 'age:abandon:' : 'age:pickup:') + id);
                            await owner('zoew_scan_history_cod_dod/' + id + '.json', 'PATCH', patch);
                            await sleep(700);
                            plan.forEach((p) => { p.wanted = 'sweep'; p.mode = p.mode === 'offline-reload' ? 'online' : p.mode; });
                        }
                    }
                }
                if (plan.some((p) => p.wanted === 'zreturn')) {
                    const open = openBarcodeTargets((await (await owner('.json')).json()) || {});
                    const target = open.length ? Object.assign({ at: Date.now() }, open[Math.floor(r() * open.length) % open.length]) : null;
                    plan.forEach((p) => { if (target) { p.wanted = 'zreturn'; p.target = target; } else if (p.wanted === 'zreturn') p.wanted = 'sweep'; });
                    if (target) { trail.push('ztoReturn:' + target.code); returnTarget = target; }
                }
                for (const p of plan) if (p.mode !== 'online') await p.dev.page.evaluate(() => { fb.goOffline(db); });
                const started = await Promise.all(plan.map((p) => p.dev.page.evaluate((args) => window.__startOp(args), { wanted: p.wanted, pick: p.pick, amt: p.amt, code: p.code, phone: p.phone, target: p.target }).catch((e) => 'threw:evaluate:' + (e && e.message))));
                if (plan.length >= 2 && plan.every((p, k) => p.wanted === 'sweep' && started[k] === 'sweep')) injections.sweepRace++;
                if (plan.length >= 2 && plan.every((p, k) => p.wanted === 'zreturn' && started[k] === 'zreturn')) injections.returnRace++;
                plan.forEach((p, k) => { if (started[k]) trail.push(p.dev.name.slice(8, 9) + ':' + started[k] + (p.mode === 'online' ? '' : '[' + p.mode + ']')); });
                if (started.every((s) => s)) injections.concurrent++;
                if (started.some((s) => String(s).indexOf('threw:') === 0)) { broke = 'op បោះកំហុស ៖ ' + started.filter((s) => String(s).indexOf('threw:') === 0).join(' · '); }
                await Promise.all(plan.map(async (p, k) => {
                    if (p.mode === 'online') return;
                    if (p.mode === 'offline-online') {
                        await sleep(300 + Math.floor(r() * 700));
                        await p.dev.page.evaluate(() => { fb.goOnline(db); });
                        if (started[k] === p.wanted) injections.offlineOnline++;
                        return;
                    }
                    await sleep(p.reloadAfter);
                    await p.dev.page.reload({ waitUntil: 'load' });
                    if (started[k] === p.wanted) injections.offlineReload++;
                    const back = await p.dev.waitOnline(40000);
                    if (back < 0) {
                        const st = await p.dev.state();
                        if (st.status.indexOf('ចូល') !== -1 || st.phase === 'signed-out') { await p.dev.login(); if ((await p.dev.waitOnline(30000)) < 0) broke = 'ឧបករណ៍ ' + p.dev.name + ' មិនដល់ ready ក្រោយ reload ៖ ' + JSON.stringify(await p.dev.state()); }
                        else broke = 'ឧបករណ៍ ' + p.dev.name + ' មិនដល់ ready ក្រោយ reload ៖ ' + JSON.stringify(st);
                    }
                }));
                if (broke) break;
                // settle: ops done · pending 0 · journal rows 0 · not blocked
                const settle = async () => {
                    const t0 = Date.now();
                    for (;;) {
                        const states = await Promise.all(devices.map((d) => d.state()));
                        const done = await Promise.all(devices.map((d) => d.page.evaluate(() => window.__settled()).catch(() => false)));
                        states.forEach((st, k) => { if (DEBUG && st.results.length) console.log('      ' + devices[k].name + ' ' + JSON.stringify(st.results)); });
                        if (devicesSettled(states, done)) return null;
                        if (Date.now() - t0 > 45000) return states;
                        await sleep(300);
                    }
                };
                let stuck = await settle();
                if (stuck) {
                    await Promise.all(devices.map((d) => d.page.evaluate(() => { try { window.runScheduledCleanup(); window.resumeInterruptedCleanups(); } catch (e) {} }).catch(() => {})));
                    stuck = await settle();
                }
                if (stuck) { stuckDevices++; broke = 'ឧបករណ៍មិនស្ងប់ក្នុង ៤៥ វិ. (pending · journal · blocked · cleanup journal) ក្រោយ [' + trail.join(' > ') + ']\n        ' + JSON.stringify(stuck.map((s) => ({ status: s.status, phase: s.phase, pending: s.pending, blocked: s.blocked, rows: s.rows, cleanupJournal: s.cleanupJournal, pickupJournal: s.pickupJournal, trashClaims: s.trashClaims }))); break; }
                const dump = await (await owner('.json')).json();
                const inv = invariant(dump || {}, dateKey, monthKey, knownCodes);
                // ⛔ barcode ដែលធ្លាប់ដល់ server (ស្កេនរួចចុះ) មិនត្រូវបាត់ទៀត; ស្កេនដែល queue បាត់ដោយ reload មុនចុះ មិនរាប់
                Object.keys(inv.seenCodes).forEach((c) => { if (knownCodes.indexOf(c) === -1) knownCodes.push(c); });
                const why = invariantBroken(inv);
                if (i === 2 && returnTarget) {
                    const back = Object.values(dump.zoew_scan_history_cod_dod || {}).some((it) => Object.values((it && it.barcodes) || {}).some((b) => b && b.code === returnTarget.code));
                    if (back) injections.restoreRace++; else trail.push('restoreRace:refused');
                }
                if (DEBUG) console.log('    #' + i + ' ' + trail.slice(-2).join(' | ') + ' -> ' + JSON.stringify(Object.assign({}, inv, { seenCodes: undefined })));
                if (why) {
                    broke = why + ' ក្រោយ [' + trail.join(' > ') + ']\n        ' + JSON.stringify(Object.assign({}, inv, { seenCodes: undefined }));
                    if (DEBUG) console.log('    DUMP ' + JSON.stringify({ hist: dump.zoew_scan_history_cod_dod, trash: dump.zoew_recently_deleted_cod_dod, rev: dump.zoew_daily_revenue_cod_dod, month: dump.zoew_monthly_revenue_cod_dod, pickup: dump.zoew_daily_pickup_cod_dod }, null, 1));
                    break;
                }
            }
            const noisy = devices.flatMap((d) => d.errors).filter((e) => !/sentry|gstatic|fonts\.googleapis|ERR_|Failed to fetch|NetworkError|timed out/i.test(e));
            if (!broke && noisy.length) broke = 'កំហុស runtime / unhandledrejection ៖ ' + noisy.slice(0, 3).join(' · ');
        } catch (e) {
            broke = 'Cookie flow: ' + (e && e.stack || e);
        } finally {
            if (broke) {
                const server = await Promise.race([owner('.json').then((response) => response.json()).catch((error) => ({ error: String(error.message) })), sleep(2000).then(() => ({ diagnosticTimeout: true }))]);
                console.log('    EVIDENCE ' + JSON.stringify({ run, failure: broke, devices: await recoveryEvidence(devices), server, invariant: invariant(server || {}, dateKey, monthKey, knownCodes) }));
            }
            for (const dev of devices) await dev.ctx.close().catch(() => {});
        }
        runsDone++;
        console.log('  run ' + run + ' ' + (broke ? 'FAIL' : 'ok') + ' · ' + trail.length + ' ops · ' + trail.join(' > ').slice(0, 300));
        if (broke) { brokenRuns++; runFailures.push('run=' + run + ' ' + broke); }
    }
    await browser.close().catch(() => {});
    await new Promise((resolve) => staticServer.close(resolve));
    cookie.close();
    check(runsDone === RUNS && brokenRuns === 0, 'អថេរលុយ · ស្ថិតិ · registry · barcode រក្សាបាន ក្នុង ' + runsDone + ' លំដាប់ × ' + OPS + ' ជុំ (ឧបករណ៍ ' + DEVICES + ' ស្របគ្នា · SDK ពិត · rules ពិត)', runFailures.join('\n'));
    check(stuckDevices === 0, 'គ្មានឧបករណ៍ជាប់ (blocked · journal · pending) ក្រោយ offline/reload', stuckDevices);
    check(injections.offlineReload > 0 && injections.offlineOnline > 0, 'ជាន់អប្បបរមា ៖ ការចាក់ offline+reload (' + injections.offlineReload + ') និង offline+online (' + injections.offlineOnline + ') បានបាញ់ពិត', injections);
    check(injections.sweepRace > 0, 'ជាន់អប្បបរមា ៖ ការសម្អាតស្វ័យប្រវត្តិប្រជែងពីរឧបករណ៍បានបាញ់ពិត (' + injections.sweepRace + ')', injections);
    check(OPS < 2 || injections.returnRace >= RUNS, 'ជាន់អប្បបរមា ៖ «ZTO ត្រឡប់» ប្រជែងពី ' + DEVICES + ' ឧបករណ៍លើ barcode ដដែលបានបាញ់ពិត (' + injections.returnRace + ')', injections);
    check(injections.concurrent > 0, 'ជាន់អប្បបរមា ៖ ប្រតិបត្តិការស្របគ្នាពីរឧបករណ៍បានបាញ់ពិត (' + injections.concurrent + ')', injections);
    check(OPS < 3 || injections.restoreRace >= RUNS, 'ជាន់អប្បបរមា ៖ ការស្តារប្រជែងពី ' + DEVICES + ' ឧបករណ៍លើកញ្ចប់ «ZTO ត្រឡប់» ស្តារបានពិតគ្រប់លំដាប់ (' + injections.restoreRace + '/' + RUNS + ') — គ្មានត្រារបៀបធុងសំរាមចាស់ពី flow មុនបិទការស្តារ', injections);
    console.log('\n' + (fail ? 'FAIL ' + fail + ' / ok ' + pass : 'PASS ' + pass + '/' + pass));
    process.exitCode = fail ? 1 : 0;
})().catch((e) => { console.log('  FAIL  checker បោះកំហុស ៖ ' + (e && e.stack || e)); process.exitCode = 1; });
