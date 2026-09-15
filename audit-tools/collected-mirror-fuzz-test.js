// ⛔ ថ្នាក់កំហុស ៖ **កញ្ចក់ «ចំណូលប្រចាំថ្ងៃ» ឃ្លាតពី ledger លើលំដាប់ចៃដន្យ**។
//
// ហេតុអ្វីឧបករណ៍នេះមាន ៖ `zoew_daily_collected_cod_dod` ជាផ្ទៃលុយដែល **ថ្មី
// ជាងគេ** ហើយអ្នកយាមរបស់វាទាំងអស់ (`collected-mirror-lifecycle-test` ·
// `daily-collected-test` · `price-edit-abort-test`) សុទ្ធតែជា **សេណារីយ៉ូ
// សរសេរដោយដៃ**។ នេះជាទម្រង់ដដែលដែល `CLAUDE.md` ដាក់ឈ្មោះថា «ជាន់ទី ៥ ៖
// លំដាប់ចៃដន្យ» ៖ រាល់ជុំសរសេរសេណារីយ៉ូល្អជាងមុនបន្តិច ➜ រកឃើញកំហុស
// មួយទៀតក្នុងកូដដដែល។ វាស់បាន ៖ `revenue-fuzz-test` និង
// `collected-value-fuzz-test` មាន **០ ការយោង** ទៅកញ្ចក់នេះ ➜ ផ្ទៃទាំងមូល
// គ្មានអ្នកយាមចៃដន្យសោះ។
//
// ⛔ **អយស្ករឯករាជ្យ** (មិនមែនការប្រៀបធៀប App នឹងខ្លួនឯង) ៖
//     Σ កញ្ចក់ = Σ (cod+dod) នៃ barcode គ្រប់កន្លែង (ប្រវត្តិ **និង** ធុងសំរាម)
//               ដែល `isClosed === true && !isDeducted`
// វាដេរីវេពី `collected = ledger − open` ៖
//     ledger = Σ barcode ដែល `!isDeducted`
//     open   = Σ barcode ដែល `!isDeducted && !isClosed`
//     ➜ collected = Σ barcode ដែល `!isDeducted && isClosed`   ∎
// ដូច្នេះការធ្លាក់មានន័យថា **អេក្រង់លុយ ២ និយាយផ្ទុយគ្នា** ៖ 💵 «ចំណូល
// ប្រចាំថ្ងៃ» (អានកញ្ចក់) ធៀបនឹង 📅 ស្ថិតិប្រចាំថ្ងៃ (គណនា ledger − open)។
//
// ⛔ តម្លៃសាកល្បង **មានសេន** ដោយចេតនា — លេខមូលលាក់ mutation នៃការបង្គត់។
// ⛔ fake SDK **បដិសេធតាម rules ពិត** (លេខអវិជ្ជមាន ➜ permission_denied)។
process.exitCode = 1;

let chromium;
try { chromium = require('playwright-core').chromium; } catch (e) { console.log('SKIP — ត្រូវការ playwright-core (npm i playwright-core)'); process.exitCode = 0; process.exit(0); }
const fs = require('fs');
const http = require('http');
const path = require('path');
const CHROME = process.env.MIRRORFUZZ_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
if (!fs.existsSync(CHROME)) { console.log('SKIP — រកមិនឃើញ Chromium នៅ ' + CHROME); process.exitCode = 0; process.exit(0); }
const ROOT = process.env.MIRRORFUZZ_APP_DIR || path.join(__dirname, '..');
const RUN0 = parseInt(process.env.MFUZZ_RUN0 || '0', 10);
const RUNS = parseInt(process.env.MFUZZ_RUNS || '12', 10);
const OPS = parseInt(process.env.MFUZZ_OPS || '9', 10);
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm' };
const APP_ZONE = 'Asia/Phnom_Penh';

let pass = 0, fail = 0;
const failSamples = [];
function ok(label, cond, detail) {
    if (cond) { pass++; }
    else { fail++; if (failSamples.length < 8) failSamples.push(label + (detail !== undefined ? '\n        ' + String(detail).slice(0, 600) : '')); }
}

function zoneDateKey(ms, off) {
    const p = new Intl.DateTimeFormat('en-CA', { timeZone: APP_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(ms).split('-');
    const base = Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    const s = new Date(base + (off || 0) * 86400000);
    return s.getUTCFullYear() + '-' + String(s.getUTCMonth() + 1).padStart(2, '0') + '-' + String(s.getUTCDate()).padStart(2, '0');
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

const LICENSE_STUB = 'window.ZoeLicense={getStatus:function(){return Promise.resolve({state:"active"});},setServerTimeOffset:function(){},syncServerTime:function(){return Promise.resolve();},activate:function(){return Promise.resolve({ok:true});},verifyKeyString:function(){return Promise.resolve({ok:true});},clearActivation:function(){}};';

const FAKE_SDK = function (seed) {
    const store = JSON.parse(JSON.stringify(seed));
    window.__fakeStore = store;
    window.__rejected = [];
    const listeners = [];
    function getPath(p) { if (!p || p === '/') return store; let cur = store; const parts = p.split('/').filter(Boolean); for (let i = 0; i < parts.length; i++) { if (cur === null || cur === undefined || typeof cur !== 'object') return null; cur = cur[parts[i]]; } return cur === undefined ? null : cur; }
    function validate(p, val) {
        if (/^zoew_daily_revenue_cod_dod\/[^/]+$/.test(p) && val && typeof val === 'object') {
            if (Number(val.codDollar) < 0 || Number(val.dodDollar) < 0 || Number(val.totalCount) < 0) return 'negative daily revenue';
        }
        if (p === 'zoew_monthly_revenue_cod_dod' && val && typeof val === 'object') {
            const keys = Object.keys(val);
            for (let i = 0; i < keys.length; i++) { const m = val[keys[i]]; if (m && (Number(m.codDollar) < 0 || Number(m.dodDollar) < 0 || Number(m.totalCount) < 0)) return 'negative monthly revenue'; }
        }
        if (/^zoew_daily_pickup_cod_dod\/[^/]+$/.test(p) && val && typeof val === 'object') {
            const ph = val.pickedUpPhones || {};
            const keys = Object.keys(ph);
            for (let i = 0; i < keys.length; i++) if (!(Number(ph[keys[i]]) > 0)) return 'pickedUpPhones must be > 0';
        }
        return null;
    }
    function setPath(p, val) {
        const parts = p.split('/').filter(Boolean); if (!parts.length) return;
        let cur = store;
        for (let i = 0; i < parts.length - 1; i++) { if (cur[parts[i]] === null || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {}; cur = cur[parts[i]]; }
        const last = parts[parts.length - 1];
        if (val === null) delete cur[last];
        else if (val && typeof val === 'object' && Object.prototype.hasOwnProperty.call(val, '__fakeIncrement')) { const c = Number(cur[last]); cur[last] = (Number.isFinite(c) ? c : 0) + Number(val.__fakeIncrement); }
        else cur[last] = JSON.parse(JSON.stringify(val));
    }
    function snapOf(p) {
        if (p === '.info/connected') return { val: function () { return true; }, exists: function () { return true; } };
        if (p === '.info/serverTimeOffset') return { val: function () { return 0; }, exists: function () { return true; } };
        const v = getPath(p);
        return { val: function () { return (v === null || v === undefined) ? null : (typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v); }, exists: function () { return v !== null && v !== undefined; } };
    }
    function fire(p) { listeners.filter(function (l) { return l.path === p; }).forEach(function (l) { try { l.cb(snapOf(p)); } catch (e) { window.__listenerThrew = String(e && e.message); } }); }
    function fireAll() { const seen = {}; listeners.forEach(function (l) { if (!seen[l.path]) { seen[l.path] = 1; fire(l.path); } }); }
    window.__fireAll = fireAll;
    const user = { uid: 'admin-uid', email: 'a@b.c', getIdToken: function () { return Promise.resolve('tok'); }, metadata: { lastSignInTime: new Date().toISOString() } };
    window.firebaseSDK = {
        initializeApp: function () { return { name: 'fake' }; }, getApps: function () { return []; }, deleteApp: function () { return Promise.resolve(); },
        getAuth: function () { return { currentUser: user }; },
        onAuthStateChanged: function (a, cb) { setTimeout(function () { cb(user); }, 0); return function () {}; },
        signInWithEmailAndPassword: function () { return Promise.resolve({ user: user }); }, signOut: function () { return Promise.resolve(); },
        setPersistence: function () { return Promise.resolve(); }, browserLocalPersistence: {}, browserSessionPersistence: {},
        getIdTokenResult: function () { return Promise.resolve({ authTime: new Date().toISOString(), claims: {} }); },
        getDatabase: function () { return { fake: true }; },
        ref: function (d, p) { return { path: p === undefined ? '' : String(p) }; },
        onValue: function (r, cb) { const l = { path: r.path, cb: cb }; listeners.push(l); setTimeout(function () { cb(snapOf(r.path)); }, 0); return function () { const i = listeners.indexOf(l); if (i !== -1) listeners.splice(i, 1); }; },
        off: function () {}, get: function (r) { return Promise.resolve(snapOf(r.path)); },
        set: function (r, v) { const e = validate(r.path, v); if (e) { window.__rejected.push({ path: r.path, why: e }); return Promise.reject(new Error('permission_denied')); } setPath(r.path, v); fireAll(); return Promise.resolve(); },
        update: function (r, obj) {
            const keys = Object.keys(obj);
            for (let i = 0; i < keys.length; i++) { const full = (r.path ? r.path + '/' : '') + keys[i]; const e = validate(full, obj[keys[i]]); if (e) { window.__rejected.push({ path: full, why: e }); return Promise.reject(new Error('permission_denied')); } }
            keys.forEach(function (k) { setPath((r.path ? r.path + '/' : '') + k, obj[k]); }); fireAll(); return Promise.resolve();
        },
        goOnline: function () {}, goOffline: function () {}, increment: function (a) { return { __fakeIncrement: Number(a) }; },
        runTransaction: function (r, fn) {
            const cur = getPath(r.path);
            const next = fn(cur === null ? null : JSON.parse(JSON.stringify(cur)));
            if (next === undefined) return Promise.resolve({ committed: false, snapshot: snapOf(r.path) });
            const e = validate(r.path, next);
            if (e) { window.__rejected.push({ path: r.path, why: e }); return Promise.reject(new Error('permission_denied')); }
            setPath(r.path, next); fireAll();
            return Promise.resolve({ committed: true, snapshot: snapOf(r.path) });
        }
    };
    window.dispatchEvent(new Event('firebasesdkready'));
};

// ⛔ លេខចៃដន្យត្រូវ **កំណត់បាន** (seed) ➜ ការធ្លាក់អាចធ្វើឡើងវិញបាន។
function rng(seed) {
    let s = (seed >>> 0) || 1;
    return function () { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

function buildSeed(rand) {
    const d = zoneDateKey(Date.now(), 0);
    const now = Date.now();
    const hist = {};
    let ledgerCod = 0, ledgerDod = 0, ledgerCount = 0;
    const pkgCount = 2 + Math.floor(rand() * 3);
    for (let i = 0; i < pkgCount; i++) {
        const bcCount = 1 + Math.floor(rand() * 3);
        const barcodes = [];
        for (let j = 0; j < bcCount; j++) {
            const cod = Math.round((rand() * 40 + 0.07) * 100) / 100;
            const dod = Math.round((rand() * 6 + 0.03) * 100) / 100;
            barcodes.push({ code: 'F' + i + 'X' + j, time: '09:0' + j, cod: cod, dod: dod, locker: 'N/A',
                isClosed: false, isDeducted: false, isFromDeletion: false, createdAt: now - 1000 * (j + 1) });
            ledgerCod = Math.round((ledgerCod + cod) * 100) / 100;
            ledgerDod = Math.round((ledgerDod + dod) * 100) / 100;
            ledgerCount++;
        }
        const cod = Math.round(barcodes.reduce((a, b) => a + b.cod, 0) * 100) / 100;
        const dod = Math.round(barcodes.reduce((a, b) => a + b.dod, 0) * 100) / 100;
        hist['fz_' + i] = { id: 'fz_' + i, phone: '09600000' + i, scanDate: d, createdAt: now - 5000,
            cod: cod, dod: dod, price: Math.round((cod + dod) * 100) / 100, count: barcodes.length,
            barcode: barcodes[0].code, time: '09:00', isClosed: false, barcodes: barcodes };
    }
    return {
        seed: {
            user_roles: { 'admin-uid': 'admin' },
            zoew_scan_history_cod_dod: hist,
            zoew_recently_deleted_cod_dod: {},
            zoew_daily_revenue_cod_dod: { [d]: { codDollar: ledgerCod, dodDollar: ledgerDod, totalCount: ledgerCount } },
            zoew_monthly_revenue_cod_dod: { [d.substring(0, 7)]: { codDollar: ledgerCod, dodDollar: ledgerDod, totalCount: ledgerCount } },
            zoew_daily_pickup_cod_dod: {}, zoew_daily_collected_cod_dod: {}, zoew_barcode_registry: {},
            zoew_settings: { exchange_rate: 4100 }
        },
        day: d
    };
}

const READ_STATE = () => {
    const s = window.__fakeStore;
    const col = s.zoew_daily_collected_cod_dod || {};
    const hist = s.zoew_scan_history_cod_dod || {};
    const trash = s.zoew_recently_deleted_cod_dod || {};
    const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
    // អយស្ករឯករាជ្យ ៖ Σ barcode `isClosed && !isDeducted` គ្រប់កន្លែង
    let expected = 0;
    const closedKeys = {};
    const deductedKeys = {};
    [hist, trash].forEach((map) => {
        Object.keys(map).forEach((id) => {
            const item = map[id];
            const list = (item && Array.isArray(item.barcodes)) ? item.barcodes : [];
            list.forEach((b) => {
                if (!b || !b.code) return;
                if (b.isDeducted) { deductedKeys[b.code] = true; return; }
                if (!b.isClosed) return;
                closedKeys[b.code] = round2(round2(b.cod) + round2(b.dod));
                expected = round2(expected + round2(b.cod) + round2(b.dod));
            });
        });
    });
    let mirrorTotal = 0;
    const mirrorDaysOfKey = {};
    const mirrorValue = {};
    Object.keys(col).forEach((day) => {
        const rec = col[day] || {};
        Object.keys(rec).forEach((key) => {
            const v = rec[key] || {};
            mirrorTotal = round2(mirrorTotal + round2(v.c) + round2(v.d));
            (mirrorDaysOfKey[key] = mirrorDaysOfKey[key] || []).push(day);
            mirrorValue[key] = round2(round2(v.c) + round2(v.d));
        });
    });
    return {
        expected: expected, mirrorTotal: mirrorTotal, mirror: col,
        closedKeys: closedKeys, deductedKeys: deductedKeys,
        mirrorDaysOfKey: mirrorDaysOfKey, mirrorValue: mirrorValue,
        histIds: Object.keys(hist), trashIds: Object.keys(trash),
        trashReasons: Object.keys(trash).map((k) => trash[k].trashReason),
        rejected: window.__rejected.slice()
    };
};

async function runOne(page, runIndex, day) {
    const rand = rng(1000 + runIndex * 7919);
    const trace = [];
    for (let step = 0; step < OPS; step++) {
        const snap = await page.evaluate(() => {
            const s = window.__fakeStore;
            const hist = s.zoew_scan_history_cod_dod || {};
            const trash = s.zoew_recently_deleted_cod_dod || {};
            const open = [], closed = [];
            Object.keys(hist).forEach((id) => {
                (hist[id].barcodes || []).forEach((b) => { if (b && b.code) (b.isClosed ? closed : open).push([id, b.code]); });
            });
            return { open: open, closed: closed, hist: Object.keys(hist), trash: Object.keys(trash) };
        });
        const choices = [];
        if (snap.open.length) choices.push('close', 'remove');
        if (snap.closed.length) choices.push('open', 'removeClosed', 'priceClosed');
        if (snap.open.length || snap.closed.length) choices.push('price');
        if (snap.hist.length) choices.push('delete');
        if (snap.trash.length) choices.push('restore');
        if (!choices.length) break;
        const op = choices[Math.floor(rand() * choices.length)];
        try {
            if (op === 'close' || op === 'remove') {
                const pick = snap.open[Math.floor(rand() * snap.open.length)];
                if (op === 'close') {
                    trace.push('close ' + pick[1]);
                    await page.evaluate((p) => window.applyBarcodeCloseChange(p[0], p[1], true, { silent: true, showModal: false }), pick);
                } else {
                    trace.push('remove ' + pick[1]);
                    await page.evaluate((p) => window.removeSingleBarcode(p[0], p[1]), pick);
                }
            } else if (op === 'price' || op === 'priceClosed') {
                // ⛔ ការកែទឹកប្រាក់ឆ្លងកាត់ **ប្រអប់ពិត** (DOM) មិនមែន helper ដាច់ដោយឡែក
                const pool = op === 'priceClosed' ? snap.closed : snap.open.concat(snap.closed);
                const pick = pool[Math.floor(rand() * pool.length)];
                const nc = Math.round((rand() * 30 + 0.11) * 100) / 100;
                const nd = Math.round((rand() * 4 + 0.09) * 100) / 100;
                trace.push('price ' + pick[1] + '=' + nc + '/' + nd);
                await page.evaluate((a) => {
                    window.openEditBarcodePriceModal(a[0], a[1]);
                    document.getElementById('editBcCodInput').value = String(a[2]);
                    document.getElementById('editBcDodInput').value = String(a[3]);
                    return window.saveEditedBarcodePrice();
                }, [pick[0], pick[1], nc, nd]);
            } else if (op === 'open' || op === 'removeClosed') {
                const pick = snap.closed[Math.floor(rand() * snap.closed.length)];
                if (op === 'open') {
                    trace.push('open ' + pick[1]);
                    await page.evaluate((p) => window.applyBarcodeCloseChange(p[0], p[1], false, { silent: true, showModal: false }), pick);
                } else {
                    trace.push('removeClosed ' + pick[1]);
                    await page.evaluate((p) => window.removeSingleBarcode(p[0], p[1]), pick);
                }
            } else if (op === 'delete') {
                const id = snap.hist[Math.floor(rand() * snap.hist.length)];
                trace.push('delete ' + id);
                await page.evaluate((i) => window.deleteSingleItem(i), id);
            } else if (op === 'restore') {
                const id = snap.trash[Math.floor(rand() * snap.trash.length)];
                trace.push('restore ' + id);
                await page.evaluate((i) => window.promptRestoreDeletedItem(i), id);
                await page.waitForTimeout(120);
                await page.evaluate(() => window.executeRestoreItem());
            }
        } catch (e) { trace.push('THREW:' + String(e && e.message).slice(0, 80)); }
        await page.waitForTimeout(op === 'restore' ? 1400 : 700);
    }
    const st = await page.evaluate(READ_STATE);
    const tag = 'run=' + runIndex + ' ops=[' + trace.join(' ➜ ') + ']';
    ok('[' + tag + '] Σ កញ្ចក់ = Σ barcode `isClosed && !isDeducted`',
        Math.abs(st.mirrorTotal - st.expected) < 0.005,
        'កញ្ចក់=' + st.mirrorTotal + ' រំពឹង=' + st.expected + '\n        mirror=' + JSON.stringify(st.mirror));
    const dupKeys = Object.keys(st.mirrorDaysOfKey).filter((k) => st.mirrorDaysOfKey[k].length > 1);
    ok('[' + tag + '] គ្មានកូនសោឈរលើ ២ ថ្ងៃ', dupKeys.length === 0, JSON.stringify(dupKeys.map((k) => k + '@' + st.mirrorDaysOfKey[k].join(','))));
    const missing = Object.keys(st.closedKeys).filter((k) => !(k in st.mirrorValue));
    ok('[' + tag + '] រាល់ barcode បិទ (មិនដក) មានធាតុកញ្ចក់', missing.length === 0, JSON.stringify(missing));
    const ghosts = Object.keys(st.mirrorValue).filter((k) => !(k in st.closedKeys));
    ok('[' + tag + '] គ្មានធាតុកញ្ចក់កំព្រា (barcode បើកវិញ ឬដករួច)', ghosts.length === 0, JSON.stringify(ghosts));
    const wrongValue = Object.keys(st.closedKeys).filter((k) => (k in st.mirrorValue) && Math.abs(st.mirrorValue[k] - st.closedKeys[k]) >= 0.005);
    ok('[' + tag + '] តម្លៃកញ្ចក់ត្រូវនឹងតម្លៃ barcode ពិត', wrongValue.length === 0,
        JSON.stringify(wrongValue.map((k) => k + ': កញ្ចក់=' + st.mirrorValue[k] + ' ពិត=' + st.closedKeys[k])));
    ok('[' + tag + '] គ្មានការបដិសេធពី rules', st.rejected.length === 0, JSON.stringify(st.rejected.slice(0, 3)));
    return st;
}

async function main() {
    console.log('=== collected-mirror-fuzz — កញ្ចក់ «ចំណូលប្រចាំថ្ងៃ» លើលំដាប់ចៃដន្យ ===');
    const browser = await chromium.launch({ executablePath: CHROME });
    const server = await serve(path.join(ROOT, 'ZoeW'));
    const port = server.address().port;
    let bootedOnce = false;
    try {
        for (let run = RUN0; run < RUN0 + RUNS; run++) {
            const rand = rng(500 + run * 104729);
            const built = buildSeed(rand);
            const ctx = await browser.newContext({ viewport: { width: 412, height: 780 } });
            const page = await ctx.newPage();
            const errors = [];
            page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
            page.on('dialog', (d) => d.accept());
            await page.addInitScript('window.addEventListener("unhandledrejection",function(ev){var m;try{m=String((ev.reason&&(ev.reason.message||ev.reason))||"?");}catch(x){m="?";}window.__unhandled=(window.__unhandled||[]);window.__unhandled.push(m);});');
            await page.route('**', (route) => {
                const u = route.request().url();
                if (u.indexOf('/license-verify.js') !== -1) return route.fulfill({ status: 200, contentType: 'application/javascript', body: LICENSE_STUB });
                if (u.indexOf('http://127.0.0.1:' + port) === 0) return route.continue();
                return route.abort();
            });
            await page.addInitScript('window.localStorage.setItem("zoew_firebase_config", ' + JSON.stringify(JSON.stringify({ apiKey: 'k', databaseURL: 'https://fake-default-rtdb.firebaseio.com', projectId: 'p' })) + ');');
            await page.addInitScript('(' + FAKE_SDK.toString() + ')(' + JSON.stringify(built.seed) + ');');
            await page.goto('http://127.0.0.1:' + port + '/', { waitUntil: 'domcontentloaded', timeout: 20000 });
            await page.waitForTimeout(2200);
            const booted = await page.evaluate(() => ({ rows: document.querySelectorAll('#historyTableBody tr').length, fn: typeof window.applyBarcodeCloseChange }));
            if (run === RUN0) {
                ok('⛔ ជាន់អប្បបរមា៖ App boot ហើយតារាងបង្ហាញជួរ', booted.rows >= 1 && booted.fn === 'function', JSON.stringify(booted));
            }
            if (booted.rows >= 1 && booted.fn === 'function') {
                bootedOnce = true;
                await runOne(page, run, built.day);
                const unh = await page.evaluate(() => window.__unhandled || []);
                ok('[run=' + run + '] គ្មានការបដិសេធ promise ដែលគ្មានអ្នកចាប់', unh.length === 0, JSON.stringify(unh.slice(0, 3)));
            }
            await ctx.close().catch(() => {});
            if (!bootedOnce) break;
        }
        if (!bootedOnce) ok('⛔ ជាន់អប្បបរមា៖ App boot យ៉ាងតិចម្តង', false, 'App មិន boot សោះ');
    } finally {
        await browser.close().catch(() => {});
        server.close();
    }
}

main().then(() => {
    failSamples.forEach((s) => console.log('  FAIL  ' + s));
    console.log('');
    if (fail) { console.log('❌ ធ្លាក់ ' + fail + ' / ok ' + pass); process.exitCode = 1; return; }
    if (!pass) { console.log('❌ គ្មានការអះអាងណារត់សោះ'); process.exitCode = 1; return; }
    console.log('✅ ជោគជ័យ ' + pass);
    process.exitCode = 0;
}, (e) => {
    console.error('❌ កំហុសក្នុង checker ៖ ' + (e && e.stack || e));
    console.log('❌ ធ្លាក់ ' + (fail + 1) + ' / ok ' + pass);
    process.exitCode = 1;
});
