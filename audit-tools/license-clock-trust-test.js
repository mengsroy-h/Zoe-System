// ⛔ ថ្នាក់កំហុស៖ **App ប្រាប់ម៉ូឌុល License ថានាឡិកា «sync ជាមួយ server រួច»
// ខណៈវាមិនទាន់បាន sync អ្វីសោះ។**
//
// កំណែ 2.20.1 បានបិទអ័ក្សនាឡិកាក្នុង `license-verify.js` ៖ ការលុប record
// ដែលមិនអាចត្រឡប់វិញបាន ត្រូវការ `serverTimeSynced === true`។ ប៉ុន្តែទង់នោះ
// ត្រូវបានបើកពី **ខាងក្រៅ** តាម `ZoeLicense.setServerTimeOffset()` ហើយអ្នកហៅ
// នោះគឺ `attachInfoListeners()` ក្នុង `app.js` — ដែល **គ្មាន checker ណាមួយ
// មើលសោះ**៖
//   • រាល់តេស្ត browser ជំនួស `setServerTimeOffset` ដោយ **stub ទទេ**
//   • `license-grace-test.js` ចាក់ `serverTimeSynced` **ដោយផ្ទាល់** ចូល sandbox
// ➜ ស្នាមភ្ជាប់រវាង App និងម៉ូឌុល **មិនដែលត្រូវវាស់សោះ**។ វាស់បានក្នុងជុំនេះ៖
// mutation ដែល **ដកការហៅនោះចេញទាំងស្រុង** និង mutation ដែលធ្វើឲ្យ
// `setServerTimeOffset()` ទទួលយកអ្វីក៏បាន — **រស់រានទាំង ២** លើ checker ទាំងអស់។
//
// 🔴 កំហុសពិត៖ RTDB បាញ់ `.info/serverTimeOffset` **ភ្លាមៗពេល attach**
// ដោយតម្លៃមូលដ្ឋានមុន handshake (`null` ឬ `0`) — មិនមែនតម្លៃពី server ទេ។
// កូដមុនកែហៅ `setServerTimeOffset(serverTimeOffsetMs)` **គ្មានលក្ខខណ្ឌ**
// (ទោះ `val` មិនមែនជាលេខក៏ដោយ) ➜ ម៉ូឌុល License ជឿថា **នាឡិកាឧបករណ៍ឆៅ**
// ជាម៉ោង server ➜ ទូរស័ព្ទដែលអស់ថ្មរួច boot ទៅថ្ងៃខុស (ឬអ្នកប្រើកែថ្ងៃដោយដៃ)
// **លុប License របស់អតិថិជនជាអចិន្ត្រៃយ៍** ខណៈវានៅមានសុពលភាព។
// នោះជាថ្នាក់ដដែលបេះបិទនឹងអ្វីដែល 2.20.1 មកបិទ — វិលមកតាមទ្វារផ្សេង។
//
// ZoeKeyGen មានស្នាមដដែល ហើយ **ធ្ងន់ជាង**៖ វាបើក `serverTimeSynced` ផ្ទាល់ខ្លួន
// និងដោះ `serverTimeSyncWaiters` ➜ ការការពារ «មិនអាចផ្ទៀងផ្ទាត់ម៉ោង Server
// បានទេ ➜ មិនចេញ Key» ក្លាយជា **ការការពារដែលងាប់** ➜ Key ត្រូវ sign ដោយ
// `iat`/`exp` ខុស ខណៈប្រអប់រាយការណ៍ជោគជ័យ។
//
// ⚠️ ឯកសារនេះរត់ **កូដពិត** ៖ `attachInfoListeners()` ដកចេញពី `app.js` ពិត
// បូក `license-verify.js` **ទាំងឯកសារ** (គ្មានការជំនួស logic) ក្នុង `vm`។
// មានតែ primitive របស់ WebCrypto ទេដែលជា stub — ព្រោះកូនសោឯកជនមិននៅក្នុង repo។
//
// ការអះអាងជា **២ ខាង** ដោយចេតនា៖ «កុំទុកចិត្ត» តែម្យ៉ាងនឹងបៃតងទោះការចិញ្ចឹម
// នាឡិកាត្រូវបានដកចេញទាំងស្រុង — ដែលនឹងធ្វើឲ្យ retention ប្រើនាឡិកាឧបករណ៍។
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = process.env.LICENSECLOCK_APP_DIR
    ? path.resolve(process.env.LICENSECLOCK_APP_DIR)
    : path.resolve(__dirname, '..');

const APPS = ['ZoeW', 'ZoeKeyGen'];

let pass = 0, fail = 0;
function ok(label, cond, detail) {
    if (cond) { console.log('   ok    ' + label); pass++; }
    else { console.log('  FAIL   ' + label + (detail !== undefined ? '  got: ' + JSON.stringify(detail) : '')); fail++; }
}

function sliceFn(src, name) {
    const re = new RegExp('(?:^|\\n)[ \\t]*(?:async[ \\t]+)?function[ \\t]+' + name + '[ \\t]*\\(');
    const m = re.exec(src);
    if (!m) return null;
    const open = src.indexOf('{', m.index + m[0].length - 1);
    if (open === -1) return null;
    let depth = 0;
    for (let i = open; i < src.length; i++) {
        if (src[i] === '{') depth++;
        else if (src[i] === '}') { depth--; if (!depth) return src.slice(m.index, i + 1); }
    }
    return null;
}

// ឈ្មោះដែល sandbox ផ្តល់ជា stub រួចហើយ — អ្វីដែលនៅសល់ត្រូវដកចេញពី app.js ពិត
const STUBBED = new Set([
    'clearInfoListenerRecovery', 'clearReconnectWatchdog', 'retryFailedDbListenersNow',
    'flushPendingHistoryPatches', 'scheduleReconnectWatchdog', 'renderConnectionStatus',
    'handleInfoListenerError', 'retryPendingRoleCheck', 'onValue', 'off', 'val',
    'setServerTimeOffset', 'splice', 'forEach', 'catch', 'then', 'get'
]);

// រាល់ helper ដែល `attachInfoListeners()` ហៅ ហើយមិនមែន stub ➜ ដកចេញពី app.js
// ដោយស្វ័យប្រវត្តិ។ ⛔ កុំដាក់ឈ្មោះ helper ឲ្យថេរត្រង់នេះ — ការធ្វើដូចនោះ
// ចងតេស្តទៅនឹងទម្រង់នៃការកែមួយជាក់លាក់ ហើយជុំក្រោយដែលប្តូរឈ្មោះនឹងធ្វើឲ្យ
// តេស្តធ្លាក់ដោយហេតុផលមិនពាក់ព័ន្ធ។
function collectHelpers(appSrc, body) {
    const out = [];
    const seen = new Set();
    const scan = (text) => {
        const re = /\b([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/g;
        let m;
        while ((m = re.exec(text))) {
            const name = m[1];
            if (STUBBED.has(name) || seen.has(name) || name === 'attachInfoListeners') continue;
            seen.add(name);
            const fnSrc = sliceFn(appSrc, name);
            if (!fnSrc) continue;
            out.push(fnSrc);
            scan(fnSrc);
        }
    };
    scan(body);
    return out.join('\n');
}

// WebCrypto ៖ មានតែ primitive ទេដែលជា stub។ រាល់ logic របស់ License នៅពិត។
function fakeCrypto(signatureValid) {
    return {
        subtle: {
            importKey: () => Promise.resolve({ __key: true }),
            verify: () => Promise.resolve(signatureValid !== false)
        }
    };
}

function makeKeyString(payload) {
    const b64 = (s) => Buffer.from(s, 'utf8').toString('base64')
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return 'ZOEKEY-' + b64(JSON.stringify(payload)) + '.' + b64('signature-bytes');
}

// បរិស្ថានតែមួយដែលកាន់ **ទាំង** `license-verify.js` ពិត និង
// `attachInfoListeners()` ពិតរបស់ App — នោះជាចំណុចទាំងមូលនៃឯកសារនេះ។
function buildEnv(app, opts) {
    opts = opts || {};
    const appSrc = fs.readFileSync(path.join(ROOT, app, 'app.js'), 'utf8');
    const licSrc = fs.readFileSync(path.join(ROOT, 'ZoeW/license-verify.js'), 'utf8');
    const body = sliceFn(appSrc, 'attachInfoListeners');
    if (!body) return null;

    const store = Object.assign({}, opts.store);
    const clock = { now: opts.now || Date.now() };
    const RealDate = Date;
    function FakeDate(...args) {
        if (!(this instanceof FakeDate)) return new RealDate(...args).toString();
        return args.length ? new RealDate(...args) : new RealDate(clock.now);
    }
    FakeDate.now = () => clock.now;
    FakeDate.prototype = RealDate.prototype;

    const sandbox = {
        console, Promise, Error, JSON, Object, Array, Number, String, Boolean, isNaN,
        Math, Map, Set, RegExp, setTimeout, clearTimeout, AbortController,
        TextEncoder, TextDecoder, Uint8Array,
        Date: FakeDate,
        navigator: { onLine: opts.onLine !== false },
        crypto: fakeCrypto(opts.signatureValid),
        atob: (s) => Buffer.from(s, 'base64').toString('binary'),
        btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
        localStorage: {
            getItem: (k) => (k in store ? store[k] : null),
            setItem: (k, v) => { store[k] = v; },
            removeItem: (k) => { delete store[k]; }
        },
        fetch: () => Promise.reject(new Error('offline')),
        document: { getElementById: () => null },
        __store: store, __clock: clock
    };
    sandbox.window = sandbox;
    sandbox.global = sandbox;
    const ctx = vm.createContext(sandbox);

    vm.runInContext(licSrc, ctx);

    vm.runInContext(`
        let serverTimeOffsetMs = 0;
        let serverTimeSynced = false;
        let serverTimeSyncWaiters = [];
        let isDatabaseConnected = false;
        let hasEverConnectedToDatabase = false;
        let dbRefConnected = 'connected';
        let dbRefServerTimeOffset = 'offset';
        let db = {}, fb = null;
        let __waitersReleased = 0;
        function clearInfoListenerRecovery() {}
        function clearReconnectWatchdog() {}
        function retryFailedDbListenersNow() {}
        function flushPendingHistoryPatches() {}
        function scheduleReconnectWatchdog() {}
        function renderConnectionStatus() {}
        function handleInfoListenerError() {}
        function noteInfoListenerAlive() {}
        const infoListenerFailedPaths = new Set();
        const INFO_LISTENER_KEY_CONNECTED = 'connected';
        const INFO_LISTENER_KEY_OFFSET = 'serverTimeOffset';
        function retryPendingRoleCheck() {}
        ${collectHelpers(appSrc, body)}
        ${body}
        globalThis.__drive = (connected, offsetValue, offsetOnly) => {
            fb = {
                off() {},
                onValue(ref, cb) {
                    if (ref === 'connected') { if (!offsetOnly) cb({ val: () => connected }); return; }
                    cb({ val: () => offsetValue });
                }
            };
            attachInfoListeners();
        };
        globalThis.__state = () => ({
            appOffset: serverTimeOffsetMs,
            appSynced: serverTimeSynced,
            waitersPending: serverTimeSyncWaiters.length
        });
        globalThis.__armWaiter = () => { serverTimeSyncWaiters.push(() => { __waitersReleased++; }); };
        globalThis.__released = () => __waitersReleased;
    `, ctx);

    return { ctx, store, clock, sandbox };
}

console.log('=== នាឡិកា License ត្រូវទុកចិត្តតែតម្លៃដែលមកពី server ===');

// ── ជាន់អប្បបរមា ៖ ការស្កេនទទេមិនត្រូវបៃតង ─────────────────────────────
const found = APPS.filter((a) => fs.existsSync(path.join(ROOT, a, 'app.js'))
    && sliceFn(fs.readFileSync(path.join(ROOT, a, 'app.js'), 'utf8'), 'attachInfoListeners'));
ok('ជាន់អប្បបរមា ៖ រកឃើញ `attachInfoListeners()` ក្នុង App >= ២',
    found.length >= 2, found);
ok('ជាន់អប្បបរមា ៖ `license-verify.js` មានវត្តមាន',
    fs.existsSync(path.join(ROOT, 'ZoeW/license-verify.js')));

if (found.length < 2 || !fs.existsSync(path.join(ROOT, 'ZoeW/license-verify.js'))) {
    console.log('\n' + pass + ' ok, ' + fail + ' FAIL');
    process.exit(fail ? 1 : 0);
}

let scenarios = 0;

for (const app of APPS) {
    console.log('\n== ' + app + ' ==');

    // ១ — មុន handshake ៖ `.info/serverTimeOffset` បាញ់តម្លៃមូលដ្ឋាន
    //     ⛔ វា **មិនត្រូវ** ធ្វើឲ្យនាឡិកាឧបករណ៍ក្លាយជា «ម៉ោង server»
    for (const pre of [null, 0]) {
        const env = buildEnv(app, { onLine: false });
        env.sandbox.__drive(false, pre);
        const offset = env.ctx.ZoeLicense.getServerTimeOffset();
        scenarios++;
        ok(app + ' ៖ មុន handshake តម្លៃ `' + JSON.stringify(pre) + '` ➜ License នៅ **មិនទាន់ sync**',
            offset === null, offset);
    }

    // ១ខ — តម្លៃមិនមែនលេខ (node ទទេ) ក៏មិនត្រូវប្រាប់ថា sync ដែរ
    {
        const env = buildEnv(app, { onLine: false });
        env.sandbox.__drive(false, undefined);
        const offset = env.ctx.ZoeLicense.getServerTimeOffset();
        scenarios++;
        ok(app + ' ៖ តម្លៃមិនមែនលេខ ➜ License នៅ **មិនទាន់ sync**', offset === null, offset);
    }

    // ២ — ទិសផ្ទុយ ៖ offset ពិតពី handshake **ត្រូវតែ** ឆ្លងទៅដល់ License
    //     បើអត់ការអះអាងនេះ ការ «កុំទុកចិត្ត» នឹងបៃតង ទោះការចិញ្ចឹមត្រូវដកចេញ
    {
        const env = buildEnv(app, { onLine: true });
        env.sandbox.__drive(true, -45000);
        const offset = env.ctx.ZoeLicense.getServerTimeOffset();
        scenarios++;
        ok(app + ' ៖ ⛔ ទិសផ្ទុយ — offset ពិត (-45000) **ត្រូវឆ្លងទៅដល់** License',
            offset === -45000, offset);
    }

    // ២ក — offset ពិតដែលមកដល់ **មុន** `.info/connected === true`
    //      RTDB អាចផ្ញើ offset មុនស្ថានភាពការភ្ជាប់។ ច្រកទ្វារត្រូវ
    //      **មិនអាស្រ័យលើលំដាប់** — បើមិនដូច្នេះ offset ពិតត្រូវទម្លាក់ចោល
    //      ហើយ App ធ្លាក់ទៅនាឡិកាឧបករណ៍ដោយស្ងាត់។
    {
        const env = buildEnv(app, { onLine: true });
        env.sandbox.__drive(false, -45000, true);
        const offset = env.ctx.ZoeLicense.getServerTimeOffset();
        scenarios++;
        ok(app + ' ៖ ⛔ offset ពិតមកដល់ **មុន** `connected` ➜ ត្រូវទទួលយកដដែល',
            offset === -45000, offset);
    }

    // ២ខ — offset ០ ដែលមកដល់ **ក្រោយ** ភ្ជាប់រួច ជាតម្លៃពិត ➜ ត្រូវទទួលយក
    {
        const env = buildEnv(app, { onLine: true });
        env.sandbox.__drive(true, 7000);
        env.sandbox.__drive(true, 0, true);
        const offset = env.ctx.ZoeLicense.getServerTimeOffset();
        scenarios++;
        ok(app + ' ៖ offset ០ ក្រោយភ្ជាប់រួច ➜ ត្រូវទទួលយក (មិនត្រូវច្រានចោល)',
            offset === 0, offset);
    }
}

// ── ៣. ZoeKeyGen ៖ ការការពារ «មិនអាចផ្ទៀងផ្ទាត់ម៉ោង ➜ មិនចេញ Key» ────────
{
    const env = buildEnv('ZoeKeyGen', { onLine: false });
    env.sandbox.__armWaiter();
    env.sandbox.__drive(false, null);
    const st = env.sandbox.__state();
    scenarios++;
    ok('ZoeKeyGen ៖ មុន handshake ➜ `serverTimeSynced` នៅ **false**', st.appSynced === false, st);
    scenarios++;
    ok('ZoeKeyGen ៖ មុន handshake ➜ អ្នករង់ចាំម៉ោង **មិនត្រូវដោះ** (ការការពារនៅរស់)',
        env.sandbox.__released() === 0, env.sandbox.__released());
}
{
    const env = buildEnv('ZoeKeyGen', { onLine: true });
    env.sandbox.__armWaiter();
    env.sandbox.__drive(true, -45000);
    scenarios++;
    ok('ZoeKeyGen ៖ ⛔ ទិសផ្ទុយ — handshake ពិត ➜ អ្នករង់ចាំ **ត្រូវដោះ**',
        env.sandbox.__released() === 1 && env.sandbox.__state().appSynced === true,
        { released: env.sandbox.__released(), state: env.sandbox.__state() });
}

// ── ៤. ចុងបញ្ចប់ ៖ លទ្ធផលពិតលើ record របស់អតិថិជន ───────────────────────
//     ទូរស័ព្ទក្រៅបណ្តាញ + នាឡិកាលោតទៅមុខ ១ ឆ្នាំ ➜ ⛔ **មិនត្រូវលុប License**
const APP_CODE = 'ADM';
const REAL_NOW = 1780000000000;
const signedExpSec = Math.floor((REAL_NOW + 200 * 86400000) / 1000);
const keyString = makeKeyString({ a: APP_CODE, id: 'KEYID1', iat: 1, exp: signedExpSec, note: '' });
const recordOf = () => JSON.stringify({
    keyString: keyString, id: 'KEYID1', a: APP_CODE, iat: 1, exp: signedExpSec,
    note: '', lastOnlineCheck: REAL_NOW, onlineExp: REAL_NOW + 200 * 86400000
});

(async () => {
    {
        const env = buildEnv('ZoeW', {
            onLine: false,
            now: REAL_NOW + 365 * 86400000,
            store: { ['zoe_license_activation_' + APP_CODE]: recordOf() }
        });
        env.sandbox.__drive(false, null);
        const st = await env.ctx.ZoeLicense.getStatus(APP_CODE);
        scenarios++;
        ok('⛔ ក្រៅបណ្តាញ + នាឡិកាឧបករណ៍លោត ១ ឆ្នាំ ➜ License **មិនត្រូវលុប**',
            !!env.store['zoe_license_activation_' + APP_CODE], Object.keys(env.store));
        scenarios++;
        ok('   ហើយត្រូវរាយការណ៍ថា «ត្រូវការភ្ជាប់អ៊ីនធឺណិត» មិនមែន «ផុតកំណត់»',
            st.state === 'offline-grace-exceeded', st);
    }

    // ទិសផ្ទុយ ៖ នាឡិកា sync ពិតពី server ហើយពិតជាហួស ➜ ការលុប **ត្រឹមត្រូវ**
    {
        const env = buildEnv('ZoeW', {
            onLine: true,
            now: REAL_NOW,
            store: { ['zoe_license_activation_' + APP_CODE]: recordOf() }
        });
        env.sandbox.__drive(true, 365 * 86400000);
        const st = await env.ctx.ZoeLicense.getStatus(APP_CODE);
        scenarios++;
        ok('⛔ ទិសផ្ទុយ ៖ ម៉ោង server ពិតបញ្ជាក់ថាហួស ➜ **មិនត្រូវផ្តល់សិទ្ធិ**',
            st.state !== 'active', st);
        scenarios++;
        // កំណែ 2.20.6 ៖ ការលុបត្រូវរង់ចាំសាលក្រម `checkOnline()` ពិត។
        // ហេតុផល ៖ `serverTimeSynced` នៅ `true` បន្តទោះក្រោយចាកចេញពីបណ្តាញ
        // ហើយ offset ក្លាយជាចាស់ ➜ `getServerNow()` រំកិលតាម **នាឡិកាឧបករណ៍**
        // ម្តងទៀត។ ការលុបតាមសញ្ញានោះ ធ្វើឲ្យការប្តូរថ្ងៃទូរស័ព្ទ **លុប Key
        // របស់អតិថិជន**។ ការមិនផ្តល់សិទ្ធិ (`offline-grace-exceeded`) បិទ
        // ការចូលប្រើរួចហើយ ➜ ការលុបមិនបន្ថែមសុវត្ថិភាពទេ។ សាលក្រម server
        // ពិត (`expired-server`) នៅតែលុបដដែល — ចាក់សោដោយ
        // `license-grace-test.js` និង `license-clock-rollback-test.js` ច.៤។
        ok('   តែ record ត្រូវរក្សាទុក ៖ ការលុបទាមទារសាលក្រម checkOnline ពិត',
            !!env.store['zoe_license_activation_' + APP_CODE], Object.keys(env.store));
    }

    ok('ជាន់អប្បបរមា ៖ សេណារីយ៉ូដែលរត់ពិត >= ១៤', scenarios >= 14, scenarios);

    console.log('\n' + pass + ' ok, ' + fail + ' FAIL');
    process.exit(fail ? 1 : 0);
})();
