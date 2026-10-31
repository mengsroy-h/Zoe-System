const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { moduleRuntime, memoryStorage } = require('./react-view');

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


const ROOT = process.env.CONCSCAN_APP_DIR || path.join(__dirname, '..');

let pass = 0, fail = 0;
function ok(cond, label, got) {
    if (cond) { pass++; console.log('   ok    ' + label); }
    else { fail++; console.log('   FAIL  ' + label + (got !== undefined ? '  ➜ ' + JSON.stringify(got) : '')); }
}

function sliceBalanced(src, startIdx, open, close) {
    let depth = 0;
    for (let i = startIdx; i < src.length; i++) {
        if (src[i] === open) depth++;
        else if (src[i] === close) { depth--; if (depth === 0) return src.slice(startIdx, i + 1); }
    }
    throw new Error('unbalanced');
}
function extractFn(src, name) {
    const m = src.indexOf('function ' + name + '(');
    if (m === -1) return '';
    const braceAt = src.indexOf('{', m);
    return 'function ' + name + '(' + src.slice(src.indexOf('(', m) + 1, braceAt).replace(/\)\s*$/, '') + ')' +
        sliceBalanced(src, braceAt, '{', '}');
}

const src = fs.readFileSync(path.join(ROOT, 'ZoeW', 'app.js'), 'utf8');

// ---- a Firebase stand-in whose runTransaction has the real retry-on-conflict semantics ----
const HISTORY = 'zoew_scan_history_cod_dod';
const DAILY = 'zoew_daily_revenue_cod_dod';
const MONTHLY = 'zoew_monthly_revenue_cod_dod';
const clone = value => value == null ? null : JSON.parse(JSON.stringify(value));
function makeFirebase(server) {
    let version = 0;
    const store = { [HISTORY]: server };
    const get = path => path.split('/').filter(Boolean).reduce((node, key) => node?.[key], store) ?? null;
    const resolve = (value, prior) => {
        if (value && value['.sv']) {
            const amount = value['.sv'].increment;
            if (!Number.isFinite(amount)) throw new Error('invalid increment');
            const result = (Number.isFinite(prior) ? prior : 0) + amount;
            if (!Number.isFinite(result)) throw new Error('invalid increment result');
            return result;
        }
        if (Array.isArray(value)) return value.map((entry, index) => resolve(entry, prior?.[index]));
        if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== null).map(([key, v]) => [key, resolve(v, prior?.[key])]));
        return value;
    };
    const set = (target, path, value) => {
        const parts = path.split('/').filter(Boolean), last = parts.pop();
        let node = target;
        for (const part of parts) node = node[part] ??= {};
        if (value === null) delete node[last]; else node[last] = resolve(value, node[last]);
    };
    const publish = staged => {
        const rows = staged[HISTORY] || {};
        for (const key of Object.keys(server)) delete server[key];
        Object.assign(server, rows);
        for (const key of Object.keys(store)) delete store[key];
        Object.assign(store, staged, { [HISTORY]: server });
        version++;
    };
    const snapshot = path => { const value = clone(get(path)); return { val: () => clone(value), exists: () => value !== null }; };
    const fixture = {
        store, writes: [], retries: 0, beforeCommit: null,
        db: { app: { options: { databaseURL: 'https://scan-fixture.invalid' } } },
        api: {
            ref: (db, path = '') => ({ path }),
            get: async ref => snapshot(ref.path),
            increment: amount => { if (!Number.isFinite(amount)) throw new Error('invalid increment'); return { '.sv': { increment: amount } }; },
            update: (ref, obj) => new Promise((resolve, reject) => setTimeout(() => {
                try {
                    const staged = clone(store);
                    for (const key of Object.keys(obj)) set(staged, [ref.path, key].filter(Boolean).join('/'), obj[key]);
                    publish(staged); fixture.writes.push(clone(obj)); resolve();
                } catch (error) { reject(error); }
            }, 0)),
            runTransaction: (ref, fn) => new Promise((resolve, reject) => {
                const before = version;
                let next;
                try { next = fn(clone(get(ref.path))); } catch (error) { reject(error); return; }
                if (fixture.beforeCommit) fixture.beforeCommit(ref.path);
                setTimeout(() => {
                    try {
                        if (version !== before) { fixture.retries++; next = fn(clone(get(ref.path))); }
                        if (next !== undefined) { const staged = clone(store); set(staged, ref.path, next); publish(staged); }
                        resolve({ committed: next !== undefined, snapshot: snapshot(ref.path) });
                    } catch (error) { reject(error); }
                }, 0);
            })
        },
        bumpFromOtherDevice: (id, mutate) => { mutate(server[id]); version++; }
    };
    return fixture;
}

function makeCtx(server, fbSet) {
    const revenue = { cod: 0, dod: 0, count: 0 };
    const reconciliations = [];
    const pickup = [];
    const scanHistory = [];
    const localStorage = memoryStorage({ zoew_firebase_config: JSON.stringify(fbSet.db.app.options) });
    const ctx = {
        console, Math, JSON, Promise, setTimeout, clearTimeout, performance: require("node:perf_hooks").performance, TextEncoder, Uint8Array, Date, parseFloat, parseInt, isNaN, Error, Object, Array, String, RegExp,
        db: fbSet.db, fb: fbSet.api, dbRefHistory: { path: 'zoew_scan_history_cod_dod' },
        auth: { currentUser: { uid: 'fixture-scanner' }, app: fbSet.db.app },
        localStorage, crypto: require('crypto').webcrypto,
        scanHistory,
        getServerNow: () => 1755000000000,
        getFormattedDate: () => '2026-08-20',
        // ⛔ `addOrUpdateEntry()` បោះត្រាម៉ោងតាមប្រតិទិនកម្ពុជា (2.20.5)
        getFormattedClockTime: () => '10:30:00',
        generateUniqueId: () => 'id_new_' + Math.random().toString(36).slice(2, 8),
        ...ledgerStubEntries(
            (d, c, dd, n) => { revenue.cod += (parseFloat(c) || 0); revenue.dod += (parseFloat(dd) || 0); revenue.count += (parseFloat(n) || 0); },
            (d, applied, c, dd, n) => reconciliations.push({ d, applied, cod: c, dod: dd, count: n })
        ),
        markPickupBarcodes: (d, marks, seed) => { pickup.push({ d, marks, seed }); return null; },
        syncScannerLookupEntry: () => {},
        updateRecentPhonesList: () => {},
        refreshCurrentHistoryView: () => {},
        showToast: () => {},
        window: { localStorage },
        revenue,
        pickup,
        reconciliations
    };
    ctx.authGeneration = 0;
    vm.createContext(ctx);
    vm.runInContext(moduleRuntime(ROOT, src, [
        'src/core/storage.ts', 'src/core/shop-scope.ts',
        { path: 'src/services/scan-evidence.ts', expose: ['createScanEvidenceJournal'] },
        'src/services/scan-pending.ts', 'src/domain/barcode-key.ts', 'src/domain/scan-protocol.ts',
        { path: 'src/services/row-operation-lock.ts', expose: ['rowOperationActive'] },
        { path: 'src/services/scan-import-proof.ts', expose: ['scanImportProofValid', 'SCAN_IMPORT_CACHE_TTL_MS'] },
        { path: 'src/domain/ledger.ts', expose: ['ledgerOpRing', 'ledgerTokenSeen', 'ledgerLatestMonths'] },
        { path: 'src/services/network.ts', expose: ['dbOp', 'withTimeout', 'DB_OP_TIMEOUT_MS'] },
        { path: 'src/services/scan-operation.ts', expose: ['claimScanOperation', 'saveScanOperation', 'cancelScanOperation', 'finalizeScanOperation'] }
    ]).code, ctx);
    ctx.fixture = fbSet;
    // ព្រំដែនអាន SDK ប៉ុណ្ណោះ៖ ការសម្រេច operation/ម្ចាស់រត់ក្នុង coordinator ពិត។
    ctx.readRestoreServerNode = async (api, db, path) => (await api.get(api.ref(db, path))).val();
    vm.runInContext("var SCANNER_LOOKUP_BARCODE_INDEX_FIELD = '__zoeScannerLookupIndex';", ctx);
    vm.runInContext('var deletedItems = []; var activeRestoreClaims = new Map(); var dbListenerPendingPaths = new Set(); const DB_LISTENER_KEY_DELETED = "deleted";', ctx);
    for (const fn of ['barcodeRegistryKey', 'barcodeEntriesOf', 'normalizeBarcodesOf', 'getPickupPhoneKey',
                      'recalcItemMoneyFromBarcodes', 'applyBarcodeCloseState',
                      'itemHasRestoreMarkers', 'isActiveRestoreClaim', 'dropStaleRestoreMarkers',
                      'saveSingleHistoryItemToFirebase',
                      'freshHistoryItemShell', 'freshHistoryItemFrom',
                      'mergeBarcodeIntoHistoryItem', 'ledgerDeltaCompanion', 'addOrUpdateEntry']) {
        const code = extractFn(src, fn);
        if (code) vm.runInContext(code, ctx);
    }
    Object.defineProperty(ctx, 'revenue', { get: () => {
        const day = fbSet.store[DAILY]?.['2026-08-20'];
        return { cod: revenue.cod + (day?.codDollar || 0), dod: revenue.dod + (day?.dodDollar || 0), count: revenue.count + (day?.totalCount || 0) };
    } });
    ctx.committed = () => Object.values(fbSet.store.zoew_scan_operations || {}).filter(op => op.phase === 'committed');
    return ctx;
}

function seedOrder(server, codes) {
    server['ord1'] = {
        id: 'ord1', phone: '0970003546', scanDate: '2026-08-20', isClosed: false,
        createdAt: 1755000000000, time: 'x', barcode: codes[0],
        cod: codes.length * 5, dod: 0, price: codes.length * 5, count: codes.length,
        barcodes: codes.map((c) => ({ code: c, time: 'x', cod: 5, dod: 0, locker: 'N/A',
            isClosed: false, isDeducted: false, isFromDeletion: false, createdAt: 1755000000000 }))
    };
}

// ================= scenario 1: two devices scan into the same order at once =================
console.log('\n=== ZoeW — ឧបករណ៍ ២ ស្កេនចូល order ដដែលក្នុងពេលដំណាលគ្នា ===');
{
    const server = {};
    seedOrder(server, ['AAA']);
    const fbSet = makeFirebase(server);
    const ctx = makeCtx(server, fbSet);
    ctx.scanHistory.push(JSON.parse(JSON.stringify(server['ord1'])));

    // device A begins its write; device B lands a different barcode mid-flight
    const pA = ctx.addOrUpdateEntry('BBB', '0970003546', 7, 0, 'L1');
    fbSet.beforeCommit = path => { if (path !== HISTORY + '/ord1') return; fbSet.beforeCommit = null; fbSet.bumpFromOtherDevice('ord1', (it) => {
        it.barcodes.push({ code: 'CCC', time: 'x', cod: 9, dod: 0, locker: 'L2',
            isClosed: false, isDeducted: false, isFromDeletion: false, createdAt: 1755000000000 });
        it.count = it.barcodes.length;
        it.cod = it.barcodes.reduce((s, b) => s + b.cod, 0);
    }); };

    (async () => {
        await pA;
        const codes = (server['ord1'].barcodes || []).map((b) => b.code);
        ok(codes.includes('CCC'), 'barcode របស់ឧបករណ៍ផ្សេង មិនត្រូវបានលុបចោល', codes);
        ok(codes.includes('BBB'), 'barcode របស់ឧបករណ៍នេះ ត្រូវបានរក្សាទុក', codes);
        ok(codes.length === 3, 'barcode ទាំង ៣ នៅគ្រប់', codes);
        const sumCod = server['ord1'].barcodes.reduce((s, b) => s + (parseFloat(b.cod) || 0), 0);
        ok(server['ord1'].cod === Math.round(sumCod * 100) / 100,
            'ផលបូក cod កម្រិត item ត្រូវនឹង barcodes ពិត', { item: server['ord1'].cod, sum: sumCod });
        ok(server['ord1'].count === codes.length, 'count ត្រូវនឹងចំនួន barcode ពិត', server['ord1'].count);
        ok(ctx.revenue.count === 1, 'លុយត្រូវបានបូកតែម្តងសម្រាប់ការស្កេននេះ', ctx.revenue.count);
        ok(ctx.committed().length === 1 && ctx.committed()[0].cod === 7 && ctx.committed()[0].count === 1 && fbSet.retries > 0,
            'history conflict retry ➜ committed receipt និងប្រាក់តែម្តង', ctx.committed());
        runScenario2();
    })();
}

// ================= scenario 2: normal single-device scan still behaves =================
function runScenario2() {
    console.log('\n=== ការស្កេនធម្មតា (ឧបករណ៍តែមួយ) នៅតែដដែល ===');
    const server = {};
    seedOrder(server, ['AAA']);
    const fbSet = makeFirebase(server);
    const ctx = makeCtx(server, fbSet);
    ctx.scanHistory.push(JSON.parse(JSON.stringify(server['ord1'])));

    ctx.addOrUpdateEntry('BBB', '0970003546', 7, 0, 'L1').then(() => {
        const it = server['ord1'];
        ok(it.barcodes.length === 2, 'barcode ថ្មីត្រូវបានបន្ថែម', it.barcodes.map((b) => b.code));
        ok(it.cod === 12, 'cod = 5 + 7', it.cod);
        ok(it.price === 12, 'price ត្រូវបានគណនាឡើងវិញ', it.price);
        ok(it.isClosed === false && it.closedAt === undefined, 'order បើកវិញ ហើយ closedAt ត្រូវលុប');
        ok(it.barcode === 'BBB', 'barcode កម្រិត item ជា barcode ចុងក្រោយ', it.barcode);
        ok(ctx.revenue.count === 1 && ctx.revenue.cod === 7, 'លុយបូកតែ barcode ថ្មី', ctx.revenue);
        ok(ctx.committed().length === 1, 'ការស្កេនធម្មតា committed receipt តែម្តង', ctx.reconciliations);
        ok(ctx.localStorage.length === 1, 'history + ledger confirmed ➜ persistent scan evidence cleared', ctx.localStorage.length);
        const local = ctx.scanHistory.find((i) => i.id === 'ord1');
        ok(local && local.barcodes.length === 2, 'ស្ថានភាពក្នុងសតិត្រូវបានធ្វើបច្ចុប្បន្នភាពភ្លាម', local && local.barcodes.length);
        ok(ctx.pickup.length === 0, 'order ដែលបើកស្រាប់ ➜ មិនប៉ះស្ថិតិយកកញ្ចប់', JSON.stringify(ctx.pickup));
        runScenario2b();
    });
}

// ===== scenario 2b: server copy already closed (another device) ➜ customer must uncount =====
function runScenario2b() {
    console.log('\n=== legacy v1 ដែលរៀបចំរួច៖ server បិទមុន merge ===');
    const server = {};
    seedOrder(server, ['AAA']);
    server['ord1'].isClosed = true;
    server['ord1'].closedAt = 1755000000000;
    server['ord1'].barcodes[0].isClosed = true;
    const fbSet = makeFirebase(server);
    const ctx = makeCtx(server, fbSet);
    // ច្បាប់ចម្លងក្នុងសតិនៅយឺត — នៅបើកដដែល (នេះជាមូលហេតុដែល addOrUpdateEntry ជ្រើសវា)
    const stale = JSON.parse(JSON.stringify(server['ord1']));
    stale.isClosed = false;
    delete stale.closedAt;
    stale.barcodes[0].isClosed = false;
    ctx.scanHistory.push(stale);

    ctx.addOrUpdateEntry('BBB', '0970003546', 7, 0, 'L1', 0, 0, ctx.preparePendingScan('BBB', 7, 0, 0, 'legacy-compatibility', 1)).then(() => {
        const it = server['ord1'];
        ok(it.isClosed === false && it.closedAt === undefined, 'order ត្រូវបានបើកវិញលើ server');
        ok(it.barcodes.length === 2, 'barcode ថ្មីត្រូវបានបន្ថែម', it.barcodes.map((b) => b.code));
        // ⛔ **ប្តូរដោយចេតនាក្នុងកំណែ 2.19.4។** មុននេះផ្លូវនេះបញ្ចេញ `(-1, 0)` —
        // ដកអតិថិជន ១ ដោយ **មិនដកកញ្ចប់** ➜ លេខទាំង ២ ឃ្លាតពីគ្នា។ ការ merge
        // ស្កេនបើក item តែ **មិនប្តូរស្ថានភាព barcode ណាមួយ** ដូច្នេះតាមការ
        // រាប់តាម barcode (មូលដ្ឋានតែមួយ) ledger **មិនត្រូវប្រែសោះ**។
        // អះអាងចាស់ចាក់សោការឃ្លាតគ្នាទុកជាឥរិយាបថត្រឹមត្រូវ — វាខុស។
        ok(ctx.pickup.every((e) => e.cust === e.pkg),
            '⛔ រាល់ការកែស្ថិតិយក ៖ delta អតិថិជន === delta កញ្ចប់ (មូលដ្ឋានតែមួយ)',
            JSON.stringify(ctx.pickup));
        const pickupNet = ctx.pickup.reduce((a, e) => ({ cust: a.cust + e.cust, pkg: a.pkg + e.pkg }), { cust: 0, pkg: 0 });
        ok(pickupNet.cust === 0 && pickupNet.pkg === 0,
            'ការ merge ស្កេនមិនប្តូរ barcode ណាមួយ ➜ ស្ថិតិយកមិនប្រែ',
            JSON.stringify(pickupNet));
        ok(it.barcodes[0].isClosed === true, 'barcode ដែលយកហើយ នៅតែបិទដដែល');
        runScenario3();
    });
}

// ============ scenario 3: the gapped shape must not lose barcodes here either ============
function runScenario3() {
    console.log('\n=== order ដែល Firebase ត្រឡប់មកជា object ដែលមាន gap ===');
    const server = {};
    seedOrder(server, ['AAA', 'ZZZ']);
    server['ord1'].barcodes = { '0': server['ord1'].barcodes[0], '2': server['ord1'].barcodes[1] };
    const fbSet = makeFirebase(server);
    const ctx = makeCtx(server, fbSet);
    ctx.scanHistory.push(JSON.parse(JSON.stringify(server['ord1'])));

    ctx.addOrUpdateEntry('BBB', '0970003546', 7, 0, 'L1').then(() => {
        const codes = (server['ord1'].barcodes || []).map((b) => b && b.code);
        ok(Array.isArray(server['ord1'].barcodes), 'barcodes ត្រូវបានធ្វើឲ្យជា array ពិត', server['ord1'].barcodes);
        ok(codes.includes('AAA') && codes.includes('ZZZ') && codes.includes('BBB'),
            'គ្មាន barcode ណាបាត់ពីរូបរាង object', codes);
        runStorageFailure();
    });
}

async function runStorageFailure() {
    const server = {};
    seedOrder(server, ['AAA']);
    const ctx = makeCtx(server, makeFirebase(server));
    ctx.scanHistory.push(JSON.parse(JSON.stringify(server.ord1)));
    let attempted = 0;
    const setItem = ctx.localStorage.setItem;
    ctx.localStorage.setItem = (key, value) => {
        if (String(key).startsWith('zoew_scan_evidence_v2:')) { attempted++; throw new Error('quota'); }
        setItem(key, value);
    };
    let rejected = false;
    try { await ctx.addOrUpdateEntry('BBB', '0970003546', 7, 0, 'L1'); }
    catch (error) { rejected = error.code === 'scan_evidence_unavailable'; }
    ok(attempted === 1 && rejected, 'storage fault reaches actual journal and rejects before money', { attempted, rejected });
    ok(ctx.revenue.count === 0 && ctx.reconciliations.length === 0, 'unpersisted scan performs no ledger effect', ctx.revenue);
    ok(server.ord1.barcodes.length === 1 && ctx.scanHistory[0].barcodes.length === 1,
        'unpersisted scan changes neither server nor optimistic barcode list');
    await runProtocolControls();
    finish();
}

async function runProtocolControls() {
    console.log('\n=== public v2៖ ភស្តុតាងម្ចាស់ និង atomic money ===');
    const server = {}; seedOrder(server, ['AAA']);
    const fixture = makeFirebase(server), ctx = makeCtx(server, fixture);
    ctx.scanHistory.push(clone(server.ord1));
    ok(await ctx.addOrUpdateEntry('BBB', '0970003546', 7, 0, 'L1') === true, 'public v2 រក្សាទុកបាន');
    const receipt = ctx.committed()[0], owner = fixture.store.zoew_barcode_registry.BBB;
    ok(receipt?.v === 2 && receipt.code === 'BBB' && receipt.targetId === 'ord1' && receipt.actorUid === 'fixture-scanner'
        && owner?.v === 2 && owner.intent === receipt.id && owner.actorUid === receipt.actorUid && owner.birth === receipt.birth,
        'receipt/history/registry ភ្ជាប់ម្ចាស់តែមួយ', { receipt, owner });
    ok(!server.ord1.scanPending && !fixture.store.zoew_scan_pending?.[receipt.id]
        && server.ord1.barcodes[1].scanIntent === receipt.id, 'finalize សម្អាត pending តែក្រោយមាន receipt');
    const daily = fixture.store[DAILY]['2026-08-20'], month = fixture.store[MONTHLY]['2026-08'];
    ok(daily.codDollar === 7 && daily.totalCount === 1 && month.codDollar === 7 && month.totalCount === 1,
        'daily និង monthly បូកតែម្តង', { daily, month });
    const prior = clone(server), money = clone(daily);
    ok(await ctx.addOrUpdateEntry('BBB', '0970003546', 7, 0, 'L1') === 'unknown', 'registry owned ទប់ការស្កេនស្ទួន');
    ok(JSON.stringify(server) === JSON.stringify(prior) && JSON.stringify(fixture.store[DAILY]['2026-08-20']) === JSON.stringify(money)
        && ctx.committed().length === 1, 'ស្កេនស្ទួនមិនប្តូរ history ឬប្រាក់');

    for (const fault of ['atomic', 'owner']) {
        const rows = {}; seedOrder(rows, ['AAA']);
        const f = makeFirebase(rows), c = makeCtx(rows, f);
        c.scanHistory.push(clone(rows.ord1));
        let injected = false;
        if (fault === 'atomic') {
            const update = f.api.update;
            f.api.update = (ref, packet) => {
                if (Object.values(packet).some(value => value?.phase === 'committed')) {
                    injected = true;
                    return update(ref, { ...packet, [DAILY + '/2026-08-20/codDollar']: { '.sv': { increment: NaN } } });
                }
                return update(ref, packet);
            };
        } else f.beforeCommit = path => {
            if (path !== HISTORY + '/ord1') return;
            f.beforeCommit = null; injected = true;
            f.store.zoew_barcode_registry.BBB.actorUid = 'other-owner';
        };
        ok(await c.addOrUpdateEntry('BBB', '0970003546', 7, 0, 'L1') === 'unknown' && injected,
            fault + ' ខូចភស្តុតាង ➜ HOLD មិនបង្ហាញជោគជ័យ');
        const op = Object.values(f.store.zoew_scan_operations)[0];
        ok(op.phase === 'prepared' && rows.ord1.scanPending?.intent === op.id && f.store.zoew_scan_pending?.[op.id] === op.actorUid,
            fault + ' រក្សា prepared/pending មិនលុបភស្តុតាង');
        ok(!f.store[DAILY] && f.store[MONTHLY]['2026-08'].codDollar === 0 && f.store[MONTHLY]['2026-08'].totalCount === 0,
            fault + ' មិនមាន partial money/receipt commit');
        ok(c.localStorage.length > 1, fault + ' journal រង់ចាំការផ្ទៀងផ្ទាត់នៅសល់');
    }

    const closed = {}; seedOrder(closed, ['AAA']);
    const f = makeFirebase(closed), c = makeCtx(closed, f);
    c.scanHistory.push(clone(closed.ord1));
    closed.ord1.isClosed = true; closed.ord1.closedAt = 1755000000000; closed.ord1.barcodes[0].isClosed = true;
    const before = clone(closed.ord1);
    ok(await c.addOrUpdateEntry('BBB', '0970003546', 7, 0, 'L1') === 'unknown', 'public v2៖ stale open/server closed មិន merge');
    ok(JSON.stringify(closed.ord1) === JSON.stringify(before) && !f.store[DAILY] && !f.store.zoew_barcode_registry.BBB
        && Object.values(f.store.zoew_scan_operations).every(op => op.phase === 'cancelled') && c.pickup.length === 0,
        'public v2៖ cancel ពិត រក្សា closed/pickup និងមិនបូកប្រាក់');
    c.scanHistory.splice(0, c.scanHistory.length, clone(closed.ord1));
    ok(await c.addOrUpdateEntry('BBB', '0970003546', 7, 0, 'L1') === true, 'refresh រួច retry បង្កើត row ថ្មី');
    ok(Object.keys(closed).length === 2 && JSON.stringify(closed.ord1) === JSON.stringify(before)
        && f.store[DAILY]['2026-08-20'].totalCount === 1 && c.pickup.length === 0,
        'retry មិនបើក barcode យករួច ឬបូកប្រាក់ស្ទួន');
}

function finish() {
    console.log('\n' + (fail ? 'FAIL ' : 'PASS ') + pass + '/' + (pass + fail));
    process.exit(fail ? 1 : 0);
}
