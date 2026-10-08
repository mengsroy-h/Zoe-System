// Code-duplication audit៖ រកកូដ **ជាន់គ្នា** ក្នុងឯកសារ ship តែមួយ។
//
// ⛔ វាមិនមែនជា linter រចនាបថទេ។ ថ្នាក់កំហុសដែលវាបិទគឺ៖ តក្កវិជ្ជាតែមួយ
// រស់នៅ **២ កន្លែង** ➜ ជុំក្រោយកែមួយ ភ្លេចមួយ ➜ ២ ច្បាប់ផ្ទុយគ្នាក្នុងកូដ
// តែមួយ។ វាជាថ្នាក់ដដែលនឹងច្បាប់ ១២ របស់ `CLAUDE.md` តែលើ **កូដ** ជំនួស
// **ឯកសារ** — ហើយវាកើតឡើងពិតលើផ្លូវលុយ៖ រូបមន្ត clamp របស់ ledger ធ្លាប់
// រស់នៅ ២ ច្បាប់ចម្លង (ថ្ងៃ · ខែ) ខណៈ `CLAUDE.md` ទាមទារថាពួកវា
// «ដូចគ្នាបេះបិទ»។
//
// ⛔ វាមិនប៉ះការជាន់គ្នា **ឆ្លង App** ទេ (ZoeW ↔ ZoeKeyGen) — នោះជាការ
// ជាន់គ្នា **ដោយចេតនា** (គ្មាន bundler) ហើយ `shared-fns.js` ចាក់សោវារួច។
//
// អ្នកយាមខ្លួនវា៖ ការអះអាង *អវត្តមាន* ពិតដោយស្វ័យប្រវត្តិលើ input ទទេ
// ដូច្នេះឯកសារនេះមាន (១) ជាន់អប្បបរមា · (២) probe វិជ្ជមាន (កូដសំយោគ
// ដែល **ត្រូវតែ** ចាប់បាន) និង (៣) probe ទិសផ្ទុយ (កូដស្អាតដែល **មិន
// ត្រូវ** ចាប់)។ បើ detector ខូច ការអះអាង ២ ចុងក្រោយធ្លាក់។

const fs = require('fs');
const path = require('path');
const acorn = require('acorn');

const ROOT = process.env.DUPCODE_APP_DIR
    ? path.resolve(process.env.DUPCODE_APP_DIR)
    : path.resolve(__dirname, '..');

// ⛔ ពិដានទាំងនេះជា **កម្រិតដែលវាស់រួច** មិនមែនលេខសំណាង៖ ការជាន់គ្នាពិត
// ដែលរកឃើញក្នុងជុំ 2026-09-05 មានទំហំ ២០២–៥៦៤ តួ។ ការតម្លើងលេខទាំងនេះ
// ធ្វើឲ្យ checker រត់ដោយមិនរត់អ្វីសោះ។
const FN_MIN_STMTS = 3;
const FN_MIN_CHARS = 120;
const BLOCK_WINDOW = 4;
const BLOCK_MIN_CHARS = 200;
// ⛔ detector រចនាសម្ព័ន្ធ ៖ ពិដានខ្ពស់ជាង ព្រោះកូដខ្លីៗច្រើនមានរូបរាងដូចគ្នា
// ដោយចៃដន្យ។ លេខនេះជា **កម្រិតដែលវាស់រួច** ៖ ជុំ 2026-09-05 រកឃើញថា
// រូបមន្តលុយ `X.cod = Math.round(X.barcodes.reduce(…))` រស់នៅ **១១ កន្លែង**
// ខណៈ detector អក្សរចាប់បានតែ **៥** — ៦ ទៀតខុសត្រឹមឈ្មោះ parameter របស់
// arrow function (`(s, b)` ធៀប `(sum, b)` ធៀប `(sum, bc)`) និងឈ្មោះ array។
const STRUCT_MIN_CHARS = 260;

const SHIP_FILES = [
    'ZoeW/app.js',
    'ZoeW/sw.js',
    'ZoeW/boot-flags.js',
    'ZoeW/firebase-loader.js',
    'ZoeW/netlify/functions/zto-order-detail.js',
    'ZoeKeyGen/app.js',
    'ZoeKeyGen/sw.js',
    'ZoeKeyGen/boot-flags.js',
    'ZoeKeyGen/firebase-loader.js'
];

// ⛔ `license-verify.js` និង `error-reporting.js` **មិនស្ថិតក្នុងបញ្ជីខាងលើ**
// ដោយចេតនា៖ ពួកវាត្រូវតែ byte-identical ទាំង ២ App (ច្បាប់ ៤) ➜ ការជាន់គ្នា
// ខាងក្នុងពួកវាត្រូវកែ **ក្នុង App ទាំង ២ ក្នុងជុំតែមួយ** ដែលជាកិច្ចការ
// របស់ `shared-fns.js` មិនមែនរបស់ឯកសារនេះ។

// ធាតុនីមួយៗត្រូវមាន **ហេតុផលសរសេរជាប់** — ធាតុគ្មានហេតុផលនឹងលាក់កំហុសបន្ទាប់។
// ⛔ `signature` ជា **អត្ថបទដែលត្រូវលេចក្នុងកូដជាន់គ្នានោះ** មិនមែនលេខបន្ទាត់ទេ ៖
// លេខបន្ទាត់រអិលរាល់ការកែ ➜ allowlist ដែលចងលើលេខបន្ទាត់ក្លាយជាការបិទបាំង
// ដោយចៃដន្យ។ ហើយធាតុណាដែល **មិនបានបិទបាំងអ្វីសោះ** ត្រូវធ្វើឲ្យ checker ធ្លាក់
// (ជាន់ខាងក្រោម) ព្រោះ «បញ្ជីអនុញ្ញាតត្រូវគ្មានធាតុងាប់»។
const ACCEPTED = [
    {
        file: 'ZoeW/app.js',
        signature: 'const reconcilePickupDeltaWithServer = () =>',
        names: ['reconcilePickupDeltaWithServer'],
        // ⛔ closure នេះបិទលើអថេរ `let` ក្នុងស្រុក ៥ (`pickupApplied` ·
        // `serverPickupMarks` · `pickupScanDate` · `pickupSeed` · `serverApplied`)
        // ដែល **តួ function ទាំងមូលអាន និងសរសេរ**។ ការរួបរួមទាមទារបំប្លែង
        // អថេរទាំង ៥ ទៅជាវាលរបស់ object ➜ ការកែ ~៤០ បន្ទាត់ក្នុង
        // `toggleIndividualBarcodeClose` និង `toggleCloseStatus` ដែលជា ២
        // function ដែលប៉ះលុយ **ដោយផ្ទាល់** ដើម្បីលុបការជាន់គ្នា ៨ បន្ទាត់។
        // ផ្ទៃហានិភ័យធំជាងអត្ថប្រយោជន៍ ➜ **ទទួលយកដោយចេតនា** (2026-09-05)។
        // ⚠️ 2026-09-09 ៖ ធាតុនេះធ្លាប់ការពារ **១៥** បន្ទាត់ ព្រោះ
        // `revertPickupDeltaAfterNoOp` ជាន់គ្នាដែរ — តែវា **មិនដែលត្រូវហៅ**
        // សោះ (កូដងាប់) ➜ ត្រូវលុបចេញ។ allowlist នៃការជាន់គ្នា **មិនវាស់ថា
        // កូដនោះរស់ឬអត់** ➜ វាអាចបិទបាំងកូដងាប់បាន។
        reason: 'closure លើអថេរក្នុងស្រុក ៥ — ការរួបរួមប៉ះផ្លូវលុយ ~៤០ បន្ទាត់ ដើម្បីលុប ៨'
    },
    {
        file: 'ZoeW/app.js',
        signature: 'const finalDiffY = endedTouch ? endedTouch.clientY - startY : 0;',
        // ⛔ `finishMainSwipe` និង `finishScrollerSwipe` ចែកក្បាល ៦ បន្ទាត់
        // (អាន touch ដែលលើក · គណនា diff · ច្រកចេញ PTR) រួច **បែកគ្នាទាំងស្រុង**
        // ៖ មួយសម្រេច `pendingAction`; មួយទៀតគណនា `finalDownward`/`shouldExpand`។
        // ⛔ វាស្ថិតក្នុង **តំបន់ហាមចូល** របស់ `CLAUDE.md` (PTR · ចលនាផ្ទាំង ·
        // ការរមូរ) ដែលត្រូវការ ~១១ ជុំ និងការថយក្រោយ ២ ដងទំរាំត្រូវ ហើយ
        // `CLAUDE.md` ហាមកែវាដោយគ្មានការស្នើពីអ្នកប្រើ។
        reason: 'តំបន់ហាមចូល (PTR · កាយវិការ · ការរមូរ) — ក្បាលរួម ៦ បន្ទាត់ តែតួបែកគ្នាទាំងស្រុង'
    }
];
const acceptedHits = ACCEPTED.map(() => 0);

let pass = 0;
let fail = 0;
function check(label, condition, detail) {
    if (condition) {
        pass++;
        console.log('   ok    ' + label);
    } else {
        fail++;
        console.log('   FAIL  ' + label
            + (detail !== undefined ? '  ➜ ' + JSON.stringify(detail) : ''));
    }
}

function parse(source) {
    // ⛔ `firebase-loader.js` ship ជា ES module ពិត ➜ `sourceType: 'script'`
    // បោះលើវា។ ការទម្លាក់ឯកសារនោះចោលស្ងាត់ៗនឹងធ្វើឲ្យវា **គ្មានអ្នកវាស់**។
    const opts = { ecmaVersion: 'latest', locations: true, allowHashBang: true };
    try {
        return acorn.parse(source, Object.assign({ sourceType: 'script', allowReturnOutsideFunction: true }, opts));
    } catch (e) {
        return acorn.parse(source, Object.assign({ sourceType: 'module' }, opts));
    }
}

function norm(source, node) {
    return source.slice(node.start, node.end).replace(/\s+/g, ' ').trim();
}

function walk(node, cb, parent) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach((c) => walk(c, cb, parent)); return; }
    if (typeof node.type !== 'string') return;
    cb(node, parent);
    for (const key of Object.keys(node)) {
        if (key === 'type' || key === 'start' || key === 'end' || key === 'loc' || key === 'range') continue;
        const value = node[key];
        if (value && typeof value === 'object') walk(value, cb, node);
    }
}

function nameOf(node, parent) {
    if (node.id && node.id.name) return node.id.name;
    if (parent) {
        if (parent.type === 'VariableDeclarator' && parent.id && parent.id.name) return parent.id.name;
        if (parent.type === 'Property' && parent.key) return parent.key.name || parent.key.value;
        if (parent.type === 'AssignmentExpression'
            && parent.left && parent.left.type === 'MemberExpression'
            && parent.left.property) return parent.left.property.name;
    }
    return '(anonymous)';
}

// ── detector ១៖ តួ function ដែលដូចគ្នាបេះបិទក្នុងឯកសារតែមួយ ────────────────
function duplicateFunctionBodies(source, ast) {
    const buckets = new Map();
    walk(ast, (node, parent) => {
        if (node.type !== 'FunctionDeclaration'
            && node.type !== 'FunctionExpression'
            && node.type !== 'ArrowFunctionExpression') return;
        const body = node.body;
        if (!body || body.type !== 'BlockStatement') return;
        if (body.body.length < FN_MIN_STMTS) return;
        const text = norm(source, body);
        if (text.length < FN_MIN_CHARS) return;
        if (!buckets.has(text)) buckets.set(text, []);
        buckets.get(text).push({ name: nameOf(node, parent), line: node.loc.start.line, chars: text.length, text });
    });
    return [...buckets.values()].filter((v) => v.length > 1);
}

// ── detector ២៖ លំដាប់ statement ដែលដូចគ្នាបេះបិទក្នុងឯកសារតែមួយ ───────────
function duplicateStatementBlocks(source, ast) {
    const lists = [];
    walk(ast, (node) => {
        if (Array.isArray(node.body) && node.body.length && node.body[0] && node.body[0].type) lists.push(node.body);
        if (Array.isArray(node.consequent) && node.consequent.length) lists.push(node.consequent);
    });
    const buckets = new Map();
    for (const list of lists) {
        for (let i = 0; i + BLOCK_WINDOW <= list.length; i++) {
            const win = list.slice(i, i + BLOCK_WINDOW);
            const text = win.map((s) => norm(source, s)).join(' ');
            if (text.length < BLOCK_MIN_CHARS) continue;
            if (!buckets.has(text)) buckets.set(text, []);
            buckets.get(text).push({
                line: win[0].loc.start.line,
                endLine: win[BLOCK_WINDOW - 1].loc.end.line,
                chars: text.length,
                text
            });
        }
    }
    // ធាតុតែមួយអាចលេចជាច្រើន window ជាន់គ្នា ➜ រក្សាតែ window ធំបំផុត
    const groups = [...buckets.values()]
        .filter((v) => v.length > 1 && new Set(v.map((x) => x.line)).size > 1)
        .sort((a, b) => b[0].chars - a[0].chars);
    // window ដែលរអិលមួយបន្ទាត់ៗលើតំបន់ដដែល ត្រូវរាយ **តែម្តង** — បើមិន
    // ដូច្នេះការជាន់គ្នា ១ កន្លែងលេចជា ៣ ជួរ ➜ អ្នកអានមិនដឹងថាមានប៉ុន្មាន។
    const overlaps = (a, b) => a.line <= b.endLine && b.line <= a.endLine;
    const kept = [];
    for (const g of groups) {
        const covered = kept.some((k) => g.every((l) => k.some((kl) => overlaps(l, kl))));
        if (!covered) kept.push(g);
    }
    return kept;
}

// ── detector ៣៖ ប្លុកដែល **រូបរាងដូចគ្នា** តែឈ្មោះក្នុងស្រុកខុស ─────────────
// ⛔ វាជាចន្លោះពិតរបស់ detector ២ ៖ ការប្តូរឈ្មោះអថេរធ្វើឲ្យតក្កវិជ្ជាដដែល
// មើលទៅជាកូដថ្មី។ literal (សារ · លេខ) **រក្សាដដែល** ➜ ការជាន់គ្នាដែលរាយ
// ជាតក្កវិជ្ជាដដែលពិត មិនមែនត្រឹមរូបរាងស្រដៀង។
function structuralSignature(source, nodes) {
    const slots = new Map();
    const out = [];
    function slot(name) {
        if (!slots.has(name)) slots.set(name, '#' + slots.size);
        return slots.get(name);
    }
    function walk(node, parent) {
        if (!node || typeof node !== 'object') return;
        if (Array.isArray(node)) { node.forEach((c) => walk(c, parent)); return; }
        if (typeof node.type !== 'string') return;
        out.push(node.type);
        if (node.type === 'Identifier') {
            const isProp = parent && parent.type === 'MemberExpression' && parent.property === node && !parent.computed;
            const isKey = parent && parent.type === 'Property' && parent.key === node && !parent.computed;
            // ⛔ property និង key **រក្សាឈ្មោះពិត** — `.cod` ធៀប `.dod` ជា
            // តក្កវិជ្ជាខុសគ្នា មិនមែនការប្តូរឈ្មោះទេ។
            out.push(isProp || isKey ? ':' + node.name : ':' + slot(node.name));
            return;
        }
        // ⛔ regex literal ៖ `JSON.stringify(/a/)` = `{}` ➜ **គ្រប់ regex មើលទៅ
        // ដូចគ្នា** ➜ បញ្ជី `const X_RE = /…/;` ៨ បន្ទាត់ត្រូវរាយជាការជាន់គ្នា
        // ក្លែងក្លាយ (វាស់បាន ៖ `zto-order-detail.js:12-20`)។ ត្រូវប្រើ `raw`។
        if (node.type === 'Literal') {
            out.push(':' + (node.regex ? node.raw : JSON.stringify(node.value)));
            return;
        }
        for (const key of Object.keys(node)) {
            if (key === 'type' || key === 'start' || key === 'end' || key === 'loc' || key === 'range') continue;
            const value = node[key];
            if (value && typeof value === 'object') walk(value, node);
        }
    }
    nodes.forEach((n) => walk(n, null));
    return out.join('|');
}

function duplicateStructuralBlocks(source, ast) {
    const lists = [];
    walk(ast, (node) => {
        if (Array.isArray(node.body) && node.body.length && node.body[0] && node.body[0].type) lists.push(node.body);
        if (Array.isArray(node.consequent) && node.consequent.length) lists.push(node.consequent);
    });
    const buckets = new Map();
    for (const list of lists) {
        for (let i = 0; i + BLOCK_WINDOW <= list.length; i++) {
            const win = list.slice(i, i + BLOCK_WINDOW);
            const raw = win.map((st) => norm(source, st)).join(' ');
            if (raw.length < STRUCT_MIN_CHARS) continue;
            const sig = structuralSignature(source, win);
            if (!buckets.has(sig)) buckets.set(sig, []);
            buckets.get(sig).push({
                line: win[0].loc.start.line,
                endLine: win[BLOCK_WINDOW - 1].loc.end.line,
                chars: raw.length,
                text: raw
            });
        }
    }
    const overlaps = (a, b) => a.line <= b.endLine && b.line <= a.endLine;
    const groups = [...buckets.values()]
        .filter((v) => v.length > 1 && new Set(v.map((x) => x.line)).size > 1)
        // ⛔ អ្វីដែល detector ២ ចាប់រួច មិនត្រូវរាយស្ទួន
        .filter((v) => new Set(v.map((x) => x.text)).size > 1)
        .sort((a, b) => b[0].chars - a[0].chars);
    const kept = [];
    for (const g of groups) {
        const covered = kept.some((k) => g.every((l) => k.some((kl) => overlaps(l, kl))));
        if (!covered) kept.push(g);
    }
    return kept;
}

function acceptedText(rel, text, names) {
    for (let i = 0; i < ACCEPTED.length; i++) {
        const entry = ACCEPTED[i];
        if (entry.file !== rel) continue;
        const bySignature = text.indexOf(entry.signature) !== -1;
        const byName = Array.isArray(entry.names) && names && names.length > 0
            && names.every((n) => entry.names.indexOf(n) !== -1);
        if (!bySignature && !byName) continue;
        acceptedHits[i]++;
        return true;
    }
    return false;
}

// ── ការស្កេនពិត ────────────────────────────────────────────────────────────
let filesParsed = 0;
let functionsSeen = 0;
let statementsSeen = 0;
const findings = [];

for (const rel of SHIP_FILES) {
    let source;
    try { source = fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch (e) { source = ''; }
    if (!source) { check('អានឯកសារ ship ' + rel, false, 'missing'); continue; }
    let ast;
    try { ast = parse(source); } catch (e) { check('parse ' + rel, false, e.message); continue; }
    filesParsed++;
    walk(ast, (node) => {
        if (node.type === 'FunctionDeclaration'
            || node.type === 'FunctionExpression'
            || node.type === 'ArrowFunctionExpression') functionsSeen++;
        if (typeof node.type === 'string' && node.type.endsWith('Statement')) statementsSeen++;
    });

    for (const group of duplicateFunctionBodies(source, ast)) {
        const names = [...new Set(group.map((g) => g.name))];
        if (acceptedText(rel, group[0].text, names)) continue;
        findings.push({
            kind: 'function-body', file: rel, chars: group[0].chars,
            where: group.map((g) => g.name + '@' + g.line).join('  |  ')
        });
    }
    for (const group of duplicateStatementBlocks(source, ast)) {
        if (acceptedText(rel, group[0].text, null)) continue;
        findings.push({
            kind: 'statement-block', file: rel, chars: group[0].chars,
            where: group.map((g) => g.line + '-' + g.endLine).join('  |  ')
        });
    }
    for (const group of duplicateStructuralBlocks(source, ast)) {
        if (group.some((g) => acceptedText(rel, g.text, null))) continue;
        findings.push({
            kind: 'structural-block', file: rel, chars: group[0].chars,
            where: group.map((g) => g.line + '-' + g.endLine).join('  |  ')
        });
    }
}

console.log('== ការជាន់គ្នាក្នុងកូដ ship ==');

// ជាន់អប្បបរមា៖ «គ្មានការជាន់គ្នាទេ» ពិតដោយស្វ័យប្រវត្តិលើថតទទេ។
check('អានឯកសារ ship គ្រប់ ' + SHIP_FILES.length, filesParsed === SHIP_FILES.length, filesParsed);
check('inventory function មិនទទេ (>= 900)', functionsSeen >= 900, functionsSeen);
check('inventory statement មិនទទេ (>= 6000)', statementsSeen >= 6000, statementsSeen);

if (findings.length) {
    console.log('');
    for (const f of findings) {
        console.log('   FAIL  ' + f.kind + ' ជាន់គ្នា [' + f.chars + ' តួ] ' + f.file + ' ៖ ' + f.where);
    }
    console.log('');
    console.log('   ➜ រួបរួមវាទៅ helper តែមួយ ឬបន្ថែមធាតុ ACCEPTED **ជាមួយហេតុផល**');
    console.log('     ក្នុង audit-tools/code-duplication-test.js។');
    fail += findings.length;
} else {
    check('គ្មានតួ function ឬប្លុក statement ជាន់គ្នាដែលមិនបានទទួលយក', true);
}

// ⛔ «បញ្ជីអនុញ្ញាតត្រូវគ្មានធាតុងាប់» — ធាតុដែលលែងបិទបាំងអ្វី គឺជាការអនុញ្ញាត
// ដែលនឹងលាក់ការជាន់គ្នា *ថ្មី* ដែលចៃដន្យត្រូវនឹង signature នោះ។
ACCEPTED.forEach((entry, i) => {
    check('ធាតុ ACCEPTED មិនងាប់ ៖ ' + entry.file + ' « ' + entry.signature + ' »',
        acceptedHits[i] > 0, acceptedHits[i]);
    check('ធាតុ ACCEPTED មានហេតុផលសរសេរជាប់ ៖ ' + entry.signature,
        typeof entry.reason === 'string' && entry.reason.length >= 20, entry.reason);
});

// ── probe វិជ្ជមាន៖ detector ត្រូវចាប់ការជាន់គ្នាដែលដាំដោយចេតនា ────────────
// ⛔ ប្លុកដែលដាំត្រូវ **គណនាធៀបនឹងពិដានពិត** (`BLOCK_WINDOW` ·
// `BLOCK_MIN_CHARS`) មិនមែនសរសេរជាអត្ថបទថេរ — បើមិនដូច្នេះ ការតម្លើងពិដាន
// ថ្ងៃណាមួយធ្វើឲ្យ probe នេះក្លាយជាបៃតងក្លែងក្លាយស្ងាត់ៗ។
function plantedBody() {
    const lines = [];
    let chars = 0;
    let i = 0;
    while (i < BLOCK_WINDOW || chars <= BLOCK_MIN_CHARS + 40) {
        const line = '        const dupValue' + i + ' = source.field' + i
            + ' * 2 + fallbackOffset' + i + ';';
        lines.push(line);
        chars += line.trim().length + 1;
        i++;
    }
    return lines.join('\n');
}
const PLANTED = 'function alpha(source, fallbackOffset0) {\n' + plantedBody()
    + '\n        return dupValue0;\n    }\n'
    + 'function beta(source, fallbackOffset0) {\n' + plantedBody()
    + '\n        return dupValue0;\n    }\n';
const plantedAst = parse(PLANTED);
check('probe វិជ្ជមាន៖ detector តួ function ចាប់ការជាន់គ្នាដែលដាំ',
    duplicateFunctionBodies(PLANTED, plantedAst).length >= 1,
    duplicateFunctionBodies(PLANTED, plantedAst).length);
check('probe វិជ្ជមាន៖ detector ប្លុក statement ចាប់ការជាន់គ្នាដែលដាំ',
    duplicateStatementBlocks(PLANTED, plantedAst).length >= 1,
    duplicateStatementBlocks(PLANTED, plantedAst).length);

// ── probe ទិសផ្ទុយ៖ កូដស្អាត **មិនត្រូវ** ចាប់ ────────────────────────────
const CLEAN = `
    function one(a) {
        const x = a * 2;
        const y = x + 1;
        if (y > 10) return y;
        return x;
    }
    function two(b) {
        const listOfThings = b.filter(Boolean);
        const firstThing = listOfThings[0];
        if (!firstThing) throw new Error('empty input for two()');
        return listOfThings.length + ':' + String(firstThing);
    }
`;
const cleanAst = parse(CLEAN);
// probe វិជ្ជមានទី ៣ ៖ តក្កវិជ្ជាដដែល ឈ្មោះខុស ➜ detector ២ **ខកខាន**
// (នោះជាហេតុផលដែល detector ៣ មាន) តែ detector ៣ **ត្រូវចាប់បាន**។
function renamedBody(a, b) {
    const lines = [];
    let chars = 0;
    let i = 0;
    while (i < BLOCK_WINDOW || chars <= STRUCT_MIN_CHARS + 40) {
        const line = '        holder.field' + i + ' = Math.round(' + a + '.list.reduce(('
            + a + 'Acc, ' + b + ') => ' + a + 'Acc + (parseFloat(' + b + '.cod) || 0), 0) * 100) / 100;';
        lines.push(line);
        chars += line.trim().length + 1;
        i++;
    }
    return lines.join('\n');
}
const RENAMED = 'function alphaRenamed(holder, sum, b) {\n' + renamedBody('sum', 'b')
    + '\n        return holder;\n    }\n'
    + 'function betaRenamed(holder, total, bc) {\n' + renamedBody('total', 'bc')
    + '\n        return holder;\n    }\n';
const renamedAst = parse(RENAMED);
check('probe វិជ្ជមាន៖ detector រចនាសម្ព័ន្ធចាប់តក្កវិជ្ជាដដែលដែលប្តូរឈ្មោះ',
    duplicateStructuralBlocks(RENAMED, renamedAst).length >= 1,
    duplicateStructuralBlocks(RENAMED, renamedAst).length);
check('probe ៖ detector អក្សរ **ខកខាន** វា (ហេតុផលដែល detector ៣ មាន)',
    duplicateStatementBlocks(RENAMED, renamedAst).length === 0,
    duplicateStatementBlocks(RENAMED, renamedAst).length);

// ⛔ probe ទិសផ្ទុយទី ២ ៖ ប្លុក ២ ដែលខុសត្រឹម **ឈ្មោះវាល** មិនមែនការជាន់គ្នា
// ទេ — `X.cod = …` និង `X.dod = …` ជាតក្កវិជ្ជា **ខុសគ្នា**។ បើថ្ងៃណា
// `structuralSignature()` ចាប់ផ្តើម normalize property ដែរ វានឹងរាយពួកវាជា
// ការជាន់គ្នាក្លែងក្លាយ ➜ ការអះអាងនេះធ្លាក់។ (mutation បញ្ជាក់ ៖ ការដក
// `isProp || isKey` ចេញ ធ្វើឲ្យវាក្រហម។)
function fieldBody(field) {
    const lines = [];
    let chars = 0;
    let i = 0;
    while (i < BLOCK_WINDOW || chars <= STRUCT_MIN_CHARS + 40) {
        const line = '        holder' + i + '.' + field + ' = Math.round(rows.reduce((acc, row) => acc + ('
            + 'parseFloat(row.' + field + ') || 0), 0) * 100) / 100;';
        lines.push(line);
        chars += line.trim().length + 1;
        i++;
    }
    return lines.join('\n');
}
const FIELD_DIFF = 'function usesCod(rows) {\n' + fieldBody('cod') + '\n        return rows;\n    }\n'
    + 'function usesDod(rows) {\n' + fieldBody('dod') + '\n        return rows;\n    }\n';
const fieldAst = parse(FIELD_DIFF);
check('probe ទិសផ្ទុយ៖ ប្លុកដែលខុសត្រឹម **ឈ្មោះវាល** មិនមែនការជាន់គ្នា',
    duplicateStructuralBlocks(FIELD_DIFF, fieldAst).length === 0,
    duplicateStructuralBlocks(FIELD_DIFF, fieldAst).length);

check('probe ទិសផ្ទុយ៖ កូដស្អាតមិនត្រូវរាយការជាន់គ្នា',
    duplicateFunctionBodies(CLEAN, cleanAst).length === 0
    && duplicateStatementBlocks(CLEAN, cleanAst).length === 0
    && duplicateStructuralBlocks(CLEAN, cleanAst).length === 0,
    duplicateFunctionBodies(CLEAN, cleanAst).length + '/' + duplicateStatementBlocks(CLEAN, cleanAst).length
    + '/' + duplicateStructuralBlocks(CLEAN, cleanAst).length);

console.log('\n         scan: ' + filesParsed + ' files · ' + functionsSeen
    + ' functions · ' + statementsSeen + ' statements · '
    + ACCEPTED.length + ' ACCEPTED · ' + findings.length + ' findings');
console.log('សរុប code-duplication: ' + pass + ' ok, ' + fail + ' FAIL');
process.exit(fail ? 1 : 0);
