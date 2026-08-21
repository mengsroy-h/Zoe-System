let chromium;
try { chromium = require('playwright-core').chromium; } catch (e) {
    console.log('SKIP — ត្រូវការ playwright-core (npm i playwright-core)');
    process.exit(0);
}
const CHROME = process.env.UIFLOW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const fs = require('fs');
const http = require('http');
const path = require('path');
if (!fs.existsSync(CHROME)) {
    console.log('SKIP — រកមិនឃើញ Chromium នៅ ' + CHROME);
    process.exit(0);
}
const ROOT = process.env.UIFLOW_APP_DIR || path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json' };

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

const FAKE_SDK = function (seed) {
    const store = JSON.parse(JSON.stringify(seed));
    window.__fakeStore = store;
    window.__writeLog = [];
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
        if (!parts.length) { return; }
        let cur = store;
        for (let i = 0; i < parts.length - 1; i++) {
            if (cur[parts[i]] === null || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
            cur = cur[parts[i]];
        }
        const last = parts[parts.length - 1];
        if (val === null) {
            delete cur[last];
        } else if (val && typeof val === 'object' && Object.prototype.hasOwnProperty.call(val, '__fakeIncrement')) {
            const current = Number(cur[last]);
            cur[last] = (Number.isFinite(current) ? current : 0) + Number(val.__fakeIncrement);
        } else {
            cur[last] = JSON.parse(JSON.stringify(val));
        }
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
    window.__fireAll = fireAll;
    window.__setPath = (p, v) => { setPath(p, v); fire(p); };

    const user = { uid: 'admin-uid', email: 'a@b.c', getIdToken: () => Promise.resolve('tok'), metadata: { lastSignInTime: new Date().toISOString() } };
    window.firebaseSDK = {
        initializeApp: () => ({ name: 'fake' }),
        getApps: () => [],
        deleteApp: () => Promise.resolve(),
        getAuth: () => ({ currentUser: user }),
        onAuthStateChanged: (a, cb) => { setTimeout(() => cb(user), 0); return () => {}; },
        signInWithEmailAndPassword: () => Promise.resolve({ user }),
        signOut: () => Promise.resolve(),
        setPersistence: () => Promise.resolve(),
        browserLocalPersistence: {}, browserSessionPersistence: {},
        getIdTokenResult: () => Promise.resolve({ authTime: new Date().toISOString(), claims: {} }),
        getDatabase: () => ({ fake: true }),
        ref: (d, p) => ({ path: p === undefined ? '' : String(p) }),
        onValue: (r, cb) => {
            listeners.push({ path: r.path, cb });
            setTimeout(() => { if (r.path === '.info/connected') cb({ val: () => true }); else cb(snapOf(r.path)); }, 0);
            return () => {};
        },
        off: () => {},
        get: (r) => Promise.resolve(snapOf(r.path)),
        set: (r, v) => { window.__writeLog.push({ op: 'set', path: r.path }); setPath(r.path, v); fireAll(); return Promise.resolve(); },
        update: (r, obj) => {
            window.__writeLog.push({ op: 'update', path: r.path, keys: Object.keys(obj) });
            Object.keys(obj).forEach((k) => setPath((r.path ? r.path + '/' : '') + k, obj[k]));
            fireAll(); return Promise.resolve();
        },
        goOnline: () => {},
        increment: (amount) => ({ __fakeIncrement: Number(amount) }),
        runTransaction: (r, fn) => {
            window.__writeLog.push({ op: 'txn', path: r.path });
            let cur = getPath(r.path);
            let next = fn(cur === null ? null : JSON.parse(JSON.stringify(cur)));
            if (next === undefined) return Promise.resolve({ committed: false, snapshot: snapOf(r.path) });
            const conflict = window.__txnConflict;
            if (conflict && String(r.path).indexOf(conflict.path) === 0) {
                window.__txnConflict = null;
                conflict.mutate(getPath(r.path));
                cur = getPath(r.path);
                next = fn(cur === null ? null : JSON.parse(JSON.stringify(cur)));
                if (next === undefined) return Promise.resolve({ committed: false, snapshot: snapOf(r.path) });
            }
            setPath(r.path, next); fireAll();
            return Promise.resolve({ committed: true, snapshot: snapOf(r.path) });
        }
    };
    window.dispatchEvent(new Event('firebasesdkready'));
};

function seedData() {
    const today = new Date();
    const d = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
    return {
        user_roles: { 'admin-uid': 'admin' },
        zoew_scan_history_cod_dod: {
            id_1000_aaa: {
                id: 'id_1000_aaa', phone: '0968490421', scanDate: d, createdAt: Date.now() - 1000,
                cod: 30, dod: 0, price: 30, count: 2, barcode: 'BB2', time: '10:00', isClosed: false,
                barcodes: [
                    { code: 'BB1', time: '09:00', cod: 10, dod: 0, locker: 'A1', isClosed: false, isDeducted: false, isFromDeletion: false, createdAt: Date.now() - 2000 },
                    { code: 'BB2', time: '10:00', cod: 20, dod: 0, locker: 'A2', isClosed: false, isDeducted: false, isFromDeletion: false, createdAt: Date.now() - 1000 }
                ]
            },
            id_1001_bbb: {
                id: 'id_1001_bbb', phone: '0777123456', scanDate: d, createdAt: Date.now() - 500,
                cod: 5, dod: 2, price: 7, count: 1, barcode: 'CC1', time: '11:00', isClosed: false,
                barcodes: [{ code: 'CC1', time: '11:00', cod: 5, dod: 2, locker: 'B1', isClosed: false, isDeducted: false, isFromDeletion: false, createdAt: Date.now() - 500 }]
            }
        },
        zoew_recently_deleted_cod_dod: {},
        zoew_daily_revenue_cod_dod: { [d]: { codDollar: 35, dodDollar: 2, totalCount: 3 } },
        zoew_monthly_revenue_cod_dod: {},
        zoew_daily_pickup_cod_dod: {},
        zoew_scanner_lookup: {
            id_1000_aaa: {
                phone: '0968490421', barcode: 'BB2', isClosed: false,
                barcodes: [
                    { code: 'BB1', cod: 10, dod: 0, locker: 'A1', isClosed: false },
                    { code: 'BB2', cod: 20, dod: 0, locker: 'N/A', isClosed: false }
                ]
            },
            id_1001_bbb: { phone: '0777123456', barcode: 'CC1', isClosed: false, barcodes: [{ code: 'CC1', cod: 5, dod: 2, locker: 'A1', isClosed: true }] }
        },
        zoew_barcode_registry: {},
        zoew_settings: { exchange_rate: 4100 },
        _dateKey: d
    };
}

(async () => {
    const browser = await chromium.launch({ executablePath: CHROME });
    for (const app of ['ZoeAdmin', 'ZoeW', 'Zoescan']) {
        console.log('\n=== ' + app + ' ===');
        const dir = path.join(ROOT, app);
        const server = await serve(dir);
        const port = server.address().port;
        const ctx = await browser.newContext({ viewport: { width: 412, height: 780 } });
        const page = await ctx.newPage();
        const errors = [];
        page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
        page.on('console', (m) => { if (m.type() === 'error') errors.push('console.error: ' + m.text().slice(0, 300)); });
        page.on('dialog', (d) => d.accept());
        await page.route('**', (route) => {
            const u = route.request().url();
            if (u.indexOf('/license-verify.js') !== -1) {
                return route.fulfill({ status: 200, contentType: 'application/javascript', body: LICENSE_STUB });
            }
            if (u.startsWith('http://127.0.0.1:' + port)) return route.continue();
            return route.abort();
        });
        const seed = seedData();
        await page.addInitScript(`window.localStorage.setItem('zoew_firebase_config', ${JSON.stringify(JSON.stringify({ apiKey: 'k', databaseURL: 'https://fake-default-rtdb.firebaseio.com', projectId: 'p' }))});`);
        await page.addInitScript('(' + FAKE_SDK.toString() + ')(' + JSON.stringify(seed) + ');');
        await page.goto('http://127.0.0.1:' + port + '/', { waitUntil: 'domcontentloaded', timeout: 20000 });
        await page.waitForTimeout(2500);

        if (app === 'Zoescan') {
            await page.waitForTimeout(800);
            const zs = await page.evaluate(() => ({
                listenerThrew: window.__listenerThrew || null,
                indexed: Object.keys(typeof barcodeIndex !== 'undefined' ? barcodeIndex : {}).sort(),
                openModals: [...document.querySelectorAll('.modal')].filter((m) => getComputedStyle(m).display !== 'none').map((m) => m.id)
            }));
            check(!zs.listenerThrew, 'Zoescan: listener មិន throw ពេល boot', zs.listenerThrew);
            check(zs.indexed.join(',') === 'BB1,BB2,CC1', 'Zoescan: index barcode គ្រប់គ្រាន់ពី lookup', JSON.stringify(zs));

            // ទីតាំង A1 មាន BB1 (បើក) និង CC1 (បិទរួច) ➜ CC1 មិនត្រូវរាប់ថាកាន់ទីតាំង
            const occ = await page.evaluate(() => {
                const f = window.findLockerOccupant('A1', 'BB2');
                return f ? { code: f.code, itemId: f.itemId } : null;
            });
            check(occ && occ.code === 'BB1', 'Zoescan: ការព្រមានទីតាំង ➜ រំលងកញ្ចប់ដែលយកហើយ', JSON.stringify(occ));

            const occSelf = await page.evaluate(() => {
                const f = window.findLockerOccupant('A1', 'BB1');
                return f ? { code: f.code } : null;
            });
            check(occSelf === null, 'Zoescan: មិនព្រមានលើ barcode របស់ខ្លួនឯង', JSON.stringify(occSelf));

            const real0 = errors.filter((e) => !/net::ERR_FAILED|Failed to load resource|ERR_BLOCKED|ERR_ABORTED/i.test(e));
            check(real0.length === 0, 'Zoescan: គ្មានកំហុស runtime ពេល boot', real0.slice(0, 3).join(' | '));
            await ctx.close(); server.close(); continue;
        }

        const booted = await page.evaluate(() => ({
            rows: document.querySelectorAll('#historyTableBody tr').length,
            listenerThrew: window.__listenerThrew || null,
            openModals: [...document.querySelectorAll('.modal')].filter((m) => getComputedStyle(m).display !== 'none').map((m) => m.id)
        }));
        check(booted.rows >= 2, app + ': តារាងប្រវត្តិបង្ហាញជួរពីទិន្នន័យ Firebase', 'rows=' + booted.rows + ' modals=' + JSON.stringify(booted.openModals));
        check(!booted.listenerThrew, app + ': listener មិន throw ពេល boot', booted.listenerThrew);

        // --- close a whole order, then verify pickup stat + record agree ---
        await page.evaluate(() => { window.toggleCloseStatus('id_1001_bbb'); });
        await page.waitForTimeout(600);
        const afterClose = await page.evaluate((dk) => {
            const s = window.__fakeStore;
            const item = s.zoew_scan_history_cod_dod.id_1001_bbb;
            const pick = s.zoew_daily_pickup_cod_dod[dk] || {};
            return { isClosed: item && item.isClosed, bClosed: item && item.barcodes[0].isClosed, packages: pick.packagesPickedUp, phones: pick.pickedUpPhones ? Object.keys(pick.pickedUpPhones).length : 0 };
        }, seed._dateKey);
        check(afterClose.isClosed === true && afterClose.bClosed === true, app + ': បិទបញ្ជី ➜ record ក្នុង Firebase បិទពិត', JSON.stringify(afterClose));
        check(afterClose.packages === 1 && afterClose.phones === 1, app + ': បិទបញ្ជី ➜ ស្ថិតិ ១ កញ្ចប់ ១ អតិថិជន', JSON.stringify(afterClose));

        // --- the real race: item vanishes server-side between confirm() and the transaction ---
        await page.evaluate(() => {
            const orig = window.firebaseSDK.runTransaction;
            window.__restoreTxn = () => { window.firebaseSDK.runTransaction = orig; };
            window.firebaseSDK.runTransaction = function (r, fn) {
                if (String(r.path).indexOf('zoew_scan_history_cod_dod/id_1000_aaa') === 0) {
                    delete window.__fakeStore.zoew_scan_history_cod_dod.id_1000_aaa;
                }
                return orig.call(this, r, fn);
            };
        });
        await page.evaluate(() => { window.toggleCloseStatus('id_1000_aaa'); });
        await page.waitForTimeout(600);
        const afterGhost = await page.evaluate((dk) => {
            const p = window.__fakeStore.zoew_daily_pickup_cod_dod[dk] || {};
            return { packages: p.packagesPickedUp || 0, phones: p.pickedUpPhones ? Object.keys(p.pickedUpPhones).length : 0 };
        }, seed._dateKey);
        check(afterGhost.packages === 1 && afterGhost.phones === 1,
            app + ': កញ្ចប់រលាយពី server ➜ ស្ថិតិមិនកើនខុស',
            'រំពឹង packages=1 phones=1 តែបាន ' + JSON.stringify(afterGhost));

        await page.evaluate((dk) => {
            window.__restoreTxn();
            window.__fakeStore.zoew_scan_history_cod_dod.id_3000_ddd = {
                id: 'id_3000_ddd', phone: '0700111222', scanDate: dk, createdAt: Date.now() - 300,
                cod: 30, dod: 0, price: 30, count: 2, barcode: 'EE2', time: '13:00', isClosed: false,
                barcodes: [
                    { code: 'EE1', time: '13:00', cod: 10, dod: 0, locker: 'D1', isClosed: false, isDeducted: false, isFromDeletion: false, createdAt: Date.now() - 300 },
                    { code: 'EE2', time: '13:01', cod: 20, dod: 0, locker: 'D2', isClosed: false, isDeducted: false, isFromDeletion: false, createdAt: Date.now() - 290 }
                ]
            };
            window.__fireAll();
        }, seed._dateKey);
        await page.waitForTimeout(300);

        // លុប ➜ ស្តារ ➜ លុប ➜ ស្តារ ត្រូវតែមិនផ្លាស់ចំណូលសោះ (គោលការណ៍ លុប)
        if (app === 'ZoeAdmin') {
            const revBefore = await page.evaluate((dk) => JSON.stringify(window.__fakeStore.zoew_daily_revenue_cod_dod[dk]), seed._dateKey);
            for (let cycle = 0; cycle < 2; cycle++) {
                await page.evaluate(() => window.deleteSingleItem('id_3000_ddd'));
                await page.waitForTimeout(400);
                const trashId = await page.evaluate(() => Object.keys(window.__fakeStore.zoew_recently_deleted_cod_dod)[0]);
                await page.evaluate((tid) => { window.promptRestoreDeletedItem(tid); window.executeRestoreItem(); }, trashId);
                await page.waitForTimeout(500);
            }
            const revAfter = await page.evaluate((dk) => JSON.stringify(window.__fakeStore.zoew_daily_revenue_cod_dod[dk]), seed._dateKey);
            check(revBefore === revAfter, 'ZoeAdmin: លុប➜ស្តារ ២ ជុំ ➜ ចំណូលមិនប្រែសោះ', 'មុន ' + revBefore + ' ក្រោយ ' + revAfter);
            const restored = await page.evaluate(() => {
                const it = window.__fakeStore.zoew_scan_history_cod_dod.id_3000_ddd;
                return it ? { n: (it.barcodes || []).length, cod: it.cod, hasDeletedAt: 'deletedAt' in it, hasFromDel: 'isFromDeletion' in it } : null;
            });
            check(restored && restored.n === 2 && restored.cod === 30, 'ZoeAdmin: លុប➜ស្តារ ➜ កញ្ចប់ត្រឡប់មកគ្រប់', JSON.stringify(restored));
            check(restored && !restored.hasDeletedAt && !restored.hasFromDel, 'ZoeAdmin: ស្តារ ➜ លុប deletedAt/isFromDeletion ចេញ', JSON.stringify(restored));
        }

        // ដក ➜ ស្តារ ត្រូវដកលុយចេញ រួចបូកមកវិញឲ្យត្រូវបេះបិទ
        if (app === 'ZoeAdmin') {
            const rev0 = await page.evaluate((dk) => ({ ...window.__fakeStore.zoew_daily_revenue_cod_dod[dk] }), seed._dateKey);
            await page.evaluate(() => window.removeSingleBarcode('id_3000_ddd', 'EE1'));
            await page.waitForTimeout(500);
            const rev1 = await page.evaluate((dk) => ({ ...window.__fakeStore.zoew_daily_revenue_cod_dod[dk] }), seed._dateKey);
            check(Math.round((rev0.codDollar - rev1.codDollar) * 100) / 100 === 10 && (rev0.totalCount - rev1.totalCount) === 1,
                'ZoeAdmin: ដក ➜ ដកលុយ ១០ និងចំនួន ១ ចេញ', JSON.stringify(rev0) + ' ➜ ' + JSON.stringify(rev1));
            const trashState = await page.evaluate(() => {
                const t = Object.values(window.__fakeStore.zoew_recently_deleted_cod_dod)[0];
                return t ? { isFromDeletion: t.isFromDeletion, bDeducted: t.barcodes[0].isDeducted, code: t.barcodes[0].code } : null;
            });
            check(trashState && trashState.isFromDeletion === false && trashState.bDeducted === true && trashState.code === 'EE1',
                'ZoeAdmin: ដក ➜ ធុងសំរាមសម្គាល់ isDeducted និង isFromDeletion=false', JSON.stringify(trashState));
            const tid = await page.evaluate(() => Object.keys(window.__fakeStore.zoew_recently_deleted_cod_dod)[0]);
            await page.evaluate((t) => { window.promptRestoreDeletedItem(t); window.executeRestoreItem(); }, tid);
            await page.waitForTimeout(500);
            const rev2 = await page.evaluate((dk) => ({ ...window.__fakeStore.zoew_daily_revenue_cod_dod[dk] }), seed._dateKey);
            check(rev2.codDollar === rev0.codDollar && rev2.dodDollar === rev0.dodDollar && rev2.totalCount === rev0.totalCount,
                'ZoeAdmin: ដក ➜ ស្តារ ➜ លុយត្រឡប់មកគ្រប់', JSON.stringify(rev0) + ' ➜ ' + JSON.stringify(rev2));
            const back = await page.evaluate(() => {
                const it = window.__fakeStore.zoew_scan_history_cod_dod.id_3000_ddd;
                return it ? { n: it.barcodes.length, deducted: it.barcodes.map(b => b.isDeducted), cod: it.cod } : null;
            });
            check(back && back.n === 2 && back.deducted.every(d => d === false) && back.cod === 30,
                'ZoeAdmin: ដក ➜ ស្តារ ➜ barcode ត្រឡប់មក isDeducted ត្រូវ clear', JSON.stringify(back));
        }

        if (app === 'ZoeAdmin') {
            // ការកែទឹកប្រាក់តាម barcode មិនត្រូវសរសេរជាន់ការផ្លាស់ប្តូររបស់ឧបករណ៍ផ្សេង
            await page.evaluate(() => {
                window.__fakeStore.zoew_scan_history_cod_dod.id_2000_ccc = {
                    id: 'id_2000_ccc', phone: '0999888777', scanDate: window.__fakeStore._dateKey,
                    createdAt: Date.now() - 100, cod: 30, dod: 0, price: 30, count: 2, barcode: 'DD2',
                    time: '12:00', isClosed: false, barcodes: [
                        { code: 'DD1', time: '12:00', cod: 10, dod: 0, locker: 'C1', isClosed: false, isDeducted: false, isFromDeletion: false, createdAt: Date.now() - 100 },
                        { code: 'DD2', time: '12:01', cod: 20, dod: 0, locker: 'C2', isClosed: false, isDeducted: false, isFromDeletion: false, createdAt: Date.now() - 90 }
                    ]
                };
                window.__fireAll();
            });
            await page.waitForTimeout(300);
            await page.evaluate(() => {
                window.openEditBarcodePriceModal('id_2000_ccc', 'DD1');
                // ឧបករណ៍ផ្សេង៖ Zoescan ដាក់ទីតាំង + ZoeW បិទ barcode មួយទៀត
                const srv = window.__fakeStore.zoew_scan_history_cod_dod.id_2000_ccc;
                srv.barcodes[1].isClosed = true;
                srv.barcodes[0].locker = 'Z9';
                document.getElementById('editBcCodInput').value = '15';
                document.getElementById('editBcDodInput').value = '0';
                window.saveEditedBarcodePrice();
            });
            await page.waitForTimeout(600);
            const merged = await page.evaluate(() => {
                const srv = window.__fakeStore.zoew_scan_history_cod_dod.id_2000_ccc;
                return { cod0: srv.barcodes[0].cod, closed1: srv.barcodes[1].isClosed, locker0: srv.barcodes[0].locker, itemCod: srv.cod };
            });
            check(merged.cod0 === 15, 'ZoeAdmin: កែទឹកប្រាក់ ➜ តម្លៃថ្មីចុះពិត', JSON.stringify(merged));
            check(merged.closed1 === true, 'ZoeAdmin: កែទឹកប្រាក់ ➜ មិនលុបការបិទរបស់ឧបករណ៍ផ្សេង', JSON.stringify(merged));
            check(merged.locker0 === 'Z9', 'ZoeAdmin: កែទឹកប្រាក់ ➜ មិនលុបទីតាំងរបស់ Zoescan', JSON.stringify(merged));
            check(merged.itemCod === 35, 'ZoeAdmin: កែទឹកប្រាក់ ➜ ផលបូក item ត្រូវ', JSON.stringify(merged));

            // ឧបករណ៍ផ្សេងលុបកញ្ចប់នេះ ➜ ការកែទឹកប្រាក់មិនត្រូវធ្វើឲ្យវារស់ឡើងវិញ
            const revBeforeGhostEdit = await page.evaluate((dk) => ({ ...window.__fakeStore.zoew_daily_revenue_cod_dod[dk] }), seed._dateKey);
            await page.evaluate(() => {
                const tc = document.getElementById('toastContainer');
                if (tc) tc.innerHTML = '';
                window.openEditBarcodePriceModal('id_2000_ccc', 'DD1');
                delete window.__fakeStore.zoew_scan_history_cod_dod.id_2000_ccc;
                document.getElementById('editBcCodInput').value = '99';
                document.getElementById('editBcDodInput').value = '0';
                window.saveEditedBarcodePrice();
            });
            await page.waitForTimeout(700);
            const ghostEdit = await page.evaluate((dk) => ({
                resurrected: !!window.__fakeStore.zoew_scan_history_cod_dod.id_2000_ccc,
                rev: { ...window.__fakeStore.zoew_daily_revenue_cod_dod[dk] }
            }), seed._dateKey);
            check(ghostEdit.resurrected === false, 'ZoeAdmin: កែទឹកប្រាក់លើកញ្ចប់ដែលរលាយ ➜ មិនរស់ឡើងវិញ', JSON.stringify(ghostEdit));
            check(ghostEdit.rev.codDollar === revBeforeGhostEdit.codDollar && ghostEdit.rev.dodDollar === revBeforeGhostEdit.dodDollar,
                'ZoeAdmin: កែទឹកប្រាក់លើកញ្ចប់ដែលរលាយ ➜ ចំណូលមិនប្រែ',
                JSON.stringify(revBeforeGhostEdit) + ' ➜ ' + JSON.stringify(ghostEdit.rev));
            const ghostToast = await page.evaluate(() => {
                const tc = document.getElementById('toastContainer');
                return tc ? tc.innerText : '';
            });
            check(ghostToast.indexOf('ជោគជ័យ') === -1,
                'ZoeAdmin: កែទឹកប្រាក់ដែលបរាជ័យ ➜ មិនប្រាប់ថាជោគជ័យ', JSON.stringify(ghostToast));
        }

        // ឧបករណ៍ផ្សេងបិទបញ្ជី ខណៈយើងស្កេនកញ្ចប់ថ្មីចូលបញ្ជីដដែល
        if (app === 'ZoeAdmin') {
            await page.evaluate((dk) => {
                window.__fakeStore.zoew_scan_history_cod_dod.id_5000_fff = {
                    id: 'id_5000_fff', phone: '0655444333', scanDate: dk, createdAt: Date.now() - 150,
                    cod: 8, dod: 0, price: 8, count: 1, barcode: 'GG1', time: '15:00', isClosed: false,
                    barcodes: [{ code: 'GG1', time: '15:00', cod: 8, dod: 0, locker: 'F1', isClosed: false, isDeducted: false, isFromDeletion: false, createdAt: Date.now() - 150 }]
                };
                window.__fireAll();
            }, seed._dateKey);
            await page.waitForTimeout(300);
            // បិទវាតាមផ្លូវធម្មតា ➜ ស្ថិតិកើន
            await page.evaluate(() => window.toggleCloseStatus('id_5000_fff'));
            await page.waitForTimeout(500);
            const pickClosed = await page.evaluate((dk) => JSON.parse(JSON.stringify(window.__fakeStore.zoew_daily_pickup_cod_dod[dk])), seed._dateKey);
            // ធ្វើឲ្យច្បាប់ចម្លងក្នុងសតិយឺត (ដូចជា listener មិនទាន់មកដល់) រួចស្កេនកញ្ចប់ថ្មី
            await page.evaluate(() => {
                const local = scanHistory.find((i) => i.id === 'id_5000_fff');
                if (local) { local.isClosed = false; local.barcodes.forEach((b) => { b.isClosed = false; }); }
            });
            await page.evaluate(() => window.addOrUpdateEntry('GG2', '0655444333', 'F2', 4, 0));
            await page.waitForTimeout(700);
            const after = await page.evaluate((dk) => ({
                serverClosed: window.__fakeStore.zoew_scan_history_cod_dod.id_5000_fff.isClosed,
                n: window.__fakeStore.zoew_scan_history_cod_dod.id_5000_fff.barcodes.length,
                pick: JSON.parse(JSON.stringify(window.__fakeStore.zoew_daily_pickup_cod_dod[dk]))
            }), seed._dateKey);
            const phoneKey = '0655444333';
            const stillCounted = after.pick.pickedUpPhones && after.pick.pickedUpPhones[phoneKey];
            check(after.serverClosed === false && after.n === 2, 'ZoeAdmin: ស្កេនកញ្ចប់ថ្មី ➜ បញ្ជីបើកវិញ និងមាន ២ កញ្ចប់', JSON.stringify(after));
            check(!stillCounted,
                'ZoeAdmin: បញ្ជីបើកវិញដោយការស្កេន ➜ លែងរាប់ជាអតិថិជនយកហើយ',
                'pickedUpPhones=' + JSON.stringify(after.pick.pickedUpPhones) + ' (មុនស្កេន ' + JSON.stringify(pickClosed.pickedUpPhones) + ')');
        }

        // --- ការកែលេខទូរស័ព្ទ ត្រូវពឹងលើស្ថានភាពពិតរបស់ server ---
        {
            const dk = seed._dateKey;
            await page.evaluate((a) => {
                const now = Date.now();
                window.__fakeStore.zoew_scan_history_cod_dod.id_ph_a = {
                    id: 'id_ph_a', phone: '0914000001', scanDate: a.dk, createdAt: now - 40000,
                    cod: 5, dod: 0, price: 5, count: 1, barcode: 'PH1', time: '07:00', isClosed: false,
                    barcodes: [{ code: 'PH1', time: '07:00', cod: 5, dod: 0, locker: 'N/A', isClosed: false, isDeducted: false, isFromDeletion: false, createdAt: now - 40000 }]
                };
                window.__fakeStore.zoew_scan_history_cod_dod.id_ph_b = {
                    id: 'id_ph_b', phone: '0914000002', scanDate: a.dk, createdAt: now - 30000,
                    cod: 5, dod: 0, price: 5, count: 1, barcode: 'PH2', time: '07:10', isClosed: false,
                    barcodes: [{ code: 'PH2', time: '07:10', cod: 5, dod: 0, locker: 'N/A', isClosed: false, isDeducted: false, isFromDeletion: false, createdAt: now - 30000 }]
                };
                window.__fireAll();
            }, { dk: dk });
            await page.waitForTimeout(300);

            // ក. server បិទបញ្ជីរួច (យើងមិនទាន់ដឹង) ➜ ការកែលេខត្រូវផ្លាស់ ref ទៅលេខថ្មី
            await page.evaluate((a) => {
                const it = window.__fakeStore.zoew_scan_history_cod_dod.id_ph_a;
                it.isClosed = true; it.closedAt = Date.now(); it.barcodes[0].isClosed = true;
                const p = window.__fakeStore.zoew_daily_pickup_cod_dod[a.dk] || { packagesPickedUp: 0, pickedUpPhones: {} };
                p.packagesPickedUp = (p.packagesPickedUp || 0) + 1;
                p.pickedUpPhones = p.pickedUpPhones || {};
                p.pickedUpPhones['0914000001'] = 1;
                window.__fakeStore.zoew_daily_pickup_cod_dod[a.dk] = p;
            }, { dk: dk });
            await page.evaluate(() => {
                window.openEditModal('id_ph_a');
                document.getElementById('editPhoneInput').value = '0914000009';
                window.saveEditedPhone();
            });
            await page.waitForTimeout(700);
            const phA = await page.evaluate((a) => {
                const p = window.__fakeStore.zoew_daily_pickup_cod_dod[a.dk] || {};
                const ph = p.pickedUpPhones || {};
                return { old: ph['0914000001'] || 0, neu: ph['0914000009'] || 0, serverPhone: window.__fakeStore.zoew_scan_history_cod_dod.id_ph_a.phone };
            }, { dk: dk });
            check(phA.serverPhone === '0914000009' && phA.old === 0 && phA.neu === 1,
                app + ': កែលេខលើបញ្ជីដែល server បិទរួច ➜ ref ផ្លាស់ទៅលេខថ្មី', JSON.stringify(phA));

            // ខ. ឧបករណ៍ផ្សេងលុបកញ្ចប់ ➜ ការកែលេខមិនត្រូវបង្កើត record ខ្មោច
            await page.evaluate(() => { delete window.__fakeStore.zoew_scan_history_cod_dod.id_ph_b; });
            await page.evaluate(() => {
                window.openEditModal('id_ph_b');
                document.getElementById('editPhoneInput').value = '0914000008';
                window.saveEditedPhone();
            });
            await page.waitForTimeout(700);
            const phB = await page.evaluate(() => {
                const it = window.__fakeStore.zoew_scan_history_cod_dod.id_ph_b;
                return { exists: !!it, keys: it ? Object.keys(it) : [] };
            });
            check(phB.exists === false, app + ': កែលេខលើកញ្ចប់ដែលលែងមាន ➜ មិនបង្កើត record ខ្មោច', JSON.stringify(phB));
        }

        // --- ការស្តារពីធុងសំរាម ត្រូវធ្វើលើច្បាប់ចម្លងរបស់ server ---
        {
            const dk = seed._dateKey;
            // ក. ឧបករណ៍ផ្សេងបិទ barcode និងដាក់ទីតាំង ខណៈយើងស្តារធាតុមួយ merge ចូលបញ្ជីដដែល
            await page.evaluate((a) => {
                const now = Date.now();
                window.__fakeStore.zoew_scan_history_cod_dod.id_rs_live = {
                    id: 'id_rs_live', phone: '0913000001', scanDate: a.dk, createdAt: now - 90000,
                    cod: 11, dod: 0, price: 11, count: 1, barcode: 'RA1', time: '08:00', isClosed: false,
                    barcodes: [{ code: 'RA1', time: '08:00', cod: 11, dod: 0, locker: 'N/A', isClosed: false, isDeducted: false, isFromDeletion: false, createdAt: now - 90000 }]
                };
                window.__fakeStore.zoew_recently_deleted_cod_dod.id_rs_trash = {
                    id: 'id_rs_trash', phone: '0913000001', scanDate: a.dk, createdAt: now - 80000,
                    cod: 12, dod: 0, price: 12, count: 1, barcode: 'RA2', time: '08:30', isClosed: false,
                    deletedAt: now - 1000, isFromDeletion: false,
                    barcodes: [{ code: 'RA2', time: '08:30', cod: 12, dod: 0, locker: 'N/A', isClosed: false, isDeducted: true, isFromDeletion: false, createdAt: now - 80000 }]
                };
                window.__fireAll();
            }, { dk: dk });
            await page.waitForTimeout(300);
            // ការប្រែប្រួលរបស់ឧបករណ៍ផ្សេងចុះនៅ server ក្រោយពេលច្បាប់ចម្លងក្នុងសតិត្រូវបានអានចុងក្រោយ
            await page.evaluate(() => {
                const orig = window.firebaseSDK.runTransaction;
                let armed = true;
                window.firebaseSDK.runTransaction = function (r, fn) {
                    if (armed && String(r.path).indexOf('zoew_scan_history_cod_dod/id_rs_live') === 0) {
                        armed = false;
                        window.firebaseSDK.runTransaction = orig;
                        const it = window.__fakeStore.zoew_scan_history_cod_dod.id_rs_live;
                        it.barcodes[0].isClosed = true;
                        it.barcodes[0].locker = 'RZ9';
                    }
                    return orig.call(this, r, fn);
                };
            });
            await page.evaluate(() => { window.promptRestoreDeletedItem('id_rs_trash'); window.executeRestoreItem(); });
            await page.waitForTimeout(800);
            const merged = await page.evaluate(() => {
                const it = window.__fakeStore.zoew_scan_history_cod_dod.id_rs_live;
                const ra1 = it.barcodes.find((b) => b.code === 'RA1');
                return { n: it.barcodes.length, ra1Closed: ra1 && ra1.isClosed, ra1Locker: ra1 && ra1.locker, hasRa2: it.barcodes.some((b) => b.code === 'RA2'), trashGone: !window.__fakeStore.zoew_recently_deleted_cod_dod.id_rs_trash };
            });
            check(merged.n === 2 && merged.hasRa2 === true && merged.trashGone === true,
                app + ': ស្តារ merge ➜ កញ្ចប់ចូលបញ្ជីដដែល និងចេញពីធុងសំរាម', JSON.stringify(merged));
            check(merged.ra1Closed === true && merged.ra1Locker === 'RZ9',
                app + ': ស្តារ merge ➜ មិនលុបការបិទ និងទីតាំងរបស់ឧបករណ៍ផ្សេង', JSON.stringify(merged));

            // ខ. ឧបករណ៍ផ្សេងស្តាររួច ➜ ការស្តារម្ដងទៀត មិនត្រូវបូកចំណូលស្ទួន
            await page.evaluate((a) => {
                const now = Date.now();
                window.__fakeStore.zoew_recently_deleted_cod_dod.id_rs_dup = {
                    id: 'id_rs_dup', phone: '0913000002', scanDate: a.dk, createdAt: now - 70000,
                    cod: 9, dod: 0, price: 9, count: 1, barcode: 'RB1', time: '09:00', isClosed: false,
                    deletedAt: now - 1000, isFromDeletion: false,
                    barcodes: [{ code: 'RB1', time: '09:00', cod: 9, dod: 0, locker: 'N/A', isClosed: false, isDeducted: true, isFromDeletion: false, createdAt: now - 70000 }]
                };
                window.__fireAll();
            }, { dk: dk });
            await page.waitForTimeout(300);
            const revBefore = await page.evaluate((a) => JSON.parse(JSON.stringify(window.__fakeStore.zoew_daily_revenue_cod_dod[a.dk])), { dk: dk });
            // ឧបករណ៍ផ្សេងស្តារវាសិន (ចំណូលបូកមកវិញរួច) ដោយ listener មិនទាន់មកដល់
            await page.evaluate((a) => {
                const t = window.__fakeStore.zoew_recently_deleted_cod_dod.id_rs_dup;
                delete window.__fakeStore.zoew_recently_deleted_cod_dod.id_rs_dup;
                t.barcodes[0].isDeducted = false;
                delete t.deletedAt;
                window.__fakeStore.zoew_scan_history_cod_dod.id_rs_dup = t;
                const rev = window.__fakeStore.zoew_daily_revenue_cod_dod[a.dk];
                rev.codDollar = Math.round((rev.codDollar + 9) * 100) / 100;
                rev.totalCount = rev.totalCount + 1;
            }, { dk: dk });
            const revAfterOther = await page.evaluate((a) => JSON.parse(JSON.stringify(window.__fakeStore.zoew_daily_revenue_cod_dod[a.dk])), { dk: dk });
            await page.evaluate(() => { window.promptRestoreDeletedItem('id_rs_dup'); window.executeRestoreItem(); });
            await page.waitForTimeout(800);
            const revAfterMine = await page.evaluate((a) => JSON.parse(JSON.stringify(window.__fakeStore.zoew_daily_revenue_cod_dod[a.dk])), { dk: dk });
            check(revAfterMine.codDollar === revAfterOther.codDollar && revAfterMine.totalCount === revAfterOther.totalCount,
                app + ': ស្តារធាតុដែលឧបករណ៍ផ្សេងស្តាររួច ➜ ចំណូលមិនបូកស្ទួន',
                'មុន=' + JSON.stringify(revBefore) + ' ឧបករណ៍ផ្សេង=' + JSON.stringify(revAfterOther) + ' ក្រោយ=' + JSON.stringify(revAfterMine));
        }

        // --- ស្ថិតិ "អតិថិជនយក" ត្រូវត្រូវនឹងស្ថានភាពពិតរបស់ server ---
        {
            const seedPickupItem = async (id, phone, bcs) => {
                await page.evaluate((a) => {
                    const now = Date.now();
                    const sum = a.bcs.reduce((s, b) => s + b.cod, 0);
                    window.__fakeStore.zoew_scan_history_cod_dod[a.id] = {
                        id: a.id, phone: a.phone, scanDate: a.dk, createdAt: now - 60000,
                        cod: sum, dod: 0, price: sum, count: a.bcs.length,
                        barcode: a.bcs[0].code, time: '12:00',
                        isClosed: a.bcs.every((b) => b.isClosed),
                        barcodes: a.bcs.map((b) => ({ code: b.code, time: '12:00', cod: b.cod, dod: 0, locker: 'N/A', isClosed: !!b.isClosed, isDeducted: false, isFromDeletion: false, createdAt: now - 60000 }))
                    };
                    window.__fireAll();
                }, { id: id, phone: phone, bcs: bcs, dk: seed._dateKey });
                await page.waitForTimeout(250);
            };
            const pickRef = (phoneKey) => page.evaluate((a) => {
                const p = window.__fakeStore.zoew_daily_pickup_cod_dod[a.dk] || {};
                return (p.pickedUpPhones || {})[a.phoneKey] || 0;
            }, { dk: seed._dateKey, phoneKey: phoneKey });

            // ក. ឧបករណ៍ផ្សេងបិទបញ្ជីរួច ខណៈច្បាប់ចម្លងក្នុងសតិនៅបើក ➜ បិទម្ដងទៀត មិនត្រូវរាប់អតិថិជនស្ទួន
            await seedPickupItem('id_pk_a', '0912000001', [{ code: 'PA1', cod: 3, isClosed: false }]);
            await page.evaluate((a) => {
                const it = window.__fakeStore.zoew_scan_history_cod_dod.id_pk_a;
                it.isClosed = true; it.closedAt = Date.now(); it.barcodes[0].isClosed = true;
                const p = window.__fakeStore.zoew_daily_pickup_cod_dod[a.dk] || { packagesPickedUp: 0, pickedUpPhones: {} };
                p.packagesPickedUp = (p.packagesPickedUp || 0) + 1;
                p.pickedUpPhones = p.pickedUpPhones || {};
                p.pickedUpPhones['0912000001'] = 1;
                window.__fakeStore.zoew_daily_pickup_cod_dod[a.dk] = p;
            }, { dk: seed._dateKey });
            await page.evaluate(() => window.toggleCloseStatus('id_pk_a'));
            await page.waitForTimeout(600);
            const refA = await pickRef('0912000001');
            check(refA === 1, app + ': បិទបញ្ជីដែលឧបករណ៍ផ្សេងបិទរួច ➜ មិនរាប់អតិថិជនស្ទួន', 'refCount=' + refA + ' (រំពឹង 1)');

            // ខ. បិទ barcode ចុងក្រោយ ខណៈ server បិទបងប្អូនរួច ➜ ត្រូវរាប់អតិថិជនថ្មី
            await seedPickupItem('id_pk_b', '0912000002', [{ code: 'PB1', cod: 4, isClosed: false }, { code: 'PB2', cod: 5, isClosed: false }]);
            await page.evaluate((a) => {
                const it = window.__fakeStore.zoew_scan_history_cod_dod.id_pk_b;
                it.barcodes[1].isClosed = true;
                const p = window.__fakeStore.zoew_daily_pickup_cod_dod[a.dk] || { packagesPickedUp: 0, pickedUpPhones: {} };
                p.packagesPickedUp = (p.packagesPickedUp || 0) + 1;
                window.__fakeStore.zoew_daily_pickup_cod_dod[a.dk] = p;
            }, { dk: seed._dateKey });
            await page.evaluate(() => window.toggleIndividualBarcodeClose('id_pk_b', 'PB1'));
            await page.waitForTimeout(600);
            const refB = await pickRef('0912000002');
            const closedB = await page.evaluate(() => window.__fakeStore.zoew_scan_history_cod_dod.id_pk_b.isClosed);
            check(closedB === true && refB === 1, app + ': បញ្ជីបិទគ្រប់នៅ server ➜ រាប់អតិថិជនត្រឹមត្រូវ', 'isClosed=' + closedB + ' refCount=' + refB + ' (រំពឹង 1)');

            // គ. ឧបករណ៍ផ្សេងបើក barcode បងប្អូនវិញ ➜ មិនត្រូវទុកអតិថិជនខ្មោច
            await seedPickupItem('id_pk_c', '0912000003', [{ code: 'PC1', cod: 6, isClosed: false }, { code: 'PC2', cod: 7, isClosed: true }]);
            await page.evaluate(() => {
                window.__fakeStore.zoew_scan_history_cod_dod.id_pk_c.barcodes[1].isClosed = false;
            });
            await page.evaluate(() => window.toggleIndividualBarcodeClose('id_pk_c', 'PC1'));
            await page.waitForTimeout(600);
            const refC = await pickRef('0912000003');
            const closedC = await page.evaluate(() => window.__fakeStore.zoew_scan_history_cod_dod.id_pk_c.isClosed);
            check(closedC === false && refC === 0, app + ': បញ្ជីមិនទាន់បិទគ្រប់នៅ server ➜ គ្មានអតិថិជនខ្មោច', 'isClosed=' + closedC + ' refCount=' + refC + ' (រំពឹង 0)');
        }

        // --- ដក / លុប ត្រូវធ្វើការលើច្បាប់ចម្លងរបស់ server មិនមែនច្បាប់ចម្លងក្នុងសតិ ---
        if (app === 'ZoeAdmin') {
            const seedItem = async (id, phone, bcs) => {
                await page.evaluate((a) => {
                    const total = a.bcs.reduce((s, b) => s + b.cod + b.dod, 0);
                    window.__fakeStore.zoew_scan_history_cod_dod[a.id] = {
                        id: a.id, phone: a.phone, scanDate: a.dk, createdAt: Date.now() - 400,
                        cod: a.bcs.reduce((s, b) => s + b.cod, 0), dod: a.bcs.reduce((s, b) => s + b.dod, 0),
                        price: total, count: a.bcs.length, barcode: a.bcs[0].code, time: '15:00', isClosed: false,
                        barcodes: a.bcs.map((b, i) => ({
                            code: b.code, time: '15:0' + i, cod: b.cod, dod: b.dod, locker: b.locker,
                            isClosed: false, isDeducted: false, isFromDeletion: false, createdAt: Date.now() - 400 + i
                        }))
                    };
                    const rev = window.__fakeStore.zoew_daily_revenue_cod_dod[a.dk];
                    rev.codDollar = Math.round((rev.codDollar + a.bcs.reduce((s, b) => s + b.cod, 0)) * 100) / 100;
                    rev.dodDollar = Math.round((rev.dodDollar + a.bcs.reduce((s, b) => s + b.dod, 0)) * 100) / 100;
                    rev.totalCount = rev.totalCount + a.bcs.length;
                    window.__fireAll();
                }, { id, phone, bcs, dk: seed._dateKey });
                await page.waitForTimeout(250);
            };
            const revNow = () => page.evaluate((dk) => ({ ...window.__fakeStore.zoew_daily_revenue_cod_dod[dk] }), seed._dateKey);
            const trashCodes = () => page.evaluate(() => Object.values(window.__fakeStore.zoew_recently_deleted_cod_dod).map((t) => t.barcode));

            // A. ឧបករណ៍ផ្សេងបិទ barcode បងប្អូន + Zoescan ដាក់ទីតាំង ➜ ការដកមិនត្រូវលុបវាចោល
            await seedItem('id_6000_ggg', '0611000111', [
                { code: 'GG1', cod: 10, dod: 0, locker: 'F1' },
                { code: 'GG2', cod: 20, dod: 0, locker: 'F2' }
            ]);
            const revA0 = await revNow();
            await page.evaluate(() => {
                const srv = window.__fakeStore.zoew_scan_history_cod_dod.id_6000_ggg;
                srv.barcodes[1].isClosed = true;
                srv.barcodes[1].locker = 'Z7';
                window.removeSingleBarcode('id_6000_ggg', 'GG1');
            });
            await page.waitForTimeout(800);
            const stateA = await page.evaluate(() => {
                const srv = window.__fakeStore.zoew_scan_history_cod_dod.id_6000_ggg;
                const tr = Object.values(window.__fakeStore.zoew_recently_deleted_cod_dod).find((t) => t.barcode === 'GG1');
                return srv ? {
                    n: srv.barcodes.length, code: srv.barcodes[0].code, closed: srv.barcodes[0].isClosed,
                    locker: srv.barcodes[0].locker, itemCod: srv.cod, trashed: !!tr
                } : null;
            });
            const revA1 = await revNow();
            check(stateA && stateA.closed === true,
                'ZoeAdmin: ដក ➜ មិនលុបការបិទរបស់ឧបករណ៍ផ្សេង', JSON.stringify(stateA));
            check(stateA && stateA.locker === 'Z7',
                'ZoeAdmin: ដក ➜ មិនលុបទីតាំងរបស់ Zoescan', JSON.stringify(stateA));
            check(stateA && stateA.n === 1 && stateA.code === 'GG2' && stateA.itemCod === 20 && stateA.trashed,
                'ZoeAdmin: ដក ➜ សល់កញ្ចប់ត្រូវ និងចូលធុងសំរាម', JSON.stringify(stateA));
            check(Math.round((revA0.codDollar - revA1.codDollar) * 100) / 100 === 10 && (revA0.totalCount - revA1.totalCount) === 1,
                'ZoeAdmin: ដក ➜ កាត់លុយត្រឹមតម្លៃពិតរបស់ server', JSON.stringify(revA0) + ' ➜ ' + JSON.stringify(revA1));

            // B. ឧបករណ៍ផ្សេងដក barcode នោះរួចហើយ ➜ មិនត្រូវកាត់លុយ ឬចូលធុងសំរាមម្តងទៀត
            await seedItem('id_6001_hhh', '0611000222', [
                { code: 'HH1', cod: 7, dod: 0, locker: 'G1' },
                { code: 'HH2', cod: 8, dod: 0, locker: 'G2' }
            ]);
            const revB0 = await revNow();
            const trashB0 = await trashCodes();
            await page.evaluate(() => {
                const srv = window.__fakeStore.zoew_scan_history_cod_dod.id_6001_hhh;
                srv.barcodes = srv.barcodes.filter((b) => b.code !== 'HH1');
                srv.count = 1; srv.cod = 8; srv.price = 8; srv.barcode = 'HH2';
                window.removeSingleBarcode('id_6001_hhh', 'HH1');
            });
            await page.waitForTimeout(800);
            const revB1 = await revNow();
            const trashB1 = await trashCodes();
            check(revB1.codDollar === revB0.codDollar && revB1.totalCount === revB0.totalCount,
                'ZoeAdmin: ដកកញ្ចប់ដែលឧបករណ៍ផ្សេងដករួច ➜ មិនកាត់លុយម្តងទៀត',
                JSON.stringify(revB0) + ' ➜ ' + JSON.stringify(revB1));
            check(trashB1.filter((c) => c === 'HH1').length === trashB0.filter((c) => c === 'HH1').length,
                'ZoeAdmin: ដកកញ្ចប់ដែលដករួច ➜ គ្មានធាតុធុងសំរាមស្ទួន', JSON.stringify(trashB1));

            // C. ឧបករណ៍ផ្សេងលុប item ទាំងមូល ➜ ការដកមិនត្រូវធ្វើឲ្យវារស់ឡើងវិញ
            await seedItem('id_6002_iii', '0611000333', [
                { code: 'II1', cod: 4, dod: 1, locker: 'H1' },
                { code: 'II2', cod: 6, dod: 0, locker: 'H2' }
            ]);
            const revC0 = await revNow();
            await page.evaluate(() => {
                delete window.__fakeStore.zoew_scan_history_cod_dod.id_6002_iii;
                window.removeSingleBarcode('id_6002_iii', 'II1');
            });
            await page.waitForTimeout(800);
            const stateC = await page.evaluate(() => ({
                resurrected: !!window.__fakeStore.zoew_scan_history_cod_dod.id_6002_iii,
                trashed: Object.values(window.__fakeStore.zoew_recently_deleted_cod_dod).some((t) => t.barcode === 'II1')
            }));
            const revC1 = await revNow();
            check(stateC.resurrected === false && stateC.trashed === false,
                'ZoeAdmin: ដកលើ item ដែលរលាយ ➜ មិនរស់ឡើងវិញ និងមិនចូលធុងសំរាម', JSON.stringify(stateC));
            check(revC1.codDollar === revC0.codDollar && revC1.dodDollar === revC0.dodDollar && revC1.totalCount === revC0.totalCount,
                'ZoeAdmin: ដកលើ item ដែលរលាយ ➜ ចំណូលមិនប្រែ', JSON.stringify(revC0) + ' ➜ ' + JSON.stringify(revC1));

            // D. លុប ➜ ធុងសំរាមត្រូវផ្ទុកស្ថានភាពរបស់ server មិនមែនច្បាប់ចម្លងចាស់ក្នុងសតិ
            await seedItem('id_7000_jjj', '0611000444', [{ code: 'JJ1', cod: 9, dod: 2, locker: 'I1' }]);
            const revD0 = await revNow();
            await page.evaluate(() => {
                const srv = window.__fakeStore.zoew_scan_history_cod_dod.id_7000_jjj;
                srv.barcodes[0].isClosed = true;
                srv.barcodes[0].locker = 'Z8';
                srv.isClosed = true;
                window.deleteSingleItem('id_7000_jjj');
            });
            await page.waitForTimeout(800);
            const stateD = await page.evaluate(() => {
                const t = window.__fakeStore.zoew_recently_deleted_cod_dod.id_7000_jjj;
                return t ? { closed: t.barcodes[0].isClosed, locker: t.barcodes[0].locker, fromDel: t.isFromDeletion, bFromDel: t.barcodes[0].isFromDeletion } : null;
            });
            const revD1 = await revNow();
            check(stateD && stateD.closed === true && stateD.locker === 'Z8',
                'ZoeAdmin: លុប ➜ ធុងសំរាមផ្ទុកស្ថានភាពពិតរបស់ server', JSON.stringify(stateD));
            check(stateD && stateD.fromDel === true && stateD.bFromDel === true,
                'ZoeAdmin: លុប ➜ សម្គាល់ isFromDeletion គ្រប់កម្រិត', JSON.stringify(stateD));
            check(revD1.codDollar === revD0.codDollar && revD1.dodDollar === revD0.dodDollar && revD1.totalCount === revD0.totalCount,
                'ZoeAdmin: លុប ➜ ចំណូលមិនប្រែសោះ (គោលការណ៍ លុប)', JSON.stringify(revD0) + ' ➜ ' + JSON.stringify(revD1));

            // E. ឧបករណ៍ផ្សេងលុបរួចហើយ ➜ មិនត្រូវបង្កើតធាតុធុងសំរាមខ្មោច
            await seedItem('id_7001_kkk', '0611000555', [{ code: 'KK1', cod: 3, dod: 0, locker: 'J1' }]);
            await page.evaluate(() => {
                delete window.__fakeStore.zoew_scan_history_cod_dod.id_7001_kkk;
                window.deleteSingleItem('id_7001_kkk');
            });
            await page.waitForTimeout(800);
            const stateE = await page.evaluate(() => ({
                inTrash: !!window.__fakeStore.zoew_recently_deleted_cod_dod.id_7001_kkk,
                resurrected: !!window.__fakeStore.zoew_scan_history_cod_dod.id_7001_kkk
            }));
            check(stateE.inTrash === false && stateE.resurrected === false,
                'ZoeAdmin: លុប item ដែលលុបរួច ➜ គ្មានធាតុធុងសំរាមខ្មោច', JSON.stringify(stateE));
        }





        // --- ការសរសេរធុងសំរាមជោគជ័យ តែ handler ក្រោយនោះ throw ➜ មិនត្រូវរត់ការសង្គ្រោះ ---
        if (app === 'ZoeAdmin') {
            await page.evaluate((dk) => {
                const now = Date.now();
                window.__fakeStore.zoew_scan_history_cod_dod.id_ph_x = {
                    id: 'id_ph_x', phone: '0677000111', scanDate: dk, createdAt: now - 240,
                    cod: 21, dod: 0, price: 21, count: 2, barcode: 'PH1', time: '19:00', isClosed: false,
                    barcodes: [
                        { code: 'PH1', time: '19:00', cod: 9, dod: 0, locker: 'N1', isClosed: false, isDeducted: false, isFromDeletion: false, createdAt: now - 240 },
                        { code: 'PH2', time: '19:01', cod: 12, dod: 0, locker: 'N2', isClosed: false, isDeducted: false, isFromDeletion: false, createdAt: now - 230 }
                    ]
                };
                const rev = window.__fakeStore.zoew_daily_revenue_cod_dod[dk];
                rev.codDollar = Math.round((rev.codDollar + 21) * 100) / 100;
                rev.totalCount = rev.totalCount + 2;
                window.__fireAll();
            }, seed._dateKey);
            await page.waitForTimeout(300);

            const revPh0 = await page.evaluate((k) => ({ ...window.__fakeStore.zoew_daily_revenue_cod_dod[k] }), seed._dateKey);
            await page.evaluate(() => {
                window.__origSync = window.syncScannerLookupEntry;
                window.syncScannerLookupEntry = function () { throw new Error('post-success handler blew up'); };
                window.removeSingleBarcode('id_ph_x', 'PH1');
            });
            await page.waitForTimeout(1200);
            const phState = await page.evaluate((k) => {
                const it = window.__fakeStore.zoew_scan_history_cod_dod.id_ph_x;
                return {
                    codes: it ? it.barcodes.map((b) => b.code).sort().join(',') : null,
                    inTrash: Object.values(window.__fakeStore.zoew_recently_deleted_cod_dod).some((t) => t.barcode === 'PH1'),
                    rev: { ...window.__fakeStore.zoew_daily_revenue_cod_dod[k] }
                };
            }, seed._dateKey);
            await page.evaluate(() => { window.syncScannerLookupEntry = window.__origSync; });

            check(phState.codes === 'PH2',
                'ZoeAdmin: handler ក្រោយជោគជ័យ throw ➜ កញ្ចប់មិនត្រូវរស់ឡើងវិញ', JSON.stringify(phState.codes));
            check(phState.inTrash === true,
                'ZoeAdmin: handler ក្រោយជោគជ័យ throw ➜ ធាតុធុងសំរាមនៅដដែល', JSON.stringify(phState.inTrash));
            check(Math.round((revPh0.codDollar - phState.rev.codDollar) * 100) / 100 === 9 && (revPh0.totalCount - phState.rev.totalCount) === 1,
                'ZoeAdmin: handler ក្រោយជោគជ័យ throw ➜ លុយនៅតែកាត់ត្រឹមត្រូវ មិនបញ្ច្រាស',
                JSON.stringify(revPh0) + ' ➜ ' + JSON.stringify(phState.rev));

            await page.evaluate((dk) => {
                const now = Date.now();
                window.__fakeStore.zoew_scan_history_cod_dod.id_ph_y = {
                    id: 'id_ph_y', phone: '0677000222', scanDate: dk, createdAt: now - 220,
                    cod: 10, dod: 0, price: 10, count: 1, barcode: 'PY1', time: '19:05', isClosed: false,
                    barcodes: [{ code: 'PY1', time: '19:05', cod: 10, dod: 0, locker: 'N3', isClosed: false, isDeducted: false, isFromDeletion: false, createdAt: now - 220 }]
                };
                const rev = window.__fakeStore.zoew_daily_revenue_cod_dod[dk];
                rev.codDollar = Math.round((rev.codDollar + 10) * 100) / 100;
                rev.totalCount = rev.totalCount + 1;
                window.__fireAll();
            }, seed._dateKey);
            await page.waitForTimeout(300);
            const revPy0 = await page.evaluate((k) => ({ ...window.__fakeStore.zoew_daily_revenue_cod_dod[k] }), seed._dateKey);
            await page.evaluate(() => {
                window.syncScannerLookupEntry = function () { throw new Error('post-success handler blew up'); };
                window.openEditBarcodePriceModal('id_ph_y', 'PY1');
                document.getElementById('editBcCodInput').value = '25';
                document.getElementById('editBcDodInput').value = '0';
                window.saveEditedBarcodePrice();
            });
            await page.waitForTimeout(1000);
            const pyState = await page.evaluate((k) => ({
                serverCod: window.__fakeStore.zoew_scan_history_cod_dod.id_ph_y.barcodes[0].cod,
                rev: { ...window.__fakeStore.zoew_daily_revenue_cod_dod[k] }
            }), seed._dateKey);
            await page.evaluate(() => { window.syncScannerLookupEntry = window.__origSync; });
            check(pyState.serverCod === 25,
                'ZoeAdmin: កែទឹកប្រាក់ ➜ handler ក្រោយជោគជ័យ throw ➜ តម្លៃថ្មីនៅដដែល', JSON.stringify(pyState.serverCod));
            check(Math.round((pyState.rev.codDollar - revPy0.codDollar) * 100) / 100 === 15,
                'ZoeAdmin: កែទឹកប្រាក់ ➜ handler throw ➜ ចំណូលមិនត្រូវបញ្ច្រាសខុស',
                JSON.stringify(revPy0) + ' ➜ ' + JSON.stringify(pyState.rev));


            await page.evaluate((dk) => {
                const now = Date.now();
                window.__fakeStore.zoew_recently_deleted_cod_dod.id_ph_z = {
                    id: 'id_ph_z', phone: '0677000333', scanDate: dk, createdAt: now - 200,
                    cod: 14, dod: 0, price: 14, count: 1, barcode: 'PZ1', time: '19:10',
                    isClosed: false, isFromDeletion: false, deletedAt: now - 100,
                    barcodes: [{ code: 'PZ1', time: '19:10', cod: 14, dod: 0, locker: 'N4', isClosed: false, isDeducted: true, isFromDeletion: false, createdAt: now - 200 }]
                };
                window.__fireAll();
            }, seed._dateKey);
            await page.waitForTimeout(300);
            const revPz0 = await page.evaluate((k) => ({ ...window.__fakeStore.zoew_daily_revenue_cod_dod[k] }), seed._dateKey);
            await page.evaluate(() => {
                window.syncScannerLookupEntry = function () { throw new Error('post-success handler blew up'); };
                window.promptRestoreDeletedItem('id_ph_z');
                window.executeRestoreItem();
            });
            await page.waitForTimeout(1000);
            const pzState = await page.evaluate((k) => ({
                live: !!window.__fakeStore.zoew_scan_history_cod_dod.id_ph_z,
                stillTrash: !!window.__fakeStore.zoew_recently_deleted_cod_dod.id_ph_z,
                rev: { ...window.__fakeStore.zoew_daily_revenue_cod_dod[k] }
            }), seed._dateKey);
            await page.evaluate(() => { window.syncScannerLookupEntry = window.__origSync; });
            check(pzState.live === true && pzState.stillTrash === false,
                'ZoeAdmin: ស្តារ ➜ handler ក្រោយជោគជ័យ throw ➜ ការស្តារនៅជាប់', JSON.stringify(pzState));
            check(Math.round((pzState.rev.codDollar - revPz0.codDollar) * 100) / 100 === 14,
                'ZoeAdmin: ស្តារ ➜ handler throw ➜ លុយមិនត្រូវបញ្ច្រាសខុស',
                JSON.stringify(revPz0) + ' ➜ ' + JSON.stringify(pzState.rev));

            for (let i = errors.length - 1; i >= 0; i--) {
                if (/post-success handler blew up|Error removing single barcode|Restore failed/.test(errors[i])) errors.splice(i, 1);
            }
        }
        // --- RTDB អាចរត់ update function ច្រើនដង ➜ ការរត់ទី ២ ត្រូវសម្រេចដោយខ្លួនឯង ---
        if (app === 'ZoeAdmin') {
            const revRr = () => page.evaluate((k) => ({ ...window.__fakeStore.zoew_daily_revenue_cod_dod[k] }), seed._dateKey);
            await page.evaluate((dk) => {
                const now = Date.now();
                const mk = (id, phone, bcs) => ({
                    id, phone, scanDate: dk, createdAt: now - 260,
                    cod: bcs.reduce((s, b) => s + b.cod, 0), dod: 0,
                    price: bcs.reduce((s, b) => s + b.cod, 0), count: bcs.length,
                    barcode: bcs[0].code, time: '18:00', isClosed: false,
                    barcodes: bcs.map((b) => ({
                        code: b.code, time: '18:00', cod: b.cod, dod: 0, locker: 'M1',
                        isClosed: false, isDeducted: false, isFromDeletion: false, createdAt: now - 260
                    }))
                });
                const S = window.__fakeStore.zoew_scan_history_cod_dod;
                S.id_rr_keep = mk('id_rr_keep', '0688000111', [{ code: 'RK1', cod: 10 }, { code: 'RK2', cod: 20 }]);
                S.id_rr_gone = mk('id_rr_gone', '0688000222', [{ code: 'RG1', cod: 13 }, { code: 'RG2', cod: 17 }]);
                const rev = window.__fakeStore.zoew_daily_revenue_cod_dod[dk];
                rev.codDollar = Math.round((rev.codDollar + 60) * 100) / 100;
                rev.totalCount = rev.totalCount + 4;
                window.__fireAll();
            }, seed._dateKey);
            await page.waitForTimeout(300);

            const revRr0 = await revRr();
            await page.evaluate(() => {
                window.__txnConflict = {
                    path: 'zoew_scan_history_cod_dod/id_rr_keep',
                    mutate: (srv) => { if (srv && srv.barcodes) srv.barcodes[1].isClosed = true; }
                };
                window.removeSingleBarcode('id_rr_keep', 'RK1');
            });
            await page.waitForTimeout(900);
            const rrKeep = await page.evaluate(() => {
                const it = window.__fakeStore.zoew_scan_history_cod_dod.id_rr_keep;
                return it ? { n: it.barcodes.length, code: it.barcodes[0].code, closed: it.barcodes[0].isClosed, cod: it.cod } : null;
            });
            const revRr1 = await revRr();
            check(rrKeep && rrKeep.n === 1 && rrKeep.code === 'RK2' && rrKeep.closed === true && rrKeep.cod === 20,
                'ZoeAdmin: transaction រត់ម្តងទៀត ➜ យកលទ្ធផលនៃការរត់ចុងក្រោយ', JSON.stringify(rrKeep));
            check(Math.round((revRr0.codDollar - revRr1.codDollar) * 100) / 100 === 10 && (revRr0.totalCount - revRr1.totalCount) === 1,
                'ZoeAdmin: transaction រត់ម្តងទៀត ➜ កាត់លុយតែម្តង', JSON.stringify(revRr0) + ' ➜ ' + JSON.stringify(revRr1));

            const revRr2 = await revRr();
            const trashRr0 = await page.evaluate(() => Object.keys(window.__fakeStore.zoew_recently_deleted_cod_dod).length);
            await page.evaluate(() => {
                window.__txnConflict = {
                    path: 'zoew_scan_history_cod_dod/id_rr_gone',
                    mutate: (srv) => {
                        if (!srv || !srv.barcodes) return;
                        srv.barcodes = srv.barcodes.filter((b) => b.code !== 'RG1');
                        srv.count = 1; srv.cod = 17; srv.price = 17; srv.barcode = 'RG2';
                    }
                };
                window.removeSingleBarcode('id_rr_gone', 'RG1');
            });
            await page.waitForTimeout(900);
            const revRr3 = await revRr();
            const trashRr1 = await page.evaluate(() => Object.keys(window.__fakeStore.zoew_recently_deleted_cod_dod).length);
            check(revRr3.codDollar === revRr2.codDollar && revRr3.totalCount === revRr2.totalCount,
                'ZoeAdmin: ការរត់ទី ២ រកកញ្ចប់មិនឃើញ ➜ មិនកាត់លុយ (អថេរត្រូវ reset)',
                JSON.stringify(revRr2) + ' ➜ ' + JSON.stringify(revRr3));
            check(trashRr1 === trashRr0,
                'ZoeAdmin: ការរត់ទី ២ រកកញ្ចប់មិនឃើញ ➜ គ្មានធាតុធុងសំរាម', trashRr0 + ' ➜ ' + trashRr1);
            await page.evaluate(() => { window.__txnConflict = null; });
        }
        // --- transaction ជោគជ័យ តែការសរសេរធុងសំរាមបរាជ័យអស់ ៤ ដង ➜ ត្រូវស្តារកញ្ចប់មកវិញ ---
        if (app === 'ZoeAdmin') {
            await page.evaluate((dk) => {
                const now = Date.now();
                window.__fakeStore.zoew_scan_history_cod_dod.id_tw_rem = {
                    id: 'id_tw_rem', phone: '0699111000', scanDate: dk, createdAt: now - 300,
                    cod: 25, dod: 0, price: 25, count: 2, barcode: 'TW1', time: '17:00', isClosed: false,
                    barcodes: [
                        { code: 'TW1', time: '17:00', cod: 10, dod: 0, locker: 'L1', isClosed: false, isDeducted: false, isFromDeletion: false, createdAt: now - 300 },
                        { code: 'TW2', time: '17:01', cod: 15, dod: 0, locker: 'L2', isClosed: false, isDeducted: false, isFromDeletion: false, createdAt: now - 290 }
                    ]
                };
                window.__fakeStore.zoew_scan_history_cod_dod.id_tw_del = {
                    id: 'id_tw_del', phone: '0699111222', scanDate: dk, createdAt: now - 280,
                    cod: 6, dod: 0, price: 6, count: 1, barcode: 'TD1', time: '17:02', isClosed: false,
                    barcodes: [{ code: 'TD1', time: '17:02', cod: 6, dod: 0, locker: 'L3', isClosed: false, isDeducted: false, isFromDeletion: false, createdAt: now - 280 }]
                };
                const rev = window.__fakeStore.zoew_daily_revenue_cod_dod[dk];
                rev.codDollar = Math.round((rev.codDollar + 31) * 100) / 100;
                rev.totalCount = rev.totalCount + 3;
                window.__fireAll();
            }, seed._dateKey);
            await page.waitForTimeout(300);

            // ទប់តែការសរសេរទៅធុងសំរាម — transaction និងស្ថិតិត្រូវដើរធម្មតា ដើម្បីមើលការស្តារ
            await page.evaluate(() => {
                const origUpd = window.firebaseSDK.update;
                window.__unblockTrash = () => { window.firebaseSDK.update = origUpd; };
                window.firebaseSDK.update = function (r, obj) {
                    if (String(r.path || '').indexOf('zoew_recently_deleted_cod_dod') !== -1) {
                        return Promise.reject(new Error('permission_denied'));
                    }
                    return origUpd.call(this, r, obj);
                };
            });

            const revTw0 = await page.evaluate((dk) => ({ ...window.__fakeStore.zoew_daily_revenue_cod_dod[dk] }), seed._dateKey);
            await page.evaluate(() => window.removeSingleBarcode('id_tw_rem', 'TW1'));
            await page.waitForTimeout(14000);
            const remState = await page.evaluate((dk) => {
                const it = window.__fakeStore.zoew_scan_history_cod_dod.id_tw_rem;
                return {
                    rev: { ...window.__fakeStore.zoew_daily_revenue_cod_dod[dk] },
                    codes: it ? it.barcodes.map((b) => b.code).sort() : null,
                    deducted: it ? it.barcodes.map((b) => !!b.isDeducted) : null,
                    localTrash: (typeof deletedItems !== 'undefined' ? deletedItems : []).some((t) => t.barcode === 'TW1'),
                    serverTrash: Object.values(window.__fakeStore.zoew_recently_deleted_cod_dod).some((t) => t.barcode === 'TW1')
                };
            }, seed._dateKey);
            check(remState.codes && remState.codes.join(',') === 'TW1,TW2',
                'ZoeAdmin: ដក ➜ ធុងសំរាមបរាជ័យអស់ ➜ កញ្ចប់ត្រូវស្តារមកវិញ', JSON.stringify(remState.codes));
            check(remState.deducted && remState.deducted.every((d) => d === false),
                'ZoeAdmin: ដក ➜ ធុងសំរាមបរាជ័យ ➜ isDeducted ត្រូវ clear លើកញ្ចប់ដែលរស់វិញ', JSON.stringify(remState.deducted));
            check(remState.rev.codDollar === revTw0.codDollar && remState.rev.totalCount === revTw0.totalCount,
                'ZoeAdmin: ដក ➜ ធុងសំរាមបរាជ័យ ➜ ចំណូលត្រឡប់មកដើមវិញ',
                JSON.stringify(revTw0) + ' ➜ ' + JSON.stringify(remState.rev));
            check(remState.localTrash === false && remState.serverTrash === false,
                'ZoeAdmin: ដក ➜ ធុងសំរាមបរាជ័យ ➜ គ្មានធាតុធុងសំរាមឆក់សល់', JSON.stringify(remState));

            await page.evaluate(() => window.deleteSingleItem('id_tw_del'));
            await page.waitForTimeout(14000);
            const delState = await page.evaluate(() => ({
                live: !!window.__fakeStore.zoew_scan_history_cod_dod.id_tw_del,
                codes: window.__fakeStore.zoew_scan_history_cod_dod.id_tw_del
                    ? window.__fakeStore.zoew_scan_history_cod_dod.id_tw_del.barcodes.map((b) => b.code) : null,
                localTrash: (typeof deletedItems !== 'undefined' ? deletedItems : []).some((t) => t.id === 'id_tw_del'),
                serverTrash: !!window.__fakeStore.zoew_recently_deleted_cod_dod.id_tw_del
            }));
            check(delState.live && delState.codes && delState.codes.join(',') === 'TD1',
                'ZoeAdmin: លុប ➜ ធុងសំរាមបរាជ័យអស់ ➜ កញ្ចប់ត្រូវស្តារមកវិញ មិនបាត់', JSON.stringify(delState));
            check(delState.localTrash === false && delState.serverTrash === false,
                'ZoeAdmin: លុប ➜ ធុងសំរាមបរាជ័យ ➜ គ្មានធាតុធុងសំរាមឆក់សល់', JSON.stringify(delState));

            await page.evaluate(() => window.__unblockTrash());
            for (let i = errors.length - 1; i >= 0; i--) {
                if (/permission_denied|Trash write permanently failed|Error saving deleted item/.test(errors[i])) errors.splice(i, 1);
            }
        }
        // --- ច្បាប់សម្អាតស្វ័យប្រវត្តិ៖ 2h លុប · 8d ដក · មិនកាត់លុយស្ទួន ---
        {
            const revAuto = () => page.evaluate((k) => ({ ...window.__fakeStore.zoew_daily_revenue_cod_dod[k] }), seed._dateKey);
            const HOUR = 3600 * 1000;
            const DAY = 24 * HOUR;
            await page.evaluate((a) => {
                const now = Date.now();
                const S = window.__fakeStore.zoew_scan_history_cod_dod;
                const mk = (id, bcs, extra) => Object.assign({
                    id, phone: '060' + id.slice(-3), scanDate: a.dk, createdAt: now - 400,
                    cod: bcs.reduce((s, b) => s + b.cod, 0), dod: 0,
                    price: bcs.reduce((s, b) => s + b.cod, 0), count: bcs.length,
                    barcode: bcs[0].code, time: '16:00', isClosed: false,
                    barcodes: bcs.map((b) => ({
                        code: b.code, time: '16:00', cod: b.cod, dod: 0, locker: 'K1',
                        isClosed: !!b.closed, isDeducted: false, isFromDeletion: false, createdAt: now - 400
                    }))
                }, extra || {});

                S.id_auto_zzc = mk('id_auto_zzc', [{ code: 'AC1', cod: 11, closed: true }],
                    { isClosed: true, closedAt: now - 3 * a.HOUR });
                S.id_auto_zza = mk('id_auto_zza', [{ code: 'AA1', cod: 10 }, { code: 'AA2', cod: 20 }],
                    { createdAt: now - 9 * a.DAY });
                S.id_auto_zzp = mk('id_auto_zzp', [{ code: 'AP1', cod: 5, closed: true }, { code: 'AP2', cod: 7 }],
                    { createdAt: now - 9 * a.DAY });
                S.id_auto_zzf = mk('id_auto_zzf', [{ code: 'AF1', cod: 3, closed: true }],
                    { isClosed: true, closedAt: now - 1 * a.HOUR });
                S.id_auto_zzy = mk('id_auto_zzy', [{ code: 'AY1', cod: 4 }], { createdAt: now - 3 * a.DAY });

                const rev = window.__fakeStore.zoew_daily_revenue_cod_dod[a.dk];
                rev.codDollar = Math.round((rev.codDollar + 11 + 30 + 12 + 3 + 4) * 100) / 100;
                rev.totalCount = rev.totalCount + 7;
            }, { dk: seed._dateKey, HOUR, DAY });
            const revAuto0 = await revAuto();
            await page.evaluate(() => window.__fireAll());
            await page.waitForTimeout(1800);
            const revAuto1 = await revAuto();
            const autoState = await page.evaluate(() => {
                const S = window.__fakeStore.zoew_scan_history_cod_dod;
                const T = window.__fakeStore.zoew_recently_deleted_cod_dod;
                const trashOf = (code) => Object.values(T).find((t) => (t.barcodes || []).some((b) => b.code === code)) || null;
                const tc = trashOf('AC1'), ta = trashOf('AA1'), tp = trashOf('AP2');
                return {
                    closeGone: !S.id_auto_zzc,
                    closeTrash: tc ? { fromDel: tc.isFromDeletion, bFromDel: tc.barcodes[0].isFromDeletion, deducted: tc.barcodes[0].isDeducted } : null,
                    abanGone: !S.id_auto_zza,
                    abanTrash: ta ? { fromDel: ta.isFromDeletion, n: ta.barcodes.length, deducted: ta.barcodes.every((b) => b.isDeducted) } : null,
                    partLive: S.id_auto_zzp ? { n: S.id_auto_zzp.barcodes.length, code: S.id_auto_zzp.barcodes[0].code, closed: S.id_auto_zzp.isClosed, cod: S.id_auto_zzp.cod } : null,
                    partTrash: tp ? { n: tp.barcodes.length, code: tp.barcodes[0].code, fromDel: tp.isFromDeletion, deducted: tp.barcodes[0].isDeducted } : null,
                    freshLive: !!S.id_auto_zzf,
                    youngLive: !!S.id_auto_zzy
                };
            });

            check(autoState.closeGone && autoState.closeTrash && autoState.closeTrash.fromDel === true && autoState.closeTrash.bFromDel === true,
                app + ': ស្វ័យប្រវត្តិ 2h ➜ ចូលធុងសំរាមជា លុប', JSON.stringify(autoState.closeTrash));
            check(autoState.closeTrash && autoState.closeTrash.deducted === false,
                app + ': ស្វ័យប្រវត្តិ 2h ➜ មិនសម្គាល់ isDeducted (លុបមិនប៉ះលុយ)', JSON.stringify(autoState.closeTrash));
            check(autoState.abanGone && autoState.abanTrash && autoState.abanTrash.fromDel === false && autoState.abanTrash.n === 2 && autoState.abanTrash.deducted === true,
                app + ': ស្វ័យប្រវត្តិ 8d ➜ ចូលធុងសំរាមជា ដក និងសម្គាល់ isDeducted', JSON.stringify(autoState.abanTrash));
            check(autoState.partLive && autoState.partLive.n === 1 && autoState.partLive.code === 'AP1' && autoState.partLive.closed === true && autoState.partLive.cod === 5,
                app + ': ស្វ័យប្រវត្តិ 8d ដោយផ្នែក ➜ កញ្ចប់ដែលបិទរួចនៅដដែល', JSON.stringify(autoState.partLive));
            check(autoState.partTrash && autoState.partTrash.n === 1 && autoState.partTrash.code === 'AP2' && autoState.partTrash.fromDel === false && autoState.partTrash.deducted === true,
                app + ': ស្វ័យប្រវត្តិ 8d ដោយផ្នែក ➜ ដកតែកញ្ចប់ដែលហួសកំណត់', JSON.stringify(autoState.partTrash));
            check(autoState.freshLive && autoState.youngLive,
                app + ': ស្វ័យប្រវត្តិ ➜ មិនប៉ះកញ្ចប់ដែលនៅក្នុងបង្អួច 2h/8d', JSON.stringify(autoState));

            const droppedCod = Math.round((revAuto0.codDollar - revAuto1.codDollar) * 100) / 100;
            const droppedCount = revAuto0.totalCount - revAuto1.totalCount;
            check(droppedCod === 37 && droppedCount === 3,
                app + ': ស្វ័យប្រវត្តិ ➜ ដកលុយត្រឹមតែផ្នែក ដក (30+7) មិនរាប់ លុប',
                'រំពឹង cod -37 count -3 តែបាន cod -' + droppedCod + ' count -' + droppedCount);

            for (let i = 0; i < 3; i++) {
                await page.evaluate(() => window.__fireAll());
                await page.waitForTimeout(400);
            }
            const revAuto2 = await revAuto();
            check(revAuto2.codDollar === revAuto1.codDollar && revAuto2.totalCount === revAuto1.totalCount,
                app + ': ស្វ័យប្រវត្តិរត់ម្តងទៀត ➜ មិនកាត់លុយស្ទួន',
                JSON.stringify(revAuto1) + ' ➜ ' + JSON.stringify(revAuto2));

            if (app === 'ZoeAdmin') {
                const tid = await page.evaluate(() => {
                    const T = window.__fakeStore.zoew_recently_deleted_cod_dod;
                    const e = Object.entries(T).find(([, t]) => (t.barcodes || []).some((b) => b.code === 'AA1'));
                    return e ? e[0] : null;
                });
                await page.evaluate((t) => { window.promptRestoreDeletedItem(t); window.executeRestoreItem(); }, tid);
                await page.waitForTimeout(700);
                const revAuto3 = await revAuto();
                check(Math.round((revAuto3.codDollar - revAuto2.codDollar) * 100) / 100 === 30 && (revAuto3.totalCount - revAuto2.totalCount) === 2,
                    'ZoeAdmin: ស្តារពី ដក ស្វ័យប្រវត្តិ ➜ លុយបូកមកវិញគ្រប់',
                    JSON.stringify(revAuto2) + ' ➜ ' + JSON.stringify(revAuto3));
                const backDeduct = await page.evaluate(() => {
                    const it = Object.values(window.__fakeStore.zoew_scan_history_cod_dod).find((i) => (i.barcodes || []).some((b) => b.code === 'AA1'));
                    return it ? it.barcodes.map((b) => b.isDeducted) : null;
                });
                check(backDeduct && backDeduct.every((d) => d === false),
                    'ZoeAdmin: ស្តារពី ដក ស្វ័យប្រវត្តិ ➜ isDeducted ត្រូវ clear', JSON.stringify(backDeduct));
            }
        }
        // ផ្លូវបរាជ័យ៖ Firebase បដិសេធការសរសេរ ➜ ស្ថានភាព និងលុយត្រូវត្រឡប់មកដើមវិញ
        {
            await page.evaluate((dk) => {
                window.__fakeStore.zoew_scan_history_cod_dod.id_4000_eee = {
                    id: 'id_4000_eee', phone: '0611222333', scanDate: dk, createdAt: Date.now() - 200,
                    cod: 12, dod: 3, price: 15, count: 1, barcode: 'FF1', time: '14:00', isClosed: false,
                    barcodes: [{ code: 'FF1', time: '14:00', cod: 12, dod: 3, locker: 'E1', isClosed: false, isDeducted: false, isFromDeletion: false, createdAt: Date.now() - 200 }]
                };
                const rev = window.__fakeStore.zoew_daily_revenue_cod_dod[dk];
                rev.codDollar = (rev.codDollar || 0) + 12;
                rev.dodDollar = (rev.dodDollar || 0) + 3;
                rev.totalCount = (rev.totalCount || 0) + 1;
                window.__fireAll();
            }, seed._dateKey);
            await page.waitForTimeout(300);

            const before = await page.evaluate((dk) => ({
                rev: { ...window.__fakeStore.zoew_daily_revenue_cod_dod[dk] },
                pick: JSON.parse(JSON.stringify(window.__fakeStore.zoew_daily_pickup_cod_dod[dk] || {})),
                item: JSON.parse(JSON.stringify(window.__fakeStore.zoew_scan_history_cod_dod.id_4000_eee))
            }), seed._dateKey);

            // បដិសេធតែការសរសេរទៅ record នេះ — ស្ថិតិត្រូវសរសេរបានធម្មតា ដើម្បីមើលការ revert
            await page.evaluate(() => {
                const origTxn = window.firebaseSDK.runTransaction;
                const origUpd = window.firebaseSDK.update;
                window.__unblock = () => { window.firebaseSDK.runTransaction = origTxn; window.firebaseSDK.update = origUpd; };
                const blocked = (p) => String(p || '').indexOf('id_4000_eee') !== -1;
                window.firebaseSDK.runTransaction = function (r, fn) {
                    if (blocked(r.path)) return Promise.reject(new Error('permission_denied'));
                    return origTxn.call(this, r, fn);
                };
                window.firebaseSDK.update = function (r, obj) {
                    if (blocked(r.path) || Object.keys(obj).some(blocked)) return Promise.reject(new Error('permission_denied'));
                    return origUpd.call(this, r, obj);
                };
            });

            await page.evaluate(() => window.toggleCloseStatus('id_4000_eee'));
            await page.waitForTimeout(700);
            const afterFail = await page.evaluate((dk) => ({
                pick: JSON.parse(JSON.stringify(window.__fakeStore.zoew_daily_pickup_cod_dod[dk] || {})),
                localClosed: (typeof scanHistory !== 'undefined' ? scanHistory : []).filter((i) => i.id === 'id_4000_eee').map((i) => i.isClosed)[0],
                serverClosed: window.__fakeStore.zoew_scan_history_cod_dod.id_4000_eee.isClosed
            }), seed._dateKey);
            check(JSON.stringify(afterFail.pick) === JSON.stringify(before.pick),
                app + ': បិទបញ្ជីបរាជ័យ ➜ ស្ថិតិត្រឡប់មកដើមវិញ',
                JSON.stringify(before.pick) + ' ➜ ' + JSON.stringify(afterFail.pick));
            check(afterFail.localClosed === false && afterFail.serverClosed === false,
                app + ': បិទបញ្ជីបរាជ័យ ➜ ស្ថានភាពក្នុងសតិត្រឡប់មកបើកវិញ', JSON.stringify(afterFail));

            if (app === 'ZoeAdmin') {
                await page.evaluate(() => {
                    window.openEditBarcodePriceModal('id_4000_eee', 'FF1');
                    document.getElementById('editBcCodInput').value = '50';
                    document.getElementById('editBcDodInput').value = '0';
                    window.saveEditedBarcodePrice();
                });
                await page.waitForTimeout(700);
                const afterPriceFail = await page.evaluate((dk) => ({
                    rev: { ...window.__fakeStore.zoew_daily_revenue_cod_dod[dk] },
                    localCod: (typeof scanHistory !== 'undefined' ? scanHistory : []).filter((i) => i.id === 'id_4000_eee').map((i) => i.barcodes[0].cod)[0]
                }), seed._dateKey);
                check(afterPriceFail.rev.codDollar === before.rev.codDollar && afterPriceFail.rev.dodDollar === before.rev.dodDollar,
                    'ZoeAdmin: កែទឹកប្រាក់បរាជ័យ ➜ ចំណូលត្រឡប់មកដើមវិញ',
                    JSON.stringify(before.rev) + ' ➜ ' + JSON.stringify(afterPriceFail.rev));
                check(afterPriceFail.localCod === 12, 'ZoeAdmin: កែទឹកប្រាក់បរាជ័យ ➜ តម្លៃក្នុងសតិត្រឡប់មកដើម', String(afterPriceFail.localCod));

                await page.evaluate(() => window.deleteSingleItem('id_4000_eee'));
                await page.waitForTimeout(700);
                const afterDelFail = await page.evaluate(() => ({
                    stillLive: !!window.__fakeStore.zoew_scan_history_cod_dod.id_4000_eee,
                    inTrash: Object.keys(window.__fakeStore.zoew_recently_deleted_cod_dod).indexOf('id_4000_eee') !== -1,
                    localHas: (typeof scanHistory !== 'undefined' ? scanHistory : []).some((i) => i.id === 'id_4000_eee'),
                    localTrash: (typeof deletedItems !== 'undefined' ? deletedItems : []).some((i) => i.id === 'id_4000_eee')
                }));
                check(afterDelFail.stillLive && !afterDelFail.inTrash && afterDelFail.localHas && !afterDelFail.localTrash,
                    'ZoeAdmin: លុបបរាជ័យ ➜ កញ្ចប់នៅដដែល មិនជាប់ក្នុងធុងសំរាមក្នុងសតិ', JSON.stringify(afterDelFail));
            }

            await page.evaluate(() => window.__unblock());
            for (let i = errors.length - 1; i >= 0; i--) {
                if (/permission_denied/.test(errors[i])) errors.splice(i, 1);
            }
        }


        // --- លុបប្រវត្តិទាំងអស់ ត្រូវយកច្បាប់ចម្លងរបស់ server មិនមែនរបស់សតិ ---
        if (app === 'ZoeAdmin') {
            await page.evaluate(() => {
                Object.keys(window.__fakeStore.zoew_scan_history_cod_dod).forEach((k) => {
                    delete window.__fakeStore.zoew_scan_history_cod_dod[k];
                });
                Object.keys(window.__fakeStore.zoew_recently_deleted_cod_dod).forEach((k) => {
                    delete window.__fakeStore.zoew_recently_deleted_cod_dod[k];
                });
                window.__fireAll();
            });
            await page.waitForTimeout(300);
            await page.evaluate((dk) => {
                const now = Date.now();
                const mk = (id, phone, code, cod) => ({
                    id, phone, scanDate: dk, createdAt: now - 200, cod, dod: 0, price: cod, count: 1,
                    barcode: code, time: '20:00', isClosed: false,
                    barcodes: [{ code, time: '20:00', cod, dod: 0, locker: 'Q1', isClosed: false, isDeducted: false, isFromDeletion: false, createdAt: now - 200 }]
                });
                const S = window.__fakeStore.zoew_scan_history_cod_dod;
                S.id_cl_a = mk('id_cl_a', '0655111000', 'CL1', 8);
                S.id_cl_b = mk('id_cl_b', '0655111222', 'CL2', 9);
                S.id_cl_c = mk('id_cl_c', '0655111333', 'CL3', 6);
                window.__fireAll();
            }, seed._dateKey);
            await page.waitForTimeout(400);

            const revCl0 = await page.evaluate((k) => ({ ...window.__fakeStore.zoew_daily_revenue_cod_dod[k] }), seed._dateKey);
            await page.evaluate(() => {
                const S = window.__fakeStore.zoew_scan_history_cod_dod;
                S.id_cl_a.barcodes[0].isClosed = true;
                S.id_cl_a.barcodes[0].locker = 'Z5';
                S.id_cl_a.isClosed = true;
                delete S.id_cl_b;
                S.id_cl_new = {
                    id: 'id_cl_new', phone: '0655111444', scanDate: window.__fakeStore._dateKey,
                    createdAt: Date.now(), cod: 4, dod: 0, price: 4, count: 1, barcode: 'CL9',
                    time: '20:05', isClosed: false,
                    barcodes: [{ code: 'CL9', time: '20:05', cod: 4, dod: 0, locker: 'Q9', isClosed: false, isDeducted: false, isFromDeletion: false, createdAt: Date.now() }]
                };
                window.clearHistory();
            });
            await page.waitForTimeout(900);
            const clState = await page.evaluate((k) => {
                const S = window.__fakeStore.zoew_scan_history_cod_dod;
                const T = window.__fakeStore.zoew_recently_deleted_cod_dod;
                return {
                    trashA: T.id_cl_a ? { closed: T.id_cl_a.barcodes[0].isClosed, locker: T.id_cl_a.barcodes[0].locker, fromDel: T.id_cl_a.isFromDeletion, bFromDel: T.id_cl_a.barcodes[0].isFromDeletion } : null,
                    trashBGhost: !!T.id_cl_b,
                    trashC: !!T.id_cl_c,
                    liveA: !!S.id_cl_a, liveC: !!S.id_cl_c,
                    newSurvived: !!S.id_cl_new,
                    newInTrash: !!T.id_cl_new,
                    rev: { ...window.__fakeStore.zoew_daily_revenue_cod_dod[k] }
                };
            }, seed._dateKey);

            check(clState.trashA && clState.trashA.closed === true && clState.trashA.locker === 'Z5',
                'ZoeAdmin: លុបទាំងអស់ ➜ ធុងសំរាមផ្ទុកស្ថានភាពពិតរបស់ server', JSON.stringify(clState.trashA));
            check(clState.trashA && clState.trashA.fromDel === true && clState.trashA.bFromDel === true,
                'ZoeAdmin: លុបទាំងអស់ ➜ សម្គាល់ isFromDeletion គ្រប់កម្រិត', JSON.stringify(clState.trashA));
            check(clState.trashBGhost === false,
                'ZoeAdmin: លុបទាំងអស់ ➜ គ្មានធាតុខ្មោចសម្រាប់អ្វីដែលឧបករណ៍ផ្សេងលុបរួច', JSON.stringify(clState));
            check(clState.trashC === true && clState.liveA === false && clState.liveC === false,
                'ZoeAdmin: លុបទាំងអស់ ➜ អ្វីដែលនៅសល់ត្រូវលុបគ្រប់', JSON.stringify(clState));
            check(clState.newSurvived === true && clState.newInTrash === false,
                'ZoeAdmin: លុបទាំងអស់ ➜ កញ្ចប់ដែលទើបស្កេនពីឧបករណ៍ផ្សេង រួចខ្លួន', JSON.stringify(clState));
            check(clState.rev.codDollar === revCl0.codDollar && clState.rev.dodDollar === revCl0.dodDollar && clState.rev.totalCount === revCl0.totalCount,
                'ZoeAdmin: លុបទាំងអស់ ➜ ចំណូលមិនប្រែសោះ (គោលការណ៍ លុប)',
                JSON.stringify(revCl0) + ' ➜ ' + JSON.stringify(clState.rev));
        }

        // ចុចគ្រប់ប៊ូតុងដែលមើលឃើញ (បើក modal នីមួយៗ) ហើយមើលថាមួយណា crash
        const clickErrors = [];
        const btnIds = await page.evaluate(() => {
            const skip = /logout|signout|ចាកចេញ|delete|លុប|clear|reset|export|print/i;
            return [...document.querySelectorAll('button')]
                .filter((b) => b.id && getComputedStyle(b).display !== 'none' && !skip.test(b.id))
                .map((b) => b.id);
        });
        for (const bid of btnIds) {
            const before = errors.length;
            await page.evaluate((id) => { const b = document.getElementById(id); if (b) b.click(); }, bid);
            await page.waitForTimeout(120);
            if (errors.length > before) clickErrors.push(bid + ' ➜ ' + errors[errors.length - 1].slice(0, 160));
            await page.evaluate(() => {
                [...document.querySelectorAll('.modal')].forEach((m) => { if (!m.hasAttribute('data-nodismiss')) m.style.display = 'none'; });
            });
        }
        check(clickErrors.filter((e) => !/net::ERR_FAILED|Failed to load resource|ERR_BLOCKED|ERR_ABORTED/i.test(e)).length === 0,
            app + ': ចុចប៊ូតុងទាំងអស់ ➜ គ្មាន crash',
            clickErrors.slice(0, 6).join('\n        '));

        const real = errors.filter((e) => !/net::ERR_FAILED|Failed to load resource|ERR_BLOCKED|ERR_ABORTED/i.test(e));
        check(real.length === 0, app + ': គ្មានកំហុស runtime ពេលធ្វើអន្តរកម្ម', real.slice(0, 3).join(' | '));

        await ctx.close();
        server.close();
    }
    await browser.close();
    console.log('\n' + (fail ? 'FAIL ' + fail + ' / ជោគជ័យ ' + pass : 'PASS ' + pass + '/' + pass));
    process.exit(fail ? 1 : 0);
})();
