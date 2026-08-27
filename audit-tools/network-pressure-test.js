// ថ្នាក់កំហុស៖ **សំណើដែលកកកុញនៅពេលបណ្តាញ «ភ្ជាប់តែស្លាប់»។**
//
// បណ្តាញ WiFi ដែលភ្ជាប់បាន តែគ្មានអ៊ីនធឺណិត គឺជាករណីធម្មតាបំផុត។ ក្នុងករណី
// នោះ `fetch()` **មិនធ្លាក់ភ្លាមទេ — វាព្យួរ** រហូតដល់ timeout។
//
// `attemptAutoLookup()` រត់រាល់ពេលស្កេនកញ្ចប់ថ្មី ហើយវាមាន៖
//     retryAsync(() => fetchWithTimeout(url, …, 15000, …), 2, 1500)
//     ➜ ១៥ + ១,៥ + ១៥ = **៣១,៥ វិនាទី** ក្នុងមួយការស្កេន
// ការ cooldown (`autoLookupLastFailedAt`) កំណត់ត្រា **តែក្រោយបរាជ័យ** ដូច្នេះ
// អំឡុង ៣១,៥ វិនាទីនោះ វា **មិនទប់អ្វីទាំងអស់** ➜ ស្កេន ២០ កញ្ចប់ក្នុង ៣០
// វិនាទី ➜ **ការស្វែងរក ២០ ដងព្យួរស្របគ្នា** ដណ្តើម bandwidth គ្នា ហើយធ្វើឲ្យ
// ការសរសេរទៅ Firebase យឺតតាម។ អ្នកប្រើឃើញ «App ជាប់» ខណៈគ្មានអ្វីខុសក្នុងកូដ
// អាជីវកម្មសោះ។
//
// តេស្តនេះបើក App ពិត ដោយធ្វើឲ្យ endpoint ស្វែងរក **ព្យួររហូត** រួចរាប់ចំនួន
// សំណើដែលដល់ម៉ាស៊ីនបម្រើពិត។
let chromium;
try { chromium = require('playwright-core').chromium; } catch (e) {
    console.log('SKIP — ត្រូវការ playwright-core (npm i playwright-core)');
    process.exit(0);
}
const fs = require('fs');
const http = require('http');
const path = require('path');
const CHROME = process.env.NETPRESSURE_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
if (!fs.existsSync(CHROME)) { console.log('SKIP — រកមិនឃើញ Chromium'); process.exit(0); }

const ROOT = process.env.NETPRESSURE_APP_DIR || path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm' };
let pass = 0, fail = 0;
function ok(label, cond, detail) {
    if (cond) { pass++; console.log('  ok    ' + label); }
    else { fail++; console.log('  FAIL  ' + label + (detail !== undefined ? '\n        ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : '')); }
}

// === ផ្នែកទី ១ — ច្បាប់ស្តាទិចលើ app.js ===
{
    const app = fs.readFileSync(path.join(ROOT, 'ZoeW', 'app.js'), 'utf8');
    ok('ZoeW: មានពិដានចំនួនការស្វែងរកស្របគ្នា', /AUTO_LOOKUP_MAX_IN_FLIGHT/.test(app));
    ok('ZoeW: ការស្វែងរកតាមដាន barcode ដែលកំពុងដំណើរការ', /autoLookupInFlight/.test(app));
    ok('ZoeW: ការតាមដាននោះត្រូវដោះក្នុង `finally` (មិនលេចធ្លាយពេលមានកំហុស)',
        /finally \{\s*\n\s*autoLookupInFlight\.delete\(lookupKey\);/.test(app));
    // ⛔ ការការពារនេះអាចរស់នៅ **ក្នុង helper** — ការអះអាងតាមឈ្មោះ function
    // តែម្យ៉ាងជាថ្នាក់ «checker ស្កេនអ្វី» ដដែលនឹង 2.19.3។ ដូច្នេះវាដើរតាម
    // ការបញ្ជូនបន្ត ១ ជាន់ ហើយ `lookup-prefetch-test.js` អះអាង **ឥរិយាបថ**
    // ពិតក្នុង `vm` ជាជាន់ទី ២។
    const prefetchBody = (/function prefetchCustomerDataTableRowsIfConfigured\(\)[\s\S]*?\n    \}/.exec(app) || [''])[0];
    const allowBody = (/function customerTablePrefetchAllowed\(\)[\s\S]*?\n    \}/.exec(app) || [''])[0];
    ok('ZoeW: ការទាញជាមុនរំលងពេលក្រៅបណ្តាញ (មិនដាស់វិទ្យុឥតបានការ)',
        /navigator\.onLine === false/.test(prefetchBody) ||
        (/customerTablePrefetchAllowed\(\)/.test(prefetchBody) && /navigator\.onLine === false/.test(allowBody)));

    // **អានប្រអប់មុន `await` ដំបូង។** `ZoeErrors.init()` អាចចំណាយដល់ ១០ វិនាទី
    // (ពិដានផ្ទុក SDK) ➜ បើអានតម្លៃក្រោយវា នោះអ្វីដែលអ្នកប្រើវាយអំឡុងនោះអាច
    // ត្រូវយកទៅរក្សាទុកជំនួសអ្វីដែលគេឃើញពេលចុច។
    const body = (/function saveFirebaseConfig\(\)[\s\S]*?\n    \}\n/.exec(app) || [''])[0];
    const awaitPos = body.indexOf('await');
    const readPos = body.indexOf('cfgInput.value');
    ok('ZoeW: `saveFirebaseConfig()` អានប្រអប់ Config **មុន** `await` ណាមួយ',
        readPos !== -1 && (awaitPos === -1 || readPos < awaitPos),
        'read@' + readPos + ' await@' + awaitPos);
    ok('ZoeW: ការព្រមាន Sentry ប្រើទម្រង់ `.then(A, B)` ២ អាគុយម៉ង់',
        /sentryInit\.then\(\([\s\S]{0,80}\}, warnSentry\)/.test(app));
}
{
    const kg = fs.readFileSync(path.join(ROOT, 'ZoeKeyGen', 'app.js'), 'utf8');
    ok('ZoeKeyGen: ការរក្សាទុក Config ប្រើ `safeStoreSet` (សារត្រូវនឹងបញ្ហាពិត)',
        /safeStoreSet\(localStorage, 'zoew_firebase_config'/.test(kg));
    ok('ZoeKeyGen: លែងរាយកំហុសផ្ទុកថា «Config មិនត្រឹមត្រូវ» ទៀតទេ',
        !/catch \(e\) \{\s*\n\s*alert\("ការកំណត់រចនាសម្ព័ន្ធមិនត្រឹមត្រូវទេ!"\);/.test(kg));
}

// === ផ្នែកទី ២ — Browser ពិត ===
const LICENSE_STUB = `window.ZoeLicense = {
    getStatus: function () { return Promise.resolve({ state: 'active' }); },
    setServerTimeOffset: function () {}, syncServerTime: function () { return Promise.resolve(); },
    activate: function () { return Promise.resolve({ ok: true }); },
    verifyKeyString: function () { return Promise.resolve({ ok: true }); }, clearActivation: function () {}
};`;

const FAKE_SDK = function (seed) {
    const store = JSON.parse(JSON.stringify(seed));
    window.__fakeStore = store;
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
    function snapOf(p) {
        const v = getPath(p);
        return { val: () => (v === undefined || v === null) ? null : (typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v), exists: () => v !== null && v !== undefined };
    }
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
            setTimeout(() => { if (r.path === '.info/connected') cb({ val: () => true }); else cb(snapOf(r.path)); }, 0);
            return () => {};
        },
        off: () => {}, get: (r) => Promise.resolve(snapOf(r.path)),
        set: () => Promise.resolve(), update: () => Promise.resolve(),
        goOnline: () => {}, goOffline: () => {}, increment: (n) => ({ __inc: n }),
        runTransaction: (r, fn) => { const cur = getPath(r.path); const next = fn(cur === null ? null : JSON.parse(JSON.stringify(cur))); return Promise.resolve({ committed: next !== undefined, snapshot: snapOf(r.path) }); }
    };
    window.dispatchEvent(new Event('firebasesdkready'));
};

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

// endpoint ស្វែងរកដែល **មិនឆ្លើយតបសោះ** — ធ្វើត្រាប់តាម WiFi ដែលភ្ជាប់តែស្លាប់
function serveHanging() {
    const seen = [];
    return new Promise((res) => {
        const s = http.createServer((req) => { seen.push(req.url); /* កុំឆ្លើយតប */ });
        s.on('connection', (c) => c.setTimeout(0));
        s.listen(0, '127.0.0.1', () => res({ server: s, seen }));
    });
}

const D = (() => { const t = new Date(); return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0'); })();

(async () => {
    const dir = path.join(ROOT, 'ZoeW');
    const server = await serve(dir);
    const origin = 'http://127.0.0.1:' + server.address().port;
    const hang = await serveHanging();
    const hangOrigin = 'http://127.0.0.1:' + hang.server.address().port;

    const browser = await chromium.launch({ executablePath: CHROME });
    const ctx = await browser.newContext({ viewport: { width: 412, height: 780 } });
    const page = await ctx.newPage();
    await page.route('**', (route) => {
        const u = route.request().url();
        if (u.indexOf('/license-verify.js') !== -1) return route.fulfill({ status: 200, contentType: 'application/javascript', body: LICENSE_STUB });
        if (u.startsWith(origin) || u.startsWith(hangOrigin)) return route.continue();
        return route.abort();
    });
    const lookupCfg = { enabled: true, autoSubmit: false, url: hangOrigin + '/lookup?code={barcode}', phoneField: 'phone', codField: 'cod', dodField: 'dod' };
    await page.addInitScript(`
        window.localStorage.setItem('zoew_firebase_config', ${JSON.stringify(JSON.stringify({ apiKey: 'k', databaseURL: 'https://fake-default-rtdb.firebaseio.com', projectId: 'p' }))});
        window.localStorage.setItem('zoew_lookup_api_config', ${JSON.stringify(JSON.stringify(lookupCfg))});
    `);
    await page.addInitScript('(' + FAKE_SDK.toString() + ')(' + JSON.stringify({
        user_roles: { 'admin-uid': 'admin' },
        zoew_scan_history_cod_dod: {}, zoew_recently_deleted_cod_dod: {},
        zoew_daily_revenue_cod_dod: {}, zoew_monthly_revenue_cod_dod: {},
        zoew_daily_pickup_cod_dod: {}, zoew_settings: { exchange_rate: 4100 }
    }) + ');');
    await page.goto(origin + '/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    // ១. barcode ដដែលមិនត្រូវបញ្ជូនស្ទួន — **ត្រូវធ្វើមុនគេ** ខណៈ connection pool
    //    របស់ browser នៅទំនេរ បើមិនដូច្នេះពិដាន ៦ connection របស់ Chromium នឹង
    //    លាក់ការស្ទួន ហើយតេស្តជោគជ័យក្លែងក្លាយ។
    const beforeDup = hang.seen.length;
    await page.evaluate(() => { for (let i = 0; i < 6; i++) window.attemptAutoLookup('SAME-CODE'); });
    await page.waitForTimeout(1500);
    const dup = hang.seen.length - beforeDup;
    ok('**barcode ដដែលមិនបញ្ជូនសំណើស្ទួន (' + dup + ' សំណើ សម្រាប់ការហៅ ៦)**',
        dup === 1, 'សំណើ ' + dup + ' ដង');

    // ២. ស្កេន ១៥ កញ្ចប់ជាប់ៗគ្នា ខណៈ endpoint ព្យួររហូត
    const before = hang.seen.length;
    await page.evaluate(() => {
        for (let i = 0; i < 15; i++) window.attemptAutoLookup('BC' + i);
    });
    await page.waitForTimeout(3000);
    const during = hang.seen.length - before;
    ok('**endpoint ព្យួរ ➜ ការស្វែងរកមិនកកកុញ (' + during + ' សំណើ សម្រាប់ការស្កេន ១៥)**',
        during > 0 && during <= 2,
        during === 0 ? 'គ្មានសំណើសោះ — តេស្តមិនបានធ្វើតេស្តអ្វីទេ' : 'សំណើ ' + during + ' ដង ➜ ការស្វែងរកកកកុញ');

    // ក្រៅបណ្តាញ ➜ ការទាញជាមុនមិនប៉ះបណ្តាញ
    const beforeOffline = hang.seen.length;
    await ctx.setOffline(true);
    await page.evaluate(() => { window.prefetchCustomerDataTableRowsIfConfigured(); });
    await page.waitForTimeout(800);
    ok('ក្រៅបណ្តាញ ➜ ការទាញតារាងអតិថិជនជាមុនមិនកេះសំណើ',
        hang.seen.length === beforeOffline, 'បន្ថែម ' + (hang.seen.length - beforeOffline));
    await ctx.setOffline(false);

    await ctx.close();
    await browser.close();
    await new Promise((r) => server.close(r));
    hang.server.close();
    hang.server.closeAllConnections && hang.server.closeAllConnections();
    console.log('\n' + (fail ? '❌ ធ្លាក់ ' + fail + ' (ជោគជ័យ ' + pass + ')' : '✅ ជោគជ័យ ' + pass));
    process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e && e.stack || e); process.exit(1); });
