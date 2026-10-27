// A355 (owner decision: per-barcode deduction keys). Two trash copies of one barcode lifecycle can each believe they own
// the deduction (a lost reply resolved by equality, another device's trash write that lands after every ownership read).
// Before deducting, a cleanup claims its barcodes in the day ledger (`dedc/<registry key>~<restoredAt>~<closedAt>` = trash
// id, create-if-absent) and deducts only the barcodes it owns ➜ the money of one lifecycle is deducted once whatever the
// order. A restore or a new close stamp starts a new lifecycle, an undo releases the claims, a purge removes them, every
// day-record writer carries them, and rules that refuse the claim (not yet published) leave the deduction as before.
import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dataState, firebaseState } from '../src/core/state';
import { cleanupLedgerClaimKey, cleanupLedgerClaimsOf, deductCleanupLedgerKeyed, releaseCleanupLedgerKeys } from '../src/domain/cleanup';
import { addRevenueToDailyAndMonthlyRecord, claimLedgerBarcodes, commitLedgerEventStep } from '../src/domain/ledger';
import { runTransactionResolved } from '../src/services/tx-outcome';

const D = 'zoew_daily_revenue_cod_dod', M = 'zoew_monthly_revenue_cod_dod';
const HOST = 'https://audit-claims.firebaseio.com';
const DAY = '2026-10-18', MONTH = '2026-10';
const STAMP = Date.UTC(2026, 9, 18, 2);
const lab = { store: {} as any, refuseClaims: false, writes: [] as string[], cutClaim: null as null | (() => void) };
const clone = <V,>(v: V): V => (v === undefined ? v : JSON.parse(JSON.stringify(v)));
const parts = (p: string) => p.split('/').filter(Boolean);
const getAt = (p: string) => clone(parts(p).reduce((n: any, k) => n?.[k], lab.store) ?? null);
function setAt(p: string, v: any) {
    const segs = parts(p); const leaf = segs.pop()!; let node = lab.store;
    for (const s of segs) node = node[s] ||= {};
    if (v === null || v === undefined) delete node[leaf]; else node[leaf] = clone(v);
}
const ref = (p = '') => ({ path: p, key: parts(p).at(-1) || null, toString: () => HOST + '/' + p });
const snap = (r: any, v: any) => ({ ref: r, key: r.key, val: () => clone(v), exists: () => v !== null && v !== undefined });
function rawSdk() {
    return {
        ref: (_db: any, p = '') => ref(p), increment: (n: number) => ({ __inc: n }),
        get: async (r: any) => snap(r, getAt(r.path)),
        set: async (r: any, v: any) => { lab.writes.push(r.path); setAt(r.path, v); },
        update: async (r: any, ups: any) => {
            for (const [k, v] of Object.entries(ups)) {
                const p = [r.path, k].filter(Boolean).join('/');
                lab.writes.push(p);
                setAt(p, (v as any)?.__inc !== undefined ? (Number(getAt(p)) || 0) + (v as any).__inc : v);
            }
        },
        runTransaction: async (r: any, change: (v: any) => any) => {
            const prior = getAt(r.path); const next = change(clone(prior));
            if (next === undefined) return { committed: false, snapshot: snap(r, prior) };
            if (lab.refuseClaims && r.path.endsWith('/dedc')) throw Object.assign(new Error('PERMISSION_DENIED: Permission denied'), { code: 'PERMISSION_DENIED' });
            if (lab.cutClaim && r.path.endsWith('/dedc')) {
                const other = lab.cutClaim; lab.cutClaim = null; other();
                throw new Error('disconnect');
            }
            lab.writes.push(r.path);
            setAt(r.path, next); return { committed: true, snapshot: snap(r, getAt(r.path)) };
        },
        onValue: () => () => {}, off: () => {}
    };
}
function sdk() {
    const raw = rawSdk();
    return { ...raw, runTransaction: (r: any, up: any, opts?: any) => runTransactionResolved(raw, r, up, opts) };
}
const barcode = (code: string, cod: number, dod = 0, extra: Record<string, unknown> = {}) => ({ code, cod, dod, isClosed: false, isDeducted: false, isFromDeletion: false, ...extra });
const trash = (suffix: string, barcodes: any[], extra: Record<string, unknown> = {}) => ({ id: 'id_' + STAMP + '_' + suffix, scanDate: DAY, deletedAt: STAMP + 3600000,
    trashReason: 'returned', isFromDeletion: false, barcodes, ...extra });
const rev = (barcodes: any[]) => ({ scanDate: DAY, cod: barcodes.reduce((a, b) => a + b.cod, 0), dod: barcodes.reduce((a, b) => a + b.dod, 0), count: barcodes.length });
const money = () => {
    const d = getAt(D + '/' + DAY), m = getAt(M + '/' + MONTH);
    return { day: [d.codDollar, d.dodDollar, d.totalCount], month: [m.codDollar, m.dodDollar, m.totalCount] };
};
const claims = () => getAt(D + '/' + DAY + '/dedc') || {};
const dedOf = (id: string) => getAt(D + '/' + DAY + '/ded/' + id);

beforeEach(() => {
    vi.stubGlobal('crypto', webcrypto);
    lab.store = {
        [D]: { [DAY]: { codDollar: 120, dodDollar: 24, totalCount: 12 } },
        [M]: { [MONTH]: { codDollar: 120, dodDollar: 24, totalCount: 12 } }
    };
    lab.refuseClaims = false; lab.writes = []; lab.cutClaim = null;
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    vi.stubGlobal('fetch', vi.fn(async (input: any) => {
        const value = getAt(decodeURIComponent(new URL(String(input)).pathname).replace(/\.json$/, ''));
        return new Response(JSON.stringify(value), { status: 200, headers: { 'content-type': 'application/json' } });
    }));
    firebaseState.authGeneration++;
    firebaseState.db = { name: 'claims-db' } as any;
    firebaseState.fb = sdk() as any;
    firebaseState.auth = { currentUser: { uid: 'claims-user', getIdToken: async () => 'synthetic-id' } } as any;
    firebaseState.firebaseConfig = { databaseURL: HOST } as any;
    firebaseState.dbRefDailyRevenue = ref(D) as any;
    firebaseState.dbRefMonthlyRevenue = ref(M) as any;
    dataState.dailyRevenueData = clone(lab.store[D]);
    dataState.monthlyRevenueData = clone(lab.store[M]);
    (window as any).ZoeErrors = { capture: vi.fn() };
});
afterEach(() => {
    firebaseState.authGeneration++;
    vi.unstubAllGlobals(); vi.restoreAllMocks(); delete (window as any).ZoeErrors;
});

describe('A355 ៖ one barcode lifecycle is deducted once, whichever trash copy deducts first', () => {
    const X = barcode('ZTC0001', 10, 2), Y = barcode('ZTC0002', 10, 2);

    it('control: one trash copy deducts its barcodes and claims them', async () => {
        const a = trash('aaa', [X]);
        expect(await deductCleanupLedgerKeyed(a, rev([X]), null)).toBe('deducted');
        expect(money()).toEqual({ day: [110, 22, 11], month: [110, 22, 11] });
        expect(claims()).toEqual({ [cleanupLedgerClaimKey(a, X)]: a.id });
    });

    it('a second copy of the same lifecycle (another reason · another trash id) deducts nothing', async () => {
        const a = trash('aaa', [X]);
        const b = trash('bbb', [X], { trashReason: 'remove' });
        expect(await deductCleanupLedgerKeyed(a, rev([X]), null)).toBe('deducted');
        expect(await deductCleanupLedgerKeyed(b, rev([X]), null)).toBe('deducted');
        expect(money()).toEqual({ day: [110, 22, 11], month: [110, 22, 11] });
        expect(dedOf(b.id), 'the second copy records what it really deducted').toMatchObject({ cod: 0, dod: 0, count: 0 });
        expect(claims()).toEqual({ [cleanupLedgerClaimKey(a, X)]: a.id });
    });

    it.each(['first', 'second'] as const)('partial overlap (the wider copy deducts %s) ➜ each barcode once', async (order) => {
        const wide = trash('www', [X, Y]);
        const narrow = trash('nnn', [X], { trashReason: 'remove' });
        const runs = [() => deductCleanupLedgerKeyed(wide, rev([X, Y]), null), () => deductCleanupLedgerKeyed(narrow, rev([X]), null)];
        if (order === 'second') runs.reverse();
        for (const run of runs) expect(await run()).toBe('deducted');
        expect(money()).toEqual({ day: [100, 20, 10], month: [100, 20, 10] });
    });

    it('a rerun after the claim landed (app closed mid-way) keeps the owner and deducts once', async () => {
        const a = trash('aaa', [X]);
        expect(await claimLedgerBarcodes(DAY, a.id, a.deletedAt, [cleanupLedgerClaimKey(a, X)])).toEqual({ state: 'claimed', owned: [cleanupLedgerClaimKey(a, X)] });
        expect(money(), 'claiming moves no money').toEqual({ day: [120, 24, 12], month: [120, 24, 12] });
        expect(await deductCleanupLedgerKeyed(a, rev([X]), null)).toBe('deducted');
        expect(await deductCleanupLedgerKeyed(a, rev([X]), null)).toBe('deducted');
        expect(money()).toEqual({ day: [110, 22, 11], month: [110, 22, 11] });
    });

    it('a restored barcode (new restoredAt) or a new close stamp is a new lifecycle ➜ its later deduction is claimed afresh', async () => {
        const a = trash('aaa', [X]);
        const restored = barcode('ZTC0001', 10, 2, { restoredAt: STAMP + 7200000 });
        const c = trash('ccc', [restored], { deletedAt: STAMP + 9000000 });
        expect(cleanupLedgerClaimKey(c, restored)).not.toBe(cleanupLedgerClaimKey(a, X));
        const closedOnce = barcode('ZTC0001', 10, 2, { isClosed: true, closedAt: STAMP + 100 });
        const closedAgain = barcode('ZTC0001', 10, 2, { isClosed: true, closedAt: STAMP + 200 });
        expect(cleanupLedgerClaimKey(a, closedOnce)).not.toBe(cleanupLedgerClaimKey(a, closedAgain));
        expect(await deductCleanupLedgerKeyed(a, rev([X]), null)).toBe('deducted');
        expect(await deductCleanupLedgerKeyed(c, rev([restored]), null)).toBe('deducted');
        expect(money()).toEqual({ day: [100, 20, 10], month: [100, 20, 10] });
    });

    it('an undo of the deduction (barcodes back in history) releases its claims', async () => {
        const a = trash('aaa', [X]);
        expect(await deductCleanupLedgerKeyed(a, rev([X]), null)).toBe('deducted');
        const undone: any = await commitLedgerEventStep('daily', DAY, a.id, a.deletedAt, 'undo', null, null);
        expect(undone.state).toBe('applied');
        expect(claims()).toEqual({});
        expect(dedOf(a.id)).toMatchObject({ back: true, undo: true });
    });

    it('a purge removes the claims of the purged copies with their ledger keys', async () => {
        const a = trash('aaa', [X, Y]);
        expect(await deductCleanupLedgerKeyed(a, rev([X, Y]), null)).toBe('deducted');
        expect(Object.keys(claims())).toHaveLength(2);
        await releaseCleanupLedgerKeys([{ id: a.id, ledgerKey: { scanDate: DAY }, ledgerClaims: cleanupLedgerClaimsOf(a) }]);
        expect({ claims: claims(), ded: dedOf(a.id) }).toEqual({ claims: {}, ded: null });
    });

    it('a revenue write on the same day (a scan save) carries the claims', async () => {
        const a = trash('aaa', [X]);
        expect(await deductCleanupLedgerKeyed(a, rev([X]), null)).toBe('deducted');
        const written = addRevenueToDailyAndMonthlyRecord(DAY, 5, 0, 1);
        await written.dailyServer; await written.monthlyServer;
        expect(getAt(D + '/' + DAY).codDollar).toBe(115);
        expect(claims()).toEqual({ [cleanupLedgerClaimKey(a, X)]: a.id });
    });

    it('a lost claim reply while another copy\'s claim landed meanwhile ➜ the resolver never hands back our proposal as the owner', async () => {
        const a = trash('aaa', [X]);
        const b = trash('bbb', [X], { trashReason: 'remove' });
        const key = cleanupLedgerClaimKey(a, X);
        lab.cutClaim = () => setAt(D + '/' + DAY + '/dedc/' + key, b.id);
        expect(await deductCleanupLedgerKeyed(a, rev([X]), null)).toBe('deducted');
        expect(claims(), 'the claim stays with the copy that really landed it').toEqual({ [key]: b.id });
        expect(money(), 'the losing copy deducts nothing').toEqual({ day: [120, 24, 12], month: [120, 24, 12] });
        expect(await deductCleanupLedgerKeyed(b, rev([X]), null)).toBe('deducted');
        expect(money()).toEqual({ day: [110, 22, 11], month: [110, 22, 11] });
    });

    it('control: a lost claim reply whose claim landed ➜ applied, deducted once', async () => {
        const a = trash('aaa', [X]);
        const key = cleanupLedgerClaimKey(a, X);
        lab.cutClaim = () => setAt(D + '/' + DAY + '/dedc/' + key, a.id);
        expect(await deductCleanupLedgerKeyed(a, rev([X]), null)).toBe('deducted');
        expect(claims()).toEqual({ [key]: a.id });
        expect(money()).toEqual({ day: [110, 22, 11], month: [110, 22, 11] });
    });

    it('rules that refuse the claim (not yet published) leave the deduction as before', async () => {
        lab.refuseClaims = true;
        const a = trash('aaa', [X]);
        expect(await deductCleanupLedgerKeyed(a, rev([X]), null)).toBe('deducted');
        expect(money()).toEqual({ day: [110, 22, 11], month: [110, 22, 11] });
        expect(claims()).toEqual({});
    });

    it('a day the fresh view holds no record for gets no claim (never a ghost day record holding only claims)', async () => {
        lab.store[D] = {};
        dataState.dailyRevenueData = {};
        const a = trash('aaa', [X]);
        await deductCleanupLedgerKeyed(a, rev([X]), null);
        expect(lab.writes.some((p) => p.endsWith('/dedc')), 'no claim write').toBe(false);
        expect(getAt(D + '/' + DAY + '/dedc')).toBe(null);
    });

    it('a legacy row without barcodes is deducted without a claim', async () => {
        const legacy = { id: 'id_' + STAMP + '_old', scanDate: DAY, deletedAt: STAMP + 3600000, trashReason: 'returned', cod: 10, dod: 2, count: 1 };
        expect(await deductCleanupLedgerKeyed(legacy, { scanDate: DAY, cod: 10, dod: 2, count: 1 }, null)).toBe('deducted');
        expect(money()).toEqual({ day: [110, 22, 11], month: [110, 22, 11] });
        expect(lab.writes.some((p) => p.endsWith('/dedc'))).toBe(false);
    });
});
