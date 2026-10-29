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
const scanStorageFault = vi.hoisted(() => ({ enabled: false, attempted: 0 }));
vi.mock('../src/core/storage', async (load) => {
    const original: any = await load();
    return { ...original, appLocalStore: new Proxy(original.appLocalStore, {
        get(target, property) {
            if (property === 'setItem') return (key: string, value: string) => {
                if (scanStorageFault.enabled && key.startsWith('zoew_scan_evidence_v1:')) {
                    scanStorageFault.attempted++;
                    throw new DOMException('quota', 'QuotaExceededError');
                }
                return target.setItem(key, value);
            };
            const value = Reflect.get(target, property, target);
            return typeof value === 'function' ? value.bind(target) : value;
        }
    }) };
});
import { ztoPickupStatus } from '../src/features/zto-status';
import { confirmPhone, triggerScanAction } from '../src/features/scan-action';
import { uiState } from '../src/core/state';
import { modalIsOpen } from '../src/core/modals';
import { applyCurrentFilter } from '../src/features/monthly-report';
import { getFormattedDate } from '../src/core/timezone';
import { clearSensitiveModalFields } from '../src/features/session';
import { setFieldValue } from '../src/app/refs';

function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((yes) => { resolve = yes; });
    return { promise, resolve };
}

beforeEach(() => {
    vi.useFakeTimers();
    scanStorageFault.enabled = false; scanStorageFault.attempted = 0;
    const options = { databaseURL: 'https://registry-session-fixture.firebaseio.com' };
    firebaseState.db = { name: 'original', app: { options } } as any;
    firebaseState.auth = { currentUser: { uid: 'registry-user' }, app: { options } } as any;
    appLocalStore.setItem('zoew_firebase_config', JSON.stringify(options));
    firebaseState.authGeneration++;
    scanState.pendingScanSession = null;
    pendingRegistryReleases.clear();
    dataState.scanHistory = [];
    dataState.deletedItems = [];
});
afterEach(() => {
    scanStorageFault.enabled = false;
    vi.restoreAllMocks();
    vi.clearAllTimers(); vi.useRealTimers();
    delete window.firebaseSDK;
    appLocalStore.clear();
    viewState.phoneModalBusy = false;
});

describe('Registry ៖ ការងារចាស់មិនសរសេរគម្រោងថ្មី', () => {
    it('evidence storage quota ធ្លាក់ ➜ confirmPhone មិន claim ឬសរសេរ backend', async () => {
        const writes = vi.fn();
        firebaseState.fb = { ref: (db: any, path: string) => ({ db, path }), runTransaction: writes, set: writes, update: writes } as any;
        uiState.modalDisplay = {}; uiState.isModalOpen = false; uiState.toasts = [];
        for (const name of ['modalPhoneInput', 'modalLockerInput', 'modalCodInput', 'modalDodInput'] as const) setFieldValue(name, '');
        triggerScanAction('QUOTA000123');
        expect(scanState.pendingBarcode).toBe('QUOTA000123');
        expect(scanState.pendingScanSession).toEqual({ db: firebaseState.db, auth: firebaseState.authGeneration });
        expect(firebaseState.auth.currentUser.uid).toBe('registry-user');
        scanStorageFault.enabled = true;
        await confirmPhone(true);
        expect(scanStorageFault.attempted, 'លក្ខខណ្ឌមុន ៖ បានព្យាយាមរក្សា evidence ពិត').toBe(1);
        expect(writes).not.toHaveBeenCalled();
        expect(viewState.phoneModalBusy).toBe(false);
        expect(uiState.toasts.some((toast: any) => String(toast.msg).includes('ទំហំផ្ទុក'))).toBe(true);
        expect(uiState.toasts.some((toast: any) => String(toast.msg).includes('✅'))).toBe(false);
    });

    it('⛔ ហាងប្តូរ (tab ផ្សេង) ពេលប្រអប់ស្កេនបើក ➜ «យល់ព្រម» មិនសរសេរទៅហាងថ្មី · ប្រអប់បិទ', async () => {
        const writes: string[] = [];
        firebaseState.fb = { ref: (db: any, path: string) => ({ db, path }),
            runTransaction: (ref: any) => { writes.push(ref.db.name + ':' + ref.path); return new Promise(() => {}); } } as any;
        uiState.isModalOpen = false;
        uiState.modalDisplay = {};
        uiState.toasts = [];
        triggerScanAction('ZT0001112223334');
        expect(scanState.pendingBarcode, 'លក្ខខណ្ឌមុន ៖ ប្រអប់ស្កេនបើកក្នុងហាង A').toBe('ZT0001112223334');
        firebaseState.db = { name: 'shop-b' } as any;
        firebaseState.authGeneration++;
        void confirmPhone(true);
        for (let i = 0; i < 10; i++) await Promise.resolve();
        expect(writes).toEqual([]);
        expect(modalIsOpen('phoneModal')).toBe(false);
        expect(scanState.pendingBarcode).toBe('');
        expect(uiState.toasts.map((t: any) => String(t.msg)).some((m) => m.includes('ZT0001112223334'))).toBe(true);
        uiState.modalDisplay = {};
        uiState.isModalOpen = false;
    });

    it('control ៖ ហាងដដែល ➜ «យល់ព្រម» ទាមទារ registry ក្នុងហាងនោះ', async () => {
        const writes: string[] = [];
        firebaseState.fb = { ref: (db: any, path: string) => ({ db, path }),
            runTransaction: (ref: any) => { writes.push(ref.db.name + ':' + ref.path); return new Promise(() => {}); } } as any;
        uiState.isModalOpen = false;
        uiState.modalDisplay = {};
        triggerScanAction('ZT0001112223335');
        void confirmPhone(true);
        await Promise.resolve();
        expect(writes.length).toBeGreaterThan(0);
        expect(writes.every((w) => w.startsWith('original:'))).toBe(true);
        uiState.modalDisplay = {};
        uiState.isModalOpen = false;
    });

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

    it('⛔ ប្ដូរហាង ៖ ជួរប្រវត្តិរបស់ហាងចាស់បាត់ពីអេក្រង់ភ្លាម ទោះហាងថ្មីមិនទាន់ផ្ញើទិន្នន័យ', async () => {
        dataState.scanHistory = [{ id: 'old1', phone: '012000111', scanDate: getFormattedDate(), createdAt: Date.now(), isClosed: false,
            barcodes: [{ code: 'OLDSHOP001', cod: 5, dod: 0, isClosed: false }] }] as any;
        uiState.currentFilterMode = 'today';
        applyCurrentFilter();
        expect((uiState.historyView || []).length, 'លក្ខខណ្ឌមុន ៖ ជួរហាង A បង្ហាញ').toBe(1);
        appLocalStore.setItem('zoew_firebase_config', JSON.stringify({ apiKey: 'test', databaseURL: 'https://next-shop.firebaseio.com' }));
        let apps: any[] = [{}];
        window.firebaseSDK = {
            getApps: () => apps, deleteApp: async () => { apps = []; }, initializeApp: () => ({}),
            getAuth: () => ({ currentUser: null }), getDatabase: () => ({ name: 'next-shop' }),
            goOnline() {}, off() {}, ref: (db: any, path: string) => ({ db, path }),
            onValue: () => () => {}, onAuthStateChanged: () => () => {}
        } as any;
        firebaseState.isInitializingFirebase = false;
        expect(await initFirebase()).toBe(true);
        expect(uiState.historyView || []).toEqual([]);
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
        expect(firebaseState.fb.initializeApp).toBe(sb.sdk.initializeApp);
        expect(firebaseState.fb.__connectionOwned).toBe(true);
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
