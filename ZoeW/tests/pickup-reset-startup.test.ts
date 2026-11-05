import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { firebaseState } from '../src/core/state';
import { appLocalStore } from '../src/core/storage';
import { resumePickupResetOutcomes } from '../src/services/pickup-reset';
import { initDatabaseListeners } from '../src/services/db-listeners';
vi.mock('../src/services/pickup-reset', () => ({ resumePickupResetOutcomes: vi.fn(async () => ({ checked: 0, resolved: 0, held: true })) }));

beforeEach(() => {
    vi.clearAllMocks(); appLocalStore.clear();
    firebaseState.authGeneration++;
    firebaseState.db = { app: { options: { projectId: 'demo-reset-project', databaseURL: 'https://demo-reset-project.firebaseio.com' } } } as any;
    firebaseState.auth = { currentUser: { uid: 'synthetic-owner' } } as any;
    firebaseState.fb = { onValue: vi.fn(), off: vi.fn(), ref: vi.fn((_db, path) => ({ path })), executePickupReset: vi.fn() } as any;
    firebaseState.isDatabaseInitialized = false;
    for (const name of ['dbRefExchangeRate','dbRefDailyRevenue','dbRefMonthlyRevenue','dbRefDailyPickup','dbRefDailyCollected','dbRefHistory','dbRefDeleted','dbRefZtoSignedSweep','dbRefZtoTrashMode','dbRefZtoSweepLane']) firebaseState[name] = null;
    vi.mocked(resumePickupResetOutcomes).mockImplementation(async () => ({ checked: 0, resolved: 0, held: true }));
});
afterEach(() => vi.restoreAllMocks());

describe('pickup Reset restart status hook', () => {
    it('starts status-only recovery after authenticated listener initialization', async () => {
        vi.mocked(resumePickupResetOutcomes).mockImplementationOnce(async () => {
            expect(firebaseState.isDatabaseInitialized).toBe(true);
            return { checked: 1, resolved: 0, held: true };
        });
        expect(initDatabaseListeners()).toBe(true);
        await Promise.resolve();
        expect(resumePickupResetOutcomes).toHaveBeenCalledTimes(1);
        expect(firebaseState.fb.executePickupReset).not.toHaveBeenCalled();
    });
    it('does not start recovery without a current authenticated actor', () => {
        firebaseState.auth.currentUser = null;
        expect(initDatabaseListeners()).toBe(true);
        expect(resumePickupResetOutcomes).not.toHaveBeenCalled();
        expect(firebaseState.fb.executePickupReset).not.toHaveBeenCalled();
    });
    it('retains original pending evidence if automatic status initialization rejects', async () => {
        appLocalStore.setItem('zoew_pickup_reset_pending_v2:synthetic-original', 'retained-original-evidence');
        vi.mocked(resumePickupResetOutcomes).mockRejectedValueOnce(new Error('synthetic status failure'));
        expect(initDatabaseListeners()).toBe(true);
        await Promise.resolve(); await Promise.resolve();
        expect(appLocalStore.getItem('zoew_pickup_reset_pending_v2:synthetic-original')).toBe('retained-original-evidence');
        expect(firebaseState.fb.executePickupReset).not.toHaveBeenCalled();
    });
});
