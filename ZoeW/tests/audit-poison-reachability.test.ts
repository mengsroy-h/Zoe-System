import { readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import vm from 'node:vm';
import { parse } from 'acorn';
import { describe, expect, it } from 'vitest';

const guard = readFileSync('../audit-tools/exit-code-integrity.js', 'utf8');
const poison = vm.runInNewContext(guard.slice(guard.indexOf('const POISON ='), guard.indexOf('const BUDGET_MS')) + '\npoisonSource;', {});
const verdict = vm.runInNewContext(guard.slice(guard.indexOf('function poisonVerdict('), guard.indexOf('\n{\n    const cases', guard.indexOf('function poisonVerdict('))) + '\npoisonVerdict;', {});
const fixture = `let fail = 0;
function ok(label, cond, detail) { if (!cond) fail++; }
ok('real assertion', true);
process.exit(fail ? 1 : 0);`;
const run = (source: string) => {
    const result = spawnSync(process.execPath, ['-e', source], { encoding: 'utf8', timeout: 2000 });
    return { code: result.status, signal: result.signal, timedOut: !!result.error, out: result.stdout + result.stderr };
};

describe('exit poison៖ ការគាំងមិនមែនភស្តុតាងថាអះអាងធ្លាក់', () => {
    it('បំបែក poison ដែលបានរត់ពី syntax, startup, dependency និង runtime crash', () => {
        const poisoned = poison(fixture);
        expect(verdict(run(poisoned))).toBe('failed');
        for (const source of [
            'const = ;',
            "throw new Error('startup');\n" + poisoned,
            "require('zoe-deliberately-missing-module');\n" + poisoned,
            poisoned.replace("process.exit(fail ? 1 : 0);", "throw new TypeError('after assertion');"),
            poisoned.replace("ok('real assertion', true);", '')
        ]) expect(verdict(run(source))).not.toBe('failed');
    });
    it('comma declaration៖ ការពុល counter មិនបំផ្លាញ syntax ឬប្តូរ sibling', () => {
        const source = `let pass = 0, fail = 0, assertions = 7;
console.log('sibling=' + assertions); process.exit(fail ? 1 : 0);`;
        const result = run(poison(source));
        expect(result.out).toContain('sibling=7');
        expect(result.out).not.toContain('SyntaxError');
        expect(verdict(result)).toBe('failed');
    });
    it('រាល់ source ដែលពុលបាន នៅតែ parse បានដោយ parser ពិត', () => {
        let checked = 0;
        for (const directory of ['../audit-tools', '../audit-tools/emu', '../zto-import']) {
            for (const file of readdirSync(directory).filter(file => file.endsWith('.js') && !file.startsWith('.tmp-poison-'))) {
                const source = readFileSync(directory + '/' + file, 'utf8');
                const poisoned = poison(source);
                if (!poisoned) continue;
                expect(() => parse(poisoned, { ecmaVersion: 'latest', allowReturnOutsideFunction: true }), file).not.toThrow();
                checked++;
            }
        }
        expect(checked).toBeGreaterThan(100);
    });
    it('arrow assertion និង counter crash មិនលាក់ការគាំង', () => {
        const arrow = poison('const results = [];\nconst ok = (n, c, d) => results.push([n, !!c, d]); ok("probe", true); process.exit(results[0][1] ? 0 : 1);');
        expect(verdict(run(arrow))).toBe('failed');
        const counter = poison('let failed = 0; throw new Error("after counter"); process.exit(failed ? 1 : 0);');
        expect(verdict(run(counter))).toBe('unverified');
    });
    it('exit 0 នៅតែ fake-green ហើយ signal/timeout នៅតែ unverified', () => {
        expect(verdict(run(poison(fixture).replace('process.exit(fail ? 1 : 0)', 'process.exit(0)')))).toBe('fake-green');
        expect(verdict({ code: null, signal: 'SIGKILL', timedOut: false, out: '' })).toBe('unverified');
        expect(verdict({ code: 1, signal: null, timedOut: true, out: '' })).toBe('unverified');
        expect(verdict({ code: 1, signal: 'SIGTERM', timedOut: false, out: 'ZOE_EXITCODE_POISON_REACHED' })).toBe('unverified');
        expect(verdict(run("console.log('SKIP unavailable')"))).toBe('skipped');
    });
});
