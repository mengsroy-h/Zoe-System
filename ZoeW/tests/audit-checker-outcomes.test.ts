import { it, expect, vi } from 'vitest';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { execFile, spawnSync } from 'node:child_process';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { parse } from 'acorn';
import { simple } from 'acorn-walk';

it.each(['claimed', 'taken', 'release-failed', 'release-pending', 'stale-session'] as const)(
    'scan evidence VM exposes actual late-claim settlement and durable outcome: %s', async (scenario) => {
        const require = createRequire(import.meta.url);
        const { scanEvidenceRuntime, sliceFunction, memoryStorage } = require('../../audit-tools/react-view.js');
        const sourceRoot = process.cwd();
        const { moduleView, aliasStateFields } = await import(pathToFileURL(path.join(sourceRoot, 'scripts/checker-view.mjs')).href);
        const groups = JSON.parse(readFileSync(path.join(sourceRoot, 'src/_generated-state.json'), 'utf8'));
        const modules = ['src/core/storage.ts', 'src/core/shop-scope.ts', 'src/services/scan-evidence.ts', 'src/services/scan-pending.ts'];
        const viewOf = (name: string) => aliasStateFields(moduleView(readFileSync(path.join(sourceRoot, name), 'utf8'), name), groups).text;
        const views = Object.fromEntries(modules.map(name => [name, viewOf(name)]));
        const source = Object.values(views).join('\n') + viewOf('src/domain/registry.ts');
        const root = mkdtempSync(path.join(tmpdir(), 'zoe-scan-evidence-runtime-'));
        mkdirSync(path.join(root, 'ZoeW'));
        writeFileSync(path.join(root, 'ZoeW/audit-module-views.json'), JSON.stringify(views));
        try {
            const storage = memoryStorage({ zoew_firebase_config: JSON.stringify({ databaseURL: 'https://scan-runtime.invalid' }) });
            let resolveRelease!: (value: boolean) => void;
            const release = new Promise<boolean>(resolve => { resolveRelease = resolve; });
            const releaseRegistry = vi.fn(() => scenario === 'release-pending' ? release : Promise.resolve(scenario !== 'release-failed'));
            const context = vm.createContext({
                window: { localStorage: storage, sessionStorage: memoryStorage() }, crypto: require('node:crypto'),
                db: {}, fb: {}, auth: { currentUser: { uid: 'runtime-user' } }, authGeneration: 1, isInitializingFirebase: false,
                getFormattedDate: () => '2026-10-30', getServerNow: () => 1793358000000,
                showToast: vi.fn(), releaseBarcodesInRegistry: releaseRegistry
            });
            vm.runInContext(scanEvidenceRuntime(root, source) + '\n' + sliceFunction(source, 'releaseLateBarcodeClaim'), context);
            expect(vm.runInContext('typeof settlePendingScanClaim', context)).toBe('function');
            vm.runInContext(`globalThis.handle = preparePendingScan('LATE_RUNTIME', 5, 2);
                notePendingScan(handle, 'claim-pending');
                globalThis.journal = createScanEvidenceJournal(window.localStorage);
                globalThis.scope = handle.record.scope;`, context);
            expect(vm.runInContext('typeof pendingScanIsLive', context)).toBe('function');
            expect(vm.runInContext('pendingScanIsLive(handle.record.id, handle)', context)).toBe(true);
            expect(vm.runInContext('pendingScanIsLive(handle.record.id, { ...handle })', context)).toBe(false);
            const before = JSON.stringify(vm.runInContext('journal.list(scope)', context));
            expect(JSON.parse(before)).toHaveLength(1);
            let resolveClaim!: (value: string) => void;
            context.claimPromise = new Promise<string>(resolve => { resolveClaim = resolve; });
            expect(vm.runInContext("releaseLateBarcodeClaim(claimPromise, 'LATE_RUNTIME', handle)", context)).toBe(true);
            if (scenario === 'stale-session') context.authGeneration++;
            resolveClaim(scenario === 'taken' ? 'taken' : 'claimed');
            await new Promise<void>(resolve => setImmediate(resolve));
            if (scenario === 'release-pending') {
                expect(JSON.stringify(vm.runInContext('journal.list(scope)', context))).toBe(before);
                resolveRelease(true);
                await new Promise<void>(resolve => setImmediate(resolve));
            }
            expect(releaseRegistry).toHaveBeenCalledTimes(scenario === 'taken' || scenario === 'stale-session' ? 0 : 1);
            if (scenario === 'release-failed' || scenario === 'stale-session') {
                expect(JSON.stringify(vm.runInContext('journal.list(scope)', context))).toBe(before);
            } else expect(vm.runInContext('journal.list(scope)', context)).toEqual([]);
            vm.runInContext('releasePendingScan(handle)', context);
            expect(vm.runInContext('pendingScanIsLive(handle.record.id, handle)', context)).toBe(false);
        } finally { rmSync(root, { recursive: true, force: true }); }
    }
);

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
    const runners = ['runNode', 'runGuard', 'guardVerdict'].map(name => ast.body.find((n: any) => n.type === 'FunctionDeclaration' && n.id.name === name));
    let classifier: any;
    simple(ast, { ExpressionStatement(n: any) { if (source.slice(n.start, n.end).startsWith('tasks.forEach(')) classifier = n; } });
    expect(runners.every(Boolean)).toBe(true);
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
        writeFileSync(path.join(dir, guard.file), `
            const mode = process.env.ZOE_VERDICT_FIXTURE;
            if (mode === 'hang') setInterval(() => {}, 1000);
            else if (mode === 'missing') require('node:zoe-guardian-missing-control');
            else if (mode === 'syntax') new Function('function {');
            else if (mode === 'miscount') { console.log('  ok    assertion\\n✅ ជោគជ័យ 2'); }
            else if (mode === 'icons') { console.log('  ❌ assertion\\n❌ ធ្លាក់ 1 / ok 0'); process.exitCode = 1; }
            else if (mode === 'incomplete') { console.log('  FAIL  before crash'); process.exitCode = 1; }
            else if (mode === 'failure') { console.log('  FAIL  behavioral assertion\\n❌ ធ្លាក់ 1 / ok 0'); process.exitCode = 1; }
            else console.log('  ok    behavioral assertion\\n✅ ជោគជ័យ 1');
        `);
        vm.runInContext(runners.map((node: any) => source.slice(node.start, node.end)).join('\n'), context);
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
        expect(timed.ok).toHaveBeenCalledWith(false, expect.any(String), expect.any(String));
        expect(verdict(failure).caught).toBe(1);
        expect(verdict(baseline).caught).toBe(0);
        expect(verdict(await context.runGuard(guard, 'icons')).caught).toBe(1);
        for (const mode of ['missing', 'syntax', 'incomplete', 'miscount']) {
            const invalid = verdict(await context.runGuard(guard, mode));
            expect(invalid.caught).toBe(0);
            expect(invalid.ok).toHaveBeenCalledWith(false, expect.any(String), expect.any(String));
        }
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});


it('mutation លុយរក្សាទិដ្ឋភាពម៉ូឌុលដូចគ្នា ហើយបដិសេធ input បាត់ ចាស់ ឬមិនច្បាស់', () => {
    const source = readFileSync(path.resolve(process.cwd(), '../audit-tools/money-guardian-test.js'), 'utf8');
    const ast: any = parse(source, { ecmaVersion: 'latest' });
    const helper = ast.body.find((node: any) => node.type === 'FunctionDeclaration' && node.id.name === 'buildMutant');
    expect(helper).toBeTruthy();
    const root = mkdtempSync(path.join(tmpdir(), 'zoe-guardian-views-'));
    const module = 'function guardedValue() { return 1; }\n';
    const mutation = { from: 'return 1;', to: 'return 2;' };
    const fs = createRequire(import.meta.url)('node:fs');
    const context = vm.createContext({ fs, os: { tmpdir }, path, ROOT: root, SRC: module });
    let mutant: string | null = null;
    try {
        mkdirSync(path.join(root, 'ZoeW'));
        const viewsFile = path.join(root, 'ZoeW/audit-module-views.json');
        writeFileSync(viewsFile, JSON.stringify({ 'src/probe.ts': module }));
        vm.runInContext(source.slice(helper.start, helper.end), context);
        mutant = context.buildMutant(mutation);
        expect(mutant).toBeTruthy();
        const mutatedSource = readFileSync(path.join(mutant!, 'ZoeW/app.js'), 'utf8');
        const views = JSON.parse(readFileSync(path.join(mutant!, 'ZoeW/audit-module-views.json'), 'utf8'));
        expect(mutatedSource).toContain(views['src/probe.ts']);
        expect(vm.runInNewContext(views['src/probe.ts'] + '\nguardedValue()')).toBe(2);
        expect(readFileSync(viewsFile, 'utf8')).toContain('return 1;');
        writeFileSync(viewsFile, JSON.stringify({ 'src/probe.ts': module.replace('return 1;', 'return 3;') }));
        expect(context.buildMutant(mutation)).toBeNull();
        writeFileSync(viewsFile, JSON.stringify({ 'src/probe.ts': module }));
        context.SRC = module + module;
        expect(context.buildMutant(mutation)).toBeNull();
        context.SRC = module;
        rmSync(viewsFile);
        expect(() => context.buildMutant(mutation)).toThrow();
    } finally {
        if (mutant) rmSync(mutant, { recursive: true, force: true });
        rmSync(root, { recursive: true, force: true });
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


it('SheetJS origin guard follows the real target-tree React preflight and rejects wrong dependencies', () => {
    const repo = path.resolve(process.cwd(), '..');
    const require = createRequire(import.meta.url);
    const source = readFileSync(path.join(repo, 'audit-tools/dependency-security-test.js'), 'utf8');
    const ast: any = parse(source, { ecmaVersion: 'latest' });
    const probe = ast.body.find((node: any) => node.type === 'ForOfStatement' && source.slice(node.start, node.end).includes("'monthly-report-test.js'"));
    expect(probe).toBeTruthy();
    const root = mkdtempSync(path.join(tmpdir(), 'zoe-sheetjs-origin-'));
    mkdirSync(path.join(root, 'audit-tools'));
    mkdirSync(path.join(root, 'ZoeW'));
    writeFileSync(path.join(root, 'ZoeW/app.js'), 'const auditSource = true;');
    const checkers = ['export-cells-test.js', 'monthly-report-test.js', 'sheet-import-test.js'];
    for (const file of [...checkers, 'react-view.js']) {
        writeFileSync(path.join(root, 'audit-tools', file), readFileSync(path.join(repo, 'audit-tools', file)));
    }
    const monthlyPath = path.join(root, 'audit-tools/monthly-report-test.js');
    const original = readFileSync(monthlyPath, 'utf8');
    const vendorCall = "require(path.join(ROOT, 'ZoeW', 'vendor', 'xlsx.full.min.js'))";
    expect(original).toContain(vendorCall);
    const run = () => {
        const ok = vi.fn();
        vm.runInNewContext(source.slice(probe.start, probe.end), {
            ROOT: root, VENDOR: path.join(root, 'ZoeW/vendor/xlsx.full.min.js'),
            fs: { readFileSync }, path, vm, require, ok
        });
        return ok.mock.calls.filter(([label]) => label.startsWith('monthly-report-test.js'));
    };
    try {
        expect(run().every(([, passed]) => passed)).toBe(true);
        for (const replacement of ["require('xlsx')", "require(path.join(ROOT, 'wrong-vendor.js'))"]) {
            writeFileSync(monthlyPath, original.replace(vendorCall, () => replacement));
            const verdict = run();
            expect(verdict[0][1]).toBe(false);
            expect(verdict[0][2]).toBe(replacement === "require('xlsx')" ? 'xlsx' : path.join(root, 'wrong-vendor.js'));
        }
        writeFileSync(monthlyPath, original);
        rmSync(path.join(root, 'ZoeW/app.js'));
        expect(run()[0][1]).toBe(false);
    } finally { rmSync(root, { recursive: true, force: true }); }
});
