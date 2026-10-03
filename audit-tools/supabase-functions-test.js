// ថ្នាក់ ៖ **Edge Function ចុះឈ្មោះ/កំណត់ពាក្យសម្ងាត់ថ្មី ជាច្រកតែមួយដែលបង្កើតគណនី ➜ វាជាព្រំដែនសុវត្ថិភាព។**
//
//   npm ci --prefix supabase
//   node audit-tools/supabase-functions-test.js
//
// ⛔ អ្វីដែលវាស់ ៖
//   ១. កូដអញ្ជើញ/កូដកំណត់ពាក្យសម្ងាត់ថ្មី ៖ normalize · hash (prefix ដាច់ពីគ្នា)
//   ២. លំហូរចុះឈ្មោះ/កំណត់ពាក្យសម្ងាត់ ៖ លំដាប់ការហៅ (គ្មានការបង្កើតគណនីមុនកូដអញ្ជើញឆ្លង) · rollback តែលើ
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
const SHARED_FILES = ['invite-code.ts', 'timeout.ts', 'account-core.ts', 'http.ts', 'admin-deps.ts'];

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
const read = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n') : '');
const depPath = (rel) => DEPS_DIRS.map((d) => path.join(d, rel)).find((p) => fs.existsSync(p)) || null;

const KEY = 'sb_secret_' + 'k'.repeat(40);
const USER_ID = '6f1c1c9e-2d3b-4c5a-9e8f-0a1b2c3d4e5f';
const FAIL_ID = '00000000-0000-4000-8000-00000000dead';
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
    const wantReset = nodeCrypto.createHash('sha256').update('zoe-reset:ABCDEFGHJKMNPQRSTVWX').digest('hex');
    rec('កូដកំណត់ថ្មី ៖ hash = sha256("zoe-reset:" + កូដ) · ខុសពី hash អញ្ជើញ',
        (await I.resetCodeHash('ABCDEFGHJKMNPQRSTVWX')) === wantReset && wantReset !== want);
}

function fakeDeps(over) {
    const log = [];
    const base = {
        inviteIsUsable: async (h) => { log.push(['usable', h]); return over && 'usable' in over ? over.usable : true; },
        createUser: async (email, pw) => { log.push(['create', email, pw]); return over && over.created ? over.created : { ok: true, userId: 'user-1' }; },
        finishRegistration: async (input) => {
            log.push(['finish', input]);
            const queue = over && over.finish;
            if (Array.isArray(queue)) return queue.shift() || { ok: true, tenantId: 't-1', role: 'member' };
            return queue || { ok: true, tenantId: 't-1', role: 'member' };
        },
        deleteUser: async (id) => { log.push(['delete', id]); return over && 'deleted' in over ? over.deleted : true; },
        passwordUserId: async (email, pw) => { log.push(['signin', email, pw]); return over && 'owner' in over ? over.owner : null; },
        claimResetCode: async (u, h, id) => { log.push(['check', u, h, id]); return over && Array.isArray(over.members) ? over.members.shift() : over && 'member' in over ? over.member : 'user-9'; },
        updatePassword: async (id, pw) => { log.push(['update', id, pw]); return over && over.update ? over.update : 'ok'; },
        settleResetCode: async (u, h, id, consumed) => { log.push([consumed ? 'consume' : 'release', u, h, id]); return over && 'consumed' in over ? over.consumed : true; },
        revokeSessions: async (id) => { log.push(['revoke', id]); return over && 'revoked' in over ? over.revoked : true; },
        loginDomain: 'u.zoew.invalid'
    };
    return { deps: base, log, kinds: () => log.map((x) => x[0]).join(',') };
}
const INVITE = 'abcd-efgh-jkmn-pqrs-tvwx';
const REG = { username: ' SoKha ', password: 'secret-pass', invite: INVITE };

async function groupAccount(m, rec) {
    const A = m.account;
    let f = fakeDeps();
    let r = await A.handleRegister(REG, f.deps);
    const wantHash = nodeCrypto.createHash('sha256').update('zoe-invite:ABCDEFGHJKMNPQRSTVWX').digest('hex');
    rec('ចុះឈ្មោះ ៖ ជោគជ័យ ➜ 200 registered + tenant', r.status === 200 && r.body.code === 'registered' && r.body.tenantId === 't-1', r);
    rec('ចុះឈ្មោះ ៖ លំដាប់ usable ➜ create ➜ finish (គ្មាន delete)', f.kinds() === 'usable,create,finish', f.kinds());
    const create = f.log.find((x) => x[0] === 'create');
    rec('ចុះឈ្មោះ ៖ email = username តូច + @loginDomain · ពាក្យសម្ងាត់ដដែល', !!create && create[1] === 'sokha@u.zoew.invalid' && create[2] === 'secret-pass', create);
    const fin = f.log.find((x) => x[0] === 'finish');
    rec('ចុះឈ្មោះ ៖ finish ទទួល hash កូដ · username តូច · user id (គ្មានវាលផ្សេងពី body)',
        !!fin && JSON.stringify(Object.keys(fin[1]).sort()) === '["codeHash","userId","username"]'
        && fin[1].codeHash === wantHash && fin[1].username === 'sokha' && fin[1].userId === 'user-1', fin);
    const usableCall = f.log.find((x) => x[0] === 'usable');
    rec('ចុះឈ្មោះ ៖ ពិនិត្យកូដដោយ hash (កូដដើមមិនចេញពី function)', !!usableCall && usableCall[1] === wantHash, usableCall);
    const early = [
        ['body ជា null', null, 'bad-request'],
        ['body ជា array', [REG], 'bad-request'],
        ['គ្មានកូដអញ្ជើញ', Object.assign({}, REG, { invite: undefined }), 'invite-invalid'],
        ['កូដអញ្ជើញខុសទម្រង់', Object.assign({}, REG, { invite: 'short' }), 'invite-invalid'],
        ['username មានចន្លោះកណ្តាល', Object.assign({}, REG, { username: 'so kha' }), 'username-invalid'],
        ['username ខ្លី', Object.assign({}, REG, { username: 'ab' }), 'username-invalid'],
        ['ពាក្យសម្ងាត់ ៧ តួ', Object.assign({}, REG, { password: '1234567' }), 'password-short'],
        ['ពាក្យសម្ងាត់ខ្មែរ ២៥ តួ (៧៥ byte > ៧២ របស់ bcrypt)', Object.assign({}, REG, { password: 'ក'.repeat(25) }), 'password-long']
    ];
    for (const [label, body, code] of early) {
        f = fakeDeps();
        r = await A.handleRegister(body, f.deps);
        rec('ចុះឈ្មោះ ៖ ' + label + ' ➜ 400 ' + code + ' · មិនប៉ះ DB', r.status === 400 && r.body.code === code && f.log.length === 0, { r, log: f.kinds() });
    }
    f = fakeDeps();
    r = await A.handleRegister(Object.assign({}, REG, { password: 'ក'.repeat(8) }), f.deps);
    rec('ចុះឈ្មោះ ៖ ពាក្យសម្ងាត់ខ្មែរ ៨ តួ (២៤ byte) ➜ ទទួល', r.status === 200, r);
    const CHECK = { invite: INVITE, check: true };
    f = fakeDeps();
    r = await A.handleRegister(CHECK, f.deps);
    rec('ពិនិត្យកូដ (check) ៖ ប្រើបាន ➜ 200 invite-usable · ពិនិត្យដោយ hash · ⛔ មិនបង្កើតគណនី មិនស៊ីកូដ',
        r.status === 200 && r.body.code === 'invite-usable' && f.kinds() === 'usable' && f.log[0][1] === wantHash, { r, log: f.kinds() });
    f = fakeDeps({ usable: false });
    r = await A.handleRegister(CHECK, f.deps);
    rec('ពិនិត្យកូដ (check) ៖ ប្រើរួច/ផុត ➜ 403 invite-invalid · មិនបង្កើតគណនី', r.status === 403 && r.body.code === 'invite-invalid' && f.kinds() === 'usable', { r, log: f.kinds() });
    f = fakeDeps({ usable: null });
    r = await A.handleRegister(CHECK, f.deps);
    rec('ពិនិត្យកូដ (check) ៖ DB មិនឆ្លើយ ➜ 502 db-unavailable (⛔ មិនមែន «ប្រើរួច»)', r.status === 502 && r.body.code === 'db-unavailable', { r, log: f.kinds() });
    f = fakeDeps();
    r = await A.handleRegister(Object.assign({}, REG, { check: 'yes' }), f.deps);
    rec('ពិនិត្យកូដ ៖ check មិនមែន true ➜ ចុះឈ្មោះធម្មតា (មិនមែនផ្លូវពិនិត្យ)', r.status === 200 && r.body.code === 'registered', { r, log: f.kinds() });
    f = fakeDeps();
    r = await A.handleRegister({ invite: 'short', check: true }, f.deps);
    rec('ពិនិត្យកូដ ៖ ខុសទម្រង់ ➜ 400 invite-invalid · មិនប៉ះ DB', r.status === 400 && r.body.code === 'invite-invalid' && f.log.length === 0, { r, log: f.kinds() });
    f = fakeDeps({ usable: false });
    r = await A.handleRegister(REG, f.deps);
    rec('ចុះឈ្មោះ ៖ កូដអញ្ជើញប្រើមិនបាន ➜ 403 · មិនបង្កើតគណនី', r.status === 403 && r.body.code === 'invite-invalid' && f.kinds() === 'usable', { r, log: f.kinds() });
    f = fakeDeps({ usable: null });
    r = await A.handleRegister(REG, f.deps);
    rec('ចុះឈ្មោះ ៖ DB មិនឆ្លើយពេលពិនិត្យកូដ ➜ 502 · មិនបង្កើតគណនី', r.status === 502 && r.body.code === 'db-unavailable' && f.kinds() === 'usable', { r, log: f.kinds() });
    const createCases = [['exists', 409, 'username-taken', 'usable,create,signin'], ['weak', 400, 'password-weak', 'usable,create'],
        ['unavailable', 502, 'auth-unavailable', 'usable,create']];
    for (const [reason, status, code, kinds] of createCases) {
        f = fakeDeps({ created: { ok: false, reason } });
        r = await A.handleRegister(REG, f.deps);
        rec('ចុះឈ្មោះ ៖ createUser ' + reason + ' ➜ ' + status + ' ' + code + ' (' + kinds + ')', r.status === status && r.body.code === code && f.kinds() === kinds, { r, log: f.kinds() });
    }
    const EXISTS = { ok: false, reason: 'exists' };
    f = fakeDeps({ created: EXISTS, owner: 'user-old' });
    r = await A.handleRegister(REG, f.deps);
    const signin = f.log.find((x) => x[0] === 'signin');
    const resumed = f.log.find((x) => x[0] === 'finish');
    rec('បន្តចុះឈ្មោះ ៖ គណនីមានរួច + ពាក្យសម្ងាត់ត្រូវ ➜ finish លើ user id ដែល Auth បញ្ជាក់ ➜ 200 registered',
        r.status === 200 && r.body.code === 'registered' && r.body.tenantId === 't-1' && f.kinds() === 'usable,create,signin,finish'
        && !!signin && signin[1] === 'sokha@u.zoew.invalid' && signin[2] === 'secret-pass' && !!resumed && resumed[1].userId === 'user-old', { r, log: f.log });
    f = fakeDeps({ created: EXISTS, owner: undefined });
    r = await A.handleRegister(REG, f.deps);
    rec('បន្តចុះឈ្មោះ ៖ Auth មិនឆ្លើយពេលផ្ទៀងពាក្យសម្ងាត់ ➜ 502 auth-unavailable · មិន finish · មិនលុប',
        r.status === 502 && r.body.code === 'auth-unavailable' && f.kinds() === 'usable,create,signin', { r, log: f.kinds() });
    for (const [reason, status, code] of [['invite-invalid', 403, 'invite-invalid'], ['username-taken', 409, 'username-taken'], ['account-invalid', 400, 'account-invalid']]) {
        f = fakeDeps({ created: EXISTS, owner: 'user-old', finish: { ok: false, reason } });
        r = await A.handleRegister(REG, f.deps);
        rec('បន្តចុះឈ្មោះ ៖ finish ' + reason + ' ➜ ' + status + ' · ⛔ មិនលុបគណនីដែលសំណើនេះមិនបានបង្កើត',
            r.status === status && r.body.code === code && f.kinds() === 'usable,create,signin,finish', { r, log: f.kinds() });
    }
    f = fakeDeps({ created: EXISTS, owner: 'user-old', finish: [{ ok: false, reason: 'unavailable' }, { ok: true, tenantId: 't-3', role: 'member' }] });
    r = await A.handleRegister(REG, f.deps);
    rec('បន្តចុះឈ្មោះ ៖ finish មិនដឹងលទ្ធផល ➜ សាកម្តងទៀត ➜ 200', r.status === 200 && r.body.tenantId === 't-3' && f.kinds() === 'usable,create,signin,finish,finish', { r, log: f.kinds() });
    f = fakeDeps({ created: EXISTS, owner: 'user-old', finish: [{ ok: false, reason: 'unavailable' }, { ok: false, reason: 'unavailable' }] });
    r = await A.handleRegister(REG, f.deps);
    rec('បន្តចុះឈ្មោះ ៖ finish មិនដឹង ២ ដង ➜ 502 registration-unknown · មិនលុប',
        r.status === 502 && r.body.code === 'registration-unknown' && f.kinds() === 'usable,create,signin,finish,finish', { r, log: f.kinds() });
    const finishCases = [
        ['invite-invalid', 403, 'invite-invalid', true],
        ['username-taken', 409, 'username-taken', true],
        ['account-invalid', 400, 'account-invalid', true],
        ['account-exists', 500, 'internal', false],
        ['user-mismatch', 500, 'internal', false]
    ];
    for (const [reason, status, code, rollback] of finishCases) {
        f = fakeDeps({ finish: { ok: false, reason } });
        r = await A.handleRegister(REG, f.deps);
        rec('ចុះឈ្មោះ ៖ finish ' + reason + ' ➜ ' + status + ' ' + code + (rollback ? ' · លុបគណនីវិញ' : ' · មិនលុបគណនី (ភាពមិនប្រក្រតី)'),
            r.status === status && r.body.code === code && f.kinds() === 'usable,create,finish' + (rollback ? ',delete' : ''), { r, log: f.kinds() });
    }
    f = fakeDeps({ finish: [{ ok: false, reason: 'unavailable' }, { ok: true, tenantId: 't-2', role: 'owner' }] });
    r = await A.handleRegister(REG, f.deps);
    rec('ចុះឈ្មោះ ៖ finish មិនដឹងលទ្ធផល ➜ សាកម្តងទៀត (RPC idempotent) ➜ 200', r.status === 200 && r.body.tenantId === 't-2' && f.kinds() === 'usable,create,finish,finish', { r, log: f.kinds() });
    f = fakeDeps({ finish: [{ ok: false, reason: 'unavailable' }, { ok: false, reason: 'unavailable' }] });
    r = await A.handleRegister(REG, f.deps);
    rec('ចុះឈ្មោះ ៖ finish មិនដឹង ២ ដង ➜ 502 registration-unknown · ⛔ មិនលុបគណនី (ប្រហែលជាបានចុះរួច)',
        r.status === 502 && r.body.code === 'registration-unknown' && f.kinds() === 'usable,create,finish,finish', { r, log: f.kinds() });
    f = fakeDeps({ finish: { ok: false, reason: 'username-taken' }, deleted: false });
    r = await A.handleRegister(REG, f.deps);
    rec('ចុះឈ្មោះ ៖ លុបគណនីវិញមិនបាន ➜ សាក ២ ដង ➜ 500 registration-incomplete',
        r.status === 500 && r.body.code === 'registration-incomplete' && f.kinds() === 'usable,create,finish,delete,delete', { r, log: f.kinds() });

    const RESET = { username: 'Sokha', resetCode: 'zzzz-yyyy-xxxx-wwww-vvvv', password: 'new-secret' };
    const wantReset = nodeCrypto.createHash('sha256').update('zoe-reset:ZZZZYYYYXXXXWWWWVVVV').digest('hex');
    f = fakeDeps();
    r = await A.handleResetPassword(RESET, f.deps);
    const chk = f.log.find((x) => x[0] === 'check');
    const upd = f.log.find((x) => x[0] === 'update');
    const cons = f.log.find((x) => x[0] === 'consume');
    rec('កំណត់ពាក្យសម្ងាត់ថ្មី ៖ ជោគជ័យ ➜ 200 password-reset', r.status === 200 && r.body.code === 'password-reset', r);
    rec('កំណត់ពាក្យសម្ងាត់ថ្មី ៖ ពិនិត្យដោយ username តូច + hash «zoe-reset:» (មិនមែន hash អញ្ជើញ)', !!chk && chk[1] === 'sokha' && chk[2] === wantReset, chk);
    rec('កំណត់ពាក្យសម្ងាត់ថ្មី ៖ ប្តូរពាក្យសម្ងាត់របស់ user id ដែលកូដចង', !!upd && upd[1] === 'user-9' && upd[2] === 'new-secret', upd);
    rec('កំណត់ពាក្យសម្ងាត់ថ្មី ៖ លំដាប់ check ➜ update ➜ consume ➜ revoke (កូដមិនស៊ីមុនប្តូរជោគជ័យ)',
        f.kinds() === 'check,update,consume,revoke' && !!cons && cons[2] === wantReset && cons[3] === chk[3] && /^[a-f0-9-]{36}$/.test(chk[3]) && JSON.stringify(f.log[3]) === JSON.stringify(['revoke', 'user-9']), f.kinds());
    f = fakeDeps({ revoked: false });
    r = await A.handleResetPassword(RESET, f.deps);
    rec('កំណត់ពាក្យសម្ងាត់ថ្មី ៖ ផ្តាច់ session មិនបាន ➜ សាក ២ ដង ➜ 200 password-reset-incomplete (និយាយការពិត)',
        r.status === 200 && r.body.code === 'password-reset-incomplete' && f.kinds() === 'check,update,consume,revoke,revoke', { r, log: f.kinds() });
    f = fakeDeps({ consumed: false });
    r = await A.handleResetPassword(RESET, f.deps);
    rec('កំណត់ពាក្យសម្ងាត់ថ្មី ៖ ស៊ីកូដមិនបាន ➜ សាក ២ ដង ➜ 200 password-reset-incomplete',
        r.status === 200 && r.body.code === 'password-reset-incomplete' && f.kinds() === 'check,update,consume,consume,revoke', { r, log: f.kinds() });
    f = fakeDeps({ member: null });
    r = await A.handleResetPassword(RESET, f.deps);
    rec('កំណត់ពាក្យសម្ងាត់ថ្មី ៖ កូដមិនត្រូវនឹង username ➜ 403 reset-code-invalid · មិនប្តូរ', r.status === 403 && r.body.code === 'reset-code-invalid' && f.kinds() === 'check', { r, log: f.kinds() });
    f = fakeDeps({ member: undefined });
    r = await A.handleResetPassword(RESET, f.deps);
    rec('កំណត់ពាក្យសម្ងាត់ថ្មី ៖ DB មិនឆ្លើយ ➜ សាក ២ ដង · 502 · មិនប្តូរ', r.status === 502 && r.body.code === 'db-unavailable' && f.kinds() === 'check,check' && f.log[0][3] === f.log[1][3], { r, log: f.kinds() });
    f = fakeDeps({ members: [undefined, 'user-9'] });
    r = await A.handleResetPassword(RESET, f.deps);
    rec('កំណត់ពាក្យសម្ងាត់ថ្មី ៖ ចម្លើយចាប់កូដបាត់ ➜ សាកដោយ claim ដដែល · ប្តូរម្តង',
        r.status === 200 && f.kinds() === 'check,check,update,consume,revoke' && f.log[0][3] === f.log[1][3] && f.log[0][3] === f.log[3][3], { r, log: f.kinds() });
    f = fakeDeps({ update: 'weak' });
    r = await A.handleResetPassword(RESET, f.deps);
    rec('កំណត់ពាក្យសម្ងាត់ថ្មី ៖ ពាក្យសម្ងាត់ខ្សោយ ➜ 400 password-weak · កូដមិនស៊ី · មិនផ្តាច់ session', r.status === 400 && r.body.code === 'password-weak'
        && f.kinds() === 'check,update,release', { r, log: f.kinds() });
    f = fakeDeps({ update: 'weak', consumed: false });
    r = await A.handleResetPassword(RESET, f.deps);
    rec('កំណត់ពាក្យសម្ងាត់ថ្មី ៖ ពាក្យសម្ងាត់ខ្សោយ តែដោះ claim មិនបាន ➜ 502 password-reset-unknown',
        r.status === 502 && r.body.code === 'password-reset-unknown' && f.kinds() === 'check,update,release,release', { r, log: f.kinds() });
    f = fakeDeps({ update: 'unavailable' });
    r = await A.handleResetPassword(RESET, f.deps);
    rec('កំណត់ពាក្យសម្ងាត់ថ្មី ៖ GoTrue មិនឆ្លើយ ➜ 502 password-reset-unknown · មិនដោះ claim', r.status === 502 && r.body.code === 'password-reset-unknown'
        && f.kinds() === 'check,update', { r, log: f.kinds() });
    const resetEarly = [
        ['body ជា array', [RESET], 'bad-request'],
        ['កូដខ្លី', Object.assign({}, RESET, { resetCode: 'short' }), 'reset-code-invalid'],
        ['គ្មានកូដ', Object.assign({}, RESET, { resetCode: undefined }), 'reset-code-invalid'],
        ['username ខុស', Object.assign({}, RESET, { username: 'a b' }), 'username-invalid'],
        ['ពាក្យសម្ងាត់ខ្លី', Object.assign({}, RESET, { password: 'short' }), 'password-short']
    ];
    for (const [label, body, code] of resetEarly) {
        f = fakeDeps();
        r = await A.handleResetPassword(body, f.deps);
        rec('កំណត់ពាក្យសម្ងាត់ថ្មី ៖ ' + label + ' ➜ 400 ' + code + ' · មិនប៉ះ DB', r.status === 400 && r.body.code === code && f.log.length === 0, { r, log: f.kinds() });
    }
}

async function groupResetConcurrency(m, rec) {
    let used = false;
    let claim = null;
    let releaseUpdate;
    let signalUpdate;
    const updateGate = new Promise((resolve) => { releaseUpdate = resolve; });
    const updateStarted = new Promise((resolve) => { signalUpdate = resolve; });
    const updates = [];
    const deps = {
        resetCodeUser: async () => used ? null : 'user-race',
        claimResetCode: async (username, hash, claimId) => {
            if (used || (claim !== null && claim !== claimId)) return null;
            claim = claimId;
            return 'user-race';
        },
        updatePassword: async (userId, password) => {
            if (password === 'first-password') {
                signalUpdate();
                await updateGate;
            }
            updates.push(password);
            return 'ok';
        },
        consumeResetCode: async () => { used = true; return true; },
        settleResetCode: async (username, hash, claimId, consumed) => {
            if (claim !== claimId) return false;
            used = consumed;
            if (!consumed) claim = null;
            return true;
        },
        revokeSessions: async () => true
    };
    const body = { username: 'sokha', resetCode: INVITE, password: 'first-password' };
    const first = m.account.handleResetPassword(body, deps);
    let second;
    try {
        await m.timeout.withTimeout(updateStarted, 1000, 'first-update-not-started');
        second = await m.timeout.withTimeout(m.account.handleResetPassword({ ...body, password: 'second-password' }, deps), 1000, 'second-reset-hung');
    } finally {
        releaseUpdate();
    }
    const firstResult = await first;
    rec('កំណត់ពាក្យសម្ងាត់ថ្មី ៖ កូដតែមួយស្របពេលគ្នា ➜ ប្តូរតែម្តង · សំណើទីពីរបដិសេធមុនប៉ះ Auth',
        firstResult.status === 200 && second.status === 403 && updates.length === 1 && updates[0] === 'first-password',
        { firstResult, second, updates });
}

async function groupRegisterResume(m, rec) {
    const world = (maxUses) => {
        const users = new Map();
        const members = new Map();
        const w = { users, members, uses: 0, deletes: [], creates: 0, replyLost: 0 };
        w.deps = {
            inviteIsUsable: async () => w.uses < maxUses,
            createUser: async (email, password) => {
                w.creates++;
                if (users.has(email)) return { ok: false, reason: 'exists' };
                const id = 'auth-' + (users.size + 1);
                users.set(email, { id, password });
                if (w.replyLost > 0) { w.replyLost--; return { ok: false, reason: 'unavailable' }; }
                return { ok: true, userId: id };
            },
            passwordUserId: async (email, password) => {
                const u = users.get(email);
                return u && u.password === password ? u.id : null;
            },
            finishRegistration: async ({ userId, username }) => {
                const mine = members.get(userId);
                if (mine) return { ok: true, tenantId: mine.tenantId, role: 'member' };
                if ([...members.values()].some((x) => x.username === username)) return { ok: false, reason: 'username-taken' };
                if (w.uses >= maxUses) return { ok: false, reason: 'invite-invalid' };
                w.uses++;
                members.set(userId, { tenantId: 't-shop', username });
                return { ok: true, tenantId: 't-shop', role: 'member' };
            },
            deleteUser: async (id) => {
                w.deletes.push(id);
                for (const [email, u] of users) if (u.id === id) users.delete(email);
                return true;
            },
            loginDomain: 'u.zoew.invalid'
        };
        return w;
    };
    const body = { invite: INVITE, username: 'sokha', password: 'secret-pass' };
    let w = world(1);
    w.replyLost = 1;
    const lost = await m.account.handleRegister(body, w.deps);
    const orphanBefore = w.users.size === 1 && w.members.size === 0 && w.uses === 0;
    const retry = await m.account.handleRegister(body, w.deps);
    rec('createUser ឆ្លើយបាត់ (Auth បង្កើតរួច · គ្មានសមាជិកភាព) ➜ សាកម្តងទៀតដោយព័ត៌មានដដែល ➜ 200 registered · គណនីតែ ១ · កូដប្រើ ១ · មិនលុប',
        lost.status === 502 && lost.body.code === 'auth-unavailable' && orphanBefore
        && retry.status === 200 && retry.body.code === 'registered' && retry.body.tenantId === 't-shop'
        && w.users.size === 1 && w.members.size === 1 && w.members.has('auth-1') && w.uses === 1 && w.deletes.length === 0,
        { lost, retry, users: w.users.size, members: w.members.size, uses: w.uses, deletes: w.deletes });
    w = world(1);
    w.replyLost = 1;
    await m.account.handleRegister(body, w.deps);
    const stranger = await m.account.handleRegister({ ...body, password: 'other-pass-9' }, w.deps);
    rec('គណនីពាក់កណ្តាល + ពាក្យសម្ងាត់ផ្សេង ➜ 409 username-taken · មិនចងសមាជិកភាព · មិនលុបគណនីអ្នកដទៃ',
        stranger.status === 409 && stranger.body.code === 'username-taken' && w.members.size === 0 && w.uses === 0 && w.deletes.length === 0 && w.users.size === 1,
        { stranger, members: w.members.size, uses: w.uses, deletes: w.deletes });
    const owner = await m.account.handleRegister(body, w.deps);
    rec('ម្ចាស់ពិតសាកម្តងទៀតក្រោយអ្នកដទៃ ➜ 200 · សមាជិកភាពចងលើ user id ដើម', owner.status === 200 && w.members.has('auth-1') && w.uses === 1, { owner, uses: w.uses });
    w = world(3);
    const done = await m.account.handleRegister(body, w.deps);
    const again = await m.account.handleRegister(body, w.deps);
    rec('ចុះឈ្មោះរួច (ចម្លើយបាត់ផ្នែក App) + កូដប្រើបានច្រើនដង ➜ សាកម្តងទៀត ➜ 200 tenant ដដែល · កូដមិនស៊ីលើកទី ២',
        done.status === 200 && again.status === 200 && again.body.tenantId === 't-shop' && w.uses === 1 && w.members.size === 1 && w.deletes.length === 0,
        { done, again, uses: w.uses });
    const taken = await m.account.handleRegister({ ...body, password: 'guess-pass-1' }, w.deps);
    rec('ឈ្មោះរបស់សមាជិក + ពាក្យសម្ងាត់ខុស ➜ 409 username-taken · tenant មិនលេច', taken.status === 409 && taken.body.code === 'username-taken'
        && taken.body.tenantId === undefined && w.uses === 1, taken);
}

const ENV = {
    SUPABASE_URL: 'https://abcdefgh.supabase.co',
    ZOE_SECRET_KEY: KEY,
    ZOE_LOGIN_DOMAIN: 'u.zoew.invalid',
    ZOE_ALLOWED_ORIGINS: 'https://zoew.netlify.app, https://localhost'
};

async function groupHttp(m, rec) {
    const H = m.http;
    const cfg = (over) => H.readConfig((name) => Object.assign({}, ENV, over || {})[name]);
    const base = cfg();
    rec('config ៖ env គ្រប់ ➜ ok', base.ok, base.problems);
    for (const name of Object.keys(ENV)) {
        const c = cfg({ [name]: undefined });
        rec('config ៖ គ្មាន ' + name + ' ➜ មិន ok', !c.ok && c.problems.includes(name === 'ZOE_SECRET_KEY' ? 'ZOE_SECRET_KEY' : name), c.problems);
    }
    const leak = cfg({ ZOE_SECRET_KEY: 'short-secret', ZOE_LOGIN_DOMAIN: 'BAD' });
    rec('config ៖ problems រាយតែឈ្មោះ (secret មិនលេច)', !leak.ok && JSON.stringify(leak.problems) === '["ZOE_SECRET_KEY","ZOE_LOGIN_DOMAIN"]', leak.problems);
    const legacy = cfg({ ZOE_SECRET_KEY: undefined, SUPABASE_SERVICE_ROLE_KEY: KEY });
    rec('config ៖ ZOE_SECRET_KEY អវត្តមាន ➜ ប្រើ SUPABASE_SERVICE_ROLE_KEY', legacy.ok && legacy.secretKey === KEY, legacy.problems);
    rec('config ៖ origin មាន path ➜ មិន ok', !cfg({ ZOE_ALLOWED_ORIGINS: 'https://zoew.netlify.app/app' }).ok);
    rec('config ៖ origin http (មិនមែន localhost) ➜ មិន ok', !cfg({ ZOE_ALLOWED_ORIGINS: 'http://zoew.netlify.app' }).ok);
    rec('config ៖ SUPABASE_URL http សាធារណៈ ➜ មិន ok', !cfg({ SUPABASE_URL: 'http://abcdefgh.supabase.co' }).ok);
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
            if (req.method === 'POST' && u === '/auth/v1/token') {
                const email = body && body.email;
                if (email === 'hang@u.zoe.test') return;
                if (email === 'boom@u.zoe.test') return send(500, { message: 'db down' });
                if (email === 'limit@u.zoe.test') return send(429, { code: 'over_request_rate_limit', message: 'rate' }, v2024);
                if (email === 'unconfirmed@u.zoe.test') return send(400, { code: 'email_not_confirmed', message: 'x' }, v2024);
                if (email === 'legacy@u.zoe.test') return send(400, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' });
                if (!body || body.password !== 'secret-pass') return send(400, { code: 'invalid_credentials', message: 'Invalid login credentials' }, v2024);
                const exp = Math.floor(Date.now() / 1000) + 3600;
                const claims = Buffer.from(JSON.stringify({ sub: USER_ID, email, exp, role: 'authenticated', aud: 'authenticated' })).toString('base64url');
                return send(200, { access_token: 'eyJhbGciOiJIUzI1NiJ9.' + claims + '.sig-' + String(email).split('@')[0], token_type: 'bearer', expires_in: 3600,
                    expires_at: exp, refresh_token: 'refresh-' + String(email).split('@')[0],
                    user: { id: USER_ID, aud: 'authenticated', role: 'authenticated', email, app_metadata: {}, user_metadata: {}, created_at: '2026-09-30T00:00:00Z' } });
            }
            if (req.method === 'POST' && u === '/auth/v1/logout') {
                if (String(req.headers.authorization || '').endsWith('.sig-stuck')) return;
                return send(204);
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
                if (name === 'dup') return send(400, { code: 'P0001', details: null, hint: null, message: 'username-taken' });
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
            if (req.method === 'POST' && u === '/rest/v1/rpc/claim_reset_code') {
                if (body && body.p_username === 'err') return send(500, { code: 'XX000', message: 'x', details: null, hint: null });
                return send(200, body && body.p_username === 'sokha' && body.p_code_hash === 'good' && body.p_claim_id === USER_ID ? USER_ID : null);
            }
            if (req.method === 'POST' && u === '/rest/v1/rpc/settle_reset_code') {
                if (body && body.p_username === 'err') return send(500, { code: 'XX000', message: 'x', details: null, hint: null });
                return send(200, !!body && body.p_username === 'sokha' && body.p_claim_id === USER_ID && typeof body.p_consumed === 'boolean');
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

    const finOk = await D.finishRegistration({ userId: USER_ID, codeHash: 'h', username: 'sokha' });
    const fr = last((x) => x.url === '/rest/v1/rpc/finish_registration');
    rec('adapter ៖ finish_registration ➜ tenant/role', finOk.ok === true && finOk.tenantId === 't-1' && finOk.role === 'owner', finOk);
    const want = sqlArgs(env.migrationSql, 'finish_registration');
    rec('ស្នាមភ្ជាប់ ៖ argument RPC finish_registration ស្មើ SQL ពិត (' + (want || []).join(',') + ')',
        !!fr && !!want && JSON.stringify(Object.keys(fr.body).sort()) === JSON.stringify(want), { sent: fr && Object.keys(fr.body), want });
    rec('adapter ៖ RPC ដែល raise username-taken ➜ reason username-taken',
        ((x) => !x.ok && x.reason === 'username-taken')(await D.finishRegistration({ userId: 'u', codeHash: 'h', username: 'dup' })));
    rec('adapter ៖ សារ RPC មិនស្គាល់ ➜ unavailable',
        ((x) => !x.ok && x.reason === 'unavailable')(await D.finishRegistration({ userId: 'u', codeHash: 'h', username: 'weird' })));
    const t0 = Date.now();
    const hung = await D.finishRegistration({ userId: 'u', codeHash: 'h', username: 'hang' });
    rec('adapter ៖ RPC ព្យួរ ➜ unavailable ក្នុងពិដាន (' + (Date.now() - t0) + 'ms)', !hung.ok && hung.reason === 'unavailable' && Date.now() - t0 < 2000, hung);

    rec('adapter ៖ invite_is_usable ➜ true/false', (await D.inviteIsUsable('good')) === true && (await D.inviteIsUsable('bad')) === false);
    const ur = last((x) => x.url === '/rest/v1/rpc/invite_is_usable');
    const wantU = sqlArgs(env.migrationSql, 'invite_is_usable');
    rec('ស្នាមភ្ជាប់ ៖ argument RPC invite_is_usable ស្មើ SQL ពិត', !!ur && !!wantU && JSON.stringify(Object.keys(ur.body).sort()) === JSON.stringify(wantU),
        { sent: ur && Object.keys(ur.body), wantU });
    rec('adapter ៖ invite_is_usable កំហុស ➜ null (មិនមែន false)', (await D.inviteIsUsable('err')) === null);
    rec('adapter ៖ claim_reset_code ➜ id / null', (await D.claimResetCode('sokha', 'good', USER_ID)) === USER_ID && (await D.claimResetCode('none', 'good', USER_ID)) === null);
    const mr = last((x) => x.url === '/rest/v1/rpc/claim_reset_code');
    const wantM = sqlArgs(env.migrationSql, 'claim_reset_code');
    rec('ស្នាមភ្ជាប់ ៖ argument RPC claim_reset_code ស្មើ SQL ពិត', !!mr && !!wantM && JSON.stringify(Object.keys(mr.body).sort()) === JSON.stringify(wantM),
        { sent: mr && Object.keys(mr.body), wantM });
    rec('adapter ៖ claim_reset_code កំហុស ➜ undefined (មិនមែន null «កូដខុស»)', (await D.claimResetCode('err', 'good', USER_ID)) === undefined);
    rec('adapter ៖ settle_reset_code ➜ true / false', (await D.settleResetCode('sokha', 'h', USER_ID, true)) === true && (await D.settleResetCode('none', 'h', USER_ID, true)) === false);
    const cr2 = last((x) => x.url === '/rest/v1/rpc/settle_reset_code');
    const wantC = sqlArgs(env.migrationSql, 'settle_reset_code');
    rec('ស្នាមភ្ជាប់ ៖ argument RPC settle_reset_code ស្មើ SQL ពិត', !!cr2 && !!wantC && JSON.stringify(Object.keys(cr2.body).sort()) === JSON.stringify(wantC),
        { sent: cr2 && Object.keys(cr2.body), wantC });
    rec('adapter ៖ settle_reset_code កំហុស ➜ false', (await D.settleResetCode('err', 'h', USER_ID, true)) === false);
    rec('adapter ៖ settle_reset_code ដោះ claim ➜ consumed=false និង claim id ដដែល', (await D.settleResetCode('sokha', 'h', USER_ID, false)) === true
        && last((x) => x.url === '/rest/v1/rpc/settle_reset_code').body.p_consumed === false
        && last((x) => x.url === '/rest/v1/rpc/settle_reset_code').body.p_claim_id === USER_ID);
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

    const opts = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
    let probes = 0;
    const P = m.admin.adminDeps(client, 400, () => { probes++; return env.createClient(mock.url, KEY, opts); });
    mock.requests.length = 0;
    const owner = await P.passwordUserId('sokha@u.zoe.test', 'secret-pass');
    const tok = last((x) => x.url.split('?')[0] === '/auth/v1/token');
    const out = last((x) => x.url.split('?')[0] === '/auth/v1/logout');
    rec('adapter ៖ passwordUserId ➜ POST /auth/v1/token?grant_type=password {email, password} ➜ user id',
        owner === USER_ID && !!tok && /[?&]grant_type=password(&|$)/.test(tok.url) && tok.body.email === 'sokha@u.zoe.test' && tok.body.password === 'secret-pass', { owner, tok: tok && tok.url });
    rec('adapter ៖ passwordUserId ផ្តាច់ session ផ្ទៀងផ្ទាត់ (logout scope=local ដោយ token របស់វា) · client ថ្មីរាល់ការហៅ',
        !!out && /[?&]scope=local(&|$)/.test(out.url) && String(out.headers.authorization || '').endsWith('.sig-sokha') && probes === 1, { out: out && out.url, probes });
    await D.inviteIsUsable('good');
    const after = last((x) => x.url === '/rest/v1/rpc/invite_is_usable');
    rec('adapter ៖ ក្រោយផ្ទៀងពាក្យសម្ងាត់ RPC របស់ admin client នៅប្រើ secret key (មិនមែន token អ្នកប្រើ)',
        !!after && after.headers.apikey === KEY && !String(after.headers.authorization || '').includes('.sig-'), after && after.headers.authorization);
    rec('adapter ៖ ពាក្យសម្ងាត់ខុស (invalid_credentials) ➜ null', (await P.passwordUserId('sokha@u.zoe.test', 'wrong-pass')) === null);
    rec('adapter ៖ invalid_credentials (API ចាស់ error_code) ➜ null', (await P.passwordUserId('legacy@u.zoe.test', 'secret-pass')) === null);
    rec('adapter ៖ email_not_confirmed ➜ null', (await P.passwordUserId('unconfirmed@u.zoe.test', 'secret-pass')) === null);
    rec('adapter ៖ GoTrue 500 ➜ undefined (មិនដឹង ≠ ពាក្យសម្ងាត់ខុស)', (await P.passwordUserId('boom@u.zoe.test', 'secret-pass')) === undefined);
    rec('adapter ៖ rate limit 429 ➜ undefined', (await P.passwordUserId('limit@u.zoe.test', 'secret-pass')) === undefined);
    const t1 = Date.now();
    const hungSignIn = await P.passwordUserId('hang@u.zoe.test', 'secret-pass');
    rec('adapter ៖ /token ព្យួរ ➜ undefined ក្នុងពិដាន (' + (Date.now() - t1) + 'ms)', hungSignIn === undefined && Date.now() - t1 < 2000, hungSignIn);
    const t2 = Date.now();
    const stuck = await m.timeout.withTimeout(P.passwordUserId('stuck@u.zoe.test', 'secret-pass'), 3000, 'stuck-hung').catch(() => 'hung');
    const afterStuck = await D.inviteIsUsable('good');
    const stuckRpc = last((x) => x.url === '/rest/v1/rpc/invite_is_usable');
    rec('adapter ៖ logout ព្យួរ ➜ នៅឆ្លើយ user id ក្នុងពិដាន · RPC admin បន្ទាប់មិនជាប់ session នោះ (' + (Date.now() - t2) + 'ms)',
        stuck === USER_ID && Date.now() - t2 < 2000 && afterStuck === true && !!stuckRpc && !String(stuckRpc.headers.authorization || '').includes('.sig-'),
        { stuck, afterStuck, auth: stuckRpc && stuckRpc.headers.authorization });
    rec('adapter ៖ គ្មានរោងចក្រ client ផ្ទៀងផ្ទាត់ ➜ undefined (fail closed)', (await D.passwordUserId('sokha@u.zoe.test', 'secret-pass')) === undefined);
    const same = m.admin.adminDeps(client, 400, () => client);
    rec('adapter ៖ រោងចក្រផ្តល់ admin client ខ្លួនឯង ➜ undefined (session អ្នកប្រើមិនចូល client រួម)',
        (await same.passwordUserId('sokha@u.zoe.test', 'secret-pass')) === undefined);
}

async function runGroups(m, env, stopOnFail) {
    const results = [];
    const STOP = Symbol('stop');
    const rec = (label, cond, detail) => {
        results.push({ label, pass: !!cond, detail });
        if (!cond && stopOnFail) throw STOP;
    };
    const groups = [['invite', groupInvite], ['account', groupAccount], ['register-resume', groupRegisterResume], ['reset-concurrency', groupResetConcurrency], ['http', groupHttp]];
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
    const names = { invite: 'invite-code.ts', timeout: 'timeout.ts', account: 'account-core.ts', http: 'http.ts', admin: 'admin-deps.ts' };
    for (const [k, f] of Object.entries(names)) out[k] = await import(pathToFileURL(path.join(dir, f)).href);
    return out;
}

const MUTATIONS = [
    ['invite-code.ts', 'មិនពិនិត្យ alphabet', '        if (!INVITE_CODE_ALPHABET.includes(ch)) return null;\n', ''],
    ['invite-code.ts', 'មិនប្តូរ O ➜ 0', ".replace(/O/g, '0')", ''],
    ['invite-code.ts', 'កូដកំណត់ថ្មីប្រើ prefix អញ្ជើញ', 'return prefixedHash(RESET_HASH_PREFIX, normalized);', 'return prefixedHash(INVITE_HASH_PREFIX, normalized);'],
    ['account-core.ts', 'មិនពិនិត្យកូដមុនបង្កើតគណនី', "    if (!usable) return reply(403, 'invite-invalid');\n", ''],
    ['account-core.ts', 'DB មិនឆ្លើយ ➜ ចាត់ទុកកូដត្រឹមត្រូវ', "    if (usable === null) return reply(502, 'db-unavailable');\n", ''],
    ['account-core.ts', 'check DB មិនឆ្លើយ ➜ «ប្រើរួច»', "        if (usableNow === null) return reply(502, 'db-unavailable');\n", ''],
    ['account-core.ts', 'check ធ្លាក់ចូលការចុះឈ្មោះ', '    if (body.check === true) {', '    if (body.check === false) {'],
    ['account-core.ts', 'លុបគណនីលើលទ្ធផលមិនដឹង', '    if (!ROLLBACK_REASONS.has(finished.reason)) return reply(...FINISH_REPLY[finished.reason]);\n', ''],
    ['account-core.ts', 'មិនសាក finish ម្តងទៀត', "    if (!first.ok && first.reason === 'unavailable') return deps.finishRegistration(request);\n", ''],
    ['account-core.ts', 'គណនីមានរួច ➜ username-taken ភ្លាម (មិនបន្ត)', "        if (created.reason === 'exists') return resumeRegistration(deps, email, password, codeHash, username);",
        "        if (created.reason === 'exists') return reply(409, 'username-taken');"],
    ['account-core.ts', 'បន្តដោយមិនផ្ទៀងពាក្យសម្ងាត់', "    if (userId === null) return reply(409, 'username-taken');\n", ''],
    ['account-core.ts', 'Auth មិនដឹង ➜ username-taken', "    if (userId === undefined) return reply(502, 'auth-unavailable');", "    if (userId === undefined) return reply(409, 'username-taken');"],
    ['account-core.ts', 'បន្តរួចលុបគណនីពេល finish បដិសេធ', "    return reply(...FINISH_REPLY[finished.reason]);\n}\n\nexport async function handleRegister",
        "    await deps.deleteUser(userId);\n    return reply(...FINISH_REPLY[finished.reason]);\n}\n\nexport async function handleRegister"],
    ['admin-deps.ts', 'ផ្ទៀងពាក្យសម្ងាត់លើ admin client រួម', 'await withTimeout(probe.auth.signInWithPassword({ email, password })', 'await withTimeout(client.auth.signInWithPassword({ email, password })'],
    ['admin-deps.ts', 'មិនរាំង probe ជា admin client', '                if (probe === client) return undefined;\n', ''],
    ['admin-deps.ts', 'កំហុស sign-in ទាំងអស់ ➜ null', 'if (error) return SIGN_IN_REFUSED_CODES.has(errorCode(error)) ? null : undefined;', 'if (error) return null;'],
    ['admin-deps.ts', 'មិនផ្តាច់ session ផ្ទៀងផ្ទាត់', "                if (data && data.session) await withTimeout(probe.auth.signOut({ scope: 'local' }), timeoutMs, 'timeout').catch(() => null);\n", ''],
    ['admin-deps.ts', 'logout គ្មានពិដាន', "await withTimeout(probe.auth.signOut({ scope: 'local' }), timeoutMs, 'timeout').catch(() => null);", "await probe.auth.signOut({ scope: 'local' });"],
    ['account-core.ts', 'reset មិនពិនិត្យកូដ', "    if (userId === null) return reply(403, 'reset-code-invalid');\n", "    if (userId === null) return reply(200, 'password-reset');\n"],
    ['account-core.ts', 'reset មិនសាក claim ដដែល', "    if (userId === undefined) userId = await deps.claimResetCode(username, codeHash, claimId);\n", ''],
    ['account-core.ts', 'reset claim សាកដោយ id ថ្មី', 'if (userId === undefined) userId = await deps.claimResetCode(username, codeHash, claimId);', 'if (userId === undefined) userId = await deps.claimResetCode(username, codeHash, crypto.randomUUID());'],
    ['account-core.ts', 'reset ពាក្យសម្ងាត់ខ្សោយមិនដោះ claim', 'const released = (await deps.settleResetCode(username, codeHash, claimId, false)) || (await deps.settleResetCode(username, codeHash, claimId, false));', 'const released = true;'],
    ['account-core.ts', 'reset ប្តូរពាក្យសម្ងាត់មុន claim', '    const claimId = crypto.randomUUID();', "    await deps.updatePassword('user-race', body.password as string);\n    const claimId = crypto.randomUUID();"],
    ['account-core.ts', 'reset ប្រើ hash អញ្ជើញ', '    const codeHash = await resetCodeHash(code);', '    const codeHash = await inviteCodeHash(code);'],
    ['account-core.ts', 'មិនផ្តាច់ session ក្រោយកំណត់ថ្មី', "    const revoked = (await deps.revokeSessions(userId)) || (await deps.revokeSessions(userId));", '    const revoked = true;'],
    ['account-core.ts', 'reset រាយជោគជ័យពេញលេញទោះស៊ីកូដមិនបាន', "consumed && revoked ? 'password-reset'", "revoked ? 'password-reset'"],
    ['http.ts', 'loginDomain មិនបង្ខំ .invalid', " || !loginDomain.endsWith('.invalid')", ''],
    ['admin-deps.ts', 'revokeSessions ជឿកំហុស', "                return !error && typeof data === 'number';", '                return true;'],
    ['admin-deps.ts', 'settleResetCode ជឿកំហុស', "                return !error && data === true;", '                return !error;'],
    ['admin-deps.ts', 'claimResetCode កំហុស ➜ null', "                if (error) return undefined;\n                if (data === null) return null;\n                return typeof data === 'string' ? data : undefined;\n            } catch {\n                return undefined;\n            }\n        },\n        async settleResetCode",
        "                if (error) return null;\n                if (data === null) return null;\n                return typeof data === 'string' ? data : undefined;\n            } catch {\n                return undefined;\n            }\n        },\n        async settleResetCode"],
    ['account-core.ts', 'មិនកំណត់ ៧២ byte', "    if (new TextEncoder().encode(raw).length > PASSWORD_MAX_BYTES) return 'password-long';\n", ''],
    ['http.ts', 'មិនបដិសេធ origin មិនស្គាល់', "    if (origin !== null && !allowed) return json(403, { ok: false, code: 'origin-denied' }, cors);\n", ''],
    ['http.ts', 'មិនកំណត់ទំហំ body', '            if (total > maxBytes) {', '            if (false) {'],
    ['http.ts', 'មិនបដិសេធ UTF-8 ខូច', "new TextDecoder('utf-8', { fatal: true })", "new TextDecoder('utf-8')"],
    ['admin-deps.ts', 'email_confirm false', 'email_confirm: true', 'email_confirm: false'],
    ['admin-deps.ts', 'ឈ្មោះ argument RPC ខុស', 'p_code_hash: input.codeHash', 'p_invite_hash: input.codeHash'],
    ['admin-deps.ts', 'កំហុស invite_is_usable ➜ false', "                if (error || typeof data !== 'boolean') return null;", "                if (error || typeof data !== 'boolean') return false;"]
];

async function main() {
    console.log('=== supabase-functions ៖ កូដអញ្ជើញ · ចុះឈ្មោះ · កំណត់ពាក្យសម្ងាត់ថ្មី · HTTP · supabase-js ពិត · mutation ===');
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
    ok('config.toml ៖ ការប្តូរអ៊ីមែល/ពាក្យសម្ងាត់ត្រូវបញ្ជាក់តាមអ៊ីមែល (.invalid ផ្ញើមិនដល់ ➜ ប្តូរមិនបាន · កំណត់ថ្មីតែតាមកូដពីអ្នកលក់)',
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
    ok('function មិនប្រើ console (កូដ · ពាក្យសម្ងាត់ · secret មិនចូល log)', tsFiles.length >= 7 && withConsole.length === 0, withConsole);
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
        ok('functions/' + d + '/index.ts ៖ គ្មាន OTP/Firebase (ចុះឈ្មោះដោយកូដអញ្ជើញតែម្យ៉ាង)', !/firebase|otp|phone/i.test(src));
        ok('functions/' + d + '/index.ts ៖ ឆ្លង adminDeps(admin…) ដែលបង្កើតតែពេល config.ok', /adminDeps\(admin\b/.test(src) && /const admin = config\.ok/.test(src));
        if (handlers[0] === 'handleRegister') {
            ok('functions/' + d + '/index.ts ៖ ផ្ទៀងពាក្យសម្ងាត់លើ client ថ្មីរាល់ការហៅ (មិនមែន admin រួម)',
                /const openProbe = \(\) => createClient\(/.test(src) && /adminDeps\(admin, ADMIN_CALL_TIMEOUT_MS, openProbe\)/.test(src));
        }
        const suffix = (src.match(/corsHeaders\['Access-Control-Allow-Headers'\] \+ '([^']*)'/) || [])[1];
        ok('functions/' + d + '/index.ts ៖ Allow-Headers ដេរីវេពី corsHeaders របស់ SDK', typeof suffix === 'string');
        if (typeof suffix === 'string') allowSuffix = suffix;
    }

    const real = await loadModules(SHARED);
    const sdkEntry = depPath(path.join('@supabase', 'supabase-js', 'dist', 'index.mjs'));
    const env = { migrationSql, createClient: null };
    if (sdkEntry) env.createClient = (await import(pathToFileURL(sdkEntry).href)).createClient;
    else skipPart('គ្មាន @supabase/supabase-js ➜ adapter/ស្នាមភ្ជាប់ SDK មិនបានវាស់');
    mock = await startMock();

    console.log('\n── ២. ក្រុមតេស្តលើ module ពិត ──');
    const results = await runGroups(real, env, false);
    for (const r of results) ok(r.label, r.pass, r.pass ? undefined : r.detail);
    ok('ការអះអាងក្រុម >= ' + (env.createClient ? 90 : 60) + ' (ឃើញ ' + results.length + ')', results.length >= (env.createClient ? 90 : 60), results.length);

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
            extends: path.join(SB, 'tsconfig.json').replace(/\\/g, '/'),
            compilerOptions: { paths: { ['npm:@supabase/supabase-js@' + sdkVersion]: [sdkTypes.replace(/\\/g, '/')], ['npm:@supabase/supabase-js@' + sdkVersion + '/cors']: [corsTypes.replace(/\\/g, '/')] } },
            include: [path.join(FN_DIR, '**', '*.ts'), path.join(SB, 'types', '*.d.ts')].map((p) => p.replace(/\\/g, '/'))
        };
        fs.writeFileSync(path.join(tmp, 'tsconfig.json'), JSON.stringify(conf));
        const r = cp.spawnSync(process.execPath, [tscBin, '-p', path.join(tmp, 'tsconfig.json'), '--listFiles'], { encoding: 'utf8', timeout: 120000 });
        fs.rmSync(tmp, { recursive: true, force: true });
        const out = String(r.stdout || '') + String(r.stderr || '');
        const checked = out.split('\n').filter((l) => l.startsWith(FN_DIR.replace(/\\/g, '/'))).length;
        ok('tsc strict ៖ ០ កំហុស (ឯកសារ function ដែលពិនិត្យ ' + checked + ')', r.status === 0 && checked >= tsFiles.length && tsFiles.length >= 7,
            out.split('\n').filter((l) => /error TS/.test(l)).slice(0, 8));
        ok('tsc ៖ type មកពី supabase-js ពិត (មិនមែន any)', out.includes(sdkTypes.replace(/\\/g, '/')));
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
        fs.writeFileSync(path.join(tmp, file), src.replace(from, () => to));
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
