// ថ្នាក់ ៖ **Edge Function ចុះឈ្មោះ/កំណត់ពាក្យសម្ងាត់ថ្មី ជាច្រកតែមួយដែលបង្កើតគណនី ➜ វាជាព្រំដែនសុវត្ថិភាព។**
//
//   npm ci --prefix supabase
//   node audit-tools/supabase-functions-test.js
//
// ⛔ អ្វីដែលវាស់ ៖
//   ១. token OTP របស់ Firebase ៖ សោ RSA **ពិត** (WebCrypto) · គ្រប់សាខាបដិសេធ (alg · kid · aud · iss · exp · iat ·
//      auth_time · provider · លេខ · ហត្ថលេខា) · ការបង្វិលសោ · cache/ពិដាន/ការព្យួររបស់ JWKS
//   ២. លំហូរចុះឈ្មោះ/កំណត់ពាក្យសម្ងាត់ ៖ លំដាប់ការហៅ (គ្មានការបង្កើតគណនីមុន OTP + កូដអញ្ជើញឆ្លង) · rollback តែលើ
//      ការបដិសេធច្បាស់ · **លទ្ធផលមិនដឹង ➜ មិនលុបគណនី** · ការព្យាយាមម្តងទៀតលើ RPC idempotent
//   ៣. HTTP ៖ CORS តាម origin · 405/413/400/503 · កំហុសខាងក្នុងមិនលេចក្នុងចម្លើយ
//   ៤. **ស្នាមភ្ជាប់ពិត** ៖ supabase-js ពិត (កំណែ pin) ទល់នឹងម៉ាស៊ីនមេក្លែង GoTrue/PostgREST ➜ ឈ្មោះ argument RPC ស្មើ SQL
//      ពិត (PostgREST ផ្គូផ្គងតាមឈ្មោះ) · header ដែល SDK ផ្ញើ ⊂ Access-Control-Allow-Headers (preflight)
//   ៥. tsc (strict) លើ type ពិតរបស់ supabase-js · wiring index.ts ↔ config.toml ↔ package.json
//   ៦. **mutation** លើ TS ពិត ➜ អ្នកយាមត្រូវក្រហម
// ⛔ គ្មាន supabase/node_modules ➜ ផ្នែក ៤–៥ SKIP (PARTIAL) · `SUPABASE_STRICT=1` ➜ FAIL។
'use strict';

process.exitCode = 1;

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const cp = require('child_process');
const nodeCrypto = require('crypto');
const { pathToFileURL } = require('url');

const ROOT = process.env.SUPABASE_FN_APP_DIR ? path.resolve(process.env.SUPABASE_FN_APP_DIR) : path.join(__dirname, '..');
const REPO = process.env.ZOE_REPO_ROOT ? path.resolve(process.env.ZOE_REPO_ROOT) : path.join(__dirname, '..');
const STRICT = process.env.SUPABASE_STRICT === '1';
const SB = path.join(ROOT, 'supabase');
const FN_DIR = path.join(SB, 'functions');
const SHARED = path.join(FN_DIR, '_shared');
const DEPS_DIRS = [process.env.SUPABASE_DEPS_DIR, path.join(SB, 'node_modules'), path.join(REPO, 'supabase', 'node_modules')].filter(Boolean);
const SHARED_FILES = ['invite-code.ts', 'timeout.ts', 'firebase-phone-token.ts', 'account-core.ts', 'http.ts', 'admin-deps.ts'];

let pass = 0, fail = 0, skipped = [];
function ok(label, cond, detail) {
    if (cond) { pass++; console.log('  ok    ' + label); }
    else { fail++; console.log('  FAIL  ' + label + (detail !== undefined ? '\n        ' + JSON.stringify(detail) : '')); }
}
function skipPart(reason) {
    if (STRICT) ok('SUPABASE_STRICT=1 ៖ ' + reason, false);
    else skipped.push(reason);
}
function finish() {
    if (skipped.length) console.log('SKIP ' + skipped.join(' · ') + ' (រត់ ៖ npm ci --prefix supabase)');
    console.log('\n' + (fail === 0 ? '✅ ជោគជ័យ ' + pass : '❌ ធ្លាក់ ' + fail + ' (ជោគជ័យ ' + pass + ')'));
    process.exitCode = fail === 0 ? 0 : 1;
}
const read = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '');
const depPath = (rel) => DEPS_DIRS.map((d) => path.join(d, rel)).find((p) => fs.existsSync(p)) || null;

const PID = 'zoe-otp-test';
const NOW = 1800000000;
const KEY = 'sb_secret_' + 'k'.repeat(40);
const USER_ID = '6f1c1c9e-2d3b-4c5a-9e8f-0a1b2c3d4e5f';
const FAIL_ID = '00000000-0000-4000-8000-00000000dead';
const b64u = (buf) => Buffer.from(buf).toString('base64url');
let rsa1, rsa2, jwk1, jwk2;

async function makeKeys() {
    const gen = () => crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
        true, ['sign', 'verify']);
    rsa1 = await gen();
    rsa2 = await gen();
    const pub = async (k, kid) => Object.assign(await crypto.subtle.exportKey('jwk', k.publicKey), { kid, alg: 'RS256', use: 'sig' });
    jwk1 = await pub(rsa1, 'k1');
    jwk2 = await pub(rsa2, 'k2');
}
async function signJwt(header, payload, privateKey) {
    const h = b64u(JSON.stringify(header));
    const p = b64u(JSON.stringify(payload));
    const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', privateKey, Buffer.from(h + '.' + p));
    return h + '.' + p + '.' + b64u(Buffer.from(sig));
}
function claims(over) {
    return Object.assign({
        iss: 'https://securetoken.google.com/' + PID, aud: PID, auth_time: NOW - 10, user_id: 'uid1', sub: 'uid1',
        iat: NOW - 10, exp: NOW + 3590, phone_number: '+85512345678',
        firebase: { identities: { phone: ['+85512345678'] }, sign_in_provider: 'phone' }
    }, over);
}
const H1 = { alg: 'RS256', kid: 'k1', typ: 'JWT' };

async function groupToken(m, rec) {
    const T = m.token;
    let keyCalls = [];
    const keys = async (refresh) => { keyCalls.push(refresh); return refresh ? [jwk1, jwk2] : [jwk1]; };
    const verify = (tok, opts) => T.verifyFirebasePhoneToken(tok, Object.assign({ projectId: PID, keys, nowSeconds: NOW }, opts || {}));
    const good = await signJwt(H1, claims(), rsa1.privateKey);
    const r = await verify(good);
    rec('token OTP ត្រឹមត្រូវ ➜ ok · លេខ · uid', r.ok === true && r.phone === '+85512345678' && r.uid === 'uid1', r);
    const cases = [
        ['projectId មិនបានកំណត់', good, { projectId: '' }, 'server-unconfigured'],
        ['projectId ខុសទម្រង់', good, { projectId: 'Bad_Project' }, 'server-unconfigured'],
        ['token ទទេ', '', null, 'token-missing'],
        ['token មិនមែនខ្សែអក្សរ', 42, null, 'token-missing'],
        ['token វែងលើស ៤០៩៦', 'a'.repeat(4097), null, 'token-malformed'],
        ['token មាន ២ ផ្នែក', good.split('.').slice(0, 2).join('.'), null, 'token-malformed'],
        ['base64 មានតួហាម', good.replace(/^[^.]+/, 'ab+/'), null, 'token-malformed'],
        ['payload ជា array', b64u('{"alg":"RS256","kid":"k1"}') + '.' + b64u('[1]') + '.' + good.split('.')[2], null, 'token-malformed'],
        ['ហត្ថលេខាទទេ', good.split('.').slice(0, 2).join('.') + '.', null, 'token-malformed']
    ];
    for (const [label, tok, opts, want] of cases) {
        const v = await verify(tok, opts);
        rec('token ៖ ' + label + ' ➜ ' + want, !v.ok && v.reason === want, v);
    }
    const unsigned = b64u(JSON.stringify({ alg: 'none', kid: 'k1' })) + '.' + b64u(JSON.stringify(claims())) + '.' + b64u('x');
    rec('token ៖ alg none (គ្មានហត្ថលេខា) ➜ token-alg', ((v) => !v.ok && v.reason === 'token-alg')(await verify(unsigned)));
    const hsHead = b64u(JSON.stringify({ alg: 'HS256', kid: 'k1' })) + '.' + b64u(JSON.stringify(claims()));
    const hs = hsHead + '.' + b64u(nodeCrypto.createHmac('sha256', JSON.stringify(jwk1)).update(hsHead).digest());
    rec('token ៖ HS256 ដោយប្រើ public key ជា secret ➜ token-alg', ((v) => !v.ok && v.reason === 'token-alg')(await verify(hs)));
    const claimCases = [
        ['គ្មាន kid', { alg: 'RS256' }, {}, 'token-kid'],
        ['aud ជា Project ផ្សេង', H1, { aud: 'other-project' }, 'token-aud'],
        ['iss ជា Project ផ្សេង', H1, { iss: 'https://securetoken.google.com/other-project' }, 'token-iss'],
        ['exp = ឥឡូវ', H1, { exp: NOW }, 'token-expired'],
        ['exp ជាខ្សែអក្សរ', H1, { exp: String(NOW + 100) }, 'token-expired'],
        ['iat អនាគតលើស skew', H1, { iat: NOW + 61 }, 'token-future'],
        ['auth_time អនាគតលើស skew', H1, { auth_time: NOW + 61 }, 'token-future'],
        ['auth_time ចាស់ ៣០១ វិ.', H1, { auth_time: NOW - 301 }, 'otp-stale'],
        ['គ្មាន sub', H1, { sub: undefined }, 'token-sub'],
        ['sub វែង ១២៩', H1, { sub: 'u'.repeat(129) }, 'token-sub'],
        ['provider = password', H1, { firebase: { sign_in_provider: 'password' } }, 'otp-provider'],
        ['គ្មាន firebase', H1, { firebase: undefined }, 'otp-provider'],
        ['គ្មានលេខទូរស័ព្ទ', H1, { phone_number: undefined }, 'otp-phone'],
        ['លេខមិនមែន E.164', H1, { phone_number: '012345678' }, 'otp-phone']
    ];
    for (const [label, header, over, want] of claimCases) {
        const v = await verify(await signJwt(header, claims(over), rsa1.privateKey));
        rec('token ៖ ' + label + ' ➜ ' + want, !v.ok && v.reason === want, v);
    }
    const edges = [
        ['auth_time ចាស់ ៣០០ វិ. (ព្រំដែន)', { auth_time: NOW - 300 }],
        ['exp = ឥឡូវ + ១', { exp: NOW + 1 }],
        ['iat អនាគត ៦០ វិ. (skew)', { iat: NOW + 60 }]
    ];
    for (const [label, over] of edges) {
        const v = await verify(await signJwt(H1, claims(over), rsa1.privateKey));
        rec('token ៖ ' + label + ' ➜ ok', v.ok === true, v);
    }
    const [h, p, s] = good.split('.');
    const tampered = h + '.' + b64u(JSON.stringify(claims({ phone_number: '+85598765432' }))) + '.' + s;
    rec('token ៖ ប្តូរលេខក្រោយ sign ➜ token-signature', ((v) => !v.ok && v.reason === 'token-signature')(await verify(tampered)));
    rec('token ៖ header kid=k1 តែ sign ដោយសោផ្សេង ➜ token-signature',
        ((v) => !v.ok && v.reason === 'token-signature')(await verify(await signJwt(H1, claims(), rsa2.privateKey))));
    keyCalls = [];
    const rotated = await verify(await signJwt({ alg: 'RS256', kid: 'k2' }, claims(), rsa2.privateKey));
    rec('token ៖ សោបង្វិល (k2 មិនទាន់ក្នុង cache) ➜ ទាញម្តងទៀត ➜ ok', rotated.ok === true && JSON.stringify(keyCalls) === '[false,true]',
        { rotated, keyCalls });
    keyCalls = [];
    const unknown = await verify(await signJwt({ alg: 'RS256', kid: 'k9' }, claims(), rsa1.privateKey));
    rec('token ៖ kid មិនស្គាល់ ➜ token-kid (ទាញម្តងទៀតតែ ១)', !unknown.ok && unknown.reason === 'token-kid' && JSON.stringify(keyCalls) === '[false,true]',
        { unknown, keyCalls });
    keyCalls = [];
    await verify(await signJwt(H1, claims({ aud: 'other-project' }), rsa1.privateKey));
    rec('token ៖ claim ខុស ➜ មិនទាញសោ (ថោក)', keyCalls.length === 0, keyCalls);
    const down = await T.verifyFirebasePhoneToken(good, { projectId: PID, nowSeconds: NOW, keys: async () => { throw new Error('net'); } });
    rec('token ៖ ទាញសោមិនបាន ➜ keys-unavailable (មិនមែន «token ខុស»)', !down.ok && down.reason === 'keys-unavailable', down);
}

async function groupKeySource(m, rec) {
    const T = m.token;
    let t = 0, calls = 0, mode = 'ok', lastUrl = '';
    const body = { keys: [jwk1, { kty: 'EC', kid: 'e1', crv: 'P-256' }, Object.assign({}, jwk2, { alg: 'RS512' }), Object.assign({}, jwk2, { kid: 'enc', use: 'enc' })] };
    const fetchFn = async (url) => {
        calls++;
        lastUrl = String(url);
        if (mode === 'fail') throw new Error('net');
        if (mode === 'hang') return new Promise(() => {});
        if (mode === 'bad') return new Response(JSON.stringify({ nope: 1 }), { status: 200 });
        if (mode === 'http500') return new Response('{}', { status: 500 });
        return new Response(JSON.stringify(body), { status: 200 });
    };
    const opts = { now: () => t, ttlMs: 1000, refreshGapMs: 100, timeoutMs: 50 };
    const src = T.createCachedKeySource(fetchFn, opts);
    const first = await src(false);
    rec('JWKS ៖ ទាញពី URL របស់ Google តាមលំនាំដើម', lastUrl === T.GOOGLE_SECURETOKEN_JWKS_URL, lastUrl);
    rec('JWKS ៖ ទុកតែសោ RSA · RS256 · sig (ច្រោះ EC/RS512/enc)', first.length === 1 && first[0].kid === 'k1', first.map((k) => k.kid));
    t = 10; await src(false);
    rec('JWKS ៖ ក្នុង TTL ➜ មិនទាញម្តងទៀត', calls === 1, calls);
    t = 50; await src(true);
    rec('JWKS ៖ refresh ក្នុងចន្លោះ ១០០ms ➜ មិនទាញ (kid ចៃដន្យមិនបង្ខំការទាញ)', calls === 1, calls);
    t = 200; await src(true);
    rec('JWKS ៖ refresh ក្រោយចន្លោះ ➜ ទាញ', calls === 2, calls);
    t = 1300; await src(false);
    rec('JWKS ៖ TTL ផុត ➜ ទាញ', calls === 3, calls);
    mode = 'fail'; t = 2500;
    const stale = await src(false).catch(() => null);
    rec('JWKS ៖ ទាញធ្លាក់ តែមាន cache ➜ ប្រើ cache ចាស់', !!stale && stale.length === 1 && calls === 4, { calls });
    const settle = async (source) => {
        const t0 = Date.now();
        const out = await Promise.race([source(false).then(() => 'resolved', () => 'rejected'),
            new Promise((r) => setTimeout(() => r('hung'), 3000))]);
        return { out, ms: Date.now() - t0 };
    };
    mode = 'fail';
    rec('JWKS ៖ ទាញធ្លាក់ · គ្មាន cache ➜ បដិសេធ', (await settle(T.createCachedKeySource(fetchFn, opts))).out === 'rejected');
    mode = 'hang';
    const hung = await settle(T.createCachedKeySource(fetchFn, opts));
    rec('JWKS ៖ fetch ព្យួរ (មិនស្តាប់ abort) ➜ បដិសេធក្នុងពិដាន', hung.out === 'rejected' && hung.ms < 2000, hung);
    mode = 'bad';
    rec('JWKS ៖ រូបរាង JSON ខុស ➜ បដិសេធ', (await settle(T.createCachedKeySource(fetchFn, opts))).out === 'rejected');
    mode = 'http500';
    rec('JWKS ៖ HTTP 500 ➜ បដិសេធ', (await settle(T.createCachedKeySource(fetchFn, opts))).out === 'rejected');
    mode = 'ok'; calls = 0;
    const dedupe = T.createCachedKeySource(fetchFn, opts);
    await Promise.all([dedupe(false), dedupe(false), dedupe(false)]);
    rec('JWKS ៖ ការហៅស្របគ្នា ➜ ទាញតែ ១', calls === 1, calls);
}

async function groupInvite(m, rec) {
    const I = m.invite;
    const n = I.normalizeInviteCode;
    rec('កូដអញ្ជើញ ៖ អក្សរតូច + សញ្ញាចុច ➜ អក្សរធំគ្មានសញ្ញា', n('abcd-efgh-jkmn-pqrs-tvwx') === 'ABCDEFGHJKMNPQRSTVWX');
    rec('កូដអញ្ជើញ ៖ O ➜ 0 · I/L ➜ 1', n('OOOO IIII LLLL 2345 6789') === '00001111111123456789');
    rec('កូដអញ្ជើញ ៖ U (មិននៅក្នុង alphabet) ➜ null', n('UUUU-AAAA-BBBB-CCCC-DDDD') === null);
    rec('កូដអញ្ជើញ ៖ ១៩ តួ ➜ null', n('ABCD-EFGH-JKMN-PQRS-TVW') === null);
    rec('កូដអញ្ជើញ ៖ ២១ តួ ➜ null', n('ABCD-EFGH-JKMN-PQRS-TVWXY') === null);
    rec('កូដអញ្ជើញ ៖ មិនមែនខ្សែអក្សរ ➜ null', n(12345) === null && n(null) === null);
    rec('កូដអញ្ជើញ ៖ វែងលើស ៦៤ ➜ null', n('-'.repeat(50) + 'ABCDEFGHJKMNPQRSTVWX') === null);
    const want = nodeCrypto.createHash('sha256').update('zoe-invite:ABCDEFGHJKMNPQRSTVWX').digest('hex');
    rec('កូដអញ្ជើញ ៖ hash = sha256("zoe-invite:" + កូដ) (ស្នាមភ្ជាប់ SQL វាស់ក្នុង supabase-rls)',
        (await I.inviteCodeHash('ABCDEFGHJKMNPQRSTVWX')) === want);
}

function fakeDeps(over) {
    const log = [];
    const phone = (over && over.phone) || '+85512345678';
    const base = {
        verifyPhoneToken: async (t) => { log.push(['verify', t]); return over && over.otp ? over.otp : { ok: true, uid: 'u', phone, authTime: NOW }; },
        inviteIsUsable: async (h) => { log.push(['usable', h]); return over && 'usable' in over ? over.usable : true; },
        createUser: async (email, pw) => { log.push(['create', email, pw]); return over && over.created ? over.created : { ok: true, userId: 'user-1' }; },
        finishRegistration: async (input) => {
            log.push(['finish', input]);
            const queue = over && over.finish;
            if (Array.isArray(queue)) return queue.shift() || { ok: true, tenantId: 't-1', role: 'member' };
            return queue || { ok: true, tenantId: 't-1', role: 'member' };
        },
        deleteUser: async (id) => { log.push(['delete', id]); return over && 'deleted' in over ? over.deleted : true; },
        findMember: async (u, p) => { log.push(['find', u, p]); return over && 'member' in over ? over.member : 'user-9'; },
        updatePassword: async (id, pw) => { log.push(['update', id, pw]); return over && over.update ? over.update : 'ok'; },
        revokeSessions: async (id) => { log.push(['revoke', id]); return over && 'revoked' in over ? over.revoked : true; },
        loginDomain: 'u.zoew.invalid',
        phonePrefixes: ['+855']
    };
    return { deps: base, log, kinds: () => log.map((x) => x[0]).join(',') };
}
const INVITE = 'abcd-efgh-jkmn-pqrs-tvwx';
const REG = { idToken: 'tok', username: ' SoKha ', password: 'secret-pass', invite: INVITE };

async function groupAccount(m, rec) {
    const A = m.account;
    let f = fakeDeps();
    let r = await A.handleRegister(REG, f.deps);
    const wantHash = nodeCrypto.createHash('sha256').update('zoe-invite:ABCDEFGHJKMNPQRSTVWX').digest('hex');
    rec('ចុះឈ្មោះ ៖ ជោគជ័យ ➜ 200 registered + tenant', r.status === 200 && r.body.code === 'registered' && r.body.tenantId === 't-1', r);
    rec('ចុះឈ្មោះ ៖ លំដាប់ verify ➜ usable ➜ create ➜ finish (គ្មាន delete)', f.kinds() === 'verify,usable,create,finish', f.kinds());
    const create = f.log.find((x) => x[0] === 'create');
    rec('ចុះឈ្មោះ ៖ email = username តូច + @loginDomain · ពាក្យសម្ងាត់ដដែល', !!create && create[1] === 'sokha@u.zoew.invalid' && create[2] === 'secret-pass', create);
    const fin = f.log.find((x) => x[0] === 'finish');
    rec('ចុះឈ្មោះ ៖ finish ទទួលលេខពី token (មិនមែនពី body) · hash កូដ · username តូច',
        !!fin && fin[1].phone === '+85512345678' && fin[1].codeHash === wantHash && fin[1].username === 'sokha' && fin[1].userId === 'user-1', fin);
    const early = [
        ['body ជា null', null, 'bad-request'],
        ['body ជា array', [REG], 'bad-request'],
        ['គ្មាន idToken', Object.assign({}, REG, { idToken: '' }), 'bad-request'],
        ['កូដអញ្ជើញខុសទម្រង់', Object.assign({}, REG, { invite: 'short' }), 'invite-invalid'],
        ['username មានចន្លោះកណ្តាល', Object.assign({}, REG, { username: 'so kha' }), 'username-invalid'],
        ['username ខ្លី', Object.assign({}, REG, { username: 'ab' }), 'username-invalid'],
        ['ពាក្យសម្ងាត់ ៧ តួ', Object.assign({}, REG, { password: '1234567' }), 'password-short'],
        ['ពាក្យសម្ងាត់ខ្មែរ ២៥ តួ (៧៥ byte > ៧២ របស់ bcrypt)', Object.assign({}, REG, { password: 'ក'.repeat(25) }), 'password-long']
    ];
    for (const [label, body, code] of early) {
        f = fakeDeps();
        r = await A.handleRegister(body, f.deps);
        rec('ចុះឈ្មោះ ៖ ' + label + ' ➜ 400 ' + code + ' · មិនប៉ះ OTP/DB', r.status === 400 && r.body.code === code && f.log.length === 0, { r, log: f.kinds() });
    }
    f = fakeDeps();
    r = await A.handleRegister(Object.assign({}, REG, { password: 'ក'.repeat(8) }), f.deps);
    rec('ចុះឈ្មោះ ៖ ពាក្យសម្ងាត់ខ្មែរ ៨ តួ (២៤ byte) ➜ ទទួល', r.status === 200, r);
    const otpCases = [
        ['keys-unavailable', 503, 'otp-unverifiable'],
        ['server-unconfigured', 503, 'server-unconfigured'],
        ['otp-stale', 401, 'otp-stale'],
        ['token-signature', 401, 'otp-invalid'],
        ['otp-provider', 401, 'otp-invalid']
    ];
    for (const [reason, status, code] of otpCases) {
        f = fakeDeps({ otp: { ok: false, reason } });
        r = await A.handleRegister(REG, f.deps);
        rec('ចុះឈ្មោះ ៖ OTP ' + reason + ' ➜ ' + status + ' ' + code + ' · មិនបង្កើតគណនី', r.status === status && r.body.code === code && f.kinds() === 'verify', { r, log: f.kinds() });
    }
    f = fakeDeps({ phone: '+66812345678' });
    r = await A.handleRegister(REG, f.deps);
    rec('ចុះឈ្មោះ ៖ លេខក្រៅ +855 ➜ 403 phone-region · មិនបង្កើតគណនី', r.status === 403 && r.body.code === 'phone-region' && f.kinds() === 'verify', { r, log: f.kinds() });
    f = fakeDeps({ usable: false });
    r = await A.handleRegister(REG, f.deps);
    rec('ចុះឈ្មោះ ៖ កូដអញ្ជើញប្រើមិនបាន ➜ 403 · មិនបង្កើតគណនី', r.status === 403 && r.body.code === 'invite-invalid' && f.kinds() === 'verify,usable', { r, log: f.kinds() });
    f = fakeDeps({ usable: null });
    r = await A.handleRegister(REG, f.deps);
    rec('ចុះឈ្មោះ ៖ DB មិនឆ្លើយពេលពិនិត្យកូដ ➜ 502 · មិនបង្កើតគណនី', r.status === 502 && r.body.code === 'db-unavailable' && f.kinds() === 'verify,usable', { r, log: f.kinds() });
    const createCases = [['exists', 409, 'username-taken'], ['weak', 400, 'password-weak'], ['unavailable', 502, 'auth-unavailable']];
    for (const [reason, status, code] of createCases) {
        f = fakeDeps({ created: { ok: false, reason } });
        r = await A.handleRegister(REG, f.deps);
        rec('ចុះឈ្មោះ ៖ createUser ' + reason + ' ➜ ' + status + ' ' + code, r.status === status && r.body.code === code && f.kinds() === 'verify,usable,create', { r, log: f.kinds() });
    }
    const finishCases = [
        ['invite-invalid', 403, 'invite-invalid', true],
        ['phone-taken', 409, 'phone-taken', true],
        ['username-taken', 409, 'username-taken', true],
        ['account-invalid', 400, 'account-invalid', true],
        ['account-exists', 500, 'internal', false],
        ['user-mismatch', 500, 'internal', false]
    ];
    for (const [reason, status, code, rollback] of finishCases) {
        f = fakeDeps({ finish: { ok: false, reason } });
        r = await A.handleRegister(REG, f.deps);
        rec('ចុះឈ្មោះ ៖ finish ' + reason + ' ➜ ' + status + ' ' + code + (rollback ? ' · លុបគណនីវិញ' : ' · មិនលុបគណនី (ភាពមិនប្រក្រតី)'),
            r.status === status && r.body.code === code && f.kinds() === 'verify,usable,create,finish' + (rollback ? ',delete' : ''), { r, log: f.kinds() });
    }
    f = fakeDeps({ finish: [{ ok: false, reason: 'unavailable' }, { ok: true, tenantId: 't-2', role: 'owner' }] });
    r = await A.handleRegister(REG, f.deps);
    rec('ចុះឈ្មោះ ៖ finish មិនដឹងលទ្ធផល ➜ សាកម្តងទៀត (RPC idempotent) ➜ 200', r.status === 200 && r.body.tenantId === 't-2' && f.kinds() === 'verify,usable,create,finish,finish', { r, log: f.kinds() });
    f = fakeDeps({ finish: [{ ok: false, reason: 'unavailable' }, { ok: false, reason: 'unavailable' }] });
    r = await A.handleRegister(REG, f.deps);
    rec('ចុះឈ្មោះ ៖ finish មិនដឹង ២ ដង ➜ 502 registration-unknown · ⛔ មិនលុបគណនី (ប្រហែលជាបានចុះរួច)',
        r.status === 502 && r.body.code === 'registration-unknown' && f.kinds() === 'verify,usable,create,finish,finish', { r, log: f.kinds() });
    f = fakeDeps({ finish: { ok: false, reason: 'phone-taken' }, deleted: false });
    r = await A.handleRegister(REG, f.deps);
    rec('ចុះឈ្មោះ ៖ លុបគណនីវិញមិនបាន ➜ សាក ២ ដង ➜ 500 registration-incomplete',
        r.status === 500 && r.body.code === 'registration-incomplete' && f.kinds() === 'verify,usable,create,finish,delete,delete', { r, log: f.kinds() });

    const RESET = { idToken: 'tok', username: 'Sokha', password: 'new-secret', phone: '+85599999999' };
    f = fakeDeps();
    r = await A.handleResetPassword(RESET, f.deps);
    const find = f.log.find((x) => x[0] === 'find');
    const upd = f.log.find((x) => x[0] === 'update');
    rec('កំណត់ពាក្យសម្ងាត់ថ្មី ៖ ជោគជ័យ ➜ 200', r.status === 200 && r.body.code === 'password-reset', r);
    rec('កំណត់ពាក្យសម្ងាត់ថ្មី ៖ រកសមាជិកដោយលេខពី token (មិនមែន body.phone)', !!find && find[1] === 'sokha' && find[2] === '+85512345678', find);
    rec('កំណត់ពាក្យសម្ងាត់ថ្មី ៖ ប្តូរពាក្យសម្ងាត់របស់ user id ដែលរកឃើញ', !!upd && upd[1] === 'user-9' && upd[2] === 'new-secret', upd);
    rec('កំណត់ពាក្យសម្ងាត់ថ្មី ៖ ប្តូររួច ➜ ផ្តាច់ session ចាស់ (លំដាប់ update ➜ revoke)', f.kinds() === 'verify,find,update,revoke'
        && JSON.stringify(f.log[3]) === JSON.stringify(['revoke', 'user-9']), f.kinds());
    f = fakeDeps({ revoked: false });
    r = await A.handleResetPassword(RESET, f.deps);
    rec('កំណត់ពាក្យសម្ងាត់ថ្មី ៖ ផ្តាច់ session មិនបាន ➜ សាក ២ ដង ➜ 200 password-reset-sessions-kept (និយាយការពិត)',
        r.status === 200 && r.body.code === 'password-reset-sessions-kept' && f.kinds() === 'verify,find,update,revoke,revoke', { r, log: f.kinds() });
    f = fakeDeps({ member: null });
    r = await A.handleResetPassword(RESET, f.deps);
    rec('កំណត់ពាក្យសម្ងាត់ថ្មី ៖ លេខមិនត្រូវនឹង username ➜ 403 · មិនប្តូរ', r.status === 403 && r.body.code === 'account-mismatch' && f.kinds() === 'verify,find', { r, log: f.kinds() });
    f = fakeDeps({ member: undefined });
    r = await A.handleResetPassword(RESET, f.deps);
    rec('កំណត់ពាក្យសម្ងាត់ថ្មី ៖ DB មិនឆ្លើយ ➜ 502 · មិនប្តូរ', r.status === 502 && f.kinds() === 'verify,find', { r, log: f.kinds() });
    f = fakeDeps({ otp: { ok: false, reason: 'token-aud' } });
    r = await A.handleResetPassword(RESET, f.deps);
    rec('កំណត់ពាក្យសម្ងាត់ថ្មី ៖ OTP ខុស ➜ 401 · មិនរកសមាជិក', r.status === 401 && f.kinds() === 'verify', { r, log: f.kinds() });
    f = fakeDeps({ update: 'weak' });
    r = await A.handleResetPassword(RESET, f.deps);
    rec('កំណត់ពាក្យសម្ងាត់ថ្មី ៖ ពាក្យសម្ងាត់ខ្សោយ ➜ 400 password-weak · មិនផ្តាច់ session', r.status === 400 && r.body.code === 'password-weak'
        && f.kinds() === 'verify,find,update', { r, log: f.kinds() });
    f = fakeDeps();
    r = await A.handleResetPassword(Object.assign({}, RESET, { password: 'short' }), f.deps);
    rec('កំណត់ពាក្យសម្ងាត់ថ្មី ៖ ពាក្យសម្ងាត់ខ្លី ➜ 400 · មិនប៉ះ OTP', r.status === 400 && f.log.length === 0, { r, log: f.kinds() });
}

const ENV = {
    SUPABASE_URL: 'https://abcdefgh.supabase.co',
    ZOE_SECRET_KEY: KEY,
    ZOE_OTP_FIREBASE_PROJECT_ID: 'zoe-otp-prod',
    ZOE_LOGIN_DOMAIN: 'u.zoew.invalid',
    ZOE_ALLOWED_ORIGINS: 'https://zoew.netlify.app, https://localhost'
};

async function groupHttp(m, rec) {
    const H = m.http;
    const cfg = (over) => H.readConfig((name) => Object.assign({}, ENV, over || {})[name]);
    const base = cfg();
    rec('config ៖ env គ្រប់ ➜ ok · prefix លំនាំដើម +855', base.ok && JSON.stringify(base.phonePrefixes) === '["+855"]', base.problems);
    for (const name of Object.keys(ENV)) {
        const c = cfg({ [name]: undefined });
        rec('config ៖ គ្មាន ' + name + ' ➜ មិន ok', !c.ok && c.problems.includes(name === 'ZOE_SECRET_KEY' ? 'ZOE_SECRET_KEY' : name), c.problems);
    }
    const leak = cfg({ ZOE_OTP_FIREBASE_PROJECT_ID: 'BAD' });
    rec('config ៖ problems រាយតែឈ្មោះ (secret មិនលេច)', !JSON.stringify(leak.problems).includes(KEY) && !JSON.stringify(leak.problems).includes('BAD'), leak.problems);
    const legacy = cfg({ ZOE_SECRET_KEY: undefined, SUPABASE_SERVICE_ROLE_KEY: KEY });
    rec('config ៖ ZOE_SECRET_KEY អវត្តមាន ➜ ប្រើ SUPABASE_SERVICE_ROLE_KEY', legacy.ok && legacy.secretKey === KEY, legacy.problems);
    rec('config ៖ origin មាន path ➜ មិន ok', !cfg({ ZOE_ALLOWED_ORIGINS: 'https://zoew.netlify.app/app' }).ok);
    rec('config ៖ origin http (មិនមែន localhost) ➜ មិន ok', !cfg({ ZOE_ALLOWED_ORIGINS: 'http://zoew.netlify.app' }).ok);
    rec('config ៖ SUPABASE_URL http សាធារណៈ ➜ មិន ok', !cfg({ SUPABASE_URL: 'http://abcdefgh.supabase.co' }).ok);
    rec('config ៖ prefix «+855,+66» ➜ ២', JSON.stringify(cfg({ ZOE_PHONE_PREFIXES: '+855,+66' }).phonePrefixes) === '["+855","+66"]');
    rec('config ៖ prefix ខុសទម្រង់ ➜ មិន ok', !cfg({ ZOE_PHONE_PREFIXES: '855' }).ok);
    rec('config ៖ loginDomain ខុសទម្រង់ ➜ មិន ok', !cfg({ ZOE_LOGIN_DOMAIN: 'bad domain' }).ok);
    rec('config ៖ loginDomain មិនមែន .invalid (អ្នកកាន់ domain ទទួលអ៊ីមែល recover ➜ យកគណនី) ➜ មិន ok',
        !cfg({ ZOE_LOGIN_DOMAIN: 'u.zoew.app' }).ok && !cfg({ ZOE_LOGIN_DOMAIN: 'gmail.com' }).ok);

    const ALLOW = 'authorization, x-client-info, apikey, content-type, x-region';
    let handled = [];
    const handler = async (body) => { handled.push(body); if (body && body.boom) throw new Error('secret-stuff'); return { status: 200, body: { ok: true, code: 'fine' } }; };
    const req = (method, origin, body, headers) => new Request('https://x.supabase.co/functions/v1/register', {
        method, body, headers: Object.assign(origin ? { origin } : {}, headers || {})
    });
    const call = async (r, config) => { handled = []; return H.handleHttp(r, config || base, ALLOW, handler); };
    let res = await call(req('OPTIONS', 'https://localhost'));
    rec('HTTP ៖ preflight ពី origin អនុញ្ញាត ➜ 204 + ACAO = origin + Allow-Headers',
        res.status === 204 && res.headers.get('access-control-allow-origin') === 'https://localhost'
        && res.headers.get('access-control-allow-headers') === ALLOW && handled.length === 0);
    res = await call(req('OPTIONS', 'https://evil.example'));
    rec('HTTP ៖ preflight ពី origin មិនស្គាល់ ➜ 403 · គ្មាន ACAO', res.status === 403 && !res.headers.get('access-control-allow-origin'));
    res = await call(req('POST', 'https://evil.example', JSON.stringify({ a: 1 })));
    rec('HTTP ៖ POST ពី origin មិនស្គាល់ ➜ 403 · handler មិនរត់', res.status === 403 && handled.length === 0);
    res = await call(req('POST', 'https://zoew.netlify.app', JSON.stringify({ a: 1 })));
    rec('HTTP ៖ POST ពី origin អនុញ្ញាត ➜ handler + ACAO + no-store + JSON',
        res.status === 200 && handled.length === 1 && handled[0].a === 1 && res.headers.get('access-control-allow-origin') === 'https://zoew.netlify.app'
        && res.headers.get('cache-control') === 'no-store' && /application\/json/.test(res.headers.get('content-type') || ''));
    res = await call(req('POST', null, JSON.stringify({ a: 2 })));
    rec('HTTP ៖ POST គ្មាន Origin (server) ➜ handler · គ្មាន ACAO', res.status === 200 && handled.length === 1 && !res.headers.get('access-control-allow-origin'));
    res = await call(req('GET', 'https://localhost'));
    rec('HTTP ៖ GET ➜ 405', res.status === 405 && handled.length === 0);
    res = await call(req('POST', 'https://localhost', '{}'), cfg({ ZOE_LOGIN_DOMAIN: undefined }));
    rec('HTTP ៖ config មិនគ្រប់ ➜ 503 server-unconfigured · handler មិនរត់', res.status === 503 && (await res.json()).code === 'server-unconfigured' && handled.length === 0);
    res = await call(req('POST', 'https://localhost', JSON.stringify({ pad: 'x'.repeat(9000) })));
    rec('HTTP ៖ body > 8192 byte ➜ 413 · handler មិនរត់', res.status === 413 && handled.length === 0);
    res = await call(req('POST', 'https://localhost', '{}', { 'content-length': '999999' }));
    rec('HTTP ៖ content-length ប្រកាសធំ ➜ 413', res.status === 413 && handled.length === 0);
    let pulled = 0, cancelled = false;
    const chunk = new Uint8Array(4000).fill(65);
    const stream = new ReadableStream({
        pull(ctl) { if (pulled >= 50) { ctl.close(); return; } pulled++; ctl.enqueue(chunk.slice()); },
        cancel() { cancelled = true; }
    });
    handled = [];
    res = await H.handleHttp(new Request('https://x.supabase.co/functions/v1/register', { method: 'POST', body: stream, duplex: 'half',
        headers: { origin: 'https://localhost' } }), base, ALLOW, handler);
    rec('HTTP ៖ body stream គ្មាន content-length ➜ 413 · អានឈប់ត្រឹមព្រំដែន (មិនអាន ២០០KB ទាំងអស់) · stream ត្រូវ cancel',
        res.status === 413 && handled.length === 0 && pulled <= 4 && cancelled, { status: res.status, pulled, cancelled });
    res = await call(req('POST', 'https://localhost', Buffer.concat([Buffer.from('{"username":"'), Buffer.from([0xff, 0xfe]), Buffer.from('"}')])));
    rec('HTTP ៖ JSON ត្រឹមត្រូវ តែមាន byte មិនមែន UTF-8 ➜ 400 · handler មិនទទួល U+FFFD', res.status === 400 && handled.length === 0, handled);
    res = await call(req('POST', 'https://localhost', '{bad json'));
    rec('HTTP ៖ JSON ខូច ➜ 400', res.status === 400 && handled.length === 0);
    res = await call(req('POST', 'https://localhost', JSON.stringify({ boom: 1 })));
    const text = await res.text();
    rec('HTTP ៖ handler បោះ ➜ 500 internal · សារខាងក្នុងមិនលេច', res.status === 500 && !text.includes('secret-stuff') && JSON.parse(text).code === 'internal', text);
}

let mock = null;
async function startMock() {
    const requests = [];
    const sockets = new Set();
    const server = http.createServer((req, res) => {
        let data = '';
        req.on('data', (d) => { data += d; });
        req.on('end', () => {
            let body = null;
            try { body = data ? JSON.parse(data) : null; } catch (e) { body = data; }
            const entry = { method: req.method, url: req.url, headers: req.headers, body };
            requests.push(entry);
            const send = (status, obj, headers) => {
                res.writeHead(status, Object.assign({ 'Content-Type': 'application/json' }, headers || {}));
                res.end(obj === undefined ? '' : JSON.stringify(obj));
            };
            const v2024 = { 'X-Supabase-Api-Version': '2024-01-01' };
            const u = req.url.split('?')[0];
            if (req.method === 'POST' && u === '/auth/v1/admin/users') {
                const email = body && body.email;
                if (email === 'taken@u.zoe.test') return send(422, { code: 'email_exists', message: 'A user with this email address has already been registered' }, v2024);
                if (email === 'legacy@u.zoe.test') return send(422, { code: 422, error_code: 'email_exists', msg: 'A user with this email address has already been registered' });
                if (body && body.password === 'weakpass1') return send(422, { code: 'weak_password', message: 'weak', weak_password: { reasons: ['length'] } }, v2024);
                if (email === 'boom@u.zoe.test') return send(500, { message: 'db down' });
                return send(200, { id: USER_ID, aud: 'authenticated', role: 'authenticated', email, app_metadata: {}, user_metadata: {}, created_at: '2026-09-30T00:00:00Z' });
            }
            if (req.method === 'DELETE' && u.startsWith('/auth/v1/admin/users/')) {
                return u.endsWith('/' + FAIL_ID) ? send(500, { message: 'x' }) : send(200, {});
            }
            if (req.method === 'PUT' && u.startsWith('/auth/v1/admin/users/')) {
                if (body && body.password === 'weakpass1') return send(422, { code: 'weak_password', message: 'weak', weak_password: { reasons: ['length'] } }, v2024);
                return send(200, { id: u.split('/').pop(), aud: 'authenticated', email: 'x@u.zoe.test' });
            }
            if (req.method === 'POST' && u === '/rest/v1/rpc/finish_registration') {
                const name = body && body.p_username;
                if (name === 'hang') return;
                if (name === 'dup') return send(400, { code: 'P0001', details: null, hint: null, message: 'phone-taken' });
                if (name === 'weird') return send(400, { code: 'P0001', details: null, hint: null, message: 'something-else' });
                return send(200, [{ tenant_id: 't-1', role: 'owner' }]);
            }
            if (req.method === 'POST' && u === '/rest/v1/rpc/invite_is_usable') {
                const h = body && body.p_code_hash;
                if (h === 'err') return send(500, { code: 'XX000', message: 'x', details: null, hint: null });
                return send(200, h === 'good');
            }
            if (req.method === 'POST' && u === '/rest/v1/rpc/revoke_user_sessions') {
                return body && body.p_user_id === FAIL_ID ? send(500, { code: 'XX000', message: 'x', details: null, hint: null }) : send(200, 2);
            }
            if (req.method === 'POST' && u === '/rest/v1/rpc/member_for_reset') {
                return send(200, body && body.p_username === 'sokha' ? USER_ID : null);
            }
            if (req.method === 'POST' && u.startsWith('/functions/v1/')) return send(200, { ok: true });
            return send(404, { message: 'no route' });
        });
    });
    server.on('connection', (s) => { sockets.add(s); s.on('close', () => sockets.delete(s)); });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    return { server, sockets, requests, url: 'http://127.0.0.1:' + server.address().port };
}
function sqlArgs(sql, name) {
    const m = sql.match(new RegExp('create function public\\.' + name + '\\(([^)]*)\\)'));
    if (!m) return null;
    return m[1].split(',').map((a) => a.trim().split(/\s+/)[0]).filter(Boolean).sort();
}

async function groupAdapter(m, rec, env) {
    const client = env.createClient(mock.url, KEY, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    const D = m.admin.adminDeps(client, 400);
    const last = (pred) => mock.requests.filter(pred).pop();
    mock.requests.length = 0;
    const created = await D.createUser('sokha@u.zoe.test', 'secret-pass');
    const cr = last((x) => x.url.startsWith('/auth/v1/admin/users') && x.method === 'POST');
    rec('adapter ៖ createUser ➜ POST /auth/v1/admin/users ➜ userId', created.ok === true && created.userId === USER_ID && !!cr, created);
    rec('adapter ៖ body = {email, password, email_confirm: true} តែប៉ុណ្ណោះ (គ្មាន metadata)',
        !!cr && JSON.stringify(Object.keys(cr.body).sort()) === '["email","email_confirm","password"]' && cr.body.email_confirm === true, cr && cr.body);
    rec('adapter ៖ header apikey = secret key', !!cr && cr.headers.apikey === KEY, cr && Object.keys(cr.headers));
    rec('adapter ៖ email មានរួច (API 2024) ➜ exists', ((x) => !x.ok && x.reason === 'exists')(await D.createUser('taken@u.zoe.test', 'secret-pass')));
    rec('adapter ៖ email មានរួច (API ចាស់ error_code) ➜ exists', ((x) => !x.ok && x.reason === 'exists')(await D.createUser('legacy@u.zoe.test', 'secret-pass')));
    rec('adapter ៖ weak_password ➜ weak', ((x) => !x.ok && x.reason === 'weak')(await D.createUser('w@u.zoe.test', 'weakpass1')));
    rec('adapter ៖ GoTrue 500 ➜ unavailable', ((x) => !x.ok && x.reason === 'unavailable')(await D.createUser('boom@u.zoe.test', 'secret-pass')));

    const finOk = await D.finishRegistration({ userId: USER_ID, codeHash: 'h', username: 'sokha', phone: '+85512345678' });
    const fr = last((x) => x.url === '/rest/v1/rpc/finish_registration');
    rec('adapter ៖ finish_registration ➜ tenant/role', finOk.ok === true && finOk.tenantId === 't-1' && finOk.role === 'owner', finOk);
    const want = sqlArgs(env.migrationSql, 'finish_registration');
    rec('ស្នាមភ្ជាប់ ៖ argument RPC finish_registration ស្មើ SQL ពិត (' + (want || []).join(',') + ')',
        !!fr && !!want && JSON.stringify(Object.keys(fr.body).sort()) === JSON.stringify(want), { sent: fr && Object.keys(fr.body), want });
    rec('adapter ៖ RPC ដែល raise phone-taken ➜ reason phone-taken',
        ((x) => !x.ok && x.reason === 'phone-taken')(await D.finishRegistration({ userId: 'u', codeHash: 'h', username: 'dup', phone: '+8551' })));
    rec('adapter ៖ សារ RPC មិនស្គាល់ ➜ unavailable',
        ((x) => !x.ok && x.reason === 'unavailable')(await D.finishRegistration({ userId: 'u', codeHash: 'h', username: 'weird', phone: '+8551' })));
    const t0 = Date.now();
    const hung = await D.finishRegistration({ userId: 'u', codeHash: 'h', username: 'hang', phone: '+8551' });
    rec('adapter ៖ RPC ព្យួរ ➜ unavailable ក្នុងពិដាន (' + (Date.now() - t0) + 'ms)', !hung.ok && hung.reason === 'unavailable' && Date.now() - t0 < 2000, hung);

    rec('adapter ៖ invite_is_usable ➜ true/false', (await D.inviteIsUsable('good')) === true && (await D.inviteIsUsable('bad')) === false);
    const ur = last((x) => x.url === '/rest/v1/rpc/invite_is_usable');
    const wantU = sqlArgs(env.migrationSql, 'invite_is_usable');
    rec('ស្នាមភ្ជាប់ ៖ argument RPC invite_is_usable ស្មើ SQL ពិត', !!ur && !!wantU && JSON.stringify(Object.keys(ur.body).sort()) === JSON.stringify(wantU),
        { sent: ur && Object.keys(ur.body), wantU });
    rec('adapter ៖ invite_is_usable កំហុស ➜ null (មិនមែន false)', (await D.inviteIsUsable('err')) === null);
    rec('adapter ៖ member_for_reset ➜ id / null', (await D.findMember('sokha', '+85512345678')) === USER_ID && (await D.findMember('none', '+8551')) === null);
    const mr = last((x) => x.url === '/rest/v1/rpc/member_for_reset');
    const wantM = sqlArgs(env.migrationSql, 'member_for_reset');
    rec('ស្នាមភ្ជាប់ ៖ argument RPC member_for_reset ស្មើ SQL ពិត', !!mr && !!wantM && JSON.stringify(Object.keys(mr.body).sort()) === JSON.stringify(wantM),
        { sent: mr && Object.keys(mr.body), wantM });
    rec('adapter ៖ deleteUser ➜ DELETE /auth/v1/admin/users/<id>', (await D.deleteUser(USER_ID)) === true
        && !!last((x) => x.method === 'DELETE' && x.url.split('?')[0] === '/auth/v1/admin/users/' + USER_ID));
    rec('adapter ៖ deleteUser ធ្លាក់ ➜ false', (await D.deleteUser(FAIL_ID)) === false);
    rec('adapter ៖ deleteUser លើ id មិនមែន UUID (SDK បោះ synchronous) ➜ false មិនគាំង', (await D.deleteUser('not-a-uuid')) === false);
    rec('adapter ៖ updatePassword ➜ ok', (await D.updatePassword(USER_ID, 'new-secret')) === 'ok');
    const pr = last((x) => x.method === 'PUT');
    rec('adapter ៖ updatePassword ➜ PUT /auth/v1/admin/users/<id> {password}', !!pr && pr.url.split('?')[0] === '/auth/v1/admin/users/' + USER_ID
        && JSON.stringify(pr.body) === JSON.stringify({ password: 'new-secret' }), pr && { url: pr.url, body: pr.body });
    rec('adapter ៖ updatePassword ខ្សោយ ➜ weak', (await D.updatePassword(USER_ID, 'weakpass1')) === 'weak');
    rec('adapter ៖ revokeSessions ➜ true', (await D.revokeSessions(USER_ID)) === true);
    const rr = last((x) => x.url === '/rest/v1/rpc/revoke_user_sessions');
    const wantR = sqlArgs(env.migrationSql, 'revoke_user_sessions');
    rec('ស្នាមភ្ជាប់ ៖ argument RPC revoke_user_sessions ស្មើ SQL ពិត', !!rr && !!wantR && JSON.stringify(Object.keys(rr.body).sort()) === JSON.stringify(wantR),
        { sent: rr && Object.keys(rr.body), wantR });
    rec('adapter ៖ revokeSessions កំហុស ➜ false', (await D.revokeSessions(FAIL_ID)) === false);
}

async function runGroups(m, env, stopOnFail) {
    const results = [];
    const STOP = Symbol('stop');
    const rec = (label, cond, detail) => {
        results.push({ label, pass: !!cond, detail });
        if (!cond && stopOnFail) throw STOP;
    };
    const groups = [['token', groupToken], ['jwks', groupKeySource], ['invite', groupInvite], ['account', groupAccount], ['http', groupHttp]];
    if (env.createClient) groups.push(['adapter', groupAdapter]);
    for (const [name, fn] of groups) {
        try {
            await fn(m, rec, env);
        } catch (e) {
            if (e === STOP) break;
            results.push({ label: 'ក្រុម ' + name + ' មិនគាំង', pass: false, detail: String(e && e.stack || e).slice(0, 600) });
            if (stopOnFail) break;
        }
    }
    return results;
}

async function loadModules(dir) {
    const out = {};
    const names = { invite: 'invite-code.ts', timeout: 'timeout.ts', token: 'firebase-phone-token.ts', account: 'account-core.ts', http: 'http.ts', admin: 'admin-deps.ts' };
    for (const [k, f] of Object.entries(names)) out[k] = await import(pathToFileURL(path.join(dir, f)).href);
    return out;
}

const MUTATIONS = [
    ['firebase-phone-token.ts', 'ដក alg check', "    if (header.alg !== 'RS256') return fail('token-alg');\n", ''],
    ['firebase-phone-token.ts', 'ដក aud check', "    if (payload.aud !== options.projectId) return fail('token-aud');\n", ''],
    ['firebase-phone-token.ts', 'ដក iss check', "    if (payload.iss !== 'https://securetoken.google.com/' + options.projectId) return fail('token-iss');\n", ''],
    ['firebase-phone-token.ts', 'ដក exp check', "    if (!(exp > now)) return fail('token-expired');\n", ''],
    ['firebase-phone-token.ts', 'ដកអាយុ auth_time', "    if (!(now - authTime <= (options.maxAuthAgeSeconds ?? DEFAULT_MAX_AUTH_AGE_SECONDS))) return fail('otp-stale');\n", ''],
    ['firebase-phone-token.ts', 'provider ណាក៏បាន', ".sign_in_provider !== 'phone')", ".sign_in_provider === 'never')"],
    ['firebase-phone-token.ts', 'មិនពិនិត្យលេខ E.164', "if (typeof phone !== 'string' || !E164_RE.test(phone)) return fail('otp-phone');", "if (typeof phone !== 'string') return fail('otp-phone');"],
    ['firebase-phone-token.ts', 'មិនអើពើហត្ថលេខា', "    if (!valid) return fail('token-signature');\n", ''],
    ['firebase-phone-token.ts', 'យកសោទីមួយមិនគិត kid', 'key = (await options.keys(false)).find((k) => k.kid === kid);', 'key = (await options.keys(false))[0];'],
    ['firebase-phone-token.ts', 'refresh មិនគោរពចន្លោះ', '!(refresh && age >= refreshGapMs)', '!refresh'],
    ['firebase-phone-token.ts', 'មិនប្រើ cache ចាស់ពេលធ្លាក់', '                if (cached) return cached;\n                throw error;', '                throw error;'],
    ['firebase-phone-token.ts', 'ពិដាន JWKS វែង', 'timeoutMs + 500', 'timeoutMs + 60000'],
    ['invite-code.ts', 'មិនពិនិត្យ alphabet', '        if (!INVITE_CODE_ALPHABET.includes(ch)) return null;\n', ''],
    ['invite-code.ts', 'មិនប្តូរ O ➜ 0', ".replace(/O/g, '0')", ''],
    ['account-core.ts', 'មិនពិនិត្យតំបន់លេខ', "    if (!deps.phonePrefixes.some((prefix) => otp.phone.startsWith(prefix))) return reply(403, 'phone-region');\n", ''],
    ['account-core.ts', 'មិនពិនិត្យកូដមុនបង្កើតគណនី', "    if (!usable) return reply(403, 'invite-invalid');\n", ''],
    ['account-core.ts', 'លុបគណនីលើលទ្ធផលមិនដឹង', '    if (!ROLLBACK_REASONS.has(finished.reason)) return reply(...FINISH_REPLY[finished.reason]);\n', ''],
    ['account-core.ts', 'មិនសាក finish ម្តងទៀត', "    if (!finished.ok && finished.reason === 'unavailable') finished = await deps.finishRegistration(request);\n", ''],
    ['account-core.ts', 'reset ជឿលេខពី body', 'await deps.findMember(username, otp.phone)', 'await deps.findMember(username, String(body.phone))'],
    ['account-core.ts', 'មិនផ្តាច់ session ក្រោយកំណត់ថ្មី', "    const revoked = (await deps.revokeSessions(userId)) || (await deps.revokeSessions(userId));", '    const revoked = true;'],
    ['http.ts', 'loginDomain មិនបង្ខំ .invalid', " || !loginDomain.endsWith('.invalid')", ''],
    ['admin-deps.ts', 'revokeSessions ជឿកំហុស', "                return !error && typeof data === 'number';", '                return true;'],
    ['account-core.ts', 'មិនកំណត់ ៧២ byte', "    if (new TextEncoder().encode(raw).length > PASSWORD_MAX_BYTES) return 'password-long';\n", ''],
    ['http.ts', 'មិនបដិសេធ origin មិនស្គាល់', "    if (origin !== null && !allowed) return json(403, { ok: false, code: 'origin-denied' }, cors);\n", ''],
    ['http.ts', 'មិនកំណត់ទំហំ body', '            if (total > maxBytes) {', '            if (false) {'],
    ['http.ts', 'មិនបដិសេធ UTF-8 ខូច', "new TextDecoder('utf-8', { fatal: true })", "new TextDecoder('utf-8')"],
    ['admin-deps.ts', 'email_confirm false', 'email_confirm: true', 'email_confirm: false'],
    ['admin-deps.ts', 'ឈ្មោះ argument RPC ខុស', 'p_code_hash: input.codeHash', 'p_invite_hash: input.codeHash'],
    ['admin-deps.ts', 'កំហុស invite_is_usable ➜ false', "                if (error || typeof data !== 'boolean') return null;", "                if (error || typeof data !== 'boolean') return false;"]
];

async function main() {
    console.log('=== supabase-functions ៖ token OTP · ចុះឈ្មោះ · HTTP · supabase-js ពិត · mutation ===');
    const missing = SHARED_FILES.filter((f) => !fs.existsSync(path.join(SHARED, f)));
    ok('ឯកសារ _shared ទាំង ' + SHARED_FILES.length + ' មាន', missing.length === 0, missing);
    const fnDirs = fs.existsSync(FN_DIR) ? fs.readdirSync(FN_DIR).filter((d) => !d.startsWith('_') && fs.statSync(path.join(FN_DIR, d)).isDirectory()).sort() : [];
    ok('Edge Function >= ២ (ឃើញ ' + fnDirs.join(', ') + ')', fnDirs.length >= 2);
    if (missing.length || fnDirs.length < 2) { finish(); return; }

    console.log('\n── ១. wiring ស្តាទិច ──');
    const pkg = JSON.parse(read(path.join(SB, 'package.json')) || '{}');
    const sdkVersion = pkg.devDependencies && pkg.devDependencies['@supabase/supabase-js'];
    ok('package.json pin @supabase/supabase-js ជាកំណែជាក់លាក់ (' + sdkVersion + ')', /^\d+\.\d+\.\d+$/.test(sdkVersion || ''));
    const config = read(path.join(SB, 'config.toml'));
    const cfgFns = [...config.matchAll(/^\[functions\.([a-z0-9-]+)\]\s*\n(?:[^[]*?)verify_jwt\s*=\s*(true|false)/gm)].map((x) => [x[1], x[2]]);
    ok('config.toml ៖ [functions.*] ស្មើថត function (' + cfgFns.map((x) => x[0]).join(',') + ')',
        JSON.stringify(cfgFns.map((x) => x[0]).sort()) === JSON.stringify(fnDirs), { cfgFns, fnDirs });
    ok('config.toml ៖ verify_jwt = false គ្រប់ function (key ថ្មី sb_publishable មិនមែន JWT ➜ ផ្ទៀងក្នុង function)',
        cfgFns.length === fnDirs.length && cfgFns.every((x) => x[1] === 'false'));
    ok('config.toml ៖ បិទការចុះឈ្មោះសាធារណៈ (enable_signup = false) និង anonymous sign-in',
        /^\[auth\]\s*\nenable_signup = false\s*\nenable_anonymous_sign_ins = false/m.test(config));
    ok('config.toml ៖ ការប្តូរអ៊ីមែល/ពាក្យសម្ងាត់ត្រូវបញ្ជាក់តាមអ៊ីមែល (.invalid ផ្ញើមិនដល់ ➜ ប្តូរមិនបាន · កំណត់ថ្មីតែតាម OTP)',
        /^\[auth\.email\]\s*\nenable_signup = false\s*\nenable_confirmations = true\s*\ndouble_confirm_changes = true\s*\nsecure_password_change = true/m.test(config));
    const tsFiles = [];
    (function walk(d) {
        for (const e of fs.readdirSync(d, { withFileTypes: true })) {
            if (e.isDirectory()) walk(path.join(d, e.name));
            else if (e.name.endsWith('.ts')) tsFiles.push(path.join(d, e.name));
        }
    })(FN_DIR);
    const specifiers = new Set();
    for (const f of tsFiles) for (const x of read(f).matchAll(/npm:@supabase\/supabase-js@([0-9.]+)/g)) specifiers.add(x[1]);
    const tsconfig = read(path.join(SB, 'tsconfig.json'));
    for (const x of tsconfig.matchAll(/npm:@supabase\/supabase-js@([0-9.]+)/g)) specifiers.add(x[1]);
    ok('កំណែ npm:@supabase/supabase-js ក្នុង function + tsconfig ស្មើ package.json',
        specifiers.size === 1 && specifiers.has(sdkVersion), [...specifiers]);
    const withConsole = tsFiles.filter((f) => /\bconsole\./.test(read(f)));
    ok('function មិនប្រើ console (token · លេខទូរស័ព្ទ · secret មិនចូល log)', tsFiles.length >= 8 && withConsole.length === 0, withConsole);
    const withComments = tsFiles.filter((f) => /^\s*\/\/|\/\*/m.test(read(f)));
    ok('function គ្មាន comment (កូដ ship ៖ ច្បាប់ ៣)', withComments.length === 0, withComments.map((f) => path.relative(ROOT, f)));
    const migrations = fs.existsSync(path.join(SB, 'migrations')) ? fs.readdirSync(path.join(SB, 'migrations')).filter((f) => f.endsWith('.sql')).sort() : [];
    const migrationSql = migrations.map((f) => read(path.join(SB, 'migrations', f))).join('\n');
    ok('migration គ្មាន comment', migrations.length >= 1 && !/^\s*--/m.test(migrationSql));
    let allowSuffix = null;
    for (const d of fnDirs) {
        const src = read(path.join(FN_DIR, d, 'index.ts'));
        const handlers = ['handleRegister', 'handleResetPassword'].filter((h) => new RegExp('\\b' + h + '\\(').test(src));
        ok('functions/' + d + '/index.ts ៖ Deno.serve + handleHttp + readConfig + handler ១',
            /Deno\.serve\(/.test(src) && /handleHttp\(/.test(src) && /readConfig\(/.test(src) && handlers.length === 1, handlers);
        ok('functions/' + d + '/index.ts ៖ ផ្ទៀង token ជាមួយ config.otpProjectId + key source ដែល cache',
            /verifyFirebasePhoneToken\(token, \{ projectId: config\.otpProjectId, keys \}\)/.test(src) && /createCachedKeySource\(fetch\)/.test(src));
        const suffix = (src.match(/corsHeaders\['Access-Control-Allow-Headers'\] \+ '([^']*)'/) || [])[1];
        ok('functions/' + d + '/index.ts ៖ Allow-Headers ដេរីវេពី corsHeaders របស់ SDK', typeof suffix === 'string');
        if (typeof suffix === 'string') allowSuffix = suffix;
    }

    await makeKeys();
    const real = await loadModules(SHARED);
    const sdkEntry = depPath(path.join('@supabase', 'supabase-js', 'dist', 'index.mjs'));
    const env = { migrationSql, createClient: null };
    if (sdkEntry) env.createClient = (await import(pathToFileURL(sdkEntry).href)).createClient;
    else skipPart('គ្មាន @supabase/supabase-js ➜ adapter/ស្នាមភ្ជាប់ SDK មិនបានវាស់');
    mock = await startMock();

    console.log('\n── ២. ក្រុមតេស្តលើ module ពិត ──');
    const results = await runGroups(real, env, false);
    for (const r of results) ok(r.label, r.pass, r.pass ? undefined : r.detail);
    ok('ការអះអាងក្រុម >= ' + (env.createClient ? 120 : 95) + ' (ឃើញ ' + results.length + ')', results.length >= (env.createClient ? 120 : 95), results.length);

    console.log('\n── ៣. ស្នាមភ្ជាប់ SDK ៖ header ដែល functions.invoke ផ្ញើ ⊂ Allow-Headers (preflight) ──');
    const corsEntry = depPath(path.join('@supabase', 'supabase-js', 'dist', 'cors.mjs'));
    if (env.createClient && corsEntry && allowSuffix !== null) {
        const { corsHeaders } = await import(pathToFileURL(corsEntry).href);
        const allow = (corsHeaders['Access-Control-Allow-Headers'] + allowSuffix).split(',').map((x) => x.trim().toLowerCase());
        const client = env.createClient(mock.url, 'sb_publishable_' + 'p'.repeat(30), { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
        mock.requests.length = 0;
        await client.functions.invoke('register', { body: { a: 1 } });
        await client.functions.invoke('reset-password', { body: { a: 1 }, region: 'ap-southeast-1' });
        const safe = new Set(['host', 'connection', 'content-length', 'accept', 'accept-encoding', 'accept-language', 'user-agent',
            'sec-fetch-mode', 'sec-fetch-site', 'sec-fetch-dest', 'origin', 'referer', 'keep-alive']);
        const sent = new Set();
        for (const q of mock.requests.filter((x) => x.url.startsWith('/functions/v1/'))) for (const h of Object.keys(q.headers)) if (!safe.has(h)) sent.add(h);
        const notAllowed = [...sent].filter((h) => !allow.includes(h));
        ok('functions.invoke ផ្ញើ header ' + sent.size + ' ➜ គ្រប់ header នៅក្នុង Allow-Headers', sent.size >= 3 && notAllowed.length === 0, { sent: [...sent], notAllowed });
        ok('functions.invoke ផ្ញើ x-region ពេលមាន region ➜ ត្រូវក្នុង Allow-Headers', sent.has('x-region') && allow.includes('x-region'));
    } else {
        skipPart('គ្មាន supabase-js/cors ➜ ស្នាមភ្ជាប់ preflight មិនបានវាស់');
    }

    console.log('\n── ៤. tsc (strict) លើ type ពិតរបស់ supabase-js ──');
    const tscBin = depPath(path.join('typescript', 'bin', 'tsc'));
    const sdkTypes = depPath(path.join('@supabase', 'supabase-js', 'dist', 'index.d.mts'));
    const corsTypes = depPath(path.join('@supabase', 'supabase-js', 'dist', 'cors.d.mts'));
    if (tscBin && sdkTypes && corsTypes && sdkVersion) {
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'zoe-sbtsc-'));
        const conf = {
            extends: path.join(SB, 'tsconfig.json'),
            compilerOptions: { paths: { ['npm:@supabase/supabase-js@' + sdkVersion]: [sdkTypes], ['npm:@supabase/supabase-js@' + sdkVersion + '/cors']: [corsTypes] } },
            include: [path.join(FN_DIR, '**', '*.ts'), path.join(SB, 'types', '*.d.ts')]
        };
        fs.writeFileSync(path.join(tmp, 'tsconfig.json'), JSON.stringify(conf));
        const r = cp.spawnSync(process.execPath, [tscBin, '-p', path.join(tmp, 'tsconfig.json'), '--listFiles'], { encoding: 'utf8', timeout: 120000 });
        fs.rmSync(tmp, { recursive: true, force: true });
        const out = String(r.stdout || '') + String(r.stderr || '');
        const checked = out.split('\n').filter((l) => l.startsWith(FN_DIR)).length;
        ok('tsc strict ៖ ០ កំហុស (ឯកសារ function ដែលពិនិត្យ ' + checked + ')', r.status === 0 && checked >= tsFiles.length && tsFiles.length >= 8,
            out.split('\n').filter((l) => /error TS/.test(l)).slice(0, 8));
        ok('tsc ៖ type មកពី supabase-js ពិត (មិនមែន any)', out.includes(sdkTypes));
    } else {
        skipPart('គ្មាន typescript/supabase-js ➜ tsc មិនបានរត់');
    }

    console.log('\n── ៥. mutation លើ TS ពិត ➜ អ្នកយាមត្រូវក្រហម ──');
    ok('mutation >= ២០ (មាន ' + MUTATIONS.length + ')', MUTATIONS.length >= 20);
    if (!env.createClient) skipPart('គ្មាន supabase-js ➜ mutation លើ admin-deps.ts មិនបានវាស់');
    for (const [file, label, from, to] of MUTATIONS) {
        if (file === 'admin-deps.ts' && !env.createClient) continue;
        const src = read(path.join(SHARED, file));
        const hits = src.split(from).length - 1;
        if (hits !== 1) {
            ok('mutation «' + file + ' ៖ ' + label + '» ៖ anchor ត្រូវលេចម្តងគត់ (ឃើញ ' + hits + ')', false);
            continue;
        }
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'zoe-sbmut-'));
        for (const f of SHARED_FILES) fs.copyFileSync(path.join(SHARED, f), path.join(tmp, f));
        fs.writeFileSync(path.join(tmp, 'package.json'), '{"type":"module"}');
        fs.writeFileSync(path.join(tmp, file), src.replace(from, to));
        let caught = null, loaded = true;
        try {
            const mm = await loadModules(tmp);
            const rs = await runGroups(mm, env, true);
            caught = rs.find((x) => !x.pass) || null;
        } catch (e) {
            loaded = false;
        }
        fs.rmSync(tmp, { recursive: true, force: true });
        ok('mutation «' + file + ' ៖ ' + label + '» ➜ ' + (loaded ? 'ចាប់ដោយ «' + (caught ? caught.label : '—') + '»' : 'ផ្ទុកមិនបាន (មិនរាប់)'),
            loaded && !!caught);
    }
    console.log('  (' + (Date.now() - T0) + 'ms)');
    finish();
}

const T0 = Date.now();
main().catch((e) => {
    ok('ការវាស់មិនគាំង', false, String(e && e.stack || e));
    finish();
}).finally(() => {
    if (mock) {
        for (const s of mock.sockets) s.destroy();
        mock.server.close();
    }
    process.exit(process.exitCode);
});
