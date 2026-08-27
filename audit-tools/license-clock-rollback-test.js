const fs = require('fs');
const path = require('path');
const vm = require('vm');

// ថត app អាច override បាន ដើម្បីឲ្យ `run-all.sh <baseline>` និង
// `checker-coverage.js` បញ្ជាក់បានថា checker នេះពិតជាអានកូដមែន។
const root = process.env.LICROLLBACK_APP_DIR
    ? path.resolve(process.env.LICROLLBACK_APP_DIR)
    : path.resolve(__dirname, '..');
const FILE = path.join(root, 'ZoeW/license-verify.js');
const SRC = fs.readFileSync(FILE, 'utf8');

if (SRC.length < 2000) {
    console.log('  FAIL   license-verify.js តូចខុសធម្មតា ➜ មិនមែនកូដពិតទេ');
    process.exit(1);
}

let pass = 0, fail = 0;
function ok(label, cond, detail) {
    if (cond) { console.log('   ok    ' + label); pass++; }
    else { console.log('  FAIL   ' + label + (detail !== undefined ? '  got: ' + JSON.stringify(detail) : '')); fail++; }
}

const DAY = 86400000;
const T0 = Date.UTC(2026, 7, 1);
const STORE_KEY = 'zoe_license_activation_ADM';

function build(opts) {
    opts = opts || {};
    const store = Object.assign({}, opts.store);
    const link = {
        offline: !!opts.offline,
        serverNow: typeof opts.serverNow === 'number' ? opts.serverNow : T0,
        record: ('serverRecord' in opts) ? opts.serverRecord : { revoked: false, expiresAt: T0 + 365 * DAY },
        calls: 0
    };
    const clock = { now: typeof opts.now === 'number' ? opts.now : T0 };

    function FakeDate(...a) {
        if (!(this instanceof FakeDate)) return new Date(clock.now).toString();
        return a.length ? new Date(...a) : new Date(clock.now);
    }
    FakeDate.now = () => clock.now;
    FakeDate.parse = Date.parse;
    FakeDate.UTC = Date.UTC;
    FakeDate.prototype = Date.prototype;

    const ctx = {
        window: {}, console, setTimeout, clearTimeout,
        atob: (x) => Buffer.from(x, 'base64').toString('binary'),
        btoa: (x) => Buffer.from(x, 'binary').toString('base64'),
        TextEncoder, TextDecoder, AbortController,
        navigator: { get onLine() { return !link.offline; } },
        Date: FakeDate, Math, JSON, Promise, Uint8Array, isNaN, parseInt,
        String, Object, Array, Set, Map, RegExp, Number, Boolean,
        localStorage: {
            getItem: (k) => (k in store ? store[k] : null),
            setItem: (k, v) => { store[k] = v; },
            removeItem: (k) => { delete store[k]; }
        },
        crypto: {
            getRandomValues: (a) => a,
            subtle: {
                importKey: () => Promise.resolve({}),
                verify: () => Promise.resolve(opts.signatureValid !== false)
            }
        },
        fetch: () => {
            link.calls++;
            if (link.offline) return Promise.reject(new Error('offline'));
            return Promise.resolve({
                ok: true,
                headers: { get: (h) => (h === 'Date' ? new Date(link.serverNow).toUTCString() : null) },
                json: () => Promise.resolve(link.record),
                text: () => Promise.resolve('{}')
            });
        }
    };
    ctx.global = ctx;
    vm.createContext(ctx);
    vm.runInContext(SRC, ctx);
    return { L: ctx.window.ZoeLicense, store, clock, link };
}

function mkKey(id, expMs) {
    const payload = Buffer.from(JSON.stringify({
        a: 'ADM', id: id, iat: 1, exp: Math.floor(expMs / 1000), note: ''
    })).toString('base64url');
    return 'ZOEKEY-' + payload + '.AAAA';
}

function rec(h) {
    try { return JSON.parse(h.store[STORE_KEY]); } catch (e) { return null; }
}

(async () => {
    console.log('===== License ៖ ការបង្វិលនាឡិកា មិនត្រូវ reset ការ Activate =====');

    const FAR = T0 + 365 * DAY;

    // ── ក. ការអនុគ្រោះ ៣ ថ្ងៃ មិនត្រូវ reset ដោយបង្វិលនាឡិកាថយក្រោយ ──
    // 🔴 វាស់បានលើ tree មុនកែ ៖ ជំហាន ក.3 ត្រឡប់ `active`។
    let h = build({ now: T0, serverNow: T0, serverRecord: { revoked: false, expiresAt: FAR } });
    let r = await h.L.activate(mkKey('K1', FAR), 'ADM');
    ok('ក.1 activate ខណៈមានបណ្តាញ ➜ ជោគជ័យ', r.valid === true, r);

    h.link.offline = true;
    h.clock.now = T0 + 4 * DAY;
    let st = await h.L.getStatus('ADM');
    ok('ក.2 ក្រៅបណ្តាញ ៤ ថ្ងៃក្រោយ ➜ ហួសអនុគ្រោះ',
        st.state === 'offline-grace-exceeded', st.state);

    h.clock.now = T0 + 1 * DAY;
    st = await h.L.getStatus('ADM');
    ok('ក.3 ⛔ បង្វិលនាឡិកាថយក្រោយ ➜ **នៅតែហួសអនុគ្រោះ**',
        st.state === 'offline-grace-exceeded', st.state);

    h.clock.now = T0;
    st = await h.L.getStatus('ADM');
    ok('ក.4 ⛔ បង្វិលដល់ថ្ងៃ activate ដើម ➜ នៅតែហួសអនុគ្រោះ',
        st.state === 'offline-grace-exceeded', st.state);

    ok('ក.5 record ចងចាំម៉ោងខ្ពស់បំផុតដែលធ្លាប់ឃើញ',
        rec(h) && typeof rec(h).seenMax === 'number' && rec(h).seenMax >= T0,
        rec(h) && rec(h).seenMax);

    ok('ក.6 ហើយ record មិនត្រូវលុបទេ (រក្សាទុក តែមិនផ្តល់សិទ្ធិ)', !!h.store[STORE_KEY]);

    // ⛔ ការវាស់ពិតបំផុត ៖ បិទបើក App ឡើងវិញ (module ថ្មី) ក៏មិនត្រូវ reset ដែរ។
    let h2 = build({ now: T0, offline: true, store: h.store });
    st = await h2.L.getStatus('ADM');
    ok('ក.7 ⛔ បិទបើក App ឡើងវិញ ខណៈនាឡិកាថយក្រោយ ➜ នៅតែហួសអនុគ្រោះ',
        st.state === 'offline-grace-exceeded', st.state);

    // ── ខ. Key ដែលផុតកំណត់ មិនត្រូវរស់ឡើងវិញដោយបង្វិលនាឡិកា ──
    // 🔴 វាស់បានលើ tree មុនកែ ៖ `valid === true` ហើយ getStatus ➜ `active`។
    const DEAD = T0 + 30 * DAY;
    h = build({ now: T0 + 2 * DAY, offline: true });
    r = await h.L.activate(mkKey('K9', DEAD), 'ADM');
    ok('ខ.1 ⛔ activate Key ផុតកំណត់ ខណៈក្រៅបណ្តាញ + នាឡិកាថយក្រោយ ➜ **បដិសេធ**',
        r.valid === false, r);
    ok('ខ.2 ហើយមិនរក្សាទុក record ទេ', !h.store[STORE_KEY], h.store[STORE_KEY]);

    // ── គ. activate ត្រូវការចម្លើយពី server ពិត (`ok === true`) ──
    // ច្បាប់ «unverified ➜ រក្សាទុក តែកុំផ្តល់សិទ្ធិថ្មី» ត្រូវអនុវត្តពិត។
    h = build({ now: T0, offline: true });
    r = await h.L.activate(mkKey('K1', FAR), 'ADM');
    ok('គ.1 ⛔ activate ខណៈក្រៅបណ្តាញ ➜ បដិសេធ (មិនផ្តល់សិទ្ធិលើអ្វីដែលផ្ទៀងផ្ទាត់មិនបាន)',
        r.valid === false, r);
    ok('គ.2 ហើយហេតុផលជា network មិនមែន «Key ខុស» ទេ',
        r.reason === 'network' || r.reason === 'not-configured', r.reason);
    ok('គ.3 ហើយមិនរក្សាទុក record ទេ', !h.store[STORE_KEY], h.store[STORE_KEY]);

    h = build({ now: T0, store: { [STORE_KEY]: JSON.stringify({ id: 'OLD', keyString: 'x', exp: 9e9, lastOnlineCheck: T0, onlineExp: FAR }) }, offline: true });
    r = await h.L.activate(mkKey('K2', FAR), 'ADM');
    ok('គ.4 ការបដិសេធនោះ មិនត្រូវលុប Activation ដែលកំពុងដំណើរការ',
        !!h.store[STORE_KEY] && rec(h).id === 'OLD', rec(h) && rec(h).id);

    // ── ឃ. ទិសផ្ទុយ ៖ ការប្រើធម្មតាមិនត្រូវខូចសោះ ──
    // ⛔ ការអះអាងម្ខាង («បិទរន្ធ») នឹងបៃតងទោះបើ App ស្លាប់ទាំងស្រុងក៏ដោយ។
    h = build({ now: T0, serverNow: T0, serverRecord: { revoked: false, expiresAt: FAR } });
    r = await h.L.activate(mkKey('K1', FAR), 'ADM');
    ok('ឃ.1 មានបណ្តាញ ➜ activate ជោគជ័យ', r.valid === true, r);
    st = await h.L.getStatus('ADM');
    ok('ឃ.2 ហើយស្ថានភាពជា active', st.state === 'active', st.state);

    h.link.offline = true;
    h.clock.now = T0 + 2 * DAY;
    st = await h.L.getStatus('ADM');
    ok('ឃ.3 ក្រៅបណ្តាញ ២ ថ្ងៃ (ក្នុងអនុគ្រោះ) ➜ នៅតែ active', st.state === 'active', st.state);

    h.clock.now = T0 + 5 * DAY;
    st = await h.L.getStatus('ADM');
    ok('ឃ.4 ក្រៅបណ្តាញ ៥ ថ្ងៃ ➜ ហួសអនុគ្រោះ',
        st.state === 'offline-grace-exceeded', st.state);

    h.link.offline = false;
    h.link.serverNow = T0 + 5 * DAY;
    st = await h.L.getStatus('ADM');
    ok('ឃ.5 ភ្ជាប់បណ្តាញមកវិញ ➜ ត្រឡប់ជា active ភ្លាម', st.state === 'active', st.state);

    // ── ង. នាឡិកាដែលលោត **ទៅមុខ** មិនត្រូវចាក់សោអ្នកប្រើស្មោះត្រង់ជារៀងរហូត ──
    // ⛔ សាលក្រម server ត្រូវ **ព្យាបាល** floor ដែលពុល មិនមែនទុកឲ្យវាជាប់។
    h = build({ now: T0, serverNow: T0, serverRecord: { revoked: false, expiresAt: FAR } });
    await h.L.activate(mkKey('K1', FAR), 'ADM');
    h.link.offline = true;
    h.clock.now = T0 + 400 * DAY;
    st = await h.L.getStatus('ADM');
    ok('ង.1 ក្រៅបណ្តាញ + នាឡិកាលោតឆ្លងពិដាន ➜ មិនផ្តល់សិទ្ធិ', st.state !== 'active', st.state);
    ok('ង.2 តែ record **មិនត្រូវលុប** (នាឡិកាឧបករណ៍មិនអាចជាហេតុនៃការលុប)',
        !!h.store[STORE_KEY]);

    h.clock.now = T0 + 2 * DAY;
    h.link.offline = false;
    h.link.serverNow = T0 + 2 * DAY;
    st = await h.L.getStatus('ADM');
    ok('ង.3 កែនាឡិកាត្រឡប់វិញ + បណ្តាញមកវិញ ➜ active ភ្លាម', st.state === 'active', st.state);
    ok('ង.4 ហើយ floor ត្រូវបានព្យាបាលទៅម៉ោង server ពិត',
        rec(h) && rec(h).seenMax === T0 + 2 * DAY, rec(h) && rec(h).seenMax);

    // ⛔ បិទបើក App ឡើងវិញ ក្រោយព្យាបាល ➜ ត្រូវនៅតែដំណើរការ (គ្មានការចាក់សោសល់)
    h2 = build({ now: T0 + 2 * DAY, serverNow: T0 + 2 * DAY, store: h.store,
        serverRecord: { revoked: false, expiresAt: FAR } });
    st = await h2.L.getStatus('ADM');
    ok('ង.5 បិទបើក App ឡើងវិញ ➜ នៅតែ active (អ្នកប្រើស្មោះត្រង់មិនជាប់សោ)',
        st.state === 'active', st.state);
    ok('ង.6 ហើយចំនួនថ្ងៃដែលនៅសល់ត្រឹមត្រូវ (មិនមែន 0 ដោយសារ floor ពុល)',
        st.daysLeft > 300, st.daysLeft);

    // ── ច. ថ្ងៃផុតកំណត់ ជាកម្មសិទ្ធិរបស់ database (Extend ដើរលើឧបករណ៍ថ្មី) ──
    h = build({ now: T0 + 100 * DAY, serverNow: T0 + 100 * DAY,
        serverRecord: { revoked: false, expiresAt: T0 + 400 * DAY } });
    r = await h.L.activate(mkKey('KX', DEAD), 'ADM');
    ok('ច.1 `exp` ដែល sign រួចហួស តែ DB បន្ថែមសុពលភាព ➜ activate **ជោគជ័យ**',
        r.valid === true, r);
    ok('ច.2 ហើយពិដានយកតាម DB មិនមែនតាមហត្ថលេខា',
        rec(h) && rec(h).onlineExp === T0 + 400 * DAY, rec(h) && rec(h).onlineExp);
    st = await h.L.getStatus('ADM');
    ok('ច.3 ស្ថានភាពជា active', st.state === 'active', st.state);

    h = build({ now: T0 + 100 * DAY, serverNow: T0 + 100 * DAY,
        serverRecord: { revoked: false, expiresAt: T0 + 30 * DAY } });
    r = await h.L.activate(mkKey('KX', FAR), 'ADM');
    ok('ច.4 ⛔ ទិសផ្ទុយ ៖ DB ថាផុតកំណត់ ➜ បដិសេធ ទោះហត្ថលេខានៅសល់យូរ',
        r.valid === false && r.reason === 'expired-server', r);

    h = build({ now: T0, serverNow: T0, serverRecord: { revoked: true, expiresAt: FAR } });
    r = await h.L.activate(mkKey('KX', FAR), 'ADM');
    ok('ច.5 ⛔ Key ដែល Revoke ➜ បដិសេធដដែល', r.valid === false && r.reason === 'revoked', r);

    h = build({ now: T0, serverNow: T0, serverRecord: null });
    r = await h.L.activate(mkKey('KX', FAR), 'ADM');
    ok('ច.6 ⛔ Key មិនមានក្នុង DB ➜ បដិសេធដដែល', r.valid === false && r.reason === 'not-found', r);

    h = build({ now: T0, serverNow: T0, signatureValid: false });
    r = await h.L.activate(mkKey('KX', FAR), 'ADM');
    ok('ច.7 ⛔ ហត្ថលេខាខុស ➜ បដិសេធដដែល (DB មិនអាចសង្គ្រោះបានទេ)',
        r.valid === false && r.reason === 'signature', r);

    // ── ឆ. សារបរាជ័យត្រូវប្រាប់ការពិត ──
    const appSrc = fs.readFileSync(path.join(root, 'ZoeW/app.js'), 'utf8');
    const msgFn = appSrc.slice(appSrc.indexOf('function licenseFailureMessage'));
    const msgBody = msgFn.slice(0, msgFn.indexOf('\n    }'));
    ok('ឆ.1 licenseFailureMessage() មានករណី network', msgBody.indexOf("'network'") !== -1);
    ok('ឆ.2 ហើយសារនោះនិយាយអំពីអ៊ីនធឺណិត មិនមែន «Key ខុស»',
        /network[\s\S]{0,160}អ៊ីនធឺណិត/.test(msgBody));

    console.log('\n  សរុប ៖ ' + pass + ' ok, ' + fail + ' FAIL');
    process.exit(fail ? 1 : 0);
})().then(() => {}, (e) => {
    console.error('  FAIL   គាំង: ' + (e && e.stack ? e.stack : e));
    process.exit(1);
});
