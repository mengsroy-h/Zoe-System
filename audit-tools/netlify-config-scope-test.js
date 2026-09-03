const fs = require('fs');
const path = require('path');

// ថ្នាក់៖ **config របស់ Netlify ដែលផលិតកម្មអាន តែគ្មាន checker ណាមើល។**
//
// 🔴 រកឃើញពិត (2026-09-03, PR #150) ៖ agent របស់ Netlify បើក PR ដែល
// **បន្ថែម `netlify.toml` នៅ root** ដោយអះអាងថា «base setting ក្នុង
// netlify.toml របស់អ្នកខុស»។ ការអះអាងនោះមិនពិតទេ — គ្មានពាក្យ `base`
// ក្នុងឯកសារណាមួយ ហើយក៏គ្មាន root file ដែរ។
//
// ⛔ ហេតុអ្វីវាគ្រោះថ្នាក់ ៖ repo នេះ deploy ជា Netlify site **២**
// (`zoew` និង `zoekeygen`) ពីថតតែមួយ។ Netlify អាន `netlify.toml` នៅ
// **root** សម្រាប់ site ទាំង ២ ហើយ `netlify.toml` ឈ្នះលើការកំណត់ក្នុង UI
// ➜ `base = "ZoeKeyGen"` នៅ root បង្វែរ build របស់ **ZoeW** ទៅថតខុស។
// បូកនឹងនោះ CSP របស់ root file នោះគ្មាន `'wasm-unsafe-eval'` (ម៉ាស៊ីនស្កេន
// ZXing-WASM ស្លាប់) · គ្មាន `https://script.google.com` (Lookup API និង
// នាំចូល Excel ស្លាប់) · គ្មាន `functions = "netlify/functions"`
// (ZTO Function មិន deploy)។
//
// ⛔⛔ ហើយចំណុចធ្ងន់បំផុត ៖ **គ្មាន checker ណាឃើញវាទេ។** checker ដែលអាន
// netlify.toml (`csp-enforced` · `csp-lazy-resource` · `scan-engine` ·
// `offline-shell` · `sheet-import` · `zto-proxy`) សុទ្ធតែបើក
// `ZoeW/netlify.toml` ឬ `ZoeKeyGen/netlify.toml` **ដោយផ្លូវផ្ទាល់** ➜
// root file អាចបម្រើ CSP ខុសលើផលិតកម្ម ខណៈ `run-all.sh` បៃតងទាំងអស់។
//
// ដូច្នេះ checker នេះមិនត្រឹមចាក់សោ PR នោះទេ — វា **វាស់អថេរ** ៖
//   ១. សំណុំឯកសារ config ដែលមានពិត ត្រូវជាសំណុំដែល checker អាន
//   ២. គ្មាន config ណាអាចបង្វែរ build របស់ App មួយទៀត (`base`)
//   ៣. config របស់ App នីមួយៗ ត្រូវស៊ីនឹងអ្វីដែល App នោះ **ពិតជាត្រូវការ**
//      (ដេរីវេចេញពីឯកសារដែល ship ពិត — មិនមែន literal ក្នុង checker)
//
// ថត app អាច override បាន ដើម្បីឲ្យ `run-all.sh <baseline>` និង
// `checker-coverage.js` បញ្ជាក់បានថា checker នេះពិតជាអានឯកសារមែន។

const ROOT = process.env.NETLIFYSCOPE_APP_DIR ? path.resolve(process.env.NETLIFYSCOPE_APP_DIR) : path.join(__dirname, '..');
const TOOLS = __dirname;
const EXPECTED = ['ZoeKeyGen/netlify.toml', 'ZoeW/netlify.toml'];
const SKIP_DIRS = new Set(['node_modules', '.git', '.netlify', 'backups', 'secrets']);

let pass = 0;
let fail = 0;

function ok(label, condition, detail) {
    if (condition) {
        pass++;
        console.log('  ok    ' + label);
    } else {
        fail++;
        console.log('  FAIL  ' + label + (detail === undefined ? '' : '  ' + JSON.stringify(detail)));
    }
}

function walk(dir, rel, out) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return out; }
    entries.forEach((entry) => {
        if (entry.name.startsWith('.') && entry.name !== '.github') return;
        const abs = path.join(dir, entry.name);
        const next = rel ? rel + '/' + entry.name : entry.name;
        if (entry.isDirectory()) {
            if (SKIP_DIRS.has(entry.name)) return;
            walk(abs, next, out);
        } else if (entry.name === 'netlify.toml') {
            out.push(next);
        }
    });
    return out;
}

function read(rel) {
    try { return fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n?/g, '\n'); } catch (e) { return ''; }
}

function cspOf(toml) {
    const m = /Content-Security-Policy\s*=\s*"([^"]+)"/.exec(toml);
    return m ? m[1] : '';
}

function directive(csp, name) {
    const parts = csp.split(';').map((s) => s.trim()).filter(Boolean);
    const hit = parts.find((p) => p === name || p.indexOf(name + ' ') === 0);
    return hit ? hit.slice(name.length).trim() : '';
}

function hasWasm(app) {
    const found = [];
    (function scan(dir) {
        let entries;
        try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
        entries.forEach((entry) => {
            if (SKIP_DIRS.has(entry.name)) return;
            const abs = path.join(dir, entry.name);
            if (entry.isDirectory()) scan(abs);
            else if (entry.name.endsWith('.wasm')) found.push(abs);
        });
    })(path.join(ROOT, app));
    return found.length > 0;
}

console.log('netlify-config-scope — សំណុំ config របស់ Netlify ↔ អ្វីដែល App ត្រូវការ');
console.log('Root: ' + ROOT + '\n');

// ១ — សំណុំឯកសារ config ដែលមានពិត
const found = walk(ROOT, '', []).sort();
console.log('=== ១. សំណុំឯកសារ `netlify.toml` ក្នុង repo ===');

// ⛔ ជាន់អប្បបរមា ៖ ថតទទេ ➜ 0 ឯកសារ ➜ ធ្លាក់។ បើគ្មានជួរនេះ ការអះអាង
//    «គ្មាន root file» នឹងពិតដោយស្វ័យប្រវត្តិលើថតទទេ (បៃតងក្លែងក្លាយ)។
ok('⛔ ជាន់អប្បបរមា៖ រកឃើញ netlify.toml យ៉ាងតិច ' + EXPECTED.length,
    found.length >= EXPECTED.length, found);

ok('⛔ គ្មាន `netlify.toml` នៅ **root** — វាត្រូវអានសម្រាប់ site ទាំង ២ ➜ អាចបង្វែរ build របស់ App មួយទៀត',
    found.indexOf('netlify.toml') === -1, found);

ok('សំណុំ config ត្រូវជាសំណុំដែលរំពឹងទុក (មួយក្នុងមួយ App)',
    found.length === EXPECTED.length && EXPECTED.every((f) => found.indexOf(f) !== -1),
    { found: found, expected: EXPECTED });

// ២ — គ្មាន `base` ៖ វាឈ្នះលើការកំណត់ក្នុង Netlify UI
console.log('\n=== ២. គ្មាន `base` ក្នុង config ណាមួយ ===');
found.forEach((rel) => {
    const src = read(rel);
    ok(rel + ' ៖ គ្មានពាក្យ `base` (Base directory ជារបស់ Netlify UI ក្នុងមួយ site)',
        !/^\s*base\s*=/m.test(src));
});

// ៣ — ស្នាមភ្ជាប់ ៖ config ត្រូវស៊ីនឹងអ្វីដែល App **ពិតជាត្រូវការ**
//     ⛔ រាល់តម្រូវការដេរីវេចេញពីឯកសារដែល ship ពិត — មិនមែន literal ក្នុង checker
//     ➜ App ដែលមិនត្រូវការ មិនត្រូវបង្ខំ (ទិសផ្ទុយត្រូវរក្សា)។
console.log('\n=== ៣. config ↔ អ្វីដែល App ត្រូវការពិត (ដេរីវេ) ===');
let derived = 0;
EXPECTED.forEach((rel) => {
    const app = rel.split('/')[0];
    const src = read(rel);
    if (!src) { ok(rel + ' ៖ អានបាន', false); return; }
    const csp = cspOf(src);

    ok(app + ' ៖ មាន `publish`', /^\s*publish\s*=/m.test(src));
    ok(app + ' ៖ មាន header Content-Security-Policy', csp.indexOf('script-src') !== -1, csp.slice(0, 40));

    // ក. WASM ៖ App ដែល ship `.wasm` ត្រូវការ `'wasm-unsafe-eval'` និង Content-Type
    const wasm = hasWasm(app);
    if (wasm) {
        derived++;
        ok(app + ' ៖ ship `.wasm` ➜ CSP ត្រូវមាន `wasm-unsafe-eval`',
            directive(csp, 'script-src').indexOf("'wasm-unsafe-eval'") !== -1);
        ok(app + ' ៖ ship `.wasm` ➜ header `application/wasm`',
            /Content-Type\s*=\s*"application\/wasm"/.test(src));
    } else {
        // ⛔ ទិសផ្ទុយ ៖ App ដែលគ្មាន wasm **មិនត្រូវបង្ខំ** ឲ្យមានវាទេ
        ok(app + ' ៖ គ្មាន `.wasm` ➜ មិនបង្ខំ `wasm-unsafe-eval` (ទិសផ្ទុយ)', true);
    }

    // ខ. Netlify Function ៖ ថត functions មាន ➜ toml ត្រូវចង្អុលទៅវា
    const fnDir = path.join(ROOT, app, 'netlify', 'functions');
    let fnCount = 0;
    try { fnCount = fs.readdirSync(fnDir).filter((f) => f.endsWith('.js')).length; } catch (e) { fnCount = 0; }
    if (fnCount > 0) {
        derived++;
        const m = /^\s*functions\s*=\s*"([^"]+)"/m.exec(src);
        ok(app + ' ៖ មាន Function ' + fnCount + ' ➜ toml ត្រូវមាន `functions = `', !!m);
        if (m) {
            ok(app + ' ៖ `functions` ចង្អុលទៅថតដែលមានពិត',
                fs.existsSync(path.join(ROOT, app, m[1])), m[1]);
        }
    } else {
        ok(app + ' ៖ គ្មាន Function ➜ មិនបង្ខំ `functions` (ទិសផ្ទុយ)', true);
    }

    // គ. Apps Script ៖ ប្រអប់កំណត់ URL មាន ➜ connect-src ត្រូវអនុញ្ញាត host នោះ
    const html = read(app + '/index.html');
    if (html.indexOf('script.google.com') !== -1) {
        derived++;
        ok(app + ' ៖ index.html សុំ URL `script.google.com` ➜ `connect-src` ត្រូវអនុញ្ញាតវា',
            directive(csp, 'connect-src').indexOf('https://script.google.com') !== -1);
    } else {
        ok(app + ' ៖ គ្មានប្រអប់ Apps Script ➜ មិនបង្ខំ host នោះ (ទិសផ្ទុយ)', true);
    }
});

ok('⛔ ជាន់អប្បបរមា៖ តម្រូវការដេរីវេយ៉ាងតិច ៣ បានបាញ់ពិត', derived >= 3, derived);

// ៤ — meta ៖ រាល់ config ដែលផលិតកម្មអាន ត្រូវមាន checker អាន
//     នេះជាចន្លោះពិតដែល PR #150 បង្ហាញ ៖ ឯកសារ config ដែលគ្មានអ្នកវាស់។
console.log('\n=== ៤. រាល់ config ត្រូវមាន checker អានវា ===');
let toolSrc = '';
fs.readdirSync(TOOLS).filter((f) => f.endsWith('.js') && f !== path.basename(__filename))
    .forEach((f) => { try { toolSrc += fs.readFileSync(path.join(TOOLS, f), 'utf8'); } catch (e) {} });

ok('⛔ ជាន់អប្បបរមា៖ អាន source របស់ audit-tools បាន', toolSrc.length > 50000, toolSrc.length);

found.forEach((rel) => {
    const app = rel.split('/')[0];
    const referenced = rel === 'netlify.toml'
        ? false
        : toolSrc.indexOf(rel) !== -1 || (toolSrc.indexOf("'" + app + "'") !== -1 && toolSrc.indexOf("'netlify.toml'") !== -1);
    ok('config ' + rel + ' ៖ មាន checker យ៉ាងតិច ១ ដែលអានវា', referenced);
});

console.log('');
console.log(fail ? ('❌ ធ្លាក់ ' + fail + ' (ok ' + pass + ')') : ('✅ គ្មានបញ្ហា — ok ' + pass));
process.exit(fail ? 1 : 0);
