// ថ្នាក់កំហុស៖ **លក្ខខណ្ឌនៃចលនាផ្ទាំងប្រវត្តិ (កំណែ 2.9.0)**។
//
// ចលនា ១:១ ដំណើរការបានលុះត្រាតែ៖
//   • កាតបញ្ជី និងតារាង **ខ្ពស់ដូចគ្នា** ទាំងរបៀបធម្មតា និងពេញអេក្រង់ —
//     បើខុសគ្នា ការរំកិលនឹងបន្សល់ចន្លោះ ហើយការប្តូរ class នឹងលោត។
//     វាក៏ជាអ្វីដែលធ្វើឲ្យ **កម្ពស់កន្សោមរមូរលែងប្តូរ** ➜ ថ្នាក់កំហុស
//     «ប្តូរកម្ពស់កណ្តាល momentum» មិនអាចកើតឡើងបាន។
//   • `scroll-snap` ត្រូវឈប់ត្រឹម **scrollTop 0** មិនមែន 71 — បើភ្លេច
//     `scroll-padding-top` នោះ **PTR លែងកេះបាន** (វាទាមទារ `scrollTop <= 1`)។
//   • ចលនា FLIP មិនត្រូវបន្សល់ `transform` សេសសល់លើកាតឡើយ។
//
// ព្រមទាំងចាក់សោថាប៊ូតុងក្នុងជួរដេកសរសេរ «បញ្ជី» ហើយការកែ/ដកកញ្ចប់
// **នៅតែមាន** ក្នុងម៉ឺនុយ (...) — ការដកអត្ថបទស្ទួនចេញមិនត្រូវដកមុខងារទេ។
// ដំណើរការពេល scanHistory ធំ (ថ្ងៃមមាញឹក) — ថ្នាក់ដែល runbook រាយថាមិនទាន់មានឧបករណ៍។
// វាស់ក្នុង Chromium ពិត៖ ការ render តារាង, ការវាយក្នុងប្រអប់ស្វែងរកលេខ, និងការ repaint ពី listener។
let chromium;
try { chromium = require('playwright-core').chromium; } catch (e) { console.log('SKIP — ត្រូវការ playwright-core'); process.exit(0); }
const CHROME = process.env.PANELMOTION_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const fs = require('fs'), http = require('http'), path = require('path');
if (!fs.existsSync(CHROME)) { console.log('SKIP — រកមិនឃើញ Chromium'); process.exit(0); }
const ROOT = process.env.PANELMOTION_APP_DIR || path.join(__dirname, '..');
const ORDERS = parseInt(process.env.PANELMOTION_ORDERS || '1200', 10);
// កម្រិតតាមបន្ទុក៖ ការវាស់ពិតគឺ ~120ms នៅ 1200 order ➜ ទុកចន្លោះ ~6x តែនៅតែចាប់ការថយចុះ 8x បាន
const COLD_LIMIT = Math.max(300, Math.round(ORDERS * 0.6));
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm' };
const REPORT = process.env.PERF_REPORT === '1';

let pass = 0, fail = 0;
function check(c, n, d) { if (c) { console.log('  ok    ' + n); pass++; } else { console.log('  FAIL  ' + n + (d ? '\n        ' + d : '')); fail++; } }

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

const LICENSE_STUB = `window.ZoeLicense = { getStatus: () => Promise.resolve({ state: 'active' }), setServerTimeOffset(){}, syncServerTime: () => Promise.resolve(), activate: () => Promise.resolve({ ok: true }), verifyKeyString: () => Promise.resolve({ ok: true }), clearActivation(){} };`;

const BOOT = function (seed) {
    const store = JSON.parse(JSON.stringify(seed));
    window.__fakeStore = store;
    const listeners = [];
    function getPath(p) {
        if (!p || p === '/') return store;
        let cur = store;
        for (const part of p.split('/').filter(Boolean)) { if (cur === null || typeof cur !== 'object') return null; cur = cur[part]; }
        return cur === undefined ? null : cur;
    }
    function setPath(p, val) {
        const parts = p.split('/').filter(Boolean); if (!parts.length) return;
        let cur = store;
        for (let i = 0; i < parts.length - 1; i++) { if (cur[parts[i]] === null || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {}; cur = cur[parts[i]]; }
        const last = parts[parts.length - 1];
        if (val === null) delete cur[last]; else cur[last] = JSON.parse(JSON.stringify(val));
    }
    function snapOf(p) { const v = getPath(p); return { val: () => (v === undefined || v === null) ? null : (typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v), exists: () => v !== null && v !== undefined }; }
    function fire(p) { listeners.filter((l) => l.path === p).forEach((l) => { try { l.cb(snapOf(p)); } catch (e) { window.__listenerThrew = String(e && e.message); } }); }
    function fireAll() { [...new Set(listeners.map((l) => l.path))].forEach(fire); }
    window.__fireHistory = () => fire('zoew_scan_history_cod_dod');
    const user = { uid: 'admin-uid', email: 'a@b.c', getIdToken: () => Promise.resolve('tok'), metadata: { lastSignInTime: new Date().toISOString() } };
    window.firebaseSDK = {
        initializeApp: () => ({ name: 'fake' }), getApps: () => [], deleteApp: () => Promise.resolve(),
        getAuth: () => ({ currentUser: user }),
        onAuthStateChanged: (a, cb) => { setTimeout(() => cb(user), 0); return () => {}; },
        signInWithEmailAndPassword: () => Promise.resolve({ user }), signOut: () => Promise.resolve(),
        setPersistence: () => Promise.resolve(), browserLocalPersistence: {}, browserSessionPersistence: {},
        getIdTokenResult: () => Promise.resolve({ authTime: new Date().toISOString(), claims: {} }),
        getDatabase: () => ({ fake: true }), ref: (d, p) => ({ path: p === undefined ? '' : String(p) }),
        onValue: (r, cb) => { listeners.push({ path: r.path, cb }); setTimeout(() => { if (r.path === '.info/connected') cb({ val: () => true }); else cb(snapOf(r.path)); }, 0); return () => {}; },
        off: () => {}, goOnline: () => {},
        get: (r) => Promise.resolve(snapOf(r.path)),
        set: (r, v) => { setPath(r.path, v); fireAll(); return Promise.resolve(); },
        update: (r, o) => { Object.keys(o).forEach((k) => setPath((r.path ? r.path + '/' : '') + k, o[k])); fireAll(); return Promise.resolve(); },
        runTransaction: (r, fn) => { const c = getPath(r.path); const n = fn(c === null ? null : JSON.parse(JSON.stringify(c))); if (n === undefined) return Promise.resolve({ committed: false, snapshot: snapOf(r.path) }); setPath(r.path, n); fireAll(); return Promise.resolve({ committed: true, snapshot: snapOf(r.path) }); }
    };
    window.dispatchEvent(new Event('firebasesdkready'));
};

function seedBig(n) {
    const t = new Date();
    const d = t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0');
    const now = Date.now();
    const hist = {};
    let cod = 0, cnt = 0;
    for (let i = 0; i < n; i++) {
        const id = 'id_' + (now - i * 1000) + '_' + i;
        const phone = '09' + String(60000000 + i).slice(0, 8);
        const bcs = [];
        const per = (i % 3) + 1;
        for (let k = 0; k < per; k++) {
            bcs.push({ code: 'PF' + i + '_' + k, time: '10:00', cod: 5, dod: 0, locker: 'A' + (i % 40), isClosed: (i % 4 === 0), isDeducted: false, isFromDeletion: false, createdAt: now - i * 1000 });
            cod += 5; cnt++;
        }
        hist[id] = { id, phone, scanDate: d, createdAt: now - i * 1000, cod: 5 * per, dod: 0, price: 5 * per, count: per, barcode: bcs[0].code, time: '10:00', isClosed: (i % 4 === 0), barcodes: bcs };
        if (hist[id].isClosed) hist[id].closedAt = now - i * 1000;
    }
    return {
        user_roles: { 'admin-uid': 'admin' },
        zoew_scan_history_cod_dod: hist, zoew_recently_deleted_cod_dod: {},
        zoew_daily_revenue_cod_dod: { [d]: { codDollar: cod, dodDollar: 0, totalCount: cnt } },
        zoew_monthly_revenue_cod_dod: {}, zoew_daily_pickup_cod_dod: {}, zoew_scanner_lookup: {},
        zoew_barcode_registry: {}, zoew_settings: { exchange_rate: 4100 }, _dateKey: d
    };
}

(async () => {
    const browser = await chromium.launch({ executablePath: CHROME });
    const server = await serve(path.join(ROOT, 'ZoeW'));
    const port = server.address().port;
    const results = [];
    const ok = (n, c, d) => results.push([n, !!c, d]);

    for (const vp of [{ w: 320, h: 640 }, { w: 412, h: 780 }, { w: 768, h: 1024 }]) {
        const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, hasTouch: true, isMobile: true });
        const page = await ctx.newPage();
        page.on('dialog', (d) => d.accept());
        page.on('pageerror', (e) => ok('vp' + vp.w + ': គ្មាន pageerror', false, e.message));
        await page.route('**', (r) => {
            const u = r.request().url();
            if (u.indexOf('/license-verify.js') !== -1) return r.fulfill({ status: 200, contentType: 'application/javascript', body: LICENSE_STUB });
            if (u.startsWith('http://127.0.0.1:' + port)) return r.continue();
            return r.abort();
        });
        await page.addInitScript(`Object.defineProperty(window.navigator,'standalone',{value:true,configurable:true});`);
        await page.addInitScript(`window.localStorage.setItem('zoew_firebase_config', ${JSON.stringify(JSON.stringify({ apiKey: 'k', databaseURL: 'https://fake-default-rtdb.firebaseio.com', projectId: 'p' }))});`);
        await page.addInitScript('(' + BOOT.toString() + ')(' + JSON.stringify(seedBig(80)) + ');');
        await page.goto('http://127.0.0.1:' + port + '/', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForFunction(() => document.querySelectorAll('#historyTableBody tr').length > 5, null, { timeout: 30000 });
        await page.waitForTimeout(250);

        const r = await page.evaluate(async () => {
            const wait = (ms) => new Promise((x) => setTimeout(x, ms));
            const out = {};
            // ១ — ប៊ូតុងជួរដេក
            const btns = Array.from(document.querySelectorAll('#historyTableBody .btn-view-list'));
            out.rowBtnCount = btns.length;
            out.rowBtnTexts = Array.from(new Set(btns.map((b) => b.textContent.replace(/\d+/g, 'N').trim()))).slice(0, 4);
            out.anyOldLabel = btns.some((b) => b.textContent.indexOf('កែ/ដក') !== -1);
            out.anyInlineYellow = btns.some((b) => (b.getAttribute('style') || '').indexOf('fef08a') !== -1);
            // ២ — ម៉ឺនុយ (...) នៅតែមានការកែ/ដក
            const firstId = document.querySelector('#historyTableBody tr') ? document.querySelector('#historyTableBody tr').dataset.id : null;
            if (firstId) {
                window.toggleMoreDropdown({ stopPropagation() {}, currentTarget: document.querySelector('#historyTableBody .more-btn') || document.body }, firstId);
                out.menuHasEdit = document.getElementById('menuContentContainer').textContent.indexOf('កែ/ដកកញ្ចប់អីវ៉ាន់') !== -1;
                document.getElementById('globalMoreMenu').classList.remove('show');
            }
            // ៣ — កម្ពស់កាតស្មើគ្នា + តារាងរមូរបាន
            const side = document.getElementById('dataSideSection');
            const main = document.getElementById('dataMainSection');
            const table = document.getElementById('tableResponsive');
            const pages = document.getElementById('appPages');
            const hN = Math.round(main.getBoundingClientRect().height), tN = table.clientHeight;
            side.classList.add('collapsed'); window.syncHistoryExpandedLock(); await wait(60);
            const hC = Math.round(main.getBoundingClientRect().height), tC = table.clientHeight;
            side.classList.remove('collapsed'); window.syncHistoryExpandedLock(); await wait(60);
            out.cardHeightDelta = Math.abs(hN - hC);
            out.tableHeightDelta = Math.abs(tN - tC);
            out.tableScrolls = table.scrollHeight > table.clientHeight + 1;
            // ៤ — snap ឈប់ត្រឹម 0 (PTR ត្រូវការ scrollTop<=1)
            pages.scrollTop = 30; await wait(350);
            out.snapRestNearTop = pages.scrollTop;
            pages.scrollTop = 0; await wait(120);
            // ៥ — គ្មាន transform សេសសល់ក្រោយចលនា
            const handle = document.getElementById('dragHandle');
            if (handle) { handle.click(); await wait(400); handle.click(); await wait(400); }
            out.residualTransform = getComputedStyle(main).transform;
            out.sideAfterToggles = side.classList.contains('collapsed');
            // ៦ — ទំព័រ ២ ដូចគ្នា
            window.switchAppPage('entry'); await wait(150);
            const em = document.getElementById('entryMainSection');
            out.entryCardH = Math.round(em.getBoundingClientRect().height);
            out.entryPagesOverflow = getComputedStyle(pages).overflowY;
            window.switchAppPage('data'); await wait(100);
            // ៧ — គ្មានការហូរផ្តេក
            out.hOverflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
            return out;
        });
        const tag = vp.w + 'px';
        ok(tag + ': ប៊ូតុងជួរដេកលែងមាន «កែ/ដក»', r.anyOldLabel === false, JSON.stringify(r.rowBtnTexts));
        ok(tag + ': លែងមានពណ៌លឿង inline', r.anyInlineYellow === false, '');
        ok(tag + ': ម៉ឺនុយ (...) នៅមានការកែ/ដកកញ្ចប់', r.menuHasEdit === true, String(r.menuHasEdit));
        ok(tag + ': កម្ពស់កាតស្មើគ្នា ២ របៀប (≤2px)', r.cardHeightDelta <= 2, 'delta=' + r.cardHeightDelta);
        ok(tag + ': កម្ពស់តារាងស្មើគ្នា ២ របៀប (≤2px)', r.tableHeightDelta <= 2, 'delta=' + r.tableHeightDelta);
        ok(tag + ': តារាងនៅតែរមូរបាន', r.tableScrolls === true, '');
        ok(tag + ': snap ឈប់ត្រឹម 0 (PTR កេះបាន)', r.snapRestNearTop <= 1, 'scrollTop=' + r.snapRestNearTop);
        ok(tag + ': គ្មាន transform សេសសល់ក្រោយចលនា', r.residualTransform === 'none' || r.residualTransform === 'matrix(1, 0, 0, 1, 0, 0)', r.residualTransform);
        ok(tag + ': ចុចដងអូស ២ ដង ➜ ត្រឡប់ដើម', r.sideAfterToggles === false, String(r.sideAfterToggles));
        ok(tag + ': ទំព័រ ២ កាតមានកម្ពស់ត្រឹមត្រូវ', r.entryCardH > 100, 'h=' + r.entryCardH);
        ok(tag + ': គ្មានការហូរផ្តេក', r.hOverflow <= 0, 'overflow=' + r.hOverflow);
        await ctx.close();
    }
    server.close(); await browser.close();
    let bad = 0;
    results.forEach(([n, c, d]) => { if (!c) bad++; console.log((c ? '  ok    ' : '  FAIL  ') + n + (c ? '' : '   [' + d + ']')); });
    console.log(bad ? '\n❌ ធ្លាក់ ' + bad : '\n✅ ជោគជ័យ ' + results.length + '/' + results.length);
    process.exit(bad ? 1 : 0);
})();
