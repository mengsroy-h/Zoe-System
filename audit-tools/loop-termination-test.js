// ⛔ ថ្នាក់កំហុស ៖ **រង្វិលជុំដែលមិនចេះឈប់ ➜ App ជាប់ទាំងស្រុង**។
//
// Tab ដែលជាប់ក្នុងរង្វិលជុំ **មិនឆ្លើយអ្វីទាំងអស់** ៖ គ្មាន toast · គ្មាន
// ការរក្សាទុក · គ្មានសូម្បីតែប៊ូតុងបិទ ➜ អ្នកប្រើត្រូវសម្លាប់ App ហើយ
// **ការងារដែលមិនទាន់ចុះ បាត់**។ វាធ្ងន់ជាងការធ្លាក់ដែលមានឈ្មោះ ព្រោះ
// គ្មាន Sentry event · គ្មាន stack trace · គ្មានសញ្ញាណាសោះ។
//
// ⛔ **ការវាស់ត្រូវជា *ការរត់ពិត* មិនមែនការអានកូដ** ៖ រង្វិលជុំមួយ «មើលទៅ
// ដូចមានព្រំដែន» អាចរត់មិនចេះចប់ពេលអថេររាប់ក្លាយជា `Infinity` (`Infinity`
// ចែក ២៦ នៅតែ `Infinity`) ឬពេលព្រំដែនមកពី **លេខក្នុង Firebase** ដែល rules
// ទាមទារត្រឹម `>= 0` ។ ដូច្នេះឧបករណ៍នេះស្រង់តួ function **ពិត** ចេញពី
// `app.js` រួចរត់វាក្នុង **child process ដាច់ដោយឡែក** ជាមួយពិដានពេល និង
// ពិដាន heap ➜ ការមិនចេះឈប់ក្លាយជា **ការធ្លាក់ដែលមានឈ្មោះ**។
//
// 🔴 វាស់បាន (2026-09-15 · tree ដែល checker ១៧២ បៃតងទាំងអស់ · SKIP 0) ៖
//   (ក) `sheetImportColumnLetter(Infinity)` ➜ **មិនចេះឈប់** (សម្លាប់ក្រោយ ៤ វិ.)
//       ព្រោះ `Math.floor(Infinity / 26) - 1 === Infinity` ➜ `n >= 0` ពិតរហូត
//       ហើយខ្សែអក្សរវែងឡើងរាល់ជុំ ➜ **tab OOM**។
//   (ខ) `legacyPickupPlaceholders({ packagesPickedUp: 5e7 })` ➜ **OOM** ។
//       `packagesPickedUp` មកពី Firebase ហើយ rules ទាមទារត្រឹម
//       `isNumber() && >= 0` ➜ លេខធំ (ទិន្នន័យចាស់ ឬការកែដោយដៃក្នុង Console)
//       ធ្វើឲ្យវាសាងវត្ថុរាប់លានកូនសោ។
//
// ⛔ **ជាន់អប្បបរមា** ៖ បើស្រង់តួ function មិនឃើញ នោះការអះអាង «វាឈប់»
// ពិតដោយស្វ័យប្រវត្តិ ➜ ការស្រង់ដែលធ្លាក់ត្រូវរាយជា **FAIL** មិនមែនរំលង។
process.exitCode = 1;

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = process.env.LOOPTERM_APP_DIR || path.join(__dirname, '..');
const APP_JS = path.join(ROOT, 'ZoeW', 'app.js');
let pass = 0, fail = 0;
function ok(label, cond, detail) {
    if (cond) { pass++; console.log('  ok    ' + label); }
    else { fail++; console.log('  FAIL  ' + label + (detail !== undefined ? '\n        ' + String(detail).slice(0, 400) : '')); }
}

if (!fs.existsSync(APP_JS)) {
    console.log('  FAIL  រកមិនឃើញ ZoeW/app.js នៅ ' + APP_JS);
    console.log('\n❌ ធ្លាក់ 1 / ok 0');
    process.exitCode = 1;
    return;
}
const SRC = fs.readFileSync(APP_JS, 'utf8').replace(/\r\n?/g, '\n');

function readAppSrc(appName) {
    try { return fs.readFileSync(path.join(ROOT, appName, 'app.js'), 'utf8').replace(/\r\n?/g, '\n'); }
    catch (e) { return ''; }
}

// ⛔ ថេរត្រូវ **អានចេញពីកូដពិត** មិនមែនចាក់ជា literal ក្នុង checker
// (បើមិនដូច្នេះ ការដកពិដានចេញពី `app.js` នៅតែបៃតងត្រង់នេះ)។
function sliceConsts(names) {
    return names.map((n) => {
        const re = new RegExp('^\\s*const ' + n + '\\s*=\\s*[^;]+;', 'm');
        const m = re.exec(SRC);
        return m ? m[0].trim() : '';
    }).join('\n');
}

function sliceFn(name) {
    const start = SRC.indexOf('function ' + name + '(');
    if (start === -1) return '';
    let depth = 0, i = SRC.indexOf('{', start), started = false;
    for (; i < SRC.length; i++) {
        if (SRC[i] === '{') { depth++; started = true; }
        else if (SRC[i] === '}') { depth--; if (started && depth === 0) { i++; break; } }
    }
    return SRC.slice(start, i);
}

// ⛔ ច្បាប់ដដែលអនុវត្តលើ **App ទាំង ២** ➜ ការស្រង់ត្រូវដឹងឈ្មោះ App
// (បើមិនដូច្នេះ ច្បាប់ចម្លងក្នុង ZoeKeyGen រអិលកាត់ស្ងាត់ៗ)។
function sliceFnFrom(src, name) {
    const start = src.indexOf('function ' + name + '(');
    if (start === -1) return '';
    let depth = 0, i = src.indexOf('{', start), started = false;
    for (; i < src.length; i++) {
        if (src[i] === '{') { depth++; started = true; }
        else if (src[i] === '}') { depth--; if (started && depth === 0) { i++; break; } }
    }
    return src.slice(start, i);
}

function terminatesWithinApp(appName, names, callSrc, ms, heapMb) {
    const src = readAppSrc(appName);
    if (!src) return { ok: false, why: 'អាន ' + appName + '/app.js មិនបាន' };
    const bodies = names.map((n) => sliceFnFrom(src, n));
    if (bodies.some((b) => !b)) return { ok: false, why: 'ស្រង់តួ function មិនឃើញក្នុង ' + appName };
    const script = bodies.join('\n') + '\n' + callSrc + '\nconsole.log("DONE");';
    const res = spawnSync(process.execPath, ['--max-old-space-size=' + (heapMb || 192), '-e', script],
        { timeout: ms, maxBuffer: 1024 * 1024, encoding: 'utf8' });
    if (res.signal || res.status === null) return { ok: false, why: 'មិនឈប់ក្នុង ' + ms + ' ms (សម្លាប់ដោយ ' + res.signal + ')' };
    if (res.status !== 0) return { ok: false, why: 'ធ្លាក់/OOM ៖ ' + String(res.stderr || '').split('\n').filter(Boolean).slice(-1)[0] };
    if (String(res.stdout).indexOf('DONE') === -1) return { ok: false, why: 'មិនឈានដល់ចុងបញ្ចប់' };
    return { ok: true };
}

// ⛔ ការរត់ត្រូវនៅក្នុង **process ដាច់ដោយឡែក** ៖ រង្វិលជុំមិនចេះឈប់ក្នុង
// process ដដែល នឹងធ្វើឲ្យ checker ខ្លួនឯងព្យួរ ➜ `hang-guard` ធ្លាក់ជំនួស
// ការធ្លាក់ដែលមានឈ្មោះ។ ពិដាន heap តូចធ្វើឲ្យ OOM មកលឿន។
function terminatesWithin(preludeNames, callSrc, ms, heapMb) {
    const prelude = preludeNames.map(sliceFn).join('\n');
    if (preludeNames.some((n) => !sliceFn(n))) return { ok: false, why: 'ស្រង់តួ function មិនឃើញ' };
    const consts = sliceConsts(['PICKUP_LEGACY_KEY_PREFIX', 'PICKUP_LEGACY_PLACEHOLDER_MAX', 'SHEET_IMPORT_COLUMN_LETTER_MAX',
        'LOCKER_COUNT_MIN', 'LOCKER_COUNT_MAX', 'LOCKER_COUNT_DEFAULT']);
    const script = consts + '\n' + prelude + '\n' + callSrc + '\nconsole.log("DONE");';
    const res = spawnSync(process.execPath, ['--max-old-space-size=' + (heapMb || 192), '-e', script],
        { timeout: ms, maxBuffer: 1024 * 1024, encoding: 'utf8' });
    if (res.signal || res.status === null) return { ok: false, why: 'មិនឈប់ក្នុង ' + ms + ' ms (សម្លាប់ដោយ ' + res.signal + ')' };
    if (res.status !== 0) return { ok: false, why: 'ធ្លាក់/OOM ៖ ' + String(res.stderr || '').split('\n').filter(Boolean).slice(-1)[0] };
    if (String(res.stdout).indexOf('DONE') === -1) return { ok: false, why: 'មិនឈានដល់ចុងបញ្ចប់' };
    return { ok: true };
}

console.log('=== loop-termination — រង្វិលជុំក្នុងកូដ ship ត្រូវឈប់លើ input អាក្រក់ ===');

// ១. `sheetImportColumnLetter` — លេខជួរឈរ Excel
console.log('\n--- ១. sheetImportColumnLetter (លេខជួរឈរនាំចូល) ---');
[
    ['Infinity', 'Infinity'],
    ['-Infinity', '-Infinity'],
    ['1e21', '1e21'],
    ['Number.MAX_SAFE_INTEGER', 'Number.MAX_SAFE_INTEGER'],
    ['NaN', 'NaN'],
    ['"5"', '"5"']
].forEach(([label, arg]) => {
    const r = terminatesWithin(['sheetImportColumnLetter'], 'sheetImportColumnLetter(' + arg + ');', 4000, 192);
    ok('sheetImportColumnLetter(' + label + ') ឈប់', r.ok, r.why);
});
// ⛔ ទិសផ្ទុយ ៖ តម្លៃធម្មតាត្រូវនៅត្រឹមត្រូវ (ការបន្ថែមព្រំដែនមិនត្រូវខូចលទ្ធផល)
{
    const r = spawnSync(process.execPath, ['-e', sliceConsts(['SHEET_IMPORT_COLUMN_LETTER_MAX']) + '\n' + sliceFn('sheetImportColumnLetter')
        + '\nconsole.log([0,1,25,26,27,51,52,701,702].map(sheetImportColumnLetter).join(","));'],
        { timeout: 4000, encoding: 'utf8' });
    ok('⛔ ទិសផ្ទុយ៖ តម្លៃធម្មតានៅត្រឹមត្រូវ (A,B,Z,AA,AB,AZ,BA,ZZ,AAA)',
        String(r.stdout).trim() === 'A,B,Z,AA,AB,AZ,BA,ZZ,AAA', String(r.stdout).trim() || String(r.stderr).slice(0, 200));
}

// ២. `legacyPickupPlaceholders` — ព្រំដែនមកពី Firebase (rules ទាមទារត្រឹម >= 0)
console.log('\n--- ២. legacyPickupPlaceholders (ព្រំដែនមកពី Firebase) ---');
[
    ['packagesPickedUp = 5e7', '{ packagesPickedUp: 5e7, pickedUpPhones: { "012345678": 1 } }'],
    ['packagesPickedUp = 1e9', '{ packagesPickedUp: 1e9, pickedUpPhones: { "012345678": 1 } }'],
    ['pickedUpPhones ធំ', '{ packagesPickedUp: 3, pickedUpPhones: { "012345678": 5e7 } }'],
    ['packagesPickedUp = Infinity', '{ packagesPickedUp: Infinity, pickedUpPhones: { "012345678": 1 } }']
].forEach(([label, arg]) => {
    const r = terminatesWithin(['ledgerNumber', 'legacyPickupPlaceholders'],
        'legacyPickupPlaceholders(' + arg + ');', 8000, 192);
    ok('legacyPickupPlaceholders(' + label + ') ឈប់', r.ok, r.why);
});
// ⛔ ទិសផ្ទុយ ៖ ទិន្នន័យចាស់ពិត (លេខតូច) ត្រូវនៅផលិតកូនសោគ្រប់ចំនួន
{
    const r = spawnSync(process.execPath, ['-e', sliceConsts(['PICKUP_LEGACY_KEY_PREFIX', 'PICKUP_LEGACY_PLACEHOLDER_MAX']) + '\n' + sliceFn('ledgerNumber') + '\n'
        + sliceFn('legacyPickupPlaceholders')
        + '\nconst o=legacyPickupPlaceholders({packagesPickedUp:5,pickedUpPhones:{"012345678":2,"098765432":1}});'
        + '\nconsole.log(Object.keys(o).length);'], { timeout: 4000, encoding: 'utf8' });
    ok('⛔ ទិសផ្ទុយ៖ ទិន្នន័យចាស់ពិត (recorded=5) ➜ កូនសោ ៥ គ្រប់',
        String(r.stdout).trim() === '5', String(r.stdout).trim() || String(r.stderr).slice(0, 200));
}

// ៣. ⛔ អ្នកយាមរចនាសម្ព័ន្ធ ៖ រង្វិលជុំថ្មីដែលព្រំដែនមកពី *លេខ* ត្រូវមានពិដាន។
// បញ្ជីនេះ **ដេរីវេពីកូដពិត** មិនមែនបញ្ជីរឹង ៖ រាល់ `while` ក្នុងកូដ ship
// ដែល **មិន** ដើរលើប្រវែងខ្សែអក្សរ/ទំហំ collection/DOM node ត្រូវលេចត្រង់នេះ។
// ⛔ វិសាលភាពគឺ **App ទាំង ២** ៖ ច្បាប់នេះជារចនាសម្ព័ន្ធ (tab ជាប់ស្ងាត់ៗ)
// ➜ វាមិនមែនរបស់ ZoeW តែម្នាក់ឯងទេ។ ការស្កេនតែឯកសារ **១** គឺជា
// កាលបរិច្ឆេទផុតកំណត់ ៖ រង្វិលជុំថ្មីក្នុង App ទី ២ រអិលកាត់ស្ងាត់ៗ។
console.log('\n--- ៣. រង្វិលជុំថ្មីដែលរាប់តាមលេខ ត្រូវមានពិដាន (App ទាំង ២) ---');
let acorn = null;
try { acorn = require('acorn'); } catch (e) {}
if (!acorn) {
    ok('⛔ ត្រូវការ acorn ដើម្បីស្កេនរង្វិលជុំ (npm i acorn)', false, 'acorn មិនមាន');
} else {
  [['ZoeW', SRC, 5], ['ZoeKeyGen', readAppSrc('ZoeKeyGen'), 3]].forEach(([appName, SRC, minLoops]) => {
    if (!SRC) { ok('ស្រង់ app.js របស់ ' + appName + ' បាន', false, 'អានឯកសារមិនបាន'); return; }
    const ast = acorn.parse(SRC, { ecmaVersion: 2022, locations: true });
    const fnRanges = [];
    (function fns(n) {
        if (!n || typeof n !== 'object') return;
        if (Array.isArray(n)) { n.forEach(fns); return; }
        if (/Function(Declaration|Expression)$|ArrowFunctionExpression/.test(n.type)) fnRanges.push({ start: n.start, end: n.end });
        for (const k in n) { if (k === 'loc' || k === 'start' || k === 'end') continue; fns(n[k]); }
    })(ast);
    const numeric = [];
    (function walk(n) {
        if (!n || typeof n !== 'object') return;
        if (Array.isArray(n)) { n.forEach(walk); return; }
        // ⛔ `for (i = 1; i <= n; i++)` ជារូបរាងទី ៤ ៖ ជំនាន់មុនស្កេនតែ
        // `while` · `do-while` · `for(;;)` ➜ រង្វិលជុំរាប់តាមលេខ **គ្មាន
        // អ្នកវាស់សោះ**។ វាស់បាន ៖ `forceSheetTextCells(ws, Infinity, [1,2])`
        // មិនចេះឈប់ ហើយ `getLockerCount()` ត្រឡប់លេខពី localStorage ដោយ
        // គ្មានពិដាន ➜ `renderLockerGrid()` សាង DOM node រាប់លាន។
        const countedFor = n.type === 'ForStatement' && n.test
            && !/\.length\b|\.size\b|\.children\b|\.rows\b/.test(SRC.slice(n.test.start, n.test.end))
            && !(n.test.right && n.test.right.type === 'Literal' && typeof n.test.right.value === 'number');
        if (n.type === 'WhileStatement' || n.type === 'DoWhileStatement' || (n.type === 'ForStatement' && !n.test) || countedFor) {
            // ⛔ ពិដានដែលដាក់ **ខាងលើ** រង្វិលជុំ (ក្នុង function ដដែល) ក៏ជា
            // ព្រំដែនដែរ ➜ ស្កេនតួ function ទាំងមូល មិនត្រឹមតួរង្វិលជុំ។
            // ⛔ យក scope **ក្រៅបំផុត** ៖ ពិដានដែលប្រកាសក្រៅ arrow
            // (ឧ. `legacyPickupPlaceholders` ➜ `recorded`) មើលមិនឃើញ បើយក
            // arrow ខាងក្នុង ➜ false positive។
            const fnStart = fnRanges.filter((f) => f.start <= n.start && f.end >= n.end)
                .sort((a, b) => (a.start - b.start))[0];
            const body = SRC.slice(fnStart ? fnStart.start : n.start, n.end);
            // ព្រំដែនរចនាសម្ព័ន្ធ ៖ ប្រវែង · ទំហំ · DOM · break ច្បាស់លាស់
            const structural = /\.length\b|\.size\b|\.children\b|\bnode\s*=\s*node\.|\bparentElement\b|\bparentNode\b|\bbreak\b|\.indexOf\(/.test(body);
            // ពិដានលេខច្បាស់លាស់
            const capped = /_MAX\b|_LIMIT\b|_CAP\b|Math\.min\(|Number\.isFinite\(|\bisFinite\(/.test(body);
            if (!structural && !capped) numeric.push({ line: n.loc.start.line, head: body.slice(0, 90).replace(/\s+/g, ' ') });
        }
        for (const k in n) { if (k === 'loc' || k === 'start' || k === 'end') continue; walk(n[k]); }
    })(ast);
    ok(appName + ' ៖ រាល់រង្វិលជុំ (`while` · `do` · `for`) ក្នុង app.js មានព្រំដែនរចនាសម្ព័ន្ធ ឬពិដានលេខ',
        numeric.length === 0,
        numeric.map((h) => 'L' + h.line + ' ' + h.head).join('\n        '));
    // ⛔ ជាន់អប្បបរមា ៖ បើ AST មិនឃើញរង្វិលជុំណាសោះ នោះការស្កេនវាស់អ្វីផ្សេង
    let total = 0;
    (function count(n) {
        if (!n || typeof n !== 'object') return;
        if (Array.isArray(n)) { n.forEach(count); return; }
        if (n.type === 'WhileStatement' || n.type === 'DoWhileStatement') total++;
        for (const k in n) { if (k === 'loc' || k === 'start' || k === 'end') continue; count(n[k]); }
    })(ast);
    ok('⛔ ជាន់អប្បបរមា៖ AST ឃើញរង្វិលជុំ `while` របស់ ' + appName + ' យ៉ាងតិច ' + minLoops,
        total >= minLoops, 'ឃើញ ' + total);
  });
}

// ៤. ⛔ រង្វិលជុំរាប់តាមលេខ ៖ ការវាស់ **ឥរិយាបថ** (ការស្កេនផ្នែក ៣ ជាស្តាទិច)
//    វាស់បាន ៖ `forceSheetTextCells(ws, Infinity, [1,2])` មិនចេះឈប់ ហើយ
//    `getLockerCount()` ត្រឡប់លេខឆៅពី localStorage (99999999) ➜
//    `renderLockerGrid()` សាង DOM node រាប់លាន ➜ tab ជាប់ស្ងាត់ៗ។
console.log('\n--- ៤. រង្វិលជុំរាប់តាមលេខ ៖ ការរត់ពិត ---');
const XLSX_STUB = 'const XLSX={utils:{encode_cell:()=>"A1"}};const ws={A1:{t:"n",v:1}};';
[['Infinity', 'Infinity'], ['NaN', 'NaN'], ['-Infinity', '-Infinity'], ['1e12', '1e12']].forEach(([arg, label]) => {
    const r = terminatesWithin(['forceSheetTextCells'], XLSX_STUB + 'forceSheetTextCells(ws,' + arg + ',[1,2]);', 4000, 192);
    ok('forceSheetTextCells(ws, ' + label + ') ឈប់', r.ok, r.why);
});
// ⛔ រូបរាងទី ៥ ៖ រង្វិលជុំដែល **ចំណុចចាប់ផ្តើម** មកពីអាគុយម៉ង់។
//    វាស់បាន (2.37.1 · រកឃើញដោយការ fuzz helper សុទ្ធទាំងអស់ដោយ input អាក្រក់
//    មិនមែនដោយការអានកូដ) ៖ `matchingBraceIndex('', -Infinity)` មិនចេះឈប់ —
//    `i++` លើ `-Infinity` នៅដដែល ➜ `i < length` ពិតរហូត។ ⛔ ថ្នាក់នេះខុសពី
//    ទី ៤ ៖ ពិដានមិនមែនបញ្ហា — **ចំណុចចាប់ផ្តើម** ទេ ➜ ការពិនិត្យលើ
//    *ចំនួនជុំ* មិនចាប់វាទេ។ ⛔ វារស់នៅ **App ទាំង ២**។
console.log('\n--- ៥. ចំណុចចាប់ផ្តើមមកពីអាគុយម៉ង់ (matchingBraceIndex) ---');
['ZoeW', 'ZoeKeyGen'].forEach((app) => {
    ['Infinity', '-Infinity', 'NaN', '-1', '1e12', 'null', 'undefined'].forEach((arg) => {
        const r = terminatesWithinApp(app, ['matchingBraceIndex'],
            'matchingBraceIndex("x={a:1};", ' + arg + ');', 4000, 192);
        ok(app + ' ៖ matchingBraceIndex(src, ' + arg + ') ឈប់', r.ok, r.why);
    });
    // ⛔ ទិសផ្ទុយ ៖ ការបន្ថែមព្រំដែន មិនត្រូវខូចលទ្ធផលធម្មតា
    const src = readAppSrc(app);
    const body = sliceFnFrom(src, 'matchingBraceIndex');
    const probe = spawnSync(process.execPath, ['-e', body
        + '\nconsole.log(JSON.stringify([matchingBraceIndex("x={a:1};", 2), matchingBraceIndex("{}", 0), matchingBraceIndex("{", 0)]));'],
        { timeout: 4000, encoding: 'utf8' });
    let got = null;
    try { got = JSON.parse(String(probe.stdout).trim().split('\n').pop()); } catch (e) {}
    ok(app + ' ៖ ⛔ ទិសផ្ទុយ ៖ លទ្ធផលធម្មតានៅដដែល',
        !!got && got[0] === 6 && got[1] === 1 && got[2] === -1,
        JSON.stringify(got) + ' ' + String(probe.stderr || '').slice(0, 160));
});

// ⛔ ទិសផ្ទុយ ៖ ការបន្ថែមពិដាន មិនត្រូវខូចលទ្ធផលធម្មតា
{
    const stub = 'const seen=[];const XLSX={utils:{encode_cell:(o)=>{seen.push(o.r+","+o.c);return "R"+o.r+"C"+o.c;}}};'
        + 'const ws={};for(let r=1;r<=3;r++){for(const c of [1,2]){ws["R"+r+"C"+c]={t:"n",v:7};}}';
    const r = spawnSync(process.execPath, ['-e', stub + '\n' + sliceFn('forceSheetTextCells')
        + '\nforceSheetTextCells(ws,3,[1,2]);'
        + '\nconsole.log(JSON.stringify({calls:seen.length,t:ws.R1C1.t,v:ws.R1C1.v}));'],
        { timeout: 4000, encoding: 'utf8' });
    let out = null;
    try { out = JSON.parse(String(r.stdout).trim().split('\n').pop()); } catch (e) {}
    ok('⛔ ទិសផ្ទុយ ៖ rowCount ធម្មតា នៅបម្លែងក្រឡាដដែល (3 ជួរ × 2 ជួរឈរ = 6)',
        !!out && out.calls === 6 && out.t === 's' && out.v === '7', JSON.stringify(out) + ' ' + String(r.stderr || '').slice(0, 120));
}
// ចំនួនទូ ៖ ការអានត្រូវ clamp ដូចការសរសេរ — ការការពារម្ខាងគឺគ្មានការការពារ
{
    const consts = sliceConsts(['LOCKER_COUNT_MIN', 'LOCKER_COUNT_MAX', 'LOCKER_COUNT_DEFAULT']);
    const body = sliceFn('clampLockerCount');
    if (!body || !/LOCKER_COUNT_MAX/.test(consts)) {
        ok('ស្រង់ clampLockerCount() និងថេរព្រំដែនបាន', false, 'រកមិនឃើញ — ការអាន clamp មិនបាន');
    } else {
        const r = spawnSync(process.execPath, ['-e', consts + '\n' + body
            + '\nconst cases=["24","200","99999999","  500000 ","-5","abc","",null,undefined];'
            + '\nconsole.log(JSON.stringify(cases.map(clampLockerCount)));'],
            { timeout: 4000, encoding: 'utf8' });
        let vals = null;
        try { vals = JSON.parse(String(r.stdout).trim()); } catch (e) {}
        ok('clampLockerCount() ៖ គ្មានតម្លៃណាលើស LOCKER_COUNT_MAX',
            !!vals && vals.every((v) => typeof v === 'number' && v <= 200 && v >= 1), JSON.stringify(vals));
        ok('⛔ ទិសផ្ទុយ ៖ តម្លៃធម្មតានៅដដែល (24 ➜ 24 · 200 ➜ 200)',
            !!vals && vals[0] === 24 && vals[1] === 200, JSON.stringify(vals));
    }
}

console.log('');
if (fail) { console.log('❌ ធ្លាក់ ' + fail + ' / ok ' + pass); process.exitCode = 1; }
else if (!pass) { console.log('❌ គ្មានការអះអាងណារត់សោះ'); process.exitCode = 1; }
else { console.log('✅ ជោគជ័យ ' + pass); process.exitCode = 0; }
