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
    'applyBarcodeCloseState', 'barcodeCloseIsRipe', 'barcodeAbandonIsRipe', 'normalizeBarcodeCloseStamps', 'parseTimestampFromId',
    'generateUniqueId', 'retryAsync', 'cloneRestoreItem', 'isActiveRestoreClaim', 'collectItemBarcodes',
    'getPickupPhoneKey', 'barcodeRegistryKey', 'pickupBarcodeKey', 'collectPickupMarks', 'reconstructPickupSet',
    'saveSingleDeletedItemToFirebase', 'deleteSingleDeletedItemFromFirebase',
    'restoreClaimedItemToScanHistory', 'clearStaleRestoreMarkers', 'releaseStaleRestoreClaimForPurge',
    'claimAndCleanupItem', 'runAutomaticCleanupRules', 'deleteSingleItem', 'removeSingleBarcode',
    'buildClearHistoryTrashItem', 'toggleIndividualBarcodeClose', 'applyBarcodeCloseChange',
    'toggleCloseStatus', 'executePermanentDelete'];

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
            Object.entries(updates).forEach(([k, v]) => {
                const full = [ref.path, k].filter(Boolean).join('/');
                w.writes.push({ method: 'PUT', path: full, value: v === null ? null : clone(v) });
                set(full, v);
            });
        }),
        remove: (ref) => Promise.resolve().then(() => { w.writes.push({ method: 'PUT', path: ref.path, value: null }); set(ref.path, null); })
    };
    const ctx = vm.createContext({
        console, setTimeout, clearTimeout, Promise, Math, Date, JSON, Set, Map, window: {},
        db: {}, fb,
        dbRefDeleted: fb.ref({}, 'zoew_recently_deleted_cod_dod'),
        dbRefHistory: fb.ref({}, 'zoew_scan_history_cod_dod'),
        dbRefDailyPickup: fb.ref({}, 'zoew_daily_pickup_cod_dod'),
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
        showToast: (m) => w.toasts.push(m), confirm: () => true, alert: () => {},
        openViewListModal: () => {}, refreshCurrentHistoryView: () => {}, updateRecentPhonesList: () => {},
        renderRecentlyDeleted: () => {}, openRecentlyDeletedModal: () => {}, closeModal: () => {},
        releaseBarcodesInRegistry: () => Promise.resolve(), collectPhoneSuggestions: () => [],
        clearScannedRemovalInFlight: () => {},
        document: { getElementById: () => null },
        scanHistory: [], deletedItems: [], pendingPermanentDeleteId: null, activeParentItemId: null
    });
    const assembled = [
        extractConst(src, 'TWO_HOURS_MS'), extractConst(src, 'ABANDON_AGE_MS'), extractConst(src, 'RESTORE_CLAIM_LEASE_MS'),
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
        'let serverClockTrusted = true, isDatabaseConnected = true;', extractFn(src, 'cleanupClockIsTrustworthy'),
        'const cleanupInFlight = new Set();', 'const staleRestoreMarkerSweeps = new Set();', 'const staleClearClaimSweeps = new Set();', 'const activeClearHistoryClaims = new Map();', 'const CLEAR_HISTORY_CLAIM_LEASE_MS = 120000;', 'const dbListenerPendingPaths = new Set();', 'const dbListenerFailedPaths = new Set();', "const DB_LISTENER_KEY_DELETED = 'deleted';", 'const activeRestoreClaims = new Map();',
        'let deletedCleanupInFlight = false;',
        ...FNS.map((n) => extractFn(src, n)),
        'globalThis.api = { ' + FNS.join(', ') + ' };'
    ].join('\n\n');
    SANDBOX_SOURCE = assembled;
    new vm.Script(assembled).runInContext(ctx);
    w.ctx = ctx;
    w.sync = () => {
        const h = get('zoew_scan_history_cod_dod') || {};
        ctx.scanHistory.length = 0; Object.keys(h).forEach((k) => ctx.scanHistory.push(clone(h[k])));
        const t = get('zoew_recently_deleted_cod_dod') || {};
        ctx.deletedItems.length = 0; Object.keys(t).forEach((k) => ctx.deletedItems.push(clone(t[k])));
    };
    w.drain = async () => { for (let i = 0; i < 30; i++) await new Promise((r) => setTimeout(r, 0)); };
    w.sync();
    return w;
}

const T0 = Date.now() - 3600000;
const bc = (code, cod, closed, closedAt) => Object.assign({ code, cod, dod: 0, locker: 'N/A', time: 't', isClosed: !!closed, isDeducted: false, isFromDeletion: false, createdAt: T0 }, closed && closedAt !== undefined ? { closedAt } : {});
const parcel = (id, barcodes, extra) => Object.assign({ id, phone: '098798880', scanDate: '2026-08-26', createdAt: T0, time: 't', barcodes, count: barcodes.length, cod: barcodes.reduce((s, b) => s + b.cod, 0), dod: 0, price: barcodes.reduce((s, b) => s + b.cod, 0), barcode: barcodes[0].code, isClosed: barcodes.every((b) => b.isClosed), isCalled: false }, extra || {});

async function replay(label, writes) {
    await asOwner('PUT', '/zoew_restore_finalizations.json', {});
    let bad = null;
    for (const wr of writes) {
        const r = await asUser('PUT', `/${wr.path}.json`, wr.value);
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
        check(true, 'sandbox៖ ស្រង់ និងរត់ function ពិតបាន (គ្មាន ReferenceError) — មិនត្រូវការ emulator');

        // ⛔⛔ **ការគ្របតាមសេណារីយ៉ូ មិនអាចជំនួសការគ្របតាមរចនាសម្ព័ន្ធបានទេ។**
        // ការហៅ smoke ខាងលើប៉ះតែ ៥ ក្នុងចំណោម function ដែលស្រង់ ➜ helper ថ្មី
        // ដែលរស់នៅក្នុងផ្លូវ **ដក/លុប/សម្អាត** (ដែលត្រូវការ emulator ដើម្បីរត់)
        // លេចជា `ReferenceError` **តែក្នុង CI** ប៉ុណ្ណោះ។ វាកើតឡើងពិតនៅ 2.25.8
        // (`notifyIfSlow`)។ ដូច្នេះត្រូវសួរសំណួរ **រចនាសម្ព័ន្ធ** ជំនួស ៖
        // «តើឈ្មោះទាំងអស់ដែល function ដែលស្រង់ *ហៅ* មានក្នុង sandbox ទេ?»
        const declared = new Set(Object.keys(smoke.ctx));
        SANDBOX_SOURCE.replace(/\bfunction\s+([A-Za-z_$][\w$]*)/g, (_, n) => { declared.add(n); return _; });
        SANDBOX_SOURCE.replace(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g, (_, n) => { declared.add(n); return _; });
        const BUILTINS = new Set(['Promise', 'Math', 'Date', 'JSON', 'Set', 'Map', 'Object', 'Array', 'Number',
            'String', 'Boolean', 'Error', 'parseFloat', 'parseInt', 'isNaN', 'isFinite', 'setTimeout',
            'clearTimeout', 'console', 'globalThis', 'require', 'RegExp', 'Symbol', 'BigInt']);
        const unresolved = new Set();
        let smokeAst = null;
        try { smokeAst = acorn.parse(SANDBOX_SOURCE, { ecmaVersion: 2022 }); } catch (e) {}
        if (smokeAst) {
            (function walk(node, locals) {
                if (!node || typeof node.type !== 'string') return;
                let scope = locals;
                if (/Function/.test(node.type)) {
                    scope = new Set(locals);
                    (node.params || []).forEach((prm) => {
                        JSON.stringify(prm, (k, v) => {
                            if (v && v.type === 'Identifier' && k !== 'property') scope.add(v.name);
                            return v;
                        });
                    });
                    if (node.id) scope.add(node.id.name);
                }
                if (node.type === 'VariableDeclarator' && node.id && node.id.type === 'Identifier') scope.add(node.id.name);
                if (node.type === 'CallExpression' && node.callee && node.callee.type === 'Identifier') {
                    const name = node.callee.name;
                    if (!declared.has(name) && !BUILTINS.has(name) && !scope.has(name)) unresolved.add(name);
                }
                for (const key in node) {
                    if (key === 'type' || key === 'start' || key === 'end') continue;
                    const v = node[key];
                    if (Array.isArray(v)) v.forEach((c) => walk(c, scope));
                    else if (v && typeof v === 'object') walk(v, scope);
                }
            })(smokeAst, new Set());
        }
        check(!!smokeAst, 'sandbox៖ parse កូដដែលផ្គុំបាន (parse error = ការធ្លាក់)');
        check(unresolved.size === 0,
            '⛔ រាល់ function ដែល sandbox ហៅ ត្រូវមានក្នុង sandbox (គ្មាន ReferenceError ដែលលេចតែក្នុង CI)',
            Array.from(unresolved).join(', '));
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

    // ---------- បិទ / បើក ----------
    console.log('=== ១. បិទ «យក» / បើកវិញ (barcode តែមួយ និងកញ្ចប់ទាំងមូល) ===');
    for (const [label, fn, args, extra] of [
        ['បិទ barcode តែមួយ', 'toggleIndividualBarcodeClose', ['id_x', 'B1'], {}],
        ['បិទកញ្ចប់ទាំងមូល', 'toggleCloseStatus', ['id_x'], {}],
        ['បិទ barcode តែមួយ (កញ្ចប់ជាប់គាំង marker ស្តារ)', 'toggleIndividualBarcodeClose', ['id_x', 'B1'], { restoreClaimId: 'ghost', restoreClaimToken: 'ghost_tok' }],
        ['បិទកញ្ចប់ទាំងមូល (កញ្ចប់ជាប់គាំង marker ស្តារ)', 'toggleCloseStatus', ['id_x'], { restoreClaimId: 'ghost', restoreClaimToken: 'ghost_tok' }]
    ]) {
        const base = { zoew_scan_history_cod_dod: { id_x: parcel('id_x', [bc('B1', 4.57, false), bc('B2', 3.72, false)], extra) }, zoew_recently_deleted_cod_dod: {} };
        const w = makeSandbox(clone(base), T0 + 3600000);
        w.sync();
        if (extra.restoreClaimId) await clearOrphanBeforeRetry(w, label);
        await w.ctx[fn](...args); await w.drain();
        await seedServer(base);
        await replay(label + ' ➜ rules ទទួល', w.writes);
        const closed = w.store.zoew_scan_history_cod_dod.id_x.barcodes.filter((b) => b.isClosed);
        check(closed.length > 0 && closed.every((b) => typeof b.closedAt === 'number'), label + ' ➜ បោះត្រា closedAt គ្រប់ barcode ដែលបិទ');
        check(w.store.zoew_scan_history_cod_dod.id_x.restoreClaimId === undefined, label + ' ➜ marker ស្តារដែលងាប់ត្រូវបោសចេញ');

        const w2 = makeSandbox(clone(w.store), T0 + 3600000);
        w2.sync();
        await w2.ctx[fn](...args); await w2.drain();
        await seedServer(w.store);
        await replay(label.replace('បិទ', 'បើកវិញ') + ' ➜ rules ទទួល', w2.writes);
        const reopened = w2.store.zoew_scan_history_cod_dod.id_x.barcodes;
        check(reopened.every((b) => b.isClosed || b.closedAt === undefined), label.replace('បិទ', 'បើកវិញ') + ' ➜ ត្រា closedAt ត្រូវលុបចេញ');
    }

    // ---------- ដក ----------
    console.log('\n=== ២. ដក (removeSingleBarcode) ===');
    for (const [label, extra, liveSource] of [
        ['កញ្ចប់ធម្មតា', {}, false],
        ['កញ្ចប់ដែលនៅសល់ marker ស្តារ (ជាប់គាំងពីមុន)', { restoreClaimId: 'ghost', restoreClaimToken: 'ghost_tok' }, false],
        ['កញ្ចប់ដែលការស្តារ **កំពុងដំណើរការ** (marker នៅរស់)', { restoreClaimId: 'live_src', restoreClaimToken: 'live_tok' }, true]
    ]) {
        const base = { zoew_scan_history_cod_dod: { id_x: parcel('id_x', [bc('B1', 4.57, true, T0), bc('B2', 3.72, false)], extra) },
            zoew_recently_deleted_cod_dod: liveSource ? { live_src: { id: 'live_src', phone: '098798880', scanDate: '2026-08-26', deletedAt: T0, isFromDeletion: true, trashReason: 'delete', restoreClaim: { token: 'live_tok', targetId: 'id_x', claimedAt: T0 + 3600000 } } } : {} };
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
        for (const wr of w.writes) { const r = await asUser('PUT', `/${wr.path}.json`, wr.value); if (denied(r)) { bad = wr.path; break; } }
        const gone = (await asUser('GET', '/zoew_recently_deleted_cod_dod/id_t.json')).body.trim() === 'null';
        check(expectOk ? (!bad && gone) : !gone, '✖️ ' + label + (expectOk ? ' ➜ លុបបាន' : ' ➜ ត្រូវការពារ មិនលុប'), bad ? 'បដិសេធនៅ ' + bad : '');
    }

    console.log('\n' + pass + ' ok, ' + fail + ' fail');

    if (fail) console.log('  namespace: ' + NS);
    else await asOwner('PUT', '/.json', null);

    // ⛔ សន្ទះការពារ «បៃតងក្លែងក្លាយ»៖ បើចំនួន assertion ធ្លាក់ក្រោមកម្រិតអប្បបរមា
    // នោះមានន័យថាតេស្តត្រូវបានកាត់ចេញ ឬរត់មិនពេញ — CI ត្រូវក្រហម ទោះគ្មាន fail។
    const minAsserts = parseInt(process.env.CRUD_FLOW_MIN_ASSERTS || '0', 10);
    if (minAsserts > 0 && pass < minAsserts) {
        console.log('\n❌ assertion តិចជាងកម្រិតអប្បបរមា៖ ' + pass + ' < ' + minAsserts);
        console.log('   តេស្តត្រូវបានកាត់ចេញ ឬរត់មិនពេញ ➜ រាប់ជាការធ្លាក់។');
        console.log('   បើបន្ថែមតេស្តដោយចេតនា សូមតម្លើង CRUD_FLOW_MIN_ASSERTS ក្នុង .github/workflows/audit.yml');
        process.exit(1);
    }
    process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
