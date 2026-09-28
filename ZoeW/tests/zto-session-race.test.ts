import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { refTo, setFieldValue } from '../src/app/refs';
import { dataState, firebaseState, uiState, ztoState } from '../src/core/state';
import { appLocalStore } from '../src/core/storage';
import { clearCustomerDataTableCache } from '../src/features/customer-table';
import { clearSensitiveModalFields } from '../src/features/session';
import { runZtoListSyncPreview } from '../src/features/zto-list-sync';
import { clearZtoPickupStatusStore, runZtoStatusSweep, ztoPickupStatus } from '../src/features/zto-status';

function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (reason: unknown) => void;
    const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
}

const item = { id: 'session-row', phone: '011222333', barcodes: [{ code: 'ZTO123456', isClosed: true }] };
const response = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
const listBody = { rows: [{ barcode: 'ZTO123456', phone: '011222333', cod: 5, dod: 0, at: '2026-09-27 10:00:00' }], pages: 1 };

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-27T10:00:00Z'));
    appLocalStore.clear();
    appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify({ enabled: true, fastMode: true,
        url: 'https://example.invalid/.netlify/functions/zto-order-detail?barcode={barcode}' }));
    clearCustomerDataTableCache();
    clearZtoPickupStatusStore();
    ztoState.ztoStatusInFlight = false;
    ztoState.ztoListSyncInFlight = false;
    ztoState.ztoListSyncResult = null;
    dataState.scanHistory = [];
    dataState.deletedItems = [];
    uiState.isModalOpen = false;
    firebaseState.authGeneration++;
    firebaseState.auth = { currentUser: { uid: 'audit-user' } } as any;
    firebaseState.fb = { getIdTokenResult: async () => ({ token: 'audit-token' }) } as any;
    for (const name of ['ztoListSyncFrom', 'ztoListSyncTo'] as const) {
        const input = document.createElement('input');
        input.value = '2026-09-27';
        refTo(name)(input);
    }
});

afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    appLocalStore.clear();
    refTo('ztoListSyncFrom')(null);
    refTo('ztoListSyncTo')(null);
});

describe('ZTO ៖ ចម្លើយយឺតត្រូវនៅក្នុងវគ្គដើម', () => {
    it('វគ្គដដែល ➜ ទទួលសាលក្រមធម្មតា', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => response({ ztoClosed: true })));
        expect(await runZtoStatusSweep(true, [item], [])).toBe(1);
        expect(ztoPickupStatus.size).toBe(1);
    });

    it('សម្អាតពេលចាកចេញ ➜ ចម្លើយយឺតមិនសរសេរសាលក្រមវិញ', async () => {
        const pending = deferred<Response>();
        const fetch = vi.fn(() => pending.promise);
        vi.stubGlobal('fetch', fetch);
        const running = runZtoStatusSweep(true, [item], []);
        await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
        clearSensitiveModalFields();
        pending.resolve(response({ ztoClosed: false }));
        await running;
        expect(ztoPickupStatus.size).toBe(0);
        expect(appLocalStore.getItem('zoew_zto_pickup_status_v1')).toBeNull();
    });

    it('ប្តូរ config ➜ ចម្លើយរបស់ config ចាស់ត្រូវបោះចោល', async () => {
        const pending = deferred<Response>();
        const fetch = vi.fn(() => pending.promise);
        vi.stubGlobal('fetch', fetch);
        const running = runZtoStatusSweep(true, [item], []);
        await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
        clearCustomerDataTableCache();
        pending.resolve(response({ ztoClosed: true }));
        await running;
        expect(ztoPickupStatus.size).toBe(0);
    });

    it('សម្អាតពេលចាកចេញ ➜ បញ្ជីអតិថិជនយឺតមិនត្រឡប់មក state', async () => {
        const pending = deferred<Response>();
        const fetch = vi.fn(() => pending.promise);
        vi.stubGlobal('fetch', fetch);
        const running = runZtoListSyncPreview();
        await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
        clearSensitiveModalFields();
        pending.resolve(response(listBody));
        await running;
        expect(ztoState.ztoListSyncResult).toBeNull();
        expect(ztoState.ztoListPreview).toBeNull();
    });

    it('ការបរាជ័យយឺតនៃវគ្គចាស់មិនដោះសោការទាញថ្មី', async () => {
        const old = deferred<Response>();
        const next = deferred<Response>();
        const fetch = vi.fn().mockImplementationOnce(() => old.promise).mockImplementationOnce(() => next.promise);
        vi.stubGlobal('fetch', fetch);
        const oldRun = runZtoListSyncPreview();
        await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
        clearSensitiveModalFields();
        setFieldValue('ztoListSyncFrom', '2026-09-27');
        setFieldValue('ztoListSyncTo', '2026-09-27');
        const nextRun = runZtoListSyncPreview();
        await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
        old.reject(new Error('old network failure'));
        await oldRun;
        expect(ztoState.ztoListSyncInFlight).toBe(true);
        next.resolve(response(listBody));
        await nextRun;
        expect(ztoState.ztoListSyncInFlight).toBe(false);
        expect(ztoState.ztoListSyncResult.rows).toHaveLength(1);
    });
});
