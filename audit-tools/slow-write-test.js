let chromium;
try { chromium = require('playwright-core').chromium; } catch (e) {
    console.log('SKIP — ត្រូវការ playwright-core (npm i playwright-core)');
    process.exit(0);
}
const CHROME = process.env.SLOWWRITE_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const fs = require('fs');
const http = require('http');
const path = require('path');

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

if (!fs.existsSync(CHROME)) {
    console.log('SKIP — រកមិនឃើញ Chromium នៅ ' + CHROME);
    process.exit(0);
}
const ROOT = process.env.SLOWWRITE_APP_DIR || path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm' };

let pass = 0, fail = 0;
function ok(name) { console.log('  ok    ' + name); pass++; }
function bad(name, detail) { console.log('  FAIL  ' + name + (detail ? '\n        ' + detail : '')); fail++; }
function check(cond, name, detail) { cond ? ok(name) : bad(name, detail); }

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
    setServerTimeOffset: function () {},
    syncServerTime: function () { return Promise.resolve(); },
    activate: function () { return Promise.resolve({ ok: true }); },
    verifyKeyString: function () { return Promise.resolve({ ok: true }); },
    clearActivation: function () {}
};`;

const BOOT = function (seed) {
    const rawSetTimeout = window.setTimeout.bind(window);
    window.__rawSetTimeout = rawSetTimeout;
    const SCALE = 100;
    window.setTimeout = function (fn, ms) {
        const d = (typeof ms === 'number' && ms >= 1000) ? Math.max(1, Math.round(ms / SCALE)) : ms;
        return rawSetTimeout(fn, d);
    };
    const rawSetInterval = window.setInterval.bind(window);
    window.setInterval = function (fn, ms) {
        const d = (typeof ms === 'number' && ms >= 1000) ? Math.max(5, Math.round(ms / SCALE)) : ms;
        return rawSetInterval(fn, d);
    };

    const store = JSON.parse(JSON.stringify(seed));
    window.__fakeStore = store;
    window.__slow = [];
    window.__toasts = [];
    const listeners = [];

    function getPath(p) {
        if (!p || p === '/') return store;
        const parts = p.split('/').filter(Boolean);
        let cur = store;
        for (const part of parts) {
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
        const copy = () => (v === undefined || v === null) ? null : (typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v);
        return { val: copy, exists: () => v !== null && v !== undefined };
    }
    function fire(p) {
        listeners.filter((l) => l.path === p).forEach((l) => { try { l.cb(snapOf(p)); } catch (e) { window.__listenerThrew = String(e && e.message); } });
    }
    function fireAll() { [...new Set(listeners.map((l) => l.path))].forEach(fire); }
    // Firebase ពិតបាញ់តែ listener ដែល node របស់វា **ពាក់ព័ន្ធ** នឹង path ដែលប្រែ
    // (ដូនតា ឬកូនចៅ)។ `fireAll()` ដែលបាញ់គ្រប់ listener ធ្វើឲ្យ projection
    // ក្នុងសតិស្តារខ្លួនភ្លាមក្រោយការសរសេរ **ណាមួយ** ➜ តេស្តជោគជ័យក្លែងក្លាយ
    // លើថ្នាក់កំហុស «rollback ស្តារ snapshot ចាស់»។
    function fireFor(changedPath) {
        const cp = String(changedPath || '');
        if (!cp) return fireAll();
        [...new Set(listeners.map((l) => l.path))].forEach((lp) => {
            if (!lp) { fire(lp); return; }
            if (cp === lp || cp.indexOf(lp + '/') === 0 || lp.indexOf(cp + '/') === 0) fire(lp);
        });
    }
    window.__setPathSilent = (p, v) => setPath(p, v);

    // delay in REAL ms, using the unscaled timer, so "lands after the app's timeout" is exact
    function slowFor(p) {
        const hit = window.__slow.find((s) => String(p).indexOf(s.match) === 0);
        return hit ? hit.landAfterMs : 0;
    }
    function failFor(p) {
        const hit = window.__slow.find((s) => String(p).indexOf(s.match) === 0 && s.failAfterMs);
        return hit ? hit.failAfterMs : 0;
    }
    function maybeDefer(p, apply) {
        const f = failFor(p);
        if (f) return new Promise((_, reject) => {
            rawSetTimeout(() => reject(new Error('simulated write failure')), f);
        });
        const d = slowFor(p);
        if (!d) return Promise.resolve(apply());
        return new Promise((resolve) => { rawSetTimeout(() => resolve(apply()), d); });
    }
    // ការសរសេររបស់ **ឧបករណ៍ផ្សេង** ដែលមកដល់កណ្តាលការរង់ចាំរបស់យើង
    window.__pushFromOtherDevice = (p, v) => { setPath(p, v); fireFor(p); };

    const user = { uid: 'admin-uid', email: 'a@b.c', getIdToken: () => Promise.resolve('tok'), metadata: { lastSignInTime: new Date().toISOString() } };
    window.firebaseSDK = {
        initializeApp: () => ({ name: 'fake' }),
        getApps: () => [],
        deleteApp: () => Promise.resolve(),
        getAuth: () => ({ currentUser: user }),
        onAuthStateChanged: (a, cb) => { rawSetTimeout(() => cb(user), 0); return () => {}; },
        signInWithEmailAndPassword: () => Promise.resolve({ user }),
        signOut: () => Promise.resolve(),
        setPersistence: () => Promise.resolve(),
        browserLocalPersistence: {}, browserSessionPersistence: {},
        getIdTokenResult: () => Promise.resolve({ authTime: new Date().toISOString(), claims: {} }),
        getDatabase: () => ({ fake: true }),
        ref: (d, p) => ({ path: p === undefined ? '' : String(p) }),
        onValue: (r, cb) => {
            listeners.push({ path: r.path, cb });
            rawSetTimeout(() => { if (r.path === '.info/connected') cb({ val: () => true }); else cb(snapOf(r.path)); }, 0);
            return () => {};
        },
        off: () => {},
        get: (r) => Promise.resolve(snapOf(r.path)),
        set: (r, v) => maybeDefer(r.path, () => { setPath(r.path, v); fireFor(r.path); }),
        update: (r, obj) => maybeDefer(r.path, () => {
            const touched = [];
            Object.keys(obj).forEach((k) => {
                const full = (r.path ? r.path + '/' : '') + k;
                setPath(full, obj[k]);
                touched.push(full);
            });
            touched.forEach(fireFor);
        }),
        goOnline: () => {},
        runTransaction: (r, fn) => maybeDefer(r.path, () => {
            const cur = getPath(r.path);
            const next = fn(cur === null ? null : JSON.parse(JSON.stringify(cur)));
            if (next === undefined) return { committed: false, snapshot: snapOf(r.path) };
            setPath(r.path, next); fireFor(r.path);
            return { committed: true, snapshot: snapOf(r.path) };
        })
    };
    window.dispatchEvent(new Event('firebasesdkready'));
};

function seedData() {
    const today = new Date();
    const d = zoneDateKey(Date.now(), 0);
    return {
        user_roles: { 'admin-uid': 'admin' },
        zoew_scan_history_cod_dod: {},
        zoew_recently_deleted_cod_dod: {},
        zoew_daily_revenue_cod_dod: { [d]: { codDollar: 0, dodDollar: 0, totalCount: 0 } },
        zoew_monthly_revenue_cod_dod: {},
        zoew_daily_pickup_cod_dod: {},
        zoew_scanner_lookup: {},
        zoew_barcode_registry: {},
        zoew_settings: { exchange_rate: 4100 },
        _dateKey: d
    };
}

async function scanOnce(page, code) {
    await page.evaluate((c) => {
        window.triggerScanAction(c);
    }, code);
    await page.waitForTimeout(120);
    await page.evaluate(() => {
        const p = document.getElementById('modalPhoneInput'); if (p) p.value = '0961112223';
        const c = document.getElementById('modalCodInput'); if (c) c.value = '10';
        const d = document.getElementById('modalDodInput'); if (d) d.value = '0';
    });
    return page.evaluate(() => {
        return Promise.resolve(window.confirmPhone()).then(() => 'ok', (e) => 'err:' + (e && e.message));
    });
}

(async () => {
    const browser = await chromium.launch({ executablePath: CHROME });
    const dir = path.join(ROOT, 'ZoeW');
    const server = await serve(dir);
    const port = server.address().port;

    // ---------- Scenario A: the registry claim times out, then commits late ----------
    {
        const ctx = await browser.newContext({ viewport: { width: 412, height: 780 } });
        const page = await ctx.newPage();
        page.on('dialog', (d) => d.accept());
        await page.route('**', (route) => {
            const u = route.request().url();
            if (u.indexOf('/license-verify.js') !== -1) return route.fulfill({ status: 200, contentType: 'application/javascript', body: LICENSE_STUB });
            if (u.startsWith('http://127.0.0.1:' + port)) return route.continue();
            return route.abort();
        });
        const seed = seedData();
        await page.addInitScript(`window.localStorage.setItem('zoew_firebase_config', ${JSON.stringify(JSON.stringify({ apiKey: 'k', databaseURL: 'https://fake-default-rtdb.firebaseio.com', projectId: 'p' }))});`);
        await page.addInitScript('(' + BOOT.toString() + ')(' + JSON.stringify(seed) + ');');
        await page.goto('http://127.0.0.1:' + port + '/', { waitUntil: 'domcontentloaded', timeout: 20000 });
        await page.waitForTimeout(2000);

        // withTimeout(claim, 15000) -> 150ms real. Make the claim land at 600ms real.
        await page.evaluate(() => { window.__slow = [{ match: 'zoew_barcode_registry', landAfterMs: 600 }]; });
        const res = await scanOnce(page, 'SLOWCLAIM1');
        check(String(res).indexOf('err') === 0 || String(res) === 'ok', 'A: confirmPhone ត្រឡប់មកវិញ (មិនព្យួរ)', String(res));
        await page.waitForTimeout(1500);

        const st = await page.evaluate(() => {
            const s = window.__fakeStore;
            const reg = s.zoew_barcode_registry || {};
            const hist = s.zoew_scan_history_cod_dod || {};
            const used = Object.keys(hist).some((k) => (hist[k].barcodes || []).some((b) => b && b.code === 'SLOWCLAIM1'));
            return { claimed: reg.SLOWCLAIM1 === true, parcelExists: used, regKeys: Object.keys(reg) };
        });
        check(!(st.claimed && !st.parcelExists),
            'A: claim ដែល timeout រួច commit យឺត ➜ មិនទុក barcode ជាប់សោដោយគ្មានកញ្ចប់',
            JSON.stringify(st));

        // the worker retries the very same barcode — it must not be refused forever
        await page.evaluate(() => { window.__slow = []; });
        const res2 = await scanOnce(page, 'SLOWCLAIM1');
        await page.waitForTimeout(400);
        const st2 = await page.evaluate(() => {
            const s = window.__fakeStore;
            const hist = s.zoew_scan_history_cod_dod || {};
            const used = Object.keys(hist).some((k) => (hist[k].barcodes || []).some((b) => b && b.code === 'SLOWCLAIM1'));
            return { parcelExists: used, res: null };
        });
        check(st2.parcelExists, 'A: ការស្កេនម្តងទៀតលើ barcode ដដែល ➜ បញ្ចូលបានជោគជ័យ', JSON.stringify(st2) + ' res2=' + res2);

        await ctx.close();
    }

    // ---------- Scenario B: the save times out, then lands late ----------
    {
        const ctx = await browser.newContext({ viewport: { width: 412, height: 780 } });
        const page = await ctx.newPage();
        page.on('dialog', (d) => d.accept());
        await page.route('**', (route) => {
            const u = route.request().url();
            if (u.indexOf('/license-verify.js') !== -1) return route.fulfill({ status: 200, contentType: 'application/javascript', body: LICENSE_STUB });
            if (u.startsWith('http://127.0.0.1:' + port)) return route.continue();
            return route.abort();
        });
        const seed = seedData();
        await page.addInitScript(`window.localStorage.setItem('zoew_firebase_config', ${JSON.stringify(JSON.stringify({ apiKey: 'k', databaseURL: 'https://fake-default-rtdb.firebaseio.com', projectId: 'p' }))});`);
        await page.addInitScript('(' + BOOT.toString() + ')(' + JSON.stringify(seed) + ');');
        await page.goto('http://127.0.0.1:' + port + '/', { waitUntil: 'domcontentloaded', timeout: 20000 });
        await page.waitForTimeout(2000);

        await page.evaluate(() => { window.__slow = [{ match: 'zoew_scan_history_cod_dod', landAfterMs: 600 }]; });
        await scanOnce(page, 'SLOWSAVE1');
        await page.waitForTimeout(1500);

        const st = await page.evaluate(() => {
            const s = window.__fakeStore;
            const reg = s.zoew_barcode_registry || {};
            const hist = s.zoew_scan_history_cod_dod || {};
            const used = Object.keys(hist).some((k) => (hist[k].barcodes || []).some((b) => b && b.code === 'SLOWSAVE1'));
            return { parcelExists: used, claimed: reg.SLOWSAVE1 === true };
        });
        check(!(st.parcelExists && !st.claimed),
            'B: save ដែល timeout រួចចុះយឺត ➜ claim មិនត្រូវដោះចេញខណៈកញ្ចប់មានពិត',
            JSON.stringify(st));

        const dk = seed._dateKey;
        const rev = await page.evaluate((k) => {
            const r = (window.__fakeStore.zoew_daily_revenue_cod_dod || {})[k] || {};
            const hist = window.__fakeStore.zoew_scan_history_cod_dod || {};
            let sum = 0; Object.keys(hist).forEach((id) => (hist[id].barcodes || []).forEach((b) => { sum += parseFloat(b.cod) || 0; }));
            return { revenue: r.codDollar, itemSum: sum, count: r.totalCount };
        }, dk);
        check(rev.revenue === rev.itemSum, 'B: ចំណូលប្រចាំថ្ងៃ ស្មើនឹងផលបូក barcode ពិត', JSON.stringify(rev));

        await ctx.close();
    }

    // ---------- Scenario C: the barcode is already in the order server-side (listener lagging) ----------
    {
        const ctx = await browser.newContext({ viewport: { width: 412, height: 780 } });
        const page = await ctx.newPage();
        page.on('dialog', (d) => d.accept());
        await page.route('**', (route) => {
            const u = route.request().url();
            if (u.indexOf('/license-verify.js') !== -1) return route.fulfill({ status: 200, contentType: 'application/javascript', body: LICENSE_STUB });
            if (u.startsWith('http://127.0.0.1:' + port)) return route.continue();
            return route.abort();
        });
        const seed = seedData();
        const dk = seed._dateKey;
        seed.zoew_scan_history_cod_dod = {
            it_x: {
                id: 'it_x', phone: '0961112223', scanDate: dk, createdAt: Date.now() - 5000,
                cod: 4, dod: 0, price: 4, count: 1, barcode: 'OLD1', time: '10:00', isClosed: false,
                barcodes: [{ code: 'OLD1', time: '10:00', cod: 4, dod: 0, locker: 'A1', isClosed: false, isDeducted: false, isFromDeletion: false, createdAt: Date.now() - 5000 }]
            }
        };
        seed.zoew_daily_revenue_cod_dod = { [dk]: { codDollar: 4, dodDollar: 0, totalCount: 1 } };
        await page.addInitScript(`window.localStorage.setItem('zoew_firebase_config', ${JSON.stringify(JSON.stringify({ apiKey: 'k', databaseURL: 'https://fake-default-rtdb.firebaseio.com', projectId: 'p' }))});`);
        await page.addInitScript('(' + BOOT.toString() + ')(' + JSON.stringify(seed) + ');');
        await page.goto('http://127.0.0.1:' + port + '/', { waitUntil: 'domcontentloaded', timeout: 20000 });
        await page.waitForTimeout(2000);

        // another device adds DUP1 to the same order; our listener has not delivered it yet
        await page.evaluate(() => {
            window.__setPathSilent('zoew_scan_history_cod_dod/it_x/barcodes/1', {
                code: 'DUP1', time: '10:05', cod: 4, dod: 0, locker: 'A1',
                isClosed: false, isDeducted: false, isFromDeletion: false, createdAt: Date.now()
            });
            window.__setPathSilent('zoew_scan_history_cod_dod/it_x/count', 2);
            window.__setPathSilent('zoew_scan_history_cod_dod/it_x/cod', 8);
            window.__setPathSilent('zoew_daily_revenue_cod_dod/' + Object.keys(window.__fakeStore.zoew_daily_revenue_cod_dod)[0] + '/codDollar', 8);
            window.__setPathSilent('zoew_daily_revenue_cod_dod/' + Object.keys(window.__fakeStore.zoew_daily_revenue_cod_dod)[0] + '/totalCount', 2);
        });

        await scanOnce(page, 'DUP1');
        await page.waitForTimeout(500);

        const st = await page.evaluate((k) => {
            const s = window.__fakeStore;
            const it = s.zoew_scan_history_cod_dod.it_x;
            const bcs = (it && it.barcodes) ? (Array.isArray(it.barcodes) ? it.barcodes : Object.values(it.barcodes)).filter(Boolean) : [];
            const rev = (s.zoew_daily_revenue_cod_dod || {})[k] || {};
            const sum = Math.round(bcs.reduce((a, b) => a + (parseFloat(b.cod) || 0), 0) * 100) / 100;
            return { codes: bcs.map((b) => b.code), sum, revenue: parseFloat(rev.codDollar) || 0, count: parseFloat(rev.totalCount) || 0 };
        }, dk);
        check(st.revenue === st.sum && st.count === st.codes.length,
            'C: ស្កេន barcode ដែលមានស្រាប់លើ server ➜ ចំណូលមិនត្រូវបូកស្ទួន',
            JSON.stringify(st));

        // an empty pendingBarcode must never be able to create a record
        const emptyRes = await page.evaluate(() => {
            const before = Object.keys(window.__fakeStore.zoew_scan_history_cod_dod || {}).length;
            const p = document.getElementById('modalPhoneInput'); if (p) p.value = '0999888777';
            const c = document.getElementById('modalCodInput'); if (c) c.value = '50';
            return Promise.resolve(window.confirmPhone()).catch(() => {}).then(() => {
                const s = window.__fakeStore.zoew_scan_history_cod_dod || {};
                const blank = Object.keys(s).some((id) => {
                    const b = s[id].barcodes;
                    const arr = Array.isArray(b) ? b : (b ? Object.values(b) : []);
                    return arr.some((x) => x && !x.code) || s[id].barcode === '';
                });
                return { before, after: Object.keys(s).length, blank };
            });
        });
        await page.waitForTimeout(300);
        check(!emptyRes.blank, 'C: confirmPhone គ្មាន barcode ➜ មិនបង្កើត record ទទេ', JSON.stringify(emptyRes));

        const rev2 = await page.evaluate((k) => {
            const s = window.__fakeStore;
            let sum = 0, n = 0;
            Object.values(s.zoew_scan_history_cod_dod || {}).forEach((it) => {
                const b = it.barcodes; const arr = Array.isArray(b) ? b : (b ? Object.values(b) : []);
                arr.filter(Boolean).forEach((x) => { sum += parseFloat(x.cod) || 0; n++; });
            });
            const rev = (s.zoew_daily_revenue_cod_dod || {})[k] || {};
            return { sum: Math.round(sum * 100) / 100, revenue: parseFloat(rev.codDollar) || 0, n, count: parseFloat(rev.totalCount) || 0 };
        }, dk);
        check(rev2.sum === rev2.revenue && rev2.n === rev2.count, 'C: ចំណូលនៅតែស្មើផលបូក barcode ពិត', JSON.stringify(rev2));

        await ctx.close();
    }

    // === D — ការសរសេររបស់ឧបករណ៍ផ្សេងមកដល់កណ្តាលការរក្សាទុកដែលធ្លាក់ ===
    // ថ្នាក់កំហុស៖ rollback ដែលស្តារ **array ទាំងមូល** ពី snapshot ដែលថត
    // **មុន** await ➜ វាលុបការងាររបស់ឧបករណ៍ផ្សេងចេញពីអេក្រង់។ នេះជាថ្នាក់
    // ដដែលនឹង «សរសេរ item ទាំងមូលពីច្បាប់ចម្លងក្នុងសតិ» តែលើ projection
    // ក្នុងសតិ ដូច្នេះ `stale-write.js` (ដែលពិនិត្យការសរសេរទៅ Firebase) មិនចាប់។
    {
        const ctx = await browser.newContext({ viewport: { width: 412, height: 780 } });
        const page = await ctx.newPage();
        page.on('dialog', (d) => d.accept());
        await page.route('**', (r) => {
            const u = r.request().url();
            if (u.indexOf('/license-verify.js') !== -1) return r.fulfill({ status: 200, contentType: 'application/javascript', body: LICENSE_STUB });
            if (u.startsWith('http://127.0.0.1:' + port)) return r.continue();
            return r.abort();
        });
        await page.addInitScript(`window.localStorage.setItem('zoew_firebase_config', ${JSON.stringify(JSON.stringify({ apiKey: 'k', databaseURL: 'https://fake-default-rtdb.firebaseio.com', projectId: 'p' }))});`);
        await page.addInitScript('(' + BOOT.toString() + ')(' + JSON.stringify(seedData()) + ');');
        await page.goto('http://127.0.0.1:' + port + '/', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForFunction(() => typeof window.confirmPhone === 'function', null, { timeout: 30000 });
        await page.waitForTimeout(400);

        // `pendingBarcode` ជា module `let` ➜ **មិនស្ថិតលើ window**។ ត្រូវឆ្លងកាត់
        // `triggerScanAction()` ដូចអ្នកប្រើពិត បើមិនដូច្នេះ `confirmPhone()`
        // ចាកចេញមុនដោយ «សូមស្កេនម្ដងទៀត» ➜ តេស្តជោគជ័យក្លែងក្លាយ។
        await page.evaluate((c) => window.triggerScanAction(c), 'RACE_D_0001');
        await page.waitForTimeout(200);

        const out = await page.evaluate(async () => {
            const wait = (ms) => new Promise((x) => window.__rawSetTimeout(x, ms));
            // ការរក្សាទុកទៅ history នឹង **ធ្លាក់** ក្រោយ 300ms
            window.__slow = [{ match: 'zoew_scan_history_cod_dod', failAfterMs: 300 }];
            const p = document.getElementById('modalPhoneInput'); if (p) p.value = '0777111222';
            const c = document.getElementById('modalCodInput'); if (c) c.value = '9';
            const d = document.getElementById('modalDodInput'); if (d) d.value = '0';
            const settled = Promise.resolve(window.confirmPhone()).then(() => 'ok', (e) => 'err');
            // កណ្តាលការរង់ចាំ ➜ ឧបករណ៍ផ្សេងបញ្ចូលកញ្ចប់ថ្មី
            await wait(120);
            window.__pushFromOtherDevice('zoew_scan_history_cod_dod/other_device_item', {
                id: 'other_device_item', phone: '0999000111', scanDate: (window.__fakeStore._dateKey || ''),
                createdAt: Date.now(), cod: 3, dod: 0, price: 3, count: 1, barcode: 'OTHERDEV1',
                time: '11:11', isClosed: false,
                barcodes: [{ code: 'OTHERDEV1', time: '11:11', cod: 3, dod: 0, locker: 'N/A', isClosed: false, isDeducted: false, isFromDeletion: false, createdAt: Date.now() }]
            });
            const res = await settled;
            await wait(250);
            window.__slow = [];
            const ids = (typeof scanHistory !== 'undefined' ? scanHistory : []).map((i) => i && i.id);
            const codes = [];
            (typeof scanHistory !== 'undefined' ? scanHistory : []).forEach((i) => {
                (Array.isArray(i && i.barcodes) ? i.barcodes : []).forEach((b) => b && codes.push(b.code));
            });
            return { res, ids, codes, onServer: Object.keys(window.__fakeStore.zoew_scan_history_cod_dod || {}) };
        });

        check(out.ids.indexOf('other_device_item') !== -1,
            'D: ការរក្សាទុកធ្លាក់ ➜ កញ្ចប់របស់ឧបករណ៍ផ្សេង **មិនត្រូវលុបចេញពីអេក្រង់**',
            JSON.stringify(out));
        check(out.codes.indexOf('RACE_D_0001') === -1,
            'D: ការរក្សាទុកធ្លាក់ ➜ barcode ដែលធ្លាក់ត្រូវដកចេញពីអេក្រង់',
            JSON.stringify(out.codes));
        check(out.onServer.indexOf('other_device_item') !== -1,
            'D: ទិន្នន័យលើ server របស់ឧបករណ៍ផ្សេងនៅដដែល', JSON.stringify(out.onServer));
        await ctx.close();
    }

    server.close();
    await browser.close();
    console.log('\n' + (fail ? 'FAIL ' + fail + ' / ជោគជ័យ ' + pass : 'PASS ' + pass + '/' + pass));
    process.exit(fail ? 1 : 0);
})();
