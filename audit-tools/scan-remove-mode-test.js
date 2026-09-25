const fs = require('fs');
const http = require('http');
const path = require('path');

const ROOT = process.env.SCANREMOVE_APP_DIR ? path.resolve(process.env.SCANREMOVE_APP_DIR) : path.join(__dirname, '..');
const APP_DIR = path.join(ROOT, 'ZoeW');
const APP_FILE = path.join(APP_DIR, 'app.js');
const HTML_FILE = path.join(APP_DIR, 'index.html');
const CSS_FILE = path.join(APP_DIR, 'style.css');
const app = fs.existsSync(APP_FILE) ? fs.readFileSync(APP_FILE, 'utf8') : '';
const html = fs.existsSync(HTML_FILE) ? fs.readFileSync(HTML_FILE, 'utf8') : '';
const css = fs.existsSync(CSS_FILE) ? fs.readFileSync(CSS_FILE, 'utf8') : '';

let pass = 0;
let fail = 0;
let assertions = 0;
function ok(label, condition, detail) {
    assertions++;
    if (condition) {
        pass++;
        console.log('  ok    ' + label);
        return;
    }
    fail++;
    console.log('  FAIL  ' + label + (detail === undefined ? '' : '\n        ' + JSON.stringify(detail)));
}

ok('ជាន់អប្បបរមា៖ មាន ZoeW/app.js + index.html + style.css', !!app && !!html && !!css);
// ⛔ markup ដែល React គូរ (prerender) សរសេរ `"` ក្នុង attribute ជា `&quot;` ➜ ប្រៀបលើតម្លៃ attribute ដែលឌិកូដ (ន័យដដែល)
const htmlAttrs = html.replace(/&quot;/g, '"');
ok('មានរបៀបទី ៣ «ស្កេនដកកញ្ចប់»',
    /id="modeRemoveBtn"[^>]*data-act="setEntryScanMode"[^>]*\["remove"\][^>]*>[^<]*ដកកញ្ចប់/.test(htmlAttrs));
ok('មាន banner គ្រោះថ្នាក់សម្រាប់របៀបដក',
    /id="removeScanBanner"[^>]*role="status"/.test(html) && /id="removeScanBannerDetail"/.test(html));
ok('មាន modal ផ្ទៀងផ្ទាត់ Barcode/Phone/Locker/COD/DOD',
    ['scanRemoveModal', 'scanRemoveBarcodeText', 'scanRemovePhoneText', 'scanRemoveLockerText',
        'scanRemoveCodText', 'scanRemoveDodText', 'scanRemoveConfirmBtn'].every((id) => html.includes('id="' + id + '"')));
ok('របា Tab ប្រើឈ្មោះខ្លី «ស្កេន»',
    /id="pageTabEntry"[\s\S]{0,180}<span>ស្កេន<\/span>/.test(html));
ok('ដកប៊ូតុង «ដកដោយដៃ» ចេញពីបញ្ជី Barcode',
    !/data-act="removeSingleBarcode"/.test(html + app) && !/btn-delete-bc/.test(html + app + css));
ok('Action delegation មាន confirm/cancel scan removal តែមិនបើក core remove ដោយផ្ទាល់',
    /"confirmScannedRemoval"/.test(app) && /"cancelScannedRemoval"/.test(app) &&
    !/ACTION_ALLOWLIST[\s\S]{0,5000}"removeSingleBarcode"/.test(app));
ok('remove mode មិន persist ជារបៀបគ្រោះថ្នាក់ក្រោយ reload',
    /entryScanMode\s*===\s*'remove'\s*\?\s*'parcel'\s*:\s*entryScanMode/.test(app));
ok('គ្រប់ប្រភពស្កេនចូល trigger តែមួយ ហើយ remove mode មាន route ផ្ទាល់',
    /function triggerScanAction\(barcode\)[\s\S]{0,500}?entryScanMode\s*===\s*'remove'[\s\S]{0,180}?handleRemoveScan\(cleanBarcode\)/.test(app));
// App React ៖ អត្ថបទ preview ជា state (`viewState.scanRemoveTexts`) ហើយ JSX ពិតគូរវាជា **កូនអត្ថបទ** ➜ វាស់ **ឥរិយាបថ** ៖
// គូរប្រអប់ពិត (`react-render.cjs`) ដោយ payload HTML ក្នុងវាលនីមួយៗ ➜ ត្រូវចេញជាអក្សរ escape មិនមែនធាតុ។
const REACT_BUNDLE = fs.existsSync(path.join(APP_DIR, 'react-render.cjs'));
if (REACT_BUNDLE) {
    const { renderComponent, elementById } = require('./react-view');
    const PREVIEW_IDS = ['scanRemoveBarcodeText', 'scanRemovePhoneText', 'scanRemoveLockerText', 'scanRemoveCodText', 'scanRemoveDodText'];
    const payload = (id) => '<img src=x data-probe="' + id + '">';
    let rendered = '';
    try {
        const texts = {};
        PREVIEW_IDS.forEach((id) => { texts[id] = payload(id); });
        rendered = renderComponent(ROOT, 'src/app/components/modals/ScanRemoveModal.tsx', 'ScanRemoveModal', { viewState: { scanRemoveTexts: texts } });
    } catch (e) {
        rendered = '';
    }
    const cells = PREVIEW_IDS.map((id) => ({ id: id, el: elementById(rendered, id) }));
    ok('Preview ដាក់អក្សរតាម textContent មិនបញ្ចូល innerHTML',
        /function setScannedRemovalText\([\s\S]{0,260}?viewState\.scanRemoveTexts\s*=/.test(app) &&
        !/scanRemove(?:Barcode|Phone|Locker|Cod|Dod)Text[^\n]{0,100}innerHTML/.test(app) &&
        cells.every((c) => c.el && c.el.innerHTML.indexOf('&lt;img') !== -1 && !/<img/i.test(c.el.innerHTML)),
        cells.map((c) => c.id + ':' + (c.el ? c.el.innerHTML.slice(0, 60) : 'missing')));
} else {
    ok('Preview ដាក់អក្សរតាម textContent មិនបញ្ចូល innerHTML',
        /function setScannedRemovalText\([\s\S]{0,260}?\.textContent\s*=/.test(app) &&
        !/scanRemove(?:Barcode|Phone|Locker|Cod|Dod)Text[^\n]{0,100}innerHTML/.test(app));
}
ok('ការរំលង native confirm ត្រូវចងនឹង in-flight item និង barcode ដូចគ្នា',
    /arguments\[2\]\s*===\s*'scan-confirmed'/.test(app) &&
    /scanRemoveInFlight\.itemId\s*===\s*itemId/.test(app) &&
    /scanRemoveInFlight\.barcodeCode\s*===\s*barcodeCode/.test(app));
ok('មានសោទប់ confirm/scan ស្ទួន និងផ្លូវ late commit ដោះសោ',
    /let scanRemoveInFlight\s*=\s*null/.test(app) &&
    /function clearScannedRemovalInFlight\(/.test(app) &&
    /armLateCommit\([\s\S]{0,900}?clearScannedRemovalInFlight/.test(app));
ok('Barcode lookup មិនប្រកាន់អក្សរធំតូច និងពិនិត្យ stale listener មុនសន្និដ្ឋានថាបាត់',
    /function findScannedRemovalTarget\([\s\S]{0,600}?lockerCodeKey/.test(app) &&
    /function handleRemoveScan\([\s\S]{0,1500}?dbListenerViewIsStale\(DB_LISTENER_KEY_HISTORY\)/.test(app));
ok('scan mode row ប្រើ grid responsive និងប៊ូតុង touch >= 44px',
    /\.scan-mode-row\s*\{[^}]*display\s*:\s*grid/s.test(css) &&
    /\.mode-btn\s*\{[^}]*min-height\s*:\s*(?:4[4-9]|[5-9]\d)px/s.test(css));
ok('remove mode និង modal មាន danger semantics និងទប់ overflow',
    /\.mode-remove-btn\.active\s*\{[^}]*var\(--action-danger\)/s.test(css) &&
    /\.scan-remove-modal-content\s*\{[^}]*overflow-wrap\s*:\s*anywhere/s.test(css));

const featureSurfaceReady = !!app && !!html && !!css && html.includes('id="modeRemoveBtn"') &&
    typeof process.env.SCANREMOVE_STATIC_ONLY === 'undefined';

let chromium = null;
try { chromium = require('playwright-core').chromium; } catch (e) {}
const CHROME = process.env.SCANREMOVE_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
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
    window.__fakeStore = store;
    window.__historyRemoveTxCount = 0;
    function getPath(rawPath) {
        if (!rawPath || rawPath === '/') return store;
        let current = store;
        for (const part of rawPath.split('/').filter(Boolean)) {
            if (current === null || current === undefined || typeof current !== 'object') return null;
            current = current[part];
        }
        return current === undefined ? null : current;
    }
    function setPath(rawPath, value) {
        const parts = rawPath.split('/').filter(Boolean);
        if (!parts.length) return;
        let current = store;
        for (let i = 0; i < parts.length - 1; i++) {
            if (current[parts[i]] === null || typeof current[parts[i]] !== 'object') current[parts[i]] = {};
            current = current[parts[i]];
        }
        const key = parts[parts.length - 1];
        if (value === null) delete current[key];
        else current[key] = JSON.parse(JSON.stringify(value));
    }
    function snapshot(rawPath) {
        const value = getPath(rawPath);
        return {
            val: () => value === null || value === undefined ? null : JSON.parse(JSON.stringify(value)),
            exists: () => value !== null && value !== undefined
        };
    }
    function fire(rawPath) {
        listeners.filter((entry) => entry.path === rawPath).forEach((entry) => entry.callback(snapshot(rawPath)));
    }
    function fireAll() {
        Array.from(new Set(listeners.map((entry) => entry.path))).forEach(fire);
    }
    const user = { uid: 'audit-user', email: 'audit@example.test', getIdToken: () => Promise.resolve('token'), metadata: { lastSignInTime: new Date().toISOString() } };
    window.firebaseSDK = {
        initializeApp: () => ({ name: 'audit' }), getApps: () => [], deleteApp: () => Promise.resolve(),
        getAuth: () => ({ currentUser: user }),
        onAuthStateChanged: (auth, callback) => { setTimeout(() => callback(user), 0); return () => {}; },
        signInWithEmailAndPassword: () => Promise.resolve({ user }), signOut: () => Promise.resolve(),
        setPersistence: () => Promise.resolve(), browserLocalPersistence: {}, browserSessionPersistence: {},
        getIdTokenResult: () => Promise.resolve({ authTime: new Date().toISOString(), claims: {} }),
        getDatabase: () => ({ fake: true }), ref: (db, rawPath) => ({ path: rawPath === undefined ? '' : String(rawPath) }),
        onValue: (ref, callback) => {
            listeners.push({ path: ref.path, callback });
            setTimeout(() => callback(ref.path === '.info/connected' ? { val: () => true } : snapshot(ref.path)), 0);
            return () => {};
        },
        off: () => {}, goOnline: () => {}, get: (ref) => Promise.resolve(snapshot(ref.path)),
        set: (ref, value) => { setPath(ref.path, value); fireAll(); return Promise.resolve(); },
        update: (ref, values) => {
            const base = ref.path ? ref.path + '/' : '';
            Object.keys(values).forEach((key) => setPath(base + key, values[key]));
            fireAll();
            return Promise.resolve();
        },
        runTransaction: (ref, updater) => {
            const before = getPath(ref.path);
            const next = updater(before === null ? null : JSON.parse(JSON.stringify(before)));
            if (next === undefined) return Promise.resolve({ committed: false, snapshot: snapshot(ref.path) });
            if (ref.path.indexOf('zoew_scan_history_cod_dod/') === 0) window.__historyRemoveTxCount++;
            setPath(ref.path, next);
            fireAll();
            return Promise.resolve({ committed: true, snapshot: snapshot(ref.path) });
        }
    };
    window.dispatchEvent(new Event('firebasesdkready'));
};

function zoneDateKey(ms) {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Phnom_Penh', year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(ms).split('-');
    return parts[0] + '-' + parts[1] + '-' + parts[2];
}

function seedData() {
    const now = Date.now();
    const date = zoneDateKey(now);
    const month = date.substring(0, 7);
    const xssCode = '<img src=x onerror=window.__scanRemoveXss=1>';
    const barcodes = [
        { code: 'ABC123', time: '10:00', cod: 10, dod: 2, locker: 'ទូ7', isClosed: false, isDeducted: false, isFromDeletion: false, createdAt: now },
        { code: xssCode, time: '10:01', cod: 3, dod: 1, locker: 'ទូ8', isClosed: true, isDeducted: false, isFromDeletion: false, createdAt: now }
    ];
    return {
        zoew_scan_history_cod_dod: {
            id_active: { id: 'id_active', phone: '096 849 0421', scanDate: date, createdAt: now, cod: 13, dod: 3, price: 16, count: 2, barcode: 'ABC123', time: '10:00', isClosed: false, barcodes }
        },
        zoew_recently_deleted_cod_dod: {
            id_old: { id: 'id_old', phone: '010000000', scanDate: date, deletedAt: now, cod: 1, dod: 0, price: 1, count: 1, barcode: 'OLD999', trashReason: 'remove', isFromDeletion: false, barcodes: [{ code: 'OLD999', cod: 1, dod: 0, isDeducted: true, isFromDeletion: false }] }
        },
        zoew_daily_revenue_cod_dod: { [date]: { codDollar: 13, dodDollar: 3, totalCount: 2 } },
        zoew_monthly_revenue_cod_dod: { [month]: { codDollar: 13, dodDollar: 3, totalCount: 2 } },
        zoew_daily_pickup_cod_dod: {}, zoew_barcode_registry: {}, zoew_settings: { exchange_rate: 4100 },
        _date: date, _month: month, _xss: xssCode
    };
}

async function runBrowserChecks() {
    const browser = await chromium.launch({ executablePath: CHROME });
    const server = await serve(APP_DIR);
    const port = server.address().port;
    const screenshotDir = process.env.SCANREMOVE_SCREENSHOT_DIR ? path.resolve(process.env.SCANREMOVE_SCREENSHOT_DIR) : '';
    if (screenshotDir) fs.mkdirSync(screenshotDir, { recursive: true });
    const screenshotFontPath = process.env.SCANREMOVE_SCREENSHOT_FONT ? path.resolve(process.env.SCANREMOVE_SCREENSHOT_FONT) : '';
    const screenshotFontData = screenshotFontPath && fs.existsSync(screenshotFontPath)
        ? fs.readFileSync(screenshotFontPath).toString('base64')
        : '';
    const viewports = [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1366, height: 768 }];
    try {
        for (const viewport of viewports) {
            const context = await browser.newContext({ viewport, hasTouch: viewport.width < 992 });
            const page = await context.newPage();
            page.on('dialog', (dialog) => dialog.accept());
            page.on('pageerror', (error) => ok(viewport.width + 'px៖ គ្មាន pageerror', false, error.message));
            await page.addInitScript(`window.addEventListener('unhandledrejection', function (event) {
                var message = event.reason && event.reason.message ? event.reason.message : String(event.reason);
                setTimeout(function () { throw new Error('unhandledrejection: ' + message); }, 0);
            });`);
            await page.route('**', (route) => {
                const url = route.request().url();
                if (url.includes('/license-verify.js')) return route.fulfill({ status: 200, contentType: 'application/javascript', body: LICENSE_STUB });
                if (url.startsWith('http://127.0.0.1:' + port)) return route.continue();
                return route.abort();
            });
            const seed = seedData();
            await page.addInitScript(`window.localStorage.setItem('zoew_firebase_config', ${JSON.stringify(JSON.stringify({ apiKey: 'k', databaseURL: 'https://fake-default-rtdb.firebaseio.com', projectId: 'p' }))});`);
            await page.addInitScript('(' + BOOT.toString() + ')(' + JSON.stringify(seed) + ');');
            await page.goto('http://127.0.0.1:' + port + '/', { waitUntil: 'domcontentloaded', timeout: 30000 });
            if (screenshotFontData) {
                await page.addStyleTag({ content: '@font-face{font-family:"Kantumruy Pro";src:url(data:font/ttf;base64,' + screenshotFontData + ') format("truetype");font-style:normal;font-weight:100 900;font-display:block}' });
                await page.evaluate(() => document.fonts.load('400 16px "Kantumruy Pro"'));
                await page.evaluate(() => document.fonts.ready);
            }
            await page.waitForFunction(() => typeof window.setEntryScanMode === 'function' && document.getElementById('pageTabBar'), null, { timeout: 30000 });
            await page.waitForTimeout(900);
            await page.evaluate(() => { window.switchAppPage('entry'); window.setEntryScanMode('remove'); });
            await page.waitForTimeout(100);

            const layout = await page.evaluate(() => {
                const row = document.querySelector('.scan-mode-row');
                const buttons = Array.from(row.querySelectorAll('.mode-btn'));
                const rowRect = row.getBoundingClientRect();
                return {
                    buttonCount: buttons.length,
                    minButtonHeight: Math.min(...buttons.map((button) => button.getBoundingClientRect().height)),
                    rowOverflow: row.scrollWidth - row.clientWidth,
                    buttonsInside: buttons.every((button) => {
                        const rect = button.getBoundingClientRect();
                        return rect.left >= rowRect.left - 1 && rect.right <= rowRect.right + 1;
                    }),
                    documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
                    removeActive: document.getElementById('modeRemoveBtn').classList.contains('active'),
                    bannerVisible: !document.getElementById('removeScanBanner').classList.contains('hidden'),
                    parcelVisible: !document.getElementById('parcelPanel').classList.contains('hidden'),
                    lockerHidden: document.getElementById('lockerPanel').classList.contains('hidden'),
                    label: document.getElementById('hardwareScannerLabel').textContent,
                    placeholder: document.getElementById('hwScannerInput').placeholder,
                    storedMode: localStorage.getItem('zoe_entry_scan_mode'),
                    tab: document.getElementById('pageTabEntry').textContent.trim()
                };
            });
            const tag = viewport.width + '×' + viewport.height;
            ok(tag + '៖ mode buttons ទាំង ៣ នៅក្នុងជួរ', layout.buttonCount === 3 && layout.buttonsInside, layout);
            ok(tag + '៖ touch target >= 44px', layout.minButtonHeight >= 44, layout.minButtonHeight);
            ok(tag + '៖ គ្មាន horizontal overflow', layout.rowOverflow <= 1 && layout.documentOverflow <= 1, layout);
            ok(tag + '៖ remove mode បង្ហាញ banner និងរក្សាបញ្ជី parcel', layout.removeActive && layout.bannerVisible && layout.parcelVisible && layout.lockerHidden, layout);
            ok(tag + '៖ label/placeholder/tab ប្រាប់សកម្មភាពត្រឹមត្រូវ', /ដក/.test(layout.label) && /ដក/.test(layout.placeholder) && layout.tab === '📷ស្កេន', layout);
            ok(tag + '៖ reload នឹងត្រឡប់ទៅ parcel mode', layout.storedMode === 'parcel', layout.storedMode);

            await page.evaluate(() => window.triggerScanAction('abc123'));
            await page.waitForFunction(() => document.getElementById('scanRemoveModal').style.display === 'flex');
            if (screenshotDir) await page.waitForTimeout(400);
            const preview = await page.evaluate(() => {
                const modal = document.querySelector('#scanRemoveModal .modal-content');
                const rect = modal.getBoundingClientRect();
                const confirmButton = document.getElementById('scanRemoveConfirmBtn');
                const cancelButton = document.getElementById('scanRemoveCancelBtn');
                return {
                    barcode: document.getElementById('scanRemoveBarcodeText').textContent,
                    phone: document.getElementById('scanRemovePhoneText').textContent,
                    locker: document.getElementById('scanRemoveLockerText').textContent,
                    cod: document.getElementById('scanRemoveCodText').textContent,
                    dod: document.getElementById('scanRemoveDodText').textContent,
                    insideViewport: rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight,
                    actionHeight: Math.min(confirmButton.getBoundingClientRect().height, cancelButton.getBoundingClientRect().height)
                };
            });
            ok(tag + '៖ preview ផ្ទៀងផ្ទាត់ field ពិតទាំងអស់',
                preview.barcode === 'ABC123' && preview.phone === '096 849 0421' && preview.locker === 'ទូ7' && preview.cod === '$10.00' && preview.dod === '$2.00', preview);
            ok(tag + '៖ modal និង action buttons សមនឹង viewport', preview.insideViewport && preview.actionHeight >= 44, preview);
            if (screenshotDir) await page.screenshot({ path: path.join(screenshotDir, 'scan-remove-' + viewport.width + 'x' + viewport.height + '.png') });

            await page.evaluate(() => window.cancelScannedRemoval());
            const afterCancel = await page.evaluate(() => ({
                live: !!window.__fakeStore.zoew_scan_history_cod_dod.id_active,
                trashCount: Object.keys(window.__fakeStore.zoew_recently_deleted_cod_dod).length,
                removeActive: document.getElementById('modeRemoveBtn').classList.contains('active')
            }));
            ok(tag + '៖ cancel មិនប៉ះទិន្នន័យ និង mode នៅដដែល', afterCancel.live && afterCancel.trashCount === 1 && afterCancel.removeActive, afterCancel);

            await page.evaluate(() => { window.triggerScanAction('ABC123'); window.__historyRemoveTxCount = 0; window.confirmScannedRemoval(); window.confirmScannedRemoval(); });
            await page.waitForFunction(() => !window.__fakeStore.zoew_scan_history_cod_dod.id_active || window.__fakeStore.zoew_scan_history_cod_dod.id_active.barcodes.length === 1, null, { timeout: 10000 });
            await page.waitForTimeout(250);
            const removed = await page.evaluate((keys) => {
                const live = window.__fakeStore.zoew_scan_history_cod_dod.id_active;
                const trash = Object.values(window.__fakeStore.zoew_recently_deleted_cod_dod).find((item) => item && item.barcode === 'ABC123');
                return {
                    liveCodes: live && live.barcodes ? live.barcodes.map((barcode) => barcode.code) : [],
                    trashReason: trash && trash.trashReason,
                    deducted: trash && trash.barcodes && trash.barcodes[0] && trash.barcodes[0].isDeducted,
                    daily: window.__fakeStore.zoew_daily_revenue_cod_dod[keys.date],
                    monthly: window.__fakeStore.zoew_monthly_revenue_cod_dod[keys.month],
                    txCount: window.__historyRemoveTxCount,
                    removeActive: document.getElementById('modeRemoveBtn').classList.contains('active')
                };
            }, { date: seed._date, month: seed._month });
            ok(tag + '៖ confirm ពីរដងធ្វើ transaction ដកតែម្តង', removed.txCount === 1, removed);
            ok(tag + '៖ ដកចូល trash ជា remove + isDeducted=true', removed.trashReason === 'remove' && removed.deducted === true && !removed.liveCodes.includes('ABC123'), removed);
            ok(tag + '៖ daily/monthly ledger ដក COD/DOD/count ត្រឹមត្រូវ',
                removed.daily && removed.daily.codDollar === 3 && removed.daily.dodDollar === 1 && removed.daily.totalCount === 1 &&
                removed.monthly && removed.monthly.codDollar === 3 && removed.monthly.dodDollar === 1 && removed.monthly.totalCount === 1, removed);
            ok(tag + '៖ ក្រោយដករួច mode នៅ remove សម្រាប់ batch scan', removed.removeActive, removed);

            await page.evaluate(() => window.triggerScanAction('ABC123'));
            await page.waitForTimeout(50);
            const duplicate = await page.evaluate(() => ({
                modalOpen: document.getElementById('scanRemoveModal').style.display === 'flex',
                toast: document.getElementById('toastContainer').textContent
            }));
            ok(tag + '៖ scan barcode ដែលដករួច no-op និងប្រាប់ថានៅធុងសំរាម', !duplicate.modalOpen && /ធុងសំរាម|ដករួច/.test(duplicate.toast), duplicate);

            await page.evaluate((xss) => window.triggerScanAction(xss), seed._xss);
            await page.waitForFunction(() => document.getElementById('scanRemoveModal').style.display === 'flex');
            const xss = await page.evaluate((expected) => {
                const target = document.getElementById('scanRemoveBarcodeText');
                return { text: target.textContent, childCount: target.children.length, fired: !!window.__scanRemoveXss };
            }, seed._xss);
            ok(tag + '៖ Barcode ជា HTML ត្រូវបង្ហាញជាអក្សរ មិនដំណើរការ XSS', xss.text === seed._xss && xss.childCount === 0 && !xss.fired, xss);
            await page.evaluate(() => window.cancelScannedRemoval());
            await page.evaluate(() => window.showLoginModalWithPrefill());
            const loggedOut = await page.evaluate(() => ({
                parcelActive: document.getElementById('modeParcelBtn').classList.contains('active'),
                removeActive: document.getElementById('modeRemoveBtn').classList.contains('active'),
                bannerHidden: document.getElementById('removeScanBanner').classList.contains('hidden'),
                storedMode: localStorage.getItem('zoe_entry_scan_mode'),
                previewBarcode: document.getElementById('scanRemoveBarcodeText').textContent,
                scannerLabel: document.getElementById('hardwareScannerLabel').textContent
            }));
            ok(tag + '៖ logout សម្អាត preview ហើយត្រឡប់ scanner ទៅ parcel ដោយសុវត្ថិភាព',
                loggedOut.parcelActive && !loggedOut.removeActive && loggedOut.bannerHidden &&
                loggedOut.storedMode === 'parcel' && loggedOut.previewBarcode === '' &&
                loggedOut.scannerLabel.indexOf('ដក') === -1, loggedOut);
            await context.close();
        }
    } finally {
        await browser.close();
        server.close();
    }
}

(async () => {
    if (featureSurfaceReady) {
        if (!chromium || !fs.existsSync(CHROME)) {
            console.log('SKIP — browser checks ត្រូវការ playwright-core និង Chromium');
        } else {
            try {
                await runBrowserChecks();
            } catch (error) {
                ok('browser scan-remove flow បញ្ចប់ដោយគ្មាន exception', false, error && error.stack ? error.stack : String(error));
            }
        }
    }
    if (assertions < 15) ok('ជាន់អប្បបរមា៖ assertions >= 15', false, assertions);
    console.log('\n' + (fail ? 'FAIL ' + fail + ' / ជោគជ័យ ' + pass : 'PASS ' + pass + '/' + pass));
    process.exit(fail ? 1 : 0);
})();
