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
    check('fork មិនរត់លើ PC និង workflow មិនចាប់ self-hosted ពេល Public',
        audit.includes('github.event.repository.private == true')
        && audit.includes('github.event.pull_request.head.repo.full_name == github.repository')
        && apk.includes('github.event.repository.private == true'));
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
    check('Chromium ៖ system dependencies ក្នុង image ឬ GitHub step តែប៉ុណ្ណោះ',
        image.includes('install-deps chromium') && privileged.length === 1
        && privileged.every((step) => step.includes("if: vars.ZOE_RUNNER_MODE == 'github'"))
        && steps.some((step) => step.includes("if: vars.ZOE_RUNNER_MODE != 'github'")
            && step.includes('playwright install chromium') && !/\bsudo\b|--with-deps/.test(step)));
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
