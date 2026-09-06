// ⛔⛔ ថ្នាក់កំហុសលុយ៖ **transaction ដែល *បោះបង់* (`committed: false`) ➜ ការ
// បញ្ច្រាសមិនរត់** ➜ ចំណូលប្រែ ខណៈតម្លៃកញ្ចប់មិនប្រែ។
//
// `saveEditedBarcodePrice()` បូកលុយចូលសតិ **និង server** ជាមុន រួចរត់
// transaction លើកញ្ចប់។ ការគ្រប់គ្រងលទ្ធផលសរសេរជា៖
//
//     }).then((result) => {
//         if (!result || !result.committed) {
//             throw new Error('Barcode price transaction was not committed');
//         }
//         …
//     }, () => { …បញ្ច្រាសលុយ… })
//       .catch((postErr) => { console.error(…); });   ⟵ លេបស្ងាត់
//
// ⛔ `throw` ខាងក្នុង handler **ជោគជ័យ** មិនទៅដល់ handler **បរាជ័យ** ទេ —
// វាទៅដល់ `.catch()` ដែលគ្រាន់តែកត់ត្រា។ ដូច្នេះការបោះបង់ ➜ **លុយនៅដដែល**។
//
// **វាស់បានលើ `origin/main` (2026-09-03)** — កែ COD ពី $10 ទៅ $25 ខណៈ
// transaction បោះបង់ (ឧបករណ៍ផ្សេងកំពុង «លុបទាំងអស់» ➜ `clearClaim`,
// ឬ RTDB អស់ចំនួនព្យាយាមក្រោមការប្រកួតប្រជែង)៖
//
//   | រង្វាស់ | មុនកែ |
//   |---|---|
//   | ចំណូលក្នុងសតិ | **+$15** |
//   | ចំណូលនៅ server | **+$15** |
//   | តម្លៃ barcode នៅ server | **$10 (មិនប្រែ)** |
//   | Toast ដល់អ្នកប្រើ | **គ្មានសោះ** |
//
// ➜ លុយឡើង ខណៈកញ្ចប់មិនប្រែ ហើយអ្នកប្រើមិនដឹងអ្វីទាំងអស់។
//
// ⛔ **មូលហេតុដែល checker ១២៤ បៃតងទាំងអស់** ៖ `ui-flow-test.js` សាកករណី
// «កញ្ចប់រលាយ» (`currentItem === null` ➜ transaction **commit**) និងករណី
// «បដិសេធ» (promise **reject**) — តែ **គ្មានឯកសារណាដាក់ transaction ក្នុង
// របៀប *បោះបង់* សោះ**។ «commit ដោយគ្មានការផ្លាស់ប្តូរ» និង «បោះបង់» ជា
// លទ្ធផល ២ ផ្សេងគ្នារបស់ RTDB — សំណួរទី ៩ ក្នុងទម្រង់ថ្មី។
//
// ច្បាប់ដែលឯកសារនេះចាក់សោ (ទាំង ២ ខាង)៖
//   ១. បោះបង់ ➜ លុយត្រូវត្រឡប់ដើម (សតិ **និង** server) + Toast ប្រាប់ការពិត។
//   ២. ⛔ ទិសផ្ទុយ ៖ commit ធម្មតា ➜ លុយប្រែ **១ ដងគត់** និងតម្លៃចុះពិត។
//   ៣. កញ្ចប់រលាយ (commit តែគ្មានការផ្លាស់ប្តូរ) ➜ លុយត្រឡប់ដើម។
//   ៤. បដិសេធ (permission_denied) ➜ លុយត្រឡប់ដើម។
//   ៥. ⛔ ការ **ព្យួរ** ≠ ការបរាជ័យ ៖ RTDB ចាក់ជួរការសរសេរ ➜ លុយ **មិនត្រូវ
//      បញ្ច្រាស** ហើយការ commit យឺតត្រូវបញ្ចប់ការងារ (មេរៀន 2.25.6)។
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = process.env.PRICEABORT_APP_DIR ? path.resolve(process.env.PRICEABORT_APP_DIR) : path.join(__dirname, '..');
const APP = path.join(ROOT, 'ZoeW');

let pass = 0, fail = 0;
function ok(label, cond, detail) {
    if (cond) { pass++; console.log('   ok    ' + label); }
    else { fail++; console.log('  FAIL   ' + label + (detail !== undefined ? '\n         ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : '')); }
}

let SRC = '';
try {
    SRC = fs.readFileSync(path.join(APP, 'app.js'), 'utf8');
} catch (e) {
    console.log('  FAIL   អាន ZoeW/app.js មិនបាន ➜ ' + e.message);
    console.log('\n❌ ធ្លាក់ — កូដដែលតេស្តនេះការពារ បាត់ពី tree ដែលកំពុងពិនិត្យ');
    process.exit(1);
}

function sliceFn(name) {
    const at = SRC.search(new RegExp('(?:async\\s+)?function\\s+' + name + '\\s*\\('));
    if (at === -1) return null;
    let depth = 0;
    const start = SRC.indexOf('{', SRC.indexOf(')', at));
    for (let k = start; k < SRC.length; k++) {
        if (SRC[k] === '{') depth++;
        else if (SRC[k] === '}') { depth--; if (!depth) return SRC.slice(at, k + 1); }
    }
    return null;
}

const NEEDED = [
    'elapsedSince', 'withTimeout', 'dbOp', 'dbOpStalled', 'armLateCommit',
    'getFormattedDate', 'appZoneParts', 'getZoneDateKey', 'getServerNow',
    'ledgerNumber', 'ledgerAppliedDelta', 'ledgerDeltaWithClamp', 'revertLedgerRecordInMemory',
    'recalcItemMoneyFromBarcodes', 'applyLedgerBucketDelta', 'commitRevenueBucketDelta',
    'ledgerZeroDelta', 'ledgerServerVerdict', 'ledgerMemoryCompensationClaimed', 'revertLedgerBucketOnServer', 'revertRevenueLedgerDelta', 'correctRevenueLedgerToActual',
    'addRevenueToDailyAndMonthlyRecord', 'commitDailyRevenueDelta', 'commitMonthlyRevenueDelta',
    'normalizeBarcodesOf', 'barcodeEntriesOf', 'sanitizeInput', 'formatScanStamp',
    'openViewListModal', 'closeModal', 'openModalHelper', 'viewListModalShowing',
    'saveEditedBarcodePrice'
];
const missing = NEEDED.filter((n) => !sliceFn(n));
ok('ជាន់អប្បបរមា៖ រកឃើញ function ដែលចាំបាច់ទាំង ' + NEEDED.length,
    missing.length === 0, missing.join(', '));
if (missing.indexOf('saveEditedBarcodePrice') !== -1) {
    console.log('\n❌ ធ្លាក់ ' + fail + ' — គ្មាន saveEditedBarcodePrice ➜ វាស់អ្វីមិនបានទេ');
    process.exit(1);
}

const DATE_KEY = new Date().toISOString().slice(0, 10);
const HISTORY_ROOT = 'zoew_scan_history_cod_dod';

function makeCtx(mode) {
    const els = {};
    const mkEl = (id) => ({
        id: id, value: '', innerText: '', innerHTML: '', className: '',
        style: {}, hidden: false, disabled: false,
        appendChild() {}, querySelector() { return null; }, querySelectorAll() { return []; },
        classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
        getAttribute() { return null; }, setAttribute() {}, focus() {}, blur() {}
    });
    ['editBcCodInput', 'editBcDodInput', 'editBcPcText', 'barcodeListContainer',
        'listModalPhoneText', 'viewListModal', 'editBarcodePriceModal', 'phoneSuggestBox']
        .forEach((id) => { els[id] = mkEl(id); });

    const serverLedger = {};
    const serverHistory = {};
    const pending = [];

    const ctx = {
        console, Math, JSON, parseFloat, parseInt, isNaN, isFinite, Date, Object, Array,
        String, Number, Promise, Set, Map, Intl,
        setTimeout: (fn, ms) => setTimeout(fn, ms >= 10000 ? 0 : ms),
        clearTimeout,
        document: {
            getElementById: (id) => els[id] || null,
            querySelectorAll: () => [],
            createElement: () => mkEl('x'),
            body: { style: {}, classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } } }
        },
        db: {}, serverTimeOffsetMs: 0, exchangeRateRiel: 4100,
        dailyRevenueData: {}, monthlyRevenueData: {},
        dbRefDailyRevenue: { path: 'zoew_daily_revenue_cod_dod' },
        dbRefMonthlyRevenue: { path: 'zoew_monthly_revenue_cod_dod' },
        activeParentItemId: 'id_1', activeEditingBarcode: 'BC1',
        scanHistory: [], isModalOpen: false, pendingBarcode: '',
        editingItemId: null, markingItemId: null,
        toasts: [], lateResolvers: [],
        showToast(m) { ctx.toasts.push(String(m)); },
        refreshCurrentHistoryView() {}, clearLookupStatus() {}, safeFocusScanner() {},
        resumeScanVideo() {}, hidePhoneSuggestions() {}, showAppChrome() {},
        __serverLedger: serverLedger, __serverHistory: serverHistory, __pending: pending
    };

    ctx.fb = {
        ref: (_db, p) => ({ path: p === undefined ? '' : String(p) }),
        increment: (n) => ({ __inc: n }),
        runTransaction: (r, fn) => {
            const p = String(r.path);
            if (p.indexOf(HISTORY_ROOT) !== 0) {
                const cur = serverLedger[p] === undefined ? null : serverLedger[p];
                const next = fn(cur === null ? null : JSON.parse(JSON.stringify(cur)));
                if (next === undefined) return Promise.resolve({ committed: false, snapshot: { val: () => serverLedger[p] || null } });
                serverLedger[p] = next;
                return Promise.resolve({ committed: true, snapshot: { val: () => serverLedger[p] } });
            }
            const id = p.split('/')[1];
            const runUpdater = () => {
                const cur = serverHistory[id] === undefined ? null : serverHistory[id];
                const next = fn(cur === null ? null : JSON.parse(JSON.stringify(cur)));
                if (next === undefined) return { committed: false, snapshot: { val: () => serverHistory[id] || null } };
                if (next === null) { delete serverHistory[id]; return { committed: true, snapshot: { val: () => null } }; }
                serverHistory[id] = next;
                return { committed: true, snapshot: { val: () => serverHistory[id] } };
            };
            if (mode === 'abort') {
                fn(serverHistory[id] ? JSON.parse(JSON.stringify(serverHistory[id])) : null);
                return Promise.resolve({ committed: false, snapshot: { val: () => serverHistory[id] || null } });
            }
            if (mode === 'reject') return Promise.reject(new Error('permission_denied'));
            if (mode === 'stall') {
                return new Promise((resolve) => { pending.push(() => resolve(runUpdater())); });
            }
            return Promise.resolve(runUpdater());
        },
        update: () => Promise.resolve(),
        get: () => Promise.resolve({ exists: () => false, val: () => null })
    };
    ctx.window = ctx;
    vm.createContext(ctx);
    // ⛔ ថេរដែល function ដែលស្រង់ចូលយោង — ត្រូវអានចេញពី `app.js` ពិត
    // មិនមែនចាក់លេខក្នុង checker (បើមិនដូច្នេះ ការប្តូរពិដានក្នុងកូដ ship
    // នឹងមិនឆ្លុះក្នុងតេស្ត ➜ ចាក់សោការសន្មតចាស់)។
    const DB_OP_TIMEOUT = /const DB_OP_TIMEOUT_MS = (\d+);/.exec(SRC);
    vm.runInContext('const DB_OP_TIMEOUT_MS = ' + (DB_OP_TIMEOUT ? DB_OP_TIMEOUT[1] : '15000') + ';\n'
        + NEEDED.filter((n) => sliceFn(n)).map(sliceFn).join('\n'), ctx);
    ctx.__els = els;
    return ctx;
}

function seedItem() {
    return {
        id: 'id_1', phone: '012345678', scanDate: DATE_KEY,
        cod: 10, dod: 0, price: 10, count: 1, barcode: 'BC1', isClosed: false, isCalled: false,
        createdAt: 1,
        barcodes: [{ code: 'BC1', cod: 10, dod: 0, locker: 'N/A', time: 't', isClosed: false, isDeducted: false, isFromDeletion: false, createdAt: 1 }]
    };
}

function setup(mode) {
    const ctx = makeCtx(mode);
    ctx.scanHistory = [seedItem()];
    ctx.__serverHistory.id_1 = seedItem();
    ctx.__els.editBcCodInput.value = '25';
    ctx.__els.editBcDodInput.value = '0';
    return ctx;
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 25));

function memoryCod(ctx) {
    const rec = ctx.dailyRevenueData[DATE_KEY];
    return rec ? Math.round((parseFloat(rec.codDollar) || 0) * 100) / 100 : 0;
}
function serverCod(ctx) {
    const rec = ctx.__serverLedger['zoew_daily_revenue_cod_dod/' + DATE_KEY];
    return rec ? Math.round((parseFloat(rec.codDollar) || 0) * 100) / 100 : 0;
}
function serverBarcodeCod(ctx) {
    const it = ctx.__serverHistory.id_1;
    return it && it.barcodes ? it.barcodes[0].cod : null;
}
function toastText(ctx) { return ctx.toasts.join(' | '); }

(async () => {
    // ═══ ១. ⛔ បោះបង់ ➜ លុយត្រូវត្រឡប់ដើម ═════════════════════════════
    console.log('\n=== ១. transaction បោះបង់ (committed:false) ➜ លុយមិនត្រូវប្រែ ===');
    {
        const ctx = setup('abort');
        ctx.saveEditedBarcodePrice();
        await settle(); await settle();
        ok('សតិ ៖ ចំណូលមិនប្រែ (' + memoryCod(ctx) + ')', memoryCod(ctx) === 0, { memory: memoryCod(ctx) });
        ok('server ៖ ចំណូលមិនប្រែ (' + serverCod(ctx) + ')', serverCod(ctx) === 0, { server: serverCod(ctx) });
        ok('តម្លៃ barcode នៅ server មិនប្រែ ($' + serverBarcodeCod(ctx) + ')', serverBarcodeCod(ctx) === 10);
        // ⛔ អះអាង **សាលក្រម** មិនមែន *ពាក្យ* ៖ សារបរាជ័យផ្ទុកពាក្យ «ជោគជ័យ»
        // ខាងក្នុង «មិនបានជោគជ័យ» ➜ ការស្កេនពាក្យទទេជាការធ្លាក់ក្លែងក្លាយ។
        ok('អ្នកប្រើទទួលសារប្រាប់ថាមិនជោគជ័យ',
            /មិនបានជោគជ័យ|មិនត្រូវបានកែ|លែងមាន/.test(toastText(ctx)), toastText(ctx));
        ok('⛔ មិនអះអាងថាជោគជ័យ', toastText(ctx).indexOf('បានកែប្រែទឹកប្រាក់តាមកញ្ចប់ជោគជ័យ') === -1, toastText(ctx));
    }

    // ═══ ២. ⛔ ទិសផ្ទុយ ៖ commit ធម្មតា ═══════════════════════════════
    console.log('\n=== ២. ទិសផ្ទុយ ៖ commit ធម្មតា ➜ លុយប្រែ ១ ដងគត់ ===');
    {
        const ctx = setup('commit');
        ctx.saveEditedBarcodePrice();
        await settle(); await settle();
        ok('សតិ ៖ ចំណូល +$15', memoryCod(ctx) === 15, { memory: memoryCod(ctx) });
        ok('server ៖ ចំណូល +$15', serverCod(ctx) === 15, { server: serverCod(ctx) });
        ok('តម្លៃ barcode នៅ server ក្លាយជា $25', serverBarcodeCod(ctx) === 25, { cod: serverBarcodeCod(ctx) });
        ok('Toast ជោគជ័យ', toastText(ctx).indexOf('ជោគជ័យ') !== -1, toastText(ctx));
    }

    // ═══ ៣. កញ្ចប់រលាយ (commit តែគ្មានការផ្លាស់ប្តូរ) ═════════════════
    console.log('\n=== ៣. កញ្ចប់រលាយពី server ➜ លុយត្រឡប់ដើម ===');
    {
        const ctx = setup('commit');
        delete ctx.__serverHistory.id_1;
        ctx.saveEditedBarcodePrice();
        await settle(); await settle();
        ok('សតិ ៖ ចំណូលមិនប្រែ', memoryCod(ctx) === 0, { memory: memoryCod(ctx) });
        ok('server ៖ ចំណូលមិនប្រែ', serverCod(ctx) === 0, { server: serverCod(ctx) });
        ok('⛔ កញ្ចប់មិនរស់ឡើងវិញ', !ctx.__serverHistory.id_1);
        ok('Toast ប្រាប់ថាកញ្ចប់លែងមាន', toastText(ctx).indexOf('លែងមាន') !== -1, toastText(ctx));
    }

    // ═══ ៤. បដិសេធ (permission_denied) ═══════════════════════════════
    console.log('\n=== ៤. server បដិសេធ ➜ លុយត្រឡប់ដើម ===');
    {
        const ctx = setup('reject');
        ctx.saveEditedBarcodePrice();
        await settle(); await settle();
        ok('សតិ ៖ ចំណូលមិនប្រែ', memoryCod(ctx) === 0, { memory: memoryCod(ctx) });
        ok('server ៖ ចំណូលមិនប្រែ', serverCod(ctx) === 0, { server: serverCod(ctx) });
        ok('តម្លៃក្នុងសតិត្រឡប់ទៅ $10', ctx.scanHistory[0].barcodes[0].cod === 10,
            { cod: ctx.scanHistory[0].barcodes[0].cod });
        ok('Toast ប្រាប់ថាបរាជ័យ', /មិនបានជោគជ័យ/.test(toastText(ctx)), toastText(ctx));
    }

    // ═══ ៥. ⛔ ការព្យួរ ≠ ការបរាជ័យ ═══════════════════════════════════
    console.log('\n=== ៥. បណ្តាញព្យួរ ➜ លុយមិនត្រូវបញ្ច្រាស · commit យឺតបញ្ចប់ការងារ ===');
    {
        const ctx = setup('stall');
        ctx.saveEditedBarcodePrice();
        await settle(); await settle(); await settle();
        ok('ខណៈព្យួរ ៖ លុយមិនត្រូវបញ្ច្រាស (សតិ $' + memoryCod(ctx) + ')',
            memoryCod(ctx) === 15, { memory: memoryCod(ctx) });
        // ⛔ អះអាង **ការអះអាងថាការផ្លាស់ប្តូរត្រូវបានដកវិញ** មិនមែនវត្តមាន
        // ពាក្យ «ត្រឡប់មកវិញ» (សារព្យួរនិយាយអំពី *បណ្តាញ* ត្រឡប់មកវិញ)។
        ok('⛔ ខណៈព្យួរ ៖ មិនអះអាងថាទិន្នន័យត្រូវបានត្រឡប់មកវិញ',
            toastText(ctx).indexOf('ទិន្នន័យត្រូវបានត្រឡប់មកវិញ') === -1, toastText(ctx));
        ok('អ្នកប្រើត្រូវបានប្រាប់ថាបណ្តាញឆ្លើយមិនចេញ',
            /ឆ្លើយមិនចេញ|រង់ចាំ|កំពុង/.test(toastText(ctx)), toastText(ctx));
        ctx.__pending.forEach((release) => release());
        await settle(); await settle();
        ok('commit យឺត ➜ តម្លៃចុះពិត ($' + serverBarcodeCod(ctx) + ')', serverBarcodeCod(ctx) === 25,
            { cod: serverBarcodeCod(ctx) });
        ok('commit យឺត ៖ លុយនៅ +$15 ១ ដងគត់', memoryCod(ctx) === 15 && serverCod(ctx) === 15,
            { memory: memoryCod(ctx), server: serverCod(ctx) });
    }

    console.log('\n' + (fail ? '❌ ធ្លាក់ ' + fail : '✅ គ្មានបញ្ហា') + ' — ok ' + pass);
    process.exit(fail ? 1 : 0);
})().catch((e) => {
    console.log('  FAIL   តេស្តគាំង ➜ ' + (e && e.stack ? e.stack : e));
    process.exit(1);
});
