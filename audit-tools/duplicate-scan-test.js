// ថ្នាក់៖ ការទប់ស្កាត់ Barcode ស្ទួន — ជាន់ការពារទាំង ៥ ក្នុងកូដពិត។
// កញ្ចប់ស្ទួន = លុយស្ទួន ដូច្នេះថ្នាក់នេះប៉ះពាល់ចំណូលដោយផ្ទាល់។
//
//   ១. processScannedCode()  ➜ debounce កូដដដែលក្នុង ២.៥ វិនាទី
//   ២. triggerScanAction()   ➜ isBarcodeAlreadyUsed() (ប្រវត្តិ + ធុងសំរាម)
//   ៣. confirmPhone()        ➜ isBarcodeAlreadyUsed() ម្តងទៀត (ក្រោយបើកប្រអប់)
//   ៤. claimBarcodeInRegistry() ➜ transaction លើ server (ការពារឆ្លងឧបករណ៍ — ជាន់ពិត)
//   ៥. addOrUpdateEntry()    ➜ mergeAddedBarcode=false ➜ បញ្ច្រាសលុយវិញ
let chromium;
try { chromium = require('playwright-core').chromium; } catch (e) { console.log('SKIP — ត្រូវការ playwright-core'); process.exit(0); }
const CHROME = process.env.DUP_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const fs = require('fs'), http = require('http'), path = require('path');
if (!fs.existsSync(CHROME)) { console.log('SKIP — រកមិនឃើញ Chromium'); process.exit(0); }
const ROOT = process.env.DUP_APP_DIR || path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm' };

let pass = 0, fail = 0;
function ok(label, cond, detail) {
    if (cond) { console.log('  ok    ' + label); pass++; }
    else { console.log('  FAIL  ' + label + (detail !== undefined ? '\n        ' + JSON.stringify(detail) : '')); fail++; }
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

const LICENSE_STUB = `window.ZoeLicense = { getStatus: () => Promise.resolve({ state: 'active' }), setServerTimeOffset(){}, syncServerTime: () => Promise.resolve(), activate: () => Promise.resolve({ ok: true }), verifyKeyString: () => Promise.resolve({ ok: true }), clearActivation(){} };`;

const BOOT = function (seed) {
    const store = JSON.parse(JSON.stringify(seed));
    window.__fakeStore = store;
    window.__toasts = [];
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
    function fire(p) { listeners.filter((l) => l.path === p).forEach((l) => { try { l.cb(snapOf(p)); } catch (e) {} }); }
    function fireAll() { [...new Set(listeners.map((l) => l.path))].forEach(fire); }
    window.__fireAll = fireAll;
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
        runTransaction: (r, fn) => {
            const c = getPath(r.path);
            const n = fn(c === null ? null : JSON.parse(JSON.stringify(c)));
            if (n === undefined) return Promise.resolve({ committed: false, snapshot: snapOf(r.path) });
            setPath(r.path, n); fireAll(); return Promise.resolve({ committed: true, snapshot: snapOf(r.path) });
        }
    };
    window.dispatchEvent(new Event('firebasesdkready'));
};

function seedEmpty() {
    const t = new Date();
    const d = t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0');
    return {
        zoew_scan_history_cod_dod: {}, zoew_recently_deleted_cod_dod: {},
        zoew_daily_revenue_cod_dod: {}, zoew_monthly_revenue_cod_dod: {}, zoew_daily_pickup_cod_dod: {},
        zoew_barcode_registry: {}, zoew_settings: { exchange_rate: 4100 }, _dateKey: d
    };
}

(async () => {
    const browser = await chromium.launch({ executablePath: CHROME });
    const server = await serve(path.join(ROOT, 'ZoeW'));
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
    await page.addInitScript(`window.localStorage.setItem('zoew_firebase_config', ${JSON.stringify(JSON.stringify({ apiKey: 'k', databaseURL: 'https://fake-default-rtdb.firebaseio.com', projectId: 'p' }))});`);
    await page.addInitScript('(' + BOOT.toString() + ')(' + JSON.stringify(seedEmpty()) + ');');
    await page.goto('http://127.0.0.1:' + port + '/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction(() => typeof window.triggerScanAction === 'function' && window.__fakeStore, null, { timeout: 30000 });
    await page.evaluate(() => new Promise((r) => setTimeout(r, 400)));

    // ចាប់យក toast ដើម្បីអានសាររបស់អ្នកប្រើពិត
    await page.evaluate(() => {
        const real = window.showToast;
        window.showToast = function (msg) { window.__toasts.push(String(msg)); return real.apply(this, arguments); };
    });

    const closeAnyModal = () => page.evaluate(() => {
        document.querySelectorAll('.modal').forEach((m) => { if (m.style.display === 'flex') window.closeModal(m.id); });
        return document.querySelectorAll('.modal[style*="flex"]').length;
    });

    const scanAndSave = (code, phone) => page.evaluate(async (args) => {
        window.__toasts.length = 0;
        window.triggerScanAction(args.code);
        const phoneEl = document.getElementById('modalPhoneInput');
        const codEl = document.getElementById('modalCodInput');
        if (phoneEl) phoneEl.value = args.phone;
        if (codEl) codEl.value = '5';
        const modalOpen = document.getElementById('phoneModal').style.display === 'flex';
        if (modalOpen) await window.confirmPhone(false);
        await new Promise((r) => setTimeout(r, 250));
        return { modalOpen: modalOpen, toasts: window.__toasts.slice() };
    }, { code, phone });

    const snapshot = () => page.evaluate(() => {
        const hist = window.__fakeStore.zoew_scan_history_cod_dod || {};
        const codes = [];
        Object.keys(hist).forEach((id) => {
            const it = hist[id];
            (it.barcodes || []).forEach((b) => codes.push(String(b.code)));
        });
        const rev = window.__fakeStore.zoew_daily_revenue_cod_dod || {};
        const day = Object.keys(rev)[0];
        return {
            items: Object.keys(hist).length,
            codes: codes,
            registry: Object.keys(window.__fakeStore.zoew_barcode_registry || {}),
            cod: day ? rev[day].codDollar : 0,
            count: day ? rev[day].totalCount : 0
        };
    });

    console.log('\n=== ជាន់ ២+៤+៥៖ ស្កេនកូដដដែលពីរដង (ឧបករណ៍តែមួយ) ===');
    const first = await scanAndSave('ZTO900111', '012345678');
    ok('ការស្កេនលើកទី ១ ➜ ប្រអប់បើក', first.modalOpen === true, first);
    const afterFirst = await snapshot();
    ok('កញ្ចប់ត្រូវបានរក្សាទុក', afterFirst.codes.length === 1 && afterFirst.codes[0] === 'ZTO900111', afterFirst);
    ok('barcode ត្រូវបានកក់ក្នុង registry លើ server', afterFirst.registry.indexOf('ZTO900111') !== -1, afterFirst);
    ok('លុយបូក ១ ដង', afterFirst.cod === 5 && afterFirst.count === 1, afterFirst);

    // debounce ២.៥ វិនាទីត្រូវរំលងជាមុន ដើម្បីតេស្តជាន់ isBarcodeAlreadyUsed ដោយឡែក
    await page.evaluate(() => { window.lastScannedCode = ''; });
    const second = await scanAndSave('ZTO900111', '099999999');
    ok('ការស្កេនលើកទី ២ នៃកូដដដែល ➜ ប្រអប់ **មិន**បើក', second.modalOpen === false, second);
    ok('អ្នកប្រើឃើញសារ «មានក្នុងប្រព័ន្ធរួចហើយ»',
        second.toasts.some((t) => t.indexOf('មានក្នុងប្រព័ន្ធរួចហើយ') !== -1), second.toasts);
    const afterSecond = await snapshot();
    ok('គ្មានកញ្ចប់ថ្មីត្រូវបានបន្ថែម', afterSecond.codes.length === 1, afterSecond);
    ok('លុយ **មិន**បូកស្ទួន', afterSecond.cod === 5 && afterSecond.count === 1, afterSecond);

    console.log('\n=== អក្សរតូច/ធំ និងចន្លោះ ត្រូវចាត់ទុកជាកូដដដែល ===');
    await page.evaluate(() => { window.lastScannedCode = ''; });
    const caseVariant = await scanAndSave('  zto900111  ', '011111111');
    ok('«  zto900111  » ➜ ចាត់ទុកជាកូដដដែល ហើយបដិសេធ', caseVariant.modalOpen === false, caseVariant);
    const afterCase = await snapshot();
    ok('នៅតែមានកញ្ចប់ ១ ប៉ុណ្ណោះ', afterCase.codes.length === 1, afterCase);

    console.log('\n=== ជាន់ ២៖ កូដដែលនៅក្នុងធុងសំរាម ក៏ត្រូវបដិសេធដែរ ===');
    await page.evaluate(() => {
        window.__fakeStore.zoew_recently_deleted_cod_dod['del_1'] = {
            id: 'del_1', phone: '012000000', scanDate: '2026-08-23', createdAt: Date.now(),
            cod: 3, dod: 0, price: 3, count: 1, barcode: 'ZTO900222', time: '10:00', isClosed: false,
            barcodes: [{ code: 'ZTO900222', time: '10:00', cod: 3, dod: 0, locker: 'N/A', isClosed: false, isDeducted: true, isFromDeletion: false, createdAt: Date.now() }]
        };
        window.__fireAll();
        window.lastScannedCode = '';
    });
    await page.evaluate(() => new Promise((r) => setTimeout(r, 250)));
    const trashDup = await scanAndSave('ZTO900222', '013333333');
    ok('កូដក្នុងធុងសំរាម ➜ ប្រអប់មិនបើក', trashDup.modalOpen === false, trashDup);
    ok('អ្នកប្រើឃើញសារព្រមាន', trashDup.toasts.some((t) => t.indexOf('មានក្នុងប្រព័ន្ធរួចហើយ') !== -1), trashDup.toasts);

    console.log('\n=== ធុងសំរាម៖ កញ្ចប់ដែលលុបទាំងមូល (isFromDeletion) ក៏ត្រូវបដិសេធដែរ ===');
    await page.evaluate(() => {
        window.__fakeStore.zoew_recently_deleted_cod_dod['del_2'] = {
            id: 'del_2', phone: '012000001', scanDate: '2026-08-23', createdAt: Date.now(), deletedAt: Date.now(),
            cod: 4, dod: 0, price: 4, count: 1, barcode: 'ZTO900555', time: '10:00', isClosed: false, isFromDeletion: true,
            barcodes: [{ code: 'ZTO900555', time: '10:00', cod: 4, dod: 0, locker: 'N/A', isClosed: false, isDeducted: false, isFromDeletion: true, createdAt: Date.now() }]
        };
        window.__fireAll();
        window.lastScannedCode = '';
    });
    await page.evaluate(() => new Promise((r) => setTimeout(r, 250)));
    const wholeDeleted = await scanAndSave('ZTO900555', '015555555');
    ok('កញ្ចប់ដែលលុបទាំងមូល ➜ ប្រអប់មិនបើក', wholeDeleted.modalOpen === false, wholeDeleted);

    console.log('\n=== ធុងសំរាម៖ ការកក់លើ server ត្រូវនៅដដែល (ការពារឆ្លងឧបករណ៍) ===');
    // ការផ្លាស់កញ្ចប់ចូលធុងសំរាម **មិនត្រូវ**ដោះការកក់ទេ បើមិនដូច្នេះ ឧបករណ៍ផ្សេង
    // ដែលមិនទាន់ sync ធុងសំរាម នឹងអាចស្កេនកូដដដែលចូលម្តងទៀត ➜ លុយស្ទួន
    const trashRegistry = await page.evaluate(async () => {
        // លុបកញ្ចប់ ZTO900111 ដែលរក្សាទុករួច ចូលធុងសំរាមតាមផ្លូវពិត
        const hist = window.__fakeStore.zoew_scan_history_cod_dod;
        const id = Object.keys(hist).find((k) => (hist[k].barcodes || []).some((b) => b.code === 'ZTO900111'));
        if (!id) return { missing: true };
        await window.deleteSingleItem(id);
        await new Promise((r) => setTimeout(r, 400));
        return {
            stillClaimed: Object.keys(window.__fakeStore.zoew_barcode_registry || {}).indexOf('ZTO900111') !== -1,
            inTrash: Object.keys(window.__fakeStore.zoew_recently_deleted_cod_dod || {})
                .some((k) => (window.__fakeStore.zoew_recently_deleted_cod_dod[k].barcodes || []).some((b) => b.code === 'ZTO900111'))
        };
    });
    ok('លុបចូលធុងសំរាម ➜ កញ្ចប់ស្ថិតក្នុងធុងសំរាមពិត', trashRegistry.inTrash === true, trashRegistry);
    ok('លុបចូលធុងសំរាម ➜ ការកក់លើ server **នៅដដែល**', trashRegistry.stillClaimed === true, trashRegistry);
    await page.evaluate(() => { window.lastScannedCode = ''; });
    const afterTrash = await scanAndSave('ZTO900111', '016666666');
    ok('ស្កេនកូដនោះម្តងទៀត ➜ នៅតែបដិសេធ', afterTrash.modalOpen === false, afterTrash);

    console.log('\n=== លុបជាអចិន្ត្រៃយ៍ ➜ កូដត្រូវប្រើវិញបាន (មិនជាប់សោរហូត) ===');
    const afterPurge = await page.evaluate(async () => {
        const trash = window.__fakeStore.zoew_recently_deleted_cod_dod;
        const id = Object.keys(trash).find((k) => (trash[k].barcodes || []).some((b) => b.code === 'ZTO900111'));
        if (!id) return { missing: true };
        // អថេរ `let` កម្រិត module មិនស្ថិតលើ window ទេ ➜ ត្រូវកំណត់វាតាម
        // function ពិត (promptPermanentDelete) មិនមែនដោយសរសេរលើ window
        window.promptPermanentDelete(id);
        await window.executePermanentDelete();
        await new Promise((r) => setTimeout(r, 400));
        window.lastScannedCode = '';
        return { released: Object.keys(window.__fakeStore.zoew_barcode_registry || {}).indexOf('ZTO900111') === -1 };
    });
    ok('ការកក់លើ server ត្រូវបានដោះ', afterPurge.released === true, afterPurge);
    ok('គ្មានប្រអប់សល់បើកមុនស្កេនបន្ត (លក្ខខណ្ឌចាំបាច់)', (await closeAnyModal()) === 0);
    const reusable = await scanAndSave('ZTO900111', '017777777');
    ok('កូដដែលលុបជាអចិន្ត្រៃយ៍ ➜ ស្កេនចូលវិញបាន', reusable.modalOpen === true, reusable);

    console.log('\n=== ជាន់ ៤៖ ឧបករណ៍ផ្សេងកក់កូដរួច (មិនទាន់ sync មកយើង) ===');
    // registry មានរួច តែប្រវត្តិក្នុងសតិមិនទាន់ឃើញ ➜ មានតែ transaction លើ server ទើបចាប់បាន
    await page.evaluate(() => {
        window.__fakeStore.zoew_barcode_registry['ZTO900333'] = true;
        window.lastScannedCode = '';
    });
    const beforeRace = await snapshot();
    await closeAnyModal();
    const raced = await scanAndSave('ZTO900333', '014444444');
    ok('ប្រអប់បើក (ការត្រួតពិនិត្យក្នុងសតិមិនឃើញ)', raced.modalOpen === true, raced);
    ok('ការកក់លើ server បដិសេធ ➜ អ្នកប្រើឃើញសារ «ត្រូវបានបញ្ចូលរួចហើយ»',
        raced.toasts.some((t) => t.indexOf('ត្រូវបានបញ្ចូលរួចហើយ') !== -1), raced.toasts);
    const afterRace = await snapshot();
    ok('គ្មានកញ្ចប់ត្រូវបានរក្សាទុក', afterRace.codes.length === beforeRace.codes.length, { beforeRace, afterRace });
    ok('លុយមិនប្រែ', afterRace.cod === beforeRace.cod && afterRace.count === beforeRace.count, { beforeRace, afterRace });

    // ជាន់ ១ សំខាន់បំផុតពេលប្រអប់ **មិន**បើក — ឧ. កូដស្ទួនត្រូវបានបដិសេធ ហើយ
    // កាមេរ៉ានៅតែឃើញកូដនោះរាល់ស៊ុម។ បើគ្មាន debounce អ្នកប្រើទទួលសារព្រមាន
    // និងការញ័ររហូតដល់ ១៦ ដង/វិនាទី (អត្រាស្កេនថ្មី)។
    console.log('\n=== ជាន់ ១៖ debounce ពេលកាមេរ៉ាឃើញកូដស្ទួនរាល់ស៊ុម ===');
    const debounce = await page.evaluate(async () => {
        window.__toasts.length = 0;
        window.lastScannedCode = '';
        const modalBefore = document.getElementById('phoneModal').style.display === 'flex';
        let opens = 0;
        const realTrigger = window.triggerScanAction;
        window.triggerScanAction = function () { opens++; return realTrigger.apply(this, arguments); };
        // ZTO900111 ត្រូវបានរក្សាទុករួច ➜ ត្រូវបដិសេធ ➜ ប្រអប់មិនបើក
        for (let i = 0; i < 12; i++) window.processScannedCode('ZTO900111');
        window.triggerScanAction = realTrigger;
        return {
            opens: opens,
            modalBefore: modalBefore,
            modalOpen: document.getElementById('phoneModal').style.display === 'flex',
            warnings: window.__toasts.filter((t) => t.indexOf('មានក្នុងប្រព័ន្ធរួចហើយ') !== -1).length
        };
    });
    ok('ប្រអប់មិនបើក (លក្ខខណ្ឌចាំបាច់ ដើម្បីតេស្ត debounce ពិត)',
        debounce.modalBefore === false && debounce.modalOpen === false, debounce);
    ok('ស៊ុម ១២ ដែលឃើញកូដស្ទួន ➜ កេះការស្កេនតែ ១ ដង', debounce.opens === 1, debounce);
    ok('អ្នកប្រើទទួលសារព្រមានតែ ១ មិនមែន ១២', debounce.warnings === 1, debounce);

    await ctx.close(); server.close(); await browser.close();
    console.log('\n' + (fail ? '❌ ធ្លាក់ ' + fail + ' (ជោគជ័យ ' + pass + ')' : '✅ ជោគជ័យ ' + pass));
    process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e && e.stack || e); process.exit(1); });
