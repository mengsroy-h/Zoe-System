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

const file = process.argv[2];
if (!file) {
    console.log('Usage: node audit-tools/redact-dump.js <dump.json|dump.json.gz> [out.json]');
    console.log('  Produces a PII-free copy that is safe to share.');
    process.exit(2);
}
if (!fs.existsSync(file)) { console.log('ERROR: file not found: ' + file); process.exit(1); }
const out = process.argv[3] || file.replace(/\.json(\.gz)?$/, '') + '-redacted.json';

let raw = fs.readFileSync(file);
if (file.endsWith('.gz')) raw = zlib.gunzipSync(raw);
let db;
try { db = JSON.parse(raw.toString('utf8')); }
catch (e) { console.log('ERROR: cannot read the file as JSON: ' + e.message); process.exit(1); }

// salt ចៃដន្យក្នុងមួយការរត់ ➜ ⛔ hash **បញ្ច្រាសមិនបាន** ទោះដឹងលេខទូរស័ព្ទក៏ដោយ
const SALT = crypto.randomBytes(16);
const memo = new Map();
function h(prefix, value) {
    const v = String(value === undefined || value === null ? '' : value);
    if (!v) return v;
    const k = prefix + ' ' + v;
    if (memo.has(k)) return memo.get(k);
    const d = crypto.createHash('sha256').update(SALT).update(k).digest('hex').slice(0, 8);
    const r = prefix + '_' + d;
    memo.set(k, r);
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
function walk(node, keyName) {
    if (Array.isArray(node)) return node.map((x) => walk(x, keyName));
    if (node === null || typeof node !== 'object') {
        if (typeof node === 'number' || typeof node === 'boolean') { kept++; return node; }
        if (AS_PHONE.has(keyName)) { hashed++; return h('ph', node); }
        if (AS_CODE.has(keyName)) { hashed++; return h('bc', node); }
        if (KEEP_EXACT.has(keyName)) { kept++; return node; }
        hashed++; return h('x', node);
    }
    const res = {};
    Object.keys(node).forEach((k) => {
        if (DROP.has(k)) { dropped++; return; }
        // ⛔ កូនសោ (key) ក៏អាចជា PII ដែរ ៖ id ធាតុ · phoneKey · barcodeKey
        let outKey = k;
        if (isStructKey(k)) { kept++; }
        else if (/^[0-9+]{6,}$/.test(k)) { outKey = h('ph', k); hashed++; }
        else { outKey = h('k', k); hashed++; }   // ⛔ អ្វីដែលនៅសល់ជាអត្តសញ្ញាណ ➜ hash (fail closed)
        res[outKey] = walk(node[k], k);
    });
    return res;
}
const clean = walk(db, '');
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
