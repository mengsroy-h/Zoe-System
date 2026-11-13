import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const file = path.resolve(import.meta.dirname, '../../emu/registry-purge-atomic-sdk-test.js');
const text = readFileSync(file, 'utf8');
const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
const names = ['bounded', 'until', 'rtdbShape', 'physicalWriteEvidence', 'ordinaryAdmissionImage', 'ordinaryAdmissionTransport', 'runOrdinaryCountAdmission', 'NativeProvider'];
const declarations = names.map(name => {
    const node = ast.statements.find(n => (ts.isFunctionDeclaration(n) || ts.isClassDeclaration(n)) && n.name?.text === name);
    if (!node) throw new Error('Missing actual checker declaration: ' + name);
    return node.getText(ast);
}).join('\n');

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

function fixture(mode = 'delayed-read') {
    const context = vm.createContext({ URL, setTimeout, clearTimeout, Date, equal: isDeepStrictEqual,
        digest: (value: string) => createHash('sha256').update(value).digest('hex'),
        process: { hrtime: { bigint: () => BigInt(Date.now()) * 1000000n }, env: {}, pid: 1 },
        console, path, __filename: file, os: { tmpdir: () => '/synthetic' },
        fs: { readFileSync: () => 'synthetic checker', writeFileSync: () => {} }, randomBytes: () => ({ toString: () => 'synthetic' }) });
    vm.runInContext(`
        const WAIT_MS = 15000, T = 'zoew_recently_deleted_cod_dod', R = 'zoew_barcode_registry', P = 'zoew_registry_releases';
        const G = 'zoew_trash_consumptions', W = 'zoew_write_receipts', D = 'zoew_daily_revenue_cod_dod', M = 'zoew_monthly_revenue_cod_dod';
        const DAY = '2026-10-01', MONTH = '2026-10';
        const clone = value => JSON.parse(JSON.stringify(value));
        const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
        const updateOf = ops => Object.fromEntries(ops.map(op => [op.p.join('/'), clone(op.v)]));
        const rtdbEqual = (left, right) => equal(rtdbShape(left ?? null), rtdbShape(right ?? null));
        const moneyOf = value => ({ [D]: value[D], [M]: value[M] });
        const ordinarySourceAdmissions = []; let ordinaryAdmissionHeldProvider = null;
        const journalRows = () => [], failureText = error => String(error.message);
        const parseOrigin = value => new URL(value);
        const allowedOrigins = new Set(['http://127.0.0.1:19001']);
        ${declarations}
        function make(mode) {
            const row = { id: 'synthetic-count-mirror', count: 2, barcodes: { '0': { code: 'A' }, '1': { code: 'B' } } };
            const changed = clone(row); changed.barcodes['2'] = { code: 'EXTRA' };
            const physical = { [T]: { [row.id]: clone(row) }, [R]: { A: true, B: true },
                [P]: {}, [G]: {}, [D]: { [DAY]: { codDollar: 37, dodDollar: 5, totalCount: 11 } },
                [M]: { [MONTH]: { codDollar: 37, dodDollar: 5, totalCount: 11 } } };
            const provider = Object.create(NativeProvider.prototype);
            Object.assign(provider, { kind: 'native', uid: 'synthetic-owner', scope: 'synthetic-scope', row,
                stats: { backendAttempts: 0 }, tasks: new Set(), taskLabels: new Map(), startedTasks: 0, settledTasks: 0,
                closing: false, clientEpoch: 1, trace: { events: [], droppedEvents: 0, observerErrors: 0 },
                namespace: { base: { origin: 'http://127.0.0.1:19001' }, uncertain: false } });
            provider.namespace.active = provider;
            const recovery = { recovering: false, deferred: false };
            const api = { firebaseState: {}, liveShopScope: () => provider.scope, nativeWriteRecoveryState: () => recovery };
            provider.runtime = { api };
            let readDone;
            const read = new Promise(resolve => { readDone = resolve; });
            const client = { db: {}, auth: { currentUser: { uid: provider.uid } }, sdk: {
                ref: db => db,
                async update(_ref, patch) {
                    const operations = Object.entries(patch).map(([key, value]) => ({ k: 'set', p: key.split('/'), v: clone(value) }));
                    const opId = 'native_' + 'a'.repeat(32), hash = digest(JSON.stringify(operations));
                    const receipt = { uid: provider.uid, hash, at: { '.sv': 'timestamp' } };
                    const updates = { ...clone(patch), [W + '/' + opId]: receipt };
                    provider.ordinaryAdmissionObserver.native.push({ updates, journal: { row: { opId, hash, ops: operations } } });
                    for (const operation of operations) physical[operation.p[0]][operation.p[1]] = clone(operation.v);
                    physical[W] = { [opId]: { ...receipt, at: 123456 } };
                    provider.trace.events.push({ phase: 'merge-ack-observed', patchHash: digest(JSON.stringify(updates)), status: 'ok' });
                    if (mode === 'missing-ack') provider.trace.events.length = 0;
                    if (mode === 'wrong-receipt') physical[W][opId].hash = 'b'.repeat(64);
                    if (mode === 'shared-budget') { recovery.recovering = true; setTimeout(() => { recovery.recovering = false; }, 14990); }
                    if (mode !== 'no-read') {
                        provider.track('sdk-get', () => read);
                        if (mode !== 'never-settles') setTimeout(() => {
                            if (mode === 'owner-change') client.auth.currentUser = { uid: 'other' };
                            if (mode === 'chained-read') provider.track('sdk-get-later', () => new Promise(resolve => setTimeout(resolve, 10)));
                            if (mode === 'db-change') api.firebaseState.db = {};
                            readDone();
                        }, mode === 'shared-budget' ? 15010 : 10);
                    }
                }
            } };
            provider.client = client;
            Object.assign(api.firebaseState, { db: client.db, auth: client.auth, fb: client.sdk });
            const snapshotPending = [];
            provider.snapshot = async () => {
                snapshotPending.push(provider.tasks.size);
                const out = clone(physical), logical = clone(out); delete logical[W];
                return { physical: out, logical };
            };
            return { provider, snapshotPending, run: () => runOrdinaryCountAdmission(provider, changed).catch(error => ({ error, status: 'HOLD' })) };
        }
        globalThis.make = make;
    `, context);
    return (context as any).make(mode);
}

it('ការអាន SDK ដែលនៅរង់ចាំត្រូវបញ្ចប់មុនទទួល after snapshot និង ACK admission', async () => {
    const f = fixture(), result = f.run();
    await vi.advanceTimersByTimeAsync(0);
    expect(f.provider.tasks.size).toBe(1);
    await vi.advanceTimersByTimeAsync(10);
    const record = await result;
    expect(record.status).toBe('ACK_EXACT_MALFORMED_STATE');
    expect(record.transport.valid).toBe(true);
    expect(record.rawPurgeAttempts).toBe(0);
    expect(f.snapshotPending).toEqual([0, 0]);
});

it('គ្មានការអានរង់ចាំ៖ ភស្តុតាងពេញត្រូវបានទទួល', async () => {
    const result = await fixture('no-read').run();
    expect(result.status).toBe('ACK_EXACT_MALFORMED_STATE');
});

it.each(['missing-ack', 'wrong-receipt', 'owner-change', 'never-settles'])('រក្សា HOLD៖ %s', async mode => {
    const f = fixture(mode), result = f.run();
    await vi.advanceTimersByTimeAsync(15001);
    expect((await result).status).toBe('HOLD');
    expect(f.provider.ordinaryAdmissionEvidence.status).toBe('HOLD');
    expect(f.provider.stats.backendAttempts).toBe(0);
    expect(f.provider.namespace.uncertain).toBe(true);
    if (mode === 'never-settles') expect(f.provider.tasks.size).toBe(1);
});

it('settle និង quiesce ចែករំលែកដែន១៥វិនាទីដដែល ហើយមិនបន្តក្រោយ timeout', async () => {
    const f = fixture('shared-budget'), result = f.run();
    await vi.advanceTimersByTimeAsync(14999);
    expect(f.provider.ordinaryAdmissionEvidence.status).toBe('PENDING');
    await vi.advanceTimersByTimeAsync(1);
    expect(f.provider.ordinaryAdmissionEvidence.status).toBe('HOLD');
    expect((await result).status).toBe('HOLD');
    expect(f.provider.tasks.size).toBe(1);
    expect(f.snapshotPending).toEqual([0]);
    await vi.advanceTimersByTimeAsync(100);
    expect(f.provider.ordinaryAdmissionEvidence.status).toBe('HOLD');
    expect(f.snapshotPending).toEqual([0]);
});
it('quiesce រង់ចាំទាំង task ថ្មីដែលចាប់ផ្តើមក្នុងពេលរង់ចាំ', async () => {
    const f = fixture('chained-read'), result = f.run();
    await vi.advanceTimersByTimeAsync(10);
    expect(f.provider.tasks.size).toBe(1);
    expect(f.snapshotPending).toEqual([0]);
    await vi.advanceTimersByTimeAsync(10);
    expect((await result).status).toBe('ACK_EXACT_MALFORMED_STATE');
    expect(f.snapshotPending).toEqual([0, 0]);
});
it('db ប្តូរម្ចាស់ក្នុងពេលរង់ចាំ ត្រូវនៅ HOLD', async () => {
    const f = fixture('db-change'), result = f.run();
    await vi.advanceTimersByTimeAsync(20);
    expect((await result).status).toBe('HOLD');
    expect(f.provider.namespace.uncertain).toBe(true);
});
