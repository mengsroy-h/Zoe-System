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

// ⛔ ស្លាក និងថេរកៅអីត្រូវ **ស្រង់ចេញពីកូដ ship ពិត** មិនមែនចម្លងមកទីនេះ ៖
//    ច្បាប់ចម្លងក្នុង sandbox ធ្វើឲ្យតេស្តវាស់អ្វីដែលវាសរសេរខ្លួនឯង។
function realDecl(source, name) {
    const m = source.match(new RegExp('^const ' + name + ' = .*;$', 'm'));
    if (!m) throw new Error('not found: const ' + name + ' ក្នុង ZoeKeyGen/app.js');
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

const APP = (fs.readFileSync(APP_FILE, 'utf8')
    .match(/^const LICENSE_APP_CODE = '([A-Z]+)';$/m) || [])[1];

let pass = 0, fail = 0;
function ok(label, cond, detail) {
    if (cond) { console.log('   ok    ' + label); pass++; }
    else { console.log('  FAIL   ' + label + (detail !== undefined ? '  got: ' + JSON.stringify(detail) : '')); fail++; }
}

async function build(publicData, metaData, seatData) {
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
            // ⛔ ត្រូវបំបែកតាម path ពិត ៖ `license_seats` ជា node ទី ៣ ➜ ការ
            //    ត្រឡប់ meta ជំនួសវា ធ្វើឲ្យស្លាកឧបករណ៍វាស់អ្វីផ្សេង។
            get: (ref) => {
                if (ref.path === 'license_keys') return Promise.resolve(snap(publicData));
                if (ref.path === 'license_keys_meta') return Promise.resolve(snap(metaData));
                if (seatData === 'fail') return Promise.reject(new Error('permission denied'));
                return Promise.resolve(snap(seatData === undefined ? null : seatData));
            }
        },
        __log: log
    };
    const ctx = vm.createContext(sandbox);
    vm.runInContext(realLicenseAppCodeDecl(src), ctx);
    vm.runInContext([realDecl(src, 'APP_LABELS'), realDecl(src, 'LICENSE_SEAT_SLOT_NAMES'),
        realDecl(src, 'LICENSE_SEAT_MAX')].join('\n'), ctx);
    vm.runInContext(`
        var keyListCache = [];
        var keyListSessionGeneration = 0;
        var seatReadFailed = false;
        function withTimeout(p) { return p; }
        function getServerNow() { return 0; }
        function renderKeyListStub() { __log.rendered = keyListCache; }
    `, ctx);
    vm.runInContext(sliceFns(src, ['seatLimitOf', 'seatDevicesOf', 'refreshKeyList', 'renderKeyList', 'escapeHtml']), ctx);
    vm.runInContext('const __origRender = renderKeyList;', ctx);
    await vm.runInContext('refreshKeyList()', ctx);
    log.rendered = ctx.keyListCache;
    log.html = tbody.innerHTML;
    log.seatReadFailed = ctx.seatReadFailed;
    return log;
}

const consistent = {
    [APP]: { K1: { expiresAt: 2000, revoked: true } }
};
const activeKey = {
    [APP]: { K1: { expiresAt: 2000, revoked: false } }
};
const singleApp = { [APP]: { K2: { expiresAt: 3000, revoked: false } } };
const meta = { [APP]: { K1: { issuedAt: 5, scope: 'ALL', note: 'ហាង A' }, K2: { issuedAt: 4, scope: APP, note: 'ហាង B' } } };

(async () => {
    console.log('===== ZoeKeyGen key list: buckets must not be collapsed =====');

    let r = await build(consistent, meta);
    let row = r.rendered[0];
    ok('ស្ថានភាពដូចគ្នា ➜ មិនរាយការណ៍ថាមិនត្រូវគ្នា', row.inconsistent === false, row.inconsistent);
    ok('revoked ត្រឹមត្រូវ', row.revoked === true, row.revoked);
    ok('expiresAt ត្រឹមត្រូវ', row.expiresAt === 2000, row.expiresAt);
    ok('meta នៅតែ merge (note/scope/issuedAt)',
        row.note === 'ហាង A' && row.scope === 'ALL' && row.issuedAt === 5, { n: row.note, s: row.scope, i: row.issuedAt });
    ok('paths មាន App តែមួយ', JSON.stringify(row.paths) === JSON.stringify([APP]), row.paths);
    ok('រក្សាតម្លៃដើមតាម App', !!row.perApp && row.perApp[APP].revoked === true,
        row.perApp ? { app: row.perApp[APP].revoked } : 'perApp បាត់');

    r = await build(activeKey, meta);
    row = r.rendered[0];
    ok('Key មិនទាន់ Revoke ➜ revoked = false', row.revoked === false, row.revoked);
    ok('Key មិនទាន់ Revoke ➜ គ្មានផ្លាកព្រមាន', r.html.indexOf('មិនត្រូវគ្នា') === -1);

    // a key that predates the license_keys_meta split still carries its note in the
    // public node, and migrateLegacyLicenseKeyMetadata() only runs once the admin can
    // see those keys in the list.
    const legacyOnly = {
        [APP]: { K3: { expiresAt: 4000, revoked: false, note: 'ហាង ចាស់', issuedAt: 9, scope: APP, createdBy: 'a@x.com' } }
    };
    r = await build(legacyOnly, {});
    row = r.rendered[0];
    ok('Key ចាស់ (មិនទាន់ Migrate) នៅតែបង្ហាញ note', row.note === 'ហាង ចាស់', row.note);
    ok('Key ចាស់ នៅតែមាន issuedAt សម្រាប់តម្រៀប', row.issuedAt === 9, row.issuedAt);
    ok('Key ចាស់ នៅតែមាន scope', row.scope === APP, row.scope);
    ok('ហើយ note បង្ហាញក្នុងតារាង', r.html.indexOf('ហាង ចាស់') !== -1);

    r = await build(singleApp, meta);
    row = r.rendered[0];
    ok('Key មួយ App ➜ មិនរាយការណ៍ថាមិនត្រូវគ្នា', row.inconsistent === false, row.inconsistent);
    ok('Key មួយ App ➜ paths មួយ', JSON.stringify(row.paths) === JSON.stringify([APP]), row.paths);
    ok('Key មួយ App ➜ គ្មានផ្លាកព្រមាន', r.html.indexOf('មិនត្រូវគ្នា') === -1);

    const specialIds = JSON.parse('{"' + APP + '":{"__proto__":{"expiresAt":4000,"revoked":false},"constructor":{"expiresAt":5000,"revoked":true},"toString":{"expiresAt":6000,"revoked":false}}}');
    r = await build(specialIds, {});
    ok('Firebase key ដែលដូចឈ្មោះ prototype មិនធ្វើឲ្យបញ្ជីគាំង', r.rendered.length === 3, r.rendered);
    ok('ID ពិសេសទាំងអស់នៅជាធាតុឯករាជ្យក្នុងបញ្ជី',
        ['__proto__', 'constructor', 'toString'].every((id) => r.rendered.some((entry) => entry.id === id)), r.rendered);
    ok('ID ពិសេសនៅអាចបង្ហាញ និងបញ្ជូនទៅប៊ូតុងបាន',
        ['__proto__', 'constructor', 'toString'].every((id) => r.html.includes('data-key-id="' + id + '"')), r.html);

    // ── ស្លាកឧបករណ៍ ៖ សាលក្រម ៣ ដែលមិនត្រូវលាយគ្នា ──────────────────
    // ⛔ «អានមិនបាន» មិនត្រូវបង្ហាញជា «ទំនេរ» ទេ — នោះនឹងធ្វើឲ្យអ្នកលក់
    //    ជឿថា Key ទំនេរ ហើយចេញវាឲ្យអតិថិជនទី ២ (ច្បាប់ «មិនអាច
    //    ផ្ទៀងផ្ទាត់ ≠ ខុស» លើផ្ទៃថ្មី)។
    r = await build(activeKey, meta, null);
    ok('គ្មានកៅអី ➜ ស្លាក «ទំនេរ»', r.html.indexOf('ទំនេរ') !== -1 && r.html.indexOf('ចងរួច') === -1, r.html.slice(0, 200));

    r = await build(activeKey, meta, { [APP]: { K1: { d1: { device: 'DEVICEAAAAAAAAAAAAAA', at: 1700000000000 } } } });
    ok('មានកៅអី ➜ ស្លាករាយ ១/១', r.html.indexOf('1/1') !== -1 && r.html.indexOf('ទំនេរ') === -1, r.html.slice(0, 200));
    ok('ហើយ row ផ្ទុកឧបករណ៍', !!(r.rendered[0] && r.rendered[0].seatDevices
        && r.rendered[0].seatDevices.length === 1
        && r.rendered[0].seatDevices[0].device === 'DEVICEAAAAAAAAAAAAAA'), r.rendered[0] && r.rendered[0].seatDevices);
    ok('⛔ លេខសម្គាល់ឧបករណ៍ពេញ មិនឡើងដល់ DOM', r.html.indexOf('DEVICEAAAAAAAAAAAAAA') === -1);

    // ── ពិដានច្រើនឧបករណ៍ ៖ ស្លាកត្រូវរាយ n/max ពិត ────────────────────
    // ⛔ ការរាប់ត្រូវឈរក្នុងពិដាន ៖ slot ក្រៅពិដាន **មិនត្រូវរាប់** បើអត់
    //    អ្នកលក់ដែលបន្ថយពិដាន នឹងឃើញលេខធំជាងអ្វីដែល server ទទួល។
    const multiKey = { [APP]: { K1: { expiresAt: 2000, revoked: false, maxDevices: 3 } } };
    r = await build(multiKey, meta, { [APP]: { K1: {
        d1: { device: 'DEVICEAAAAAAAAAAAAAA', at: 1700000000000 },
        d2: { device: 'DEVICEBBBBBBBBBBBBBB', at: 1700000000000 }
    } } });
    ok('ពិដាន ៣ ជាមួយឧបករណ៍ ២ ➜ ស្លាករាយ 2/3', r.html.indexOf('2/3') !== -1, r.html.slice(0, 300));
    ok('ហើយ row ផ្ទុកឧបករណ៍ទាំង ២', r.rendered[0] && r.rendered[0].seatDevices.length === 2, r.rendered[0] && r.rendered[0].seatDevices);
    ok('⛔ លេខសម្គាល់ឧបករណ៍ទី ២ ក៏មិនឡើងដល់ DOM ដែរ', r.html.indexOf('DEVICEBBBBBBBBBBBBBB') === -1);

    r = await build({ [APP]: { K1: { expiresAt: 2000, revoked: false, maxDevices: 1 } } }, meta, { [APP]: { K1: {
        d1: { device: 'DEVICEAAAAAAAAAAAAAA', at: 1700000000000 },
        d2: { device: 'DEVICEBBBBBBBBBBBBBB', at: 1700000000000 }
    } } });
    ok('⛔ slot ក្រៅពិដាន មិនត្រូវរាប់ (បន្ថយពិដាន ➜ 1/1)', r.html.indexOf('1/1') !== -1, r.html.slice(0, 300));

    // ⛔ ទិសផ្ទុយ ៖ ពិដានមិនត្រឹមត្រូវ ➜ ធ្លាក់ចុះទៅ ១ មិនមែនបើកចំហ
    r = await build({ [APP]: { K1: { expiresAt: 2000, revoked: false, maxDevices: 99 } } }, meta, { [APP]: { K1: {
        d1: { device: 'DEVICEAAAAAAAAAAAAAA', at: 1700000000000 }
    } } });
    ok('⛔ ពិដានលើសជួរ ➜ clamp ត្រឹមចំនួន slot ពិត',
        r.rendered[0] && r.rendered[0].maxDevices <= 5, r.rendered[0] && r.rendered[0].maxDevices);

    r = await build(activeKey, meta, 'fail');
    ok('⛔ អាន license_seats មិនបាន ➜ «ពិនិត្យមិនបាន» មិនមែន «ទំនេរ»',
        r.html.indexOf('ពិនិត្យមិនបាន') !== -1 && r.html.indexOf('ទំនេរ') === -1, r.html.slice(0, 300));
    ok('ហើយទង់ត្រូវលើកឡើង', r.seatReadFailed === true, r.seatReadFailed);
    ok('⛔ ការធ្លាក់នោះមិនបំផ្លាញបញ្ជី Key', Array.isArray(r.rendered) && r.rendered.length === 1, r.rendered && r.rendered.length);

    // ── អ្នកសរសេរខាង ZoeKeyGen ៖ ពិដានឧបករណ៍ និងការដោះ ────────────────
    // ⛔ ផ្ទៃថ្មីដែល **គ្មាន checker ណាមួយសូម្បីតែរៀបរាប់ឈ្មោះ** ➜ ការប្តូរ
    //    ផ្លូវសរសេរ · ការបាត់ clamp · ឬការដោះដែលប៉ះពិដាន នឹងរអិតកាត់ស្ងាត់ៗ។
    const writes = await (async () => {
        const src2 = fs.readFileSync(APP_FILE, 'utf8');
        const results = [];
        function run(fnName, row, answer, confirmYes, seatFail) {
            const calls = [];
            const box = { alerted: 0, toasts: 0, refreshed: 0 };
            const sb = {
                console, Promise, Error, JSON, Object, Array, Date, Number, String, Boolean,
                isNaN, isFinite, Math, setTimeout, clearTimeout,
                db: {}, window: {},
                keyListCache: [row],
                seatReadFailed: !!seatFail,
                prompt: () => answer,
                confirm: () => !!confirmYes,
                alert: () => { box.alerted++; },
                showToast: () => { box.toasts++; },
                refreshKeyList: () => { box.refreshed++; },
                captureSensitiveSession: () => ({ user: { email: 'a@x.com' } }),
                isSensitiveSessionCurrent: () => true,
                withTimeout: (pr) => pr,
                retryAsync: (fn) => fn(),
                fb: {
                    ref: (d, path) => ({ path: path }),
                    update: (ref, payload) => { calls.push(['update', ref.path, payload]); return Promise.resolve(); },
                    set: (ref, value) => { calls.push(['set', ref.path, value]); return Promise.resolve(); }
                }
            };
            const c = vm.createContext(sb);
            vm.runInContext([realDecl(src2, 'LICENSE_SEAT_SLOT_NAMES'), realDecl(src2, 'LICENSE_SEAT_MAX')].join('\n'), c);
            vm.runInContext(sliceFns(src2, ['seatLimitOf', 'setKeySeatLimit', 'releaseKeySeat']), c);
            return vm.runInContext(fnName + "('" + row.id + "')", c).then(() => ({ calls, box }));
        }
        const baseRow = (over) => Object.assign({
            id: 'K1', paths: [APP], maxDevices: 1, seatDevices: [], perApp: {}
        }, over);
        results.push(await run('setKeySeatLimit', baseRow(), '3', true));
        results.push(await run('setKeySeatLimit', baseRow(), '0', true));
        results.push(await run('setKeySeatLimit', baseRow(), '99', true));
        results.push(await run('setKeySeatLimit', baseRow(), 'abc', true));
        results.push(await run('setKeySeatLimit', baseRow(), null, true));
        results.push(await run('setKeySeatLimit', baseRow({ maxDevices: 2 }), '2', true));
        results.push(await run('setKeySeatLimit', baseRow({
            maxDevices: 3, seatDevices: [{ slot: 'd1' }, { slot: 'd2' }, { slot: 'd3' }]
        }), '1', false));
        results.push(await run('releaseKeySeat', baseRow({ seatDevices: [{ slot: 'd1' }] }), null, true));
        results.push(await run('releaseKeySeat', baseRow(), null, true));
        results.push(await run('releaseKeySeat', baseRow({ seatDevices: [{ slot: 'd1' }] }), null, true, true));
        return results;
    })();

    const [wOk, wZero, wBig, wText, wCancel, wSame, wLower, wRel, wRelEmpty, wRelFail] = writes;
    ok('ពិដានថ្មីត្រឹមត្រូវ ➜ សរសេរ `maxDevices` ទៅ `license_keys`',
        wOk.calls.length === 1 && wOk.calls[0][0] === 'update'
        && wOk.calls[0][1] === 'license_keys/' + APP + '/K1'
        && wOk.calls[0][2].maxDevices === 3, wOk.calls);
    ok('⛔ លេខក្រៅជួរ (0) ➜ **មិនសរសេរ** ហើយប្រាប់អ្នកប្រើ',
        wZero.calls.length === 0 && wZero.box.alerted === 1, wZero.calls);
    ok('⛔ លេខធំជាងចំនួន slot ➜ **មិនសរសេរ**',
        wBig.calls.length === 0 && wBig.box.alerted === 1, wBig.calls);
    ok('⛔ អត្ថបទមិនមែនលេខ ➜ **មិនសរសេរ**',
        wText.calls.length === 0 && wText.box.alerted === 1, wText.calls);
    ok('⛔ បោះបង់ប្រអប់ ➜ មិនសរសេរ ហើយ**មិនរំខានអ្នកប្រើ**',
        wCancel.calls.length === 0 && wCancel.box.alerted === 0, wCancel.calls);
    ok('⛔ តម្លៃដដែល ➜ គ្មានការសរសេរឥតប្រយោជន៍', wSame.calls.length === 0, wSame.calls);
    ok('⛔ បន្ថយក្រោមចំនួនឧបករណ៍ដែលចងរួច ➜ សួរជាមុន; បដិសេធ ➜ មិនសរសេរ',
        wLower.calls.length === 0, wLower.calls);
    ok('ដោះឧបករណ៍ ➜ លុប node `license_seats` ទាំងមូល',
        wRel.calls.length === 1 && wRel.calls[0][0] === 'set'
        && wRel.calls[0][1] === 'license_seats/' + APP + '/K1'
        && wRel.calls[0][2] === null, wRel.calls);
    ok('⛔ ទិសផ្ទុយ ៖ ការដោះ **មិនប៉ះ** `license_keys` ឬពិដាន',
        wRel.calls.every((c) => c[1].indexOf('license_keys') === -1), wRel.calls);
    ok('⛔ គ្មានឧបករណ៍ចងរួច ➜ មិនសរសេរ ហើយប្រាប់អ្នកប្រើ',
        wRelEmpty.calls.length === 0 && wRelEmpty.box.alerted === 1, wRelEmpty.calls);
    ok('⛔ អានកៅអីមិនបាន ➜ **មិនដោះ** (មិនអាចផ្ទៀងផ្ទាត់ ≠ ទំនេរ)',
        wRelFail.calls.length === 0 && wRelFail.box.alerted === 1, wRelFail.calls);

    console.log('\n' + (fail === 0 ? '✅ ការធ្វើតេស្តទាំងអស់ជោគជ័យ (' + pass + ')' : '❌ FAILURES  pass=' + pass + ' fail=' + fail));
    process.exit(fail === 0 ? 0 : 1);
})();
