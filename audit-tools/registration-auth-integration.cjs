'use strict';
process.exitCode = 1;
// Actual GoTrue HTTP + SDK and actual PostgreSQL. RPC transport is direct SQL,
// not PostgREST. Only disposable fixture accounts are created/deleted.
const fs = require('fs'), path = require('path'), Module = require('module'), cp = require('child_process'), net = require('net'), crypto = require('crypto'), { pathToFileURL } = require('url');
const ROOT = path.resolve(__dirname, '..'), DEPS = path.resolve(process.env.SUPABASE_DEPS_DIR || path.join(ROOT, 'supabase/node_modules'));
const FIXTURE_MODE = process.env.ZOE_AUTH_PG_MODE || 'docker';
if (!['docker', 'embedded'].includes(FIXTURE_MODE))
    throw Error('unknown isolated PG mode');
const { createClient } = require(DEPS + '/@supabase/supabase-js'), ts = require(DEPS + '/typescript');
function createEmbeddedPgHarness() {
    const harness = new Module(ROOT + '/audit-tools/.tmp-registration-pg.cjs');
    harness.filename = ROOT + '/audit-tools/.tmp-registration-pg.cjs';
    harness.paths = module.paths;
    harness._compile(fs.readFileSync(ROOT + '/audit-tools/supabase-pg.js', 'utf8').replace("'-k', sock,", "'-k', '',"), harness.filename);
    return harness.exports.createPgHarness({ depsDirs: [DEPS], shimDir: ROOT + '/audit-tools/supabase-shim', wantMajor: 17 });
}
function dockerPgHarness() {
    const PG = require(DEPS + '/pg'), pins = require('./registration-auth-pins.json');
    const suffix = crypto.randomBytes(8).toString('hex'), container = 'zoe-registration-pg-' + suffix;
    const password = crypto.randomBytes(32).toString('hex');
    let mappedPort = 0, dbSeq = 0, ownsContainer = false;
    const redactArg = a => /^POSTGRES_PASSWORD=/.test(String(a)) ? 'POSTGRES_PASSWORD=[REDACTED]' : String(a);
    const docker = args => { try {
        return cp.execFileSync('docker', args, { encoding: 'utf8', timeout: 120000, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    }
    catch (e) {
        const detail = String(e.stderr || e.stdout || e.message || '').replace(/POSTGRES_PASSWORD=[^\s'"]+/g, 'POSTGRES_PASSWORD=[REDACTED]').slice(0, 800);
        throw Error('owned Docker fixture command failed: docker ' + args.map(redactArg).join(' ') + (detail ? '\n' + detail : ''));
    } };
    const connect = async (user, database) => { const c = new PG.Client({ host: '127.0.0.1', port: mappedPort, user, password, database }); await c.connect(); return c; };
    return { PG, denied: r => r.error?.code === '42501',
        async start() {
            docker(['version', '--format', '{{.Server.Version}}']);
            docker(['pull', pins.postgres.image]);
            docker(['run', '--detach', '--name', container, '--read-only', '--tmpfs', '/tmp:rw,nosuid', '--tmpfs', '/var/lib/postgresql/data:rw,nosuid', '--tmpfs', '/var/run/postgresql:rw,nosuid', '--publish', '127.0.0.1::5432', '--env', 'POSTGRES_USER=supabase_admin', '--env', 'POSTGRES_DB=postgres', '--env', 'POSTGRES_PASSWORD=' + password, pins.postgres.image]);
            ownsContainer = true;
            let binding = '';
            for (let i = 0; i < 150 && !/^127\.0\.0\.1:\d+$/.test(binding); i++) {
                try {
                    const ports = JSON.parse(docker(['inspect', '--format', '{{json .NetworkSettings.Ports}}', container]) || '{}');
                    const mapped = Array.isArray(ports['5432/tcp']) ? ports['5432/tcp'].find(x => x && x.HostIp === '127.0.0.1' && /^\d+$/.test(String(x.HostPort))) : null;
                    if (mapped) binding = '127.0.0.1:' + mapped.HostPort;
                } catch {}
                if (!/^127\.0\.0\.1:\d+$/.test(binding)) {
                    try { binding = docker(['port', container, '5432/tcp']); } catch { binding = ''; }
                }
                if (!/^127\.0\.0\.1:\d+$/.test(binding)) await new Promise(r => setTimeout(r, 100));
            }
            if (!/^127\.0\.0\.1:\d+$/.test(binding)) {
                let diag = '';
                try { diag += '\nstate=' + docker(['inspect', '--format', '{{.State.Status}} exit={{.State.ExitCode}}', container]); } catch {}
                try { diag += '\nports=' + docker(['inspect', '--format', '{{json .NetworkSettings.Ports}} {{json .HostConfig.PortBindings}}', container]); } catch {}
                try { diag += '\nallPorts=' + docker(['port', container]); } catch {}
                try { diag += '\nlogs=' + docker(['logs', '--tail', '80', container]).replace(/POSTGRES_PASSWORD=[^\s'"]+/g, 'POSTGRES_PASSWORD=[REDACTED]').slice(0, 1200); } catch {}
                throw Error('fixture PG port mapping unavailable: ' + JSON.stringify(binding) + diag);
            }
            mappedPort = Number(binding.split(':')[1]);
            let admin;
            for (let i = 0; i < 200; i++) {
                try {
                    admin = await connect('supabase_admin', 'postgres');
                    break;
                }
                catch {
                    await new Promise(r => setTimeout(r, 100));
                }
            }
            if (!admin)
                throw Error('fixture PG startup deadline');
            await admin.query("create role postgres superuser login password '" + password + "'; alter database postgres owner to postgres");
            await admin.end();
            const c = await connect('postgres', 'postgres');
            for (const f of ['00-initial-schema.sql', '01-auth-schema.sql'])
                await c.query(fs.readFileSync(ROOT + '/audit-tools/supabase-shim/' + f, 'utf8'));
            await c.end();
            const sa = await connect('supabase_admin', 'postgres');
            for (const f of ['02-auth-functions.sql', '03-demote-postgres.sql', '05-realtime.sql'])
                await sa.query(fs.readFileSync(ROOT + '/audit-tools/supabase-shim/' + f, 'utf8'));
            await sa.query("alter role supabase_auth_admin password '" + password + "'");
            await sa.end();
            const auth = await connect('supabase_auth_admin', 'postgres');
            await auth.query(fs.readFileSync(ROOT + '/audit-tools/supabase-shim/04-auth-sessions.sql', 'utf8'));
            await auth.end();
        },
        connect,
        async freshDb() { const name = 'registration_' + suffix + '_' + (++dbSeq); const c = await connect('supabase_admin', 'template1'); await c.query('create database ' + name + ' template postgres owner postgres'); await c.end(); return { name, c: await connect('postgres', name) }; },
        async as(c, who, sql, params = []) { await c.query('begin'); try {
            if (!['service_role', 'authenticated', 'anon'].includes(who.role))
                throw Error('unknown fixture role');
            await c.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({ role: who.role, sub: who.sub })]);
            await c.query('set local role ' + who.role);
            const r = await c.query(sql, params);
            await c.query('commit');
            return { rows: r.rows };
        }
        catch (e) {
            await c.query('rollback');
            return { error: { code: e.code, message: e.message } };
        } },
        stop() { if (ownsContainer) {
            try { docker(['rm', '-f', container]); }
            finally { ownsContainer = false; }
        } }
    };
}
const H = FIXTURE_MODE === 'docker' ? dockerPgHarness() : createEmbeddedPgHarness();
const AUTH = path.resolve(process.env.ZOE_AUTH_FIXTURE_DIR || 'missing-auth-fixture');
const AUTH_BINARY_SHA256 = crypto.createHash('sha256').update(fs.readFileSync(AUTH + '/auth')).digest('hex');
if (AUTH_BINARY_SHA256 !== 'f2aa147268461f74784ddc8b2240aa446ee71ceb9633bac41c30e7b852a860aa')
    throw Error('Auth binary hash mismatch');
const pause = () => { let resolve; const promise = new Promise(r => resolve = r); return { promise, resolve }; };
const pw = 'fixture-password-8793', ia = 'AAAAAAAAAAAAAAAAAAAA', ib = 'BBBBBBBBBBBBBBBBBBBB', hash = s => crypto.createHash('sha256').update('zoe-invite:' + s).digest('hex'), ha = hash(ia), hb = hash(ib);
const result = [];
function check(mode, name, pass, details) { result.push({ mode, name, pass, details }); console.log((pass ? 'PASS' : 'FAIL') + ' ' + mode + ' ' + name + ' ' + JSON.stringify(details || {})); }
async function compile(name, source) { const input = source ?? fs.readFileSync(ROOT + '/supabase/functions/_shared/' + name, 'utf8'); let code = ts.transpileModule(input, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText; code = code.replace(/from '(\.\/[^']+)'/g, (_, s) => 'from ' + JSON.stringify(pathToFileURL(path.resolve(ROOT + '/supabase/functions/_shared', s)).href)); return import('data:text/javascript;base64,' + Buffer.from(code).toString('base64')); }
async function port() { const s = net.createServer(); await new Promise(r => s.listen(0, '127.0.0.1', r)); const n = s.address().port; await new Promise(r => s.close(r)); return n; }
function jwt(secret) { const parts = [{ alg: 'HS256', typ: 'JWT' }, { role: 'service_role', aud: 'authenticated', iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600 }].map(x => Buffer.from(JSON.stringify(x)).toString('base64url')); return parts.join('.') + '.' + crypto.createHmac('sha256', secret).update(parts.join('.')).digest('base64url'); }
async function stopAuth(server) {
    if (!server || server.exitCode !== null || server.signalCode !== null)
        return;
    let timer;
    const exited = new Promise(resolve => server.once('exit', resolve));
    server.kill('SIGTERM');
    await Promise.race([exited, new Promise(resolve => { timer = setTimeout(resolve, 2000); })]);
    clearTimeout(timer);
    if (server.exitCode === null && server.signalCode === null) {
        server.kill('SIGKILL');
        await Promise.race([exited, new Promise((_, reject) => { timer = setTimeout(() => reject(Error('owned Auth process did not exit')), 2000); })]);
        clearTimeout(timer);
    }
}
async function world(mode, adminDeps, options = {}) {
    const { c, name } = await H.freshDb();
    let server;
    const clients = [];
    try {
        const owner = await H.connect('supabase_admin', name);
        await owner.query('drop schema auth cascade; create schema auth authorization supabase_auth_admin; grant usage on schema auth to postgres,anon,authenticated,service_role');
        await owner.end();
        const authPort = await port(), url = 'http://127.0.0.1:' + authPort, secret = crypto.randomBytes(32).toString('hex'), token = jwt(secret);
        const env = { PATH: process.env.PATH, GOTRUE_API_HOST: '127.0.0.1', GOTRUE_API_PORT: String(authPort), API_EXTERNAL_URL: url, GOTRUE_SITE_URL: 'http://127.0.0.1:9990', GOTRUE_DB_DRIVER: 'postgres', GOTRUE_DB_DATABASE_URL: 'postgres://supabase_auth_admin' + (c.connectionParameters.password ? ':' + encodeURIComponent(c.connectionParameters.password) : '') + '@127.0.0.1:' + c.connectionParameters.port + '/' + name + '?sslmode=disable', GOTRUE_DB_MIGRATIONS_PATH: AUTH + '/migrations', GOTRUE_JWT_SECRET: secret, GOTRUE_JWT_ADMIN_ROLES: 'service_role', GOTRUE_JWT_AUD: 'authenticated', GOTRUE_JWT_DEFAULT_GROUP_NAME: 'authenticated', GOTRUE_DISABLE_SIGNUP: 'true', GOTRUE_EXTERNAL_EMAIL_ENABLED: 'true', GOTRUE_MAILER_AUTOCONFIRM: 'true', GOTRUE_LOG_LEVEL: 'error' };
        let log = '';
        server = cp.spawn(AUTH + '/auth', [], { env, stdio: ['ignore', 'pipe', 'pipe'] });
        server.stdout.on('data', b => { log = (log + b).slice(-3000); });
        server.stderr.on('data', b => { log = (log + b).slice(-3000); });
        let health;
        for (let i = 0; i < 150; i++) {
            if (server.exitCode !== null)
                throw Error('Auth startup failed (see local sanitized diagnostics)');
            try {
                const r = await fetch(url + '/health');
                if (r.ok) {
                    health = await r.json();
                    break;
                }
            }
            catch { }
            await new Promise(r => setTimeout(r, 100));
        }
        if (health?.version !== 'v2.197.0')
            throw Error('wrong/missing actual Auth version');
        const migrated = Number((await c.query('select count(*) from auth.schema_migrations')).rows[0].count);
        if (migrated !== 75)
            throw Error('unexpected real Auth migration count');
        for (const file of ['20260930120000_zoe_tenancy.sql', '20261003091742_zoe_register_spent_invite.sql'])
            await c.query(fs.readFileSync(ROOT + '/supabase/migrations/' + file, 'utf8'));
        if (mode === 'atomic') {
            await c.query(fs.readFileSync(ROOT + '/supabase/migrations/20261106143034_zoe_atomic_registration.sql', 'utf8'));
            if (!options.newProject) await c.query('update private.registration_protocol set accepting=true');
        }
        async function seed() {
            await c.query("insert into public.tenants(id,name,branch_code,expires_at) values('11111111-1111-4111-8111-111111111111','One','ONE',now()+interval '1 day'),('22222222-2222-4222-8222-222222222222','Two','TWO',now()+interval '1 day')");
            await c.query("insert into public.tenant_invites(code_hash,tenant_id,expires_at) values($1,'11111111-1111-4111-8111-111111111111',now()+interval '1 day'),($2,'22222222-2222-4222-8222-222222222222',now()+interval '1 day')", [ha, hb]);
        }
        if (!options.newProject) await seed();
        let deletes = 0;
        function client(code, opts = {}) {
            const sdk = createClient(url, token, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: async (input, init) => { const u = new URL(typeof input === 'string' ? input : input.url); if (u.origin !== url)
                        throw Error('non-fixture destination'); if (!u.pathname.startsWith('/auth/v1/'))
                        throw Error('unhandled non-Auth request'); u.pathname = u.pathname.slice('/auth/v1'.length); return fetch(u, init); } } });
            clients.push(sdk);
            sdk.rpc = async (fn, args) => { const x = await H.connect('postgres', name); try {
                const keys = Object.keys(args || {});
                const r = await H.as(x, { role: 'service_role' }, 'select * from public.' + fn + '(' + keys.map((key, i) => key + '=> $' + (i + 1)).join(',') + ')', keys.map(key => args[key]));
                if (r.error)
                    return { data: null, error: r.error };
                if (fn === 'invite_is_usable' || fn === 'registration_capability_v1')
                    return { data: r.rows[0][fn], error: null };
                return { data: r.rows, error: null };
            }
            finally {
                await x.end();
            } };
            const create = sdk.auth.admin.createUser.bind(sdk.auth.admin);
            sdk.auth.admin.createUser = async (attrs) => {
                if (opts.beforeCreate)
                    await opts.beforeCreate();
                const res = await create(attrs);
                return res;
            };
            const del = sdk.auth.admin.deleteUser.bind(sdk.auth.admin);
            sdk.auth.admin.deleteUser = async (...args) => { deletes++; return del(...args); };
            return sdk;
        }
        function deps(code, opts = {}) { const sdk = client(code, opts), d = { ...adminDeps(sdk, 8000, () => client(code)), loginDomain: 'users.zoew.invalid' }; if (opts.beforeFinish) {
            const f = d.finishRegistration;
            d.finishRegistration = async (req) => { await opts.beforeFinish(); return f(req); };
        } if (opts.loseReply) {
            const f = d.createUser;
            d.createUser = async (...args) => { await f(...args); return { ok: false, reason: 'unavailable' }; };
        } return d; }
        async function snapshot() { return { users: Number((await c.query('select count(*) from auth.users')).rows[0].count), identities: Number((await c.query('select count(*) from auth.identities')).rows[0].count), members: (await c.query('select user_id,tenant_id,username from public.tenant_members')).rows, uses: (await c.query('select used_count from public.tenant_invites order by code_hash')).rows.map(r => r.used_count), deletes }; }
        return { c, name, deps, client, snapshot, seed, version: health.version, close: async () => { for (const sdk of clients)
                sdk.auth.stopAutoRefresh(); await stopAuth(server); await c.end(); } };
    }
    catch (e) {
        await stopAuth(server);
        await c.end();
        throw e;
    }
}
(async () => {
    const { handleRegister: handle } = await compile('account-core.ts');
    const { adminDeps } = await compile('admin-deps.ts');
    try {
        await H.start();
        const { activationSql } = await import(pathToFileURL(ROOT + '/supabase/scripts/registration-onboarding.mjs'));
        const activation = () => activationSql('abcdefghijklmnopqrst', Date.now());
        {
            const w = await world('atomic', adminDeps, { newProject: true });
            try {
                const before = await w.snapshot();
                const readiness = await w.deps(ha).registrationReady();
                const refused = await w.deps(ha).createUser('fresh_user@users.zoew.invalid', pw, { username: 'fresh_user', codeHash: ha });
                check('onboarding', 'migration ថ្មីនៅបិទ និង Auth មិនប្រែ', readiness === false && !refused.ok && JSON.stringify(await w.snapshot()) === JSON.stringify(before));
                const admin = await w.client(ha).auth.admin.createUser({ email: 'admin@admin.zoew.invalid', password: pw, email_confirm: true });
                if (admin.error || !admin.data.user) throw Error('platform admin fixture failed');
                await w.c.query('insert into public.platform_admins(user_id) values($1)', [admin.data.user.id]);
                await w.c.query(activation());
                check('onboarding', 'ការបើក project ថ្មីទទួល platform admin ដែលមានរួច', await w.deps(ha).registrationReady() === true && (await w.snapshot()).users === 1);
                await w.seed();
                const registered = await handle({ invite: ia, username: 'fresh_user', password: pw }, w.deps(ha));
                const loggedIn = await w.deps(ha).passwordUserId('fresh_user@users.zoew.invalid', pw);
                const after = await w.snapshot();
                check('onboarding', 'project បើករួចចុះឈ្មោះតាម Auth ពិត និង first login ឆ្លង', registered.status === 200 && after.users === 2 && after.identities === 2 && after.members.length === 1 && after.members[0].user_id === loggedIn && after.uses.reduce((a, b) => a + b, 0) === 1 && after.deletes === 0, { registered, after });
                await w.c.query(activation());
                check('onboarding', 'project ដែលបើករួចមិនត្រូវបិទ ឬសរសេរឡើងវិញ', await w.deps(ha).registrationReady() === true && JSON.stringify(await w.snapshot()) === JSON.stringify(after));
            } finally { await w.close(); }
        }
        for (const [label, setup] of [
            ['មានហាងរួច', w => w.seed()],
            ['Auth user មិនមែន admin', async w => { await w.client(ha).auth.admin.createUser({ email: 'other@users.zoew.invalid', password: pw, email_confirm: true }); }],
            ['protocol មិនត្រូវគ្នា', w => w.c.query('update private.registration_protocol set protocol=2')],
            ['enrollment trigger បិទ', w => w.c.query('alter table auth.users disable trigger zoe_enroll_registration_at_commit')],
            ['column gate បើកសិទ្ធិដល់ client', w => w.c.query('grant update(accepting) on private.registration_protocol to authenticated')],
            ['service ខ្វះសិទ្ធិ capability', w => w.c.query('revoke execute on function public.registration_capability_v1() from service_role')]
        ]) {
            const w = await world('atomic', adminDeps, { newProject: true });
            try {
                await setup(w);
                const before = await w.snapshot();
                let refused = false;
                try { await w.c.query(activation()); } catch { refused = true; await w.c.query('rollback'); }
                check('onboarding', label + ' បដិសេធការបើក ដោយគ្មានការប្ដូរគណនី/សមាជិក/កូដ', refused && (await w.c.query('select accepting from private.registration_protocol')).rows[0].accepting === false && JSON.stringify(await w.snapshot()) === JSON.stringify(before));
            } finally { await w.close(); }
        }
        {
            const w = await world('atomic', adminDeps, { newProject: true });
            try {
                let refused = false;
                try { await w.c.query(activationSql('abcdefghijklmnopqrst', Date.now() - 10 * 60 * 1000)); } catch { refused = true; await w.c.query('rollback'); }
                check('onboarding', 'preflight ផុតសុពលភាពមិនអាចបើក gate', refused && (await w.c.query('select accepting from private.registration_protocol')).rows[0].accepting === false);
            } finally { await w.close(); }
        }
        for (const [label, breakGate] of [
            ['protocol របស់ gate ដែលបើករួចមិនត្រូវគ្នា', w => w.c.query('update private.registration_protocol set protocol=2')],
            ['trigger របស់ gate ដែលបើករួចខូច', w => w.c.query('alter table auth.users disable trigger zoe_enroll_registration_at_commit')]
        ]) {
            const w = await world('atomic', adminDeps);
            try {
                await breakGate(w);
                const before = await w.snapshot();
                let refused = false;
                try { await w.c.query(activation()); } catch { refused = true; await w.c.query('rollback'); }
                check('onboarding', label + ' បដិសេធច្បាស់ ដោយមិនប្ដូរ gate', refused && (await w.c.query('select accepting from private.registration_protocol')).rows[0].accepting === true && JSON.stringify(await w.snapshot()) === JSON.stringify(before));
            } finally { await w.close(); }
        }
        for (const [label, insert] of [
            ['tenant', "insert into public.tenants(name,branch_code,expires_at) values('Concurrent','CONCURRENT',now()+interval '1 day')"],
            ['Auth user', "insert into auth.users(id,email) values('33333333-3333-4333-8333-333333333333','concurrent@users.zoew.invalid')"]
        ]) {
            const w = await world('atomic', adminDeps, { newProject: true });
            const writer = await H.connect('postgres', w.name), activator = await H.connect('postgres', w.name);
            try {
                await writer.query('begin');
                await writer.query(insert);
                const pid = Number((await activator.query('select pg_backend_pid() pid')).rows[0].pid);
                let settled = false;
                const activationResult = activator.query(activation()).then(() => { settled = true; return false; }, () => { settled = true; return true; });
                let blocked = false;
                for (let i = 0; i < 100; i++) {
                    if ((await w.c.query('select wait_event_type from pg_stat_activity where pid=$1', [pid])).rows[0]?.wait_event_type === 'Lock') { blocked = true; break; }
                    await new Promise(r => setTimeout(r, 10));
                }
                const waiting = blocked && !settled;
                await writer.query('commit');
                const refused = await activationResult;
                await activator.query('rollback');
                check('onboarding-lock', 'ដំណាលគ្នា ' + label + ' មិនអាចឆ្លងកាត់ការផ្ទៀង project ទទេ', waiting && refused && (await w.c.query('select accepting from private.registration_protocol')).rows[0].accepting === false && (await w.snapshot()).members.length === 0);
            } finally { await writer.query('rollback'); await writer.end(); await activator.end(); await w.close(); }
        }
        for (const mode of ['atomic']) {
            {
                const w = await world(mode, adminDeps), entered = pause(), release = pause();
                try {
                    const a = handle({ invite: ia, username: 'race_user', password: pw }, w.deps(ha, { beforeFinish: async () => { entered.resolve(); await release.promise; } }));
                    await Promise.race([entered.promise, new Promise((_, reject) => setTimeout(() => reject(Error('first create did not reach finish')), 15000))]);
                    const b = await handle({ invite: ib, username: 'race_user', password: pw }, w.deps(hb));
                    release.resolve();
                    const ar = await a, state = await w.snapshot();
                    check(mode, 'real Auth successful concurrent registration survives', state.users === 1 && state.identities === 1 && state.members.length === 1 && ar.status === 200 && b.status === 409 && state.members[0].tenant_id === ar.body.tenantId && ar.body.tenantId === '11111111-1111-4111-8111-111111111111' && state.uses.reduce((a, b) => a + b, 0) === 1 && state.deletes === 0 && (await w.c.query('select used_count from public.tenant_invites where code_hash=$1', [hb])).rows[0].used_count === 0, { a: ar.status, b: b.status, state });
                }
                finally {
                    release.resolve();
                    await w.close();
                }
            }
            {
                const w = await world(mode, adminDeps);
                try {
                    const r = await handle({ invite: ia, username: 'revoked_user', password: pw }, w.deps(ha, { beforeCreate: () => w.c.query('update public.tenant_invites set revoked=true where code_hash=$1', [ha]) }));
                    const state = await w.snapshot();
                    check(mode, 'real Auth invite rejection leaves no user or identity orphan', r.status !== 200 && state.users === 0 && state.identities === 0 && state.members.length === 0 && state.uses.every(v => v === 0), { status: r.status, code: r.body.code, state });
                }
                finally {
                    await w.close();
                }
            }
            {
                const w = await world(mode, adminDeps);
                try {
                    const lost = await handle({ invite: ia, username: 'lost_reply', password: pw }, w.deps(ha, { loseReply: true }));
                    const before = await w.snapshot();
                    const retry = await handle({ invite: ia, username: 'lost_reply', password: pw }, w.deps(ha));
                    const state = await w.snapshot();
                    const recoveredOrUncertain = lost.status === 200 || lost.status === 502;
                    check(mode, 'real Auth response-loss recovery authenticates same password', recoveredOrUncertain && retry.status === 200 && state.users === 1 && state.identities === 1 && state.members.length === 1 && state.uses.reduce((a, b) => a + b, 0) === 1, { lost: lost.status, retry: retry.status, before, state });
                    if (mode === 'atomic')
                        check(mode, 'real Auth create committed membership before lost reply', before.members.length === 1 && before.identities === 1, before);
                }
                finally {
                    await w.close();
                }
            }
        }
        {
            const w = await world('atomic', adminDeps);
            try {
                const sdk = w.client(ha);
                const response = await sdk.auth.admin.createUser({ email: 'ordinary@users.zoew.invalid', password: pw, email_confirm: true, user_metadata: { zoe_registration: { version: 1, username: 'ordinary', invite_code_hash: ha } } });
                const state = await w.snapshot();
                check('atomic', 'real Auth user-editable metadata cannot enroll an ordinary admin-created account', !response.error && state.users === 1 && state.identities === 1 && state.members.length === 0 && state.uses.every(v => v === 0), state);
            }
            finally {
                await w.close();
            }
        }
        {
            const w = await world('atomic', adminDeps);
            try {
                await handle({ invite: ia, username: 'protected_user', password: pw }, w.deps(ha, { loseReply: true }));
                const r = await handle({ invite: ia, username: 'protected_user', password: 'different-password' }, w.deps(ha));
                const state = await w.snapshot();
                check('atomic', 'real Auth lost-response recovery rejects wrong password without changing enrollment', r.status === 403 && state.users === 1 && state.identities === 1 && state.members.length === 1 && state.uses.reduce((a, b) => a + b, 0) === 1 && state.deletes === 0, { status: r.status, state });
            }
            finally {
                await w.close();
            }
        }
        {
            const w = await world('atomic', adminDeps);
            try {
                const outcomes = await Promise.all(['first_user', 'second_user'].map(username => handle({ invite: ia, username, password: pw }, w.deps(ha))));
                const state = await w.snapshot();
                check('atomic', 'real Auth single-use invite admits only one distinct account with no orphan', outcomes.filter(r => r.status === 200).length === 1 && state.users === 1 && state.identities === 1 && state.members.length === 1 && state.members[0].tenant_id === '11111111-1111-4111-8111-111111111111' && state.uses.reduce((a, b) => a + b, 0) === 1 && state.deletes === 0, { statuses: outcomes.map(r => r.status), state });
            }
            finally {
                await w.close();
            }
        }
        for (const broken of ['paused', 'missing', 'disabled']) {
            const w = await world('atomic', adminDeps);
            try {
                if (broken === 'paused')
                    await w.c.query('update private.registration_protocol set accepting=false');
                if (broken === 'missing')
                    await w.c.query('drop trigger zoe_enroll_registration_at_commit on auth.users');
                if (broken === 'disabled')
                    await w.c.query('alter table auth.users disable trigger zoe_enroll_registration_at_commit');
                let authCalls = 0;
                const r = await handle({ invite: ia, username: 'blocked_user', password: pw }, w.deps(ha, { beforeCreate: async () => { authCalls++; } }));
                const state = await w.snapshot();
                check('atomic', 'capability ' + broken + ' prevents any actual Auth create', r.status === 502 && authCalls === 0 && state.users === 0 && state.identities === 0, { status: r.status, authCalls, state });
            }
            finally {
                await w.close();
            }
        }
        {
            const w = await world('atomic', adminDeps);
            try {
                const r = await handle({ invite: ia, username: 'paused_between', password: pw }, w.deps(ha, { beforeCreate: () => w.c.query('update private.registration_protocol set accepting=false') }));
                const state = await w.snapshot();
                check('atomic', 'pause after preflight rolls back actual Auth transaction', r.status === 502 && state.users === 0 && state.identities === 0 && state.members.length === 0 && state.uses.every(v => v === 0), { status: r.status, state });
            }
            finally {
                await w.close();
            }
        }
        {
            const w = await world('atomic', adminDeps);
            let enrollment, pauser;
            try {
                enrollment = await H.connect('supabase_auth_admin', w.name);
                pauser = await H.connect('postgres', w.name);
                await enrollment.query('begin');
                const id = crypto.randomUUID();
                await enrollment.query('insert into auth.users(id,email,raw_app_meta_data) values($1,$2,$3)', [id, 'lock_user@users.zoew.invalid', JSON.stringify({ zoe_registration: { version: 1, username: 'lock_user', invite_code_hash: ha } })]);
                await enrollment.query('set constraints zoe_enroll_registration_at_commit immediate');
                const pid = Number((await pauser.query('select pg_backend_pid() pid')).rows[0].pid);
                let settled = false;
                const pauseWrite = pauser.query('update private.registration_protocol set accepting=false').then(() => { settled = true; });
                let blocked = false;
                for (let i = 0; i < 100; i++) {
                    const row = (await w.c.query('select wait_event_type from pg_stat_activity where pid=$1', [pid])).rows[0];
                    if (row?.wait_event_type === 'Lock') {
                        blocked = true;
                        break;
                    }
                    await new Promise(r => setTimeout(r, 10));
                }
                check('postgres-lock', 'pause waits on enrollment admission row lock', blocked && !settled, { blocked, settled });
                await enrollment.query('commit');
                await pauseWrite;
                const state = await w.snapshot();
                check('postgres-lock', 'pause completes after admitted enrollment commits', settled && state.members.length === 1 && !(await w.c.query('select accepting from private.registration_protocol')).rows[0].accepting, state);
            }
            finally {
                if (enrollment) {
                    await enrollment.query('rollback').catch(() => { });
                    await enrollment.end();
                }
                if (pauser)
                    await pauser.end();
                await w.close();
            }
        }
        if (result.some(r => !r.pass))
            throw Error('candidate actual Auth test failure');
        console.log('ACTUAL AUTH CANDIDATE VERIFIED ' + result.length + ' checks.');
        process.exitCode = 0;
    }
    finally {
        H.stop();
        fs.writeFileSync(process.env.ZOE_AUTH_REPORT || path.join(ROOT, 'registration-auth-results.json'), JSON.stringify({ authVersion: 'v2.197.0', authBinarySha256: AUTH_BINARY_SHA256, authBinarySource: 'extracted from pinned linux/amd64 image', authImageManifestDigest: 'sha256:839f529492d116b4e8b7777c953a27c381d34c15a744b1bcefde5eefaa1f9f9f', rpcTransport: 'direct SQL; not PostgREST', postgresMode: FIXTURE_MODE, result }, null, 2) + '\n');
    }
})().catch(e => { H.stop(); console.error(e.message); process.exitCode = 1; });
