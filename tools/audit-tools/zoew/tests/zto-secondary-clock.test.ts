import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { acceptServerClockOffset, getServerClockBounds, resetServerClock } from '../../../../ZoeW/src/core/clock';
import { firebaseState, ztoState } from '../../../../ZoeW/src/core/state';
import { appLocalStore } from '../../../../ZoeW/src/core/storage';
import { ZTO_AUTOCLOSE_KEY } from '../../../../ZoeW/src/core/storage-keys';
import { ztoScanStampMillis } from '../../../../ZoeW/src/core/timezone';
import { classifyZtoListRows, importZtoListRows } from '../../../../ZoeW/src/features/zto-list-sync';
import * as lists from '../../../../ZoeW/src/features/zto-list-sync';
import { closeZtoSignedBarcodes, ztoAbandonCleanupIsHeld, ZTO_ABANDON_HOLD_MAX_MS } from '../../../../ZoeW/src/features/zto-status';
import { markZtoShopSweep, noteZtoShopSweep, ztoShopSweepHolds, ZTO_SHOP_SWEEP_ACTIVE_MS, ZTO_SHOP_SWEEP_MARK_GAP_MS } from '../../../../ZoeW/src/services/zto-shop-sweep';

const NOW = Date.UTC(2026, 9, 20, 5);
const DAY = 86400000;
function sample(lower = NOW - 100, upper = NOW + 100) {
    acceptServerClockOffset(1, { epochMs: lower, estimateEpochMs: NOW, uncertaintyMs: upper - lower, wallMs: Date.now(), monotonicMs: performance.now() }, false);
}
beforeEach(() => {
    vi.useFakeTimers(); vi.setSystemTime(NOW);
    firebaseState.db = {} as any;
    firebaseState.fb = { update: vi.fn().mockResolvedValue(undefined) } as any;
    firebaseState.dbRefZtoSignedSweep = {} as any;
    resetServerClock(); sample();
    ztoState.ztoSignedCompleteAt = 0; ztoState.ztoSignedCompleteServerAt = 0;
    ztoState.ztoSignedMismatchFrom = ''; ztoState.ztoSignedSweepOkAt = 0;
    ztoState.ztoShopSweep = { state: 'ok', activeAt: 0, completeAt: 0, advancedAt: 0, failedAt: 0 };
    ztoState.ztoShopSweepWrote = { activeAt: 0, completeAt: 0 };
});
afterEach(() => { resetServerClock(); vi.useRealTimers(); vi.unstubAllGlobals(); appLocalStore.removeItem(ZTO_AUTOCLOSE_KEY); });
const row = (days: number) => ({ barcode: 'ZTO123456789', phone: '081000001', at: new Date(NOW - days * DAY).toISOString().slice(0, 19).replace('T', ' '), cod: 1, dod: 0 });

it.each([7, 30])('មិនបដិសេធកញ្ចប់នៅព្រំអាយុ %s ថ្ងៃ ហើយរក្សាម៉ោង ZTO', (days) => {
    const raw = { ...row(days), ztoClosed: days === 30 ? true : null };
    const stamp = ztoScanStampMillis(raw.at);
    vi.setSystemTime(stamp + days * DAY + 50); resetServerClock();
    acceptServerClockOffset(1, { epochMs: stamp + days * DAY - 50, estimateEpochMs: stamp + days * DAY + 50, uncertaintyMs: 200, wallMs: Date.now(), monotonicMs: performance.now() }, false);
    const groups = classifyZtoListRows([raw], [], []);
    expect(groups.skipped).toHaveLength(0);
    expect(groups.fresh[0].stampMs).toBe(stamp);
    expect(groups.fresh[0].at).toBe(raw.at);
});
it('រក្សាម៉ោង Sign នៅព្រំ ៣០ ថ្ងៃ', () => {
    const raw = row(30); const stamp = ztoScanStampMillis(raw.at);
    vi.setSystemTime(stamp + 30 * DAY + 50); resetServerClock();
    acceptServerClockOffset(1, { epochMs: stamp + 30 * DAY - 50, estimateEpochMs: stamp + 30 * DAY + 50, uncertaintyMs: 200, wallMs: Date.now(), monotonicMs: performance.now() }, false);
    const groups = classifyZtoListRows([], [], [], [raw], { from: raw.at.slice(0,10), to: raw.at.slice(0,10) });
    expect(groups.skipped).toHaveLength(0); expect(groups.fresh[0].signedAt).toBe(raw.at);
});
it('បញ្ឈប់ការបញ្ចូលពេលគ្មានម៉ោងទុកចិត្ត មុនសួរបញ្ជាក់', async () => {
    ztoState.ztoListSyncInFlight = false; ztoState.ztoListSyncResult = { rows: [row(1)] } as any;
    const confirm = vi.fn(() => false); vi.stubGlobal('confirm', confirm);
    resetServerClock(); await importZtoListRows(); expect(confirm).not.toHaveBeenCalled();
});
it('រង់ចាំពេលអាយុសកម្មភាពមិនច្បាស់ និងពេលគ្មានម៉ោង', () => {
    noteZtoShopSweep({ activeAt: NOW - ZTO_SHOP_SWEEP_ACTIVE_MS - 50 });
    expect(ztoShopSweepHolds(NOW)).toBe(true);
    resetServerClock(); expect(ztoShopSweepHolds(NOW)).toBe(true);
});
it('មិនបាត់សកម្មភាពដែលនៅក្នុងព្រំអនាគត', () => {
    const at = NOW + ZTO_SHOP_SWEEP_MARK_GAP_MS + 50;
    noteZtoShopSweep({ activeAt: at }); expect(ztoState.ztoShopSweep.activeAt).toBe(at);
});
it('មិនយកត្រាពីឧបករណ៍ចាស់ជាភស្តុតាងពេលច្បាស់', () => {
    noteZtoShopSweep({ activeAt: NOW, completeAt: NOW + 50 });
    expect(ztoShopSweepHolds(NOW)).toBe(true);
});
it('អាយុផុតច្បាស់បញ្ចប់ការរង់ចាំ ហើយអនាគតហួសកំណត់ត្រូវបដិសេធ', () => {
    noteZtoShopSweep({ activeAt: NOW - ZTO_SHOP_SWEEP_ACTIVE_MS - 101 }); expect(ztoShopSweepHolds(NOW)).toBe(false);
    noteZtoShopSweep({ activeAt: NOW + ZTO_SHOP_SWEEP_MARK_GAP_MS + 101 }); expect(ztoState.ztoShopSweep.activeAt).toBe(0);
});
it.each(['stable', 'replacement', 'expired'])('ត្រាអាន Sign តាមព្រំពេលទុកចិត្ត៖ %s', async (mode) => {
    const lower = getServerClockBounds()!.lowerMs;
    vi.spyOn(lists, 'fetchZtoSignedCodes').mockImplementation(async () => {
        if (mode === 'replacement') { resetServerClock(); sample(); }
        if (mode === 'expired') resetServerClock();
        return { measured: true, codes: [], partial: false, truncated: false } as any;
    });
    await closeZtoSignedBarcodes({}, [{ key: 'A', code: 'A', itemId: 'a' }], [], false, [], 0,
        { refresh() {}, current: () => true, identity: () => null });
    expect(ztoState.ztoSignedCompleteServerAt).toBe(mode === 'stable' ? lower : 0);
    await Promise.resolve();
    const patches = vi.mocked(firebaseState.fb.update).mock.calls.map(call => call[1] as any);
    expect(patches.every(patch => !patch.completeAt || mode === 'stable' && patch.completeAt === lower)).toBe(true);
});

it('ត្រារួមដែលកើនជាបន្តបន្ទាប់មិនបន្តការរង់ចាំរហូត', () => {
    appLocalStore.setItem(ZTO_AUTOCLOSE_KEY, '0');
    ztoState.ztoSignedOff = false;
    ztoState.ztoAbandonHoldSince = NOW;
    ztoState.ztoAbandonCheckedAt = NOW;
    for (let elapsed = 60000; elapsed <= ZTO_ABANDON_HOLD_MAX_MS + 60000; elapsed += 60000) {
        vi.setSystemTime(NOW + elapsed);
        resetServerClock();
        acceptServerClockOffset(1, { epochMs: Date.now(), uncertaintyMs: 0, wallMs: Date.now(), monotonicMs: performance.now() }, false);
        noteZtoShopSweep({ activeAt: Date.now(), completeAt: Date.now() - 1 });
        expect(ztoAbandonCleanupIsHeld(NOW)).toBe(elapsed <= ZTO_ABANDON_HOLD_MAX_MS);
    }
});

it('ពិដានរង់ចាំផុត តែពេលទុំមិនច្បាស់ ឬម៉ោងបាត់ ➜ នៅរង់ចាំ', () => {
    appLocalStore.setItem(ZTO_AUTOCLOSE_KEY, '0');
    ztoState.ztoSignedOff = false;
    ztoState.ztoAbandonHoldSince = NOW - ZTO_ABANDON_HOLD_MAX_MS - 1000;
    ztoState.ztoAbandonCheckedAt = NOW;
    noteZtoShopSweep({ activeAt: NOW });
    expect(ztoAbandonCleanupIsHeld(NOW - ZTO_ABANDON_HOLD_MAX_MS - 50)).toBe(true);
    resetServerClock();
    expect(ztoAbandonCleanupIsHeld(NOW - ZTO_ABANDON_HOLD_MAX_MS - 1000)).toBe(true);
});

it('គ្មានម៉ោងទុកចិត្ត មិនបោះពុម្ពសកម្មភាពហាង', async () => {
    const update = vi.mocked(firebaseState.fb.update);
    resetServerClock();
    expect(markZtoShopSweep(0)).toBe(false);
    await Promise.resolve();
    expect(update).not.toHaveBeenCalled();
    expect(ztoState.ztoShopSweepWrote).toEqual({ activeAt: 0, completeAt: 0 });
});
it.each(['clock', 'expired', 'auth', 'database', 'ref', 'sdk', 'session'])('ប្តូរ %s មុន microtask មិនបោះពុម្ពសញ្ញាហាង', async (change) => {
    const update = vi.mocked(firebaseState.fb.update);
    const lower = getServerClockBounds()!.lowerMs;
    expect(markZtoShopSweep(lower)).toBe(true);
    if (change === 'clock') { resetServerClock(); sample(); }
    if (change === 'expired') resetServerClock();
    if (change === 'auth') firebaseState.authGeneration++;
    if (change === 'database') firebaseState.db = {} as any;
    if (change === 'ref') firebaseState.dbRefZtoSignedSweep = {} as any;
    if (change === 'sdk') firebaseState.fb = { update: vi.fn() } as any;
    if (change === 'session') ztoState.ztoSessionGeneration++;
    await Promise.resolve();
    expect(update).not.toHaveBeenCalled();
    expect(ztoState.ztoShopSweepWrote).toEqual({ activeAt: 0, completeAt: 0 });
});
it('បោះពុម្ពសញ្ញាទុកចិត្តតែម្តង រក្សាម៉ោងសកម្មភាពនិងព្រំអាន', async () => {
    const update = vi.mocked(firebaseState.fb.update);
    const lower = getServerClockBounds()!.lowerMs;
    expect(markZtoShopSweep(lower)).toBe(true);
    expect(markZtoShopSweep(lower)).toBe(false);
    await Promise.resolve();
    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith(firebaseState.dbRefZtoSignedSweep, { activeAt: NOW, completeAt: lower });
});
