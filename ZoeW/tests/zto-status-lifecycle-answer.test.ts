// Owner-authorized locked-ZTO regression: a pre-restore status answer cannot supersede fresh restore verification.
// Only the upstream response and SDK data semantics are mocked; lifecycle operations create their own receipts.
import { it, expect, vi, afterEach } from 'vitest';
import { webcrypto } from 'node:crypto';
import { createScanMemorySdk } from './helpers/scan-memory-sdk';
import { dataState, firebaseState, uiState, ztoState } from '../src/core/state';
import { appLocalStore } from '../src/core/storage';
import { dbListenerFailedPaths, dbListenerPendingPaths } from '../src/core/text';
import { clearCustomerDataTableCache } from '../src/features/customer-table';
import { clearZtoPickupStatusStore, runZtoStatusSweep, ztoPickupStatus } from '../src/features/zto-status';
import { applyBarcodeCloseChange } from '../src/features/barcode-ops';
import { deleteSingleItem } from '../src/features/entry-ops';
import { executeRestoreItem } from '../src/features/restore';
import { buildHistoryRowModel } from '../src/app/components/history/rowModel';
const NOW = Date.UTC(2026, 9, 31, 4), H = 'zoew_scan_history_cod_dod', T = 'zoew_recently_deleted_cod_dod';
afterEach(() => { clearZtoPickupStatusStore(); vi.useRealTimers(); vi.unstubAllGlobals(); });
it.each([['restored', true], ['restored', false], ['unchanged', true], ['unchanged', false], ['session-change', true], ['open-restored', true], ['open-unchanged', true], ['closed-restored', true], ['metadata', true], ['metadata', false]] as const)('real public lifecycle %s with delayed signed=%s status', async (mode, signed) => {
    vi.stubGlobal('crypto', webcrypto);
    vi.stubGlobal('confirm', () => true);
    vi.stubGlobal('alert', () => { });
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    appLocalStore.clear();
    appLocalStore.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: 'https://audit.firebaseio.com' }));
    appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify({ enabled: true, fastMode: mode.startsWith('open-'), url: window.location.origin + '/.netlify/functions/zto-order-detail?barcode={barcode}' }));
    clearCustomerDataTableCache();
    clearZtoPickupStatusStore();
    dbListenerPendingPaths.clear();
    dbListenerFailedPaths.clear();
    const mem = createScanMemorySdk();
    const options = { databaseURL: 'https://audit.firebaseio.com' };
    firebaseState.auth = { currentUser: { uid: 'test' }, app: { options } } as any;
    firebaseState.db = { name: 'test', app: { options } } as any;
    firebaseState.fb = mem.sdk as any;
    firebaseState.serverTimeOffsetMs = 0;
    firebaseState.serverClockTrusted = true;
    firebaseState.isDatabaseConnected = true;
    firebaseState.isDatabaseInitialized = true;
    firebaseState.isInitializingFirebase = false;
    for (const [key, path] of Object.entries({ dbRefHistory: H, dbRefDeleted: T, dbRefDailyRevenue: 'zoew_daily_revenue_cod_dod', dbRefMonthlyRevenue: 'zoew_monthly_revenue_cod_dod', dbRefDailyPickup: 'zoew_daily_pickup_cod_dod', dbRefDailyCollected: 'zoew_daily_collected_cod_dod', dbRefRegistry: 'zoew_barcode_registry' }))
        (firebaseState as any)[key] = mem.sdk.ref(firebaseState.db, path);
    ztoState.ztoTrashMode = { state: 'ok', palmAt: 0, cookieAt: NOW, shop: 'https://audit.firebaseio.com' } as any;
    uiState.isModalOpen = false;
    uiState.toasts = [];
    dataState.deletedItems = [];
    dataState.dailyPickupData = {};
    dataState.dailyCollectedData = {};
    dataState.dailyRevenueData = { '2026-10-31': { codDollar: 5, dodDollar: 0, totalCount: 1 } } as any;
    dataState.monthlyRevenueData = { '2026-10': { codDollar: 5, dodDollar: 0, totalCount: 1 } } as any;
    mem.put('zoew_daily_revenue_cod_dod', dataState.dailyRevenueData);
    mem.put('zoew_monthly_revenue_cod_dod', dataState.monthlyRevenueData);
    const code = 'TEST123456';
    const seed = { id: 'row', scanDate: '2026-10-31', phone: '012345678', createdAt: NOW - 5000, time: '11:00', isClosed: false, count: 1, cod: 5, dod: 0, price: 5, barcodes: [{ code, cod: 5, dod: 0, isClosed: false, isDeducted: false, createdAt: NOW - 5000, time: '11:00' }] };
    mem.put(H + '/row', seed);
    dataState.scanHistory = [structuredClone(seed)] as any;
    const sync = () => { dataState.scanHistory = Object.entries(mem.get(H) || {}).map(([id, v]: any) => ({ ...v, id })); dataState.deletedItems = Object.entries(mem.get(T) || {}).map(([id, v]: any) => ({ ...v, id })); dataState.dailyPickupData = mem.get('zoew_daily_pickup_cod_dod') || {}; dataState.dailyCollectedData = mem.get('zoew_daily_collected_cod_dod') || {}; };
    if (!mode.startsWith('open-')) {
        expect(await applyBarcodeCloseChange('row', code, true, { silent: true, showModal: false })).toBe(true);
        sync();
    }
    ztoState.ztoSignedSweepAt = NOW;
    ztoState.ztoSignedSweepWaitMs = 30 * 60 * 1000;
    let answer: any;
    let started: any;
    const ready = new Promise(r => started = r);
    let restoreChecks = 0;
    vi.stubGlobal('fetch', async (target) => { const url = new URL(String(target)); if (url.searchParams.has('restore')) {
        restoreChecks++;
        return new Response(JSON.stringify({ barcode: code, cached: false, found: true, success: true, verifiedForRestore: true, ztoClosed: false }), { status: 200 });
    } if (url.searchParams.has('status')) {
        started();
        return await new Promise(r => answer = r);
    } throw new Error('Unexpected request ' + target); });
    const running = runZtoStatusSweep(!mode.startsWith('open-'));
    await ready;
    if (mode === 'restored' || mode === 'open-restored' || mode === 'closed-restored') {
        if (mode === 'restored') {
            expect(await applyBarcodeCloseChange('row', code, false, { silent: true, showModal: false })).toBe(true);
            sync();
        }
        expect(await deleteSingleItem('row', { confirmed: true, quiet: true })).toBe('deleted');
        sync();
        const trashId = dataState.deletedItems[0].id;
        vi.setSystemTime(NOW + 1000);
        uiState.pendingRestoreId = trashId;
        await executeRestoreItem();
        sync();
        expect(restoreChecks).toBe(1);
        expect(dataState.deletedItems).toHaveLength(0);
        expect(dataState.scanHistory).toHaveLength(1);
        const item = dataState.scanHistory[0];
        if (mode === 'closed-restored') {
            expect(item.barcodes[0].restoredAt).toBeUndefined();
            expect(item.barcodes[0].closedAt).toBe(NOW + 1000);
        } else expect(item.barcodes[0].restoredAt).toBe(NOW + 1000);
        if (mode === 'restored') {
            expect(await applyBarcodeCloseChange(item.id, code, true, { silent: true, showModal: false })).toBe(true);
            sync();
        }
    }
    if (mode === 'metadata') {
        const priorView = dataState.scanHistory[0];
        await mem.sdk.update(mem.sdk.ref(firebaseState.db, H + '/row'), { phone: '098765432', locker: 'B2' });
        sync();
        expect(dataState.scanHistory[0]).not.toBe(priorView);
        expect(dataState.scanHistory[0].phone).toBe('098765432');
    }
    if (mode === 'session-change')
        firebaseState.authGeneration++;
    uiState.isModalOpen = false;
    vi.setSystemTime(NOW + 2000);
    answer(new Response(JSON.stringify({ ztoClosed: signed, ztoSignedAt: NOW - 1000 }), { status: 200 }));
    await running;
    sync();
    if (mode.startsWith('open-')) expect(dataState.scanHistory[0].isClosed).toBe(mode === 'open-unchanged');
    const model = buildHistoryRowModel(dataState.scanHistory[0], 1, false, false);
    expect(model.reopenLocked, 'only current lifecycle evidence may lock the history-row reopen UI').toBe((mode === 'unchanged' || mode === 'open-unchanged' || mode === 'metadata') && signed);
    const verdict = ztoPickupStatus.get(code);
    if (mode === 'restored' || mode === 'open-restored' || mode === 'closed-restored')
        expect(verdict).toEqual({ closed: false, at: NOW + 1000 });
    else if (mode === 'session-change')
        expect(verdict).toBeUndefined();
    else
        expect(verdict).toMatchObject({ closed: signed, at: NOW + 2000 });
});
