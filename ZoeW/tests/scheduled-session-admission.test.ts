import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { dataState, firebaseState } from '../src/core/state';
import { acceptServerClockOffset, resetServerClock } from '../src/core/clock';
import { dbListenerFailedPaths, dbListenerPendingPaths } from '../src/core/text';
import { runAutomaticCollectedCleanup } from '../src/domain/collected';
import { autoCloseBarcodeFromZto } from '../src/features/zto-status';
import { claimAndCleanupItem, cleanupInFlight, runAutomaticDeletedCleanup, trashRetentionMs } from '../src/domain/cleanup';
import * as barcodeOps from '../src/features/barcode-ops';
import * as purge from '../src/services/registry-purge';

beforeEach(() => {
    localStorage.clear(); resetServerClock();
    firebaseState.db = {} as any;
    firebaseState.auth = { currentUser: { uid: 'u' } } as any;
    firebaseState.serverClockTrusted = true;
    firebaseState.isDatabaseConnected = true;
    firebaseState.sessionExpiryCheck = 'unverified';
    firebaseState.dbRefDailyCollected = {} as any;
    firebaseState.fb = { update: vi.fn(async () => {}), ref: vi.fn(() => ({})), runTransaction: vi.fn(async () => ({ committed: false })) } as any;
    dataState.dailyCollectedData = { '2020-01-01': { totalCount: 1 } };
    dataState.scanHistory = []; dataState.deletedItems = []; dataState.deletedCleanupInFlight = false;
    cleanupInFlight.clear(); dbListenerFailedPaths.clear(); dbListenerPendingPaths.clear();
    localStorage.setItem('zoew_lookup_api_config', JSON.stringify({ enabled: true, fastMode: true, url: 'https://zoew.example/.netlify/functions/zto-order-detail' }));
});
afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); });

function interval(now: number) {
    vi.spyOn(Date, 'now').mockReturnValue(now); vi.spyOn(performance, 'now').mockReturnValue(1000);
    resetServerClock();
    expect(acceptServerClockOffset(0, Object.freeze({ epochMs: now - 1000, estimateEpochMs: now,
        uncertaintyMs: 2000, wallMs: now, monotonicMs: 1000 }), false)).toBe(true);
    firebaseState.sessionExpiryCheck = 'live';
}

it('ចន្លោះម៉ោងកាត់អធ្រាត្រមិនលុបថ្ងៃចំណូលមុនកំណត់', () => {
    interval(Date.UTC(2026, 10, 8, 17) + 500);
    dataState.dailyCollectedData = { '2026-11-02': { ONE: { c: 5, d: 0 } } };
    runAutomaticCollectedCleanup();
    expect(firebaseState.fb!.update).not.toHaveBeenCalled();
});

it('ចន្លោះអាយុលុបធុងសំរាមរង់ចាំ រួចអនុញ្ញាតតែចាស់ប្រាកដ', async () => {
    const now = Date.UTC(2026, 10, 8, 9); interval(now);
    const remove = vi.spyOn(purge, 'purgeTrashWithRegistry').mockResolvedValue(false);
    const item = { id: 'row', trashReason: 'pickup', deletedAt: 1, barcodes: [] };
    item.deletedAt = now - trashRetentionMs(item) - 500;
    dataState.deletedItems = [item] as any;
    await runAutomaticDeletedCleanup(); expect(remove).not.toHaveBeenCalled();
    item.deletedAt -= 1000;
    await runAutomaticDeletedCleanup(); expect(remove).toHaveBeenCalledTimes(1);
});

it('ចំណូលចាស់នៅដដែលរហូតដល់សម័យបានផ្ទៀងផ្ទាត់', () => {
    runAutomaticCollectedCleanup();
    expect(firebaseState.fb!.update).not.toHaveBeenCalled();
    firebaseState.sessionExpiryCheck = 'live';
    runAutomaticCollectedCleanup();
    expect(firebaseState.fb!.update).toHaveBeenCalledWith(firebaseState.dbRefDailyCollected, { '2020-01-01': null });
});

it('ការបិទ ZTO ថ្មីរង់ចាំសម័យ ប៉ុន្តែបន្តក្រោយផ្ទៀងផ្ទាត់', async () => {
    const close = vi.spyOn(barcodeOps, 'applyBarcodeCloseChange').mockResolvedValue(true);
    const entry = { itemId: 'row', code: 'ZT123456' };
    const rows = [{ id: 'row', barcodes: [{ code: entry.code, isClosed: false }] }];
    await autoCloseBarcodeFromZto(entry, rows);
    expect(close).not.toHaveBeenCalled();
    firebaseState.sessionExpiryCheck = 'live';
    expect(await autoCloseBarcodeFromZto(entry, rows)).toBe(true);
    expect(close).toHaveBeenCalledTimes(1);
});

it('ការសម្អាតថ្មីរង់ចាំសម័យ ហើយបន្តក្រោយផ្ទៀងផ្ទាត់', async () => {
    await claimAndCleanupItem('row', 'abandon');
    expect(firebaseState.fb!.runTransaction).not.toHaveBeenCalled();
    firebaseState.sessionExpiryCheck = 'live';
    await claimAndCleanupItem('row', 'abandon');
    expect(firebaseState.fb!.runTransaction).toHaveBeenCalledTimes(1);
});

it('ការលុបធុងសំរាមចាស់រង់ចាំសម័យ ហើយបន្តក្រោយផ្ទៀងផ្ទាត់', async () => {
    const remove = vi.spyOn(purge, 'purgeTrashWithRegistry').mockResolvedValue(false);
    dataState.deletedItems = [{ id: 'row', deletedAt: 1, barcodes: [] }] as any;
    await runAutomaticDeletedCleanup();
    expect(remove).not.toHaveBeenCalled();
    firebaseState.sessionExpiryCheck = 'live';
    await runAutomaticDeletedCleanup();
    expect(remove).toHaveBeenCalledTimes(1);
});

it('បញ្ចប់លទ្ធផលលុបដែលបានផ្ញើរួច ប៉ុន្តែមិនចាប់ផ្តើមកញ្ចប់បន្ទាប់ក្រោយសម័យបាត់ការផ្ទៀងផ្ទាត់', async () => {
    firebaseState.sessionExpiryCheck = 'live';
    const remove = vi.spyOn(purge, 'purgeTrashWithRegistry').mockImplementation(async () => {
        firebaseState.sessionExpiryCheck = 'unverified';
        return true;
    });
    dataState.deletedItems = [{ id: 'row1', deletedAt: 1, barcodes: [] }, { id: 'row2', deletedAt: 1, barcodes: [] }] as any;
    await runAutomaticDeletedCleanup();
    expect(remove).toHaveBeenCalledTimes(1);
    expect(dataState.deletedItems.map(row => row.id)).toEqual(['row2']);
});
