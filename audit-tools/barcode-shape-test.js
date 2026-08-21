const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = process.env.BARCODE_APP_DIR || path.join(__dirname, '..');

let pass = 0, fail = 0;
function ok(cond, label, got) {
    if (cond) { pass++; console.log('   ok    ' + label); }
    else { fail++; console.log('   FAIL  ' + label + (got !== undefined ? '  ➜ ' + JSON.stringify(got) : '')); }
}

function sliceBalanced(src, startIdx, open, close) {
    let depth = 0, i = startIdx;
    for (; i < src.length; i++) {
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

function extractNormalizer(src) {
    const anchor = 'scanHistory.forEach(item => {';
    const at = src.indexOf(anchor);
    if (at === -1) throw new Error('normalizer anchor not found');
    const braceAt = src.indexOf('{', at + anchor.length - 1);
    return sliceBalanced(src, braceAt, '{', '}');
}

function makeCtx(src) {
    const ctx = {
        console,
        getServerNow: () => 1700000000000,
        parseTimestampFromId: () => 1700000000000,
        generateUniqueId: () => 'id_generated'
    };
    vm.createContext(ctx);
    const helper = extractFn(src, 'barcodeEntriesOf');
    if (helper) vm.runInContext(helper, ctx);
    vm.runInContext("var SCANNER_LOOKUP_BARCODE_INDEX_FIELD = '__zoeScannerLookupIndex';", ctx);
    const normalizer = extractFn(src, 'normalizeBarcodesOf');
    if (normalizer) vm.runInContext(normalizer, ctx);
    vm.runInContext('function normalizeItem(item) ' + extractNormalizer(src), ctx);
    return ctx;
}

// ---- the three shapes Firebase RTDB can hand back for the same stored array ----
const DENSE = () => ([{ code: 'AAA', cod: 5, dod: 1 }, { code: 'BBB', cod: 7, dod: 2 }]);
const WITH_NULLS = () => ([{ code: 'AAA', cod: 5, dod: 1 }, null, { code: 'BBB', cod: 7, dod: 2 }]);
const OBJECT_GAPS = () => ({ '0': { code: 'AAA', cod: 5, dod: 1 }, '2': { code: 'BBB', cod: 7, dod: 2 } });

for (const app of ['ZoeAdmin', 'ZoeW']) {
    console.log('\n=== ' + app + ' — history normalizer ===');
    const src = fs.readFileSync(path.join(ROOT, app, 'app.js'), 'utf8');
    const ctx = makeCtx(src);

    const dense = { id: 'i1', cod: 12, dod: 3, barcodes: DENSE() };
    let threw = null;
    try { ctx.normalizeItem(dense); } catch (e) { threw = e; }
    ok(!threw, 'dense array normalizes without throwing', threw && threw.message);
    ok(Array.isArray(dense.barcodes) && dense.barcodes.length === 2, 'dense array keeps both barcodes', dense.barcodes);

    const withNulls = { id: 'i2', cod: 12, dod: 3, barcodes: WITH_NULLS() };
    threw = null;
    try { ctx.normalizeItem(withNulls); } catch (e) { threw = e; }
    ok(!threw, 'array containing null does NOT throw (would freeze the whole list)', threw && threw.message);
    ok(Array.isArray(withNulls.barcodes) && withNulls.barcodes.length === 2, 'array containing null keeps both real barcodes', withNulls.barcodes);
    ok(!threw && withNulls.barcodes.map(b => b.code).join(',') === 'AAA,BBB', 'array containing null preserves order', threw ? 'threw' : withNulls.barcodes.map(b => b.code));

    const objGaps = { id: 'i3', cod: 12, dod: 3, barcodes: OBJECT_GAPS() };
    threw = null;
    try { ctx.normalizeItem(objGaps); } catch (e) { threw = e; }
    ok(!threw, 'object-shaped barcodes does not throw', threw && threw.message);
    ok(Array.isArray(objGaps.barcodes), 'object-shaped barcodes becomes a real array', objGaps.barcodes);
    ok(Array.isArray(objGaps.barcodes) && objGaps.barcodes.length === 2, 'object-shaped barcodes keeps BOTH barcodes (parcel not lost)', objGaps.barcodes);
    ok(Array.isArray(objGaps.barcodes) && objGaps.barcodes.map(b => b.code).join(',') === 'AAA,BBB', 'object-shaped barcodes keeps numeric key order', Array.isArray(objGaps.barcodes) ? objGaps.barcodes.map(b => b.code) : objGaps.barcodes);
    ok(Array.isArray(objGaps.barcodes) && objGaps.barcodes.every(b => typeof b.cod === 'number'), 'object-shaped barcodes still get cod/dod normalized', objGaps.barcodes);

    const tryNormalize = (item) => { try { ctx.normalizeItem(item); } catch (e) { item._threw = e.message; } return item; };

    const staleCount = tryNormalize({ id: 'i4', cod: 12, dod: 3, count: 7, barcodes: OBJECT_GAPS() });
    ok(staleCount.count === 2, 'a stale count is pulled back in step with barcodes[] (the two apps then agree)', staleCount._threw || staleCount.count);

    const staleNull = tryNormalize({ id: 'i5', cod: 12, dod: 3, count: 3, barcodes: WITH_NULLS() });
    ok(staleNull.count === 2, 'count follows the real barcodes after nulls are dropped', staleNull._threw || staleNull.count);

    const legacy = tryNormalize({ id: 'i6', cod: 5, dod: 0, count: 4, barcode: 'OLD' });
    ok(legacy.count === 4, 'a legacy item with no barcodes[] keeps its own count (stat math untouched)', legacy._threw || legacy.count);

    const emptyArr = tryNormalize({ id: 'i7', cod: 5, dod: 0, count: 2, barcodes: [] });
    ok(emptyArr.count === 2, 'an empty barcodes[] does NOT zero the count', emptyArr._threw || emptyArr.count);
}

console.log('\n=== ZoeAdmin and ZoeW derive the displayed package count identically ===');
{
    const a = fs.readFileSync(path.join(ROOT, 'ZoeAdmin', 'app.js'), 'utf8');
    const w = fs.readFileSync(path.join(ROOT, 'ZoeW', 'app.js'), 'utf8');
    const expr = /let totalPackageCount = item\.barcodes && Array\.isArray\(item\.barcodes\) \? item\.barcodes\.length : \(parseFloat\(item\.count\) \|\| 1\);/;
    ok(expr.test(a), 'ZoeAdmin uses the shared totalPackageCount expression');
    ok(expr.test(w), 'ZoeW uses the shared totalPackageCount expression');
    ok(!/\$\{item\.count\}/.test(a), 'ZoeAdmin no longer prints item.count straight into the row');
}

console.log('\n=== Zoescan — buildBarcodeIndex ===');
{
    const src = fs.readFileSync(path.join(ROOT, 'Zoescan', 'app.js'), 'utf8');
    const ctx = { console, historyData: {}, barcodeIndex: {} };
    vm.createContext(ctx);
    const helper = extractFn(src, 'barcodeEntriesOf');
    if (helper) vm.runInContext(helper, ctx);
    vm.runInContext(extractFn(src, 'buildBarcodeIndex'), ctx);

    ctx.historyData = { p1: { id: 'p1', barcode: 'AAA', barcodes: DENSE() } };
    ctx.buildBarcodeIndex();
    ok(!!ctx.barcodeIndex.AAA && !!ctx.barcodeIndex.BBB, 'dense: both barcodes findable');
    ok(ctx.barcodeIndex.BBB && ctx.barcodeIndex.BBB.barcodeIdx === 1, 'dense: BBB index is 1', ctx.barcodeIndex.BBB);

    ctx.historyData = { p2: { id: 'p2', barcode: 'AAA', barcodes: OBJECT_GAPS() } };
    ctx.buildBarcodeIndex();
    ok(!!ctx.barcodeIndex.BBB, 'object-shaped: second barcode is findable (worker can assign a locker)', Object.keys(ctx.barcodeIndex));
    ok(ctx.barcodeIndex.BBB && ctx.barcodeIndex.BBB.barcodeIdx === 2,
        'object-shaped: index stays 2 — the mirror write must target the REAL Firebase slot, not a compacted one',
        ctx.barcodeIndex.BBB);

    ctx.historyData = { p3: { id: 'p3', barcode: 'AAA', barcodes: WITH_NULLS() } };
    ctx.buildBarcodeIndex();
    ok(!!ctx.barcodeIndex.BBB, 'array-with-null: second barcode findable', Object.keys(ctx.barcodeIndex));
    ok(ctx.barcodeIndex.BBB && ctx.barcodeIndex.BBB.barcodeIdx === 2, 'array-with-null: index stays 2', ctx.barcodeIndex.BBB);

    ctx.historyData = { p4: { id: 'p4', barcode: 'LEGACY' } };
    ctx.buildBarcodeIndex();
    ok(!!ctx.barcodeIndex.LEGACY && ctx.barcodeIndex.LEGACY.barcodeIdx === null, 'legacy single-barcode item still indexed', ctx.barcodeIndex.LEGACY);

    ctx.historyData = { p5: { id: 'p5', barcode: 'LEG2', barcodes: [] } };
    ctx.buildBarcodeIndex();
    ok(!!ctx.barcodeIndex.LEG2, 'empty barcodes array still falls back to the legacy barcode', ctx.barcodeIndex);
}

console.log('\n' + (fail ? '❌ ' : '✅ ') + pass + '/' + (pass + fail));
process.exit(fail ? 1 : 0);
