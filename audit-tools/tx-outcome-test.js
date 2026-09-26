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
    'txReadServerValue', 'txDelay', 'txResolveOutcome', 'txSnapshotOf', 'reportTxOutcomeUnknown',
    'runTransactionResolved', 'withTransactionOutcomeResolution'];
const TX_CONSTS = ['TX_OUTCOME_READ_TIMEOUT_MS', 'TX_OUTCOME_RETRY_GAP_MS', 'TX_OUTCOME_MAX_ATTEMPTS', 'TX_OUTCOME_MAX_WAIT_MS',
    'txDisconnectResolving'];
const APP_FNS = ['appZoneParts', 'getZoneDateKey', 'getFormattedDate', 'elapsedSince', 'withTimeout', 'dbOp', 'dbOpStalled',
    'fetchWithTimeout',
    'safeStoreGet', 'safeStoreSet', 'safeStoreRemove',
    'barcodeEntriesOf', 'normalizeBarcodesOf', 'applyBarcodeCloseState', 'barcodeCloseIsRipe', 'barcodeAbandonIsRipe',
    'normalizeBarcodeCloseStamps', 'itemHasRestoreMarkers', 'stripHistoryOnlyMarkers', 'parseTimestampFromId',
    'generateUniqueId', 'retryAsync', 'cloneRestoreItem', 'saveSingleDeletedItemToFirebase', 'isActiveRestoreClaim',
    'recalcItemMoneyFromBarcodes', 'armLateCommit', 'notifyIfSlow', 'settleLockWithin',
    'ledgerNumber', 'ledgerZeroDelta', 'ledgerServerVerdict', 'alignMonthlyLedgerToDaily', 'correctRevenueLedgerToActual',
    'ledgerDeltaWithClamp', 'ledgerAppliedDelta', 'revertLedgerRecordInMemory', 'ledgerMemoryCompensationClaimed',
    'applyLedgerBucketDelta', 'commitRevenueBucketDelta', 'commitDailyRevenueDelta', 'commitMonthlyRevenueDelta',
    'addRevenueToDailyAndMonthlyRecord', 'revertRevenueLedgerDelta', 'restoreClaimedItemToScanHistory', 'runLedgerTransaction',
    'noteCleanupJournalEntry', 'markCleanupJournalStage', 'clearCleanupJournalEntry',
    'readCleanupJournal', 'writeCleanupJournal', 'cleanupJournalScope', 'cleanupJournalScopeMismatch',
    'cleanupClaimAccountedElsewhere', 'claimAndCleanupItem', 'barcodeRegistryKey', 'claimBarcodeInRegistry'];
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
    const log = { tx: [], rest: [], captures: [], restDown: !!opts.restDown };
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
            log.tx.push({ path: ref.path, mode });
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
        setTimeout: (fn, ms) => setTimeout(fn, Math.min(ms || 0, 5)),
        clearTimeout: (id) => clearTimeout(id),
        AbortController,
        navigator: { onLine: true },
        fetch: fetchFake,
        resolveNativeApiUrl: (u) => u,
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
        scanHistory: [], deletedItems: [],
        dailyRevenueData: clone(server.zoew_daily_revenue_cod_dod),
        monthlyRevenueData: clone(server.zoew_monthly_revenue_cod_dod)
    };
    box.window = box;
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

function runTx(run, p, updaterSrc) {
    run.box.__result = null;
    run.box.__error = null;
    vm.runInContext('fb.runTransaction(fb.ref(db, ' + JSON.stringify(p) + '), ' + updaterSrc + ')'
        + '.then((r) => { __result = { committed: r && r.committed, value: r && r.snapshot ? r.snapshot.val() : undefined, txOutcome: r && r.txOutcome }; },'
        + ' (e) => { __error = { message: String(e && e.message), txOutcome: e && e.txOutcome }; });', run.ctx);
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
        ok('initFirebase() រុំ SDK ដោយ withTransactionOutcomeResolution()',
            /fb\s*=\s*withTransactionOutcomeResolution\s*\(\s*await\s+waitForFirebaseSDK\s*\(/.test(init), init.slice(0, 200));
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
        const run = makeRun({ plan: ['applied-disconnect'], restDown: true });
        runTx(run, 'ledger/day', '(cur) => ({ codDollar: 1 })');
        await settle(600);
        ok('⛔ អាន server មិនបាន ➜ ការព្យាយាមមានព្រំដែន រួចចេញ unknown (មិនព្យួរជារៀងរហូត)',
            !!(run.box.__error && run.box.__error.txOutcome === 'unknown'), { error: run.box.__error, attempts: run.log.rest.length });
        const cap = Number((sliceConst(SRC, 'TX_OUTCOME_MAX_ATTEMPTS').match(/=\s*(\d+)/) || [])[1] || 0);
        ok('ចំនួនការអាន <= TX_OUTCOME_MAX_ATTEMPTS', cap > 0 && run.log.rest.length <= cap, { attempts: run.log.rest.length, cap });
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
