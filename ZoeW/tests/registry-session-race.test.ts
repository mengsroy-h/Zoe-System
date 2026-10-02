import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dataState, firebaseState, scanState } from '../src/core/state';
import { viewState } from '../src/core/view-state';
import { pendingRegistryReleases } from '../src/core/clock';
import { appLocalStore } from '../src/core/storage';
import { claimBarcodeInRegistry, releaseBarcodesInRegistry, releaseLateBarcodeClaim } from '../src/domain/registry';
import { initFirebase } from '../src/services/firebase-init';
import { setupAuthListener } from '../src/features/auth';

const sb = vi.hoisted(() => ({ sdk: null as any }));
vi.mock('../src/services/supabase-backend', () => ({ createZoeSupabaseSdk: () => sb.sdk }));
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

    it('⛔ ប្ដូរ Firebase ➜ Supabase ៖ callback auth Firebase ចាស់ដែលមកក្រោយ deleteApp មិនប៉ះ backend ថ្មី', async () => {
        let pendingOld: any = null;
        let oldUnsubscribed = false;
        let oldDelivered = false;
        let oldApps: any[] = [{ name: 'old' }];
        const oldFb: any = {
            getApps: () => oldApps,
            deleteApp: async () => {
                oldApps = [];
                await Promise.resolve();
                if (pendingOld && !oldUnsubscribed) { oldDelivered = true; try { pendingOld(null); } catch { void 0; } }
            },
            onAuthStateChanged: (_auth: any, cb: any) => { pendingOld = cb; return () => { oldUnsubscribed = true; }; }
        };
        firebaseState.fb = oldFb;
        firebaseState.auth = { currentUser: null, owner: 'firebase' } as any;
        setupAuthListener();
        expect(pendingOld).toBeTypeOf('function');

        let newCb: any = null;
        let sbApps: any[] = [];
        sb.sdk = {
            __supabase: true,
            getApps: () => sbApps, deleteApp: async () => { sbApps = []; },
            initializeApp: () => { const a = { name: 'sb' }; sbApps.push(a); return a; },
            getAuth: () => ({ currentUser: null, owner: 'supabase' }), getDatabase: () => ({ name: 'sb' }),
            goOnline() {}, off() {}, ref: (db: any, path: string) => ({ db, path }),
            onValue: () => () => {},
            onAuthStateChanged: (_auth: any, cb: any) => { newCb = cb; return () => {}; }
        };
        appLocalStore.setItem('zoew_firebase_config', JSON.stringify({ supabaseUrl: 'https://abcdefghijklmnopqrst.supabase.co', supabaseKey: 'sb_publishable_test' }));
        firebaseState.isInitializingFirebase = false;
        const before = firebaseState.authGeneration;
        expect(await initFirebase()).toBe(true);
        expect(firebaseState.fb).toBe(sb.sdk);
        expect(oldDelivered).toBe(false);
        expect(firebaseState.authGeneration).toBe(before + 1);

        expect(newCb).toBeTypeOf('function');
        try { newCb(null); } catch { void 0; }
        expect(firebaseState.authGeneration).toBe(before + 2);
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
