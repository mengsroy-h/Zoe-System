import { readFileSync, mkdtempSync, writeFileSync, rmSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { EventEmitter } from 'node:events';
import { spawn, execFile, spawnSync } from 'node:child_process';
import { parse } from 'acorn';
import { expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const source = readFileSync('../audit-tools/money-guardian-test.js', 'utf8');
const ast: any = parse(source, { ecmaVersion: 'latest' });
const functions = ast.body.filter((node: any) => node.type === 'FunctionDeclaration'
    && ['runNode', 'runGuard', 'observeGuardChild', 'guardVerdict'].includes(node.id.name))
    .map((node: any) => source.slice(node.start, node.end)).join('\n');
const procHelper = () => require('../../audit-tools/child-proc-diagnostic.cjs').observeChildProc;
const stat = (pid: number, start = '123', state = 'S') => `${pid} (private ) command) ${state} ${Array(18).fill('0').join(' ')} ${start} 0\n`;
function procFixture() {
    const values = new Map<string, string>([['/proc/123/stat', stat(123)]]);
    let entries: string[] = [];
    const io = {
        openSync: vi.fn((file: string) => { if (!values.has(file)) throw new Error('private missing path'); return file; }),
        readSync: vi.fn((file: string, buffer: Buffer, offset: number, size: number) => buffer.write(values.get(file)!, offset, size)),
        closeSync: vi.fn(),
        opendirSync: vi.fn(() => { const list = [...entries]; return { readSync: () => list.length ? { name: list.shift() } : null, closeSync: vi.fn() }; })
    };
    const thread = (tid: number, name: string, wchan = 'futex_do_wait') => {
        entries.push(String(tid)); values.set(`/proc/123/task/${tid}/comm`, name + '\n'); values.set(`/proc/123/task/${tid}/wchan`, wchan);
    };
    return { io, values, thread, setEntries: (list: string[]) => { entries = list; } };
}

it('proc៖ ឈ្មោះអនុញ្ញាតប៉ុណ្ណោះ និង snapshot ចង identity ដើម', () => {
    const f = procFixture();
    for (const [i, name] of ['node', 'V8Worker', 'SignalInspector', 'libuv-worker', 'private-token', 'node\nprivate'].entries()) f.thread(123 + i, name);
    const sample = procHelper()(123, () => true, 'linux', f.io);
    const row = sample();
    expect(row).toMatchObject({ status: 'available', state: 'S', threadsStatus: 'complete' });
    expect(row.threads.map((t: any) => [t.name, t.kind])).toEqual([
        ['node', 'main'], ['V8Worker', 'v8-worker'], ['SignalInspector', 'signal-inspector'], ['libuv-worker', 'libuv-worker'], [null, 'other'], [null, 'other']
    ]);
    expect(JSON.stringify(row)).not.toContain('private');
    f.values.set('/proc/123/stat', stat(123, '124'));
    expect(sample()).toEqual({ status: 'identity-changed' });
});

it.each(['missing', 'malformed', 'truncated', 'wrong-pid', 'control', 'zero-start'])('proc៖ %s មិនក្លាយជាភស្តុតាង', mode => {
    const f = procFixture();
    if (mode === 'missing') f.values.clear();
    else f.values.set('/proc/123/stat', mode === 'malformed' ? 'private' : mode === 'truncated' ? '123 (node) S 1' : mode === 'wrong-pid' ? stat(124) : mode === 'control' ? stat(123, '123\u0000') : stat(123, '0'));
    const sample = procHelper()(123, () => true, 'linux', f.io);
    f.values.set('/proc/123/stat', stat(123));
    expect(sample()).toEqual({ status: 'unavailable' });
});

it('proc៖ ព្រំដែនអាន និង identity ប្រែក្នុង snapshot បោះទិន្នន័យចោល', () => {
    const f = procFixture();
    for (let i = 0; i < 30; i++) f.thread(123 + i, 'V8Worker', i ? 'private\nvalue' : 'futex_do_wait');
    const sample = procHelper()(123, () => true, 'linux', f.io);
    const row = sample();
    expect(row.threads).toHaveLength(16);
    expect(row.threadsStatus).toBe('bounded');
    expect(row.threads[1].wchan).toBeNull();
    expect(JSON.stringify(row).length).toBeLessThan(2500);
    expect(f.io.readSync.mock.calls.every((call: any[]) => call[3] <= 1024)).toBe(true);
    const original = f.io.opendirSync.getMockImplementation()!;
    f.io.opendirSync.mockImplementation(() => { f.values.set('/proc/123/stat', stat(123, '124')); return original(); });
    expect(sample()).toEqual({ status: 'identity-changed' });
});

it('proc៖ ដំណើរការចប់ platform ខុស PID ខុស និង read error នៅស្ងាត់', () => {
    const f = procFixture();
    let live = true;
    const sample = procHelper()(123, () => live, 'linux', f.io);
    live = false;
    expect(sample()).toEqual({ status: 'unavailable' });
    for (const pid of [undefined, null, NaN, {}, [], -1, 0, '123']) expect(procHelper()(pid, () => true, 'linux', f.io)()).toEqual({ status: 'unavailable' });
    expect(procHelper()(123, () => true, 'darwin', f.io)()).toEqual({ status: 'non-linux' });
    expect(procHelper()(123, () => { throw new Error('private'); }, 'linux', f.io)()).toEqual({ status: 'unavailable' });
});

function moneyHarness(overrides: Record<string, any> = {}) {
    const rows: any[] = [], events: string[] = [];
    const child = Object.assign(new EventEmitter(), { pid: 123, exitCode: null, signalCode: null });
    let callback: any;
    const launch = vi.fn((_cmd, _args, _options, cb) => { callback = cb; return child; });
    const context: any = {
        process: { execPath: process.execPath, env: { PRIVATE: 'private-secret' }, platform: 'linux' },
        path: require('node:path'), __dirname: '/private-path', GUARDS: [{ file: 'tx-outcome-test.js', env: 'TXOUTCOME_APP_DIR' }], MUTATIONS: Array(20),
        execFile: launch, observeChildProc: () => () => { events.push('sample'); return { status: 'unavailable' }; },
        Date, setTimeout, clearTimeout,
        console: { log: (line: string) => rows.push(JSON.parse(line.slice(line.indexOf(' ') + 1))) }, ...overrides
    };
    const run = runInNewContext(functions + '\n({ runNode, runGuard, guardVerdict });', context);
    return { ...run, child, rows, launch, events, callback: (...args: any[]) => callback(...args) };
}

it.each(['normal', 'failure', 'signal', 'timeout', 'spawn-error'])('money៖ %s រក្សា command និងលទ្ធផលដោយមិនបង្ហាញទិន្នន័យឯកជន', async mode => {
    vi.useFakeTimers();
    try {
        const h = moneyHarness();
        const pending = h.runGuard({ file: 'tx-outcome-test.js', env: 'TXOUTCOME_APP_DIR' }, '/private-root', 7);
        expect(h.launch).toHaveBeenCalledWith(process.execPath, ['/private-path/tx-outcome-test.js'], { env: { PRIVATE: 'private-secret', TXOUTCOME_APP_DIR: '/private-root' }, encoding: 'utf8', timeout: 240000, maxBuffer: 64 * 1024 * 1024 }, expect.any(Function));
        h.child.emit('spawn');
        const error = mode === 'normal' ? null : mode === 'failure' ? { code: 1 } : mode === 'spawn-error' ? { code: 'ENOENT', message: 'private' } : { code: null, signal: 'SIGTERM', killed: mode === 'timeout' };
        if (mode === 'spawn-error') h.child.emit('error', error);
        else h.child.emit('exit', error ? error.code : 0, error?.signal || null);
        h.callback(error, 'private-output', 'private-stderr');
        h.child.emit('close', error ? error.code : 0, error?.signal || null);
        const result = await pending;
        expect(result).toEqual(mode === 'normal' ? { code: 0, out: 'private-output' } : { code: typeof error!.code === 'number' ? error!.code : 1, interrupted: !!error!.killed || !!error!.signal || typeof error!.code !== 'number', out: 'private-outputprivate-stderr' });
        expect(h.rows[0]).toMatchObject({ event: 'start', checker: 'tx-outcome-test.js', mutation: 7 });
        expect(h.rows.at(-1)).toMatchObject({ event: 'close', lifecycle: { pid: 123, closeMs: 0, finishMs: 0 } });
        expect(JSON.stringify(h.rows)).not.toContain('private');
        expect(h.rows.some((row: any) => row.event === 'result')).toBe(true);
        expect(vi.getTimerCount()).toBe(0);
    } finally { vi.useRealTimers(); }
});

it('money៖ snapshot យឺតអានតែប៉ុណ្ណោះ និងមិនរក្សា event loop', async () => {
    vi.useFakeTimers();
    try {
        const timers: any[] = [];
        const h = moneyHarness({ setTimeout: (fn: any, ms: number) => { const timer = setTimeout(fn, ms); timers.push(timer); return timer; } });
        const pending = h.runGuard({ file: 'tx-outcome-test.js', env: 'TXOUTCOME_APP_DIR' }, '/private-root', 2);
        h.child.emit('spawn');
        expect(timers).toHaveLength(1);
        expect(timers[0].hasRef()).toBe(false);
        await vi.advanceTimersByTimeAsync(120000);
        expect(h.rows.filter((row: any) => row.event === 'slow')).toHaveLength(1);
        expect(h.rows.at(-1)).toMatchObject({ checker: 'tx-outcome-test.js', mutation: 2, lifecycle: { spawnMs: 0, exitMs: null, proc: { status: 'unavailable' } } });
        expect(h.events).toEqual(['sample']);
        h.child.emit('exit', 1, null); h.callback({ code: 1 }, '', ''); h.child.emit('close', 1, null);
        await pending;
        expect(vi.getTimerCount()).toBe(0);
    } finally { vi.useRealTimers(); }
});

it('money៖ control ID និង diagnostic error មិនប្ដូរ verdict', async () => {
    for (const throwing of [false, true]) {
        const h = moneyHarness(throwing ? { console: { log: () => { throw new Error('private'); } }, observeChildProc: () => { throw new Error('private'); } } : {});
        const pending = h.runNode(['-e', 'private-code'], { TOKEN: 'private' }, { control: 3 });
        h.child.emit('spawn'); h.child.emit('exit', 0, null); h.callback(null, '  ok    assertion\n✅ ជោគជ័យ 1', ''); h.child.emit('close', 0, null);
        expect(h.guardVerdict(await pending)).toBe('pass');
        if (!throwing) expect(h.rows[0]).toMatchObject({ control: 3, checker: null, mutation: null });
    }
});

it('money៖ កូនពិត និង outer TERM ទុក start evidence ដោយមិនប្ដូរ signal handler', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'money-diag-'));
    const helper = resolve('../audit-tools/child-proc-diagnostic.cjs');
    let child: ReturnType<typeof spawn> | undefined;
    try {
        const file = join(dir, 'probe.cjs');
        writeFileSync(file, `const { execFile } = require('node:child_process'); const { observeChildProc } = require(${JSON.stringify(helper)}); const GUARDS = [{ file: 'tx-outcome-test.js' }], MUTATIONS = Array(20);\n${functions}\nrunNode(['-e', 'setInterval(() => {}, 1000)'], process.env, { control: 1 });`);
        const output: string[] = [];
        child = spawn(process.execPath, ['--require', resolve('../audit-tools/runall-exit-guard.cjs'), file], { detached: true, env: { ...process.env, ZOE_RUNALL_EXIT_GUARD: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
        child.stdout!.setEncoding('utf8'); child.stdout!.on('data', (chunk: string) => output.push(chunk));
        const completion = new Promise<any>(resolveDone => child!.once('close', (code, signal) => resolveDone({ code, signal })));
        await new Promise<void>((resolveStarted, reject) => {
            const timer = setTimeout(() => reject(new Error('start evidence missing')), 3000);
            child!.stdout!.on('data', () => { if (output.join('').includes('"event":"spawn"')) { clearTimeout(timer); resolveStarted(); } });
        });
        process.kill(-child.pid!, 'SIGTERM');
        expect(await completion).toEqual({ code: null, signal: 'SIGTERM' });
        const text = output.join('');
        expect(text).toContain('"event":"start"');
        expect(text).toContain('"control":1');
        expect(text).not.toContain('setInterval');
        expect(text).not.toContain(dir);
    } finally {
        if (child && child.exitCode === null && child.signalCode === null) process.kill(-child.pid!, 'SIGKILL');
        rmSync(dir, { recursive: true, force: true });
    }
}, 10000);

it('money៖ runNode ពិតចេញធម្មតា និងចេញដោយ signal ដោយគ្មាន timer សល់', async () => {
    const h = moneyHarness({ process, execFile, observeChildProc: (...args: any[]) => procHelper()(...args) });
    const success = await h.runNode(['-e', 'console.log("safe")'], process.env, { control: 1 });
    expect(success).toEqual({ code: 0, out: 'safe\n' });
    const signal = await h.runNode(['-e', 'process.kill(process.pid, "SIGTERM")'], process.env, { control: 2 });
    expect(signal).toMatchObject({ code: 1, interrupted: true });
    expect(h.rows.filter((row: any) => row.event === 'close')).toHaveLength(2);
});


it.each(['callback', 'error', 'exit', 'close'])('money៖ %s លុប observation timer ទោះ event ផ្សេងនៅមិនទាន់មក', async event => {
    vi.useFakeTimers();
    try {
        const h = moneyHarness();
        const pending = h.runNode(['-e', 'private'], {}, { control: 1 });
        expect(vi.getTimerCount()).toBe(1);
        if (event === 'callback') h.callback(null, '', '');
        else h.child.emit(event, 0, null);
        expect(vi.getTimerCount()).toBe(0);
        await vi.advanceTimersByTimeAsync(240001);
        expect(h.events).toEqual([]);
        if (event !== 'callback') h.callback(null, '', '');
        await pending;
    } finally { vi.useRealTimers(); }
});

it.each([undefined, null, {}, [], NaN, 'private', { control: 0 }, { control: 9 }, { checker: 'private-path', mutation: 1 }, { checker: 'tx-outcome-test.js', mutation: -1 }, { checker: 'tx-outcome-test.js', mutation: 21 }, { checker: 'tx-outcome-test.js', mutation: 'private' }])('money៖ metadata ខុស %j មិនបង្ហាញទិន្នន័យ ឬប្ដូរលទ្ធផល', async metadata => {
    vi.useFakeTimers();
    try {
        const h = moneyHarness();
        const pending = h.runNode(['-e', 'private-code'], {}, metadata);
        h.callback(null, 'same', '');
        expect(await pending).toEqual({ code: 0, out: 'same' });
        expect(h.rows).toEqual([]);
        expect(vi.getTimerCount()).toBe(0);
    } finally { vi.useRealTimers(); }
});

it('money៖ negative controls ពិតទាំងប្រាំបីរក្សាលទ្ធផល និង ID ដាច់ដោយឡែក', async () => {
    const declarations = ast.body.filter((node: any) => node.type === 'VariableDeclaration' && node.declarations.some((item: any) => ['GUARDS', 'MUTATIONS'].includes(item.id.name)))
        .map((node: any) => source.slice(node.start, node.end)).join('\n');
    const verify = ast.body.find((node: any) => node.type === 'FunctionDeclaration' && node.id.name === 'verifyGuardVerdicts');
    const rows: any[] = [], assertions: boolean[] = [];
    await runInNewContext(declarations + '\n' + functions + '\n' + source.slice(verify.start, verify.end) + '\nverifyGuardVerdicts();', {
        execFile, process, Date, setTimeout, clearTimeout, observeChildProc: procHelper(),
        ok: (value: boolean) => assertions.push(value),
        console: { log: (line: string) => rows.push(JSON.parse(line.slice(line.indexOf(' ') + 1))) }
    });
    expect(assertions).toEqual(Array(8).fill(true));
    expect(rows.filter(row => row.event === 'start').map(row => row.control)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(rows.filter(row => row.event === 'close')).toHaveLength(8);
    expect(rows.every(row => row.checker === null && row.mutation === null)).toBe(true);
    expect(rows.length).toBeLessThanOrEqual(8 * 6);
});

it('proc៖ task directory និង thread reads បរាជ័យមិនលាក់ identity mismatch', () => {
    const f = procFixture();
    f.thread(123, 'node');
    const sample = procHelper()(123, () => true, 'linux', f.io);
    f.values.delete('/proc/123/task/123/comm');
    f.values.delete('/proc/123/task/123/wchan');
    expect(sample().threads).toEqual([{ tid: 123, name: null, kind: 'main', wchan: null }]);
    f.io.opendirSync.mockImplementation(() => { throw new Error('private'); });
    expect(sample()).toMatchObject({ status: 'available', threads: [], threadsStatus: 'unavailable' });
    f.values.set('/proc/123/stat', stat(123, '124'));
    expect(sample()).toEqual({ status: 'identity-changed' });
});

it('money៖ execFile បើកមិនបានពិតមាន diagnostics ដោយគ្មាន throw ថ្មី', async () => {
    let closed: Promise<void> | undefined;
    const launch: typeof execFile = ((...args: any[]) => {
        const child = (execFile as any)(...args);
        closed = new Promise<void>(resolveDone => child.once('close', resolveDone));
        return child;
    }) as typeof execFile;
    const h = moneyHarness({ process: { ...process, execPath: '/not-present-zoe-child-probe' }, execFile: launch, observeChildProc: procHelper() });
    const result = await h.runNode(['private-arg'], process.env, { control: 1 });
    expect(result).toMatchObject({ code: 1, interrupted: true });
    await closed;
    expect(h.rows.some((row: any) => row.event === 'error' && row.lifecycle.error)).toBe(true);
    expect(h.rows.at(-1)).toMatchObject({ event: 'close', lifecycle: { pid: null } });
    expect(JSON.stringify(h.rows)).not.toContain('private');
});


it('measure copy និង poisonOne ពិតរកឃើញ relative helper; helper បាត់នៅ unverified', async () => {
    const root = mkdtempSync(join(tmpdir(), 'child-copy-'));
    const input = join(root, 'input'), output = join(root, 'output');
    const tools = join(input, 'audit-tools');
    mkdirSync(tools, { recursive: true });
    mkdirSync(join(input, 'ZoeW/dist-audit/ZoeW'), { recursive: true });
    writeFileSync(join(input, 'ZoeW/dist-audit/ZoeW/app.js'), 'fixture input, not an app build');
    for (const name of ['child-proc-diagnostic.cjs', 'money-guardian-test.js', 'exit-code-integrity.js', 'runall-exit-guard.cjs']) copyFileSync('../audit-tools/' + name, join(tools, name));
    const ids = ['money-guardian-test', 'exit-code-integrity'];
    for (let i = 0; i < 40; i++) {
        const id = 'fixture' + i; ids.push(id);
        writeFileSync(join(tools, id + '.js'), 'let fail = 0; function ok(label, cond, detail) { if (!cond) fail++; } ok("fixture", true); process.exit(fail ? 1 : 0);');
    }
    writeFileSync(join(tools, 'run-all.sh'), 'for t in ' + ids.join(' ') + '; do\n run "$t" node "audit-tools/$t.js"\ndone\n');
    const runner = readFileSync('../audit-tools/run-all.sh', 'utf8');
    const materialize = runner.slice(runner.indexOf('zoe_measure_root()'), runner.indexOf('# hash របស់ tree'));
    try {
        const copied = spawnSync('bash', ['-c', materialize + '\nzoe_measure_root "$1" "$2" tar', '--', input, output], {
            encoding: 'utf8', timeout: 5000, env: { ...process.env, ZOE_NODE_MODULES: resolve('node_modules') }
        });
        expect(copied.status, copied.stderr).toBe(0);
        const guardSource = readFileSync(join(output, 'audit-tools/exit-code-integrity.js'), 'utf8');
        const guardAst: any = parse(guardSource, { ecmaVersion: 'latest' });
        const names = ['poisonSource', 'durationMs', 'childBudgetMs', 'runPoisonedChild', 'poisonVerdict', 'poisonOne'];
        const code = guardSource.slice(guardSource.indexOf('const POISON ='), guardSource.indexOf('function durationMs('))
            + guardAst.body.filter((node: any) => node.type === 'FunctionDeclaration' && names.includes(node.id.name) && node.id.name !== 'poisonSource')
                .map((node: any) => guardSource.slice(node.start, node.end)).join('\n');
        const context: any = {
            fs: require('node:fs'), path: require('node:path'), cp: require('node:child_process'), process: { ...process, env: { ...process.env, NODE_PATH: resolve('node_modules') } },
            Date, setTimeout, clearTimeout, Buffer, observeChildProc: procHelper(),
            TOOLS: join(output, 'audit-tools'), ROOT: output, POISON_PREFIX: '.tmp-poison-', shadows: new Set(), liveChildren: new Set(),
            EXIT_GUARD_ARGS: ['--require', join(output, 'audit-tools/runall-exit-guard.cjs')], OUT_CAP: 4 * 1024 * 1024, HARD_GRACE_MS: 5000, EXIT_TO_CLOSE_GRACE_MS: 2000,
            DEADLINE_AT: Date.now() + 15000, DEADLINE_RESERVE_MS: 1000, EXPLICIT_CHILD_MS: 5000, MIN_CHILD_BUDGET_MS: 1000, JOB_CEILING_MS: 15000,
            poisoned: 0, unpoisonable: [], unverified: [], timings: [], skippedInPoison: [], fakeGreen: [], ZTO_IMPORT_TEST: '../zto-import/test.js', console: { log() {} }
        };
        const run = runInNewContext(code + '\npoisonOne;', context);
        for (const name of ['money-guardian-test.js', 'exit-code-integrity.js']) {
            await run(name);
            expect(context.unverified).toEqual([]);
            expect(context.shadows.size).toBe(0);
            expect(readFileSync(join(output, 'audit-tools', name), 'utf8')).toBe(readFileSync(join(tools, name), 'utf8'));
        }
        expect(context.poisoned).toBe(2);
        const helperFile = join(output, 'audit-tools/child-proc-diagnostic.cjs');
        expect(existsSync(helperFile)).toBe(true);
        rmSync(helperFile);
        await run('money-guardian-test.js');
        expect(context.unverified).toHaveLength(1);
        expect(context.unverified[0]).toContain('money-guardian-test.js');
        expect(context.shadows.size).toBe(0);
    } finally { rmSync(root, { recursive: true, force: true }); }
}, 20000);

it('diagnostic lines មិនក្លាយជា assertion, summary, FAIL, SKIP ឬ exit proof', async () => {
    const h = moneyHarness();
    const pending = h.runNode([], {}, { control: 1 });
    h.child.emit('spawn'); h.child.emit('exit', 0, null); h.callback(null, '', ''); h.child.emit('close', 0, null); await pending;
    const lines = h.rows.map((row: any) => 'ZOE_MONEYGUARD_CHILD_DIAGNOSTIC ' + JSON.stringify(row)).join('\n') + '\n';
    expect(h.guardVerdict({ code: 0, out: lines })).toBe('invalid');
    expect(h.guardVerdict({ code: 0, out: lines + '  ok    control\n✅ ជោគជ័យ 1' })).toBe('pass');
    expect(h.guardVerdict({ code: 1, out: lines + '  FAIL  control\n❌ ធ្លាក់ 1 / ok 0' })).toBe('caught');
    const guardSource = readFileSync('../audit-tools/exit-code-integrity.js', 'utf8');
    const verdictSource = guardSource.slice(guardSource.indexOf('function poisonVerdict('), guardSource.indexOf('\n{\n', guardSource.indexOf('function poisonVerdict(')));
    const verdict = runInNewContext(verdictSource + '\npoisonVerdict;', {});
    expect(verdict({ code: 1, signal: null, timedOut: false, out: lines })).toBe('unverified');
    const adapters = require('../../audit-tools/owned-rtdb-command.js').productionAdapters({ stdout: { write: () => true }, stderr: { write: () => true } });
    const result = await adapters.command([process.execPath, '-e', 'process.stdout.write(' + JSON.stringify(lines) + ')'], process.env, process.cwd()).exit;
    expect(result).toMatchObject({ code: 0, outputPresent: true, failureLine: false, skipLine: false });
    const undecided = await adapters.command([process.execPath, '--require', resolve('../audit-tools/runall-exit-guard.cjs'), '-e', 'process.stdout.write(' + JSON.stringify(lines) + ')'], { ...process.env, ZOE_RUNALL_EXIT_GUARD: '1' }, process.cwd()).exit;
    expect(undecided).toMatchObject({ code: 1, failureLine: true, skipLine: false });
});
