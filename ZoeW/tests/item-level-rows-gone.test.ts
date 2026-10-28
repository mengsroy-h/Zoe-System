/**
 * ⛔ Phase B ជុំ ៤ (ការសម្រេចម្ចាស់ ៖ គ្មាន compat មុន launch · «លាក់នៅច្រកអាន») ៖ ជួរ/ធាតុធុងសំរាមដែលគ្មាន `barcodes`
 *    (ទម្រង់សម័យ vanilla · គ្មានអ្នកសរសេរបច្ចុប្បន្នបង្កើតវា) ឈប់ចូលកម្មវិធីនៅច្រកតែមួយ `rawSnapshotToItemList()` (Sentry `zone: 'data'`)
 *    ហើយគ្មានផ្លូវណាបកប្រែ `item.barcode` · `item.cod` · `item.isClosed` ជាកញ្ចប់ទៀតទេ ៖ ការបម្លែង (`ensureBarcodeArrayForItem()`) ·
 *    ស្ថិតិយករួច · registry · លុយ mirror · ledger companion · ស្លាក · ជួរប្រវត្តិ · 🔔 · Locker · ធុងសំរាម។
 *    `pickupSetFromRecord()` អានតែ `pickedUpBarcodes` (គ្មាន `_lg_` placeholder ពីកំណត់ត្រាមុនសំណុំ barcode)។
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dataState, uiState } from '../src/core/state';
import { rawSnapshotToItemList } from '../src/ui/modal-stack';
import { collectPickupMarks, pickupSetFromRecord } from '../src/domain/pickup';
import { collectItemBarcodes, isBarcodeAlreadyUsed } from '../src/domain/registry';
import { ensureBarcodeArrayForItem } from '../src/domain/barcode';
import { ledgerCompanionState } from '../src/domain/ledger';
import { trashSlotSharesClaim } from '../src/domain/cleanup';
import { trashItemCodes, trashItemTotals } from '../src/features/trash';
import { buildLabelRows } from '../src/features/label-print';
import { buildLockerBarcodeIndex } from '../src/features/locker';
import { nearExpiryView } from '../src/features/notifications';
import { buildHistoryRowModel } from '../src/app/components/history/rowModel';

const DAY = 86400000;
const itemLevel = () => ({ id: 'legacy1', phone: '012000111', barcode: 'LEGACY0001', cod: 5, dod: 1, price: 6, count: 1, locker: 'A1',
    isClosed: false, createdAt: Date.now() - 6.5 * DAY, scanDate: '2026-10-20', time: '10:00:00' });
const modern = () => ({ id: 'modern1', phone: '012000222', barcode: 'MODERN0001', cod: 3, dod: 0, price: 3, count: 1, createdAt: Date.now(), scanDate: '2026-10-20',
    barcodes: [{ code: 'MODERN0001', cod: 3, dod: 0, locker: 'B2', isClosed: false, isDeducted: false, isFromDeletion: false, createdAt: Date.now() }] });

let capture: ReturnType<typeof vi.fn>;
beforeEach(() => {
    capture = vi.fn();
    (window as any).ZoeErrors = { capture };
    dataState.scanHistory = [];
    dataState.deletedItems = [];
});
afterEach(() => {
    delete (window as any).ZoeErrors;
    dataState.scanHistory = [];
    dataState.deletedItems = [];
    uiState.lockerBarcodeIndex = {};
});

describe('ជួរគ្មាន `barcodes` ៖ ច្រកអានតែមួយ', () => {
    it.each(['history', 'deleted'])('`rawSnapshotToItemList(…, %s)` ➜ តែជួរមាន barcode · ជួរគ្មានត្រូវរំលង + Sentry data', (label) => {
        const list = rawSnapshotToItemList({ legacy1: itemLevel(), modern1: modern(), sparse: { ...modern(), id: 'sparse', barcodes: { 1: { code: 'SPARSE0001', cod: 1 } } }, empty: { id: 'empty', barcodes: [] } }, label);
        expect(list.map((item) => item.id).sort()).toEqual(['modern1', 'sparse']);
        const skipped = capture.mock.calls.filter(([, extra]) => extra && extra.zone === 'data' && String(extra.context).includes(label));
        expect(skipped.length).toBe(1);
        expect(skipped[0][1].skipped).toBe(2);
    });
});

describe('គ្មានផ្លូវណាបកប្រែជួរគ្មាន `barcodes` ជាកញ្ចប់', () => {
    it('`ensureBarcodeArrayForItem()` មិនបង្កើត barcode ពីវាល item', () => {
        const item: any = itemLevel();
        expect(ensureBarcodeArrayForItem(item)).toEqual([]);
        expect(item.barcodes).toBeUndefined();
    });

    it('ស្ថិតិយករួច ៖ គ្មាន mark · `pickupSetFromRecord()` គ្មាន `_lg_` placeholder', () => {
        expect(collectPickupMarks({ ...itemLevel(), isClosed: true })).toEqual([]);
        expect(pickupSetFromRecord({ packagesPickedUp: 3, pickedUpPhones: { '012000111': 3 } })).toEqual({});
        expect(pickupSetFromRecord({ packagesPickedUp: 1, pickedUpBarcodes: { MODERN0001: '012000222' } })).toEqual({ MODERN0001: '012000222' });
    });

    it('registry · ធុងសំរាម · slot ៖ គ្មាន code ពី `item.barcode`', () => {
        expect(collectItemBarcodes(itemLevel())).toEqual([]);
        expect(trashItemCodes(itemLevel())).toEqual([]);
        expect(trashItemTotals(itemLevel())).toEqual({ cod: 0, dod: 0, count: 0 });
        dataState.scanHistory = [itemLevel() as any];
        expect(isBarcodeAlreadyUsed('LEGACY0001')).toBe(false);
        const ours = { id: 't1', barcodes: [{ code: 'LEGACY0001' }] };
        expect(trashSlotSharesClaim(itemLevel(), ours)).toBe(false);
    });

    it('ledger companion ៖ ជួរគ្មាន barcode ➜ `absent` (មិនដែល `holds`)', () => {
        expect(ledgerCompanionState(itemLevel(), { code: 'LEGACY0001', wantCod: 5, wantDod: 1 })).toBe('absent');
    });

    it('ស្លាក · Locker · 🔔 · ជួរប្រវត្តិ ៖ គ្មានកញ្ចប់ពីវាល item', () => {
        expect(buildLabelRows([itemLevel()])).toEqual([]);
        dataState.scanHistory = [itemLevel() as any, modern() as any];
        buildLockerBarcodeIndex();
        expect(Object.keys(uiState.lockerBarcodeIndex)).toEqual(['MODERN0001']);
        const legacyOld = { ...itemLevel(), barcodes: undefined };
        const modernOld = { ...modern(), id: 'modern2', createdAt: legacyOld.createdAt, barcodes: [{ ...modern().barcodes[0], code: 'MODERN0002', createdAt: legacyOld.createdAt }] };
        expect(nearExpiryView([legacyOld, modernOld], Date.now(), false).packages).toBe(1);
        expect(buildHistoryRowModel(itemLevel(), 1, false, false).activeCount).toBe(0);
    });
});
