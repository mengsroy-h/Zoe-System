import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { acceptFixtureSession, configureFixtureBackend } from './helpers/accepted-session';
import { dataState, firebaseState } from '../../../../ZoeW/src/core/state';
import { appLocalStore } from '../../../../ZoeW/src/core/storage';
import { liveShopScope } from '../../../../ZoeW/src/core/shop-scope';
import { verifyZtoRestoreStatus } from '../../../../ZoeW/src/features/zto-restore-status';

const SOURCE = 'zoew_recently_deleted_cod_dod/source';
const D = 'zoew_daily_revenue_cod_dod', M = 'zoew_monthly_revenue_cod_dod';
let nodes: Record<string, any>;
let fetch: ReturnType<typeof vi.fn>;
let writes: ReturnType<typeof vi.fn>[];
const clone = <T,>(value: T): T => structuredClone(value);

beforeEach(() => {
    appLocalStore.clear();
    const options = configureFixtureBackend('terminal-decision-local');
    const app = { options };
    firebaseState.authGeneration++;
    firebaseState.db = { app } as any;
    firebaseState.auth = { app, currentUser: { uid: 'terminal-local-user' } } as any;
    const write = () => vi.fn(async () => { throw new Error('Unexpected fixture write'); });
    writes = [write(), write(), write()];
    firebaseState.fb = {
        ref: (_db: unknown, path: string) => ({ path }),
        get: vi.fn(async (ref: any) => ({ val: () => clone(nodes[ref.path] ?? null) })),
        set: writes[0], update: writes[1], runTransaction: writes[2]
    } as any;
    acceptFixtureSession();
    nodes = {
        'zoew_restore_policy/shop': { v: 1, mode: 'local', scope: liveShopScope(), branch: '', epoch: 1 },
        [SOURCE]: { id: 'source', phone: '012345678', scanDate: '2026-11-14', createdAt: 1700000000000,
            deletedAt: 1700000100000, trashGeneration: 1, trashReason: 'delete', isFromDeletion: true,
            count: 1, cod: 10, dod: 2, price: 12, barcodes: [{ code: 'TERMINAL000001', createdAt: 1700000000000,
                cod: 10, dod: 2, isClosed: false, isDeducted: false }] },
        [D]: { '2026-11-14': { codDollar: 10, dodDollar: 2, totalCount: 1 } },
        [M]: { '2026-11': { codDollar: 10, dodDollar: 2, totalCount: 1 } }
    };
    dataState.deletedItems = [clone(nodes[SOURCE])];
    dataState.dailyRevenueData = clone(nodes[D]);
    dataState.monthlyRevenueData = clone(nodes[M]);
    fetch = vi.fn(async () => { throw new Error('Unexpected fixture network request'); });
    vi.stubGlobal('fetch', fetch);
});
afterEach(() => {
    firebaseState.authGeneration++;
    firebaseState.auth = null as any; firebaseState.db = null as any; firebaseState.fb = null as any;
    dataState.deletedItems = []; dataState.dailyRevenueData = {}; dataState.monthlyRevenueData = {};
    appLocalStore.clear(); vi.unstubAllGlobals();
});

function expectNoEffect(before: Record<string, any>, item: any) {
    expect(fetch).not.toHaveBeenCalled();
    for (const write of writes) expect(write).not.toHaveBeenCalled();
    expect(nodes).toEqual(before);
    expect(dataState.dailyRevenueData).toEqual(before[D]);
    expect(dataState.monthlyRevenueData).toEqual(before[M]);
    expect(item).not.toHaveProperty('restoreClaim');
    expect(item).not.toHaveProperty('restoreAttestationId');
    expect(nodes.zoew_restore_attestations).toBeUndefined();
}

it.each(['signed', 'returned'] as const)('trusted %s restore-deny metadata cannot use a local-policy shortcut without ZTO provenance', async decision => {
    nodes[SOURCE].ztoTerminalDecision = decision;
    const item = clone(nodes[SOURCE]), before = clone(nodes);
    expect(item).not.toHaveProperty('trashMode');
    await expect(verifyZtoRestoreStatus(item)).rejects.toThrow('RESTORE_ZTO_FINAL');
    expectNoEffect(before, item);
});

it.each([
    { label: 'wrong case', value: 'SIGNED' }, { label: 'unknown string', value: 'unknown' },
    { label: 'empty string', value: '' }, { label: 'null', value: null }, { label: 'undefined', value: undefined },
    { label: 'zero', value: 0 }, { label: 'number', value: 1 }, { label: 'false', value: false }, { label: 'true', value: true },
    { label: 'object', value: { signed: true } }, { label: 'array', value: ['returned'] }
])('present malformed $label terminal metadata holds instead of assuming pure local restore', async ({ value }) => {
    nodes[SOURCE].ztoTerminalDecision = value;
    const item = clone(nodes[SOURCE]), before = clone(nodes);
    expect(Object.prototype.hasOwnProperty.call(item, 'ztoTerminalDecision')).toBe(true);
    await expect(verifyZtoRestoreStatus(item)).rejects.toThrow('RESTORE_ZTO_UNCONFIRMED');
    expectNoEffect(before, item);
});

it('a legacy source with no terminal-decision property retains the protected pure local policy path', async () => {
    const item = clone(nodes[SOURCE]), before = clone(nodes);
    expect(item).not.toHaveProperty('ztoTerminalDecision');
    await expect(verifyZtoRestoreStatus(item)).resolves.toEqual({ kind: 'local', policy: nodes['zoew_restore_policy/shop'] });
    expect(firebaseState.fb.get).toHaveBeenCalledTimes(1);
    expectNoEffect(before, item);
});
