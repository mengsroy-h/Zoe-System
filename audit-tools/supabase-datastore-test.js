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

const ROOT = process.env.SUPABASE_DS_APP_DIR ? path.resolve(process.env.SUPABASE_DS_APP_DIR) : path.join(__dirname, '..');
const REPO = process.env.ZOE_REPO_ROOT ? path.resolve(process.env.ZOE_REPO_ROOT) : path.join(__dirname, '..');
const STRICT = process.env.SUPABASE_STRICT === '1';
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
const migrationFiles = fs.existsSync(MIGRATIONS_DIR) ? fs.readdirSync(MIGRATIONS_DIR).filter((f) => /^\d{14}_[a-z0-9_]+\.sql$/.test(f)).sort() : [];
const migrationSql = migrationFiles.map((f) => fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8')).join('\n;\n');
ok('migration ឃ្លាំងទិន្នន័យមាន (zoe_docs · zoe_write · zoe_pull)', /create table public\.zoe_docs/.test(migrationSql)
    && /create function public\.zoe_write\(/.test(migrationSql) && /create function public\.zoe_pull\(/.test(migrationSql));
const configText = fs.existsSync(path.join(ROOT, 'supabase', 'config.toml')) ? fs.readFileSync(path.join(ROOT, 'supabase', 'config.toml'), 'utf8') : '';
const wantMajor = parseInt((configText.match(/^major_version\s*=\s*(\d+)\s*$/m) || [])[1] || '0', 10);

const { createPgHarness } = require('./supabase-pg.js');
const H = createPgHarness({ depsDirs: DEPS_DIRS, shimDir: path.join(__dirname, 'supabase-shim'), wantMajor });
const { as, makeAuthUser, denied, raised } = H;

const STOP = Symbol('stop');
let opCounter = 0;
const newOp = () => 'op' + process.pid + 'x' + (++opCounter).toString(36).padStart(12, '0');
const future = () => new Date(Date.now() + 30 * 86400000).toISOString();

async function setupTenants(c) {
    const adminId = await makeAuthUser(c, 'boss@u.zoe.test');
    await c.query('insert into public.platform_admins (user_id) values ($1)', [adminId]);
    const ADMIN = { role: 'authenticated', sub: adminId };
    const SERVICE = { role: 'service_role' };
    const tenants = {};
    for (const [name, branch, user] of [['A', '881859', 'sokha'], ['B', '770001', 'dara']]) {
        const t = await as(c, ADMIN, 'select * from public.admin_create_tenant($1, $2, $3)', ['ហាង ' + name, branch, future()]);
        const inv = await as(c, ADMIN, "select * from public.admin_issue_invite($1, 'owner', 1, 24)", [t.rows[0].id]);
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
    try {
        try {
            await c.query(sql);
            applied = true;
        } catch (e) {
            rec('migration អនុវត្តបាន', false, e.message);
            return { results, applied };
        }
        await body(c, rec, extra);
    } catch (e) {
        if (e !== STOP) results.push({ label: 'suite មិនគាំង', pass: false, detail: String(e && e.stack || e).slice(0, 800) });
    } finally {
        for (const x of extra) try { await x.end(); } catch (e) {}
        try { await c.end(); } catch (e) {}
    }
    return { results, applied };
}

const MUTATIONS = [
    ['policy zoe_docs ➜ using (true)', 'create policy zoe_docs_select on public.zoe_docs for select to authenticated\n    using (tenant_id = (select private.current_tenant_id()));',
        'create policy zoe_docs_select on public.zoe_docs for select to authenticated\n    using (true);'],
    ['zoe_read មិនច្រោះ tenant + security definer (RLS លែងការពារ)', [
        ["create function public.zoe_read(p_root text, p_key text default null) returns jsonb\nlanguage plpgsql stable security invoker",
            "create function public.zoe_read(p_root text, p_key text default null) returns jsonb\nlanguage plpgsql stable security definer"],
        ["    from public.zoe_docs d\n    where d.tenant_id = tenant and d.root = p_root and (p_key is null or d.key = p_key)",
            "    from public.zoe_docs d\n    where d.root = p_root and (p_key is null or d.key = p_key)"]]],
    ['zoe_read ជា security definer តែនៅច្រោះ tenant (probe ទិសផ្ទុយ ៖ មិនមែនការលេចធ្លាយ)', [
        ["create function public.zoe_read(p_root text, p_key text default null) returns jsonb\nlanguage plpgsql stable security invoker",
            "create function public.zoe_read(p_root text, p_key text default null) returns jsonb\nlanguage plpgsql stable security definer"]], 'equivalent'],
    ['rules lookup មិនច្រោះ tenant', "        where z.tenant_id = tenant and z.root = snap_path[1] and z.key = snap_path[2];",
        "        where z.root = snap_path[1] and z.key = snap_path[2] order by (z.tenant_id = tenant) limit 1;"],
    ['canon មិនបម្លែង array', "    when 'array' then\n        for child in", "    when 'array_disabled' then\n        for child in"],
    ['canon មិនបដិសេធកូនសោហាម', "            if not private.zoe_key_ok(child_key) then\n                raise exception 'invalid_data' using errcode = '22023', detail = 'key';\n            end if;\n", ''],
    ['canon មិនបដិសេធលេខលើស double', "        if abs((p_value #>> '{}')::numeric) > 1.7976931348623157e308 then", "        if false then"],
    ['cas មិនប្រៀបតម្លៃ (doc)', "            current_value := coalesce((work -> doc_key) #> op_path[3:], 'null'::jsonb);\n            if current_value <> private.zoe_canon(op -> 'x') then",
        "            current_value := coalesce((work -> doc_key) #> op_path[3:], 'null'::jsonb);\n            if false then"],
    ['cas មិនប្រៀបតម្លៃ (node)', "                if current_value <> private.zoe_canon(op -> 'x') then", "                if false then"],
    ['set node មិនលុបកូនចាស់', "                work := jsonb_set(work, array[doc_key], coalesce(new_value -> substr(doc_key, char_length(op_path[1]) + 2), 'null'::jsonb));",
        "                work := jsonb_set(work, array[doc_key], coalesce(new_value -> substr(doc_key, char_length(op_path[1]) + 2), work -> doc_key));"],
    ['canon មិនបម្លែងលេខជា double', "        return to_jsonb((p_value #>> '{}')::float8);", "        return p_value;"],
    ['op_id មិន idempotent', "    if found then\n        return prior || jsonb_build_object('replayed', true, 'now', now_ms);\n    end if;", ''],
    ['មិនពិនិត្យ path ជាន់', "            if cardinality(a) <= cardinality(b) and b[1:cardinality(a)] = a then", "            if false then"],
    ['មិន enforce rules', "    if p_enforce then\n        rules := private.zoe_rules();", "    if false then\n        rules := private.zoe_rules();"],
    ['tombstone មិនបាន seq ថ្មី (delta ខកខានការលុប)', "            set value = excluded.value, seq = excluded.seq, updated_at = excluded.updated_at;",
        "            set value = excluded.value, seq = case when excluded.value is null then z.seq else excluded.seq end, updated_at = excluded.updated_at;"],
    ['pull ពី 0 រួម tombstone', "    where d.tenant_id = tenant and d.seq > since and d.seq <= upper_seq and (not full_sync or d.value is not null);",
        "    where d.tenant_id = tenant and d.seq > since and d.seq <= upper_seq;"],
    ['pull មិន reset លើ cursor ចាស់ជាង purge', "    if since < 0 or since > head or (since > 0 and since < purged) then", "    if since < 0 or since > head then"],
    ['paging កាត់ក្រុម seq', "    where d.tenant_id = tenant and d.seq > since and d.seq <= upper_seq and (not full_sync or d.value is not null);",
        "    where d.tenant_id = tenant and d.seq > since and d.seq <= upper_seq and (not full_sync or d.value is not null)\n"
        + "        and (d.root, d.key) in (select d2.root, d2.key from public.zoe_docs d2 where d2.tenant_id = tenant and d2.seq > since order by d2.seq, d2.key limit lim);"],
    ['housekeeping មិនកត់ purged_seq', "        update public.zoe_tenant_state s set purged_seq = greatest(s.purged_seq, purged) where s.tenant_id = p_tenant;\n", ''],
    ['គ្មាន tenant lock (for update)', "    select s.seq into head from public.zoe_tenant_state s where s.tenant_id = tenant for update;",
        "    select s.seq into head from public.zoe_tenant_state s where s.tenant_id = tenant;"],
    ['broadcast topic មិនមែនតាម tenant', "'seq', 'zoe:' || new.tenant_id::text, true);", "'seq', 'zoe:all', true);"],
    ['policy broadcast មិនពិនិត្យ topic', "                and (select realtime.topic()) = 'zoe:' || (select private.current_tenant_id())::text\n", ''],
    ['zoe_write មិនពិនិត្យ tenant សកម្ម', "    tenant uuid := private.current_tenant_id();\nbegin\n    if tenant is null then\n        raise exception 'forbidden' using errcode = '42501';\n    end if;\n    return private.zoe_apply(tenant,",
        "    tenant uuid := (select m.tenant_id from public.tenant_members m where m.user_id = auth.uid());\nbegin\n    if tenant is null then\n        raise exception 'forbidden' using errcode = '42501';\n    end if;\n    return private.zoe_apply(tenant,"],
    ['inc គិតជា decimal (ឃ្លាតពី RTDB double)', "then (current_value #>> '{}')::float8 else 0::float8 end + delta);", "then (current_value #>> '{}')::numeric else 0 end + delta::numeric);"],
    ['zoe_admin_write ឲ្យ authenticated', 'grant execute on function public.zoe_admin_write(uuid, text, jsonb, boolean) to service_role;',
        'grant execute on function public.zoe_admin_write(uuid, text, jsonb, boolean) to service_role, authenticated;']
];

async function rulesMigrationFreshness() {
    console.log('\n── ០. migration rules ↔ firebase-database.rules.json (ប្រភពតែមួយ) ──');
    const file = migrationFiles.find((f) => /_zoe_rules\.sql$/.test(f));
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

async function main() {
    await rulesMigrationFreshness();
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
    const { results } = await suite(migrationSql, false);
    for (const r of results) ok(r.label, r.pass, r.pass ? undefined : r.detail);
    ok('ការអះអាង >= ៦០ (ឃើញ ' + results.length + ')', results.length >= 60, results.length);

    console.log('\n── ២. mutation លើ migration ពិត ➜ អ្នកយាមត្រូវក្រហម ──');
    ok('mutation >= ១៥ (មាន ' + MUTATIONS.length + ')', MUTATIONS.length >= 15);
    for (const entry of MUTATIONS) {
        const label = entry[0];
        const pairs = Array.isArray(entry[1]) ? entry[1] : [[entry[1], entry[2]]];
        const equivalent = entry[2] === 'equivalent';
        let mutated = migrationSql;
        const badAnchor = pairs.map(([from]) => migrationSql.split(from).length - 1).find((n) => n !== 1);
        if (badAnchor !== undefined) {
            ok('mutation «' + label + '» ៖ anchor ត្រូវលេចម្តងគត់ (ឃើញ ' + badAnchor + ')', false);
            continue;
        }
        for (const [from, to] of pairs) mutated = mutated.replace(from, to);
        const r = await suite(mutated, !equivalent);
        const caught = r.results.filter((x) => !x.pass);
        if (equivalent) {
            ok('mutation «' + label + '» ➜ អ្នកយាមនៅបៃតង (ការការពារពិតនៅកន្លែងផ្សេង)', r.applied && caught.length === 0, caught.slice(0, 3).map((x) => x.label));
            continue;
        }
        ok('mutation «' + label + '» ➜ ' + (r.applied ? 'ចាប់ដោយ «' + (caught[0] ? caught[0].label : '—') + '»' : 'SQL អនុវត្តមិនបាន (មិនរាប់)'),
            r.applied && caught.length > 0);
    }
    finish();
}

main().catch((e) => {
    ok('ការវាស់មិនគាំង', false, String(e && e.stack || e));
    finish();
}).finally(() => H.stop());
