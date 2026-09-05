// ⛔ ថ្នាក់កំហុស៖ ទិន្នន័យពី Firebase / Lookup API / អ្នកប្រើ ធ្លាក់ចូល `innerHTML`
// ដោយ **មិនឆ្លងកាត់ `sanitizeInput()`** ➜ XSS ដែលរត់ក្នុងបរិបទដដែលនឹង App
// (មាន PIN, កូនសោ AES របស់ Lookup API និង token របស់ Firebase ក្នុងសតិ)។
//
// កំណែ 2.13.0 លុបបំបាត់ថ្នាក់ `on*=` តាមរចនាសម្ព័ន្ធ (មើល «CSP និង data-act»
// ក្នុង CLAUDE.md) ប៉ុន្តែ **`innerHTML` នៅជា sink ដដែល** — គ្មានឧបករណ៍ណា
// ចាក់សោវាទេរហូតដល់ឥឡូវ។ `inline-handler-xss-test.js` សាកតែផ្លូវ handler;
// `csp-enforced-test.js` សាកតែ header។ ឯកសារនេះគ្របចន្លោះនោះ។
//
// ⚠️ **មេរៀនពីការសាងឧបករណ៍នេះ**៖ ការដើរថយក្រោយពី sink (`x.innerHTML = ...`)
// **មិនគ្រប់គ្រាន់ទេ** — កូដនេះសាង HTML ក្នុងអថេរកណ្តាល រួចសរសេរ
// `tr.innerHTML = built.html` ដែលជា Identifier ទទេ។ ការសាក mutation ពិត
// (ដក `sanitizeInput()` ចេញពី `item.phone` ក្នុង `buildHistoryRowHtml`)
// **រអិលកាត់ស្ងាត់ៗ**។ ដូច្នេះឧបករណ៍នេះស្កេន **រាល់ template literal ដែល
// មានស្លាក HTML** នៅគ្រប់កន្លែងក្នុងឯកសារ មិនមែនត្រឹម sink ទេ។
//
// របៀបធ្វើការ៖ parse ដោយ acorn រួចរកគ្រប់ TemplateLiteral ដែល quasi របស់វា
// មាន `<tag` ហើយអះអាងថា **រាល់ `${...}`**
// ខាងក្នុងជា expression ដែល *មិនអាចបញ្ចេញតួអក្សរ HTML បានទេ*៖
//   - literal
//   - ការហៅ `sanitizeInput()` / `escapeHtml()` / `toFixed()` / `toLocaleString()` …
//   - នព្វន្ធលេខ
//   - ការហៅ helper ដែលសាង HTML ដោយខ្លួនឯង (ក្នុង BUILDER_ALLOW ដែលមានហេតុផល)
//
// ⚠️ អថេរទទេ (`${row}`) ត្រូវរាយជាកំហុស **ទោះវាសុវត្ថិភាពក៏ដោយ** ព្រោះ
// ឧបករណ៍មិនអាចដើរតាមប្រភពបានទេ។ ដំណោះស្រាយត្រឹមត្រូវគឺ *ដាក់ឈ្មោះឲ្យច្បាស់*
// ក្នុង BUILDER_ALLOW ជាមួយហេតុផល — កុំបន្ថែមដោយគ្មានការតាមដានពិត។
const fs = require('fs');
const path = require('path');
let acorn;
try { acorn = require('acorn'); } catch (e) {
    console.log('SKIP — ត្រូវការ acorn (npm i acorn)');
    process.exit(0);
}

const ROOT = process.env.SINK_APP_DIR || path.join(__dirname, '..');
const APPS = ['ZoeW', 'ZoeKeyGen'];

// `<div`, `</td`, `<span ` … — ស្លាក HTML ពិត មិនមែន `a < b` ទេ
const HTML_TAG = /<\/?[a-zA-Z][a-zA-Z0-9-]*[\s/>]/;

// ការហៅដែលលទ្ធផល **មិនអាច** មានតួអក្សរ HTML ដែលមិន escape
const SAFE_CALLS = new Set([
    'sanitizeInput', 'escapeHtml',
    'toFixed', 'toLocaleString', 'toString',
    'Number', 'parseInt', 'parseFloat',
    'encodeURIComponent', 'encodeURI'
]);

// អថេរ/property ដែលកាន់ HTML ដែលសាងរួចដោយកូដនេះខ្លួនឯង — មានហេតុផលក្នុងមួយធាតុ
const BUILDER_ALLOW = {
    ZoeW: {
        editMoneyHtml: 'HTML សាងខាងលើក្នុង function ដដែល; តម្លៃឆ្លង sanitizeInput(id) រួច',
        bodyRows: 'ជួរដេក Export សាងខាងលើ; គ្រប់វាលឆ្លង sanitizeInput() ឬ toFixed()',
        monthlyReportTilesHtml: 'ប្លុកសង្ខេបរបាយការណ៍ខែ សាងខាងលើក្នុង function ដដែល; ស្លាកនិងតម្លៃឆ្លង sanitizeInput()',
        monthlyReportRowsHtml: 'ជួរដេករបាយការណ៍ខែ សាងខាងលើ; ថ្ងៃឆ្លង sanitizeInput() ចំណែកលេខឆ្លង toFixed()/toLocaleString()',
        monthlyReportMismatchNote: 'អត្ថបទព្រមានសាងក្នុង function ដាច់ដោយឡែក; មានតែលេខដែលឆ្លង toFixed()/toLocaleString()',
        bcTimeDisplay: 'HTML សាងខាងលើ; b.time ឆ្លង sanitizeInput()',
        closeBtnClass: 'ឈ្មោះ class ថេរ ២ (btn-toggle-bc-close[ closed])',
        closeBtnText: 'អត្ថបទថេរ ២ («យកហើយ» / «✅ យក»)',
        scopeNote: 'អត្ថបទថេរ ២ («លទ្ធផលស្វែងរក» / «ធុងសំរាមទាំងមូល»)',
        count: 'លេខ (dataToRender.length ឬ rows.length)',
        exchangeRateRiel: 'លេខ — parseFloat() មុនផ្តល់តម្លៃ',
        idx: 'index នៃ forEach លើ item.barcodes ➜ លេខជានិច្ច',
        grandCount: 'លេខ — ផលបូកនៃ bucket.count',
        trashSummaryCardHtml: 'helper សាង HTML ធុងសំរាម; អាគុយម៉ង់ជា literal ថេរ និងលេខ',
        trashActionButtonsHtml: 'helper សាង HTML; id ឆ្លង sanitizeInput()',
        trashGroupRowHtml: 'helper សាង HTML; គ្រប់វាលឆ្លង sanitizeInput() ឬលេខ',
        i: 'index នៃ forEach លើបញ្ជី ➜ លេខជានិច្ច',
        no: 'rowNum — លេខរៀងជួរដេក Export',
        phoneCell: 'HTML សាងខាងលើ; phoneRaw ឆ្លង sanitizePhoneNumber() រួច sanitizeInput()',
        codeText: 'HTML សាងខាងលើ; shown[0] ឆ្លង sanitizeInput(), សល់ជា .length',
        lockerText: 'HTML សាងខាងលើ; lockers.join() ឆ្លង sanitizeInput()',
        recallClass: "ឈ្មោះ class ថេរ ២ ('' / ' call-btn-recall')",
        cls: 'អាគុយម៉ង់ literal ថេររបស់ trashSummaryCardHtml',
        head: 'អាគុយម៉ង់ literal ថេររបស់ trashSummaryCardHtml',
        note: 'អាគុយម៉ង់ literal ថេររបស់ trashSummaryCardHtml',
        codeTags: 'HTML សាងខាងលើ; គ្រប់ code ឆ្លង sanitizeInput()',
        moreCodes: 'HTML សាងខាងលើ; មានតែលេខ (+N)',
        codeHtml: 'HTML សាងខាងលើ; គ្រប់ code ឆ្លង sanitizeInput()',
        meta: 'ធាតុនៃ TRASH_REASON_META ដែលជា const ក្នុងកូដ — មិនមែនទិន្នន័យអ្នកប្រើ',
        actions: 'HTML សាងខាងលើ; id និង key ឆ្លង sanitizeInput()',
        totalPackageCount: 'លេខ — item.barcodes.length ឬ parseFloat(item.count)',
        rowNum: 'លេខរៀងជួរដេក (i + 1)',
        rowNumClass: "ឈ្មោះ class ថេរ ៤ ('' / row-num-no-answer / -no-connect / -wrong-number)",
        rowNumLabel: 'អត្ថបទថេរ ៣ («ខល អត់លើក» / «ខល អត់ចូល» / «ខុសលេខ»)',
        phoneDisplay: 'HTML សាងខាងលើ; item.phone ឆ្លង sanitizeInput()',
        calledBadge: 'HTML ថេរ ឬខ្សែអក្សរទទេ',
        statusBadge: 'HTML សាងខាងលើពី literal ថេរ (ageBadge / closed-badge)',
        viewListBtn: 'HTML សាងខាងលើ; item.id ឆ្លង sanitizeInput(), ចំនួនជាលេខ',
        scanTimeDisplay: 'HTML សាងខាងលើ; item.time ឆ្លង sanitizeInput()',
        priceDisplayHtml: 'HTML សាងខាងលើ; មានតែ toFixed() និង toLocaleString()',
        bcMoneyHtml: 'HTML សាងខាងលើក្នុង function ដដែល; មានតែ toFixed() និង toLocaleString() លើលេខ',
        activeCount: 'លេខ — ចំនួន barcode ដែលមិនទាន់បិទ',
        moreDropdown: 'HTML សាងខាងលើ; item.id ឆ្លង sanitizeInput()',
        callAction: 'HTML សាងខាងលើ; item.phone និង item.id ឆ្លង sanitizeInput()',
        closeAction: 'HTML សាងខាងលើ; item.id ឆ្លង sanitizeInput()'
    },
    ZoeKeyGen: {
        statusHtml: 'HTML សាងខាងលើពី badge ថេរ + escapeHtml()',
        scopeHtml: 'HTML សាងខាងលើ; scopeLabel ឆ្លង escapeHtml()',
        scopeLabel: 'លទ្ធផលផ្ទាល់នៃ escapeHtml()',
        expStr: "toLocaleDateString('km-KH') ឬ '-'"
    },
};

let pass = 0, fail = 0;
const ok = (n) => { console.log('   ok    ' + n); pass++; };
const bad = (n, d) => { console.log('   FAIL  ' + n + (d ? '\n         ' + d : '')); fail++; };

function walk(node, cb) {
    if (!node || typeof node.type !== 'string') return;
    cb(node);
    for (const k of Object.keys(node)) {
        if (k === 'start' || k === 'end' || k === 'loc') continue;
        const v = node[k];
        if (Array.isArray(v)) v.forEach((c) => { if (c && typeof c.type === 'string') walk(c, cb); });
        else if (v && typeof v.type === 'string') walk(v, cb);
    }
}

function calleeName(callee) {
    if (callee.type === 'Identifier') return callee.name;
    if (callee.type === 'MemberExpression' && callee.property.type === 'Identifier') return callee.property.name;
    return null;
}

function isSafeExpr(node, allow) {
    if (!node) return true;
    switch (node.type) {
        case 'Literal':
        case 'UnaryExpression':
        case 'UpdateExpression':
            return true;
        case 'TemplateLiteral':
            return node.expressions.every((e) => isSafeExpr(e, allow));
        case 'CallExpression': {
            const name = calleeName(node.callee);
            if (name && SAFE_CALLS.has(name)) return true;
            if (name && Object.prototype.hasOwnProperty.call(allow, name)) return true;
            // `.map(...).join('')` ➜ ពិនិត្យតួ callback ជំនួស
            // `arr.map(cb).join(sep)` ៖ លទ្ធផលកំណត់ដោយ **cb** មិនមែនដោយ `arr` ទេ
            if (name === 'join') {
                return node.callee.type === 'MemberExpression' && isSafeExpr(node.callee.object, allow);
            }
            if (name === 'map') {
                return node.arguments.length > 0 && isSafeExpr(node.arguments[0], allow);
            }
            if (name === 'filter' || name === 'slice' || name === 'sort' || name === 'reverse') {
                return node.callee.type === 'MemberExpression' && isSafeExpr(node.callee.object, allow);
            }
            return false;
        }
        case 'ArrowFunctionExpression':
        case 'FunctionExpression':
            return isSafeExpr(node.body, allow);
        case 'BlockStatement':
            return false;
        case 'BinaryExpression':
            // មានតែ `+` ទេដែលអាចជាការតភ្ជាប់ខ្សែអក្សរ; `-` `*` `/` `%` `**`
            // បង្ខំជាលេខជានិច្ចតាមវេយ្យាករណ៍ JS ➜ មិនអាចបញ្ចេញតួអក្សរ HTML
            if (node.operator !== '+') return true;
            return isSafeExpr(node.left, allow) && isSafeExpr(node.right, allow);
        case 'ConditionalExpression':
            return isSafeExpr(node.consequent, allow) && isSafeExpr(node.alternate, allow);
        case 'LogicalExpression':
            return isSafeExpr(node.left, allow) && isSafeExpr(node.right, allow);
        case 'Identifier':
            return Object.prototype.hasOwnProperty.call(allow, node.name);
        case 'MemberExpression':
            // `.length` ជាលេខជានិច្ច ➜ មិនអាចបញ្ចេញតួអក្សរ HTML បានទេ
            if (node.property.type === 'Identifier' && node.property.name === 'length') return true;
            // `meta.label` ៖ បើ **object** ស្ថិតក្នុង allow នោះ property របស់វាក៏ដែរ
            if (node.object.type === 'Identifier'
                && Object.prototype.hasOwnProperty.call(allow, node.object.name)) return true;
            return node.property.type === 'Identifier'
                && Object.prototype.hasOwnProperty.call(allow, node.property.name);
        default:
            return false;
    }
}

console.log('\n=== `${...}` ក្នុង sink HTML ត្រូវឆ្លងកាត់ការ escape ===');

let scanned = 0;
let sinkCount = 0;
const offenders = [];

for (const app of APPS) {
    const allow = BUILDER_ALLOW[app] || {};
    for (const rel of ['app.js']) {
        const file = path.join(ROOT, app, rel);
        if (!fs.existsSync(file)) continue;
        scanned++;
        const code = fs.readFileSync(file, 'utf8');
        const ast = acorn.parse(code, { ecmaVersion: 2022, locations: true });
        walk(ast, (n) => {
            if (n.type !== 'TemplateLiteral') return;
            // template literal ណាដែល quasi មានស្លាក HTML បើក ➜ វាជា HTML
            const isHtml = n.quasis.some((q) => HTML_TAG.test(q.value.raw));
            if (!isHtml || !n.expressions.length) return;
            sinkCount++;
            const unsafe = [];
            n.expressions.forEach((e) => {
                if (!isSafeExpr(e, allow)) unsafe.push(code.slice(e.start, e.end).replace(/\s+/g, ' ').slice(0, 72));
            });
            if (unsafe.length) {
                offenders.push(app + '/' + rel + ':' + n.loc.start.line + '  '
                    + [...new Set(unsafe)].slice(0, 4).join(' | '));
            }
        });
    }
}

// ⚠️ **ចន្លោះដែលបិទក្នុងជុំ deep audit៖** ខាងលើស្កេនតែ `TemplateLiteral`។
// កូដនេះក៏សាង HTML ដោយ **ការតភ្ជាប់ខ្សែអក្សរ** ដែរ (ឧ. `filterCustomerDataTable()`
// សាងជួរដេកតារាងអតិថិជនដោយ `'<tr><td>' + ... + '</td>'`) ➜ ការដក
// `sanitizeInput()` ចេញពីទីនោះ **រអិលកាត់ស្ងាត់ៗ** ព្រោះគ្មាន template literal
// ណាពាក់ព័ន្ធសោះ។ នេះជាមេរៀនដដែលនឹង `network-timeout-test.js` (2.12.1) និង
// `fluid-type-focus-test.js` (2.16.0)៖ **checker ត្រូវសួរថាវាស្កេន *ទម្រង់ណា*
// ខ្លះ មិនមែនត្រឹមឯកសារណាខ្លះទេ។**
function flattenPlus(node, out) {
    if (node.type === 'BinaryExpression' && node.operator === '+') {
        // សម្គាល់ថ្នាំងកណ្តាលទុក ដើម្បីកុំឲ្យខ្សែសង្វាក់តែមួយត្រូវរាយច្រើនដង
        node.left.__seenAsChild = true;
        node.right.__seenAsChild = true;
        flattenPlus(node.left, out);
        flattenPlus(node.right, out);
        return out;
    }
    out.push(node);
    return out;
}

let concatCount = 0;
for (const app of APPS) {
    const allow = BUILDER_ALLOW[app] || {};
    const file = path.join(ROOT, app, 'app.js');
    if (!fs.existsSync(file)) continue;
    const code = fs.readFileSync(file, 'utf8');
    const ast = acorn.parse(code, { ecmaVersion: 2022, locations: true });
    walk(ast, (n) => {
        if (n.type !== 'BinaryExpression' || n.operator !== '+') return;
        // យកតែខ្សែសង្វាក់ `+` ខាងក្រៅបំផុត ដើម្បីកុំរាយកន្លែងតែមួយច្រើនដង
        if (n.__seenAsChild) return;
        const parts = flattenPlus(n, []);
        const isHtml = parts.some((c) => c.type === 'Literal' && typeof c.value === 'string' && HTML_TAG.test(c.value));
        if (!isHtml) return;
        concatCount++;
        const unsafe = [];
        parts.forEach((c) => {
            if (c.type === 'Literal') return;
            if (!isSafeExpr(c, allow)) unsafe.push(code.slice(c.start, c.end).replace(/\s+/g, ' ').slice(0, 72));
        });
        if (unsafe.length) {
            offenders.push(app + '/app.js:' + n.loc.start.line + '  (concat)  '
                + [...new Set(unsafe)].slice(0, 4).join(' | '));
        }
    });
}

ok('ស្កេន ' + scanned + ' ឯកសារ · រកឃើញ template HTML ' + sinkCount
    + ' កន្លែង · HTML តាមការតភ្ជាប់ខ្សែអក្សរ ' + concatCount + ' កន្លែង');
if (concatCount > 0) {
    ok('ទម្រង់ HTML ទាំង ២ ត្រូវបានស្កេន (template literal **និង** ការតភ្ជាប់ខ្សែអក្សរ)');
} else {
    bad('⛔ ជាន់អប្បបរមា ៖ ការស្កេន HTML តាមការតភ្ជាប់ខ្សែអក្សររកមិនឃើញអ្វីសោះ',
        'concatCount = 0 ➜ ទម្រង់នោះលែងត្រូវបានវាស់ (scanner ខូច ឬលំនាំប្រែ)');
}
if (offenders.length === 0) {
    ok('គ្រប់ `${...}` ក្នុង sink ឆ្លងកាត់ sanitizeInput()/escapeHtml() ឬជាលេខ');
} else {
    bad('មាន ' + offenders.length + ' កន្លែងសាង HTML ដែលបញ្ចូលតម្លៃមិន escape',
        offenders.slice(0, 10).join('\n         '));
}

// ២. `sanitizeInput()` ត្រូវ escape តួអក្សរទាំង ៥ — បើខ្វះមួយ ការការពារបែក
console.log('\n=== sanitizeInput() escape តួអក្សរគ្រប់ ៥ ===');
const zoewSrc = fs.readFileSync(path.join(ROOT, 'ZoeW', 'app.js'), 'utf8');
const fnStart = zoewSrc.indexOf('function sanitizeInput(');
const fnBody = fnStart === -1 ? '' : zoewSrc.slice(fnStart, zoewSrc.indexOf('\n    }', fnStart));
[['&', '&amp;'], ['<', '&lt;'], ['>', '&gt;'], ['"', '&quot;'], ["'", '&#039;']].forEach(([ch, ent]) => {
    const has = fnBody.indexOf(ent) !== -1;
    has ? ok('sanitizeInput() បម្លែង ' + ch + ' ➜ ' + ent)
        : bad('sanitizeInput() **មិន** បម្លែង ' + ch + ' ➜ XSS តាម attribute ឬ text');
});
// លំដាប់សំខាន់៖ `&` ត្រូវជាដំបូង បើមិនដូច្នេះ entity ដែលទើបបង្កើតត្រូវ escape ស្ទួន
const ampIdx = fnBody.indexOf('&amp;');
const ltIdx = fnBody.indexOf('&lt;');
(ampIdx !== -1 && ltIdx !== -1 && ampIdx < ltIdx)
    ? ok('`&` ត្រូវបម្លែងមុនគេ (បើមិនដូច្នេះ entity ត្រូវ escape ស្ទួន)')
    : bad('`&` មិនត្រូវបម្លែងមុនគេទេ');

console.log('\n' + (fail === 0 ? '✅ ជោគជ័យទាំងអស់ (' + pass + ')' : '❌ ធ្លាក់ ' + fail + ' (ជោគជ័យ ' + pass + ')'));
process.exit(fail === 0 ? 0 : 1);
