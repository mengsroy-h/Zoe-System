import { afterEach, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { Writable } from 'node:stream';
const require = createRequire(import.meta.url);
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const helper = require(process.env.OWNED_HELPER_SOURCE_FILE || path.join(repo, 'audit-tools/owned-rtdb-command.js'));
const runnerRoot = process.env.OWNED_SCOPE_SOURCE_ROOT || repo;
const temporaryPaths: string[] = [];
afterEach(() => { for (const dir of temporaryPaths.splice(0)) fs.rmSync(dir, { recursive: true, force: true }); });
function temporary() { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zoe-owned-unit-')); temporaryPaths.push(dir); return dir; }
function fakeRuntime(options: Record<string, any> = {}) {
    let clock = 0, active = 0, serial = 10, jarChecks = 0; const events: any[] = [];
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
        launch: () => { events.push(['launch']); const h = handle('engine'); active++; return h; },
        identity: (pid: number) => ({ pid, start: options.changed ? 'changed' : '100', state: 'S', exe: '/java', args: ['java', ...helper.javaArguments('/verified/emulator.jar')] }),
        ownsListener: () => options.listener !== false,
        readyRead: async () => { if (options.changeAfterRead) options.changed = true; return options.ready !== false; },
        command: (args: string[], env: Record<string, string>) => { events.push(['command', args, env]); const h = handle('command'); queueMicrotask(() => h.finish(options.code || 0)); return h; },
        signal: (h: any, signal: string) => { events.push(['signal', h.child.pid, signal]); if (!options.unsettled) h.finish(null, signal); },
        within: async (p: Promise<any>) => { if (options.unsettled) throw new Error('forced cleanup deadline'); return p; }
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
    const original = path.join(dir, 'old-engine.json'), records = path.join(dir, 'records.jsonl');
    fs.writeFileSync(original, JSON.stringify({ owner: 'prestarted-global', members: ['prior-checker'] }));
    const child = `const fs=require('fs');const f=process.env.FX_ENGINE;const x=JSON.parse(fs.readFileSync(f));fs.appendFileSync(process.env.FX_RECORDS,JSON.stringify({owner:x.owner,before:x.members.slice()})+'\\n');x.members.push(process.argv[1]);fs.writeFileSync(f,JSON.stringify(x));console.log('   ok    original child completed');`;
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
        ["process.stdout.write('SKIP');setTimeout(()=>process.stdout.write('\\n'),80)", 1]
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
