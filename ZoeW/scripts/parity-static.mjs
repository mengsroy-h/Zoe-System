/**
 * ការវាស់ parity ដែល *មិនត្រូវការ browser* ៖ កាតាឡុករបស់ App ចាស់
 * ធៀបនឹង App ថ្មី — function · ថេរ · សកម្មភាព · កូនសោ storage ·
 * ផ្លូវ Firebase · អត្ថបទដែលអ្នកប្រើអាន។
 *
 * ⛔ ច្បាប់ ៖ បញ្ជីទាំងអស់ត្រូវ **ដេរីវេពីកូដពិត** មិនមែនសរសេរដោយដៃ —
 *    បញ្ជីរឹងគឺជាកាលបរិច្ឆេទផុតកំណត់ (មុខងារថ្មីរអិលកាត់ស្ងាត់)។
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'acorn';
import * as walk from 'acorn-walk';
import { transformSync } from 'esbuild';
import { resolveOldRoot } from './old-app.mjs';
import { REMOVED, REMOVED_STRINGS } from './intentional-removals.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const NEW_ROOT = path.join(HERE, '..');
const OLD_ROOT = resolveOldRoot(HERE);

const oldApp = readFileSync(path.join(OLD_ROOT, 'app.js'), 'utf8');
const oldHtml = readFileSync(path.join(OLD_ROOT, 'index.html'), 'utf8');
const oldCss = readFileSync(path.join(OLD_ROOT, 'style.css'), 'utf8');

function listFiles(dir, exts, out = []) {
    for (const name of readdirSync(dir)) {
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) listFiles(full, exts, out);
        else if (exts.some((e) => full.endsWith(e))) out.push(full);
    }
    return out;
}

const newFiles = listFiles(path.join(NEW_ROOT, 'src'), ['.ts', '.tsx']);

function astOf(code, loader) {
    const js = transformSync(code, { loader, format: 'esm', target: 'es2022', jsx: 'preserve' }).code;
    // JSX នៅសល់ ➜ ដកវាចេញដោយបម្លែងម្តងទៀតជា JS សុទ្ធ
    const plain = loader === 'tsx'
        ? transformSync(js, { loader: 'jsx', format: 'esm', target: 'es2022' }).code
        : js;
    return parse(plain, { ecmaVersion: 2023, sourceType: 'module' });
}

const newSources = newFiles.map((f) => ({
    file: path.relative(NEW_ROOT, f),
    text: readFileSync(f, 'utf8'),
    ast: astOf(readFileSync(f, 'utf8'), f.endsWith('.tsx') ? 'tsx' : 'ts')
}));

/* ── ១. function កម្រិតកំពូល ─────────────────────────────────────────── */
const oldAst = parse(oldApp, { ecmaVersion: 2023, sourceType: 'script' });
const oldFns = new Set();
const oldConsts = new Set();
const oldLets = new Set();
for (const n of oldAst.body) {
    if (n.type === 'FunctionDeclaration') oldFns.add(n.id.name);
    else if (n.type === 'VariableDeclaration') {
        for (const d of n.declarations) {
            const names = [];
            (function collect(p) {
                if (!p) return;
                if (p.type === 'Identifier') names.push(p.name);
                else if (p.type === 'ObjectPattern') p.properties.forEach((pr) => collect(pr.value || pr.argument));
                else if (p.type === 'ArrayPattern') p.elements.forEach(collect);
            })(d.id);
            names.forEach((x) => (n.kind === 'const' ? oldConsts : oldLets).add(x));
        }
    }
}

const newFns = new Set();
const newConsts = new Set();
for (const s of newSources) {
    for (const n of s.ast.body) {
        if (n.type === 'ExportNamedDeclaration' && n.declaration) {
            const d = n.declaration;
            if (d.type === 'FunctionDeclaration') newFns.add(d.id.name);
            if (d.type === 'VariableDeclaration') for (const v of d.declarations) if (v.id.type === 'Identifier') newConsts.add(v.id.name);
        }
        if (n.type === 'FunctionDeclaration') newFns.add(n.id.name);
        if (n.type === 'VariableDeclaration') for (const v of n.declarations) if (v.id.type === 'Identifier') newConsts.add(v.id.name);
    }
}

/* state `let` ➜ ត្រូវក្លាយជាវាលក្នុងឃ្លាំង */
const stateJson = JSON.parse(readFileSync(path.join(NEW_ROOT, 'src/_generated-state.json'), 'utf8'));
const newStateFields = new Set(Object.values(stateJson).flat().map((f) => f.name));

/* ── ២. ឈ្មោះសកម្មភាព ──────────────────────────────────────────────── */
function allowlistFrom(code) {
    const m = code.match(/ACTION_ALLOWLIST[^=]*=\s*\[([\s\S]*?)\]/);
    if (!m) return new Set();
    return new Set([...m[1].matchAll(/"([^"]+)"|'([^']+)'/g)].map((x) => x[1] || x[2]));
}
const oldActions = allowlistFrom(oldApp);
const registrySrc = readFileSync(path.join(NEW_ROOT, 'src/core/action-registry.ts'), 'utf8');
const newActions = new Set([...registrySrc.matchAll(/^\s{4}([A-Za-z_$][\w$]*),$/gm)].map((m) => m[1]));

/* ── ៣. string literal ដែលអ្នកប្រើអាន (មានអក្សរខ្មែរ) ──────────────── */
const KHMER = /[ក-៿]/;
function stringLiterals(ast) {
    const out = new Set();
    walk.full(ast, (node) => {
        if (node.type === 'Literal' && typeof node.value === 'string') out.add(node.value);
        if (node.type === 'TemplateLiteral') node.quasis.forEach((q) => out.add(q.value.cooked ?? ''));
    });
    return out;
}
/**
 * ⛔ ការប្រៀបធៀប *បំណែក HTML* ជាការវាស់ខុស ៖ ពេលអ្នកប្តូរ renderer ទៅ JSX
 *    អត្ថបទដដែលនៅដដែល តែបំណែក `<span class="x">អត្ថបទ</span>` រលាយ ➜
 *    អ្នកយាមរាយ «បាត់» ទាំងដែលអ្នកប្រើឃើញដូចគ្នាបេះបិទ។ ដូច្នេះយើងវាស់
 *    **អត្ថបទដែលអ្នកប្រើអាន** ៖ ដក tag ចេញ រួចប្រៀបធៀបផ្នែកនីមួយៗ។
 */
function visibleRuns(text) {
    // បំបែកនៅតួអក្សរវាក្យសម្ពន្ធ HTML ➜ អ្វីដែលនៅសល់ជា *អត្ថបទ* ឬ
    // *តម្លៃ attribute* (ដូច `title`) — ទាំង ២ អ្នកប្រើអានឃើញ។
    return String(text)
        .split(/[<>"'=]|\$\{/)
        .map((s) => s.trim())
        .filter((s) => s && KHMER.test(s));
}
const oldStrings = [...new Set([...stringLiterals(oldAst)].flatMap(visibleRuns))];
const newStringSet = new Set();
for (const s of newSources) for (const lit of stringLiterals(s.ast)) newStringSet.add(lit);
// អត្ថបទក្នុង JSX ក៏រាប់ដែរ ➜ ស្កេនអត្ថបទឆៅរបស់ .tsx
for (const s of newSources) if (s.file.endsWith('.tsx')) newStringSet.add(s.text);
const newAllText = [...newStringSet].join('\u0000');
const removedStrings = oldStrings.filter((s) => !newAllText.includes(s) && REMOVED_STRINGS[s]);
const missingStrings = oldStrings.filter((s) => !newAllText.includes(s) && !REMOVED_STRINGS[s]);
const deadRemovedStrings = Object.keys(REMOVED_STRINGS).filter((s) => !removedStrings.includes(s));

/* ── ៤. កូនសោ storage និងផ្លូវ Firebase ────────────────────────────── */
const STORAGE_RE = /^(zoew_|zoe_|zoeadmin_|last_entered_locker|remembered_email)/;
const oldKeys = [...stringLiterals(oldAst)].filter((s) => STORAGE_RE.test(s));
const newKeySet = new Set();
for (const s of newSources) for (const lit of stringLiterals(s.ast)) if (STORAGE_RE.test(lit)) newKeySet.add(lit);
const missingKeys = oldKeys.filter((k) => !newKeySet.has(k));

/* ── ៥. id និង data-act របស់ index.html ─────────────────────────────── */
const oldIds = [...oldHtml.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
const newIndexHtml = readFileSync(path.join(NEW_ROOT, 'index.html'), 'utf8');
const newHtmlText = newSources.filter((s) => s.file.endsWith('.tsx')).map((s) => s.text).join('\n') + '\n' + newIndexHtml;
// ⛔ id ក្នុង JSX អាចជា literal លើ prop (`id="x"` · `headId="x"`) ឬក្នុងបញ្ជីទិន្នន័យដែល JSX គូរ
//    (`{ id: 'x' }` ➜ `id={f.id}`)។ ការវាស់ **ធាតុពិតក្នុង DOM** គឺ `parity:dom`; នេះជាកាតាឡុកលឿន។
const escapeRe = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const idLiteral = (id) => new RegExp('(?:\\bid|[a-z]Id)\\s*[=:]\\s*["\']' + escapeRe(id) + '["\']');
const missingIds = oldIds.filter((id) => !newHtmlText.includes(`id="${id}"`) && !idLiteral(id).test(newHtmlText));

/* ── ៦. CSS ដូចគ្នាបេះបិទ ──────────────────────────────────────────── */
const newCss = readFileSync(path.join(NEW_ROOT, 'src/styles/app.css'), 'utf8');

/* ── របាយការណ៍ ─────────────────────────────────────────────────────── */
const removedFns = [...oldFns].filter((f) => !newFns.has(f) && REMOVED[f]);
const missingFns = [...oldFns].filter((f) => !newFns.has(f) && !REMOVED[f]);
// ⛔ ធាតុ REMOVED ដែល function នៅមាន ឬមិនមែនរបស់ដើម ➜ បញ្ជីងាប់ = ការលាក់កំហុសបន្ទាប់
const deadRemoved = Object.keys(REMOVED).filter((f) => !removedFns.includes(f));
const missingConsts = [...oldConsts].filter((c) => !newConsts.has(c) && !newStateFields.has(c));
const missingLets = [...oldLets].filter((l) => !newStateFields.has(l));
const missingActions = [...oldActions].filter((a) => !newActions.has(a));

const rows = [
    ['Function កម្រិតកំពូល', oldFns.size - removedFns.length, oldFns.size - removedFns.length - missingFns.length, missingFns],
    ['បញ្ជី «ដកចេញដោយចេតនា» មិនងាប់', Object.keys(REMOVED).length, Object.keys(REMOVED).length - deadRemoved.length, deadRemoved],
    ['ថេរ (const)', oldConsts.size, oldConsts.size - missingConsts.length, missingConsts],
    ['State (let)', oldLets.size, oldLets.size - missingLets.length, missingLets],
    ['សកម្មភាព (data-act)', oldActions.size, oldActions.size - missingActions.length, missingActions],
    ['id ក្នុង index.html', oldIds.length, oldIds.length - missingIds.length, missingIds],
    ['កូនសោ storage', oldKeys.length, oldKeys.length - missingKeys.length, missingKeys],
    ['អត្ថបទដែលអ្នកប្រើអាន', oldStrings.length - removedStrings.length, oldStrings.length - removedStrings.length - missingStrings.length, missingStrings],
    ['បញ្ជីអត្ថបទ «ដកចេញដោយចេតនា» មិនងាប់', Object.keys(REMOVED_STRINGS).length, Object.keys(REMOVED_STRINGS).length - deadRemovedStrings.length, deadRemovedStrings],
    ['style.css (byte)', 1, oldCss === newCss ? 1 : 0, oldCss === newCss ? [] : ['ឯកសារខុសគ្នា']]
];

let failed = 0;
console.log('╔══════════════════════════════════════════════════════════════════════╗');
console.log('║  របាយការណ៍ parity ៖ ZoeW (ដើម) ➜ ZoeW React (React + Vite)            ║');
console.log('╚══════════════════════════════════════════════════════════════════════╝\n');
for (const [label, total, found, missing] of rows) {
    const ok = missing.length === 0;
    if (!ok) failed++;
    const pct = total ? ((found / total) * 100).toFixed(2) : '100.00';
    console.log(`${ok ? '✅' : '❌'} ${label.padEnd(26)} ${String(found).padStart(5)}/${String(total).padEnd(5)}  ${pct}%`);
    if (!ok) missing.slice(0, 25).forEach((m) => console.log(`      • ${String(m).slice(0, 110)}`));
    if (missing.length > 25) console.log(`      … និង ${missing.length - 25} ទៀត`);
}
if (removedFns.length) {
    console.log(`\n🗑️  function ដើមដែលដកចេញដោយចេតនា ៖ ${removedFns.length} (scripts/intentional-removals.mjs)`);
    for (const f of removedFns) console.log(`      • ${f}`);
}
console.log(`\nModule ថ្មី ៖ ${newSources.length} ឯកសារ`);
console.log(`Function ដែល export ៖ ${newFns.size}`);
console.log(`វាល state ៖ ${newStateFields.size}`);
process.exit(failed ? 1 : 0);
