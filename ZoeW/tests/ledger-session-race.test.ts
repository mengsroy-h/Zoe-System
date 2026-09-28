import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dataState, firebaseState } from '../src/core/state';
import { addRevenueToDailyAndMonthlyRecord, alignMonthlyLedgerToDaily, correctRevenueLedgerToActual, revertRevenueLedgerDelta } from '../src/domain/ledger';

function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((yes) => { resolve = yes; });
    return { promise, resolve };
}
const day = '2026-09-27';
const delta = { cod: 5, dod: 0, count: 1 };
const zero = { cod: 0, dod: 0, count: 0 };
let transaction: ReturnType<typeof vi.fn>;

function switchProject() {
    firebaseState.authGeneration++;
    firebaseState.db = { name: 'next' } as any;
    firebaseState.dbRefDailyRevenue = { db: firebaseState.db, path: 'daily' } as any;
    firebaseState.dbRefMonthlyRevenue = { db: firebaseState.db, path: 'monthly' } as any;
    dataState.dailyRevenueData = { [day]: { codDollar: 100, dodDollar: 0, totalCount: 10 } };
    dataState.monthlyRevenueData = { '2026-09': { codDollar: 100, dodDollar: 0, totalCount: 10 } };
}

beforeEach(() => {
    vi.useFakeTimers();
    switchProject();
    transaction = vi.fn(async () => ({ committed: false }));
    firebaseState.fb = { ref: (db: any, path: string) => ({ db, path }), runTransaction: transaction } as any;
});
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

describe('Ledger ៖ សំណងយឺតមិនប៉ះគម្រោងថ្មី', () => {
    it('ការតម្រឹមថ្ងៃនិងខែយឺត ➜ មិនសរសេរគម្រោងថ្មី', async () => {
        const daily = deferred<typeof delta>();
        const running = alignMonthlyLedgerToDaily('2026-09', daily.promise, Promise.resolve(zero));
        switchProject();
        daily.resolve(delta);
        await running;
        expect(transaction).not.toHaveBeenCalled();
    });

    it('ការកែតម្រូវកំពុងរង់ចាំ ➜ មិនបង្កើត delta ថ្មីក្រោយប្ដូរគម្រោង', async () => {
        const daily = deferred<typeof delta>();
        const running = correctRevenueLedgerToActual(day, { dailyServer: daily.promise, monthlyServer: Promise.resolve(zero) }, 5, 0, 1);
        switchProject();
        daily.resolve(zero);
        await running;
        expect(transaction).not.toHaveBeenCalled();
        expect(dataState.dailyRevenueData[day].codDollar).toBe(100);
    });

    it('សំណងពីការស្កេនវគ្គចាស់ ➜ មិនដកលុយក្នុងសតិវគ្គថ្មី', async () => {
        transaction.mockImplementation(async (_ref: any, update: any) => {
            const value = update(null);
            return { committed: true, snapshot: { val: () => value } };
        });
        const applied = addRevenueToDailyAndMonthlyRecord(day, 5, 0, 1);
        await Promise.all([applied.dailyServer, applied.monthlyServer]);
        switchProject();
        transaction.mockClear();
        revertRevenueLedgerDelta(applied);
        await vi.advanceTimersByTimeAsync(0);
        expect(dataState.dailyRevenueData[day].codDollar).toBe(100);
        expect(transaction).not.toHaveBeenCalled();
    });
});
