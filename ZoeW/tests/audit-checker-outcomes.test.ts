import { it, expect, vi } from 'vitest';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { execFile, spawnSync } from 'node:child_process';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { parse } from 'acorn';
import { simple } from 'acorn-walk';

it.each([
    { host: 5, available: 4, quota: '400000 100000', expected: 4 },
    { host: 64, available: 4, quota: '400000 100000', expected: 4 },
    { host: 64, available: 8, quota: '200000 100000', expected: 2 },
    { host: 64, available: 8, quota: '150000 100000', expected: 2 },
    { host: 5, available: 4, quota: 'invalid', expected: 4 },
    { host: 5, available: 4, quota: null, expected: 4 },
    { host: 3, available: null, quota: 'max 100000', expected: 3 },
    { host: 64, available: 8, quota: null, legacyQuota: '300000', expected: 3 },
    { host: 64, available: 4, quota: '400000 100000', override: '12', expected: 12 },
    { host: 64, available: 4, quota: '400000 100000', override: '0', expected: 4 }
])('poison workers respect available CPU and cgroup quota: %j', fixture => {
    const source = readFileSync(path.resolve(process.cwd(), '../audit-tools/exit-code-integrity.js'), 'utf8');
    const ast: any = parse(source, { ecmaVersion: 'latest' });
    const helper = ast.body.find((node: any) => node.type === 'FunctionDeclaration' && node.id.name === 'poisonConcurrency');
    const selection = ast.body.flatMap((node: any) => node.declarations || []).find((node: any) => node.id.name === 'CONCURRENCY');
    expect(helper).toBeTruthy();
    expect(selection).toBeTruthy();
    const fakeOs = { cpus: () => Array(fixture.host), ...(fixture.available == null ? {} : { availableParallelism: () => fixture.available }) };
    const context = vm.createContext({
        process: { env: fixture.override ? { EXITCODE_CONCURRENCY: fixture.override } : {} },
        require: (name: string) => { expect(name).toBe('os'); return fakeOs; },
        fs: { readFileSync: (file: string) => {
            if (file.endsWith('/cpu.max') && fixture.quota != null) return fixture.quota;
            if ('legacyQuota' in fixture && fixture.legacyQuota) {
                if (file.endsWith('/cpu.cfs_quota_us')) return fixture.legacyQuota;
                if (file.endsWith('/cpu.cfs_period_us')) return '100000';
            }
            throw new Error('ENOENT');
        } }
    });
    vm.runInContext(source.slice(helper.start, helper.end), context);
    expect(vm.runInContext(source.slice(selection.init.start, selection.init.end), context)).toBe(fixture.expected);
});

it('browser subprocess wrappers share the browser exclusion while ordinary checkers remain poisonable', () => {
    const source = readFileSync(path.resolve(process.cwd(), '../audit-tools/exit-code-integrity.js'), 'utf8');
    const ast: any = parse(source, { ecmaVersion: 'latest' });
    const helper = ast.body.find((node: any) => node.type === 'FunctionDeclaration' && node.id.name === 'checkerBrowserDependency');
    expect(helper).toBeTruthy();
    const dir = mkdtempSync(path.join(tmpdir(), 'zoe-checker-browser-'));
    const context = vm.createContext({ ROOT: dir, TOOLS: dir, fs: { readFileSync }, path, acorn: { parse } });
    try {
        writeFileSync(path.join(dir, 'browser.js'), "require('playwright-core');\n");
        writeFileSync(path.join(dir, 'browser-import.js'), "import { chromium } from 'playwright-core';\n");
        writeFileSync(path.join(dir, 'capture.js'), "const path=require('path'); const {execFile}=require('child_process'); execFile(process.execPath,[path.join(__dirname,'browser.js')],()=>{});\n");
        writeFileSync(path.join(dir, 'wrapper.js'), "const path=require('path'); const cp=require('child_process'); cp.spawn(process.execPath,[path.resolve(__dirname,'capture.js')]);\n");
        writeFileSync(path.join(dir, 'ordinary.js'), "const name='browser.js'; const note=\"require('playwright-core')\"; console.log(name,note); process.exit(1);\n");
        vm.runInContext(source.slice(helper.start, helper.end), context);
        expect(context.checkerBrowserDependency('browser.js')).toEqual(['browser.js']);
        expect(context.checkerBrowserDependency('browser-import.js')).toEqual(['browser-import.js']);
        expect(context.checkerBrowserDependency('capture.js')).toEqual(['capture.js', 'browser.js']);
        expect(context.checkerBrowserDependency('wrapper.js')).toEqual(['wrapper.js', 'capture.js', 'browser.js']);
        expect(context.checkerBrowserDependency('ordinary.js')).toBeNull();
        expect(['capture.js', 'ordinary.js'].filter(file => !context.checkerBrowserDependency(file))).toEqual(['ordinary.js']);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});

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


it('React checker rendering isolates stores and module collections across scenarios, including throws', () => {
    const require = createRequire(import.meta.url);
    const { renderComponent, renderFromContext } = require('../../audit-tools/react-view.js');
    const root = mkdtempSync(path.join(tmpdir(), 'zoe-react-view-isolation-'));
    mkdirSync(path.join(root, 'ZoeW'));
    writeFileSync(path.join(root, 'ZoeW/react-render.cjs'), `
        const state = { label: 'clean', subscribe() {}, version() { return 0; } };
        const pending = new Set(['initial']);
        const lookup = new Map([['initial', 1]]);
        module.exports = {
            FILES: ['fixture.tsx'], STATE_FIELDS: { uiState: ['label', 'extra'] },
            STATE_MODULES: ['fixture'], stores: { uiState: state }, s0: { pending, lookup },
            c0: { View() {
                if (state.label === 'throw') throw new Error('render failed');
                return JSON.stringify([state.label, 'extra' in state, [...pending], [...lookup]]);
            } }, createElement: C => C(), renderToStaticMarkup: html => html
        };
    `);
    const render = (ctx: any) => JSON.parse(renderFromContext(root, vm.createContext(ctx), 'fixture.tsx', 'View'));
    const clean = ['clean', false, ['initial'], [['initial', 1]]];
    try {
        expect(render({})).toEqual(clean);
        expect(render({ label: 'first', extra: true, pending: new Set(['first']), lookup: new Map([['first', 2]]) }))
            .toEqual(['first', true, ['first'], [['first', 2]]]);
        expect(render({})).toEqual(clean);
        expect(() => render({ label: 'throw', extra: true, pending: new Set(), lookup: new Map() })).toThrow('render failed');
        expect(render({})).toEqual(clean);
        expect(() => renderComponent(root, 'fixture.tsx', 'View', { uiState: { label: 'throw' } })).toThrow('render failed');
        expect(render({})).toEqual(clean);
        expect(() => renderComponent(root, 'fixture.tsx', 'View', { uiState: { label: 'first' }, missing: {} })).toThrow();
        expect(render({})).toEqual(clean);
        const bundle = require(path.join(root, 'ZoeW/react-render.cjs'));
        expect(render({ pending: bundle.s0.pending, lookup: bundle.s0.lookup })).toEqual(clean);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});


it.each([
    ['registry-release-test.js', 'REGISTRY_APP_DIR'],
    ['price-edit-abort-test.js', 'PRICEABORT_APP_DIR'],
    ['late-commit-test.js', 'LATECOMMIT_APP_DIR'],
    ['pickup-reset-test.js', 'PICKUPRESET_APP_DIR'],
    ['ledger-failed-apply-revert-test.js', 'LEDGERFAIL_APP_DIR'],
    ['pickup-barcode-identity-test.js', 'PICKUPID_APP_DIR'],
    ['monthly-ledger-agreement-test.js', 'MONTHLYAGREE_APP_DIR'],
    ['revenue-rules-clamp-test.js', 'REVCLAMP_APP_DIR'],
    ['loop-termination-test.js', 'LOOPTERM_APP_DIR'],
    ['ledger-clamp-symmetry-test.js', 'CLAMPSYM_APP_DIR'],
    ['version-check.js', 'VERSION_APP_DIR'],
    ['monthly-report-test.js', 'MREPORT_APP_DIR'],
    ['collected-value-fuzz-test.js', 'COLLECTFUZZ_APP_DIR']
])('%s rejects the source checkout with an actionable React build diagnostic', (checker, envName) => {
    const repo = path.resolve(process.cwd(), '..');
    const result = spawnSync(process.execPath, [path.join(repo, 'audit-tools', checker)], {
        encoding: 'utf8', env: { ...process.env, [envName]: repo, NODE_PATH: path.join(repo, 'ZoeW/node_modules') }
    });
    expect(result.status).toBe(1);
    const output = result.stdout + result.stderr;
    expect(output).toContain('ZoeW/src/**');
    expect(output).toContain('dist-audit');
    expect(output).toContain('ZOE_MEASURE_ONLY=1 bash audit-tools/run-all.sh');
    expect(output).not.toContain('ENOENT');
});

it('checker source selection distinguishes React source, generated and legacy trees without changing roots', () => {
    const { readAppCode, appCodeLabel } = createRequire(import.meta.url)('../../audit-tools/react-view.js');
    const root = mkdtempSync(path.join(tmpdir(), 'zoe-checker-root-'));
    try {
        mkdirSync(path.join(root, 'ZoeW'));
        mkdirSync(path.join(root, 'ZoeKeyGen'));
        writeFileSync(path.join(root, 'ZoeW/app.js'), 'generated sentinel');
        writeFileSync(path.join(root, 'ZoeKeyGen/app.js'), 'vanilla sentinel');
        expect(readAppCode(root, 'ZoeKeyGen')).toBe('vanilla sentinel');
        expect(appCodeLabel(root, 'ZoeKeyGen')).toContain('ZoeKeyGen/app.js');
        expect(appCodeLabel(root, 'ZoeKeyGen')).not.toContain('dist-audit');
        expect(appCodeLabel(root, 'ZoeW')).not.toContain('dist-audit');
        expect(readAppCode(root, 'ZoeW')).toBe('generated sentinel');
        mkdirSync(path.join(root, 'ZoeW/src'));
        writeFileSync(path.join(root, 'ZoeW/src/main.tsx'), 'React source sentinel');
        expect(() => readAppCode(root, 'ZoeW')).toThrow(/ZoeW\/src/);
        rmSync(path.join(root, 'ZoeW/src/main.tsx'));
        writeFileSync(path.join(root, 'ZoeW/audit-module-views.json'), '{}');
        expect(appCodeLabel(root, 'ZoeW')).toContain('ZoeW/src/**');
        expect(appCodeLabel(root, 'ZoeW')).toContain('dist-audit');
        expect(readAppCode(root, 'ZoeW')).toBe('generated sentinel');
        rmSync(path.join(root, 'ZoeW/app.js'));
        expect(() => readAppCode(root, 'ZoeW')).toThrow(/dist-audit/);
    } finally { rmSync(root, { recursive: true, force: true }); }
});
