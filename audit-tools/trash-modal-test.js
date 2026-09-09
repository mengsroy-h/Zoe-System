// ធុងសំរាម (កំណែ 2.17.0) — ស្រង់ **កូដពិត** ចេញពី ZoeW/app.js រួចរត់ក្នុង vm។
//
// ថ្នាក់កំហុសដែលឯកសារនេះចាក់សោ៖
//   ១. ការចាត់ថ្នាក់ `trashReason` ខុស ➜ កញ្ចប់ដែល «ដករួចពីស្ថិតិ» ធ្លាក់ចូល
//      ក្រុម «មិនប៉ះស្ថិតិ» ➜ អ្នកប្រើអានតួលេខសរុបខុស ហើយសម្រេចលើលុយខុស។
//   ២. ការ merge ជាន់គ្នាឆ្លងប្រភេទ ➜ «ដក» លាយនឹង «លុប» ក្នុងជួរតែមួយ។
//   ៣. ការ merge ធ្វើឲ្យធាតុ **បាត់** ➜ ធាតុដែលមិនអាចស្តារបានទៀត។
//   ៤. ផ្លូវសរសេរណាមួយភ្លេចដាក់ `trashReason` ➜ fallback ចាត់វាខុសថ្នាក់។
//   ៥. ផ្លូវស្តារភ្លេចលុប `trashReason` ➜ `$other: .validate false` បដិសេធ
//      ការសរសេរទៅ scan_history ➜ ការស្តារបរាជ័យទាំងស្រុងលើផលិតកម្ម។
//   ៦. រយៈពេលរក្សាទុកត្រឡប់ទៅ ១០ ថ្ងៃវិញ។
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = process.env.TRASH_APP_DIR || path.join(__dirname, '..');
let pass = 0, fail = 0;
function ok(cond, label, got) {
    if (cond) { pass++; console.log('   ok    ' + label); }
    else { fail++; console.log('   FAIL  ' + label + (got !== undefined ? '  ➜ ' + JSON.stringify(got) : '')); }
}

function sliceFn(src, name) {
    const start = src.indexOf('function ' + name + '(');
    if (start === -1) return '';
    let depth = 0, i = src.indexOf('{', start), started = false;
    for (; i < src.length; i++) {
        if (src[i] === '{') { depth++; started = true; }
        else if (src[i] === '}') { depth--; if (started && depth === 0) { i++; break; } }
    }
    return src.slice(start, i);
}

function sliceConst(src, name) {
    const re = new RegExp('^ *const ' + name + ' = \\{', 'm');
    const m = re.exec(src);
    if (!m) return '';
    const start = m.index;
    let depth = 0, i = src.indexOf('{', start), started = false;
    for (; i < src.length; i++) {
        if (src[i] === '{') { depth++; started = true; }
        else if (src[i] === '}') { depth--; if (started && depth === 0) { i++; break; } }
    }
    while (i < src.length && src[i] !== '\n') i++;
    return src.slice(start, i);
}

const src = fs.readFileSync(path.join(ROOT, 'ZoeW', 'app.js'), 'utf8').replace(/\r\n?/g, '\n');

// ================= ១. ការស្កេនស្តាទិច — ផ្លូវសរសេរត្រូវដាក់ស្លាក =================
console.log('\n=== ផ្លូវសរសេរធុងសំរាមទាំង ៥ ត្រូវដាក់ `trashReason` ===');

const WRITE_PATHS = [
    { fn: 'removeSingleBarcode', reason: 'remove', why: 'ដក barcode តែមួយ ➜ ដកលុយចេញពីស្ថិតិ' },
    { fn: 'deleteSingleItem', reason: 'delete', why: 'លុបទាំងមូល ➜ មិនប៉ះស្ថិតិ' },
    { fn: 'buildClearHistoryTrashItem', reason: 'delete', why: 'លុបទាំងអស់ ➜ មិនប៉ះស្ថិតិ' }
];
WRITE_PATHS.forEach((p) => {
    const body = sliceFn(src, p.fn);
    ok(!!body, p.fn + ' មានក្នុង app.js');
    ok(body.indexOf("trashReason = '" + p.reason + "'") !== -1,
        p.fn + " ដាក់ trashReason = '" + p.reason + "' (" + p.why + ')');
});

// `claimAndCleanupItem` មានផ្លូវ ៣ ក្នុង function តែមួយ
const claimBody = sliceFn(src, 'claimAndCleanupItem');
ok(!!claimBody, 'claimAndCleanupItem មានក្នុង app.js');
const expiredHits = (claimBody.match(/trashReason = 'expired'/g) || []).length;
ok(expiredHits === 2,
    "claimAndCleanupItem ដាក់ 'expired' ទាំងផ្លូវ partial និងផ្លូវ whole (៨ ថ្ងៃ)", expiredHits);
const pickupHits = (claimBody.match(/trashReason = 'pickup'/g) || []).length;
ok(pickupHits === 2,
    "claimAndCleanupItem ដាក់ 'pickup' ទាំងផ្លូវ partial (barcode បិទរួច ២ ម៉ោង) និងផ្លូវ whole", pickupHits);

// ផ្លូវស្តារត្រូវលុបវាលចេញ មុនសរសេរទៅ scan_history
const restoreBody = sliceFn(src, 'executeRestoreItem');
ok(restoreBody.indexOf('delete itemToRestore.trashReason') !== -1,
    'executeRestoreItem លុប trashReason មុនសរសេរត្រឡប់ចូល scan_history');

// រយៈពេលរក្សាទុក
const EXPIRED_RETENTION_DAYS = 2;
const RETENTION_DAYS = 30;
const KHMER_DIGITS = '\u17E0\u17E1\u17E2\u17E3\u17E4\u17E5\u17E6\u17E7\u17E8\u17E9';
const khmerNum = (n) => String(n).split('').map((d) => KHMER_DIGITS[Number(d)]).join('');
const retention = /const TRASH_RETENTION_MS = (\d+) \* 24 \* 60 \* 60 \* 1000;/.exec(src);
ok(!!retention && Number(retention[1]) === RETENTION_DAYS,
    'ធុងសំរាមរក្សាទុក ' + khmerNum(RETENTION_DAYS) + ' ថ្ងៃ (TRASH_RETENTION_MS)', retention && retention[1]);
const expiredRetention = /const EXPIRED_TRASH_RETENTION_MS = (\d+) \* 24 \* 60 \* 60 \* 1000;/.exec(src);
ok(!!expiredRetention && Number(expiredRetention[1]) === EXPIRED_RETENTION_DAYS,
    'expired រក្សាទុក ' + khmerNum(EXPIRED_RETENTION_DAYS) + ' ថ្ងៃ', expiredRetention && expiredRetention[1]);
const retentionFn = sliceFn(src, 'trashRetentionMs');
ok(retentionFn.indexOf("trashReason === 'expired'") !== -1 &&
    retentionFn.indexOf('EXPIRED_TRASH_RETENTION_MS') !== -1 &&
    retentionFn.indexOf('TRASH_RETENTION_MS') !== -1,
    'trashRetentionMs បែងចែក expired ២ថ្ងៃ និងប្រភេទផ្សេង ៣០ថ្ងៃ');
ok(sliceFn(src, 'runAutomaticDeletedCleanup').indexOf('trashRetentionMs(item)') !== -1,
    'runAutomaticDeletedCleanup ប្រើ retention តាមប្រភេទ');

// អត្ថបទដែលអ្នកប្រើអាន ត្រូវត្រូវនឹងលេខថេរ — បើឃ្លាតគ្នា អ្នកប្រើរង់ចាំខុសថ្ងៃ
const retentionLabel = khmerNum(RETENTION_DAYS) + ' \u1790\u17d2\u1784\u17c3';
const expiredRetentionLabel = khmerNum(EXPIRED_RETENTION_DAYS) + ' \u1790\u17d2\u1784\u17c3';
// ⛔ ចំនួនថ្ងៃលើស្លាក ត្រូវ **ដេរីវេចេញពីថេរ** មិនមែនសរសេរដៃ។
//    ជំនាន់មុនចាក់លេខ ៨ ទុកជា literal ➜ **គ្មានការចងភ្ជាប់សោះ**៖ ការប្តូរថេរ
//    ទៅ ១០ ថ្ងៃ នឹងទុកស្លាកនៅ ៨ថ្ងៃ ដោយគ្មាន checker ណាធ្លាក់។
//    ⛔ ការចងភ្ជាប់ជា **ថ្ងៃលំដាប់ = រយៈពេល + ១** ដោយចេតនា ៖ ការប្រៀបធៀបជា
//    `> ABANDON_AGE_MS` (មិនមែន `>=`) ➜ នៅ ៧×២៤ ម៉ោងគត់ **មិនទាន់ដក** ➜
//    ការដកកើតឡើង **ចូលថ្ងៃទី ៨**។ វាស់រួចក្នុង `partial-pickup-cleanup-test.js`
//    (សេណារីយ៉ូ ២ ៖ `T0 + 7*DAY` ➜ ធុងសំរាមទទេ; `+ 60000` ➜ ចូលធុងសំរាម)។
//    ⛔ កុំ «កែ» ស្លាកទៅ ៧ថ្ងៃ — នោះនឹងអះអាងថាកញ្ចប់ផុតកំណត់នៅ ៧ ថ្ងៃគត់
//    ដែល **មិនពិត** (សេចក្តីបញ្ជាក់របស់អ្នកប្រើ 2026-09-01)។
const abandonConst = /const ABANDON_AGE_MS = (\d+) \* 24 \* 60 \* 60 \* 1000;/.exec(src);
ok(!!abandonConst, 'រកឃើញថេរ ABANDON_AGE_MS');
const ABANDON_DAYS = abandonConst ? Number(abandonConst[1]) : 0;
ok(ABANDON_DAYS > 0 && ABANDON_DAYS < 60, 'ច្បាប់បោះបង់ក្នុងជួរសមហេតុផល', ABANDON_DAYS);
const cleanupFn = sliceFn(src, 'runAutomaticCleanupRules');
ok(cleanupFn.indexOf('> ABANDON_AGE_MS') !== -1 && cleanupFn.indexOf('>= ABANDON_AGE_MS') === -1,
    '⛔ ការប្រៀបធៀបជា `>` ➜ ៧ថ្ងៃគត់មិនទាន់ដក ➜ ស្លាកត្រូវជាថ្ងៃលំដាប់ទី ' + (ABANDON_DAYS + 1));
const ABANDON_LABEL_DAY = ABANDON_DAYS + 1;
const abandonLabel = '\u1795\u17bb\u178f\u1780\u17c6\u178e\u178f\u17cb ' + khmerNum(ABANDON_LABEL_DAY) + '\u1790\u17d2\u1784\u17c3\u17d6 ';
const indexHtml = fs.readFileSync(path.join(ROOT, 'ZoeW', 'index.html'), 'utf8');
const trashModalHtml = indexHtml.slice(indexHtml.indexOf('id="recentlyDeletedModal"'));
ok(trashModalHtml.indexOf(abandonLabel + expiredRetentionLabel) !== -1 &&
    trashModalHtml.indexOf('\u1794\u17d2\u179a\u1797\u17c1\u1791\u1795\u17d2\u179f\u17c1\u1784\u17d6 ' + retentionLabel) !== -1,
    'ចំណងជើងធុងសំរាមបង្ហាញថ្ងៃលំដាប់ដែលដេរីវេពីថេរ', { ABANDON_DAYS, ABANDON_LABEL_DAY });
const trashRowsFn = sliceFn(src, 'renderRecentlyDeleted');
ok(trashRowsFn.indexOf(expiredRetentionLabel) !== -1 && trashRowsFn.indexOf(retentionLabel) !== -1,
    'សារ «ជួរទៀត» បង្ហាញ retention ទាំង ២ និង ៣០ថ្ងៃ');
ok(trashRowsFn.indexOf(abandonLabel) !== -1,
    '⛔ សារ «ជួរទៀត» ប្រើថ្ងៃលំដាប់ដែលដេរីវេពីថេរ', { ABANDON_DAYS, ABANDON_LABEL_DAY });
// ⛔ គ្មានចំនួនថ្ងៃ **ចាស់** សល់ក្នុងអត្ថបទដែលអ្នកប្រើអាន — ស្កេនទាំង ២ ទម្រង់
//    (មានចន្លោះ «៨ ថ្ងៃ» និងគ្មានចន្លោះ «៨ថ្ងៃ»)។ ជំនាន់មុនស្កេនតែទម្រង់ដែល
//    មានចន្លោះ ➜ «៨ថ្ងៃ» រអិលកាត់ទាំងស្រុង។
[['index.html', trashModalHtml], ['renderRecentlyDeleted', trashRowsFn]].forEach(([where, text]) => {
    const days = Array.from(text.matchAll(new RegExp('([' + KHMER_DIGITS + ']+)\\s*\\u1790\\u17d2\\u1784\\u17c3', 'g')))
        .map((m) => m[1]);
    const allowed = [khmerNum(ABANDON_LABEL_DAY), khmerNum(EXPIRED_RETENTION_DAYS), khmerNum(RETENTION_DAYS)];
    ok(days.length > 0 && days.every((d) => allowed.indexOf(d) !== -1),
        '⛔ គ្មានចំនួនថ្ងៃចាស់សល់ក្នុង ' + where, days);
});

// rules ត្រូវទទួលវាលនេះ បើអត់ ការសរសេរទៅធុងសំរាមត្រូវបដិសេធទាំងស្រុង
const rules = JSON.parse(fs.readFileSync(path.join(ROOT, 'firebase-database.rules.json'), 'utf8'));
const trashRule = rules.rules.zoew_recently_deleted_cod_dod.$itemId;
ok(!!trashRule.trashReason && typeof trashRule.trashReason['.validate'] === 'string',
    'firebase rules ទទួលវាល trashReason ក្នុង zoew_recently_deleted_cod_dod');
ok(!!trashRule.trashReason && ['delete', 'remove', 'expired', 'pickup']
        .every((r) => trashRule.trashReason['.validate'].indexOf("'" + r + "'") !== -1),
    'rules ចាក់សោតម្លៃត្រឹមតែ ៤ ប្រភេទដែលកូដសរសេរ');
ok(!rules.rules.zoew_scan_history_cod_dod.$itemId.trashReason,
    'scan_history **មិន** ទទួល trashReason (វាជាវាលរបស់ធុងសំរាមតែប៉ុណ្ណោះ)');

// ================= ២. រត់កូដពិតក្នុង vm =================
console.log('\n=== ការចាត់ថ្នាក់ · ការ merge · តួលេខសរុប (កូដពិតក្នុង vm) ===');

const ctx = {
    console,
    Map, Set, Math, JSON, Number, String, Array, Object, parseFloat, isNaN,
    document: { getElementById: () => null },
    sanitizeInput: (v) => String(v === undefined || v === null ? '' : v),
    exchangeRateRiel: 4100
};
vm.createContext(ctx);
[sliceConst(src, 'TRASH_REASON_META'),
 sliceFn(src, 'barcodeEntriesOf'),
 sliceFn(src, 'trashReasonOf'),
 sliceFn(src, 'trashItemTotals'),
 sliceFn(src, 'trashItemCodes'),
 sliceFn(src, 'trashGroupKeyOf'),
 sliceFn(src, 'buildTrashGroups'),
 sliceFn(src, 'trashGroupMatchesQuery'),
 sliceFn(src, 'trashSummaryCardHtml'),
 sliceFn(src, 'renderTrashSummary')].forEach((code, i) => {
    if (!code) { ok(false, 'ស្រង់កូដពិតបានលេខ ' + i); return; }
    vm.runInContext(code, ctx);
});
// ⚠️ អថេរ `const` កម្រិត module **មិនក្លាយជា property នៃ context** ➜ ត្រូវអានតាម expression
let META = null;
try { META = vm.runInContext('TRASH_REASON_META', ctx); } catch (e) { META = null; }
ok(typeof ctx.buildTrashGroups === 'function' && typeof ctx.trashReasonOf === 'function' && !!META,
    'ស្រង់ TRASH_REASON_META និង function ទាំង ៦ ចេញពី app.js បានគ្រប់');
if (!META || typeof ctx.buildTrashGroups !== 'function') {
    console.log('\n❌ ធ្លាក់ ' + fail + ' (ជោគជ័យ ' + pass + ') — ស្រង់កូដធុងសំរាមមិនបាន');
    process.exit(1);
}

// ---- ការចាត់ថ្នាក់ ----
const CLASSIFY = [
    { item: { trashReason: 'remove', isFromDeletion: false }, want: 'remove', why: 'ស្លាកច្បាស់លាស់ឈ្នះ' },
    { item: { trashReason: 'expired', isFromDeletion: false }, want: 'expired' },
    { item: { trashReason: 'pickup', isFromDeletion: true, isClosed: true }, want: 'pickup' },
    { item: { trashReason: 'delete', isFromDeletion: true }, want: 'delete' },
    { item: { trashReason: 'nonsense', isFromDeletion: true }, want: 'delete', why: 'តម្លៃមិនស្គាល់ ➜ ថយទៅ fallback' },
    { item: { isFromDeletion: true, isClosed: true }, want: 'pickup', why: 'legacy បិទរួច' },
    { item: { isFromDeletion: true, isClosed: false }, want: 'delete', why: 'legacy លុប' },
    { item: { isFromDeletion: false }, want: 'remove', why: 'legacy ដក' }
];
CLASSIFY.forEach((c) => {
    const got = ctx.trashReasonOf(c.item);
    ok(got === c.want, 'trashReasonOf ➜ ' + c.want + (c.why ? ' (' + c.why + ')' : ''), got);
});

// **ចំណុចសំខាន់បំផុត**៖ ក្រុមលុយត្រូវត្រូវនឹងអ្វីដែលកូដចំណូលពិតធ្វើ
ok(META.remove.deducted === true && META.expired.deducted === true,
    "'remove' និង 'expired' ជាប់ក្រុម **ដករួចពីស្ថិតិ**");
ok(META.pickup.deducted === false && META.delete.deducted === false,
    "'pickup' និង 'delete' ជាប់ក្រុម **មិនប៉ះស្ថិតិ**");

// ---- ការ merge ----
const bc = (code, cod, dod) => ({ code, cod, dod, isClosed: false, isDeducted: true, isFromDeletion: false });
const mk = (id, phone, date, time, reason, barcodes) => ({
    id, phone, scanDate: date, time, trashReason: reason,
    isFromDeletion: reason === 'delete' || reason === 'pickup',
    isClosed: reason === 'pickup', barcodes,
    cod: barcodes.reduce((s, b) => s + b.cod, 0), dod: barcodes.reduce((s, b) => s + b.dod, 0),
    count: barcodes.length, deletedAt: 1000
});

const items = [
    mk('t1', '077', '2026-08-25', '09:12', 'remove', [bc('A1', 6.5, 0)]),
    mk('t2', '077', '2026-08-25', '09:12', 'remove', [bc('A2', 11.75, 0)]),
    mk('t3', '077', '2026-08-25', '09:12', 'remove', [bc('A3', 4, 2)]),
    // ម៉ោងខុស ➜ មិន merge
    mk('t4', '077', '2026-08-25', '11:00', 'remove', [bc('A4', 1, 0)]),
    // ថ្ងៃខុស ➜ មិន merge
    mk('t5', '077', '2026-08-24', '09:12', 'remove', [bc('A5', 2, 0)]),
    // ប្រភេទខុស ➜ មិន merge ទោះលេខ/ថ្ងៃ/ម៉ោងដូចគ្នា
    mk('t6', '077', '2026-08-25', '09:12', 'delete', [bc('A6', 3, 0)]),
    // លេខខុស ➜ មិន merge
    mk('t7', '088', '2026-08-25', '09:12', 'remove', [bc('A7', 5, 0)]),
    mk('t8', '099', '2026-08-20', '08:00', 'expired', [bc('A8', 8, 3.5), bc('A9', 12, 0)]),
    mk('t9', '066', '2026-08-21', '17:30', 'pickup', [bc('B1', 25, 0)])
];

const groups = ctx.buildTrashGroups(items);
const byPhoneReason = (phone, reason, time, date) => groups.filter((g) =>
    g.phone === phone && g.reason === reason
    && (time === undefined || g.time === time)
    && (date === undefined || g.scanDate === date));

const merged = byPhoneReason('077', 'remove', '09:12', '2026-08-25');
ok(merged.length === 1, 'លេខ+ថ្ងៃ+ម៉ោង+ប្រភេទដូចគ្នា ➜ merge ជាជួរតែមួយ', merged.length);
ok(merged.length === 1 && merged[0].items.length === 3, 'ជួរ merge រក្សាធាតុទាំង ៣ ទុកសម្រាប់ស្តារ',
    merged.length === 1 ? merged[0].items.length : null);
ok(merged.length === 1 && merged[0].count === 3, 'ចំនួនកញ្ចប់សរុប = 3', merged.length === 1 ? merged[0].count : null);
ok(merged.length === 1 && Math.abs(merged[0].total - 24.25) < 0.001, 'តម្លៃសរុប = $24.25',
    merged.length === 1 ? merged[0].total : null);
ok(merged.length === 1 && merged[0].codes.join(',') === 'A1,A2,A3', 'ជួរ merge ប្រមូល Barcode គ្រប់',
    merged.length === 1 ? merged[0].codes : null);

ok(byPhoneReason('077', 'remove', '11:00', '2026-08-25').length === 1, 'ម៉ោងស្កេនខុស ➜ **មិន** merge');
ok(groups.some((g) => g.phone === '077' && g.reason === 'remove' && g.scanDate === '2026-08-24'),
    'ថ្ងៃស្កេនខុស ➜ **មិន** merge');
ok(byPhoneReason('077', 'delete').length === 1,
    'ប្រភេទខុស ➜ **មិន** merge (បើ merge នោះលុយ ២ ក្រុមលាយគ្នា)');
ok(byPhoneReason('088', 'remove').length === 1, 'លេខទូរស័ព្ទខុស ➜ **មិន** merge');

// គ្មានធាតុណាបាត់ក្នុងការ merge — នេះជាការអះអាងសំខាន់បំផុតនៃផ្នែកនេះ
const seen = groups.reduce((n, g) => n + g.items.length, 0);
ok(seen === items.length, 'ការ merge មិនធ្វើឲ្យធាតុណាបាត់ (' + seen + '/' + items.length + ')', seen);
const ids = new Set();
groups.forEach((g) => g.items.forEach((i) => ids.add(i.id)));
ok(ids.size === items.length, 'ធាតុនីមួយៗលេចឡើងម្តងគត់ ➜ ប៊ូតុងស្តារ/លុបនៅតែសំដៅលើ id ពិត', ids.size);

// ---- កូនសោក្រុមមិនត្រូវប៉ះទង្គិចគ្នា ----
// ⛔ កំណែដំបូងប្រើ `.join('~')` ➜ ធាតុរបស់អតិថិជន ២ នាក់អាចធ្លាក់ចូលក្រុម
// តែមួយបើវាលណាមួយមាន `~` (rules ផ្ទៀងផ្ទាត់តែ `isString()`) ➜ **តួលេខ
// លុយដែលបង្ហាញខុស**។ ការ length-prefix ធ្វើឲ្យវាមិនអាចកើតឡើងតាមរចនាសម្ព័ន្ធ។
const collide = ctx.buildTrashGroups([
    mk('c1', 'a~b', 'c', 't', 'remove', [bc('X1', 1, 0)]),
    mk('c2', 'a', 'b~c', 't', 'remove', [bc('X2', 2, 0)])
]);
ok(collide.length === 2, 'វាលដែលមាន `~` មិនធ្វើឲ្យក្រុមប៉ះទង្គិចគ្នា', collide.length);
ok(collide.length === 2 && collide[0].key !== collide[1].key,
    'កូនសោក្រុមខុសគ្នាពិត (length-prefix)', collide.map((g) => g.key));

// ---- តួលេខសរុប ២ ក្រុម ----
const bucket = (deducted) => groups.filter((g) => META[g.reason].deducted === deducted)
    .reduce((acc, g) => ({ total: Math.round((acc.total + g.total) * 100) / 100, count: acc.count + g.count }),
            { total: 0, count: 0 });
const ded = bucket(true);
const kept = bucket(false);
// ដក៖ 6.5 + 11.75 + 6 + 1 + 2 + 5 = 32.25 · ផុតកំណត់៖ 23.5  ➜ 55.75
ok(Math.abs(ded.total - 55.75) < 0.001, 'ក្រុម «ដក + ផុតកំណត់» = $55.75', ded.total);
ok(ded.count === 8, 'ក្រុម «ដក + ផុតកំណត់» = 8 កញ្ចប់', ded.count);
// លុប៖ 3 · យករួច៖ 25 ➜ 28
ok(Math.abs(kept.total - 28) < 0.001, 'ក្រុម «យករួច + លុប» = $28.00', kept.total);
ok(kept.count === 2, 'ក្រុម «យករួច + លុប» = 2 កញ្ចប់', kept.count);
ok(Math.abs((ded.total + kept.total) - 83.75) < 0.001, 'សរុបទាំងអស់ = $83.75');

// ---- ទម្រង់ barcodes ឆៅពី RTDB (array មានរន្ធ · object) ----
const holed = ctx.buildTrashGroups([
    { id: 'h1', phone: '055', scanDate: 'd', time: 't', trashReason: 'remove', barcodes: [bc('C1', 1, 0), null, bc('C2', 2, 0)] },
    { id: 'h2', phone: '056', scanDate: 'd', time: 't', trashReason: 'remove', barcodes: { 0: bc('D1', 3, 0), 2: bc('D2', 4, 0) } }
]);
ok(holed.length === 2 && holed[0].count === 2 && holed[1].count === 2,
    'រូបរាង barcodes ៣ យ៉ាងពី RTDB ត្រូវរាប់ត្រឹមត្រូវ', holed.map((g) => g.count));
ok(holed[0].codes.join(',') === 'C1,C2' && holed[1].codes.join(',') === 'D1,D2',
    'Barcode ក្នុង array ដែលមានរន្ធ និង object ត្រូវអានចេញគ្រប់');

// ---- legacy គ្មាន barcodes ----
const legacy = ctx.buildTrashGroups([
    { id: 'L1', phone: '044', scanDate: 'd', time: 't', isFromDeletion: false, barcode: 'E1', cod: 7, dod: 3, count: 2 }
]);
ok(legacy.length === 1 && legacy[0].count === 2 && Math.abs(legacy[0].total - 10) < 0.001,
    'ធាតុ legacy គ្មាន barcodes ➜ ប្រើ cod/dod/count នៃ item', legacy[0]);
ok(legacy[0].codes.join(',') === 'E1', 'ធាតុ legacy ប្រើវាល barcode តែមួយ');

// ---- ការស្វែងរក ----
const g077 = merged[0];
ok(ctx.trashGroupMatchesQuery(g077, ''), 'ស្វែងរកទទេ ➜ បង្ហាញទាំងអស់');
ok(ctx.trashGroupMatchesQuery(g077, '077'), 'ស្វែងរកតាមលេខទូរស័ព្ទ');
ok(ctx.trashGroupMatchesQuery(g077, 'a2'), 'ស្វែងរកតាម Barcode (មិនប្រកាន់អក្សរតូចធំ)');
ok(!ctx.trashGroupMatchesQuery(g077, 'zzz'), 'អត្ថបទដែលមិនត្រូវ ➜ មិនបង្ហាញ');

// ---- ការកាត់កូនសោដែលផុតសម័យត្រូវធៀបនឹង **គ្រប់ក្រុម** មិនមែនក្រុមដែលត្រងរួច ----
// បើធៀបនឹងក្រុមដែលត្រងរួច នោះការវាយក្នុងប្រអប់ស្វែងរក **លុបស្ថានភាព
// ពង្រីក** របស់ក្រុមទាំងអស់ដែលមិនត្រូវនឹងការស្វែងរក។
const renderFn = sliceFn(src, 'renderRecentlyDeleted');
ok(/liveKeys = new Set\(allGroups\.map/.test(renderFn),
    'renderRecentlyDeleted កាត់កូនសោធៀបនឹង allGroups (មិនមែនក្រុមដែលត្រងរួច)',
    (renderFn.match(/liveKeys = .*/) || [])[0]);

// ================= ៦. តួលេខសរុបរបស់ធុងសំរាម (កូដពិត ➜ អាន HTML) =================
// 🔴 វាស់បាន (2026-09-09) ៖ mutation ២ លើ `renderTrashSummary` **រស់រាន** លើ
// checker ១៦០ ទាំងអស់ — ការត្រឡប់ក្រុម `deducted`↔`kept` និងការបង្គត់ត្រឹមដុល្លារ។
// មូលហេតុ ៖ គ្មាន checker ណារត់ function នោះ ហើយអានលេខដែលអ្នកប្រើឃើញឡើយ។
console.log('\n=== តួលេខសរុបរបស់ធុងសំរាម (កូដពិត ➜ អាន HTML) ===');
{
    let boxHtml = null;
    ctx.document.getElementById = (id) => (id === 'trashSummaryBox'
        ? { set innerHTML(v) { boxHtml = v; }, get innerHTML() { return boxHtml; } } : null);

    // ក្រុមសាកល្បង ៖ តម្លៃ **មានសេន** ដោយចេតនា (លេខមូលលាក់ mutation នៃការបង្គត់)
    const groups = [
        { reason: 'remove', total: 12.34, count: 2, codes: [], key: 'g1' },
        { reason: 'expired', total: 7.21, count: 1, codes: [], key: 'g2' },
        { reason: 'pickup', total: 30.05, count: 3, codes: [], key: 'g3' },
        { reason: 'delete', total: 9.90, count: 1, codes: [], key: 'g4' }
    ];
    const rendered = (() => {
        try { ctx.renderTrashSummary(groups, ''); return true; } catch (e) { return e; }
    })();
    ok(rendered === true, '⛔ លក្ខខណ្ឌចាំបាច់៖ `renderTrashSummary()` ពិតរត់ដល់ចប់', rendered);
    ok(typeof boxHtml === 'string' && boxHtml.length > 50,
        '⛔ ជាន់អប្បបរមា៖ វាពិតជាសរសេរ HTML ចូលប្រអប់', (boxHtml || '').slice(0, 60));

    const html = String(boxHtml || '');
    const cardMoney = (cls) => {
        const at = html.indexOf(cls);
        if (at === -1) return null;
        const m = /trash-sum-money">\$(-?[\d.]+)</.exec(html.slice(at));
        return m ? m[1] : null;
    };
    const cardCount = (cls) => {
        const at = html.indexOf(cls);
        if (at === -1) return null;
        const m = /trash-sum-count">📦 (-?\d+)/.exec(html.slice(at));
        return m ? m[1] : null;
    };

    // `TRASH_REASON_META[r].deducted` ជាប្រភពការពិត — ⛔ កុំចាក់ក្រុមជា literal
    const wantDeducted = groups.filter((g) => META[g.reason] && META[g.reason].deducted);
    const wantKept = groups.filter((g) => !(META[g.reason] && META[g.reason].deducted));
    const sum = (list, f) => Math.round(list.reduce((a, g) => a + g[f], 0) * 100) / 100;

    ok(wantDeducted.length > 0 && wantKept.length > 0,
        '⛔ ជាន់អប្បបរមា៖ ស្ថានភាពមានក្រុមទាំង ២ ខាង (បើអត់ ការត្រឡប់មិនបែងចែក)',
        wantDeducted.length + '/' + wantKept.length);

    // 🔴 T1 ៖ ការត្រឡប់ក្រុម deducted ↔ kept
    ok(cardMoney('trash-sum-deducted') === sum(wantDeducted, 'total').toFixed(2),
        '⛔ កាត «➖ ដក + ផុតកំណត់» = ផលបូកក្រុមដែល `META.deducted === true`',
        cardMoney('trash-sum-deducted') + ' ≠ ' + sum(wantDeducted, 'total').toFixed(2));
    ok(cardMoney('trash-sum-kept') === sum(wantKept, 'total').toFixed(2),
        '⛔ កាត «✅ យករួច + លុប» = ផលបូកក្រុមដែល `META.deducted !== true`',
        cardMoney('trash-sum-kept') + ' ≠ ' + sum(wantKept, 'total').toFixed(2));
    ok(cardCount('trash-sum-deducted') === String(sum(wantDeducted, 'count')),
        'ចំនួនកញ្ចប់របស់ក្រុម «ដក + ផុតកំណត់» ត្រឹមត្រូវ', cardCount('trash-sum-deducted'));
    ok(cardCount('trash-sum-kept') === String(sum(wantKept, 'count')),
        'ចំនួនកញ្ចប់របស់ក្រុម «យករួច + លុប» ត្រឹមត្រូវ', cardCount('trash-sum-kept'));

    // 🔴 T2 ៖ ការបង្គត់ត្រូវរក្សា **សេន**
    const grand = /សរុប \$(-?[\d.]+)/.exec(html);
    const wantGrand = Math.round((sum(wantDeducted, 'total') + sum(wantKept, 'total')) * 100) / 100;
    ok(!!grand && grand[1] === wantGrand.toFixed(2),
        '⛔ សរុបធំ រក្សាសេន (មិនបង្គត់ត្រឹមដុល្លារ)', grand && grand[1]);
    ok(!!grand && /\.\d{2}$/.test(grand[1]) && grand[1].slice(-2) !== '00',
        '⛔ ជាន់អប្បបរមា៖ ចម្លើយពិតជា**មានសេន** (បើគត់ mutation នៃការបង្គត់លាក់បាន)',
        grand && grand[1]);

    // ⛔ ការអភិរក្ស ៖ ក្រុម ២ បូកគ្នាត្រូវស្មើសរុបធំ និងចំនួនក្រុម
    const gCount = /📦 (\d+) កញ្ចប់ · (\d+) ជួរ/.exec(html);
    ok(!!gCount && Number(gCount[1]) === sum(wantDeducted, 'count') + sum(wantKept, 'count'),
        '⛔ ការអភិរក្ស៖ ចំនួនកញ្ចប់សរុប = ក្រុម ១ + ក្រុម ២', gCount && gCount[1]);
    ok(!!gCount && Number(gCount[2]) === groups.length,
        'ចំនួនជួរ = ចំនួនក្រុមដែលបញ្ចូល', gCount && gCount[2]);

    // ⛔ ទិសផ្ទុយ ៖ គ្មានក្រុម ➜ $0.00 ទាំង ២ ខាង (មិនមែនបោះ ឬ NaN)
    boxHtml = null;
    ctx.renderTrashSummary([], '');
    const empty = String(boxHtml || '');
    ok(empty.indexOf('$0.00') !== -1 && empty.indexOf('NaN') === -1,
        '⛔ ទិសផ្ទុយ៖ ធុងសំរាមទទេ ➜ $0.00 គ្មាន NaN', empty.slice(0, 80));
}

console.log('\n' + (fail === 0 ? '✅ ជោគជ័យទាំងអស់ (' + pass + ')' : '❌ ធ្លាក់ ' + fail + ' (ជោគជ័យ ' + pass + ')'));
process.exit(fail === 0 ? 0 : 1);
