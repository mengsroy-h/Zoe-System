// ⛔ ថ្នាក់កំហុស ៖ **ការរំខានពាក់កណ្តាលនៃការសម្អាតស្វ័យប្រវត្តិ ➜ កញ្ចប់បាត់
// ពីទាំង ២ កន្លែង** (មិននៅក្នុងប្រវត្តិ · មិននៅក្នុងធុងសំរាម)។
//
// 🔴 វាស់បានលើទិន្នន័យពិតរបស់ម្ចាស់គម្រោង (2026-09-17) ៖ របាយការណ៍
// `money-reality-check` រាយ **❌ 3/245 កូនសោ registry កំព្រា** ហើយថ្ងៃ
// 2026-09-10 បង្ហាញ «ស្កេនតាមថ្ងៃ 54» ធៀបនឹង «យករួច 51 · នៅសល់ 0» ➜ បាត់ ៣។
//
// មូលហេតុតាមរចនាសម្ព័ន្ធ ៖ `claimAndCleanupItem()` ធ្វើការសរសេរ **ដាច់ពីគ្នា
// ៣–៤** ៖ (១) transaction ដកចេញពីប្រវត្តិ ➜ (២) ledger ➜ (៣) សរសេរធុងសំរាម។
// RTDB **ចាក់ជួរការសរសេរក្នុងសតិរបស់ tab** ➜ transaction ទី ១ ចុះដល់ server
// រួច តែជួរដែលនៅសល់ **រលាយបាត់ជាមួយ tab** ពេល deploy · PTR · បិទ tab ·
// បណ្តាញដាច់ហើយមិនត្រឡប់មកវិញ ➜ ស្នាមជើងបេះបិទនឹងអ្វីដែលវាស់បាន ៖
// កញ្ចប់បាត់ · ledger មិនត្រូវកែ · កូនសោ registry មិនត្រូវដោះ។
//
// ⛔ គ្មានអ្នកយាមណាឃើញថ្នាក់នេះទេ ព្រោះ checker ទាំងអស់ឲ្យការសរសេរ
// **គ្រប់ជំហានចុះ** ➜ របៀបបរាជ័យ «ជំហានទី ១ ចុះ ជំហានទី ២ មិនចុះ» មិនដែល
// ត្រូវដាក់ចូល (ច្បាប់ «⛔ ស្ថានភាពដែលមិនដែលដាក់ចូល»)។
//
// ⛔ ការវាស់ត្រូវជា **រចនាសម្ព័ន្ធ** មិនមែនសេណារីយ៉ូជ្រើសដោយដៃ ៖ យើងសម្លាប់
// ការសរសេរនៅ **គ្រប់ចំណុច** (០ ➜ N) ហើយអះអាងក្រោយរាល់ការរត់ (ច្បាប់ «fuzz
// ត្រូវអះអាងក្រោយរាល់ប្រតិបត្តិការ»)។ អថេររក្សា ៖
//
//   **កញ្ចប់ត្រូវនៅមានលើ server យ៉ាងហោចណាស់ ១ កន្លែង — ឬត្រូវអាចស្តារវិញបាន។**
'use strict';

process.exitCode = 1;

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = process.env.CLEANUPATOMIC_APP_DIR ? path.resolve(process.env.CLEANUPATOMIC_APP_DIR) : path.resolve(__dirname, '..');
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
    'safeStoreGet', 'safeStoreSet', 'safeStoreRemove',
    'barcodeEntriesOf', 'normalizeBarcodesOf', 'applyBarcodeCloseState', 'barcodeCloseIsRipe', 'barcodeAbandonIsRipe',
    'normalizeBarcodeCloseStamps', 'itemHasRestoreMarkers', 'stripHistoryOnlyMarkers', 'parseTimestampFromId',
    'generateUniqueId', 'retryAsync', 'cloneRestoreItem', 'saveSingleDeletedItemToFirebase', 'isActiveRestoreClaim',
    'recalcItemMoneyFromBarcodes', 'armLateCommit', 'notifyIfSlow', 'settleLockWithin',
    'ledgerNumber', 'ledgerZeroDelta', 'ledgerServerVerdict', 'alignMonthlyLedgerToDaily', 'correctRevenueLedgerToActual',
    'ledgerDeltaWithClamp', 'ledgerAppliedDelta', 'revertLedgerRecordInMemory', 'ledgerMemoryCompensationClaimed',
    'applyLedgerBucketDelta', 'commitDailyRevenueDelta', 'commitMonthlyRevenueDelta',
    'addRevenueToDailyAndMonthlyRecord', 'revertRevenueLedgerDelta', 'restoreClaimedItemToScanHistory',
    'claimAndCleanupItem'];
// ⛔ ឈ្មោះទាំងនេះជា **អ្នកស្តារ** ៖ គ្មានពួកវា ➜ ការរំខានមិនអាចសង្គ្រោះបាន។
//    វាមិនត្រូវបញ្ឈប់ checker ទេ (ច្បាប់ «កុំបញ្ឈប់ពេលរកឈ្មោះមិនឃើញ — stub ជំនួស»)។
const RECOVERY_FNS = ['noteCleanupJournalEntry', 'markCleanupJournalStage', 'clearCleanupJournalEntry',
    'readCleanupJournal', 'writeCleanupJournal', 'cleanupJournalScope', 'cleanupJournalScopeMismatch',
    'resumeInterruptedCleanups'];
const CONSTS = ['APP_TIME_ZONE', 'APP_TIME_ZONE_OFFSET_MINUTES', 'DB_OP_TIMEOUT_MS', 'TWO_HOURS_MS',
    'ABANDON_AGE_MS', 'TRASH_WRITE_SLOW_NOTICE_MS', 'LOCK_STALL_RELEASE_MS',
    'CLEANUP_JOURNAL_KEY', 'CLEANUP_JOURNAL_MAX', 'CLEANUP_STAGE_MOVED', 'CLEANUP_STAGE_LEDGER'];

const NOW = Date.UTC(2026, 8, 17, 6, 0, 0);
const DAY = '2026-09-10';
const MONTH = '2026-09';
const START_COD = 236.24, START_COUNT = 54;
const ITEM_ID = 'id_probe';

const missingCore = [];
const missingRecovery = [];

// ── sandbox មួយក្នុងមួយការរត់ ៖ server ជាវត្ថុដាច់ដោយឡែក ─────────────────
function makeRun(opts) {
    opts = opts || {};
    const dieAfter = typeof opts.dieAfter === 'number' ? opts.dieAfter : Infinity;
    const server = {
        history: { [ITEM_ID]: null },
        trash: {},
        daily: { [DAY]: { codDollar: START_COD, dodDollar: 3, totalCount: START_COUNT } },
        monthly: { [MONTH]: { codDollar: START_COD, dodDollar: 3, totalCount: START_COUNT } }
    };
    const storage = opts.storage || {};
    const timers = [];
    let writes = 0;
    const toasts = [];

    const hung = () => new Promise(() => {});
    const bump = () => { writes++; return writes > dieAfter; };

    const fb = {
        ref: (_d, p) => ({ path: p || 'zoew_monthly_revenue_cod_dod' }),
        increment: (n) => ({ __inc: n }),
        runTransaction: (ref, fn) => {
            if (bump()) return hung();
            const p = ref.path;
            let cur, write;
            if (p === 'zoew_monthly_revenue_cod_dod') {
                cur = JSON.parse(JSON.stringify(server.monthly));
                write = (out) => { server.monthly = out; };
            } else if (p.indexOf('zoew_daily_revenue_cod_dod/') === 0) {
                const k = p.split('/')[1];
                cur = server.daily[k] ? JSON.parse(JSON.stringify(server.daily[k])) : null;
                write = (out) => { if (out === null) delete server.daily[k]; else server.daily[k] = out; };
            } else if (p.indexOf('zoew_scan_history_cod_dod/') === 0) {
                const k = p.split('/')[1];
                cur = server.history[k] ? JSON.parse(JSON.stringify(server.history[k])) : null;
                write = (out) => { if (out === null) delete server.history[k]; else server.history[k] = out; };
            } else {
                cur = null;
                write = () => {};
            }
            const out = fn(cur);
            if (out === undefined) return Promise.resolve({ committed: false, snapshot: { val: () => cur } });
            write(out === null ? null : JSON.parse(JSON.stringify(out)));
            return Promise.resolve({ committed: true, snapshot: { val: () => out } });
        },
        update: (ref, obj) => {
            if (bump()) return hung();
            const base = (ref && ref.path) || '';
            Object.keys(obj || {}).forEach((k) => {
                const full = base ? base + '/' + k : k;
                const seg = full.split('/');
                const value = obj[k];
                if (seg[0] === 'zoew_recently_deleted_cod_dod') {
                    if (value === null) delete server.trash[seg[1]];
                    else server.trash[seg[1]] = JSON.parse(JSON.stringify(value));
                } else if (seg[0] === 'zoew_scan_history_cod_dod') {
                    if (value === null) delete server.history[seg[1]];
                    else server.history[seg[1]] = JSON.parse(JSON.stringify(value));
                }
            });
            return Promise.resolve();
        },
        set: (ref, value) => {
            if (bump()) return hung();
            const seg = ((ref && ref.path) || '').split('/');
            if (seg[0] === 'zoew_recently_deleted_cod_dod' && seg[1]) {
                if (value === null) delete server.trash[seg[1]]; else server.trash[seg[1]] = JSON.parse(JSON.stringify(value));
            } else if (seg[0] === 'zoew_scan_history_cod_dod' && seg[1]) {
                if (value === null) delete server.history[seg[1]]; else server.history[seg[1]] = JSON.parse(JSON.stringify(value));
            }
            return Promise.resolve();
        },
        get: (ref) => {
            if (bump()) return hung();
            const seg = ((ref && ref.path) || '').split('/');
            let v = null;
            if (seg[0] === 'zoew_recently_deleted_cod_dod') v = seg[1] ? (server.trash[seg[1]] || null) : server.trash;
            else if (seg[0] === 'zoew_scan_history_cod_dod') v = seg[1] ? (server.history[seg[1]] || null) : server.history;
            return Promise.resolve({ exists: () => v !== null && v !== undefined, val: () => v });
        }
    };

    const store = {
        getItem: (k) => (Object.prototype.hasOwnProperty.call(storage, k) ? storage[k] : null),
        setItem: (k, v) => { storage[k] = String(v); },
        removeItem: (k) => { delete storage[k]; }
    };

    const box = {
        console: { log: () => {}, error: () => {}, warn: () => {} },
        Date, JSON, Math, Object, Set, Map, Array, String, Number, Boolean,
        parseFloat, parseInt, isNaN, isFinite, Promise, RegExp, Intl, Error,
        setTimeout: (fn, ms) => { const id = setTimeout(fn, Math.min(ms || 0, 30)); timers.push(id); return id; },
        clearTimeout: (id) => clearTimeout(id),
        window: {}, ZoeErrors: null,
        db: {}, fb,
        appLocalStore: store, appSessionStore: store,
        dbRefDeleted: { path: 'zoew_recently_deleted_cod_dod' },
        dbRefHistory: { path: 'zoew_scan_history_cod_dod' },
        dbRefDailyRevenue: { path: 'zoew_daily_revenue_cod_dod' },
        dbRefMonthlyRevenue: { path: 'zoew_monthly_revenue_cod_dod' },
        getServerNow: () => NOW,
        showToast: (m) => { toasts.push(String(m)); },
        refreshCurrentHistoryView: () => {},
        releaseBarcodesInRegistry: () => Promise.resolve(),
        dbListenerViewIsStale: () => false,
        isDatabaseConnected: true,
        scanHistory: [], deletedItems: [],
        dailyRevenueData: { [DAY]: { codDollar: START_COD, dodDollar: 3, totalCount: START_COUNT } },
        monthlyRevenueData: { [MONTH]: { codDollar: START_COD, dodDollar: 3, totalCount: START_COUNT } }
    };
    const ctx = vm.createContext(box);
    const parts = CONSTS.map((c) => sliceConst(SRC, c)).filter(Boolean);
    parts.push('let serverClockTrusted = true, cleanupResumeInFlight = false;');
    parts.push('const cleanupInFlight = new Set();', 'const activeRestoreClaims = new Map();');
    FNS.forEach((fn) => {
        const body = sliceFrom(SRC, fn);
        if (!body) { if (missingCore.indexOf(fn) === -1) missingCore.push(fn); return; }
        parts.push(body);
    });
    RECOVERY_FNS.forEach((fn) => {
        const body = sliceFrom(SRC, fn);
        if (!body) { if (missingRecovery.indexOf(fn) === -1) missingRecovery.push(fn); return; }
        parts.push(body);
    });
    vm.runInContext(parts.join('\n\n'), ctx);
    return { ctx, box, server, storage, toasts, timers, writeCount: () => writes };
}

function seedItem(run, barcodes, ageDays) {
    const item = {
        id: ITEM_ID, phone: '0762907142', scanDate: DAY,
        isClosed: barcodes.every((b) => b.isClosed),
        createdAt: NOW - (ageDays || 9) * 24 * 3600 * 1000,
        barcodes: barcodes.map((b) => Object.assign({ isDeducted: false, isFromDeletion: false }, b))
    };
    run.server.history[ITEM_ID] = JSON.parse(JSON.stringify(item));
    run.box.scanHistory.push(JSON.parse(JSON.stringify(item)));
    return item;
}

function settle(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

const BARCODES = [
    { code: 'BC1', cod: 2.71, dod: 0, isClosed: false },
    { code: 'BC2', cod: 6.43, dod: 0, isClosed: false },
    { code: 'BC3', cod: 1.93, dod: 0, isClosed: false }
];
const TOTAL_COD = 2.71 + 6.43 + 1.93;
const r2 = (n) => Math.round(n * 100) / 100;

function barcodeCount(server) {
    let n = 0;
    ['history', 'trash'].forEach((bucket) => {
        Object.keys(server[bucket]).forEach((k) => {
            const it = server[bucket][k];
            if (it && Array.isArray(it.barcodes)) n += it.barcodes.length;
        });
    });
    return n;
}

function packagePlaces(server) {
    const inHistory = !!server.history[ITEM_ID];
    const trashIds = Object.keys(server.trash);
    const inTrash = trashIds.length > 0;
    return { inHistory, inTrash, trashIds };
}

(async () => {
    console.log('=== cleanup-interrupt-atomicity — ការរំខានពាក់កណ្តាលមិនត្រូវធ្វើឲ្យកញ្ចប់បាត់ ===');

    // ── ១. លក្ខខណ្ឌចាំបាច់ ៖ ផ្លូវធម្មតា (គ្មានការរំខាន) ត្រូវដើរពេញលេញ ────
    {
        const run = makeRun({});
        missingCore.forEach((n) => ok('ត្រូវមាន `' + n + '()` ក្នុងកូដ ship', false, 'អវត្តមាន'));
        seedItem(run, BARCODES);
        vm.runInContext("claimAndCleanupItem('" + ITEM_ID + "', 'abandon');", run.ctx);
        await settle(600);
        run.timers.forEach(clearTimeout);
        const at = packagePlaces(run.server);
        ok('លក្ខខណ្ឌចាំបាច់ ៖ ផ្លូវធម្មតា ➜ កញ្ចប់ចេញពីប្រវត្តិ',
            !at.inHistory, at);
        ok('លក្ខខណ្ឌចាំបាច់ ៖ ផ្លូវធម្មតា ➜ កញ្ចប់ចូលធុងសំរាម',
            at.inTrash, at);
        ok('លក្ខខណ្ឌចាំបាច់ ៖ ផ្លូវធម្មតា ➜ លុយដក',
            r2(run.server.daily[DAY].codDollar) === r2(START_COD - TOTAL_COD), run.server.daily[DAY]);
        ok('លក្ខខណ្ឌចាំបាច់ ៖ ផ្លូវធម្មតា ➜ ចំនួនកញ្ចប់ដក',
            run.server.daily[DAY].totalCount === START_COUNT - 3, run.server.daily[DAY]);
        ok('លក្ខខណ្ឌចាំបាច់ ៖ ការសរសេរទៅ server មានច្រើនជាង ១ (ថ្នាក់នេះទើបមានន័យ)',
            run.writeCount() >= 3, run.writeCount());
    }

    // ── ២. ⛔⛔ ការរំខាននៅ *គ្រប់ចំណុច* ៖ កញ្ចប់មិនត្រូវបាត់ ────────────
    //    (ការវាស់ជារចនាសម្ព័ន្ធ ៖ សម្លាប់ការសរសេរទី N សម្រាប់ N = 0..6)
    const lost = [];
    const rescued = [];
    for (let dieAfter = 0; dieAfter <= 6; dieAfter++) {
        const run = makeRun({ dieAfter });
        seedItem(run, BARCODES);
        vm.runInContext("claimAndCleanupItem('" + ITEM_ID + "', 'abandon');", run.ctx);
        await settle(400);
        run.timers.forEach(clearTimeout);
        const at = packagePlaces(run.server);
        const present = at.inHistory || at.inTrash;
        if (!present) lost.push(dieAfter);

        // ⛔ ការស្តារ ៖ tab ថ្មីបើកឡើង (storage ដដែល · server ដដែល · បណ្តាញរស់)
        if (!present) {
            const next = makeRun({ storage: run.storage });
            next.server.history = run.server.history;
            next.server.trash = run.server.trash;
            next.server.daily = run.server.daily;
            next.server.monthly = run.server.monthly;
            try { vm.runInContext('typeof resumeInterruptedCleanups === "function" ? resumeInterruptedCleanups() : null;', next.ctx); } catch (e) {}
            await settle(500);
            next.timers.forEach(clearTimeout);
            const after = packagePlaces(next.server);
            if (after.inHistory || after.inTrash) rescued.push(dieAfter);
        }
    }
    const unrecoverable = lost.filter((n) => rescued.indexOf(n) === -1);
    ok('⛔⛔ គ្មានចំណុចរំខានណាមួយធ្វើឲ្យកញ្ចប់បាត់ពីទាំង ២ កន្លែងដោយស្តារមិនបាន',
        unrecoverable.length === 0, { បាត់: lost, ស្តារបាន: rescued, ស្តារមិនបាន: unrecoverable });

    // ⛔ ការស្តារ ៖ tab ថ្មីបើកឡើង (storage ដដែល · server ដដែល · បណ្តាញរស់)
    async function replay(prev) {
        const next = makeRun({ storage: prev.storage });
        next.server.history = prev.server.history;
        next.server.trash = prev.server.trash;
        next.server.daily = prev.server.daily;
        next.server.monthly = prev.server.monthly;
        try { vm.runInContext('typeof resumeInterruptedCleanups === "function" ? resumeInterruptedCleanups() : null;', next.ctx); } catch (e) {}
        await settle(500);
        next.timers.forEach(clearTimeout);
        return next;
    }

    // ── ៣. ⛔⛔ ការរំខាន *កណ្តាល ledger* ៖ សាលក្រមមិនច្បាស់ ➜ មិនដកលុយ ────
    //    (ច្បាប់ «មិនអាចផ្ទៀងផ្ទាត់ ≠ ខុស» ៖ ការដកជាសកម្មភាពបំផ្លាញ ➜ ត្រូវ
    //     ទុកសិន ហើយ **ប្រាប់អ្នកប្រើ** មិនមែនស្ងាត់)
    {
        const run = makeRun({ dieAfter: 2 });
        seedItem(run, BARCODES);
        vm.runInContext("claimAndCleanupItem('" + ITEM_ID + "', 'abandon');", run.ctx);
        await settle(500);
        run.timers.forEach(clearTimeout);
        ok('លក្ខខណ្ឌចាំបាច់ ៖ ធុងសំរាមចុះរួច តែ ledger មិនទាន់ដក',
            Object.keys(run.server.trash).length === 1 && run.server.daily[DAY].totalCount === START_COUNT,
            { trash: Object.keys(run.server.trash), daily: run.server.daily[DAY] });
        const codBefore = r2(run.server.daily[DAY].codDollar);
        const countBefore = run.server.daily[DAY].totalCount;
        const next = await replay(run);
        ok('⛔⛔ សាលក្រម ledger មិនច្បាស់ ➜ ការស្តារ **មិនប៉ះលុយ**',
            r2(next.server.daily[DAY].codDollar) === codBefore && next.server.daily[DAY].totalCount === countBefore,
            { before: { cod: codBefore, count: countBefore }, after: next.server.daily[DAY] });
        ok('⛔ ហើយ ledger ខែក៏មិនប៉ះដែរ',
            r2(next.server.monthly[MONTH].codDollar) === codBefore && next.server.monthly[MONTH].totalCount === countBefore,
            next.server.monthly[MONTH]);
        ok('⛔ ការស្តារមិនស្ងាត់ ៖ អ្នកប្រើត្រូវបានប្រាប់',
            next.toasts.some((t) => t.indexOf('⚠️') === 0), next.toasts);
        ok('⛔ កញ្ចប់នៅក្នុងធុងសំរាមដដែល (មិនស្ទួន)',
            Object.keys(next.server.trash).length === 1, Object.keys(next.server.trash));
        ok('⛔ ការស្តារលុប journal ចោល (មិនវិលមករាល់វដ្ត ៦០ វិ.)',
            Object.keys(next.storage).length === 0, next.storage);
    }

    // ── ៤. ⛔ ទិសផ្ទុយ ៖ ការស្តារមិនត្រូវ *ដាស់* កញ្ចប់ដែល purge រួច ──────
    //    សាលក្រម `ledger` = ការសរសេរធុងសំរាមចុះរួចពិត ➜ បើវាបាត់ឥឡូវ នោះ
    //    ជាការសម្រេចរបស់អ្នកប្រើ (purge ឬស្តារ) មិនមែនការបាត់បង់ទេ។
    {
        const run = makeRun({ dieAfter: 2 });
        seedItem(run, BARCODES);
        vm.runInContext("claimAndCleanupItem('" + ITEM_ID + "', 'abandon');", run.ctx);
        await settle(500);
        run.timers.forEach(clearTimeout);
        run.server.trash = {};
        const next = await replay(run);
        ok('⛔ ទិសផ្ទុយ ៖ ការស្តារមិនដាស់កញ្ចប់ដែលចាកចេញរួច',
            Object.keys(next.server.trash).length === 0, Object.keys(next.server.trash));
    }

    // ── ៥. ⛔ ការស្តារនៃសាលក្រម `moved` ត្រូវបញ្ចប់ការងារពេញលេញ ──────────
    {
        const run = makeRun({ dieAfter: 1 });
        seedItem(run, BARCODES);
        vm.runInContext("claimAndCleanupItem('" + ITEM_ID + "', 'abandon');", run.ctx);
        await settle(500);
        run.timers.forEach(clearTimeout);
        ok('លក្ខខណ្ឌចាំបាច់ ៖ កញ្ចប់បាត់ពីទាំង ២ កន្លែងមុនស្តារ',
            !run.server.history[ITEM_ID] && Object.keys(run.server.trash).length === 0,
            { history: !!run.server.history[ITEM_ID], trash: Object.keys(run.server.trash) });
        const once = await replay(run);
        ok('⛔ ស្តារ ➜ កញ្ចប់ត្រឡប់ចូលធុងសំរាម',
            Object.keys(once.server.trash).length === 1, Object.keys(once.server.trash));
        ok('⛔ ស្តារ ➜ លុយដកត្រឹមត្រូវ',
            r2(once.server.daily[DAY].codDollar) === r2(START_COD - TOTAL_COD), once.server.daily[DAY]);
        ok('⛔ ស្តារ ➜ ចំនួនកញ្ចប់ដកត្រឹមត្រូវ',
            once.server.daily[DAY].totalCount === START_COUNT - 3, once.server.daily[DAY]);
        const twice = await replay(once);
        ok('⛔ ទិសផ្ទុយ ៖ ការស្តារ ២ ដង មិនដកលុយ ២ ដង (idempotent)',
            r2(twice.server.daily[DAY].codDollar) === r2(START_COD - TOTAL_COD), twice.server.daily[DAY]);
        ok('⛔ ទិសផ្ទុយ ៖ ការស្តារ ២ ដង មិនបង្កើតធាតុធុងសំរាមស្ទួន',
            Object.keys(twice.server.trash).length === 1, Object.keys(twice.server.trash));
    }

    // ── ៥ខ. ⛔ ទិសផ្ទុយ ៖ ការរត់ដែល **ចប់ស្រួល** មិនត្រូវទុក journal សល់ ──
    {
        const run = makeRun({});
        seedItem(run, BARCODES);
        vm.runInContext("claimAndCleanupItem('" + ITEM_ID + "', 'abandon');", run.ctx);
        await settle(700);
        run.timers.forEach(clearTimeout);
        ok('⛔ ទិសផ្ទុយ ៖ ការសម្អាតដែលចប់ស្រួល មិនបន្សល់ journal',
            Object.keys(run.storage).length === 0, run.storage);
    }

    // ── ៥គ. ⛔ ទិសផ្ទុយ ៖ «យករួច» (២ ម៉ោង) ៖ មិនបាត់ ហើយលុយមិនប៉ះ ────────
    {
        const run = makeRun({ dieAfter: 1 });
        seedItem(run, [{ code: 'BC9', cod: 9.99, dod: 0, isClosed: true, closedAt: NOW - 3 * 3600 * 1000 }], 1);
        vm.runInContext("claimAndCleanupItem('" + ITEM_ID + "', 'close');", run.ctx);
        await settle(500);
        run.timers.forEach(clearTimeout);
        const next = await replay(run);
        const at = packagePlaces(next.server);
        ok('⛔ «យករួច» ដែលរំខាន ➜ កញ្ចប់មិនបាត់', at.inHistory || at.inTrash, at);
        ok('⛔ «យករួច» ដែលរំខាន ➜ លុយនៅដដែល (ជួរ ៧ នៃតារាងសេណារីយ៉ូ)',
            r2(next.server.daily[DAY].codDollar) === r2(START_COD)
            && next.server.daily[DAY].totalCount === START_COUNT, next.server.daily[DAY]);
        ok('⛔ «យករួច» ដែលរំខាន ➜ ledger ខែក៏មិនប៉ះដែរ',
            r2(next.server.monthly[MONTH].codDollar) === r2(START_COD)
            && next.server.monthly[MONTH].totalCount === START_COUNT, next.server.monthly[MONTH]);
    }

    // ── ៥ឃ. ⛔⛔ កញ្ចប់ *លាយ* (ការសម្អាតដោយផ្នែក) ៖ barcode ត្រូវអភិរក្ស ──
    //    ⛔ «នៅក្នុងប្រវត្តិ» មិនគ្រប់គ្រាន់ទេ ៖ ផ្លូវផ្នែកទុកសំណល់ក្នុងប្រវត្តិ
    //    ខណៈ barcode ដែលផុតកំណត់ **បាត់** ➜ អថេរពិតគឺ **ចំនួន barcode សរុប**។
    {
        const MIXED = [
            { code: 'BCa', cod: 4.00, dod: 0, isClosed: true, closedAt: NOW - 30 * 60 * 1000 },
            { code: 'BCb', cod: 5.00, dod: 0, isClosed: false },
            { code: 'BCc', cod: 3.50, dod: 0, isClosed: false }
        ];
        // ⛔ ផ្លូវធម្មតារបស់ **សាខាផ្នែក** ត្រូវវាស់ដែរ ៖ សេណារីយ៉ូ «ផុតកំណត់
        //    ទាំងអស់» ដើរតាមសាខា *ទាំងមូល* ➜ ការដកលុយស្ទួនក្នុងសាខាផ្នែក
        //    រស់រានដោយគ្មានអ្នកវាស់។
        {
            const clean = makeRun({});
            seedItem(clean, MIXED);
            vm.runInContext("claimAndCleanupItem('" + ITEM_ID + "', 'abandon');", clean.ctx);
            await settle(700);
            clean.timers.forEach(clearTimeout);
            ok('លក្ខខណ្ឌចាំបាច់ ៖ ផ្លូវធម្មតា (កញ្ចប់លាយ) ➜ លុយដក **ម្តងគត់**',
                r2(clean.server.daily[DAY].codDollar) === r2(START_COD - 8.50), clean.server.daily[DAY]);
            ok('លក្ខខណ្ឌចាំបាច់ ៖ ផ្លូវធម្មតា (កញ្ចប់លាយ) ➜ ចំនួនកញ្ចប់ដក ២ ម្តងគត់',
                clean.server.daily[DAY].totalCount === START_COUNT - 2, clean.server.daily[DAY]);
            ok('លក្ខខណ្ឌចាំបាច់ ៖ ផ្លូវធម្មតា (កញ្ចប់លាយ) ➜ ledger ខែស្របគ្នា',
                r2(clean.server.monthly[MONTH].codDollar) === r2(START_COD - 8.50)
                && clean.server.monthly[MONTH].totalCount === START_COUNT - 2, clean.server.monthly[MONTH]);
            ok('លក្ខខណ្ឌចាំបាច់ ៖ ផ្លូវធម្មតា (កញ្ចប់លាយ) ➜ barcode អភិរក្ស',
                barcodeCount(clean.server) === 3, barcodeCount(clean.server));
        }

        const lostMixed = [];
        for (let dieAfter = 0; dieAfter <= 6; dieAfter++) {
            const run = makeRun({ dieAfter });
            seedItem(run, MIXED);
            vm.runInContext("claimAndCleanupItem('" + ITEM_ID + "', 'abandon');", run.ctx);
            await settle(400);
            run.timers.forEach(clearTimeout);
            let total = barcodeCount(run.server);
            if (total !== 3) {
                const next = await replay(run);
                total = barcodeCount(next.server);
            }
            if (total !== 3) lostMixed.push({ dieAfter, total });
        }
        ok('⛔⛔ កញ្ចប់លាយ ៖ ចំនួន barcode ត្រូវអភិរក្សនៅគ្រប់ចំណុចរំខាន',
            lostMixed.length === 0, lostMixed);

        const run = makeRun({ dieAfter: 1 });
        seedItem(run, MIXED);
        vm.runInContext("claimAndCleanupItem('" + ITEM_ID + "', 'abandon');", run.ctx);
        await settle(500);
        run.timers.forEach(clearTimeout);
        ok('លក្ខខណ្ឌចាំបាច់ ៖ ផ្លូវផ្នែកទុកសំណល់ក្នុងប្រវត្តិ ហើយ barcode ២ បាត់',
            !!run.server.history[ITEM_ID] && barcodeCount(run.server) === 1, barcodeCount(run.server));
        const done = await replay(run);
        ok('⛔ ស្តារ ➜ barcode ដែលផុតកំណត់ត្រឡប់ចូលធុងសំរាម',
            barcodeCount(done.server) === 3, barcodeCount(done.server));
        ok('⛔ ស្តារ ➜ លុយដក **តែ** តម្លៃ barcode ដែលផុតកំណត់',
            r2(done.server.daily[DAY].codDollar) === r2(START_COD - 8.50), done.server.daily[DAY]);
        ok('⛔ ស្តារ ➜ ចំនួនកញ្ចប់ដក ២ (មិនមែន ៣)',
            done.server.daily[DAY].totalCount === START_COUNT - 2, done.server.daily[DAY]);
        const again = await replay(done);
        ok('⛔ ទិសផ្ទុយ ៖ កញ្ចប់លាយ ➜ ស្តារ ២ ដង មិនដកលុយ ២ ដង',
            r2(again.server.daily[DAY].codDollar) === r2(START_COD - 8.50), again.server.daily[DAY]);
    }

    // ── ៥ង. ⛔ journal មិនត្រូវឆ្លង **Firebase Project** ────────────────────
    //    វាជាស្ថានភាពថ្មីដែលរស់នៅ `localStorage` ➜ វារស់រាន Reconfig។ ការ
    //    សរសេរធាតុរបស់អាជីវកម្ម ក ចូល Project របស់អាជីវកម្ម ខ = ការលេចទិន្នន័យ។
    {
        const run = makeRun({ dieAfter: 1 });
        run.storage['zoew_firebase_config'] = '{ "apiKey": "k", "databaseURL": "https://old-project.firebaseio.com" }';
        seedItem(run, BARCODES);
        vm.runInContext("claimAndCleanupItem('" + ITEM_ID + "', 'abandon');", run.ctx);
        await settle(500);
        run.timers.forEach(clearTimeout);
        ok('លក្ខខណ្ឌចាំបាច់ ៖ journal ចាប់យក Project ដែលកំពុងប្រើ',
            Object.keys(run.storage).some((k) => k.indexOf('cleanup') !== -1
                && String(run.storage[k]).indexOf('old-project') !== -1), Object.keys(run.storage));

        // Reconfig ➜ Project ថ្មី
        const next = makeRun({ storage: run.storage });
        next.storage['zoew_firebase_config'] = '{ "apiKey": "k", "databaseURL": "https://new-project.firebaseio.com" }';
        next.server.history = run.server.history;
        next.server.trash = run.server.trash;
        next.server.daily = run.server.daily;
        next.server.monthly = run.server.monthly;
        try { vm.runInContext('typeof resumeInterruptedCleanups === "function" ? resumeInterruptedCleanups() : null;', next.ctx); } catch (e) {}
        await settle(500);
        next.timers.forEach(clearTimeout);
        ok('⛔ Project ផ្សេង ➜ ការស្តារ **មិនសរសេរ** ចូល Project ថ្មី',
            Object.keys(next.server.trash).length === 0, Object.keys(next.server.trash));
        ok('⛔ ហើយវាមិនប៉ះលុយរបស់ Project ថ្មីដែរ',
            r2(next.server.daily[DAY].codDollar) === r2(START_COD), next.server.daily[DAY]);
        ok('⛔ ធាតុនោះត្រូវលុបចោល (មិនវិលមករាល់វដ្ត)',
            !Object.keys(next.storage).some((k) => k.indexOf('cleanup') !== -1), next.storage);

        // ⛔ ទិសផ្ទុយ ៖ Project **ដដែល** ➜ ការស្តារត្រូវដើរដូចធម្មតា
        const same = makeRun({ storage: { 'zoew_firebase_config': run.storage['zoew_firebase_config'] } });
        const fresh = makeRun({ dieAfter: 1 });
        fresh.storage['zoew_firebase_config'] = '{ "databaseURL": "https://old-project.firebaseio.com" }';
        seedItem(fresh, BARCODES);
        vm.runInContext("claimAndCleanupItem('" + ITEM_ID + "', 'abandon');", fresh.ctx);
        await settle(500);
        fresh.timers.forEach(clearTimeout);
        const back = await replay(fresh);
        ok('⛔ ទិសផ្ទុយ ៖ Project ដដែល ➜ ការស្តារដើរធម្មតា',
            Object.keys(back.server.trash).length === 1, Object.keys(back.server.trash));
        void same;
    }

    // ── ៥ច. ⛔ កូនសោ journal ត្រូវជា **id របស់ធុងសំរាម** មិនមែន id ប្រវត្តិ ──
    //    ការសម្អាត **ដោយផ្នែក** ទុកកញ្ចប់ក្នុងប្រវត្តិ ➜ id ដដែលអាចត្រូវសម្អាត
    //    ម្ដងទៀត (សោដោះតាម `settleLockWithin` ខណៈការសរសេរមុននៅព្យួរ) ➜ កូនសោ
    //    ជា id ប្រវត្តិ នឹង **សរសេរជាន់ធាតុមុន** ➜ batch ទី ១ ស្តារមិនកើត។
    {
        const run = makeRun({});
        const entryA = { id: 'id_same', reason: 'abandon', stage: 'moved', trashItem: { id: 'trash_a', barcodes: [] }, revenue: null };
        const entryB = { id: 'id_same', reason: 'abandon', stage: 'moved', trashItem: { id: 'trash_b', barcodes: [] }, revenue: null };
        vm.runInContext('typeof noteCleanupJournalEntry === "function" ? (noteCleanupJournalEntry(A), noteCleanupJournalEntry(B)) : null;',
            Object.assign(run.ctx, { A: entryA, B: entryB }));
        let kept = [];
        try { kept = vm.runInContext('typeof readCleanupJournal === "function" ? readCleanupJournal().map(e => e.trashItem.id) : []', run.ctx); } catch (e) { kept = []; }
        ok('⛔ batch ២ របស់ id ប្រវត្តិដដែល ត្រូវរស់នៅជាមួយគ្នា (មិនសរសេរជាន់)',
            kept.length === 2 && kept.indexOf('trash_a') !== -1 && kept.indexOf('trash_b') !== -1, kept);
        vm.runInContext('typeof clearCleanupJournalEntry === "function" ? clearCleanupJournalEntry("trash_a") : null;', run.ctx);
        let left = [];
        try { left = vm.runInContext('typeof readCleanupJournal === "function" ? readCleanupJournal().map(e => e.trashItem.id) : []', run.ctx); } catch (e) { left = []; }
        ok('⛔ ការលុបធាតុ ១ មិនប៉ះធាតុមួយទៀត',
            left.length === 1 && left[0] === 'trash_b', left);
    }

    // ── ៥ឆ. ⛔ journal ដែល **ធ្លាក់** មិនត្រូវបំបែកការសម្អាត (fail-open) ────
    //    វាជាស្រទាប់ **ជំនួយ** ៖ storage បិទ · quota ពេញ · ឈ្មោះបាត់ ➜ App
    //    ត្រូវដើរដូចមុនបេះបិទ។ បើវាបោះ `finishCleanup` នឹងបោះបង់ **មុន** ការ
    //    សរសេរធុងសំរាម ➜ កញ្ចប់បាត់ — គឺជាកំហុសដដែលដែលយើងកំពុងកែ។
    {
        const run = makeRun({});
        seedItem(run, BARCODES);
        try {
            vm.runInContext('noteCleanupJournalEntry = function () { throw new Error("JOURNAL_DOWN"); };'
                + ' markCleanupJournalStage = function () { throw new Error("JOURNAL_DOWN"); };'
                + ' clearCleanupJournalEntry = function () { throw new Error("JOURNAL_DOWN"); };', run.ctx);
        } catch (e) {}
        vm.runInContext("claimAndCleanupItem('" + ITEM_ID + "', 'abandon');", run.ctx);
        await settle(700);
        run.timers.forEach(clearTimeout);
        ok('⛔ journal ធ្លាក់ ➜ ការសម្អាតនៅតែសរសេរធុងសំរាម',
            Object.keys(run.server.trash).length === 1, Object.keys(run.server.trash));
        ok('⛔ journal ធ្លាក់ ➜ លុយនៅតែដកត្រឹមត្រូវ',
            r2(run.server.daily[DAY].codDollar) === r2(START_COD - TOTAL_COD), run.server.daily[DAY]);
        ok('⛔ journal ធ្លាក់ ➜ ចំនួនកញ្ចប់នៅតែដក',
            run.server.daily[DAY].totalCount === START_COUNT - 3, run.server.daily[DAY]);
    }

    // ── ៦. ⛔ អ្នកស្តារត្រូវមានឈ្មោះក្នុងកូដ ship ─────────────────────────
    missingRecovery.forEach((n) => ok('⛔ ត្រូវមានអ្នកស្តារ `' + n + '()`', false, 'អវត្តមាន'));
    ok('⛔ អ្នកស្តារត្រូវត្រូវបានហៅនៅពេល boot',
        /resumeInterruptedCleanups\s*\(/.test(SRC) && (SRC.match(/resumeInterruptedCleanups\s*\(/g) || []).length >= 2,
        (SRC.match(/resumeInterruptedCleanups\s*\(/g) || []).length);

    console.log('');
    if (fail) { console.log('❌ ធ្លាក់ ' + fail + ' / ok ' + pass); process.exitCode = 1; }
    else if (!pass) { console.log('❌ គ្មានការអះអាងណារត់សោះ'); process.exitCode = 1; }
    else { console.log('✅ ជោគជ័យ ' + pass); process.exitCode = 0; }
})();
