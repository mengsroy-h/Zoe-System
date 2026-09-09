// 🩺 ការវាស់លុយលើ **ទិន្នន័យផលិតកម្មពិត** — ⛔ អានសុទ្ធសាធ · មិនសរសេរអ្វីទាំងអស់។
//
// ហេតុអ្វីវាមាន ៖ checker ក្នុង `run-all.sh` វាស់ **កូដ**។ គ្មានមួយណាវាស់ថា
// **លុយក្នុងប្រព័ន្ធរបស់អ្នកថ្ងៃនេះ ត្រឹមត្រូវឬអត់** ទេ។ ឧបករណ៍នេះយកកូដលុយ
// **ពិត** ចេញពី `ZoeW/app.js` មករត់លើ **dump ពិត** របស់អ្នក រួចរាយលេខ។
//
// របៀបប្រើ ៖
//   Firebase Console ➜ Realtime Database ➜ ⋮ ➜ Export JSON  (ឬ backup .json.gz)
//   node audit-tools/money-reality-check.js <ឯកសារ.json ឬ .json.gz>
//
// ⛔ ឯកសារ dump មានលេខទូរស័ព្ទ និងលុយពិត — ឧបករណ៍នេះ **មិនបោះពុម្ព
// លេខទូរស័ព្ទ ឬ barcode ណាមួយឡើយ** (មានតែថ្ងៃ · ចំនួន · ទឹកប្រាក់សរុប)។
// ⛔ វា **មិនភ្ជាប់បណ្តាញ** និង **មិនសរសេរទៅ Firebase** ដាច់ខាត។
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const vm = require('vm');

const ROOT = process.env.MONEYREAL_APP_DIR || path.join(__dirname, '..');
const APP_JS = path.join(ROOT, 'ZoeW', 'app.js');
const file = process.argv[2];

let pass = 0, warn = 0, fail = 0;
const notes = [];
function ok(label, detail) { console.log('  ✅ ' + label + (detail ? '  — ' + detail : '')); pass++; }
function bad(label, detail) { console.log('  ❌ ' + label + (detail ? '\n       ' + detail : '')); fail++; }
function may(label, detail) { console.log('  ⚠️  ' + label + (detail ? '\n       ' + detail : '')); warn++; }
function check(cond, label, detail) { cond ? ok(label, cond === true && detail ? detail : undefined) : bad(label, detail); }

if (!file) {
    console.log('របៀបប្រើ ៖ node audit-tools/money-reality-check.js <dump.json ឬ dump.json.gz>');
    console.log('  យក dump ៖ Firebase Console ➜ Realtime Database ➜ ⋮ ➜ Export JSON');
    process.exit(2);
}
if (!fs.existsSync(APP_JS)) { console.log('❌ រកមិនឃើញ ' + APP_JS); process.exit(1); }
if (!fs.existsSync(file)) { console.log('❌ រកមិនឃើញឯកសារ ' + file); process.exit(1); }

let raw = fs.readFileSync(file);
if (file.endsWith('.gz')) raw = zlib.gunzipSync(raw);
let db;
try { db = JSON.parse(raw.toString('utf8')); }
catch (e) { console.log('❌ អានឯកសារមិនបាន (មិនមែន JSON?) ៖ ' + e.message); process.exit(1); }

// ⛔ ស្រង់កូដលុយ **ពិត** ចេញពី app.js — កុំសរសេរតេស្តលើកូដចម្លង
const SRC = fs.readFileSync(APP_JS, 'utf8');
function sliceFn(src, name) {
    let s = src.indexOf('function ' + name + '(');
    if (s === -1) return null;
    if (src.slice(Math.max(0, s - 6), s) === 'async ') s -= 6;
    let d = 0, started = false, i = src.indexOf('{', s);
    for (; i < src.length; i++) {
        if (src[i] === '{') { d++; started = true; }
        else if (src[i] === '}') { d--; if (started && d === 0) { i++; break; } }
    }
    return src.slice(s, i);
}
const WANT = ['ledgerNumber', 'statsMonthOf', 'statsPositive', 'statsMoney', 'statsCount',
    'countPickedUpCustomers', 'uncollectedBarcodeValue', 'uncollectedItemValue',
    'uncollectedValueByDate', 'collectedValueOf', 'collectedValueForMonth',
    'recalcItemMoneyFromBarcodes', 'barcodeRegistryKey', 'rawSnapshotToItemList'];
const missing = [];
const bodies = WANT.map((n) => {
    const b = sliceFn(SRC, n);
    if (b) return b;
    missing.push(n);
    return 'function ' + n + '() { return undefined; }';
}).join('\n');

const N = {
    history: 'zoew_scan_history_cod_dod',
    deleted: 'zoew_recently_deleted_cod_dod',
    daily: 'zoew_daily_revenue_cod_dod',
    monthly: 'zoew_monthly_revenue_cod_dod',
    pickup: 'zoew_daily_pickup_cod_dod'
};
const sb = {
    console, PICKUP_DATE_KEY_PATTERN: /^\d{4}-\d{2}-\d{2}$/,
    scanHistory: [], deletedItems: []
};
vm.createContext(sb);
vm.runInContext(bodies, sb);

const toList = (node) => (sb.rawSnapshotToItemList ? sb.rawSnapshotToItemList(node) : [])
    .filter((x) => x && typeof x === 'object');
const history = toList(db[N.history]);
const deleted = toList(db[N.deleted]);
const daily = (db[N.daily] && typeof db[N.daily] === 'object') ? db[N.daily] : {};
const monthly = (db[N.monthly] && typeof db[N.monthly] === 'object') ? db[N.monthly] : {};
const pickup = (db[N.pickup] && typeof db[N.pickup] === 'object') ? db[N.pickup] : {};
sb.scanHistory = history; sb.deletedItems = deleted;

const r2 = (n) => Math.round(n * 100) / 100;
const $ = (n) => '$' + r2(n).toFixed(2);
const barcodesOf = (it) => (Array.isArray(it.barcodes) ? it.barcodes.filter(Boolean) : []);

console.log('\n╔══════════════════════════════════════════════════════════╗');
console.log('║  🩺 ការវាស់លុយលើទិន្នន័យពិត — អានសុទ្ធសាធ                ║');
console.log('╚══════════════════════════════════════════════════════════╝');
console.log('ឯកសារ ៖ ' + path.basename(file) + '  (' + (raw.length / 1024).toFixed(0) + ' KB)');
console.log('រក function លុយពិត ៖ ' + (WANT.length - missing.length) + '/' + WANT.length
    + (missing.length ? '  ⚠️ បាត់ ៖ ' + missing.join(', ') : ''));
if (WANT.length - missing.length < 12) {
    console.log('❌ ស្រង់កូដពិតមិនគ្រប់ ➜ លទ្ធផលគ្មានន័យ'); process.exit(1);
}
console.log('\nទំហំទិន្នន័យ ៖ ប្រវត្តិ ' + history.length + ' ជួរដេក · ធុងសំរាម ' + deleted.length
    + ' · ថ្ងៃក្នុង ledger ' + Object.keys(daily).length + ' · ខែ ' + Object.keys(monthly).length);

// ── ១. ledger ខែ ត្រូវស្មើផលបូក ledger ថ្ងៃ ─────────────────────────────
console.log('\n── ១. ledger ខែ = ផលបូក ledger ថ្ងៃ ──');
const sumByMonth = {};
Object.keys(daily).forEach((d) => {
    if (!sb.PICKUP_DATE_KEY_PATTERN.test(d)) return;
    const ym = d.slice(0, 7);
    const b = sumByMonth[ym] || (sumByMonth[ym] = { cod: 0, dod: 0, count: 0 });
    b.cod = r2(b.cod + sb.statsMoney(daily[d].codDollar));
    b.dod = r2(b.dod + sb.statsMoney(daily[d].dodDollar));
    b.count += sb.statsCount(daily[d].totalCount);
});
let monthsChecked = 0;
Object.keys(monthly).sort().forEach((ym) => {
    const m = monthly[ym] || {};
    const want = sumByMonth[ym];
    if (!want) { may('ខែ ' + ym + ' មានក្នុង node ខែ តែគ្មានថ្ងៃណាក្នុង node ថ្ងៃ',
        'ledger ខែ ៖ ' + $(sb.statsMoney(m.codDollar) + sb.statsMoney(m.dodDollar))); return; }
    monthsChecked++;
    const dc = r2(sb.statsMoney(m.codDollar) - want.cod);
    const dd = r2(sb.statsMoney(m.dodDollar) - want.dod);
    const dn = sb.statsCount(m.totalCount) - want.count;
    if (!dc && !dd && !dn) {
        ok('ខែ ' + ym + ' ស៊ីគ្នាបេះបិទ', 'COD ' + $(want.cod) + ' · DOD ' + $(want.dod) + ' · ' + want.count + ' កញ្ចប់');
    } else {
        bad('ខែ ' + ym + ' ឃ្លាតពីផលបូកថ្ងៃ',
            'ខែ ៖ COD ' + $(sb.statsMoney(m.codDollar)) + ' · DOD ' + $(sb.statsMoney(m.dodDollar)) + ' · ' + sb.statsCount(m.totalCount) + ' កញ្ចប់\n'
            + '       ថ្ងៃ ៖ COD ' + $(want.cod) + ' · DOD ' + $(want.dod) + ' · ' + want.count + ' កញ្ចប់\n'
            + '       គម្លាត ៖ COD ' + $(dc) + ' · DOD ' + $(dd) + ' · ' + dn + ' កញ្ចប់');
        notes.push('ខែ ' + ym + ' ឃ្លាត ➜ បើកស្ថិតិ ៣ ខែ នឹងឃើញលេខខុសពីរបាយការណ៍ខែ');
    }
});
if (!monthsChecked && !Object.keys(monthly).length) may('គ្មាន node ខែក្នុង dump — រំលង');

// ── ២. លុយជួរដេក = ផលបូក barcodes ─────────────────────────────────────
console.log('\n── ២. លុយសរុបរបស់ជួរដេក = ផលបូក barcodes ──');
let rowsWithBc = 0, rowBad = 0, worst = 0, worstDate = '';
[history, deleted].forEach((list) => list.forEach((it) => {
    const bcs = barcodesOf(it);
    if (!bcs.length) return;
    rowsWithBc++;
    const cod = r2(bcs.reduce((a, b) => a + (parseFloat(b.cod) || 0), 0));
    const dod = r2(bcs.reduce((a, b) => a + (parseFloat(b.dod) || 0), 0));
    const dc = Math.abs(r2((parseFloat(it.cod) || 0) - cod));
    const dd = Math.abs(r2((parseFloat(it.dod) || 0) - dod));
    const dp = Math.abs(r2((parseFloat(it.price) || 0) - r2(cod + dod)));
    const worstHere = Math.max(dc, dd, dp);
    if (worstHere > 0.005) { rowBad++; if (worstHere > worst) { worst = worstHere; worstDate = String(it.scanDate || '?'); } }
}));
if (!rowsWithBc) may('គ្មានជួរដេកណាមាន barcodes — រំលង');
else if (!rowBad) ok('ជួរដេក ' + rowsWithBc + ' ទាំងអស់ ស៊ីនឹងផលបូក barcodes');
else bad('ជួរដេក ' + rowBad + '/' + rowsWithBc + ' មិនស៊ីនឹងផលបូក barcodes',
    'គម្លាតធំបំផុត ' + $(worst) + ' នៅថ្ងៃ ' + worstDate + ' ➜ លេខខុសនឹងចេញក្នុង Excel');

// ── ៣. ស្ថិតិយក ៖ អត្តសញ្ញាណ ──────────────────────────────────────────
console.log('\n── ៣. ស្ថិតិយក ៖ សំណុំ barcode = counter ──');
let pkChecked = 0, pkBad = 0;
Object.keys(pickup).sort().forEach((d) => {
    const rec = pickup[d] || {};
    const set = (rec.pickedUpBarcodes && typeof rec.pickedUpBarcodes === 'object') ? rec.pickedUpBarcodes : null;
    const recorded = sb.statsCount(rec.packagesPickedUp);
    const phones = (rec.pickedUpPhones && typeof rec.pickedUpPhones === 'object') ? rec.pickedUpPhones : {};
    const phoneSum = Object.keys(phones).reduce((a, k) => a + sb.statsCount(phones[k]), 0);
    pkChecked++;
    if (set) {
        const size = Object.keys(set).length;
        if (size !== recorded || phoneSum !== recorded) {
            pkBad++;
            bad('ថ្ងៃ ' + d + ' ៖ សំណុំ ' + size + ' · packagesPickedUp ' + recorded + ' · Σphones ' + phoneSum);
        }
    } else if (phoneSum !== recorded) {
        pkBad++;
        bad('ថ្ងៃ ' + d + ' (ទិន្នន័យចាស់គ្មានសំណុំ) ៖ Σphones ' + phoneSum + ' ≠ packagesPickedUp ' + recorded);
    }
});
if (!pkChecked) may('គ្មាន node ស្ថិតិយក — រំលង');
else if (!pkBad) ok('ថ្ងៃ ' + pkChecked + ' ទាំងអស់ ៖ សំណុំ = packagesPickedUp = Σ pickedUpPhones');

// ── ៤. រូបរាងលេខ ៖ អវិជ្ជមាន · NaN ────────────────────────────────────
console.log('\n── ៤. រូបរាងលេខក្នុង ledger ──');
let shapeBad = 0;
[['ថ្ងៃ', daily], ['ខែ', monthly]].forEach(([label, map]) => {
    Object.keys(map).forEach((k) => {
        ['codDollar', 'dodDollar', 'totalCount'].forEach((f) => {
            const v = map[k][f];
            if (v === undefined) return;
            const n = parseFloat(v);
            if (!isFinite(n) || n < 0) { shapeBad++; bad(label + ' ' + k + '.' + f + ' = ' + JSON.stringify(v)); }
        });
    });
});
if (!shapeBad) ok('គ្មានលេខអវិជ្ជមាន ឬ NaN ក្នុង ledger ថ្ងៃ និងខែ');

// ── ៥. «ចំណូល (យករួច)» ដែលអេក្រង់នឹងបង្ហាញ ────────────────────────────
console.log('\n── ៥. «ចំណូល (យករួច)» ដែលអេក្រង់នឹងបង្ហាញ (កូដពិត) ──');
const openMap = sb.uncollectedValueByDate();
let gCollected = 0, gLedger = 0, gOpen = 0;
const perMonth = {};
Object.keys(daily).sort().forEach((d) => {
    if (!sb.PICKUP_DATE_KEY_PATTERN.test(d)) return;
    const c = sb.collectedValueOf(daily[d].codDollar, daily[d].dodDollar, openMap[d]);
    const led = r2(sb.statsMoney(daily[d].codDollar) + sb.statsMoney(daily[d].dodDollar));
    const op = openMap[d] ? r2(openMap[d].cod + openMap[d].dod) : 0;
    gCollected = r2(gCollected + c.total); gLedger = r2(gLedger + led); gOpen = r2(gOpen + op);
    const ym = d.slice(0, 7);
    const b = perMonth[ym] || (perMonth[ym] = { c: 0, l: 0, o: 0 });
    b.c = r2(b.c + c.total); b.l = r2(b.l + led); b.o = r2(b.o + op);
});
Object.keys(perMonth).sort().forEach((ym) => {
    const b = perMonth[ym];
    const card = sb.collectedValueForMonth(daily, openMap, ym);
    const agree = Math.abs(card.total - b.c) < 0.005;
    console.log('  ' + (agree ? '✅' : '❌') + ' ខែ ' + ym
        + ' ៖ ចំណូល(យករួច) ' + $(b.c) + ' · មិនទាន់យក ' + $(b.o) + ' · ledger ឆៅ ' + $(b.l));
    agree ? pass++ : (fail++, notes.push('ខែ ' + ym + ' ៖ កាតខែ ' + $(card.total) + ' ≠ ផលបូកថ្ងៃ ' + $(b.c)));
});
console.log('  ── សរុប ៖ ចំណូល(យករួច) ' + $(gCollected) + ' · មិនទាន់យក ' + $(gOpen) + ' · ledger ឆៅ ' + $(gLedger));
const gap = r2(gLedger - gCollected - gOpen);
if (Math.abs(gap) < 0.02) ok('ការអភិរក្ស ៖ ចំណូល + មិនទាន់យក = ledger ឆៅ', 'គម្លាត ' + $(gap));
else may('ការអភិរក្ស ៖ គម្លាត ' + $(gap),
    'ចំណូល ' + $(gCollected) + ' + មិនទាន់យក ' + $(gOpen) + ' ≠ ledger ' + $(gLedger)
    + '\n       ⚠️ គម្លាតនេះ **អាចធម្មតា** ៖ «លុប» មិនដកលុយ · ការ purge ៣០ ថ្ងៃ ·'
    + '\n          «កែទឹកប្រាក់» ដោយដៃ។ បើវាធំមិនធម្មតា ➜ ពិនិត្យជាមុនគេ។');

// ── ៦. barcode ស្ទួន ➜ ហានិភ័យលុយស្ទួន ────────────────────────────────
console.log('\n── ៦. barcode ស្ទួនក្នុងប្រវត្តិ ──');
const seen = new Map();
let dup = 0;
history.forEach((it) => barcodesOf(it).forEach((b) => {
    const k = sb.barcodeRegistryKey ? sb.barcodeRegistryKey(b.code) : String(b.code || '');
    if (!k) return;
    if (seen.has(k)) dup++; else seen.set(k, true);
}));
if (!dup) ok('barcode ' + seen.size + ' ក្នុងប្រវត្តិ — គ្មានស្ទួន');
else bad(dup + ' barcode ស្ទួនក្នុងប្រវត្តិ (ហានិភ័យលុយបូកស្ទួន)', 'barcode ខុសគ្នា ' + seen.size);

console.log('\n╔══════════════════════════════════════════════════════════╗');
console.log('  ✅ ' + pass + '   ⚠️ ' + warn + '   ❌ ' + fail);
if (notes.length) { console.log('\n  អ្វីដែលអ្នកនឹងឃើញលើអេក្រង់ ៖'); notes.forEach((n) => console.log('   • ' + n)); }
console.log('╚══════════════════════════════════════════════════════════╝');
process.exit(fail ? 1 : 0);
