// ថ្នាក់កំហុសដែលឧបករណ៍នេះចាក់សោ ៖ ប្រអប់ (modal) ដែលមានប្រអប់វាយអក្សរ/លេខ ត្រូវ keyboard បាំង ។
//   iPhone (និង browser ដែលមិនបង្រួមទំព័រពេល keyboard បើក) មិនប្តូរកម្ពស់ layout viewport ទេ ➜ `.modal` (fixed · កម្ពស់ ១០០%)
//   នៅកណ្តាលអេក្រង់ពេញ ➜ ពាក់កណ្តាលក្រោមរបស់ប្រអប់ និងប្រអប់វាយដែលកំពុងប្រើ នៅក្រោយ keyboard ។
// ⛔ ច្បាប់ ៖ ប្រអប់ណាក៏ដោយដែលបើក ពេល keyboard បាំង ≥ KEYBOARD_MIN_INSET_PX ➜ ប្រអប់ស្ថិតក្នុងផ្ទៃដែលមើលឃើញ (visual viewport ៖
//    `offsetTop` · `height`) ទាំងស្រុង ហើយប្រអប់វាយដែល focus នៅក្នុងផ្ទៃនោះ និងក្នុងអ្នករមូររបស់វា · keyboard បិទ ➜ ដូចដើម ។
//    APK (WebView បង្រួមខ្លួនឯង) ➜ គ្មានការផ្លាស់ប្តូរ ។
// វិធី ៖ App ពិត (audit build) · visualViewport ក្លែង (Chromium មិនមាន keyboard) · បញ្ជីប្រអប់ និងប្រអប់វាយ **ដេរីវេពី DOM ពិត**
//    (គ្រប់ `.modal` ដែលមាន input អក្សរ/លេខ ឬ textarea ដែលមើលឃើញពេលបើក) · ទំហំទូរស័ព្ទ ៣ · ផ្ទៃមើលឃើញរំកិល (offsetTop) ·
//    ទិសផ្ទុយ (keyboard បិទ · APK បង្រួម viewport · ជាន់អប្បបរមា) ។
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

// វាស់ ៖ ផ្ទៃមើលឃើញ [top, top + height] (ក្នុង layout viewport ដូច getBoundingClientRect) · កាតប្រអប់ · ប្រអប់វាយ · ការកាត់ដោយអ្នករមូរ
const MEASURE = function ({ id, index, sel }) {
    const modal = document.getElementById(id);
    const field = Array.from(modal.querySelectorAll(sel))[index];
    const vv = window.visualViewport;
    const visTop = vv.offsetTop;
    const visBottom = vv.offsetTop + vv.height;
    const content = modal.querySelector('.modal-content') || modal.firstElementChild;
    const cr = content.getBoundingClientRect();
    const fr = field.getBoundingClientRect();
    let clippedBy = null;
    for (let n = field.parentElement; n && n !== modal; n = n.parentElement) {
        const cs = getComputedStyle(n);
        if (!/(auto|scroll|hidden)/.test(cs.overflowY)) continue;
        const nr = n.getBoundingClientRect();
        if (fr.top < nr.top - 1 || fr.bottom > nr.bottom + 1) { clippedBy = n.id || n.className || n.tagName; break; }
    }
    const fieldTall = fr.height > vv.height * 0.5;
    return {
        id, index, focused: document.activeElement === field, bodyClass: document.body.classList.contains('modal-keyboard'),
        visTop: Math.round(visTop), visBottom: Math.round(visBottom),
        content: [Math.round(cr.top), Math.round(cr.bottom)], field: [Math.round(fr.top), Math.round(fr.bottom)],
        contentInside: cr.top >= visTop - 1 && cr.bottom <= visBottom + 1,
        fieldInside: fr.top >= visTop - 1 && (fieldTall ? fr.top + 40 <= visBottom : fr.bottom <= visBottom + 1) && !clippedBy,
        clippedBy, fieldTall
    };
};

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

        console.log('\n=== ប្រអប់ ⟷ keyboard (iPhone ៖ keyboard បាំង · ផ្ទៃមើលឃើញ = visualViewport) ===');
        let measured = 0;
        let overlapsWithout = 0;
        const modalSeen = new Set();
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
                await settle(page, 200);
                const fields = await visibleFields(page, id);
                for (const f of fields) {
                    await page.evaluate(({ id, index, sel }) => {
                        const field = Array.from(document.getElementById(id).querySelectorAll(sel))[index];
                        field.focus({ preventScroll: true });
                    }, { id, index: f.index, sel: FIELD_SELECTOR });
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
                    const m = await page.evaluate(MEASURE, { id, index: f.index, sel: FIELD_SELECTOR });
                    measured++;
                    perSize++;
                    modalSeen.add(id);
                    if (!(m.focused && m.bodyClass && m.contentInside && m.fieldInside)) failures.push(Object.assign({ name: f.name }, m));
                    await page.evaluate(() => window.__kb.close());
                    await settle(page, 120);
                }
                await page.evaluate((m) => closeModal(m), id);
            }
            check(perSize > 0 && failures.length === 0,
                '⛔ ' + size.label + ' ៖ គ្រប់ប្រអប់វាយ (' + perSize + ') ➜ កាតប្រអប់ និងប្រអប់វាយនៅក្នុងផ្ទៃមើលឃើញពីលើ keyboard · មិនត្រូវអ្នករមូរកាត់',
                JSON.stringify(failures.slice(0, 6)) + (failures.length > 6 ? ' … +' + (failures.length - 6) : ''));
            await ctx.close();
        }
        check(modalSeen.size >= 12, 'ជាន់អប្បបរមា ៖ ប្រអប់ដែលបានវាស់ជាមួយប្រអប់វាយមើលឃើញ ≥ ១២', 'ឃើញ ' + modalSeen.size + ' ៖ ' + Array.from(modalSeen).join(' '));
        check(measured >= 60, 'ជាន់អប្បបរមា ៖ ការវាស់ (ប្រអប់វាយ × ទំហំ) ≥ ៦០', 'វាស់ ' + measured);
        check(overlapsWithout >= 10, 'គំរូអាចធ្លាក់ ៖ មុនពេលប្រអប់ផ្លាស់ទី ករណីដែល keyboard បាំងកាត ឬប្រអប់វាយ ≥ ១០ (សេណារីយ៉ូពិត)', 'ឃើញ ' + overlapsWithout);

        console.log('\n=== ផ្ទៃមើលឃើញរំកិល (iOS រំកិល visual viewport ដើម្បីបង្ហាញប្រអប់វាយ) · ប្តូរប្រអប់វាយ · keyboard បិទ ===');
        {
            const size = SIZES[0];
            const { ctx, page, ready } = await openApp(browser, port, size, true);
            if (ready) {
                await closeAll(page);
                await page.evaluate(() => openModalHelper('manualAdjustModal'));
                await settle(page, 450);
                const fields = await visibleFields(page, 'manualAdjustModal');
                const base = await page.evaluate(() => { const r = document.querySelector('#manualAdjustModal .modal-content').getBoundingClientRect(); return [Math.round(r.top), Math.round(r.bottom)]; });
                const last = fields[fields.length - 1];
                await page.evaluate(({ index, sel }) => Array.from(document.getElementById('manualAdjustModal').querySelectorAll(sel))[index].focus({ preventScroll: true }), { index: last.index, sel: FIELD_SELECTOR });
                await page.evaluate((kb) => window.__kb.open(kb, 140), size.kb);
                await settle(page);
                const panned = await page.evaluate(MEASURE, { id: 'manualAdjustModal', index: last.index, sel: FIELD_SELECTOR });
                check(fields.length >= 2 && panned.bodyClass && panned.contentInside && panned.fieldInside && panned.visTop === 140,
                    '⛔ ផ្ទៃមើលឃើញរំកិល ១៤០px ➜ ប្រអប់តាមផ្ទៃមើលឃើញ (កាត និងប្រអប់វាយនៅក្នុង)', JSON.stringify(panned));
                const first = fields[0];
                await page.evaluate(({ index, sel }) => Array.from(document.getElementById('manualAdjustModal').querySelectorAll(sel))[index].focus({ preventScroll: true }), { index: first.index, sel: FIELD_SELECTOR });
                await settle(page);
                const switched = await page.evaluate(MEASURE, { id: 'manualAdjustModal', index: first.index, sel: FIELD_SELECTOR });
                check(switched.focused && switched.contentInside && switched.fieldInside, 'ប្តូរទៅប្រអប់វាយផ្សេង (keyboard នៅបើក) ➜ ប្រអប់វាយថ្មីមើលឃើញ', JSON.stringify(switched));
                await page.evaluate(() => window.__kb.close());
                await settle(page);
                const closed = await page.evaluate(() => {
                    const r = document.querySelector('#manualAdjustModal .modal-content').getBoundingClientRect();
                    return { bodyClass: document.body.classList.contains('modal-keyboard'), content: [Math.round(r.top), Math.round(r.bottom)] };
                });
                check(!closed.bodyClass && Math.abs(closed.content[0] - base[0]) <= 1 && Math.abs(closed.content[1] - base[1]) <= 1,
                    'ទិសផ្ទុយ ៖ keyboard បិទ ➜ ដក body.modal-keyboard · ប្រអប់ត្រឡប់ទីតាំងដើម', JSON.stringify({ base, closed }));
                await page.evaluate(() => window.__kb.open(336, 0));
                await settle(page);
                await page.evaluate(() => closeModal('manualAdjustModal'));
                await settle(page);
                const afterClose = await page.evaluate(() => document.body.classList.contains('modal-keyboard'));
                check(afterClose === false, 'ទិសផ្ទុយ ៖ បិទប្រអប់ (keyboard នៅបើក) ➜ ដក body.modal-keyboard', String(afterClose));
                await page.evaluate(() => openModalHelper('editPhoneModal'));
                await settle(page);
                const opened = await page.evaluate(() => {
                    const r = document.querySelector('#editPhoneModal .modal-content').getBoundingClientRect();
                    const vv = window.visualViewport;
                    return { bodyClass: document.body.classList.contains('modal-keyboard'), inside: r.bottom <= vv.offsetTop + vv.height + 1 && r.top >= vv.offsetTop - 1 };
                });
                check(opened.bodyClass && opened.inside, 'បើកប្រអប់ខណៈ keyboard បើករួច (ឧ. ពីការស្វែងរក) ➜ ប្រអប់ចូលផ្ទៃមើលឃើញភ្លាម', JSON.stringify(opened));
                await page.evaluate(() => window.__kb.open(80, 0));
                await settle(page);
                const small = await page.evaluate(() => document.body.classList.contains('modal-keyboard'));
                check(small === false, 'ទិសផ្ទុយ ៖ គម្លាតតូចជាង KEYBOARD_MIN_INSET_PX (របា browser) ➜ មិនប្តូរ', String(small));
            }
            await ctx.close();
        }

        console.log('\n=== ទិសផ្ទុយ ៖ APK (WebView បង្រួម viewport ខ្លួនឯង) · គ្មាន visualViewport ក្លែង ===');
        {
            const size = { w: 390, h: 844 - 336 };
            const { ctx, page, ready } = await openApp(browser, port, size, false);
            if (ready) {
                await closeAll(page);
                await page.evaluate(() => openModalHelper('manualAdjustModal'));
                await settle(page);
                const apk = await page.evaluate(() => {
                    const r = document.querySelector('#manualAdjustModal .modal-content').getBoundingClientRect();
                    return { bodyClass: document.body.classList.contains('modal-keyboard'), bottom: Math.round(r.bottom), inner: window.innerHeight };
                });
                check(!apk.bodyClass && apk.bottom <= apk.inner + 1, 'APK ៖ viewport បង្រួម (innerHeight = visualViewport) ➜ មិនប្តូរ · ប្រអប់នៅក្នុងអេក្រង់ដូចដើម', JSON.stringify(apk));
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
