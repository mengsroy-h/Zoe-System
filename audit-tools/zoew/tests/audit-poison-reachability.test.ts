import { readFileSync, readdirSync } from 'node:fs';
import * as fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { parse } from 'acorn';
import { describe, expect, it } from 'vitest';

const guard = readFileSync('../audit-tools/exit-code-integrity.js', 'utf8');
const poison = vm.runInNewContext(guard.slice(guard.indexOf('const POISON ='), guard.indexOf('function durationMs(')) + '\npoisonSource;', {});
const verdict = vm.runInNewContext(guard.slice(guard.indexOf('function poisonVerdict('), guard.indexOf('\n{\n    const cases', guard.indexOf('function poisonVerdict('))) + '\npoisonVerdict;', {});
const fixture = `let fail = 0;
function ok(label, cond, detail) { if (!cond) fail++; }
ok('real assertion', true);
process.exit(fail ? 1 : 0);`;
const run = (source: string) => {
    const result = spawnSync(process.execPath, ['-e', source], { encoding: 'utf8', timeout: 2000 });
    return { code: result.status, signal: result.signal, timedOut: !!result.error, out: result.stdout + result.stderr };
};

const cleanupStartup = guard.slice(guard.indexOf('const POISON_PREFIX ='), guard.indexOf('\nlet poisoned ='));
const cleanupFinally = guard.slice(guard.indexOf('try {\n    await runPoisonQueues'), guard.indexOf('\nconst slowest ='));
async function withCleanupFixture(child: boolean, check: (fixture: {
    tools: string; context: vm.Context; parents: string[];
}) => void | Promise<void>) {
    const root = fs.mkdtempSync(path.join(tmpdir(), 'zoe-poison-owner-'));
    const tools = path.join(root, 'audit-tools');
    fs.mkdirSync(path.join(tools, 'emu'), { recursive: true });
    fs.mkdirSync(path.join(tools, 'zto-import'));
    const parents = [tools, path.join(tools, 'emu'), path.join(tools, 'zto-import')]
        .map(directory => path.join(directory, '.tmp-poison-parent-repository-contract-test.js'));
    for (const parent of parents) fs.writeFileSync(parent, 'console.log("parent checker started");');
    const context = vm.createContext({
        fs, path, TOOLS: tools, ROOT: root, liveChildren: new Set(),
        process: { env: child ? { EXITCODE_CHILD: '1' } : {}, on() {}, exit() { throw new Error('unexpected exit'); } },
        mine: [], CONCURRENCY: 2, poisonOne: async () => {}, runPoisonQueues: async () => {}
    });
    try {
        vm.runInContext(cleanupStartup, context);
        await check({ tools, context, parents });
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
}

describe('poison cleanup៖ ឯកសារស្រមោលមានម្ចាស់តាម process', () => {
    it('កូនចាប់ផ្តើមមិនលុប checker របស់ឪពុកដែលមិនទាន់បានចាប់ផ្តើម', async () => {
        await withCleanupFixture(true, ({ parents }) => {
            for (const parent of parents) {
                const result = spawnSync(process.execPath, [parent], { encoding: 'utf8', timeout: 2000 });
                expect(result.status, result.stderr).toBe(0);
                expect(result.stdout).toContain('parent checker started');
            }
        });
    });
    it('កូនបញ្ចប់សម្អាតរបស់ខ្លួន ហើយរក្សា checker របស់ឪពុកឱ្យរត់បាន', async () => {
        await withCleanupFixture(true, async ({ tools, context, parents }) => {
            for (const parent of parents) fs.writeFileSync(parent, 'console.log("parent checker started");');
            const own = path.join(tools, '.tmp-poison-child-own.js');
            fs.writeFileSync(own, '');
            context.own = own;
            vm.runInContext('shadows.add(own)', context);
            await vm.runInContext('(async () => {\n' + cleanupFinally + '\n})()', context);
            expect(fs.existsSync(own)).toBe(false);
            for (const parent of parents) {
                const result = spawnSync(process.execPath, [parent], { encoding: 'utf8', timeout: 2000 });
                expect(result.status, result.stderr).toBe(0);
                expect(result.stdout).toContain('parent checker started');
            }
        });
    });
    it('process មេនៅតែសម្អាតឯកសារសល់ពេលចាប់ផ្តើម', async () => {
        await withCleanupFixture(false, ({ parents }) => {
            for (const parent of parents) expect(fs.existsSync(parent)).toBe(false);
        });
    });
    it('process មេនៅតែសម្អាតឯកសារសល់ពេលបញ្ចប់', async () => {
        await withCleanupFixture(false, async ({ context, parents }) => {
            for (const parent of parents) fs.writeFileSync(parent, '');
            await vm.runInContext('(async () => {\n' + cleanupFinally + '\n})()', context);
            for (const parent of parents) expect(fs.existsSync(parent)).toBe(false);
        });
    });
});

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
