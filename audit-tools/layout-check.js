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

const ROOT = process.env.LAYOUT_APP_DIR || path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm' };
// ⛔ តំបន់ ៤៣០–៩៩១px ធ្លាប់ **គ្មានការវាស់សោះ** ក្រៅពី 768 ➜ ថេប្លេត
// iPad Pro (834) និងទូរស័ព្ទបង្វិលទទឹង (932×430 — កម្ពស់តូចជាងគេ) មិនដែល
// ត្រូវពិនិត្យ។ ទំហំបង្វិលទទឹងសំខាន់បំផុត ព្រោះកម្ពស់ត្រឹម 430px ជាកន្លែង
// ដែលការលើសបញ្ឈរលេចមុនគេ។
const SIZES = [{ w: 320, h: 568 }, { w: 360, h: 640 }, { w: 412, h: 780 }, { w: 768, h: 1024 },
               { w: 834, h: 1112 }, { w: 932, h: 430 }, { w: 1280, h: 800 }, { w: 1440, h: 900 }];

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

// ធាតុដែលមានហេតុផលឲ្យលើសទទឹង (តារាង/ដុំកូដ ដែលមាន overflow-x ផ្ទាល់ខ្លួន)
const ALLOW_OVERFLOW = /^(TABLE|PRE|CODE)$/;

// ⛔ តារាងរបាយការណ៍ខែត្រូវសាងដោយ JS ➜ ការផ្ទុក `index.html` ស្ងាត់ៗ **មិនដែល
// ឃើញវាសោះ** ➜ ការបំបែក CSS របស់វារស់នៅក្រៅការវាស់។ វាស់បាន (2.30.0) ៖
// `.mrep-table{width:100%}` ចាក់តារាងឲ្យស្មើកន្សោម ➜ `white-space:nowrap`
// ធ្វើឲ្យអត្ថបទ **ហៀរចេញក្រៅក្រឡា ជាន់លើគ្នា** ជំនួសការរមូរផ្តេក ➜ លេខលុយ
// អានមិនចេញ ខណៈ «modal សមនឹងអេក្រង់» នៅ **បៃតង** (ក្រឡាមិនលើសអេក្រង់ទេ)។
// ➜ ត្រូវចាក់ជួរដេកសាកល្បងចូល រួចវាស់ការហៀរ **ក្នុងមួយក្រឡា**។
function reportHeaders(root) {
    const f = path.join(root, 'ZoeW', 'app.js');
    if (!fs.existsSync(f)) return [];
    const m = /const MONTHLY_REPORT_HEADERS = \[([\s\S]*?)\];/.exec(fs.readFileSync(f, 'utf8'));
    if (!m) return [];
    return (m[1].match(/'([^']*)'/g) || []).map((x) => x.slice(1, -1));
}

// ⛔ ការអះអាង «គ្មានធាតុលើសអេក្រង់» ជាការអះអាង **ម្ខាង** — App ដែលនៅជាជួរឈរ
// ទទឹងទូរស័ព្ទលើកុំព្យូទ័រ ក៏ជាប់ដែរ។ ការត្រួតពិនិត្យខាងក្រោមជាខាងទីពីរ៖
// លើអេក្រង់ធំ layout ត្រូវ **ប្រើកន្លែងពិត** និង **បត់ទៅជាជួរឈរច្រើន**។
// (ZoeKeyGen ធ្លាប់នៅ 780px ជាមួយកាតជង់តែជួរតែមួយរហូតដល់កំណែ 2.16.0។)
const DESKTOP_MIN_CONTAINER = 900;
const DESKTOP = {
    ZoeW: { container: '.app-pages', card: '.app-card', reveal: [], hide: [] },
    ZoeKeyGen: { container: '.app-container', card: '.app-card', reveal: ['#appContainer'], hide: [] },
};

const cardRowsAt = (page, cfg) => page.evaluate((c) => {
    document.querySelectorAll('.modal').forEach((m) => { m.style.display = 'none'; });
    c.reveal.forEach((sel) => document.querySelectorAll(sel).forEach((el) => el.classList.remove('hidden')));
    c.hide.forEach((sel) => document.querySelectorAll(sel).forEach((el) => { el.style.display = 'none'; }));
    const host = document.querySelector(c.container);
    const cards = Array.from(document.querySelectorAll(c.card)).filter((el) => el.getBoundingClientRect().width > 0);
    const tops = new Set(cards.map((el) => Math.round(el.getBoundingClientRect().top)));
    return { width: host ? Math.round(host.getBoundingClientRect().width) : 0, cards: cards.length, rows: tops.size };
}, cfg);

(async () => {
    const browser = await chromium.launch({ executablePath: CHROME });
    for (const app of ['ZoeW', 'ZoeKeyGen']) {
        console.log('\n=== ' + app + ' ===');
        const dir = path.join(ROOT, app);
        const server = await serve(dir);
        const port = server.address().port;
        const shape = {};
        for (const size of SIZES) {
            const ctx = await browser.newContext({ viewport: { width: size.w, height: size.h } });
            const page = await ctx.newPage();
            page.on('dialog', (d) => d.dismiss().catch(() => {}));
            await page.route('**', (route) => route.request().url().startsWith('http://127.0.0.1:' + port) ? route.continue() : route.abort());
            await page.goto('http://127.0.0.1:' + port + '/', { waitUntil: 'domcontentloaded', timeout: 20000 });
            await page.waitForTimeout(1200);

            const report = await page.evaluate((allowSrc) => {
                const allow = new RegExp(allowSrc);
                const out = { pageScrollX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, offenders: [], tiny: [], modals: [] };
                const vw = document.documentElement.clientWidth;
                const seen = new Set();
                document.querySelectorAll('*').forEach((el) => {
                    const cs = getComputedStyle(el);
                    if (cs.display === 'none' || cs.visibility === 'hidden') return;
                    const r = el.getBoundingClientRect();
                    if (r.width === 0 && r.height === 0) return;
                    // លើសគែមស្តាំ ឬចេញក្រៅឆ្វេង
                    if ((r.right > vw + 1 || r.left < -1) && !allow.test(el.tagName)) {
                        let p = el.parentElement, scrollable = false;
                        while (p) {
                            const pcs = getComputedStyle(p);
                            if (/(auto|scroll)/.test(pcs.overflowX)) { scrollable = true; break; }
                            p = p.parentElement;
                        }
                        if (!scrollable) {
                            const key = el.tagName + '#' + (el.id || '') + '.' + (el.className || '').toString().slice(0, 40);
                            if (!seen.has(key)) { seen.add(key); out.offenders.push({ key, right: Math.round(r.right), vw }); }
                        }
                    }
                    // គោលដៅចុចតូចពេក (ប៊ូតុងពិត ដែលមើលឃើញ)
                    if ((el.tagName === 'BUTTON' || (el.tagName === 'A' && el.getAttribute('href'))) && r.width > 0 && (r.height < 24 || r.width < 24)) {
                        const key = el.tagName + '#' + (el.id || '') + '.' + (el.className || '').toString().slice(0, 30);
                        if (!seen.has('t' + key)) { seen.add('t' + key); out.tiny.push({ key, w: Math.round(r.width), h: Math.round(r.height) }); }
                    }
                });
                return out;
            }, ALLOW_OVERFLOW.source);

            const label = app + ' @' + size.w + 'px';
            check(!report.pageScrollX, label + ': គ្មាន scroll ផ្តេកលើទំព័រ');
            check(report.offenders.length === 0, label + ': គ្មានធាតុលើសទទឹងអេក្រង់',
                report.offenders.slice(0, 4).map((o) => o.key + ' right=' + o.right + ' vw=' + o.vw).join('\n        '));
            if (report.tiny.length) {
                console.log('  note  ' + label + ': ប៊ូតុងតូចជាង 24px ' + report.tiny.length + ' (ជម្រើសរចនា មិនរាប់ជាកំហុស)');
            }

            // modal នីមួយៗ ត្រូវបើកដាច់ដោយឡែក — នេះជាកន្លែងកំហុស CSS ធ្លាប់លាក់ខ្លួន
            const modalIds = await page.evaluate(() => [...document.querySelectorAll('.modal')].map((m) => m.id).filter(Boolean));
            const modalBad = [];
            for (const mid of modalIds) {
                const r = await page.evaluate((id) => {
                    const m = document.getElementById(id);
                    if (!m) return null;
                    const prevAll = [...document.querySelectorAll('.modal')].map((x) => [x, x.style.display, x.classList.contains('hidden')]);
                    prevAll.forEach(([x]) => { x.style.display = 'none'; });
                    const wasHidden = m.classList.contains('hidden');
                    if (wasHidden) m.classList.remove('hidden');
                    m.style.display = 'flex';
                    const vw = document.documentElement.clientWidth;
                    const vh = document.documentElement.clientHeight;
                    let over = null;
                    const box = m.querySelector('.modal-content') || m.firstElementChild;
                    m.querySelectorAll('*').forEach((el) => {
                        if (over) return;
                        const cs = getComputedStyle(el);
                        if (cs.display === 'none' || cs.visibility === 'hidden') return;
                        const b = el.getBoundingClientRect();
                        if (b.width === 0 && b.height === 0) return;
                        if (b.right > vw + 1 || b.left < -1) {
                            let p = el.parentElement, scrollable = false;
                            while (p && p !== m) {
                                if (/(auto|scroll)/.test(getComputedStyle(p).overflowX)) { scrollable = true; break; }
                                p = p.parentElement;
                            }
                            if (!scrollable) over = el.tagName + '#' + (el.id || '') + '.' + String(el.className || '').slice(0, 30) + ' right=' + Math.round(b.right) + '/' + vw;
                        }
                    });
                    // ប្រអប់ត្រូវនៅក្នុងអេក្រង់ ហើយអាចរមូរបាន បើវាខ្ពស់ជាង
                    let boxIssue = null;
                    if (box) {
                        const bb = box.getBoundingClientRect();
                        if (bb.top < -1) boxIssue = 'ផ្នែកខាងលើចេញក្រៅអេក្រង់ top=' + Math.round(bb.top);
                        else if (bb.height > vh + 1 && !/(auto|scroll)/.test(getComputedStyle(box).overflowY)) boxIssue = 'ខ្ពស់ជាងអេក្រង់ តែរមូរមិនបាន h=' + Math.round(bb.height) + '/' + vh;
                    }
                    prevAll.forEach(([x, d, h]) => { x.style.display = d; if (h) x.classList.add('hidden'); });
                    if (wasHidden) m.classList.add('hidden');
                    return { over, boxIssue };
                }, mid);
                if (r && r.over) modalBad.push(mid + ' ➜ លើសទទឹង: ' + r.over);
                if (r && r.boxIssue) modalBad.push(mid + ' ➜ ' + r.boxIssue);
            }
            check(modalBad.length === 0, label + ': modal ទាំងអស់សមនឹងអេក្រង់', modalBad.slice(0, 5).join('\n        '));

            // ⛔ របា Tab ខាងក្រោម (ZoeKeyGen ទូរស័ព្ទ) ៖ toast ត្រូវឈរ **ខាងលើ** របា — មិនមែនពីក្រោយវា (វាស់ធរណីមាត្រពិត
            //    មិនមែនលំដាប់ CSS ៖ ច្បាប់ `@media` ដែលឈរមុនច្បាប់មូលដ្ឋាន ស្លាប់ស្ងាត់ៗ ➜ toast លិចក្រោមរបា)
            const tabOverlap = await page.evaluate(() => {
                const bar = document.getElementById('kgTabBar');
                if (!bar) return { skip: true };
                const app = document.getElementById('appContainer');
                const wasHidden = app && app.classList.contains('hidden');
                if (wasHidden) app.classList.remove('hidden');
                const host = document.getElementById('toastContainer') || document.querySelector('.toast-container');
                if (!host) { if (wasHidden) app.classList.add('hidden'); return { skip: true, why: 'គ្មាន .toast-container' }; }
                const probe = document.createElement('div');
                probe.className = 'toast show';
                probe.textContent = 'probe';
                host.appendChild(probe);
                const barRect = bar.getBoundingClientRect();
                const visible = getComputedStyle(bar).display !== 'none' && barRect.height > 0;
                const t = probe.getBoundingClientRect();
                probe.remove();
                if (wasHidden) app.classList.add('hidden');
                return { visible, toastBottom: Math.round(t.bottom), barTop: Math.round(barRect.top) };
            });
            if (!tabOverlap.skip && tabOverlap.visible) {
                check(tabOverlap.toastBottom <= tabOverlap.barTop + 1, label + ': toast ឈរខាងលើរបា Tab (មិនលិចក្រោមវា)', tabOverlap);
            }

            if (app === 'ZoeW') {
                const headers = reportHeaders(ROOT);
                const cellR = headers.length ? await page.evaluate((hs) => {
                    const body = document.getElementById('monthlyReportBody');
                    const modal = document.getElementById('monthlyReportModal');
                    if (!body || !modal) return { skip: true };
                    const prevAll = [...document.querySelectorAll('.modal')].map((x) => [x, x.style.display]);
                    prevAll.forEach(([x]) => { x.style.display = 'none'; });
                    modal.style.display = 'flex';
                    const prevBody = body.innerHTML;
                    const cell = (i) => (i === 0 ? '2026-09-01' : (i === hs.length - 1 || i === hs.length - 2 ? '122' : '$1,234.56'));
                    const row = '<tr>' + hs.map((h, i) => '<td>' + cell(i) + '</td>').join('') + '</tr>';
                    body.innerHTML = '<div class="mrep-table-wrap"><table class="mrep-table"><thead><tr>'
                        + hs.map((h) => '<th>' + h + '</th>').join('') + '</tr></thead><tbody>' + row + row + '</tbody></table></div>';
                    const wrap = body.querySelector('.mrep-table-wrap');
                    const table = body.querySelector('.mrep-table');
                    const cells = [...body.querySelectorAll('.mrep-table th, .mrep-table td')];
                    const clipped = cells.filter((c) => c.scrollWidth > c.clientWidth + 1)
                        .map((c) => (c.textContent || '').slice(0, 14) + ' ' + c.scrollWidth + '>' + c.clientWidth);
                    const needsScroll = Math.round(table.getBoundingClientRect().width) > wrap.clientWidth + 1;
                    const canScroll = /(auto|scroll)/.test(getComputedStyle(wrap).overflowX);
                    body.innerHTML = prevBody;
                    prevAll.forEach(([x, d]) => { x.style.display = d; });
                    return { clipped, needsScroll, canScroll, cols: hs.length };
                }, headers) : { skip: true };
                if (cellR.skip) {
                    check(false, label + ': វាស់តារាងរបាយការណ៍ខែបាន', 'រក MONTHLY_REPORT_HEADERS ឬ #monthlyReportBody មិនឃើញ');
                } else {
                    check(cellR.clipped.length === 0,
                        label + ': ⛔ ក្រឡាតារាងរបាយការណ៍ (' + cellR.cols + ' ជួរឈរ) មិនហៀរជាន់គ្នា',
                        cellR.clipped.slice(0, 4).join('\n        '));
                    check(!cellR.needsScroll || cellR.canScroll,
                        label + ': តារាងរបាយការណ៍ធំជាងកន្សោម ➜ ត្រូវរមូរផ្តេកបាន');
                }
            }

            if (DESKTOP[app] && (size.w === 412 || size.w === 1280 || size.w === 1440)) {
                shape[size.w] = await cardRowsAt(page, DESKTOP[app]);
            }

            await ctx.close();
        }

        if (DESKTOP[app] && shape[412]) {
            for (const w of [1280, 1440]) {
                const d = shape[w];
                check(d && d.width >= DESKTOP_MIN_CONTAINER,
                    app + ' @' + w + 'px: ខ្លឹមសារប្រើទទឹងយ៉ាងតិច ' + DESKTOP_MIN_CONTAINER + 'px',
                    d ? 'ឃើញ ' + d.width + 'px — App នៅជាជួរឈរទទឹងទូរស័ព្ទ' : 'វាស់មិនបាន');
                check(d && d.cards > 1 && d.cards >= shape[412].cards && d.rows < d.cards,
                    app + ' @' + w + 'px: កាតបត់ជាជួរឈរច្រើន (កាត ' + (d ? d.cards : '?') + ' ➜ ' + (d ? d.rows : '?') + ' ជួរដេក)',
                    d ? 'កាត ' + d.cards + ' នៅជួរដេក ' + d.rows + ' (ជួរឈរតែមួយ)' : 'វាស់មិនបាន');
            }
        }
        // ⛔ ការគ្រប់គ្រងក្នុងប្រអប់ ៖ `min-height: 46px` របស់កំណែ 2.22.2 ត្រូវ
        // អនុវត្តលើ **ប្រអប់វាយអត្ថបទ** ប៉ុណ្ណោះ។ `.remember-container
        // input[type=checkbox]` ប្រកាស `height: 16px` តែ **មិនប្រកាស
        // `min-height`** ➜ `min-height: 46px` ឈ្នះ ➜ checkbox លាតជា
        // **១៦ × ៤៦px** ➜ ជួរឃ្លាតគ្នាឆ្ងាយ (របាយការណ៍អ្នកប្រើ 2026-08-29)។
        // ហើយ `.trash-search-box input` ធ្លាប់ឈរ **មុន** `.modal-content input`
        // ➜ specificity ដូចគ្នា តែលំដាប់ចាញ់ ➜ ច្បាប់ទាំងអស់ស្លាប់ ➜
        // input រក្សា background + border-radius ➜ **ប្រអប់ក្នុងប្រអប់**។
        if (app === 'ZoeW') {
            const ctx = await browser.newContext({ viewport: { width: 412, height: 900 } });
            const page = await ctx.newPage();
            await page.goto('http://127.0.0.1:' + port + '/', { waitUntil: 'domcontentloaded', timeout: 20000 });
            await page.waitForTimeout(600);
            const ui = await page.evaluate(() => {
                const out = {};
                const cb = document.getElementById('lookupApiEnabledCheckbox');
                if (cb) {
                    const m = cb.closest('.modal');
                    if (m) { m.style.display = 'flex'; m.classList.add('active'); }
                    const r = cb.getBoundingClientRect();
                    out.cbW = r.width; out.cbH = r.height;
                    out.cbMinH = getComputedStyle(cb).minHeight;
                    if (m) { m.classList.remove('active'); m.style.display = ''; }
                }
                const box = document.querySelector('.trash-search-box');
                const inp = document.getElementById('deletedSearchInput');
                if (box && inp) {
                    const m = box.closest('.modal');
                    if (m) { m.style.display = 'flex'; m.classList.add('active'); }
                    const bs = getComputedStyle(box), is = getComputedStyle(inp);
                    out.inpBg = is.backgroundColor;
                    out.boxBg = bs.backgroundColor;
                    out.inpRadius = parseFloat(is.borderTopLeftRadius) || 0;
                    out.inpBorder = parseFloat(is.borderTopWidth) || 0;
                    out.inpAlign = is.textAlign;
                    out.boxMinH = parseFloat(bs.minHeight) || 0;
                    if (m) { m.classList.remove('active'); m.style.display = ''; }
                }
                return out;
            });
            await ctx.close();
            check(ui.cbH !== undefined, 'ZoeW: រកឃើញ checkbox ក្នុងប្រអប់ API', 'រកមិនឃើញ ➜ តេស្តនេះមិនបានពិនិត្យអ្វីសោះ');
            if (ui.cbH !== undefined) {
                // ⛔ ការវាស់ធ្វើក្រោមចលនាបើកប្រអប់ (scale .95) ➜ ប្រើអនុបាត
                check(Math.abs(ui.cbH - ui.cbW) <= 3,
                    'ZoeW: checkbox ជាការេ (មិនត្រូវលាតដោយ min-height ៤៦px)',
                    'ទំហំ ' + Math.round(ui.cbW) + '×' + Math.round(ui.cbH) + 'px · min-height=' + ui.cbMinH);
                check(ui.cbH <= 24,
                    'ZoeW: កម្ពស់ checkbox <= 24px',
                    'ឃើញ ' + Math.round(ui.cbH) + 'px ➜ ជួរឃ្លាតគ្នាឆ្ងាយពេក');
            }
            check(ui.inpBg !== undefined, 'ZoeW: រកឃើញប្រអប់ស្វែងរកធុងសំរាម');
            if (ui.inpBg !== undefined) {
                check(ui.inpBg === 'rgba(0, 0, 0, 0)' || ui.inpBg === 'transparent',
                    '⛔ ZoeW: input ស្វែងរកធុងសំរាមត្រូវថ្លា (គ្មានប្រអប់ក្នុងប្រអប់)',
                    'background=' + ui.inpBg + ' ធៀបនឹងស្រោម ' + ui.boxBg);
                check(ui.inpRadius === 0 && ui.inpBorder === 0,
                    '⛔ ZoeW: input នោះគ្មានគែម និងគ្មានជ្រុងមូលផ្ទាល់ខ្លួន',
                    'radius=' + ui.inpRadius + ' border=' + ui.inpBorder);
                check(ui.inpAlign === 'left',
                    'ZoeW: អត្ថបទស្វែងរកតម្រឹមឆ្វេង (ច្បាប់ចាស់ត្រូវបានស្លាប់ដោយលំដាប់)',
                    'text-align=' + ui.inpAlign);
                check(ui.boxMinH >= 44,
                    'ZoeW: ស្រោមស្វែងរករក្សាគោលដៅប៉ះ >= 44px (ច្បាប់ 2.22.2)',
                    'min-height=' + ui.boxMinH);
            }
        }

        server.close();
    }
    await browser.close();
    console.log('\n' + (fail ? 'FAIL ' + fail + ' / ជោគជ័យ ' + pass : 'PASS ' + pass + '/' + pass));
    process.exit(fail ? 1 : 0);
})();
