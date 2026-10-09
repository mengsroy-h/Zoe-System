let chromium;
try { chromium = require('playwright-core').chromium; } catch (e) {
    console.log('SKIP — ត្រូវការ playwright-core (npm i playwright-core)');
    process.exit(0);
}
const CHROME = process.env.FIELDSHAPE_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const fs = require('fs');
const http = require('http');
const path = require('path');
if (!fs.existsSync(CHROME)) { console.log('SKIP — រកមិនឃើញ Chromium'); process.exit(0); }

const ROOT = process.env.FIELDSHAPE_APP_DIR || path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm' };
let pass = 0, fail = 0;
const ok = (n) => { console.log('  ok    ' + n); pass++; };
const bad = (n, d) => { console.log('  FAIL  ' + n + (d ? '\n        ' + d : '')); fail++; };
const check = (c, n, d) => (c ? ok(n) : bad(n, d));

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

const LICENSE_STUB = `window.ZoeLicense = {
    getStatus: function () { return Promise.resolve({ state: 'active' }); },
    setServerTimeOffset: function () {}, syncServerTime: function () { return Promise.resolve(); },
    activate: function () { return Promise.resolve({ ok: true }); },
    verifyKeyString: function () { return Promise.resolve({ ok: true }); }, clearActivation: function () {}
};`;

const FAKE_SDK = function (seed) {
    const store = JSON.parse(JSON.stringify(seed));
    window.__fakeStore = store;
    window.__errs = [];
    const listeners = [];
    function getPath(p) {
        if (!p || p === '/') return store;
        let cur = store;
        for (const part of p.split('/').filter(Boolean)) {
            if (cur === null || cur === undefined || typeof cur !== 'object') return null;
            cur = cur[part];
        }
        return cur === undefined ? null : cur;
    }
    function setPath(p, val) {
        const parts = p.split('/').filter(Boolean);
        if (!parts.length) return;
        let cur = store;
        for (let i = 0; i < parts.length - 1; i++) {
            if (cur[parts[i]] === null || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
            cur = cur[parts[i]];
        }
        const last = parts[parts.length - 1];
        if (val === null) delete cur[last]; else cur[last] = JSON.parse(JSON.stringify(val));
    }
    function snapOf(p) {
        const v = getPath(p);
        return { val: () => (v === undefined || v === null) ? null : (typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v), exists: () => v !== null && v !== undefined };
    }
    function fire(p) { listeners.filter((l) => l.path === p).forEach((l) => { try { l.cb(snapOf(p)); } catch (e) { window.__errs.push(p + ': ' + (e && e.message)); } }); }
    window.__fireAll = () => [...new Set(listeners.map((l) => l.path))].forEach(fire);
    window.__setPath = (p, v) => { setPath(p, v); fire(p); };
    const user = { uid: 'admin-uid', email: 'a@b.c', getIdToken: () => Promise.resolve('tok'), metadata: { lastSignInTime: new Date().toISOString() } };
    window.firebaseSDK = {
        initializeApp: () => ({ name: 'fake' }), getApps: () => [], deleteApp: () => Promise.resolve(),
        getAuth: () => ({ currentUser: user }),
        onAuthStateChanged: (a, cb) => { setTimeout(() => cb(user), 0); return () => {}; },
        signInWithEmailAndPassword: () => Promise.resolve({ user }), signOut: () => Promise.resolve(),
        setPersistence: () => Promise.resolve(), browserLocalPersistence: {}, browserSessionPersistence: {},
        getIdTokenResult: () => Promise.resolve({ authTime: new Date().toISOString(), claims: {} }),
        getDatabase: () => ({ fake: true }), ref: (d, p) => ({ path: p === undefined ? '' : String(p) }),
        onValue: (r, cb) => {
            listeners.push({ path: r.path, cb });
            setTimeout(() => { if (r.path === '.info/connected') cb({ val: () => true }); else { try { cb(snapOf(r.path)); } catch (e) { window.__errs.push(r.path + ': ' + (e && e.message)); } } }, 0);
            return () => {};
        },
        off: () => {}, get: (r) => Promise.resolve(snapOf(r.path)),
        set: (r, v) => { setPath(r.path, v); window.__fireAll(); return Promise.resolve(); },
        update: (r, obj) => { Object.keys(obj).forEach((k) => setPath((r.path ? r.path + '/' : '') + k, obj[k])); window.__fireAll(); return Promise.resolve(); },
        goOnline: () => {},
        runTransaction: (r, fn) => {
            const cur = getPath(r.path);
            const next = fn(cur === null ? null : JSON.parse(JSON.stringify(cur)));
            if (next === undefined) return Promise.resolve({ committed: false, snapshot: snapOf(r.path) });
            setPath(r.path, next); window.__fireAll();
            return Promise.resolve({ committed: true, snapshot: snapOf(r.path) });
        }
    };
    window.dispatchEvent(new Event('firebasesdkready'));
};

const D = (() => { const t = new Date(); return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0'); })();

// រូបរាងវាលដែល RTDB / ទិន្នន័យចាស់ អាចត្រឡប់មកបាន — មិនមែន barcodes
const HOSTILE_ITEMS = {
    numeric_phone:      { id: 'numeric_phone', phone: 960000421, scanDate: D, cod: 5, dod: 0, count: 1, barcode: 'N1', time: '09:00', isClosed: false, barcodes: [{ code: 'N1', cod: 5, dod: 0, locker: 'A1', isClosed: false, time: '09:00' }] },
    string_money:       { id: 'string_money', phone: '011000111', scanDate: D, cod: '7.5', dod: '2.5', count: '1', barcode: 'S1', time: '09:01', isClosed: 'false', barcodes: [{ code: 'S1', cod: '7.5', dod: '2.5', locker: 'A2', isClosed: false, time: '09:01' }] },
    missing_scandate:   { id: 'missing_scandate', phone: '011000222', cod: 3, dod: 0, count: 1, barcode: 'M1', time: '09:02', isClosed: false, barcodes: [{ code: 'M1', cod: 3, dod: 0, isClosed: false }] },
    legacy_price_only:  { id: 'legacy_price_only', phone: '011000333', scanDate: D, price: 12, count: 1, barcode: 'L1', time: '09:03', isClosed: false },
    count_mismatch:     { id: 'count_mismatch', phone: '011000444', scanDate: D, cod: 4, dod: 0, count: 9, barcode: 'C1', time: '09:04', isClosed: false, barcodes: [{ code: 'C1', cod: 4, dod: 0, isClosed: false }] },
    numeric_barcode:    { id: 'numeric_barcode', phone: '011000555', scanDate: D, cod: 6, dod: 0, count: 1, barcode: 77130500000213, time: '09:05', isClosed: false, barcodes: [{ code: 77130500000213, cod: 6, dod: 0, isClosed: false }] },
    null_fields:        { id: 'null_fields', phone: null, scanDate: D, cod: null, dod: null, count: null, barcode: null, time: null, isClosed: null, barcodes: [{ code: 'Z1', cod: null, dod: null, locker: null, isClosed: null }] },
    html_in_phone:      { id: 'html_in_phone', phone: '<img src=x onerror=window.__xss=1>', scanDate: D, cod: 1, dod: 0, count: 1, barcode: '<b>x</b>', time: '09:06', isClosed: false, barcodes: [{ code: '<b>x</b>', cod: 1, dod: 0, isClosed: false }] },
    deep_callmark:      { id: 'deep_callmark', phone: '011000666', scanDate: D, cod: 2, dod: 0, count: 1, barcode: 'K1', time: '09:07', isClosed: false, callMark: 'no-answer', callMarkTime: 'not-a-number', isCalled: 'yes', barcodes: [{ code: 'K1', cod: 2, dod: 0, isClosed: false }] }
};

function seedData(extra) {
    return Object.assign({
        user_roles: { 'admin-uid': 'admin' },
        zoew_scan_history_cod_dod: HOSTILE_ITEMS,
        zoew_recently_deleted_cod_dod: {},
        zoew_daily_revenue_cod_dod: { [D]: { codDollar: '10', dodDollar: null, totalCount: '3' } },
        zoew_monthly_revenue_cod_dod: { [D.substring(0, 7)]: { codDollar: 10, dodDollar: 0, totalCount: 3 } },
        zoew_daily_pickup_cod_dod: { [D]: { packagesPickedUp: '2', pickedUpPhones: { '011000111': '1' } } },
        zoew_scanner_lookup: {},
        zoew_barcode_registry: {},
        zoew_settings: { exchange_rate: '4100' }
    }, extra || {});
}

(async () => {
    const browser = await chromium.launch({ executablePath: CHROME });
    for (const app of ['ZoeW']) {
        console.log('\n=== ' + app + ' ===');
        const dir = path.join(ROOT, app);
        const server = await serve(dir);
        const port = server.address().port;
        const ctx = await browser.newContext({ viewport: { width: 412, height: 780 } });
        const page = await ctx.newPage();
        const errors = [];
        page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
        await page.addInitScript(`window.addEventListener('unhandledrejection', function (ev) {
                    var m; try { m = String((ev.reason && (ev.reason.message || ev.reason)) || 'unknown'); } catch (x) { m = 'unknown'; }
                    setTimeout(function () { throw new Error('unhandledrejection: ' + m); }, 0);
                });`);
        page.on('console', (m) => { if (m.type() === 'error') errors.push('console.error: ' + m.text().slice(0, 250)); });
        page.on('dialog', (d) => d.accept());
        await page.route('**', (route) => {
            const u = route.request().url();
            if (u.indexOf('/license-verify.js') !== -1) return route.fulfill({ status: 200, contentType: 'application/javascript', body: LICENSE_STUB });
            if (u.startsWith('http://127.0.0.1:' + port)) return route.continue();
            return route.abort();
        });
        await page.addInitScript(`window.localStorage.setItem('zoew_firebase_config', ${JSON.stringify(JSON.stringify({ apiKey: 'k', databaseURL: 'https://fake-default-rtdb.firebaseio.com', projectId: 'p' }))});`);
        await page.addInitScript('(' + FAKE_SDK.toString() + ')(' + JSON.stringify(seedData()) + ');');
        await page.goto('http://127.0.0.1:' + port + '/', { waitUntil: 'domcontentloaded', timeout: 20000 });

        await page.waitForTimeout(2500);

        const r = await page.evaluate(() => ({
            listenerErrs: window.__errs || [],
            rows: document.querySelectorAll('#historyTableBody tr').length,
            xss: !!window.__xss,
            bodyHasNaN: /NaN|undefined|\[object Object\]/.test(document.getElementById('historyTableBody') ? document.getElementById('historyTableBody').innerText : ''),
            statText: (document.getElementById('totalCodToday') || {}).innerText || ''
        }));
        check(r.listenerErrs.length === 0, app + ': listener មិន throw លើទិន្នន័យខូច', JSON.stringify(r.listenerErrs).slice(0, 300));
        await page.evaluate(() => { const b = document.getElementById('btnFilterAll'); if (b) b.click(); else window.filterDataByDate('all'); });
        await page.waitForTimeout(500);
        const all = await page.evaluate(() => ({
            rows: document.querySelectorAll('#historyTableBody tr').length,
            inMemory: (typeof scanHistory !== 'undefined' ? scanHistory : []).length,
            txt: document.getElementById('historyTableBody').innerText
        }));
        check(all.rows === all.inMemory && all.rows === 9,
            app + ': តម្រង "ទាំងអស់" ➜ គ្មានធាតុណាបាត់ស្ងាត់', 'rows=' + all.rows + ' inMemory=' + all.inMemory);
        check(!/NaN|undefined|\[object Object\]/.test(all.txt), app + ': "ទាំងអស់" ➜ គ្មាន NaN/undefined ក្នុងតារាង',
            (all.txt.match(/.{0,40}(NaN|undefined|\[object Object\]).{0,40}/) || [''])[0]);
        check(!r.xss, app + ': HTML ក្នុងលេខទូរស័ព្ទមិន execute (XSS)', 'window.__xss=' + r.xss);
        check(!r.bodyHasNaN, app + ': គ្មាន NaN/undefined/[object Object] ក្នុងតារាង', r.bodyHasNaN ? 'ឃើញក្នុងតារាង' : '');
        check(!/NaN/.test(r.statText), app + ': កាតស្ថិតិគ្មាន NaN', 'statText=' + r.statText);

        // បិទ item ដែលមានលេខជាចំនួន ➜ ស្ថិតិត្រូវតែជាលេខ មិនមែន NaN
        await page.evaluate(() => window.toggleCloseStatus('numeric_phone'));
        await page.waitForTimeout(500);
        const pick = await page.evaluate((d) => window.__fakeStore.zoew_daily_pickup_cod_dod[d], D);
        check(pick && typeof pick.packagesPickedUp === 'number' && !isNaN(pick.packagesPickedUp),
            app + ': បិទ item លេខទូរស័ព្ទជាចំនួន ➜ ស្ថិតិនៅជាលេខ', JSON.stringify(pick));
        check(pick && Object.keys(pick.pickedUpPhones || {}).length >= 1,
            app + ': លេខទូរស័ព្ទជាចំនួន ក៏ត្រូវរាប់ជាអតិថិជន', JSON.stringify(pick));

        const real = errors.filter((e) => !/net::ERR_FAILED|Failed to load resource|ERR_BLOCKED|ERR_ABORTED/i.test(e));
        check(real.length === 0, app + ': គ្មានកំហុស runtime លើទិន្នន័យខូច', real.slice(0, 4).join('\n        '));

        await ctx.close();

        // ⛔ record **ទាំងមូល** ជា primitive (string · លេខ · boolean) ៖ rules មិនមាន `.validate` នៅកម្រិត `$itemId` ➜ ការសរសេរ
        // តម្លៃមួយ (Console · import · កំហុសកូដ) ឆ្លងកាត់។ មុនកែ `rawSnapshotToItemList()` សរសេរ `v.id` លើ primitive ➜ `TypeError`
        // (strict mode) រាល់ snapshot ➜ `noteDbListenerAlive()` មិនដែលរត់ ➜ តារាង/ធុងសំរាមជាប់ «⏳ វាស់មិនបាន» លើ **គ្រប់ឧបករណ៍**។
        const ctx2 = await browser.newContext({ viewport: { width: 412, height: 780 } });
        const page2 = await ctx2.newPage();
        const errors2 = [];
        page2.on('pageerror', (e) => errors2.push('pageerror: ' + e.message));
        page2.on('dialog', (d) => d.accept());
        await page2.route('**', (route) => {
            const u = route.request().url();
            if (u.indexOf('/license-verify.js') !== -1) return route.fulfill({ status: 200, contentType: 'application/javascript', body: LICENSE_STUB });
            if (u.startsWith('http://127.0.0.1:' + port)) return route.continue();
            return route.abort();
        });
        const goodA = { id: 'good_a', phone: '011000901', scanDate: D, cod: 5, dod: 0, count: 1, barcode: 'G1', time: '09:10', isClosed: false, barcodes: [{ code: 'G1', cod: 5, dod: 0, isClosed: false, time: '09:10' }] };
        const goodB = { id: 'good_b', phone: '011000902', scanDate: D, cod: 3, dod: 1, count: 1, barcode: 'G2', time: '09:11', isClosed: false, barcodes: [{ code: 'G2', cod: 3, dod: 1, isClosed: false, time: '09:11' }] };
        const goodTrash = { id: 'good_t', phone: '011000903', scanDate: D, cod: 2, dod: 0, count: 1, barcode: 'T1', time: '09:12', isClosed: false, trashReason: 'delete', isFromDeletion: true, deletedAt: Date.now(), barcodes: [{ code: 'T1', cod: 2, dod: 0, isClosed: false }] };
        await page2.addInitScript(`window.localStorage.setItem('zoew_firebase_config', ${JSON.stringify(JSON.stringify({ apiKey: 'k', databaseURL: 'https://fake-default-rtdb.firebaseio.com', projectId: 'p' }))});`);
        await page2.addInitScript('(' + FAKE_SDK.toString() + ')(' + JSON.stringify(seedData({
            zoew_scan_history_cod_dod: { good_a: goodA, junk_text: 'junk', junk_number: 5, good_b: goodB, junk_bool: true },
            zoew_recently_deleted_cod_dod: { good_t: goodTrash, junk_trash: 'x' }
        })) + ');');
        await page2.goto('http://127.0.0.1:' + port + '/', { waitUntil: 'domcontentloaded', timeout: 20000 });
        await page2.waitForTimeout(2500);
        const prim = await page2.evaluate(() => {
            const stale = (k) => (typeof window.dbListenerViewIsStale === 'function' ? window.dbListenerViewIsStale(k) : 'n/a');
            return {
                seeded: typeof (window.__fakeStore.zoew_scan_history_cod_dod || {}).junk_text === 'string',
                listenerErrs: window.__errs || [],
                historyStale: stale('history'),
                deletedStale: stale('deleted'),
                history: (window.scanHistory || []).map((i) => (i && typeof i === 'object' ? i.id : typeof i)),
                trash: (window.deletedItems || []).map((i) => (i && typeof i === 'object' ? i.id : typeof i))
            };
        });
        check(prim.seeded, app + ': primitive ៖ ស្ថានភាពចាប់ផ្តើម — record string ស្ថិតក្នុង store (លក្ខខណ្ឌចាំបាច់)', JSON.stringify(prim));
        check(prim.listenerErrs.length === 0, app + ': primitive ៖ listener history/ធុងសំរាម មិន throw', JSON.stringify(prim.listenerErrs).slice(0, 300));
        check(prim.historyStale === false && prim.deletedStale === false,
            app + ': primitive ៖ ទិដ្ឋភាព history/ធុងសំរាម មិនជាប់ «វាស់មិនបាន»', 'history=' + prim.historyStale + ' deleted=' + prim.deletedStale);
        check(prim.history.length === 2 && prim.history.indexOf('good_a') !== -1 && prim.history.indexOf('good_b') !== -1,
            app + ': primitive ៖ record ល្អ ២ នៅក្នុងប្រវត្តិ ហើយ primitive ត្រូវរំលង', JSON.stringify(prim.history));
        check(prim.trash.length === 1 && prim.trash[0] === 'good_t',
            app + ': primitive ៖ record ល្អក្នុងធុងសំរាមនៅ ហើយ primitive ត្រូវរំលង', JSON.stringify(prim.trash));
        await page2.evaluate(() => { const b = document.getElementById('btnFilterAll'); if (b) b.click(); else window.filterDataByDate('all'); });
        await page2.waitForTimeout(500);
        const primRows = await page2.evaluate(() => document.querySelectorAll('#historyTableBody tr[data-id]').length);
        check(primRows === 2, app + ': primitive ៖ តារាងគូរជួរដេកល្អ ២', 'rows=' + primRows);
        const real2 = errors2.filter((e) => !/net::ERR_FAILED|Failed to load resource|ERR_BLOCKED|ERR_ABORTED/i.test(e));
        check(real2.length === 0, app + ': primitive ៖ គ្មានកំហុស runtime', real2.slice(0, 4).join('\n        '));
        await ctx2.close();
        server.close();
    }
    await browser.close();
    console.log('\n' + (fail ? 'FAIL ' + fail + ' / ជោគជ័យ ' + pass : 'PASS ' + pass + '/' + pass));
    process.exit(fail ? 1 : 0);
})();
