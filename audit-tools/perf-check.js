// ដំណើរការពេល scanHistory ធំ (ថ្ងៃមមាញឹក) — ថ្នាក់ដែល runbook រាយថាមិនទាន់មានឧបករណ៍។
// វាស់ក្នុង Chromium ពិត៖ ការ render តារាង, ការវាយក្នុងប្រអប់ស្វែងរកលេខ, និងការ repaint ពី listener។
let chromium;
try { chromium = require('playwright-core').chromium; } catch (e) { console.log('SKIP — ត្រូវការ playwright-core'); process.exit(0); }
const CHROME = process.env.PERF_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const fs = require('fs'), http = require('http'), path = require('path');
if (!fs.existsSync(CHROME)) { console.log('SKIP — រកមិនឃើញ Chromium'); process.exit(0); }
const ROOT = process.env.PERF_APP_DIR || path.join(__dirname, '..');
const ORDERS = parseInt(process.env.PERF_ORDERS || '1200', 10);
// កម្រិតតាមបន្ទុក៖ ការវាស់ពិតគឺ ~120ms នៅ 1200 order ➜ ទុកចន្លោះ ~6x តែនៅតែចាប់ការថយចុះ 8x បាន
const COLD_LIMIT = Math.max(300, Math.round(ORDERS * 0.6));
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json' };
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
    for (const app of ['ZoeAdmin', 'ZoeW']) {
        console.log('\n=== ' + app + ' (' + ORDERS + ' orders) ===');
        const server = await serve(path.join(ROOT, app));
        const port = server.address().port;
        const ctx = await browser.newContext({ viewport: { width: 412, height: 780 } });
        const page = await ctx.newPage();
        page.on('dialog', (d) => d.accept());
        await page.route('**', (r) => {
            const u = r.request().url();
            if (u.indexOf('/license-verify.js') !== -1) return r.fulfill({ status: 200, contentType: 'application/javascript', body: LICENSE_STUB });
            if (u.startsWith('http://127.0.0.1:' + port)) return r.continue();
            return r.abort();
        });
        const seed = seedBig(ORDERS);
        await page.addInitScript(`window.localStorage.setItem('zoew_firebase_config', ${JSON.stringify(JSON.stringify({ apiKey: 'k', databaseURL: 'https://fake-default-rtdb.firebaseio.com', projectId: 'p' }))});`);
        await page.addInitScript('(' + BOOT.toString() + ')(' + JSON.stringify(seed) + ');');
        const t0 = Date.now();
        await page.goto('http://127.0.0.1:' + port + '/', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForFunction(() => document.querySelectorAll('#historyTableBody tr').length > 5, null, { timeout: 30000 });
        const bootMs = Date.now() - t0;

        const m = await page.evaluate(() => {
            const t = (fn, reps) => { const s = performance.now(); for (let i = 0; i < reps; i++) fn(); return (performance.now() - s) / reps; };
            const bust = () => document.querySelectorAll('#historyTableBody tr').forEach((tr) => { delete tr.dataset.sig; });
            const renderCold = t(() => { bust(); window.applyCurrentFilter(); }, 5);
            const render = t(() => window.applyCurrentFilter(), 5);
            const listener = t(() => window.__fireHistory(), 5);
            const suggest = t(() => window.collectPhoneSuggestions('42', 12), 10);
            const recent = t(() => window.updateRecentPhonesList(), 5);
            return {
                render: Math.round(render), renderCold: Math.round(renderCold), listener: Math.round(listener),
                suggest: Math.round(suggest), recent: Math.round(recent),
                rows: document.querySelectorAll('#historyTableBody tr').length
            };
        });

        // ការវាយអក្សរពិតក្នុងប្រអប់ស្វែងរក (ផ្លូវពេញ៖ ច្រោះ + ដុំស្នើលេខ + render)
        const typeMs = await page.evaluate(() => {
            const el = document.getElementById('searchPhoneInput');
            if (!el) return -1;
            el.focus();
            const s = performance.now();
            for (const ch of ['0', '9', '6', '8', '4']) {
                el.value += ch;
                el.dispatchEvent(new Event('input', { bubbles: true }));
            }
            return Math.round((performance.now() - s) / 5);
        });

        console.log('    boot=' + bootMs + 'ms  renderCold=' + m.renderCold + 'ms  render=' + m.render + 'ms  listenerRepaint=' + m.listener +
                    'ms  suggest=' + m.suggest + 'ms  recentPhones=' + m.recent + 'ms  keystroke=' + typeMs + 'ms  rows=' + m.rows);

        if (!REPORT) {
            check(m.renderCold < COLD_LIMIT, app + ': render តារាងទាំងស្រុង (cold) < ' + COLD_LIMIT + 'ms នៅ ' + ORDERS + ' order', 'renderCold=' + m.renderCold + 'ms');
            check(m.render < 400, app + ': repaint ដែលគ្មានអ្វីប្រែ < 400ms', 'render=' + m.render + 'ms');
            check(m.listener < 600, app + ': repaint ពី Firebase listener < 600ms', 'listener=' + m.listener + 'ms');
            check(m.suggest < 120, app + ': ស្វែងរកលេខ (collectPhoneSuggestions) < 120ms', 'suggest=' + m.suggest + 'ms');
            check(typeMs < 0 || typeMs < 300, app + ': វាយអក្សរ ១ តួក្នុងប្រអប់ស្វែងរក < 300ms', 'keystroke=' + typeMs + 'ms');
        }
        await ctx.close(); server.close();
    }
    await browser.close();
    if (REPORT) { console.log('\n(របាយការណ៍តែប៉ុណ្ណោះ)'); process.exit(0); }
    console.log('\n' + (fail ? 'FAIL ' + fail + ' / ជោគជ័យ ' + pass : 'PASS ' + pass + '/' + pass));
    process.exit(fail ? 1 : 0);
})();
