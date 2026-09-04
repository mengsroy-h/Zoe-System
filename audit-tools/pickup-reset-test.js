// ⛔ ថ្នាក់កំហុស៖ **ប៊ូតុង «Reset ចំនួនយករួច» ត្រូវ reset តែតម្រងដែលឈរលើ
// ហើយត្រូវទុក node ចោលឲ្យ *មាន* ជាមួយ `packagesPickedUp: 0`។**
//
// អន្ទាក់សំខាន់បំផុតនៃមុខងារនេះ (រកឃើញពេលអានផ្លូវបង្ហាញ)៖
// `updateDailyScheduleStats()` អានលេខយករួចពី `dailyPickupData[targetDateKey]`
// **តែពេល node នោះមាន** ។ បើគ្មាន វា **ធ្លាក់ទៅរាប់ពីប្រវត្តិវិញ**៖
//
//     } else {
//         selectedClosedCount = new Set(filteredList.filter(i => i.isClosed)…).size;
//
// ដូច្នេះ Reset ដែលសរសេរ `null` (លុប node ចោល) ➜ លេខ **លោតត្រឡប់មកវិញ
// ភ្លាមៗ** ព្រោះ barcode នៅតែបិទក្នុងប្រវត្តិ។ ការ Reset ត្រូវសរសេរ
// `{ packagesPickedUp: 0 }` ដែលជា node **មាន** តម្លៃ 0 — មិនមែន `null` ទេ។
//
// ច្បាប់ដែលឯកសារនេះចាក់សោ៖
//   ១. **មូលដ្ឋានតែមួយ** — ការបង្ហាញ និងការ Reset ត្រូវប្រើ
//      `getFilterTargetDateKey()` ដដែល។ ការគណនាថ្ងៃឡើងវិញដោយឡែក = ការឃ្លាត
//      (មេរៀនដដែលនឹង 2.19.4៖ អតិថិជន ↔ កញ្ចប់ រាប់លើមូលដ្ឋានពីរ)។
//   ២. **វិសាលភាព** — «ម្សិលមិញ» ត្រូវប៉ះតែថ្ងៃម្សិលមិញ។
//   ៣. ⛔ **លុយមិនត្រូវប៉ះ** — `isDeducted` នៅតែជាវាលតែមួយដែលកំណត់លុយ;
//      Reset ជាការកែ *ស្ថិតិយក* មិនមែនចំណូលទេ ➜ គ្មានការសរសេរទៅ
//      `zoew_daily_revenue_cod_dod` / `zoew_monthly_revenue_cod_dod`។
//   ៤. **អថេរ** `sum(pickedUpPhones) === packagesPickedUp` ត្រូវនៅតែកាន់។
//   ៥. **PIN** — ផ្លូវតែមួយទៅ `resetPickupStats` គឺឆ្លងកាត់ PIN gate។
//   ៦. **ការបរាជ័យមិនត្រូវអះអាងជោគជ័យ** (ច្បាប់ toast និយាយការពិត)។
//   ៧. `planPickupLedgerRepair()` **មិនត្រូវដកការ Reset វិញ**។
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = process.env.PICKUPRESET_APP_DIR || path.join(__dirname, '..');
const APP = path.join(ROOT, 'ZoeW');

let pass = 0, fail = 0;
function ok(label, cond, detail) {
    if (cond) { pass++; console.log('   ok    ' + label); }
    else { fail++; console.log('  FAIL   ' + label + (detail !== undefined ? '\n         ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : '')); }
}

let SRC = '', HTML = '';
try {
    SRC = fs.readFileSync(path.join(APP, 'app.js'), 'utf8');
} catch (e) {
    console.log('  FAIL   អាន ZoeW/app.js មិនបាន ➜ ' + e.message);
    console.log('\n❌ ធ្លាក់ — កូដដែលតេស្តនេះការពារ បាត់ពី tree ដែលកំពុងពិនិត្យ');
    process.exit(1);
}
try { HTML = fs.readFileSync(path.join(APP, 'index.html'), 'utf8'); } catch (e) { HTML = ''; }

function sliceFn(name) {
    const at = SRC.search(new RegExp('(?:async\\s+)?function\\s+' + name + '\\s*\\('));
    if (at === -1) return null;
    let depth = 0, start = SRC.indexOf('{', SRC.indexOf(')', at));
    for (let k = start; k < SRC.length; k++) {
        if (SRC[k] === '{') depth++;
        else if (SRC[k] === '}') { depth--; if (!depth) return SRC.slice(at, k + 1); }
    }
    return null;
}

// ── ០. ជាន់អប្បបរមា — checker នេះត្រូវពិតជាបានឃើញកូដ ─────────────────
console.log('\n=== ០. ជាន់អប្បបរមា (checker នេះត្រូវអាចធ្លាក់បាន) ===');
ok('ZoeW/app.js មិនទទេ (>= 4000 បន្ទាត់)', SRC.split('\n').length >= 4000, SRC.split('\n').length);
ok('index.html មិនទទេ (>= 400 បន្ទាត់)', HTML.split('\n').length >= 400, HTML.split('\n').length);

const REQUIRED_FNS = [
    'getFilterTargetDateKey', 'getPickupResetTargetDates', 'getCurrentFilterLabel',
    'countPickedUpCustomers', 'resetPickupStats', 'requestPinBeforeResetPickup',
    'moreMenuResetPickup', 'planPickupLedgerRepair', 'collectPickupMarks',
    'pickupBarcodeKey', 'barcodeRegistryKey', 'pickupSetSize', 'ledgerNumber',
    'getPickupPhoneKey', 'updateDailyScheduleStats'
];
function sliceConstDecl(name) {
    const m = new RegExp('\\n\\s*const ' + name + ' = ([^;]+);').exec(SRC);
    if (!m) throw new Error('const not found: ' + name);
    return 'const ' + name + ' = ' + m[1] + ';';
}

const fnSrc = {};
const missingFns = [];
for (const n of REQUIRED_FNS) {
    fnSrc[n] = sliceFn(n);
    if (!fnSrc[n]) missingFns.push(n);
}
ok('រកឃើញ function ទាំង ' + REQUIRED_FNS.length + ' ដែលមុខងារនេះពឹងលើ',
    missingFns.length === 0, missingFns);
// ⛔ កុំ process.exit() ត្រង់នេះ — stub ជំនួស ដើម្បីឲ្យការអះអាងឥរិយាបថ
// ខាងក្រោមនៅតែរត់ ហើយប្រាប់ថា *អ្វី* ខូច (មេរៀន checker-coverage ចំណុច ៣)។
for (const n of missingFns) {
    fnSrc[n] = (n === 'resetPickupStats' ? 'async ' : '') + 'function ' + n + '() { return undefined; }';
}

// ── ១. មូលដ្ឋានតែមួយ ────────────────────────────────────────────────
console.log('\n=== ១. ការបង្ហាញ និងការ Reset ដើរលើមូលដ្ឋានថ្ងៃ *តែមួយ* ===');
const statsSrc = fnSrc['updateDailyScheduleStats'];
ok('updateDailyScheduleStats() យកថ្ងៃពី getFilterTargetDateKey()',
    /getFilterTargetDateKey\s*\(/.test(statsSrc));
ok('updateDailyScheduleStats() មិនគណនាថ្ងៃឡើងវិញដោយឡែក (គ្មាន setDate)',
    !/setDate\s*\(/.test(statsSrc),
    'ការគណនាថ្ងៃស្ទួន = ការឃ្លាតរវាងលេខដែលឃើញ និងលេខដែល Reset');
ok('getPickupResetTargetDates() ក៏យកពី getFilterTargetDateKey() ដដែល',
    /getFilterTargetDateKey\s*\(/.test(fnSrc['getPickupResetTargetDates']));

// ── ២. PIN gate ─────────────────────────────────────────────────────
console.log('\n=== ២. ផ្លូវតែមួយទៅ Reset គឺឆ្លងកាត់ PIN ===');
ok('requestPinBeforeResetPickup() ហៅ requestPinBeforeConfig ជាមួយ resetPickupStats',
    /requestPinBeforeConfig\s*\(\s*resetPickupStats\s*,\s*'resetPickup'\s*\)/.test(fnSrc['requestPinBeforeResetPickup']),
    fnSrc['requestPinBeforeResetPickup']);
ok('moreMenuResetPickup() ហៅតាមផ្លូវ PIN មិនហៅ resetPickupStats ផ្ទាល់',
    /requestPinBeforeResetPickup\s*\(/.test(fnSrc['moreMenuResetPickup'])
    && !/[^a-zA-Z]resetPickupStats\s*\(/.test(fnSrc['moreMenuResetPickup']),
    fnSrc['moreMenuResetPickup']);
ok("PIN_PROMPT_MESSAGES មានធាតុ 'resetPickup'", /resetPickup\s*:\s*\{/.test(SRC));
// ⛔ រាប់តែ *កន្លែងហៅ* — មិនរាប់ការប្រកាស `async function resetPickupStats()`
const directCalls = (SRC.match(/(?<!function\s)(?<![a-zA-Z_.])resetPickupStats\s*\(/g) || []).length;
ok('គ្មានកន្លែងហៅ resetPickupStats() ដោយផ្ទាល់ (រំលង PIN)', directCalls === 0, directCalls);

// ── ៣. ការតភ្ជាប់ម៉ឺនុយ ──────────────────────────────────────────────
console.log('\n=== ៣. ប៊ូតុងក្នុងម៉ឺនុយ (...) នៅខាងលើ «លុបទាំងអស់» ===');
const menuAt = SRC.indexOf('data-act="moreMenuResetPickup"');
const clearAt = SRC.indexOf('data-act="moreMenuClearHistory"');
ok('ម៉ឺនុយមានប៊ូតុង data-act="moreMenuResetPickup"', menuAt !== -1);
ok('ប៊ូតុង Reset នៅ *ខាងលើ* ប៊ូតុងលុបទាំងអស់',
    menuAt !== -1 && clearAt !== -1 && menuAt < clearAt, [menuAt, clearAt]);
ok('"moreMenuResetPickup" មានក្នុង ACTION_ALLOWLIST',
    /"moreMenuResetPickup"/.test(SRC));
ok('ស្លាកប៊ូតុងបង្ហាញតម្រងដែលឈរលើ (អ្នកប្រើដឹងថា Reset អ្វី)',
    /moreMenuResetPickup"[^<]*>[^<]*\$\{sanitizeInput\(getCurrentFilterLabel\(\)\)\}/.test(SRC));

// ── ៤. ឥរិយាបថពិត — រត់ resetPickupStats() ក្នុង vm ──────────────────
console.log('\n=== ៤. ឥរិយាបថពិត (កូដពិតក្នុង vm) ===');

const NOW = Date.UTC(2026, 7, 27, 6, 0, 0);
const patternDecl = (SRC.match(/const\s+PICKUP_DATE_KEY_PATTERN\s*=\s*\/.*?\/\s*;/) || [])[0];
ok('PICKUP_DATE_KEY_PATTERN ត្រូវបានប្រកាសក្នុងកូដពិត', !!patternDecl, patternDecl);

function makeCtx(opts) {
    const writes = [];
    const toasts = [];
    const sandbox = {
        console,
        window: {},
        // ⛔ `withTimeout()` ពិត ត្រូវការនាឡិកា host — vm context ទទេគ្មានវាទេ
        setTimeout,
        clearTimeout,
        confirm: () => (opts.confirmResult !== false),
        showToast: (m) => toasts.push(m),
        refreshCurrentHistoryView: () => { sandbox.__refreshed = (sandbox.__refreshed || 0) + 1; },
        getServerNow: () => NOW,
        db: opts.db === undefined ? {} : opts.db,
        dbRefDailyPickup: opts.dbRefDailyPickup === undefined ? {} : opts.dbRefDailyPickup,
        fb: opts.fb === undefined ? {
            ref: (_db, p) => ({ path: p }),
            runTransaction: (ref, fn) => {
                const value = fn(null);
                writes.push({ path: ref.path, value });
                if (opts.failDates && opts.failDates.indexOf(ref.path.split('/').pop()) !== -1) {
                    return Promise.reject(new Error('permission_denied'));
                }
                return Promise.resolve({ committed: true });
            }
        } : opts.fb,
        __writes: writes,
        __toasts: toasts
    };
    const ctx = vm.createContext(sandbox);
    vm.runInContext(patternDecl || 'const PICKUP_DATE_KEY_PATTERN = /^\\d{4}-\\d{2}-\\d{2}$/;', ctx);
    vm.runInContext('let pickupResetInFlight = false;', ctx);
    vm.runInContext('let currentFilterMode = ' + JSON.stringify(opts.mode || 'today') + ';', ctx);
    vm.runInContext('let customFilterDate = ' + JSON.stringify(opts.customDate || '') + ';', ctx);
    vm.runInContext('let dailyPickupData = ' + JSON.stringify(opts.ledger || {}) + ';', ctx);
    // ⛔ `getFilterTargetDateKey()` គណនាថ្ងៃតាមប្រតិទិនកម្ពុជា ➜ sandbox
    // ត្រូវផ្ទុក helper តំបន់ម៉ោងពិត បើមិនដូច្នេះវាធ្លាក់ដោយ ReferenceError
    // ដែលបិទបាំងការអះអាងឥរិយាបថទាំងអស់ (មេរៀន checker-coverage ចំណុច ៣)។
    // ⛔ ពិដានការហៅ Firebase (db-stall-guard) ➜ ត្រូវផ្ទុក function ពិត
    vm.runInContext(sliceConstDecl('DB_OP_TIMEOUT_MS'), ctx);
    vm.runInContext(sliceFn('withTimeout'), ctx);
    vm.runInContext(sliceFn('dbOp'), ctx);
    vm.runInContext(sliceFn('dbOpStalled'), ctx);
    vm.runInContext(sliceConstDecl('APP_TIME_ZONE'), ctx);
    vm.runInContext(sliceConstDecl('APP_TIME_ZONE_OFFSET_MINUTES'), ctx);
    vm.runInContext(sliceFn('appZoneParts'), ctx);
    vm.runInContext(sliceFn('getZoneDateKey'), ctx);
    vm.runInContext(sliceFn('getFormattedDate'), ctx);
    ['getFilterTargetDateKey', 'getPickupResetTargetDates', 'getCurrentFilterLabel',
     'countPickedUpCustomers', 'resetPickupStats'].forEach((n) => vm.runInContext(fnSrc[n], ctx));
    return { ctx, sandbox };
}

const LEDGER = {
    '2026-08-27': { packagesPickedUp: 3, pickedUpPhones: { '011111111': 2, '022222222': 1 } },
    '2026-08-26': { packagesPickedUp: 5, pickedUpPhones: { '033333333': 5 } },
    '2026-08-25': { packagesPickedUp: 2, pickedUpPhones: { '044444444': 2 } }
};

async function runReset(opts) {
    const { ctx, sandbox } = makeCtx(opts);
    await vm.runInContext('resetPickupStats()', ctx);
    return {
        writes: sandbox.__writes,
        toasts: sandbox.__toasts,
        ledger: vm.runInContext('dailyPickupData', ctx),
        inFlight: vm.runInContext('pickupResetInFlight', ctx),
        refreshed: sandbox.__refreshed || 0
    };
}

(async () => {
    // ៤.១ «ម្សិលមិញ» ➜ ប៉ះតែម្សិលមិញ
    {
        const r = await runReset({ mode: 'yesterday', ledger: JSON.parse(JSON.stringify(LEDGER)) });
        ok('«ម្សិលមិញ» ➜ សរសេរតែ ១ ថ្ងៃ', r.writes.length === 1, r.writes);
        ok('«ម្សិលមិញ» ➜ ថ្ងៃត្រូវជា 2026-08-26',
            r.writes[0] && r.writes[0].path === 'zoew_daily_pickup_cod_dod/2026-08-26', r.writes);
        ok('«ម្សិលមិញ» ➜ ថ្ងៃនេះ និងម្សិលម្ងៃ **មិនប៉ះ**',
            r.ledger['2026-08-27'].packagesPickedUp === 3 && r.ledger['2026-08-25'].packagesPickedUp === 2,
            r.ledger);
        // ⛔ ចំណុចសំខាន់បំផុត — node ត្រូវ *មាន* ជាមួយ 0 មិនមែន null
        const v = r.writes[0] && r.writes[0].value;
        ok('⛔ តម្លៃដែលសរសេរជា object ដែល *មាន* មិនមែន null/undefined',
            !!v && typeof v === 'object', v);
        ok('⛔ packagesPickedUp === 0 (លេខ មិនមែន null)',
            v && v.packagesPickedUp === 0, v);
        ok('⛔ pickedUpPhones ត្រូវទទេ/គ្មាន ➜ ចំនួនអតិថិជន = 0',
            v && !(v.pickedUpPhones && Object.keys(v.pickedUpPhones).length), v);
        ok('អថេរ sum(pickedUpPhones) === packagesPickedUp នៅតែកាន់',
            v && Object.values(v.pickedUpPhones || {}).reduce((a, b) => a + b, 0) === v.packagesPickedUp, v);
        ok('ledger ក្នុងសតិត្រូវ update ភ្លាម (node មាន, 0)',
            r.ledger['2026-08-26'] && r.ledger['2026-08-26'].packagesPickedUp === 0,
            r.ledger['2026-08-26']);
        ok('ការបង្ហាញត្រូវ refresh ក្រោយ Reset', r.refreshed >= 1, r.refreshed);
        ok('toast ជោគជ័យចេញ (ចាប់ផ្តើមដោយ ✅)',
            r.toasts.length && r.toasts[r.toasts.length - 1].startsWith('✅'), r.toasts);
        ok('សោ in-flight ត្រូវដោះវិញ', r.inFlight === false);
    }

    // ៤.២ ⛔ គ្មានការសរសេរទៅផ្លូវលុយ
    {
        const r = await runReset({ mode: 'today', ledger: JSON.parse(JSON.stringify(LEDGER)) });
        const moneyPaths = r.writes.filter((w) => /revenue/i.test(w.path));
        ok('⛔ Reset មិនសរសេរទៅ zoew_daily/monthly_revenue សោះ', moneyPaths.length === 0, moneyPaths);
        ok('រាល់ការសរសេរស្ថិតក្រោម zoew_daily_pickup_cod_dod/ តែប៉ុណ្ណោះ',
            r.writes.every((w) => w.path.indexOf('zoew_daily_pickup_cod_dod/') === 0), r.writes);
    }
    ok('⛔ តួ resetPickupStats() មិនហៅ addRevenueToDailyAndMonthlyRecord',
        !/addRevenueToDailyAndMonthlyRecord/.test(fnSrc['resetPickupStats']));
    ok('⛔ តួ resetPickupStats() មិនប៉ះ isDeducted', !/isDeducted/.test(fnSrc['resetPickupStats']));

    // ៤.៣ ថ្ងៃផ្សេង (custom)
    {
        const r = await runReset({ mode: 'custom', customDate: '2026-08-25', ledger: JSON.parse(JSON.stringify(LEDGER)) });
        ok('«ថ្ងៃផ្សេង» ➜ សរសេរតែថ្ងៃដែលជ្រើស',
            r.writes.length === 1 && r.writes[0].path.endsWith('/2026-08-25'), r.writes);
    }

    // ៤.៤ «ទាំងអស់» ➜ គ្រប់ថ្ងៃ
    {
        const r = await runReset({ mode: 'all', ledger: JSON.parse(JSON.stringify(LEDGER)) });
        ok('«ទាំងអស់» ➜ សរសេរគ្រប់ថ្ងៃក្នុង ledger', r.writes.length === 3, r.writes.map((w) => w.path));
        ok('«ទាំងអស់» ➜ គ្រប់ថ្ងៃក្លាយជា 0',
            Object.keys(r.ledger).every((d) => r.ledger[d].packagesPickedUp === 0), r.ledger);
    }

    // ៤.៥ កូនសោមិនមែនកាលបរិច្ឆេទ ត្រូវរំលង (កុំសរសេរទៅផ្លូវចម្លែក)
    {
        const dirty = Object.assign({ 'not-a-date': { packagesPickedUp: 9 } }, JSON.parse(JSON.stringify(LEDGER)));
        const r = await runReset({ mode: 'all', ledger: dirty });
        ok('កូនសោដែលមិនមែនជា YYYY-MM-DD ត្រូវរំលង',
            r.writes.every((w) => /\/\d{4}-\d{2}-\d{2}$/.test(w.path)), r.writes.map((w) => w.path));
    }

    // ៤.៦ បោះបង់ confirm ➜ គ្មានការសរសេរ
    {
        const r = await runReset({ mode: 'today', confirmResult: false, ledger: JSON.parse(JSON.stringify(LEDGER)) });
        ok('បោះបង់ប្រអប់បញ្ជាក់ ➜ គ្មានការសរសេរសោះ', r.writes.length === 0, r.writes);
        ok('បោះបង់ ➜ ledger មិនប្រែ', r.ledger['2026-08-27'].packagesPickedUp === 3, r.ledger);
    }

    // ៤.៧ លេខ 0 រួចហើយ ➜ មិនសរសេរ ហើយប្រាប់ការពិត
    {
        const r = await runReset({ mode: 'today', ledger: { '2026-08-27': { packagesPickedUp: 0, pickedUpPhones: {} } } });
        ok('ថ្ងៃដែល 0 រួចហើយ ➜ គ្មានការសរសេរឥតប្រយោជន៍', r.writes.length === 0, r.writes);
        ok('ថ្ងៃដែល 0 រួចហើយ ➜ toast ព្រមាន មិនមែនជោគជ័យ',
            r.toasts.length === 1 && r.toasts[0].startsWith('⚠️'), r.toasts);
    }

    // ៤.៨ ⛔ ការបរាជ័យមិនត្រូវអះអាងជោគជ័យ
    {
        const r = await runReset({ mode: 'today', failDates: ['2026-08-27'], ledger: JSON.parse(JSON.stringify(LEDGER)) });
        ok('⛔ transaction បរាជ័យ ➜ គ្មាន toast ជោគជ័យ',
            !r.toasts.some((t) => t.startsWith('✅')), r.toasts);
        ok('transaction បរាជ័យ ➜ toast កំហុស (❌)',
            r.toasts.some((t) => t.startsWith('❌')), r.toasts);
        ok('transaction បរាជ័យ ➜ ledger ក្នុងសតិមិនកុហកថា 0',
            r.ledger['2026-08-27'].packagesPickedUp === 3, r.ledger['2026-08-27']);
        ok('transaction បរាជ័យ ➜ សោ in-flight នៅតែដោះវិញ', r.inFlight === false);
    }
    {
        const r = await runReset({ mode: 'all', failDates: ['2026-08-26'], ledger: JSON.parse(JSON.stringify(LEDGER)) });
        ok('បរាជ័យខ្លះ ➜ ថ្ងៃដែលជោគជ័យនៅតែចេញ (មិនបោះបង់ក្រុមទាំងមូល)',
            r.ledger['2026-08-27'].packagesPickedUp === 0 && r.ledger['2026-08-25'].packagesPickedUp === 0,
            r.ledger);
        ok('បរាជ័យខ្លះ ➜ ថ្ងៃដែលបរាជ័យមិនត្រូវសម្អាតក្នុងសតិ',
            r.ledger['2026-08-26'].packagesPickedUp === 5, r.ledger['2026-08-26']);
        ok('បរាជ័យខ្លះ ➜ toast ព្រមាន មិនមែនជោគជ័យពេញ',
            r.toasts.some((t) => t.startsWith('⚠️')) && !r.toasts.some((t) => t.startsWith('✅')), r.toasts);
    }

    // ៤.៩ គ្មានការតភ្ជាប់ ➜ មិនកុហក
    {
        const r = await runReset({ mode: 'today', db: null, dbRefDailyPickup: null, ledger: JSON.parse(JSON.stringify(LEDGER)) });
        ok('គ្មានការតភ្ជាប់ Firebase ➜ គ្មាន toast ជោគជ័យ',
            !r.toasts.some((t) => t.startsWith('✅')), r.toasts);
        ok('គ្មានការតភ្ជាប់ ➜ ledger មិនប្រែ', r.ledger['2026-08-27'].packagesPickedUp === 3);
    }

    // ── ៥. ការជួសជុល ledger មិនត្រូវដកការ Reset វិញ ──────────────────
    console.log('\n=== ៥. planPickupLedgerRepair() មិនត្រូវដកការ Reset វិញ ===');
    {
        const ctx = vm.createContext({ console, Object, Math, String, parseFloat, isNaN, Array });
        vm.runInContext((/const PICKUP_PHONE_KEY_MAX = [0-9]+;/.exec(SRC) || ['const PICKUP_PHONE_KEY_MAX = 64;'])[0], ctx);
        ['ledgerNumber', 'barcodeRegistryKey', 'pickupBarcodeKey', 'pickupSetSize',
            'getPickupPhoneKey', 'collectPickupMarks', 'planPickupLedgerRepair']
            .forEach((n) => vm.runInContext(fnSrc[n], ctx));
        const history = [
            { id: 'a', phone: '011111111', scanDate: '2026-08-26', barcodes: [{ code: 'RA1', isClosed: true }, { code: 'RA2', isClosed: true }] },
            { id: 'b', phone: '022222222', scanDate: '2026-08-26', barcodes: [{ code: 'RB1', isClosed: true }] }
        ];
        const resetLedger = { '2026-08-26': { packagesPickedUp: 0 } };
        const plans = vm.runInContext('planPickupLedgerRepair', ctx)(resetLedger, history, []);
        ok('ledger ដែល Reset រួច ➜ គ្មានផែនការជួសជុលដែលនាំលេខត្រឡប់មកវិញ',
            plans.length === 0, plans);

        const emptyDay = { '2026-08-26': { packagesPickedUp: 0 } };
        const plans2 = vm.runInContext('planPickupLedgerRepair', ctx)(emptyDay, [], []);
        ok('ថ្ងៃដែល 0 ហើយគ្មានប្រវត្តិបិទ ➜ ក៏គ្មានផែនការដែរ', plans2.length === 0, plans2);
    }

    console.log('\n===================================');
    console.log(`ok ${pass}  ·  FAIL ${fail}`);
    if (fail) {
        console.log('❌ ធ្លាក់ ' + fail + ' — ប៊ូតុង Reset ចំនួនយករួច ខុសពីច្បាប់');
        process.exit(1);
    }
    console.log('✅ ជោគជ័យ (' + pass + ')');
})();
