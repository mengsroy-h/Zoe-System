// ថ្នាក់៖ **Key ១ ត្រូវ Activate បានតែលើឧបករណ៍ចំនួនដែលអ្នកលក់អនុញ្ញាត។**
//
//   node audit-tools/license-seat-test.js
//
// មុនជុំដំបូង `activate()` សរសេរ record ចូល `localStorage` របស់ឧបករណ៍
// នីមួយៗ ដោយ **គ្មានអ្វីនៅខាង server ចងវាទៅឧបករណ៍ណាមួយទេ** ➜ Key តែមួយ
// ចម្លងទៅទូរស័ព្ទប៉ុន្មានក៏ Activate បានដែរ។ ⛔ ការរាប់ «ចំនួនឧបករណ៍» ខាង
// client មិនមែនការការពារទេ (client គ្រប់គ្រងលេខនោះ) ➜ អ្នកសម្រេចត្រូវឈរ
// នៅ **Firebase rules**។
//
// ⛔ អតិថិជនខ្លះមានទូរស័ព្ទច្រើន ➜ ពិដានមិនមែន **១ ថេរ** ទេ ៖ វារស់នៅ
// `license_keys/<app>/<keyId>/maxDevices` ដែល **មានតែ admin សរសេរបាន**
// ហើយកៅអីរស់នៅ slot `d1..dN`។ ⛔ rules របស់ RTDB **រាប់កូនមិនបានទេ**
// (គ្មាន `numChildren()`) ➜ ពិដានត្រូវអនុវត្តដោយ **រាយឈ្មោះ slot** ហើយ
// ប្រៀបធៀបនឹង `maxDevices` — នោះជាមូលហេតុដែល slot មានឈ្មោះថេរ។
//
// ⛔ `fetch` ក្លែងក្នុងឯកសារនេះ **អនុវត្ត rule នោះពិត** (មិនទទួលយកគ្រប់
// ការសរសេរ) — ជាន់ការពារពិតត្រូវវាស់ដោយ `emu/license-seat-rules-test.js`
// លើ RTDB emulator ពិត ៖ ឯកសារនេះវាស់ថា **client គោរពសាលក្រម** ចំណែក
// ឯកសារនោះវាស់ថា **server ចេញសាលក្រមនោះពិត**។
//
// ⛔ កូដ App (`LICENSE_APP_CODE`) និងឈ្មោះ slot ត្រូវ **ដេរីវេពីកូដ ship**
// មិនមែនចាក់ជា literal ត្រង់នេះ — literal ជាកាលបរិច្ឆេទផុតកំណត់។
'use strict';

// ⛔ ការធ្លាក់ត្រូវឡើងដល់ exit code ៖ ដាក់ ១ តាំងពីដើម ហើយមានតែបន្ទាត់
//    សង្ខេបទេដែលបន្ទាបវា (ច្បាប់ `exit-code-integrity`)។
process.exitCode = 1;

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = process.env.LICSEAT_APP_DIR ? path.resolve(process.env.LICSEAT_APP_DIR) : path.resolve(__dirname, '..');
const FILE = path.join(root, 'ZoeW/license-verify.js');
const APP_FILE = path.join(root, 'ZoeW/app.js');

let pass = 0, fail = 0;
function ok(label, cond, detail) {
    if (cond) { console.log('   ok    ' + label); pass++; }
    else { console.log('  FAIL   ' + label + (detail !== undefined ? '  got: ' + JSON.stringify(detail) : '')); fail++; }
}

if (!fs.existsSync(FILE) || !fs.existsSync(APP_FILE)) {
    console.log('  FAIL   រកមិនឃើញ ' + FILE + ' ឬ ' + APP_FILE);
    console.log('\n0 ok, 1 FAIL');
    process.exitCode = 1;
    return;
}
const SRC = fs.readFileSync(FILE, 'utf8');
const APP_SRC = fs.readFileSync(APP_FILE, 'utf8');

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

function constDecl(name, fallback) {
    const m = SRC.match(new RegExp('(const ' + name + ' = [^;]+;)'));
    if (!m) { missing.push(name); return 'const ' + name + ' = ' + fallback + ';'; }
    return m[1];
}

const SLOT_DECL = constDecl('LICENSE_SEAT_SLOTS', "['d1']");
const TRIES_DECL = constDecl('LICENSE_SEAT_CLAIM_TRIES', '1');
const META_LIMITS_DECL = constDecl('SEAT_META_LIMITS', '{ model: 80, platform: 40, serial: 64 }');
const META_STATE_DECL = constDecl('seatMetaState', '{ meta: null, refused: false }');
const SLOTS = vm.runInNewContext(SLOT_DECL + '\nLICENSE_SEAT_SLOTS');

const CODE = (APP_SRC.match(/const LICENSE_APP_CODE = '([A-Z]{2,8})';/) || [])[1];
if (!CODE) missing.push('LICENSE_APP_CODE (ZoeW/app.js)');
const APP = CODE || 'ZOE';
const RECORD_KEY = 'zoe_license_activation_' + APP;

const FNS = [
    'networkLooksDown', 'sharedRequest', 'fetchWithBodyTimeout',
    'storageKey', 'loadLocalRecord', 'saveLocalRecord', 'clearLocalRecord',
    'recordSeenMark', 'monotonicNow',
    'getDeviceId', 'licenseSeatUrl', 'seatLimitOf', 'seatHolderOf', 'readSeat', 'claimSeat',
    'checkOnline', 'syncServerTime', 'activate', 'checkLocalStatus', 'getStatus',
    'cleanMetaText', 'setDeviceMeta', 'seatMetaSame', 'noteSeatMeta'
];

const SLICED = FNS.map(sliceFn).join('\n\n');

let buildSeed = 0;

const NOW = 1700000000000;
const SIGNED_EXP = NOW + 30 * 86400000;
const liveKey = (maxDevices) => {
    const k = { revoked: false, expiresAt: SIGNED_EXP };
    if (maxDevices !== undefined) k.maxDevices = maxDevices;
    return k;
};

// ── server ក្លែងដែល **អនុវត្ត rule ពិត** ──────────────────────────────
// ច្បាប់ ៖ សរសេរ `license_seats/<app>/<key>/<slot>` បានតែពេល (ក) slot នោះ
// ស្ថិតក្នុងពិដាន `maxDevices` របស់ Key **និង** (ខ) គ្មានវត្តមាន ឬ `device`
// ដដែល។ ការលុបដោយ client ត្រូវបដិសេធ។
function makeServer(opts) {
    opts = opts || {};
    const st = {
        key: opts.key === undefined ? liveKey(opts.maxDevices) : opts.key,
        seats: Object.assign({}, opts.seats),
        log: []
    };
    const limit = () => {
        const raw = st.key && st.key.maxDevices;
        const n = Math.floor(Number(raw));
        if (!isFinite(n) || n < 1) return 1;
        return n > SLOTS.length ? SLOTS.length : n;
    };
    st.fetch = function (url, init) {
        const method = (init && init.method) || 'GET';
        const pathOnly = String(url).replace(/^https?:\/\/[^/]+/, '');
        st.log.push(method + ' ' + pathOnly);
        if (opts.down) return Promise.reject(new Error('offline'));
        const res = (status, body) => Promise.resolve({
            ok: status >= 200 && status < 300,
            status: status,
            headers: { get: (h) => (h === 'Date' ? new Date(NOW).toUTCString() : null) },
            json: () => Promise.resolve(body),
            text: () => Promise.resolve(JSON.stringify(body))
        });
        if (pathOnly.indexOf('/license_keys/') !== -1) {
            if (opts.keyDown) return res(503, null);
            return res(200, st.key);
        }
        if (pathOnly.indexOf('/license_seats/') !== -1) {
            if (opts.seatDown) return res(503, null);
            if (opts.rulesMissing) return res(401, { error: 'Permission denied' });
            const metaMatch = /\/license_seats\/[^/]+\/[^/]+\/([^/.]+)\/meta\.json$/.exec(pathOnly);
            if (metaMatch && method === 'PUT') {
                // ⛔ rules ពិត ៖ meta តែលើកៅអីដែលមាន · keys ៤ ពិត · ប្រវែង 1..80 · 1..40 · 1..64 · at > 0
                if (opts.metaHang) return new Promise(() => {});
                if (opts.metaRefuse) return res(401, { error: 'Permission denied' });
                const holder = st.seats[metaMatch[1]];
                let body = null;
                try { body = JSON.parse(init.body); } catch (e) { return res(400, null); }
                const len = (v, max) => typeof v === 'string' && v.length >= 1 && v.length <= max;
                if (!holder || !body || Object.keys(body).sort().join(',') !== 'at,model,platform,serial'
                    || !len(body.model, 80) || !len(body.platform, 40) || !len(body.serial, 64) || !(typeof body.at === 'number' && body.at > 0)) {
                    return res(401, { error: 'Permission denied' });
                }
                holder.meta = body;
                st.metaPuts = (st.metaPuts || 0) + 1;
                return res(200, body);
            }
            const slotMatch = /\/license_seats\/[^/]+\/[^/]+\/([^/.]+)\.json$/.exec(pathOnly);
            const slot = slotMatch ? slotMatch[1] : null;
            if (method === 'GET') {
                if (slot) return res(200, st.seats[slot] || null);
                return res(200, Object.keys(st.seats).length ? st.seats : null);
            }
            if (method === 'PUT') {
                if (!slot) return res(401, { error: 'Permission denied' });
                // ⛔ ពិដានឈរនៅ server ៖ slot ក្រៅជួរ ➜ បដិសេធ
                const idx = SLOTS.indexOf(slot);
                if (idx === -1 || idx >= limit()) return res(401, { error: 'Permission denied' });
                let body = null;
                try { body = JSON.parse(init.body); } catch (e) { return res(400, null); }
                if (!body || typeof body.device !== 'string' || typeof body.at !== 'number' || !(body.at > 0)) {
                    return res(400, null);
                }
                if (Object.keys(body).sort().join(',') !== 'at,device') return res(400, null);
                if (st.seats[slot] && st.seats[slot].device !== body.device) return res(401, { error: 'Permission denied' });
                st.seats[slot] = body;
                return res(200, body);
            }
            return res(401, { error: 'Permission denied' });
        }
        return res(200, {});
    };
    st.devices = () => SLOTS.filter((s) => st.seats[s]).map((s) => st.seats[s].device);
    return st;
}

function build(server, opts) {
    opts = opts || {};
    const store = Object.assign({}, opts.store);
    const sandbox = {
        console, Promise, Error, JSON, Object, Array, Number, String, Boolean, isNaN, isFinite,
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
        ${SLOT_DECL}
        ${TRIES_DECL}
        ${META_LIMITS_DECL}
        ${META_STATE_DECL}
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
            return Promise.resolve({ valid: true, payload: { a: '${APP}', id: 'KEYID1', iat: 1, exp: ${Math.floor(SIGNED_EXP / 1000)}, note: '' } });
        }
        function verifyKeyString(k) { return verifySignatureAndScope(k); }
    `, ctx);
    vm.runInContext(SLICED, ctx);
    return { ctx, store, server };
}

const RECORD = (id) => JSON.stringify({
    keyString: 'KEY1', id: id || 'KEYID1', a: APP, iat: 1,
    exp: Math.floor(SIGNED_EXP / 1000), note: '',
    lastOnlineCheck: NOW, onlineExp: SIGNED_EXP, seenMax: NOW
});

const activate = (h) => vm.runInContext("activate('KEY1', '" + APP + "')", h.ctx);
const status = (h) => vm.runInContext("getStatus('" + APP + "')", h.ctx);

(async () => {
    console.log('===== Key ១ ➜ ឧបករណ៍តាមពិដាន (license seat) =====');

    missing.forEach((n) => ok('ត្រូវមាន `' + n + '` ក្នុងកូដ ship', false, 'អវត្តមាន'));
    ok('ឈ្មោះ slot យ៉ាងតិច ២ (បើមាន ១ ពិដានមិនអាចលើសពី ១ ទេ)', SLOTS.length >= 2, SLOTS);

    // ── ១. ឧបករណ៍ទី ១ Activate បាន ហើយកក់កៅអី ─────────────────────────
    let srv = makeServer({});
    let h = build(srv);
    let r = await activate(h);
    ok('ឧបករណ៍ទី ១ Activate បាន', r && r.valid === true, r);
    ok('ហើយកៅអីត្រូវកក់ខាង server នៅ slot ដំបូង',
        !!(srv.seats[SLOTS[0]] && typeof srv.seats[SLOTS[0]].device === 'string' && srv.seats[SLOTS[0]].device.length >= 8), srv.seats);
    const DEV1 = srv.seats[SLOTS[0]] ? srv.seats[SLOTS[0]].device : '';
    ok('ត្រា `at` ជាលេខវិជ្ជមាន', !!(srv.seats[SLOTS[0]] && srv.seats[SLOTS[0]].at > 0), srv.seats);
    ok('payload មានតែ ២ វាល (`$other: false` ក្នុង rules)',
        !!srv.seats[SLOTS[0]] && Object.keys(srv.seats[SLOTS[0]]).sort().join(',') === 'at,device', Object.keys(srv.seats[SLOTS[0]] || {}));
    ok('record ត្រូវរក្សាទុកក្នុងឧបករណ៍', !!h.store[RECORD_KEY]);
    ok('លេខសម្គាល់ឧបករណ៍ចងចាំក្នុង localStorage', h.store['zoe_license_device_id'] === DEV1, h.store['zoe_license_device_id']);

    // ── ២. លំនាំដើម ១ ឧបករណ៍ ៖ ឧបករណ៍ទី ២ ➜ បដិសេធ ───────────────────
    // នេះជាការអះអាងស្នូល ៖ **រឿងតែមួយដែលអ្នកទិញចង់ធ្វើ**។
    let h2 = build(srv);
    let r2 = await activate(h2);
    ok('ពិដានលំនាំដើម ១ ៖ ឧបករណ៍ទី ២ ➜ **បដិសេធ**', r2 && r2.valid === false && r2.reason === 'seat-taken', r2);
    ok('ហើយឧបករណ៍ទី ២ មិនរក្សាទុក record ទេ', !h2.store[RECORD_KEY], h2.store[RECORD_KEY]);
    ok('កៅអីនៅជារបស់ឧបករណ៍ទី ១ ដដែល', srv.devices().join(',') === DEV1, srv.devices());

    // ── ៣. ឧបករណ៍ដដែល Activate ម្តងទៀត ➜ ត្រូវបាន (idempotent) ────────
    // ⛔ ទិសផ្ទុយ ៖ បើគ្មានការអះអាងនេះ ការកែ «បដិសេធគ្រប់ការសរសេរទី ២»
    //    នឹងបៃតង ខណៈអ្នកប្រើពិតដែលវាយ Key ម្តងទៀត ត្រូវជាប់សោ។
    let h3 = build(srv, { store: { zoe_license_device_id: DEV1 } });
    let r3 = await activate(h3);
    ok('ឧបករណ៍ **ដដែល** Activate ម្តងទៀត ➜ ត្រូវបាន', r3 && r3.valid === true, r3);

    // ── ៤. ⛔ ពិដាន ២ ៖ ឧបករណ៍ទី ២ ត្រូវបាន តែទី ៣ បដិសេធ ─────────────
    // នេះជាមុខងារ «អតិថិជនមានទូរស័ព្ទច្រើន» ៖ វាត្រូវបើកឲ្យ **តាមចំនួន
    // ដែលអ្នកលក់កំណត់** មិនមែនបើកចំហ។
    let srvM = makeServer({ maxDevices: 2 });
    let hA = build(srvM);
    let rA = await activate(hA);
    const DEVA = srvM.seats[SLOTS[0]] ? srvM.seats[SLOTS[0]].device : '';
    let hB = build(srvM);
    let rB = await activate(hB);
    const DEVB = srvM.seats[SLOTS[1]] ? srvM.seats[SLOTS[1]].device : '';
    let hC = build(srvM);
    let rC = await activate(hC);
    ok('ពិដាន ២ ៖ ឧបករណ៍ទី ១ ➜ ត្រូវបាន', rA && rA.valid === true, rA);
    ok('ពិដាន ២ ៖ ឧបករណ៍ទី ២ ➜ **ត្រូវបាន**', rB && rB.valid === true, rB);
    ok('ហើយវាអង្គុយលើ slot ទី ២ (មិនជាន់ slot ទី ១)',
        !!DEVB && DEVB !== DEVA && srvM.seats[SLOTS[0]].device === DEVA, srvM.seats);
    ok('ពិដាន ២ ៖ ឧបករណ៍ទី ៣ ➜ **បដិសេធ**', rC && rC.valid === false && rC.reason === 'seat-taken', rC);
    ok('ហើយឧបករណ៍ទី ៣ មិនរក្សាទុក record ទេ', !hC.store[RECORD_KEY]);
    ok('កៅអីនៅត្រឹម ២ ដដែល', srvM.devices().length === 2, srvM.devices().length);

    // ⛔ ទិសផ្ទុយ ៖ ឧបករណ៍ទាំង ២ ត្រូវនៅ active ដដែល (ការកក់ទី ២ មិន
    //    ត្រូវដេញទី ១ ចេញ)។
    let sA = await status(build(srvM, { store: { zoe_license_device_id: DEVA, [RECORD_KEY]: RECORD() } }));
    let sB = await status(build(srvM, { store: { zoe_license_device_id: DEVB, [RECORD_KEY]: RECORD() } }));
    ok('ឧបករណ៍ទី ១ នៅ active', sA && sA.state === 'active', sA);
    ok('ឧបករណ៍ទី ២ ក៏ active ដែរ', sB && sB.state === 'active', sB);

    // ── ៥. ⛔ ពិដានឈរនៅ server ៖ client សុំ slot ក្រៅជួរ ➜ បដិសេធ ─────
    // (client មើលឃើញដោយអ្នកប្រើ ➜ ការកែលេខខាង client មិនត្រូវផ្តល់កៅអី)
    let srvOut = makeServer({ maxDevices: 1, seats: { [SLOTS[0]]: { device: 'ZZZOTHERDEVICE0001', at: NOW } } });
    let hOut = build(srvOut, { store: { zoe_license_device_id: 'FORGEDDEVICE000000001' } });
    const forced = await vm.runInContext(
        "claimSeat('" + APP + "', 'KEYID1', 'FORGEDDEVICE000000001', true, '" + SLOTS[1] + "')", hOut.ctx);
    ok('⛔ ការកក់ slot ក្រៅពិដាន ➜ server បដិសេធ', forced && forced.ok === false, forced);
    ok('ហើយកៅអីមិនប្រែ', srvOut.devices().join(',') === 'ZZZOTHERDEVICE0001', srvOut.devices());

    // ── ៦. ⛔ ការបន្ថយពិដាន ៖ ឧបករណ៍លើសលែងប្រើបាន ────────────────────
    let srvLow = makeServer({ maxDevices: 1, seats: {
        [SLOTS[0]]: { device: 'ZZZOTHERDEVICE0001', at: NOW },
        [SLOTS[1]]: { device: 'DEMOTEDDEVICE00001', at: NOW }
    } });
    let hLow = build(srvLow, { store: { zoe_license_device_id: 'DEMOTEDDEVICE00001', [RECORD_KEY]: RECORD() } });
    let sLow = await status(hLow);
    ok('បន្ថយពិដានមក ១ ➜ ឧបករណ៍លើសត្រូវការ Activate ឡើងវិញ',
        sLow && sLow.state === 'required' && sLow.reason === 'seat-taken', sLow);

    // ── ៧. ការប្រណាំង ៖ slot ដំបូងត្រូវយកមុន ➜ រំកិលទៅ slot បន្ទាប់ ────
    // ⛔ បើគ្មានការព្យាយាម slot បន្ទាប់ទេ អតិថិជនដែលមានពិដាន ២ នឹងត្រូវ
    //    បដិសេធដោយ **ការប្រណាំង** ទោះកៅអីនៅទំនេរ។
    let srvRace = makeServer({ maxDevices: 2 });
    let hRace = build(srvRace, { store: { zoe_license_device_id: 'RACELOSERDEVICE001' } });
    const realRace = srvRace.fetch;
    let sawPut = false;
    srvRace.fetch = function (url, init) {
        if (!sawPut && init && init.method === 'PUT' && String(url).indexOf('/' + SLOTS[0] + '.json') !== -1) {
            sawPut = true;
            srvRace.seats[SLOTS[0]] = { device: 'RACEWINNERDEVICE01', at: NOW };
        }
        return realRace(url, init);
    };
    let rRace = await activate(hRace);
    ok('ការប្រណាំង ៖ អ្នកចាញ់រំកិលទៅ slot ទំនេរបន្ទាប់ ➜ Activate បាន', rRace && rRace.valid === true, rRace);
    ok('ហើយ slot ទី ១ នៅជារបស់អ្នកឈ្នះ',
        srvRace.seats[SLOTS[0]] && srvRace.seats[SLOTS[0]].device === 'RACEWINNERDEVICE01', srvRace.seats);

    // ── ៨. ការប្រណាំងខណៈពិដាន ១ ➜ ច្រានចេញ ────────────────────────────
    let srv8 = makeServer({});
    let h8 = build(srv8, { store: { zoe_license_device_id: DEV1, [RECORD_KEY]: RECORD() } });
    const realFetch8 = srv8.fetch;
    let seen8 = false;
    srv8.fetch = function (url, init) {
        if (!seen8 && String(url).indexOf('/license_seats/') !== -1 && init && init.method === 'PUT') {
            seen8 = true;
            srv8.seats[SLOTS[0]] = { device: 'RACEWINNERDEVICE01', at: NOW };
        }
        return realFetch8(url, init);
    };
    let s8 = await status(h8);
    ok('ការប្រណាំងខណៈពិដាន ១ ➜ ច្រានចេញ',
        s8 && s8.state === 'required' && s8.reason === 'seat-taken', s8);

    // ── ៩. កៅអីប្តូរម្ចាស់ ➜ ច្រានចេញ ─────────────────────────────────
    let srv4 = makeServer({ seats: { [SLOTS[0]]: { device: 'ZZZOTHERDEVICE0001', at: NOW } } });
    let h4 = build(srv4, { store: { zoe_license_device_id: DEV1, [RECORD_KEY]: RECORD() } });
    let s4 = await status(h4);
    ok('getStatus ៖ កៅអីជារបស់ឧបករណ៍ផ្សេង ➜ ត្រូវការ Activate ឡើងវិញ',
        s4 && s4.state === 'required' && s4.reason === 'seat-taken', s4);
    ok('ហើយ record ក្នុងឧបករណ៍នេះត្រូវលុប', !h4.store[RECORD_KEY]);

    // ── ១០. ⛔ ទិសផ្ទុយ ៖ កៅអីជារបស់ខ្លួន ➜ មិនប៉ះអ្វីទាំងអស់ ──────────
    let srv5 = makeServer({ seats: { [SLOTS[0]]: { device: DEV1, at: NOW } } });
    let h5 = build(srv5, { store: { zoe_license_device_id: DEV1, [RECORD_KEY]: RECORD() } });
    let s5 = await status(h5);
    ok('getStatus ៖ កៅអីជារបស់ខ្លួន ➜ នៅ active ដដែល', s5 && s5.state === 'active', s5);
    ok('ហើយ record នៅដដែល', !!h5.store[RECORD_KEY]);

    // ── ១១. ⛔ «ផ្ទៀងផ្ទាត់មិនបាន ≠ ខុស» ៖ អានកៅអីមិនបាន ➜ មិនលុប ──────
    let srv6 = makeServer({ seatDown: true });
    let h6 = build(srv6, { store: { zoe_license_device_id: DEV1, [RECORD_KEY]: RECORD() } });
    let s6 = await status(h6);
    ok('អានកៅអីមិនបាន (503) ➜ **មិនលុប** record', !!h6.store[RECORD_KEY], s6);
    ok('ហើយ App នៅដំណើរការដដែល', s6 && s6.state === 'active', s6);

    // ── ១២. ទិន្នន័យចាស់ ៖ record មានស្រាប់ តែកៅអីទទេ ➜ ទទួលយកកៅអី ────
    // (ការតំឡើងដែល Activate មុនជុំនេះ ត្រូវតែបន្តដំណើរការ)
    let srv7 = makeServer({});
    let h7 = build(srv7, { store: { zoe_license_device_id: DEV1, [RECORD_KEY]: RECORD() } });
    let s7 = await status(h7);
    ok('record ចាស់ + កៅអីទទេ ➜ នៅ active', s7 && s7.state === 'active', s7);
    ok('ហើយកៅអីត្រូវកក់ឲ្យឧបករណ៍នេះស្វ័យប្រវត្តិ', srv7.devices().join(',') === DEV1, srv7.devices());

    // ── ១៣. localStorage បិទ ៖ Activate បដិសេធ តែ record ចាស់មិនលុប ───
    let srv9 = makeServer({});
    let h9 = build(srv9, { noStorage: true });
    let r9 = await activate(h9);
    ok('storage បិទ ➜ Activate បដិសេធ (មិនផ្តល់សិទ្ធិលើឧបករណ៍ដែលសម្គាល់មិនបាន)',
        r9 && r9.valid === false && r9.reason === 'device-unverified', r9);
    ok('ហើយគ្មានកៅអីត្រូវកក់ទេ', srv9.devices().length === 0, srv9.devices());

    let srv9b = makeServer({ seats: { [SLOTS[0]]: { device: 'ZZZOTHERDEVICE0001', at: NOW } } });
    const store9b = { [RECORD_KEY]: RECORD() };
    let h9b = build(srv9b, { store: store9b });
    // ⛔ ដក **តែ** កូនសោឧបករណ៍ ➜ សម្គាល់ឧបករណ៍មិនបាន តែ record នៅ
    vm.runInContext("localStorage.setItem = function () { throw new Error('blocked'); }", h9b.ctx);
    let s9b = await status(h9b);
    ok('សម្គាល់ឧបករណ៍មិនបាន ➜ **មិនលុប** record (fail-open)', !!h9b.store[RECORD_KEY], s9b);

    // ── ១៤. លំដាប់សាលក្រម ៖ Revoke ឈ្នះលើកៅអី ─────────────────────────
    let srv10 = makeServer({ key: { revoked: true, expiresAt: SIGNED_EXP }, seats: { [SLOTS[0]]: { device: 'ZZZOTHERDEVICE0001', at: NOW } } });
    let h10 = build(srv10, { store: { zoe_license_device_id: DEV1 } });
    let r10 = await activate(h10);
    ok('Key ដែល Revoke ➜ សារ «revoked» មិនមែន «seat-taken»',
        r10 && r10.valid === false && r10.reason === 'revoked', r10);

    // ── ១៥. ក្រៅបណ្តាញទាំងស្រុង ➜ ឥរិយាបថចាស់នៅដដែល ──────────────────
    let srv11 = makeServer({ down: true });
    let h11 = build(srv11, { store: { zoe_license_device_id: DEV1 } });
    let r11 = await activate(h11);
    ok('ក្រៅបណ្តាញ ➜ «network» (ឥរិយាបថចាស់មិនប្រែ)',
        r11 && r11.valid === false && r11.reason === 'network', r11);

    // ── ១៦. rules មិនទាន់ Publish ➜ សារត្រូវប្រាប់រឿងនោះ ──────────────
    // ⛔ «ភ្ជាប់ Server មិនបាន» នឹងបញ្ជូនអ្នកប្រើទៅរកមូលហេតុខុស ៖ បណ្តាញ
    //    ដើរធម្មតា — អ្វីដែលខ្វះគឺជំហានដោយដៃរបស់អ្នកលក់។
    let srv11b = makeServer({ rulesMissing: true });
    let h11b = build(srv11b, { store: { zoe_license_device_id: DEV1 } });
    let r11b = await activate(h11b);
    ok('rules មិនទាន់ Publish ➜ «seat-unavailable» មិនមែន «network»',
        r11b && r11b.valid === false && r11b.reason === 'seat-unavailable', r11b);
    let h11c = build(makeServer({ rulesMissing: true }), { store: { zoe_license_device_id: DEV1, [RECORD_KEY]: RECORD() } });
    let s11c = await status(h11c);
    ok('⛔ ហើយវា **មិនលុប** record របស់ឧបករណ៍ដែល Activate រួច',
        !!h11c.store[RECORD_KEY] && s11c.state === 'active', s11c);

    // ── ១៧. `checkOnline()` ធម្មតា **មិនសរសេរ** អ្វីទេ ─────────────────
    // (វាជា API សាធារណៈ ➜ ការហៅវាមិនត្រូវកក់កៅអីដោយចៃដន្យ)
    let srv12 = makeServer({});
    let h12 = build(srv12, { store: { zoe_license_device_id: DEV1 } });
    await vm.runInContext("checkOnline('" + APP + "', 'KEYID1')", h12.ctx);
    ok('`checkOnline()` ដោយគ្មាន `claimSeat` ➜ គ្មានការសរសេរ',
        srv12.devices().length === 0 && srv12.log.every((l) => l.indexOf('PUT') !== 0), srv12.log);

    // ── ១៨. ⛔ model · serial ចូលកៅអី (`meta`) ៖ តែផ្លូវ `claimSeat` · តែកៅអីរបស់ខ្លួន · តែពេលប្រែ · មិនដែលប្តូរ verdict ─
    //    (សំណើម្ចាស់គម្រោង ៖ ZoeKeyGen ឃើញថាកៅអីណាជាទូរស័ព្ទណា)
    {
        const META = { model: 'Samsung SM-A546E', platform: 'Android 14', serial: '1a2b3c4d5e6f7890' };
        const setMeta = (h, m) => vm.runInContext('setDeviceMeta(' + JSON.stringify(m) + ')', h.ctx);
        const flushNet = () => new Promise((r) => setTimeout(r, 20));
        const metaPuts = (srvX) => srvX.log.filter((l) => /^PUT .*\/meta\.json$/.test(l));
        const mineSeat = () => ({ [SLOTS[0]]: { device: DEV1, at: NOW } });

        let sA = makeServer({ seats: mineSeat() });
        let hA = build(sA, { store: { zoe_license_device_id: DEV1, [RECORD_KEY]: RECORD() } });
        setMeta(hA, META);
        let stA = await status(hA);
        await flushNet();
        ok('⛔ ឧបករណ៍ Activate រួច (កៅអី mine · គ្មាន meta) ➜ getStatus សរសេរ meta ១ ដងទៅកៅអីរបស់ខ្លួន',
            stA.state === 'active' && metaPuts(sA).length === 1 && metaPuts(sA)[0].indexOf('/' + SLOTS[0] + '/meta.json') !== -1, [stA.state, sA.log]);
        const wrote = sA.seats[SLOTS[0]] && sA.seats[SLOTS[0]].meta;
        ok('ហើយ meta = model · platform · serial ពិត · device មិនប្រែ',
            !!wrote && wrote.model === META.model && wrote.platform === META.platform && wrote.serial === META.serial && sA.seats[SLOTS[0]].device === DEV1, sA.seats);
        await status(hA);
        await flushNet();
        ok('meta ដដែល ➜ ពិនិត្យម្តងទៀតមិនសរសេរទៀត (មួយដងក្នុងមួយការប្រែ)', metaPuts(sA).length === 1, sA.log);

        let sB = makeServer({ seats: mineSeat() });
        let hB = build(sB, { store: { zoe_license_device_id: DEV1 } });
        setMeta(hB, META);
        await vm.runInContext("checkOnline('" + APP + "', 'KEYID1')", hB.ctx);
        await flushNet();
        ok('⛔ `checkOnline()` ដោយគ្មាន `claimSeat` ➜ គ្មានការសរសេរ ទោះមាន meta', sB.log.every((l) => l.indexOf('PUT') !== 0), sB.log);

        let sC = makeServer({ seats: mineSeat(), metaRefuse: true });
        let hC = build(sC, { store: { zoe_license_device_id: DEV1, [RECORD_KEY]: RECORD() } });
        setMeta(hC, META);
        let stC = await status(hC);
        await flushNet();
        await status(hC);
        await flushNet();
        ok('rules មិនទាន់ Publish (meta 401) ➜ Key នៅ active · record មិនលុប · មិនសាកម្តងទៀតក្នុងទំព័រដដែល',
            stC.state === 'active' && !!hC.store[RECORD_KEY] && metaPuts(sC).length === 1, [stC, sC.log]);

        let sD = makeServer({ seats: mineSeat(), metaHang: true });
        let hD = build(sD, { store: { zoe_license_device_id: DEV1, [RECORD_KEY]: RECORD() } });
        setMeta(hD, META);
        const tD = Date.now();
        let stD = await Promise.race([status(hD), new Promise((r) => setTimeout(() => r({ state: 'hung' }), 3000))]);
        ok('⛔ meta ជាប់ (hang) ➜ getStatus មិនរង់ចាំវា (verdict ចេញភ្លាម)', stD.state === 'active' && Date.now() - tD < 2000, stD);

        let sE = makeServer({});
        let hE = build(sE, { store: { zoe_license_device_id: DEV1 } });
        setMeta(hE, META);
        let rE = await activate(hE);
        await flushNet();
        ok('Activate ថ្មី (កក់កៅអី) ➜ meta សរសេរតាមក្រោយ', rE && rE.valid === true && metaPuts(sE).length === 1 && !!(sE.seats[SLOTS[0]] && sE.seats[SLOTS[0]].meta), [rE, sE.log]);

        let sF = makeServer({ seats: mineSeat() });
        let hF = build(sF, { store: { zoe_license_device_id: DEV1, [RECORD_KEY]: RECORD() } });
        await status(hF);
        await flushNet();
        ok('ទិសផ្ទុយ ៖ App មិនផ្តល់ meta ➜ មិនសរសេរ', metaPuts(sF).length === 0, sF.log);

        let sG = makeServer({ seats: { [SLOTS[0]]: { device: 'OTHERDEVICE0000000001', at: NOW } }, maxDevices: 2 });
        let hG = build(sG, { store: { zoe_license_device_id: DEV1, [RECORD_KEY]: RECORD() } });
        setMeta(hG, META);
        await status(hG);
        await flushNet();
        ok('⛔ មិនដែលសរសេរ meta ទៅកៅអីរបស់ឧបករណ៍ផ្សេង', !sG.seats[SLOTS[0]].meta && metaPuts(sG).every((l) => l.indexOf('/' + SLOTS[0] + '/') === -1), sG.log);

        const clean = vm.runInContext('setDeviceMeta(' + JSON.stringify({ model: '  Sam\u0000sung​  SM-A546E\n', platform: 'x'.repeat(90), serial: 's'.repeat(70) }) + ')', hG.ctx);
        ok('setDeviceMeta ៖ ដកតួអក្សរបញ្ជា/មើលមិនឃើញ · ចន្លោះច្រើន ➜ មួយ · កាត់ 80 · 40 · 64',
            !!clean && clean.model === 'Samsung SM-A546E' && clean.platform.length === 40 && clean.serial.length === 64, clean);
        const none = vm.runInContext('setDeviceMeta({ model: 5, platform: null })', hG.ctx);
        ok('setDeviceMeta ៖ មិនមែនខ្សែអក្សរ ➜ គ្មាន meta (null)', none === null, none);
    }

    // ── ជាន់អប្បបរមា ៖ ការអះអាងត្រូវប៉ះផ្លូវកៅអីពិត ────────────────────
    const seatCalls = srv.log.concat(srv4.log, srv7.log, srvM.log).filter((l) => l.indexOf('/license_seats/') !== -1);
    ok('ការវាស់ពិតជាឆ្លងកាត់ផ្លូវ `license_seats` (ជាន់អប្បបរមា)', seatCalls.length >= 4, seatCalls.length);
    ok('ហើយមានការសរសេរ (PUT) យ៉ាងតិច ២', seatCalls.filter((l) => l.indexOf('PUT') === 0).length >= 2, seatCalls.length);
    ok('ការសរសេរត្រូវចង្អុលទៅ slot មិនមែន node មេ',
        seatCalls.filter((l) => l.indexOf('PUT') === 0).every((l) => new RegExp('/(' + SLOTS.join('|') + ')\\.json$').test(l)),
        seatCalls.filter((l) => l.indexOf('PUT') === 0).slice(0, 3));

    console.log('\n' + pass + ' ok, ' + fail + ' FAIL');
    process.exitCode = fail === 0 ? 0 : 1;
})();
