// ⛔ ថ្នាក់កំហុស៖ ការបើក App **ក្រៅបណ្តាញ** បង្ហាញប្រអប់ PIN/Config
// ជំនួសឲ្យស្ថានភាព «ក្រៅបណ្ដាញ»។
//
// 🔴 កំហុសពិតដែលរកឃើញក្នុងជុំ deep audit៖ `firebase-loader.js` ទាញ SDK ពី
// `gstatic.com` ដែលជា **origin ខាងក្រៅ** ➜ `sw.js` បោះបង់វាដោយចេតនា
// (ច្បាប់ចាក់សោតាំងពី 2.6.1) ➜ វា **មិនដែលចូល cache**។ ដូច្នេះការបើក
// ក្រៅបណ្តាញ ៖ `waitForFirebaseSDK()` អស់ពេល ១៥ វិ. រួច reject ➜ `catch`
// របស់ `initFirebase()` ចាត់ទុក **រាល់កំហុស** ជា «Invalid Saved Config»
// ➜ ហៅ `checkPinAndOpenConfig(true)` ➜ **អ្នកប្រើឃើញប្រអប់ PIN សុំកំណត់
// Config ឡើងវិញ** ខណៈបញ្ហាពិតគ្រាន់តែជា «គ្មានបណ្តាញ»។
//
// អ្នកប្រើដែលមិនដឹង អាចនឹងលុប ឬប្តូរ Config អាជីវកម្មរបស់ខ្លួនចោល។
//
// ការកែ៖ `waitForFirebaseSDK()` ដាក់ `err.code = 'SDK_UNAVAILABLE'` ហើយ
// `initFirebase()` បែងចែកវា ➜ បង្ហាញស្ថានភាព «ក្រៅបណ្ដាញ» + toast +
// ជណ្តើរព្យាយាមឡើងវិញ ជំនួសប្រអប់ Config។
let chromium;
try { chromium = require('playwright-core').chromium; } catch (e) {
    console.log('SKIP — ត្រូវការ playwright-core (npm i playwright-core)');
    process.exit(0);
}
const CHROME = process.env.SDKBOOT_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const fs = require('fs');
const http = require('http');
const path = require('path');
if (!fs.existsSync(CHROME)) { console.log('SKIP — រកមិនឃើញ Chromium'); process.exit(0); }

const ROOT = process.env.SDKBOOT_APP_DIR || path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm' };

let pass = 0, fail = 0;
const ok = (n, d) => { console.log('   ok    ' + n + (d ? '  ' + d : '')); pass++; };
const bad = (n, d) => { console.log('   FAIL  ' + n + (d !== undefined ? '  ➜ ' + JSON.stringify(d) : '')); fail++; };
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
    setServerTimeOffset: function () {},
    syncServerTime: function () { return Promise.resolve(); },
    activate: function () { return Promise.resolve({ ok: true }); },
    verifyKeyString: function () { return Promise.resolve({ ok: true }); },
    clearActivation: function () {}
};`;

(async () => {
    // ១. ការស្កេនស្តាទិច — ច្បាប់ត្រូវនៅក្នុងកូដពិតទាំង ២ App
    console.log('\n=== កំហុសផ្ទុក SDK ត្រូវបែកចេញពី Config ខូច ===');
    for (const app of ['ZoeW', 'ZoeKeyGen']) {
        const src = fs.readFileSync(path.join(ROOT, app, 'app.js'), 'utf8');
        check(/notReadyErr\.code = 'SDK_UNAVAILABLE'/.test(src),
            app + ' ៖ waitForFirebaseSDK ដាក់ code SDK_UNAVAILABLE');
        check(/e\.code === 'SDK_UNAVAILABLE'/.test(src),
            app + ' ៖ initFirebase បែងចែក SDK_UNAVAILABLE មុនបើកប្រអប់ Config');
        // លំដាប់សំខាន់៖ ការពិនិត្យត្រូវមក **មុន** checkPinAndOpenConfig
        const guard = src.indexOf("e.code === 'SDK_UNAVAILABLE'");
        const prompt = src.indexOf('checkPinAndOpenConfig', guard);
        check(guard !== -1 && prompt !== -1 && guard < prompt,
            app + ' ៖ ការពិនិត្យមកមុនការបើកប្រអប់ Config');
        check(/function scheduleFirebaseSdkRetry\(/.test(src) && /function retryFirebaseSdkNow\(/.test(src),
            app + ' ៖ មានជណ្តើរព្យាយាមផ្ទុក SDK ឡើងវិញ');
        check(/if \(firebaseSdkUnavailable\) return false;/.test(src),
            app + ' ៖ ស្ថានភាពបង្ហាញ «ក្រៅបណ្ដាញ» មិនមែន «កំពុងភ្ជាប់...» ជារៀងរហូត');
    }

    // ២. ឥរិយាបថពិតក្នុង Chromium — បិទ gstatic ដូចការបើកក្រៅបណ្តាញ
    console.log('\n=== ការបើកខណៈ SDK មកមិនដល់ (Chromium ពិត) ===');
    const browser = await chromium.launch({ executablePath: CHROME });
    const server = await serve(path.join(ROOT, 'ZoeW'));
    const port = server.address().port;
    const RELOAD_KEY = (/FIREBASE_SDK_RELOAD_KEY = '([^']+)'/.exec(fs.readFileSync(path.join(ROOT, 'ZoeW', 'app.js'), 'utf8')) || [])[1];
    const RELOAD_MAX = Number((/FIREBASE_SDK_RELOAD_MAX = (\d+);/.exec(fs.readFileSync(path.join(ROOT, 'ZoeW', 'app.js'), 'utf8')) || [])[1]);
    async function bootOffline(reloadCount) {
    const ctx = await browser.newContext({ viewport: { width: 412, height: 850 } });
    const page = await ctx.newPage();
    page.on('dialog', (d) => d.dismiss().catch(() => {}));
    await page.route('**', (route) => {
        const u = route.request().url();
        if (u.indexOf('/license-verify.js') !== -1) {
            return route.fulfill({ status: 200, contentType: 'application/javascript', body: LICENSE_STUB });
        }
        if (u.startsWith('http://127.0.0.1:' + port)) return route.continue();
        return route.abort();   // gstatic និងអ្វីៗឆ្លង origin ➜ ដាច់ ដូចក្រៅបណ្តាញ
    });
    // Config និង PIN មានស្រាប់ ➜ ផ្លូវ «អ្នកប្រើដែលរៀបចំរួច បើកក្រៅបណ្តាញ»
    await page.addInitScript(`window.localStorage.setItem('zoew_firebase_config', ${JSON.stringify(JSON.stringify({ apiKey: 'k', databaseURL: 'https://fake-default-rtdb.firebaseio.com', projectId: 'p' }))});`);
    await page.addInitScript("window.localStorage.setItem('zoew_security_pin_hash', 'pbkdf2:deadbeef');");
    // ⛔ តាំងពីកំណែ 2.22.0 ការមាន PIN មានន័យថា **អេក្រង់ចាក់សោ App** លេចឡើងពេល
    // បើក។ ឯកសារនេះវាស់ការបើក **ក្រៅបណ្តាញ** មិនមែនការចាក់សោទេ ➜ ចាក់ទង់
    // «ដោះសោក្នុងវគ្គនេះរួច» ដូចការ Refresh ក្នុងវគ្គដដែល។ ការចាក់សោមាន
    // ឧបករណ៍ផ្ទាល់ខ្លួន ៖ `app-lock-test.js`។
    await page.addInitScript("window.sessionStorage.setItem('zoew_app_unlocked', '1');");
    if (reloadCount) await page.addInitScript(`window.sessionStorage.setItem(${JSON.stringify(RELOAD_KEY)}, ${JSON.stringify(String(reloadCount))});`);
    // បង្រួមការរង់ចាំ SDK ពី ១៥ វិ. មក ១ វិ. ដើម្បីឲ្យតេស្តរត់លឿន —
    // តក្កវិជ្ជាដដែល ផ្លូវដដែល គ្រាន់តែ timeout ខ្លីជាង
    await page.addInitScript(`
        window.__origSetTimeout = window.setTimeout;
        window.setTimeout = function (fn, ms) {
            return window.__origSetTimeout(fn, ms === 15000 ? 1000 : ms);
        };
    `);
    await page.goto('http://127.0.0.1:' + port + '/', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(4000);

    const state = await page.evaluate(() => {
        const vis = (id) => {
            const el = document.getElementById(id);
            if (!el) return false;
            const cs = getComputedStyle(el);
            return cs.display !== 'none' && cs.visibility !== 'hidden';
        };
        const dot = document.getElementById('statusDot');
        return {
            pinModalOpen: vis('pinModal'),
            pinSetupOpen: vis('pinSetupModal'),
            configOpen: vis('configModal'),
            statusText: (document.getElementById('firebaseStatusText') || {}).innerText || '',
            dotOffline: !!dot && dot.classList.contains('offline'),
            dotConnecting: !!dot && dot.classList.contains('connecting'),
            appVisible: vis('appPages'),
            toasts: (document.getElementById('toastContainer') || {}).innerText || ''
        };
    });
    await ctx.close();
    return state;
    }

    const state = await bootOffline(0);

    check(!state.pinModalOpen && !state.pinSetupOpen,
        'ការបើកខណៈ SDK មកមិនដល់ ➜ **មិនបើកប្រអប់ PIN**', state);
    check(!state.configOpen, 'ការបើកខណៈ SDK មកមិនដល់ ➜ **មិនបើកប្រអប់ Config**', state);
    check(state.statusText.indexOf('ក្រៅបណ្ដាញ') !== -1,
        'ស្ថានភាពសរសេរ «ក្រៅបណ្ដាញ» ដោយស្មោះ', state.statusText);
    check(state.dotOffline && !state.dotConnecting,
        'ចំណុចស្ថានភាពជា offline មិនមែនជាប់ «កំពុងភ្ជាប់...»', state);
    check(state.appVisible, 'App នៅមើលឃើញ — មិនជាប់ក្រោមប្រអប់', state);
    check(/កំពុងព្យាយាមម្តងទៀត/.test(state.toasts) && !/Refresh/.test(state.statusText),
        'ពិដានផ្ទុកឡើងវិញនៅសល់ ➜ toast «កំពុងព្យាយាមម្តងទៀត» (ជណ្តើរពិតជារត់) · ស្ថានភាពមិនសុំ Refresh', state);

    // ⛔ ពិដានផ្ទុកឡើងវិញអស់ក្នុងវគ្គ ➜ ការស្តារក្នុងទំព័រនេះមិនអាចជោគជ័យ (module map cache ការបរាជ័យ) ➜ App ត្រូវប្រាប់ការពិត ៖
    //    «សូម Refresh ទំព័រ» ជាប់នៅស្ថានភាព + toast · ⛔ មិនមែន «កំពុងព្យាយាមម្តងទៀត»
    const stuck = await bootOffline(RELOAD_MAX);
    check(RELOAD_KEY && RELOAD_MAX > 0 && /Refresh/.test(stuck.statusText) && stuck.dotOffline,
        'ពិដានអស់ ➜ ស្ថានភាពជាប់ «សូម Refresh ទំព័រ» (offline)', stuck);
    check(/Refresh/.test(stuck.toasts) && !/កំពុងព្យាយាមម្តងទៀត/.test(stuck.toasts),
        'ពិដានអស់ ➜ toast សុំ Refresh · ⛔ មិនមែន «កំពុងព្យាយាមម្តងទៀត»', stuck.toasts);
    check(!stuck.pinModalOpen && !stuck.configOpen && stuck.appVisible, 'ពិដានអស់ ➜ មិនបើកប្រអប់ PIN/Config · App នៅមើលឃើញ', stuck);
    server.close();

    // ៣. ⛔ ZoeKeyGen ក្នុង Chromium ពិត ៖ SDK មកមិនដល់ ➜ ជណ្តើរព្យាយាមត្រូវ **រត់ពិត** (probe ទៅ host SDK) និង SDK ដែលមកយឺត
    //    (`firebasesdkready`) ត្រូវចាប់ផ្តើម `initFirebase()` ពិត ⛔ គ្មាន `ReferenceError` (អថេរដែលមិនដែលប្រកាស ➜ function
    //    ជណ្តើរ · listener SDK យឺត · handler `online` ដាច់ស្ងាត់ ខណៈ toast ថា «កំពុងព្យាយាមម្តងទៀត»)។ sandbox របស់
    //    connection-recovery ប្រកាសអថេរជំនួស App ➜ មើលមិនឃើញ ➜ វាស់លើទំព័រពិតនៅទីនេះ។
    console.log('\n=== ZoeKeyGen ៖ SDK មកមិនដល់ ➜ ជណ្តើរ · SDK យឺត (Chromium ពិត) ===');
    const kgSrc = fs.readFileSync(path.join(ROOT, 'ZoeKeyGen', 'app.js'), 'utf8');
    const kgProbeUrl = (/const FIREBASE_SDK_PROBE_URL = '([^']+)'/.exec(kgSrc) || [])[1];
    const kgFirstStep = Number((/const FIREBASE_SDK_RETRY_STEPS_MS = \[(\d+)/.exec(kgSrc) || [])[1]);
    check(!!kgProbeUrl && kgFirstStep > 0, 'ZoeKeyGen ៖ អាន FIREBASE_SDK_PROBE_URL · ជំហានទី ១ ពីកូដពិត', { kgProbeUrl, kgFirstStep });
    const kgServer = await serve(path.join(ROOT, 'ZoeKeyGen'));
    const kgPort = kgServer.address().port;
    const kgCtx = await browser.newContext({ viewport: { width: 412, height: 850 } });
    const kgPage = await kgCtx.newPage();
    const kgErrors = [];
    let kgProbes = 0;
    kgPage.on('pageerror', (e) => kgErrors.push(String(e && e.message || e)));
    kgPage.on('dialog', (d) => d.dismiss().catch(() => {}));
    await kgPage.route('**', (route) => {
        const u = route.request().url();
        if (u.indexOf('/license-verify.js') !== -1) {
            return route.fulfill({ status: 200, contentType: 'application/javascript', body: LICENSE_STUB });
        }
        if (u.startsWith('http://127.0.0.1:' + kgPort)) return route.continue();
        if (kgProbeUrl && u.indexOf(kgProbeUrl) === 0) kgProbes++;
        return route.abort();
    });
    await kgPage.addInitScript(`window.localStorage.setItem('zoew_firebase_config', ${JSON.stringify(JSON.stringify({ apiKey: 'k', authDomain: 'p.firebaseapp.com', databaseURL: 'https://fake-default-rtdb.firebaseio.com', projectId: 'p' }))});`);
    await kgPage.addInitScript(`
        window.__kgRejections = [];
        window.addEventListener('unhandledrejection', (e) => { window.__kgRejections.push(String(e.reason && e.reason.message || e.reason)); });
        window.__kgSdkWaits = 0;
        window.__origSetTimeout = window.setTimeout;
        window.setTimeout = function (fn, ms) {
            if (ms === 15000) window.__kgSdkWaits++;
            return window.__origSetTimeout(fn, ms === 15000 ? 800 : (ms === ${kgFirstStep} ? 300 : ms));
        };
    `);
    await kgPage.goto('http://127.0.0.1:' + kgPort + '/', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await kgPage.waitForTimeout(3500);
    const kgBefore = await kgPage.evaluate(() => ({
        sdkWaits: window.__kgSdkWaits,
        rejections: window.__kgRejections.slice(),
        toasts: (document.getElementById('toastContainer') || {}).innerText || '',
        statusText: (document.getElementById('firebaseStatusText') || {}).innerText || ''
    }));
    const kgRefErrors = kgErrors.concat(kgBefore.rejections).filter((m) => /is not defined|ReferenceError/.test(m));
    check(kgRefErrors.length === 0, 'ZoeKeyGen ៖ ⛔ SDK មកមិនដល់ ➜ គ្មាន ReferenceError (pageerror · unhandledrejection)', kgRefErrors);
    check(kgProbes >= 1 || kgBefore.sdkWaits >= 2, 'ZoeKeyGen ៖ ជណ្តើរព្យាយាមរត់ពិត ➜ probe ទៅ host SDK ឬការរង់ចាំ SDK លើកទី ២ (toast «កំពុងព្យាយាម» មិនកុហក)',
        { kgProbes, sdkWaits: kgBefore.sdkWaits, toasts: kgBefore.toasts });
    await kgPage.evaluate(() => {
        window.__kgInitCalls = 0;
        const noop = () => {};
        window.firebaseSDK = {
            getApps: () => [],
            initializeApp: () => { window.__kgInitCalls++; return {}; },
            deleteApp: () => Promise.resolve(),
            getAuth: () => ({}),
            setPersistence: () => Promise.resolve(),
            browserSessionPersistence: {},
            browserLocalPersistence: {},
            getDatabase: () => ({}),
            goOnline: noop,
            goOffline: noop,
            ref: () => ({}),
            onValue: () => noop,
            off: noop,
            onAuthStateChanged: () => noop
        };
        window.dispatchEvent(new Event('firebasesdkready'));
    });
    await kgPage.waitForTimeout(800);
    const kgAfter = await kgPage.evaluate(() => ({ initCalls: window.__kgInitCalls, rejections: window.__kgRejections.slice() }));
    const kgLateRefErrors = kgErrors.concat(kgAfter.rejections).filter((m) => /is not defined|ReferenceError/.test(m));
    check(kgAfter.initCalls >= 1, 'ZoeKeyGen ៖ SDK មកយឺត (`firebasesdkready`) ➜ initFirebase() ចាប់ផ្តើមពិត (initializeApp ត្រូវហៅ)', kgAfter);
    check(kgLateRefErrors.length === 0, 'ZoeKeyGen ៖ ⛔ listener SDK យឺតមិនបោះ ReferenceError', kgLateRefErrors);
    await kgCtx.close();
    kgServer.close();

    await browser.close();

    console.log('\n' + (fail === 0 ? '✅ ជោគជ័យទាំងអស់ (' + pass + ')' : '❌ ធ្លាក់ ' + fail + ' (ជោគជ័យ ' + pass + ')'));
    process.exit(fail === 0 ? 0 : 1);
})();
