// ⛔ `exchangeRateSaveInFlight` រស់រានឆ្លង logout ដោយចេតនា (state-hygiene ៖ «settles in finally or its late handlers») ៖ ការសរសេរដែលព្យួរ
//    (offline ➜ RTDB ដាក់ក្នុងជួរ) ចុះពេលបណ្តាញមកវិញ ហើយ late handler ដោះសោ។ តែការប្តូរ Config/backend (`initFirebase()` ➜ `deleteApp()`)
//    សម្លាប់ជួរនោះ ៖ វាស់លើ Firebase SDK ពិត (emulator) ➜ `set()` ដែលរង់ចាំ **មិន settle ទាល់តែសោះ** ក្រោយ `deleteApp()` ➜ late handler មិនដែលរត់
//    ➜ សោជាប់ `true` ➜ ប៊ូតុង «រក្សាទុកអត្រាប្រាក់» return 'pending' ស្ងាត់រហូតដល់ reload។ teardown ត្រូវដោះសោនេះ (ការសរសេរចាស់ស្លាប់ ➜ គ្មានការប្រណាំង)។
//    ទិសផ្ទុយ ៖ គ្មាន teardown ➜ សោនៅ (ការសរសេរចាស់នៅរស់ ➜ ការចុចលើកទី ២ នៅ 'pending')។
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dataState, firebaseState } from '../src/core/state';
import { appLocalStore } from '../src/core/storage';
import { saveExchangeRate } from '../src/features/exchange-rate';
import { initFirebase } from '../src/services/firebase-init';
import { DB_OP_TIMEOUT_MS } from '../src/services/network';

vi.mock('../src/services/supabase-backend', () => ({ createZoeSupabaseSdk: () => null }));

function fakeSdk(name: string, setImpl: () => Promise<void>) {
    let apps: any[] = [{ name }];
    const sets: any[] = [];
    const box = { setImpl };
    const sdk: any = {
        getApps: () => apps,
        deleteApp: async () => { apps = []; },
        initializeApp: () => { const a = { name }; apps.push(a); return a; },
        getAuth: () => ({ currentUser: null, owner: name }),
        getDatabase: () => ({ name }),
        goOnline() {},
        off() {},
        ref: (db: any, path: string) => ({ owner: name, db, path }),
        onValue: () => () => {},
        onAuthStateChanged: () => () => {},
        set: (ref: any, value: any) => { sets.push({ ref, value }); return box.setImpl(); }
    };
    return { sdk, sets, box };
}

beforeEach(() => {
    vi.useFakeTimers();
    firebaseState.authGeneration++;
    firebaseState.isInitializingFirebase = false;
    dataState.exchangeRateSaveInFlight = false;
});
afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    delete (window as any).firebaseSDK;
    appLocalStore.clear();
    dataState.exchangeRateSaveInFlight = false;
});

async function stallFirstSave(old: ReturnType<typeof fakeSdk>) {
    firebaseState.fb = old.sdk;
    firebaseState.db = { name: 'old' } as any;
    firebaseState.dbRefExchangeRate = { owner: 'old', path: 'zoew_exchange_rate' } as any;
    const first = saveExchangeRate();
    await vi.advanceTimersByTimeAsync(DB_OP_TIMEOUT_MS + 50);
    expect(await first).toBe('pending');
    expect(dataState.exchangeRateSaveInFlight).toBe(true);
}

describe('exchange-rate mutex ↔ backend teardown', () => {
    it('⛔ a stalled rate save, then Config change (deleteApp) ➜ the next save is sent through the new app (not a silent pending)', async () => {
        const old = fakeSdk('fb-old', () => new Promise<void>(() => {}));
        await stallFirstSave(old);
        old.box.setImpl = () => Promise.resolve();
        (window as any).firebaseSDK = old.sdk;
        appLocalStore.setItem('zoew_firebase_config', JSON.stringify({ apiKey: 'test', databaseURL: 'https://next.firebaseio.com' }));
        const generationBefore = firebaseState.authGeneration;
        expect(await initFirebase()).toBe(true);
        expect(firebaseState.authGeneration).toBeGreaterThan(generationBefore);
        firebaseState.dbRefExchangeRate = firebaseState.fb.ref(firebaseState.db, 'zoew_exchange_rate');
        const second = saveExchangeRate();
        await vi.advanceTimersByTimeAsync(10);
        expect(await second).toBe('done');
        expect(old.sets.length).toBe(2);
        expect(dataState.exchangeRateSaveInFlight).toBe(false);
    });

    it('reverse ៖ no teardown ➜ the stalled write is still alive ➜ a second save stays pending (no overlapping rate writes)', async () => {
        const old = fakeSdk('fb-old', () => new Promise<void>(() => {}));
        await stallFirstSave(old);
        expect(await saveExchangeRate()).toBe('pending');
        expect(old.sets.length).toBe(1);
    });
});
