/**
 * ↩️ ZTO Palm ៖ កញ្ចប់ត្រឡប់ទៅវិញ (សំណើម្ចាស់គម្រោង ៖ «ទាំង Cookie និង palm»)។ លំដាប់ track ពិតពី 🧪 របស់ម្ចាស់គម្រោង ៖
 * `3` 到件 (សាខាខ្លួន) ➜ `4` 派件 ➜ `-579`/`-585` កញ្ចប់មានបញ្ហា ➜ **`-710` 退货中 «ត្រឡប់ស្កេន»** ➜ `2` 发件 ទៅ KC-01។
 * `-710` នៃសាខាខ្លួនក្រោយការមកដល់ចុងក្រោយ = ត្រឡប់ ➜ ក្រុម «↩️» មិនបញ្ចូល · `-710` នៃសាខាផ្សេង ឬមុនការមកដល់ថ្មី ➜ មិនមែន។
 * App ពិត + Function ពិត + ZTO Palm ក្លែង (Barcode · លេខ ក្លែង)។
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ztoState } from '../src/core/state';
import { runZtoListSyncPreview } from '../src/features/zto-list-sync';
import { OTHER_SITE, SITE, noteText, setupWorld, teardownWorld, world } from './zto-palm-harness';

vi.mock('../src/features/barcode-ops', () => ({
    openViewListModal: () => {},
    removeSingleBarcode: async () => 'failed',
    toggleIndividualBarcodeClose: async () => false,
    openEditBarcodePriceModal: () => {},
    closeEditBarcodeModal: () => {},
    saveEditedBarcodePrice: () => {},
    applyBarcodeCloseChange: async () => true
}));

afterEach(() => teardownWorld());

const at = (day: string, time: string) => '2026-10-' + day + ' ' + time;
const scan = (action: string, siteCode: string, time: string) => ({ action, siteCode, time });

describe('↩️ ZTO Palm ៖ track `-710` នៃសាខាខ្លួនក្រោយមកដល់', () => {
    it('ត្រឡប់ ➜ ក្រុម «↩️ ត្រឡប់ទៅវិញ» មិនបញ្ចូល · សាខាផ្សេង ឬមកដល់ម្តងទៀត ➜ ថ្មីធម្មតា', async () => {
        await setupWorld('firebase', 'off');
        world.parcels = {
            KH5000000001: { tab: '1', isSign: 0, scans: [
                scan('3', SITE, at('04', '15:29:45')), scan('4', SITE, at('04', '15:30:16')),
                scan('-579', SITE, at('04', '15:32:44')), scan('-585', SITE, at('05', '07:57:13')),
                scan('-710', SITE, at('05', '08:00:34')), scan('2', SITE, at('05', '08:05:40'))] },
            KH5000000002: { tab: '4', isSign: 0, scans: [scan('3', SITE, at('04', '09:00:00')), scan('-710', OTHER_SITE, at('05', '09:00:00'))] },
            KH5000000003: { tab: '4', isSign: 0, scans: [scan('3', SITE, at('03', '09:00:00')), scan('-710', SITE, at('03', '12:00:00')),
                scan('3', SITE, at('05', '09:00:00'))] },
            KH5000000004: { tab: '4', isSign: 0, scans: [scan('3', SITE, at('05', '10:00:00'))] }
        };
        await runZtoListSyncPreview();
        const result: any = ztoState.ztoListSyncResult;
        expect(result, noteText()).toBeTruthy();
        expect(result.returnedState).toBe('ok');
        expect(result.returned).toEqual([{ barcode: 'KH5000000001', at: at('05', '08:00:34') }]);
        const groups = (ztoState.ztoListPreview as any).groups;
        const codes = (tone: string) => groups.find((g: any) => g.tone === tone).rows.map((r: any) => r.barcode).sort();
        expect(codes('zto-list-returned')).toEqual(['KH5000000001']);
        expect(codes('zto-list-fresh')).toEqual(['KH5000000002', 'KH5000000003', 'KH5000000004']);
        expect(noteText()).toContain('↩️ ស្កេនត្រឡប់រួច 1 ➜ រំលង');
    });
});
