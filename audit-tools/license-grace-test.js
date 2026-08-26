const fs = require('fs');
const path = require('path');
const vm = require('vm');

// ថត app អាច override បាន ដើម្បីឲ្យ `run-all.sh <baseline>` និង
// `checker-coverage.js` បញ្ជាក់បានថា checker នេះពិតជាអានកូដមែន។
const root = process.env.LICGRACE_APP_DIR ? path.resolve(process.env.LICGRACE_APP_DIR) : path.resolve(__dirname, '..');
const FILE = process.env.LICENSE_JS || path.join(root, 'ZoeW/license-verify.js');

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

const GRACE = 3 * 24 * 60 * 60 * 1000;

function build(serverRecord, opts) {
    opts = opts || {};
    const store = Object.assign({}, opts.store);
    const clock = { now: opts.now || 1000000 };
    const sandbox = {
        console, Promise, Error, JSON, Object, Array, Number, String, Boolean, isNaN,
        setTimeout, clearTimeout, Date, AbortController, Map, Set,
        localStorage: {
            getItem: (k) => (k in store ? store[k] : null),
            setItem: (k, v) => { store[k] = v; },
            removeItem: (k) => { delete store[k]; }
        },
        fetch: () => (serverRecord === 'offline'
            ? Promise.reject(new Error('offline'))
            : Promise.resolve({
                ok: true,
                headers: { get: () => null },
                json: () => Promise.resolve(serverRecord)
            })),
        __store: store, __clock: clock
    };
    const ctx = vm.createContext(sandbox);
    const src = fs.readFileSync(FILE, 'utf8');
    vm.runInContext(`
        var serverTimeOffsetMs = 0, serverTimeSynced = true;
        const OFFLINE_GRACE_MS = ${GRACE};
        const LICENSE_DB_URL = 'https://example-rtdb.firebaseio.com';
        const NET_TIMEOUT_MS = 10000;
        const NET_MAX_IN_FLIGHT = 2;
        const netInFlight = new Map();
        function getServerNow() { return __clock.now; }
        var __signedExp = ${(opts.now || 1000000) + 30 * 86400000};
        function verifyKeyString(keyString) {
            if (keyString.indexOf('BAD') !== -1) return Promise.resolve({ valid: false, reason: 'signature' });
            return Promise.resolve({ valid: true, payload: { id: keyString, a: 'ADM', iat: 1, exp: Math.floor(__signedExp / 1000), note: '' } });
        }
        function verifySignatureAndScope(keyString) { return verifyKeyString(keyString); }
    `, ctx);
    vm.runInContext(sliceFns(src, ['networkLooksDown', 'sharedRequest', 'fetchWithBodyTimeout', 'storageKey', 'loadLocalRecord', 'saveLocalRecord', 'clearLocalRecord', 'checkOnline', 'activate', 'getStatus']), ctx);
    return { ctx, store, clock };
}

const LIVE = { revoked: false, expiresAt: 1000000 + 30 * 86400000 };

(async () => {
    console.log('===== license offline grace =====');

    // 1. first activation with no network still works
    let h = build('offline');
    let r = await vm.runInContext("activate('KEY1', 'ADM')", h.ctx);
    ok('Activate ក្រៅបណ្ដាញលើកដំបូង ➜ ជោគជ័យ', r.valid === true, r);
    let rec = JSON.parse(h.store['zoe_license_activation_ADM']);
    ok('ហើយចាប់ផ្ដើមរាប់ការអនុគ្រោះពីពេលនោះ', rec.lastOnlineCheck === 1000000, rec.lastOnlineCheck);

    let st = await vm.runInContext("getStatus('ADM')", h.ctx);
    ok('ក្នុងអំឡុងអនុគ្រោះ ➜ active', st.state === 'active', st.state);

    // 2. past the grace, offline
    h.clock.now = 1000000 + GRACE + 60000;
    st = await vm.runInContext("getStatus('ADM')", h.ctx);
    ok('ហួសអនុគ្រោះ ➜ offline-grace-exceeded', st.state === 'offline-grace-exceeded', st.state);

    // 3. THE HOLE: re-pasting the same key offline must not reset the clock
    r = await vm.runInContext("activate('KEY1', 'ADM')", h.ctx);
    ok('Paste Key ដដែលឡើងវិញ ➜ នៅតែទទួលយក', r.valid === true, r);
    rec = JSON.parse(h.store['zoe_license_activation_ADM']);
    ok('តែ lastOnlineCheck មិនត្រូវរំកិលទេ', rec.lastOnlineCheck === 1000000, rec.lastOnlineCheck);
    st = await vm.runInContext("getStatus('ADM')", h.ctx);
    ok('ដូច្នេះនៅតែហួសអនុគ្រោះ (រន្ធត្រូវបានបិទ)',
        st.state === 'offline-grace-exceeded', st.state);

    // 4. a genuinely new key offline is a legitimate fresh activation
    r = await vm.runInContext("activate('KEY2', 'ADM')", h.ctx);
    rec = JSON.parse(h.store['zoe_license_activation_ADM']);
    ok('Key ថ្មីពិត ➜ ចាប់ផ្ដើមអនុគ្រោះថ្មី', rec.lastOnlineCheck === h.clock.now, rec.lastOnlineCheck);

    // 5. with network, the clock does move
    h = build(LIVE, { store: { zoe_license_activation_ADM: JSON.stringify({ id: 'KEY1', lastOnlineCheck: 1 }) } });
    h.clock.now = 1000000;
    r = await vm.runInContext("activate('KEY1', 'ADM')", h.ctx);
    rec = JSON.parse(h.store['zoe_license_activation_ADM']);
    ok('មានបណ្ដាញ ➜ lastOnlineCheck ត្រូវរំកិល', rec.lastOnlineCheck === 1000000, rec.lastOnlineCheck);
    ok('ហើយយក expiresAt ពី Server', rec.onlineExp === LIVE.expiresAt, rec.onlineExp);

    // 6. a revoked key must be refused at activation time
    h = build({ revoked: true, expiresAt: 1000000 + 30 * 86400000 });
    r = await vm.runInContext("activate('KEY1', 'ADM')", h.ctx);
    ok('Key ដែល Revoke ➜ បដិសេធតាំងពី Activate', r.valid === false && r.reason === 'revoked', r);
    ok('ហើយមិនរក្សាទុក record ទេ', !h.store['zoe_license_activation_ADM']);

    // 7. refusing a bad key must not wipe a working activation
    const good = JSON.stringify({ id: 'KEYOK', keyString: 'KEYOK', exp: 9999999999, lastOnlineCheck: 1000000, onlineExp: 9999999999000 });
    h = build({ revoked: true, expiresAt: 1 }, { store: { zoe_license_activation_ADM: good } });
    r = await vm.runInContext("activate('KEYBADREVOKED', 'ADM')", h.ctx);
    ok('Paste Key ខូច ➜ មិនលុប Activation ដែលកំពុងដំណើរការ',
        h.store['zoe_license_activation_ADM'] === good, h.store['zoe_license_activation_ADM']);

    // ── ⛔ ការបរាជ័យ **crypto** មិនត្រូវលុប License របស់អតិថិជន ──────────
    // 🔴 ថ្នាក់ដដែលនឹងច្បាប់ `{ ok: null }` របស់បណ្តាញ តែនៅលើអ័ក្ស **crypto**
    // ដែលគ្មានអ្នកការពារ។ `verifySignature()` ធ្លាប់រុំ `crypto.subtle` ក្នុង
    // try/catch រួចត្រឡប់ `false` ➜ `getStatus()` បែងចែក «ហត្ថលេខាខុស» ចេញពី
    // «ផ្ទៀងផ្ទាត់មិនបាន» មិនបាន ➜ វា `clearLocalRecord()` ➜ **License របស់
    // អតិថិជនត្រូវលុប** ដោយសារការដួលបណ្តោះអាសន្នរបស់ WebCrypto។
    // ⚠️ អះអាង **៣ ខាង** — «មិនលុប» តែម្យ៉ាងនឹងបៃតងទោះបើ fence ធ្លាយក៏ដោយ។
    const LIC_SRC = fs.readFileSync(FILE, 'utf8');
    function buildLic(verifyResult, importThrows) {
        const store = {};
        const ctx = {
            window: {}, console, setTimeout, clearTimeout,
            atob: (x) => Buffer.from(x, 'base64').toString('binary'),
            btoa: (x) => Buffer.from(x, 'binary').toString('base64'),
            TextEncoder, TextDecoder, AbortController,
            fetch: () => Promise.reject(new Error('net')),
            navigator: { onLine: true },
            Date, Math, JSON, Promise, Uint8Array, isNaN, parseInt,
            String, Object, Array, Set, Map, RegExp, Number,
            localStorage: {
                getItem: (k) => store[k] || null,
                setItem: (k, v) => { store[k] = v; },
                removeItem: (k) => { delete store[k]; }
            },
            crypto: {
                getRandomValues: (a) => a,
                subtle: {
                    importKey: () => (importThrows
                        ? Promise.reject(new Error('crypto down'))
                        : Promise.resolve({})),
                    verify: () => Promise.resolve(verifyResult)
                }
            }
        };
        ctx.global = ctx;
        vm.createContext(ctx);
        vm.runInContext(LIC_SRC, ctx);
        const payload = Buffer.from(JSON.stringify({ a: 'ADM', id: 'K1', iat: 1, exp: 99999999999 })).toString('base64url');
        store['zoe_license_activation_ADM'] = JSON.stringify({
            keyString: 'ZOEKEY-' + payload + '.AAAA', id: 'K1', a: 'ADM', iat: 1,
            exp: 99999999999, lastOnlineCheck: Date.now(), onlineExp: Date.now() + 86400000
        });
        return { L: ctx.window.ZoeLicense, store };
    }
    const licHas = (b) => !!b.store['zoe_license_activation_ADM'];

    const lc1 = buildLic(true, true);
    await lc1.L.getStatus('ADM');
    ok('⛔ crypto ដួលបណ្តោះអាសន្ន ➜ License **មិនត្រូវលុប**', licHas(lc1));

    const lc2 = buildLic(false, false);
    const lcSt = await lc2.L.getStatus('ADM');
    ok('ហត្ថលេខាខុសពិត ➜ License **ត្រូវលុប** (fence មិនធ្លាយ)',
        !licHas(lc2) && lcSt.reason === 'signature', JSON.stringify(lcSt));

    const lc3 = buildLic(true, true);
    const lcKey = 'ZOEKEY-' + Buffer.from(JSON.stringify({ a: 'ADM', id: 'K2', iat: 1, exp: 99999999999 })).toString('base64url') + '.AAAA';
    const lcAct = await lc3.L.activate(lcKey, 'ADM');
    ok('activate ខណៈ crypto ដួល ➜ **បដិសេធ** (កុំផ្តល់សិទ្ធិលើអ្វីដែលផ្ទៀងផ្ទាត់មិនបាន)',
        lcAct.valid === false && lcAct.reason === 'verify-unavailable', JSON.stringify(lcAct));

    console.log('\n' + (fail === 0 ? '✅ ការធ្វើតេស្តទាំងអស់ជោគជ័យ (' + pass + ')' : '❌ FAILURES  pass=' + pass + ' fail=' + fail));
    process.exit(fail === 0 ? 0 : 1);
})();
