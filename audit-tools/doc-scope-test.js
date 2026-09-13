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
    .filter((label) => label.length >= 5);

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
const healthRowCount = new Set((healthBlock.match(/health[A-Za-z]+Row\(\)/g) || [])).size;

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
const HEALTH_CLAIM_DOCS = ['CLAUDE.md', 'ZoeW/README.md'];
const healthClaims = HEALTH_CLAIM_DOCS.map((rel) => {
    const f = path.join(ROOT, rel);
    const text = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
    const hit = text.match(/ពិនិត្យសុខភាពប្រព័ន្ធ\*{0,2}[^\n]*?(?:ជួរ \*{0,2}([០-៩0-9]+)|\*{0,2}([០-៩0-9]+) ជួរ)/);
    return { rel: rel, claimed: hit ? khmerToInt(hit[1] || hit[2]) : null };
});
check(healthClaims.every((c) => c.claimed !== null),
    'ជាន់អប្បបរមា ៖ រកឃើញការអះអាងចំនួនជួរ 🩺 ក្នុងឯកសារទាំង ' + HEALTH_CLAIM_DOCS.length,
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
check(lineClaim !== null && Math.abs(lineClaim - appLineCount) / appLineCount <= 0.12,
    '⛔ CLAUDE.md ៖ ទំហំ `ZoeW/app.js` ដែលរាយ ត្រូវនៅក្នុង ±១២% នៃការពិត',
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
const moneyDoc = fs.existsSync(path.join(ROOT, 'tools/money-check-windows/README-KH.md'))
    ? fs.readFileSync(path.join(ROOT, 'tools/money-check-windows/README-KH.md'), 'utf8') : '';
const moneyClaim = khmerToInt((moneyDoc.match(/រួចពិនិត្យ \*{0,2}([០-៩0-9]+)/) || [])[1]);
check(moneyRealSections >= 5, 'ជាន់អប្បបរមា ៖ `money-reality-check.js` មានផ្នែកយ៉ាងតិច ៥',
    'រាប់បាន ' + moneyRealSections);
check(moneyClaim !== null && moneyClaim === moneyRealSections,
    '⛔ `tools/money-check-windows/README-KH.md` ៖ ចំនួនការវាស់ត្រូវស្មើចំនួនផ្នែកពិតរបស់ឧបករណ៍',
    'README រាយ ' + moneyClaim + ' ខណៈឧបករណ៍មាន ' + moneyRealSections + ' ផ្នែក');

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
function nameIsDefined(name) {
    return new RegExp('(?:function|const|let|var|class)\\s+' + name + '\\b').test(sourceText)
        || new RegExp('\\b' + name + '\\s*[:=]\\s*(?:async\\s*)?(?:function|\\()').test(sourceText)
        || new RegExp('\\.' + name + '\\s*\\(').test(sourceText);
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

console.log('\n' + (fail ? 'FAIL ' + fail : 'PASS') + '  (' + pass + ')');
process.exit(fail ? 1 : 0);
