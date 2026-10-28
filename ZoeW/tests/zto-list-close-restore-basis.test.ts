// Z5 (deep audit 8): the background Sign sweep never closes a barcode on a Sign row older than the barcode's restore
// (`barcodeSignBasis()`: that Sign belongs to the parcel's earlier lifecycle, and `applyZtoFinalMarks()` refuses its stamp).
// The list import closed every open barcode whose row verdict was `true` without that check ➜ a restored barcode closed on an
// old Sign got a `true` verdict with no stamp: hidden from the not-closed bar, reopen locked, never cleaned by the Palm 2-hour rule.
// `ztoListCloseTargets()` applies the sweep's rule: a row Sign time older than the barcode's restore is no evidence for it.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dataState, firebaseState } from '../src/core/state';
import { appLocalStore } from '../src/core/storage';
import { pickupBarcodeKey } from '../src/domain/pickup';
import { ztoListCloseTargets } from '../src/features/zto-list-sync';

const NOW = Date.UTC(2026, 9, 20, 5, 0, 0);
const H = 60 * 60 * 1000;
const SIGN_TEXT = '2026-10-19 09:00:00';
const SIGN_MS = Date.UTC(2026, 9, 19, 2, 0, 0);

function seed(restoredAt?: number) {
    const barcode: any = { code: 'ZTZ5000001', isClosed: false, cod: 3, dod: 0, isDeducted: false, createdAt: SIGN_MS - 48 * H, time: '08:00:00' };
    if (restoredAt) barcode.restoredAt = restoredAt;
    dataState.scanHistory = [{ id: 'it1', phone: '0961234567', scanDate: '2026-10-17', isClosed: false, createdAt: SIGN_MS - 48 * H,
        cod: 3, dod: 0, price: 3, count: 1, barcode: 'ZTZ5000001', time: '08:00:00 (2026-10-17)', barcodes: [barcode] }] as any;
}
const row = (signedAt: string) => ({ key: pickupBarcodeKey('ZTZ5000001'), barcode: 'ZTZ5000001', ztoClosed: true, signedAt });

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(NOW));
    appLocalStore.clear();
    appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify({ enabled: true, fastMode: true,
        url: 'https://example.invalid/.netlify/functions/zto-order-detail?barcode={barcode}' }));
    firebaseState.serverClockTrusted = true;
    firebaseState.serverTimeOffsetMs = 0;
});

afterEach(() => {
    vi.useRealTimers();
    appLocalStore.clear();
    dataState.scanHistory = [];
});

describe('Z5 ៖ ការនាំចូលបញ្ជី ZTO មិនបិទ Barcode ដែលស្តារ ដោយ Sign មុនការស្តារ', () => {
    it('Sign older than the restore ➜ not a close target', () => {
        seed(SIGN_MS + 3 * H);
        expect(ztoListCloseTargets([row(SIGN_TEXT)])).toEqual([]);
    });

    it('control ៖ Sign after the restore · a barcode never restored · a row without a Sign time ➜ close target', () => {
        seed(SIGN_MS - 3 * H);
        expect(ztoListCloseTargets([row(SIGN_TEXT)]).map((e: any) => e.code)).toEqual(['ZTZ5000001']);
        seed();
        expect(ztoListCloseTargets([row(SIGN_TEXT)]).map((e: any) => e.code)).toEqual(['ZTZ5000001']);
        seed(SIGN_MS + 3 * H);
        expect(ztoListCloseTargets([row('')]).map((e: any) => e.code)).toEqual(['ZTZ5000001']);
    });
});
