// ⛔ ថ្នាក់កំហុស៖ **transaction ដែលដោះយឺតជាង `DB_OP_TIMEOUT_MS` ➜ ការងារក្រោយ
// commit (ធុងសំរាម · ដកលុយ · ស្ថិតិយក) មិនដែលរត់ ➜ barcode បាត់ស្ងាត់ៗ
// ដោយគ្មានធុងសំរាម ហើយលុយមិនត្រូវដក។**
//
// នេះជាមេរៀន 2.23.1 (ការព្យួរត្រូវដោះសោ) ដែលមាន **ផលរំខានទី ២** ដែលមិនទាន់
// ត្រូវបានវាស់ ៖ `dbOp()` បោះ `'Database operation stalled'` នៅ ១៥ វិ. តែ
// **transaction ខាងក្រោមនៅរស់ដដែល** ក្នុង SDK ។ RTDB ចាក់ការសរសេរចូលជួរពេល
// ក្រៅបណ្តាញ រួចបាញ់វាទៅ server ពេលភ្ជាប់មកវិញ ➜ **វា commit ក្រោយ timeout**។
//
// លំដាប់ពិត (WiFi ដាច់មួយភ្លែត) ៖
//   ១. អ្នកប្រើចុច «🗑️ ដក» barcode ➜ transaction ចូលជួរ (មិនទាន់ផ្ញើ)
//   ២. ១៥ វិ. ➜ `dbOp` បោះ ➜ toast «ដកមិនបានជោគជ័យ! ទិន្នន័យត្រូវបានត្រឡប់មកវិញ»
//   ៣. ៣០ វិ. ➜ WiFi មកវិញ ➜ SDK ផ្ញើ transaction ➜ **commit** ➜ barcode
//      ចេញពីប្រវត្តិលើ server
//   ៤. ⛔ គ្មានធុងសំរាម · លុយមិនដក · ស្លាកបង្ហាញខុស — **barcode បាត់ស្ងាត់ៗ**
//
// ផ្លូវដែលរងផលដូចគ្នា ៖ `removeSingleBarcode` (ដក ➜ **លុយ**) ·
// `deleteSingleItem` (លុប ➜ ធុងសំរាម) · `claimAndCleanupItem('abandon')`
// (៧ ថ្ងៃ ➜ **លុយ**) · `claimAndCleanupItem('close')` (២ ម៉ោង ➜ ធុងសំរាម) ·
// `toggleIndividualBarcodeClose`/`toggleCloseStatus` (➜ **ស្ថិតិយក**)។
//
// ⚠️ **មូលហេតុដែល checker ១២៣ មិនចាប់** ៖ stub ទាំងអស់ធ្វើឲ្យ `runTransaction`
// **ដោះភ្លាម · បដិសេធ · ឬព្យួរអស់កល្ប** — **គ្មានមួយណាដោះ *យឺតជាងពិដាន*** សោះ
// (សំណួរទី ៩ — របៀបបរាជ័យទី ៤ ៖ «យឺត តែជោគជ័យ»)។
//
// ច្បាប់ដែលឯកសារនេះចាក់សោ ៖
//   ១. ការព្យួរ ➜ promise ដើមត្រូវ **រក្សាទុក** ហើយពេលវា commit យឺត ការងារ
//      ក្រោយ commit ត្រូវរត់ **ដូចផ្លូវធម្មតាបេះបិទ** (ធុងសំរាម · លុយ · ស្ថិតិយក)។
//   ២. ⛔ toast ពេលព្យួរត្រូវ **និយាយការពិត** — មិនអះអាងថា «ត្រឡប់មកវិញ» ខណៈ
//      transaction នៅរស់។
//   ៣. ⛔ ការបញ្ចប់យឺតត្រូវរត់ **តែម្តង** — គ្មានលុយដកស្ទួន · ធុងសំរាមស្ទួន។
//   ៤. ⛔ transaction ដែល **បោះបង់យឺត** (committed:false) ឬ **បដិសេធយឺត**
//      ➜ **មិនត្រូវ** សរសេរធុងសំរាម ឬដកលុយ (ទិសផ្ទុយ)។
//   ៥. ⛔ ទិសផ្ទុយ ៖ បណ្តាញធម្មតា ➜ លទ្ធផលដដែលបេះបិទ ដកម្តងគត់។
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { reactRuntime } = require('./react-view.js');

const ROOT = process.env.LATECOMMIT_APP_DIR ? path.resolve(process.env.LATECOMMIT_APP_DIR)
    : (process.argv[2] ? path.resolve(process.argv[2]) : path.join(__dirname, '..'));
const APP = path.join(ROOT, 'ZoeW', 'app.js');

let pass = 0;
let fail = 0;
function check(condition, label, detail) {
    if (condition) { pass++; console.log('   ok    ' + label); }
    else { fail++; console.log('  FAIL   ' + label + (detail !== undefined ? '\n         ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : '')); }
}

let src = '';
try {
    src = fs.readFileSync(APP, 'utf8').replace(/\r\n?/g, '\n');
} catch (e) {
    console.log('  FAIL   អាន ZoeW/app.js មិនបាន ➜ ' + e.message);
    console.log('\n❌ ធ្លាក់ 1 — កូដដែលតេស្តនេះការពារ បាត់ពី tree ដែលកំពុងពិនិត្យ');
    process.exit(1);
}

function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function sliceBalanced(text, from) {
    let depth = 0;
    for (let i = from; i < text.length; i++) {
        if (text[i] === '{') depth++;
        else if (text[i] === '}') { depth--; if (depth === 0) return text.slice(from, i + 1); }
    }
    return null;
}

function extractFn(name) {
    const re = new RegExp('\\n(\\s*)(async\\s+)?function ' + name + '\\s*\\(');
    const m = re.exec(src);
    if (!m) return null;
    const head = src.indexOf('function ' + name, m.index);
    const brace = src.indexOf('{', src.indexOf('(', head));
    const body = sliceBalanced(src, brace);
    if (!body) return null;
    return (m[2] ? 'async ' : '') + src.slice(head, brace) + body;
}

function extractConst(name) {
    const m = new RegExp('\\n\\s*const ' + name + ' = ([^;]+);').exec(src);
    return m ? 'const ' + name + ' = ' + m[1] + ';' : null;
}

console.log('\n=== ០. ជាន់អប្បបរមា ===');
check(src.split('\n').length >= 4000, 'ZoeW/app.js មិនទទេ (>= 4000 បន្ទាត់)', src.split('\n').length);
const dbOpSites = (src.match(/await dbOp\(fb\.runTransaction\(/g) || []).length;
check(dbOpSites >= 6, 'ឃើញ `await dbOp(fb.runTransaction(` >= 6 កន្លែង', dbOpSites);

const REAL_FNS = [
    'elapsedSince', 'withTimeout', 'dbOp', 'dbOpStalled', 'armLateWrite', 'retryAsync',
    'barcodeEntriesOf', 'normalizeBarcodesOf', 'ensureBarcodeArrayForItem', 'applyBarcodeCloseState', 'barcodeCloseIsRipe', 'barcodeAbandonIsRipe', 'barcodeAbandonBasis', 'itemAbandonRipeAt',
    'normalizeBarcodeCloseStamps', 'itemHasRestoreMarkers', 'stripHistoryOnlyMarkers',
    'dropStaleRestoreMarkers', 'parseTimestampFromId', 'generateUniqueId', 'cloneRestoreItem',
    'ledgerNumber', 'ledgerAppliedDelta', 'ledgerDeltaWithClamp', 'revertLedgerRecordInMemory',
    'recalcItemMoneyFromBarcodes', 'applyLedgerBucketDelta', 'commitRevenueBucketDelta', 'ledgerZeroDelta', 'ledgerRejectionVerdict', 'ledgerMarkUnknown', 'ledgerServerVerdict', 'ledgerMemoryCompensationClaimed', 'revertLedgerBucketOnServer', 'revertRevenueLedgerDelta', 'correctRevenueLedgerToActual', 'addRevenueToDailyAndMonthlyRecord',
    'runLedgerTransaction', 'commitDailyRevenueDelta', 'commitMonthlyRevenueDelta', 'alignMonthlyLedgerToDaily', 'getPickupPhoneKey',
    'barcodeRegistryKey', 'pickupBarcodeKey', 'pickupSetSize', 'tallyPickupPhones',
    'legacyPickupPlaceholders', 'pickupSetFromRecord', 'buildPickupRecordFromSet', 'applyPickupMarksToSet',
    'collectPickupMarks', 'reconstructPickupSet', 'applyPickupMarksInMemory', 'commitPickupMarks',
    'markPickupBarcodes', 'revertPickupMarks', 'reapplyPickupMarks',
    'getZoneDateKey', 'appZoneParts', 'statsMoney', 'statsPositive', 'ledgerNumber', 'collectedSetFromRecord', 'collectedMarkValueOf', 'collectedDayOfStamp', 'collectedDayHoldingKey',
    'collectedMarksFor', 'commitCollectedMarks', 'markCollectedRevenue', 'reconcileCollectedHistory',
    'saveSingleDeletedItemToFirebase', 'restoreClaimedItemToScanHistory',
    'claimAndCleanupItem', 'removeSingleBarcode', 'deleteSingleItem',
    'toggleIndividualBarcodeClose', 'applyBarcodeCloseChange', 'toggleCloseStatus'
];
// helper ថ្មីដែលការកែនាំមក — លើ tree មុនកែ វាអវត្តមាន ➜ stub ដើម្បីឲ្យការ
// អះអាងឥរិយាបថនៅតែរត់ (មេរៀន 2.19.3 ៖ កុំបញ្ឈប់ checker)
const OPTIONAL_FNS = ['armLateCommit', 'viewListModalShowing', 'notifyIfSlow', 'settleLockWithin', 'reconcileCollectedPriceState',
    'safeStoreGet', 'safeStoreSet', 'safeStoreRemove',
    'cleanupJournalScope', 'cleanupJournalScopeMismatch',
    'readCleanupJournal', 'writeCleanupJournal', 'noteCleanupJournalEntry', 'markCleanupJournalStage', 'clearCleanupJournalEntry'];
const fnSrc = {};
const missing = [];
for (const name of REAL_FNS) {
    const s = extractFn(name);
    if (s) fnSrc[name] = s; else missing.push(name);
}
check(missing.length === 0, 'រក function ពិតឃើញទាំង ' + REAL_FNS.length, missing);
for (const name of missing) fnSrc[name] = 'function ' + name + '() { return Promise.resolve(); }';
const optionalSrc = OPTIONAL_FNS.map((name) => extractFn(name)).filter(Boolean).join('\n\n')
    // ⛔ លើ tree មុនកែ `notifyIfSlow` អវត្តមាន ➜ ត្រូវ stub ដើម្បីឲ្យការអះអាង
    // ឥរិយាបថនៅតែរត់ (មេរៀន 2.19.3 ៖ កុំបញ្ឈប់ checker)។
    + (extractFn('notifyIfSlow') ? '' : '\n\nfunction notifyIfSlow(p) { return p; }')
    // ⛔ `settleLockWithin` អវត្តមានលើ tree មុនកែ ➜ stub ដែល **រក្សាឥរិយាបថដើម**
    // (រង់ចាំពេញ · បញ្ជូនតម្លៃត្រឡប់) ដើម្បីឲ្យការអះអាងឥរិយាបថនៅតែរត់។
    + (extractFn('settleLockWithin') ? '' : '\n\nfunction settleLockWithin(p) { return Promise.resolve(p); }')
    + '\n\nfunction clearScannedRemovalInFlight() {}'
    // ⛔ journal នៃការសម្អាត ៖ លើ tree មុនកែវាអវត្តមាន ➜ stub ដើម្បីឲ្យ
    //    ការអះអាងឥរិយាបថនៅតែរត់ (មេរៀន 2.19.3)។
    + (extractFn('noteCleanupJournalEntry') ? '' : '\n\nfunction noteCleanupJournalEntry() {}')
    + (extractFn('markCleanupJournalStage') ? '' : '\n\nfunction markCleanupJournalStage() {}')
    + (extractFn('clearCleanupJournalEntry') ? '' : '\n\nfunction clearCleanupJournalEntry() {}');

// នាឡិកាមាត្រដ្ឋាន ៖ ពិដាន ១៥ វិ. ក្លាយជា ៣០០ms ➜ តេស្តលឿន តែកូដពិតមិនប្រែ
const TIME_SCALE = 50;
const LATE_REAL_MS = 480;          // ≈ ២៤ វិ. ក្នុងពេល App ➜ ក្រោយពិដាន ១៥ វិ.
const SETTLE_REAL_MS = 900;
const T0 = 1750000000000;
const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const SCAN_DATE = '2026-08-19';

function buildWorld(seed, opts) {
    opts = opts || {};
    const store = {
        zoew_scan_history_cod_dod: clone(seed.history || {}),
        zoew_recently_deleted_cod_dod: clone(seed.trash || {}),
        zoew_daily_revenue_cod_dod: clone(seed.daily || {}),
        zoew_monthly_revenue_cod_dod: clone(seed.monthly || {}),
        zoew_daily_pickup_cod_dod: clone(seed.pickup || {})
    };
    const world = { store, now: opts.now || T0, toasts: [], txCalls: 0, commits: 0, updates: [], timers: new Set() };

    function getPath(raw) {
        const parts = String(raw || '').split('/').filter(Boolean);
        let cur = store;
        for (const part of parts) {
            if (!cur || typeof cur !== 'object') return null;
            cur = cur[part];
        }
        return cur === undefined ? null : cur;
    }
    function setPath(raw, value) {
        const parts = String(raw || '').split('/').filter(Boolean);
        if (!parts.length) {
            Object.keys(store).forEach((k) => delete store[k]);
            Object.assign(store, clone(value) || {});
            return;
        }
        let cur = store;
        for (let i = 0; i < parts.length - 1; i++) {
            if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
            cur = cur[parts[i]];
        }
        const key = parts[parts.length - 1];
        if (value === null || value === undefined) { delete cur[key]; return; }
        cur[key] = clone(value);
    }
    const hostSetTimeout = setTimeout;
    const historyPath = (p) => /^zoew_scan_history_cod_dod\//.test(p);
    const mode = opts.historyMode || 'normal';   // normal · late · lateAbort · lateReject

    const fb = {
        ref: (_db, raw) => ({ path: raw === undefined ? '' : String(raw) }),
        get: (ref) => {
            const value = getPath(ref.path);
            return Promise.resolve({ exists: () => value !== null, val: () => clone(value) });
        },
        increment: (n) => ({ __increment: n }),
        runTransaction: (ref, updater) => {
            const p = ref.path;
            const run = (forceAbort) => {
                world.txCalls++;
                const next = forceAbort ? undefined : updater(clone(getPath(p)));
                if (next === undefined) return { committed: false, snapshot: { val: () => clone(getPath(p)) } };
                world.commits++;
                setPath(p, next);
                return { committed: true, snapshot: { val: () => clone(getPath(p)) } };
            };
            if (!historyPath(p) || mode === 'normal') return Promise.resolve().then(() => run(false));
            return new Promise((resolve, reject) => {
                const t = hostSetTimeout(() => {
                    world.timers.delete(t);
                    if (mode === 'lateReject') { reject(new Error('disconnect')); return; }
                    resolve(run(mode === 'lateAbort'));
                }, LATE_REAL_MS);
                world.timers.add(t);
            });
        },
        update: (ref, updates) => Promise.resolve().then(() => {
            world.updates.push({ path: ref.path, keys: Object.keys(updates) });
            Object.keys(updates).forEach((key) => {
                const full = [ref.path, key].filter(Boolean).join('/');
                const v = updates[key];
                if (v && typeof v === 'object' && v.__increment !== undefined) {
                    setPath(full, (parseFloat(getPath(full)) || 0) + v.__increment);
                } else setPath(full, v);
            });
        })
    };

    const scaled = {
        setTimeout: (fn, ms, ...a) => {
            const t = setTimeout(fn, Math.max(0, Math.round((ms || 0) / TIME_SCALE)), ...a);
            world.timers.add(t);
            return t;
        },
        clearTimeout: (t) => { world.timers.delete(t); return clearTimeout(t); }
    };

    const context = vm.createContext({
        console, Promise, Math, Date, JSON, Object, Array, String, Number, Boolean, Map, Set, Error, RegExp,
        parseFloat, parseInt, isNaN, isFinite, queueMicrotask,
        setTimeout: scaled.setTimeout,
        clearTimeout: scaled.clearTimeout,
        window: {},
        document: { getElementById: () => null },
        confirm: () => true,
        db: {}, authGeneration: 0,
        fb,
        dbRefHistory: fb.ref({}, 'zoew_scan_history_cod_dod'),
        dbRefDeleted: fb.ref({}, 'zoew_recently_deleted_cod_dod'),
        dbRefDailyRevenue: fb.ref({}, 'zoew_daily_revenue_cod_dod'),
        dbRefMonthlyRevenue: fb.ref({}, 'zoew_monthly_revenue_cod_dod'),
        dbRefDailyPickup: fb.ref({}, 'zoew_daily_pickup_cod_dod'),
        dbRefDailyCollected: fb.ref({}, 'zoew_daily_collected_cod_dod'),
        getServerNow: () => world.now,
        getFormattedDate: () => SCAN_DATE,
        showToast: (msg) => { world.toasts.push(String(msg)); },
        closeModal: () => {},
        openViewListModal: () => {},
        refreshCurrentHistoryView: () => {},
        updateRecentPhonesList: () => {},
        dbListenerViewIsStale: () => false,
        isActiveRestoreClaim: () => false,
        DB_LISTENER_KEY_DELETED: 'deleted',
        DB_LISTENER_KEY_HISTORY: 'history',
        scanHistory: [],
        deletedItems: [],
        dailyRevenueData: {},
        monthlyRevenueData: {},
        dailyPickupData: {},
        dailyCollectedData: {},
        activeParentItemId: null,
        isModalOpen: false,
        cleanupInFlight: new Set(),
        activeRestoreClaims: new Map()
    });

    const code = [
        reactRuntime(src, { exclude: REAL_FNS.concat(OPTIONAL_FNS), context }),
        extractConst('TWO_HOURS_MS') || 'const TWO_HOURS_MS = 7200000;',
        extractConst('ABANDON_AGE_MS') || 'const ABANDON_AGE_MS = 604800000;',
        extractConst('DB_OP_TIMEOUT_MS') || 'const DB_OP_TIMEOUT_MS = 15000;',
        extractConst('PICKUP_LEGACY_KEY_PREFIX') || 'const PICKUP_LEGACY_KEY_PREFIX = "_lg_";',
        extractConst('PICKUP_LEGACY_PLACEHOLDER_MAX') || 'const PICKUP_LEGACY_PLACEHOLDER_MAX = 20000;',
        extractConst('PICKUP_PHONE_KEY_MAX') || 'const PICKUP_PHONE_KEY_MAX = 64;',
        extractConst('APP_TIME_ZONE') || "const APP_TIME_ZONE = 'Asia/Phnom_Penh';",
        extractConst('APP_TIME_ZONE_OFFSET_MINUTES') || 'const APP_TIME_ZONE_OFFSET_MINUTES = 420;',
        extractConst('DAILY_COLLECTED_KEEP_DAYS') || 'const DAILY_COLLECTED_KEEP_DAYS = 7;',
        extractConst('PICKUP_DATE_KEY_PATTERN') || 'const PICKUP_DATE_KEY_PATTERN = /^\\d{4}-\\d{2}-\\d{2}$/;',
        extractConst('TRASH_WRITE_SLOW_NOTICE_MS') || 'const TRASH_WRITE_SLOW_NOTICE_MS = 15000;',
        extractConst('LOCK_STALL_RELEASE_MS') || 'const LOCK_STALL_RELEASE_MS = 15000;',
        extractConst('CLEANUP_JOURNAL_KEY') || "const CLEANUP_JOURNAL_KEY = 'zoew_cleanup_journal_v1';",
        extractConst('CLEANUP_JOURNAL_MAX') || 'const CLEANUP_JOURNAL_MAX = 200;',
        extractConst('CLEANUP_STAGE_MOVED') || "const CLEANUP_STAGE_MOVED = 'moved';",
        extractConst('CLEANUP_STAGE_LEDGER') || "const CLEANUP_STAGE_LEDGER = 'ledger';",
        'const appLocalStore = (function () { const d = {}; return { getItem: (k) => (Object.prototype.hasOwnProperty.call(d, k) ? d[k] : null), setItem: (k, v) => { d[k] = String(v); }, removeItem: (k) => { delete d[k]; } }; })();',
        ...REAL_FNS.map((name) => fnSrc[name]),
        optionalSrc
    ].join('\n\n');
    new vm.Script(code).runInContext(context);
    // ⛔ `dbOp` ពិតហៅ `probeDatabaseLiveness()` ពេលព្យួរ (ការវាស់ភាពរស់ ៖ `emu/app-network-e2e-test`) ➜ stub «មិនវាស់»
    vm.runInContext('var probeDatabaseLiveness = function () { return Promise.resolve(null); };', context);

    world.context = context;
    world.getPath = getPath;
    world.syncListener = () => {
        const raw = getPath('zoew_scan_history_cod_dod') || {};
        context.scanHistory.length = 0;
        Object.keys(raw).forEach((key) => context.scanHistory.push(clone(raw[key])));
        const trash = getPath('zoew_recently_deleted_cod_dod') || {};
        context.deletedItems.length = 0;
        Object.keys(trash).forEach((key) => context.deletedItems.push(clone(trash[key])));
        context.dailyRevenueData = clone(getPath('zoew_daily_revenue_cod_dod') || {});
        context.monthlyRevenueData = clone(getPath('zoew_monthly_revenue_cod_dod') || {});
        context.dailyPickupData = clone(getPath('zoew_daily_pickup_cod_dod') || {});
        context.dailyCollectedData = clone(getPath('zoew_daily_collected_cod_dod') || {});
    };
    world.wait = (ms) => new Promise((resolve) => hostSetTimeout(resolve, ms));
    world.dispose = () => { world.timers.forEach(clearTimeout); world.timers.clear(); };
    world.trashItems = () => Object.values(getPath('zoew_recently_deleted_cod_dod') || {});
    world.daily = () => getPath('zoew_daily_revenue_cod_dod/' + SCAN_DATE) || {};
    world.monthly = () => getPath('zoew_monthly_revenue_cod_dod/' + SCAN_DATE.slice(0, 7)) || {};
    world.pickupDay = () => getPath('zoew_daily_pickup_cod_dod/' + SCAN_DATE) || {};
    world.syncListener();
    return world;
}

function bc(code, cod, dod, closed, closedAt) {
    const b = { code, cod, dod, locker: 'N/A', time: 't', isClosed: !!closed, isDeducted: false, isFromDeletion: false, createdAt: T0 };
    if (closed) b.closedAt = closedAt || T0;
    return b;
}
function parcel(id, barcodes, extra) {
    return Object.assign({
        id, phone: '012345678', scanDate: SCAN_DATE, createdAt: T0, barcodes, count: barcodes.length,
        cod: barcodes.reduce((s, b) => s + b.cod, 0), dod: barcodes.reduce((s, b) => s + b.dod, 0),
        price: barcodes.reduce((s, b) => s + b.cod + b.dod, 0), barcode: barcodes[0].code,
        isClosed: barcodes.every((b) => b.isClosed), isCalled: false, time: 't'
    }, extra || {});
}
const ledgerSeed = () => ({
    daily: { [SCAN_DATE]: { codDollar: 100, dodDollar: 40, totalCount: 5 } },
    monthly: { [SCAN_DATE.slice(0, 7)]: { codDollar: 100, dodDollar: 40, totalCount: 5 } }
});
// ⛔ វាស់ **ការពិត** មិនមែន **ការជ្រើសពាក្យ** ៖ សារដែលកុហកគឺសារដែលអះអាងថា
// ការផ្លាស់ប្តូរ **ត្រូវបានដកវិញ** ខណៈ transaction នៅរស់ ហើយនឹង commit។
// «បណ្តាញត្រឡប់មកវិញ» មិនមែនជាការអះអាងបែបនោះទេ ➜ វាមិនត្រូវរាប់ជាការកុហក។
const stallToastLies = (toasts) => toasts.filter((t) =>
    /ទិន្នន័យត្រូវបានត្រឡប់មកវិញ|កំពុងត្រឡប់ស្ថានភាពដើមវិញ|ស្ថានភាពត្រូវបានត្រឡប់ដើមវិញ/.test(t));
const stallToastWaits = (toasts) => toasts.filter((t) => /^⏳/.test(t));

async function scenarioRemove(mode) {
    const label = mode === 'normal' ? 'បណ្តាញធម្មតា' : 'commit យឺតក្រោយពិដាន';
    console.log('\n=== ១' + (mode === 'normal' ? 'ក' : 'ខ') + '. removeSingleBarcode — ' + label + ' ===');
    const seed = Object.assign({ history: { id_rm: parcel('id_rm', [bc('AAA111', 10, 0, false), bc('BBB222', 0, 25, false)]) } }, ledgerSeed());
    const world = buildWorld(seed, { historyMode: mode });
    const ran = world.context.removeSingleBarcode('id_rm', 'AAA111');
    await world.wait(LATE_REAL_MS + SETTLE_REAL_MS);
    await ran.catch(() => {});
    world.dispose();

    const live = world.getPath('zoew_scan_history_cod_dod/id_rm');
    const trash = world.trashItems();
    check(!!live && live.barcodes.length === 1 && live.barcodes[0].code === 'BBB222',
        'barcode A ចេញពីប្រវត្តិលើ server (transaction commit)', live && live.barcodes.map((b) => b.code));
    check(trash.length === 1 && trash[0].trashReason === 'remove' && trash[0].barcodes[0].code === 'AAA111',
        '⛔ ស្នូល ៖ ធុងសំរាមមាន A ជា «ដក» **១ ធាតុគត់**', trash.map((t) => t.trashReason + ':' + t.barcodes.map((b) => b.code)));
    check(trash.length === 1 && trash[0].barcodes[0].isDeducted === true, 'barcode ក្នុងធុងសំរាមមាន isDeducted = true (ស្តារ ➜ បូកវិញ)');
    check(world.daily().codDollar === 90 && world.daily().totalCount === 4,
        '⛔ លុយ ៖ ចំណូលថ្ងៃដក $10 និង ១ កញ្ចប់ **ម្តងគត់**', world.daily());
    check(world.monthly().codDollar === 90, 'ចំណូលខែដកដដែល', world.monthly());
    if (mode !== 'normal') {
        check(stallToastLies(world.toasts).length === 0,
            '⛔ toast ពេលព្យួរមិនអះអាងថាការដកត្រូវបានដកវិញ (transaction នៅរស់)', world.toasts);
        check(stallToastWaits(world.toasts).length === 1,
            '⛔ ២ ខាង ៖ អ្នកប្រើត្រូវដឹងថាវានឹងបញ្ចប់ដោយស្វ័យប្រវត្តិ (សារ ⏳ ១)', world.toasts);
    } else {
        check(world.toasts.some((t) => /កាត់ប្រាក់/.test(t)), 'toast ជោគជ័យធម្មតា', world.toasts);
    }
}

async function scenarioRemoveLateAbort(mode) {
    console.log('\n=== ១គ. removeSingleBarcode — transaction ' + (mode === 'lateAbort' ? 'បោះបង់យឺត' : 'បដិសេធយឺត (disconnect)') + ' ➜ ទិសផ្ទុយ ===');
    const seed = Object.assign({ history: { id_rm: parcel('id_rm', [bc('AAA111', 10, 0, false), bc('BBB222', 0, 25, false)]) } }, ledgerSeed());
    const world = buildWorld(seed, { historyMode: mode });
    const ran = world.context.removeSingleBarcode('id_rm', 'AAA111');
    await world.wait(LATE_REAL_MS + SETTLE_REAL_MS);
    await ran.catch(() => {});
    world.dispose();
    check(world.trashItems().length === 0, '⛔ គ្មានធុងសំរាម ពេល transaction មិន commit', world.trashItems().length);
    check(world.daily().codDollar === 100 && world.daily().totalCount === 5, '⛔ លុយមិនប្រែ ពេល transaction មិន commit', world.daily());
    const live = world.getPath('zoew_scan_history_cod_dod/id_rm');
    check(!!live && live.barcodes.length === 2, 'barcode ទាំង ២ នៅដដែលក្នុងប្រវត្តិ', live && live.barcodes.length);
}

async function scenarioDelete(mode) {
    console.log('\n=== ២. deleteSingleItem — ' + (mode === 'normal' ? 'បណ្តាញធម្មតា' : 'commit យឺតក្រោយពិដាន') + ' ===');
    const seed = Object.assign({ history: { id_del: parcel('id_del', [bc('CCC333', 12, 3, false)]) } }, ledgerSeed());
    const world = buildWorld(seed, { historyMode: mode });
    const ran = world.context.deleteSingleItem('id_del');
    await world.wait(LATE_REAL_MS + SETTLE_REAL_MS);
    await ran.catch(() => {});
    world.dispose();
    const trash = world.trashItems();
    check(world.getPath('zoew_scan_history_cod_dod/id_del') === null, 'កញ្ចប់ចេញពីប្រវត្តិ');
    check(trash.length === 1 && trash[0].trashReason === 'delete' && trash[0].id === 'id_del',
        '⛔ ស្នូល ៖ ធុងសំរាមមានកញ្ចប់ជា «លុប» ១ ធាតុគត់', trash.map((t) => t.id + ':' + t.trashReason));
    check(world.daily().codDollar === 100 && world.daily().totalCount === 5, '⛔ «លុប» មិនប៉ះលុយ (ទាំង ២ ផ្លូវ)', world.daily());
    if (mode !== 'normal') {
        check(stallToastLies(world.toasts).length === 0, '⛔ toast ពេលព្យួរមិនអះអាងថាការលុបត្រូវបានដកវិញ', world.toasts);
        check(stallToastWaits(world.toasts).length === 1, '⛔ ២ ខាង ៖ មានសារ ⏳ ប្រាប់ថានឹងបញ្ចប់ដោយស្វ័យប្រវត្តិ', world.toasts);
    }
}

async function scenarioCleanupAbandon(mode) {
    console.log('\n=== ៣. claimAndCleanupItem(abandon) ៧ ថ្ងៃ — ' + (mode === 'normal' ? 'បណ្តាញធម្មតា' : 'commit យឺតក្រោយពិដាន') + ' ===');
    const seed = Object.assign({ history: { id_old: parcel('id_old', [bc('DDD444', 30, 0, false)]) } }, ledgerSeed());
    const world = buildWorld(seed, { historyMode: mode, now: T0 + 7 * DAY + 60000 });
    const ran = world.context.claimAndCleanupItem('id_old', 'abandon');
    await world.wait(LATE_REAL_MS + SETTLE_REAL_MS);
    await ran.catch(() => {});
    world.dispose();
    const trash = world.trashItems();
    check(world.getPath('zoew_scan_history_cod_dod/id_old') === null, 'កញ្ចប់ចេញពីប្រវត្តិ');
    check(trash.length === 1 && trash[0].trashReason === 'expired' && trash[0].barcodes[0].isDeducted === true,
        '⛔ ស្នូល ៖ ធុងសំរាមមាន «ផុតកំណត់» ១ ធាតុ ជាមួយ isDeducted', trash.map((t) => t.trashReason));
    check(world.daily().codDollar === 70 && world.daily().totalCount === 4, '⛔ លុយ ៖ ដក $30 · ១ កញ្ចប់ ម្តងគត់', world.daily());
    check(!world.context.cleanupInFlight.has('id_old'), 'សោ cleanupInFlight ដោះក្រោយបញ្ចប់', Array.from(world.context.cleanupInFlight));
}

async function scenarioCleanupPickup(mode) {
    console.log('\n=== ៤. claimAndCleanupItem(close) ២ ម៉ោង — ' + (mode === 'normal' ? 'បណ្តាញធម្មតា' : 'commit យឺតក្រោយពិដាន') + ' ===');
    const seed = Object.assign({ history: { id_pk: parcel('id_pk', [bc('EEE555', 8, 0, true, T0)], { isClosed: true, closedAt: T0 }) } }, ledgerSeed());
    const world = buildWorld(seed, { historyMode: mode, now: T0 + 3 * HOUR });
    const ran = world.context.claimAndCleanupItem('id_pk', 'close');
    await world.wait(LATE_REAL_MS + SETTLE_REAL_MS);
    await ran.catch(() => {});
    world.dispose();
    const trash = world.trashItems();
    check(world.getPath('zoew_scan_history_cod_dod/id_pk') === null, 'កញ្ចប់ចេញពីប្រវត្តិ');
    check(trash.length === 1 && trash[0].trashReason === 'pickup', '⛔ ស្នូល ៖ ធុងសំរាមមាន «យករួច» ១ ធាតុ', trash.map((t) => t.trashReason));
    check(world.daily().codDollar === 100 && world.daily().totalCount === 5, '⛔ «យករួច» មិនប៉ះលុយ', world.daily());
}

async function scenarioToggle(mode, whole) {
    const fnName = whole ? 'toggleCloseStatus' : 'toggleIndividualBarcodeClose';
    console.log('\n=== ៥' + (whole ? 'ខ' : 'ក') + '. ' + fnName + ' — ' + (mode === 'normal' ? 'បណ្តាញធម្មតា' : 'commit យឺតក្រោយពិដាន') + ' ===');
    const seed = Object.assign({ history: { id_tg: parcel('id_tg', [bc('FFF666', 5, 0, false)]) } }, ledgerSeed());
    const world = buildWorld(seed, { historyMode: mode });
    const ran = whole ? world.context.toggleCloseStatus('id_tg') : world.context.toggleIndividualBarcodeClose('id_tg', 'FFF666');
    await world.wait(LATE_REAL_MS + SETTLE_REAL_MS);
    await ran.catch(() => {});
    world.dispose();
    const live = world.getPath('zoew_scan_history_cod_dod/id_tg');
    const day = world.pickupDay();
    check(!!live && live.isClosed === true && live.barcodes[0].isClosed === true, 'barcode បិទលើ server (commit)', live);
    check(day.packagesPickedUp === 1, '⛔ ស្ថិតិយក ៖ កញ្ចប់យក = 1 (មិនត្រូវត្រឡប់ជា 0 ក្រោយ commit យឺត)', day);
    check(!!day.pickedUpPhones && day.pickedUpPhones['012345678'] === 1, '⛔ ស្ថិតិយក ៖ អតិថិជនយក = 1', day);
    const sum = Object.values(day.pickedUpPhones || {}).reduce((s, n) => s + n, 0);
    check(sum === (day.packagesPickedUp || 0), 'អថេរ sum(pickedUpPhones) === packagesPickedUp', { sum, packages: day.packagesPickedUp });
    if (mode !== 'normal') {
        check(stallToastLies(world.toasts).length === 0, '⛔ toast ពេលព្យួរមិនអះអាងថាស្ថានភាពត្រូវត្រឡប់ដើមវិញ', world.toasts);
        check(stallToastWaits(world.toasts).length === 1, '⛔ ២ ខាង ៖ មានសារ ⏳ ប្រាប់ថានឹងធ្វើបច្ចុប្បន្នភាពពេលបណ្តាញមកវិញ', world.toasts);
    }
}

// ── ០ខ. កិច្ចសន្យារបស់ `armLateCommit` ខ្លួនវា ─────────────────────────
// ⛔ `committed: false` (updater ត្រឡប់ undefined ➜ transaction បោះបង់) **មិនមែន
// ជាជោគជ័យទេ** ។ ការបញ្ជូនវាទៅ `onCommitted` នឹងធ្វើឲ្យផ្លូវក្រោយ commit រត់
// លើការងារដែល server **មិនបានទទួល** ➜ ធុងសំរាមស្ទួន ឬលុយដកខុស។
async function scenarioArmContract() {
    console.log('\n=== ០ខ. កិច្ចសន្យា armLateCommit ៖ committed:false ➜ onFailed ===');
    const world = buildWorld({ history: {} }, {});
    const ctx = world.context;
    if (typeof ctx.armLateCommit !== 'function') {
        check(false, 'រក armLateCommit ឃើញក្នុងកូដ ship', 'អវត្តមាន ➜ ការការពារ late commit មិនមានទេ');
        world.dispose();
        return;
    }
    const log = [];
    ctx.armLateCommit(Promise.resolve({ committed: true, snapshot: { val: () => null } }),
        () => log.push('ok:committed'), () => log.push('failed:committed'), 'test');
    ctx.armLateCommit(Promise.resolve({ committed: false, snapshot: { val: () => null } }),
        () => log.push('ok:aborted'), () => log.push('failed:aborted'), 'test');
    ctx.armLateCommit(Promise.reject(new Error('disconnect')),
        () => log.push('ok:rejected'), () => log.push('failed:rejected'), 'test');
    await world.wait(60);
    world.dispose();
    check(log.indexOf('ok:committed') !== -1, 'commit ពិត ➜ ផ្លូវជោគជ័យរត់', log);
    check(log.indexOf('ok:aborted') === -1 && log.indexOf('failed:aborted') !== -1,
        '⛔ committed:false ➜ **ផ្លូវបរាជ័យ** មិនមែនផ្លូវជោគជ័យ', log);
    check(log.indexOf('ok:rejected') === -1 && log.indexOf('failed:rejected') !== -1,
        '⛔ promise បដិសេធ ➜ ផ្លូវបរាជ័យ', log);
}

(async () => {
    await scenarioArmContract();
    await scenarioRemove('normal');
    await scenarioRemove('late');
    await scenarioRemoveLateAbort('lateAbort');
    await scenarioRemoveLateAbort('lateReject');
    await scenarioDelete('normal');
    await scenarioDelete('late');
    await scenarioCleanupAbandon('normal');
    await scenarioCleanupAbandon('late');
    await scenarioCleanupPickup('normal');
    await scenarioCleanupPickup('late');
    await scenarioToggle('normal', false);
    await scenarioToggle('late', false);
    await scenarioToggle('normal', true);
    await scenarioToggle('late', true);

    console.log('\n' + (fail ? '❌ ធ្លាក់ ' + fail : '✅ គ្មានបញ្ហា') + ' — ok ' + pass);
    process.exit(fail ? 1 : 0);
})().catch((e) => {
    console.log('  FAIL   តេស្តគាំង ➜ ' + (e && e.stack ? e.stack : e));
    process.exit(1);
});
