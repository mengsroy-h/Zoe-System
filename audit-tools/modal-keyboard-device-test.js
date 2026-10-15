#!/usr/bin/env node
// modal-keyboard-device-test.js — ប្រអប់ (modal) + keyboard ៖ គ្រប់ប្រភេទឧបករណ៍ · គ្រប់ទំហំ (Android APK · PWA Chrome Android · iPhone · iPad)
//
// វីដេអូម្ចាស់គម្រោងលើ 2.50.78 ៖
//   (ក) APK ៖ «កន្ត្រាក់ ២ ដង ពេល keyboard លោតឡើង គ្រប់ modal» — `KeyboardOpenHold` រក្សាកម្ពស់ WebView ពេល keyboard លោត ប៉ុន្តែ visualViewport បង្រួមភ្លាម ➜
//       ការតម្រូវផ្លាស់ទីប្រអប់ម្តង ➜ ចប់ចលនា WebView បង្រួម ➜ ប្រអប់ផ្លាស់ទីម្តងទៀត។ ច្បាប់ ៖ ទីតាំងពេល keyboard កំពុងលោត = ទីតាំងក្រោយ viewport បង្រួម (±1px) ·
//       បាតកាតនៅពីលើ keyboard · ប្រអប់វាយមើលឃើញ — គ្រប់ប្រអប់ដែលមានប្រអប់វាយ (ដេរីវេពី DOM) × ទូរស័ព្ទតូច/ធំ · ផ្តេក · tablet បញ្ឈរ/ផ្តេក · PWA Chrome (UA Android)
//   (ខ) iPhone ៖ «បើក modal បញ្ចូលច្រើន ហើយចុចឲ្យចេញ keyboard ទំព័រទាំងមូលធ្លាក់ចុះមួយភ្លែត» — ប្រអប់វាយដែល focus ដោយកូដ (iOS មិនបើក keyboard)
//       ចុចទៅផ្លូវ iOS ដើម ➜ WebKit រំកិលទំព័រ ➜ `restoreIOSDocumentScroll()` ទាញ ០ កណ្តាលចលនា។ ច្បាប់ ៖ ប្រអប់វាយ focus រួច + keyboard មិនទាន់បើក + មិនទាន់ចុច ➜
//       touchend preventDefault + focus({ preventScroll }) · keyboard បើករួច ➜ iOS ធ្វើខ្លួនឯង — គ្រប់ប្រអប់ × iPhone · iPad + «បញ្ចូលច្រើន» ពិត (`openBatchScanModal()`)
//   (ក) APK (វីដេអូលើ 2.50.79) ៖ «នៅតែញ៉ាក់ពេល keyboard លោតមក» — hold ចប់ ➜ WebView បង្រួម ប៉ុន្តែ Chromium នៅរាយការណ៍ inset keyboard ចាស់ ៣–៥ ស៊ុម
//       (visualViewport = WebView បង្រួម − keyboard) ➜ ការតម្រូវច្របាច់ប្រអប់ទៅលើ។ ច្បាប់ ៖ `uiState.keyboardOpen` (WebView បង្រួមសម្រាប់ keyboard) ➜ គ្មានការតម្រូវ ·
//       ជំហាន ៖ setViewportSize (បង្រួម) + visualViewport នៅ inset ចាស់ ➜ ប្រអប់នៅទីតាំងដដែល (±1px)
//   (គ) iPhone (វីដេអូលើ 2.50.79) ៖ «ចុចកន្លែងវាយបញ្ចូល Barcode ទំព័រធ្លាក់» — ប្រអប់វាយ Barcode (ទំព័រស្កេន · ក្រៅប្រអប់) ចុចទៅផ្លូវ iOS ដើម។ ច្បាប់ ៖
//       ប្រអប់នៅពីលើបន្ទាត់ keyboard (ធ្លាប់វាស់ ឬ PAGE_TAP_KEYBOARD_RATIO) ➜ preventDefault + focus({ preventScroll }) · keyboard នឹងបាំងប្រអប់ (iPad ផ្តេក · iPhone SE របៀបដក) ➜ iOS ·
//       iPhone SE · iPhone · Pro Max · ផ្តេក · iPad បញ្ឈរ/ផ្តេក (UA កុំព្យូទ័រ ➜ focus ដោយកូដ)
//   (គ) Chrome Android (វីដេអូលើ 2.50.81) ៖ «ចុចកន្លែងវាយ Barcode (របៀបដក) ទំព័ររំកិលឡើង navbar បាត់» — keyboard Chrome មិនបង្រួមទំព័រ (resizes-visual) ➜
//       Chromium រំកិល visual viewport ដើម្បីបង្ហាញប្រអប់ (ScrollFocusedEditableElementIntoView)។ ច្បាប់ ៖ ដូច iPhone ➜ preventDefault + focus({ preventScroll }) ·
//       tablet ផ្តេក (keyboard បាំង) ➜ Android · ទូរស័ព្ទផ្តេក (A124 ៖ ផ្ទាំងស្កេន ២ ជួរឈរ ➜ កន្លែងវាយខាងលើស្តាំ ពីលើ keyboard ពិត) ➜ ចាប់
//   (ឃ) Chrome Android ៖ «ចុចស្វែងរកបញ្ជីកញ្ចប់ ➜ ឃើញតែសារទទេ ៣ វិ.» — visual viewport រំកិលរួច ➜ ការបង្រួម + focus({ preventScroll }) ទុកប្រអប់ពីលើផ្ទៃមើលឃើញ។
//       ច្បាប់ ៖ ចុចស្វែងរក ➜ offsetTop ០ (documentElement.scrollIntoView · window.scrollTo មិនប៉ះ visual viewport) — visual viewport ពិត (pinch លើ meta ពង្រីកបាន)
//   (ង) ឧបករណ៍ស្កេន Bluetooth/USB (សំណើម្ចាស់គម្រោង) ៖ គ្មានអ្វី focus (ទូរស័ព្ទ) ➜ ការស្កេនទៅប្រអប់ Barcode · keyboard ខ្មែរ ➜ លេខឡាតាំង · suffix Tab ➜ បញ្ជូន ·
//       ផ្ទាំងលេខទូរស័ព្ទបើក ➜ ការស្កេនមិនចូល COD (ចូលជួរ ➜ បើកក្រោយផ្ទាំងបិទ) · ការវាយល្បឿនមនុស្សចូលប្រអប់ (`execCommand` លើ type=number) ·
//       ការស្កេនគ្មាន Enter/Tab ➜ មិនចូល · COD លើស SCAN_MONEY_MAX ➜ មិនរក្សាទុក ·
//       «📋 បញ្ចូលច្រើន» ➜ ការស្កេនចូលប្រអប់បញ្ចូលច្រើន · Tab ➜ ជួរថ្មី ·
//       ទិសផ្ទុយ ៖ ប្រអប់ស្វែងរក focus ➜ មិនលួច — ព្រឹត្តិការណ៍ keyboard ពិត (CDP) · Android · iPhone · កុំព្យូទ័រ
//   ទិសផ្ទុយ ៖ ប្រអប់វាយក្នុងប្រអប់ (modal) លើ Android ➜ មិនប៉ះការចុច · iPhone (មិនមែន Android) ➜ ច្បាប់តម្រូវ iPhone ដដែល (មិនមែនកណ្តាល)
// វិធី ៖ App ពិត (audit build) · bridge Capacitor ក្លែង (APK) · visualViewport ក្លែង (Chromium គ្មាន keyboard) · setViewportSize = viewport បង្រួម។

let chromium;
try { chromium = require('playwright-core').chromium; } catch (e) {
    console.log('SKIP — ត្រូវការ playwright-core (npm i playwright-core)');
    process.exit(0);
}
process.exitCode = 1;
const CHROME = process.env.MODALKB_DEVICE_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const fs = require('fs');
const http = require('http');
const path = require('path');
if (!fs.existsSync(CHROME)) { console.log('SKIP — រកមិនឃើញ Chromium'); process.exit(0); }

const ROOT = process.env.MODALKB_DEVICE_APP_DIR || path.join(__dirname, '..');
const APP = path.join(ROOT, 'ZoeW');
// ពិដានចន្លោះគ្រាប់ម៉ាស៊ីនស្កេន ស្រង់ពីកូដ App (មិនសរសេរលេខរឹង) ៖ ការស្កេនក្លែងដែលចន្លោះពិត (event.timeStamp) លើសវា មិនមែនជាការស្កេនទេ
const SCANNER_GAP_MS = (() => { try { const m = fs.readFileSync(path.join(APP, 'app.js'), 'utf8').match(/\bSCANNER_KEY_GAP_MS = (\d+)/); return m ? Number(m[1]) : 0; } catch (e) { return 0; } })();
const KEYBOARD_SETTLE_FLOOR = (() => { try { const m = fs.readFileSync(path.join(APP, 'app.js'), 'utf8').match(/\bKEYBOARD_SETTLE_MS = (\d+)/); return m ? Number(m[1]) : 0; } catch (e) { return 0; } })();
const KEYBOARD_MIN_INSET_FLOOR = (() => { try { const m = fs.readFileSync(path.join(APP, 'app.js'), 'utf8').match(/\bKEYBOARD_MIN_INSET_PX = (\d+)/); return m ? Number(m[1]) : Infinity; } catch (e) { return Infinity; } })();
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm', '.svg': 'image/svg+xml' };
const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36';

let pass = 0, fail = 0;
const ok = (n) => { console.log('  ok    ' + n); pass++; };
const bad = (n, d) => { console.log('  FAIL  ' + n + (d ? '\n        ' + d : '')); fail++; };
const check = (c, n, d) => (c ? ok(n) : bad(n, d));
// ⛔ `--part=k/2` (ដូច `zoew-suite-test` · `money-guardian-test`) ៖ ផ្នែកទាំងអស់រត់តាមលំដាប់ ➜ run-all ពេញ (lane ស្របគ្នា) ចំណាយ > ៣០០ វិ.
//    («ព្យួរ — លើសពិដាន 300s» ក្រោយ (ក២)) ⛔ មិនមែនបង្កើន CHECKER_TIMEOUT ទេ ➜ run-all រត់ផ្នែកទាំង ២ (lane ផ្សេងគ្នា) · គ្មាន `--part` ➜
//    ផ្នែកទាំងអស់ (baseline · checker-coverage) · ផ្នែកនីមួយៗត្រូវស្ថិតក្នុងក្រុមតែមួយគត់ (ពិនិត្យនៅចុងក្រោយ)។
const PART_GROUPS = [['ក', 'ខ'], ['ក២', 'គ', 'ឃ', 'ង', 'ច', 'ទិសផ្ទុយ']];
const PART = (() => {
    const arg = process.argv.slice(2).find((a) => a.startsWith('--part'));
    if (!arg) return { k: 1, n: 1 };
    const m = /^--part=(\d+)\/(\d+)$/.exec(arg);
    if (!m || +m[2] !== PART_GROUPS.length || +m[1] < 1 || +m[1] > +m[2]) return null;
    return { k: +m[1], n: +m[2] };
})();
const sectionsAsked = new Set();
const inPart = (name) => {
    sectionsAsked.add(name);
    return !!PART && (PART.n === 1 || PART_GROUPS[PART.k - 1].indexOf(name) !== -1);
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

// visualViewport ក្លែង ៖ `__kb.set(px)` (គ្មានព្រឹត្តិការណ៍) · `__kb.fire()` · `__kb.open(px)` = set + fire
const FAKE_VIEWPORT = function () {
    const fake = new EventTarget();
    let inset = 0;
    Object.defineProperty(fake, 'height', { get: () => window.innerHeight - inset });
    Object.defineProperty(fake, 'width', { get: () => window.innerWidth });
    Object.defineProperty(fake, 'offsetTop', { get: () => 0 });
    Object.defineProperty(fake, 'offsetLeft', { get: () => 0 });
    Object.defineProperty(fake, 'pageTop', { get: () => window.scrollY || 0 });
    Object.defineProperty(fake, 'pageLeft', { get: () => 0 });
    Object.defineProperty(fake, 'scale', { get: () => 1 });
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: fake });
    const fire = () => { fake.dispatchEvent(new Event('resize')); fake.dispatchEvent(new Event('scroll')); };
    window.__kb = { set(px) { inset = px; }, fire, open(px) { inset = px; fire(); } };
};

// bridge Capacitor ក្លែងតិចបំផុត ៖ App ដឹងថាជា APK (`isNativeAndroid()`) · plugin ឆ្លើយ {} (fail-open)
const APK_BRIDGE = function () {
    window.androidBridge = { postMessage() {} };
    window.Capacitor = { PluginHeaders: [], isNativePlatform: () => true, getPlatform: () => 'android',
        nativePromise() { return Promise.resolve({}); }, nativeCallback() { return '1'; } };
};

// meta viewport ពង្រីកបាន ៖ visual viewport ពិតរំកិលបាន (pinch) ដូច keyboard Chrome Android (resizes-visual) រំកិលវា
const ZOOMABLE = function () {
    document.addEventListener('DOMContentLoaded', () => {
        const meta = document.querySelector('meta[name="viewport"]');
        if (meta) meta.setAttribute('content', 'width=device-width, initial-scale=1.0, viewport-fit=cover');
    });
};

const IOS_FLAGS = function () {
    try { Object.defineProperty(window.navigator, 'standalone', { configurable: true, value: true }); } catch (e) {}
    try {
        const nativeSupports = window.CSS.supports.bind(window.CSS);
        Object.defineProperty(window.CSS, 'supports', {
            configurable: true,
            value: (property, value) => property === '-webkit-touch-callout' && value === 'none' ? true : nativeSupports(property, value)
        });
    } catch (e) {}
};

const TAP_LOG = function () {
    window.__touchEnds = [];
    window.__focusLog = [];
    window.addEventListener('touchend', (e) => { window.__touchEnds.push(e.defaultPrevented); }, false);
    const real = HTMLElement.prototype.focus;
    HTMLElement.prototype.focus = function (options) {
        window.__focusLog.push({ id: this.id || this.tagName, preventScroll: !!(options && options.preventScroll) });
        return real.call(this, options);
    };
};

const FIELD_SELECTOR = 'textarea, input:not([type]), input[type="text"], input[type="number"], input[type="tel"], input[type="password"], ' +
    'input[type="email"], input[type="search"], input[type="url"]';

const settle = (page, ms) => page.evaluate((t) => new Promise((r) => setTimeout(r, t)), ms || 200);

async function openApp(browser, port, size, inits, extra) {
    const ctx = await browser.newContext(Object.assign({ viewport: { width: size.w, height: size.h }, hasTouch: true, isMobile: true, serviceWorkers: 'block' }, extra || {}));
    const page = await ctx.newPage();
    page.on('dialog', (d) => d.dismiss().catch(() => {}));
    await page.route('**', (r) => r.request().url().startsWith('http://127.0.0.1:' + port) ? r.continue() : r.abort());
    for (const init of inits) await page.addInitScript(init);
    await page.goto('http://127.0.0.1:' + port + '/', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(900);
    const ready = await page.evaluate(() => typeof openModalHelper === 'function' && typeof closeModal === 'function' && typeof openModalIds === 'function');
    return { ctx, page, ready };
}

async function closeAll(page) {
    await page.evaluate(() => { openModalIds().slice().forEach((id) => closeModal(id)); });
    await settle(page, 100);
}

async function modalIdsWithFields(page) {
    return page.evaluate((sel) => Array.from(document.querySelectorAll('.modal'))
        .filter((m) => m.id && m.querySelector(sel)).map((m) => m.id), FIELD_SELECTOR);
}

async function firstVisibleField(page, id) {
    return page.evaluate(({ id, sel }) => {
        const modal = document.getElementById(id);
        const list = Array.from(modal.querySelectorAll(sel));
        const i = list.findIndex((f) => { const r = f.getBoundingClientRect(); const cs = getComputedStyle(f); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && !f.disabled && !f.readOnly; });
        return i;
    }, { id, sel: FIELD_SELECTOR });
}

const RECT = function ({ id, index, sel }) {
    const modal = document.getElementById(id);
    const field = Array.from(modal.querySelectorAll(sel))[index];
    const content = modal.querySelector('.modal-content') || modal.firstElementChild;
    const c = content.getBoundingClientRect();
    const f = field.getBoundingClientRect();
    return { card: [Math.round(c.top), Math.round(c.bottom)], field: [Math.round(f.top), Math.round(f.bottom), Math.round(f.left + f.width / 2), Math.round(f.top + Math.min(20, f.height / 2))],
        focused: document.activeElement === field, fitted: modal.classList.contains('modal-kb') };
};

const ANDROID_DEVICES = [
    { label: 'APK ទូរស័ព្ទតូច 360×640 · keyboard 280', w: 360, h: 640, kb: 280, apk: true },
    { label: 'APK ទូរស័ព្ទ 412×915 · keyboard 330', w: 412, h: 915, kb: 330, apk: true },
    { label: 'APK ទូរស័ព្ទផ្តេក 915×412 · keyboard 190', w: 915, h: 412, kb: 190, apk: true },
    { label: 'APK tablet បញ្ឈរ 800×1280 · keyboard 420', w: 800, h: 1280, kb: 420, apk: true },
    { label: 'APK tablet ផ្តេក 1280×800 · keyboard 360', w: 1280, h: 800, kb: 360, apk: true },
    { label: 'PWA Chrome Android 412×915 · keyboard 330', w: 412, h: 915, kb: 330, apk: false },
    { label: 'PWA Chrome Android 360×740 · keyboard 300', w: 360, h: 740, kb: 300, apk: false }
];

const IOS_DEVICES = [
    { label: 'iPhone 393×852', w: 393, h: 852, kb: 336 },
    { label: 'iPad បញ្ឈរ 820×1180', w: 820, h: 1180, kb: 375 }
];

const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1';
const IPAD_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15';

// ឧបករណ៍ស្កេន HID ៖ ទូរស័ព្ទ Android (Bluetooth) · iPhone standalone (Bluetooth) · កុំព្យូទ័រ (USB · គ្មាន touch)
const HID_DEVICES = [
    { label: 'Android 412×915 (Bluetooth)', w: 412, h: 915, ctx: { userAgent: ANDROID_UA } },
    { label: 'iPhone 393×852 standalone (Bluetooth)', w: 393, h: 852, ios: true, ctx: { userAgent: IPHONE_UA } },
    { label: 'កុំព្យូទ័រ 1280×800 (USB)', w: 1280, h: 800, ctx: { isMobile: false, hasTouch: false } }
];

// ប្រអប់វាយ Barcode (ទំព័រស្កេន · ក្រៅប្រអប់) ៖ catch = ប្រអប់នៅពីលើបន្ទាត់ keyboard ប៉ាន់ (PAGE_TAP_KEYBOARD_RATIO) ➜ ចាប់ · បើមិនដូច្នោះ ➜ iOS (keyboard បាំង ➜ iOS ត្រូវបង្ហាញ)
const SCANNER_DEVICES = [
    { label: 'iPhone SE 375×667', w: 375, h: 667, kb: 260, ua: IPHONE_UA, catch: true, byCode: false },
    { label: 'iPhone 393×852', w: 393, h: 852, kb: 336, ua: IPHONE_UA, catch: true, byCode: false },
    { label: 'iPhone Pro Max 430×932', w: 430, h: 932, kb: 346, ua: IPHONE_UA, catch: true, byCode: false },
    { label: 'iPhone ផ្តេក 852×393 (ផ្ទាំងស្កេន ២ ជួរឈរ ៖ កន្លែងវាយខាងលើស្តាំ)', w: 852, h: 393, kb: 209, ua: IPHONE_UA, catch: true, byCode: false },
    { label: 'iPad បញ្ឈរ 820×1180 (UA កុំព្យូទ័រ ➜ focus ដោយកូដ)', w: 820, h: 1180, kb: 375, ua: IPAD_UA, catch: true, byCode: true },
    { label: 'iPad ផ្តេក 1180×820 (UA កុំព្យូទ័រ)', w: 1180, h: 820, kb: 398, ua: IPAD_UA, catch: false, byCode: true },
    { label: 'iPhone 393×852 · status bar 59 · របៀបកញ្ចប់', w: 393, h: 852, kb: 365, ua: IPHONE_UA, catch: true, byCode: false, safeTop: 59, mode: 'parcel' },
    { label: 'iPhone 393×852 · status bar 59 · របៀបដក (វីដេអូ ៖ keyboard ខ្មែរ 365)', w: 393, h: 852, kb: 365, ua: IPHONE_UA, catch: true, byCode: false, safeTop: 59, mode: 'remove' },
    { label: 'iPhone Pro Max 430×932 · status bar 59 · របៀបដក', w: 430, h: 932, kb: 375, ua: IPHONE_UA, catch: true, byCode: false, safeTop: 59, mode: 'remove' },
    { label: 'iPhone SE 375×667 · status bar 20 · របៀបដក', w: 375, h: 667, kb: 305, ua: IPHONE_UA, catch: false, byCode: false, safeTop: 20, mode: 'remove' },
    { label: 'iPhone 393×852 · status bar 59 · របៀបដក ក្រោយ keyboard បើកម្តង (លោតហួស 420 ➜ ស្ងប់ 365 ៖ ចាំ 365)', w: 393, h: 852, kb: 365, ua: IPHONE_UA, catch: true, byCode: false, safeTop: 59, mode: 'remove', learn: [420, 365] },
    { label: 'Chrome Android 411×830 · របៀបដក (វីដេអូ ៖ keyboard ខ្មែរ + របារ URL 407)', w: 411, h: 830, kb: 407, ua: ANDROID_UA, android: true, catch: true, byCode: false, mode: 'remove' },
    { label: 'Chrome Android 360×740 · របៀបដក · keyboard 300', w: 360, h: 740, kb: 300, ua: ANDROID_UA, android: true, catch: true, byCode: false, mode: 'remove' },
    { label: 'Chrome Android 412×915 · របៀបកញ្ចប់ · keyboard 330', w: 412, h: 915, kb: 330, ua: ANDROID_UA, android: true, catch: true, byCode: false },
    { label: 'Android tablet បញ្ឈរ 800×1280 · របៀបដក · keyboard 420', w: 800, h: 1280, kb: 420, ua: ANDROID_UA, android: true, catch: true, byCode: false, mode: 'remove' },
    { label: 'Android ផ្តេក 915×412 · keyboard 190 (ផ្ទាំងស្កេន ២ ជួរឈរ)', w: 915, h: 412, kb: 190, ua: ANDROID_UA, android: true, catch: true, byCode: false },
    { label: 'Android ផ្តេក 780×360 · របៀបដក · keyboard 200 (A124)', w: 780, h: 360, kb: 200, ua: ANDROID_UA, android: true, catch: true, byCode: false, mode: 'remove' },
    { label: 'Android tablet ផ្តេក 1280×800 · របៀបដក · keyboard 360', w: 1280, h: 800, kb: 360, ua: ANDROID_UA, android: true, catch: false, byCode: false, mode: 'remove' }
];

// របារស្ថានភាព iPhone (safe-area-inset-top) ៖ Chromium មាន env(safe-area-*) = ០ ➜ រុញទំព័រចុះតាមកម្ពស់ពិត (វាស់ពីវីដេអូ ៖ កន្លែងវាយរបៀបដក បាត 442pt លើ 852)
const SAFE_TOP = function (px) {
    document.addEventListener('DOMContentLoaded', () => {
        const s = document.createElement('style');
        s.textContent = 'html.ios-standalone body { padding-top: ' + px + 'px !important; }';
        document.head.appendChild(s);
    });
};

(async () => {
    const server = await serve(APP);
    const port = server.address().port;
    const browser = await chromium.launch({ executablePath: CHROME });
    try {
        const exists = fs.existsSync(path.join(APP, 'index.html'));
        check(exists, 'App ZoeW (audit build) រកឃើញ ៖ ' + APP);
        if (!exists) return;
        check(!!PART, '⛔ --part ត្រូវជា k/' + PART_GROUPS.length, process.argv.slice(2).join(' '));
        if (!PART) return;
        if (PART.n > 1) {
            console.log('  ផ្នែក ' + PART.k + '/' + PART.n + ' ៖ ' + PART_GROUPS[PART.k - 1].join(' · '));
            let runall = '';
            try { runall = fs.readFileSync(path.join(__dirname, 'run-all.sh'), 'utf8').replace(/^\s*#.*$/gm, ''); } catch (e) {}
            const listed = [];
            for (let k = 1; k <= PART.n; k++) {
                if (new RegExp('node\\s+audit-tools/modal-keyboard-device-test\\.js\\s+--part=' + k + '/' + PART.n + '(?=\\s|$)', 'm').test(runall)) listed.push(k);
            }
            check(listed.length === PART.n, '⛔ run-all.sh រត់ផ្នែកទាំង ' + PART.n + ' (ផ្នែកដែលបាត់ = ករណីដែលគ្មាននរណារត់)', 'ឃើញ ' + listed.join(','));
        }

        if (inPart('ក')) {
            console.log('\n=== (ក) Android ៖ keyboard ចាប់ផ្តើមលោត (visualViewport បង្រួម · viewport នៅកម្ពស់ដើម) ➜ ចប់ (viewport បង្រួម) ➜ ប្រអប់ផ្លាស់ទីតែម្តង ===');
            let androidMeasured = 0;
            for (const dev of ANDROID_DEVICES) {
                const { ctx, page, ready } = await openApp(browser, port, dev, dev.apk ? [APK_BRIDGE, FAKE_VIEWPORT] : [FAKE_VIEWPORT], dev.apk ? null : { userAgent: ANDROID_UA });
                const kind = ready && await page.evaluate((apk) => apk ? !!(window.Capacitor && window.Capacitor.isNativePlatform()) : !window.Capacitor && /Android/.test(navigator.userAgent), dev.apk);
                if (!ready || !kind) { bad(dev.label + ' ៖ audit bridge'); await ctx.close(); continue; }
                const ids = await modalIdsWithFields(page);
                const problems = [];
                let measured = 0, movedAtStart = 0, staleMeasured = 0;
                for (const id of ids) {
                    await page.setViewportSize({ width: dev.w, height: dev.h });
                    await page.evaluate(() => { window.__kb.set(0); window.__kb.fire(); });
                    await closeAll(page);
                    await page.evaluate((m) => openModalHelper(m), id);
                    await settle(page, 320);
                    const index = await firstVisibleField(page, id);
                    if (index < 0) continue;
                    await page.evaluate(({ id, index, sel }) => Array.from(document.getElementById(id).querySelectorAll(sel))[index].focus({ preventScroll: true }), { id, index, sel: FIELD_SELECTOR });
                    const base = await page.evaluate(RECT, { id, index, sel: FIELD_SELECTOR });
                    await page.evaluate((kb) => window.__kb.open(kb), dev.kb);
                    await settle(page, 160);
                    const hold = await page.evaluate(RECT, { id, index, sel: FIELD_SELECTOR });
                    let stale = null;
                    if (dev.apk) {
                        await page.setViewportSize({ width: dev.w, height: dev.h - dev.kb });
                        await page.evaluate(() => window.__kb.fire());
                        await settle(page, 60);
                        stale = await page.evaluate(RECT, { id, index, sel: FIELD_SELECTOR });
                    }
                    await page.evaluate(() => window.__kb.set(0));
                    await page.setViewportSize({ width: dev.w, height: dev.h - dev.kb });
                    await page.evaluate(() => window.__kb.fire());
                    await settle(page, 200);
                    const after = await page.evaluate(RECT, { id, index, sel: FIELD_SELECTOR });
                    measured++;
                    if (stale) staleMeasured++;
                    if (Math.abs(hold.card[0] - base.card[0]) > 1) movedAtStart++;
                    const line = dev.h - dev.kb;
                    const issues = [];
                    if (Math.abs(hold.card[0] - after.card[0]) > 1 || Math.abs(hold.card[1] - after.card[1]) > 1) issues.push('ផ្លាស់ទីពីរដង ' + base.card[0] + ' ➜ ' + hold.card[0] + ' ➜ ' + after.card[0] + ' (បាត ' + hold.card[1] + ' ➜ ' + after.card[1] + ')');
                    if (stale && (Math.abs(stale.card[0] - hold.card[0]) > 1 || Math.abs(stale.card[1] - hold.card[1]) > 1)) issues.push('ស្ទុះពេល WebView បង្រួម (inset keyboard ចាស់) ' + hold.card[0] + ' ➜ ' + stale.card[0] + ' ➜ ' + after.card[0] + ' (បាត ' + hold.card[1] + ' ➜ ' + stale.card[1] + ')');
                    if (hold.card[1] > line + 1) issues.push('បាតកាត ' + hold.card[1] + ' នៅក្រោយ keyboard ' + line);
                    if (hold.card[0] < 0) issues.push('កំពូលកាតផុតអេក្រង់ ' + hold.card[0]);
                    if (hold.field[0] < 0 || hold.field[1] > line + 1) issues.push('ប្រអប់វាយមើលមិនឃើញ [' + hold.field[0] + ',' + hold.field[1] + ']');
                    if (!hold.focused || !hold.fitted) issues.push('focus/.modal-kb');
                    if (issues.length) problems.push(id + ' ៖ ' + issues.join(' · '));
                }
                androidMeasured += measured;
                check(measured >= 15 && movedAtStart >= Math.floor(measured * 0.6) && problems.length === 0 && (!dev.apk || staleMeasured === measured),
                    '⛔ ' + dev.label + ' ៖ ' + measured + ' ប្រអប់ ➜ ផ្លាស់ទីតែម្តងពេល keyboard ចាប់ផ្តើម (ទីតាំងពេលលោត = ក្រោយ viewport បង្រួម ±1px) · បាតនៅពីលើ keyboard · ប្រអប់វាយមើលឃើញ' +
                        (dev.apk ? ' · APK ៖ WebView បង្រួមពេល Chromium នៅរាយការណ៍ keyboard (inset ចាស់) ➜ ប្រអប់មិនស្ទុះ' : ''),
                    JSON.stringify({ measured, movedAtStart, staleMeasured, problems: problems.slice(0, 6) }));
                await ctx.close();
            }
            check(androidMeasured >= ANDROID_DEVICES.length * 15, 'ជាន់អប្បបរមា ៖ Android វាស់ ' + androidMeasured + ' ករណី (ឧបករណ៍ ' + ANDROID_DEVICES.length + ')');
        }

        if (inPart('ក២')) {
            console.log('\n=== (ក២) វីដេអូ Android (keyboard លេខ) ៖ keyboard ប្រាប់កម្ពស់ចាស់ (QWERTY +80) ពេលចាប់ផ្តើម ហើយស្ងប់ keyboard លេខ ➜ លើកដំបូង ៖ កាតមិនចុះ · ចាំកម្ពស់ពិត ➜ លើកក្រោយ ៖ កាតទៅទីតាំងពិតតែម្តង ===');
            for (const dev of ANDROID_DEVICES.filter((d) => d.h > d.w)) {
                const { ctx, page, ready } = await openApp(browser, port, dev, dev.apk ? [APK_BRIDGE, FAKE_VIEWPORT] : [FAKE_VIEWPORT], dev.apk ? null : { userAgent: ANDROID_UA });
                if (!ready) { bad('(ក២) ' + dev.label + ' ៖ audit bridge'); await ctx.close(); continue; }
                const ids = (await modalIdsWithFields(page)).filter((id) => ['manualAdjustModal', 'editPhoneModal', 'editBarcodePriceModal', 'exchangeRateModal', 'phoneModal'].includes(id));
                const problems = [];
                let measured = 0, wouldDrop = 0, learnedOnce = 0;
                for (const id of ids) {
                    const runs = [];
                    for (let round = 0; round < 2; round++) {
                        await page.setViewportSize({ width: dev.w, height: dev.h });
                        await page.evaluate(() => { window.__kb.set(0); window.__kb.fire(); });
                        await closeAll(page);
                        await page.evaluate((m) => openModalHelper(m), id);
                        await settle(page, 320);
                        const index = await firstVisibleField(page, id);
                        if (index < 0) break;
                        await page.evaluate(({ id, index, sel }) => { const f = Array.from(document.getElementById(id).querySelectorAll(sel))[index]; f.dispatchEvent(new Event('pointerdown', { bubbles: true })); f.focus({ preventScroll: true }); }, { id, index, sel: FIELD_SELECTOR });
                        await page.evaluate((kb) => window.__kb.open(kb), dev.kb + 80);
                        await settle(page, 160);
                        const hold = await page.evaluate(RECT, { id, index, sel: FIELD_SELECTOR });
                        await page.setViewportSize({ width: dev.w, height: dev.h - dev.kb });
                        if (dev.apk) {
                            await page.evaluate((kb) => window.__kb.open(kb), dev.kb);
                            await settle(page, 60);
                        }
                        await page.evaluate(() => window.__kb.open(0));
                        await settle(page, Math.max(200, KEYBOARD_SETTLE_FLOOR + 150));
                        const after = await page.evaluate(RECT, { id, index, sel: FIELD_SELECTOR });
                        const mem = await page.evaluate(() => localStorage.getItem('zoew_keyboard_inset_v1') || '');
                        runs.push({ hold, after, natural: Math.round((dev.h - dev.kb - (hold.card[1] - hold.card[0])) / 2), learned: mem.includes(':' + dev.kb) });
                    }
                    if (runs.length < 2) continue;
                    measured++;
                    const [first, second] = runs;
                    const line = dev.h - dev.kb;
                    if (first.natural > first.hold.card[0] + 2) wouldDrop++;
                    if (first.learned) learnedOnce++; else problems.push(id + ' ៖ មិនចាំ ' + JSON.stringify(await page.evaluate(() => localStorage.getItem('zoew_keyboard_inset_v1'))));
                    if (Math.abs(first.after.card[0] - first.hold.card[0]) > 1) problems.push(id + ' ៖ លើកដំបូងចុះ ' + first.hold.card[0] + ' ➜ ' + first.after.card[0]);
                    if (Math.abs(second.after.card[0] - second.hold.card[0]) > 1) problems.push(id + ' ៖ លើកក្រោយផ្លាស់ទីពីរដង ' + second.hold.card[0] + ' ➜ ' + second.after.card[0]);
                    if (second.after.fitted || Math.abs(second.hold.card[0] - second.natural) > 2) problems.push(id + ' ៖ លើកក្រោយមិនទៅទីតាំងពិតតែម្តង ' + second.hold.card[0] + ' ➜ ' + second.after.card[0] + ' (ពិត ' + second.natural + ' · .modal-kb ' + second.after.fitted + ')');
                    for (const r of runs) if (r.after.card[1] > line + 1 || r.after.card[0] < 0 || r.after.field[1] > line + 1) problems.push(id + ' ៖ មើលមិនឃើញ ' + JSON.stringify(r.after));
                }
                check(measured >= 4 && wouldDrop >= 1 && learnedOnce === measured && problems.length === 0,
                    '⛔ ' + dev.label + ' ៖ ' + measured + ' ផ្ទាំងលេខ ➜ keyboard ប្រាប់ ' + (dev.kb + 80) + ' ហើយ' + (dev.apk ? ' WebView' : ' ទំព័រ') + ' បង្រួមតាម keyboard ពិត ' + dev.kb + ' ➜ លើកដំបូងកាតមិនចុះ · ចាំ ' + dev.kb + ' ➜ លើកក្រោយកាតទៅទីតាំងពិតតែម្តង (ទោះ keyboard ប្រាប់ចាស់) · មើលឃើញពេញ',
                    JSON.stringify({ measured, wouldDrop, learnedOnce, problems: problems.slice(0, 6) }));
                await ctx.close();
            }
        }

        if (inPart('ខ')) {
            console.log('\n=== (ខ) iPhone · iPad (standalone) ៖ ប្រអប់វាយដែល focus ដោយកូដ (គ្មាន keyboard) ➜ ចុច ➜ preventDefault + focus({ preventScroll }) · keyboard បើក ➜ iOS ===');
            for (const dev of IOS_DEVICES) {
                const { ctx, page, ready } = await openApp(browser, port, dev, [IOS_FLAGS, FAKE_VIEWPORT, TAP_LOG]);
                if (!ready) { bad(dev.label + ' ៖ audit bridge'); await ctx.close(); continue; }
                const ids = await modalIdsWithFields(page);
                const problems = [];
                let measured = 0;
                for (const id of ids) {
                    await page.evaluate(() => { window.__kb.set(0); window.__kb.fire(); });
                    await closeAll(page);
                    await page.evaluate((m) => openModalHelper(m), id);
                    await settle(page, 320);
                    const index = await firstVisibleField(page, id);
                    if (index < 0) continue;
                    await page.evaluate(({ id, index, sel }) => { Array.from(document.getElementById(id).querySelectorAll(sel))[index].focus({ preventScroll: true }); window.__touchEnds = []; window.__focusLog = []; }, { id, index, sel: FIELD_SELECTOR });
                    const at = await page.evaluate(RECT, { id, index, sel: FIELD_SELECTOR });
                    const hit = await page.evaluate(({ x, y, id }) => { const el = document.elementFromPoint(x, y); return !!el && !!el.closest('#' + id) && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA'); }, { x: at.field[2], y: at.field[3], id });
                    if (!hit) continue;
                    await page.touchscreen.tap(at.field[2], at.field[3]);
                    await settle(page, 120);
                    const first = await page.evaluate(({ id, index, sel }) => ({ prevented: window.__touchEnds.slice(), focus: window.__focusLog.slice(), focused: document.activeElement === Array.from(document.getElementById(id).querySelectorAll(sel))[index], scrollY: window.scrollY }), { id, index, sel: FIELD_SELECTOR });
                    await page.evaluate((kb) => window.__kb.open(kb), dev.kb);
                    await settle(page, 160);
                    const again = await page.evaluate(RECT, { id, index, sel: FIELD_SELECTOR });
                    await page.touchscreen.tap(again.field[2], Math.max(again.field[0] + 4, Math.min(again.field[3], again.field[1] - 4)));
                    await settle(page, 120);
                    const second = await page.evaluate(() => ({ prevented: window.__touchEnds.slice(), focus: window.__focusLog.length }));
                    measured++;
                    const issues = [];
                    if (first.prevented[0] !== true) issues.push('ចុចលើកទី ១ មិនត្រូវចាប់');
                    if (first.focus.length !== 1 || !first.focus[0].preventScroll) issues.push('focus ' + JSON.stringify(first.focus));
                    if (!first.focused) issues.push('បាត់ focus');
                    if (first.scrollY !== 0) issues.push('document រំកិល ' + first.scrollY);
                    if (second.prevented[1] !== false || second.focus !== 1) issues.push('keyboard បើក ➜ មិនមែន ' + os + ' ' + JSON.stringify(second));
                    if (issues.length) problems.push(id + ' ៖ ' + issues.join(' · '));
                }
                check(measured >= 12 && problems.length === 0,
                    '⛔ ' + dev.label + ' ៖ ' + measured + ' ប្រអប់ ➜ ប្រអប់វាយ focus ដោយកូដ (keyboard បិទ) ➜ ចុច ➜ ចាប់ (preventScroll · នៅ focus · document ០) · keyboard បើក ➜ iOS ធ្វើខ្លួនឯង',
                    JSON.stringify({ measured, problems: problems.slice(0, 6) }));

                await closeAll(page);
                await page.evaluate(() => { window.__kb.set(0); window.__kb.fire(); });
                const batchReady = await page.evaluate(() => typeof openBatchScanModal === 'function');
                if (!batchReady) { bad(dev.label + ' ៖ openBatchScanModal'); await ctx.close(); continue; }
                await page.evaluate(() => { uiState.entryScanMode = 'parcel'; openBatchScanModal(); });
                await settle(page, 450);
                const bat = await page.evaluate(() => {
                    const el = document.getElementById('batchBarcodeInput');
                    const r = el.getBoundingClientRect();
                    window.__touchEnds = [];
                    window.__focusLog = [];
                    return { focused: document.activeElement === el, x: Math.round(r.left + r.width / 2), y: Math.round(r.top + Math.min(20, r.height / 2)) };
                });
                await page.touchscreen.tap(bat.x, bat.y);
                await settle(page, 160);
                const res = await page.evaluate(() => ({ prevented: window.__touchEnds.slice(), focus: window.__focusLog.slice(), focused: document.activeElement && document.activeElement.id, scrollY: window.scrollY }));
                check(bat.focused && res.prevented[0] === true && res.focus.length === 1 && res.focus[0].preventScroll && res.focused === 'batchBarcodeInput' && res.scrollY === 0,
                    '⛔ ' + dev.label + ' ៖ «📋 បញ្ចូលច្រើន» ពិត (focus ក្រោយ ១៥០ms · គ្មាន keyboard) ➜ ចុច ➜ ចាប់ · focus({ preventScroll }) ម្តង · ទំព័រមិនរំកិល',
                    JSON.stringify({ bat, res }));
                await ctx.close();
            }
        }

        if (inPart('គ')) {
            console.log('\n=== (គ) iPhone · iPad (standalone) · Chrome Android ៖ ចុចប្រអប់វាយ Barcode (hwScannerInput · ទំព័រស្កេន) ➜ ទំព័រមិនធ្លាក់/មិនរំកិល (preventDefault + focus({ preventScroll })) · keyboard នឹងបាំងប្រអប់ ➜ ប្រព័ន្ធធ្វើខ្លួនឯង ===');
            for (const dev of SCANNER_DEVICES) {
                const os = dev.android ? 'Android' : 'iOS';
                const inits = dev.android ? [FAKE_VIEWPORT, TAP_LOG] : [IOS_FLAGS, FAKE_VIEWPORT, TAP_LOG];
                if (dev.safeTop) inits.push('(' + SAFE_TOP.toString() + ')(' + dev.safeTop + ');');
                const { ctx, page, ready } = await openApp(browser, port, dev, inits, { userAgent: dev.ua });
                const pageReady = ready && await page.evaluate(() => typeof switchAppPage === 'function' && typeof setEntryScanMode === 'function');
                if (!pageReady) { bad(dev.label + ' ៖ audit bridge'); await ctx.close(); continue; }
                await closeAll(page);
                if (dev.learn) {
                    await page.evaluate(() => { switchAppPage('entry'); setEntryScanMode('parcel'); document.getElementById('hwScannerInput').focus({ preventScroll: true }); });
                    for (const px of dev.learn) { await page.evaluate((v) => window.__kb.open(v), px); await settle(page, 60); }
                    await page.evaluate(() => { document.activeElement && document.activeElement.blur(); window.__kb.open(0); });
                    await settle(page, 120);
                }
                await page.evaluate((m) => { switchAppPage('entry'); setEntryScanMode(m); openModalIds().slice().forEach((id) => closeModal(id)); }, dev.mode || 'parcel');
                await settle(page, 400);
                const at = await page.evaluate(() => {
                    const el = document.getElementById('hwScannerInput');
                    const r = el.getBoundingClientRect();
                    const x = Math.round(r.left + Math.min(40, r.width / 2));
                    const y = Math.round(r.top + r.height / 2);
                    const hit = document.elementFromPoint(x, y) === el;
                    window.__touchEnds = [];
                    window.__focusLog = [];
                    return { x, y, bottom: Math.round(r.bottom), hit, focused: document.activeElement === el, h: window.innerHeight };
                });
                if (!at.hit) { bad(dev.label + ' ៖ ប្រអប់វាយ Barcode មិននៅលើអេក្រង់', JSON.stringify(at)); await ctx.close(); continue; }
                await page.touchscreen.tap(at.x, at.y);
                await settle(page, 160);
                const first = await page.evaluate(() => ({ prevented: window.__touchEnds.slice(), focus: window.__focusLog.slice(), focused: document.activeElement && document.activeElement.id, scrollY: window.scrollY }));
                const issues = [];
                if (at.focused !== dev.byCode) issues.push('focus មុនចុច ' + at.focused);
                if (dev.catch) {
                    if (first.prevented[0] !== true) issues.push('ចុចមិនត្រូវចាប់ (' + os + ' រំកិលទំព័រ)');
                    if (first.focus.length !== 1 || !first.focus[0].preventScroll || first.focus[0].id !== 'hwScannerInput') issues.push('focus ' + JSON.stringify(first.focus));
                    if (first.focused !== 'hwScannerInput') issues.push('បាត់ focus');
                    if (first.scrollY !== 0) issues.push('document រំកិល ' + first.scrollY);
                    await page.evaluate((kb) => window.__kb.open(kb), dev.kb);
                    await settle(page, 160);
                    await page.touchscreen.tap(at.x, at.y);
                    await settle(page, 120);
                    const second = await page.evaluate(() => ({ prevented: window.__touchEnds.slice(), focus: window.__focusLog.length }));
                    if (second.prevented[1] !== false || second.focus !== 1) issues.push('keyboard បើក ➜ មិនមែន iOS ' + JSON.stringify(second));
                    if (at.bottom + 8 > at.h - dev.kb) issues.push('keyboard ពិត (' + dev.kb + ') បាំងប្រអប់ ' + at.bottom);
                } else {
                    if (first.prevented[0] !== false) issues.push('keyboard នឹងបាំងប្រអប់ ➜ ត្រូវទុកឲ្យ ' + os + ' តែត្រូវចាប់');
                    if (first.focus.some((f) => f.preventScroll)) issues.push('focus ' + JSON.stringify(first.focus));
                    if (at.bottom + 8 <= at.h - dev.kb) issues.push('ប្រអប់នៅពីលើ keyboard ពិត (' + dev.kb + ') ➜ ករណីនេះមិនមែនទិសផ្ទុយ');
                }
                check(issues.length === 0,
                    (dev.catch ? '⛔ ' : 'ទិសផ្ទុយ ៖ ') + dev.label + ' ៖ ចុចប្រអប់វាយ Barcode (' + (dev.byCode ? 'focus ដោយកូដ · គ្មាន keyboard' : 'មិនទាន់ focus') + ') ➜ ' +
                        (dev.catch ? 'ចាប់ · focus({ preventScroll }) · document ០ · keyboard បើក ➜ ' + os : 'keyboard នឹងបាំងប្រអប់ ➜ ' + os + ' ធ្វើខ្លួនឯង'),
                    JSON.stringify({ at, first, issues }));
                if (dev.catch && !dev.byCode) {
                    const near = [];
                    for (const sel of ['#hardwareScannerLabel', '#hardwareScannerBox .scanner-input-wrapper .icon']) {
                        await page.evaluate(() => { window.__kb.open(0); if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur(); });
                        await settle(page, 120);
                        const spot = await page.evaluate((sel) => {
                            const el = document.querySelector(sel);
                            if (!el) return null;
                            const r = el.getBoundingClientRect();
                            const x = Math.round(r.left + Math.min(20, r.width / 2));
                            const y = Math.round(r.top + r.height / 2);
                            const hit = document.elementFromPoint(x, y);
                            window.__touchEnds = [];
                            window.__focusLog = [];
                            return { x, y, hit: !!hit && el.contains(hit) };
                        }, sel);
                        if (!spot || !spot.hit) { near.push({ sel, spot, miss: true }); continue; }
                        await page.touchscreen.tap(spot.x, spot.y);
                        await settle(page, 160);
                        near.push(Object.assign({ sel }, await page.evaluate(() => ({ prevented: window.__touchEnds.slice(), focus: window.__focusLog.slice(),
                            focused: document.activeElement && document.activeElement.id, scrollY: window.scrollY }))));
                    }
                    const nearOk = near.length === 2 && near.every((n) => !n.miss && (dev.android
                        ? n.prevented[0] === false && !n.focus.some((f) => f.preventScroll)
                        : n.prevented[0] === true && n.focus.length === 1 && n.focus[0].preventScroll && n.focus[0].id === 'hwScannerInput' && n.focused === 'hwScannerInput' && n.scrollY === 0));
                    check(nearOk, (dev.android ? 'ទិសផ្ទុយ ៖ ' : '⛔ ') + dev.label + ' ៖ ចុចស្លាក «ស្កេន Barcode…» · រូប ⚡ ➜ ' +
                        (dev.android ? 'Android ដូចដើម (មិនប៉ះ)' : 'ចាប់ដូចចុចប្រអប់ (label មិនឲ្យ iOS focus រំកិលទំព័រ) · focus({ preventScroll }) · document ០'), JSON.stringify(near));
                }
                await ctx.close();
            }
        }

        if (inPart('ឃ')) {
            console.log('\n=== (ឃ) Chrome Android ៖ visual viewport រំកិលរួច (keyboard បើកពីប្រអប់មុន) ➜ ចុចស្វែងរក tab ស្កេន ➜ ទំព័រត្រឡប់កំពូល · ប្រអប់ស្វែងរកនៅក្នុងផ្ទៃមើលឃើញ (visual viewport ពិត ៖ pinch) ===');
            for (const mode of ['parcel', 'locker']) {
                const field = mode === 'locker' ? 'lockerListSearchInput' : 'entryListSearchInput';
                const { ctx, page, ready } = await openApp(browser, port, { w: 411, h: 830 }, [ZOOMABLE, TAP_LOG], { userAgent: ANDROID_UA, deviceScaleFactor: 2.625 });
                const pageReady = ready && await page.evaluate(() => typeof switchAppPage === 'function' && typeof setEntryScanMode === 'function');
                if (!pageReady) { bad('(ឃ) ' + mode + ' ៖ audit bridge'); await ctx.close(); continue; }
                await page.evaluate((m) => { openModalIds().slice().forEach((id) => closeModal(id)); switchAppPage('entry'); setEntryScanMode(m); }, mode);
                await settle(page, 400);
                await page.evaluate(() => { if (openModalIds().length && typeof chooseLocker === 'function') chooseLocker('A5'); openModalIds().slice().forEach((id) => closeModal(id)); });
                await settle(page, 400);
                const cdp = await ctx.newCDPSession(page);
                await cdp.send('Input.synthesizePinchGesture', { x: 205, y: 800, scaleFactor: 1.12, relativeSpeed: 600 });
                await settle(page, 500);
                const before = await page.evaluate((id) => {
                    const r = document.getElementById(id).getBoundingClientRect();
                    window.__touchEnds = [];
                    window.__focusLog = [];
                    return { off: Math.round(visualViewport.offsetTop), offL: visualViewport.offsetLeft, scale: visualViewport.scale, top: Math.round(r.top), bottom: Math.round(r.bottom), left: r.left, width: r.width };
                }, field);
                if (!(before.off > 0)) { bad('(ឃ) ' + mode + ' ៖ visual viewport មិនរំកិល (pinch)', JSON.stringify(before)); await ctx.close(); continue; }
                await page.touchscreen.tap(Math.round(before.left + Math.min(40, before.width / 2) - before.offL), Math.round((before.top + before.bottom) / 2 - before.off));
                await settle(page, 900);
                const after = await page.evaluate((id) => {
                    const el = document.getElementById(id);
                    const r = el.getBoundingClientRect();
                    return { off: Math.round(visualViewport.offsetTop), height: Math.round(visualViewport.height), focused: document.activeElement === el, collapsed: uiState.entryPanelCollapsed,
                        top: Math.round(r.top), bottom: Math.round(r.bottom), prevented: window.__touchEnds.slice(), focus: window.__focusLog.slice() };
                }, field);
                check(after.prevented[0] === true && after.focused && after.collapsed && after.off === 0 && after.top >= after.off && after.bottom <= after.off + after.height &&
                    after.focus.length === 1 && after.focus[0].preventScroll,
                    '⛔ Chrome Android 411×830 · ' + field + ' ៖ visual viewport រំកិល ' + before.off + 'px ➜ ចុចស្វែងរក ➜ offsetTop ០ (navbar ឃើញ) · ផ្ទាំងបង្រួម · ប្រអប់ស្វែងរកនៅក្នុងផ្ទៃមើលឃើញ · focus({ preventScroll }) ម្តង',
                    JSON.stringify({ before, after }));
                await ctx.close();
            }
        }

        if (inPart('ង')) {
            console.log('\n=== (ង) ឧបករណ៍ស្កេន Bluetooth/USB (keyboard HID ៖ ព្រឹត្តិការណ៍ keyboard ពិតរបស់ Chromium) ➜ ស្កេនមិនបាត់ · keyboard ខ្មែរ ➜ លេខឡាតាំង · suffix Tab ===');
            for (const dev of HID_DEVICES) {
                const { ctx, page, ready } = await openApp(browser, port, dev, dev.ios ? [IOS_FLAGS] : [], dev.ctx);
                const pageReady = ready && await page.evaluate(() => typeof switchAppPage === 'function' && typeof setEntryScanMode === 'function' && typeof scanState === 'object');
                if (!pageReady) { bad('(ង) ' + dev.label + ' ៖ audit bridge'); await ctx.close(); continue; }
                const reset = async () => {
                    await page.evaluate(() => {
                        openModalIds().slice().forEach((id) => closeModal(id));
                        switchAppPage('entry');
                        setEntryScanMode('parcel');
                        scanState.pendingBarcode = '';
                        document.getElementById('hwScannerInput').value = '';
                        if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
                    });
                    await settle(page, 250);
                };
                const result = () => page.evaluate(() => ({ pending: scanState.pendingBarcode, phoneModal: openModalIds().includes('phoneModal'), scrollY: window.scrollY,
                    active: document.activeElement && document.activeElement.id, field: document.getElementById('hwScannerInput').value }));
                const code = '77100000308751';
                await reset();
                const before = await page.evaluate(() => document.activeElement === document.body);
                await page.keyboard.type(code, { delay: 8 });
                await page.keyboard.press('Enter');
                await settle(page, 300);
                const plain = await result();
                check(before && plain.pending === code && plain.phoneModal && plain.scrollY === 0,
                    '⛔ ' + dev.label + ' ៖ គ្មានអ្វី focus ➜ ស្កេន ' + code + ' + Enter ➜ ផ្ទាំងបញ្ជាក់បើកជាមួយ Barcode នេះ · ទំព័រមិនរំកិល', JSON.stringify({ before, plain }));
                await reset();
                const cdp = await ctx.newCDPSession(page);
                for (const c of code) {
                    const khmer = String.fromCharCode(0x17E0 + Number(c));
                    await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: khmer, code: 'Digit' + c, text: khmer, unmodifiedText: khmer, windowsVirtualKeyCode: 48 + Number(c) });
                    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: khmer, code: 'Digit' + c, windowsVirtualKeyCode: 48 + Number(c) });
                }
                await page.keyboard.press('Enter');
                await settle(page, 300);
                const khmer = await result();
                check(khmer.pending === code && khmer.phoneModal,
                    '⛔ ' + dev.label + ' ៖ keyboard ខ្មែរ (key «៧៧១…» · code Digit*) ➜ Barcode ' + code + ' (មិនមែនលេខខ្មែរ)', JSON.stringify(khmer));
                await reset();
                await page.keyboard.type(code, { delay: 8 });
                await page.keyboard.press('Tab');
                await settle(page, 300);
                const tab = await result();
                check(tab.pending === code && tab.phoneModal,
                    '⛔ ' + dev.label + ' ៖ ឧបករណ៍ស្កេនបញ្ចប់ដោយ Tab ➜ បញ្ជូនដូច Enter', JSON.stringify(tab));
                await reset();
                await page.evaluate(() => document.getElementById('entryListSearchInput').focus({ preventScroll: true }));
                await page.keyboard.type('0961', { delay: 8 });
                await settle(page, 200);
                const search = await page.evaluate(() => ({ value: document.getElementById('entryListSearchInput').value, active: document.activeElement && document.activeElement.id, pending: scanState.pendingBarcode,
                    field: document.getElementById('hwScannerInput').value }));
                check(search.value === '0961' && search.active === 'entryListSearchInput' && !search.pending && search.field === '',
                    'ទិសផ្ទុយ ៖ ' + dev.label + ' ៖ វាយក្នុងប្រអប់ស្វែងរក ➜ នៅប្រអប់ស្វែងរក (ឧបករណ៍ស្កេនមិនលួច)', JSON.stringify(search));
                await reset();
                await page.evaluate(() => openBatchScanModal());
                await settle(page, 400);
                await page.evaluate(() => { if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur(); });
                for (const c of code + '\t' + '7710\t') {
                    if (c === '\t') { await page.keyboard.press('Tab'); continue; }
                    const khmer = String.fromCharCode(0x17E0 + Number(c));
                    await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: khmer, code: 'Digit' + c, text: khmer, unmodifiedText: khmer, windowsVirtualKeyCode: 48 + Number(c) });
                    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: khmer, code: 'Digit' + c, windowsVirtualKeyCode: 48 + Number(c) });
                }
                await settle(page, 200);
                const batch = await page.evaluate(() => ({ value: document.getElementById('batchBarcodeInput').value, active: document.activeElement && document.activeElement.id,
                    count: document.getElementById('batchScanCount').textContent, phoneModal: openModalIds().includes('phoneModal') }));
                check(batch.value === code + '\n7710\n' && batch.active === 'batchBarcodeInput' && batch.count === '2 Barcode' && !batch.phoneModal,
                    '⛔ ' + dev.label + ' ៖ «📋 បញ្ចូលច្រើន» (គ្មានអ្វី focus) ➜ ស្កេន ២ (keyboard ខ្មែរ · suffix Tab) ➜ ២ ជួរឡាតាំង · focus នៅប្រអប់ · ចំនួន «2 Barcode»', JSON.stringify(batch));
                // ⛔ ម៉ាស៊ីនតេស្តអាចផ្អាក > SCANNER_KEY_GAP_MS រវាងគ្រាប់ពីរ (CDP · GC) ➜ ការស្កេនក្លែងក្លាយជាការវាយរបស់មនុស្សតាមច្បាប់ App (មិនមែនកំហុស App) ➜ វាស់ចន្លោះពិត
                //    (event.timeStamp ក្នុងទំព័រ) ហើយធ្វើ scenario ម្តងទៀតតែពេលនោះ (≤ ៣ ដង) · App ខុសពេលល្បឿនស្កេនត្រឹមត្រូវ ➜ នៅធ្លាក់ដដែល
                await page.evaluate(() => { if (!window.__kdOn) { window.__kdOn = true; window.__kd = []; window.addEventListener('keydown', (e) => window.__kd.push(e.timeStamp), true); } });
                const markBurst = () => page.evaluate(() => { window.__kd = []; });
                const burstGap = () => page.evaluate(() => { const t = window.__kd; let m = 0; for (let i = 1; i < t.length; i++) m = Math.max(m, t[i] - t[i - 1]); return Math.round(m); });
                const first = 'ZTQUEUEA0001';
                const next = '77100000308752';
                let human = '', held = null, bare = null, capped = null, gaps = [];
                for (let attempt = 1; attempt <= 3; attempt++) {
                    await page.evaluate(() => { try { stopBatchScan(); } catch (e) {} });
                    await reset();
                    await page.evaluate((a) => triggerScanAction(a), first);
                    await settle(page, 450);
                    await page.evaluate(() => document.getElementById('modalCodInput').focus({ preventScroll: true }));
                    await page.keyboard.type('2.5', { delay: 110 });
                    await settle(page, 250);
                    human = await page.evaluate(() => document.getElementById('modalCodInput').value);
                    await markBurst();
                    await page.keyboard.type(next, { delay: 8 });
                    const nextGap = await burstGap();
                    await page.keyboard.press('Enter');
                    await settle(page, 300);
                    held = await page.evaluate(() => ({ cod: document.getElementById('modalCodInput').value, phone: document.getElementById('modalPhoneInput').value,
                        active: document.activeElement && document.activeElement.id, pending: scanState.pendingBarcode,
                        status: (document.getElementById('batchScanStatus') || {}).textContent || '' }));
                    await markBurst();
                    await page.keyboard.type('77100000308753', { delay: 8 });
                    const bareGap = await burstGap();
                    await settle(page, 450);
                    bare = await page.evaluate(() => ({ cod: document.getElementById('modalCodInput').value,
                        status: (document.getElementById('batchScanStatus') || {}).textContent || '' }));
                    capped = await page.evaluate(async () => {
                        document.getElementById('modalCodInput').value = '7810122334455';
                        await confirmPhone(false);
                        return { open: openModalIds().includes('phoneModal'), pending: scanState.pendingBarcode, active: document.activeElement && document.activeElement.id };
                    });
                    gaps = [nextGap, bareGap];
                    if (SCANNER_GAP_MS > 0 && nextGap < SCANNER_GAP_MS && bareGap < SCANNER_GAP_MS) break;
                }
                check(SCANNER_GAP_MS > 0 && gaps.length === 2 && gaps.every((g) => g < SCANNER_GAP_MS),
                    dev.label + ' ៖ ជាន់អប្បបរមា ៖ ការស្កេនក្លែងចេញក្នុងល្បឿនម៉ាស៊ីនស្កេន (ចន្លោះពិត < SCANNER_KEY_GAP_MS ' + SCANNER_GAP_MS + 'ms)', JSON.stringify(gaps));
                check(bare.cod === '2.5' && bare.status.indexOf('77100000308753') === -1 && capped.open && capped.pending === first && capped.active === 'modalCodInput',
                    '⛔ ' + dev.label + ' ៖ ម៉ាស៊ីនស្កេនគ្មាន Enter/Tab ➜ COD មិនប្រែ · មិនចូលជួរ · COD 7810122334455 (បិទភ្ជាប់) ➜ «យល់ព្រម» មិនរក្សាទុក · ផ្ទាំងនៅ · focus COD',
                    JSON.stringify({ bare, capped }));
                await page.evaluate(() => closeModal('phoneModal'));
                await settle(page, 400);
                const after = await result();
                check(human === '2.5' && held.cod === '2.5' && held.phone === '' && held.active === 'modalCodInput' && held.pending === first && held.status.indexOf(next) === -1 && held.status.indexOf('0/1') !== -1 &&
                    after.pending === next && after.phoneModal && after.field === '',
                    '⛔ ' + dev.label + ' ៖ ផ្ទាំងលេខទូរស័ព្ទបើក · វាយ COD «2.5» ល្បឿនមនុស្ស ➜ ចូលប្រអប់ · ស្កេន ' + next + ' + Enter ➜ COD · លេខទូរស័ព្ទមិនប្រែ · focus នៅ COD · ចូលជួរ ➜ បិទផ្ទាំង ➜ ' + next + ' បើកបន្ទាប់',
                    JSON.stringify({ human, held, after }));
                await ctx.close();
            }
        }

        if (inPart('ច')) {
            console.log('\n=== (ច) zoom (pinch) មិនមែន keyboard ៖ កុំព្យូទ័រ (visual viewport ពិត ៖ Emulation.setPageScaleFactor) ➜ ម៉ាស៊ីនស្កេនពេលផ្ទាំងបើកចូលជួរ ===');
            {
                const { ctx, page, ready } = await openApp(browser, port, { w: 1280, h: 800 }, [], { hasTouch: false, isMobile: false });
                const pageReady = ready && await page.evaluate(() => typeof switchAppPage === 'function' && typeof triggerScanAction === 'function' && typeof softKeyboardShown === 'function');
                if (pageReady) {
                    const cdp = await ctx.newCDPSession(page);
                    const next = '77100000308761';
                    let zoomed = null, out = null, gap = Infinity;
                    for (let attempt = 1; attempt <= 3; attempt++) {
                        await cdp.send('Emulation.setPageScaleFactor', { pageScaleFactor: 1 });
                        await page.evaluate(() => {
                            try { stopBatchScan(); } catch (e) {}
                            openModalIds().slice().forEach((id) => closeModal(id));
                            switchAppPage('entry');
                            setEntryScanMode('parcel');
                            scanState.pendingBarcode = '';
                        });
                        await settle(page, 250);
                        await page.evaluate((a) => triggerScanAction(a), 'ZTZOOMA0001');
                        await settle(page, 450);
                        await page.evaluate(() => document.getElementById('modalCodInput').focus({ preventScroll: true }));
                        await cdp.send('Emulation.setPageScaleFactor', { pageScaleFactor: 1.6 });
                        await settle(page, 350);
                        zoomed = await page.evaluate(() => ({ scale: Math.round(visualViewport.scale * 100) / 100, vvH: Math.round(visualViewport.height), innerH: innerHeight,
                            kb: softKeyboardShown(), cover: uiState.keyboardCover, fit: !!uiState.modalKeyboardFit, mem: localStorage.getItem('zoew_keyboard_inset_v1') }));
                        await page.evaluate(() => { window.__kd = []; window.addEventListener('keydown', (e) => window.__kd.push(e.timeStamp), true); });
                        await page.keyboard.type(next, { delay: 8 });
                        gap = await page.evaluate(() => { const t = window.__kd; let m = 0; for (let i = 1; i < t.length; i++) m = Math.max(m, t[i] - t[i - 1]); return Math.round(m); });
                        await page.keyboard.press('Enter');
                        await settle(page, 400);
                        out = await page.evaluate(() => ({ cod: document.getElementById('modalCodInput').value, pending: scanState.pendingBarcode,
                            status: (document.getElementById('batchScanStatus') || {}).textContent || '' }));
                        if (SCANNER_GAP_MS > 0 && gap < SCANNER_GAP_MS) break;
                    }
                    check(zoomed && zoomed.scale > 1.5 && zoomed.vvH < zoomed.innerH - KEYBOARD_MIN_INSET_FLOOR && !zoomed.kb && zoomed.cover === 0 && !zoomed.fit && !zoomed.mem,
                        '⛔ កុំព្យូទ័រ 1280×800 ៖ zoom ១.៦ (visual viewport ' + (zoomed && zoomed.vvH) + ' < innerHeight) ➜ មិនមែន keyboard (softKeyboardShown false · toast ០ · ប្រអប់មិនតម្រូវ · មិនចាំ)', JSON.stringify(zoomed));
                    check(SCANNER_GAP_MS > 0 && gap < SCANNER_GAP_MS && out && out.cod === '' && out.pending === 'ZTZOOMA0001' && out.status.indexOf(next) === -1 && out.status.indexOf('0/1') !== -1,
                        '⛔ កុំព្យូទ័រ zoom ១.៦ · ផ្ទាំងលេខទូរស័ព្ទបើក · focus COD ➜ ម៉ាស៊ីនស្កេន ' + next + ' + Enter ➜ ចូលជួរ «📥» · COD មិនប្រែ', JSON.stringify({ gap, out }));
                } else bad('(ច) zoom ៖ audit bridge');
                await ctx.close();
            }
        }

        if (inPart('ទិសផ្ទុយ')) {
            console.log('\n=== ទិសផ្ទុយ ៖ Android (មិនមែន iOS standalone) ➜ មិនប៉ះការចុចក្នុងប្រអប់ · iPhone ➜ ច្បាប់តម្រូវ iPhone (បាតត្រឹម keyboard មិនមែនកណ្តាល) ===');
            {
                const dev = { w: 412, h: 915, kb: 330 };
                const { ctx, page, ready } = await openApp(browser, port, dev, [FAKE_VIEWPORT, TAP_LOG], { userAgent: ANDROID_UA });
                if (ready) {
                    await page.evaluate(() => { uiState.entryScanMode = 'parcel'; openBatchScanModal(); });
                    await settle(page, 450);
                    const at = await page.evaluate(() => { const r = document.getElementById('batchBarcodeInput').getBoundingClientRect(); window.__touchEnds = []; window.__focusLog = []; return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + 20) }; });
                    await page.touchscreen.tap(at.x, at.y);
                    await settle(page, 160);
                    const res = await page.evaluate(() => ({ prevented: window.__touchEnds.slice(), focus: window.__focusLog.length }));
                    check(res.prevented[0] === false && res.focus === 0, 'ទិសផ្ទុយ ៖ PWA Chrome Android ➜ ចុចប្រអប់វាយ ➜ មិនប៉ះ (preventDefault គ្មាន)', JSON.stringify(res));
                } else bad('ទិសផ្ទុយ Android ៖ audit bridge');
                await ctx.close();
            }
            {
                const dev = { w: 393, h: 852, kb: 400 };
                const { ctx, page, ready } = await openApp(browser, port, dev, [IOS_FLAGS, FAKE_VIEWPORT]);
                if (ready) {
                    await page.evaluate(() => openModalHelper('pinModal'));
                    await settle(page, 320);
                    const index = await firstVisibleField(page, 'pinModal');
                    await page.evaluate(({ index, sel }) => Array.from(document.getElementById('pinModal').querySelectorAll(sel))[index].focus({ preventScroll: true }), { index, sel: FIELD_SELECTOR });
                    await page.evaluate((kb) => window.__kb.open(kb), dev.kb);
                    await settle(page, 200);
                    const r = await page.evaluate(RECT, { id: 'pinModal', index, sel: FIELD_SELECTOR });
                    const line = dev.h - dev.kb - 8;
                    check(index >= 0 && r.fitted && Math.abs(r.card[1] - line) <= 1,
                        'ទិសផ្ទុយ ៖ iPhone (keyboard ៤០០) ➜ ប្រអប់ PIN ឡើងតែល្មមឲ្យបាតត្រឹម keyboard − ៨ (ច្បាប់ iPhone · មិនមែនកណ្តាល Android)', JSON.stringify({ r, line }));
                } else bad('ទិសផ្ទុយ iPhone ៖ audit bridge');
                await ctx.close();
            }
        }
        {
            const flat = [].concat(...PART_GROUPS);
            const once = flat.length === new Set(flat).size;
            const same = flat.length === sectionsAsked.size && flat.every((n) => sectionsAsked.has(n));
            check(once && same, '⛔ ក្រុម --part គ្របផ្នែកទាំងអស់នៃ checker ម្តងគត់ (' + PART_GROUPS.map((g) => g.length).join(' + ') + ' = ' + sectionsAsked.size + ')',
                JSON.stringify({ groups: PART_GROUPS, asked: Array.from(sectionsAsked) }));
        }
    } catch (e) {
        bad('កំហុសមិនរំពឹង ៖ ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e));
    } finally {
        await browser.close();
        server.close();
        console.log('\n' + (fail ? '❌ ធ្លាក់ ' + fail + ' (ជោគជ័យ ' + pass + ')' : '✅ ជោគជ័យ ' + pass));
        if (!fail && pass > 0) process.exitCode = 0;
    }
})();
