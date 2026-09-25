/**
 * ⛔ **ធាតុដែល React ជាម្ចាស់ មិនត្រូវប៉ះកូនរបស់វាពីកូដ imperative**
 *
 * `el.textContent = ''` លើ container ដែល React គូរកូន ➜ node របស់ React
 * ត្រូវដកចេញពីក្រោមវា ➜ ការគូរបន្ទាប់ហៅ `removeChild` លើ node ដែលលែងនៅ
 * ➜ `NotFoundError` ➜ **React បោះបង់ root ទាំងមូល ➜ App ក្លាយជាអេក្រង់ស**។
 * វាស់បាន (`parity-deep`) ៖ វាយក្នុងប្រអប់ស្វែងរក ➜ ការណែនាំលេច ➜ សម្អាត
 * ➜ `hidePhoneSuggestions()` ធ្វើ `box.textContent = ''` ➜ App ស។
 *
 * ឧបករណ៍នេះស្កេន AST នៃឯកសារ `.ts` ទាំងអស់ក្នុង `src/` (កូដមុខងារ **និង** `src/app/` — behavior ·
 * lifecycle · slot-resets ដែលអនុញ្ញាតឲ្យកាន់ធាតុតាម ref) រក ៖
 *   ក. `X.textContent|innerHTML|innerText|outerHTML = …`
 *   ខ. `X.appendChild|removeChild|replaceChildren|insertBefore|append|prepend|remove(…)`
 *   គ. `X.value = …` លើ **element slot** (select ដែល React គ្រប់គ្រងតម្លៃ)
 * ដែល `X` ចងនឹង `elementOf('<id ដែល React ជាម្ចាស់>')` (ឬ `getElementById`) — ដោយ
 * ផ្ទាល់ ឬតាមរង្វិលជុំលើបញ្ជី id (`['a', 'b'].forEach((id) => { const el = elementOf(id); … })`)។
 *
 * ⛔ ក្នុង React ១០០% កូដមុខងារមិនកាន់ធាតុសោះ (`purity:check`) ➜ ហានិភ័យដែលនៅសល់
 *    រស់ក្នុង `src/app/**` ៖ ឧ. `phoneSuggestBox` ជាទាំង slot (React គូរកូន) និង ref
 *    (behavior វាស់ទីតាំង) ➜ `elementOf('phoneSuggestBox').textContent = ''` = App ស។
 *
 * ⛔ បញ្ជី id **ដេរីវេពី `SLOTS` / `ELEMENT_SLOTS`** ក្នុង `scripts/slot-registry.cjs` ដែលខ្លួនវា
 *    ត្រូវផ្ទៀងផ្ទាត់ទល់នឹងកូដពិត (`REACT_OWNED_IDS` · component ដែល export) ខាងក្រោម
 *    — slot ថ្មីចូលការវាស់ដោយស្វ័យប្រវត្តិ។
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import * as acorn from 'acorn';
import * as walk from 'acorn-walk';
import esbuild from 'esbuild';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = process.env.SLOTCHECK_SRC || path.join(ROOT, 'src');

const REGISTRY = createRequire(import.meta.url)(path.join(ROOT, 'scripts/slot-registry.cjs'));
const SLOT_IDS = new Set(Object.keys(REGISTRY.SLOTS));
const ELEMENT_IDS = new Set(Object.keys(REGISTRY.ELEMENT_SLOTS));
if (SLOT_IDS.size < 10 || ELEMENT_IDS.size < 2) {
    console.error(`⛔ អានបញ្ជី slot មិនបាន (${SLOT_IDS.size}/${ELEMENT_IDS.size}) — ឧបករណ៍មិនអាចវាស់អ្វីបានទេ`);
    process.exit(2);
}

// ⛔ បញ្ជីត្រូវស៊ីនឹងកូដពិត (បើមិនដូច្នេះ វាក្លាយជាបញ្ជីរឹង = កាលបរិច្ឆេទផុតកំណត់) ៖
//    ១. id ទាំងអស់ ↔ `REACT_OWNED_IDS` (`src/app/slot-resets.ts` ៖ ការសម្អាតតាម store) — ទាំង ២ ទិស
//    ២. `component` នីមួយៗ export ពិតពី `src/app/components/<from>.tsx`
const registryDrift = [];
{
    const resets = fs.readFileSync(path.join(SRC, 'app', 'slot-resets.ts'), 'utf8');
    const owned = JSON.parse((resets.match(/REACT_OWNED_IDS[^=]*=\s*(\[[^\]]*\])/) || [])[1] || 'null');
    if (!Array.isArray(owned)) registryDrift.push('អាន REACT_OWNED_IDS ពី src/app/slot-resets.ts មិនបាន');
    else {
        const all = new Set([...SLOT_IDS, ...ELEMENT_IDS]);
        owned.filter((id) => !all.has(id)).forEach((id) => registryDrift.push(`REACT_OWNED_IDS មាន #${id} តែ slot-registry គ្មាន`));
        [...all].filter((id) => owned.indexOf(id) === -1).forEach((id) => registryDrift.push(`slot-registry មាន #${id} តែ REACT_OWNED_IDS គ្មាន (គ្មានការសម្អាតតាម store)`));
    }
    for (const [id, e] of Object.entries(Object.assign({}, REGISTRY.SLOTS, REGISTRY.ELEMENT_SLOTS))) {
        const file = path.join(SRC, 'app', 'components', e.from + '.tsx');
        const text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
        if (!new RegExp(`export (?:function|const) ${e.component}\\b`).test(text)) registryDrift.push(`#${id} ➜ ${e.component} មិន export ពី components/${e.from}.tsx`);
    }
}

const CHILD_PROPS = new Set(['textContent', 'innerHTML', 'innerText', 'outerHTML']);
const CHILD_CALLS = new Set(['appendChild', 'removeChild', 'replaceChildren', 'insertBefore', 'append', 'prepend']);

function files(dir, out = []) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) files(full, out);
        else if (e.name.endsWith('.ts') && !e.name.endsWith('.d.ts')) out.push(full);
    }
    return out;
}

const findings = [];
let scanned = 0;
let bindings = 0;
let guardedLoops = 0;

for (const file of files(SRC)) {
    const ts = fs.readFileSync(file, 'utf8');
    const { code } = esbuild.transformSync(ts, { loader: 'ts', format: 'esm', target: 'es2022', sourcemap: false });
    let ast;
    try { ast = acorn.parse(code, { ecmaVersion: 'latest', sourceType: 'module', locations: true }); }
    catch (e) { findings.push(`${path.relative(ROOT, file)} ៖ parse បរាជ័យ (${e.message}) — វាស់មិនបាន`); continue; }
    scanned++;
    const rel = path.relative(ROOT, file);
    const src = code.split('\n');

    // ១. អថេរដែលចងនឹង byId('<id>') ឬ getElementById('<id>')
    const bound = new Map();   // name -> id
    const idOfCall = (n) => {
        if (!n || n.type !== 'CallExpression') return null;
        const c = n.callee;
        const name = c.type === 'Identifier' ? c.name : (c.type === 'MemberExpression' && c.property.name);
        if (name !== 'byId' && name !== 'getElementById' && name !== 'elementOf') return null;
        const a = n.arguments[0];
        return a && a.type === 'Literal' && typeof a.value === 'string' ? a.value : (a && a.type === 'Identifier' ? '$' + a.name : null);
    };
    walk.full(ast, (n) => {
        if (n.type === 'VariableDeclarator' && n.id.type === 'Identifier') {
            const id = idOfCall(n.init);
            if (id) { bound.set(n.id.name, id); bindings++; }
        }
    });

    // ២. រង្វិលជុំលើបញ្ជី id ៖ ['a','b'].forEach((id) => …) ➜ id ដែលអាចចូល
    const loopIds = new Map();   // param name -> [ids]
    walk.full(ast, (n) => {
        if (n.type !== 'CallExpression' || n.callee.type !== 'MemberExpression' || n.callee.property.name !== 'forEach') return;
        let arr = n.callee.object;
        if (arr.type === 'Identifier') {
            // const list = [...]; list.forEach(...)
            walk.full(ast, (d) => { if (d.type === 'VariableDeclarator' && d.id.name === arr.name && d.init && d.init.type === 'ArrayExpression') arr = d.init; });
        }
        if (arr.type !== 'ArrayExpression') return;
        const lits = arr.elements.filter((e) => e && e.type === 'Literal' && typeof e.value === 'string').map((e) => e.value);
        const fn = n.arguments[0];
        if (!fn || !fn.params || !fn.params[0] || fn.params[0].type !== 'Identifier') return;
        const param = fn.params[0].name;
        // ⛔ ច្រកទ្វារតែមួយដែលទទួលស្គាល់ ៖ `if (resetReactOwned(<param>)) return;`
        //    ជា **statement ដំបូង** ➜ id របស់ React ចេញតាម store មុនការប៉ះ DOM។
        //    ⛔ ទម្រង់ផ្សេង (ឧ. លក្ខខណ្ឌនៅកណ្តាល) មិនទទួលស្គាល់ ➜ អ្នកយាមធ្លាក់។
        const first = fn.body && fn.body.type === 'BlockStatement' ? fn.body.body[0] : null;
        const guarded = first && first.type === 'IfStatement' && first.consequent.type === 'ReturnStatement'
            && first.test.type === 'CallExpression' && first.test.callee.type === 'Identifier'
            && first.test.callee.name === 'resetReactOwned'
            && first.test.arguments[0] && first.test.arguments[0].type === 'Identifier' && first.test.arguments[0].name === param;
        if (guarded) { guardedLoops++; return; }
        loopIds.set(param, lits);
    });

    const resolve = (name) => {
        const id = bound.get(name);
        if (!id) return [];
        if (id.startsWith('$')) return loopIds.get(id.slice(1)) || [];
        return [id];
    };
    const report = (node, id, what) => {
        const line = node.loc.start.line;
        findings.push(`${rel}:${line} ៖ ${what} លើ #${id} (React ជាម្ចាស់)\n      ${String(src[line - 1] || '').trim().slice(0, 140)}`);
    };

    walk.full(ast, (n) => {
        if (n.type === 'AssignmentExpression' && n.left.type === 'MemberExpression' && n.left.object.type === 'Identifier') {
            const prop = n.left.property.name;
            for (const id of resolve(n.left.object.name)) {
                if (CHILD_PROPS.has(prop) && (SLOT_IDS.has(id) || ELEMENT_IDS.has(id))) report(n, id, '`' + prop + ' =`');
                else if (prop === 'value' && ELEMENT_IDS.has(id)) report(n, id, '`value =` (select ដែល React គ្រប់គ្រង)');
            }
        }
        if (n.type === 'CallExpression' && n.callee.type === 'MemberExpression' && n.callee.object.type === 'Identifier') {
            const m = n.callee.property.name;
            if (!CHILD_CALLS.has(m)) return;
            for (const id of resolve(n.callee.object.name)) {
                if (SLOT_IDS.has(id) || ELEMENT_IDS.has(id)) report(n, id, '`.' + m + '()`');
            }
        }
    });
}

console.log('╔══════════════════════════════════════════════════════════════════════╗');
console.log('║  ម្ចាស់ធាតុ ៖ កូដ imperative មិនត្រូវប៉ះកូនរបស់ slot React          ║');
console.log('╚══════════════════════════════════════════════════════════════════════╝\n');
console.log(`slot ${SLOT_IDS.size} · element slot ${ELEMENT_IDS.size} · ឯកសារ ${scanned} · អថេរចងធាតុ (elementOf/getElementById) ${bindings} · រង្វិលជុំដែលមានច្រកទ្វារ ${guardedLoops}`);
// ⛔ ជាន់អប្បបរមា ៖ ការស្កេនដែលមិនឃើញការចងធាតុសោះ = មិនបានវាស់អ្វី (behavior ចងធាតុតាម ref ច្រើន)
if (scanned < 50 || bindings < 10) {
    console.error(`⛔ ការស្កេនតូចពេក (ឯកសារ ${scanned} · ការចង ${bindings}) — វាស់មិនបាន`);
    process.exit(2);
}
if (registryDrift.length) {
    console.log('');
    registryDrift.forEach((f) => console.log('❌ ' + f));
    console.log(`\n❌ slot-registry ឃ្លាតពីកូដពិត ${registryDrift.length} កន្លែង`);
    process.exit(1);
}
console.log(`បញ្ជី slot ស៊ីនឹង REACT_OWNED_IDS និង component ដែល export (${SLOT_IDS.size + ELEMENT_IDS.size})`);
if (findings.length) {
    console.log('');
    findings.forEach((f) => console.log('❌ ' + f));
    console.log(`\n❌ ${findings.length} កន្លែងប៉ះធាតុដែល React ជាម្ចាស់ ➜ App អាចក្លាយជាអេក្រង់ស`);
    process.exit(1);
}
console.log('\n✅ គ្មានកូដ imperative ណាប៉ះកូនរបស់ slot React');
