// ⛔ ថ្នាក់កំហុស ៖ ធាតុតែមួយមាន **អ្នកស្តាប់ ២** លើព្រឹត្តិការណ៍ដដែល ➜
// ការចុចមួយរត់ **២ ផ្លូវ**។
//
// ZoeW ចង handler តាម `data-act` (ច្រកទ្វារ CSP តែមួយ)។ ⛔ ការបន្ថែម
// `el.onclick = fn` ឬ `el.addEventListener('click', …)` ខាង JS លើធាតុដែល
// **មាន `data-act` រួចហើយ** មិនជំនួសការចងដើមទេ — វា **បន្ថែម** ➜ សកម្មភាព
// រត់ពីរដង។ ⛔ ហើយវា **មិនលេចក្នុង HTML** ➜ `wiring.js` និង
// `csp-enforced-test.js` មើលមិនឃើញ (ពួកវាអានតែ attribute)។
//
// 🔴 វាកើតឡើងពិត ២ ដង ៖
//   ១. ZoeW `#navAuthBtn` (កត់ក្នុង `CLAUDE.md`) ➜ កែដោយច្រកទ្វារតែមួយ
//      `drawerAuthFlow()` ដែលសម្រេចតាមទង់ `authButtonIsLoggedIn`។
//   ២. **ZoeKeyGen `#navAuthBtn`** ➜ ការកែខាងលើ **មិនបានឆ្លងមក App ទី ២**។
//      HTML ចង `data-act="showLoginModalWithPrefill"` ខណៈ `updateAuthButton()`
//      សរសេរ `btn.onclick = logoutApp` ➜ ពេលចូលរួច ការចុច «🚪 ចាកចេញ»
//      កេះ **ទាំង** ការចាកចេញ **ទាំង** ប្រអប់ចូល ក្នុងការចុចតែមួយ។
//      `page-nav-test` រាប់ការហៅពិត តែវាគ្រប **តែ ZoeW**។
//
// ⛔ ការវាស់ត្រូវ **ដេរីវេពី `index.html` ពិត** មិនមែនបញ្ជីរឹង — បញ្ជីរឹង
// ជាកាលបរិច្ឆេទផុតកំណត់ ៖ ប៊ូតុងដែលកើតជុំក្រោយនឹងរអិលកាត់។
// ⛔ ហើយត្រូវមាន **ទិសផ្ទុយ** ៖ ធាតុដែល **គ្មាន** `data-act` ត្រូវចងតាម JS
// បានសេរី — បើអត់ អ្នកយាមនេះនឹងក្លាយជា «ហាម addEventListener គ្រប់ទីកន្លែង»។
const fs = require('fs');
const path = require('path');
const acorn = require('acorn');

process.exitCode = 1;

const ROOT = process.env.ACTIONBIND_APP_DIR
    ? path.resolve(process.env.ACTIONBIND_APP_DIR)
    : path.resolve(__dirname, '..');
const APPS = ['ZoeW', 'ZoeKeyGen'];

let pass = 0;
let fail = 0;
function ok(label, cond, detail) {
    if (cond) { pass++; console.log('  ✅ ' + label); return; }
    fail++;
    console.log('  ❌ ' + label + (detail ? ' — ' + detail : ''));
}

function walk(node, fn) {
    if (!node || typeof node.type !== 'string') return;
    fn(node);
    for (const key in node) {
        if (key === 'type' || key === 'start' || key === 'end' || key === 'loc') continue;
        const val = node[key];
        if (Array.isArray(val)) val.forEach((c) => c && typeof c.type === 'string' && walk(c, fn));
        else if (val && typeof val.type === 'string') walk(val, fn);
    }
}

// ធាតុដែលចងតាម `data-act` ៖ id ➜ ព្រឹត្តិការណ៍ដែលវាកាន់
function actionElements(html) {
    const map = new Map();
    const names = new Map();
    const tagRe = /<[^>]*\bdata-act\s*=\s*"[^"]*"[^>]*>/g;
    let m;
    while ((m = tagRe.exec(html))) {
        const tag = m[0];
        const id = /\bid\s*=\s*"([^"]+)"/.exec(tag);
        if (!id) continue;
        const on = /\bdata-on\s*=\s*"([^"]+)"/.exec(tag);
        const act = /\bdata-act\s*=\s*"([^"]+)"/.exec(tag);
        map.set(id[1], (on ? on[1] : 'click').trim().toLowerCase());
        names.set(id[1], act ? act[1].trim() : '');
    }
    return { map: map, names: names };
}

// App React ៖ តារាង selector ដែល `elementOf()` (ទិដ្ឋភាព `refs.ts`) ប្រកាស — គ្មាន function នេះ (App ដើម) ➜ `null`
function elementOfSelectors(ast) {
    let table = null;
    walk(ast, (n) => {
        if (table || n.type !== 'FunctionDeclaration' || !n.id || n.id.name !== 'elementOf') return;
        walk(n.body, (o) => {
            if (table || o.type !== 'ObjectExpression') return;
            const map = new Map();
            for (const p of o.properties) {
                if (p.type !== 'Property' || p.computed || p.value.type !== 'Literal') return;
                const key = p.key.type === 'Identifier' ? p.key.name : p.key.value;
                map.set(String(key), p.value.value);
            }
            table = map;
        });
        if (!table) table = new Map();
    });
    return table;
}
function refIdOf(selectors, name) {
    if (!selectors.has(name)) return name;
    const sel = selectors.get(name);
    return (typeof sel === 'string' && /^#[\w-]+$/.test(sel)) ? sel.slice(1) : null;
}

// App React ៖ អ្នកស្តាប់ native ដែល JSX ចងតាម `refWithNative('<ref>', '<evt>', handler)` (`components.js`)
// ➜ វាជា `addEventListener` លើធាតុរបស់ React ដដែល ៖ បើធាតុនោះមាន `onX={onAct('a')}` ហើយ handler
// native ក៏ហៅ `act('a')` ➜ សកម្មភាពរត់ ២ ដង។ `components.js` ជា module ច្រើនភ្ជាប់គ្នា ➜ parse ម្តងមួយ។
// ⛔ ទិសផ្ទុយ ៖ ធាតុ JSX ដែលមាន `id` ហើយចង handler **មិនមែន** `onAct()` (`onInput={…}` · `onDrop={…}`) ជាការចង
// JS សេរី ➜ វាចូលសំណាកទិសផ្ទុយ (`jsxBound`) ដូច `addEventListener` លើធាតុគ្មាន `data-act` ក្នុង App ដើម។
function componentNativeBindings(text, selectors) {
    const out = [];
    const jsxBound = new Set();
    const parts = text.split(/^\/\/ === (.+)$/m);
    for (let i = 1; i < parts.length; i += 2) {
        const file = parts[i].trim();
        const ast = acorn.parse(parts[i + 1], { ecmaVersion: 2022, sourceType: 'module', locations: true });
        walk(ast, (n) => {
            if (n.type !== 'CallExpression' || n.callee.type !== 'Identifier' || n.callee.name !== 'refWithNative') return;
            const [nameArg, evtArg, handler] = n.arguments;
            if (!nameArg || nameArg.type !== 'Literal' || !evtArg || evtArg.type !== 'Literal') return;
            const id = refIdOf(selectors || new Map(), String(nameArg.value));
            let fn = null;
            if (handler) walk(handler, (c) => {
                if (fn || c.type !== 'CallExpression' || c.callee.type !== 'Identifier' || !/^(?:onAct|act)$/.test(c.callee.name)) return;
                const a = c.arguments[0];
                if (a && a.type === 'Literal' && typeof a.value === 'string') fn = a.value;
            });
            if (id) out.push({ id: id, evt: String(evtArg.value).toLowerCase(), fn: fn, where: file + ':' + n.loc.start.line });
        });
        walk(ast, (n) => {
            if (n.type !== 'CallExpression' || n.callee.type !== 'Identifier' || !/^jsxs?$/.test(n.callee.name)) return;
            const props = n.arguments[1];
            if (!props || props.type !== 'ObjectExpression') return;
            const key = (p) => p.type === 'Property' && !p.computed ? (p.key.type === 'Identifier' ? p.key.name : String(p.key.value)) : null;
            const idProp = props.properties.find((p) => key(p) === 'id');
            if (!idProp || idProp.value.type !== 'Literal' || typeof idProp.value.value !== 'string') return;
            const free = props.properties.some((p) => /^on[A-Z]/.test(key(p) || '') &&
                !(p.value.type === 'CallExpression' && p.value.callee.type === 'Identifier' && p.value.callee.name === 'onAct'));
            if (free) jsxBound.add(idProp.value.value);
        });
    }
    return { native: out, jsxBound: jsxBound };
}

// ធាតុដែលចងតាម JS ៖ id ➜ ការចង
// ⛔ ការតាមដានអថេរត្រូវគោរព **scope** ៖ ឈ្មោះ `btn` រស់នៅក្នុង function
// ដប់ៗ ➜ map សកលធ្វើឲ្យ `createElement('button')` ក្នុង function មួយ
// ត្រូវសន្មតជាធាតុ `getElementById()` របស់ function ផ្សេង (false positive
// ពិតដែលចាប់បានពេលសាងឧបករណ៍នេះ)។
function jsBindings(src) {
    const ast = acorn.parse(src, { ecmaVersion: 2022, locations: true });
    const propAssign = new Map();   // id ➜ Map(event ➜ line)   (el.onX = fn)
    const sameName = new Map();     // id ➜ Map(event ➜ {line, fn})  (addEventListener ជាមួយឈ្មោះ)
    const foreignIds = new Set();   // id ដែលចងតាម JS (សម្រាប់ទិសផ្ទុយ)

    function note(map, id, evt, info) {
        if (!map.has(id)) map.set(id, new Map());
        if (!map.get(id).has(evt)) map.get(id).set(evt, info);
    }
    // App React ៖ ធាតុរបស់ React រកតាម `elementOf('<ឈ្មោះ ref>')` (ទិដ្ឋភាព `refs.ts`) — ឈ្មោះ ref ជា id
    // លើកលែងតែ selector ដែល `elementOf` ខ្លួនវាប្រកាស (`#id` ➜ id នោះ · class/`null` ➜ គ្មាន id)
    const refSelectors = elementOfSelectors(ast);
    function idFromCall(node) {
        if (!node || node.type !== 'CallExpression') return null;
        const c = node.callee;
        const a = node.arguments[0];
        const lit = (a && a.type === 'Literal' && typeof a.value === 'string') ? a.value : null;
        if (c.type === 'Identifier' && c.name === 'elementOf' && refSelectors) return lit === null ? null : refIdOf(refSelectors, lit);
        if (c.type !== 'MemberExpression' || c.property.name !== 'getElementById') return null;
        return lit;
    }
    function isFn(n) {
        return n && (n.type === 'FunctionDeclaration' || n.type === 'FunctionExpression'
            || n.type === 'ArrowFunctionExpression');
    }

    function visit(node, scopes) {
        if (!node || typeof node.type !== 'string') return;
        let chain = scopes;
        if (isFn(node)) chain = scopes.concat([new Map()]);

        if (node.type === 'VariableDeclarator' && node.id.type === 'Identifier') {
            const id = idFromCall(node.init);
            const top = chain[chain.length - 1];
            // អថេរដែល **មិនមែន** មកពី getElementById ត្រូវបិទបាំងឈ្មោះដដែលពីខាងលើ
            top.set(node.id.name, id || null);
        }
        const lookup = (name) => {
            for (let i = chain.length - 1; i >= 0; i--) {
                if (chain[i].has(name)) return chain[i].get(name);
            }
            return null;
        };
        const idOf = (obj) => {
            if (!obj) return null;
            if (obj.type === 'Identifier') return lookup(obj.name);
            return idFromCall(obj);
        };

        if (node.type === 'AssignmentExpression' && node.left.type === 'MemberExpression') {
            const prop = node.left.property && node.left.property.name;
            if (typeof prop === 'string' && /^on[a-z]+$/.test(prop)) {
                const id = idOf(node.left.object);
                if (id) { note(propAssign, id, prop.slice(2), node.loc.start.line); foreignIds.add(id); }
            }
        }
        // `scope.listen(target, evt, h)` (`createLifecycleScope()` របស់ App React) = `target.addEventListener(evt, h)`
        const isListen = node.type === 'CallExpression' && node.callee.type === 'MemberExpression'
            && node.callee.property.name === 'listen' && node.arguments.length >= 3;
        if (node.type === 'CallExpression' && node.callee.type === 'MemberExpression'
            && (node.callee.property.name === 'addEventListener' || isListen)) {
            const a = node.arguments[isListen ? 1 : 0];
            const h = node.arguments[isListen ? 2 : 1];
            const id = idOf(isListen ? node.arguments[0] : node.callee.object);
            if (id && a && a.type === 'Literal' && typeof a.value === 'string') {
                foreignIds.add(id);
                note(sameName, id, String(a.value).toLowerCase(),
                    { line: node.loc.start.line, fn: (h && h.type === 'Identifier') ? h.name : null });
            }
        }

        for (const key in node) {
            if (key === 'type' || key === 'start' || key === 'end' || key === 'loc') continue;
            const val = node[key];
            if (Array.isArray(val)) val.forEach((c) => c && typeof c.type === 'string' && visit(c, chain));
            else if (val && typeof val.type === 'string') visit(val, chain);
        }
    }
    visit(ast, [new Map()]);
    return { propAssign, sameName, foreignIds, refSelectors };
}

console.log('── 1. ធាតុ `data-act` មិនត្រូវមានអ្នកស្តាប់ទី ២ លើព្រឹត្តិការណ៍ដដែល');

let scannedElements = 0;
let scannedApps = 0;
let reverseSeen = 0;

APPS.forEach((app) => {
    const htmlPath = path.join(ROOT, app, 'index.html');
    const jsPath = path.join(ROOT, app, 'app.js');
    if (!fs.existsSync(htmlPath) || !fs.existsSync(jsPath)) return;
    scannedApps++;

    const parsedHtml = actionElements(fs.readFileSync(htmlPath, 'utf8'));
    const acts = parsedHtml.map;
    const actNames = parsedHtml.names;
    let parsed;
    try {
        parsed = jsBindings(fs.readFileSync(jsPath, 'utf8'));
    } catch (e) {
        ok(app + ' ៖ `app.js` ត្រូវ parse បាន', false, e.message);
        return;
    }
    scannedElements += acts.size;
    const compPath = path.join(ROOT, app, 'components.js');
    if (fs.existsSync(compPath)) {
        let native;
        try {
            native = componentNativeBindings(fs.readFileSync(compPath, 'utf8'), parsed.refSelectors);
        } catch (e) {
            ok(app + ' ៖ `components.js` ត្រូវ parse បាន', false, e.message);
            return;
        }
        ok(app + ' ៖ ⛔ រកឃើញ `refWithNative()` ក្នុង JSX (ការស្កេនមិនទទេ)', native.native.length > 0, 'ឃើញ ' + native.native.length);
        native.jsxBound.forEach((id) => parsed.foreignIds.add(id));
        native.native.forEach((b) => {
            parsed.foreignIds.add(b.id);
            if (!parsed.sameName.has(b.id)) parsed.sameName.set(b.id, new Map());
            if (!parsed.sameName.get(b.id).has(b.evt)) parsed.sameName.get(b.id).set(b.evt, { line: b.where, fn: b.fn });
        });
    }

    // ច្បាប់ ក ៖ `el.onX = fn` លើធាតុដែលមាន `data-act` រួច — អ្នកសរសេរ
    // ជឿថាខ្លួន *កំណត់* handler ខណៈការពិតវា **បន្ថែម** ផ្លូវទី ២។
    const clash = [];
    acts.forEach((evt, id) => {
        const b = parsed.propAssign.get(id);
        if (b && b.has(evt)) clash.push(id + ' ៖ `on' + evt + ' =` បន្ទាត់ ' + b.get(evt));
    });
    ok(app + ' ៖ គ្មានធាតុ `data-act` ណាទទួល `on*=` ខាង JS (ស្កេន ' + acts.size + ')',
        clash.length === 0, clash.join(' | '));

    // ច្បាប់ ខ ៖ `addEventListener(evt, X)` ដែល X ជា **សកម្មភាពដដែល**
    // នឹង `data-act` ➜ ការរត់ស្ទួនតាមព្យញ្ជនៈ។ ⛔ handler ដែល **ខុសគ្នា**
    // (ឧ. ការណែនាំលេខទូរស័ព្ទលើ `input` ដដែល) ជាចេតនា ➜ មិនរាយ។
    const dupAct = [];
    acts.forEach((evt, id) => {
        const b = parsed.sameName.get(id);
        if (!b || !b.has(evt)) return;
        const info = b.get(evt);
        if (info.fn && info.fn === actNames.get(id)) dupAct.push(id + ' ៖ ' + info.fn + '() បន្ទាត់ ' + info.line);
    });
    ok(app + ' ៖ គ្មាន listener ណាហៅសកម្មភាព `data-act` ដដែលម្តងទៀត',
        dupAct.length === 0, dupAct.join(' | '));

    // ទិសផ្ទុយ ៖ ធាតុគ្មាន `data-act` ត្រូវចងតាម JS បានសេរី
    parsed.foreignIds.forEach((id) => { if (!acts.has(id)) reverseSeen++; });
});

console.log('');
console.log('── 2. ជាន់អប្បបរមា (ការអះអាង «គ្មាន» ត្រូវបញ្ជាក់ថាវាបានស្កេនពិត)');
ok('⛔ ស្កេន App ទាំង ២', scannedApps === 2, 'ស្កេនបាន ' + scannedApps);
ok('⛔ ធាតុ `data-act` ដែលមាន id យ៉ាងតិច ២០', scannedElements >= 20, 'ឃើញ ' + scannedElements);
ok('⛔ ទិសផ្ទុយ ៖ ធាតុគ្មាន `data-act` ដែលចងតាម JS យ៉ាងតិច ៣ (មិនត្រូវរាយជាកំហុស)',
    reverseSeen >= 3, 'ឃើញ ' + reverseSeen);

console.log('');
if (fail) { console.log('❌ ធ្លាក់ ' + fail + ' / ok ' + pass); process.exitCode = 1; }
else if (!pass) { console.log('❌ គ្មានការអះអាងណារត់សោះ'); process.exitCode = 1; }
else { console.log('✅ ជោគជ័យ ' + pass); process.exitCode = 0; }
