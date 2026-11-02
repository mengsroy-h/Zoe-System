// ថ្នាក់ ៖ **ឃ្លាំងទិន្នន័យ Supabase (tenant តែមួយ Project ចែកគ្នា) ជំនួស RTDB ➜ ការឆ្លង tenant · រូបរាងទិន្នន័យ · transaction · ការទាញ delta
// ខុសតែមួយ = ទិន្នន័យអតិថិជនលេចធ្លាយ ឬលុយខុស។**
//
//   npm ci --prefix supabase
//   node audit-tools/supabase-datastore-test.js
//
// ⛔ វាស់លើ Postgres ពិត (harness `supabase-pg.js` ៖ role · schema auth/realtime ដូច Supabase) ជាមួយ migration ពិតទាំងអស់ ៖
//   ១. ការឆ្លង tenant ៖ zoe_read · zoe_pull · SELECT តារាង · rules lookup (`root.child(...)`) មិនឃើញ tenant ផ្សេង · broadcast តាម topic
//   ២. រូបរាង RTDB ៖ array ➜ object តាម index · null/ទទេបាត់ · កូនសោហាម · ជម្រៅ · លេខលើស double
//   ៣. transaction (cas) · seq ឡើងជាលំដាប់ · op_id idempotent (inc មិនអនុវត្ត ២ ដង) · update ជាន់ path ➜ បដិសេធ
//   ៤. ការទាញ delta ៖ tombstone · paging មិនកាត់ក្រុម seq · cursor ចាស់ជាង purge ➜ reset · ការសរសេរស្របគ្នាមិនរំលង
//   ៥. mutation លើ migration ពិត ➜ អ្នកយាមត្រូវក្រហម
// ⛔ ភាពដូច RTDB នៃ rules (verdict ទល់ verdict) វាស់ក្នុង `emu/supabase-rules-parity-test.js` (RTDB emulator ជា oracle)។
'use strict';

process.exitCode = 1;

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = process.env.SUPABASE_DS_APP_DIR ? path.resolve(process.env.SUPABASE_DS_APP_DIR) : path.join(__dirname, '..');
const REPO = process.env.ZOE_REPO_ROOT ? path.resolve(process.env.ZOE_REPO_ROOT) : path.join(__dirname, '..');
const STRICT = process.env.SUPABASE_STRICT === '1';
const RULES_GENERATOR_ONLY = process.argv.includes('--rules-generator-only');
const MIGRATIONS_DIR = path.join(ROOT, 'supabase', 'migrations');
const DEPS_DIRS = [process.env.SUPABASE_DEPS_DIR, path.join(ROOT, 'supabase', 'node_modules'), path.join(REPO, 'supabase', 'node_modules')].filter(Boolean);

let pass = 0, fail = 0;
const skipped = [];
function ok(label, cond, detail) {
    if (cond) { pass++; console.log('  ok    ' + label); }
    else { fail++; console.log('  FAIL  ' + label + (detail !== undefined ? '\n        ' + JSON.stringify(detail).slice(0, 900) : '')); }
}
function finish() {
    if (skipped.length) console.log('SKIP ' + skipped.join(' · ') + ' (រត់ ៖ npm ci --prefix supabase)');
    console.log('\n' + (fail === 0 ? (skipped.length ? 'PARTIAL PASS (' + pass + '; SKIP ' + skipped.length + ')' : '✅ ជោគជ័យទាំងអស់ ' + pass)
        : '❌ ធ្លាក់ ' + fail + ' (ជោគជ័យ ' + pass + ')'));
    process.exitCode = fail === 0 ? 0 : 1;
}

console.log('=== supabase-datastore ៖ Postgres ពិត · tenant · រូបរាង RTDB · transaction · delta · realtime · mutation ===');
const MIGRATION_RE = /^\d{14}_[a-z0-9_]+\.sql$/;
const MIGRATION_BASE = process.env.SUPABASE_MIGRATION_BASE || process.env.VERSIONSCOPE_BASE || 'origin/main';
const migrationFiles = fs.existsSync(MIGRATIONS_DIR) ? fs.readdirSync(MIGRATIONS_DIR).filter((f) => MIGRATION_RE.test(f)).sort() : [];
const migrationSql = migrationFiles.map((f) => fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8')).join('\n;\n');
ok('migration ឃ្លាំងទិន្នន័យមាន (zoe_docs · zoe_write · zoe_pull)', /create table public\.zoe_docs/.test(migrationSql)
    && /create function public\.zoe_write\(/.test(migrationSql) && /create function public\.zoe_pull\(/.test(migrationSql));
const configText = fs.existsSync(path.join(ROOT, 'supabase', 'config.toml')) ? fs.readFileSync(path.join(ROOT, 'supabase', 'config.toml'), 'utf8') : '';
const wantMajor = parseInt((configText.match(/^major_version\s*=\s*(\d+)\s*$/m) || [])[1] || '0', 10);

const { createPgHarness } = require('./supabase-pg.js');
const H = RULES_GENERATOR_ONLY ? null : createPgHarness({ depsDirs: DEPS_DIRS, shimDir: path.join(__dirname, 'supabase-shim'), wantMajor });
const { as, makeAuthUser, denied, raised } = H || {};

const STOP = Symbol('stop');
let opCounter = 0;
const newOp = () => 'op' + process.pid + 'x' + (++opCounter).toString(36).padStart(12, '0');
const future = () => new Date(Date.now() + 30 * 86400000).toISOString();

async function setupTenants(c) {
    const adminId = await makeAuthUser(c, 'boss@u.zoe.test');
    await c.query('insert into public.platform_admins (user_id) values ($1)', [adminId]);
    const adminSession = (await c.query('insert into auth.sessions (id, user_id, created_at) values (gen_random_uuid(), $1, now()) returning id', [adminId])).rows[0].id;
    const ADMIN = { role: 'authenticated', sub: adminId, extra: { session_id: adminSession } };
    const SERVICE = { role: 'service_role' };
    const tenants = {};
    for (const [name, branch, user] of [['A', '881859', 'sokha'], ['B', '770001', 'dara']]) {
        const t = await as(c, ADMIN, 'select * from public.admin_create_tenant($1, $2, $3)', ['ហាង ' + name, branch, future()]);
        if (!t.rows) throw new Error('setup tenant failed ' + JSON.stringify(t.error));
        const inv = await as(c, ADMIN, "select * from public.admin_issue_invite($1, 'owner', 1, 24)", [t.rows[0].id]);
        if (!inv.rows) throw new Error('setup invite failed ' + JSON.stringify(inv.error));
        const hash = (await c.query('select private.invite_code_hash($1) as h', [inv.rows[0].code])).rows[0].h;
        const uid = await makeAuthUser(c, user + '@u.zoe.test');
        const reg = await as(c, SERVICE, 'select * from public.finish_registration($1, $2, $3)', [uid, hash, user]);
        if (!reg.rows) throw new Error('setup registration failed ' + JSON.stringify(reg.error));
        tenants[name] = { id: t.rows[0].id, who: { role: 'authenticated', sub: uid } };
    }
    return { ADMIN, SERVICE, tenants };
}

async function body(c, rec, extra) {
    const { SERVICE, tenants } = await setupTenants(c);
    const A = tenants.A, B = tenants.B;
    const ANON = { role: 'anon' };
    const write = async (who, ops, opId) => {
        const r = await as(c, who, 'select public.zoe_write($1, $2::jsonb) as r', [opId || newOp(), JSON.stringify(ops)]);
        return r.rows ? r.rows[0].r : r;
    };
    const read = async (who, root, key) => {
        const r = await as(c, who, 'select public.zoe_read($1, $2) as r', [root, key === undefined ? null : key]);
        return r.rows ? r.rows[0].r : r;
    };
    const pull = async (who, since, limit) => {
        const r = await as(c, who, 'select public.zoe_pull($1, $2) as r', [since, limit || 2000]);
        return r.rows ? r.rows[0].r : r;
    };
    const admin = async (tenant, ops, replace) => {
        const r = await as(c, SERVICE, 'select public.zoe_admin_write($1, $2, $3::jsonb, $4) as r', [tenant, newOp(), JSON.stringify(ops), !!replace]);
        return r.rows ? r.rows[0].r : r;
    };
    const docOf = (res, root, key) => (res && res.docs || []).find((d) => d.r === root && d.k === key);
    const HIST = 'zoew_scan_history_cod_dod';
    const TRASH = 'zoew_recently_deleted_cod_dod';
    const REG = 'zoew_barcode_registry';
    const DAILY = 'zoew_daily_revenue_cod_dod';
    const item = (id, over) => Object.assign({ id, phone: '012345678', cod: 10, dod: 2, price: 12, count: 1, isClosed: false, createdAt: 1790000000000,
        scanDate: '2026-10-01', time: '09:00:00 (2026-10-01)', barcodes: [{ code: 'ZT' + id, cod: 10, dod: 2, isClosed: false, createdAt: 1790000000000 }] }, over || {});

    const w1 = await write(A.who, [{ k: 'set', p: [HIST, 'item1'], v: item('item1') }]);
    rec('A ៖ zoe_write ទទួល record ប្រវត្តិត្រឹមត្រូវ ➜ ok · seq 1', !!w1 && w1.ok === true && w1.seq === 1, w1);
    const stored = docOf(w1, HIST, 'item1');
    rec('រូបរាង RTDB ៖ array barcodes ➜ object {"0": …} (ដូច RTDB ផ្ទុក)', !!stored && stored.v.barcodes && !Array.isArray(stored.v.barcodes)
        && JSON.stringify(Object.keys(stored.v.barcodes)) === '["0"]', stored);
    rec('A ៖ zoe_read ឃើញ item1', ((await read(A.who, HIST)).docs || []).length === 1);
    rec('B ៖ zoe_read មិនឃើញ item1 (ការឆ្លង tenant)', ((await read(B.who, HIST)).docs || [1]).length === 0);
    rec('B ៖ zoe_read តាម key ផ្ទាល់ ➜ ទទេ', ((await read(B.who, HIST, 'item1')).docs || [1]).length === 0);
    const pb = await pull(B.who, 0);
    rec('B ៖ zoe_pull ពី 0 ➜ ជួរដេក ០', !!pb && Array.isArray(pb.rows) && pb.rows.length === 0, pb);
    const selB = await as(c, B.who, 'select count(*)::int as n from public.zoe_docs');
    rec('B ៖ SELECT zoe_docs ផ្ទាល់ (RLS) ➜ ០', !!selB.rows && selB.rows[0].n === 0, selB);
    const selA = await as(c, A.who, 'select count(*)::int as n from public.zoe_docs');
    rec('A ៖ SELECT zoe_docs ផ្ទាល់ (RLS) ➜ ១', !!selA.rows && selA.rows[0].n === 1, selA);
    const stB = await as(c, B.who, 'select count(*)::int as n from public.zoe_tenant_state');
    rec('B ៖ SELECT zoe_tenant_state ➜ មិនឃើញរបស់ A', !!stB.rows && stB.rows[0].n === 0, stB);
    const NOMEM = { role: 'authenticated', sub: await makeAuthUser(c, 'squatter@u.zoe.test') };
    const forbiddenErr = (r) => !!r.error && r.error.message === 'forbidden';
    rec('គណនីគ្មានហាង (បង្កើតតាម GoTrue sign-up ផ្ទាល់ · គ្មាន tenant_members) ៖ zoe_write ➜ forbidden',
        forbiddenErr(await as(c, NOMEM, 'select public.zoe_write($1, $2::jsonb)', [newOp(), JSON.stringify([{ k: 'set', p: [REG, 'SQ1'], v: true }])])));
    rec('គណនីគ្មានហាង ៖ zoe_read · zoe_pull ➜ forbidden',
        forbiddenErr(await as(c, NOMEM, 'select public.zoe_read($1, null)', [HIST])) && forbiddenErr(await as(c, NOMEM, 'select public.zoe_pull(0, 10)')));
    const nomemSel = await as(c, NOMEM, 'select (select count(*) from public.zoe_docs)::int as d, (select count(*) from public.zoe_tenant_state)::int as s');
    rec('គណនីគ្មានហាង ៖ SELECT zoe_docs · zoe_tenant_state ផ្ទាល់ (RLS) ➜ ០', !!nomemSel.rows && nomemSel.rows[0].d === 0 && nomemSel.rows[0].s === 0, nomemSel);
    rec('គណនីគ្មានហាង ៖ មិនមាន doc ណាមួយត្រូវសរសេរ (SQ1)', (await c.query("select count(*)::int as n from public.zoe_docs where key = 'SQ1'")).rows[0].n === 0);
    rec('anon ៖ zoe_write ➜ permission denied', denied(await as(c, ANON, 'select public.zoe_write($1, $2::jsonb)', [newOp(), '[]'])));
    rec('anon ៖ zoe_pull ➜ permission denied', denied(await as(c, ANON, 'select public.zoe_pull(0, 10)')));
    rec('anon ៖ SELECT zoe_docs ➜ permission denied', denied(await as(c, ANON, 'select 1 from public.zoe_docs')));
    rec('authenticated ៖ zoe_admin_write ➜ permission denied', denied(await as(c, A.who, 'select public.zoe_admin_write($1, $2, $3::jsonb, false)',
        [B.id, newOp(), JSON.stringify([{ k: 'set', p: [HIST, 'x1'], v: item('x1') }])])));
    rec('authenticated ៖ zoe_ops មិនអានបាន', denied(await as(c, A.who, 'select 1 from public.zoe_ops')));
    rec('authenticated ៖ INSERT zoe_docs ផ្ទាល់ ➜ permission denied', denied(await as(c, A.who,
        "insert into public.zoe_docs (tenant_id, root, key, value, seq) values ($1, 'zoew_barcode_registry', 'X', 'true', 99)", [B.id])));

    const forged = { role: 'authenticated', sub: A.who.sub, extra: { tenant_id: B.id, app_metadata: { tenant_id: B.id } } };
    rec('claim ក្លែង tenant_id របស់ B ➜ ការសរសេរនៅចុះលើ A', ((r) => !!r && r.ok)(await write(forged, [{ k: 'set', p: [REG, 'FORGED1'], v: true }]))
        && ((await read(B.who, REG, 'FORGED1')).docs || [1]).length === 0 && ((await read(A.who, REG, 'FORGED1')).docs || []).length === 1);

    const bad = [
        ['ledger អវិជ្ជមាន', [{ k: 'set', p: [DAILY, '2026-10-01'], v: { codDollar: -1, dodDollar: 0, totalCount: 0 } }]],
        ['វាលមិនស្គាល់ ($other false)', [{ k: 'set', p: [HIST, 'item9'], v: item('item9', { hacker: 1 }) }]],
        ['registry = false', [{ k: 'set', p: [REG, 'K1'], v: false }]],
        ['root មិនស្គាល់', [{ k: 'set', p: ['zoew_unknown', 'k'], v: 1 }]],
        ['trashReason ខុស', [{ k: 'set', p: [TRASH, 'item8'], v: Object.assign(item('item8'), { trashReason: 'stolen', deletedAt: 1 }) }]]
    ];
    for (const [label, ops] of bad) {
        const r = await as(c, A.who, 'select public.zoe_write($1, $2::jsonb) as r', [newOp(), JSON.stringify(ops)]);
        rec('rules ៖ ' + label + ' ➜ permission_denied (42501)', !!r.error && r.error.code === '42501' && r.error.message === 'permission_denied', r);
    }
    const afterBad = await pull(A.who, 1);
    rec('ការសរសេរដែលបដិសេធ មិនបន្សល់ជួរដេក/seq', !!afterBad && afterBad.rows.filter((x) => x.k !== 'FORGED1').length === 0, afterBad);

    const canon = await write(A.who, [{ k: 'set', p: [HIST, 'item2'], v: item('item2', { locker: '', barcodes: [null, { code: 'Z2', cod: 1, dod: 0, isClosed: false }, {}], callMark: null }) }]);
    const canonDoc = docOf(canon, HIST, 'item2');
    rec('រូបរាង RTDB ៖ [null, x, {}] ➜ {"1": x} · null/ទទេបាត់', !!canonDoc && JSON.stringify(Object.keys(canonDoc.v.barcodes)) === '["1"]'
        && !('callMark' in canonDoc.v) && canonDoc.v.locker === '', canonDoc);
    const badKey = await as(c, A.who, 'select public.zoe_write($1, $2::jsonb)', [newOp(), JSON.stringify([{ k: 'set', p: [HIST, 'item3'], v: { 'a.b': 1 } }])]);
    rec('កូនសោមាន «.» ➜ invalid_data (22023)', !!badKey.error && badKey.error.code === '22023' && badKey.error.message === 'invalid_data', badKey);
    const badPath = await as(c, A.who, 'select public.zoe_write($1, $2::jsonb)', [newOp(), JSON.stringify([{ k: 'set', p: [HIST, 'a/b'], v: 1 }])]);
    rec('path មាន «/» ➜ invalid_path', !!badPath.error && badPath.error.message === 'invalid_path', badPath);
    let deep = 1;
    for (let i = 0; i < 40; i++) deep = { d: deep };
    const tooDeep = await as(c, A.who, 'select public.zoe_write($1, $2::jsonb)', [newOp(), JSON.stringify([{ k: 'set', p: [HIST, 'item3'], v: deep }])]);
    rec('ជម្រៅ > ៣២ ➜ invalid_data', !!tooDeep.error && tooDeep.error.message === 'invalid_data', tooDeep);
    const huge = await as(c, A.who, "select public.zoe_write($1, jsonb_build_array(jsonb_build_object('k','set','p',jsonb_build_array('zoew_daily_revenue_cod_dod','2026-10-02'),'v',jsonb_build_object('codDollar','1e400'::jsonb))))", [newOp()]);
    rec('លេខលើស double (1e400) ➜ invalid_data (JS ទទួល Infinity ➜ លុយ NaN)', !!huge.error && huge.error.message === 'invalid_data', huge);
    const overlap = await as(c, A.who, 'select public.zoe_write($1, $2::jsonb)', [newOp(), JSON.stringify([
        { k: 'set', p: [HIST, 'item1', 'isCalled'], v: true }, { k: 'set', p: [HIST, 'item1'], v: item('item1') }])]);
    rec('update ដែល path ជាន់គ្នា ➜ invalid_op (ដូច SDK RTDB)', !!overlap.error && overlap.error.message === 'invalid_op', overlap);
    const casMulti = await as(c, A.who, 'select public.zoe_write($1, $2::jsonb)', [newOp(), JSON.stringify([
        { k: 'cas', p: [HIST, 'item1'], x: null, v: item('item1') }, { k: 'set', p: [REG, 'K2'], v: true }])]);
    rec('cas ជាមួយ op ផ្សេង ➜ invalid_op', !!casMulti.error && casMulti.error.message === 'invalid_op', casMulti);

    const deepSet = await write(A.who, [{ k: 'set', p: [HIST, 'item1', 'isCalled'], v: true }, { k: 'set', p: [HIST, 'item1', 'barcodes', '0', 'isClosed'], v: true }]);
    const d1 = docOf(deepSet, HIST, 'item1');
    rec('update ជ្រៅ ៖ វាលផ្សេងនៅដដែល · barcodes/0/isClosed ប្រែ', !!d1 && d1.v.isCalled === true && d1.v.barcodes['0'].isClosed === true && d1.v.phone === '012345678', d1);
    const seqItem1 = d1.s;
    const staleValue = item('item1');
    const casOld = await write(A.who, [{ k: 'cas', p: [HIST, 'item1'], x: staleValue, v: item('item1', { cod: 99 }) }]);
    rec('cas ៖ តម្លៃរំពឹងចាស់ ➜ conflict + តម្លៃបច្ចុប្បន្ន (មិនសរសេរ)', !!casOld && casOld.ok === false && casOld.conflict === true
        && casOld.value.isCalled === true && ((await read(A.who, HIST, 'item1')).docs[0].v.cod === 10), casOld);
    const casGood = await write(A.who, [{ k: 'cas', p: [HIST, 'item1'], x: d1.v, v: item('item1', { cod: 11, barcodes: [{ code: 'ZTitem1', cod: 11, dod: 2, isClosed: false }] }) }]);
    rec('cas ៖ តម្លៃរំពឹងត្រូវ (array ជា object · លេខ double) ➜ ok · seq ថ្មីធំជាង', !!casGood && casGood.ok === true && docOf(casGood, HIST, 'item1').s > seqItem1, casGood);
    const casArrayForm = await write(A.who, [{ k: 'cas', p: [HIST, 'item1', 'barcodes'], x: [{ code: 'ZTitem1', cod: 11, dod: 2, isClosed: false }],
        v: [{ code: 'ZTitem1', cod: 11, dod: 2, isClosed: true }] }]);
    rec('cas ជ្រៅ ៖ តម្លៃរំពឹងជា array (JS) ស្មើ object ដែលផ្ទុក ➜ ok', !!casArrayForm && casArrayForm.ok === true, casArrayForm);
    const casNew = await write(A.who, [{ k: 'cas', p: [HIST, 'fresh1'], x: null, v: item('fresh1') }]);
    rec('cas ៖ doc មិនទាន់មាន + x=null ➜ ok', !!casNew && casNew.ok === true, casNew);
    const casTaken = await write(A.who, [{ k: 'cas', p: [HIST, 'fresh1'], x: null, v: item('fresh1', { cod: 5 }) }]);
    rec('cas ៖ doc មានរួច + x=null ➜ conflict (ការចុះឈ្មោះស្ទួនមិនអាច)', !!casTaken && casTaken.conflict === true, casTaken);
    const casDelete = await write(A.who, [{ k: 'cas', p: [HIST, 'fresh1'], x: docOf(casNew, HIST, 'fresh1').v, v: null }]);
    rec('cas ៖ លុប (v null) ➜ ok · tombstone', !!casDelete && casDelete.ok === true && docOf(casDelete, HIST, 'fresh1').v === null, casDelete);
    const casAfterDelete = await write(A.who, [{ k: 'cas', p: [HIST, 'fresh1'], x: null, v: item('fresh1') }]);
    rec('cas ៖ លើ tombstone ជាមួយ x=null ➜ ok (tombstone = មិនមាន)', !!casAfterDelete && casAfterDelete.ok === true, casAfterDelete);
    const MONTH = 'zoew_monthly_revenue_cod_dod';
    const m0 = await write(A.who, [{ k: 'cas', p: [MONTH], x: null, v: { '2026-08': { codDollar: 1, dodDollar: 0, totalCount: 1 },
        '2026-09': { codDollar: 2, dodDollar: 0, totalCount: 1 }, '2026-10': { codDollar: 3, dodDollar: 0, totalCount: 1 } } }]);
    rec('cas លើ node ទាំងមូល (ledger ខែ ៖ runTransaction លើ root) ➜ ok · ៣ doc', !!m0 && m0.ok === true && m0.docs.filter((d) => d.r === MONTH).length === 3, m0);
    const monthsNow = { '2026-08': { codDollar: 1, dodDollar: 0, totalCount: 1 }, '2026-09': { codDollar: 2, dodDollar: 0, totalCount: 1 }, '2026-10': { codDollar: 3, dodDollar: 0, totalCount: 1 } };
    const m1 = await write(A.who, [{ k: 'cas', p: [MONTH], x: monthsNow, v: { '2026-09': monthsNow['2026-09'], '2026-10': monthsNow['2026-10'],
        '2026-11': { codDollar: 4, dodDollar: 0, totalCount: 1 } } }]);
    const monthsRead = (await read(A.who, MONTH)).docs.map((d) => d.k).sort();
    rec('cas node ៖ ខែចាស់ជាងគេលុប (tombstone) · ខែថ្មីចូល (រក្សា ៣ ខែ)', !!m1 && m1.ok === true && JSON.stringify(monthsRead) === '["2026-09","2026-10","2026-11"]', { m1, monthsRead });
    const m2 = await write(A.who, [{ k: 'cas', p: [MONTH], x: monthsNow, v: {} }]);
    rec('cas node ៖ តម្លៃរំពឹងចាស់ ➜ conflict + node បច្ចុប្បន្ន', !!m2 && m2.conflict === true && Object.keys(m2.value).sort().join() === '2026-09,2026-10,2026-11', m2);
    const m3 = await as(c, A.who, 'select public.zoe_write($1, $2::jsonb)', [newOp(), JSON.stringify([{ k: 'set', p: [MONTH], v: { '2026-12': { codDollar: -5, dodDollar: 0, totalCount: 0 } } }])]);
    rec('set node ទាំងមូល ៖ rules រត់លើកូនទាំងអស់ (ledger អវិជ្ជមាន ➜ បដិសេធ) · មិនប៉ះខែដែលមាន', !!m3.error && m3.error.message === 'permission_denied'
        && (await read(A.who, MONTH)).docs.length === 3, m3);
    const m4 = await as(c, A.who, 'select public.zoe_write($1, $2::jsonb)', [newOp(), JSON.stringify([{ k: 'set', p: [MONTH], v: 5 }])]);
    rec('set node ទាំងមូលជា scalar ➜ បដិសេធ', !!m4.error, m4);
    const m5 = await as(c, A.who, 'select public.zoe_write($1, $2::jsonb)', [newOp(), JSON.stringify([{ k: 'inc', p: [MONTH], d: 1 }])]);
    rec('inc លើ node ទាំងមូល ➜ invalid_op', !!m5.error && m5.error.message === 'invalid_op', m5);
    const m6 = await as(c, A.who, 'select public.zoe_write($1, $2::jsonb)', [newOp(), JSON.stringify([{ k: 'set', p: [MONTH], v: {} },
        { k: 'set', p: [MONTH, '2026-09', 'codDollar'], v: 1 }])]);
    rec('set node + path ក្រោមវា ➜ invalid_op (ជាន់)', !!m6.error && m6.error.message === 'invalid_op', m6);
    const regWhole = await as(c, A.who, 'select public.zoe_write($1, $2::jsonb)', [newOp(), JSON.stringify([{ k: 'set', p: [REG], v: {} }])]);
    rec('set node registry ទាំងមូល (គ្មាន .write នៅ node) ➜ បដិសេធ', !!regWhole.error && regWhole.error.message === 'permission_denied', regWhole);

    const incOp = newOp();
    const inc1 = await write(A.who, [{ k: 'inc', p: [DAILY, '2026-10-01', 'codDollar'], d: 10 }, { k: 'inc', p: [DAILY, '2026-10-01', 'dodDollar'], d: 2 },
        { k: 'inc', p: [DAILY, '2026-10-01', 'totalCount'], d: 1 }], incOp);
    const inc1Doc = docOf(inc1, DAILY, '2026-10-01');
    rec('inc លើ doc មិនទាន់មាន ➜ 0 + d', !!inc1Doc && inc1Doc.v.codDollar === 10 && inc1Doc.v.dodDollar === 2 && inc1Doc.v.totalCount === 1, inc1);
    const replay = await write(A.who, [{ k: 'inc', p: [DAILY, '2026-10-01', 'codDollar'], d: 10 }, { k: 'inc', p: [DAILY, '2026-10-01', 'dodDollar'], d: 2 },
        { k: 'inc', p: [DAILY, '2026-10-01', 'totalCount'], d: 1 }], incOp);
    const ledgerNow = (await read(A.who, DAILY, '2026-10-01')).docs[0];
    rec('op_id ដដែល (ការឆ្លើយបាត់ ➜ ផ្ញើម្តងទៀត) ➜ replayed · លុយមិនបូក ២ ដង', !!replay && replay.replayed === true && replay.ok === true
        && ledgerNow.v.codDollar === 10 && ledgerNow.v.totalCount === 1, { replay, ledgerNow });
    const longNum = await as(c, A.who, "select public.zoe_write($1, jsonb_build_array(jsonb_build_object('k', 'set', 'p', jsonb_build_array('zoew_daily_revenue_cod_dod', '2026-10-04'), "
        + "'v', '{\"codDollar\": 0.1000000000000000055511151231257827, \"dodDollar\": 0, \"totalCount\": 1}'::jsonb))) as r", [newOp()]);
    const seenByJs = (await read(A.who, DAILY, '2026-10-04')).docs[0];
    const casJs = await write(A.who, [{ k: 'cas', p: [DAILY, '2026-10-04'], x: seenByJs.v, v: Object.assign({}, seenByJs.v, { totalCount: 2 }) }]);
    rec('លេខ decimal វែងលើស double ➜ ផ្ទុកជា double (0.1) ➜ cas ដោយតម្លៃដែល JS អាន ➜ ok (មិន conflict ជារៀងរហូត)',
        !!longNum.rows && seenByJs.v.codDollar === 0.1 && !!casJs && casJs.ok === true, { longNum, seenByJs, casJs });
    const inc2 = await write(A.who, [{ k: 'inc', p: [DAILY, '2026-10-01', 'codDollar'], d: 2.5 }]);
    rec('inc ទសភាគ ➜ 12.5', docOf(inc2, DAILY, '2026-10-01').v.codDollar === 12.5, inc2);
    await admin(A.id, [{ k: 'set', p: [DAILY, '2026-10-03'], v: { codDollar: 10.1, dodDollar: 0, totalCount: 1 } }]);
    const incFloat = await write(A.who, [{ k: 'inc', p: [DAILY, '2026-10-03', 'codDollar'], d: 0.2 }]);
    rec('inc គិតជា double ដូច RTDB ៖ 10.1 + 0.2 = ' + (10.1 + 0.2) + ' (មិនមែន decimal 10.3)', docOf(incFloat, DAILY, '2026-10-03').v.codDollar === 10.1 + 0.2, incFloat);
    const incNeg = await as(c, A.who, 'select public.zoe_write($1, $2::jsonb)', [newOp(), JSON.stringify([{ k: 'inc', p: [DAILY, '2026-10-01', 'codDollar'], d: -100 }])]);
    rec('inc ដែលធ្វើឲ្យ ledger អវិជ្ជមាន ➜ rules បដិសេធ', !!incNeg.error && incNeg.error.message === 'permission_denied', incNeg);

    const p0 = await pull(A.who, 0);
    const liveKeys = p0.rows.map((r) => r.r + '/' + r.k).sort();
    rec('pull ពី 0 ➜ តែ doc រស់ (គ្មាន tombstone) · reset=true', p0.reset === true && !liveKeys.includes(HIST + '/fresh1x') && p0.rows.every((r) => r.v !== null), p0);
    const head = p0.seq;
    await write(A.who, [{ k: 'set', p: [HIST, 'item2'], v: null }]);
    const pd = await pull(A.who, head);
    rec('pull delta ពី head ➜ tombstone item2 (v null) · reset=false', pd.reset === false && pd.rows.length === 1 && pd.rows[0].k === 'item2' && pd.rows[0].v === null, pd);
    rec('pull delta ➜ cursor ឡើង', pd.seq > head, pd);
    const multi = await write(A.who, [{ k: 'set', p: [REG, 'M1'], v: true }, { k: 'set', p: [REG, 'M2'], v: true }, { k: 'set', p: [REG, 'M3'], v: true }]);
    const pg1 = await pull(A.who, pd.seq, 2);
    rec('paging limit 2 លើក្រុម seq ៣ doc ➜ មិនកាត់ក្រុម (ទទួល ៣)', pg1.rows.length === 3 && pg1.rows.every((r) => r.s === multi.seq), pg1);
    await write(A.who, [{ k: 'set', p: [REG, 'M4'], v: true }]);
    await write(A.who, [{ k: 'set', p: [REG, 'M5'], v: true }]);
    const pg2 = await pull(A.who, pd.seq, 3);
    rec('paging ៖ more=true ពេលនៅសល់', pg2.more === true && pg2.seq === multi.seq, pg2);
    const pg3 = await pull(A.who, pg2.seq, 3);
    rec('paging ៖ ទំព័របន្ទាប់ទទួល M4 · M5 · more=false', pg3.more === false && pg3.rows.map((r) => r.k).join() === 'M4,M5', pg3);
    const future1 = await pull(A.who, 999999);
    rec('cursor ធំជាង head (DB ផ្សេង) ➜ reset ពេញ', future1.reset === true, { reset: future1.reset });
    await c.query("update public.zoe_docs set updated_at = now() - interval '8 days' where value is null");
    await c.query('update public.zoe_tenant_state set seq = 63 where tenant_id = $1', [A.id]);
    const hk = await write(A.who, [{ k: 'set', p: [REG, 'HK'], v: true }]);
    const st = (await c.query('select seq, purged_seq from public.zoe_tenant_state where tenant_id = $1', [A.id])).rows[0];
    const tomb = (await c.query('select count(*)::int as n from public.zoe_docs where tenant_id = $1 and value is null', [A.id])).rows[0].n;
    rec('housekeeping (seq % 64) ៖ tombstone ចាស់ជាង ៧ ថ្ងៃលុប · purged_seq កើន', hk.seq === 64 && tomb === 0 && Number(st.purged_seq) > 0, { st, tomb, seq: hk.seq });
    const stale = await pull(A.who, 1);
    rec('cursor ចាស់ជាង purged_seq ➜ reset (client មិនបាត់ការលុប)', stale.reset === true, { reset: stale.reset, seq: stale.seq });

    const pullFull = async (who, since, limit, fullHead) => {
        const r = await as(c, who, 'select public.zoe_pull($1, $2, $3) as r', [since, limit, fullHead]);
        return r.rows ? r.rows[0].r : r;
    };
    for (let i = 0; i < 6; i++) await write(A.who, [{ k: 'set', p: [REG, 'FS' + i], v: true }]);
    const purgedNow = Number((await c.query('select purged_seq from public.zoe_tenant_state where tenant_id = $1', [A.id])).rows[0].purged_seq);
    const oneShot = await pull(A.who, 0, 5000);
    const wantKeys = oneShot.rows.map((r) => r.r + '/' + r.k).sort();
    const FS_PAGE = 2;
    const firstPage = await pull(A.who, 0, FS_PAGE);
    rec('មុនលក្ខខណ្ឌ ៖ ទាញពេញច្រើនទំព័រ · purged_seq លើសព្រំទំព័រទី ១ (ករណីដែលធ្លាប់វិលចាប់ផ្តើមម្តងទៀត)',
        wantKeys.length > FS_PAGE * 3 && firstPage.more === true && firstPage.seq < purgedNow, { n: wantKeys.length, first: firstPage.seq, purgedNow });
    const keyOf = (r) => r.r + '/' + r.k;
    const fullSync = async (deleteAfterFirst) => {
        const have = new Map();
        let since = 0;
        let fullHead = null;
        const trail = [];
        for (let page = 0; page < wantKeys.length + 4; page++) {
            const res = await pullFull(A.who, since, FS_PAGE, fullHead);
            if (!res || !Array.isArray(res.rows)) return { error: res, trail };
            trail.push({ since, seq: res.seq, reset: res.reset, head: res.head, n: res.rows.length });
            if (res.reset) { have.clear(); fullHead = typeof res.head === 'number' ? res.head : null; }
            for (const row of res.rows) {
                if (row.v === null) have.delete(keyOf(row));
                else have.set(keyOf(row), row.v);
            }
            since = res.seq;
            if (page === 0 && deleteAfterFirst) await write(A.who, [{ k: 'set', p: [res.rows[0].r, res.rows[0].k], v: null }]);
            if (!res.more) return { keys: [...have.keys()].sort(), trail, pages: page + 1 };
        }
        return { stuck: true, trail };
    };
    const fs1 = await fullSync(false);
    rec('ទាញពេញជាទំព័រ ពេល purged_seq លើសព្រំទំព័រ ➜ បញ្ចប់ (មិនវិលចាប់ផ្តើមម្តងទៀតរហូត) · ទទួល doc រស់គ្រប់ ស្មើការទាញម្តង',
        !!fs1.keys && JSON.stringify(fs1.keys) === JSON.stringify(wantKeys) && fs1.pages <= Math.ceil(wantKeys.length / FS_PAGE) + 1, fs1);
    rec('ទាញពេញជាទំព័រ ➜ reset តែទំព័រទី ១ (ទំព័របន្តមិនលុបអ្វីដែលបានទទួល)',
        !!fs1.trail && fs1.trail.length > 1 && fs1.trail[0].reset === true && fs1.trail.slice(1).every((t) => t.reset === false), fs1.trail);
    const victim = firstPage.rows[0].r + '/' + firstPage.rows[0].k;
    const fs2 = await fullSync(true);
    rec('doc នៅទំព័រទី ១ ត្រូវលុបកណ្តាលការទាញពេញ ➜ tombstone មកក្នុងទំព័របន្ត (client មិនរក្សា doc ដែលលុបហើយ)',
        !!fs2.keys && !fs2.keys.includes(victim) && JSON.stringify(fs2.keys) === JSON.stringify(wantKeys.filter((k) => k !== victim)), { victim, fs2 });
    const headNow = (await pull(A.who, 0, 1)).head;
    const badHead = await pullFull(A.who, firstPage.seq, FS_PAGE, purgedNow - 1);
    rec('p_full_head ចាស់ជាង purged_seq ➜ reset (មិនជឿការបន្តដែលអាចខកខានការលុប)', !!badHead && badHead.reset === true, badHead);
    const futureHead = await pullFull(A.who, firstPage.seq, FS_PAGE, Number(headNow) + 1000);
    rec('p_full_head ធំជាង head ➜ reset', !!futureHead && futureHead.reset === true, futureHead);
    const tenantA = await pull(A.who, 0, 2);
    const tenantB = await pull(B.who, 0, 2);
    const tenantEmpty = await pull(A.who, Number(headNow), 2);
    rec('pull ប្រាប់ tenant របស់អ្នកហៅ (cache ផ្ទៀងហាងមុនប្រើ delta) · ទំព័រទទេក៏ប្រាប់',
        tenantA.tenant === A.id && tenantB.tenant === B.id && tenantEmpty.tenant === A.id, { a: tenantA.tenant, b: tenantB.tenant, e: tenantEmpty.tenant });
    const legacy = await pull(A.who, 0, 5000);
    rec('client ចាស់ (zoe_pull ២ argument) នៅដំណើរការ', !!legacy && Array.isArray(legacy.rows) && legacy.rows.length > 0 && legacy.reset === true, legacy && legacy.seq);

    const topicA = 'zoe:' + A.id;
    const msgs = (await c.query("select topic, payload from realtime.messages where topic = $1 order by inserted_at", [topicA])).rows;
    rec('broadcast ៖ រាល់ការសរសេរដែលប្រែ ➜ សារ topic zoe:<tenant> មាន seq', msgs.length >= 5 && msgs.every((m) => typeof m.payload.seq === 'number'), msgs.length);
    const seeA = await as(c, Object.assign({ topic: topicA }, A.who), "select count(*)::int as n from realtime.messages where extension = 'broadcast'");
    rec('broadcast ៖ សមាជិក A (topic A) អាន/ចូល channel បាន', !!seeA.rows && seeA.rows[0].n >= 1, seeA);
    const seeB = await as(c, Object.assign({ topic: topicA }, B.who), "select count(*)::int as n from realtime.messages where extension = 'broadcast'");
    rec('broadcast ៖ សមាជិក B (topic A) ➜ ០ (មិនឃើញ channel ហាងផ្សេង)', !!seeB.rows && seeB.rows[0].n === 0, seeB);
    const seeAnon = await as(c, Object.assign({ topic: topicA }, ANON), "select count(*)::int as n from realtime.messages");
    rec('broadcast ៖ anon ➜ មិនឃើញ', !!seeAnon.error || (seeAnon.rows && seeAnon.rows[0].n === 0), seeAnon);

    await admin(B.id, [{ k: 'set', p: [TRASH, 'src1'], v: Object.assign(item('src1'), { deletedAt: 1790000000000, trashReason: 'delete', isFromDeletion: true,
        restoreClaim: { token: 'tokB', claimedAt: Date.now(), targetId: 'tgt1' } }) }]);
    const crossFence = await as(c, A.who, 'select public.zoe_write($1, $2::jsonb)', [newOp(), JSON.stringify([
        { k: 'set', p: [HIST, 'tgt1'], v: Object.assign(item('tgt1'), { restoreClaimId: 'src1', restoreClaimToken: 'tokB' }) }])]);
    rec('rules lookup ឆ្លង tenant ៖ claim ស្តារនៅ B មិនធ្វើឲ្យ fence របស់ A ឆ្លង', !!crossFence.error && crossFence.error.message === 'permission_denied', crossFence);
    await admin(A.id, [{ k: 'set', p: [TRASH, 'src1'], v: Object.assign(item('src1'), { deletedAt: 1790000000000, trashReason: 'delete', isFromDeletion: true,
        restoreClaim: { token: 'tokA', claimedAt: Date.now(), targetId: 'tgt1' } }) }]);
    const ownFence = await write(A.who, [{ k: 'set', p: [HIST, 'tgt1'], v: Object.assign(item('tgt1'), { restoreClaimId: 'src1', restoreClaimToken: 'tokA' }) }]);
    rec('probe ទិសផ្ទុយ ៖ claim ស្តារនៅ A ផ្ទាល់ ➜ fence ឆ្លង', !!ownFence && ownFence.ok === true, ownFence);

    const rep = await admin(A.id, [{ k: 'set', p: [REG, 'ONLY'], v: true }], true);
    const afterReplace = await pull(A.who, 0);
    rec('zoe_admin_write replace ៖ doc ចាស់ក្លាយ tombstone · នៅសល់តែ ONLY', !!rep && rep.ok && afterReplace.rows.length === 1 && afterReplace.rows[0].k === 'ONLY', afterReplace);
    rec('zoe_admin_write មិនប៉ះ B', ((await pull(B.who, 0)).rows || []).some((r) => r.k === 'src1'));

    await c.query('update public.tenants set revoked = true where id = $1', [A.id]);
    const revoked = await as(c, A.who, 'select public.zoe_write($1, $2::jsonb)', [newOp(), JSON.stringify([{ k: 'set', p: [REG, 'R1'], v: true }])]);
    rec('tenant Revoke ➜ zoe_write forbidden ភ្លាម', !!revoked.error && revoked.error.message === 'forbidden', revoked);
    const revokedPull = await as(c, A.who, 'select public.zoe_pull(0, 10)');
    rec('tenant Revoke ➜ zoe_pull forbidden', !!revokedPull.error && revokedPull.error.message === 'forbidden', revokedPull);
    const revokedRead = await as(c, A.who, 'select public.zoe_read($1, null)', [HIST]);
    rec('tenant Revoke ➜ zoe_read forbidden (មិនមែនបញ្ជីទទេដែល App អានថា «គ្មានទិន្នន័យ»)', !!revokedRead.error && revokedRead.error.message === 'forbidden', revokedRead);
    await c.query('update public.tenants set revoked = false where id = $1', [A.id]);

    const c1 = await H.connect('postgres', c.database);
    const c2 = await H.connect('postgres', c.database);
    extra.push(c1, c2);
    const headBefore = (await pull(A.who, 0)).seq;
    await c1.query('begin');
    await c1.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ role: 'authenticated', sub: A.who.sub })]);
    await c1.query('set local role authenticated');
    const first = await c1.query('select public.zoe_write($1, $2::jsonb) as r', [newOp(), JSON.stringify([{ k: 'set', p: [REG, 'C1'], v: true }])]);
    const c2pid = (await c2.query('select pg_backend_pid() as p')).rows[0].p;
    const secondP = as(c2, A.who, 'select public.zoe_write($1, $2::jsonb) as r', [newOp(), JSON.stringify([{ k: 'set', p: [REG, 'C2'], v: true }])]);
    // ⛔ រង់ចាំរហូតការសរសេរទី ២ **ជាប់ lock ពិត** (មិនមែនពេលថេរ) ៖ ពេលម៉ាស៊ីនរវល់ ការរង់ចាំ ៣០០ms ធ្វើឲ្យទី ២ ចាប់ផ្តើមក្រោយ commit
    //    ➜ គ្មានការប្រណាំង ➜ mutation «គ្មាន tenant lock» រស់រាន (វាស់បានក្នុង run-all ពេញ)
    for (let i = 0; i < 200; i++) {
        const w = await c.query("select wait_event_type from pg_stat_activity where pid = $1", [c2pid]);
        if (w.rows[0] && w.rows[0].wait_event_type === 'Lock') break;
        await new Promise((r) => setTimeout(r, 50));
    }
    const midPull = await pull(A.who, headBefore);
    await c1.query('commit');
    const second = await secondP;
    rec('ការសរសេរស្របគ្នា ៖ ទី ២ រង់ចាំ tenant lock · seq ជាប់គ្នា', first.rows[0].r.seq === headBefore + 1 && !!second.rows && second.rows[0].r.seq === headBefore + 2,
        { first: first.rows[0].r.seq, second: second.rows && second.rows[0].r.seq, headBefore });
    rec('ការទាញកណ្តាលការសរសេរដែលមិនទាន់ commit ➜ មិនឃើញ · cursor មិនឡើងហួស', midPull.rows.length === 0 && midPull.seq === headBefore, midPull);
    const afterBoth = await pull(A.who, headBefore);
    rec('ការទាញក្រោយ commit ➜ ឃើញ C1 និង C2 តាមលំដាប់ seq', afterBoth.rows.map((r) => r.k).join() === 'C1,C2', afterBoth);
    // ⛔ ចន្លោះដែលការប្រណាំងខាងលើមិនឃើញ ៖ ទី ១ **កាន់ lock តែមិនទាន់ update** seq ➜ ទី ២ ត្រូវរង់ចាំមុនអាន seq
    //    (បើអត់ `for update` ទី ២ អាន seq ចាស់ ➜ seq ស្ទួន · ការទាញ delta រំលងការសរសេរ) — វាស់ដោយ lock ពិតពី session ទី ៣
    const c3 = await H.connect('postgres', c.database);
    const c4 = await H.connect('postgres', c.database);
    extra.push(c3, c4);
    const lockBefore = (await pull(A.who, 0)).seq;
    await c3.query('begin');
    await c3.query('select seq from public.zoe_tenant_state where tenant_id = $1 for update', [A.id]);
    const c4pid = (await c4.query('select pg_backend_pid() as p')).rows[0].p;
    const lateP = as(c4, A.who, 'select public.zoe_write($1, $2::jsonb) as r', [newOp(), JSON.stringify([{ k: 'set', p: [REG, 'L2'], v: true }])]);
    let lateWaited = false;
    for (let i = 0; i < 200 && !lateWaited; i++) {
        const w = await c.query('select wait_event_type from pg_stat_activity where pid = $1', [c4pid]);
        lateWaited = !!w.rows[0] && w.rows[0].wait_event_type === 'Lock';
        if (!lateWaited) await new Promise((r) => setTimeout(r, 50));
    }
    await c3.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ role: 'authenticated', sub: A.who.sub })]);
    await c3.query('set local role authenticated');
    const early = await c3.query('select public.zoe_write($1, $2::jsonb) as r', [newOp(), JSON.stringify([{ k: 'set', p: [REG, 'L1'], v: true }])]);
    await c3.query('commit');
    const late = await lateP;
    rec('tenant lock ៖ ការសរសេរដែលចាប់ផ្តើមខណៈ lock ត្រូវរង់ចាំមុនអាន seq ➜ seq មិនស្ទួន', lateWaited && early.rows[0].r.seq === lockBefore + 1
        && !!late.rows && late.rows[0].r.seq === lockBefore + 2, { lateWaited, early: early.rows[0].r.seq, late: late.rows ? late.rows[0].r.seq : late.error, lockBefore });
    const bothCas = await Promise.all([
        as(c1, A.who, 'select public.zoe_write($1, $2::jsonb) as r', [newOp(), JSON.stringify([{ k: 'cas', p: [REG, 'RACE'], e: 0, v: true }])]),
        as(c2, A.who, 'select public.zoe_write($1, $2::jsonb) as r', [newOp(), JSON.stringify([{ k: 'cas', p: [REG, 'RACE'], e: 0, v: true }])])
    ]);
    const okCount = bothCas.filter((r) => r.rows && r.rows[0].r.ok === true).length;
    const conflicts = bothCas.filter((r) => r.rows && r.rows[0].r.conflict === true).length;
    rec('cas ប្រណាំង ២ ការតភ្ជាប់លើ barcode ដដែល ➜ ជោគជ័យ ១ · conflict ១ (registry ស្ទួនមិនអាច)', okCount === 1 && conflicts === 1, bothCas.map((r) => r.rows ? r.rows[0].r : r.error));

    // ⛔ ទំហំក្នុងហាង (`zoe_tenant_state.bytes` = ឯកសារ + tombstone + zoe_ops) ៖ ពិដាន `quota_bytes` ការពារហាងមួយមិនឲ្យបំពេញ Project ទាំងមូល
    //    (ហាងទាំងអស់ចែក Postgres តែមួយ) — ការសរសេរដែលធ្វើឲ្យធំលើសពិដានត្រូវបដិសេធ · ការសរសេរដែលបង្រួម (សម្អាត) នៅឆ្លងបាន · Admin មិនជាប់ពិដាន
    const PICK = 'zoew_daily_pickup_cod_dod';
    const usage = async (tid) => {
        const r = (await c.query(`select s.bytes::text as bytes, (coalesce((select sum(private.zoe_doc_bytes(z.root, z.key, z.value)) from public.zoe_docs z where z.tenant_id = s.tenant_id), 0)
            + coalesce((select sum(private.zoe_op_bytes(o.op_id, o.result)) from public.zoe_ops o where o.tenant_id = s.tenant_id), 0))::text as real
            from public.zoe_tenant_state s where s.tenant_id = $1`, [tid])).rows[0];
        return { bytes: Number(r.bytes), real: Number(r.real) };
    };
    const uA = await usage(A.id);
    const uB = await usage(B.id);
    rec('bytes ក្នុងហាង = ផលបូកពិត (ឯកសារ · tombstone · ops) ក្រោយ set · cas · replace · ការសរសេរស្របគ្នា (A · B)', uA.real > 0 && uA.bytes === uA.real && uB.bytes === uB.real, { uA, uB });
    const pickDoc = { packagesPickedUp: 20, pickedUpBarcodes: {} };
    for (let i = 0; i < 20; i++) pickDoc.pickedUpBarcodes['QZ' + String(i).padStart(12, '0')] = '012000' + String(100 + i);
    const pickW = await write(A.who, [{ k: 'set', p: [PICK, '2026-10-09'], v: pickDoc }]);
    const uPick = await usage(A.id);
    await c.query('update public.zoe_tenant_state set quota_bytes = $2 where tenant_id = $1', [A.id, uPick.real + 4000]);
    const regMany = [];
    for (let i = 0; i < 60; i++) regMany.push({ k: 'set', p: [REG, 'QUOTA' + String(i).padStart(8, '0')], v: true });
    const overQuota = await as(c, A.who, 'select public.zoe_write($1, $2::jsonb) as r', [newOp(), JSON.stringify(regMany)]);
    rec('⛔ quota ៖ ការសរសេរដែលធ្វើឲ្យហាងធំលើស quota_bytes ➜ quota_exceeded (គ្មានអ្វីផ្ទុក)', !!pickW && pickW.ok === true && !!overQuota.error
        && overQuota.error.message === 'quota_exceeded' && (await usage(A.id)).bytes === uPick.real, overQuota);
    const underQuota = await write(A.who, [{ k: 'set', p: [REG, 'QUOTA_ONE'], v: true }]);
    rec('ទិសផ្ទុយ ៖ ការសរសេរតូចក្រោម quota ➜ ok', !!underQuota && underQuota.ok === true, underQuota);
    await c.query('update public.zoe_tenant_state set quota_bytes = 1 where tenant_id = $1', [A.id]);
    const growOver = await as(c, A.who, 'select public.zoe_write($1, $2::jsonb) as r', [newOp(), JSON.stringify([{ k: 'set', p: [REG, 'QUOTA_TWO'], v: true }])]);
    const shrinkOver = await write(A.who, [{ k: 'set', p: [PICK, '2026-10-09'], v: null }]);
    rec('⛔ លើស quota ៖ ការសរសេរដែលធំឡើង ➜ quota_exceeded · ការលុប (បង្រួមលើសទំហំ op) ➜ ok (ហាងសម្អាតខ្លួនឯងបាន)',
        !!growOver.error && growOver.error.message === 'quota_exceeded' && !!shrinkOver && shrinkOver.ok === true, { growOver, shrinkOver });
    const adminOver = await admin(A.id, [{ k: 'set', p: [REG, 'QUOTA_ADMIN'], v: true }]);
    rec('Admin (zoe_admin_write · ការផ្លាស់ទិន្នន័យ) មិនជាប់ quota', !!adminOver && adminOver.ok === true, adminOver);
    await c.query('update public.zoe_tenant_state set quota_bytes = default where tenant_id = $1', [A.id]);
    const uQuota = await usage(A.id);
    rec('bytes = ផលបូកពិត ក្រោយការបដិសេធ quota · ការលុប (tombstone) · Admin', uQuota.bytes === uQuota.real, uQuota);
    await c.query("update public.zoe_docs set updated_at = now() - interval '8 days' where tenant_id = $1 and value is null", [A.id]);
    await c.query("update public.zoe_ops set created_at = now() - interval '3 days' where tenant_id = $1", [A.id]);
    await c.query('select private.zoe_housekeeping($1)', [A.id]);
    const uHouse = await usage(A.id);
    rec('housekeeping (tombstone ៧ ថ្ងៃ · ops ២ ថ្ងៃ) ដកចេញពី bytes ➜ bytes = ផលបូកពិត · តូចជាងមុន', uHouse.bytes === uHouse.real && uHouse.real < uQuota.real, { uHouse, uQuota });
}

async function quotaCleanupCases(c, rec, extra) {
    const REG = 'zoew_barcode_registry';
    const RESERVE = 1048576;
    let serial = 0;
    const state = async (tid) => (await c.query(`select s.seq::text, s.bytes::text, s.quota_bytes::text, s.purged_seq::text,
        (select count(*)::integer from public.zoe_ops o where o.tenant_id = s.tenant_id) as ops,
        ((select coalesce(sum(private.zoe_doc_bytes(z.root, z.key, z.value)), 0) from public.zoe_docs z where z.tenant_id = s.tenant_id)
        + (select coalesce(sum(private.zoe_op_bytes(o.op_id, o.result)), 0) from public.zoe_ops o where o.tenant_id = s.tenant_id))::text as real
        from public.zoe_tenant_state s where s.tenant_id = $1`, [tid])).rows[0];
    const create = async (seedOps = [{ k: 'set', p: [REG, 'ABC'], v: true }]) => {
        const n = ++serial;
        const uid = await H.makeAuthUser(c, 'quota' + n + '@u.zoe.test');
        const tid = (await c.query("insert into public.tenants (name, branch_code, expires_at) values ($1, $1, now() + interval '1 day') returning id", ['quota' + n])).rows[0].id;
        await c.query('insert into public.tenant_members (user_id, tenant_id, username) values ($1, $2, $3)', [uid, tid, 'quota' + n]);
        const who = { role: 'authenticated', sub: uid };
        const write = (id, ops, client = c) => as(client, who, 'select public.zoe_write($1, $2::jsonb) as r', [id, JSON.stringify(ops)]);
        const seed = await write('seed_quota_000001', seedOps);
        rec('quota ៖ រៀបចំ registry ពិត ' + n, !!seed.rows && seed.rows[0].r.ok === true, seed);
        await c.query('update public.zoe_tenant_state set quota_bytes = bytes where tenant_id = $1', [tid]);
        return { tid, who, write };
    };
    const remove = [{ k: 'set', p: [REG, 'ABC'], v: null }];
    const atCeiling = async (tenant, extraByte) => {
        const delta = Number((await c.query(`select private.zoe_op_bytes('delete_quota_001', jsonb_build_object('ok', true, 'seq', 2,
            'docs', jsonb_build_array(jsonb_build_object('r', $1::text, 'k', 'ABC', 's', 2)))) - 4 as n`, [REG])).rows[0].n);
        const before = await state(tenant.tid);
        const desired = Number(before.quota_bytes) + RESERVE - delta + extraByte;
        const overhead = Number((await c.query("select private.zoe_op_bytes('filler_quota_001', to_jsonb(''::text)) as n")).rows[0].n);
        await c.query("insert into public.zoe_ops (tenant_id, op_id, result) values ($1, 'filler_quota_001', to_jsonb(repeat('x', $2::integer)))", [tenant.tid, desired - Number(before.bytes) - overhead]);
        await c.query('update public.zoe_tenant_state set bytes = $2 where tenant_id = $1', [tenant.tid, desired]);
        rec('quota ៖ ព្រំដែនទំហំ fixture ត្រូវគ្នា', (await state(tenant.tid)).real === String(desired));
    };
    const A = await create(), B = await create();
    const untouched = await state(B.tid);
    const before = await state(A.tid);
    rec('quota ៖ មុនលុប bytes ពេញពិត · receipt ថ្មី', before.bytes === before.real && before.bytes === before.quota_bytes && before.ops === 1, before);
    const deleted = await A.write('delete_quota_001', remove);
    const after = await state(A.tid);
    rec('quota ពេញ ៖ លុប true តូច ➜ tombstone និង receipt ដោយប្រើ reserve មានពិដាន', !!deleted.rows && deleted.rows[0].r.ok === true
        && Number(after.bytes) > Number(after.quota_bytes) && Number(after.bytes) <= Number(after.quota_bytes) + RESERVE && after.bytes === after.real, { deleted, after });
    const replay = await A.write('delete_quota_001', [{ k: 'set', p: [REG, 'ABC'], v: true }]);
    rec('quota reserve ៖ replay op_id ដដែលមិនសរសេរឡើងវិញ · seq/bytes/receipt ដដែល', !!replay.rows && replay.rows[0].r.replayed === true
        && JSON.stringify(await state(A.tid)) === JSON.stringify(after), replay);
    for (const [name, ops] of [['noop', remove], ['recreate', [{ k: 'set', p: [REG, 'ABC'], v: true }]], ['new', [{ k: 'set', p: [REG, 'NEW'], v: true }]]]) {
        const deniedWrite = await A.write(('quota_' + name).padEnd(16, '_'), ops);
        rec('quota reserve ៖ ' + name + ' មិនអាចប្រើ reserve', !!deniedWrite.error && deniedWrite.error.message === 'quota_exceeded'
            && JSON.stringify(await state(A.tid)) === JSON.stringify(after), deniedWrite);
    }
    const mixedDocsBefore = (await c.query('select root, key, value, seq from public.zoe_docs where tenant_id = $1 order by root, key', [B.tid])).rows;
    const mixed = await B.write('mixed_quota_0001', [...remove, { k: 'set', p: [REG, 'AAA'], v: true }]);
    rec('quota reserve ៖ លុបលាយការបង្កើតថ្មីមិនអាចខ្ចី reserve · rollback', !!mixed.error && mixed.error.message === 'quota_exceeded'
        && JSON.stringify(await state(B.tid)) === JSON.stringify(untouched)
        && JSON.stringify((await c.query('select root, key, value, seq from public.zoe_docs where tenant_id = $1 order by root, key', [B.tid])).rows) === JSON.stringify(mixedDocsBefore), mixed);
    const C = await create();
    await atCeiling(C, 0);
    const edge = await C.write('delete_quota_001', remove);
    const edgeState = await state(C.tid);
    rec('quota reserve ៖ ទំហំចុងក្រោយស្មើ quota + 1 MiB ➜ ឆ្លង', !!edge.rows && edge.rows[0].r.ok === true
        && Number(edgeState.bytes) === Number(edgeState.quota_bytes) + RESERVE && edgeState.bytes === edgeState.real, { edge, edgeState });
    const D = await create();
    await atCeiling(D, 1);
    const full = await state(D.tid);
    const exhausted = await D.write('delete_quota_001', remove);
    rec('quota reserve ៖ លើសពិដាន 1 byte ➜ បដិសេធ · bytes/seq/ops មិនប្រែ', !!exhausted.error && exhausted.error.message === 'quota_exceeded'
        && JSON.stringify(await state(D.tid)) === JSON.stringify(full), exhausted);
    await c.query('begin');
    let boundaryError;
    try {
        await c.query("update public.zoe_ops set created_at = now() - interval '2 days' where tenant_id = $1 and op_id = 'filler_quota_001'", [D.tid]);
        await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(D.who)]);
        await c.query('set local role authenticated');
        await c.query('select public.zoe_write($1, $2::jsonb)', ['delete_quota_001', JSON.stringify(remove)]);
    } catch (e) { boundaryError = e; }
    finally { await c.query('rollback'); }
    rec('quota reserve ៖ receipt ស្មើ ២ ថ្ងៃមិនត្រូវបានសម្អាតមុនកាលកំណត់', !!boundaryError && boundaryError.message === 'quota_exceeded'
        && JSON.stringify(await state(D.tid)) === JSON.stringify(full), boundaryError && boundaryError.message);
    await c.query("update public.zoe_ops set created_at = now() - interval '3 days' where tenant_id = $1 and op_id = 'filler_quota_001'", [D.tid]);
    const reclaimed = await D.write('delete_quota_001', remove);
    const reclaimedState = await state(D.tid);
    rec('quota reserve ៖ receipt ផុត ២ ថ្ងៃសម្អាតមុនបដិសេធ ➜ លុបបាន · receipt ថ្មីនៅ', !!reclaimed.rows && reclaimed.rows[0].r.ok === true
        && reclaimedState.ops === 2 && reclaimedState.bytes === reclaimedState.real && Number(reclaimedState.bytes) < Number(full.bytes), { reclaimed, reclaimedState });
    rec('quota reserve ៖ tenant ផ្សេងមិនប្រែដោយការលុប/សម្អាត', JSON.stringify(await state(B.tid)) === JSON.stringify(untouched));
    const E = await create();
    const c1 = await H.connect('postgres', c.database), c2 = await H.connect('postgres', c.database);
    extra.push(c1, c2);
    const concurrent = await Promise.all([E.write('delete_quota_001', remove, c1), E.write('delete_quota_001', remove, c2)]);
    const concurrentState = await state(E.tid);
    rec('quota reserve ៖ លុប op_id ដដែលស្របគ្នា ➜ អនុវត្តម្តង · replay ម្តង · accounting ត្រឹមត្រូវ', concurrent.every((r) => !!r.rows && r.rows[0].r.ok === true)
        && concurrent.filter((r) => r.rows && r.rows[0].r.replayed === true).length === 1 && concurrentState.seq === '2'
        && concurrentState.ops === 2 && concurrentState.bytes === concurrentState.real, concurrent);
    const PICK = 'zoew_daily_pickup_cod_dod';
    const F = await create([{ k: 'set', p: [PICK, 'day'], v: { packagesPickedUp: 1, pickedUpBarcodes: { A: '1', B: '2' } } }]);
    const partialBefore = await state(F.tid);
    const partial = await F.write('partial_quota_01', [{ k: 'set', p: [PICK, 'day', 'pickedUpBarcodes', 'A'], v: null }]);
    rec('quota reserve ៖ លុបកូនខ្លះតែឯកសារនៅរស់មិនអាចខ្ចី reserve', !!partial.error && partial.error.message === 'quota_exceeded'
        && JSON.stringify(await state(F.tid)) === JSON.stringify(partialBefore), partial);
    const G = await create([{ k: 'set', p: [PICK, 'day'], v: { packagesPickedUp: 0 } }]);
    const last = await G.write('lastkey_quota_01', [{ k: 'set', p: [PICK, 'day', 'packagesPickedUp'], v: null }]);
    rec('quota reserve ៖ លុបកូនចុងក្រោយដែលធ្វើឯកសារ null ➜ ឆ្លង', !!last.rows && last.rows[0].r.ok === true
        && last.rows[0].r.docs.some((d) => d.v === null), last);
    const makeTombstone = async (tenant, root = REG) => {
        await c.query("select set_config('zoe.raw_docs', 'on', false)");
        try {
            await c.query("insert into public.zoe_docs (tenant_id, root, key, value, seq, updated_at) values ($1, $2, 'OLD', null, 1, now() - interval '8 days')", [tenant.tid, root]);
        } finally {
            await c.query("select set_config('zoe.raw_docs', 'off', false)");
        }
        await c.query("update public.zoe_tenant_state set bytes = bytes + private.zoe_doc_bytes($2, 'OLD', null), quota_bytes = bytes + private.zoe_doc_bytes($2, 'OLD', null) where tenant_id = $1", [tenant.tid, root]);
    };
    const MONTH = 'zoew_monthly_revenue_cod_dod';
    const I = await create([{ k: 'set', p: [MONTH, 'ABC'], v: { totalCount: 1 } }, { k: 'set', p: [MONTH, 'DEF'], v: { totalCount: 2 } }]);
    await makeTombstone(I, MONTH);
    const rootDelete = await I.write('rootdel_quota_01', [{ k: 'set', p: [MONTH], v: null }]);
    const rootState = await state(I.tid);
    rec('quota reserve ៖ លុប root មាន live ២ និង tombstone ចាស់ ➜ live បាត់ · purge មាន seq · accounting ត្រឹមត្រូវ', !!rootDelete.rows
        && rootDelete.rows[0].r.ok === true && rootState.bytes === rootState.real && rootState.purged_seq === '1'
        && (await c.query('select count(*)::integer as n from public.zoe_docs where tenant_id = $1 and value is not null', [I.tid])).rows[0].n === 0, { rootDelete, rootState });
    const J = await create([{ k: 'set', p: [REG, 'ABC'], v: true }, { k: 'set', p: [REG, 'DEF'], v: true }]);
    await atCeiling(J, 0);
    const competitors = await Promise.all([J.write('delete_quota_001', remove, c1), J.write('other_quota_0001', [{ k: 'set', p: [REG, 'DEF'], v: null }], c2)]);
    const competingState = await state(J.tid);
    rec('quota reserve ៖ op_id ខុសគ្នាប្រណាំងទំហំសល់សម្រាប់លុបតែមួយ ➜ ឆ្លងមួយ · បដិសេធមួយ · មិនលើសពិដាន', competitors.filter((r) => r.rows && r.rows[0].r.ok === true).length === 1
        && competitors.filter((r) => r.error && r.error.message === 'quota_exceeded').length === 1 && competingState.seq === '2'
        && competingState.bytes === competingState.real && Number(competingState.bytes) === Number(competingState.quota_bytes) + RESERVE, { competitors, competingState });
    const K = await create();
    await makeTombstone(K);
    await c.query('update public.zoe_tenant_state set quota_bytes = bytes + 16 where tenant_id = $1', [K.tid]);
    await c.query("update public.zoe_ops set created_at = now() - interval '3 days' where tenant_id = $1", [K.tid]);
    const resurrection = await K.write('restore_quota_01', [{ k: 'set', p: [REG, 'OLD'], v: true }]);
    const restoredState = await state(K.tid);
    rec('quota ៖ សរសេរលើ tombstone ចាស់ខណៈ GC ➜ មិនដក bytes ពីរដង · live ថ្មីនៅ', !!resurrection.rows && resurrection.rows[0].r.ok === true
        && restoredState.bytes === restoredState.real && Number(restoredState.bytes) <= Number(restoredState.quota_bytes)
        && (await c.query("select value from public.zoe_docs where tenant_id = $1 and root = $2 and key = 'OLD'", [K.tid, REG])).rows[0].value === true, { resurrection, restoredState });
}

async function externalEditCases(c, rec) {
    const REG = 'zoew_barcode_registry';
    const uid = await H.makeAuthUser(c, 'console@u.zoe.test');
    const tid = (await c.query("insert into public.tenants (name, branch_code, expires_at) values ('console', 'console', now() + interval '1 day') returning id")).rows[0].id;
    await c.query('insert into public.tenant_members (user_id, tenant_id, username) values ($1, $2, $3)', [uid, tid, 'console']);
    const who = { role: 'authenticated', sub: uid };
    let serial = 0;
    const write = async (ops) => {
        const r = await as(c, who, 'select public.zoe_write($1, $2::jsonb) as r', ['console_op_' + String(++serial).padStart(8, '0'), JSON.stringify(ops)]);
        return r.rows ? r.rows[0].r : r;
    };
    const pull = async (since) => {
        const r = await as(c, who, 'select public.zoe_pull($1, 2000) as r', [since]);
        return r.rows ? r.rows[0].r : r;
    };
    const state = async () => {
        const r = (await c.query(`select s.seq::text as seq, s.bytes::text as bytes, s.purged_seq::text as purged,
            ((select coalesce(sum(private.zoe_doc_bytes(z.root, z.key, z.value)), 0) from public.zoe_docs z where z.tenant_id = s.tenant_id)
            + (select coalesce(sum(private.zoe_op_bytes(o.op_id, o.result)), 0) from public.zoe_ops o where o.tenant_id = s.tenant_id))::text as real
            from public.zoe_tenant_state s where s.tenant_id = $1`, [tid])).rows[0];
        return { seq: Number(r.seq), bytes: Number(r.bytes), real: Number(r.real), purged: Number(r.purged) };
    };
    const row = async (key) => (await c.query(`select value, seq::text as seq, (updated_at < now() - interval '7 days') as aged
        from public.zoe_docs where tenant_id = $1 and root = $2 and key = $3`, [tid, REG, key])).rows[0] || null;
    const pulled = (p, key) => (p && Array.isArray(p.rows) ? p.rows : []).find((x) => x.r === REG && x.k === key);

    const seed = await write([{ k: 'set', p: [REG, 'C1'], v: true }, { k: 'set', p: [REG, 'C2'], v: true }, { k: 'set', p: [REG, 'C3'], v: true }]);
    const s0 = await state();
    rec('Table Editor ៖ រៀបចំឯកសារ ៣ តាម zoe_write', !!seed && seed.ok === true && s0.bytes === s0.real, { seed, s0 });
    const marker = (await c.query("select current_setting('zoe.internal_write', true) as v")).rows[0].v;
    rec('zoe_write បញ្ចប់ ➜ marker ខាងក្នុងមិននៅលើ connection', marker !== 'on', marker);
    const markerAfter = async (ops, id = 'console_marker_001') => {
        await c.query('begin');
        try {
            await c.query("select set_config('request.jwt.claims', $1, true), set_config('zoe.internal_write', 'outside', true)",
                [JSON.stringify({ role: 'authenticated', sub: uid })]);
            await c.query('set local role authenticated');
            const out = (await c.query('select public.zoe_write($1, $2::jsonb) as r', [id, JSON.stringify(ops)])).rows[0].r;
            const value = (await c.query("select current_setting('zoe.internal_write', true) as v")).rows[0].v;
            return { out, value };
        } finally {
            await c.query('rollback');
        }
    };
    const successOrigin = await markerAfter([{ k: 'set', p: [REG, 'C8'], v: true }]);
    const replayOrigin = await markerAfter([{ k: 'set', p: [REG, 'C8'], v: true }], 'console_op_00000001');
    const conflictOrigin = await markerAfter([{ k: 'cas', p: [REG, 'C2'], x: false, v: true }]);
    const rootConflictOrigin = await markerAfter([{ k: 'cas', p: [REG], x: null, v: {} }]);
    rec('zoe_apply ៖ success · replay · CAS conflict កូន/root ➜ marker ដើមនៅក្នុង transaction ដដែល',
        successOrigin.out.ok && replayOrigin.out.replayed && conflictOrigin.out.conflict && rootConflictOrigin.out.conflict
        && [successOrigin, replayOrigin, conflictOrigin, rootConflictOrigin].every((x) => x.value === 'outside'),
        { successOrigin, replayOrigin, conflictOrigin, rootConflictOrigin });
    const restored = await c.query(`do $$ begin
        perform set_config('zoe.internal_write', 'off', true);
        begin
            perform private.zoe_apply(null, 'console_error_0001', '[{"k":"set","p":["zoew_barcode_registry","ERR"],"v":true}]'::jsonb, true, false);
        exception when insufficient_privilege then null;
        end;
        if current_setting('zoe.internal_write', true) <> 'off' then raise exception 'marker leaked'; end if;
    end $$`).then(() => true, () => false);
    rec('zoe_apply បរាជ័យក្នុង savepoint ➜ marker ត្រឡប់តម្លៃមុនហៅ', restored);

    await c.query('delete from public.zoe_docs where tenant_id = $1 and root = $2 and key = $3', [tid, REG, 'C1']);
    const s1 = await state();
    const del = await row('C1');
    const pDel = await pull(s0.seq);
    rec('Table Editor លុបជួរ ➜ tombstone seq ថ្មី ➜ ឧបករណ៍ទាញឃើញការលុប · bytes ពិត',
        !!del && del.value === null && Number(del.seq) === s0.seq + 1 && s1.seq === s0.seq + 1 && s1.bytes === s1.real
        && !!pulled(pDel, 'C1') && pulled(pDel, 'C1').v === null && pDel.seq === s1.seq, { del, s0, s1, pDel });

    await c.query("update public.zoe_docs set value = '\"edited\"'::jsonb where tenant_id = $1 and root = $2 and key = $3", [tid, REG, 'C2']);
    const s2 = await state();
    const edited = await row('C2');
    const pEdit = await pull(s1.seq);
    rec('Table Editor កែតម្លៃ ➜ seq ថ្មី ➜ ឧបករណ៍ទាញឃើញ · bytes ពិត',
        !!edited && edited.value === 'edited' && Number(edited.seq) === s1.seq + 1 && s2.seq === s1.seq + 1 && s2.bytes === s2.real
        && !!pulled(pEdit, 'C2') && pulled(pEdit, 'C2').v === 'edited', { edited, s1, s2, pEdit });

    await c.query("update public.zoe_docs set updated_at = now() - interval '8 days' where tenant_id = $1 and root = $2 and key = $3", [tid, REG, 'C1']);
    const s3 = await state();
    const aged = await row('C1');
    rec('Table Editor ប្តូរតែ updated_at (អាយុ tombstone) ➜ seq ឯកសារ និង seq ហាងមិនប្រែ',
        !!aged && aged.aged === true && Number(aged.seq) === Number(del.seq) && s3.seq === s2.seq, { aged, s2, s3 });

    await c.query("insert into public.zoe_docs (tenant_id, root, key, value, seq) values ($1, $2, 'C4', 'true', 1)", [tid, REG]);
    const s4 = await state();
    const inserted = await row('C4');
    const pIns = await pull(s3.seq);
    rec('Table Editor បន្ថែមជួរ (seq ណាក៏ដោយ) ➜ seq ថ្មី ➜ ឧបករណ៍ទាញឃើញ · bytes ពិត',
        !!inserted && Number(inserted.seq) === s3.seq + 1 && s4.seq === s3.seq + 1 && s4.bytes === s4.real && !!pulled(pIns, 'C4'), { inserted, s3, s4 });

    const after = await write([{ k: 'set', p: [REG, 'C5'], v: true }]);
    const s5 = await state();
    const c5 = await row('C5');
    rec('zoe_write ក្រោយការកែក្នុង Table Editor ៖ seq បន្តម្តង ១ · bytes ពិត (trigger មិនប៉ះការសរសេរខាងក្នុង)',
        !!after && after.ok === true && after.seq === s4.seq + 1 && s5.seq === s4.seq + 1 && !!c5 && Number(c5.seq) === s5.seq && s5.bytes === s5.real, { after, s4, s5 });

    const moved = await c.query("update public.zoe_docs set key = 'C9' where tenant_id = $1 and root = $2 and key = 'C3'", [tid, REG]).then(() => null, (e) => e);
    rec('Table Editor ប្តូរ root/key ➜ បដិសេធ (22023) · ជួរមិនប្រែ', !!moved && moved.code === '22023' && !!(await row('C3')) && !(await row('C9')), moved && moved.message);

    await c.query('begin');
    await c.query("select set_config('zoe.raw_docs', 'on', true)");
    await c.query("insert into public.zoe_docs (tenant_id, root, key, value, seq, updated_at) values ($1, $2, 'RAW', null, 1, now() - interval '8 days')", [tid, REG]);
    const raw = await row('RAW');
    await c.query('delete from public.zoe_docs where tenant_id = $1 and root = $2 and key = $3', [tid, REG, 'RAW']);
    await c.query('commit');
    const s6 = await state();
    rec('zoe.raw_docs = on (fixture · ការជួសជុល) ៖ ជួររក្សា seq និង updated_at · seq ហាងមិនប្រែ',
        !!raw && Number(raw.seq) === 1 && raw.aged === true && s6.seq === s5.seq && !(await row('RAW')), { raw, s5, s6 });

    await c.query('select private.zoe_housekeeping($1)', [tid]);
    const s7 = await state();
    rec('housekeeping លុប tombstone ចាស់ពី Table Editor ៖ ជួរបាត់ · purged_seq · bytes ពិត',
        !(await row('C1')) && s7.purged >= Number(del.seq) && s7.bytes === s7.real, s7);

    await c.query("insert into public.zoe_docs (tenant_id, root, key, value, seq) values ($1, $2, 'C6', 'true', $3)", [tid, REG, s7.seq + 1]);
    const s8 = await state();
    const pNext = await pull(s7.seq);
    rec('Table Editor បន្ថែម seq = head + 1 ➜ seq ហាងឡើង · bytes ពិត · cursor មិនលើស head',
        s8.seq === s7.seq + 1 && s8.bytes === s8.real && pNext.seq === s8.seq && pNext.head === s8.seq
        && !!pulled(pNext, 'C6'), { s7, s8, pNext });

    const renamed = await c.query("update public.zoe_docs set key = 'C7', seq = $3 where tenant_id = $1 and root = $2 and key = 'C6'",
        [tid, REG, s8.seq + 1]).then(() => null, (e) => e);
    rec('Table Editor ប្តូរ key + seq = head + 1 ➜ បដិសេធ · មិនបាត់អត្តសញ្ញាណឯកសារ',
        !!renamed && renamed.code === '22023' && !!(await row('C6')) && !(await row('C7')), renamed && renamed.message);

    await c.query("update public.zoe_docs set value = '\"next-seq-edit\"'::jsonb, seq = $3 where tenant_id = $1 and root = $2 and key = 'C2'",
        [tid, REG, s8.seq + 1]);
    const s9 = await state();
    const pChanged = await pull(s8.seq);
    rec('Table Editor កែតម្លៃ + seq = head + 1 ➜ seq ហាងឡើង · bytes ពិត · delta ឃើញតម្លៃថ្មី',
        s9.seq === s8.seq + 1 && s9.bytes === s9.real && !!pulled(pChanged, 'C2') && pulled(pChanged, 'C2').v === 'next-seq-edit',
        { s8, s9, pChanged });

    for (const action of ['do nothing', "do update set value = 'false'::jsonb"]) {
        await c.query('begin');
        try {
            await c.query("insert into public.zoe_docs (tenant_id, root, key, value, seq) values ($1, $2, 'C2', 'true', 1) on conflict (tenant_id, root, key) " + action, [tid, REG]);
            const afterConflict = await state();
            rec('Table Editor INSERT ON CONFLICT ' + action + ' ➜ គិតតែការប្រែដែលកើតពិត · bytes ត្រឹមត្រូវ',
                afterConflict.bytes === afterConflict.real && afterConflict.seq === s9.seq + (action === 'do nothing' ? 0 : 1),
                { before: s9, after: afterConflict });
        } finally {
            await c.query('rollback');
        }
    }

    const insertA = await H.connect('postgres', c.database);
    const insertB = await H.connect('postgres', c.database);
    let duplicate;
    try {
        const beforeConcurrent = await state();
        await insertA.query('begin');
        await insertA.query("insert into public.zoe_docs (tenant_id, root, key, value, seq) values ($1, $2, 'CONCURRENT', 'true', 1)", [tid, REG]);
        const secondPid = (await insertB.query('select pg_backend_pid() as pid')).rows[0].pid;
        await insertB.query("set statement_timeout = '15s'");
        duplicate = insertB.query("insert into public.zoe_docs (tenant_id, root, key, value, seq) values ($1, $2, 'CONCURRENT', 'true', 1) on conflict (tenant_id, root, key) do nothing", [tid, REG]);
        let waited = false;
        for (let i = 0; i < 200 && !waited; i++) {
            const w = await c.query('select wait_event_type from pg_stat_activity where pid = $1', [secondPid]);
            waited = w.rows[0] && w.rows[0].wait_event_type === 'Lock';
            if (!waited) await new Promise((r) => setTimeout(r, 25));
        }
        await insertA.query('commit');
        await duplicate;
        const afterConcurrent = await state();
        rec('INSERT ស្ទួនពី connection ២ ៖ រង់ចាំ lock ពិត ➜ seq ម្តង · bytes ម្តង · barcode មួយ',
            waited && afterConcurrent.seq === beforeConcurrent.seq + 1 && afterConcurrent.bytes === afterConcurrent.real
            && (await row('CONCURRENT')).value === true, { waited, beforeConcurrent, afterConcurrent });
    } finally {
        await insertA.query('rollback').catch(() => {});
        if (duplicate) await duplicate.catch(() => {});
        await insertA.end();
        await insertB.end();
    }

    await c.query('delete from auth.users where id = $1', [uid]);
    const cascade = await c.query('delete from public.tenants where id = $1', [tid]).then(() => null, (e) => e);
    const left = (await c.query('select count(*)::int as n from public.zoe_docs where tenant_id = $1', [tid])).rows[0].n;
    rec('លុបហាង (cascade) ៖ trigger មិនបង្កើត tombstone · ឯកសារបាត់ទាំងអស់', cascade === null && left === 0, cascade && cascade.message);
}

async function quotaUpgradeGuard() {
    const index = migrationFiles.findIndex((f) => f.endsWith('_zoe_quota_cleanup.sql'));
    ok('quota upgrade ៖ មាន migration បន្ថែមសម្រាប់សម្អាត', index >= 0);
    if (index < 0) return;
    const { c } = await H.freshDb('no-default-grants');
    try {
        await c.query(migrationFiles.slice(0, index).map((f) => fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8')).join('\n;\n'));
        const uid = await H.makeAuthUser(c, 'quota-upgrade@u.zoe.test');
        const tid = (await c.query("insert into public.tenants (name, branch_code, expires_at) values ('quota-upgrade', 'quota-upgrade', now() + interval '1 day') returning id")).rows[0].id;
        await c.query("insert into public.tenant_members (user_id, tenant_id, username) values ($1, $2, 'quotaupgrade')", [uid, tid]);
        const who = { role: 'authenticated', sub: uid };
        const write = (id, value) => as(c, who, 'select public.zoe_write($1, $2::jsonb) as r', [id, JSON.stringify([{ k: 'set', p: ['zoew_barcode_registry', 'ABC'], v: value }])]);
        const seed = await write('seed_quota_000001', true);
        await c.query('update public.zoe_tenant_state set quota_bytes = bytes where tenant_id = $1', [tid]);
        const snapshot = async () => (await c.query(`select to_jsonb(s) as state,
            (select jsonb_agg(to_jsonb(d)) from public.zoe_docs d where d.tenant_id = s.tenant_id) as docs,
            (select jsonb_agg(to_jsonb(o)) from public.zoe_ops o where o.tenant_id = s.tenant_id) as ops,
            (select proacl::text from pg_proc where oid = 'private.zoe_apply(uuid,text,jsonb,boolean,boolean)'::regprocedure) as acl
            from public.zoe_tenant_state s where s.tenant_id = $1`, [tid])).rows[0];
        const before = await snapshot();
        const failed = await write('delete_quota_001', null);
        ok('quota upgrade ៖ ទិន្នន័យមុន migration ពេញពិត និងលុបតូចបរាជ័យ', !!seed.rows && seed.rows[0].r.ok === true
            && before.state.bytes === before.state.quota_bytes && !!failed.error && failed.error.message === 'quota_exceeded', failed);
        await c.query(fs.readFileSync(path.join(MIGRATIONS_DIR, migrationFiles[index]), 'utf8'));
        ok('quota upgrade ៖ migration រក្សា state/docs/ops/ACL ទាំងអស់ដដែល', JSON.stringify(await snapshot()) === JSON.stringify(before));
        const deleted = await write('delete_quota_001', null);
        const after = await snapshot();
        ok('quota upgrade ៖ ហាងពេញចាស់លុបតូចបាន · receipt ថ្មីទាំងពីរនៅ · quota មិនប្រែ', !!deleted.rows && deleted.rows[0].r.ok === true
            && after.state.quota_bytes === before.state.quota_bytes && after.state.bytes > after.state.quota_bytes
            && after.state.bytes <= after.state.quota_bytes + 1048576 && after.ops.length === 2 && after.docs[0].value === null, { deleted, state: after.state });
    } finally { await c.end(); }
}

async function suite(sql, stopOnFail) {
    const results = [];
    const rec = (label, cond, detail) => {
        results.push({ label, pass: !!cond, detail });
        if (!cond && stopOnFail) throw STOP;
    };
    const { c } = await H.freshDb('default-grants');
    const extra = [];
    let applied = false;
    let digest = null;
    try {
        try {
            await c.query(sql);
            applied = true;
            digest = await schemaDigest(c);
        } catch (e) {
            rec('migration អនុវត្តបាន', false, e.message);
            return { results, applied, digest };
        }
        await body(c, rec, extra);
        await quotaCleanupCases(c, rec, extra);
        await externalEditCases(c, rec);
    } catch (e) {
        if (e !== STOP) results.push({ label: 'suite មិនគាំង', pass: false, detail: String(e && e.stack || e).slice(0, 800) });
    } finally {
        for (const x of extra) try { await x.end(); } catch (e) {}
        try { await c.end(); } catch (e) {}
    }
    return { results, applied, digest };
}

const MUTATIONS = [
    ['Table Editor លុបជួរ ➜ មិនបង្កើត tombstone', '    insert into public.zoe_docs (tenant_id, root, key, value, seq, updated_at)\n    values (old.tenant_id, old.root, old.key, null, next_seq, now());', '    perform 1;'],
    ['Table Editor កែ ➜ seq ឯកសារមិនឡើង', '    new.seq := next_seq;\n    new.updated_at := now();', '    new.updated_at := now();'],
    ['Table Editor ➜ bytes មិនតាម', 'bytes = greatest(s.bytes + delta, 0)', 'bytes = s.bytes'],
    ['trigger restamp ការសរសេរខាងក្នុង', "        or current_setting('zoe.internal_write', true) = 'on' then", '        then'],
    ['zoe_apply គ្មាន marker ខាងក្នុង', "    perform set_config('zoe.internal_write', 'on', true);", ''],
    ['zoe_apply success បន្សល់ marker លើ transaction', "    perform set_config('zoe.internal_write', coalesce(prior_origin, ''), true);\n    return jsonb_build_object('ok', true, 'seq'",
        "    return jsonb_build_object('ok', true, 'seq'"],
    ['zoe_apply CAS conflict បន្សល់ marker លើ transaction', "                perform set_config('zoe.internal_write', coalesce(prior_origin, ''), true);\n                return jsonb_build_object('ok', false, 'conflict'",
        "                return jsonb_build_object('ok', false, 'conflict'"],
    ['zoe_apply root CAS conflict បន្សល់ marker លើ transaction', "                    perform set_config('zoe.internal_write', coalesce(prior_origin, ''), true);\n                    return jsonb_build_object('ok', false, 'conflict'",
        "                    return jsonb_build_object('ok', false, 'conflict'"],
    ['Table Editor ជឿ seq = head + 1 ជំនួសប្រភព write', "        or current_setting('zoe.internal_write', true) = 'on' then",
        "        or new.seq = coalesce((select s.seq from public.zoe_tenant_state s where s.tenant_id = new.tenant_id), 0) + 1 then"],
    ['Table Editor គិត candidate INSERT មុន ON CONFLICT', "        if found then\n            new.seq := next_seq;\n            return new;\n        end if;", ''],
    ['Table Editor ពិនិត្យ conflict មុន lock ហាង', "    if tg_op = 'INSERT' then\n        insert into public.zoe_tenant_state (tenant_id) values (new.tenant_id) on conflict (tenant_id) do nothing;\n        perform 1 from public.zoe_tenant_state s where s.tenant_id = new.tenant_id for update;\n",
        "    if tg_op = 'INSERT' then\n"],
    ['ប្តូរតែ updated_at ➜ seq ឡើង', '            new.seq := old.seq;\n            return new;', '            null;'],
    ['policy zoe_docs ➜ using (true)', 'create policy zoe_docs_select on public.zoe_docs for select to authenticated\n    using (tenant_id = (select private.current_tenant_id()));',
        'create policy zoe_docs_select on public.zoe_docs for select to authenticated\n    using (true);'],
    ['zoe_read មិនច្រោះ tenant + security definer (RLS លែងការពារ)', [
        ["create or replace function public.zoe_read(p_root text, p_key text default null) returns jsonb\nlanguage plpgsql stable security invoker",
            "create or replace function public.zoe_read(p_root text, p_key text default null) returns jsonb\nlanguage plpgsql stable security definer"],
        ["    from public.zoe_docs d\n    where d.tenant_id = tenant and d.root = p_root and (p_key is null or d.key = p_key)",
            "    from public.zoe_docs d\n    where d.root = p_root and (p_key is null or d.key = p_key)"]]],
    ['zoe_read ជា security definer តែនៅច្រោះ tenant (probe ទិសផ្ទុយ ៖ មិនមែនការលេចធ្លាយ)', [
        ["create or replace function public.zoe_read(p_root text, p_key text default null) returns jsonb\nlanguage plpgsql stable security invoker",
            "create or replace function public.zoe_read(p_root text, p_key text default null) returns jsonb\nlanguage plpgsql stable security definer"]], 'equivalent'],
    ['rules lookup មិនច្រោះ tenant', "    where z.tenant_id = tenant and z.root = snap_path[1] and z.key = snap_path[2];",
        "    where z.root = snap_path[1] and z.key = snap_path[2] order by (z.tenant_id = tenant) limit 1;"],
    ['canon មិនបម្លែង array', "    if kind <> 'object' and kind <> 'array' then\n        return p_value;", "    if kind <> 'object' then\n        return p_value;"],
    ['canon មិនបដិសេធកូនសោហាម', "        if kind = 'object' and (octet_length(child_key) not between 1 and 768 or child_key ~ '[\\]\\[.#$/\\x01-\\x1f\\x7f]') then",
        "        if false then"],
    ['canon មិនបដិសេធលេខលើស double', [["        if abs((p_value #>> '{}')::numeric) > 1.7976931348623157e308 then", "        if false then"],
        ["            if abs((child #>> '{}')::numeric) > 1.7976931348623157e308 then", "            if false then"]]],
    ['cas មិនប្រៀបតម្លៃ (doc)', "            current_value := coalesce(pre #> (array[doc_key] || op_path[3:]), 'null'::jsonb);\n            if current_value <> private.zoe_canon(op -> 'x') then",
        "            current_value := coalesce(pre #> (array[doc_key] || op_path[3:]), 'null'::jsonb);\n            if false then"],
    ['cas មិនប្រៀបតម្លៃ (node)', "                if current_value <> private.zoe_canon(op -> 'x') then", "                if false then"],
    ['set node មិនលុបកូនចាស់', "        case when rt.r is not null then coalesce(rt.v -> split_part(e.key, '/', 2), 'null'::jsonb)",
        "        case when rt.r is not null then coalesce(rt.v -> split_part(e.key, '/', 2), e.value)"],
    ['canon មិនបម្លែងលេខជា double', [["        return to_jsonb((p_value #>> '{}')::float8);", "        return p_value;"],
        ["                child := to_jsonb((child #>> '{}')::float8);", "                child := child;"]]],
    ['op_id មិន idempotent', "    if found then\n        return prior || jsonb_build_object('replayed', true, 'now', now_ms);\n    end if;", ''],
    ['មិនពិនិត្យ path ជាន់', "        where x.b is not null and cardinality(x.b) <= cardinality(x.a) and x.a[1:cardinality(x.b)] = x.b", "        where false"],
    ['មិន enforce rules', "    if p_enforce then\n        rules := private.zoe_rules();", "    if false then\n        rules := private.zoe_rules();"],
    ['tombstone មិនបាន seq ថ្មី (delta ខកខានការលុប)', "            set value = excluded.value, seq = excluded.seq, updated_at = excluded.updated_at;",
        "            set value = excluded.value, seq = case when excluded.value is null then z.seq else excluded.seq end, updated_at = excluded.updated_at;"],
    ['pull ពី 0 រួម tombstone', "    if full_sync then\n        full_head := head;\n    end if;\n", ''],
    ['pull មិន reset លើ cursor ចាស់ជាង purge', "(since > 0 and since < purged and full_head is null)", "(false)"],
    ['paging កាត់ក្រុម seq', "    where d.tenant_id = tenant and d.seq > since and d.seq <= upper_seq\n        and (d.value is not null or d.seq > tomb_after);",
        "    where d.tenant_id = tenant and d.seq > since and d.seq <= upper_seq\n        and (d.value is not null or d.seq > tomb_after)\n"
        + "        and (d.root, d.key) in (select d2.root, d2.key from public.zoe_docs d2 where d2.tenant_id = tenant and d2.seq > since order by d2.seq, d2.key limit lim);"],
    ['zoe_write ៖ ដក guard tenant null តែក្នុង wrapper (probe ទិសផ្ទុយ ៖ zoe_apply នៅបដិសេធ)', [
        ["    tenant uuid := private.current_tenant_id();\nbegin\n    if tenant is null then\n        raise exception 'forbidden' using errcode = '42501';\n    end if;\n    return private.zoe_apply(tenant, p_op_id, p_ops, true, false);",
            "    tenant uuid := private.current_tenant_id();\nbegin\n    return private.zoe_apply(tenant, p_op_id, p_ops, true, false);"]], 'equivalent'],
    ['zoe_write + zoe_apply មិនបដិសេធ tenant null (Revoke · គណនីគ្មានហាង)', [
        ["    tenant uuid := private.current_tenant_id();\nbegin\n    if tenant is null then\n        raise exception 'forbidden' using errcode = '42501';\n    end if;\n    return private.zoe_apply(tenant, p_op_id, p_ops, true, false);",
            "    tenant uuid := private.current_tenant_id();\nbegin\n    return private.zoe_apply(tenant, p_op_id, p_ops, true, false);"],
        ["    overlap boolean;\nbegin\n    if tenant is null then\n        raise exception 'forbidden' using errcode = '42501';\n    end if;\n    if p_op_id is null",
            "    overlap boolean;\nbegin\n    if p_op_id is null"]]],
    ['zoe_read មិនបដិសេធ tenant null ➜ បញ្ជីទទេ (App អាន «គ្មានទិន្នន័យ»)', "    docs jsonb;\nbegin\n    if tenant is null then\n        raise exception 'forbidden' using errcode = '42501';\n    end if;",
        "    docs jsonb;\nbegin"],
    ['ទាញពេញជាទំព័រមិនស្គាល់ p_full_head (វិលចាប់ផ្តើមម្តងទៀតពេល purge)', "since < purged and full_head is null)", "since < purged)"],
    ['ជឿ p_full_head ចាស់ជាង purged_seq', "(since <= 0 or full_head < purged or full_head > head)", "(since <= 0 or full_head > head)"],
    ['ទំព័របន្តមិនបញ្ជូន tombstone ក្រោយការទាញចាប់ផ្តើម', "tomb_after := case when full_head is null then since else full_head end;", "tomb_after := case when full_head is null then since else head end;"],
    ['ទំព័រ reset មិនបញ្ជូន head', "'head', head, 'tenant', tenant, 'now', private.zoe_now_ms(), 'rows', rows_out);", "'head', null, 'tenant', tenant, 'now', private.zoe_now_ms(), 'rows', rows_out);"],
    ['pull បញ្ជូន tenant ខុស (cache ហាងផ្សេងអាចចូល)', "'head', head, 'tenant', tenant, 'now', private.zoe_now_ms(), 'rows', rows_out);", "'head', head, 'tenant', null, 'now', private.zoe_now_ms(), 'rows', rows_out);"],
    ['housekeeping មិនកត់ purged_seq', "        update public.zoe_tenant_state s set purged_seq = greatest(s.purged_seq, purged) where s.tenant_id = p_tenant;\n", ''],
    ['គ្មាន tenant lock (for update)', "    select s.seq, s.bytes, s.quota_bytes into head, used, quota from public.zoe_tenant_state s where s.tenant_id = tenant for update;",
        "    select s.seq, s.bytes, s.quota_bytes into head, used, quota from public.zoe_tenant_state s where s.tenant_id = tenant;"],
    ['broadcast topic មិនមែនតាម tenant', "'seq', 'zoe:' || new.tenant_id::text, true);", "'seq', 'zoe:all', true);"],
    ['policy broadcast មិនពិនិត្យ topic', "                and (select realtime.topic()) = 'zoe:' || (select private.current_tenant_id())::text\n", ''],
    ['zoe_write មិនពិនិត្យ tenant សកម្ម', "    tenant uuid := private.current_tenant_id();\nbegin\n    if tenant is null then\n        raise exception 'forbidden' using errcode = '42501';\n    end if;\n    return private.zoe_apply(tenant,",
        "    tenant uuid := (select m.tenant_id from public.tenant_members m where m.user_id = auth.uid());\nbegin\n    if tenant is null then\n        raise exception 'forbidden' using errcode = '42501';\n    end if;\n    return private.zoe_apply(tenant,"],
    ['inc គិតជា decimal (ឃ្លាតពី RTDB double)', "then (current_value #>> '{}')::float8 else 0::float8 end + delta))", "then (current_value #>> '{}')::numeric else 0 end + delta::numeric))"],
    ['quota មិន enforce', "    if p_enforce and grow > 0 and used::numeric + grow > quota then", "    if false then"],
    ['quota reserve គ្មានពិដាន', 'used::numeric + grow - quota <= 1048576', 'true'],
    ['quota reserve អនុញ្ញាត no-op', 'changed and cleanup_only and used::numeric + grow - quota <= 1048576', 'cleanup_only and used::numeric + grow - quota <= 1048576'],
    ['quota reserve បាត់ mixed mutation មុនលុប', "cleanup_only := cleanup_only and current_value <> 'null'::jsonb", "cleanup_only := current_value <> 'null'::jsonb"],
    ['quota reserve អនុញ្ញាត mixed write', 'changed and cleanup_only and used::numeric + grow - quota <= 1048576', 'changed and used::numeric + grow - quota <= 1048576'],
    ['quota reserve មិនសម្អាតមុនពិនិត្យ', '        perform private.zoe_housekeeping(tenant);\n        select s.bytes into used', '        select s.bytes into used'],
    ['housekeeping មិនដក bytes', "        update public.zoe_tenant_state s set bytes = greatest(s.bytes - freed_docs - freed_ops, 0) where s.tenant_id = p_tenant;", "        null;"],
    ['tombstone ថ្មីមិនរាប់ key (bytes តិចជាងការពិត)', "            + case when (pre_rows ->> doc_key)::boolean then 0 else", "            + case when true then 0 else"],
    ['zoe_admin_write ឲ្យ authenticated', 'grant execute on function public.zoe_admin_write(uuid, text, jsonb, boolean) to service_role;',
        'grant execute on function public.zoe_admin_write(uuid, text, jsonb, boolean) to service_role, authenticated;']
];

function effectiveAnchor(sql, from) {
    const at = sql.lastIndexOf(from);
    return at === -1 ? { problem: 'រកមិនឃើញ' } : { at };
}

async function schemaDigest(c) {
    const r = await c.query(`select md5(coalesce((select string_agg(pg_get_functiondef(p.oid) || coalesce(p.proacl::text, ''), '|' order by p.oid::regprocedure::text)
            from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public', 'private') and p.prokind = 'f'), '')
        || coalesce((select string_agg(concat_ws(':', schemaname, tablename, policyname, cmd, roles::text, qual, with_check), '|' order by schemaname, tablename, policyname)
            from pg_policies where schemaname in ('public', 'realtime')), '')
        || coalesce((select string_agg(c.relname || coalesce(c.relacl::text, ''), '|' order by c.relname)
            from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r'), '')
        || coalesce((select string_agg(pg_get_triggerdef(t.oid), '|' order by t.tgname) from pg_trigger t where not t.tgisinternal), '')) as d`);
    return r.rows[0].d;
}

function migrationHistoryProblems(base, current) {
    const problems = [];
    const baseNames = [...base.keys()].sort();
    const lastBase = baseNames.length ? baseNames[baseNames.length - 1].slice(0, 14) : '';
    for (const [name, text] of base) {
        if (!current.has(name)) problems.push('លុប ' + name);
        else if (current.get(name) !== text) problems.push('កែ ' + name);
    }
    const versions = new Map();
    for (const name of current.keys()) {
        const v = name.slice(0, 14);
        versions.set(v, (versions.get(v) || 0) + 1);
        if (!base.has(name) && v <= lastBase) problems.push('ថ្មី តែ version មិនក្រោយ ' + lastBase + ' ៖ ' + name);
    }
    for (const [v, n] of versions) if (n > 1) problems.push('version ស្ទួន ' + v + ' (' + n + ' ឯកសារ)');
    return problems;
}

function migrationAppendOnly() {
    console.log('\n── ០ខ. migration ក្នុង ' + MIGRATION_BASE + ' មិនត្រូវកែ/លុប ៖ Deploy ពី GitHub (និង db push) អនុវត្តតែ version ដែលមិនទាន់អនុវត្ត ──');
    const A = '20260101000000_a.sql', B = '20260102000000_b.sql', C = '20260103000000_c.sql', OLD = '20260101120000_old.sql';
    const probeBase = new Map([[A, 'x'], [B, 'y']]);
    ok('ទិសផ្ទុយ ៖ កែ migration ចាស់ ➜ រកឃើញ', migrationHistoryProblems(probeBase, new Map([[A, 'x2'], [B, 'y']])).length === 1);
    ok('ទិសផ្ទុយ ៖ លុប migration ចាស់ ➜ រកឃើញ', migrationHistoryProblems(probeBase, new Map([[B, 'y']])).length === 1);
    ok('ទិសផ្ទុយ ៖ migration ថ្មីមាន version មុនចុងក្រោយ ➜ រកឃើញ', migrationHistoryProblems(probeBase, new Map([[A, 'x'], [B, 'y'], [OLD, 'z']])).length === 1);
    ok('ទិសផ្ទុយ ៖ version ស្ទួន ➜ រកឃើញ',
        migrationHistoryProblems(probeBase, new Map([[A, 'x'], [B, 'y'], [C, 'z'], ['20260103000000_d.sql', 'w']])).length === 1);
    ok('ទិសផ្ទុយ ៖ បន្ថែម migration ថ្មីក្រោយគេ ➜ មិនមែនបញ្ហា', migrationHistoryProblems(probeBase, new Map([[A, 'x'], [B, 'y'], [C, 'z']])).length === 0);
    const git = (args) => execFileSync('git', args, { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 });
    let baseNames = null;
    try {
        git(['rev-parse', '--verify', MIGRATION_BASE + '^{commit}']);
        baseNames = git(['ls-tree', '--name-only', MIGRATION_BASE, 'supabase/migrations/']).split('\n').filter(Boolean)
            .map((p) => path.basename(p)).filter((f) => MIGRATION_RE.test(f));
    } catch (e) {
        baseNames = null;
    }
    if (!baseNames) {
        if (STRICT) ok('SUPABASE_STRICT=1 ៖ រកមិនឃើញ base ' + MIGRATION_BASE + ' (ត្រូវការ git · fetch-depth 0)', false);
        else skipped.push('គ្មាន base ' + MIGRATION_BASE + ' ➜ មិនបានវាស់ migration append-only');
        return;
    }
    const base = new Map(baseNames.map((f) => [f, git(['show', MIGRATION_BASE + ':supabase/migrations/' + f])]));
    const current = new Map(migrationFiles.map((f) => [f, fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8')]));
    const problems = migrationHistoryProblems(base, current);
    ok('migration ក្នុង ' + MIGRATION_BASE + ' (' + base.size + ') នៅដដែល · migration ថ្មី (' + [...current.keys()].filter((f) => !base.has(f)).length
        + ') មាន version ក្រោយគេ · គ្មាន version ស្ទួន (កែ rules ➜ node supabase/scripts/generate-rules-sql.mjs បង្កើតឯកសារថ្មី)', problems.length === 0, problems);
}

async function rulesMigrationFreshness() {
    console.log('\n── ០. migration rules ចុងក្រោយ ↔ firebase-database.rules.json (ប្រភពតែមួយ) ──');
    const file = migrationFiles.filter((f) => /_zoe_rules\.sql$/.test(f)).pop();
    ok('មាន migration rules (*_zoe_rules.sql)', !!file, migrationFiles);
    let gen = null;
    try { gen = await import(require('url').pathToFileURL(path.join(ROOT, 'supabase', 'scripts', 'rtdb-rules.mjs')).href); } catch (e) { gen = null; }
    let rules = null;
    try { rules = JSON.parse(fs.readFileSync(path.join(ROOT, 'firebase-database.rules.json'), 'utf8')); } catch (e) { rules = null; }
    ok('ផ្ទុក generator ពិត (supabase/scripts/rtdb-rules.mjs) និង rules ពិតបាន', !!gen && typeof gen.rulesSql === 'function' && !!rules);
    if (!file || !gen || !rules) return;
    const want = gen.rulesSql(gen.compileRules(rules));
    const have = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    ok('⛔ ' + file + ' = rulesSql(compileRules(firebase-database.rules.json)) — កែ rules ➜ node supabase/scripts/generate-rules-sql.mjs', have === want,
        { haveBytes: have.length, wantBytes: want.length });
    const probe = JSON.parse(JSON.stringify(rules));
    const node = probe.rules.zoew_barcode_registry.$barcodeKey;
    node['.validate'] = '(' + node['.validate'] + ') && auth != null';
    ok('ទិសផ្ទុយ ៖ rules ប្រែ ➜ SQL ដែលបង្កើតប្រែ (generator មិនមែនថេរ)', gen.rulesSql(gen.compileRules(probe)) !== want);
}

async function rulesCompilerGuardRegression() {
    console.log('\n── F03. compiler guard ៖ AST ពិត · token/regex/arity poison · គ្មាន backend engine ──');
    const assert = require('assert/strict'), { createHash } = require('crypto');
    const checks = [], hashes = {}, hash = value => createHash('sha256').update(value).digest('hex');
    const check = (id, run) => {
        let error = null;
        try { run(); } catch (failure) { error = String(failure?.message || failure).slice(0, 500); }
        checks.push({ id, pass: error === null, ...(error ? { error } : {}) });
        ok('F03 compiler ៖ ' + id, error === null, error);
    };
    let parseExpression, guard, rules, generator;
    const parserPath = path.join(ROOT, 'supabase/scripts/rtdb-expression.cjs');
    const guardPath = path.join(ROOT, 'supabase/scripts/rtdb-canonical-key.cjs');
    const rulesPath = path.join(ROOT, 'firebase-database.rules.json');
    try {
        for (const file of [parserPath, guardPath, rulesPath]) hashes[path.relative(ROOT, file)] = hash(fs.readFileSync(file));
        ({ parseExpression } = require(parserPath));
        ({ NATIVE_F03_CANONICAL_GUARD: guard } = require(guardPath));
        rules = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));
        generator = await import(require('url').pathToFileURL(path.join(ROOT, 'supabase/scripts/rtdb-rules.mjs')).href);
    } catch (failure) {
        check('C00-source-inputs', () => { throw failure; });
    }
    if (!checks.length) check('C00-source-inputs', () => {
        assert.equal(typeof parseExpression, 'function'); assert.equal(typeof guard, 'string'); assert.ok(guard.length > 0);
        assert.equal(typeof generator?.compileRules, 'function'); assert.ok(rules?.rules?.zoew_registry_releases?.$releaseId);
    });
    if (parseExpression && typeof guard === 'string' && rules && generator) {
        const scope = ['$releaseId'], node = rules.rules.zoew_registry_releases.$releaseId;
        const hasIntrinsic = tree => tree && typeof tree === 'object'
            && (tree.t === 'f03_registry_key' || Object.values(tree).some(value => Array.isArray(value) ? value.some(hasIntrinsic) : hasIntrinsic(value)));
        check('C01-fixed-guard-exact-AST', () => assert.deepEqual(parseExpression(guard, scope), { t: 'f03_registry_key' }));
        check('C02-actual-release-and-compiled-tree-have-one-guard', () => {
            assert.equal(node['.validate'].split(guard).length - 1, 1);
            let count = 0;
            const strip = value => {
                if (!value || typeof value !== 'object') return value;
                if (value.t === '&&' && value.r?.t === 'f03_registry_key') { count++; return strip(value.l); }
                return Array.isArray(value) ? value.map(strip) : Object.fromEntries(Object.entries(value).map(([key, child]) => [key, strip(child)]));
            };
            const current = generator.compileRules(rules), unguarded = JSON.parse(JSON.stringify(rules));
            unguarded.rules.zoew_registry_releases.$releaseId['.validate'] = node['.validate'].replace(' && ' + guard, '');
            assert.notEqual(unguarded.rules.zoew_registry_releases.$releaseId['.validate'], node['.validate']);
            assert.deepEqual(strip(current), generator.compileRules(unguarded));
            assert.equal(count, 1);
            assert.equal(hasIntrinsic(current.c.zoew_registry_releases.x.r.v), true);
        });
        check('C03-guard-scope-is-exact-release-scope', () => {
            for (const other of [[], ['$itemId'], ['$releaseId', '$other']]) assert.throws(() => parseExpression(guard, other));
        });
        check('C04-quoted-template-is-only-a-literal', () => {
            for (const value of [guard, 'prefix\\\"' + guard + 'suffix', "prefix'/*" + guard + '//suffix']) {
                assert.deepEqual(parseExpression(JSON.stringify(value), []), { t: 'l', v: value });
                assert.equal(hasIntrinsic(parseExpression(JSON.stringify(value), [])), false);
            }
        });
        check('C05-comment-and-partial-identifier-poisons-refused', () => {
            for (const text of ['/*' + guard + '*/', '//' + guard, 'prefix' + guard, guard + 'suffix']) assert.throws(() => parseExpression(text, scope));
        });
        const poison = (text, from, to) => { assert.equal(text.includes(from), true, 'poison anchor missing'); const changed = text.replace(from, () => to); assert.notEqual(changed, text); return changed; };
        check('C06-field-source-and-operator-poisons-refused', () => {
            for (const [from, to] of [["child('code')", "child('barcode')"], ['newData', 'data'], ["child('registryKey')", "child('other')"], [' && ', ' || ']]) {
                const changed = poison(guard, from, to);
                assert.throws(() => parseExpression(changed, scope));
            }
        });
        check('C07-regex-anchor-wildcard-flag-poisons-refused', () => {
            for (const [from, to] of [['[.]', '.'], ['^', ''], ['$/)', '$/m)'], ['\\u0009', '\\u0008']]) {
                const changed = poison(guard, from, to);
                assert.throws(() => parseExpression(changed, scope));
            }
        });
        check('C08-arity-and-encoding-order-poisons-refused', () => {
            for (const [from, to] of [['.toUpperCase()', '.toUpperCase("tr")'], ['%25', '%2525'], ['.replace("%09", "\\t")', '.replace("%09")'],
                ['.replace("%09", "\\t")', '.replace("%09", "x")'], ["child('code').isString()", "child('code').isString(true)"]]) {
                const changed = poison(guard, from, to);
                assert.throws(() => parseExpression(changed, scope));
            }
        });
        check('C09-general-string-methods-remain-unsupported', () => {
            for (const text of ["newData.val().trim()", "newData.val().toUpperCase()", "newData.val().replace('x','y')", "newData.val().contains('x')", "newData.val().matches(/^x$/)"]) {
                assert.throws(() => parseExpression(text, scope));
            }
        });
        check('C10-dynamic-regex-eval-functions-tokens-refused', () => {
            for (const text of ["newData.val().matches(data.val())", "eval('true')", 'foo()', 'newData.foo', 'true; true', 'true @ false', '__f03_registry_key']) {
                assert.throws(() => parseExpression(text, scope));
            }
        });
        check('C11-compound-old-operators-retain-exact-AST', () => {
            assert.deepEqual(parseExpression('true && ' + guard, scope), { t: '&&', l: { t: 'l', v: true }, r: { t: 'f03_registry_key' } });
            assert.deepEqual(parseExpression('auth != null && newData.isString()', []), { t: '&&', l: { t: 'b', o: '!=', l: { t: 'auth' }, r: { t: 'l', v: null } },
                r: { t: 'm', n: 'isString', o: { t: 'newData' }, a: [] } });
        });
        check('C12-poisoned-guard-cannot-compile-through-rule-generator', () => {
            const bad = JSON.parse(JSON.stringify(rules));
            bad.rules.zoew_registry_releases.$releaseId['.validate'] = node['.validate'].replace(guard, () => poison(guard, '[.]', '.'));
            assert.throws(() => generator.compileRules(bad));
        });
        check('C13-native-any-character-uses-supported-partition', () => {
            const patterns = [...guard.matchAll(/\.matches\((\/(?:\\.|[^/\\])*\/)\)/g)].map(match => match[1]);
            const group = '([^A]|A)';
            assert.equal(patterns.length, 4);
            assert.ok(patterns.every(pattern => pattern.startsWith('/^') && pattern.endsWith('$/')));
            assert.equal(guard.includes('[\\s\\S]'), false);
            assert.equal(guard.split(group).length - 1, 4);
            assert.ok(patterns[0].startsWith('/^' + group + '*'));
            const any = new RegExp('^' + group + '*$');
            const points = [0, 9, 10, 11, 12, 13, 32, 127, 160, 5760, ...Array.from({ length: 11 }, (_, index) => 8192 + index),
                8232, 8233, 8239, 8287, 12288, 65279];
            for (const value of ['', 'A', 'a', 'AA', 'A\\B', 'ß', 'ᲊ', '😀', '\ud800', '\udc00', ...points.map(point => String.fromCharCode(point))]) {
                assert.equal(any.test(value), true);
            }
            assert.equal(JSON.parse(JSON.stringify({ guard })).guard, guard);
        });
    }
    const report = { status: checks.length === 14 && checks.every(row => row.pass) ? 'PURE_COMPILER_CHECKS_COMPLETE' : 'FAIL',
        checks, pass: checks.filter(row => row.pass).length, fail: checks.filter(row => !row.pass).length,
        sourceHashes: hashes, driverHash: hash(fs.readFileSync(__filename)), guardHash: typeof guard === 'string' ? hash(guard) : null, nativeRuntime: 'UNRUN', supabaseRuntime: 'UNRUN' };
    if (process.env.SUPABASE_RULES_COMPILER_RESULT) fs.writeFileSync(path.resolve(process.env.SUPABASE_RULES_COMPILER_RESULT), JSON.stringify(report, null, 2) + '\n');
    return report;
}

// ⛔ ចំណាយនៃការសរសេរ/អានត្រូវលីនេអ៊ែរតាមទំហំ (A154 ៖ ឯកសារ ៩៨ KB ចំណាយ ៨ វិ. · ហាងធំ ~៤០០០ barcode/ថ្ងៃ ធ្លាក់ពិដាន) ៖ រូបរាងពិតរបស់ App
//    (reconcile `update()` ចូល root ចំណូលយករួច · `runTransaction` លើ root ទាំងមូល · ទាញ/អានឯកសារធំ) ក្រោម `statement_timeout` ៨ វិ.
//    (លំនាំដើមរបស់ role `authenticated` លើ Supabase) ➜ ត្រូវឆ្លង · ទំហំឯកសារដែលការសរសេរមួយប៉ះមានពិដាន · ទំព័រ `zoe_pull` មានពិដានបៃ
//    (ទំព័រច្រើន · គ្រប់ជួរមកដល់)។ ទំហំត្រូវជ្រើសឲ្យមុនកែលើសពិដានឆ្ងាយ (ការ៉េ) ហើយក្រោយកែតិចជាងពិដានច្រើនដង។
async function costGuard() {
    console.log('\n── ៣. ចំណាយលីនេអ៊ែរ ៖ រូបរាងហាងធំ ក្រោម statement_timeout ៨ វិ. · ពិដានទំហំដែលការសរសេរប៉ះ · ទំព័រ zoe_pull តាមបៃ ──');
    const { c } = await H.freshDb('default-grants');
    try {
        await c.query(migrationSql);
        const { SERVICE, tenants } = await setupTenants(c);
        const A = tenants.A;
        await c.query("set statement_timeout = '8s'");
        const timed = async (who, fn, args) => {
            const t0 = Date.now();
            const r = await as(c, who, 'select public.' + fn + ' as r', args);
            return { ms: Date.now() - t0, r: r.rows ? r.rows[0].r : null, error: r.error };
        };
        const write = (ops) => timed(A.who, 'zoe_write($1, $2::jsonb)', [newOp(), JSON.stringify(ops)]);
        const admin = (ops) => timed(SERVICE, 'zoe_admin_write($1, $2, $3::jsonb, false)', [A.id, newOp(), JSON.stringify(ops)]);
        const COL = 'zoew_daily_collected_cod_dod';
        const PICK = 'zoew_daily_pickup_cod_dod';
        const DAYS = 4, N = 2000;
        const day = (d) => '2026-09-' + String(10 + d);
        const bkey = (d, i) => 'ZT' + d + String(i).padStart(11, '0');
        const model = {};
        for (let d = 0; d < DAYS; d++) {
            model[day(d)] = {};
            for (let i = 0; i < N; i++) model[day(d)][bkey(d, i)] = { c: (i % 50) + 0.25, d: i % 3 };
        }
        const seed = await admin(Object.keys(model).map((k) => ({ k: 'set', p: [COL, k], v: model[k] })));
        ok('ចាប់ផ្តើម ៖ root ចំណូលយករួច ' + DAYS + ' ថ្ងៃ × ' + N + ' barcode (' + seed.ms + 'ms)', !!seed.r && seed.r.ok === true, seed.error);
        const upd = {};
        for (let b = 0; b < 40; b++) {
            for (let d = 0; d < DAYS; d++) upd[day(d) + '/' + bkey(d, b)] = null;
            upd[day(DAYS - 1) + '/' + bkey(DAYS - 1, b)] = { c: 9, d: 1 };
        }
        for (const [k, v] of Object.entries(upd)) {
            const [d, b] = k.split('/');
            if (v === null) delete model[d][b];
            else model[d][b] = v;
        }
        const recon = await write(Object.entries(upd).map(([k, v]) => ({ k: 'set', p: [COL].concat(k.split('/')), v })));
        ok('⛔ reconcile ៖ update() ' + Object.keys(upd).length + ' ផ្លូវចូល root ' + (DAYS * N) + ' key ➜ ok ក្រោម ៨ វិ. (' + recon.ms + 'ms)',
            !!recon.r && recon.r.ok === true, recon.error);
        const next = JSON.parse(JSON.stringify(model));
        next[day(0)][bkey(0, 100)] = { c: 77.5, d: 2 };
        const cas = await write([{ k: 'cas', p: [COL], x: model, v: next }]);
        ok('⛔ runTransaction លើ root ទាំងមូល (CAS ' + (DAYS * N) + ' key) ➜ ok ក្រោម ៨ វិ. (' + cas.ms + 'ms)', !!cas.r && cas.r.ok === true, cas.error || cas.r);
        let same = 0;
        for (const d of Object.keys(next)) {
            const r = await c.query('select z.value = $3::jsonb as same from public.zoe_docs z where z.tenant_id = $1 and z.root = $4 and z.key = $2', [A.id, d, JSON.stringify(next[d]), COL]);
            if (r.rows[0] && r.rows[0].same) same++;
        }
        ok('ក្រោយ reconcile + CAS ៖ ឯកសារលើ server ស្មើគំរូ JS គ្រប់ថ្ងៃ (' + same + '/' + DAYS + ')', same === DAYS);
        const bigDoc = (seedNo, n) => {
            const o = { packagesPickedUp: n, pickedUpBarcodes: {} };
            for (let i = 0; i < n; i++) o.pickedUpBarcodes['ZP' + seedNo + String(i).padStart(11, '0')] = '0' + String((i * 7919 + seedNo * 104729) % 1000000000).padStart(9, '0');
            return o;
        };
        const big = await admin([{ k: 'set', p: [PICK, '2026-08-01'], v: bigDoc(1, 20000) }, { k: 'set', p: [PICK, '2026-08-02'], v: bigDoc(2, 20000) }]);
        const rd = big.r && big.r.ok ? await timed(A.who, 'zoe_read($1, null)', [PICK]) : { error: 'setup' };
        ok('⛔ ឯកសារធំ ២ (២០០០០ barcode) ៖ Admin សរសេរ (' + big.ms + 'ms) · zoe_read ➜ ok ក្រោម ៨ វិ. (' + rd.ms + 'ms)',
            !!big.r && big.r.ok === true && !!rd.r && rd.r.docs.length === 2, big.error || rd.error);
        const heavy = [];
        for (let i = 0; i < 10; i++) heavy.push({ k: 'set', p: [PICK, '2026-07-' + String(10 + i)], v: bigDoc(10 + i, 30000) });
        let heavyOk = true;
        for (let i = 0; i < heavy.length; i += 4) {
            const r = await admin(heavy.slice(i, i + 4));
            heavyOk = heavyOk && !!r.r && r.r.ok === true;
        }
        const touchAll = await write(heavy.map((h) => ({ k: 'set', p: h.p.concat(['packagesPickedUp']), v: 1 })));
        const touchHalf = await write(heavy.slice(0, 5).map((h) => ({ k: 'set', p: h.p.concat(['packagesPickedUp']), v: 2 })));
        ok('⛔ ការសរសេរមួយប៉ះឯកសារសរុប > ៨ MiB (១០ ឯកសារ ~១ MB) ➜ invalid_data (size) · ទិសផ្ទុយ ៖ ៥ ឯកសារ ➜ ok (' + touchHalf.ms + 'ms)',
            heavyOk && !!touchAll.error && touchAll.error.message === 'invalid_data' && touchAll.error.detail === 'size' && !!touchHalf.r && touchHalf.r.ok === true,
            { heavyOk, touchAll: touchAll.error || touchAll.r, touchHalf: touchHalf.error || touchHalf.r });
        const want = Number((await c.query('select count(*) from public.zoe_docs where tenant_id = $1 and value is not null', [A.id])).rows[0].count);
        const seen = new Set();
        let since = 0, pages = 0, slowest = 0, err = null;
        for (let guard = 0; guard < 100; guard++) {
            const p = await timed(A.who, 'zoe_pull($1, 2000)', [since]);
            if (!p.r) { err = p.error; break; }
            pages++;
            slowest = Math.max(slowest, p.ms);
            for (const row of p.r.rows) if (row.v !== null) seen.add(row.r + '/' + row.k);
            since = p.r.seq;
            if (!p.r.more) break;
        }
        ok('⛔ zoe_pull ពេញ (' + want + ' ឯកសារ ~១២ MB) ៖ ទំព័រតាមពិដានបៃ (' + pages + ' ទំព័រ · យឺតបំផុត ' + slowest + 'ms) · គ្រប់ឯកសារមកដល់',
            !err && pages >= 2 && seen.size === want, { err, pages, seen: seen.size, want });
    } catch (e) {
        ok('ការវាស់ចំណាយមិនគាំង', false, String(e && e.stack || e));
    } finally {
        try { await c.end(); } catch (e) {}
    }
}

async function main() {
    await rulesCompilerGuardRegression();
    await rulesMigrationFreshness();
    if (RULES_GENERATOR_ONLY) {
        if (STRICT) ok('SUPABASE_STRICT=1 ៖ rules-generator-only មិនអាចជំនួស backend engine', false);
        skipped.push('rules-generator-only ៖ native និង PostgreSQL engine UNRUN');
        finish();
        return;
    }
    migrationAppendOnly();
    const reason = H.unavailableReason();
    if (reason) {
        if (STRICT) ok('SUPABASE_STRICT=1 ៖ ' + reason, false);
        else skipped.push(reason);
        finish();
        return;
    }
    const t0 = Date.now();
    await H.start();
    console.log('  (Postgres ' + H.pgBin.version.replace(/^postgres \(PostgreSQL\) /, '') + ' · ' + (Date.now() - t0) + 'ms)');
    console.log('\n── ១. migration ពិត ──');
    const { results, digest: realDigest } = await suite(migrationSql, false);
    for (const r of results) ok(r.label, r.pass, r.pass ? undefined : r.detail);
    ok('ការអះអាង >= ៦០ (ឃើញ ' + results.length + ')', results.length >= 60, results.length);

    console.log('\n── ២. mutation លើ migration ពិត ➜ អ្នកយាមត្រូវក្រហម ──');
    ok('mutation >= ១៥ (មាន ' + MUTATIONS.length + ')', MUTATIONS.length >= 15);
    for (const entry of MUTATIONS) {
        const label = entry[0];
        const pairs = Array.isArray(entry[1]) ? entry[1] : [[entry[1], entry[2]]];
        const equivalent = entry[2] === 'equivalent';
        const spots = pairs.map(([from, to]) => Object.assign({ from, to }, effectiveAnchor(migrationSql, from)));
        const bad = spots.find((x) => x.problem);
        if (bad) {
            ok('mutation «' + label + '» ៖ anchor ត្រូវលេចម្តងគត់ក្នុងនិយមន័យដែលរស់ (' + bad.problem + ')', false);
            continue;
        }
        let mutated = migrationSql;
        for (const x of spots.sort((p, q) => q.at - p.at)) mutated = mutated.slice(0, x.at) + x.to + mutated.slice(x.at + x.from.length);
        const r = await suite(mutated, !equivalent);
        if (r.applied && r.digest === realDigest) {
            ok('mutation «' + label + '» ៖ ប្តូរនិយមន័យដែលរស់ (anchor នៅកូដស្លាប់ ➜ digest function/policy/grant ដដែល)', false);
            continue;
        }
        const caught = r.results.filter((x) => !x.pass);
        if (equivalent) {
            ok('mutation «' + label + '» ➜ អ្នកយាមនៅបៃតង (ការការពារពិតនៅកន្លែងផ្សេង)', r.applied && caught.length === 0, caught.slice(0, 3).map((x) => x.label));
            continue;
        }
        ok('mutation «' + label + '» ➜ ' + (r.applied ? 'ចាប់ដោយ «' + (caught[0] ? caught[0].label : '—') + '»' : 'SQL អនុវត្តមិនបាន (មិនរាប់)'),
            r.applied && caught.length > 0);
    }
    await quotaUpgradeGuard();
    await costGuard();
    finish();
}

main().catch((e) => {
    ok('ការវាស់មិនគាំង', false, String(e && e.stack || e));
    finish();
}).finally(() => H?.stop());
