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

// ⛔ កូដ App និងឈ្មោះ slot ត្រូវដេរីវេពីកូដ ship មិនមែនចាក់ជា literal
//    (literal = កាលបរិច្ឆេទផុតកំណត់ ៖ ការប្តូរកូដជុំក្រោយធ្វើឲ្យតេស្តវាស់
//    App ដែលមិនមាន ហើយនៅតែបៃតង)។
const APP = (fs.readFileSync(path.join(root, 'ZoeW/app.js'), 'utf8')
    .match(/const LICENSE_APP_CODE = '([A-Z]{2,8})';/) || [])[1] || 'ZOE';
const STORE_KEY = 'zoe_license_activation_' + APP;
const SEAT_SLOTS = ((fs.readFileSync(FILE, 'utf8').match(/const LICENSE_SEAT_SLOTS = \[([^\]]*)\]/) || [])[1] || "'d1'")
    .split(',').map((x) => x.trim().replace(/^'|'$/g, '')).filter(Boolean);

function build(serverRecord, opts) {
    opts = opts || {};
    const store = Object.assign({}, opts.store);
    const seat = { value: opts.seat === undefined ? {} : opts.seat };
    const clock = { now: opts.now || 1000000 };
    const sandbox = {
        console, Promise, Error, JSON, Object, Array, Number, String, Boolean, isNaN,
        setTimeout, clearTimeout, Date, AbortController, Map, Set, Math, RegExp, Uint8Array,
        crypto: { getRandomValues: (a) => { for (let i = 0; i < a.length; i++) a[i] = (i * 29 + 7) & 255; return a; } },
        localStorage: {
            getItem: (k) => (k in store ? store[k] : null),
            setItem: (k, v) => { store[k] = v; },
            removeItem: (k) => { delete store[k]; }
        },
        // ⛔ ផ្លូវ `license_seats` ជាស្នាមភ្ជាប់ពិត ➜ កុំ stub វាចោល ៖ server
        //    ក្លែងត្រង់នេះអនុវត្ត rule ដដែលនឹងផលិតកម្ម (កក់បានពេលទទេ ឬពេល
        //    ជាឧបករណ៍ដដែល)។ អ្នកយាមពេញលេញរបស់ថ្នាក់នេះគឺ `license-seat-test`។
        fetch: (url, init) => {
            if (serverRecord === 'offline') return Promise.reject(new Error('offline'));
            const res = (status, body) => Promise.resolve({
                ok: status >= 200 && status < 300,
                status: status,
                headers: { get: () => null },
                json: () => Promise.resolve(body),
                text: () => Promise.resolve(JSON.stringify(body))
            });
            if (String(url).indexOf('/license_seats/') !== -1) {
                const method = (init && init.method) || 'GET';
                const slotMatch = /\/license_seats\/[^/]+\/[^/]+\/([^/.]+)\.json$/.exec(String(url));
                if (method === 'GET') {
                    if (slotMatch) return res(200, seat.value[slotMatch[1]] || null);
                    return res(200, Object.keys(seat.value).length ? seat.value : null);
                }
                if (!slotMatch || SEAT_SLOTS.indexOf(slotMatch[1]) !== 0) return res(401, { error: 'Permission denied' });
                let body = null;
                try { body = JSON.parse(init.body); } catch (e) { return res(400, null); }
                const held = seat.value[slotMatch[1]];
                if (held && held.device !== body.device) return res(401, { error: 'Permission denied' });
                seat.value[slotMatch[1]] = body;
                return res(200, body);
            }
            return res(200, serverRecord);
        },
        __store: store, __clock: clock
    };
    const ctx = vm.createContext(sandbox);
    const src = fs.readFileSync(FILE, 'utf8');
    vm.runInContext(`
        var serverTimeOffsetMs = 0, serverTimeSynced = ${opts.serverTimeSynced === false ? 'false' : 'true'};
        const OFFLINE_GRACE_MS = ${GRACE};
        const LICENSE_DB_URL = 'https://example-rtdb.firebaseio.com';
        const DEVICE_ID_KEY = 'zoe_license_device_id';
        const DEVICE_ID_RE = /^[0-9A-Z]{20,32}$/;
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
        const NET_TIMEOUT_MS = 10000;
        const NET_MAX_IN_FLIGHT = 2;
        const LICENSE_SEAT_SLOTS = ${JSON.stringify(SEAT_SLOTS)};
        const LICENSE_SEAT_CLAIM_TRIES = 2;
        const netInFlight = new Map();
        const statusInFlight = new Map();
        function getServerNow() { return __clock.now; }
        var __signedExp = ${(opts.now || 1000000) + 30 * 86400000};
        function verifyKeyString(keyString) {
            if (keyString.indexOf('BAD') !== -1) return Promise.resolve({ valid: false, reason: 'signature' });
            return Promise.resolve({ valid: true, payload: { id: keyString, a: '${APP}', iat: 1, exp: Math.floor(__signedExp / 1000), note: '' } });
        }
        function verifySignatureAndScope(keyString) { return verifyKeyString(keyString); }
    `, ctx);
    vm.runInContext(sliceFns(src, ['networkLooksDown', 'sharedRequest', 'fetchWithBodyTimeout', 'storageKey', 'loadLocalRecord', 'saveLocalRecord', 'clearLocalRecord', 'recordSeenMark', 'monotonicNow', 'getDeviceId', 'licenseSeatUrl', 'seatLimitOf', 'seatHolderOf', 'readSeat', 'claimSeat', 'checkOnline', 'syncServerTime', 'activate', 'getStatus'].concat(src.includes('function checkLocalStatus(') ? ['checkLocalStatus'] : [])), ctx);
    return { ctx, store, clock };
}

const LIVE = { revoked: false, expiresAt: 1000000 + 30 * 86400000 };

(async () => {
    console.log('===== license offline grace =====');

    // ── កំណែ 2.20.6 ៖ ការ Activate ត្រូវការសាលក្រម server ពិត ─────────
    // 🔴 មុននេះ `activate()` ទទួលយក `online.ok === null` (ផ្ទៀងផ្ទាត់មិនបាន)
    // ➜ «បិទបណ្តាញ + បង្វិលនាឡិកាថយក្រោយ» ធ្វើឲ្យ **Key ដែលផុតកំណត់ពិត
    // រស់ឡើងវិញ** ហើយការអនុគ្រោះ ៣ ថ្ងៃ **reset បានគ្មានដែនកំណត់**។
    // វាស់បានលើកូដមុនកែ ៖ `license-clock-rollback-test.js` ធ្លាក់ ១៦។
    // ច្បាប់ «unverified ➜ រក្សាទុក តែកុំផ្តល់សិទ្ធិថ្មី» ឥឡូវអនុវត្តពិត។
    let h = build('offline');
    let r = await vm.runInContext("activate('KEY1', '" + APP + "')", h.ctx);
    ok('Activate ក្រៅបណ្ដាញ ➜ **បដិសេធ** (មិនផ្តល់សិទ្ធិលើអ្វីដែលផ្ទៀងផ្ទាត់មិនបាន)',
        r.valid === false && r.reason === 'network', r);
    ok('ហើយមិនរក្សាទុក record ទេ', !h.store[STORE_KEY]);

    // ⛔ ទិសផ្ទុយ ៖ ការបដិសេធនោះមិនត្រូវប៉ះ Activation ដែលកំពុងដំណើរការ
    const live = JSON.stringify({
        keyString: 'KEY1', id: 'KEY1', a: APP, iat: 1,
        exp: Math.floor((1000000 + 30 * 86400000) / 1000),
        lastOnlineCheck: 1000000, onlineExp: 1000000 + 30 * 86400000, seenMax: 1000000
    });
    h = build('offline', { store: { [STORE_KEY]: live } });
    let st = await vm.runInContext("getStatus('" + APP + "')", h.ctx);
    ok('ក្រៅបណ្ដាញក្នុងអំឡុងអនុគ្រោះ ➜ នៅតែ active', st.state === 'active', st.state);

    h.clock.now = 1000000 + GRACE + 60000;
    st = await vm.runInContext("getStatus('" + APP + "')", h.ctx);
    ok('ហួសអនុគ្រោះ ➜ offline-grace-exceeded', st.state === 'offline-grace-exceeded', st.state);

    r = await vm.runInContext("activate('KEY1', '" + APP + "')", h.ctx);
    ok('Paste Key ដដែលឡើងវិញ ក្រៅបណ្ដាញ ➜ បដិសេធ', r.valid === false, r);
    ok('ហើយ Activation ចាស់មិនត្រូវលុប',
        !!h.store[STORE_KEY] &&
        JSON.parse(h.store[STORE_KEY]).id === 'KEY1' &&
        JSON.parse(h.store[STORE_KEY]).lastOnlineCheck === 1000000,
        h.store[STORE_KEY]);
    st = await vm.runInContext("getStatus('" + APP + "')", h.ctx);
    ok('ដូច្នេះនៅតែហួសអនុគ្រោះ (រន្ធត្រូវបានបិទ)',
        st.state === 'offline-grace-exceeded', st.state);

    // ⛔ បង្វិលនាឡិកាថយក្រោយ ➜ ការអនុគ្រោះមិនត្រូវ reset (floor `seenMax`)
    h.clock.now = 1000000 + 60000;
    st = await vm.runInContext("getStatus('" + APP + "')", h.ctx);
    ok('បង្វិលនាឡិកាថយក្រោយ ➜ នៅតែហួសអនុគ្រោះ',
        st.state === 'offline-grace-exceeded', st.state);

    // 5. with network, the clock does move
    h = build(LIVE, { store: { [STORE_KEY]: JSON.stringify({ id: 'KEY1', lastOnlineCheck: 1 }) } });
    h.clock.now = 1000000;
    r = await vm.runInContext("activate('KEY1', '" + APP + "')", h.ctx);
    rec = JSON.parse(h.store[STORE_KEY]);
    ok('មានបណ្ដាញ ➜ lastOnlineCheck ត្រូវរំកិល', rec.lastOnlineCheck === 1000000, rec.lastOnlineCheck);
    ok('ហើយយក expiresAt ពី Server', rec.onlineExp === LIVE.expiresAt, rec.onlineExp);

    // 6. a revoked key must be refused at activation time
    h = build({ revoked: true, expiresAt: 1000000 + 30 * 86400000 });
    r = await vm.runInContext("activate('KEY1', '" + APP + "')", h.ctx);
    ok('Key ដែល Revoke ➜ បដិសេធតាំងពី Activate', r.valid === false && r.reason === 'revoked', r);
    ok('ហើយមិនរក្សាទុក record ទេ', !h.store[STORE_KEY]);

    // 7. refusing a bad key must not wipe a working activation
    const good = JSON.stringify({ id: 'KEYOK', keyString: 'KEYOK', exp: 9999999999, lastOnlineCheck: 1000000, onlineExp: 9999999999000 });
    h = build({ revoked: true, expiresAt: 1 }, { store: { [STORE_KEY]: good } });
    r = await vm.runInContext("activate('KEYBADREVOKED', '" + APP + "')", h.ctx);
    ok('Paste Key ខូច ➜ មិនលុប Activation ដែលកំពុងដំណើរការ',
        h.store[STORE_KEY] === good, h.store[STORE_KEY]);

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
        const payload = Buffer.from(JSON.stringify({ a: APP, id: 'K1', iat: 1, exp: 99999999999 })).toString('base64url');
        store[STORE_KEY] = JSON.stringify({
            keyString: 'ZOEKEY-' + payload + '.AAAA', id: 'K1', a: APP, iat: 1,
            exp: 99999999999, lastOnlineCheck: Date.now(), onlineExp: Date.now() + 86400000
        });
        return { L: ctx.window.ZoeLicense, store };
    }
    const licHas = (b) => !!b.store[STORE_KEY];

    const lc1 = buildLic(true, true);
    await lc1.L.getStatus(APP);
    ok('⛔ crypto ដួលបណ្តោះអាសន្ន ➜ License **មិនត្រូវលុប**', licHas(lc1));

    const lc2 = buildLic(false, false);
    const lcSt = await lc2.L.getStatus(APP);
    ok('ហត្ថលេខាខុសពិត ➜ License **ត្រូវលុប** (fence មិនធ្លាយ)',
        !licHas(lc2) && lcSt.reason === 'signature', JSON.stringify(lcSt));

    const lc3 = buildLic(true, true);
    const lcKey = 'ZOEKEY-' + Buffer.from(JSON.stringify({ a: APP, id: 'K2', iat: 1, exp: 99999999999 })).toString('base64url') + '.AAAA';
    const lcAct = await lc3.L.activate(lcKey, APP);
    ok('activate ខណៈ crypto ដួល ➜ **បដិសេធ** (កុំផ្តល់សិទ្ធិលើអ្វីដែលផ្ទៀងផ្ទាត់មិនបាន)',
        lcAct.valid === false && lcAct.reason === 'verify-unavailable', JSON.stringify(lcAct));

    // ── ⛔ អ័ក្ស **នាឡិកា** ៖ «មិនអាចផ្ទៀងផ្ទាត់» ≠ «ផុតកំណត់» ──────────
    // ច្បាប់ «៣ លទ្ធផល មិនមែន ២» ត្រូវបានអនុវត្តលើអ័ក្ស **បណ្តាញ** (2.17.4)
    // និងអ័ក្ស **crypto** រួចហើយ — តែអ័ក្ស **នាឡិកា** នៅបើកចំហរហូតដល់
    // កំណែ 2.20.1៖ `getStatus()` ប្រៀបធៀប `getServerNow()` នឹង `ceiling`
    // រួច **លុប record របស់អតិថិជន** ដោយផ្អែកលើលទ្ធផលនោះ។ ប៉ុន្តែពេល
    // `checkOnline()` មិនអាចទៅដល់ server (ក្រៅបណ្តាញ) `serverTimeOffsetMs`
    // នៅ `0` ➜ `getServerNow()` គឺជា **នាឡិកាឧបករណ៍ឆៅ** ដែលមិនអាចទុកចិត្តបាន។
    //
    // ទូរស័ព្ទដែលអស់ថ្មរួច boot ឡើងវិញ (ឬអ្នកប្រើប្តូរកាលបរិច្ឆេទដោយដៃ)
    // ជាញឹកញាប់ក្រឡុកទៅថ្ងៃខុសទាំងស្រុង ➜ License ដែលនៅមានសុពលភាព
    // **ត្រូវលុបចោលជាអចិន្ត្រៃយ៍** ➜ អ្នកប្រើឃើញប្រអប់សុំ Activation Key
    // ខណៈគ្មានអ្វីខុសនឹង Key របស់គាត់សោះ។ ការ recheck រៀងរាល់ ១៥ នាទី
    // (`LICENSE_RECHECK_INTERVAL_MS`) ធ្វើឲ្យវាកើតឡើងកណ្តាលការងារ។
    //
    // ច្បាប់៖ ការលុបដែលមិនអាចត្រឡប់វិញបាន ត្រូវទាមទារនាឡិកា **ដែលទុកចិត្តបាន**
    // (`serverTimeSynced`) ឬសាលក្រមរបស់ server (`online.ok === false` ដែល
    // ត្រូវបានដោះស្រាយខាងលើរួច)។ បើអត់ ➜ រក្សា record តែ **កុំផ្តល់សិទ្ធិ**។
    console.log('\n===== អ័ក្សនាឡិកា ៖ ផ្ទៀងផ្ទាត់មិនបាន ≠ ផុតកំណត់ =====');
    {
        const signedExp = 2000000;
        const store = {
            [STORE_KEY]: JSON.stringify({
                keyString: 'K1', id: 'K1', a: APP, iat: 1,
                exp: Math.floor(signedExp / 1000),
                lastOnlineCheck: 1000000,
                onlineExp: signedExp
            })
        };

        // ក. នាឡិកាឧបករណ៍ខុស (លោតទៅមុខ ១ ឆ្នាំ) ខណៈក្រៅបណ្តាញ
        const bad = build('offline', { store: JSON.parse(JSON.stringify(store)), now: signedExp + 365 * 86400000, serverTimeSynced: false });
        const badSt = await vm.runInContext("getStatus('" + APP + "')", bad.ctx);
        ok('⛔ នាឡិកាមិនទាន់ sync + ក្រៅបណ្តាញ ➜ record **មិនត្រូវលុប**',
            !!bad.store[STORE_KEY], JSON.stringify(badSt));
        ok('⛔ ហើយក៏ **មិនត្រូវផ្តល់សិទ្ធិ** ដែរ (មិនមែន active)',
            badSt.state !== 'active', JSON.stringify(badSt));

        // ខ. កំណែ 2.20.6 ៖ ក្រៅបណ្តាញ **គ្មានផ្លូវលុប** ទោះ `serverTimeSynced`
        //    ជា `true`។ ហេតុផល ៖ ទង់នោះនៅ `true` បន្តក្រោយចាកចេញពីបណ្តាញ
        //    ហើយ offset ក្លាយជាចាស់ ➜ `getServerNow()` រំកិលតាមនាឡិកាឧបករណ៍
        //    ម្តងទៀត ➜ ការប្តូរថ្ងៃទូរស័ព្ទ **លុប Key របស់អតិថិជន**។
        //    ⛔ ការអះអាងនៅតែ **២ ខាង** ៖ មិនផ្តល់សិទ្ធិ **និង** មិនលុប។
        //    ការលុបនៅតែកើតឡើងលើសាលក្រម server ពិត — ជួរ «ឃ» ខាងក្រោម។
        const good = build('offline', { store: JSON.parse(JSON.stringify(store)), now: signedExp + 365 * 86400000, serverTimeSynced: true });
        const goodSt = await vm.runInContext("getStatus('" + APP + "')", good.ctx);
        ok('⛔ នាឡិកា sync + ក្រៅបណ្តាញ + ហួសពិដាន ➜ **មិនផ្តល់សិទ្ធិ**',
            goodSt.state === 'offline-grace-exceeded', JSON.stringify(goodSt));
        ok('⛔ តែក៏ **មិនលុប** ដែរ (ការលុបទាមទារសាលក្រម server ពិត)',
            !!good.store[STORE_KEY], Object.keys(good.store));

        // គ. នាឡិកាមិន sync តែ Key **មិនទាន់** ផុតកំណត់ ➜ នៅ active ធម្មតា
        const fresh = build('offline', { store: JSON.parse(JSON.stringify(store)), now: 1000000 + 1000, serverTimeSynced: false });
        const freshSt = await vm.runInContext("getStatus('" + APP + "')", fresh.ctx);
        ok('នាឡិកាមិន sync តែមិនទាន់ផុតកំណត់ ➜ នៅតែ active',
            freshSt.state === 'active' && !!fresh.store[STORE_KEY], JSON.stringify(freshSt));

        // ឃ. server និយាយថាផុតកំណត់ ➜ សាលក្រមអាជ្ញាធរ ➜ ត្រូវលុប ទោះនាឡិកាមិន sync
        const served = build({ revoked: false, expiresAt: 1 }, { store: JSON.parse(JSON.stringify(store)), now: 1000000 + 1000, serverTimeSynced: false });
        const servedSt = await vm.runInContext("getStatus('" + APP + "')", served.ctx);
        ok('សាលក្រម server (expired-server) ➜ ត្រូវលុបដដែល',
            !served.store[STORE_KEY], JSON.stringify(servedSt));
    }

    console.log('\n' + (fail === 0 ? '✅ ការធ្វើតេស្តទាំងអស់ជោគជ័យ (' + pass + ')' : '❌ FAILURES  pass=' + pass + ' fail=' + fail));
    process.exit(fail === 0 ? 0 : 1);
})();
