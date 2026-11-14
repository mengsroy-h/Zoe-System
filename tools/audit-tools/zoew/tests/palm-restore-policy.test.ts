import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { stampTrashPolicy, trashEntryIsFinal, trashZtoFinalBlock } from '../../../../ZoeW/src/domain/barcode';
import { resetZtoFinalMarks, trashRestoreBlockOf } from '../../../../ZoeW/src/features/zto-final-marks';
import { verifyZtoRestoreStatus } from '../../../../ZoeW/src/features/zto-restore-status';
import { appLocalStore } from '../../../../ZoeW/src/core/storage';
import { firebaseState } from '../../../../ZoeW/src/core/state';
import { setupWorld, teardownWorld, world, type Backend } from './zto-palm-harness';

beforeEach(() => resetZtoFinalMarks());
afterEach(() => { resetZtoFinalMarks(); teardownWorld(); });

describe('Palm ស្តារ ៖ មិនយក Sign ទៅហាមការលុប/ដកដែលមិនទាន់ Sign', () => {
    it.each(['delete', 'remove', 'returned'])('%s មិនទាន់ Sign រក្សា provenance ដោយមិនចាក់សោជារៀងរហូត', (trashReason) => {
        const item = stampTrashPolicy({ trashReason, barcodes: [{ code: 'KH1000000001' }] }, 'palm');
        expect(item.trashMode).toBe('palm');
        expect(item.restoreBlocked).toBeUndefined();
        expect(trashZtoFinalBlock(item)).toBe('');
        expect(trashEntryIsFinal('palm', item)).toBe(false);
    });

    it('cleanup Palm និងភស្តុតាង Sign ពិតនៅហាម ហើយមិនលុបត្រាហាមចាស់', () => {
        for (const item of [
            { trashReason: 'pickup', barcodes: [{ code: 'A' }] },
            { trashReason: 'delete', barcodes: [{ code: 'B', ztoSignedAt: 123 }] },
            { trashReason: 'remove', restoreBlocked: true, barcodes: [{ code: 'C' }] }
        ]) {
            const stamped = stampTrashPolicy(item, 'palm');
            expect(stamped.restoreBlocked).toBe(true);
            expect(trashZtoFinalBlock(stamped)).not.toBe('');
        }
    });

    for (const backend of ['firebase', 'supabase'] as Backend[]) {
        it(`${backend} ៖ App + Function ពិតផ្ទៀង Palm ថ្មីមុនស្តារ ហើយចាប់ Sign ថ្មី`, async () => {
            await setupWorld(backend, 'require');
            const item = { trashMode: 'palm', trashReason: 'remove', barcodes: [{ code: 'KH1000000001' }] };
            expect(trashRestoreBlockOf(item)).toBe('');
            await verifyZtoRestoreStatus(item);
            expect(world.functionQueries.at(-1)).toMatchObject({ restore: '1', palm: '1', barcode: 'KH1000000001' });
            expect(world.zto.filter(value => value.startsWith('track:')).length).toBeGreaterThan(0);
            world.parcels.KH1000000001.isSign = 1;
            world.parcels.KH1000000001.scans.push({ action: '5', siteCode: '881859', time: '2026-10-05 16:00:00' });
            await expect(verifyZtoRestoreStatus(item)).rejects.toThrow('RESTORE_ZTO_FINAL');
        });

        it(`${backend} ៖ Palm unknown/ត្រឡប់ថ្មី/offline មិនសន្មតថាមិនទាន់ Sign`, async () => {
            await setupWorld(backend, 'require');
            const item = { trashMode: 'palm', trashReason: 'delete', barcodes: [{ code: 'KH1000000001' }] };
            world.parcels.KH1000000001.isSign = null;
            await expect(verifyZtoRestoreStatus(item)).rejects.toThrow('RESTORE_ZTO_UNCONFIRMED');
            world.parcels.KH1000000001.isSign = 0;
            world.parcels.KH1000000001.scans.push({ action: '-710', siteCode: '881859', time: '2026-10-05 16:00:00' });
            await expect(verifyZtoRestoreStatus(item)).rejects.toThrow('RESTORE_ZTO_FINAL');
            vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
            await expect(verifyZtoRestoreStatus(item)).rejects.toThrow('RESTORE_ZTO_UNVERIFIED');
        });
    }

    it('Palm provenance លើ device គ្មាន Palm Lookup ត្រូវសុំភ្ជាប់ មិនបង្កើត claim', async () => {
        await setupWorld('firebase', 'require');
        appLocalStore.removeItem('zoew_lookup_api_config');
        await expect(verifyZtoRestoreStatus({ trashMode: 'palm', trashReason: 'remove', barcodes: [{ code: 'KH1000000001' }] }))
            .rejects.toThrow('RESTORE_ZTO_NEEDS_LOOKUP');
        expect(firebaseState.auth?.currentUser).toBeTruthy();
    });

    it('Palm device ៖ Cookie provenance ត្រូវការរបៀបដើម · local provenance ផ្ទៀង Palm ដែលកំពុងប្រើ', async () => {
        await setupWorld('firebase', 'require');
        const barcodes = [{ code: 'KH1000000001' }];
        await expect(verifyZtoRestoreStatus({ trashMode: 'cookie', trashReason: 'remove', barcodes }))
            .rejects.toThrow('RESTORE_ZTO_NEEDS_LOOKUP');
        await verifyZtoRestoreStatus({ trashMode: 'local', trashReason: 'remove', barcodes });
        expect(world.functionQueries).toHaveLength(1);
        expect(world.functionQueries[0]).toMatchObject({ palm: '1', restore: '1' });
    });
});
