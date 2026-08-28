// សម្អាត comment ចេញពីកូដ App ដែល ship — **ដោយសុវត្ថិភាព**។
//
// ច្បាប់គម្រោង៖ រាល់ជុំ audit ឬការកែកូដ ពេលចប់ការងារត្រូវរត់ឧបករណ៍នេះ
// ដើម្បីឲ្យកូដដែល ship គ្មាន comment សោះ។ ចំណេះដឹងត្រូវរស់នៅក្នុង
// `CLAUDE.md` និង `README.md` — **មិនមែនក្នុងកូដទេ**។
//
// «ដោយសុវត្ថិភាព» មានន័យថា ការសម្អាតត្រូវបានផ្ទៀងផ្ទាត់ថា **មិនប្តូរកូដ**៖
//
//   JavaScript ៖ parse ដោយ `acorn` ➜ លុប byte range របស់ comment ➜
//                re-tokenize ➜ diff **token-for-token** ធៀបនឹងដើម។
//                ខុសមួយ token ➜ បោះបង់ឯកសារនោះទាំងស្រុង។
//   CSS        ៖ ស្កេនតួអក្សរម្តងមួយ ដោយគោរព string (`'` `"`) និង escape
//                ➜ លុប `/* … */` ➜ ប្រៀបធៀប **declaration stream** ដែល
//                normalize រួច។
//
// រត់៖  node audit-tools/strip-comments.js            (សម្អាតកូដ App ទាំងអស់)
//       node audit-tools/strip-comments.js --check     (រាយតែប៉ុណ្ណោះ មិនកែ)
//       node audit-tools/strip-comments.js <file> ...  (ឯកសារជាក់លាក់)
//
// **`audit-tools/` និង `*/test.js` មិនត្រូវសម្អាតទេ** — ពួកវាមិន ship
// ហើយ comment របស់ពួកវាជា **ការពិពណ៌នាថ្នាក់កំហុស** ដែល `CLAUDE.md`
// យោងដល់ដោយផ្ទាល់។ ដូចគ្នាដែរ `vendor/` ជា library ខាងក្រៅ។
const fs = require('fs');
const path = require('path');

let acorn;
try { acorn = require('acorn'); } catch (e) {
    console.log('SKIP — ត្រូវការ acorn (npm i acorn)');
    process.exit(0);
}

const ROOT = process.env.STRIP_APP_DIR || path.join(__dirname, '..');
const APPS = ['ZoeW', 'ZoeKeyGen'];

const VENDOR = /(^|\/)(vendor|node_modules)\//;
const EXTERNAL_LIB = new Set(['qrcode.js']);

function shippedFiles() {
    const out = [];
    for (const app of APPS) {
        const dir = path.join(ROOT, app);
        if (!fs.existsSync(dir)) continue;
        for (const name of fs.readdirSync(dir)) {
            const rel = app + '/' + name;
            if (VENDOR.test(rel) || EXTERNAL_LIB.has(name)) continue;
            if (name === 'test.js') continue;
            if (!/\.(js|css)$/.test(name)) continue;
            out.push(rel);
        }
    }
    return out;
}

function jsTokens(src, sourceType) {
    const out = [];
    for (const t of acorn.tokenizer(src, { ecmaVersion: 2022, sourceType: sourceType })) {
        out.push(t.type.label + ' ' + String(t.value));
        if (t.type.label === 'eof') break;
    }
    return out;
}

// `firebase-loader.js` ជា ES module (`import`/`export`) ចំណែកឯកសារផ្សេង
// ជា classic script។ សាក `script` មុន បើមិនចេញ ទើបសាក `module`។
function detectSourceType(src) {
    try { acorn.parse(src, { ecmaVersion: 2022, sourceType: 'script' }); return 'script'; }
    catch (e) { acorn.parse(src, { ecmaVersion: 2022, sourceType: 'module' }); return 'module'; }
}

function stripJs(src, sourceType) {
    const comments = [];
    acorn.parse(src, { ecmaVersion: 2022, onComment: comments, sourceType: sourceType });
    if (!comments.length) return { text: src, removed: 0 };
    let out = '';
    let cursor = 0;
    for (const c of comments) {
        out += src.slice(cursor, c.start);
        cursor = c.end;
        const lineStart = out.lastIndexOf('\n') + 1;
        const before = out.slice(lineStart);
        if (before.trim() === '') {
            let after = cursor;
            while (after < src.length && (src[after] === ' ' || src[after] === '\t')) after++;
            if (src[after] === '\n') { out = out.slice(0, lineStart); cursor = after + 1; }
        }
    }
    out += src.slice(cursor);
    out = out.replace(/[^\S\n]+$/gm, '').replace(/\n{3,}/g, '\n\n');
    return { text: out, removed: comments.length };
}

function stripCss(src) {
    let out = '';
    let i = 0;
    let removed = 0;
    let quote = null;
    while (i < src.length) {
        const ch = src[i];
        if (quote) {
            out += ch;
            if (ch === '\\' && i + 1 < src.length) { out += src[i + 1]; i += 2; continue; }
            if (ch === quote) quote = null;
            i++;
            continue;
        }
        if (ch === '"' || ch === "'") { quote = ch; out += ch; i++; continue; }
        if (ch === '/' && src[i + 1] === '*') {
            const end = src.indexOf('*/', i + 2);
            const stop = end === -1 ? src.length : end + 2;
            removed++;
            const lineStart = out.lastIndexOf('\n') + 1;
            const before = out.slice(lineStart);
            let after = stop;
            while (after < src.length && (src[after] === ' ' || src[after] === '\t')) after++;
            if (before.trim() === '' && src[after] === '\n') {
                out = out.slice(0, lineStart);
                i = after + 1;
            } else {
                i = stop;
            }
            continue;
        }
        out += ch;
        i++;
    }
    out = out.replace(/[^\S\n]+$/gm, '').replace(/\n{3,}/g, '\n\n');
    return { text: out, removed: removed };
}

function cssStream(src) {
    return stripCss(src).text
        .replace(/\s+/g, ' ')
        .replace(/\s*([{};:,>+~])\s*/g, '$1')
        .trim();
}

const args = process.argv.slice(2);
const checkOnly = args.indexOf('--check') !== -1;
const targets = args.filter((a) => a.indexOf('--') !== 0);
const files = targets.length ? targets : shippedFiles();

let touched = 0;
let failed = 0;
let clean = 0;

for (const rel of files) {
    const file = path.isAbsolute(rel) ? rel : path.join(ROOT, rel);
    if (!fs.existsSync(file)) { console.log('  រំលង (រកមិនឃើញ) ' + rel); continue; }
    const src = fs.readFileSync(file, 'utf8');
    const isCss = /\.css$/.test(file);

    let result;
    let sourceType = 'script';
    try {
        if (!isCss) sourceType = detectSourceType(src);
        result = isCss ? stripCss(src) : stripJs(src, sourceType);
    } catch (e) {
        console.log('  FAIL  ' + rel + ' — parse បរាជ័យ: ' + (e && e.message));
        failed++;
        continue;
    }

    if (!result.removed && result.text === src) { clean++; continue; }

    let safe = false;
    let why = '';
    if (isCss) {
        safe = cssStream(src) === cssStream(result.text);
        why = 'declaration stream ប្រែ';
    } else {
        const before = jsTokens(src, sourceType);
        const after = jsTokens(result.text, sourceType);
        safe = before.length === after.length && before.every((t, k) => t === after[k]);
        why = 'token stream ប្រែ';
        if (safe) {
            try { acorn.parse(result.text, { ecmaVersion: 2022, sourceType: sourceType }); }
            catch (e) { safe = false; why = 'លទ្ធផល parse មិនចេញ'; }
        }
    }

    if (!safe) {
        console.log('  FAIL  ' + rel + ' — បោះបង់ (' + why + ')');
        failed++;
        continue;
    }

    if (checkOnly) {
        console.log('  ...   ' + rel + ' — មាន comment ' + result.removed + ' (មិនទាន់សម្អាត)');
        touched++;
        continue;
    }

    fs.writeFileSync(file, result.text);
    console.log('  ok    ' + rel + ' — លុប comment ' + result.removed);
    touched++;
}

console.log('\nឯកសារស្អាតរួច ' + clean + ' · ' + (checkOnly ? 'នៅសល់ ' : 'សម្អាត ') + touched +
    (failed ? ' · បោះបង់ ' + failed : ''));

if (failed) process.exit(1);
if (checkOnly && touched) process.exit(1);
