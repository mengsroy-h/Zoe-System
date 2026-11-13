import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { dataState, firebaseState } from '../../../ZoeW/src/core/state';
import { appLocalStore } from '../../../ZoeW/src/core/storage';
import { dbListenerFailedPaths, dbListenerPendingPaths } from '../../../ZoeW/src/core/text';
import * as pickup from '../../../ZoeW/src/domain/pickup';

/**
 * ថ្ងៃថ្មី ៖ lane ពីរបិទកញ្ចប់ដំបូងក្នុងពេលតែមួយ ➜ ទាំងពីរបង្កើត record ថ្ងៃ (revision 1)។ transaction របស់ lane B ឃើញតម្លៃ
 * optimistic របស់ lane A ក្នុង cache ➜ abort នៅលើឧបករណ៍ (committed:false) ហើយការអាន server របស់ B អាចមកដល់មុនការសរសេររបស់ A។
 * មុនកែ ➜ PICKUP_FENCE_UNCONFIRMED ភ្លាម ➜ ការបិទ (import Sign) បរាជ័យ ហើយ collected មិនដែលសរសេរ (emu/import-native-I100 ធ្លាក់ម្តងៗលើ CI)។
 * ឥឡូវ B រង់ចាំ revision របស់ A តាមចន្លោះកំណត់ (មានព្រំដែន) ⛔ មិនរង់ចាំពេល transaction របស់ខ្លួន commit តែ server មិនឃើញ។
 */

const DAY = '2026-10-30', PATH = 'zoew_daily_pickup_cod_dod/' + DAY;
const LANDED = { packagesPickedUp: 0, pickupRevision: 1, pickupResetEpoch: 0 };
const clone = (value: any) => value == null ? value : JSON.parse(JSON.stringify(value));
let reads: number, transactions: number, landAfterReads: number, ownCommits: boolean, onDelay: (() => void) | null;

function sdk() {
    return {
        ref: (_db: any, path: string) => ({ path }),
        get: async ({ path }: any) => {
            if (path !== PATH) return { val: () => null };
            reads++;
            if (onDelay && reads === 2) onDelay();
            return { val: () => (reads > landAfterReads ? clone(LANDED) : null) };
        },
        runTransaction: async (_ref: any, updater: any) => {
            transactions++;
            if (ownCommits) {
                const next = updater(null);
                return { committed: next !== undefined, snapshot: { val: () => clone(next) } };
            }
            const next = updater(clone(LANDED));
            return { committed: next !== undefined, snapshot: { val: () => clone(LANDED) } };
        }
    };
}

beforeEach(() => {
    reads = 0; transactions = 0; landAfterReads = 2; ownCommits = false; onDelay = null; appLocalStore.clear();
    appLocalStore.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: 'https://pickup-creation-race.test' }));
    firebaseState.auth = { currentUser: { uid: 'user1' } } as any;
    firebaseState.db = {} as any; firebaseState.fb = sdk() as any; firebaseState.authGeneration++;
    firebaseState.isInitializingFirebase = false;
    dataState.dailyPickupData = {}; dataState.scanHistory = []; dataState.deletedItems = [];
    dbListenerFailedPaths.clear(); dbListenerPendingPaths.clear(); pickup.pickupIntentsLive.clear();
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); appLocalStore.clear(); });

it('a lane whose creation aborts locally behind another lane waits for that lane\'s revision instead of failing the close', async () => {
    const context = await pickup.capturePickupContext(DAY);
    expect(context.revision).toBe(1);
    expect(context.epoch).toBe(0);
    expect(transactions).toBe(2);
    expect(reads).toBe(3);
});

it('control ៖ our own committed creation that the server read does not show still fails at once (no retry)', async () => {
    ownCommits = true; landAfterReads = Infinity;
    await expect(pickup.capturePickupContext(DAY)).rejects.toThrow('PICKUP_FENCE_UNCONFIRMED');
    expect(transactions).toBe(1);
});

it('bounded ៖ a revision that never appears fails after PICKUP_FENCE_CONFIRM_TRIES attempts', async () => {
    vi.useFakeTimers();
    landAfterReads = Infinity;
    const outcome = pickup.capturePickupContext(DAY).then(() => 'resolved', (error: any) => String(error?.message));
    await vi.runAllTimersAsync();
    expect(await outcome).toBe('PICKUP_FENCE_UNCONFIRMED');
    expect(transactions).toBe(pickup.PICKUP_FENCE_CONFIRM_TRIES);
    expect(pickup.PICKUP_FENCE_CONFIRM_TRIES).toBeGreaterThan(1);
});

it('a session switch during the wait stops the retries (no write for the old session)', async () => {
    vi.useFakeTimers();
    landAfterReads = Infinity;
    onDelay = () => { setTimeout(() => { firebaseState.authGeneration++; }, 10); };
    const outcome = pickup.capturePickupContext(DAY).then(() => 'resolved', (error: any) => String(error?.message));
    await vi.runAllTimersAsync();
    expect(await outcome).toBe('PICKUP_CONTEXT_CHANGED');
    expect(transactions).toBe(1);
});
