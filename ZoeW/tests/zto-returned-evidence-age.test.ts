import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dataState, firebaseState, ztoState } from '../src/core/state';
import { appLocalStore } from '../src/core/storage';
import { pickupBarcodeKey } from '../src/domain/pickup';
import { removeReturnedZtoBarcodes } from '../src/features/zto-returned';
import { ZTO_FINAL_RETURNED_TTL_MS, applyZtoFinalMarks, collectZtoFinalTargets, noteZtoReturnedEvidence, pruneZtoReturnedEvidence, resetZtoFinalMarks,
    trashRestoreBlockOf, ztoReturnedEvidence } from '../src/features/zto-final-marks';
import { clearZtoPickupStatusStore } from '../src/features/zto-status';

// A ZTO return (-710) removes the barcode at once (scenario 8b, money deducted) and its trash copy becomes 🔒 «ត្រឡប់» only
// through the `ztoReturnedAt` stamp written from the device's return evidence. The evidence lives ZTO_FINAL_RETURNED_TTL_MS
// from the moment ZoeW learned it ⛔ never from the return scan time: a return seen after an overnight or weekend gap (the
// sweep widens to 7–30 days · the list pull reads up to 31 days) would be dropped at once and the trash would stay restorable.

const h = { claims: [] as any[] };
const NOW = Date.UTC(2026, 9, 10, 3, 0, 0);
const DAY = 24 * 60 * 60 * 1000;

function openItem(id: string, code: string) {
    return { id, phone: '0960007345', scanDate: '2026-10-04', createdAt: NOW - 6 * DAY, isClosed: false, cod: 5, dod: 0, count: 1,
        barcode: code, barcodes: [{ code, isClosed: false, cod: 5, dod: 0, createdAt: NOW - 6 * DAY }] };
}

function returnedTrash(id: string, code: string) {
    return { ...openItem(id, code), trashReason: 'returned', isFromDeletion: false, deletedAt: NOW, trashMode: 'cookie',
        barcodes: [{ code, isClosed: false, cod: 5, dod: 0, createdAt: NOW - 6 * DAY, isDeducted: true }] };
}

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(NOW));
    appLocalStore.clear();
    appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify({ enabled: true, fastMode: true,
        url: window.location.origin + '/.netlify/functions/zto-order-detail?barcode={barcode}' }));
    clearZtoPickupStatusStore();
    resetZtoFinalMarks();
    h.claims.length = 0;
    firebaseState.serverTimeOffsetMs = 0;
    firebaseState.serverClockTrusted = true;
    firebaseState.isDatabaseConnected = true;
    firebaseState.db = { name: 'guard-db' } as any;
    firebaseState.fb = {
        ref: (_db: unknown, path: string) => ({ path }),
        runTransaction: (ref: { path: string }, fn: (cur: any) => any) => {
            const id = ref.path.split('/').pop();
            const cur = dataState.scanHistory.find((i: any) => i && i.id === id);
            h.claims.push({ path: ref.path, result: cur ? fn(JSON.parse(JSON.stringify(cur))) : 'no-item' });
            return new Promise(() => {});
        }
    } as any;
    firebaseState.auth = { currentUser: { uid: 'u' }, app: { options: { databaseURL: 'https://guard.firebaseio.com' } } } as any;
    (firebaseState as any).firebaseConfig = { databaseURL: 'https://guard.firebaseio.com' };
    ztoState.ztoTrashMode = { state: 'ok', palmAt: 0, cookieAt: NOW, shop: '' } as any;
});

afterEach(() => {
    vi.useRealTimers();
    appLocalStore.clear();
    firebaseState.db = null as any;
    firebaseState.fb = null as any;
});

describe('ZTO return evidence age vs the 🔒 «ត្រឡប់» stamp', () => {
    for (const [label, at, ageDays] of [['control: return scanned 1 day ago', '2026-10-09 10:00:00', 1],
        ['return scanned 4 days ago (seen after an overnight or weekend gap)', '2026-10-06 10:00:00', 4]] as const) {
        it(label, async () => {
            const code = 'ZTRG' + ageDays + '00001';
            dataState.scanHistory = [openItem('h' + ageDays, code)];
            expect(removeReturnedZtoBarcodes([{ barcode: code, at }], dataState.scanHistory)).toBe(1);
            // Wait for the asynchronous trash-claim start before inspecting the transaction witness.
            await Promise.resolve();
            expect(h.claims.map((c) => [c.path, (c.result?.barcodes || []).map((b: any) => [b.code, typeof b.trashClaim])]), 'the abandon claim takes the whole item')
                .toEqual([['zoew_scan_history_cod_dod/h' + ageDays, [[code, 'string']]]]);
            dataState.scanHistory = [];
            const trash = returnedTrash('h' + ageDays, code);
            dataState.deletedItems = [trash];
            const target = collectZtoFinalTargets().find((t) => t.trash && t.path.endsWith('/h' + ageDays));
            const stamped = target ? applyZtoFinalMarks(JSON.parse(JSON.stringify(trash)), target.wanted, true) : undefined;
            expect({ evidence: ztoReturnedEvidence.has(pickupBarcodeKey(code)), block: trashRestoreBlockOf(stamped || trash) })
                .toEqual({ evidence: true, block: 'returned' });
            expect((stamped || trash).barcodes[0].ztoReturnedAt, 'the stamp keeps the return scan time').toBeLessThan(NOW - (ageDays - 1) * DAY);
        });
    }

    it('evidence leaves the device ZTO_FINAL_RETURNED_TTL_MS after ZoeW learned it (bounded in time)', () => {
        noteZtoReturnedEvidence('ZTRG900001', NOW - 10 * DAY);
        expect(ztoReturnedEvidence.has(pickupBarcodeKey('ZTRG900001'))).toBe(true);
        vi.setSystemTime(new Date(NOW + ZTO_FINAL_RETURNED_TTL_MS - 1000));
        pruneZtoReturnedEvidence();
        expect(ztoReturnedEvidence.has(pickupBarcodeKey('ZTRG900001'))).toBe(true);
        vi.setSystemTime(new Date(NOW + ZTO_FINAL_RETURNED_TTL_MS + 1000));
        pruneZtoReturnedEvidence();
        expect(ztoReturnedEvidence.has(pickupBarcodeKey('ZTRG900001'))).toBe(false);
    });
});
