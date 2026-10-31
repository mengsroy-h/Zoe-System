import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { dataState, firebaseState } from '../src/core/state';
import { appLocalStore } from '../src/core/storage';
import { dbListenerFailedPaths, dbListenerPendingPaths } from '../src/core/text';
import * as pickup from '../src/domain/pickup';

const DAY = '2026-10-30';
const PATH = 'zoew_daily_pickup_cod_dod/' + DAY;
const clone = (value: any) => value == null ? value : JSON.parse(JSON.stringify(value));
const snapshot = (value: any) => ({ val: () => clone(value) });

function heldSdk() {
    let ready!: () => void;
    let resolve!: (value: any) => void;
    const entered = new Promise<void>(done => { ready = done; });
    const gate = new Promise<any>(done => { resolve = done; });
    const sdk = {
        ref: (_db: any, path: string) => ({ path }),
        get: async ({ path }: any) => {
            if (path !== PATH) return snapshot({});
            ready();
            return snapshot(await gate);
        },
        runTransaction: vi.fn(async () => { throw new Error('Reset-cancelled recovery must not write pickup'); })
    };
    return { sdk, entered, resolve };
}

beforeEach(() => {
    appLocalStore.clear();
    appLocalStore.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: 'https://pickup-resume-owner.invalid' }));
    firebaseState.auth = { currentUser: { uid: 'resume-owner' } } as any;
    firebaseState.authGeneration++;
    firebaseState.isInitializingFirebase = false;
    firebaseState.db = {} as any;
    dataState.scanHistory = [];
    dataState.deletedItems = [];
    dataState.dailyPickupData = {};
    dataState.pickupResumeInFlight = false;
    dbListenerFailedPaths.clear();
    dbListenerPendingPaths.clear();
    pickup.pickupIntentsLive.clear();
    vi.stubGlobal('navigator', { locks: undefined });
});

afterEach(() => {
    for (const id of pickup.pickupIntentsLive) pickup.releasePickupIntent(id);
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    appLocalStore.clear();
});

it.each(['auth', 'database'] as const)('ម្ចាស់ resume ចាស់មិនដោះ busy របស់ session ថ្មី (%s)', async (changed) => {
    const old = heldSdk();
    let active = old;
    const sdk = { ...old.sdk, get: (ref: any) => active.sdk.get(ref) };
    firebaseState.fb = sdk as any;
    const id = pickup.beginPickupIntent(DAY, ['RESUME_OWNER'], 'item1');
    expect(id).toBeTruthy();
    expect(pickup.patchPickupJournalEntry(id, { stage: 'started', transitionKnown: true, allowedAddKeys: [], pickupResetEpoch: 0 })).toBe(true);
    pickup.releasePickupIntent(id);
    const earlier = pickup.resumePickupIntents();
    await old.entered;
    expect(dataState.pickupResumeInFlight).toBe(true);

    if (changed === 'auth') firebaseState.authGeneration++;
    else firebaseState.db = {} as any;
    const current = heldSdk();
    active = current;
    const later = pickup.resumePickupIntents();
    await current.entered;
    expect(dataState.pickupResumeInFlight).toBe(true);

    old.resolve({ pickupRevision: 2, pickupResetEpoch: 1, packagesPickedUp: 0 });
    try {
        await earlier;
        expect(dataState.pickupResumeInFlight).toBe(true);
        expect(pickup.readPickupJournal()).toHaveLength(1);
        expect(old.sdk.runTransaction).not.toHaveBeenCalled();
    } finally {
        current.resolve({ pickupRevision: 2, pickupResetEpoch: 1, packagesPickedUp: 0 });
        await later;
    }
    expect(dataState.pickupResumeInFlight).toBe(false);
    expect(pickup.readPickupJournal()).toEqual([]);
    expect(sdk.runTransaction).not.toHaveBeenCalled();
});
