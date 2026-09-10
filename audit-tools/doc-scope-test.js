// ⛔ **អ្នកយាមនៃ *វិសាលភាពឯកសារ* — README សរសេរតែ «របៀបប្រើ»។**
//
// ច្បាប់ទី ៩ របស់ `CLAUDE.md` ចែងថា README ត្រូវសរសេរតែ **របៀបប្រើ** ៖
// ⛔ គ្មានប្រវត្តិកំហុស · គ្មានកំណត់ត្រាតាមកំណែ · គ្មានចំនួន assertion ចាក់
// ជា literal។ ប្រវត្តិទាំងអស់ទៅ `docs/HISTORY.md` **តែមួយកន្លែងគត់**។
//
// 🔴 ហេតុអ្វីវាមាន (2026-09-10) ៖ ច្បាប់នោះសរសេររួចនៅ **២ កន្លែង**
// (`CLAUDE.md` ច្បាប់ ៩ និង `audit-tools/README.md` ខ្លួនឯង) — ហើយវានៅតែ
// ត្រូវបំពាន ៖ `zto-import/README.md` រាយ «បច្ចុប្បន្នមាន **៥០ assertions**»
// ខណៈតេស្តពិតបោះពុម្ព **៦៩** ➜ ឯកសារខុស **១៩** ដោយគ្មាននរណាដឹង។
// **អ្នកប្រើចាប់បានដោយភ្នែក មិនមែនឧបករណ៍ទេ** — នេះជាថ្នាក់ «ការកត់ត្រា
// មិនមែនជាការអនុវត្ត» ដដែលដែល `CLAUDE.md` ដាស់តឿននៅដើមឯកសារ។
//
// ⛔ គ្មាន checker ណាមួយអាន README សោះមុននេះ (វាស់បាន ៖ ៣ ឯកសារយោង README
// តែសុទ្ធតែប្រើវាដោយចៃដន្យ — `strip-comments` លើកលែងវា · `version-bump-scope`
// ប្រើផ្លូវ · `zto-cookie-sync-test` យោងឈ្មោះ)។

const fs = require('fs');
const path = require('path');

const ROOT = process.env.DOCSCOPE_APP_DIR || path.join(__dirname, '..');

let pass = 0, fail = 0;
function ok(n) { console.log('  ok    ' + n); pass++; }
function bad(n, d) { console.log('  FAIL  ' + n + (d ? '\n        ' + d : '')); fail++; }
function check(c, n, d) { c ? ok(n) : bad(n, d); }

// README ដែលច្បាប់ទី ៩ គ្រប ➜ ត្រូវមានផ្នែក ៥ តាមលំដាប់
const SECTIONED = [
    'README.md',
    'ZoeW/README.md',
    'ZoeKeyGen/README.md',
    'audit-tools/README.md',
    'firebase-backup/README.md',
    'zto-import/README.md',
    'tools/zto-cookie-sync-windows/README-KH.md'
];
// ឯកសារ «របៀបប្រើ» ដទៃ ៖ ច្បាប់ **ខ្លឹមសារ** អនុវត្តដែរ តែមិនមានផ្នែក ៥ ទេ
const CONTENT_ONLY = [
    'ZoeW/ZTO-SETUP-KH.md',
    'zto-import/google-sheets-api/README.md'
];

const SECTIONS = ['កំណែ', 'មុខងារ', 'របៀបប្រើប្រាស់', 'ប្រព័ន្ធសុវត្ថិភាព', 'អាជ្ញាប័ណ្ណ'];

// ⛔ លំនាំដែលហាម — រាល់មួយមានហេតុផល ៖
const BANNED = [
    { re: /បច្ចុប្បន្នមាន\s*\*{0,2}[0-9០-៩,]+\s*assertion/,
      why: 'ចំនួន assertion ចាក់ជា literal — វាចាស់លឿន (ច្បាប់ ៩)' },
    { re: /\*{0,2}[0-9០-៩,]+\s*(assertions|ការអះអាង)\*{0,2}\s*(។|$)/m,
      why: 'ចំនួន assertion ចាក់ជា literal — វាចាស់លឿន (ច្បាប់ ៩)' },
    { re: /កំហុស(ផលិតកម្ម|លុយ)ពិត/,
      why: 'ប្រវត្តិកំហុស — ត្រូវទៅ docs/HISTORY.md' },
    { re: /ជុំ\s*2\.[0-9]+\.[0-9]+/,
      why: 'កំណត់ត្រាតាមកំណែ — ត្រូវទៅ docs/HISTORY.md' },
    { re: /កំណែ\s*2\.[0-9]+\.[0-9]+\s*(កែ|ដក|បន្ថែម|ធានា|ប្តូរ)/,
      why: 'កំណត់ត្រាតាមកំណែ — ត្រូវទៅ docs/HISTORY.md' },
    { re: /វាស់បាន\s*\(\s*2\.[0-9]+\.[0-9]+/,
      why: 'ការវាស់ចងនឹងកំណែ — ត្រូវទៅ docs/HISTORY.md' }
];

let scanned = 0;
const offenders = [];

function scanContent(rel) {
    const file = path.join(ROOT, rel);
    if (!fs.existsSync(file)) return null;
    scanned++;
    const text = fs.readFileSync(file, 'utf8');
    text.split('\n').forEach((line, i) => {
        // ⛔ លំនាំ ២ អាចត្រូវនឹងបន្ទាត់ដដែល ➜ រាយ **ម្តង** ក្នុងមួយបន្ទាត់
        const hit = BANNED.find((b) => b.re.test(line));
        if (hit) offenders.push(rel + ':' + (i + 1) + '  ' + hit.why + '\n          ' + line.trim().slice(0, 100));
    });
    return text;
}

for (const rel of SECTIONED) {
    const text = scanContent(rel);
    if (text === null) { bad('រកមិនឃើញ ' + rel); continue; }
    const heads = (text.match(/^## .+$/gm) || []).map((h) => h.replace(/^##\s*/, '').trim());
    const idx = SECTIONS.map((s) => heads.findIndex((h) => h === s));
    check(idx.every((i) => i !== -1), rel + ': មានផ្នែកទាំង ៥ របស់ច្បាប់ ៩',
        SECTIONS.filter((s, i) => idx[i] === -1).join(' · ') + '  |  ឃើញ: ' + heads.join(' · '));
    const present = idx.filter((i) => i !== -1);
    check(present.every((v, i, a) => i === 0 || a[i - 1] < v), rel + ': ផ្នែក ៥ តាមលំដាប់ត្រឹមត្រូវ',
        heads.join(' · '));
}

for (const rel of CONTENT_ONLY) scanContent(rel);

check(offenders.length === 0,
    '⛔ គ្មានប្រវត្តិកំហុស · កំណត់ត្រាតាមកំណែ · ចំនួន assertion ក្នុងឯកសារ «របៀបប្រើ»',
    offenders.join('\n        '));

// ជាន់អប្បបរមា ៖ ការស្កេនត្រូវពិតជាបានឃើញឯកសារ មិនមែនស្កេនអ្វីទទេ
check(scanned >= 7, 'ជាន់អប្បបរមា ៖ ស្កេនឯកសារយ៉ាងតិច ៧', 'ស្កេនបាន ' + scanned);

// ⛔ ទិសផ្ទុយ ៖ ច្បាប់ខ្លួនវាត្រូវនៅរស់ក្នុង CLAUDE.md — បើនរណាលុបច្បាប់ ៩
// ចោល នោះ checker នេះក្លាយជាការចាក់សោដោយគ្មានមូលដ្ឋាន។
const claude = fs.existsSync(path.join(ROOT, 'CLAUDE.md'))
    ? fs.readFileSync(path.join(ROOT, 'CLAUDE.md'), 'utf8') : '';
check(/README សរសេរតែ \*{1,2}របៀបប្រើ\*{1,2}/.test(claude) && /កុំចម្លងចំនួន assertion ចូល README/.test(claude),
    '⛔ ទិសផ្ទុយ ៖ ច្បាប់ ៩ នៅរស់ក្នុង CLAUDE.md (មូលដ្ឋាននៃ checker នេះ)');

// ⛔ ទិសផ្ទុយ ២ ៖ docs/HISTORY.md ត្រូវ **ពិតជាកាន់** ប្រវត្តិនោះ — បើវាទទេ
// នោះមានន័យថាប្រវត្តិត្រូវបានលុប មិនមែនផ្លាស់ទី។
const hist = fs.existsSync(path.join(ROOT, 'docs/HISTORY.md'))
    ? fs.readFileSync(path.join(ROOT, 'docs/HISTORY.md'), 'utf8') : '';
check(/កំណែ|ជុំ/.test(hist) && hist.length > 50000,
    '⛔ ទិសផ្ទុយ ៖ ប្រវត្តិត្រូវ *ផ្លាស់ទី* ទៅ docs/HISTORY.md មិនមែនត្រូវលុប',
    'ទំហំ HISTORY.md = ' + hist.length);

console.log('\n' + (fail ? 'FAIL ' + fail : 'PASS') + '  (' + pass + ')');
process.exit(fail ? 1 : 0);
