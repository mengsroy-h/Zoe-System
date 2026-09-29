// 🩺 ការវាស់លុយលើ **ទិន្នន័យផលិតកម្មពិត** — ⛔ អានសុទ្ធសាធ · មិនសរសេរអ្វីទាំងអស់។
//
// ហេតុអ្វីវាមាន ៖ checker ក្នុង `run-all.sh` វាស់ **កូដ**។ គ្មានមួយណាវាស់ថា
// **លុយក្នុងប្រព័ន្ធរបស់អ្នកថ្ងៃនេះ ត្រឹមត្រូវឬអត់** ទេ។ ឧបករណ៍នេះយកកូដលុយ
// **ពិត** មករត់លើ **dump ពិត** របស់អ្នក រួចរាយលេខ។ ប្រភពកូដលុយ ៖ `ZoeW/app.js` (ZoeW vanilla ឬ build វាស់
// របស់ ZoeW React) ឬ `audit-tools/money-core.js` (repo React ដែលគ្មាន build ៖ ផលិតពី src ពិតដោយ
// `--emit-core` ហើយ `money-reality-test` ធ្លាក់ពេលវាចាស់ជាងកូដ)។
//
// របៀបប្រើ ៖
//   Firebase Console ➜ Realtime Database ➜ ⋮ ➜ Export JSON  (ឬ backup .json.gz)
//   node audit-tools/money-reality-check.js <ឯកសារ.json ឬ .json.gz>
//
// ⛔ ឯកសារ dump មានលេខទូរស័ព្ទ និងលុយពិត — ឧបករណ៍នេះ **មិនបោះពុម្ព
// លេខទូរស័ព្ទ ឬ barcode ណាមួយឡើយ** (មានតែថ្ងៃ · ចំនួន · ទឹកប្រាក់សរុប)។
// ⛔ វា **មិនភ្ជាប់បណ្តាញ** និង **មិនសរសេរទៅ Firebase** ដាច់ខាត។
//
// Exit code ៖ 0 = គ្រប់យ៉ាងស៊ីគ្នា · 1 = **រកឃើញបញ្ហាពិត** ·
//             2 = ប្រើខុសវិធី · 3 = **រត់មិនបាន** (គ្មានឯកសារ · JSON ខូច · កូដលុយ)
// ⛔ 1 និង 3 ត្រូវបែងចែក — «ឧបករណ៍ខូច» មិនមែន «លុយខុស» ទេ។
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const vm = require('vm');

const ROOT = process.env.MONEYREAL_APP_DIR || path.join(__dirname, '..');
const APP_JS = path.join(ROOT, 'ZoeW', 'app.js');
const MONEY_CORE = path.join(ROOT, 'audit-tools', 'money-core.js');
const file = process.argv[2];

// ⛔ ស្រង់កូដលុយ **ពិត** — កុំសរសេរតេស្តលើកូដចម្លង
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
// ⛔ ថេរក៏ត្រូវស្រង់ចេញពីកូដពិតដែរ — `appZoneParts()` ពឹងលើពួកវា
function sliceConst(src, name) {
    const m = new RegExp('\\bconst ' + name + ' = ([^;\n]+);').exec(src);
    return m ? 'const ' + name + ' = ' + m[1] + ';' : '';
}
const WANT = ['ledgerNumber', 'statsMonthOf', 'statsPositive', 'statsMoney', 'statsCount',
    'countPickedUpCustomers', 'uncollectedBarcodeValue', 'uncollectedItemValue',
    'uncollectedValueByDate', 'collectedValueOf', 'collectedSetFromRecord', 'collectedTotalsOfDay',
    'recalcItemMoneyFromBarcodes', 'barcodeRegistryKey', 'rawSnapshotToItemList',
    'pickupBarcodeKey', 'collectedMarkValueOf', 'appZoneParts', 'getZoneDateKey'];
const WANT_CONST = ['APP_TIME_ZONE', 'APP_TIME_ZONE_OFFSET_MINUTES'];
function extractMoneyCore(src) {
    const missing = [];
    const consts = WANT_CONST.map((n) => { const line = sliceConst(src, n); if (!line) missing.push(n); return line; });
    const fns = WANT.map((n) => { const b = sliceFn(src, n); if (!b) missing.push(n); return b; });
    return { consts, fns, missing };
}
const MONEY_CORE_HEADER = '// ⛔ ផលិតដោយ `node audit-tools/money-reality-check.js --emit-core ZoeW/dist-audit/ZoeW/app.js audit-tools/money-core.js`\n'
    + '//    (`npm --prefix ZoeW run money:core`) ពីកូដលុយពិតរបស់ ZoeW React — កុំកែដោយដៃ។ `money-reality-test` ធ្លាក់ពេលវាចាស់ជាងកូដ។\n';
function moneyCoreText(src) {
    const { consts, fns, missing } = extractMoneyCore(src);
    return { text: MONEY_CORE_HEADER + consts.concat(fns).filter(Boolean).join('\n\n') + '\n', missing };
}
module.exports = { moneyCoreText, WANT, WANT_CONST };
if (require.main !== module) return;

// ឧបករណ៍អ្នកអភិវឌ្ឍន៍ ៖ ផលិត `money-core.js` ពីទិដ្ឋភាព `app.js` (build វាស់) — អានសុទ្ធសាធលើ dump មិនប្រែ
if (process.argv[2] === '--emit-core') {
    const from = process.argv[3], to = process.argv[4];
    if (!from || !to || !fs.existsSync(from)) { console.log('usage: node audit-tools/money-reality-check.js --emit-core <ZoeW/app.js> <out.js>'); process.exit(2); }
    const core = moneyCoreText(fs.readFileSync(from, 'utf8'));
    if (core.missing.length) { console.log('ERROR: money functions not found: ' + core.missing.join(', ')); process.exit(3); }
    fs.writeFileSync(to, core.text);
    console.log('wrote ' + to + ' (' + (WANT.length + WANT_CONST.length) + ' functions/constants)');
    process.exit(0);
}

let pass = 0, warn = 0, fail = 0;
const notes = [];
// ⛔ `cmd.exe` បំបែក UTF-8 Khmer កណ្តាលពាក្យ (ច្បាប់គម្រោង) ➜ ពេលមាន `--report`
// របាយការណ៍ខ្មែរទៅ **ឯកសារ** ហើយអេក្រង់ទទួលតែ **ASCII អង់គ្លេស**។
const argi = process.argv.indexOf('--report');
const REPORT = argi !== -1 ? process.argv[argi + 1] : null;
const LINES = [];
function say(line) { LINES.push(line); if (!REPORT) console.log(line); }
function ok(label, detail) { say('  ✅ ' + label + (detail ? '  — ' + detail : '')); pass++; }
function bad(label, detail) { say('  ❌ ' + label + (detail ? '\n       ' + detail : '')); fail++; }
function may(label, detail) { say('  ⚠️  ' + label + (detail ? '\n       ' + detail : '')); warn++; }
function check(cond, label, detail) { cond ? ok(label, cond === true && detail ? detail : undefined) : bad(label, detail); }
// ⛔ `check()` បោះពុម្ព `detail` ទាំងពេលជោគជ័យ ➜ ពន្យល់វែងនៃការធ្លាក់
// នឹងអានថាជាបញ្ហា ខណៈវាបៃតង។ `must()` ៖ ជោគជ័យខ្លី · ធ្លាក់ទើបពន្យល់។
function must(cond, label, detail) { cond ? ok(label) : bad(label, detail); }

if (!file) {
    console.log('របៀបប្រើ ៖ node audit-tools/money-reality-check.js <dump.json ឬ dump.json.gz>');
    say('  យក dump ៖ Firebase Console ➜ Realtime Database ➜ ⋮ ➜ Export JSON');
    process.exit(2);
}
// ប្រភពកូដលុយ ៖ `ZoeW/app.js` (vanilla ឬ build វាស់) មុន ➜ `money-core.js` តែលើ repo ZoeW React (គ្មាន build)
const REACT_SOURCE = fs.existsSync(path.join(ROOT, 'ZoeW', 'src', 'main.tsx'));
const MONEY_SRC_FILE = fs.existsSync(APP_JS) ? APP_JS : (REACT_SOURCE && fs.existsSync(MONEY_CORE) ? MONEY_CORE : null);
if (!MONEY_SRC_FILE) {
    console.log('ERROR: money code not found in ' + ROOT + ' (need ZoeW/app.js, or audit-tools/money-core.js for ZoeW React)');
    process.exit(3);
}
if (!fs.existsSync(file)) { console.log('ERROR: dump file not found: ' + file); process.exit(3); }

let raw = fs.readFileSync(file);
if (file.endsWith('.gz')) raw = zlib.gunzipSync(raw);
let db;
try { db = JSON.parse(raw.toString('utf8')); }
catch (e) { console.log('ERROR: cannot read the file as JSON: ' + e.message); process.exit(3); }

const SRC = fs.readFileSync(MONEY_SRC_FILE, 'utf8');
const extracted = extractMoneyCore(SRC);
const missing = extracted.missing;
const bodies = extracted.consts.concat(extracted.fns.map((b, i) => b || 'function ' + WANT[i] + '() { return undefined; }')).join('\n');

const N = {
    history: 'zoew_scan_history_cod_dod',
    deleted: 'zoew_recently_deleted_cod_dod',
    daily: 'zoew_daily_revenue_cod_dod',
    monthly: 'zoew_monthly_revenue_cod_dod',
    pickup: 'zoew_daily_pickup_cod_dod',
    collected: 'zoew_daily_collected_cod_dod'
};
// ⛔ `window` ទទេ ៖ កូដលុយ (`rawSnapshotToItemList()`) រាយការណ៍ record ខូចតាម `window.ZoeErrors` ➜ Node គ្មាន `window` ➜ dump ដែលមាន
//    record មិនមែន object នឹងគាំង CLI (`ReferenceError`) ជំនួសការវាស់ record ល្អ (`money-reality-test`)
const sb = {
    console, PICKUP_DATE_KEY_PATTERN: /^\d{4}-\d{2}-\d{2}$/,
    scanHistory: [], deletedItems: [], window: {}
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
const collected = (db[N.collected] && typeof db[N.collected] === 'object') ? db[N.collected] : {};
sb.scanHistory = history; sb.deletedItems = deleted;

const r2 = (n) => Math.round(n * 100) / 100;
const $ = (n) => '$' + r2(n).toFixed(2);
const barcodesOf = (it) => (Array.isArray(it.barcodes) ? it.barcodes.filter(Boolean) : []);

say('\n╔══════════════════════════════════════════════════════════╗');
say('║  🩺 ការវាស់លុយលើទិន្នន័យពិត — អានសុទ្ធសាធ                ║');
say('╚══════════════════════════════════════════════════════════╝');
say('ឯកសារ ៖ ' + path.basename(file) + '  (' + (raw.length / 1024).toFixed(0) + ' KB)');
say('កូដលុយ ៖ ' + path.relative(ROOT, MONEY_SRC_FILE).split(path.sep).join('/'));
say('រក function លុយពិត ៖ ' + (WANT.length + WANT_CONST.length - missing.length) + '/' + (WANT.length + WANT_CONST.length)
    + (missing.length ? '  ⚠️ បាត់ ៖ ' + missing.join(', ') : ''));
// ⛔ ច្បាប់ដដែលនឹងមុន («បាត់លើស ៣ ➜ នេះមិនមែនកូដលុយរបស់ ZoeW ទេ») តែសរសេរធៀបនឹង
// `missing` ➜ វាមិនធូរឡើងពេល WANT រីក (លេខថេរជាកាលបរិច្ឆេទផុតកំណត់)។
if (missing.length > 3) {
    console.log('ERROR: could not extract enough real money functions from ' + path.basename(MONEY_SRC_FILE) + '.'); process.exit(3);
}
say('\nទំហំទិន្នន័យ ៖ ប្រវត្តិ ' + history.length + ' ជួរដេក · ធុងសំរាម ' + deleted.length
    + ' · ថ្ងៃក្នុង ledger ' + Object.keys(daily).length + ' · ខែ ' + Object.keys(monthly).length);

// ── ១. ledger ខែ ត្រូវស្មើផលបូក ledger ថ្ងៃ ─────────────────────────────
say('\n── ១. ledger ខែ = ផលបូក ledger ថ្ងៃ ──');
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
        notes.push('ខែ ' + ym + ' ឃ្លាត ➜ របាយការណ៍ខែ នឹងរាយ «ledger ខែឃ្លាតពីផលបូកថ្ងៃ»');
    }
});
if (!monthsChecked && !Object.keys(monthly).length) may('គ្មាន node ខែក្នុង dump — រំលង');

// ── ២. លុយជួរដេក = ផលបូក barcodes ─────────────────────────────────────
say('\n── ២. លុយសរុបរបស់ជួរដេក = ផលបូក barcodes ──');
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
say('\n── ៣. ស្ថិតិយក ៖ សំណុំ barcode = counter ──');
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
say('\n── ៤. រូបរាងលេខក្នុង ledger ──');
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
say('\n── ៥. «ចំណូល (យករួច)» ដែលអេក្រង់នឹងបង្ហាញ (កូដពិត) ──');
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
    say('  •  ខែ ' + ym
        + ' ៖ ចំណូល(យករួច) ' + $(b.c) + ' · មិនទាន់យក ' + $(b.o) + ' · ledger ឆៅ ' + $(b.l));
});
say('  ── សរុប ៖ ចំណូល(យករួច) ' + $(gCollected) + ' · មិនទាន់យក ' + $(gOpen) + ' · ledger ឆៅ ' + $(gLedger));
const gap = r2(gLedger - gCollected - gOpen);
if (Math.abs(gap) < 0.02) ok('ការអភិរក្ស ៖ ចំណូល + មិនទាន់យក = ledger ឆៅ', 'គម្លាត ' + $(gap));
else may('ការអភិរក្ស ៖ គម្លាត ' + $(gap),
    'ចំណូល ' + $(gCollected) + ' + មិនទាន់យក ' + $(gOpen) + ' ≠ ledger ' + $(gLedger)
    + '\n       ⚠️ គម្លាតនេះ **អាចធម្មតា** ៖ «លុប» មិនដកលុយ · ការ purge ៣០ ថ្ងៃ ·'
    + '\n          «កែទឹកប្រាក់» ដោយដៃ។ បើវាធំមិនធម្មតា ➜ ពិនិត្យជាមុនគេ។');

// ── ៥ខ. «ចំណូលប្រចាំថ្ងៃ» (តាមថ្ងៃយក) — node ថ្មី ─────────────────────
// ⛔ អ័ក្សផ្សេងពីផ្នែក ៥ ៖ ត្រង់នេះលុយចុះលើ **ថ្ងៃដែលបិទ «យក»** មិនមែន
// ថ្ងៃស្កេនចូល ➜ លេខ ២ នេះ **មិនត្រូវរំពឹងថាស្មើគ្នាទេ**។
say('\n── ៥ខ. ចំណូលប្រចាំថ្ងៃ (តាមថ្ងៃយក) ──');
const collectedDays = Object.keys(collected).filter((d) => sb.PICKUP_DATE_KEY_PATTERN.test(d)).sort();
const collectedBadDays = Object.keys(collected).filter((d) => !sb.PICKUP_DATE_KEY_PATTERN.test(d));
if (!collectedDays.length && !collectedBadDays.length) {
    may('គ្មាន node `zoew_daily_collected_cod_dod` ក្នុង dump — រំលង',
        'ធម្មតាបើមិនទាន់មានការបិទ «យក» ណាមួយក្រោយដំឡើងកំណែថ្មី');
} else {
    check(collectedBadDays.length === 0, 'កូនសោថ្ងៃត្រឹមត្រូវទាំងអស់',
        'កូនសោមិនមែនថ្ងៃ ៖ ' + collectedBadDays.length);
    check(collectedDays.length <= 7, 'រក្សាទុកមិនលើស ៧ ថ្ងៃ',
        'ថ្ងៃក្នុង node ៖ ' + collectedDays.length + ' (ការសម្អាតស្វ័យប្រវត្តិរត់តែពេល App បើក)');
    let negative = 0;
    let collectedGrand = 0;
    collectedDays.forEach((d) => {
        const totals = sb.collectedTotalsOfDay(collected[d]);
        const set = sb.collectedSetFromRecord(collected[d]);
        Object.keys(set).forEach((k) => { if (set[k].c < 0 || set[k].d < 0) negative++; });
        collectedGrand = r2(collectedGrand + totals.total);
        say('  •  ' + d + ' ៖ ' + totals.count + ' កញ្ចប់ · COD ' + $(totals.cod)
            + ' · DOD ' + $(totals.dod) + ' · សរុប ' + $(totals.total));
    });
    check(negative === 0, 'គ្មានទឹកប្រាក់អវិជ្ជមាន', 'ធាតុអវិជ្ជមាន ៖ ' + negative);
    say('  ── សរុប ៧ ថ្ងៃ ៖ ' + $(collectedGrand));

    // ⛔ ជាន់ទី ២ ៖ **កញ្ចក់ ↔ ប្រវត្តិ**។ រូបរាងត្រឹមត្រូវ **មិនមែនភស្តុតាង**
    // ថាលេខត្រូវទេ — `zoew_daily_collected_cod_dod` ជា **កញ្ចក់ដេរីវេ** នៃ
    // barcode ដែលបិទ «យក» ➜ វាត្រូវផ្គូផ្គង ១:១ នឹងប្រវត្តិ + ធុងសំរាម។
    // ការសរសេរកញ្ចក់ឈរ **ក្រៅ** transaction របស់ប្រវត្តិ (`commitCollectedMarks`
    // ជា `fb.update` ដាច់ដោយឡែក) ➜ បិទ App កណ្តាលទី · បណ្តាញដាច់ · ការសរសេរ
    // ធ្លាក់ ➜ កូនសោមិនចុះ ខណៈប្រវត្តិចុះរួច ➜ **កាត «💵 ចំណូលប្រចាំថ្ងៃ»
    // រាយលុយតិចជាងការពិត ដោយស្ងាត់** ហើយ `run-all.sh` មើលមិនឃើញ (វាវាស់កូដ)។
    const zoneReady = (() => {
        try { return sb.PICKUP_DATE_KEY_PATTERN.test(sb.getZoneDateKey(1789100000000, 0)); }
        catch (e) { return false; }
    })();
    const mirrorByKey = new Map();
    collectedDays.forEach((d) => {
        const set = sb.collectedSetFromRecord(collected[d]);
        Object.keys(set).forEach((raw) => {
            // ⛔ normalize ទាំង ២ ខាង (ច្បាប់ដដែលនឹងផ្នែក ៧) — dump ដែលសម្អាត
            // រួចផ្លាស់កូនសោទៅអក្សរតូច ➜ ការវាស់ត្រូវដូចគ្នាមុន/ក្រោយសម្អាត
            const k = sb.pickupBarcodeKey(raw) || raw;
            const list = mirrorByKey.get(k) || [];
            list.push({ day: d, c: set[raw].c, d: set[raw].d });
            mirrorByKey.set(k, list);
        });
    });
    // ⛔ រាប់តែជួរដេកទម្រង់ថ្មី (មានអារេ `barcodes`) — ជួរដេកចាស់ដែលផ្ទុក
    // `item.barcode` មិនឆ្លងផ្លូវកញ្ចក់ដដែលទេ ➜ ការរាប់វានឹងផលិត «បាត់»
    // ក្លែងក្លាយ។ ចំនួនដែលរំលងត្រូវរាយចេញ — ការស្ងាត់ជាការកុហក។
    const bcByKey = new Map();
    let legacyRows = 0, twinKeys = 0;
    [history, deleted].forEach((list) => list.forEach((it) => {
        if (!Array.isArray(it.barcodes)) { if (it.barcode) legacyRows++; return; }
        it.barcodes.filter(Boolean).forEach((b) => {
            const key = sb.pickupBarcodeKey(b.code);
            if (!key) return;
            const prev = bcByKey.get(key);
            if (prev) { prev.twin = true; twinKeys++; return; }
            const stamp = parseFloat(b.closedAt);
            const live = isFinite(stamp) && stamp > 0 ? stamp : 0;
            bcByKey.set(key, {
                closed: !!b.isClosed, stamp: live,
                day: (b.isClosed && live && zoneReady) ? sb.getZoneDateKey(live, 0) : '',
                value: sb.collectedMarkValueOf(b)
            });
        });
    }));
    // ⛔ ព្រំដែនដេរីវេពីទិន្នន័យ មិនមែនពីនាឡិកា ៖ កញ្ចក់ទើប ship ក្នុង `2.34.0`
    // ហើយវារក្សាតែ ៧ ថ្ងៃ ➜ barcode ដែលបិទ **មុនកូនសោដំបូងដែលមានពិត** មិនអាច
    // វាស់បាន (គ្មានកញ្ចក់នៅពេលនោះ ឬថ្ងៃនោះត្រូវសម្អាតចោលរួច)។ ការសន្មតថា
    // ពួកវា «បាត់» នឹងជាការរាយ ❌ លើអ្វីដែលមិនបានវាស់ — អាក្រក់ជាងការស្ងាត់។
    let firstMeasured = Infinity;
    bcByKey.forEach((rec, key) => {
        if (rec.twin || !rec.closed || !rec.stamp) return;
        if (mirrorByKey.has(key) && rec.stamp < firstMeasured) firstMeasured = rec.stamp;
    });
    let scoped = 0, missKey = 0, missKeyMoney = 0, missDay = 0, missDayMoney = 0;
    let wrongDay = 0, wrongDayMoney = 0, wrongValue = 0, wrongValueGap = 0;
    let twice = 0, twiceMoney = 0, beforeWindow = 0, noStamp = 0;
    bcByKey.forEach((rec, key) => {
        if (rec.twin) return;
        const hits = mirrorByKey.get(key) || [];
        if (hits.length > 1) {
            twice++;
            hits.slice(1).forEach((h) => { twiceMoney = r2(twiceMoney + h.c + h.d); });
            return;
        }
        if (!rec.closed) return;
        if (!rec.stamp || !rec.day) { noStamp++; return; }
        if (rec.stamp < firstMeasured) { beforeWindow++; return; }
        scoped++;
        const money = r2(rec.value.c + rec.value.d);
        if (!hits.length) {
            if (collectedDays.indexOf(rec.day) !== -1) { missKey++; missKeyMoney = r2(missKeyMoney + money); }
            else { missDay++; missDayMoney = r2(missDayMoney + money); }
            return;
        }
        if (hits[0].day !== rec.day) { wrongDay++; wrongDayMoney = r2(wrongDayMoney + money); return; }
        const gc = Math.abs(r2(hits[0].c - rec.value.c));
        const gd = Math.abs(r2(hits[0].d - rec.value.d));
        if (gc > 0.005 || gd > 0.005) { wrongValue++; wrongValueGap = r2(wrongValueGap + gc + gd); }
    });
    // ⛔ ទិសផ្ទុយ ៖ កូនសោដែលនៅសល់ក្នុងកញ្ចក់ ខណៈកញ្ចប់ **មិនបិទ** =
    // លុយដែលរាយថាទទួលបាន ខណៈកញ្ចប់នៅក្នុងហាង។ កូនសោដែលរកម្ចាស់មិនឃើញ
    // សោះ ជា **⚠️ មិនមែន ❌** — ការ purge ធុងសំរាមជាការពន្យល់ស្របច្បាប់។
    let openKey = 0, openKeyMoney = 0, ghostKey = 0, ghostMoney = 0;
    mirrorByKey.forEach((hits, key) => {
        const rec = bcByKey.get(key);
        const money = hits.reduce((a, h) => r2(a + h.c + h.d), 0);
        if (!rec) { ghostKey++; ghostMoney = r2(ghostMoney + money); return; }
        if (rec.twin || hits.length > 1) return;
        if (!rec.closed) { openKey++; openKeyMoney = r2(openKeyMoney + money); }
    });
    say('  ┈┈ កញ្ចក់ ↔ ប្រវត្តិ ┈┈');
    if (!zoneReady) {
        may('ស្រង់ helper តំបន់ម៉ោងចេញពីកូដលុយមិនបាន — ប្រៀបកញ្ចក់មិនបាន',
            'នេះជា «វាស់មិនបាន» មិនមែន «ត្រឹមត្រូវ» ទេ — ⛔ កុំអានវាជាបៃតង');
    } else if (!collectedDays.length) {
        may('គ្មានថ្ងៃត្រឹមត្រូវក្នុងកញ្ចក់ — ប្រៀបនឹងប្រវត្តិមិនបាន');
    } else if (firstMeasured === Infinity) {
        may('គ្មានកូនសោកញ្ចក់ណាផ្គូនឹង barcode បិទក្នុងប្រវត្តិ — ប្រៀបមិនបាន',
            'កូនសោក្នុងកញ្ចក់ ៖ ' + mirrorByKey.size + ' · barcode ដែលអានបាន ៖ ' + bcByKey.size);
    } else {
        say('  ── វិសាលភាព ៖ វាស់ ' + scoped + ' barcode បិទ (តាំងពី '
            + sb.getZoneDateKey(firstMeasured, 0) + ') · រំលង ' + beforeWindow + ' មុនកញ្ចក់ចាប់ផ្តើម · '
            + noStamp + ' គ្មានត្រាបិទ · ' + legacyRows + ' ជួរដេកទម្រង់ចាស់'
            + (twinKeys ? ' · ' + twinKeys + ' កូនសោស្ទួន' : ''));
        // ⛔ ជាន់អប្បបរមា ៖ ការអះអាង **អវត្តមាន** ពិតដោយស្វ័យប្រវត្តិលើសំណុំទទេ
        // ➜ ៣ ជួរខាងក្រោមនេះឈរលើ barcode ដែលចូលវិសាលភាពពិត។ ជួរខាងកញ្ចក់
        // (ស្ទួន · នៅសល់) មិនពឹងលើវា — ជាន់របស់ពួកវាគឺកូនសោក្នុងកញ្ចក់។
        if (scoped) {
            // ⛔ «បាត់» មាន ២ រូបរាង (ថ្ងៃមាន / ថ្ងៃគ្មាន) តែ **ថ្នាក់តែមួយ** ៖
            // លុយដែលកាតគួររាយ តែមិនរាយ។ ⛔ ការ purge មិនអាចជាការពន្យល់ក្នុង
            // វិសាលភាពនេះទេ ៖ ថ្ងៃរបស់យុថ្កានៅរស់ ➜ ថ្ងៃដែលថ្មីជាងវា មិនអាច
            // ត្រូវ purge មុនវាបានឡើយ ➜ ⛔ ទាំង ២ ជា ❌ មិនមែន ⚠️។
            const missWhy = '\n       ⛔ មូលហេតុដែលអាចមាន ៖ ការសរសេរកញ្ចក់ធ្លាក់ (បិទ App'
                + ' កណ្តាលទី · បណ្តាញដាច់) ·\n          ឧបករណ៍ដែលនៅប្រើកំណែចាស់ជាង `2.34.0` ·'
                + ' ការស្តារពីធុងសំរាម (វា reset `closedAt`\n          ទៅ «ឥឡូវ» ដោយ **មិន** reconcile កញ្ចក់)';
            must(missKey === 0, 'barcode បិទគ្រប់មួយក្នុងវិសាលភាព មានកូនសោក្នុងកញ្ចក់',
                missKey + ' barcode បិទ គ្មានកូនសោ ខណៈថ្ងៃនោះ**មាន**ក្នុងកញ្ចក់ ➜ កាតខ្វះ '
                + $(missKeyMoney) + missWhy);
            must(missDay === 0, 'គ្រប់ថ្ងៃដែលមានការបិទ «យក» មានក្នុងកញ្ចក់',
                missDay + ' barcode បិទ គ្មានកូនសោ ហើយ**ថ្ងៃនោះក៏គ្មាន**ក្នុងកញ្ចក់ ➜ កាតខ្វះ '
                + $(missDayMoney) + missWhy);
            must(wrongValue === 0, 'ទឹកប្រាក់ក្នុងកញ្ចក់ = ទឹកប្រាក់របស់ barcode',
                wrongValue + ' កូនសោមានទឹកប្រាក់ខុស ➜ គម្លាតសរុប ' + $(wrongValueGap)
                + '\n       ⛔ ការកែតម្លៃមិនបាន reconcile ចូលកញ្ចក់');
            // ⛔ «ថ្ងៃខុស» ជា **⚠️ មិនមែន ❌** ៖ `executeRestoreItem()` reset `closedAt`
            // ទៅ «ឥឡូវ» (ដើម្បីកុំឲ្យច្បាប់ ២ ម៉ោងលោតចូលធុងសំរាមវិញ) ដោយមិនប៉ះកញ្ចក់
            // ➜ លុយនៅឈរលើ **ថ្ងៃដែលអតិថិជនយកពិត** — នោះជាការបង្ហាញត្រឹមត្រូវ។
            // ⛔ ការផ្លាស់ថ្ងៃដែលធ្លាក់ក៏ផលិតរូបរាងដដែល ➜ បែងចែកពី dump មិនបាន។
            if (wrongDay) may(wrongDay + ' កូនសោឈរលើថ្ងៃមិនមែនថ្ងៃរបស់ `closedAt`',
                'ទឹកប្រាក់ ' + $(wrongDayMoney) + ' — ធម្មតាក្រោយ **ការស្តារពីធុងសំរាម**\n'
                + '       (`closedAt` reset តែកញ្ចក់មិន reconcile); ⛔ ការផ្លាស់ថ្ងៃដែលធ្លាក់\n'
                + '       ក៏មានរូបរាងដដែល ➜ បើលេខនេះកើនរាល់ជុំ ត្រូវពិនិត្យ');
        } else {
            may('គ្មាន barcode បិទណាចូលវិសាលភាព — ការប្រៀបខាងប្រវត្តិ **មិនបានវាស់អ្វីទេ**',
                '⛔ «គ្មានបាត់» លើសំណុំទទេ ពិតដោយស្វ័យប្រវត្តិ — កុំអានវាជាបៃតង');
        }
        must(twice === 0, 'គ្មានកូនសោណាឈរលើថ្ងៃលើសពី ១',
            twice + ' កូនសោឈរលើ ២ ថ្ងៃ ➜ **រាប់ស្ទួន** ' + $(twiceMoney));
        must(openKey === 0, 'គ្មានកូនសោណានៅសល់លើកញ្ចប់ដែលបើកវិញ',
            openKey + ' កូនសោនៅសល់ ខណៈ barcode **មិនបិទ** ➜ កាតរាយលើស ' + $(openKeyMoney));
        if (ghostKey) may(ghostKey + ' កូនសោក្នុងកញ្ចក់ រកម្ចាស់មិនឃើញ',
            'ទឹកប្រាក់ ' + $(ghostMoney) + ' — ធម្មតាបន្ទាប់ពី purge ធុងសំរាម\n'
            + '       (កញ្ចក់រស់ ៧ ថ្ងៃ · ធាតុ `expired` purge ក្នុង ២ ថ្ងៃ)');
        const drift = missKey + missDay + twice + wrongValue + openKey;
        if (drift) notes.push('កាត «💵 ចំណូលប្រចាំថ្ងៃ» ឃ្លាតពីប្រវត្តិ ' + drift
            + ' កន្លែង ➜ លេខលើកាតខុស (ledger និង `isDeducted` មិនប៉ះ)');
        else if (scoped) say('  ── សាលក្រម ៖ កញ្ចក់ស៊ីនឹងប្រវត្តិ ១:១ លើ barcode បិទ ' + scoped
            + ' ➜ ការសរសេរកញ្ចក់ **មិនបាត់** លើ dump នេះ');
    }
}

// ── ៦. barcode ស្ទួន ➜ ហានិភ័យលុយស្ទួន ────────────────────────────────
say('\n── ៦. barcode ស្ទួនក្នុងប្រវត្តិ ──');
const seen = new Map();
let dup = 0;
history.forEach((it) => barcodesOf(it).forEach((b) => {
    const k = sb.barcodeRegistryKey ? sb.barcodeRegistryKey(b.code) : String(b.code || '');
    if (!k) return;
    if (seen.has(k)) dup++; else seen.set(k, true);
}));
if (!dup) ok('barcode ' + seen.size + ' ក្នុងប្រវត្តិ — គ្មានស្ទួន');
else bad(dup + ' barcode ស្ទួនក្នុងប្រវត្តិ (ហានិភ័យលុយបូកស្ទួន)', 'barcode ខុសគ្នា ' + seen.size);

// ── ៧. កូនសោ registry កំព្រា ➜ barcode ជាប់អន្ទាក់ស្ថាពរ ──────────────
// ⛔ ថ្នាក់ពិត ៖ អ្នកប្រើឃើញ «⚠️ ត្រូវបានបញ្ចូលរួចហើយ» ខណៈកញ្ចប់នោះ
// **គ្មានក្នុងប្រវត្តិ និងធុងសំរាមសោះ** ➜ ស្កេនចូលមិនបានជារៀងរហូត។
say('\n── ៧. កូនសោ registry កំព្រា (barcode ជាប់អន្ទាក់) ──');
const registry = (db.zoew_barcode_registry && typeof db.zoew_barcode_registry === 'object')
    ? db.zoew_barcode_registry : null;
if (!registry) may('គ្មាន node `zoew_barcode_registry` ក្នុង dump — រំលង');
else {
    const rkey = (c) => (sb.barcodeRegistryKey ? sb.barcodeRegistryKey(c) : String(c || '').toUpperCase());
    const owned = new Set();
    [history, deleted].forEach((list) => list.forEach((it) => {
        barcodesOf(it).forEach((b) => { if (b.code) owned.add(rkey(b.code)); });
        if (it.barcode) owned.add(rkey(it.barcode));
    }));
    const rk = Object.keys(registry).map((k) => rkey(k));
    const orphan = rk.filter((k) => !owned.has(k));
    const unreg = [...owned].filter((k) => rk.indexOf(k) === -1);
    if (!orphan.length) ok('កូនសោ registry ' + rk.length + ' ទាំងអស់មានម្ចាស់');
    else if (rk.length > 0 && orphan.length === rk.length) {
        // ⛔ ១០០% កំព្រា = ស្នាមនៃ **ទម្រង់កូនសោមិនត្រូវគ្នា** មិនមែនកំហុសពិត
        may('កូនសោ registry ' + rk.length + ' **ទាំងអស់** មើលទៅដូចកំព្រា',
            'នេះស្ទើរតែជានិច្ចជាសញ្ញានៃ **ទម្រង់កូនសោមិនត្រូវគ្នា** មិនមែន barcode\n'
            + '       ជាប់អន្ទាក់ទេ (ឧ. dump ដែលសម្អាតដោយកំណែចាស់នៃ `redact-dump.js`)។\n'
            + '       ⛔ កុំសន្និដ្ឋានថាមានបញ្ហា — សាកលើ dump ដើម។');
    } else {
        bad(orphan.length + '/' + rk.length + ' កូនសោ registry **កំព្រា**',
            'barcode ទាំងនេះនឹងបដិសេធការស្កេនដោយ «ត្រូវបានបញ្ចូលរួចហើយ»\n'
            + '       ខណៈវាគ្មានក្នុងប្រវត្តិ និងធុងសំរាមសោះ។\n'
            + '       ⛔ `CLAUDE.md` ៖ លុបដោយដៃក្នុង Console — កុំសាងការជួសជុលស្វ័យប្រវត្តិ។');
        notes.push(orphan.length + ' barcode នឹងស្កេនចូលមិនបាន («ត្រូវបានបញ្ចូលរួចហើយ»)');
    }
    if (unreg.length) may(unreg.length + ' barcode គ្មានក្នុង registry',
        'ធម្មតាសម្រាប់ទិន្នន័យចាស់ (មុនមាន registry) — មិនប៉ះលុយ');
}

// ── ៨. «ស្កេនតាមថ្ងៃ» ↔ កញ្ចប់ដែលនៅក្នុងប្រព័ន្ធ ─────────────────────
// 🔴 សំណួររបស់ម្ចាស់គម្រោង (2026-09-17) ៖ «ថ្ងៃទី ១០ ស្កេន ៥៤ · អតិថិជនយក
// ៥១ · សល់ ០ ➜ បាត់ ៣។ ខ្លាចក្រែងការដកស្វ័យប្រវត្តិមិនដកទាំងចំនួន ទាំង
// ទឹកប្រាក់»។
//
// លេខ «ស្កេនតាមថ្ងៃ» លើអេក្រង់ = `zoew_daily_revenue_cod_dod/<ថ្ងៃ>/totalCount`
// ➜ វាឡើងពេលស្កេន និង **ចុះតាមផ្លូវដកលុយ** (`ដក` និង `ផុតកំណត់ ៨ ថ្ងៃ`
// បញ្ជូន `-count` ជាមួយ `-cod`/`-dod` ក្នុងការហៅតែមួយ)។ ⛔ ផ្លូវ «យករួច»
// និង «លុប» **មិនប៉ះវា** ដោយចេតនា។
//
// ដូច្នេះ អថេររក្សា ៖ `totalCount(ថ្ងៃ)` = ចំនួន barcode នៃថ្ងៃនោះដែល
// **មិនទាន់ដកលុយ** (`!isDeducted`) ក្នុងប្រវត្តិ **បូក** ធុងសំរាម។
// ⛔ ព្រំដែនត្រូវ **ដេរីវេពី dump** ៖ ធុងសំរាមប្រភេទ `pickup`/`delete` purge
// ក្នុង ៣០ ថ្ងៃ ➜ ថ្ងៃដែលចាស់ជាងនោះ **ផ្ទៀងផ្ទាត់មិនបាន** ➜ ⚠️ មិនមែន ❌។
say('\n── ៨. «ស្កេនតាមថ្ងៃ» = កញ្ចប់ដែលនៅក្នុងប្រព័ន្ធ ──');
{
    const alive = {};
    const deducted = {};
    const closedSet = {};
    const addRow = (it) => {
        const d = it && it.scanDate;
        if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(String(d))) return;
        const bs = barcodesOf(it);
        const rows = bs.length ? bs : [{ isDeducted: it.isDeducted, isClosed: it.isClosed, code: it.barcode }];
        rows.forEach((b) => {
            const isDed = (b && b.isDeducted === true) || (!bs.length && it.isDeducted === true);
            if (isDed) deducted[d] = (deducted[d] || 0) + 1;
            else {
                alive[d] = (alive[d] || 0) + 1;
                if (b && b.isClosed === true) closedSet[d] = (closedSet[d] || 0) + 1;
            }
        });
    };
    history.forEach(addRow);
    deleted.forEach(addRow);

    // ព្រំដែនដេរីវេ ៖ ថ្ងៃចាស់ជាងគេក្នុងធុងសំរាមជាយុថ្កា — មុននោះ ធុងសំរាម
    // អាចត្រូវ purge រួច ➜ ការប្រៀបធៀបលែងមានន័យ។
    const trashDates = deleted.map((it) => it && it.scanDate).filter((d) => d && /^\d{4}-\d{2}-\d{2}$/.test(String(d))).sort();
    const floorDate = trashDates.length ? trashDates[0] : null;

    let n8 = 0, bad8 = 0, skip8 = 0;
    Object.keys(daily).sort().forEach((d) => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return;
        const ledgerCount = sb.statsCount(daily[d].totalCount);
        const liveCount = alive[d] || 0;
        if (ledgerCount === liveCount) { n8++; return; }
        if (floorDate && d < floorDate) {
            skip8++;
            may('ថ្ងៃ ' + d + ' ៖ ledger ' + ledgerCount + ' ≠ កញ្ចប់ដែលនៅ ' + liveCount
                + ' — តែថ្ងៃនេះចាស់ជាងធាតុចាស់បំផុតក្នុងធុងសំរាម ➜ **ផ្ទៀងផ្ទាត់មិនបាន**');
            return;
        }
        n8++; bad8++;
        const pickedHere = sb.statsCount((pickup[d] || {}).packagesPickedUp);
        // ⛔ ⚠️ មិនមែន ❌ ៖ លម្អៀងនេះអាចមានការពន្យល់ស្របច្បាប់ដែល dump
        //    បង្ហាញមិនបាន (ការ purge ធុងសំរាម · Reset · ជួរដេកទម្រង់ចាស់)
        //    ➜ ច្បាប់ «មិនអាចផ្ទៀងផ្ទាត់ ≠ ខុស»។ ករណីដែល **បញ្ជាក់បាន**
        //    មានអ្នករាយរួចក្នុងផ្នែក ៧ (កូនសោ registry កំព្រា)។
        may('ថ្ងៃ ' + d + ' ៖ «ស្កេនតាមថ្ងៃ» = ' + ledgerCount + ' តែកញ្ចប់ដែលនៅក្នុងប្រព័ន្ធមាន ' + liveCount
            + ' (លម្អៀង ' + (ledgerCount - liveCount) + ')',
            'យករួច ' + pickedHere + ' · បិទរួចនៅក្នុងប្រព័ន្ធ ' + (closedSet[d] || 0)
            + ' · ដកលុយរួច ' + (deducted[d] || 0)
            + '\n       ➜ ' + (ledgerCount > liveCount
                ? 'ledger នៅរាប់កញ្ចប់ដែលលែងមាន ➜ «ចំណូល (យករួច)» របស់ថ្ងៃនោះ **ធំជាងការពិត**'
                : 'ledger តិចជាងកញ្ចប់ដែលនៅ ➜ ការដកបានកើតឡើង ២ ដង ឬការស្កេនមិនបានចុះ ledger'));
    });
    if (!n8) may('គ្មានថ្ងៃក្នុង ledger ដែលប្រៀបបាន — រំលង');
    else if (!bad8) ok('ថ្ងៃ ' + n8 + ' ទាំងអស់ ៖ «ស្កេនតាមថ្ងៃ» ត្រូវនឹងកញ្ចប់ដែលនៅក្នុងប្រព័ន្ធពិត'
        + (skip8 ? '  (រំលង ' + skip8 + ' ថ្ងៃដែលធុងសំរាម purge រួច)' : ''));
    if (bad8) {
        notes.push('«ស្កេនតាមថ្ងៃ» របស់ថ្ងៃ ' + bad8 + ' មិនត្រូវនឹងកញ្ចប់ពិត ➜ ពិនិត្យថាតើ'
            + ' barcode ទាំងនោះចាកចេញតាមផ្លូវ «លុប» (មិនដកលុយ) ឬការសរសេរ ledger ធ្លាក់។');
    }
}

say('\n╔══════════════════════════════════════════════════════════╗');
say('  ✅ ' + pass + '   ⚠️ ' + warn + '   ❌ ' + fail);
if (notes.length) { say('\n  អ្វីដែលអ្នកនឹងឃើញលើអេក្រង់ ៖'); notes.forEach((n) => say('   • ' + n)); }
say('╚══════════════════════════════════════════════════════════╝');
if (REPORT) {
    // ⛔ BOM ៖ Notepad ចាស់អាន UTF-8 ដោយគ្មានវាមិនបាន
    fs.writeFileSync(REPORT, '\ufeff' + LINES.join('\n') + '\n', 'utf8');
    // ⛔ ASCII អង់គ្លេសសុទ្ធសាធទៅអេក្រង់ cmd
    console.log('Money reality check finished.');
    console.log('  passed  : ' + pass);
    console.log('  warnings: ' + warn);
    console.log('  FAILED  : ' + fail);
    console.log('  report  : ' + path.resolve(REPORT));
    console.log(fail ? '  RESULT  : PROBLEM FOUND - open the report.'
                     : '  RESULT  : all measured checks agree.');
}
process.exit(fail ? 1 : 0);
