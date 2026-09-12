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
    'tools/zto-cookie-sync-windows/README-KH.md',
    'tools/money-check-windows/README-KH.md'
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
    check(head !== '' && shipped.some((v) => head.includes(v)),
        '⛔ ' + PROMPT_REL + ': ក្បាលតារាងនិយាយកំណែដែល App **ពិតជា ship**',
        'ក្បាល: ' + head.trim() + '\n        កំណែ ship ពិត: ' + shipped.join(' · ')
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
// ផ្នែក ៦ — «ការងារនៅសល់» ត្រូវរស់នៅ **តែមួយកន្លែង** និងមិនចាស់ស្ងាត់ៗ
// ============================================================================
//
// 🔴 ហេតុអ្វីវាមាន ៖ បញ្ជី «រង់ចាំការផ្ទៀងផ្ទាត់ដោយអ្នកប្រើ» ជា **ស្ថានភាព
// បណ្តោះអាសន្ន** មិនមែន **ច្បាប់** ➜ វាមិនមែនជាអ្នកស្រុករបស់ `CLAUDE.md` ទេ។
// ដរាបណាវាអង្គុយទីនោះ វាធ្លាក់ក្នុងអន្ទាក់ដដែលនឹងផ្នែក ៤–៥ ពីរយ៉ាង ៖
//
//   ១. **ស្ទួន** — បើជុំណាមួយចម្លងវាទៅឯកសារទី ២ នោះជុំក្រោយកែមួយ ភ្លេចមួយ
//      ➜ **បញ្ជីរង់ចាំ ២ ផ្ទុយគ្នា** (ច្បាប់ ១២ របស់ `CLAUDE.md`)។
//   ២. **ចាស់ស្ងាត់ៗ** — ជុំក្រោយ ship កំណែថ្មី តែភ្លេច update បញ្ជី ➜
//      អ្នកប្រើសាកកំណែ **ចាស់** លើឧបករណ៍ដែលដំណើរការកំណែ **ថ្មី**។
//
// ⛔ អ្វីដែលចាក់សោគឺ **ទាំង ២** ៖ ទីតាំង (តែមួយ) និងភាពស្រស់ (ដេរីវេពី
// `APP_VERSION` + `CACHE_VERSION` ពិត — មិនមែន literal ២ ខាងឯករាជ្យ)។
//
// ⛔ ទិសផ្ទុយត្រូវរក្សា ៖ បញ្ជី **ទទេ** (អ្នកប្រើបញ្ជាក់អស់ហើយ) ត្រូវឆ្លងកាត់
// ដដែល — ច្បាប់នេះវាស់ថា «អ្វីដែល *មាន* ត្រូវស្រស់» មិនមែន «ត្រូវតែមាន»។

const NEXT_REL = 'docs/NEXT-SESSION.md';
const nextFile = path.join(ROOT, NEXT_REL);
const nextDoc = fs.existsSync(nextFile) ? fs.readFileSync(nextFile, 'utf8') : null;

check(nextDoc !== null, NEXT_REL + ': ឯកសារ «ការងារនៅសល់» មានពិត',
    'រកមិនឃើញ ➜ បញ្ជីរង់ចាំគ្មានផ្ទះ');

// ⛔ ឯកសារកំព្រា (គ្មានឯកសារណាយោង) = ឯកសារដែលគ្មាននរណាអាន — ថ្នាក់ដដែលនឹង
// `tools/money-check-windows/README-KH.md` ដែលផ្នែក ១ រកឃើញ។
check(claudeText.indexOf(NEXT_REL) !== -1,
    '⛔ ' + NEXT_REL + ': ត្រូវមានការយោងពី CLAUDE.md (ឯកសារកំព្រា = គ្មាននរណាអាន)');

// ⛔ ជាន់អប្បបរមា ៖ ឯកសារទទេឆ្លងកាត់ការអះអាង «គ្មានលំនាំខុស» ដោយស្វ័យប្រវត្តិ
check(nextDoc !== null && nextDoc.length > 400,
    NEXT_REL + ': ជាន់អប្បបរមា ៖ ឯកសារមានខ្លឹមសារពិត',
    'ទំហំ = ' + (nextDoc === null ? 'គ្មានឯកសារ' : nextDoc.length));

// ⛔ ទីតាំងតែមួយ ៖ ធាតុរង់ចាំ (`## ⏳ …`) មិនត្រូវរស់នៅក្នុង CLAUDE.md ទៀតទេ
const PENDING_HEAD = /^##\s*⏳\s*(.+)$/gm;
const claudePending = (claudeText.match(PENDING_HEAD) || []);
check(claudePending.length === 0,
    '⛔ ទីតាំងតែមួយ ៖ ធាតុរង់ចាំរស់នៅ ' + NEXT_REL + ' មិនមែន CLAUDE.md (ច្បាប់ ១២)',
    'នៅសល់ក្នុង CLAUDE.md ៖\n        ' + claudePending.join('\n        '));

// ⛔ ភាពស្រស់ ៖ រាល់ធាតុរង់ចាំដែលអះអាងកំណែ ត្រូវអះអាងកំណែដែល App **ពិតជា ship**
//    ទម្រង់ ៖ `## ⏳ ZoeW \`2.33.3\` (\`zoew-v200\`) — …`
const PENDING_CLAIM = /^##\s*⏳\s*(ZoeW|ZoeKeyGen)\s*`([0-9]+\.[0-9]+\.[0-9]+)`(?:\s*\(`([^`]+)`\))?/gm;
const pendingClaims = [];
if (nextDoc !== null) {
    let m;
    while ((m = PENDING_CLAIM.exec(nextDoc)) !== null) {
        pendingClaims.push({ app: m[1], ver: m[2], cache: m[3] || null });
    }
}
const stalePending = pendingClaims.filter((c) =>
    (shippedVersion[c.app] && c.ver !== shippedVersion[c.app])
    || (c.cache && cacheVersion[c.app] && c.cache !== cacheVersion[c.app]));
check(stalePending.length === 0,
    '⛔ ' + NEXT_REL + ': ធាតុរង់ចាំត្រូវអះអាងកំណែដែល App **ពិតជា ship**',
    stalePending.map((c) => c.app + ' ៖ រាយ `' + c.ver + '`'
        + (c.cache ? ' (`' + c.cache + '`)' : '')
        + ' ខណៈកូដ ship `' + shippedVersion[c.app] + '` (`' + cacheVersion[c.app] + '`)').join('\n        '));

// ⛔ ការអះអាងអវត្តមានខាងលើពិតដោយស្វ័យប្រវត្តិពេលគ្មានធាតុណាត្រូវទម្រង់ ➜
//    ត្រូវបញ្ជាក់ថា *ការស្រង់* ដំណើរការ ៖ មានធាតុរង់ចាំ ឬឯកសារប្រកាសថាទទេ។
const EMPTY_MARK = /គ្មានធាតុរង់ចាំ/;
check(nextDoc !== null && (pendingClaims.length > 0 || EMPTY_MARK.test(nextDoc)),
    '⛔ ' + NEXT_REL + ': ការស្រង់ធាតុរង់ចាំដំណើរការ (មានធាតុ ឬប្រកាសថាទទេ)',
    'ស្រង់បាន ' + pendingClaims.length + ' ធាតុ ហើយគ្មានការប្រកាស «គ្មានធាតុរង់ចាំ»'
    + ' ➜ ទម្រង់ក្បាលប្រហែលប្រែ ➜ ការអះអាងភាពស្រស់ក្លាយជាកូដងាប់');

// ⛔ ទិសផ្ទុយ ៖ ការយោងកំណែ *ប្រវត្តិ* ក្នុងឯកសារនេះមិនត្រូវធ្វើឲ្យធ្លាក់ —
//    មានតែក្បាល `## ⏳` ទេដែលជាការអះអាងអំពី «អ្វីដែលកំពុងរង់ចាំ»។
//    ⛔ ការអះអាងនេះវាស់ **ឯកសារពិត** — មិនមែនខ្សែអក្សរសម្មតិកម្មក្នុង checker
//    (ការសាកលើខ្សែអក្សរដែល checker សរសេរខ្លួនឯង មិនបញ្ជាក់អ្វីអំពីឯកសារពិតទេ)។
const OTHER_VERSIONS = nextDoc === null ? []
    : [...new Set((nextDoc.match(/`[0-9]+\.[0-9]+\.[0-9]+`/g) || []))]
        .filter((v) => !pendingClaims.some((c) => v === '`' + c.ver + '`'));
check(nextDoc === null || OTHER_VERSIONS.length > 0,
    '⛔ ទិសផ្ទុយ ៖ ឯកសារពិតផ្ទុកការយោងកំណែ *ប្រវត្តិ* បាន — ច្បាប់នេះចាក់សោតែក្បាល `## ⏳`',
    'រកមិនឃើញការយោងប្រវត្តិសោះ ➔ អន្ទាក់«ចាក់សោកំហុស» ៖ ការអះអាងខាងលើអាចក្លាយជាការហាមការយោងប្រវត្តិ');

// ============================================================================
// ផ្នែក ៧ — Apps Script ៖ README ត្រូវ **កត់កំណែចូល** (សំណើអ្នកប្រើ)
// ============================================================================
//
// 🔴 ហេតុអ្វីវាមាន ៖ Apps Script **deploy ដោយដៃ** ➜ ការកែក្នុង repo
// **មិនប្តូរ script ដែល deploy រួច** ➜ `SCRIPT_VERSION` ជា **វិធីតែមួយ**
// ដែលអ្នកប្រើដឹងថា deployment ពិតជាទទួលកូដថ្មីឬនៅ។ README ទាំង ២ **ពន្យល់
// ច្បាប់នោះរួចហើយ** («ត្រូវឡើងរាល់ពេលកែ») — តែ ⛔ **គ្មានមួយណាកត់លេខ
// បច្ចុប្បន្នចូលសោះ** ➜ អ្នកប្រើបើក script.google.com រួចមិនដឹងថាគួរឃើញលេខ
// ណា ➜ ច្បាប់នោះ **អនុវត្តមិនបាន**។ នេះជាថ្នាក់ «ការកត់ត្រាមិនមែនជាការ
// អនុវត្ត» ៖ ច្បាប់សរសេររួច តែ **ភស្តុតាងដែលត្រូវប្រៀបធៀបគ្មាន**។
//
// ⛔ បញ្ជីគម្រោងត្រូវ **ដេរីវេពីថតពិត** មិនមែនបញ្ជីរឹង — បញ្ជីរឹងជា
// **កាលបរិច្ឆេទផុតកំណត់** ៖ គម្រោង Apps Script ទី ៣ ដែលកើតជុំក្រោយ
// នឹងគ្មានអ្នកយាមសោះ (ថ្នាក់ដដែលនឹង `listReadmeFiles()` ក្នុងផ្នែក ១)។

function findAppsScriptProjects(dir, rel, out) {
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return out; }
    entries.forEach((entry) => {
        if (entry.name === 'node_modules' || entry.name === '.git') return;
        const next = rel ? rel + '/' + entry.name : entry.name;
        if (entry.isDirectory()) findAppsScriptProjects(path.join(dir, entry.name), next, out);
        else if (entry.name === 'Code.gs') {
            const src = fs.readFileSync(path.join(dir, entry.name), 'utf8');
            const m = /var\s+SCRIPT_VERSION\s*=\s*(\d+)\s*;/.exec(src);
            if (m) out.push({ dir: rel, version: Number(m[1]) });
        }
    });
    return out;
}

const gsProjects = findAppsScriptProjects(ROOT, '', []);
check(gsProjects.length >= 2,
    'ជាន់អប្បបរមា ៖ រកឃើញគម្រោង Apps Script ដែលប្រកាស `SCRIPT_VERSION` យ៉ាងតិច ២',
    'រកឃើញ ' + gsProjects.length + ' ➜ ការស្កេនប្រហែលរអិលចេញពីគោលដៅ');

// ទម្រង់ដែលចាក់សោ ៖  `SCRIPT_VERSION` បច្ចុប្បន្ន ៖ **`N`**
const SV_CLAIM = /`SCRIPT_VERSION`\s*បច្ចុប្បន្ន\s*៖\s*\*\*`(\d+)`\*\*/;
const svMissing = [];
const svStale = [];
gsProjects.forEach((proj) => {
    const rel = (proj.dir ? proj.dir + '/' : '') + 'README.md';
    const f = path.join(ROOT, rel);
    if (!fs.existsSync(f)) { svMissing.push(rel + ' (គ្មាន README សោះ)'); return; }
    const m = SV_CLAIM.exec(fs.readFileSync(f, 'utf8'));
    if (!m) { svMissing.push(rel + ' (គ្មានការកត់កំណែ — កូដពិតជា `' + proj.version + '`)'); return; }
    if (Number(m[1]) !== proj.version) {
        svStale.push(rel + ' រាយ `' + m[1] + '` ខណៈ `' + proj.dir + '/Code.gs` ជា `' + proj.version + '`');
    }
});
check(svMissing.length === 0,
    '⛔ Apps Script ៖ README ត្រូវ **កត់ `SCRIPT_VERSION` បច្ចុប្បន្ន** (deploy ដោយដៃ ➜ អ្នកប្រើត្រូវដឹងលេខ)',
    svMissing.join('\n        '));
check(svStale.length === 0,
    '⛔ Apps Script ៖ លេខដែល README កត់ ត្រូវដេរីវេពី `Code.gs` ពិត',
    svStale.join('\n        '));

console.log('\n' + (fail ? 'FAIL ' + fail : 'PASS') + '  (' + pass + ')');
process.exit(fail ? 1 : 0);
