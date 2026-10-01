// ⛔ **អ្នកយាមនៃ *វិសាលភាពឯកសារ* — README សរសេរតែ «របៀបប្រើ»។**
//
// ច្បាប់ទី ៩ របស់ `CLAUDE.md` ចែងថា README ត្រូវសរសេរតែ **របៀបប្រើ** ៖
// ⛔ គ្មានប្រវត្តិកំហុស · គ្មានកំណត់ត្រាតាមកំណែ · គ្មានចំនួន assertion ចាក់
// ជា literal។ ប្រវត្តិទាំងអស់ទៅ `docs/HISTORY.md` / `docs/HISTORY-ARCHIVE.md` **តែមួយកន្លែងគត់**។
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
    'supabase/README.md',
    'tools/zto-cookie-sync-windows/README-KH.md',
    'tools/zto-cookie-sync-windows/README-ANDROID-KH.md',
    'tools/money-check-windows/README-KH.md',
    'tools/firebase-provision/README-KH.md'
];
// ឯកសារ «របៀបប្រើ» ដទៃ ៖ ច្បាប់ **ខ្លឹមសារ** អនុវត្តដែរ តែមិនមានផ្នែក ៥ ទេ
const CONTENT_ONLY = [
    'ZoeW/ZTO-SETUP-KH.md',
    'zto-import/google-sheets-api/README.md'
];

const SECTIONS = ['កំណែ', 'មុខងារ', 'របៀបប្រើប្រាស់', 'ប្រព័ន្ធសុវត្ថិភាព', 'អាជ្ញាប័ណ្ណ'];

// ⛔ បញ្ជីរឹងខាងលើជា **កាលបរិច្ឆេទផុតកំណត់** ៖ README ដែលកើត *ក្រោយ* វា
// មិនចូលបញ្ជី ➜ ច្បាប់ ៩ នៅរស់ តែឯកសារនោះ **គ្មានអ្នកយាមសោះ**។ វាស់បាន
// (2026-09-11) ៖ `tools/money-check-windows/README-KH.md` រស់ក្នុង repo
// ដោយគ្មានឈ្មោះក្នុងបញ្ជីណាមួយ — ហើយក៏គ្មានឯកសារណាយោងវាដែរ។ ដូច្នេះ
// បញ្ជីត្រូវ **ប្រៀបធៀបនឹងថតពិត** មិនមែនជឿខ្លួនឯង។
function listReadmeFiles(dir, rel, out) {
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return out; }
    entries.forEach((entry) => {
        if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'docs') return;
        const next = rel ? rel + '/' + entry.name : entry.name;
        if (entry.isDirectory()) listReadmeFiles(path.join(dir, entry.name), next, out);
        else if (/^README.*\.md$/i.test(entry.name)) out.push(next);
    });
    return out;
}

// ⛔ **ច្បាប់ «ប្រវត្តិកំហុសរស់នៅ `docs/HISTORY.md` តែមួយកន្លែង» គ្រប
// *គ្រប់ឯកសារ* មិនត្រឹម README ទេ** (សំណើម្ចាស់គម្រោង)។ `listReadmeFiles()`
// ឃើញតែ `README*.md` ➜ ឯកសារ «របៀបប្រើ» ឈ្មោះផ្សេង (`ZTO-SETUP-KH.md` ជាដើម)
// ពឹងលើ **បញ្ជីរឹង** `CONTENT_ONLY` ➜ ឯកសារថ្មីឈ្មោះផ្សេងរអិលកាត់ទាំងស្រុង។
// នេះជាថ្នាក់ «បញ្ជីរឹង = កាលបរិច្ឆេទផុតកំណត់» ដដែល ➜ ដេរីវេពី **ថតពិត**។
// ⛔ លើកលែង ៖ `docs/` **នៅ root តែប៉ុណ្ណោះ** (ផ្ទះរបស់ប្រវត្តិ) និង `CLAUDE.md` (ឯកសារច្បាប់ ➜ វា
// *ត្រូវតែ* យោងការវាស់ជាហេតុផលនៃច្បាប់)។ ⛔ ថត `docs` ក្នុង App (`ZoeW/docs/`) **មិនមែន** ផ្ទះរបស់ប្រវត្តិ ៖
// ការលើកលែងតាម *ឈ្មោះថត* គ្រប់ជម្រៅ ធ្លាប់ធ្វើឲ្យ `ZoeW/docs/*.md` (លទ្ធផល parity ឆៅ · ប្រវត្តិការរកឃើញ)
// **គ្មាននរណាស្កេនសោះ** ➜ ប្រវត្តិរស់នៅ ២ កន្លែង ខណៈច្បាប់និយាយ «តែមួយ»។
function listAllDocs(dir, rel, out) {
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return out; }
    entries.forEach((entry) => {
        if (entry.name === 'node_modules' || entry.name === '.git' || (!rel && entry.name === 'docs')) return;
        const next = rel ? rel + '/' + entry.name : entry.name;
        if (entry.isDirectory()) listAllDocs(path.join(dir, entry.name), next, out);
        else if (/\.md$/i.test(entry.name) && next !== 'CLAUDE.md') out.push(next);
    });
    return out;
}

const KNOWN_DOCS = SECTIONED.concat(CONTENT_ONLY);
const FOUND_READMES = listReadmeFiles(ROOT, '', []);
check(FOUND_READMES.length >= 7,
    'ជាន់អប្បបរមា ៖ រកឃើញ README យ៉ាងតិច ៧ ក្នុងថតពិត', String(FOUND_READMES.length));
const UNGUARDED_DOCS = FOUND_READMES.filter((rel) => KNOWN_DOCS.indexOf(rel) === -1);
check(UNGUARDED_DOCS.length === 0,
    '⛔ រាល់ README ក្នុង repo ត្រូវឈរក្នុងបញ្ជីរបស់ checker នេះ (បញ្ជីរឹង = កាលបរិច្ឆេទផុតកំណត់)',
    'គ្មានអ្នកយាម ៖ ' + UNGUARDED_DOCS.join(' · '));

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
      why: 'ការវាស់ចងនឹងកំណែ — ត្រូវទៅ docs/HISTORY.md' },
    // ⛔ លំនាំ ៣ ខាងក្រោមបន្ថែមក្រោយការវាស់ ៖ ជំនាន់មុនរបស់បញ្ជីនេះទាមទារ
    // **កិរិយាសព្ទ** ជាប់នឹងលេខកំណែ (`កំណែ 2.x.y កែ|ដក|បន្ថែម…`) ➜ ប្រយោគ
    // បែប «ចាប់ពីកំណែ 2.35.1 **ការអាន**វាលនេះ…» រអិលកាត់ ព្រោះ «ការអាន»
    // មិននៅក្នុងបញ្ជីកិរិយាសព្ទ។ កំណត់ត្រាតាមកំណែ **គ្រប់ទម្រង់** ត្រូវទៅ
    // `docs/HISTORY.md` ➜ ចាក់សោលេខកំណែខ្លួនវា មិនមែនពាក្យជុំវិញវា។
    { re: /(សំណើម្ចាស់គម្រោង|សំណើអ្នកប្រើ)\s*20[0-9]{2}-[0-9]{2}-[0-9]{2}/,
      why: 'សំណើចងនឹងកាលបរិច្ឆេទ (ប្រវត្តិ) — ត្រូវទៅ docs/HISTORY.md' },
    { re: /វាស់បាន\s*\(\s*20[0-9]{2}-[0-9]{2}-[0-9]{2}/,
      why: 'ការវាស់ចងនឹងកាលបរិច្ឆេទ — ត្រូវទៅ docs/HISTORY.md' }
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

// ⛔ **ការបោសសំអាតតាមផ្ទៃ** ៖ បន្ថែមលើបញ្ជីដែលសរសេរដោយដៃខាងលើ ត្រូវស្កេន
// **រាល់ `.md` ក្នុង repo** (ក្រៅពី `docs/` និង `CLAUDE.md`) ➜ ឯកសារថ្មី
// ឈ្មោះណាក៏ដោយ ធ្លាក់ក្រោមច្បាប់នេះភ្លាម ដោយមិនចាំបាច់ចុះឈ្មោះ។
const ALL_DOCS = listAllDocs(ROOT, '', []);
const alreadyScanned = new Set(KNOWN_DOCS);
for (const rel of ALL_DOCS) {
    if (alreadyScanned.has(rel)) continue;
    alreadyScanned.add(rel);
    scanContent(rel);
}
check(ALL_DOCS.length >= FOUND_READMES.length,
    'ជាន់អប្បបរមា ៖ ការស្កេន `.md` ទាំងអស់ គ្របយ៉ាងតិចស្មើចំនួន README',
    ALL_DOCS.length + ' ធៀប ' + FOUND_READMES.length);
check(ALL_DOCS.indexOf('ZoeW/ZTO-SETUP-KH.md') !== -1,
    'ជាន់អប្បបរមា ៖ ការដេរីវេចាប់បានឯកសារ «របៀបប្រើ» ដែលមិនមែន README',
    ALL_DOCS.join(' · '));

check(offenders.length === 0,
    '⛔ គ្មានប្រវត្តិកំហុស · កំណត់ត្រាតាមកំណែ · ចំនួន assertion ក្នុងឯកសារ «របៀបប្រើ»',
    offenders.join('\n        '));

// ជាន់អប្បបរមា ៖ ការស្កេនត្រូវពិតជាបានឃើញឯកសារ មិនមែនស្កេនអ្វីទទេ
check(scanned >= 7, 'ជាន់អប្បបរមា ៖ ស្កេនឯកសារយ៉ាងតិច ៧', 'ស្កេនបាន ' + scanned);
check(scanned === alreadyScanned.size,
    'ជាន់អប្បបរមា ៖ រាល់ឯកសារក្នុងបញ្ជីត្រូវបានស្កេនពិត (គ្មានផ្លូវបាត់)',
    scanned + ' ធៀប ' + alreadyScanned.size);

// ⛔ ទិសផ្ទុយ ៖ ច្បាប់ខ្លួនវាត្រូវនៅរស់ក្នុង CLAUDE.md — បើនរណាលុបច្បាប់ ៩
// ចោល នោះ checker នេះក្លាយជាការចាក់សោដោយគ្មានមូលដ្ឋាន។
const claude = fs.existsSync(path.join(ROOT, 'CLAUDE.md'))
    ? fs.readFileSync(path.join(ROOT, 'CLAUDE.md'), 'utf8') : '';
check(/README សរសេរតែ \*{1,2}របៀបប្រើ\*{1,2}/.test(claude) && /កុំចម្លងចំនួន assertion ចូល README/.test(claude),
    '⛔ ទិសផ្ទុយ ៖ ច្បាប់ ៩ នៅរស់ក្នុង CLAUDE.md (មូលដ្ឋាននៃ checker នេះ)');
// ⛔ ទិសផ្ទុយ ៖ ច្បាប់ដែលពង្រីកវិសាលភាពទៅ **គ្រប់ `.md`** ក៏ត្រូវរស់ក្នុង
// `CLAUDE.md` ដែរ — បើអត់ ការស្កេនទូលាយក្លាយជាការចាក់សោគ្មានមូលដ្ឋាន។
check(/ប្រវត្តិកំហុស.{0,40}`docs\/HISTORY\.md`.{0,60}`docs\/HISTORY-ARCHIVE\.md`.{0,40}តែមួយកន្លែងគត់/s.test(claude)
    && /គ្មានឯកសារប្រវត្តិទី ៣/.test(claude)
    && /គ្រប់ឯកសារ `\*\.md`|រាល់ឯកសារ `\*\.md`/.test(claude),
    '⛔ ទិសផ្ទុយ ៖ ច្បាប់ «ប្រវត្តិកំហុស ➜ HISTORY.md តែមួយកន្លែង» គ្របគ្រប់ `.md` នៅរស់ក្នុង CLAUDE.md');

// ⛔ ទិសផ្ទុយ ២ ៖ docs/HISTORY.md ត្រូវ **ពិតជាកាន់** ប្រវត្តិនោះ — បើវាទទេ
// នោះមានន័យថាប្រវត្តិត្រូវបានលុប មិនមែនផ្លាស់ទី។
// ប្រវត្តិរស់នៅ ២ ឯកសារ (សំណើម្ចាស់គម្រោង ៖ សម័យ React ➜ `HISTORY.md` · សម័យ vanilla ➜ `HISTORY-ARCHIVE.md`) ➜
// ការវាស់ត្រូវបូកទាំង ២ ហើយ `HISTORY.md` ត្រូវតភ្ជាប់ទៅ archive (បើអត់ ➜ archive ក្លាយជាឯកសារដែលគ្មាននរណារកឃើញ)។
const readDoc = (rel) => (fs.existsSync(path.join(ROOT, rel)) ? fs.readFileSync(path.join(ROOT, rel), 'utf8') : '');
const hist = readDoc('docs/HISTORY.md');
const histArchive = readDoc('docs/HISTORY-ARCHIVE.md');
check(/កំណែ|ជុំ/.test(hist) && /កំណែ|ជុំ/.test(histArchive) && hist.length + histArchive.length > 50000,
    '⛔ ទិសផ្ទុយ ៖ ប្រវត្តិត្រូវ *ផ្លាស់ទី* ទៅ docs/HISTORY.md · docs/HISTORY-ARCHIVE.md មិនមែនត្រូវលុប',
    'ទំហំ HISTORY.md = ' + hist.length + ' · HISTORY-ARCHIVE.md = ' + histArchive.length);
check(/\]\(HISTORY-ARCHIVE\.md\)/.test(hist),
    '⛔ docs/HISTORY.md តភ្ជាប់ទៅ docs/HISTORY-ARCHIVE.md (archive ត្រូវរកឃើញបាន)');
// ⛔ ឯកសារប្រវត្តិទី ៣ ក្នុង `docs/` = ប្រវត្តិដែលគ្មាននរណាអាន ➜ ច្បាប់ ៩ «គ្មានឯកសារប្រវត្តិទី ៣»។
const extraHistory = (fs.existsSync(path.join(ROOT, 'docs')) ? fs.readdirSync(path.join(ROOT, 'docs')) : [])
    .filter((n) => /\.md$/.test(n) && /HISTORY|ARCHIVE|CHANGELOG/i.test(n) && !['HISTORY.md', 'HISTORY-ARCHIVE.md'].includes(n));
check(extraHistory.length === 0, '⛔ ច្បាប់ ៩ ៖ គ្មានឯកសារប្រវត្តិទី ៣ ក្នុង docs/', extraHistory.join(' · '));

// ============================================================================
// ផ្នែក ៤ — `docs/AUDIT-PROMPT.md` មិនត្រូវចាស់ស្ងាត់ៗ
// ============================================================================
//
// 🔴 ហេតុអ្វីវាមាន (2026-09-10) ៖ `docs/AUDIT-PROMPT.md` ចែងនៅជួរទី ១ របស់វា
// ថា «ត្រូវ update **ក្នុង commit ដដែល** នៃរាល់ជុំ audit» — ហើយវា **ចាស់ ៦ ជុំ**
// (`2.31.8` ➜ `2.31.13`) ៖ ក្បាលតារាងនៅសរសេរ «2.31.7» ខណៈ App ship `2.31.13`។
// **អ្នកប្រើចាប់បាន មិនមែនឧបករណ៍ទេ** — ថ្នាក់ដដែលនឹងផ្នែក ១ ខាងលើ។
//
// ⛔ ឯកសារនេះ **មិនស្ថិតក្នុង `CONTENT_ONLY`** ដោយចេតនា ៖ វាជា prompt ធ្វើការ
// ➜ វា **ត្រូវតែ** យោងលេខកំណែ (ផ្ទុយពី README)។ អ្វីដែលចាក់សោគឺ **ភាពស្រស់**
// មិនមែនវិសាលភាព។
//
// ⛔ អ្វីដែលវាស់ជា **ស្នាមភ្ជាប់រវាងឯកសារ ២** ៖ ក្បាលតារាងត្រូវនិយាយឈ្មោះកំណែ
// ដែល **ដេរីវេពី `APP_VERSION` ពិត** — មិនមែន literal ២ ខាងឯករាជ្យ (នោះជាការ
// ស៊ីគ្នាដោយចៃដន្យ)។ ជុំដែលកែតែឯកសារ (គ្មានការឡើងកំណែ) នៅតែឆ្លងកាត់ ព្រោះ
// កំណែមិនប្រែ ➜ ក្បាលមិនចាំបាច់ប្រែ។

const PROMPT_REL = 'docs/AUDIT-PROMPT.md';
const promptFile = path.join(ROOT, PROMPT_REL);
const prompt = fs.existsSync(promptFile) ? fs.readFileSync(promptFile, 'utf8') : null;

function appVersionOf(rel) {
    const f = path.join(ROOT, rel);
    if (!fs.existsSync(f)) return null;
    const m = fs.readFileSync(f, 'utf8').match(/APP_VERSION\s*=\s*'([0-9]+\.[0-9]+\.[0-9]+)'/);
    return m ? m[1] : null;
}
const shipped = ['ZoeW/app.js', 'ZoeKeyGen/app.js'].map(appVersionOf).filter(Boolean);

// ជាន់អប្បបរមា ៖ បើអានកំណែពិតមិនបាន នោះការអះអាងខាងក្រោមគ្មានមូលដ្ឋាន ➜ ត្រូវធ្លាក់
check(shipped.length === 2, PROMPT_REL + ': អានបាន APP_VERSION ពិតរបស់ App ទាំង ២',
    'អានបាន ' + shipped.length + ' — ការអះអាងភាពស្រស់គ្មានមូលដ្ឋាន');

if (prompt === null) {
    bad(PROMPT_REL + ': រកមិនឃើញ');
} else {
    const head = (prompt.match(/^##\s*តារាង «អ្វីដែលប្រែធៀបនឹងជុំមុន».*$/m) || [])[0] || '';
    check(head !== '', PROMPT_REL + ': មានក្បាលតារាង «អ្វីដែលប្រែធៀបនឹងជុំមុន»');
    // ⛔ **`some()` មិនគ្រប់គ្រាន់ទេ** — ក្បាលតារាងដាក់ឈ្មោះ App **ទាំង ២**
    // ➜ ការទាមទារត្រឹម «កំណែណាមួយត្រូវ» ធ្វើឲ្យ App ដែល **មិន** ឡើងកំណែក្នុង
    // ជុំនោះ (ZoeKeyGen ជាញឹកញាប់) ក្លាយជា **អាជ្ញាបណ្ណឲ្យ ZoeW ចាស់**។
    // 🔴 វាស់បាន (2026-09-15) ៖ ក្បាលរាយ «ZoeW 2.35.0 · ZoeKeyGen 2.19.23»
    // ខណៈ ZoeW ship **2.35.2** — checker រាយ PASS ព្រោះ `2.19.23` ត្រូវ។
    // ⛔ ការកែ ៖ **ឈ្មោះ App នីមួយៗដែលលេចក្នុងក្បាល ត្រូវអមដោយកំណែ ship
    // របស់វាផ្ទាល់** ➜ គ្មាន App ណាអាចលាក់ខ្លួនក្រោយ App មួយទៀតបានទៀតទេ។
    const APP_VERSION_SOURCES = [
        { name: 'ZoeW', rel: 'ZoeW/app.js' },
        { name: 'ZoeKeyGen', rel: 'ZoeKeyGen/app.js' }
    ];
    const staleApps = [];
    let namedApps = 0;
    APP_VERSION_SOURCES.forEach((app) => {
        const live = appVersionOf(app.rel);
        if (!live) return;
        // ⛔ `ZoeKeyGen` ផ្ទុក `ZoeW` ជា substring ➜ ត្រូវទាមទារព្រំដែនពាក្យ
        const named = new RegExp(app.name + '(?![A-Za-z])\\s*`?([0-9]+\\.[0-9]+\\.[0-9]+)`?').exec(head);
        if (!named) return;
        namedApps++;
        if (named[1] !== live) staleApps.push(app.name + ' ៖ ក្បាល ' + named[1] + ' ≠ ship ' + live);
    });
    check(head !== '' && namedApps >= 1,
        PROMPT_REL + ': ជាន់អប្បបរមា ៖ ក្បាលតារាងដាក់ឈ្មោះ App យ៉ាងតិច ១ ជាមួយកំណែ',
        'ក្បាល: ' + head.trim());
    check(head !== '' && namedApps >= 1 && staleApps.length === 0,
        '⛔ ' + PROMPT_REL + ': កំណែរបស់ **App នីមួយៗ** ក្នុងក្បាលតារាង ត្រូវនឹងអ្វីដែល ship',
        'ក្បាល: ' + head.trim() + '\n        ចាស់: ' + (staleApps.join(' · ') || '(គ្មាន)')
        + '\n        កំណែ ship ពិត: ' + shipped.join(' · ')
        + '\n        ➜ ជុំ audit កែកូដរួច តែភ្លេច update ឯកសារ prompt (ច្បាប់ជួរទី ១ របស់វា)');

    // ⛔ ទិសផ្ទុយ ១ ៖ ច្បាប់ខ្លួនវាត្រូវនៅរស់ក្នុងឯកសារនោះ — បើនរណាលុបច្បាប់
    // «update ក្នុង commit ដដែល» ចោល នោះការអះអាងខាងលើក្លាយជាការចាក់សោគ្មានមូលដ្ឋាន។
    check(/ក្នុង\s*\n?>?\s*commit ដដែល\*{0,2} នៃរាល់ជុំ audit/.test(prompt),
        '⛔ ទិសផ្ទុយ ៖ ច្បាប់ «update ក្នុង commit ដដែល» នៅរស់ក្នុង ' + PROMPT_REL);

    // ⛔ ទិសផ្ទុយ ២ ៖ ឈ្មោះ checker ដែល prompt យោង ត្រូវ **មានពិត** — ការយោង
    // ឧបករណ៍ដែលប្តូរឈ្មោះ ឬលុបចោល ជាទម្រង់ចាស់ស្ងាត់ៗមួយទៀត។
    const referenced = [...new Set((prompt.match(/`[a-z0-9/-]+-test(?:\.js)?`/g) || [])
        .map((s) => s.replace(/`/g, '').replace(/\.js$/, '')))];
    const missing = referenced.filter((n) => !fs.existsSync(path.join(ROOT, 'audit-tools', n + '.js')));
    check(referenced.length >= 6, PROMPT_REL + ': ជាន់អប្បបរមា ៖ យោង checker យ៉ាងតិច ៦',
        'យោងបាន ' + referenced.length);
    check(missing.length === 0, '⛔ ' + PROMPT_REL + ': ឈ្មោះ checker ដែលយោង មានពិតទាំងអស់',
        'រកមិនឃើញ: ' + missing.join(' · '));
}

// ============================================================================
// ផ្នែក ៥ — «README ចាស់ គឺជាឯកសារខុស» (ច្បាប់ ៩)
// ============================================================================
//
// 🔴 ហេតុអ្វីវាមាន (2026-09-10) ៖ ច្បាប់ ៩ ចែងថា README ត្រូវពិនិត្យ **រាល់ជុំ**
// ហើយ «**README ចាស់ គឺជាឯកសារខុស**» — តែផ្នែក ១–៣ ខាងលើវាស់ត្រឹម *រចនាសម្ព័ន្ធ*
// (ផ្នែក ៥ តាមលំដាប់) និង *លំនាំហាម*។ គ្មាននរណាវាស់ **លេខកំណែ** ដែល README
// អះអាងទេ ➜ វាចាស់ស្ងាត់ៗ ៖
//
//   README.md      រាយ ZoeW `2.31.12`  ខណៈ App ship `2.31.14`  (ចាស់ ២ ជុំ)
//   ZoeW/README.md រាយ      `2.31.13`  ខណៈ App ship `2.31.14`
//
// ⛔ **អ្នកប្រើចាប់បាន មិនមែនឧបករណ៍ទេ** — ជាលើកទី ២ ក្នុងជុំដដែល (មើលផ្នែក ៤)។
// នេះជាភស្តុតាងនៃបច្ចេកទេស «បោសសំអាតតាមផ្ទៃ» ៖ ក្រោយបិទថ្នាក់មួយ
// (`AUDIT-PROMPT.md` ចាស់) ត្រូវសួរ «**ឯកសារណាទៀតផ្ទុកកំណែដែលអាចចាស់?**»។
//
// ⛔ អ្វីដែលចាក់សោគឺ **ការអះអាងអំពីកំណែ *បច្ចុប្បន្ន*** ប៉ុណ្ណោះ — ការយោង
// ប្រវត្តិ («ដាច់ពីគ្នាតាំងពី 2.19.4») មិនត្រូវប៉ះទេ។ តម្លៃដែលប្រៀបធៀបត្រូវ
// **ដេរីវេពី `APP_VERSION` ពិត** មិនមែន literal ២ ខាងឯករាជ្យ។

const APPS = { ZoeW: 'ZoeW/app.js', ZoeKeyGen: 'ZoeKeyGen/app.js' };
const shippedVersion = {};
for (const app of Object.keys(APPS)) {
    const f = path.join(ROOT, APPS[app]);
    if (!fs.existsSync(f)) continue;
    const m = fs.readFileSync(f, 'utf8').match(/APP_VERSION\s*=\s*'([0-9]+\.[0-9]+\.[0-9]+)'/);
    if (m) shippedVersion[app] = m[1];
}
check(Object.keys(shippedVersion).length === 2,
    'README ៖ អានបាន APP_VERSION ពិតរបស់ App ទាំង ២ (មូលដ្ឋាននៃការប្រៀបធៀប)',
    'អានបាន ' + Object.keys(shippedVersion).join(', '));

const versionClaims = [];   // { rel, app, claimed, line }
function claimFrom(rel, re, app) {
    const f = path.join(ROOT, rel);
    if (!fs.existsSync(f)) return;
    const lines = fs.readFileSync(f, 'utf8').split('\n');
    for (let i = 0; i < lines.length; i++) {
        const m = re.exec(lines[i]);
        if (m) { versionClaims.push({ rel, app, claimed: m[1], line: i + 1 }); return; }
    }
}
// ជួរតារាងរបស់ root ៖ ជួរដែលភ្ជាប់ទៅ README របស់ App នោះ
claimFrom('README.md', /\[ZoeW\]\(ZoeW\/README\.md\).*`([0-9]+\.[0-9]+\.[0-9]+)`/, 'ZoeW');
claimFrom('README.md', /\[ZoeKeyGen\]\(ZoeKeyGen\/README\.md\).*`([0-9]+\.[0-9]+\.[0-9]+)`/, 'ZoeKeyGen');
// ផ្នែក «កំណែ» របស់ README នីមួយៗ ៖ ការអះអាង «កំណែបច្ចុប្បន្ន»
claimFrom('ZoeW/README.md', /កំណែបច្ចុប្បន្ន[^0-9]*`([0-9]+\.[0-9]+\.[0-9]+)`/, 'ZoeW');
claimFrom('ZoeKeyGen/README.md', /កំណែបច្ចុប្បន្ន[^0-9]*`([0-9]+\.[0-9]+\.[0-9]+)`/, 'ZoeKeyGen');

check(versionClaims.length >= 4,
    'ជាន់អប្បបរមា ៖ រកឃើញការអះអាងកំណែបច្ចុប្បន្នយ៉ាងតិច ៤',
    'រកឃើញ ' + versionClaims.length + ' ➜ ការស្កេនប្រហែលរអិលចេញពីគោលដៅ');

const staleDocs = versionClaims.filter((c) => shippedVersion[c.app] && c.claimed !== shippedVersion[c.app]);
check(staleDocs.length === 0,
    '⛔ README ៖ កំណែដែលរាយ ត្រូវជាកំណែដែល App **ពិតជា ship** (ច្បាប់ ៩ ៖ README ចាស់ = ឯកសារខុស)',
    staleDocs.map((c) => c.rel + ':' + c.line + '  រាយ `' + c.claimed
        + '` ខណៈ ' + c.app + ' ship `' + shippedVersion[c.app] + '`').join('\n        '));

// ⛔ **ចន្លោះនៃលំនាំហាម ៖ វាទាមទារលេខកំណែ *ជាប់* នឹងពាក្យ «កំណែ»។**
// លំនាំចាស់ `/កំណែ\s*`?2\.[0-9]+\.[0-9]+/` ចាប់បាន «កំណែ 2.21.0» តែ **មិន**
// ចាប់ «មុនកំណែ ZoeW `2.21.0`» ព្រោះមានពាក្យឈរកណ្តាល ➜ កំណត់ត្រាតាមកំណែ
// រអិលកាត់ដោយគ្រាន់តែរៀបពាក្យខុសបន្តិច។ វាស់បាន ៖ `zto-import/README.md`
// ផ្ទុកប្រយោគបែបនោះពិត ខណៈ checker រាយ **PASS**។
//
// ⛔ ការកែជា **ការពង្រីកច្បាប់ដើម មិនមែនលំនាំទី ១០** (ច្បាប់ ១២) ៖ ធាតុតូច
// ចង្អៀតក្នុង `BANNED` ត្រូវដកចេញ ហើយការវាស់រស់នៅ **ត្រង់នេះតែមួយកន្លែង**
// ព្រោះត្រង់នេះទើបស្គាល់ `versionClaims` ➜ វាបែងចែក «ការអះអាងកំណែ
// *បច្ចុប្បន្ន*» (ចាំបាច់តាមច្បាប់ ៩ ហើយ `staleDocs` ចាក់សោភាពស្រស់រួចហើយ)
// ចេញពី «កំណត់ត្រាតាមកំណែ» បាន។ បញ្ជីអនុញ្ញាតត្រូវ **ដេរីវេពី
// `versionClaims`** មិនមែនបញ្ជីរឹងទី ២ (បញ្ជីរឹង ២ ខាងនឹងឃ្លាតគ្នា)។
//
// ⛔ អ្វីដែល **មិន** ប៉ះ ៖ ការយោងប្រវត្តិដែលគ្មានពាក្យ «កំណែ» ជាប់នឹងវា
// («ដាច់ពីគ្នាតាំងពី 2.19.4») — នោះជាការសម្រេចដោយចេតនារបស់គម្រោង ហើយមាន
// ការអះអាង **ទិសផ្ទុយ** ចាក់សោវានៅខាងក្រោម។ រូបរាង `2\.[0-9]+\.[0-9]+`
// ជាកំណែ App ➜ វាមិនត្រូវនឹង `22.17.0` (Node.js) ឬ `0.20.3` (SheetJS)។
const CLAIM_LINES = new Set(versionClaims.map((c) => c.rel + ':' + c.line));
check(CLAIM_LINES.size >= 4,
    'ជាន់អប្បបរមា ៖ បញ្ជីអនុញ្ញាតដេរីវេពីការអះអាងកំណែបច្ចុប្បន្នយ៉ាងតិច ៤',
    'ដេរីវេបាន ' + CLAIM_LINES.size);

const VERSION_NOTE_RE = /កំណែ[^\n]{0,24}?`?\b2\.[0-9]+\.[0-9]+/;
const versionOffenders = [];
for (const rel of ALL_DOCS) {
    const file = path.join(ROOT, rel);
    if (!fs.existsSync(file)) continue;
    fs.readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
        if (!VERSION_NOTE_RE.test(line)) return;
        if (CLAIM_LINES.has(rel + ':' + (i + 1))) return;
        versionOffenders.push(rel + ':' + (i + 1) + '  ' + line.trim().slice(0, 110));
    });
}
check(versionOffenders.length === 0,
    '⛔ កំណត់ត្រាតាមកំណែ («…កំណែ … 2.x.y») ត្រូវទៅ docs/HISTORY.md (ច្បាប់ ៩)',
    versionOffenders.join('\n        '));

// ⛔ ទិសផ្ទុយ ៖ ការអះអាងកំណែ **បច្ចុប្បន្ន** ត្រូវឆ្លងកាត់ — បើវាធ្លាក់ នោះ
// ច្បាប់នេះកំពុងហាមផ្នែក «កំណែ» ដែលច្បាប់ ៩ **តម្រូវឲ្យមាន**។
check(versionClaims.every((c) => !CLAIM_LINES.has(c.rel + ':' + c.line)
    || !versionOffenders.some((o) => o.indexOf(c.rel + ':' + c.line + ' ') === 0)),
    '⛔ ទិសផ្ទុយ ៖ ការអះអាង «កំណែបច្ចុប្បន្ន» មិនត្រូវរាប់ជាកំណត់ត្រាតាមកំណែ');

// ⛔ ច្បាប់ដដែលគ្រប **តារាងក្បាលរបស់ `CLAUDE.md`** ដែរ — វាជាឯកសារដែល session
// ថ្មីអានមុនគេ ➜ លេខចាស់ត្រង់នោះនាំច្រឡំរាល់ជុំ។ ⛔ ចន្លោះនេះ **វាស់រួច មិនមែន
// សន្មត** (2026-09-10) ៖ តារាងនោះធ្លាប់ចាស់ **៤ commit** — កំណែ `2.31.4` និង
// `2.31.5` ដើរដោយ `CLAUDE.md` រាយ `2.31.3`។ វាចាក់សោ **ទាំង** `APP_VERSION`
// **ទាំង** `CACHE_VERSION` ព្រោះជួរនោះអះអាងទាំង ២។
const cacheVersion = {};
for (const app of Object.keys(APPS)) {
    const f = path.join(ROOT, app + '/sw.js');
    if (!fs.existsSync(f)) continue;
    const m = fs.readFileSync(f, 'utf8').match(/CACHE_VERSION\s*=\s*'([^']+)'/);
    if (m) cacheVersion[app] = m[1];
}
const claudeText = fs.existsSync(path.join(ROOT, 'CLAUDE.md'))
    ? fs.readFileSync(path.join(ROOT, 'CLAUDE.md'), 'utf8') : '';
const headRows = [];
for (const app of Object.keys(APPS)) {
    const re = new RegExp('^\\| \\*\\*' + app + '\\*\\* \\|.*?`([0-9]+\\.[0-9]+\\.[0-9]+)`\\s*\\(`([^`]+)`\\)', 'm');
    const m = re.exec(claudeText);
    if (m) headRows.push({ app, ver: m[1], cache: m[2] });
}
check(headRows.length === 2, 'ជាន់អប្បបរមា ៖ អានជួរតារាងក្បាលរបស់ CLAUDE.md បានទាំង ២',
    'អានបាន ' + headRows.length);
const claudeStale = headRows.filter((r) =>
    (shippedVersion[r.app] && r.ver !== shippedVersion[r.app])
    || (cacheVersion[r.app] && r.cache !== cacheVersion[r.app]));
check(claudeStale.length === 0,
    '⛔ CLAUDE.md ៖ តារាងក្បាលត្រូវរាយ `APP_VERSION` និង `CACHE_VERSION` ដែល App **ពិតជា ship**',
    claudeStale.map((r) => r.app + ' ៖ តារាងរាយ `' + r.ver + '` (`' + r.cache
        + '`) ខណៈកូដ ship `' + shippedVersion[r.app] + '` (`' + cacheVersion[r.app] + '`)').join('\n        '));

// ⛔ ទិសផ្ទុយ ៖ ការយោង **ប្រវត្តិ** មិនត្រូវធ្វើឲ្យធ្លាក់ — បើច្បាប់នេះហាមរាល់
// លេខកំណែក្នុង README នោះវាជាទោស មិនមែនការការពារ។
const zwReadme = fs.existsSync(path.join(ROOT, 'ZoeW/README.md'))
    ? fs.readFileSync(path.join(ROOT, 'ZoeW/README.md'), 'utf8') : '';
check(/តាំងពី 2\.19\.4/.test(zwReadme) && staleDocs.length === 0,
    '⛔ ទិសផ្ទុយ ៖ ការយោងកំណែ *ប្រវត្តិ* ក្នុង README ត្រូវឆ្លងកាត់',
    'ការយោងប្រវត្តិបាត់ ឬត្រូវរាយខុសជាការធ្លាក់');


// ============================================================================
// ផ្នែក ៦ — `CLAUDE.md` ៖ ការរៀបរាប់ផ្ទៃ និងចំនួន ត្រូវ **ដេរីវេពីកូដ ship**
// ============================================================================
//
// 🔴 ហេតុអ្វីវាមាន ៖ ផ្នែក ៤–៥ ខាងលើចាក់សោ **លេខកំណែ** ប៉ុណ្ណោះ។ អ្វីដែល
// session ថ្មីពិតជាអានដើម្បីតម្រង់ទិសគឺ **តារាងរចនាសម្ព័ន្ធ UI** និង
// **ចំនួន** ក្នុង `CLAUDE.md` — ហើយពួកវាគ្មានអ្នកយាមសោះ ៖ របា Slide បន្ថែម
// ធាតុ ៤ · ម៉ឺនុយ (...) បន្ថែម ១ · ជួរ health check ឡើងពី ៨ ➜ ៩ ·
// `app.js` រីកជាង ៣,០០០ បន្ទាត់ — ខណៈឯកសារនៅរាយលេខចាស់។ នេះជាថ្នាក់
// «ផ្ទៃដែលកើត *ក្រោយ* ច្បាប់» ៖ ច្បាប់នៅរស់ តែផ្ទៃថ្មីមិនចូលបញ្ជី។
//
// ⛔ ការកែត្រឹមត្រូវ **មិនមែន** ការចាក់បញ្ជីថ្មីជា literal ក្នុង checker
// (នោះជាកាលបរិច្ឆេទផុតកំណត់ទី ២) — ត្រូវ **ដេរីវេ** បញ្ជីចេញពី `index.html`
// និង `app.js` ពិត រួចទាមទារឲ្យឯកសារនិយាយអំពីវា។ ⛔ ហើយវានៅតែធ្លាក់បាន ៖
// ផ្ទៃថ្មីដែលឯកសារភ្លេច ➜ ឈ្មោះរបស់វាអវត្តមាន ➜ FAIL។

const uiIndex = fs.existsSync(path.join(ROOT, 'ZoeW/index.html'))
    ? fs.readFileSync(path.join(ROOT, 'ZoeW/index.html'), 'utf8') : '';
const uiApp = fs.existsSync(path.join(ROOT, 'ZoeW/app.js'))
    ? fs.readFileSync(path.join(ROOT, 'ZoeW/app.js'), 'utf8') : '';

const KHMER_DIGITS = '០១២៣៤៥៦៧៨៩';
function khmerToInt(text) {
    const plain = String(text || '').replace(/[០-៩]/g, (c) => String(KHMER_DIGITS.indexOf(c)))
        .replace(/[^0-9]/g, '');
    return plain === '' ? null : parseInt(plain, 10);
}
// --- ក. របា Slide ៖ ស្លាកដេរីវេពី `index.html` ពិត -------------------------
const drawerBlock = (() => {
    const at = uiIndex.indexOf('id="sideDrawer"');
    if (at === -1) return '';
    const end = uiIndex.indexOf('</aside>', at);
    return uiIndex.slice(at, end === -1 ? at + 6000 : end);
})();
const drawerLabels = (drawerBlock.match(/<button[^>]*class="drawer-item[^"]*"[\s\S]*?<\/button>/g) || [])
    .map((block) => (block.match(/<span(?![^>]*class="(?:ico|drawer-toggle-state)")[^>]*>([^<]+)<\/span>/) || [])[1])
    .map((label) => String(label || '').trim())
    .filter((label) => label.length >= 6);

// --- ខ. ម៉ឺនុយ (...) ៖ ស្លាកដេរីវេពី `toggleHeaderMoreDropdown` ពិត ---------
const moreMenuBlock = (() => {
    const at = uiApp.indexOf('function toggleHeaderMoreDropdown');
    if (at === -1) return '';
    // ⛔ ព្រំដែនត្រូវឈប់ត្រឹម function នោះ — ស្លាយវែងរអិលចូល `toggleMoreDropdown`
    // (ម៉ឺនុយ **តាមជួរ**) ➜ ការអះអាងនឹងទាមទារធាតុរបស់ម៉ឺនុយផ្សេង។
    const rest = uiApp.slice(at + 10);
    const end = rest.indexOf('\n    function ');
    return rest.slice(0, end === -1 ? 1600 : end);
})();
const moreMenuLabels = (moreMenuBlock.match(/<button[^>]*>([^<]+)<\/button>/g) || [])
    .map((block) => (block.match(/<button[^>]*>([^<]+)<\/button>/) || [])[1])
    .map((label) => String(label || '').replace(/\$\{[^}]*\}/g, '').replace(/\s*\([^)]*\)\s*$/, '').trim())
    // ⛔ ដកតែ emoji ខាងមុខ — អត្ថបទពិតត្រូវនៅដដែល
    .map((label) => label.replace(/^[^\p{L}\p{N}]+/u, '').trim())
    .filter((label) => label.length >= 5)
    // App React ៖ ធាតុម៉ឺនុយជា view-model `{ label: '…', action }` (JSX គូរ) ➜ ស្លាកជា string literal ទី ១ របស់ `label`
    .concat((moreMenuBlock.match(/\blabel:\s*'([^']+)'/g) || [])
        .map((m) => /'([^']+)'/.exec(m)[1].replace(/\s*\($/, '').replace(/\s*\([^)]*\)\s*$/, ''))
        .map((label) => label.replace(/^[^\p{L}\p{N}]+/u, '').trim())
        .filter((label) => label.length >= 5));

// --- គ. ជួរ 🩺 ពិនិត្យសុខភាព ៖ ចំនួនដេរីវេពី `runHealthCheck()` ពិត --------
const healthBlock = (() => {
    const at = uiApp.indexOf('async function runHealthCheck');
    if (at === -1) return '';
    // ⛔ ព្រំដែនត្រូវឈប់ត្រឹម function នោះ — ស្លាយប្រវែងថេរនឹងកាត់ជួរចោល
    // ពេល function រីក ➜ ការរាប់ធ្លាក់ ➜ ឯកសារ «ខុស» ដោយអ្នកយាមខ្លួនឯង។
    const rest = uiApp.slice(at + 10);
    const end = rest.indexOf('\n    function ');
    return rest.slice(0, end === -1 ? 1200 : end);
})();
// ⛔ `healthPendingRow()` (App React) ជាជួរ «កំពុងពិនិត្យ…» បណ្តោះអាសន្ន មិនមែនជួរវាស់ទេ
const healthRowCount = new Set((healthBlock.match(/health[A-Za-z]+Row\(\)/g) || [])
    .filter((name) => name !== 'healthPendingRow()')).size;

// --- ឃ. អេក្រង់ដែលប្រើ helper ចំណូល ៖ ចំនួនកន្លែងហៅ `collectedValueOf()` ---
const collectedCallers = (uiApp.match(/collectedValueOf\(/g) || []).length
    - (/function collectedValueOf\(/.test(uiApp) ? 1 : 0);

const appLineCount = uiApp ? uiApp.split('\n').length : 0;

// ⛔ ជាន់អប្បបរមា ៖ បើការដេរីវេរអិលចេញពីគោលដៅ ការអះអាងខាងក្រោមក្លាយជាទទេ
check(drawerLabels.length >= 8, 'ជាន់អប្បបរមា ៖ ដេរីវេស្លាករបា Slide បានយ៉ាងតិច ៨',
    'ដេរីវេបាន ' + drawerLabels.length + ' ៖ ' + drawerLabels.join(' · '));
check(moreMenuLabels.length >= 5, 'ជាន់អប្បបរមា ៖ ដេរីវេស្លាកម៉ឺនុយ (...) បានយ៉ាងតិច ៥',
    'ដេរីវេបាន ' + moreMenuLabels.length + ' ៖ ' + moreMenuLabels.join(' · '));
check(healthRowCount >= 7, 'ជាន់អប្បបរមា ៖ រាប់ជួរ `runHealthCheck()` បានយ៉ាងតិច ៧',
    'រាប់បាន ' + healthRowCount);
check(collectedCallers >= 2, 'ជាន់អប្បបរមា ៖ រាប់កន្លែងហៅ `collectedValueOf()` បានយ៉ាងតិច ២',
    'រាប់បាន ' + collectedCallers);
check(appLineCount > 1000, 'ជាន់អប្បបរមា ៖ អាន `ZoeW/app.js` បានពិត', String(appLineCount));
// --- ង. `setInterval` ៖ ចំនួនដេរីវេពី `app.js` ពិត ------------------------
// ⛔ ច្បាប់ «កុំបន្ថែមច្រកទ្វារ `document.hidden`» ក្នុង `CLAUDE.md` អះអាង
// **ចំនួន** timer ➜ វាជាលេខដេរីវេបាន ➜ វារលួយ។ វាស់បាន (ជុំនេះ) ៖ ឯកសារ
// រាយ ៥ ខណៈកូដមាន ៦ ➜ session ក្រោយអានច្បាប់ដែលមិនត្រូវនឹងកូដ។
// --- ច. នីតិវិធីស្ទួនឆ្លងឯកសារ (ច្បាប់ ១២) -------------------------------
// ⛔ ប្លុកពាក្យបញ្ជាដដែលក្នុងឯកសារ ២ ជា **កាលបរិច្ឆេទផុតកំណត់** ៖ ជុំក្រោយ
// កែមួយ ភ្លេចមួយ ➜ ២ នីតិវិធីផ្ទុយគ្នា។ វាស់បាន (ជុំនេះ) ៖
// `audit-tools/README.md` រាយ `java -jar` ជា **foreground** (បិទ shell របស់
// session) ខណៈ `CLAUDE.md` រាយ `setsid nohup … &` — ហើយការព្រមាន `pkill`
// របស់វាចង្អៀតជាងច្បាប់ដើម។ ⛔ `docs/` ជាផ្ទះរបស់ប្រវត្តិ ➜ លើកលែង។
const fenceOwners = new Map();
listAllDocs(ROOT, "", []).concat(["CLAUDE.md"]).forEach((rel) => {
    if (/^docs[\\/]/.test(rel)) return;
    let text = '';
    try { text = fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch (e) { return; }
    const fences = text.match(/```[a-z]*\n[\s\S]*?```/g) || [];
    fences.forEach((f) => {
        const lines = f.split('\n').slice(1, -1).map((l) => l.trim()).filter(Boolean);
        if (lines.length < 3) return;
        const key = lines.join('\n');
        if (!fenceOwners.has(key)) fenceOwners.set(key, new Set());
        fenceOwners.get(key).add(rel);
    });
});
const dupFences = [...fenceOwners.entries()].filter(([, owners]) => owners.size > 1);
check(fenceOwners.size >= 5, 'ជាន់អប្បបរមា ៖ ដេរីវេប្លុកពាក្យបញ្ជាបានយ៉ាងតិច ៥',
    'ដេរីវេបាន ' + fenceOwners.size);
check(dupFences.length === 0,
    '⛔ ច្បាប់ ១២ ៖ ប្លុកពាក្យបញ្ជាដដែល មិនត្រូវរស់នៅ ២ ឯកសារ (ត្រូវយោង មិនចម្លង)',
    dupFences.map(([k, o]) => [...o].join(' ↔ ') + ' ៖ ' + k.split('\n')[0]).join('\n        '));

// App React ៖ timer ចុះឈ្មោះតាម `scope.every(ms, fn)` (lifecycle ដកវិញពេល unmount) ➜ `setInterval(` តែមួយរស់ក្នុងតួ
// `every()` ខ្លួនវា ➜ ការរាប់ = `setInterval(` ផ្ទាល់ (ក្រៅតួនោះ) + `scope.every(`
const everyImpl = /\bevery\(ms, fn\) \{[^}]*\bsetInterval\(/.test(uiApp) ? 1 : 0;
const intervalCount = (uiApp.match(/\bsetInterval\(/g) || []).length - everyImpl
    + (uiApp.match(/\bscope\.every\(/g) || []).length;
check(intervalCount >= 3, 'ជាន់អប្បបរមា ៖ រាប់ `setInterval` ក្នុង `app.js` បានយ៉ាងតិច ៣',
    'រាប់បាន ' + intervalCount);
const KH_DIGITS = ['០', '១', '២', '៣', '៤', '៥', '៦', '៧', '៨', '៩'];
const khNum = (n) => String(n).split('').map((d) => KH_DIGITS[Number(d)] || d).join('');
const intervalClaim = /`setInterval` ទាំង ([០-៩]+) របស់ ZoeW/.exec(claudeText);
check(!!intervalClaim, '⛔ `CLAUDE.md` នៅរក្សាច្បាប់ `setInterval` ↔ `document.hidden`',
    'រកប្រយោគនោះមិនឃើញ');
check(!intervalClaim || intervalClaim[1] === khNum(intervalCount),
    '⛔ ចំនួន `setInterval` ក្នុង `CLAUDE.md` ត្រូវស្មើចំនួនក្នុង `app.js` ពិត',
    intervalClaim ? 'ឯកសាររាយ ' + intervalClaim[1] + ' · កូដមាន ' + khNum(intervalCount) : '');


// ⛔ ទិសផ្ទុយ ៖ តារាង UI ត្រូវនៅរស់ក្នុង CLAUDE.md — បើនរណាលុបវាចោល នោះ
// ការអះអាងខាងក្រោមក្លាយជាការចាក់សោដោយគ្មានមូលដ្ឋាន។
check(/\|[^|\n]*\|\s*`sideDrawer`\s*\|/.test(claudeText)
    && /\|[^|\n]*\|\s*`globalMoreMenu`\s*\|/.test(claudeText),
    '⛔ ទិសផ្ទុយ ៖ តារាងរចនាសម្ព័ន្ធ UI នៅរស់ក្នុង CLAUDE.md',
    'តារាងបាត់ ➜ ការអះអាងផ្ទៃខាងក្រោមគ្មានមូលដ្ឋាន');

const missingDrawer = drawerLabels.filter((label) => claudeText.indexOf(label) === -1);
check(missingDrawer.length === 0,
    '⛔ CLAUDE.md ៖ រាល់ធាតុរបា Slide ដែល `index.html` **ពិតជា ship** ត្រូវមានឈ្មោះក្នុងឯកសារ',
    'បាត់ពីឯកសារ ៖ ' + missingDrawer.join(' · '));

const missingMenu = moreMenuLabels.filter((label) => claudeText.indexOf(label) === -1);
check(missingMenu.length === 0,
    '⛔ CLAUDE.md ៖ រាល់ធាតុម៉ឺនុយ (...) ដែល `app.js` **ពិតជា ship** ត្រូវមានឈ្មោះក្នុងឯកសារ',
    'បាត់ពីឯកសារ ៖ ' + missingMenu.join(' · '));

// ⛔ ចំនួនជួរ 🩺 ត្រូវពិនិត្យ **គ្រប់ឯកសារដែលអះអាងវា** — មិនត្រឹម CLAUDE.md។
// វាស់បាន ៖ តារាងក្នុង `ZoeW/README.md` មាន ៩ ជួរពិត ខណៈប្រយោគខាងលើវារាយ
// «**៨ ជួរ**» ➜ បញ្ជីត្រូវ update តែលេខភ្លេច។
// ⛔ **បញ្ជីរឹង = កាលបរិច្ឆេទផុតកំណត់** ៖ កំណែមុនរាយត្រឹម
// `['CLAUDE.md', 'ZoeW/README.md']` ខណៈ **root `README.md`** ក៏អះអាងលេខនោះ
// ដែរ ➜ វាអាចចាស់ដោយស្ងាត់។ វាស់បាន (mutation ពិត) ៖ ការប្តូរ root README
// ទៅ «៨ ជួរ» **រស់រាន** `PASS (64)`។ ដូច្នេះបញ្ជីត្រូវ **ដេរីវេពីថតពិត** ៖
// ឯកសារ `.md` ណាដែល *អះអាងលេខនោះ* ត្រូវស្ថិតក្នុងការវាស់ដោយស្វ័យប្រវត្តិ។
const HEALTH_CLAIM_RE = /ពិនិត្យសុខភាពប្រព័ន្ធ\*{0,2}[^\n]*?(?:ជួរ \*{0,2}([០-៩0-9]+)|\*{0,2}([០-៩0-9]+) ជួរ)/;
function listMarkdownFiles(dir, rel, out) {
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return out; }
    entries.forEach((entry) => {
        if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'docs') return;
        const next = rel ? rel + '/' + entry.name : entry.name;
        if (entry.isDirectory()) listMarkdownFiles(path.join(dir, entry.name), next, out);
        else if (/\.md$/i.test(entry.name)) out.push(next);
    });
    return out;
}
const healthClaims = listMarkdownFiles(ROOT, '', [])
    .map((rel) => {
        let text = '';
        try { text = fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch (_) { return null; }
        const hit = text.match(HEALTH_CLAIM_RE);
        return hit ? { rel: rel, claimed: khmerToInt(hit[1] || hit[2]) } : null;
    })
    .filter(Boolean);
const HEALTH_CLAIM_DOCS = healthClaims.map((c) => c.rel);
check(healthClaims.length >= 3,
    'ជាន់អប្បបរមា ៖ ដេរីវេឯកសារដែលអះអាងចំនួនជួរ 🩺 បានយ៉ាងតិច ៣',
    healthClaims.map((c) => c.rel + '=' + c.claimed).join(' · '));
const healthStale = healthClaims.filter((c) => c.claimed !== healthRowCount);
check(healthStale.length === 0,
    '⛔ ចំនួនជួរ 🩺 ក្នុងឯកសារ ត្រូវស្មើចំនួនដែល `runHealthCheck()` ផលិតពិត',
    healthStale.map((c) => c.rel + ' រាយ ' + c.claimed).join(' · ')
    + ' ខណៈកូដផលិត ' + healthRowCount);

const screensClaim = khmerToInt((claudeText.match(/អេក្រង់ស្ថិតិទាំង \*{0,2}([០-៩0-9]+)\*{0,2} ប្រើ helper ដដែល/) || [])[1]);
check(screensClaim !== null && screensClaim === collectedCallers,
    '⛔ CLAUDE.md ៖ ចំនួនអេក្រង់ដែលប្រើ `collectedValueOf()` ត្រូវស្មើចំនួនកន្លែងហៅពិត',
    'ឯកសាររាយ ' + screensClaim + ' ខណៈកូដហៅ ' + collectedCallers);

const lineClaim = khmerToInt((claudeText.match(/`ZoeW\/app\.js`[^\n]*?~\s*([០-៩0-9,]+) បន្ទាត់/) || [])[1]);
// ⛔ App React ៖ `ZoeW/app.js` ជា *ទិដ្ឋភាពវាស់* (មិនមែនឯកសារដែលមនុស្សកែ) ➜ CLAUDE.md លែងរាយទំហំវា។
//    ការអះអាងដែល **មាន** នៅតែត្រូវស្រស់ (±១២%) — អវត្តមានមិនមែនការអះអាងខុសទេ។
check(lineClaim === null || Math.abs(lineClaim - appLineCount) / appLineCount <= 0.12,
    '⛔ CLAUDE.md ៖ ទំហំ `ZoeW/app.js` ដែលរាយ (បើមាន) ត្រូវនៅក្នុង ±១២% នៃការពិត',
    'ឯកសាររាយ ~' + lineClaim + ' ខណៈឯកសារពិតមាន ' + appLineCount + ' បន្ទាត់');

// ⛔ ចំនួនតំបន់ 📝 ៖ ការអះអាងក្នុងក្បាលតារាងស្នូល ត្រូវស្មើចំនួនជួរ 📝 ពិត
const penRows = (claudeText.match(/^\|[^\n]*\|\s*📝[^\n]*\|$/gm) || []).length;
const penClaim = khmerToInt((claudeText.match(/ឥឡូវនៅសល់ \*{0,2}([០-៩0-9]+)/) || [])[1]);
check(penRows >= 2, 'ជាន់អប្បបរមា ៖ តារាងស្នូលមានជួរ 📝 យ៉ាងតិច ២', 'រាប់បាន ' + penRows);
check(penClaim !== null && penClaim === penRows,
    '⛔ CLAUDE.md ៖ ចំនួនតំបន់ 📝 ដែលអះអាង ត្រូវស្មើចំនួនជួរ 📝 ក្នុងតារាងស្នូល',
    'អះអាង ' + penClaim + ' ខណៈតារាងមាន ' + penRows + ' ជួរ');

// ⛔ ច្បាប់ដដែលគ្រប **កាតាឡុកនៃអ្វីដែលឧបករណ៍វាស់** ៖ `money-reality-check.js`
// បោះពុម្ពផ្នែកជា `── N. …` ហើយ `tools/money-check-windows/README-KH.md`
// អះអាងចំនួននោះ។ វាស់បាន ៖ ការបន្ថែមផ្នែក **៥ខ (ចំណូលប្រចាំថ្ងៃ)** ក្នុង
// ជុំមុន ធ្វើឲ្យឧបករណ៍មាន ៧ ផ្នែក ខណៈ README នៅរាយ «ពិនិត្យ ៦»។
const moneyRealSrc = fs.existsSync(path.join(ROOT, 'audit-tools/money-reality-check.js'))
    ? fs.readFileSync(path.join(ROOT, 'audit-tools/money-reality-check.js'), 'utf8') : '';
// ⛔ ស្លាកលេចឡើង **២ ដង** (comment ក្បាលផ្នែក និង `say()` ពិត) ➜ ត្រូវ dedupe
const moneyRealSections = new Set((moneyRealSrc.match(/──\s*[០-៩]+[ខគឃ]?\./g) || [])
    .map((m) => m.replace(/[──\s]/g, ''))).size;
// ⛔ ហើយច្បាប់ដដែលគ្រប **គ្រប់ឯកសារដែលអះអាងចំនួននោះ** មិនត្រឹមឯកសារតែមួយ
// (ថ្នាក់ដដែលនឹងចំនួនជួរ 🩺 ៖ បញ្ជីត្រូវ update តែលេខសង្ខេបភ្លេច)។ វាស់បាន
// (2026-09-13) ៖ `audit-tools/README.md` រាយ «ពិនិត្យ ៦» ខណៈឧបករណ៍មាន ៨
// ផ្នែក — ជុំមុនកែតែ README របស់ Windows ព្រោះអ្នកយាមមើលតែឯកសារនោះ។
const MONEY_CLAIM_DOCS = ['tools/money-check-windows/README-KH.md', 'audit-tools/README.md', 'README.md'];
check(moneyRealSections >= 5, 'ជាន់អប្បបរមា ៖ `money-reality-check.js` មានផ្នែកយ៉ាងតិច ៥',
    'រាប់បាន ' + moneyRealSections);
MONEY_CLAIM_DOCS.forEach((rel) => {
    const text = fs.existsSync(path.join(ROOT, rel)) ? fs.readFileSync(path.join(ROOT, rel), 'utf8') : '';
    // ⛔ លេខត្រូវឈរក្បែរ **ពាក្យដែលអះអាងវា** ➜ «ការត្រួតពិនិត្យ ៣៥ បើក Chromium»
    // (ការអះអាងផ្សេង ក្នុងឯកសារដដែល) មិនត្រូវអានខុសជាចំនួនផ្នែករបស់ CLI
    const claim = khmerToInt((text.match(/(?:ពិនិត្យ|ការវាស់លុយ) \*{0,2}([០-៩0-9]+) (?:៖|លើ)/) || [])[1]);
    check(claim !== null && claim === moneyRealSections,
        '⛔ `' + rel + '` ៖ ចំនួនការវាស់ត្រូវស្មើចំនួនផ្នែកពិតរបស់ឧបករណ៍',
        'ឯកសាររាយ ' + claim + ' ខណៈឧបករណ៍មាន ' + moneyRealSections + ' ផ្នែក');
});

// ⛔ ច្បាប់ «បញ្ជីត្រូវប្រៀបនឹងថតពិត» (ផ្នែក ១ សម្រាប់ README) អនុវត្តលើ
// **កាតាឡុក checker** ដែរ ៖ `audit-tools/README.md` ជាកន្លែងតែមួយដែលប្រាប់ថា
// checker នីមួយៗវាស់អ្វី ➜ checker ដែលមិនចូលបញ្ជី គឺ **មើលមិនឃើញ** សម្រាប់
// ជុំក្រោយ ➜ វាអាចត្រូវសាងស្ទួន ឬត្រូវភ្លេចពេលច្បាប់ប្រែ។
// វាស់បាន ៖ `health-check-test.js` (អ្នកយាមនៃជួរ 🩺 ទាំង ៩) និង `emu/ns.js`
// (namespace តែមួយក្នុងមួយការរត់) **គ្មានឈ្មោះក្នុង README សោះ**។
const toolsReadme = fs.existsSync(path.join(ROOT, 'audit-tools/README.md'))
    ? fs.readFileSync(path.join(ROOT, 'audit-tools/README.md'), 'utf8') : '';
function listCheckerFiles(dir, rel, out) {
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return out; }
    entries.forEach((entry) => {
        if (entry.name === 'node_modules') return;
        // ⛔ ឯកសារស្រមោលរបស់ការពុល (`checker-coverage`) ជាសំណល់បណ្តោះអាសន្ន
        if (entry.name.indexOf('.tmp-poison-') === 0) return;
        const next = rel ? rel + '/' + entry.name : entry.name;
        if (entry.isDirectory()) listCheckerFiles(path.join(dir, entry.name), next, out);
        else if (entry.name.endsWith('.js')) out.push(next);
    });
    return out;
}
const checkerFiles = listCheckerFiles(path.join(ROOT, 'audit-tools'), '', []);
// ⛔ ខ្លះសរសេរជាមួយអាគុយម៉ង់ (`trimws.js <files>`) ➜ ផ្គូផ្គងត្រឹម
// «backtick ភ្លាមមុនឈ្មោះ» មិនមែនតង្កៀបបិទ។
function catalogued(name) {
    const at = toolsReadme.indexOf('`' + name);
    if (at === -1) return false;
    const after = toolsReadme.charAt(at + name.length + 1);
    return after === '`' || after === ' ';
}
const uncatalogued = checkerFiles.filter((rel) =>
    !catalogued(rel) && !catalogued(rel.split('/').pop()));
// ⛔ លិបិក្រមនៅចុង `docs/HISTORY.md` ជាផ្លូវដែល session ក្រោយរកហេតុផលនៃ checker មួយ ➜ checker ណាដែលលេចក្នុង
// ឯកសារប្រវត្តិ (ឈ្មោះដេរីវេពីថតពិត) តែគ្មានជួរក្នុងលិបិក្រម = ការពន្យល់ដែលរកមិនឃើញ។
const histIndexAt = hist.indexOf('## 🔎 លិបិក្រម');
const histIndex = histIndexAt === -1 ? '' : hist.slice(histIndexAt);
const histBodies = (histIndexAt === -1 ? hist : hist.slice(0, histIndexAt)) + '\n' + histArchive;
const unindexed = checkerFiles.map((rel) => rel.replace(/\.js$/, '')).filter((name) =>
    new RegExp('(?<![\\w/-])' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![\\w-])').test(histBodies)
    && histIndex.indexOf('`' + name + '`') === -1);
check(histIndex.length > 2000 && unindexed.length === 0,
    '⛔ docs/HISTORY.md ៖ លិបិក្រមគ្រប checker ដែលលេចក្នុងឯកសារប្រវត្តិទាំង ២',
    histIndexAt === -1 ? 'រកលិបិក្រមមិនឃើញ' : 'ខ្វះក្នុងលិបិក្រម ៖ ' + unindexed.join(' · '));
check(checkerFiles.length >= 100, 'ជាន់អប្បបរមា ៖ រកឃើញ checker យ៉ាងតិច ១០០ ក្នុងថតពិត',
    'រកបាន ' + checkerFiles.length);
check(uncatalogued.length === 0,
    '⛔ `audit-tools/README.md` ៖ រាល់ឯកសារ `.js` ក្នុង `audit-tools/` ត្រូវមានឈ្មោះក្នុងកាតាឡុក',
    'គ្មានឈ្មោះក្នុង README ៖ ' + uncatalogued.join(' · '));

// ⛔ ទិសផ្ទុយទី ២ ៖ ឯកសារមិនត្រូវយោង helper ដែល **លែងមាន** — ការដកមុខងារចេញ
// (ឧ. អេក្រង់ដែលដកក្នុងជុំមុន) បន្សល់ឈ្មោះងាប់ក្នុងច្បាប់ ➜ ជុំក្រោយ `grep`
// រកមិនឃើញ រួចសន្មតថាកូដបាត់ ឬអាក្រក់ជាង ៖ សាងវាឡើងវិញ។
//
// ⛔ «មានពិត» ត្រូវវាស់ជា **និយមន័យ** មិនមែន **វត្តមានអក្សរ** ៖ checker ខ្លះ
// អះអាង *អវត្តមាន* នៃឈ្មោះមួយ (`SRC.indexOf('X') === -1`) ➜ ឈ្មោះនោះលេចជា
// string literal ➜ ការស្កេនអក្សរជឿថាវានៅរស់ ➜ probe **ងងឹតទាំងស្រុង**។
// ដូច្នេះយើងសួរថា «តើវាត្រូវ *ប្រកាស* ឬត្រូវ *ហៅជា method* នៅណាមួយទេ?»។
//
// ⚠️ **ព្រំដែនដែលមិនចាក់សោ (សរសេរជាប់ដោយចេតនា)** ៖ ការ *ប្តូរឈ្មោះ* helper
// ក្នុង `app.js` តែម្យ៉ាង **មិន** ធ្វើឲ្យ probe នេះក្រហមទេ ព្រោះ sandbox
// របស់ checker នៅហៅឈ្មោះចាស់ (`s.oldName(...)`) ➜ វានៅ «រស់»។ ករណីនោះជា
// កម្មសិទ្ធិរបស់ checker នោះខ្លួនឯង (វាស្រង់តាមឈ្មោះ ➜ វាធ្លាក់មុន)។
// អ្វីដែល probe នេះចាក់សោគឺ **ការដកចេញពិត** ៖ ឈ្មោះលែងត្រូវប្រកាស ឬហៅ
// នៅណាទាំងអស់ក្នុង repo ខណៈច្បាប់នៅយោងវា។
const SOURCE_DIRS = ['ZoeW', 'ZoeKeyGen', 'audit-tools', 'tools', 'firebase-backup', 'zto-import'];
function readSources(dir, out) {
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return out; }
    entries.forEach((entry) => {
        if (entry.name === 'node_modules' || entry.name === '.git') return;
        const next = path.join(dir, entry.name);
        if (entry.isDirectory()) readSources(next, out);
        else if (/\.(js|cjs|mjs|gs)$/.test(entry.name)) out.push(fs.readFileSync(next, 'utf8'));
    });
    return out;
}
const sourceText = SOURCE_DIRS.map((d) => path.join(ROOT, d))
    .reduce((acc, dir) => readSources(dir, acc), []).join('\n');
// ⛔ ច្បាប់ក៏យោង function របស់ **shell** ដែរ (ឧ. `runall_lane()` ក្នុង `audit-tools/run-all.sh`) ➜ ស្កេន `.sh` ដាច់ដោយឡែក
// តែលើទម្រង់ប្រកាស bash (`ឈ្មោះ() {`) ប៉ុណ្ណោះ ➜ លំនាំ JS ខាងលើមិនធូរដោយសារអត្ថបទ shell។
function readShellSources(dir, out) {
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return out; }
    entries.forEach((entry) => {
        if (entry.name === 'node_modules' || entry.name === '.git') return;
        const next = path.join(dir, entry.name);
        if (entry.isDirectory()) readShellSources(next, out);
        else if (/\.sh$/.test(entry.name)) out.push(fs.readFileSync(next, 'utf8'));
    });
    return out;
}
const shellText = SOURCE_DIRS.map((d) => path.join(ROOT, d))
    .reduce((acc, dir) => readShellSources(dir, acc), []).join('\n');
function nameIsDefined(name) {
    return new RegExp('(?:function|const|let|var|class)\\s+' + name + '\\b').test(sourceText)
        || new RegExp('\\b' + name + '\\s*[:=]\\s*(?:async\\s*)?(?:function|\\()').test(sourceText)
        || new RegExp('\\.' + name + '\\s*\\(').test(sourceText)
        || new RegExp('^\\s*' + name + '\\s*\\(\\)\\s*\\{', 'm').test(shellText);
}
// ⛔ ស្កេន **រាល់ការហៅក្នុង backtick** មិនត្រឹម `x()` ទទេ ៖ ច្បាប់ភាគច្រើន
// សរសេរ helper ជាមួយអាគុយម៉ង់ (`emptyViewMessage(pathKeys, emptyText)`) ➜
// ការទាមទារវង់ក្រចកទទេ បន្សល់ **៤៣** ឈ្មោះក្រៅការយាម។
// ⚠️ អនុគមន៍ **CSS** មិនមែន helper ➜ លើកលែងដោយមានហេតុផលសរសេរជាប់។
const CSS_FUNCTIONS = new Set(['var', 'calc', 'translateX']);
const docFns = [...new Set((claudeText.match(/`([A-Za-z_][A-Za-z0-9_]*)\(/g) || [])
    .map((s) => s.replace(/[`(]/g, '')))].filter((n) => !CSS_FUNCTIONS.has(n));
const deadFns = docFns.filter((n) => !nameIsDefined(n));
check(sourceText.length > 200000, 'ជាន់អប្បបរមា ៖ អានកូដប្រភពរបស់ repo បានពិត',
    'អានបាន ' + sourceText.length + ' តួ');
check(docFns.length >= 150, 'ជាន់អប្បបរមា ៖ CLAUDE.md យោង helper យ៉ាងតិច ១៥០',
    'រកបាន ' + docFns.length);
check(deadFns.length === 0,
    '⛔ CLAUDE.md ៖ ឈ្មោះ helper ដែលឯកសារយោងជា `x()` ត្រូវ **ត្រូវបានប្រកាស** នៅណាមួយក្នុង repo',
    'លែងមានក្នុងកូដ ៖ ' + deadFns.join(' · ')
    + '\n        ➜ មុខងារត្រូវដកចេញ តែច្បាប់នៅយោងវា (ឬឈ្មោះត្រូវប្តូរ)');

// ════════════════════════════════════════════════════════════════════════
// ផ្នែក ៧ — ⛔ **ផ្ទៃដែល *ដកចេញរួច* មិនត្រូវនៅរស់ក្នុងឯកសារ**
// ════════════════════════════════════════════════════════════════════════
//
// ផ្នែក ៤–៦ ខាងលើវាស់ **ទិសមួយ** ៖ ផ្ទៃថ្មីក្នុងកូដ ត្រូវលេចក្នុងឯកសារ។
// ⛔ **ទិសផ្ទុយគ្មានអ្នកវាស់សោះ** ៖ ផ្ទៃដែលកូដ **ដកចេញ** នៅតែអង្គុយក្នុង
// ឯកសារ ➜ អ្នកប្រើដើរតាមសៀវភៅ រកប្រអប់ដែលមិនលេច ➜ សន្និដ្ឋានថា App ខូច។
// 🔴 វាស់បាន (2.36.6) ៖ លេខសាខា ZTO ផ្លាស់ទៅ **អត្តសញ្ញាណគណនី** ហើយប្រអប់
// បំពេញត្រូវលុបចេញពី `index.html` — តែ `guide.html` · `README.md` ២ និង
// `ZTO-SETUP-KH.md` នៅប្រាប់ថា «ចុចកុងតាក់ ➜ **បំពេញលេខសាខា** ➜ រក្សាទុក»
// ហើយ `CLAUDE.md` នៅរាយកូនសោ `zoew_zto_list_site_v1` ជា **ច្បាប់រស់** ➜
// ជំនាន់ក្រោយអានច្បាប់ដែលផ្ទុយនឹងកូដ។ `doc-scope-test` និង `user-guide-test`
// **បៃតងទាំង ២** លើ tree នោះ។

// ⛔ `license-verify.js` និង `error-reporting.js` ក៏ជាកូដ ship ដែរ ➜ កូនសោ
// ដែលរស់នៅទីនោះ (ឧ. record របស់ License) មិនត្រូវរាយជា «ងាប់»។
const SHIPPED_APP_TEXT = ['ZoeW/app.js', 'ZoeKeyGen/app.js', 'ZoeW/sw.js',
    'ZoeKeyGen/sw.js', 'ZoeW/index.html', 'ZoeKeyGen/index.html',
    'ZoeW/license-verify.js', 'ZoeW/error-reporting.js']
    .map((rel) => { try { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch (_) { return ''; } })
    .join('\n');
// ⛔ ផ្នែក server របស់ Supabase (migration · Edge Function) ក៏ deploy ពិតដែរ ➜ ឈ្មោះ table/RPC ដែល CLAUDE.md យោង ត្រូវរស់នៅទីនោះ (ដេរីវេពីថតពិត)
const SUPABASE_SERVER_TEXT = (() => {
    const out = [];
    const walkDir = (dir) => {
        let entries = [];
        try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return; }
        for (const e of entries) {
            const abs = path.join(dir, e.name);
            if (e.isDirectory()) walkDir(abs);
            else if (/\.(sql|ts)$/.test(e.name)) out.push(fs.readFileSync(abs, 'utf8'));
        }
    };
    walkDir(path.join(ROOT, 'supabase', 'migrations'));
    walkDir(path.join(ROOT, 'supabase', 'functions'));
    return out.join('\n');
})();

check(SHIPPED_APP_TEXT.length > 200000, 'ជាន់អប្បបរមា ៖ អានកូដ ship ទាំង ២ App បានពិត',
    'អានបាន ' + SHIPPED_APP_TEXT.length + ' តួ');

// ⛔ តំណក្នុងស្រុកដែល **បាក់** ជាអន្ទាក់ស្ងាត់ ៖ session ក្រោយចុចតាមវា ➜
// រកឯកសារមិនឃើញ ➜ ចំណាយពេលរក រួចសន្និដ្ឋានថាឯកសារនោះត្រូវលុប។
// ⛔ ការវាស់ត្រូវ **ដេរីវេពីថតពិត** មិនមែនបញ្ជីរឹង។
// ⛔ **គ្មានការលើកលែងសម្រាប់បណ្ណសារទៀតទេ** ៖ ប្រវត្តិរស់នៅ `docs/HISTORY.md` តែមួយ (បណ្ណសារចាស់ជាផ្នែក ៣ · ៤
//    របស់វា ហើយតំណដែលបាក់ក្នុងនោះត្រូវបម្លែងជាអត្ថបទពេលបញ្ចូល) ➜ ឯកសារ `*ARCHIVE*` ថ្មីក៏ត្រូវវាស់ដូចឯកសារដទៃ។
{
    const mdFiles = [];
    const walkMd = (dir) => {
        let entries = [];
        try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
        entries.forEach((e) => {
            if (e.name === '.git' || e.name === 'node_modules' || e.name === 'vendor') return;
            const full = path.join(dir, e.name);
            if (e.isDirectory()) return walkMd(full);
            if (e.name.endsWith('.md')) mdFiles.push(full);
        });
    };
    walkMd(ROOT);
    const living = mdFiles;
    let linkCount = 0;
    const broken = [];
    // App React ៖ tree វាស់ (`ZoeW/dist-audit/ZoeW`) មិនដឹក `src/` ➜ តំណទៅប្រភពវាស់តាមបញ្ជីឯកសារប្រភពពិត
    // (`audit-source-files.json` — build-audit ដើរថតប្រភពពិត) ⛔ មិនមែនការលើកលែងងងឹត ៖ ផ្លូវត្រូវមានក្នុងបញ្ជី
    let sourceFiles = null;
    try { sourceFiles = new Set(JSON.parse(fs.readFileSync(path.join(ROOT, 'ZoeW', 'audit-source-files.json'), 'utf8'))); } catch (e) { sourceFiles = null; }
    const zoewDir = path.join(ROOT, 'ZoeW');
    const existsInSource = (abs) => {
        if (!sourceFiles) return false;
        const rel = path.relative(zoewDir, abs).split(path.sep).join('/');
        if (rel.startsWith('..')) return false;
        return sourceFiles.has(rel) || [...sourceFiles].some((f) => f.startsWith(rel.replace(/\/$/, '') + '/'));
    };
    living.forEach((f) => {
        let txt = '';
        try { txt = fs.readFileSync(f, 'utf8'); } catch (e) { return; }
        const re = /\[[^\]]*\]\(([^)\s]+)\)/g;
        let m;
        while ((m = re.exec(txt))) {
            const target = m[1].split('#')[0].trim();
            if (!target || /^(https?:|mailto:)/.test(target)) continue;
            linkCount++;
            const abs = path.resolve(path.dirname(f), target);
            if (!fs.existsSync(abs) && !existsInSource(abs)) {
                broken.push(path.relative(ROOT, f) + ' ➜ ' + target);
            }
        }
    });
    check(living.length >= 8, 'ជាន់អប្បបរមា ៖ ឯកសារ `.md` រស់យ៉ាងតិច ៨ (ដេរីវេពីថតពិត)', living.length);
    check(linkCount >= 100, 'ជាន់អប្បបរមា ៖ តំណក្នុងស្រុកយ៉ាងតិច ១០០', linkCount);
    check(broken.length === 0, '⛔ ឯកសាររស់ ៖ តំណក្នុងស្រុកទាំងអស់ត្រូវចង្អុលទៅឯកសារដែលមានពិត',
        broken.slice(0, 8).join(' · '));
}

// ⛔ កូនសោ storage ជា **ស្នាមភ្ជាប់ដែលដេរីវេបាន** ៖ ឈ្មោះមានទម្រង់ច្បាស់
// ហើយវារស់នៅកូដ ship ពិត ➜ ការប្រៀបមិនមានសំឡេងរំខាន (វាស់បាន ៖ ២៤ កូនសោ
// ក្នុង CLAUDE.md ➜ ១ ដែលងាប់ ➜ ០ false positive)។
const docKeys = [...new Set((claudeText.match(/zoe[a-z]*_[a-z0-9_]{3,}/g) || []))];
const deadKeys = docKeys.filter((k) => SHIPPED_APP_TEXT.indexOf(k) === -1 && SUPABASE_SERVER_TEXT.indexOf(k) === -1);
check(docKeys.length >= 15, 'ជាន់អប្បបរមា ៖ CLAUDE.md យោងកូនសោ storage យ៉ាងតិច ១៥',
    'រកបាន ' + docKeys.length);
check(deadKeys.length === 0,
    '⛔ CLAUDE.md ៖ កូនសោ storage ដែលឯកសារយោង ត្រូវ **នៅមានក្នុងកូដ ship**',
    'លែងមានក្នុងកូដ ៖ ' + deadKeys.join(' · ')
    + '\n        ➜ ផ្ទៃត្រូវដកចេញ តែច្បាប់នៅរៀបរាប់វាជាផ្ទៃរស់');

// ⛔ ច្រកទ្វារ **ដេរីវេ** ៖ ដរាបណា `index.html` គ្មានវាលបំពេញលេខសាខា
// ឯកសារណាក៏មិនត្រូវប្រាប់អ្នកប្រើឲ្យបំពេញវាក្នុង App ដែរ។ បើថ្ងៃណាវាល
// នោះត្រឡប់មកវិញ ការពិនិត្យនេះ **ធូរដោយខ្លួនឯង** (ទិសផ្ទុយ)។
const zoewHtml = (() => {
    try { return fs.readFileSync(path.join(ROOT, 'ZoeW/index.html'), 'utf8'); } catch (_) { return ''; }
})();
const siteInputExists = /ztoListSite/i.test(zoewHtml);
// ⛔ បញ្ជីត្រូវ **ដេរីវេពីថតពិត** មិនមែនបញ្ជីរឹង (បញ្ជីរឹង = កាលបរិច្ឆេទ
// ផុតកំណត់ ➜ ឯកសារថ្មីដែលរៀបរាប់ផ្ទៃដដែល រអិលកាត់ស្ងាត់ៗ)។ `CLAUDE.md`
// និងសៀវភៅណែនាំក្នុង App ចូលរួមដែរ ព្រោះទាំង ២ ណែនាំអ្នកអាន។
const SITE_DOC_FILES = listAllDocs(ROOT, '', [])
    .concat(['CLAUDE.md', 'ZoeW/guide.html', 'ZoeKeyGen/guide.html'])
    .filter((rel) => fs.existsSync(path.join(ROOT, rel)));
// «បំពេញលេខសាខា…» · «លេខសាខា…បំពេញក្នុង App» · «លេខសាខា…រស់ក្នុងឧបករណ៍»
const SITE_MANUAL_RE = /(បំពេញ[^។\n]{0,40}លេខសាខា|លេខសាខា[^។\n]{0,40}(?:បំពេញក្នុង App|បំពេញក្នុង|រស់ក្នុងឧបករណ៍|រស់ក្នុង ZoeW))/;
// ⛔ ការបដិសេធជាប្រយោគត្រឹមត្រូវ («**គ្មាន**ផ្ទៃបំពេញលេខសាខា…») មិនមែន
// ការណែនាំទេ ➜ បើមិនលើកលែង អ្នកយាមនឹងហាមការសរសេរការពិត។
const SITE_NEGATION_RE = /(គ្មាន|លែង|មិនមែន|មិនមាន)/;
const siteOffenders = siteInputExists ? [] : SITE_DOC_FILES.filter((rel) => {
    let txt = '';
    try { txt = fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch (_) { return false; }
    const re = new RegExp(SITE_MANUAL_RE.source, 'g');
    let m;
    while ((m = re.exec(txt)) !== null) {
        if (!SITE_NEGATION_RE.test(txt.slice(Math.max(0, m.index - 28), m.index))) return true;
    }
    return false;
});
check(SITE_DOC_FILES.length >= 8, 'ជាន់អប្បបរមា ៖ ដេរីវេបញ្ជីឯកសារពីថតពិតបានយ៉ាងតិច ៨',
    SITE_DOC_FILES.length + ' ៖ ' + SITE_DOC_FILES.join(' · '));
check(siteOffenders.length === 0,
    '⛔ វាលបំពេញលេខសាខាដកចេញពី `index.html` ➜ គ្មានឯកសារណាត្រូវប្រាប់ឲ្យបំពេញវាក្នុង App',
    'ឯកសារដែលនៅរៀបរាប់ ៖ ' + siteOffenders.join(' · ')
    + '\n        ➜ លេខសាខាមកពី email របស់គណនី (`@zoew<លេខ>.com`) មិនមែនពីឧបករណ៍');

// ⛔ **កាតាឡុក `emu/*` ៖ បញ្ជីក្នុងឯកសារ ត្រូវប្រៀបនឹង `run-all.sh` ពិត។**
// Runbook ពន្យល់ថា «គ្មាន emulator ➜ checker ណាខ្លះធ្លាក់ចុះ» ដោយ **រាយ
// ឈ្មោះ** ។ បញ្ជីរឹងបែបនោះជា **កាលបរិច្ឆេទផុតកំណត់** ៖ checker `emu/*`
// ថ្មីនៅជុំក្រោយមិនលេចក្នុងបញ្ជី ➜ session ដែលរត់ដោយគ្មាន emulator ឃើញ
// ការធ្លាក់ចុះច្រើនជាងឯកសារ ➜ សន្និដ្ឋានខុសថាមានការធ្លាក់ពិត ហើយចំណាយ
// ជុំមួយទៅរកកំហុសដែលមិនមាន។ វាស់បាន (2.37.3) ៖ ឯកសាររាយ **៤** ខណៈ
// `run-all.sh` រត់ **៥** — `emu/license-seat-rules` (2.37.0) គ្មានឈ្មោះសោះ។
(function () {
    let runAll = '';
    try { runAll = fs.readFileSync(path.join(ROOT, 'audit-tools', 'run-all.sh'), 'utf8'); } catch (_) { runAll = ''; }
    const labels = [];
    const re = /run "(emu\/[a-z0-9-]+)"/g;
    let m;
    while ((m = re.exec(runAll)) !== null) if (labels.indexOf(m[1]) === -1) labels.push(m[1]);
    check(labels.length >= 4, 'ជាន់អប្បបរមា ៖ ដេរីវេ checker `emu/*` ពី `run-all.sh` បានយ៉ាងតិច ៤',
        'ឃើញ ' + labels.length + ' ៖ ' + labels.join(' · '));
    // ⛔ វិសាលភាពត្រូវជា **កថាខណ្ឌនៃការធ្លាក់ចុះ** មិនមែនឯកសារទាំងមូល ៖
    // ឈ្មោះដដែលលេចក្នុងតារាងស្នូល (`emu/license-seat-rules-test.js`) ធ្វើឲ្យ
    // ការស្វែងរកទូទាំងឯកសារ **ពិតដោយចៃដន្យ** ➜ អ្នកយាមងងឹតទាំងស្រុង។
    const degradeAt = claudeText.indexOf('គ្មាន RTDB emulator');
    check(degradeAt !== -1, 'ជាន់អប្បបរមា ៖ រកកថាខណ្ឌ «គ្មាន RTDB emulator» ក្នុង CLAUDE.md បាន',
        'រកមិនឃើញ');
    const degradeBlock = degradeAt === -1 ? '' : claudeText.slice(degradeAt, degradeAt + 1400);
    const missing = labels.filter((label) => degradeBlock.indexOf(label) === -1);
    check(missing.length === 0,
        '⛔ CLAUDE.md ៖ រាល់ checker `emu/*` ដែល `run-all.sh` រត់ ត្រូវមានឈ្មោះក្នុងកថាខណ្ឌធ្លាក់ចុះ',
        'គ្មានឈ្មោះ ៖ ' + missing.join(' · '));
    // ⛔ ទិសផ្ទុយ ៖ ឯកសារមិនត្រូវរាយ checker `emu/*` ដែល **លែងមាន**
    const ghosts = (claudeText.match(/`emu\/[a-z0-9-]+/g) || [])
        .map((raw) => raw.replace(/^`/, ''))
        .filter((name, i, all) => all.indexOf(name) === i)
        .filter((name) => name !== 'emu/ns')
        .filter((name) => {
            const base = name.slice(4);
            return !fs.existsSync(path.join(ROOT, 'audit-tools', 'emu', base + '.js'))
                && !fs.existsSync(path.join(ROOT, 'audit-tools', 'emu', base + '-test.js'))
                && !fs.existsSync(path.join(ROOT, 'audit-tools', 'emu', base + '-emu-test.js'));
        });
    check(ghosts.length === 0,
        '⛔ ទិសផ្ទុយ ៖ CLAUDE.md មិនត្រូវរាយ checker `emu/*` ដែលលែងមានក្នុងថត',
        'ឈ្មោះខ្មោច ៖ ' + ghosts.join(' · '));
})();

// ── អក្សរថៃ ធៀបនឹងអក្សរខ្មែរ ──────────────────────────────────────────────────────────
// ⛔ ច្បាប់ ៧ ៖ រាល់ការសរសេរជាភាសាខ្មែរ។ អក្សរថៃ (U+0E00–U+0E7F) មើលទៅស្រដៀងខ្មែរ ➜ ពាក្យថៃដែលលាយចូល (ឧ. ពាក្យថៃដែលមានន័យ
// ថា «ជុំ» សរសេរជំនួស «ជុំ») រអិលកាត់ភ្នែក។ វាស់បាន (2026-09-26) ៖ ម្ចាស់គម្រោងចាប់បានក្នុងការសន្ទនា មិនមែនឧបករណ៍ ➜ ឥឡូវស្កេន
// គ្រប់ឯកសារអត្ថបទ (ដេរីវេពីថតពិត) រួមទាំងប្រភព ZoeW React ដែល root វាស់មិនផ្ទុក (ដេរីវេពីទីតាំង root វាស់ ដូច `comments.js`)។
// ⛔ កុំសរសេរឧទាហរណ៍ជាអក្សរថៃ សូម្បីក្នុង comment នេះ ៖ probe សាងពី code point។
(function () {
    const THAI = /[\u0E00-\u0E7F]/;
    const probeThai = String.fromCharCode(0x0E23, 0x0E2D, 0x0E1A);
    const probeKhmer = String.fromCharCode(0x1787, 0x17BB, 0x17C6);
    check(THAI.test(probeThai) && !THAI.test(probeKhmer),
        'probe ៖ ការស្កេនចាប់អក្សរថៃ ហើយមិនចាប់អក្សរខ្មែរ (ទិសផ្ទុយ)', JSON.stringify({ thai: THAI.test(probeThai), khmer: THAI.test(probeKhmer) }));
    const TEXT_EXT = /\.(md|js|mjs|cjs|ts|tsx|mts|css|html|json|sh|cmd|bat|ps1|gs|ya?ml|txt|toml|xml|gradle|java|properties)$/i;
    const SKIP_DIRS = new Set(['node_modules', '.git', 'vendor', 'dist', 'dist-audit', '.original', 'build', '.gradle', 'assets']);
    const hits = [];
    let scanned = 0;
    const walk = (dir, rel) => {
        let entries = [];
        try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return; }
        entries.forEach((entry) => {
            const next = rel ? rel + '/' + entry.name : entry.name;
            if (entry.isDirectory()) { if (!SKIP_DIRS.has(entry.name) && !/^\.tmp-/.test(entry.name)) walk(path.join(dir, entry.name), next); return; }
            if (!entry.isFile() || !TEXT_EXT.test(entry.name) || /\.min\.js$/.test(entry.name)) return;
            let text = '';
            try { text = fs.readFileSync(path.join(dir, entry.name), 'utf8'); } catch (_) { return; }
            scanned++;
            if (!THAI.test(text)) return;
            text.split('\n').forEach((line, i) => {
                if (THAI.test(line)) hits.push(next + ':' + (i + 1) + '  ' + line.trim().slice(0, 80));
            });
        });
    };
    walk(ROOT, '');
    const root = path.resolve(ROOT);
    const suffix = path.join('ZoeW', 'dist-audit', 'measure-root');
    const measureTree = fs.existsSync(path.join(root, 'ZoeW', 'audit-source-files.json'));
    let reactSource = '';
    if (root.endsWith(path.sep + suffix)) {
        const candidate = path.join(root.slice(0, -suffix.length), 'ZoeW');
        if (fs.existsSync(path.join(candidate, 'src', 'main.tsx'))) reactSource = candidate;
    }
    if (reactSource) walk(reactSource, 'ZoeW(ប្រភព)');
    check(!measureTree || !!reactSource, 'root វាស់ ៖ រកប្រភព ZoeW React ឃើញ (អក្សរថៃក្នុង `src/**` វាស់បាន)',
        'root វាស់ ' + root + ' តែរក `ZoeW/src/main.tsx` មិនឃើញ');
    check(scanned >= 300, 'ជាន់អប្បបរមា ៖ ស្កេនឯកសារអត្ថបទយ៉ាងតិច ៣០០ រកអក្សរថៃ', 'ស្កេនបាន ' + scanned);
    check(hits.length === 0, '⛔ គ្មានអក្សរថៃ (U+0E00–U+0E7F) ក្នុងឯកសារ repo — ច្បាប់ ៧ ៖ សរសេរជាភាសាខ្មែរ',
        'រកឃើញ ' + hits.length + ' ជួរ ៖\n        ' + hits.slice(0, 10).join('\n        '));
})();

// ── លេខក្នុងជួរតែមួយ ៖ ខ្មែរ ឬឡាតាំង មិនលាយ ───────────────────────────────────────────────
// ⛔ ជួរ «ក–ខ» ដែលក្បាលជាលេខខ្មែរ ហើយចុងជាថេរ JS (បង្ហាញជាលេខឡាតាំង) ➜ អ្នកប្រើឃើញ «(១–3650)»។ វាស់បាន ៖ ម្ចាស់គម្រោងចាប់បាន
// លើប្រអប់ «ពន្យារហាង» របស់ ZoeKeyGen (រូបថត) មិនមែនឧបករណ៍។ ការស្កេន ៖ literal ដែលបញ្ចប់ដោយ «លេខខ្មែរ–» រួចភ្ជាប់ `+`/`${` (តម្លៃ
// ឡាតាំង) · ទិសផ្ទុយ «–លេខខ្មែរ» នៅក្រោយ `+` · និងជួរលាយក្នុងអក្សរតែមួយ។ App ទាំង ២ (កូដ ship · HTML · សៀវភៅ)។
(function () {
    const KH = '[\u17E0-\u17E9]';
    const MIXED = new RegExp(KH + '[\u2013-](?:[\'"`]\\s*\\+|\\$\\{|[0-9])|(?:\\+\\s*[\'"`]|\\})[\u2013-]' + KH + '|[0-9][\u2013-]' + KH);
    const bad = "alert('ថ្ងៃ \u17E1\u2013' + MAX)";
    const good = "alert('ថ្ងៃ 1\u2013' + MAX + ' · \u17E1\u2013\u17E5')";
    check(MIXED.test(bad) && MIXED.test('(\u17E1\u2013${MAX})') && MIXED.test('1\u2013\u17E5') && !MIXED.test(good),
        'probe ៖ ការស្កេនចាប់ជួរលេខលាយ ហើយមិនចាប់ជួរខ្មែរសុទ្ធ/ឡាតាំងសុទ្ធ (ទិសផ្ទុយ)');
    const files = ['ZoeKeyGen/app.js', 'ZoeKeyGen/index.html', 'ZoeW/app.js', 'ZoeW/index.html', 'ZoeW/guide.html', 'ZoeW/public/guide.html']
        .filter((f) => fs.existsSync(path.join(ROOT, f)));
    const hits = [];
    files.forEach((f) => {
        fs.readFileSync(path.join(ROOT, f), 'utf8').split('\n').forEach((line, i) => {
            if (MIXED.test(line)) hits.push(f + ':' + (i + 1) + '  ' + line.trim().slice(0, 100));
        });
    });
    check(files.includes('ZoeKeyGen/app.js') && files.includes('ZoeW/app.js'), 'ជាន់អប្បបរមា ៖ ស្កេនកូដ ship របស់ App ទាំង ២ រកជួរលេខលាយ', files.join(' · '));
    check(hits.length === 0, '⛔ ជួរលេខ «ក–ខ» មិនលាយលេខខ្មែរ និងឡាតាំង (ឧ. «(១–3650)») — App ទាំង ២',
        'រកឃើញ ' + hits.length + ' ៖\n        ' + hits.slice(0, 10).join('\n        '));
})();

// ════════════════════════════════════════════════════════════════════════
// ⛔ អត្ថបទក្នុង App មិននិយាយពីអ្វីដែល «លែងមាន» ឬ «ធ្លាប់ដក» (ច្បាប់ ៧ · សំណើម្ចាស់គម្រោង ៖ «ក្នុង App ទាំងអស់កុំ mention អ្វីដែលលែងមាន
//    អ្វីដែលធ្លាប់ដក») ➜ សរសេរតែ «វាដើរបែបនេះ» (បច្ចុប្បន្នកាល)។ វាស់បាន ៖ កំណត់ចំណាំកំណែក្នុង 🔔 រាយ «លែងបាំងរបា…ទៀតហើយ» ·
//    «(មុននេះបៃតងជាប់…)» · «ដូចមុន» ហើយសៀវភៅរាយ «ប៊ូតុងដកដោយដៃ…លែងមានទៀតហើយ» ខណៈច្បាប់ ៧ ជា 📝 (គ្មានអ្នកយាម)។
//    ⛔ ជាន់ ២ ៖ អត្ថបទឋិតិវន្ត (សៀវភៅ · HTML · កំណត់ចំណាំកំណែ) ហាមពាក្យ «អតីតកាល» ទាំងអស់; សារក្នុងកូដ (toast/alert) ហាមតែការប្រៀប
//    ធៀបនឹងកំណែ/ប្រព័ន្ធមុន — «កញ្ចប់នេះលែងមានក្នុងប្រព័ន្ធទៀតហើយ» ជា **ស្ថានភាពទិន្នន័យពេលនោះ** (ឧបករណ៍ផ្សេងលុប) មិនមែនមុខងារដែលដក។
// ════════════════════════════════════════════════════════════════════════
(function inAppTextTense() {
    // ⛔ «លែង» នៅក្នុង «កន្លែង» (ន្ + លែង) ➜ lookbehind `(?<!្)` · «លែងដៃ» (ទាញ PTR) ជាពាក្យធម្មតា ➜ មិននៅក្នុងបញ្ជី
    const STATIC_RE = /មុននេះ|ដូចមុន|ជាងមុន|ពីមុន|កំណែមុន|កំណែចាស់|ប្រព័ន្ធចាស់|ទៀតហើយ|ឈប់ប្រើ|ដកចេញរួច|(?<!្)លែង(?:មាន|ប្រើ|រត់|លិច|ជាប់|ស៊ី|វាស់|បាំង)/;
    // ⛔ សារក្នុងកូដ ៖ «ពីមុន» · «ដូចមុនវិញ» · «លែងប្រើបាន» ពិពណ៌នា **ព្រឹត្តិការណ៍ ឬផលវិបាកពេលនោះ** (ការសម្អាតដែលត្រូវរំខានពីមុន ·
    //    ការចងក្រយៅដៃចាស់ក្រោយប្តូរក្រយៅដៃ · ឧបករណ៍លើសពិដាន) ➜ ហាមតែការប្រៀបនឹងកំណែ/ប្រព័ន្ធមុន
    const CODE_RE = /មុននេះ|កំណែមុន|កំណែចាស់|ប្រព័ន្ធចាស់|ដកចេញរួច/;
    const first = (cands) => cands.map((c) => path.join(ROOT, c)).find((f) => fs.existsSync(f)) || '';
    const read = (f) => { try { return fs.readFileSync(f, 'utf8'); } catch (e) { return ''; } };
    const htmlText = (src) => src.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, '\n');
    const literals = (src) => (src.match(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g) || []);
    const walkFiles = (dir, re) => {
        const out = [];
        (function w(d) {
            let ents = [];
            try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { return; }
            ents.forEach((e) => {
                const f = path.join(d, e.name);
                if (e.isDirectory()) { if (e.name !== 'node_modules') w(f); } else if (re.test(e.name)) out.push(f);
            });
        })(dir);
        return out;
    };
    const hits = [];
    const scanText = (label, text, re) => text.split('\n').forEach((line, i) => {
        const m = re.exec(line);
        if (m) hits.push(label + ':' + (i + 1) + ' «' + m[0] + '» ' + line.trim().slice(0, 70));
    });
    const sources = [];
    const guide = first(['ZoeW/public/guide.html', 'ZoeW/guide.html']);
    const notes = first(['ZoeW/public/announcements.json', 'ZoeW/announcements.json']);
    const kgHtml = first(['ZoeKeyGen/index.html']);
    if (guide) { sources.push(guide); scanText(path.relative(ROOT, guide), htmlText(read(guide)), STATIC_RE); }
    if (kgHtml) { sources.push(kgHtml); scanText(path.relative(ROOT, kgHtml), htmlText(read(kgHtml)), STATIC_RE); }
    let noteItems = 0;
    if (notes) {
        sources.push(notes);
        let parsed = null;
        try { parsed = JSON.parse(read(notes)); } catch (e) {}
        const items = (parsed && Array.isArray(parsed.items)) ? parsed.items : [];
        noteItems = items.length;
        items.forEach((it) => [it.title, it.body].concat(it.points || []).forEach((t) => {
            if (typeof t === 'string' && STATIC_RE.test(t)) hits.push(path.relative(ROOT, notes) + ' [' + it.id + '] «' + STATIC_RE.exec(t)[0] + '» ' + t.slice(0, 70));
        }));
    }
    const jsx = walkFiles(path.join(ROOT, 'ZoeW', 'src', 'app', 'components'), /\.tsx$/);
    const shell = first(['ZoeW/index.shipped.html']);
    if (jsx.length) jsx.forEach((f) => { sources.push(f); scanText(path.relative(ROOT, f), read(f).replace(/\{[^{}]*\}/g, ' ').replace(/<[^>]+>/g, '\n'), STATIC_RE); });
    else if (shell) { sources.push(shell); scanText(path.relative(ROOT, shell), htmlText(read(shell)), STATIC_RE); }
    const codeFiles = walkFiles(path.join(ROOT, 'ZoeW', 'src'), /\.tsx?$/).concat(['ZoeW/app.js', 'ZoeKeyGen/app.js'].map((c) => path.join(ROOT, c)).filter((f) => fs.existsSync(f)));
    codeFiles.forEach((f) => literals(read(f)).forEach((lit) => {
        const m = CODE_RE.exec(lit);
        if (m) hits.push(path.relative(ROOT, f) + ' «' + m[0] + '» ' + lit.slice(0, 80));
    }));
    const probeBad = ['សញ្ញាលេចក្រោមរបា Tab មិនបាំងរបាទៀតហើយ', '(មុននេះបៃតងជាប់រាប់នាទី)', 'ប្រអប់នៅតែរីកចុះដូចមុន', 'ជួរដេកលែងរត់ចូលក្រោមរបា', 'ប៊ូតុងដកដោយដៃលែងមាន'];
    const probeGood = ['ចុចកន្លែងណាក៏បាន', 'រក្សាទុកនៅកន្លែងមានសុវត្ថិភាព', 'ទាញគ្រប់ ➜ លែងដៃដើម្បីផ្ទុក', 'Key នេះ លែងអាច Activate លើគ្រឿងថ្មី'];
    check(probeBad.every((t) => STATIC_RE.test(t)) && probeGood.every((t) => !STATIC_RE.test(t)),
        'អត្ថបទក្នុង App ៖ probe ទិសទាំង ២ (ពាក្យអតីតកាលត្រូវចាប់ · «កន្លែង» · «លែងដៃ» · ច្បាប់បច្ចុប្បន្ន មិនចាប់)');
    check(!!guide && !!kgHtml && !!notes && noteItems >= 5 && codeFiles.length >= 2,
        'អត្ថបទក្នុង App ៖ ជាន់អប្បបរមា — សៀវភៅ · ZoeKeyGen · កំណត់ចំណាំកំណែ (≥ ៥) · កូដ App ទាំង ២',
        JSON.stringify({ guide: !!guide, kgHtml: !!kgHtml, notes: noteItems, code: codeFiles.length }));
    check(hits.length === 0, '⛔ អត្ថបទក្នុង App មិននិយាយពីអ្វីដែលលែងមាន/ធ្លាប់ដក ឬប្រៀបនឹងកំណែមុន (សរសេរ «វាដើរបែបនេះ»)',
        'រកឃើញ ' + hits.length + ' ៖\n        ' + hits.slice(0, 12).join('\n        '));
})();

console.log('\n' + (fail ? 'FAIL ' + fail : 'PASS') + '  (' + pass + ')');
process.exit(fail ? 1 : 0);
