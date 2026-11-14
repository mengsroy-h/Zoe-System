// ⛔ ZoeW អានឯកសារ Excel ដែលអ្នកប្រើជ្រើសរើស ដូច្នេះ SheetJS មិនមែនជា
// dependency សម្រាប់ export តែមួយទេ។ កំណែ 0.18.5 រង CVE-2023-30533
// (Prototype Pollution) និង CVE-2024-22363 (ReDoS)។ កំណែដែលជួសជុល ReDoS
// ចាប់ពី 0.20.2 ហើយ release ផ្លូវការមកពី cdn.sheetjs.com មិនមែន npm ចាស់។
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const vm = require('vm');

const ROOT = process.env.DEPSEC_APP_DIR ? path.resolve(process.env.DEPSEC_APP_DIR) : path.resolve(__dirname, '../..');
const VENDOR = path.join(ROOT, 'ZoeW', 'vendor', 'xlsx.full.min.js');
const IMPORT_HTML = path.join(ROOT, 'tools/zto-import', 'Index.html');
const APPROVED_XLSX_SHA256 = 'cc015130aa8521e7f088f88898eba949ccdcbfb38df0bd129b44b7273c3a6f41';
const APPROVED_XLSX_SHA384 = 'sha384-EnyY0/GSHQGSxSgMwaIPzSESbqoOLSexfnSMN2AP+39Ckmn92stwABZynq1JyzdT';

let pass = 0, fail = 0;
function ok(label, cond, detail) {
    if (cond) { console.log('   ok    ' + label); pass++; }
    else { console.log('   FAIL  ' + label + (detail !== undefined ? '  ➜ ' + JSON.stringify(detail) : '')); fail++; }
}

const packageLockPath = path.join(ROOT, 'ZoeW', 'package-lock.json');
let packageLock = null;
try { packageLock = JSON.parse(fs.readFileSync(packageLockPath, 'utf8')); } catch (e) {}
for (const [name, floor] of [['source-map-js', '1.2.2'], ['@grpc/grpc-js', '1.13.6'], ['happy-dom', '21.0.4'], ['vite', '8.3.5'], ['vitest', '5.0.5'], ['zod', '4.6.6']]) {
    const versions = Object.entries(packageLock && packageLock.packages || {})
        .filter(([rel]) => rel.endsWith('/' + name)).map(([, value]) => value.version);
    ok('⛔ dependency ' + name + ' ៖ lockfile មាន និងគ្រប់កំណែដល់ patch សុវត្ថិភាព',
        versions.length > 0 && versions.every((version) => versionAtLeast(version, floor)), versions);
}

const re2Versions = Object.entries(packageLock && packageLock.packages || {})
    .filter(([rel]) => rel.endsWith('/re2js')).map(([, value]) => value.version);
ok('⛔ re2js ដែល Firestore SDK ទាញមកដល់ patch សុវត្ថិភាព',
    re2Versions.length > 0 && re2Versions.every(version => versionAtLeast(version, '2.8.7')), re2Versions);

let provisionLock = null;
try { provisionLock = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'firebase-provision', 'package-lock.json'), 'utf8')); } catch (e) {}
for (const [label, lock] of [['ZoeW', packageLock], ['Firebase Provision', provisionLock]]) {
    for (const [name, lower, fixed] of [['glob', '9.0.0', '14.0.2'], ['minimatch', '7.0.0', '11.0.1']]) {
        const versions = Object.entries(lock && lock.packages || {})
            .filter(([rel]) => rel.endsWith('/' + name)).map(([, value]) => value.version);
        ok('⛔ ' + label + ' ៖ ' + name + ' គ្មានកំណែក្នុងជួរដែលរង DoS',
            versions.length > 0 && versions.every(version => /^\d+\.\d+\.\d+$/.test(String(version))
                && (!versionAtLeast(version, lower) || versionAtLeast(version, fixed))), versions);
    }
}
// basic-ftp was removed from the current official CLI graph. Absence is safe only
// when the selected graph has no demand; available installed versions add vetoes.
function basicFtpFloor(lock, manifest, installed) {
    const object = value => !!value && typeof value === 'object' && !Array.isArray(value);
    const fields = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'];
    const declarationsValid = value => fields.every(field => value[field] === undefined || object(value[field])
        && Object.values(value[field]).every(spec => typeof spec === 'string'));
    if (!object(lock) || ![2, 3].includes(lock.lockfileVersion) || !object(lock.packages)
        || !object(lock.packages['']) || lock.dependencies !== undefined && !object(lock.dependencies)
        || !object(manifest) || !Array.isArray(installed)
        || !declarationsValid(manifest) || manifest.overrides !== undefined && !object(manifest.overrides)
        || Object.values(lock.packages).some(value => !object(value) || !declarationsValid(value))) return false;
    const versions = Object.entries(lock.packages).filter(([rel, value]) => rel.endsWith('/basic-ftp') || value.name === 'basic-ftp')
        .map(([, value]) => value.version);
    if (!installed.every(version => versionAtLeast(version, '6.2.1'))) return false;
    if (versions.length) return versions.every(version => versionAtLeast(version, '6.2.1'));
    const alias = spec => typeof spec === 'string' && spec.slice(0, 4).toLowerCase() === 'npm:'
        && /^basic-ftp(?:@|$)/.test(spec.slice(4));
    const requires = value => ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'].some(field =>
        Object.entries(value[field] || {}).some(([name, spec]) => name === 'basic-ftp' || alias(spec)));
    const overrideRequires = value => object(value) && Object.entries(value).some(([name, spec]) =>
        /^basic-ftp(?:@|$)/.test(name) || alias(spec) || overrideRequires(spec));
    return installed.length === 0 && !requires(manifest) && !Object.values(lock.packages).some(requires)
        && !Object.hasOwn(lock.dependencies || {}, 'basic-ftp') && !overrideRequires(manifest.overrides);
}

function installedBasicFtpVersions(roots) {
    const versions = [], seen = new Set();
    const visit = directory => {
        if (!fs.existsSync(directory)) return;
        const real = fs.realpathSync(directory);
        if (seen.has(real)) return;
        seen.add(real);
        const inspect = directory => {
            if (!fs.statSync(directory).isDirectory()) return;
            const file = path.join(directory, 'package.json');
            const metadata = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
            if (path.basename(directory) === 'basic-ftp' || metadata.name === 'basic-ftp') versions.push(metadata.version);
            visit(path.join(directory, 'node_modules'));
        };
        for (const name of fs.readdirSync(directory)) {
            if (name.startsWith('.')) continue;
            const entry = path.join(directory, name);
            if (name.startsWith('@') && fs.statSync(entry).isDirectory()) {
                for (const child of fs.readdirSync(entry)) inspect(path.join(entry, child));
            } else inspect(entry);
        }
    };
    try { roots.forEach(visit); return versions; } catch (_) { return null; }
}

let provisionManifest = null;
try { provisionManifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/firebase-provision/package.json'), 'utf8')); } catch (_) {}
const installedFtp = installedBasicFtpVersions([path.join(ROOT, 'tools/firebase-provision/node_modules'),
    ...(process.env.ZOE_REPO_ROOT ? [path.resolve(process.env.ZOE_REPO_ROOT, 'tools/firebase-provision/node_modules')] : [])]);
ok('⛔ Firebase Provision basic-ftp ៖ គ្មាន consumer ឬរាល់កំណែដល់ patch សុវត្ថិភាព',
    basicFtpFloor(provisionLock, provisionManifest, installedFtp), installedFtp);

const ftpAbsent = { lockfileVersion: 3, packages: { '': { name: 'synthetic-dependency-fixture' } } };
const ftpFixed = JSON.parse(JSON.stringify(ftpAbsent));
ftpFixed.packages['node_modules/basic-ftp'] = { version: '6.2.1' };
const ftpVulnerable = JSON.parse(JSON.stringify(provisionLock && provisionLock.packages && !Array.isArray(provisionLock.packages) ? provisionLock : ftpAbsent));
ftpVulnerable.packages['node_modules/basic-ftp'] = { version: '6.2.0' };
const ftpRequired = JSON.parse(JSON.stringify(ftpAbsent));
ftpRequired.packages['node_modules/synthetic-consumer'] = { version: '1.0.0', dependencies: { 'basic-ftp': '^6.2.1' } };
ok('basic-ftp floor control ៖ safe absence គ្មាន demand ទទួល', basicFtpFloor(ftpAbsent, {}, []));
ok('basic-ftp floor control ៖ fixed present ទទួល', basicFtpFloor(ftpFixed, {}, ['6.2.1']));
ok('basic-ftp floor control ៖ vulnerable version ក្នុង isolated lock បដិសេធ', !basicFtpFloor(ftpVulnerable, provisionManifest || {}, []));
ok('basic-ftp floor control ៖ missing root dependency បដិសេធ', !basicFtpFloor(ftpAbsent, { dependencies: { 'basic-ftp': '^6.2.1' } }, []));
ok('basic-ftp floor control ៖ missing transitive dependency បដិសេធ', !basicFtpFloor(ftpRequired, {}, []));
ok('basic-ftp floor control ៖ installed vulnerable branch មិនលាក់ដោយ fixed lock', !basicFtpFloor(ftpFixed, {}, ['6.2.0']));
ok('basic-ftp floor control ៖ npm alias demand មិនអាចបាត់ស្ងាត់', !basicFtpFloor(ftpAbsent, { dependencies: { 'ftp-alias': 'npm:basic-ftp@6.2.1' } }, []));
ok('basic-ftp floor control ៖ uppercase NPM protocol alias demand បដិសេធ', !basicFtpFloor(ftpAbsent, { dependencies: { 'ftp-alias': 'NPM:basic-ftp@6.2.1' } }, []));
ok('basic-ftp floor control ៖ uppercase NPM protocol override demand បដិសេធ', !basicFtpFloor(ftpAbsent, { overrides: { 'ftp-alias': 'NPM:basic-ftp@6.2.1' } }, []));
ok('basic-ftp floor control ៖ malformed legacy dependency map បដិសេធ', !basicFtpFloor({ ...ftpAbsent, dependencies: [] }, {}, [])
    && !basicFtpFloor({ ...ftpAbsent, dependencies: 'basic-ftp' }, {}, []));
ok('basic-ftp floor control ៖ missing root demand ទោះ ambient fixed ក៏បដិសេធ', !basicFtpFloor(ftpAbsent, { dependencies: { 'basic-ftp': '^6.2.1' } }, ['6.2.1']));
ok('basic-ftp floor control ៖ missing transitive demand ទោះ ambient fixed ក៏បដិសេធ', !basicFtpFloor(ftpRequired, {}, ['6.2.1']));
ok('basic-ftp floor control ៖ ambient fixed មិនអនុម័ត selected absence', !basicFtpFloor(ftpAbsent, {}, ['6.2.1']));

for (const [name, floor] of [['@opentelemetry/core', '2.8.0'], ['uuid', '11.1.1'], ['@modelcontextprotocol/sdk', '1.32.0'], ['fast-uri', '3.1.9'], ['ip-address', '10.7.4'], ['zod', '4.6.6']]) {
    const versions = Object.entries(provisionLock && provisionLock.packages || {})
        .filter(([rel]) => rel.endsWith('/' + name)).map(([, value]) => value.version);
    ok('⛔ Firebase Provision dependency ' + name + ' ៖ lockfile មាន និងគ្រប់កំណែដល់ patch សុវត្ថិភាព',
        versions.length > 0 && versions.every((version) => versionAtLeast(version, floor)), versions);
}


for (const [name, olderMajor, olderFloor, newerFloor] of [['body-parser', '1.', '1.20.9', '2.4.0'], ['undici', '6.', '6.29.1', '8.12.2']]) {
    const versions = Object.entries(provisionLock && provisionLock.packages || {})
        .filter(([rel]) => rel.endsWith('/' + name)).map(([, value]) => value.version);
    ok('⛔ Firebase Provision dependency ' + name + ' ៖ រាល់ major branch ដល់ patch សុវត្ថិភាព',
        versions.length > 0 && versions.every(version => versionAtLeast(version, String(version).startsWith(olderMajor) ? olderFloor : newerFloor)), versions);
}

let source = null;
try { source = fs.readFileSync(VENDOR); } catch (e) {}
ok('រកឃើញ SheetJS ដែល vendor ក្នុង ZoeW', !!source && source.length > 500000, source && source.length);

let XLSX = null;
try {
    delete require.cache[require.resolve(VENDOR)];
    XLSX = require(VENDOR);
} catch (e) {}

function versionAtLeast(actual, wanted) {
    const a = String(actual || '').split('.').map(Number);
    const b = String(wanted || '').split('.').map(Number);
    if (a.length < 3 || a.some((n) => !Number.isFinite(n))) return false;
    for (let i = 0; i < 3; i++) {
        if ((a[i] || 0) > (b[i] || 0)) return true;
        if ((a[i] || 0) < (b[i] || 0)) return false;
    }
    return true;
}

const version = XLSX && XLSX.version;
ok('SheetJS មាន version ដែលអានបាន', /^\d+\.\d+\.\d+$/.test(String(version || '')), version);
ok('⛔ SheetJS >= 0.20.2 ដើម្បីបិទ Prototype Pollution និង ReDoS', versionAtLeast(version, '0.20.2'), version);

const digest = source ? crypto.createHash('sha256').update(source).digest('hex') : '';
ok('⛔ ឯកសារ SheetJS ត្រូវនឹង release 0.20.3 ផ្លូវការដែលបានផ្ទៀងផ្ទាត់',
    digest === APPROVED_XLSX_SHA256, digest);

// វាស់ require ដែល checker ហៅពិត មុនបើក browser ឬសរសេរ fixture។
for (const [checker, envName] of [['export-cells-test.js', 'EXPORT_APP_DIR'],
    ['monthly-report-test.js', 'MREPORT_APP_DIR'], ['sheet-import-test.js', 'SHEETIMPORT_APP_DIR']]) {
    let text = '', requested = null;
    try { text = fs.readFileSync(path.join(ROOT, 'tools/audit-tools', checker), 'utf8'); } catch (_) {}
    const stop = {};
    try {
        vm.runInNewContext(text, {
            __dirname: path.join(ROOT, 'tools/audit-tools'),
            process: { env: { [envName]: ROOT }, exit() { throw stop; } },
            console: { log() {}, error() {} },
            require(name) {
                if (requested) throw stop;
                if (name === 'xlsx' || path.isAbsolute(name)) { requested = name; throw stop; }
                if (name === './react-view') return require(path.join(ROOT, 'tools/audit-tools', 'react-view.js'));
                if (['fs', 'path', 'vm', 'zlib', 'http'].includes(name)) return require(name);
                throw stop;
            }
        }, { timeout: 1000, filename: checker });
    } catch (_) {}
    ok(checker + ' ផ្ទុក SheetJS ពិតពី target tree មុនការងារតេស្ត', requested === VENDOR, requested);
    ok(checker + ' គ្មានផ្លូវត្រឡប់ទៅ npm xlsx ចាស់',
        text.length > 1000 && !/\brequire\s*\(\s*['"]xlsx(?:\/[^'"]*)?['"]\s*\)/.test(text));
}
let workflow = '';
try { workflow = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'audit.yml'), 'utf8'); } catch (_) {}
const installs = workflow.split(/\r?\n/).filter((line) => /\bnpm\s+(?:install|i)\b/.test(line));
ok('CI មិនដំឡើង npm xlsx ចាស់ជំនួស vendor ដែល App ប្រើ',
    installs.length > 0 && installs.every((line) => !/(?:^|\s)xlsx(?:@[^\s]+)?(?=\s|$)/.test(line)), installs);

try {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
        ['Barcode', 'DOD', 'COD', 'Phone'],
        ['001234567890', 1.25, 6.5, '0970000000']
    ]), 'ZTO');
    const bytes = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const reread = XLSX.read(bytes, { type: 'array' });
    const rows = XLSX.utils.sheet_to_json(reread.Sheets.ZTO, { header: 1, raw: false });
    ok('កំណែសុវត្ថិភាពនៅតែអាន/សរសេរ Excel និងរក្សា Barcode ជាអត្ថបទ',
        rows[1][0] === '001234567890' && rows[1][3] === '0970000000', rows[1]);
} catch (e) {
    ok('កំណែសុវត្ថិភាពនៅតែអាន/សរសេរ Excel', false, e && e.message);
}

let importHtml = '';
try { importHtml = fs.readFileSync(IMPORT_HTML, 'utf8'); } catch (e) {}
ok('រកឃើញទំព័រ Web បម្រុងរបស់ zto-import', importHtml.indexOf('<!DOCTYPE html>') !== -1);
ok('⛔ zto-import ផ្ទុក SheetJS 0.20.3 ពី CDN ផ្លូវការ មិនមែន unpkg 0.18.5',
    /https:\/\/cdn\.sheetjs\.com\/xlsx-0\.20\.3\/package\/dist\/xlsx\.full\.min\.js/.test(importHtml)
    && importHtml.indexOf('unpkg.com') === -1
    && importHtml.indexOf('0.18.5') === -1);
ok('⛔ zto-import ចាក់សោ SheetJS ផ្លូវការដោយ SRI ដែលបានផ្ទៀងផ្ទាត់',
    importHtml.indexOf('integrity="' + APPROVED_XLSX_SHA384 + '"') !== -1
    && importHtml.indexOf('crossorigin="anonymous"') !== -1);
ok('⛔ zto-import មិនរក្សាពាក្យសម្ងាត់ plaintext ក្នុង localStorage',
    !/localStorage\.setItem\([^\n]*password/i.test(importHtml)
    && importHtml.indexOf('function storePassword(') === -1
    && importHtml.indexOf('function readStored(') === -1);
ok('⛔ zto-import លុបពាក្យសម្ងាត់ plaintext ដែលកំណែចាស់ធ្លាប់រក្សាទុក',
    /localStorage\.removeItem\(['"]zto_import_password['"]\)/.test(importHtml));
ok('zto-import ទុកឱ្យ password manager របស់ browser បំពេញដោយសុវត្ថិភាព',
    /type="password"[^>]*autocomplete="current-password"/.test(importHtml));

console.log('\n' + pass + ' ok, ' + fail + ' FAIL');
process.exit(fail ? 1 : 0);
