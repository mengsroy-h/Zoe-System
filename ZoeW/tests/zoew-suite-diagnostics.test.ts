// @vitest-environment node
import { execFileSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { BaseSequencer } from 'vitest/node';
import fs, { readFileSync } from 'node:fs';
import os from 'node:os';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { expect, it } from 'vitest';
const requireReal = createRequire(import.meta.url);

let requestedTimeout = 0;
function fakeSpawn(run: (command: string, args: string[], options: { timeout: number }) => { status?: number | null; stdout?: string; stderr?: string; error?: { code: string } }) {
    return (command: string, args: string[], options: { timeout: number }) => {
        const child = Object.assign(new EventEmitter(), { stdout: new EventEmitter(), stderr: new EventEmitter() });
        queueMicrotask(() => {
            const result = run(command, args, { ...options, timeout: requestedTimeout });
            child.stdout.emit('data', result.stdout || ''); child.stderr.emit('data', result.stderr || '');
            if (result.error) child.emit('error', result.error);
            else { child.emit('exit', result.status, null); child.emit('close', result.status, null); }
        });
        return child;
    };
}
const runtime = { Buffer, clearTimeout, setTimeout: (callback: () => void, delay: number) => {
    requestedTimeout = delay; return setTimeout(callback, delay);
} };
function fakeProcess<T extends object>(value: T) { return Object.assign(new EventEmitter(), { platform: 'darwin' }, value); }

async function runDiagnostic(mode: 'failed' | 'passed' | 'timeout' | 'malformed' | 'missing', denyWrite = false, budget?: { workers?: string; cpus: number; quota: string; v1?: boolean }) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zoew-diagnostics-test-'));
    const app = path.join(root, 'ZoeW');
    for (const dir of ['src', 'node_modules/vite', 'node_modules/typescript']) fs.mkdirSync(path.join(app, dir), { recursive: true });
    fs.writeFileSync(path.join(app, 'src/main.tsx'), '');
    fs.copyFileSync(new URL('../package.json', import.meta.url), path.join(app, 'package.json'));
    const logs: string[] = [], calls: string[] = [], allArgs: string[][] = [];
    let reportFile = '', reportText = '';
    const stdout = '\u001b[31m FAIL  tests/synthetic.pg.test.ts > child\u001b[0m\nAssertionError: synthetic child exited 1\n'
        + 'context immediately after the assertion\n' + Array(100).fill('        [Function: wrapper] { listener: [Function (anonymous)] },').join('\n')
        + '\nerror: synthetic database connection rejected\n  code: \'SYNTHETIC\'\n' + Array(100).fill('object field').join('\n');
    const stderr = 'raw stderr before tail\n' + Array.from({ length: 20 }, (_, i) => 'trace-' + i).join('\n') + '\n';
    const processFake = fakeProcess({ env: { ZOEWSUITE_APP_DIR: root, ...(budget?.workers ? { ZOEWSUITE_TEST_WORKERS: budget.workers } : {}) }, ...(budget ? { platform: 'linux' } : {}), argv: ['node', 'zoew-suite-test.js'], exitCode: 0 });
    await vm.runInNewContext(readFileSync(new URL('../../audit-tools/zoew-suite-test.js', import.meta.url), 'utf8'), {
        ...runtime, __dirname: fileURLToPath(new URL('../../audit-tools', import.meta.url)), process: processFake,
        console: { log: (text: unknown) => logs.push(String(text)) },
        require: (name: string) => name === 'os' ? { ...os, availableParallelism: () => budget?.cpus ?? 4 }
            : name === 'fs' && budget ? { ...fs, readFileSync: (file: fs.PathOrFileDescriptor, encoding: BufferEncoding) => {
                if (String(file) === '/sys/fs/cgroup/cpu.max') {
                    if (budget.v1) throw Object.assign(new Error('គ្មាន v2'), { code: 'ENOENT' });
                    return budget.quota;
                }
                if (String(file).endsWith('cpu.cfs_quota_us')) return budget.quota.split(' ')[0];
                if (String(file).endsWith('cpu.cfs_period_us')) return budget.quota.split(' ')[1];
                return fs.readFileSync(file, encoding);
            } }
            : name === 'fs' && denyWrite ? { ...fs, writeFileSync: () => { throw new Error('synthetic disk full'); } }
            : name === 'child_process' ? { spawn: fakeSpawn( (_command: string, args: string[]) => {
                calls.push(args[2]); allArgs.push(args);
                if (args[2] !== 'test') return { status: 0, stdout: '', stderr: '' };
                reportFile = args.find(arg => arg.startsWith('--outputFile.json='))!.slice('--outputFile.json='.length);
                reportText = mode === 'malformed' ? '{synthetic broken report' : JSON.stringify({
                    success: mode === 'passed', startTime: Date.now(), numTotalTests: 1, numPassedTests: mode === 'passed' ? 1 : 0,
                    numFailedTests: mode === 'passed' ? 0 : 1, numPendingTests: 0, numTodoTests: 0,
                    testResults: [{ assertionResults: [{ status: mode === 'passed' ? 'passed' : 'failed', failureMessages: [stdout + stderr] }] }]
                });
                if (mode !== 'missing') fs.writeFileSync(reportFile, reportText);
                return { status: mode === 'failed' ? 1 : mode === 'timeout' ? null : 0, stdout, stderr,
                    ...(mode === 'timeout' ? { error: { code: 'ETIMEDOUT' } } : {}) };
            }) } : name === 'os' ? { ...os, availableParallelism: () => 4 } : requireReal(name)
    });
    return { root, logs: logs.join('\n'), calls, allArgs, code: processFake.exitCode, stdout, stderr, reportFile, reportText,
        artifacts: path.join(app, 'dist-audit/zoew-suite-failures'),
        cleanup: () => { fs.rmSync(root, { recursive: true, force: true }); if (reportFile) fs.rmSync(path.dirname(reportFile), { recursive: true, force: true }); } };
}

it('zoew-suite៖ បង្ហាញ error និងបរិបទ មិនឲ្យ object dump លាក់មូលហេតុ', async () => {
    const run = await runDiagnostic('failed');
    try {
        expect(run.code).toBe(1);
        expect(run.logs).toContain('AssertionError: synthetic child exited 1');
        expect(run.logs).toContain('context immediately after the assertion');
        expect(run.logs).toContain('error: synthetic database connection rejected');
        expect(run.logs).toContain("code: 'SYNTHETIC'");
        expect(run.logs).toContain('tests/synthetic.pg.test.ts');
        expect(run.logs).not.toContain('[Function: wrapper]');
        expect(run.calls).toHaveLength(13);
    } finally { run.cleanup(); }
});

it('zoew-suite៖ បរិបទមានព្រំដែន តែបញ្ជីឯកសារធ្លាក់នៅគ្រប់ និង input ខុសមិនបោះ error', async () => {
    const source = readFileSync(new URL('../../audit-tools/zoew-suite-test.js', import.meta.url), 'utf8');
    const detail = vm.runInNewContext(source.slice(source.indexOf('function failureDetail('), source.indexOf('\nfunction vitestReport('))
        + '\nfailureDetail') as (text: unknown, n: number) => string;
    const output = detail(Array.from({ length: 120 }, (_, i) => 'FAIL Error: ' + i + 'x'.repeat(3000)).join('\n') + '\nfinal-tail', 10);
    expect(output.length).toBeLessThan(100000);
    expect(output).toContain('final-tail');
    const files = Array.from({ length: 60 }, (_, i) => 'tests/failure-' + i + '.test.ts');
    const listed = detail(files.map(file => ' FAIL  ' + file + ' > synthetic').join('\n'), 10);
    for (const file of files) expect(listed).toContain('  - ' + file);
    for (const input of [undefined, null, NaN, {}, []]) expect(() => detail(input, 10)).not.toThrow();
});

it.each(['failed', 'timeout', 'malformed', 'missing'] as const)('zoew-suite៖ %s រក្សា stdout/stderr ឆៅ និង report ដែលមាន', async (mode) => {
    const run = await runDiagnostic(mode);
    try {
        expect(run.code).toBe(1);
        expect(fs.existsSync(run.artifacts)).toBe(true);
        const dirs = fs.readdirSync(run.artifacts);
        expect(dirs).toHaveLength(1);
        const artifact = path.join(run.artifacts, dirs[0]);
        expect(fs.readFileSync(path.join(artifact, 'stdout.log'), 'utf8')).toBe(run.stdout);
        expect(fs.readFileSync(path.join(artifact, 'stderr.log'), 'utf8')).toBe(run.stderr);
        expect(fs.existsSync(path.join(artifact, 'vitest.json'))).toBe(mode !== 'missing');
        if (mode !== 'missing') expect(fs.readFileSync(path.join(artifact, 'vitest.json'), 'utf8')).toBe(run.reportText);
        expect(fs.existsSync(run.reportFile)).toBe(false);
        expect(run.logs).toContain(artifact);
        expect(run.calls).toHaveLength(13);
    } finally { run.cleanup(); }
});

it('zoew-suite៖ ជោគជ័យសម្អាត report ហើយមិនបង្កើត failure artifact', async () => {
    const run = await runDiagnostic('passed');
    try {
        expect(run.code).toBe(0);
        expect(fs.existsSync(run.artifacts)).toBe(false);
        expect(fs.existsSync(run.reportFile)).toBe(false);
        expect(run.calls).toHaveLength(13);
    } finally { run.cleanup(); }
});

it('zoew-suite៖ storage បដិសេធ មិនលុប report ដើម មិនប្ដូរ FAIL ឬឈប់ជំហានក្រោយ', async () => {
    const run = await runDiagnostic('failed', true);
    try {
        expect(run.code).toBe(1);
        expect(run.logs).toContain('synthetic disk full');
        expect(fs.readFileSync(run.reportFile, 'utf8')).toBe(run.reportText);
        expect(run.logs).toContain(run.reportFile);
        expect(run.calls).toHaveLength(13);
    } finally { run.cleanup(); }
});

it('Audit៖ upload តែ failure diagnostics ដោយរក្សា action version និងសិទ្ធិដើម', async () => {
    const workflow = readFileSync(new URL('../../.github/workflows/audit.yml', import.meta.url), 'utf8');
    const steps = workflow.match(/^ {6}-[^\n]*(?:\n(?! {6}-)[^\n]*)*/gm) || [];
    const uploads = steps.filter(step => /path: ZoeW\/dist-audit\/zoew-suite-failures\//.test(step));
    expect(uploads).toHaveLength(1);
    expect(uploads[0]).toMatch(/^ {8}if: failure\(\)$/m);
    expect(uploads[0]).toContain('uses: actions/upload-artifact@v7');
    expect(uploads[0]).toContain('name: zoew-suite-failures-${{ matrix.shard }}');
    expect(uploads[0]).toMatch(/^ {10}path: ZoeW\/dist-audit\/zoew-suite-failures\/$/m);
    expect(uploads[0]).toContain('if-no-files-found: ignore');
    expect(uploads[0]).toContain('retention-days: 14');
    expect(uploads[0]).not.toMatch(/continue-on-error|include-hidden-files|\*\*/);
    expect(workflow).toContain('permissions:\n  contents: read');
});

it('zoew-suite៖ timeout រក្សា stdout និង stderr ដាច់គ្នា ដោយមិនប្ដូរពិដាន ឬរំលងជំហាន', async () => {
    const source = readFileSync(new URL('../../audit-tools/zoew-suite-test.js', import.meta.url), 'utf8');
    const pkg = readFileSync(new URL('../package.json', import.meta.url), 'utf8');
    const logs: string[] = [], steps: string[] = [], limits: number[] = [];
    const processFake = fakeProcess({ env: {}, argv: ['node', 'zoew-suite-test.js'], exitCode: 0 });
    await vm.runInNewContext(source, { ...runtime, __dirname: '/fixture/audit-tools', process: processFake, console: { log: (text: unknown) => logs.push(String(text)) },
        require: (name: string) => name === 'fs' ? { existsSync: () => true, readFileSync: () => pkg, mkdtempSync: () => '/fixture/report',
            mkdirSync() {}, writeFileSync() {}, copyFileSync() {}, rmSync() {} }
            : name === 'child_process' ? { spawn: fakeSpawn( (_command: string, args: string[], options: { timeout: number }) => {
                steps.push(args[2]); limits.push(options.timeout);
                return args[2] === 'test' ? { error: { code: 'ETIMEDOUT' }, stdout: 'LAST-TEST-MODULE', stderr: Array(100).fill('WARNING').join('\n') }
                    : { status: 0, stdout: '', stderr: '' };
            }) } : name === 'os' ? { ...os, availableParallelism: () => 4 } : requireReal(name)
    });
    expect(processFake.exitCode).toBe(1);
    expect(steps).toHaveLength(13);
    expect(limits.every(limit => limit === 240000)).toBe(true);
    expect(logs.join('\n')).toContain('LAST-TEST-MODULE');
    expect(logs.join('\n')).toContain('stderr៖');
    expect(logs.join('\n')).toContain('WARNING');
});
it.each([[1, 1], [3, 2], [4, 3], [5, 4]])('zoew-suite៖ ផ្នែក %s ត្រូវរត់ Vitest shard របស់ខ្លួន ដោយរក្សាពិដាន', async (part, shard) => {
    const source = readFileSync(new URL('../../audit-tools/zoew-suite-test.js', import.meta.url), 'utf8');
    const pkg = readFileSync(new URL('../package.json', import.meta.url), 'utf8');
    const runall = readFileSync(new URL('../../audit-tools/run-all.sh', import.meta.url), 'utf8');
    const calls: { args: string[]; timeout: number }[] = [];
    const processFake = fakeProcess({ env: {}, argv: ['node', 'zoew-suite-test.js', '--part=' + part + '/5'], exitCode: 1 });
    await vm.runInNewContext(source, { ...runtime, __dirname: '/fixture/audit-tools', process: processFake, console: { log() {} },
        require: (name: string) => name === 'fs' ? { existsSync: () => true, mkdtempSync: () => '/fixture/report', rmSync() {},
            readFileSync: (file: string) => file.endsWith('run-all.sh') ? runall : file.endsWith('vitest.json') ? JSON.stringify({
                success: true, startTime: Date.now(), numTotalTests: 1, numPassedTests: 1, numFailedTests: 0,
                numPendingTests: 0, numTodoTests: 0, testResults: [{ assertionResults: [{ status: 'passed' }] }]
            }) : pkg }
            : name === 'child_process' ? { spawn: fakeSpawn( (_command: string, args: string[], options: { timeout: number }) => {
                calls.push({ args: Array.from(args), timeout: options.timeout }); return { status: 0, stdout: '', stderr: '' };
            }) } : name === 'os' ? { ...os, availableParallelism: () => 4 } : requireReal(name)
    });
    expect(processFake.exitCode).toBe(0);
    expect(calls.filter(call => call.args[2] === 'test')).toHaveLength(1);
    const testArgs = calls.find(call => call.args[2] === 'test')?.args || [];
    expect(testArgs.filter(arg => !arg.startsWith('--reporter=') && !arg.startsWith('--outputFile.json=')))
        .toEqual(['run', '-s', 'test', '--', '--maxWorkers=4', '--shard=' + shard + '/4']);
    expect(testArgs).toContain('--outputFile.json=' + path.join('/fixture/report', 'vitest.json'));
    expect(calls.every(call => call.timeout === 240000)).toBe(true);
    expect(calls.filter(call => call.args[2] !== 'test').every(call => call.args.length === 3)).toBe(true);
});

it('zoew-suite៖ Vitest ពិតបែងឯកសារទាំងអស់ម្តងគត់ មិនខ្វះ មិនស្ទួន', async () => {
    const root = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
    const cli = fileURLToPath(new URL('../node_modules/vitest/vitest.mjs', import.meta.url));
    const files = JSON.parse(execFileSync(process.execPath, [cli, 'list', '--filesOnly', '--json'], { cwd: root, encoding: 'utf8', timeout: 30000 })) as { file: string }[];
    const specifications = files.map(file => ({ moduleId: file.file }));
    const groups = await Promise.all([1, 2, 3, 4].map(index => new BaseSequencer({ config: { root, shard: { index, count: 4 } } } as never).shard(specifications as never)));
    const flattened = groups.flatMap(group => group.map(file => file.moduleId));
    expect(files.length).toBeGreaterThan(200);
    expect(flattened.length).toBe(files.length);
    expect(new Set(flattened).size).toBe(flattened.length);
    expect(new Set(flattened)).toEqual(new Set(files.map(file => file.file)));
});

it.each([true, false])('runall-runner៖ TERM child early=%s រក្សាពិដាន ហើយសម្អាត deadline timer', async (earlyExit) => {
    const source = readFileSync(new URL('../../audit-tools/runall-runner-test.js', import.meta.url), 'utf8');
    const start = source.indexOf('async function sectionFive() {');
    const end = source.indexOf('\n// ═══ ៦.', start);
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    const section = source.slice(start, end);
    const deadline = Number(/setTimeout\((?:r|resolve),\s*(\d+)\)/.exec(section)?.[1]);
    expect(deadline).toBeGreaterThan(0);
    let now = 0, nextId = 0, completed = false;
    const timers = new Map<number, { callback: () => void; due: number }>();
    const signals: string[] = [], assertions: boolean[] = [];
    const child = new EventEmitter();
    const kill = (signal: string) => {
        signals.push(signal);
        if (signal === 'SIGTERM' && earlyExit) child.emit('exit', 130, null);
        if (signal === 'SIGKILL') child.emit('exit', null, 'SIGKILL');
        return true;
    };
    const completion = (vm.runInNewContext(section + '\nsectionFive()', {
        console: { log() {} }, cp: { spawn: () => Object.assign(child, { kill }) },
        newCase: () => '/fixture', writeHarness: () => '/fixture/harness.sh', harnessEnv: () => ({}),
        readLog: () => [{ kind: 'start', pid: 41001 }, { kind: 'start', pid: 41002 }],
        process: { kill: () => { throw new Error('ESRCH: synthetic child is gone'); } },
        Date: { now: () => now },
        setTimeout: (callback: () => void, delay: number) => {
            const id = ++nextId; timers.set(id, { callback, due: now + delay }); return id;
        },
        clearTimeout: (id: number) => timers.delete(id),
        ok: (_label: string, condition: boolean) => assertions.push(condition)
    }) as Promise<void>).then(() => { completed = true; });
    const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
    await flush();
    const initialDeadlines = [...timers.values()].map(timer => timer.due).sort((a, b) => a - b);
    for (let step = 0; !completed && step < 5; step++) {
        const entry = [...timers.entries()].sort((a, b) => a[1].due - b[1].due)[0];
        expect(entry).toBeDefined();
        timers.delete(entry[0]); now = entry[1].due; entry[1].callback(); await flush();
    }
    expect(completed).toBe(true);
    await completion;
    expect(timers.size).toBe(0);
    if (earlyExit) {
        expect(assertions).toEqual([true, true]);
        expect(signals).toEqual(['SIGTERM']);
        expect(now).toBeLessThan(deadline);
    } else {
        expect(initialDeadlines).toEqual([deadline]);
        expect(signals).toEqual(['SIGTERM', 'SIGKILL']);
        expect(assertions).toEqual([false, true]);
        expect(now).toBeGreaterThanOrEqual(deadline);
    }
});

it.each(['timeout', 'SIGTERM', 'success'] as const)('zoew-suite៖ %s សម្អាតកូនពិត ហើយមិនប៉ះដំណើរការផ្សេង', async (mode) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zoew-owned-step-'));
    const app = path.join(root, 'ZoeW'), bin = path.join(root, 'bin');
    for (const dir of ['src', 'node_modules/vite', 'node_modules/typescript']) fs.mkdirSync(path.join(app, dir), { recursive: true });
    fs.mkdirSync(bin);
    fs.writeFileSync(path.join(app, 'src/main.tsx'), '');
    fs.copyFileSync(new URL('../package.json', import.meta.url), path.join(app, 'package.json'));
    const marker = path.join(root, 'child.json'), heartbeat = path.join(root, 'heartbeat'), calls = path.join(root, 'calls');
    const fixture = `const fs = require('fs'); const cp = require('child_process'); fs.appendFileSync(${JSON.stringify(calls)}, process.argv[4] + '\\n');
const child = cp.spawn(process.execPath, ['-e', ${JSON.stringify(`const fs = require('fs'); process.on('SIGTERM', () => {}); fs.writeFileSync(${JSON.stringify(marker)}, JSON.stringify({pid: process.pid, parent: process.ppid})); setInterval(() => fs.appendFileSync(${JSON.stringify(heartbeat)}, '.'), 20); setTimeout(() => process.exit(0), 15000);`)}], {stdio: 'inherit'});
${mode === 'success' ? `const report = process.argv.find(arg => arg.startsWith('--outputFile.json=')).split('=').slice(1).join('='); fs.writeFileSync(report, JSON.stringify({success:true,startTime:Date.now(),numTotalTests:1,numPassedTests:1,numFailedTests:0,numPendingTests:0,numTodoTests:0,testResults:[{assertionResults:[{status:'passed'}]}]})); setTimeout(() => process.exit(0), 300);` : 'setInterval(() => {}, 1000);'}
`;
    fs.writeFileSync(path.join(bin, 'npm'), '#!' + process.execPath + '\n' + fixture, { mode: 0o755 });
    const sentinel = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });
    const suite = spawn(process.execPath, [process.env.ZOE_SUITE_REGRESSION_SOURCE || fileURLToPath(new URL('../../audit-tools/zoew-suite-test.js', import.meta.url)), ...(mode === 'SIGTERM' ? [] : [process.env.ZOE_SUITE_REGRESSION_SOURCE ? '--part=3/3' : '--part=3/5'])], {
        env: { ...process.env, PATH: bin + path.delimiter + process.env.PATH, ZOEWSUITE_APP_DIR: root, ZOEWSUITE_STEP_TIMEOUT_MS: '1500' }, stdio: ['ignore', 'pipe', 'pipe']
    });
    let output = '', ownedPid = 0, ownedParent = 0;
    suite.stdout.on('data', chunk => { output += chunk; });
    suite.stderr.on('data', chunk => { output += chunk; });
    const completion = new Promise<number | null>(resolve => suite.on('close', resolve));
    try {
        const started = Date.now();
        while (!fs.existsSync(marker) && Date.now() - started < 1300) await new Promise(resolve => setTimeout(resolve, 10));
        expect(fs.existsSync(marker)).toBe(true);
        const owned = JSON.parse(fs.readFileSync(marker, 'utf8'));
        ownedPid = owned.pid; ownedParent = owned.parent;
        if (mode === 'SIGTERM') suite.kill('SIGTERM');
        const code = await completion;
        expect(code).toBe(mode === 'success' ? 0 : 1);
        expect(Date.now() - started).toBeLessThan(5000);
        if (process.platform === 'linux' && fs.existsSync('/proc/' + ownedPid + '/stat')) {
            const stat = fs.readFileSync('/proc/' + ownedPid + '/stat', 'utf8');
            expect(['Z', 'X']).toContain(stat.slice(stat.lastIndexOf(')') + 2).split(' ')[0]);
        }
        const bytes = fs.existsSync(heartbeat) ? fs.statSync(heartbeat).size : 0;
        await new Promise(resolve => setTimeout(resolve, 150));
        expect(fs.existsSync(heartbeat) ? fs.statSync(heartbeat).size : 0).toBe(bytes);
        expect(() => process.kill(sentinel.pid!, 0)).not.toThrow();
        if (mode === 'timeout') expect(output).toContain('1.5s');
        expect(fs.readFileSync(calls, 'utf8').trim().split('\n')).toHaveLength(1);
    } finally {
        suite.kill('SIGKILL'); sentinel.kill('SIGKILL');
        if (ownedParent) { try { process.kill(ownedParent, 'SIGKILL'); } catch { /* មេបានបញ្ឈប់រួច */ } }
        if (ownedPid) { try { process.kill(ownedPid, 'SIGKILL'); } catch { /* កូនបានបញ្ឈប់រួច */ } }
        fs.rmSync(root, { recursive: true, force: true });
    }
}, 20000);

it('zoew-suite៖ spawn ខូច exit មិនសូន្យ និង output លើសព្រំដែន សុទ្ធតែ FAIL', async () => {
    const source = readFileSync(new URL('../../audit-tools/zoew-suite-test.js', import.meta.url), 'utf8');
    const run = vm.runInNewContext(source.slice(source.indexOf('function runStep('), source.indexOf('\nconst pkgFile =')) + '\nrunStep', {
        cp: requireReal('node:child_process'), fs, process, Buffer, setTimeout, clearTimeout
    }) as (command: string, args: string[], options: object) => Promise<{ status: number | null; error: { code: string } | null }>;
    const options = { cwd: os.tmpdir(), env: process.env, timeout: 1500, maxBuffer: 1024 };
    const listeners = process.listenerCount('SIGTERM');
    const absent = await run(path.join(os.tmpdir(), 'zoew-command-does-not-exist-' + process.pid), [], options);
    expect(absent.error?.code).toBe('ENOENT');
    const failed = await run(process.execPath, ['-e', 'process.exit(7)'], options);
    expect(failed.status).toBe(7);
    const overflow = await run(process.execPath, ['-e', "process.stdout.write('x'.repeat(2048)); setInterval(() => {}, 1000)"], options);
    expect(overflow.error?.code).toBe('ENOBUFS');
    expect(process.listenerCount('SIGTERM')).toBe(listeners);
});

it.each(['SIGTERM', 'SIGINT'] as const)('zoew-suite៖ %s មិនត្រូវបានលុបដោយ output ក្រោយបញ្ឈប់', async (signal) => {
    const source = readFileSync(new URL('../../audit-tools/zoew-suite-test.js', import.meta.url), 'utf8');
    let kills = 0;
    const owner = Object.assign(new EventEmitter(), { platform: 'darwin', kill() { kills++; } });
    const child = Object.assign(new EventEmitter(), { pid: 123, stdout: new EventEmitter(), stderr: new EventEmitter() });
    const run = vm.runInNewContext(source.slice(source.indexOf('function runStep('), source.indexOf('\nconst pkgFile =')) + '\nrunStep', {
        cp: { spawn: () => child }, fs, process: owner, Buffer, setTimeout, clearTimeout
    }) as (command: string, args: string[], options: object) => Promise<{ aborted: boolean; error: { code: string }; stdout: string; stderr: string }>;
    const completion = run('fixture', [], { timeout: 1000, maxBuffer: 1025 });
    owner.emit(signal);
    child.stderr.emit('data', '🙂'.repeat(2048)); child.stdout.emit('data', '🙂'.repeat(2048));
    child.emit('exit', 0, null); child.emit('close', 0, null);
    const result = await completion;
    expect(result.aborted).toBe(true);
    expect(result.error.code).toBe(signal);
    expect(Buffer.byteLength(result.stdout) + Buffer.byteLength(result.stderr)).toBeLessThanOrEqual(1025);
    expect(owner.listenerCount(signal)).toBe(0);
    const completedKills = kills;
    child.emit('exit', 0, null); child.stderr.emit('data', 'late'.repeat(2048));
    expect(kills).toBe(completedKills);
});

it('zoew-suite៖ exit មុនពិដាន បន្ទាប់មក close យឺត មិនប្ដូរជា timeout', async () => {
    const source = readFileSync(new URL('../../audit-tools/zoew-suite-test.js', import.meta.url), 'utf8');
    const owner = Object.assign(new EventEmitter(), { platform: 'darwin', kill() {} });
    const child = Object.assign(new EventEmitter(), { pid: 123, stdout: new EventEmitter(), stderr: new EventEmitter() });
    const callbacks = new Map<number, () => void>(); let id = 0;
    const run = vm.runInNewContext(source.slice(source.indexOf('function runStep('), source.indexOf('\nconst pkgFile =')) + '\nrunStep', {
        cp: { spawn: () => child }, fs, process: owner, Buffer,
        setTimeout: (callback: () => void) => { callbacks.set(++id, callback); return id; }, clearTimeout: (timer: number) => callbacks.delete(timer)
    }) as (command: string, args: string[], options: object) => Promise<{ status: number; error: unknown }>;
    const completion = run('fixture', [], { timeout: 240000, maxBuffer: 1024 });
    const executionTimer = id;
    child.emit('exit', 7, null);
    expect(callbacks.has(executionTimer)).toBe(false);
    expect(callbacks.size).toBe(1);
    child.emit('close', 7, null);
    expect(await completion).toMatchObject({ status: 7, error: null });
    expect(callbacks.size).toBe(0);
});


it.each([
    { cpus: 1, quota: 'max 100000', expected: 1 },
    { cpus: 2, quota: 'max 100000', expected: 2 },
    { cpus: 16, quota: 'max 100000', expected: 8 },
    { cpus: 8, quota: '200000 100000', expected: 2 },
    { cpus: 8, quota: '200000 100000', v1: true, expected: 2 },
    { cpus: 4, quota: '-1 100000', v1: true, expected: 4 },
    { cpus: 8, quota: '150000 100000', expected: 1 },
    { cpus: 2, quota: 'max 100000', workers: '4', expected: 4 }
])('zoew-suite៖ CPU budget $cpus quota $quota override $workers', async (budget) => {
    const run = await runDiagnostic('passed', false, budget);
    try {
        expect(run.code).toBe(0);
        expect(run.allArgs.find(args => args[2] === 'test')).toContain('--maxWorkers=' + budget.expected);
    } finally { run.cleanup(); }
});

it.each([
    { cpus: 2, quota: 'max 100000', workers: '0' },
    { cpus: 2, quota: 'max 100000', workers: '9' },
    { cpus: 2, quota: 'max 100000', workers: 'bad' },
    { cpus: 0, quota: 'max 100000' },
    { cpus: 2, quota: 'broken quota' },
    { cpus: 2, quota: 'max broken' },
    { cpus: 2, quota: '-1 100000' }
])('zoew-suite៖ CPU budget ខូច មិនចាប់ផ្តើមជំហាន $workers $quota', async (budget) => {
    const run = await runDiagnostic('passed', false, budget);
    try { expect(run.code).toBe(1); expect(run.calls).toHaveLength(0); }
    finally { run.cleanup(); }
});

it.each(['signal', 'verification'] as const)('zoew-suite៖ cleanup %s មិនច្បាស់ នៅតែ FAIL ក្រោយ output overflow', async (mode) => {
    const source = readFileSync(new URL('../../audit-tools/zoew-suite-test.js', import.meta.url), 'utf8');
    const owner = Object.assign(new EventEmitter(), { platform: 'linux', kill() {
        if (mode === 'signal') throw Object.assign(new Error('សិទ្ធិមិនគ្រប់'), { code: 'EPERM' });
    } });
    const child = Object.assign(new EventEmitter(), { pid: 123, stdout: new EventEmitter(), stderr: new EventEmitter() });
    const run = vm.runInNewContext(source.slice(source.indexOf('function runStep('), source.indexOf('\nconst pkgFile =')) + '\nrunStep', {
        cp: { spawn: () => child }, process: owner, Buffer, setTimeout, clearTimeout,
        fs: { readdirSync() { if (mode === 'verification') throw new Error('អានមិនបាន'); return []; } }
    }) as (command: string, args: string[], options: object) => Promise<{ cleanupFailed: boolean; error: { code: string } }>;
    const completion = run('fixture', [], { timeout: 1000, maxBuffer: 32 });
    child.emit('exit', 0, null); child.stderr.emit('data', 'x'.repeat(100)); child.emit('close', 0, null);
    const result = await completion;
    expect(result.cleanupFailed).toBe(true);
    expect(result.error.code).toBe('ECLEANUP');
});
