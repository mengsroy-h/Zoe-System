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

// Setup Link ប្រវែងពិត ៖ Config Firebase ពេញ + DSN ➜ ~៧០០ តួ ➜ QR ~៩០ module (ទំហំដែលអតិថិជនពិតទទួល)
const QR_PROBE = {
    base: 'https://zoew-shop.netlify.app',
    config: JSON.stringify({ apiKey: 'AIza' + 'Sy' + 'x'.repeat(33), authDomain: 'zoe-shop-123.firebaseapp.com',
        databaseURL: 'https://zoe-shop-123-default-rtdb.asia-southeast1.firebasedatabase.app', projectId: 'zoe-shop-123',
        storageBucket: 'zoe-shop-123.appspot.com', messagingSenderId: '123456789012', appId: '1:123456789012:web:' + 'a'.repeat(22) }),
    dsn: 'https://' + 'b'.repeat(32) + '@o123456.ingest.sentry.io/1234567',
    inviteLink: 'https://zoew-shop.netlify.app/?setup=' + Buffer.from(JSON.stringify({ supabaseUrl: 'https://abcdefghijklmnopqrst.supabase.co',
        supabaseKey: 'sb_publishable_' + 'k'.repeat(30), invite: 'ABCD-EFGH-IJKL-MNOP-QRST' })).toString('base64')
};
const QR_PROBE_TEXT = QR_PROBE.base + '/?setup=' + Buffer.from(QR_PROBE.config).toString('base64') + 'x'.repeat(120);

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

// ⛔ ជួរប្រវត្តិមានទិន្នន័យ (របាយការណ៍ម្ចាស់គម្រោង ៖ «ប៊ូតុង ខល នៅពីលើ កញ្ចប់សរុប»)។ ការវាស់ខាងលើផ្ទុក App **ទទេ**
// ➜ ជួរដេកមិនដែលត្រូវវាស់ ៖ ប៊ូតុងសកម្មភាព (`white-space: nowrap`) ហៀរចេញពីក្រឡារបស់វា ហើយជាន់ «កញ្ចប់សរុប»
// (22×21px នៅ 320) · ស្លាកលេខរៀង (`min-width: 20px` ក្នុងជួរឈរ 6%) ជាន់លេខទូរស័ព្ទ ១–៤px ពេលលេខ ៣ ខ្ទង់។
// វាស់ដូចម្រាមដៃ ៖ `elementFromPoint` លើគែម «កញ្ចប់សរុប» និងកណ្តាលប៊ូតុងនីមួយៗ ត្រូវឃើញធាតុនោះផ្ទាល់ · ការចុចពិត
// (Playwright បដិសេធពេលធាតុផ្សេងបាំង) ➜ ប្រអប់បញ្ជីកញ្ចប់ · ប្រភពកញ្ចប់ (`origins`) ៖ នៅក្នុងក្រឡា · មិនជាន់ធាតុជិតខាង ·
// មិនពង្រីកជួរឈរ · អត្ថបទវែងកាត់ (…)។ ⛔ ទទឹង ≥992 ៖ ប៊ូតុងហៀរចេញពីក្រឡាខ្លួនចូលកន្លែងទំនេរ (មានតាំងពីមុន ·
// គ្មានការជាន់) ➜ អះអាង «មិនជាន់» គ្រប់ទទឹង តែ «នៅក្នុងក្រឡាខ្លួន» សម្រាប់ទូរស័ព្ទ (< 700)។
const HISTORY_ROW_WIDTHS = [320, 340, 360, 375, 390, 412, 430, 480, 600, 699, 700, 768, 991, 992, 1024, 1100, 1280];
const HISTORY_ROW_PROBE = async (big) => {
    const day = '2026-10-06';
    const LONG = 'សាខាផ្សេងទៀតដែលមិនមែនចិន ឬវៀតណាម ផ្លូវលេខ ២៧១ សង្កាត់ទួលទំពូង ខណ្ឌចំការមន ភ្នំពេញ';
    const mk = (id, extra, origins) => Object.assign({ id, phone: '0960007345', scanDate: day, time: '09:00:00 (' + day + ')',
        createdAt: Date.now(), cod: 3, dod: 0, count: 3, isClosed: false,
        barcodes: [1, 2, 3].map((j) => ({ code: 'ZT' + id + '00' + j, cod: 1, dod: 0, isClosed: false })) }, extra, origins ? { origins } : {});
    const kinds = [
        ['A', { dod: 2.5, barcodes: [1, 2, 3].map((j) => ({ code: 'ZTA00' + j, cod: 1, dod: j === 1 ? 2.5 : 0, isClosed: false })) }, null],
        ['B', { cod: 1234.56, barcodes: [1, 2, 3].map((j) => ({ code: 'ZTB00' + j, cod: j === 1 ? 1232.56 : 1, dod: 0, isClosed: false })) },
            { ZTB001: 'ZTO ឃ្លាំងក្វាងចូវអន្តរជាតិ', ZTB002: 'ZTO ឃ្លាំងក្វាងចូវអន្តរជាតិ' }],
        ['C', { isCalled: true }, { ZTC001: 'Shopee SHPE' }],
        ['D', { isCalled: true, isClosed: true }, { ZTD001: 'Shopee SHPE', ZTD002: 'ZTO ឃ្លាំងក្វាងចូវអន្តរជាតិ' }],
        ['E', { isCalled: true, callMark: 'wrong-number' }, { ZTE001: LONG }],
        ['F', { isCalled: true, callMark: 'no-answer', cod: 987.65, dod: 245.5, barcodes: [1, 2, 3].map((j) => ({ code: 'ZTF00' + j, cod: j === 1 ? 985.65 : 1, dod: j === 2 ? 245.5 : 0, isClosed: false })) },
            { ZTF001: 'ZTO ឃ្លាំងក្វាងចូវអន្តរជាតិ' }]
    ];
    const extra = big ? Array.from({ length: 114 }, (_, i) => mk('G' + i, i % 3 ? {} : { isCalled: true, callMark: i % 2 ? 'no-answer' : 'wrong-number' }, null)) : [];
    const plain = kinds.map(([id, x]) => mk(id, x, null)).concat(extra);
    const rich = kinds.map(([id, x, o]) => mk(id, x, o)).concat(extra);
    const R = (el) => el.getBoundingClientRect();
    const cut = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5;
    const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const paint = async (items) => {
        window.scanHistory = items;
        renderHistory(items, 'layout-' + Math.random());
        await new Promise((r) => setTimeout(r, 150));
        document.querySelectorAll('.modal').forEach((m) => { m.style.display = 'none'; });
        return Array.from(document.querySelectorAll('#historyTableBody tr[data-id]'));
    };
    const widthsOf = (rows) => rows.map((tr) => Array.from(tr.children).map((td) => Math.round(R(td).width)).join(','));
    const contentBox = (el) => {
        const r = R(el), cs = getComputedStyle(el);
        return { left: r.left + parseFloat(cs.borderLeftWidth) + parseFloat(cs.paddingLeft), right: r.right - parseFloat(cs.borderRightWidth) - parseFloat(cs.paddingRight) };
    };
    const textBoxes = (el) => { const rg = document.createRange(); rg.selectNodeContents(el); return Array.from(rg.getClientRects()).filter((q) => q.width > 0.5); };
    const lineSkew = (cell, boxes) => {
        const box = contentBox(cell);
        const lines = new Map();
        boxes.forEach((q) => {
            const key = Math.round((q.top + q.bottom) / 2);
            const near = Array.from(lines.keys()).find((k) => Math.abs(k - key) <= 3);
            const at = near === undefined ? key : near;
            const line = lines.get(at) || { left: Infinity, right: -Infinity };
            line.left = Math.min(line.left, q.left);
            line.right = Math.max(line.right, q.right);
            lines.set(at, line);
        });
        if (!lines.size) return Infinity;
        return Math.max(...Array.from(lines.values()).map((l) => Math.abs((l.left - box.left) - (box.right - l.right))));
    };
    const rowSkew = (cell, boxes) => {
        const box = contentBox(cell);
        const groups = [];
        boxes.slice().sort((a, b) => a.top - b.top).forEach((q) => {
            const g = groups.find((x) => Math.min(x.bottom, q.bottom) - Math.max(x.top, q.top) > 0.5);
            if (g) { g.left = Math.min(g.left, q.left); g.right = Math.max(g.right, q.right); g.top = Math.min(g.top, q.top); g.bottom = Math.max(g.bottom, q.bottom); }
            else groups.push({ left: q.left, right: q.right, top: q.top, bottom: q.bottom });
        });
        if (!groups.length) return Infinity;
        return Math.max(...groups.map((l) => Math.abs((l.left - box.left) - (box.right - l.right))));
    };
    const plainRows = await paint(plain);
    const plainWidths = widthsOf(plainRows);
    const plainHeights = plainRows.map((tr) => R(tr).height);
    const rows = await paint(rich);
    const head = document.querySelector('.history-table thead th:nth-child(3)');
    const out = { rows: rows.length, oldButtons: document.querySelectorAll('#historyTableBody .btn-view-list').length,
        widthsChanged: widthsOf(rows).filter((w, i) => w !== plainWidths[i]).length, rowList: [],
        headText: head ? head.textContent : null, headSkew: head ? Math.round(lineSkew(head, textBoxes(head)) * 10) / 10 : null,
        colSkew: head ? Math.round(Math.abs((R(head).left + R(head).right) / 2 - (R(head.parentElement).left + R(head.parentElement).right) / 2) * 10) / 10 : null };
    const limit = big ? Math.min(rows.length, 12) : rows.length;
    for (let i = 0; i < limit; i++) {
        const tr = rows[i];
        tr.scrollIntoView({ block: 'center' });
        await frame();
        const hitsSelf = (el, x, y) => { const h = document.elementFromPoint(x, y); return !!h && (h === el || el.contains(h)); };
        const [numTd, custTd, priceTd, actTd] = Array.from(tr.children);
        const badge = priceTd.querySelector('.count-badge');
        const b = R(badge);
        const btns = Array.from(actTd.querySelectorAll('.action-group > *'));
        const priceEls = Array.from(priceTd.querySelectorAll('*')).filter((e) => !e.children.length || e.matches('.count-badge, .locker-badge'));
        const custLeaves = Array.from(custTd.querySelectorAll('*')).filter((e) => !e.children.length);
        const mark = numTd.querySelector('.row-num-mark');
        const range = document.createRange();
        range.selectNodeContents(numTd);
        const numBox = mark ? R(mark) : range.getBoundingClientRect();
        const chip = custTd.querySelector('.origin-chip');
        const row = {
            id: tr.dataset.id,
            badgeTag: badge.tagName,
            badgeClear: [b.left + 2, (b.left + b.right) / 2, b.right - 2].every((x) => hitsSelf(badge, x, (b.top + b.bottom) / 2)),
            buttonsClear: btns.every((x) => { const q = R(x); return hitsSelf(x, (q.left + q.right) / 2, (q.top + q.bottom) / 2); }),
            buttonsHitPrice: btns.some((x) => priceEls.some((e) => cut(R(x), R(e)))),
            buttonsInCell: btns.every((x) => R(x).left >= R(actTd).left - 0.5 && R(x).right <= R(actTd).right + 0.5),
            buttonsOneLine: new Set(btns.map((x) => Math.round(R(x).top))).size === 1,
            buttonPad: btns.map((x) => { const cs = getComputedStyle(x); return cs.paddingLeft + '/' + cs.paddingRight + '/' + Math.round(R(x).height); }).join(' '),
            buttonsFull: btns.length > 0 && btns.every((x) => { const cs = getComputedStyle(x); return cs.paddingLeft === '10px' && cs.paddingRight === '10px' && R(x).height >= 37.5; }),
            priceInCell: Array.from(priceTd.querySelectorAll('.price-stack *')).every((e) => { const q = R(e); return q.width < 0.5 || (q.left >= R(priceTd).left - 0.5 && q.right <= R(priceTd).right + 0.5); })
                && Array.from(priceTd.querySelectorAll('.price-figures > *')).flatMap(textBoxes).every((q) => q.left >= R(priceTd).left - 0.5 && q.right <= R(priceTd).right + 0.5),
            moneyWhole: Array.from(priceTd.querySelectorAll('.price-figures strong')).every((e) => new Set(Array.from(e.getClientRects()).map((q) => Math.round((q.top + q.bottom) / 2))).size === 1),
            bigMoney: /1234\.56|987\.65/.test(priceTd.textContent),
            priceSkew: Math.round(Math.max(
                rowSkew(priceTd, Array.from(priceTd.querySelectorAll('.price-stack > *')).map(R)),
                ...Array.from(priceTd.querySelectorAll('.price-figures')).map((f) => lineSkew(f, Array.from(f.children).flatMap(textBoxes)))) * 10) / 10,
            fixPhone: !!actTd.querySelector('.fix-phone-btn'),
            numberHitsCustomer: custLeaves.some((e) => cut(numBox, R(e))),
            grew: Math.round(R(tr).height - plainHeights[i])
        };
        if (chip) {
            const c = R(chip);
            const text = chip.querySelector('.origin-chip-text');
            const line = chip.closest('.origin-line');
            const siblings = Array.from(line.parentElement.children).filter((e) => e !== line);
            row.chip = {
                text: chip.textContent,
                inCell: c.left >= R(custTd).left - 0.5 && c.right <= R(custTd).right + 0.5,
                hitsSibling: siblings.some((e) => cut(c, R(e))),
                cut: text.scrollWidth > text.clientWidth + 1,
                oneLine: Math.round(Math.max(...siblings.map((e) => R(e).height), R(line).height)
                    + (parseFloat(getComputedStyle(line.parentElement).rowGap) || 0))
            };
        }
        out.rowList.push(row);
    }
    return out;
};

// ⛔ UI-7 ៖ ប្រអប់ PIN លើកុំព្យូទ័រ ៖ បើក ➜ cursor នៅក្នុងវាល PIN · វាយ + Enter ➜ ផ្ទៀងផ្ទាត់ (ដូចប៊ូតុង) · ទូរស័ព្ទ (UA) ➜ មិន focus ស្វ័យប្រវត្តិ
//    (keyboard មិនលោតឡើងគ្របប៊ូតុងក្រយៅដៃ)។ ទំព័រស្រស់ (app-lock-test ៖ Chromium ឈប់បញ្ជូន input ពិតក្រោយវដ្តចាកចេញ/ត្រឡប់)។
async function pinEnterSubmits(browser, port) {
    const open = async (ua) => {
        const ctx = await browser.newContext(Object.assign({ viewport: { width: 1280, height: 800 } }, ua ? { userAgent: ua } : {}));
        const page = await ctx.newPage();
        page.on('dialog', (d) => d.dismiss().catch(() => {}));
        await page.route('**', (route) => route.request().url().startsWith('http://127.0.0.1:' + port) ? route.continue() : route.abort());
        await page.goto('http://127.0.0.1:' + port + '/', { waitUntil: 'domcontentloaded', timeout: 20000 });
        await page.waitForTimeout(800);
        const ready = await page.evaluate(async () => {
            if (typeof requestPinBeforeConfig !== 'function' || typeof hashPin !== 'function') return false;
            localStorage.setItem('zoew_security_pin_hash', await hashPin('246802'));
            window.__pinOk = 0;
            requestPinBeforeConfig(() => { window.__pinOk = 1; }, 'config');
            return true;
        });
        return { ctx, page, ready };
    };
    const desk = await open(null);
    check(desk.ready, 'ZoeW ប្រអប់ PIN ៖ មាន requestPinBeforeConfig · hashPin (audit build)');
    if (desk.ready) {
        const focused = await desk.page.evaluate(() => (document.activeElement || {}).id || '');
        check(focused === 'securityPinInput', '⛔ ZoeW ប្រអប់ PIN ៖ កុំព្យូទ័រ ➜ បើកហើយ cursor នៅក្នុងវាល PIN ភ្លាម', focused);
        await desk.page.fill('#securityPinInput', '246802', { timeout: 6000 });
        await desk.page.press('#securityPinInput', 'Enter', { timeout: 6000 });
        let res = null;
        for (let i = 0; i < 30; i++) {
            await desk.page.waitForTimeout(200);
            res = await desk.page.evaluate(() => ({ ok: window.__pinOk, open: getComputedStyle(document.getElementById('pinModal')).display !== 'none' }));
            if (res.ok) break;
        }
        check(!!res && res.ok === 1 && res.open === false, '⛔ ZoeW ប្រអប់ PIN ៖ វាយ PIN + Enter ➜ ផ្ទៀងផ្ទាត់ ហើយបិទប្រអប់', JSON.stringify(res));
    }
    await desk.ctx.close();
    const phone = await open('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36');
    if (phone.ready) {
        const focused = await phone.page.evaluate(() => (document.activeElement || {}).id || '');
        check(focused !== 'securityPinInput', 'ZoeW ប្រអប់ PIN ៖ ទិសផ្ទុយ ៖ ទូរស័ព្ទ ➜ មិន focus ស្វ័យប្រវត្តិ (keyboard មិនលោត)', focused);
    }
    await phone.ctx.close();
}

// ⛔ UI-5/UI-6 ៖ ជួរ 🔔 «ជិតផុតកំណត់» · «ដករួច» ត្រូវបង្ហាញ Locker ពេញ (ទីតាំងសម្រាប់ទៅយកកញ្ចប់ចេញពីទូ) ៖ ព័ត៌មានបត់បន្ទាត់ មិនកាត់ «…» ·
//    ជួរមិនលើសផ្ទាំង។ វាស់ `scrollWidth`/`clientWidth` ក្នុង browser ពិតលើទូរស័ព្ទ ៣២០ · ៤១២។
async function notifyRowLayout(browser, port) {
    const ctx = await browser.newContext({ viewport: { width: 412, height: 900 } });
    const page = await ctx.newPage();
    page.on('dialog', (d) => d.dismiss().catch(() => {}));
    await page.route('**', (route) => route.request().url().startsWith('http://127.0.0.1:' + port) ? route.continue() : route.abort());
    await page.goto('http://127.0.0.1:' + port + '/', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(800);
    const ready = await page.evaluate(() => !!window.uiState);
    check(ready, 'ZoeW ជួរ 🔔 ៖ មាន uiState (audit build)');
    if (!ready) { await ctx.close(); return; }
    const LOCKER = 'ទូ A-12 · ជាន់ទី ៣ · ច្រកខាងឆ្វេង';
    const ROWS = 50;
    await page.evaluate(({ locker, n }) => {
        const rows = [{ key: 'r1', phone: '0961234567', locker, count: 12, isNew: true, hoursAgo: 3 }];
        for (let i = 1; i < n; i++) rows.push({ key: 'r' + (i + 1), phone: '09700' + String(10000 + i), locker: 'B-' + i, count: 1, isNew: false, hoursAgo: 4 + i });
        window.uiState.notifyRemovedView = { measurable: true, emptyText: '', packages: 11 + n, customers: n, unseen: 12, rows };
        window.uiState.notifyDrawerOpen = true;
    }, { locker: LOCKER, n: ROWS });
    // ⛔ សំណើម្ចាស់គម្រោង ៖ «📤 កញ្ចប់ដែលដករួច» ជាក្រុមពន្លាដូច category ក្នុង ☰ ៖ បិទជាលំនាំដើម · ក្បាល (រូប · ឈ្មោះ · ចំនួន · «ថ្មី» · ព្រួញ)
    //    មិនលើស ហើយមិនគាបឈ្មោះលើទូរស័ព្ទ ៣២០ · ៤១២ · ចុចពន្លា ➜ បញ្ជីទំព័រ ២០ · រមូរ `.drawer-body` (ធាតុដែលរមូរពិត) ដល់ចុង ➜ ទាញទំព័របន្ទាប់។
    const heads = [];
    for (const w of [320, 412]) {
        await page.setViewportSize({ width: w, height: 900 });
        await page.waitForTimeout(300);
        heads.push(await page.evaluate(() => {
            const h = document.getElementById('notifyRemovedHead');
            const d = document.getElementById('notifyDrawer');
            if (!h || !d) return null;
            const label = h.querySelector('.drawer-group-label');
            const count = h.querySelector('.notify-group-count');
            const tag = h.querySelector('.notify-new-tag');
            const hr = h.getBoundingClientRect(), dr = d.getBoundingClientRect();
            return { w: window.innerWidth, expanded: h.getAttribute('aria-expanded'), list: !!document.getElementById('notifyRemovedList'),
                count: count ? count.textContent : null, tag: tag ? tag.textContent : null, countW: count ? count.getBoundingClientRect().width : 0,
                labelW: label ? label.getBoundingClientRect().width : 0, labelCut: label ? label.scrollWidth > label.clientWidth + 1 : true,
                headCut: h.scrollWidth > h.clientWidth + 1, inside: hr.left >= dr.left - 1 && hr.right <= dr.right + 1, headW: hr.width };
        }));
    }
    check(heads.every((x) => x && x.expanded === 'false' && !x.list),
        '⛔ ZoeW ក្រុម 🔔 ៖ «កញ្ចប់ដែលដករួច» បិទជាលំនាំដើម (aria-expanded=false · គ្មានបញ្ជី)', JSON.stringify(heads));
    check(heads.every((x) => x && x.count === String(11 + ROWS) && x.tag && x.countW >= 16),
        'ZoeW ក្រុម 🔔 ៖ ក្បាលបង្ហាញចំនួនកញ្ចប់ និង «ថ្មី»', JSON.stringify(heads));
    check(heads.every((x) => x && !x.headCut && x.inside && !x.labelCut && x.labelW >= x.headW * 0.3),
        '⛔ ZoeW ក្រុម 🔔 ៖ ក្បាលមិនលើសផ្ទាំង · ឈ្មោះក្រុមមិនកាត់ ឬគាបតូច (៣២០ · ៤១២)', JSON.stringify(heads));
    if (await page.$('#notifyRemovedHead')) await page.click('#notifyRemovedHead');
    await page.waitForTimeout(300);
    const seen = [];
    for (const w of [320, 412]) {
        await page.setViewportSize({ width: w, height: 900 });
        await page.waitForTimeout(400);
        seen.push(await page.evaluate(() => {
            const meta = document.querySelector('#notifyRemovedList .notify-expiry-meta');
            const row = document.querySelector('#notifyRemovedList .notify-expiry-row');
            const drawer = document.getElementById('notifyDrawer');
            if (!meta || !row || !drawer) return null;
            const rr = row.getBoundingClientRect(), dr = drawer.getBoundingClientRect();
            return { w: window.innerWidth, text: meta.textContent, metaW: meta.clientWidth, rowW: row.clientWidth, cut: meta.scrollWidth > meta.clientWidth + 1, ellipsis: getComputedStyle(meta).textOverflow,
                rowInside: rr.left >= dr.left - 1 && rr.right <= dr.right + 1, rowRight: rr.right, drawerRight: dr.right };
        }));
    }
    check(seen.every(Boolean) && seen.every((s) => s.text.indexOf(LOCKER) !== -1), 'ZoeW ជួរ 🔔 ៖ ជាន់អប្បបរមា ៖ ជួរដករួចគូរជាមួយ Locker', JSON.stringify(seen));
    check(seen.every((s) => s && !s.cut && s.ellipsis !== 'ellipsis'),
        '⛔ ZoeW ជួរ 🔔 ៖ Locker មិនត្រូវកាត់ (បត់បន្ទាត់ គ្មាន «…») ៣២០ · ៤១២', JSON.stringify(seen));
    check(seen.every((s) => s && s.metaW >= s.rowW * 0.4),
        '⛔ ZoeW ជួរ 🔔 ៖ ព័ត៌មាន (ចំនួន · Locker) មិនត្រូវគាបតូច (≥ ៤០% នៃជួរ ៖ បត់ចុះបន្ទាត់ថ្មីពេលមិនគ្រប់)', JSON.stringify(seen));
    check(seen.every((s) => s && s.rowInside), 'ZoeW ជួរ 🔔 ៖ ជួរនៅក្នុងផ្ទាំង (មិនលើស)', JSON.stringify(seen));
    await page.setViewportSize({ width: 412, height: 700 });
    await page.waitForTimeout(500);
    const rowsNow = () => page.evaluate(() => document.querySelectorAll('#notifyRemovedList .notify-expiry-row').length);
    const first = await rowsNow();
    await page.evaluate(() => { const m = document.querySelector('#notifyDrawer .notify-page-more'); if (m) m.scrollIntoView({ block: 'end' }); });
    await page.waitForTimeout(600);
    const second = await rowsNow();
    check(first === 20 && second === 40,
        '⛔ ZoeW ក្រុម 🔔 ៖ ពន្លា ➜ ២០ ជួរ · រមូរ `.drawer-body` ដល់ចុងបញ្ជី ➜ ៤០ (sentinel សង្កេតធាតុដែលរមូរពិត · មិនទាញគ្រប់ទំព័រភ្លាម)',
        JSON.stringify({ first, second, total: ROWS }));
    // ⛔ សំណើម្ចាស់គម្រោង ៖ ផ្ទាំង 🔔 លើកុំព្យូទ័រ (≥ 992px) ធំជាងទូរស័ព្ទបន្តិច · ទូរស័ព្ទ និង ☰ មិនប្រែ
    const widths = [];
    for (const w of [412, 1280]) {
        await page.setViewportSize({ width: w, height: 900 });
        await page.waitForTimeout(300);
        widths.push(await page.evaluate(() => {
            const n = document.getElementById('notifyDrawer');
            const d = document.getElementById('sideDrawer');
            return { vw: window.innerWidth, notify: n ? Math.round(n.getBoundingClientRect().width) : 0, side: d ? Math.round(d.getBoundingClientRect().width) : 0 };
        }));
    }
    const [phoneW, deskW] = widths;
    check(phoneW.notify === 320 && phoneW.side === 320, 'ZoeW ផ្ទាំង 🔔 ៖ ទូរស័ព្ទ ៤១២ ➜ ទទឹងដូចដើម (៣២០ · ☰ ៣២០)', JSON.stringify(widths));
    check(deskW.notify >= 380 && deskW.notify <= 440 && deskW.side === 320,
        '⛔ ZoeW ផ្ទាំង 🔔 ៖ កុំព្យូទ័រ ១២៨០ ➜ ធំជាងទូរស័ព្ទ (៣៨០–៤៤០px) · ☰ មិនប្រែ', JSON.stringify(widths));
    await ctx.close();
}

// ⛔ សំណើម្ចាស់គម្រោង ៖ ZoeKeyGen ៖ ប្រអប់ចូលប្រព័ន្ធ · ចូល Supabase Admin · Private Key ត្រូវឲ្យ Google Password Manager និង iOS Passwords ស្គាល់ ៖
//    ពាក្យសម្ងាត់នីមួយៗ (`current-password` · `new-password`) នៅក្នុង `<form>` មានប៊ូតុង submit · មុនវាមានប្រអប់ `autocomplete="username"` (Private Key ៖ username
//    លាក់ «ZoeKeyGen Signing Key» ➜ entry ដាច់ពីគណនី Admin) · មាន `name` · Private Key ជា `<input type="password">` (password manager មិនបំពេញ `<textarea>`) ·
//    submit (Enter) ដំណើរការសកម្មភាពពិត ហើយ ⛔ មិនបញ្ជូន form តាម URL (`?username=…&password=…`) · ទិសផ្ទុយ ៖ PIN មិនមែនពាក្យសម្ងាត់ (`autocomplete="off"`)។
async function keygenPasswordForms(browser, port) {
    const ctx = await browser.newContext({ viewport: { width: 412, height: 900 } });
    const page = await ctx.newPage();
    const dialogs = [];
    page.on('dialog', (d) => { dialogs.push(d.message()); d.dismiss().catch(() => {}); });
    await page.route('**', (route) => route.request().url().startsWith('http://127.0.0.1:' + port) ? route.continue() : route.abort());
    await page.goto('http://127.0.0.1:' + port + '/', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(800);
    const audit = await page.evaluate(() => {
        const out = { ids: [], problems: [], pk: null, pins: [] };
        const pw = Array.from(document.querySelectorAll('input[type="password"]'));
        for (const p of pw) {
            const ac = p.getAttribute('autocomplete') || '';
            if (ac !== 'current-password' && ac !== 'new-password') { out.pins.push(p.id + ':' + ac); continue; }
            out.ids.push(p.id);
            if (!p.getAttribute('name')) out.problems.push(p.id + ' គ្មាន name');
            const form = p.closest('form');
            if (!form) { out.problems.push(p.id + ' មិននៅក្នុង form'); continue; }
            if (!form.querySelector('button[type="submit"]')) out.problems.push(p.id + ' form គ្មានប៊ូតុង submit');
            const fields = Array.from(form.querySelectorAll('input'));
            const user = fields.slice(0, fields.indexOf(p)).find((f) => f.getAttribute('autocomplete') === 'username');
            if (!user) out.problems.push(p.id + ' គ្មាន username មុនវា');
            else if (!user.getAttribute('name')) out.problems.push(user.id + ' គ្មាន name');
        }
        const pk = document.getElementById('privateKeyInput');
        const pkForm = pk && pk.closest('form');
        const pkUser = pkForm && pkForm.querySelector('input[autocomplete="username"]');
        out.pk = pk ? { tag: pk.tagName, type: pk.getAttribute('type'), ac: pk.getAttribute('autocomplete'), user: pkUser ? pkUser.value : null } : null;
        return out;
    });
    const want = ['loginPasswordInput', 'sbAdminPasswordInput', 'privateKeyInput'];
    check(want.every((id) => audit.ids.indexOf(id) !== -1),
        '⛔ ZoeKeyGen password manager ៖ ពាក្យសម្ងាត់ ៣ (ចូលប្រព័ន្ធ · Supabase Admin · Private Key) ជា current-password', JSON.stringify(audit));
    check(audit.ids.length >= 3 && audit.problems.length === 0,
        '⛔ ZoeKeyGen password manager ៖ ពាក្យសម្ងាត់នីមួយៗនៅក្នុង form + submit + username មុនវា + name', JSON.stringify(audit.problems));
    check(!!audit.pk && audit.pk.tag === 'INPUT' && audit.pk.type === 'password' && audit.pk.user === 'ZoeKeyGen Signing Key',
        '⛔ ZoeKeyGen Private Key ៖ <input type="password"> + username លាក់ «ZoeKeyGen Signing Key» (មិនមែន <textarea>)', JSON.stringify(audit.pk));
    check(audit.pins.length >= 2 && audit.pins.every((x) => /:off$/.test(x)),
        'ZoeKeyGen ៖ ទិសផ្ទុយ ៖ PIN មិនមែនពាក្យសម្ងាត់ (autocomplete="off")', JSON.stringify(audit.pins));
    const url0 = page.url();
    for (const [formId, label] of [['signingKeyForm', 'Private Key'], ['sbAdminForm', 'Supabase Admin']]) {
        const before = dialogs.length;
        const sent = await page.evaluate((id) => {
            const f = document.getElementById(id);
            if (!f || typeof f.requestSubmit !== 'function') return false;
            f.requestSubmit();
            return true;
        }, formId);
        await page.waitForTimeout(300);
        check(sent && dialogs.length > before && page.url() === url0,
            '⛔ ZoeKeyGen ' + label + ' ៖ submit (Enter) ➜ សកម្មភាពពិតរត់ · ⛔ មិនបញ្ជូនតាម URL', JSON.stringify({ sent, dialogs: dialogs.slice(before), url: page.url() }));
    }
    await ctx.close();
}

// ⛔ UI-4 ៖ បញ្ជី ZTO «មិនទាន់បិទ» គូរជាទំព័រ ២០ ហើយទាញបន្ថែមពេលរមូរជិតចុង ៖ root របស់ IntersectionObserver ត្រូវជាធាតុដែលរមូរពិត
//    (`.modal-content`) — root ដែលមិនរមូរ (`.zto-sync-list`) ឃើញ sentinel «ប្រសព្វ» ជានិច្ច ➜ ទាញគ្រប់ទំព័រភ្លាម (គូរ ២០០ barcode SVG ពេលបើក)។
async function ztoSyncListPaging(browser, port) {
    const ctx = await browser.newContext({ viewport: { width: 412, height: 900 } });
    const page = await ctx.newPage();
    page.on('dialog', (d) => d.dismiss().catch(() => {}));
    await page.route('**', (route) => route.request().url().startsWith('http://127.0.0.1:' + port) ? route.continue() : route.abort());
    await page.goto('http://127.0.0.1:' + port + '/', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(800);
    const ready = await page.evaluate(() => typeof openModalHelper === 'function' && !!window.ztoState);
    check(ready, 'ZoeW បញ្ជី ZTO ៖ មាន openModalHelper · ztoState (audit build)');
    if (!ready) { await ctx.close(); return; }
    await page.evaluate(() => {
        const entries = [];
        for (let i = 0; i < 200; i++) entries.push({ code: 'ZT' + String(700000000000 + i), phone: '0' + String(10000000 + i), locker: 'A' + (i % 9) });
        window.ztoState.ztoSyncListView = { empty: null, entries };
        openModalHelper('ztoSyncModal');
    });
    await page.waitForTimeout(700);
    const count = () => document.querySelectorAll('#ztoSyncList .zto-sync-item').length;
    const first = await page.evaluate(count);
    check(first >= 20 && first <= 40, '⛔ ZoeW បញ្ជី ZTO ៖ បើកប្រអប់ ➜ គូរតែទំព័រដំបូង (មិនទាញគ្រប់ ២០០ ភ្លាម)', 'គូរ ' + first);
    await page.evaluate(() => {
        const box = document.querySelector('#ztoSyncModal .modal-content');
        if (box) box.scrollTop = box.scrollHeight;
    });
    await page.waitForTimeout(700);
    const after = await page.evaluate(count);
    check(after > first && after < 200, 'ZoeW បញ្ជី ZTO ៖ រមូរដល់ចុង ➜ ទាញទំព័របន្ទាប់ (មិនមែនទាំងអស់)', first + ' ➜ ' + after);
    await ctx.close();
}

// ⛔ UI-3 ៖ banner «កំណែថ្មី» (`position: fixed; bottom: 0`) មិនត្រូវគ្របរបា Tab ខាងក្រោម (ទូរស័ព្ទ/ថេប្លេត < 992px) ៖ នៅពីលើរបា ·
//    របាលាក់ (`chrome-hidden`) ➜ ចុះដល់បាត · desktop (របា Tab នៅខាងលើ) ➜ នៅបាតដដែល។ វាស់ `getBoundingClientRect()` ក្នុង browser ពិត។
async function updateBannerLayout(browser, port) {
    const ctx = await browser.newContext({ viewport: { width: 412, height: 900 } });
    const page = await ctx.newPage();
    page.on('dialog', (d) => d.dismiss().catch(() => {}));
    await page.route('**', (route) => route.request().url().startsWith('http://127.0.0.1:' + port) ? route.continue() : route.abort());
    await page.goto('http://127.0.0.1:' + port + '/', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(800);
    const ready = await page.evaluate(() => typeof showUpdateAvailableBanner === 'function');
    check(ready, 'ZoeW banner កំណែថ្មី ៖ មាន showUpdateAvailableBanner (audit build)');
    if (!ready) { await ctx.close(); return; }
    await page.evaluate(() => showUpdateAvailableBanner());
    await page.waitForTimeout(150);
    const probe = () => {
        const b = document.getElementById('zoeUpdateBanner');
        const t = document.getElementById('pageTabBar');
        if (!b || !t) return null;
        const br = b.getBoundingClientRect(), tr = t.getBoundingClientRect();
        return { bTop: br.top, bBottom: br.bottom, bH: br.height, tTop: tr.top, tBottom: tr.bottom, tH: tr.height, vh: window.innerHeight };
    };
    const phone = await page.evaluate(probe);
    check(!!phone && phone.bH > 20 && phone.tH > 20, 'ZoeW banner កំណែថ្មី ៖ ជាន់អប្បបរមា ៖ banner និងរបា Tab ត្រូវគូរ (ទូរស័ព្ទ)', JSON.stringify(phone));
    if (phone) {
        check(phone.bBottom <= phone.tTop + 1,
            '⛔ ZoeW banner កំណែថ្មី ៖ ទូរស័ព្ទ ➜ នៅពីលើរបា Tab (មិនគ្រប)', JSON.stringify(phone));
        check(phone.tBottom >= phone.vh - 1, 'ZoeW banner កំណែថ្មី ៖ របា Tab នៅបាតអេក្រង់ដដែល', JSON.stringify(phone));
    }
    const hidden = await page.evaluate((fn) => {
        document.body.classList.add('chrome-hidden');
        const out = (0, eval)('(' + fn + ')')();
        document.body.classList.remove('chrome-hidden');
        return out;
    }, probe.toString());
    check(!!hidden && hidden.bBottom >= hidden.vh - 1,
        'ZoeW banner កំណែថ្មី ៖ របា Tab លាក់ (`chrome-hidden`) ➜ banner ចុះដល់បាតអេក្រង់', JSON.stringify(hidden));
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForTimeout(200);
    const desk = await page.evaluate(probe);
    check(!!desk && desk.bBottom >= desk.vh - 1 && desk.tTop < desk.vh / 2,
        'ZoeW banner កំណែថ្មី ៖ desktop (របា Tab នៅខាងលើ) ➜ banner នៅបាតដដែល', JSON.stringify(desk));
    await ctx.close();
}

async function historyRowLayout(browser, port) {
    const ctx = await browser.newContext({ viewport: { width: 412, height: 900 } });
    const page = await ctx.newPage();
    page.on('dialog', (d) => d.dismiss().catch(() => {}));
    await page.route('**', (route) => route.request().url().startsWith('http://127.0.0.1:' + port) ? route.continue() : route.abort());
    await page.goto('http://127.0.0.1:' + port + '/', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(800);
    const ready = await page.evaluate(() => typeof renderHistory === 'function' && typeof openViewListModal === 'function');
    check(ready, 'ZoeW ជួរប្រវត្តិ ៖ មាន renderHistory · openViewListModal (audit build)');
    if (!ready) { await ctx.close(); return; }
    const seen = [];
    for (const w of HISTORY_ROW_WIDTHS) {
        await page.setViewportSize({ width: w, height: 900 });
        seen.push(Object.assign({ w: w, big: false }, await page.evaluate(HISTORY_ROW_PROBE, false)));
        seen.push(Object.assign({ w: w, big: true }, await page.evaluate(HISTORY_ROW_PROBE, true)));
    }
    const rowsOf = (pred) => seen.flatMap((s) => s.rowList.map((r) => Object.assign({ w: s.w, big: s.big }, r))).filter(pred);
    const show = (list) => JSON.stringify(list.slice(0, 4));
    const small = seen.filter((s) => !s.big);
    check(small.length === HISTORY_ROW_WIDTHS.length && small.every((s) => s.rows === 6) && seen.filter((s) => s.big).every((s) => s.rows >= 50),
        'ZoeW ជួរប្រវត្តិ ៖ ជាន់អប្បបរមា ៖ គូរជួរពិត ៦ ជួរ + ៥០ ជួរ (លេខរៀង ៣ ខ្ទង់) គ្រប់ទទឹង', JSON.stringify(seen.map((s) => [s.w, s.big, s.rows])));
    check(seen.every((s) => s.oldButtons === 0) && rowsOf((r) => r.badgeTag !== 'BUTTON').length === 0,
        'ZoeW ជួរប្រវត្តិ ៖ «កញ្ចប់សរុប» ជាប៊ូតុង · គ្មានប៊ូតុង «📦 បញ្ជី» ចាស់', show(rowsOf((r) => r.badgeTag !== 'BUTTON')));
    check(rowsOf((r) => !r.badgeClear).length === 0,
        '⛔ ZoeW ជួរប្រវត្តិ ៖ គ្មានធាតុណាបាំង «កញ្ចប់សរុប» (elementFromPoint គែមឆ្វេង · កណ្តាល · គែមស្តាំ គ្រប់ទទឹង)', show(rowsOf((r) => !r.badgeClear)));
    check(rowsOf((r) => !r.buttonsClear || r.buttonsHitPrice).length === 0,
        '⛔ ZoeW ជួរប្រវត្តិ ៖ ប៊ូតុងខល/បិទ មិនជាន់ធាតុណាក្នុងក្រឡាតម្លៃ ហើយគ្មានអ្វីបាំងវា', show(rowsOf((r) => !r.buttonsClear || r.buttonsHitPrice)));
    check(rowsOf((r) => !r.buttonsInCell).length === 0,
        '⛔ ZoeW ជួរប្រវត្តិ ៖ ប៊ូតុងសកម្មភាពនៅក្នុងក្រឡារបស់វា គ្រប់ទទឹង (ទូរស័ព្ទ · ថេប្លេត · desktop)', show(rowsOf((r) => !r.buttonsInCell)));
    check(rowsOf(() => true).length > 0 && rowsOf((r) => !r.buttonsFull).length === 0,
        '⛔ ZoeW ជួរប្រវត្តិ ៖ ប៊ូតុងខល/បិទ ទំហំតែមួយគ្រប់ទទឹង (padding 10px ឆ្វេង/ស្តាំ · កម្ពស់ ≥ 38px) — មិនបង្រួមតាមអេក្រង់',
        show(rowsOf((r) => !r.buttonsFull).map((r) => ({ w: r.w, id: r.id, pad: r.buttonPad }))));
    check(rowsOf((r) => r.fixPhone).length > 0 && rowsOf((r) => !r.buttonsOneLine && (r.fixPhone ? r.w >= 430 : r.w >= 390)).length === 0,
        'ZoeW ជួរប្រវត្តិ ៖ ប៊ូតុងខល/បិទ នៅបន្ទាត់តែមួយចាប់ពី 390px · «✏️ កែលេខ» ចាប់ពី 430px (Unifont · ក្រោមនោះ ៖ ប៊ូតុងទំហំដដែលបត់ចុះក្រោម មិនបង្រួម)',
        show(rowsOf((r) => !r.buttonsOneLine && (r.fixPhone ? r.w >= 430 : r.w >= 390))));
    check(seen.every((s) => s.colSkew !== null && s.colSkew <= 1),
        '⛔ ZoeW ជួរប្រវត្តិ ៖ ជួរឈរ «Locker/តម្លៃ/ចំនួន» នៅចំកណ្តាលតារាង គ្រប់ទទឹង (កណ្តាលជួរឈរ − កណ្តាលតារាង ≤ 1px)',
        JSON.stringify(seen.filter((s) => !(s.colSkew <= 1)).map((s) => [s.w, s.colSkew]).filter((x, i, a) => a.findIndex((y) => y[0] === x[0]) === i)));
    check(rowsOf((r) => !r.big && r.bigMoney).length === HISTORY_ROW_WIDTHS.length * 2 && rowsOf((r) => !r.priceInCell).length === 0,
        '⛔ ZoeW ជួរប្រវត្តិ ៖ លុយច្រើនខ្ទង់ ($1234.56 · COD $987.65 + DOD $245.50 · រៀល ៧ ខ្ទង់) នៅក្នុងក្រឡា «Locker/តម្លៃ/ចំនួន» គ្រប់ទទឹង (មិនហៀរទៅក្រោមប៊ូតុង)',
        'ជួរលុយធំ ' + rowsOf((r) => !r.big && r.bigMoney).length + ' · ' + show(rowsOf((r) => !r.priceInCell).map((r) => [r.w, r.id])));
    check(rowsOf((r) => !r.moneyWhole).length === 0,
        'ZoeW ជួរប្រវត្តិ ៖ ចំនួនលុយ (ឧ. «$1234.56») នៅបន្ទាត់តែមួយ មិនបំបែកពាក់កណ្តាលលេខ គ្រប់ទទឹង',
        show(rowsOf((r) => !r.moneyWhole).map((r) => [r.w, r.id])));
    check(small.every((s) => s.headText === 'Locker/តម្លៃ/ចំនួន'),
        '⛔ ZoeW ជួរប្រវត្តិ ៖ ចំណងជើងជួរឈរទី ៣ = «Locker/តម្លៃ/ចំនួន» (លំដាប់ដូចធាតុក្នុងក្រឡា ៖ ស្លាក Locker · តម្លៃ · «កញ្ចប់សរុប»)',
        JSON.stringify(small.map((s) => s.headText).filter((t, i, a) => a.indexOf(t) === i)));
    check(rowsOf((r) => !(r.priceSkew <= 2)).length === 0 && seen.every((s) => s.headSkew !== null && s.headSkew <= 2),
        '⛔ ZoeW ជួរប្រវត្តិ ៖ ជួរឈរ «Locker/តម្លៃ/ចំនួន» នៅចំកណ្តាលក្រឡា គ្រប់ទទឹង ៖ ចំណងជើង · ស្លាក Locker · បន្ទាត់តម្លៃនីមួយៗ · «កញ្ចប់សរុប» (គម្លាតឆ្វេង − ស្តាំ ≤ 2px)',
        JSON.stringify({ head: seen.filter((s) => !(s.headSkew <= 2)).map((s) => [s.w, s.headSkew]).slice(0, 4),
            rows: rowsOf((r) => !(r.priceSkew <= 2)).map((r) => [r.w, r.id, r.priceSkew]).slice(0, 6) }));
    check(rowsOf((r) => r.numberHitsCustomer).length === 0,
        '⛔ ZoeW ជួរប្រវត្តិ ៖ លេខរៀង (រួមទាំង ៣ ខ្ទង់ និងស្លាកពណ៌) មិនជាន់ក្រឡាអតិថិជន', show(rowsOf((r) => r.numberHitsCustomer)));
    const chips = rowsOf((r) => !r.big && !!r.chip);
    check(chips.length === HISTORY_ROW_WIDTHS.length * 5,
        'ZoeW ជួរប្រវត្តិ ៖ ជាន់អប្បបរមា ៖ ប្រភពបង្ហាញលើ ៥ ជួរដែលមាន `origins` គ្រប់ទទឹង (ទិសផ្ទុយ ៖ ជួរ A គ្មាន)',
        'ឃើញ ' + chips.length + ' · ' + show(rowsOf((r) => !r.big && r.id === 'A' && !!r.chip)));
    check(chips.every((r) => r.chip.inCell && !r.chip.hitsSibling),
        '⛔ ZoeW ជួរប្រវត្តិ ៖ ប្រភពនៅក្នុងក្រឡាអតិថិជន មិនជាន់ស្លាក · លេខទូរស័ព្ទ · ម៉ោង', show(chips.filter((r) => !r.chip.inCell || r.chip.hitsSibling)));
    check(chips.filter((r) => r.id === 'E').every((r) => r.chip.cut) && chips.filter((r) => r.id === 'B' || r.id === 'F').every((r) => !r.chip.cut),
        'ZoeW ជួរប្រវត្តិ ៖ ប្រភពវែងកាត់ (…) · «🇨🇳 ចិន» បង្ហាញពេញ', show(chips.filter((r) => (r.id === 'E' && !r.chip.cut) || ((r.id === 'B' || r.id === 'F') && r.chip.cut))));
    check(small.every((s) => s.widthsChanged === 0),
        '⛔ ZoeW ជួរប្រវត្តិ ៖ ប្រភពមិនប្តូរទទឹងជួរឈរ', JSON.stringify(small.filter((s) => s.widthsChanged).map((s) => [s.w, s.widthsChanged])));
    check(chips.every((r) => r.grew <= r.chip.oneLine + 1),
        'ZoeW ជួរប្រវត្តិ ៖ ប្រភពបន្ថែមកម្ពស់ជួរយ៉ាងច្រើនមួយបន្ទាត់ (កម្ពស់ធាតុខ្ពស់បំផុតក្នុងក្រឡា + គម្លាតពិត)',
        show(chips.filter((r) => r.grew > r.chip.oneLine + 1)));

    await page.setViewportSize({ width: 320, height: 900 });
    await page.evaluate(HISTORY_ROW_PROBE, false);
    let opened = null;
    try {
        await page.click('#historyTableBody tr[data-id="D"] .count-badge', { timeout: 4000 });
        await page.waitForTimeout(250);
        opened = await page.evaluate(() => {
            const modal = document.getElementById('viewListModal');
            const list = document.getElementById('barcodeListContainer');
            return { shown: !!modal && getComputedStyle(modal).display !== 'none', text: list ? list.textContent : '' };
        });
    } catch (e) { opened = { error: String(e && e.message).split('\n')[0] }; }
    check(!!opened && opened.shown && ['ZTD001', 'ZTD002', 'ZTD003'].every((c) => opened.text.indexOf(c) !== -1)
        && /វៀតណាម/.test(opened.text) && /ចិន/.test(opened.text),
        '⛔ ZoeW ជួរប្រវត្តិ ៖ ចុច «កញ្ចប់សរុប» ពិត (320px) ➜ ប្រអប់បញ្ជី barcode ទាំង ៣ របស់ជួរនោះ ជាមួយប្រភពនីមួយៗ',
        JSON.stringify(opened && { shown: opened.shown, error: opened.error, text: String(opened.text || '').slice(0, 160) }));
    await ctx.close();
}

(async () => {
    const browser = await chromium.launch({ executablePath: CHROME });
    for (const app of ['ZoeW', 'ZoeKeyGen']) {
        console.log('\n=== ' + app + ' ===');
        const dir = path.join(ROOT, app);
        const server = await serve(dir);
        const port = server.address().port;
        const shape = {};
        const modalUnits = {};
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
                    let units = null, fills = false;
                    if (box) {
                        const bb = box.getBoundingClientRect();
                        if (bb.top < -1) boxIssue = 'ផ្នែកខាងលើចេញក្រៅអេក្រង់ top=' + Math.round(bb.top);
                        else if (bb.height > vh + 1 && !/(auto|scroll)/.test(getComputedStyle(box).overflowY)) boxIssue = 'ខ្ពស់ជាងអេក្រង់ តែរមូរមិនបាន h=' + Math.round(bb.height) + '/' + vh;
                        const probe = document.createElement('div');
                        probe.style.cssText = 'position:absolute;visibility:hidden;width:calc(100 * var(--fs-unit))';
                        document.body.appendChild(probe);
                        const unit = probe.getBoundingClientRect().width / 100;
                        probe.remove();
                        const ms = getComputedStyle(m);
                        const room = vw - parseFloat(ms.paddingLeft) - parseFloat(ms.paddingRight);
                        if (unit > 0 && bb.width > 0) units = bb.width / unit;
                        fills = bb.width >= room - 1;
                    }
                    prevAll.forEach(([x, d, h]) => { x.style.display = d; if (h) x.classList.add('hidden'); });
                    if (wasHidden) m.classList.add('hidden');
                    return { over, boxIssue, units, fills };
                }, mid);
                if (r && r.over) modalBad.push(mid + ' ➜ លើសទទឹង: ' + r.over);
                if (r && r.boxIssue) modalBad.push(mid + ' ➜ ' + r.boxIssue);
                if (r && r.units !== null) (modalUnits[mid] = modalUnits[mid] || []).push({ w: size.w, units: r.units, fills: r.fills });
            }
            check(modalBad.length === 0, label + ': modal ទាំងអស់សមនឹងអេក្រង់', modalBad.slice(0, 5).join('\n        '));

            // ⛔ modal ជាន់គ្នា (App ទាំង ២) ៖ modal ដែល **បើកក្រោយ** ត្រូវនៅខាងលើជានិច្ច — z-index ស្មើគ្នា ➜ លំដាប់ក្នុង DOM ឈ្នះ ➜ ឧ. ប្រអប់ PIN
            //    (ឈរមុន Config ក្នុង DOM) បើកពី ⚙️ Config ➜ លោតពីក្រោយ (រាយការណ៍ដោយម្ចាស់គម្រោង ៖ ZoeKeyGen បើកក្រយៅដៃ/មុខ · វាស់បាន ZoeW ខុស
            //    ៤៦៥/៩៣០ គូ · ZoeKeyGen ១៥/៣០)។ វាស់គ្រប់គូ (A ➜ B) តាម `openModalHelper()` ពិត និង `elementFromPoint()` ចំកណ្តាលប្រអប់ B · បើក A
            //    **ម្តងទៀត** ខណៈវាបើករួច ➜ A ត្រូវឡើងលើ (ការបើកឡើងវិញដែលមិនលើក = ប្រអប់ដដែលនៅពីក្រោយ) · បិទទាំងអស់ ➜ z-index ត្រឡប់ទៅតម្លៃដើមរបស់ប្រអប់
            //    (ZoeW ៖ modal តែមួយរក្សា z-index ដើមរបស់វា ➜ parity ជាមួយ App ដើមនៅដដែល)
            if (size.w === 412) {
                await page.waitForFunction(() => typeof window.openModalHelper === 'function' && typeof window.closeModal === 'function', null, { timeout: 20000 }).catch(() => {});
                const stack = await page.evaluate(() => {
                    if (typeof openModalHelper !== 'function' || typeof closeModal !== 'function') return { skip: true };
                    const flush = () => { if (typeof window.commitNow === 'function') window.commitNow(); };
                    const ids = Array.from(document.querySelectorAll('.modal')).map((m) => m.id).filter(Boolean);
                    const onTop = (id) => {
                        const el = document.getElementById(id);
                        const box = el.querySelector('.modal-content') || el;
                        const r = box.getBoundingClientRect();
                        if (r.width === 0 || r.height === 0) return false;
                        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + Math.min(r.height / 2, 40));
                        return !!hit && el.contains(hit);
                    };
                    const wrong = [];
                    let pairs = 0;
                    ids.forEach((m) => closeModal(m));
                    flush();
                    const ownZ = new Map(ids.map((id) => [id, document.getElementById(id).style.zIndex]));
                    ids.forEach((a) => ids.forEach((b) => {
                        if (a === b) return;
                        openModalHelper(a);
                        openModalHelper(b);
                        flush();
                        pairs++;
                        if (!onTop(b)) wrong.push(a + ' ➜ ' + b);
                        openModalHelper(a);
                        flush();
                        if (!onTop(a)) wrong.push(a + ' ➜ ' + b + ' ➜ ' + a);
                        closeModal(b);
                        closeModal(a);
                        flush();
                    }));
                    const leftover = ids.filter((id) => document.getElementById(id).style.zIndex !== ownZ.get(id));
                    return { pairs, ids: ids.length, wrongCount: wrong.length, wrong: wrong.slice(0, 12), leftover };
                });
                check(!stack.skip && stack.ids >= 5 && stack.pairs >= stack.ids * (stack.ids - 1) && stack.wrongCount === 0 && stack.leftover.length === 0,
                    label + ': ⛔ modal ដែលបើកក្រោយនៅខាងលើជានិច្ច (គ្រប់គូ A ➜ B · បើក A ម្តងទៀត)', JSON.stringify(stack).slice(0, 500));
            }

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

            // ⛔ QR របស់ ZoeKeyGen (Setup Link · កូដអញ្ជើញ) ៖ Link ពិតវែង (Config + DSN ➜ ~៧០០ តួ ➜ QR ~៩០ module) ➜ SVG ទំហំថេរ
            //    (`cellSize` × module) ធំជាងកាតលើទូរស័ព្ទ ➜ `text-align: center` មិនអាចដាក់កណ្តាលធាតុធំជាងកន្សោម ➜ ហៀរស្តាំ (រូបថតម្ចាស់គម្រោង)។
            //    វាស់តាម `renderQrInto()` ពិត ៖ ការ៉េ · ក្នុងកាត · គម្លាតឆ្វេង ≈ ស្តាំ · គ្រប់ទំហំអេក្រង់។
            if (app === 'ZoeKeyGen') {
                const qrGeo = await page.evaluate((cfg) => {
                    if (typeof generateSetupLink !== 'function' || typeof renderSbInviteResult !== 'function' || typeof switchKgTab !== 'function') {
                        return { skip: 'រក generateSetupLink/renderSbInviteResult/switchKgTab មិនឃើញ' };
                    }
                    document.querySelectorAll('.modal').forEach((m) => { m.style.display = 'none'; m.classList.remove('active'); });
                    const host = document.getElementById('appContainer');
                    const hostHidden = host && host.classList.contains('hidden');
                    if (hostHidden) host.classList.remove('hidden');
                    const measure = (id) => {
                        const box = document.getElementById(id);
                        const svg = box && box.querySelector('svg');
                        const card = box && box.closest('.app-card');
                        if (!svg || !card) return { id, missing: !box ? 'box' : !svg ? 'svg' : 'card' };
                        const r = svg.getBoundingClientRect();
                        const cr = card.getBoundingClientRect();
                        const cs = getComputedStyle(card);
                        const inL = cr.left + parseFloat(cs.borderLeftWidth) + parseFloat(cs.paddingLeft);
                        const inR = cr.right - parseFloat(cs.borderRightWidth) - parseFloat(cs.paddingRight);
                        return { id, w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10,
                            left: Math.round((r.left - inL) * 10) / 10, right: Math.round((inR - r.right) * 10) / 10 };
                    };
                    const reveal = (id) => {
                        const out = [];
                        for (let el = document.getElementById(id); el && el !== document.body; el = el.parentElement) {
                            if (el.classList.contains('hidden')) { el.classList.remove('hidden'); out.push(el); }
                        }
                        return out;
                    };
                    const list = [];
                    switchKgTab('link');
                    document.getElementById('setupLinkUrlInput').value = cfg.base;
                    document.getElementById('setupLinkConfigInput').value = cfg.config;
                    document.getElementById('setupLinkDsnInput').value = cfg.dsn;
                    generateSetupLink();
                    list.push(measure('setupLinkQrContainer'));
                    document.getElementById('setupLinkResultBox').classList.add('hidden');
                    document.getElementById('setupLinkQrContainer').innerHTML = '';
                    switchKgTab('shop');
                    const shown = reveal('sbInviteResultBox');
                    sbLastInvite = { link: cfg.inviteLink, code: 'ABCD-EFGH', role: 'owner', tenantName: 'Zoe', untilText: '—' };
                    renderSbInviteResult();
                    list.push(measure('sbInviteQrContainer'));
                    sbLastInvite = null;
                    document.getElementById('sbInviteQrContainer').innerHTML = '';
                    document.getElementById('sbInviteResultBox').classList.add('hidden');
                    shown.forEach((el) => el.classList.add('hidden'));
                    switchKgTab('create');
                    if (hostHidden) host.classList.add('hidden');
                    return { list };
                }, QR_PROBE);
                const qrBad = (qrGeo.list || []).filter((q) => q.missing || !(q.w >= 160 && Math.abs(q.w - q.h) <= 1
                    && q.left >= -0.5 && q.right >= -0.5 && Math.abs(q.left - q.right) <= 1.5));
                check(!qrGeo.skip && (qrGeo.list || []).length === 2 && qrBad.length === 0,
                    label + ': QR (Setup Link · កូដអញ្ជើញ) ការ៉េ · នៅក្នុងកាត · ចំកណ្តាល', qrGeo.skip || JSON.stringify(qrBad.length ? qrBad : qrGeo.list));
            }

            if (DESKTOP[app] && (size.w === 412 || size.w === 1280 || size.w === 1440)) {
                shape[size.w] = await cardRowsAt(page, DESKTOP[app]);
            }

            await ctx.close();
        }

        // ⛔ ទិសទី ២ របស់ modal ៖ «មិនលើសអេក្រង់» ជាប់ទោះ modal ទទឹង px ថេរ (ZoeKeyGen ៣០០–៤៦០px) នៅតូចលើ desktop ខណៈអក្សរធំ ៣៥% ➜
        //    ប្រអប់ PIN ២៨៨ ឯកតាអក្សរលើទូរស័ព្ទ ➜ ២២២ លើ 1920px (ចង្អៀតជាងទូរស័ព្ទ)។ វាស់ទទឹងជា `--fs-unit` ៖ លើ tablet/desktop
        //    ត្រូវ ≥ ៩៧% នៃអតិបរមាលើទូរស័ព្ទ (ឬពេញអេក្រង់)។ modal ដែលមិនដែលបង្ហាញលើទូរស័ព្ទ ➜ គ្មានមូលដ្ឋាន ➜ មិនរាប់។
        const squeezed = [];
        let squeezeSamples = 0;
        for (const [mid, list] of Object.entries(modalUnits)) {
            const phone = list.filter((x) => x.w <= 430).map((x) => x.units);
            if (!phone.length) continue;
            const floor = Math.max(...phone) * 0.97;
            for (const x of list.filter((y) => y.w >= 700)) {
                squeezeSamples++;
                if (x.units < floor && !x.fills) squeezed.push(mid + ' @' + x.w + 'px ' + Math.round(x.units) + 'u < ' + Math.round(floor) + 'u');
            }
        }
        check(squeezeSamples >= 5 && squeezed.length === 0,
            app + ': modal លើ tablet/desktop មិនចង្អៀតជាងទូរស័ព្ទ (ទទឹងជាឯកតាអក្សរ · វាស់ ' + squeezeSamples + ')', squeezed.slice(0, 6).join('\n        '));

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
        // ⛔ «💾 រក្សាទុក QR» (ZoeKeyGen) ៖ ការទាញយកពិត (PNG) ➜ រូបភាពត្រូវជា QR **ដដែល** នឹង Link (ធៀបគ្រប់ module នឹង
        //    `makeQrCode().isDark()` ពិត) · quiet zone ៤ module · គ្មាន Link ➜ មិនទាញយក (ទិសផ្ទុយ)
        if (app === 'ZoeKeyGen') {
            const ctx = await browser.newContext({ viewport: { width: 412, height: 900 }, acceptDownloads: true });
            const page = await ctx.newPage();
            page.on('dialog', (d) => d.dismiss().catch(() => {}));
            await page.route('**', (route) => route.request().url().startsWith('http://127.0.0.1:' + port) ? route.continue() : route.abort());
            await page.goto('http://127.0.0.1:' + port + '/', { waitUntil: 'domcontentloaded', timeout: 20000 });
            await page.waitForTimeout(800);
            const ready = await page.evaluate(() => typeof saveSetupLinkQr === 'function' && typeof saveSbInviteQr === 'function' && typeof makeQrCode === 'function');
            check(ready, 'ZoeKeyGen ៖ មាន saveSetupLinkQr · saveSbInviteQr · makeQrCode');
            const grab = async (setup, act) => { try {
                await page.evaluate(setup, QR_PROBE_TEXT);
                const dl = page.waitForEvent('download', { timeout: 4000 }).catch(() => null);
                await page.evaluate((a) => window[a](), act);
                const d = await dl;
                if (!d) return null;
                const file = await d.path();
                const buf = fs.readFileSync(file);
                const verdict = await page.evaluate(async ([b64, text]) => {
                    const img = new Image();
                    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = 'data:image/png;base64,' + b64; });
                    const code = makeQrCode(text);
                    const n = code.getModuleCount();
                    const cell = img.width / (n + 8);
                    const c = document.createElement('canvas');
                    c.width = img.width; c.height = img.height;
                    const g = c.getContext('2d');
                    g.drawImage(img, 0, 0);
                    const px = g.getImageData(0, 0, c.width, c.height).data;
                    const dark = (x, y) => px[(Math.floor(y) * c.width + Math.floor(x)) * 4] < 128;
                    let wrong = 0;
                    for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (dark((k + 4.5) * cell, (r + 4.5) * cell) !== code.isDark(r, k)) wrong++;
                    let quietDark = 0;
                    for (let i = 0; i < img.width; i += Math.max(1, Math.floor(cell / 2))) if (dark(i, cell) || dark(cell, i)) quietDark++;
                    return { w: img.width, h: img.height, n, cell, wrong, quietDark };
                }, [buf.toString('base64'), QR_PROBE_TEXT]);
                return { name: d.suggestedFilename(), png: buf.slice(1, 4).toString() === 'PNG', ...verdict };
            } catch (e) { return { error: String(e && e.message).split('\n')[0] }; } };
            const setupDl = await grab((t) => { lastGeneratedSetupLink = t; }, 'saveSetupLinkQr');
            check(!!setupDl && setupDl.png && /\.png$/.test(setupDl.name) && setupDl.w === setupDl.h && setupDl.cell >= 4
                && Number.isInteger(setupDl.cell) && setupDl.wrong === 0 && setupDl.quietDark === 0,
                'ZoeKeyGen ៖ 💾 QR Setup Link ➜ PNG ជា QR ដដែលនឹង Link (គ្រប់ module · quiet zone)', JSON.stringify(setupDl));
            const inviteDl = await grab((t) => { sbLastInvite = { link: t, code: 'x', role: 'owner', tenantName: 'x', untilText: 'x' }; }, 'saveSbInviteQr');
            check(!!inviteDl && inviteDl.png && inviteDl.wrong === 0 && inviteDl.name !== (setupDl && setupDl.name),
                'ZoeKeyGen ៖ 💾 QR កូដអញ្ជើញ ➜ PNG ជា QR ដដែល (ឈ្មោះឯកសារដាច់ពី Setup Link)', JSON.stringify(inviteDl));
            const none = await grab(() => { lastGeneratedSetupLink = ''; }, 'saveSetupLinkQr');
            check(none === null, 'ZoeKeyGen ៖ ទិសផ្ទុយ ៖ គ្មាន Link ➜ មិនទាញយកអ្វីសោះ', JSON.stringify(none));
            await ctx.close();
        }
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
            await historyRowLayout(browser, port);
            await updateBannerLayout(browser, port);
            await ztoSyncListPaging(browser, port);
            await notifyRowLayout(browser, port);
            await pinEnterSubmits(browser, port);
        }
        if (app === 'ZoeKeyGen') await keygenPasswordForms(browser, port);

        server.close();
    }
    await browser.close();
    console.log('\n' + (fail ? 'FAIL ' + fail + ' / ជោគជ័យ ' + pass : 'PASS ' + pass + '/' + pass));
    process.exit(fail ? 1 : 0);
})();
