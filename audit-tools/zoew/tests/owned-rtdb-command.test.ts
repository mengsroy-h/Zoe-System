import { afterEach, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { Writable } from 'node:stream';
const require = createRequire(import.meta.url);
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const helper = require(process.env.OWNED_HELPER_SOURCE_FILE || path.join(repo, 'audit-tools/owned-rtdb-command.js'));
const runnerRoot = process.env.OWNED_SCOPE_SOURCE_ROOT || repo;
const temporaryPaths: string[] = [];
afterEach(() => { for (const dir of temporaryPaths.splice(0)) fs.rmSync(dir, { recursive: true, force: true }); });
function temporary() { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zoe-owned-unit-')); temporaryPaths.push(dir); return dir; }
function fakeRuntime(options: Record<string, any> = {}) {
    let clock = 0, active = 0, serial = 10, jarChecks = 0, launchedHeap = 512; const events: any[] = [];
    const handles: any[] = [];
    function handle(kind: string) {
        let resolve: any; const h: any = { child: { pid: ++serial }, kind, done: false, spawned: Promise.resolve(), ended: () => h.done };
        h.exit = new Promise(r => { resolve = r; }); h.finish = (code: number | null, signal: string | null = null) => { if (h.done) return; h.done = true; if (kind === 'engine') active--; resolve({ code, signal, outputPresent: options.output !== false, failureLine: options.failureLine === true, skipLine: options.skip === true }); };
        handles.push(h); return h;
    }
    const adapter = {
        validateSource() { if (options.empty) throw new Error('Owned command source root is empty or incomplete'); },
        now: () => clock, delay: async (ms: number) => { clock += ms; },
        verifyJar() { if (options.jarMissing) { const e: any = new Error('Prepared RTDB JAR unavailable'); e.code = 'OWNED_RUNTIME_UNAVAILABLE'; throw e; } return { jar: '/verified/emulator.jar', sha256: (++jarChecks > 1 && options.jarDrift ? 'b' : 'a').repeat(64) }; },
        portFree: async () => { if (options.foreign || active) throw new Error('EADDRINUSE foreign or live engine'); },
        launch: (_jar: string, _env: unknown, _log: string, heap = 512) => { launchedHeap = options.forceHeap || heap; events.push(['launch']); const h = handle('engine'); active++; return h; },
        identity: (pid: number) => ({ pid, start: options.changed ? 'changed' : '100', state: 'S', exe: '/java', args: ['java', ...helper.javaArguments('/verified/emulator.jar', launchedHeap)] }),
        ownsListener: () => options.listener !== false,
        readyRead: async () => { if (options.changeAfterRead) options.changed = true; return options.ready !== false; },
        command: (args: string[], env: Record<string, string>) => { events.push(['command', args, env]); const h = handle('command'); queueMicrotask(() => h.finish(options.code || 0)); return h; },
        signal: (h: any, signal: string) => { events.push(['signal', h.child.pid, signal]); if (!options.unsettled) h.finish(null, signal); },
        within: async (p: Promise<any>, _ms: number, _label: string) => { if (options.unsettled) throw new Error('forced cleanup deadline'); return p; }
    };
    return { adapter, events, handles, active: () => active };
}
async function execute(options: Record<string, any> = {}, env: Record<string, string> = { RUNALL_STRICT: '1' }, state = temporary()) {
    const fake = fakeRuntime(options); const result = await helper.runOwnedCommand({ stateDir: state, args: ['node', 'audit-tools/emu/fake.js'], env }, fake.adapter); return { ...fake, result, state };
}
function runnerFixture() {
    const dir = temporary(), sh = fs.readFileSync(path.join(runnerRoot, 'audit-tools/run-all.sh'), 'utf8');
    const block = sh.slice(sh.search(/^#@runner-begin$/m), sh.search(/^#@runner-end$/m));
    fs.mkdirSync(path.join(dir, 'audit-tools/emu'), { recursive: true });
    const exitGuard = path.join(runnerRoot, 'audit-tools/runall-exit-guard.cjs');
    if (fs.existsSync(exitGuard)) fs.copyFileSync(exitGuard, path.join(dir, 'audit-tools/runall-exit-guard.cjs'));
    const original = path.join(dir, 'old-engine.json'), records = path.join(dir, 'records.jsonl');
    fs.writeFileSync(original, JSON.stringify({ owner: 'prestarted-global', members: ['prior-checker'] }));
    const child = `const fs=require('fs');const f=process.env.FX_ENGINE;const x=JSON.parse(fs.readFileSync(f));fs.appendFileSync(process.env.FX_RECORDS,JSON.stringify({owner:x.owner,before:x.members.slice()})+'\\n');x.members.push(process.argv[1]);fs.writeFileSync(f,JSON.stringify(x));console.log('   ok    original child completed');process.exitCode=0;`;
    for (const name of ['a', 'b']) fs.writeFileSync(path.join(dir, 'audit-tools/emu/' + name + '.js'), child);
    const manager = path.join(dir, 'fake-owner.cjs');
    fs.writeFileSync(manager, `const fs=require('fs'),cp=require('child_process'),path=require('path');const file=path.join(__dirname,'owned-'+process.pid+'.json');fs.writeFileSync(file,JSON.stringify({owner:'own-'+process.pid,members:[]}));const r=cp.spawnSync(process.argv[2],process.argv.slice(3),{stdio:'inherit',env:{...process.env,FX_ENGINE:file}});fs.unlinkSync(file);process.exitCode=r.status;`);
    const inject = `\nrunall_prepare_command() { RUNALL_COMMAND=("$@"); if runall_needs_rtdb "$@"; then RUNALL_COMMAND=(node '${manager}' "$@"); fi; }\n`;
    const script = path.join(dir, 'harness.sh');
    fs.writeFileSync(script, `pass=0;fail=0;skip=0;partial=0\nHAS_TIMEOUT=1\nCHECKER_TIMEOUT=5\n${block}\n${inject}\nrun a node audit-tools/emu/a.js\nrun b node audit-tools/emu/b.js\nrunall_drain\nrunall_exit_status\ncode=$?\nif declare -F runall_cleanup_owned >/dev/null; then runall_cleanup_owned; fi\nexit "$code"\n`);
    const env = { ...process.env, RUNALL_JOBS: '2', RUNALL_STATE: '', RUNALL_PROGRESS: '0', FX_ENGINE: original, FX_RECORDS: records };
    for (const key of ['RUNALL_ONLY', 'RUNALL_SHARD', 'RUNALL_RESUME']) delete env[key];
    const run = spawnSync('bash', [script], { cwd: dir, env, encoding: 'utf8', timeout: 10000 });
    const rows = fs.existsSync(records) ? fs.readFileSync(records, 'utf8').trim().split('\n').map(x => JSON.parse(x)) : [];
    return { run, rows };
}
it('fresh namespace per successive canonical task, preserving both original executions', () => {
    const { run, rows } = runnerFixture(); expect(run.status, run.stderr).toBe(0); expect(rows).toHaveLength(2); expect(rows.map(x => x.before)).toEqual([[], []]);
});
it('new owned identity per successive canonical task rather than prestarted owner reuse', () => {
    const { run, rows } = runnerFixture(); expect(run.status, run.stderr).toBe(0); expect(rows).toHaveLength(2); expect(new Set(rows.map(x => x.owner)).size).toBe(2); expect(rows.every(x => x.owner !== 'prestarted-global')).toBe(true);
});
it('actual helper runs original argv once after owned readiness and closes its engine', async () => {
    const x = await execute(); expect(x.result.code).toBe(0); expect(x.result.report.cleanup).toBe(true); expect(x.events.filter(x => x[0] === 'command')).toHaveLength(1); expect(x.active()).toBe(0); expect(x.events.map(x => x[0])).toEqual(['launch', 'command', 'signal']);
});
it('foreign port never launches, adopts, signals or dispatches', async () => {
    const x = await execute({ foreign: true }); expect(x.result.code).toBe(1); expect(x.events).toEqual([]); expect(x.result.report.commandStarted).toBe(false);
});
it('changed process identity refuses signalling and blocks the next owned scope', async () => {
    const x = await execute({ changeAfterRead: true }); expect(x.result.code).toBe(1); expect(x.result.report.cleanup).toBe(false); expect(x.events.filter(x => x[0] === 'signal')).toEqual([]);
    const next = await execute({}, { RUNALL_STRICT: '1' }, x.state); expect(next.events).toEqual([]); expect(next.result.code).toBe(1);
});
it('unsettled cleanup never releases lease or permits another runtime', async () => {
    const x = await execute({ unsettled: true }); expect(x.events.some(event => event[0] === 'signal' && event[1] === x.handles[0].child.pid)).toBe(true); expect(x.result.code).toBe(1); expect(fs.existsSync(path.join(x.state, 'active'))).toBe(true);
    const next = await execute({}, { RUNALL_STRICT: '1' }, x.state); expect(next.events).toEqual([]); expect(next.result.report.errors[0]).toContain('UNRUN');
});
it('original command failure remains exact nonzero while a clean next scope may run', async () => {
    const x = await execute({ code: 17 }); expect(x.result.code).toBe(17); expect(x.result.report.childResult.code).toBe(17); expect(x.result.report.cleanup).toBe(true);
    const next = await execute({}, { RUNALL_STRICT: '1' }, x.state); expect(next.result.code).toBe(0); expect(next.events.filter(x => x[0] === 'command')).toHaveLength(1);
});
it('STRICT missing runtime fails without a child; nonSTRICT reports only UNRUN', async () => {
    const strict = await execute({ jarMissing: true }); expect(strict.result.code).toBe(1); expect(strict.result.report.commandStarted).toBe(false);
    const local = await execute({ jarMissing: true }, {}); expect(local.result.code).toBe(0); expect(local.result.report.status).toBe('UNRUN'); expect(local.events).toEqual([]);
});
it('empty source cannot escape through runtime-unavailable SKIP', async () => {
    const x = await execute({ empty: true, jarMissing: true }, {}); expect(x.result.code).toBe(1); expect(x.result.report.status).toBe('FAIL');
});
it('conflicting external origin cannot bypass owned runtime in CI', async () => {
    const x = await execute({}, { RUNALL_STRICT: '1', F03_NATIVE_EMULATOR_URL: 'http://127.0.0.1:19001' }); expect(x.result.code).toBe(1); expect(x.events).toEqual([]);
});
it('readiness HTTP response alone cannot adopt a foreign listener', async () => {
    const x = await execute({ listener: false }); expect(x.result.code).toBe(1); expect(x.events.filter(x => x[0] === 'command')).toEqual([]); expect(x.active()).toBe(0);
});
it('exact identity binds start, executable and every Java argument', () => {
    const owner = { pid: 2, start: '3', exe: '/java', args: ['java', '-Xmx512m'] }; expect(helper.identityMatches(owner, { ...owner })).toBe(true);
    for (const mutant of [{ ...owner, pid: 9 }, { ...owner, start: '9' }, { ...owner, exe: '/foreign' }, { ...owner, args: ['java', '-Xmx1g'] }]) expect(helper.identityMatches(owner, mutant)).toBe(false);
});
it('listener inode and loopback address must belong to the captured child', () => {
    const table = 'header\n0: 0100007F:2328 00000000:0000 0A 0 0 0 0 0 777 0\n'; expect(helper.listenerMatches([table], ['socket:[777]'])).toBe(true); expect(helper.listenerMatches([table], ['socket:[778]'])).toBe(false); expect(helper.listenerMatches([table.replace('0100007F', '00000000')], ['socket:[777]'])).toBe(false);
});
it('listener tables: a host without IPv6 has no tcp6 table, yet the tcp table still decides ownership', () => {
    const tcp = 'header\n0: 0100007F:2328 00000000:0000 0A 0 0 0 0 0 777 0\n';
    const only = (present) => ({ exists: (file) => present.includes(file), read: (file) => { if (!present.includes(file)) throw new Error('ENOENT ' + file); return file.endsWith('6') ? 'header\n' : tcp; } });
    const v4 = only(['/proc/net/tcp']);
    expect(helper.listenerTables(v4.exists, v4.read)).toEqual([tcp]);
    expect(helper.listenerMatches(helper.listenerTables(v4.exists, v4.read), ['socket:[777]'])).toBe(true);
    expect(helper.listenerMatches(helper.listenerTables(v4.exists, v4.read), ['socket:[778]'])).toBe(false);
    const both = only(['/proc/net/tcp', '/proc/net/tcp6']);
    expect(helper.listenerTables(both.exists, both.read)).toEqual([tcp, 'header\n']);
    const none = only([]);
    expect(helper.listenerTables(none.exists, none.read)).toEqual([]);
    expect(helper.listenerMatches(helper.listenerTables(none.exists, none.read), ['socket:[777]'])).toBe(false);
});
it('per-JVM heap remains512 and inherited Java option injection is removed only for owned Java', () => {
    expect(helper.javaArguments('/verified/jar')).toEqual(['-Xmx512m', '-jar', '/verified/jar', '--port', '9000', '--host', '127.0.0.1']);
    const env = { JAVA_TOOL_OPTIONS: '-Xmx1g', JDK_JAVA_OPTIONS: 'x', _JAVA_OPTIONS: 'x', KEEP: 'yes' }; expect(helper.javaEnvironment(env)).toEqual({ KEEP: 'yes' }); expect(env.JAVA_TOOL_OPTIONS).toBe('-Xmx1g');
});
it('helper import is require-safe and unknown CLI arguments fail without starting a runtime', () => {
    const file = path.join(repo, 'audit-tools/owned-rtdb-command.js'); const loaded = spawnSync(process.execPath, ['-e', `process.exitCode=0;require(${JSON.stringify(file)});if(process.exitCode!==0)throw Error('changed exitCode')`], { encoding: 'utf8' }); expect(loaded.status).toBe(0);
    const rejected = spawnSync(process.execPath, [file, '--unknown'], { encoding: 'utf8' }); expect(rejected.status).toBe(1); expect(rejected.stderr).toContain('Usage:');
});

it('empty or FAIL output cannot turn into PASS because the owner prints a JSON report', async () => {
    for (const options of [{ output: false }, { failureLine: true }, { skip: true }]) { const x = await execute(options); expect(x.result.code).toBe(1); expect(x.result.report.status).toBe('FAIL'); }
});

it('at most one active owner is admitted when two controller calls overlap', async () => {
    const state = temporary(); const first = execute({}, { RUNALL_STRICT: '1' }, state); const second = execute({}, { RUNALL_STRICT: '1' }, state);
    const [a, b] = await Promise.all([first, second]); expect(a.result.code).toBe(0); expect(b.result.code).toBe(1); expect(b.events).toEqual([]);
});
it('actual preinstalled JAR validation checks pinned size and checksum without running Java', () => {
    const root = temporary(), metadata = path.join(root, 'tools/firebase-provision/node_modules/firebase-tools/lib/emulator/downloadableEmulatorInfo.json');
    fs.mkdirSync(path.dirname(metadata), { recursive: true }); const jar = path.join(root, 'synthetic.jar'), bytes = Buffer.from('synthetic fixture only'); fs.writeFileSync(jar, bytes);
    fs.writeFileSync(metadata, JSON.stringify({ database: { expectedSize: bytes.length, expectedChecksumSHA256: createHash('sha256').update(bytes).digest('hex') } }));
    expect(helper.verifyJar({ ZOE_RTDB_JAR: jar }, root).sha256).toBe(createHash('sha256').update(bytes).digest('hex'));
    fs.writeFileSync(jar, 'tampered'); expect(() => helper.verifyJar({ ZOE_RTDB_JAR: jar }, root)).toThrow('checksum/size');
    expect(() => helper.validateSource({}, root)).toThrow('empty or incomplete');
});
it('actual Node child output cannot be replaced by owner JSON as completion evidence', async () => {
    const scripts = ["console.log('   ok    child evidence')", 'void 0', "console.log('FAIL expected synthetic refusal')", "console.log('SKIP synthetic missing runtime')"];
    for (const [index, script] of scripts.entries()) {
        const fake = fakeRuntime(); fake.adapter.command = helper.productionAdapters({ stdout: { write() {} }, stderr: { write() {} } }).command;
        const result = await helper.runOwnedCommand({ stateDir: temporary(), args: [process.execPath, '-e', script], env: { RUNALL_STRICT: '1' } }, fake.adapter);
        expect(result.code).toBe(index === 0 ? 0 : 1); expect(result.report.cleanup).toBe(true);
    }
});

it('local SKIP cannot hide a changed JAR after an attempted runtime', async () => {
    const x = await execute({ skip: true, jarDrift: true }, {}); expect(x.result.code).toBe(1); expect(x.result.report.status).toBe('FAIL');
});
it('existing local F03 no-opt-in path stays construction-only and never starts Java', async () => {
    const fake = fakeRuntime({ jarMissing: true }); const result = await helper.runOwnedCommand({ stateDir: temporary(), args: ['node', 'audit-tools/emu/registry-purge-atomic-sdk-test.js'], env: {} }, fake.adapter);
    expect(result.code).toBe(0); expect(result.report.status).toBe('UNRUN'); expect(fake.events.map(x => x[0])).toEqual(['command']);
});
it('BASE cleanup uncertainty cannot be hidden by the diagnostic pipeline', () => {
    const text = fs.readFileSync(path.join(runnerRoot, 'audit-tools/run-all.sh'), 'utf8'), block = text.slice(text.search(/^#@runner-begin$/m), text.search(/^#@runner-end$/m));
    const tail = text.slice(text.lastIndexOf('\nrunall_summary\n')), dir = temporary(), state = path.join(dir, 'state'); fs.mkdirSync(state); fs.writeFileSync(path.join(state, 'blocked.json'), '{}');
    const script = path.join(dir, 'base-tail.sh'); fs.writeFileSync(script, `pass=0;fail=0;skip=0;partial=0\n${block}\nRUNALL_OWNED_DIR='${state}'\nrunall_summary() { :; }\nrunall_exit_status() { return 0; }\n${tail}`);
    const result = spawnSync('bash', [script], { encoding: 'utf8', timeout: 5000 }); expect(result.status).toBe(1); expect(result.stdout).toContain('retained');
});

it('split UTF8 failure glyph from an actual child cannot be masked as owner PASS', async () => {
    const fake = fakeRuntime(); fake.adapter.command = helper.productionAdapters({ stdout: { write() {} }, stderr: { write() {} } }).command;
    const script = "process.stdout.write(Buffer.from([0xe2]));setTimeout(()=>process.stdout.write(Buffer.from([0x9d,0x8c,0x20,0x66,0x61,0x69,0x6c,0x0a])),80)";
    const result = await helper.runOwnedCommand({ stateDir: temporary(), args: [process.execPath, '-e', script], env: { RUNALL_STRICT: '1' } }, fake.adapter);
    expect(result.code).toBe(1); expect(result.report.childResult.failureLine).toBe(true); expect(result.report.cleanup).toBe(true);
});
it('long original FAIL line keeps its first prefix across actual child chunks', async () => {
    const fake = fakeRuntime(); fake.adapter.command = helper.productionAdapters({ stdout: { write() {} }, stderr: { write() {} } }).command;
    const script = "process.stdout.write('FAIL '+ 'x'.repeat(40000));setTimeout(()=>process.stdout.write('y'.repeat(40000)+'\\n'),80)";
    const result = await helper.runOwnedCommand({ stateDir: temporary(), args: [process.execPath, '-e', script], env: { RUNALL_STRICT: '1' } }, fake.adapter);
    expect(result.code).toBe(1); expect(result.report.childResult.failureLine).toBe(true); expect(result.report.cleanup).toBe(true);
});

it('chunked output keeps whole-glyph failures and positive word boundaries distinct', async () => {
    const cases: [string, number][] = [
        ["console.log('❌ synthetic refusal')", 1],
        ["process.stdout.write('SKIP');setTimeout(()=>process.stdout.write('PER positive\\n'),80)", 0],
        ["console.log('   ok    FAIL appears within a positive assertion')", 0],
        ["console.log('*** FAILURE word is not the canonical failure marker')", 0],
        ["process.stdout.write('SKIP');setTimeout(()=>process.stdout.write('\\n'),80)", 1],
        ["console.log('SKIPPED synthetic missing runtime')", 1],
        ["process.stdout.write('SKIPP');setTimeout(()=>process.stdout.write('ED (runtime)\\n'),80)", 1]
    ];
    for (const [script, expected] of cases) {
        const fake = fakeRuntime(); fake.adapter.command = helper.productionAdapters({ stdout: { write() {} }, stderr: { write() {} } }).command;
        const result = await helper.runOwnedCommand({ stateDir: temporary(), args: [process.execPath, '-e', script], env: { RUNALL_STRICT: '1' } }, fake.adapter);
        expect(result.code).toBe(expected); expect(result.report.cleanup).toBe(true);
    }
});

it('actual child tee preserves backpressure rather than accumulating all output in the owner', async () => {
    let bytes = 0, maxQueued = 0, maxChunk = 0;
    const sink = new Writable({ highWaterMark: 1, write(chunk, _encoding, done) { bytes += chunk.length; maxChunk = Math.max(maxChunk, chunk.length); maxQueued = Math.max(maxQueued, this.writableLength); setTimeout(done, 1); } });
    const fake = fakeRuntime(); fake.adapter.command = helper.productionAdapters({ stdout: sink, stderr: { write() {} } }).command;
    const script = "process.stdout.write('ok '+ 'x'.repeat(4*1024*1024)+'\\n')";
    const result = await helper.runOwnedCommand({ stateDir: temporary(), args: [process.execPath, '-e', script], env: { RUNALL_STRICT: '1' } }, fake.adapter);
    await new Promise<void>(resolve => sink.end(resolve)); expect(result.code).toBe(0); expect(bytes).toBe(4 * 1024 * 1024 + 4); expect(maxQueued).toBeLessThanOrEqual(maxChunk);
});

const f03Args = ['node', 'audit-tools/emu/registry-purge-atomic-sdk-test.js'];
const hostedCI = { RUNALL_STRICT: '1', GITHUB_ACTIONS: 'true', RUNNER_ENVIRONMENT: 'github-hosted' };
it('F03 តែមួយប្រើ heap1024 លើ GitHub-hosted CI ហើយ owner ចងទំហំដូច JVM', async () => {
    const fake = fakeRuntime();
    const result = await helper.runOwnedCommand({ stateDir: temporary(), args: f03Args, env: hostedCI, cwd: repo }, fake.adapter);
    expect(result.code).toBe(0); expect(result.report.owner.maxHeapMiB).toBe(1024);
    const owner = JSON.parse(fs.readFileSync(path.join(result.directory, 'owner.json'), 'utf8'));
    expect(owner.args).toContain('-Xmx1024m'); expect(owner.expectedArgs).toContain('-Xmx1024m');
    expect(fake.events.filter(event => event[0] === 'command')).toHaveLength(1); expect(fake.active()).toBe(0);
});
it.each([
    {}, { RUNNER_ENVIRONMENT: 'github-hosted' }, { GITHUB_ACTIONS: 'true' },
    { GITHUB_ACTIONS: 'true', RUNNER_ENVIRONMENT: 'self-hosted' },
    { GITHUB_ACTIONS: 'false', RUNNER_ENVIRONMENT: 'github-hosted' }
])('F03 មិនបន្ថែម heap លើ self-hosted ឬ runtime ដែលមិនផ្ទៀង៖ %j', async env => {
    const fake = fakeRuntime();
    const result = await helper.runOwnedCommand({ stateDir: temporary(), args: f03Args, env: { RUNALL_STRICT: '1', ...env }, cwd: repo }, fake.adapter);
    expect(result.code).toBe(0); expect(result.report.owner.maxHeapMiB).toBe(512);
});
it.each([
    ['node', 'audit-tools/emu/fake.js'], ['node', 'audit-tools/checker-coverage.js'],
    ['node', 'audit-tools/exit-code-integrity.js'], ['node', '-e', f03Args[1]],
    ['bash', f03Args[1]], ['node', '/foreign/audit-tools/emu/registry-purge-atomic-sdk-test.js'],
    ['node', f03Args[1], '--fixtures-only']
])('គ្មាន heap1024 ជ្រាបទៅ command ផ្សេង៖ %j', async (...args) => {
    const fake = fakeRuntime();
    const result = await helper.runOwnedCommand({ stateDir: temporary(), args, env: hostedCI, cwd: repo }, fake.adapter);
    expect(result.code).toBe(0); expect(result.report.owner.maxHeapMiB).toBe(512);
});
it('F03 បដិសេធ JVM ដែល heap មិនដូចការជ្រើស មុនចាប់ checker', async () => {
    const fake = fakeRuntime({ forceHeap: 512 });
    const result = await helper.runOwnedCommand({ stateDir: temporary(), args: f03Args, env: hostedCI, cwd: repo }, fake.adapter);
    expect(result.code).toBe(1); expect(result.report.commandStarted).toBe(false);
    expect(result.report.errors).toContain('Owned JVM argv mismatch'); expect(fake.active()).toBe(0);
});
it.each([0, 513, 2048, '1024', '1024m', null, NaN])('បដិសេធ heap ក្រៅកិច្ចសន្យា៖ %s', value => {
    expect(() => helper.javaArguments('/verified/jar', value)).toThrow();
});

it('F03 ក្នុង scheduler ទទួល preload របស់ run-all ពិតដោយរក្សា heap1024', async () => {
    const fake = fakeRuntime(), args = ['node', '--require', path.join(repo, 'audit-tools/runall-exit-guard.cjs'), f03Args[1]];
    const result = await helper.runOwnedCommand({ stateDir: temporary(), args, env: hostedCI, cwd: repo }, fake.adapter);
    expect(result.code).toBe(0); expect(result.report.owner.maxHeapMiB).toBe(1024);
    expect(fake.events.find(event => event[0] === 'command')[1]).toEqual(args);
    expect(helper.heapForCommand(['node', '--require', '/foreign/runall-exit-guard.cjs', f03Args[1]], hostedCI, repo)).toBe(512);
    expect(helper.heapForCommand(['node', '--eval', 'x', f03Args[1]], hostedCI, repo)).toBe(512);
});

it.each([512, 1024])('launch ពិតផ្ញើ heap%s ទៅ spawn ដោយដក Java options និងបិទ log descriptor', async heap => {
    const cp = require('node:child_process'), { EventEmitter } = require('node:events');
    const originalSpawn = cp.spawn, calls: any[] = [], log = path.join(temporary(), 'emulator.log');
    cp.spawn = (command: string, args: string[], options: any) => {
        calls.push({ command, args, options });
        expect(fs.fstatSync(options.stdio[1]).isFile()).toBe(true);
        const child = new EventEmitter(); child.pid = 123; child.exitCode = null; child.signalCode = null;
        queueMicrotask(() => { child.emit('spawn'); child.exitCode = 0; child.emit('close', 0, null); });
        return child;
    };
    const env = { KEEP: 'yes', JAVA_TOOL_OPTIONS: '-Xmx2g', JDK_JAVA_OPTIONS: '-Xmx3g', _JAVA_OPTIONS: '-Xmx4g' };
    try {
        const handle = helper.productionAdapters().launch('/verified/emulator.jar', env, log, heap);
        await handle.spawned; expect(await handle.exit).toEqual({ code: 0, signal: null });
        expect(calls).toHaveLength(1);
        expect(calls[0].command).toBe('java');
        expect(calls[0].args).toEqual(['-Xmx' + heap + 'm', '-jar', '/verified/emulator.jar', '--port', '9000', '--host', '127.0.0.1']);
        expect(calls[0].options.env).toEqual({ KEEP: 'yes' });
        expect(calls[0].options.shell).toBe(false); expect(calls[0].options.detached).toBe(false);
        expect(calls[0].options.stdio[0]).toBe('ignore');
        expect(calls[0].options.stdio[1]).toBe(calls[0].options.stdio[2]);
        expect(() => fs.fstatSync(calls[0].options.stdio[1])).toThrow();
        expect(env.JAVA_TOOL_OPTIONS).toBe('-Xmx2g');
    } finally { cp.spawn = originalSpawn; }
});

const startBudget = Number(/START_MS = (\d+)/.exec(fs.readFileSync(path.join(repo, 'audit-tools/owned-rtdb-command.js'), 'utf8'))![1]);
const stopBudget = Number(/STOP_MS = (\d+)/.exec(fs.readFileSync(path.join(repo, 'audit-tools/owned-rtdb-command.js'), 'utf8'))![1]);
function runControlled(fake: ReturnType<typeof fakeRuntime>, signal?: AbortSignal, state = temporary()) {
    return helper.runOwnedCommand({ stateDir: state, args: ['node', 'audit-tools/emu/fake.js'], env: { RUNALL_STRICT: '1' }, signal }, fake.adapter);
}
function identitySequence(fake: ReturnType<typeof fakeRuntime>, change: (seen: any, read: number) => any) {
    const identity = fake.adapter.identity; let reads = 0;
    fake.adapter.identity = pid => change(identity(pid), ++reads);
    return () => reads;
}
async function expectBlocked(state: string) {
    const next = fakeRuntime(), result = await runControlled(next, undefined, state);
    expect(result.code).toBe(1); expect(next.events).toEqual([]);
}
it('argv ទទេដំបូងអាចផ្ទៀងលើ PID/start/exe ដដែល មុន checker ម្តង និង cleanup', async () => {
    const fake = fakeRuntime(); identitySequence(fake, (seen, read) => read === 1 ? { ...seen, args: [] } : seen);
    const result = await runControlled(fake);
    expect(result.code).toBe(0); expect(result.report.cleanup).toBe(true); expect(fake.active()).toBe(0);
    expect(fake.events.map(event => event[0])).toEqual(['launch', 'command', 'signal']);
    expect(result.report.acquisition).toMatchObject({ state: 'VERIFIED', emptyReads: 1, attempts: 2 });
});
it('argv ទទេជាប់ មិន dispatch ឬ signal ហើយបិទ scope បន្ទាប់', async () => {
    const fake = fakeRuntime(), state = temporary(); identitySequence(fake, seen => ({ ...seen, args: [] }));
    const result = await runControlled(fake, undefined, state);
    expect(result.code).toBe(1); expect(result.report.cleanup).toBe(false); expect(fake.events.map(event => event[0])).toEqual(['launch']);
    expect(fake.adapter.now()).toBe(startBudget); expect(result.report.acquisition).toMatchObject({ state: 'PROVISIONAL', argv: 'EMPTY', stage: 'ACQUIRE' });
    await expectBlocked(state);
});
it.each(['pid', 'start', 'exe'])('anchor %s ប្រែពេល argv ទទេ មិនអាចផ្ទៀង ឬ signal', async field => {
    const fake = fakeRuntime(), state = temporary();
    const reads = identitySequence(fake, (seen, read) => read === 1 ? { ...seen, args: [] } : { ...seen, [field]: field === 'pid' ? seen.pid + 1 : 'changed' });
    const result = await runControlled(fake, undefined, state);
    expect(result.code).toBe(1); expect(result.report.cleanup).toBe(false); expect(fake.events.map(event => event[0])).toEqual(['launch']);
    expect(reads()).toBe(2); expect(result.report.acquisition.changed).toEqual([field]); await expectBlocked(state);
});
it('PID ដំបូងត្រូវតែជាកូនដែល launch', async () => {
    const fake = fakeRuntime(); identitySequence(fake, seen => ({ ...seen, pid: seen.pid + 1 }));
    const result = await runControlled(fake); expect(result.code).toBe(1); expect(result.report.cleanup).toBe(false);
    expect(fake.events.map(event => event[0])).toEqual(['launch']);
});
const wrongArguments = [
    (args: string[]) => args.map(x => x === '-Xmx512m' ? '-Xmx1024m' : x),
    (args: string[]) => args.map(x => x === '/verified/emulator.jar' ? '/wrong.jar' : x),
    (args: string[]) => args.map(x => x === '127.0.0.1' ? '0.0.0.0' : x),
    (args: string[]) => args.map(x => x === '9000' ? '9001' : x),
    (args: string[]) => [...args, 'synthetic-private-argv-canary']
];
it.each(wrongArguments.map((mutate, index) => ({ mutate, index })))('argv ខុសមានទិន្នន័យ មិន retry ឬ checker៖ $index', async ({ mutate }) => {
    for (const emptyFirst of [false, true]) {
        const fake = fakeRuntime(); identitySequence(fake, (seen, read) => ({ ...seen, args: emptyFirst && read === 1 ? [] : mutate(seen.args) }));
        const result = await runControlled(fake);
        expect(result.code).toBe(1); expect(result.report.errors).toContain('Owned JVM argv mismatch');
        expect(fake.events.map(event => event[0])).toEqual(['launch', 'signal']); expect(fake.active()).toBe(0);
        expect(result.report.acquisition).toMatchObject({ argv: 'NONEMPTY_MISMATCH', attempts: emptyFirst ? 2 : 1 });
        const evidence = fs.readdirSync(result.directory).filter(file => file.endsWith('.json')).map(file => fs.readFileSync(path.join(result.directory, file), 'utf8')).join('\n');
        expect(evidence).not.toContain('synthetic-private-argv-canary');
    }
});
it.each(['first', 'cleanup'])('identity reader បោះ error នៅ %s មិន signal ដោយគ្មានភស្តុតាង', async when => {
    const fake = fakeRuntime(), state = temporary();
    identitySequence(fake, (seen, read) => { if (when === 'first' && read === 1 || when === 'cleanup' && fake.events.some(event => event[0] === 'command')) throw new Error('synthetic-private-identity-canary'); return seen; });
    const result = await runControlled(fake, undefined, state);
    expect(result.code).toBe(1); expect(result.report.cleanup).toBe(false); expect(fake.events.filter(event => event[0] === 'signal')).toEqual([]);
    expect(JSON.stringify(result.report)).not.toContain('synthetic-private-identity-canary'); await expectBlocked(state);
});
it.each(['before', 'acquire', 'command'])('abort នៅ %s មិនអាចបាត់ ឬ PASS', async when => {
    const fake = fakeRuntime(), controller = new AbortController();
    if (when === 'before') controller.abort();
    if (when === 'acquire') { identitySequence(fake, seen => ({ ...seen, args: [] })); const delay = fake.adapter.delay; fake.adapter.delay = async ms => { await delay(ms); controller.abort(); }; }
    if (when === 'command') { const command = fake.adapter.command; fake.adapter.command = (...args) => { const handle = command(...args); controller.abort(); return handle; }; }
    const result = await runControlled(fake, controller.signal);
    expect(result.code).toBe(1); expect(result.report.errors).toContain('Owned command interrupted');
    expect(fake.events.filter(event => event[0] === 'command')).toHaveLength(when === 'command' ? 1 : 0);
    expect(fake.events.filter(event => event[0] === 'signal')).toHaveLength(when === 'command' ? 1 : 0);
});
it('startup ប្រើ budget តែមួយសម្រាប់ acquisition និង readiness', async () => {
    const fake = fakeRuntime({ ready: false });
    identitySequence(fake, (seen, read) => read === 1 ? { ...seen, args: [] } : seen);
    const delay = fake.adapter.delay; let first = true;
    fake.adapter.delay = async ms => { await delay(first ? startBudget - 100 : ms); first = false; };
    const result = await runControlled(fake);
    expect(result.code).toBe(1); expect(fake.adapter.now()).toBe(startBudget); expect(result.report.commandStarted).toBe(false);
});
it('readiness ឆ្លើយតបក្រោយ budget មិនចាប់ checker', async () => {
    const fake = fakeRuntime(); fake.adapter.readyRead = async () => { await fake.adapter.delay(startBudget); return true; };
    const result = await runControlled(fake); expect(result.code).toBe(1); expect(result.report.commandStarted).toBe(false);
});
it('engine exit137 មុន checker ចប់ មិនអាច PASS', async () => {
    const fake = fakeRuntime(), command = fake.adapter.command;
    fake.adapter.command = (...args) => { const child = command(...args); fake.handles[0].finish(137); return child; };
    const result = await runControlled(fake); expect(result.code).toBe(1); expect(result.report.status).toBe('FAIL'); expect(result.report.cleanup).toBe(true);
});
it('TERM exit ប៉ុន្តែ close មិនមក ត្រូវចប់ cleanup តាម budget', async () => {
    const fake = fakeRuntime(); let finish: any, closeExpired = false, rescued = false; const budgets: number[] = [];
    const launch = fake.adapter.launch;
    fake.adapter.launch = (...args) => { const handle = launch(...args); handle.exit = new Promise(resolve => { finish = resolve; }); return handle; };
    fake.adapter.signal = (handle, signal) => { fake.events.push(['signal', handle.child.pid, signal]); handle.done = true; };
    fake.adapter.within = async (_promise, ms) => { budgets.push(ms); closeExpired = true; throw new Error('synthetic close deadline'); };
    const run = runControlled(fake);
    const timer = setTimeout(() => { rescued = true; finish({ code: 0, signal: null }); }, 150);
    try { const result = await run; expect(closeExpired).toBe(true); expect(rescued).toBe(false); expect(result.code).toBe(1); expect(result.report.cleanup).toBe(false); expect(budgets.every(ms => ms <= stopBudget)).toBe(true); }
    finally { clearTimeout(timer); finish({ code: 0, signal: null }); }
});
it.each(wrongArguments.map((mutate, index) => ({ mutate, index })))('argv ប្រែក្រោយ readiness មិន signal៖ $index', async ({ mutate }) => {
    const fake = fakeRuntime(), state = temporary();
    identitySequence(fake, seen => fake.events.some(event => event[0] === 'command') ? { ...seen, args: mutate(seen.args) } : seen);
    const result = await runControlled(fake, undefined, state); expect(result.code).toBe(1); expect(result.report.cleanup).toBe(false);
    expect(fake.events.filter(event => event[0] === 'signal')).toEqual([]); await expectBlocked(state);
});
it('Node child ពិតជំនួស JVM សាក argv ទទេដំបូង ហើយ wrapper ចេញដោយខ្លួនឯង', () => {
    const directory = temporary(), identityFile = path.join(directory, 'engine.json');
    const readIdentity = (pid: number) => { const fs = require('node:fs'); const stat = fs.readFileSync('/proc/' + pid + '/stat', 'utf8'); const fields = stat.slice(stat.lastIndexOf(')') + 2).split(/\s+/); return { pid, start: fields[19], exe: fs.realpathSync('/proc/' + pid + '/exe'), args: fs.readFileSync('/proc/' + pid + '/cmdline', 'utf8').split('\0').filter(Boolean) }; };
    const script = `const fs=require('fs'),helper=require(${JSON.stringify(process.env.OWNED_HELPER_SOURCE_FILE || path.join(repo, 'audit-tools/owned-rtdb-command.js'))});
const real=helper.productionAdapters({stdout:{write(){}},stderr:{write(){}}}),readIdentity=${readIdentity.toString()};let engine,reads=0;
const adapters={...real,validateSource(){},verifyJar:()=>({jar:'/synthetic.jar',sha256:'a'.repeat(64)}),portFree:async()=>{},ownsListener:()=>true,readyRead:async()=>true,
launch(){engine=real.command([process.execPath,'-e','setInterval(()=>{},1000)'],process.env,process.cwd());engine.spawned=engine.spawned.then(()=>fs.writeFileSync(${JSON.stringify(identityFile)},JSON.stringify(readIdentity(engine.child.pid))));return engine;},
identity(pid){const identity=readIdentity(pid);return {...identity,args:++reads===1?[]:['java',...helper.javaArguments('/synthetic.jar')]};}};
helper.runOwnedCommand({stateDir:${JSON.stringify(path.join(directory, 'state'))},args:[process.execPath,'-e',"console.log('ok original checker')"],env:{RUNALL_STRICT:'1'}},adapters).then(result=>{console.log(JSON.stringify(result.report));process.exitCode=result.code;});`;
    let result: ReturnType<typeof spawnSync>;
    try { result = spawnSync(process.execPath, ['-e', script], { encoding: 'utf8', timeout: 2500 }); }
    finally {
        if (fs.existsSync(identityFile)) {
            const launched = JSON.parse(fs.readFileSync(identityFile, 'utf8'));
            let current; try { current = readIdentity(launched.pid); } catch { /* កូនបានបិទរួច។ */ }
            if (current && helper.identityMatches(launched, current)) process.kill(launched.pid, 'SIGKILL');
        }
    }
    expect(result.error).toBeUndefined(); expect(result.status, String(result.stderr)).toBe(0);
    const report = JSON.parse(String(result.stdout).trim()); expect(report.status).toBe('PASS'); expect(report.cleanup).toBe(true);
});

it('argv0 មិនត្រូវនឹង Java មិនអាចផ្ទៀង ឬចាប់ checker', async () => {
    const fake = fakeRuntime(); identitySequence(fake, seen => ({ ...seen, args: ['synthetic-private-argv0', ...seen.args.slice(1)] }));
    const result = await runControlled(fake); expect(result.code).toBe(1); expect(result.report.commandStarted).toBe(false);
    expect(result.report.cleanup).toBe(true); expect(JSON.stringify(result.report)).not.toContain('synthetic-private-argv0');
});
it('identity បាត់បន្ទាប់ពី argv ទទេ មិន retry ទៀត ឬ signal', async () => {
    const fake = fakeRuntime(), state = temporary();
    const reads = identitySequence(fake, (seen, read) => { if (read > 1) throw new Error('synthetic-private-identity-canary'); return { ...seen, args: [] }; });
    const result = await runControlled(fake, undefined, state); expect(result.code).toBe(1); expect(result.report.cleanup).toBe(false);
    expect(reads()).toBe(2); expect(fake.events.map(event => event[0])).toEqual(['launch']); await expectBlocked(state);
});
it('abort កំពុងរង់ចាំ command spawn ត្រូវ cleanup checker និង engine', async () => {
    const fake = fakeRuntime(), controller = new AbortController(), command = fake.adapter.command;
    fake.adapter.command = (...args) => { const child = command(...args); child.spawned = new Promise(() => {}); queueMicrotask(() => controller.abort()); return child; };
    const run = runControlled(fake, controller.signal);
    let rescued = false;
    const timer = setTimeout(() => { rescued = true; }, 150);
    try {
        const result: any = await Promise.race([run, new Promise(resolve => setTimeout(() => resolve(null), 200))]);
        expect(result).not.toBeNull(); expect(rescued).toBe(false); expect(result.code).toBe(1); expect(result.report.cleanup).toBe(true);
    } finally { clearTimeout(timer); }
});
it('engine exit ពេល checker pending ត្រូវបញ្ឈប់ checker ដោយមិនរង់ចាំវា PASS', async () => {
    const fake = fakeRuntime(), command = fake.adapter.command;
    fake.adapter.command = (...args) => {
        const child = command(...args); child.done = false; child.exit = new Promise(resolve => { child.finish = (code: number | null, signal: string | null = null) => { if (code === 0 && !signal) return; child.done = true; resolve({ code, signal, outputPresent: true }); }; });
        queueMicrotask(() => fake.handles[0].finish(137)); return child;
    };
    const run = runControlled(fake);
    const result: any = await Promise.race([run, new Promise(resolve => setTimeout(() => resolve(null), 200))]);
    expect(result).not.toBeNull(); expect(result.code).toBe(1); expect(result.report.commandCompleted).toBe(false);
    expect(fake.events.filter(event => event[0] === 'signal').map(event => event[1])).toEqual([fake.handles[1].child.pid]);
});
it('production adapter ស្គាល់ exit មុន close ដើម្បីកុំទុក checker pending', async () => {
    const cp = require('node:child_process'), { EventEmitter } = require('node:events'), originalSpawn = cp.spawn;
    let child: any;
    cp.spawn = () => { child = new EventEmitter(); child.pid = 123; child.exitCode = null; child.signalCode = null; queueMicrotask(() => child.emit('spawn')); return child; };
    try {
        const handle = helper.productionAdapters().launch('/verified.jar', {}, path.join(temporary(), 'engine.log'), 512);
        await handle.spawned; child.exitCode = 137; child.emit('exit', 137, null);
        expect(handle.stopped).toBeInstanceOf(Promise); expect(await handle.stopped).toEqual({ code: 137, signal: null });
        child.emit('close', 137, null); expect(await handle.exit).toEqual({ code: 137, signal: null });
    } finally { cp.spawn = originalSpawn; }
});
it('abort listener ត្រូវដកចេញបន្ទាប់ពី scope ចប់', async () => {
    const controller = new AbortController(), listeners = new Set<unknown>(), signal: any = {
        get aborted() { return controller.signal.aborted; },
        addEventListener(type: string, listener: any, options: any) { listeners.add(listener); controller.signal.addEventListener(type, listener, options); },
        removeEventListener(type: string, listener: any) { listeners.delete(listener); controller.signal.removeEventListener(type, listener); }
    };
    const result = await runControlled(fakeRuntime(), signal); expect(result.code).toBe(0); expect(listeners.size).toBe(0);
});

it.each(['drift', 'throw'])('identity ក្រោយ HTTP %s ម្តងហើយត្រឡប់ធម្មតា ក៏មិនអាច PASS', async mode => {
    const fake = fakeRuntime();
    identitySequence(fake, (seen, read) => { if (read !== 3) return seen; if (mode === 'throw') throw new Error('synthetic-private-identity-canary'); return { ...seen, start: 'changed' }; });
    const result = await runControlled(fake); expect(result.code).toBe(1); expect(result.report.commandStarted).toBe(false);
});
it('owner callback រត់ក្រោយផ្ទៀងតែប៉ុណ្ណោះ ហើយការបោះ error មិនចាប់ checker', async () => {
    for (const wrong of [false, true]) {
        const fake = fakeRuntime(); let calls = 0;
        if (wrong) identitySequence(fake, seen => ({ ...seen, args: wrongArguments[0](seen.args) }));
        (fake.adapter as any).ownerAcquired = () => { calls++; throw new Error('synthetic-private-callback-canary'); };
        const result = await runControlled(fake); expect(result.code).toBe(1); expect(result.report.commandStarted).toBe(false); expect(result.report.cleanup).toBe(true);
        expect(calls).toBe(wrong ? 0 : 1); expect(JSON.stringify(result.report)).not.toContain('synthetic-private-callback-canary');
    }
});

it.each(['launch', 'readiness'])('abort នៅ %s មិនទុក startup timer ឲ្យ wrapper នៅរស់', async stage => {
    vi.useFakeTimers();
    try {
        const fake = fakeRuntime(), controller = new AbortController();
        if (stage === 'launch') { const launch = fake.adapter.launch; fake.adapter.launch = (...args) => { const child = launch(...args); child.spawned = new Promise(() => {}); Promise.resolve().then(() => controller.abort()); return child; }; }
        else fake.adapter.readyRead = () => { Promise.resolve().then(() => controller.abort()); return new Promise(() => {}); };
        const result = await runControlled(fake, controller.signal);
        expect(result.code).toBe(1); expect(result.report.commandStarted).toBe(false); expect(vi.getTimerCount()).toBe(0);
    } finally { vi.clearAllTimers(); vi.useRealTimers(); }
});

it('abort ក្នុង identity ដែលផ្ទៀង មិនហៅ callback ឬចាប់ checker', async () => {
    const fake = fakeRuntime(), controller = new AbortController(); let callbacks = 0;
    identitySequence(fake, seen => { controller.abort(); return seen; });
    (fake.adapter as any).ownerAcquired = () => { callbacks++; };
    const result = await runControlled(fake, controller.signal);
    expect(result.code).toBe(1); expect(callbacks).toBe(0); expect(result.report.commandStarted).toBe(false);
    expect(fs.existsSync(path.join(result.directory, 'owner.json'))).toBe(false); expect(result.report.cleanup).toBe(true);
});
it('diagnostics.changed ទទួលតែឈ្មោះ identity field ដែលកំណត់', async () => {
    const fake = fakeRuntime(); fake.adapter.validateSource = () => { const error: any = new Error('synthetic failure'); error.changed = ['args', 'synthetic-private-changed-canary', { private: 'synthetic-private-changed-canary' }]; throw error; };
    const result = await runControlled(fake); expect(result.code).toBe(1);
    expect(result.report.diagnostics[0].changed).toEqual(['args']); expect(JSON.stringify(result.report)).not.toContain('synthetic-private-changed-canary');
});
