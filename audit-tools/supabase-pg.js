// Postgres ពិតសម្រាប់អ្នកយាម Supabase (`supabase-rls-test` · `supabase-datastore-test`) ៖ រកកម្មវិធី Postgres តាមកំណែ major ·
// initdb/postgres ជា user មិនមែន root (setpriv) · port ចៃដន្យលើ 127.0.0.1 · ស្លាប់តាមអ្នកយាម (pdeathsig) · template ដែលមាន
// role/schema របស់ Supabase (`supabase-shim/*.sql`) · database ថ្មីក្នុងមួយសេណារីយ៉ូ · ធ្វើត្រាប់ PostgREST (`set local role` + JWT claims)។
// ⛔ ម៉ូឌុលនេះមិនអះអាងអ្វីទេ ៖ វាជា harness តែប៉ុណ្ណោះ ➜ ការធ្លាក់ត្រូវរាយការណ៍ដោយអ្នកហៅ។
'use strict';

const fs = require('fs');
const os = require('os');
const net = require('net');
const path = require('path');
const cp = require('child_process');

const SHIM_FILES = {
    asPostgres: ['00-initial-schema.sql', '01-auth-schema.sql'],
    asAdmin: ['02-auth-functions.sql', '03-demote-postgres.sql', '05-realtime.sql'],
    asAuthAdmin: ['04-auth-sessions.sql']
};

function findPgBins(depsDirs) {
    const cands = [process.env.SUPABASE_PG_BIN]
        .concat(depsDirs.map((d) => path.join(d, '@embedded-postgres', 'linux-x64', 'native', 'bin')));
    try {
        for (const v of fs.readdirSync('/usr/lib/postgresql')) cands.push(path.join('/usr/lib/postgresql', v, 'bin'));
    } catch (e) {}
    const found = [];
    for (const c of cands.filter(Boolean)) {
        if (!fs.existsSync(path.join(c, 'postgres')) || !fs.existsSync(path.join(c, 'initdb'))) continue;
        try {
            const v = cp.execFileSync(path.join(c, 'postgres'), ['--version'], { encoding: 'utf8', timeout: 10000 });
            const major = parseInt((v.match(/\b(\d+)\.\d+/) || [])[1] || '0', 10);
            found.push({ bin: c, major, version: v.trim() });
        } catch (e) {}
    }
    return found;
}

function loadPg(depsDirs) {
    for (const d of depsDirs) {
        try { return require(path.join(d, 'pg')); } catch (e) {}
    }
    return null;
}

function osUser() {
    if (typeof process.getuid !== 'function' || process.getuid() !== 0) return null;
    for (const name of ['postgres', 'nobody']) {
        try {
            const uid = parseInt(cp.execFileSync('id', ['-u', name], { encoding: 'utf8' }).trim(), 10);
            const gid = parseInt(cp.execFileSync('id', ['-g', name], { encoding: 'utf8' }).trim(), 10);
            if (Number.isFinite(uid) && uid > 0) return { name, uid, gid };
        } catch (e) {}
    }
    return null;
}
function hasSetpriv() {
    try { cp.execFileSync('setpriv', ['--version'], { stdio: 'ignore' }); return true; } catch (e) { return false; }
}
function wrap(cmd, args, user, deathSig) {
    if (!hasSetpriv()) {
        if (user) throw new Error('រត់ជា root តែគ្មាន setpriv ➜ Postgres មិនព្រមរត់ជា root');
        return [cmd, args];
    }
    const pre = [];
    if (user) pre.push('--reuid=' + user.uid, '--regid=' + user.gid, '--init-groups');
    if (deathSig) pre.push('--pdeathsig=' + deathSig);
    return ['setpriv', pre.concat(['--', cmd], args)];
}
function freePort() {
    return new Promise((resolve, reject) => {
        const s = net.createServer();
        s.once('error', reject);
        s.listen(0, '127.0.0.1', () => {
            const port = s.address().port;
            s.close(() => resolve(port));
        });
    });
}
function sweepStaleDirs(base) {
    try {
        for (const name of fs.readdirSync(base)) {
            if (!/^zoe-sbpg-/.test(name)) continue;
            const full = path.join(base, name);
            const age = Date.now() - fs.statSync(full).mtimeMs;
            if (age > 6 * 3600 * 1000) fs.rmSync(full, { recursive: true, force: true });
        }
    } catch (e) {}
}

const ROLE_SQL = { anon: 'set local role anon', authenticated: 'set local role authenticated', service_role: 'set local role service_role' };

function createPgHarness(opts) {
    const depsDirs = opts.depsDirs.filter(Boolean);
    const shimDir = opts.shimDir;
    const PG = loadPg(depsDirs);
    const bins = findPgBins(depsDirs);
    const pgBin = bins.find((b) => b.major === opts.wantMajor) || null;
    let server = null;
    let dataRoot = null;
    let port = 0;
    let dbSeq = 0;

    function unavailableReason() {
        if (!PG) return 'គ្មាន module `pg`';
        if (!pgBin) return 'គ្មាន Postgres ' + opts.wantMajor + ' (ឃើញ ' + (bins.map((b) => b.major).join(',') || 'គ្មាន') + ')';
        return null;
    }

    function stop() {
        const child = server;
        server = null;
        if (child && child.exitCode === null) {
            try { child.kill('SIGINT'); } catch (e) {}
            const t = setTimeout(() => { try { child.kill('SIGKILL'); } catch (e) {} }, 5000);
            child.once('exit', () => {
                clearTimeout(t);
                if (dataRoot) try { fs.rmSync(dataRoot, { recursive: true, force: true }); } catch (e) {}
            });
        } else if (dataRoot) {
            try { fs.rmSync(dataRoot, { recursive: true, force: true }); } catch (e) {}
        }
    }
    for (const sig of ['SIGTERM', 'SIGINT', 'SIGHUP']) {
        process.once(sig, () => {
            if (server) try { server.kill('SIGQUIT'); } catch (e) {}
            if (dataRoot) try { fs.rmSync(dataRoot, { recursive: true, force: true }); } catch (e) {}
            process.exit(1);
        });
    }

    async function connect(user, database) {
        const c = new PG.Client({ host: '127.0.0.1', port, user, database });
        await c.connect();
        return c;
    }

    async function start() {
        const user = osUser();
        const base = user ? '/tmp' : os.tmpdir();
        sweepStaleDirs(base);
        dataRoot = fs.mkdtempSync(path.join(base, 'zoe-sbpg-'));
        const data = path.join(dataRoot, 'data');
        const sock = path.join(dataRoot, 'sock');
        fs.mkdirSync(data);
        fs.mkdirSync(sock);
        if (user) {
            fs.chownSync(dataRoot, user.uid, user.gid);
            fs.chownSync(data, user.uid, user.gid);
            fs.chownSync(sock, user.uid, user.gid);
        }
        const [icmd, iargs] = wrap(path.join(pgBin.bin, 'initdb'),
            ['-D', data, '-U', 'supabase_admin', '--auth=trust', '-E', 'UTF8', '--locale=C', '--no-sync'], user, null);
        const init = cp.spawnSync(icmd, iargs, { encoding: 'utf8', timeout: 120000 });
        if (init.status !== 0) throw new Error('initdb ធ្លាក់ ៖ ' + String(init.stderr || init.error || '').slice(-600));
        port = await freePort();
        const [scmd, sargs] = wrap(path.join(pgBin.bin, 'postgres'), ['-D', data, '-p', String(port), '-k', sock,
            '-c', 'listen_addresses=127.0.0.1', '-c', 'fsync=off', '-c', 'synchronous_commit=off',
            '-c', 'full_page_writes=off', '-c', 'max_connections=60'], user, 'INT');
        let log = '';
        server = cp.spawn(scmd, sargs, { stdio: ['ignore', 'pipe', 'pipe'] });
        server.stdout.on('data', (d) => { log = (log + d).slice(-4000); });
        server.stderr.on('data', (d) => { log = (log + d).slice(-4000); });
        const deadline = Date.now() + 30000;
        for (;;) {
            if (server.exitCode !== null) throw new Error('postgres ចេញមុនពេល ៖ ' + log.slice(-600));
            const c = new PG.Client({ host: '127.0.0.1', port, user: 'supabase_admin', database: 'postgres' });
            try {
                await c.connect();
                await c.end();
                break;
            } catch (e) {
                try { await c.end(); } catch (x) {}
                if (Date.now() > deadline) throw new Error('postgres មិនឆ្លើយក្នុង ៣០ វិ. ៖ ' + log.slice(-600));
                await new Promise((r) => setTimeout(r, 150));
            }
        }
        const sa = await connect('supabase_admin', 'postgres');
        await sa.query('create role postgres superuser login');
        await sa.query('alter database postgres owner to postgres');
        await sa.end();
        const pgc = await connect('postgres', 'postgres');
        for (const f of SHIM_FILES.asPostgres) await pgc.query(fs.readFileSync(path.join(shimDir, f), 'utf8'));
        await pgc.end();
        const sa2 = await connect('supabase_admin', 'postgres');
        for (const f of SHIM_FILES.asAdmin) await sa2.query(fs.readFileSync(path.join(shimDir, f), 'utf8'));
        await sa2.end();
        const gotrue = await connect('supabase_auth_admin', 'postgres');
        for (const f of SHIM_FILES.asAuthAdmin) await gotrue.query(fs.readFileSync(path.join(shimDir, f), 'utf8'));
        await gotrue.end();
    }

    async function freshDb(mode) {
        const name = 'zoe_' + process.pid + '_' + (++dbSeq);
        const admin = await connect('supabase_admin', 'template1');
        await admin.query('create database ' + name + ' template postgres owner postgres');
        await admin.end();
        const c = await connect('postgres', name);
        if (mode === 'no-default-grants') {
            await c.query(`alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated, service_role;
                alter default privileges for role postgres in schema public revoke all on functions from anon, authenticated, service_role;
                alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated, service_role;`);
        }
        return { name, c };
    }

    async function as(c, who, sql, params) {
        await c.query('begin');
        try {
            const claims = Object.assign({ role: who.role }, who.sub ? { sub: who.sub, aud: 'authenticated' } : {}, who.extra || {});
            await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
            if (who.topic) await c.query("select set_config('realtime.topic', $1, true)", [who.topic]);
            await c.query(ROLE_SQL[who.role]);
            const r = await c.query(sql, params || []);
            await c.query('commit');
            return { rows: r.rows };
        } catch (e) {
            try { await c.query('rollback'); } catch (x) {}
            return { error: { code: e.code, message: e.message, detail: e.detail } };
        }
    }

    async function makeAuthUser(c, email) {
        const r = await c.query(`insert into auth.users (instance_id, id, aud, role, email, encrypted_password, created_at, updated_at)
            values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', $1, 'x', now(), now())
            returning id`, [email]);
        return r.rows[0].id;
    }

    return {
        PG, pgBin, bins, unavailableReason, start, stop, connect, freshDb, as, makeAuthUser,
        shimFiles: [].concat(SHIM_FILES.asPostgres, SHIM_FILES.asAdmin, SHIM_FILES.asAuthAdmin),
        denied: (r) => !!r.error && r.error.code === '42501' && /^permission denied/.test(r.error.message),
        raised: (r, token) => !!r.error && r.error.message === token
    };
}

module.exports = { createPgHarness };
