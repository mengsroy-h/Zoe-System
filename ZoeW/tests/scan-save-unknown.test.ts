// M1 (deep audit 8): a scan save whose history write landed but whose reply was lost resolves `txOutcome: 'unknown'`
// (Firebase: another device wrote the same row before the REST read; Supabase: a lost-ACK replay that cannot be authorised).
// The save path treated every rejection as "not saved": it took the scan's +COD/DOD/+1 back out of both ledgers while the
// parcel stays on the server ➜ revenue understated, and the caller released the barcode's duplicate lock. An unknown outcome
// is decided by the server row (`ledgerCompanionState()`): the barcode is there ➜ saved · absent ➜ reverted · unreadable ➜
// nothing reverted, the save answers 'unknown' (the caller keeps the duplicate lock), Sentry money.
import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dataState, firebaseState } from '../src/core/state';
import { getFormattedDate } from '../src/core/timezone';
import { addOrUpdateEntry } from '../src/features/scan-action';

const H = 'zoew_scan_history_cod_dod', D = 'zoew_daily_revenue_cod_dod', M = 'zoew_monthly_revenue_cod_dod';
const HOST = 'https://m1-unknown.firebaseio.com';
const NOW = Date.UTC(2026, 9, 24, 2);
const lab = { store: {} as any, fault: '' as '' | 'merge' | 'new' | 'mergeLost', readFails: false };
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
const unknown = () => Object.assign(new Error('disconnect'), { txOutcome: 'unknown' });
const DAY = () => getFormattedDate(new Date(NOW));
const settle = async () => { for (let i = 0; i < 20; i++) await new Promise((r) => setTimeout(r, 0)); };
const money = () => [getAt(D + '/' + DAY()), getAt(M + '/' + DAY().slice(0, 7))].map((r) => [r.codDollar, r.totalCount]);

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(NOW);
    vi.stubGlobal('crypto', webcrypto);
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    lab.fault = ''; lab.readFails = false;
    lab.store = {
        [H]: { itemI: { id: 'itemI', phone: '012000111', scanDate: DAY(), time: '08:00:00 (' + DAY() + ')', createdAt: NOW - 3600000, count: 1, cod: 10, dod: 0, price: 10,
            isClosed: false, isCalled: false, barcode: 'A100000001', barcodes: [{ code: 'A100000001', cod: 10, dod: 0, isClosed: false, isDeducted: false, isFromDeletion: false }] } },
        [D]: { [DAY()]: { codDollar: 10, dodDollar: 0, totalCount: 1 } },
        [M]: { [DAY().slice(0, 7)]: { codDollar: 10, dodDollar: 0, totalCount: 1 } }
    };
    dataState.scanHistory = Object.values(clone(lab.store[H]));
    dataState.dailyRevenueData = clone(lab.store[D]); dataState.monthlyRevenueData = clone(lab.store[M]);
    firebaseState.authGeneration++; firebaseState.db = { name: 'm1' } as any;
    firebaseState.auth = { currentUser: { uid: 'u', getIdToken: async () => 'tok' } } as any;
    firebaseState.firebaseConfig = { databaseURL: HOST } as any;
    firebaseState.dbRefHistory = ref(H) as any; firebaseState.dbRefDailyRevenue = ref(D) as any; firebaseState.dbRefMonthlyRevenue = ref(M) as any;
    firebaseState.fb = {
        ref: (_db: any, p = '') => ref(p),
        increment: (n: number) => ({ __inc: n }),
        get: async (r: any) => snap(r, getAt(r.path)),
        update: async (r: any, ups: any) => {
            for (const [k, v] of Object.entries(ups)) setAt([r.path, k].filter(Boolean).join('/'), v);
            if (lab.fault === 'new' && r.path === H) throw unknown();
        },
        set: async (r: any, v: any) => setAt(r.path, v),
        runTransaction: async (r: any, fn: any) => {
            const prior = getAt(r.path); const next = fn(clone(prior));
            if (next === undefined) return { committed: false, snapshot: snap(r, prior) };
            if (lab.fault === 'mergeLost' && r.path === H + '/itemI') throw unknown();
            setAt(r.path, next);
            if (lab.fault === 'merge' && r.path === H + '/itemI') {
                const row = getAt(r.path); row.isCalled = true; setAt(r.path, row);
                throw unknown();
            }
            return { committed: true, snapshot: snap(r, getAt(r.path)) };
        },
        onValue: () => () => {}, off: () => {}
    } as any;
    vi.stubGlobal('fetch', vi.fn(async (input: any) => {
        if (lab.readFails) throw new TypeError('Failed to fetch');
        const path = decodeURIComponent(new URL(String(input)).pathname).replace(/^\//, '').replace(/\.json$/, '');
        return new Response(JSON.stringify(getAt(path)), { status: 200, headers: { 'content-type': 'application/json' } });
    }));
    (window as any).ZoeErrors = { capture: vi.fn() };
});
afterEach(() => {
    firebaseState.authGeneration++;
    vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); delete (window as any).ZoeErrors;
});

describe('M1 ៖ a scan save that landed but answered «unknown» keeps its revenue', () => {
    it('merge into an existing row lands, another device marks the row, the reply is lost ➜ saved, ledger +5', async () => {
        lab.fault = 'merge';
        const out = await addOrUpdateEntry('X200000002', '012000111', 5, 0, 'N/A').then((v) => v, (e) => e);
        expect(out).not.toBeInstanceOf(Error);
        expect(getAt(H + '/itemI').barcodes.map((b: any) => b.code)).toContain('X200000002');
        await settle();
        expect(money()).toEqual([[15, 2], [15, 2]]);
    });

    it('a new row lands but the write answers «unknown» ➜ saved, ledger +6', async () => {
        lab.fault = 'new';
        const out = await addOrUpdateEntry('Z300000003', '012999888', 6, 0, 'N/A').then((v) => v, (e) => e);
        expect(out).not.toBeInstanceOf(Error);
        await settle();
        expect(money()).toEqual([[16, 2], [16, 2]]);
    });

    it('control: the merge never landed (barcode absent on the server) ➜ rejected and the ledger reverted', async () => {
        lab.fault = 'mergeLost';
        const out = await addOrUpdateEntry('X200000002', '012000111', 5, 0, 'N/A').then((v) => v, (e) => e);
        expect(out).toBeInstanceOf(Error);
        await settle();
        expect(money()).toEqual([[10, 1], [10, 1]]);
    });

    it('the row cannot be read ➜ nothing reverted (unconfirmed) and a money alarm', async () => {
        lab.fault = 'merge'; lab.readFails = true;
        const out = await addOrUpdateEntry('X200000002', '012000111', 5, 0, 'N/A').then((v) => v, (e) => e);
        expect(out).toBe('unknown');
        await settle();
        expect(money()).toEqual([[15, 2], [15, 2]]);
        expect(((window as any).ZoeErrors.capture as any).mock.calls.some(([, extra]: any) => extra && extra.zone === 'money')).toBe(true);
    });
});
