import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/app/refs', async (orig) => {
    const real: any = await orig();
    return { ...real, fieldValue: (name: string) => (name === 'editPhoneInput' ? '0972222222' : ''), setFieldValue: () => {}, focusField: () => {} };
});

import { dataState, firebaseState, uiState } from '../src/core/state';
import { pendingHistoryPatches } from '../src/core/clock';
import { patchHistoryItemFields } from '../src/services/history-write';
import { saveEditedPhone, setCallMark } from '../src/features/entry-ops';
import { DB_OP_TIMEOUT_MS } from '../src/services/network';

const savedFb = firebaseState.fb;
const texts = () => uiState.toasts.map((t: any) => t.msg);
const flush = async (n = 8) => { for (let i = 0; i < n; i++) await vi.advanceTimersByTimeAsync(0); };
let historyTx: { fn: any; resolve: (v: any) => void; reject: (e: any) => void } | null;
let pickupServer: any;
let capture: ReturnType<typeof vi.fn>;
const serverRow = () => ({ id: 'item1', phone: '0961111111', scanDate: '2026-10-07', barcodes: [{ code: 'ZTX0001', isClosed: true, closedAt: 1 }] });

beforeEach(() => {
    vi.useFakeTimers();
    uiState.toasts = [];
    historyTx = null;
    capture = vi.fn();
    (window as any).ZoeErrors = { capture };
    firebaseState.authGeneration = 1;
    firebaseState.db = { name: 'db' } as any;
    firebaseState.dbRefHistory = { path: 'zoew_scan_history_cod_dod' } as any;
    firebaseState.dbRefDailyPickup = { path: 'zoew_daily_pickup_cod_dod' } as any;
    firebaseState.dbLivenessProbe = Promise.resolve(null) as any;
    firebaseState.fb = {
        ref: (_db: any, path: string) => ({ path }),
        runTransaction: (ref: any, fn: any) => {
            if (String(ref.path).startsWith('zoew_scan_history_cod_dod/')) return new Promise((resolve, reject) => { historyTx = { fn, resolve, reject }; });
            pickupServer = fn(pickupServer);
            return Promise.resolve({ committed: true, snapshot: { val: () => pickupServer } });
        }
    } as any;
    dataState.scanHistory = [{ id: 'item1', phone: '0961111111', scanDate: '2026-10-07', cod: 8, dod: 0, price: 8, count: 1, isClosed: true, closedAt: 1,
        barcodes: [{ code: 'ZTX0001', cod: 8, dod: 0, isClosed: true, closedAt: 1, isDeducted: false, isFromDeletion: false }] }] as any;
    dataState.deletedItems = [];
    dataState.dailyPickupData = { '2026-10-07': { packagesPickedUp: 1, pickedUpPhones: { '0961111111': 1 }, pickedUpBarcodes: { ZTX0001: '0961111111' } } } as any;
    pickupServer = JSON.parse(JSON.stringify(dataState.dailyPickupData['2026-10-07']));
    uiState.editingItemId = 'item1';
    uiState.markingItemId = 'item1';
    pendingHistoryPatches.clear();
});
afterEach(() => { firebaseState.fb = savedFb; delete (window as any).ZoeErrors; vi.clearAllTimers(); vi.useRealTimers(); });

async function stall(p: Promise<any>) {
    await flush();
    expect(historyTx).not.toBeNull();
    await vi.advanceTimersByTimeAsync(DB_OP_TIMEOUT_MS + 5);
    return p;
}
function commitLate(row: any = serverRow()) {
    const value = historyTx!.fn(row);
    historyTx!.resolve({ committed: true, snapshot: { val: () => value } });
    return value;
}

describe('history patch that outlives its ceiling (SENTRY-1) ៖ pending while the transaction lives, decided when it settles', () => {
    it('1. stall ➜ «pending» · ⏳ · memory keeps the new value · no failure, no Sentry ➜ late commit ➜ one ✅', async () => {
        const item = dataState.scanHistory[0];
        item.callMark = 'called';
        const result = await stall(patchHistoryItemFields(item, { callMark: 'called', callMarkTime: 123 }, { callMark: undefined, callMarkTime: undefined }, null, { retryOnDisconnect: true, queuedSuccessToast: '✅ late-ok' }));
        expect(result).toBe('pending');
        expect(texts().some((t) => /^⏳/.test(t))).toBe(true);
        expect(texts().filter((t) => /បរាជ័យ/.test(t)).length).toBe(0);
        expect(capture).not.toHaveBeenCalled();
        expect(item.callMark).toBe('called');
        const value = commitLate();
        await flush();
        expect(value.callMark).toBe('called');
        expect(item.callMark).toBe('called');
        expect(texts().filter((t) => t === '✅ late-ok').length).toBe(1);
    });

    it('2. stall ➜ the transaction fails later ➜ memory reverted · failure toast · Sentry', async () => {
        const item = dataState.scanHistory[0];
        item.callMark = 'called';
        const result = await stall(patchHistoryItemFields(item, { callMark: 'called' }, { callMark: undefined }, null, {}));
        expect(result).toBe('pending');
        historyTx!.reject(new Error('permission_denied'));
        await flush();
        expect(item.callMark).toBeUndefined();
        expect(texts().some((t) => /បរាជ័យ/.test(t))).toBe(true);
        expect(capture).toHaveBeenCalled();
    });

    it('3. stall ➜ late commit finds the item gone ➜ memory reverted · «no longer in the system»', async () => {
        const item = dataState.scanHistory[0];
        item.callMark = 'called';
        await stall(patchHistoryItemFields(item, { callMark: 'called' }, { callMark: undefined }, null, {}));
        const value = historyTx!.fn(null);
        historyTx!.resolve({ committed: true, snapshot: { val: () => value } });
        await flush();
        expect(item.callMark).toBeUndefined();
        expect(texts().some((t) => /លែងមាន/.test(t))).toBe(true);
    });

    it('4. a newer choice made while pending survives a late failure', async () => {
        const item = dataState.scanHistory[0];
        item.callMark = 'called';
        await stall(patchHistoryItemFields(item, { callMark: 'called' }, { callMark: undefined }, null, {}));
        item.callMark = 'no-answer';
        historyTx!.reject(new Error('permission_denied'));
        await flush();
        expect(item.callMark).toBe('no-answer');
    });

    it('5. a session switch before the late answer ➜ nothing touched, no toast', async () => {
        const item = dataState.scanHistory[0];
        item.callMark = 'called';
        await stall(patchHistoryItemFields(item, { callMark: 'called' }, { callMark: undefined }, null, { queuedSuccessToast: '✅ late-ok' }));
        const before = texts().length;
        firebaseState.authGeneration++;
        historyTx!.reject(new Error('permission_denied'));
        await flush();
        expect(item.callMark).toBe('called');
        expect(texts().length).toBe(before);
    });

    it('6. setCallMark ៖ no ✅ while pending · exactly one ✅ after the late commit', async () => {
        const out = await stall(setCallMark('no-answer'));
        expect(out).toBe('pending');
        expect(texts().filter((t) => /^✅/.test(t)).length).toBe(0);
        commitLate();
        await flush();
        expect(texts().filter((t) => /^✅/.test(t)).length).toBe(1);
        expect(dataState.scanHistory[0].callMark).toBe('no-answer');
    });

    it('7. saveEditedPhone ៖ pickup ownership stays on the new phone while pending ➜ late commit keeps it · ✅', async () => {
        const out = await stall(saveEditedPhone());
        expect(out).toBe('pending');
        expect(pickupServer.pickedUpBarcodes.ZTX0001).toBe('0972222222');
        const value = commitLate();
        await flush();
        expect(value.phone).toBe('0972222222');
        expect(pickupServer.pickedUpBarcodes.ZTX0001).toBe('0972222222');
        expect(texts().filter((t) => /^✅/.test(t)).length).toBe(1);
    });

    it('8. saveEditedPhone ៖ late failure ➜ phone and pickup ownership return to the old phone', async () => {
        await stall(saveEditedPhone());
        historyTx!.reject(new Error('permission_denied'));
        await flush();
        expect(dataState.scanHistory[0].phone).toBe('0961111111');
        expect(pickupServer.pickedUpBarcodes.ZTX0001).toBe('0961111111');
    });
});
