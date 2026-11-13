import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { refTo } from '../../../ZoeW/src/app/refs';
import { dataState, firebaseState } from '../../../ZoeW/src/core/state';
import { appLocalStore } from '../../../ZoeW/src/core/storage';
import { saveExchangeRate } from '../../../ZoeW/src/features/exchange-rate';
import { monthlyReportRiel } from '../../../ZoeW/src/features/monthly-report';
import { detachDatabaseListeners, initDatabaseListeners } from '../../../ZoeW/src/services/db-listeners';
import { DB_OP_TIMEOUT_MS } from '../../../ZoeW/src/services/network';

const PATH = 'zoew_settings/exchange_rate';
let listener: (snapshot: { val: () => unknown }) => void;
let rejectWrite: (error: Error) => void;
let write: ReturnType<typeof vi.fn>;
const turn = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };

beforeEach(() => {
    vi.useFakeTimers();
    appLocalStore.clear();
    firebaseState.authGeneration++;
    firebaseState.auth = { currentUser: { uid: 'rate-view-user' } } as any;
    firebaseState.db = { id: 'rate-view-shop' } as any;
    firebaseState.firebaseConfig = { databaseURL: 'https://rate-view.invalid' };
    firebaseState.dbListenersFailed = false;
    dataState.exchangeRateSaveInFlight = false;
    dataState.exchangeRateSaveOperation = null;
    for (const key of ['dbRefDailyRevenue', 'dbRefMonthlyRevenue', 'dbRefDailyPickup', 'dbRefDailyCollected',
        'dbRefHistory', 'dbRefDeleted', 'dbRefZtoSignedSweep', 'dbRefZtoTrashMode', 'dbRefZtoSweepLane']) firebaseState[key] = null;
    const pending = new Promise<void>((_resolve, reject) => { rejectWrite = reject; });
    write = vi.fn(() => pending);
    firebaseState.fb = {
        ref: (_database, path) => ({ path }),
        onValue: (_ref, callback) => { listener = callback; return () => {}; },
        off: vi.fn(), set: write
    } as any;
    firebaseState.dbRefExchangeRate = firebaseState.fb.ref(firebaseState.db, PATH);
    initDatabaseListeners();
    listener({ val: () => 4100 });
    const input = document.createElement('input');
    input.value = '4300';
    refTo('exchangeRateInput')(input);
});

afterEach(() => {
    detachDatabaseListeners();
    refTo('exchangeRateInput')(null);
    appLocalStore.clear();
    vi.clearAllTimers();
    vi.useRealTimers();
});

describe('អត្រាប្រាក់៖ ចម្លើយសរសេរបរាជ័យមិនជំនួស snapshot ថ្មី', () => {
    for (const late of [false, true]) {
        for (const rate of [4200, 4300, null]) {
            it(`${late ? 'ក្រោយ timeout' : 'មុន timeout'}៖ snapshot ${rate} រក្សាតម្លៃតារាង និង storage`, async () => {
                const saving = saveExchangeRate();
                await turn();
                expect(write).toHaveBeenCalledExactlyOnceWith(firebaseState.dbRefExchangeRate, 4300);
                expect(dataState.exchangeRateRiel).toBe(4300);
                if (late) {
                    await vi.advanceTimersByTimeAsync(DB_OP_TIMEOUT_MS + 1);
                    expect(await saving).toBe('pending');
                }
                listener({ val: () => rate });
                const expected = rate ?? 4100;
                const stored = appLocalStore.getItem('zoew_exchange_rate');
                expect(monthlyReportRiel(2)).toBe(expected * 2);
                rejectWrite(new Error('permission_denied'));
                if (!late) expect(await saving).toBe('failed');
                await turn();
                expect(dataState.exchangeRateSaveInFlight).toBe(false);
                expect(dataState.exchangeRateRiel).toBe(expected);
                expect(monthlyReportRiel(2)).toBe(expected * 2);
                expect(appLocalStore.getItem('zoew_exchange_rate')).toBe(stored);
                expect(write).toHaveBeenCalledTimes(1);
            });
        }

        it(`${late ? 'ក្រោយ timeout' : 'មុន timeout'}៖ គ្មាន snapshot ថ្មី នៅតែស្តារអត្រាមុន`, async () => {
            const saving = saveExchangeRate();
            await turn();
            if (late) {
                await vi.advanceTimersByTimeAsync(DB_OP_TIMEOUT_MS + 1);
                expect(await saving).toBe('pending');
            }
            rejectWrite(new Error('permission_denied'));
            if (!late) expect(await saving).toBe('failed');
            await turn();
            expect(dataState.exchangeRateRiel).toBe(4100);
            expect(appLocalStore.getItem('zoew_exchange_rate')).toBe('4100');
            expect(dataState.exchangeRateSaveInFlight).toBe(false);
        });
    }

    it('snapshot ពី listener ចាស់ត្រូវបានបដិសេធ មិនរារាំង rollback របស់ session បច្ចុប្បន្ន', async () => {
        const stale = listener;
        initDatabaseListeners();
        const saving = saveExchangeRate();
        await turn();
        stale({ val: () => 4200 });
        expect(dataState.exchangeRateRiel).toBe(4300);
        rejectWrite(new Error('permission_denied'));
        expect(await saving).toBe('failed');
        expect(dataState.exchangeRateRiel).toBe(4100);
    });

    it('snapshot មិនត្រឹមត្រូវមិនរារាំង rollback', async () => {
        const saving = saveExchangeRate();
        await turn();
        listener({ val: () => 'invalid-rate' });
        expect(dataState.exchangeRateRiel).toBe(4300);
        rejectWrite(new Error('permission_denied'));
        expect(await saving).toBe('failed');
        expect(dataState.exchangeRateRiel).toBe(4100);
    });

    it('ប្ដូរ session មុន rejection មិនស្តារតម្លៃពី session ចាស់ ទោះគ្មាន snapshot ថ្មី', async () => {
        const saving = saveExchangeRate();
        await turn();
        firebaseState.authGeneration++;
        dataState.exchangeRateRiel = 4200;
        appLocalStore.setItem('zoew_exchange_rate', '4200');
        rejectWrite(new Error('permission_denied'));
        expect(await saving).toBe('failed');
        expect(dataState.exchangeRateRiel).toBe(4200);
        expect(appLocalStore.getItem('zoew_exchange_rate')).toBe('4200');
    });
});
