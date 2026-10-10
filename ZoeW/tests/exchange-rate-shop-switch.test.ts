import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { dataState, firebaseState } from '../src/core/state';
import { appLocalStore } from '../src/core/storage';
import { detachDatabaseListeners, initDatabaseListeners } from '../src/services/db-listeners';

// ⛔ អត្រាប្រាក់ជាការកំណត់របស់ **ហាង** (`zoew_settings/exchange_rate`) តែ App ទុកច្បាប់ចម្លងក្នុងឧបករណ៍ (`zoew_exchange_rate`) ៖ ហាង B ដែលមិនដែលកំណត់
//    អត្រា (node ទទេ) មិនត្រូវបន្តប្រើអត្រារបស់ហាង A ទេ (ប្រាក់រៀលគណនាខុស · ប្រអប់អត្រាប្រាក់បង្ហាញតម្លៃហាង A) ➜ node ទទេ = លំនាំដើម 4100។
const PATH = 'zoew_settings/exchange_rate';
let listeners: Record<string, any[]> = {};

function deliver(value: any) {
    (listeners[PATH] || []).forEach((l) => l.ok({ val: () => value, exists: () => value !== null && value !== undefined }));
}
function attachShop(name: string) {
    firebaseState.db = { name } as any;
    firebaseState.dbRefExchangeRate = firebaseState.fb.ref(firebaseState.db, PATH);
    detachDatabaseListeners();
    listeners = {};
    initDatabaseListeners();
}

beforeEach(() => {
    appLocalStore.clear();
    listeners = {};
    firebaseState.authGeneration++;
    ['dbRefDailyRevenue', 'dbRefMonthlyRevenue', 'dbRefDailyPickup', 'dbRefDailyCollected', 'dbRefHistory', 'dbRefDeleted', 'dbRefExchangeRate', 'dbRefZtoSignedSweep']
        .forEach((k) => { (firebaseState as any)[k] = null; });
    firebaseState.fb = {
        ref: (_db: unknown, path: string) => ({ path }),
        onValue: (ref: { path: string }, ok: (s: any) => void, fail: (e: any) => void) => {
            (listeners[ref.path] = listeners[ref.path] || []).push({ ok, fail });
            return () => {};
        },
        off: () => {}
    } as any;
});

afterEach(() => {
    detachDatabaseListeners();
    appLocalStore.clear();
});

describe('អត្រាប្រាក់ ៖ ប្តូរហាង', () => {
    it('ហាង A = 4000 ➜ ហាង B គ្មាន node ➜ 4100 (មិនមែន 4000 របស់ហាង A) · ច្បាប់ចម្លងក្នុងឧបករណ៍មិនមែន 4000', () => {
        attachShop('shop-a');
        deliver(4000);
        expect(dataState.exchangeRateRiel).toBe(4000);
        expect(appLocalStore.getItem('zoew_exchange_rate')).toBe('4000');
        attachShop('shop-b');
        deliver(null);
        expect(dataState.exchangeRateRiel).toBe(4100);
        expect(appLocalStore.getItem('zoew_exchange_rate')).not.toBe('4000');
    });

    it('ទិសផ្ទុយ ៖ ហាង B មានអត្រា 4200 ➜ 4200', () => {
        attachShop('shop-a');
        deliver(4000);
        attachShop('shop-b');
        deliver(4200);
        expect(dataState.exchangeRateRiel).toBe(4200);
        expect(appLocalStore.getItem('zoew_exchange_rate')).toBe('4200');
    });
});
