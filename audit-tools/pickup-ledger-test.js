// ⛔ ថ្នាក់កំហុស៖ **«ចំនួនអតិថិជនយក» និង «ចំនួនកញ្ចប់យក» រាប់លើមូលដ្ឋានពីរ
// ខុសគ្នា ➜ វាឃ្លាតពីគ្នា ហើយលេខអតិថិជនជាប់គាំង។**
//
// 🔴 កំហុសផលិតកម្មពិត (អ្នកប្រើរាយការណ៍ 2026-08-27, មានជំហានសាកច្បាស់លាស់)៖
//   ១. បញ្ចូលកញ្ចប់ ១ (លេខ X) ➜ បិទ «យក»      ➜ អតិថិជន 1 · កញ្ចប់ 1  ✔
//   ២. បញ្ចូលកញ្ចប់ ២ (លេខ X ដដែល)             ➜ item ដាច់ដោយឡែក
//      (ផ្លូវស្កេន merge តែចូល item ដែល `!item.isClosed` ➜ មិន merge)
//   ៣. លុបកញ្ចប់ ១                              ➜ ledger មិនប្រែ
//   ៤. ស្តារកញ្ចប់ ១ ➜ `applyRestoreMergeInto` merge ចូលកញ្ចប់ ២
//   ៥. បើកកញ្ចប់ ១ វិញ                          ➜ កញ្ចប់ 0 ✔ តែ **អតិថិជននៅ 1** ✘
//
// មូលហេតុឫសគល់៖
//   · **កញ្ចប់** រាប់តាម **barcode** — ស្ថានភាពបិទរបស់ barcode រស់រានឆ្លងកាត់
//     ការលុប ➜ ស្តារ ➜ merge ដូច្នេះ `+1` និង `-1` ផ្គូផ្គងគ្នាជានិច្ច។
//   · **អតិថិជន** រាប់តាមស្ថានភាព **«កញ្ចប់បិទពេញ»** របស់ item — ការ merge
//     បំផ្លាញស្ថានភាពនោះ **ដោយមិនបញ្ចេញ delta** ➜ `+1` គ្មាន `-1` ផ្គូផ្គង។
//
// ច្បាប់ (សម្រេចដោយអ្នកប្រើ)៖
//   · **អតិថិជន = លេខទូរស័ព្ទផ្សេងៗគ្នាដែលមាន barcode បិទ >= ១**
//     (លេខ ១ = អតិថិជន ១ ទោះមានកញ្ចប់ ១០)
//   · **កញ្ចប់ = ចំនួន barcode ដែលបិទ**
//
// ដូច្នេះ `pickedUpPhones[key]` ត្រូវជា **ចំនួន barcode បិទរបស់លេខនោះ** ហើយ
// `countPickedUpCustomers()` (រាប់កូនសោ) ផ្តល់ចំនួនអតិថិជនត្រឹមត្រូវ។
//
// ⛔ **អថេរមិនអាចរំលោភបាន** ៖ `sum(pickedUpPhones) === packagesPickedUp`។
// បើអថេរនេះកាន់ ការឃ្លាតគ្នាក្លាយជា **មិនអាចកើតឡើងបានតាមរចនាសម្ព័ន្ធ** —
// មិនមែនត្រឹមតែ «កែកន្លែងដែលរាយការណ៍» ទេ។
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = process.env.PICKUP_APP_DIR || path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'ZoeW', 'app.js'), 'utf8');

let pass = 0, fail = 0;
function ok(label, cond, detail) {
    if (cond) { pass++; console.log('   ok    ' + label); }
    else { fail++; console.log('  FAIL   ' + label + (detail !== undefined ? '\n         ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : '')); }
}

function sliceFn(name) {
    const at = SRC.indexOf('function ' + name + '(');
    if (at === -1) return null;
    let depth = 0, start = SRC.indexOf('{', at), end = start;
    for (let k = start; k < SRC.length; k++) {
        if (SRC[k] === '{') depth++;
        else if (SRC[k] === '}') { depth--; if (!depth) { end = k; break; } }
    }
    return SRC.slice(at, end + 1);
}

// ── ១. ជាន់អប្បបរមា — checker នេះត្រូវពិតជាបានឃើញកូដ ────────────────
const callSites = SRC.match(/addPickupToDailyRecord\(/g) || [];
ok('ជាន់អប្បបរមា៖ ឃើញកន្លែងហៅ addPickupToDailyRecord >= 10',
    callSites.length >= 10, callSites.length);

// ── ២. helper រាប់ barcode បិទ ត្រូវមាន និងត្រឹមត្រូវ ──────────────────
const helperSrc = sliceFn('closedBarcodeCount');
ok('មាន `closedBarcodeCount()` — មូលដ្ឋានរួមរបស់ការរាប់ទាំង ២', !!helperSrc);

// ── ３. delta អតិថិជន ត្រូវ **ចម្លងចេញពី** delta កញ្ចប់ ─────────────────
// ⛔ ការប្រៀបធៀបអាគុយម៉ង់តាមឈ្មោះមិនគ្រប់គ្រាន់ទេ (`-pickupCustomerDelta`
// ធៀប `-pickupPackageDelta` ជាឈ្មោះខុសគ្នា តែតម្លៃដូចគ្នា)។ អ្វីដែលត្រូវ
// អះអាងគឺ **ការផ្តល់តម្លៃ** — អតិថិជនត្រូវយកតម្លៃពីកញ្ចប់ ដោយផ្ទាល់។
const ASSIGN_RULES = [
    ['pickupCustomerDelta = pickupPackageDelta;', 'ផ្លូវក្នុងឧបករណ៍ (local)'],
    ['serverCustomerDelta = serverPackageDelta;', 'ផ្លូវ transaction លើ server']
];
ASSIGN_RULES.forEach(([needle, where]) => {
    const n = (SRC.split(needle).length - 1);
    ok('delta អតិថិជនចម្លងចេញពី delta កញ្ចប់ — ' + where + ' (' + n + ' កន្លែង)',
        n >= 2, 'រំពឹង >= 2 កន្លែង (toggle barcode និង toggle កញ្ចប់) តែឃើញ ' + n);
});

// ⛔ គ្មានការគណនា delta អតិថិជនតាមស្ថានភាព «បិទពេញ» របស់ item ទៀតទេ —
// នោះជាមូលដ្ឋានចាស់ដែលការ merge បំផ្លាញ។
const OLD_BASIS = [
    /pickupCustomerDelta\s*=\s*alreadyInDesiredState/,
    /serverCustomerDelta\s*=\s*\(!!currentItem\.isClosed/,
    /pickupCustomerDelta\s*=\s*1;[\s\S]{0,120}?previousState\.itemIsClosed/,
    /serverCustomerDelta\s*=\s*\(!wasItemClosed/
];
const stale = OLD_BASIS.filter((re) => re.test(SRC));
ok('⛔ គ្មានការគណនាតាមមូលដ្ឋានចាស់ «item បិទពេញ» នៅសល់',
    stale.length === 0, stale.map(String).join(' | '));

// ការប្តូរលេខទូរស័ព្ទត្រូវផ្លាស់ ref **ទាំងអស់** មិនមែន ±1
ok('ការប្តូរលេខទូរស័ព្ទផ្លាស់ ref តាមចំនួន barcode បិទ មិនមែន ±1',
    /movedPickupRefs\s*=\s*closedBarcodeCount\(item\)/.test(SRC) &&
    !/addPickupToDailyRecord\(pickupDate, prevPickupKey, -1, 0\)/.test(SRC));

// ការ merge ស្កេនមិនប្តូរ barcode ណាមួយ ➜ មិនត្រូវបញ្ចេញ delta
ok('⛔ ការ merge ស្កេនមិនបញ្ចេញ delta (គ្មាន barcode ណាប្តូរស្ថានភាព)',
    !/reopenedFromClosed/.test(SRC));

// ── ４. ការវាស់ឥរិយាបថ — សេណារីយ៉ូពិតរបស់អ្នកប្រើ ─────────────────────
const ctx = {
    console, Object, Math, parseFloat, String, Set, Date, Array, isNaN,
    dailyPickupData: {},
    commitDailyPickupDelta: () => {},
    getFormattedDate: () => '2026-08-27'
};
vm.createContext(ctx);
vm.runInContext([
    sliceFn('getPickupPhoneKey'),
    sliceFn('countPickedUpCustomers'),
    sliceFn('addPickupToDailyRecord'),
    helperSrc || 'function closedBarcodeCount(item){ return item && item.barcodes ? item.barcodes.filter(function(b){return b && b.isClosed;}).length : 0; }',
    'this.api = { getPickupPhoneKey, countPickedUpCustomers, addPickupToDailyRecord, closedBarcodeCount };'
].filter(Boolean).join('\n\n'), ctx);
const API = ctx.api;
const DAY = '2026-08-27';

function ledger() {
    const rec = ctx.dailyPickupData[DAY] || { packagesPickedUp: 0, pickedUpPhones: {} };
    const phones = rec.pickedUpPhones || {};
    return {
        customers: API.countPickedUpCustomers(rec),
        packages: parseFloat(rec.packagesPickedUp) || 0,
        refSum: Object.keys(phones).reduce((s, k) => s + (parseFloat(phones[k]) || 0), 0)
    };
}

// ការប្តូរស្ថានភាព barcode — ក្រោយកែ delta ទាំង ២ ត្រូវជាចំនួន barcode
// បិទដែលប្រែ។ មុនកែ អតិថិជនគណនាតាមស្ថានភាព «បិទពេញ» របស់ item។
function toggleBarcode(item, idx, desiredClosed) {
    const prevBc = !!item.barcodes[idx].isClosed;
    const prevItemClosed = !!item.isClosed;
    item.barcodes[idx].isClosed = desiredClosed;
    const allClosed = item.barcodes.every((b) => b.isClosed);
    item.isClosed = allClosed;
    const pkgDelta = (prevBc === desiredClosed) ? 0 : (desiredClosed ? 1 : -1);
    const custDelta = pkgDelta;
    void prevItemClosed; void allClosed;
    API.addPickupToDailyRecord(DAY, API.getPickupPhoneKey(item), custDelta, pkgDelta);
}

const PHONE = '0974158508';
const p1 = { id: 'A', phone: PHONE, scanDate: DAY, isClosed: false, barcodes: [{ code: 'BC1', isClosed: false }] };
toggleBarcode(p1, 0, true);
let st = ledger();
ok('១. បិទ «យក» កញ្ចប់ ១ ➜ អតិថិជន 1 · កញ្ចប់ 1',
    st.customers === 1 && st.packages === 1, JSON.stringify(st));

// កញ្ចប់ ២ ជា item ដាច់ដោយឡែក (ផ្លូវស្កេនមិន merge ចូល item ដែលបិទរួច)
const p2 = { id: 'B', phone: PHONE, scanDate: DAY, isClosed: false, barcodes: [{ code: 'BC2', isClosed: false }] };
// លុប ➜ ស្តារ ➜ merge ៖ ផ្លូវទាំង ២ **មិនបញ្ចេញ delta pickup សោះ**
p2.barcodes.push({ code: 'BC1', isClosed: true });
p2.isClosed = p2.barcodes.every((b) => b.isClosed);
st = ledger();
ok('៤. ក្រោយលុប ➜ ស្តារ ➜ merge ៖ ledger មិនប្រែ (barcode នៅបិទដដែល)',
    st.customers === 1 && st.packages === 1, JSON.stringify(st));

toggleBarcode(p2, 1, false);
st = ledger();
ok('⛔ ៥. បើកកញ្ចប់ ១ វិញ ➜ អតិថិជន **0** និងកញ្ចប់ **0**',
    st.customers === 0 && st.packages === 0,
    JSON.stringify(st) + ' — លេខអតិថិជនជាប់គាំង ខណៈកញ្ចប់ត្រឡប់ត្រឹមត្រូវ');

// ── ５. អថេរ៖ ផលបូក ref === ចំនួនកញ្ចប់ ─────────────────────────────
ctx.dailyPickupData = {};
const q = { id: 'C', phone: '0123456789', scanDate: DAY, isClosed: false,
    barcodes: [{ code: 'Y1', isClosed: false }, { code: 'Y2', isClosed: false }] };
toggleBarcode(q, 0, true);
toggleBarcode(q, 1, true);
st = ledger();
ok('លេខទូរស័ព្ទ ១ · barcode បិទ ២ ➜ អតិថិជន **1** (មិនមែន 2)',
    st.customers === 1, JSON.stringify(st));
ok('⛔ អថេរ៖ ផលបូក ref === ចំនួនកញ្ចប់',
    st.refSum === st.packages, 'refSum=' + st.refSum + ' packages=' + st.packages);
toggleBarcode(q, 0, false);
toggleBarcode(q, 1, false);
st = ledger();
ok('បើកទាំង ២ វិញ ➜ អតិថិជន 0 · កញ្ចប់ 0',
    st.customers === 0 && st.packages === 0, JSON.stringify(st));

console.log('\n' + (fail ? '❌ ធ្លាក់ ' + fail + ' (ជោគជ័យ ' + pass + ')' : '✅ ជោគជ័យ ' + pass));
process.exit(fail ? 1 : 0);
