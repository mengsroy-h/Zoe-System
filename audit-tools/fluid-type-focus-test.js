// ថ្នាក់កំហុសដែលឧបករណ៍នេះចាក់សោ៖
//   ១. មាត្រដ្ឋានអក្សរបែកគ្នា — `font-size: Npx` ថេរដែលរអិលចូលវិញ នឹងនៅតូចដដែល
//      លើទូរស័ព្ទធំ ខណៈអក្សរជុំវិញវារីក ➜ អត្ថបទមួយកន្លែងតូចជាងគេដោយគ្មានហេតុផល។
//   ២. ការឡើងកំណែមាត្រដ្ឋានធ្វើឲ្យអក្សរ *តូចជាងមុន* នៅ 320px — ជាការថយក្រោយ
//      ដែលមើលមិនឃើញក្នុងតេស្ត layout ព្រោះវាមិនបង្កើតការលើសទទឹង។
//   ៣. `outline: none` ដោយគ្មានសញ្ញាផ្តោតជំនួស ➜ អ្នកប្រើក្តារចុច (និងម៉ាស៊ីនស្កេន
//      hardware ដែលជាឧបករណ៍ក្តារចុច) មិនដឹងថាកំពុងឈរលើប៊ូតុងណា។
// តេស្តនេះវាស់ **កូដដែល ship** ក្នុង Chromium ពិត — មិនមែនច្បាប់ចម្លងទេ។
let chromium;
try { chromium = require('playwright-core').chromium; } catch (e) {
    console.log('SKIP — ត្រូវការ playwright-core (npm i playwright-core)');
    process.exit(0);
}
const CHROME = process.env.LAYOUT_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const fs = require('fs');
const http = require('http');
const path = require('path');
if (!fs.existsSync(CHROME)) { console.log('SKIP — រកមិនឃើញ Chromium'); process.exit(0); }

const ROOT = process.env.FLUIDTYPE_APP_DIR || path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm' };

let pass = 0, fail = 0;
const ok = (n) => { console.log('  ok    ' + n); pass++; };
const bad = (n, d) => { console.log('  FAIL  ' + n + (d ? '\n        ' + d : '')); fail++; };
const check = (c, n, d) => (c ? ok(n) : bad(n, d));
const near = (a, b, tol) => Math.abs(a - b) <= (tol === undefined ? 0.06 : tol);

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

// ច្បាប់នេះមិនអនុវត្តលើទំព័របោះពុម្ព — `vw` នៅទីនោះជាទទឹងក្រដាស មិនមែនទទឹងអេក្រង់ទេ។
const PRINT_ONLY = /pdfExportPrintArea/;
const GROWTH_MAX = 1.1;
const FLOOR_WIDTH = 320;
const CAP_WIDTH = 430;
const DESKTOP_STEP = 1.2;
// ⛔ ការវាស់ «ឈប់រីក» ត្រូវធ្វើក្នុង **តំបន់ទូរស័ព្ទសុទ្ធ** (< 700px)។
// ជំនាន់មុនវាស់វានៅ 768/880 ➜ វា **ចាក់សោតំបន់ស្លាប់ ៤៣០–៩៩១px ទុក**៖
// ថេប្លេត 768px គូរអក្សរទំហំដូចទូរស័ព្ទ 430px បេះបិទ ខណៈអេក្រង់ធំជាង ៧៨%។
// នោះជាការអះអាងដែល **ចាក់សោកំហុស** មិនមែនការការពារ (មេរៀន 2.20.6)។
// អ្វីដែលវាការពារពិតគឺ «អក្សរមិនរីកគ្មានទីបញ្ចប់» — ការពារនោះនៅដដែល
// តាមរយៈ cap ក្នុងជំហាននីមួយៗ។
const PHONE_CAP_WIDTHS = [CAP_WIDTH, 560, 699];
const TABLET_WIDTHS = [768, 880];

const APPS = [
    {
        name: 'ZoeW', desktop: 992, tabletStep: 1.2,
        real: [
            { sel: 'body', px: 13 },
            { sel: '.brand-info h1', px: 14 },
            { sel: '.date-filter-btn', px: 10 },
            { sel: '.page-tab', px: 11.5 },
            { sel: '.card-title', px: 12 },
            { sel: '.search-box input', px: 14 },
            { sel: '.modal-content p', px: 11 }
        ],
        shadowRings: [{ id: 'securityPinInput' }, { id: 'hwScannerInput', tab: '#pageTabEntry' }]
    },
    {
        name: 'ZoeKeyGen', desktop: 900, tabletStep: null,
        real: [
            { sel: 'body', px: 13 },
            { sel: 'label', px: 11 },
            { sel: 'textarea', px: 11.5 },
            { sel: '.app-version-line', px: 10.5 },
            { sel: '.brand-logo', px: 15 }
        ],
        shadowRings: [{ id: 'newSecurityPinInput' }]
    }
];

function staticScan(app) {
    const file = path.join(ROOT, app.name, 'style.css');
    const css = fs.readFileSync(file, 'utf8');
    const lines = css.split('\n');
    const decl = /--fs-unit:\s*clamp\(([^,]+),([^,]+),([^)]+)\)/.exec(css);
    check(!!decl, app.name + '៖ `--fs-unit` ប្រកាសជា clamp() ក្នុង :root');
    if (decl) {
        check(decl[1].trim() === '1px', app.name + '៖ ជាន់ទាបនៃ --fs-unit ជា 1px (គ្មានការតូចជាងមុននៅ 320px)', 'ឃើញ ' + decl[1].trim());
        check(decl[3].trim() === GROWTH_MAX + 'px', app.name + '៖ ពិដាននៃ --fs-unit ជា ' + GROWTH_MAX + 'px', 'ឃើញ ' + decl[3].trim());
    }
    // ⛔ ការស្កេនតែ style.css ខកខានថ្នាក់កំហុសដដែល — `style="font-size:10px"` ក្នុង
    // index.html និងក្នុង template string របស់ app.js នៅក្រៅមាត្រដ្ឋានទាំងស្រុង។
    const strays = [];
    for (const rel of ['style.css', 'index.html', 'app.js']) {
        const f2 = path.join(ROOT, app.name, rel);
        if (!fs.existsSync(f2)) continue;
        fs.readFileSync(f2, 'utf8').split('\n').forEach((line, i) => {
            if (PRINT_ONLY.test(line)) return;
            if (/font-size:\s*[0-9.]+px/.test(line)) strays.push(rel + ':' + (i + 1) + ': ' + line.trim().slice(0, 62));
        });
    }
    check(strays.length === 0, app.name + '៖ គ្មាន `font-size` ថេរជា px ក្នុង style.css · index.html · app.js', strays.slice(0, 6).join('\n        '));
    const sizes = new Set();
    const re = /font-size:\s*calc\(([0-9.]+) \* var\(--fs-unit\)\)/g;
    let m;
    while ((m = re.exec(css))) sizes.add(Number(m[1]));
    check(sizes.size >= 8, app.name + '៖ មាត្រដ្ឋានគ្រប ' + sizes.size + ' ទំហំអក្សរផ្សេងគ្នា');
    return Array.from(sizes).sort((a, b) => a - b);
}

async function openApp(browser, app, width, height) {
    const ctx = await browser.newContext({ viewport: { width: width, height: height || 780 } });
    const page = await ctx.newPage();
    page.on('dialog', (d) => d.dismiss().catch(() => {}));
    await page.route('**', (r) => r.request().url().startsWith('http://127.0.0.1:' + app.port) ? r.continue() : r.abort());
    await page.goto('http://127.0.0.1:' + app.port + '/', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(1100);
    return { ctx: ctx, page: page };
}

const probeAt = (page, sizes) => page.evaluate((list) => {
    const probe = document.createElement('div');
    probe.style.position = 'absolute';
    probe.style.visibility = 'hidden';
    document.body.appendChild(probe);
    const out = {};
    list.forEach((n) => {
        probe.style.fontSize = 'calc(' + n + ' * var(--fs-unit))';
        out[n] = parseFloat(getComputedStyle(probe).fontSize);
    });
    probe.remove();
    return out;
}, sizes);

const readReal = (page, sels) => page.evaluate((list) => list.map((s) => {
    const el = document.querySelector(s);
    return el ? parseFloat(getComputedStyle(el).fontSize) : null;
}), sels);

async function tabSweep(page, steps) {
    const seen = [];
    for (let i = 0; i < steps; i++) {
        await page.keyboard.press('Tab');
        await page.waitForTimeout(220);
        const row = await page.evaluate(() => {
            const el = document.activeElement;
            if (!el || el === document.body || el === document.documentElement) return null;
            if (!el.matches(':focus-visible')) return null;
            const cs = getComputedStyle(el);
            const shadow = cs.boxShadow && cs.boxShadow !== 'none' && !/rgba\(0, 0, 0, 0\)/.test(cs.boxShadow);
            return {
                key: el.tagName + '#' + (el.id || '') + '.' + (el.className || '').toString().slice(0, 24),
                tag: el.tagName,
                outline: cs.outlineStyle !== 'none' ? parseFloat(cs.outlineWidth) : 0,
                shadow: shadow
            };
        });
        if (row) seen.push(row);
    }
    return seen;
}

(async () => {
    const browser = await chromium.launch({ executablePath: CHROME });
    for (const app of APPS) {
        console.log('\n=== ' + app.name + ' ===');
        const sizes = staticScan(app);
        const server = await serve(path.join(ROOT, app.name));
        app.port = server.address().port;

        // ក. ជាន់ទាប — 320px ត្រូវដូចមុនកែបេះបិទ (គ្មានការថយក្រោយ)
        let s = await openApp(browser, app, FLOOR_WIDTH, 568);
        const floor = await probeAt(s.page, sizes);
        const floorBad = sizes.filter((n) => !near(floor[n], n));
        check(floorBad.length === 0, app.name + '៖ គ្រប់ទំហំអក្សរស្មើតម្លៃដើមនៅ ' + FLOOR_WIDTH + 'px',
            floorBad.map((n) => n + 'px ➜ ' + floor[n]).join(', '));
        const realFloor = await readReal(s.page, app.real.map((r) => r.sel));
        app.real.forEach((r, i) => check(realFloor[i] !== null && near(realFloor[i], r.px),
            app.name + '៖ ' + r.sel + ' = ' + r.px + 'px នៅ ' + FLOOR_WIDTH + 'px', 'ឃើញ ' + realFloor[i]));
        await s.ctx.close();

        // ខ. កំណើន — ទូរស័ព្ទ 412px ត្រូវធំជាង តែមិនលើសពិដាន
        s = await openApp(browser, app, 412);
        const mid = await probeAt(s.page, sizes);
        const midBad = sizes.filter((n) => !(mid[n] > n * 1.05 && mid[n] < n * GROWTH_MAX));
        check(midBad.length === 0, app.name + '៖ អក្សររីកចន្លោះ ៥%–១០% នៅ 412px',
            midBad.map((n) => n + 'px ➜ ' + mid[n]).join(', '));
        const realMid = await readReal(s.page, app.real.map((r) => r.sel));
        app.real.forEach((r, i) => check(realMid[i] !== null && realMid[i] > r.px && realMid[i] <= r.px * GROWTH_MAX + 0.06,
            app.name + '៖ ' + r.sel + ' រីកនៅ 412px (' + r.px + ' ➜ ' + realMid[i] + ')'));

        // គ. សញ្ញាផ្តោតតាមក្តារចុច — គ្រប់ធាតុដែលចាប់ :focus-visible ត្រូវមើលឃើញ
        const swept = await tabSweep(s.page, 18);
        check(swept.length >= 4, app.name + '៖ Tab ឆ្លងកាត់ធាតុ ' + swept.length + ' ដែលចាប់ :focus-visible');
        const blind = swept.filter((r) => r.outline < 2 && !r.shadow);
        check(blind.length === 0, app.name + '៖ គ្រប់ធាតុដែលផ្តោតតាមក្តារចុច មានសញ្ញាមើលឃើញ',
            blind.map((r) => r.key).join(', '));
        const ringed = swept.filter((r) => r.tag === 'BUTTON' && r.outline >= 2);
        check(ringed.length >= 2, app.name + '៖ ប៊ូតុងពិត ' + ringed.length + ' ទទួលរង្វង់ outline ≥ 2px');

        // ឃ. ប្រអប់អត្ថបទដែលធ្លាប់មាន `outline: none` ស្អាតៗ ➜ ត្រូវមានរង្វង់ box-shadow
        for (const ring of app.shadowRings) {
            if (ring.tab) { await s.page.evaluate((sel) => document.querySelector(sel).click(), ring.tab); await s.page.waitForTimeout(450); }
            const got = await s.page.evaluate((elId) => {
                const el = document.getElementById(elId);
                if (!el) return { missing: true };
                const host = el.closest('.modal');
                if (host) host.style.display = 'flex';
                const unhidden = [];
                for (let n = el; n && n !== document.body; n = n.parentElement) {
                    if (n.classList.contains('hidden')) { n.classList.remove('hidden'); unhidden.push(n); }
                }
                el.focus();
                const live = document.activeElement === el;
                const cs = getComputedStyle(el);
                // ⚠️ CSSStyleDeclaration ជា **live** — ត្រូវថតតម្លៃមុន blur
                const shadow = cs.boxShadow && cs.boxShadow !== 'none' && !/rgba\(0, 0, 0, 0\)/.test(cs.boxShadow);
                const ring = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2;
                const raw = 'outline=' + cs.outlineWidth + '/' + cs.outlineStyle + ' shadow=' + cs.boxShadow;
                el.blur();
                unhidden.forEach((n) => n.classList.add('hidden'));
                if (host) host.style.display = '';
                return { live: live, focused: ring || shadow, raw: raw };
            }, ring.id);
            check(!got.missing && got.live && got.focused,
                app.name + '៖ #' + ring.id + ' បង្ហាញរង្វង់ផ្តោត', got.missing ? 'រកមិនឃើញធាតុ' : JSON.stringify(got));
        }

        // ង. ការចុចដោយម៉ៅស៍ មិនត្រូវទុករង្វង់ — នោះជាហេតុផលនៃ :focus-visible ធៀប :focus
        const box = await s.page.evaluate(() => {
            const b = document.createElement('button');
            b.type = 'button';
            b.id = 'fluidTypePointerProbe';
            b.textContent = 'probe';
            b.style.cssText = 'position:fixed;left:8px;top:200px;z-index:9999';
            document.body.appendChild(b);
            const r = b.getBoundingClientRect();
            return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        });
        await s.page.mouse.click(box.x, box.y);
        await s.page.waitForTimeout(150);
        const pointerRing = await s.page.evaluate(() => {
            const b = document.getElementById('fluidTypePointerProbe');
            const cs = getComputedStyle(b);
            const out = { focused: document.activeElement === b, fv: b.matches(':focus-visible'), w: cs.outlineStyle !== 'none' ? parseFloat(cs.outlineWidth) : 0 };
            b.remove();
            return out;
        });
        check(pointerRing.focused && !pointerRing.fv && pointerRing.w < 2,
            app.name + '៖ ការចុចដោយម៉ៅស៍មិនបន្សល់រង្វង់ផ្តោត', JSON.stringify(pointerRing));
        await s.ctx.close();

        // ច. ពិដានទូរស័ព្ទ — ចាប់ពី 430px ដល់ 699px ទំហំត្រូវឈប់រីក
        //    ⛔ តំបន់ `< 700px` ជា **តំបន់ហាមចូល** តាម CLAUDE.md — វាត្រូវ
        //    នៅដដែលបេះបិទ។ ការវាស់នេះទើបជាការការពារពិត។
        const capped = [];
        for (const w of PHONE_CAP_WIDTHS) {
            const c = await openApp(browser, app, w);
            capped.push(await probeAt(c.page, sizes));
            await c.ctx.close();
        }
        const capBad = sizes.filter((n) => !near(capped[0][n], n * GROWTH_MAX, 0.08)
            || !near(capped[1][n], capped[0][n]) || !near(capped[2][n], capped[0][n]));
        check(capBad.length === 0, app.name + '៖ ទំហំឈប់រីកក្នុងតំបន់ទូរស័ព្ទ ' + PHONE_CAP_WIDTHS.join('/') + 'px',
            capBad.map((n) => n + 'px ➜ ' + capped.map((c) => c[n]).join(' / ')).join(', '));

        // ចខ. ជំហានថេប្លេត — 700–991px ត្រូវធំជាងទូរស័ព្ទ តែឈប់រីកក្នុងជំហាននោះ
        const tablet = [];
        for (const w of TABLET_WIDTHS) {
            const c = await openApp(browser, app, w, 1024);
            tablet.push(await probeAt(c.page, sizes));
            await c.ctx.close();
        }
        if (app.tabletStep) {
            const tabBad = sizes.filter((n) => !near(tablet[0][n], n * app.tabletStep, 0.08) || !near(tablet[1][n], tablet[0][n]));
            check(tabBad.length === 0,
                app.name + '៖ អក្សរឡើងជំហាន ×' + app.tabletStep + ' នៅ ' + TABLET_WIDTHS.join('/') + 'px (ថេប្លេត) ហើយឈប់រីកក្នុងជំហាននោះ',
                tabBad.map((n) => n + 'px ➜ ' + tablet.map((t) => t[n]).join(' / ')).join(', '));
            check(sizes.every((n) => tablet[0][n] > capped[0][n] + 0.01),
                app.name + '៖ ⛔ ថេប្លេតធំជាងទូរស័ព្ទពិត (តំបន់ ' + CAP_WIDTH + '–991px លែងស្លាប់)');
        } else {
            const tabBad = sizes.filter((n) => !near(tablet[0][n], capped[0][n]) || !near(tablet[1][n], capped[0][n]));
            check(tabBad.length === 0,
                app.name + '៖ គ្មានជំហានថេប្លេត ➜ ' + TABLET_WIDTHS.join('/') + 'px ដូចទូរស័ព្ទដដែល',
                tabBad.map((n) => n + 'px ➜ ' + tablet.map((t) => t[n]).join(' / ')).join(', '));
        }
        const monotone = sizes.every((n) => floor[n] <= mid[n] + 0.01 && mid[n] <= capped[0][n] + 0.01);
        check(monotone, app.name + '៖ មាត្រដ្ឋានឡើងតាមលំដាប់ 320 ➜ 412 ➜ ' + CAP_WIDTH);

        // ជំហានទី ២ — ពេល layout បត់ជាជួរឈរច្រើន អក្សរត្រូវឡើងមួយកម្រិតទៀត
        const deskCtx = await openApp(browser, app, app.desktop, 900);
        const desk = await probeAt(deskCtx.page, sizes);
        await deskCtx.ctx.close();
        const deskBad = sizes.filter((n) => !near(desk[n], n * DESKTOP_STEP, 0.08));
        check(deskBad.length === 0, app.name + '៖ អក្សរឡើងជំហាន ×' + DESKTOP_STEP + ' នៅ ' + app.desktop + 'px (កន្លែងដែល layout បត់ជាជួរឈរច្រើន)',
            deskBad.map((n) => n + 'px ➜ ' + desk[n]).join(', '));
        check(sizes.every((n) => desk[n] > capped[0][n] + 0.01),
            app.name + '៖ ជំហាន desktop ធំជាងពិដានទូរស័ព្ទពិត');
        // ⛔ ការឆ្លងកាត់ព្រំដែនមិនត្រូវ **តូចវិញ** — មាត្រដ្ឋានត្រូវឡើងតាមលំដាប់
        check(sizes.every((n) => desk[n] >= tablet[0][n] - 0.01),
            app.name + '៖ មាត្រដ្ឋានឡើងតាមលំដាប់ ទូរស័ព្ទ ➜ ថេប្លេត ➜ desktop',
            sizes.filter((n) => desk[n] < tablet[0][n] - 0.01).map((n) => n + ': ' + tablet[0][n] + ' ➜ ' + desk[n]).join(', '));

        server.close();
    }
    await browser.close();
    console.log('\n' + (fail === 0 ? '✅ ជោគជ័យទាំងអស់ (' + pass + ')' : '❌ ធ្លាក់ ' + fail + ' (ជោគជ័យ ' + pass + ')'));
    process.exit(fail === 0 ? 0 : 1);
})();
