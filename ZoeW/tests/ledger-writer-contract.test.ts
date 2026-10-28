// Checker audit (deep audit 8 · C1 · C2): two money rules had no behavioural guard — a mutation of each survived every test.
// C1 ⛔ every day/month record writer carries the cleanup receipts `ded/<trashId>` (`ledgerCarryDed()`): a scan or price edit
// that rebuilt the record without them wiped the proof a Restore needs, so the parcel could never be restored with its money.
// C2 the live monthly writer kept its own copy of the 3-month retention beside `ledgerLatestMonths()`; one formula now.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dataState, firebaseState, uiState } from '../src/core/state';
import { commitDailyRevenueDelta, commitMonthlyRevenueDelta } from '../src/domain/ledger';

const store: Record<string, any> = {};
const clone = (v: any) => (v === undefined ? null : JSON.parse(JSON.stringify(v)));
const getAt = (path: string) => {
    let cur: any = store;
    for (const p of path.split('/').filter(Boolean)) { if (!cur || typeof cur !== 'object' || !(p in cur)) return null; cur = cur[p]; }
    return clone(cur);
};
const setAt = (path: string, value: any) => {
    const parts = path.split('/').filter(Boolean);
    let cur: any = store;
    for (let i = 0; i < parts.length - 1; i++) { if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {}; cur = cur[parts[i]]; }
    if (value === null) delete cur[parts[parts.length - 1]]; else cur[parts[parts.length - 1]] = clone(value);
};
const DAY = '2026-10-20';
const RECEIPT = { at: 1760000000000, cod: 5, dod: 1, count: 1 };

beforeEach(() => {
    for (const k of Object.keys(store)) delete store[k];
    vi.stubGlobal('confirm', () => true);
    (window as any).ZoeErrors = { capture: () => {} };
    uiState.toasts = [];
    dataState.dailyRevenueData = {};
    dataState.monthlyRevenueData = {};
    firebaseState.authGeneration++;
    firebaseState.db = { ledger: true } as any;
    firebaseState.fb = {
        ref: (_db: unknown, path: string) => ({ path }),
        runTransaction: async (ref: any, fn: any) => {
            const next = fn(getAt(ref.path));
            if (next === undefined) return { committed: false, snapshot: { val: () => getAt(ref.path) } };
            setAt(ref.path, next);
            return { committed: true, snapshot: { val: () => getAt(ref.path) } };
        }
    } as any;
    firebaseState.dbRefDailyRevenue = { path: 'zoew_daily_revenue_cod_dod' } as any;
    firebaseState.dbRefMonthlyRevenue = { path: 'zoew_monthly_revenue_cod_dod' } as any;
});

afterEach(() => {
    vi.unstubAllGlobals();
    delete (window as any).ZoeErrors;
});

describe('C1 ៖ អ្នកសរសេរកំណត់ត្រាថ្ងៃ/ខែ រក្សាភស្តុតាង ded', () => {
    it('a scan-sized delta on a day holding a receipt keeps the receipt', async () => {
        setAt('zoew_daily_revenue_cod_dod/' + DAY, { codDollar: 20, dodDollar: 2, totalCount: 3, ded: { trash_a: RECEIPT } });
        expect(await commitDailyRevenueDelta(DAY, 10, 0, 1, null, true)).toEqual({ cod: 10, dod: 0, count: 1 });
        const day = getAt('zoew_daily_revenue_cod_dod/' + DAY);
        expect([day.codDollar, day.totalCount, day.ded]).toEqual([30, 4, { trash_a: RECEIPT }]);
    });

    it('the same on the month record', async () => {
        setAt('zoew_monthly_revenue_cod_dod/2026-10', { codDollar: 20, dodDollar: 2, totalCount: 3, ded: { trash_a: RECEIPT } });
        expect(await commitMonthlyRevenueDelta('2026-10', 10, 0, 1, null, true)).toEqual({ cod: 10, dod: 0, count: 1 });
        expect(getAt('zoew_monthly_revenue_cod_dod/2026-10').ded).toEqual({ trash_a: RECEIPT });
    });
});

describe('C2 ៖ អ្នកសរសេរខែរក្សា ៣ ខែចុងក្រោយ', () => {
    it('three months stay · a fourth older one leaves', async () => {
        for (const m of ['2026-07', '2026-08', '2026-09']) setAt('zoew_monthly_revenue_cod_dod/' + m, { codDollar: 1, dodDollar: 0, totalCount: 1 });
        await commitMonthlyRevenueDelta('2026-10', 10, 0, 1, null, true);
        expect(Object.keys(getAt('zoew_monthly_revenue_cod_dod')).filter((k) => /^\d{4}-\d{2}$/.test(k)).sort()).toEqual(['2026-08', '2026-09', '2026-10']);
    });
});
