// ⛔ ថ្នាក់កំហុស៖ **សោការងារ (in-flight lock) ដែលឈរខាងក្រោយការសរសេរធុងសំរាម
// ដែល *ព្យួរ* — ជាប់អស់កល្ប។**
//
// នេះជា **មេរៀន 2.23.1 / `write-stall-guard-test.js` ដែលវិលមកតាមទ្វារទី ៣**។
// ឯកសារនោះវាស់សោ `deletedCleanupInFlight` (`runAutomaticDeletedCleanup`) និង
// `staleRestoreMarkerSweeps` (`clearStaleRestoreMarkers`) — ទាំង ២ ឆ្លងកាត់
// `dbOp()` ➜ សោដោះតាមពិដាន។ តែសោ **២ ផ្សេងទៀត** ឈរខាងក្រោយ
// `await notifyIfSlow(retryAsync(() => saveSingleDeletedItemToFirebase(…)))`
// ដែល **គ្មានពិដានដោយចេតនា** (ច្បាប់ «⛔ កុំដាក់ `dbOp()` លើការសរសេរធុងសំរាម»
// — `catch` របស់វាបញ្ច្រាសលុយ ➜ ការសរសេរដែលចូជួរចុះក្រោយមកនឹងធ្វើឲ្យធាតុនៅ
// ទាំង ២ កន្លែង)។ ដូច្នេះ **ការសរសេរត្រូវនៅគ្មានពិដានដដែល តែសោមិនត្រូវជាប់**។
//
// **វាស់បានលើ tree មុនកែ (stub `fb.update` ដែលព្យួរ · transaction ចុះលឿន —
// ជាលំដាប់ពិត ៖ បណ្តាញដាច់ *ក្រោយ* transaction commit)**៖
//   · `claimAndCleanupItem()` ➜ `cleanupInFlight` ជាប់ id **អស់កល្ប** ➜
//     ⛔ ច្បាប់ **២ ម៉ោង** និង **៧ ថ្ងៃ** លែងអនុវត្តលើកញ្ចប់នោះទាល់តែសោះ ➜
//     កញ្ចប់ដែលផុតកំណត់ **មិនចូលធុងសំរាម** ➜ **លុយមិនត្រូវដក** ➜ ចំណូលប៉ោង
//     (តំបន់លុយពិត — `revenue-fuzz` មើលមិនឃើញ ព្រោះវាមិនចាក់របៀបព្យួរ)
//   · `confirmScannedRemoval()` ➜ `scanRemoveInFlight` ជាប់ **អស់កល្ប** ➜
//     ⛔ **របៀបស្កេនដកងាប់ទាំងស្រុង** ៖ រាល់ការស្កេនបន្ទាប់ត្រូវបដិសេធដោយ
//     «⏳ ការដក (…) កំពុងដំណើរការ — សូមកុំស្កេនស្ទួន។» រហូតដល់ reload
//
// ច្បាប់ដែលឯកសារនេះចាក់សោ៖
//   ១. សោទាំង ២ ត្រូវ **ដោះក្នុងពេលកំណត់** ទោះការសរសេរធុងសំរាមព្យួរ។
//   ២. ⛔ ការដោះសោ **មិនត្រូវបោះបង់ការងារ** — ការសរសេរដែលចុះយឺតត្រូវបញ្ចប់
//      ការងារក្រោយ commit (ធាតុនៅក្នុងធុងសំរាម · លុយត្រូវបានដក)។
//   ៣. ⛔ ការសរសេរនៅតែ **គ្មាន `dbOp()`** ដដែល (បើដាក់ ➜ `catch` បញ្ច្រាសលុយ
//      ➜ ធាតុនៅទាំង ២ កន្លែងពេលការសរសេរចុះយឺត)។
//   ៤. ⛔ **ទិសផ្ទុយត្រូវរក្សា** ៖ បណ្តាញធម្មតា ➜ សោដោះដដែល · ការងារពេញលេញ ·
//      គ្មានការព្យាយាមស្ទួន។
//   ៥. ក្រោយសោដោះ ជុំបន្ទាប់ត្រូវ **ព្យាយាមម្តងទៀតបាន** (ការសម្អាតមិនងាប់)។
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = process.env.STALLLOCK_APP_DIR
    ? path.resolve(process.env.STALLLOCK_APP_DIR)
    : path.resolve(__dirname, '..');
const APP = path.join(ROOT, 'ZoeW', 'app.js');

let pass = 0, fail = 0;
function ok(label, cond, detail) {
    if (cond) { console.log('   ok    ' + label); pass++; }
    else { console.log('  FAIL   ' + label + (detail !== undefined ? '  got: ' + JSON.stringify(detail) : '')); fail++; }
}

function sliceBalanced(src, from) {
    let depth = 0;
    for (let i = from; i < src.length; i++) {
        if (src[i] === '{') depth++;
        else if (src[i] === '}') { depth--; if (!depth) return src.slice(from, i + 1); }
    }
    return null;
}
function extractFn(src, name) {
    const re = new RegExp('\\n(\\s*)(async\\s+)?function ' + name + '\\s*\\(');
    const m = re.exec(src);
    if (!m) return null;
    const head = src.indexOf('function ' + name, m.index);
    const brace = src.indexOf('{', src.indexOf('(', head));
    const body = sliceBalanced(src, brace);
    if (!body) return null;
    return (m[2] ? 'async ' : '') + src.slice(head, brace) + body;
}
function extractConst(src, name) {
    const re = new RegExp('\\n\\s*const ' + name + ' = ([^;]+);');
    const m = re.exec(src);
    return m ? 'const ' + name + ' = ' + m[1] + ';' : null;
}

const src = fs.existsSync(APP) ? fs.readFileSync(APP, 'utf8').replace(/\r\n?/g, '\n') : '';

// ── ១. ជាន់អប្បបរមា ៖ ថតទទេ / ការស្រង់ដែលធ្លាក់ មិនត្រូវបៃតង ────────────────
console.log('== ១. ជាន់អប្បបរមា ==');
ok('អាន ZoeW/app.js បាន (>= ១០០ KB)', src.length > 100000, src.length);

const NEEDED = ['claimAndCleanupItem', 'confirmScannedRemoval', 'removeSingleBarcode',
    'saveSingleDeletedItemToFirebase', 'withTimeout', 'dbOp', 'dbOpStalled',
    'armLateCommit', 'notifyIfSlow', 'retryAsync', 'clearScannedRemovalInFlight'];
const missing = NEEDED.filter((n) => !extractFn(src, n));
ok('រកឃើញ function ដែលត្រូវវាស់ ' + NEEDED.length, missing.length === 0, { missing: missing });

const NEEDED_CONSTS = ['DB_OP_TIMEOUT_MS', 'LOCK_STALL_RELEASE_MS', 'TRASH_WRITE_SLOW_NOTICE_MS', 'ABANDON_AGE_MS', 'TWO_HOURS_MS'];
const cmissing = NEEDED_CONSTS.filter((n) => !extractConst(src, n));
ok('រកឃើញថេរដែលត្រូវវាស់ ' + NEEDED_CONSTS.length, cmissing.length === 0, { missing: cmissing });

// ⛔ កុំបញ្ឈប់ checker ពេលរកឈ្មោះមិនឃើញ — stub ជំនួស ដើម្បីឲ្យការអះអាង
// ឥរិយាបថខាងក្រោមនៅតែរត់ (មេរៀន `checker-coverage.js` ផ្នែក ៣)។
const STUBS = {
    notifyIfSlow: 'function notifyIfSlow(p) { return p; }',
    armLateCommit: 'function armLateCommit() { return false; }'
};
function fnSource(name) { return extractFn(src, name) || STUBS[name] || ('function ' + name + '() {}'); }
function constSource(name) { return extractConst(src, name) || ('const ' + name + ' = 0;'); }

// ⛔ ការវាស់ត្រូវធៀបនឹង **ពិដានពិត** មិនមែនលេខថេរ ៖ សោត្រូវដោះក្នុងរង្វង់
// ជុំវិញ `DB_OP_TIMEOUT_MS` ដែលអានចេញពីកូដពិត។
const DB_TIMEOUT = Number((extractConst(src, 'DB_OP_TIMEOUT_MS') || '= 15000').replace(/\D+/g, '')) || 15000;
// នាឡិកាមាត្រដ្ឋាន ៖ `setTimeout` ក្នុង sandbox ត្រូវបែងចែកដោយ `TIME_SCALE`
// ➜ ពិដាន ១៥ វិ. ក្លាយជា ៣០០ ms ➜ checker លឿន ៥០ ដង **ខណៈកូដពិតមិនប្រែ**
// (លំនាំដដែលនឹង `late-commit-test.js`)។ ⛔ រាល់ការពន្យារត្រូវ scale **ដូចគ្នា**
// បើមិនដូច្នេះសមាមាត្ររវាងពិដានឃ្លាតគ្នា ➜ ការវាស់ក្លាយជាការសំណាង។
const TIME_SCALE = 50;
const scaled = (ms) => Math.max(1, Math.round(ms / TIME_SCALE));
const WAIT_AFTER_TIMEOUT = scaled(DB_TIMEOUT + 3000);
const SETTLE_MS = 60;

// ── ២. Sandbox ដែលរត់កូដ ship ពិត ─────────────────────────────────────────
function buildWorld(mode) {
    const log = { updates: 0, txs: 0, toasts: [], captures: [] };
    const recorder = { capture: (e, d) => log.captures.push({ message: String(e && e.message || e), details: d }) };
    const ctx = {
        console: { log: () => {}, error: () => {}, warn: () => {} },
        Promise, JSON, Object, Array, Number, String, Boolean, Math, Set, Map, Date,
        setTimeout: (fn, ms, ...a) => setTimeout(fn, scaled(ms || 0), ...a),
        clearTimeout, isNaN, parseFloat, parseInt, isFinite,
        navigator: { onLine: true },
        ZoeErrors: recorder,
        window: { ZoeErrors: recorder },
        __log: log
    };
    ctx.authGeneration = 0;
    vm.createContext(ctx);

    const preamble = `
let db = {}, fb = null;
let dbRefDeleted = { p: 'del' }, dbRefHistory = { p: 'hist' };
let dbRefDailyRevenue = { p: 'rev' }, dbRefMonthlyRevenue = { p: 'mrev' };
let scanHistory = [], deletedItems = [];
let dailyRevenueData = {}, monthlyRevenueData = {};
let scanRemoveInFlight = null, pendingScannedRemoval = null;
const cleanupInFlight = new Set();
let __ledgerCod = 0, __ledgerCount = 0;
function getServerNow() { return Date.now(); }
function elapsedSince(m) { if (!m) return Infinity; const d = Date.now() - m; return d < 0 ? Infinity : d; }
function showToast(m) { __log.toasts.push(String(m)); }
function refreshCurrentHistoryView() {}
function updateRecentPhonesList() {}
function generateUniqueId() { return 'gen' + (Math.random() * 1e9 | 0); }
function getFormattedDate() { return '2026-09-08'; }
function parseTimestampFromId() { return 0; }
function normalizeBarcodesOf(i) { if (i && !Array.isArray(i.barcodes)) i.barcodes = []; return i; }
function normalizeBarcodeCloseStamps() { return false; }
function stripHistoryOnlyMarkers(x) { return x; }
function itemHasRestoreMarkers() { return false; }
function ensureBarcodeArrayForItem(i) { if (i && !Array.isArray(i.barcodes)) i.barcodes = []; return i; }
function barcodeAbandonIsRipe(b, p, n) { return !b.isClosed && (n - p) > ABANDON_AGE_MS; }
function barcodeCloseIsRipe(b, n) { return !!(b && b.isClosed && typeof b.closedAt === 'number' && (n - b.closedAt) > TWO_HOURS_MS); }
function recalcItemMoneyFromBarcodes(t) {
    t.cod = Math.round(t.barcodes.reduce((s, b) => s + (parseFloat(b.cod) || 0), 0) * 100) / 100;
    t.dod = Math.round(t.barcodes.reduce((s, b) => s + (parseFloat(b.dod) || 0), 0) * 100) / 100;
    t.price = Math.round((t.cod + t.dod) * 100) / 100;
}
function addRevenueToDailyAndMonthlyRecord(d, cod, dod, count) {
    __ledgerCod = Math.round((__ledgerCod + (parseFloat(cod) || 0)) * 100) / 100;
    __ledgerCount += (parseFloat(count) || 0);
    return { scanDate: d, daily: { cod: cod, dod: dod, count: count }, monthly: { cod: cod, dod: dod, count: count },
        dailyServer: Promise.resolve({ cod: cod, dod: dod, count: count }),
        monthlyServer: Promise.resolve({ cod: cod, dod: dod, count: count }) };
}
function revertRevenueLedgerDelta(a) {
    if (!a) return null;
    __ledgerCod = Math.round((__ledgerCod - (parseFloat(a.daily.cod) || 0)) * 100) / 100;
    __ledgerCount -= (parseFloat(a.daily.count) || 0);
    return a;
}
function correctRevenueLedgerToActual() { return Promise.resolve({ ok: true }); }
function restoreClaimedItemToScanHistory() { return Promise.resolve({ snapshot: { val: () => null } }); }
function viewListModalShowing() { return false; }
function closeModal() {}
function openViewListModal() {}
function refreshRemoveScanBanner() {}
function safeFocusScanner() {}
function confirm() { return true; }
`;
    const FNS = ['withTimeout', 'dbOp', 'dbOpStalled', 'armLateCommit', 'armLateWrite', 'notifyIfSlow',
        'retryAsync', 'settleLockWithin', 'clearScannedRemovalInFlight',
        'saveSingleDeletedItemToFirebase', 'cleanupTrashCodes', 'cleanupLedgerDeducted', 'markCleanupTrashDeducted', 'cleanupBarcodesBackInHistory', 'applyCleanupRevenue', 'settleCleanupDeduction', 'claimAndCleanupItem', 'removeSingleBarcode',
        'confirmScannedRemoval'];
    const code = preamble
        + NEEDED_CONSTS.map(constSource).join('\n') + '\n'
        + FNS.map(fnSource).join('\n')
        + `
globalThis.__setFb = (i) => { fb = i; };
globalThis.__cleanupLock = () => Array.from(cleanupInFlight);
globalThis.__removeLock = () => !!scanRemoveInFlight;
globalThis.__seedHistory = (h) => { scanHistory = h; };
globalThis.__setPending = (p) => { pendingScannedRemoval = p; };
globalThis.__trash = () => deletedItems.map((i) => i.id);
globalThis.__ledger = () => ({ cod: __ledgerCod, count: __ledgerCount });
globalThis.__claim = claimAndCleanupItem;
globalThis.__confirmRemove = confirmScannedRemoval;
`;
    vm.runInContext(code, ctx);

    let CURRENT = null;
    const later = [];
    ctx.__setFb({
        ref: () => ({}),
        increment: (n) => n,
        // `hang` ➜ ការសរសេរធុងសំរាមមិនដោះ មិនបដិសេធ (RTDB ក្រៅបណ្តាញពិត)
        update: () => {
            log.updates++;
            if (mode === 'hang') return new Promise((resolve) => later.push(resolve));
            return Promise.resolve();
        },
        // ⛔ transaction ចុះ **លឿន** ➜ នេះជាលំដាប់ដែលបង្កើតកំហុស ៖ បណ្តាញ
        // ដាច់ *ក្រោយ* transaction commit មិនមែនមុនទេ។
        runTransaction: (ref, updater) => {
            log.txs++;
            let out;
            try { out = updater(CURRENT ? JSON.parse(JSON.stringify(CURRENT)) : null); } catch (e) { out = undefined; }
            if (out !== undefined) CURRENT = out;
            return Promise.resolve({ committed: true, snapshot: { val: () => out } });
        },
        get: () => Promise.resolve({ exists: () => false, val: () => null })
    });
    return {
        ctx, log,
        setCurrent: (v) => { CURRENT = v ? JSON.parse(JSON.stringify(v)) : null; },
        current: () => CURRENT,
        releaseLateWrites: () => { later.splice(0).forEach((r) => r()); }
    };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    // ── ២. `claimAndCleanupItem` ៖ សោត្រូវដោះ ទោះការសរសេរធុងសំរាមព្យួរ ──────
    console.log('\n== ២. សោសម្អាតស្វ័យប្រវត្តិ (២ ម៉ោង / ៧ ថ្ងៃ) ក្រោមការសរសេរដែលព្យួរ ==');
    {
        const w = buildWorld('hang');
        const old = Date.now() - 30 * 24 * 3600 * 1000;
        w.setCurrent({ id: 'itm1', createdAt: old, scanDate: '2026-09-01',
            barcodes: [{ code: 'BC1', cod: 3.25, dod: 0, isClosed: false }] });
        w.ctx.__claim('itm1', 'abandon');
        await sleep(SETTLE_MS);
        ok('ជាន់អប្បបរមា ៖ transaction បានចេញដំណើរពិត', w.log.txs >= 1, w.log.txs);
        ok('ជាន់អប្បបរមា ៖ ការសរសេរធុងសំរាមបានចេញដំណើរពិត', w.log.updates >= 1, w.log.updates);
        ok('សោត្រូវកាន់ខណៈការសរសេរនៅព្យួរ', w.ctx.__cleanupLock().length === 1, w.ctx.__cleanupLock());
        // ⛔ ចាប់ពីកំណែ 2.37.2 ការដកលុយឈរ **ក្រោយ** ការសរសេរធុងសំរាម (journal នៃ
        //    ការសម្អាត) ➜ ខណៈការសរសេរព្យួរ ledger ត្រូវ **មិនទាន់ប្រែ**។ លើ tree
        //    ចាស់ លំដាប់ផ្ទុយ ➜ ការរំពឹងទុកដេរីវេពី **កូដពិត** មិនមែនលេខថេរ។
        const ledgerAfterTrashWrite = src.indexOf('revenuePending') !== -1;
        ok(ledgerAfterTrashWrite
            ? '⛔ ការសរសេរធុងសំរាមព្យួរ ➜ លុយ **មិនទាន់ដក** (ការដកឈរក្រោយការសរសេរ)'
            : 'ជាន់អប្បបរមា ៖ លុយត្រូវបានដកក្នុងសតិរួច',
            w.ctx.__ledger().cod === (ledgerAfterTrashWrite ? 0 : -3.25), w.ctx.__ledger());

        await sleep(WAIT_AFTER_TIMEOUT);
        ok('⛔ សោ `cleanupInFlight` ត្រូវដោះក្នុងពេលកំណត់ (ច្បាប់ ២ម៉ោង/៧ថ្ងៃ មិនងាប់)',
            w.ctx.__cleanupLock().length === 0, w.ctx.__cleanupLock());

        // ជុំបន្ទាប់ត្រូវព្យាយាមម្តងទៀតបាន — ហើយ **មិនត្រូវដកលុយស្ទួន**
        const txBefore = w.log.txs;
        const ledgerBefore = w.ctx.__ledger();
        w.ctx.__claim('itm1', 'abandon');
        await sleep(SETTLE_MS);
        ok('⛔ ជុំបន្ទាប់ត្រូវព្យាយាមម្តងទៀតបាន', w.log.txs > txBefore, { before: txBefore, after: w.log.txs });
        ok('⛔ ការព្យាយាមម្តងទៀត **មិនត្រូវដកលុយស្ទួន** (idempotent)',
            w.ctx.__ledger().cod === ledgerBefore.cod && w.ctx.__ledger().count === ledgerBefore.count,
            { before: ledgerBefore, after: w.ctx.__ledger() });

        // ការសរសេរដែលចុះយឺត ➜ ការងារក្រោយ commit ត្រូវបញ្ចប់ (មិនត្រូវបញ្ច្រាស)
        w.releaseLateWrites();
        await sleep(SETTLE_MS);
        ok('⛔ ការសរសេរដែលចុះយឺត ➜ ធាតុនៅក្នុងធុងសំរាម (មិនត្រូវបញ្ច្រាស)',
            w.ctx.__trash().length >= 1, w.ctx.__trash());
        ok('⛔ ការសរសេរដែលចុះយឺត ➜ លុយនៅតែត្រូវដក (គ្មានការបញ្ច្រាសខុស)',
            w.ctx.__ledger().cod === -3.25, w.ctx.__ledger());
    }

    // ── ៣. `confirmScannedRemoval` ៖ សោស្កេនដកត្រូវដោះ ─────────────────────
    console.log('\n== ៣. សោរបៀបស្កេនដក ក្រោមការសរសេរដែលព្យួរ ==');
    {
        const w = buildWorld('hang');
        const item = { id: 'itm2', scanDate: '2026-09-01',
            barcodes: [{ code: 'BC2', cod: 2, dod: 0, isClosed: false }, { code: 'BC3', cod: 5, dod: 0, isClosed: false }] };
        w.setCurrent(item);
        w.ctx.__seedHistory([JSON.parse(JSON.stringify(item))]);
        w.ctx.__setPending({ itemId: 'itm2', barcodeCode: 'BC2' });
        w.ctx.__confirmRemove();
        await sleep(SETTLE_MS);
        ok('ជាន់អប្បបរមា ៖ ការសរសេរធុងសំរាមបានចេញដំណើរពិត', w.log.updates >= 1, w.log.updates);
        ok('សោត្រូវកាន់ខណៈការសរសេរនៅព្យួរ', w.ctx.__removeLock() === true);
        ok('ជាន់អប្បបរមា ៖ លុយ Barcode ដែលដកត្រូវកាត់ចេញ', w.ctx.__ledger().cod === -2, w.ctx.__ledger());

        await sleep(WAIT_AFTER_TIMEOUT);
        ok('⛔ សោ `scanRemoveInFlight` ត្រូវដោះក្នុងពេលកំណត់ (របៀបស្កេនដកមិនងាប់)',
            w.ctx.__removeLock() === false);

        w.releaseLateWrites();
        await sleep(SETTLE_MS);
        ok('⛔ ការសរសេរដែលចុះយឺត ➜ Barcode ដែលដកនៅក្នុងធុងសំរាម',
            w.ctx.__trash().length === 1, w.ctx.__trash());
        ok('⛔ ការសរសេរដែលចុះយឺត ➜ លុយនៅតែត្រូវដក', w.ctx.__ledger().cod === -2, w.ctx.__ledger());
    }

    // ── ៤. ទិសផ្ទុយ ៖ បណ្តាញធម្មតា ➜ លទ្ធផលដដែលបេះបិទ ─────────────────────
    console.log('\n== ៤. ទិសផ្ទុយ ៖ បណ្តាញធម្មតា ==');
    {
        const w = buildWorld('ok');
        const old = Date.now() - 30 * 24 * 3600 * 1000;
        w.setCurrent({ id: 'itm3', createdAt: old, scanDate: '2026-09-01',
            barcodes: [{ code: 'BC9', cod: 1.5, dod: 0.5, isClosed: false }] });
        w.ctx.__claim('itm3', 'abandon');
        await sleep(SETTLE_MS);
        ok('សោត្រូវដោះក្រោយចប់', w.ctx.__cleanupLock().length === 0, w.ctx.__cleanupLock());
        ok('ធាតុត្រូវចូលធុងសំរាម', w.ctx.__trash().length === 1, w.ctx.__trash());
        ok('លុយត្រូវដកត្រឹមត្រូវ (COD ១.៥)', w.ctx.__ledger().cod === -1.5, w.ctx.__ledger());
        ok('⛔ គ្មានសារបរាជ័យលើបណ្តាញធម្មតា',
            !w.log.toasts.some((t) => /បញ្ហាធ្ងន់ធ្ងរ|មិនបានជោគជ័យ/.test(t)), w.log.toasts);
        ok('⛔ គ្មានការ capture កំហុសលើបណ្តាញធម្មតា', w.log.captures.length === 0, w.log.captures);
    }
    {
        const w = buildWorld('ok');
        const item = { id: 'itm4', scanDate: '2026-09-01',
            barcodes: [{ code: 'BX1', cod: 4, dod: 0, isClosed: false }, { code: 'BX2', cod: 6, dod: 0, isClosed: false }] };
        w.setCurrent(item);
        w.ctx.__seedHistory([JSON.parse(JSON.stringify(item))]);
        w.ctx.__setPending({ itemId: 'itm4', barcodeCode: 'BX1' });
        await w.ctx.__confirmRemove();
        await sleep(SETTLE_MS);
        ok('ស្កេនដក ៖ សោត្រូវដោះក្រោយចប់', w.ctx.__removeLock() === false);
        ok('ស្កេនដក ៖ ធាតុត្រូវចូលធុងសំរាម', w.ctx.__trash().length === 1, w.ctx.__trash());
        ok('ស្កេនដក ៖ លុយត្រូវដកត្រឹមតែ Barcode នោះ', w.ctx.__ledger().cod === -4, w.ctx.__ledger());
    }

    // ── ៥. ច្បាប់រចនាសម្ព័ន្ធ ៖ ការសរសេរធុងសំរាមត្រូវនៅគ្មាន `dbOp()` ──────────
    console.log('\n== ៥. ការសរសេរធុងសំរាមត្រូវនៅគ្មានពិដាន (ច្បាប់បញ្ច្រាសលុយ) ==');
    {
        const bodies = ['claimAndCleanupItem', 'removeSingleBarcode']
            .map((n) => ({ name: n, body: extractFn(src, n) || '' }));
        bodies.forEach(({ name, body }) => {
            ok(name + ' ៖ ⛔ គ្មាន `dbOp(` លើការសរសេរធុងសំរាម',
                !/dbOp\(\s*(?:retryAsync|notifyIfSlow|saveSingleDeletedItemToFirebase)/.test(body));
            ok(name + ' ៖ ជាន់អប្បបរមា — ការសរសេរធុងសំរាមមានពិត',
                /saveSingleDeletedItemToFirebase\s*\(/.test(body), body.length);
        });
    }

    console.log('\n' + pass + ' ok, ' + fail + ' FAIL');
    process.exit(fail ? 1 : 0);
})();
