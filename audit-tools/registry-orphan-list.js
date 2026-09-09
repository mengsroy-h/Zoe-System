// 🔑 បញ្ជីកូនសោ `zoew_barcode_registry` **កំព្រា** ➜ ឯកសារ payload សម្រាប់លុប
//
//   node audit-tools/registry-orphan-list.js <dump.json ឬ dump.json.gz> [out.json]
//
// យក dump ៖ Firebase Console ➜ Realtime Database ➜ ⋮ ➜ Export JSON
//
// ⛔ **ឧបករណ៍នេះមិនភ្ជាប់បណ្តាញ និងមិនលុបអ្វីទាំងអស់។** វាបញ្ចេញតែឯកសារ
// `{"KEY": null, …}` ដែលអ្នក **មើលដោយភ្នែកជាមុន** រួចផ្ញើដោយខ្លួនឯង ៖
//
//   curl -X PATCH 'https://<PROJECT>-default-rtdb.<REGION>.firebasedatabase.app/zoew_barcode_registry.json?auth=<SECRET>' \
//        -H 'Content-Type: application/json' --data-binary @<out.json>
//
// ⛔ `PATCH` ជា **merge** ៖ កូនសោដែលមិនរៀបរាប់ **នៅដដែល**។ កុំប្រើ «Import
// JSON» ក្នុង Console — នោះជា **REPLACE** ➜ វាលុប registry ទាំងមូល។
//
// ── ហេតុអ្វីវាមិនលុបឲ្យផ្ទាល់ ─────────────────────────────────────────────
// `CLAUDE.md` ៖ «⛔ ការជួសជុលកូនសោ ដែលមើលទៅដូចកំព្រា ដោយស្វ័យប្រវត្តិ ត្រូវ
// ច្រានចេញ — **ការជាប់អន្ទាក់ថ្លៃតិចជាងលុយស្ទួន**។» កូនសោ registry ជា
// **ជាន់ការពារទី ៤** និងជាជាន់ **ខាង server តែមួយគត់** ប្រឆាំង barcode ស្ទួន
// (ជាន់ ១–៣ អានសតិរបស់ទូរស័ព្ទនោះ)។ ការលុបខុសមួយ ➜ barcode នោះស្កេនចូល
// បានម្តងទៀត ➜ **លុយបូកស្ទួន** ហើយ **គ្មានផ្លូវសាង registry ឡើងវិញក្នុងកូដទេ**។
// ដូច្នេះការសម្រេចចុងក្រោយត្រូវជារបស់ **មនុស្ស** មិនមែនរបស់ script។
//
// ── ច្រកទ្វារសុវត្ថិភាព (ការបដិសេធជាលទ្ធផលត្រឹមត្រូវ) ─────────────────────
//   ១. គ្មាន node `zoew_barcode_registry`          ➜ បដិសេធ
//   ២. ប្រវត្តិ **និង** ធុងសំរាម ទទេទាំង ២          ➜ បដិសេធ (dump មិនពេញ
//      ➜ អ្វីៗនឹងមើលទៅដូចកំព្រា)
//   ៣. កំព្រា **១០០%**                              ➜ បដិសេធ ៖ នេះស្ទើរតែជានិច្ច
//      ជាសញ្ញានៃ **ទម្រង់កូនសោមិនត្រូវគ្នា** (ឧ. dump ដែលសម្អាតរួច)
//      មិនមែន barcode ជាប់អន្ទាក់ទេ — មេរៀនពិតពី commit `b6cc107`
//
// ⛔ អេក្រង់ **មិនបោះពុម្ពលេខ barcode ណាមួយឡើយ** (ច្បាប់ដដែលនឹង
// `money-reality-check.js`) — មានតែចំនួន។ តម្លៃពិតរស់នៅ **ក្នុងឯកសារលទ្ធផល**
// ដែលមិនត្រូវ commit និងមិនត្រូវផ្ញើឲ្យនរណាឡើយ។
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const zlib = require('zlib');

const ROOT = process.env.REGORPHAN_APP_DIR ? path.resolve(process.env.REGORPHAN_APP_DIR) : path.join(__dirname, '..');
const APP_JS = path.join(ROOT, 'ZoeW', 'app.js');
const REGISTRY_NODE = 'zoew_barcode_registry';
const CHUNK_MAX = 5000;

const args = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const file = args[0];
const outArg = args[1];

function die(msg, code) {
    console.log('ERROR: ' + msg);
    process.exit(code === undefined ? 3 : code);
}

if (!file) {
    console.log('Usage: node audit-tools/registry-orphan-list.js <dump.json|dump.json.gz> [out.json]');
    console.log('  Get the dump: Firebase Console -> Realtime Database -> menu -> Export JSON');
    console.log('  Writes {"KEY": null, ...} for orphaned registry keys. It never deletes anything.');
    process.exit(2);
}
if (!fs.existsSync(APP_JS)) die('ZoeW/app.js not found at ' + APP_JS);
if (!fs.existsSync(file)) die('dump file not found: ' + file);

let raw = fs.readFileSync(file);
if (file.endsWith('.gz')) raw = zlib.gunzipSync(raw);
let db;
try { db = JSON.parse(raw.toString('utf8')); }
catch (e) { die('cannot read the file as JSON: ' + e.message); }
if (!db || typeof db !== 'object') die('dump is not a JSON object');

// ⛔ ស្រង់ **កូដពិត** ចេញពី app.js — កុំសរសេររូបមន្តកូនសោឡើងវិញក្នុងឧបករណ៍នេះ
// (កូនសោ ២ រូបមន្ត = ការរាប់ស្ទួន · មេរៀនពិតពី `redact-dump.js`)
const SRC = fs.readFileSync(APP_JS, 'utf8');
function sliceFn(name) {
    let s = SRC.indexOf('function ' + name + '(');
    if (s === -1) return null;
    if (SRC.slice(Math.max(0, s - 6), s) === 'async ') s -= 6;
    let d = 0, started = false, i = SRC.indexOf('{', s);
    for (; i < SRC.length; i++) {
        if (SRC[i] === '{') { d++; started = true; }
        else if (SRC[i] === '}') { d--; if (started && d === 0) { i++; break; } }
    }
    return SRC.slice(s, i);
}
const WANT = ['barcodeRegistryKey', 'rawSnapshotToItemList', 'collectItemBarcodes', 'barcodeEntriesOf'];
const missing = [];
const bodies = WANT.map((n) => {
    const b = sliceFn(n);
    if (b) return b;
    missing.push(n);
    return 'function ' + n + '() { return undefined; }';
}).join('\n');

// ⛔ រូបមន្តកូនសោជាបេះដូងនៃឧបករណ៍នេះ — បើវាបាត់ ចម្លើយគ្មានន័យទេ
if (missing.indexOf('barcodeRegistryKey') !== -1) {
    die('barcodeRegistryKey() not found in ' + APP_JS + ' -> cannot derive registry keys');
}

const sb = { console, String, Object, Array };
vm.createContext(sb);
vm.runInContext(bodies, sb);

const toList = (node) => (sb.rawSnapshotToItemList ? sb.rawSnapshotToItemList(node) : [])
    .filter((x) => x && typeof x === 'object');
const history = toList(db.zoew_scan_history_cod_dod);
const deleted = toList(db.zoew_recently_deleted_cod_dod);
const registry = (db[REGISTRY_NODE] && typeof db[REGISTRY_NODE] === 'object') ? db[REGISTRY_NODE] : null;

console.log('');
console.log('=== registry orphan list (read-only) ===');
console.log('dump          : ' + path.basename(file) + '  (' + (raw.length / 1024).toFixed(0) + ' KB)');
console.log('real fns found: ' + (WANT.length - missing.length) + '/' + WANT.length
    + (missing.length ? '  (missing: ' + missing.join(', ') + ')' : ''));
console.log('history items : ' + history.length);
console.log('trash items   : ' + deleted.length);

// ── ច្រកទ្វារ ១ ៖ គ្មាន node registry ────────────────────────────────────
if (!registry) die('no `' + REGISTRY_NODE + '` node in this dump -> nothing to compute', 4);

// ── ច្រកទ្វារ ២ ៖ dump មិនពេញ ➜ អ្វីៗនឹងមើលទៅដូចកំព្រា ─────────────────
if (!history.length && !deleted.length) {
    console.log('registry keys : ' + Object.keys(registry).length);
    die('this dump has NO history AND NO trash -> every key would look orphaned.\n'
        + '       Export the WHOLE database, not a single node.', 4);
}

// ម្ចាស់ = barcode គ្រប់កន្លែងក្នុងប្រវត្តិ **និង** ធុងសំរាម (ទាំង ២ ខាង)
const owned = new Set();
const addOwned = (code) => { const k = sb.barcodeRegistryKey(code); if (k) owned.add(k); };
[history, deleted].forEach((list) => list.forEach((item) => {
    if (Array.isArray(item.barcodes)) item.barcodes.forEach((b) => { if (b && b.code) addOwned(b.code); });
    else if (item.barcodes && typeof item.barcodes === 'object') {
        Object.keys(item.barcodes).forEach((k) => {
            const b = item.barcodes[k];
            if (b && b.code) addOwned(b.code);
        });
    }
    if (item.barcode) addOwned(item.barcode);
}));

// ⛔ កូនសោក្នុង dump ត្រូវឆ្លងកាត់រូបមន្តដដែល មុនប្រៀបធៀប
const registryKeys = Object.keys(registry);
const normalized = new Map();
registryKeys.forEach((k) => { normalized.set(k, sb.barcodeRegistryKey(k)); });
const orphans = registryKeys.filter((k) => !owned.has(normalized.get(k)));

console.log('registry keys : ' + registryKeys.length);
console.log('owned barcodes: ' + owned.size);
console.log('orphan keys   : ' + orphans.length);
console.log('');

if (!orphans.length) {
    console.log('OK: every registry key has an owner. Nothing to delete.');
    process.exit(0);
}

// ── ច្រកទ្វារ ៣ ៖ ១០០% កំព្រា = ទម្រង់កូនសោមិនត្រូវគ្នា ─────────────────
if (orphans.length === registryKeys.length) {
    console.log('REFUSED: 100% of registry keys look orphaned.');
    console.log('  That is almost always a KEY-FORMAT MISMATCH, not trapped barcodes');
    console.log('  (for example a dump produced by an old redact-dump.js).');
    console.log('  Re-run this on the ORIGINAL dump before deleting anything.');
    process.exit(4);
}

const outBase = outArg || path.join(path.dirname(path.resolve(file)), 'registry-orphans.json');
const chunks = [];
for (let i = 0; i < orphans.length; i += CHUNK_MAX) chunks.push(orphans.slice(i, i + CHUNK_MAX));

const written = [];
chunks.forEach((keys, idx) => {
    const payload = {};
    keys.forEach((k) => { payload[k] = null; });
    const target = chunks.length === 1
        ? outBase
        : outBase.replace(/(\.json)?$/, '.' + (idx + 1) + '.json');
    fs.writeFileSync(target, JSON.stringify(payload, null, 1) + '\n', 'utf8');
    written.push({ file: target, count: keys.length });
});

console.log('WROTE (review these BEFORE sending anything):');
written.forEach((w) => console.log('  ' + w.file + '   (' + w.count + ' keys)'));
console.log('');
console.log('Then, for EACH file, send one PATCH request yourself:');
console.log('');
written.forEach((w) => {
    console.log("  curl -X PATCH \\");
    console.log("    'https://<PROJECT>-default-rtdb.<REGION>.firebasedatabase.app/" + REGISTRY_NODE + ".json?auth=<SECRET>' \\");
    console.log("    -H 'Content-Type: application/json' \\");
    console.log('    --data-binary @' + w.file);
    console.log('');
});
console.log('NOTES');
console.log('  * PATCH merges: keys NOT listed in the file are left untouched.');
console.log('  * Do NOT use Console "Import JSON" on the registry node: that REPLACES it.');
console.log('  * <SECRET> is a real credential. Revoke it when you are done.');
console.log('  * The output file contains real barcodes: do not commit it, do not share it.');
