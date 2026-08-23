let chromium;
try { chromium = require('playwright-core').chromium; } catch (e) {
    console.log('SKIP — ត្រូវការ playwright-core (npm i playwright-core)');
    process.exit(0);
}
const CHROME = process.env.PAGENAV_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const fs = require('fs');
const http = require('http');
const path = require('path');
if (!fs.existsSync(CHROME)) {
    console.log('SKIP — រកមិនឃើញ Chromium នៅ ' + CHROME);
    process.exit(0);
}
const ROOT = process.env.PAGENAV_APP_DIR || path.join(__dirname, '..');
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

function dateKey(offsetDays) {
    const d = new Date();
    d.setDate(d.getDate() - (offsetDays || 0));
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function seedData() {
    const today = dateKey(0);
    const older = dateKey(3);
    return {
        user_roles: { 'admin-uid': 'admin' },
        zoew_scan_history_cod_dod: {
            id_1000_aaa: {
                id: 'id_1000_aaa', phone: '0968490421', scanDate: today, createdAt: Date.now() - 1000,
                cod: 30, dod: 0, price: 30, count: 2, barcode: 'BB2', time: '10:00', isClosed: false,
                barcodes: [
                    { code: 'BB1', time: '09:00', cod: 10, dod: 0, locker: 'A1', isClosed: false, isDeducted: false, isFromDeletion: false, createdAt: Date.now() - 2000 },
                    { code: 'BB2', time: '10:00', cod: 20, dod: 0, locker: '', isClosed: false, isDeducted: false, isFromDeletion: false, createdAt: Date.now() - 1000 }
                ]
            },
            id_1001_bbb: {
                id: 'id_1001_bbb', phone: '0777123456', scanDate: older, createdAt: Date.now() - 500,
                cod: 5, dod: 2, price: 7, count: 1, barcode: 'CC1', time: '11:00', isClosed: false,
                barcodes: [{ code: 'CC1', time: '11:00', cod: 5, dod: 2, locker: '', isClosed: false, isDeducted: false, isFromDeletion: false, createdAt: Date.now() - 500 }]
            }
        },
        zoew_recently_deleted_cod_dod: {},
        zoew_daily_revenue_cod_dod: { [today]: { codDollar: 30, dodDollar: 0, totalCount: 2 }, [older]: { codDollar: 5, dodDollar: 2, totalCount: 1 } },
        zoew_monthly_revenue_cod_dod: {},
        zoew_daily_pickup_cod_dod: {},
        zoew_barcode_registry: {},
        zoew_settings: { exchange_rate: 4100 },
        _today: today,
        _older: older
    };
}

(async () => {
    const browser = await chromium.launch({ executablePath: CHROME });
    const dir = path.join(ROOT, 'ZoeW');
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
    await page.addInitScript("window.localStorage.setItem('zoe_active_locker', 'A5');");
    await page.addInitScript('(' + FAKE_SDK.toString() + ')(' + JSON.stringify(seed) + ');');
    await page.goto('http://127.0.0.1:' + port + '/', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(2500);

    console.log('\n=== ទំព័រ និងរបា Slide ===');

    const layout = await page.evaluate(() => {
        const vis = (id) => { const el = document.getElementById(id); return !!el && getComputedStyle(el).display !== 'none'; };
        return {
            hasDataPage: !!document.getElementById('pageData'),
            hasEntryPage: !!document.getElementById('pageEntry'),
            hasTabBar: !!document.getElementById('pageTabBar'),
            hasDrawer: !!document.getElementById('sideDrawer'),
            dataVisible: vis('pageData'),
            entryVisible: vis('pageEntry'),
            historyOnData: !!document.querySelector('#pageData #historyTableBody'),
            statsOnData: !!document.querySelector('#pageData #grandTotalCount'),
            searchOnData: !!document.querySelector('#pageData #searchPhoneInput'),
            scannerOnEntry: !!document.querySelector('#pageEntry #video-container'),
            photoOnEntry: !!document.querySelector('#pageEntry #fileInput'),
            photoOnData: !!document.querySelector('#pageData #fileInput'),
            lockerPanelOnEntry: !!document.querySelector('#pageEntry #lockerPanel')
        };
    });
    check(layout.hasDataPage && layout.hasEntryPage && layout.hasTabBar, 'មានទំព័រ ២ និងរបា Tab', JSON.stringify(layout));
    check(layout.hasDrawer, 'មានរបា Slide (Menu/Setting)');
    check(layout.dataVisible && !layout.entryVisible, 'ចាប់ផ្ដើមនៅទំព័រទិន្នន័យ', JSON.stringify(layout));
    check(layout.historyOnData && layout.statsOnData && layout.searchOnData, 'ទំព័រ ១ មាន ប្រវត្តិ + គ្រប់គ្រងប្រចាំថ្ងៃ + ស្វែងរកលេខ', JSON.stringify(layout));
    check(layout.scannerOnEntry && layout.lockerPanelOnEntry, 'ទំព័រ ២ មានស្កេន និងផ្ទាំង Locker', JSON.stringify(layout));
    check(layout.photoOnEntry && !layout.photoOnData, 'ប៊ូតុងយក Barcode ពីរូបភាព ផ្លាស់ទៅទំព័រ ២', JSON.stringify(layout));

    const rows = await page.evaluate(() => document.querySelectorAll('#historyTableBody tr').length);
    check(rows >= 1, 'តារាងប្រវត្តិបង្ហាញជួរពីទិន្នន័យ Firebase', 'rows=' + rows);

    const entryList = await page.evaluate(() => {
        if (window.switchAppPage) window.switchAppPage('entry');
        if (window.setEntryScanMode) window.setEntryScanMode('parcel');
        const panel = document.getElementById('parcelPanel');
        const countEl = document.getElementById('entryListCount');
        return {
            visible: !!panel && getComputedStyle(panel).display !== 'none',
            rows: document.querySelectorAll('#entryListTableBody tr').length,
            count: countEl ? countEl.innerText : '',
            text: (document.getElementById('entryListTableBody') || {}).textContent || ''
        };
    });
    check(entryList.visible, 'របៀបបញ្ចូលកញ្ចប់បង្ហាញផ្ទាំងបញ្ជី', JSON.stringify(entryList));
    check(entryList.rows === 1 && entryList.count === '1',
        'បញ្ជីបញ្ចូលកញ្ចប់រាប់តែធាតុថ្ងៃនេះ', JSON.stringify(entryList));
    check(entryList.text.indexOf('0968490421') !== -1,
        'បញ្ជីបញ្ចូលកញ្ចប់បង្ហាញលេខទូរស័ព្ទ', entryList.text.slice(0, 120));

    await page.evaluate(() => { if (window.switchAppPage) window.switchAppPage('entry'); });
    await page.waitForTimeout(300);
    const afterSwitch = await page.evaluate(() => {
        const vis = (id) => { const el = document.getElementById(id); return !!el && getComputedStyle(el).display !== 'none'; };
        const tab = document.getElementById('pageTabEntry');
        return { data: vis('pageData'), entry: vis('pageEntry'), tabEntryActive: !!tab && tab.classList.contains('active') };
    });
    check(!afterSwitch.data && afterSwitch.entry && afterSwitch.tabEntryActive, 'ប្តូរទៅទំព័រ ២ ដំណើរការ', JSON.stringify(afterSwitch));

    await page.evaluate(() => { if (window.switchAppPage) window.switchAppPage('data'); });
    await page.waitForTimeout(200);
    const backToData = await page.evaluate(() => { const el = document.getElementById('pageData'); return !!el && getComputedStyle(el).display !== 'none'; });
    check(backToData, 'ត្រឡប់មកទំព័រ ១ វិញដំណើរការ');

    // របៀបប្រវត្តិពេញអេក្រង់ចាក់សោការរមូររបស់ #appPages (overflow-y: hidden)
    // ព្រោះការរមូរផ្ទេរទៅតារាងខាងក្នុងវិញ។ បើសោនោះនៅជាប់ពេលប្តូរទៅទំព័រ
    // «បញ្ចូលទិន្នន័យ» ➜ ទំព័រនោះ **រមូរមិនកើតទាល់តែសោះ** (អ្នកប្រើរាយការណ៍៖
    // «ចុចប្តូរទៅ tap បញ្ចូលទិន្នន័យ គាំង scroll»)។ សោត្រូវជាប់តែទំព័រទិន្នន័យ។
    const lockAcrossPages = await page.evaluate(async () => {
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        const pages = document.getElementById('appPages');
        const handle = document.getElementById('dragHandle');
        if (!pages || !handle || !window.switchAppPage) return null;
        if (!document.getElementById('dataSideSection').classList.contains('collapsed')) handle.click();
        await wait(120);
        const onData = {
            expanded: pages.classList.contains('history-expanded'),
            overflow: getComputedStyle(pages).overflowY
        };
        window.switchAppPage('entry');
        await wait(160);
        // បន្ថែមកម្ពស់ក្លែងក្លាយ ដើម្បីវាស់ថា **កន្សោមរមូរ** ដើរឬអត់
        // (មិនមែនវាស់ថាទិន្នន័យសាកល្បងវែងល្មមឬអត់ទេ)
        const probe = document.createElement('div');
        probe.style.height = '2000px';
        document.getElementById('pageEntry').appendChild(probe);
        pages.scrollTop = 400;
        const onEntry = {
            expanded: pages.classList.contains('history-expanded'),
            overflow: getComputedStyle(pages).overflowY,
            scrollable: pages.scrollHeight - pages.clientHeight > 8,
            scrolled: pages.scrollTop
        };
        pages.scrollTop = 0;
        probe.remove();
        window.switchAppPage('data');
        await wait(160);
        const backOnData = {
            expanded: pages.classList.contains('history-expanded'),
            overflow: getComputedStyle(pages).overflowY
        };
        handle.click();
        await wait(120);
        return { onData, onEntry, backOnData };
    });
    check(!!lockAcrossPages && lockAcrossPages.onData.expanded && lockAcrossPages.onData.overflow === 'hidden',
        'ទាញផ្ទាំងប្រវត្តិឡើង ➜ #appPages ចាក់សោការរមូរ (លក្ខខណ្ឌចាំបាច់)', JSON.stringify(lockAcrossPages));
    check(!!lockAcrossPages && !lockAcrossPages.onEntry.expanded,
        'ប្តូរទៅទំព័រ «បញ្ចូលទិន្នន័យ» ➜ សោ history-expanded ត្រូវដោះ', JSON.stringify(lockAcrossPages));
    check(!!lockAcrossPages && lockAcrossPages.onEntry.overflow !== 'hidden',
        'ទំព័រ «បញ្ចូលទិន្នន័យ» រមូរបាន (overflow មិនមែន hidden)', JSON.stringify(lockAcrossPages));
    check(!!lockAcrossPages && lockAcrossPages.onEntry.scrollable && lockAcrossPages.onEntry.scrolled > 0,
        'ទំព័រ «បញ្ចូលទិន្នន័យ» រមូរបានពិតប្រាកដ (scrollTop ផ្លាស់)', JSON.stringify(lockAcrossPages));
    check(!!lockAcrossPages && lockAcrossPages.backOnData.expanded,
        'ត្រឡប់មកទំព័រទិន្នន័យ ➜ របៀបប្រវត្តិពេញអេក្រង់ត្រឡប់មកវិញ', JSON.stringify(lockAcrossPages));

    const drawer = await page.evaluate(() => {
        if (!window.openSideDrawer || !document.getElementById('sideDrawer')) return { opened: false, closed: false, items: [] };
        window.openSideDrawer();
        const opened = document.getElementById('sideDrawer').classList.contains('open');
        const items = [...document.querySelectorAll('#sideDrawer .drawer-item')].map((b) => b.textContent.trim());
        window.closeSideDrawer();
        const closed = !document.getElementById('sideDrawer').classList.contains('open');
        return { opened, closed, items };
    });
    check(drawer.opened && drawer.closed, 'របា Slide បើក/បិទបាន', JSON.stringify(drawer));
    const joined = drawer.items.join(' | ');
    check(/Config \/ Reconfig/.test(joined), 'របា Slide មាន Config / Reconfig', joined);
    check(/API ស្វែងរកអតិថិជន/.test(joined), 'របា Slide មាន API ស្វែងរកអតិថិជន', joined);
    check(/តារាងអតិថិជន/.test(joined), 'របា Slide មាន តារាងអតិថិជន', joined);
    const authPlace = await page.evaluate(() => ({
        inDrawer: !!document.querySelector('#sideDrawer #navAuthBtn'),
        inNavbar: !!document.querySelector('.app-navbar #navAuthBtn')
    }));
    check(authPlace.inDrawer && !authPlace.inNavbar, 'ប៊ូតុង ចូល/ចាកចេញ ស្ថិតក្នុងរបា Slide', JSON.stringify(authPlace));

    const moreMenu = await page.evaluate(() => {
        const btn = document.querySelector('.header-more-btn');
        if (!btn) return '';
        btn.click();
        const txt = document.getElementById('menuContentContainer').textContent;
        document.getElementById('globalMoreMenu').classList.remove('show');
        return txt;
    });
    check(!/Config \/ Reconfig/.test(moreMenu) && !/តារាងអតិថិជន/.test(moreMenu),
        'ប៊ូតុង (...) លែងមានធាតុដែលផ្លាស់ទៅរបា Slide', moreMenu.replace(/\s+/g, ' ').slice(0, 200));
    check(/កែទឹកប្រាក់\/កញ្ចប់/.test(moreMenu), 'ប៊ូតុង (...) មាន កែទឹកប្រាក់/កញ្ចប់', moreMenu.replace(/\s+/g, ' ').slice(0, 200));
    const adjustInHeader = await page.evaluate(() => !!document.querySelector('.history-section .header-actions .manual-adjust-btn'));
    check(!adjustInHeader, 'ប៊ូតុង កែទឹកប្រាក់/កញ្ចប់ ចេញពីក្បាលតារាងហើយ');

    console.log('\n=== កំណត់ទីតាំង Locker ===');

    await page.evaluate(() => {
        if (window.switchAppPage) window.switchAppPage('entry');
        if (window.setEntryScanMode) window.setEntryScanMode('locker');
    });
    await page.waitForTimeout(400);
    const lockerMode = await page.evaluate(() => {
        const panel = document.getElementById('lockerPanel');
        const parcel = document.getElementById('parcelPanel');
        const label = document.getElementById('activeLockerLabel');
        return {
            parcelVisible: !!parcel && getComputedStyle(parcel).display !== 'none',
            panelVisible: !!panel && getComputedStyle(panel).display !== 'none',
            label: label ? label.innerText : '',
            indexed: Object.keys(typeof lockerBarcodeIndex !== 'undefined' ? lockerBarcodeIndex : {}).sort().join(',')
        };
    });
    check(lockerMode.panelVisible, 'របៀប Locker បង្ហាញផ្ទាំង Locker', JSON.stringify(lockerMode));
    check(!lockerMode.parcelVisible, 'របៀប Locker លាក់ផ្ទាំងបញ្ចូលកញ្ចប់', JSON.stringify(lockerMode));
    check(lockerMode.indexed === 'BB1,BB2,CC1', 'index barcode សង់ចេញពីប្រវត្តិដោយផ្ទាល់', lockerMode.indexed);
    check(lockerMode.label === 'A5', 'ទីតាំងបច្ចុប្បន្នបង្ហាញត្រឹមត្រូវ', lockerMode.label);

    // BB2 មិនទាន់មានទីតាំង ➜ ត្រូវចុះភ្លាម គ្មានប្រអប់សួរ
    await page.evaluate(() => { if (window.triggerScanAction) window.triggerScanAction('BB2'); });
    await page.waitForTimeout(900);
    const noConfirm = await page.evaluate(() => {
        const s = window.__fakeStore;
        const it = s.zoew_scan_history_cod_dod.id_1000_aaa;
        const bc = it && it.barcodes ? it.barcodes.find((b) => b.code === 'BB2') : null;
        const warn = document.getElementById('locationWarningModal');
        return {
            warnOpen: !!warn && getComputedStyle(warn).display !== 'none',
            locker: bc ? bc.locker : null,
            lookupNode: !!s.zoew_scanner_lookup
        };
    });
    check(!noConfirm.warnOpen, 'កញ្ចប់គ្មានទីតាំង ➜ គ្មានប្រអប់សួរបញ្ជាក់', JSON.stringify(noConfirm));
    check(noConfirm.locker === 'A5', 'កញ្ចប់គ្មានទីតាំង ➜ ចុះទីតាំងភ្លាម', JSON.stringify(noConfirm));
    check(!noConfirm.lookupNode, 'សរសេរចូលប្រវត្តិដោយផ្ទាល់ គ្មាន zoew_scanner_lookup', JSON.stringify(noConfirm));

    // BB1 មានទីតាំង A1 រួច ➜ ត្រូវសួរបញ្ជាក់ការផ្លាស់ទី
    await page.evaluate(() => { if (window.triggerScanAction) window.triggerScanAction('BB1'); });
    await page.waitForTimeout(700);
    const withConfirm = await page.evaluate(() => {
        const warn = document.getElementById('locationWarningModal');
        const txt = document.getElementById('locationWarningText');
        const it = window.__fakeStore.zoew_scan_history_cod_dod.id_1000_aaa;
        const bc = it && it.barcodes ? it.barcodes.find((b) => b.code === 'BB1') : null;
        return {
            warnOpen: !!warn && getComputedStyle(warn).display !== 'none',
            text: txt ? txt.innerText : '',
            stillA1: bc ? bc.locker : null
        };
    });
    check(withConfirm.warnOpen, 'កញ្ចប់មានទីតាំងរួច ➜ បើកប្រអប់សួរបញ្ជាក់', JSON.stringify(withConfirm));
    check(/ផ្លាស់ទី/.test(withConfirm.text) && /A5/.test(withConfirm.text), 'សារសួរបញ្ជាក់និយាយពីការផ្លាស់ទី', withConfirm.text);
    check(withConfirm.stillA1 === 'A1', 'មុនបញ្ជាក់ ➜ ទីតាំងមិនទាន់ប្តូរ', withConfirm.stillA1);

    await page.evaluate(() => { if (window.confirmLocationChange) window.confirmLocationChange(); });
    await page.waitForTimeout(900);
    const moved = await page.evaluate(() => {
        const warn = document.getElementById('locationWarningModal');
        const it = window.__fakeStore.zoew_scan_history_cod_dod.id_1000_aaa;
        const bc = it && it.barcodes ? it.barcodes.find((b) => b.code === 'BB1') : null;
        return { locker: bc ? bc.locker : null, warnOpen: !!warn && getComputedStyle(warn).display !== 'none' };
    });
    check(moved.locker === 'A5' && !moved.warnOpen, 'បញ្ជាក់ ➜ ផ្លាស់ទីទីតាំងជោគជ័យ', JSON.stringify(moved));

    const listRendered = await page.evaluate(() => document.querySelectorAll('#lockerListTableBody tr').length);
    check(listRendered >= 1, 'បញ្ជីទីតាំង Locker បង្ហាញជួរ', 'rows=' + listRendered);

    console.log('\n=== លុបទាំងអស់ តាមតម្រងថ្ងៃ ===');

    await page.evaluate(() => {
        if (window.switchAppPage) window.switchAppPage('data');
        window.filterDataByDate('today');
    });
    await page.waitForTimeout(300);

    const pinGate = await page.evaluate(() => {
        if (window.requestPinBeforeClearHistory) window.requestPinBeforeClearHistory();
        const open = [...document.querySelectorAll('.modal')].filter((m) => getComputedStyle(m).display !== 'none').map((m) => m.id);
        open.forEach((id) => window.closeModal(id));
        return {
            open,
            live: Object.keys(window.__fakeStore.zoew_scan_history_cod_dod || {}).length
        };
    });
    check(pinGate.open.some((id) => id === 'pinModal' || id === 'pinSetupModal'),
        'លុបទាំងអស់ ➜ ទាមទារ PIN មុនដំណើរការ', JSON.stringify(pinGate));
    check(pinGate.live === 2, 'មុនបញ្ចូល PIN ➜ មិនទាន់លុបអ្វីទេ', JSON.stringify(pinGate));

    await page.evaluate(() => window.clearHistory());
    await page.waitForTimeout(2500);
    const afterClear = await page.evaluate(() => {
        const s = window.__fakeStore;
        return {
            live: Object.keys(s.zoew_scan_history_cod_dod || {}).sort(),
            trash: Object.keys(s.zoew_recently_deleted_cod_dod || {}).sort()
        };
    });
    check(afterClear.live.join(',') === 'id_1001_bbb', 'លុបទាំងអស់ ➜ លុបតែធាតុក្នុងតម្រង «ថ្ងៃនេះ»', JSON.stringify(afterClear));
    check(afterClear.trash.join(',') === 'id_1000_aaa', 'លុបទាំងអស់ ➜ ធាតុថ្ងៃផ្សេងមិនចូលធុងសំរាម', JSON.stringify(afterClear));

    const real = errors.filter((e) => !/net::ERR_FAILED|Failed to load resource|ERR_BLOCKED|ERR_ABORTED/i.test(e));
    check(real.length === 0, 'គ្មានកំហុស runtime ពេលធ្វើអន្តរកម្ម', real.slice(0, 3).join(' | '));

    await ctx.close();
    server.close();
    await browser.close();

    console.log('\n' + (fail === 0 ? 'PASS ' + pass + '/' + pass : 'FAIL ' + fail + ' — page-nav test'));
    process.exit(fail === 0 ? 0 : 1);
})();
