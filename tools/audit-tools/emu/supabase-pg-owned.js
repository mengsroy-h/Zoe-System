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
const ROLE_SQL = { anon: 'set local role anon', authenticated: 'set local role authenticated', service_role: 'set local role service_role' };

function createPgHarness(opts) {
    const depsDirs = opts.depsDirs.filter(Boolean);
    const shimDir = opts.shimDir;
    const PG = loadPg(depsDirs);
    const bins = findPgBins(depsDirs);
    const pgBin = bins.find((b) => b.major === opts.wantMajor) || null;
    let server = null, ownedServer = null;
    let dataRoot = null, rootFd = null;
    let interrupted = false, startAttempted = false, stopRequested = false, startInProgress = false, stopSignalFailure = null;
    let evidence = null, lateExit = false, lateSizeSettled = false;
    const pgErrors = [];
    let port = 0;
    let dbSeq = 0;
    let evidenceStop = null;

    function unavailableReason() {
        if (!PG) return 'គ្មាន module `pg`';
        if (!pgBin) return 'គ្មាន Postgres ' + opts.wantMajor + ' (ឃើញ ' + (bins.map((b) => b.major).join(',') || 'គ្មាន') + ')';
        return null;
    }

    // Deletion is intentionally unavailable: callers cannot establish all external work here.
    function stop(options = {}) {
        if (options.tasksQuiescent !== true) throw new Error('Owned PG stop refused: task quiescence is unproven');
        if (startInProgress || evidence?.outcome === 'UNKNOWN') throw new Error('Owned PG stop refused: ownership outcome is unknown');
        interrupted = true;
        const child = server || ownedServer;
        if (!child) throw new Error('Owned PG stop refused: child was not registered');
        if (!Number.isSafeInteger(child.pid) || child.pid <= 0) throw new Error('Owned PG stop refused: registered child PID is invalid');
        if (child.exitCode !== null || child.signalCode) return;
        if (stopRequested) { if (stopSignalFailure) throw stopSignalFailure; return; }
        stopRequested = true;
        try { if (child.kill('SIGINT') === false) throw new Error('Owned PG SIGINT was not delivered'); }
        catch (error) { stopSignalFailure = error; throw error; }
    }

    // Read-only apparent-byte snapshot; asynchronous calls keep the shutdown deadline responsive.
    const fsAsync = (method, ...args) => new Promise((resolve, reject) => {
        fs[method](...args, (error, value) => error ? reject(error) : resolve(value));
    });
    async function retainedSize() {
        if (rootFd === null || !dataRoot) throw new Error('owned root descriptor unavailable');
        let total = 0, count = 0;
        try {
        const pinned = await fsAsync('fstat', rootFd), current = await fsAsync('lstat', dataRoot);
        if (!current.isDirectory() || current.isSymbolicLink() || current.dev !== pinned.dev || current.ino !== pinned.ino) throw new Error('owned root path identity changed');
        const walk = async (fd, depth) => {
            if (depth > 128) throw new Error('retained root depth limit');
            const anchor = '/proc/self/fd/' + fd;
            for (const entry of await fsAsync('readdir', anchor, { withFileTypes: true })) {
                if (++count > 100000) throw new Error('retained root entry limit');
                const name = path.join(anchor, entry.name), item = await fsAsync('lstat', name);
                if (item.dev !== pinned.dev) throw new Error('retained root crosses device boundary');
                if (item.isDirectory() && !item.isSymbolicLink()) {
                    const nested = await fsAsync('open', name, fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW);
                    try {
                        const opened = await fsAsync('fstat', nested);
                        if (opened.dev !== item.dev || opened.ino !== item.ino) throw new Error('retained child identity changed');
                        await walk(nested, depth + 1);
                    } finally { await fsAsync('close', nested); }
                } else { total += item.size; if (!Number.isSafeInteger(total)) throw new Error('retained root size overflow'); }
            }
        };
        await walk(rootFd, 0);
        const finalRoot = await fsAsync('lstat', dataRoot);
        if (!finalRoot.isDirectory() || finalRoot.isSymbolicLink() || finalRoot.dev !== pinned.dev || finalRoot.ino !== pinned.ino) throw new Error('owned root path identity changed during size scan');
        return total;
        } finally { const fd = rootFd; rootFd = null; await fsAsync('close', fd); }
    }
    function ownedEvidence() {
        if (!evidence) return { dataRoot, pid: (server || ownedServer)?.pid ?? null, outcome: 'UNKNOWN', stopped: false,
            reason: startInProgress ? 'STARTUP_IN_PROGRESS' : 'NOT_STOPPED', taskQuiescence: 'UNPROVEN',
            sizeBytes: null, sizeStatus: 'NOT_MEASURED', errors: [...pgErrors], lateExit, lateSizeSettled };
        const value = { ...evidence, errors: [...pgErrors], lateExit, lateSizeSettled };
        if (pgErrors.length) { value.outcome = 'UNKNOWN'; value.reason = 'PG_ERROR'; }
        return value;
    }
    function stopForEvidence(options = {}) {
        if (evidenceStop) return evidenceStop;
        interrupted = true;
        const child = server || ownedServer;
        const base = { dataRoot, pid: child?.pid ?? null, businessOutcome: 'UNKNOWN', rootEmpty: 'UNPROVEN',
            taskQuiescence: options.tasksQuiescent === true ? 'CALLER_ATTESTED_UNVERIFIED' : 'UNPROVEN',
            sizeBytes: null, sizeStatus: 'UNAVAILABLE' };
        const unknown = reason => {
            if (!startInProgress && rootFd !== null) {
                const fd = rootFd; rootFd = null;
                try { fs.closeSync(fd); } catch (error) { pgErrors.push('owned root descriptor close failed: ' + String(error?.message || error)); }
            }
            evidence = { ...base, outcome: 'UNKNOWN', stopped: false, reason }; return ownedEvidence();
        };
        if (options.tasksQuiescent !== true) { evidenceStop = Promise.resolve(unknown('TASKS_NOT_QUIESCENT')); return evidenceStop; }
        if (startInProgress) { evidenceStop = Promise.resolve(unknown('STARTUP_IN_PROGRESS')); return evidenceStop; }
        if (!child) { evidenceStop = Promise.resolve(unknown('NO_REGISTERED_CHILD')); return evidenceStop; }
        if (!Number.isSafeInteger(child.pid) || child.pid <= 0) { evidenceStop = Promise.resolve(unknown('INVALID_REGISTERED_PID')); return evidenceStop; }
        const timeoutMs = options.timeoutMs === undefined ? 5000 : options.timeoutMs;
        if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60000) { evidenceStop = Promise.resolve(unknown('INVALID_TIMEOUT')); return evidenceStop; }
        evidenceStop = new Promise(resolve => {
            let settled = false, childExited = false, scanPending = false;
            const finish = (value) => {
                if (settled) return; settled = true; clearTimeout(timer);
                if (value.outcome === 'UNKNOWN' && !scanPending && rootFd !== null && !startInProgress) {
                    const fd = rootFd; rootFd = null;
                    try { fs.closeSync(fd); } catch (error) { pgErrors.push('owned root descriptor close failed: ' + String(error?.message || error)); }
                }
                evidence = value; resolve(ownedEvidence());
            };
            const onExit = () => {
                if (settled) { if (evidence?.outcome === 'UNKNOWN' && !childExited) lateExit = true; return; }
                if (childExited) return;
                childExited = true; scanPending = true;
                retainedSize().then(size => {
                    scanPending = false;
                    if (settled) { lateSizeSettled = true; return; }
                    finish({ ...base, outcome: 'STOPPED', stopped: true, sizeBytes: size, sizeStatus: 'BEST_EFFORT_APPARENT_BYTES_SNAPSHOT' });
                }, error => {
                    scanPending = false;
                    if (settled) { lateSizeSettled = true; return; }
                    finish({ ...base, outcome: 'UNKNOWN', stopped: true, reason: 'SIZE_UNAVAILABLE', sizeError: String(error?.message || error) });
                });
            };
            const timer = setTimeout(() => finish({ ...base, outcome: 'UNKNOWN', stopped: childExited,
                reason: childExited ? 'SIZE_DEADLINE' : 'EXIT_DEADLINE', sizeStatus: scanPending ? 'UNKNOWN_IN_FLIGHT' : 'UNAVAILABLE' }), timeoutMs);
            child.once('error', error => { pgErrors.push(String(error?.stack || error)); finish({ ...base, outcome: 'UNKNOWN', stopped: childExited, reason: 'CHILD_ERROR' }); });
            child.once('exit', onExit);
            if (child.exitCode !== null || child.signalCode) { onExit(); return; }
            try { stop(options); } catch (error) { finish({ ...base, outcome: 'UNKNOWN', stopped: false, reason: 'STOP_SIGNAL_FAILED: ' + String(error.message || error) }); }
        });
        return evidenceStop;
    }
    for (const sig of ['SIGTERM', 'SIGINT', 'SIGHUP']) {
        process.once(sig, () => {
            interrupted = true;
            process.exitCode = 1;
            console.error('Owned PG signal ' + sig + ': work/exit unknown; directory retained; no stop or deletion requested');
        });
    }

    async function connect(user, database) {
        const c = new PG.Client({ host: '127.0.0.1', port, user, database });
        c.on('error', error => { pgErrors.push(String(error?.stack || error)); });
        await c.connect();
        return c;
    }

    function assertStartupActive() { if (interrupted) throw new Error('Owned PG startup interrupted; outcome unknown'); }
    async function start() {
        if (startAttempted) throw new Error('Owned PG harness is single-use');
        startAttempted = true; assertStartupActive();
        startInProgress = true;
        try {
        if (typeof process.getuid === 'function' && process.getuid() === 0) throw new Error('Root-owned PG startup disabled: permission changes forbidden');
        const user = null;
        const base = os.tmpdir();
        dataRoot = fs.mkdtempSync(path.join(base, 'zoe-paired-pg-'));
        rootFd = fs.openSync(dataRoot, fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW);
        const data = path.join(dataRoot, 'data');
        const sock = path.join(dataRoot, 'sock');
        fs.mkdirSync(data);
        fs.mkdirSync(sock);
        const [icmd, iargs] = wrap(path.join(pgBin.bin, 'initdb'),
            ['-D', data, '-U', 'supabase_admin', '--auth=trust', '-E', 'UTF8', '--locale=C', '--no-sync'], user, null);
        const init = cp.spawnSync(icmd, iargs, { encoding: 'utf8', timeout: 120000 });
        if (init.status !== 0) throw new Error('initdb ធ្លាក់ ៖ ' + String(init.stderr || init.error || '').slice(-600));
        port = await freePort();
        assertStartupActive();
        const [scmd, sargs] = wrap(path.join(pgBin.bin, 'postgres'), ['-D', data, '-p', String(port), '-k', sock,
            '-c', 'listen_addresses=127.0.0.1', '-c', 'fsync=off', '-c', 'synchronous_commit=off',
            '-c', 'full_page_writes=off', '-c', 'max_connections=60'], user, 'INT');
        let log = '';
        server = cp.spawn(scmd, sargs, { stdio: ['ignore', 'pipe', 'pipe'] });
        ownedServer = server;
        server.on('error', error => { pgErrors.push(String(error?.stack || error)); });
        server.stdout.on('data', (d) => { log = (log + d).slice(-4000); });
        server.stderr.on('data', (d) => { log = (log + d).slice(-4000); });
        const deadline = Date.now() + 30000;
        for (;;) {
            if (server.exitCode !== null) throw new Error('postgres ចេញមុនពេល ៖ ' + log.slice(-600));
            const c = new PG.Client({ host: '127.0.0.1', port, user: 'supabase_admin', database: 'postgres' });
            c.on('error', error => { pgErrors.push(String(error?.stack || error)); });
            try {
                await c.connect(); assertStartupActive();
                await c.end(); assertStartupActive();
                break;
            } catch (e) {
                try { await c.end(); } catch (x) {}
                assertStartupActive();
                if (Date.now() > deadline) throw new Error('postgres មិនឆ្លើយក្នុង ៣០ វិ. ៖ ' + log.slice(-600));
                await new Promise((r) => setTimeout(r, 150)); assertStartupActive();
            }
        }
        const sa = await connect('supabase_admin', 'postgres'); assertStartupActive();
        await sa.query('create role postgres superuser login'); assertStartupActive();
        await sa.query('alter database postgres owner to postgres'); assertStartupActive();
        await sa.end(); assertStartupActive();
        const pgc = await connect('postgres', 'postgres'); assertStartupActive();
        for (const f of SHIM_FILES.asPostgres) { await pgc.query(fs.readFileSync(path.join(shimDir, f), 'utf8')); assertStartupActive(); }
        await pgc.end(); assertStartupActive();
        const sa2 = await connect('supabase_admin', 'postgres'); assertStartupActive();
        for (const f of SHIM_FILES.asAdmin) { await sa2.query(fs.readFileSync(path.join(shimDir, f), 'utf8')); assertStartupActive(); }
        await sa2.end(); assertStartupActive();
        const gotrue = await connect('supabase_auth_admin', 'postgres'); assertStartupActive();
        for (const f of SHIM_FILES.asAuthAdmin) { await gotrue.query(fs.readFileSync(path.join(shimDir, f), 'utf8')); assertStartupActive(); }
        await gotrue.end(); assertStartupActive();
        } finally {
            startInProgress = false;
            if (evidence?.outcome === 'UNKNOWN' && rootFd !== null) {
                const fd = rootFd; rootFd = null;
                try { fs.closeSync(fd); } catch (error) { pgErrors.push('owned root descriptor close failed: ' + String(error?.message || error)); }
            }
        }
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
        PG, pgBin, bins, unavailableReason, start, stop, stopForEvidence, ownedEvidence, connect, freshDb, as, makeAuthUser,
        shimFiles: [].concat(SHIM_FILES.asPostgres, SHIM_FILES.asAdmin, SHIM_FILES.asAuthAdmin),
        denied: (r) => !!r.error && r.error.code === '42501' && /^permission denied/.test(r.error.message),
        raised: (r, token) => !!r.error && r.error.message === token
    };
}

module.exports = { createPgHarness };
