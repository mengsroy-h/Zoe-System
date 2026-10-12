import { it, expect, vi } from 'vitest';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { execFile } from 'node:child_process';
import vm from 'node:vm';
import { parse } from 'acorn';
import { simple } from 'acorn-walk';

it('a real killed guard cannot count as a detected money mutation; assertion failures can', async () => {
    const source = readFileSync(path.resolve(process.cwd(), '../audit-tools/money-guardian-test.js'), 'utf8');
    const ast: any = parse(source, { ecmaVersion: 'latest' });
    const runner = ast.body.find((n: any) => n.type === 'FunctionDeclaration' && n.id.name === 'runGuard');
    let classifier: any;
    simple(ast, { ExpressionStatement(n: any) { if (source.slice(n.start, n.end).startsWith('tasks.forEach(')) classifier = n; } });
    expect(runner).toBeTruthy();
    expect(classifier).toBeTruthy();
    const dir = mkdtempSync(path.join(tmpdir(), 'zoe-guard-verdict-'));
    const interrupted = vi.fn();
    const guard = { file: 'child.cjs', env: 'ZOE_VERDICT_FIXTURE' };
    const context = vm.createContext({
        process: { execPath: process.execPath, env: {} }, path, __dirname: dir,
        execFile: (cmd: string, args: string[], options: any, callback: any) => execFile(cmd, args, { ...options, timeout: 500 }, (error, stdout, stderr) => {
            if (error?.killed) interrupted(error.signal);
            callback(error, stdout, stderr);
        })
    });
    try {
        writeFileSync(path.join(dir, guard.file), "if(process.env.ZOE_VERDICT_FIXTURE==='hang')setInterval(()=>{},1000);else process.exit(process.env.ZOE_VERDICT_FIXTURE==='failure'?1:0);\n");
        vm.runInContext(source.slice(runner.start, runner.end), context);
        const baseline = await context.runGuard(guard, 'clean');
        const timeout = await context.runGuard(guard, 'hang');
        const failure = await context.runGuard(guard, 'failure');
        expect(baseline.code).toBe(0);
        expect(failure.code).toBe(1);
        expect(interrupted).toHaveBeenCalledOnce();
        const verdict = (result: any) => {
            context.tasks = [{ mi: 0, g: guard }];
            context.verdicts = [result];
            context.caughtBy = [[]];
            context.mutants = [{ m: { name: 'fixture' } }];
            context.ok = vi.fn();
            vm.runInContext(source.slice(classifier.start, classifier.end), context);
            return { caught: context.caughtBy[0].length, ok: context.ok };
        };
        const timed = verdict(timeout);
        expect(timed.caught).toBe(0);
        expect(timed.ok).toHaveBeenCalledWith(false, expect.any(String));
        expect(verdict(failure).caught).toBe(1);
        expect(verdict(baseline).caught).toBe(0);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});
