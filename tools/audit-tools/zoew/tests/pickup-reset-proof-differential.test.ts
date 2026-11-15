import { expect, it } from 'vitest';
import { createHash, webcrypto } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const root = path.resolve(__dirname, '../../../..');
const fixture = path.join(root, 'tools/audit-tools/fixtures/pickup-reset-proof-979f5e3f.ts');
const original = fs.readFileSync(fixture, 'utf8');
const current = fs.readFileSync(path.join(root, 'ZoeW/src/domain/pickup-reset-proof.ts'), 'utf8');
const load = (source: string) => {
    const exports: Record<string, unknown> = {};
    const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
    runInNewContext(code, { exports, crypto: webcrypto, TextEncoder });
    return exports;
};
const before = load(original), after = load(current);
const context = () => ({ v: 1, scope: 'https://reset-proof.invalid', batchId: 'batch', batchHash: 'a'.repeat(64),
    dayId: 'batch:2026-11-01', day: '2026-11-01', nonce: 'nonce' });
const receipt = () => ({ ...context(), outcome: 'applied', proof: 'native-day', tenant: 'tenant', actorUid: 'actor',
    attemptId: 'b'.repeat(64), intentHash: 'b'.repeat(64), beforeRevision: 1, beforeEpoch: 0, afterRevision: 2, afterEpoch: 1 });
const operation = () => ({ k: 'cas', p: ['zoew_daily_pickup_cod_dod', '2026-11-01'], x: null,
    v: { pickupRevision: 1, pickupResetEpoch: 1, packagesPickedUp: 0, pickedUpPhones: null, pickedUpBarcodes: null } });
const values: (() => unknown)[] = [
    () => undefined, () => null, () => false, () => true, () => 0, () => -0, () => 1, () => -1, () => 1.5,
    () => Number.MAX_SAFE_INTEGER - 1, () => Number.MAX_SAFE_INTEGER, () => NaN, () => Infinity, () => -Infinity,
    () => 1n, () => Symbol('proof'), () => '', () => '2026-11-01', () => 'a'.repeat(64), () => '\u0000',
    () => '\ud800', () => '\udc00', () => '\ud83d\ude00', () => ({}), () => [], () => ['2026-11-01'],
    () => Object(1), () => Object('2026-11-01'), () => new Date(0), () => new Uint8Array([1]), () => (() => 1)
];

function normalized(value: unknown, seen = new Map<object, number>()): unknown {
    if (value === null) return null;
    if (typeof value === 'undefined') return { type: 'undefined' };
    if (typeof value === 'number') return { type: 'number', value: Object.is(value, -0) ? '-0' : String(value) };
    if (typeof value === 'bigint' || typeof value === 'symbol') return { type: typeof value, value: String(value) };
    if (typeof value === 'function') return { type: 'function' };
    if (typeof value !== 'object') return value;
    if (seen.has(value)) return { reference: seen.get(value) };
    seen.set(value, seen.size);
    return { array: Array.isArray(value), entries: Object.entries(value).map(([key, item]) => [key, normalized(item, seen)]) };
}

async function outcome(module: Record<string, unknown>, name: string, args: unknown[]) {
    const fn = module[name];
    if (typeof fn !== 'function') throw new Error('Missing original codec function ' + name);
    try {
        const result: unknown = await Reflect.apply(fn, undefined, args);
        return { result: normalized(result), originalInput: args.map(value => Object.is(value, result)) };
    } catch (error) {
        return { error: error && typeof error === 'object' && 'name' in error ? String(error.name) : typeof error,
            message: error && typeof error === 'object' && 'message' in error ? String(error.message) : String(error) };
    }
}

it('Reset proof ៖ fixture ដើមចាក់សោ SHA ដោយមិនទាមទារ git history ពេលរត់', () => {
    expect(createHash('sha256').update(original).digest('hex')).toBe('e1eece598dc41ee327b92f7a14c0a8b6316b79fb249f292317e7d70f8ba06ca0');
});

it('Reset proof ៖ strict types រក្សាលទ្ធផលដើមលើ malformed/native/Unicode/boundary inputs', async () => {
    const differences: string[] = [];
    let measured = 0;
    const compare = async (name: string, build: () => unknown[]) => {
        measured++;
        const expected = await outcome(before, name, build()), actual = await outcome(after, name, build());
        if (JSON.stringify(actual) !== JSON.stringify(expected)) differences.push(name + ':' + measured + ':' + JSON.stringify({ expected, actual }));
    };
    for (const value of values) {
        for (const name of ['pickupResetContextOf', 'pickupResetReceiptOf', 'assertPickupResetApplied', 'pickupResetCasOf']) await compare(name, () => [value()]);
        await compare('preservePickupResetApplied', () => [null, value()]);
        await compare('preservePickupResetApplied', () => [{ pickupResetRevision: 2, pickupResetApplied: receipt(), pickupRevision: 2, pickupResetEpoch: 1 }, value()]);
        await compare('pickupResetReceiptMatches', () => [value(), receipt()]);
        await compare('pickupResetReceiptMatches', () => [receipt(), value()]);
        await compare('pickupResetCasText', () => [value(), null, operation().v]);
        await compare('pickupResetCasText', () => ['2026-11-01', value(), operation().v]);
        await compare('pickupResetBatchPreimage', () => ['tenant', 'scope', 'actor', 'batch', value()]);
        for (const field of Object.keys(context())) await compare('pickupResetContextOf', () => [{ ...context(), [field]: value() }]);
        for (const field of Object.keys(receipt())) {
            await compare('pickupResetReceiptOf', () => [{ ...receipt(), [field]: value() }]);
            await compare('assertPickupResetApplied', () => [{ pickupRevision: 2, pickupResetEpoch: 1, pickupResetApplied: { ...receipt(), [field]: value() } }]);
        }
        for (const field of ['pickupRevision', 'pickupResetEpoch']) {
            await compare('assertPickupResetApplied', () => [{ pickupRevision: 2, pickupResetEpoch: 1, pickupResetApplied: receipt(), [field]: value() }]);
            await compare('preservePickupResetApplied', () => [{ pickupRevision: 2, pickupResetEpoch: 1, pickupResetApplied: receipt() },
                { pickupRevision: 2, pickupResetEpoch: 1, [field]: value() }]);
        }
    }
    for (const basis of [null, {}, { pickupRevision: 1, pickupResetEpoch: 0 }, { pickupRevision: 1, pickupResetEpoch: -0 },
        { pickupRevision: 9007199254740989, pickupResetEpoch: 9007199254740989 }, { legacyNote: 'x'.repeat(4097) }]) {
        const legacy = basis === null || !('pickupRevision' in basis);
        const revision = legacy ? 0 : basis.pickupRevision, epoch = legacy ? 0 : basis.pickupResetEpoch;
        const valid = { ...operation(), x: basis, v: { ...operation().v, pickupRevision: revision + 1, pickupResetEpoch: epoch + 1 } };
        await compare('pickupResetCasOf', () => [JSON.stringify(valid)]);
        for (const field of ['pickupRevision', 'pickupResetEpoch', 'packagesPickedUp', 'pickedUpPhones', 'pickedUpBarcodes']) {
            for (const value of values) await compare('pickupResetCasText', () => ['2026-11-01', basis, { ...valid.v, [field]: value() }]);
        }
    }
    await compare('pickupResetCasOf', () => ['{"k":"cas","p":["zoew_daily_pickup_cod_dod","2026-11-01"],"x":{"pickupRevision":1,"pickupResetEpoch":-0},"v":{"pickupRevision":2,"pickupResetEpoch":1,"packagesPickedUp":0,"pickedUpPhones":null,"pickedUpBarcodes":null}}']);
    for (const dates of [['2026-11-01'], ['2026-11-02', '2026-11-01'], ['2026-11-01', '2026-11-01'],
        Array.from({ length: 32 }, (_, i) => new Date(Date.UTC(2026, 9, i + 1)).toISOString().slice(0, 10))]) {
        await compare('pickupResetBatchPreimage', () => ['tenant', 'scope', 'actor', 'batch', dates]);
        await compare('pickupResetBatchHash', () => ['tenant', 'scope', 'actor', 'batch', dates]);
    }
    const casText = JSON.stringify(operation());
    for (const proof of ['operation', 'native-day', 'none', undefined, null]) {
        await compare('pickupResetAppliedReceipt', () => ['tenant', 'actor', context(), 'b'.repeat(64), casText, proof]);
        await compare('pickupResetAttemptPreimage', () => ['tenant', 'actor', context(), casText]);
        await compare('pickupResetAttemptId', () => ['tenant', 'actor', context(), casText]);
        const attempt = before.pickupResetAttemptId;
        if (typeof attempt !== 'function') throw new Error('Missing original attempt ID constructor');
        const boundId = await Reflect.apply(attempt, undefined, ['tenant', 'actor', context(), casText]);
        await compare('pickupResetBoundReceipt', () => ['tenant', 'actor', context(), boundId, casText, proof]);
    }
    expect(measured).toBeGreaterThan(2500);
    expect(differences).toEqual([]);
});

it('Reset proof ៖ getter/order/prototype inputs រក្សា reference និងការអានដូចដើម', async () => {
    const shapes = [
        () => Object.assign(Object.create(null), context()),
        () => Object.freeze(context()),
        () => Object.assign([], context()),
        () => Object.assign(() => 1, context()),
        () => Object.assign(Object.create({ pickupRevision: 2, pickupResetEpoch: 1 }), { pickupResetApplied: receipt() }),
        () => Object.assign([], { pickupRevision: 2, pickupResetEpoch: 1, pickupResetApplied: receipt() })
    ];
    for (const shape of shapes) for (const name of ['pickupResetContextOf', 'pickupResetReceiptOf', 'assertPickupResetApplied']) {
        expect(await outcome(after, name, [shape()])).toEqual(await outcome(before, name, [shape()]));
    }
    for (const name of ['pickupResetContextOf', 'pickupResetReceiptOf']) {
        const traceBefore: string[] = [], traceAfter: string[] = [];
        const tracked = (trace: string[]) => {
            const source = name === 'pickupResetContextOf' ? context() : receipt();
            return Object.defineProperties({}, Object.fromEntries(Object.entries(source).map(([key, value]) =>
                [key, { enumerable: true, get: () => { trace.push(key); return value; } }])));
        };
        expect(await outcome(after, name, [tracked(traceAfter)])).toEqual(await outcome(before, name, [tracked(traceBefore)]));
        expect(traceAfter).toEqual(traceBefore);
    }
});
