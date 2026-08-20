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

function serve(dir, port) {
    return new Promise((res) => {
        const s = http.createServer((req, rsp) => {
            let p = decodeURIComponent(req.url.split('?')[0]);
            if (p === '/') p = '/index.html';
            const f = path.join(dir, p);
            if (!f.startsWith(dir) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rsp.writeHead(404); return rsp.end(); }
            rsp.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'text/plain' });
            rsp.end(fs.readFileSync(f));
        });
        s.listen(port, () => res(s));
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
        runTransaction: (r, fn) => {
            window.__writeLog.push({ op: 'txn', path: r.path });
            const cur = getPath(r.path);
            const next = fn(cur === null ? null : JSON.parse(JSON.stringify(cur)));
            if (next === undefined) return Promise.resolve({ committed: false, snapshot: snapOf(r.path) });
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
    let port = 8530;
    for (const app of ['ZoeAdmin', 'ZoeW', 'Zoescan']) {
        console.log('\n=== ' + app + ' ===');
        const dir = path.join(ROOT, app);
        const server = await serve(dir, port);
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
            await ctx.close(); server.close(); port++; continue;
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
        port++;
    }
    await browser.close();
    console.log('\n' + (fail ? 'FAIL ' + fail + ' / ជោគជ័យ ' + pass : 'PASS ' + pass + '/' + pass));
    process.exit(fail ? 1 : 0);
})();
