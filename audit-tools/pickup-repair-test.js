// ⛔ **ការជួសជុលលេខថ្ងៃចាស់ ត្រូវសុវត្ថិភាពតាមរចនាសម្ព័ន្ធ។**
//
// បរិបទ៖ កំណែ 2.19.4 ប្តូរមូលដ្ឋានរាប់ «អតិថិជនយក» ➜ លេខ **ថ្ងៃចាស់**
// ដែលសរសេរតាមមូលដ្ឋានចាស់ អាចនៅមានអតិថិជនខ្មោច។ អ្នកប្រើសុំឲ្យកែ។
//
// ⛔ **ហានិភ័យធំបំផុត៖ ការគណនាឡើងវិញឆៅនឹងលុបលេខថ្ងៃចាស់ទាំងអស់។**
// `zoew_daily_pickup_cod_dod` **មិនដែលកាត់បន្ថយទេ** — វាកាន់ថ្ងៃពីដើមរហូត។
// តែទិន្នន័យប្រភពរស់តែ ≤ ៨ ថ្ងៃ (ប្រវត្តិ) + ≤ ៣០ ថ្ងៃ (ធុងសំរាម) ➜ ថ្ងៃចាស់
// គណនាឡើងវិញបាន **0** ➜ **ការបាត់ទិន្នន័យអាជីវកម្មពិត**។
//
// **ច្រកសុវត្ថិភាព** ៖ `packagesPickedUp` ត្រូវបានរាប់តាម **barcode** ជានិច្ច
// (សូម្បីមុន 2.19.4) ➜ វា **អាចទុកចិត្តបាន**។ មានតែ `pickedUpPhones` ទេ
// ដែលខូច។ ដូច្នេះ៖
//   · គណនា barcode បិទឡើងវិញពីប្រវត្តិ + ធុងសំរាមសម្រាប់ថ្ងៃនោះ
//   · **ជួសជុលតែពេលផលបូកនោះត្រូវនឹង `packagesPickedUp` ដែលមានស្រាប់**
//     ➜ ភស្តុតាងថាទិន្នន័យប្រភពនៅ**គ្រប់** ➜ ជួសជុលដោយសុវត្ថិភាព
//   · បើមិនត្រូវ ➜ **រំលងថ្ងៃនោះ** (កុំទាយ កុំបំផ្លាញ)
//   · **មិនប៉ះ `packagesPickedUp` ឡើយ**
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = process.env.PICKUPREPAIR_APP_DIR || path.join(__dirname, '..');
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

// ជាន់អប្បបរមា — checker នេះត្រូវពិតជាបានឃើញកូដ
ok('ជាន់អប្បបរមា៖ ឃើញ markPickupBarcodes ក្នុងកូដ',
    SRC.indexOf('function markPickupBarcodes(') !== -1);

const planFn = sliceFn('planPickupLedgerRepair');
ok('មាន `planPickupLedgerRepair()` — គណនាផែនការជួសជុលដោយមិនសរសេរ', !!planFn);
if (!planFn) {
    console.log('\n❌ ធ្លាក់ ' + fail + ' (ជោគជ័យ ' + pass + ')');
    process.exit(1);
}

const ctx = {
    console, Object, Math, parseFloat, String, Set, Array, isNaN, JSON
};
vm.createContext(ctx);
vm.runInContext([
    (/const PICKUP_PHONE_KEY_MAX = ([0-9]+);/.exec(SRC) || [null, '64'])[0] || 'const PICKUP_PHONE_KEY_MAX = 64;',
    sliceFn('ledgerNumber'),
    sliceFn('barcodeRegistryKey'),
    sliceFn('pickupBarcodeKey'),
    sliceFn('pickupSetSize'),
    sliceFn('tallyPickupPhones'),
    sliceFn('getPickupPhoneKey'),
    sliceFn('collectPickupMarks'),
    planFn,
    'this.api = { planPickupLedgerRepair, tallyPickupPhones };'
].filter(Boolean).join('\n\n'), ctx);
const plan = ctx.api.planPickupLedgerRepair;
const tally = (setObj) => ctx.api.tallyPickupPhones(setObj || {});

const bc = (code, closed) => ({ code: code, isClosed: closed });
function day(d, items, trash, ledger) {
    return plan(ledger, items || [], trash || []);
}

// ── ១. ថ្ងៃដែលទិន្នន័យនៅគ្រប់ ➜ ជួសជុលបាន ────────────────────────────
{
    const ledger = { '2026-08-27': { packagesPickedUp: 1, pickedUpPhones: { '0970008508': 1, '0999000111': 1 } } };
    const items = [{ id: 'a', phone: '0970008508', scanDate: '2026-08-27', barcodes: [bc('B1', true), bc('B2', false)] }];
    const out = day('2026-08-27', items, [], ledger);
    ok('ថ្ងៃដែលទិន្នន័យគ្រប់ ➜ មានផែនការជួសជុល', out.length === 1, JSON.stringify(out));
    const p = out[0] || {};
    const phones = tally(p.pickedUpBarcodes);
    ok('អតិថិជនខ្មោច `0999000111` ត្រូវដកចេញ',
        !phones['0999000111'] && phones['0970008508'] === 1, JSON.stringify(phones));
    ok('ផែនការជាសំណុំ barcode (មិនមែនលេខសរុប)',
        p.pickedUpBarcodes && Object.keys(p.pickedUpBarcodes).length === 1 && p.pickedUpBarcodes.B1 === '0970008508',
        JSON.stringify(p.pickedUpBarcodes));
    ok('⛔ `packagesPickedUp` **មិនត្រូវប៉ះ** ក្នុងផែនការ (វាដេរីវេពេលសរសេរ)',
        p.packagesPickedUp === undefined, JSON.stringify(p));
}

// ── ２. ⛔ ថ្ងៃចាស់ដែលទិន្នន័យត្រូវ purge រួច ➜ **មិនត្រូវប៉ះ** ─────────
// នេះជាការអះអាងសំខាន់បំផុត — បើវាធ្លាក់ អ្នកប្រើបាត់លេខអាជីវកម្មពិត។
{
    const ledger = { '2026-01-01': { packagesPickedUp: 12, pickedUpPhones: { '0912000001': 7, '0912000002': 5 } } };
    const out = day('2026-01-01', [], [], ledger);
    ok('⛔ ថ្ងៃចាស់ (ទិន្នន័យ purge រួច) ➜ **រំលង មិនលុប**', out.length === 0, JSON.stringify(out));
}

// ── ３. ថ្ងៃដែល purge ខ្លះ (មិនគ្រប់) ➜ រំលងដដែល ────────────────────
{
    const ledger = { '2026-08-20': { packagesPickedUp: 5, pickedUpPhones: { '0912000003': 5 } } };
    const items = [{ id: 'b', phone: '0912000003', scanDate: '2026-08-20', barcodes: [bc('C1', true)] }];
    const out = day('2026-08-20', items, [], ledger);
    ok('⛔ ថ្ងៃដែល purge ខ្លះ (1 ធៀប 5) ➜ **រំលង កុំទាយ**', out.length === 0, JSON.stringify(out));
}

// ── ４. ធុងសំរាមត្រូវរាប់ដែរ (barcode បិទរស់នៅទីនោះ) ─────────────────
{
    const ledger = { '2026-08-26': { packagesPickedUp: 2, pickedUpPhones: { '0912000004': 9 } } };
    const items = [{ id: 'c', phone: '0912000004', scanDate: '2026-08-26', barcodes: [bc('D1', true)] }];
    const trash = [{ id: 'd', phone: '0912000004', scanDate: '2026-08-26', barcodes: [bc('D2', true)] }];
    const out = day('2026-08-26', items, trash, ledger);
    ok('ធុងសំរាមរាប់ចូលដែរ ➜ ជួសជុលបាន',
        out.length === 1 && tally(out[0].pickedUpBarcodes)['0912000004'] === 2, JSON.stringify(out));
}

// ── ５. ថ្ងៃដែលត្រឹមត្រូវរួច ➜ គ្មានការសរសេរ (idempotent) ─────────────
{
    const ledger = { '2026-08-25': { packagesPickedUp: 1, pickedUpPhones: { '0912000005': 1 }, pickedUpBarcodes: { E1: '0912000005' } } };
    const items = [{ id: 'e', phone: '0912000005', scanDate: '2026-08-25', barcodes: [bc('E1', true)] }];
    const out1 = day('2026-08-25', items, [], ledger);
    ok('ថ្ងៃដែលត្រឹមត្រូវរួច ➜ គ្មានការសរសេរ', out1.length === 0, JSON.stringify(out1));
    // ដំណើរការម្តងទៀតលើលទ្ធផលដែលជួសជុលរួច ក៏ត្រូវស្ងាត់ដែរ
    const fixedLedger = { '2026-08-27': { packagesPickedUp: 1, pickedUpPhones: { '0970008508': 1 }, pickedUpBarcodes: { B1: '0970008508' } } };
    const fixedItems = [{ id: 'a', phone: '0970008508', scanDate: '2026-08-27', barcodes: [bc('B1', true), bc('B2', false)] }];
    ok('⛔ idempotent ៖ រត់ម្តងទៀតក្រោយជួសជុល ➜ គ្មានការសរសេរ',
        day('2026-08-27', fixedItems, [], fixedLedger).length === 0);
    // ថ្ងៃចាស់ដែលមានតែលេខ (គ្មានសំណុំ) ➜ ត្រូវប្តូរទៅសំណុំ barcode ម្តង
    const legacyLedger = { '2026-08-22': { packagesPickedUp: 1, pickedUpPhones: { '0912000009': 1 } } };
    const legacyItems = [{ id: 'x', phone: '0912000009', scanDate: '2026-08-22', barcodes: [bc('X1', true)] }];
    const legacyOut = day('2026-08-22', legacyItems, [], legacyLedger);
    ok('⛔ ថ្ងៃចាស់ (លេខតែម្យ៉ាង) ➜ ផ្លាស់ទៅសំណុំ barcode ១ ដង',
        legacyOut.length === 1 && legacyOut[0].pickedUpBarcodes.X1 === '0912000009', JSON.stringify(legacyOut));
}

// ── ６. ថ្ងៃដែលគ្មាន barcode បិទសោះ តែ ledger ទទេដែរ ➜ ស្ងាត់ ─────────
{
    const ledger = { '2026-08-24': { packagesPickedUp: 0, pickedUpPhones: {} } };
    const items = [{ id: 'f', phone: '0912000006', scanDate: '2026-08-24', barcodes: [bc('F1', false)] }];
    ok('ថ្ងៃទទេ ➜ គ្មានការសរសេរ', day('2026-08-24', items, [], ledger).length === 0);
}

// ── ７. អថេរក្រោយជួសជុល ─────────────────────────────────────────────
{
    const ledger = { '2026-08-23': { packagesPickedUp: 3, pickedUpPhones: { 'X': 99 } } };
    const items = [
        { id: 'g', phone: '0912000007', scanDate: '2026-08-23', barcodes: [bc('G1', true), bc('G2', true)] },
        { id: 'h', phone: '0912000008', scanDate: '2026-08-23', barcodes: [bc('H1', true)] }
    ];
    const out = day('2026-08-23', items, [], ledger);
    ok('ការជួសជុលផ្តល់ ១ ថ្ងៃ', out.length === 1, JSON.stringify(out));
    const outPhones = tally(out[0].pickedUpBarcodes);
    const refs = Object.values(outPhones).reduce((a, b) => a + b, 0);
    ok('⛔ អថេរ៖ ផលបូក ref === packagesPickedUp ដែលមានស្រាប់',
        refs === 3, 'refSum=' + refs);
    ok('អតិថិជន = ២ លេខទូរស័ព្ទ (មិនមែន ៣ barcode)',
        Object.keys(outPhones).length === 2, JSON.stringify(outPhones));
}

console.log('\n' + (fail ? '❌ ធ្លាក់ ' + fail + ' (ជោគជ័យ ' + pass + ')' : '✅ ជោគជ័យ ' + pass));
process.exit(fail ? 1 : 0);
