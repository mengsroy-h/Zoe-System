// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { BaseSequencer } from 'vitest/node';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { expect, it } from 'vitest';
const requireReal = createRequire(import.meta.url);
it('zoew-suite៖ timeout រក្សា stdout និង stderr ដាច់គ្នា ដោយមិនប្ដូរពិដាន ឬរំលងជំហាន', () => {
    const source = readFileSync(new URL('../../audit-tools/zoew-suite-test.js', import.meta.url), 'utf8');
    const pkg = readFileSync(new URL('../package.json', import.meta.url), 'utf8');
    const logs: string[] = [], steps: string[] = [], limits: number[] = [];
    const processFake = { env: {}, argv: ['node', 'zoew-suite-test.js'], exitCode: 0 };
    vm.runInNewContext(source, { __dirname: '/fixture/audit-tools', process: processFake, console: { log: (text: unknown) => logs.push(String(text)) },
        require: (name: string) => name === 'fs' ? { existsSync: () => true, readFileSync: () => pkg }
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
        require: (name: string) => name === 'fs' ? { existsSync: () => true, readFileSync: (file: string) => file.endsWith('run-all.sh') ? runall : pkg }
            : name === 'child_process' ? { spawnSync: (_command: string, args: string[], options: { timeout: number }) => {
                calls.push({ args: Array.from(args), timeout: options.timeout }); return { status: 0, stdout: '', stderr: '' };
            } } : requireReal(name)
    });
    expect(processFake.exitCode).toBe(0);
    expect(calls.filter(call => call.args[2] === 'test')).toHaveLength(1);
    expect(calls.find(call => call.args[2] === 'test')?.args).toEqual(['run', '-s', 'test', '--', '--shard=' + shard + '/2']);
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
