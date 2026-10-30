// ថ្នាក់កំហុស៖ localStorage/sessionStorage ដែលហៅដោយគ្មាន try/catch។
// នៅលើ Safari Private Mode, ទំហំផ្ទុកពេញ, ឬ browser ដែលបិទ site data
// `setItem` បោះ QuotaExceededError/SecurityError ➜ បំបែកមុខងារដែលហៅវា
// (ឧ. ការស្កេនកញ្ចប់មិនត្រូវបានរក្សាទុក ព្រោះ throw មុនផ្លូវ Save)។
//
// ⛔ **ការអាន (`getItem`) ក៏បោះដែរ — ហើយវាធ្ងន់ជាង** (បន្ថែមក្នុង 2.22.5)។
// ពេល browser **បិទ site data ទាំងស្រុង** (Chrome «Block all cookies» ·
// Firefox strict · policy សហគ្រាស · iOS ITP ក្នុងបរិបទខ្លះ) នោះការប៉ះ
// `window.localStorage` **ខ្លួនវា** បោះ `SecurityError` — មិនមែនត្រឹម
// ការសរសេរទេ។ ហើយ ZoeW អានវា **នៅកម្រិត top-level** ៖
//
//     let exchangeRateRiel = parseFloat(localStorage.getItem(...)) || 4100;
//
// កូដកម្រិត top-level ដែលបោះ **បញ្ឈប់ការវាយតម្លៃឯកសារទាំងមូល** ➜ អ្វីៗ
// ខាងក្រោមវាមិនរត់សោះ ៖ `initAppLock()` · `window.addEventListener('load')`
// ដែលហៅ `initFirebase()` · `revealAppAfterBoot()`។ **វាស់បានក្នុង Chromium
// ពិត** ៖ ផ្ទាំង boot **ជាប់រហូត** ហើយ App មិនដំណើរការសោះ ខណៈ
// **function ទាំងអស់នៅមាន** (hoisting) ➜ ការវិនិច្ឆ័យតាម `typeof fn`
// បង្ហាញថា «ធម្មតា» ដែលជាសញ្ញាបំភាន់។
//
// ច្បាប់៖ រាល់ setItem/removeItem/clear **និង getItem/key/length**
//        ត្រូវស្ថិតក្នុង try ឬឆ្លងកាត់ safeStoreSet()/safeStoreRemove()/
//        safeStoreGet()។
let acorn;
try {
    acorn = require('acorn');
} catch (e) {
    console.error('ត្រូវការ acorn — រត់ `npm i acorn` ជាមុនសិន');
    process.exit(2);
}
const fs = require('fs');
const path = require('path');

const ROOT = process.env.STORAGE_APP_DIR || path.join(__dirname, '..');
// ⚠️ App `ZoeImport` ត្រូវលុបចេញពី repo ក្នុងកំណែ 2.21.0 — មុខងារនាំចូល
// របស់វាផ្លាស់ចូល **ZoeW ផ្ទាល់**។ ដូច្នេះ **ពាក្យសម្ងាត់នាំចូល**
// (`sheetImportPassword`) និង **កូនសោ AES** (`sheetImportKey`) ព្រមទាំងវាល
// `siApiPasswordInput` ក្នុង DOM ឥឡូវរស់នៅក្នុង `ZoeW/app.js` ➜ ការស្កេន
// ZoeW គ្របពួកវារួចហើយ។ ⛔ កុំបន្ថយវិសាលភាពនៃឯកសារដែលស្កេន — នោះជាថ្នាក់
// «checker ស្កេនឯកសារណាខ្លះ» ដដែលនឹង 2.12.1 · 2.16.0 · 2.19.1។
const APPS = ['ZoeW', 'ZoeKeyGen'];
// ⛔ **មេរៀន «checker ស្កេនឯកសារណា»** (2.12.1 · 2.16.0 · 2.19.1 · 2.22.5)។
// ជំនាន់មុនស្កេនតែ `app.js` ➜ `boot-flags.js` (script **ដំបូងគេក្នុង
// `<head>` មុន stylesheet**) · `license-verify.js` · `error-reporting.js`
// **មិនដែលត្រូវពិនិត្យសោះ**។ ការបោះក្នុង `boot-flags.js` ធ្ងន់ជាង
// `app.js` ទៅទៀត ៖ វាដាក់ `html.ios-standalone` (PTR និង layout iOS)
// និងប្តូរ `webFontCss` ទៅ `media="all"` (ពុម្ពអក្សរខ្មែរ)។
const SHIPPED = ['app.js', 'boot-flags.js', 'license-verify.js', 'error-reporting.js', 'sw.js'];
// ⛔ **ការជំនួសឈ្មោះធ្វើឲ្យ checker ងងឹតភ្នែក** (មេរៀន 2.22.5)។
// កំណែ 2.22.5 ចាក់ shim `appLocalStore` / `appSessionStore` ដែលអាន
// `window.localStorage` **ក្នុង try តែម្តង** (ព្រោះ getter ខ្លួនវាបោះ)។
// ការជំនួសនោះធ្វើឲ្យ checker ដែលស្កេនតែឈ្មោះ `localStorage` បៃតងភ្លាម
// **ខណៈការហៅផ្ទាល់នៅដដែល** — ហើយវាកាន់តែអាក្រក់ ព្រោះ shim អាចជា
// `null` ➜ ការហៅផ្ទាល់បោះ `TypeError` ជំនួស `SecurityError`។
// ដូច្នេះបញ្ជីនេះត្រូវរួម **ឈ្មោះទាំង ៤**។
const STORES = new Set(['localStorage', 'sessionStorage', 'appLocalStore', 'appSessionStore']);
const REAL_STORES = new Set(['localStorage', 'sessionStorage']);
const WRITES = new Set(['setItem', 'removeItem', 'clear']);
const READS = new Set(['getItem', 'key']);
const GUARDED_OPS = new Set([...WRITES, ...READS]);
const HELPERS = new Set(['safeStoreSet', 'safeStoreRemove', 'safeStoreGet']);

// ⛔ **មេរៀន «checker ស្កេនទម្រង់វេយ្យាករណ៍ណា»** (2.19.3 · 2.22.5)។
// វាស់បាន ៖ ការសរសេរ `window.localStorage.getItem(...)` ជា
// **MemberExpression ដាក់ជាន់គ្នា** មិនមែន Identifier ➜ checker ដែលរក
// តែ Identifier **មើលមិនឃើញសោះ** ➜ បៃតងក្លែងក្លាយ ខណៈកូដ top-level
// នៅតែបោះ។ ការវាស់នោះធ្វើក្នុងជុំ 2.22.5 ដោយចាក់កំហុសពិតចូល រួច
// រត់ checker ៖ ស្តាទិច ➜ 🔴 មិនឃើញ; ឥរិយាបថ ➜ ✅ ចាប់បាន។
// ដូច្នេះ helper នេះត្រូវដោះស្រាយ **គ្រប់ផ្លូវទៅដល់ store**៖
//   localStorage.x()          · window.localStorage.x()
//   globalThis.localStorage.x() · self.localStorage.x()
//   window['localStorage'].x()  (computed ជាមួយ literal)
const GLOBALS = new Set(['window', 'globalThis', 'self', 'top', 'parent']);

// ត្រឡប់ឈ្មោះ store បើ `node` ជាកន្សោមដែលវាយតម្លៃទៅ localStorage/sessionStorage
function storeNameOf(node, STORES) {
    if (!node) return null;
    if (node.type === 'Identifier' && STORES.has(node.name)) return node.name;
    if (node.type === 'MemberExpression') {
        const base = node.object;
        if (!(base.type === 'Identifier' && GLOBALS.has(base.name))) return null;
        if (!node.computed && node.property.type === 'Identifier' && STORES.has(node.property.name)) return node.property.name;
        if (node.computed && node.property.type === 'Literal' && STORES.has(node.property.value)) return node.property.value;
    }
    return null;
}

function walk(node, cb, parent) {
    if (!node || typeof node.type !== 'string') return;
    cb(node, parent);
    for (const key of Object.keys(node)) {
        if (key === 'loc' || key === 'range') continue;
        const value = node[key];
        if (Array.isArray(value)) value.forEach((child) => walk(child, cb, node));
        else if (value && typeof value.type === 'string') walk(value, cb, node);
    }
}

// តែ helper synchronous ដែលគ្រប់ការយោងជាការហៅផ្ទាល់ក្នុង try របស់ caller ប៉ុណ្ណោះ។
// callback/alias/async មិនអាចខ្ចី try ពីខាងក្រៅបានទេ។
function guardedSynchronousHelpers(ast) {
    const functions = [], tries = [], references = new Map();
    walk(ast, (node, parent) => {
        if (/Function/.test(node.type)) functions.push(node);
        if (node.type === 'TryStatement' && node.handler) tries.push(node.block);
        if (node.type === 'Identifier') {
            if (!references.has(node.name)) references.set(node.name, []);
            references.get(node.name).push({ node, parent });
        }
    });
    const owner = (node) => functions.filter(fn => fn.start <= node.start && fn.end >= node.end)
        .sort((a, b) => a.end - a.start - (b.end - b.start))[0];
    const protectedCall = (node) => tries.some(block => block.start <= node.start && block.end >= node.end && owner(block) === owner(node));
    return functions.filter(fn => {
        if (fn.type !== 'FunctionDeclaration' || !fn.id || fn.async || fn.generator) return false;
        const uses = (references.get(fn.id.name) || []).filter(ref => ref.node !== fn.id);
        return uses.length > 0 && uses.every(({ node, parent }) => parent?.type === 'CallExpression' && parent.callee === node && protectedCall(parent));
    });
}

// ប្រើតែ store ដែលស្គាល់ និង property literal; array/string `.length` មិនមែន storage ទេ។
function storageMemberAccess(node) {
    if (node.type !== 'MemberExpression') return false;
    const property = node.computed
        ? (node.property.type === 'Literal' ? node.property.value : null)
        : (node.property.type === 'Identifier' ? node.property.name : null);
    return !!storeNameOf(node, REAL_STORES)
        || (property === 'length' && !!storeNameOf(node.object, STORES));
}

function storageProtection(ast) {
    const tries = [], functions = [];
    walk(ast, (node) => {
        if (node.type === 'TryStatement' && node.handler) tries.push(node.block);
        if (/Function/.test(node.type)) functions.push(node);
    });
    const owner = (node) => functions.filter(fn => fn.start <= node.start && fn.end >= node.end)
        .sort((a, b) => a.end - a.start - (b.end - b.start))[0];
    const helpers = guardedSynchronousHelpers(ast);
    // try ខាងក្រៅ callback មិនចាប់ការបោះពេល callback រត់ក្រោយមកទេ។
    return {
        guarded: (node) => tries.some(block => block.start <= node.start && block.end >= node.end && owner(block) === owner(node))
            || helpers.some(fn => owner(node) === fn),
        topLevel: (node) => !owner(node)
    };
}

const helperProbes = [
    ['function read() { return appLocalStore.key(0); } function caller() { try { read(); } catch(e) {} }', 1],
    ['function read() { return appLocalStore.key(0); } function caller() { read(); }', 0],
    ['function read() { return appLocalStore.key(0); } function caller() { try { setTimeout(() => read()); } catch(e) {} }', 0],
    ['async function read() { return appLocalStore.key(0); } function caller() { try { read(); } catch(e) {} }', 0],
    ['function read() { return appLocalStore.key(0); } const alias = read; function caller() { try { read(); } catch(e) {} }', 0]
];
for (const [code, expected] of helperProbes) {
    const result = guardedSynchronousHelpers(acorn.parse(code, { ecmaVersion: 2022 }));
    if (result.length !== expected) { console.log('FAIL — ការផ្ទៀងព្រំដែន try/caller ខូច៖ ' + code); process.exit(1); }
}

const memberProbes = [
    ['const count = appLocalStore.length;', 1],
    ["const count = appSessionStore['length'];", 1],
    ['const count = localStorage.length + sessionStorage.length;', 2],
    ["const count = window['localStorage']['length'];", 2],
    ['const count = globalThis.sessionStorage.length;', 2],
    ['try { const count = appLocalStore.length; } catch(e) {}', 0],
    ["try { const count = window['localStorage']['length']; } catch(e) {}", 0],
    ['function read() { return appLocalStore.length; } function caller() { try { read(); } catch(e) {} }', 0],
    ['function read() { return appLocalStore.length; } function caller() { try { setTimeout(() => read()); } catch(e) {} }', 1],
    ['try { setTimeout(() => appLocalStore.length); } catch(e) {}', 1],
    ['try { setTimeout(() => { try { return appLocalStore.length; } catch(e) {} }); } catch(e) {}', 0],
    ['try { const count = appLocalStore.length; } finally {}', 1],
    ['const count = values.length + "text".length + ordinary.length + stores.appLocalStore.length;', 0]
];
for (const [code, expected] of memberProbes) {
    const ast = acorn.parse(code, { ecmaVersion: 2022 });
    const protection = storageProtection(ast);
    let hits = 0;
    walk(ast, node => { if (storageMemberAccess(node) && !protection.guarded(node)) hits++; });
    if (hits !== expected) { console.log('FAIL — ការផ្ទៀង storage property ខូច៖ ' + code); process.exit(1); }
}

let unguarded = 0;
let guarded = 0;
let helperCalls = 0;
const topLevelHits = [];

let filesScanned = 0;
let parseFailures = 0;
for (const app of APPS) {
  for (const rel of SHIPPED) {
    const file = path.join(ROOT, app, rel);
    if (!fs.existsSync(file)) continue;
    const src = fs.readFileSync(file, 'utf8');
    let ast;
    try { ast = acorn.parse(src, { ecmaVersion: 2022, sourceType: 'script', ranges: true, locations: true }); }
    catch (e) {
        // ⛔ **parse error ជា *ការធ្លាក់* មិនមែនការរំលងទេ** (វាស់បានក្នុង 2.22.5)។
        // ជំនាន់ដំបូងនៃការស្កេនច្រើនឯកសារ សរសេរ `continue;` ត្រង់នេះ ➜
        // ឯកសារ ship ដែល **parse មិនបាន** (កូដខូចពិត) ត្រូវរំលង **ស្ងាត់**
        // ➜ checker រាយ ✅។ Mutation ដែលបំបែក `boot-flags.js` **រស់រាន**
        // ដោយសារហេតុនេះ។ នេះជាថ្នាក់ដដែលនឹងមេរៀន «SKIP ធំពេក» (2.20.1)។
        console.log('\n❌ ' + app + '/' + rel + ' — parse មិនបាន (កូដ ship ខូច): ' + e.message);
        parseFailures++;
        continue;
    }
    filesScanned++;

    const protection = storageProtection(ast);
    const hits = [];
    // ⛔ **ការប៉ះ global storage ខ្លួនវា ក៏បោះដែរ** (វាស់បានក្នុង 2.22.5) ៖
    // `window.localStorage` ជា **getter** ➜ សូម្បីការអាន property ដោយ
    // គ្មានការហៅ method ក៏បោះ `SecurityError` ពេល browser បិទ site data។
    // ជំនាន់ដំបូងចាប់តែ `CallExpression` (`X.getItem(...)`) ➜ mutation ដែល
    // ដក `try` ចេញពី shim (`const appLocalStore = window.localStorage;`)
    // **រស់រាន**។ ដូច្នេះការស្កេនត្រូវរាប់ **ការប៉ះ** ដែរ។
    // ⚠️ វាអនុវត្តតែលើ **global storage ពិត** — `appLocalStore` ជាអថេរ
    // ធម្មតាដែលមិនបោះ ➜ រាប់តែ method និង `.length` លើវា មិនរាប់ Identifier ផ្ទាល់ទេ។
    walk(ast, (node) => {
        if (storageMemberAccess(node)) {
            if (protection.guarded(node)) { guarded++; return; }
            const topLevel = protection.topLevel(node);
            const label = `${app}/${rel}:${node.loc.start.line}  ${topLevel ? '🔴 TOP-LEVEL  ' : ''}ការប៉ះ ${src.slice(node.start, node.end).slice(0, 60)}`;
            if (topLevel) topLevelHits.push(label);
            hits.push(label);
            return;
        }
        if (node.type !== 'CallExpression') return;
        const callee = node.callee;
        if (callee.type === 'Identifier' && HELPERS.has(callee.name)) {
            helperCalls++;
            return;
        }
        if (callee.type !== 'MemberExpression' || callee.computed) return;
        const storeName = storeNameOf(callee.object, STORES);
        const prop = callee.property;
        if (!storeName) return;
        if (prop.type !== 'Identifier' || !GUARDED_OPS.has(prop.name)) return;
        if (protection.guarded(node)) { guarded++; return; }
        // ⛔ ការហៅកម្រិត **top-level** ធ្ងន់ជាងច្រើន ៖ វាបញ្ឈប់ការវាយតម្លៃ
        // ឯកសារទាំងមូល ➜ App ដាច់ទាំងស្រុង មិនមែនត្រឹមមុខងារមួយទេ។
        const topLevel = protection.topLevel(node);
        if (topLevel) topLevelHits.push(`${app}/${rel}:${node.loc.start.line}  ${src.slice(node.start, node.end).slice(0, 80)}`);
        hits.push(`${app}/${rel}:${node.loc.start.line}  ${topLevel ? '🔴 TOP-LEVEL  ' : ''}${src.slice(node.start, node.end).slice(0, 80)}`);
    });

    if (hits.length) {
        unguarded += hits.length;
        console.log('\n❌ ' + app + '/' + rel + ' — ការហៅ storage ដោយគ្មាន try/catch:');
        hits.forEach((h) => console.log('   ' + h));
    }
  }
}

console.log(`\nឯកសារ ship ដែលស្កេន: ${filesScanned}   ការហៅក្នុង try/catch: ${guarded}   តាម safeStore*(): ${helperCalls}   គ្មានការការពារ: ${unguarded}`);
if (topLevelHits.length) {
    console.log('\n🔴 ក្នុងនោះ **កម្រិត top-level** ' + topLevelHits.length
        + ' — ការបោះនៅទីនោះបញ្ឈប់ការវាយតម្លៃឯកសារទាំងមូល ➜ App ដាច់ទាំងស្រុង');
}

// ⛔ **ជាន់អប្បបរមា (positive floor)។** ការអះអាងបែប «គ្មានលំនាំអាក្រក់ទេ»
// ជាការអះអាង **អវត្តមាន** — វាពិតដោយស្វ័យប្រវត្តិលើ input ទទេ។ ដូច្នេះ
// checker នេះត្រូវអះអាងជាមុនសិនថា **វាពិតជាបានឃើញកូដ**។ បើមិនដូច្នេះ ការ
// ប្តូរឈ្មោះឯកសារ · ការផ្លាស់កូដទៅឯកសារថ្មី · ឬ override ថត ដែលខុស នឹង
// ធ្វើឲ្យវាបៃតង **ខណៈវាមិនបានពិនិត្យអ្វីសោះ**។
// មើល `checker-coverage.js` — វាភ្ជាប់ថតទទេចូល checker នេះ រួចអះអាងថាវាធ្លាក់។
// ⛔ **ជាន់អប្បបរមាទី ២ ៖ ចំនួន *ឯកសារ* ដែលស្កេន។** ជាន់ដែលរាប់តែ
// «ចំនួនការហៅ» មិនគ្រប់គ្រាន់ទេ ៖ ការ refactor ដែលរក្សាចំនួន helper call
// ដដែល តែផ្លាស់ការហៅផ្ទាល់ទៅទម្រង់ដែល checker មើលមិនឃើញ **ឆ្លងកាត់ជាន់នោះ**
// (វាស់បានក្នុងជុំ 2.22.5 — ការជំនួស 75 កន្លែងធ្វើឲ្យ checker រាយ `0`
// ខណៈការហៅផ្ទាល់ 30 នៅដដែល ហើយជាន់អប្បបរមាចាស់ **មិនចាប់បានទេ**
// ព្រោះ `helperCalls` = 38 នៅរក្សាផលបូកលើសកម្រិត)។
if (parseFailures) {
    console.log('\n❌ ឯកសារ ship ' + parseFailures + ' parse មិនបាន — ការស្កេនមិនពេញលេញទេ');
    process.exit(1);
}
const MIN_FILES = 6;
if (filesScanned < MIN_FILES) {
    console.log('\n❌ ជាន់អប្បបរមា៖ រំពឹងឯកសារ ship >= ' + MIN_FILES
        + ' តែស្កេនបាន ' + filesScanned + ' — checker នេះមិនបានឃើញកូដទេ');
    process.exit(1);
}
const MIN_STORAGE_WRITES = 20;
if (guarded + helperCalls + unguarded < MIN_STORAGE_WRITES) {
    console.log('\n❌ ជាន់អប្បបរមា៖ រំពឹងការសរសេរទៅ storage >= ' + MIN_STORAGE_WRITES
        + ' តែឃើញ ' + (guarded + helperCalls + unguarded)
        + ' — checker នេះមិនបានឃើញកូដទេ');
    process.exit(1);
}
if (unguarded) {
    console.log('\nដំណោះស្រាយ៖ ប្រើ safeStoreGet(localStorage, key) / safeStoreSet(localStorage, key, value) / safeStoreRemove(localStorage, key)');
    console.log('ឬរុំក្នុង try { ... } catch (e) {} បើការបរាជ័យអាចមិនអើពើបាន។');
    process.exit(1);
}
console.log('\n✅ រាល់ការហៅ storage (អាន និងសរសេរ) មានការការពារ');
