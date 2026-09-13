// ⛔ ថ្នាក់កំហុស ៖ **«ចំណូលប្រចាំថ្ងៃ» (តាមថ្ងៃយក) — អ័ក្សលុយ *ទី ២*។**
//
// សំណើអ្នកប្រើ (2026-09-12) ៖ «ចំណូលសរុបទឹកប្រាក់កញ្ចប់យករួច មិនថាកញ្ចប់ថ្មី
// ឬចាស់ អោយតែបិទបញ្ជីយកក្នុងថ្ងៃណា ត្រូវកត់ត្រាប្រាក់នោះក្នុងថ្ងៃនោះ»។
//
// ⛔ **វាខុសពីលេខដែលមានស្រាប់ទាំងអស់** ៖ `zoew_daily_revenue_cod_dod` និង
// `zoew_daily_pickup_cod_dod` សុទ្ធតែកូនសោតាម **ថ្ងៃស្កេនចូល** (`item.scanDate`)
// ➜ កញ្ចប់ស្កេនថ្ងៃចន្ទ យកថ្ងៃពុធ លុយចុះលើ **ថ្ងៃចន្ទ**។ node ថ្មីនេះកូនសោ
// តាម **ថ្ងៃបិទ «យក»** ➜ វាឆ្លើយថា «ថ្ងៃនេះខ្ញុំទទួលលុយប៉ុន្មាន»។
//
// ច្បាប់ដែលឯកសារនេះចាក់សោ ៖
//
// ១. ⛔ **អត្តសញ្ញាណ មិនមែនចំនួន** (មេរៀន 2.27.0) — កំណត់ត្រាជា **សំណុំ**
//    `<barcodeKey> ➜ {c,d}` ➜ ការបិទ ២ ដងលើ barcode ដដែល **មិនអាចបង្កើតលុយ**។
//    ⛔ គ្មាននព្វន្ធ delta នៅកន្លែងណាទាំងអស់។
//
// ២. ⛔ **ការបើកវិញត្រូវដកចេញពី *ថ្ងៃដើម*** មិនមែនថ្ងៃនេះ — បើដកខុសថ្ងៃ
//    លុយនៅជាប់លើថ្ងៃចាស់ជារៀងរហូត ហើយថ្ងៃនេះក្លាយជាអវិជ្ជមានតាមការមើលឃើញ។
//
// ៣. ⛔ **ការបិទឡើងវិញនៅថ្ងៃក្រោយត្រូវ *ផ្លាស់* មិនមែន *ចម្លង*** — `toggleCloseStatus`
//    re-stamp `closedAt` គ្រប់ barcode ➜ បើមិនដកចេញពីថ្ងៃចាស់ លុយរាប់ ២ ថ្ងៃ។
//
// ៤. ⛔ **វា *មិនមែន* លុយ** — វាជា **កញ្ចក់** នៃការបិទ ៖ គ្មានការប៉ះ
//    `isDeducted` · ledger ថ្ងៃ/ខែ · `packagesPickedUp` ណាមួយឡើយ។
//
// ៥. ⛔ **ការសម្អាត ៧ ថ្ងៃជាការលុបដែលបំផ្លាញ** ➜ ត្រូវការនាឡិកា server ពិត
//    (`cleanupClockIsTrustworthy()`) និងទិដ្ឋភាពស្រស់ — ដូចការសម្អាតដទៃ។
//
// ៦. ⛔ **ស្នាមភ្ជាប់ឈ្មោះ node រវាង `app.js` និង rules ពិត** — ការសរសេរទៅ
//    path ដែល rules មិនស្គាល់ ➜ `permission_denied` ស្ងាត់ៗលើផលិតកម្ម។
'use strict';
process.exitCode = 1;

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = process.env.COLLECTED_APP_DIR
    ? path.resolve(process.env.COLLECTED_APP_DIR)
    : path.resolve(__dirname, '..');
const APP_JS = path.join(ROOT, 'ZoeW', 'app.js');
const INDEX_HTML = path.join(ROOT, 'ZoeW', 'index.html');
const RULES_JSON = path.join(ROOT, 'firebase-database.rules.json');

let pass = 0, fail = 0;
function ok(label, cond, detail) {
    if (cond) { console.log('   ok    ' + label); pass++; }
    else { console.log('  FAIL   ' + label + (detail !== undefined ? '  got: ' + JSON.stringify(detail).slice(0, 300) : '')); fail++; }
}
function scenario(name, fn) {
    console.log('\n== ' + name + ' ==');
    try { fn(); } catch (e) { ok(name + ' រត់ដល់ចប់', false, (e && e.stack) || String(e)); }
}
function readOr(file) { try { return fs.readFileSync(file, 'utf8'); } catch (_) { return ''; } }

const SRC = readOr(APP_JS);
const HTML = readOr(INDEX_HTML);
const RULES = readOr(RULES_JSON);

ok('ជាន់អប្បបរមា ៖ អាន app.js បាន', SRC.length > 200000, SRC.length);
ok('ជាន់អប្បបរមា ៖ អាន index.html បាន', HTML.length > 20000, HTML.length);
ok('ជាន់អប្បបរមា ៖ អាន rules បាន', RULES.length > 2000, RULES.length);

function sliceFn(src, name) {
    let start = src.indexOf('function ' + name + '(');
    if (start === -1) return null;
    if (src.slice(Math.max(0, start - 6), start) === 'async ') start -= 6;
    let depth = 0, started = false, i = src.indexOf('{', start);
    for (; i < src.length; i++) {
        if (src[i] === '{') { depth++; started = true; }
        else if (src[i] === '}') { depth--; if (started && depth === 0) { i++; break; } }
    }
    return src.slice(start, i);
}
function readConst(name, fallback) {
    const m = new RegExp('\\n\\s*const ' + name + ' = ([^;]+);').exec(SRC);
    if (!m) return fallback;
    try { return vm.runInNewContext('(' + m[1] + ')'); } catch (_) { return fallback; }
}

// ⛔ ឈ្មោះដែលរកមិនឃើញ ➜ **stub** មិនមែនការឈប់ (ច្បាប់វិន័យឧបករណ៍)។
const WANT = ['collectedSetFromRecord', 'collectedMarkValueOf', 'collectedDayOfStamp',
    'collectedDayHoldingKey', 'collectedMarksFor',
    'commitCollectedMarks', 'markCollectedRevenue', 'syncCollectedValueForBarcode', 'reconcileCollectedHistory',
    'collectedTotalsOfDay', 'collectedRetentionCutoffKey', 'staleCollectedDays',
    'runAutomaticCollectedCleanup', 'openCollectedStatsModal', 'buildCollectedCardItem',
    'statsMoney', 'statsPositive', 'ledgerNumber', 'pickupBarcodeKey', 'barcodeRegistryKey', 'getZoneDateKey',
    'appZoneParts', 'appZoneWallClockToMillis', 'sanitizeInput', 'emptyViewMessage',
    'dbListenerViewIsStale', 'anyDbListenerViewIsStale'];
const missing = WANT.filter((n) => !sliceFn(SRC, n));
const bodies = WANT.map((n) => sliceFn(SRC, n) || ('function ' + n + '() { return undefined; }')).concat(
    ['reconcileCollectedPriceState'].map(n => sliceFn(SRC, n) || '')).join('\n');
ok('⛔ ស្រង់ function ចាំបាច់ទាំងអស់ចេញពី `app.js` ពិត', missing.length === 0, missing);

const NODE = 'zoew_daily_collected_cod_dod';

function makeSandbox(state) {
    const opts = state || {};
    const calls = { tx: [], update: [], toast: [], dbOp: [] };
    const server = JSON.parse(JSON.stringify(opts.server || {}));
    const box = {
        console: console,
        dailyCollectedData: JSON.parse(JSON.stringify(opts.local || {})),
        scanHistory: opts.scanHistory || [],
        exchangeRateRiel: 4100,
        DAILY_COLLECTED_KEEP_DAYS: readConst('DAILY_COLLECTED_KEEP_DAYS', 7),
        DAILY_COLLECTED_DAY_PATTERN: /^\d{4}-\d{2}-\d{2}$/,
        DB_LISTENER_KEY_DAILY_COLLECTED: readConst('DB_LISTENER_KEY_DAILY_COLLECTED', 'dailyCollected'),
        APP_TIME_ZONE: readConst('APP_TIME_ZONE', 'Asia/Phnom_Penh'),
        APP_TIME_ZONE_OFFSET_MINUTES: readConst('APP_TIME_ZONE_OFFSET_MINUTES', 420),
        VIEW_NOT_MEASURABLE_TEXT: 'ទិន្នន័យមិនទាន់មកដល់គ្រប់ ➜ វាស់មិនបាន',
        VIEW_NOT_MEASURABLE_NOTICE: '⏳ ទិន្នន័យមិនទាន់មកដល់គ្រប់ ➜ វាស់មិនបាន',
        STATS_COLLECTED_VIEW_KEYS: [readConst('DB_LISTENER_KEY_DAILY_COLLECTED', 'dailyCollected')],
        dbListenerPendingPaths: new Set(opts.pending || []),
        dbListenerFailedPaths: new Set(opts.failed || []),
        db: {}, authGeneration: 0, dbRefDailyCollected: { __ref: NODE },
        getServerNow: () => opts.now,
        cleanupClockIsTrustworthy: () => opts.clockOk !== false,
        showToast: (m) => calls.toast.push(String(m)),
        Intl: Intl,
        window: {},
        dbOp: (promise, label) => { calls.dbOp.push(String(label || '')); return promise; },
        fb: {
            ref: (dbRef, p) => ({ __path: p }),
            runTransaction: (ref, updater) => {
                const day = String(ref.__path || '').split('/').pop();
                const next = updater(server[day] === undefined ? null : server[day]);
                calls.tx.push({ day: day, next: JSON.parse(JSON.stringify(next === undefined ? null : next)) });
                if (next === null || next === undefined) delete server[day];
                else server[day] = JSON.parse(JSON.stringify(next));
                return Promise.resolve({ committed: true });
            },
            update: (ref, payload) => {
                calls.update.push(JSON.parse(JSON.stringify(payload)));
                Object.keys(payload).forEach((k) => {
                    const parts = k.split('/');
                    if (parts.length === 1) { if (payload[k] === null) delete server[k]; else server[k] = JSON.parse(JSON.stringify(payload[k])); }
                    else {
                        const day = parts[0], key = parts[1];
                        if (!server[day]) server[day] = {};
                        if (payload[k] === null) delete server[day][key];
                        else server[day][key] = JSON.parse(JSON.stringify(payload[k]));
                        if (!Object.keys(server[day]).length) delete server[day];
                    }
                });
                return Promise.resolve(true);
            }
        },
        document: {
            getElementById: () => box.__container,
            createElement: () => ({ className: '', innerHTML: '', appendChild() {} })
        },
        openModalHelper: () => { calls.toast.push('__modal'); }
    };
    box.__container = { _kids: [], innerHTML: '', appendChild(el) { this._kids.push(el); } };
    box.globalThis = box;
    box.window = box;
    box.__calls = calls;
    box.__server = server;
    vm.createContext(box);
    vm.runInContext(bodies, box);
    return box;
}

const DAY_A = '2026-09-10';
const DAY_B = '2026-09-12';
const NOW_A = Date.UTC(2026, 8, 10, 3, 0, 0);
const NOW_B = Date.UTC(2026, 8, 12, 3, 0, 0);
const bc = (code, cod, dod, closedAt) => ({ code: code, cod: cod, dod: dod, isClosed: closedAt !== undefined, closedAt: closedAt });

// ═══════════════════════════════════════════════════════════════════
scenario('១. លុយចុះលើ **ថ្ងៃបិទ** មិនមែនថ្ងៃស្កេន', () => {
    const s = makeSandbox({ now: NOW_B });
    ok('⛔ ជាន់អប្បបរមា ៖ កូនសោថ្ងៃដេរីវេពីនាឡិកាពិត',
        s.collectedDayOfStamp(NOW_B) === DAY_B, s.collectedDayOfStamp(NOW_B));
    const marks = s.collectedMarksFor(bc('77130500000001', 6.47, 2.5, NOW_B), true, undefined);
    ok('ការបិទផលិត mark ១', marks.length === 1, marks);
    ok('⛔ កូនសោថ្ងៃ = ថ្ងៃបិទ', marks[0].day === DAY_B, marks[0]);
    ok('⛔ តម្លៃយក COD/DOD របស់ barcode នោះ',
        marks[0].value.c === 6.47 && marks[0].value.d === 2.5, marks[0].value);
    s.markCollectedRevenue(marks);
    const writtenDays = [...new Set(s.__calls.tx.map((call) => call.day).concat(s.__calls.update.flatMap((payload) => Object.keys(payload).map((key) => key.split('/')[0]))))];
    ok('សរសេរទៅ node ថ្ងៃនោះតែមួយ', writtenDays.length === 1 && writtenDays[0] === DAY_B, writtenDays);
    const totals = s.collectedTotalsOfDay(s.__server[DAY_B]);
    ok('សរុបថ្ងៃ = $8.97 · ១ កញ្ចប់',
        totals.total === 8.97 && totals.count === 1, totals);
});

scenario('២. ⛔ អត្តសញ្ញាណ ៖ បិទ ២ ដងលើ barcode ដដែល មិនបង្កើតលុយ', () => {
    const s = makeSandbox({ now: NOW_B });
    const b = bc('77130500000001', 5, 0, NOW_B);
    s.markCollectedRevenue(s.collectedMarksFor(b, true, undefined));
    s.markCollectedRevenue(s.collectedMarksFor(b, true, NOW_B));
    s.markCollectedRevenue(s.collectedMarksFor(b, true, NOW_B));
    const totals = s.collectedTotalsOfDay(s.__server[DAY_B]);
    ok('⛔ សរុបនៅ $5.00 (មិនមែន $15.00) ➜ សំណុំ មិនមែន counter',
        totals.total === 5 && totals.count === 1, totals);
    ok('⛔ គ្មាននព្វន្ធ delta ក្នុងផ្លូវសរសេរ',
        !/\+=|\-=/.test(sliceFn(SRC, 'commitCollectedMarks') || ''), true);
});

scenario('៣. ⛔ បើកវិញ ➜ ដកចេញពី **ថ្ងៃដើម** មិនមែនថ្ងៃនេះ', () => {
    const s = makeSandbox({ now: NOW_B });
    const b = bc('77130500000001', 5, 0, NOW_A);
    s.markCollectedRevenue(s.collectedMarksFor(b, true, undefined));
    ok('⛔ ជាន់អប្បបរមា ៖ ចុះលើថ្ងៃ ' + DAY_A + ' ពិត', !!s.__server[DAY_A], Object.keys(s.__server));
    const reopen = s.collectedMarksFor(bc('77130500000001', 5, 0, undefined), false, NOW_A);
    ok('⛔ mark បើកវិញចង្អុលទៅថ្ងៃដើម', reopen.length === 1 && reopen[0].day === DAY_A, reopen);
    s.markCollectedRevenue(reopen);
    ok('⛔ ថ្ងៃដើមត្រូវលុបចោលទាំងស្រុង (node ទទេ ➜ null)',
        s.__server[DAY_A] === undefined, s.__server);
    ok('⛔ ថ្ងៃនេះមិនត្រូវប៉ះ', s.__server[DAY_B] === undefined, s.__server);
});

scenario('៤. ⛔ បើកវិញដោយ **គ្មានត្រា** ➜ រកថ្ងៃពីសំណុំដែលមានស្រាប់', () => {
    const s = makeSandbox({ now: NOW_B, local: { [DAY_A]: { '77130500000001': { c: 5, d: 0 } } },
        server: { [DAY_A]: { '77130500000001': { c: 5, d: 0 } } } });
    const reopen = s.collectedMarksFor(bc('77130500000001', 5, 0, undefined), false, undefined);
    ok('⛔ ត្រាបាត់ ➜ នៅតែរកថ្ងៃឃើញ (មិនបន្សល់លុយកំព្រា)',
        reopen.length === 1 && reopen[0].day === DAY_A, reopen);
    s.markCollectedRevenue(reopen);
    ok('⛔ ធាតុត្រូវលុបពិត', s.__server[DAY_A] === undefined, s.__server);
});

scenario('៥. ⛔ បិទឡើងវិញថ្ងៃក្រោយ ➜ **ផ្លាស់** មិនមែន **ចម្លង**', () => {
    const s = makeSandbox({ now: NOW_B });
    s.markCollectedRevenue(s.collectedMarksFor(bc('77130500000001', 5, 0, NOW_A), true, undefined));
    const again = s.collectedMarksFor(bc('77130500000001', 5, 0, NOW_B), true, NOW_A);
    ok('⛔ ផលិត mark ២ ៖ ដកចេញពីថ្ងៃចាស់ + ចាក់ចូលថ្ងៃថ្មី',
        again.length === 2 && again[0].day === DAY_A && again[0].value === null
        && again[1].day === DAY_B && !!again[1].value, again);
    s.markCollectedRevenue(again);
    ok('⛔ ថ្ងៃចាស់បាត់', s.__server[DAY_A] === undefined, s.__server);
    ok('⛔ ថ្ងៃថ្មីមាន $5.00 (មិនមែនរាប់ ២ ថ្ងៃ)',
        s.collectedTotalsOfDay(s.__server[DAY_B]).total === 5, s.__server[DAY_B]);
});

scenario('៦. ⛔ កញ្ចប់ទាំងមូល ៖ barcode ច្រើន ថ្ងៃដើមខុសគ្នា', () => {
    const s = makeSandbox({ now: NOW_B });
    const item = { barcodes: [bc('77130500000001', 5, 0, NOW_B), bc('77130500000002', 3, 1, NOW_B)] };
    s.markCollectedRevenue(item.barcodes.flatMap(barcode => s.collectedMarksFor(barcode, true)));
    ok('កញ្ចប់ ២ ចុះលើថ្ងៃដដែល',
        s.collectedTotalsOfDay(s.__server[DAY_B]).count === 2, s.__server[DAY_B]);
    ok('សរុប $9.00', s.collectedTotalsOfDay(s.__server[DAY_B]).total === 9, s.__server[DAY_B]);
    const openItem = { barcodes: [bc('77130500000001', 5, 0), bc('77130500000002', 3, 1)] };
    s.markCollectedRevenue(openItem.barcodes.flatMap(barcode => s.collectedMarksFor(barcode, false, NOW_B)));
    ok('⛔ បើកកញ្ចប់ទាំងមូល ➜ ថ្ងៃនោះទទេវិញ', s.__server[DAY_B] === undefined, s.__server);
});

scenario('៧. ⛔ ទិដ្ឋភាពចំណូលរង់ចាំ snapshot ពី Firebase', () => {
    const s = makeSandbox({ now: NOW_B, local: { [DAY_B]: { '77130500000001': { c: 2, d: 0 } } },
        server: { [DAY_B]: { '77130500000001': { c: 2, d: 0 } } } });
    s.markCollectedRevenue(s.collectedMarksFor(bc('77130500000001', 9, 0, NOW_B), true, NOW_B));
    ok('⛔ ជាន់អប្បបរមា ៖ តម្លៃថ្មីចុះពិត',
        s.collectedTotalsOfDay(s.__server[DAY_B]).total === 9, s.__server[DAY_B]);
    ok('⛔ ការហៅសរសេរមិនកែ memory មុន snapshot',
        s.collectedTotalsOfDay(s.dailyCollectedData[DAY_B]).total === 2 && s.collectedTotalsOfDay(s.__server[DAY_B]).total === 9, s.dailyCollectedData[DAY_B]);
});

scenario('៩. ⛔ ការសម្អាត ៧ ថ្ងៃ', () => {
    const days = {};
    for (let i = 0; i < 12; i++) {
        const key = new Date(NOW_B - i * 86400000).toISOString().slice(0, 10);
        days[key] = { ['k' + i]: { c: 1, d: 0 } };
    }
    days['មិនមែនថ្ងៃ'] = { k: { c: 1, d: 0 } };
    const s = makeSandbox({ now: NOW_B, local: days, server: days });
    const cutoff = s.collectedRetentionCutoffKey(NOW_B);
    ok('⛔ ព្រំដែនដេរីវេពី `DAILY_COLLECTED_KEEP_DAYS` (៧ ថ្ងៃ រាប់ថ្ងៃនេះ)',
        cutoff === '2026-09-06', cutoff);
    const stale = s.staleCollectedDays(days, NOW_B);
    ok('⛔ ថ្ងៃចាស់ត្រូវជ្រើស ហើយថ្ងៃក្នុង ៧ មិនត្រូវ',
        stale.every((d) => d < cutoff) && stale.indexOf(cutoff) === -1, stale);
    ok('⛔ កូនសោដែលមិនមែនថ្ងៃ **មិនត្រូវលុប** (កុំលុបអ្វីដែលមិនយល់)',
        stale.indexOf('មិនមែនថ្ងៃ') === -1, stale);
    s.runAutomaticCollectedCleanup();
    const left = Object.keys(s.__server).filter((d) => s.DAILY_COLLECTED_DAY_PATTERN.test(d));
    ok('⛔ ក្រោយសម្អាត នៅសល់ ៧ ថ្ងៃគត់', left.length === 7, left);
    ok('⛔ កូនសោមិនមែនថ្ងៃនៅដដែល', s.__server['មិនមែនថ្ងៃ'] !== undefined, Object.keys(s.__server));
    ok('⛔ ការលុបឆ្លងកាត់ `dbOp()` (មានពិដានពេល)', s.__calls.dbOp.length === 1, s.__calls.dbOp);

    const noClock = makeSandbox({ now: NOW_B, local: days, server: days, clockOk: false });
    noClock.runAutomaticCollectedCleanup();
    ok('⛔ នាឡិកាមិនគួរទុកចិត្ត ➜ **មិនលុបអ្វីសោះ**',
        noClock.__calls.update.length === 0, noClock.__calls.update);

    const staleView = makeSandbox({ now: NOW_B, local: days, server: days, failed: ['dailyCollected'] });
    staleView.runAutomaticCollectedCleanup();
    ok('⛔ ទិដ្ឋភាពមិនស្រស់ ➜ **មិនលុបអ្វីសោះ**',
        staleView.__calls.update.length === 0, staleView.__calls.update);
});

scenario('១០. ⛔ វា *មិនមែន* លុយ ៖ គ្មានការប៉ះ ledger ឬ `isDeducted`', () => {
    const FNS = ['collectedMarksFor', 'markCollectedRevenue',
        'commitCollectedMarks',
        'runAutomaticCollectedCleanup', 'syncCollectedValueForBarcode', 'collectedTotalsOfDay'];
    const joined = FNS.map((n) => sliceFn(SRC, n) || '').join('\n');
    ok('⛔ ជាន់អប្បបរមា ៖ ស្រង់តួទាំង ' + FNS.length + ' បាន',
        FNS.every((n) => !!sliceFn(SRC, n)), FNS.filter((n) => !sliceFn(SRC, n)));
    ['isDeducted', 'addRevenueToDailyAndMonthlyRecord', 'commitDailyRevenueDelta',
        'commitMonthlyRevenueDelta', 'revertRevenueLedgerDelta', 'packagesPickedUp',
        'zoew_daily_revenue_cod_dod', 'zoew_monthly_revenue_cod_dod',
        'zoew_daily_pickup_cod_dod'].forEach((name) => {
        ok('⛔ ផ្លូវចំណូលប្រចាំថ្ងៃ មិនប៉ះ `' + name + '`', joined.indexOf(name) === -1, name);
    });
});

scenario('១១. ⛔ ស្នាមភ្ជាប់ ៖ ឈ្មោះ node ត្រូវស៊ីគ្នា app.js ↔ rules', () => {
    ok('`app.js` សរសេរទៅ node នោះ', SRC.indexOf(NODE) !== -1, NODE);
    ok('⛔ rules ពិតស្គាល់ node នោះ', RULES.indexOf('"' + NODE + '"') !== -1, NODE);
    let parsed = null;
    try { parsed = JSON.parse(RULES).rules[NODE]; } catch (_) { parsed = null; }
    ok('⛔ rules អនុញ្ញាតឲ្យអានបាន', !!parsed && parsed['.read'] === 'auth != null', parsed && parsed['.read']);
    ok('⛔ rules អនុញ្ញាតឲ្យសរសេរបាន', !!parsed && parsed['.write'] === 'auth != null', parsed && parsed['.write']);
    const shape = parsed && parsed['$date'] && parsed['$date']['$barcodeKey'];
    ok('⛔ វាល `c` និង `d` ត្រូវជាលេខ >= 0',
        !!shape && /newData.isNumber\(\)/.test(shape.c['.validate'])
        && /newData.isNumber\(\)/.test(shape.d['.validate'])
        && shape.c['.validate'].indexOf('>= 0') !== -1, shape);
    ok('⛔ វាលចម្លែកត្រូវបដិសេធ (`$other`)',
        !!shape && shape['$other'] && shape['$other']['.validate'] === false, shape && shape['$other']);
    ok('⛔ listener ត្រូវចុះឈ្មោះក្នុង `DB_LISTENER_KEYS`',
        (readConst('DB_LISTENER_KEYS', []) || []).indexOf('dailyCollected') !== -1,
        readConst('DB_LISTENER_KEYS', []));
    const init = sliceFn(SRC, 'initDatabaseListeners') || '';
    ok('⛔ listener ភ្ជាប់ពិត ហើយរាយការណ៍ **កូនសោរបស់ខ្លួន**',
        /noteDbListenerAlive\(DB_LISTENER_KEY_DAILY_COLLECTED\)/.test(init)
        && /handleDbListenerError\(err, DB_LISTENER_KEY_DAILY_COLLECTED\)/.test(init), true);
    ok('⛔ ការសម្អាតត្រូវមានអ្នកបើកក្នុង `runScheduledCleanup()`',
        (sliceFn(SRC, 'runScheduledCleanup') || '').indexOf('runAutomaticCollectedCleanup') !== -1, true);
});

scenario('១២. ⛔ អេក្រង់ ៖ លេខដែលអ្នកប្រើអាន', () => {
    const s = makeSandbox({ now: NOW_B, local: {
        [DAY_B]: { a: { c: 6.47, d: 2.5 }, b: { c: 1.03, d: 0 } },
        [DAY_A]: { c: { c: 10, d: 0 } }
    } });
    s.openCollectedStatsModal();
    const html = s.__container._kids.map((k) => String(k.innerHTML || '')).join('\n');
    ok('⛔ គូរកាតគ្រប់ថ្ងៃ', s.__container._kids.length === 2, s.__container._kids.length);
    ok('⛔ ថ្ងៃថ្មីជាងឈរមុន', html.indexOf(DAY_B) < html.indexOf(DAY_A), html.slice(0, 120));
    ok('⛔ សរុប $10.00 លេចលើអេក្រង់ពិត', html.indexOf('$10.00') !== -1, html.slice(0, 400));
    ok('⛔ សេនមិនត្រូវបង្គត់ ៖ 6.47+2.5+1.03 = $10.00 ក៏ COD ត្រូវជា $7.50',
        html.indexOf('$7.50') !== -1, html.slice(0, 400));
    ok('⛔ រាប់កញ្ចប់តាមសំណុំ', html.indexOf('>2<') !== -1 || html.indexOf('>2</strong>') !== -1
        || /កញ្ចប់យករួច[^<]*<strong>2</.test(html), html.slice(0, 300));
    const empty = makeSandbox({ now: NOW_B });
    empty.openCollectedStatsModal();
    ok('⛔ ទទេ ➜ សារពិត មិនមែនទទេស្អាត',
        String(empty.__container.innerHTML || '').length > 20, empty.__container.innerHTML);
});

scenario('១៣. ⛔ UI ៖ ប៊ូតុង · ប្រអប់ · ការបែងចែកឈ្មោះ', () => {
    ok('ប៊ូតុងហៅ `openCollectedStatsModal`',
        /data-act="openCollectedStatsModal"/.test(HTML), true);
    ok('ប្រអប់ `collectedStatsModal` មាន', /id="collectedStatsModal"/.test(HTML), true);
    ok('កន្លែងគូរ `collectedStatsContainer` មាន', /id="collectedStatsContainer"/.test(HTML), true);
    ok('⛔ `openCollectedStatsModal` ស្ថិតក្នុង `ACTION_ALLOWLIST`',
        /"openCollectedStatsModal"/.test(SRC), true);
    ok('⛔ អេក្រង់ចាស់ «ស្ថិតិ ៣ ខែ» ត្រូវដកចេញទាំងស្រុង',
        HTML.indexOf('monthlyStatsModal') === -1 && SRC.indexOf('openMonthlyStatsModal') === -1, true);
    // ⛔ អ័ក្ស ២ ខុសគ្នា ➜ អ្នកប្រើត្រូវអានឃើញភាពខុសនោះ បើមិនដូច្នេះគាត់
    // នឹងប្រៀបលេខ ២ ដែលមិនអាចប្រៀបបាន រួចរាយការណ៍ជា «កំហុស»។
    const modalAt = HTML.indexOf('id="collectedStatsModal"');
    const modalHtml = HTML.slice(modalAt, modalAt + 1400);
    ok('⛔ ប្រអប់ប្រាប់ថាវាគិតតាម **ថ្ងៃយក**', modalHtml.indexOf('ថ្ងៃ') !== -1
        && /យក/.test(modalHtml), modalHtml.slice(0, 200));
    ok('⛔ ប្រអប់ព្រមានថាវាមិនមែន «កញ្ចប់ប្រចាំថ្ងៃ»',
        modalHtml.indexOf('កញ្ចប់ប្រចាំថ្ងៃ') !== -1, modalHtml.slice(0, 600));
    ok('⛔ ប្រអប់ប្រាប់ពី ៧ ថ្ងៃ', /៧ ថ្ងៃ/.test(modalHtml), modalHtml.slice(0, 600));
});


// ស្រង់មុខងារពិតតាម AST ដើម្បីវាស់ស្នាមភ្ជាប់ close/delete/restore ជាមួយគ្នា។
const operationAst = require('acorn').parse(SRC, { ecmaVersion: 'latest' });
const fnCode = operationAst.body.filter(node => node.type === 'FunctionDeclaration').map(node => SRC.slice(node.start, node.end)).join('\n');
const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
const HISTORY = 'zoew_scan_history_cod_dod';
const TRASH = 'zoew_recently_deleted_cod_dod';
const COLLECTED = NODE;
const DAILY = 'zoew_daily_revenue_cod_dod';
const MONTHLY = 'zoew_monthly_revenue_cod_dod';
const PICKUP = 'zoew_daily_pickup_cod_dod';
function makeOperationSandbox(initial, now = NOW_B, sharedStore) {
    const server = sharedStore || clone(initial);
    const calls = [];
    const messages = [];
    function read(p) { return p.split('/').filter(Boolean).reduce((v, key) => v && v[key], server) ?? null; }
    function write(p, value) {
        const parts = p.split('/').filter(Boolean);
        const key = parts.pop();
        let node = server;
        for (const part of parts) node = node[part] || (node[part] = {});
        if (value === null) delete node[key];
        else if (value && typeof value === 'object' && '__increment' in value) node[key] = (node[key] || 0) + value.__increment;
        else node[key] = clone(value);
    }
    function snap(p) { const value = clone(read(p)); return { exists: () => value !== null, val: () => clone(value) }; }
    const box = {
        console, Date, Intl, setTimeout, clearTimeout, Promise, Set, Map,
        db: {}, authGeneration: 0, dbRefHistory: { path: HISTORY }, dbRefDeleted: { path: TRASH },
        dbRefDailyCollected: { path: COLLECTED }, dbRefDailyPickup: { path: PICKUP },
        dailyCollectedData: clone(server[COLLECTED] || {}), dailyPickupData: clone(server[PICKUP] || {}),
        dailyRevenueData: clone(server[DAILY] || {}), monthlyRevenueData: clone(server[MONTHLY] || {}),
        scanHistory: Object.values(clone(server[HISTORY] || {})), deletedItems: Object.values(clone(server[TRASH] || {})),
        pendingRestoreId: null, activeRestoreClaims: new Map(), scanRemoveInFlight: null,
        dbListenerPendingPaths: new Set(), dbListenerFailedPaths: new Set(),
        DB_LISTENER_KEY_DELETED: 'deleted', DB_LISTENER_KEY_DAILY_COLLECTED: 'dailyCollected',
        cleanupInFlightIds: new Set(), cleanupNextAttemptAt: new Map(), activeClearHistoryClaims: new Map(),
        confirm: () => true, alert: message => messages.push(message),
        fb: {
            ref: (db, p = '') => ({ path: p }),
            get: ref => Promise.resolve(snap(ref.path)),
            increment: amount => ({ __increment: amount }),
            runTransaction: (ref, updater) => {
                const value = updater(clone(read(ref.path)));
                calls.push({ kind: 'transaction', path: ref.path, value: clone(value) });
                if (value !== undefined) write(ref.path, value);
                if (ref.path === COLLECTED || ref.path.startsWith(COLLECTED + '/')) box.dailyCollectedData = clone(read(COLLECTED) || {});
                return Promise.resolve({ committed: value !== undefined, snapshot: snap(ref.path) });
            },
            update: (ref, updates) => {
                calls.push({ kind: 'update', path: ref.path, value: clone(updates) });
                Object.entries(updates).forEach(([p, value]) => write([ref.path, p].filter(Boolean).join('/'), value));
                if (ref.path === COLLECTED || ref.path.startsWith(COLLECTED + '/') || Object.keys(updates).some(p => p.startsWith(COLLECTED + '/'))) box.dailyCollectedData = clone(read(COLLECTED) || {});
                return Promise.resolve();
            }
        }
    };
    box.window = box;
    box.globalThis = box;
    vm.createContext(box);
    vm.runInContext(fnCode, box);
    for (const name of ['APP_TIME_ZONE', 'APP_TIME_ZONE_OFFSET_MINUTES', 'PICKUP_PHONE_KEY_MAX', 'PICKUP_LEGACY_KEY_PREFIX',
        'RESTORE_CLAIM_LEASE_MS', 'DB_OP_TIMEOUT_MS', 'TRASH_WRITE_SLOW_NOTICE_MS', 'DAILY_COLLECTED_KEEP_DAYS',
        'ABANDON_AGE_MS', 'TWO_HOURS_MS', 'TRASH_RETENTION_MS', 'EXPIRED_TRASH_RETENTION_MS']) {
        const declaration = operationAst.body.filter(node => node.type === 'VariableDeclaration').flatMap(node => node.declarations).find(node => node.id.name === name);
        if (declaration) box[name] = vm.runInContext(SRC.slice(declaration.init.start, declaration.init.end), box);
    }
    Object.assign(box, {
        PICKUP_DATE_KEY_PATTERN: /^\d{4}-\d{2}-\d{2}$/, DAILY_COLLECTED_DAY_PATTERN: /^\d{4}-\d{2}-\d{2}$/,
        getServerNow: () => now, getFormattedDate: () => new Date(now).toISOString().slice(0, 10),
        showToast: message => messages.push(message), refreshCurrentHistoryView() {}, closeModal() {},
        updateRecentPhonesList() {}, openRecentlyDeletedModal() {}, openViewListModal() {}, viewListModalShowing: () => false,
        generateUniqueId: (() => { let id = 0; return () => 'fixture_' + (++id); })()
    });
    return { box, server, calls, messages, read, write, sync() {
        box.scanHistory = Object.values(clone(server[HISTORY] || {}));
        box.deletedItems = Object.values(clone(server[TRASH] || {}));
        box.dailyCollectedData = clone(server[COLLECTED] || {});
    } };
}
function operationItem(cod, closed, at) {
    const result = { id: 'fixture_item', phone: '0900000001', scanDate: '2026-09-09', createdAt: NOW_A - 86400000,
        cod, dod: 0.75, price: cod + 0.75, count: 1, barcode: 'FIXTURE1', isClosed: closed,
        barcodes: [{ code: 'FIXTURE1', cod, dod: 0.75, isClosed: closed, isDeducted: false }] };
    if (closed) { result.closedAt = at; result.barcodes[0].closedAt = at; }
    return result;
}

function editOperation(s, cod, dod) {
    Object.assign(s.box, {
        activeParentItemId: 'fixture_item', activeEditingBarcode: 'FIXTURE1',
        dbRefDailyRevenue: { path: DAILY }, dbRefMonthlyRevenue: { path: MONTHLY },
        document: { getElementById: id => id === 'editBcCodInput' ? { value: cod } : id === 'editBcDodInput' ? { value: dod } : null }
    });
    s.box.saveEditedBarcodePrice();
}

async function operationTicks(count = 12) {
    for (let index = 0; index < count; index++) await new Promise(resolve => setTimeout(resolve, 0));
}

function editFixture() {
    return { [HISTORY]: { fixture_item: operationItem(12.5, true, NOW_B) },
        [COLLECTED]: { [DAY_B]: { FIXTURE1: { c: 12.5, d: 0.75 } } }, [PICKUP]: {},
        [DAILY]: { '2026-09-09': { codDollar: 12.5, dodDollar: 0.75, totalCount: 1 } },
        [MONTHLY]: { '2026-09': { codDollar: 12.5, dodDollar: 0.75, totalCount: 1 } } };
}

async function operationScenario(name, action) {
    console.log('\n== ' + name + ' ==');
    try { await action(); }
    catch (error) { ok(name + ' រត់ដល់ចប់', false, error.stack || error.message); }
}
function collectedTotal(store) {
    return Object.values(store[COLLECTED] || {}).reduce((total, day) => total + Object.values(day || {}).reduce((sum, value) => sum + value.c + value.d, 0), 0);
}
// ទប់សំណើមុន server ទទួល ហើយ transaction អានទិន្នន័យពេលដោះទប់ ដូច retry របស់ RTDB។
// មិនពឹងលើឈ្មោះ helper ថ្មី ឬបង្ខំឱ្យ ship ប្រើ update ជំនួស transaction ទេ។
function holdNextCollectedWrite(s) {
    let pending = null;
    for (const method of ['update', 'runTransaction']) {
        const original = s.box.fb[method];
        s.box.fb[method] = (ref, value, ...rest) => {
            if (pending || !(ref.path === COLLECTED || ref.path.startsWith(COLLECTED + '/'))) return original(ref, value, ...rest);
            return new Promise((resolve, reject) => {
                pending = {
                    method, path: ref.path,
                    accept: async () => resolve(await original(ref, value, ...rest)),
                    reject: (error = new Error('permission_denied')) => { s.sync(); reject(error); }
                };
            });
        };
    }
    return { get pending() { return pending; } };
}
function retentionFixture(day) {
    const initial = editFixture();
    initial[COLLECTED] = { [day]: { FIXTURE1: { c: 12.5, d: 0.75 } } };
    return initial;
}
function moneySources(s) {
    return { daily: clone(s.read(DAILY)), monthly: clone(s.read(MONTHLY)), pickup: clone(s.read(PICKUP)) };
}
async function closeOperation(s, method, closed) {
    const name = method === 'single' ? 'applyBarcodeCloseChange' : 'toggleCloseStatus';
    if (typeof s.box[name] !== 'function') {
        ok('ជាន់អប្បបរមា៖ មុខងារបិទពិតត្រូវមាន — ' + name, false);
        return null;
    }
    if (method === 'single') return s.box[name]('fixture_item', 'FIXTURE1', closed, { showModal: false });
    return s.box[name]('fixture_item');
}
(async () => {
    await operationScenario('៨. ការកែទឹកប្រាក់អាន server ពិត ហើយមិនបង្កើតធាតុថ្មី', async () => {
        const initial = { [HISTORY]: { fixture_item: operationItem(8.25, true, NOW_B) },
            [COLLECTED]: { [DAY_B]: { FIXTURE1: { c: 5, d: 0 } } } };
        const s = makeOperationSandbox(initial);
        await s.box.syncCollectedValueForBarcode('fixture_item', 'FIXTURE1');
        ok('តម្លៃថ្មីជំនួសតម្លៃចាស់ ក្នុងថ្ងៃដដែល', collectedTotal(s.server) === 9, s.read(COLLECTED));
        initial[COLLECTED] = {};
        const missing = makeOperationSandbox(initial);
        const unchanged = JSON.stringify(missing.server);
        await missing.box.syncCollectedValueForBarcode('fixture_item', 'FIXTURE1');
        // CAS អាចផ្ទៀង snapshot ដដែលដោយគ្មានការប្រែទិន្នន័យ; ច្បាប់គឺមិនបង្កើតធាតុ។
        ok('គ្មានធាតុស្រាប់ ➜ មិនបង្កើត ឬកែទិន្នន័យ', JSON.stringify(missing.server) === unchanged && collectedTotal(missing.server) === 0, missing.server);
        initial[HISTORY].fixture_item = operationItem(8.25, false);
        initial[COLLECTED] = { [DAY_B]: { FIXTURE1: { c: 5, d: 0 } } };
        const reopened = makeOperationSandbox(initial);
        await reopened.box.syncCollectedValueForBarcode('fixture_item', 'FIXTURE1');
        ok('barcode ដែល server បើក ត្រូវដកចំណូលចាស់ចេញ', collectedTotal(reopened.server) === 0, reopened.read(COLLECTED));
    });
    for (const method of ['single', 'whole']) {
        await operationScenario('១៤. ទិដ្ឋភាពតម្លៃចាស់ត្រូវស៊ីនឹងសាលក្រម server — ' + method, async () => {
            const s = makeOperationSandbox({ [HISTORY]: { fixture_item: operationItem(24.5, false) }, [COLLECTED]: {}, [PICKUP]: {} });
            s.box.scanHistory = [operationItem(5.25, false)];
            const result = await closeOperation(s, method, true);
            await new Promise(resolve => setTimeout(resolve, 0));
            ok('ការបិទត្រូវបាន server ទទួលពិត — ' + method, result === true && s.read(HISTORY + '/fixture_item/barcodes/0').isClosed === true);
            ok('ចំណូលមកពី COD $24.50 និង DOD $0.75 របស់ server — ' + method, collectedTotal(s.server) === 25.25, s.read(COLLECTED));
        });
        await operationScenario('១៥. លុប/ស្តារថ្ងៃក្រោយ/បើកវិញ — ' + method, async () => {
            const ledger = { '2026-09-09': { codDollar: 12.5, dodDollar: 0.75, totalCount: 1 } };
            const monthly = { '2026-09': { codDollar: 12.5, dodDollar: 0.75, totalCount: 1 } };
            const s = makeOperationSandbox({ [HISTORY]: { fixture_item: operationItem(12.5, true, NOW_A) },
                [COLLECTED]: { [DAY_A]: { FIXTURE1: { c: 12.5, d: 0.75 } } }, [DAILY]: ledger, [MONTHLY]: monthly, [PICKUP]: {} });
            await s.box.deleteSingleItem('fixture_item');
            ok('លុបផ្លាស់ទៅធុងសំរាម ហើយមិនដកលុយ — ' + method,
                !s.read(HISTORY + '/fixture_item') && !!s.read(TRASH + '/fixture_item') && collectedTotal(s.server) === 13.25);
            s.box.pendingRestoreId = 'fixture_item';
            await s.box.executeRestoreItem();
            ok('ស្តារពិត reset ត្រាទៅថ្ងៃក្រោយ តែមិនបូកចំណូលម្តងទៀត — ' + method,
                s.read(HISTORY + '/fixture_item/barcodes/0/closedAt') === NOW_B && collectedTotal(s.server) === 13.25);
            ok('លុប/ស្តារមិនប្តូរ ledger ថ្ងៃ/ខែ — ' + method,
                JSON.stringify(s.server[DAILY]) === JSON.stringify(ledger) && JSON.stringify(s.server[MONTHLY]) === JSON.stringify(monthly));
            s.sync();
            await closeOperation(s, method, false);
            await new Promise(resolve => setTimeout(resolve, 0));
            ok('បើកវិញដកកំណត់ត្រាពីថ្ងៃយកដើម — ' + method, collectedTotal(s.server) === 0, s.read(COLLECTED));
        });
    }
    await operationScenario('១៦. ផ្លាស់ថ្ងៃដោយសរសេរតែមួយ ដែលបដិសេធជាឯកតា', async () => {
        const initial = { [HISTORY]: { fixture_item: operationItem(12.5, true, NOW_A) },
            [COLLECTED]: { [DAY_A]: { FIXTURE1: { c: 12.5, d: 0.75 }, UNRELATED: { c: 4, d: 0.5 } } }, [PICKUP]: {} };
        const s = makeOperationSandbox(initial);
        let rejected = false;
        const transaction = s.box.fb.runTransaction;
        const update = s.box.fb.update;
        const rejectFirst = ref => {
            if (!rejected && ref.path.startsWith(COLLECTED)) { rejected = true; return true; }
            return false;
        };
        s.box.fb.runTransaction = (ref, updater) => rejectFirst(ref) ? Promise.reject(new Error('permission_denied: fixture')) : transaction(ref, updater);
        s.box.fb.update = (ref, values) => rejectFirst(ref) ? Promise.reject(new Error('permission_denied: fixture')) : update(ref, values);
        await closeOperation(s, 'single', true);
        await new Promise(resolve => setTimeout(resolve, 0));
        ok('ជាន់អប្បបរមា៖ បានបង្ខំការបដិសេធពិត', rejected);
        ok('ការផ្លាស់ថ្ងៃធ្លាក់មិនអាចបង្កើត barcode នៅពីរថ្ងៃ', collectedTotal(s.server) === 17.75, s.read(COLLECTED));
        ok('barcode ផ្សេងនៅដដែលក្រោយការបដិសេធ', s.read(COLLECTED + '/' + DAY_A + '/UNRELATED/c') === 4);
        ok('memory ត្រឡប់ដើម និងសារមិនអះអាងជោគជ័យគ្រប់ពេលសរសេរធ្លាក់',
            collectedTotal({ [COLLECTED]: s.box.dailyCollectedData }) === 17.75 && s.messages.some(message => message.includes('⚠️')) && !s.messages.some(message => message.includes('✅')),
            { local: s.box.dailyCollectedData, messages: s.messages });
    });
    await operationScenario('១៧. បើកវិញក្រោយស្តារ ខណៈ listener ចំណូលមិនទាន់មកដល់', async () => {
        const s = makeOperationSandbox({ [HISTORY]: { fixture_item: operationItem(12.5, true, NOW_B) },
            [COLLECTED]: { [DAY_A]: { FIXTURE1: { c: 12.5, d: 0.75 } } }, [PICKUP]: {} });
        s.box.dailyCollectedData = {};
        await closeOperation(s, 'single', false);
        await new Promise(resolve => setTimeout(resolve, 0));
        ok('អត្តសញ្ញាណថ្ងៃយកមិនបាត់ដោយសារ listener ចាស់', collectedTotal(s.server) === 0, s.read(COLLECTED));
    });
    await operationScenario('១៨. ចម្លើយបិទចាស់មកយឺត ក្រោយឧបករណ៍ផ្សេងបើកវិញ', async () => {
        const s = makeOperationSandbox({ [HISTORY]: { fixture_item: operationItem(12.5, false) }, [COLLECTED]: {}, [PICKUP]: {} });
        let release;
        const transaction = s.box.fb.runTransaction;
        s.box.fb.runTransaction = (ref, updater) => {
            const result = transaction(ref, updater);
            if (ref.path === HISTORY + '/fixture_item') return new Promise(resolve => { release = async () => resolve(await result); });
            return result;
        };
        const closing = closeOperation(s, 'single', true);
        const second = makeOperationSandbox(s.server, NOW_B + 1000, s.server);
        await closeOperation(second, 'single', false);
        await release();
        await closing;
        await new Promise(resolve => setTimeout(resolve, 0));
        ok('ឧបករណ៍ទីពីរបើក barcode ពិត', s.read(HISTORY + '/fixture_item/barcodes/0/isClosed') === false);
        ok('ចម្លើយចាស់មិនបង្កើតចំណូលឡើងវិញក្រោយបើក', collectedTotal(s.server) === 0, s.read(COLLECTED));
    });
    await operationScenario('១៩. ការសរសេរចំណូលចាស់មកដល់ក្រោយការបើកថ្មី', async () => {
        const s = makeOperationSandbox({ [HISTORY]: { fixture_item: operationItem(12.5, false) }, [COLLECTED]: {}, [PICKUP]: {} });
        let release;
        const update = s.box.fb.update;
        s.box.fb.update = (ref, values) => {
            if (ref.path !== COLLECTED || release) return update(ref, values);
            return new Promise(resolve => { release = async () => { await update(ref, values); resolve(); }; });
        };
        const closing = closeOperation(s, 'single', true);
        for (let count = 0; !release && count < 30; count++) await new Promise(resolve => setTimeout(resolve, 0));
        ok('បានព្យួរការសរសេរចំណូលពិត', !!release);
        if (!release) return;
        const second = makeOperationSandbox(s.server, NOW_B + 1000, s.server);
        await closeOperation(second, 'single', false);
        await new Promise(resolve => setTimeout(resolve, 0));
        await release(); await closing;
        await new Promise(resolve => setTimeout(resolve, 0));
        ok('ការសរសេរចាស់ត្រូវបានកែតាមស្ថានភាពបើកថ្មី', s.read(HISTORY + '/fixture_item/barcodes/0/isClosed') === false && collectedTotal(s.server) === 0, s.read(COLLECTED));
    });
    await operationScenario('២០. លុបចន្លោះការបិទ និងការឆ្លើយតប មិនអាចដកចំណូល', async () => {
        const s = makeOperationSandbox({ [HISTORY]: { fixture_item: operationItem(12.5, true, NOW_A) },
            [COLLECTED]: { [DAY_A]: { FIXTURE1: { c: 12.5, d: 0.75 } } }, [PICKUP]: {} });
        let release;
        const transaction = s.box.fb.runTransaction;
        s.box.fb.runTransaction = (ref, updater) => {
            const result = transaction(ref, updater);
            if (ref.path === HISTORY + '/fixture_item') return new Promise(resolve => { release = async () => resolve(await result); });
            return result;
        };
        const closing = closeOperation(s, 'single', true);
        const second = makeOperationSandbox(s.server, NOW_B + 1000, s.server);
        await second.box.deleteSingleItem('fixture_item');
        await release(); await closing;
        await new Promise(resolve => setTimeout(resolve, 0));
        ok('ការលុបពិតបានរក្សាចំណូលដើម', !s.read(HISTORY + '/fixture_item') && !!s.read(TRASH + '/fixture_item') && collectedTotal(s.server) === 13.25, s.read(COLLECTED));
    });
    for (const method of ['single', 'whole']) {
        await operationScenario('២១. ចម្លើយយឺតក្រោយប្តូរអាជីវកម្ម — ' + method, async () => {
            const s = makeOperationSandbox({ [HISTORY]: { fixture_item: operationItem(12.5, false) }, [COLLECTED]: {}, [PICKUP]: {} });
            let release;
            const transaction = s.box.fb.runTransaction;
            s.box.fb.runTransaction = (ref, updater) => {
                const result = transaction(ref, updater);
                if (ref.path === HISTORY + '/fixture_item') return new Promise(resolve => { release = async () => resolve(await result); });
                return result;
            };
            const closing = closeOperation(s, method, true);
            s.box.authGeneration++; s.box.db = {};
            s.box.dailyCollectedData = { [DAY_B]: { OTHER_BUSINESS: { c: 2, d: 0 } } };
            const before = s.calls.length;
            await release(); const result = await closing;
            ok('ចម្លើយចាស់មិនសរសេរ ឬបង្ហាញសារក្នុងអាជីវកម្មថ្មី — ' + method,
                result === false && s.calls.length === before && s.messages.length === 0 && s.box.dailyCollectedData[DAY_B].OTHER_BUSINESS.c === 2,
                { result, calls: s.calls.length - before, messages: s.messages });
        });
    }
    await operationScenario('២២. ការកែចំណូលដែលប្រណាំងជាប់ៗគ្នាមានព្រំដែន', async () => {
        const s = makeOperationSandbox({ [HISTORY]: { fixture_item: operationItem(12.5, false) }, [COLLECTED]: {}, [PICKUP]: {} });
        const update = s.box.fb.update;
        let writes = 0;
        s.box.fb.update = async (ref, values) => {
            await update(ref, values);
            if (ref.path === COLLECTED) {
                writes++;
                s.write(HISTORY + '/fixture_item/barcodes/0/cod', 12.5 + writes);
            }
        };
        await closeOperation(s, 'single', true);
        ok('មិន retry គ្មានទីបញ្ចប់ ហើយប្រាប់ថាមិនទាន់ Sync ពេញលេញ', writes > 0 && writes <= 3 && s.messages.some(message => message.includes('⚠️')) && !s.messages.some(message => message.includes('✅')), { writes, messages: s.messages });
    });
    await operationScenario('២៣. ការសរសេរចំណូលព្យួរមិនរាំង UI ហើយកែវិញពេលដោះយឺត', async () => {
        const s = makeOperationSandbox({ [HISTORY]: { fixture_item: operationItem(12.5, false) }, [COLLECTED]: {}, [PICKUP]: {} });
        s.box.DB_OP_TIMEOUT_MS = 10;
        let release;
        const update = s.box.fb.update;
        s.box.fb.update = (ref, values) => {
            if (ref.path !== COLLECTED || release) return update(ref, values);
            return new Promise(resolve => { release = async () => { await update(ref, values); resolve(); }; });
        };
        const closing = closeOperation(s, 'single', true);
        const result = await Promise.race([closing, new Promise(resolve => setTimeout(() => resolve('still-waiting'), 100))]);
        ok('history បានបិទ ប៉ុន្តែ UI មិនព្យួរលើការសរសេរចំណូល', result === true && !!release && s.messages.some(message => message.includes('⚠️')), { result, messages: s.messages });
        if (!release) return;
        const second = makeOperationSandbox(s.server, NOW_B + 1000, s.server);
        await closeOperation(second, 'single', false);
        await release(); await closing;
        await new Promise(resolve => setTimeout(resolve, 20));
        ok('ការសរសេរចាស់ដោះក្រោយពិដាន ត្រូវកែទៅស្ថានភាពបើកថ្មី', collectedTotal(s.server) === 0, s.read(COLLECTED));
    });
    await operationScenario('២៤. បិទលើកដំបូង ហើយលុបមុនចម្លើយមកដល់', async () => {
        const s = makeOperationSandbox({ [HISTORY]: { fixture_item: operationItem(12.5, false) }, [COLLECTED]: {}, [PICKUP]: {} });
        let release;
        const transaction = s.box.fb.runTransaction;
        s.box.fb.runTransaction = (ref, updater) => {
            const result = transaction(ref, updater);
            if (ref.path === HISTORY + '/fixture_item') return new Promise(resolve => { release = async () => resolve(await result); });
            return result;
        };
        const closing = closeOperation(s, 'single', true);
        const second = makeOperationSandbox(s.server, NOW_B + 1000, s.server);
        await second.box.deleteSingleItem('fixture_item');
        await release(); await closing;
        ok('កញ្ចប់ចូលធុងសំរាម ក៏ចំណូលពីការបិទលើកដំបូងមិនបាត់', !s.read(HISTORY + '/fixture_item') && !!s.read(TRASH + '/fixture_item') && collectedTotal(s.server) === 13.25, s.read(COLLECTED));
    });
    await operationScenario('២៥. ការសរសេរចាស់ធ្លាក់ ក្រោយតម្លៃដដែលពីការសរសេរថ្មីជោគជ័យ', async () => {
        const s = makeOperationSandbox({ [HISTORY]: {}, [COLLECTED]: { [DAY_B]: { FIXTURE1: { c: 2, d: 0 } } }, [PICKUP]: {} });
        let reject;
        const update = s.box.fb.update;
        s.box.fb.update = (ref, values) => !reject && ref.path === COLLECTED
            ? new Promise((resolve, fail) => { reject = fail; }) : update(ref, values);
        const old = s.box.markCollectedRevenue([{ key: 'FIXTURE1', day: DAY_B, value: { c: 9, d: 0 } }]);
        const newer = s.box.markCollectedRevenue([{ key: 'FIXTURE1', day: DAY_B, value: { c: 9, d: 0 } }]);
        await newer.server;
        reject(new Error('permission_denied: old fixture')); await old.server;
        ok('ចម្លើយបដិសេធចាស់មិនត្រឡប់តម្លៃថ្មីដែល server បានទទួល', s.read(COLLECTED + '/' + DAY_B + '/FIXTURE1/c') === 9 && s.box.dailyCollectedData[DAY_B].FIXTURE1.c === 9, s.box.dailyCollectedData);
    });
    await operationScenario('២៦. ប្រភពផ្លាស់ទីទៅ ID ផ្សេង មិនអាចអះអាងថា Sync រួច', async () => {
        const mirror = { [DAY_B]: { FIXTURE1: { c: 12.5, d: 0.75 }, UNRELATED: { c: 2, d: 0 } } };
        const s = makeOperationSandbox({ [HISTORY]: {}, [TRASH]: { moved: operationItem(12.5, true, NOW_B) }, [COLLECTED]: mirror, [PICKUP]: {} });
        const result = await s.box.reconcileCollectedHistory('fixture_item', ['FIXTURE1']);
        ok('រកប្រភពមិនឃើញ ➜ រក្សាចំណូល និងប្រាប់ថាមិនទាន់បញ្ជាក់', result === null && JSON.stringify(s.read(COLLECTED)) === JSON.stringify(mirror) && s.messages.some(message => message.includes('⚠️')), { result, messages: s.messages });
    });
    for (const order of [[0, 1], [1, 0]]) {
        await operationScenario('២៧. ការសរសេរពីរជាប់គ្នាធ្លាក់ទាំងពីរ — ' + order.join(' → '), async () => {
            const s = makeOperationSandbox({ [HISTORY]: {}, [COLLECTED]: { [DAY_B]: { FIXTURE1: { c: 2, d: 0 } } }, [PICKUP]: {} });
            const queued = [];
            s.box.fb.update = () => new Promise((resolve, reject) => queued.push({ resolve, reject }));
            const old = s.box.markCollectedRevenue([{ key: 'FIXTURE1', day: DAY_B, value: { c: 9, d: 0 } }]);
            const newer = s.box.markCollectedRevenue([{ key: 'FIXTURE1', day: DAY_B, value: { c: 12, d: 0 } }]);
            for (const index of order) { queued[index].reject(new Error('permission_denied: fixture ' + index)); await Promise.resolve(); }
            await Promise.all([old.server, newer.server]);
            ok('ការបដិសេធទាំងពីររក្សាតម្លៃចុងក្រោយដែលបានបញ្ជាក់ $2', s.read(COLLECTED + '/' + DAY_B + '/FIXTURE1/c') === 2 && s.box.dailyCollectedData[DAY_B].FIXTURE1.c === 2, s.box.dailyCollectedData);
        });
    }
    await operationScenario('២៨. ការសរសេរចាស់ជោគជ័យ តែការសរសេរថ្មីធ្លាក់', async () => {
        const s = makeOperationSandbox({ [HISTORY]: {}, [COLLECTED]: { [DAY_B]: { FIXTURE1: { c: 2, d: 0 } } }, [PICKUP]: {} });
        const queued = [];
        const update = s.box.fb.update;
        s.box.fb.update = (ref, values) => new Promise((resolve, reject) => queued.push({ commit: async () => { await update(ref, values); resolve(); }, reject }));
        const old = s.box.markCollectedRevenue([{ key: 'FIXTURE1', day: DAY_B, value: { c: 9, d: 0 } }]);
        const newer = s.box.markCollectedRevenue([{ key: 'FIXTURE1', day: DAY_B, value: { c: 12, d: 0 } }]);
        await queued[0].commit(); await old.server;
        queued[1].reject(new Error('permission_denied: newer fixture')); await newer.server;
        ok('snapshot របស់ការសរសេរជោគជ័យនៅ $9 ក្រោយការបដិសេធថ្មី', s.read(COLLECTED + '/' + DAY_B + '/FIXTURE1/c') === 9 && s.box.dailyCollectedData[DAY_B].FIXTURE1.c === 9, s.box.dailyCollectedData);
    });
    await operationScenario('២៩. ACK ចាស់មិនអាចជាន់ snapshot ថ្មីរបស់ឧបករណ៍ផ្សេង', async () => {
        const s = makeOperationSandbox({ [HISTORY]: {}, [COLLECTED]: { [DAY_B]: { FIXTURE1: { c: 2, d: 0 } } }, [PICKUP]: {} });
        let release;
        const update = s.box.fb.update;
        s.box.fb.update = (ref, values) => { update(ref, values); return new Promise(resolve => { release = resolve; }); };
        const old = s.box.markCollectedRevenue([{ key: 'FIXTURE1', day: DAY_B, value: { c: 9, d: 0 } }]);
        s.write(COLLECTED + '/' + DAY_B + '/FIXTURE1', { c: 21, d: 0 }); s.sync();
        release(); await old.server;
        ok('snapshot $21 នៅដដែលក្រោយ ACK $9 ចាស់', s.read(COLLECTED + '/' + DAY_B + '/FIXTURE1/c') === 21 && s.box.dailyCollectedData[DAY_B].FIXTURE1.c === 21, s.box.dailyCollectedData);
    });
    for (const delay of ['history', 'collected']) {
        await operationScenario('៣០. កែតម្លៃ ហើយឧបករណ៍ទីពីរបើកមុនចម្លើយ — ' + delay, async () => {
            const s = makeOperationSandbox(editFixture());
            let release;
            const transaction = s.box.fb.runTransaction;
            const held = delay === 'collected' ? holdNextCollectedWrite(s) : null;
            if (delay === 'history') s.box.fb.runTransaction = (ref, updater) => {
                const result = transaction(ref, updater);
                return ref.path === HISTORY + '/fixture_item' ? new Promise(resolve => { release = async () => resolve(await result); }) : result;
            };
            editOperation(s, 24.5, 1.75);
            for (let count = 0; !release && count < 30; count++) {
                await operationTicks(1);
                if (held && held.pending) release = held.pending.accept;
            }
            ok('ជាន់អប្បបរមា៖ បានពន្យារផ្លូវកែតម្លៃពិត — ' + delay, !!release);
            if (!release) return;
            const second = makeOperationSandbox(s.server, NOW_B + 1000, s.server);
            await closeOperation(second, 'single', false);
            await release(); await operationTicks();
            ok('ការកែតម្លៃចាស់មិនបង្កើតចំណូលក្រោយបើកវិញ — ' + delay,
                s.read(HISTORY + '/fixture_item/barcodes/0/isClosed') === false && collectedTotal(s.server) === 0, s.read(COLLECTED));
            ok('តម្លៃ និង ledger ថ្ងៃ/ខែនៅតែរក្សាលទ្ធផលកែ $26.25 — ' + delay,
                s.read(HISTORY + '/fixture_item/price') === 26.25 && s.read(DAILY + '/2026-09-09/codDollar') === 24.5
                && s.read(MONTHLY + '/2026-09/dodDollar') === 1.75);
        });
    }
    await operationScenario('៣១. កែតម្លៃពេល listener local ចាស់', async () => {
        const s = makeOperationSandbox(editFixture());
        s.box.scanHistory = [operationItem(12.5, false)];
        s.box.dailyCollectedData = {};
        editOperation(s, 24.5, 1.75); await operationTicks();
        ok('សាលក្រម server បិទ និង record ពិតឈ្នះ listener ចាស់', collectedTotal(s.server) === 26.25, s.read(COLLECTED));
    });
    await operationScenario('៣២. កែតម្លៃក្រោយស្តាររក្សាថ្ងៃយក ហើយមិនបង្កើតប្រវត្តិថ្មី', async () => {
        const initial = editFixture();
        initial[COLLECTED] = { [DAY_A]: { FIXTURE1: { c: 12.5, d: 0.75 } } };
        const s = makeOperationSandbox(initial);
        editOperation(s, 24.5, 1.75); await operationTicks();
        ok('កែតម្លៃរក្សាថ្ងៃយកដើមក្រោយ closedAt ត្រូវ reset ដោយស្តារ',
            s.read(COLLECTED + '/' + DAY_A + '/FIXTURE1/c') === 24.5 && !s.read(COLLECTED + '/' + DAY_B + '/FIXTURE1'), s.read(COLLECTED));
        initial[COLLECTED] = {};
        const missing = makeOperationSandbox(initial);
        editOperation(missing, 24.5, 1.75); await operationTicks();
        ok('កែតម្លៃមិនសាងចំណូលដែលមិនធ្លាប់មាន', collectedTotal(missing.server) === 0, missing.read(COLLECTED));
    });
    for (const failure of ['reject', 'hang']) {
        await operationScenario('៣៣. កែតម្លៃមិនប្រាប់ Sync ជោគជ័យ ខណៈ mirror ធ្លាក់ — ' + failure, async () => {
            const s = makeOperationSandbox(editFixture());
            s.box.DB_OP_TIMEOUT_MS = 10;
            for (const method of ['update', 'runTransaction']) {
                const original = s.box.fb[method];
                s.box.fb[method] = (ref, ...args) => ref.path === COLLECTED || ref.path.startsWith(COLLECTED + '/')
                    ? failure === 'reject' ? Promise.reject(new Error('permission_denied: fixture')) : new Promise(() => {})
                    : original(ref, ...args);
            }
            editOperation(s, 24.5, 1.75); await operationTicks(30);
            ok('history និង ledger រក្សាទុក តែសារមិនអះអាងជោគជ័យគ្រប់ — ' + failure,
                s.read(HISTORY + '/fixture_item/price') === 26.25 && s.read(DAILY + '/2026-09-09/codDollar') === 24.5
                && s.messages.some(message => message.includes('⚠️')) && !s.messages.some(message => message.includes('✅')), s.messages);
        });
    }
    await operationScenario('៣៤. ACK កែតម្លៃក្រោយប្ដូរអាជីវកម្ម មិនអាចសរសេរ mirror ឬបង្ហាញសារថ្មី', async () => {
        const s = makeOperationSandbox(editFixture());
        let release;
        const transaction = s.box.fb.runTransaction;
        s.box.fb.runTransaction = (ref, updater) => {
            const result = transaction(ref, updater);
            return ref.path === HISTORY + '/fixture_item' ? new Promise(resolve => { release = async () => resolve(await result); }) : result;
        };
        editOperation(s, 24.5, 1.75); await operationTicks();
        const before = s.calls.length;
        s.box.authGeneration++; s.box.db = {};
        await release(); await operationTicks();
        ok('callback ចាស់មិនសរសេរ ឬបង្ហាញសារក្នុងអាជីវកម្មថ្មី', s.calls.length === before && s.messages.length === 0,
            { extraWrites: s.calls.length - before, messages: s.messages });
    });
    for (const transition of ['next-day', 'late-restored']) {
        await operationScenario('៣៥. Mirror កែតម្លៃយឺតរក្សាថ្ងៃយកត្រឹមត្រូវ — ' + transition, async () => {
            const initial = editFixture();
            if (transition === 'late-restored') initial[COLLECTED] = { [DAY_A]: { FIXTURE1: { c: 12.5, d: 0.75 } } };
            const s = makeOperationSandbox(initial);
            if (transition === 'late-restored') s.box.DB_OP_TIMEOUT_MS = 10;
            const held = holdNextCollectedWrite(s);
            editOperation(s, 24.5, 1.75);
            for (let count = 0; !held.pending && count < 30; count++) await operationTicks(1);
            ok('ជាន់អប្បបរមា៖ បានពន្យារ mirror កែតម្លៃ — ' + transition, !!held.pending);
            if (!held.pending) return;
            let expectedDay = DAY_A;
            if (transition === 'next-day') {
                const second = makeOperationSandbox(s.server, NOW_B + 86400000, s.server);
                await closeOperation(second, 'single', false); second.sync();
                await closeOperation(second, 'single', true);
                expectedDay = second.box.collectedDayOfStamp(NOW_B + 86400000);
            } else await operationTicks(25);
            await held.pending.accept(); await operationTicks(25);
            ok('ចំណូលនៅតែមួយថ្ងៃ និងរក្សាថ្ងៃដែលបានបញ្ជាក់ — ' + transition,
                collectedTotal(s.server) === 26.25 && s.read(COLLECTED + '/' + expectedDay + '/FIXTURE1/c') === 24.5, s.read(COLLECTED));
        });
    }
    for (const day of ['2026-09-05', '2026-09-06', '2026-09-07']) {
        await operationScenario('៣៦. កែតម្លៃជាប់ cleanup តាមព្រំដែនរក្សាទុក — ' + day, async () => {
            const s = makeOperationSandbox(retentionFixture(day));
            s.box.cleanupClockIsTrustworthy = () => true;
            const held = holdNextCollectedWrite(s);
            editOperation(s, 24.5, 1.75);
            await operationTicks();
            s.box.runAutomaticCollectedCleanup(); await operationTicks();
            const expired = day < '2026-09-06';
            ok('cleanup លុបតែថ្ងៃហួសព្រំដែន មុនដោះសំណើ — ' + day,
                expired ? !s.read(COLLECTED + '/' + day + '/FIXTURE1') : !!s.read(COLLECTED + '/' + day + '/FIXTURE1'), s.read(COLLECTED));
            // កូនសោផ្សេងដែលមកដល់ក្នុងថ្ងៃនៅរក្សាទុក ត្រូវនៅសល់ពេលសំណើចាស់សម្រេច។
            const freshDay = expired ? DAY_B : day;
            await s.box.fb.update(s.box.dbRefDailyCollected, { [freshDay + '/FRESH2']: { c: 3.5, d: 1 } });
            if (held.pending) await held.pending.accept();
            await operationTicks();
            ok('សំណើយឺតមិនបង្កើតថ្ងៃហួសអាយុឡើងវិញ — ' + day,
                expired ? !s.read(COLLECTED + '/' + day + '/FIXTURE1') : s.read(COLLECTED + '/' + day + '/FIXTURE1/c') === 24.5, s.read(COLLECTED));
            ok('កូនសោស្រស់ក្នុងថ្ងៃនៅរក្សាទុកនៅដដែល — ' + day,
                JSON.stringify(s.read(COLLECTED + '/' + freshDay + '/FRESH2')) === JSON.stringify({ c: 3.5, d: 1 }), s.read(COLLECTED));
            ok('ledger ថ្ងៃស្កេន/ខែ និង history រក្សាតម្លៃកែ — ' + day,
                s.read(DAILY + '/2026-09-09/codDollar') === 24.5 && s.read(DAILY + '/2026-09-09/dodDollar') === 1.75 &&
                s.read(MONTHLY + '/2026-09/codDollar') === 24.5 && s.read(MONTHLY + '/2026-09/dodDollar') === 1.75 &&
                s.read(HISTORY + '/fixture_item/barcodes/0/cod') === 24.5 && s.read(HISTORY + '/fixture_item/barcodes/0/isClosed') === true,
                { history: s.read(HISTORY), money: moneySources(s) });
        });
    }
    for (const late of [false, true]) {
        await operationScenario('៣៧. កែតម្លៃឆ្លងអធ្រាត្រ ខណៈ cleanup បានលុបថ្ងៃដើម — ' + late, async () => {
            const day = '2026-09-06';
            let now = Date.UTC(2026, 8, 12, 16, 59, 59);
            const s = makeOperationSandbox(retentionFixture(day), now);
            s.box.getServerNow = () => now;
            s.box.cleanupClockIsTrustworthy = () => true;
            if (late) s.box.DB_OP_TIMEOUT_MS = 10;
            const held = holdNextCollectedWrite(s);
            editOperation(s, 24.5, 1.75);
            for (let index = 0; !held.pending && index < 30; index++) await operationTicks(1);
            ok('ជាន់អប្បបរមា៖ សំណើត្រូវបានទប់ ខណៈថ្ងៃដើមនៅក្នុង retention',
                !!held.pending && s.box.collectedRetentionCutoffKey(now) === day, { held: !!held.pending, cutoff: s.box.collectedRetentionCutoffKey(now) });
            if (!held.pending) return;
            now = Date.UTC(2026, 8, 12, 17, 0, 1);
            s.box.runAutomaticCollectedCleanup(); await operationTicks(late ? 25 : 2);
            ok('ក្រោយអធ្រាត្រ server បានលុបថ្ងៃដែលទើបហួសអាយុ', !s.read(COLLECTED + '/' + day + '/FIXTURE1'), s.read(COLLECTED));
            await s.box.fb.update(s.box.dbRefDailyCollected, { ['2026-09-13/FRESH2']: { c: 3.5, d: 1 } });
            await held.pending.accept(); await operationTicks(25);
            ok('សំណើដែលគណនាមុនអធ្រាត្រមិនបង្កើតថ្ងៃចាស់វិញ',
                !s.read(COLLECTED + '/' + day + '/FIXTURE1') && collectedTotal(s.server) === 4.5, s.read(COLLECTED));
            ok('cleanup និងសំណើយឺតមិនដក ledger ថ្ងៃស្កេន/ខែ',
                s.read(DAILY + '/2026-09-09/codDollar') === 24.5 && s.read(MONTHLY + '/2026-09/dodDollar') === 1.75,
                moneySources(s));
        });
    }
    await operationScenario('៣៨. cleanup យឺតមិនលុបកូនសោថ្មីក្នុងថ្ងៃដែលនៅរក្សាទុក', async () => {
        const initial = retentionFixture('2026-09-05');
        initial[COLLECTED]['2026-09-06'] = { KEEP1: { c: 6, d: 0.5 } };
        initial[COLLECTED]['មិនមែនថ្ងៃ'] = { META: { c: 0, d: 0 } };
        const s = makeOperationSandbox(initial);
        s.box.cleanupClockIsTrustworthy = () => true;
        const beforeMoney = moneySources(s);
        const held = holdNextCollectedWrite(s);
        s.box.runAutomaticCollectedCleanup(); await operationTicks(2);
        ok('ជាន់អប្បបរមា៖ បានទប់សំណើ cleanup ពិត', !!held.pending);
        if (!held.pending) return;
        await s.box.fb.update(s.box.dbRefDailyCollected, { ['2026-09-06/FRESH2']: { c: 3.5, d: 1 } });
        await held.pending.accept(); await operationTicks();
        ok('ថ្ងៃហួសអាយុបាត់ ប៉ុន្តែកូនសោដើម/ថ្មីក្នុងថ្ងៃព្រំដែន និង metadata នៅសល់',
            !s.read(COLLECTED + '/2026-09-05/FIXTURE1') &&
            s.read(COLLECTED + '/2026-09-06/KEEP1/c') === 6 && s.read(COLLECTED + '/2026-09-06/FRESH2/c') === 3.5 &&
            s.read(COLLECTED + '/មិនមែនថ្ងៃ/META') !== null, s.read(COLLECTED));
        ok('cleanup មិនកែ ledger ឬ pickup', JSON.stringify(moneySources(s)) === JSON.stringify(beforeMoney), moneySources(s));
    });
    for (const late of [false, true]) {
        await operationScenario('៣៩. cleanup ត្រូវបដិសេធ ហើយអាចសាកឡើងវិញ — ' + late, async () => {
            const s = makeOperationSandbox(retentionFixture('2026-09-05'));
            s.box.cleanupClockIsTrustworthy = () => true;
            if (late) s.box.DB_OP_TIMEOUT_MS = 10;
            const beforeMoney = moneySources(s);
            const held = holdNextCollectedWrite(s);
            s.box.runAutomaticCollectedCleanup(); await operationTicks(late ? 25 : 2);
            ok('ជាន់អប្បបរមា៖ cleanup ត្រូវបានទប់មុនបដិសេធ', !!held.pending);
            if (!held.pending) return;
            held.pending.reject(); await operationTicks();
            ok('បដិសេធមិនលុប server ហើយ snapshot rollback នៅដដែល',
                s.read(COLLECTED + '/2026-09-05/FIXTURE1/c') === 12.5 && s.box.dailyCollectedData['2026-09-05'].FIXTURE1.c === 12.5,
                { server: s.read(COLLECTED), local: s.box.dailyCollectedData });
            s.box.runAutomaticCollectedCleanup(); await operationTicks();
            ok('សាកឡើងវិញអាចលុបថ្ងៃចាស់ ដោយមិនកែ ledger/pickup',
                !s.read(COLLECTED + '/2026-09-05/FIXTURE1') && JSON.stringify(moneySources(s)) === JSON.stringify(beforeMoney),
                { collected: s.read(COLLECTED), money: moneySources(s) });
        });
    }
    for (const change of ['auth', 'database']) {
        await operationScenario('៤០. cleanup ដែលបដិសេធក្រោយប្ដូរ session — ' + change, async () => {
            const s = makeOperationSandbox(retentionFixture('2026-09-05'));
            s.box.cleanupClockIsTrustworthy = () => true;
            const reports = [];
            s.box.ZoeErrors = { capture: (error, context) => reports.push(context) };
            const held = holdNextCollectedWrite(s);
            s.box.runAutomaticCollectedCleanup(); await operationTicks(2);
            ok('ជាន់អប្បបរមា៖ cleanup បានចាប់ផ្ដើមក្នុង session ចាស់', !!held.pending);
            if (!held.pending) return;
            if (change === 'auth') s.box.authGeneration++;
            else s.box.db = {};
            const before = s.calls.length;
            held.pending.reject(); await operationTicks();
            ok('callback ចាស់មិនសរសេរ ឬបញ្ចេញសារ/error report ក្នុង session ថ្មី',
                s.calls.length === before && s.messages.length === 0 && reports.length === 0,
                { writes: s.calls.length - before, messages: s.messages, reports });
        });
    }
    for (const gate of ['clock', 'listener']) {
        await operationScenario('៤១. មិនដាក់ការផុតអាយុថ្មី បើ cleanup មិនបានលុបពិត — ' + gate, async () => {
            const s = makeOperationSandbox(retentionFixture('2026-09-05'));
            s.box.cleanupClockIsTrustworthy = () => gate !== 'clock';
            if (gate === 'listener') s.box.dbListenerFailedPaths.add(s.box.DB_LISTENER_KEY_DAILY_COLLECTED);
            s.box.runAutomaticCollectedCleanup(); await operationTicks(2);
            editOperation(s, 24.5, 1.75); await operationTicks();
            ok('កែតម្លៃកំណត់ត្រាដែលនៅមាន ដោយមិនលុបតាមអាយុនៅក្នុងផ្លូវកែតម្លៃ — ' + gate,
                s.read(COLLECTED + '/2026-09-05/FIXTURE1/c') === 24.5 && collectedTotal(s.server) === 26.25, s.read(COLLECTED));
        });
    }
    await operationScenario('៤២. កែតម្លៃលើ key ស្ទួន រក្សាថ្ងៃថ្មីបំផុត និងកូនសោផ្សេងទាំងអស់', async () => {
        const initial = editFixture();
        initial[COLLECTED][DAY_A] = { FIXTURE1: { c: 7, d: 0.5 }, OLDER2: { c: 2, d: 0.25 } };
        initial[COLLECTED][DAY_B].FRESH2 = { c: 3.5, d: 1 };
        const s = makeOperationSandbox(initial);
        editOperation(s, 24.5, 1.75); await operationTicks();
        ok('barcode នៅតែថ្ងៃថ្មីបំផុត ដោយមិនរាប់ប្រាក់ស្ទួន',
            !s.read(COLLECTED + '/' + DAY_A + '/FIXTURE1') && s.read(COLLECTED + '/' + DAY_B + '/FIXTURE1/c') === 24.5 && collectedTotal(s.server) === 33,
            s.read(COLLECTED));
        ok('កូនសោផ្សេងទាំងថ្ងៃដើម និងថ្ងៃថ្មីនៅតម្លៃដដែល',
            s.read(COLLECTED + '/' + DAY_A + '/OLDER2/c') === 2 && s.read(COLLECTED + '/' + DAY_B + '/FRESH2/c') === 3.5,
            s.read(COLLECTED));
    });
    await operationScenario('៤៣. cleanup ក្នុង SDK ដដែលបោះបង់ price transaction ដោយ Error(set)', async () => {
        const initial = editFixture();
        initial[COLLECTED]['2026-09-05'] = { EXPIRED2: { c: 3.5, d: 1 } };
        const s = makeOperationSandbox(initial);
        s.box.cleanupClockIsTrustworthy = () => true;
        const held = holdNextCollectedWrite(s);
        editOperation(s, 24.5, 1.75);
        for (let index = 0; !held.pending && index < 30; index++) await operationTicks(1);
        ok('ជាន់អប្បបរមា៖ ការកែតម្លៃពិតកំពុងរង់ចាំមុន cleanup', !!held.pending);
        if (!held.pending) return;
        s.box.runAutomaticCollectedCleanup(); await operationTicks(2);
        // Native SDK បោះ Error("set") គ្មាន code សម្រាប់ transaction ប៉ុណ្ណោះ។
        if (held.pending.method === 'runTransaction') held.pending.reject(new Error('set'));
        else await held.pending.accept();
        await operationTicks();
        ok('បន្ទាប់ពី cleanup អាចកែតម្លៃថ្ងៃនៅរក្សាទុក ដោយមិនរស់ថ្ងៃចាស់ឡើងវិញ',
            !s.read(COLLECTED + '/2026-09-05/EXPIRED2') && s.read(COLLECTED + '/' + DAY_B + '/FIXTURE1/c') === 24.5 &&
            s.read(COLLECTED + '/' + DAY_B + '/FIXTURE1/d') === 1.75 && s.messages.some(message => message.includes('✅')),
            { collected: s.read(COLLECTED), messages: s.messages });
        ok('ការសាក CAS ឡើងវិញមិនកែ ledger ពីរដង',
            s.read(DAILY + '/2026-09-09/codDollar') === 24.5 && s.read(MONTHLY + '/2026-09/dodDollar') === 1.75,
            moneySources(s));
    });
    await operationScenario('៤៤. Error(set) ជាប់ៗគ្នាមានព្រំដែន ហើយមិនប្រាប់ Sync ជោគជ័យ', async () => {
        const s = makeOperationSandbox(editFixture());
        const transaction = s.box.fb.runTransaction;
        let attempts = 0;
        s.box.fb.runTransaction = (ref, ...args) => {
            if (ref.path !== COLLECTED) return transaction(ref, ...args);
            attempts++;
            return Promise.reject(new Error('set'));
        };
        editOperation(s, 24.5, 1.75); await operationTicks();
        ok('ការប៉ុនប៉ង transaction មិនលើស ៣ និងមិនអះអាងថា Sync រួចពេលទាំងអស់ធ្លាក់',
            attempts === 0 ? collectedTotal(s.server) === 26.25 : attempts <= 3 &&
                s.messages.some(message => message.includes('⚠️')) && !s.messages.some(message => message.includes('✅')),
            { attempts, messages: s.messages });
        ok('ការបដិសេធ CAS មិនដកតម្លៃដែល history/ledger បានរក្សាទុក',
            s.read(HISTORY + '/fixture_item/price') === 26.25 && s.read(DAILY + '/2026-09-09/codDollar') === 24.5,
            { history: s.read(HISTORY), money: moneySources(s) });
    });
    for (const change of ['auth', 'database']) {
        await operationScenario('៤៥. Error(set) ក្រោយប្ដូរ session មិនបើកការសាកឡើងវិញ — ' + change, async () => {
            const s = makeOperationSandbox(editFixture());
            const held = holdNextCollectedWrite(s);
            editOperation(s, 24.5, 1.75);
            for (let index = 0; !held.pending && index < 30; index++) await operationTicks(1);
            ok('ជាន់អប្បបរមា៖ price mirror កំពុងរង់ចាំក្នុង session ចាស់', !!held.pending);
            if (!held.pending) return;
            if (change === 'auth') s.box.authGeneration++;
            else s.box.db = {};
            const before = s.calls.length;
            const acceptedWrite = held.pending.method === 'update' ? 1 : 0;
            const priorMessages = s.messages.length;
            if (held.pending.method === 'runTransaction') held.pending.reject(new Error('set'));
            else await held.pending.accept();
            await operationTicks();
            ok('មិនមានការសាកសរសេរថ្មី ឬសារក្នុង session ថ្មី',
                s.calls.length === before + acceptedWrite && s.messages.length === priorMessages,
                { extraWrites: s.calls.length - before - acceptedWrite, messages: s.messages.slice(priorMessages) });
        });
    }
    console.log('');
    if (fail) { console.log('❌ ធ្លាក់ ' + fail + '  (ok ' + pass + ')'); process.exitCode = 1; }
    else { console.log('✅ ចំណូលប្រចាំថ្ងៃ — ok ' + pass); process.exitCode = 0; }
})().catch(error => { console.error(error); process.exitCode = 1; });
