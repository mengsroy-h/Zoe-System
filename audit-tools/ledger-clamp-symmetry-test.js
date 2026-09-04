// ថ្នាក់៖ **ការ clamp ត្រឹម 0 ធ្វើឲ្យ «អនុវត្ត ➜ ដកវិញ» លែងជាគូបញ្ច្រាស
//         ➜ ចំណូលកើតឡើងពីអាកាសធាតុ។**
//
// 🔴 **កំហុសលុយពិត** (វាស់ 2026-09-03; `run-all.sh` **បៃតងទាំង ១៣០** លើ tree មុនកែ)។
//
// រាល់ផ្លូវលុយសរសេរតាមគំរូ «អនុវត្តជាមុន ➜ ដកវិញពេលបរាជ័យ» ៖
//   addRevenueToDailyAndMonthlyRecord(d, -X)   ...ធ្លាក់...   addRevenueToDailyAndMonthlyRecord(d, +X)
// ហើយ **ទាំងសតិ ទាំង transaction លើ server** clamp លទ្ធផលត្រឹម `0`
// (ព្រោះ rules ទាមទារ `newData.val() >= 0`)។ ដូច្នេះពេលតម្លៃដើម **តូចជាង X** ៖
//
//   | ជំហាន        | គណនា          | លទ្ធផល |
//   |--------------|---------------|--------|
//   | មុន          |               | 3.25   |
//   | អនុវត្ត −4    | 3.25 − 4 = −0.75 ➜ clamp | 0 |
//   | ដកវិញ +4     | 0 + 4         | **4**  |
//
// ➜ **ចំណូលឡើងពី 3.25 ទៅ 4 ដោយគ្មានកញ្ចប់ណាមួយ** ។ ចំនួនដែលកើតឡើងស្មើនឹង
// ចំនួនដែល clamp លេបបាត់ (0.75)។ ⛔ វាកើតលើ **គ្រប់ផ្លូវដកវិញ** ៖ កែទឹកប្រាក់ ·
// «ដក» ដែលការសរសេរធុងសំរាមធ្លាក់ · សម្អាត ៨ ថ្ងៃដែលធ្លាក់ · ការស្កេនដែល
// រក្សាទុកមិនបាន · និង **ស្ថិតិយក** ដែលមាន clamp ដូចគ្នា។
//
// ⚠️ **ហេតុអ្វី checker ១៣០ បៃតងទាំងអស់** ៖ គ្មានឯកសារណាដាក់ ledger ក្នុង
//   ស្ថានភាព «តម្លៃដើម **តូចជាង** delta ដែលនឹងដក» មុនកេះផ្លូវដកវិញសោះ។
//   `revenue-fuzz-test.js` ទៅដល់វា **តែក្នុងលំដាប់ជ្រៅ** (រកឃើញនៅ run=102
//   × 50 op ខណៈលំនាំដើមជា 12 × 45) ➜ ការរត់ធម្មតាមិនដែលឆ្លងព្រំដែន 0 ។
//   នេះជា **សំណួរទី ៨** ៖ «តើ checker ដាក់ប្រព័ន្ធក្នុង *ស្ថានភាព* ណា?»។
//
// ច្បាប់៖ **ការដកវិញត្រូវដក *delta ដែលបានអនុវត្តពិត* មិនមែន delta ដែលស្នើ។**
//   `applyLedgerBucketDelta()` ត្រឡប់ delta ពិត (`after − before`) ហើយ
//   `revertRevenueLedgerDelta()` ប្រើវា ➜
//   `after' = max(0, after − (after − before)) = before` **ជានិច្ច**។
//
// **Mutation ដែលវាស់រួច** ៖ ៥ ➜ ចាប់បាន ៤។
//   • `const d = memoryApplied` (មិនគោរពសាលក្រម server) ➜ ចាប់បាន (សេណារីយ៉ូ ៧)
//   • ស្ថិតិយក ៖ ការដកទ្វេដង ➜ ចាប់បាន (សេណារីយ៉ូ ៦ខ — ចាប់ពី 2.27.0
//     ស្ថិតិយករក្សា **សំណុំ barcode** ➜ ការដកទ្វេដងមិនអាចកើតបានទេ)
//   • undo វិលទៅ `-codDiff/-dodDiff` ឆៅ ➜ ចាប់បាន (សេណារីយ៉ូ ១)
//   • ដកការកែទាំងមូល (`origin/main`) ➜ ចាប់បាន ៦
//   ⚠️ **equivalent mutant ១** ៖ `applyLedgerBucketDelta` ត្រឡប់ delta ដែល
//   *ស្នើ* ជំនួស delta ដែល *អនុវត្ត* — សតិខុសបណ្តោះអាសន្ន តែ listener
//   `onValue(dbRefDailyRevenue)` សរសេរជាន់សតិពី server វិញក្នុងរយៈពេលមិល្លីវិនាទី
//   ➜ **លទ្ធផលដែលអ្នកប្រើឃើញមិនប្រែ**។ កុំសាងការអះអាងក្លែងសម្រាប់វា។
//
// ⛔ ទិសផ្ទុយត្រូវរក្សា ៖ ការ clamp នៅតែការពារតម្លៃអវិជ្ជមាន (rules) ·
//   គូអនុវត្ត/ដកវិញ **ឆ្ងាយពីសូន្យ** នៅតែលុបគ្នាដូចមុន · ការដកពិត ១ ដង
//   នៅតែដកដដែល។ តេស្តអះអាង **២ ខាង**។
let chromium;
try { chromium = require('playwright-core').chromium; } catch (e) { console.log('SKIP — ត្រូវការ playwright-core'); process.exit(0); }
const CHROME = process.env.CLAMPSYM_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const fs = require('fs'), http = require('http'), path = require('path');
if (!fs.existsSync(CHROME)) { console.log('SKIP — រកមិនឃើញ Chromium'); process.exit(0); }
const ROOT = process.env.CLAMPSYM_APP_DIR || path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm' };
let pass = 0, fail = 0, assertions = 0;
function ok(l, c, d) { assertions++; if (c) { console.log('  ok    ' + l); pass++; } else { console.log('  FAIL  ' + l + (d !== undefined ? '\n        ' + JSON.stringify(d) : '')); fail++; } }
function serve(dir) {
    return new Promise((res) => {
        const s = http.createServer((rq, rp) => {
            let p = decodeURIComponent(rq.url.split('?')[0]);
            if (p === '/') p = '/index.html';
            const f = path.join(dir, p);
            if (!f.startsWith(dir) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rp.writeHead(404); return rp.end(); }
            rp.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'text/plain' });
            rp.end(fs.readFileSync(f));
        });
        s.listen(0, '127.0.0.1', () => res(s));
    });
}
const LICENSE_STUB = `window.ZoeLicense={getStatus:()=>Promise.resolve({state:'active'}),setServerTimeOffset(){},syncServerTime:()=>Promise.resolve(),activate:()=>Promise.resolve({ok:true}),verifyKeyString:()=>Promise.resolve({ok:true}),clearActivation(){}};`;

const BOOT = function (seed) {
    const store = JSON.parse(JSON.stringify(seed));
    window.__fakeStore = store;
    window.__failTrashWrite = false;
    window.__failHistoryTx = false;
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
        if (val && typeof val === 'object' && typeof val.__increment === 'number') {
            const base = typeof cur[last] === 'number' ? cur[last] : 0;
            cur[last] = Math.round((base + val.__increment + Number.EPSILON) * 100) / 100;
            return;
        }
        if (val === null) delete cur[last]; else cur[last] = JSON.parse(JSON.stringify(val));
    }
    window.__setPathQuiet = setPath;
    function snapOf(p) {
        const v = getPath(p);
        return { val: () => (v === undefined || v === null) ? null : (typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v), exists: () => v !== null && v !== undefined };
    }
    function fire(p) { listeners.filter((l) => l.path === p).forEach((l) => { try { l.cb(snapOf(p)); } catch (e) {} }); }
    function fireAll() { [...new Set(listeners.map((l) => l.path))].forEach(fire); }
    window.__fireAll = fireAll;
    function denied(kind) {
        const e = new Error('PERMISSION_DENIED ' + kind);
        e.code = 'PERMISSION_DENIED';
        e.noRetry = true;
        return Promise.reject(e);
    }
    const user = { uid: 'u', email: 'a@b.c', getIdToken: () => Promise.resolve('t'), metadata: { lastSignInTime: new Date().toISOString() } };
    window.firebaseSDK = {
        initializeApp: () => ({ name: 'f' }), getApps: () => [], deleteApp: () => Promise.resolve(),
        getAuth: () => ({ currentUser: user }),
        onAuthStateChanged: (a, cb) => { setTimeout(() => cb(user), 0); return () => {}; },
        signInWithEmailAndPassword: () => Promise.resolve({ user }), signOut: () => Promise.resolve(),
        setPersistence: () => Promise.resolve(), browserLocalPersistence: {}, browserSessionPersistence: {},
        getIdTokenResult: () => Promise.resolve({ authTime: new Date().toISOString(), claims: {} }),
        getDatabase: () => ({ fake: true }),
        ref: (d, p) => ({ path: p === undefined ? '' : String(p) }),
        increment: (n) => ({ __increment: n }),
        onValue: (r, cb) => {
            listeners.push({ path: r.path, cb });
            setTimeout(() => { if (r.path === '.info/connected') cb({ val: () => true }); else cb(snapOf(r.path)); }, 0);
            return () => {};
        },
        off: () => {}, goOnline: () => {},
        get: (r) => Promise.resolve(snapOf(r.path)),
        set: (r, v) => { setPath(r.path, v); fireAll(); return Promise.resolve(); },
        update: (r, o) => {
            const base = r.path ? r.path + '/' : '';
            if (window.__failTrashWrite && (base + Object.keys(o)[0]).indexOf('zoew_recently_deleted_cod_dod') === 0) return denied('trash');
            Object.keys(o).forEach((k) => setPath(base + k, o[k]));
            fireAll();
            return Promise.resolve();
        },
        runTransaction: (r, fn) => {
            if (window.__failHistoryTx && String(r.path).indexOf('zoew_scan_history_cod_dod/') === 0) return denied('history');
            const c = getPath(r.path);
            const n = fn(c === null ? null : JSON.parse(JSON.stringify(c)));
            if (n === undefined) return Promise.resolve({ committed: false, snapshot: snapOf(r.path) });
            setPath(r.path, n); fireAll();
            return Promise.resolve({ committed: true, snapshot: snapOf(r.path) });
        }
    };
    window.dispatchEvent(new Event('firebasesdkready'));
};

function today() {
    const t = new Date();
    return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0');
}

function bc(code, cod, dod, closed) {
    return { code, time: '10:00', cod, dod, locker: 'A1', isClosed: !!closed, isDeducted: false, isFromDeletion: false, createdAt: Date.now() - 60000 };
}
function item(id, phone, bcs, extra) {
    const d = today();
    const base = {
        id, phone, scanDate: d, createdAt: Date.now() - 60000,
        cod: Math.round(bcs.reduce((s, b) => s + b.cod, 0) * 100) / 100,
        dod: Math.round(bcs.reduce((s, b) => s + b.dod, 0) * 100) / 100,
        price: Math.round(bcs.reduce((s, b) => s + b.cod + b.dod, 0) * 100) / 100,
        count: bcs.length, barcode: bcs[bcs.length - 1].code, time: '10:00',
        isClosed: bcs.every((b) => b.isClosed), barcodes: bcs
    };
    return Object.assign(base, extra || {});
}

function seed(hist, revenue, pickup) {
    return {
        zoew_scan_history_cod_dod: hist || {},
        zoew_recently_deleted_cod_dod: {},
        zoew_daily_revenue_cod_dod: revenue ? { [today()]: revenue } : {},
        zoew_monthly_revenue_cod_dod: revenue ? { [today().substring(0, 7)]: revenue } : {},
        zoew_daily_pickup_cod_dod: pickup ? { [today()]: pickup } : {},
        zoew_barcode_registry: {},
        zoew_settings: { exchange_rate: 4100 }
    };
}

async function boot(browser, port, seedData) {
    const ctx = await browser.newContext({ viewport: { width: 412, height: 780 } });
    const page = await ctx.newPage();
    page.on('dialog', (d) => d.accept());
    await page.route('**', (route) => {
        const u = route.request().url();
        if (u.indexOf('/license-verify.js') !== -1) return route.fulfill({ status: 200, contentType: 'application/javascript', body: LICENSE_STUB });
        if (u.startsWith('http://127.0.0.1:' + port)) return route.continue();
        return route.abort();
    });
    await page.addInitScript(`window.localStorage.setItem('zoew_firebase_config', ${JSON.stringify(JSON.stringify({ apiKey: 'k', databaseURL: 'https://fake-default-rtdb.firebaseio.com', projectId: 'p' }))});`);
    await page.addInitScript('(' + BOOT.toString() + ')(' + JSON.stringify(seedData) + ');');
    await page.goto('http://127.0.0.1:' + port + '/', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(1600);
    return { ctx, page };
}

const rev = (page) => page.evaluate((k) => (window.__fakeStore.zoew_daily_revenue_cod_dod || {})[k] || null, today());
const mrev = (page) => page.evaluate((k) => (window.__fakeStore.zoew_monthly_revenue_cod_dod || {})[k] || null, today().substring(0, 7));
const pick = (page) => page.evaluate((k) => (window.__fakeStore.zoew_daily_pickup_cod_dod || {})[k] || null, today());
// ⛔ សតិត្រូវអះអាងដែរ ៖ ការដកវិញដែលត្រឹមត្រូវតែខាង server ទុកឲ្យអេក្រង់
// បង្ហាញលេខខុស រហូតដល់ snapshot បន្ទាប់មកដល់ — នោះជាការកុហកចំពោះអ្នកប្រើ។
const memRev = (page) => page.evaluate((k) => (typeof dailyRevenueData !== 'undefined' ? (dailyRevenueData[k] || null) : null), today());

(async () => {
    const dir = path.join(ROOT, 'ZoeW');
    if (!fs.existsSync(path.join(dir, 'app.js'))) { console.log('  FAIL  រកមិនឃើញ ZoeW/app.js នៅ ' + dir); process.exit(1); }
    const server = await serve(dir);
    const port = server.address().port;
    const browser = await chromium.launch({ executablePath: CHROME });

    // ១. កែទឹកប្រាក់ ខណៈ barcode ត្រូវឧបករណ៍ផ្សេងដកចេញរួច (ទិដ្ឋភាពមូលដ្ឋានចាស់)
    {
        const s = seed({ it1: item('it1', '0968490421', [bc('AA1', 0, 4)]) }, { codDollar: 0, dodDollar: 3.25, totalCount: 1 });
        const { ctx, page } = await boot(browser, port, s);
        // ឧបករណ៍ផ្សេងដក AA1 ចេញ ➜ server លែងមាន តែសតិយើងនៅមាន (គ្មាន fireAll)
        await page.evaluate(() => { window.__setPathQuiet('zoew_scan_history_cod_dod/it1', null); });
        await page.evaluate(() => {
            window.openEditBarcodePriceModal('it1', 'AA1');
            const c = document.getElementById('editBcCodInput'); if (c) c.value = '0';
            const d = document.getElementById('editBcDodInput'); if (d) d.value = '0';
            window.saveEditedBarcodePrice();
        });
        await page.waitForTimeout(700);
        const after = await rev(page);
        const afterM = await mrev(page);
        const afterMem = await memRev(page);
        ok('កែទឹកប្រាក់ដែលធ្លាក់ ➜ ចំណូលថ្ងៃមិនកើតឡើងពីការ clamp (3.25 នៅ 3.25)', after && after.dodDollar === 3.25, after);
        ok('កែទឹកប្រាក់ដែលធ្លាក់ ➜ ចំណូលខែក៏មិនកើតឡើងដែរ', afterM && afterM.dodDollar === 3.25, afterM);
        ok('កែទឹកប្រាក់ដែលធ្លាក់ ➜ លេខក្នុងសតិ (អ្វីអ្នកប្រើឃើញ) ក៏ 3.25 ដែរ', afterMem && afterMem.dodDollar === 3.25, afterMem);
        await ctx.close();
    }

    // ២. «ដក» barcode ខណៈការសរសេរធុងសំរាមធ្លាក់ ➜ ការបូកមកវិញមិនត្រូវលើស
    {
        const s = seed({ it2: item('it2', '0777123456', [bc('BB1', 5, 0), bc('BB2', 1, 0)]) }, { codDollar: 2, dodDollar: 0, totalCount: 2 });
        const { ctx, page } = await boot(browser, port, s);
        await page.evaluate(() => { window.__failTrashWrite = true; });
        await page.evaluate(() => window.removeSingleBarcode('it2', 'BB1'));
        await page.waitForTimeout(1200);
        const after = await rev(page);
        const afterM = await mrev(page);
        ok('«ដក» ដែលធុងសំរាមធ្លាក់ ➜ ចំណូលថ្ងៃត្រឡប់ទៅ 2 មិនមែន 5', after && after.codDollar === 2, after);
        ok('«ដក» ដែលធុងសំរាមធ្លាក់ ➜ ចំណូលខែត្រឡប់ទៅ 2 ដែរ', afterM && afterM.codDollar === 2, afterM);
        await ctx.close();
    }

    // ៣. សម្អាត ៨ ថ្ងៃ (abandon) ខណៈការសរសេរធុងសំរាមធ្លាក់
    {
        const old = Date.now() - 9 * 24 * 3600 * 1000;
        const it = item('it3', '0611234567', [bc('CC1', 6, 0)]);
        it.createdAt = old;
        it.barcodes[0].createdAt = old;
        const s = seed({ it3: it }, { codDollar: 1.5, dodDollar: 0, totalCount: 1 });
        const { ctx, page } = await boot(browser, port, s);
        await page.evaluate(() => { window.__failTrashWrite = true; });
        await page.evaluate(() => window.runAutomaticCleanupRules());
        await page.waitForTimeout(1200);
        const after = await rev(page);
        ok('សម្អាត ៨ ថ្ងៃដែលធុងសំរាមធ្លាក់ ➜ ចំណូលត្រឡប់ទៅ 1.5 មិនមែន 6', after && after.codDollar === 1.5, after);
        await ctx.close();
    }

    // ៤. ស្ថិតិយក ៖ បើកកញ្ចប់ដែលបិទ ខណៈ transaction ធ្លាក់ និង packagesPickedUp = 0
    {
        const s = seed({ it4: item('it4', '0968490421', [bc('DD1', 3, 0, true)], { closedAt: Date.now() - 60000 }) },
            { codDollar: 3, dodDollar: 0, totalCount: 1 }, { packagesPickedUp: 0 });
        const { ctx, page } = await boot(browser, port, s);
        await page.evaluate(() => { window.__failHistoryTx = true; });
        await page.evaluate(() => window.toggleIndividualBarcodeClose('it4', 'DD1'));
        await page.waitForTimeout(900);
        const after = await pick(page);
        const packages = after ? (parseFloat(after.packagesPickedUp) || 0) : 0;
        const phones = after && after.pickedUpPhones ? Object.keys(after.pickedUpPhones).length : 0;
        ok('បើកកញ្ចប់ដែល transaction ធ្លាក់ ➜ ចំនួនកញ្ចប់យកនៅ 0 (មិនកើតឡើងជា 1)', packages === 0, after);
        ok('បើកកញ្ចប់ដែល transaction ធ្លាក់ ➜ គ្មានលេខទូរស័ព្ទកើតឡើងក្នុងស្ថិតិយក', phones === 0, after);
        await ctx.close();
    }

    // ៥. ⛔ ទិសផ្ទុយ ៖ ការដកពិត ១ ដង នៅតែដកដដែល (ការកែមិនត្រូវលុបការដក)
    {
        const s = seed({ it5: item('it5', '0777123456', [bc('EE1', 5, 2), bc('EE2', 1, 0)]) }, { codDollar: 6, dodDollar: 2, totalCount: 2 });
        const { ctx, page } = await boot(browser, port, s);
        await page.evaluate(() => window.removeSingleBarcode('it5', 'EE1'));
        await page.waitForTimeout(900);
        const after = await rev(page);
        ok('ទិសផ្ទុយ ៖ «ដក» ធម្មតា នៅតែកាត់លុយដដែល (6 ➜ 1, 2 ➜ 0)',
            after && after.codDollar === 1 && after.dodDollar === 0 && after.totalCount === 1, after);
        await ctx.close();
    }

    // ៦. ⛔ ទិសផ្ទុយ ៖ clamp នៅតែការពារតម្លៃអវិជ្ជមាន (rules ទាមទារ >= 0)
    {
        const s = seed({ it6: item('it6', '0611234567', [bc('FF1', 9, 0), bc('FF2', 1, 0)]) }, { codDollar: 2, dodDollar: 0, totalCount: 2 });
        const { ctx, page } = await boot(browser, port, s);
        await page.evaluate(() => window.removeSingleBarcode('it6', 'FF1'));
        await page.waitForTimeout(900);
        const after = await rev(page);
        ok('ទិសផ្ទុយ ៖ ការដកលើសតម្លៃដើម នៅតែ clamp ត្រឹម 0 (មិនអវិជ្ជមាន)',
            after && after.codDollar === 0 && after.totalCount >= 0, after);
        await ctx.close();
    }

    // ៦ខ. ⛔ ទិសផ្ទុយ ៖ ការដកវិញនៃស្ថិតិយក **ឆ្ងាយពីសូន្យ** ត្រូវដកឲ្យត្រូវ ១ ដង
    //     (មិនលើស មិនខ្វះ) — ការដកវិញដែលច្រឡំធ្វើឲ្យលេខយករួចធ្លាក់ខុស។
    {
        const s = seed({ it6b: item('it6b', '0611234567', [bc('HH1', 2, 0, false), bc('HH2', 2, 0, true)], { closedAt: Date.now() - 60000 }) },
            { codDollar: 4, dodDollar: 0, totalCount: 2 },
            { packagesPickedUp: 2, pickedUpPhones: { '0611234567': 2 } });
        const { ctx, page } = await boot(browser, port, s);
        await page.evaluate(() => { window.__failHistoryTx = true; });
        await page.evaluate(() => window.toggleIndividualBarcodeClose('it6b', 'HH1'));
        await page.waitForTimeout(900);
        const after = await pick(page);
        const packages = after ? (parseFloat(after.packagesPickedUp) || 0) : -1;
        const ref = after && after.pickedUpPhones ? (parseFloat(after.pickedUpPhones['0611234567']) || 0) : -1;
        ok('ទិសផ្ទុយ ៖ បិទកញ្ចប់ដែល tx ធ្លាក់ ➜ ចំនួនកញ្ចប់យកត្រឡប់ទៅ 2 ពិត', packages === 2, after);
        ok('ទិសផ្ទុយ ៖ ref លេខទូរស័ព្ទក៏ត្រឡប់ទៅ 2 ដែរ (មិនធ្លាក់ ១ ជ្រុល)', ref === 2, after);
        await ctx.close();
    }

    // ៧. ⛔ សតិ និង server ឃ្លាតគ្នា ៖ ឧបករណ៍ផ្សេងកាត់ ledger ស្ងាត់ៗ
    //    ➜ delta ដែលសតិអនុវត្ត ≠ delta ដែល server អនុវត្ត ➜ ការដកវិញ
    //    ត្រូវផ្អែកលើ **សាលក្រមរបស់ server** មិនមែនលើលេខក្នុងសតិ។
    {
        const s = seed({ it7: item('it7', '0777123456', [bc('GG1', 0, 4), bc('GG2', 1, 0)]) }, { codDollar: 1, dodDollar: 7.25, totalCount: 2 });
        const { ctx, page } = await boot(browser, port, s);
        await page.evaluate((k) => {
            // ឧបករណ៍ផ្សេងកាត់ dod ចេញ ៤ ដុល្លារ ព្រមទាំងដក barcode នោះចេញ
            // ដោយ listener យើងមិនទាន់ដឹង ➜ សតិនៅ 7.25 តែ server នៅ 3.25។
            window.__setPathQuiet('zoew_daily_revenue_cod_dod/' + k + '/dodDollar', 3.25);
            window.__setPathQuiet('zoew_monthly_revenue_cod_dod/' + k.substring(0, 7) + '/dodDollar', 3.25);
            window.__setPathQuiet('zoew_scan_history_cod_dod/it7/barcodes/0', null);
        }, today());
        await page.evaluate(() => {
            window.openEditBarcodePriceModal('it7', 'GG1');
            const c = document.getElementById('editBcCodInput'); if (c) c.value = '0';
            const d = document.getElementById('editBcDodInput'); if (d) d.value = '0';
            window.saveEditedBarcodePrice();
        });
        await page.waitForTimeout(800);
        const after = await rev(page);
        ok('សតិ/server ឃ្លាតគ្នា ➜ ការដកវិញប្រើសាលក្រម server (3.25 នៅ 3.25)',
            after && after.dodDollar === 3.25, after);
        await ctx.close();
    }

    await browser.close();
    server.close();

    // ជាន់អប្បបរមា ៖ ថតទទេ ➜ ការអះអាងទាំងអស់រលាយ ➜ ត្រូវធ្លាក់
    if (assertions < 13) { console.log('  FAIL  ការអះអាងតិចជាងជាន់អប្បបរមា (' + assertions + ' < 13)'); fail++; }
    console.log('\n' + (fail ? 'FAIL ' + fail + ' / ជោគជ័យ ' + pass : 'PASS ' + pass + '/' + pass));
    process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('  FAIL  ' + (e && e.message)); process.exit(1); });
