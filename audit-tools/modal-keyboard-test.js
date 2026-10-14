// ថ្នាក់កំហុសដែលឧបករណ៍នេះចាក់សោ ៖ ប្រអប់ (modal) ដែលមានប្រអប់វាយអក្សរ/លេខ ត្រូវ keyboard បាំង ។
//   iPhone (និង browser ដែលមិនបង្រួមទំព័រពេល keyboard បើក) មិនប្តូរកម្ពស់ layout viewport ទេ ➜ `.modal` (fixed · កម្ពស់ ១០០%)
//   នៅកណ្តាលអេក្រង់ពេញ ➜ ពាក់កណ្តាលក្រោមរបស់ប្រអប់ និងប្រអប់វាយដែលកំពុងប្រើ នៅក្រោយ keyboard ។
// ⛔ ច្បាប់ (ម្ចាស់គម្រោង ៖ «កុំអោយរំកិលឡើងទាំងមូល ព្រោះ modal ខ្លះវែងអាចផុត» · «ផ្ទៃថ្លាពីលើ keyboard ពណ៌ពីរខុសគ្នា») ៖
//    keyboard បាំង ≥ KEYBOARD_MIN_INSET_PX ➜ ប្រអប់នៅ **ទីតាំងដដែលលើអេក្រង់** (កំពូល · ឆ្វេង · ស្តាំ ដូចពេល keyboard បិទ ទោះ iOS រំកិល
//    visual viewport ក៏ដោយ) · មានតែបាតខ្លីមកត្រឹម keyboard (គម្លាត MODAL_KEYBOARD_GAP_PX) ហើយរមូរក្នុងខ្លួន ➜ ប្រអប់វាយដែល focus
//    មើលឃើញពីលើ keyboard · ប្រអប់ដែលនៅពីលើ keyboard រួចហើយ ➜ មិនប្តូរអ្វីទាំងអស់ · ផ្ទៃដែលនៅសល់ក្រោមកំពូលតិចជាង
//    MODAL_KEYBOARD_MIN_VISIBLE_PX ➜ ទើបលើកកំពូលឡើង (ប្រអប់តូច) · ផ្ទៃងងឹត (backdrop) គ្របពេញ layout viewport ហើយលាតចុះក្រោមតាម
//    ការរំកិល ➜ នៅក្រោយ keyboard មានពណ៌តែមួយ · keyboard បិទ ➜ ដូចដើម · APK (WebView បង្រួមខ្លួនឯង) ➜ មិនប្តូរប្លង់ ហើយប្រអប់វាយមើលឃើញ ។
// វិធី ៖ App ពិត (audit build) · visualViewport ក្លែង (Chromium មិនមាន keyboard) · បញ្ជីប្រអប់ និងប្រអប់វាយ **ដេរីវេពី DOM ពិត**
//    (គ្រប់ `.modal` ដែលមាន input អក្សរ/លេខ ឬ textarea ដែលមើលឃើញពេលបើក) · ទំហំទូរស័ព្ទ ៣ · ផ្ទៃមើលឃើញរំកិល (offsetTop) ·
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
const MIN_VISIBLE = appConst('MODAL_KEYBOARD_MIN_VISIBLE_PX', 180);
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
        open(px, at) { inset = px; top = at || 0; fake.dispatchEvent(new Event('resize')); fake.dispatchEvent(new Event('scroll')); },
        close() { inset = 0; top = 0; fake.dispatchEvent(new Event('resize')); fake.dispatchEvent(new Event('scroll')); },
        state() { return { inset, top, height: window.innerHeight - inset }; }
    };
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
    const afterHeight = after.content === 'none' || after.display === 'none' ? 0 : (parseFloat(after.height) || 0);
    const probeY = Math.min(window.innerHeight - 3, Math.max(visBottom + 3, window.innerHeight - 20));
    const behind = visBottom < window.innerHeight - 4 ? document.elementFromPoint(Math.round(window.innerWidth / 2), Math.round(probeY)) : modal;
    return {
        id, index, focused: document.activeElement === field, bodyClass: document.body.classList.contains('modal-keyboard'),
        visTop: Math.round(visTop), visBottom: Math.round(visBottom), inner: window.innerHeight,
        screen: [Math.round(cr.top - visTop), Math.round(cr.bottom - visTop), Math.round(cr.left), Math.round(cr.right)],
        content: [Math.round(cr.top), Math.round(cr.bottom)], field: [Math.round(fr.top), Math.round(fr.bottom)],
        backdrop: [Math.round(mr.top), Math.round(mr.bottom), Math.round(afterHeight)],
        backdropFull: mr.top <= 1 && mr.bottom + afterHeight >= window.innerHeight + visTop - 1,
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

// ច្បាប់ទីតាំង ៖ base = ទីតាំងដើម · m = ការវាស់ពេល keyboard បើក ➜ កំហុស (ទទេ = ត្រូវ)
function placementProblems(base, m) {
    const problems = [];
    const pan = m.visTop;
    const line = m.visBottom - pan - GAP;
    const room = line - base[0];
    const floor = Math.min(base[1] - base[0], MIN_VISIBLE);
    if (Math.abs(m.screen[2] - base[2]) > 1 || Math.abs(m.screen[3] - base[3]) > 1) problems.push('ឆ្វេង/ស្តាំប្តូរ');
    if (room >= floor) {
        if (Math.abs(m.screen[0] - base[0]) > 1) problems.push('កំពូលផ្លាស់ទី ' + base[0] + ' ➜ ' + m.screen[0]);
    } else if (m.screen[0] > base[0] + 1 || m.screen[0] < 11) {
        problems.push('កំពូល (ផ្ទៃតូច) ' + base[0] + ' ➜ ' + m.screen[0]);
    }
    if (base[1] <= line + 1 && pan === 0 && Math.abs(m.screen[1] - base[1]) > 1) problems.push('ប្រអប់នៅពីលើ keyboard រួច តែបាតប្តូរ');
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
    { w: 320, h: 568, kb: 253, label: 'ទូរស័ព្ទតូច 320×568 · keyboard 253' }
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
        const longKept = [];
        for (const size of SIZES) {
            const { ctx, page, ready } = await openApp(browser, port, size, true);
            check(ready, size.label + ' ៖ audit bridge (openModalHelper · closeModal · openModalIds)');
            if (!ready) { await ctx.close(); continue; }
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
                    if (id === 'lookupApiConfigModal') longKept.push(problems.length === 0 && Math.abs(m.screen[0] - base[0]) <= 1);
                    await page.evaluate(() => window.__kb.close());
                    await settle(page, 120);
                }
                await page.evaluate((m) => closeModal(m), id);
            }
            check(perSize > 0 && failures.length === 0,
                '⛔ ' + size.label + ' ៖ គ្រប់ប្រអប់វាយ (' + perSize + ') ➜ ប្រអប់នៅទីតាំងដដែល (កំពូល · ឆ្វេង · ស្តាំ) · បាតត្រឹម keyboard · ប្រអប់វាយមើលឃើញ · ក្រោយ keyboard ជា backdrop',
                JSON.stringify(failures.slice(0, 6)) + (failures.length > 6 ? ' … +' + (failures.length - 6) : ''));
            await ctx.close();
        }
        check(longKept.length >= 3 && longKept.every(Boolean), '⛔ ប្រអប់វែង «API ស្វែងរកអតិថិជន» (lookupApiConfigModal) ៖ កំពូលមិនផ្លាស់ទី មិនផុតអេក្រង់ គ្រប់ទំហំ · គ្រប់ប្រអប់វាយ',
            JSON.stringify(longKept));
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
                check(fields.length >= 2 && panned.visTop === 140 && pannedProblems.length === 0 && panned.backdrop[2] >= 139,
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
            const ready = await page.evaluate(() => typeof openModalHelper === 'function' && typeof requestPinBeforeConfig === 'function' && typeof hashPin === 'function');
            check(ready, 'សុវត្ថិភាព ៖ audit bridge (openModalHelper · requestPinBeforeConfig · hashPin)');
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
