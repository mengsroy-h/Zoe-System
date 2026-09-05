// ⛔ **អ្នកយាមលុយសរុបរបស់ *ជួរដេក* — មិនមែន ledger។**
//
// ⚠️ វាក្យស័ព្ទ (ងាយច្រឡំ) ៖ **`barcode` = កញ្ចប់ ១** (អីវ៉ាន់ ១ មាន barcode ១)។
// **`item` = ជួរដេកមួយក្នុងតារាង = អតិថិជនម្នាក់ក្នុងថ្ងៃមួយ** — `addOrUpdateEntry`
// merge តាម `phone` + `scanDate` ➜ `item.barcodes[]` ជាកញ្ចប់ទាំងអស់របស់អតិថិជននោះ
// ហើយ `item.count = item.barcodes.length` = **ចំនួនកញ្ចប់** ➜ ស្លាក «កញ្ចប់សរុប»
// លើកាតស្ថិតិ **ត្រឹមត្រូវ**។ ⛔ កុំហៅ `item` ថា «កញ្ចប់»។
//
// 🔴 ហេតុអ្វីវាមាន (វាស់បាន 2026-09-05) ៖ ការចាក់កំហុស **០.០១ ដុល្លារ** ចូល
// រូបមន្តលុយរួម `recalcItemMoneyFromBarcodes()` រួចរត់ **checker ១៣១** លើ tree
// នោះ ➜ **១ តែមួយគត់** ចាប់បាន (`concurrent-scan-test` ដែលពិនិត្យ `price`
// **ដោយចៃដន្យ** — វាជា checker សម្រាប់ការស្កេនស្របគ្នា មិនមែនសម្រាប់លុយ)។
// អ្នកយាមលុយធំៗទាំងអស់បៃតង ៖ `revenue-fuzz` (PASS 2/2 លើ ១២ លំដាប់ × ៤៥ ops) ·
// `money-guardian` · `ledger-clamp-symmetry` · `revenue-rules-clamp` ·
// `emu/ledger-revert-emu` · `duplicate-money` · `pickup-ledger` · `monthly-report`។
//
// មូលហេតុនៃចន្លោះ ៖ អ្នកយាមទាំងអស់មើល **ledger**
// (`zoew_daily_revenue_cod_dod`) ខណៈ `item.cod/.dod/.price` ជា **លេខផ្សេង** —
// វាជាអ្វីដែលអ្នកប្រើ **មើលឃើញលើអេក្រង់** និងអ្វីដែលចេញក្នុង **Excel export**។
// លុយអាចខុសនៅទីនោះ ខណៈ ledger ត្រឹមត្រូវ ➜ គ្មាននរណាដឹង។
//
// ⛔ Invariant មាន **លក្ខខណ្ឌ** ៖ item ចាស់អាចគ្មាន `barcodes` សោះ
// (`initDatabaseListeners` normalize ពួកវាពី `price`) ➜ ការអះអាងឈរតែពេល
// `barcodes` ជា array មិនទទេ។
//
//   ជាន់ ១ (AST)      ៖ រាល់ការសរសេរលុយលើ item ត្រូវឆ្លងកាត់ helper ឬមានហេតុផល
//   ជាន់ ២ (vm)       ៖ helper ត្រឹមត្រូវលើ input ច្រើន រួម rounding
//   ជាន់ ៣ (browser)  ៖ operation **កំណត់** ➜ invariant លើ item ពិតទាំងអស់
//
// ⛔ ជាន់ ៣ ជាអ្នកចាប់ពិត ហើយវា **កំណត់** មិនមែនចៃដន្យ — «រត់ជ្រៅជាងមុន»
// ជាការសំណាង មិនមែនយុទ្ធសាស្ត្រ។

let chromium;
try { chromium = require('playwright-core').chromium; } catch (e) {
    console.log('SKIP — ត្រូវការ playwright-core (npm i playwright-core)');
    process.exit(0);
}
let acorn;
try { acorn = require('acorn'); } catch (e) {
    console.log('SKIP — ត្រូវការ acorn (npm i acorn)');
    process.exit(0);
}
const fs = require('fs');
const http = require('http');
const path = require('path');
const CHROME = process.env.ITEMMONEY_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
if (!fs.existsSync(CHROME)) { console.log('SKIP — រកមិនឃើញ Chromium នៅ ' + CHROME); process.exit(0); }

const ROOT = process.env.ITEMMONEY_APP_DIR || path.join(__dirname, '..');
const APP_JS = path.join(ROOT, 'ZoeW', 'app.js');
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm' };

let pass = 0, fail = 0;
function ok(n) { console.log('  ok    ' + n); pass++; }
function bad(n, d) { console.log('  FAIL  ' + n + (d ? '\n        ' + d : '')); fail++; }
function check(c, n, d) { c ? ok(n) : bad(n, d); }

if (!fs.existsSync(APP_JS)) { bad('រកមិនឃើញ ' + APP_JS + ' ➜ គ្មានអ្វីត្រូវពិនិត្យ'); console.log('\nFAIL 1'); process.exit(1); }
const SRC = fs.readFileSync(APP_JS, 'utf8');

// ═══ ជាន់ ១ ៖ AST — កន្លែងសរសេរលុយលើ item ═══
// ⛔ allowlist ៖ រាល់ធាតុមានហេតុផលសរសេរជាប់។ ធាតុគ្មានហេតុផលនឹងលាក់កំហុសបន្ទាប់។
const WRITE_ALLOW = {
    recalcItemMoneyFromBarcodes: 'helper រួម — ជាប្រភពតែមួយនៃរូបមន្ត',
    initDatabaseListeners: 'normalize ពេលអាន ៖ item ចាស់គ្មាន barcodes ➜ ដេរីវេពី price',
    removeSingleBarcode: 'itemToTrash មាន barcode តែ ១ (`barcodes: [removedBc]`) ➜ ស្មើផលបូក',
    appendRestoreRevenueIncrements: 'ledger (daily/monthly) មិនមែន item',
    buildMonthlyReport: 'សរុបរបាយការណ៍ មិនមែន item',
    buildTrashGroups: 'ក្រុមបង្ហាញក្នុងធុងសំរាម មិនមែន item',
    renderTrashSummary: 'តួលេខសរុបបង្ហាញ មិនមែន item',
    uncollectedItemValue: 'តម្លៃមិនទាន់យក (out) មិនមែន item',
    uncollectedValueByDate: 'bucket សរុប មិនមែន item',
    uncollectedValueForMonth: 'bucket សរុប មិនមែន item',
    saveEditedBarcodePrice: 'សរសេរលើ **barcode** (b/targetB/staleB) មិនមែន item',
    addOrUpdateEntry: 'តែ `count` (ចំនួន barcode) — លុយឆ្លងកាត់ helper',
    claimAndCleanupItem: 'តែ `count` — លុយឆ្លងកាត់ helper',
    dropOptimisticBarcode: 'តែ `count` — លុយឆ្លងកាត់ helper',
    executeRestoreItem: 'តែ `count` — លុយឆ្លងកាត់ helper',
    restoreClaimedItemToScanHistory: 'តែ `count` — លុយឆ្លងកាត់ helper'
};
{
    const ast = acorn.parse(SRC, { ecmaVersion: 2022 });
    const MONEY = new Set(['cod', 'dod', 'price']);
    const hits = [];
    (function walk(n, fnName) {
        if (!n || typeof n !== 'object') return;
        let fn = fnName;
        if (n.type === 'FunctionDeclaration' && n.id) fn = n.id.name;
        if (n.type === 'AssignmentExpression' && n.left && n.left.type === 'MemberExpression'
            && n.left.property && MONEY.has(n.left.property.name)) {
            hits.push({ fn: fn || '(top)', line: SRC.slice(0, n.start).split('\n').length });
        }
        for (const k of Object.keys(n)) {
            const v = n[k];
            if (Array.isArray(v)) v.forEach((x) => walk(x, fn));
            else if (v && typeof v === 'object' && v.type) walk(v, fn);
        }
    })(ast, null);
    check(hits.length >= 20, '⛔ ជាន់អប្បបរមា ៖ AST ឃើញការសរសេរលុយ >= 20 (' + hits.length + ')',
        'ស្កេនមិនឃើញអ្វី ➜ ការអះអាងអវត្តមានខាងក្រោមពិតដោយស្វ័យប្រវត្តិ');
    const rogue = hits.filter((h) => !WRITE_ALLOW[h.fn]);
    check(rogue.length === 0, 'រាល់ការសរសេរ `.cod/.dod/.price` ស្ថិតក្នុង function ដែលមានហេតុផលកត់ត្រា',
        rogue.map((r) => r.fn + ' @' + r.line).join(' · '));
    // ⛔ allowlist មិនត្រូវមានធាតុងាប់
    const seen = new Set(hits.map((h) => h.fn).concat(
        // `count`-only entries នៅតែជាធាតុស្របច្បាប់ ➜ រាប់ពួកវាដែរ
        (function () {
            const c = [];
            (function walk2(n, fnName) {
                if (!n || typeof n !== 'object') return;
                let fn = fnName;
                if (n.type === 'FunctionDeclaration' && n.id) fn = n.id.name;
                if (n.type === 'AssignmentExpression' && n.left && n.left.type === 'MemberExpression'
                    && n.left.property && n.left.property.name === 'count') c.push(fn || '(top)');
                for (const k of Object.keys(n)) {
                    const v = n[k];
                    if (Array.isArray(v)) v.forEach((x) => walk2(x, fn));
                    else if (v && typeof v === 'object' && v.type) walk2(v, fn);
                }
            })(ast, null);
            return c;
        })()));
    const dead = Object.keys(WRITE_ALLOW).filter((k) => !seen.has(k));
    check(dead.length === 0, '⛔ allowlist គ្មានធាតុងាប់ (ធាតុដែលលែងបិទបាំងអ្វី)', dead.join(' · '));
    const noReason = Object.keys(WRITE_ALLOW).filter((k) => String(WRITE_ALLOW[k]).length < 20);
    check(noReason.length === 0, '⛔ រាល់ធាតុ allowlist មានហេតុផលសរសេរជាប់', noReason.join(' · '));
}

// ═══ ជាន់ ២ ៖ vm — helper ត្រឹមត្រូវលើ input ច្រើន ═══
{
    const vm = require('vm');
    const ast = acorn.parse(SRC, { ecmaVersion: 2022 });
    let helper = null;
    for (const n of ast.body) if (n.type === 'FunctionDeclaration' && n.id && n.id.name === 'recalcItemMoneyFromBarcodes') helper = SRC.slice(n.start, n.end);
    check(!!helper, 'ស្រង់ `recalcItemMoneyFromBarcodes` ចេញពី app.js ពិត');
    if (helper) {
        const ctx = { Math, parseFloat, Number, Array, Object, JSON };
        vm.createContext(ctx);
        vm.runInContext(helper, ctx);
        const round2 = (x) => Math.round(x * 100) / 100;
        const CASES = [];
        const V = [0, 1, 2.5, 10, 20.5, 0.005, 0.1, 0.2, 7.75, 1e6, '3.3', '', 'abc', null, undefined, NaN, Infinity, true];
        for (const a of V) for (const b of V) CASES.push([{ cod: a, dod: b }]);
        CASES.push([{ cod: 0.1, dod: 0 }, { cod: 0.2, dod: 0 }]);          // float ៖ 0.1+0.2
        CASES.push([{ cod: 1.005, dod: 0 }]);                              // rounding edge
        CASES.push([{ cod: 33.33, dod: 0 }, { cod: 33.33, dod: 0 }, { cod: 33.34, dod: 0 }]);
        let bad2 = 0, ran = 0;
        for (const bcs of CASES) {
            // ⛔ រូបមន្តរំពឹងត្រូវគណនាលើ **ច្បាប់ចម្លងដដែល** ដែល helper ឃើញ ៖
            // `JSON.parse(JSON.stringify())` បម្លែង `Infinity` ➜ `null` ➜ ការគណនា
            // លើ input ដើម ធ្វើឲ្យ checker ធ្លាក់ដោយ **កំហុសរបស់អ្នកវាស់** មិនមែនកូដ។
            const t = { barcodes: JSON.parse(JSON.stringify(bcs)) };
            const seenBcs = t.barcodes;
            ctx.recalcItemMoneyFromBarcodes(t);
            const eCod = round2(seenBcs.reduce((s, b) => s + (parseFloat(b.cod) || 0), 0));
            const eDod = round2(seenBcs.reduce((s, b) => s + (parseFloat(b.dod) || 0), 0));
            const ePrice = round2(eCod + eDod);
            ran++;
            if (t.cod !== eCod || t.dod !== eDod || t.price !== ePrice) {
                bad2++;
                if (bad2 <= 3) console.log('        ' + JSON.stringify(bcs) + ' ➜ ' + JSON.stringify({ cod: t.cod, dod: t.dod, price: t.price }) + ' រំពឹង ' + JSON.stringify({ cod: eCod, dod: eDod, price: ePrice }));
            }
        }
        check(ran >= 300, '⛔ ជាន់អប្បបរមា ៖ ករណី helper >= 300 (' + ran + ')');
        check(bad2 === 0, 'helper ៖ ' + ran + ' ករណី ➜ `cod`/`dod`/`price` ត្រឹមត្រូវទាំងអស់ (រួម float · string · NaN · rounding)');
    }
}

// ═══ ជាន់ ៣ ៖ browser ពិត — invariant លើ item ក្រោយ operation **កំណត់** ═══
// ⛔ BOOT (fake SDK ដែលអនុវត្ត `.validate` ពិត) អានចេញពី `revenue-fuzz-test.js`
// **មិនចម្លង** — ការចម្លងបង្កើតច្បាប់ចម្លងទី ២ ដែលនឹងឃ្លាតគ្នាជុំក្រោយ។
const FUZZ_PATH = path.join(__dirname, 'revenue-fuzz-test.js');
const FUZZ = fs.readFileSync(FUZZ_PATH, 'utf8');
function slice(from, to, what) {
    const a = FUZZ.indexOf(from), b = FUZZ.indexOf(to);
    if (a === -1 || b === -1 || b <= a) { bad('ស្រង់ ' + what + ' ចេញពី revenue-fuzz-test.js មិនបាន'); return null; }
    return FUZZ.slice(a, b);
}
const BOOT_SRC = slice('const BOOT = function (seed) {', 'function seedData()', 'BOOT');
const SEED_SRC = slice('function seedData()', '// deterministic PRNG', 'seedData');
const LIC_A = FUZZ.indexOf('const LICENSE_STUB = `');
const LICENSE_STUB = LIC_A === -1 ? null : FUZZ.slice(LIC_A + 'const LICENSE_STUB = `'.length, FUZZ.indexOf('};`') + 2);
check(!!(BOOT_SRC && SEED_SRC && LICENSE_STUB), 'ស្រង់ BOOT · seedData · LICENSE_STUB ចេញពី `revenue-fuzz-test.js` (មិនចម្លង)');

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
    if (!BOOT_SRC || !SEED_SRC || !LICENSE_STUB) { console.log('\n' + (fail ? 'FAIL ' + fail + ' / ok ' + pass : 'PASS')); process.exit(fail ? 1 : 0); }
    const mod = new Function(BOOT_SRC + SEED_SRC + '\nreturn { BOOT: BOOT, seedData: seedData };')();
    const dir = path.join(ROOT, 'ZoeW');
    const browser = await chromium.launch({ executablePath: CHROME });
    const server = await serve(dir);
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
    const seed = mod.seedData();
    await page.addInitScript(`window.localStorage.setItem('zoew_firebase_config', ${JSON.stringify(JSON.stringify({ apiKey: 'k', databaseURL: 'https://fake-default-rtdb.firebaseio.com', projectId: 'p' }))});`);
    await page.addInitScript('(' + mod.BOOT.toString() + ')(' + JSON.stringify(seed) + ');');
    await page.goto('http://127.0.0.1:' + port + '/', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(1800);

    // ⛔ operation **កំណត់** — លំដាប់ដដែលរាល់ការរត់
    const OPS = [
        ['បិទ barcode ១', async () => { const it = scanHistory[0]; await window.toggleIndividualBarcodeClose(it.id, it.barcodes[0].code); }],
        ['បិទកញ្ចប់ទាំងមូល', async () => { await window.toggleCloseStatus(scanHistory[1].id); }],
        ['ដក barcode ១', async () => { const it = scanHistory.find(x => x.barcodes && x.barcodes.length > 1); if (it) await window.removeSingleBarcode(it.id, it.barcodes[0].code); }],
        ['លុបកញ្ចប់', async () => { await window.deleteSingleItem(scanHistory[scanHistory.length - 1].id); }],
        ['ស្តារពីធុងសំរាម', async () => { if (deletedItems.length) { window.promptRestoreDeletedItem(deletedItems[0].id); await window.executeRestoreItem(); } }],
        ['បើកវិញ', async () => { const it = scanHistory.find(x => x.barcodes && x.barcodes.some(b => b.isClosed)); if (it) { const b = it.barcodes.find(y => y.isClosed); await window.toggleIndividualBarcodeClose(it.id, b.code); } }],
        ['សម្អាតស្វ័យប្រវត្តិ', async () => { window.runAutomaticCleanupRules(); }]
    ];
    const results = await page.evaluate(async (opsSrc) => {
        const round2 = (x) => Math.round(x * 100) / 100;
        // ⛔ Invariant **មានលក្ខខណ្ឌ** ៖ ឈរតែពេល `barcodes` ជា array មិនទទេ
        // (item ចាស់គ្មាន barcodes ➜ `initDatabaseListeners` ដេរីវេពី `price`)។
        // ⛔ **ត្រូវពិនិត្យទិន្នន័យលើ server ដែរ មិនត្រឹមសតិ។** វាស់បាន ៖
        // `initDatabaseListeners` គណនា `item.price` **ឡើងវិញពេលអាន**
        // (`item.price = Math.round((item.cod + item.dod) * 100) / 100`) ➜ វា
        // **ព្យាបាល** កំហុសក្នុងសតិ ➜ invariant លើ `scanHistory` តែម្យ៉ាង
        // **បៃតងក្លែងក្លាយ** ខណៈលេខខុសអង្គុយលើ server (និងចេញក្នុង Excel)។
        function storeItems() {
            const st = window.__fakeStore || {};
            const out = [];
            for (const node of ['zoew_scan_history_cod_dod', 'zoew_recently_deleted_cod_dod']) {
                const bag = st[node];
                if (!bag) continue;
                for (const k of Object.keys(bag)) { const v = bag[k]; if (v && typeof v === 'object') out.push(Object.assign({ id: v.id || k }, v)); }
            }
            return out;
        }
        function violations(tag) {
            const out = [];
            const lists = [['scanHistory', typeof scanHistory !== 'undefined' ? scanHistory : []],
                           ['deletedItems', typeof deletedItems !== 'undefined' ? deletedItems : []],
                           ['server', storeItems()]];
            for (const [where, arr] of lists) {
                for (const it of (arr || [])) {
                    if (!it || !Array.isArray(it.barcodes) || !it.barcodes.length) continue;
                    const eCod = round2(it.barcodes.reduce((s, b) => s + (parseFloat(b && b.cod) || 0), 0));
                    const eDod = round2(it.barcodes.reduce((s, b) => s + (parseFloat(b && b.dod) || 0), 0));
                    const ePrice = round2(eCod + eDod);
                    if (round2(parseFloat(it.cod) || 0) !== eCod) out.push(tag + '/' + where + '/' + it.id + ' cod ' + it.cod + ' រំពឹង ' + eCod);
                    if (round2(parseFloat(it.dod) || 0) !== eDod) out.push(tag + '/' + where + '/' + it.id + ' dod ' + it.dod + ' រំពឹង ' + eDod);
                    if (round2(parseFloat(it.price) || 0) !== ePrice) out.push(tag + '/' + where + '/' + it.id + ' price ' + it.price + ' រំពឹង ' + ePrice);
                }
            }
            return out;
        }
        function counted() {
            let n = 0, srv = 0;
            for (const arr of [typeof scanHistory !== 'undefined' ? scanHistory : [], typeof deletedItems !== 'undefined' ? deletedItems : []])
                for (const it of (arr || [])) if (it && Array.isArray(it.barcodes) && it.barcodes.length) n++;
            for (const it of storeItems()) if (it && Array.isArray(it.barcodes) && it.barcodes.length) srv++;
            return { mem: n, srv: srv };
        }
        const bad = [];
        let checked = 0, checkedSrv = 0, ran = 0;
        bad.push(...violations('ដើម'));
        { const c = counted(); checked += c.mem; checkedSrv += c.srv; }
        for (const [label, fnSrc] of opsSrc) {
            try { await (new Function('return (' + fnSrc + ')')())(); ran++; } catch (e) { bad.push('op «' + label + '» បោះ ៖ ' + (e && e.message)); }
            await new Promise((r) => setTimeout(r, 220));
            bad.push(...violations(label));
            { const c = counted(); checked += c.mem; checkedSrv += c.srv; }
        }
        return { bad, checked, checkedSrv, ran };
    }, OPS.map(([l, f]) => [l, f.toString()]));

    check(results.ran === OPS.length, '⛔ ជាន់អប្បបរមា ៖ operation ទាំង ' + OPS.length + ' រត់ពិត (' + results.ran + ')',
        'op ខ្លះមិនរត់ ➜ ការវាស់មិនឈានដល់ផ្លូវដែលចង់វាស់');
    check(results.checked >= 20, '⛔ ជាន់អប្បបរមា ៖ item ក្នុងសតិដែលពិនិត្យ >= 20 (' + results.checked + ')',
        'គ្មាន item ➜ «គ្មានការបំពាន» ពិតដោយស្វ័យប្រវត្តិ');
    check(results.checkedSrv >= 20, '⛔ ជាន់អប្បបរមា ៖ item **លើ server** ដែលពិនិត្យ >= 20 (' + results.checkedSrv + ')',
        'listener normalize `price` ក្នុងសតិ ➜ បើមិនពិនិត្យ server ទេ ការវាស់នេះបៃតងក្លែងក្លាយ');
    check(results.bad.length === 0, 'invariant ៖ `item.cod/.dod/.price` ស្មើផលបូក barcodes ក្រោយ operation ទាំង ' + OPS.length + ' (សតិ ' + results.checked + ' · server ' + results.checkedSrv + ')',
        results.bad.slice(0, 6).join('\n        '));

    await ctx.close();
    server.close();
    await browser.close();
    console.log('\n' + (fail ? 'FAIL ' + fail + ' / ok ' + pass : 'PASS ' + pass + '/' + pass));
    process.exit(fail ? 1 : 0);
})();
