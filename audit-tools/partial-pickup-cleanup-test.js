const fs = require('fs');
const path = require('path');
const vm = require('vm');

// ⛔ **stub ledger ត្រូវស៊ីនឹងកិច្ចសន្យាពិត។** `addRevenueToDailyAndMonthlyRecord()`
// ពិត clamp ត្រឹម 0 ហើយ **ត្រឡប់ delta ដែលអនុវត្តពិត** ដែល
// `revertRevenueLedgerDelta()` ត្រូវការ។ stub ដែលត្រឡប់ `undefined` ឬលទ្ធផល
// របស់ `.push()` (ជា *លេខ*) ធ្វើឲ្យផ្លូវដកវិញក្លាយជា **no-op ស្ងាត់** ➜
// checker បៃតងខណៈវាមើលមិនឃើញការដកវិញសោះ (វាស់បាន 2026-09-03)។
// ជាគូ ៖ ការអនុវត្ត និងការដកវិញត្រូវចែក ledger **តែមួយ** បើមិនដូច្នេះ
// ការដកវិញមិនប៉ះអ្វីដែលការអនុវត្តបានធ្វើទេ ➜ ការវាស់ក្លាយជាការក្លែង។
function ledgerStubEntries(onEntry, onCorrect) {
    const s = makeLedgerStub(onEntry, onCorrect);
    return {
        addRevenueToDailyAndMonthlyRecord: s.add,
        revertRevenueLedgerDelta: s.revert,
        correctRevenueLedgerToActual: s.correct
    };
}

function makeLedgerStub(onEntry, onCorrect) {
    const buckets = {};
    const add = function (d, cod, dod, count) {
        if (onEntry) onEntry(d, cod, dod, count);
        const b = buckets[d] || (buckets[d] = { codDollar: 0, dodDollar: 0, totalCount: 0 });
        const before = { codDollar: b.codDollar, dodDollar: b.dodDollar, totalCount: b.totalCount };
        b.codDollar = Math.round((b.codDollar + (parseFloat(cod) || 0)) * 100) / 100;
        b.dodDollar = Math.round((b.dodDollar + (parseFloat(dod) || 0)) * 100) / 100;
        b.totalCount = b.totalCount + (parseFloat(count) || 0);
        if (b.codDollar < 0) b.codDollar = 0;
        if (b.dodDollar < 0) b.dodDollar = 0;
        if (b.totalCount < 0) b.totalCount = 0;
        const applied = {
            cod: Math.round((b.codDollar - before.codDollar) * 100) / 100,
            dod: Math.round((b.dodDollar - before.dodDollar) * 100) / 100,
            count: b.totalCount - before.totalCount
        };
        return { scanDate: d, daily: applied, monthly: applied, dailyServer: Promise.resolve(applied), monthlyServer: Promise.resolve(applied) };
    };
    const revert = function (applied) {
        if (!applied || !applied.scanDate || !applied.daily) return null;
        const dd = applied.daily;
        if (!dd.cod && !dd.dod && !dd.count) return applied;
        add(applied.scanDate, -dd.cod, -dd.dod, -dd.count);
        return applied;
    };
    const addPickup = function (d, key, cust, pkg) {
        return { scanDate: d, phoneKey: key || null, packages: parseFloat(pkg) || 0, customer: parseFloat(cust) || 0 };
    };
    const revertPickup = function (applied) {
        if (!applied || !applied.scanDate) return null;
        if (!applied.packages && !applied.customer) return applied;
        return applied;
    };
    const correct = function (d, applied, cod, dod, count) {
        if (onCorrect) onCorrect(d, applied, cod, dod, count);
        return Promise.resolve({ ok: true });
    };
    return { add: add, revert: revert, correct: correct, addPickup: addPickup, revertPickup: revertPickup, buckets: buckets };
}


const ROOT = process.env.PARTIAL_APP_DIR ? path.resolve(process.env.PARTIAL_APP_DIR)
    : (process.argv[2] ? path.resolve(process.argv[2]) : path.join(__dirname, '..'));
const APP = path.join(ROOT, 'ZoeW', 'app.js');

let pass = 0;
let fail = 0;

function check(condition, label, detail) {
    if (condition) {
        pass++;
        console.log('  ok    ' + label);
    } else {
        fail++;
        console.log('  FAIL  ' + label + (detail ? '\n        ' + detail : ''));
    }
}

function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function sliceBalanced(src, from) {
    let depth = 0;
    for (let i = from; i < src.length; i++) {
        if (src[i] === '{') depth++;
        else if (src[i] === '}') {
            depth--;
            if (depth === 0) return src.slice(from, i + 1);
        }
    }
    throw new Error('unbalanced braces');
}

function extractFn(src, name) {
    const re = new RegExp('\\n(\\s*)(async\\s+)?function ' + name + '\\s*\\(');
    const m = re.exec(src);
    if (!m) throw new Error('function not found in shipped code: ' + name);
    const head = src.indexOf('function ' + name, m.index);
    const brace = src.indexOf('{', src.indexOf('(', head));
    return (m[2] ? 'async ' : '') + src.slice(head, brace) + sliceBalanced(src, brace);
}

// ⛔ tree មុនកែគ្មានធាតុថ្មី ➜ ត្រូវ stub ជំនួសការគាំង ដើម្បីឲ្យការអះអាង
// ឥរិយាបថនៅតែរត់ (មេរៀន 2.19.3 ៖ កុំបញ្ឈប់ checker)។
function optionalPart(read, fallback) {
    try { return read() || fallback; } catch (e) { return fallback; }
}

function extractConst(src, name) {
    const re = new RegExp('\\n\\s*const ' + name + ' = ([^;]+);');
    const m = re.exec(src);
    if (!m) throw new Error('const not found in shipped code: ' + name);
    return 'const ' + name + ' = ' + m[1] + ';';
}

const src = fs.readFileSync(APP, 'utf8').replace(/\r\n?/g, '\n');

const REAL_FNS = [
    'barcodeEntriesOf',
    'recalcItemMoneyFromBarcodes',
    'normalizeBarcodesOf',
    'applyBarcodeCloseState',
    'barcodeCloseIsRipe',
    'barcodeAbandonIsRipe',
    'normalizeBarcodeCloseStamps',
    'itemHasRestoreMarkers',
    'stripHistoryOnlyMarkers',
    'parseTimestampFromId',
    'generateUniqueId',
    'retryAsync',
    'cloneRestoreItem',
    'saveSingleDeletedItemToFirebase',
    'restoreClaimedItemToScanHistory',
    'claimAndCleanupItem',
    'runAutomaticCleanupRules'
];

function buildWorld(historySeed, startNow) {
    const store = {
        zoew_scan_history_cod_dod: clone(historySeed),
        zoew_recently_deleted_cod_dod: {}
    };
    const world = { store, now: startNow, revenueLog: [], reconcileLog: [], transactionCalls: 0, commits: 0 };

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
        if (!parts.length) return;
        let cur = store;
        for (let i = 0; i < parts.length - 1; i++) {
            if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
            cur = cur[parts[i]];
        }
        const key = parts[parts.length - 1];
        if (value === null) { delete cur[key]; return; }
        cur[key] = clone(value);
    }

    const fb = {
        ref: (db, raw) => ({ path: raw === undefined ? '' : String(raw) }),
        get: (ref) => {
            const value = getPath(ref.path);
            return Promise.resolve({ exists: () => value !== null, val: () => clone(value) });
        },
        runTransaction: (ref, updater) => Promise.resolve().then(() => {
            world.transactionCalls++;
            const next = updater(clone(getPath(ref.path)));
            if (next === undefined) return { committed: false, snapshot: { val: () => clone(getPath(ref.path)) } };
            world.commits++;
            setPath(ref.path, next);
            return { committed: true, snapshot: { val: () => clone(getPath(ref.path)) } };
        }),
        update: (ref, updates) => Promise.resolve().then(() => {
            Object.entries(updates).forEach(([key, value]) => setPath([ref.path, key].filter(Boolean).join('/'), value));
        })
    };

    const context = vm.createContext({
        console,
        setTimeout,
        clearTimeout,
        Promise,
        Math,
        Date,
        JSON,
        window: {},
        db: {},
        fb,
        dbRefDeleted: fb.ref({}, 'zoew_recently_deleted_cod_dod'),
        dbRefHistory: fb.ref({}, 'zoew_scan_history_cod_dod'),
        getServerNow: () => world.now,
        getFormattedDate: () => '2026-08-19',
        ...ledgerStubEntries(
            (scanDate, cod, dod, count) => world.revenueLog.push({ scanDate: scanDate, cod: cod, dod: dod, count: count }),
            (scanDate, applied, cod, dod, count) => world.reconcileLog.push({ scanDate, applied, cod, dod, count })
        ),
        showToast: (msg) => { world.toasts.push(msg); },
        scanHistory: [],
        deletedItems: []
    });
    world.toasts = [];

    const code = [
        extractConst(src, 'TWO_HOURS_MS'),
        extractConst(src, 'ABANDON_AGE_MS'),
        // ⛔ ពិដានការហៅ Firebase (db-stall-guard) ជាហេដ្ឋារចនាសម្ព័ន្ធរួម ➜
        // sandbox ត្រូវផ្ទុក **function ពិត** ដូចគ្នានឹងច្រកទ្វារនាឡិកាខាងក្រោម។
        extractConst(src, 'DB_OP_TIMEOUT_MS'),
        extractFn(src, 'withTimeout'),
        extractFn(src, 'dbOp'),
        extractFn(src, 'dbOpStalled'),
        // ⛔ សារវឌ្ឍនភាពនៃការសរសេរធុងសំរាមជាហេដ្ឋារចនាសម្ព័ន្ធរួមដែរ ➜ sandbox
        // ត្រូវផ្ទុក function ពិត; លើ tree មុនកែ វាអវត្តមាន ➜ stub (កុំបញ្ឈប់ checker)។
        optionalPart(() => extractConst(src, 'TRASH_WRITE_SLOW_NOTICE_MS'), 'const TRASH_WRITE_SLOW_NOTICE_MS = 15000;'),
        optionalPart(() => extractFn(src, 'notifyIfSlow'), 'function notifyIfSlow(p) { return p; }'),
        // ⛔ `settleLockWithin` ដោះសោការសម្អាតតាមពិដាន ដោយ **មិនបោះបង់ការងារ** ➜
        // sandbox ត្រូវផ្ទុក function ពិត; លើ tree មុនកែវាអវត្តមាន ➜ stub ដែល
        // **រក្សាឥរិយាបថដើម** (រង់ចាំពេញ · បញ្ជូនតម្លៃត្រឡប់)។
        optionalPart(() => extractConst(src, 'LOCK_STALL_RELEASE_MS'), 'const LOCK_STALL_RELEASE_MS = 15000;'),
        optionalPart(() => extractFn(src, 'settleLockWithin'), 'function settleLockWithin(p) { return Promise.resolve(p); }'),
        // ⛔ `runAutomaticCleanupRules()` មានច្រកទ្វារនាឡិកា (2.20.5) ➜ sandbox
        // ត្រូវផ្ទុក **function ពិត** បូក `serverClockTrusted = true` ដែលជា
        // ស្ថានភាពធម្មតារបស់ App ដែលភ្ជាប់រួច។ ការចាក់ `() => true` ដោយដៃ
        // នឹងលាក់ការដកច្រកទ្វារនោះចេញ ➜ បៃតងក្លែងក្លាយ។
        'let serverClockTrusted = true, isDatabaseConnected = true;',
        // ⛔ journal នៃការសម្អាត (2.37.2) ៖ វាធានាថាការរំខានពាក់កណ្តាលមិន
        //    លុបកញ្ចប់ ➜ sandbox ត្រូវផ្ទុក **function ពិត**; លើ tree មុនកែ
        //    វាអវត្តមាន ➜ stub (កុំបញ្ឈប់ checker)។
        optionalPart(() => extractConst(src, 'CLEANUP_JOURNAL_KEY'), "const CLEANUP_JOURNAL_KEY = 'zoew_cleanup_journal_v1';"),
        optionalPart(() => extractConst(src, 'CLEANUP_JOURNAL_MAX'), 'const CLEANUP_JOURNAL_MAX = 200;'),
        optionalPart(() => extractConst(src, 'CLEANUP_STAGE_MOVED'), "const CLEANUP_STAGE_MOVED = 'moved';"),
        optionalPart(() => extractConst(src, 'CLEANUP_STAGE_LEDGER'), "const CLEANUP_STAGE_LEDGER = 'ledger';"),
        'const appLocalStore = (function () { const d = {}; return { getItem: (k) => (Object.prototype.hasOwnProperty.call(d, k) ? d[k] : null), setItem: (k, v) => { d[k] = String(v); }, removeItem: (k) => { delete d[k]; } }; })();',
        optionalPart(() => extractFn(src, 'safeStoreGet'), 'function safeStoreGet(store, key) { try { return store ? store.getItem(key) : null; } catch (e) { return null; } }'),
        optionalPart(() => extractFn(src, 'safeStoreSet'), 'function safeStoreSet(store, key, value) { try { return store ? (store.setItem(key, String(value)), true) : false; } catch (e) { return false; } }'),
        optionalPart(() => extractFn(src, 'safeStoreRemove'), 'function safeStoreRemove(store, key) { try { return store ? (store.removeItem(key), true) : false; } catch (e) { return false; } }'),
        optionalPart(() => extractFn(src, 'cleanupJournalScope'), "function cleanupJournalScope() { return ''; }"),
        optionalPart(() => extractFn(src, 'cleanupJournalScopeMismatch'), 'function cleanupJournalScopeMismatch() { return false; }'),
        optionalPart(() => extractFn(src, 'readCleanupJournal'), 'function readCleanupJournal() { return []; }'),
        optionalPart(() => extractFn(src, 'writeCleanupJournal'), 'function writeCleanupJournal() {}'),
        optionalPart(() => extractFn(src, 'noteCleanupJournalEntry'), 'function noteCleanupJournalEntry() {}'),
        optionalPart(() => extractFn(src, 'markCleanupJournalStage'), 'function markCleanupJournalStage() {}'),
        optionalPart(() => extractFn(src, 'clearCleanupJournalEntry'), 'function clearCleanupJournalEntry() {}'),
        extractFn(src, 'cleanupClockIsTrustworthy'),
        'const cleanupInFlight = new Set();',
        ...REAL_FNS.map((name) => extractFn(src, name)),
        'globalThis.runAutomaticCleanupRules = runAutomaticCleanupRules;',
        'globalThis.claimAndCleanupItem = claimAndCleanupItem;'
    ].join('\n\n');

    new vm.Script(code).runInContext(context);

    world.context = context;
    world.getPath = getPath;
    world.syncListener = () => {
        const raw = getPath('zoew_scan_history_cod_dod') || {};
        context.scanHistory.length = 0;
        Object.keys(raw).forEach((key) => context.scanHistory.push(clone(raw[key])));
        const trash = getPath('zoew_recently_deleted_cod_dod') || {};
        context.deletedItems.length = 0;
        Object.keys(trash).forEach((key) => context.deletedItems.push(clone(trash[key])));
    };
    world.tick = async (at) => {
        world.now = at;
        world.syncListener();
        context.runAutomaticCleanupRules();
        for (let i = 0; i < 20; i++) await new Promise((resolve) => setTimeout(resolve, 0));
        world.syncListener();
    };
    world.syncListener();
    return world;
}

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const T0 = 1750000000000;

function bc(code, cod, dod, closed) {
    return { code, cod, dod, locker: 'N/A', time: 't', isClosed: !!closed, isDeducted: false, isFromDeletion: false, createdAt: T0 };
}

function parcel(id, barcodes, extra) {
    return Object.assign({
        id,
        phone: '012345678',
        scanDate: '2026-08-19',
        createdAt: T0,
        barcodes,
        count: barcodes.length,
        cod: barcodes.reduce((s, b) => s + b.cod, 0),
        dod: barcodes.reduce((s, b) => s + b.dod, 0),
        price: barcodes.reduce((s, b) => s + b.cod + b.dod, 0),
        barcode: barcodes[0].code,
        isClosed: barcodes.every((b) => b.isClosed),
        isCalled: false
    }, extra || {});
}

const revenueTotal = (log) => ({
    cod: Math.round(log.reduce((s, r) => s + r.cod, 0) * 100) / 100,
    dod: Math.round(log.reduce((s, r) => s + r.dod, 0) * 100) / 100,
    count: log.reduce((s, r) => s + r.count, 0)
});

async function scenarioMixedParcel() {
    console.log('\nសេណារីយ៉ូ ១ — លេខទូរស័ព្ទ ១ មាន barcode ២៖ A យករួច (បិទម៉ោង T+1h) · B មិនទាន់យក');

    const A = Object.assign(bc('AAA111', 10, 0, true), { closedAt: T0 + HOUR });
    const B = bc('BBB222', 0, 25, false);
    const seed = { id_mix: parcel('id_mix', [A, B], { isClosed: false }) };
    const world = buildWorld(seed, T0);

    await world.tick(T0 + 2 * HOUR);
    let live = world.getPath('zoew_scan_history_cod_dod/id_mix');
    let trash = world.getPath('zoew_recently_deleted_cod_dod') || {};
    check(!!live && live.barcodes.length === 2, 'A បិទបាន ១ ម៉ោង ➜ មិនទាន់គ្រប់ ២ ម៉ោង ➜ នៅដដែល', JSON.stringify(live && live.barcodes.map(b => b.code)));
    check(Object.keys(trash).length === 0, 'មិនទាន់គ្រប់ ២ ម៉ោង ➜ គ្មានអ្វីចូលធុងសំរាម');

    await world.tick(T0 + 3 * HOUR + 60000);
    live = world.getPath('zoew_scan_history_cod_dod/id_mix');
    trash = world.getPath('zoew_recently_deleted_cod_dod') || {};
    const trashIds = Object.keys(trash);

    check(trashIds.length === 1, '⛔ ស្នូល៖ A គ្រប់ ២ ម៉ោង ➜ ចូលធុងសំរាមភ្លាម ទោះ B នៅបើក', 'ឃើញ ' + trashIds.length + ' ធាតុ');
    const pickupItem = trash[trashIds[0]];
    const pickedCodes = pickupItem ? pickupItem.barcodes.map((b) => b.code) : [];
    check(pickedCodes.length === 1 && pickedCodes[0] === 'AAA111', 'មានតែ A ចូលធុងសំរាម', JSON.stringify(pickedCodes));
    check(!!pickupItem && pickupItem.trashReason === 'pickup', 'A មានស្លាក trashReason = pickup (យករួច)', pickupItem && pickupItem.trashReason);
    check(!!pickupItem && pickupItem.isFromDeletion === true, 'A មាន isFromDeletion = true (ផ្លូវមិនប៉ះលុយ)');
    check(!!pickupItem && pickupItem.barcodes.every((b) => b.isDeducted !== true), '⛔ ស្នូល៖ A **មិន** isDeducted', JSON.stringify(pickupItem && pickupItem.barcodes));
    check(!!pickupItem && pickupItem.isClosed === true, 'A រក្សាស្ថានភាព «យករួច» ក្នុងធុងសំរាម');
    check(world.revenueLog.length === 0, '⛔ ស្នូល៖ ការផ្លាស់ A មិនប៉ះស្ថិតិចំណូលទាល់តែសោះ', JSON.stringify(world.revenueLog));

    check(!!live, 'កញ្ចប់នៅតែមានក្នុងប្រវត្តិសម្រាប់ B');
    const liveCodes = live ? live.barcodes.map((b) => b.code) : [];
    check(liveCodes.length === 1 && liveCodes[0] === 'BBB222', 'B នៅក្នុងប្រវត្តិដដែល', JSON.stringify(liveCodes));
    check(!!live && live.isClosed === false && live.closedAt === undefined, 'កញ្ចប់ដែលនៅសល់មិនត្រូវរាប់ថាបិទ');
    check(!!live && live.cod === 0 && live.dod === 25 && live.count === 1, 'តម្លៃកញ្ចប់ដែលនៅសល់គិតតែ B', JSON.stringify(live && { cod: live.cod, dod: live.dod, count: live.count }));
    check(!!live && live.createdAt === T0, 'នាឡិកា ៨ ថ្ងៃរបស់ B មិនត្រូវ reset');

    await world.tick(T0 + 7 * DAY + 60000);
    live = world.getPath('zoew_scan_history_cod_dod/id_mix');
    trash = world.getPath('zoew_recently_deleted_cod_dod') || {};
    const expiredItem = trash.id_mix;

    check(!live, 'ដល់ថ្ងៃទី ៨៖ B ចេញពីប្រវត្តិ');
    check(!!expiredItem && expiredItem.trashReason === 'expired', 'B មានស្លាក expired', expiredItem && expiredItem.trashReason);
    check(!!expiredItem && expiredItem.barcodes.every((b) => b.isDeducted === true), 'B ត្រូវ isDeducted');
    const total = revenueTotal(world.revenueLog);
    check(total.cod === 0 && total.dod === -25 && total.count === -1,
        '⛔ ស្នូល៖ ដកតែ B ($25 dod, ១ កញ្ចប់) — លុយរបស់ A នៅគ្រប់', JSON.stringify(total));
    check(world.reconcileLog.length === 1 && world.reconcileLog[0].dod === -25 && world.reconcileLog[0].count === -1,
        'trash commit ជោគជ័យ ➜ reconcile តែ delta របស់ B ម្តងគត់', JSON.stringify(world.reconcileLog));
}

async function scenarioLegacyStamp() {
    console.log('\nសេណារីយ៉ូ ៥ — barcode ចាស់ដែលបិទរួច តែគ្មាន closedAt (ទិន្នន័យមុនកំណែ 2.17.2)');

    const A = bc('OLD111', 10, 0, true);
    delete A.closedAt;
    const seed = { id_old: parcel('id_old', [A, bc('OLD222', 0, 25, false)], { isClosed: false }) };
    const world = buildWorld(seed, T0);

    await world.tick(T0 + 5 * HOUR);
    let live = world.getPath('zoew_scan_history_cod_dod/id_old');
    let trash = world.getPath('zoew_recently_deleted_cod_dod') || {};
    const stamped = live && live.barcodes.find((b) => b.code === 'OLD111');
    check(!!stamped && stamped.closedAt === T0 + 5 * HOUR, 'ជុំដំបូង៖ បោះត្រា closedAt = ឥឡូវ (មិនលុបភ្លាម)', stamped && String(stamped.closedAt));
    check(Object.keys(trash).length === 0, 'ជុំដំបូង៖ មិនទាន់ចូលធុងសំរាម (ទុកបង្អួច ២ ម៉ោងពេញ)');

    await world.tick(T0 + 7 * HOUR + 60000);
    live = world.getPath('zoew_scan_history_cod_dod/id_old');
    trash = world.getPath('zoew_recently_deleted_cod_dod') || {};
    check(Object.keys(trash).length === 1, '២ ម៉ោងក្រោយត្រា ➜ ចូលធុងសំរាម');
    const t = trash[Object.keys(trash)[0]];
    check(!!t && t.trashReason === 'pickup' && t.barcodes.map((b) => b.code).join() === 'OLD111', 'ស្លាក pickup សម្រាប់ barcode ចាស់', t && t.trashReason);
    check(world.revenueLog.length === 0, 'មិនប៉ះស្ថិតិចំណូល');
    check(!!live && live.barcodes.length === 1 && live.barcodes[0].code === 'OLD222', 'barcode ដែលមិនទាន់យកនៅដដែល');
}

async function scenarioAllOpen() {
    console.log('\nសេណារីយ៉ូ ២ — កញ្ចប់ barcode ២ ដែល **គ្មាន** មួយណាយករួច (ការគ្រប់គ្រង)');
    const seed = { id_open: parcel('id_open', [bc('OPEN1', 10, 0, false), bc('OPEN2', 0, 25, false)], { isClosed: false }) };
    const world = buildWorld(seed, T0);
    await world.tick(T0 + 7 * DAY);
    check(!!world.getPath('zoew_scan_history_cod_dod/id_open'),
        'ព្រំដែន៖ គ្រប់ ៧×២៤ ម៉ោងពេញ មិនទាន់លើស ៧ថ្ងៃ ➜ មិនដក');
    check(Object.keys(world.getPath('zoew_recently_deleted_cod_dod') || {}).length === 0,
        'ព្រំដែន៖ នៅ ៧ថ្ងៃគត់ ធុងសំរាមនៅទទេ');
    await world.tick(T0 + 7 * DAY + 60000);

    const live = world.getPath('zoew_scan_history_cod_dod/id_open');
    const trash = world.getPath('zoew_recently_deleted_cod_dod') || {};
    check(!live, 'កញ្ចប់ដែលបើកទាំងស្រុងត្រូវផ្លាស់ចេញទាំងមូល');
    check(!!trash.id_open && trash.id_open.trashReason === 'expired', 'ស្លាក expired សម្រាប់កញ្ចប់ទាំងមូល');
    check(!!trash.id_open && trash.id_open.barcodes.length === 2 && trash.id_open.barcodes.every((b) => b.isDeducted === true),
        'barcode ទាំង ២ ត្រូវ isDeducted');
    const total = revenueTotal(world.revenueLog);
    check(total.cod === -10 && total.dod === -25 && total.count === -2,
        'ដកចំណូលពេញ (cod -10 · dod -25 · count -2)', JSON.stringify(total));
    check(world.reconcileLog.length === 1 && world.reconcileLog[0].cod === -10 && world.reconcileLog[0].count === -2,
        'auto-abandon ទាំងមូល reconcile ledger ម្តងគត់', JSON.stringify(world.reconcileLog));
}

async function scenarioAllClosed() {
    console.log('\nសេណារីយ៉ូ ៣ — កញ្ចប់ barcode ២ ដែលយករួចទាំង ២ (ការគ្រប់គ្រង)');
    const seed = {
        id_done: parcel('id_done', [bc('DONE1', 10, 0, true), bc('DONE2', 0, 25, true)], { isClosed: true, closedAt: T0 + HOUR })
    };
    const world = buildWorld(seed, T0);
    await world.tick(T0 + HOUR + 2 * HOUR + 60000);

    const live = world.getPath('zoew_scan_history_cod_dod/id_done');
    const trash = world.getPath('zoew_recently_deleted_cod_dod') || {};
    check(!live, 'កញ្ចប់ដែលយករួចទាំងស្រុងចូលធុងសំរាមក្រោយ ២ ម៉ោង');
    check(!!trash.id_done && trash.id_done.trashReason === 'pickup', 'ស្លាក pickup');
    check(world.revenueLog.length === 0, 'ការយករួច មិនប៉ះស្ថិតិចំណូល');
}

async function scenarioLatePickup() {
    console.log('\nសេណារីយ៉ូ ៤ — យក barcode មួយ **ក្រោយ** ថ្ងៃទី ៨ (ការគ្រប់គ្រង)');
    const seed = { id_late: parcel('id_late', [bc('LATE1', 10, 0, false), bc('LATE2', 0, 25, false)], { isClosed: false }) };
    const world = buildWorld(seed, T0);
    await world.tick(T0 + 7 * DAY + 60000);
    const trash = world.getPath('zoew_recently_deleted_cod_dod') || {};
    check(!!trash.id_late && trash.id_late.barcodes.length === 2,
        'ការមិនទាន់យកទាល់តែសោះ ➜ ទាំង ២ ផុតកំណត់ (គោលការណ៍ ៨ ថ្ងៃ)');
}


async function scenarioReopenAndIdle() {
    console.log('\nសេណារីយ៉ូ ៦ — ត្រាចាស់លើ barcode ដែលបើកវិញ · និងជុំទំនេរមិនត្រូវសរសេរ');

    const reopened = bc('REO111', 10, 0, false);
    reopened.closedAt = T0 + HOUR;
    const seed = { id_reo: parcel('id_reo', [reopened, bc('REO222', 0, 25, false)], { isClosed: false }) };
    const world = buildWorld(seed, T0);

    await world.tick(T0 + 6 * HOUR);
    let live = world.getPath('zoew_scan_history_cod_dod/id_reo');
    let trash = world.getPath('zoew_recently_deleted_cod_dod') || {};
    const cleaned = live && live.barcodes.find((b) => b.code === 'REO111');
    check(Object.keys(trash).length === 0, '⛔ barcode ដែលបើកវិញ ត្រាចាស់ក៏មិនត្រូវលុបដែរ');
    check(!!cleaned && cleaned.isClosed === false, 'វានៅបើកដដែល — `barcodeCloseIsRipe` ទាមទារ `isClosed` ជាមុន');
    check(typeof world.context.applyBarcodeCloseState === 'function'
        && world.context.applyBarcodeCloseState({ isClosed: true, closedAt: 5 }, false).closedAt === undefined,
        'applyBarcodeCloseState(b, false) លុបត្រាចេញ — នេះជាការការពារពិតពេលបើកវិញ');
    check(!!world.context.applyBarcodeCloseState
        && world.context.applyBarcodeCloseState({}, true, 42).closedAt === 42,
        'applyBarcodeCloseState(b, true, at) បោះត្រាតាមម៉ោងដែលឲ្យ');

    const fresh = bc('FRESH1', 5, 0, true);
    fresh.closedAt = T0 + 6 * HOUR;
    world.store.zoew_scan_history_cod_dod.id_fresh = clone(parcel('id_fresh', [fresh], { isClosed: true, closedAt: T0 + 6 * HOUR }));
    world.syncListener();

    const before = { calls: world.transactionCalls, commits: world.commits };
    world.now = T0 + 6 * HOUR + 60000;
    await world.context.claimAndCleanupItem('id_fresh', 'close');
    for (let i = 0; i < 20; i++) await new Promise((resolve) => setTimeout(resolve, 0));
    check(world.transactionCalls > before.calls, 'ការហៅដោយស្ថានភាពចាស់ ពិតជាចូល transaction មែន');
    check(world.commits === before.commits,
        '⛔ transaction ដែលគ្មានអ្វីត្រូវធ្វើ ត្រូវ **បោះបង់** មិនមែនសរសេរជាន់', 'commits ' + before.commits + ' ➜ ' + world.commits);
    check(!!world.getPath('zoew_scan_history_cod_dod/id_fresh'), 'កញ្ចប់ដែលទើបបិទ នៅដដែល');
}


async function scenarioFreshPickupAtDeadline() {
    console.log('\nសេណារីយ៉ូ ៧ — យក barcode មួយ **មុនថ្ងៃទី ៨ បន្តិច** (មិនទាន់គ្រប់ ២ ម៉ោង)');

    const A = Object.assign(bc('DL111', 10, 0, true), { closedAt: T0 + 7 * DAY - HOUR });
    const seed = { id_dl: parcel('id_dl', [A, bc('DL222', 0, 25, false)], { isClosed: false }) };
    const world = buildWorld(seed, T0);

    await world.tick(T0 + 7 * DAY + 60000);
    const live = world.getPath('zoew_scan_history_cod_dod/id_dl');
    const trash = world.getPath('zoew_recently_deleted_cod_dod') || {};
    const ids = Object.keys(trash);

    check(ids.length === 1, 'ថ្ងៃទី ៨ ➜ មានធាតុ ១ ចូលធុងសំរាម', 'ឃើញ ' + ids.length);
    const expired = trash[ids[0]];
    check(!!expired && expired.barcodes.map((b) => b.code).join() === 'DL222',
        '⛔ ស្នូល៖ មានតែ barcode ដែលមិនទាន់យក (DL222) ធ្លាក់ជា expired', JSON.stringify(expired && expired.barcodes.map((b) => b.code)));
    check(!!expired && expired.trashReason === 'expired' && expired.barcodes.every((b) => b.isDeducted === true), 'DL222 ត្រូវ isDeducted');
    check(!!live && live.barcodes.map((b) => b.code).join() === 'DL111',
        '⛔ ស្នូល៖ DL111 ដែលទើបយករួច នៅក្នុងប្រវត្តិ មិនត្រូវផុតកំណត់តាមវា', JSON.stringify(live && live.barcodes.map((b) => b.code)));
    check(!!live && live.barcodes.every((b) => b.isDeducted !== true), '⛔ ស្នូល៖ DL111 **មិនត្រូវ** isDeducted');
    const total = revenueTotal(world.revenueLog);
    check(total.cod === 0 && total.dod === -25 && total.count === -1,
        '⛔ ស្នូល៖ ដកតែតម្លៃ DL222 — លុយរបស់ DL111 នៅគ្រប់', JSON.stringify(total));

    await world.tick(T0 + 7 * DAY + HOUR + 2 * HOUR);
    const after = world.getPath('zoew_scan_history_cod_dod/id_dl');
    const trashAfter = world.getPath('zoew_recently_deleted_cod_dod') || {};
    check(!after, 'DL111 ចេញ ២ ម៉ោងក្រោយម៉ោងបិទរបស់វា');
    check(!!trashAfter.id_dl && trashAfter.id_dl.trashReason === 'pickup', 'DL111 ចូលធុងសំរាមជា pickup', trashAfter.id_dl && trashAfter.id_dl.trashReason);
    check(revenueTotal(world.revenueLog).dod === -25, 'ស្ថិតិចំណូលមិនប្រែទៀតទេ');
}

(async () => {
    console.log('partial-pickup-cleanup-test — ការសម្អាតស្វ័យប្រវត្តិលើកញ្ចប់ដែលយករួចខ្លះ');
    console.log('App: ' + APP);
    await scenarioMixedParcel();
    await scenarioAllOpen();
    await scenarioAllClosed();
    await scenarioLatePickup();
    await scenarioLegacyStamp();
    await scenarioReopenAndIdle();
    await scenarioFreshPickupAtDeadline();
    console.log('\n' + pass + ' ok, ' + fail + ' fail');
    process.exit(fail ? 1 : 0);
})().catch((err) => {
    console.error(err);
    process.exit(1);
});
