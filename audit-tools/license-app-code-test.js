// ⛔ ថ្នាក់កំហុស ៖ **rules នៅរាយឈ្មោះ App ដែលលុបចោលរួច**។
//
// License Project ធ្លាប់បម្រើ App ៣ (`ADM` · `ZOW` · `SCN`)។ ក្រោយការបញ្ចូល
// ទាំង ៣ ជា ZoeW តែមួយ កូដ ship ប្រើកូដតែមួយ តែ
// `ZoeKeyGen/firebase-database.rules.json` នៅរាយទាំង ៣ អស់ **២៦ ថ្ងៃ** ដោយ
// គ្មានអ្នកណាឃើញ។ មូលហេតុ ៖
//
// ១. ឯកសារនោះ **មិន deploy ពី repo ទេ** — Netlify បម្រើតែឯកសារ static ➜ rules
//    ត្រូវ paste ចូល Console ដោយដៃ ➜ គ្មានអ្វីបង្ខំវាឲ្យដើរតាមកូដ។
// ២. **គ្មានអ្នកយាម** ៖ `rules-duplicate-keys.js` អានវា តែពិនិត្យតែកូនសោស្ទួន
//    ចំណែក `payload-schema.js` អានតែ rules របស់ **Business**។
// ៣. វា **ចម្លងខ្លួនឯងបន្ត** ៖ ប្លុក `license_seats` ដែលកើតថ្មីស្រឡាង
//    (2.19.28) ក៏ចម្លងបញ្ជីចាស់នោះចូលដែរ។
//
// ⛔ ការវាស់ត្រូវ **ដេរីវេពី `LICENSE_APP_CODE` ពិត** មិនមែនបញ្ជីរឹង —
// បញ្ជីរឹងជាកាលបរិច្ឆេទផុតកំណត់ ៖ ការប្តូរកូដជុំក្រោយនឹងធ្វើឲ្យអ្នកយាម
// ខ្លួនឯងក្លាយជាអ្នកកុហក។
//
// ⛔ ហើយវាចាក់សោ **ស្នាមភ្ជាប់ដែលការពារ Key របស់អតិថិជន** ៖ ZoeKeyGen
// **ចុះហត្ថលេខា** ដោយកូដនោះ (`payload.a`) ខណៈ ZoeW **ផ្ទៀងផ្ទាត់** ដោយកូដ
// របស់ខ្លួន ➜ ការឃ្លាតគ្នា = Key ដែលចេញរួចទាំងអស់ធ្លាក់ `app-mismatch`
// ហើយឧបករណ៍ដែល Activate រួច បាត់ record (កូនសោ `zoe_license_activation_<កូដ>`)។
const fs = require('fs');
const path = require('path');

process.exitCode = 1;

const ROOT = process.env.APPCODE_APP_DIR
    ? path.resolve(process.env.APPCODE_APP_DIR)
    : path.resolve(__dirname, '..');

let pass = 0;
let fail = 0;
function ok(label, cond, detail) {
    if (cond) { pass++; console.log('  ✅ ' + label); return; }
    fail++;
    console.log('  ❌ ' + label + (detail !== undefined ? ' — ' + JSON.stringify(detail) : ''));
}

function read(rel) {
    try {
        return fs.readFileSync(path.join(ROOT, rel), 'utf8');
    } catch (e) {
        ok('អានឯកសារ ' + rel, false, e.code || String(e.message));
        return null;
    }
}

console.log('=== license-app-code — rules មិនត្រូវរាយ App ដែលលែងមាន ===');

const keygenSrc = read('ZoeKeyGen/app.js');
const zoewSrc = read('ZoeW/app.js');
const verifySrc = read('ZoeW/license-verify.js');
const rulesText = read('ZoeKeyGen/firebase-database.rules.json');

const APP_CODE_RE = /\bconst LICENSE_APP_CODE = '([A-Z]{2,8})';/;
const keygenCode = keygenSrc && (keygenSrc.match(APP_CODE_RE) || [])[1];
const zoewCode = zoewSrc && (zoewSrc.match(APP_CODE_RE) || [])[1];

ok('រកឃើញ `LICENSE_APP_CODE` ក្នុង ZoeKeyGen/app.js', !!keygenCode, keygenCode);
ok('រកឃើញ `LICENSE_APP_CODE` ក្នុង ZoeW/app.js', !!zoewCode, zoewCode);
// ⛔ ស្នាមភ្ជាប់ស្នូល ៖ អ្នកចុះហត្ថលេខា និងអ្នកផ្ទៀងផ្ទាត់ ត្រូវនិយាយកូដដដែល។
ok('⛔ ZoeKeyGen និង ZoeW ប្រើកូដតែមួយ (ការឃ្លាត = Key ចេញរួចទាំងអស់ធ្លាក់ `app-mismatch`)',
    !!keygenCode && keygenCode === zoewCode, { keygen: keygenCode, zoew: zoewCode });

// កូដ «ទាំងអស់» ត្រូវដេរីវេពី `license-verify.js` ពិត — កុំចាក់ `'ALL'` ជា literal
// ទី ២ ត្រង់នេះ (នោះជាការឃ្លាំមើលឈ្មោះ ២ កន្លែងឯករាជ្យ)។
const wildcard = verifySrc && (verifySrc.match(/payload\.a !== '([A-Z]{2,8})'/) || [])[1];
ok('រកឃើញកូដ «ទាំងអស់» ក្នុង license-verify.js', !!wildcard, wildcard);

const allowed = new Set([keygenCode, zoewCode, wildcard].filter(Boolean));

let rules = null;
if (rulesText !== null) {
    try {
        rules = JSON.parse(rulesText);
    } catch (e) {
        ok('rules JSON ត្រឹមត្រូវ', false, String(e.message));
    }
}

const LITERAL_RE = /'([A-Z]{2,8})'/g;
const offenders = [];
let literalsSeen = 0;
const appCodeNodes = [];
const liveCovered = [];

function walk(node, trail) {
    if (node === null || node === undefined) return;
    if (typeof node === 'string') {
        let m;
        LITERAL_RE.lastIndex = 0;
        while ((m = LITERAL_RE.exec(node)) !== null) {
            literalsSeen++;
            if (!allowed.has(m[1])) offenders.push(trail.join('/') + " ➜ '" + m[1] + "'");
        }
        return;
    }
    if (typeof node !== 'object') return;
    Object.keys(node).forEach((key) => {
        if (key === '$appCode') {
            const validate = node[key] && node[key]['.validate'];
            appCodeNodes.push(trail.join('/') + '/' + key);
            liveCovered.push(typeof validate === 'string'
                && keygenCode !== null
                && validate.indexOf("'" + keygenCode + "'") !== -1);
        }
        walk(node[key], trail.concat(key));
    });
}

if (rules) walk(rules, []);

// ⛔ ជាន់អប្បបរមា ៖ ឯកសារទទេ ឬរចនាសម្ព័ន្ធប្តូរឈ្មោះ ➜ «គ្មានអ្នកបំពាន»
// ពិតដោយស្វ័យប្រវត្តិ ➜ អ្នកយាមបៃតងខណៈវាមិនបានពិនិត្យអ្វីសោះ។
ok('⛔ ជាន់អប្បបរមា ៖ រកឃើញ node `$appCode` យ៉ាងតិច ៣', appCodeNodes.length >= 3, appCodeNodes);
ok('⛔ ជាន់អប្បបរមា ៖ រកឃើញអក្សរកូដក្នុង rules យ៉ាងតិច ៣', literalsSeen >= 3, literalsSeen);

ok('⛔ rules មិនរាយកូដ App ណាក្រៅពីកូដដែលកូដ ship ប្រើពិត',
    offenders.length === 0, offenders);

ok('⛔ រាល់ node `$appCode` ចាក់សោកូដរស់ (ប្លុកថ្មីដែលភ្លេចនាំវាមក ➜ ធ្លាក់)',
    liveCovered.length > 0 && liveCovered.every(Boolean),
    appCodeNodes.filter((p, i) => !liveCovered[i]));

// ទិសផ្ទុយ ១ ៖ អ្នកយាមនេះមិនត្រូវក្លាយជា «ហាមអក្សរធំគ្រប់កន្លែង» —
// កូដរស់ និងកូដ «ទាំងអស់» ត្រូវនៅតែអនុញ្ញាតឲ្យលេចក្នុង rules។
ok('⛔ ទិសផ្ទុយ ៖ កូដរស់នៅតែលេចក្នុង rules ពិត',
    !!keygenCode && !!rulesText && rulesText.indexOf("'" + keygenCode + "'") !== -1, keygenCode);
ok('⛔ ទិសផ្ទុយ ៖ កូដ «ទាំងអស់» នៅតែទទួលក្នុង `scope` (Key ចាស់ផ្ទុកវា)',
    !!wildcard && !!rulesText && rulesText.indexOf("'" + wildcard + "'") !== -1, wildcard);

// ទិសផ្ទុយ ២ ៖ ស្លាក UI ក៏ត្រូវឈប់នៅរស់ដែរ — `APP_LABELS` ដែលនៅកាន់ App
// ដែលលុបចោល ធ្វើឲ្យបញ្ជី Key បង្ហាញឈ្មោះដែលលែងមាន។
const labelsBlock = keygenSrc && (keygenSrc.match(/const APP_LABELS = \{([^}]*)\}/) || [])[1];
const labelKeys = labelsBlock ? (labelsBlock.match(/([A-Z]{2,8})\s*:/g) || []).map((s) => s.replace(/\s*:$/, '')) : null;
ok('រកឃើញ `APP_LABELS` ក្នុង ZoeKeyGen/app.js', !!labelKeys && labelKeys.length > 0, labelKeys);
ok('⛔ `APP_LABELS` មិនកាន់ App ដែលលុបចោលរួច',
    !!labelKeys && labelKeys.every((k) => allowed.has(k)),
    labelKeys && labelKeys.filter((k) => !allowed.has(k)));

// កូនសោ storage ក៏ចងនឹងកូដនោះដែរ ➜ ការឃ្លាតធ្វើឲ្យឧបករណ៍ដែល Activate រួច
// បាត់ record ស្ងាត់ៗ។ ការវាស់ត្រូវដេរីវេ មិនមែនចាក់ literal។
const storageTpl = verifySrc && /'zoe_license_activation_' \+ appCode/.test(verifySrc);
ok('⛔ កូនសោ storage ដេរីវេពី appCode (មិនមែនចាក់ជាអក្សរ)', !!storageTpl);

// ── ឈ្មោះ slot កៅអី ៖ ស្នាមភ្ជាប់ឆ្លង ៣ ឯកសារ ─────────────────────────
// ⛔ ពិដាន «ឧបករណ៍ប៉ុន្មានក្នុង Key ១» អនុវត្តដោយ **ការរាយឈ្មោះ slot**
// ក្នុង rules (RTDB រាប់កូនមិនបាន — គ្មាន `numChildren()`) ➜ ឈ្មោះទាំងនោះ
// រស់នៅ ៣ កន្លែង ៖ `license-verify.js` (client ជ្រើស slot) ·
// `ZoeKeyGen/app.js` (រាប់ និងបង្ហាញ) · rules (អនុវត្តពិដាន)។
// ⛔ ការឃ្លាតគ្នា = client សុំ slot ដែល server មិនស្គាល់ ➜ **អតិថិជនដែល
// បង់ថ្លៃ ២ ឧបករណ៍ Activate បានតែ ១** ដោយស្ងាត់។
function slotsFrom(src, name) {
    const m = src && src.match(new RegExp('const ' + name + " = \\[([^\\]]*)\\]"));
    if (!m) return null;
    return m[1].split(',').map((x) => x.trim().replace(/^'|'$/g, '')).filter(Boolean);
}

const verifySlots = slotsFrom(verifySrc, 'LICENSE_SEAT_SLOTS');
const keygenSlots = slotsFrom(keygenSrc, 'LICENSE_SEAT_SLOT_NAMES');
ok('រកឃើញឈ្មោះ slot ក្នុង license-verify.js', !!verifySlots && verifySlots.length > 0, verifySlots);
ok('រកឃើញឈ្មោះ slot ក្នុង ZoeKeyGen/app.js', !!keygenSlots && keygenSlots.length > 0, keygenSlots);
ok('⛔ បញ្ជី slot ត្រូវដូចគ្នាទាំង ២ ឯកសារ',
    !!verifySlots && !!keygenSlots && verifySlots.join(',') === keygenSlots.join(','),
    { verify: verifySlots, keygen: keygenSlots });

const rulesSlots = rulesText
    ? Array.from(new Set((rulesText.match(/\$slot === '([a-z0-9]+)'/g) || [])
        .map((m) => m.replace(/.*'([a-z0-9]+)'.*/, '$1'))))
    : [];
ok('⛔ rules រាយ slot ដដែលនឹងកូដ ship',
    !!verifySlots && rulesSlots.length === verifySlots.length
        && verifySlots.every((x) => rulesSlots.indexOf(x) !== -1),
    { rules: rulesSlots, code: verifySlots });

// ⛔ ពិដានក្នុង schema ត្រូវស្មើចំនួន slot ៖ `maxDevices` ធំជាងចំនួន slot
// គឺជាពិដានដែលអនុវត្តមិនបាន ➜ អ្នកលក់កំណត់ ៦ តែទី ៦ Activate មិនចូល។
const maxRule = rulesText && (rulesText.match(/"maxDevices":\s*\{ "\.validate": "[^"]*<= (\d+)/) || [])[1];
ok('រកឃើញ schema `maxDevices` ក្នុង rules', !!maxRule, maxRule);
ok('⛔ ពិដាន `maxDevices` ត្រូវស្មើចំនួន slot ពិត',
    !!maxRule && !!verifySlots && Number(maxRule) === verifySlots.length,
    { rules: maxRule, slots: verifySlots && verifySlots.length });

// ⛔ ទិសផ្ទុយ ៖ slot ត្រូវមានច្រើនជាង ១ បើមិនដូច្នេះមុខងារ «ឧបករណ៍ច្រើន»
// មិនអាចដំណើរការបានទាល់តែសោះ ខណៈការអះអាងខាងលើនៅតែបៃតង។
ok('⛔ ទិសផ្ទុយ ៖ មាន slot ច្រើនជាង ១ (បើមាន ១ ពិដានលើសពី ១ គ្មានន័យ)',
    !!verifySlots && verifySlots.length > 1, verifySlots && verifySlots.length);

console.log('');
if (fail) { console.log('❌ ធ្លាក់ ' + fail + ' / ok ' + pass); process.exitCode = 1; }
else if (!pass) { console.log('❌ គ្មានការអះអាងណារត់សោះ'); process.exitCode = 1; }
else { console.log('✅ ជោគជ័យ ' + pass); process.exitCode = 0; }
