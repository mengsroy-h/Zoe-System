// @vitest-environment node
import { execFileSync } from 'node:child_process';
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

function runDiagnostic(mode: 'failed' | 'passed' | 'timeout' | 'malformed' | 'missing', denyWrite = false) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zoew-diagnostics-test-'));
    const app = path.join(root, 'ZoeW');
    for (const dir of ['src', 'node_modules/vite', 'node_modules/typescript']) fs.mkdirSync(path.join(app, dir), { recursive: true });
    fs.writeFileSync(path.join(app, 'src/main.tsx'), '');
    fs.copyFileSync(new URL('../package.json', import.meta.url), path.join(app, 'package.json'));
    const logs: string[] = [], calls: string[] = [];
    let reportFile = '', reportText = '';
    const stdout = '\u001b[31m FAIL  tests/synthetic.pg.test.ts > child\u001b[0m\nAssertionError: synthetic child exited 1\n'
        + 'context immediately after the assertion\n' + Array(100).fill('        [Function: wrapper] { listener: [Function (anonymous)] },').join('\n')
        + '\nerror: synthetic database connection rejected\n  code: \'SYNTHETIC\'\n' + Array(100).fill('object field').join('\n');
    const stderr = 'raw stderr before tail\n' + Array.from({ length: 20 }, (_, i) => 'trace-' + i).join('\n') + '\n';
    const processFake = { env: { ZOEWSUITE_APP_DIR: root }, argv: ['node', 'zoew-suite-test.js'], exitCode: 0 };
    vm.runInNewContext(readFileSync(new URL('../../audit-tools/zoew-suite-test.js', import.meta.url), 'utf8'), {
        __dirname: fileURLToPath(new URL('../../audit-tools', import.meta.url)), process: processFake,
        console: { log: (text: unknown) => logs.push(String(text)) },
        require: (name: string) => name === 'fs' && denyWrite ? { ...fs, writeFileSync: () => { throw new Error('synthetic disk full'); } }
            : name === 'child_process' ? { spawnSync: (_command: string, args: string[]) => {
                calls.push(args[2]);
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
            } } : requireReal(name)
    });
    return { root, logs: logs.join('\n'), calls, code: processFake.exitCode, stdout, stderr, reportFile, reportText,
        artifacts: path.join(app, 'dist-audit/zoew-suite-failures'),
        cleanup: () => { fs.rmSync(root, { recursive: true, force: true }); fs.rmSync(path.dirname(reportFile), { recursive: true, force: true }); } };
}

it('zoew-suite៖ បង្ហាញ error និងបរិបទ មិនឲ្យ object dump លាក់មូលហេតុ', () => {
    const run = runDiagnostic('failed');
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

it('zoew-suite៖ បរិបទមានព្រំដែន តែបញ្ជីឯកសារធ្លាក់នៅគ្រប់ និង input ខុសមិនបោះ error', () => {
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

it.each(['failed', 'timeout', 'malformed', 'missing'] as const)('zoew-suite៖ %s រក្សា stdout/stderr ឆៅ និង report ដែលមាន', (mode) => {
    const run = runDiagnostic(mode);
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

it('zoew-suite៖ ជោគជ័យសម្អាត report ហើយមិនបង្កើត failure artifact', () => {
    const run = runDiagnostic('passed');
    try {
        expect(run.code).toBe(0);
        expect(fs.existsSync(run.artifacts)).toBe(false);
        expect(fs.existsSync(run.reportFile)).toBe(false);
        expect(run.calls).toHaveLength(13);
    } finally { run.cleanup(); }
});

it('zoew-suite៖ storage បដិសេធ មិនលុប report ដើម មិនប្ដូរ FAIL ឬឈប់ជំហានក្រោយ', () => {
    const run = runDiagnostic('failed', true);
    try {
        expect(run.code).toBe(1);
        expect(run.logs).toContain('synthetic disk full');
        expect(fs.readFileSync(run.reportFile, 'utf8')).toBe(run.reportText);
        expect(run.logs).toContain(run.reportFile);
        expect(run.calls).toHaveLength(13);
    } finally { run.cleanup(); }
});

it('Audit៖ upload តែ failure diagnostics ដោយរក្សា action version និងសិទ្ធិដើម', () => {
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

it('zoew-suite៖ timeout រក្សា stdout និង stderr ដាច់គ្នា ដោយមិនប្ដូរពិដាន ឬរំលងជំហាន', () => {
    const source = readFileSync(new URL('../../audit-tools/zoew-suite-test.js', import.meta.url), 'utf8');
    const pkg = readFileSync(new URL('../package.json', import.meta.url), 'utf8');
    const logs: string[] = [], steps: string[] = [], limits: number[] = [];
    const processFake = { env: {}, argv: ['node', 'zoew-suite-test.js'], exitCode: 0 };
    vm.runInNewContext(source, { __dirname: '/fixture/audit-tools', process: processFake, console: { log: (text: unknown) => logs.push(String(text)) },
        require: (name: string) => name === 'fs' ? { existsSync: () => true, readFileSync: () => pkg, mkdtempSync: () => '/fixture/report',
            mkdirSync() {}, writeFileSync() {}, copyFileSync() {}, rmSync() {} }
            : name === 'child_process' ? { spawnSync: (_command: string, args: string[], options: { timeout: number }) => {
                steps.push(args[2]); limits.push(options.timeout);
                return args[2] === 'test' ? { error: { code: 'ETIMEDOUT' }, stdout: 'LAST-TEST-MODULE', stderr: Array(100).fill('WARNING').join('\n') }
                    : { status: 0, stdout: '', stderr: '' };
            } } : requireReal(name)
    });
    expect(processFake.exitCode).toBe(1);
    expect(steps).toHaveLength(13);
    expect(limits.every(limit => limit === 240000)).toBe(true);
    expect(logs.join('\n')).toContain('LAST-TEST-MODULE');
    expect(logs.join('\n')).toContain('stderr៖');
    expect(logs.join('\n')).toContain('WARNING');
});
it.each([[1, 1], [3, 2]])('zoew-suite៖ ផ្នែក %s ត្រូវរត់ Vitest shard របស់ខ្លួន ដោយរក្សាពិដាន', (part, shard) => {
    const source = readFileSync(new URL('../../audit-tools/zoew-suite-test.js', import.meta.url), 'utf8');
    const pkg = readFileSync(new URL('../package.json', import.meta.url), 'utf8');
    const runall = readFileSync(new URL('../../audit-tools/run-all.sh', import.meta.url), 'utf8');
    const calls: { args: string[]; timeout: number }[] = [];
    const processFake = { env: {}, argv: ['node', 'zoew-suite-test.js', '--part=' + part + '/3'], exitCode: 1 };
    vm.runInNewContext(source, { __dirname: '/fixture/audit-tools', process: processFake, console: { log() {} },
        require: (name: string) => name === 'fs' ? { existsSync: () => true, mkdtempSync: () => '/fixture/report', rmSync() {},
            readFileSync: (file: string) => file.endsWith('run-all.sh') ? runall : file.endsWith('vitest.json') ? JSON.stringify({
                success: true, startTime: Date.now(), numTotalTests: 1, numPassedTests: 1, numFailedTests: 0,
                numPendingTests: 0, numTodoTests: 0, testResults: [{ assertionResults: [{ status: 'passed' }] }]
            }) : pkg }
            : name === 'child_process' ? { spawnSync: (_command: string, args: string[], options: { timeout: number }) => {
                calls.push({ args: Array.from(args), timeout: options.timeout }); return { status: 0, stdout: '', stderr: '' };
            } } : requireReal(name)
    });
    expect(processFake.exitCode).toBe(0);
    expect(calls.filter(call => call.args[2] === 'test')).toHaveLength(1);
    const testArgs = calls.find(call => call.args[2] === 'test')?.args || [];
    expect(testArgs.filter(arg => !arg.startsWith('--reporter=') && !arg.startsWith('--outputFile.json=')))
        .toEqual(['run', '-s', 'test', '--', '--shard=' + shard + '/2']);
    expect(testArgs).toContain('--outputFile.json=' + path.join('/fixture/report', 'vitest.json'));
    expect(calls.every(call => call.timeout === 240000)).toBe(true);
    expect(calls.filter(call => call.args[2] !== 'test').every(call => call.args.length === 3)).toBe(true);
});

it('zoew-suite៖ Vitest ពិតបែងឯកសារទាំងអស់ម្តងគត់ មិនខ្វះ មិនស្ទួន', async () => {
    const root = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
    const cli = fileURLToPath(new URL('../node_modules/vitest/vitest.mjs', import.meta.url));
    const files = JSON.parse(execFileSync(process.execPath, [cli, 'list', '--filesOnly', '--json'], { cwd: root, encoding: 'utf8', timeout: 30000 })) as { file: string }[];
    const specifications = files.map(file => ({ moduleId: file.file }));
    const groups = await Promise.all([1, 2].map(index => new BaseSequencer({ config: { root, shard: { index, count: 2 } } } as never).shard(specifications as never)));
    const first = new Set(groups[0].map(file => file.moduleId)), second = new Set(groups[1].map(file => file.moduleId));
    expect(files.length).toBeGreaterThan(200);
    expect([...first].filter(file => second.has(file))).toEqual([]);
    expect(new Set([...first, ...second])).toEqual(new Set(files.map(file => file.file)));
    expect(groups[0].length + groups[1].length).toBe(files.length);
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
