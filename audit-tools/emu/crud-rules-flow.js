// បើកកូដពិតរបស់ ZoeW ក្នុង vm ➜ ចាប់រាល់ការសរសេរ ➜ ចាក់វាទៅ RTDB emulator
// ដែលកំពុងអនុវត្ត firebase-database.rules.json ពិត ➜ អះអាងថាគ្មានការបដិសេធ។
//
//   java -jar ~/.cache/firebase/emulators/firebase-database-emulator-*.jar --port 9000 --host 127.0.0.1
//   node audit-tools/emu/crud-rules-flow.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const http = require('http');
const { isDeepStrictEqual } = require('util');
const { emuNamespace } = require('./ns.js');

// ថត app អាច override បាន ដើម្បីឲ្យ `run-all.sh <baseline>` បញ្ជាក់បានថា
// ឯកសារនេះពិតជាអានកូដមែន (ច្បាប់ដដែលនឹង checker ទាំងអស់ក្នុងគម្រោង)។
const ROOT = process.env.CRUDFLOW_APP_DIR ? path.resolve(process.env.CRUDFLOW_APP_DIR) : path.join(__dirname, '..', '..');
const APP = path.join(ROOT, 'ZoeW', 'app.js');
const BASE = { host: '127.0.0.1', port: 9000 };
const NS = 'ns=' + emuNamespace('demo-zoe-crud');
const AUTH = 'auth_variable_override=' + encodeURIComponent(JSON.stringify({ uid: 'userA' }));

let pass = 0, fail = 0;
const check = (c, label, detail) => { if (c) { pass++; console.log('  ok    ' + label); } else { fail++; console.log('  FAIL  ' + label + (detail ? '\n        ' + detail : '')); } };
const clone = (v) => v === undefined ? undefined : JSON.parse(JSON.stringify(v));

function req(method, urlPath, body, asOwnerOnly) {
    return new Promise((resolve, reject) => {
        const payload = body === undefined ? null : JSON.stringify(body);
        const r = http.request({ ...BASE, method, path: urlPath, headers: Object.assign(
            { 'Authorization': 'Bearer owner' }, payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}) },
            (res) => { let d = ''; res.on('data', (c) => d += c); res.on('end', () => resolve({ status: res.statusCode, body: d })); });
        r.on('error', reject);
        if (payload) r.write(payload);
        r.end();
    });
}
const asOwner = (m, p, b) => req(m, p + (p.includes('?') ? '&' : '?') + NS, b);
const asUser = (m, p, b) => req(m, p + (p.includes('?') ? '&' : '?') + NS + '&' + AUTH, b);
const denied = (r) => r.status >= 400 || /Permission denied/.test(r.body);

function sliceBalanced(src, from) { let d = 0; for (let i = from; i < src.length; i++) { if (src[i] === '{') d++; else if (src[i] === '}') { d--; if (!d) return src.slice(from, i + 1); } } throw new Error('unbalanced'); }
function extractFn(src, name) {
    const m = new RegExp('\\n(\\s*)(async\\s+)?function ' + name + '\\s*\\(').exec(src);
    if (!m) throw new Error('missing fn: ' + name);
    const head = src.indexOf('function ' + name, m.index);
    const brace = src.indexOf('{', src.indexOf('(', head));
    return (m[2] ? 'async ' : '') + src.slice(head, brace) + sliceBalanced(src, brace);
}
const optionalFn = (src, n, fallback) => { try { return extractFn(src, n); } catch (e) { return fallback; } };
const optionalConst = (src, n, fallback) => { try { return extractConst(src, n); } catch (e) { return fallback; } };
const extractConst = (src, n) => { const m = new RegExp('\\n\\s*const ' + n + ' = ([^;]+);').exec(src); if (!m) throw new Error('missing const ' + n); return `const ${n} = ${m[1]};`; };

const src = fs.readFileSync(APP, 'utf8').replace(/\r\n?/g, '\n');
let SANDBOX_SOURCE = '';
let acorn = null;
try { acorn = require('acorn'); } catch (e) {}
const FNS = ['dbListenerViewIsStale', 'barcodeEntriesOf', 'recalcItemMoneyFromBarcodes', 'normalizeBarcodesOf', 'ensureBarcodeArrayForItem', 'stripHistoryOnlyMarkers', 'itemHasRestoreMarkers', 'dropStaleRestoreMarkers',
    'applyBarcodeCloseState', 'barcodeCloseIsRipe', 'barcodeAbandonIsRipe', 'barcodeAbandonBasis', 'itemAbandonRipeAt', 'normalizeBarcodeCloseStamps', 'parseTimestampFromId',
    'generateUniqueId', 'retryAsync', 'cloneRestoreItem', 'isActiveRestoreClaim', 'collectItemBarcodes',
    'getPickupPhoneKey', 'barcodeRegistryKey', 'pickupBarcodeKey', 'collectPickupMarks', 'reconstructPickupSet',
    'collectedDayOfStamp', 'collectedDayHoldingKey', 'collectedMarkValueOf', 'collectedMarksFor',
    'markCollectedRevenue', 'reconcileCollectedHistory', 'reconcileCollectedPriceState', 'collectedSetFromRecord', 'commitCollectedMarks',
    'getZoneDateKey', 'appZoneParts', 'statsMoney', 'statsPositive', 'ledgerNumber',
    'saveSingleDeletedItemToFirebase', 'deleteSingleDeletedItemFromFirebase',
    'restoreClaimedItemToScanHistory', 'clearStaleRestoreMarkers', 'releaseStaleRestoreClaimForPurge',
    'cleanupTrashCodes', 'cleanupLedgerDeducted', 'markCleanupTrashDeducted', 'cleanupBarcodesBackInHistory', 'applyCleanupRevenue', 'settleCleanupDeduction', 'resolveCleanupSlot', 'claimCleanupTrashSlot', 'claimAndCleanupItem', 'runAutomaticCleanupRules', 'deleteSingleItem', 'removeSingleBarcode',
    'buildClearHistoryTrashItem', 'toggleIndividualBarcodeClose', 'applyBarcodeCloseChange',
    'toggleCloseStatus', 'executePermanentDelete'];

// ⛔ 2.50.49 ៖ ការដកប្រាក់កញ្ចប់ផុតកំណត់ជាព្រឹត្តិការណ៍មានសោ (ខែ ➜ ថ្ងៃ · `ded/<trashId>` ក្នុង transaction ថ្ងៃ) ➜ ផ្ទុក function ពិត
//    ដើម្បីឲ្យ payload `ded` ពិតទៅដល់ rules ពិត (ផ្នែក ៥)។ tree មុនកែ ➜ stub (ផ្លូវចាស់មិនហៅវា)។
const KEYED_FNS = ['ledgerDeltaWithClamp', 'ledgerAppliedDelta', 'applyLedgerBucketDelta', 'ledgerOpRingOf', 'ledgerOpRing', 'ledgerOpWitness',
    'ledgerTagged', 'runLedgerTransaction', 'ledgerEventToken', 'ledgerRecordTokens', 'ledgerTokenSeen', 'ledgerPriorSeen', 'ledgerDedOf',
    'ledgerDedValue', 'ledgerCarryDed', 'ledgerTotalsOf', 'ledgerLatestMonths', 'ledgerMirrorStep', 'ledgerEventDecision', 'commitLedgerEventStep',
    'cleanupScanDateOf', 'cleanupEventAt', 'cleanupEventAmounts', 'cleanupLedgerPrior', 'deductCleanupLedgerKeyed', 'deductCleanupRevenue',
    'patchCleanupJournalEntry', 'noteCleanupLedgerTry', 'undoCleanupLedgerKeyed', 'undoCleanupRevenue', 'cleanupLedgerResult', 'cleanupPartialTrashId', 'trashSlotSharesClaim'];

// អានឈ្មោះដែលប្រើពិតតាម scope៖ ថេរ/state ក៏ជា dependency ដូច function call ដែរ។
// អថេរមូលដ្ឋានរបស់ function មួយ មិនអាចលាក់ global ដែលបាត់ក្នុង function ផ្សេងបានទេ។
function sandboxUnresolvedNames(ast, globals) {
    const root = { parent: null, names: new Set(globals), fn: true };
    const references = [];
    const childScope = (parent, fn = false) => ({ parent, names: new Set(), fn });
    function bind(pattern, target, scope) {
        if (!pattern) return;
        if (pattern.type === 'Identifier') target.names.add(pattern.name);
        else if (pattern.type === 'RestElement') bind(pattern.argument, target, scope);
        else if (pattern.type === 'AssignmentPattern') { bind(pattern.left, target, scope); walk(pattern.right, scope); }
        else if (pattern.type === 'ArrayPattern') pattern.elements.forEach((entry) => bind(entry, target, scope));
        else if (pattern.type === 'ObjectPattern') pattern.properties.forEach((entry) => {
            if (entry.type === 'RestElement') bind(entry.argument, target, scope);
            else { if (entry.computed) walk(entry.key, scope); bind(entry.value, target, scope); }
        });
    }
    function walk(node, scope) {
        if (!node || typeof node.type !== 'string') return;
        if (node.type === 'Identifier') { references.push({ name: node.name, scope }); return; }
        if (/^(FunctionDeclaration|FunctionExpression|ArrowFunctionExpression)$/.test(node.type)) {
            if (node.type === 'FunctionDeclaration' && node.id) scope.names.add(node.id.name);
            const local = childScope(scope, true);
            if (node.id) local.names.add(node.id.name);
            if (node.type !== 'ArrowFunctionExpression') local.names.add('arguments');
            node.params.forEach((param) => bind(param, local, local));
            walk(node.body, childScope(local, true));
            return;
        }
        if (node.type === 'VariableDeclaration') {
            let target = scope;
            if (node.kind === 'var') while (target.parent && !target.fn) target = target.parent;
            node.declarations.forEach((entry) => { bind(entry.id, target, scope); walk(entry.init, scope); });
            return;
        }
        if (node.type === 'MemberExpression' || node.type === 'Property' || node.type === 'MethodDefinition') {
            if (node.object) walk(node.object, scope);
            if (node.computed) walk(node.property || node.key, scope);
            if (node.value) walk(node.value, scope);
            return;
        }
        if (node.type === 'CatchClause') {
            const local = childScope(scope);
            bind(node.param, local, local);
            walk(node.body, local);
            return;
        }
        if (node.type === 'ClassDeclaration' || node.type === 'ClassExpression') {
            if (node.type === 'ClassDeclaration' && node.id) scope.names.add(node.id.name);
            const local = childScope(scope);
            if (node.id) local.names.add(node.id.name);
            walk(node.superClass, local);
            walk(node.body, local);
            return;
        }
        if (node.type === 'LabeledStatement') { walk(node.body, scope); return; }
        if (node.type === 'BreakStatement' || node.type === 'ContinueStatement' || node.type === 'MetaProperty') return;
        if (/^(BlockStatement|ForStatement|ForInStatement|ForOfStatement|SwitchStatement)$/.test(node.type)) scope = childScope(scope);
        for (const value of Object.values(node)) {
            if (Array.isArray(value)) value.forEach((entry) => walk(entry, scope));
            else if (value && typeof value === 'object') walk(value, scope);
        }
    }
    walk(ast, root);
    return new Set(references.filter(({ name, scope }) => {
        for (let current = scope; current; current = current.parent) if (current.names.has(name)) return false;
        return true;
    }).map(({ name }) => name));
}

// ---- vm ដែលចាប់រាល់ការសរសេរ (មិនអនុវត្ត rules) ----
function makeSandbox(store, now) {
    const w = { store, now, writes: [], toasts: [], revenueCalls: [] };
    const get = (raw) => { let c = store; for (const p of String(raw || '').split('/').filter(Boolean)) { if (!c || typeof c !== 'object') return null; c = c[p]; } return c === undefined ? null : c; };
    const set = (raw, v) => { const parts = String(raw || '').split('/').filter(Boolean); let c = store; for (let i = 0; i < parts.length - 1; i++) { if (!c[parts[i]] || typeof c[parts[i]] !== 'object') c[parts[i]] = {}; c = c[parts[i]]; } const k = parts[parts.length - 1]; if (v === null) delete c[k]; else c[k] = clone(v); };
    const fb = {
        ref: (db, raw) => ({ path: raw === undefined ? '' : String(raw) }),
        increment: (n) => ({ '.sv': { increment: Number(n) } }),
        get: (ref) => { const v = get(ref.path); return Promise.resolve({ exists: () => v !== null, val: () => clone(v) }); },
        runTransaction: (ref, up) => Promise.resolve().then(() => {
            const next = up(clone(get(ref.path)));
            if (next === undefined) return { committed: false, snapshot: { val: () => clone(get(ref.path)) } };
            w.writes.push({ method: 'PUT', path: ref.path, value: next === null ? null : clone(next) });
            set(ref.path, next);
            return { committed: true, snapshot: { val: () => clone(get(ref.path)) } };
        }),
        update: (ref, updates) => Promise.resolve().then(() => {
            w.writes.push({ method: 'PATCH', path: ref.path, value: clone(updates) });
            Object.entries(updates).forEach(([k, v]) => {
                const full = [ref.path, k].filter(Boolean).join('/');
                set(full, v);
            });
            if (ref.path === 'zoew_daily_collected_cod_dod') {
                const collected = clone(get(ref.path) || {});
                Object.keys(collected).forEach(day => { if (!collected[day] || !Object.keys(collected[day]).length) delete collected[day]; });
                ctx.dailyCollectedData = collected;
            }
        }),
        remove: (ref) => Promise.resolve().then(() => { w.writes.push({ method: 'PUT', path: ref.path, value: null }); set(ref.path, null); })
    };
    const ctx = vm.createContext({
        console, setTimeout, clearTimeout, Promise, Math, Date, JSON, Set, Map, window: {}, ZoeErrors: null,
        navigator: { onLine: true },
        db: {}, authGeneration: 0, fb,
        // `cleanupJournalScope()` អាន `auth` តែលើ Config Supabase (Firebase ➜ `databaseURL` មុន) ➜ គ្មាន user ក្នុង sandbox នេះ
        auth: null,
        dbRefDeleted: fb.ref({}, 'zoew_recently_deleted_cod_dod'),
        dbRefHistory: fb.ref({}, 'zoew_scan_history_cod_dod'),
        dbRefDailyPickup: fb.ref({}, 'zoew_daily_pickup_cod_dod'),
        dbRefDailyCollected: fb.ref({}, 'zoew_daily_collected_cod_dod'),
        dbRefDailyRevenue: fb.ref({}, 'zoew_daily_revenue_cod_dod'),
        dbRefMonthlyRevenue: fb.ref({}, 'zoew_monthly_revenue_cod_dod'),
        dailyRevenueData: {}, monthlyRevenueData: {}, crypto: globalThis.crypto,
        getServerNow: () => w.now, getFormattedDate: () => '2026-08-26',
        // ⛔ តេស្តនេះវាស់ **payload ↔ rules** មិនមែនលេខ ledger — តែ stub ត្រូវ
        // រក្សា **រូបរាងពិត** (ត្រឡប់ delta ដែលអនុវត្ត) បើមិនដូច្នេះផ្លូវដកវិញ
        // ក្លាយជា no-op ស្ងាត់ ហើយ `ReferenceError` នឹងលេចតែពេលមានសេណារីយ៉ូថ្មី។
        addRevenueToDailyAndMonthlyRecord: (d, cod, dod, count) => {
            w.revenueCalls.push({ scanDate: d, cod, dod, count });
            return {
            scanDate: d,
            daily: { cod: parseFloat(cod) || 0, dod: parseFloat(dod) || 0, count: parseFloat(count) || 0 },
            monthly: { cod: parseFloat(cod) || 0, dod: parseFloat(dod) || 0, count: parseFloat(count) || 0 },
            dailyServer: Promise.resolve(null), monthlyServer: Promise.resolve(null)
            };
        },
        correctRevenueLedgerToActual: () => Promise.resolve({
            ok: true,
            daily: { cod: 0, dod: 0, count: 0 },
            monthly: { cod: 0, dod: 0, count: 0 }
        }),
        markPickupBarcodes: (d, marks, seed) => ({
            scanDate: d, marks: marks || [], seed: seed || null, previous: [], changed: false
        }),
        revertRevenueLedgerDelta: (applied) => applied || null,
        revertPickupMarks: (applied) => applied || null,
        reapplyPickupMarks: (applied) => applied || null,
        dailyPickupData: {},
        dailyCollectedData: {},
        showToast: (m) => w.toasts.push(m), confirm: () => true, alert: () => {},
        openViewListModal: () => {}, refreshCurrentHistoryView: () => {}, updateRecentPhonesList: () => {},
        renderRecentlyDeleted: () => {}, openRecentlyDeletedModal: () => {}, closeModal: () => {},
        releaseBarcodesInRegistry: () => Promise.resolve(), collectPhoneSuggestions: () => [],
        clearScannedRemovalInFlight: () => {},
        document: { getElementById: () => null },
        scanHistory: [], deletedItems: [], pendingPermanentDeleteId: null, activeParentItemId: null, scanRemoveInFlight: null
    });
    const assembled = [
        extractConst(src, 'TWO_HOURS_MS'), extractConst(src, 'ABANDON_AGE_MS'), extractConst(src, 'RESTORE_CLAIM_LEASE_MS'),
        extractConst(src, 'APP_TIME_ZONE'), extractConst(src, 'APP_TIME_ZONE_OFFSET_MINUTES'),
        extractConst(src, 'PICKUP_DATE_KEY_PATTERN'), extractConst(src, 'DAILY_COLLECTED_KEEP_DAYS'),
        extractConst(src, 'PICKUP_PHONE_KEY_MAX') || 'const PICKUP_PHONE_KEY_MAX = 64;',
        // ⛔ ពិដានការហៅ Firebase (db-stall-guard) ជាហេដ្ឋារចនាសម្ព័ន្ធរួម ➜ function ពិត
        extractConst(src, 'DB_OP_TIMEOUT_MS'), extractFn(src, 'withTimeout'), extractFn(src, 'dbOp'), extractFn(src, 'dbOpStalled'),
        // ⛔ សារវឌ្ឍនភាពនៃការសរសេរធុងសំរាម (2.25.8) ក៏ជាហេដ្ឋារចនាសម្ព័ន្ធរួមដែរ ➜
        // ផ្ទុក function ពិត។ លើ tree មុនកែវាអវត្តមាន ➜ stub (កុំបញ្ឈប់ checker)។
        optionalConst(src, 'TRASH_WRITE_SLOW_NOTICE_MS', 'const TRASH_WRITE_SLOW_NOTICE_MS = 15000;'),
        optionalFn(src, 'notifyIfSlow', 'function notifyIfSlow(p) { return p; }'),
        optionalFn(src, 'armLateWrite', 'function armLateWrite() { return false; }'),
        // ⛔ ២ ខាងក្រោមឈរក្នុងផ្លូវ **ព្យួរ** របស់ «ដក»/«លុប» ➜ សេណារីយ៉ូនៅទីនេះ
        // មិនប៉ះវា តែការត្រួតពិនិត្យរចនាសម្ព័ន្ធរកឃើញថាវាអវត្តមាន (2.25.8)។
        optionalFn(src, 'armLateCommit', 'function armLateCommit() { return false; }'),
        optionalFn(src, 'viewListModalShowing', 'function viewListModalShowing() { return false; }'),
        // App React ៖ `viewListModalShowing()` អានស្ថានភាពប្រអប់តាម `modalIsOpen()` ➜ function ពិត (ទិដ្ឋភាពអាន DOM
        // ដូច App ដើម ➜ `document.getElementById` ក្នុង sandbox ត្រឡប់ null ➜ «មិនបើក»); tree vanilla ➜ stub ដដែល។
        optionalFn(src, 'modalDisplay', 'function modalDisplay() { return undefined; }'),
        optionalFn(src, 'modalIsOpen', 'function modalIsOpen() { return false; }'),
        // ⛔ `settleLockWithin` ដោះសោការសម្អាត/ការស្កេនដក តាមពិដាន ដោយមិន
        // បោះបង់ការងារ ➜ ផ្ទុក function ពិត; tree មុនកែ ➜ stub ដែលរក្សា
        // ឥរិយាបថដើម (រង់ចាំពេញ · បញ្ជូនតម្លៃត្រឡប់)។
        optionalConst(src, 'LOCK_STALL_RELEASE_MS', 'const LOCK_STALL_RELEASE_MS = 15000;'),
        optionalFn(src, 'settleLockWithin', 'function settleLockWithin(p) { return Promise.resolve(p); }'),
        // ⛔ អ្នកដោះ `clearClaim` ដែលងាប់ ត្រូវហៅពី `runAutomaticCleanupRules()` ➜
        // sandbox ត្រូវផ្ទុក function ពិត; tree មុនកែ ➜ stub គ្មានផលរំខាន។
        optionalFn(src, 'isActiveClearHistoryClaim', 'function isActiveClearHistoryClaim() { return false; }'),
        optionalFn(src, 'releaseStaleClearHistoryClaim', 'function releaseStaleClearHistoryClaim() {}'),
        // ⛔ ច្រកទ្វារនាឡិការបស់ការសម្អាត (2.20.5) ➜ ផ្ទុក function ពិត បូក
        // `serverClockTrusted = true` ដែលជាស្ថានភាព App ដែលភ្ជាប់រួច។
        // ⛔ journal នៃការសម្អាត (2.37.2) ៖ វាធានាថាការរំខានពាក់កណ្តាលមិនលុប
        // កញ្ចប់ ➜ ផ្ទុក function ពិត; tree មុនកែ ➜ stub គ្មានផលរំខាន។
        optionalConst(src, 'CLEANUP_JOURNAL_KEY', "const CLEANUP_JOURNAL_KEY = 'zoew_cleanup_journal_v1';"),
        optionalConst(src, 'CLEANUP_JOURNAL_MAX', 'const CLEANUP_JOURNAL_MAX = 200;'),
        optionalConst(src, 'CLEANUP_STAGE_MOVED', "const CLEANUP_STAGE_MOVED = 'moved';"),
        optionalConst(src, 'CLEANUP_STAGE_LEDGER', "const CLEANUP_STAGE_LEDGER = 'ledger';"),
        optionalConst(src, 'CLEANUP_STAGE_FLIP', "const CLEANUP_STAGE_FLIP = 'flip';"),
        optionalConst(src, 'CLEANUP_STAGE_SLOT', "const CLEANUP_STAGE_SLOT = 'slot';"),
        'const appLocalStore = (function () { const d = {}; return { getItem: (k) => (Object.prototype.hasOwnProperty.call(d, k) ? d[k] : null), setItem: (k, v) => { d[k] = String(v); }, removeItem: (k) => { delete d[k]; } }; })();',
        optionalFn(src, 'safeStoreGet', 'function safeStoreGet(store, key) { try { return store ? store.getItem(key) : null; } catch (e) { return null; } }'),
        optionalFn(src, 'safeStoreSet', 'function safeStoreSet(store, key, value) { try { return store ? (store.setItem(key, String(value)), true) : false; } catch (e) { return false; } }'),
        optionalFn(src, 'safeStoreRemove', 'function safeStoreRemove(store, key) { try { return store ? (store.removeItem(key), true) : false; } catch (e) { return false; } }'),
        optionalFn(src, 'shopScope', "function shopScope() { return ''; }"),
        optionalFn(src, 'cleanupJournalScope', "function cleanupJournalScope() { return ''; }"),
        optionalFn(src, 'cleanupJournalScopeMismatch', 'function cleanupJournalScopeMismatch() { return false; }'),
        optionalFn(src, 'readCleanupJournal', 'function readCleanupJournal() { return []; }'),
        optionalFn(src, 'writeCleanupJournal', 'function writeCleanupJournal() {}'),
        optionalFn(src, 'noteCleanupJournalEntry', 'function noteCleanupJournalEntry() {}'),
        optionalFn(src, 'markCleanupJournalStage', 'function markCleanupJournalStage() {}'),
        optionalFn(src, 'clearCleanupJournalEntry', 'function clearCleanupJournalEntry() {}'),
        // ⛔ ភាពរស់នៃការសម្អាត (2.42.7) ៖ អ្នកស្តារ journal មិនប៉ះការសម្អាតដែលនៅរស់ ➜ function ពិត (គ្មាន `navigator` ➜ គ្មាន Web Locks)
        optionalConst(src, 'cleanupJournalLive', 'const cleanupJournalLive = new Map();'),
        optionalConst(src, 'CLEANUP_LIVE_LOCK_PREFIX', "const CLEANUP_LIVE_LOCK_PREFIX = 'zoew-cleanup-live-';"),
        optionalFn(src, 'cleanupLockManager', 'function cleanupLockManager() { return null; }'),
        optionalFn(src, 'markCleanupJournalLive', 'function markCleanupJournalLive() {}'),
        optionalFn(src, 'releaseCleanupJournalLive', 'function releaseCleanupJournalLive() {}'),
        // ⛔ ZTO-E1 ៖ `runAutomaticCleanupRules()` សួរ `ztoAbandonCleanupIsHeld()` មុន `abandon` ➜ sandbox គ្មាន ZTO ➜ ច្រកទ្វារពិតឆ្លើយ
        //    `false` (វាស់ដោយ module ពិតក្នុង `ZoeW/tests/zto-abandon-signed-gate.test.tsx`)។
        'function ztoAbandonCleanupIsHeld() { return false; }',
        // ⛔ SCALE-2 ៖ ការហៅដោយគ្មាន limit (sandbox នេះ) មិនអាន state ជុំ batch ទេ ➜ stub តែដើម្បីឲ្យឈ្មោះមានក្នុង scope (ការវាស់ batch ៖ `ZoeW/tests/cleanup-sweep-batch.test.ts`)
        "const dataState = { cleanupSweepVisited: new Set(), cleanupSweepTimer: null };", 'function scheduleCleanupSweepContinuation() {}',
        'let serverClockTrusted = true, isDatabaseConnected = true;', extractFn(src, 'cleanupClockIsTrustworthy'),
        'const cleanupInFlight = new Set();', 'const staleRestoreMarkerSweeps = new Set();', 'const staleClearClaimSweeps = new Set();', 'const activeClearHistoryClaims = new Map();', 'const CLEAR_HISTORY_CLAIM_LEASE_MS = 120000;', 'const dbListenerPendingPaths = new Set();', 'const dbListenerFailedPaths = new Set();', 'const dbListenerReportedFailures = new Set();', "const DB_LISTENER_KEY_DELETED = 'deleted';", "const DB_LISTENER_KEY_HISTORY = 'history';",
        // store ក្លែងមិនបដិសេធ `disconnect` ទេ ➜ `result.txOutcome === 'applied'` មិនកើត ➜ ផ្លូវនេះ **មិនត្រូវហៅ**
        // (ការវាស់របស់វាជារបស់ `tx-outcome-test` · `emu/tx-disconnect-emu-test`) ➜ ហៅ = បោះ ➜ ធ្លាក់ មិនមែនបៃតងស្ងាត់
        "async function cleanupClaimAccountedElsewhere() { throw new Error('crud-rules-flow: ផ្លូវ disconnect មិនត្រូវបានគំរូ'); }", 'const activeRestoreClaims = new Map();',
        'let deletedCleanupInFlight = false;',
        optionalConst(src, 'LEDGER_OP_RING_MAX', 'const LEDGER_OP_RING_MAX = 12;'),
        optionalConst(src, 'CLEANUP_STAGE_UNDO', "const CLEANUP_STAGE_UNDO = 'undo';"),
        optionalConst(src, 'CLEANUP_LEDGER_KEYED', "const CLEANUP_LEDGER_KEYED = 'keyed';"),
        optionalConst(src, 'CLEANUP_LEDGER_LEGACY', "const CLEANUP_LEDGER_LEGACY = 'legacy';"),
        optionalConst(src, 'CLEANUP_LEDGER_RETRY_MAX', 'const CLEANUP_LEDGER_RETRY_MAX = 10;'),
        optionalConst(src, 'CLEANUP_NO_PRIOR', 'const CLEANUP_NO_PRIOR = { d: [], m: [] };'),
        ...KEYED_FNS.map((n) => optionalFn(src, n, 'function ' + n + '() { return null; }')),
        ...FNS.map((n) => extractFn(src, n)),
        'globalThis.api = { ' + FNS.join(', ') + ' };'
    ].join('\n\n');
    SANDBOX_SOURCE = assembled;
    new vm.Script(assembled).runInContext(ctx);
    // ⛔ `dbOp` ពិតហៅ `probeDatabaseLiveness()` ពេលព្យួរ (ការវាស់ភាពរស់ ៖ `emu/app-network-e2e-test`) ➜ stub «មិនវាស់»
    vm.runInContext('var probeDatabaseLiveness = function () { return Promise.resolve(null); };', ctx);
    w.ctx = ctx;
    w.sync = () => {
        const h = get('zoew_scan_history_cod_dod') || {};
        ctx.scanHistory.length = 0; Object.keys(h).forEach((k) => ctx.scanHistory.push(clone(h[k])));
        const t = get('zoew_recently_deleted_cod_dod') || {};
        ctx.deletedItems.length = 0; Object.keys(t).forEach((k) => ctx.deletedItems.push(clone(t[k])));
        ctx.dailyCollectedData = clone(get('zoew_daily_collected_cod_dod') || {});
    };
    w.drain = async () => { for (let i = 0; i < 30; i++) await new Promise((r) => setTimeout(r, 0)); };
    w.sync();
    return w;
}

const T0 = Date.now() - 3600000;
const bc = (code, cod, closed, closedAt) => Object.assign({ code, cod, dod: 0, locker: 'N/A', time: 't', isClosed: !!closed, isDeducted: false, isFromDeletion: false, createdAt: T0 }, closed && closedAt !== undefined ? { closedAt } : {});
const parcel = (id, barcodes, extra) => Object.assign({ id, phone: '098000880', scanDate: '2026-08-26', createdAt: T0, time: 't', barcodes, count: barcodes.length, cod: barcodes.reduce((s, b) => s + b.cod, 0), dod: 0, price: barcodes.reduce((s, b) => s + b.cod, 0), barcode: barcodes[0].code, isClosed: barcodes.every((b) => b.isClosed), isCalled: false }, extra || {});

async function replay(label, writes) {
    await asOwner('PUT', '/zoew_restore_finalizations.json', {});
    let bad = null;
    for (const wr of writes) {
        const r = await asUser(wr.method || 'PUT', `/${wr.path}.json`, wr.value);
        if (denied(r)) { bad = { path: wr.path, body: r.body.slice(0, 120) }; break; }
    }
    check(!bad, label, bad ? `បដិសេធនៅ ${bad.path}` : '');
    return !bad;
}

async function seedServer(store) { await asOwner('PUT', '/.json', store); }

async function clearOrphanBeforeRetry(w, label) {
    const start = w.writes.length;
    const item = clone(w.store.zoew_scan_history_cod_dod.id_x);
    w.ctx.clearStaleRestoreMarkers(item);
    await w.drain();
    w.sync();
    const cleared = w.store.zoew_scan_history_cod_dod.id_x;
    const sweepWrites = w.writes.slice(start);
    check(sweepWrites.length === 1 && sweepWrites[0].path === 'zoew_scan_history_cod_dod/id_x' &&
        sweepWrites[0].value && !sweepWrites[0].value.restoreClaimId && !sweepWrites[0].value.restoreClaimToken &&
        cleared && !cleared.restoreClaimId && !cleared.restoreClaimToken,
        label + ' ➜ async stale sweep សរសេរលុប marker ពិតមុន retry', JSON.stringify(sweepWrites));
    check(w.revenueCalls.length === 0, label + ' ➜ ការដោះ marker មិនប៉ះប្រាក់');
}

(async () => {
    console.log('crud-rules-flow — payload ពិត ធៀបនឹង firebase rules ពិត (RTDB emulator)\n');
    const strictMode = process.env.CRUD_FLOW_STRICT === '1';

    // ⛔ **ការសាង sandbox ជាការងារ local — វា *មិន* ត្រូវការ emulator ទេ។**
    // មុនកំណែ 2.20.1 ការពិនិត្យ emulator មកមុនគេ ➜ គ្មាន emulator ➜ SKIP
    // **ទាំងស្រុង** ➜ ការខូចនៃ sandbox (ថេរដែលបាត់ · function ដែលប្តូរឈ្មោះ ·
    // syntax ដែលបែក) **មើលមិនឃើញនៅមូលដ្ឋានទាល់តែសោះ** ➜ វាលេចតែក្នុង CI។
    //
    // នោះជាអ្វីដែលកើតឡើងពិត៖ ការបន្ថែម `DB_LISTENER_KEY_DELETED` ចូល
    // `app.js` ធ្វើឲ្យ `dropStaleRestoreMarkers()` បោះ `ReferenceError`
    // ក្នុង vm ➜ `run-all.sh` នៅមូលដ្ឋាន **បៃតងទាំង ៩៥** ➜ CI ក្រហម។
    //
    // ច្បាប់ (ដដែលនឹង `scan-engine-test.js` ក្នុង CLAUDE.md)៖ **SKIP ត្រូវ
    // រក្សាទុកសម្រាប់ dependency របស់បរិស្ថានតែប៉ុណ្ណោះ** — ហើយការរត់កូដ
    // របស់ repo ខ្លួនឯងក្នុង `vm` មិនមែនជា dependency បរិស្ថានទេ។
    // ដូច្នេះការស្រង់ + ការសាង + ការហៅ smoke រត់ **មុន** ច្រកទ្វារ emulator
    // ហើយការបរាជ័យរបស់វាជា **ការធ្លាក់ ទោះគ្មាន emulator ក៏ដោយ**។
    try {
        const smoke = makeSandbox({}, Date.now());
        const marked = { id: 'smoke_1', restoreClaimId: 'trash_smoke', restoreClaimToken: 'tok_smoke' };
        smoke.ctx.api.dropStaleRestoreMarkers(marked);
        smoke.ctx.api.itemHasRestoreMarkers(marked);
        smoke.ctx.api.normalizeBarcodesOf({ id: 'smoke_1', barcodes: [{ code: 'A', cod: 1, dod: 0 }] });
        smoke.ctx.api.stripHistoryOnlyMarkers({ id: 'smoke_1', restoreClaimId: 'x' });
        smoke.ctx.api.runAutomaticCleanupRules();
        // រត់ផ្លូវចំណូលពិតមុនភ្ជាប់ emulator៖ state/ref ដែលបាត់ មិនត្រូវលាក់ក្រោយ SKIP។
        const smokeDay = '2026-08-27';
        const smokeStamp = Date.parse('2026-08-26T17:30:00Z');
        const smokeKey = smoke.ctx.api.pickupBarcodeKey('SMOKE_COLLECTED');
        const collectedBarcode = { code: 'SMOKE_COLLECTED', cod: 4.57, dod: 1.25, closedAt: smokeStamp };
        const collectedMarks = smoke.ctx.api.collectedMarksFor(collectedBarcode, true);
        smoke.ctx.api.markCollectedRevenue(collectedMarks);
        await smoke.drain();
        const smokeRecord = { [smokeKey]: { c: 4.57, d: 1.25 } };
        check(isDeepStrictEqual(clone(smoke.ctx.dailyCollectedData[smokeDay]), smokeRecord) &&
            smoke.writes.some((wr) => wr.method === 'PATCH' && wr.path === 'zoew_daily_collected_cod_dod' &&
                isDeepStrictEqual(wr.value[smokeDay + '/' + smokeKey], smokeRecord[smokeKey])),
            'sandbox៖ បិទ barcode ➜ memory និង payload ចំណូលពិតនៅថ្ងៃកម្ពុជា (មុន emulator)');
        smoke.ctx.api.markCollectedRevenue(smoke.ctx.api.collectedMarksFor(collectedBarcode, false));
        await smoke.drain();
        check(!smoke.ctx.dailyCollectedData[smokeDay] &&
            smoke.writes.some((wr) => wr.method === 'PATCH' && wr.path === 'zoew_daily_collected_cod_dod' && wr.value[smokeDay + '/' + smokeKey] === null),
            'sandbox៖ បើក barcode វិញដោយគ្មានត្រាចាស់ ➜ រកថ្ងៃក្នុង state ហើយលុប payload ពិត');
        const normalIntl = smoke.ctx.Intl;
        try {
            smoke.ctx.Intl = { DateTimeFormat() { throw new Error('smoke៖ Intl អវត្តមាន'); } };
            check(smoke.ctx.api.collectedDayOfStamp(smokeStamp) === smokeDay,
                'sandbox៖ Intl បរាជ័យ ➜ ប្រើ offset ពិតរបស់ App ហើយរក្សាថ្ងៃកម្ពុជា');
        } finally {
            if (normalIntl === undefined) delete smoke.ctx.Intl;
            else smoke.ctx.Intl = normalIntl;
        }
        check(true, 'sandbox៖ ស្រង់ និងរត់ function ពិតបាន (គ្មាន ReferenceError) — មិនត្រូវការ emulator');

        // សេណារីយ៉ូមិនអាចរត់គ្រប់ branch បាន៖ ពិនិត្យ dependency ទាំងអស់មុនច្រក emulator។
        const globals = vm.runInContext('Object.getOwnPropertyNames(globalThis)', smoke.ctx);
        let smokeAst = null;
        try { smokeAst = acorn.parse(SANDBOX_SOURCE, { ecmaVersion: 2022 }); } catch (e) {}
        const unresolved = smokeAst ? sandboxUnresolvedNames(smokeAst, globals) : new Set();
        check(!!smokeAst, 'sandbox៖ parse កូដដែលផ្គុំបាន (parse error = ការធ្លាក់)');
        check(unresolved.size === 0,
            '⛔ រាល់ dependency ដែល sandbox ប្រើ ត្រូវមានក្នុង scope ពិត (function · state · ថេរ)',
            Array.from(unresolved).join(', '));
        if (smokeAst) {
            const probeAst = acorn.parse('function first({ value: localOnly }) { return { value: localOnly }; } function second() { return localOnly + absentState.value + absentCall(); } function third(value = bodyOnly) { var bodyOnly = 1; return value; }', { ecmaVersion: 2022 });
            const probeMissing = Array.from(sandboxUnresolvedNames(probeAst, [])).sort();
            check(isDeepStrictEqual(probeMissing, ['absentCall', 'absentState', 'bodyOnly', 'localOnly']),
                'sandbox guard៖ ចាប់ function/state ដែលបាត់ និងអថេរឆ្លង scope ដោយមិនច្រឡំ property key', JSON.stringify(probeMissing));
        }
        if (unresolved.size) {
            console.log('\n❌ sandbox ខ្វះឈ្មោះ ➜ ការធ្លាក់ **ទោះគ្មាន emulator**');
            console.log('   បន្ថែមវាក្នុង `FNS` ឬក្នុង context របស់ `makeSandbox()`។');
            process.exit(1);
        }
    } catch (sandboxError) {
        check(false, 'sandbox៖ ស្រង់ និងរត់ function ពិតបាន (គ្មាន ReferenceError) — មិនត្រូវការ emulator',
            String(sandboxError && sandboxError.message || sandboxError));
        console.log('\n❌ sandbox ខូច ➜ ការធ្លាក់ **ទោះគ្មាន emulator** (កុំឲ្យវាលេចតែក្នុង CI)');
        console.log('   ជាធម្មតា៖ `app.js` បន្ថែមថេរ/មុខងារថ្មី តែ sandbox នៅទីនេះមិនប្រកាសវា។');
        process.exit(1);
    }
    if (fail) {
        console.log('\n❌ sandbox មានការអះអាងធ្លាក់ ➜ បញ្ឈប់មុន emulator (គ្មាន SKIP បិទបាំងការធ្លាក់)');
        process.exit(1);
    }

    let load;
    try {
        load = await asOwner('PUT', '/.settings/rules.json', JSON.parse(fs.readFileSync(path.join(ROOT, 'firebase-database.rules.json'), 'utf8')));
    } catch (connectError) {
        console.log((strictMode ? 'FAIL' : 'SKIP') + ' — តភ្ជាប់ទៅ emulator មិនបាន (127.0.0.1:9000): ' + connectError.message);
        if (strictMode) console.log('        CRUD_FLOW_STRICT=1 ➜ ការ SKIP ត្រូវរាប់ជាការធ្លាក់ (កុំឲ្យ CI បៃតងក្លែងក្លាយ)');
        process.exit(strictMode ? 1 : 0);
    }
    if (!/"status"\s*:\s*"ok"/.test(load.body)) {
        console.log((strictMode ? 'FAIL' : 'SKIP') + ' — rules load មិនបាន: ' + load.body.slice(0, 160));
        if (strictMode) console.log('        CRUD_FLOW_STRICT=1 ➜ ការ SKIP ត្រូវរាប់ជាការធ្លាក់ (កុំឲ្យ CI បៃតងក្លែងក្លាយ)');
        process.exit(strictMode ? 1 : 0);
    }
    const invalidCollected = await asUser('PUT', '/zoew_daily_collected_cod_dod/2026-08-26/invalid_probe.json', { c: -1, d: 0 });
    check(denied(invalidCollected), 'rules ពិត៖ payload ចំណូលអវិជ្ជមានត្រូវបដិសេធ (បញ្ជាក់ថាមិនរំលង rules)');

    const moveBase = { '2026-08-25': { MOVE_KEY: { c: 12.5, d: 0.75 }, KEEP_KEY: { c: 4, d: 0.5 } } };
    const moving = makeSandbox({ zoew_daily_collected_cod_dod: clone(moveBase) }, T0);
    moving.ctx.api.markCollectedRevenue([
        { day: '2026-08-25', key: 'MOVE_KEY', value: null },
        { day: '2026-08-26', key: 'MOVE_KEY', value: { c: 12.5, d: 0.75 } }
    ]);
    await moving.drain();
    const moveWrites = moving.writes.filter((write) => write.path.startsWith('zoew_daily_collected_cod_dod'));
    check(moveWrites.length === 1 && moveWrites[0].method === 'PATCH' && moveWrites[0].path === 'zoew_daily_collected_cod_dod',
        'ការផ្លាស់ថ្ងៃ៖ កូដពិតសាង multipath update តែមួយ មិនមែនសរសេរថ្ងៃពីរដាច់គ្នា');
    if (moveWrites.length === 1 && moveWrites[0].method === 'PATCH') {
        const movePayload = clone(moveWrites[0].value);
        const rejectedPayload = clone(movePayload);
        rejectedPayload['2026-08-26/MOVE_KEY'].c = -1;
        await asOwner('PUT', '/zoew_daily_collected_cod_dod.json', moveBase);
        const rejectedMove = await asUser('PATCH', '/zoew_daily_collected_cod_dod.json', rejectedPayload);
        const afterRejected = await asUser('GET', '/zoew_daily_collected_cod_dod.json');
        check(denied(rejectedMove) && isDeepStrictEqual(JSON.parse(afterRejected.body), moveBase),
            'rules ពិត៖ ថ្ងៃថ្មីបដិសេធ ➜ ការលុបថ្ងៃចាស់ក៏មិនចុះ (atomic)');
        const concurrent = await Promise.all([
            asUser('PATCH', '/zoew_daily_collected_cod_dod.json', movePayload),
            asUser('PATCH', '/zoew_daily_collected_cod_dod.json', { '2026-08-25/KEEP_KEY': { c: 8.25, d: 0.5 } })
        ]);
        const afterConcurrent = JSON.parse((await asUser('GET', '/zoew_daily_collected_cod_dod.json')).body);
        check(concurrent.every((response) => !denied(response)) &&
            !afterConcurrent['2026-08-25'].MOVE_KEY && afterConcurrent['2026-08-25'].KEEP_KEY.c === 8.25 &&
            afterConcurrent['2026-08-26'].MOVE_KEY.c === 12.5,
            'rules ពិត៖ ផ្លាស់ barcode និងកែ barcode ផ្សេងស្របគ្នា ➜ រក្សាលទ្ធផលទាំងពីរ');
    }

    // ---------- record មិនមែន object ----------
    // ⛔ node ដែលរំពឹង object (ដេរីវេពី rules ពិតក្នុង `rules-shape.js`) ៖ primitive **គ្មានកូន** ➜ ការពិនិត្យកូនមិនរត់ ➜ rules ចាស់ទទួល
    //    ខ្សែអក្សរ/លេខ/bool ➜ callback `onValue` របស់គ្រប់ឧបករណ៍ធ្លាក់ (2.45.4)។ ការវាស់ពីរជំហាន ៖ control ដក guard របស់ node ➜ ត្រូវទទួល (probe ទៅដល់)
    //    · rules ពិត ➜ ត្រូវបដិសេធ។ ⚠️ Firebase Console ដោយម្ចាស់ Project រំលង rules ➜ អ្នកយាមនេះវាស់តែការសរសេររបស់អ្នកប្រើ login (`asUser`)។
    console.log('=== ០ខ. node ដែលរំពឹង object ➜ rules ពិតបដិសេធ primitive · ទិសផ្ទុយ ៖ record/វាល/ការលុប ធម្មតាទទួល ===');
    const { probeObjectShapes } = require('../rules-shape.js');
    const realRules = JSON.parse(fs.readFileSync(path.join(ROOT, 'firebase-database.rules.json'), 'utf8'));
    const shapes = await probeObjectShapes({
        rules: realRules, file: 'firebase-database.rules.json',
        samples: { $itemId: 'shape_probe', $idx: '0', $date: '2026-08-26', $month: '2026-08', $barcodeKey: 'SHAPEPROBE' },
        loadRules: (r) => asOwner('PUT', '/.settings/rules.json', r).then((x) => /"status"\s*:\s*"ok"/.test(x.body)),
        reset: (p) => asOwner('PUT', p + '.json', null),
        write: (p, v) => asUser('PUT', p + '.json', v),
        denied
    });
    check(shapes.length >= 1, 'ជាន់អប្បបរមា ៖ node ដែលរំពឹង object ដេរីវេពី rules ពិត (' + shapes.length + ')');
    for (const r of shapes) {
        check(r.reachable, 'probe ទៅដល់ ' + r.rulePath + ' (control ដក guard របស់ node ➜ primitive ត្រូវទទួល)', r.detail.join(' · '));
        check(r.rejected, 'rules ពិត៖ ' + r.rulePath + ' ➜ primitive (ខ្សែអក្សរ · លេខ · bool) ត្រូវបដិសេធ', r.detail.join(' · '));
    }
    for (const node of ['zoew_scan_history_cod_dod', 'zoew_recently_deleted_cod_dod']) {
        await asOwner('PUT', '/' + node + '.json', null);
        const record = node === 'zoew_scan_history_cod_dod'
            ? parcel('id_ok', [bc('B1', 4.57, false)])
            : Object.assign(parcel('id_ok', [bc('B1', 4.57, false)]), { deletedAt: T0, isFromDeletion: true, trashReason: 'delete' });
        const put = await asUser('PUT', '/' + node + '/id_ok.json', record);
        const patch = await asUser('PATCH', '/' + node + '/id_ok.json', { phone: '012345678' });
        const field = await asUser('PUT', '/' + node + '/id_ok/phone.json', '098765432');
        const after = JSON.parse((await asOwner('GET', '/' + node + '/id_ok.json')).body || 'null');
        check(!denied(put) && !denied(patch) && !denied(field) && after && after.phone === '098765432',
            'ទិសផ្ទុយ ៖ ' + node + ' ➜ record ពេញ · PATCH វាល · PUT វាលកូន នៅតែទទួល',
            [put.status, patch.status, field.status, put.body.slice(0, 80)].join(' · '));
        const del = await asUser('PUT', '/' + node + '/id_ok.json', null);
        const gone = (await asOwner('GET', '/' + node + '/id_ok.json')).body.trim() === 'null';
        check(!denied(del) && gone, 'ទិសផ្ទុយ ៖ ' + node + ' ➜ ការលុប record (null) នៅតែទទួល', del.status + ' ' + del.body.slice(0, 80));
    }

    // ---------- បិទ / បើក ----------
    console.log('=== ១. បិទ «យក» / បើកវិញ (barcode តែមួយ និងកញ្ចប់ទាំងមូល) ===');
    for (const [label, fn, args, extra] of [
        ['បិទ barcode តែមួយ', 'toggleIndividualBarcodeClose', ['id_x', 'B1'], {}],
        ['បិទកញ្ចប់ទាំងមូល', 'toggleCloseStatus', ['id_x'], {}],
        ['បិទ barcode តែមួយ (កញ្ចប់ជាប់គាំង marker ស្តារ)', 'toggleIndividualBarcodeClose', ['id_x', 'B1'], { restoreClaimId: 'ghost', restoreClaimToken: 'ghost_tok' }],
        ['បិទកញ្ចប់ទាំងមូល (កញ្ចប់ជាប់គាំង marker ស្តារ)', 'toggleCloseStatus', ['id_x'], { restoreClaimId: 'ghost', restoreClaimToken: 'ghost_tok' }]
    ]) {
        const untouchedCollected = { '2026-08-25': { keep_collected: { c: 2.5, d: 0.75 } } };
        const base = { zoew_scan_history_cod_dod: { id_x: parcel('id_x', [bc('B1', 4.57, false), bc('B2', 3.72, false)], extra) },
            zoew_recently_deleted_cod_dod: {}, zoew_daily_collected_cod_dod: clone(untouchedCollected) };
        const w = makeSandbox(clone(base), T0 + 3600000);
        w.sync();
        if (extra.restoreClaimId) await clearOrphanBeforeRetry(w, label);
        await w.ctx[fn](...args); await w.drain();
        await seedServer(base);
        await replay(label + ' ➜ rules ទទួល', w.writes);
        const closed = w.store.zoew_scan_history_cod_dod.id_x.barcodes.filter((b) => b.isClosed);
        check(closed.length > 0 && closed.every((b) => typeof b.closedAt === 'number'), label + ' ➜ បោះត្រា closedAt គ្រប់ barcode ដែលបិទ');
        check(w.store.zoew_scan_history_cod_dod.id_x.restoreClaimId === undefined, label + ' ➜ marker ស្តារដែលងាប់ត្រូវបោសចេញ');
        const closeDay = new Date(w.now + 7 * 3600000).toISOString().slice(0, 10);
        const expectedCollected = clone(untouchedCollected);
        expectedCollected[closeDay] = { [w.ctx.api.pickupBarcodeKey('B1')]: { c: 4.57, d: 0 } };
        if (fn === 'toggleCloseStatus') expectedCollected[closeDay][w.ctx.api.pickupBarcodeKey('B2')] = { c: 3.72, d: 0 };
        const collectedOnServer = await asUser('GET', '/zoew_daily_collected_cod_dod.json');
        check(!denied(collectedOnServer) && isDeepStrictEqual(JSON.parse(collectedOnServer.body), expectedCollected) &&
            isDeepStrictEqual(clone(w.ctx.dailyCollectedData), expectedCollected),
            label + ' ➜ server ពិត និង memory កត់ចំណូលថ្ងៃយក តម្លៃត្រឹមត្រូវ និងរក្សាថ្ងៃមុន');

        const w2 = makeSandbox(clone(w.store), T0 + 3600000);
        w2.sync();
        await w2.ctx[fn](...args); await w2.drain();
        await seedServer(w.store);
        await replay(label.replace('បិទ', 'បើកវិញ') + ' ➜ rules ទទួល', w2.writes);
        const reopened = w2.store.zoew_scan_history_cod_dod.id_x.barcodes;
        check(reopened.every((b) => b.isClosed || b.closedAt === undefined), label.replace('បិទ', 'បើកវិញ') + ' ➜ ត្រា closedAt ត្រូវលុបចេញ');
        const reopenedCollected = await asUser('GET', '/zoew_daily_collected_cod_dod.json');
        check(!denied(reopenedCollected) && isDeepStrictEqual(JSON.parse(reopenedCollected.body), untouchedCollected) &&
            isDeepStrictEqual(clone(w2.ctx.dailyCollectedData), untouchedCollected),
            label.replace('បិទ', 'បើកវិញ') + ' ➜ server ពិត និង memory ដកចំណូលថ្ងៃយក ហើយរក្សាថ្ងៃមុន');
    }

    // ---------- ដក ----------
    console.log('\n=== ២. ដក (removeSingleBarcode) ===');
    for (const [label, extra, liveSource] of [
        ['កញ្ចប់ធម្មតា', {}, false],
        ['កញ្ចប់ដែលនៅសល់ marker ស្តារ (ជាប់គាំងពីមុន)', { restoreClaimId: 'ghost', restoreClaimToken: 'ghost_tok' }, false],
        ['កញ្ចប់ដែលការស្តារ **កំពុងដំណើរការ** (marker នៅរស់)', { restoreClaimId: 'live_src', restoreClaimToken: 'live_tok' }, true]
    ]) {
        const base = { zoew_scan_history_cod_dod: { id_x: parcel('id_x', [bc('B1', 4.57, true, T0), bc('B2', 3.72, false)], extra) },
            zoew_recently_deleted_cod_dod: liveSource ? { live_src: { id: 'live_src', phone: '098000880', scanDate: '2026-08-26', deletedAt: T0, isFromDeletion: true, trashReason: 'delete', restoreClaim: { token: 'live_tok', targetId: 'id_x', claimedAt: T0 + 3600000 } } } : {} };
        const w = makeSandbox(clone(base), T0 + 3600000);
        w.sync();
        await w.ctx.removeSingleBarcode('id_x', 'B1'); await w.drain();
        if (extra.restoreClaimId && !liveSource) {
            check(w.writes.length === 0 && w.revenueCalls.length === 0 && w.store.zoew_scan_history_cod_dod.id_x.restoreClaimToken === 'ghost_tok',
                'ដក — orphan marker ➜ រង់ចាំការសម្អាត មិនដកមុន');
            await clearOrphanBeforeRetry(w, 'ដក — ' + label);
            await w.ctx.removeSingleBarcode('id_x', 'B1'); await w.drain();
        }
        await seedServer(base);
        const ok = await replay('ដក — ' + label + ' ➜ rules ទទួល', w.writes);
        const trash = Object.values(w.store.zoew_recently_deleted_cod_dod || {}).find((t) => t && t.trashReason === 'remove');
        if (liveSource) {
            check(JSON.stringify(w.store.zoew_scan_history_cod_dod.id_x) === JSON.stringify(base.zoew_scan_history_cod_dod.id_x),
                'ដក — claim រស់ ➜ barcode និង marker ត្រូវនៅដដែល');
            check(!trash && JSON.stringify(w.store.zoew_recently_deleted_cod_dod) === JSON.stringify(base.zoew_recently_deleted_cod_dod),
                'ដក — claim រស់ ➜ source នៅគ្រប់ និងមិនបង្កើតធុងសំរាមថ្មី');
            check(w.revenueCalls.length === 0 && w.writes.length === 0,
                'ដក — claim រស់ ➜ មិនដកប្រាក់ និងមិនសរសេរ payload', JSON.stringify(w.revenueCalls));
            const saved = await asUser('GET', '/zoew_scan_history_cod_dod/id_x.json');
            check(!denied(saved) && isDeepStrictEqual(JSON.parse(saved.body).barcodes, base.zoew_scan_history_cod_dod.id_x.barcodes) &&
                JSON.parse(saved.body).restoreClaimToken === 'live_tok', 'ដក — claim រស់ ➜ server ពិតរក្សា barcode និង marker');
        } else {
            check(!!trash && trash.trashReason === 'remove', 'ដក — ' + label + ' ➜ ស្លាក «ដក» (remove)', trash && trash.trashReason);
            check(!!trash && trash.barcodes.every((b) => b.isDeducted === true), 'ដក — ' + label + ' ➜ isDeducted = true (ដកលុយ)');
            check(!!trash && trash.restoreClaimId === undefined && trash.restoreClaimToken === undefined, 'ដក — ' + label + ' ➜ គ្មាន marker សល់ក្នុងធុងសំរាម');
        }
        if (!ok) console.log('        (ការបដិសេធនេះជាកំហុសដែល 2.17.3 កែ)');
    }

    // ---------- លុប ----------
    console.log('\n=== ៣. លុប (deleteSingleItem) ===');
    for (const [label, extra] of [['កញ្ចប់ធម្មតា', {}], ['កញ្ចប់ដែលនៅសល់ marker ស្តារ', { restoreClaimId: 'ghost', restoreClaimToken: 'ghost_tok' }]]) {
        const base = { zoew_scan_history_cod_dod: { id_x: parcel('id_x', [bc('B1', 4.57, true, T0), bc('B2', 3.72, false)], extra) }, zoew_recently_deleted_cod_dod: {} };
        const w = makeSandbox(clone(base), T0 + 3600000);
        w.sync();
        await w.ctx.deleteSingleItem('id_x'); await w.drain();
        if (extra.restoreClaimId) {
            check(w.writes.length === 0 && w.revenueCalls.length === 0 && w.store.zoew_scan_history_cod_dod.id_x.restoreClaimToken === 'ghost_tok',
                'លុប — orphan marker ➜ រង់ចាំការសម្អាត មិនលុបមុន');
            await clearOrphanBeforeRetry(w, 'លុប — ' + label);
            await w.ctx.deleteSingleItem('id_x'); await w.drain();
        }
        await seedServer(base);
        await replay('លុប — ' + label + ' ➜ rules ទទួល', w.writes);
        const trash = w.store.zoew_recently_deleted_cod_dod.id_x;
        check(!!trash && trash.trashReason === 'delete', 'លុប — ' + label + ' ➜ ស្លាក «លុប» (delete)', trash && trash.trashReason);
        check(!!trash && trash.barcodes.every((b) => b.isDeducted !== true), 'លុប — ' + label + ' ➜ **មិនដកលុយ**');
        check(!!trash && trash.restoreClaimId === undefined, 'លុប — ' + label + ' ➜ គ្មាន marker សល់');
    }

    // ---------- លុបជាអចិន្ត្រៃយ៍ ----------
    console.log('\n=== ៤. ✖️ លុបជាអចិន្ត្រៃយ៍ ===');
    for (const [label, claim, expectOk] of [
        ['ធាតុធម្មតា', null, true],
        ['ធាតុដែល claim ស្តារងាប់ (ការស្តារធ្លាប់បរាជ័យ)', { token: 't', targetId: 'id_x', claimedAt: T0 }, true],
        ['ធាតុដែល claim ស្តារនៅរស់ (ឧបករណ៍ផ្សេងកំពុងស្តារ)', { token: 't', targetId: 'id_x', claimedAt: T0 + 3600000 }, false]
    ]) {
        const item = Object.assign(parcel('id_t', [bc('B1', 4.57, false)]), { deletedAt: T0, isFromDeletion: true, trashReason: 'delete' }, claim ? { restoreClaim: claim } : {});
        const base = { zoew_scan_history_cod_dod: {}, zoew_recently_deleted_cod_dod: { id_t: item } };
        const w = makeSandbox(clone(base), T0 + 3600000);
        w.sync();
        w.ctx.pendingPermanentDeleteId = 'id_t';
        await w.ctx.executePermanentDelete(); await w.drain();
        await seedServer(base);
        let bad = null;
        for (const wr of w.writes) { const r = await asUser(wr.method || 'PUT', `/${wr.path}.json`, wr.value); if (denied(r)) { bad = wr.path; break; } }
        const gone = (await asUser('GET', '/zoew_recently_deleted_cod_dod/id_t.json')).body.trim() === 'null';
        check(expectOk ? (!bad && gone) : !gone, '✖️ ' + label + (expectOk ? ' ➜ លុបបាន' : ' ➜ ត្រូវការពារ មិនលុប'), bad ? 'បដិសេធនៅ ' + bad : '');
    }

    // ---------- ផុតកំណត់ ៨ ថ្ងៃ ➜ ការដកមានសោ ----------
    // ⛔ 2.50.49 ៖ ការដកប្រាក់កញ្ចប់ផុតកំណត់សរសេរ `ded/<trashId>` ក្នុង record ថ្ងៃ (ផ្លូវសរសេរថ្មី ➜ fuzz គ្មាន op «abandon» ➜ មិនមានអ្នកវាស់
    //    ជាមួយ rules ពិតទេ)។ ការវាស់ ៖ ការសម្អាតពិតក្នុង sandbox ➜ ចាក់ payload ពិតទៅ emulator ➜ rules ពិតទទួល ហើយលទ្ធផលលើ server = ការដកពិត
    //    · ទិសផ្ទុយ ៖ rules ដែលដក `ded` ចេញ ➜ payload ថ្ងៃដដែលត្រូវបដិសេធ (បញ្ជាក់ថា node `ded` ជាអ្នកទទួល មិនមែនបៃតងទទេ)
    //    · ទម្រង់ `ded` ខុស (អវិជ្ជមាន · វាលក្រៅ schema · គ្មាន `at`) ➜ បដិសេធ។
    console.log('\n=== ៥. ផុតកំណត់ ៨ ថ្ងៃ ➜ ការដកមានសោ `ded/<trashId>` ➜ rules ពិតទទួល ===');
    {
        const day = '2026-08-26';
        const month = day.substring(0, 7);
        const base = {
            zoew_scan_history_cod_dod: { id_e: parcel('id_e', [bc('E1', 4.57, false), bc('E2', 3.72, false)]) },
            zoew_recently_deleted_cod_dod: {},
            zoew_daily_revenue_cod_dod: { [day]: { codDollar: 20, dodDollar: 0, totalCount: 5 } },
            zoew_monthly_revenue_cod_dod: { [month]: { codDollar: 120, dodDollar: 0, totalCount: 30 } }
        };
        const probe = makeSandbox({}, T0);
        const ageMs = vm.runInContext('ABANDON_AGE_MS', probe.ctx);
        const w = makeSandbox(clone(base), T0 + ageMs + 3600000);
        w.sync();
        await w.ctx.claimAndCleanupItem('id_e', 'abandon');
        await w.drain();
        const dailyWrites = w.writes.filter((wr) => wr.path.startsWith('zoew_daily_revenue_cod_dod'));
        const keyedDaily = dailyWrites.filter((wr) => wr.value && wr.value.ded && wr.value.ded.id_e);
        check(keyedDaily.length === 1 && w.writes.some((wr) => wr.path === 'zoew_monthly_revenue_cod_dod'),
            'ផុតកំណត់ ➜ កូដពិតសរសេរខែ ហើយសរសេរថ្ងៃដែលមាន `ded/id_e` ម្តង', JSON.stringify(w.writes.map((wr) => wr.path)));
        await seedServer(base);
        await replay('ផុតកំណត់ ➜ rules ពិតទទួល payload ទាំងអស់ (ប្រវត្តិ · ធុងសំរាម · ខែ · ថ្ងៃ+`ded` · flip)', w.writes);
        const server = JSON.parse((await asOwner('GET', '/.json')).body || '{}');
        const dailyRec = server.zoew_daily_revenue_cod_dod && server.zoew_daily_revenue_cod_dod[day];
        const monthlyRec = server.zoew_monthly_revenue_cod_dod && server.zoew_monthly_revenue_cod_dod[month];
        const trash = server.zoew_recently_deleted_cod_dod && server.zoew_recently_deleted_cod_dod.id_e;
        const ded = dailyRec && dailyRec.ded ? dailyRec.ded.id_e : null;
        check(!!dailyRec && Math.abs(dailyRec.codDollar - 11.71) < 1e-9 && dailyRec.totalCount === 3 &&
            !!monthlyRec && Math.abs(monthlyRec.codDollar - 111.71) < 1e-9 && monthlyRec.totalCount === 28,
            'ផុតកំណត់ ➜ server ៖ ថ្ងៃ និងខែ ដក 8.29 · 2 កញ្ចប់ ពិតប្រាកដ', JSON.stringify({ dailyRec, monthlyRec }));
        check(!!ded && ded.at === trash.deletedAt && Math.abs(ded.cod - 8.29) < 1e-9 && ded.dod === 0 && ded.count === 2,
            'ផុតកំណត់ ➜ server ៖ `ded/id_e` = { at: deletedAt · cod 8.29 · dod 0 · count 2 }', JSON.stringify(ded));
        check(!!trash && trash.trashReason === 'expired' && trash.barcodes.length === 2 && trash.barcodes.every((b) => b.isDeducted === true),
            'ផុតកំណត់ ➜ server ៖ ធុងសំរាម `expired` flip `isDeducted:true` តែក្រោយការដក', JSON.stringify(trash && trash.barcodes));

        const noDed = clone(realRules);
        delete noDed.rules.zoew_daily_revenue_cod_dod.$date.ded;
        const loadedNoDed = /"status"\s*:\s*"ok"/.test((await asOwner('PUT', '/.settings/rules.json', noDed)).body);
        if (keyedDaily.length === 1) {
            await seedServer(base);
            const deniedNoDed = await asUser(keyedDaily[0].method || 'PUT', '/' + keyedDaily[0].path + '.json', keyedDaily[0].value);
            const stripped = clone(keyedDaily[0].value);
            delete stripped.ded;
            const acceptedNoDed = await asUser('PUT', '/' + keyedDaily[0].path + '.json', stripped);
            check(loadedNoDed && denied(deniedNoDed) && !denied(acceptedNoDed),
                'ទិសផ្ទុយ ៖ rules គ្មាន `ded` ➜ payload ថ្ងៃដែលមាន `ded` បដិសេធ · ដក `ded` ចេញ ➜ ទទួល',
                [loadedNoDed, deniedNoDed.status, acceptedNoDed.status].join(' · '));
        } else {
            check(false, 'ទិសផ្ទុយ ៖ rules គ្មាន `ded` ➜ payload ថ្ងៃដែលមាន `ded` បដិសេធ (គ្មាន payload `ded` ឲ្យវាស់)');
        }
        await asOwner('PUT', '/.settings/rules.json', realRules);
        await seedServer(base);
        const dedPath = '/zoew_daily_revenue_cod_dod/' + day + '/ded/probe_x.json';
        const goodDed = await asUser('PUT', dedPath, { at: T0, cod: 1.25, dod: 0, count: 1 });
        const badDed = await Promise.all([
            asUser('PUT', dedPath, { at: T0, cod: -1, dod: 0, count: 1 }),
            asUser('PUT', dedPath, { at: T0, cod: 1, dod: 0, count: 1, extra: 1 }),
            asUser('PUT', dedPath, { cod: 1, dod: 0, count: 1 }),
            asUser('PUT', dedPath, { at: T0, cod: 1, dod: 0, count: 1, back: false })
        ]);
        check(!denied(goodDed) && badDed.every(denied),
            'rules ពិត ៖ `ded` ត្រឹមត្រូវទទួល · អវិជ្ជមាន · វាលក្រៅ schema · គ្មាន `at` · `back:false` ➜ បដិសេធ',
            [goodDed.status].concat(badDed.map((r) => r.status)).join(' · '));
    }

    console.log('\n' + pass + ' ok, ' + fail + ' fail');

    if (fail) console.log('  namespace: ' + NS);
    else await asOwner('PUT', '/.json', null);

    // ⛔ សន្ទះការពារ «បៃតងក្លែងក្លាយ»៖ បើចំនួន assertion ធ្លាក់ក្រោមកម្រិតអប្បបរមា
    // នោះមានន័យថាតេស្តត្រូវបានកាត់ចេញ ឬរត់មិនពេញ — CI ត្រូវក្រហម ទោះគ្មាន fail។
    const minAsserts = parseInt(process.env.CRUD_FLOW_MIN_ASSERTS || '70', 10);
    if (minAsserts > 0 && pass < minAsserts) {
        console.log('\n❌ assertion តិចជាងកម្រិតអប្បបរមា៖ ' + pass + ' < ' + minAsserts);
        console.log('   តេស្តត្រូវបានកាត់ចេញ ឬរត់មិនពេញ ➜ រាប់ជាការធ្លាក់។');
        console.log('   បើបន្ថែមតេស្តដោយចេតនា សូមតម្លើង CRUD_FLOW_MIN_ASSERTS ក្នុង .github/workflows/audit.yml');
        process.exit(1);
    }
    process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
