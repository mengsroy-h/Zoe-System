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
    'collectedDayHoldingKey', 'collectedMarksFor', 'collectItemCollectedMarks',
    'collectedPreviousValue', 'applyCollectedMarksInMemory', 'commitCollectedMarks',
    'markCollectedRevenue', 'revertCollectedMarks', 'syncCollectedValueForBarcode',
    'collectedTotalsOfDay', 'collectedRetentionCutoffKey', 'staleCollectedDays',
    'runAutomaticCollectedCleanup', 'openCollectedStatsModal', 'buildCollectedCardItem',
    'statsMoney', 'statsPositive', 'ledgerNumber', 'pickupBarcodeKey', 'barcodeRegistryKey', 'getZoneDateKey',
    'appZoneParts', 'appZoneWallClockToMillis', 'sanitizeInput', 'emptyViewMessage',
    'dbListenerViewIsStale', 'anyDbListenerViewIsStale'];
const missing = WANT.filter((n) => !sliceFn(SRC, n));
const bodies = WANT.map((n) => sliceFn(SRC, n) || ('function ' + n + '() { return undefined; }')).join('\n');
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
        db: {}, dbRefDailyCollected: { __ref: NODE },
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
                Object.keys(payload).forEach((k) => { if (payload[k] === null) delete server[k]; });
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
    ok('សរសេរទៅ node ថ្ងៃនោះតែមួយ',
        s.__calls.tx.length === 1 && s.__calls.tx[0].day === DAY_B, s.__calls.tx);
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
        !/\+=|\-=/.test(sliceFn(SRC, 'commitCollectedMarks') || '')
        && !/\+=|\-=/.test(sliceFn(SRC, 'applyCollectedMarksInMemory') || ''), true);
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
    s.markCollectedRevenue(s.collectItemCollectedMarks(item, true, [undefined, undefined]));
    ok('កញ្ចប់ ២ ចុះលើថ្ងៃដដែល',
        s.collectedTotalsOfDay(s.__server[DAY_B]).count === 2, s.__server[DAY_B]);
    ok('សរុប $9.00', s.collectedTotalsOfDay(s.__server[DAY_B]).total === 9, s.__server[DAY_B]);
    const openItem = { barcodes: [bc('77130500000001', 5, 0), bc('77130500000002', 3, 1)] };
    s.markCollectedRevenue(s.collectItemCollectedMarks(openItem, false, [NOW_B, NOW_B]));
    ok('⛔ បើកកញ្ចប់ទាំងមូល ➜ ថ្ងៃនោះទទេវិញ', s.__server[DAY_B] === undefined, s.__server);
});

scenario('៧. ⛔ ការបញ្ច្រាស (transaction ធ្លាក់) ➜ ត្រឡប់តម្លៃដើមវិញ', () => {
    const s = makeSandbox({ now: NOW_B, local: { [DAY_B]: { '77130500000001': { c: 2, d: 0 } } },
        server: { [DAY_B]: { '77130500000001': { c: 2, d: 0 } } } });
    const applied = s.markCollectedRevenue(s.collectedMarksFor(bc('77130500000001', 9, 0, NOW_B), true, NOW_B));
    ok('⛔ ជាន់អប្បបរមា ៖ តម្លៃថ្មីចុះពិត',
        s.collectedTotalsOfDay(s.__server[DAY_B]).total === 9, s.__server[DAY_B]);
    s.revertCollectedMarks(applied);
    ok('⛔ ការបញ្ច្រាសត្រឡប់ទៅ $2.00 វិញ (មិនមែនលុបចោល)',
        s.collectedTotalsOfDay(s.__server[DAY_B]).total === 2, s.__server[DAY_B]);
    const s2 = makeSandbox({ now: NOW_B });
    const applied2 = s2.markCollectedRevenue(s2.collectedMarksFor(bc('77130500000001', 9, 0, NOW_B), true, undefined));
    s2.revertCollectedMarks(applied2);
    ok('⛔ ធាតុដែលមិនធ្លាប់មាន ➜ ការបញ្ច្រាសលុបវាចោល',
        s2.__server[DAY_B] === undefined, s2.__server);
});

scenario('៨. ⛔ ការកែទឹកប្រាក់ ៖ ធ្វើឲ្យស៊ីគ្នា តែ **មិនអាចបង្កើត** ធាតុថ្មី', () => {
    const s = makeSandbox({ now: NOW_B,
        local: { [DAY_B]: { '77130500000001': { c: 5, d: 0 } } },
        server: { [DAY_B]: { '77130500000001': { c: 5, d: 0 } } },
        scanHistory: [{ id: 'i1', barcodes: [bc('77130500000001', 8.25, 0, NOW_B)] }] });
    s.syncCollectedValueForBarcode('i1', '77130500000001');
    ok('តម្លៃថ្មីជំនួសតម្លៃចាស់ ក្នុងថ្ងៃដដែល',
        s.collectedTotalsOfDay(s.__server[DAY_B]).total === 8.25, s.__server[DAY_B]);
    const s2 = makeSandbox({ now: NOW_B,
        scanHistory: [{ id: 'i1', barcodes: [bc('77130500000001', 8.25, 0, NOW_B)] }] });
    s2.syncCollectedValueForBarcode('i1', '77130500000001');
    ok('⛔ គ្មានធាតុស្រាប់ ➜ **មិនសរសេរអ្វីទាំងអស់** (មិនអាចបង្កើតលុយ)',
        s2.__calls.tx.length === 0 && Object.keys(s2.__server).length === 0, s2.__server);
    const s3 = makeSandbox({ now: NOW_B,
        local: { [DAY_B]: { '77130500000001': { c: 5, d: 0 } } },
        server: { [DAY_B]: { '77130500000001': { c: 5, d: 0 } } },
        scanHistory: [{ id: 'i1', barcodes: [bc('77130500000001', 8.25, 0)] }] });
    s3.syncCollectedValueForBarcode('i1', '77130500000001');
    ok('⛔ ទិសផ្ទុយ ៖ barcode ដែល **បើក** ➜ មិនប៉ះ',
        s3.collectedTotalsOfDay(s3.__server[DAY_B]).total === 5, s3.__server[DAY_B]);
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
    const FNS = ['collectedMarksFor', 'collectItemCollectedMarks', 'markCollectedRevenue',
        'commitCollectedMarks', 'applyCollectedMarksInMemory', 'revertCollectedMarks',
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

console.log('');
if (fail) { console.log('❌ ធ្លាក់ ' + fail + '  (ok ' + pass + ')'); process.exit(1); }
console.log('✅ ចំណូលប្រចាំថ្ងៃ — ok ' + pass);
