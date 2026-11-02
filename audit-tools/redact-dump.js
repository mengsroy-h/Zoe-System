// 🔒 សម្អាត dump ➜ ឯកសារដែល **ផ្ញើបានដោយសុវត្ថិភាព** — ⛔ រត់លើម៉ាស៊ីនអ្នក។
//
// ហេតុអ្វីវាមាន ៖ `money-reality-check.js` ត្រូវការ **រូបរាង និងទឹកប្រាក់**
// ប៉ុណ្ណោះ — វាមិនត្រូវការ **លេខទូរស័ព្ទ** ឬ **លេខ barcode ពិត** ទេ។
// ការរកឃើញ barcode ស្ទួន ដើរបានល្អដដែលលើ **hash** (ស្ទួន ➜ hash ស្ទួន)។
//
// របៀបប្រើ ៖
//   node audit-tools/redact-dump.js <dump.json|.json.gz> [out.json]
//
// អ្វីដែលត្រូវជំនួស ៖ លេខទូរស័ព្ទ · barcode · ទីតាំង Locker · ឈ្មោះ · id
//   ➜ hash ៨ តួ (ថេរក្នុងមួយការរត់ ➜ ការស្ទួន និងទំនាក់ទំនងនៅដដែល)
// អ្វីដែលរក្សា ៖ ថ្ងៃ · ទឹកប្រាក់ COD/DOD · ទង់ isClosed/isDeducted · ចំនួន
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

const clearOutput = process.argv[2] === '--clear-output';
const file = process.argv[clearOutput ? 3 : 2];
if (!file || clearOutput && !process.argv[4]) {
    console.log('Usage: node audit-tools/redact-dump.js <dump.json|dump.json.gz> [out.json]');
    console.log('  Produces a PII-free copy that is safe to share.');
    process.exit(2);
}
if (!fs.existsSync(file)) { console.log('ERROR: file not found: ' + file); process.exit(1); }
const out = process.argv[clearOutput ? 4 : 3] || file.replace(/\.json(\.gz)?$/, '') + '-redacted.json';

function requireDistinctOutput() {
    try {
        const inputInfo = fs.statSync(file);
        let outputInfo = null;
        try { outputInfo = fs.statSync(out); }
        catch (e) { if (e.code !== 'ENOENT') throw e; }
        if (path.resolve(file) === path.resolve(out)
            || (outputInfo && inputInfo.dev === outputInfo.dev && inputInfo.ino === outputInfo.ino)) {
            console.log('⛔ ឯកសារលទ្ធផលត្រូវដាច់ពីឯកសារដើម រួមទាំង hardlink និង symlink។');
            process.exit(1);
        }
    } catch (e) {
        console.log('⛔ មិនអាចផ្ទៀងផ្ទាត់ថាឯកសារលទ្ធផលដាច់ពីឯកសារដើមបានទេ។');
        process.exit(1);
    }
}

requireDistinctOutput();

if (clearOutput) {
    try {
        try { fs.unlinkSync(out); }
        catch (e) { if (e.code !== 'ENOENT') throw e; }
        try { fs.lstatSync(out); throw new Error('output remains'); }
        catch (e) { if (e.code !== 'ENOENT') throw e; }
    } catch (e) {
        console.log('⛔ មិនអាចលុប និងផ្ទៀងផ្ទាត់ឯកសារលទ្ធផលចាស់បានទេ។');
        process.exit(1);
    }
    process.exit(0);
}

let raw = fs.readFileSync(file);
if (file.endsWith('.gz')) raw = zlib.gunzipSync(raw);
let db;
try { db = JSON.parse(raw.toString('utf8')); }
catch (e) { console.log('ERROR: cannot read the file as JSON: ' + e.message); process.exit(1); }

// salt ចៃដន្យក្នុងមួយការរត់ ➜ ⛔ hash **បញ្ច្រាសមិនបាន** ទោះដឹងលេខទូរស័ព្ទក៏ដោយ
const barcodeContext = require('vm').createContext({});
require('vm').runInContext(fs.readFileSync(path.join(__dirname, 'money-core.js'), 'utf8'), barcodeContext);
const barcodeKey = barcodeContext.barcodeRegistryKey;
if (typeof barcodeKey !== 'function') throw new Error('Barcode encoder is missing from money-core.js');

const SALT = crypto.randomBytes(16);
const memo = new Map();
// ⛔ **namespace តែមួយ** សម្រាប់អត្តសញ្ញាណទាំងអស់ ៖ តម្លៃដដែល ត្រូវឲ្យ hash
// ដដែល **ទោះវាលេចនៅកន្លែងណា**។ វាស់បានលើទិន្នន័យពិត (2026-09-09) ៖ កូនសោ
// `zoew_barcode_registry` (តួលេខសុទ្ធ) ធ្លាក់ចូល namespace `ph` ខណៈ
// `barcodes[].code` ចូល `bc` ➜ ទំនាក់ទំនងរលាយ ➜ ការវិភាគរាយ **«៥៩៨ កំព្រា»
// ដែលជាការជូនដំណឹងក្លែងក្លាយទាំងស្រុង**។
// ⛔ ធ្វើឲ្យធម្មតាជាអក្សរធំដែរ — `barcodeRegistryKey()` ប្រើអក្សរធំ។
function h(value) {
    const v = String(value === undefined || value === null ? '' : value).toUpperCase();
    if (!v) return String(value === undefined || value === null ? '' : value);
    if (memo.has(v)) return memo.get(v);
    const d = crypto.createHash('sha256').update(SALT).update(v).digest('hex').slice(0, 8);
    const r = 'id_' + d;
    memo.set(v, r);
    return r;
}

// ⛔ អ្វីដែល **មិនស្គាល់** ក៏ត្រូវជំនួសដែរ (fail closed)
const KEEP_EXACT = new Set(['cod', 'dod', 'price', 'count', 'totalCount', 'codDollar', 'dodDollar',
    'packagesPickedUp', 'isClosed', 'isDeducted', 'isFromDeletion', 'scanDate', 'createdAt',
    'closedAt', 'deletedAt', 'restoredAt', 'lockerUpdatedAt', 'trashReason', 'finalizedAt']);
const AS_PHONE = new Set(['phone', 'phoneKey', 'targetPhone', 'oldPhone', 'newPhone']);
const AS_CODE = new Set(['code', 'barcode', 'targetId', 'id', 'sourceId']);
const DROP = new Set(['locker', 'name', 'customerName', 'note', 'remark', 'address',
    'token', 'restoreClaimToken', 'clearClaim', 'restoreClaim', 'restoreClaimId', 'email', 'time']);

// ⛔ កូនសោ **រចនាសម្ព័ន្ធ** មិនត្រូវ hash — មានតែ **អត្តសញ្ញាណ** ទេ។
// វាស់បាន ២ ដង ៖ (១) hash កូនសោថ្ងៃ ➜ លុយក្លាយជា `$0.00`;
// (២) hash ឈ្មោះ node/វាល (`zoew_…` · `barcodes`) ➜ រចនាសម្ព័ន្ធរលាយទាំងស្រុង។
// ឈ្មោះ schema មិនមែន PII ទេ (ពួកវាមានក្នុង repo សាធារណៈរួចហើយ)។
const DATE_KEY = /^\d{4}-\d{2}(-\d{2})?$/;
const NODE_KEY = /^zoew_/;                 // ឈ្មោះ node កម្រិតកំពូល
const FIELD_KEY = /^[a-z][A-Za-z]*$/;      // ឈ្មោះវាល camelCase ៖ barcodes · codDollar
const isStructKey = (k) => DATE_KEY.test(k) || NODE_KEY.test(k) || FIELD_KEY.test(k);
let hashed = 0, dropped = 0, kept = 0;
function walk(node, keyName, parentName, rootName) {
    if (Array.isArray(node)) return node.map((x) => walk(x, keyName, parentName, rootName));
    if (node === null || typeof node !== 'object') {
        if (AS_PHONE.has(keyName)) { hashed++; return h(node); }
        if (AS_CODE.has(keyName)) { hashed++; return h(keyName === 'code' || keyName === 'barcode' ? barcodeKey(node) : node); }
        if (KEEP_EXACT.has(keyName) || typeof node === 'boolean'
            || (typeof node === 'number' && ((rootName === 'zoew_daily_collected_cod_dod' && (keyName === 'c' || keyName === 'd'))
                || (rootName === 'zoew_daily_pickup_cod_dod' && parentName === 'pickedUpPhones')))) { kept++; return node; }
        hashed++; return h(node);
    }
    const res = {};
    Object.keys(node).forEach((k) => {
        if (DROP.has(k)) { dropped++; return; }
        // ⛔ កូនសោ (key) ក៏អាចជា PII ដែរ ៖ id ធាតុ · phoneKey · barcodeKey
        let outKey = k;
        if (isStructKey(k)) { kept++; }
        else if (/^[0-9+]{6,}$/.test(k)) { outKey = h(k); hashed++; }
        else { outKey = h(k); hashed++; }   // ⛔ អ្វីដែលនៅសល់ជាអត្តសញ្ញាណ ➜ hash (fail closed)
        res[outKey] = walk(node[k], k, keyName, rootName || (keyName === '' ? k : ''));
    });
    return res;
}
const clean = walk(db, '');
requireDistinctOutput();
fs.writeFileSync(out, JSON.stringify(clean), { mode: 0o600 });

// ⛔ ជាន់ការពារ ៖ ស្កេនលទ្ធផលរកលំនាំដែលមើលទៅដូចលេខទូរស័ព្ទ
const text = fs.readFileSync(out, 'utf8');
// ⛔ ថ្ងៃ (`2026-09-01`) មិនមែនលេខទូរស័ព្ទ — កុំរាយវាជាការលេច
const leaks = (text.match(/"[0-9+][0-9 +\-]{7,}"/g) || [])
    .filter((v) => !DATE_KEY.test(v.slice(1, -1)));
console.log('Redacted dump written: ' + path.resolve(out));
console.log('  hashed  : ' + hashed);
console.log('  dropped : ' + dropped);
console.log('  numbers/flags kept: ' + kept);
console.log('  size    : ' + (text.length / 1024).toFixed(0) + ' KB');
if (leaks.length) {
    console.log('  WARNING : ' + leaks.length + ' value(s) still look like phone numbers.');
    console.log('            DO NOT SHARE THIS FILE. Report this to the developer.');
    process.exit(1);
}
console.log('  CHECK   : no phone-like values remain - safe to share.');
