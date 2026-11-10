import { afterEach, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { parse } from 'acorn';
import { simple } from 'acorn-walk';

const require = createRequire(import.meta.url);
const source = readFileSync(require.resolve('../../audit-tools/money-cookie-blob.js'), 'utf8');
const { networkGate } = require('../../audit-tools/money-cookie-blob.js');
const readyMs = Number(/const MONEY_SWEEP_READY_MS = (\d+);/.exec(source)?.[1]
    || /const deadline = Date\.now\(\) \+ (\d+);/.exec(source)?.[1]);
const declarations: Record<string, string> = {};
simple(parse(source, { ecmaVersion: 'latest' }), {
    VariableDeclarator(node: any) {
        if (node.id.name === 'waitForGate' || node.id.name === 'start' && source.slice(node.start, node.end).includes('__moneySweepResults')) {
            declarations[node.id.name] = source.slice(node.init.start, node.init.end);
        }
    }
});
const active: any[] = [];
afterEach(async () => {
    for (const row of active.splice(0)) {
        row.gate.release(true);
        await vi.advanceTimersByTimeAsync(25000);
        await Promise.allSettled(row.window.__ops);
    }
    vi.useRealTimers();
});

async function fixture(preparationMs: number, write = true) {
    vi.useFakeTimers();
    vi.setSystemTime(100000);
    let client!: (data: string) => Promise<void>, server!: (data: string) => Promise<void>;
    const gate = await networkGate({ routeWebSocket: async (_url: RegExp, attach: (socket: any) => void) => attach({
        connectToServer: () => ({ send() {}, onMessage: (fn: typeof server) => { server = fn; } }),
        send() {}, onMessage: (fn: typeof client) => { client = fn; }
    }) }, 'firebase');
    gate.arm('after');
    const window: any = { __ops: [], scanHistory: [], ztoPickupStatus: new Map(), __startOp() {},
        __operationHistory: () => [], __journals: () => ({}), runAutomaticCleanupRules() {} };
    window.runZtoStatusSweep = async () => {
        window.ztoStatusInFlight = true;
        await new Promise(resolve => setTimeout(resolve, preparationMs));
        window.ztoPickupStatus.set('TARGET', { closed: true, signedAtExact: true, signedAt: 1 });
        window.ztoStatusInFlight = false;
    };
    window.syncZtoFinalMarks = async () => {
        if (!write) return;
        await client(JSON.stringify({ t: 'd', d: { r: 1, a: 'p', b: { p: '/zoew_scan_history_cod_dod/target', d: { clearClaim: 'claim' } } } }));
        await server(JSON.stringify({ t: 'd', d: { r: 1, b: { s: 'ok', d: '' } } }));
    };
    const dev = { page: { evaluate: (fn: any, argument: any) => Promise.resolve(fn(argument)) } };
    const context = { window, dev, gates: [gate], Date, setTimeout, console,
        sleep: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
        assert: require('node:assert/strict'), fixture: { world: { calls: [] } }, navigator: { onLine: true },
        code: 'TARGET', target: { id: 'target', code: 'TARGET' }, wanted: 'sweep', pick: 0, expectedSignedAt: 1,
        stage: 'move', movement: 'pickup2h', authMode: 'palm', signedTrash: false, flow: 'pickup2h', mode: 'close-after-commit',
        MONEY_SWEEP_READY_MS: readyMs };
    expect(Object.keys(declarations).sort()).toEqual(['start', 'waitForGate']);
    const start = runInNewContext('(' + declarations.start + ')', context);
    const waitForGate = runInNewContext('(' + declarations.waitForGate + ')', context);
    active.push({ gate, window });
    await start(dev);
    let result: { ok?: boolean; error?: Error } | undefined;
    const watched = waitForGate().then(() => { result = { ok: true }; }, (error: Error) => { result = { error }; });
    return { gate, window, watched, result: () => result };
}

it('Sign prerequisite ចំណាយ 9s មិនស៊ី deadline 8s របស់ write gate', async () => {
    const row = await fixture(9000);
    await vi.advanceTimersByTimeAsync(8100);
    expect(row.result(), 'Sign នៅក្នុងពិដាន15s ហើយការចាក់ write មិនទាន់ចាប់ផ្ដើម').toBeUndefined();
    await vi.advanceTimersByTimeAsync(1000);
    await row.watched;
    expect(row.result()).toEqual({ ok: true });
    expect(row.gate.hits).toBe(1);
});

it('Sign ready មិនមែន write hit៖ ក្រោយ ready 8s គ្មាន write ត្រូវធ្លាក់', async () => {
    const row = await fixture(9000, false);
    await vi.advanceTimersByTimeAsync(9500);
    expect(row.result()).toBeUndefined();
    await vi.advanceTimersByTimeAsync(8000);
    await row.watched;
    expect(row.result()?.error?.message).toContain('ការចាក់បណ្តាញត្រូវបាញ់ write ពិត');
    expect(row.gate.hits).toBe(0);
});

it('prerequisite ព្យួរហួសពិដានដើម ត្រូវធ្លាក់ដោយមិនរាប់ write ជា PASS', async () => {
    expect(readyMs).toBe(15000);
    const row = await fixture(readyMs + 1000, false);
    await vi.advanceTimersByTimeAsync(readyMs + 100);
    await row.watched;
    expect(row.result()?.error?.message).toContain('ZTO prerequisite');
    expect(row.gate.hits).toBe(0);
});
