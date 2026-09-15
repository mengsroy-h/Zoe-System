// ⛔ ថ្នាក់កំហុស៖ **ស្ថិតិយករាប់ដោយ delta ជំនួសការរាប់ barcode។**
//
// `zoew_daily_pickup_cod_dod/$date/packagesPickedUp` ជា **លេខតែមួយ** ដែល
// ឧបករណ៍នីមួយៗបូក/ដក `±1` ចូល។ លេខនោះ **គ្មានអត្តសញ្ញាណ** ៖ វាមិនដឹងថា
// `+1` មួយណាមកពី barcode ណាទេ ➜ ការបូកស្ទួន · ការដកដែលបាត់ · និងការ
// «ជួសជុល» ដែលគណនាធៀបនឹង **ទិដ្ឋភាពចាស់** សុទ្ធតែបង្កើតកញ្ចប់ពីអាកាសធាតុ។
//
// លំដាប់ដែលអ្នកប្រើវាស់បានលើឧបករណ៍ពិត (2026-09-04) ៖
//   A ៖ បិទ «យក»          ➜ server = 1
//   A ៖ បិទ WiFi ➜ បើកវិញ  ➜ ការសរសេរចូជួរក្នុងឧបករណ៍
//   B ៖ បើកកញ្ចប់នោះ       ➜ server = 0
//   A ៖ បើក WiFi          ➜ 🔴 1  (កញ្ចប់កើតពីអាកាសធាតុ)
//   A ៖ បិទ «យក» ម្តងទៀត   ➜ 🔴 2  (ជាន់លើការផ្ទុះ)
//
// កំណែ 2.26.1 និង 2.26.2 កែ **ផ្លូវ server** ពីរដង ហើយថ្នាក់នេះនៅតែវិល
// មកវិញ ព្រោះការកែទាំងនោះនៅតែជា **នព្វន្ធលើ delta**។ ដរាបណាលេខគ្មាន
// អត្តសញ្ញាណ ការគណនាណាមួយក៏អាចខុសបាន។
//
// ⛔ ច្បាប់ដែលឯកសារនេះចាក់សោ ៖ **ស្ថិតិយកត្រូវជា *សំណុំ barcode*** ៖
//   `zoew_daily_pickup_cod_dod/$date/pickedUpBarcodes/$barcodeKey = phoneKey`
//   ហើយ `packagesPickedUp` និង `pickedUpPhones` ត្រូវជា **កញ្ចក់ដេរីវេ**
//   នៃសំណុំនោះ។ ការសរសេរក្លាយជា **idempotent** ➜ ការជាន់គ្នា · ការចូជួរ
//   ក្រៅបណ្តាញ · និងការព្យាយាមឡើងវិញ **មិនអាចបង្កើតកញ្ចប់បានទេ** ព្រោះ
//   barcode តែមួយកាន់កន្លែងតែមួយ។
//
// របៀបដែលវាវាស់ ៖ ឧបករណ៍ **២** (context vm ២) ចែក **store តែមួយ** ហើយ
// fake SDK **អនុវត្ត rules ពិត** (`firebase-database.rules.json`) ៖ ការ
// សរសេរដែល `$other: false` ឬព្រំដែនលេខបដិសេធ ត្រូវ **បរាជ័យពិត**។
// ឧបករណ៍ A អាចចូល «របៀបក្រៅបណ្តាញ» ➜ transaction ចូលជួរ រួច **រត់ឡើងវិញ
// លើតម្លៃ server ថ្មី** ពេលភ្ជាប់មកវិញ — ដូច RTDB ពិតបេះបិទ។
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = process.env.PICKUPID_APP_DIR || path.join(__dirname, '..');
const APP = path.join(ROOT, 'ZoeW');

let pass = 0, fail = 0;
function ok(label, cond, detail) {
    if (cond) { pass++; console.log('   ok    ' + label); }
    else { fail++; console.log('  FAIL   ' + label + (detail !== undefined ? '\n         ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : '')); }
}

let SRC = '';
try {
    SRC = fs.readFileSync(path.join(APP, 'app.js'), 'utf8');
} catch (e) {
    console.log('  FAIL   អាន ZoeW/app.js មិនបាន ➜ ' + e.message);
    console.log('\n❌ ធ្លាក់ — កូដដែលតេស្តនេះការពារ បាត់ពី tree ដែលកំពុងពិនិត្យ');
    process.exit(1);
}
let RULES = null;
try {
    RULES = JSON.parse(fs.readFileSync(path.join(ROOT, 'firebase-database.rules.json'), 'utf8')).rules;
} catch (e) {
    console.log('  FAIL   អាន firebase-database.rules.json មិនបាន ➜ ' + e.message);
    console.log('\n❌ ធ្លាក់ — rules ជាប្រភពការពិតរបស់តេស្តនេះ');
    process.exit(1);
}

function sliceFn(name) {
    const at = SRC.search(new RegExp('(?:async\\s+)?function\\s+' + name + '\\s*\\('));
    if (at === -1) return null;
    let depth = 0;
    const start = SRC.indexOf('{', SRC.indexOf(')', at));
    for (let k = start; k < SRC.length; k++) {
        if (SRC[k] === '{') depth++;
        else if (SRC[k] === '}') { depth--; if (!depth) return SRC.slice(at, k + 1); }
    }
    return null;
}
function sliceConst(name) {
    const m = new RegExp('const\\s+' + name + '\\s*=\\s*([^;\\n]+);').exec(SRC);
    return m ? 'const ' + name + ' = ' + m[1] + ';' : null;
}
const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

// ── ០. ជាន់អប្បបរមា ─────────────────────────────────────────────────
console.log('\n=== ០. ជាន់អប្បបរមា (checker នេះត្រូវអាចធ្លាក់បាន) ===');
ok('ZoeW/app.js មិនទទេ (>= 4000 បន្ទាត់)', SRC.split('\n').length >= 4000, SRC.split('\n').length);

const REAL_FNS = [
    'elapsedSince', 'withTimeout', 'dbOp', 'dbOpStalled', 'armLateWrite',
    'barcodeEntriesOf', 'normalizeBarcodesOf', 'applyBarcodeCloseState', 'normalizeBarcodeCloseStamps',
    'itemHasRestoreMarkers', 'dropStaleRestoreMarkers', 'barcodeRegistryKey',
    'ledgerNumber', 'getPickupPhoneKey', 'countPickedUpCustomers',
    'getFormattedDate', 'armLateCommit', 'viewListModalShowing', 'notifyIfSlow',
    'toggleIndividualBarcodeClose', 'applyBarcodeCloseChange', 'toggleCloseStatus'
];
// ឈ្មោះខាងក្រោមប្រែតាមម៉ូដែល ៖ tree មុនកែប្រើ **delta** ចំណែក tree ក្រោយ
// កែប្រើ **សំណុំ barcode**។ យកអ្វីដែលមាន — កុំបញ្ឈប់ checker (មេរៀន 2.19.3)។
const EITHER_FNS = [
    'addPickupToDailyRecord', 'applyPickupMemoryDelta', 'commitDailyPickupDelta', 'pickupAppliedDelta',
    'revertPickupOnServer', 'revertPickupLedgerDelta', 'correctPickupServerToActual', 'correctPickupLedgerToActual',
    'pickupBarcodeKey', 'pickupSetSize', 'tallyPickupPhones', 'legacyPickupPlaceholders', 'pickupSetFromRecord',
    'buildPickupRecordFromSet', 'applyPickupMarksToSet', 'applyPickupMarksInMemory', 'commitPickupMarks',
    'markPickupBarcodes', 'revertPickupMarks', 'reapplyPickupMarks', 'collectPickupMarks', 'reconstructPickupSet',
    'getZoneDateKey', 'appZoneParts', 'statsMoney', 'statsPositive', 'ledgerNumber',
    'collectedSetFromRecord', 'collectedMarkValueOf', 'collectedDayOfStamp', 'collectedDayHoldingKey',
    'collectedMarksFor', 'commitCollectedMarks', 'markCollectedRevenue', 'reconcileCollectedPriceState', 'reconcileCollectedHistory'
];
const fnSrc = {};
const missing = [];
for (const n of REAL_FNS) {
    const s = sliceFn(n);
    if (s) fnSrc[n] = s; else missing.push(n);
}
ok('រក function ពិតឃើញទាំង ' + REAL_FNS.length, missing.length === 0, missing);
for (const n of missing) fnSrc[n] = 'function ' + n + '() { return Promise.resolve(); }';
const eitherSrc = EITHER_FNS.map((n) => sliceFn(n)).filter(Boolean).join('\n\n');
const eitherFound = EITHER_FNS.filter((n) => sliceFn(n));
ok('រកផ្លូវសរសេរស្ថិតិយកឃើញយ៉ាងតិច ៤ function', eitherFound.length >= 4, eitherFound);

// ── ១. rules ពិតត្រូវប្រកាសសំណុំ barcode ─────────────────────────────
console.log('\n=== ១. rules ពិត ៖ ស្ថិតិយកត្រូវមានអត្តសញ្ញាណ barcode ===');
const PICKUP_RULE = (RULES.zoew_daily_pickup_cod_dod || {})['$date'] || {};
function numericBound(node) {
    const raw = node && node['.validate'];
    if (typeof raw !== 'string') return null;
    const m = /newData\.isNumber\(\)\s*&&\s*newData\.val\(\)\s*(>=|>)\s*(-?[0-9.]+)/.exec(raw);
    return m ? { op: m[1], limit: parseFloat(m[2]) } : null;
}
const packagesBound = numericBound(PICKUP_RULE.packagesPickedUp);
const phoneBound = numericBound((PICKUP_RULE.pickedUpPhones || {})['$phoneKey']);
ok('`packagesPickedUp` នៅតែទាមទារ `>= 0`', !!packagesBound && packagesBound.op === '>=' && packagesBound.limit === 0, packagesBound);
ok('`pickedUpPhones/$phoneKey` នៅតែទាមទារ `> 0`', !!phoneBound && phoneBound.op === '>' && phoneBound.limit === 0, phoneBound);

const barcodeRule = (PICKUP_RULE.pickedUpBarcodes || {})['$barcodeKey'];
const barcodeValidate = barcodeRule && typeof barcodeRule['.validate'] === 'string' ? barcodeRule['.validate'] : '';
ok('⛔ rules ប្រកាស `pickedUpBarcodes/$barcodeKey` (បើអត់ ➜ `$other: false` បដិសេធរាល់ការសរសេរ)',
    !!barcodeValidate, barcodeValidate || 'គ្មាន');
ok('`pickedUpBarcodes/$barcodeKey` ជា **ខ្សែអក្សរ** (កូនសោ barcode ➜ តម្លៃជា phoneKey)',
    /newData\.isString\(\)/.test(barcodeValidate), barcodeValidate || 'គ្មាន');
ok('`pickedUpBarcodes/$barcodeKey` មានពិដានប្រវែង', /length\s*<=\s*[0-9]+/.test(barcodeValidate), barcodeValidate || 'គ្មាន');
ok('`$other: false` នៅតែឈរលើ node ស្ថិតិយក', (PICKUP_RULE.$other || {})['.validate'] === false);

const maxLenM = /length\s*<=\s*([0-9]+)/.exec(barcodeValidate);
const phoneCapM = /const PICKUP_PHONE_KEY_MAX = ([0-9]+);/.exec(SRC);
ok('⛔ ពិដានប្រវែង phoneKey ក្នុងកូដ ស៊ីនឹងពិដានក្នុង rules (កុំចាក់ literal ២ កន្លែងឲ្យឃ្លាតគ្នា)',
    !!phoneCapM && !!maxLenM && parseInt(phoneCapM[1], 10) === parseInt(maxLenM[1], 10),
    { code: phoneCapM && phoneCapM[1], rules: maxLenM && maxLenM[1] });
const BARCODE_VALUE_MAX = maxLenM ? parseInt(maxLenM[1], 10) : 64;
const ALLOWED_PICKUP_KEYS = Object.keys(PICKUP_RULE).filter((k) => !k.startsWith('.') && k !== '$other');

// ── ២. ពិភពដែលមានឧបករណ៍ ២ ចែក store តែមួយ ──────────────────────────
const DENIED = 'PERMISSION_DENIED: Client doesn\'t have permission to access the desired data.';
const TIME_SCALE = 50;                    // ១៥ វិ. ➜ ៣០០ms
const STALL_WAIT_MS = 460;                // > ពិដាន dbOp ដែលធ្លាក់មាត្រដ្ឋាន
const SCAN_DATE = '2026-08-19';
const T0 = 1750000000000;
const hostSetTimeout = setTimeout;
const wait = (ms) => new Promise((r) => hostSetTimeout(r, ms));
const settle = async (n) => { for (let i = 0; i < (n || 6); i++) await new Promise((r) => hostSetTimeout(r, 0)); };

function validatePickupWrite(value) {
    if (value === null || value === undefined) return null;
    if (typeof value !== 'object') return 'តម្លៃមិនមែនវត្ថុ';
    for (const key of Object.keys(value)) {
        if (ALLOWED_PICKUP_KEYS.indexOf(key) === -1) return '$other បដិសេធវាល `' + key + '`';
        const v = value[key];
        if (v === null) continue;
        if (key === 'pickedUpPhones') {
            if (typeof v !== 'object') return 'pickedUpPhones មិនមែនវត្ថុ';
            for (const pk of Object.keys(v)) {
                if (typeof v[pk] !== 'number' || !isFinite(v[pk])) return 'pickedUpPhones/' + pk + ' មិនមែនលេខ';
                if (!(v[pk] > 0)) return 'pickedUpPhones/' + pk + ' = ' + v[pk] + ' (ត្រូវ > 0)';
            }
            continue;
        }
        if (key === 'pickedUpBarcodes') {
            if (!barcodeValidate) return '$other បដិសេធវាល `pickedUpBarcodes`';
            if (typeof v !== 'object') return 'pickedUpBarcodes មិនមែនវត្ថុ';
            for (const bk of Object.keys(v)) {
                if (typeof v[bk] !== 'string' || !v[bk]) return 'pickedUpBarcodes/' + bk + ' មិនមែនខ្សែអក្សរ';
                if (v[bk].length > BARCODE_VALUE_MAX) return 'pickedUpBarcodes/' + bk + ' វែងពេក';
            }
            continue;
        }
        if (typeof v !== 'number' || !isFinite(v)) return key + ' មិនមែនលេខ';
        if (v < 0) return key + ' = ' + v + ' (ត្រូវ >= 0)';
    }
    return null;
}

function makeShared(seed) {
    const shared = { store: clone(seed) || {}, rejected: [], writes: [] };
    shared.get = (raw) => {
        const parts = String(raw || '').split('/').filter(Boolean);
        let cur = shared.store;
        for (const p of parts) {
            if (!cur || typeof cur !== 'object') return null;
            cur = cur[p];
        }
        return cur === undefined ? null : cur;
    };
    shared.set = (raw, value) => {
        const parts = String(raw || '').split('/').filter(Boolean);
        let cur = shared.store;
        for (let i = 0; i < parts.length - 1; i++) {
            if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
            cur = cur[parts[i]];
        }
        const key = parts[parts.length - 1];
        if (value === null || value === undefined) delete cur[key];
        else cur[key] = clone(value);
    };
    shared.pickup = () => shared.get('zoew_daily_pickup_cod_dod/' + SCAN_DATE) || {};
    return shared;
}

function makeDevice(shared, name) {
    const dev = { name: name, toasts: [], queue: [], offline: false, timers: new Set() };
    const isPickup = (p) => /^zoew_daily_pickup_cod_dod/.test(p);

    function exec(refPath, updater) {
        const cur = shared.get(refPath);
        const next = updater(cur === null ? null : clone(cur));
        if (next === undefined) return { committed: false, snapshot: { val: () => clone(shared.get(refPath)) } };
        if (isPickup(refPath)) {
            const why = validatePickupWrite(next);
            if (why) {
                shared.rejected.push({ dev: name, path: refPath, why: why, value: clone(next) });
                const err = new Error(DENIED);
                err.__denied = true;
                throw err;
            }
        }
        shared.set(refPath, next);
        shared.writes.push({ dev: name, path: refPath });
        return { committed: true, snapshot: { val: () => clone(shared.get(refPath)) } };
    }

    const fb = {
        ref: (_db, raw) => ({ path: raw === undefined ? '' : String(raw) }),
        get: (ref) => Promise.resolve({ exists: () => shared.get(ref.path) !== null, val: () => clone(shared.get(ref.path)) }),
        increment: (n) => ({ __increment: n }),
        update: (ref, updates) => Promise.resolve().then(() => {
            Object.keys(updates).forEach((k) => shared.set([ref.path, k].filter(Boolean).join('/'), updates[k]));
        }),
        runTransaction: (ref, updater) => {
            const p = ref.path;
            if (!dev.offline) {
                return new Promise((resolve, reject) => {
                    const t = hostSetTimeout(() => {
                        dev.timers.delete(t);
                        try { resolve(exec(p, updater)); } catch (e) { reject(e); }
                    }, 0);
                    dev.timers.add(t);
                });
            }
            return new Promise((resolve, reject) => {
                dev.queue.push({
                    path: p,
                    run: () => { try { resolve(exec(p, updater)); } catch (e) { reject(e); } },
                    drop: () => reject(new Error('disconnect'))
                });
            });
        }
    };

    const ctx = vm.createContext({
        console, Promise, Math, Date, JSON, Object, Array, String, Number, Boolean, Map, Set, Error, RegExp,
        parseFloat, parseInt, isNaN, isFinite,
        setTimeout: (fn, ms, ...a) => {
            const t = hostSetTimeout(fn, Math.max(0, Math.round((ms || 0) / TIME_SCALE)), ...a);
            dev.timers.add(t);
            return t;
        },
        clearTimeout: (t) => { dev.timers.delete(t); return clearTimeout(t); },
        document: { getElementById: () => null },
        confirm: () => true,
        db: {}, authGeneration: 0, fb: fb,
        dbRefHistory: { path: 'zoew_scan_history_cod_dod' },
        dbRefDeleted: { path: 'zoew_recently_deleted_cod_dod' },
        dbRefDailyPickup: { path: 'zoew_daily_pickup_cod_dod' },
        dbRefDailyCollected: { path: 'zoew_daily_collected_cod_dod' },
        getServerNow: () => T0,
        getFormattedDate: () => SCAN_DATE,
        showToast: (m) => { dev.toasts.push(String(m)); },
        closeModal: () => {},
        openViewListModal: () => {},
        refreshCurrentHistoryView: () => {},
        updateRecentPhonesList: () => {},
        dbListenerViewIsStale: () => false,
        isActiveRestoreClaim: () => false,
        scanHistory: [], deletedItems: [], dailyPickupData: {}, dailyCollectedData: {},
        activeParentItemId: null, isModalOpen: false,
        cleanupInFlight: new Set(), activeRestoreClaims: new Map(),
        window: {}
    });
    ctx.window = ctx;
    new vm.Script([
        sliceConst('DB_OP_TIMEOUT_MS') || 'const DB_OP_TIMEOUT_MS = 15000;',
        sliceConst('PICKUP_LEGACY_KEY_PREFIX') || 'const PICKUP_LEGACY_KEY_PREFIX = "_lg_";',
        sliceConst('PICKUP_LEGACY_PLACEHOLDER_MAX') || 'const PICKUP_LEGACY_PLACEHOLDER_MAX = 20000;',
        sliceConst('PICKUP_PHONE_KEY_MAX') || 'const PICKUP_PHONE_KEY_MAX = 64;',
        sliceConst('TWO_HOURS_MS') || 'const TWO_HOURS_MS = 7200000;',
        sliceConst('APP_TIME_ZONE') || "const APP_TIME_ZONE = 'Asia/Phnom_Penh';",
        sliceConst('APP_TIME_ZONE_OFFSET_MINUTES') || 'const APP_TIME_ZONE_OFFSET_MINUTES = 420;',
        sliceConst('PICKUP_DATE_KEY_PATTERN') || 'const PICKUP_DATE_KEY_PATTERN = /^\\d{4}-\\d{2}-\\d{2}$/;',
        sliceConst('DAILY_COLLECTED_KEEP_DAYS') || 'const DAILY_COLLECTED_KEEP_DAYS = 7;',
        sliceConst('ABANDON_AGE_MS') || 'const ABANDON_AGE_MS = 604800000;',
        ...REAL_FNS.map((n) => fnSrc[n]),
        eitherSrc
    ].join('\n\n')).runInContext(ctx);

    dev.ctx = ctx;
    dev.sync = () => {
        const raw = shared.get('zoew_scan_history_cod_dod') || {};
        ctx.scanHistory.length = 0;
        Object.keys(raw).forEach((k) => ctx.scanHistory.push(clone(raw[k])));
        const trash = shared.get('zoew_recently_deleted_cod_dod') || {};
        ctx.deletedItems.length = 0;
        Object.keys(trash).forEach((k) => ctx.deletedItems.push(clone(trash[k])));
        ctx.dailyPickupData = clone(shared.get('zoew_daily_pickup_cod_dod') || {});
        ctx.dailyCollectedData = clone(shared.get('zoew_daily_collected_cod_dod') || {});
    };
    dev.reconnect = (mode) => {
        const q = dev.queue.slice();
        dev.queue.length = 0;
        dev.offline = false;
        q.forEach((op) => {
            if (mode === 'dropPickup' && isPickup(op.path)) op.drop();
            else op.run();
        });
    };
    dev.dispose = () => { dev.timers.forEach(clearTimeout); dev.timers.clear(); };
    dev.memPickup = () => (ctx.dailyPickupData || {})[SCAN_DATE] || {};
    dev.sync();
    return dev;
}

function bc(code, closed) {
    const b = { code: code, cod: 10, dod: 0, locker: 'N/A', time: 't', isClosed: !!closed, isDeducted: false, isFromDeletion: false, createdAt: T0 };
    if (closed) b.closedAt = T0;
    return b;
}
function parcel(id, barcodes, phone) {
    return {
        id: id, phone: phone || '012345678', scanDate: SCAN_DATE, createdAt: T0, barcodes: barcodes,
        count: barcodes.length, cod: 10 * barcodes.length, dod: 0, price: 10 * barcodes.length,
        barcode: barcodes[0].code, isClosed: barcodes.every((b) => b.isClosed), isCalled: false, time: 't'
    };
}
const packagesOf = (rec) => parseFloat(rec && rec.packagesPickedUp) || 0;
const customersOf = (rec) => Object.keys((rec && rec.pickedUpPhones) || {}).length;
const phoneSum = (rec) => Object.keys((rec && rec.pickedUpPhones) || {})
    .reduce((s, k) => s + (parseFloat(rec.pickedUpPhones[k]) || 0), 0);

(async () => {
    // ── ៣. លំដាប់ដែលអ្នកប្រើវាស់បាន (ក្រៅបណ្តាញ ➜ ឧបករណ៍ផ្សេងបើក ➜ ភ្ជាប់មកវិញ)
    async function offlineReplay(label, opts) {
        console.log('\n=== ' + label + ' ===');
        const shared = makeShared({ zoew_scan_history_cod_dod: { id1: parcel('id1', [bc('AAA111', false)]) } });
        const A = makeDevice(shared, 'A');
        const B = makeDevice(shared, 'B');

        // ១. A បិទ «យក» (បណ្តាញធម្មតា)
        await (opts.whole ? A.ctx.toggleCloseStatus('id1') : A.ctx.toggleIndividualBarcodeClose('id1', 'AAA111'));
        await settle();
        ok('  ជំហាន ១ ៖ A បិទ «យក» ➜ server = 1', packagesOf(shared.pickup()) === 1, shared.pickup());

        // ២. A ក្រៅបណ្តាញ ➜ បើកវិញ (ការសរសេរចូជួរ)
        B.sync();
        A.offline = true;
        const pending = opts.whole ? A.ctx.toggleCloseStatus('id1') : A.ctx.toggleIndividualBarcodeClose('id1', 'AAA111');
        pending.catch(() => {});
        await settle();
        ok('  ជំហាន ២ ៖ ខណៈក្រៅបណ្តាញ server មិនទាន់ប្រែ (=1)', packagesOf(shared.pickup()) === 1, shared.pickup());

        // ៣. B បើកកញ្ចប់នោះមុន ➜ server = 0
        await (opts.whole ? B.ctx.toggleCloseStatus('id1') : B.ctx.toggleIndividualBarcodeClose('id1', 'AAA111'));
        await settle();
        ok('  ជំហាន ៣ ៖ B បើកកញ្ចប់ ➜ server = 0', packagesOf(shared.pickup()) === 0, shared.pickup());

        // ៤. A ភ្ជាប់មកវិញ ➜ transaction រត់ឡើងវិញលើតម្លៃ server ថ្មី
        if (opts.stall) await wait(STALL_WAIT_MS);
        A.reconnect(opts.dropPickup ? 'dropPickup' : null);
        await settle(14);
        await wait(30);
        await settle(14);

        const srv = shared.pickup();
        ok('⛔ ស្នូល ៖ ក្រោយ A ភ្ជាប់មកវិញ **server នៅ 0** (គ្មានកញ្ចប់កើតពីអាកាសធាតុ)',
            packagesOf(srv) === 0, srv);
        ok('⛔ ស្នូល ៖ អេក្រង់របស់ A ក៏បង្ហាញ 0 ដែរ (សតិមិនផ្ទុះ)',
            packagesOf(A.memPickup()) === 0, A.memPickup());
        ok('  អតិថិជនយក = 0 ទាំង server និងសតិរបស់ A',
            customersOf(srv) === 0 && customersOf(A.memPickup()) === 0, { srv: srv, mem: A.memPickup() });
        ok('  អថេរ ៖ sum(pickedUpPhones) === packagesPickedUp', phoneSum(srv) === packagesOf(srv), srv);
        ok('  គ្មានការសរសេរណាដែល rules ពិតបដិសេធ', shared.rejected.length === 0, shared.rejected);

        // ៥. បិទ «យក» ម្តងទៀត ➜ ត្រូវទៅ 1 មិនមែន 2
        A.sync();
        await (opts.whole ? A.ctx.toggleCloseStatus('id1') : A.ctx.toggleIndividualBarcodeClose('id1', 'AAA111'));
        await settle();
        ok('⛔ ជំហាន ៥ ៖ បិទ «យក» ម្តងទៀត ➜ server = **1** (មិនមែន 2)',
            packagesOf(shared.pickup()) === 1, shared.pickup());
        ok('  ជំហាន ៥ ៖ អតិថិជនយក = 1', customersOf(shared.pickup()) === 1, shared.pickup());
        A.dispose(); B.dispose();
    }

    await offlineReplay('៣ក. barcode តែមួយ — ភ្ជាប់មកវិញលឿន', { whole: false });
    await offlineReplay('៣ខ. barcode តែមួយ — ក្រៅបណ្តាញលើសពិដាន dbOp (armLateCommit)', { whole: false, stall: true });
    await offlineReplay('៣គ. barcode តែមួយ — ការសរសេរស្ថិតិបាត់ពេលភ្ជាប់មកវិញ', { whole: false, stall: true, dropPickup: true });
    await offlineReplay('៣ឃ. បិទបញ្ជីទាំងមូល (toggleCloseStatus)', { whole: true, stall: true });

    // ── ៤. ឧបករណ៍ ២ បិទ barcode **ដដែល** ក្នុងពេលតែមួយ ─────────────────
    console.log('\n=== ៤. ឧបករណ៍ ២ បិទ barcode ដដែល ➜ កញ្ចប់ត្រូវរាប់តែ ១ ===');
    {
        const shared = makeShared({ zoew_scan_history_cod_dod: { id2: parcel('id2', [bc('BBB222', false)]) } });
        const A = makeDevice(shared, 'A');
        const B = makeDevice(shared, 'B');
        await A.ctx.toggleIndividualBarcodeClose('id2', 'BBB222');
        await B.ctx.toggleIndividualBarcodeClose('id2', 'BBB222');   // B មើលឃើញវានៅបើក (ទិដ្ឋភាពចាស់)
        await settle(10);
        ok('⛔ barcode តែមួយ ➜ កញ្ចប់យក = 1', packagesOf(shared.pickup()) === 1, shared.pickup());
        ok('⛔ barcode តែមួយ ➜ អតិថិជនយក = 1', customersOf(shared.pickup()) === 1, shared.pickup());
        ok('  អថេរ ៖ sum(pickedUpPhones) === packagesPickedUp', phoneSum(shared.pickup()) === packagesOf(shared.pickup()), shared.pickup());
        A.dispose(); B.dispose();
    }

    // ── ៥. ទិសផ្ទុយ ៖ ការបិទ/បើកធម្មតាត្រូវផ្លាស់លេខពិតប្រាកដ ─────────
    console.log('\n=== ៥. ទិសផ្ទុយ ៖ បិទ/បើកធម្មតាត្រូវដើរពិត (មិនមែនក្លាយជា no-op) ===');
    {
        const shared = makeShared({
            zoew_scan_history_cod_dod: {
                id3: parcel('id3', [bc('C1', false), bc('C2', false)], '011222333'),
                id4: parcel('id4', [bc('D1', false)], '099888777')
            }
        });
        const A = makeDevice(shared, 'A');
        await A.ctx.toggleIndividualBarcodeClose('id3', 'C1');
        await settle();
        ok('បិទ ១ ➜ កញ្ចប់ 1 · អតិថិជន 1', packagesOf(shared.pickup()) === 1 && customersOf(shared.pickup()) === 1, shared.pickup());
        A.sync();
        await A.ctx.toggleIndividualBarcodeClose('id3', 'C2');
        await settle();
        ok('បិទ barcode ទី ២ របស់លេខដដែល ➜ កញ្ចប់ 2 · អតិថិជន **1**',
            packagesOf(shared.pickup()) === 2 && customersOf(shared.pickup()) === 1, shared.pickup());
        A.sync();
        await A.ctx.toggleIndividualBarcodeClose('id4', 'D1');
        await settle();
        ok('បិទកញ្ចប់របស់លេខផ្សេង ➜ កញ្ចប់ 3 · អតិថិជន 2',
            packagesOf(shared.pickup()) === 3 && customersOf(shared.pickup()) === 2, shared.pickup());
        A.sync();
        await A.ctx.toggleIndividualBarcodeClose('id3', 'C1');
        await settle();
        ok('⛔ ទិសផ្ទុយ ៖ បើកវិញ ➜ កញ្ចប់ចុះមក 2 ពិតប្រាកដ',
            packagesOf(shared.pickup()) === 2 && customersOf(shared.pickup()) === 2, shared.pickup());
        ok('អថេរ ៖ sum(pickedUpPhones) === packagesPickedUp', phoneSum(shared.pickup()) === packagesOf(shared.pickup()), shared.pickup());
        ok('គ្មានការសរសេរណាដែល rules ពិតបដិសេធ', shared.rejected.length === 0, shared.rejected);
        A.dispose();
    }

    // ── ៦. Reset ➜ ការបិទបន្ទាប់មិនត្រូវរស់លេខចាស់ឡើងវិញ ───────────────
    console.log('\n=== ៦. ក្រោយ Reset ៖ ការបិទបន្ទាប់ចាប់ពី 0 (មិនរស់លេខចាស់) ===');
    {
        const shared = makeShared({
            zoew_scan_history_cod_dod: {
                id5: parcel('id5', [bc('E1', true), bc('E2', true), bc('E3', true), bc('E4', false)])
            },
            zoew_daily_pickup_cod_dod: { [SCAN_DATE]: { packagesPickedUp: 0 } }
        });
        const A = makeDevice(shared, 'A');
        await A.ctx.toggleIndividualBarcodeClose('id5', 'E4');
        await settle();
        ok('⛔ Reset នៅដដែល ៖ បិទ ១ ក្រោយ Reset ➜ កញ្ចប់ = **1** (មិនមែន 4)',
            packagesOf(shared.pickup()) === 1, shared.pickup());
        ok('  អតិថិជនយក = 1', customersOf(shared.pickup()) === 1, shared.pickup());
        A.dispose();
    }

    // ── ៧. ទិន្នន័យចាស់ (គ្មានសំណុំ barcode) ➜ ការបើកនៅតែដកចេញបាន ──────
    console.log('\n=== ៧. ទិន្នន័យចាស់ ៖ ថ្ងៃដែលរាប់ដោយលេខតែម្យ៉ាង ត្រូវបន្តដើរបាន ===');
    {
        const shared = makeShared({
            zoew_scan_history_cod_dod: {
                id6: parcel('id6', [bc('F1', true), bc('F2', true), bc('F3', false)], '012000111')
            },
            zoew_daily_pickup_cod_dod: { [SCAN_DATE]: { packagesPickedUp: 2, pickedUpPhones: { '012000111': 2 } } }
        });
        const A = makeDevice(shared, 'A');
        await A.ctx.toggleIndividualBarcodeClose('id6', 'F3');
        await settle();
        ok('ថ្ងៃចាស់ ៖ បិទបន្ថែម ១ ➜ កញ្ចប់ 3 · អតិថិជន 1',
            packagesOf(shared.pickup()) === 3 && customersOf(shared.pickup()) === 1, shared.pickup());
        A.sync();
        await A.ctx.toggleIndividualBarcodeClose('id6', 'F1');
        await settle();
        ok('⛔ ថ្ងៃចាស់ ៖ បើក barcode ដែលបិទតាំងពីកំណែចាស់ ➜ កញ្ចប់ចុះមក **2**',
            packagesOf(shared.pickup()) === 2, shared.pickup());
        ok('  អថេរ ៖ sum(pickedUpPhones) === packagesPickedUp', phoneSum(shared.pickup()) === packagesOf(shared.pickup()), shared.pickup());
        ok('  គ្មានការសរសេរណាដែល rules ពិតបដិសេធ', shared.rejected.length === 0, shared.rejected);
        A.dispose();
    }

    // ── ៨. ថ្ងៃចាស់ដែលរាប់ឡើងវិញ **មិនត្រូវគ្នា** ➜ លេខត្រូវរក្សា ────────
    // ផ្លូវពិត ៖ អ្នកប្រើ ✖️ លុបជាអចិន្ត្រៃយ៍ ធាតុ «យករួច» ខ្លះចេញពីធុងសំរាម
    // ➜ ការរាប់ឡើងវិញពីប្រវត្តិ+ធុងសំរាម តូចជាងលេខដែលកត់ទុក។ ក្នុងករណីនោះ
    // ⛔ **ការប្តូរទៅសំណុំមិនត្រូវធ្វើឲ្យលេខអាជីវកម្មបាត់** ។
    console.log('\n=== ៨. ថ្ងៃចាស់ដែលរាប់ឡើងវិញមិនត្រូវ ➜ លេខមិនត្រូវបាត់ ===');
    {
        const shared = makeShared({
            zoew_scan_history_cod_dod: {
                id7: parcel('id7', [bc('G1', true), bc('G2', true), bc('G3', false)], '012777888')
            },
            zoew_daily_pickup_cod_dod: { [SCAN_DATE]: { packagesPickedUp: 3, pickedUpPhones: { '012777888': 3 } } }
        });
        const A = makeDevice(shared, 'A');
        await A.ctx.toggleIndividualBarcodeClose('id7', 'G3');
        await settle(10);
        ok('⛔ លេខចាស់ ៣ ត្រូវរក្សា ➜ បិទបន្ថែម ១ = **4** (មិនមែន 1 ឬ 3)',
            packagesOf(shared.pickup()) === 4, shared.pickup());
        ok('  អតិថិជនយក = 1 (លេខទូរស័ព្ទតែមួយ)', customersOf(shared.pickup()) === 1, shared.pickup());
        ok('  អថេរ ៖ sum(pickedUpPhones) === packagesPickedUp',
            phoneSum(shared.pickup()) === packagesOf(shared.pickup()), shared.pickup());
        ok('  គ្មានការសរសេរណាដែល rules ពិតបដិសេធ', shared.rejected.length === 0, shared.rejected);
        A.dispose();
    }

    // ── ９. ទិដ្ឋភាព barcode ក្នុងស្រុក **ចាស់** ➜ សាលក្រម server ឈ្នះ ────
    // 🔴 រកឃើញដោយ `revenue-fuzz-test` (run=5) ៖ ឧបករណ៍ A មើលឃើញកញ្ចប់មាន
    // barcode ២ ខណៈ B បានដក barcode ទី ២ ចេញរួច។ ការបិទ «យក» ទាំងកញ្ចប់
    // សម្គាល់ទាំង ២ ក្នុងស្រុក ➜ សាលក្រម server មានតែ ១ ➜ ⛔ ការសម្គាល់
    // ដែលលើសត្រូវ **ដកចេញវិញ** មិនមែនទុកចោល។
    console.log('\n=== ៩. ទិដ្ឋភាព barcode ក្នុងស្រុកចាស់ ➜ សាលក្រម server ឈ្នះ ===');
    {
        const shared = makeShared({
            zoew_scan_history_cod_dod: { id8: parcel('id8', [bc('H1', false), bc('H2', false)], '012999000') }
        });
        const A = makeDevice(shared, 'A');
        // B ដក H2 ចេញពី server (ដូច «ឧបករណ៍ផ្សេងដក») — A មិនទាន់ដឹង
        const live = shared.get('zoew_scan_history_cod_dod/id8');
        live.barcodes = live.barcodes.filter((b) => b.code !== 'H2');
        shared.set('zoew_scan_history_cod_dod/id8', live);
        await A.ctx.toggleCloseStatus('id8');
        await settle(12);
        ok('⛔ កញ្ចប់យក = **1** (មិនរាប់ barcode ដែល server លែងមាន)',
            packagesOf(shared.pickup()) === 1, shared.pickup());
        ok('  អតិថិជនយក = 1', customersOf(shared.pickup()) === 1, shared.pickup());
        ok('  អថេរ ៖ sum(pickedUpPhones) === packagesPickedUp',
            phoneSum(shared.pickup()) === packagesOf(shared.pickup()), shared.pickup());
        ok('  សតិរបស់ A ក៏ត្រូវតាមសាលក្រម server ដែរ',
            packagesOf(A.memPickup()) === 1, A.memPickup());
        A.dispose();
    }

    console.log('\n' + (fail === 0 ? '✅ ជោគជ័យ ' : '❌ ធ្លាក់ ') + fail + ' — ' + pass + ' ok, ' + fail + ' FAIL');
    process.exit(fail === 0 ? 0 : 1);
})().catch((e) => {
    console.log('  FAIL   checker បោះកំហុស ➜ ' + (e && e.stack ? e.stack : e));
    console.log('\n❌ ធ្លាក់');
    process.exit(1);
});
