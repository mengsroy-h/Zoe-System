// ⛔ **អ្នកយាម *ឥរិយាបថ* នៃ «ចំណូល (យករួច)» លើអេក្រង់ស្ថិតិទាំង ៣។**
//
// 🔴 ហេតុអ្វីវាមាន (វាស់បាន 2026-09-05) ៖ mutation ដែលធ្វើឲ្យ
// **📅 ស្ថិតិប្រចាំថ្ងៃ** បង្ហាញ **ledger ឆៅ** ជំនួស «ចំណូល (យករួច)»
// (បញ្ជូន `undefined` ជា `uncollected` ទៅ `buildStatCardItem()`) ➜ រត់
// checker **១៣២** ➜ **០ ចាប់បាន**។ ការធ្វើដដែលលើ **📊 ស្ថិតិ ៣ ខែ** ➜
// ចាប់បាន ១ តែដោយ `function-surface-test` ព្រោះ `uncollectedValueForMonth`
// ក្លាយជា **function ងាប់** — មិនមែនដោយសារលេខខុសទេ ➜ ការការពារ **ផុយ**
// (mutation ដែលបញ្ជូន `{cod:0,dod:0}` ជំនួស `undefined` នឹងរស់រានដែរ)។
//
// **មូលហេតុនៃចន្លោះ** ៖ `monthly-report-test` ជា checker **ស្តាទិច** —
// វាអះអាងថា `openDailyStatsModal()` **ហៅឈ្មោះ** `collectedValueOf()`
// (`monthly-report-test.js:547`)។ Mutation រក្សាការហៅនោះទុក ហើយប្តូរតែ
// **អាគុយម៉ង់** ➜ checker បៃតង។ នេះជាថ្នាក់ដែល `CLAUDE.md` ចែងច្បាស់ ៖
// «checker ស្តាទិចចាក់សោ *ឈ្មោះ*; checker ឥរិយាបថចាក់សោ *លទ្ធផល*»។
//
// ⛔ វា **មិនស្ទួន** `monthly-report-test` ៖ នោះចាក់សោ **ការហៅ**
// (ការ refactor មិនត្រូវបំបែកខ្សែសង្វាក់) · នេះចាក់សោ **លេខដែលអ្នកប្រើអាន**។
//
// ច្បាប់អាជីវកម្មដែលវាការពារ (`CLAUDE.md` ៖ «ចំណូល» ↔ កញ្ចប់មិនទាន់យក) ៖
//   ចំណូល = ledger **ដក** តម្លៃ barcode `!isDeducted && !isClosed`
// ➜ កញ្ចប់ដែលមិនទាន់យក **មិនរាប់ជាចំណូល** ➜ លេខលើអេក្រង់ត្រូវ **តូចជាង**
// តម្លៃកញ្ចប់ទាំងអស់ ខណៈមានកញ្ចប់រង់ចាំ។

let chromium;
try { chromium = require('playwright-core').chromium; } catch (e) {
    console.log('SKIP — ត្រូវការ playwright-core (npm i playwright-core)');
    process.exit(0);
}
const fs = require('fs');
const http = require('http');
const path = require('path');
const CHROME = process.env.STATSTRUTH_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
if (!fs.existsSync(CHROME)) { console.log('SKIP — រកមិនឃើញ Chromium នៅ ' + CHROME); process.exit(0); }

const ROOT = process.env.STATSTRUTH_APP_DIR || path.join(__dirname, '..');
const APP_DIR = path.join(ROOT, 'ZoeW');
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm' };

let pass = 0, fail = 0;
function ok(n) { console.log('  ok    ' + n); pass++; }
function bad(n, d) { console.log('  FAIL  ' + n + (d ? '\n        ' + d : '')); fail++; }
function check(c, n, d) { c ? ok(n) : bad(n, d); }

if (!fs.existsSync(path.join(APP_DIR, 'app.js'))) {
    bad('រកមិនឃើញ ' + path.join(APP_DIR, 'app.js') + ' ➜ គ្មានអ្វីត្រូវពិនិត្យ');
    console.log('\nFAIL 1'); process.exit(1);
}

// ⛔ BOOT · LICENSE_STUB អានចេញពី `revenue-fuzz-test.js` **មិនចម្លង** —
// ច្បាប់ចម្លងទី ២ នៃ fake SDK នឹងឃ្លាតគ្នាជុំក្រោយ។
const FUZZ = fs.readFileSync(path.join(__dirname, 'revenue-fuzz-test.js'), 'utf8');
function slice(from, to, what) {
    const a = FUZZ.indexOf(from), b = FUZZ.indexOf(to);
    if (a === -1 || b === -1 || b <= a) { bad('ស្រង់ ' + what + ' ចេញពី revenue-fuzz-test.js មិនបាន'); return null; }
    return FUZZ.slice(a, b);
}
const BOOT_SRC = slice('const BOOT = function (seed) {', 'function seedData()', 'BOOT');
const LIC_A = FUZZ.indexOf('const LICENSE_STUB = `');
const LICENSE_STUB = LIC_A === -1 ? null : FUZZ.slice(LIC_A + 'const LICENSE_STUB = `'.length, FUZZ.indexOf('};`') + 2);
check(!!(BOOT_SRC && LICENSE_STUB), 'ស្រង់ BOOT · LICENSE_STUB ចេញពី `revenue-fuzz-test.js` (មិនចម្លង)');

// ⛔ Seed **ផ្ទាល់ខ្លួន** ៖ ledger ត្រូវ *ធំជាង* ចំណូលពិត ដោយសារកញ្ចប់មិនទាន់យក។
// លេខជ្រើសដោយចេតនាឲ្យ COD និង DOD **ខុសគ្នា** ➜ ការបូកមុន clamp ក៏ចាប់បានដែរ។
const DAY = '2026-09-05';
const MONTH = DAY.substring(0, 7);
function statsSeed() {
    const bc = (code, cod, dod, closed, deducted) => ({
        code: code, cod: cod, dod: dod, locker: 'A1', time: '10:00:00 (' + DAY + ')',
        isClosed: !!closed, isDeducted: !!deducted
    });
    // ⛔ Seed ត្រូវមាន **៣ ស្ថានភាព** ដើម្បីឲ្យរាល់ mutation មិនក្លាយជា equivalent ៖
    //   ១. យករួច   (isClosed: true  · isDeducted: false) ➜ 20 COD + 5 DOD — **នៅក្នុង ledger**
    //   ២. មិនទាន់យក (isClosed: false · isDeducted: false) ➜ 12 COD + 3 DOD — **នៅក្នុង ledger**
    //   ៣. ដករួច   (isClosed: false · isDeducted: **true**) ➜ 7 COD + 2 DOD — **ក្រៅ ledger**
    // ⛔ បើខ្វះស្ថានភាពទី ៣ នោះ mutation «រាប់ barcode ដែល isDeducted ផង»
    // ក្លាយជា **equivalent** ➜ រស់រានដោយក្លែងក្លាយ (វាស់បាន ៖ S4 រស់រានលើ seed ២ ស្ថានភាព)។
    const items = [
        { id: 'it_taken', phone: '011111111', scanDate: DAY, time: '10:00:00 (' + DAY + ')',
          createdAt: Date.now(), cod: 20, dod: 5, price: 25, count: 1,
          barcodes: [bc('BCTAKEN1', 20, 5, true, false)] },
        { id: 'it_open', phone: '022222222', scanDate: DAY, time: '10:05:00 (' + DAY + ')',
          createdAt: Date.now(), cod: 12, dod: 3, price: 15, count: 1,
          barcodes: [bc('BCOPEN1', 12, 3, false, false)] },
        { id: 'it_deducted', phone: '033333333', scanDate: DAY, time: '10:10:00 (' + DAY + ')',
          createdAt: Date.now(), cod: 7, dod: 2, price: 9, count: 1,
          barcodes: [bc('BCDED1', 7, 2, false, true)] }
    ];
    const hist = {};
    items.forEach((it) => { hist[it.id] = it; });
    const ledgerCod = 32, ledgerDod = 8;          // 20+12 · 5+3 — ⛔ **មិនរាប់** barcode ដែលដករួច
    // ⛔ BOOT ទទួល **store ដោយផ្ទាល់** (`JSON.parse(JSON.stringify(seed))`)
    // ហើយ App ត្រូវការ `user_roles` និង `zoew_settings` ដើម្បី boot ដល់ទីបញ្ចប់។
    return {
        store: {
            user_roles: { 'admin-uid': 'admin' },
            zoew_scan_history_cod_dod: hist,
            zoew_recently_deleted_cod_dod: {},
            zoew_daily_revenue_cod_dod: { [DAY]: { codDollar: ledgerCod, dodDollar: ledgerDod, totalCount: 2 } },
            zoew_monthly_revenue_cod_dod: { [MONTH]: { codDollar: ledgerCod, dodDollar: ledgerDod, totalCount: 2 } },
            zoew_daily_pickup_cod_dod: {},
            zoew_scanner_lookup: {},
            zoew_barcode_registry: {},
            zoew_settings: { exchange_rate: 4100 }
        },
        expect: {
            ledgerCod: ledgerCod, ledgerDod: ledgerDod,
            uncollectedCod: 12, uncollectedDod: 3,
            collectedCod: 20, collectedDod: 5, collectedTotal: 25,
            allTotal: 40
        }
    };
}

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
        s.listen(0, '127.0.0.1', () => res(s));   // ⛔ port 0 ជានិច្ច
    });
}

(async () => {
    if (!BOOT_SRC || !LICENSE_STUB) { console.log('\nFAIL ' + fail); process.exit(1); }
    const seed = statsSeed();
    const E = seed.expect;
    const BOOT = new Function(BOOT_SRC + '\nreturn BOOT;')();
    const browser = await chromium.launch({ executablePath: CHROME });
    const server = await serve(APP_DIR);
    const port = server.address().port;
    const ctx = await browser.newContext({ viewport: { width: 412, height: 780 } });
    const page = await ctx.newPage();
    page.on('dialog', (d) => d.accept());
    await page.route('**', (r) => {
        const u = r.request().url();
        if (u.indexOf('/license-verify.js') !== -1) return r.fulfill({ status: 200, contentType: 'application/javascript', body: LICENSE_STUB });
        if (u.startsWith('http://127.0.0.1:' + port)) return r.continue();
        return r.abort();
    });
    await page.addInitScript(`window.localStorage.setItem('zoew_firebase_config', ${JSON.stringify(JSON.stringify({ apiKey: 'k', databaseURL: 'https://fake-default-rtdb.firebaseio.com', projectId: 'p' }))});`);
    await page.addInitScript('(' + BOOT.toString() + ')(' + JSON.stringify(seed.store) + ');');
    await page.goto('http://127.0.0.1:' + port + '/', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(1800);

    const res = await page.evaluate(async (day) => {
        const out = { screens: {}, guard: {} };
        // ⛔ ជាន់អប្បបរមា ៖ ត្រូវមានកញ្ចប់មិនទាន់យក **ពិត** — បើអត់
        // «ចំណូល = ledger» ត្រឹមត្រូវ ➜ ការអះអាងខាងក្រោមទទេ។
        const unc = (typeof uncollectedValueByDate === 'function') ? uncollectedValueByDate() : null;
        out.guard.uncollected = unc && unc[day] ? { cod: unc[day].cod, dod: unc[day].dod } : null;
        out.guard.measurable = (typeof collectedValueIsMeasurable === 'function') ? collectedValueIsMeasurable() : null;
        out.guard.histLen = (typeof scanHistory !== 'undefined' && scanHistory) ? scanHistory.length : -1;

        // អានលេខចេញពី **DOM ពិត** ក្រោយបើកអេក្រង់នីមួយៗ
        function readCards(containerId) {
            const c = document.getElementById(containerId);
            if (!c) return null;
            const cards = [];
            c.querySelectorAll('.stat-card-item').forEach((el) => {
                const txt = el.textContent || '';
                const collected = /ចំណូល \(យករួច\)៖\s*\$?([\d.,]+)/.exec(txt);
                const all = /តម្លៃកញ្ចប់ទាំងអស់៖\s*\$?([\d.,]+)/.exec(txt);
                cards.push({
                    text: txt.replace(/\s+/g, ' ').slice(0, 200),
                    collected: collected ? parseFloat(collected[1].replace(/,/g, '')) : null,
                    all: all ? parseFloat(all[1].replace(/,/g, '')) : null
                });
            });
            return cards;
        }
        if (typeof openDailyStatsModal === 'function') { openDailyStatsModal(); await new Promise(r => setTimeout(r, 250)); }
        out.screens.daily = readCards('dailyStatsContainer');
        if (typeof closeModal === 'function') closeModal();
        await new Promise(r => setTimeout(r, 150));
        if (typeof openMonthlyStatsModal === 'function') { openMonthlyStatsModal(); await new Promise(r => setTimeout(r, 250)); }
        out.screens.monthly = readCards('monthlyStatsContainer');
        if (typeof closeModal === 'function') closeModal();
        return out;
    }, DAY);

    // ═══ ជាន់អប្បបរមា ═══
    check(res.guard.histLen >= 2, '⛔ ជាន់អប្បបរមា ៖ ប្រវត្តិផ្ទុកពិត (' + res.guard.histLen + ' item)');
    check(!!res.guard.uncollected && res.guard.uncollected.cod === E.uncollectedCod && res.guard.uncollected.dod === E.uncollectedDod,
        '⛔ ជាន់អប្បបរមា ៖ មានកញ្ចប់ **មិនទាន់យក** ពិត (COD ' + E.uncollectedCod + ' · DOD ' + E.uncollectedDod + ')',
        'ឃើញ ៖ ' + JSON.stringify(res.guard.uncollected) + ' ➜ បើគ្មានកញ្ចប់រង់ចាំ នោះ «ចំណូល = ledger» ត្រឹមត្រូវ ➜ ការវាស់ទទេ');
    check(res.guard.measurable === true, '⛔ ជាន់អប្បបរមា ៖ ទិដ្ឋភាពពេញលេញ (`collectedValueIsMeasurable()`)',
        'មិនពេញ ➜ អេក្រង់បង្ហាញ «—» ➜ លេខមិនអាចវាស់');

    // ═══ អេក្រង់នីមួយៗ ៖ លេខដែលអ្នកប្រើអាន ═══
    [['📅 ស្ថិតិប្រចាំថ្ងៃ', res.screens.daily], ['📊 ស្ថិតិ ៣ ខែ', res.screens.monthly]].forEach(([label, cards]) => {
        if (!cards || !cards.length) { bad(label + ' ៖ រកកាតស្ថិតិមិនឃើញ', 'អេក្រង់មិនបើក ឬ container ប្តូរឈ្មោះ'); return; }
        const card = cards[0];
        check(card.collected !== null, label + ' ៖ អានលេខ «ចំណូល (យករួច)» ចេញពី DOM បាន', card.text);
        if (card.collected === null) return;
        // ⛔ ការអះអាងស្នូល ៖ ចំណូល = ledger **ដក** កញ្ចប់មិនទាន់យក
        check(Math.abs(card.collected - E.collectedTotal) < 0.005,
            label + ' ៖ «ចំណូល (យករួច)» = ' + E.collectedTotal + ' (ledger ' + (E.ledgerCod + E.ledgerDod) + ' ដក មិនទាន់យក ' + (E.uncollectedCod + E.uncollectedDod) + ')',
            'ឃើញ ' + card.collected + ' — បើវាស្មើ ' + (E.ledgerCod + E.ledgerDod) + ' នោះអេក្រង់បង្ហាញ **ledger ឆៅ** ➜ លេខធំជាងការពិត');
        // ⛔ ទិសផ្ទុយ ៖ «តម្លៃកញ្ចប់ទាំងអស់» ត្រូវនៅតែជា ledger ពេញ (តម្លាភាព)
        if (card.all !== null) {
            check(Math.abs(card.all - E.allTotal) < 0.005,
                label + ' ៖ «តម្លៃកញ្ចប់ទាំងអស់» = ' + E.allTotal + ' (ledger ពេញ — មិនត្រូវកាត់)',
                'ឃើញ ' + card.all);
            check(card.collected < card.all,
                label + ' ៖ ចំណូល **តូចជាង** តម្លៃកញ្ចប់ទាំងអស់ ខណៈមានកញ្ចប់រង់ចាំ',
                card.collected + ' ធៀប ' + card.all);
        }
    });

    await ctx.close();
    server.close();
    await browser.close();
    console.log('\n' + (fail ? 'FAIL ' + fail + ' / ok ' + pass : 'PASS ' + pass + '/' + pass));
    process.exit(fail ? 1 : 0);
})();
