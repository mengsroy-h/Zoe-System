// Policy harness: slices the REAL shipped code blocks out of ZoeW/app.js and
// runs them against fake parcels, and asserts the លុប / ដក invariants.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = process.env.POLICY_APP_DIR ? path.resolve(process.env.POLICY_APP_DIR) : path.join(__dirname, '..');

function slice(src, startMarker, endMarker, label) {
    const a = src.indexOf(startMarker);
    if (a === -1) throw new Error('start marker not found: ' + label);
    const b = src.indexOf(endMarker, a);
    if (b === -1) throw new Error('end marker not found: ' + label);
    return src.slice(a, b + endMarker.length);
}

function buildRunner(appFile) {
    const src = fs.readFileSync(appFile, 'utf8');

    // --- real block 1: claimAndCleanupItem's trash construction + revenue calls ---
    const claimBlock = slice(src,
        '            let trashItem;\n            let revenueDeducted = false;',
        '                    trashItem.isFromDeletion = true;\n                    if (trashItem.barcodes && Array.isArray(trashItem.barcodes)) {\n                        trashItem.barcodes = trashItem.barcodes.map(b => ({ ...b, isFromDeletion: true }));\n                    }\n                }\n            }',
        'claim');

    // --- real block 2: executeRestoreItem's revenue + marker block ---
    const restoreBlock = slice(src,
        '            const appliedRevenueDeltas = [];\n            const revenueScanDate = itemToRestore.scanDate || getFormattedDate();',
        "                appliedRevenueDeltas.push({ scanDate: revenueScanDate, cod: legacyCod, dod: legacyDod, count: legacyCount });\n            }",
        'restore');

    const prelude = `
        var NOW = 1000000;
        function getServerNow() { return NOW; }
        function getFormattedDate() { return '2026-08-19'; }
        var idSeq = 0;
        function generateUniqueId() { return 'id_gen_' + (++idSeq); }
        var revenueLog = [];
        function addRevenueToDailyAndMonthlyRecord(d, cod, dod, count) {
            revenueLog.push({ d, cod, dod, count });
            stats.cod = Math.round((stats.cod + cod) * 100) / 100;
            stats.dod = Math.round((stats.dod + dod) * 100) / 100;
            stats.count += count;
        }
        var stats = { cod: 0, dod: 0, count: 0 };
    `;

    const script = new vm.Script(prelude + `
        function runClaim(claimedWhole, claimedPartial, reason, id) {
${claimBlock}
            return { trashItem, revenueDeducted };
        }
        function runRestore(itemToRestore) {
            const restoredWasRemoved = itemToRestore.isFromDeletion === false;
            delete itemToRestore.deletedAt;
            delete itemToRestore.isFromDeletion;
${restoreBlock}
            appliedRevenueDeltas.forEach((delta) => {
                addRevenueToDailyAndMonthlyRecord(delta.scanDate, delta.cod, delta.dod, delta.count);
            });
            return { itemToRestore, appliedRevenueDeltas };
        }
    `);
    const ctx = vm.createContext({ console });
    script.runInContext(ctx);
    return ctx;
}

const bc = (code, cod, dod, closed) => ({
    code, cod, dod, locker: 'N/A', time: 't', isClosed: !!closed,
    isDeducted: false, isFromDeletion: false, createdAt: 1
});
const parcel = (barcodes, extra) => Object.assign({
    id: 'id_1', phone: '012345678', scanDate: '2026-08-19',
    barcodes, count: barcodes.length,
    cod: barcodes.reduce((s, b) => s + b.cod, 0),
    dod: barcodes.reduce((s, b) => s + b.dod, 0),
    isClosed: barcodes.every(b => b.isClosed), isCalled: true,
    callMark: 'មិនទទួល', callMarkTime: 500
}, extra || {});

let failures = 0;
function check(label, actual, expected) {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    if (!ok) failures++;
    console.log(`   ${ok ? 'ok  ' : 'FAIL'}  ${label}: ${JSON.stringify(actual)}${ok ? '' : '  expected ' + JSON.stringify(expected)}`);
}

for (const app of ['ZoeW']) {
    console.log(`\n================= ${app} =================`);
    const ctx = buildRunner(path.join(ROOT, app, 'app.js'));

    // ---------- លុប (Delete): 2-hour auto-cleanup of a closed parcel ----------
    console.log('\n-- លុប: បិទ ➜ លុបស្វ័យប្រវត្តិ ២ម៉ោង ➜ ស្តារ ➜ លុប ➜ ស្តារ --');
    ctx.stats.cod = 100; ctx.stats.dod = 50; ctx.stats.count = 3;
    const closedParcel = parcel([bc('A', 60, 30, true), bc('B', 40, 20, true)]);
    let r = ctx.runClaim(closedParcel, null, 'close', 'id_1');
    check('ស្ថិតិក្រោយលុប (មិនប្រែប្រួល)', ctx.stats, { cod: 100, dod: 50, count: 3 });
    check('marker ក្នុងធុងសំរាម (item)', r.trashItem.isFromDeletion, true);
    check('marker ក្នុងធុងសំរាម (barcode)', r.trashItem.barcodes.map(b => b.isFromDeletion), [true, true]);
    check('isDeducted នៅ false (លុយមិនត្រូវដក)', r.trashItem.barcodes.map(b => b.isDeducted), [false, false]);
    check('ចងចាំស្ថានភាព បិទ/ខល', [r.trashItem.isClosed, r.trashItem.isCalled, r.trashItem.callMark], [true, true, 'មិនទទួល']);

    let back = ctx.runRestore(r.trashItem);
    check('ស្ថិតិក្រោយស្តារ (មិនបូកថែម)', ctx.stats, { cod: 100, dod: 50, count: 3 });
    check('marker ត្រូវសម្អាតពេលរស់វិញ', back.itemToRestore.barcodes.map(b => b.isFromDeletion), [false, false]);
    check('ស្ថានភាព បិទ/ខល នៅដដែល', [back.itemToRestore.isClosed, back.itemToRestore.isCalled, back.itemToRestore.callMark], [true, true, 'មិនទទួល']);

    r = ctx.runClaim(back.itemToRestore, null, 'close', 'id_1');
    check('លុបម្ដងទៀត (មិនដកទៀត)', ctx.stats, { cod: 100, dod: 50, count: 3 });
    back = ctx.runRestore(r.trashItem);
    check('ស្តារម្ដងទៀត (មិនបូកទៀត)', ctx.stats, { cod: 100, dod: 50, count: 3 });

    // ---------- ដក (Remove): 8-day abandon of a fully-open parcel ----------
    console.log('\n-- ដក: មិនបិទ ៨ថ្ងៃ ➜ return សាខាកណ្ដាល ➜ ស្តារ ➜ ដក --');
    ctx.stats.cod = 100; ctx.stats.dod = 50; ctx.stats.count = 3;
    const openParcel = parcel([bc('C', 25, 5, false), bc('D', 15, 5, false)]);
    r = ctx.runClaim(openParcel, null, 'abandon', 'id_2');
    check('ស្ថិតិក្រោយដក (ដកលុយ+ចំនួន)', ctx.stats, { cod: 60, dod: 40, count: 1 });
    check('marker ក្នុងធុងសំរាម (item)', r.trashItem.isFromDeletion, false);
    check('marker ក្នុងធុងសំរាម (barcode)', r.trashItem.barcodes.map(b => b.isFromDeletion), [false, false]);
    check('isDeducted = true', r.trashItem.barcodes.map(b => b.isDeducted), [true, true]);

    back = ctx.runRestore(r.trashItem);
    check('ស្ថិតិក្រោយស្តារ (បូកត្រឡប់ពេញ)', ctx.stats, { cod: 100, dod: 50, count: 3 });
    check('isDeducted ត្រូវ reset', back.itemToRestore.barcodes.map(b => b.isDeducted), [false, false]);
    check('marker ត្រូវសម្អាត', back.itemToRestore.barcodes.map(b => b.isFromDeletion), [false, false]);

    r = ctx.runClaim(back.itemToRestore, null, 'abandon', 'id_2');
    check('ដកម្ដងទៀត (ដកម្ដងទៀត)', ctx.stats, { cod: 60, dod: 40, count: 1 });
    back = ctx.runRestore(r.trashItem);
    check('ស្តារម្ដងទៀត (បូកម្ដងទៀត)', ctx.stats, { cod: 100, dod: 50, count: 3 });

    // ---------- ដក: partial claim (some barcodes still closed) ----------
    console.log('\n-- ដក: partial (barcode ខ្លះបិទរួច barcode ខ្លះនៅ) --');
    ctx.stats.cod = 100; ctx.stats.dod = 50; ctx.stats.count = 3;
    const mixed = parcel([bc('E', 10, 2, true), bc('F', 30, 8, false)]);
    const staleOpen = mixed.barcodes.filter(b => !b.isClosed);
    r = ctx.runClaim(null, Object.assign({}, mixed, { barcodes: staleOpen }), 'abandon', 'id_3');
    check('ដកតែ barcode ដែលនៅសល់', ctx.stats, { cod: 70, dod: 42, count: 2 });
    check('marker barcode ដែលដក', r.trashItem.barcodes.map(b => [b.code, b.isFromDeletion, b.isDeducted]), [['F', false, true]]);
    back = ctx.runRestore(r.trashItem);
    check('ស្តារត្រឡប់វិញពេញ', ctx.stats, { cod: 100, dod: 50, count: 3 });

    // ---------- legacy parcel with no barcodes[] ----------
    console.log('-- legacy (គ្មាន barcodes[]) : ដក ➜ ស្តារ --');
    ctx.stats.cod = 100; ctx.stats.dod = 50; ctx.stats.count = 3;
    const legacy = { id: 'id_4', phone: '011', scanDate: '2026-08-19', barcode: 'G', cod: 20, dod: 10, count: 2, isClosed: false };
    r = ctx.runClaim(legacy, null, 'abandon', 'id_4');
    check('ស្ថិតិក្រោយដក legacy', ctx.stats, { cod: 80, dod: 40, count: 1 });
    back = ctx.runRestore(r.trashItem);
    check('ស្តារ legacy បូកត្រឡប់វិញ', ctx.stats, { cod: 100, dod: 50, count: 3 });

    console.log('-- legacy : លុប ➜ ស្តារ (មិនត្រូវប៉ះស្ថិតិ) --');
    ctx.stats.cod = 100; ctx.stats.dod = 50; ctx.stats.count = 3;
    const legacyClosed = { id: 'id_5', phone: '011', scanDate: '2026-08-19', barcode: 'H', cod: 20, dod: 10, count: 2, isClosed: true };
    r = ctx.runClaim(legacyClosed, null, 'close', 'id_5');
    check('លុប legacy មិនប៉ះស្ថិតិ', ctx.stats, { cod: 100, dod: 50, count: 3 });
    back = ctx.runRestore(r.trashItem);
    check('ស្តារ legacy មិនបូកថែម', ctx.stats, { cod: 100, dod: 50, count: 3 });
}

console.log('\n' + (failures === 0 ? '✅ ការធ្វើតេស្តទាំងអស់ជោគជ័យ' : `❌ បរាជ័យ ${failures}`));
process.exit(failures === 0 ? 0 : 1);
