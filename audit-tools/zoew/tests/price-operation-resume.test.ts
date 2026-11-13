// ការកែតម្លៃ barcode ៖ ប្រាក់ចូលតែតាម update atomic មួយ (ជួរ admitted ➜ history + increment ថ្ងៃ/ខែ) ដែល rules ទទួលតែពេលជួរនៅ admitted
// ➜ ការផ្ទុកឡើងវិញ · ចម្លើយបាត់ · ឧបករណ៍ផ្សេងនៃគណនីដដែល បញ្ចប់វាម្តងគត់ · marker ចាស់ (protocol មុន) មានផ្លូវចេញម្ចាស់ដោយមិនកែប្រាក់។
import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { refTo } from '../../../ZoeW/src/app/refs';
import { dataState, firebaseState, uiState } from '../../../ZoeW/src/core/state';
import { viewState } from '../../../ZoeW/src/core/view-state';
import { getFormattedDate } from '../../../ZoeW/src/core/timezone';
import { saveEditedBarcodePrice } from '../../../ZoeW/src/features/barcode-ops';
import { collectedValueIsMeasurable } from '../../../ZoeW/src/features/export';
import { resolvePriceOperations } from '../../../ZoeW/src/features/pending-writes';
import { PRICE_PROTOCOL_V2_TAG, rowOperationActive } from '../../../ZoeW/src/services/row-operation-lock';
import * as priceOperation from '../../../ZoeW/src/services/price-operation';

const H = 'zoew_scan_history_cod_dod', D = 'zoew_daily_revenue_cod_dod', M = 'zoew_monthly_revenue_cod_dod';
const HOST = 'https://price-resume.firebaseio.com';
const NOW = Date.UTC(2026, 10, 4, 2);
const GRACE = (priceOperation as any).PRICE_RESUME_GRACE_MS ?? 60000;
const resume = () => (priceOperation as any).resumePriceOperations?.();
const lab = { store: {} as any, commitFault: '' as '' | 'lost-landed' | 'lost-not-landed', updates: 0, refusals: 0 };
const clone = <V,>(v: V): V => (v === undefined ? v : JSON.parse(JSON.stringify(v)));
const parts = (p: string) => p.split('/').filter(Boolean);
const getAt = (p: string, root = lab.store) => clone(parts(p).reduce((n: any, k) => n?.[k], root) ?? null);
function setAt(p: string, v: any, root = lab.store) {
    const segs = parts(p); const leaf = segs.pop()!; let node = root;
    for (const s of segs) node = node[s] ||= {};
    if (v === null || v === undefined) delete node[leaf]; else node[leaf] = clone(v);
}
const ref = (p = '') => ({ path: p, key: parts(p).at(-1) || null, toString: () => HOST + '/' + p });
const snap = (r: any, v: any) => ({ ref: r, key: r.key, val: () => clone(v), exists: () => v !== null && v !== undefined });
const DAY = () => getFormattedDate(new Date(NOW));
const settle = async () => { for (let i = 0; i < 60; i++) await new Promise((r) => setTimeout(r, 0)); };
const money = () => [getAt(D + '/' + DAY()), getAt(M + '/' + DAY().slice(0, 7))].map((r) => [r.codDollar, r.dodDollar, r.totalCount]);
const denied = () => Object.assign(new Error('permission_denied'), { code: 'PERMISSION_DENIED' });
const v2Token = 'price_' + PRICE_PROTOCOL_V2_TAG + '0011223344556677';
const legacyToken = 'price_' + '9'.repeat(32);
function input(id: 'editBcCodInput' | 'editBcDodInput', value: string) {
    const el = document.createElement('input');
    el.value = value;
    refTo(id)(el);
}
const marker = (token: string, phase: string, extra: any = {}) => ({ token, actorUid: 'u', code: 'A100000001', slot: '0', birth: NOW - 3600000,
    rowBirth: NOW - 3600000, scanDate: DAY(), priorCod: 10, priorDod: 0, wantCod: 20, wantDod: 0, phase, ...extra });
function row(cod: number, pricePending?: any) {
    return { phone: '012000111', scanDate: DAY(), time: '08:00:00 (' + DAY() + ')', createdAt: NOW - 3600000, count: 1, cod, dod: 0, price: cod,
        isClosed: false, isCalled: false, barcode: 'A100000001', barcodes: [{ code: 'A100000001', cod, dod: 0, createdAt: NOW - 3600000, isClosed: false, isDeducted: false, isFromDeletion: false }],
        ...(pricePending ? { pricePending } : {}) };
}
function seed(itemRow: any, ledger = 10) {
    lab.store = { [H]: { itemI: itemRow }, [D]: { [DAY()]: { codDollar: ledger, dodDollar: 0, totalCount: 1 } },
        [M]: { [DAY().slice(0, 7)]: { codDollar: ledger, dodDollar: 0, totalCount: 1 } } };
    dataState.scanHistory = Object.entries(clone(lab.store[H])).map(([id, value]: any) => ({ ...value, id }));
}
function priceRule(next: any, prior: any) {
    const before = prior?.pricePending, after = next?.pricePending;
    if (before && before.phase !== 'settled' && (!after || after.phase === before.phase)) throw denied();
    if (!after || JSON.stringify(before) === JSON.stringify(after)) return;
    if (after.actorUid !== 'u') throw denied();
    const moves: Record<string, string[]> = { admitted: ['history', 'cancelling'], history: ['settled'], cancelling: ['settled'] };
    if (before && !(moves[before.phase] || []).includes(after.phase)) throw denied();
    if (before && after.phase === 'history' && (next.barcodes[after.slot].cod !== after.wantCod || next.barcodes[after.slot].dod !== after.wantDod)) throw denied();
}
function ledgerRule(store: any) {
    for (const root of [D, M]) for (const record of Object.values(store[root] || {}) as any[]) {
        if (record.codDollar < 0 || record.dodDollar < 0) throw denied();
    }
}

beforeEach(() => {
    localStorage.clear(); localStorage.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: HOST }));
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(NOW);
    vi.stubGlobal('crypto', webcrypto);
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    lab.commitFault = ''; lab.updates = 0; lab.refusals = 0;
    seed(row(10));
    dataState.dailyRevenueData = clone(lab.store[D]); dataState.monthlyRevenueData = clone(lab.store[M]);
    dataState.dailyCollectedData = {}; dataState.deletedItems = [];
    firebaseState.authGeneration++; firebaseState.db = { name: 'price-resume' } as any;
    firebaseState.auth = { currentUser: { uid: 'u', getIdToken: async () => 'tok' } } as any;
    firebaseState.firebaseConfig = { databaseURL: HOST } as any;
    firebaseState.isDatabaseConnected = true;
    firebaseState.dbRefDailyCollected = ref('zoew_daily_collected_cod_dod') as any;
    firebaseState.dbRefHistory = ref(H) as any; firebaseState.dbRefDailyRevenue = ref(D) as any; firebaseState.dbRefMonthlyRevenue = ref(M) as any;
    firebaseState.fb = {
        ref: (_db: any, p = '') => ref(p),
        increment: (n: number) => ({ __inc: n }),
        get: async (r: any) => snap(r, getAt(r.path)),
        update: async (r: any, ups: any) => {
            lab.updates++;
            const next = clone(lab.store);
            for (const [k, v] of Object.entries(ups) as any[]) {
                const p = [r.path, k].filter(Boolean).join('/');
                setAt(p, v && typeof v === 'object' && '__inc' in v ? (getAt(p, next) || 0) + v.__inc : v, next);
            }
            try {
                const touched = new Set(Object.keys(ups).map((k: string) => parts([r.path, k].filter(Boolean).join('/'))).filter((p: string[]) => p[0] === H && p[1]).map((p: string[]) => p[1]));
                for (const id of touched) priceRule(next[H]?.[id], lab.store[H]?.[id]);
                ledgerRule(next);
            } catch (error) { lab.refusals++; throw error; }
            if (lab.commitFault === 'lost-not-landed') throw Object.assign(new Error('disconnect'), { txOutcome: 'unknown' });
            lab.store = next;
            if (lab.commitFault === 'lost-landed') throw Object.assign(new Error('disconnect'), { txOutcome: 'unknown' });
        },
        set: async (r: any, v: any) => setAt(r.path, v),
        runTransaction: async (r: any, fn: any) => {
            const prior = getAt(r.path); const next = fn(clone(prior));
            if (next === undefined) return { committed: false, snapshot: snap(r, prior) };
            if (r.path.startsWith(H + '/')) priceRule(next, prior);
            setAt(r.path, next);
            return { committed: true, snapshot: snap(r, getAt(r.path)) };
        },
        onValue: () => () => {}, off: () => {}
    } as any;
    vi.stubGlobal('fetch', vi.fn(async (inputUrl: any) => {
        const path = decodeURIComponent(new URL(String(inputUrl)).pathname).replace(/^\//, '').replace(/\.json$/, '');
        return new Response(JSON.stringify(getAt(path)), { status: 200, headers: { 'content-type': 'application/json' } });
    }));
    vi.stubGlobal('confirm', () => true);
    (window as any).ZoeErrors = { capture: vi.fn() };
    uiState.toasts = [];
    uiState.activeParentItemId = 'itemI'; uiState.activeEditingBarcode = 'A100000001';
    input('editBcCodInput', '20'); input('editBcDodInput', '0');
    (priceOperation as any).priceOperationSeen?.clear?.();
});
afterEach(() => {
    firebaseState.authGeneration++;
    vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); delete (window as any).ZoeErrors;
});

const serverRow = () => getAt(H + '/itemI');
const syncView = () => { dataState.scanHistory = [{ ...serverRow(), id: 'itemI' }]; };
const afterGrace = async () => { await resume(); await settle(); vi.setSystemTime(NOW + GRACE + 1); await resume(); await settle(); syncView(); };

describe('ការកែតម្លៃដែលត្រូវរំខាន បញ្ចប់ដោយស្វ័យប្រវត្តិ ម្តងគត់ (A526)', () => {
    it('reload ក្រោយ admission (v2 · admitted) ➜ ក្រោយ grace App commit ៖ ប្រាក់ +10 ម្តង · settled · ចំណូលយករួចវាស់បាន', async () => {
        seed(row(10, marker(v2Token, 'admitted')));
        expect(collectedValueIsMeasurable()).toBe(false);
        expect(collectedValueIsMeasurable(DAY()), 'ថ្ងៃដែលការកែតម្លៃនៅជាប់ ➜ —').toBe(false);
        expect(collectedValueIsMeasurable(DAY().slice(0, 7)), 'ខែដែលការកែតម្លៃនៅជាប់ ➜ —').toBe(false);
        expect(collectedValueIsMeasurable('2001-01-01'), 'ថ្ងៃផ្សេងមិនប៉ះពាល់ ➜ វាស់បាន').toBe(true);
        expect(collectedValueIsMeasurable('2001-01'), 'ខែផ្សេងមិនប៉ះពាល់ ➜ វាស់បាន').toBe(true);
        await resume(); await settle();
        expect(serverRow().pricePending.phase, 'ក្នុង grace មិនទាន់ប៉ះ').toBe('admitted');
        await afterGrace();
        expect({ cod: serverRow().barcodes[0].cod, phase: serverRow().pricePending?.phase, outcome: serverRow().pricePending?.outcome, money: money() })
            .toEqual({ cod: 20, phase: 'settled', outcome: 'committed', money: [[20, 0, 1], [20, 0, 1]] });
        expect(rowOperationActive(serverRow())).toBe(false);
        expect(collectedValueIsMeasurable()).toBe(true);
        await afterGrace();
        expect(money(), 'ការ resume ម្តងទៀតមិនបូកទ្វេ').toEqual([[20, 0, 1], [20, 0, 1]]);
        expect(uiState.toasts.map((t: any) => t.msg).join(' | ')).toContain('បានបញ្ចប់ការកែតម្លៃដែលនៅរង់ចាំ');
    });

    it('reload ក្រោយ commit (v2 · history · ប្រាក់ចូលរួច) ➜ App settle ដោយមិនបូកម្តងទៀត', async () => {
        const m = marker(v2Token, 'history');
        seed(row(20, m), 20);
        await afterGrace();
        expect({ phase: serverRow().pricePending?.phase, outcome: serverRow().pricePending?.outcome, money: money() })
            .toEqual({ phase: 'settled', outcome: 'committed', money: [[20, 0, 1], [20, 0, 1]] });
    });

    it('reload ក្រោយ cancelling (v2) ➜ settle compensated · ប្រាក់ និងតម្លៃនៅដដែល', async () => {
        seed(row(10, marker(v2Token, 'cancelling')));
        await afterGrace();
        expect({ cod: serverRow().barcodes[0].cod, phase: serverRow().pricePending?.phase, outcome: serverRow().pricePending?.outcome, money: money() })
            .toEqual({ cod: 10, phase: 'settled', outcome: 'compensated', money: [[10, 0, 1], [10, 0, 1]] });
    });

    it('marker របស់គណនីផ្សេង ➜ មិនប៉ះ', async () => {
        seed(row(10, marker(v2Token, 'admitted', { actorUid: 'other' })));
        await afterGrace();
        expect({ phase: serverRow().pricePending.phase, money: money(), updates: lab.updates }).toEqual({ phase: 'admitted', money: [[10, 0, 1], [10, 0, 1]], updates: 0 });
    });

    it('marker ចាស់ (protocol មុន) ➜ resume មិនប៉ះ · ☰ ផ្លូវចេញម្ចាស់ ៖ admitted ➜ រក្សាតម្លៃចាស់ មិនកែប្រាក់ · Sentry money', async () => {
        seed(row(10, marker(legacyToken, 'admitted')), 20);
        await afterGrace();
        expect(serverRow().pricePending.phase).toBe('admitted');
        expect(viewState.priceOperationsStuck).toBe(1);
        expect(await resolvePriceOperations()).toBe(true);
        expect({ cod: serverRow().barcodes[0].cod, phase: serverRow().pricePending?.phase, outcome: serverRow().pricePending?.outcome, money: money() })
            .toEqual({ cod: 10, phase: 'settled', outcome: 'compensated', money: [[20, 0, 1], [20, 0, 1]] });
        expect((window as any).ZoeErrors.capture.mock.calls.map((call: any[]) => [call[1].zone, call[1].context, call[1].protocol, call[1].choice]))
            .toEqual([['money', 'settleStuckPriceOperations', 'legacy', 'compensated']]);
    });

    it('marker ចាស់ history ➜ ផ្លូវចេញ settle committed (rules មិនឲ្យត្រឡប់) មិនកែប្រាក់', async () => {
        seed(row(20, marker(legacyToken, 'history')), 10);
        await afterGrace();
        expect(await resolvePriceOperations()).toBe(true);
        expect({ cod: serverRow().barcodes[0].cod, phase: serverRow().pricePending?.phase, outcome: serverRow().pricePending?.outcome, money: money() })
            .toEqual({ cod: 20, phase: 'settled', outcome: 'committed', money: [[10, 0, 1], [10, 0, 1]] });
    });
});

describe('ការកែតម្លៃផ្ទាល់ ៖ ប្រាក់តាម commit atomic តែមួយ (A526)', () => {
    it('ជោគជ័យ ៖ ប្រាក់ +10 ម្តង · settled · update តែមួយដែលមានទាំងជួរ និង increment', async () => {
        await saveEditedBarcodePrice(); await settle();
        expect({ cod: serverRow().barcodes[0].cod, phase: serverRow().pricePending?.phase, money: money(), updates: lab.updates })
            .toEqual({ cod: 20, phase: 'settled', money: [[20, 0, 1], [20, 0, 1]], updates: 1 });
        expect(uiState.toasts.map((t: any) => t.msg).join(' | ')).toContain('ជោគជ័យ');
    });

    it('ចម្លើយបាត់ ប៉ុន្តែ commit ចុះ ➜ អាន server ឃើញ history ➜ បញ្ចប់ · ប្រាក់ម្តង', async () => {
        lab.commitFault = 'lost-landed';
        await saveEditedBarcodePrice(); await settle();
        expect({ phase: serverRow().pricePending?.phase, money: money() }).toEqual({ phase: 'settled', money: [[20, 0, 1], [20, 0, 1]] });
    });

    it('ចម្លើយបាត់ ហើយ commit មិនចុះ ➜ សោនៅ (⏳ App បញ្ចប់ខ្លួនឯង) · ប្រាក់មិនប្រែ ➜ resume ក្រោយ grace commit ម្តង', async () => {
        lab.commitFault = 'lost-not-landed';
        await saveEditedBarcodePrice(); await settle();
        expect({ phase: serverRow().pricePending?.phase, money: money() }).toEqual({ phase: 'admitted', money: [[10, 0, 1], [10, 0, 1]] });
        expect(uiState.toasts.map((t: any) => t.msg).join(' | ')).toContain('App នឹងបញ្ចប់ដោយស្វ័យប្រវត្តិ');
        lab.commitFault = '';
        syncView();
        await afterGrace();
        expect({ cod: serverRow().barcodes[0].cod, phase: serverRow().pricePending?.phase, money: money() })
            .toEqual({ cod: 20, phase: 'settled', money: [[20, 0, 1], [20, 0, 1]] });
    });

    it('ការដកលើសចំណូលថ្ងៃ ➜ មិនផ្ញើ commit · បោះបង់ (compensated) · តម្លៃ និងប្រាក់នៅដដែល · សារប្រាប់ថ្ងៃ', async () => {
        seed(row(10), 3);
        input('editBcCodInput', '0');
        await saveEditedBarcodePrice(); await settle();
        expect({ cod: serverRow().barcodes[0].cod, phase: serverRow().pricePending?.phase, outcome: serverRow().pricePending?.outcome, money: money(), refusals: lab.refusals })
            .toEqual({ cod: 10, phase: 'settled', outcome: 'compensated', money: [[3, 0, 1], [3, 0, 1]], refusals: 0 });
        expect(uiState.toasts.map((t: any) => t.msg).join(' | ')).toContain(DAY());
    });

    it('commit ដែលជួរបានចេញពី admitted (ឧបករណ៍ផ្សេងនៃគណនីដដែលបញ្ចប់រួច) ត្រូវបដិសេធ ➜ មិនបូកទ្វេ', async () => {
        seed(row(10, marker(v2Token, 'admitted')));
        const handle = (await import('../../../ZoeW/src/services/row-operation-lock')).priceOperationFromRow('itemI', serverRow())!;
        const [first, second] = await Promise.all([priceOperation.commitPriceOperation(handle, () => true), priceOperation.commitPriceOperation(handle, () => true)]);
        expect({ first, second, money: money(), refusals: lab.refusals, updates: lab.updates })
            .toEqual({ first: 'committed', second: 'committed', money: [[20, 0, 1], [20, 0, 1]], refusals: 1, updates: 2 });
        expect(await priceOperation.commitPriceOperation(handle, () => true), 'ការ commit ក្រោយ history មិនផ្ញើទៀត').toBe('committed');
        expect({ money: money(), updates: lab.updates }).toEqual({ money: [[20, 0, 1], [20, 0, 1]], updates: 2 });
    });

    it('ledger ដែលមាន float noise ពី increment មុន (0.009999999999999787) ➜ កែ 0.01 ➜ 0 ៖ commit ចុះ · ledger = 0 ពិតប្រាកដ · rules (≥ 0) ទទួល', async () => {
        const noisy = 5 + (0.01 - 5);
        expect(noisy).toBeLessThan(0.01);
        seed(row(0.01), noisy);
        input('editBcCodInput', '0');
        await saveEditedBarcodePrice(); await settle();
        expect({ cod: serverRow().barcodes[0].cod, outcome: serverRow().pricePending?.outcome, day: getAt(D + '/' + DAY()).codDollar,
            month: getAt(M + '/' + DAY().slice(0, 7)).codDollar, refusals: lab.refusals })
            .toEqual({ cod: 0, outcome: 'committed', day: 0, month: 0, refusals: 0 });
    });
});
