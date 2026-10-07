// ដំណើរការពេល scanHistory ធំ (ថ្ងៃមមាញឹក) — ថ្នាក់ដែល runbook រាយថាមិនទាន់មានឧបករណ៍។
// វាស់ក្នុង Chromium ពិត៖ ការ render តារាង, ការវាយក្នុងប្រអប់ស្វែងរកលេខ, និងការ repaint ពី listener។
let chromium;
try { chromium = require('playwright-core').chromium; } catch (e) { console.log('SKIP — ត្រូវការ playwright-core'); process.exit(0); }
const CHROME = process.env.PERF_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const fs = require('fs'), http = require('http'), path = require('path');

// ⛔ ថ្ងៃដែល seed ត្រូវគណនាតាម **ប្រតិទិនកម្ពុជា** ដូច App (កំណែ 2.20.5)។
// មុននេះវាប្រើប្រតិទិន **ឧបករណ៍** ➜ ក្នុងបង្អួច ៧ ម៉ោងរៀងរាល់យប់
// (00:00–07:00 ម៉ោងកម្ពុជា = 17:00–23:59 UTC) runner ដែលកំណត់ជា UTC
// នៅថ្ងៃមុន ខណៈ App នៅថ្ងៃបន្ទាប់ ➜ ជួរដេកដែល seed មិនត្រូវនឹងតម្រង
// «ថ្ងៃនេះ» ➜ គ្មានជួរដេកបង្ហាញ ➜ waitForFunction timeout។
const APP_ZONE = 'Asia/Phnom_Penh';
function zoneDateKey(ms, dayOffset) {
    const p = new Intl.DateTimeFormat('en-CA', {
        timeZone: APP_ZONE, year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(ms).split('-');
    const base = Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    const s = new Date(base + (dayOffset || 0) * 86400000);
    return s.getUTCFullYear() + '-'
        + String(s.getUTCMonth() + 1).padStart(2, '0') + '-'
        + String(s.getUTCDate()).padStart(2, '0');
}

if (!fs.existsSync(CHROME)) { console.log('SKIP — រកមិនឃើញ Chromium'); process.exit(0); }
const ROOT = process.env.PERF_APP_DIR || path.join(__dirname, '..');
const ORDERS = parseInt(process.env.PERF_ORDERS || '1200', 10);
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
    const d = zoneDateKey(Date.now(), 0);
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
    // ធុងសំរាមរក្សាទុក ៣០ ថ្ងៃ ➜ វាអាចកាន់ធាតុច្រើនជាងតារាងប្រវត្តិទៅទៀត។
    // មុនជុំនេះ seed នេះជា `{}` ➜ `buildTrashGroups()` · `trashItemTotals()` និង
    // `renderRecentlyDeleted()` **មិនដែលត្រូវវាស់សោះ** — ចន្លោះដដែលនឹងមេរៀន
    // «checker ស្កេនឯកសារណាខ្លះ» តែនៅលើទិន្នន័យ seed។
    const trash = {};
    const TRASH_REASONS = ['delete', 'remove', 'pickup', 'expired'];
    for (let i = 0; i < n; i++) {
        const id = 'trash_' + (now - i * 1000) + '_' + i;
        const reason = TRASH_REASONS[i % 4];
        const per = (i % 3) + 1;
        const bcs = [];
        for (let k = 0; k < per; k++) {
            bcs.push({ code: 'TR' + i + '_' + k, time: '10:00', cod: 5, dod: 0, locker: 'A' + (i % 40),
                isClosed: reason === 'pickup', isDeducted: (reason === 'remove' || reason === 'expired'),
                isFromDeletion: (reason === 'delete' || reason === 'pickup'), createdAt: now - i * 1000 });
        }
        trash[id] = { id, phone: '09' + String(60000000 + (i % 400)).slice(0, 8), scanDate: d,
            createdAt: now - i * 1000, deletedAt: now - i * 1000, cod: 5 * per, dod: 0, price: 5 * per,
            count: per, barcode: bcs[0].code, time: '10:00', isClosed: reason === 'pickup',
            trashReason: reason, isFromDeletion: (reason === 'delete' || reason === 'pickup'), barcodes: bcs };
    }
    return {
        user_roles: { 'admin-uid': 'admin' },
        zoew_scan_history_cod_dod: hist, zoew_recently_deleted_cod_dod: trash,
        zoew_daily_revenue_cod_dod: { [d]: { codDollar: cod, dodDollar: 0, totalCount: cnt } },
        zoew_monthly_revenue_cod_dod: {}, zoew_daily_pickup_cod_dod: {}, zoew_scanner_lookup: {},
        zoew_barcode_registry: {}, zoew_settings: { exchange_rate: 4100 }, _dateKey: d
    };
}

(async () => {
    const browser = await chromium.launch({ executablePath: CHROME });
    for (const app of ['ZoeW']) {
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
            // App React ៖ function សរសេរ state ហើយ React គូរក្នុង microtask ➜ ការវាស់ត្រូវរួម **commit ពិត** (`commitNow()` =
            //    flushSync) បើមិនដូច្នេះវាវាស់តែការសាង model (ms តិចក្លែង) មិនមែនការគូរ DOM ដែល App ដើមធ្វើភ្លាម
            const flush = typeof window.commitNow === 'function' ? () => window.commitNow() : () => {};
            const t = (fn, reps) => { const s = performance.now(); for (let i = 0; i < reps; i++) { fn(); flush(); } return (performance.now() - s) / reps; };
            const bust = () => {
                document.querySelectorAll('#historyTableBody tr').forEach((tr) => { delete tr.dataset.sig; });
                // App React ៖ cold = តារាងទទេ រួចគូរជួរទាំងអស់ឡើងវិញ (គ្មាន node ឲ្យ React reconcile)
                if (window.uiState && 'historyView' in window.uiState) { window.uiState.historyView = []; flush(); }
            };
            const renderCold = t(() => { bust(); window.applyCurrentFilter(); }, 5);
            const render = t(() => window.applyCurrentFilter(), 5);
            const listener = t(() => window.__fireHistory(), 5);
            const suggest = t(() => window.collectPhoneSuggestions('42', 12), 10);
            const recent = t(() => window.updateRecentPhonesList(), 5);
            const trashRender = typeof window.renderRecentlyDeleted === 'function'
                ? t(() => window.renderRecentlyDeleted(), 5) : -1;
            const trashSearch = typeof window.filterRecentlyDeleted === 'function'
                ? t(() => { const el = document.getElementById('deletedSearchInput');
                    if (el) { el.value = '0960000042'; window.filterRecentlyDeleted(); el.value = ''; window.filterRecentlyDeleted(); } }, 5) : -1;
            // App React ៖ ជួរដេកគូរក្នុង microtask ➜ `commitNow()` ពិតមុនរាប់ (App ដើមសរសេរ DOM ភ្លាម)
            if (typeof window.commitNow === 'function') window.commitNow();
            return {
                render: Math.round(render), renderCold: Math.round(renderCold), listener: Math.round(listener),
                suggest: Math.round(suggest), recent: Math.round(recent),
                trashRender: Math.round(trashRender), trashSearch: Math.round(trashSearch),
                trashRows: document.querySelectorAll('#deletedTableBody tr').length,
                rows: document.querySelectorAll('#historyTableBody tr').length
            };
        });

        // ការ sync ពី Firebase មិនត្រូវសាងផ្ទាំងទំព័រ ២ ឡើងវិញ ខណៈអ្នកប្រើនៅទំព័រ ១
        const hiddenPanelWork = await page.evaluate(async () => {
            const spy = { locker: 0, entry: 0 };
            // App React ៖ ការហៅខាងក្នុង module មិនឆ្លង `window` ➜ spy លើ `window.renderXList` មិនឃើញអ្វីសោះ (០ ក្លែង)
            //    ➜ វាស់ **ការសរសេរពិត** ៖ renderer នីមួយៗសរសេរ view ថ្មី (`uiState.entryListView` · `lockerListView`) ➜
            //    reference ប្តូរ = ការសាងផ្ទាំងឡើងវិញពិត ១ ដង (ចំនួន ០/១ គ្រប់គ្រាន់សម្រាប់ការអះអាងទាំង ២ ទិស)
            const reactViews = !!(window.uiState && 'entryListView' in window.uiState && 'lockerListView' in window.uiState);
            const origLocker = window.renderLockerList;
            const origEntry = window.renderEntryList;
            if (!reactViews) {
                window.renderLockerList = function () { spy.locker++; return origLocker.apply(this, arguments); };
                window.renderEntryList = function () { spy.entry++; return origEntry.apply(this, arguments); };
            }
            let marks = null;
            const mark = () => { if (reactViews) marks = { entry: window.uiState.entryListView, locker: window.uiState.lockerListView }; };
            const collect = () => {
                if (!reactViews) return { locker: spy.locker, entry: spy.entry };
                return { locker: window.uiState.lockerListView !== marks.locker ? 1 : 0, entry: window.uiState.entryListView !== marks.entry ? 1 : 0 };
            };
            const wait = (ms) => new Promise((r) => setTimeout(r, ms));

            window.switchAppPage('data');
            await wait(260);
            spy.locker = 0; spy.entry = 0; mark();
            window.__fireHistory();
            await wait(320);
            const onDataPage = collect();

            window.switchAppPage('entry');
            await wait(60);
            spy.locker = 0; spy.entry = 0; mark();
            window.__fireHistory();
            await wait(320);
            const onEntryPage = collect();
            const mode = window.localStorage.getItem('zoe_entry_scan_mode') === 'locker' ? 'locker' : 'parcel';
            const entryRows = document.querySelectorAll('#entryListTableBody tr').length;

            if (!reactViews) {
                window.renderLockerList = origLocker;
                window.renderEntryList = origEntry;
            }
            window.switchAppPage('data');
            return { onDataPage, onEntryPage, mode, entryRows };
        });

        // ⛔ តារាងប្រវត្តិគូរជាទំព័រ (សំណើម្ចាស់គម្រោង ៖ «APK អាក់ពេលឈរលើ ទាំងអស់ ➜ បង្ហាញ ៥០ ជួរ ហើយពេលរមូរជិតដល់ចុង
        //    ចាំបន្ថែមចូលទៀត»)។ vitest វាស់តក្កវិជ្ជាជាមួយ IntersectionObserver ក្លែង ➜ ត្រង់នេះវាស់ **Chromium ពិត** ៖ filter «ទាំងអស់»
        //    ➜ តែទំព័រដំបូង · ការរមូរកន្សោមរមូរពិតដល់ចុង ➜ observer ពិតបាញ់ ➜ ជួរកើនពិត។ ទំហំទំព័រដេរីវេពី `app.js` ពិត។
        const pageRowsMatch = fs.readFileSync(path.join(ROOT, app, 'app.js'), 'utf8').match(/HISTORY_PAGE_ROWS\s*=\s*(\d+)/);
        const PAGE_ROWS = pageRowsMatch ? Number(pageRowsMatch[1]) : NaN;
        const paging = await page.evaluate(async () => {
            const wait = (ms) => new Promise((r) => setTimeout(r, ms));
            const flush = typeof window.commitNow === 'function' ? () => window.commitNow() : () => {};
            window.filterDataByDate('all');
            flush();
            await wait(300);
            const body = document.getElementById('historyTableBody');
            const sc = document.getElementById('tableResponsive');
            const count = () => body.querySelectorAll('tr[data-id]').length;
            const total = window.uiState && Array.isArray(window.uiState.historyView) ? window.uiState.historyView.length : -1;
            const first = count();
            const moreRow = !!body.querySelector('.history-more-row');
            const scrollable = !!sc && sc.scrollHeight > sc.clientHeight + 1;
            if (sc) sc.scrollTop = sc.scrollHeight;
            for (let i = 0; i < 20 && count() === first; i++) { await wait(100); flush(); }
            return { total, first, moreRow, scrollable, afterScroll: count() };
        });
        console.log('    តារាងប្រវត្តិ «ទាំងអស់» ៖ ' + JSON.stringify(paging) + ' page=' + PAGE_ROWS);

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

        // ⛔ បើក modal / ម៉ឺនុយ ☰ ពេលរមូរដល់ចុង (កញ្ចប់ច្រើន ➜ ជួរច្រើន · របា Tab លាក់) ត្រូវថ្លៃស្មើពេលរបាបង្ហាញ (សំណើម្ចាស់គម្រោង ៖ «APK រមូរដល់ចុង
        //    ចុចបើកធុងសំរាម ឬបញ្ជី ZTO អាក់អាក់»)។ មូលហេតុដែលវាស់បាន ៖ `openModalHelper()` បង្ហាញរបាវិញ ➜ `chrome-hidden` ប្តូរ clip-path ·
        //    padding របស់បញ្ជី ➜ PrePaint + Paint លើជួរទាំងអស់ (៦០០ ជួរ ក្រោម CPU ថយ ៤ ដង ≈ ២១៦ms ធៀប ≈ ៤០ms)។ ⛔ ការវាស់ជា **សមាមាត្រ**
        //    (របាលាក់ ÷ របាបង្ហាញ · median ៥ ដង · trace ពិត) ➜ មិនអាស្រ័យល្បឿនម៉ាស៊ីន · ផ្លូវណាមួយដែលធ្វើឲ្យការបើក modal ប៉ះបញ្ជី ➜ ក្រហម
        const modalOpenRows = await page.evaluate(async () => {
            const wait = (ms) => new Promise((r) => setTimeout(r, ms));
            const flush = typeof window.commitNow === 'function' ? () => window.commitNow() : () => {};
            const el = document.getElementById('searchPhoneInput');
            if (el) { el.value = ''; el.dispatchEvent(new Event('input', { bubbles: true })); el.blur(); }
            window.filterDataByDate('all');
            flush();
            await wait(300);
            const sc = document.getElementById('tableResponsive');
            const count = () => document.querySelectorAll('#historyTableBody tr[data-id]').length;
            let prev = -1;
            for (let i = 0; i < 60 && count() !== prev; i++) {
                prev = count();
                sc.scrollTop = sc.scrollHeight;
                for (let k = 0; k < 20 && count() === prev; k++) { await wait(50); flush(); }
            }
            sc.scrollTop = sc.scrollHeight - sc.clientHeight - 300;
            await wait(200);
            return count();
        });
        const cdpThrottle = await ctx.newCDPSession(page);
        await cdpThrottle.send('Emulation.setCPUThrottlingRate', { rate: 4 });
        const overlayOpenPaint = async (hiddenBar, open, close) => {
            await page.evaluate((h) => { window.uiState.chromeHidden = h; if (typeof window.commitNow === 'function') window.commitNow(); }, hiddenBar);
            await page.waitForTimeout(400);
            const hiddenBefore = await page.evaluate(() => document.body.classList.contains('chrome-hidden'));
            await browser.startTracing(page, { categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline'] });
            await page.evaluate(async (fn) => {
                window[fn]();
                if (typeof window.commitNow === 'function') window.commitNow();
                await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
            }, open);
            await page.waitForTimeout(250);
            const ev = JSON.parse((await browser.stopTracing()).toString()).traceEvents || [];
            const hiddenAfter = await page.evaluate(() => document.body.classList.contains('chrome-hidden'));
            await page.evaluate((c) => { window[c[0]].apply(null, c.slice(1)); if (typeof window.commitNow === 'function') window.commitNow(); }, close);
            await page.waitForTimeout(400);
            const ms = ev.filter((e) => (e.name === 'PrePaint' || e.name === 'Paint') && e.ph === 'X').reduce((a, e) => a + (e.dur || 0), 0) / 1000;
            return { ms, hiddenBefore, hiddenAfter };
        };
        const median = (a) => { const v = a.map((r) => r.ms).sort((x, y) => x - y); return Math.round(v[Math.floor(v.length / 2)]); };
        const overlayCost = async (open, close) => {
            const shownRuns = [], hiddenRuns = [];
            for (let i = 0; i < 5; i++) { shownRuns.push(await overlayOpenPaint(false, open, close)); hiddenRuns.push(await overlayOpenPaint(true, open, close)); }
            return { rows: modalOpenRows, shown: median(shownRuns), hidden: median(hiddenRuns),
                stateSet: hiddenRuns.every((r) => r.hiddenBefore) && shownRuns.every((r) => !r.hiddenBefore), barStays: hiddenRuns.every((r) => r.hiddenAfter) };
        };
        const modalOpen = await overlayCost('openRecentlyDeletedModal', ['closeModal', 'recentlyDeletedModal']);
        const drawerOpen = await overlayCost('openSideDrawer', ['closeSideDrawer']);
        await cdpThrottle.send('Emulation.setCPUThrottlingRate', { rate: 1 });
        console.log('    បើកធុងសំរាម (CPU ÷4 · PrePaint+Paint median) ៖ ' + JSON.stringify(modalOpen));
        console.log('    បើកម៉ឺនុយ ☰ (CPU ÷4 · PrePaint+Paint median) ៖ ' + JSON.stringify(drawerOpen));

        console.log('    boot=' + bootMs + 'ms  renderCold=' + m.renderCold + 'ms  render=' + m.render + 'ms  listenerRepaint=' + m.listener +
                    'ms  suggest=' + m.suggest + 'ms  recentPhones=' + m.recent + 'ms  keystroke=' + typeMs + 'ms  rows=' + m.rows);
        console.log('    ធុងសំរាម (' + ORDERS + ' ធាតុ)៖ render=' + m.trashRender + 'ms  ស្វែងរក=' + m.trashSearch + 'ms  rows=' + m.trashRows);
        console.log('    ការសាងផ្ទាំងទំព័រ ២ ក្នុងមួយ sync៖ នៅទំព័រ ១ ' + JSON.stringify(hiddenPanelWork.onDataPage) +
                    '  នៅទំព័រ ២ (' + hiddenPanelWork.mode + ') ' + JSON.stringify(hiddenPanelWork.onEntryPage));

        if (!REPORT) {
            check(m.renderCold < COLD_LIMIT, app + ': render តារាងទាំងស្រុង (cold) < ' + COLD_LIMIT + 'ms នៅ ' + ORDERS + ' order', 'renderCold=' + m.renderCold + 'ms');
            check(m.render < 400, app + ': repaint ដែលគ្មានអ្វីប្រែ < 400ms', 'render=' + m.render + 'ms');
            check(m.listener < 600, app + ': repaint ពី Firebase listener < 600ms', 'listener=' + m.listener + 'ms');
            check(m.suggest < 120, app + ': ស្វែងរកលេខ (collectPhoneSuggestions) < 120ms', 'suggest=' + m.suggest + 'ms');
            check(typeMs < 0 || typeMs < 300, app + ': វាយអក្សរ ១ តួក្នុងប្រអប់ស្វែងរក < 300ms', 'keystroke=' + typeMs + 'ms');
            check(hiddenPanelWork.onDataPage.locker === 0 && hiddenPanelWork.onDataPage.entry === 0,
                app + ': sync ខណៈនៅទំព័រ ១ មិនសាងផ្ទាំងទំព័រ ២ ឡើងវិញ', JSON.stringify(hiddenPanelWork.onDataPage));
            const expectedPanel = hiddenPanelWork.mode === 'locker' ? hiddenPanelWork.onEntryPage.locker : hiddenPanelWork.onEntryPage.entry;
            check(expectedPanel > 0,
                app + ': sync ខណៈនៅទំព័រ ២ សាងផ្ទាំងដែលកំពុងបង្ហាញឡើងវិញពិត', JSON.stringify(hiddenPanelWork));
            check(hiddenPanelWork.mode !== 'parcel' || hiddenPanelWork.entryRows > 0,
                app + ': បញ្ជីកញ្ចប់ថ្ងៃនេះមានជួរដេកបន្ទាប់ពី sync', JSON.stringify(hiddenPanelWork));
            check(m.trashRender < 0 || m.trashRender < 600,
                app + ': render ធុងសំរាម < 600ms នៅ ' + ORDERS + ' ធាតុ (រក្សាទុក ៣០ ថ្ងៃ)', 'trashRender=' + m.trashRender + 'ms');
            check(m.trashSearch < 0 || m.trashSearch < 900,
                app + ': ស្វែងរកក្នុងធុងសំរាម < 900ms នៅ ' + ORDERS + ' ធាតុ', 'trashSearch=' + m.trashSearch + 'ms');
            check(m.trashRows > 0, app + ': ធុងសំរាមមានជួរដេកពិត (seed មិនទទេ)', 'trashRows=' + m.trashRows);
            check(PAGE_ROWS > 0 && paging.total > 2 * PAGE_ROWS && paging.first === PAGE_ROWS && paging.moreRow,
                app + ': តារាងប្រវត្តិ filter «ទាំងអស់» គូរតែទំព័រដំបូង (' + PAGE_ROWS + ' ជួរ) + ជួរ «បង្ហាញទៀត»', JSON.stringify(paging) + ' page=' + PAGE_ROWS);
            check(paging.scrollable && paging.afterScroll > paging.first && paging.afterScroll <= paging.total,
                app + ': រមូរកន្សោមតារាងដល់ចុង ➜ IntersectionObserver ពិតទាញជួរបន្ថែម', JSON.stringify(paging));
            check(modalOpen.rows >= Math.min(600, ORDERS) && modalOpen.stateSet,
                app + ': បើក modal ៖ លក្ខខណ្ឌចាំបាច់ — រមូរដល់ចុងពិត (ជួរប្រវត្តិ ≥ ៦០០) · របាលាក់/បង្ហាញពិតមុនបើក', JSON.stringify(modalOpen));
            check(modalOpen.hidden <= modalOpen.shown * 1.8 + 8,
                app + ': ⛔ បើក modal ពេលរបាលាក់ (' + modalOpen.rows + ' ជួរ) មិនគូរបញ្ជីឡើងវិញ — PrePaint+Paint ≤ 1.8× ពេលរបាបង្ហាញ',
                JSON.stringify(modalOpen));
            check(drawerOpen.stateSet,
                app + ': បើកម៉ឺនុយ ៖ លក្ខខណ្ឌចាំបាច់ — របាលាក់/បង្ហាញពិតមុនបើក', JSON.stringify(drawerOpen));
            check(drawerOpen.hidden <= drawerOpen.shown * 1.8 + 8,
                app + ': ⛔ បើកម៉ឺនុយ ☰ ពេលរបាលាក់ (' + drawerOpen.rows + ' ជួរ) មិនគូរបញ្ជីឡើងវិញ — PrePaint+Paint ≤ 1.8× ពេលរបាបង្ហាញ',
                JSON.stringify(drawerOpen));
        }
        await ctx.close();

        // ⛔ App ស្ងៀម (online · គ្មានការប៉ះ) ត្រូវគូរ **០ ស៊ុម** ៖ animation `infinite` ណាមួយធ្វើឲ្យ compositor គូររាល់ vsync ជារៀងរហូត
        // ➜ អេក្រង់ LTPO (10–120Hz) ចុះល្បឿនមិនបាន · ស៊ីថ្ម។ វាស់បាន ៖ `pulseDot 2s infinite` លើចំណុច «ភ្ជាប់ Server» ➜ DrawFrame
        // **២៣០ / ៥ វិ.** ពេលស្ងៀម ធៀប ០ ពេលគ្មានវា។ ⛔ ការវាស់ត្រូវជា **trace ពិត** (DrawFrame) មិនមែនអាន CSS; probe ទិសផ្ទុយ ៖
        // animation infinite ដែលចាក់ចូលដោយចេតនា ➜ ត្រូវឃើញស៊ុម (បើមិនឃើញ ការវាស់ខូច); «កំពុងភ្ជាប់» នៅតែភ្លឹប (សញ្ញាសកម្មភាពពិត)។
        const idleCtx = await browser.newContext({ viewport: { width: 412, height: 780 }, hasTouch: true, isMobile: true });
        const idle = await idleCtx.newPage();
        await idle.route('**', (r) => {
            const u = r.request().url();
            if (u.indexOf('/license-verify.js') !== -1) return r.fulfill({ status: 200, contentType: 'application/javascript', body: LICENSE_STUB });
            if (u.startsWith('http://127.0.0.1:' + port)) return r.continue();
            return r.abort();
        });
        // ⛔ ស្ថានភាពត្រូវ **ដាក់ចូល** ៖ ជួរដេក «ខលម្តងទៀត» (`callMark` មិនលើក · លើស ៤ ម៉ោង) ជាទិដ្ឋភាពប្រចាំថ្ងៃ ➜ seed គ្មានវា
        //    = ការវាស់ដែលមិនដែលឃើញ animation របស់ប៊ូតុង `.call-btn-recall` (2.45.4 ៖ ពណ៌ផ្ទៃ `infinite` ➜ main thread គូររាល់ vsync)។
        const idleSeed = seedBig(30);
        Object.keys(idleSeed.zoew_scan_history_cod_dod).slice(0, 2).forEach((id) => {
            Object.assign(idleSeed.zoew_scan_history_cod_dod[id], { callMark: 'no-answer', callMarkTime: Date.now() - 5 * 3600 * 1000 });
        });
        await idle.addInitScript(`window.localStorage.setItem('zoew_firebase_config', ${JSON.stringify(JSON.stringify({ apiKey: 'k', databaseURL: 'https://fake-default-rtdb.firebaseio.com', projectId: 'p' }))});`);
        await idle.addInitScript('(' + BOOT.toString() + ')(' + JSON.stringify(idleSeed) + ');');
        await idle.goto('http://127.0.0.1:' + port + '/', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await idle.waitForFunction(() => document.querySelectorAll('#historyTableBody tr').length > 0, null, { timeout: 30000 });
        const recallAtStart = await idle.evaluate(() => ({
            buttons: document.querySelectorAll('.call-btn-recall').length,
            blinking: document.getAnimations().filter((a) => a.animationName === 'callRecallBlink' && a.playState === 'running').length
        }));
        await idle.waitForTimeout(8000);
        // ⛔ **DrawFrame តែម្យ៉ាងខ្វាក់** ចំពោះ animation ដែលគូរលើ main thread (ពណ៌ · paint) ៖ វាស់បាន (2.45.4) ប៊ូតុង «ខលម្តងទៀត» ២
        //    ➜ DrawFrame **០** ខណៈ BeginMainThreadFrame **៣៥៧** · Paint **៧០៤** ក្នុង ៣ វិ. ➜ ត្រូវរាប់ **ទាំង ២** ហើយ probe ទិសផ្ទុយម្នាក់ៗ។
        const idleFrames = async (ms) => {
            await browser.startTracing(idle, { categories: ['disabled-by-default-devtools.timeline.frame', 'devtools.timeline', 'viz'] });
            await idle.waitForTimeout(ms);
            const ev = JSON.parse((await browser.stopTracing()).toString()).traceEvents || [];
            return { draw: ev.filter((e) => e.name === 'DrawFrame').length, main: ev.filter((e) => e.name === 'BeginMainThreadFrame').length };
        };
        const idleState = await idle.evaluate(() => {
            const colorOf = (el) => (el ? getComputedStyle(el).backgroundColor : '');
            const probeEl = document.createElement('i');
            probeEl.style.backgroundColor = 'var(--action-danger)';
            document.body.appendChild(probeEl);
            const danger = getComputedStyle(probeEl).backgroundColor;
            probeEl.remove();
            return {
                dot: (document.querySelector('.status-dot') || {}).className || '',
                lite: document.body.classList.contains('perf-lite'),
                running: document.getAnimations().filter((a) => a.playState === 'running').map((a) => a.animationName || 'x'),
                danger: danger,
                recallColor: colorOf(document.querySelector('.call-btn-recall')),
                plainColor: colorOf(document.querySelector('.call-btn:not(.call-btn-recall)'))
            };
        });
        const idleMeasured = await idleFrames(3000);
        const probe = await idle.addStyleTag({ content: '.status-dot::after{animation:pulseDot 1s infinite!important}' });
        await idle.waitForTimeout(200);
        const probeFrames = (await idleFrames(2000)).draw;
        await probe.evaluate((el) => el.remove());
        const mainProbe = await idle.addStyleTag({ content: '@keyframes zoeIdleProbe{50%{background-color:#ff0000}} .app-navbar{animation:zoeIdleProbe 1s infinite!important}' });
        await idle.waitForTimeout(200);
        const mainProbeFrames = (await idleFrames(2000)).main;
        await mainProbe.evaluate((el) => el.remove());
        await idle.evaluate(() => { window.viewState.connectionStatus = 'connecting'; if (typeof window.commitNow === 'function') window.commitNow(); });
        await idle.waitForTimeout(8000);
        const connecting = await idle.evaluate(() => ({
            dot: (document.querySelector('.status-dot') || {}).className || '',
            running: document.getAnimations().filter((a) => a.playState === 'running').map((a) => a.animationName || 'x')
        }));
        console.log('    ស្ងៀម ៣ វិ. ៖ ' + JSON.stringify(idleMeasured) + ' · probe compositor ២ វិ. ៖ DrawFrame=' + probeFrames +
            ' · probe main thread ២ វិ. ៖ BeginMainThreadFrame=' + mainProbeFrames + ' · recall ' + JSON.stringify(recallAtStart) + ' · ' + JSON.stringify(idleState));
        if (!REPORT) {
            check(idleState.dot === 'status-dot' && !idleState.lite,
                app + ': ស្ងៀម ៖ លក្ខខណ្ឌចាំបាច់ — online (`status-dot`) និងមិនមែន perf-lite', JSON.stringify(idleState));
            check(recallAtStart.buttons >= 1,
                app + ': ស្ងៀម ៖ លក្ខខណ្ឌចាំបាច់ — ជួរដេក «ខលម្តងទៀត» ត្រូវបានគូរ (ស្ថានភាពត្រូវដាក់ចូល)', JSON.stringify(recallAtStart));
            check(probeFrames >= 30, app + ': ស្ងៀម ៖ probe ទិសផ្ទុយ — animation compositor ត្រូវឃើញ DrawFrame (ការវាស់រសើប)', 'DrawFrame=' + probeFrames);
            check(mainProbeFrames >= 30, app + ': ស្ងៀម ៖ probe ទិសផ្ទុយ — animation main thread (ពណ៌) ត្រូវឃើញ BeginMainThreadFrame (ការវាស់រសើប)', 'BeginMainThreadFrame=' + mainProbeFrames);
            check(idleMeasured.draw <= 3 && idleMeasured.main <= 3 && idleState.running.length === 0,
                app + ': ⛔ App ស្ងៀម online (មានជួរដេក «ខលម្តងទៀត») មិនគូរស៊ុម — ទាំង compositor ទាំង main thread ➜ LTPO ចុះល្បឿនបាន',
                JSON.stringify(idleMeasured) + ' running=' + JSON.stringify(idleState.running));
            check(recallAtStart.blinking >= 1,
                app + ': ប៊ូតុង «ខលម្តងទៀត» ភ្លឹបពេលលេចដំបូង (សញ្ញាទាក់ចំណាប់អារម្មណ៍នៅដដែល)', JSON.stringify(recallAtStart));
            check(idleState.recallColor !== '' && idleState.recallColor === idleState.danger && idleState.plainColor !== idleState.danger,
                app + ': ⛔ ក្រោយឈប់ភ្លឹប ប៊ូតុង «ខលម្តងទៀត» នៅពណ៌ក្រហម (`--action-danger`) ជាប់ · ប៊ូតុងខលធម្មតាមិនក្រហម — សញ្ញាមិនបាត់',
                JSON.stringify({ recall: idleState.recallColor, plain: idleState.plainColor, danger: idleState.danger }));
            check(/connecting/.test(connecting.dot) && connecting.running.indexOf('pulseDot') !== -1,
                app + ': «កំពុងភ្ជាប់» នៅតែភ្លឹប (សញ្ញាសកម្មភាពពិត មិនត្រូវបិទជាមួយ)', JSON.stringify(connecting));
        }
        await idleCtx.close();
        server.close();
    }

    // ⛔ ZoeKeyGen ក៏ត្រូវស្ងៀម ០ ស៊ុម ដូច ZoeW (LTPO 10–120Hz) — ទាំងអេក្រង់ចូល និងផ្ទាំងការងារ (Tab លើទូរស័ព្ទ) ·
    //    probe ទិសផ្ទុយ ៖ animation infinite ដែលចាក់ចូល ➜ ត្រូវឃើញស៊ុម (បើមិនឃើញ ការវាស់ខូច)
    {
        const app = 'ZoeKeyGen';
        console.log('\n=== ' + app + ' (ស៊ុមពេលស្ងៀម) ===');
        const server = await serve(path.join(ROOT, app));
        const port = server.address().port;
        const kctx = await browser.newContext({ viewport: { width: 412, height: 780 }, hasTouch: true, isMobile: true, serviceWorkers: 'block' });
        const kpage = await kctx.newPage();
        await kpage.route('**', (r) => (r.request().url().startsWith('http://127.0.0.1:' + port) ? r.continue() : r.abort()));
        await kpage.goto('http://127.0.0.1:' + port + '/', { waitUntil: 'load', timeout: 30000 });
        const frames = async (ms) => {
            await browser.startTracing(kpage, { categories: ['disabled-by-default-devtools.timeline.frame', 'devtools.timeline', 'viz'] });
            await kpage.waitForTimeout(ms);
            const ev = JSON.parse((await browser.stopTracing()).toString()).traceEvents || [];
            return { draw: ev.filter((e) => e.name === 'DrawFrame').length, main: ev.filter((e) => e.name === 'BeginMainThreadFrame').length };
        };
        const running = () => kpage.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running').map((a) => a.animationName || 'x'));
        await kpage.waitForTimeout(5000);
        const loginIdle = await frames(3000);
        const loginRunning = await running();
        await kpage.evaluate(() => {
            document.querySelectorAll('.modal').forEach((m) => { m.style.display = 'none'; });
            const box = document.getElementById('appContainer');
            if (box) box.classList.remove('hidden');
        });
        const tabVisible = await kpage.evaluate(() => { const b = document.getElementById('kgTabBar'); return !!b && getComputedStyle(b).display !== 'none'; });
        await kpage.waitForTimeout(2000);
        const appIdle = await frames(3000);
        const appRunning = await running();
        const kprobe = await kpage.addStyleTag({ content: '.status-dot{animation:zoeKgProbe 1s linear infinite!important}@keyframes zoeKgProbe{to{transform:rotate(360deg)}}' });
        await kpage.waitForTimeout(200);
        const probeIdle = await frames(2000);
        await kprobe.evaluate((el) => el.remove());
        console.log('    ចូល ៖ ' + JSON.stringify(loginIdle) + ' ' + JSON.stringify(loginRunning) + ' · ផ្ទាំងការងារ ៖ ' + JSON.stringify(appIdle) + ' ' +
            JSON.stringify(appRunning) + ' · probe ៖ ' + JSON.stringify(probeIdle));
        if (!REPORT) {
            check(tabVisible, app + ': ស្ងៀម ៖ លក្ខខណ្ឌចាំបាច់ — ផ្ទាំងការងារ + របា Tab ទូរស័ព្ទបង្ហាញ', String(tabVisible));
            check(probeIdle.draw >= 30, app + ': ស្ងៀម ៖ probe ទិសផ្ទុយ — animation ដែលចាក់ចូលត្រូវឃើញ DrawFrame', JSON.stringify(probeIdle));
            check(loginIdle.draw <= 3 && loginIdle.main <= 3 && loginRunning.length === 0,
                app + ': ⛔ អេក្រង់ចូលស្ងៀម មិនគូរស៊ុម (LTPO ចុះល្បឿនបាន)', JSON.stringify(loginIdle) + ' running=' + JSON.stringify(loginRunning));
            check(appIdle.draw <= 3 && appIdle.main <= 3 && appRunning.length === 0,
                app + ': ⛔ ផ្ទាំងការងារស្ងៀម មិនគូរស៊ុម (LTPO ចុះល្បឿនបាន)', JSON.stringify(appIdle) + ' running=' + JSON.stringify(appRunning));
        }
        await kctx.close();
        server.close();
    }
    await browser.close();
    if (REPORT) { console.log('\n(របាយការណ៍តែប៉ុណ្ណោះ)'); process.exit(0); }
    console.log('\n' + (fail ? 'FAIL ' + fail + ' / ជោគជ័យ ' + pass : 'PASS ' + pass + '/' + pass));
    process.exit(fail ? 1 : 0);
})();
