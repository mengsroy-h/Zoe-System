// ⛔ ថ្នាក់កំហុស ៖ **`disconnect` ≠ «មិនបានអនុវត្ត»** ➜ transaction ដែល SDK បដិសេធដោយ `disconnect`
//    អាចបាន **ចុះលើ server រួចហើយ** ខណៈ App ចាត់ទុកថាបរាជ័យ។
//
// វាស់បាន (SDK Firebase 12.19 ពិត + RTDB emulator ពិត · proxy កាត់ការតភ្ជាប់ចំពេល server ឆ្លើយ `ok`) ៖
// `runTransaction` **បដិសេធ `disconnect`** ខណៈ server មាន 10 ➜ 7 (អនុវត្តរួច)។ ប្រភព SDK ៖
// «Since we don't know if our sent transactions succeeded or not, we need to cancel them.»
// Sentry ផលិតកម្ម ៖ ៧៧ event `disconnect` (zone money) លើ «Automatic cleanup transaction failed for» ពីឧបករណ៍ពិត។
//
// ផលពេល server អនុវត្ត តែ App ជឿថាបរាជ័យ ៖
//   · ការសម្អាត ៖ កញ្ចប់ចេញពីប្រវត្តិ តែ **មិនចូលធុងសំរាម** · «ផុតកំណត់» **មិនដកលុយ** (ចំណូលកើតពីអាកាសធាតុ)
//   · `correctRevenueLedgerToActual()` ៖ សាលក្រម `null` ➜ អនុវត្ត delta **ម្តងទៀត** ➜ **ដកលុយ ២ ដង**
//
// ⛔ ការកែជា **ចំណុចច្របាច់តែមួយ** ៖ `withTransactionOutcomeResolution()` រុំ `runTransaction` (ដំឡើងក្នុង
//    `initFirebase()`) ➜ `disconnect` ក្លាយជា «ការសរសេរយឺត» ដែលសម្រេចដោយការអាន server ពិត (REST) ៖
//    ស្មើតម្លៃដែលបានផ្ញើ ➜ `committed: true` · ស្មើតម្លៃមុន ➜ បដិសេធ (`txOutcome = 'not-applied'`) ·
//    ផ្សេងពីនោះ ➜ បដិសេធ (`'unknown'`) + Sentry ១ ដង។
'use strict';

process.exitCode = 1;

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { performance } = require('perf_hooks');

const ROOT = process.env.TXOUTCOME_APP_DIR ? path.resolve(process.env.TXOUTCOME_APP_DIR) : path.resolve(__dirname, '..');
const FILE = path.join(ROOT, 'ZoeW/app.js');

let pass = 0, fail = 0;
function ok(label, cond, detail) {
    if (cond) { pass++; console.log('  ok    ' + label); return; }
    fail++;
    console.log('  FAIL  ' + label + (detail !== undefined ? ' — ' + JSON.stringify(detail) : ''));
}

if (!fs.existsSync(FILE)) {
    console.log('  FAIL  រកមិនឃើញ ' + FILE);
    console.log('\n❌ ធ្លាក់ 1 / ok 0');
    return;
}
const SRC = fs.readFileSync(FILE, 'utf8');

function sliceFrom(src, name) {
    let start = src.indexOf('function ' + name + '(');
    if (start === -1) return '';
    if (src.slice(Math.max(0, start - 6), start) === 'async ') start -= 6;
    let depth = 0, i = src.indexOf('{', src.indexOf(')', start)), started = false;
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

const TX_FNS = ['transactionOutcomeUnknown', 'txCloneJson', 'txCanonical', 'txSameValue', 'txRestUrl',
    'txReadServerValue', 'txDelay', 'txReadWasRefused', 'txResolveOutcome', 'txPathKey', 'txResolvingBlockers', 'txTrackResolving',
    'txSnapshotOf', 'reportTxOutcomeUnknown',
    'runTransactionResolved', 'withTransactionOutcomeResolution'];
const TX_CONSTS = ['TX_OUTCOME_READ_TIMEOUT_MS', 'TX_OUTCOME_RETRY_GAP_MS', 'TX_OUTCOME_MAX_GAP_MS', 'TX_OUTCOME_MAX_REFUSALS', 'TX_OUTCOME_GATE_RELEASE_FAILS', 'txResolvingPaths',
    'txDisconnectResolving'];
const APP_FNS = ['appZoneParts', 'getZoneDateKey', 'getFormattedDate', 'elapsedSince', 'withTimeout', 'dbOp', 'dbOpStalled',
    'fetchWithTimeout',
    'safeStoreGet', 'safeStoreSet', 'safeStoreRemove',
    'barcodeEntriesOf', 'normalizeBarcodesOf', 'applyBarcodeCloseState', 'barcodeCloseIsRipe', 'barcodeAbandonIsRipe', 'barcodeAbandonBasis', 'itemAbandonRipeAt',
    'normalizeBarcodeCloseStamps', 'itemHasRestoreMarkers', 'stripHistoryOnlyMarkers', 'parseTimestampFromId',
    'generateUniqueId', 'retryAsync', 'cloneRestoreItem', 'saveSingleDeletedItemToFirebase', 'isActiveRestoreClaim',
    'recalcItemMoneyFromBarcodes', 'armLateCommit', 'notifyIfSlow', 'settleLockWithin',
    'ledgerNumber', 'ledgerZeroDelta', 'ledgerRejectionVerdict', 'ledgerMarkUnknown', 'ledgerServerVerdict', 'alignMonthlyLedgerToDaily', 'correctRevenueLedgerToActual',
    'ledgerDeltaWithClamp', 'ledgerAppliedDelta', 'revertLedgerRecordInMemory', 'ledgerMemoryCompensationClaimed',
    'applyLedgerBucketDelta', 'commitRevenueBucketDelta', 'commitDailyRevenueDelta', 'commitMonthlyRevenueDelta',
    'addRevenueToDailyAndMonthlyRecord', 'revertRevenueLedgerDelta', 'restoreClaimedItemToScanHistory', 'runLedgerTransaction',
    'noteCleanupJournalEntry', 'markCleanupJournalStage', 'clearCleanupJournalEntry',
    'readCleanupJournal', 'writeCleanupJournal', 'cleanupJournalScope', 'cleanupJournalScopeMismatch',
    'cleanupClaimAccountedElsewhere', 'claimCleanupTrashSlot', 'claimAndCleanupItem', 'removeSingleBarcode', 'ensureBarcodeArrayForItem', 'barcodeRegistryKey', 'claimBarcodeInRegistry'];
const APP_CONSTS = ['APP_TIME_ZONE', 'APP_TIME_ZONE_OFFSET_MINUTES', 'DB_OP_TIMEOUT_MS', 'TWO_HOURS_MS',
    'ABANDON_AGE_MS', 'TRASH_WRITE_SLOW_NOTICE_MS', 'LOCK_STALL_RELEASE_MS',
    'CLEANUP_JOURNAL_KEY', 'CLEANUP_JOURNAL_MAX', 'CLEANUP_STAGE_MOVED', 'CLEANUP_STAGE_LEDGER'];
const OPTIONAL = new Set(['cleanupClaimAccountedElsewhere', 'runLedgerTransaction']);

const DB_URL = 'https://zoe-test-default-rtdb.firebaseio.com';
const NOW = Date.UTC(2026, 8, 20, 6, 0, 0);
const DAY = '2026-09-10';
const MONTH = '2026-09';
const ITEM_ID = 'id_disc_probe';
const r2 = (n) => Math.round(n * 100) / 100;

const missing = [];

function makeRun(opts) {
    opts = opts || {};
    const server = {
        zoew_scan_history_cod_dod: {},
        zoew_recently_deleted_cod_dod: {},
        zoew_daily_revenue_cod_dod: { [DAY]: { codDollar: 100, dodDollar: 10, totalCount: 20 } },
        zoew_monthly_revenue_cod_dod: { [MONTH]: { codDollar: 100, dodDollar: 10, totalCount: 20 } },
        ledger: { day: { codDollar: 10 } }
    };
    const plan = opts.plan || [];
    const log = { tx: [], rest: [], captures: [], delays: [], restDown: !!opts.restDown, restRefuse: !!opts.restRefuse };
    const storage = {};
    const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
    function getPath(p) {
        let cur = server;
        for (const part of String(p).split('/').filter(Boolean)) {
            if (cur === null || cur === undefined || typeof cur !== 'object') return null;
            cur = cur[part];
        }
        return cur === undefined ? null : cur;
    }
    function setPath(p, v) {
        const parts = String(p).split('/').filter(Boolean);
        let cur = server;
        for (let i = 0; i < parts.length - 1; i++) {
            if (typeof cur[parts[i]] !== 'object' || cur[parts[i]] === null) cur[parts[i]] = {};
            cur = cur[parts[i]];
        }
        if (v === null || v === undefined) delete cur[parts[parts.length - 1]];
        else cur[parts[parts.length - 1]] = clone(v);
    }
    const makeRef = (p) => ({
        path: String(p),
        key: String(p).split('/').pop(),
        toString: opts.legacyRefs ? undefined : () => DB_URL + '/' + String(p).split('/').map(encodeURIComponent).join('/')
    });
    const raw = {
        ref: (_db, p) => makeRef(p === undefined ? '' : p),
        increment: (n) => ({ __inc: n }),
        runTransaction: (ref, fn) => {
            const mode = plan.length ? plan.shift() : 'ok';
            log.tx.push({ path: ref.path, mode, restSeen: log.rest.length });
            const cur = getPath(ref.path);
            // SDK ពិត ៖ path ដែលគ្មាន listener ➜ ការរត់ updater លើកទី ១ ឃើញ cache ទទេ (`null`) រួចផ្ញើ ➜ server
            // ឆ្លើយ `datastale` តែការតភ្ជាប់ដាច់មុន ➜ `disconnect` (updater មិនដែលរត់លើតម្លៃ server)
            const out = fn(mode === 'cold-disconnect' || cur === null ? null : clone(cur));
            if (mode === 'deny-op' && JSON.stringify(out === undefined ? null : out).indexOf('"op":') === -1) plan.unshift('ok');
            if (mode === 'denied') return Promise.reject(new Error('permission_denied'));
            if (out === undefined) return Promise.resolve({ committed: false, snapshot: { val: () => clone(getPath(ref.path)), exists: () => getPath(ref.path) !== null } });
            if (mode === 'lost-disconnect') return Promise.reject(new Error('disconnect'));
            if (mode === 'cold-disconnect') return Promise.reject(new Error('disconnect'));
            if (mode === 'deny-op' && JSON.stringify(out === undefined ? null : out).indexOf('"op":') !== -1) {
                return Promise.reject(new Error('permission_denied'));
            }
            if (mode === 'foreign-equal-disconnect') {
                // ឧបករណ៍ផ្សេងដកចំនួនដូចគ្នាពីមូលដ្ឋានដដែល (ការសរសេររបស់វាចុះមុន) ➜ ការសរសេររបស់យើងបាន `datastale`
                // តែការតភ្ជាប់ដាច់មុនចម្លើយ ➜ server មាន **តម្លៃដូចយើងបេះបិទ** តែជាការសរសេររបស់គេ (token `op` របស់គេ)
                const foreign = JSON.parse(JSON.stringify(out === undefined ? null : out), (k, v) => (k === 'op' ? 'op_foreign_device1' : v));
                setPath(ref.path, foreign);
                return Promise.reject(new Error('disconnect'));
            }
            if (mode === 'foreign-disconnect') {
                setPath(ref.path, Object.assign({}, cur || {}, { __foreign: 1 }));
                return Promise.reject(new Error('disconnect'));
            }
            setPath(ref.path, out);
            if (mode === 'applied-disconnect') return Promise.reject(new Error('disconnect'));
            return Promise.resolve({ committed: true, snapshot: { val: () => clone(getPath(ref.path)), exists: () => getPath(ref.path) !== null } });
        },
        update: (ref, obj) => {
            const base = (ref && ref.path) || '';
            Object.keys(obj || {}).forEach((k) => setPath(base ? base + '/' + k : k, obj[k]));
            return Promise.resolve();
        },
        set: (ref, value) => { setPath(ref.path, value); return Promise.resolve(); },
        get: (ref) => {
            const v = getPath(ref.path);
            return Promise.resolve({ exists: () => v !== null, val: () => clone(v) });
        }
    };
    const fetchFake = (url) => {
        const u = new URL(url);
        log.rest.push({ path: u.pathname, auth: u.searchParams.get('auth') });
        if (log.restDown) return Promise.reject(new TypeError('Failed to fetch'));
        if (log.restRefuse) return Promise.resolve({ ok: false, status: 403, json: () => Promise.resolve({ error: 'Permission denied' }) });
        const p = decodeURIComponent(u.pathname.replace(/\.json$/, '')).replace(/^\/+/, '');
        const body = clone(getPath(p));
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body === undefined ? null : body) });
    };
    const store = {
        getItem: (k) => (Object.prototype.hasOwnProperty.call(storage, k) ? storage[k] : null),
        setItem: (k, v) => { storage[k] = String(v); },
        removeItem: (k) => { delete storage[k]; }
    };
    const toasts = [];
    const box = {
        console: { log: () => {}, error: () => {}, warn: () => {} },
        Date, JSON, Math, Object, Set, Map, Array, String, Number, Boolean, Proxy, Reflect, URL, TypeError,
        parseFloat, parseInt, isNaN, isFinite, Promise, RegExp, Intl, Error, encodeURIComponent, decodeURIComponent,
        setTimeout: (fn, ms) => { if ((ms || 0) >= 1000) log.delays.push(ms); return setTimeout(fn, Math.max(Math.min(ms || 0, 5), opts.timerFloorMs || 0)); },
        clearTimeout: (id) => clearTimeout(id),
        AbortController,
        navigator: { onLine: true },
        fetch: fetchFake,
        resolveNativeApiUrl: (u) => u,
        nativeFunctionRequest: (u, o) => ({ url: u, options: o }),
        lookupState: { nativeQueryHeaderUnsupported: false },
        ZoeErrors: { capture: (e, extra) => log.captures.push({ message: String(e && e.message || e), context: extra && extra.context, zone: extra && extra.zone }) },
        db: {}, rawFb: raw,
        firebaseConfig: { databaseURL: DB_URL },
        auth: { currentUser: opts.noUser ? null : { getIdToken: () => Promise.resolve('tok-probe') } },
        appLocalStore: store, appSessionStore: store,
        dbRefDeleted: makeRef('zoew_recently_deleted_cod_dod'),
        dbRefHistory: makeRef('zoew_scan_history_cod_dod'),
        dbRefDailyRevenue: makeRef('zoew_daily_revenue_cod_dod'),
        dbRefMonthlyRevenue: makeRef('zoew_monthly_revenue_cod_dod'),
        getServerNow: () => NOW,
        showToast: (m) => { toasts.push(String(m)); },
        refreshCurrentHistoryView: () => {},
        releaseBarcodesInRegistry: () => Promise.resolve(),
        dbListenerViewIsStale: () => false,
        isDatabaseConnected: true,
        scanHistory: [], deletedItems: [], confirm: () => true, probeDatabaseLiveness: () => {}, closeModal: () => {}, viewListModalShowing: () => false,
        openViewListModal: () => {}, markCollectedRevenue: () => Promise.resolve(true), collectedMarksFor: () => [], clearScannedRemovalInFlight: () => {}, scanRemoveInFlight: null,
        dailyRevenueData: clone(server.zoew_daily_revenue_cod_dod),
        monthlyRevenueData: clone(server.zoew_monthly_revenue_cod_dod)
    };
    box.window = box;
    box.authGeneration = 0;
    const ctx = vm.createContext(box);
    const parts = [];
    TX_CONSTS.concat(APP_CONSTS).forEach((c) => { const s = sliceConst(SRC, c); if (s) parts.push(s); });
    parts.push('const txOutcomeUnknownReported = new Set();');
    parts.push('let serverClockTrusted = true, cleanupResumeInFlight = false;');
    parts.push('const cleanupInFlight = new Set();', 'const activeRestoreClaims = new Map();');
    TX_FNS.concat(APP_FNS).forEach((fn) => {
        const body = sliceFrom(SRC, fn);
        if (!body) {
            if (missing.indexOf(fn) === -1) missing.push(fn);
            if (fn === 'withTransactionOutcomeResolution') parts.push('function withTransactionOutcomeResolution(sdk) { return sdk; }');
            else if (fn === 'cleanupClaimAccountedElsewhere') parts.push('async function cleanupClaimAccountedElsewhere() { return "ours"; }');
            return;
        }
        parts.push(body);
    });
    parts.push('var fb = withTransactionOutcomeResolution(rawFb);');
    vm.runInContext(parts.join('\n\n'), ctx);
    return { ctx, box, server, log, storage, toasts, raw };
}

function settle(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

// ⛔ ម៉ាស៊ីនយឺតអាចមិនទាន់អាន ៣១ ដងក្នុង 500ms៖ រង់ចាំ state ពិត ហើយរក្សាពិដាន 5s ដើម្បីចាប់ការព្យួរ។
async function waitForState(ready) {
    const deadline = performance.now() + 5000;
    while (!ready() && performance.now() < deadline) await settle(5);
}

function runTx(run, p, updaterSrc) {
    run.box.__result = null;
    run.box.__error = null;
    vm.runInContext('fb.runTransaction(fb.ref(db, ' + JSON.stringify(p) + '), ' + updaterSrc + ')'
        + '.then((r) => { __result = { committed: r && r.committed, value: r && r.snapshot ? r.snapshot.val() : undefined, txOutcome: r && r.txOutcome }; },'
        + ' (e) => { __error = { message: String(e && e.message), txOutcome: e && e.txOutcome, txServerUnread: e && e.txServerUnread }; });', run.ctx);
}

(async () => {
    console.log('=== tx-outcome — `disconnect` ≠ «មិនបានអនុវត្ត» ===');

    console.log('\n── ០. ជាន់អប្បបរមា ──');
    ok('ZoeW/app.js មិនទទេ (>= 4000 បន្ទាត់)', SRC.split('\n').length >= 4000, SRC.split('\n').length);
    {
        makeRun({});
        const required = missing.filter((n) => !OPTIONAL.has(n));
        ok('function ចាំបាច់ទាំងអស់មានក្នុងកូដ ship', required.length === 0, required);
    }

    console.log('\n── ១. `initFirebase()` ដំឡើង wrapper លើ SDK ពិត (ចំណុចច្របាច់តែមួយ) ──');
    {
        const init = sliceFrom(SRC, 'initFirebase');
        // ⛔ ដេរីវេ ៖ តម្លៃដែលរុំ (អថេរណាក៏ដោយ) ត្រូវក្លាយជា `fb` ពិត — backend Supabase មានផ្លូវ outcome ផ្ទាល់ខ្លួន (`emu/supabase-adapter-parity`)
        const wrapped = init.match(/\b([A-Za-z_$][\w$]*)\s*=\s*withTransactionOutcomeResolution\s*\(\s*await\s+waitForFirebaseSDK\s*\(/);
        const becomesFb = !!wrapped && (wrapped[1] === 'fb'
            || new RegExp('(?:firebaseState\\.)?\\bfb\\s*=\\s*' + wrapped[1].replace(/\$/g, '\\$') + '\\s*;').test(init));
        ok('initFirebase() រុំ SDK ដោយ withTransactionOutcomeResolution() ហើយតម្លៃដែលរុំក្លាយជា fb', becomesFb, init.slice(0, 200));
        const calls = (SRC.match(/\bfb\.runTransaction\s*\(/g) || []).length;
        ok('ជាន់អប្បបរមា ៖ កន្លែងហៅ fb.runTransaction ក្នុងកូដ ship >= 20 (គ្រប់វាឆ្លង wrapper ដដែល)', calls >= 20, calls);
        const direct = SRC.replace(sliceFrom(SRC, 'runTransactionResolved'), '').match(/\brawFb\b|firebaseSDK\.runTransaction/g) || [];
        ok('គ្មានកន្លែងណាហៅ runTransaction របស់ SDK ឆៅដោយរំលង wrapper', direct.length === 0, direct);
    }

    console.log('\n── ២. wrapper ៖ សាលក្រមតាមស្ថានភាព server ពិត ──');
    {
        const run = makeRun({ plan: ['applied-disconnect'] });
        runTx(run, 'ledger/day', '(cur) => ({ codDollar: (cur && cur.codDollar || 0) - 3 })');
        await settle(80);
        ok('លក្ខខណ្ឌចាំបាច់ ៖ server អនុវត្តរួច (10 ➜ 7)', run.server.ledger.day.codDollar === 7, run.server.ledger);
        ok('⛔⛔ disconnect ដែល server អនុវត្តរួច ➜ committed: true (មិនមែនបរាជ័យ)',
            !!(run.box.__result && run.box.__result.committed === true), { result: run.box.__result, error: run.box.__error });
        ok('snapshot.val() = តម្លៃ server ពិត', !!(run.box.__result && run.box.__result.value && run.box.__result.value.codDollar === 7), run.box.__result);
        ok('ការអាន server ប្រើ ID token (auth=…)', run.log.rest.length >= 1 && run.log.rest.every((r) => r.auth === 'tok-probe'), run.log.rest);
        ok('គ្មាន Sentry ពេលសម្រេចបាន', run.log.captures.length === 0, run.log.captures);
    }
    {
        const run = makeRun({ plan: ['lost-disconnect'] });
        runTx(run, 'ledger/day', '(cur) => ({ codDollar: (cur && cur.codDollar || 0) - 3 })');
        await settle(80);
        ok('លក្ខខណ្ឌចាំបាច់ ៖ server មិនបានទទួល (10 នៅដដែល)', run.server.ledger.day.codDollar === 10, run.server.ledger);
        ok('⛔ disconnect ដែលមិនដល់ server ➜ បដិសេធដោយ disconnect ដដែល',
            !!(run.box.__error && run.box.__error.message === 'disconnect'), { result: run.box.__result, error: run.box.__error });
        ok('⛔ ហើយត្រូវសម្គាល់ txOutcome = not-applied (ភាពគ្មានគ្រោះ)', !!(run.box.__error && run.box.__error.txOutcome === 'not-applied'), run.box.__error);
        ok('គ្មាន Sentry ពេលសម្រេចបាន', run.log.captures.length === 0, run.log.captures);
    }
    {
        const run = makeRun({ plan: ['lost-disconnect'] });
        runTx(run, 'ledger/day', '(cur) => { cur.codDollar = cur.codDollar - 3; return cur; }');
        await settle(80);
        ok('⛔ updater ដែលកែ `current` នៅនឹងកន្លែង ➜ តម្លៃមុនត្រូវថតមុនការកែ (not-applied មិនក្លាយជា applied)',
            !!(run.box.__error && run.box.__error.txOutcome === 'not-applied') && !run.box.__result, { result: run.box.__result, error: run.box.__error });
    }
    {
        const run = makeRun({ plan: ['foreign-disconnect', 'foreign-disconnect'] });
        runTx(run, 'ledger/day', '(cur) => ({ codDollar: (cur && cur.codDollar || 0) - 3 })');
        await settle(80);
        ok('⛔ server ប្រែដោយអ្នកផ្សេង ➜ unknown (បដិសេធ មិនទាយ)', !!(run.box.__error && run.box.__error.txOutcome === 'unknown'), run.box.__error);
        ok('⛔ unknown ➜ Sentry zone money ១ ដង', run.log.captures.filter((c) => c.zone === 'money').length === 1, run.log.captures);
        runTx(run, 'ledger/day', '(cur) => ({ codDollar: (cur && cur.codDollar || 0) - 1 })');
        await settle(80);
        ok('⛔ unknown លើផ្លូវដដែល មិនផ្ញើ Sentry ស្ទួន', run.log.captures.filter((c) => c.zone === 'money').length <= 1, run.log.captures);
    }
    {
        const run = makeRun({ plan: ['denied'] });
        runTx(run, 'ledger/day', '(cur) => ({ codDollar: 1 })');
        await settle(40);
        ok('⛔ ទិសផ្ទុយ ៖ permission_denied ➜ បដិសេធភ្លាម គ្មានការអាន server', !!(run.box.__error && run.box.__error.message === 'permission_denied') && run.log.rest.length === 0, { error: run.box.__error, rest: run.log.rest });
    }
    {
        const run = makeRun({ plan: ['ok'] });
        runTx(run, 'ledger/day', '(cur) => ({ codDollar: 5 })');
        await settle(40);
        ok('⛔ ទិសផ្ទុយ ៖ transaction ធម្មតា ➜ committed ដដែល គ្មានការអាន server', !!(run.box.__result && run.box.__result.committed) && run.log.rest.length === 0, { result: run.box.__result, rest: run.log.rest });
    }
    {
        const run = makeRun({ plan: ['applied-disconnect'], legacyRefs: true });
        runTx(run, 'ledger/day', '(cur) => ({ codDollar: 1 })');
        await settle(40);
        ok('⛔ ref ដែលគ្មាន URL (fake ចាស់) ➜ ឥរិយាបថដើម (បដិសេធ disconnect) គ្មាន fetch', !!(run.box.__error && run.box.__error.message === 'disconnect') && run.log.rest.length === 0, { error: run.box.__error, rest: run.log.rest });
    }
    {
        // ⛔ «អាន server មិនបាន» = លទ្ធផល *មិនទាន់ដឹង* មិនមែន *មិនអាចដឹង* ➜ រង់ចាំរហូតអានបាន (មុនកែ ៖ បោះបង់ក្រោយ ៣០ ដង/៦០ វិ. ➜ `unknown`
        //    ➜ reconcile ដក ២ ដង · «ដក» ធ្វើឲ្យកញ្ចប់បាត់ ៖ ផ្នែក ៤ឃ · ៦)។ UI មិនព្យួរ ៖ អ្នកហៅមាន `dbOp` + `armLateCommit` រួចហើយ។
        const run = makeRun({ plan: ['applied-disconnect'], restDown: true, timerFloorMs: 20 });
        runTx(run, 'ledger/day', '(cur) => ({ codDollar: 1 })');
        await waitForState(() => run.log.rest.length > 30 || run.box.__result || run.box.__error);
        ok('⛔⛔ អាន server មិនបាន ➜ នៅរង់ចាំ (មិនបោះបង់ មិនទាយ unknown) ទោះលើសចំនួនព្យាយាមចាស់ (៣០)',
            !run.box.__result && !run.box.__error && run.log.rest.length > 30, { result: run.box.__result, error: run.box.__error, attempts: run.log.rest.length });
        run.log.restDown = false;
        await waitForState(() => run.box.__result || run.box.__error);
        ok('⛔⛔ ... server អានបានវិញ ➜ committed · txOutcome applied', !!(run.box.__result && run.box.__result.committed && run.box.__result.txOutcome === 'applied'),
            { result: run.box.__result, error: run.box.__error });
    }
    {
        const run = makeRun({ plan: ['applied-disconnect'], restRefuse: true });
        runTx(run, 'ledger/day', '(cur) => ({ codDollar: 1 })');
        await settle(1000);
        const cap = Number((sliceConst(SRC, 'TX_OUTCOME_MAX_REFUSALS').match(/=\s*(\d+)/) || [])[1] || 0);
        ok('⛔ server **បដិសេធ** ការអាន (HTTP 403) ➜ ការព្យាយាមមានព្រំដែន រួចចេញ unknown + txServerUnread (មិនព្យួរជារៀងរហូត)',
            !!(run.box.__error && run.box.__error.txOutcome === 'unknown' && run.box.__error.txServerUnread === true), { error: run.box.__error, attempts: run.log.rest.length });
        ok('ចំនួនការអាន <= TX_OUTCOME_MAX_REFUSALS', cap > 0 && run.log.rest.length <= cap, { attempts: run.log.rest.length, cap });
    }
    {
        const run = makeRun({ plan: ['applied-disconnect'], restDown: true });
        runTx(run, 'ledger/day', '(cur) => ({ codDollar: 1 })');
        await settle(200);
        vm.runInContext('authGeneration++;', run.ctx);
        await settle(300);
        ok('⛔ ប្តូរ auth ខណៈរង់ចាំ ➜ ឈប់អាន ➜ unknown + txServerUnread (មិនអានដោយ token របស់គណនីផ្សេង)',
            !!(run.box.__error && run.box.__error.txOutcome === 'unknown' && run.box.__error.txServerUnread === true), { error: run.box.__error });
    }
    {
        const run = makeRun({ plan: ['applied-disconnect'] });
        run.raw.runTransaction = ((orig) => (ref, fn) => orig(ref, fn))(run.raw.runTransaction);
        runTx(run, 'ledger/day', '(cur) => ({ codDollar: 2 })');
        await settle(80);
        ok('⛔ runTransaction ដែលជំនួសក្រោយការរុំ ត្រូវបានប្រើ (wrapper អាននៅពេលហៅ)', !!(run.box.__result && run.box.__result.committed), { result: run.box.__result, error: run.box.__error });
    }

    console.log('\n── ៣. ⛔⛔ ការសម្អាត «ផុតកំណត់» ៖ disconnect ក្រោយ server អនុវត្ត ──');
    const BCS = [{ code: 'D1', cod: 4.5, dod: 0.5, isClosed: false, isDeducted: false, isFromDeletion: false },
        { code: 'D2', cod: 3.25, dod: 0, isClosed: false, isDeducted: false, isFromDeletion: false }];
    const seed = (run) => {
        const item = { id: ITEM_ID, phone: '0977000111', scanDate: DAY, isClosed: false, count: 2,
            createdAt: NOW - 9 * 24 * 3600 * 1000, cod: 7.75, dod: 0.5, price: 8.25, barcodes: JSON.parse(JSON.stringify(BCS)) };
        run.server.zoew_scan_history_cod_dod[ITEM_ID] = JSON.parse(JSON.stringify(item));
        run.box.scanHistory.push(JSON.parse(JSON.stringify(item)));
    };
    {
        const run = makeRun({ plan: ['applied-disconnect'] });
        seed(run);
        vm.runInContext("claimAndCleanupItem('" + ITEM_ID + "', 'abandon');", run.ctx);
        await settle(400);
        ok('លក្ខខណ្ឌចាំបាច់ ៖ ប្រវត្តិលើ server ត្រូវដក (claim ចុះរួច)', !run.server.zoew_scan_history_cod_dod[ITEM_ID], Object.keys(run.server.zoew_scan_history_cod_dod));
        const trash = run.server.zoew_recently_deleted_cod_dod[ITEM_ID];
        ok('⛔⛔ កញ្ចប់ត្រូវចូលធុងសំរាម (មិនបាត់ពីទាំង ២ កន្លែង)', !!trash, Object.keys(run.server.zoew_recently_deleted_cod_dod));
        ok('⛔⛔ លុយត្រូវដក **ម្តង** ពីថ្ងៃ (100 ➜ 92.25)', r2(run.server.zoew_daily_revenue_cod_dod[DAY].codDollar) === 92.25, run.server.zoew_daily_revenue_cod_dod[DAY]);
        ok('⛔⛔ ហើយពីខែ (100 ➜ 92.25)', r2(run.server.zoew_monthly_revenue_cod_dod[MONTH].codDollar) === 92.25, run.server.zoew_monthly_revenue_cod_dod[MONTH]);
        ok('ចំនួនកញ្ចប់ដក ២ (20 ➜ 18)', run.server.zoew_daily_revenue_cod_dod[DAY].totalCount === 18, run.server.zoew_daily_revenue_cod_dod[DAY]);
        ok('គ្មាន Sentry money «Automatic cleanup transaction failed»', !run.log.captures.some((c) => /Automatic cleanup transaction failed/.test(c.context || '')), run.log.captures);
    }
    {
        const run = makeRun({ plan: ['lost-disconnect'] });
        seed(run);
        vm.runInContext("claimAndCleanupItem('" + ITEM_ID + "', 'abandon');", run.ctx);
        await settle(300);
        ok('⛔ ទិសផ្ទុយ ៖ disconnect មិនដល់ server ➜ កញ្ចប់នៅក្នុងប្រវត្តិ', !!run.server.zoew_scan_history_cod_dod[ITEM_ID]);
        ok('⛔ ទិសផ្ទុយ ៖ មិនសរសេរធុងសំរាម', Object.keys(run.server.zoew_recently_deleted_cod_dod).length === 0, Object.keys(run.server.zoew_recently_deleted_cod_dod));
        ok('⛔ ទិសផ្ទុយ ៖ លុយមិនប៉ះ (100)', r2(run.server.zoew_daily_revenue_cod_dod[DAY].codDollar) === 100, run.server.zoew_daily_revenue_cod_dod[DAY]);
        ok('⛔ disconnect ដែលគ្មានគ្រោះ មិនផ្ញើ Sentry money (ការជូនដំណឹងក្លែង)', !run.log.captures.some((c) => c.zone === 'money'), run.log.captures);
    }
    {
        const run = makeRun({ plan: ['applied-disconnect'] });
        seed(run);
        run.server.zoew_recently_deleted_cod_dod[ITEM_ID] = { id: ITEM_ID, trashReason: 'expired', deletedAt: NOW - 1000, barcodes: JSON.parse(JSON.stringify(BCS)) };
        vm.runInContext("claimAndCleanupItem('" + ITEM_ID + "', 'abandon');", run.ctx);
        await settle(400);
        ok('⛔⛔ ឧបករណ៍ផ្សេងសម្អាតរួច (trash/<id> មាន) ➜ មិនដកលុយ ២ ដង (100)', r2(run.server.zoew_daily_revenue_cod_dod[DAY].codDollar) === 100, run.server.zoew_daily_revenue_cod_dod[DAY]);
    }

    console.log('\n── ៤. ⛔⛔ ledger ៖ correctRevenueLedgerToActual មិនដកលុយ ២ ដង ──');
    {
        const run = makeRun({ plan: ['applied-disconnect', 'ok', 'ok', 'ok', 'ok'] });
        vm.runInContext("__status = null; const __applied = addRevenueToDailyAndMonthlyRecord('" + DAY + "', -5, 0, -1);"
            + " correctRevenueLedgerToActual('" + DAY + "', __applied, -5, 0, -1).then((s) => { __status = s; });", run.ctx);
        await settle(300);
        ok('⛔⛔ ថ្ងៃ ៖ ដកតែម្តង (100 ➜ 95)', r2(run.server.zoew_daily_revenue_cod_dod[DAY].codDollar) === 95, run.server.zoew_daily_revenue_cod_dod[DAY]);
        ok('⛔⛔ ខែ ៖ ដកតែម្តង (100 ➜ 95)', r2(run.server.zoew_monthly_revenue_cod_dod[MONTH].codDollar) === 95, run.server.zoew_monthly_revenue_cod_dod[MONTH]);
        ok('សាលក្រម reconcile = ok', !!(run.box.__status && run.box.__status.ok), run.box.__status);
    }
    {
        const run = makeRun({ plan: ['lost-disconnect', 'ok', 'ok', 'ok', 'ok'] });
        vm.runInContext("__status = null; const __applied = addRevenueToDailyAndMonthlyRecord('" + DAY + "', -5, 0, -1);"
            + " correctRevenueLedgerToActual('" + DAY + "', __applied, -5, 0, -1).then((s) => { __status = s; });", run.ctx);
        await settle(300);
        ok('⛔ ទិសផ្ទុយ ៖ disconnect មិនដល់ server ➜ reconcile នៅតែដក ១ ដង (100 ➜ 95)', r2(run.server.zoew_daily_revenue_cod_dod[DAY].codDollar) === 95, run.server.zoew_daily_revenue_cod_dod[DAY]);
    }

    console.log('\n── ៤ខ. ⛔⛔ ledger ៖ ឧបករណ៍ផ្សេងសរសេរ *តម្លៃដូចគ្នា* + `disconnect` ➜ ការដករបស់យើងមិនត្រូវបាត់ ──');
    //    ការសម្រេច «ស្មើតម្លៃដែលផ្ញើ» ត្រឹមត្រូវតែពេលតម្លៃជារបស់អ្នកសរសេរម្នាក់ ➜ ledger ពីរឧបករណ៍ដកចំនួនដូចគ្នាពីមូលដ្ឋាន
    //    ដដែល ➜ តម្លៃលើ server ដូចយើងបេះបិទ ➜ wrapper ជឿ «applied» ➜ ការដករបស់យើងបាត់ (ចំណូលប៉ោង)។ token `op` ក្នុងរាល់
    //    ការសរសេរធ្វើឲ្យតម្លៃនីមួយៗមានម្ចាស់។
    {
        const run = makeRun({ plan: ['foreign-equal-disconnect', 'ok', 'ok', 'ok', 'ok', 'ok'] });
        vm.runInContext("__status = null; const __applied = addRevenueToDailyAndMonthlyRecord('" + DAY + "', -5, 0, -1);"
            + " correctRevenueLedgerToActual('" + DAY + "', __applied, -5, 0, -1).then((s) => { __status = s; });", run.ctx);
        await settle(400);
        ok('លក្ខខណ្ឌចាំបាច់ ៖ wrapper បានអាន server (REST) ក្រោយ disconnect', run.log.rest.length >= 1, run.log.rest.length);
        ok('⛔⛔ ការដកពីឧបករណ៍ផ្សេង (100 ➜ 95) + ការដករបស់យើង ➜ ថ្ងៃ 90 (មិនបាត់ ៥)',
            r2(run.server.zoew_daily_revenue_cod_dod[DAY].codDollar) === 90, run.server.zoew_daily_revenue_cod_dod[DAY]);
    }
    {
        const run = makeRun({ plan: ['deny-op', 'deny-op', 'ok', 'ok', 'ok', 'ok'] });
        vm.runInContext("__status = null; const __applied = addRevenueToDailyAndMonthlyRecord('" + DAY + "', -5, 0, -1);"
            + " correctRevenueLedgerToActual('" + DAY + "', __applied, -5, 0, -1).then((s) => { __status = s; });", run.ctx);
        await settle(300);
        ok('⛔ rules ដែលមិនទាន់ Publish (បដិសេធ `op`) ➜ ការសរសេរនៅតែចុះ ១ ដង (ថ្ងៃ 95)',
            r2(run.server.zoew_daily_revenue_cod_dod[DAY].codDollar) === 95, run.server.zoew_daily_revenue_cod_dod[DAY]);
        ok('⛔ ... ហើយខែក៏ចុះ ១ ដង (95)', r2(run.server.zoew_monthly_revenue_cod_dod[MONTH].codDollar) === 95, run.server.zoew_monthly_revenue_cod_dod[MONTH]);
        ok('⛔ ... ហើយសាលក្រម reconcile = ok', !!(run.box.__status && run.box.__status.ok), run.box.__status);
    }
    {
        const run = makeRun({ plan: ['ok', 'ok'] });
        vm.runInContext("addRevenueToDailyAndMonthlyRecord('" + DAY + "', -1, 0, 0);", run.ctx);
        await settle(100);
        const d = run.server.zoew_daily_revenue_cod_dod[DAY] || {};
        const m = run.server.zoew_monthly_revenue_cod_dod[MONTH] || {};
        ok('⛔ ការសរសេរ ledger ផ្ទុក token `op` (ថ្ងៃ និងខែ)', typeof d.op === 'string' && d.op.length >= 8 && typeof m.op === 'string', { d, m });
    }

    console.log('\n── ៤គ. ⛔⛔ ledger ៖ outcome `unknown` (server អានមិនបាន ៖ បដិសេធ · ប្តូរ auth · adapter បិទ) ➜ សាលក្រម reconcile មិនរាយ ok ──');
    //    បណ្តាញដាច់តែម្យ៉ាង ➜ wrapper/adapter រង់ចាំលទ្ធផលពិត (ផ្នែក ២ · ៤ឃ)។ `unknown` + `txServerUnread` នៅសល់តែពេល server **បដិសេធ**
    //    ការអាន · ប្តូរ auth/database · adapter បិទ ➜ reconcile ទាយ «មិនបានអនុវត្ត» ហើយដកម្តងទៀត (ត្រូវតែពេលសំណើមិនដល់ server · ដក ២ ដង
    //    ពេលវាដល់រួច ៖ ថ្ងៃ 100 ➜ 90)។ ⛔ ការទាយទិសណាក៏ខុសពាក់កណ្តាល (វាស់ ១៥០ ករណីមុន/ក្រោយ ៖ «កុំប៉ះ» អាក្រក់ជាង ៣៦) ➜ ផ្នែកនេះចាក់សោតែ
    //    **ការពិត** ៖ App មិនអះអាង ✅ (មុនកែ ៖ `ok: true` ខណៈលុយខុស ២៧/១៥០) ➜ សារ «ស្ថិតិប្រាក់មិនទាន់ Sync» + Sentry។
    //    ⛔ កុំអះអាងតម្លៃលុយក្នុងករណី unknown (ទាំងទិសទាំងពីរមិនអាចបញ្ជាក់ ➜ ការអះអាងនឹងចាក់សោកំហុសមួយ)។
    for (const mode of ['applied-disconnect', 'lost-disconnect']) {
        for (const plan of [[mode, 'ok', 'ok', 'ok', 'ok', 'ok'], ['ok', mode, 'ok', 'ok', 'ok', 'ok']]) {
            const where = plan[0] === mode ? 'ថ្ងៃ' : 'ខែ';
            const run = makeRun({ plan: plan.slice(), restRefuse: true });
            vm.runInContext("__status = null; const __applied = addRevenueToDailyAndMonthlyRecord('" + DAY + "', -5, 0, -1);"
                + " correctRevenueLedgerToActual('" + DAY + "', __applied, -5, 0, -1).then((s) => { __status = s; });", run.ctx);
            await settle(1500);
            ok('លក្ខខណ្ឌចាំបាច់ (' + where + ' ' + mode + ') ៖ outcome unknown (server បដិសេធការអាន · Sentry money)',
                run.log.rest.length >= 1 && run.log.captures.some((c) => c.zone === 'money' && /outcome unknown/i.test(c.message)), { rest: run.log.rest.length, captures: run.log.captures });
            ok('⛔⛔ ' + where + ' unknown (' + mode + ') ➜ សាលក្រម reconcile មិន ok (មិនអះអាងថាស្ថិតិប្រាក់ត្រូវ)',
                !!run.box.__status && run.box.__status.ok === false, run.box.__status);
        }
    }
    {
        const run = makeRun({ plan: ['applied-disconnect', 'ok', 'ok', 'ok', 'ok'], restRefuse: true });
        vm.runInContext("__status = null; const __applied = addRevenueToDailyAndMonthlyRecord('" + DAY + "', -5, 0, -1);"
            + " correctRevenueLedgerToActual('" + DAY + "', __applied, 0, 0, 0).then((s) => { __status = s; });", run.ctx);
        await settle(1500);
        ok('⛔⛔ ចំនួនពិត 0 (ឧ. កែតម្លៃដែលមិនប្រែ) + ថ្ងៃ unknown ➜ សាលក្រមមិន ok (0 ស្មើ 0 មិនមែនភស្តុតាង)',
            !!run.box.__status && run.box.__status.ok === false, run.box.__status);
    }
    {
        const run = makeRun({ plan: ['ok', 'ok', 'ok', 'ok'], restDown: true });
        vm.runInContext("__status = null; const __applied = addRevenueToDailyAndMonthlyRecord('" + DAY + "', -5, 0, -1);"
            + " correctRevenueLedgerToActual('" + DAY + "', __applied, -5, 0, -1).then((s) => { __status = s; });", run.ctx);
        await settle(300);
        ok('⛔ ទិសផ្ទុយ ៖ គ្មាន disconnect ➜ ដកតែម្តង (95 · 95) · សាលក្រម ok',
            r2(run.server.zoew_daily_revenue_cod_dod[DAY].codDollar) === 95 && r2(run.server.zoew_monthly_revenue_cod_dod[MONTH].codDollar) === 95
                && !!run.box.__status && run.box.__status.ok === true,
            { day: run.server.zoew_daily_revenue_cod_dod[DAY], month: run.server.zoew_monthly_revenue_cod_dod[MONTH], status: run.box.__status });
    }
    {
        const run = makeRun({ plan: ['foreign-equal-disconnect', 'ok', 'ok', 'ok', 'ok', 'ok'] });
        vm.runInContext("__status = null; const __applied = addRevenueToDailyAndMonthlyRecord('" + DAY + "', -5, 0, -1);"
            + " correctRevenueLedgerToActual('" + DAY + "', __applied, -5, 0, -1).then((s) => { __status = s; });", run.ctx);
        await settle(400);
        ok('⛔ ទិសផ្ទុយ ៖ unknown ដែល server **អានបាន** (ឧបករណ៍ផ្សេងសរសេរ) មិនមែន `txServerUnread` ➜ reconcile បញ្ចប់ ok (ផ្នែក ៤ខ)',
            !!run.box.__status && run.box.__status.ok === true, run.box.__status);
    }

    console.log('\n── ៤ឃ. ⛔⛔ ledger ៖ server អានមិនបានយូរ រួចអានបានវិញ ➜ reconcile ដកតែម្តង (មិនទាយ) ──');
    //    មុនកែ ៖ wrapper បោះបង់ក្រោយ ៣០ ដង/៦០ វិ. ➜ unknown ➜ reconcile ដក ២ ដង (100 ➜ 90) ពេលសំណើបានដល់ ឬ «កុំប៉ះ» ➜ ការដកបាត់ពេលមិនដល់។
    //    ឥឡូវ ៖ រង់ចាំលទ្ធផលពិត ➜ ទិសទាំងពីរត្រូវ (ថ្ងៃ 95 · ខែ 95 · ok)។
    //    Timer អប្បបរមា 20ms ចាក់សោករណីម៉ាស៊ីនយឺត៖ អាន >30 ដងមិនអាចយក 500ms ជាលក្ខខណ្ឌចាំបាច់។
    for (const mode of ['applied-disconnect', 'lost-disconnect']) {
        for (const plan of [[mode, 'ok', 'ok', 'ok', 'ok', 'ok', 'ok'], ['ok', mode, 'ok', 'ok', 'ok', 'ok', 'ok']]) {
            const where = plan[0] === mode ? 'ថ្ងៃ' : 'ខែ';
            const run = makeRun({ plan: plan.slice(), restDown: true, timerFloorMs: 20 });
            vm.runInContext("__status = null; const __applied = addRevenueToDailyAndMonthlyRecord('" + DAY + "', -5, 0, -1);"
                + " correctRevenueLedgerToActual('" + DAY + "', __applied, -5, 0, -1).then((s) => { __status = s; });", run.ctx);
            await waitForState(() => run.log.rest.length > 30 || run.box.__status !== null);
            ok('លក្ខខណ្ឌចាំបាច់ (' + where + ' ' + mode + ') ៖ ខណៈ server អានមិនបាន reconcile មិនទាន់សម្រេច (រង់ចាំ មិនទាយ)',
                run.box.__status === null && run.log.rest.length > 30, { status: run.box.__status, rest: run.log.rest.length });
            run.log.restDown = false;
            await waitForState(() => run.box.__status !== null);
            ok('⛔⛔ ' + where + ' ' + mode + ' ➜ បណ្តាញត្រឡប់ ➜ ថ្ងៃ 95 · ខែ 95 · ok (ដកតែម្តង)',
                r2(run.server.zoew_daily_revenue_cod_dod[DAY].codDollar) === 95 && run.server.zoew_daily_revenue_cod_dod[DAY].totalCount === 19
                    && r2(run.server.zoew_monthly_revenue_cod_dod[MONTH].codDollar) === 95 && run.server.zoew_monthly_revenue_cod_dod[MONTH].totalCount === 19
                    && !!run.box.__status && run.box.__status.ok === true,
                { day: run.server.zoew_daily_revenue_cod_dod[DAY], month: run.server.zoew_monthly_revenue_cod_dod[MONTH], status: run.box.__status });
            ok('⛔ ... គ្មាន Sentry «outcome unknown»', !run.log.captures.some((c) => /outcome unknown/i.test(c.message)), run.log.captures);
        }
    }

    console.log('\n── ៦. ⛔⛔ «ដក» barcode ៖ server អានមិនបានយូរ ➜ មិនបាត់កញ្ចប់ ──');
    //    មុនកែ ៖ transaction ប្រវត្តិចុះលើ server តែ wrapper បោះបង់ ➜ late onFailed «ដកមិនបានជោគជ័យ» ➜ barcode មិននៅប្រវត្តិ · មិននៅធុងសំរាម ·
    //    ledger មិនដក (វាស់ ៖ ប្រវត្តិ ["BCB"] · ធុងសំរាម ០ · ថ្ងៃ 100)។ ការសម្អាតមាន journal ➜ «ដក» ដោយអ្នកប្រើជាផ្ទៃបងប្អូនដែលគ្មាន។
    for (const mode of ['applied-disconnect', 'lost-disconnect']) {
        const run = makeRun({ plan: [mode, 'ok', 'ok', 'ok', 'ok', 'ok', 'ok', 'ok', 'ok'], restDown: true });
        const item = { id: ITEM_ID, phone: '012345678', scanDate: DAY, time: '08:00:00 (' + DAY + ')', createdAt: NOW - 3600000, count: 2, cod: 12, dod: 0, price: 12,
            isClosed: false, barcode: 'BCA', barcodes: [{ code: 'BCA', cod: 5, dod: 0 }, { code: 'BCB', cod: 7, dod: 0 }] };
        run.server.zoew_scan_history_cod_dod[ITEM_ID] = JSON.parse(JSON.stringify(item));
        run.box.scanHistory.push(JSON.parse(JSON.stringify(item)));
        vm.runInContext("__rm = null; removeSingleBarcode('" + ITEM_ID + "', 'BCA').then((r) => { __rm = r; }, (e) => { __rm = 'threw ' + e; });", run.ctx);
        await settle(500);
        ok('លក្ខខណ្ឌចាំបាច់ (' + mode + ') ៖ ការដករង់ចាំ (pending · «នឹងបញ្ចប់ពេលបណ្តាញត្រឡប់»)', run.box.__rm === 'pending'
            && run.toasts.some((t) => /នឹងបញ្ចប់ដោយស្វ័យប្រវត្តិ/.test(t)) && !run.toasts.some((t) => /មិនបានជោគជ័យ/.test(t)), { rm: run.box.__rm, toasts: run.toasts });
        run.log.restDown = false;
        await settle(1500);
        const h = run.server.zoew_scan_history_cod_dod[ITEM_ID];
        const inHistory = !!(h && h.barcodes && h.barcodes.some((b) => b.code === 'BCA'));
        const trash = Object.values(run.server.zoew_recently_deleted_cod_dod || {}).filter((t) => (t.barcodes || []).some((b) => b.code === 'BCA'));
        const day = run.server.zoew_daily_revenue_cod_dod[DAY];
        const month = run.server.zoew_monthly_revenue_cod_dod[MONTH];
        if (mode === 'applied-disconnect') {
            ok('⛔⛔ server ដករួច ➜ បណ្តាញត្រឡប់ ➜ BCA ចូលធុងសំរាម ១ (មិនបាត់) · មិននៅប្រវត្តិ', !inHistory && trash.length === 1 && trash[0].barcodes[0].isDeducted === true,
                { inHistory, trash: trash.length });
            ok('⛔⛔ ... ការដកកាត់ប្រាក់តែម្តង (ថ្ងៃ 95 · ខែ 95)', r2(day.codDollar) === 95 && r2(month.codDollar) === 95, { day, month });
        } else {
            ok('⛔ ទិសផ្ទុយ ៖ server មិនបានដក ➜ BCA នៅប្រវត្តិ · ធុងសំរាម ០ · លុយ 100', inHistory && trash.length === 0 && r2(day.codDollar) === 100 && r2(month.codDollar) === 100,
                { inHistory, trash: trash.length, day, month });
            ok('⛔ ... ប្រាប់ការពិត «ដកមិនបានជោគជ័យ»', run.toasts.some((t) => /មិនបានជោគជ័យ/.test(t)), run.toasts.slice(-3));
        }
    }

    console.log('\n── ៧. ⛔⛔ ទ្វារតាម path ៖ transaction ថ្មីរង់ចាំលទ្ធផលមុនលើ path ដដែល ──');
    //    បើ T2 (ឧ. ស្កេនបន្ទាប់ពេលបណ្តាញដាច់) ចុះមុនការអាន ➜ server មិនស្មើតម្លៃដែល T1 ផ្ញើ ➜ T1 ក្លាយជា unknown វិញ (ការទាយ)។
    {
        const run = makeRun({ plan: ['applied-disconnect', 'ok', 'ok'], restDown: true });
        run.box.navigator.onLine = false;
        runTx(run, 'ledger/day', '(cur) => ({ codDollar: ((cur && cur.codDollar) || 0) + 1 })');
        await settle(150);
        run.box.__r2 = null;
        vm.runInContext("fb.runTransaction(fb.ref(db, 'ledger/day'), (cur) => ({ codDollar: ((cur && cur.codDollar) || 0) + 2 }))"
            + ".then((r) => { __r2 = !!(r && r.committed); }, (e) => { __r2 = 'err ' + e.message; });", run.ctx);
        await settle(300);
        ok('⛔⛔ ក្រៅបណ្តាញ ៖ T2 លើ path ដដែលមិនទាន់ទៅ SDK ខណៈ T1 រង់ចាំលទ្ធផល', run.log.tx.length === 1, run.log.tx);
        run.box.navigator.onLine = true;
        run.log.restDown = false;
        await settle(800);
        ok('⛔⛔ T1 ➜ applied (server 11 = តម្លៃដែលផ្ញើ · T2 មិនរំខាន)', !!(run.box.__result && run.box.__result.committed && run.box.__result.txOutcome === 'applied'),
            { result: run.box.__result, error: run.box.__error });
        ok('⛔⛔ T2 រត់បន្ទាប់ ➜ server 13 (10 + 1 + 2)', run.box.__r2 === true && run.server.ledger.day.codDollar === 13, { r2: run.box.__r2, day: run.server.ledger.day });
    }
    {
        const run = makeRun({ plan: ['applied-disconnect', 'ok'], restDown: true });
        runTx(run, 'ledger/day', '(cur) => ({ codDollar: 1 })');
        await settle(150);
        run.box.__r3 = null;
        vm.runInContext("fb.runTransaction(fb.ref(db, 'zoew_daily_revenue_cod_dod/" + DAY + "'), (cur) => cur).then((r) => { __r3 = !!(r && r.committed); }, () => { __r3 = false; });", run.ctx);
        await settle(200);
        ok('⛔ ទិសផ្ទុយ ៖ path ផ្សេងមិនរង់ចាំ', run.box.__r3 === true && run.log.tx.length === 2, { r3: run.box.__r3, tx: run.log.tx });
        run.log.restDown = false;
        await settle(400);
    }
    {
        // ⛔ ទ្វារមិនត្រូវរារាំងជារៀងរហូត ៖ លើបណ្តាញ (SDK ដើរ) តែ REST អានមិនបាន ➜ ដោះក្រោយការអានបរាជ័យ TX_OUTCOME_GATE_RELEASE_FAILS ដង
        const run = makeRun({ plan: ['applied-disconnect', 'ok'], restDown: true });
        runTx(run, 'ledger/day', '(cur) => ({ codDollar: ((cur && cur.codDollar) || 0) + 1 })');
        await settle(0);
        run.box.__r4 = null;
        vm.runInContext("fb.runTransaction(fb.ref(db, 'ledger/day'), (cur) => ({ codDollar: ((cur && cur.codDollar) || 0) + 2 }))"
            + ".then((r) => { __r4 = !!(r && r.committed); }, (e) => { __r4 = 'err ' + e.message; });", run.ctx);
        await settle(400);
        const fails = Number((sliceConst(SRC, 'TX_OUTCOME_GATE_RELEASE_FAILS').match(/=\s*(\d+)/) || [])[1] || 0);
        ok('⛔ លើបណ្តាញ តែ REST អានមិនបាន ➜ ទ្វារដោះ ➜ T2 ទៅមុខ (មិនជាប់ជារៀងរហូត) · T1 នៅរង់ចាំ',
            fails > 0 && run.box.__r4 === true && !run.box.__result && !run.box.__error, { fails, rest: run.log.rest.length, r4: run.box.__r4 });
        ok('⛔ ... តែទ្វារបានរារាំងមុន ៖ T2 ទៅ SDK តែក្រោយការអាន REST បរាជ័យ >= TX_OUTCOME_GATE_RELEASE_FAILS',
            run.log.tx.length === 2 && run.log.tx[1].restSeen >= fails, run.log.tx);
        run.log.restDown = false;
        await settle(400);
    }
    {
        // ⛔ ពេលត្រឡប់លើបណ្តាញ ការអានត្រូវមកឆាប់ ៖ ក្រៅបណ្តាញ ➜ ចន្លោះត្រឡប់ទៅ TX_OUTCOME_RETRY_GAP_MS (មិនរង់ចាំ backoff ចាស់ ៣០ វិ.)
        const run = makeRun({ plan: ['applied-disconnect'], restDown: true });
        runTx(run, 'ledger/day', '(cur) => ({ codDollar: 1 })');
        await settle(150);
        const grown = run.log.delays.some((d) => d >= 16000);
        run.box.navigator.onLine = false;
        await settle(30);
        const mark = run.log.delays.length;
        await settle(100);
        const gapBase = Number((sliceConst(SRC, 'TX_OUTCOME_RETRY_GAP_MS').match(/=\s*(\d+)/) || [])[1] || 0);
        const readTimeout = Number((sliceConst(SRC, 'TX_OUTCOME_READ_TIMEOUT_MS').match(/=\s*(\d+)/) || [])[1] || 0);
        const offlineGaps = run.log.delays.slice(mark).filter((d) => d !== readTimeout);
        ok('⛔ backoff ពេលលើបណ្តាញតែ REST ធ្លាក់កើនឡើង (លក្ខខណ្ឌចាំបាច់)', grown, run.log.delays.slice(0, 12));
        ok('⛔ ក្រៅបណ្តាញ ➜ ចន្លោះត្រឡប់ទៅ ' + gapBase + 'ms ➜ ពេលបណ្តាញមកវិញ អានឆាប់',
            gapBase > 0 && offlineGaps.length >= 2 && offlineGaps.every((d) => d === gapBase), offlineGaps.slice(0, 8));
        run.box.navigator.onLine = true;
        run.log.restDown = false;
        await settle(200);
    }

    console.log('\n── ៥. ⛔⛔ registry barcode ៖ តម្លៃ `true` ថេរ ➜ «ស្មើតម្លៃដែលផ្ញើ» មិនមែនភស្តុតាងថាជារបស់យើង ──');
    //    ការសរសេរ **true** ដដែលដោយអ្នកណាក៏បាន ➜ ការអាន server ដែលឃើញ `true` មិនអាចបែងចែក «យើងចាប់បាន» ពី
    //    «barcode ចុះឈ្មោះរួចដោយកញ្ចប់ផ្សេង» ➜ `'claimed'` ក្លែងក្លាយ ➜ barcode ស្ទួន ➜ **COD បូក ២ ដង**
    //    (ជាន់ទី ៤ ជាសាលក្រម server តែមួយ)។ ⛔ ច្បាប់ «ផ្ទៀងផ្ទាត់មិនបាន ≠ គ្មានស្ទួន» ➜ `'unknown'`។
    const claim = async (run) => {
        run.box.__verdict = null;
        vm.runInContext('claimBarcodeInRegistry("ZT7788990011").then((v) => { __verdict = v; }, (e) => { __verdict = "throw:" + e.message; });', run.ctx);
        await settle(120);
        return run.box.__verdict;
    };
    {
        const run = makeRun({ plan: ['cold-disconnect'] });
        run.server.zoew_barcode_registry = { ZT7788990011: true };
        const verdict = await claim(run);
        ok('លក្ខខណ្ឌចាំបាច់ ៖ wrapper បានអាន server (REST)', run.log.rest.length >= 1, run.log.rest);
        ok('⛔⛔ barcode ចុះឈ្មោះរួចដោយកញ្ចប់ផ្សេង + disconnect ➜ **មិនមែន** `claimed`', verdict !== 'claimed', verdict);
        ok('⛔ ... ហើយជា `unknown` (មិនរក្សាទុក តែមិនដោះកូនសោរបស់គេ)', verdict === 'unknown', verdict);
    }
    {
        const run = makeRun({ plan: ['applied-disconnect'] });
        const verdict = await claim(run);
        ok('លក្ខខណ្ឌចាំបាច់ ៖ server មានកូនសោ (ការសរសេររបស់យើងចុះ)', !!(run.server.zoew_barcode_registry && run.server.zoew_barcode_registry.ZT7788990011), run.server.zoew_barcode_registry);
        ok('⛔ ការសរសេររបស់យើងចុះពិត តែបញ្ជាក់ម្ចាស់មិនបាន ➜ `unknown` (អន្ទាក់ថ្លៃតិចជាងលុយស្ទួន)', verdict === 'unknown', verdict);
    }
    {
        const run = makeRun({ plan: ['ok'] });
        ok('⛔ ទិសផ្ទុយ ៖ commit ធម្មតា ➜ `claimed`', await claim(run) === 'claimed');
        const again = makeRun({ plan: ['ok'] });
        again.server.zoew_barcode_registry = { ZT7788990011: true };
        ok('⛔ ទិសផ្ទុយ ៖ កូនសោមានរួច (គ្មាន disconnect) ➜ `taken`', await claim(again) === 'taken');
    }

    console.log('\n' + (fail ? '❌ ធ្លាក់ ' + fail + ' / ok ' + pass : '✅ ជោគជ័យ ' + pass + ' ការអះអាង'));
    process.exitCode = fail ? 1 : 0;
})().catch((e) => {
    console.log('  FAIL  checker គាំង ៖ ' + (e && e.stack || e));
    process.exitCode = 1;
});
