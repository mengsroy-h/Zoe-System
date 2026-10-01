// ថ្នាក់ ៖ **Supabase project តែមួយសម្រាប់អតិថិជនទាំងអស់ ➜ កំហុស RLS/grant តែមួយ = ទិន្នន័យអតិថិជនទាំងអស់លេចធ្លាយ។**
//
//   npm ci --prefix supabase            (Postgres 17 · pg · supabase-js · typescript)
//   node audit-tools/supabase-rls-test.js
//
// ⛔ វាស់លើ **Postgres ពិត** (កំណែ major ដូច `supabase/config.toml`) មិនមែន parser ទេ ៖
//   ១. ដំឡើង role · schema `auth` · default privileges ដូច Supabase ពិត (`audit-tools/supabase-shim/*.sql`
//      ចម្លងបេះបិទពី supabase/postgres និង supabase/auth ➜ `postgres` ត្រូវ demote · anon/authenticated ទទួល
//      grant លំនាំដើមលើតារាងថ្មីក្នុង `public` ➜ **RLS/grant របស់យើងជាអ្វីតែមួយដែលរាំង**)
//   ២. អនុវត្ត `supabase/migrations/*.sql` ពិត ជា `postgres` (មិនមែន superuser) ដូច SQL editor
//   ៣. ធ្វើត្រាប់ PostgREST ៖ `set local role <anon|authenticated|service_role>` + `request.jwt.claims`
//   ៤. រត់ **២ របៀប** ៖ (ក) grant លំនាំដើមបើក (Supabase ចាស់ · ករណីអាក្រក់) · (ខ) បិទ («មិន expose តារាងថ្មី»)
//      ➜ grant ច្បាស់លាស់របស់ migration គ្រប់គ្រាន់ ហើយ RLS រាំងទាំង ២ របៀប
//   ៥. **mutation** លើ migration ពិត ➜ អ្នកយាមត្រូវក្រហម (ភស្តុតាងថាវាធ្លាក់បាន) · mutation ដែលធ្វើឲ្យ SQL
//      លែងអនុវត្តបាន មិនរាប់ជា «ចាប់បាន» ទេ
//
// ⛔ បញ្ជីអ្នកមានសិទ្ធិ (តារាង · function) **ដេរីវេពី catalog ពិត** ➜ តារាង/function ថ្មីដែលមិនទាន់ចាត់ថ្នាក់ ➜ FAIL
//    (កុំបន្ថែមឈ្មោះក្នុង EXPECT ដោយគ្មានការសម្រេចថា role ណាគួរហៅវា)។
// ⛔ គ្មាន Postgres/pg ➜ SKIP (គ្មាន `SUPABASE_STRICT=1`) · `SUPABASE_STRICT=1` ➜ SKIP ក្លាយជា FAIL។
'use strict';

process.exitCode = 1;

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = process.env.SUPABASE_APP_DIR ? path.resolve(process.env.SUPABASE_APP_DIR) : path.join(__dirname, '..');
const REPO = process.env.ZOE_REPO_ROOT ? path.resolve(process.env.ZOE_REPO_ROOT) : path.join(__dirname, '..');
const STRICT = process.env.SUPABASE_STRICT === '1';
const MIGRATIONS_DIR = path.join(ROOT, 'supabase', 'migrations');
const SHIM_DIR = path.join(__dirname, 'supabase-shim');
const DEPS_DIRS = [process.env.SUPABASE_DEPS_DIR, path.join(ROOT, 'supabase', 'node_modules'), path.join(REPO, 'supabase', 'node_modules')]
    .filter(Boolean);

let pass = 0, fail = 0;
function ok(label, cond, detail) {
    if (cond) { pass++; console.log('  ok    ' + label); }
    else { fail++; console.log('  FAIL  ' + label + (detail !== undefined ? '\n        ' + JSON.stringify(detail) : '')); }
}
function skipOrFail(reason) {
    if (STRICT) {
        ok('SUPABASE_STRICT=1 ៖ ' + reason, false);
        finish();
        return;
    }
    console.log('SKIP — ' + reason + ' (រត់ ៖ npm ci --prefix supabase)');
    process.exitCode = 0;
}
function finish() {
    console.log('\n' + (fail === 0 ? '✅ ជោគជ័យទាំងអស់ ' + pass : '❌ ធ្លាក់ ' + fail + ' (ជោគជ័យ ' + pass + ')'));
    process.exitCode = fail === 0 ? 0 : 1;
}

const EXPECT_PUBLIC_EXEC = {
    my_account: ['authenticated'],
    admin_create_tenant: ['authenticated'],
    admin_update_tenant: ['authenticated'],
    admin_issue_invite: ['authenticated'],
    admin_revoke_invite: ['authenticated'],
    finish_registration: ['service_role'],
    invite_is_usable: ['service_role'],
    revoke_user_sessions: ['service_role'],
    admin_issue_reset_code: ['authenticated'],
    reset_code_user: ['service_role'],
    consume_reset_code: ['service_role'],
    zoe_write: ['authenticated'],
    zoe_read: ['authenticated'],
    zoe_pull: ['authenticated'],
    zoe_now: ['authenticated'],
    zoe_admin_write: ['service_role']
};
const EXPECT_PRIVATE_EXEC = {
    is_platform_admin: ['authenticated'],
    current_tenant_id: ['authenticated'],
    tenant_row_active: [],
    invite_row_usable: [],
    invite_code_normalize: [],
    invite_code_hash: [],
    reset_code_hash: [],
    new_invite_code: [],
    zoe_rules: [],
    zoe_now_ms: ['authenticated'],
    zoe_key_ok: [],
    zoe_canon: [],
    zoe_set_path: [],
    zoe_utf16_length: [],
    zoe_is_snap: [],
    zoe_snap_val: [],
    zoe_eval: [],
    zoe_rule_true: [],
    zoe_validate_tree: [],
    zoe_check_location: [],
    zoe_path_of: [],
    zoe_housekeeping: [],
    zoe_broadcast_seq: [],
    zoe_apply: [],
    zoe_root_value: []
};
const EXPECT_AUTH_SELECT = ['member_reset_codes', 'platform_admins', 'tenant_invites', 'tenant_members', 'tenants', 'zoe_docs', 'zoe_tenant_state'];
const API_ROLES = ['anon', 'authenticated', 'service_role'];
const TABLE_PRIVS = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'];
const INVITE_RE = /^[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){4}$/;

console.log('=== supabase-rls ៖ Postgres ពិត · RLS · grant · RPC · ការឆ្លង tenant · mutation ===');

const migrationFiles = fs.existsSync(MIGRATIONS_DIR)
    ? fs.readdirSync(MIGRATIONS_DIR).filter((f) => /^\d{14}_[a-z0-9_]+\.sql$/.test(f)).sort()
    : [];
ok('រកឃើញ migration >= 1 ក្នុង supabase/migrations (ឃើញ ' + migrationFiles.length + ')', migrationFiles.length >= 1);
const migrationSql = migrationFiles.map((f) => fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8')).join('\n;\n');

const configPath = path.join(ROOT, 'supabase', 'config.toml');
const configText = fs.existsSync(configPath) ? fs.readFileSync(configPath, 'utf8') : '';
const dbSection = (configText.split(/^\[/m).find((s) => /^db\]/.test(s)) || '');
const wantMajor = parseInt((dbSection.match(/^major_version\s*=\s*(\d+)\s*$/m) || [])[1] || '0', 10);
ok('supabase/config.toml ៖ [db] major_version ជាលេខ (' + wantMajor + ')', wantMajor >= 15, { wantMajor });

console.log('\n── ១. ស្តាទិច ៖ អត្តសញ្ញាណមិនមកពី metadata ដែលអ្នកប្រើកែបាន · ស្នាមភ្ជាប់នឹង ZTO ──');
ok('migration មិនអាន user_metadata/raw_user_meta_data (អ្នកប្រើកែវាបានដោយ auth.updateUser)',
    migrationSql.length > 0 && !/user_meta_data|user_metadata/i.test(migrationSql));
ok('migration មិនសម្រេចសិទ្ធិពី claim របស់ JWT (auth.jwt()) ➜ តែ auth.uid() + តារាងសមាជិក',
    migrationSql.length > 0 && !/auth\.jwt\s*\(/i.test(migrationSql));
const ztoFile = path.join(ROOT, 'ZoeW', 'netlify', 'functions', 'zto-order-detail.js');
const ztoSite = fs.existsSync(ztoFile)
    ? (fs.readFileSync(ztoFile, 'utf8').match(/^const LIST_SITE_CODE_RE = \/(.+)\/;$/m) || [])[1] : null;
const sqlSite = (migrationSql.match(/branch_code text not null unique check \(branch_code ~ '([^']+)'\)/) || [])[1] || null;
ok('branch_code ៖ check ក្នុង SQL ស្មើ LIST_SITE_CODE_RE របស់ Function ZTO (' + sqlSite + ')',
    !!ztoSite && !!sqlSite && ztoSite === sqlSite, { ztoSite, sqlSite });
for (const f of ['00-initial-schema.sql', '01-auth-schema.sql', '02-auth-functions.sql', '03-demote-postgres.sql', '04-auth-sessions.sql', '05-realtime.sql']) {
    ok('shim Supabase ៖ ' + f, fs.existsSync(path.join(SHIM_DIR, f)));
}

const { createPgHarness } = require('./supabase-pg.js');
const H = createPgHarness({ depsDirs: DEPS_DIRS, shimDir: SHIM_DIR, wantMajor });
const { connect, freshDb, as, makeAuthUser, denied, raised } = H;

if (fail > 0) {
    finish();
} else if (H.unavailableReason()) {
    skipOrFail(H.unavailableReason());
} else {
    main().catch((e) => {
        ok('ការវាស់មិនគាំង', false, String(e && e.stack || e));
        finish();
    }).finally(() => H.stop());
}

const STOP = Symbol('stop');
async function suite(mode, sql, stopOnFail) {
    const results = [];
    const rec = (label, cond, detail) => {
        results.push({ label, pass: !!cond, detail });
        if (!cond && stopOnFail) throw STOP;
    };
    const { c } = await freshDb(mode);
    const extra = [];
    let applied = false;
    try {
        try {
            await c.query(sql);
            applied = true;
        } catch (e) {
            rec('migration អនុវត្តបានជា postgres (មិនមែន superuser)', false, e.message);
            return { results, applied };
        }
        rec('migration អនុវត្តបានជា postgres (មិនមែន superuser)', true);
        await body(c, rec, extra, mode);
    } catch (e) {
        if (e !== STOP) results.push({ label: 'suite មិនគាំង', pass: false, detail: String(e && e.stack || e).slice(0, 800) });
    } finally {
        for (const x of extra) try { await x.end(); } catch (e) {}
        try { await c.end(); } catch (e) {}
    }
    return { results, applied };
}

let inviteTs = null;

async function body(c, rec, extra, mode) {
    const one = async (q, p) => (await c.query(q, p)).rows;

    const tables = await one(`select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind in ('r', 'p') order by 1`);
    rec('តារាងក្នុង public >= ៤ (ឃើញ ' + tables.length + ')', tables.length >= 4);
    rec('រាល់តារាងក្នុង public បើក RLS', tables.length > 0 && tables.every((t) => t.relrowsecurity),
        tables.filter((t) => !t.relrowsecurity).map((t) => t.relname));
    const privRows = await one(`select c.relname, r.rolname, p.priv,
            has_table_privilege(r.rolname, c.oid, p.priv) as t,
            (case when p.priv in ('SELECT', 'INSERT', 'UPDATE', 'REFERENCES') then has_any_column_privilege(r.rolname, c.oid, p.priv) else false end) as col
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
        cross join (select rolname from pg_roles where rolname = any($1)) r
        cross join unnest($2::text[]) as p(priv)
        where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm')`, [API_ROLES, TABLE_PRIVS]);
    const held = privRows.filter((x) => x.t || x.col).map((x) => x.rolname + ':' + x.priv + ':' + x.relname);
    const heldAnon = held.filter((x) => x.startsWith('anon:'));
    const heldService = held.filter((x) => x.startsWith('service_role:'));
    const heldAuthWrite = held.filter((x) => x.startsWith('authenticated:') && !x.startsWith('authenticated:SELECT:'));
    const heldAuthRead = held.filter((x) => x.startsWith('authenticated:SELECT:')).map((x) => x.split(':')[2]).sort();
    rec('anon គ្មានសិទ្ធិលើតារាងណាមួយ (ទាំងកម្រិតជួរឈរ)', privRows.length > 0 && heldAnon.length === 0, heldAnon);
    rec('service_role គ្មានសិទ្ធិលើតារាងដោយផ្ទាល់ (ប្រើតែ RPC)', privRows.length > 0 && heldService.length === 0, heldService);
    rec('authenticated គ្មានសិទ្ធិសរសេរតារាងដោយផ្ទាល់ (សរសេរតែតាម RPC)', privRows.length > 0 && heldAuthWrite.length === 0, heldAuthWrite);
    rec('authenticated អានបានតែតារាងដែលមាន policy ៖ ' + EXPECT_AUTH_SELECT.join(', '),
        JSON.stringify(heldAuthRead) === JSON.stringify(EXPECT_AUTH_SELECT), heldAuthRead);
    const pols = await one(`select c.relname, p.polname, p.polroles::regrole[]::text[] as roles, p.polcmd
        from pg_policy p join pg_class c on c.oid = p.polrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public'`);
    const badPols = pols.filter((p) => p.polcmd !== 'r' || p.roles.length !== 1 || p.roles[0] !== 'authenticated');
    rec('policy ទាំង ' + pols.length + ' ជា SELECT សម្រាប់ authenticated តែប៉ុណ្ណោះ (គ្មាន PUBLIC · គ្មាន policy សរសេរ)',
        pols.length >= 4 && badPols.length === 0, badPols);
    const views = await one(`select c.relname, coalesce(c.reloptions, '{}') as opts from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'v'`);
    const badViews = views.filter((v) => !v.opts.some((o) => /^security_invoker=(true|on|1)$/.test(o)));
    rec('រាល់ view ក្នុង public មាន security_invoker (view រំលង RLS តាមលំនាំដើម) ៖ ' + views.length, badViews.length === 0, badViews);

    const fns = await one(`select n.nspname, p.proname, p.prosecdef, coalesce(p.proconfig, '{}') as cfg,
            array(select r.rolname from pg_roles r where r.rolname = any($1) and has_function_privilege(r.rolname, p.oid, 'EXECUTE') order by 1)::text[] as exec
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public', 'private') order by 1, 2`, [API_ROLES]);
    rec('function ក្នុង public/private >= ១០ (ឃើញ ' + fns.length + ')', fns.length >= 10);
    const unclassified = fns.filter((f) => !((f.nspname === 'public' ? EXPECT_PUBLIC_EXEC : EXPECT_PRIVATE_EXEC)[f.proname]));
    rec('រាល់ function ត្រូវចាត់ថ្នាក់ក្នុង EXPECT (function ថ្មី ➜ សម្រេចសិទ្ធិជាមុន)', unclassified.length === 0,
        unclassified.map((f) => f.nspname + '.' + f.proname));
    const wrongExec = fns.filter((f) => {
        const want = (f.nspname === 'public' ? EXPECT_PUBLIC_EXEC : EXPECT_PRIVATE_EXEC)[f.proname];
        return want && JSON.stringify(f.exec) !== JSON.stringify(want.slice().sort());
    }).map((f) => f.nspname + '.' + f.proname + ' ➜ ' + f.exec.join(','));
    rec('EXECUTE ស្មើការចាត់ថ្នាក់គ្រប់ function (anon ហៅអ្វីមិនបាន)', wrongExec.length === 0, wrongExec);
    const lostPath = fns.filter((f) => f.prosecdef && !f.cfg.some((x) => /^search_path=("")?$/.test(x)));
    rec('រាល់ SECURITY DEFINER មាន search_path = \'\' (ការពារការចាប់យក schema)', lostPath.length === 0,
        lostPath.map((f) => f.nspname + '.' + f.proname));
    const schemaUse = await one(`select r.rolname, has_schema_privilege(r.rolname, 'private', 'USAGE') as u
        from pg_roles r where r.rolname = any($1) order by 1`, [API_ROLES]);
    rec('schema private ៖ USAGE តែ authenticated',
        JSON.stringify(schemaUse.filter((x) => x.u).map((x) => x.rolname)) === '["authenticated"]', schemaUse);

    const adminId = await makeAuthUser(c, 'boss@u.zoe.test');
    await c.query('insert into public.platform_admins (user_id) values ($1)', [adminId]);
    const plainId = await makeAuthUser(c, 'plain@u.zoe.test');
    const ADMIN = { role: 'authenticated', sub: adminId };
    const PLAIN = { role: 'authenticated', sub: plainId };
    const ANON = { role: 'anon' };
    const SERVICE = { role: 'service_role' };
    const future = new Date(Date.now() + 30 * 86400000).toISOString();

    rec('anon ៖ admin_create_tenant ➜ permission denied',
        denied(await as(c, ANON, 'select * from public.admin_create_tenant($1, $2, $3)', ['X', 'x1', future])));
    rec('authenticated មិនមែន admin ៖ admin_create_tenant ➜ forbidden',
        raised(await as(c, PLAIN, 'select * from public.admin_create_tenant($1, $2, $3)', ['X', 'x1', future]), 'forbidden'));
    const tA = await as(c, ADMIN, 'select * from public.admin_create_tenant($1, $2, $3)', ['ហាង A', '881859', future]);
    const tB = await as(c, ADMIN, 'select * from public.admin_create_tenant($1, $2, $3)', ['ហាង B', '770001', future]);
    rec('admin បង្កើត tenant ២', !!(tA.rows && tB.rows), [tA.error, tB.error]);
    const A = tA.rows[0].id, B = tB.rows[0].id;
    rec('branch_code ស្ទួន ➜ branch-taken',
        raised(await as(c, ADMIN, 'select * from public.admin_create_tenant($1, $2, $3)', ['ស្ទួន', '881859', future]), 'branch-taken'));
    rec('ថ្ងៃផុតកំណត់អតីតកាល ➜ expires-invalid',
        raised(await as(c, ADMIN, 'select * from public.admin_create_tenant($1, $2, $3)', ['ចាស់', 'old1', '2020-01-01T00:00:00Z']), 'expires-invalid'));
    rec('branch_code មានតួអក្សរហាម ➜ tenant-invalid',
        raised(await as(c, ADMIN, 'select * from public.admin_create_tenant($1, $2, $3)', ['ខុស', 'bad code!', future]), 'tenant-invalid'));

    const issue = async (who, tenant, role, uses, hours) =>
        as(c, who, 'select * from public.admin_issue_invite($1, $2, $3, $4)', [tenant, role, uses, hours]);
    rec('authenticated មិនមែន admin ៖ admin_issue_invite ➜ forbidden', raised(await issue(PLAIN, A, 'member', 1, 24), 'forbidden'));
    rec('anon ៖ admin_issue_invite ➜ permission denied', denied(await issue(ANON, A, 'member', 1, 24)));
    rec('max_uses លើស ៥០ ➜ invite-invalid', raised(await issue(ADMIN, A, 'member', 51, 24), 'invite-invalid'));
    const inv1 = await issue(ADMIN, A, 'owner', 1, 72);
    rec('admin ចេញកូដអញ្ជើញ ៖ ទម្រង់ XXXX-XXXX-XXXX-XXXX-XXXX', !!inv1.rows && INVITE_RE.test(inv1.rows[0].code), inv1);
    const code1 = inv1.rows[0].code;
    const stored = await one('select code_hash from public.tenant_invites');
    rec('កូដអញ្ជើញមិនរក្សាជាអក្សរធម្មតា (តែ hash ៦៤ ខ្ទង់)', stored.length === 1 && /^[0-9a-f]{64}$/.test(stored[0].code_hash)
        && !JSON.stringify(stored).includes(code1.replace(/-/g, '')));

    const batch = await as(c, ADMIN, `select i.code from generate_series(1, 300) g
        cross join lateral public.admin_issue_invite($1, 'member', 1, 1 + 0 * g) i`, [B]);
    const codes = (batch.rows || []).map((r) => r.code.replace(/-/g, ''));
    rec('ចេញកូដ ៣០០ ៖ មិនស្ទួនទាំងអស់', codes.length === 300 && new Set(codes).size === 300, codes.length);
    let minDistinct = 99;
    for (let i = 0; i < 20; i++) minDistinct = Math.min(minDistinct, new Set(codes.map((x) => x[i])).size);
    const counts = {};
    for (const x of codes) for (const ch of x) counts[ch] = (counts[ch] || 0) + 1;
    const freq = Object.values(counts);
    rec('កូដ ៣០០ ៖ រាល់ទីតាំងប្រើតួអក្សរ >= ២៦/៣២ (គ្មាន bit ថេរ · ឃើញ ' + minDistinct + ')', minDistinct >= 26, minDistinct);
    rec('កូដ ៣០០ ៖ ប្រេកង់តួអក្សរស្មើៗ (៩០–២៩០ ក្នុងមួយតួ)', freq.length === 32 && Math.min(...freq) >= 90 && Math.max(...freq) <= 290,
        { distinct: freq.length, min: Math.min(...freq), max: Math.max(...freq) });

    const norm = inviteTs.normalizeInviteCode(code1);
    const tsHash = norm ? await inviteTs.inviteCodeHash(norm) : null;
    rec('ស្នាមភ្ជាប់ TS ↔ SQL ៖ inviteCodeHash(normalizeInviteCode(កូដ)) ស្មើ hash ដែល DB រក្សា',
        !!tsHash && stored[0].code_hash === tsHash, { tsHash, db: stored[0].code_hash });
    const variants = [code1.toLowerCase(), code1.replace(/-/g, ' '), code1.replace(/0/g, 'O').replace(/1/g, 'l'), ' ' + code1.replace(/-/g, '') + ' '];
    let variantOk = true;
    for (const v of variants) {
        const n = inviteTs.normalizeInviteCode(v);
        const h = n ? await inviteTs.inviteCodeHash(n) : null;
        const s = (await one('select private.invite_code_hash($1) as h', [v]))[0].h;
        if (h !== tsHash || s !== tsHash) variantOk = false;
    }
    rec('ស្នាមភ្ជាប់ TS ↔ SQL ៖ អក្សរតូច · ចន្លោះ · O/l ជំនួស 0/1 ➜ hash ដដែលទាំង ២ ខាង', variantOk);

    const hashOf = async (code) => inviteTs.inviteCodeHash(inviteTs.normalizeInviteCode(code));
    const usable = async (who, hash) => {
        const r = await as(c, who, 'select public.invite_is_usable($1) as u', [hash]);
        return r.rows ? r.rows[0].u : r;
    };
    const finishReg = (who, uid, hash, username) =>
        as(c, who, 'select * from public.finish_registration($1, $2, $3)', [uid, hash, username]);
    const h1 = await hashOf(code1);
    const uA1 = await makeAuthUser(c, 'sokha@u.zoe.test');
    rec('anon ៖ finish_registration ➜ permission denied', denied(await finishReg(ANON, uA1, h1, 'sokha')));
    rec('authenticated ៖ finish_registration ➜ permission denied (ចុះឈ្មោះខ្លួនឯងចូល tenant ណាក៏បាន)',
        denied(await finishReg({ role: 'authenticated', sub: uA1 }, uA1, h1, 'sokha')));
    rec('គណនីដែល email មិនស្មើ username ➜ user-mismatch',
        raised(await finishReg(SERVICE, uA1, h1, 'other'), 'user-mismatch'));
    rec('invite_is_usable ៖ កូដថ្មី ➜ true', (await usable(SERVICE, h1)) === true);
    rec('invite_is_usable ៖ hash មិនស្គាល់ ➜ false', (await usable(SERVICE, '0'.repeat(64))) === false);
    rec('invite_is_usable ៖ anon ➜ permission denied', denied(await as(c, ANON, 'select public.invite_is_usable($1)', [h1])));
    rec('invite_is_usable ៖ authenticated ➜ permission denied (ការទាយកូដដោយផ្ទាល់)',
        denied(await as(c, PLAIN, 'select public.invite_is_usable($1)', [h1])));
    const reg1 = await finishReg(SERVICE, uA1, h1, 'sokha');
    rec('service_role ៖ ចុះឈ្មោះ ➜ tenant A · role តាមកូដ (owner)',
        !!reg1.rows && reg1.rows[0].tenant_id === A && reg1.rows[0].role === 'owner', reg1);
    const again = await finishReg(SERVICE, uA1, h1, 'sokha');
    const usedAgain = (await one('select used_count from public.tenant_invites where code_hash = $1', [h1]))[0].used_count;
    rec('finish_registration idempotent ៖ ហៅម្តងទៀត (ការឆ្លើយបាត់) ➜ លទ្ធផលដដែល · used_count នៅ 1',
        !!again.rows && again.rows[0].tenant_id === A && again.rows[0].role === 'owner' && usedAgain === 1, { again, usedAgain });
    const uA2 = await makeAuthUser(c, 'vanna@u.zoe.test');
    rec('កូដប្រើម្តងរួច ➜ invite-invalid', raised(await finishReg(SERVICE, uA2, h1, 'vanna'), 'invite-invalid'));
    rec('invite_is_usable ៖ កូដប្រើអស់ ➜ false', (await usable(SERVICE, h1)) === false);

    const inv2 = await issue(ADMIN, A, 'member', 2, 24);
    const h2 = await hashOf(inv2.rows[0].code);
    const uSokha2 = await makeAuthUser(c, 'sokha@x.zoe.test');
    rec('username ស្ទួន ➜ username-taken', raised(await finishReg(SERVICE, uSokha2, h2, 'sokha'), 'username-taken'));
    const usedAfterFail = (await one('select used_count from public.tenant_invites where code_hash = $1', [h2]))[0].used_count;
    rec('ការចុះឈ្មោះធ្លាក់ ➜ used_count មិនកើន (atomic)', usedAfterFail === 0, usedAfterFail);
    const uShort = await makeAuthUser(c, 'ab@u.zoe.test');
    rec('username ខ្លីពេក ➜ account-invalid', raised(await finishReg(SERVICE, uShort, h2, 'ab'), 'account-invalid'));
    const uBadName = await makeAuthUser(c, 'bad-name@u.zoe.test');
    rec('username មានតួហាម (-) ➜ account-invalid', raised(await finishReg(SERVICE, uBadName, h2, 'bad-name'), 'account-invalid'));
    rec('max_uses=2 ៖ លើកទី ១ ជោគជ័យ', !!(await finishReg(SERVICE, uA2, h2, 'vanna')).rows);
    const uA3 = await makeAuthUser(c, 'chan@u.zoe.test');
    rec('max_uses=2 ៖ លើកទី ២ ជោគជ័យ', !!(await finishReg(SERVICE, uA3, h2, 'chan')).rows);
    const uA4 = await makeAuthUser(c, 'dara4@u.zoe.test');
    rec('max_uses=2 ៖ លើកទី ៣ ➜ invite-invalid', raised(await finishReg(SERVICE, uA4, h2, 'dara4'), 'invite-invalid'));

    const inv3 = await issue(ADMIN, A, 'member', 1, 1);
    const h3 = await hashOf(inv3.rows[0].code);
    await c.query("update public.tenant_invites set expires_at = now() - interval '1 second' where code_hash = $1", [h3]);
    rec('កូដផុតកំណត់ ➜ invite-invalid', raised(await finishReg(SERVICE, uA4, h3, 'dara4'), 'invite-invalid'));
    rec('invite_is_usable ៖ កូដផុតកំណត់ ➜ false', (await usable(SERVICE, h3)) === false);
    const inv4 = await issue(ADMIN, A, 'member', 1, 24);
    const h4 = await hashOf(inv4.rows[0].code);
    rec('admin_revoke_invite ៖ អ្នកមិនមែន admin ➜ forbidden', raised(await as(c, PLAIN, 'select public.admin_revoke_invite($1)', [h4]), 'forbidden'));
    await as(c, ADMIN, 'select public.admin_revoke_invite($1)', [h4]);
    rec('កូដដែល revoke ➜ invite-invalid', raised(await finishReg(SERVICE, uA4, h4, 'dara4'), 'invite-invalid'));
    rec('invite_is_usable ៖ កូដដែល revoke ➜ false', (await usable(SERVICE, h4)) === false);

    const invB = await issue(ADMIN, B, 'member', 1, 24);
    const uB1 = await makeAuthUser(c, 'dara@u.zoe.test');
    const regB = await finishReg(SERVICE, uB1, await hashOf(invB.rows[0].code), 'dara');
    rec('ចុះឈ្មោះ tenant B', !!regB.rows && regB.rows[0].tenant_id === B, regB);

    const WA = { role: 'authenticated', sub: uA1 };
    const WB = { role: 'authenticated', sub: uB1 };
    const seeTenants = async (who) => ((await as(c, who, 'select id from public.tenants order by id')).rows || []).map((r) => r.id);
    rec('សមាជិក A ឃើញតែ tenant A', JSON.stringify(await seeTenants(WA)) === JSON.stringify([A]));
    rec('សមាជិក B ឃើញតែ tenant B', JSON.stringify(await seeTenants(WB)) === JSON.stringify([B]));
    const membersA = (await as(c, WA, 'select user_id from public.tenant_members')).rows || [];
    rec('សមាជិក A ឃើញតែជួរសមាជិករបស់ខ្លួន (មិនឃើញ username អ្នកដទៃ)', membersA.length === 1 && membersA[0].user_id === uA1, membersA);
    rec('សមាជិក A មិនឃើញកូដអញ្ជើញ', ((await as(c, WA, 'select 1 from public.tenant_invites')).rows || [1]).length === 0);
    rec('សមាជិក A មិនឃើញកូដកំណត់ពាក្យសម្ងាត់', ((await as(c, WA, 'select 1 from public.member_reset_codes')).rows || [1]).length === 0);
    rec('សមាជិក A មិនឃើញបញ្ជី admin', ((await as(c, WA, 'select 1 from public.platform_admins')).rows || [1]).length === 0);
    const accA = (await as(c, WA, 'select * from public.my_account()')).rows || [];
    rec('my_account() ៖ A · សាខា 881859 · active', accA.length === 1 && accA[0].tenant_id === A && accA[0].branch_code === '881859'
        && accA[0].status === 'active' && accA[0].username === 'sokha', accA);
    rec('anon ៖ អានតារាង ➜ permission denied', denied(await as(c, ANON, 'select * from public.tenants')));
    rec('anon ៖ my_account() ➜ permission denied', denied(await as(c, ANON, 'select * from public.my_account()')));
    rec('អ្នកគ្មានសមាជិកភាព ៖ ឃើញ tenant ០ · my_account ទទេ', (await seeTenants(PLAIN)).length === 0
        && ((await as(c, PLAIN, 'select * from public.my_account()')).rows || [1]).length === 0);

    const FORGED = { role: 'authenticated', sub: uA1, extra: {
        app_metadata: { tenant_id: B, branch_code: '770001', role: 'owner' },
        user_metadata: { tenant_id: B, branch_code: '770001' }, tenant_id: B, branch_code: '770001', is_admin: true } };
    rec('claim ក្លែង (app/user_metadata · tenant_id · branch_code របស់ B) ➜ នៅឃើញតែ A',
        JSON.stringify(await seeTenants(FORGED)) === JSON.stringify([A]));
    const accForged = (await as(c, FORGED, 'select branch_code from public.my_account()')).rows || [];
    rec('claim ក្លែង ➜ my_account() នៅរាយសាខា A', accForged.length === 1 && accForged[0].branch_code === '881859', accForged);
    rec('claim role=service_role ក្នុង JWT តែ DB role authenticated ➜ finish_registration នៅបដិសេធ',
        denied(await finishReg({ role: 'authenticated', sub: uA1, extra: { role: 'service_role' } }, uA1, h1, 'sokha')));

    const dml = [
        ['insert tenants', "insert into public.tenants (name, branch_code, expires_at) values ('x', 'zz9', now() + interval '1 day')"],
        ['update tenants ពន្យារខ្លួនឯង', "update public.tenants set expires_at = now() + interval '10 years'"],
        ['update tenant_members ប្តូរ tenant', 'update public.tenant_members set tenant_id = $1', [B]],
        ['insert tenant_members ចូល B', "insert into public.tenant_members (user_id, tenant_id, username) values ($1, $2, 'zzz')", [uA4, B]],
        ['insert member_reset_codes ដោយខ្លួនឯង', "insert into public.member_reset_codes (code_hash, user_id, expires_at) values (repeat('a', 64), $1, now() + interval '1 day')", [uA1]],
        ['insert platform_admins ឡើងសិទ្ធិខ្លួនឯង', 'insert into public.platform_admins (user_id) values ($1)', [uA1]],
        ['delete tenant_members', 'delete from public.tenant_members'],
        ['update tenant_invites', 'update public.tenant_invites set used_count = 0']
    ];
    for (const [label, q, p] of dml) {
        rec('សមាជិក A ៖ ' + label + ' ➜ permission denied', denied(await as(c, WA, q, p || [])));
    }
    rec('សមាជិក A ៖ admin_update_tenant (ពន្យារខ្លួនឯង) ➜ forbidden',
        raised(await as(c, WA, 'select * from public.admin_update_tenant($1, null, null, $2, null)', [A, '2099-01-01T00:00:00Z']), 'forbidden'));
    rec('សមាជិក A ៖ reset_code_user ➜ permission denied (ទាយកូដដោយផ្ទាល់)',
        denied(await as(c, WA, 'select public.reset_code_user($1, $2)', ['dara', '0'.repeat(64)])));
    rec('សមាជិក A ៖ consume_reset_code ➜ permission denied',
        denied(await as(c, WA, 'select public.consume_reset_code($1, $2)', ['dara', '0'.repeat(64)])));
    rec('សមាជិក A ៖ admin_issue_reset_code (យកគណនីអ្នកដទៃ) ➜ forbidden',
        raised(await as(c, WA, 'select * from public.admin_issue_reset_code($1, 24)', ['dara']), 'forbidden'));
    const adminSees = (await as(c, ADMIN, 'select count(*)::int as n from public.tenants')).rows;
    rec('admin ឃើញ tenant ទាំងអស់', !!adminSees && adminSees[0].n >= 2, adminSees);

    await as(c, ADMIN, 'select * from public.admin_update_tenant($1, null, null, null, true)', [A]);
    rec('Revoke A ➜ សមាជិក A ឃើញ tenant ០ ភ្លាម (មិនរង់ចាំ JWT ផុត)', (await seeTenants(WA)).length === 0);
    rec('Revoke A ➜ my_account().status = revoked', ((await as(c, WA, 'select status from public.my_account()')).rows || [{}])[0].status === 'revoked');
    rec('Revoke A ➜ ចេញកូដអញ្ជើញមិនបាន (tenant-inactive)', raised(await issue(ADMIN, A, 'member', 1, 24), 'tenant-inactive'));
    rec('Revoke A ➜ B មិនប៉ះ', JSON.stringify(await seeTenants(WB)) === JSON.stringify([B]));
    await as(c, ADMIN, 'select * from public.admin_update_tenant($1, null, null, null, false)', [A]);
    rec('បើកវិញ ➜ សមាជិក A ឃើញ A វិញ', JSON.stringify(await seeTenants(WA)) === JSON.stringify([A]));
    await c.query("update public.tenants set expires_at = now() - interval '1 second' where id = $1", [A]);
    rec('ផុតកំណត់ ➜ សមាជិក A ឃើញ tenant ០', (await seeTenants(WA)).length === 0);
    rec('ផុតកំណត់ ➜ my_account().status = expired', ((await as(c, WA, 'select status from public.my_account()')).rows || [{}])[0].status === 'expired');
    const invExp = await as(c, ADMIN, "select * from public.admin_issue_invite($1, 'member', 1, 24)", [A]);
    rec('ផុតកំណត់ ➜ ចេញកូដអញ្ជើញមិនបាន', raised(invExp, 'tenant-inactive'));
    const extend = await as(c, ADMIN, 'select * from public.admin_update_tenant($1, null, null, $2, null)', [A, future]);
    rec('admin ពន្យារ ➜ សមាជិក A ឃើញ A វិញ', !!extend.rows && JSON.stringify(await seeTenants(WA)) === JSON.stringify([A]));
    rec('admin_update_tenant ប្តូរ branch ទៅស្ទួន ➜ branch-taken',
        raised(await as(c, ADMIN, 'select * from public.admin_update_tenant($1, null, $2, null, null)', [A, '770001']), 'branch-taken'));

    const invPending = await issue(ADMIN, A, 'member', 1, 24);
    const hPending = await hashOf(invPending.rows[0].code);
    await c.query("update public.tenants set expires_at = now() - interval '1 second' where id = $1", [A]);
    const uA5 = await makeAuthUser(c, 'late@u.zoe.test');
    rec('កូដនៅរស់ តែ tenant ផុតកំណត់ ➜ invite-invalid', raised(await finishReg(SERVICE, uA5, hPending, 'late'), 'invite-invalid'));
    rec('invite_is_usable ៖ tenant ផុតកំណត់ ➜ false', (await usable(SERVICE, hPending)) === false);
    await c.query('update public.tenants set expires_at = $2, revoked = true where id = $1', [A, future]);
    rec('invite_is_usable ៖ tenant revoke ➜ false', (await usable(SERVICE, hPending)) === false);
    rec('កូដនៅរស់ តែ tenant revoke ➜ invite-invalid', raised(await finishReg(SERVICE, uA5, hPending, 'late'), 'invite-invalid'));
    await c.query('update public.tenants set revoked = false where id = $1', [A]);
    rec('tenant សកម្មវិញ ➜ invite_is_usable ➜ true', (await usable(SERVICE, hPending)) === true);
    await c.query('update public.tenants set expires_at = $2 where id = $1', [A, future]);

    const issueReset = (who, username, hours) => as(c, who, 'select * from public.admin_issue_reset_code($1, $2)', [username, hours]);
    const resetUser = async (username, hash) => {
        const r = await as(c, SERVICE, 'select public.reset_code_user($1, $2) as id', [username, hash]);
        return r.rows ? r.rows[0].id : r;
    };
    const resetHashOf = async (code) => inviteTs.resetCodeHash(inviteTs.normalizeInviteCode(code));
    rec('anon ៖ admin_issue_reset_code ➜ permission denied', denied(await issueReset(ANON, 'sokha', 24)));
    rec('admin_issue_reset_code ៖ username មិនមាន ➜ member-not-found', raised(await issueReset(ADMIN, 'nobody', 24), 'member-not-found'));
    rec('admin_issue_reset_code ៖ ម៉ោងលើស ១៦៨ ➜ reset-invalid', raised(await issueReset(ADMIN, 'sokha', 169), 'reset-invalid'));
    const rs1 = await issueReset(ADMIN, ' SoKha ', 24);
    rec('admin_issue_reset_code ៖ ទម្រង់ XXXX-XXXX-XXXX-XXXX-XXXX · username តូច/ចន្លោះ ➜ ដដែល', !!rs1.rows && INVITE_RE.test(rs1.rows[0].code), rs1);
    const rsCode1 = rs1.rows[0].code;
    const rsHash1 = await resetHashOf(rsCode1);
    const rsStored = await one('select code_hash from public.member_reset_codes');
    rec('កូដកំណត់ថ្មីមិនរក្សាជាអក្សរធម្មតា · ស្នាមភ្ជាប់ TS ↔ SQL (resetCodeHash)',
        rsStored.length === 1 && rsStored[0].code_hash === rsHash1 && !JSON.stringify(rsStored).includes(rsCode1.replace(/-/g, '')), { rsStored, rsHash1 });
    const sameAsInvite = await hashOf(rsCode1);
    rec('កូដកំណត់ថ្មី ≠ កូដអញ្ជើញ (prefix hash ផ្សេង) ➜ ប្រើជាកូដអញ្ជើញមិនបាន',
        sameAsInvite !== rsHash1 && (await usable(SERVICE, sameAsInvite)) === false);
    rec('សមាជិក A (ម្ចាស់គណនី) មិនឃើញកូដកំណត់ថ្មីដែលមានក្នុង DB · admin ឃើញ',
        ((await as(c, WA, 'select 1 from public.member_reset_codes')).rows || [1]).length === 0
        && ((await as(c, ADMIN, 'select 1 from public.member_reset_codes')).rows || []).length === 1);
    rec('reset_code_user ៖ username + កូដត្រូវ ➜ user id', (await resetUser('sokha', rsHash1)) === uA1);
    rec('reset_code_user ៖ កូដត្រូវ តែ username អ្នកដទៃ ➜ null', (await resetUser('dara', rsHash1)) === null);
    rec('reset_code_user ៖ hash មិនស្គាល់ ➜ null', (await resetUser('sokha', '0'.repeat(64))) === null);
    const rs2 = await issueReset(ADMIN, 'sokha', 24);
    const rsHash2 = await resetHashOf(rs2.rows[0].code);
    rec('ចេញកូដថ្មី ➜ កូដចាស់របស់សមាជិកនោះលែងប្រើបាន', (await resetUser('sokha', rsHash1)) === null && (await resetUser('sokha', rsHash2)) === uA1);
    const consume = async (username, hash) => {
        const r = await as(c, SERVICE, 'select public.consume_reset_code($1, $2) as ok', [username, hash]);
        return r.rows ? r.rows[0].ok : r;
    };
    rec('consume_reset_code ៖ username ខុស ➜ false · កូដនៅប្រើបាន', (await consume('dara', rsHash2)) === false && (await resetUser('sokha', rsHash2)) === uA1);
    rec('consume_reset_code ៖ ត្រូវ ➜ true', (await consume('sokha', rsHash2)) === true);
    rec('consume_reset_code idempotent ៖ ហៅម្តងទៀត (ការឆ្លើយបាត់) ➜ true', (await consume('sokha', rsHash2)) === true);
    rec('កូដដែលប្រើរួច ➜ reset_code_user ➜ null', (await resetUser('sokha', rsHash2)) === null);
    const rs3 = await issueReset(ADMIN, 'sokha', 1);
    const rsHash3 = await resetHashOf(rs3.rows[0].code);
    await c.query("update public.member_reset_codes set expires_at = now() - interval '1 second' where code_hash = $1", [rsHash3]);
    rec('កូដកំណត់ថ្មីផុតកំណត់ ➜ null', (await resetUser('sokha', rsHash3)) === null);

    const addSession = async (uid, n) => {
        for (let i = 0; i < n; i++) {
            const sid = (await one('insert into auth.sessions (id, user_id, created_at) values (gen_random_uuid(), $1, now()) returning id', [uid]))[0].id;
            await one("insert into auth.refresh_tokens (token, user_id, session_id, revoked, created_at) values (md5(random()::text), $1, $2, false, now())", [String(uid), sid]);
        }
    };
    await addSession(uA1, 2);
    await addSession(uB1, 1);
    rec('revoke_user_sessions ៖ anon ➜ permission denied', denied(await as(c, ANON, 'select public.revoke_user_sessions($1)', [uA1])));
    rec('revoke_user_sessions ៖ authenticated (សូម្បីម្ចាស់ខ្លួន) ➜ permission denied', denied(await as(c, WA, 'select public.revoke_user_sessions($1)', [uB1])));
    const revoked = await as(c, SERVICE, 'select public.revoke_user_sessions($1) as n', [uA1]);
    const left = await one(`select (select count(*)::int from auth.sessions where user_id = $1) as a,
        (select count(*)::int from auth.refresh_tokens where user_id = $3) as ar,
        (select count(*)::int from auth.sessions where user_id = $2) as b,
        (select count(*)::int from auth.refresh_tokens where user_id = $4) as br`, [uA1, uB1, String(uA1), String(uB1)]);
    rec('revoke_user_sessions ៖ ផ្តាច់ session ២ របស់ A · refresh token ធ្លាក់តាម (cascade) · B មិនប៉ះ',
        !!revoked.rows && revoked.rows[0].n === 2 && left[0].a === 0 && left[0].ar === 0 && left[0].b === 1 && left[0].br === 1, { revoked, left });
    await c.query('delete from auth.users where id = $1', [uA3]);
    const gone = await one('select 1 from public.tenant_members where user_id = $1', [uA3]);
    rec('លុបគណនី auth ➜ សមាជិកភាពបាត់ (on delete cascade · ផ្លូវ rollback របស់ Edge Function)', gone.length === 0);

    const invRace = await issue(ADMIN, B, 'member', 1, 24);
    const hRace = await hashOf(invRace.rows[0].code);
    const r1 = await makeAuthUser(c, 'race1@u.zoe.test');
    const r2 = await makeAuthUser(c, 'race2@u.zoe.test');
    const c1 = await connect('postgres', c.database);
    const c2 = await connect('postgres', c.database);
    extra.push(c1, c2);
    await c1.query('begin');
    await c1.query("select set_config('request.jwt.claims', '{\"role\":\"service_role\"}', true)");
    await c1.query('set local role service_role');
    const first = await c1.query('select * from public.finish_registration($1, $2, $3)', [r1, hRace, 'race1'])
        .then((r) => r.rows.length === 1, () => false);
    const secondP = as(c2, SERVICE, 'select * from public.finish_registration($1, $2, $3)', [r2, hRace, 'race2']);
    await new Promise((r) => setTimeout(r, 300));
    await c1.query('commit');
    const second = await secondP;
    rec('ការប្រណាំង ២ ការតភ្ជាប់លើកូដ max_uses=1 ➜ ជោគជ័យតែ ១', first === true && raised(second, 'invite-invalid'), { first, second });
    const usedRace = (await one('select used_count from public.tenant_invites where code_hash = $1', [hRace]))[0].used_count;
    rec('ការប្រណាំង ➜ used_count = 1', usedRace === 1, usedRace);
}

const MUTATIONS = [
    ['បិទ RLS លើ tenant_members', 'alter table public.tenant_members enable row level security;', ''],
    ['policy tenants ➜ using (true)', "using (id = (select private.current_tenant_id()) or (select private.is_platform_admin()));", 'using (true);'],
    ['policy tenant_members ➜ using (true)', 'using (user_id = (select auth.uid()) or (select private.is_platform_admin()));', 'using (true);'],
    ['revoke តារាងពី public តែប៉ុណ្ណោះ (anon រក្សា grant លំនាំដើម)',
        'revoke all on table public.tenants, public.tenant_members, public.tenant_invites, public.member_reset_codes, public.platform_admins\n    from public, anon, authenticated, service_role;',
        'revoke all on table public.tenants, public.tenant_members, public.tenant_invites, public.member_reset_codes, public.platform_admins\n    from public;'],
    ['grant insert tenants ឲ្យ authenticated', 'create function private.is_platform_admin()',
        'grant insert on public.tenants to authenticated;\ncreate function private.is_platform_admin()'],
    ['tenant_row_active មិនពិនិត្យ revoked', 'select not t.revoked and t.expires_at > now()', 'select t.expires_at > now()'],
    ['tenant_row_active មិនពិនិត្យថ្ងៃផុតកំណត់', 'select not t.revoked and t.expires_at > now()', 'select not t.revoked'],
    ['current_tenant_id មិនពិនិត្យ tenant សកម្ម', 'where m.user_id = auth.uid() and private.tenant_row_active(t)', 'where m.user_id = auth.uid()'],
    ['invite_row_usable មិនពិនិត្យ revoked', 'select not i.revoked and i.used_count', 'select i.used_count'],
    ['invite_row_usable មិនពិនិត្យ max_uses', 'and i.used_count < i.max_uses and', 'and'],
    ['invite_row_usable មិនពិនិត្យថ្ងៃផុតរបស់កូដ', 'and i.expires_at > now() and private.tenant_row_active(t)', 'and private.tenant_row_active(t)'],
    ['invite_row_usable មិនពិនិត្យ tenant', 'i.expires_at > now() and private.tenant_row_active(t)', 'i.expires_at > now()'],
    ['finish_registration មិនហៅ invite_row_usable', '        and t.id = i.tenant_id\n        and private.invite_row_usable(i, t)\n    returning',
        '        and t.id = i.tenant_id\n    returning'],
    ['finish_registration លែង idempotent', "    if found then\n        tenant_id := invite_tenant;", "    if false then\n        tenant_id := invite_tenant;"],
    ['revoke_user_sessions លុប session ទាំងអស់', 'delete from auth.sessions s where s.user_id = p_user_id;', 'delete from auth.sessions s;'],
    ['invite_is_usable មិនហៅ invite_row_usable', 'where i.code_hash = p_code_hash and private.invite_row_usable(i, t)\n    )',
        'where i.code_hash = p_code_hash\n    )'],
    ['finish_registration ឲ្យ authenticated ហៅបាន', '    public.consume_reset_code(text, text)\n    to service_role;',
        '    public.consume_reset_code(text, text)\n    to service_role, authenticated;'],
    ['finish_registration មិនពិនិត្យ email ↔ username',
        "        where u.id = p_user_id and lower(split_part(u.email, '@', 1)) = p_username", '        where u.id = p_user_id'],
    ['admin_issue_invite គ្មានច្រកទ្វារ admin',
        "    if not private.is_platform_admin() then\n        raise exception 'forbidden' using errcode = '42501';\n    end if;\n    if p_role is null",
        '    if p_role is null'],
    ['admin_issue_invite ចេញកូដលើ tenant អសកម្ម', 'where t.id = p_tenant_id and private.tenant_row_active(t)', 'where t.id = p_tenant_id'],
    ['my_account បាត់ search_path', "    status text\n)\nlanguage sql stable security definer set search_path = ''", '    status text\n)\nlanguage sql stable security definer'],
    ['new_invite_code ប្រើ byte ថេរ (version របស់ uuid)', 'array[0, 1, 2, 3, 4, 5, 7, 8,', 'array[0, 1, 2, 3, 4, 5, 6, 8,'],
    ['new_invite_code ប្រើតែ ៤ bit', '(get_byte(raw, positions[i]) & 31)', '(get_byte(raw, positions[i]) & 15)'],
    ['username លែង unique', "    username text not null unique check (username ~", "    username text not null check (username ~"],
    ['reset_code_user មិនពិនិត្យ username', 'where r.code_hash = p_code_hash and m.username = p_username and not r.used', 'where r.code_hash = p_code_hash and not r.used'],
    ['reset_code_user ទទួលកូដដែលប្រើរួច', 'and m.username = p_username and not r.used and r.expires_at > now()', 'and m.username = p_username and r.expires_at > now()'],
    ['reset_code_user ទទួលកូដផុតកំណត់', 'and not r.used and r.expires_at > now()', 'and not r.used'],
    ['admin_issue_reset_code មិនបិទកូដចាស់', '    update public.member_reset_codes r set used = true where r.user_id = member_id and not r.used;\n', ''],
    ['admin_issue_reset_code គ្មានច្រកទ្វារ admin',
        "    if not private.is_platform_admin() then\n        raise exception 'forbidden' using errcode = '42501';\n    end if;\n    if p_valid_hours is null or p_valid_hours not between 1 and 168",
        '    if p_valid_hours is null or p_valid_hours not between 1 and 168'],
    ['reset hash ប្រើ prefix ដូចកូដអញ្ជើញ', "convert_to('zoe-reset:' ||", "convert_to('zoe-invite:' ||"],
    ['policy member_reset_codes ➜ using (true)', 'create policy member_reset_codes_select on public.member_reset_codes for select to authenticated\n    using ((select private.is_platform_admin()));',
        'create policy member_reset_codes_select on public.member_reset_codes for select to authenticated\n    using (true);'],
    ['private.new_invite_code អាចហៅដោយ PUBLIC', 'private.invite_code_hash(text), private.reset_code_hash(text), private.new_invite_code()\n    from public;',
        'private.invite_code_hash(text), private.reset_code_hash(text)\n    from public;'],
    ['anon ទទួល USAGE លើ private', 'grant usage on schema private to authenticated;', 'grant usage on schema private to authenticated, anon;'],
    ['policy platform_admins ឃើញទាំងអស់', 'using (user_id = (select auth.uid()));', 'using (true);']
];

async function main() {
    const invitePath = path.join(ROOT, 'supabase', 'functions', '_shared', 'invite-code.ts');
    inviteTs = fs.existsSync(invitePath) ? await import(pathToFileURL(invitePath).href) : null;
    ok('ផ្ទុក supabase/functions/_shared/invite-code.ts (Node type stripping)',
        !!inviteTs && typeof inviteTs.normalizeInviteCode === 'function' && typeof inviteTs.inviteCodeHash === 'function'
        && typeof inviteTs.resetCodeHash === 'function');
    if (!inviteTs) { finish(); return; }

    const t0 = Date.now();
    await H.start();
    console.log('  (Postgres ' + H.pgBin.version.replace(/^postgres \(PostgreSQL\) /, '') + ' · ' + (Date.now() - t0) + 'ms)');

    for (const mode of ['default-grants', 'no-default-grants']) {
        console.log('\n── ២. របៀប ' + (mode === 'default-grants'
            ? '(ក) grant លំនាំដើមបើក — anon/authenticated ទទួល ALL លើតារាងថ្មី (ករណីអាក្រក់)'
            : '(ខ) grant លំនាំដើមបិទ — grant ច្បាស់លាស់របស់ migration ត្រូវគ្រប់គ្រាន់') + ' ──');
        const { results } = await suite(mode, migrationSql, false);
        for (const r of results) ok(r.label, r.pass, r.pass ? undefined : r.detail);
        ok('របៀប ' + mode + ' ៖ ការអះអាង >= ៨០ (ឃើញ ' + results.length + ')', results.length >= 80, results.length);
    }

    console.log('\n── ៣. mutation លើ migration ពិត ➜ អ្នកយាមត្រូវក្រហម ──');
    ok('mutation >= ១៥ (មាន ' + MUTATIONS.length + ')', MUTATIONS.length >= 15);
    for (const [label, from, to] of MUTATIONS) {
        const hits = migrationSql.split(from).length - 1;
        if (hits !== 1) {
            ok('mutation «' + label + '» ៖ anchor ត្រូវលេចម្តងគត់ក្នុង migration (ឃើញ ' + hits + ')', false);
            continue;
        }
        const { results, applied } = await suite('default-grants', migrationSql.replace(from, to), true);
        const caught = results.filter((r) => !r.pass);
        ok('mutation «' + label + '» ➜ ' + (applied ? 'ចាប់ដោយ «' + (caught[0] ? caught[0].label : '—') + '»' : 'SQL អនុវត្តមិនបាន (មិនរាប់)'),
            applied && caught.length > 0);
    }
    finish();
}
