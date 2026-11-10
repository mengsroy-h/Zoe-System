import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { isDeepStrictEqual } from 'node:util';
import ts from 'typescript';
import { expect, it } from 'vitest';

const file = path.resolve(import.meta.dirname, '../../audit-tools/emu/registry-purge-atomic-sdk-test.js');
const text = readFileSync(file, 'utf8');
const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
const main = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'main');
if (!main) throw new Error('Missing main');
let loop: ts.Node | undefined;
function visit(node: ts.Node) {
    if (ts.isForOfStatement(node) && node.expression.getText(ast) === 'CASES') loop = node;
    ts.forEachChild(node, visit);
}
visit(main);
if (!loop) throw new Error('Missing provider loop');
const body = loop.getText(ast);

it('native trace ចង UTC ជាមួយព្រំ monotonic ហើយមិនប្រែពេល wall clock លោត', () => {
    const declaration = ast.statements.find(n => ts.isClassDeclaration(n) && n.name?.text === 'NativeWireTrace');
    if (!declaration) throw new Error('Missing actual NativeWireTrace');
    let monotonic = 1000000000n, wall = Date.UTC(2026, 10, 10, 6);
    const wallStart = new Date(wall).toISOString();
    class ClockDate extends Date {
        constructor() { super(wall); monotonic += 2000000n; }
    }
    const Trace = vm.runInNewContext(declaration.getText(ast) + '\nNativeWireTrace', {
        Date: ClockDate, process: { memoryUsage: () => ({ heapUsed: 1, rss: 2 }) }
    });
    const trace = new Trace(new URL('http://127.0.0.1:9000'), 'demo-f03-purge-anchor', () => monotonic);
    monotonic = 1005000000n;
    wall -= 86400000;
    trace.note('public-purge-start');
    const report = trace.summary();
    expect(report.timeAnchor).toEqual({ wallUtc: wallStart, monotonicBeforeMs: 0, monotonicAfterMs: 2 });
    expect(report.events[0].ms).toBe(5);
    monotonic = 16000000000n;
    wall += 172800000;
    trace.note('case-failed', { timedOut: true });
    expect(trace.summary().timeAnchor).toEqual(report.timeAnchor);
    expect(trace.summary().events[1].ms).toBe(15000);
    expect(trace.summary().events[1].timedOut).toBe(true);
    report.timeAnchor.wallUtc = 'changed copy';
    expect(trace.summary().timeAnchor.wallUtc).toBe(wallStart);
});

async function simulate(options: { failedProvider?: string; failure?: unknown; different?: boolean; providersDiffer?: boolean; missingLogical?: boolean } = {}) {
    const checks: { label: string; pass: boolean }[] = [];
    const results: { provider: string; error: string | null; pass: boolean }[] = [];
    const comparisons: { status: string; unavailableProviders?: string[] }[] = [];
    const closed: string[] = [];
    class Provider {
        faults = {}; trace = { note() {}, summary: () => ({}) };
        kind: string;
        constructor(kind: string) { this.kind = kind; }
        async setup() {}
        async close() { closed.push(this.kind); }
        async failureEvidence() { return null; }
        resourceReport() { return {}; }
    }
    const context = vm.createContext({
        CASES: [{ id: 'synthetic', count: 1, providersDiffer: options.providersDiffer }],
        NativeProvider: class extends Provider { constructor() { super('native'); } },
        SupabaseProvider: class extends Provider { constructor() { super('supabase'); } },
        window: { localStorage: { clear() {} }, sessionStorage: { clear() {} } },
        runtime: { api: { firebaseState: { authGeneration: 0 } } }, native: {}, sql: {},
        source: () => ({}), seedOf: () => ({}), digest: () => 'synthetic', activeCase: null,
        activeChecks: [], assertionsFor: () => [], results, providerComparisons: comparisons,
        fail: 0, bounded: (promise: Promise<unknown>) => promise,
        console: { error() {} }, equal: isDeepStrictEqual,
        runCase: async (_runtime: unknown, provider: Provider) => {
            if (provider.kind === options.failedProvider) throw options.failure;
            if (options.missingLogical && provider.kind === 'supabase') return {};
            return { logical: { count: options.different && provider.kind === 'supabase' ? 2 : 1 } };
        },
        requireCheck: (label: string, pass: boolean) => {
            checks.push({ label, pass });
            if (!pass) throw new Error('Assertion failed: ' + label);
        },
    });
    let thrown: unknown, rejected = false;
    try { await vm.runInContext('(async () => {' + body + '})()', context); }
    catch (error) { rejected = true; thrown = error; }
    return { thrown, rejected, checks, results, comparisons, closed, fail: context.fail };
}

it.each(['native', 'supabase'])('រក្សាកំហុសដើមពី %s និងមិនហៅថា parity mismatch', async failedProvider => {
    const failure = new Error('synthetic provider assertion');
    const result = await simulate({ failedProvider, failure });
    expect(result.thrown).toBe(failure);
    expect(result.rejected).toBe(true);
    expect(result.fail).toBeGreaterThan(0);
    expect(result.checks).toEqual([]);
    expect(result.comparisons).toEqual([{ id: 'synthetic', status: 'UNAVAILABLE', unavailableProviders: [failedProvider] }]);
    expect(result.results.find(row => row.provider === failedProvider)?.error).toContain(failure.message);
    expect(result.closed).toEqual(['native', 'supabase']);
});
it.each([null, undefined, 'synthetic thrown value'])('រក្សាតម្លៃ throw ដែលមិនមែន Error: %s', async failure => {
    const result = await simulate({ failedProvider: 'supabase', failure });
    expect(result.rejected).toBe(true);
    expect(result.thrown).toBe(failure);
    expect(result.comparisons[0]?.status).toBe('UNAVAILABLE');
});
it('លទ្ធផលមិនស្មើនៅតែបរាជ័យការប្រៀបធៀបដើម', async () => {
    const result = await simulate({ different: true });
    expect(String(result.thrown)).toContain('Assertion failed: matched logical state synthetic');
    expect(result.checks).toEqual([{ label: 'matched logical state synthetic', pass: false }]);
    expect(result.comparisons[0]?.status).toBe('MISMATCH');
});
it.each([false, true])('លទ្ធផលពេញលេញគោរព providersDiffer=%s', async providersDiffer => {
    const result = await simulate({ providersDiffer, different: providersDiffer });
    expect(result.rejected).toBe(false);
    expect(result.checks[0]?.pass).toBe(true);
    expect(result.comparisons[0]?.status).toBe('MATCH');
});
it('លទ្ធផល logical ដែលបាត់មិនមែន parity mismatch', async () => {
    const result = await simulate({ missingLogical: true });
    expect(result.rejected).toBe(true);
    expect(String(result.thrown)).toContain('Provider comparison unavailable: synthetic');
    expect(result.checks).toEqual([]);
    expect(result.comparisons[0]?.status).toBe('UNAVAILABLE');
});
