const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = process.env.RAWREAD_APP_DIR || path.join(__dirname, '..');

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

function extractArrow(src, anchor, argName) {
    const at = src.indexOf(anchor);
    if (at === -1) throw new Error('anchor not found: ' + anchor);
    const braceAt = src.indexOf('{', at + anchor.length - 1);
    return 'function (' + argName + ') ' + sliceBalanced(src, braceAt, '{', '}');
}

function extractTrashNormalizer(src) {
    const anchor = 'deletedItems.forEach(item => {';
    const at = src.indexOf(anchor);
    if (at === -1) throw new Error('trash normalizer anchor not found');
    const braceAt = src.indexOf('{', at + anchor.length - 1);
    return sliceBalanced(src, braceAt, '{', '}');
}

function makeCtx(src) {
    const ctx = {
        console,
        getServerNow: () => 1700000000000,
        parseTimestampFromId: () => 1700000000000,
        generateUniqueId: () => 'id_generated',
        EIGHT_DAYS_MS: 8 * 24 * 60 * 60 * 1000,
        TWO_HOURS_MS: 2 * 60 * 60 * 1000
    };
    vm.createContext(ctx);
    vm.runInContext("var SCANNER_LOOKUP_BARCODE_INDEX_FIELD = '__zoeScannerLookupIndex';", ctx);
    vm.runInContext('var deletedItems = []; var activeRestoreClaims = new Map(); var dbListenerPendingPaths = new Set();', ctx);
    for (const fn of ['barcodeEntriesOf', 'normalizeBarcodesOf', 'applyBarcodeCloseState',
                      'itemHasRestoreMarkers', 'isActiveRestoreClaim', 'dropStaleRestoreMarkers']) {
        const code = extractFn(src, fn);
        if (code) vm.runInContext(code, ctx);
    }
    if (typeof ctx.normalizeBarcodesOf !== 'function') {
        vm.runInContext('function normalizeBarcodesOf(i) { return i; }', ctx);
    }
    vm.runInContext('function normalizeTrashItem(item) ' + extractTrashNormalizer(src)
        .replace('runAutomaticDeletedCleanup();', ''), ctx);
    vm.runInContext('function toggleWholeTx(currentItem) ' +
        sliceBalanced(src, src.indexOf('{', src.indexOf('const closeResult = await fb.runTransaction(itemRef, (currentItem) => {')), '{', '}'), ctx);
    vm.runInContext('function toggleOneTx(currentItem) ' +
        sliceBalanced(src, src.indexOf('{', src.indexOf('const barcodeCloseResult = await fb.runTransaction(itemRef, (currentItem) => {')), '{', '}'), ctx);
    return ctx;
}

// the three shapes RTDB hands back for the SAME stored array
const DENSE = () => ([{ code: 'AAA', cod: 5, dod: 1, isClosed: false }, { code: 'BBB', cod: 7, dod: 2, isClosed: false }]);
const WITH_NULLS = () => ([{ code: 'AAA', cod: 5, dod: 1, isClosed: false }, null, { code: 'BBB', cod: 7, dod: 2, isClosed: false }]);
const OBJECT_GAPS = () => ({ '0': { code: 'AAA', cod: 5, dod: 1, isClosed: false }, '2': { code: 'BBB', cod: 7, dod: 2, isClosed: false } });

const SHAPES = [['array ដែលមាន null', WITH_NULLS], ['object ដែលមាន gap', OBJECT_GAPS]];

for (const app of ['ZoeW']) {
    const src = fs.readFileSync(path.join(ROOT, app, 'app.js'), 'utf8');
    const ctx = makeCtx(src);

    console.log('\n=== ' + app + ' — normalizer នៃធុងសំរាម (dbRefDeleted) ===');
    for (const [label, make] of SHAPES) {
        const item = { id: 't1', cod: 12, dod: 3, count: 2, barcodes: make(), isFromDeletion: false };
        let threw = null;
        try { ctx.normalizeTrashItem(item); } catch (e) { threw = e; }
        ok(!threw, label + ' ➜ មិន throw', threw && threw.message);
        ok(Array.isArray(item.barcodes), label + ' ➜ ក្លាយជា array ពិត (ការស្តារពឹងលើ Array.isArray)', item.barcodes);
        ok(Array.isArray(item.barcodes) && item.barcodes.length === 2,
            label + ' ➜ រក្សា barcode ទាំង ២ (លុយត្រូវបានបន្ថែមមកវិញតាមវា)', item.barcodes && item.barcodes.length);
    }
    const denseTrash = { id: 't0', barcodes: DENSE() };
    ctx.normalizeTrashItem(denseTrash);
    ok(denseTrash.barcodes.length === 2, 'array ធម្មតា ➜ មិនប្រែ', denseTrash.barcodes.length);

    console.log('\n=== ' + app + ' — transaction បិទការបញ្ជាទិញទាំងមូល ===');
    for (const [label, make] of SHAPES) {
        const item = { id: 'i1', isClosed: false, barcodes: make() };
        let threw = null;
        try {
            vm.runInContext('var desiredClosed = true;', ctx);
            ctx.toggleWholeTx(item);
        } catch (e) { threw = e; }
        ok(!threw, label + ' ➜ មិន throw', threw && threw.message);
        const list = Array.isArray(item.barcodes) ? item.barcodes : Object.values(item.barcodes || {});
        ok(list.length === 2 && list.every(b => b && b.isClosed === true),
            label + ' ➜ barcode ទាំងអស់ត្រូវបានបិទពិត', list);
    }

    console.log('\n=== ' + app + ' — transaction បិទ barcode តែមួយ ===');
    for (const [label, make] of SHAPES) {
        const item = { id: 'i1', barcode: 'AAA', isClosed: false, barcodes: make() };
        let threw = null;
        try {
            vm.runInContext('var desiredClosed = true; var barcodeCode = "BBB";', ctx);
            ctx.toggleOneTx(item);
        } catch (e) { threw = e; }
        ok(!threw, label + ' ➜ មិន throw', threw && threw.message);
        const list = Array.isArray(item.barcodes) ? item.barcodes : Object.values(item.barcodes || {});
        ok(list.length === 2, label + ' ➜ barcode មិនត្រូវបានលុបចោលពី Firebase', list.map(b => b && b.code));
        const bbb = list.find(b => b && b.code === 'BBB');
        ok(bbb && bbb.isClosed === true, label + ' ➜ barcode ដែលអតិថិជនយក ត្រូវបានបិទ', bbb);
        const aaa = list.find(b => b && b.code === 'AAA');
        ok(aaa && aaa.isClosed === false, label + ' ➜ barcode ដែលមិនទាន់យក នៅបើកដដែល', aaa);
    }
}

console.log('\n' + (fail ? 'FAIL ' : 'PASS ') + pass + '/' + (pass + fail));
process.exit(fail ? 1 : 0);
