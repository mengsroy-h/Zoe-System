'use strict';
const fs = require('fs'), path = require('path'), net = require('net'), http = require('http'), cp = require('child_process');
const { createHash, randomBytes } = require('crypto');
const { StringDecoder } = require('string_decoder');
const PORT = 9000, START_MS = 60000, STOP_MS = 5000;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
function processIdentity(pid) {
    const text = fs.readFileSync('/proc/' + pid + '/stat', 'utf8'), at = text.lastIndexOf(')');
    const fields = text.slice(at + 2).trim().split(/\s+/);
    if (at < 0 || !/^\d+$/.test(fields[19] || '')) throw new Error('Owned process identity unavailable');
    return { pid, start: fields[19], state: fields[0], exe: fs.realpathSync('/proc/' + pid + '/exe'),
        args: fs.readFileSync('/proc/' + pid + '/cmdline', 'utf8').split('\0').filter(Boolean) };
}
function identityMatches(owner, seen) {
    return !!owner && !!seen && owner.pid === seen.pid && owner.start === seen.start && owner.exe === seen.exe
        && Array.isArray(owner.args) && Array.isArray(seen.args) && owner.args.length === seen.args.length && owner.args.every((value, index) => value === seen.args[index]);
}
function identityChanged(owner, seen, includeArgs = true) {
    return ['pid', 'start', 'exe', ...(includeArgs ? ['args'] : [])].filter(field => field === 'args'
        ? !identityMatches(owner, { ...owner, args: seen?.args }) : owner[field] !== seen?.[field]);
}
function identityError(message, changed = []) {
    const error = new Error(message); error.changed = changed; return error;
}
function readIdentity(pid, adapters) {
    let seen;
    try { seen = adapters.identity(pid); } catch (_) { throw identityError('Owned process identity unavailable'); }
    if (!seen || !Number.isSafeInteger(seen.pid) || typeof seen.start !== 'string' || !seen.start
        || typeof seen.exe !== 'string' || !seen.exe || !Array.isArray(seen.args) || seen.args.some(value => typeof value !== 'string')) {
        throw identityError('Owned process identity unavailable');
    }
    return { ...seen, args: seen.args.slice() };
}
function listenerMatches(texts, descriptors, port = PORT) {
    const sockets = new Set(descriptors.map(value => /^socket:\[(\d+)\]$/.exec(value)?.[1]).filter(Boolean));
    return texts.some(text => text.split('\n').slice(1).some(line => {
        const cells = line.trim().split(/\s+/), local = cells[1]?.split(':');
        return cells[3] === '0A' && parseInt(local?.[1], 16) === port
            && ['0100007F', '0000000000000000FFFF00000100007F'].includes(local[0]) && sockets.has(cells[9]);
    }));
}
function heapForCommand(args, env, cwd) {
    const guarded = args.length === 4 && args[1] === '--require'
        && path.resolve(cwd, args[2]) === path.join(cwd, 'audit-tools/runall-exit-guard.cjs');
    const script = guarded ? args[3] : args.length === 2 ? args[1] : null;
    const f03 = script && /^(?:node|node\.exe)$/.test(path.basename(args[0]))
        && path.resolve(cwd, script) === path.join(cwd, 'audit-tools/emu/registry-purge-atomic-sdk-test.js');
    return f03 && env.GITHUB_ACTIONS === 'true' && env.RUNNER_ENVIRONMENT === 'github-hosted' ? 1024 : 512;
}
function javaArguments(jar, maxHeapMiB = 512) {
    if (![512, 1024].includes(maxHeapMiB)) throw new Error('Unsupported owned JVM heap');
    return ['-Xmx' + maxHeapMiB + 'm', '-jar', jar, '--port', String(PORT), '--host', '127.0.0.1'];
}
function javaEnvironment(env) {
    const clean = { ...env }; for (const key of ['JAVA_TOOL_OPTIONS', 'JDK_JAVA_OPTIONS', '_JAVA_OPTIONS']) delete clean[key]; return clean;
}
function childEnvironment(env) {
    const origin = 'http://127.0.0.1:' + PORT;
    if ((env.F03_NATIVE_EMULATOR_URL && env.F03_NATIVE_EMULATOR_URL !== origin)
        || (env.SCANRULES_EMU_PORT && env.SCANRULES_EMU_PORT !== String(PORT))
        || (env.FIREBASE_DATABASE_EMULATOR_HOST && env.FIREBASE_DATABASE_EMULATOR_HOST !== '127.0.0.1:' + PORT)) throw new Error('Conflicting external emulator configuration');
    return { ...env, F03_NATIVE_EMULATOR_URL: origin };
}
function verifyJar(env, cwd) {
    const root = path.resolve(env.ZOE_REPO_ROOT || cwd), file = env.ZOE_RTDB_JAR;
    if (!file) { const error = new Error('Prepared RTDB JAR unavailable'); error.code = 'OWNED_RUNTIME_UNAVAILABLE'; throw error; }
    const jar = fs.realpathSync(file);
    const info = JSON.parse(fs.readFileSync(path.join(root, 'tools/firebase-provision/node_modules/firebase-tools/lib/emulator/downloadableEmulatorInfo.json'), 'utf8')).database;
    const algorithm = info.expectedChecksumSHA256 ? 'sha256' : 'md5', expected = info.expectedChecksumSHA256 || info.expectedChecksum;
    if (!Number.isSafeInteger(info.expectedSize) || info.expectedSize <= 0 || typeof expected !== 'string'
        || !new RegExp('^[a-f0-9]{' + (algorithm === 'sha256' ? 64 : 32) + '}$').test(expected)) throw new Error('Prepared RTDB JAR checksum/size mismatch');
    const fd = fs.openSync(jar, 'r'), pinned = createHash(algorithm), sha256 = createHash('sha256'), chunk = Buffer.alloc(65536); let bytes = 0;
    try {
        if (fs.fstatSync(fd).size !== info.expectedSize) throw new Error('Prepared RTDB JAR checksum/size mismatch');
        for (;;) { const read = fs.readSync(fd, chunk, 0, chunk.length, null); if (!read) break; bytes += read;
            if (bytes > info.expectedSize) throw new Error('Prepared RTDB JAR checksum/size mismatch'); pinned.update(chunk.subarray(0, read)); sha256.update(chunk.subarray(0, read)); }
        if (bytes !== info.expectedSize || pinned.digest('hex') !== expected) throw new Error('Prepared RTDB JAR checksum/size mismatch');
        return { jar, sha256: sha256.digest('hex'), bytes, algorithm, expected };
    } finally { fs.closeSync(fd); }
}
async function portFree() {
    const server = net.createServer(socket => socket.destroy());
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(PORT, '127.0.0.1', resolve); });
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}
function observeChild(child) {
    const exit = new Promise(resolve => {
        child.once('close', (code, signal) => resolve({ code, signal }));
        child.once('error', error => resolve({ code: null, signal: null, error: error.message }));
    });
    const stopped = new Promise(resolve => {
        child.once('exit', (code, signal) => resolve({ code, signal }));
        exit.then(resolve);
    });
    return { child, exit, stopped, ended: () => child.exitCode !== null || child.signalCode !== null };
}
function spawnProcess(command, args, options) {
    const child = cp.spawn(command, args, { ...options, shell: false, detached: false });
    const handle = observeChild(child);
    handle.spawned = new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); });
    return handle;
}
function strictResult(env) { return env.RUNALL_STRICT === '1' || env.CRUD_FLOW_STRICT === '1'; }
function listenerTables(exists = fs.existsSync, read = file => fs.readFileSync(file, 'utf8')) {
    return ['/proc/net/tcp', '/proc/net/tcp6'].filter(file => exists(file)).map(file => read(file));
}
function ownsListener(owner) {
    const dir = '/proc/' + owner.pid + '/fd';
    const descriptors = fs.readdirSync(dir).map(name => { try { return fs.readlinkSync(dir + '/' + name); } catch (_) { return ''; } });
    return listenerMatches(listenerTables(), descriptors);
}
async function readyRead(namespace) {
    return new Promise((resolve, reject) => {
        let timer;
        const request = http.get({ hostname: '127.0.0.1', port: PORT, path: '/.json?ns=' + namespace, agent: false, timeout: 1000 }, response => {
            let body = ''; response.setEncoding('utf8'); response.on('data', value => { body += value; if (body.length > 16) request.destroy(new Error('Readiness response too large')); });
            response.on('error', reject); response.on('aborted', () => reject(new Error('Readiness response aborted')));
            response.on('end', () => { clearTimeout(timer); resolve(response.statusCode === 200 && body.trim() === 'null'); });
        });
        timer = setTimeout(() => request.destroy(new Error('Readiness absolute deadline')), 1000);
        request.on('error', error => { clearTimeout(timer); reject(error); }); request.on('timeout', () => request.destroy(new Error('Readiness timed out')));
    });
}
async function within(promise, ms, label, signal) {
    let timer, abort;
    try {
        return await Promise.race([promise, new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error(label)), ms);
            abort = () => reject(new Error('Owned command interrupted'));
            signal?.addEventListener('abort', abort, { once: true }); if (signal?.aborted) abort();
        })]);
    } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
}
function validateSource(env, cwd) {
    const root = path.resolve(env.ZOE_REPO_ROOT || cwd);
    if ((!fs.existsSync(path.join(root, 'ZoeW/src/main.tsx')) && !fs.existsSync(path.join(root, 'ZoeW/app.js')))
        || !fs.existsSync(path.join(root, 'firebase-database.rules.json'))) throw new Error('Owned command source root is empty or incomplete');
}
function productionAdapters(sinks = { stdout: process.stdout, stderr: process.stderr }) {
    return { validateSource, now: Date.now, delay, verifyJar, portFree, identity: processIdentity, ownsListener, readyRead,
        launch: (jar, env, log, maxHeapMiB) => {
            const fd = fs.openSync(log, 'wx'); let handle;
            try { handle = spawnProcess('java', javaArguments(jar, maxHeapMiB), { env: javaEnvironment(env), stdio: ['ignore', fd, fd] }); }
            finally { fs.closeSync(fd); }
            return handle;
        },
        command: (args, env, cwd) => {
            const handle = spawnProcess(args[0], args.slice(1), { env, cwd, stdio: ['ignore', 'pipe', 'pipe'] });
            let outputPresent = false, failureLine = false, skipLine = false;
            const streams = Object.fromEntries(['out', 'err'].map(name => [name, { decoder: new StringDecoder('utf8'), prefix: '', started: false }]));
            const inspect = (stream, text, final = false) => {
                outputPresent ||= text.trim().length > 0;
                const pieces = text.split('\n');
                for (let index = 0; index < pieces.length; index++) {
                    const ended = index < pieces.length - 1 || final;
                    const piece = stream.started ? pieces[index] : pieces[index].trimStart();
                    if (piece.length) stream.started = true;
                    stream.prefix = (stream.prefix + piece).slice(0, 128);
                    failureLine ||= /^(?:FAIL\s|❌\s|\*\*\* FAIL \*\*\*)/u.test(stream.prefix);
                    skipLine ||= /^(?:SKIP(?:PED)?|PARTIAL PASS)\s/u.test(stream.prefix)
                        || ended && /^(?:SKIP(?:PED)?|PARTIAL PASS)(?:\s|$)/u.test(stream.prefix);
                    if (ended) { stream.prefix = ''; stream.started = false; }
                }
            };
            const accept = (name, target) => data => {
                if (target.write(data) === false) {
                    const readable = name === 'out' ? handle.child.stdout : handle.child.stderr;
                    readable.pause(); target.once('drain', () => readable.resume());
                }
                inspect(streams[name], streams[name].decoder.write(data));
            };
            handle.child.stdout.on('data', accept('out', sinks.stdout)); handle.child.stderr.on('data', accept('err', sinks.stderr));
            handle.exit = handle.exit.then(value => {
                for (const stream of Object.values(streams)) inspect(stream, stream.decoder.end(), true);
                return { ...value, outputPresent, failureLine, skipLine };
            }); return handle;
        },
        signal: (handle, name) => handle.child.kill(name), within };
}
async function acquireOwner(handle, expectedArgs, adapters, deadline, acquisition, interruptible) {
    let anchor;
    while (adapters.now() < deadline) {
        if (handle.ended()) throw new Error('Owned JVM ended before ownership');
        acquisition.attempts++;
        const seen = readIdentity(handle.child.pid, adapters);
        const changed = identityChanged(anchor || { ...seen, pid: handle.child.pid }, seen, false);
        if (changed.length) { acquisition.changed = changed; throw identityError('Owned JVM identity changed during acquisition', changed); }
        anchor ||= { pid: seen.pid, start: seen.start, exe: seen.exe };
        acquisition.state = 'PROVISIONAL';
        if (seen.args.length) {
            acquisition.argv = seen.args[0] === 'java' && seen.args.length === expectedArgs.length + 1 && expectedArgs.every((value, index) => seen.args[index + 1] === value)
                ? 'EXPECTED' : 'NONEMPTY_MISMATCH';
            acquisition.state = acquisition.argv === 'EXPECTED' ? 'VERIFIED' : 'OBSERVED';
            return seen;
        }
        acquisition.argv = 'EMPTY'; acquisition.emptyReads++;
        await interruptible(adapters.delay(Math.max(0, Math.min(100, deadline - adapters.now()))));
    }
    throw new Error('Owned JVM acquisition deadline');
}
async function waitReady(handle, owner, adapters, signal, deadline = adapters.now() + START_MS) {
    const namespace = 'demo-owned-ready-' + process.pid + '-' + randomBytes(8).toString('hex');
    const checkIdentity = () => {
        const seen = readIdentity(owner.pid, adapters);
        if (!identityMatches(owner, seen)) throw identityError('Owned JVM ended or identity changed before readiness', identityChanged(owner, seen));
        if (handle.ended()) throw new Error('Owned JVM ended or identity changed before readiness');
    };
    while (adapters.now() < deadline) {
        if (signal?.aborted) throw new Error('Owned command interrupted');
        checkIdentity();
        let ready = false;
        try { ready = adapters.ownsListener(owner) && await within(adapters.readyRead(namespace), Math.max(0, deadline - adapters.now()), 'Owned JVM readiness deadline', signal); }
        catch (_) {}
        checkIdentity();
        if (signal?.aborted) throw new Error('Owned command interrupted');
        if (ready && adapters.now() < deadline) {
            try { if (adapters.ownsListener(owner)) return; } catch (_) {}
        }
        if (adapters.now() < deadline) await adapters.delay(Math.min(100, deadline - adapters.now()));
    }
    throw new Error('Owned JVM readiness deadline');
}
async function stopProcess(handle, owner, adapters, label, requireOwner = false) {
    if (!handle) return;
    if (requireOwner && !owner) throw new Error(label + ' ownership unverified; refusing signal');
    if (handle.ended()) { await adapters.within(handle.exit, STOP_MS, label + ' close deadline'); return; }
    const checkIdentity = suffix => {
        if (!owner) return;
        const seen = readIdentity(owner.pid, adapters);
        if (!identityMatches(owner, seen)) throw identityError(label + ' identity changed; refusing ' + suffix, identityChanged(owner, seen));
    };
    checkIdentity('signal'); adapters.signal(handle, 'SIGTERM');
    try { await adapters.within(handle.exit, STOP_MS, label + ' TERM deadline'); }
    catch (_) {
        if (handle.ended()) { await adapters.within(handle.exit, STOP_MS, label + ' close deadline'); return; }
        checkIdentity('KILL'); adapters.signal(handle, 'SIGKILL');
        await adapters.within(handle.exit, STOP_MS, label + ' KILL deadline');
    }
}
async function runOwnedCommand(options, adapters = productionAdapters()) {
    const { stateDir, args, env = process.env, cwd = process.cwd(), signal } = options;
    if (!path.isAbsolute(stateDir || '') || !Array.isArray(args) || !args.length || args.some(value => typeof value !== 'string' || !value)) throw new Error('Owned command requires absolute state directory and argv');
    fs.mkdirSync(stateDir, { recursive: true, mode: 0o700 });
    const lock = path.join(stateDir, 'active'), blocked = path.join(stateDir, 'blocked.json');
    const report = { acquisition: null, diagnostics: [], status: 'FAIL', commandStarted: false, commandCompleted: false, ownedRuntimeStarted: false, cleanup: false, childResult: null, owner: null, errors: [] };
    if (fs.existsSync(blocked) || fs.existsSync(lock)) return { code: 1, report: { ...report, errors: ['Prior owned runtime cleanup unproven; command UNRUN'] } };
    fs.mkdirSync(lock, { mode: 0o700 });
    const directory = path.join(stateDir, 'scope-' + process.pid + '-' + randomBytes(8).toString('hex')); fs.mkdirSync(directory, { mode: 0o700 });
    let engine, command, owner, acquired = false, cleanupError = null, unrun = false, stage = 'PREFLIGHT', startedAt = adapters.now();
    const interrupted = Symbol('interrupted'); let onAbort;
    const aborted = new Promise(resolve => { onAbort = () => resolve(interrupted); signal?.addEventListener('abort', onAbort, { once: true }); });
    const checkAbort = () => { if (signal?.aborted) throw new Error('Owned command interrupted'); };
    const interruptible = async promise => { const result = await Promise.race([promise, aborted]); checkAbort(); if (result === interrupted) throw new Error('Owned command interrupted'); return result; };
    const diagnostic = (error, failureStage) => ({ stage: failureStage, elapsedMs: Math.max(0, adapters.now() - startedAt),
        changed: ['pid', 'start', 'exe', 'args'].filter(field => Array.isArray(error.changed) && error.changed.includes(field)) });
    const recordFailure = error => { report.errors.push(String(error.message || error)); report.diagnostics.push(diagnostic(error, stage)); };
    try {
        checkAbort();
        adapters.validateSource(env, cwd);
        const noNativeOptIn = !strictResult(env) && env.F03_RUN_NATIVE_ENGINE !== '1' && args.some(value => /(?:^|\/)registry-purge-atomic-sdk-test\.js$/.test(value));
        if (noNativeOptIn) {
            stage = 'COMMAND'; command = adapters.command(args, env, cwd); await interruptible(command.spawned); report.commandStarted = true;
            report.childResult = await interruptible(command.exit); report.commandCompleted = true;
            if (report.childResult.code !== 0 || report.childResult.error || report.childResult.outputPresent !== true || report.childResult.failureLine) throw new Error('Original construction-only command failed');
            unrun = true;
        } else {
        const childEnv = childEnvironment(env), jar = adapters.verifyJar(env, cwd), maxHeapMiB = heapForCommand(args, env, cwd);
        await adapters.portFree();
        if (signal?.aborted) throw new Error('Owned command interrupted');
        stage = 'ACQUIRE'; startedAt = adapters.now(); const deadline = startedAt + START_MS;
        const acquisition = report.acquisition = { stage, state: 'UNOBSERVED', argv: 'UNAVAILABLE', attempts: 0, emptyReads: 0, changed: [], elapsedMs: 0 };
        engine = adapters.launch(jar.jar, env, path.join(directory, 'emulator.log'), maxHeapMiB);
        const engineEnded = Symbol('engine ended'), lostEngine = (engine.stopped || engine.exit).then(() => engineEnded);
        await interruptible(within(engine.spawned, Math.max(0, deadline - adapters.now()), 'Owned JVM launch deadline', signal));
        try {
            const seen = await acquireOwner(engine, javaArguments(jar.jar, maxHeapMiB), adapters, deadline, acquisition, interruptible);
            owner = { ...seen, jar: jar.jar, jarSHA256: jar.sha256, expectedArgs: javaArguments(jar.jar, maxHeapMiB), maxHeapMiB };
        } finally { acquisition.elapsedMs = Math.max(0, adapters.now() - startedAt); }
        report.owner = { pid: owner.pid, start: owner.start, executable: owner.exe, jarSHA256: jar.sha256, maxHeapMiB, port: PORT };
        checkAbort();
        if (acquisition.state !== 'VERIFIED') throw new Error('Owned JVM argv mismatch');
        fs.writeFileSync(path.join(directory, 'owner.json'), JSON.stringify(owner) + '\n', { flag: 'wx' }); acquired = true;
        try { adapters.ownerAcquired?.({ ...owner, args: owner.args.slice(), expectedArgs: owner.expectedArgs.slice() }); }
        catch (_) { throw new Error('Owned JVM ownership observer failed'); }
        stage = 'READY'; await interruptible(waitReady(engine, owner, adapters, signal, deadline)); report.ownedRuntimeStarted = true;
        checkAbort(); if (engine.ended()) throw new Error('Owned JVM ended before original command completed');
        stage = 'COMMAND'; command = adapters.command(args, childEnv, cwd);
        if (await interruptible(Promise.race([command.spawned, lostEngine])) === engineEnded || engine.ended()) throw new Error('Owned JVM ended before original command completed');
        report.commandStarted = true;
        const childResult = await interruptible(Promise.race([command.exit, lostEngine]));
        if (childResult === engineEnded || engine.ended()) throw new Error('Owned JVM ended before original command completed');
        report.childResult = childResult; report.commandCompleted = true;
        if (report.childResult.error || report.childResult.code !== 0 || report.childResult.outputPresent !== true || report.childResult.failureLine) throw new Error('Original command failed or produced no evidence');
        if (report.childResult.skipLine && strictResult(env)) throw new Error('STRICT original command was incomplete');
        const after = adapters.verifyJar(env, cwd); if (after.sha256 !== jar.sha256 || after.jar !== jar.jar) throw new Error('Prepared JAR changed during command');
        if (report.childResult.skipLine) unrun = true;
        }
    } catch (error) {
        recordFailure(error);
        if (!strictResult(env) && !engine && error.code === 'OWNED_RUNTIME_UNAVAILABLE') unrun = true;
    }
    finally {
        signal?.removeEventListener('abort', onAbort);
        const cleanupFailures = [];
        for (const [handle, identity, label, requireOwner] of [[command, null, 'Original checker', false], [engine, owner, 'Owned JVM', true]]) {
            try { if (handle) await stopProcess(handle, identity, adapters, label, requireOwner); }
            catch (error) { cleanupFailures.push(String(error.message || error)); report.diagnostics.push(diagnostic(error, 'CLEANUP')); }
        }
        try { if (engine) await adapters.portFree(); } catch (error) { cleanupFailures.push(String(error.message || error)); }
        report.cleanup = cleanupFailures.length === 0;
        if (!report.cleanup) { cleanupError = cleanupFailures.join('; '); report.errors.push(cleanupError); }
        if (!report.cleanup) fs.writeFileSync(blocked, JSON.stringify({ status: 'CLEANUP_UNPROVEN', directory, owner: report.owner }) + '\n');
        else fs.rmdirSync(lock);
        if (!acquired && engine && !report.cleanup) report.errors.push('Launch ownership was not committed');
        report.status = unrun && report.cleanup ? 'UNRUN' : !report.errors.length && report.commandCompleted && report.cleanup ? 'PASS' : 'FAIL';
        fs.writeFileSync(path.join(directory, 'result.json'), JSON.stringify(report, null, 2) + '\n');
        if (report.status === 'FAIL') fs.writeFileSync(path.join(stateDir, 'failed.json'), JSON.stringify({ directory, cleanup: report.cleanup }) + '\n');
    }
    const childCode = report.childResult?.code;
    const code = ['PASS', 'UNRUN'].includes(report.status) ? 0 : Number.isInteger(childCode) && childCode > 0 && childCode < 256 ? childCode : 1;
    return { code, report, directory };
}
async function main() {
    const args = process.argv.slice(2), separator = args.indexOf('--');
    if (args[0] !== '--state' || separator !== 2) throw new Error('Usage: owned-rtdb-command.js --state <absolute-private-dir> -- <command> [args]');
    const controller = new AbortController(); const stop = () => controller.abort();
    for (const event of ['SIGTERM', 'SIGINT', 'SIGHUP']) process.on(event, stop);
    try {
        const result = await runOwnedCommand({ stateDir: path.resolve(args[1]), args: args.slice(3), signal: controller.signal });
        console.log(JSON.stringify({ ownedRTDB: result.report, evidenceDirectory: result.directory }));
        if (result.report.status === 'UNRUN') console.log('SKIP owned RTDB engine UNRUN; no backend evidence');
        if (result.code) console.error('FAIL owned RTDB command; original/cleanup evidence retained');
        process.exitCode = result.code;
    } finally { for (const event of ['SIGTERM', 'SIGINT', 'SIGHUP']) process.removeListener(event, stop); }
}
module.exports = { runOwnedCommand, identityMatches, listenerMatches, listenerTables, heapForCommand, javaArguments, javaEnvironment, childEnvironment, verifyJar, waitReady, productionAdapters, strictResult, validateSource };
if (require.main === module) main().catch(error => { console.error('FAIL owned RTDB command: ' + String(error.message || error)); process.exitCode = 1; });
