import { stripHistoryOnlyMarkers } from '../../../../ZoeW/src/domain/barcode';
import { rowOperationActive } from '../../../../ZoeW/src/services/row-operation-lock';
import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { refTo } from '../../../../ZoeW/src/app/refs';
import { dataState, firebaseState, uiState } from '../../../../ZoeW/src/core/state';
import { getFormattedDate } from '../../../../ZoeW/src/core/timezone';
import { saveEditedBarcodePrice } from '../../../../ZoeW/src/features/barcode-ops';
import * as collected from '../../../../ZoeW/src/domain/collected';

const H = 'zoew_scan_history_cod_dod', D = 'zoew_daily_revenue_cod_dod', M = 'zoew_monthly_revenue_cod_dod';
const HOST = 'https://m3-unknown.firebaseio.com';
const NOW = Date.UTC(2026, 9, 24, 2);
const lab = { updates: 0, store: {} as any, fault: '' as '' | 'landed' | 'lost' | 'gone', readFails: false, intents: [] as any[] };
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
        update: async (r: any, ups: any) => {
            lab.updates = (lab.updates || 0) + 1;
            for (const [k, v] of Object.entries(ups) as any[]) {
                const p = [r.path, k].filter(Boolean).join('/');
                setAt(p, v && typeof v === 'object' && '__inc' in v ? Math.round(((getAt(p) || 0) + v.__inc) * 100) / 100 : v);
            }
        },
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


const row = () => getAt(H + '/itemI');
const deferred = () => { let resolve!: () => void; const promise = new Promise<void>(r => { resolve = r; }); return { promise, resolve }; };
const intercept = (hook: (r: any, update: any, original: any) => any) => {
    const original = firebaseState.fb.runTransaction;
    firebaseState.fb.runTransaction = (r: any, update: any) => hook(r, update, original);
};
const alarm = () => ((window as any).ZoeErrors.capture as any).mock.calls.some(([, extra]: any) => extra?.zone === 'money');

describe('pricePending ៖ ទ្វារកែតម្លៃពិត និងសោទឹកប្រាក់', () => {
    it('សោត្រូវបាន ACK មុនទឹកប្រាក់ និងតម្លៃក្នុង UI', async () => {
        const gate = deferred(); const entered = deferred(); let first = true;
        intercept(async (r, update, original) => {
            if (r.path === H + '/itemI' && first) { first = false; entered.resolve(); await gate.promise; }
            return original(r, update);
        });
        const operation = saveEditedBarcodePrice();
        await entered.promise;
        try {
            expect(money()).toEqual([[10, 1], [10, 1]]);
            expect(dataState.scanHistory[0].barcodes[0].cod).toBe(10);
        } finally { gate.resolve(); await operation; await settle(); }
        expect(row().pricePending).toMatchObject({ phase: 'settled', outcome: 'committed' });
        expect(money()).toEqual([[20, 1], [20, 1]]);
    });

    it.each(['scanPending', 'pricePending', 'clearClaim', 'restoreClaimId', 'trashClaim'])('សោ %s រារាំងទឹកប្រាក់មុនផ្លាស់ប្ដូរ', async (key) => {
        const value = row();
        if (key === 'trashClaim') value.barcodes[0].trashClaim = 'owned_elsewhere';
        else value[key] = key === 'restoreClaimId' ? 'restore_elsewhere' : { token: 'owned_elsewhere', phase: 'admitted' };
        setAt(H + '/itemI', value);
        await saveEditedBarcodePrice(); await settle();
        expect(money()).toEqual([[10, 1], [10, 1]]);
        expect(row().barcodes[0].cod).toBe(10);
    });

    it.each(['createdAt', 'cod', 'isClosed', 'restoredAt'])('អត្តសញ្ញាណ authoritative %s ខុស ➜ មិនកែប្រាក់', async (key) => {
        const value = row(); value.barcodes[0][key] = key === 'isClosed' ? true : 999;
        setAt(H + '/itemI', value);
        await saveEditedBarcodePrice(); await settle();
        expect(money()).toEqual([[10, 1], [10, 1]]);
        expect(row().pricePending).toBeUndefined();
    });

    it.each([null, false, 'pending'])('mirror ACK %s មិនបញ្ចេញសោ', async (saved) => {
        vi.spyOn(collected, 'syncCollectedValueForBarcode').mockReturnValue(Promise.resolve(saved) as any);
        await saveEditedBarcodePrice(); await settle();
        expect(row().pricePending?.phase).toBe('history');
        expect(row().pricePending?.outcome).toBeUndefined();
    });

    it('mirror គ្មានប្រាក់ប្រមូល ហើយ server ACK no-op ➜ បញ្ចប់ជាក់លាក់', async () => {
        const sync = vi.spyOn(collected, 'syncCollectedValueForBarcode');
        await saveEditedBarcodePrice(); await settle();
        expect(sync).toHaveBeenCalledOnce();
        expect(await sync.mock.results[0].value).toBe(true);
        expect(row().pricePending).toMatchObject({ phase: 'settled', outcome: 'committed' });
    });

    it.each(['auth', 'db', 'scope', 'uid', 'sdk'])('ប្ដូរ %s ក្រោយ admission ➜ មិនកែ money/history បន្ថែម', async (kind) => {
        intercept(async (r, update, original) => {
            const result = await original(r, update);
            if (r.path === H + '/itemI' && row().pricePending?.phase === 'admitted') {
                if (kind === 'auth') firebaseState.authGeneration++;
                if (kind === 'db') firebaseState.db = { name: 'other' } as any;
                if (kind === 'scope') localStorage.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: HOST + '/other' }));
                if (kind === 'uid') (firebaseState.auth.currentUser as any).uid = 'other';
                if (kind === 'sdk') firebaseState.fb = { ...firebaseState.fb } as any;
            }
            return result;
        });
        await saveEditedBarcodePrice(); await settle();
        expect(row().pricePending?.phase).toBe('admitted');
        expect(money()).toEqual([[10, 1], [10, 1]]);
        expect(row().barcodes[0].cod).toBe(10);
    });
    it.each(['scope', 'uid', 'sdk'])('mirror មិនផ្ញើសំណើថ្មីក្រោយ %s ប្ដូរពេលកំពុងអាន', async (kind) => {
        const gate = deferred(); const entered = deferred(); const sdk = firebaseState.fb; const get = sdk.get;
        let switched = false; let afterSwitch = 0;
        sdk.get = async (r: any) => {
            if (r.path === H + '/itemI' && row().pricePending?.phase === 'history') { entered.resolve(); await gate.promise; }
            return get(r);
        };
        intercept(async (r, update, original) => {
            if (switched && r.path.startsWith('zoew_daily_collected_cod_dod/')) afterSwitch++;
            return original(r, update);
        });
        const operation = saveEditedBarcodePrice(); await entered.promise;
        if (kind === 'scope') localStorage.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: HOST + '/other' }));
        if (kind === 'uid') (firebaseState.auth.currentUser as any).uid = 'other';
        if (kind === 'sdk') firebaseState.fb = { ...firebaseState.fb } as any;
        switched = true; gate.resolve(); await operation; await settle();
        expect(afterSwitch).toBe(0);
        expect(row().pricePending.phase).toBe('history');
    });

    it('mirror reject ➜ history នៅជាប់សោ', async () => {
        vi.spyOn(collected, 'syncCollectedValueForBarcode').mockRejectedValue(unknown());
        await saveEditedBarcodePrice(); await settle();
        expect(row().pricePending.phase).toBe('history');
    });

    it('marker settled ខូចមិនអាចបើកសោតាមពាក្យ phase តែមួយ', async () => {
        const value = row(); value.pricePending = { phase: 'settled', outcome: 'committed' }; setAt(H + '/itemI', value);
        await saveEditedBarcodePrice(); await settle();
        expect(money()).toEqual([[10, 1], [10, 1]]);
        expect(row().barcodes[0].cod).toBe(10);
    });

    it('legacy birth អវត្តមានអនុញ្ញាតតែ identity ពេញលេញដូច authoritative', async () => {
        const value = row(); delete value.createdAt; delete value.barcodes[0].createdAt;
        setAt(H + '/itemI', value); dataState.scanHistory = [clone(value)];
        await saveEditedBarcodePrice(); await settle();
        expect(row().pricePending).toMatchObject({ birth: 0, rowBirth: 0, phase: 'settled', outcome: 'committed' });
    });

    it.each([
        ['birth-fraction', 1.5], ['birth-negative', -1], ['birth-unsafe', 9007199254740992],
        ['price-fraction', 10.001], ['price-unsafe', 90071992547410], ['price-negative', -1]
    ])('អត្តសញ្ញាណ ឬតម្លៃក្រៅដែន %s មិនចាប់ផ្ដើម money', async (key, invalid) => {
        const value = row();
        if (String(key).startsWith('birth')) value.barcodes[0].createdAt = invalid;
        else value.barcodes[0].cod = invalid;
        setAt(H + '/itemI', value); dataState.scanHistory = [clone(value)];
        await saveEditedBarcodePrice(); await settle();
        expect(row().pricePending).toBeUndefined();
        expect(money()).toEqual([[10, 1], [10, 1]]);
    });

    it('array និង object slot ដដែលមិនរារាំង legacy identity', async () => {
        const value = row(); value.barcodes = { 0: value.barcodes[0] }; delete value.id;
        setAt(H + '/itemI', value);
        await saveEditedBarcodePrice(); await settle();
        expect(row().pricePending).toMatchObject({ slot: '0', phase: 'settled', outcome: 'committed' });
        expect(row().id).toBeUndefined();
    });

    it('price ដូចដើមត្រូវរក្សា ledger no-op និងផ្ទៀង mirror ACK', async () => {
        input('editBcCodInput', '10');
        let ledgerWrites = 0;
        intercept(async (r, update, original) => {
            if (r.path === M || r.path.startsWith(D + '/')) ledgerWrites++;
            return original(r, update);
        });
        await saveEditedBarcodePrice(); await settle();
        expect(ledgerWrites).toBe(0);
        expect(row().pricePending).toMatchObject({ phase: 'settled', outcome: 'committed' });
    });

    it('positive birth ៖ កែតម្លៃរក្សា sibling close និង target locker ថ្មីពី authoritative admission', async () => {
        const value = row(); value.barcodes.push({ code: 'B100000002', cod: 5, dod: 0, createdAt: NOW - 30000, isClosed: false, isDeducted: false, isFromDeletion: false });
        value.count = 2; value.cod = 15; value.price = 15;
        setAt(H + '/itemI', value); dataState.scanHistory = [clone(value)];
        setAt(D + '/' + DAY(), { codDollar: 15, dodDollar: 0, totalCount: 2 });
        setAt(M + '/' + DAY().slice(0, 7), { codDollar: 15, dodDollar: 0, totalCount: 2 });
        dataState.dailyRevenueData = clone(lab.store[D]); dataState.monthlyRevenueData = clone(lab.store[M]);
        value.barcodes[1].isClosed = true; value.barcodes[1].closedAt = NOW;
        value.barcodes[0].locker = 'Z9'; value.barcodes[0].lockerUpdatedAt = NOW;
        setAt(H + '/itemI', value);
        await saveEditedBarcodePrice(); await settle();
        expect(row().barcodes[0].cod).toBe(20);
        expect(row().barcodes[0].locker).toBe('Z9');
        expect(row().barcodes[1].isClosed).toBe(true);
        expect(row().pricePending).toMatchObject({ phase: 'settled', outcome: 'committed' });
        expect(money()).toEqual([[25, 2], [25, 2]]);
    });

    it.each(['slot', 'duplicate', 'rowBirth', 'scanDate', 'rowRestored', 'targetTime'])('admission positive birth មិនអនុញ្ញាត %s ខុសអត្តសញ្ញាណ', async (kind) => {
        const value = row();
        if (kind === 'slot') value.barcodes = [null, value.barcodes[0]];
        if (kind === 'duplicate') value.barcodes.push(clone(value.barcodes[0]));
        if (kind === 'rowBirth') value.createdAt++;
        if (kind === 'scanDate') value.scanDate = '2026-10-23';
        if (kind === 'rowRestored') value.restoredAt = NOW;
        if (kind === 'targetTime') value.barcodes[0].time = '09:00';
        setAt(H + '/itemI', value);
        await saveEditedBarcodePrice(); await settle();
        expect(row().pricePending).toBeUndefined();
        expect(money()).toEqual([[10, 1], [10, 1]]);
    });

    it('legacy birth0 មិនអនុញ្ញាត locker ខុសពី full captured identity', async () => {
        const value = row(); delete value.createdAt; delete value.barcodes[0].createdAt;
        setAt(H + '/itemI', value); dataState.scanHistory = [clone(value)];
        value.barcodes[0].locker = 'Z9'; setAt(H + '/itemI', value);
        await saveEditedBarcodePrice(); await settle();
        expect(row().pricePending).toBeUndefined();
        expect(money()).toEqual([[10, 1], [10, 1]]);
    });

});

describe('តម្លៃចាស់លើសសេន៖ មិនបង្គត់ទិន្នន័យដោយគ្មានភស្តុតាង', () => {
    it.each([[0.005, 0.005], [0.015, 0.005], [0.005, 0.015]])('COD %s / DOD %s នៅ HOLD មុន admission និងមិនប៉ះប្រាក់', async (cod, dod) => {
        const value = row(); value.barcodes[0].cod = cod; value.barcodes[0].dod = dod;
        value.cod = Math.round(cod * 100) / 100; value.dod = Math.round(dod * 100) / 100;
        value.price = value.cod + value.dod; setAt(H + '/itemI', value);
        setAt(D + '/' + DAY(), { codDollar: value.cod, dodDollar: value.dod, totalCount: 1 });
        setAt(M + '/' + DAY().slice(0, 7), { codDollar: value.cod, dodDollar: value.dod, totalCount: 1 });
        dataState.scanHistory = [clone(value)];
        const before = JSON.stringify(lab.store);
        const tx = vi.spyOn(firebaseState.fb, 'runTransaction');
        const update = vi.spyOn(firebaseState.fb, 'update');
        uiState.toasts = [];
        await saveEditedBarcodePrice();
        expect(tx).not.toHaveBeenCalled(); expect(update).not.toHaveBeenCalled();
        expect(JSON.stringify(lab.store)).toBe(before);
        expect(row().pricePending).toBeUndefined();
        expect(uiState.toasts.map((toast) => toast.msg).join(' ')).toContain('តម្លៃដែលកំពុងបង្ហាញមានខ្ទង់លើសសេន');
        expect(uiState.toasts.map((toast) => toast.msg).join(' ')).not.toContain('ជោគជ័យ');
    });

    it('ទិដ្ឋភាពលើសសេនចាស់មិនត្រូវអះអាងថាតម្លៃ server ខុស', async () => {
        dataState.scanHistory[0].barcodes[0].cod = 0.005;
        const before = JSON.stringify(lab.store); uiState.toasts = [];
        const tx = vi.spyOn(firebaseState.fb, 'runTransaction');
        await saveEditedBarcodePrice();
        expect(tx).not.toHaveBeenCalled(); expect(JSON.stringify(lab.store)).toBe(before);
        expect(uiState.toasts.map((toast) => toast.msg).join(' ')).toContain('កំពុងបង្ហាញ');
        expect(uiState.toasts.map((toast) => toast.msg).join(' ')).toContain('Refresh');
    });

    it('កូដស្ទួនមិនត្រូវទាយថាជាករណីខ្ទង់លើសសេន', async () => {
        dataState.scanHistory[0].barcodes.push({ ...dataState.scanHistory[0].barcodes[0], cod: 0.005 });
        const before = JSON.stringify(lab.store); uiState.toasts = [];
        await saveEditedBarcodePrice();
        expect(JSON.stringify(lab.store)).toBe(before);
        expect(uiState.toasts.map((toast) => toast.msg).join(' ')).not.toContain('ខ្ទង់លើសសេន');
        expect(uiState.toasts.map((toast) => toast.msg).join(' ')).toContain('សោប្រតិបត្តិការ');
    });

    it('តម្លៃសេន៖ ទិដ្ឋភាពចាស់ HOLD ហើយ Refresh/retry ប្រើតម្លៃ server សម្រាប់ delta', async () => {
        const value = row(); value.barcodes[0].cod = 12.25; value.cod = 12.25; value.price = 12.25;
        setAt(H + '/itemI', value);
        setAt(D + '/' + DAY(), { codDollar: 12.25, dodDollar: 0, totalCount: 1 });
        setAt(M + '/' + DAY().slice(0, 7), { codDollar: 12.25, dodDollar: 0, totalCount: 1 });
        const before = JSON.stringify(lab.store);
        await saveEditedBarcodePrice(); expect(JSON.stringify(lab.store)).toBe(before);
        dataState.scanHistory = [clone(value)];
        dataState.dailyRevenueData = clone(lab.store[D]); dataState.monthlyRevenueData = clone(lab.store[M]);
        await saveEditedBarcodePrice(); await settle();
        expect(row().pricePending).toMatchObject({ phase: 'settled', outcome: 'committed', priorCod: 12.25, wantCod: 20 });
        expect(money()).toEqual([[20, 1], [20, 1]]);
    });
});


describe('trash projection after a completed price operation', () => {
    const marker = () => ({ token: 'price_' + 'a'.repeat(32), actorUid: 'fixture-user', code: 'FIXTURE', slot: '0',
        birth: 1000, rowBirth: 1000, scanDate: '2026-10-30', priorCod: 1, priorDod: 0, wantCod: 2, wantDod: 0, phase: 'settled', outcome: 'committed' });
    it.each(['committed', 'compensated'])('only the copied trash loses a valid %s marker', (outcome) => {
        const source = { createdAt: 1000, pricePending: { ...marker(), outcome }, barcodes: [{ code: 'FIXTURE', createdAt: 1000, cod: 2 }] };
        const before = JSON.stringify(source), projected = stripHistoryOnlyMarkers(clone(source));
        expect(rowOperationActive(source)).toBe(false); expect(projected.pricePending).toBeUndefined();
        expect(projected.barcodes).toEqual(source.barcodes); expect(JSON.stringify(source)).toBe(before);
    });
    it.each(['admitted', 'history', 'cancelling', 'unknown', 'missing-outcome', 'extra-field', 'bad-token'])('unresolved %s evidence remains and blocks operations', (kind) => {
        const value: any = marker();
        if (kind === 'missing-outcome') delete value.outcome;
        else if (kind === 'extra-field') value.extra = true;
        else if (kind === 'bad-token') value.token = 'invalid';
        else { value.phase = kind; delete value.outcome; }
        const projected = stripHistoryOnlyMarkers({ pricePending: value, scanPending: { intent: 'unknown' }, barcodes: [] });
        expect(projected.pricePending).toBe(value); expect(projected.scanPending).toEqual({ intent: 'unknown' });
        expect(rowOperationActive(projected)).toBe(true);
        expect(rowOperationActive({ pricePending: value })).toBe(true);
    });
});

describe('pricePending ៖ commit atomic (A526) ជំនួស history callback · inverse · alignment របស់ protocol មុន', () => {
    const commits = () => lab.updates;
    const patchFault = (fault: (ups: any) => void) => {
        const original = firebaseState.fb.update;
        firebaseState.fb.update = async (r: any, ups: any) => {
            if (Object.keys(ups).some((k) => k.endsWith('/pricePending/phase') && ups[k] === 'history')) fault(ups);
            return original(r, ups);
        };
    };

    it('commit បដិសេធជាក់លាក់ ➜ cancelling ➜ compensated · ប្រាក់មិនប្រែ · គ្មាន inverse ledger', async () => {
        let inverses = 0;
        patchFault(() => { throw Object.assign(new Error('permission_denied'), { code: 'PERMISSION_DENIED' }); });
        intercept(async (r, update, original) => { if (r.path === D + '/' + DAY() || r.path === M) inverses++; return original(r, update); });
        await saveEditedBarcodePrice(); await settle();
        expect(row().pricePending).toMatchObject({ phase: 'settled', outcome: 'compensated' });
        expect({ money: money(), cod: row().barcodes[0].cod, inverses }).toEqual({ money: [[10, 1], [10, 1]], cod: 10, inverses: 0 });
    });

    it.each(['token', 'actorUid', 'code', 'slot', 'birth', 'rowBirth', 'scanDate', 'priorCod', 'priorDod', 'wantCod', 'wantDod'])('marker server ខុស tuple %s ក្រោយ admission ➜ commit មិនផ្ញើ · ប្រាក់មិនប្រែ', async (key) => {
        intercept(async (r, update, original) => {
            const result = await original(r, update);
            if (r.path === H + '/itemI' && row().pricePending?.phase === 'admitted') {
                const value = row();
                value.pricePending[key] = key === 'token' ? 'price_' + 'f'.repeat(32) : key === 'actorUid' || key === 'code' || key === 'scanDate' ? value.pricePending[key] + 'x' : value.pricePending[key] + 1;
                setAt(H + '/itemI', value);
            }
            return result;
        });
        const before = commits();
        await saveEditedBarcodePrice(); await settle();
        expect({ sent: commits() - before, money: money(), cod: row().barcodes[0].cod }).toEqual({ sent: 0, money: [[10, 1], [10, 1]], cod: 10 });
        expect(alarm()).toBe(true);
    });

    it('commit unknown មិនចុះ ➜ admitted · ប្រាក់មិនប្រែ · សោ durable · Sentry money', async () => {
        patchFault(() => { throw unknown(); });
        await saveEditedBarcodePrice(); await settle();
        expect({ phase: row().pricePending?.phase, money: money() }).toEqual({ phase: 'admitted', money: [[10, 1], [10, 1]] });
        expect(alarm()).toBe(true);
    });

    it.each(['scope', 'uid', 'sdk'])('ប្ដូរ %s ពេលកំពុងអាន server មុន commit ➜ មិនផ្ញើ commit ទៅ session ថ្មី', async (kind) => {
        const gate = deferred(); const entered = deferred(); const fetcher = globalThis.fetch as any; let switched = false;
        vi.stubGlobal('fetch', vi.fn(async (input: any, init: any) => {
            if (!switched && String(input).includes(D + '/')) { entered.resolve(); await gate.promise; }
            return fetcher(input, init);
        }));
        const before = commits();
        const operation = saveEditedBarcodePrice(); await entered.promise;
        if (kind === 'scope') localStorage.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: HOST + '/other' }));
        if (kind === 'uid') (firebaseState.auth.currentUser as any).uid = 'other';
        if (kind === 'sdk') firebaseState.fb = { ...firebaseState.fb } as any;
        switched = true; gate.resolve(); await operation; await settle();
        expect({ sent: commits() - before, money: money(), phase: row().pricePending.phase }).toEqual({ sent: 0, money: [[10, 1], [10, 1]], phase: 'admitted' });
    });

    it.each(['commit', 'cancelling', 'settled-committed', 'settled-compensated'].flatMap(step => [true, false].map(landed => ({ step, landed }))))('ACK បាត់នៅ $step / landed=$landed ➜ សម្រេចពី server · មិនផ្ញើបន្ថែម', async ({ step, landed }) => {
        const cancel = step === 'cancelling' || step === 'settled-compensated';
        let faulted = false; let later = 0;
        if (step === 'commit') patchFault(() => { if (!landed) { faulted = true; throw unknown(); } });
        else if (cancel) patchFault(() => { throw Object.assign(new Error('permission_denied'), { code: 'PERMISSION_DENIED' }); });
        if (step === 'commit' && landed) {
            const original = firebaseState.fb.update;
            firebaseState.fb.update = async (r: any, ups: any) => { await original(r, ups); if (Object.keys(ups).some((k) => k.endsWith('/pricePending/phase'))) { faulted = true; throw unknown(); } };
        }
        intercept(async (r, update, original) => {
            if (faulted && step !== 'commit') later++;
            if (r.path === H + '/itemI' && step !== 'commit') {
                const proposal = update(row());
                const phase = proposal?.pricePending?.phase === 'settled' ? 'settled-' + proposal.pricePending.outcome : proposal?.pricePending?.phase;
                if (phase === step) {
                    if (landed) await original(r, update);
                    faulted = true; throw unknown();
                }
            }
            return original(r, update);
        });
        await saveEditedBarcodePrice(); await settle();
        const expected = step === 'commit' ? (landed ? 'settled' : 'admitted')
            : step === 'cancelling' ? (landed ? 'cancelling' : 'admitted')
            : landed ? 'settled' : step === 'settled-compensated' ? 'cancelling' : 'history';
        expect(faulted).toBe(true);
        expect(row().pricePending?.phase).toBe(expected);
        expect(later).toBe(0);
        const amount = cancel || step === 'commit' && !landed ? 10 : 20;
        expect(money()).toEqual([[amount, 1], [amount, 1]]);
    });
});

describe('Web Lock មិនចាក់សកម្មភាពដែលបរាជ័យឡើងវិញក្រៅសោ', () => {
    afterEach(() => { vi.unstubAllGlobals(); });
    it('បញ្ជូនកំហុសដើម ហើយរត់សកម្មភាពតែម្ដងក្នុងសោ', async () => {
        const { withPriceOperationLock } = await import('../../../../ZoeW/src/services/price-operation');
        const failure = new Error('unknown write outcome');
        let held = false;
        vi.stubGlobal('navigator', { locks: { request: vi.fn(async (_name, _options, callback) => {
            held = true;
            try { return await callback({ name: 'price' }); } finally { held = false; }
        }) } });
        const action = vi.fn(async () => { expect(held).toBe(true); throw failure; });
        await expect(withPriceOperationLock('reject-token', action)).rejects.toBe(failure);
        expect(action).toHaveBeenCalledTimes(1);
    });
    it('មិនរត់សកម្មភាពពេលសំណើសោត្រូវបដិសេធ', async () => {
        const { withPriceOperationLock } = await import('../../../../ZoeW/src/services/price-operation');
        const failure = new Error('lock unavailable');
        vi.stubGlobal('navigator', { locks: { request: vi.fn(async () => { throw failure; }) } });
        const action = vi.fn(async () => 'written');
        await expect(withPriceOperationLock('unavailable-token', action)).rejects.toBe(failure);
        expect(action).not.toHaveBeenCalled();
    });
    it('សោមានម្ចាស់ផ្សេង មិនរត់សកម្មភាព ឬប្ដូរទៅក្រៅសោ', async () => {
        const { withPriceOperationLock } = await import('../../../../ZoeW/src/services/price-operation');
        const request = vi.fn(async (_name, options, callback) => {
            expect(options).toEqual({ ifAvailable: true });
            return callback(null);
        });
        vi.stubGlobal('navigator', { locks: { request } });
        const action = vi.fn(async () => 'written');
        expect(await withPriceOperationLock('contended-token', action, true)).toBeNull();
        expect(action).not.toHaveBeenCalled();
        expect(request).toHaveBeenCalledTimes(1);
    });
    it('កំហុសដោះសោក្នុងផ្ទាំង ហើយការសាកថ្មីត្រូវចូល Web Lock ថ្មី', async () => {
        const { withPriceOperationLock } = await import('../../../../ZoeW/src/services/price-operation');
        let held = false;
        const request = vi.fn(async (_name, _options, callback) => {
            held = true;
            try { return await callback({ name: 'price' }); } finally { held = false; }
        });
        vi.stubGlobal('navigator', { locks: { request } });
        const failure = new Error('unknown outcome');
        await expect(withPriceOperationLock('retry-token', async () => { throw failure; })).rejects.toBe(failure);
        const retry = vi.fn(async () => { expect(held).toBe(true); return 'verified'; });
        expect(await withPriceOperationLock('retry-token', retry)).toBe('verified');
        expect(retry).toHaveBeenCalledTimes(1);
        expect(request).toHaveBeenCalledTimes(2);
    });
    it('គ្មាន Web Locks នៅតែប្រើសោក្នុងផ្ទាំងដដែល', async () => {
        const { withPriceOperationLock } = await import('../../../../ZoeW/src/services/price-operation');
        vi.stubGlobal('navigator', {});
        let resolve!: (value: string) => void;
        const action = vi.fn(() => new Promise<string>(yes => { resolve = yes; }));
        const first = withPriceOperationLock('local-token', action);
        expect(await withPriceOperationLock('local-token', action)).toBeNull();
        resolve('done');
        expect(await first).toBe('done');
        expect(action).toHaveBeenCalledTimes(1);
    });
});
