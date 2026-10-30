import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { refTo } from '../src/app/refs';
import { dataState, firebaseState, uiState } from '../src/core/state';
import { getFormattedDate } from '../src/core/timezone';
import { saveEditedBarcodePrice } from '../src/features/barcode-ops';
import * as collected from '../src/domain/collected';
import * as ledger from '../src/domain/ledger';

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

    it('history បរាជ័យជាក់លាក់ ➜ fence មុនសងប្រាក់ ហើយ callback ចាស់មិនអាចកែម្ដងទៀត', async () => {
        let late: any;
        intercept(async (r, update, original) => {
            if (r.path === H + '/itemI') {
                const proposal = update(row());
                if (proposal?.pricePending?.phase === 'history' || !proposal?.pricePending) {
                    late = update;
                    throw Object.assign(new Error('refused'), { txOutcome: 'not-applied' });
                }
            }
            return original(r, update);
        });
        await saveEditedBarcodePrice(); await settle();
        expect(row().pricePending).toMatchObject({ phase: 'settled', outcome: 'compensated' });
        expect(money()).toEqual([[10, 1], [10, 1]]);
        expect(late(row())).toBeUndefined();
        const newer = row(); newer.pricePending.token = 'price_' + 'f'.repeat(32); newer.pricePending.phase = 'admitted';
        delete newer.pricePending.outcome;
        expect(late(newer)).toBeUndefined();
    });

    it.each(['token', 'actorUid', 'code', 'slot', 'birth', 'rowBirth', 'scanDate', 'priorCod', 'priorDod', 'wantCod', 'wantDod'])('history callback មិនទទួល tuple %s ខុស', async (key) => {
        let updater: any;
        intercept(async (r, update, original) => {
            if (r.path === H + '/itemI' && row().pricePending?.phase === 'admitted') {
                const next = update(row());
                if (next?.pricePending?.phase === 'history') updater = update;
            }
            return original(r, update);
        });
        await saveEditedBarcodePrice(); await settle();
        expect(updater).toBeTypeOf('function');
        const value = row(); value.pricePending.phase = 'admitted'; delete value.pricePending.outcome;
        value.barcodes[0].cod = 10; value.cod = 10; value.price = 10;
        value.pricePending[key] = key === 'token' ? 'price_' + 'f'.repeat(32) : value.pricePending[key] + 1;
        expect(updater(value)).toBeUndefined();
    });

    it('history unknown មិនសងប្រាក់តាមតម្លៃចាស់ និងរក្សាសោ durable', async () => {
        intercept(async (r, update, original) => {
            if (r.path === H + '/itemI' && row().pricePending?.phase === 'admitted' && update(row())?.pricePending?.phase === 'history') throw unknown();
            return original(r, update);
        });
        await saveEditedBarcodePrice(); await settle();
        expect(row().pricePending?.phase).toBe('admitted');
        expect(money()).toEqual([[20, 1], [20, 1]]);
        expect(alarm()).toBe(true);
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
    it.each(['scope', 'uid', 'sdk'])('alignment ផ្ទៃក្នុងមិនផ្ញើទៅ session ថ្មីពេល %s ប្ដូរកណ្ដាល money', async (kind) => {
        const gate = deferred(); const entered = deferred(); let switched = false; let afterSwitch = 0;
        intercept(async (r, update, original) => {
            if (r.path === M) {
                if (switched) afterSwitch++;
                else throw Object.assign(new Error('permission_denied'), { code: 'permission_denied' });
            }
            if (r.path === D + '/' + DAY()) { entered.resolve(); await gate.promise; }
            return original(r, update);
        });
        const operation = saveEditedBarcodePrice();
        await entered.promise;
        if (kind === 'scope') localStorage.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: HOST + '/other' }));
        if (kind === 'uid') (firebaseState.auth.currentUser as any).uid = 'other';
        if (kind === 'sdk') firebaseState.fb = { ...firebaseState.fb } as any;
        switched = true; gate.resolve();
        await operation; await settle();
        expect(afterSwitch).toBe(0);
        expect(row().pricePending.phase).not.toBe('settled');
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

    it('សងប្រាក់រង់ចាំ daily និង monthly ដើម ហើយ cancelling រារាំង callback ចាស់', async () => {
        const gate = deferred(); const entered = deferred(); let late: any; let monthly = 0; let inverses = 0;
        const sync = vi.spyOn(collected, 'syncCollectedValueForBarcode');
        intercept(async (r, update, original) => {
            if (r.path === H + '/itemI' && update(row())?.pricePending?.phase === 'history') {
                late = update; throw Object.assign(new Error('refused'), { txOutcome: 'not-applied' });
            }
            if (r.path === M && monthly++ === 0) { entered.resolve(); await gate.promise; }
            if (update.connectionIntent?.cod < 0) inverses++;
            return original(r, update);
        });
        const operation = saveEditedBarcodePrice(); await entered.promise; await settle();
        try {
            expect(row().pricePending.phase).toBe('cancelling');
            expect(late(row())).toBeUndefined();
            expect(inverses).toBe(0);
        } finally { gate.resolve(); await operation; await settle(); }
        expect(row().pricePending).toMatchObject({ phase: 'settled', outcome: 'compensated' });
        expect(money()).toEqual([[10, 1], [10, 1]]);
        expect(sync).not.toHaveBeenCalled();
    });

    it('daily ដើម unknown ➜ មិនប៉ាន់ស្មាន inverse ហើយរក្សា cancelling', async () => {
        let inverses = 0;
        intercept(async (r, update, original) => {
            if (r.path === H + '/itemI' && update(row())?.pricePending?.phase === 'history') throw Object.assign(new Error('refused'), { txOutcome: 'not-applied' });
            if (update.connectionIntent?.cod < 0) inverses++;
            const result = await original(r, update);
            if (r.path === D + '/' + DAY()) throw unknown();
            return result;
        });
        await saveEditedBarcodePrice(); await settle();
        expect(row().pricePending.phase).toBe('cancelling');
        expect(inverses).toBe(0);
        expect(money()).toEqual([[20, 1], [20, 1]]);
    });

    it.each(['known', 'unknown'])('inverse %s បរាជ័យ ➜ មិនដោះសោ cancelling', async (mode) => {
        intercept(async (r, update, original) => {
            if (r.path === H + '/itemI' && update(row())?.pricePending?.phase === 'history') throw Object.assign(new Error('refused'), { txOutcome: 'not-applied' });
            if (r.path === D + '/' + DAY() && update.connectionIntent?.cod < 0) {
                if (mode === 'unknown') { await original(r, update); throw unknown(); }
                throw Object.assign(new Error('permission_denied'), { code: 'permission_denied' });
            }
            return original(r, update);
        });
        await saveEditedBarcodePrice(); await settle();
        expect(row().pricePending.phase).toBe('cancelling');
        expect(row().pricePending.outcome).toBeUndefined();
    });

    it.each(['admitted', 'history', 'cancelling', 'settled-committed', 'settled-compensated'].flatMap(phase => [true, false].map(landed => ({ phase, landed }))))('ACK បាត់នៅ $phase / landed=$landed មិនបង្កើតលទ្ធផលប៉ាន់ស្មាន', async ({ phase, landed }) => {
        const cancel = phase === 'cancelling' || phase === 'settled-compensated';
        let faulted = false; let later = 0;
        intercept(async (r, update, original) => {
            if (faulted) later++;
            if (r.path === H + '/itemI') {
                const proposal = update(row());
                if (cancel && proposal?.pricePending?.phase === 'history') throw Object.assign(new Error('refused'), { txOutcome: 'not-applied' });
                if (proposal?.pricePending?.phase === phase.split('-')[0]) {
                    if (landed) await original(r, update);
                    faulted = true; throw unknown();
                }
            }
            return original(r, update);
        });
        await saveEditedBarcodePrice(); await settle();
        const expected = phase === 'admitted' ? (landed ? 'admitted' : undefined)
            : phase === 'history' ? (landed ? 'history' : 'admitted')
            : phase === 'cancelling' ? (landed ? 'cancelling' : 'admitted')
            : landed ? 'settled' : cancel ? 'cancelling' : 'history';
        expect(row().pricePending?.phase).toBe(expected);
        expect(faulted).toBe(true);
        expect(later).toBe(0);
        const amount = phase === 'admitted' || phase === 'settled-compensated' ? 10 : 20;
        expect(money()).toEqual([[amount, 1], [amount, 1]]);
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

    it.each(['scope', 'uid', 'sdk'])('inverse ចុង microtask មិនផ្ញើសំណើថ្មីក្រោយ %s ប្ដូរ', async (kind) => {
        let switched = false; let afterSwitch = 0;
        const revert = ledger.revertRevenueLedgerDelta;
        vi.spyOn(ledger, 'revertRevenueLedgerDelta').mockImplementation((applied) => {
            const result = revert(applied);
            queueMicrotask(() => queueMicrotask(() => {
                if (kind === 'scope') localStorage.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: HOST + '/other' }));
                if (kind === 'uid') (firebaseState.auth.currentUser as any).uid = 'other';
                if (kind === 'sdk') firebaseState.fb = { ...firebaseState.fb } as any;
                switched = true;
            }));
            return result;
        });
        intercept(async (r, update, original) => {
            if (r.path === H + '/itemI' && update(row())?.pricePending?.phase === 'history') throw Object.assign(new Error('refused'), { txOutcome: 'not-applied' });
            if (switched && update.connectionIntent?.cod < 0) afterSwitch++;
            return original(r, update);
        });
        await saveEditedBarcodePrice(); await settle();
        expect(switched).toBe(true);
        expect(afterSwitch).toBe(0);
        expect(row().pricePending.phase).toBe('cancelling');
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
