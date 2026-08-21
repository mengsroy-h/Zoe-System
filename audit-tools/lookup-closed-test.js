const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');

function slice(file, names) {
    const src = fs.readFileSync(path.join(root, file), 'utf8');
    return names.map((name) => {
        const start = src.indexOf('function ' + name + '(');
        if (start === -1) throw new Error('not found: ' + name + ' in ' + file);
        let depth = 0, i = src.indexOf('{', start), started = false;
        for (; i < src.length; i++) {
            if (src[i] === '{') { depth++; started = true; }
            else if (src[i] === '}') { depth--; if (started && depth === 0) { i++; break; } }
        }
        return src.slice(start, i);
    }).join('\n\n');
}

const ctx = vm.createContext({ console });
vm.runInContext("var historyData = {}; var barcodeIndex = {}; var SCANNER_LOOKUP_BARCODE_INDEX_FIELD = '__zoeScannerLookupIndex';", ctx);
vm.runInContext(slice('ZoeAdmin/app.js', ['barcodeEntriesOf', 'scannerLockerRevision', 'scannerLookupBarcodeIndex', 'buildScannerLookupBarcodeCollection', 'buildScannerLookupPayload']), ctx);
vm.runInContext(slice('Zoescan/app.js', ['barcodeEntriesOf', 'buildBarcodeIndex', 'getEntryCurrentLocker', 'isEntryBarcodeClosed', 'findLockerOccupant']), ctx);

let pass = 0, fail = 0;
function ok(label, cond, detail) {
    if (cond) { console.log('   ok    ' + label); pass++; }
    else { console.log('  FAIL   ' + label + (detail !== undefined ? '  got: ' + JSON.stringify(detail) : '')); fail++; }
}

function loadLookup(items, omitClosedState) {
    const data = {};
    items.forEach((item) => {
        data[item.id] = JSON.parse(JSON.stringify(ctx.buildScannerLookupPayload(item, omitClosedState)));
    });
    ctx.historyData = data;
    vm.runInContext('buildBarcodeIndex();', ctx);
}

const openOrder = {
    id: 'itA', phone: '012', barcode: 'AAA', locker: 'L1', isClosed: false,
    barcodes: [
        { code: 'AAA', locker: 'T7', isClosed: true },
        { code: 'BBB', locker: 'T7', isClosed: false }
    ]
};
const legacyClosed = { id: 'itB', phone: '013', barcode: 'CCC', locker: 'T8', isClosed: true };
const legacyOpen = { id: 'itC', phone: '014', barcode: 'DDD', locker: 'T9', isClosed: false };

console.log('-- payload ត្រូវតែផ្ទុកស្ថានភាព បិទ/យកហើយ --');
const payload = ctx.buildScannerLookupPayload(openOrder);
ok('isClosed នៅកម្រិត item', payload.isClosed === false, payload.isClosed);
ok('isClosed នៅកម្រិត barcode', payload.barcodes[0].isClosed === true && payload.barcodes[1].isClosed === false, payload.barcodes);
const stripped = ctx.buildScannerLookupPayload(openOrder, true);
ok('payload បម្រុង (fallback) មិនមាន isClosed សោះ',
    !('isClosed' in stripped) && !('isClosed' in stripped.barcodes[0]), stripped);

console.log('-- Zoescan អានវាត្រឡប់មកវិញបានត្រឹមត្រូវ --');
loadLookup([openOrder, legacyClosed, legacyOpen]);
ok('barcode ដែលបិទ អានឃើញថាបិទ', ctx.isEntryBarcodeClosed(ctx.barcodeIndex['AAA']) === true);
ok('barcode ដែលនៅសល់ អានឃើញថានៅសល់', ctx.isEntryBarcodeClosed(ctx.barcodeIndex['BBB']) === false);
ok('item legacy ដែលបិទ អានឃើញថាបិទ', ctx.isEntryBarcodeClosed(ctx.barcodeIndex['CCC']) === true);
ok('item legacy ដែលនៅសល់ អានឃើញថានៅសល់', ctx.isEntryBarcodeClosed(ctx.barcodeIndex['DDD']) === false);

console.log('-- ការព្រមានទីតាំងជាន់គ្នា ដំណើរការតាមការរចនា --');
ok('ទូរបស់កញ្ចប់ដែលយកហើយ មិនរាយការណ៍ថាជាន់គ្នា',
    ctx.findLockerOccupant('T8', 'ZZZ', 'itZ') === null, ctx.findLockerOccupant('T8', 'ZZZ', 'itZ'));
ok('ទូរបស់កញ្ចប់ដែលនៅសល់ រាយការណ៍ថាជាន់គ្នា',
    (ctx.findLockerOccupant('T9', 'ZZZ', 'itZ') || {}).code === 'DDD');
ok('T7 រាយការណ៍តែ barcode ដែលនៅសល់',
    (ctx.findLockerOccupant('T7', 'ZZZ', 'itZ') || {}).code === 'BBB');
ok('barcode ក្នុង order ដដែល នៅតែលើកលែង',
    ctx.findLockerOccupant('T7', 'BBB', 'itA') === null);

console.log('-- មុន Publish Rules: ធ្លាក់ចុះថយ មិនមែនខូច --');
loadLookup([openOrder, legacyClosed, legacyOpen], true);
ok('lookup នៅតែរក barcode ទាំងអស់ឃើញ',
    Object.keys(ctx.barcodeIndex).sort().join(',') === 'AAA,BBB,CCC,DDD', Object.keys(ctx.barcodeIndex));
ok('ស្ថានភាពបិទមិនស្គាល់ ➜ ព្រមានដូចសព្វថ្ងៃ',
    (ctx.findLockerOccupant('T8', 'ZZZ', 'itZ') || {}).code === 'CCC');

console.log('');
if (fail) { console.log('❌ ' + fail + ' បរាជ័យ / ' + pass + ' ជោគជ័យ'); process.exit(1); }
console.log('✅ ការធ្វើតេស្តទាំងអស់ជោគជ័យ (' + pass + ')');
