'use strict';
const fs = require('fs');
const path = require('path');
const acorn = require('acorn');
const walk = require('acorn-walk');
const { MODULE_BOUNDS, STATE_GROUPS, DECL_OVERRIDES } = require('./modules.cjs');

const PROJECT = require('path').join(__dirname, '..');
const SRC_FILE = process.env.SRC_FILE || require('path').join(PROJECT, '.original', 'ZoeW', 'app.js');
const OUT_ROOT = process.env.OUT_ROOT || require('path').join(PROJECT, 'src');
const src = fs.readFileSync(SRC_FILE, 'utf8');
const ast = acorn.parse(src, { ecmaVersion: 2023, sourceType: 'script', locations: true, ranges: true });

/* ── ១. declaration កម្រិតកំពូល ─────────────────────────────────────────── */
const topDecls = [];          // { name, kind:'fn'|'const'|'let', node, start, end }
const topByName = new Map();

function patternNames(p, out) {
    if (!p) return out;
    if (p.type === 'Identifier') out.push(p.name);
    else if (p.type === 'ObjectPattern') p.properties.forEach((pr) => patternNames(pr.type === 'RestElement' ? pr.argument : pr.value, out));
    else if (p.type === 'ArrayPattern') p.elements.forEach((e) => patternNames(e, out));
    else if (p.type === 'AssignmentPattern') patternNames(p.left, out);
    else if (p.type === 'RestElement') patternNames(p.argument, out);
    return out;
}

for (const node of ast.body) {
    if (node.type === 'FunctionDeclaration') {
        const d = { name: node.id.name, kind: 'fn', node, start: node.start, end: node.end, line: node.loc.start.line };
        topDecls.push(d); topByName.set(d.name, d);
    } else if (node.type === 'VariableDeclaration') {
        for (const decl of node.declarations) {
            for (const name of patternNames(decl.id, [])) {
                const d = { name, kind: node.kind === 'let' || node.kind === 'var' ? 'let' : 'const', node, decl, start: node.start, end: node.end, line: node.loc.start.line };
                topDecls.push(d); topByName.set(name, d);
            }
        }
    }
}

/* ── ២. ផែនទី state ─────────────────────────────────────────────────────── */
const stateOwner = new Map();  // name -> storeName
for (const [store, names] of Object.entries(STATE_GROUPS)) for (const n of names) stateOwner.set(n, store);

/* ── ៣. ស្កេន declaration ខាងក្នុង (រក shadowing) ─────────────────────── */
const innerDeclared = new Set();
function declareInner(names) { names.forEach((n) => innerDeclared.add(n)); }
walk.full(ast, (node) => {
    if (node === ast) return;
    if (node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression') {
        if (node.id && node.type !== 'FunctionDeclaration') declareInner([node.id.name]);
        node.params.forEach((p) => declareInner(patternNames(p, [])));
    } else if (node.type === 'CatchClause' && node.param) {
        declareInner(patternNames(node.param, []));
    } else if (node.type === 'ClassDeclaration' || node.type === 'ClassExpression') {
        if (node.id) declareInner([node.id.name]);
    }
});
// var/let/const declared *inside* any function body
for (const top of ast.body) {
    if (top.type !== 'FunctionDeclaration') continue;
    walk.full(top.body, (node) => {
        if (node.type === 'VariableDeclaration') for (const d of node.declarations) declareInner(patternNames(d.id, []));
        if (node.type === 'FunctionDeclaration' && node.id) declareInner([node.id.name]);
    });
}
// top-level function names declared at top level are NOT inner
const shadowedState = [...stateOwner.keys()].filter((n) => innerDeclared.has(n));

/* ── ៣ខ. ជួរវិសាលភាពដែល *បាំង* ឈ្មោះ state ➜ ការយោងក្នុងនោះមិនត្រូវប្តូរ ── */
const shadowRanges = [];   // { name, start, end }
function noteShadow(name, node) { if (stateOwner.has(name)) shadowRanges.push({ name, start: node.start, end: node.end }); }
walk.full(ast, (node) => {
    if (node === ast) return;
    if (node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression') {
        node.params.forEach((p) => patternNames(p, []).forEach((n) => noteShadow(n, node)));
        if (node.body && node.body.type === 'BlockStatement') {
            walk.full(node.body, (inner) => {
                if (inner.type === 'VariableDeclaration') for (const d of inner.declarations) patternNames(d.id, []).forEach((n) => noteShadow(n, node));
                if (inner.type === 'FunctionDeclaration' && inner.id) noteShadow(inner.id.name, node);
            });
        }
    } else if (node.type === 'CatchClause' && node.param) {
        patternNames(node.param, []).forEach((n) => noteShadow(n, node));
    }
});
function isShadowed(name, pos) {
    for (const r of shadowRanges) if (r.name === name && pos >= r.start && pos < r.end) return true;
    return false;
}

/* ── ៤. ប្រមូល Identifier ដែលជា *ការយោង* ───────────────────────────── */
const refs = [];               // { name, start, end, shorthandProp:boolean }
const skip = new Set();        // node ranges that are NOT references

function markPattern(p) {
    if (!p) return;
    if (p.type === 'Identifier') skip.add(p.start + ':' + p.end);
    else if (p.type === 'ObjectPattern') p.properties.forEach((pr) => { if (pr.type === 'RestElement') markPattern(pr.argument); else markPattern(pr.value); });
    else if (p.type === 'ArrayPattern') p.elements.forEach(markPattern);
    else if (p.type === 'AssignmentPattern') markPattern(p.left);
    else if (p.type === 'RestElement') markPattern(p.argument);
}

walk.full(ast, (node) => {
    switch (node.type) {
        case 'MemberExpression':
            if (!node.computed && node.property.type === 'Identifier') skip.add(node.property.start + ':' + node.property.end);
            break;
        case 'Property':
            if (!node.computed && node.key.type === 'Identifier' && !node.shorthand) skip.add(node.key.start + ':' + node.key.end);
            break;
        case 'PropertyDefinition':
        case 'MethodDefinition':
            if (!node.computed && node.key && node.key.type === 'Identifier') skip.add(node.key.start + ':' + node.key.end);
            break;
        case 'FunctionDeclaration':
        case 'FunctionExpression':
        case 'ArrowFunctionExpression':
            if (node.id) skip.add(node.id.start + ':' + node.id.end);
            node.params.forEach(markPattern);
            break;
        case 'ClassDeclaration':
        case 'ClassExpression':
            if (node.id) skip.add(node.id.start + ':' + node.id.end);
            break;
        case 'VariableDeclarator':
            markPattern(node.id);
            break;
        case 'CatchClause':
            if (node.param) markPattern(node.param);
            break;
        case 'LabeledStatement':
            skip.add(node.label.start + ':' + node.label.end);
            break;
        case 'BreakStatement':
        case 'ContinueStatement':
            if (node.label) skip.add(node.label.start + ':' + node.label.end);
            break;
    }
});

walk.full(ast, (node, _s, _a) => {
    if (node.type !== 'Identifier') return;
    if (skip.has(node.start + ':' + node.end)) return;
    refs.push({ name: node.name, start: node.start, end: node.end, node });
});
// shorthand properties: `{ scanHistory }` needs `scanHistory: dataState.scanHistory`
const shorthandKeys = new Set();
walk.full(ast, (node) => {
    if (node.type === 'Property' && node.shorthand && node.value.type === 'Identifier') shorthandKeys.add(node.value.start + ':' + node.value.end);
});

/* ── ៥. module ownership ─────────────────────────────────────────────── */
function moduleForLine(line) {
    let cur = MODULE_BOUNDS[0][1];
    for (const [start, name] of MODULE_BOUNDS) { if (line >= start) cur = name; else break; }
    return cur;
}
for (const d of topDecls) d.module = DECL_OVERRIDES[d.name] || moduleForLine(d.line);

/* ── ៥ខ. arity ពិតនៃកន្លែងហៅ ➜ param ស្រេចចិត្ត ────────────────────────
 * JS អនុញ្ញាតឲ្យហៅ `f(a, b)` ជា `f(1)` ដោយ `b === undefined`។ TS បដិសេធ។
 * ការសម្គាល់ `?` ជា **ការពិពណ៌នា type** មិនមែនការប្តូរឥរិយាបថ ➜ យើង
 * ដេរីវេវាពី *កន្លែងហៅពិត* មិនមែនដោយការទាយ។ */
const callArity = new Map();   // fnName -> min args seen
walk.full(ast, (node) => {
    if (node.type !== 'CallExpression') return;
    const c = node.callee;
    if (c.type === 'Identifier') {
        const n = c.name;
        if (!topByName.has(n) || topByName.get(n).kind !== 'fn') return;
        const spread = node.arguments.some((a) => a.type === 'SpreadElement');
        const count = spread ? 99 : node.arguments.length;
        callArity.set(n, Math.min(callArity.has(n) ? callArity.get(n) : 99, count));
    }
});
// មុខងារដែលហៅតាម `ACTION_ALLOWLIST` / `apply` ➜ arity ថាមវន្ត ➜ ស្រេចចិត្តទាំងអស់
const dynamicCalled = new Set();
{
    const allow = ast.body.find((n) => n.type === 'VariableDeclaration' && n.declarations.some((d) => d.id.name === 'ACTION_ALLOWLIST'));
    if (allow) {
        const d = allow.declarations.find((x) => x.id.name === 'ACTION_ALLOWLIST');
        for (const el of d.init.elements || []) if (el && el.type === 'Literal') dynamicCalled.add(el.value);
    }
}
// ក. រាប់ការប្រកាសតាមឈ្មោះ (រួម function ខាងក្នុង) ➜ អនុវត្តតែពេលឈ្មោះ *តែមួយ*
const declCount = new Map();
const innerFns = [];
walk.full(ast, (node) => {
    if (node.type === 'FunctionDeclaration' && node.id) {
        declCount.set(node.id.name, (declCount.get(node.id.name) || 0) + 1);
        if (!ast.body.includes(node)) innerFns.push(node);
    }
});
walk.full(ast, (node) => {
    if (node.type !== 'CallExpression') return;
    const c = node.callee;
    if (c.type !== 'Identifier') return;
    const spread = node.arguments.some((a) => a.type === 'SpreadElement');
    const count = spread ? 99 : node.arguments.length;
    callArity.set(c.name, Math.min(callArity.has(c.name) ? callArity.get(c.name) : 99, count));
});

const paramEdits = [];
for (const node of innerFns) {
    const name = node.id.name;
    if (declCount.get(name) !== 1) continue;
    if (topByName.has(name)) continue;
    if (!callArity.has(name)) continue;
    const min = callArity.get(name);
    for (let i = Math.max(0, min); i < node.params.length; i++) {
        const p = node.params[i];
        if (p.type !== 'Identifier') continue;
        paramEdits.push({ start: p.end, end: p.end, text: '?' });
    }
}
for (const d of topDecls) {
    if (d.kind !== 'fn') continue;
    const params = d.node.params;
    if (!params.length) continue;
    const dyn = dynamicCalled.has(d.name);
    const min = dyn ? 0 : (callArity.has(d.name) ? callArity.get(d.name) : params.length);
    if (min >= params.length) continue;
    for (let i = Math.max(0, min); i < params.length; i++) {
        const p = params[i];
        if (p.type !== 'Identifier') continue;             // default/rest ស្រេចចិត្តរួចហើយ
        paramEdits.push({ start: p.end, end: p.end, text: '?' });
    }
}

/* ── ៦. សាងអត្ថបទថ្មីតាម declaration ─────────────────────────────────── */
const edits = [];   // { start, end, text }
let shadowSkipped = 0;
for (const r of refs) {
    const owner = stateOwner.get(r.name);
    if (!owner) continue;
    if (isShadowed(r.name, r.start)) { shadowSkipped++; continue; }
    const replacement = shorthandKeys.has(r.start + ':' + r.end)
        ? `${r.name}: ${owner}.${r.name}`
        : `${owner}.${r.name}`;
    edits.push({ start: r.start, end: r.end, text: replacement });
}
/* `document.getElementById(` ➜ `byId(` ៖ អ្នកចូលដំណើរការ DOM តែមួយ */
const domHelperUsers = new Set();
walk.full(ast, (node) => {
    if (node.type !== 'CallExpression') return;
    const c = node.callee;
    if (c.type !== 'MemberExpression' || c.computed) return;
    if (c.object.type !== 'Identifier' || c.object.name !== 'document') return;
    let helper = null;
    if (c.property.name === 'getElementById') helper = 'byId';
    else if (c.property.name === 'querySelector') helper = 'qs';
    else if (c.property.name === 'querySelectorAll') helper = 'qsa';
    if (!helper) return;
    if (helper === 'qsa') return; // `querySelectorAll` ត្រឡប់ NodeList ➜ ទុកដដែល
    edits.push({ start: c.start, end: c.end, text: helper });
    domHelperUsers.add(c.start + ':' + helper);
});

for (const pe of paramEdits) edits.push(pe);
edits.sort((a, b) => a.start - b.start || a.end - b.end);

function applyEdits(text, absStart, absEnd) {
    const local = edits.filter((e) => e.start >= absStart && e.end <= absEnd);
    let out = '';
    let cursor = absStart;
    for (const e of local) {
        out += src.slice(cursor, e.start) + e.text;
        cursor = e.end;
    }
    out += src.slice(cursor, absEnd);
    return out;
}

/* ── ៧. ចេញ module ────────────────────────────────────────────────────── */
const modules = new Map();     // modName -> { decls: [], body: [] }
for (const d of topDecls) {
    if (!modules.has(d.module)) modules.set(d.module, { decls: [], seenNodes: new Set() });
    modules.get(d.module).decls.push(d);
}

// dedupe VariableDeclaration nodes shared by multiple names
/* ⛔ ជួរតួអក្សរដែល **មិនត្រូវប៉ះ** ពេល dedent ៖ ខាងក្នុង template literal
 * អត្ថបទគឺជា *ទិន្នន័យ* មិនមែនការចាក់ចន្លោះ ➜ ការកាត់ ៤ ចន្លោះនៅទីនោះ
 * ប្តូរអ្វីដែលអ្នកប្រើឃើញ (HTML នាំចេញ · របាយការណ៍ · ប្រអប់)។ */
const quasiRanges = [];
walk.full(ast, (node) => {
    if (node.type !== 'TemplateLiteral') return;
    for (const q of node.quasis) quasiRanges.push([q.start, q.end]);
});
quasiRanges.sort((a, b) => a[0] - b[0]);
function insideQuasi(pos) {
    let lo = 0, hi = quasiRanges.length - 1;
    while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const [s, e] = quasiRanges[mid];
        if (pos < s) hi = mid - 1;
        else if (pos >= e) lo = mid + 1;
        else return true;
    }
    return false;
}

/* dedent ត្រូវក្លាយជា *edit លើអត្ថបទដើម* មិនមែនការកាត់ក្រោយ៖ ការកាត់ក្រោយ
 * ប្រើ offset ដែលផ្លាស់ប្តូររួចដោយ edit របស់ state ➜ បន្ទាត់ខុស។ */
function dedentEdits(absStart, absEnd) {
    const out = [];
    let pos = src.indexOf('\n', absStart);
    while (pos !== -1 && pos < absEnd) {
        const lineStart = pos + 1;
        if (lineStart >= absEnd) break;
        if (!insideQuasi(lineStart) && src.startsWith('    ', lineStart)) {
            out.push({ start: lineStart, end: lineStart + 4, text: '' });
        }
        pos = src.indexOf('\n', lineStart);
    }
    return out;
}

function sliceDedented(absStart, absEnd) {
    const local = edits.filter((e) => e.start >= absStart && e.end <= absEnd)
        .concat(dedentEdits(absStart, absEnd))
        .sort((a, b) => a.start - b.start || a.end - b.end);
    let out = '';
    let cursor = absStart;
    for (const e of local) {
        if (e.start < cursor) continue;
        out += src.slice(cursor, e.start) + e.text;
        cursor = e.end;
    }
    return out + src.slice(cursor, absEnd);
}

function declSource(d) {
    if (d.kind === 'fn') return 'export ' + sliceDedented(d.start, d.end);
    // variable declaration
    const raw = sliceDedented(d.node.start, d.node.end);
    const isState = d.kind === 'let';
    if (isState) return null; // state moves into stores
    return 'export ' + raw.replace(/^\s*/, '');
}

const emitted = new Map();     // modName -> string[]
const ownerOf = new Map();     // exported name -> modName
for (const d of topDecls) {
    if (d.kind === 'let') continue;
    ownerOf.set(d.name, d.module);
}

const usedNodes = new Set();
for (const [modName, info] of modules) {
    const out = [];
    for (const d of info.decls) {
        if (d.kind === 'let') continue;
        const key = d.node.start + ':' + d.node.end;
        if (usedNodes.has(key)) continue;
        usedNodes.add(key);
        const text = declSource(d);
        if (text) out.push(text);
    }
    emitted.set(modName, out);
}

/* ── ៨. គណនា import ក្នុងមួយ module ──────────────────────────────────── */
function rangeOwnerModule(pos) {
    let best = null;
    for (const d of topDecls) if (pos >= d.start && pos < d.end) { if (!best || d.start > best.start) best = d; }
    return best ? best.module : null;
}
const moduleImports = new Map(); // modName -> Map<fromModule, Set<name>>
const moduleDomHelpers = new Map();
for (const key of domHelperUsers) {
    const [posStr, helper] = key.split(':');
    const host = rangeOwnerModule(Number(posStr));
    const target = host || 'boot/bootstrap-statements';
    if (!moduleDomHelpers.has(target)) moduleDomHelpers.set(target, new Set());
    moduleDomHelpers.get(target).add(helper);
}
const moduleStores = new Map();  // modName -> Set<storeName>
for (const r of refs) {
    const host = rangeOwnerModule(r.start);
    if (!host) continue;
    const store = stateOwner.get(r.name);
    if (store && isShadowed(r.name, r.start)) continue;
    if (store) {
        if (!moduleStores.has(host)) moduleStores.set(host, new Set());
        moduleStores.get(host).add(store);
        continue;
    }
    const from = ownerOf.get(r.name);
    if (!from || from === host) continue;
    if (!moduleImports.has(host)) moduleImports.set(host, new Map());
    const m = moduleImports.get(host);
    if (!m.has(from)) m.set(from, new Set());
    m.get(from).add(r.name);
}

/* ── ៩. សរសេរឯកសារ ──────────────────────────────────────────────────── */
function relImport(fromMod, toMod) {
    const a = path.posix.dirname(fromMod);
    let rel = path.posix.relative(a, toMod);
    if (!rel.startsWith('.')) rel = './' + rel;
    return rel;
}

const report = { modules: [], shadowedState, totals: {} };
for (const [modName, lines] of emitted) {
    const file = path.join(OUT_ROOT, modName + '.ts');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const header = [];
    const domHelpers = moduleDomHelpers.get(modName);
    if (domHelpers && domHelpers.size) {
        header.push(`import { ${[...domHelpers].sort().join(', ')} } from '${relImport(modName, 'core/dom')}';`);
    }
    const stores = moduleStores.get(modName);
    if (stores && stores.size) {
        header.push(`import { ${[...stores].sort().join(', ')} } from '${relImport(modName, 'core/state')}';`);
    }
    const imps = moduleImports.get(modName);
    if (imps) {
        for (const [from, names] of [...imps].sort((a, b) => a[0].localeCompare(b[0]))) {
            header.push(`import { ${[...names].sort().join(', ')} } from '${relImport(modName, from)}';`);
        }
    }
    const body = lines.join('\n\n');
    fs.writeFileSync(file, (header.length ? header.join('\n') + '\n\n' : '') + body + '\n');
    report.modules.push({ module: modName, decls: lines.length, imports: header.length });
}

/* ── ៩ក. ចុះបញ្ជីសកម្មភាព ─────────────────────────────────────────────
 * `app.js` ដើមហៅសកម្មភាពតាម `window[name]` ព្រោះ function ទាំងអស់ជា
 * global។ ក្នុង module គ្មាន global ➜ យើងចេញ **ចុះបញ្ជីច្បាស់លាស់**
 * ដែលដេរីវេពី `ACTION_ALLOWLIST` ពិត។ ⛔ ព្រំដែនមិនប្រែ ៖ ឈ្មោះដែល
 * មិនស្ថិតក្នុងបញ្ជី នៅតែហៅមិនបាន — តែឥឡូវវា **ពិនិត្យបានពេល build**។ */
{
    const allowDecl = ast.body.find((n) => n.type === 'VariableDeclaration' && n.declarations.some((d) => d.id.name === 'ACTION_ALLOWLIST'));
    const names = [];
    if (allowDecl) {
        const d = allowDecl.declarations.find((x) => x.id.name === 'ACTION_ALLOWLIST');
        for (const el of d.init.elements || []) if (el && el.type === 'Literal') names.push(el.value);
    }
    const unresolved = names.filter((n) => !ownerOf.has(n));
    const modName = 'core/action-registry';
    const byMod = new Map();
    for (const n of names) {
        if (!ownerOf.has(n)) continue;
        const from = ownerOf.get(n);
        if (!byMod.has(from)) byMod.set(from, new Set());
        byMod.get(from).add(n);
    }
    const header = [];
    for (const [from, set] of [...byMod].sort((a, b) => a[0].localeCompare(b[0]))) {
        header.push(`import { ${[...set].sort().join(', ')} } from '${relImport(modName, from)}';`);
    }
    const body = [
        '',
        '/** រាល់សកម្មភាពដែល `data-act` / `data-close` អាចហៅបាន។',
        ' *  ⚠️ កើតដោយស្វ័យប្រវត្តិពី `ACTION_ALLOWLIST` — កុំកែដោយដៃ។ */',
        'export const ACTION_REGISTRY: Record<string, (...args: any[]) => any> = Object.freeze({',
        ...names.filter((n) => ownerOf.has(n)).sort().map((n) => `    ${n},`),
        '});',
        '',
        'export const ACTION_NAMES: readonly string[] = Object.freeze(Object.keys(ACTION_REGISTRY));',
        '',
        'export function lookupAction(name: string): ((...args: any[]) => any) | null {',
        '    if (!name || !Object.prototype.hasOwnProperty.call(ACTION_REGISTRY, name)) return null;',
        '    const fn = ACTION_REGISTRY[name];',
        '    return typeof fn === \'function\' ? fn : null;',
        '}'
    ].join('\n');
    const file = path.join(OUT_ROOT, modName + '.ts');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, header.join('\n') + '\n' + body + '\n');
    report.actionRegistry = { total: names.length, resolved: names.length - unresolved.length, unresolved };
}

/* ── ៩ខ. statement កម្រិតកំពូល (bootstrap) ─────────────────────────── */
const bootStatements = ast.body.filter((n) => n.type !== 'FunctionDeclaration' && n.type !== 'VariableDeclaration');
{
    const modName = 'boot/bootstrap-statements';
    const used = new Set();
    const stores = new Set();
    const chunks = [];
    for (const st of bootStatements) {
        chunks.push(sliceDedented(st.start, st.end));
        walk.full(st, (node) => {
            if (node.type !== 'Identifier') return;
            if (skip.has(node.start + ':' + node.end)) return;
            const store = stateOwner.get(node.name);
            if (store) { if (!isShadowed(node.name, node.start)) stores.add(store); return; }
            const from = ownerOf.get(node.name);
            if (from) used.add(node.name);
        });
    }
    const byMod = new Map();
    for (const name of used) {
        const from = ownerOf.get(name);
        if (!byMod.has(from)) byMod.set(from, new Set());
        byMod.get(from).add(name);
    }
    const header = [];
    const bootDom = moduleDomHelpers.get(modName);
    if (bootDom && bootDom.size) header.push(`import { ${[...bootDom].sort().join(', ')} } from '${relImport(modName, 'core/dom')}';`);
    if (stores.size) header.push(`import { ${[...stores].sort().join(', ')} } from '${relImport(modName, 'core/state')}';`);
    for (const [from, names] of [...byMod].sort((a, b) => a[0].localeCompare(b[0]))) {
        header.push(`import { ${[...names].sort().join(', ')} } from '${relImport(modName, from)}';`);
    }
    const file = path.join(OUT_ROOT, modName + '.ts');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, (header.length ? header.join('\n') + '\n\n' : '') + 'export function runLegacyBootstrapStatements() {\n' +
        chunks.map((c) => c.split('\n').map((l) => (l ? '    ' + l : l)).join('\n')).join('\n\n') + '\n}\n');
    report.bootstrapStatements = bootStatements.length;
}

/* ── ១០. state stores ───────────────────────────────────────────────── */
const letDecls = topDecls.filter((d) => d.kind === 'let');
const storeFields = {};
for (const [store] of Object.entries(STATE_GROUPS)) storeFields[store] = [];
for (const d of letDecls) {
    const store = stateOwner.get(d.name);
    const init = d.decl && d.decl.init ? applyEdits(src, d.decl.init.start, d.decl.init.end) : 'undefined';
    storeFields[store].push({ name: d.name, init, line: d.line });
}
fs.writeFileSync(path.join(OUT_ROOT, '_generated-state.json'), JSON.stringify(storeFields, null, 2));

report.totals = {
    topLevelDecls: topDecls.length,
    functions: topDecls.filter((d) => d.kind === 'fn').length,
    consts: topDecls.filter((d) => d.kind === 'const').length,
    lets: letDecls.length,
    modules: emitted.size,
    stateRefsRewritten: edits.length,
    shadowedRefsSkipped: shadowSkipped
};
fs.writeFileSync(require('path').join(PROJECT, 'tools', '_codemod-report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report.totals, null, 2));
console.log('shadowed state names (MUST be empty):', shadowedState);
