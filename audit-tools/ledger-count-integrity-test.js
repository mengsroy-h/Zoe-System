// ⛔ ថ្នាក់កំហុស ៖ **ការសរសេរ ledger ដកលុយ តែភ្លេចដកចំនួនកញ្ចប់** (ឬបញ្ច្រាស)។
//
// 🔴 សំណួររបស់ម្ចាស់គម្រោង (2026-09-17) ៖ *«កញ្ចប់ចូលធុងសំរាមជាផុតកំណត់មែន
// ហើយ ចឹងមានន័យថាការដកដោយស្វ័យប្រវត្តិមិនដកចំនួនកញ្ចប់ ដកតែទឹកប្រាក់»*។
//
// លេខ «ស្កេនតាមថ្ងៃ» លើអេក្រង់ = `zoew_daily_revenue_cod_dod/<ថ្ងៃ>/totalCount`
// — វារស់នៅ **កំណត់ត្រាដដែល** នឹង `codDollar`/`dodDollar` ➜ ការដកលុយ និង
// ការដកចំនួន ជា **ការសរសេរតែមួយ**។ បើថ្ងៃណាមួយក្នុងចំណោមទាំង ៣ ធ្លាក់ចេញ
// លេខលើអេក្រង់ និងលុយ **ឈប់ស៊ីគ្នាជាអចិន្ត្រៃយ៍**។
//
// ⛔ អ្នកយាមដែលមានស្រាប់មើលមិនឃើញថ្នាក់នេះ ៖ `db-stall-guard-test` រត់
// `claimAndCleanupItem('abandon')` ពិត តែវា **stub `addRevenueToDailyAndMonthly
// Record` ចោល** ➜ វាវាស់ត្រឹម «ការហៅកើតឡើង» មិនមែន «អ្វីដែលចុះលើ server»។
// នេះជាច្បាប់ «⛔ ការ stub ស្នាមភ្ជាប់ដែលអ្នកកំពុងវាស់ = ការវាស់អ្វីផ្សេង»។
//
// ⛔ ដូច្នេះឯកសារនេះរត់ **ខ្សែសង្វាក់ ledger ពិតទាំងមូល** ៖
// `claimAndCleanupItem` ➜ `addRevenueToDailyAndMonthlyRecord` ➜
// `applyLedgerBucketDelta` ➜ `commitDailyRevenueDelta` ➜ `ledgerDeltaWithClamp`
// ➜ transaction ➜ រួចអាន **តម្លៃដែលចុះលើ server ពិត**។
'use strict';

process.exitCode = 1;

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = process.env.LEDGERCOUNT_APP_DIR ? path.resolve(process.env.LEDGERCOUNT_APP_DIR) : path.resolve(__dirname, '..');
const FILE = path.join(ROOT, 'ZoeW/app.js');

let pass = 0, fail = 0;
function ok(label, cond, detail) {
    if (cond) { pass++; console.log('  ✅ ' + label); return; }
    fail++;
    console.log('  ❌ ' + label + (detail !== undefined ? ' — ' + JSON.stringify(detail) : ''));
}

if (!fs.existsSync(FILE)) {
    console.log('  ❌ រកមិនឃើញ ' + FILE);
    console.log('\n❌ ធ្លាក់ 1 / ok 0');
    process.exitCode = 1;
    return;
}
const SRC = fs.readFileSync(FILE, 'utf8');

function sliceFrom(src, name) {
    let start = src.indexOf('function ' + name + '(');
    if (start === -1) return '';
    if (src.slice(Math.max(0, start - 6), start) === 'async ') start -= 6;
    let depth = 0, i = src.indexOf('{', start), started = false;
    for (; i < src.length; i++) {
        if (src[i] === '{') { depth++; started = true; }
        else if (src[i] === '}') { depth--; if (started && depth === 0) { i++; break; } }
    }
    return src.slice(start, i);
}
function sliceConst(src, name) {
    const m = new RegExp('^\\s*const ' + name + '\\s*=\\s*[^;]+;', 'm').exec(src);
    return m ? m[0].trim() : '';
}

const FNS = ['appZoneParts', 'getZoneDateKey', 'getFormattedDate', 'elapsedSince', 'withTimeout', 'dbOp', 'dbOpStalled',
    'barcodeEntriesOf', 'normalizeBarcodesOf', 'applyBarcodeCloseState', 'barcodeCloseIsRipe', 'barcodeAbandonIsRipe', 'barcodeAbandonBasis', 'itemAbandonRipeAt',
    'normalizeBarcodeCloseStamps', 'itemHasRestoreMarkers', 'stripHistoryOnlyMarkers', 'parseTimestampFromId',
    'generateUniqueId', 'retryAsync', 'cloneRestoreItem', 'saveSingleDeletedItemToFirebase', 'isActiveRestoreClaim',
    'recalcItemMoneyFromBarcodes', 'armLateCommit', 'notifyIfSlow', 'settleLockWithin',
    'ledgerNumber', 'ledgerZeroDelta', 'ledgerRejectionVerdict', 'ledgerMarkUnknown', 'ledgerServerVerdict', 'alignMonthlyLedgerToDaily', 'correctRevenueLedgerToActual',
    'ledgerDeltaWithClamp', 'ledgerAppliedDelta', 'revertLedgerRecordInMemory', 'ledgerMemoryCompensationClaimed',
    'applyLedgerBucketDelta', 'runLedgerTransaction', 'ledgerDedOf', 'ledgerDedValue', 'ledgerCarryDed', 'commitDailyRevenueDelta', 'commitMonthlyRevenueDelta',
    'ledgerOpRingOf', 'ledgerOpRing', 'ledgerOpWitness', 'ledgerTagged', 
    'addRevenueToDailyAndMonthlyRecord', 'revertRevenueLedgerDelta', 'cleanupClockIsTrustworthy',
    'cleanupTrashCodes', 'cleanupLedgerDeducted', 'markCleanupTrashDeducted', 'cleanupBarcodesBackInHistory', 'applyCleanupRevenue', 'settleCleanupDeduction', 'ledgerEventToken', 'ledgerRecordTokens', 'ledgerTokenSeen', 'ledgerPriorSeen', 'ledgerTotalsOf', 'ledgerLatestMonths', 'ledgerMirrorStep', 'ledgerEventDecision', 'commitLedgerEventStep', 'cleanupScanDateOf', 'cleanupEventAt', 'cleanupEventAmounts', 'cleanupLedgerPrior', 'deductCleanupLedgerKeyed', 'deductCleanupRevenue', 'patchCleanupJournalEntry', 'noteCleanupLedgerTry', 'undoCleanupLedgerKeyed', 'undoCleanupRevenue', 'cleanupLedgerResult', 'resolveCleanupSlot', 'claimCleanupTrashSlot', 'ensureBarcodeArrayForItem', 'claimAndCleanupItem'];
// ⛔ journal នៃការសម្អាត (2.37.2) ៖ លើ tree មុនកែវាអវត្តមាន ➜ stub ដើម្បីឲ្យ
//    ការអះអាងឥរិយាបថនៅតែរត់ (មេរៀន 2.19.3 ៖ កុំបញ្ឈប់ checker)។
const OPTIONAL_FNS = {
    cleanupPartialTrashId: 'function cleanupPartialTrashId() { return generateUniqueId(); }',
    trashSlotSharesClaim: 'function trashSlotSharesClaim() { return true; }',
    safeStoreGet: 'function safeStoreGet(store, key) { try { return store ? store.getItem(key) : null; } catch (e) { return null; } }',
    safeStoreSet: 'function safeStoreSet(store, key, value) { try { return store ? (store.setItem(key, String(value)), true) : false; } catch (e) { return false; } }',
    safeStoreRemove: 'function safeStoreRemove(store, key) { try { return store ? (store.removeItem(key), true) : false; } catch (e) { return false; } }',
    cleanupJournalScope: "function cleanupJournalScope() { return ''; }",
    cleanupJournalScopeMismatch: 'function cleanupJournalScopeMismatch() { return false; }',
    readCleanupJournal: 'function readCleanupJournal() { return []; }',
    writeCleanupJournal: 'function writeCleanupJournal() {}',
    noteCleanupJournalEntry: 'function noteCleanupJournalEntry() {}',
    markCleanupJournalStage: 'function markCleanupJournalStage() {}',
    clearCleanupJournalEntry: 'function clearCleanupJournalEntry() {}'
};
const CONSTS = ['APP_TIME_ZONE', 'APP_TIME_ZONE_OFFSET_MINUTES', 'DB_OP_TIMEOUT_MS', 'TWO_HOURS_MS', 'LEDGER_OP_RING_MAX',
    'ABANDON_AGE_MS', 'TRASH_WRITE_SLOW_NOTICE_MS', 'LOCK_STALL_RELEASE_MS',
    'CLEANUP_JOURNAL_KEY', 'CLEANUP_JOURNAL_MAX', 'CLEANUP_STAGE_MOVED', 'CLEANUP_STAGE_LEDGER', 'CLEANUP_STAGE_FLIP', 'CLEANUP_STAGE_SLOT', 'CLEANUP_STAGE_UNDO', 'CLEANUP_LEDGER_KEYED', 'CLEANUP_LEDGER_LEGACY', 'CLEANUP_LEDGER_RETRY_MAX', 'CLEANUP_NO_PRIOR'];

const NOW = Date.UTC(2026, 8, 17, 6, 0, 0);
const DAY = '2026-09-10';
const MONTH = '2026-09';

// ⛔ ស្ថានភាពចាប់ផ្តើមត្រូវឆ្លុះបញ្ចាំងករណីពិត ៖ ថ្ងៃដែលមានកញ្ចប់ច្រើន
//    រួចកញ្ចប់មួយ (ឬច្រើន) ផុតកំណត់។
function runCleanup(reason, barcodes, opts) {
    opts = opts || {};
    const startCod = 236.24, startCount = 54;
    const store = { ['zoew_daily_revenue_cod_dod/' + DAY]: { codDollar: startCod, dodDollar: 3, totalCount: startCount } };
    const monthStore = { [MONTH]: { codDollar: startCod, dodDollar: 3, totalCount: startCount } };
    const timers = [];
    const fb = {
        ref: (_d, p) => ({ path: p || 'zoew_monthly_revenue_cod_dod' }),
        runTransaction: (ref, fn) => {
            const p = ref.path;
            const isMonthly = p === 'zoew_monthly_revenue_cod_dod';
            const cur = isMonthly ? JSON.parse(JSON.stringify(monthStore)) : (store[p] ? JSON.parse(JSON.stringify(store[p])) : null);
            const out = fn(cur);
            if (out === undefined) return Promise.resolve({ committed: false, snapshot: { val: () => cur } });
            if (isMonthly) { Object.keys(monthStore).forEach((k) => delete monthStore[k]); Object.assign(monthStore, out); }
            else store[p] = out;
            return Promise.resolve({ committed: true, snapshot: { val: () => out } });
        },
        update: () => Promise.resolve(),
        get: () => Promise.resolve({ exists: () => false, val: () => null })
    };
    const box = {
        console: { log: () => {}, error: () => {}, warn: () => {} },
        Date, JSON, Math, Object, Set, Map, Array, String, Number, Boolean,
        parseFloat, parseInt, isNaN, isFinite, Promise, RegExp, Intl, Error,
        setTimeout: (fn, ms) => { const id = setTimeout(fn, Math.min(ms || 0, 25)); timers.push(id); return id; },
        clearTimeout: (id) => clearTimeout(id),
        window: {}, ZoeErrors: null,
        db: {}, fb,
        dbRefDeleted: { path: 'zoew_recently_deleted_cod_dod' },
        dbRefHistory: { path: 'zoew_scan_history_cod_dod' },
        dbRefDailyRevenue: { path: 'zoew_daily_revenue_cod_dod' },
        dbRefMonthlyRevenue: { path: 'zoew_monthly_revenue_cod_dod' },
        getServerNow: () => NOW,
        showToast: () => {},
        refreshCurrentHistoryView: () => {},
        releaseBarcodesInRegistry: () => Promise.resolve(),
        scanHistory: [], deletedItems: [],
        dailyRevenueData: { [DAY]: { codDollar: startCod, dodDollar: 3, totalCount: startCount } },
        monthlyRevenueData: { [MONTH]: { codDollar: startCod, dodDollar: 3, totalCount: startCount } }
    };
    box.authGeneration = 0;
    const ctx = vm.createContext(box);
    const parts = CONSTS.map((c) => sliceConst(SRC, c)).filter(Boolean);
    parts.push('let serverClockTrusted = true, isDatabaseConnected = true;');
    parts.push('const cleanupInFlight = new Set();', 'const activeRestoreClaims = new Map();');
    parts.push('const appLocalStore = (function () { const d = {}; return { getItem: (k) => (Object.prototype.hasOwnProperty.call(d, k) ? d[k] : null), setItem: (k, v) => { d[k] = String(v); }, removeItem: (k) => { delete d[k]; } }; })();');
    Object.keys(OPTIONAL_FNS).forEach((fn) => {
        const body = sliceFrom(SRC, fn);
        parts.push(body || OPTIONAL_FNS[fn]);
    });
    const missing = [];
    FNS.forEach((fn) => {
        const body = sliceFrom(SRC, fn);
        if (!body) { missing.push(fn); return; }
        parts.push(body);
    });
    vm.runInContext(parts.join('\n\n'), ctx);

    const item = {
        id: 'id_probe', phone: '0760007142', scanDate: DAY,
        isClosed: barcodes.every((b) => b.isClosed),
        createdAt: NOW - (opts.ageDays || 9) * 24 * 3600 * 1000,
        barcodes: barcodes.map((b) => Object.assign({ isDeducted: false, isFromDeletion: false }, b))
    };
    store['zoew_scan_history_cod_dod/id_probe'] = JSON.parse(JSON.stringify(item));
    box.scanHistory.push(JSON.parse(JSON.stringify(item)));

    vm.runInContext("claimAndCleanupItem('id_probe', '" + reason + "');", ctx);
    return new Promise((resolve) => {
        setTimeout(() => {
            timers.forEach(clearTimeout);
            resolve({
                missing: missing,
                start: { cod: startCod, count: startCount },
                server: store['zoew_daily_revenue_cod_dod/' + DAY],
                memory: box.dailyRevenueData[DAY],
                monthly: monthStore[MONTH],
                trash: box.deletedItems.map((t) => ({ reason: t.trashReason, cod: t.cod, n: (t.barcodes || []).length }))
            });
        }, 800);
    });
}

const r2 = (n) => Math.round(n * 100) / 100;

(async () => {
    console.log('=== ledger-count-integrity — ការដកលុយត្រូវដកចំនួនកញ្ចប់ជាមួយ ===');

    // ── ១. ផុតកំណត់ ៨ ថ្ងៃ ៖ កញ្ចប់តែមួយ ────────────────────────────
    const one = await runCleanup('abandon', [{ code: 'BC1', cod: 2.71, dod: 0, isClosed: false }]);
    one.missing.forEach((n) => ok('ត្រូវមាន `' + n + '()` ក្នុងកូដ ship', false, 'អវត្តមាន'));
    ok('លក្ខខណ្ឌចាំបាច់ ៖ កញ្ចប់ចូលធុងសំរាមជា «ផុតកំណត់»',
        one.trash.length === 1 && one.trash[0].reason === 'expired', one.trash);
    ok('⛔ លុយចុះលើ server ត្រឹមត្រូវ',
        !!one.server && r2(one.server.codDollar) === r2(one.start.cod - 2.71), one.server);
    ok('⛔⛔ **ចំនួនកញ្ចប់ក៏ចុះដែរ** (លេខ «ស្កេនតាមថ្ងៃ»)',
        !!one.server && one.server.totalCount === one.start.count - 1, one.server);
    ok('⛔ សតិ និង server និយាយដូចគ្នា',
        !!one.memory && one.memory.totalCount === one.server.totalCount
        && r2(one.memory.codDollar) === r2(one.server.codDollar), { memory: one.memory, server: one.server });
    ok('⛔ ledger ខែចុះស្របគ្នា',
        !!one.monthly && one.monthly.totalCount === one.start.count - 1
        && r2(one.monthly.codDollar) === r2(one.start.cod - 2.71), one.monthly);

    // ── ២. ផុតកំណត់លើកញ្ចប់ច្រើន ៖ ចំនួនត្រូវចុះតាមចំនួន barcode ពិត ──
    const many = await runCleanup('abandon', [
        { code: 'BC1', cod: 2.71, dod: 0, isClosed: false },
        { code: 'BC2', cod: 6.43, dod: 1, isClosed: false },
        { code: 'BC3', cod: 1.93, dod: 0, isClosed: false }
    ]);
    ok('⛔ កញ្ចប់ ៣ ផុតកំណត់ ➜ ចំនួនចុះ ៣ (មិនមែន ១)',
        !!many.server && many.server.totalCount === many.start.count - 3, many.server);
    ok('⛔ ហើយលុយចុះតាមផលបូកពិត',
        !!many.server && r2(many.server.codDollar) === r2(many.start.cod - (2.71 + 6.43 + 1.93)), many.server);

    // ── ៣. ⛔ ទិសផ្ទុយ ៖ «យករួច» (២ ម៉ោង) **មិនត្រូវប៉ះ** ledger ─────
    // (ជួរ ៧ នៃតារាងសេណារីយ៉ូ ៖ លុយមិនប៉ះ ➜ ចំនួនក៏មិនប៉ះដែរ)
    const closed = await runCleanup('close', [
        { code: 'BC9', cod: 9.99, dod: 0, isClosed: true, closedAt: NOW - 3 * 3600 * 1000 }
    ], { ageDays: 1 });
    ok('លក្ខខណ្ឌចាំបាច់ ៖ កញ្ចប់បិទចូលធុងសំរាមជា «យករួច»',
        closed.trash.length === 1 && closed.trash[0].reason === 'pickup', closed.trash);
    ok('⛔ ទិសផ្ទុយ ៖ «យករួច» មិនប៉ះលុយ',
        !!closed.server && r2(closed.server.codDollar) === r2(closed.start.cod), closed.server);
    ok('⛔ ទិសផ្ទុយ ៖ «យករួច» ក៏មិនប៉ះចំនួនកញ្ចប់ដែរ',
        !!closed.server && closed.server.totalCount === closed.start.count, closed.server);

    // ── ៤. កញ្ចប់លាយ ៖ បិទ ១ + បើក ១ ➜ ដកតែកញ្ចប់ដែលផុតកំណត់ ────────
    const mixed = await runCleanup('abandon', [
        { code: 'BCa', cod: 4.00, dod: 0, isClosed: true, closedAt: NOW - 3 * 3600 * 1000 },
        { code: 'BCb', cod: 5.00, dod: 0, isClosed: false }
    ]);
    ok('⛔ កញ្ចប់លាយ ៖ ដកតែ barcode ដែលមិនទាន់យក (ចំនួន −1)',
        !!mixed.server && mixed.server.totalCount === mixed.start.count - 1, mixed.server);
    ok('⛔ ហើយលុយដកតែតម្លៃរបស់វា',
        !!mixed.server && r2(mixed.server.codDollar) === r2(mixed.start.cod - 5.00), mixed.server);

    console.log('');
    if (fail) { console.log('❌ ធ្លាក់ ' + fail + ' / ok ' + pass); process.exitCode = 1; }
    else if (!pass) { console.log('❌ គ្មានការអះអាងណារត់សោះ'); process.exitCode = 1; }
    else { console.log('✅ ជោគជ័យ ' + pass); process.exitCode = 0; }
})();
