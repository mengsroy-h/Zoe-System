const fs = require('fs');
const path = require('path');
const vm = require('vm');

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
function makeFirebase(server) {
    let version = 0;
    return {
        db: {},
        api: {
            ref: (db, p) => ({ path: p }),
            update: (ref, obj) => new Promise((resolve) => {
                // a write is a network round trip: anything another device commits
                // in the meantime is already on the server when this lands
                setTimeout(() => {
                    Object.keys(obj).forEach((k) => { server[k] = obj[k]; version++; });
                    resolve();
                }, 0);
            }),
            runTransaction: (ref, fn) => {
                const id = ref.path.split('/').pop();
                return new Promise((resolve) => {
                    // model RTDB: run against current value, and if another writer landed
                    // in between, re-run against the newer value before committing
                    const startVersion = version;
                    const current = server[id] ? JSON.parse(JSON.stringify(server[id])) : null;
                    const next = fn(current);
                    const commit = () => {
                        if (version !== startVersion) {
                            const fresh = server[id] ? JSON.parse(JSON.stringify(server[id])) : null;
                            const retried = fn(fresh);
                            if (retried !== undefined) { server[id] = retried; version++; }
                            resolve({ committed: true, snapshot: { val: () => server[id] } });
                            return;
                        }
                        if (next !== undefined) { server[id] = next; version++; }
                        resolve({ committed: true, snapshot: { val: () => server[id] } });
                    };
                    setTimeout(commit, 0);
                });
            }
        },
        bumpFromOtherDevice: (id, mutate) => { mutate(server[id]); version++; }
    };
}

function makeCtx(server, fbSet) {
    const revenue = { cod: 0, dod: 0, count: 0 };
    const pickup = [];
    const scanHistory = [];
    const ctx = {
        console, Math, JSON, Promise, setTimeout, Date, parseFloat, parseInt, isNaN, Error, Object, Array, String, RegExp,
        db: fbSet.db, fb: fbSet.api, dbRefHistory: { path: 'zoew_scan_history_cod_dod' },
        scanHistory,
        getServerNow: () => 1755000000000,
        getFormattedDate: () => '2026-08-20',
        // ⛔ `addOrUpdateEntry()` បោះត្រាម៉ោងតាមប្រតិទិនកម្ពុជា (2.20.5)
        getFormattedClockTime: () => '10:30:00',
        generateUniqueId: () => 'id_new_' + Math.random().toString(36).slice(2, 8),
        addRevenueToDailyAndMonthlyRecord: (d, c, dd, n) => { revenue.cod += c; revenue.dod += dd; revenue.count += n; },
        addPickupToDailyRecord: (d, key, cust, pkg) => { pickup.push({ d, key, cust, pkg }); },
        syncScannerLookupEntry: () => {},
        updateRecentPhonesList: () => {},
        refreshCurrentHistoryView: () => {},
        showToast: () => {},
        window: {},
        revenue,
        pickup
    };
    vm.createContext(ctx);
    vm.runInContext("var SCANNER_LOOKUP_BARCODE_INDEX_FIELD = '__zoeScannerLookupIndex';", ctx);
    vm.runInContext('var deletedItems = []; var activeRestoreClaims = new Map(); var dbListenerPendingPaths = new Set(); const DB_LISTENER_KEY_DELETED = "deleted";', ctx);
    for (const fn of ['barcodeEntriesOf', 'normalizeBarcodesOf', 'getPickupPhoneKey',
                      'itemHasRestoreMarkers', 'isActiveRestoreClaim', 'dropStaleRestoreMarkers',
                      'saveSingleHistoryItemToFirebase',
                      'mergeBarcodeIntoHistoryItem', 'addOrUpdateEntry']) {
        const code = extractFn(src, fn);
        if (code) vm.runInContext(code, ctx);
    }
    return ctx;
}

function seedOrder(server, codes) {
    server['ord1'] = {
        id: 'ord1', phone: '0977173546', scanDate: '2026-08-20', isClosed: false,
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
    const pA = ctx.addOrUpdateEntry('BBB', '0977173546', 7, 0, 'L1');
    fbSet.bumpFromOtherDevice('ord1', (it) => {
        it.barcodes.push({ code: 'CCC', time: 'x', cod: 9, dod: 0, locker: 'L2',
            isClosed: false, isDeducted: false, isFromDeletion: false, createdAt: 1755000000000 });
        it.count = it.barcodes.length;
        it.cod = it.barcodes.reduce((s, b) => s + b.cod, 0);
    });

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

    ctx.addOrUpdateEntry('BBB', '0977173546', 7, 0, 'L1').then(() => {
        const it = server['ord1'];
        ok(it.barcodes.length === 2, 'barcode ថ្មីត្រូវបានបន្ថែម', it.barcodes.map((b) => b.code));
        ok(it.cod === 12, 'cod = 5 + 7', it.cod);
        ok(it.price === 12, 'price ត្រូវបានគណនាឡើងវិញ', it.price);
        ok(it.isClosed === false && it.closedAt === undefined, 'order បើកវិញ ហើយ closedAt ត្រូវលុប');
        ok(it.barcode === 'BBB', 'barcode កម្រិត item ជា barcode ចុងក្រោយ', it.barcode);
        ok(ctx.revenue.count === 1 && ctx.revenue.cod === 7, 'លុយបូកតែ barcode ថ្មី', ctx.revenue);
        const local = ctx.scanHistory.find((i) => i.id === 'ord1');
        ok(local && local.barcodes.length === 2, 'ស្ថានភាពក្នុងសតិត្រូវបានធ្វើបច្ចុប្បន្នភាពភ្លាម', local && local.barcodes.length);
        ok(ctx.pickup.length === 0, 'order ដែលបើកស្រាប់ ➜ មិនប៉ះស្ថិតិយកកញ្ចប់', JSON.stringify(ctx.pickup));
        runScenario2b();
    });
}

// ===== scenario 2b: server copy already closed (another device) ➜ customer must uncount =====
function runScenario2b() {
    console.log('\n=== ឧបករណ៍ផ្សេងបិទ order រួច ខណៈយើងស្កេនកញ្ចប់ថ្មីចូល ===');
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

    ctx.addOrUpdateEntry('BBB', '0977173546', 7, 0, 'L1').then(() => {
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

    ctx.addOrUpdateEntry('BBB', '0977173546', 7, 0, 'L1').then(() => {
        const codes = (server['ord1'].barcodes || []).map((b) => b && b.code);
        ok(Array.isArray(server['ord1'].barcodes), 'barcodes ត្រូវបានធ្វើឲ្យជា array ពិត', server['ord1'].barcodes);
        ok(codes.includes('AAA') && codes.includes('ZZZ') && codes.includes('BBB'),
            'គ្មាន barcode ណាបាត់ពីរូបរាង object', codes);
        finish();
    });
}

function finish() {
    console.log('\n' + (fail ? 'FAIL ' : 'PASS ') + pass + '/' + (pass + fail));
    process.exit(fail ? 1 : 0);
}
