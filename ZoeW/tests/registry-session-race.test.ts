import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dataState, firebaseState, scanState } from '../src/core/state';
import { viewState } from '../src/core/view-state';
import { pendingRegistryReleases } from '../src/core/clock';
import { appLocalStore } from '../src/core/storage';
import { claimBarcodeInRegistry, releaseBarcodesInRegistry, releaseLateBarcodeClaim } from '../src/domain/registry';
import { initFirebase } from '../src/services/firebase-init';
import { ztoPickupStatus } from '../src/features/zto-status';
import { confirmPhone } from '../src/features/scan-action';
import { clearSensitiveModalFields } from '../src/features/session';

function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((yes) => { resolve = yes; });
    return { promise, resolve };
}

beforeEach(() => {
    vi.useFakeTimers();
    firebaseState.db = { name: 'original' } as any;
    firebaseState.authGeneration++;
    pendingRegistryReleases.clear();
    dataState.scanHistory = [];
    dataState.deletedItems = [];
});
afterEach(() => {
    vi.clearAllTimers(); vi.useRealTimers();
    delete window.firebaseSDK;
    appLocalStore.clear();
    viewState.phoneModalBusy = false;
});

describe('Registry ៖ ការងារចាស់មិនសរសេរគម្រោងថ្មី', () => {
    it('logout កណ្ដាល claim ➜ ដោះសោ form ហើយ callback ចាស់មិនដោះសោការ save ថ្មី', async () => {
        const claim = deferred<any>();
        firebaseState.fb = { ref: (db: any, path: string) => ({ db, path }), runTransaction: () => claim.promise } as any;
        scanState.pendingBarcode = 'ZTO123';
        const running = confirmPhone(true);
        expect(viewState.phoneModalBusy).toBe(true);
        firebaseState.authGeneration++;
        clearSensitiveModalFields();
        expect(viewState.phoneModalBusy).toBe(false);
        viewState.phoneModalBusy = true;
        claim.resolve({ committed: true });
        await running;
        expect(viewState.phoneModalBusy).toBe(true);
    });

    it('ប្ដូរ Firebase project ពិត ➜ សម្អាត retry queue និងសាលក្រម ZTO ចាស់', async () => {
        pendingRegistryReleases.set('OLD_CODE', { attempts: 1 });
        dataState.registryReleaseFlushInFlight = true;
        ztoPickupStatus.set('OLD_CODE', { closed: true, at: Date.now() });
        appLocalStore.setItem('zoew_firebase_config', JSON.stringify({ apiKey: 'test', databaseURL: 'https://next.firebaseio.com' }));
        let apps: any[] = [{}];
        window.firebaseSDK = {
            getApps: () => apps, deleteApp: async () => { apps = []; }, initializeApp: () => ({}),
            getAuth: () => ({ currentUser: null }), getDatabase: () => ({ name: 'next' }),
            goOnline() {}, off() {}, ref: (db: any, path: string) => ({ db, path }),
            onValue: () => () => {}, onAuthStateChanged: () => () => {}
        } as any;
        firebaseState.isInitializingFirebase = false;
        expect(await initFirebase()).toBe(true);
        expect(pendingRegistryReleases.size).toBe(0);
        expect(dataState.registryReleaseFlushInFlight).toBe(false);
        expect(ztoPickupStatus.size).toBe(0);
    });

    it('claim ត្រឡប់ក្រោយប្ដូរគម្រោង ➜ មិនអនុញ្ញាតឲ្យរក្សាទុកក្នុងគម្រោងថ្មី', async () => {
        const result = deferred<any>();
        firebaseState.fb = { ref: (db: any, path: string) => ({ db, path }), runTransaction: () => result.promise } as any;
        const running = claimBarcodeInRegistry('ZTO123');
        firebaseState.db = { name: 'next' } as any;
        firebaseState.authGeneration++;
        result.resolve({ committed: true });
        expect(await running).toBe('unknown');
    });

    it('late claim ➜ មិនដោះលេខដូចគ្នានៅគម្រោងថ្មី', async () => {
        const result = deferred<string>();
        const update = vi.fn(async () => {});
        firebaseState.fb = { ref: (db: any, path: string) => ({ db, path }), update } as any;
        releaseLateBarcodeClaim(result.promise, 'ZTO123');
        firebaseState.db = { name: 'next' } as any;
        firebaseState.authGeneration++;
        result.resolve('claimed');
        await vi.advanceTimersByTimeAsync(0);
        expect(update).not.toHaveBeenCalled();
    });

    it('retry ដោះលេខ ➜ មិនបន្តសរសេរ ឬដាក់ជួរក្នុងគម្រោងថ្មី', async () => {
        const update = vi.fn(() => Promise.reject(new Error('disconnect')));
        firebaseState.fb = { ref: (db: any, path: string) => ({ db, path }), update } as any;
        const running = releaseBarcodesInRegistry(['ZTO123']);
        await vi.advanceTimersByTimeAsync(0);
        expect(update).toHaveBeenCalledOnce();
        firebaseState.db = { name: 'next' } as any;
        firebaseState.authGeneration++;
        await vi.advanceTimersByTimeAsync(10000);
        await running;
        expect(update).toHaveBeenCalledOnce();
        expect(pendingRegistryReleases.size).toBe(0);
    });
});
