const fs = require('fs');
const path = require('path');
const vm = require('vm');
const unexpectedErrors = [];
const auditConsole = { ...console, error: (...args) => unexpectedErrors.push(args.map(String).join(' ')) };

// ⛔ **stub ledger ត្រូវស៊ីនឹងកិច្ចសន្យាពិត។** `addRevenueToDailyAndMonthlyRecord()`
// ពិត clamp ត្រឹម 0 ហើយ **ត្រឡប់ delta ដែលអនុវត្តពិត** ដែល
// `revertRevenueLedgerDelta()` ត្រូវការ។ stub ដែលត្រឡប់ `undefined` ឬលទ្ធផល
// របស់ `.push()` (ជា *លេខ*) ធ្វើឲ្យផ្លូវដកវិញក្លាយជា **no-op ស្ងាត់** ➜
// checker បៃតងខណៈវាមើលមិនឃើញការដកវិញសោះ (វាស់បាន 2026-09-03)។
// ជាគូ ៖ ការអនុវត្ត និងការដកវិញត្រូវចែក ledger **តែមួយ** បើមិនដូច្នេះ
// ការដកវិញមិនប៉ះអ្វីដែលការអនុវត្តបានធ្វើទេ ➜ ការវាស់ក្លាយជាការក្លែង។
function ledgerStubEntries(onEntry) {
    const s = makeLedgerStub(onEntry);
    return {
        addRevenueToDailyAndMonthlyRecord: s.add,
        revertRevenueLedgerDelta: s.revert
    };
}

function makeLedgerStub(onEntry) {
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
    return { add: add, revert: revert, addPickup: addPickup, revertPickup: revertPickup, buckets: buckets };
}


const ROOT = process.env.MARKER_APP_DIR ? path.resolve(process.env.MARKER_APP_DIR) : path.join(__dirname, '..');
const APP = path.join(ROOT, 'ZoeW', 'app.js');

let pass = 0, fail = 0;
function check(cond, label, detail) {
    if (cond) { pass++; console.log('  ok    ' + label); }
    else { fail++; console.log('  FAIL  ' + label + (detail ? '\n        ' + detail : '')); }
}
const clone = (v) => v === undefined ? undefined : JSON.parse(JSON.stringify(v));

function sliceBalanced(src, from) {
    let depth = 0;
    for (let i = from; i < src.length; i++) {
        if (src[i] === '{') depth++;
        else if (src[i] === '}') { depth--; if (depth === 0) return src.slice(from, i + 1); }
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
// ⚠️ អន្ទាក់៖ តេស្តដែលធ្លាក់ដោយ `ReferenceError` លើ tree មុនកែ **មិនបញ្ជាក់អ្វីទេ**
// — វាមើលទៅដូចកំហុសផលិតផល។ ដូច្នេះ function ដែលមានតែក្នុងកំណែមួយ ត្រូវស្រង់
// ដោយអត់ធ្មត់ ហើយ **ឥរិយាបថ** ទើបជាអ្វីដែលតេស្តអះអាង។
function extractFnOptional(src, name) {
    try { return extractFn(src, name); } catch (e) { return null; }
}

function extractConst(src, name) {
    const m = new RegExp('\\n\\s*const ' + name + ' = ([^;]+);').exec(src);
    if (!m) throw new Error('const not found: ' + name);
    return 'const ' + name + ' = ' + m[1] + ';';
}

const src = fs.readFileSync(APP, 'utf8').replace(/\r\n?/g, '\n');

const FNS = ['barcodeEntriesOf', 'normalizeBarcodesOf', 'stripHistoryOnlyMarkers', 'itemHasRestoreMarkers', 'dropStaleRestoreMarkers',
    'applyBarcodeCloseState', 'barcodeCloseIsRipe', 'barcodeAbandonIsRipe', 'barcodeAbandonBasis', 'itemAbandonRipeAt', 'normalizeBarcodeCloseStamps', 'parseTimestampFromId',
    'generateUniqueId', 'retryAsync', 'cloneRestoreItem', 'isActiveRestoreClaim',
    'saveSingleDeletedItemToFirebase', 'restoreClaimedItemToScanHistory', 'clearStaleRestoreMarkers',
    'releaseStaleRestoreClaimForPurge', 'cleanupTrashCodes', 'cleanupLedgerDeducted', 'markCleanupTrashDeducted', 'cleanupBarcodesBackInHistory', 'applyCleanupRevenue', 'settleCleanupDeduction', 'resolveCleanupSlot', 'claimAndCleanupItem', 'runAutomaticCleanupRules',
    'collectItemBarcodes', 'trashRetentionMs', 'runAutomaticDeletedCleanup'];
// មានតែក្នុងកំណែថ្មី (2.18.0) ឬកំណែចាស់ — ស្រង់អ្វីដែលមាន
const OPTIONAL_FNS = ['purgeDeletedItemsQuietly', 'deleteMultipleDeletedItemsFromFirebase'];

function buildWorld(store, now) {
    const world = { store, now, revenueLog: [], commits: 0, writtenPaths: [], deniedPaths: [], releasedBarcodes: [] };
    const getPath = (raw) => {
        const parts = String(raw || '').split('/').filter(Boolean);
        let cur = store;
        for (const p of parts) { if (!cur || typeof cur !== 'object') return null; cur = cur[p]; }
        return cur === undefined ? null : cur;
    };
    const setPath = (raw, value) => {
        const parts = String(raw || '').split('/').filter(Boolean);
        let cur = store;
        for (let i = 0; i < parts.length - 1; i++) {
            if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
            cur = cur[parts[i]];
        }
        const key = parts[parts.length - 1];
        if (value === null) { delete cur[key]; return; }
        cur[key] = clone(value);
    };
    const fb = {
        ref: (db, raw) => ({ path: raw === undefined ? '' : String(raw) }),
        get: (ref) => { const v = getPath(ref.path); return Promise.resolve({ exists: () => v !== null, val: () => clone(v) }); },
        runTransaction: (ref, updater) => Promise.resolve().then(() => {
            const next = updater(clone(getPath(ref.path)));
            if (next === undefined) return { committed: false, snapshot: { val: () => clone(getPath(ref.path)) } };
            world.commits++; world.writtenPaths.push(ref.path);
            setPath(ref.path, next);
            return { committed: true, snapshot: { val: () => clone(getPath(ref.path)) } };
        }),
        update: (ref, updates) => Promise.resolve().then(() => {
            const entries = Object.entries(updates).map(([k, v]) => [[ref.path, k].filter(Boolean).join('/'), v]);
            const blocked = entries.find(([full, v]) => v === null
                && /^zoew_recently_deleted_cod_dod\/[^/]+$/.test(full)
                && getPath(full) && getPath(full).restoreClaim);
            if (blocked) {
                world.deniedPaths.push(blocked[0]);
                const err = new Error('PERMISSION_DENIED');
                err.code = 'PERMISSION_DENIED';
                throw err;
            }
            entries.forEach(([full, v]) => {
                world.commits++; world.writtenPaths.push(full);
                setPath(full, v);
            });
        })
    };
    const context = vm.createContext({
        console: auditConsole, setTimeout, clearTimeout, Promise, Math, Date, JSON, window: {},
        db: {}, fb,
        dbRefDeleted: fb.ref({}, 'zoew_recently_deleted_cod_dod'),
        dbRefHistory: fb.ref({}, 'zoew_scan_history_cod_dod'),
        getServerNow: () => world.now,
        getFormattedDate: () => '2026-08-26',
        ...ledgerStubEntries((d, cod, dod, count) => world.revenueLog.push({ d: d, cod: cod, dod: dod, count: count })),
        showToast: () => {},
        releaseBarcodesInRegistry: (codes) => { world.releasedBarcodes.push(...(codes || [])); return Promise.resolve(); },
        scanHistory: [], deletedItems: []
    });
    new vm.Script([
        extractConst(src, 'TWO_HOURS_MS'), extractConst(src, 'ABANDON_AGE_MS'), extractConst(src, 'RESTORE_CLAIM_LEASE_MS'), extractConst(src, 'EXPIRED_TRASH_RETENTION_MS'), extractConst(src, 'TRASH_RETENTION_MS'),
        // ⛔ ពិដានការហៅ Firebase (db-stall-guard) ជាហេដ្ឋារចនាសម្ព័ន្ធរួម ➜ function ពិត
        extractConst(src, 'DB_OP_TIMEOUT_MS'), extractFn(src, 'withTimeout'), extractFn(src, 'dbOp'), extractFn(src, 'dbOpStalled'),
        extractConst(src, 'LOCK_STALL_RELEASE_MS'), extractFn(src, 'settleLockWithin'),
        // ⛔ `runAutomaticCleanupRules()` មានច្រកទ្វារនាឡិកា (2.20.5) ➜ ផ្ទុក
        // function ពិត បូក `serverClockTrusted = true` (ស្ថានភាព App ភ្ជាប់រួច)។
        'let serverClockTrusted = true, isDatabaseConnected = true;', extractFn(src, 'cleanupClockIsTrustworthy'),
        'const cleanupInFlight = new Set();', 'const staleRestoreMarkerSweeps = new Set();', 'const dbListenerPendingPaths = new Set();',
        // ⛔ ទិដ្ឋភាព `deleted` មិនគួរទុកចិត្ត = «មិនទាន់មកដល់» **ឬ** «listener
        // ងាប់» (កំណែ 2.20.8) ➜ sandbox ត្រូវផ្ទុក **helper ពិត** បូក Set ទាំង ២។
        'const dbListenerFailedPaths = new Set();',
        'const dbListenerReportedFailures = new Set();',
        extractFnOptional(src, 'dbListenerViewIsStale')
            || 'function dbListenerViewIsStale(k) { return dbListenerPendingPaths.has(k); }',
        // ⛔ កូនសោដែលការការពារ marker សួរ — ត្រូវជាកូនសោ **ដដែល** ដែល
        // `initDatabaseListeners()` ដាក់ចូល Set (មើល `listener-pending-key-test.js`)។
        "const DB_LISTENER_KEY_DELETED = 'deleted';", 'const activeRestoreClaims = new Map();',
        'let deletedCleanupInFlight = false;',
        ...FNS.map((n) => extractFn(src, n)),
        ...OPTIONAL_FNS.map((n) => extractFnOptional(src, n)).filter(Boolean),
        'globalThis.api = { runAutomaticCleanupRules, claimAndCleanupItem, clearStaleRestoreMarkers, releaseStaleRestoreClaimForPurge, stripHistoryOnlyMarkers, itemHasRestoreMarkers, runAutomaticDeletedCleanup };'
    ].join('\n\n')).runInContext(context);
    world.context = context;
    world.getPath = getPath;
    world.sync = () => {
        const h = getPath('zoew_scan_history_cod_dod') || {};
        context.scanHistory.length = 0;
        Object.keys(h).forEach((k) => context.scanHistory.push(clone(h[k])));
        const t = getPath('zoew_recently_deleted_cod_dod') || {};
        context.deletedItems.length = 0;
        Object.keys(t).forEach((k) => context.deletedItems.push(clone(t[k])));
    };
    world.drain = async () => { for (let i = 0; i < 25; i++) await new Promise((r) => setTimeout(r, 0)); };
    world.sync();
    return world;
}

const T0 = 1750000000000;
const HOUR = 3600000;
const bcode = (code, closed, closedAt) => Object.assign(
    { code, cod: 1, dod: 0, locker: 'N/A', time: 't', isClosed: !!closed, isDeducted: false, isFromDeletion: false, createdAt: T0 },
    closed && closedAt !== undefined ? { closedAt } : {});
const parcel = (id, barcodes, extra) => Object.assign({
    id, phone: '098798880', scanDate: '2026-08-26', createdAt: T0, time: 't',
    barcodes, count: barcodes.length,
    cod: barcodes.reduce((s, b) => s + b.cod, 0), dod: 0,
    price: barcodes.reduce((s, b) => s + b.cod, 0),
    barcode: barcodes[0].code, isClosed: barcodes.every((b) => b.isClosed), isCalled: false
}, extra || {});

async function scenarioCleanupSkipsRestore() {
    console.log('\nសេណារីយ៉ូ ១ — ការសម្អាតស្វ័យប្រវត្តិមិនត្រូវប៉ះធាតុដែលកំពុងស្តារ');
    const item = parcel('id_a', [bcode('A1', true, T0)], { restoreClaimId: 'src_a', restoreClaimToken: 'tok_a' });
    const world = buildWorld({
        zoew_scan_history_cod_dod: { id_a: item },
        zoew_recently_deleted_cod_dod: { src_a: { id: 'src_a', restoreClaim: { token: 'tok_a', targetId: 'id_a', claimedAt: T0 + 5 * HOUR } } }
    }, T0 + 5 * HOUR);

    const before = world.commits;
    world.now = T0 + 5 * HOUR;
    world.sync();
    world.context.claimAndCleanupItem('id_a', 'close');
    await world.drain();
    const live = world.getPath('zoew_scan_history_cod_dod/id_a');
    check(world.commits === before, '⛔ ស្នូល៖ claimAndCleanupItem **មិនសរសេរអ្វីទាល់តែសោះ** លើធាតុដែលមាន marker ស្តារ', 'commits ' + before + ' ➜ ' + world.commits);
    check(!!live && live.restoreClaimId === 'src_a' && live.restoreClaimToken === 'tok_a', 'marker ស្តារនៅគ្រប់ — ការស្តារនៅតែបញ្ចប់បាន');
    check(!!live && live.barcodes.length === 1, 'barcode មិនត្រូវផ្លាស់ចេញ');
    check(Object.keys(world.getPath('zoew_recently_deleted_cod_dod') || {}).length === 1, 'គ្មានធាតុថ្មីចូលធុងសំរាម');
}

async function scenarioStaleMarkerSweep() {
    console.log('\nសេណារីយ៉ូ ២ — marker ស្តារដែលងាប់ ត្រូវបោសចោលឲ្យធាតុប្រើការវិញ');
    const world = buildWorld({
        zoew_scan_history_cod_dod: {
            id_live: parcel('id_live', [bcode('L1', true, T0)], { restoreClaimId: 'src_live', restoreClaimToken: 'tok_live' }),
            id_dead: parcel('id_dead', [bcode('D1', true, T0)], { restoreClaimId: 'src_dead', restoreClaimToken: 'tok_dead' }),
            id_orphan: parcel('id_orphan', [bcode('O1', true, T0)], { restoreClaimId: 'gone', restoreClaimToken: 'tok_gone' })
        },
        zoew_recently_deleted_cod_dod: {
            src_live: { id: 'src_live', restoreClaim: { token: 'tok_live', targetId: 'id_live', claimedAt: T0 + 5 * HOUR } },
            src_dead: { id: 'src_dead', restoreClaim: { token: 'tok_dead', targetId: 'id_dead', claimedAt: T0 } }
        }
    }, T0 + 5 * HOUR);

    world.sync();
    world.context.runAutomaticCleanupRules();
    await world.drain();

    const live = world.getPath('zoew_scan_history_cod_dod/id_live');
    const dead = world.getPath('zoew_scan_history_cod_dod/id_dead');
    const orphan = world.getPath('zoew_scan_history_cod_dod/id_orphan');
    check(!!live && live.restoreClaimId === 'src_live', 'ការស្តារដែលនៅរស់ (claim ក្នុង lease) **មិនត្រូវប៉ះ**');
    check(!!dead && dead.restoreClaimId === undefined && dead.restoreClaimToken === undefined,
        '⛔ ស្នូល៖ marker ដែលងាប់ (claim ហួស lease) ត្រូវបោសចោល', JSON.stringify(dead && { id: dead.restoreClaimId, tok: dead.restoreClaimToken }));
    check(!!orphan && orphan.restoreClaimId === undefined,
        '⛔ ស្នូល៖ marker ដែលធុងសំរាមរបស់វាបាត់ ក៏ត្រូវបោសចោលដែរ');
}

async function scenarioTrashNeverCarriesMarkers() {
    console.log('\nសេណារីយ៉ូ ៣ — ធាតុដែលចូលធុងសំរាមមិនត្រូវផ្ទុក marker របស់ scan_history');
    const world = buildWorld({
        zoew_scan_history_cod_dod: {
            id_p: parcel('id_p', [bcode('P1', true, T0), bcode('P2', false)], {})
        },
        zoew_recently_deleted_cod_dod: {}
    }, T0 + 5 * HOUR);

    const poisoned = world.getPath('zoew_scan_history_cod_dod/id_p');
    poisoned.restoreClaimId = 'ghost';
    poisoned.restoreClaimToken = 'ghost_tok';
    world.store.zoew_scan_history_cod_dod.id_p = poisoned;

    const stripped = world.context.stripHistoryOnlyMarkers({ ...poisoned, deletedAt: 1, trashReason: 'remove' });
    check(stripped.restoreClaimId === undefined && stripped.restoreClaimToken === undefined && stripped.clearClaim === undefined && stripped.restoreClaim === undefined,
        '⛔ ស្នូល៖ stripHistoryOnlyMarkers លុប marker ទាំង ៤', JSON.stringify(Object.keys(stripped).filter((k) => /Claim/.test(k))));

    const rules = JSON.parse(fs.readFileSync(path.join(ROOT, 'firebase-database.rules.json'), 'utf8')).rules;
    const trashSchema = rules.zoew_recently_deleted_cod_dod.$itemId;
    check(trashSchema.$other && trashSchema.$other['.validate'] === false, 'rules ធុងសំរាមបិទវាលចម្លែក ($other false)');
    ['restoreClaimId', 'restoreClaimToken', 'clearClaim'].forEach((f) => {
        check(!trashSchema[f], `rules ធុងសំរាម **មិនទទួល** '${f}' ➜ ការមិនលុបវា = permission_denied`);
    });

    const paths = [
        ['deleteSingleItem', 'const removed = stripHistoryOnlyMarkers({ ...claimedWhole, id });'],
        ['removeSingleBarcode', 'const itemToTrash = stripHistoryOnlyMarkers({ ...claimedParent, barcodes: [removedBc], count: 1 });'],
        ['claimAndCleanupItem', 'stripHistoryOnlyMarkers(trashItem);'],
        ['buildClearHistoryTrashItem', 'stripHistoryOnlyMarkers(trashItem);']
    ];
    paths.forEach(([fn, needle]) => {
        check(extractFn(src, fn).includes(needle), `ផ្លូវ '${fn}' លុប marker មុនសរសេរចូលធុងសំរាម`);
    });
}

async function scenarioPurgeReleasesDeadClaim() {
    console.log('\nសេណារីយ៉ូ ៤ — លុបជាអចិន្ត្រៃយ៍ត្រូវដោះ claim ដែលងាប់ជាមុន');
    const world = buildWorld({
        zoew_scan_history_cod_dod: {},
        zoew_recently_deleted_cod_dod: {
            t_dead: { id: 't_dead', restoreClaim: { token: 'x', targetId: 'y', claimedAt: T0 } },
            t_live: { id: 't_live', restoreClaim: { token: 'x', targetId: 'y', claimedAt: T0 + 5 * HOUR } },
            t_clean: { id: 't_clean' }
        }
    }, T0 + 5 * HOUR);
    world.sync();

    await world.context.releaseStaleRestoreClaimForPurge('t_dead');
    await world.context.releaseStaleRestoreClaimForPurge('t_live');
    const before = world.commits;
    await world.context.releaseStaleRestoreClaimForPurge('t_clean');

    check(!world.getPath('zoew_recently_deleted_cod_dod/t_dead').restoreClaim,
        '⛔ ស្នូល៖ claim ដែលងាប់ត្រូវដោះ ➜ ✖️ លុបបាន');
    check(!!world.getPath('zoew_recently_deleted_cod_dod/t_live').restoreClaim,
        'claim ដែលនៅរស់ **មិនត្រូវដោះ** (ឧបករណ៍ផ្សេងកំពុងស្តារ)');
    check(world.commits === before, 'ធាតុគ្មាន claim ➜ មិនសរសេរអ្វីទេ');
}

async function scenarioAutoPurgeReleasesDeadClaim() {
    console.log('\nសេណារីយ៉ូ ៥ — ការ purge ស្វ័យប្រវត្តិត្រូវដោះ claim ងាប់ មិនមែនរំលងវាជារៀងរហូត');
    // ថ្នាក់កំហុស៖ `runAutomaticDeletedCleanup()` ធ្លាប់សរសេរ
    // `if (!item || item.restoreClaim) return;` — រំលងធាតុណាដែលមាន `restoreClaim`
    // **ដោយមិនពិនិត្យថាវានៅរស់ឬអត់**។ `clearRestoreFinalization()` និងផ្លូវស្តារ
    // រត់ក្នុង `.catch(() => {})` ➜ បណ្តាញដាច់ ➜ claim នៅជាប់ ➜ ធាតុនោះ
    // **មិនដែលចេញពី Firebase សោះ** ហើយ barcode របស់វា **កក់ក្នុង
    // `zoew_barcode_registry` ជារៀងរហូត** ➜ barcode ដដែលស្កេនចូលមិនបានទៀត។
    // ការរំលងខ្លួនវា *ចាំបាច់* ព្រោះ rules បដិសេធការលុបខណៈ claim ជាប់ —
    // អ្វីដែលខ្វះគឺ **អ្នកដោះ claim ងាប់** ក្នុងផ្លូវស្វ័យប្រវត្តិ។
    const OLD = T0 - 40 * 24 * HOUR;
    const world = buildWorld({
        zoew_scan_history_cod_dod: {},
        zoew_recently_deleted_cod_dod: {
            t_dead: { id: 't_dead', deletedAt: OLD, barcodes: [{ code: 'DEAD1', cod: 1, dod: 0 }],
                restoreClaim: { token: 'x', targetId: 'y', claimedAt: OLD } },
            t_live: { id: 't_live', deletedAt: OLD, barcodes: [{ code: 'LIVE1', cod: 1, dod: 0 }],
                restoreClaim: { token: 'x', targetId: 'y', claimedAt: T0 - 30 * 1000 } },
            t_clean: { id: 't_clean', deletedAt: OLD, barcodes: [{ code: 'CLEAN1', cod: 1, dod: 0 }] },
            t_fresh: { id: 't_fresh', deletedAt: T0 - HOUR, barcodes: [{ code: 'FRESH1', cod: 1, dod: 0 }] }
        }
    }, T0);
    world.sync();

    await world.context.runAutomaticDeletedCleanup();
    await world.drain();
    const trash = world.getPath('zoew_recently_deleted_cod_dod') || {};

    check(!trash.t_clean, 'ធាតុចាស់ស្អាត ➜ purge ចេញ');
    check(!trash.t_dead, '⛔ ស្នូល៖ ធាតុចាស់ដែល claim ងាប់ ➜ ក៏ purge ចេញដែរ (មុនកែ ជាប់រហូត)');
    check(!!trash.t_live, 'claim ដែលនៅរស់ ➜ **មិនត្រូវប៉ះ** (ឧបករណ៍ផ្សេងកំពុងស្តារ)');
    check(!!trash.t_fresh, 'ធាតុដែលមិនទាន់ហួសរយៈពេលរក្សាទុក ➜ នៅដដែល');
    check(world.releasedBarcodes.indexOf('DEAD1') !== -1,
        '⛔ barcode របស់ធាតុនោះត្រូវដោះចេញពី registry (បើអត់ ➜ ស្កេនចូលមិនបានទៀត)');
    check(world.releasedBarcodes.indexOf('LIVE1') === -1 && world.releasedBarcodes.indexOf('FRESH1') === -1,
        'barcode របស់ធាតុដែលមិន purge ➜ មិនត្រូវដោះ');
    check(world.deniedPaths.length === 0,
        'គ្មានការសរសេរណាត្រូវ rules បដិសេធ (claim ដោះមុន purge)', world.deniedPaths);
}

(async () => {
    console.log('restore-marker-hygiene-test — marker ស្តារ ↔ schema ធុងសំរាម');
    console.log('App: ' + APP);
    await scenarioCleanupSkipsRestore();
    await scenarioStaleMarkerSweep();
    await scenarioTrashNeverCarriesMarkers();
    await scenarioPurgeReleasesDeadClaim();
    await scenarioAutoPurgeReleasesDeadClaim();
    check(unexpectedErrors.length === 0, 'fixture មិនលាក់ runtime error ដែលមិនបានរំពឹងទុក', unexpectedErrors);
    console.log('\n' + pass + ' ok, ' + fail + ' fail');
    process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
