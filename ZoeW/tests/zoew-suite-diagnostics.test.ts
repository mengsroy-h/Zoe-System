// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { BaseSequencer } from 'vitest/node';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { EventEmitter } from 'node:events';
import { expect, it } from 'vitest';
const requireReal = createRequire(import.meta.url);
it('zoew-suite៖ timeout រក្សា stdout និង stderr ដាច់គ្នា ដោយមិនប្ដូរពិដាន ឬរំលងជំហាន', () => {
    const source = readFileSync(new URL('../../audit-tools/zoew-suite-test.js', import.meta.url), 'utf8');
    const pkg = readFileSync(new URL('../package.json', import.meta.url), 'utf8');
    const logs: string[] = [], steps: string[] = [], limits: number[] = [];
    const processFake = { env: {}, argv: ['node', 'zoew-suite-test.js'], exitCode: 0 };
    vm.runInNewContext(source, { __dirname: '/fixture/audit-tools', process: processFake, console: { log: (text: unknown) => logs.push(String(text)) },
        require: (name: string) => name === 'fs' ? { existsSync: () => true, readFileSync: () => pkg, mkdtempSync: () => '/fixture/report', rmSync() {} }
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
    expect(testArgs).toContain('--outputFile.json=/fixture/report/vitest.json');
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
