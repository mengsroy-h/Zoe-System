// ⛔ ZoeW អានឯកសារ Excel ដែលអ្នកប្រើជ្រើសរើស ដូច្នេះ SheetJS មិនមែនជា
// dependency សម្រាប់ export តែមួយទេ។ កំណែ 0.18.5 រង CVE-2023-30533
// (Prototype Pollution) និង CVE-2024-22363 (ReDoS)។ កំណែដែលជួសជុល ReDoS
// ចាប់ពី 0.20.2 ហើយ release ផ្លូវការមកពី cdn.sheetjs.com មិនមែន npm ចាស់។
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = process.env.DEPSEC_APP_DIR ? path.resolve(process.env.DEPSEC_APP_DIR) : path.resolve(__dirname, '..');
const VENDOR = path.join(ROOT, 'ZoeW', 'vendor', 'xlsx.full.min.js');
const IMPORT_HTML = path.join(ROOT, 'zto-import', 'Index.html');
const APPROVED_XLSX_SHA256 = 'cc015130aa8521e7f088f88898eba949ccdcbfb38df0bd129b44b7273c3a6f41';
const APPROVED_XLSX_SHA384 = 'sha384-EnyY0/GSHQGSxSgMwaIPzSESbqoOLSexfnSMN2AP+39Ckmn92stwABZynq1JyzdT';

let pass = 0, fail = 0;
function ok(label, cond, detail) {
    if (cond) { console.log('   ok    ' + label); pass++; }
    else { console.log('   FAIL  ' + label + (detail !== undefined ? '  ➜ ' + JSON.stringify(detail) : '')); fail++; }
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
