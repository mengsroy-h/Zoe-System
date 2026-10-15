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
//       ប្រអប់នៅពីលើបន្ទាត់ keyboard (ធ្លាប់វាស់ ឬ PAGE_TAP_KEYBOARD_RATIO) ➜ preventDefault + focus({ preventScroll }) · keyboard នឹងបាំងប្រអប់ (ផ្តេក) ➜ iOS ·
//       iPhone SE · iPhone · Pro Max · ផ្តេក · iPad បញ្ឈរ/ផ្តេក (UA កុំព្យូទ័រ ➜ focus ដោយកូដ)
//   ទិសផ្ទុយ ៖ មិនមែន iOS standalone (Android) ➜ មិនប៉ះការចុច · iPhone (មិនមែន Android) ➜ ច្បាប់តម្រូវ iPhone ដដែល (មិនមែនកណ្តាល)
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
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm', '.svg': 'image/svg+xml' };
const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36';

let pass = 0, fail = 0;
const ok = (n) => { console.log('  ok    ' + n); pass++; };
const bad = (n, d) => { console.log('  FAIL  ' + n + (d ? '\n        ' + d : '')); fail++; };
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

// ប្រអប់វាយ Barcode (ទំព័រស្កេន · ក្រៅប្រអប់) ៖ catch = ប្រអប់នៅពីលើបន្ទាត់ keyboard ប៉ាន់ (PAGE_TAP_KEYBOARD_RATIO) ➜ ចាប់ · បើមិនដូច្នោះ ➜ iOS (keyboard បាំង ➜ iOS ត្រូវបង្ហាញ)
const SCANNER_DEVICES = [
    { label: 'iPhone SE 375×667', w: 375, h: 667, kb: 260, ua: IPHONE_UA, catch: true, byCode: false },
    { label: 'iPhone 393×852', w: 393, h: 852, kb: 336, ua: IPHONE_UA, catch: true, byCode: false },
    { label: 'iPhone Pro Max 430×932', w: 430, h: 932, kb: 346, ua: IPHONE_UA, catch: true, byCode: false },
    { label: 'iPhone ផ្តេក 852×393', w: 852, h: 393, kb: 209, ua: IPHONE_UA, catch: false, byCode: false },
    { label: 'iPad បញ្ឈរ 820×1180 (UA កុំព្យូទ័រ ➜ focus ដោយកូដ)', w: 820, h: 1180, kb: 375, ua: IPAD_UA, catch: true, byCode: true },
    { label: 'iPad ផ្តេក 1180×820 (UA កុំព្យូទ័រ)', w: 1180, h: 820, kb: 398, ua: IPAD_UA, catch: false, byCode: true },
    { label: 'iPhone 393×852 · status bar 59 · របៀបកញ្ចប់', w: 393, h: 852, kb: 365, ua: IPHONE_UA, catch: true, byCode: false, safeTop: 59, mode: 'parcel' },
    { label: 'iPhone 393×852 · status bar 59 · របៀបដក (វីដេអូ ៖ keyboard ខ្មែរ 365)', w: 393, h: 852, kb: 365, ua: IPHONE_UA, catch: true, byCode: false, safeTop: 59, mode: 'remove' },
    { label: 'iPhone Pro Max 430×932 · status bar 59 · របៀបដក', w: 430, h: 932, kb: 375, ua: IPHONE_UA, catch: true, byCode: false, safeTop: 59, mode: 'remove' },
    { label: 'iPhone SE 375×667 · status bar 20 · របៀបដក', w: 375, h: 667, kb: 305, ua: IPHONE_UA, catch: false, byCode: false, safeTop: 20, mode: 'remove' }
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
                if (second.prevented[1] !== false || second.focus !== 1) issues.push('keyboard បើក ➜ មិនមែន iOS ' + JSON.stringify(second));
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

        console.log('\n=== (គ) iPhone · iPad (standalone) ៖ ចុចប្រអប់វាយ Barcode (hwScannerInput · ទំព័រស្កេន) ➜ ទំព័រមិនធ្លាក់ (preventDefault + focus({ preventScroll })) · keyboard នឹងបាំងប្រអប់ ➜ iOS ===');
        for (const dev of SCANNER_DEVICES) {
            const inits = [IOS_FLAGS, FAKE_VIEWPORT, TAP_LOG];
            if (dev.safeTop) inits.push('(' + SAFE_TOP.toString() + ')(' + dev.safeTop + ');');
            const { ctx, page, ready } = await openApp(browser, port, dev, inits, { userAgent: dev.ua });
            const pageReady = ready && await page.evaluate(() => typeof switchAppPage === 'function' && typeof setEntryScanMode === 'function');
            if (!pageReady) { bad(dev.label + ' ៖ audit bridge'); await ctx.close(); continue; }
            await closeAll(page);
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
                if (first.prevented[0] !== true) issues.push('ចុចមិនត្រូវចាប់ (iOS រំកិលទំព័រ)');
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
                if (first.prevented[0] !== false) issues.push('keyboard នឹងបាំងប្រអប់ ➜ ត្រូវទុកឲ្យ iOS តែត្រូវចាប់');
                if (first.focus.some((f) => f.preventScroll)) issues.push('focus ' + JSON.stringify(first.focus));
                if (at.bottom + 8 <= at.h - dev.kb) issues.push('ប្រអប់នៅពីលើ keyboard ពិត (' + dev.kb + ') ➜ ករណីនេះមិនមែនទិសផ្ទុយ');
            }
            check(issues.length === 0,
                (dev.catch ? '⛔ ' : 'ទិសផ្ទុយ ៖ ') + dev.label + ' ៖ ចុចប្រអប់វាយ Barcode (' + (dev.byCode ? 'focus ដោយកូដ · គ្មាន keyboard' : 'មិនទាន់ focus') + ') ➜ ' +
                    (dev.catch ? 'ចាប់ · focus({ preventScroll }) · document ០ · keyboard បើក ➜ iOS' : 'keyboard នឹងបាំងប្រអប់ ➜ iOS ធ្វើខ្លួនឯង'),
                JSON.stringify({ at, first, issues }));
            await ctx.close();
        }

        console.log('\n=== ទិសផ្ទុយ ៖ Android (មិនមែន iOS standalone) ➜ មិនប៉ះការចុច · iPhone ➜ ច្បាប់តម្រូវ iPhone (បាតត្រឹម keyboard មិនមែនកណ្តាល) ===');
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
    } catch (e) {
        bad('កំហុសមិនរំពឹង ៖ ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e));
    } finally {
        await browser.close();
        server.close();
        console.log('\n' + (fail ? '❌ ធ្លាក់ ' + fail + ' (ជោគជ័យ ' + pass + ')' : '✅ ជោគជ័យ ' + pass));
        if (!fail && pass > 0) process.exitCode = 0;
    }
})();
