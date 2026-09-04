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
//
// ⛔ **កំណែ 2.27.0 ៖ មូលដ្ឋានរាប់ក្លាយជា *សំណុំ barcode*** —
// `pickedUpBarcodes/$barcodeKey = phoneKey` ហើយលេខទាំង ២ ជា **កញ្ចក់ដេរីវេ**
// (`packagesPickedUp` = ចំនួនកូនសោ · `pickedUpPhones` = ការរាប់តម្លៃ)។
// ដូច្នេះអថេរខាងលើក្លាយជា **ពិតតាមរចនាសម្ព័ន្ធ** ហើយឯកសារនេះឈប់វាស់
// «delta ត្រូវចម្លងគ្នា» (ដែលលែងមាន) មកវាស់ **ការដេរីវេ** វិញ។
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
const callSites = SRC.match(/(?:markPickupBarcodes|revertPickupMarks|collectPickupMarks|reconstructPickupSet)\(/g) || [];
ok('ជាន់អប្បបរមា៖ ឃើញកន្លែងហៅផ្លូវស្ថិតិយក >= 10', callSites.length >= 10, callSites.length);

// ── ២. អត្តសញ្ញាណ ៖ កូនសោស្ថិតិយកត្រូវជាកូនសោ barcode ដដែលនឹង registry ─
// ⛔ បើកូនសោ ២ ខាងគណនាតាមរូបមន្តខុសគ្នា នោះ barcode តែមួយអាចកាន់កន្លែង
// **ពីរ** ➜ ការរាប់ស្ទួនវិលមកវិញតាមទ្វារថ្មី។
const keyFn = sliceFn('pickupBarcodeKey');
ok('មាន `pickupBarcodeKey()` — មូលដ្ឋានតែមួយនៃកូនសោស្ថិតិយក', !!keyFn);
ok('⛔ `pickupBarcodeKey()` ប្រើ `barcodeRegistryKey()` ដដែលនឹង registry',
    !!keyFn && /barcodeRegistryKey\(/.test(keyFn), keyFn);

// ── ３. លេខទាំង ២ ត្រូវ **ដេរីវេ** ចេញពីសំណុំ មិនមែនបូក/ដក ─────────────
const buildFn = sliceFn('buildPickupRecordFromSet');
ok('មាន `buildPickupRecordFromSet()` — កន្លែងតែមួយដែលសាង record', !!buildFn);
ok('⛔ `packagesPickedUp` ដេរីវេពីទំហំសំណុំ',
    !!buildFn && /packagesPickedUp:\s*size/.test(buildFn), buildFn);
ok('⛔ `pickedUpPhones` ដេរីវេពីការរាប់តម្លៃ (`tallyPickupPhones`)',
    !!buildFn && /tallyPickupPhones\(/.test(buildFn), buildFn);
const arith = SRC.match(/packagesPickedUp\s*(?:\+=|-=)|packagesPickedUp\s*=\s*[^;\n]*[+\-][^;\n]*;/g) || [];
ok('⛔ គ្មាននព្វន្ធលើ `packagesPickedUp` នៅកន្លែងណាទៀតទេ (បូក/ដក = ការផ្ទុះ)',
    arith.length === 0, arith);
const phoneArith = SRC.match(/pickedUpPhones\[[^\]]+\]\s*=\s*[^;\n]*[+\-]/g) || [];
ok('⛔ គ្មាននព្វន្ធលើ `pickedUpPhones[...]` ទៀតទេ', phoneArith.length === 0, phoneArith);

// ការប្តូរលេខទូរស័ព្ទត្រូវផ្លាស់ **ម្ចាស់** នៃកូនសោ barcode បិទទាំងអស់
ok('ការប្តូរលេខទូរស័ព្ទប្តូរម្ចាស់កូនសោ barcode បិទ (មិនមែន ±1)',
    /closedPickupMarks\s*=\s*\(source\)\s*=>\s*collectPickupMarks\(/.test(SRC));

// ការ merge ស្កេនមិនប្តូរ barcode ណាមួយ ➜ មិនត្រូវបញ្ចេញ delta
ok('⛔ ការ merge ស្កេនមិនបញ្ចេញ delta (គ្មាន barcode ណាប្តូរស្ថានភាព)',
    !/reopenedFromClosed/.test(SRC));

// ── ４. ការវាស់ឥរិយាបថ — សេណារីយ៉ូពិតរបស់អ្នកប្រើ ─────────────────────
const ctx = {
    console, Object, Math, parseFloat, String, Set, Date, Array, isNaN, JSON,
    dailyPickupData: {}, scanHistory: [], deletedItems: [],
    Promise,
    dbRefDailyPickup: null, db: null, fb: null,
    showToast: () => {},
    getFormattedDate: () => '2026-08-27'
};
vm.createContext(ctx);
function sliceConst(name) {
    const m = new RegExp('const\\s+' + name + '\\s*=\\s*([^;\\n]+);').exec(SRC);
    return m ? 'const ' + name + ' = ' + m[1] + ';' : null;
}
// ⛔ កុំបញ្ឈប់ checker ពេលរកឈ្មោះមិនឃើញ — រាយឈ្មោះដែលបាត់ រួច **stub**
// ជំនួស ដើម្បីឲ្យការអះអាងឥរិយាបថខាងក្រោមនៅតែរត់ (មេរៀន 2.19.3)។
const NEEDED_FNS = ['ledgerNumber', 'barcodeRegistryKey', 'getPickupPhoneKey', 'countPickedUpCustomers',
    'pickupBarcodeKey', 'pickupSetSize', 'tallyPickupPhones', 'legacyPickupPlaceholders', 'pickupSetFromRecord',
    'buildPickupRecordFromSet', 'applyPickupMarksToSet', 'collectPickupMarks', 'reconstructPickupSet',
    'applyPickupMarksInMemory', 'commitPickupMarks', 'markPickupBarcodes', 'revertPickupMarks', 'reapplyPickupMarks'];
const missingFns = NEEDED_FNS.filter((n) => !sliceFn(n));
ok('រក function ផ្លូវស្ថិតិយកឃើញទាំង ' + NEEDED_FNS.length, missingFns.length === 0, missingFns);
vm.runInContext([
    sliceConst('PICKUP_LEGACY_KEY_PREFIX') || 'const PICKUP_LEGACY_KEY_PREFIX = "_lg_";',
    sliceConst('PICKUP_PHONE_KEY_MAX') || 'const PICKUP_PHONE_KEY_MAX = 64;',
    ...NEEDED_FNS.map((n) => sliceFn(n) || ('function ' + n + '() { return undefined; }')),
    'this.api = { getPickupPhoneKey, countPickedUpCustomers, markPickupBarcodes, revertPickupMarks, collectPickupMarks, pickupBarcodeKey };'
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

// ការប្តូរស្ថានភាព barcode — សរសេរ **ស្ថានភាព** មិនមែន delta
function toggleBarcode(item, idx, desiredClosed) {
    item.barcodes[idx].isClosed = desiredClosed;
    item.isClosed = item.barcodes.every((b) => b.isClosed);
    const key = API.pickupBarcodeKey(item.barcodes[idx].code);
    API.markPickupBarcodes(DAY, [{ key: key, phoneKey: API.getPickupPhoneKey(item), closed: desiredClosed }], null);
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

// ⛔ ការសរសេរដដែលៗ (ការជាន់គ្នា · ការព្យាយាមឡើងវិញ) មិនត្រូវបូកឡើង
toggleBarcode(q, 0, true);
toggleBarcode(q, 0, true);
st = ledger();
ok('⛔ idempotent ៖ បិទ barcode ដដែល ៣ ដង ➜ នៅតែ ២ កញ្ចប់',
    st.packages === 2 && st.customers === 1, JSON.stringify(st));

toggleBarcode(q, 0, false);
toggleBarcode(q, 1, false);
st = ledger();
ok('បើកទាំង ២ វិញ ➜ អតិថិជន 0 · កញ្ចប់ 0',
    st.customers === 0 && st.packages === 0, JSON.stringify(st));

// ⛔ ការបើកដដែលៗក៏មិនត្រូវធ្លាក់ក្រោម 0 ដែរ
toggleBarcode(q, 0, false);
st = ledger();
ok('⛔ បើក barcode ដែលបើករួច ➜ នៅ 0 (គ្មានលេខអវិជ្ជមាន)',
    st.packages === 0 && st.customers === 0, JSON.stringify(st));

// ── ６. ការដកវិញ (revert) ត្រូវត្រឡប់ស្ថានភាព **ដើម** មិនមែនលេខ ───────
{
    ctx.dailyPickupData = {};
    const r = { id: 'D', phone: '0111222333', scanDate: DAY, isClosed: false, barcodes: [{ code: 'Z1', isClosed: false }] };
    const key = API.pickupBarcodeKey('Z1');
    const applied = API.markPickupBarcodes(DAY, [{ key: key, phoneKey: API.getPickupPhoneKey(r), closed: true }], null);
    ok('បិទ ➜ កញ្ចប់ 1', ledger().packages === 1, JSON.stringify(ledger()));
    API.revertPickupMarks(applied);
    ok('⛔ revert ➜ ត្រឡប់ទៅ 0 ពិតប្រាកដ', ledger().packages === 0 && ledger().customers === 0, JSON.stringify(ledger()));
    API.revertPickupMarks(applied);
    ok('⛔ revert ២ ដង ➜ នៅ 0 ដដែល (មិនធ្លាក់ក្រោម)', ledger().packages === 0, JSON.stringify(ledger()));
}

console.log('\n' + (fail ? '❌ ធ្លាក់ ' + fail + ' (ជោគជ័យ ' + pass + ')' : '✅ ជោគជ័យ ' + pass));
process.exit(fail ? 1 : 0);
