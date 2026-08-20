const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const APP_FILE = process.env.KEYLIST_APP_JS || path.join(root, 'ZoeKeyGen/app.js');

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
    vm.runInContext(`
        var keyListCache = [];
        var keyListSessionGeneration = 0;
        const APP_LABELS = { ADM: 'ZoeAdmin', ZOW: 'ZoeW', SCN: 'Zoescan', ALL: 'ទាំង ៣' };
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
    ADM: { K1: { expiresAt: 2000, revoked: true } },
    ZOW: { K1: { expiresAt: 2000, revoked: true } },
    SCN: { K1: { expiresAt: 2000, revoked: true } }
};
const partialRevoke = {
    ADM: { K1: { expiresAt: 2000, revoked: false } },
    ZOW: { K1: { expiresAt: 2000, revoked: true } },
    SCN: { K1: { expiresAt: 2000, revoked: true } }
};
const partialExtend = {
    ADM: { K1: { expiresAt: 1000, revoked: false } },
    ZOW: { K1: { expiresAt: 2000, revoked: false } },
    SCN: { K1: { expiresAt: 2000, revoked: false } }
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
    ok('paths គ្រប់ ៣ App', JSON.stringify(row.paths) === '["ADM","SCN","ZOW"]', row.paths);

    r = await build(partialRevoke, meta);
    row = r.rendered[0];
    ok('Revoke មិនពេញលេញ ➜ រាយការណ៍ថាមិនត្រូវគ្នា', row.inconsistent === true, row.inconsistent);
    ok('Revoke មិនពេញលេញ ➜ មិនរាប់ថា Revoked (ប៊ូតុងនៅតែបញ្ចប់ការងារបាន)',
        row.revoked === false, row.revoked);
    ok('រក្សាតម្លៃដើមតាម App', !!row.perApp && row.perApp.ADM.revoked === false && row.perApp.ZOW.revoked === true,
        row.perApp ? { adm: row.perApp.ADM.revoked, zow: row.perApp.ZOW.revoked } : 'perApp បាត់');
    ok('បង្ហាញផ្លាកព្រមានក្នុងតារាង', r.html.indexOf('មិនត្រូវគ្នា') !== -1);
    ok('ផ្លាកព្រមានរាយតម្លៃតាម App', r.html.indexOf('ZoeAdmin = Active') !== -1);

    r = await build(partialExtend, meta);
    row = r.rendered[0];
    ok('បន្ថែមសុពលភាពមិនពេញលេញ ➜ រាយការណ៍ថាមិនត្រូវគ្នា', row.inconsistent === true, row.inconsistent);
    ok('បង្ហាញថ្ងៃផុតកំណត់ដែលមកមុនគេ (មិនលាក់ App ដែលមិនបានបន្ថែម)',
        row.expiresAt === 1000, row.expiresAt);

    r = await build(singleApp, meta);
    row = r.rendered[0];
    ok('Key មួយ App ➜ មិនរាយការណ៍ថាមិនត្រូវគ្នា', row.inconsistent === false, row.inconsistent);
    ok('Key មួយ App ➜ paths មួយ', JSON.stringify(row.paths) === '["ADM"]', row.paths);
    ok('Key មួយ App ➜ គ្មានផ្លាកព្រមាន', r.html.indexOf('មិនត្រូវគ្នា') === -1);

    console.log('\n' + (fail === 0 ? '✅ ការធ្វើតេស្តទាំងអស់ជោគជ័យ (' + pass + ')' : '❌ FAILURES  pass=' + pass + ' fail=' + fail));
    process.exit(fail === 0 ? 0 : 1);
})();
