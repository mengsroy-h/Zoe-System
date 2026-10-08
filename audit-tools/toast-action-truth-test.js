const fs = require('fs');
const http = require('http');
const path = require('path');
const acorn = require('acorn');
const vm = require('vm');
const { reactRuntime } = require('./react-view.js');

const ROOT = path.resolve(process.env.TOAST_ACTION_APP_DIR || path.join(__dirname, '..'));
const APP_DIR = path.join(ROOT, 'ZoeW');
const APP_FILE = path.join(APP_DIR, 'app.js');
const KEYGEN_FILE = path.join(ROOT, 'ZoeKeyGen', 'app.js');
const APP = fs.existsSync(APP_FILE) ? fs.readFileSync(APP_FILE, 'utf8') : '';
const KEYGEN = fs.existsSync(KEYGEN_FILE) ? fs.readFileSync(KEYGEN_FILE, 'utf8') : '';
let pass = 0;
let fail = 0;
process.exitCode = 1;

function ok(label, condition, detail) {
    if (condition) {
        pass++;
        console.log('  ok    ' + label);
        return;
    }
    fail++;
    console.log('  FAIL  ' + label + (detail === undefined ? '' : '\n        ' + JSON.stringify(detail)));
}

function sliceFn(source, name) {
    let start = source.indexOf('function ' + name + '(');
    if (start === -1) return '';
    if (source.slice(Math.max(0, start - 6), start) === 'async ') start -= 6;
    let depth = 0;
    let started = false;
    for (let i = source.indexOf('{', start); i < source.length; i++) {
        if (source[i] === '{') { depth++; started = true; }
        if (source[i] === '}' && --depth === 0 && started) return source.slice(start, i + 1);
    }
    return '';
}

function countToastCalls(source) {
    if (!source) return 0;
    let count = 0;
    const ast = acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'script' });
    function walk(node) {
        if (!node || typeof node !== 'object') return;
        if (node.type === 'CallExpression' && node.callee && node.callee.type === 'Identifier' &&
            ['showToast', 'showLiveToast', 'reannounceOrShowToast'].includes(node.callee.name)) count++;
        Object.keys(node).forEach((key) => {
            if (key === 'start' || key === 'end') return;
            const value = node[key];
            if (Array.isArray(value)) value.forEach(walk);
            else walk(value);
        });
    }
    walk(ast);
    return count;
}

const TOAST_SEMANTIC_MARK = /^(?:⚠️|❌|⛔|🚫|✅|🎉|🔓|⏱️|⏳|🔄|ℹ️|📍|🔒)/u;

function staticToastHeads(node) {
    if (!node) return [];
    if (node.type === 'Literal' && typeof node.value === 'string') return [node.value];
    if (node.type === 'TemplateLiteral') return [node.quasis[0] && node.quasis[0].value ? node.quasis[0].value.cooked || '' : ''];
    if (node.type === 'ConditionalExpression') return staticToastHeads(node.consequent).concat(staticToastHeads(node.alternate));
    if (node.type === 'SequenceExpression') return staticToastHeads(node.expressions[node.expressions.length - 1]);
    if (node.type === 'BinaryExpression' && node.operator === '+') return staticToastHeads(node.left);
    if (node.type === 'LogicalExpression') return staticToastHeads(node.left).concat(staticToastHeads(node.right));
    return [];
}

function unmarkedStaticToasts(source) {
    if (!source) return ['missing source'];
    const rows = [];
    const ast = acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'script', locations: true });
    function walk(node) {
        if (!node || typeof node !== 'object') return;
        if (node.type === 'CallExpression' && node.callee && node.callee.type === 'Identifier' && node.callee.name === 'showToast') {
            const explicitKind = node.arguments[1] && node.arguments[1].type === 'Literal' && node.arguments[1].value;
            if (!explicitKind) {
                staticToastHeads(node.arguments[0]).forEach((head) => {
                    if (head && !TOAST_SEMANTIC_MARK.test(head)) rows.push(node.loc.start.line + ': ' + head.slice(0, 80));
                });
            }
        }
        Object.keys(node).forEach((key) => {
            if (key === 'start' || key === 'end' || key === 'loc') return;
            const value = node[key];
            if (Array.isArray(value)) value.forEach(walk);
            else walk(value);
        });
    }
    walk(ast);
    return rows;
}

ok('អាន App ទាំងពីរបាន និង parse JavaScript ពិត', APP.length > 100000 && KEYGEN.length > 10000);
const appToastCalls = countToastCalls(APP);
const keygenToastCalls = countToastCalls(KEYGEN);
ok('inventory គ្របដណ្ដប់ ZoeW toast/live-toast >= 130 call-sites', appToastCalls >= 130, appToastCalls);
ok('inventory គ្របដណ្ដប់ ZoeKeyGen toast/live-toast >= 20 call-sites', keygenToastCalls >= 20, keygenToastCalls);
const appUnmarkedToasts = unmarkedStaticToasts(APP);
const keygenUnmarkedToasts = unmarkedStaticToasts(KEYGEN);
ok('ZoeW static toast ទាំងអស់កំណត់ន័យ success/warning/pending/error/info ច្បាស់', appUnmarkedToasts.length === 0, appUnmarkedToasts);
ok('ZoeKeyGen static toast ទាំងអស់កំណត់ន័យ success/warning/pending/error/info ច្បាស់', keygenUnmarkedToasts.length === 0, keygenUnmarkedToasts);
ok('ZTO auto-fill មិនប្រើ success toast ខណៈកំពុងរក្សាទុក',
    !/showToast\(["'`]✅[^"'`]*កំពុងរក្សាទុក/.test(APP));

const rateFn = sliceFn(APP, 'saveExchangeRate');
const lockerSettingsFn = sliceFn(APP, 'saveLockerSettings');
const lockerScanFn = sliceFn(APP, 'handleLockerScan');
const oneCloseFn = sliceFn(APP, 'toggleIndividualBarcodeClose');
const allCloseFn = sliceFn(APP, 'toggleCloseStatus');
const markFn = sliceFn(APP, 'setCallMark');
const phoneFn = sliceFn(APP, 'saveEditedPhone');
const logoutFn = sliceFn(APP, 'logoutApp');
const clearBiometricFn = sliceFn(APP, 'clearBiometricRecord');
const toggleBiometricFn = sliceFn(APP, 'toggleBiometricUnlock');
const forgetPinFn = sliceFn(APP, 'forgetAppLockPin');
const closeCoreFn = sliceFn(APP, 'applyBarcodeCloseChange');
const deleteFn = sliceFn(APP, 'deleteSingleItem');
const queuePatchFn = sliceFn(APP, 'queueHistoryPatchRetry');
const flushPatchFn = sliceFn(APP, 'flushPendingHistoryPatches');
const saveHistoryFn = sliceFn(APP, 'saveSingleHistoryItemToFirebase');
const saveTrashFn = sliceFn(APP, 'saveSingleDeletedItemToFirebase');

ok('អត្រាប្រាក់៖ success ចងក្រោយ dbOp និងមាន late-write outcome',
    /^\s*async function saveExchangeRate/.test(rateFn) && /await dbOp\(/.test(rateFn) && /armLateWrite\(/.test(rateFn));
ok('ការកំណត់ Locker៖ ពិនិត្យលទ្ធផល localStorage មុន success',
    /safeStoreSet[\s\S]*safeStoreSet[\s\S]*if\s*\([^)]*(?:saved|Saved)/.test(lockerSettingsFn));
ok('Locker lookup៖ មិនអះអាង not-found/already-there ពេល listener stale',
    /dbListenerViewIsStale\(DB_LISTENER_KEY_HISTORY\)/.test(lockerScanFn));
ok('បិទ/បើក Barcode៖ success នៅក្នុង settle ក្រោយ committed ពិត',
    /const settleBarcodeClose[\s\S]*committed[\s\S]*showToast/.test(closeCoreFn) &&
    !/refreshCurrentHistoryView\(\);\s*}\s*showToast\(`បាន\$\{actionText}/.test(closeCoreFn));
ok('បិទ/បើកបញ្ជី៖ success នៅក្នុង settle ក្រោយ committed ពិត',
    /const settleClose[\s\S]*committed[\s\S]*showToast/.test(allCloseFn) &&
    !/refreshCurrentHistoryView\(\);\s*}\s*showToast\(`បាន\$\{actionText}/.test(allCloseFn));
ok('សម្គាល់ការខល៖ success ពិនិត្យ saved outcome មិនប្រកាសភ្លាម',
    /patchHistoryItemFields[\s\S]*\.then\([\s\S]*if\s*\(saved/.test(markFn));
ok('កែលេខទូរស័ព្ទ៖ success ស្ថិតក្នុង saved branch (ផ្ទាល់ក្នុង `.then` ឬក្នុង settle ដែល `.then` ហៅ ពេលមិន `pending`)',
    (/\.then\(\(saved\)[\s\S]*if\s*\(saved\)[\s\S]*showToast/.test(phoneFn)
        || (/const (\w+) = \(saved\) => \{[\s\S]*?if\s*\(saved\)\s*\{[\s\S]*?showToast/.test(phoneFn)
            && new RegExp('\\.then\\(\\(saved\\)[\\s\\S]*if\\s*\\(saved !== \'pending\'\\)\\s*' + /const (\w+) = \(saved\) => \{/.exec(phoneFn)[1] + '\\(saved\\)').test(phoneFn))) &&
    !/applyCurrentFilter\(\);\s*showToast\("កែប្រែលេខទូរស័ព្ទរួចរាល់!"\)/.test(phoneFn));
ok('signOut បរាជ័យ៖ មិនអះអាងថាបានចាកចេញលើឧបករណ៍',
    !/បានចាកចេញលើឧបករណ៍នេះ/.test(logoutFn));
ok('បិទ biometric៖ storage failure ត្រូវរក្សាស្ថានភាពចាស់ និងមិនប្រកាស success',
    /return true/.test(clearBiometricFn) && /return false/.test(clearBiometricFn) &&
    /if\s*\(!clearBiometricRecord\(\)\)[\s\S]*return/.test(toggleBiometricFn));
ok('ភ្លេច PIN៖ ពិនិត្យ removeItem និងបំបែក signOut success/failure',
    /if\s*\(!safeStoreRemove\(appLocalStore, 'zoew_security_pin_hash'\)\)/.test(forgetPinFn) &&
    /finish\(true\)/.test(forgetPinFn) && /finish\(false\)/.test(forgetPinFn));
ok('លុបកញ្ចប់៖ outer failure មិនអះអាង rollback ដែលមិនបានផ្ទៀងផ្ទាត់',
    /មិនអាចបញ្ជាក់ថាទិន្នន័យបានផ្លាស់ប្តូរឡើយ/.test(deleteFn));
ok('offline call-mark៖ queue រក្សា success toast រហូតដល់ reconnect commit',
    /successToast/.test(queuePatchFn) && /entry\.successToast[\s\S]*showToast/.test(flushPatchFn));
ok('history/trash helper៖ ref អវត្តមានត្រូវ reject មិនមែន resolve ជោគជ័យ',
    /!dbRefHistory[\s\S]{0,180}Promise\.reject/.test(saveHistoryFn) &&
    /!dbRefDeleted[\s\S]{0,180}Promise\.reject/.test(saveTrashFn));

async function runRateSessionChecks() {
    const names = ['saveExchangeRate', 'dbOp', 'dbOpStalled', 'withTimeout', 'armLateWrite'];
    const functions = names.map((name) => {
        const found = sliceFn(APP, name);
        ok('អត្រាប្រាក់៖ ស្រង់ helper ពិត ' + name, !!found);
        return found || 'async function ' + name + '() { return false; }';
    }).join('\n') + '\n' + (sliceFn(APP, 'captureAuthDatabaseGuard') || 'function captureAuthDatabaseGuard() { return () => true; }');
    const changes = {
        'ជំនាន់ auth': (c) => { c.authGeneration++; },
        'database': (c) => { c.db = {}; },
        'អ្នកប្រើ': (c) => { c.auth.currentUser = { uid: 'u2' }; },
        'អង្គភាព auth': (c) => { c.auth = { currentUser: c.auth.currentUser }; }
    };
    const tick = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
    let writesReached = 0, lateReached = 0;
    for (const schedule of ['ភ្លាម', 'ពិដានមុនប្ដូរ', 'ពិដានក្រោយប្ដូរ']) {
        for (const accepted of [true, false]) {
            for (const change of [null, ...Object.keys(changes)]) {
                let resolveWrite, rejectWrite;
                const effects = [];
                const timers = new Map();
                let timerId = 0;
                const context = vm.createContext({
                    Promise, Error, console: { error() {} }, window: { ZoeErrors: null },
                    authGeneration: 7, auth: { currentUser: { uid: 'u1' } }, db: {}, dbRefExchangeRate: {},
                    exchangeRateRiel: 4100, exchangeRateSaveInFlight: false,
                    fb: { set: () => { writesReached++; return new Promise((resolve, reject) => { resolveWrite = resolve; rejectWrite = reject; }); } },
                    appLocalStore: {},
                    safeStoreSet: (_, key, value) => { effects.push('store:' + value); return true; },
                    showToast: (message) => effects.push('toast:' + message),
                    refreshCurrentHistoryView: () => effects.push('render'), closeModal() {},
                    document: { getElementById: () => ({ value: '4200' }) },
                    setTimeout: (fn, ms) => { const id = ++timerId; timers.set(id, { fn, ms }); return id; },
                    clearTimeout: (id) => timers.delete(id),
                    queueMicrotask
                });
                // ⛔ ស្រទាប់ React (`fieldValue` · ប្រអប់) — កូដពិតពីទិដ្ឋភាពដដែល (`react-view.js`)
                vm.runInContext(reactRuntime(APP, { exclude: names, context }), context);
                // ⛔ `dbOp` ពិតហៅ `probeDatabaseLiveness()` ពេលព្យួរ (ការវាស់ភាពរស់ ៖ `emu/app-network-e2e-test`) ➜ stub «មិនវាស់»
                vm.runInContext('var probeDatabaseLiveness = function () { return Promise.resolve(null); };', context);
                vm.runInContext('const DB_OP_TIMEOUT_MS = 15000;\n' + functions, context);
                const pending = context.saveExchangeRate();
                const timeout = [...timers.values()].find((entry) => entry.ms === 15000);
                if (schedule === 'ពិដានមុនប្ដូរ' && timeout) { timeout.fn(); await pending; lateReached++; }
                if (change) {
                    changes[change](context);
                    context.exchangeRateRiel = 4400;
                }
                effects.length = 0;
                if (schedule === 'ពិដានក្រោយប្ដូរ' && timeout) { timeout.fn(); await pending; lateReached++; }
                if (accepted && resolveWrite) resolveWrite();
                if (!accepted && rejectWrite) rejectWrite(new Error('permission_denied'));
                await pending;
                await tick();
                const label = schedule + ' · ' + (accepted ? 'ទទួលយក' : 'បដិសេធ') + ' · ' + (change || 'វគ្គដដែល');
                if (change) {
                    ok('អត្រាប្រាក់ចាស់មិនជាន់ 4400 របស់វគ្គថ្មី ឬបង្ហាញសារ ៖ ' + label,
                        context.exchangeRateRiel === 4400 && effects.length === 0 && context.exchangeRateSaveInFlight === false,
                        { rate: context.exchangeRateRiel, effects, locked: context.exchangeRateSaveInFlight });
                } else {
                    ok('អត្រាប្រាក់ទិសផ្ទុយ៖ វគ្គដដែលនៅបញ្ចប់/ដកវិញត្រឹមត្រូវ ៖ ' + label,
                        context.exchangeRateRiel === (accepted ? 4200 : 4100)
                        && effects.some((effect) => effect.startsWith('toast:')) && context.exchangeRateSaveInFlight === false,
                        { rate: context.exchangeRateRiel, effects });
                }
            }
        }
    }
    ok('អត្រាប្រាក់៖ ជាន់អប្បបរមាសរសេរពិត និងពិដានពិត', writesReached === 30 && lateReached === 20,
        { writesReached, lateReached });
}

let chromium = null;
try { chromium = require('playwright-core').chromium; } catch (e) {}
const CHROME = process.env.TOAST_ACTION_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm', '.png': 'image/png' };

function serve(dir) {
    return new Promise((resolve) => {
        const server = http.createServer((request, response) => {
            let requestPath = decodeURIComponent(request.url.split('?')[0]);
            if (requestPath === '/') requestPath = '/index.html';
            const file = path.join(dir, requestPath);
            if (!file.startsWith(dir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
                response.writeHead(404);
                response.end();
                return;
            }
            response.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'text/plain' });
            response.end(fs.readFileSync(file));
        });
        server.listen(0, '127.0.0.1', () => resolve(server));
    });
}

const LICENSE_STUB = `window.ZoeLicense={getStatus:()=>Promise.resolve({state:'active'}),setServerTimeOffset(){},syncServerTime:()=>Promise.resolve(),activate:()=>Promise.resolve({ok:true}),verifyKeyString:()=>Promise.resolve({ok:true}),clearActivation(){}};`;

const BOOT = function (seed) {
    const store = JSON.parse(JSON.stringify(seed));
    const listeners = [];
    let historyMode = 'normal';
    let exchangeMode = 'normal';
    let heldHistory = null;
    let heldExchange = null;
    function clone(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
    function getPath(rawPath) {
        if (!rawPath || rawPath === '/') return store;
        let current = store;
        for (const part of rawPath.split('/').filter(Boolean)) {
            if (!current || typeof current !== 'object') return null;
            current = current[part];
        }
        return current === undefined ? null : current;
    }
    function setPath(rawPath, value) {
        const parts = rawPath.split('/').filter(Boolean);
        let current = store;
        for (let i = 0; i < parts.length - 1; i++) {
            if (!current[parts[i]] || typeof current[parts[i]] !== 'object') current[parts[i]] = {};
            current = current[parts[i]];
        }
        if (!parts.length) return;
        const key = parts[parts.length - 1];
        if (value === null) delete current[key]; else current[key] = clone(value);
    }
    function snapshot(rawPath) {
        const value = getPath(rawPath);
        return { val: () => clone(value), exists: () => value !== null && value !== undefined };
    }
    function fireAll() {
        listeners.forEach((entry) => entry.callback(entry.path === '.info/connected' ? { val: () => true } : snapshot(entry.path)));
    }
    function applyTransaction(ref, updater) {
        const current = getPath(ref.path);
        const next = updater(clone(current));
        if (next === undefined) return { committed: false, snapshot: snapshot(ref.path) };
        setPath(ref.path, next);
        fireAll();
        return { committed: true, snapshot: snapshot(ref.path) };
    }
    window.__toastTruthControl = {
        holdHistory() { historyMode = 'hold'; },
        resolveHistory(ok) {
            const held = heldHistory;
            heldHistory = null;
            historyMode = 'normal';
            if (!held) return false;
            if (!ok) held.reject(new Error('permission_denied'));
            else held.resolve(applyTransaction(held.ref, held.updater));
            return true;
        },
        holdExchange() { exchangeMode = 'hold'; },
        resolveExchange(ok) {
            const held = heldExchange;
            heldExchange = null;
            exchangeMode = 'normal';
            if (!held) return false;
            if (!ok) held.reject(new Error('permission_denied'));
            else { setPath(held.ref.path, held.value); fireAll(); held.resolve(); }
            return true;
        }
    };
    const user = { uid: 'toast-user', email: 'toast@example.test', getIdToken: () => Promise.resolve('token'), metadata: { lastSignInTime: new Date().toISOString() } };
    window.firebaseSDK = {
        initializeApp: () => ({ name: 'toast' }), getApps: () => [], deleteApp: () => Promise.resolve(),
        getAuth: () => ({ currentUser: user }), onAuthStateChanged: (auth, cb) => { setTimeout(() => cb(user), 0); return () => {}; },
        signInWithEmailAndPassword: () => Promise.resolve({ user }), signOut: () => Promise.resolve(),
        setPersistence: () => Promise.resolve(), browserLocalPersistence: {}, browserSessionPersistence: {},
        getIdTokenResult: () => Promise.resolve({ authTime: new Date().toISOString(), claims: {} }),
        getDatabase: () => ({}), ref: (db, rawPath) => ({ path: rawPath === undefined ? '' : String(rawPath) }),
        onValue: (ref, callback) => { listeners.push({ path: ref.path, callback }); setTimeout(() => callback(ref.path === '.info/connected' ? { val: () => true } : snapshot(ref.path)), 0); return () => {}; },
        off: () => {}, goOnline: () => {}, get: (ref) => Promise.resolve(snapshot(ref.path)),
        set: (ref, value) => {
            if (ref.path === 'zoew_settings/exchange_rate' && exchangeMode === 'hold') {
                return new Promise((resolve, reject) => { heldExchange = { ref, value, resolve, reject }; });
            }
            setPath(ref.path, value); fireAll(); return Promise.resolve();
        },
        update: (ref, values) => { const base = ref.path ? ref.path + '/' : ''; Object.keys(values).forEach((key) => setPath(base + key, values[key])); fireAll(); return Promise.resolve(); },
        runTransaction: (ref, updater) => {
            if (ref.path.indexOf('zoew_scan_history_cod_dod/') === 0 && historyMode === 'hold') {
                return new Promise((resolve, reject) => { heldHistory = { ref, updater, resolve, reject }; });
            }
            return Promise.resolve(applyTransaction(ref, updater));
        }
    };
    window.dispatchEvent(new Event('firebasesdkready'));
};

function seedData() {
    const now = Date.now();
    const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Phnom_Penh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
    const parcel = (id, code, phone) => ({ id, phone, scanDate: date, createdAt: now, cod: 1, dod: 0, price: 1, count: 1, barcode: code, time: '10:00', isClosed: false, barcodes: [{ code, cod: 1, dod: 0, isClosed: false, isDeducted: false, isFromDeletion: false, createdAt: now }] });
    return {
        zoew_scan_history_cod_dod: {
            id_close: parcel('id_close', 'CLOSE1', '010000001'),
            id_mark: parcel('id_mark', 'MARK1', '010000002'),
            id_phone: parcel('id_phone', 'PHONE1', '010000003')
        },
        zoew_recently_deleted_cod_dod: {}, zoew_daily_revenue_cod_dod: {}, zoew_monthly_revenue_cod_dod: {},
        zoew_daily_pickup_cod_dod: {}, zoew_barcode_registry: {}, zoew_settings: { exchange_rate: 4100 }
    };
}

async function runBrowser() {
    const server = await serve(APP_DIR);
    const browser = await chromium.launch({ executablePath: CHROME });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const port = server.address().port;
    try {
        page.on('dialog', (dialog) => dialog.accept());
        await page.route('**', (route) => {
            const url = route.request().url();
            if (url.includes('/license-verify.js')) return route.fulfill({ status: 200, contentType: 'application/javascript', body: LICENSE_STUB });
            if (url.startsWith('http://127.0.0.1:' + port)) return route.continue();
            return route.abort();
        });
        await page.addInitScript(`window.localStorage.setItem('zoew_firebase_config', ${JSON.stringify(JSON.stringify({ apiKey: 'k', databaseURL: 'https://fake-default-rtdb.firebaseio.com', projectId: 'p' }))});`);
        await page.addInitScript('(' + BOOT.toString() + ')(' + JSON.stringify(seedData()) + ');');
        await page.goto('http://127.0.0.1:' + port + '/', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForFunction(() => typeof window.toggleCloseStatus === 'function' && document.getElementById('toastContainer'));
        await page.waitForTimeout(800);

        // ⛔ មិនលុប DOM របស់ `#toastContainer` ផ្ទាល់ ៖ React ជាម្ចាស់កូនរបស់វា ➜ ការលុបត្រង់ៗធ្វើឲ្យ tree ដួល។
        //    «សម្អាត» = ចងចាំ toast ដែលមានរួច ➜ `toastText()` អានតែ toast **ថ្មី** (អ្វីដែលអ្នកប្រើឃើញក្រោយសកម្មភាព)។
        const clearToasts = () => page.evaluate(() => {
            window.__seenToasts = new WeakSet(Array.from(document.getElementById('toastContainer').children));
        });
        const toastText = () => page.evaluate(() => Array.from(document.getElementById('toastContainer').children)
            .filter((el) => !(window.__seenToasts && window.__seenToasts.has(el))).map((el) => el.textContent).join(' '));

        await clearToasts();
        await page.evaluate(() => { window.__toastTruthControl.holdHistory(); window.__truthAction = window.toggleCloseStatus('id_close'); });
        await page.waitForTimeout(80);
        let before = await toastText();
        ok('browser៖ បិទបញ្ជីកំពុងរង់ចាំ transaction មិនប្រកាស success មុន', !/ជោគជ័យ|រួចរាល់/.test(before), before);
        await page.evaluate(() => window.__toastTruthControl.resolveHistory(true));
        await page.evaluate(async () => { if (window.__truthAction) await window.__truthAction; });
        await page.waitForTimeout(80);
        let after = await toastText();
        ok('browser៖ បិទបញ្ជី commit រួច ទើបប្រកាស success', /Firebase/.test(after) && /បញ្ជី/.test(after), after);

        await clearToasts();
        await page.evaluate(() => { window.__toastTruthControl.holdHistory(); window.__truthAction = window.toggleCloseStatus('id_close'); });
        await page.waitForTimeout(50);
        await page.evaluate(() => window.__toastTruthControl.resolveHistory(false));
        await page.evaluate(async () => { if (window.__truthAction) await window.__truthAction; });
        await page.waitForTimeout(80);
        after = await toastText();
        ok('browser៖ បិទបញ្ជី Firebase reject ➜ rollback warning គ្មាន success',
            /⚠️|❌/.test(after) && !/✅/.test(after), after);

        await clearToasts();
        await page.evaluate(() => { window.openCallMarkModal('id_mark'); window.__toastTruthControl.holdHistory(); window.__truthAction = window.setCallMark('no-answer'); });
        await page.waitForTimeout(80);
        before = await toastText();
        ok('browser៖ សម្គាល់ការខល មិនប្រកាសរួចរាល់មុន commit', !/សម្គាល់រួចរាល់/.test(before), before);
        await page.evaluate(() => window.__toastTruthControl.resolveHistory(true));
        await page.waitForTimeout(100);
        after = await toastText();
        ok('browser៖ សម្គាល់ការខល commit រួច ទើបប្រកាស success', /សម្គាល់/.test(after) && /Firebase/.test(after), after);

        await clearToasts();
        await page.evaluate(() => { window.openCallMarkModal('id_mark'); window.__toastTruthControl.holdHistory(); window.__truthAction = window.setCallMark('wrong-number'); });
        await page.waitForTimeout(50);
        await page.evaluate(() => window.__toastTruthControl.resolveHistory(false));
        await page.waitForTimeout(100);
        after = await toastText();
        ok('browser៖ សម្គាល់ការខល Firebase reject ➜ warning គ្មាន success',
            /⚠️|❌/.test(after) && !/✅/.test(after), after);

        await clearToasts();
        await page.evaluate(() => { window.openEditModal('id_phone'); document.getElementById('editPhoneInput').value = '012345678'; window.__toastTruthControl.holdHistory(); window.__truthAction = window.saveEditedPhone(); });
        await page.waitForTimeout(80);
        before = await toastText();
        ok('browser៖ កែលេខទូរស័ព្ទ មិនប្រកាសរួចរាល់មុន commit', !/កែប្រែលេខទូរស័ព្ទរួចរាល់/.test(before), before);
        await page.evaluate(() => window.__toastTruthControl.resolveHistory(true));
        await page.waitForTimeout(100);
        after = await toastText();
        ok('browser៖ កែលេខទូរស័ព្ទ commit រួច ទើបប្រកាស success', /លេខទូរស័ព្ទ/.test(after) && /Firebase/.test(after), after);

        await clearToasts();
        await page.evaluate(() => { window.openEditModal('id_phone'); document.getElementById('editPhoneInput').value = '011111111'; window.__toastTruthControl.holdHistory(); window.__truthAction = window.saveEditedPhone(); });
        await page.waitForTimeout(50);
        await page.evaluate(() => window.__toastTruthControl.resolveHistory(false));
        await page.evaluate(async () => { if (window.__truthAction) await window.__truthAction; });
        await page.waitForTimeout(80);
        after = await toastText();
        ok('browser៖ កែលេខទូរស័ព្ទ Firebase reject ➜ rollback warning គ្មាន success',
            /⚠️|❌/.test(after) && !/✅/.test(after), after);

        await clearToasts();
        await page.evaluate(() => { window.openExchangeRateModal(); document.getElementById('exchangeRateInput').value = '4200'; window.__toastTruthControl.holdExchange(); window.__truthAction = window.saveExchangeRate(); });
        await page.waitForTimeout(80);
        before = await toastText();
        ok('browser៖ អត្រាប្រាក់ មិនប្រកាសរក្សាទុកមុន Firebase', !/បានរក្សាទុកអត្រាប្រាក់/.test(before), before);
        await page.evaluate(() => window.__toastTruthControl.resolveExchange(true));
        await page.evaluate(async () => { if (window.__truthAction) await window.__truthAction; });
        await page.waitForTimeout(80);
        after = await toastText();
        ok('browser៖ អត្រាប្រាក់ Firebase resolve រួច ទើប success', /អត្រាប្រាក់/.test(after) && /Firebase/.test(after), after);

        await clearToasts();
        await page.evaluate(() => { window.openExchangeRateModal(); document.getElementById('exchangeRateInput').value = '4300'; window.__toastTruthControl.holdExchange(); window.__truthAction = window.saveExchangeRate(); });
        await page.waitForTimeout(50);
        await page.evaluate(() => window.__toastTruthControl.resolveExchange(false));
        await page.evaluate(async () => { if (window.__truthAction) await window.__truthAction; });
        await page.waitForTimeout(80);
        after = await toastText();
        ok('browser៖ អត្រាប្រាក់ Firebase reject ➜ warning គ្មាន success ក្លែងក្លាយ', /⚠️|❌/.test(after) && !/បានរក្សាទុកអត្រាប្រាក់/.test(after), after);
    } finally {
        await browser.close();
        server.close();
    }
}

(async () => {
    await runRateSessionChecks();
    if (!chromium || !fs.existsSync(CHROME) || !APP) {
        ok('browser truth test អាចចាប់ផ្តើមបាន', false, 'Chromium/app unavailable');
    } else {
        try { await runBrowser(); }
        catch (error) { ok('browser truth flow បញ្ចប់ដោយគ្មាន exception', false, error && error.stack ? error.stack : String(error)); }
    }
    console.log('\n' + (fail ? 'FAIL ' + fail + ' / ជោគជ័យ ' + pass : 'PASS ' + pass + '/' + pass));
    process.exit(fail ? 1 : 0);
})();
