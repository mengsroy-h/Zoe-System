import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { firebaseState } from '../../../ZoeW/src/core/state';
import { acceptServerClockOffset, getServerNow, resetServerClock } from '../../../ZoeW/src/core/clock';
import { claimDeletedItemForRestore, releaseStaleRestoreClaimForPurge } from '../../../ZoeW/src/features/restore';
import { claimHistoryItemForClear, resetClearHistoryOperationState, releaseStaleClearHistoryClaim, staleClearClaimSweeps } from '../../../ZoeW/src/features/clear-history';
import { claimTrashBarcodes, releaseTrashClaims, trashClaimOwned, trashClaimPolicy } from '../../../ZoeW/src/domain/trash-claim';
const NOW = 1800000000000;
const copy = (v: any) => structuredClone(v);
let server: any, target: any, hook: (() => void) | undefined, writes: number;
function sync() {
    expect(acceptServerClockOffset(1, Object.freeze({ epochMs: NOW - 100, estimateEpochMs: NOW, uncertaintyMs: 200, monotonicMs: performance.now(), wallMs: Date.now() }), true)).toBe(true);
}
function restore(at: number) { server = { id: 'source', barcodes: [], restoreClaim: { token: 'foreign', targetId: 'target', claimedAt: at } }; }
function clear(at: number) { server = { id: 'source', barcodes: [], clearClaim: { token: 'foreign', claimedAt: at, deletedAt: at, trashGeneration: 1 } }; }
function trash(at: number) { server = { id: 'source', barcodes: [{ code: 'A', trashClaim: 'foreign', trashClaimAt: at }] }; }
beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date', 'performance'] }); vi.setSystemTime(NOW);
    localStorage.clear(); localStorage.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: 'https://lease.firebaseio.com' }));
    firebaseState.auth = { currentUser: { uid: 'owner' } } as any; firebaseState.authGeneration = 1;
    firebaseState.db = {} as any; target = null; hook = undefined; writes = 0; staleClearClaimSweeps.clear(); resetClearHistoryOperationState();
    firebaseState.fb = {
        ref: (_db, path) => ({ path }),
        get: async ref => ({ val: () => copy(ref.path.includes('trash_consumptions') ? null : ref.path.endsWith('/target') ? target : server), exists: () => true }),
        runTransaction: async (_ref, updater) => {
            updater(copy(server)); hook?.();
            const next = updater(copy(server));
            if (next !== undefined) { server = copy(next); writes++; }
            return { committed: next !== undefined, snapshot: { val: () => copy(server) } };
        }
    } as any;
    resetServerClock(); sync(); expect(getServerNow()).toBe(NOW);
});
afterEach(() => { resetServerClock(); vi.useRealTimers(); });
it.each([NOW - 120000 - 50, NOW + 50])('រក្សាសិទ្ធិស្តារនៅព្រំដែន %s', async at => {
    restore(at);
    await expect(claimDeletedItemForRestore('source', 'mine', 'target')).rejects.toThrow('RESTORE_IN_PROGRESS');
    expect(writes).toBe(0);
});
it('រក្សាសិទ្ធិស្តារពេល purge មិនទាន់ផុតពិត', async () => {
    restore(NOW - 120000 - 50); expect(await releaseStaleRestoreClaimForPurge('source')).toBe(false); expect(writes).toBe(0);
});
it('រក្សាប្រវត្តិស្តារដែលបានរៀបចំ', async () => {
    restore(NOW - 120000 - 500); target = { restoreClaimId: 'source' };
    expect(await releaseStaleRestoreClaimForPurge('source')).toBe(false); expect(writes).toBe(0);
});
it('អនុញ្ញាត token ដដែល និងរក្សាពេលបច្ចុប្បន្ន', async () => {
    restore(NOW + 50); await claimDeletedItemForRestore('source', 'foreign', 'target'); expect(server.restoreClaim.claimedAt).toBe(NOW);
});
it.each([NOW - 120000 - 50, NOW + 50])('រក្សាសិទ្ធិ clear នៅព្រំដែន %s', async at => {
    clear(at); await expect(claimHistoryItemForClear('source', 'mine')).rejects.toThrow('CLEAR_HISTORY_IN_PROGRESS'); expect(writes).toBe(0);
});
it.each(['unknown', 'generation', 'owner', 'renewed', 'uncertain'])('មិនដោះ clear ពេល %s', async kind => {
    clear(kind === 'uncertain' ? NOW - 120050 : NOW - 120500);
    if (kind === 'unknown') resetServerClock();
    hook = () => {
        if (kind === 'generation') { resetServerClock(); sync(); }
        if (kind === 'owner') firebaseState.auth = { currentUser: { uid: 'other' } } as any;
        if (kind === 'renewed') server.clearClaim.claimedAt = NOW + 50;
    };
    releaseStaleClearHistoryClaim(copy(server)); await Promise.resolve(); expect(writes).toBe(0); expect(server.clearClaim).toBeDefined();
});
it('មិនយក trash ពីសិទ្ធិមិនទាន់ផុតពិត', async () => {
    trash(NOW - trashClaimPolicy().staleMs - 50); expect((await claimTrashBarcodes('source', 'mine', () => ['A'])).state).toBe('busy'); expect(writes).toBe(0);
});
it('មិនដោះ trash មិនទាន់ផុតពិត', async () => {
    trash(NOW - trashClaimPolicy().staleMs - 50); expect(await releaseTrashClaims('source', 'foreign', undefined, true)).toBe(false); expect(writes).toBe(0);
});
it('មិនទុកសិទ្ធិខ្លួនឯងលើសអាយុអតិបរមា', () => {
    trash(NOW - trashClaimPolicy().refreshMs + 50); expect(trashClaimOwned(server.barcodes[0], 'foreign', NOW)).toBe(false);
});
it('រក្សាពេលថ្មីនៅក្នុងចន្លោះអនាគត', async () => {
    trash(NOW + trashClaimPolicy().futureMs + 50); expect((await claimTrashBarcodes('source', 'mine', () => ['A'])).state).toBe('busy'); expect(writes).toBe(0);
});
it('អនុញ្ញាតការដោះពេលផុតពិត', async () => {
    trash(NOW - trashClaimPolicy().staleMs - 500); expect(await releaseTrashClaims('source', 'foreign', undefined, true)).toBe(true); expect(server.barcodes[0].trashClaim).toBeUndefined();
});
