import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { refTo } from '../src/app/refs';
import { dataState, firebaseState, uiState } from '../src/core/state';
import { getFormattedDate } from '../src/core/timezone';
import { saveEditedBarcodePrice } from '../src/features/barcode-ops';
import { addOrUpdateEntry } from '../src/features/scan-action';

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
    localStorage.clear(); localStorage.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: HOST }));
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(NOW);
    vi.stubGlobal('crypto', webcrypto);
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    lab.fault = ''; lab.readFails = false; lab.intents = [];
    lab.store = {
        [H]: { itemI: { id: 'itemI', phone: '012000111', scanDate: DAY(), time: '08:00:00 (' + DAY() + ')', createdAt: NOW - 3600000, count: 1, cod: 10, dod: 0, price: 10,
            isClosed: false, isCalled: false, barcode: 'A100000001', barcodes: [{ code: 'A100000001', cod: 10, dod: 0, createdAt: NOW - 60000, isClosed: false, isDeducted: false, isFromDeletion: false }] } },
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

it('price edit ចាប់ផ្ដើមមុន ➜ scan លើ row ដដែលមិនអាចឆ្លងកាត់ money/history ដែលមិនទាន់ផ្ទៀង', async () => {
    const sdk = firebaseState.fb;
    const original = sdk.runTransaction;
    let unlock!: () => void;
    let entered!: () => void;
    const gate = new Promise<void>(resolve => { unlock = resolve; });
    const ready = new Promise<void>(resolve => { entered = resolve; });
    let firstHistory = true;
    sdk.runTransaction = async (r: any, update: any) => {
        if (r.path === D + '/' + DAY() && update.connectionIntent?.companion?.code === 'A100000001') {
            entered(); await gate;
        }
        if (r.path === H + '/itemI' && firstHistory && update(getAt(r.path))?.pricePending?.phase === 'history') { firstHistory = false; await gate; }
        return original(r, update);
    };
    saveEditedBarcodePrice();
    await ready;
    const before = money();
    setAt('zoew_barcode_registry/SCANSECOND0001', true);
    const scan = addOrUpdateEntry('SCANSECOND0001', '012000111', 5, 0, 'N/A', NOW).catch(error => error);
    try {
        await settle();
        expect(getAt(H + '/itemI').barcodes.some((barcode: any) => barcode.code === 'SCANSECOND0001'),
            'scan មិនអាចដាក់បញ្ជីថ្មីលើ row ដែល price operation កំពុងជាប់កណ្ដាល').toBe(false);
        expect(money(), 'scan មិនអាចបន្ថែម money/count មុន competing price operation ចប់').toEqual(before);
    } finally {
        unlock(); await scan; await settle();
    }
    const row = getAt(H + '/itemI');
    expect(row.barcodes.find((barcode: any) => barcode.code === 'A100000001').cod).toBe(20);
    const amount = row.barcodes.reduce((total: number, barcode: any) => total + barcode.cod, 0);
    expect(money(), 'ក្រោយដោះ gate ប្រាក់ត្រូវស្មើកញ្ចប់ដែលបានរក្សាទុក ម្តងមួយ').toEqual([[amount, row.barcodes.length], [amount, row.barcodes.length]]);
});
