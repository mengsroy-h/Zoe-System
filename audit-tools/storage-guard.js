// ថ្នាក់កំហុស៖ localStorage/sessionStorage ដែលសរសេរដោយគ្មាន try/catch។
// នៅលើ Safari Private Mode, ទំហំផ្ទុកពេញ, ឬ browser ដែលបិទ site data
// `setItem` បោះ QuotaExceededError/SecurityError ➜ បំបែកមុខងារដែលហៅវា
// (ឧ. ការស្កេនកញ្ចប់មិនត្រូវបានរក្សាទុក ព្រោះ throw មុនផ្លូវ Save)។
// ច្បាប់៖ រាល់ setItem/removeItem/clear ត្រូវស្ថិតក្នុង try ឬឆ្លងកាត់
//        safeStoreSet()/safeStoreRemove()។
let acorn;
try {
    acorn = require('acorn');
} catch (e) {
    console.error('ត្រូវការ acorn — រត់ `npm i acorn` ជាមុនសិន');
    process.exit(2);
}
const fs = require('fs');
const path = require('path');

const ROOT = process.env.STORAGE_APP_DIR || path.join(__dirname, '..');
// ⚠️ App `ZoeImport` ត្រូវលុបចេញពី repo ក្នុងកំណែ 2.21.0 — មុខងារនាំចូល
// របស់វាផ្លាស់ចូល **ZoeW ផ្ទាល់**។ ដូច្នេះ **ពាក្យសម្ងាត់នាំចូល**
// (`sheetImportPassword`) និង **កូនសោ AES** (`sheetImportKey`) ព្រមទាំងវាល
// `siApiPasswordInput` ក្នុង DOM ឥឡូវរស់នៅក្នុង `ZoeW/app.js` ➜ ការស្កេន
// ZoeW គ្របពួកវារួចហើយ។ ⛔ កុំបន្ថយវិសាលភាពនៃឯកសារដែលស្កេន — នោះជាថ្នាក់
// «checker ស្កេនឯកសារណាខ្លះ» ដដែលនឹង 2.12.1 · 2.16.0 · 2.19.1។
const APPS = ['ZoeW', 'ZoeKeyGen'];
const STORES = new Set(['localStorage', 'sessionStorage']);
const WRITES = new Set(['setItem', 'removeItem', 'clear']);

function walk(node, cb) {
    if (!node || typeof node.type !== 'string') return;
    cb(node);
    for (const key of Object.keys(node)) {
        if (key === 'loc' || key === 'range') continue;
        const value = node[key];
        if (Array.isArray(value)) value.forEach((child) => walk(child, cb));
        else if (value && typeof value.type === 'string') walk(value, cb);
    }
}

let unguarded = 0;
let guarded = 0;
let helperCalls = 0;

for (const app of APPS) {
    const file = path.join(ROOT, app, 'app.js');
    if (!fs.existsSync(file)) continue;
    const src = fs.readFileSync(file, 'utf8');
    const ast = acorn.parse(src, { ecmaVersion: 2022, sourceType: 'script', ranges: true, locations: true });

    const tryBlocks = [];
    walk(ast, (node) => {
        if (node.type === 'TryStatement') tryBlocks.push([node.block.start, node.block.end]);
    });

    const hits = [];
    walk(ast, (node) => {
        if (node.type !== 'CallExpression') return;
        const callee = node.callee;
        if (callee.type === 'Identifier' && (callee.name === 'safeStoreSet' || callee.name === 'safeStoreRemove')) {
            helperCalls++;
            return;
        }
        if (callee.type !== 'MemberExpression' || callee.computed) return;
        const obj = callee.object;
        const prop = callee.property;
        if (obj.type !== 'Identifier' || !STORES.has(obj.name)) return;
        if (prop.type !== 'Identifier' || !WRITES.has(prop.name)) return;
        const inTry = tryBlocks.some(([s, e]) => node.start >= s && node.end <= e);
        if (inTry) { guarded++; return; }
        hits.push(`${app}/app.js:${node.loc.start.line}  ${src.slice(node.start, node.end).slice(0, 80)}`);
    });

    if (hits.length) {
        unguarded += hits.length;
        console.log('\n❌ ' + app + ' — ការសរសេរទៅ storage ដោយគ្មាន try/catch:');
        hits.forEach((h) => console.log('   ' + h));
    }
}

console.log(`\nការសរសេរក្នុង try/catch: ${guarded}   តាម safeStoreSet/safeStoreRemove: ${helperCalls}   គ្មានការការពារ: ${unguarded}`);

// ⛔ **ជាន់អប្បបរមា (positive floor)។** ការអះអាងបែប «គ្មានលំនាំអាក្រក់ទេ»
// ជាការអះអាង **អវត្តមាន** — វាពិតដោយស្វ័យប្រវត្តិលើ input ទទេ។ ដូច្នេះ
// checker នេះត្រូវអះអាងជាមុនសិនថា **វាពិតជាបានឃើញកូដ**។ បើមិនដូច្នេះ ការ
// ប្តូរឈ្មោះឯកសារ · ការផ្លាស់កូដទៅឯកសារថ្មី · ឬ override ថត ដែលខុស នឹង
// ធ្វើឲ្យវាបៃតង **ខណៈវាមិនបានពិនិត្យអ្វីសោះ**។
// មើល `checker-coverage.js` — វាភ្ជាប់ថតទទេចូល checker នេះ រួចអះអាងថាវាធ្លាក់។
const MIN_STORAGE_WRITES = 20;
if (guarded + helperCalls + unguarded < MIN_STORAGE_WRITES) {
    console.log('\n❌ ជាន់អប្បបរមា៖ រំពឹងការសរសេរទៅ storage >= ' + MIN_STORAGE_WRITES
        + ' តែឃើញ ' + (guarded + helperCalls + unguarded)
        + ' — checker នេះមិនបានឃើញកូដទេ');
    process.exit(1);
}
if (unguarded) {
    console.log('\nដំណោះស្រាយ៖ ប្រើ safeStoreSet(localStorage, key, value) / safeStoreRemove(localStorage, key)');
    console.log('ឬរុំក្នុង try { ... } catch (e) {} បើការបរាជ័យអាចមិនអើពើបាន។');
    process.exit(1);
}
console.log('\n✅ រាល់ការសរសេរទៅ storage មានការការពារ');
