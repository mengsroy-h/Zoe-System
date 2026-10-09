// ថ្នាក់កំហុស៖ **ការបង្ខំ layout ឡើងវិញ (forced synchronous layout) ក្នុងផ្លូវក្តៅ**។
//
// Browser ដាក់ការសរសេរ style ចូលជួររង់ចាំ រួចទូទាត់វាម្តងមុនគូរ។ ប៉ុន្តែ
// ការ **អានតម្លៃធរណីមាត្រ** (`offsetHeight`, `getBoundingClientRect()`,
// `getComputedStyle()` …) បង្ខំឲ្យវាទូទាត់ភ្លាម។ ដូច្នេះលំនាំ
// **សរសេរ ➜ អាន** ក្នុងផ្លូវដំណើរការដដែល = layout ឡើងវិញ **ស្របគ្នា** ចំពេល
// ម្រាមដៃកំពុងអូស ឬបញ្ជីកំពុងរមូរ ➜ ស៊ុមធ្លាក់ និងការអូសទាក់។
//
// ផ្លូវក្តៅ = callback របស់ `touchstart|touchmove|touchend|scroll|wheel|
// pointer*|mousemove` និង `requestAnimationFrame`។ `touchmove` ដែល
// **non-passive** ជាផ្លូវក្តៅបំផុត — browser ត្រូវរង់ចាំវារួចទើបរមូរបាន
// ដូច្នេះ `getComputedStyle()` ក្នុងវាត្រូវរាប់ជាបញ្ហា ទោះគ្មានការសរសេរមុនក៏ដោយ។
//
// ដើម្បីកុំឲ្យមានការរាយក្លែងក្លាយ ឧបករណ៍នេះ៖
//   • ដើរតាម function ដែល handler **ហៅពិត** (ជម្រៅ ៣) ព្រោះការអានពិតៗ
//     ស្ថិតក្នុង helper មិនមែនក្នុងខ្លួន handler ទេ;
//   • **មិន** ចូលក្នុង callback ដែលពន្យារពេល (`setTimeout`, `rAF`, `.then`) —
//     ការសរសេរនៅទីនោះកើតក្រោយការគូររួច ដូច្នេះវាមិនបង្ខំអ្វីទេ;
//   • **មិន** ផ្គូផ្គងការសរសេរនិងការអានដែលនៅ **មែកផ្សេងគ្នា** នៃ `if`/`switch`
//     ដដែល ព្រោះវាមិនអាចរត់ជាមួយគ្នាបានឡើយ;
//   • អានតែធរណីមាត្រ **របស់ធាតុ** (មិនរាប់ `window.innerWidth/innerHeight`
//     ដែលជារង្វាស់ viewport)។
const fs = require('fs');
const path = require('path');
let acorn;
try { acorn = require('acorn'); } catch (e) {

    console.log('SKIP — ត្រូវការ acorn (npm i acorn)');
    process.exit(0);
}

// ⛔ ថ្ងៃដែល seed ត្រូវគណនាតាម **ប្រតិទិនកម្ពុជា** ដូច App (កំណែ 2.20.5)។
// មុននេះវាប្រើប្រតិទិន **ឧបករណ៍** ➜ ក្នុងបង្អួច ៧ ម៉ោងរៀងរាល់យប់
// (00:00–07:00 ម៉ោងកម្ពុជា = 17:00–23:59 UTC) runner ដែលកំណត់ជា UTC
// នៅថ្ងៃមុន ខណៈ App នៅថ្ងៃបន្ទាប់ ➜ ជួរដេកដែល seed មិនត្រូវនឹងតម្រង
// «ថ្ងៃនេះ» ➜ គ្មានជួរដេកបង្ហាញ ➜ waitForFunction timeout។
const APP_ZONE = 'Asia/Phnom_Penh';
function zoneDateKey(ms, dayOffset) {
    const p = new Intl.DateTimeFormat('en-CA', {
        timeZone: APP_ZONE, year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(ms).split('-');
    const base = Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    const s = new Date(base + (dayOffset || 0) * 86400000);
    return s.getUTCFullYear() + '-'
        + String(s.getUTCMonth() + 1).padStart(2, '0') + '-'
        + String(s.getUTCDate()).padStart(2, '0');
}

const ROOT = process.env.THRASH_APP_DIR || path.join(__dirname, '..');
const APPS = ['ZoeW', 'ZoeKeyGen'];
const MAX_DEPTH = 3;

const HOT_EVENTS = new Set(['touchstart', 'touchmove', 'touchend', 'touchcancel',
    'scroll', 'wheel', 'pointermove', 'pointerdown', 'pointerup', 'mousemove']);

const LAYOUT_READ_PROPS = new Set(['offsetHeight', 'offsetWidth', 'offsetTop', 'offsetLeft',
    'offsetParent', 'clientHeight', 'clientWidth', 'clientTop', 'clientLeft',
    'scrollHeight', 'scrollWidth']);
const LAYOUT_READ_CALLS = new Set(['getBoundingClientRect', 'getClientRects', 'getComputedStyle']);

const STYLE_WRITE_PROPS = new Set(['innerHTML', 'textContent', 'innerText', 'className', 'scrollTop', 'scrollLeft']);
const DEFERRED = new Set(['setTimeout', 'setInterval', 'requestAnimationFrame', 'queueMicrotask',
    'requestIdleCallback', 'then', 'catch', 'finally', 'addEventListener']);

// ធាតុដែលបានតាមដានពិត ហើយទទួលយក — រាល់ធាតុត្រូវមានហេតុផលសរសេរជាប់។
// ទាំង ២ ខាងក្រោមត្រូវបាន **ចាក់សោដោយការវាស់ពិត** ក្នុងដំណាក់កាលទី ២ ខាងក្រោម
// ដូច្នេះការថយក្រោយនឹងធ្លាក់នៅទីនោះ ទោះការវិភាគស្តាទិចទទួលយកក៏ដោយ។
const ACCEPTED = {
    // `scrollerForPull()` ចងចាំលទ្ធផលក្នុងមួយកាយវិការ ➜ `scrollerOf()` ពិតជា
    // រត់តែម្តងក្នុងមួយកាយវិការ មិនមែនរាល់ចលនាម្រាមដៃទេ។ ការវាស់៖ ≤2 ក្នុង ១០០ ចលនា។
    'ZoeW:pullContextStillValid ➜ scrollerForPull ➜ scrollerOf:getComputedStyle()':
        'memo ក្នុងមួយកាយវិការ — វាស់ក្នុងដំណាក់កាលទី ២',
    // កម្ពស់ប្រអប់អាស្រ័យលើទទឹងរបស់វា ដូច្នេះការអានក្រោយសរសេរទទឹងជាកាតព្វកិច្ច
    // មិនអាចដកចេញបានទេ។ អ្វីដែលដោះស្រាយបានគឺ **ចំនួនដង** ដែលវាកើត៖ handler
    // របស់ scroll ត្រូវ coalesce តាម rAF ➜ ១ ដងក្នុងមួយស៊ុម មិនមែន ១ ដងក្នុង
    // មួយព្រឹត្តិការណ៍រមូរទេ។ ចាក់សោដោយថវិកា SUGGEST_CALL_BUDGET ខាងក្រោម។
    'ZoeW:positionPhoneSuggestBox:offsetHeight':
        'rAF coalesce ➜ ១ ដងក្នុងមួយស៊ុម — វាស់ក្នុងដំណាក់កាលទី ២',
    // FLIP៖ ត្រូវអានទីតាំង **ក្រោយ** ប្តូរ class ដើម្បីដឹងចម្ងាយត្រូវធ្វើចលនា។
    // ការអានមួយនេះកើត **១ ដងពេលលែងដៃ** មិនមែនរាល់ស៊ុមទេ ហើយ class ដែលប្តូរ
    // បង្ខំ layout នៅស៊ុមបន្ទាប់យ៉ាងណាក៏ដោយ ➜ ការអានស្របគ្នាមិនបន្ថែមថ្លៃទេ។
    // ចលនាខ្លួនវាជា `transform` សុទ្ធ (Web Animations) ➜ ដើរលើ compositor។
    'ZoeW:finishMainSwipe ➜ applyPanelAction ➜ panelGlideFrom:getBoundingClientRect()':
        'FLIP — អានម្តងពេល touchend មិនមែនរាល់ស៊ុម',
    'ZoeW:finishScrollerSwipe ➜ applyPanelAction ➜ panelGlideFrom:getBoundingClientRect()':
        'FLIP — អានម្តងពេល touchend មិនមែនរាល់ស៊ុម'
};

let problems = 0;
let checked = 0;

function walk(node, visit, parent) {
    if (!node || typeof node.type !== 'string') return;
    visit(node, parent);
    for (const key of Object.keys(node)) {
        if (key === 'type' || key === 'start' || key === 'end' || key === 'loc') continue;
        const child = node[key];
        if (Array.isArray(child)) child.forEach((c) => walk(c, visit, node));
        else if (child && typeof child.type === 'string') walk(child, visit, node);
    }
}

function isFn(n) {
    return n && (n.type === 'FunctionDeclaration' || n.type === 'FunctionExpression' || n.type === 'ArrowFunctionExpression');
}

function collectNamedFunctions(ast) {
    const map = new Map();
    walk(ast, (n) => {
        if (n.type === 'FunctionDeclaration' && n.id) map.set(n.id.name, n);
        else if (n.type === 'VariableDeclarator' && n.id && n.id.type === 'Identifier' && isFn(n.init)) map.set(n.id.name, n.init);
    });
    return map;
}

function collectHotHandlers(ast, named) {
    const out = [];
    walk(ast, (n) => {
        if (n.type !== 'CallExpression' || !n.callee || n.callee.type !== 'MemberExpression') return;
        const prop = n.callee.property;
        if (!prop || prop.name !== 'addEventListener') return;
        const evt = n.arguments[0];
        if (!evt || evt.type !== 'Literal' || !HOT_EVENTS.has(evt.value)) return;
        const handler = n.arguments[1];
        const opts = n.arguments[2];
        let nonPassive = true;
        if (opts && opts.type === 'ObjectExpression') {
            const p = opts.properties.find((x) => x.key && (x.key.name === 'passive' || x.key.value === 'passive'));
            nonPassive = !(p && p.value && p.value.value === true);
        }
        if (isFn(handler)) out.push({ fn: handler, label: evt.value + ' handler', event: evt.value, nonPassive });
        else if (handler && handler.type === 'Identifier' && named.has(handler.name)) {
            out.push({ fn: named.get(handler.name), label: handler.name + '() [' + evt.value + ']', event: evt.value, nonPassive });
        }
    });
    walk(ast, (n) => {
        if (n.type !== 'CallExpression') return;
        const c = n.callee;
        const name = c && (c.name || (c.property && c.property.name));
        if (name !== 'requestAnimationFrame') return;
        const cb = n.arguments[0];
        if (isFn(cb)) out.push({ fn: cb, label: 'requestAnimationFrame callback', event: 'raf', nonPassive: false });
        else if (cb && cb.type === 'Identifier' && named.has(cb.name)) {
            out.push({ fn: named.get(cb.name), label: cb.name + '() [rAF]', event: 'raf', nonPassive: false });
        }
    });
    return out;
}

// សញ្ញាសម្គាល់មែក ៖ បញ្ជី "<idOfIf>#<consequent|alternate>" ពីក្រៅចូលក្នុង
function branchPathOf(node, stack) {
    const out = [];
    for (let i = 0; i < stack.length - 1; i++) {
        const parent = stack[i];
        const child = stack[i + 1];
        if (parent.type === 'IfStatement') {
            if (parent.consequent === child) out.push(parent.start + '#c');
            else if (parent.alternate === child) out.push(parent.start + '#a');
        } else if (parent.type === 'ConditionalExpression') {
            if (parent.consequent === child) out.push(parent.start + '#c');
            else if (parent.alternate === child) out.push(parent.start + '#a');
        } else if (parent.type === 'SwitchCase') {
            out.push(parent.start + '#s');
        }
    }
    return out;
}

// មែកផ្សេងគ្នានៃ `if` ដដែល ➜ មិនអាចរត់ជាមួយគ្នា
function exclusive(a, b) {
    const n = Math.min(a.length, b.length);
    for (let i = 0; i < n; i++) {
        if (a[i] === b[i]) continue;
        return a[i].split('#')[0] === b[i].split('#')[0];
    }
    return false;
}

// `return` នៅផ្លូវ R បញ្ចប់ការរត់សម្រាប់រាល់ការសរសេរ W ដែលនៅផ្លូវដដែល ឬ
// ជ្រៅជាង (R ជា prefix របស់ W) ➜ W មិនអាចទៅដល់កូដខាងក្រោមបានទេ
function killedBy(returnBranch, writeBranch) {
    if (returnBranch.length > writeBranch.length) return false;
    for (let i = 0; i < returnBranch.length; i++) if (returnBranch[i] !== writeBranch[i]) return false;
    return true;
}

// ព្រឹត្តិការណ៍ក្នុង function មួយ (មិនចូលក្នុង function ដែលដាក់ក្នុងវា)
function eventsIn(fn) {
    const evts = [];
    const stack = [];
    (function rec(node, parent) {
        if (!node || typeof node.type !== 'string') return;
        if (node !== fn && isFn(node)) return; // scope ដាច់ដោយឡែក — កុំចូល
        stack.push(node);
        const bp = () => branchPathOf(node, stack);

        if (node.type === 'ReturnStatement') evts.push({ kind: 'return', what: 'return', pos: node.start, branch: bp() });
        if (node.type === 'MemberExpression' && node.property && !node.computed &&
            LAYOUT_READ_PROPS.has(node.property.name) &&
            !(node.object && node.object.type === 'Identifier' && node.object.name === 'window')) {
            evts.push({ kind: 'read', what: node.property.name, pos: node.start, branch: bp() });
        }
        if (node.type === 'AssignmentExpression' && node.left && node.left.type === 'MemberExpression' && node.left.property && !node.left.computed) {
            const p = node.left.property.name;
            const onStyle = node.left.object && node.left.object.type === 'MemberExpression' &&
                node.left.object.property && node.left.object.property.name === 'style';
            if (onStyle) evts.push({ kind: 'write', what: 'style.' + p, pos: node.start, branch: bp() });
            else if (STYLE_WRITE_PROPS.has(p)) evts.push({ kind: 'write', what: p, pos: node.start, branch: bp() });
        }
        if (node.type === 'CallExpression') {
            const c = node.callee;
            const nm = c && (c.name || (c.property && c.property.name));
            if (nm) {
                if (LAYOUT_READ_CALLS.has(nm)) evts.push({ kind: 'read', what: nm + '()', pos: node.start, branch: bp() });
                else if (DEFERRED.has(nm)) {
                    // ពន្យារពេល — កុំរាប់ខ្លឹមសាររបស់វា តែនៅតែដើរលើ argument ដែលមិនមែន function
                    node.arguments.forEach((a) => { if (!isFn(a)) rec(a, node); });
                    stack.pop();
                    return;
                } else {
                    const onClassList = c.object && c.object.type === 'MemberExpression' && c.object.property && c.object.property.name === 'classList';
                    const onStyleObj = c.object && c.object.type === 'MemberExpression' && c.object.property && c.object.property.name === 'style';
                    if (onClassList && ['add', 'remove', 'toggle'].indexOf(nm) !== -1) evts.push({ kind: 'write', what: 'classList.' + nm + '()', pos: node.start, branch: bp() });
                    else if (onStyleObj && ['setProperty', 'removeProperty'].indexOf(nm) !== -1) evts.push({ kind: 'write', what: 'style.' + nm + '()', pos: node.start, branch: bp() });
                    else if (['scrollTo', 'scrollIntoView', 'appendChild', 'insertBefore', 'removeChild'].indexOf(nm) !== -1) evts.push({ kind: 'write', what: nm + '()', pos: node.start, branch: bp() });
                    else evts.push({ kind: 'call', what: nm, pos: node.start, branch: bp() });
                }
            }
        }
        for (const key of Object.keys(node)) {
            if (key === 'type' || key === 'start' || key === 'end' || key === 'loc') continue;
            const child = node[key];
            if (Array.isArray(child)) child.forEach((c) => rec(c, node));
            else if (child && typeof child.type === 'string') rec(child, node);
        }
        stack.pop();
    })(fn, null);
    return evts.sort((a, b) => a.pos - b.pos);
}

function flatten(fn, named, depth, seen, trail, prefix) {
    const out = [];
    for (const e of eventsIn(fn)) {
        const branch = prefix.concat(e.branch);
        if (e.kind !== 'call') { out.push({ ...e, branch, trail }); continue; }
        if (depth >= MAX_DEPTH) continue;
        const target = named.get(e.what);
        if (!target || seen.has(e.what)) continue;
        seen.add(e.what);
        out.push(...flatten(target, named, depth + 1, seen, trail.concat(e.what), branch));
        seen.delete(e.what);
    }
    return out;
}

for (const app of APPS) {
    const file = path.join(ROOT, app, 'app.js');
    if (!fs.existsSync(file)) continue;
    const src = fs.readFileSync(file, 'utf8');
    const ast = acorn.parse(src, { ecmaVersion: 2022, sourceType: 'script' });
    const named = collectNamedFunctions(ast);
    const seenReport = new Set();

    for (const h of collectHotHandlers(ast, named)) {
        checked++;
        const line = src.slice(0, h.fn.start).split('\n').length;
        const flat = flatten(h.fn, named, 0, new Set(), [], []);
        let writes = [];
        for (const e of flat) {
            if (e.kind === 'write') { writes.push(e); continue; }
            if (e.kind === 'return') { writes = writes.filter((w) => !killedBy(e.branch, w.branch)); continue; }
            if (e.kind !== 'read') continue;
            const site = (e.trail.length ? e.trail.join(' ➜ ') : h.label);
            const key = app + ':' + site + ':' + e.what;
            const w = writes.find((x) => !exclusive(x.branch, e.branch));
            if (w) {
                if (!ACCEPTED[key] && !seenReport.has(key + ':w')) {
                    seenReport.add(key + ':w');
                    console.log(`   ⚠️  ${app} បន្ទាត់ ${line} — ${h.label}: សរសេរ \`${w.what}\` រួចអាន \`${e.what}\` ក្នុង ${site} ➜ បង្ខំ layout ក្នុងផ្លូវក្តៅ`);
                    problems++;
                }
                writes.length = 0;
            } else if (h.event === 'touchmove' && h.nonPassive && e.what === 'getComputedStyle()') {
                if (!ACCEPTED[key] && !seenReport.has(key + ':g')) {
                    seenReport.add(key + ':g');
                    console.log(`   ⚠️  ${app} បន្ទាត់ ${line} — ${h.label} (non-passive): \`getComputedStyle()\` ក្នុង ${site} ➜ style recalc រាល់ចលនាម្រាមដៃ`);
                    problems++;
                }
            }
        }
    }
}

if (!problems) console.log(`   ✅ ស្តាទិច៖ ផ្លូវក្តៅ ${checked} មិនបង្ខំ layout ឡើងវិញទេ`);

// ============================================================================
// ដំណាក់កាលទី ២ — វាស់ក្នុង Chromium ពិត។ ការវិភាគស្តាទិចមិនអាចមើលឃើញ memo
// ឬការរំលងការសរសេរបានទេ ដូច្នេះធាតុក្នុង ACCEPTED ត្រូវចាក់សោដោយលេខពិត។
// ============================================================================
let chromium;
try { chromium = require('playwright-core').chromium; } catch (e) {
    console.log('   SKIP ដំណាក់កាលទី ២ — ត្រូវការ playwright-core');
    process.exit(problems ? 1 : 0);
}
const CHROME = process.env.THRASH_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
if (!fs.existsSync(CHROME)) {
    console.log('   SKIP ដំណាក់កាលទី ២ — រកមិនឃើញ Chromium');
    process.exit(problems ? 1 : 0);
}
const http = require('http');
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm' };
const LICENSE_STUB = `window.ZoeLicense = { getStatus: () => Promise.resolve({ state: 'active' }), setServerTimeOffset(){}, syncServerTime: () => Promise.resolve(), activate: () => Promise.resolve({ ok: true }), verifyKeyString: () => Promise.resolve({ ok: true }), clearActivation(){} };`;

function serve(dir) {
    return new Promise((res) => {
        const s = http.createServer((req, rsp) => {
            let p = decodeURIComponent(req.url.split('?')[0]);
            if (p === '/') p = '/index.html';
            const f = path.join(dir, p);
            if (!f.startsWith(dir) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rsp.writeHead(404); return rsp.end(); }
            rsp.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'text/plain' });
            rsp.end(fs.readFileSync(f));
        });
        s.listen(0, '127.0.0.1', () => res(s));
    });
}

const BOOT = function (seed) {
    const store = JSON.parse(JSON.stringify(seed));
    const listeners = [];
    function getPath(p) {
        if (!p || p === '/') return store;
        let cur = store;
        for (const part of p.split('/').filter(Boolean)) { if (cur === null || typeof cur !== 'object') return null; cur = cur[part]; }
        return cur === undefined ? null : cur;
    }
    function setPath(p, val) {
        const parts = p.split('/').filter(Boolean); if (!parts.length) return;
        let cur = store;
        for (let i = 0; i < parts.length - 1; i++) { if (cur[parts[i]] === null || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {}; cur = cur[parts[i]]; }
        const last = parts[parts.length - 1];
        if (val === null) delete cur[last]; else cur[last] = JSON.parse(JSON.stringify(val));
    }
    function snapOf(p) { const v = getPath(p); return { val: () => (v === undefined || v === null) ? null : (typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v), exists: () => v !== null && v !== undefined }; }
    function fire(p) { listeners.filter((l) => l.path === p).forEach((l) => { try { l.cb(snapOf(p)); } catch (e) {} }); }
    function fireAll() { [...new Set(listeners.map((l) => l.path))].forEach(fire); }
    const user = { uid: 'admin-uid', email: 'a@b.c', getIdToken: () => Promise.resolve('tok'), metadata: { lastSignInTime: new Date().toISOString() } };
    window.firebaseSDK = {
        initializeApp: () => ({ name: 'fake' }), getApps: () => [], deleteApp: () => Promise.resolve(),
        getAuth: () => ({ currentUser: user }),
        onAuthStateChanged: (a, cb) => { setTimeout(() => cb(user), 0); return () => {}; },
        signInWithEmailAndPassword: () => Promise.resolve({ user }), signOut: () => Promise.resolve(),
        setPersistence: () => Promise.resolve(), browserLocalPersistence: {}, browserSessionPersistence: {},
        getIdTokenResult: () => Promise.resolve({ authTime: new Date().toISOString(), claims: {} }),
        getDatabase: () => ({ fake: true }), ref: (d, p) => ({ path: p === undefined ? '' : String(p) }),
        onValue: (r, cb) => { listeners.push({ path: r.path, cb }); setTimeout(() => { if (r.path === '.info/connected') cb({ val: () => true }); else cb(snapOf(r.path)); }, 0); return () => {}; },
        off: () => {}, goOnline: () => {},
        get: (r) => Promise.resolve(snapOf(r.path)),
        set: (r, v) => { setPath(r.path, v); fireAll(); return Promise.resolve(); },
        update: (r, o) => { Object.keys(o).forEach((k) => setPath((r.path ? r.path + '/' : '') + k, o[k])); fireAll(); return Promise.resolve(); },
        runTransaction: (r, fn) => { const c = getPath(r.path); const n = fn(c === null ? null : JSON.parse(JSON.stringify(c))); if (n === undefined) return Promise.resolve({ committed: false, snapshot: snapOf(r.path) }); setPath(r.path, n); fireAll(); return Promise.resolve({ committed: true, snapshot: snapOf(r.path) }); }
    };
    window.dispatchEvent(new Event('firebasesdkready'));
};

function seedOrders(n) {
    const t = new Date();
    const d = zoneDateKey(Date.now(), 0);
    const now = Date.now();
    const hist = {};
    for (let i = 0; i < n; i++) {
        const id = 'id_' + (now - i * 1000) + '_' + i;
        const bc = { code: 'PF' + i, time: '10:00', cod: 5, dod: 0, locker: 'A1', isClosed: false, isDeducted: false, isFromDeletion: false, createdAt: now - i * 1000 };
        hist[id] = { id, phone: '09' + String(60000000 + i).slice(0, 8), scanDate: d, createdAt: now - i * 1000, cod: 5, dod: 0, price: 5, count: 1, barcode: bc.code, time: '10:00', isClosed: false, barcodes: [bc] };
    }
    return {
        user_roles: { 'admin-uid': 'admin' },
        zoew_scan_history_cod_dod: hist, zoew_recently_deleted_cod_dod: {},
        zoew_daily_revenue_cod_dod: { [d]: { codDollar: 5 * n, dodDollar: 0, totalCount: n } },
        zoew_monthly_revenue_cod_dod: {}, zoew_daily_pickup_cod_dod: {}, zoew_scanner_lookup: {},
        zoew_barcode_registry: {}, zoew_settings: { exchange_rate: 4100 }
    };
}

const MOVES = 100;
const SCROLLS = 60;
const SUGGEST_SHOW_CEILING_MS = 1500;
// ថវិកា៖ memo ត្រូវធ្វើឲ្យការដើរឡើងលើដើមឈើកើតតែម្តងក្នុងមួយកាយវិការ។
// មុនកែ ការវាស់ពិតគឺ getComputedStyle=82 និង layout read=820 ក្នុង ១០០ ចលនា។
const PTR_GCS_BUDGET = 8;
const PTR_READ_BUDGET = 60;
// មុនកែ `positionPhoneSuggestBox` រត់ ១ ដងក្នុងមួយព្រឹត្តិការណ៍រមូរ (៦០)។
// វាស់ដោយរាប់ `getBoundingClientRect()` លើប្រអប់បញ្ចូល — លេខនោះឆ្លុះបញ្ចាំង
// ចំនួនដងដែល handler រត់ពិត ទោះវាចងតាមសេចក្តីយោងផ្ទាល់ក៏ដោយ។
const SUGGEST_CALL_BUDGET = 4;

(async () => {
    const browser = await chromium.launch({ executablePath: CHROME });
    const server = await serve(path.join(ROOT, 'ZoeW'));
    const port = server.address().port;
    const ctx = await browser.newContext({ viewport: { width: 412, height: 780 }, hasTouch: true, isMobile: true });
    const page = await ctx.newPage();
    page.on('dialog', (d) => d.accept());
    await page.route('**', (r) => {
        const u = r.request().url();
        if (u.indexOf('/license-verify.js') !== -1) return r.fulfill({ status: 200, contentType: 'application/javascript', body: LICENSE_STUB });
        if (u.startsWith('http://127.0.0.1:' + port)) return r.continue();
        return r.abort();
    });
    await page.addInitScript(`Object.defineProperty(window.navigator, 'standalone', { value: true, configurable: true });`);
    await page.addInitScript(`window.localStorage.setItem('zoew_firebase_config', ${JSON.stringify(JSON.stringify({ apiKey: 'k', databaseURL: 'https://fake-default-rtdb.firebaseio.com', projectId: 'p' }))});`);
    await page.addInitScript('(' + BOOT.toString() + ')(' + JSON.stringify(seedOrders(400)) + ');');
    await page.goto('http://127.0.0.1:' + port + '/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction(() => document.querySelectorAll('#historyTableBody tr').length > 5, null, { timeout: 30000 });

    const ptr = await page.evaluate((moves) => {
        const table = document.getElementById('tableResponsive');
        const target = table ? (table.querySelector('td') || table) : document.getElementById('dataMainSection');
        if (!target) return { err: 'no target' };
        if (!document.querySelector('.ptr-indicator')) return { err: 'PTR មិនបានដំឡើង' };
        let gcs = 0; const gcsOrig = window.getComputedStyle;
        window.getComputedStyle = function () { gcs++; return gcsOrig.apply(window, arguments); };
        let reads = 0; const patched = [];
        ['scrollHeight', 'clientHeight'].forEach((p) => {
            const proto = Object.getOwnPropertyDescriptor(HTMLElement.prototype, p) ? HTMLElement.prototype : Element.prototype;
            const d = Object.getOwnPropertyDescriptor(proto, p);
            if (!d || !d.get) return;
            patched.push([proto, p, d]);
            Object.defineProperty(proto, p, { configurable: true, get() { reads++; return d.get.call(this); } });
        });
        const mk = (type, y) => {
            const t = new Touch({ identifier: 11, target: target, clientX: 100, clientY: y, pageX: 100, pageY: y });
            const list = type === 'touchend' ? [] : [t];
            return new TouchEvent(type, { touches: list, changedTouches: [t], targetTouches: list, bubbles: true, cancelable: true });
        };
        target.dispatchEvent(mk('touchstart', 200));
        for (let i = 1; i <= moves; i++) target.dispatchEvent(mk('touchmove', 200 + i));
        const engaged = !!document.querySelector('.ptr-indicator').style.transform;
        target.dispatchEvent(mk('touchend', 200 + moves));
        window.getComputedStyle = gcsOrig;
        patched.forEach(([proto, p, d]) => Object.defineProperty(proto, p, d));
        return { gcs, reads, engaged };
    }, MOVES);

    const suggest = await page.evaluate(async ({ scrolls, suggestCeilingMs }) => {
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        const input = document.getElementById('searchPhoneInput');
        const box = document.getElementById('phoneSuggestBox');
        if (!input || !box) return { err: 'missing' };
        input.focus();
        input.value = '09';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        // ប្រអប់ស្នើលេខធ្លាក់ចុះតែក្រោយចលនាប្រអប់ស្វែងរកចប់ (រង់ចាំស៊ុមហូរ + glide) —
        // រង់ចាំរហូតវាបង្ហាញ ក្នុងពិដាន `SUGGEST_SHOW_CEILING_MS`; ពិដានផុត = បរាជ័យពិត។
        const deadline = Date.now() + suggestCeilingMs;
        while (!box.classList.contains('show') && Date.now() < deadline) await wait(20);
        if (!box.classList.contains('show')) return { err: 'ប្រអប់ស្នើលេខមិនបង្ហាញក្នុង ' + suggestCeilingMs + 'ms' };
        // រាប់ការវាស់ពិតលើប្រអប់បញ្ចូល មិនមែនរាប់ការហៅតាម `window.` ទេ —
        // listener កាន់សេចក្តីយោងផ្ទាល់ ដូច្នេះការជំនួស `window.` មិនចាប់វាបានទេ។
        let calls = 0;
        const rectOrig = Element.prototype.getBoundingClientRect;
        Element.prototype.getBoundingClientRect = function () {
            if (this === input) calls++;
            return rectOrig.call(this);
        };
        const scroller = document.getElementById('tableResponsive');
        for (let i = 0; i < scrolls; i++) { scroller.scrollTop = i * 5; scroller.dispatchEvent(new Event('scroll', { bubbles: true })); }
        await wait(160);
        Element.prototype.getBoundingClientRect = rectOrig;
        return { calls, placed: !!box.style.top, stillShown: box.classList.contains('show') };
    }, { scrolls: SCROLLS, suggestCeilingMs: SUGGEST_SHOW_CEILING_MS });

    await ctx.close(); server.close(); await browser.close();

    function check(cond, name, detail) {
        if (cond) console.log('   ok    ' + name);
        else { console.log('   FAIL  ' + name + (detail ? '\n         ' + detail : '')); problems++; }
    }
    if (ptr.err) check(false, 'PTR៖ រៀបចំការវាស់', ptr.err);
    else {
        check(ptr.gcs <= PTR_GCS_BUDGET, `PTR touchmove ×${MOVES}៖ getComputedStyle ≤ ${PTR_GCS_BUDGET}`, 'gcs=' + ptr.gcs);
        check(ptr.reads <= PTR_READ_BUDGET, `PTR touchmove ×${MOVES}៖ ការអាន layout ≤ ${PTR_READ_BUDGET}`, 'reads=' + ptr.reads);
        check(ptr.engaged, 'PTR នៅតែចាប់កាយវិការពិត (មិនត្រូវបានបិទដោយការ optimize)');
    }
    if (suggest.err) check(false, 'ប្រអប់ស្នើលេខ៖ រៀបចំការវាស់', suggest.err);
    else {
        check(suggest.calls <= SUGGEST_CALL_BUDGET, `រមូរ ×${SCROLLS}៖ ការវាស់ទីតាំងប្រអប់ស្នើលេខ ≤ ${SUGGEST_CALL_BUDGET} ដង`, 'calls=' + suggest.calls);
        check(suggest.placed && suggest.stillShown, 'ប្រអប់ស្នើលេខនៅតែត្រូវដាក់ទីតាំង និងបង្ហាញក្រោយរមូរ', JSON.stringify(suggest));
    }
    process.exit(problems ? 1 : 0);
})();
