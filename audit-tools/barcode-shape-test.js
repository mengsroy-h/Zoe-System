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

// ⛔ ជ្រើសប្លុកតាម **ខ្លឹមសារ** (ប្លុកដែល normalize barcode) មិនមែនតាមលំដាប់ក្នុងឯកសារ ៖ `scanHistory.forEach`
//    មានច្រើនកន្លែង (ការសម្អាត ២ម៉ោង/៧ថ្ងៃ ក៏ដើរតាមវា) ហើយលំដាប់ module ប្រែ ➜ «ទី ១» មិនមែនអត្តសញ្ញាណ។
function extractNormalizer(src) {
    const anchor = 'scanHistory.forEach(item => {';
    for (let at = src.indexOf(anchor); at !== -1; at = src.indexOf(anchor, at + 1)) {
        const braceAt = src.indexOf('{', at + anchor.length - 1);
        const body = sliceBalanced(src, braceAt, '{', '}');
        if (/normalizeBarcodesOf\(item\)/.test(body)) return body;
    }
    throw new Error('normalizer anchor not found');
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

for (const app of ['ZoeW']) {
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

console.log('\n' + (fail ? '❌ ' : '✅ ') + pass + '/' + (pass + fail));
process.exit(fail ? 1 : 0);
