// ⛔ ថ្នាក់កំហុស៖ **ការសរសេរដែលបាត់ ព្រោះអ្នកប្រើចាកចេញពី App**។
//
// 🔴 កំហុសផលិតកម្មពិត (Sentry, 2026-08-27, កំណែ 2.20.1)៖
//   ប៊ូតុង «📞 ខល» ជា <a href="tel:…"> **បូក** data-act="handleCallAction"។
//   ការចុចបើកកម្មវិធីទូរស័ព្ទ ➜ iOS ផ្អាក PWA ➜ WebSocket របស់ RTDB ដាច់ ➜
//   transaction ដែលផ្ញើទៅរួចតែមិនទាន់បញ្ជាក់ ត្រូវ SDK បោះបង់៖
//       FIREBASE WARNING: transaction at /zoew_scan_history_cod_dod/id_… failed: disconnect
//   promise បដិសេធ ➜ `patchHistoryItemFields()` revert ➜ ស្លាក «✔️ ខល»
//   លោតត្រឡប់ទៅ «📞 ខល» ➜ អ្នកប្រើត្រូវចុចម្តងទៀត **ដែលខលលេខនោះម្តងទៀត**។
//
// ⛔ SDK **មិន retry** ការបោះបង់នេះទេ — promise ដែលបដិសេធ មានន័យថាវាបោះបង់
//   ជាស្ថាពរ។ ដូច្នេះការកែមិនមែន «កុំ revert» ទេ គឺ **រត់ patch នោះឡើងវិញ
//   ក្រោយភ្ជាប់មកវិញ**។
//
// ឧបករណ៍នេះអះអាង **២ ខាង** — បើអះអាងតែថា «មិន revert» នោះការមិនធ្វើអ្វីសោះ
// ក៏បៃតងដែរ ខណៈការសរសេរនោះបាត់ជារៀងរហូត៖
//   ១. ការដាច់បណ្តាញ ➜ **មិន revert** ហើយចូលជួរ
//   ២. ការភ្ជាប់មកវិញ ➜ ការសរសេរ **ទៅដល់ server ពិត**
//   ៣. កំហុសដែល **មិនមែន** ការដាច់ (permission_denied) ➜ **ត្រូវ revert ដដែល**
//      (បើមិនដូច្នេះ ការបដិសេធពិតនឹងចូលជួររហូតជារៀងរហូត)
//   ៤. ផ្លូវ `saveEditedPhone` (គ្មាន opt-in) ➜ **ត្រូវ revert ដដែល** ព្រោះវាមាន
//      ការទូទាត់ស្ថិតិយក (`revertPickupRefMove`) ដែលពឹងលើ promise ដែលដោះភ្លាម
//   ៥. ស្លាកទាំង ៣ (`no-answer` · `no-connect` · `wrong-number`) និងការសម្អាត
//      ត្រូវរស់រានឆ្លងកាត់ការដាច់បណ្តាញ — សំណើផ្ទាល់របស់អ្នកប្រើ
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { reactRuntime } = require('./react-view.js');

const ROOT = process.env.HISTPATCH_APP_DIR ? path.resolve(process.env.HISTPATCH_APP_DIR) : path.resolve(__dirname, '..');
const APP_JS = path.join(ROOT, 'ZoeW', 'app.js');

let pass = 0, fail = 0;
function ok(label, cond, detail) {
    if (cond) { console.log('   ok    ' + label); pass++; }
    else { console.log('   FAIL  ' + label + (detail !== undefined ? '  ➜ ' + JSON.stringify(detail) : '')); fail++; }
}

let SRC = '';
try { SRC = fs.readFileSync(APP_JS, 'utf8'); } catch (e) { SRC = ''; }

// ⛔ ជាន់អប្បបរមា — «គ្មានលំនាំអាក្រក់» ពិតដោយស្វ័យប្រវត្តិលើ input ទទេ។
ok('អាន ZoeW/app.js បាន (ជាន់អប្បបរមា)', SRC.length > 100000, SRC.length);
const callSites = (SRC.match(/patchHistoryItemFields\(/g) || []).length;
ok('រកឃើញកន្លែងហៅ patchHistoryItemFields >= 5', callSites >= 5, callSites);
['no-answer', 'no-connect', 'wrong-number'].forEach((m) => {
    ok('ស្លាកការខល ' + m + ' នៅមានក្នុងកូដ', SRC.indexOf("'" + m + "'") !== -1);
});

function sliceFn(name) {
    let start = SRC.indexOf('function ' + name + '(');
    if (start === -1) return null;
    if (SRC.slice(Math.max(0, start - 6), start) === 'async ') start -= 6;
    let depth = 0, i = SRC.indexOf('{', start), started = false;
    for (; i < SRC.length; i++) {
        if (SRC[i] === '{') { depth++; started = true; }
        else if (SRC[i] === '}') { depth--; if (started && depth === 0) { i++; break; } }
    }
    return SRC.slice(start, i);
}

const FNS = ['patchHistoryItemFields', 'historyPatchErrorIsDisconnect', 'queueHistoryPatchRetry',
    'flushPendingHistoryPatches', 'handleCallAction', 'setCallMark',
    // «📞 ខល» ជាការចាកចេញពី App ដោយចេតនា ➜ វាលើកលែងការចាក់សោ (កំណែ 2.22.1)។
    // ⛔ ចាក់ **កូដពិត** មិនមែន stub ទទេ — បើ stub នោះស្នាមភ្ជាប់នេះគ្មានតេស្តសោះ។
    'noteAppLockExcuse',
    // ⛔ ពិដានការហៅ Firebase (db-stall-guard) ៖ ការព្យួរ **មិនបោះកំហុស** ➜
    // បើគ្មានវា `historyPatchErrorIsDisconnect()` មិនដែលត្រូវហៅសោះ ➜
    // ការសម្គាល់ការខលបាត់ស្ងាត់ៗ (ថ្នាក់ដដែលនឹង 2.20.2 តាមទ្វារផ្សេង)។
    'withTimeout', 'dbOp', 'dbOpStalled',
    // SENTRY-1 ៖ ការព្យួរដែល transaction នៅរស់ ➜ `armLateCommit` សម្រេចពេលវាដោះ (មិន revert មុន)។
    'armLateCommit',
    // ⛔ wrapper `disconnect` (`src/services/tx-outcome.ts`) រុំ `fb.runTransaction` **ពិត** ក្នុង `initFirebase()`
    // ➜ វាប្តូរ `disconnect` ដែល SDK បោះភ្លាម ទៅជាការអាន REST ដែលអាចយូរជាងពិដាន `dbOp` ➜ ស្នាមភ្ជាប់នេះ
    // ត្រូវវាស់ជាមួយ wrapper ពិត (មិនមែន stub `runTransaction` ដែលបដិសេធត្រង់ៗ)។
    'elapsedSince', 'fetchWithTimeout', 'transactionOutcomeUnknown', 'txCloneJson', 'txCanonical', 'txSameValue',
    'txRestUrl', 'txReadServerValue', 'txDelay', 'txReadWasRefused', 'txResolveOutcome', 'txPathKey', 'txResolvingBlockers', 'txTrackResolving',
    'txSnapshotOf', 'reportTxOutcomeUnknown',
    'transactionDisconnectPending', 'runTransactionResolved', 'withTransactionOutcomeResolution'];
const src = {};
FNS.forEach((n) => {
    src[n] = sliceFn(n);
    ok('រកឃើញ function ' + n + '()', !!src[n]);
});

const DECLS = ['pendingHistoryPatches', 'HISTORY_PATCH_RETRY_MAX', 'HISTORY_PATCH_QUEUE_MAX', 'historyPatchFlushInFlight',
    'appLockExcuseAt', 'DB_OP_TIMEOUT_MS', 'TX_OUTCOME_READ_TIMEOUT_MS', 'TX_OUTCOME_RETRY_GAP_MS', 'TX_OUTCOME_MAX_GAP_MS',
    'TX_OUTCOME_MAX_REFUSALS', 'TX_OUTCOME_GATE_RELEASE_FAILS', 'txResolvingPaths', 'txOutcomeUnknownReported', 'txDisconnectResolving'];
const decls = [];
DECLS.forEach((n) => {
    const m = SRC.match(new RegExp('^ *(?:let|const) ' + n + ' = .*$', 'm'));
    ok('រកឃើញការប្រកាស ' + n, !!m);
    if (m) decls.push(m[0]);
});

// ការសាង sandbox ត្រូវរត់ទោះខ្វះ function — ការធ្លាក់ត្រូវប្រាប់ថា *អ្វី* ខូច
// មិនមែនបញ្ឈប់ការអះអាងឥរិយាបថទាំងអស់ខាងក្រោមវា (មេរៀន 2.19.3)។
function build(mode, opts) {
    const server = (opts && opts.server) || {};
    const toasts = [];
    const ctx = {
        console: { error: () => {}, log: () => {} },
        window: {},
        Object: Object, Array: Array, Promise: Promise, JSON: JSON, String: String, Math: Math,
        Number: Number, Set: Set, Map: Map, WeakMap: WeakMap, Error: Error, TypeError: TypeError, URL: URL, Date: Date,
        setTimeout: (opts && opts.timeScale) ? ((f, ms) => setTimeout(f, Math.max(0, (ms || 0) / opts.timeScale))) : setTimeout,
        clearTimeout: clearTimeout, queueMicrotask: queueMicrotask,
        navigator: { onLine: !(opts && opts.offline) },
        AbortController: AbortController,
        fetch: () => Promise.reject(new TypeError('Failed to fetch')),
        firebaseConfig: { databaseURL: 'https://demo-zoew.firebaseio.com' },
        auth: { currentUser: { getIdToken: () => Promise.resolve('token') } },
        db: {}, dbRefHistory: {},
        authGeneration: 0,
        scanHistory: (opts && opts.scanHistory) || [],
        markingItemId: (opts && opts.markingItemId) || null,
        showToast: (t) => toasts.push(t),
        closeModal: () => {},
        refreshCurrentHistoryView: () => {},
        scheduleHistoryViewRefresh: () => {},
        normalizeBarcodesOf: (x) => x,
        getServerNow: () => 1700000000000,
        __server: server,
        __toasts: toasts,
        __mode: { value: mode }
    };
    ctx.fb = {
        // mode 'throw' ៖ ធ្វើត្រាប់តាម `fb.ref()` ដែលបោះ **ដោយ synchronous**
        // (ឧ. `Firebase App named [DEFAULT] already deleted` ក្រោយ deleteApp()
        // ក្នុងផ្លូវស្តារ SDK)។ នេះជាផ្លូវដែលមិនឆ្លងកាត់ `.then(ok, fail)` ទេ។
        ref: (d, p) => {
            if (ctx.__mode.value === 'throw') throw new Error('Firebase App named [DEFAULT] already deleted');
            return { path: p, toString: () => 'https://demo-zoew.firebaseio.com/' + p };
        },
        runTransaction: (ref, updater) => {
            const m = ctx.__mode.value;
            if (m === 'disconnect') return Promise.reject(new Error('disconnect'));
            if (m === 'hang') return new Promise(() => {});
            if (m === 'disconnect-sent') {
                // SDK ពិត ៖ updater រត់ ➜ transaction ផ្ញើ ➜ socket ដាច់មុន ack ➜ បដិសេធ `disconnect`
                const sentId = String(ref.path).split('/').pop();
                updater(server[sentId] ? JSON.parse(JSON.stringify(server[sentId])) : null);
                return Promise.reject(new Error('disconnect'));
            }
            if (m === 'denied') return Promise.reject(new Error('permission_denied'));
            const id = String(ref.path).split('/').pop();
            const cur = server[id] ? JSON.parse(JSON.stringify(server[id])) : null;
            const out = updater(cur);
            if (out === undefined || out === null) return Promise.resolve({ committed: false, snapshot: null });
            server[id] = out;
            return Promise.resolve({ committed: true, snapshot: { val: () => JSON.parse(JSON.stringify(out)) } });
        }
    };
    vm.createContext(ctx);
    vm.runInContext(reactRuntime(SRC, { exclude: FNS, context: ctx }), ctx);
    // ⛔ `dbOp` ពិតហៅ `probeDatabaseLiveness()` ពេលព្យួរ (ការវាស់ភាពរស់ ៖ `emu/app-network-e2e-test`) ➜ stub «មិនវាស់»
    vm.runInContext('var probeDatabaseLiveness = function () { return Promise.resolve(null); };', ctx);
    decls.forEach((d) => { try { vm.runInContext(d, ctx); } catch (e) {} });
    FNS.forEach((n) => { if (src[n]) { try { vm.runInContext(src[n], ctx); } catch (e) {} } });
    return ctx;
}

function tick() { return new Promise((r) => setTimeout(r, 0)); }

async function scenario(label, fn) {
    try { await fn(); } catch (e) { ok(label + ' (គាំង)', false, e && e.message); }
}

(async () => {
    await scenario('ការចាត់ថ្នាក់កំហុស', async () => {
        const ctx = build('ok');
        const isDis = (v) => vm.runInContext('historyPatchErrorIsDisconnect(' + v + ')', ctx);
        ok('disconnect ➜ ចាត់ជាការដាច់បណ្តាញ', isDis('new Error("disconnect")') === true);
        ok('permission_denied ➜ មិនមែនការដាច់បណ្តាញ', isDis('new Error("permission_denied")') === false);
        ok('Timed out ➜ មិនមែនការដាច់បណ្តាញ', isDis('new Error("Timed out")') === false);
    });

    // ស្លាកទាំង ៣ + ការសម្អាត — សំណើផ្ទាល់របស់អ្នកប្រើ
    for (const mark of ['no-answer', 'no-connect', 'wrong-number', null]) {
        const name = mark || 'សម្អាតសម្គាល់';
        await scenario('ស្លាក ' + name, async () => {
            // ⛔ ស្លាកដើមត្រូវ **ខុស** ពីស្លាកដែលកំពុងសាក បើមិនដូច្នេះ ការ revert
            // មើលទៅដូចការមិន revert ➜ ការអះអាងបៃតងក្លែងក្លាយ។
            const before = mark === 'no-answer' ? 'wrong-number' : 'no-answer';
            const item = { id: 'id1', phone: '012345678', callMark: before, callMarkTime: 111 };
            const server = { id1: { id: 'id1', phone: '012345678', callMark: before, callMarkTime: 111 } };
            const ctx = build('disconnect', { server: server, scanHistory: [item], markingItemId: 'id1' });
            vm.runInContext('setCallMark(' + (mark === null ? 'null' : '"' + mark + '"') + ');', ctx);
            await tick(); await tick();
            const local = ctx.scanHistory[0];
            if (mark === null) {
                ok('ដាច់បណ្តាញ ➜ ' + name + ' រក្សាស្ថានភាពក្នុងមូលដ្ឋាន (មិន revert)', local.callMark === undefined, local.callMark);
            } else {
                ok('ដាច់បណ្តាញ ➜ ' + name + ' រក្សាស្ថានភាពក្នុងមូលដ្ឋាន (មិន revert)', local.callMark === mark, local.callMark);
            }
            const queued = vm.runInContext('pendingHistoryPatches.size', ctx);
            ok('ដាច់បណ្តាញ ➜ ' + name + ' ចូលជួររង់ចាំ', queued === 1, queued);
            ok('ដាច់បណ្តាញ ➜ ' + name + ' toast ប្រាប់ថារង់ចាំ មិនអះអាង success',
                ctx.__toasts.some((t) => /^⏳/.test(t)) && !ctx.__toasts.some((t) => /^✅/.test(t)), ctx.__toasts);

            vm.runInContext('__mode.value = "ok";', ctx);
            vm.runInContext('flushPendingHistoryPatches();', ctx);
            await tick(); await tick(); await tick();
            const onServer = ctx.__server.id1;
            if (mark === null) {
                ok('ភ្ជាប់មកវិញ ➜ ' + name + ' ទៅដល់ server ពិត', onServer.callMark === undefined, onServer.callMark);
            } else {
                ok('ភ្ជាប់មកវិញ ➜ ' + name + ' ទៅដល់ server ពិត', onServer.callMark === mark, onServer.callMark);
            }
            ok('ភ្ជាប់មកវិញ ➜ ' + name + ' ជួររង់ចាំទទេវិញ', vm.runInContext('pendingHistoryPatches.size', ctx) === 0);
            ok('ភ្ជាប់មកវិញ ➜ ' + name + ' ទើប toast ប្រកាសថា Firebase រួចរាល់',
                ctx.__toasts.some((t) => /^✅/.test(t) && /Firebase/.test(t)), ctx.__toasts);
        });
    }

    await scenario('handleCallAction', async () => {
        const item = { id: 'id1', phone: '012345678', isCalled: false, callMark: 'no-answer', callMarkTime: 111 };
        const server = { id1: { id: 'id1', phone: '012345678', isCalled: false, callMark: 'no-answer', callMarkTime: 111 } };
        const ctx = build('disconnect', { server: server, scanHistory: [item] });
        vm.runInContext('handleCallAction("id1");', ctx);
        await tick(); await tick();
        ok('ដាច់បណ្តាញ ➜ ✔️ ខល មិនលោតត្រឡប់វិញ', ctx.scanHistory[0].isCalled === true, ctx.scanHistory[0].isCalled);
        vm.runInContext('__mode.value = "ok";', ctx);
        vm.runInContext('flushPendingHistoryPatches();', ctx);
        await tick(); await tick(); await tick();
        ok('ភ្ជាប់មកវិញ ➜ isCalled ទៅដល់ server', ctx.__server.id1.isCalled === true);
        ok('ភ្ជាប់មកវិញ ➜ នាឡិកា ៤ ម៉ោង reset ទៅដល់ server ដែរ',
            ctx.__server.id1.callMarkTime === 1700000000000, ctx.__server.id1.callMarkTime);
    });

    // ⛔ ស្នាមភ្ជាប់ wrapper `disconnect` ↔ ពិដាន `dbOp` ៖ SDK បដិសេធ `disconnect` ភ្លាម តែ wrapper អាន server តាម REST
    //    មុនបញ្ជូនវាបន្ត ➜ ពេលបណ្តាញដាច់ពិត (ក្រៅបណ្តាញ · `fetch` ធ្លាក់) ការអាននោះវិលរហូតដល់ ៦០ វិ. ខណៈ `dbOp`
    //    ផុតនៅ ១៥ វិ. ➜ «stalled» ➜ revert + «បរាជ័យ» ➜ ស្លាក «✔️ ខល» លោតត្រឡប់ ➜ អ្នកប្រើចុចខលម្តងទៀត (កំហុស
    //    Sentry 2.20.1 ដដែល តាមទ្វារថ្មី)។ ⛔ SDK **បាន** បដិសេធ `disconnect` ➜ ច្បាប់ «តែ `disconnect` ចូលជួរ»
    //    ត្រូវអនុវត្ត មិនមែនច្បាប់ «timeout ➜ revert» ទេ។ (ពេលវេលាក្នុង sandbox ពន្លឿន ×100)
    for (const offline of [true, false]) {
        const where = offline ? 'ក្រៅបណ្តាញ' : 'onLine តែ fetch ធ្លាក់';
        await scenario('wrapper disconnect (' + where + ')', async () => {
            const item = { id: 'id1', phone: '012345678', callMark: 'wrong-number', callMarkTime: 111 };
            const server = { id1: { id: 'id1', phone: '012345678', callMark: 'wrong-number', callMarkTime: 111 } };
            const ctx = build('disconnect-sent', { server: server, scanHistory: [item], markingItemId: 'id1', timeScale: 100, offline });
            let wrapped = false;
            try {
                ctx.fb = vm.runInContext('withTransactionOutcomeResolution', ctx)(ctx.fb);
                wrapped = !!ctx.fb.__txOutcomeResolved;
            } catch (e) { wrapped = false; }
            ok('លក្ខខណ្ឌចាំបាច់ ៖ fb ត្រូវរុំដោយ wrapper ពិត (' + where + ')', wrapped);
            const saved = await vm.runInContext('setCallMark("no-connect")', ctx);
            ok('⛔ wrapper + ' + where + ' ➜ ស្លាកមិន revert', ctx.scanHistory[0].callMark === 'no-connect', ctx.scanHistory[0].callMark);
            ok('⛔ wrapper + ' + where + ' ➜ ចូលជួររង់ចាំ', saved === 'queued' && vm.runInContext('pendingHistoryPatches.size', ctx) === 1,
                { saved, queued: vm.runInContext('pendingHistoryPatches.size', ctx) });
            ok('⛔ wrapper + ' + where + ' ➜ គ្មាន toast «បរាជ័យ»', !ctx.__toasts.some((t) => /^⚠️/.test(t)), ctx.__toasts);
            // ភ្ជាប់មកវិញពិត ៖ browser · SDK · REST ត្រឡប់មកជាមួយគ្នា ➜ wrapper អាន server (មិនទាន់ប្រែ ➜ not-applied) ➜ ការសម្គាល់ក្នុងជួរទៅដល់
            //    (ទ្វារតាម path របស់ wrapper ឲ្យ T2 រង់ចាំលទ្ធផល T1 ➜ ត្រូវរង់ចាំរហូតបញ្ចប់ មិនមែន ៣ tick)
            ctx.navigator.onLine = true;
            ctx.fetch = (url) => {
                const id = decodeURIComponent(new URL(url).pathname).replace(/\.json$/, '').split('/').pop();
                const body = ctx.__server[id] === undefined ? null : JSON.parse(JSON.stringify(ctx.__server[id]));
                return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
            };
            vm.runInContext('__mode.value = "ok";', ctx);
            vm.runInContext('flushPendingHistoryPatches();', ctx);
            for (let i = 0; i < 200 && ctx.__server.id1.callMark !== 'no-connect'; i++) await new Promise((r) => setTimeout(r, 10));
            ok('⛔ wrapper + ' + where + ' ➜ ភ្ជាប់មកវិញ ការសម្គាល់ទៅដល់ server', ctx.__server.id1.callMark === 'no-connect', ctx.__server.id1.callMark);
        });
    }

    // ⛔ ការព្យួរ **ដែល SDK មិនបានបដិសេធ `disconnect`** ៖ transaction នៅរស់ ➜ `pending` (SENTRY-1 ៖ មិន revert ខណៈ transaction
    //    នៅរស់ · មិនចូលជួរ ព្រោះ transaction ដដែលនឹង commit) ➜ commit/បរាជ័យយឺតសម្រេចដោយ `armLateCommit`
    //    (`ZoeW/tests/history-patch-late-commit.test.ts`)។
    await scenario('wrapper ៖ ការព្យួរសុទ្ធ', async () => {
        const item = { id: 'id1', phone: '012345678', callMark: 'wrong-number', callMarkTime: 111 };
        const ctx = build('hang', { server: { id1: { ...item } }, scanHistory: [{ ...item }], markingItemId: 'id1', timeScale: 100 });
        try { ctx.fb = vm.runInContext('withTransactionOutcomeResolution', ctx)(ctx.fb); } catch (e) {}
        const saved = await vm.runInContext('setCallMark("no-connect")', ctx);
        ok('⛔ ព្យួរដោយគ្មាន `disconnect` ➜ `pending` · មិន revert ខណៈ transaction នៅរស់', saved === 'pending' && ctx.scanHistory[0].callMark === 'no-connect',
            { saved, callMark: ctx.scanHistory[0].callMark });
        ok('⛔ ព្យួរដោយគ្មាន `disconnect` ➜ មិនចូលជួរ', saved !== 'queued' && vm.runInContext('pendingHistoryPatches.size', ctx) === 0,
            { saved, queued: vm.runInContext('pendingHistoryPatches.size', ctx) });
        ok('⛔ ព្យួរដោយគ្មាន `disconnect` ➜ ⏳ · គ្មាន ✅ · គ្មាន «បរាជ័យ»',
            ctx.__toasts.some((t) => /^⏳/.test(t)) && !ctx.__toasts.some((t) => /^✅/.test(t) || /បរាជ័យ/.test(t)), ctx.__toasts);
    });

    // ⛔ ទិសផ្ទុយ ៖ កំហុសដែលមិនមែនការដាច់បណ្តាញ ត្រូវ revert ដដែល
    await scenario('permission_denied', async () => {
        const item = { id: 'id1', phone: '012345678', callMark: 'no-answer', callMarkTime: 111 };
        const ctx = build('denied', { server: { id1: { id: 'id1' } }, scanHistory: [item], markingItemId: 'id1' });
        vm.runInContext('setCallMark("wrong-number");', ctx);
        await tick(); await tick();
        ok('permission_denied ➜ revert ដដែល', ctx.scanHistory[0].callMark === 'no-answer', ctx.scanHistory[0].callMark);
        ok('permission_denied ➜ មិនចូលជួរ', vm.runInContext('pendingHistoryPatches.size', ctx) === 0);
        ok('permission_denied ➜ មាន toast បរាជ័យ', ctx.__toasts.length > 0, ctx.__toasts);
    });

    // ⛔ ផ្លូវ saveEditedPhone ៖ គ្មាន opt-in ➜ ឥរិយាបថមិនត្រូវប្រែសោះ
    await scenario('ផ្លូវគ្មាន opt-in', async () => {
        const item = { id: 'id1', phone: 'ចាស់' };
        const ctx = build('disconnect', { server: { id1: { id: 'id1' } }, scanHistory: [item] });
        vm.runInContext('scanHistory[0].phone = "ថ្មី"; patchHistoryItemFields(scanHistory[0], { phone: "ថ្មី" }, { phone: "ចាស់" });', ctx);
        await tick(); await tick();
        ok('គ្មាន opt-in ➜ ដាច់បណ្តាញនៅតែ revert (ការទូទាត់ស្ថិតិយកមិនប្រែ)',
            ctx.scanHistory[0].phone === 'ចាស់', ctx.scanHistory[0].phone);
        ok('គ្មាន opt-in ➜ មិនចូលជួរ', vm.runInContext('pendingHistoryPatches.size', ctx) === 0);
    });

    await scenario('ការបញ្ចូលគ្នា និងពិដាន', async () => {
        const item = { id: 'id1', callMark: 'no-answer', callMarkTime: 111 };
        const ctx = build('disconnect', { server: { id1: { id: 'id1' } }, scanHistory: [item], markingItemId: 'id1' });
        vm.runInContext('setCallMark("no-connect"); setCallMark("wrong-number");', ctx);
        await tick(); await tick(); await tick();
        ok('ការសម្គាល់ ២ ដងលើ id ដដែល ➜ ជួរនៅ ១ ធាតុ', vm.runInContext('pendingHistoryPatches.size', ctx) === 1);
        ok('ជួររក្សាតម្លៃចុងក្រោយ',
            vm.runInContext('pendingHistoryPatches.get("id1").fields.callMark', ctx) === 'wrong-number');

        const max = vm.runInContext('HISTORY_PATCH_RETRY_MAX', ctx);
        ok('HISTORY_PATCH_RETRY_MAX ជាលេខមានពិដាន', typeof max === 'number' && max >= 1 && max <= 20, max);
        for (let i = 0; i < max + 2; i++) {
            vm.runInContext('flushPendingHistoryPatches();', ctx);
            await tick(); await tick();
        }
        ok('ការដាច់បណ្តាញមិនចេះចប់ ➜ ជួរមិនរីកគ្មានពិដាន',
            vm.runInContext('pendingHistoryPatches.size', ctx) <= 1);
    });

    await scenario('ការកែវាលខុសគ្នាក្នុងជួរ ត្រូវ revert គ្រប់វាលពេល server បដិសេធ', async () => {
        const original = { id: 'id1', callMark: 'wrong-number', callMarkTime: 111, isCalled: false };
        const ctx = build('disconnect', { server: { id1: { ...original } }, scanHistory: [{ ...original }], markingItemId: 'id1' });
        await vm.runInContext('setCallMark("no-connect")', ctx);
        vm.runInContext('handleCallAction("id1")', ctx);
        await tick(); await tick();
        ok('វាលសម្គាល់ និង isCalled ចូលជួរតែមួយពិត',
            vm.runInContext('pendingHistoryPatches.get("id1").fields.isCalled', ctx) === true
            && vm.runInContext('pendingHistoryPatches.get("id1").fields.callMark', ctx) === 'no-connect');
        ctx.__mode.value = 'denied';
        vm.runInContext('flushPendingHistoryPatches()', ctx);
        await tick(); await tick();
        ok('ការបដិសេធ queued patch ដែលបញ្ចូលគ្នា ➜ ស្ដាររាល់វាលទៅតម្លៃមុនការកែដំបូង',
            JSON.stringify(ctx.scanHistory[0]) === JSON.stringify(original), ctx.scanHistory[0]);
    });

    await scenario('ការបដិសេធ retry ចាស់មកក្រោយ មិនត្រូវសរសេរជាន់ស្លាកថ្មីក្នុងជួរ', async () => {
        const item = { id: 'id1', callMark: 'no-answer', callMarkTime: 111 };
        const ctx = build('disconnect', { server: { id1: { ...item } }, scanHistory: [item], markingItemId: 'id1' });
        await vm.runInContext('setCallMark("no-connect")', ctx);
        const delayed = [];
        const realTransaction = ctx.fb.runTransaction;
        ctx.fb.runTransaction = () => new Promise((resolve, reject) => delayed.push({ resolve, reject }));
        vm.runInContext('flushPendingHistoryPatches(); setCallMark("wrong-number")', ctx);
        ok('retry ចាស់ និងការកែថ្មីកំពុងរង់ចាំពិត', delayed.length === 2, delayed.length);
        delayed[1].reject(new Error('disconnect'));
        await tick(); await tick();
        delayed[0].reject(new Error('disconnect'));
        await tick(); await tick();
        ok('retry ចាស់ដែលបដិសេធក្រោយ ➜ ជួររក្សាជម្រើសថ្មីរបស់អ្នកប្រើ',
            vm.runInContext('pendingHistoryPatches.get("id1").fields.callMark', ctx) === 'wrong-number');
        ctx.fb.runTransaction = realTransaction;
        ctx.__mode.value = 'ok';
        vm.runInContext('flushPendingHistoryPatches()', ctx);
        await tick(); await tick();
        ok('ភ្ជាប់មកវិញក្រោយ response មកបញ្ច្រាសលំដាប់ ➜ server ទទួលស្លាកថ្មី',
            ctx.__server.id1.callMark === 'wrong-number', ctx.__server.id1);
    });

    await scenario('callback patch ចាស់មិនអាចចូលជួរឬសរសេរលើ session ថ្មី', async () => {
        const item = { id: 'id1', callMark: 'no-answer', callMarkTime: 111 };
        const ctx = build('ok', { server: { id1: { ...item } }, scanHistory: [item], markingItemId: 'id1' });
        let rejectOld;
        ctx.fb.runTransaction = () => new Promise((resolve, reject) => { rejectOld = reject; });
        const pending = vm.runInContext('setCallMark("wrong-number")', ctx);
        vm.runInContext('authGeneration++; pendingHistoryPatches.clear(); historyPatchFlushInFlight = false;', ctx);
        ctx.scanHistory = [{ id: 'id1', callMark: 'new-session', callMarkTime: 222 }];
        rejectOld(new Error('disconnect'));
        await pending;
        ok('ចាកចេញមុន disconnect callback ➜ មិនបង្កើត queued write សម្រាប់ session ថ្មី',
            vm.runInContext('pendingHistoryPatches.size', ctx) === 0);
        ok('callback របស់ session ចាស់ ➜ មិនកែ state ឬបញ្ចេញ toast នៅ session ថ្មី',
            ctx.scanHistory[0].callMark === 'new-session' && ctx.__toasts.length === 0, ctx.__toasts);
    });

    await scenario('transaction ចាស់ផុតសុពលភាពពេលប្តូរ Database', async () => {
        const item = { id: 'id1', callMark: 'no-answer', callMarkTime: 111 };
        const ctx = build('ok', { server: { id1: { ...item } }, scanHistory: [item], markingItemId: 'id1' });
        let updateOld, resolveOld;
        ctx.fb.runTransaction = (ref, updater) => {
            updateOld = updater;
            updater({ ...item });
            return new Promise((resolve) => { resolveOld = resolve; });
        };
        const pending = vm.runInContext('setCallMark("wrong-number")', ctx);
        ctx.db = {};
        const staleUpdate = updateOld({ id: 'id1', callMark: 'new-session' });
        ok('SDK retry updater ក្រោយប្តូរ Database ➜ បោះបង់ transaction ចាស់', staleUpdate === undefined, staleUpdate);
        resolveOld({ committed: true, snapshot: { val: () => ({ id: 'id1', callMark: 'wrong-number' }) } });
        await pending;
        ok('ack ជោគជ័យចាស់ក្រោយប្តូរ Database ➜ មិនអះអាងថា session ថ្មីបានរក្សាទុក', ctx.__toasts.length === 0, ctx.__toasts);
    });

    await scenario('flush ចាស់មិនអាចដោះសោរបស់ flush នៅ session ថ្មី', async () => {
        const item = { id: 'id1', callMark: 'no-answer', callMarkTime: 111 };
        const ctx = build('disconnect', { server: { id1: { ...item } }, scanHistory: [item], markingItemId: 'id1' });
        await vm.runInContext('setCallMark("no-connect")', ctx);
        const delayed = [];
        ctx.fb.runTransaction = () => new Promise((resolve, reject) => delayed.push({ resolve, reject }));
        vm.runInContext('flushPendingHistoryPatches()', ctx);
        vm.runInContext('authGeneration++; pendingHistoryPatches.clear(); historyPatchFlushInFlight = false;', ctx);
        vm.runInContext('queueHistoryPatchRetry("id1", { callMark: "wrong-number" }, { callMark: "no-answer" }); flushPendingHistoryPatches();', ctx);
        ok('flush ទាំងពីរបានចាប់ផ្ដើម transaction ពិត', delayed.length === 2, delayed.length);
        ctx.__toasts.length = 0;
        delayed[0].reject(new Error('disconnect'));
        await tick(); await tick();
        ok('callback flush ចាស់ ➜ មិនដោះសោថ្មី មិនបន្ថែមជួរចាស់ មិនបញ្ចេញ toast',
            vm.runInContext('historyPatchFlushInFlight && pendingHistoryPatches.size === 0', ctx) && ctx.__toasts.length === 0);
        delayed[1].reject(new Error('disconnect'));
        await tick(); await tick();
        ok('callback flush បច្ចុប្បន្ន ➜ ដោះសោ និងរក្សាជម្រើសបច្ចុប្បន្នសម្រាប់ retry',
            vm.runInContext('!historyPatchFlushInFlight && pendingHistoryPatches.get("id1").fields.callMark === "wrong-number"', ctx));
    });

    await scenario('កែលេខទូរស័ព្ទ មិនទូទាត់ស្ថិតិយកទៅ Database ថ្មីក្រោយប្តូរ session', async () => {
        const phoneSource = sliceFn('saveEditedPhone');
        ok('ស្រង់ saveEditedPhone ពិតសម្រាប់ផ្លូវ callback របស់ patch', !!phoneSource);
        for (const changedSession of [false, true]) {
            const item = { id: 'id1', phone: '012345678', scanDate: '2026-09-12', isClosed: true };
            const ctx = build('ok', { server: { id1: { ...item } }, scanHistory: [item] });
            const moves = [];
            ctx.editingItemId = 'id1';
            ctx.document = { getElementById: (id) => id === 'editPhoneInput' ? { value: '098765432' } : null };
            ctx.normalizeStoredPhone = (v) => v;
            ctx.getPickupPhoneKey = (v) => v.phone;
            ctx.reconstructPickupSet = () => ({});
            ctx.collectPickupMarks = () => [{ key: 'BARCODE', closed: true }];
            ctx.markPickupBarcodes = () => { moves.push('optimistic'); return [{ key: 'BARCODE' }]; };
            ctx.revertPickupMarks = () => { moves.push('revert'); };
            ctx.updateRecentPhonesList = () => {};
            ctx.applyCurrentFilter = () => {};
            let rejectPhone;
            ctx.fb.runTransaction = () => new Promise((resolve, reject) => { rejectPhone = reject; });
            vm.runInContext(phoneSource, ctx);
            const pending = vm.runInContext('saveEditedPhone()', ctx);
            ok('កែលេខទូរស័ព្ទ ➜ ប្តូរក្រុមស្ថិតិយកសិន មុនរង់ចាំ Firebase', moves.join(',') === 'optimistic', moves);
            if (changedSession) { ctx.authGeneration++; ctx.db = {}; }
            rejectPhone(new Error('permission_denied'));
            await pending;
            ok(changedSession
                ? 'callback phone ចាស់ ➜ មិន revert ស្ថិតិយកទៅ Database របស់ session ថ្មី'
                : 'ទិសផ្ទុយ ៖ phone ក្នុង session ដដែល ➜ permission_denied នៅតែ revert ស្ថិតិយក',
                moves.join(',') === (changedSession ? 'optimistic' : 'optimistic,revert'), moves);
        }
    });

    // ⛔ ពិដាន **ចំនួនធាតុ** ក្នុងជួរ — ដាច់ដោយឡែកពីពិដានចំនួនព្យាយាម។
    // ចន្លោះពិត (វាស់ក្នុងជុំ 2.20.3)៖ `HISTORY_PATCH_QUEUE_MAX` ត្រូវបានស្រង់
    // ចូល sandbox តែ **គ្មានការអះអាងឥរិយាបថណាមួយ** ➜ ការដកការពិនិត្យពិដាន
    // ចេញពី `queueHistoryPatchRetry()` **ឆ្លងកាត់ checker ទាំងអស់**។
    // ផលបើបាត់៖ ការដាច់បណ្តាញយូរ + ការសម្គាល់កញ្ចប់ច្រើន ➜ ជួររីកគ្មានពិដាន
    // ក្នុងសតិ ហើយរាល់ការភ្ជាប់មកវិញបាញ់ transaction ស្របគ្នាតាមទំហំជួរនោះ។
    // ⚠️ ចំនួនធាតុត្រូវគណនា **ធៀបនឹងពិដានពិត** — ចំនួនថេរដែលតូចជាងពិដាន
    // នឹងមិនប៉ះវាសោះ ➜ បៃតងក្លែងក្លាយ (កំហុសដែលជុំនេះជួបផ្ទាល់)។
    await scenario('ពិដានចំនួនធាតុក្នុងជួរ', async () => {
        const probe = build('disconnect', { server: {}, scanHistory: [] });
        const cap = vm.runInContext('HISTORY_PATCH_QUEUE_MAX', probe);
        ok('HISTORY_PATCH_QUEUE_MAX ជាលេខមានពិដានសមហេតុផល',
            typeof cap === 'number' && cap >= 1 && cap <= 500, cap);
        const total = cap + 25;
        const server = {};
        const scanHistory = [];
        for (let i = 0; i < total; i++) {
            server['id' + i] = { id: 'id' + i };
            scanHistory.push({ id: 'id' + i });
        }
        const ctx = build('disconnect', { server: server, scanHistory: scanHistory });
        for (let i = 0; i < total; i++) {
            vm.runInContext('markingItemId = "id' + i + '"; setCallMark("no-answer");', ctx);
            await tick();
        }
        const size = vm.runInContext('pendingHistoryPatches.size', ctx);
        ok('⛔ ធាតុ ' + total + ' ដែលដាច់បណ្តាញ ➜ ជួរឈប់ត្រឹមពិដាន (មិនរីកគ្មានព្រំដែន)',
            size <= cap, { size: size, cap: cap, total: total });
        ok('ជួរនៅតែទទួលយកធាតុពិត (ពិដានមិនធ្វើឲ្យវាទទេ)', size > 0, size);
    });

    // ⛔ ការបោះ **ដោយ synchronous** មិនត្រូវសម្លាប់ជួររហូតដល់ចប់វគ្គ។
    // 🔴 វាស់បានក្នុងជុំ 2.20.3 លើកូដមុនកែ៖ បើ `patchHistoryItemFields()` បោះ
    // ដោយ synchronous (ឧ. `fb.ref()` លើ app ដែល `deleteApp()` រួច — ផ្លូវស្តារ
    // SDK ធ្វើដូចនោះពិត) នោះ៖
    //   ១. ការបោះនោះឡើងផុតពី `entries.forEach` ➜ `done()` **មិនដែលរត់**
    //   ២. `historyPatchFlushInFlight` ជាប់ `true` **រហូត** ➜ រាល់ការ flush
    //      ក្រោយៗទៀតត្រូវបដិសេធនៅបន្ទាត់ទី ១ ➜ ការសម្គាល់ការខល **លែងសម្កាល់
    //      ទៅ server បានទៀត ពេញវគ្គ** — ជាកំហុសដដែលដែល 2.20.2 សរសេរដើម្បីកែ
    //   ៣. ធាតុដែលដកចេញពី Map រួច (មុនការព្យាយាម) **បាត់ទាំងស្រុង**
    // ⚠️ ការអះអាងត្រូវមាន **៣ ខាង** — «មិនបោះ» តែម្យ៉ាងអនុញ្ញាតឲ្យធាតុបាត់។
    await scenario('ការបោះដោយ synchronous មិនសម្លាប់ជួរ', async () => {
        const item = { id: 'id1', callMark: 'no-answer' };
        const ctx = build('throw', { server: { id1: { id: 'id1' } }, scanHistory: [item] });
        vm.runInContext('pendingHistoryPatches.set("id1", { fields: { isCalled: true }, previousFields: { isCalled: false }, attempts: 0 });', ctx);
        let escaped = null;
        try { vm.runInContext('flushPendingHistoryPatches();', ctx); }
        catch (e) { escaped = (e && e.message) || String(e); }
        await tick(); await tick();
        ok('⛔ ការបោះមិនឡើងផុតពី flushPendingHistoryPatches()', escaped === null, escaped);
        ok('⛔ សោ flush ត្រូវដោះវិញ (មិនជាប់ true រហូត)',
            vm.runInContext('historyPatchFlushInFlight', ctx) === false);
        ok('⛔ ធាតុមិនត្រូវបាត់ — ត្រូវត្រឡប់ចូលជួរវិញ',
            vm.runInContext('pendingHistoryPatches.size', ctx) === 1,
            vm.runInContext('pendingHistoryPatches.size', ctx));
        ok('ចំនួនព្យាយាមត្រូវកើនឡើង (មិនរង្វិលជុំគ្មានទីបញ្ចប់)',
            vm.runInContext('pendingHistoryPatches.get("id1").attempts', ctx) === 1,
            vm.runInContext('pendingHistoryPatches.get("id1") && pendingHistoryPatches.get("id1").attempts', ctx));

        // ជាន់ទី ២ ៖ ក្រោយបណ្តាញ/SDK ល្អវិញ ការ flush ត្រូវដើរបានពិត
        ctx.__mode.value = 'ok';
        vm.runInContext('flushPendingHistoryPatches();', ctx);
        await tick(); await tick();
        ok('⛔ ក្រោយ SDK ល្អវិញ ➜ ការ flush ដើរបានពិត (ជួរមិនស្លាប់)',
            vm.runInContext('pendingHistoryPatches.size', ctx) === 0 && ctx.__server.id1.isCalled === true,
            { size: vm.runInContext('pendingHistoryPatches.size', ctx), server: ctx.__server.id1 });
    });

    // ការអះអាងស្តាទិច ៖ ខ្សែសង្វាក់ត្រូវភ្ជាប់ពិត
    const infoFn = sliceFn('attachInfoListeners') || '';
    ok('.info/connected ដែលបៃតង ➜ ហៅ flushPendingHistoryPatches()',
        infoFn.indexOf('flushPendingHistoryPatches()') !== -1);
    const clearFn = sliceFn('clearSensitiveModalFields') || '';
    ok('ការចាកចេញ ➜ សម្អាតជួររង់ចាំ', clearFn.indexOf('pendingHistoryPatches.clear()') !== -1);
    const editFn = sliceFn('saveEditedPhone') || '';
    ok('saveEditedPhone មិនប្រើ retryOnDisconnect', editFn.indexOf('retryOnDisconnect') === -1);
    const callFn = sliceFn('handleCallAction') || '';
    ok('handleCallAction ប្រើនាឡិកា server មិនមែននាឡិកាឧបករណ៍',
        callFn.indexOf('getServerNow()') !== -1 && callFn.indexOf('Date.now()') === -1);

    console.log('\n' + pass + ' ok, ' + fail + ' FAIL');
    process.exit(fail ? 1 : 0);
})();
