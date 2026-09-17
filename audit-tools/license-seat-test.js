// ថ្នាក់៖ **Key ១ ត្រូវ Activate បានតែ ១ ឧបករណ៍។**
//
//   node audit-tools/license-seat-test.js
//
// មុនជុំនេះ `activate()` សរសេរ record ចូល `localStorage` របស់ឧបករណ៍
// នីមួយៗ ដោយ **គ្មានអ្វីនៅខាង server ចងវាទៅឧបករណ៍ណាមួយទេ** ➜ Key តែមួយ
// ចម្លងទៅទូរស័ព្ទប៉ុន្មានក៏ Activate បានដែរ ➜ អ្នកទិញម្នាក់អាចចែករំលែក ឬ
// លក់បន្ត Key នោះ។ ⛔ ការរាប់ «ចំនួនឧបករណ៍» ខាង client មិនមែនការការពារទេ
// (client គ្រប់គ្រងលេខនោះ) ➜ អ្នកសម្រេចត្រូវឈរនៅ **Firebase rules**៖
// កូនសោ `license_seats/<appCode>/<keyId>` សរសេរបានតែពេល **គ្មានវត្តមាន**
// ឬពេលអ្នកសរសេរជា **ឧបករណ៍ដដែល**។
//
// ⛔ `fetch` ក្លែងក្នុងឯកសារនេះ **អនុវត្ត rule នោះពិត** (មិនទទួលយកគ្រប់
// ការសរសេរ) — ជាន់ការពារពិតត្រូវវាស់ដោយ `emu/license-seat-rules-test.js`
// លើ RTDB emulator ពិត ៖ ឯកសារនេះវាស់ថា **client គោរពសាលក្រម** ចំណែក
// ឯកសារនោះវាស់ថា **server ចេញសាលក្រមនោះពិត**។
'use strict';

// ⛔ ការធ្លាក់ត្រូវឡើងដល់ exit code ៖ ដាក់ ១ តាំងពីដើម ហើយមានតែបន្ទាត់
//    សង្ខេបទេដែលបន្ទាបវា (ច្បាប់ `exit-code-integrity`)។
process.exitCode = 1;

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = process.env.LICSEAT_APP_DIR ? path.resolve(process.env.LICSEAT_APP_DIR) : path.resolve(__dirname, '..');
const FILE = path.join(root, 'ZoeW/license-verify.js');

let pass = 0, fail = 0;
function ok(label, cond, detail) {
    if (cond) { console.log('   ok    ' + label); pass++; }
    else { console.log('  FAIL   ' + label + (detail !== undefined ? '  got: ' + JSON.stringify(detail) : '')); fail++; }
}

if (!fs.existsSync(FILE)) {
    console.log('  FAIL   រកមិនឃើញ ' + FILE);
    console.log('\n0 ok, 1 FAIL');
    process.exitCode = 1;
    return;
}
const SRC = fs.readFileSync(FILE, 'utf8');

// ⛔ កុំ `process.exit(1)` ពេលរកឈ្មោះមិនឃើញ — នោះបិទបាំងការអះអាងខាងក្រោម
//    ទាំងអស់ (ច្បាប់ «stub ជំនួសការបញ្ឈប់»)។ ត្រូវរាយជាការធ្លាក់ដែលមានឈ្មោះ
//    រួចដាក់ stub ដើម្បីឲ្យសេណារីយ៉ូនៅរត់បន្ត។
const missing = [];
function sliceFn(name) {
    let start = SRC.indexOf('function ' + name + '(');
    if (start === -1) { missing.push(name); return 'function ' + name + '() { return undefined; }'; }
    if (SRC.slice(Math.max(0, start - 6), start) === 'async ') start -= 6;
    let depth = 0, i = SRC.indexOf('{', start), started = false;
    for (; i < SRC.length; i++) {
        if (SRC[i] === '{') { depth++; started = true; }
        else if (SRC[i] === '}') { depth--; if (started && depth === 0) { i++; break; } }
    }
    return SRC.slice(start, i);
}

const FNS = [
    'networkLooksDown', 'sharedRequest', 'fetchWithBodyTimeout',
    'storageKey', 'loadLocalRecord', 'saveLocalRecord', 'clearLocalRecord',
    'recordSeenMark', 'monotonicNow',
    'getDeviceId', 'licenseSeatUrl', 'readSeat', 'claimSeat',
    'checkOnline', 'syncServerTime', 'activate', 'checkLocalStatus', 'getStatus'
];

const SLICED = FNS.map(sliceFn).join('\n\n');

let buildSeed = 0;

const NOW = 1700000000000;
const SIGNED_EXP = NOW + 30 * 86400000;
const LIVE_KEY = { revoked: false, expiresAt: SIGNED_EXP };

// ── server ក្លែងដែល **អនុវត្ត rule ពិត** ──────────────────────────────
// ច្បាប់ ៖ សរសេរ `license_seats/<app>/<key>` បានតែពេល (ក) គ្មានវត្តមាន
// ឬ (ខ) `device` ដដែល។ ការលុបដោយ client ត្រូវបដិសេធ។
function makeServer(opts) {
    opts = opts || {};
    const st = {
        key: opts.key === undefined ? LIVE_KEY : opts.key,
        seat: opts.seat === undefined ? null : opts.seat,
        log: []
    };
    st.fetch = function (url, init) {
        const method = (init && init.method) || 'GET';
        st.log.push(method + ' ' + String(url).replace(/^https?:\/\/[^/]+/, ''));
        if (opts.down) return Promise.reject(new Error('offline'));
        const res = (status, body) => Promise.resolve({
            ok: status >= 200 && status < 300,
            status: status,
            headers: { get: (h) => (h === 'Date' ? new Date(NOW).toUTCString() : null) },
            json: () => Promise.resolve(body),
            text: () => Promise.resolve(JSON.stringify(body))
        });
        if (String(url).indexOf('/license_keys/') !== -1) {
            if (opts.keyDown) return res(503, null);
            return res(200, st.key);
        }
        if (String(url).indexOf('/license_seats/') !== -1) {
            if (opts.seatDown) return res(503, null);
            if (opts.rulesMissing) return res(401, { error: 'Permission denied' });
            if (method === 'GET') return res(200, st.seat);
            if (method === 'PUT') {
                let body = null;
                try { body = JSON.parse(init.body); } catch (e) { return res(400, null); }
                if (!body || typeof body.device !== 'string' || typeof body.at !== 'number' || !(body.at > 0)) {
                    return res(400, null);
                }
                if (Object.keys(body).sort().join(',') !== 'at,device') return res(400, null);
                if (st.seat && st.seat.device !== body.device) return res(401, { error: 'Permission denied' });
                st.seat = body;
                return res(200, body);
            }
            return res(401, { error: 'Permission denied' });
        }
        return res(200, {});
    };
    return st;
}

function build(server, opts) {
    opts = opts || {};
    const store = Object.assign({}, opts.store);
    const sandbox = {
        console, Promise, Error, JSON, Object, Array, Number, String, Boolean, isNaN,
        setTimeout, clearTimeout, Date, AbortController, Map, Set, TextEncoder, RegExp, Math, Uint8Array,
        crypto: { getRandomValues: ((seed) => (a) => { for (let i = 0; i < a.length; i++) a[i] = (i * 37 + seed * 101 + 11) & 255; return a; })(++buildSeed) },
        localStorage: opts.noStorage ? {
            getItem: () => { throw new Error('blocked'); },
            setItem: () => { throw new Error('blocked'); },
            removeItem: () => { throw new Error('blocked'); }
        } : {
            getItem: (k) => (k in store ? store[k] : null),
            setItem: (k, v) => { store[k] = String(v); },
            removeItem: (k) => { delete store[k]; }
        },
        fetch: (u, i) => server.fetch(u, i),
        __store: store
    };
    const ctx = vm.createContext(sandbox);
    vm.runInContext(`
        var serverTimeOffsetMs = 0, serverTimeSynced = ${opts.serverTimeSynced === false ? 'false' : 'true'};
        const OFFLINE_GRACE_MS = ${3 * 24 * 60 * 60 * 1000};
        const LICENSE_DB_URL = 'https://example-rtdb.firebaseio.com';
        const NET_TIMEOUT_MS = 10000;
        const NET_MAX_IN_FLIGHT = 2;
        const DEVICE_ID_KEY = 'zoe_license_device_id';
        const DEVICE_ID_RE = /^[0-9A-Z]{20,32}$/;
        const netInFlight = new Map();
        const statusInFlight = new Map();
        function getServerNow() { return ${NOW}; }
        function bytesToBase32(bytes) {
            const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
            let bits = 0, value = 0, output = '';
            for (let i = 0; i < bytes.length; i++) {
                value = (value << 8) | bytes[i]; bits += 8;
                while (bits >= 5) { output += alphabet[(value >>> (bits - 5)) & 31]; bits -= 5; }
            }
            if (bits > 0) output += alphabet[(value << (5 - bits)) & 31];
            return output;
        }
        function verifySignatureAndScope(keyString) {
            if (String(keyString).indexOf('BAD') !== -1) return Promise.resolve({ valid: false, reason: 'signature' });
            return Promise.resolve({ valid: true, payload: { a: 'ADM', id: 'KEYID1', iat: 1, exp: ${Math.floor(SIGNED_EXP / 1000)}, note: '' } });
        }
        function verifyKeyString(k) { return verifySignatureAndScope(k); }
    `, ctx);
    vm.runInContext(SLICED, ctx);
    return { ctx, store, server };
}

const RECORD = (id) => JSON.stringify({
    keyString: 'KEY1', id: id || 'KEYID1', a: 'ADM', iat: 1,
    exp: Math.floor(SIGNED_EXP / 1000), note: '',
    lastOnlineCheck: NOW, onlineExp: SIGNED_EXP, seenMax: NOW
});

(async () => {
    console.log('===== Key ១ ➜ ឧបករណ៍ ១ (license seat) =====');

    missing.forEach((n) => ok('ត្រូវមាន `' + n + '()` ក្នុង license-verify.js', false, 'អវត្តមាន'));

    // ── ១. ឧបករណ៍ទី ១ Activate បាន ហើយកក់កៅអី ─────────────────────────
    let srv = makeServer({});
    let h = build(srv);
    let r = await vm.runInContext("activate('KEY1', 'ADM')", h.ctx);
    ok('ឧបករណ៍ទី ១ Activate បាន', r && r.valid === true, r);
    ok('ហើយកៅអីត្រូវកក់ខាង server', !!(srv.seat && typeof srv.seat.device === 'string' && srv.seat.device.length >= 8), srv.seat);
    const DEV1 = srv.seat ? srv.seat.device : '';
    ok('ត្រា `at` ជាលេខវិជ្ជមាន', !!(srv.seat && typeof srv.seat.at === 'number' && srv.seat.at > 0), srv.seat);
    ok('payload មានតែ ២ វាល (`$other: false` ក្នុង rules)',
        !!srv.seat && Object.keys(srv.seat).sort().join(',') === 'at,device', srv.seat && Object.keys(srv.seat));
    ok('record ត្រូវរក្សាទុកក្នុងឧបករណ៍', !!h.store['zoe_license_activation_ADM']);
    ok('លេខសម្គាល់ឧបករណ៍ចងចាំក្នុង localStorage', typeof h.store['zoe_license_device_id'] === 'string'
        && h.store['zoe_license_device_id'] === DEV1, h.store['zoe_license_device_id']);

    // ── ២. ឧបករណ៍ទី ២ ដោយ Key ដដែល ➜ បដិសេធ ──────────────────────────
    // នេះជាការអះអាងស្នូល ៖ **រឿងតែមួយដែលអ្នកទិញចង់ធ្វើ**។
    let h2 = build(srv);
    let r2 = await vm.runInContext("activate('KEY1', 'ADM')", h2.ctx);
    ok('ឧបករណ៍ទី ២ ដោយ Key ដដែល ➜ **បដិសេធ**', r2 && r2.valid === false && r2.reason === 'seat-taken', r2);
    ok('ហើយឧបករណ៍ទី ២ មិនរក្សាទុក record ទេ', !h2.store['zoe_license_activation_ADM'], h2.store['zoe_license_activation_ADM']);
    ok('កៅអីនៅជារបស់ឧបករណ៍ទី ១ ដដែល', srv.seat && srv.seat.device === DEV1, srv.seat);

    // ── ៣. ឧបករណ៍ដដែល Activate ម្តងទៀត ➜ ត្រូវបាន (idempotent) ────────
    // ⛔ ទិសផ្ទុយ ៖ បើគ្មានការអះអាងនេះ ការកែ «បដិសេធគ្រប់ការសរសេរទី ២»
    //    នឹងបៃតង ខណៈអ្នកប្រើពិតដែលវាយ Key ម្តងទៀត ត្រូវជាប់សោ។
    let h3 = build(srv, { store: { zoe_license_device_id: DEV1 } });
    let r3 = await vm.runInContext("activate('KEY1', 'ADM')", h3.ctx);
    ok('ឧបករណ៍ **ដដែល** Activate ម្តងទៀត ➜ ត្រូវបាន', r3 && r3.valid === true, r3);

    // ── ៤. ការពិនិត្យបន្តបន្ទាប់ ៖ កៅអីប្តូរម្ចាស់ ➜ ច្រានចេញ ─────────
    let srv4 = makeServer({ seat: { device: 'ZZZOTHERDEVICE0001', at: NOW } });
    let h4 = build(srv4, { store: { zoe_license_device_id: DEV1, zoe_license_activation_ADM: RECORD() } });
    let s4 = await vm.runInContext("getStatus('ADM')", h4.ctx);
    ok('getStatus ៖ កៅអីជារបស់ឧបករណ៍ផ្សេង ➜ ត្រូវការ Activate ឡើងវិញ',
        s4 && s4.state === 'required' && s4.reason === 'seat-taken', s4);
    ok('ហើយ record ក្នុងឧបករណ៍នេះត្រូវលុប', !h4.store['zoe_license_activation_ADM']);

    // ── ៥. ⛔ ទិសផ្ទុយ ៖ កៅអីជារបស់ខ្លួន ➜ មិនប៉ះអ្វីទាំងអស់ ───────────
    let srv5 = makeServer({ seat: { device: DEV1, at: NOW } });
    let h5 = build(srv5, { store: { zoe_license_device_id: DEV1, zoe_license_activation_ADM: RECORD() } });
    let s5 = await vm.runInContext("getStatus('ADM')", h5.ctx);
    ok('getStatus ៖ កៅអីជារបស់ខ្លួន ➜ នៅ active ដដែល', s5 && s5.state === 'active', s5);
    ok('ហើយ record នៅដដែល', !!h5.store['zoe_license_activation_ADM']);

    // ── ៦. ⛔ «ផ្ទៀងផ្ទាត់មិនបាន ≠ ខុស» ៖ អានកៅអីមិនបាន ➜ មិនលុប ───────
    let srv6 = makeServer({ seatDown: true });
    let h6 = build(srv6, { store: { zoe_license_device_id: DEV1, zoe_license_activation_ADM: RECORD() } });
    let s6 = await vm.runInContext("getStatus('ADM')", h6.ctx);
    ok('អានកៅអីមិនបាន (503) ➜ **មិនលុប** record', !!h6.store['zoe_license_activation_ADM'], s6);
    ok('ហើយ App នៅដំណើរការដដែល', s6 && s6.state === 'active', s6);

    // ── ៧. ទិន្នន័យចាស់ ៖ record មានស្រាប់ តែកៅអីទទេ ➜ ទទួលយកកៅអី ─────
    // (ការតំឡើងដែល Activate មុនជុំនេះ ត្រូវតែបន្តដំណើរការ)
    let srv7 = makeServer({ seat: null });
    let h7 = build(srv7, { store: { zoe_license_device_id: DEV1, zoe_license_activation_ADM: RECORD() } });
    let s7 = await vm.runInContext("getStatus('ADM')", h7.ctx);
    ok('record ចាស់ + កៅអីទទេ ➜ នៅ active', s7 && s7.state === 'active', s7);
    ok('ហើយកៅអីត្រូវកក់ឲ្យឧបករណ៍នេះស្វ័យប្រវត្តិ', srv7.seat && srv7.seat.device === DEV1, srv7.seat);

    // ── ៨. ការប្រណាំង ៖ អានឃើញទទេ តែការកក់ត្រូវបដិសេធ ➜ ច្រានចេញ ──────
    let srv8 = makeServer({ seat: null });
    let h8 = build(srv8, { store: { zoe_license_device_id: DEV1, zoe_license_activation_ADM: RECORD() } });
    const realFetch8 = srv8.fetch;
    let seen8 = false;
    srv8.fetch = function (url, init) {
        if (!seen8 && String(url).indexOf('/license_seats/') !== -1 && init && init.method === 'PUT') {
            seen8 = true;
            srv8.seat = { device: 'RACEWINNERDEVICE01', at: NOW };
        }
        return realFetch8(url, init);
    };
    let s8 = await vm.runInContext("getStatus('ADM')", h8.ctx);
    ok('ការប្រណាំង ៖ ឧបករណ៍ផ្សេងកក់មុន ➜ ច្រានចេញ',
        s8 && s8.state === 'required' && s8.reason === 'seat-taken', s8);

    // ── ៩. localStorage បិទ ៖ Activate បដិសេធ តែ record ចាស់មិនលុប ────
    let srv9 = makeServer({});
    let h9 = build(srv9, { noStorage: true });
    let r9 = await vm.runInContext("activate('KEY1', 'ADM')", h9.ctx);
    ok('storage បិទ ➜ Activate បដិសេធ (មិនផ្តល់សិទ្ធិលើឧបករណ៍ដែលសម្គាល់មិនបាន)',
        r9 && r9.valid === false && r9.reason === 'device-unverified', r9);
    ok('ហើយគ្មានកៅអីត្រូវកក់ទេ', srv9.seat === null, srv9.seat);

    let srv9b = makeServer({ seat: { device: 'ZZZOTHERDEVICE0001', at: NOW } });
    const store9b = { zoe_license_activation_ADM: RECORD() };
    let h9b = build(srv9b, { store: store9b });
    // ⛔ ដក **តែ** កូនសោឧបករណ៍ ➜ សម្គាល់ឧបករណ៍មិនបាន តែ record នៅ
    vm.runInContext("localStorage.setItem = function () { throw new Error('blocked'); }", h9b.ctx);
    let s9b = await vm.runInContext("getStatus('ADM')", h9b.ctx);
    ok('សម្គាល់ឧបករណ៍មិនបាន ➜ **មិនលុប** record (fail-open)',
        !!h9b.store['zoe_license_activation_ADM'], s9b);

    // ── ១០. លំដាប់សាលក្រម ៖ Revoke ឈ្នះលើកៅអី ────────────────────────
    let srv10 = makeServer({ key: { revoked: true, expiresAt: SIGNED_EXP }, seat: { device: 'ZZZOTHERDEVICE0001', at: NOW } });
    let h10 = build(srv10, { store: { zoe_license_device_id: DEV1 } });
    let r10 = await vm.runInContext("activate('KEY1', 'ADM')", h10.ctx);
    ok('Key ដែល Revoke ➜ សារ «revoked» មិនមែន «seat-taken»',
        r10 && r10.valid === false && r10.reason === 'revoked', r10);

    // ── ១១. ក្រៅបណ្តាញទាំងស្រុង ➜ ឥរិយាបថចាស់នៅដដែល ─────────────────
    let srv11 = makeServer({ down: true });
    let h11 = build(srv11, { store: { zoe_license_device_id: DEV1 } });
    let r11 = await vm.runInContext("activate('KEY1', 'ADM')", h11.ctx);
    ok('ក្រៅបណ្តាញ ➜ «network» (ឥរិយាបថចាស់មិនប្រែ)',
        r11 && r11.valid === false && r11.reason === 'network', r11);

    // ── ១១ខ. rules មិនទាន់ Publish ➜ សារត្រូវប្រាប់រឿងនោះ ────────────
    // ⛔ «ភ្ជាប់ Server មិនបាន» នឹងបញ្ជូនអ្នកប្រើទៅរកមូលហេតុខុស ៖ បណ្តាញ
    //    ដើរធម្មតា — អ្វីដែលខ្វះគឺជំហានដោយដៃរបស់អ្នកលក់។
    let srv11b = makeServer({ rulesMissing: true });
    let h11b = build(srv11b, { store: { zoe_license_device_id: DEV1 } });
    let r11b = await vm.runInContext("activate('KEY1', 'ADM')", h11b.ctx);
    ok('rules មិនទាន់ Publish ➜ «seat-unavailable» មិនមែន «network»',
        r11b && r11b.valid === false && r11b.reason === 'seat-unavailable', r11b);
    let h11c = build(makeServer({ rulesMissing: true }), { store: { zoe_license_device_id: DEV1, zoe_license_activation_ADM: RECORD() } });
    let s11c = await vm.runInContext("getStatus('ADM')", h11c.ctx);
    ok('⛔ ហើយវា **មិនលុប** record របស់ឧបករណ៍ដែល Activate រួច',
        !!h11c.store['zoe_license_activation_ADM'] && s11c.state === 'active', s11c);

    // ── ១២. `checkOnline()` ធម្មតា **មិនសរសេរ** អ្វីទេ ────────────────
    // (វាជា API សាធារណៈ ➜ ការហៅវាមិនត្រូវកក់កៅអីដោយចៃដន្យ)
    let srv12 = makeServer({ seat: null });
    let h12 = build(srv12, { store: { zoe_license_device_id: DEV1 } });
    await vm.runInContext("checkOnline('ADM', 'KEYID1')", h12.ctx);
    ok('`checkOnline()` ដោយគ្មាន `claimSeat` ➜ គ្មានការសរសេរ',
        srv12.seat === null && srv12.log.every((l) => l.indexOf('PUT') !== 0), srv12.log);

    // ── ជាន់អប្បបរមា ៖ ការអះអាងត្រូវប៉ះផ្លូវកៅអីពិត ───────────────────
    const seatCalls = srv.log.concat(srv4.log, srv7.log).filter((l) => l.indexOf('/license_seats/') !== -1);
    ok('ការវាស់ពិតជាឆ្លងកាត់ផ្លូវ `license_seats` (ជាន់អប្បបរមា)', seatCalls.length >= 4, seatCalls.length);
    ok('ហើយមានការសរសេរ (PUT) យ៉ាងតិច ២', seatCalls.filter((l) => l.indexOf('PUT') === 0).length >= 2, seatCalls);

    console.log('\n' + pass + ' ok, ' + fail + ' FAIL');
    process.exitCode = fail === 0 ? 0 : 1;
})();
