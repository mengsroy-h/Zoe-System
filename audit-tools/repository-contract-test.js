// អ្នកយាមស្នាមភ្ជាប់របស់ manifest, template និង config ដែល ship ពិត។
// សេវា Google/បណ្ដាញមិនត្រូវបានហៅ៖ វាស់កិច្ចសន្យាក្នុង repo តែប៉ុណ្ណោះ។
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const vm = require('vm');
const cp = require('child_process');
const { createRequire } = require('module');
const acorn = require('acorn');
const ROOT = path.resolve(process.env.REPOCONTRACT_APP_DIR || path.join(__dirname, '..'));
let pass = 0, fail = 0;
function check(label, condition, detail) {
    if (condition) { pass++; console.log('  ok    ' + label); }
    else { fail++; console.log('  FAIL  ' + label + (detail ? '\n        ' + detail : '')); }
}
function scenario(label, action) {
    try { action(); } catch (error) { check(label, false, error.message); }
}
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function json(rel) { return JSON.parse(read(rel)); }
function plain(value) { return JSON.parse(JSON.stringify(value)); }
function same(a, b) {
    if (a && b && typeof a === 'object' && typeof b === 'object') {
        const aa = Object.keys(a).sort(), bb = Object.keys(b).sort();
        return JSON.stringify(aa) === JSON.stringify(bb) && aa.every((k) => same(a[k], b[k]));
    }
    return a === b;
}
function nodes(source) {
    const found = [];
    (function visit(node) {
        if (!node || typeof node !== 'object') return;
        if (node.type) found.push(node);
        for (const value of Object.values(node)) {
            if (Array.isArray(value)) value.forEach(visit);
            else if (value && typeof value === 'object') visit(value);
        }
    })(acorn.parse(source, { ecmaVersion: 2022 }));
    return found;
}

scenario('Apps Script manifest អានបាន', () => {
    const manifest = json('zto-import/appsscript.json');
    const uses = new Set();
    for (const rel of ['zto-import/Code.gs', 'zto-import/Watch.gs']) {
        for (const node of nodes(read(rel))) {
            if (node.type === 'MemberExpression' && node.object.type === 'Identifier') uses.add(node.object.name);
        }
    }
    const services = {
        SpreadsheetApp: 'spreadsheets', DriveApp: 'drive', Drive: 'drive',
        ScriptApp: 'script.scriptapp', MailApp: 'script.send_mail'
    };
    const required = [...new Set(Object.keys(services).filter((name) => uses.has(name))
        .map((name) => 'https://www.googleapis.com/auth/' + services[name]))];
    check('Apps Script ៖ មានការប្រើសេវាពិតជាមូលដ្ឋាននៃ scopes', required.length >= 4);
    check('Apps Script ៖ scopes គ្របសេវាក្នុង Code.gs និង Watch.gs ដោយគ្មានសិទ្ធិលើស',
        Array.isArray(manifest.oauthScopes) && same([...manifest.oauthScopes].sort(), required.sort()));
    check('Apps Script ៖ កំណត់ V8 និងម៉ោងកម្ពុជា',
        manifest.runtimeVersion === 'V8' && manifest.timeZone === 'Asia/Phnom_Penh');
    const drive = (manifest.dependencies && manifest.dependencies.enabledAdvancedServices || [])
        .filter((service) => service.userSymbol === 'Drive');
    check('Apps Script ៖ Drive.Files.insert ប្រើ Drive API v2',
        uses.has('Drive') && drive.length === 1 && drive[0].serviceId === 'drive' && drive[0].version === 'v2');
    check('Apps Script ៖ webapp អនុវត្តជាម្ចាស់ deployment និងទទួល request របស់ App',
        manifest.webapp && manifest.webapp.executeAs === 'USER_DEPLOYING'
        && manifest.webapp.access === 'ANYONE_ANONYMOUS');
    check('Apps Script ៖ មានកំណត់ត្រា exception', manifest.exceptionLogging === 'STACKDRIVER');
});

scenario('CSV template ឆ្លង importer និង reader ពិត', () => {
    const XLSX = require(path.join(ROOT, 'ZoeW/vendor/xlsx.full.min.js'));
    const wb = XLSX.read(read('zto-import/google-sheets-api/customer-template.csv'), { type: 'string', raw: true });
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: '' });
    const importer = vm.createContext({});
    vm.runInContext(read('zto-import/Code.gs'), importer, { timeout: 3000 });
    check('CSV ៖ មាន header និងជួរឧទាហរណ៍ដែលមាន ៤ column',
        rows.length >= 2 && rows.every((row) => row.length === 4));
    check('CSV ៖ header ត្រូវនឹងលំដាប់ barcode/dod/cod/phone ដែល reader ប្រើ',
        same(plain(importer.detectMapping_(rows[0])), { barcode: 0, dod: 1, cod: 2, phone: 3 }));
    const records = plain(importer.normalizeRecords_(rows.slice(1))).records;
    check('CSV ៖ គ្មាន barcode ទទេ/ស្ទួន និងតម្លៃលុយមិនអវិជ្ជមាន', records.length === rows.length - 1
        && rows.slice(1).every((r) => typeof r[0] === 'string' && r[0].trim()
            && [r[1], r[2]].every((v) => String(v).trim() !== '' && Number.isFinite(Number(v)) && Number(v) >= 0)));
    check('CSV ៖ គំរូរក្សាលេខសូន្យនាំមុខទូរស័ព្ទ',
        records.some((r) => /^0\d{7,10}$/.test(r.phone))
        && records.every((r, i) => r.phone === rows[i + 1][3]));
    const api = vm.createContext({
        PropertiesService: { getScriptProperties: () => ({ getProperty: () => 'fixture-key' }) },
        SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: () => ({
            getLastRow: () => rows.length,
            getRange: () => ({ getValues: () => rows.slice(1) })
        }) }) },
        CacheService: { getScriptCache: () => ({ get: () => null, put() {}, remove() {} }) },
        Utilities: { newBlob: (value) => ({ getBytes: () => Array.from(Buffer.from(value)) }) },
        ContentService: { MimeType: { JSON: 'application/json' },
            createTextOutput: (value) => ({ value, setMimeType() { return this; } }) }
    });
    vm.runInContext(read('zto-import/google-sheets-api/Code.gs'), api, { timeout: 3000 });
    const result = JSON.parse(api.doGet({ parameter: { key: 'fixture-key', list: '1' } }).value);
    check('CSV ៖ API អាន template ហើយប្រគល់តម្លៃដូច importer', same(result.rows, records));
});

scenario('Firebase example config អានដោយ validator ពិត', () => {
    const config = json('firebase-backup/config.example.json');
    const moduleFile = path.join(ROOT, 'firebase-backup/backup.js');
    const source = read('firebase-backup/backup.js');
    const context = vm.createContext({ module: { exports: {} }, require: createRequire(moduleFile),
        process, console, Buffer, URL, __dirname: path.dirname(moduleFile), config });
    vm.runInContext(source, context, { timeout: 3000 });
    const backup = context.module.exports;
    backup.validateBusinesses(config, path.join(os.tmpdir(), 'zoe-example-validation'));
    check('Backup example ៖ business entries ឆ្លង validator ពិត', config.businesses.length >= 2);
    check('Backup example ៖ network defaults ត្រូវនឹងកូដពិត',
        same(plain(backup.networkOptions(config)), plain(backup.networkOptions({}))));
    for (const key of ['keepCount', 'lockStaleMs']) {
        const calls = nodes(source).filter((node) => node.type === 'CallExpression'
            && node.arguments.length === 5 && node.arguments[1].value === key);
        check('Backup example ៖ ' + key + ' មាន validator ជាក់លាក់ក្នុង main', calls.length === 1);
        if (calls.length === 1) {
            // យក call ពិតតាម key; ការប្តូរឈ្មោះ helper/config មិនបំបាក់ checker។
            const call = calls[0], input = call.arguments[0];
            const expression = source.slice(call.start, input.start) + '__contractConfig'
                + source.slice(input.end, call.end);
            context.__contractConfig = config;
            const actual = vm.runInContext(expression, context, { timeout: 3000 });
            context.__contractConfig = {};
            const fallback = vm.runInContext(expression, context, { timeout: 3000 });
            check('Backup example ៖ ' + key + ' ត្រូវនឹង default ពិត', actual === fallback);
        }
    }
    const firebaseTargets = config.businesses.filter((b) => b.type !== 'supabase');
    const supabaseTargets = config.businesses.filter((b) => b.type === 'supabase');
    check('Backup example ៖ សោទុកក្នុង secrets/ និងគ្មាន private key/secret key ក្នុង config',
        config.backupDir === './backups'
        && firebaseTargets.length >= 2 && firebaseTargets.every((b) => /^\.\/secrets\/[^/\\]+\.json$/.test(b.serviceAccountPath))
        && supabaseTargets.every((b) => /^\.\/secrets\/[^/\\]+\.key$/.test(b.secretKeyPath) && !('secretKey' in b))
        && !/PRIVATE KEY|private_key|client_secret|access_token|sb_secret_|service_role/.test(JSON.stringify(config)));
    check('Backup example ៖ មាន target Supabase (url ឆ្លង normalizeSupabaseUrl ពិត)', supabaseTargets.length >= 1
        && supabaseTargets.every((b) => { try { return !!require(path.join(ROOT, 'firebase-backup/supabase.js')).normalizeSupabaseUrl(b.url); } catch (e) { return false; } }));
});

scenario('npm lock ត្រូវនឹង package និង dependency graph', () => {
    const pkg = json('ZoeW/package.json'), lock = json('ZoeW/package-lock.json');
    const packages = lock.packages || {}, root = packages[''] || {};
    check('npm lock ៖ version 3 និងឈ្មោះ package ត្រឹមត្រូវ',
        lock.lockfileVersion === 3 && lock.name === pkg.name && root.name === pkg.name);
    for (const key of ['dependencies', 'devDependencies', 'optionalDependencies', 'engines']) {
        check('npm lock ៖ ' + key + ' ស៊ីគ្នានឹង package.json', same(root[key] || {}, pkg[key] || {}));
    }
    const entries = Object.entries(packages).filter(([name]) => name !== '');
    check('npm lock ៖ មាន dependency graph ពិត', entries.length > 0);
    const invalid = [], absent = [];
    for (const [name, item] of entries) {
        let url;
        try { url = new URL(item.resolved); } catch (_) {}
        const hash = /^sha512-([A-Za-z0-9+/]+={0,2})$/.exec(item.integrity || '');
        if (!name.startsWith('node_modules/') || name.includes('..') || item.link
            || !url || url.protocol !== 'https:' || url.hostname !== 'registry.npmjs.org'
            || url.username || url.password || !hash || Buffer.from(hash[1], 'base64').length !== 64
            || !/^\d+\.\d+\.\d+(?:[-+].+)?$/.test(item.version || '')) invalid.push(name);
    }
    function resolve(name, dependency) {
        let at = name;
        while (at) {
            const candidate = at + '/node_modules/' + dependency;
            if (packages[candidate]) return packages[candidate];
            const next = at.lastIndexOf('/node_modules/');
            at = next < 0 ? '' : at.slice(0, next);
        }
        return packages['node_modules/' + dependency];
    }
    for (const [name, item] of Object.entries(packages)) {
        for (const dependency of Object.keys(item.dependencies || {})) {
            if (!resolve(name, dependency) && !(item.optionalDependencies || {})[dependency]) absent.push(name + ' → ' + dependency);
        }
    }
    check('npm lock ៖ រាល់ tarball មាន registry HTTPS និង SHA-512 ពេញ', !invalid.length, invalid.join(' · '));
    check('npm lock ៖ រាល់ dependency មាន entry ដែល resolve បាន', !absent.length, absent.join(' · '));
    check('npm lock ៖ direct dependencies ប្រើកំណែ pin ដែល package ស្នើ',
        Object.entries(pkg.dependencies || {}).every(([name, version]) =>
            packages['node_modules/' + name] && packages['node_modules/' + name].version === version));
});

scenario('.gitignore ការពារសោ/ទិន្នន័យ ហើយអនុញ្ញាត config គំរូ', () => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'zoe-ignore-contract-'));
    try {
        cp.execFileSync('git', ['init', '--quiet', temp], { stdio: 'pipe', timeout: 10000 });
        fs.writeFileSync(path.join(temp, '.gitignore'), read('.gitignore'));
        const blocked = ['firebase-backup/config.json', 'firebase-backup/secrets/key.json',
            'firebase-backup/backups/data.json', 'firebase-backup/backup.log',
            'audit-tools/emu/real.rules.json', 'audit-tools/.tmp-poison-fixture.js',
            'audit-tools/emu/.tmp-poison-fixture.js', 'zto-import/.tmp-poison-fixture.js', 'node_modules/fixture.js'];
        const allowed = ['firebase-backup/config.example.json', 'ZoeW/package-lock.json',
            'audit-tools/new-guard.js', 'zto-import/appsscript.json'];
        const answer = cp.spawnSync('git', ['-C', temp, 'check-ignore', '--no-index', '--stdin'], {
            input: blocked.concat(allowed).join('\n') + '\n', encoding: 'utf8', timeout: 10000
        });
        const ignored = new Set((answer.stdout || '').trim().split(/\r?\n/));
        check('.gitignore ៖ sample សោ និង output ត្រូវបានរំលង',
            answer.status === 0 && blocked.every((name) => ignored.has(name)));
        check('.gitignore ៖ source/config គំរូ និង checker ថ្មីមិនត្រូវលាក់', allowed.every((name) => !ignored.has(name)));
    } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});

scenario('.gitattributes ៖ checkout លើ Windows (core.autocrlf=true) បានបៃតដូច Linux · .cmd/.bat រក្សា CRLF', () => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'zoe-eol-contract-'));
    const git = (args, cwd) => cp.execFileSync('git', args, { cwd: cwd || temp, stdio: 'pipe', timeout: 15000, encoding: 'utf8' });
    try {
        const src = path.join(temp, 'src');
        const win = path.join(temp, 'win');
        fs.mkdirSync(src);
        git(['init', '--quiet', src]);
        git(['config', 'core.autocrlf', 'false'], src);
        fs.writeFileSync(path.join(src, '.gitattributes'), read('.gitattributes'));
        fs.mkdirSync(path.join(src, 'res'));
        fs.writeFileSync(path.join(src, 'res', 'splash_icon.xml'), '<?xml version="1.0"?>\n<vector>\n</vector>\n');
        fs.writeFileSync(path.join(src, 'icon.svg'), '<svg>\n<path d="M0 0"/>\n</svg>\n');
        fs.writeFileSync(path.join(src, 'tool.cmd'), '@echo off\r\necho ok\r\n');
        fs.writeFileSync(path.join(src, 'gradlew.bat'), '@rem x\r\nexit /b 0\r\n');
        git(['add', '-A'], src);
        git(['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '--quiet', '-m', 'x'], src);
        git(['-c', 'core.autocrlf=true', 'clone', '--quiet', src, win]);
        const bytes = (rel) => fs.readFileSync(path.join(win, rel), 'latin1');
        check('.gitattributes ៖ Windows checkout ៖ XML/SVG នៅ LF (android-check ប្រៀបបៃតដូច Linux)',
            !bytes('res/splash_icon.xml').includes('\r') && !bytes('icon.svg').includes('\r'));
        check('.gitattributes ៖ Windows checkout ៖ .cmd/.bat នៅ CRLF ដដែល',
            /\r\n/.test(bytes('tool.cmd')) && /\r\n/.test(bytes('gradlew.bat')));
        const crlf = [];
        const walk = (dir) => {
            for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                if (['.git', 'node_modules', 'dist', 'dist-audit', '.original', 'build'].includes(entry.name)) continue;
                const full = path.join(dir, entry.name);
                if (entry.isDirectory()) walk(full);
                else if (entry.isFile() && fs.statSync(full).size < 2000000) {
                    const buf = fs.readFileSync(full);
                    if (!buf.includes(0) && buf.includes('\r\n')) crlf.push(path.relative(ROOT, full).split(path.sep).join('/'));
                }
            }
        };
        walk(ROOT);
        const attrs = crlf.length ? git(['check-attr', 'text', '--'].concat(crlf), src) : '';
        const converted = crlf.filter((rel) => !new RegExp('^' + rel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ': text: unset$', 'm').test(attrs));
        check('.gitattributes ៖ ឯកសារ CRLF ពិតក្នុង repo (' + crlf.length + ') ទាំងអស់ជា -text (មិនប្តូរ EOL)', crlf.length >= 1 && converted.length === 0,
            converted.join(' · '));
    } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});

scenario('ឧបករណ៍សម្អាតរក្សាតម្លៃកូដពិត', () => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'zoe-clean-contract-'));
    const options = { encoding: 'utf8', timeout: 10000, env: { ...process.env,
        NODE_PATH: [path.dirname(path.dirname(require.resolve('acorn/package.json'))), process.env.NODE_PATH]
            .filter(Boolean).join(path.delimiter) } };
    try {
        const file = path.join(temp, 'sample.js');
        const original = 'const value = `រក្សា  \nចន្លោះ`;  \nmodule.exports = value;  \n';
        fs.writeFileSync(file, original);
        let result = cp.spawnSync(process.execPath, [path.join(ROOT, 'audit-tools/trimws.js'), file],
            options);
        check('trimws ៖ មិនបាត់ចន្លោះក្នុង template literal',
            result.status === 0 && fs.readFileSync(file, 'utf8') === original);
        fs.writeFileSync(file, 'module.exports = "មានចន្លោះ  ";  \n');
        result = cp.spawnSync(process.execPath, [path.join(ROOT, 'audit-tools/trimws.js'), file],
            options);
        check('trimws ៖ សម្អាតតែ whitespace ក្រៅ string',
            result.status === 0 && fs.readFileSync(file, 'utf8') === 'module.exports = "មានចន្លោះ  ";\n');
        fs.writeFileSync(file, '// សម្គាល់\nmodule.exports = "/* មិនមែន comment */"; // ចុង\n');
        result = cp.spawnSync(process.execPath, [path.join(ROOT, 'audit-tools/strip-comments.js'), file],
            options);
        const cleaned = fs.readFileSync(file, 'utf8');
        check('strip-comments ៖ លុប comment ហើយរក្សា string ដដែល',
            result.status === 0 && !cleaned.includes('សម្គាល់') && !cleaned.includes('ចុង')
            && cleaned.includes('"/* មិនមែន comment */"'));
        // ZoeW React (`ts-comments.js`) ៖ TSX ពិត — directive `///` នៅដដែល · string/template រក្សា · `{/* */}` ក្នុង JSX ចេញ
        const tsx = path.join(temp, 'sample.tsx');
        fs.writeFileSync(tsx, '/// <reference lib="dom" />\n// សម្គាល់ TSX\nconst s: string = "// មិនមែន comment";\n'
            + 'const t = `/* រក្សា */`;\nexport const C = () => <div>{/* JSX សម្គាល់ */}<span>{s}{t}</span></div>;\n');
        result = cp.spawnSync(process.execPath, [path.join(ROOT, 'audit-tools/strip-comments.js'), tsx], options);
        const tsxOut = fs.readFileSync(tsx, 'utf8');
        check('strip-comments (TSX) ៖ លុប comment · រក្សា directive/string/template',
            result.status === 0 && !tsxOut.includes('សម្គាល់') && tsxOut.includes('/// <reference lib="dom" />')
            && tsxOut.includes('"// មិនមែន comment"') && tsxOut.includes('`/* រក្សា */`') && !tsxOut.includes('{}'),
            { status: result.status, out: tsxOut });
        // ⛔ ទិសផ្ទុយ ៖ comment ដែលផ្ទុកបន្ទាត់ថ្មីក្រោយ `return` ជា ASI ➜ ការលុបវាប្តូរកូដ ➜ ត្រូវបោះបង់ មិនប៉ះឯកសារ
        const asi = path.join(temp, 'asi.ts');
        const asiSrc = 'export function f(x: number) {\n    return /*\n    */ x;\n}\n';
        fs.writeFileSync(asi, asiSrc);
        result = cp.spawnSync(process.execPath, [path.join(ROOT, 'audit-tools/strip-comments.js'), asi], options);
        check('strip-comments (TS) ៖ ការលុបដែលប្តូរ compile ➜ បោះបង់ (exit ≠ 0) ហើយឯកសារនៅដដែល',
            result.status !== 0 && fs.readFileSync(asi, 'utf8') === asiSrc, { status: result.status });
        // Gradle ៖ slashy regex ដែលផ្ទុក `'` · URL `//` ក្នុង string · comment ក្រោយកូដ · block comment ➜ string/regex នៅដដែល
        const gradle = path.join(temp, 'build.gradle');
        fs.writeFileSync(gradle, '// សម្គាល់ Gradle\ndef m = (src =~ /V\\s*=\\s*\'(\\d+)\'/)\ndef u = "https://x.example/a" // ចុង\n'
            + '/* ប្លុក */\ndef n = 10 / 2\ndef r = (u =~ /https:\\/\\//)\n');
        result = cp.spawnSync(process.execPath, [path.join(ROOT, 'audit-tools/strip-comments.js'), gradle], options);
        const gradleOut = fs.readFileSync(gradle, 'utf8');
        check('strip-comments (Gradle) ៖ លុប comment · រក្សា slashy regex · URL ក្នុង string · ការចែក',
            result.status === 0 && !/សម្គាល់|ចុង|ប្លុក/.test(gradleOut) && gradleOut.includes("=~ /V\\s*=\\s*'(\\d+)'/)")
            && gradleOut.includes('"https://x.example/a"') && gradleOut.includes('10 / 2')
            && gradleOut.includes('=~ /https:\\/\\//)'), { status: result.status, out: gradleOut });
        const props = path.join(temp, 'gradle.properties');
        fs.writeFileSync(props, '# សម្គាល់\na=1 \\\n  # តម្លៃបន្ត\nb=2\n');
        result = cp.spawnSync(process.execPath, [path.join(ROOT, 'audit-tools/strip-comments.js'), props], options);
        const propsOut = fs.readFileSync(props, 'utf8');
        check('strip-comments (gradle.properties) ៖ លុប comment · ⛔ ជួរបន្ត (continuation) ដែលចាប់ផ្តើមដោយ # ជាតម្លៃ មិនមែន comment',
            result.status === 0 && !propsOut.includes('សម្គាល់') && propsOut.includes('# តម្លៃបន្ត') && propsOut.includes('b=2'), { out: propsOut });
        const generated = path.join(temp, 'capacitor.build.gradle');
        const generatedSrc = '// DO NOT EDIT THIS FILE! IT IS GENERATED EACH TIME "capacitor update" IS RUN\nandroid {}\n';
        fs.writeFileSync(generated, generatedSrc);
        result = cp.spawnSync(process.execPath, [path.join(ROOT, 'audit-tools/strip-comments.js'), generated], options);
        check('strip-comments (Gradle) ៖ ឯកសារដែល Capacitor សាងឡើងវិញ (header «DO NOT EDIT») មិនប៉ះ',
            result.status === 0 && fs.readFileSync(generated, 'utf8') === generatedSrc);
        const android = path.join(temp, 'android');
        const cordova = path.join(android, 'capacitor-cordova-android-plugins');
        const custom = path.join(android, 'app', 'capacitor-cordova-android-plugins');
        fs.mkdirSync(cordova, { recursive: true });
        fs.mkdirSync(custom, { recursive: true });
        fs.writeFileSync(path.join(android, 'build.gradle'), '// សម្គាល់របស់គម្រោង\n');
        fs.writeFileSync(path.join(cordova, 'build.gradle'), '// SUB-PROJECT DEPENDENCIES START\n');
        fs.writeFileSync(path.join(custom, 'build.gradle'), '// សម្គាល់របស់គម្រោង\n');
        const gradleFiles = require('./ts-comments').gradleShippedFiles(temp);
        check('Gradle ៖ មិនលុប marker ក្នុងថត Cordova ដែល cap sync បង្កើត',
            !gradleFiles.includes(path.join(cordova, 'build.gradle')));
        check('Gradle ៖ នៅតែវាស់ឯកសាររបស់គម្រោងក្រោយ cap sync',
            gradleFiles.includes(path.join(android, 'build.gradle')));
        check('Gradle ៖ មិនរំលងថតឈ្មោះដូចគ្នាក្រៅ root ដែល Capacitor បង្កើត',
            gradleFiles.includes(path.join(custom, 'build.gradle')));
    } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});

scenario('comment checker វាស់ root ដែលបានស្នើ និងមិនលាក់ parse error', () => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'zoe-comment-root-'));
    try {
        for (const app of ['ZoeW', 'ZoeKeyGen']) {
            fs.mkdirSync(path.join(temp, app));
            for (let i = 0; i < 3; i++) fs.writeFileSync(path.join(temp, app, 'fixture-' + i + '.js'), 'const value = 1;\n');
        }
        const run = () => cp.spawnSync(process.execPath, [path.join(__dirname, 'comments.js')], {
            cwd: ROOT, encoding: 'utf8', timeout: 10000,
            env: { ...process.env, COMMENTS_APP_DIR: temp }
        });
        let result = run();
        check('comments ៖ root ផ្សេងពី cwd ដែលស្អាតត្រូវឆ្លង', result.status === 0, result.stdout + result.stderr);
        const file = path.join(temp, 'ZoeW', 'fixture-0.js');
        fs.writeFileSync(file, '// សម្គាល់ដែលត្រូវចាប់\nconst value = 1;\n');
        result = run();
        check('comments ៖ ចាប់ comment ក្នុង root ដែលបានស្នើ', result.status === 1 && /comments=1/.test(result.stdout));
        fs.writeFileSync(file, 'const value = 1;\n');
        fs.writeFileSync(path.join(temp, 'ZoeW', 'components.js'), 'const value = ;\n');
        result = run();
        check('comments ៖ parse error ត្រូវធ្លាក់', result.status === 1 && /PARSE ERROR/.test(result.stdout));
    } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});

scenario('runner ៖ Linux audit និង Windows APK មាន mode ទាំងពីរ', () => {
    const audit = read('.github/workflows/audit.yml');
    const apk = read('.github/workflows/android-release.yml');
    const apkSteps = apk.match(/^      -[^\n]*(?:\n(?!      -)[^\n]*)*/gm) || [];
    const firstRun = apkSteps.find((step) => /^        run:/m.test(step));
    check('APK កំណត់ Git Bash មុន run step ផ្សេង ដោយ PowerShell របស់ Windows',
        !!firstRun && /^        shell: powershell$/m.test(firstRun)
        && firstRun.includes("Get-Command git -ErrorAction Stop")
        && firstRun.includes("Join-Path $gitRoot 'bin'")
        && firstRun.includes("Join-Path $gitBin 'bash.exe'")
        && firstRun.includes('Test-Path -LiteralPath $gitBash -PathType Leaf')
        && firstRun.includes('& $gitBash --version')
        && /\$gitBin \| Out-File -FilePath \$env:GITHUB_PATH -Encoding utf8 -Append/.test(firstRun));
    const bootstrapScript = ((firstRun || '').match(/^        run: \|\r?\n([\s\S]*)$/m) || [])[1] || '';
    const bootstrapMessage = ((firstRun || '').match(/^          ZOE_GIT_BASH_MISSING_MESSAGE: '([^'\r\n]*)'$/m) || [])[1] || '';
    check('Windows PowerShell អាន inline script បានដោយគ្មាន BOM និងសារខ្មែរនៅក្នុង env',
        bootstrapScript.trim().length > 0 && !/[^\x00-\x7f]/.test(bootstrapScript)
        && bootstrapMessage.includes('{0}') && /[\u1780-\u17ff]/.test(bootstrapMessage)
        && bootstrapScript.includes('throw ($env:ZOE_GIT_BASH_MISSING_MESSAGE -f $gitBash)'));
    const shellCheck = read('.github/workflows/android-shell-check.yml');
    check('Windows shell CI វាស់ bootstrap ពិត ដោយគ្មាន secrets ឬ Release',
        /contents:\s*read/.test(shellCheck) && /shell:\s*powershell/.test(shellCheck)
        && shellCheck.includes('github.event.pull_request.head.repo.full_name == github.repository')
        && shellCheck.includes('.github\\workflows\\android-release.yml')
        && shellCheck.includes('Management.Automation.Language.Parser]::ParseInput')
        && shellCheck.includes('legacy-encoding-mutation-survived')
        && shellCheck.includes('missing-Git-Bash-must-fail-with-path')
        && !/secrets\.|gh\s+release\s+create|assembleRelease/.test(shellCheck));
    const compose = read('tools/actions-runners/compose.yml');
    const image = read('tools/actions-runners/Dockerfile');
    const labels = (source, mode) => {
        const match = source.match(/runs-on:\s*\$\{\{\s*(.*?)\s*\}\}/);
        if (!match) return null;
        return vm.runInNewContext(match[1], { vars: { ZOE_RUNNER_MODE: mode }, fromJSON: JSON.parse });
    };
    check('audit ជ្រើស Linux pool ឬ GitHub និងអនុញ្ញាត shard ទាំង ៤ស្របគ្នា',
        same(labels(audit, 'self-hosted'), ['self-hosted', 'Linux', 'X64', 'wsl-zoe-audit'])
        && same(labels(audit, 'github'), ['ubuntu-latest'])
        && same(labels(audit, ''), ['self-hosted', 'Linux', 'X64', 'wsl-zoe-audit'])
        && same(labels(audit, 'invalid'), ['self-hosted', 'Linux', 'X64', 'wsl-zoe-audit'])
        && /shard:\s*\[1, 2, 3, 4\]/.test(audit) && /max-parallel:\s*4\b/.test(audit));
    const allowed = (source, mode, isPrivate, event = 'pull_request', sameRepo = true, ref = 'refs/heads/main') => {
        const match = source.match(/^    if: (.+)$/m);
        if (!match) return false;
        return vm.runInNewContext(match[1], { vars: { ZOE_RUNNER_MODE: mode }, github: {
            event_name: event, repository: 'owner/repo', ref,
            event: { repository: { private: isPrivate },
                pull_request: { draft: true, head: { repo: { full_name: sameRepo ? 'owner/repo' : 'fork/repo' } } } }
        } }) === true;
    };
    check('GitHub mode រត់ Public/Private និង Draft; self-hosted នៅតែទាមទារ Private',
        allowed(audit, 'github', false) && allowed(audit, 'github', true)
        && allowed(audit, 'self-hosted', true) && !allowed(audit, 'self-hosted', false)
        && !allowed(audit, '', false) && !allowed(audit, 'invalid', false)
        && allowed(apk, 'github', false, 'workflow_dispatch')
        && allowed(apk, 'self-hosted', true, 'workflow_dispatch')
        && !allowed(apk, 'self-hosted', false, 'workflow_dispatch'));
    check('fork មិនរត់ audit · APK ស្វ័យប្រវត្តិ (push) នៅ main តែប៉ុណ្ណោះ · branch ផ្សេង ➜ តែ «Run workflow» ដោយដៃ (APK សាក)',
        !allowed(audit, 'self-hosted', true, 'pull_request', false)
        && !allowed(audit, 'github', false, 'pull_request', false)
        && allowed(audit, 'github', false, 'push')
        && allowed(apk, 'github', false, 'push')
        && !allowed(apk, 'github', false, 'push', true, 'refs/heads/feature')
        && !allowed(apk, 'github', false, 'pull_request', true, 'refs/heads/feature')
        && allowed(apk, 'github', false, 'workflow_dispatch', true, 'refs/heads/feature')
        && allowed(apk, 'self-hosted', true, 'workflow_dispatch', true, 'refs/heads/feature')
        && !allowed(apk, 'self-hosted', false, 'workflow_dispatch', true, 'refs/heads/feature')
        && /^  push:\n    branches: \[main\]$/m.test(apk) && !/^  pull_request/m.test(apk));
    check('APK ជ្រើស Windows pool ឬ GitHub និងប្រើ Gradle/apksigner របស់ Windows',
        same(labels(apk, 'self-hosted'), ['self-hosted', 'Windows', 'X64', 'windows-zoe-android'])
        && same(labels(apk, 'github'), ['windows-latest'])
        && same(labels(apk, ''), ['self-hosted', 'Windows', 'X64', 'windows-zoe-android'])
        && apk.includes('gradlew.bat') && apk.includes('apksigner.bat')
        && apk.indexOf('actions/setup-node@') < apk.indexOf('VERSION=$(node')
        && apk.indexOf('android-actions/setup-android@') < apk.indexOf('gradlew.bat'));
    check('Linux container មាន home ដាច់ពីគ្នា និងគ្មាន host port/socket',
        [1, 2, 3, 4].every((n) => compose.includes('audit-' + n + '-home:/home/runner'))
        && !/network_mode\s*:|\bports\s*:|docker\.sock|privileged\s*:\s*true/.test(compose));
    const steps = audit.match(/^      -[^\n]*(?:\n(?!      -)[^\n]*)*/gm) || [];
    const privileged = steps.filter((step) => /\bsudo\b|--with-deps/.test(step));
    const setupRuntime = steps.filter((step) => /uses: actions\/setup-(node|java)@/.test(step));
    const nodeStep = setupRuntime.find((step) => step.includes('setup-node@')) || '';
    const installSteps = steps.filter((step) => /npm ci --prefix/.test(step));
    const installLocks = installSteps.map((step) => step.match(/npm ci --prefix (\S+)/)[1] + '/package-lock.json');
    const cacheLocks = (nodeStep.match(/cache-dependency-path: \|\n((?:            [^\n]+\n?)+)/) || ['', ''])[1]
        .trim().split(/\s+/).filter(Boolean);
    check('GitHub npm cache យោង lockfiles ដែល audit ដំឡើងពិតទាំងអស់',
        nodeStep.includes("if: vars.ZOE_RUNNER_MODE == 'github'") && /^          cache: npm$/m.test(nodeStep)
        && installLocks.length >= 3 && same(installLocks.slice().sort(), cacheLocks.slice().sort())
        && cacheLocks.every((file) => fs.existsSync(path.join(ROOT, file))));
    check('Audit និង APK ប្រើ npm ci + prefer-offline ដោយរក្សា lockfile validation',
        installSteps.length >= 3 && installSteps.every((step) => step.includes('--prefer-offline'))
        && /npm ci --prefix ZoeW --prefer-offline/.test(apk));
    check('self-hosted ប្រើ Node/Java ក្នុង image; setup downloads សម្រាប់ GitHub តែប៉ុណ្ណោះ',
        setupRuntime.length === 2 && setupRuntime.every((step) => step.includes("if: vars.ZOE_RUNNER_MODE == 'github'"))
        && image.includes('FROM node:24-') && image.includes('openjdk-21-jdk-headless')
        && steps.some((step) => step.includes("if: vars.ZOE_RUNNER_MODE != 'github'")
            && step.includes('java -version') && step.includes('process.versions.node') && step.includes('$GITHUB_ENV')));
    check('Chromium ៖ system dependencies ក្នុង image ឬ GitHub step តែប៉ុណ្ណោះ',
        image.includes('install-deps chromium') && privileged.length === 1
        && privileged.every((step) => step.includes("if: vars.ZOE_RUNNER_MODE == 'github'"))
        && steps.some((step) => step.includes("if: vars.ZOE_RUNNER_MODE != 'github'")
            && step.includes('prepare-audit-cache.sh chromium') && !/\bsudo\b|--with-deps/.test(step)));
});

scenario('APK សាក ៖ branch ផ្សេងពី main ➜ Pre-release តែមួយក្នុងមួយ commit · main ➜ Release ផ្លូវការ (script ពិតរបស់ workflow)', () => {
    const apk = read('.github/workflows/android-release.yml');
    const stepRun = (name) => {
        const step = (apk.match(/^      -[^\n]*(?:\n(?!      -)[^\n]*)*/gm) || []).find((st) => st.includes('- name: ' + name)) || '';
        const body = (step.match(/^        run: \|\n([\s\S]*)$/m) || [])[1] || '';
        return body.split('\n').map((line) => line.replace(/^          /, '')).join('\n');
    };
    const meta = stepRun('កំណែ និងស្លាក Release');
    const release = stepRun('បង្កើត GitHub Release');
    check('ស្រង់ step «កំណែ» និង «បង្កើត GitHub Release» ពី workflow ពិតបាន',
        meta.includes('GITHUB_OUTPUT') && release.includes('gh release create'), meta.slice(0, 80) + ' | ' + release.slice(0, 80));
    const bash = cp.spawnSync('bash', ['--version'], { encoding: 'utf8' });
    if (bash.status !== 0) { check('bash មានសម្រាប់រត់ script ពិត', false, String(bash.error || bash.stderr)); return; }
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'apk-test-mode-'));
    try {
        const bin = path.join(temp, 'bin');
        fs.mkdirSync(bin);
        fs.writeFileSync(path.join(bin, 'cygpath'), '#!/bin/sh\nwhile [ "${1#-}" != "$1" ]; do shift; done\nprintf \'%s\\n\' "$1"\n', { mode: 0o755 });
        fs.writeFileSync(path.join(bin, 'gh'), '#!/bin/sh\nif [ "$1 $2" = "release view" ]; then exit 1; fi\nif [ "$1 $2" = "release create" ]; then shift 2; for a in "$@"; do printf \'%s\\n\' "$a"; done > "$GH_LOG"; exit 0; fi\nexit 3\n', { mode: 0o755 });
        const run = (ref, refName) => {
            const work = fs.mkdtempSync(path.join(temp, 'w-'));
            fs.mkdirSync(path.join(work, 'ZoeW', 'src', 'core'), { recursive: true });
            fs.writeFileSync(path.join(work, 'ZoeW', 'src', 'core', 'version.ts'), "export const APP_VERSION = '9.8.7';\n");
            const out = path.join(work, 'out.txt');
            fs.writeFileSync(out, '');
            const env = { ...process.env, PATH: bin + path.delimiter + process.env.PATH, GITHUB_REF: ref, GITHUB_SHA: 'abcdef1234567890',
                GITHUB_OUTPUT: out, REF_NAME: refName, GH_LOG: path.join(work, 'gh.log'), GH_TOKEN: 'x' };
            const m = cp.spawnSync('bash', ['-eo', 'pipefail', '-c', meta], { cwd: work, env, encoding: 'utf8', timeout: 20000 });
            const outputs = {};
            fs.readFileSync(out, 'utf8').split('\n').filter(Boolean).forEach((line) => { const i = line.indexOf('='); outputs[line.slice(0, i)] = line.slice(i + 1); });
            const filled = release.replace(/\$\{\{\s*steps\.meta\.outputs\.(\w+)\s*\}\}/g, (_, k) => outputs[k] || '')
                .replace(/\$\{\{\s*github\.sha\s*\}\}/g, 'abcdef1234567890');
            fs.writeFileSync(path.join(work, 'apk-cert.txt'), 'CERT\n');
            if (outputs.file) {
                fs.writeFileSync(path.join(work, outputs.file), 'apk');
                fs.writeFileSync(path.join(work, outputs.file + '.sha256'), 'deadbeef  ' + outputs.file + '\n');
            }
            const r = cp.spawnSync('bash', ['-eo', 'pipefail', '-c', filled], { cwd: work, env, encoding: 'utf8', timeout: 20000 });
            const args = fs.existsSync(env.GH_LOG) ? fs.readFileSync(env.GH_LOG, 'utf8').split('\n').filter(Boolean) : [];
            const notes = fs.existsSync(path.join(work, 'notes.md')) ? fs.readFileSync(path.join(work, 'notes.md'), 'utf8') : '';
            return { meta: m, rel: r, outputs, args, notes, pwned: fs.existsSync(path.join(work, 'pwned')) };
        };
        const test = run('refs/heads/feature', 'feature');
        check('branch ផ្សេង ➜ test=true · ស្លាក/ឯកសារមាន «-test.<commit ៧ តួ>»',
            test.meta.status === 0 && test.outputs.test === 'true' && test.outputs.tag === 'zoew-android-v9.8.7-test.abcdef1'
            && test.outputs.file === 'ZoeW-9.8.7-test.abcdef1.apk' && test.outputs.exists === 'false',
            JSON.stringify(test.outputs) + ' ' + test.meta.stderr);
        check('branch ផ្សេង ➜ `gh release create` ជា --prerelease លើស្លាក test · កំណត់ចំណាំប្រាប់ «APK សាក» + branch',
            test.rel.status === 0 && test.args[0] === 'zoew-android-v9.8.7-test.abcdef1' && test.args.includes('--prerelease')
            && test.args.includes('ZoeW-9.8.7-test.abcdef1.apk') && /APK សាក/.test(test.notes) && test.notes.includes('`feature`')
            && test.notes.includes('deadbeef'),
            JSON.stringify(test.args) + ' ' + test.rel.stderr);
        const main = run('refs/heads/main', 'main');
        check('main ➜ Release ផ្លូវការ (គ្មាន --prerelease · ស្លាក/ឯកសារដូចដើម · គ្មានសារ «APK សាក»)',
            main.meta.status === 0 && main.rel.status === 0 && main.outputs.test === 'false' && main.outputs.tag === 'zoew-android-v9.8.7'
            && main.outputs.file === 'ZoeW-9.8.7.apk' && main.args[0] === 'zoew-android-v9.8.7' && !main.args.includes('--prerelease')
            && !/APK សាក/.test(main.notes) && main.notes.includes('deadbeef'),
            JSON.stringify(main.outputs) + ' ' + JSON.stringify(main.args) + ' ' + main.rel.stderr);
        const evil = run('refs/heads/x', 'x$(touch pwned)`touch pwned`');
        check('ឈ្មោះ branch ចូលតាម env (មិនរត់ជា shell)', evil.rel.status === 0 && !evil.pwned && evil.notes.includes('$(touch pwned)'),
            evil.rel.stderr);
        check('ឈ្មោះ branch មិនដែលចូល script តាម `${{ github.ref_name }}` ផ្ទាល់', !/run: \|[\s\S]*?\$\{\{\s*github\.(ref_name|head_ref)/.test(apk.replace(/REF_NAME: \$\{\{ github\.ref_name \}\}/g, '')));
    } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});

scenario('runner៖ workers ខាងក្នុងសមនឹង CPU quota ដោយរក្សា shards ទាំង៤', () => {
    const audit = read('.github/workflows/audit.yml');
    const compose = read('tools/actions-runners/compose.yml');
    const cpu = Number((compose.match(/cpus:\s*([\d.]+)/) || [])[1]);
    const values = ['MONEYGUARD_JOBS', 'ZOEWSUITE_TEST_WORKERS'].map((name) => {
        const match = audit.match(new RegExp('^\\s+' + name + ': \\$\\{\\{ (.*?) \\}\\}', 'm'));
        return match ? ['self-hosted', '', 'invalid', 'github'].map((mode) =>
            vm.runInNewContext(match[1], { vars: { ZOE_RUNNER_MODE: mode } })) : [];
    });
    check('self-hosted កំណត់ workers តាម CPU quota; GitHub រក្សា auto',
        cpu >= 1 && values.every((result) => result.length === 4
            && result.slice(0, 3).every((value) => Number(value) === cpu) && result[3] === 'auto'));
});

scenario('workers Vitest៖ zoew-suite ផ្ញើ CLI flag ពិត និងមិនប្ដូរ steps ផ្សេង', () => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'zoe-suite-workers-'));
    const app = path.join(temp, 'ZoeW');
    try {
        for (const dir of ['src', 'node_modules/vite', 'node_modules/typescript', '.original/ZoeW']) fs.mkdirSync(path.join(app, dir), { recursive: true });
        fs.writeFileSync(path.join(app, 'src/main.tsx'), '');
        fs.writeFileSync(path.join(app, '.original/ZoeW/app.js'), '');
        fs.writeFileSync(path.join(app, 'package.json'), JSON.stringify(json('ZoeW/package.json')));
        const invoke = (workers) => {
            const calls = [], env = { ZOEWSUITE_APP_DIR: temp };
            if (workers !== undefined) env.ZOEWSUITE_TEST_WORKERS = workers;
            const processFake = { env, argv: ['node', 'zoew-suite-test.js'], exitCode: 1 };
            const requireReal = createRequire(path.join(ROOT, 'audit-tools/zoew-suite-test.js'));
            vm.runInNewContext(read('audit-tools/zoew-suite-test.js'), {
                __dirname: path.join(ROOT, 'audit-tools'), process: processFake, console: { log() {} },
                require: (name) => name === 'child_process' ? { spawnSync: (command, args) => {
                    calls.push({ command, args: Array.from(args) }); return { status: 0, stdout: '', stderr: '' };
                } } : requireReal(name)
            });
            return { calls, code: processFake.exitCode };
        };
        const capped = invoke('2'), automatic = invoke('auto'), missing = invoke(undefined);
        const testArgs = (result) => (result.calls.find((call) => call.command === 'npm' && call.args[2] === 'test') || {}).args;
        check('Vitest ទទួល --maxWorkers=2 តែ test step', capped.code === 0 && capped.calls.length >= 10
            && same(testArgs(capped), ['run', '-s', 'test', '--', '--maxWorkers=2'])
            && capped.calls.filter((call) => call.args[2] !== 'test').every((call) => call.args.length === 3));
        check('auto/មិនកំណត់ នៅប្រើ Vitest defaults ដើម', automatic.code === 0 && missing.code === 0
            && same(testArgs(automatic), ['run', '-s', 'test']) && same(testArgs(missing), ['run', '-s', 'test']));
        check('worker value ខុស មិនបៃតងដោយស្ងាត់', invoke('0').code !== 0 && invoke('lots').code !== 0);
    } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});

scenario('runtime ក្នុង Linux image៖ កំណែខុសឬ Java បាត់ ត្រូវបដិសេធមុន download', () => {
    const steps = read('.github/workflows/audit.yml').match(/^      -[^\n]*(?:\n(?!      -)[^\n]*)*/gm) || [];
    const step = steps.find((item) => item.includes("if: vars.ZOE_RUNNER_MODE != 'github'") && item.includes('$GITHUB_ENV'));
    check('runtime preflight មាន Bash script ពិតក្នុង workflow', !!step && /        run: \|/.test(step || ''));
    if (!step) return;
    const script = step.slice(step.indexOf('        run: |') + '        run: |'.length).trimStart()
        .split('\n').map((line) => line.replace(/^          /, '')).join('\n');
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'zoe-image-runtime-'));
    const bin = path.join(temp, 'bin'), envFile = path.join(temp, 'github-env');
    fs.mkdirSync(bin);
    try {
        const write = (name, body) => {
            const target = path.join(bin, name);
            fs.writeFileSync(target, '#!' + process.execPath + '\n' + body + '\n');
            fs.chmodSync(target, 0o755);
        };
        write('node', 'require("vm").runInNewContext(process.argv[3],{process:{versions:{node:process.env.ZOE_FIXTURE_NODE+".0.0"},exit:code=>process.exit(code)}});');
        write('java', 'if(process.env.ZOE_FIXTURE_JAVA==="missing")process.exit(127);console.error("openjdk version \\\""+process.env.ZOE_FIXTURE_JAVA+".0.0\\\"");');
        write('javac', 'console.log("javac "+process.env.ZOE_FIXTURE_JAVA+".0.0");');
        const run = (node = '24', java = '21') => {
            fs.writeFileSync(envFile, '');
            return cp.spawnSync('bash', ['-e', '-o', 'pipefail', '-c', script], {
                cwd: ROOT, encoding: 'utf8', timeout: 10000,
                env: { ...process.env, PATH: bin + path.delimiter + process.env.PATH,
                    GITHUB_ENV: envFile, ZOE_FIXTURE_NODE: node, ZOE_FIXTURE_JAVA: java }
            });
        };
        const valid = run();
        check('Node 24 + Java/Javac 21 ឆ្លង និង JAVA_HOME ផ្ដល់ឱ្យ step បន្ទាប់',
            valid.status === 0 && fs.readFileSync(envFile, 'utf8').includes('JAVA_HOME=' + temp), valid.stdout + valid.stderr);
        check('Node 22 ត្រូវបដិសេធ', run('22').status !== 0);
        check('Java 17 ត្រូវបដិសេធ', run('24', '17').status !== 0);
        check('Java រកមិនឃើញ ត្រូវបដិសេធ', run('24', 'missing').status !== 0);
    } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});

scenario('audit cache ៖ ទាញម្ដង · ផ្ទៀង checksum · មិនលាយ workspace', () => {
    const audit = read('.github/workflows/audit.yml');
    const compose = read('tools/actions-runners/compose.yml');
    const script = path.join(ROOT, 'tools/actions-runners/prepare-audit-cache.sh');
    check('runner ទាំង ៤ mount binary cache រួម និង workflow ត្រៀមមុនទាញ',
        (compose.match(/audit-binaries:\/opt\/zoe-cache/g) || []).length === 4
        && audit.includes('bash tools/actions-runners/prepare-audit-cache.sh init')
        && audit.indexOf('prepare-audit-cache.sh init') < audit.indexOf('PW_VERSION=')
        && audit.includes('bash tools/actions-runners/prepare-audit-cache.sh chromium')
        && audit.includes('bash tools/actions-runners/prepare-audit-cache.sh database')
        && /JAR=\$\{ZOE_RTDB_JAR:\?/.test(audit));
    check('មាន helper សម្រាប់វាស់ការទាញពិតជាមួយ fixture', fs.existsSync(script));
    if (!fs.existsSync(script)) return;
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'zoe shared cache '));
    try {
        const home = path.join(temp, 'home'), cache = path.join(temp, 'shared'), bin = path.join(temp, 'bin');
        const moduleDir = path.join(temp, 'tools/firebase-provision/node_modules/firebase-tools');
        const log = path.join(temp, 'downloads.jsonl'), envFile = path.join(temp, 'github-env');
        for (const dir of [home, cache, bin, path.join(moduleDir, 'lib/emulator')]) fs.mkdirSync(dir, { recursive: true });
        const payload = 'fixture emulator bytes', filename = 'firebase-database-emulator-v1.jar';
        const checksum = require('crypto').createHash('sha256').update(payload).digest('hex');
        fs.writeFileSync(path.join(moduleDir, 'lib/emulator/downloadableEmulatorInfo.json'), JSON.stringify({ database: {
            version: '1', expectedSize: Buffer.byteLength(payload), expectedChecksumSHA256: checksum,
            downloadPathRelativeToCacheDir: filename
        } }));
        fs.writeFileSync(path.join(temp, 'tools/firebase-provision/package-lock.json'), JSON.stringify({ packages: {
            'node_modules/firebase-tools': { version: 'fixture' }
        } }));
        const executable = (file, source) => { fs.writeFileSync(file, '#!' + process.execPath + '\n' + source); fs.chmodSync(file, 0o755); };
        executable(path.join(bin, 'npx'), 'const fs=require("fs"),path=require("path");'
            + 'const log=process.env.CACHE_FIXTURE_LOG,p=path.join(process.env.PLAYWRIGHT_BROWSERS_PATH,"chromium-1");'
            + 'fs.appendFileSync(log,JSON.stringify({event:"browser-start"})+"\\n");'
            + 'setTimeout(()=>{if(process.env.CACHE_FIXTURE_FAIL)process.exit(17);'
            + 'if(!fs.existsSync(path.join(p,"INSTALLATION_COMPLETE"))){fs.mkdirSync(p,{recursive:true});'
            + 'fs.writeFileSync(path.join(p,"INSTALLATION_COMPLETE"),"");'
            + 'fs.appendFileSync(log,JSON.stringify({event:"browser-download"})+"\\n");}'
            + 'fs.appendFileSync(log,JSON.stringify({event:"browser-end"})+"\\n");},80);');
        const cli = path.join(temp, 'tools/firebase-provision/node_modules/.bin/firebase');
        fs.mkdirSync(path.dirname(cli), { recursive: true });
        executable(cli, 'const fs=require("fs"),path=require("path");'
            + 'fs.appendFileSync(process.env.CACHE_FIXTURE_LOG,JSON.stringify({event:"database-download"})+"\\n");'
            + 'if(process.env.CACHE_FIXTURE_FAIL)process.exit(17);'
            + 'fs.mkdirSync(process.env.FIREBASE_EMULATORS_PATH,{recursive:true});'
            + 'fs.writeFileSync(path.join(process.env.FIREBASE_EMULATORS_PATH,' + JSON.stringify(filename) + '),'
            + JSON.stringify(payload) + ');');
        let env = { ...process.env, HOME: home, ZOE_AUDIT_CACHE: cache, GITHUB_ENV: envFile,
            PATH: bin + path.delimiter + process.env.PATH, CACHE_FIXTURE_LOG: log };
        delete env.PLAYWRIGHT_BROWSERS_PATH; delete env.FIREBASE_EMULATORS_PATH;
        const run = (mode, extra = {}) => cp.spawnSync('bash', [script, mode], {
            cwd: temp, encoding: 'utf8', timeout: 10000, env: { ...env, ...extra }
        });
        const unconfigured = run('init', { ZOE_AUDIT_CACHE: '' });
        check('image ចាស់គ្មាន cache config ត្រូវឈប់មុន download និងប្រាប់វិធី update',
            unconfigured.status === 1 && /audit-binaries/.test(unconfigured.stderr));
        const complete = path.join(home, '.cache/ms-playwright/chromium-2');
        fs.mkdirSync(complete, { recursive: true }); fs.writeFileSync(path.join(complete, 'INSTALLATION_COMPLETE'), '');
        fs.mkdirSync(path.join(home, '.cache/ms-playwright/chromium-3'), { recursive: true });
        let result = run('init');
        check('init reuse browser ទាញរួច និងមិនយក browser ទាញមិនចប់', result.status === 0
            && fs.existsSync(path.join(cache, 'ms-playwright/chromium-2/INSTALLATION_COMPLETE'))
            && !fs.existsSync(path.join(cache, 'ms-playwright/chromium-3')), result.stdout + result.stderr);
        if (result.status !== 0) return;
        for (const line of fs.readFileSync(envFile, 'utf8').trim().split('\n')) {
            const at = line.indexOf('='); env[line.slice(0, at)] = line.slice(at + 1);
        }
        const parallel = (mode) => cp.spawnSync(process.execPath, ['-e',
            'const cp=require("child_process"),fs=require("fs"),s=JSON.parse(fs.readFileSync(0,"utf8"));'
            + 'Promise.all(Array.from({length:4},()=>new Promise(resolve=>{'
            + 'const p=cp.spawn("bash",[s.script,s.mode],{cwd:s.cwd,env:s.env,stdio:"ignore"});'
            + 'p.on("error",()=>resolve(1));p.on("exit",code=>resolve(code));})))'
            + '.then(codes=>process.exit(codes.every(c=>c===0)?0:1));'], {
            input: JSON.stringify({ script, mode, cwd: temp, env }), encoding: 'utf8', timeout: 12000
        });
        const events = () => fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse) : [];
        result = parallel('chromium');
        let active = 0, peak = 0;
        for (const e of events()) { if (e.event === 'browser-start') peak = Math.max(peak, ++active); if (e.event === 'browser-end') active--; }
        check('Chromium ៖ runner ៤មិនទាញជាន់គ្នា ហើយ cache បាត់ទាញម្ដង', result.status === 0
            && peak === 1 && active === 0 && events().filter(e => e.event === 'browser-download').length === 1);
        const jar = path.join(env.FIREBASE_EMULATORS_PATH, filename);
        fs.mkdirSync(path.dirname(jar), { recursive: true }); fs.writeFileSync(jar, 'ខូច');
        result = parallel('database');
        check('RTDB ៖ cache ខូចទាញជួសជុលម្ដងសម្រាប់ runner ៤', result.status === 0
            && events().filter(e => e.event === 'database-download').length === 1
            && fs.readFileSync(jar, 'utf8') === payload);
        result = run('database');
        check('RTDB ៖ cache ត្រូវ checksum មិនទាញម្ដងទៀត និងប្រើ JAR កំណែពិត', result.status === 0
            && events().filter(e => e.event === 'database-download').length === 1
            && fs.readFileSync(envFile, 'utf8').includes('ZOE_RTDB_JAR=' + jar));
        fs.rmSync(jar);
        const oldJar = path.join(home, '.cache/firebase/emulators', filename);
        fs.mkdirSync(path.dirname(oldJar), { recursive: true }); fs.writeFileSync(oldJar, payload);
        result = run('database');
        check('RTDB ៖ reuse JAR ចាស់ដែល checksum ត្រូវ ដោយគ្មាន download', result.status === 0
            && fs.readFileSync(jar, 'utf8') === payload
            && events().filter(e => e.event === 'database-download').length === 1);
        const otherJar = path.join(cache, 'firebase-legacy/other-runner', filename);
        fs.mkdirSync(path.dirname(otherJar), { recursive: true }); fs.writeFileSync(otherJar, payload);
        fs.rmSync(oldJar); fs.rmSync(jar);
        result = run('database');
        check('RTDB ៖ reuse JAR ដែល runner ផ្សេង seed ទុកក្នុង shared cache', result.status === 0
            && fs.readFileSync(jar, 'utf8') === payload
            && events().filter(e => e.event === 'database-download').length === 1);
        fs.rmSync(otherJar); fs.writeFileSync(jar, payload.slice(0, -1) + 'x');
        result = run('database', { CACHE_FIXTURE_FAIL: '1' });
        check('RTDB ៖ checksum ខុសទោះទំហំដូចគ្នា និង download fail ត្រូវធ្លាក់', result.status === 17,
            result.stdout + result.stderr);
        check('Chromium ៖ install fail ត្រូវធ្លាក់', run('chromium', { CACHE_FIXTURE_FAIL: '1' }).status === 17);
        fs.writeFileSync(oldJar, payload);
        result = run('database', { ZOE_AUDIT_CACHE: '', FIREBASE_EMULATORS_PATH: '' });
        check('GitHub mode ប្រើ home cache និង JAR ពិត ដោយមិនទាមទារ Docker volume', result.status === 0
            && fs.readFileSync(envFile, 'utf8').includes('ZOE_RTDB_JAR=' + oldJar)
            && events().filter(e => e.event === 'database-download').length === 2);
    } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});

scenario('registration script ៖ ៤ runner · token លាក់ពី argv · បញ្ឈប់ពេលខុស', () => {
    const script = path.join(ROOT, 'tools/actions-runners/register.sh');
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'zoe-runner-register-'));
    const log = path.join(temp, 'calls.jsonl');
    try {
        const docker = path.join(temp, 'docker');
        fs.writeFileSync(docker, '#!' + process.execPath + '\n'
            + 'const fs=require("fs"),args=process.argv.slice(2);'
            + 'if(args.includes("run")){const input=fs.readFileSync(0,"utf8");'
            + 'fs.appendFileSync(process.env.ZOE_RUNNER_FIXTURE_LOG,JSON.stringify({args,input})+"\\n");'
            + 'if(process.env.ZOE_RUNNER_FIXTURE_FAIL && args.includes(process.env.ZOE_RUNNER_FIXTURE_FAIL)) process.exit(17);}\n');
        fs.chmodSync(docker, 0o755);
        const run = (stopAt = '') => cp.spawnSync('bash', [script], {
            cwd: ROOT, input: 'fixture-registration-token\n', encoding: 'utf8', timeout: 10000,
            env: { ...process.env, PATH: temp + path.delimiter + process.env.PATH,
                ZOE_RUNNER_FIXTURE_LOG: log, ZOE_RUNNER_FIXTURE_FAIL: stopAt }
        });
        const calls = () => fs.readFileSync(log, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
        let result = run();
        let recorded = fs.existsSync(log) ? calls() : [];
        check('register ៖ លំដាប់ runner ៤ មិនស្ទួន ហើយ exit 0', result.status === 0
            && same(recorded.map((c) => c.args.find((a) => /^audit-[1-4]$/.test(a))),
                ['audit-1', 'audit-2', 'audit-3', 'audit-4']), result.stdout + result.stderr);
        check('register ៖ token ឆ្លង stdin ប៉ុណ្ណោះ និងមិនលេចក្នុង output', recorded.length === 4
            && recorded.every((c) => c.input === 'fixture-registration-token\n'
                && !c.args.join(' ').includes('fixture-registration-token'))
            && !(result.stdout + result.stderr).includes('fixture-registration-token'));
        if (fs.existsSync(log)) fs.rmSync(log);
        result = run('audit-2');
        recorded = fs.existsSync(log) ? calls() : [];
        check('register ៖ Docker ខុស ➜ exit ដើម និងមិន register runner បន្ទាប់',
            result.status === 17 && recorded.length === 2, result.stdout + result.stderr);
    } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});

console.log('\n' + pass + ' ok, ' + fail + ' FAIL');
process.exit(fail ? 1 : 0);
