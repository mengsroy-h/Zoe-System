/**
 * Deep audit ជុំ ៦ (L3 ៖ មុខងារដែលគ្មានតេស្ត) ៖ ការរកកញ្ចប់ដែលកាន់ទីតាំង Locker (`buildLockerBarcodeIndex` · `findLockerOccupant` ·
 * `isEntryBarcodeClosed` · `getEntryCurrentLocker`) ដែលប្រអប់ «ផ្លាស់ទីតាំង» ប្រើដើម្បីព្រមានថាទីតាំងគោលដៅមានកញ្ចប់របស់អ្នកផ្សេង។
 *
 * - barcode ដែលបិទ «យករួច» មិនកាន់ទីតាំងទៀតទេ (កញ្ចប់ចេញពីទូរួច) · barcode បើកនៅកាន់
 * - រំលង barcode ដែលកំពុងផ្លាស់ទី និងកញ្ចប់ (item) ដដែល (barcode ផ្សេងរបស់អតិថិជនដដែល មិនមែន «អ្នកផ្សេង»)
 * - កញ្ចប់ចាស់ (`item.barcode` · `item.locker` · `item.isClosed`) ក៏រាប់ដែរ · ធាតុខូចមិនបោះ
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { dataState, uiState } from '../src/core/state';
import { buildLockerBarcodeIndex, findLockerOccupant, getEntryCurrentLocker, isEntryBarcodeClosed } from '../src/features/locker';

beforeEach(() => {
    dataState.scanHistory = [];
    uiState.lockerBarcodeIndex = {};
});

describe('ការកាន់ទីតាំង Locker', () => {
    it('barcode បើកកាន់ទីតាំង · barcode បិទមិនកាន់ · រំលង barcode ខ្លួនឯង និងកញ្ចប់ដដែល', () => {
        dataState.scanHistory = [
            { id: 'a', phone: '0961111111', barcodes: [
                { code: 'ZTA001', locker: 'L-01', isClosed: true },
                { code: 'ZTA002', locker: 'L-02', isClosed: false }] },
            { id: 'b', phone: '0962222222', barcodes: [{ code: 'ZTB001', locker: 'L-02', isClosed: false }] },
            { id: 'c', phone: '0963333333', barcodes: [{ code: 'ZTC001', locker: 'L-03', isClosed: false }] }
        ] as any;
        buildLockerBarcodeIndex();
        expect(findLockerOccupant('L-01', '', '')).toBe(null);
        const l2 = findLockerOccupant('L-02', 'ZTC001', 'c');
        expect(l2 && l2.entry.itemId).toMatch(/^[ab]$/);
        expect(findLockerOccupant('L-02', 'ZTA002', 'a')!.code).toBe('ZTB001');
        expect(findLockerOccupant('L-03', 'ZTC001', 'c')).toBe(null);
        expect(findLockerOccupant('L-03', 'ZTA002', 'a')!.code).toBe('ZTC001');
        expect(findLockerOccupant('L-09', '', '')).toBe(null);
        dataState.scanHistory = [{ id: 'a', phone: '0961111111', barcodes: [
            { code: 'ZTA002', locker: 'L-02', isClosed: false },
            { code: 'ZTA003', locker: 'L-07', isClosed: false }] }] as any;
        buildLockerBarcodeIndex();
        expect(findLockerOccupant('L-02', 'ZTA003', 'a'), 'barcode ផ្សេងរបស់កញ្ចប់ដដែល មិនមែនអ្នកផ្សេង').toBe(null);
        expect(findLockerOccupant('L-02', 'ZTA003', '')!.code).toBe('ZTA002');
    });

    it('កញ្ចប់ចាស់ (`item.barcode`) ៖ ទីតាំង និងស្ថានភាពបិទមកពី item · ធាតុខូចរំលង', () => {
        dataState.scanHistory = [
            { id: 'old1', barcode: 'ZTO001', locker: 'L-05', isClosed: false },
            { id: 'old2', barcode: 'ZTO002', locker: 'L-06', isClosed: true },
            null, { phone: 'x' }, { id: 'bad', barcodes: [null, 5, { code: '' }] }
        ] as any;
        buildLockerBarcodeIndex();
        const idx = uiState.lockerBarcodeIndex as any;
        const keys = Object.keys(idx);
        expect(keys.length).toBe(2);
        const e5 = idx[keys.find((k) => idx[k].itemId === 'old1')!];
        expect(getEntryCurrentLocker(e5)).toBe('L-05');
        expect(isEntryBarcodeClosed(e5)).toBe(false);
        expect(findLockerOccupant('L-05', '', '')!.entry.itemId).toBe('old1');
        expect(findLockerOccupant('L-06', '', '')).toBe(null);
        expect(getEntryCurrentLocker(null)).toBe(null);
        expect(isEntryBarcodeClosed(null)).toBe(false);
    });
});
