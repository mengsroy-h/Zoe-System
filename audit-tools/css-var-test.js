// ⛔ ថ្នាក់កំហុស៖ `var(--x)` ដែល **គ្មានការប្រកាស `--x`** នៅកន្លែងណាទេ។
//
// CSS មិនបោះកំហុសទេ — ការប្រកាសទាំងមូលក្លាយជា **invalid at computed-value
// time** ➜ property នោះធ្លាក់ត្រឡប់ទៅ `unset` ស្ងាត់ៗ។ ដូច្នេះ
// `border: 1px solid var(--border)` (ខណៈអថេរពិតឈ្មោះ `--border-color`)
// មិនត្រឹមតែបាត់ពណ៌ទេ — វាបាត់ **គែមទាំងមូល** ហើយច្បាប់ `border-color`
// ដែលឈរក្រោយវាក៏គ្មានប្រសិទ្ធភាពដែរ (គ្មាន `border-style`)។
//
// 🔴 វាកើតឡើងពិត ៖ ប្លុក `.health-*` (កំណែ 2.28.0) សរសេរ `var(--border)`
// ដែល **មិនដែលមានក្នុងគម្រោង** ➜ ជួរ 🩺 ទាំងអស់គ្មានគែម ហើយ
// `.health-ok/.health-warn/.health-bad` គ្មានប្រសិទ្ធភាពសោះ។ `css-classes.js`
// មិនឃើញវាទេ (វាពិនិត្យ *ឈ្មោះ class* មិនមែន *ឈ្មោះអថេរ*) ហើយ
// `layout-check.js` ក៏មិនឃើញដែរ (គែម ១px មិនប្តូរទទឹង)។
//
// ការប្រកាសអាចមកពី ២ ប្រភព ៖ CSS ខ្លួនវា និង JS
// (`style.setProperty('--chrome-bottom', …)`) ➜ ត្រូវប្រមូល **ទាំង ២**
// បើមិនដូច្នេះការវាស់នឹងរាយ false positive លើអថេរដែលកំណត់ពេលរត់។
const fs = require('fs');
const path = require('path');

const ROOT = process.env.CSSVAR_APP_DIR ? path.resolve(process.env.CSSVAR_APP_DIR) : path.resolve(__dirname, '..');
const APPS = ['ZoeW', 'ZoeKeyGen'];

// អថេរដែល browser ផ្តល់ឲ្យ ឬដែលកំណត់ក្រៅ repo — ត្រូវមានហេតុផលក្នុងមួយធាតុ
const ACCEPTED = {};

let pass = 0;
let fail = 0;
function ok(label, cond, detail) {
    if (cond) { pass++; console.log('  ok   ' + label); return; }
    fail++;
    console.log('  FAIL ' + label + (detail ? '   → ' + detail : ''));
}

function readIfExists(file) {
    try { return fs.readFileSync(file, 'utf8'); } catch (e) { return null; }
}

let scannedFiles = 0;
let totalUses = 0;
const offenders = [];

for (const app of APPS) {
    const dir = path.join(ROOT, app);
    if (!fs.existsSync(dir)) continue;

    const cssFiles = fs.readdirSync(dir).filter((f) => f.endsWith('.css')).map((f) => path.join(dir, f));
    const htmlFiles = fs.readdirSync(dir).filter((f) => f.endsWith('.html')).map((f) => path.join(dir, f));
    const jsFiles = fs.readdirSync(dir).filter((f) => f.endsWith('.js')).map((f) => path.join(dir, f));

    const declared = new Set(Object.keys(ACCEPTED));

    // ១. ការប្រកាសក្នុង CSS ៖ `--name:` នៅខាងឆ្វេងនៃ `:`
    // ២. ការប្រកាសក្នុង HTML ៖ `style="--name: …"`
    [...cssFiles, ...htmlFiles].forEach((file) => {
        const src = readIfExists(file);
        if (src === null) return;
        for (const m of src.matchAll(/(^|[;{"'\s])(--[A-Za-z0-9_-]+)\s*:/g)) declared.add(m[2]);
    });
    // ៣. ការប្រកាសពី JS ៖ `style.setProperty('--name', …)`
    jsFiles.forEach((file) => {
        const src = readIfExists(file);
        if (src === null) return;
        for (const m of src.matchAll(/setProperty\(\s*['"](--[A-Za-z0-9_-]+)['"]/g)) declared.add(m[1]);
    });

    // ការប្រើ ៖ `var(--name)` គ្រប់កន្លែង (CSS · HTML inline style · JS template)
    [...cssFiles, ...htmlFiles, ...jsFiles].forEach((file) => {
        const src = readIfExists(file);
        if (src === null) return;
        scannedFiles++;
        const lines = src.split('\n');
        lines.forEach((line, i) => {
            for (const m of line.matchAll(/var\(\s*(--[A-Za-z0-9_-]+)\s*([,)])/g)) {
                totalUses++;
                // `var(--x, fallback)` មាន fallback ➜ វានៅតែដំណើរការ បើអថេរបាត់
                if (m[2] === ',') continue;
                if (declared.has(m[1])) continue;
                offenders.push(app + '/' + path.basename(file) + ':' + (i + 1) + '  ' + m[1]);
            }
        });
    });
}

ok('ស្កេនឯកសារ ' + scannedFiles + ' · រកឃើញការប្រើ var(--x) ' + totalUses + ' កន្លែង', true);
// ⛔ ជាន់អប្បបរមា ៖ ការអះអាង «គ្មានអថេរបាត់» ពិតដោយស្វ័យប្រវត្តិលើ input ទទេ
ok('⛔ ជាន់អប្បបរមា ៖ ស្កេនឃើញឯកសារយ៉ាងតិច ២ និងការប្រើយ៉ាងតិច ១០០ កន្លែង',
    scannedFiles >= 2 && totalUses >= 100, 'files=' + scannedFiles + ' uses=' + totalUses);

if (offenders.length === 0) {
    ok('រាល់ `var(--x)` គ្មាន fallback មានការប្រកាស `--x` ពិត', true);
} else {
    ok('រាល់ `var(--x)` គ្មាន fallback មានការប្រកាស `--x` ពិត', false,
        offenders.length + ' កន្លែង ៖ ' + offenders.slice(0, 8).join(' | '));
    offenders.slice(0, 30).forEach((o) => console.log('       ⚠ ' + o));
}

console.log('');
if (fail) {
    console.log('❌ ធ្លាក់ ' + fail + ' (ok ' + pass + ')');
    process.exit(1);
}
console.log('✅ ok ' + pass);
