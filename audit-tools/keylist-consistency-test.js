const fs = require('fs');
const path = require('path');
const vm = require('vm');

// ថត app អាច override បាន ដើម្បីឲ្យ `run-all.sh <baseline>` និង
// `checker-coverage.js` បញ្ជាក់បានថា checker នេះពិតជាអានកូដមែន។
const root = process.env.KEYLIST_APP_DIR ? path.resolve(process.env.KEYLIST_APP_DIR) : path.resolve(__dirname, '..');
const APP_FILE = process.env.KEYLIST_APP_JS || path.join(root, 'ZoeKeyGen/app.js');

function realLicenseAppCodeDecl(source) {
    const m = source.match(/^const LICENSE_APP_CODE = '[A-Z]+';$/m);
    if (!m) throw new Error('not found: const LICENSE_APP_CODE ក្នុង ZoeKeyGen/app.js');
    return m[0];
}

function sliceFns(src, names) {
    return names.map((name) => {
        let start = src.indexOf('function ' + name + '(');
        if (start === -1) throw new Error('not found: ' + name);
        if (src.slice(Math.max(0, start - 6), start) === 'async ') start -= 6;
        let depth = 0, i = src.indexOf('{', start), started = false;
        for (; i < src.length; i++) {
            if (src[i] === '{') { depth++; started = true; }
            else if (src[i] === '}') { depth--; if (started && depth === 0) { i++; break; } }
        }
        return src.slice(start, i);
    }).join('\n\n');
}

let pass = 0, fail = 0;
function ok(label, cond, detail) {
    if (cond) { console.log('   ok    ' + label); pass++; }
    else { console.log('  FAIL   ' + label + (detail !== undefined ? '  got: ' + JSON.stringify(detail) : '')); fail++; }
}

async function build(publicData, metaData) {
    const src = fs.readFileSync(APP_FILE, 'utf8');
    const log = { rendered: null, html: '' };
    const tbody = { innerHTML: '' };
    const snap = (val) => ({ exists: () => val !== null && val !== undefined, val: () => val });

    const sandbox = {
        console, Promise, Error, JSON, Object, Array, Date, Number, String, Boolean, isNaN,
        setTimeout, clearTimeout,
        document: { getElementById: (id) => (id === 'keyListBody' ? tbody : null) },
        window: {},
        db: {},
        fb: {
            ref: (d, p) => ({ path: p }),
            get: (ref) => Promise.resolve(snap(ref.path === 'license_keys' ? publicData : metaData))
        },
        __log: log
    };
    const ctx = vm.createContext(sandbox);
    vm.runInContext(realLicenseAppCodeDecl(src), ctx);
    vm.runInContext(`
        var keyListCache = [];
        var keyListSessionGeneration = 0;
        const APP_LABELS = { ADM: 'ZoeW', ALL: 'ទាំងអស់' };
        function withTimeout(p) { return p; }
        function getServerNow() { return 0; }
        function renderKeyListStub() { __log.rendered = keyListCache; }
    `, ctx);
    vm.runInContext(sliceFns(src, ['refreshKeyList', 'renderKeyList', 'escapeHtml']), ctx);
    vm.runInContext('const __origRender = renderKeyList;', ctx);
    await vm.runInContext('refreshKeyList()', ctx);
    log.rendered = ctx.keyListCache;
    log.html = tbody.innerHTML;
    return log;
}

const consistent = {
    ADM: { K1: { expiresAt: 2000, revoked: true } }
};
const activeKey = {
    ADM: { K1: { expiresAt: 2000, revoked: false } }
};
const singleApp = { ADM: { K2: { expiresAt: 3000, revoked: false } } };
const meta = { ADM: { K1: { issuedAt: 5, scope: 'ALL', note: 'ហាង A' }, K2: { issuedAt: 4, scope: 'ADM', note: 'ហាង B' } } };

(async () => {
    console.log('===== ZoeKeyGen key list: buckets must not be collapsed =====');

    let r = await build(consistent, meta);
    let row = r.rendered[0];
    ok('ស្ថានភាពដូចគ្នា ➜ មិនរាយការណ៍ថាមិនត្រូវគ្នា', row.inconsistent === false, row.inconsistent);
    ok('revoked ត្រឹមត្រូវ', row.revoked === true, row.revoked);
    ok('expiresAt ត្រឹមត្រូវ', row.expiresAt === 2000, row.expiresAt);
    ok('meta នៅតែ merge (note/scope/issuedAt)',
        row.note === 'ហាង A' && row.scope === 'ALL' && row.issuedAt === 5, { n: row.note, s: row.scope, i: row.issuedAt });
    ok('paths មាន App តែមួយ', JSON.stringify(row.paths) === '["ADM"]', row.paths);
    ok('រក្សាតម្លៃដើមតាម App', !!row.perApp && row.perApp.ADM.revoked === true,
        row.perApp ? { adm: row.perApp.ADM.revoked } : 'perApp បាត់');

    r = await build(activeKey, meta);
    row = r.rendered[0];
    ok('Key មិនទាន់ Revoke ➜ revoked = false', row.revoked === false, row.revoked);
    ok('Key មិនទាន់ Revoke ➜ គ្មានផ្លាកព្រមាន', r.html.indexOf('មិនត្រូវគ្នា') === -1);

    // a key that predates the license_keys_meta split still carries its note in the
    // public node, and migrateLegacyLicenseKeyMetadata() only runs once the admin can
    // see those keys in the list.
    const legacyOnly = {
        ADM: { K3: { expiresAt: 4000, revoked: false, note: 'ហាង ចាស់', issuedAt: 9, scope: 'ADM', createdBy: 'a@x.com' } }
    };
    r = await build(legacyOnly, {});
    row = r.rendered[0];
    ok('Key ចាស់ (មិនទាន់ Migrate) នៅតែបង្ហាញ note', row.note === 'ហាង ចាស់', row.note);
    ok('Key ចាស់ នៅតែមាន issuedAt សម្រាប់តម្រៀប', row.issuedAt === 9, row.issuedAt);
    ok('Key ចាស់ នៅតែមាន scope', row.scope === 'ADM', row.scope);
    ok('ហើយ note បង្ហាញក្នុងតារាង', r.html.indexOf('ហាង ចាស់') !== -1);

    r = await build(singleApp, meta);
    row = r.rendered[0];
    ok('Key មួយ App ➜ មិនរាយការណ៍ថាមិនត្រូវគ្នា', row.inconsistent === false, row.inconsistent);
    ok('Key មួយ App ➜ paths មួយ', JSON.stringify(row.paths) === '["ADM"]', row.paths);
    ok('Key មួយ App ➜ គ្មានផ្លាកព្រមាន', r.html.indexOf('មិនត្រូវគ្នា') === -1);

    const specialIds = JSON.parse('{"ADM":{"__proto__":{"expiresAt":4000,"revoked":false},"constructor":{"expiresAt":5000,"revoked":true},"toString":{"expiresAt":6000,"revoked":false}}}');
    r = await build(specialIds, {});
    ok('Firebase key ដែលដូចឈ្មោះ prototype មិនធ្វើឲ្យបញ្ជីគាំង', r.rendered.length === 3, r.rendered);
    ok('ID ពិសេសទាំងអស់នៅជាធាតុឯករាជ្យក្នុងបញ្ជី',
        ['__proto__', 'constructor', 'toString'].every((id) => r.rendered.some((entry) => entry.id === id)), r.rendered);
    ok('ID ពិសេសនៅអាចបង្ហាញ និងបញ្ជូនទៅប៊ូតុងបាន',
        ['__proto__', 'constructor', 'toString'].every((id) => r.html.includes('data-key-id="' + id + '"')), r.html);

    console.log('\n' + (fail === 0 ? '✅ ការធ្វើតេស្តទាំងអស់ជោគជ័យ (' + pass + ')' : '❌ FAILURES  pass=' + pass + ' fail=' + fail));
    process.exit(fail === 0 ? 0 : 1);
})();
