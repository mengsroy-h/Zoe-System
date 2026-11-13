import { beforeEach, describe, expect, it, vi } from 'vitest';
const clock = vi.hoisted(() => ({ trusted: true, generation: 0 }));
vi.mock('../../../../ZoeW/src/core/clock', () => ({
    getServerNow: () => 1000000,
    getServerClockBounds: () => clock.trusted ? { lowerMs: 1000000, upperMs: 1000000 } : null,
    serverClockIsTrustworthy: () => clock.trusted,
    cleanupClockIsTrustworthy: () => clock.trusted,
    captureClockOperation: () => {
        const generation = clock.generation, trusted = clock.trusted;
        return { current: () => trusted && clock.trusted && generation === clock.generation };
    }
}));
import { captureTrashGenerationOwner } from '../../../../ZoeW/src/services/trash-generation';
import { trashConsumptionOf } from '../../../../ZoeW/src/domain/trash-generation';
import { captureClockOperation } from '../../../../ZoeW/src/core/clock';
import { firebaseState } from '../../../../ZoeW/src/core/state';
import { applyClaimedRestoreToHistory, finalizeClaimedRestore, bindRestoreClaimTarget, isActiveRestoreClaim, releaseStaleRestoreClaimForPurge } from '../../../../ZoeW/src/features/restore';
let server: any;
let beforeUpdater: (() => void) | undefined;
let writes: number;
beforeEach(() => {
    clock.trusted = true; clock.generation = 0; writes = 0; beforeUpdater = undefined;
    server = { restoreClaim: { token: 'token', targetId: 'target', claimedAt: 1 } };
    localStorage.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: 'https://restore-clock.firebaseio.com' }));
    firebaseState.auth = { currentUser: { uid: 'clock-owner' } } as any;
    firebaseState.db = {} as any;
    firebaseState.fb = {
        ref: (_db, path) => ({ path }),
        get: async (ref) => ({ exists: () => true, val: () => ref.path.includes('recently_deleted') ? structuredClone(server) : null }),
        runTransaction: async (_ref, updater) => {
            beforeUpdater?.();
            const next = updater(structuredClone(server));
            if (next !== undefined) { server = next; writes++; }
            return { committed: next !== undefined, snapshot: { val: () => server } };
        }
    } as any;
});
describe('នាឡិកាស្តារ និងអាយុសិទ្ធិ', () => {
    it('មិនបង្កើតពេលសិទ្ធិថ្មីពេលមិនទាន់ផ្ទៀងនាឡិកា', async () => {
        clock.trusted = false;
        await expect(bindRestoreClaimTarget('source', 'token', 'next')).rejects.toThrow('RESTORE_CLOCK_UNTRUSTED');
        expect(writes).toBe(0);
    });
    it('មិនបន្តសិទ្ធិចាស់ក្រោយបាត់ទំនុកចិត្ត ហើយ Sync វិញ', async () => {
        beforeUpdater = () => { clock.generation++; };
        await expect(bindRestoreClaimTarget('source', 'token', 'next')).rejects.toThrow('RESTORE_CLOCK_UNTRUSTED');
        expect(writes).toBe(0);
    });
    it('រក្សាសិទ្ធិដែលមិនអាចផ្ទៀងអាយុបាន', () => {
        clock.trusted = false;
        expect(isActiveRestoreClaim(server.restoreClaim)).toBe(true);
    });
    it('មិនដកសិទ្ធិផុតកំណត់ពេលនាឡិកាមិនច្បាស់', async () => {
        clock.trusted = false;
        expect(await releaseStaleRestoreClaimForPurge('source')).toBe(false);
        expect(writes).toBe(0);
    });
    it('មិនផ្ញើពេលស្តារចាស់ក្រោយរង់ចាំភស្តុតាងប្រាក់ និង Sync វិញ', async () => {
        const operation = captureClockOperation();
        const item = { id: 'target', barcodes: [{ code: 'A', restoredAt: 1000000 }] };
        await Promise.resolve();
        clock.generation++;
        await expect(applyClaimedRestoreToHistory('target', 'source', 'token', item, () => item, () => true, operation))
            .rejects.toThrow('RESTORE_CLOCK_UNTRUSTED');
        expect(writes).toBe(0);
    });
    it('មិនបន្តស្តារពេលនាឡិកាប្រែពេល callback ត្រឡប់មកវិញ', async () => {
        const operation = captureClockOperation();
        beforeUpdater = () => { clock.generation++; };
        await expect(applyClaimedRestoreToHistory('target', 'source', 'token', { barcodes: [] }, () => ({}), () => true, operation))
            .rejects.toThrow('RESTORE_CLOCK_UNTRUSTED');
        expect(writes).toBe(0);
    });
    it('មិនផ្ញើបង្កាន់ដៃចុងក្រោយចាស់ម្ដងទៀតក្រោយបាត់ទំនុកចិត្ត', async () => {
        const update = vi.fn(async () => { clock.generation++; throw new Error('network'); });
        firebaseState.fb.update = update;
        const owner = captureTrashGenerationOwner();
        const receipt = trashConsumptionOf({ id: 'source', deletedAt: 1, createdAt: 1 }, 'restore', owner, 'token', 'target');
        await expect(finalizeClaimedRestore('source', 'token', 'target', [], null, null, false, receipt))
            .rejects.toThrow('RESTORE_CLOCK_UNTRUSTED');
        expect(update).toHaveBeenCalledTimes(1);
        expect(server.restoreClaim.token).toBe('token');
    });
    it('នៅតែអនុញ្ញាតការបន្តសិទ្ធិពេលនាឡិកាត្រឹមត្រូវ', async () => {
        await bindRestoreClaimTarget('source', 'token', 'next');
        expect(server.restoreClaim).toEqual({ token: 'token', targetId: 'next', claimedAt: 1000000 });
    });
});
