// pricePending ៖ ប្រាក់ចូលតែតាម commit atomic (ជួរ admitted ➜ history + increment) · unknown ➜ អាន server ហើយរក្សាសោ · បដិសេធជាក់លាក់ ➜ បោះបង់ដោយមិនប៉ះប្រាក់ (A526)។
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
const lab = { updates: 0, commits: 0, store: {} as any, fault: '' as '' | 'landed' | 'lost' | 'gone' | 'rejected', readFails: false, intents: [] as any[] };
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
    localStorage.clear(); localStorage.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: HOST }));
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(NOW);
    vi.stubGlobal('crypto', webcrypto);
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    lab.fault = ''; lab.readFails = false; lab.intents = []; lab.updates = 0; lab.commits = 0;
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
    firebaseState.dbRefDailyCollected = ref('zoew_daily_collected_cod_dod') as any;
    dataState.dailyCollectedData = {};
    firebaseState.dbRefHistory = ref(H) as any; firebaseState.dbRefDailyRevenue = ref(D) as any; firebaseState.dbRefMonthlyRevenue = ref(M) as any;
    firebaseState.fb = {
        ref: (_db: any, p = '') => ref(p),
        increment: (n: number) => ({ __inc: n }),
        get: async (r: any) => snap(r, getAt(r.path)),
        update: async (r: any, ups: any) => {
            lab.updates = (lab.updates || 0) + 1;
            const commit = Object.keys(ups).some((k) => k.endsWith('/pricePending/phase') && ups[k] === 'history');
            if (commit) lab.commits = (lab.commits || 0) + 1;
            if (commit && lab.fault === 'lost') throw unknown();
            if (commit && lab.fault === 'rejected') throw Object.assign(new Error('permission_denied'), { code: 'PERMISSION_DENIED' });
            for (const [k, v] of Object.entries(ups) as any[]) {
                const p = [r.path, k].filter(Boolean).join('/');
                setAt(p, v && typeof v === 'object' && '__inc' in v ? Math.round(((getAt(p) || 0) + v.__inc) * 100) / 100 : v);
            }
            if (commit && lab.fault === 'gone') { setAt(H + '/itemI', null); throw unknown(); }
            if (commit && lab.fault === 'landed') { const row = getAt(H + '/itemI'); row.isCalled = true; setAt(H + '/itemI', row); throw unknown(); }
        },
        set: async (r: any, v: any) => setAt(r.path, v),
        runTransaction: async (r: any, fn: any) => {
            if (fn && fn.connectionIntent) lab.intents.push(clone(fn.connectionIntent));
            const prior = getAt(r.path); const next = fn(clone(prior));
            if (next === undefined) return { committed: false, snapshot: snap(r, prior) };
            setAt(r.path, next);
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

describe('M3 ៖ a price commit that answered «unknown» is decided by the server row (A526)', () => {
    it('the commit lands, the row changes, the reply is lost ➜ ledger 20 like the server price · the lock waits for resume', async () => {
        lab.fault = 'landed';
        saveEditedBarcodePrice();
        await settle();
        expect(getAt(H + '/itemI').barcodes[0].cod).toBe(20);
        expect(money()).toEqual([[20, 1], [20, 1]]);
        expect(getAt(H + '/itemI').pricePending.phase).toBe('history');
        expect(moneyAlarm()).toBe(true);
    });

    it('commit unknown ហើយ server នៅ admitted ➜ ប្រាក់មិនប្រែ · សោនៅ (resume បញ្ចប់)', async () => {
        lab.fault = 'lost';
        saveEditedBarcodePrice();
        await settle();
        expect(getAt(H + '/itemI').barcodes[0].cod).toBe(10);
        expect(getAt(H + '/itemI').pricePending.phase).toBe('admitted');
        expect(money()).toEqual([[10, 1], [10, 1]]);
        expect(moneyAlarm()).toBe(true);
    });

    it('control ៖ commit បដិសេធជាក់លាក់ ➜ បោះបង់ (compensated) · ប្រាក់ និងតម្លៃនៅ 10 គ្មានការសងប្រាក់', async () => {
        lab.fault = 'rejected';
        saveEditedBarcodePrice();
        await settle();
        expect(getAt(H + '/itemI').barcodes[0].cod).toBe(10);
        expect(getAt(H + '/itemI').pricePending).toMatchObject({ phase: 'settled', outcome: 'compensated' });
        expect(money()).toEqual([[10, 1], [10, 1]]);
        expect(lab.intents.filter((i: any) => i.kind === 'revenue-delta')).toEqual([]);
    });

    it('the row is gone after the lost reply ➜ undecidable: nothing reverted, a money alarm', async () => {
        lab.fault = 'gone';
        saveEditedBarcodePrice();
        await settle();
        expect(money()).toEqual([[20, 1], [20, 1]]);
        expect(moneyAlarm()).toBe(true);
    });

    it('the row cannot be read before the commit ➜ nothing sent, nothing reverted, a money alarm', async () => {
        lab.readFails = true;
        saveEditedBarcodePrice();
        await settle();
        expect(money()).toEqual([[10, 1], [10, 1]]);
        expect(getAt(H + '/itemI').pricePending.phase).toBe('admitted');
        expect(moneyAlarm()).toBe(true);
    });
});

describe('C6 · C5 ៖ ការកែតម្លៃពិតគ្មាន ledger delta ដាច់ដោយឡែក ៖ commit តែមួយមាន COD និង DOD (A526)', () => {
    it('DOD-only edit (0 ➜ 5) ➜ one update carries the row and both day/month DOD increments · no revenue-delta intent · companion still decides prior/holds', async () => {
        input('editBcCodInput', '10'); input('editBcDodInput', '5');
        saveEditedBarcodePrice();
        await settle();
        expect(lab.intents.filter((i: any) => i.kind === 'revenue-delta' || i.companion)).toEqual([]);
        expect([getAt(D + '/' + DAY()).dodDollar, getAt(M + '/' + DAY().slice(0, 7)).dodDollar, lab.commits]).toEqual([5, 5, 1]);
        const companion = { path: H + '/itemI', code: 'A100000001', wantCod: 10, wantDod: 5, priorCod: 10, priorDod: 0 };
        expect(['holds', 'prior'].map((_, i) => ledgerCompanionState({ barcodes: [{ code: 'A100000001', cod: 10, dod: i ? 0 : 5 }] }, companion)))
            .toEqual(['holds', 'prior']);
    });
});
