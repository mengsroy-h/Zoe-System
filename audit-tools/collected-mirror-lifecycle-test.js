// ⛔ ថ្នាក់កំហុស ៖ **កញ្ចក់ «ចំណូលប្រចាំថ្ងៃ» ឃ្លាតពី ledger ពេលកញ្ចប់ចេញពីប្រព័ន្ធ**។
//
// `zoew_daily_collected_cod_dod` ជា **កញ្ចក់បង្ហាញ** នៃលុយដែលយករួច តាម
// **ថ្ងៃបិទ**។ វាមានអ្នកសរសេរ ៣ ៖ ការបិទ/បើក barcode · ការបិទ/បើកកញ្ចប់
// ទាំងមូល · ការកែទឹកប្រាក់។ ⛔ **ផ្លូវ «ដក» (`removeSingleBarcode`) និងផ្លូវ
// «ស្តារ» (`executeRestoreItem`) ប៉ះ *ledger* តែមិនប៉ះកញ្ចក់** ➜ អេក្រង់ ២
// និយាយផ្ទុយគ្នាលើទិន្នន័យតែមួយ។
//
// 🔴 វាស់បាន (2026-09-15, tree ដែល checker ១៧១ បៃតងទាំងអស់ · SKIP 0) ៖
//     barcode B1 (COD $10 · DOD $2) ➜ បិទ «យក» ➜ កញ្ចក់[ថ្ងៃ][B1] = {c:10,d:2}
//     ➜ **ដក** B1 ➜ ledger ចុះមក $27/$4 (ត្រឹមត្រូវ តាមជួរ ៤)
//     ➜ តែកញ្ចក់ **នៅតែផ្ទុក** {c:10,d:2}
//     ➜ 💵 «ចំណូលប្រចាំថ្ងៃ» រាយ **១ កញ្ចប់ · $12.00** ខណៈ 📅 ស្ថិតិប្រចាំថ្ងៃ
//        គណនា `collectedValueOf(ledger, open)` ហើយរាយ **$0.00**។
// ហើយទិសបញ្ច្រាស ៖ ការស្តារបូក ledger ត្រឡប់ តែមិនសាងកញ្ចក់ឡើងវិញ ➜ លេខ
// **តូចជាងការពិត** ជារៀងរហូតរហូតដល់ការសម្អាត ៧ ថ្ងៃ។
//
// ⛔ ច្បាប់ដែលឯកសារនេះចាក់សោ ៖
//   (១) «ដក» កញ្ចប់ដែល **យករួច** ➜ ledger ចុះ **និង** កញ្ចក់ត្រូវលុប។
//   (២) «ស្តារ» ➜ ledger ឡើង **និង** កញ្ចក់ត្រូវសាងឡើងវិញ **តែមួយ** លើ
//       ថ្ងៃនៃ `closedAt` **ថ្មី** (ជួរ ៩ ៖ «reset ជា ឥឡូវ»)។
//   (៣) ⛔ **ទិសផ្ទុយ** ៖ «លុប» (ជួរ ៥) **មិនប៉ះ ledger** ➜ វាក៏ **មិនត្រូវ
//       ប៉ះកញ្ចក់** ដែរ។ បើគ្មានការអះអាងនេះ ការកែ «លុបកញ្ចក់រាល់ផ្លូវចេញ»
//       នឹងបៃតង ខណៈវាលុបចំណូលពិតរបស់អតិថិជនដែលយករួច។
//
// ⛔ តេស្តនេះរត់ **App ពិតក្នុង Chromium** ជាមួយ fake RTDB ដែល **អនុវត្ត rules
// ពិត** (លេខអវិជ្ជមាន ➜ បដិសេធ) — មិនមែនអះអាងលើឈ្មោះ function ទេ។
process.exitCode = 1;

let chromium;
try { chromium = require('playwright-core').chromium; } catch (e) { console.log('SKIP — ត្រូវការ playwright-core (npm i playwright-core)'); process.exitCode = 0; process.exit(0); }
const fs = require('fs');
const http = require('http');
const path = require('path');
const CHROME = process.env.COLLECTEDMIRROR_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
if (!fs.existsSync(CHROME)) { console.log('SKIP — រកមិនឃើញ Chromium នៅ ' + CHROME); process.exitCode = 0; process.exit(0); }
const ROOT = process.env.COLLECTEDMIRROR_APP_DIR || path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm' };
const APP_ZONE = 'Asia/Phnom_Penh';

let pass = 0, fail = 0;
function ok(label, cond, detail) {
    if (cond) { pass++; console.log('  ok    ' + label); }
    else { fail++; console.log('  FAIL  ' + label + (detail !== undefined ? '\n        ' + String(detail).slice(0, 400) : '')); }
}

// ⛔ ថ្ងៃដែល seed ត្រូវគណនាតាមប្រតិទិន **កម្ពុជា** ដូច App — បើប្រើប្រតិទិន
// ឧបករណ៍ នោះក្នុងបង្អួច ១៧:００–២３:៥៩ UTC runner នៅថ្ងៃមុន ខណៈ App នៅថ្ងៃក្រោយ។
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

// ⛔ fake SDK នេះ **បដិសេធតាម rules ពិត** ៖ stub ដែលទទួលយកគ្រប់ការសរសេរ
// ធ្វើឲ្យ «server បដិសេធ» ក្លាយជារបៀបបរាជ័យដែលមិនដែលសាក។
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

function seedData() {
    const d = zoneDateKey(Date.now(), 0);
    const dOld = zoneDateKey(Date.now(), -3);
    const now = Date.now();
    return {
        user_roles: { 'admin-uid': 'admin' },
        zoew_scan_history_cod_dod: {
            id_a: { id: 'id_a', phone: '0968490421', scanDate: d, createdAt: now - 1000, cod: 30, dod: 5, price: 35, count: 2, barcode: 'B2', time: '10:00', isClosed: false,
                barcodes: [
                    { code: 'B1', time: '09:00', cod: 10, dod: 2, locker: 'A1', isClosed: false, isDeducted: false, isFromDeletion: false, createdAt: now - 2000 },
                    { code: 'B2', time: '10:00', cod: 20, dod: 3, locker: 'A2', isClosed: false, isDeducted: false, isFromDeletion: false, createdAt: now - 1000 }
                ] },
            id_b: { id: 'id_b', phone: '0777123456', scanDate: d, createdAt: now - 500, cod: 7, dod: 1, price: 8, count: 1, barcode: 'C1', time: '11:00', isClosed: false,
                barcodes: [{ code: 'C1', time: '11:00', cod: 7, dod: 1, locker: 'B1', isClosed: false, isDeducted: false, isFromDeletion: false, createdAt: now - 500 }] }
        },
        // ⛔ សេណារីយ៉ូ «ថ្ងៃចាស់» ៖ កញ្ចប់ដែលបានដក **ពី ៣ ថ្ងៃមុន** ខណៈកញ្ចក់
        // នៅឈរលើថ្ងៃចាស់នោះ។ ការស្តារ reset `closedAt` ទៅ «ឥឡូវ» ➜ បើកញ្ចក់
        // មិនត្រូវតម្រឹម នោះលុយឡើងលើ **ថ្ងៃខុស** ជារៀងរហូត។
        zoew_recently_deleted_cod_dod: {
            t_old: { id: 't_old', phone: '0999888777', scanDate: dOld, createdAt: now - 3 * 86400000, cod: 4, dod: 1, price: 5, count: 1, barcode: 'D1', time: '08:00', isClosed: true, closedAt: now - 3 * 86400000,
                trashReason: 'remove', isFromDeletion: false, deletedAt: now - 60000,
                barcodes: [{ code: 'D1', time: '08:00', cod: 4, dod: 1, locker: 'N/A', isClosed: true, closedAt: now - 3 * 86400000, isDeducted: true, isFromDeletion: false, createdAt: now - 3 * 86400000 }] }
        },
        zoew_daily_revenue_cod_dod: { [d]: { codDollar: 37, dodDollar: 6, totalCount: 3 } },
        zoew_monthly_revenue_cod_dod: { [d.substring(0, 7)]: { codDollar: 37, dodDollar: 6, totalCount: 3 } },
        zoew_daily_pickup_cod_dod: {}, zoew_daily_collected_cod_dod: { [dOld]: { D1: { c: 4, d: 1 } } }, zoew_barcode_registry: {},
        zoew_settings: { exchange_rate: 4100 }
    };
}

// ⛔ **checker ត្រូវ «អាចធ្លាក់បាន *ក្នុងពេលកំណត់*»** ៖ ការព្យួរ ≠ ការធ្លាក់។
// Chromium ដែលមិនត្រូវបានបិទ **រក្សា event loop របស់ node ឲ្យរស់ជារៀងរហូត**
// ➜ ផ្លូវកំហុសណាមួយ (ឧ. `page.goto()` ធ្លាក់លើថតទទេ) ក្លាយជាការព្យួរ ជំនួស
// ការធ្លាក់ដែលមានឈ្មោះ ➜ `run-all.sh` រាយ «ព្យួរ» ហើយ GitHub cancel job។
// ដូច្នេះ browser និង server ត្រូវបិទក្នុង `finally` **ជានិច្ច**។
async function main() {
    console.log('=== collected-mirror-lifecycle — កញ្ចក់ «ចំណូលប្រចាំថ្ងៃ» ត្រូវដើរតាម ledger ===');
    const browser = await chromium.launch({ executablePath: CHROME });
    const server = await serve(path.join(ROOT, 'ZoeW'));
    const port = server.address().port;
    try {
    const ctx = await browser.newContext({ viewport: { width: 412, height: 780 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('dialog', (d) => d.accept());
    await page.addInitScript('window.addEventListener("unhandledrejection",function(ev){var m;try{m=String((ev.reason&&(ev.reason.message||ev.reason))||"?");}catch(x){m="?";}setTimeout(function(){throw new Error("unhandledrejection: "+m);},0);});');
    await page.route('**', (route) => {
        const u = route.request().url();
        if (u.indexOf('/license-verify.js') !== -1) return route.fulfill({ status: 200, contentType: 'application/javascript', body: LICENSE_STUB });
        if (u.indexOf('http://127.0.0.1:' + port) === 0) return route.continue();
        return route.abort();
    });
    const seed = seedData();
    const d = zoneDateKey(Date.now(), 0);
    await page.addInitScript('window.localStorage.setItem("zoew_firebase_config", ' + JSON.stringify(JSON.stringify({ apiKey: 'k', databaseURL: 'https://fake-default-rtdb.firebaseio.com', projectId: 'p' })) + ');');
    await page.addInitScript('(' + FAKE_SDK.toString() + ')(' + JSON.stringify(seed) + ');');
    await page.goto('http://127.0.0.1:' + port + '/', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(2500);

    const read = () => page.evaluate((dk) => {
        const s = window.__fakeStore;
        const col = s.zoew_daily_collected_cod_dod || {};
        let mirrorKeys = 0;
        const perDay = {};
        Object.keys(col).forEach((day) => { const n = Object.keys(col[day] || {}).length; perDay[day] = Object.keys(col[day] || {}); mirrorKeys += n; });
        return {
            led: s.zoew_daily_revenue_cod_dod[dk] || { codDollar: 0, dodDollar: 0, totalCount: 0 },
            mon: s.zoew_monthly_revenue_cod_dod[dk.substring(0, 7)] || { codDollar: 0, dodDollar: 0, totalCount: 0 },
            mirrorKeys: mirrorKeys, perDay: perDay, collected: col,
            trash: s.zoew_recently_deleted_cod_dod, hist: s.zoew_scan_history_cod_dod,
            rejected: window.__rejected.slice()
        };
    }, d);

    // ⛔ ជាន់អប្បបរមា ៖ បើ App មិន boot នោះរាល់ការអះអាង «គ្មានកញ្ចក់» ពិតដោយស្វ័យប្រវត្តិ។
    const booted = await page.evaluate(() => ({ rows: document.querySelectorAll('#historyTableBody tr').length, threw: window.__listenerThrew || null }));
    ok('⛔ ជាន់អប្បបរមា៖ App boot ហើយតារាងបង្ហាញជួរ', booted.rows >= 2, 'rows=' + booted.rows + ' threw=' + booted.threw);
    // ⛔ បើ App មិន boot (ឧ. `*_APP_DIR` ទទេ) នោះការអះអាងខាងក្រោមទាំងអស់
    // វាស់ **អ្វីផ្សេង** ➜ ចេញភ្លាមជាមួយការធ្លាក់ដែលមានឈ្មោះ។ វាក៏រក្សា
    // `checker-coverage.js` ឲ្យរហ័សដែរ (វារត់ checker គ្រប់ឯកសារលើថតទទេ)។
    if (booted.rows < 2) return;

    // (១) បិទ «យក» ➜ កញ្ចក់ត្រូវទទួលធាតុ ១
    await page.evaluate(() => window.applyBarcodeCloseChange('id_a', 'B1', true, { silent: true, showModal: false }));
    await page.waitForTimeout(700);
    const afterClose = await read();
    ok('បិទ «យក» ➜ ledger មិនប៉ះ (ជួរ ១)', afterClose.led.codDollar === 37 && afterClose.led.dodDollar === 6, JSON.stringify(afterClose.led));
    ok('បិទ «យក» ➜ កញ្ចក់ទទួលធាតុថ្មី ១ ពិត (បូកធាតុ D1 ដែល seed ទុក)', afterClose.mirrorKeys === 2, JSON.stringify(afterClose.perDay));

    // (២) ដក barcode ដែលយករួច ➜ ledger ចុះ **និង** កញ្ចក់ត្រូវលុប
    await page.evaluate(() => window.removeSingleBarcode('id_a', 'B1'));
    await page.waitForTimeout(1500);
    const afterRemove = await read();
    ok('ដក ➜ ledger ចុះ $10/$2 (ជួរ ៤)', afterRemove.led.codDollar === 27 && afterRemove.led.dodDollar === 4, JSON.stringify(afterRemove.led));
    ok('⛔ ដក ➜ កញ្ចក់ «ចំណូលប្រចាំថ្ងៃ» ត្រូវលុបធាតុនោះដែរ',
        afterRemove.mirrorKeys === 1 && !(afterRemove.collected[d] && afterRemove.collected[d].B1),
        'កញ្ចក់=' + JSON.stringify(afterRemove.collected) + ' ledger=' + JSON.stringify(afterRemove.led));
    ok('ដក ➜ គ្មានការបដិសេធពី rules', afterRemove.rejected.length === 0, JSON.stringify(afterRemove.rejected));

    // (៣) ស្តារ ➜ ledger ឡើង **និង** កញ្ចក់ត្រូវសាងឡើងវិញ តែមួយ លើថ្ងៃថ្មី
    const removedId = Object.keys(afterRemove.trash).filter((k) => afterRemove.trash[k].trashReason === 'remove'
        && (afterRemove.trash[k].barcodes || []).some((b) => b && b.code === 'B1'))[0];
    ok('⛔ ជាន់អប្បបរមា៖ រកធាតុ trashReason=remove ឃើញ', !!removedId, JSON.stringify(Object.keys(afterRemove.trash).map((k) => afterRemove.trash[k].trashReason)));
    if (removedId) {
        await page.evaluate((id) => window.promptRestoreDeletedItem(id), removedId);
        await page.waitForTimeout(250);
        await page.evaluate(() => window.executeRestoreItem());
        await page.waitForTimeout(2200);
        const afterRestore = await read();
        ok('ស្តារ ➜ ledger បូកត្រឡប់ **តែម្តង** (ជួរ ៩)', afterRestore.led.codDollar === 37 && afterRestore.led.dodDollar === 6, JSON.stringify(afterRestore.led));
        ok('ស្តារ ➜ ខែស្មើថ្ងៃ', afterRestore.mon.codDollar === afterRestore.led.codDollar && afterRestore.mon.dodDollar === afterRestore.led.dodDollar, 'ថ្ងៃ=' + JSON.stringify(afterRestore.led) + ' ខែ=' + JSON.stringify(afterRestore.mon));
        ok('⛔ ស្តារ ➜ កញ្ចក់ត្រូវសាងឡើងវិញ **តែមួយ** សម្រាប់ B1',
            afterRestore.mirrorKeys === 2, JSON.stringify(afterRestore.collected));
        const dayOfMirror = Object.keys(afterRestore.perDay).filter((day) => afterRestore.perDay[day].indexOf('B1') !== -1)[0];
        ok('⛔ ស្តារ ➜ កញ្ចក់ឈរលើថ្ងៃនៃ `closedAt` **ថ្មី** មិនមែនថ្ងៃចាស់',
            dayOfMirror === d, 'ថ្ងៃកញ្ចក់=' + dayOfMirror + ' ថ្ងៃថ្មី=' + d);
        const restoredValue = dayOfMirror ? afterRestore.collected[dayOfMirror].B1 : null;
        ok('ស្តារ ➜ តម្លៃកញ្ចក់ត្រូវនឹង barcode ពិត ($10/$2)',
            !!restoredValue && restoredValue.c === 10 && restoredValue.d === 2, JSON.stringify(restoredValue));
    }

    // (៤) ⛔ ទិសផ្ទុយ ៖ «លុប» មិនប៉ះ ledger ➜ វាក៏មិនត្រូវប៉ះកញ្ចក់ដែរ
    await page.evaluate(() => window.applyBarcodeCloseChange('id_b', 'C1', true, { silent: true, showModal: false }));
    await page.waitForTimeout(700);
    const beforeDelete = await read();
    ok('⛔ ជាន់អប្បបរមា៖ បិទ C1 ➜ កញ្ចក់មាន ៣ ធាតុ', beforeDelete.mirrorKeys === 3, JSON.stringify(beforeDelete.collected));
    await page.evaluate(() => window.deleteSingleItem('id_b'));
    await page.waitForTimeout(1500);
    const afterDelete = await read();
    ok('លុប ➜ ledger មិនប៉ះ (ជួរ ៥)', afterDelete.led.codDollar === beforeDelete.led.codDollar && afterDelete.led.dodDollar === beforeDelete.led.dodDollar, 'មុន=' + JSON.stringify(beforeDelete.led) + ' ក្រោយ=' + JSON.stringify(afterDelete.led));
    ok('⛔ ទិសផ្ទុយ៖ លុប ➜ កញ្ចក់ **មិនត្រូវ** លុប (លុយនៅក្នុង ledger ដដែល)',
        afterDelete.mirrorKeys === 3, JSON.stringify(afterDelete.collected));

    // (៥) ⛔ ស្តារធាតុដែលកញ្ចក់ឈរលើ **ថ្ងៃចាស់** ➜ ត្រូវផ្លាស់មកថ្ងៃថ្មី
    // នេះជាពាក់កណ្តាលទី ២ នៃការកែ ៖ បើគ្មានការតម្រឹម ការស្តារនឹងបន្សល់លុយ
    // លើថ្ងៃដែល `closedAt` លែងចង្អុលទៅទៀតហើយ ➜ 💵 «ចំណូលប្រចាំថ្ងៃ» ចុះលើ
    // ថ្ងៃខុសជារៀងរហូត។
    const dOld = zoneDateKey(Date.now(), -3);
    await page.evaluate((id) => window.promptRestoreDeletedItem(id), 't_old');
    await page.waitForTimeout(250);
    await page.evaluate(() => window.executeRestoreItem());
    await page.waitForTimeout(2200);
    const afterOldRestore = await read();
    ok('⛔ ជាន់អប្បបរមា៖ D1 ត្រឡប់ចូលប្រវត្តិវិញ',
        Object.keys(afterOldRestore.hist).some((k) => (afterOldRestore.hist[k].barcodes || []).some((b) => b && b.code === 'D1')),
        JSON.stringify(Object.keys(afterOldRestore.hist)));
    const oldDayKeys = (afterOldRestore.perDay[dOld] || []);
    ok('⛔ ស្តារ ➜ កញ្ចក់ថ្ងៃចាស់ត្រូវលុប D1 ចេញ', oldDayKeys.indexOf('D1') === -1,
        'ថ្ងៃចាស់=' + dOld + ' ' + JSON.stringify(afterOldRestore.collected));
    ok('⛔ ស្តារ ➜ D1 ត្រូវលេចលើថ្ងៃថ្មី ជាមួយតម្លៃដដែល ($4/$1)',
        !!(afterOldRestore.collected[d] && afterOldRestore.collected[d].D1
            && afterOldRestore.collected[d].D1.c === 4 && afterOldRestore.collected[d].D1.d === 1),
        JSON.stringify(afterOldRestore.collected));

    const unhandled = errors.filter((e) => e.indexOf('unhandledrejection') !== -1);
    ok('គ្មានការបដិសេធ promise ដែលគ្មានអ្នកចាប់', unhandled.length === 0, unhandled.slice(0, 3).join(' | '));

    } finally {
        await browser.close().catch(() => {});
        server.close();
    }
}

main().then(() => {
    console.log('');
    if (fail) { console.log('❌ ធ្លាក់ ' + fail + ' / ok ' + pass); process.exitCode = 1; return; }
    // ⛔ ការចេញដោយ `ok` សូន្យ = checker មិនបានវាស់អ្វីសោះ ➜ វាត្រូវធ្លាក់
    // (បើមិនដូច្នេះ ថតទទេនឹងធ្វើឲ្យវា «ជោគជ័យ» ដោយស្ងាត់)។
    if (!pass) { console.log('❌ គ្មានការអះអាងណារត់សោះ'); process.exitCode = 1; return; }
    console.log('✅ ជោគជ័យ ' + pass);
    process.exitCode = 0;
}, (e) => {
    console.error('❌ កំហុសក្នុង checker ៖ ' + (e && e.stack || e));
    console.log('❌ ធ្លាក់ ' + (fail + 1) + ' / ok ' + pass);
    process.exitCode = 1;
});
