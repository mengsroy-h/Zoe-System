// ថ្នាក់កំហុសដែលឧបករណ៍នេះចាក់សោ ៖ ប្រអប់ (modal) ដែលមានប្រអប់វាយអក្សរ/លេខ ត្រូវ keyboard បាំង ។
//   iPhone (និង browser ដែលមិនបង្រួមទំព័រពេល keyboard បើក) មិនប្តូរកម្ពស់ layout viewport ទេ ➜ `.modal` (fixed · កម្ពស់ ១០០%)
//   នៅកណ្តាលអេក្រង់ពេញ ➜ ពាក់កណ្តាលក្រោមរបស់ប្រអប់ និងប្រអប់វាយដែលកំពុងប្រើ នៅក្រោយ keyboard ។
// ⛔ ច្បាប់ (ម្ចាស់គម្រោង ៖ «កុំអោយរំកិលឡើងទាំងមូល ព្រោះ modal ខ្លះវែងអាចផុត» · «ផ្ទៃថ្លាពីលើ keyboard ពណ៌ពីរខុសគ្នា» · រូបថត iPhone ៖
//    ប៊ូតុង PIN ត្រូវកាត់ · ចំណងជើង «បញ្ចូលច្រើន» ត្រូវកាត់ ខណៈផ្ទៃពីលើកាតទំនេរ) ៖ keyboard បាំង ≥ KEYBOARD_MIN_INSET_PX ➜
//    ឆ្វេង · ស្តាំដដែល · ប្រអប់ដែលនៅពីលើ keyboard រួចហើយ ➜ មិនប្តូរអ្វីទាំងអស់ · ប្រអប់ខ្លីល្មមផ្ទៃពីលើ keyboard ➜ ឡើងតែល្មមឲ្យបាតត្រឹម
//    keyboard (គម្លាត MODAL_KEYBOARD_GAP_PX) ➜ ឃើញទាំងមូល មិនកាត់ · ប្រអប់វែងជាងផ្ទៃនោះ ➜ កំពូលនៅកំពូលផ្ទៃមើលឃើញ (padding · ក្រោម
//    status bar `--modal-safe-top` + គម្លាត) ⛔ មិនដែលផុតអេក្រង់ · បាតត្រឹម keyboard · រមូរក្នុងខ្លួន ➜ ប្រអប់វាយដែល focus មើលឃើញ ·
//    ផ្ទៃងងឹត (backdrop) គ្របពេញ layout viewport ហើយពីបន្ទាត់ keyboard
//    ចុះក្រោម (ទាំងការរំកិល) ជាស្រទាប់ស្រអាប់ ➜ នៅក្រោយ keyboard ថ្លារបស់ iPhone មានពណ៌តែមួយ (វាស់ pixel ពីរូបថតពិត) · keyboard បិទ ➜ ដូចដើម · APK (WebView បង្រួមខ្លួនឯង) ➜ មិនប្តូរប្លង់ ហើយប្រអប់វាយមើលឃើញ ។
// វិធី ៖ App ពិត (audit build) · visualViewport ក្លែង (Chromium មិនមាន keyboard) · បញ្ជីប្រអប់ និងប្រអប់វាយ **ដេរីវេពី DOM ពិត**
//    (គ្រប់ `.modal` ដែលមាន input អក្សរ/លេខ ឬ textarea ដែលមើលឃើញពេលបើក) · ទំហំ ៧ (ទូរស័ព្ទ ៤ · ទូរស័ព្ទផ្តេក · tablet បញ្ឈរ/ផ្តេក) · ផ្ទៃមើលឃើញរំកិល (offsetTop) · status bar ក្លែង ·
//    focus ដោយកូដ (`focusField()` · `openBatchScanModal()`) ➜ preventScroll · document រំកិល (artifact keyboard iOS) ខណៈប្រអប់បើក ➜ ០ ·
//    ទិសផ្ទុយ (keyboard បិទ · APK បង្រួម viewport · ជាន់អប្បបរមា) · ចំនួនថេរអានពី app.js ពិត ។
let chromium;
try { chromium = require('playwright-core').chromium; } catch (e) {
    console.log('SKIP — ត្រូវការ playwright-core (npm i playwright-core)');
    process.exit(0);
}
process.exitCode = 1;
const CHROME = process.env.MODALKB_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const fs = require('fs');
const http = require('http');
const path = require('path');
if (!fs.existsSync(CHROME)) { console.log('SKIP — រកមិនឃើញ Chromium'); process.exit(0); }

const ROOT = process.env.MODALKB_APP_DIR || path.join(__dirname, '..');
const APP = path.join(ROOT, 'ZoeW');
const APP_JS = (() => { try { return fs.readFileSync(path.join(APP, 'app.js'), 'utf8'); } catch (e) { return ''; } })();
function appConst(name, fallback) {
    const m = APP_JS.match(new RegExp('\\b' + name + '\\s*=\\s*(\\d+)\\b'));
    return m ? Number(m[1]) : fallback;
}
const GAP = appConst('MODAL_KEYBOARD_GAP_PX', 8);
const PAD = 12;
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm', '.svg': 'image/svg+xml' };

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

// visualViewport ក្លែង ៖ កម្ពស់ = innerHeight (keyboard បិទ) · `__kb.open(px, top)` ➜ កម្ពស់ = innerHeight - px · offsetTop = top ➜ resize + scroll
const FAKE_VIEWPORT = function () {
    const fake = new EventTarget();
    let inset = 0;
    let top = 0;
    Object.defineProperty(fake, 'height', { get: () => window.innerHeight - inset });
    Object.defineProperty(fake, 'width', { get: () => window.innerWidth });
    Object.defineProperty(fake, 'offsetTop', { get: () => top });
    Object.defineProperty(fake, 'offsetLeft', { get: () => 0 });
    Object.defineProperty(fake, 'pageTop', { get: () => top + (window.scrollY || 0) });
    Object.defineProperty(fake, 'pageLeft', { get: () => 0 });
    Object.defineProperty(fake, 'scale', { get: () => 1 });
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: fake });
    window.__kb = {
        set(px) { inset = px; top = 0; },
        fire() { fake.dispatchEvent(new Event('resize')); fake.dispatchEvent(new Event('scroll')); },
        open(px, at) { inset = px; top = at || 0; fake.dispatchEvent(new Event('resize')); fake.dispatchEvent(new Event('scroll')); },
        close() { inset = 0; top = 0; fake.dispatchEvent(new Event('resize')); fake.dispatchEvent(new Event('scroll')); },
        state() { return { inset, top, height: window.innerHeight - inset }; }
    };
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

// អ្នកស្រាយ PNG តូច (8-bit · non-interlaced · ទម្រង់ដែល Chromium ថត) ➜ វាស់ pixel ដែលភ្នែកឃើញ
function decodePng(buf) {
    const zlib = require('zlib');
    let p = 8, w = 0, h = 0, ct = 0, bd = 0; const idat = [];
    while (p < buf.length) {
        const len = buf.readUInt32BE(p), type = buf.toString('ascii', p + 4, p + 8), data = buf.slice(p + 8, p + 8 + len);
        if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); bd = data[8]; ct = data[9]; }
        else if (type === 'IDAT') idat.push(data);
        p += 12 + len;
    }
    const bpp = ct === 6 ? 4 : ct === 2 ? 3 : 0;
    if (bd !== 8 || !bpp) throw new Error('PNG មិនគាំទ្រ ៖ bitDepth ' + bd + ' colorType ' + ct);
    const raw = zlib.inflateSync(Buffer.concat(idat)), stride = w * bpp, px = Buffer.alloc(h * stride);
    for (let y = 0; y < h; y++) {
        const f = raw[y * (stride + 1)], src = y * (stride + 1) + 1;
        for (let x = 0; x < stride; x++) {
            const a = x >= bpp ? px[y * stride + x - bpp] : 0, b = y ? px[(y - 1) * stride + x] : 0;
            const c = (x >= bpp && y) ? px[(y - 1) * stride + x - bpp] : 0;
            let v = raw[src + x];
            if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
            else if (f === 4) { const q = a + b - c, pa = Math.abs(q - a), pb = Math.abs(q - b), pc = Math.abs(q - c); v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c); }
            px[y * stride + x] = v & 255;
        }
    }
    return { w, h, bpp, px };
}

const settle = (page, ms) => page.evaluate((t) => new Promise((r) => setTimeout(r, t)), ms || 260);

async function openApp(browser, port, size, fakeViewport) {
    const ctx = await browser.newContext({ viewport: { width: size.w, height: size.h }, hasTouch: true, isMobile: true, serviceWorkers: 'block' });
    const page = await ctx.newPage();
    page.on('dialog', (d) => d.dismiss().catch(() => {}));
    await page.route('**', (r) => r.request().url().startsWith('http://127.0.0.1:' + port) ? r.continue() : r.abort());
    if (fakeViewport) await page.addInitScript(FAKE_VIEWPORT);
    await page.goto('http://127.0.0.1:' + port + '/', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(900);
    const ready = await page.evaluate(() => typeof openModalHelper === 'function' && typeof closeModal === 'function' && typeof openModalIds === 'function');
    return { ctx, page, ready };
}

// ប្រអប់ និងប្រអប់វាយ ដេរីវេពី DOM ៖ input អក្សរ/លេខ (មិនមែន checkbox · radio · file · button · hidden) និង textarea
const FIELD_SELECTOR = 'textarea, input:not([type]), input[type="text"], input[type="number"], input[type="tel"], input[type="password"], ' +
    'input[type="email"], input[type="search"], input[type="url"], input[type="date"]';

async function closeAll(page) {
    await page.evaluate(() => { openModalIds().slice().forEach((id) => closeModal(id)); });
    await settle(page, 120);
}

async function modalIdsWithFields(page) {
    return page.evaluate((sel) => Array.from(document.querySelectorAll('.modal'))
        .filter((m) => m.id && m.querySelector(sel)).map((m) => m.id), FIELD_SELECTOR);
}

async function visibleFields(page, id) {
    return page.evaluate(({ id, sel }) => {
        const modal = document.getElementById(id);
        return Array.from(modal.querySelectorAll(sel)).map((f, i) => ({ f, i }))
            .filter(({ f }) => { const r = f.getBoundingClientRect(); const cs = getComputedStyle(f); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && !f.disabled && !f.readOnly; })
            .map(({ f, i }) => ({ index: i, name: f.id || f.name || f.getAttribute('placeholder') || f.tagName.toLowerCase() + '#' + i }));
    }, { id, sel: FIELD_SELECTOR });
}

// វាស់ ៖ ផ្ទៃមើលឃើញ [top, top + height] (ក្នុង layout viewport ដូច getBoundingClientRect) · កាតប្រអប់ (ទីតាំងលើអេក្រង់ = rect − offsetTop) ·
//   ប្រអប់វាយ · ការកាត់ដោយអ្នករមូរ · backdrop ៖ rect របស់ `.modal` + `::after` · ធាតុនៅក្រោយ keyboard (elementFromPoint ក្នុងផ្ទៃ keyboard)
const MEASURE = function ({ id, index, sel, gap }) {
    const modal = document.getElementById(id);
    const field = Array.from(modal.querySelectorAll(sel))[index];
    const vv = window.visualViewport;
    const visTop = vv.offsetTop;
    const visBottom = vv.offsetTop + vv.height;
    const content = modal.querySelector('.modal-content') || modal.firstElementChild;
    const cr = content.getBoundingClientRect();
    const fr = field.getBoundingClientRect();
    const mr = modal.getBoundingClientRect();
    let clippedBy = null;
    for (let n = field.parentElement; n && n !== modal; n = n.parentElement) {
        const cs = getComputedStyle(n);
        if (!/(auto|scroll|hidden)/.test(cs.overflowY)) continue;
        const nr = n.getBoundingClientRect();
        if (fr.top < nr.top - 1 || fr.bottom > nr.bottom + 1) { clippedBy = (n.id || n.className || n.tagName) + ' [' + Math.round(nr.top) + ',' + Math.round(nr.bottom) + ']'; break; }
    }
    const fieldTall = fr.height > vv.height * 0.5;
    const after = getComputedStyle(modal, '::after');
    const afterOn = after.content !== 'none' && after.display !== 'none';
    const afterHeight = afterOn ? (parseFloat(after.height) || 0) : 0;
    const afterTop = afterOn ? mr.top + (parseFloat(after.top) || 0) : mr.bottom;
    const probeY = Math.min(window.innerHeight - 3, Math.max(visBottom + 3, window.innerHeight - 20));
    const behind = visBottom < window.innerHeight - 4 ? document.elementFromPoint(Math.round(window.innerWidth / 2), Math.round(probeY)) : modal;
    const safe = parseFloat(getComputedStyle(modal).getPropertyValue('--modal-safe-top')) || 0;
    return {
        id, index, focused: document.activeElement === field, bodyClass: document.body.classList.contains('modal-keyboard'), safe,
        cut: content.scrollHeight > content.clientHeight + 1,
        visTop: Math.round(visTop), visBottom: Math.round(visBottom), inner: window.innerHeight,
        screen: [Math.round(cr.top - visTop), Math.round(cr.bottom - visTop), Math.round(cr.left), Math.round(cr.right)],
        content: [Math.round(cr.top), Math.round(cr.bottom)], field: [Math.round(fr.top), Math.round(fr.bottom)],
        backdrop: [Math.round(mr.top), Math.round(mr.bottom), Math.round(afterTop), Math.round(afterTop + afterHeight)],
        backdropFull: mr.top <= 1 && Math.max(mr.bottom, afterTop + afterHeight) >= window.innerHeight + visTop - 1 && afterTop <= mr.bottom + 1,
        behindCovered: !!behind && modal.contains(behind),
        bottomAbove: cr.bottom <= visBottom - gap + 1,
        fieldInside: fr.top >= visTop - 1 && (fieldTall ? fr.top + 40 <= visBottom : fr.bottom <= visBottom - gap + 1) && !clippedBy,
        clippedBy, fieldTall
    };
};

// ទីតាំងដើម (keyboard បិទ) ៖ [កំពូល · បាត · ឆ្វេង · ស្តាំ] លើអេក្រង់
const BASE = function ({ id }) {
    const content = document.getElementById(id).querySelector('.modal-content') || document.getElementById(id).firstElementChild;
    const r = content.getBoundingClientRect();
    return [Math.round(r.top), Math.round(r.bottom), Math.round(r.left), Math.round(r.right)];
};

// ច្បាប់ទីតាំង ៖ base = ទីតាំងដើម (keyboard បិទ) · m = ការវាស់ពេល keyboard បើក ➜ កំហុស (ទទេ = ត្រូវ) · កូអរដោនេលើអេក្រង់ (rect − offsetTop)
//   ceil = កំពូលអប្បបរមា = max(padding, status bar + គម្លាត) · line = បន្ទាត់ keyboard − គម្លាត
function placementProblems(base, m) {
    const problems = [];
    const pan = m.visTop;
    const line = m.visBottom - pan - GAP;
    const ceil = Math.max(PAD, m.safe + GAP);
    const height = base[1] - base[0];
    if (Math.abs(m.screen[2] - base[2]) > 1 || Math.abs(m.screen[3] - base[3]) > 1) problems.push('ឆ្វេង/ស្តាំប្តូរ');
    if (m.screen[0] < ceil - 1) problems.push('កំពូលក្រោម status bar/ផុតអេក្រង់ ' + m.screen[0] + ' < ' + ceil);
    if (base[1] <= line + 1) {
        if (Math.abs(m.screen[0] - base[0]) > 1) problems.push('ប្រអប់នៅពីលើ keyboard រួច តែកំពូលប្តូរ ' + base[0] + ' ➜ ' + m.screen[0]);
        if (pan === 0 && Math.abs(m.screen[1] - base[1]) > 1) problems.push('ប្រអប់នៅពីលើ keyboard រួច តែបាតប្តូរ');
    } else if (height <= line - ceil + 1) {
        if (m.cut) problems.push('ប្រអប់ខ្លីត្រូវកាត់ (ល្មមផ្ទៃ ' + (line - ceil) + ' ≥ ' + height + ')');
        if (Math.abs(m.screen[0] - (line - height)) > 1) problems.push('ប្រអប់ខ្លី ៖ កំពូល ' + m.screen[0] + ' ≠ ' + (line - height) + ' (ឡើងតែល្មម)');
    } else {
        if (Math.abs(m.screen[0] - ceil) > 1) problems.push('ប្រអប់វែង ៖ កំពូល ' + m.screen[0] + ' ≠ កំពូលផ្ទៃមើលឃើញ ' + ceil);
        if (m.screen[1] < line - 1) problems.push('ប្រអប់វែង ៖ បាត ' + m.screen[1] + ' មិនប្រើផ្ទៃដល់ keyboard ' + line);
    }
    if (!m.bottomAbove) problems.push('បាតនៅក្រោយ keyboard');
    if (!m.backdropFull) problems.push('backdrop មិនពេញ');
    if (!m.behindCovered) problems.push('ក្រោយ keyboard មិនមែន backdrop');
    if (!m.fieldInside) problems.push('ប្រអប់វាយមិនមើលឃើញ');
    if (!m.focused || !m.bodyClass) problems.push('focus/class');
    return problems;
}

const SIZES = [
    { w: 390, h: 844, kb: 336, label: 'iPhone 390×844 · keyboard 336' },
    { w: 375, h: 667, kb: 260, label: 'iPhone SE 375×667 · keyboard 260' },
    { w: 320, h: 568, kb: 253, label: 'ទូរស័ព្ទតូច 320×568 · keyboard 253' },
    { w: 393, h: 852, kb: 400, label: 'iPhone 393×852 · keyboard 400 (រូបថតម្ចាស់គម្រោង)', safe: 47 },
    { w: 844, h: 390, kb: 200, label: 'iPhone ផ្តេក 844×390 · keyboard 200' },
    { w: 820, h: 1180, kb: 375, label: 'iPad បញ្ឈរ 820×1180 · keyboard 375', safe: 24 },
    { w: 1180, h: 820, kb: 440, label: 'iPad ផ្តេក 1180×820 · keyboard 440', safe: 24 }
];

(async () => {
    const server = await serve(APP);
    const port = server.address().port;
    const browser = await chromium.launch({ executablePath: CHROME });
    try {
        const exists = fs.existsSync(path.join(APP, 'index.html'));
        check(exists, 'App ZoeW (audit build) រកឃើញ ៖ ' + APP);
        if (!exists) return;

        console.log('\n=== ប្រអប់ ⟷ keyboard (iPhone · Android Chrome/PWA ៖ keyboard បាំង · layout viewport មិនបង្រួម · ផ្ទៃមើលឃើញ = visualViewport) ===');
        let measured = 0;
        let overlapsWithout = 0;
        const modalSeen = new Set();
        const longTop = [];
        let shortFitted = 0;
        let longFitted = 0;
        for (const size of SIZES) {
            const { ctx, page, ready } = await openApp(browser, port, size, true);
            check(ready, size.label + ' ៖ audit bridge (openModalHelper · closeModal · openModalIds)');
            if (!ready) { await ctx.close(); continue; }
            // status bar ក្លែង (Chromium ៖ env(safe-area-inset-top) = 0) ➜ អថេរដដែលដែល App អាន
            if (size.safe) await page.addStyleTag({ content: '.modal { --modal-safe-top: ' + size.safe + 'px !important; }' });
            await closeAll(page);
            const ids = await modalIdsWithFields(page);
            if (size === SIZES[0]) {
                check(ids.length >= 15, 'ជាន់អប្បបរមា ៖ ប្រអប់ដែលមានប្រអប់វាយ ≥ ១៥ (ដេរីវេពី DOM)', 'ឃើញ ' + ids.length + ' ៖ ' + ids.join(' '));
            }
            const failures = [];
            let perSize = 0;
            for (const id of ids) {
                await closeAll(page);
                await page.evaluate((m) => openModalHelper(m), id);
                await settle(page, 380);
                const fields = await visibleFields(page, id);
                for (const f of fields) {
                    await page.evaluate(({ id, index, sel }) => {
                        const field = Array.from(document.getElementById(id).querySelectorAll(sel))[index];
                        field.focus({ preventScroll: true });
                    }, { id, index: f.index, sel: FIELD_SELECTOR });
                    const base = await page.evaluate(BASE, { id });
                    const before = await page.evaluate(({ id, index, sel, kb }) => {
                        const modal = document.getElementById(id);
                        const field = Array.from(modal.querySelectorAll(sel))[index];
                        const content = modal.querySelector('.modal-content') || modal.firstElementChild;
                        const visBottom = window.innerHeight - kb;
                        return field.getBoundingClientRect().bottom > visBottom || content.getBoundingClientRect().bottom > visBottom;
                    }, { id, index: f.index, sel: FIELD_SELECTOR, kb: size.kb });
                    if (before) overlapsWithout++;
                    await page.evaluate((kb) => window.__kb.open(kb, 0), size.kb);
                    await settle(page);
                    const m = await page.evaluate(MEASURE, { id, index: f.index, sel: FIELD_SELECTOR, gap: GAP });
                    measured++;
                    perSize++;
                    modalSeen.add(id);
                    const problems = placementProblems(base, m);
                    if (problems.length) failures.push(Object.assign({ name: f.name, problems, base }, m));
                    const room = m.visBottom - m.visTop - GAP - Math.max(PAD, m.safe + GAP);
                    if (base[1] > m.visBottom - m.visTop - GAP + 1) {
                        if (base[1] - base[0] <= room + 1) shortFitted++;
                        else longFitted++;
                    }
                    if (id === 'lookupApiConfigModal') longTop.push(problems.length === 0 && Math.abs(m.screen[0] - Math.max(PAD, m.safe + GAP)) <= 1 && m.safe === (size.safe || 0));
                    await page.evaluate(() => window.__kb.close());
                    await settle(page, 120);
                }
                await page.evaluate((m) => closeModal(m), id);
            }
            check(perSize > 0 && failures.length === 0,
                '⛔ ' + size.label + ' ៖ គ្រប់ប្រអប់វាយ (' + perSize + ') ➜ ឆ្វេង · ស្តាំដដែល · ប្រអប់ខ្លីឃើញទាំងមូល (មិនកាត់) · ប្រអប់វែងនៅកំពូលផ្ទៃមើលឃើញ (មិនផុត) · បាតត្រឹម keyboard · ប្រអប់វាយមើលឃើញ · ក្រោយ keyboard ជា backdrop',
                JSON.stringify(failures.slice(0, 6)) + (failures.length > 6 ? ' … +' + (failures.length - 6) : ''));
            await ctx.close();
        }
        check(longTop.length >= SIZES.length && longTop.every(Boolean), '⛔ ប្រអប់វែង «API ស្វែងរកអតិថិជន» (lookupApiConfigModal) ៖ កំពូលនៅកំពូលផ្ទៃមើលឃើញ (ក្រោម status bar ក្លែង) មិនផុតអេក្រង់ គ្រប់ទំហំ · គ្រប់ប្រអប់វាយ',
            JSON.stringify(longTop));
        check(shortFitted >= 10 && longFitted >= 10, 'គំរូអាចធ្លាក់ ៖ ផ្លូវទាំង ២ ត្រូវរត់ (ប្រអប់ខ្លីដែល keyboard បាំង ≥ ១០ · ប្រអប់វែង ≥ ១០)', JSON.stringify({ shortFitted, longFitted }));
        check(modalSeen.size >= 12, 'ជាន់អប្បបរមា ៖ ប្រអប់ដែលបានវាស់ជាមួយប្រអប់វាយមើលឃើញ ≥ ១២', 'ឃើញ ' + modalSeen.size + ' ៖ ' + Array.from(modalSeen).join(' '));
        check(measured >= 60, 'ជាន់អប្បបរមា ៖ ការវាស់ (ប្រអប់វាយ × ទំហំ) ≥ ៦០', 'វាស់ ' + measured);
        check(overlapsWithout >= 10, 'គំរូអាចធ្លាក់ ៖ ករណីដែល keyboard បាំងកាត ឬប្រអប់វាយ (មុនការតម្រូវ) ≥ ១០ (សេណារីយ៉ូពិត)', 'ឃើញ ' + overlapsWithout);

        console.log('\n=== ផ្ទៃមើលឃើញរំកិល (iOS រំកិល visual viewport) · ប្តូរប្រអប់វាយ · keyboard បិទ · បើកប្រអប់ខណៈ keyboard បើក ===');
        {
            const size = SIZES[0];
            const { ctx, page, ready } = await openApp(browser, port, size, true);
            if (ready) {
                await closeAll(page);
                await page.evaluate(() => openModalHelper('manualAdjustModal'));
                await settle(page, 450);
                const fields = await visibleFields(page, 'manualAdjustModal');
                const last = fields[fields.length - 1];
                await page.evaluate(({ index, sel }) => Array.from(document.getElementById('manualAdjustModal').querySelectorAll(sel))[index].focus({ preventScroll: true }), { index: last.index, sel: FIELD_SELECTOR });
                const base = await page.evaluate(BASE, { id: 'manualAdjustModal' });
                await page.evaluate((kb) => window.__kb.open(kb, 140), size.kb);
                await settle(page);
                const panned = await page.evaluate(MEASURE, { id: 'manualAdjustModal', index: last.index, sel: FIELD_SELECTOR, gap: GAP });
                const pannedProblems = placementProblems(base, panned);
                check(fields.length >= 2 && panned.visTop === 140 && pannedProblems.length === 0 && panned.backdrop[3] >= panned.inner + 139,
                    '⛔ ផ្ទៃមើលឃើញរំកិល ១៤០px ➜ ប្រអប់នៅទីតាំងដដែលលើអេក្រង់ · បាតត្រឹម keyboard · backdrop លាតចុះក្រោម ១៤០px (ពណ៌តែមួយក្រោយ keyboard)',
                    JSON.stringify({ base, panned, pannedProblems }));
                const first = fields[0];
                await page.evaluate(({ index, sel }) => Array.from(document.getElementById('manualAdjustModal').querySelectorAll(sel))[index].focus({ preventScroll: true }), { index: first.index, sel: FIELD_SELECTOR });
                await settle(page);
                const switched = await page.evaluate(MEASURE, { id: 'manualAdjustModal', index: first.index, sel: FIELD_SELECTOR, gap: GAP });
                const switchedProblems = placementProblems(base, switched);
                check(switchedProblems.length === 0, 'ប្តូរទៅប្រអប់វាយផ្សេង (keyboard នៅបើក) ➜ ប្រអប់វាយថ្មីមើលឃើញ · ប្រអប់មិនផ្លាស់ទី', JSON.stringify({ switched, switchedProblems }));
                await page.evaluate(() => window.__kb.close());
                await settle(page);
                const closed = await page.evaluate((b) => {
                    const modal = document.getElementById('manualAdjustModal');
                    const r = modal.querySelector('.modal-content').getBoundingClientRect();
                    const after = getComputedStyle(modal, '::after');
                    return { bodyClass: document.body.classList.contains('modal-keyboard'), fitted: document.querySelectorAll('.modal.modal-kb').length,
                        content: [Math.round(r.top), Math.round(r.bottom), Math.round(r.left), Math.round(r.right)], after: after.content === 'none' ? 0 : (parseFloat(after.height) || 0), b };
                }, base);
                check(!closed.bodyClass && closed.fitted === 0 && closed.after === 0 && closed.content.every((v, k) => Math.abs(v - base[k]) <= 1),
                    'ទិសផ្ទុយ ៖ keyboard បិទ ➜ ដក body.modal-keyboard · គ្មាន .modal-kb · backdrop ដូចដើម · ប្រអប់ត្រឡប់ទីតាំងដើម', JSON.stringify(closed));
                await page.evaluate(() => window.__kb.open(336, 0));
                await settle(page);
                await page.evaluate(() => closeModal('manualAdjustModal'));
                await settle(page);
                const afterClose = await page.evaluate(() => ({ bodyClass: document.body.classList.contains('modal-keyboard'), fitted: document.querySelectorAll('.modal.modal-kb').length }));
                check(!afterClose.bodyClass && afterClose.fitted === 0, 'ទិសផ្ទុយ ៖ បិទប្រអប់ (keyboard នៅបើក) ➜ ដក body.modal-keyboard · គ្មាន .modal-kb', JSON.stringify(afterClose));
                await page.evaluate(() => openModalHelper('editPhoneModal'));
                await settle(page, 380);
                const opened = await page.evaluate(MEASURE, { id: 'editPhoneModal', index: 0, sel: FIELD_SELECTOR, gap: GAP });
                await page.evaluate(() => window.__kb.close());
                await settle(page);
                const openedBase = await page.evaluate(BASE, { id: 'editPhoneModal' });
                const openedProblems = placementProblems(openedBase, Object.assign({}, opened, { focused: true })).filter((p) => p !== 'ប្រអប់វាយមិនមើលឃើញ');
                check(opened.bodyClass && openedProblems.length === 0, 'បើកប្រអប់ខណៈ keyboard បើករួច (ឧ. ពីការស្វែងរក) ➜ ប្រអប់នៅទីតាំងធម្មតា · បាតត្រឹម keyboard · backdrop ពេញ',
                    JSON.stringify({ openedBase, opened, openedProblems }));
                await page.evaluate(() => window.__kb.open(80, 0));
                await settle(page);
                const small = await page.evaluate(() => ({ bodyClass: document.body.classList.contains('modal-keyboard'), fitted: document.querySelectorAll('.modal.modal-kb').length }));
                check(!small.bodyClass && small.fitted === 0, 'ទិសផ្ទុយ ៖ គម្លាតតូចជាង KEYBOARD_MIN_INSET_PX (របា browser) ➜ មិនប្តូរ', JSON.stringify(small));
            }
            await ctx.close();
        }

        console.log('\n=== APK (WebView បង្រួម viewport ខ្លួនឯង) · គ្មាន visualViewport ក្លែង ===');
        {
            const size = { w: 390, h: 844 };
            const { ctx, page, ready } = await openApp(browser, port, size, false);
            if (ready) {
                await closeAll(page);
                await page.evaluate(() => openModalHelper('lookupApiConfigModal'));
                await settle(page, 450);
                const fields = await visibleFields(page, 'lookupApiConfigModal');
                const last = fields[fields.length - 1];
                await page.evaluate(({ index, sel }) => Array.from(document.getElementById('lookupApiConfigModal').querySelectorAll(sel))[index].focus({ preventScroll: true }), { index: last.index, sel: FIELD_SELECTOR });
                await page.setViewportSize({ width: 390, height: 844 - 336 });
                await settle(page, 450);
                const apk = await page.evaluate(MEASURE, { id: 'lookupApiConfigModal', index: last.index, sel: FIELD_SELECTOR, gap: 0 });
                const fitted = await page.evaluate(() => document.querySelectorAll('.modal.modal-kb').length);
                check(fields.length >= 3 && !apk.bodyClass && fitted === 0 && apk.fieldInside && apk.backdropFull,
                    'APK ៖ viewport បង្រួម (innerHeight = visualViewport) ➜ មិនប្តូរប្លង់ · ប្រអប់វាយខាងក្រោមនៃប្រអប់វែងរមូរមកមើលឃើញ', JSON.stringify({ fields: fields.length, fitted, apk }));
            }
            await ctx.close();
        }

        console.log('\n=== Android (APK KeyboardOpenHold · PWA Chrome) ៖ keyboard ចាប់ផ្តើមលោត ➜ visualViewport បង្រួម (viewport នៅកម្ពស់ដើម) ➜ ចប់ ➜ viewport បង្រួម ===');
        // វីដេអូ APK របស់ម្ចាស់គម្រោង ៖ «កន្ត្រាក់ ២ ដង ពេល keyboard លោតឡើង គ្រប់ modal» ៖ ប្រអប់ឡើង ១១៨dp ពេល keyboard ចាប់ផ្តើម (ការតម្រូវតាមបាត)
        //   ហើយ ៣០dp ទៀតពេល WebView បង្រួម (ចូលកណ្តាលវិញ) ➜ ច្បាប់ ៖ ទីតាំងពេល keyboard កំពុងលោត = ទីតាំងក្រោយ WebView បង្រួម (ផ្លាស់ទីតែម្តង) ·
        //   បាតកាតនៅពីលើ keyboard · ប្រអប់វាយមើលឃើញ · គ្រប់ប្រអប់ដែលមានប្រអប់វាយ (ដេរីវេពី DOM) × APK ២ ទំហំ · PWA Chrome Android (UA) ១ ទំហំ
        //   (HISTORY A75 ៖ Chrome PWA ក៏បង្រួមក្រោយ keyboard)
        const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36';
        for (const size of [{ w: 412, h: 915, kb: 330, apk: true }, { w: 360, h: 740, kb: 300, apk: true }, { w: 412, h: 915, kb: 330, apk: false }]) {
            const ctx = await browser.newContext(Object.assign({ viewport: { width: size.w, height: size.h }, hasTouch: true, isMobile: true, serviceWorkers: 'block' },
                size.apk ? {} : { userAgent: ANDROID_UA }));
            const page = await ctx.newPage();
            page.on('dialog', (d) => d.dismiss().catch(() => {}));
            await page.route('**', (r) => r.request().url().startsWith('http://127.0.0.1:' + port) ? r.continue() : r.abort());
            if (size.apk) await page.addInitScript(APK_BRIDGE);
            await page.addInitScript(FAKE_VIEWPORT);
            await page.goto('http://127.0.0.1:' + port + '/', { waitUntil: 'domcontentloaded', timeout: 20000 });
            await page.waitForTimeout(900);
            const ready = await page.evaluate((apk) => typeof openModalHelper === 'function' &&
                (apk ? !!(window.Capacitor && window.Capacitor.isNativePlatform()) : !window.Capacitor && /Android/.test(navigator.userAgent)), size.apk);
            if (!ready) { bad('Android hold ៖ audit bridge · ' + (size.apk ? 'APK' : 'PWA UA')); await ctx.close(); continue; }
            const ids = await modalIdsWithFields(page);
            const problems = [];
            let measured = 0, movedAtStart = 0;
            for (const id of ids) {
                await page.setViewportSize({ width: size.w, height: size.h });
                await page.evaluate(() => { window.__kb.set(0); window.__kb.fire(); });
                await closeAll(page);
                await page.evaluate((m) => openModalHelper(m), id);
                await settle(page, 450);
                const fields = await visibleFields(page, id);
                if (!fields.length) continue;
                const rect = (index) => page.evaluate(({ id, index, sel }) => {
                    const modal = document.getElementById(id);
                    const field = Array.from(modal.querySelectorAll(sel))[index];
                    const content = modal.querySelector('.modal-content') || modal.firstElementChild;
                    const c = content.getBoundingClientRect();
                    const f = field.getBoundingClientRect();
                    return { card: [Math.round(c.top), Math.round(c.bottom)], field: [Math.round(f.top), Math.round(f.bottom)], focused: document.activeElement === field };
                }, { id, index, sel: FIELD_SELECTOR });
                await page.evaluate(({ id, index, sel }) => Array.from(document.getElementById(id).querySelectorAll(sel))[index].focus({ preventScroll: true }), { id, index: fields[0].index, sel: FIELD_SELECTOR });
                const base = await rect(fields[0].index);
                await page.evaluate((kb) => { window.__kb.set(kb); window.__kb.fire(); }, size.kb);
                await settle(page, 200);
                const hold = await rect(fields[0].index);
                await page.evaluate(() => window.__kb.set(0));
                await page.setViewportSize({ width: size.w, height: size.h - size.kb });
                await page.evaluate(() => window.__kb.fire());
                await settle(page, 250);
                const after = await rect(fields[0].index);
                measured++;
                if (Math.abs(hold.card[0] - base.card[0]) > 1) movedAtStart++;
                const line = size.h - size.kb;
                const issues = [];
                if (Math.abs(hold.card[0] - after.card[0]) > 1 || Math.abs(hold.card[1] - after.card[1]) > 1) issues.push('ផ្លាស់ទីពីរដង ' + base.card[0] + ' ➜ ' + hold.card[0] + ' ➜ ' + after.card[0]);
                if (hold.card[1] > line + 1) issues.push('បាតកាត ' + hold.card[1] + ' នៅក្រោយ keyboard ' + line);
                if (hold.field[0] < 0 || hold.field[1] > line + 1) issues.push('ប្រអប់វាយមិនមើលឃើញ [' + hold.field + ']');
                if (!hold.focused) issues.push('focus');
                if (issues.length) problems.push(id + ' ' + size.w + '×' + size.h + ' ៖ ' + issues.join(' · '));
            }
            check(measured >= 15 && movedAtStart >= 12 && problems.length === 0,
                '⛔ ' + (size.apk ? 'APK ' : 'PWA Chrome Android ') + size.w + '×' + size.h + ' · keyboard ' + size.kb + ' ៖ ' + measured + ' ប្រអប់ ➜ ផ្លាស់ទីតែម្តងពេល keyboard ចាប់ផ្តើម (ទីតាំងពេលលោត = ក្រោយ WebView បង្រួម ±1px) · បាតនៅពីលើ keyboard · ប្រអប់វាយមើលឃើញ',
                JSON.stringify({ measured, movedAtStart, problems: problems.slice(0, 6) }));
            await ctx.close();
        }

        console.log('\n=== iPhone (standalone) ៖ ចុចប្រអប់វាយក្នុងប្រអប់ ➜ focus ដោយគ្មានការរំកិលទំព័រ · ទិសផ្ទុយ ===');
        for (const ios of [true, false]) {
            const size = SIZES[0];
            const ctx = await browser.newContext({ viewport: { width: size.w, height: size.h }, hasTouch: true, isMobile: true, serviceWorkers: 'block' });
            const page = await ctx.newPage();
            await page.route('**', (r) => r.request().url().startsWith('http://127.0.0.1:' + port) ? r.continue() : r.abort());
            if (ios) await page.addInitScript(IOS_FLAGS);
            await page.addInitScript(FAKE_VIEWPORT);
            await page.addInitScript(() => {
                window.__touchEnds = [];
                window.addEventListener('touchend', (e) => { window.__touchEnds.push(e.defaultPrevented); }, false);
            });
            await page.goto('http://127.0.0.1:' + port + '/', { waitUntil: 'domcontentloaded', timeout: 20000 });
            await page.waitForTimeout(900);
            const ready = await page.evaluate(() => typeof openModalHelper === 'function');
            if (!ready) { bad('iOS tap ៖ audit bridge'); await ctx.close(); continue; }
            await page.evaluate(() => openModalHelper('lookupApiConfigModal'));
            await settle(page, 450);
            const target = await page.evaluate((sel) => {
                const modal = document.getElementById('lookupApiConfigModal');
                const f = Array.from(modal.querySelectorAll(sel)).find((x) => { const r = x.getBoundingClientRect(); return x.tagName === 'INPUT' && x.type !== 'number' && r.width > 0 && r.height > 0 && !x.disabled && !x.readOnly; });
                if (!f) return null;
                f.value = 'https://example.invalid/abc';
                const r = f.getBoundingClientRect();
                return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), standalone: document.documentElement.classList.contains('ios-standalone') };
            }, FIELD_SELECTOR);
            if (!target) { bad('iOS tap ៖ រកប្រអប់វាយក្នុង lookupApiConfigModal មិនឃើញ'); await ctx.close(); continue; }
            await page.touchscreen.tap(target.x, target.y);
            await settle(page, 200);
            const first = await page.evaluate(() => {
                const el = document.activeElement;
                return { focused: !!el && el.tagName === 'INPUT' && !!el.closest('#lookupApiConfigModal'), prevented: window.__touchEnds.slice(), scrollY: window.scrollY,
                    caretAtEnd: !!el && el.selectionStart === el.value.length && el.selectionEnd === el.value.length };
            });
            await page.touchscreen.tap(target.x, target.y);
            await settle(page, 200);
            const second = await page.evaluate(() => window.__touchEnds.slice());
            if (ios) {
                check(target.standalone && first.focused && first.prevented[0] === true && first.scrollY === 0 && first.caretAtEnd,
                    '⛔ iPhone standalone ៖ ចុចប្រអប់វាយ (មិនទាន់ focus) ក្នុងប្រអប់ ➜ touchend preventDefault · focus({ preventScroll }) · caret នៅចុង · ទំព័រមិនរំកិល',
                    JSON.stringify({ target, first }));
                check(second[1] === false, 'ទិសផ្ទុយ ៖ ចុចប្រអប់វាយដែល focus រួច ➜ iOS ធ្វើខ្លួនឯង (ដាក់ caret តាមកន្លែងចុច)', JSON.stringify(second));
            } else {
                check(!target.standalone && first.prevented[0] === false, 'ទិសផ្ទុយ ៖ មិនមែន iOS standalone (Android · web) ➜ មិនប៉ះការចុច', JSON.stringify({ target, first }));
            }
            await ctx.close();
        }

        console.log('\n=== iPhone (standalone) ៖ «បញ្ចូលច្រើន» focus ប្រអប់វាយដោយកូដ (គ្មាន keyboard) ➜ ចុច ➜ មិនទុកឲ្យ iOS (វីដេអូ ៖ ទំព័រធ្លាក់ ១៣០pt ហើយលោតត្រឡប់) ===');
        // iOS ៖ focus ដោយកូដក្រៅកាយវិការ (`openBatchScanModal()` ក្រោយ ១៥០ms សម្រាប់ម៉ាស៊ីនស្កេន) មិនបើក keyboard · ចុចប្រអប់វាយដែល focus រួចនោះ ➜ ផ្លូវ iOS ដើម ➜
        //   WebKit រំកិលទំព័រដើម្បីបង្ហាញប្រអប់វាយ ពេល keyboard លោត ➜ `restoreIOSDocumentScroll()` ទាញត្រឡប់ ០ កណ្តាលចលនា ➜ ទំព័រធ្លាក់ចុះ ហើយលោតត្រឡប់ ·
        //   ច្បាប់ ៖ ប្រអប់វាយដែល focus រួចតែ keyboard មិនទាន់បើក ➜ ចាប់ការចុចដូចប្រអប់មិនទាន់ focus (blur + focus({ preventScroll })) · keyboard បើករួច ➜ iOS ធ្វើខ្លួនឯង
        for (const ios of [true, false]) {
            const size = SIZES[3];
            const ctx = await browser.newContext({ viewport: { width: size.w, height: size.h }, hasTouch: true, isMobile: true, serviceWorkers: 'block' });
            const page = await ctx.newPage();
            page.on('dialog', (d) => d.dismiss().catch(() => {}));
            await page.route('**', (r) => r.request().url().startsWith('http://127.0.0.1:' + port) ? r.continue() : r.abort());
            if (ios) await page.addInitScript(IOS_FLAGS);
            await page.addInitScript(FAKE_VIEWPORT);
            await page.addInitScript(() => {
                window.__touchEnds = [];
                window.__focusLog = [];
                window.addEventListener('touchend', (e) => { window.__touchEnds.push(e.defaultPrevented); }, false);
                const real = HTMLElement.prototype.focus;
                HTMLElement.prototype.focus = function (options) {
                    window.__focusLog.push({ id: this.id || this.tagName, preventScroll: !!(options && options.preventScroll) });
                    return real.call(this, options);
                };
            });
            await page.goto('http://127.0.0.1:' + port + '/', { waitUntil: 'domcontentloaded', timeout: 20000 });
            await page.waitForTimeout(900);
            const ready = await page.evaluate(() => typeof openBatchScanModal === 'function' && typeof openModalHelper === 'function');
            if (!ready) { bad('iOS «បញ្ចូលច្រើន» ៖ audit bridge (openBatchScanModal)'); await ctx.close(); continue; }
            await page.evaluate(() => { uiState.entryScanMode = 'parcel'; openModalIds().slice().forEach((m) => closeModal(m)); openBatchScanModal(); });
            await settle(page, 450);
            const at = await page.evaluate(() => {
                const el = document.getElementById('batchBarcodeInput');
                const r = el.getBoundingClientRect();
                window.__focusLog = [];
                return { focused: document.activeElement === el, x: Math.round(r.left + r.width / 2), y: Math.round(r.top + Math.min(20, r.height / 2)) };
            });
            await page.touchscreen.tap(at.x, at.y);
            await settle(page, 200);
            const first = await page.evaluate(() => ({ prevented: window.__touchEnds.slice(), focus: window.__focusLog.slice(), focused: document.activeElement && document.activeElement.id, scrollY: window.scrollY }));
            if (ios) {
                check(at.focused && first.prevented[0] === true && first.focus.length === 1 && first.focus[0].id === 'batchBarcodeInput' && first.focus[0].preventScroll && first.focused === 'batchBarcodeInput' && first.scrollY === 0,
                    '⛔ iPhone standalone ៖ «បញ្ចូលច្រើន» (ប្រអប់វាយ focus ដោយកូដ · គ្មាន keyboard) ➜ ចុច ➜ touchend preventDefault · focus({ preventScroll }) ម្តង · នៅ focus · ទំព័រមិនរំកិល',
                    JSON.stringify({ at, first }));
                await page.evaluate((kb) => window.__kb.open(kb), size.kb);
                await settle(page, 200);
                const ta = await page.evaluate(() => { const r = document.getElementById('batchBarcodeInput').getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + Math.min(20, r.height / 2)) }; });
                await page.touchscreen.tap(ta.x, ta.y);
                await settle(page, 200);
                const second = await page.evaluate(() => ({ prevented: window.__touchEnds.slice(), focus: window.__focusLog.length }));
                check(second.prevented[1] === false && second.focus === 1,
                    'ទិសផ្ទុយ ៖ keyboard បើករួច ➜ ចុចប្រអប់វាយ ➜ iOS ធ្វើខ្លួនឯង (ដាក់ caret តាមកន្លែងចុច)', JSON.stringify(second));
            } else {
                check(first.prevented[0] === false && first.focus.length === 0, 'ទិសផ្ទុយ ៖ មិនមែន iOS standalone ➜ មិនប៉ះការចុច', JSON.stringify({ at, first }));
            }
            await ctx.close();
        }

        console.log('\n=== ⛔ ប្រអប់ + keyboard ➜ ទំព័រខាងក្រោយមិនរំកិល (រាយការណ៍ ៖ «បញ្ចូលច្រើន» ពេលខ្លះទំព័ររអិលឡើង navbar បាត់) ===');
        // iOS រំកិល document ដើម្បីបង្ហាញប្រអប់វាយដែល focus ដោយ **កូដ** (គ្មាន preventScroll) ពេល keyboard បើក ➜ navbar ចេញពីអេក្រង់ ➜
        //   (ក) រាល់ focus ដោយកូដចូលប្រអប់វាយក្នុង .modal ត្រូវ preventScroll (ប្រអប់តម្រូវខ្លួនពីលើ keyboard ដោយខ្លួនឯង) ·
        //   (ខ) ទោះ iOS រំកិល document ក៏ដោយ ខណៈប្រអប់បើក (iOS standalone) ➜ ត្រឡប់ ០ · ទិសផ្ទុយ ៖ គ្មានប្រអប់ · Android ➜ មិនប៉ះ ។
        for (const ios of [true, false]) {
            const size = SIZES[3];
            const ctx = await browser.newContext({ viewport: { width: size.w, height: size.h }, hasTouch: true, isMobile: true, serviceWorkers: 'block' });
            const page = await ctx.newPage();
            page.on('dialog', (d) => d.dismiss().catch(() => {}));
            await page.route('**', (r) => r.request().url().startsWith('http://127.0.0.1:' + port) ? r.continue() : r.abort());
            if (ios) await page.addInitScript(IOS_FLAGS);
            await page.addInitScript(FAKE_VIEWPORT);
            await page.addInitScript(() => {
                window.__focusLog = [];
                const real = HTMLElement.prototype.focus;
                HTMLElement.prototype.focus = function (options) {
                    window.__focusLog.push({ id: this.id || this.tagName, inModal: !!(this.closest && this.closest('.modal')), preventScroll: !!(options && options.preventScroll) });
                    return real.call(this, options);
                };
            });
            await page.goto('http://127.0.0.1:' + port + '/', { waitUntil: 'domcontentloaded', timeout: 20000 });
            await page.waitForTimeout(900);
            const ready = await page.evaluate(() => typeof openModalHelper === 'function' && typeof focusField === 'function' && typeof openBatchScanModal === 'function');
            if (!ready) { bad('ទំព័រមិនរំកិល ៖ audit bridge (focusField · openBatchScanModal)'); await ctx.close(); continue; }
            if (ios) {
                await closeAll(page);
                const ids = await modalIdsWithFields(page);
                let called = 0;
                for (const id of ids) {
                    await closeAll(page);
                    await page.evaluate((m) => openModalHelper(m), id);
                    await settle(page, 300);
                    called += await page.evaluate(({ id, sel }) => {
                        let n = 0;
                        for (const f of Array.from(document.getElementById(id).querySelectorAll(sel))) {
                            const r = f.getBoundingClientRect();
                            if (!f.id || !(r.width > 0 && r.height > 0)) continue;
                            const before = window.__focusLog.length;
                            focusField(f.id);
                            if (window.__focusLog.length > before) n++;
                        }
                        return n;
                    }, { id, sel: FIELD_SELECTOR });
                }
                await closeAll(page);
                await page.evaluate(() => { if (typeof switchAppPage === 'function') switchAppPage('entry'); });
                await settle(page, 300);
                const mark = await page.evaluate(() => window.__focusLog.length);
                await page.evaluate(() => openBatchScanModal());
                await settle(page, 400);
                const log = await page.evaluate(() => window.__focusLog.slice());
                const modalCalls = log.slice(0, mark).filter((c) => c.inModal);
                const unsafe = modalCalls.filter((c) => !c.preventScroll);
                check(called >= 20 && modalCalls.length >= called && unsafe.length === 0,
                    '⛔ (ក) focusField() លើគ្រប់ប្រអប់វាយ (ref) ក្នុងគ្រប់ប្រអប់ (' + called + ') ➜ preventScroll (iOS មិនរំកិលទំព័រ)', JSON.stringify(unsafe.slice(0, 8)));
                const batch = log.slice(mark).filter((c) => c.id === 'batchBarcodeInput');
                check(batch.length >= 1 && batch.every((c) => c.inModal && c.preventScroll),
                    '⛔ (ក) «📋 បញ្ចូលច្រើន» (openBatchScanModal ពិត ៖ focus ក្រោយ ១៥០ms) ➜ preventScroll', JSON.stringify(batch));
            }
            await closeAll(page);
            await page.evaluate(() => {
                const spacer = document.createElement('div');
                spacer.id = '__docSpacer';
                // ទីតាំង absolute ➜ ហៀរចូល viewport (body `overflow: hidden` កាត់កូនធម្មតា) ➜ document រមូរបាន ដូច iOS ពេល keyboard បើក
                spacer.style.cssText = 'position: absolute; top: 0; left: 0; height: 3000px; width: 1px; pointer-events: none;';
                document.body.appendChild(spacer);
            });
            const docScroll = async () => {
                await page.evaluate(() => window.scrollTo(0, 220));
                await settle(page, 200);
                return page.evaluate(() => Math.round(window.scrollY));
            };
            const noModal = await docScroll();
            await page.evaluate(() => window.scrollTo(0, 0));
            await page.evaluate(() => openModalHelper('batchScanModal'));
            await settle(page, 300);
            const withModal = await docScroll();
            const standalone = await page.evaluate(() => document.documentElement.classList.contains('ios-standalone'));
            await page.evaluate(() => { window.scrollTo(0, 0); const s = document.getElementById('__docSpacer'); if (s) s.remove(); });
            if (ios) {
                check(standalone && withModal === 0 && noModal === 220,
                    '⛔ (ខ) iPhone standalone ៖ document រំកិល ២២០px ខណៈប្រអប់បើក ➜ ត្រឡប់ ០ (navbar នៅលើអេក្រង់) · ទិសផ្ទុយ ៖ គ្មានប្រអប់ ➜ មិនប៉ះ (គំរូអាចធ្លាក់)', JSON.stringify({ standalone, withModal, noModal }));
            } else {
                check(!standalone && withModal === 220 && noModal === 220,
                    'ទិសផ្ទុយ ៖ Android/web (មិនមែន iOS standalone) ➜ document មិនប៉ះ ទោះប្រអប់បើក', JSON.stringify({ standalone, withModal, noModal }));
            }
            await ctx.close();
        }

        console.log('\n=== ⛔ ក្រោយ keyboard ពណ៌តែមួយ (រូបថតពិត ៖ keyboard របស់ iPhone ថ្លា ➜ អ្វីនៅក្រោយវាលេចមក) ===');
        {
            const cases = [];
            for (const size of [SIZES[0], SIZES[2]]) {
                const { ctx, page, ready } = await openApp(browser, port, size, true);
                if (!ready) { bad('ពណ៌ក្រោយ keyboard ៖ audit bridge ' + size.label); await ctx.close(); continue; }
                // toast ជាសារបណ្តោះអាសន្ន (មិនមែនផ្ទៃ) ➜ លាក់ពេលថត ដើម្បីវាស់តែផ្ទៃ backdrop ពិត
                await page.addStyleTag({ content: '.toast-container { display: none !important; }' });
                for (const pageName of ['data', 'entry']) {
                    await closeAll(page);
                    await page.evaluate(() => window.__kb.close());
                    await page.evaluate((p) => { if (typeof switchAppPage === 'function') switchAppPage(p); }, pageName);
                    await settle(page, 300);
                    const ids = size === SIZES[0] ? ['pinModal', 'lookupApiConfigModal', 'editPhoneModal', 'batchScanModal', 'loginModal'] : ['pinModal', 'lookupApiConfigModal', 'batchScanModal'];
                    for (const id of ids) {
                        for (const pan of (size === SIZES[0] ? [0, 140] : [0])) {
                            await closeAll(page);
                            await page.evaluate(() => window.__kb.close());
                            await page.evaluate((m) => openModalHelper(m), id);
                            await settle(page, 380);
                            await page.evaluate(({ id, sel }) => { const f = document.getElementById(id).querySelector(sel); if (f) f.focus({ preventScroll: true }); }, { id, sel: FIELD_SELECTOR });
                            await page.evaluate(({ kb, pan }) => window.__kb.open(kb, pan), { kb: size.kb, pan });
                            await settle(page);
                            const top = size.h - size.kb + pan + 1;
                            const height = size.h - top - 1;
                            if (height < 20) continue;
                            const shot = await page.screenshot({ clip: { x: 0, y: top, width: size.w, height } });
                            const img = decodePng(shot);
                            const lo = [255, 255, 255], hi = [0, 0, 0];
                            for (let i = 0; i < img.px.length; i += img.bpp) {
                                for (let k = 0; k < 3; k++) { const v = img.px[i + k]; if (v < lo[k]) lo[k] = v; if (v > hi[k]) hi[k] = v; }
                            }
                            const spread = Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]);
                            cases.push({ size: size.w + '×' + size.h, page: pageName, id, pan, spread, lo, hi });
                        }
                    }
                }
                await ctx.close();
            }
            const mixed = cases.filter((c) => c.spread > 3);
            check(cases.length >= 24 && mixed.length === 0,
                '⛔ គ្រប់ករណី (' + cases.length + ' ៖ ប្រអប់ ៥ · ទំព័រទិន្នន័យ/ស្កេន · រំកិល ០/១៤០ · ទំហំ ២) ➜ ផ្ទៃក្រោយ keyboard មានពណ៌តែមួយ (គម្លាត ≤ ៣)',
                JSON.stringify(mixed.slice(0, 6)) + (mixed.length > 6 ? ' … +' + (mixed.length - 6) : ''));
        }

        console.log('\n=== ⛔ toast ពីលើ keyboard (iPhone ៖ toast ជាប់បាត layout viewport ➜ keyboard បាំងសារ) ===');
        {
            // toast មួយ ៖ rect (លើអេក្រង់ = rect − offsetTop) ត្រូវនៅក្នុងផ្ទៃមើលឃើញ ហើយ elementFromPoint ចំកណ្តាលវាជា toast (មិនមែន backdrop/::after)
            const TOAST = function (text) {
                const vv = window.visualViewport;
                const visTop = vv.offsetTop, visBottom = vv.offsetTop + vv.height;
                const el = Array.from(document.querySelectorAll('.toast')).reverse().find((t) => t.textContent.indexOf(text) >= 0);
                if (!el) return { found: false };
                const r = el.getBoundingClientRect();
                // toast មិនទទួលការចុច (pointer-events: none) ➜ បើកបណ្តោះអាសន្នដើម្បីវាស់ថាវានៅខាងលើគេ (z-index) រួចដាក់វិញ
                const box = el.closest('.toast-container');
                const keep = [el.style.pointerEvents, box ? box.style.pointerEvents : ''];
                el.style.pointerEvents = 'auto';
                if (box) box.style.pointerEvents = 'auto';
                const hit = document.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2));
                el.style.pointerEvents = keep[0];
                if (box) box.style.pointerEvents = keep[1];
                // ទីតាំងដើម (keyboard បិទ) ៖ បាត ២៤px · ទូរស័ព្ទ/tablet ដែលរបា Tab បង្ហាញនៅបាត ➜ ពីលើរបា Tab ១២px (layout-check «toast ⟷ របា Tab»)
                const tab = document.getElementById('pageTabBar');
                const tr = tab ? tab.getBoundingClientRect() : null;
                const barShown = !!tr && tr.height > 20 && tr.top > window.innerHeight / 2 && !document.body.classList.contains('chrome-hidden');
                const rest = Math.round(document.getElementById('toastContainer').getBoundingClientRect().bottom);
                const home = barShown ? Math.min(window.innerHeight - 24, Math.round(tr.top) - 12) : window.innerHeight - 24;
                return { found: true, top: Math.round(r.top), bottom: Math.round(r.bottom), visTop: Math.round(visTop), visBottom: Math.round(visBottom), inner: window.innerHeight,
                    inside: r.top >= visTop - 1 && r.bottom <= visBottom - 8, onTop: !!hit && el.contains(hit), rest, home, barShown };
            };
            const cases = [];
            let hiddenAtBase = 0;
            for (const size of [SIZES[0], SIZES[2]]) {
                const { ctx, page, ready } = await openApp(browser, port, size, true);
                if (!ready) { bad('toast ⟷ keyboard ៖ audit bridge ' + size.label); await ctx.close(); continue; }
                let n = 0;
                for (const id of [null, 'batchScanModal', 'pinModal', 'lookupApiConfigModal']) {
                    for (const pan of [0, 140]) {
                        await closeAll(page);
                        await page.evaluate(() => window.__kb.close());
                        if (id) {
                            await page.evaluate((m) => openModalHelper(m), id);
                            await settle(page, 380);
                            await page.evaluate(({ id, sel }) => { const f = document.getElementById(id).querySelector(sel); if (f) f.focus({ preventScroll: true }); }, { id, sel: FIELD_SELECTOR });
                        }
                        await page.evaluate(({ kb, pan }) => window.__kb.open(kb, pan), { kb: size.kb, pan });
                        await settle(page);
                        const text = 'kbtoast-' + size.w + '-' + (id || 'page') + '-' + pan + '-' + (n++);
                        await page.evaluate((t) => showToast('⚠️ ' + t), text);
                        await settle(page, 450);
                        const m = await page.evaluate(TOAST, text);
                        if (m.found && m.home > m.visBottom) hiddenAtBase++;
                        cases.push(Object.assign({ size: size.w + '×' + size.h, id: id || 'ទំព័រ', pan }, m));
                    }
                }
                await closeAll(page);
                await page.evaluate(() => window.__kb.close());
                await settle(page);
                await page.evaluate(() => showToast('⚠️ kbtoast-closed'));
                await settle(page, 450);
                const closed = await page.evaluate(TOAST, 'kbtoast-closed');
                check(closed.found && closed.inside && Math.abs(closed.rest - closed.home) <= 1,
                    'ទិសផ្ទុយ ៖ ' + size.label + ' keyboard បិទ ➜ toast នៅកន្លែងដើម (បាត ២៤px · ពីលើរបា Tab ពេលវាបង្ហាញ)', JSON.stringify(closed));
                await ctx.close();
            }
            const wrong = cases.filter((c) => !c.found || !c.inside || !c.onTop);
            check(cases.length >= 16 && wrong.length === 0,
                '⛔ គ្រប់ករណី (' + cases.length + ' ៖ ទំព័រ · ប្រអប់ ៣ · រំកិល ០/១៤០ · ទំហំ ២) ➜ toast នៅក្នុងផ្ទៃមើលឃើញពីលើ keyboard ហើយនៅខាងលើប្រអប់',
                JSON.stringify(wrong.slice(0, 6)) + (wrong.length > 6 ? ' … +' + (wrong.length - 6) : ''));
            check(hiddenAtBase >= 16, 'គំរូអាចធ្លាក់ ៖ ទីតាំងដើមរបស់ toast (បាត ២៤px · ពីលើរបា Tab) នៅក្រោយ keyboard គ្រប់ករណី (សេណារីយ៉ូពិត)', 'ឃើញ ' + hiddenAtBase);
            const apkSize = SIZES[0];
            const { ctx, page, ready } = await openApp(browser, port, apkSize, false);
            if (ready) {
                await page.setViewportSize({ width: apkSize.w, height: apkSize.h - apkSize.kb });
                await settle(page, 450);
                await page.evaluate(() => showToast('⚠️ kbtoast-apk'));
                await settle(page, 450);
                const apk = await page.evaluate(TOAST, 'kbtoast-apk');
                const cover = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--keyboard-cover').trim());
                check(apk.found && apk.inside && Math.abs(apk.rest - apk.home) <= 1 && (cover === '0px' || cover === ''),
                    'ទិសផ្ទុយ ៖ APK (WebView បង្រួម viewport) ➜ --keyboard-cover ០ · toast នៅកន្លែងដើមនៃ viewport ដែលបង្រួម', JSON.stringify({ apk, cover }));
            } else bad('toast ⟷ keyboard ៖ audit bridge APK');
            await ctx.close();
        }

        console.log('\n=== ⛔ សុវត្ថិភាព ៖ ប្រអប់ចូល · Activate · PIN មិនអាចរំលង (keyboard បិទ · បើក · រំកិល) ===');
        {
            const size = SIZES[0];
            const ctx = await browser.newContext({ viewport: { width: size.w, height: size.h }, hasTouch: true, isMobile: true, serviceWorkers: 'block' });
            const page = await ctx.newPage();
            page.on('dialog', (d) => d.dismiss().catch(() => {}));
            await page.route('**', (r) => r.request().url().startsWith('http://127.0.0.1:' + port) ? r.continue() : r.abort());
            await page.addInitScript(IOS_FLAGS);
            await page.addInitScript(FAKE_VIEWPORT);
            await page.goto('http://127.0.0.1:' + port + '/', { waitUntil: 'domcontentloaded', timeout: 20000 });
            await page.waitForTimeout(900);
            const ready = await page.evaluate(() => typeof openModalHelper === 'function' && typeof requestPinBeforeConfig === 'function' && typeof hashPin === 'function' && typeof showAppLockScreen === 'function');
            check(ready, 'សុវត្ថិភាព ៖ audit bridge (openModalHelper · requestPinBeforeConfig · hashPin · showAppLockScreen)');
            if (ready) {
                const COVER = function ({ id }) {
                    const modal = document.getElementById(id);
                    const leaks = [];
                    let points = 0;
                    for (let y = 4; y < window.innerHeight; y += 24) {
                        for (let x = 4; x < window.innerWidth; x += 24) {
                            points++;
                            const el = document.elementFromPoint(x, y);
                            if (!el || !modal.contains(el)) leaks.push([x, y, el ? (el.id || el.className || el.tagName) : null]);
                        }
                    }
                    return { open: getComputedStyle(modal).display !== 'none', points, leaks: leaks.slice(0, 5), leakCount: leaks.length };
                };
                const states = [['keyboard បិទ', 0, 0], ['keyboard បើក', size.kb, 0], ['keyboard បើក + រំកិល ១៤០', size.kb, 140]];
                const openGate = async (id) => {
                    await closeAll(page);
                    await page.evaluate(() => window.__kb.close());
                    if (id === 'pinModal' || id === 'pinSetupModal') {
                        await page.evaluate(async (setup) => {
                            window.__ran = 0;
                            if (setup) localStorage.removeItem('zoew_security_pin_hash');
                            else localStorage.setItem('zoew_security_pin_hash', await hashPin('246810'));
                            requestPinBeforeConfig(() => { window.__ran++; }, 'config');
                        }, id === 'pinSetupModal');
                    } else {
                        await page.evaluate((m) => openModalHelper(m), id);
                    }
                    await settle(page, 450);
                };
                for (const id of ['loginModal', 'activationModal', 'pinModal', 'pinSetupModal']) {
                    const leaks = [];
                    for (const [label, kb, pan] of states) {
                        await openGate(id);
                        if (kb) {
                            await page.evaluate(({ id, sel }) => { const f = document.getElementById(id).querySelector(sel); if (f) f.focus({ preventScroll: true }); }, { id, sel: FIELD_SELECTOR });
                            await page.evaluate(({ kb, pan }) => window.__kb.open(kb, pan), { kb, pan });
                            await settle(page);
                        }
                        const c = await page.evaluate(COVER, { id });
                        if (!c.open || c.leakCount || c.points < 400) leaks.push(Object.assign({ label }, c));
                    }
                    check(leaks.length === 0, '⛔ ' + id + ' ៖ គ្រប់ចំណុចលើអេក្រង់ (ក្រឡា ២៤px · keyboard បិទ/បើក/រំកិល) ជារបស់ប្រអប់ ➜ ចុចទំព័រខាងក្រោយមិនបាន', JSON.stringify(leaks));
                }
                for (const id of ['loginModal', 'activationModal']) {
                    await openGate(id);
                    await page.evaluate(({ id, sel }) => { const f = document.getElementById(id).querySelector(sel); if (f) f.focus({ preventScroll: true }); }, { id, sel: FIELD_SELECTOR });
                    await page.evaluate((kb) => window.__kb.open(kb, 140), size.kb);
                    await settle(page);
                    for (const [x, y] of [[6, 6], [size.w - 6, size.h / 2], [size.w / 2, size.h - 6]]) {
                        await page.touchscreen.tap(x, y);
                        await settle(page, 120);
                    }
                    await page.keyboard.press('Escape');
                    await settle(page, 120);
                    const still = await page.evaluate((m) => openModalIds().includes(m), id);
                    check(still, '⛔ ' + id + ' (noDismiss) ៖ ចុចផ្ទៃងងឹត (ជ្រុង · ចំហៀង · ក្រោម keyboard) និង Escape ➜ នៅបើក', String(still));
                }
                for (const id of ['pinModal', 'pinSetupModal']) {
                    const results = [];
                    for (const how of ['tap', 'escape']) {
                        await openGate(id);
                        await page.evaluate(({ id, sel }) => { const f = document.getElementById(id).querySelector(sel); if (f) f.focus({ preventScroll: true }); }, { id, sel: FIELD_SELECTOR });
                        await page.evaluate((kb) => window.__kb.open(kb, 140), size.kb);
                        await settle(page);
                        if (how === 'tap') await page.touchscreen.tap(size.w / 2, size.h - 6);
                        else await page.keyboard.press('Escape');
                        await settle(page, 200);
                        results.push(await page.evaluate((m) => ({ how: m.how, open: openModalIds().includes(m.id), ran: window.__ran }), { id, how }));
                    }
                    check(results.every((r) => !r.open && r.ran === 0), '⛔ ' + id + ' ៖ ចុចផ្ទៃងងឹត (ក្រោម keyboard) ឬ Escape ➜ បោះបង់ · សកម្មភាពក្រោយ PIN មិនរត់', JSON.stringify(results));
                }
                await openGate('pinModal');
                const input = await page.evaluate(() => { const r = document.getElementById('securityPinInput').getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; });
                await page.touchscreen.tap(input.x, input.y);
                await settle(page, 150);
                await page.keyboard.type('135791');
                await page.keyboard.press('Enter');
                await settle(page, 1200);
                const wrong = await page.evaluate(() => ({ ran: window.__ran, open: openModalIds().includes('pinModal') }));
                await page.evaluate(() => { localStorage.removeItem('zoew_pin_fail_count'); localStorage.removeItem('zoew_pin_lockout_until'); });
                await page.touchscreen.tap(input.x, input.y);
                await settle(page, 150);
                await page.keyboard.type('246810');
                await page.keyboard.press('Enter');
                await settle(page, 1500);
                const right = await page.evaluate(() => ({ ran: window.__ran, open: openModalIds().includes('pinModal') }));
                check(wrong.ran === 0 && wrong.open && right.ran === 1 && !right.open,
                    '⛔ iPhone ៖ ចុចប្រអប់ PIN (focus ដោយកូដ) + PIN ខុស ➜ មិនរត់ · PIN ត្រូវ ➜ រត់ម្តង (សាក spy ពិត)', JSON.stringify({ wrong, right }));

                await closeAll(page);
                await page.evaluate(() => window.__kb.close());
                await page.evaluate(async () => {
                    localStorage.setItem('zoew_security_pin_hash', await hashPin('246810'));
                    localStorage.removeItem('zoew_pin_fail_count');
                    localStorage.removeItem('zoew_pin_lockout_until');
                    showAppLockScreen();
                });
                await settle(page, 300);
                const lockLeaks = [];
                for (const [label, kb, pan] of states) {
                    await page.evaluate(() => window.__kb.close());
                    if (kb) {
                        await page.evaluate(() => { const f = document.getElementById('appLockPinInput'); if (f) f.focus({ preventScroll: true }); });
                        await page.evaluate(({ kb, pan }) => window.__kb.open(kb, pan), { kb, pan });
                    }
                    await settle(page);
                    const c = await page.evaluate(() => {
                        const lock = document.getElementById('appLockScreen');
                        const leaks = [];
                        let points = 0;
                        for (let y = 4; y < window.innerHeight; y += 24) {
                            for (let x = 4; x < window.innerWidth; x += 24) {
                                points++;
                                const el = document.elementFromPoint(x, y);
                                if (el && !lock.contains(el) && el !== document.body && el !== document.documentElement) leaks.push([x, y, el.id || el.className || el.tagName]);
                            }
                        }
                        return { open: lock.classList.contains('is-open'), points, leaks: leaks.slice(0, 5), leakCount: leaks.length };
                    });
                    if (!c.open || c.leakCount || c.points < 400) lockLeaks.push(Object.assign({ label }, c));
                }
                check(lockLeaks.length === 0, '⛔ ផ្ទាំងចាក់សោ App ៖ គ្រប់ចំណុចលើអេក្រង់ (keyboard បិទ/បើក/រំកិល) ជារបស់ផ្ទាំងចាក់សោ ➜ ចុចទំព័រខាងក្រោយមិនបាន', JSON.stringify(lockLeaks));
                for (const [x, y] of [[6, 6], [size.w - 6, size.h / 2], [size.w / 2, size.h - 6]]) {
                    await page.touchscreen.tap(x, y);
                    await settle(page, 100);
                }
                await page.keyboard.press('Escape');
                await settle(page, 150);
                const lockInput = await page.evaluate(() => { const r = document.getElementById('appLockPinInput').getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; });
                await page.touchscreen.tap(lockInput.x, lockInput.y);
                await settle(page, 150);
                await page.keyboard.type('135791');
                await page.keyboard.press('Enter');
                await settle(page, 1500);
                const lockWrong = await page.evaluate(() => ({ open: document.getElementById('appLockScreen').classList.contains('is-open'), locked: document.body.classList.contains('app-locked') }));
                await page.evaluate(() => { localStorage.removeItem('zoew_pin_fail_count'); localStorage.removeItem('zoew_pin_lockout_until'); });
                await page.touchscreen.tap(lockInput.x, lockInput.y);
                await settle(page, 150);
                await page.keyboard.type('246810');
                await page.keyboard.press('Enter');
                await settle(page, 1800);
                const lockRight = await page.evaluate(() => ({ open: document.getElementById('appLockScreen').classList.contains('is-open'), locked: document.body.classList.contains('app-locked') }));
                check(lockWrong.open && lockWrong.locked && !lockRight.open && !lockRight.locked,
                    '⛔ ផ្ទាំងចាក់សោ App ៖ ចុចជ្រុង/ចំហៀង/ក្រោម · Escape · PIN ខុស ➜ នៅចាក់សោ · PIN ត្រូវ ➜ ដោះ (សាកពិត)', JSON.stringify({ lockWrong, lockRight }));
            }
            await ctx.close();
        }
    } catch (e) {
        bad('checker បោះ error', e && e.stack ? e.stack.split('\n').slice(0, 4).join(' | ') : String(e));
    } finally {
        await browser.close();
        server.close();
        console.log('\n' + (fail === 0 ? '✅ ជោគជ័យ ' + pass : '❌ ធ្លាក់ ' + fail + ' (ជោគជ័យ ' + pass + ')'));
        process.exitCode = fail === 0 && pass > 0 ? 0 : 1;
    }
})();
