/**
 * អ្នកវាស់ «React ១០០%» ៖ React ជាម្ចាស់ DOM ទាំងអស់ ➜ កូដមុខងារ (`src/core` ·
 * `src/domain` · `src/features` · `src/services` · `src/ui` · `src/platform`)
 * **មិនប៉ះ DOM ដោយផ្ទាល់សោះ** ៖ វាសរសេរតែ state ហើយ component គូរពី state។
 * នៅក្នុង `src/app/**` component ប្រើ **ref** មិនមែនការស្វែងរកតាម id។
 *
 * ⛔ វិធីវាស់ជា **AST របស់ TypeScript** (មិនមែន regex) ៖ វារកការហៅ/ការចូលប្រើ
 *    ដែលប៉ះ DOM (`document.*` · `byId`/`qs`/`qsa` · `.classList` · `.style` ·
 *    `.textContent =` · `.innerHTML` · `.focus()` · `.setAttribute` · …)។
 * ⛔ ការលើកលែងត្រូវមាន **ហេតុផល** ក្នុង `ALLOWED` ហើយធាតុដែលលែងប្រើ ➜ ធ្លាក់
 *    (បញ្ជីលើកលែងងាប់ = ការលាក់កំហុសបន្ទាប់)។
 *
 *   node scripts/react-purity-check.mjs            # សង្ខេប
 *   node scripts/react-purity-check.mjs --list     # រាយគ្រប់កន្លែង
 *   PURITY_SRC=<ថត> node scripts/react-purity-check.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = process.env.PURITY_SRC || path.join(ROOT, 'src');
const LIST = process.argv.includes('--list');

/** ស្រទាប់ដែលមិនត្រូវប៉ះ DOM ទាល់តែសោះ */
const LOGIC_DIRS = ['core', 'domain', 'features', 'services', 'ui', 'platform'];

/**
 * ការលើកលែង ៖ `file:kind` ➜ `[ពិដានចំនួន, ហេតុផល]`។ ⛔ រាល់ធាតុត្រូវត្រូវបានប្រើ
 * យ៉ាងហោចណាស់ម្តង ហើយចំនួនលើសពិដាន ➜ ធ្លាក់ (ការប៉ះ DOM ថ្មីមិនអាចរអិលចូលឯកសារ
 * ដែលមានការលើកលែងរួចហើយ ដោយស្ងាត់)។
 */
const IO = 'platform/document-io.ts';
const IO_WHY = 'ការប៉ះ `document` ដែល **មិនមែន UI** (មើល header របស់ឯកសារ) ៖ ';
const ALLOWED = {
    [IO + ':document.readyState']: [1, IO_WHY + 'វដ្តជីវិតទំព័រ (`runOnWindowLoad`)'],
    [IO + ':document.hidden']: [1, IO_WHY + 'វដ្តជីវិតទំព័រ (ការស្តារការតភ្ជាប់ពេលត្រឡប់មក)'],
    [IO + ':document.addEventListener']: [1, IO_WHY + '`visibilitychange` ជាព្រឹត្តិការណ៍របស់ browser មិនមែន DOM ដែល React គូរ'],
    [IO + ':document.createElement']: [4, IO_WHY + 'canvas ក្រៅអេក្រង់ · `<link rel=preconnect>` · `<script>` បណ្ណាល័យ · តំណទាញយក'],
    [IO + ':.src =']: [2, IO_WHY + 'រូបភាពក្រៅអេក្រង់ · `<script>` បណ្ណាល័យ (ធាតុដែលទើបសាង មិនមែនរបស់ React)'],
    [IO + ':.href =']: [2, IO_WHY + 'preconnect · តំណទាញយក (ធាតុដែលទើបសាង)'],
    [IO + ':document.querySelectorAll']: [1, IO_WHY + 'រក preconnect/dns-prefetch ដែលមានរួចក្នុង `<head>` (ក្រៅ React)'],
    [IO + ':document.head']: [2, IO_WHY + '`<head>` មិនមែនរបស់ React (`#root` ស្ថិតក្នុង `<body>`)'],
    [IO + ':document.body']: [2, IO_WHY + 'តំណទាញយកបណ្តោះអាសន្ន — browser ខ្លះទាមទារឲ្យវាភ្ជាប់ document មុន `click()`'],
    [IO + ':.appendChild()']: [3, IO_WHY + 'ភ្ជាប់ធាតុដែលទើបសាងទៅ `<head>`/`<body>` (ក្រៅ `#root`)'],
    [IO + ':.removeChild()']: [1, IO_WHY + 'ដកតំណទាញយកបណ្តោះអាសន្នចេញវិញ'],
    [IO + ':.click()']: [1, IO_WHY + 'ចាប់ផ្តើមការទាញយក (វិធីតែមួយរបស់ browser)'],
    'services/camera.ts:elementOf()': [1, 'ការវាស់ ៖ `getCoverCropRect()` អាន `clientWidth/clientHeight` របស់ផ្ទៃវីដេអូ **រាល់ស៊ុម** (ref សម្រាប់ «measuring» — ច្រកចេញបន្ទាន់ដែល React ណែនាំ)'],
    'services/scan-engine.ts:elementOf()': [1, 'ការវាស់ ៖ ដូច `services/camera.ts` (ផ្លូវ ZXing)'],
};

/**
 * ⛔ `elementOf()` · `modalElement()` ត្រឡប់ធាតុ DOM ឆៅ ➜ កូដមុខងារដែលកាន់វាអាចប៉ះ DOM តាម
 *    ផ្លូវដែលការស្កេនមើលមិនឃើញ ➜ រាប់ជាការប៉ះ (ក្នុង `src/app` វាត្រឹមត្រូវ)។
 *    `videoElement()` មិនរាប់ ៖ វាចង type ត្រឹម `<video>` សម្រាប់ media playback។
 */
const DOM_GLOBAL_CALLS = new Set(['byId', 'qs', 'qsa', 'elementOf', 'modalElement']);
const DOM_PROPS_WRITE = new Set(['textContent', 'innerHTML', 'innerText', 'outerHTML', 'value', 'checked', 'disabled',
    'hidden', 'placeholder', 'title', 'src', 'href', 'scrollTop', 'scrollLeft', 'className', 'selectedIndex', 'indeterminate', 'files']);
const DOM_PROPS_ANY = new Set(['classList', 'style', 'dataset']);
const DOM_METHODS = new Set(['focus', 'blur', 'click', 'select', 'setAttribute', 'removeAttribute', 'toggleAttribute',
    'appendChild', 'removeChild', 'insertBefore', 'replaceChildren', 'append', 'prepend', 'insertAdjacentHTML',
    'getBoundingClientRect', 'scrollTo', 'scrollIntoView', 'closest', 'matches', 'showPicker', 'setSelectionRange', 'animate',
    'getElementById', 'querySelector', 'querySelectorAll', 'getElementsByClassName', 'getElementsByTagName', 'createElement', 'elementFromPoint']);

function walkDir(dir, out = []) {
    if (!fs.existsSync(dir)) return out;
    for (const name of fs.readdirSync(dir)) {
        const full = path.join(dir, name);
        if (fs.statSync(full).isDirectory()) walkDir(full, out);
        else if (/\.(ts|tsx)$/.test(name) && !name.endsWith('.d.ts')) out.push(full);
    }
    return out;
}

function findings(file) {
    const text = fs.readFileSync(file, 'utf8');
    const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const out = [];
    const add = (node, kind) => {
        const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
        out.push({ kind, line: line + 1, text: node.getText(sf).split('\n')[0].slice(0, 90) });
    };
    const isDocument = (e) => ts.isIdentifier(e) && e.text === 'document';
    const visit = (node) => {
        if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && DOM_GLOBAL_CALLS.has(node.expression.text)) add(node, node.expression.text + '()');
        if (ts.isPropertyAccessExpression(node)) {
            const name = node.name.text;
            if (isDocument(node.expression)) add(node, 'document.' + name);
            else if (DOM_PROPS_ANY.has(name)) add(node, '.' + name);
            else if (DOM_METHODS.has(name) && ts.isCallExpression(node.parent) && node.parent.expression === node) add(node, '.' + name + '()');
            else if (DOM_PROPS_WRITE.has(name) && ts.isBinaryExpression(node.parent) && node.parent.left === node &&
                node.parent.operatorToken.kind >= ts.SyntaxKind.FirstAssignment && node.parent.operatorToken.kind <= ts.SyntaxKind.LastAssignment) add(node, '.' + name + ' =');
        }
        ts.forEachChild(node, visit);
    };
    visit(sf);
    // ⛔ ការសរសេរ `.value =` លើវត្ថុធម្មតា (មិនមែន DOM) ក៏មានដែរ ➜ រក្សាតែពេលអ្នកកាន់មកពី
    //    ការស្វែងរក DOM ក្នុងឯកសារដដែល (ឬពេលឯកសារប៉ះ DOM ផ្សេងទៀត) — ការវាស់អភិរក្ស។
    const touchesDom = out.some((f) => f.kind !== '.value =' && f.kind !== '.checked =' && f.kind !== '.disabled =');
    return touchesDom ? out : out.filter((f) => !['.value =', '.checked =', '.disabled ='].includes(f.kind));
}

const files = walkDir(SRC);
const logicFiles = files.filter((f) => LOGIC_DIRS.includes(path.relative(SRC, f).split(path.sep)[0]));
const appFiles = files.filter((f) => path.relative(SRC, f).split(path.sep)[0] === 'app');

const fails = [];
const oks = [];
const ok = (label, cond, got) => { (cond ? oks : fails).push(cond ? label : label + (got !== undefined ? '  ➜ ' + got : '')); };

ok('ជាន់អប្បបរមា ៖ ឯកសារតក្កវិជ្ជា >= 50', logicFiles.length >= 50, logicFiles.length);
ok('ជាន់អប្បបរមា ៖ ឯកសារ React >= 50', appFiles.length >= 50, appFiles.length);

const usedAllow = new Set();
const allowCount = {};
const report = [];
let violations = 0;
const byKind = {};
const byFile = {};
for (const f of logicFiles) {
    const rel = path.relative(SRC, f).split(path.sep).join('/');
    for (const hit of findings(f)) {
        const key = rel + ':' + hit.kind;
        if (ALLOWED[key]) {
            usedAllow.add(key);
            allowCount[key] = (allowCount[key] || 0) + 1;
            if (allowCount[key] <= ALLOWED[key][0]) continue;
        }
        violations++;
        byKind[hit.kind] = (byKind[hit.kind] || 0) + 1;
        byFile[rel] = (byFile[rel] || 0) + 1;
        report.push(`${rel}:${hit.line}  ${hit.kind}  ${hit.text}`);
    }
}
/* src/app ៖ component ប្រើ ref — គ្មានការស្វែងរកតាម id/selector */
let appQueries = 0;
for (const f of appFiles) {
    const rel = path.relative(SRC, f).split(path.sep).join('/');
    for (const hit of findings(f)) {
        if (!/^(byId|qs|qsa)\(\)$|^document\.(getElementById|querySelector|querySelectorAll|getElementsBy)/.test(hit.kind)) continue;
        const key = rel + ':' + hit.kind;
        if (ALLOWED[key]) { usedAllow.add(key); continue; }
        appQueries++;
        report.push(`${rel}:${hit.line}  ${hit.kind}  ${hit.text}`);
    }
}
ok('កូដមុខងារ (core · domain · features · services · ui · platform) មិនប៉ះ DOM ដោយផ្ទាល់', violations === 0, violations);
ok('component React មិនស្វែងរក DOM តាម id/selector (ប្រើ ref)', appQueries === 0, appQueries);
const deadAllow = Object.keys(ALLOWED).filter((k) => !usedAllow.has(k));
ok('បញ្ជីលើកលែងគ្មានធាតុងាប់', deadAllow.length === 0, deadAllow.join(', '));
const loose = Object.keys(ALLOWED).filter((k) => (allowCount[k] || 0) < ALLOWED[k][0]);
ok('ពិដានការលើកលែងតឹង (ចំនួនពិត = ពិដាន)', loose.length === 0, loose.map((k) => k + ' ' + (allowCount[k] || 0) + '/' + ALLOWED[k][0]).join(', '));

/* ⛔ ឈ្មោះ ref គ្រប់ឈ្មោះត្រូវមាន component ចង — ឈ្មោះដែលគ្មានអ្នកចង = `elementOf()` ត្រឡប់
      `null` ជានិច្ច ➜ មុខងារងាប់ស្ងាត់ៗ (ឧ. ស្កេន QR ពេល Config ៖ «configQrVideo missing») */
const refsPath = path.join(SRC, 'app', 'refs.ts');
const refsSrc = fs.existsSync(refsPath) ? fs.readFileSync(refsPath, 'utf8') : '';
const refBlock = refsSrc.includes('REF_NAMES = [') ? refsSrc.slice(refsSrc.indexOf('REF_NAMES = ['), refsSrc.indexOf('] as const')) : '';
const refNames = [...refBlock.matchAll(/'([A-Za-z0-9_]+)'/g)].map((m) => m[1]);
/*
 * ⛔ វាស់ **ការភ្ជាប់ពិត** តាម AST មិនមែនវត្តមានអក្សរ ៖ `const r = refTo('x')` ដែលមិនដែល
 *    ឈរលើ `ref={…}` ក៏ជាឈ្មោះគ្មានអ្នកចងដែរ។ `ref={expr}` ត្រូវបានដោះស្រាយ ៖ ការហៅ
 *    `refTo('x')`/`refWithNative('x', …)` ផ្ទាល់ · identifier ➜ អថេរ/function ក្នុងឯកសារ
 *    ដដែល (តាមការហៅខាងក្នុង) · arrow function ➜ ការហៅខាងក្នុង។
 */
const bound = new Set();
for (const f of appFiles.filter((x) => x.endsWith('.tsx'))) {
    const text = fs.readFileSync(f, 'utf8');
    const sf = ts.createSourceFile(f, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const refCallName = (n) => (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && (n.expression.text === 'refTo' || n.expression.text === 'refWithNative')
        && n.arguments[0] && ts.isStringLiteral(n.arguments[0])) ? n.arguments[0].text : null;
    const decls = new Map();
    const visitDecl = (n) => {
        if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) decls.set(n.name.text, n.initializer);
        if (ts.isFunctionDeclaration(n) && n.name && n.body) decls.set(n.name.text, n.body);
        ts.forEachChild(n, visitDecl);
    };
    visitDecl(sf);
    const namesIn = (node, seen = new Set()) => {
        const out = new Set();
        const walk = (n) => {
            const direct = refCallName(n);
            if (direct) out.add(direct);
            if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && decls.has(n.expression.text) && !seen.has(n.expression.text)) {
                seen.add(n.expression.text);
                for (const x of namesIn(decls.get(n.expression.text), seen)) out.add(x);
            }
            ts.forEachChild(n, walk);
        };
        if (ts.isIdentifier(node) && decls.has(node.text) && !seen.has(node.text)) {
            seen.add(node.text);
            return namesIn(decls.get(node.text), seen);
        }
        walk(node);
        return out;
    };
    const visitJsx = (n) => {
        if (ts.isJsxAttribute(n) && n.name.getText(sf) === 'ref' && n.initializer && ts.isJsxExpression(n.initializer) && n.initializer.expression) {
            for (const x of namesIn(n.initializer.expression)) bound.add(x);
        }
        ts.forEachChild(n, visitJsx);
    };
    visitJsx(sf);
}
/*
 * ⛔ input ដែល React **ចាក់សោ** ៖ `value`/`checked` ដោយគ្មាន `onChange` (ឬ `readOnly`) ➜ React
 *    ស្តារតម្លៃក្រោយរាល់ការវាយ/ចុច ➜ អ្នកប្រើប្តូរវាមិនបាន។ វាស់បានក្នុង browser ៖ ប្រអប់ធីក
 *    «ចងចាំអ៊ីមែល» ដោះធីកមិនបាន; ការស្កេនដដែលចាប់ rail zoom កាមេរ៉ា (`value="1"`) ផង — input ជា **uncontrolled**
 *    (`defaultValue` · `defaultChecked`) ក្នុង App នេះ (`ARCHITECTURE.md` ផ្នែក ១១)។
 */
let inputsSeen = 0;
const frozen = [];
for (const f of appFiles.filter((x) => x.endsWith('.tsx'))) {
    const text = fs.readFileSync(f, 'utf8');
    const sf = ts.createSourceFile(f, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const rel = path.relative(SRC, f).split(path.sep).join('/');
    const visit = (n) => {
        if ((ts.isJsxSelfClosingElement(n) || ts.isJsxOpeningElement(n)) && ['input', 'select', 'textarea'].includes(n.tagName.getText(sf))) {
            inputsSeen++;
            const names = n.attributes.properties.filter(ts.isJsxAttribute).map((a) => a.name.getText(sf));
            const spread = n.attributes.properties.some((a) => ts.isJsxSpreadAttribute(a));
            const controls = names.filter((x) => x === 'value' || x === 'checked');
            if (controls.length && !spread && !names.includes('onChange') && !names.includes('readOnly')) {
                const { line } = sf.getLineAndCharacterOfPosition(n.getStart(sf));
                frozen.push(`${rel}:${line + 1} <${n.tagName.getText(sf)} ${controls.join('/')}> គ្មាន onChange`);
            }
        }
        ts.forEachChild(n, visit);
    };
    visit(sf);
}
ok('ជាន់អប្បបរមា ៖ ធាតុ input/select/textarea ក្នុង JSX >= 30', inputsSeen >= 30, inputsSeen);
ok('គ្មាន input ដែល React ចាក់សោ (`value`/`checked` គ្មាន `onChange`)', frozen.length === 0, frozen.join(' · '));
ok('ជាន់អប្បបរមា ៖ ឈ្មោះ ref >= 40', refNames.length >= 40, refNames.length);
const unbound = refNames.filter((n) => !bound.has(n));
ok('ឈ្មោះ ref គ្រប់ឈ្មោះមាន component ចង (`refTo`/`refWithNative`)', unbound.length === 0, unbound.join(', '));
const unknownBound = [...bound].filter((n) => !refNames.includes(n));
ok('គ្មានការចង ref ដែលឈ្មោះមិនស្ថិតក្នុង REF_NAMES', unknownBound.length === 0, unknownBound.join(', '));

if (violations) {
    console.log('── តាមប្រភេទ ──');
    for (const [k, n] of Object.entries(byKind).sort((a, b) => b[1] - a[1])) console.log(`   ${String(n).padStart(4)}  ${k}`);
    console.log('── តាមឯកសារ ──');
    for (const [k, n] of Object.entries(byFile).sort((a, b) => b[1] - a[1])) console.log(`   ${String(n).padStart(4)}  ${k}`);
}
if (LIST) for (const r of report) console.log('   ' + r);
for (const l of oks) console.log('   ok   ' + l);
for (const l of fails) console.log('   FAIL ' + l);
console.log(`\n${fails.length ? '❌' : '✅'} react-purity — ${oks.length} ok, ${fails.length} FAIL · ការប៉ះ DOM ក្រៅ React ៖ ${violations} · ការស្វែងរកក្នុង component ៖ ${appQueries}`);
process.exitCode = fails.length ? 1 : 0;
