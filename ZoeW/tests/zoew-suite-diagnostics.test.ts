// @vitest-environment node
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
