import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { dataState, firebaseState, ztoState } from '../../../../ZoeW/src/core/state';
import { acceptServerClockOffset, getServerNow, resetServerClock, serverClockIsTrustworthy, setServerClockRefresh } from '../../../../ZoeW/src/core/clock';
import { appLocalStore } from '../../../../ZoeW/src/core/storage';
import { ZTO_STATUS_STORE_KEY } from '../../../../ZoeW/src/core/storage-keys';
import { barcodeCloseIsRipe } from '../../../../ZoeW/src/domain/barcode';
import { autoCloseBarcodeFromZto, checkZtoStatusForBarcode, closeZtoSignedBarcodes, getZtoPickupVerdict, loadZtoPickupStatusOnce, saveZtoPickupStatus, setZtoPickupVerdict, ztoPickupStatus } from '../../../../ZoeW/src/features/zto-status';
import { collectZtoFinalTargets, noteZtoReturnedEvidence, resetZtoFinalMarks, syncZtoFinalMarks, ztoReturnedEvidence, pruneZtoReturnedEvidence, ZTO_FINAL_RETURNED_MAX, ZTO_FINAL_RETURNED_TTL_MS } from '../../../../ZoeW/src/features/zto-final-marks';
import * as listSync from '../../../../ZoeW/src/features/zto-list-sync';
import * as barcodeOps from '../../../../ZoeW/src/features/barcode-ops';

const START = Date.UTC(2026, 10, 8), HOUR = 3600000, PATH = 'zoew_scan_history_cod_dod/row';
let mono: number, server: Record<string, any>, beforeWrite: (() => void) | undefined, afterWrite: (() => void) | undefined, updates: any[];
function seed(id = 'row') {
    const row = { id, createdAt: START - 4 * HOUR, isClosed: true, barcodes: [{ code: id, createdAt: START - 4 * HOUR, isClosed: true, closedAt: START - HOUR }] };
    dataState.scanHistory.push(row as any); server['zoew_scan_history_cod_dod/' + id] = structuredClone(row);
}
function suspend() { vi.setSystemTime(START + 3 * HOUR); expect(serverClockIsTrustworthy()).toBe(false); }
function resample(now = START + 3 * HOUR) {
    mono++; vi.setSystemTime(now); expect(acceptServerClockOffset(0, null, false)).toBe(true); firebaseState.sessionExpiryCheck = 'live';
}
function reload() { saveZtoPickupStatus(); ztoPickupStatus.clear(); ztoState.ztoStatusLoaded = false; loadZtoPickupStatusOnce(); }
beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] }); vi.setSystemTime(START); mono = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => mono);
    appLocalStore.clear(); resetZtoFinalMarks(); resetServerClock(); setServerClockRefresh(null);
    firebaseState.db = {} as any; firebaseState.auth = { currentUser: { uid: 'fixture' } } as any; firebaseState.authGeneration++;
    firebaseState.isDatabaseConnected = true; firebaseState.hasEverConnectedToDatabase = true;
    expect(acceptServerClockOffset(0, null, false)).toBe(true); firebaseState.sessionExpiryCheck = 'live';
    ztoPickupStatus.clear(); ztoState.ztoStatusLoaded = true; dataState.scanHistory = []; dataState.deletedItems = [];
    server = {}; updates = []; beforeWrite = undefined; afterWrite = undefined;
    firebaseState.fb = {
        ref: (_db, path) => ({ path }),
        runTransaction: vi.fn(async (ref, update) => {
            beforeWrite?.(); const next = update(structuredClone(server[ref.path])); updates.push(next);
            if (next !== undefined) server[ref.path] = next;
            afterWrite?.(); return { committed: next !== undefined, snapshot: { val: () => next } };
        })
    } as any;
    seed();
});
afterEach(() => { resetZtoFinalMarks(); resetServerClock(); vi.useRealTimers(); vi.unstubAllGlobals(); });

it.each([START + 3 * HOUR, '2026-11-08 10:00:00'])('Sign %s ក្រោយផ្អាក៖ រក្សាពេលដើមរហូតម៉ោងផ្ទៀង រួចរាប់២ម៉ោងពេញ', async raw => {
    suspend(); setZtoPickupVerdict('row', true, raw);
    expect(ztoPickupStatus.get('ROW').signedAtPending).toBe(raw);
    expect(collectZtoFinalTargets()).toEqual([]); expect(await syncZtoFinalMarks()).toBe(0); expect(firebaseState.fb!.runTransaction).not.toHaveBeenCalled();
    reload(); expect(ztoPickupStatus.get('ROW').signedAtPending).toBe(raw);
    expect(JSON.parse(appLocalStore.getItem(ZTO_STATUS_STORE_KEY)!).ROW.signedAtPending).toBe(raw);
    resample(); expect(await syncZtoFinalMarks()).toBe(1);
    const saved = server[PATH].barcodes[0];
    expect(saved).toMatchObject({ ztoSignedAt: START + 3 * HOUR, ztoSignedExact: true });
    expect(barcodeCloseIsRipe(saved, getServerNow(), 'palm')).toBe(false);
    expect(barcodeCloseIsRipe(saved, saved.ztoSignedAt + 2 * HOUR - 1, 'palm')).toBe(false);
    expect(barcodeCloseIsRipe(saved, saved.ztoSignedAt + 2 * HOUR, 'palm')).toBe(true);
});
it.each([undefined, null, '', 'bad', NaN, -1, Infinity])('Sign គ្មានពេលត្រឹមត្រូវ %s៖ fallback ចាប់ពីម៉ោងដែលផ្ទៀងរួច', async raw => {
    suspend(); setZtoPickupVerdict('row', true, raw); reload(); expect(ztoPickupStatus.get('ROW').signedAt).toBeFalsy();
    expect(await syncZtoFinalMarks()).toBe(0); resample(); expect(await syncZtoFinalMarks()).toBe(1);
    expect(server[PATH].barcodes[0].ztoSignedAt).toBe(START + 3 * HOUR); expect(server[PATH].barcodes[0].ztoSignedExact).toBeUndefined();
});
it('Sign ផ្ទៀងរួចនៅដដែល បើចម្លើយបន្ទាប់គ្មានពេលពិត', async () => {
    setZtoPickupVerdict('row', true, START - 60000); suspend(); setZtoPickupVerdict('row', true); reload(); resample(); await syncZtoFinalMarks();
    expect(server[PATH].barcodes[0]).toMatchObject({ ztoSignedAt: START - 60000, ztoSignedExact: true });
});
it('ពេលអនាគតដែលពន្យារទុក ត្រូវផ្ទៀងម្តងទៀត មុនប្រើជាភស្តុតាងពិត', async () => {
    suspend(); setZtoPickupVerdict('row', true, START + 10 * HOUR); reload(); resample(); await syncZtoFinalMarks();
    expect(getZtoPickupVerdict('row')).toMatchObject({ signedAt: START + 3 * HOUR, signedAtExact: false });
    expect(server[PATH].barcodes[0].ztoSignedAt).toBe(START + 3 * HOUR); expect(server[PATH].barcodes[0].ztoSignedExact).toBeUndefined();
});
it('ពេល Sign ដែលផ្អាកនៅដដែល ទោះចម្លើយគ្មានពេលមកម្តងទៀត', async () => {
    suspend(); setZtoPickupVerdict('row', true, START + 3 * HOUR); setZtoPickupVerdict('row', true); reload(); resample(); await syncZtoFinalMarks();
    expect(server[PATH].barcodes[0]).toMatchObject({ ztoSignedAt: START + 3 * HOUR, ztoSignedExact: true });
});
it.each(['lost', 'resampled'])('transaction %s៖ ការផ្ទៀងថ្មីមិនអនុញ្ញាត callback ចាស់សរសេរពេលចាស់', async mode => {
    setZtoPickupVerdict('row', true); beforeWrite = () => { suspend(); if (mode === 'resampled') resample(); };
    expect(await syncZtoFinalMarks()).toBe(0); expect(updates).toEqual([undefined]); expect(server[PATH].barcodes[0].ztoSignedAt).toBeUndefined();
});
it('ការសរសេរដែលបានបញ្ជាក់រួចរក្សាទុក ប៉ុន្តែកញ្ចប់បន្ទាប់រង់ចាំផ្ទៀងម៉ោង', async () => {
    seed('second'); setZtoPickupVerdict('row', true); setZtoPickupVerdict('second', true); afterWrite = () => { suspend(); resample(); };
    await syncZtoFinalMarks(); expect(firebaseState.fb!.runTransaction).toHaveBeenCalledTimes(1);
    expect(server[PATH].barcodes[0].ztoSignedAt).toBe(START); expect(server['zoew_scan_history_cod_dod/second'].barcodes[0].ztoSignedAt).toBeUndefined();
});
it.each([START + 3 * HOUR, '2026-11-08 10:00:00'])('ចម្លើយ detail %s រក្សាពេលដើម មិនបាត់នៅពេលម៉ោងមិនទាន់ផ្ទៀង', async raw => {
    vi.stubGlobal('fetch', vi.fn(async () => { suspend(); return new Response(JSON.stringify({ ztoClosed: true, ztoSignedAt: raw })); }));
    const answer = await checkZtoStatusForBarcode({ url: 'https://example.test/status?barcode={barcode}' }, 'row'); expect(answer?.signedAt).toBe(raw);
});
it('បិទ ZTO ថ្មីរង់ចាំសម័យផ្ទៀងផ្ទាត់', async () => {
    appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify({ enabled: true, fastMode: true, url: 'https://zoew.example/.netlify/functions/zto-order-detail' }));
    const close = vi.spyOn(barcodeOps, 'applyBarcodeCloseChange').mockResolvedValue(true);
    const rows = [{ id: 'open', barcodes: [{ code: 'open', isClosed: false }] }]; firebaseState.sessionExpiryCheck = 'unverified';
    expect(await autoCloseBarcodeFromZto({ itemId: 'open', code: 'open' }, rows)).toBe(false); expect(close).not.toHaveBeenCalled();
    firebaseState.sessionExpiryCheck = 'live'; expect(await autoCloseBarcodeFromZto({ itemId: 'open', code: 'open' }, rows)).toBe(true);
});

it.each(['returned', 'misplaced', 'sent'])('ត្រា %s ក្រោយផ្អាករក្សាពេល ZTO និងរង់ចាំម៉ោងផ្ទៀង', async kind => {
    const path = 'zoew_recently_deleted_cod_dod/back';
    const row = { id: 'back', createdAt: START - HOUR, deletedAt: START, trashReason: 'returned',
        barcodes: [{ code: 'back', createdAt: START - HOUR, isClosed: false }] };
    dataState.deletedItems = [row] as any; server[path] = structuredClone(row);
    suspend(); noteZtoReturnedEvidence('back', START + 3 * HOUR, kind);
    expect(ztoReturnedEvidence.get('BACK').at).toBe(START + 3 * HOUR);
    expect(collectZtoFinalTargets()).toEqual([]); expect(await syncZtoFinalMarks()).toBe(0);
    resample(); expect(await syncZtoFinalMarks()).toBe(1);
    const barcode = server[path].barcodes[0];
    expect(barcode.createdAt).toBe(START - HOUR);
    expect(barcode[kind === 'sent' ? 'ztoSentOutAt' : 'ztoReturnedAt']).toBe(START + 3 * HOUR);
    if (kind === 'misplaced') expect(barcode.ztoMisplacedAt).toBe(START + 3 * HOUR);
});
it('ត្រាត្រឡប់របស់វគ្គចាស់មិនប៉ះកញ្ចប់វគ្គថ្មីក្រោយផ្ទៀងម៉ោង', async () => {
    const path = 'zoew_recently_deleted_cod_dod/back';
    const row = { id: 'back', createdAt: START + 3 * HOUR, deletedAt: START + 3 * HOUR, trashReason: 'returned',
        barcodes: [{ code: 'back', createdAt: START + 3 * HOUR, isClosed: false }] };
    dataState.deletedItems = [row] as any; server[path] = structuredClone(row);
    suspend(); noteZtoReturnedEvidence('back', START + HOUR); resample();
    expect(await syncZtoFinalMarks()).toBe(0); expect(server[path]).toEqual(row);
});
it('ត្រាត្រឡប់មិនសរសេរពេលវគ្គម៉ោងផ្លាស់នៅក្នុង transaction', async () => {
    const path = 'zoew_recently_deleted_cod_dod/back';
    const row = { id: 'back', createdAt: START - HOUR, deletedAt: START, trashReason: 'returned',
        barcodes: [{ code: 'back', createdAt: START - HOUR, isClosed: false }] };
    dataState.deletedItems = [row] as any; server[path] = structuredClone(row);
    noteZtoReturnedEvidence('back', START); beforeWrite = () => { suspend(); resample(); };
    expect(await syncZtoFinalMarks()).toBe(0); expect(updates).toEqual([undefined]); expect(server[path]).toEqual(row);
});
it('ត្រាត្រឡប់ក្នុង detail រក្សាខ្សែពេល ZTO ដើមនៅពេលម៉ោងផ្អាក', async () => {
    const raw = '2026-11-08 10:00:00';
    vi.stubGlobal('fetch', vi.fn(async () => { suspend(); return new Response(JSON.stringify({ ztoClosed: false, ztoReturnedAt: raw, ztoMisplacedAt: raw })); }));
    expect(await checkZtoStatusForBarcode({ url: 'https://example.test/status?barcode={barcode}' }, 'row')).toEqual({ closed: false, returnedAt: raw, misplaced: true });
});

it.each([START + 3 * HOUR, '2026-11-08 10:00:00'])('បញ្ជី Sign %s រក្សាពេលដើមក្រោយផ្អាក និងចាប់ពី Sign ពេលផ្ទៀងរួច', async raw => {
    setZtoPickupVerdict('row', false);
    vi.spyOn(listSync, 'fetchZtoSignedCodes').mockImplementation(async () => {
        suspend();
        return { measured: true, codes: ['row'], signedRows: [{ barcode: 'row', at: raw }], partial: false, truncated: false } as any;
    });
    const out = await closeZtoSignedBarcodes({}, [], dataState.scanHistory, false, [{ key: 'ROW', code: 'row', since: START - HOUR }]);
    expect(out.flipped).toBe(1);
    expect(ztoPickupStatus.get('ROW').signedAtPending).toBe(raw);
    expect(await syncZtoFinalMarks()).toBe(0);
    reload(); resample(); expect(await syncZtoFinalMarks()).toBe(1);
    expect(server[PATH].barcodes[0]).toMatchObject({ ztoSignedAt: START + 3 * HOUR, ztoSignedExact: true });
});

it.each(['returned', 'misplaced', 'sent'])('ត្រា %s ថ្មីក្រោយផ្អាក៤ថ្ងៃមិនផុតអាយុ មុនពេលម៉ោងផ្ទៀងឡើងវិញ', async kind => {
    const fresh = START + 4 * 24 * HOUR;
    const path = 'zoew_recently_deleted_cod_dod/back';
    const row = { id: 'back', createdAt: START - HOUR, deletedAt: START, trashReason: 'returned',
        barcodes: [{ code: 'back', createdAt: START - HOUR, isClosed: false }] };
    dataState.deletedItems = [row] as any; server[path] = structuredClone(row);
    vi.setSystemTime(fresh); expect(serverClockIsTrustworthy()).toBe(false);
    noteZtoReturnedEvidence('back', fresh, kind);
    expect(await syncZtoFinalMarks()).toBe(0);
    resample(fresh);
    expect(await syncZtoFinalMarks()).toBe(1);
    expect(server[path].barcodes[0][kind === 'sent' ? 'ztoSentOutAt' : 'ztoReturnedAt']).toBe(fresh);
});

it('ភស្តុតាងត្រឡប់ចាស់នៅតែផុតអាយុ និងកំណត់ទំហំ cache នៅពេលម៉ោងមិនផ្ទៀង', () => {
    noteZtoReturnedEvidence('old', START);
    suspend();
    for (let n = 0; n <= ZTO_FINAL_RETURNED_MAX; n++) noteZtoReturnedEvidence('new' + n, START + HOUR);
    expect(ztoReturnedEvidence.size).toBe(ZTO_FINAL_RETURNED_MAX);
    resample(); pruneZtoReturnedEvidence();
    expect(ztoReturnedEvidence.size).toBe(ZTO_FINAL_RETURNED_MAX);
    mono += ZTO_FINAL_RETURNED_TTL_MS + 1; vi.setSystemTime(START + 3 * HOUR + ZTO_FINAL_RETURNED_TTL_MS + 1);
    pruneZtoReturnedEvidence(); expect(ztoReturnedEvidence.size).toBe(0);
});
it('ភស្តុតាងត្រឡប់ដែលធ្លាប់ផ្ទៀងអាយុមុនផ្អាកនៅតែផុតអាយុដើម', () => {
    noteZtoReturnedEvidence('old', START);
    vi.setSystemTime(START + ZTO_FINAL_RETURNED_TTL_MS + HOUR); expect(serverClockIsTrustworthy()).toBe(false);
    pruneZtoReturnedEvidence(); expect(ztoReturnedEvidence.has('OLD')).toBe(true);
    resample(START + ZTO_FINAL_RETURNED_TTL_MS + HOUR); pruneZtoReturnedEvidence();
    expect(ztoReturnedEvidence.has('OLD')).toBe(false);
});
