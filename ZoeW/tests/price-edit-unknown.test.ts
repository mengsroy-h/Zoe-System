// M3 (deep audit 8): a price edit issues its ledger delta first, then the history transaction. When that transaction lands
// but answers `txOutcome: 'unknown'` (another device wrote the row before the REST read), the edit path treated it as a
// failure: it took the delta back out of both ledgers and the local price, while the server barcode keeps the new price ➜
// the ledger stays short by the difference for good. An unknown outcome is decided by the server row
// (`ledgerCompanionState()`): new price ➜ the edit landed (settled as a success) · prior price ➜ reverted · anything else
// (gone · edited elsewhere · unreadable) ➜ nothing reverted, Sentry money.
import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { refTo } from '../src/app/refs';
import { dataState, firebaseState, uiState } from '../src/core/state';
import { getFormattedDate } from '../src/core/timezone';
import { saveEditedBarcodePrice } from '../src/features/barcode-ops';
import { ledgerCompanionState } from '../src/domain/ledger';

const H = 'zoew_scan_history_cod_dod', D = 'zoew_daily_revenue_cod_dod', M = 'zoew_monthly_revenue_cod_dod';
const HOST = 'https://m3-unknown.firebaseio.com';
const NOW = Date.UTC(2026, 9, 24, 2);
const lab = { store: {} as any, fault: '' as '' | 'landed' | 'lost' | 'gone', readFails: false, intents: [] as any[] };
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
const settle = async () => { for (let i = 0; i < 30; i++) await new Promise((r) => setTimeout(r, 0)); };
const money = () => [getAt(D + '/' + DAY()), getAt(M + '/' + DAY().slice(0, 7))].map((r) => [r.codDollar, r.totalCount]);
function input(id: 'editBcCodInput' | 'editBcDodInput', value: string) {
    const el = document.createElement('input');
    el.value = value;
    refTo(id)(el);
}

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(NOW);
    vi.stubGlobal('crypto', webcrypto);
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    lab.fault = ''; lab.readFails = false; lab.intents = [];
    lab.store = {
        [H]: { itemI: { id: 'itemI', phone: '012000111', scanDate: DAY(), time: '08:00:00 (' + DAY() + ')', createdAt: NOW - 3600000, count: 1, cod: 10, dod: 0, price: 10,
            isClosed: false, isCalled: false, barcode: 'A100000001', barcodes: [{ code: 'A100000001', cod: 10, dod: 0, isClosed: false, isDeducted: false, isFromDeletion: false }] } },
        [D]: { [DAY()]: { codDollar: 10, dodDollar: 0, totalCount: 1 } },
        [M]: { [DAY().slice(0, 7)]: { codDollar: 10, dodDollar: 0, totalCount: 1 } }
    };
    dataState.scanHistory = Object.values(clone(lab.store[H]));
    dataState.dailyRevenueData = clone(lab.store[D]); dataState.monthlyRevenueData = clone(lab.store[M]);
    firebaseState.authGeneration++; firebaseState.db = { name: 'm3' } as any;
    firebaseState.auth = { currentUser: { uid: 'u', getIdToken: async () => 'tok' } } as any;
    firebaseState.firebaseConfig = { databaseURL: HOST } as any;
    firebaseState.dbRefHistory = ref(H) as any; firebaseState.dbRefDailyRevenue = ref(D) as any; firebaseState.dbRefMonthlyRevenue = ref(M) as any;
    firebaseState.fb = {
        ref: (_db: any, p = '') => ref(p),
        increment: (n: number) => ({ __inc: n }),
        get: async (r: any) => snap(r, getAt(r.path)),
        update: async (r: any, ups: any) => { for (const [k, v] of Object.entries(ups)) setAt([r.path, k].filter(Boolean).join('/'), v); },
        set: async (r: any, v: any) => setAt(r.path, v),
        runTransaction: async (r: any, fn: any) => {
            if (fn && fn.connectionIntent) lab.intents.push(clone(fn.connectionIntent));
            const prior = getAt(r.path); const next = fn(clone(prior));
            if (next === undefined) return { committed: false, snapshot: snap(r, prior) };
            if (r.path === H + '/itemI' && lab.fault === 'lost') throw unknown();
            setAt(r.path, next);
            if (r.path === H + '/itemI' && lab.fault) {
                if (lab.fault === 'gone') setAt(r.path, null);
                else { const row = getAt(r.path); row.isCalled = true; setAt(r.path, row); }
                throw unknown();
            }
            return { committed: true, snapshot: snap(r, getAt(r.path)) };
        },
        onValue: () => () => {}, off: () => {}
    } as any;
    vi.stubGlobal('fetch', vi.fn(async (inputUrl: any) => {
        if (lab.readFails) throw new TypeError('Failed to fetch');
        const path = decodeURIComponent(new URL(String(inputUrl)).pathname).replace(/^\//, '').replace(/\.json$/, '');
        return new Response(JSON.stringify(getAt(path)), { status: 200, headers: { 'content-type': 'application/json' } });
    }));
    (window as any).ZoeErrors = { capture: vi.fn() };
    uiState.activeParentItemId = 'itemI'; uiState.activeEditingBarcode = 'A100000001';
    input('editBcCodInput', '20'); input('editBcDodInput', '0');
});
afterEach(() => {
    firebaseState.authGeneration++;
    vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); delete (window as any).ZoeErrors;
});

const moneyAlarm = () => ((window as any).ZoeErrors.capture as any).mock.calls.some(([, extra]: any) => extra && extra.zone === 'money');

describe('M3 ៖ a price edit that landed but answered «unknown» keeps its revenue delta', () => {
    it('the edit lands, another device marks the row, the reply is lost ➜ ledger 20 like the server price', async () => {
        lab.fault = 'landed';
        saveEditedBarcodePrice();
        await settle();
        expect(getAt(H + '/itemI').barcodes[0].cod).toBe(20);
        expect(money()).toEqual([[20, 1], [20, 1]]);
        expect(dataState.scanHistory.find((i: any) => i.id === 'itemI').barcodes[0].cod).toBe(20);
    });

    it('control: the edit never landed (server still holds the prior price) ➜ reverted to 10', async () => {
        lab.fault = 'lost';
        saveEditedBarcodePrice();
        await settle();
        expect(getAt(H + '/itemI').barcodes[0].cod).toBe(10);
        expect(money()).toEqual([[10, 1], [10, 1]]);
    });

    it('the row is gone after the lost reply ➜ undecidable: nothing reverted, a money alarm', async () => {
        lab.fault = 'gone';
        saveEditedBarcodePrice();
        await settle();
        expect(money()).toEqual([[20, 1], [20, 1]]);
        expect(moneyAlarm()).toBe(true);
    });

    it('the row cannot be read ➜ nothing reverted, a money alarm', async () => {
        lab.fault = 'landed'; lab.readFails = true;
        saveEditedBarcodePrice();
        await settle();
        expect(money()).toEqual([[20, 1], [20, 1]]);
        expect(moneyAlarm()).toBe(true);
    });
});

describe('C6 · C5 ៖ ការកែតម្លៃពិតផ្ញើ companion ជាមួយតម្លៃថ្មី និងតម្លៃមុន · DOD សម្រេចដូច COD', () => {
    it('DOD-only edit (0 ➜ 5) ➜ every ledger intent names the new and the prior price · the prior barcode reads «prior»', async () => {
        input('editBcCodInput', '10'); input('editBcDodInput', '5');
        saveEditedBarcodePrice();
        await settle();
        const companions = lab.intents.map((i: any) => i.companion).filter(Boolean);
        expect(companions.length).toBe(2);
        for (const c of companions) expect(c).toEqual({ path: H + '/itemI', code: 'A100000001', wantCod: 10, wantDod: 5, priorCod: 10, priorDod: 0 });
        expect(['holds', 'prior'].map((_, i) => ledgerCompanionState({ barcodes: [{ code: 'A100000001', cod: 10, dod: i ? 0 : 5 }] }, companions[0])))
            .toEqual(['holds', 'prior']);
    });
});
