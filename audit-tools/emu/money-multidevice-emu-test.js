'use strict';
// ថ្នាក់ ៖ **ឧបករណ៍ ២ ពិត · SDK Firebase ពិត · rules ពិត · emulator ពិត** ធ្វើប្រតិបត្តិការលុយ **ស្របគ្នា** លើទិន្នន័យតែមួយ
// (បិទ · ដក · លុប · ស្តារ · កែតម្លៃ · ស្កេន · ការសម្អាតស្វ័យប្រវត្តិ ២h/៧ថ្ងៃ) ខណៈបណ្តាញដាច់ (`goOffline`) ហើយ
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
// SKIP ≠ PASS ៖ គ្មាន emulator ➜ SKIPPED (STRICT ➜ FAIL)។ env ៖ MONEYMD_RUNS · MONEYMD_OPS · MONEYMD_RUN0 · MONEYMD_DEBUG=1

process.exitCode = 1;

const fs = require('fs');
const http = require('http');
const path = require('path');
const { emuNamespace } = require('./ns.js');

const ROOT = process.env.MONEYMD_APP_DIR ? path.resolve(process.env.MONEYMD_APP_DIR) : path.join(__dirname, '..', '..');
const DIR = path.join(ROOT, 'ZoeW');
const EMU_PORT = parseInt(process.env.MONEYMD_EMU_PORT || '9000', 10);
const CHROME = process.env.MONEYMD_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const STRICT = process.env.MONEYMD_STRICT === '1' || process.env.CRUD_FLOW_STRICT === '1';
const RUNS = parseInt(process.env.MONEYMD_RUNS || '3', 10);
const OPS = parseInt(process.env.MONEYMD_OPS || '12', 10);
const RUN0 = parseInt(process.env.MONEYMD_RUN0 || '0', 10);
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
const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

function emulatorUp() {
    return fetch('http://127.0.0.1:' + EMU_PORT + '/.json?ns=demo-zoe-probe').then((r) => r.ok, () => false);
}

function unsignedToken(uid, email, projectId) {
    const b = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const now = Math.floor(Date.now() / 1000);
    return b({ alg: 'none', typ: 'JWT' }) + '.' + b({
        iss: 'https://securetoken.google.com/' + projectId, aud: projectId, auth_time: now, user_id: uid, sub: uid,
        iat: now, exp: now + 3600, email, email_verified: false, firebase: { identities: { email: [email] }, sign_in_provider: 'password' }
    }) + '.';
}

const LICENSE_STUB = `window.ZoeLicense = {
    getStatus: function () { return Promise.resolve({ state: 'active' }); },
    setServerTimeOffset: function () {}, syncServerTime: function () { return Promise.resolve(); },
    activate: function () { return Promise.resolve({ valid: true }); }, checkOnline: function () { return Promise.resolve({ ok: true }); },
    announcementsUrl: function () { return ''; }, clearActivation: function () {}
};`;

// ---- invariant on the SERVER copy (REST owner dump) ----
function invariant(dump, dateKey, monthKey, knownCodes) {
    const hist = dump.zoew_scan_history_cod_dod || {};
    const trash = dump.zoew_recently_deleted_cod_dod || {};
    const bcsOf = (it) => {
        const v = it && it.barcodes;
        if (!v) return null;
        if (Array.isArray(v)) return v.filter(Boolean);
        if (typeof v === 'object') return Object.keys(v).sort((a, b) => (+a) - (+b)).map((k) => v[k]).filter(Boolean);
        return null;
    };
    let cod = 0, dod = 0, count = 0, closed = 0;
    const seen = {}; const dup = []; const live = {};
    const walk = (bag, where) => Object.keys(bag).forEach((id) => {
        const it = bag[id]; if (!it) return;
        const bcs = bcsOf(it) || (it.barcode ? [{ code: it.barcode, cod: it.cod, dod: it.dod, isClosed: it.isClosed, isDeducted: it.isDeducted }] : []);
        bcs.forEach((b) => {
            if (!b || !b.code) return;
            if (seen[b.code]) dup.push(b.code + '@' + seen[b.code] + '+' + where); else seen[b.code] = where;
            live[String(b.code).toUpperCase().replace(/[^A-Z0-9_-]/g, '_')] = true;
            if (it.scanDate !== dateKey) return;
            if (b.isClosed === true) closed++;
            if (b.isDeducted !== true) { cod += parseFloat(b.cod) || 0; dod += parseFloat(b.dod) || 0; count++; }
        });
    });
    walk(hist, 'hist'); walk(trash, 'trash');
    const rev = (dump.zoew_daily_revenue_cod_dod || {})[dateKey] || {};
    const daily = dump.zoew_daily_revenue_cod_dod || {};
    let mCod = 0, mDod = 0, mCount = 0;
    Object.keys(daily).forEach((d) => { if (d.slice(0, 7) !== monthKey) return; mCod += parseFloat(daily[d].codDollar) || 0; mDod += parseFloat(daily[d].dodDollar) || 0; mCount += parseFloat(daily[d].totalCount) || 0; });
    const month = (dump.zoew_monthly_revenue_cod_dod || {})[monthKey] || {};
    const pick = (dump.zoew_daily_pickup_cod_dod || {})[dateKey] || {};
    const phones = pick.pickedUpPhones || {};
    let phoneSum = 0; const zeroRef = [];
    Object.keys(phones).forEach((k) => { phoneSum += parseFloat(phones[k]) || 0; if (!(phones[k] > 0)) zeroRef.push(k); });
    const reg = dump.zoew_barcode_registry || {};
    const orphans = Object.keys(reg).filter((k) => reg[k] === true && !live[k]);
    const lost = knownCodes.filter((c) => !seen[c]);
    const receipts = Object.keys(dump.zoew_write_receipts || {}).length;
    return {
        expectCod: r2(cod), gotCod: r2(parseFloat(rev.codDollar) || 0), expectDod: r2(dod), gotDod: r2(parseFloat(rev.dodDollar) || 0),
        expectCount: count, gotCount: parseFloat(rev.totalCount) || 0,
        monthCod: r2(parseFloat(month.codDollar) || 0), monthDod: r2(parseFloat(month.dodDollar) || 0), monthCount: parseFloat(month.totalCount) || 0,
        expectMonthCod: r2(mCod), expectMonthDod: r2(mDod), expectMonthCount: mCount,
        pkg: parseFloat(pick.packagesPickedUp) || 0, expectPkg: closed, phoneSum, zeroRef, dup, orphans, lost, receipts, seenCodes: seen
    };
}
function invariantBroken(inv) {
    if (inv.expectCod !== inv.gotCod || inv.expectDod !== inv.gotDod || inv.expectCount !== inv.gotCount) return 'ledger ថ្ងៃ ≠ ផលបូក barcode មិនទាន់ដក';
    if (inv.monthCod !== inv.expectMonthCod || inv.monthDod !== inv.expectMonthDod || inv.monthCount !== inv.expectMonthCount) return 'ledger ខែ ≠ ផលបូក ledger ថ្ងៃ';
    if (inv.pkg !== inv.expectPkg) return 'packagesPickedUp ≠ barcode បិទ';
    if (inv.phoneSum !== inv.pkg) return 'sum(pickedUpPhones) ≠ packagesPickedUp';
    if (inv.zeroRef.length) return 'pickedUpPhones ≤ 0';
    if (inv.dup.length) return 'barcode ស្ថិតទាំងប្រវត្តិនិងធុងសំរាម';
    if (inv.orphans.length) return 'កូនសោ registry កំព្រា';
    if (inv.lost.length) return 'barcode បាត់ពីប្រព័ន្ធ (គ្មានក្នុងប្រវត្តិ · គ្មានក្នុងធុងសំរាម)';
    return null;
}

const PAGE_OPS = function () {
    const w = window;
    w.__ops = [];
    w.__opResults = [];
    const bcOf = (it, pick) => (it && Array.isArray(it.barcodes) && it.barcodes.length) ? it.barcodes[Math.floor(pick * it.barcodes.length) % it.barcodes.length] : null;
    const at = (arr, pick) => arr.length ? arr[Math.floor(pick * arr.length) % arr.length] : null;
    w.__startOp = (args) => {
        const { wanted, pick, amt, code, phone } = args;
        const live = (w.scanHistory || []).filter(Boolean);
        const trash = (w.deletedItems || []).filter(Boolean);
        let started = null;
        try {
            if (wanted === 'scan') {
                w.triggerScanAction(code);
                const bcText = document.getElementById('modalBarcodeText');
                const modal = document.getElementById('phoneModal');
                const open = modal && getComputedStyle(modal).display !== 'none';
                if (!open || !bcText || bcText.innerText !== code) return null;
                const p = document.getElementById('modalPhoneInput'); if (p) p.value = phone;
                const c = document.getElementById('modalCodInput'); if (c) c.value = String(amt);
                const d2 = document.getElementById('modalDodInput'); if (d2) d2.value = String(Math.round(amt / 4 * 100) / 100);
                started = Promise.resolve(w.confirmPhone());
            } else if (wanted === 'closeOrder') { const it = at(live, pick); if (!it) return null; started = Promise.resolve(w.toggleCloseStatus(it.id)); }
            else if (wanted === 'closeBarcode') { const it = at(live, pick); const b = bcOf(it, pick); if (!it || !b) return null; started = Promise.resolve(w.toggleIndividualBarcodeClose(it.id, b.code)); }
            else if (wanted === 'removeBarcode') { const it = at(live, pick); const b = bcOf(it, pick); if (!it || !b) return null; started = Promise.resolve(w.removeSingleBarcode(it.id, b.code)); }
            else if (wanted === 'deleteItem') { const it = at(live, pick); if (!it) return null; started = Promise.resolve(w.deleteSingleItem(it.id)); }
            else if (wanted === 'restore') { const it = at(trash, pick); if (!it) return null; w.promptRestoreDeletedItem(it.id); started = Promise.resolve(w.executeRestoreItem()); }
            else if (wanted === 'editPrice') {
                const it = at(live, pick); const b = bcOf(it, pick); if (!it || !b) return null;
                w.openEditBarcodePriceModal(it.id, b.code);
                const c = document.getElementById('editBcCodInput'); if (c) c.value = String(amt);
                const d2 = document.getElementById('editBcDodInput'); if (d2) d2.value = '0';
                started = Promise.resolve(w.saveEditedBarcodePrice());
            } else if (wanted === 'sweep') { started = Promise.resolve(w.runAutomaticCleanupRules()); }
            else return null;
        } catch (e) { w.__opResults.push({ wanted, threw: String(e && e.message) }); return 'threw:' + wanted + ':' + (e && e.message); }
        const p = started.then((r) => { w.__opResults.push({ wanted, r: typeof r === 'object' ? 'object' : String(r) }); }, (e) => { w.__opResults.push({ wanted, e: String(e && e.message) }); });
        w.__ops.push(p);
        return wanted;
    };
    w.__settled = () => Promise.race([Promise.allSettled(w.__ops).then(() => true), new Promise((res) => setTimeout(() => res(false), 100))]);
    w.__state = () => ({
        status: (document.getElementById('firebaseStatusText') || {}).textContent || '',
        phase: typeof w.connectionFlowSnapshot === 'function' ? w.connectionFlowSnapshot().phase : null,
        pending: typeof w.nativeWriteRecoveryState === 'function' && w.db ? w.nativeWriteRecoveryState(w.db).pending : -1,
        blocked: typeof w.nativeWriteRecoveryState === 'function' && w.db ? w.nativeWriteRecoveryState(w.db).blocked : -1,
        rows: Object.keys(localStorage).filter((k) => k.startsWith('zoew_connection_writes_v1:')).length,
        cleanupJournal: (() => { try { return Object.keys(JSON.parse(localStorage.getItem('zoew_cleanup_journal_v1') || '{}')).length; } catch (e) { return -1; } })(),
        history: Array.isArray(w.scanHistory) ? w.scanHistory.length : -1,
        results: w.__opResults.splice(0)
    });
};

(async () => {
    console.log('=== emu/money-multidevice — ឧបករណ៍ ២ ពិត · SDK ពិត · rules ពិត · ប្រតិបត្តិការលុយស្របគ្នា · offline · reload ===');
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

    const staticServer = await new Promise((res) => {
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
    const PROJECT = 'demo-zoe-moneymd';
    const browser = await chromium.launch({ executablePath: CHROME, args: ['--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1'] });
    const rules = JSON.parse(fs.readFileSync(path.join(ROOT, 'firebase-database.rules.json'), 'utf8'));
    const now = Date.now();
    const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Phnom_Penh', year: 'numeric', month: '2-digit', day: '2-digit' });
    const dateKey = fmt.format(now);
    const monthKey = dateKey.slice(0, 7);
    const injections = { offlineOnline: 0, offlineReload: 0, sweepRace: 0, concurrent: 0 };
    let brokenRuns = 0, firstDetail = '', runsDone = 0, stuckDevices = 0;

    const makeDevice = async (ns, uid, email) => {
        const ctx = await browser.newContext({ viewport: { width: 412, height: 780 }, serviceWorkers: 'block' });
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
            const token = unsignedToken(uid, email, PROJECT);
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
        const page = await ctx.newPage();
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e && e.message)));
        page.on('dialog', (d) => d.accept().catch(() => {}));
        const dev = { ctx, page, uid, email, errors, name: uid };
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

    const OPNAMES = ['scan', 'closeOrder', 'closeBarcode', 'removeBarcode', 'deleteItem', 'restore', 'editPrice', 'sweep', 'closeBarcode', 'removeBarcode', 'restore'];
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
        const devices = [await makeDevice(NS, 'moneymd-a-' + run, 'a@zoew1.com'), await makeDevice(NS, 'moneymd-b-' + run, 'b@zoew1.com')];
        let broke = null; const trail = [];
        try {
            for (const dev of devices) { if (!(await dev.login())) { broke = 'ប្រអប់ចូលមិនលេច (' + dev.name + ')'; break; } }
            if (!broke) for (const dev of devices) { if ((await dev.waitOnline(30000, 5)) < 0) { broke = 'ឧបករណ៍ ' + dev.name + ' មិនដល់ «' + ONLINE_TEXT + '» + ប្រវត្តិ ៥ ជួរ ៖ ' + JSON.stringify(await dev.state()); break; } }
            for (let i = 0; i < OPS && !broke; i++) {
                const plan = devices.map((dev) => {
                    const pick = r();
                    const wanted = OPNAMES[Math.floor(r() * OPNAMES.length)];
                    const mode = r() < 0.55 ? 'online' : (r() < 0.5 ? 'offline-online' : 'offline-reload');
                    const code = 'SC' + run + '_' + i + '_' + Math.floor(pick * 1e5);
                    return { dev, wanted, pick, amt: Math.round(r() * 4000) / 100, mode, code, phone: pick > 0.5 ? '0120100000' : '09' + Math.floor(pick * 1e8), reloadAfter: 150 + Math.floor(r() * 1400) };
                });
                if (plan.some((p) => p.wanted === 'sweep')) {
                    const ids = Object.keys((await (await owner('zoew_scan_history_cod_dod.json')).json()) || {});
                    if (ids.length) {
                        const id = ids[Math.floor(r() * ids.length) % ids.length];
                        const item = await (await owner('zoew_scan_history_cod_dod/' + id + '.json')).json();
                        if (item) {
                            const bcs = Array.isArray(item.barcodes) ? item.barcodes : Object.values(item.barcodes || {});
                            const patch = {};
                            if (item.isClosed || bcs.some((b) => b && b.isClosed)) {
                                const ripe = Date.now() - 3 * 3600 * 1000;
                                if (item.isClosed) patch.closedAt = ripe;
                                bcs.forEach((b, k) => { if (b && b.isClosed) patch['barcodes/' + k + '/closedAt'] = ripe; });
                                trail.push('age:pickup:' + id);
                            } else {
                                const old = Date.now() - 9 * 24 * 3600 * 1000;
                                patch.createdAt = old;
                                bcs.forEach((b, k) => { if (b) patch['barcodes/' + k + '/createdAt'] = old; });
                                trail.push('age:abandon:' + id);
                            }
                            await owner('zoew_scan_history_cod_dod/' + id + '.json', 'PATCH', patch);
                            await sleep(700);
                            plan.forEach((p) => { p.wanted = 'sweep'; p.mode = p.mode === 'offline-reload' ? 'online' : p.mode; });
                            injections.sweepRace++;
                        }
                    }
                }
                for (const p of plan) if (p.mode !== 'online') await p.dev.page.evaluate(() => { fb.goOffline(db); }).catch(() => {});
                const started = await Promise.all(plan.map((p) => p.dev.page.evaluate((args) => window.__startOp(args), { wanted: p.wanted, pick: p.pick, amt: p.amt, code: p.code, phone: p.phone }).catch((e) => 'threw:evaluate:' + (e && e.message))));
                plan.forEach((p, k) => { if (started[k]) trail.push(p.dev.name.slice(8, 9) + ':' + started[k] + (p.mode === 'online' ? '' : '[' + p.mode + ']')); });
                if (started.every((s) => s)) injections.concurrent++;
                if (started.some((s) => String(s).indexOf('threw:') === 0)) { broke = 'op បោះកំហុស ៖ ' + started.filter((s) => String(s).indexOf('threw:') === 0).join(' · '); }
                await Promise.all(plan.map(async (p, k) => {
                    if (p.mode === 'online') return;
                    if (p.mode === 'offline-online') {
                        await sleep(300 + Math.floor(r() * 700));
                        await p.dev.page.evaluate(() => { fb.goOnline(db); }).catch(() => {});
                        if (started[k]) injections.offlineOnline++;
                        return;
                    }
                    await sleep(p.reloadAfter);
                    await p.dev.page.reload({ waitUntil: 'load' }).catch(() => {});
                    if (started[k]) injections.offlineReload++;
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
                        const done = await Promise.all(devices.map((d) => d.page.evaluate(() => window.__settled()).catch(() => true)));
                        states.forEach((st, k) => { if (DEBUG && st.results.length) console.log('      ' + devices[k].name + ' ' + JSON.stringify(st.results)); });
                        if (states.every((st, k) => done[k] && st.pending === 0 && st.rows === 0 && st.phase === 'ready' && st.cleanupJournal === 0)) return null;
                        if (Date.now() - t0 > 45000) return states;
                        await sleep(300);
                    }
                };
                let stuck = await settle();
                if (stuck) {
                    await Promise.all(devices.map((d) => d.page.evaluate(() => { try { window.runScheduledCleanup(); window.resumeInterruptedCleanups(); } catch (e) {} }).catch(() => {})));
                    stuck = await settle();
                }
                if (stuck) { stuckDevices++; broke = 'ឧបករណ៍មិនស្ងប់ក្នុង ៤៥ វិ. (pending · journal · blocked · cleanup journal) ក្រោយ [' + trail.join(' > ') + ']\n        ' + JSON.stringify(stuck.map((s) => ({ status: s.status, phase: s.phase, pending: s.pending, blocked: s.blocked, rows: s.rows, cleanupJournal: s.cleanupJournal }))); break; }
                const dump = await (await owner('.json')).json();
                const inv = invariant(dump || {}, dateKey, monthKey, knownCodes);
                // ⛔ barcode ដែលធ្លាប់ដល់ server (ស្កេនរួចចុះ) មិនត្រូវបាត់ទៀត; ស្កេនដែល queue បាត់ដោយ reload មុនចុះ មិនរាប់
                Object.keys(inv.seenCodes).forEach((c) => { if (knownCodes.indexOf(c) === -1) knownCodes.push(c); });
                const why = invariantBroken(inv);
                if (DEBUG) console.log('    #' + i + ' ' + trail.slice(-2).join(' | ') + ' -> ' + JSON.stringify(Object.assign({}, inv, { seenCodes: undefined })));
                if (why) {
                    broke = why + ' ក្រោយ [' + trail.join(' > ') + ']\n        ' + JSON.stringify(Object.assign({}, inv, { seenCodes: undefined }));
                    if (DEBUG) console.log('    DUMP ' + JSON.stringify({ hist: dump.zoew_scan_history_cod_dod, trash: dump.zoew_recently_deleted_cod_dod, rev: dump.zoew_daily_revenue_cod_dod, month: dump.zoew_monthly_revenue_cod_dod, pickup: dump.zoew_daily_pickup_cod_dod }, null, 1));
                    break;
                }
            }
            const noisy = devices.flatMap((d) => d.errors).filter((e) => !/sentry|gstatic|fonts\.googleapis|ERR_|Failed to fetch|NetworkError|timed out/i.test(e));
            if (!broke && noisy.length) broke = 'កំហុស runtime / unhandledrejection ៖ ' + noisy.slice(0, 3).join(' · ');
        } finally {
            for (const dev of devices) await dev.ctx.close().catch(() => {});
        }
        runsDone++;
        console.log('  run ' + run + ' ' + (broke ? 'FAIL' : 'ok') + ' · ' + trail.length + ' ops · ' + trail.join(' > ').slice(0, 300));
        if (broke) { brokenRuns++; if (!firstDetail) firstDetail = 'run=' + run + ' ' + broke; }
    }
    await browser.close().catch(() => {});
    staticServer.close();
    check(runsDone === RUNS && brokenRuns === 0, 'អថេរលុយ · ស្ថិតិ · registry · barcode រក្សាបាន ក្នុង ' + runsDone + ' លំដាប់ × ' + OPS + ' ជុំ (ឧបករណ៍ ២ ស្របគ្នា · SDK ពិត · rules ពិត)', firstDetail);
    check(stuckDevices === 0, 'គ្មានឧបករណ៍ជាប់ (blocked · journal · pending) ក្រោយ offline/reload', stuckDevices);
    check(injections.offlineReload > 0 && injections.offlineOnline > 0, 'ជាន់អប្បបរមា ៖ ការចាក់ offline+reload (' + injections.offlineReload + ') និង offline+online (' + injections.offlineOnline + ') បានបាញ់ពិត', injections);
    check(injections.sweepRace > 0, 'ជាន់អប្បបរមា ៖ ការសម្អាតស្វ័យប្រវត្តិប្រជែងពីរឧបករណ៍បានបាញ់ពិត (' + injections.sweepRace + ')', injections);
    check(injections.concurrent > 0, 'ជាន់អប្បបរមា ៖ ប្រតិបត្តិការស្របគ្នាពីរឧបករណ៍បានបាញ់ពិត (' + injections.concurrent + ')', injections);
    console.log('\n' + (fail ? 'FAIL ' + fail + ' / ok ' + pass : 'PASS ' + pass + '/' + pass));
    process.exitCode = fail ? 1 : 0;
})().catch((e) => { console.log('  FAIL  checker បោះកំហុស ៖ ' + (e && e.stack || e)); process.exitCode = 1; });
