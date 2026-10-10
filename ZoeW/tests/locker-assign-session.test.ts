import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dataState, firebaseState, uiState } from '../src/core/state';
import { dbListenerFailedPaths, dbListenerPendingPaths } from '../src/core/text';
import { buildLockerBarcodeIndex } from '../src/features/locker';
import { assignLockerToEntry } from '../src/features/locker-assign';

vi.mock('../src/ui/entry-list', async (importOriginal) => ({ ...(await importOriginal<any>()), renderLockerList: () => {} }));
vi.mock('../src/ui/history-refresh', async (importOriginal) => ({ ...(await importOriginal<any>()), refreshCurrentHistoryView: () => {} }));

// ⛔ ការកំណត់ទីតាំង Locker ដែលហួសពេល ១២ វិនាទី ចុះយឺត (ឬបរាជ័យ) **បន្ទាប់ពីចាកចេញ/ប្តូរ Database** ជាលទ្ធផលរបស់ session ចាស់ ៖
//    មិនត្រូវកែទិន្នន័យក្នុងអង្គចងចាំរបស់ session ថ្មី ឬបង្ហាញ ✅/❌ ក្នុង session ថ្មីទេ (ច្បាប់ «Writes ↔ leaving to call»)។
const savedFb = firebaseState.fb;
const savedDb = firebaseState.db;
const toasts = () => uiState.toasts.map((t: any) => String(t.msg || ''));
let settle: { resolve: (v: any) => void; reject: (e: any) => void } | null = null;

function seed() {
    dataState.scanHistory = [{ id: 'a', phone: '0961111111', barcodes: [{ code: 'ZTA001', isClosed: false }] }];
    buildLockerBarcodeIndex();
}
function liveLocker() {
    const entry = uiState.lockerBarcodeIndex['ZTA001'];
    return entry && entry.item.barcodes[entry.barcodeIdx].locker;
}
async function startHungAssignment() {
    seed();
    const task = assignLockerToEntry('ZTA001');
    await vi.advanceTimersByTimeAsync(12001);
    await task;
    expect(toasts().some((m) => m.startsWith('⏳'))).toBe(true);
    uiState.toasts = [];
}
function switchSession() {
    firebaseState.authGeneration++;
    firebaseState.db = { name: 'db-next' } as any;
    seed();
}

beforeEach(() => {
    vi.useFakeTimers();
    dbListenerPendingPaths.clear();
    dbListenerFailedPaths.clear();
    uiState.toasts = [];
    uiState.activeLocker = 'L-02';
    firebaseState.db = { name: 'db' } as any;
    (window as any).ZoeErrors = { capture: vi.fn() };
    firebaseState.fb = {
        ref: (_db: any, path: string) => ({ path }),
        runTransaction: (_ref: any, fn: any) => {
            fn(JSON.parse(JSON.stringify(dataState.scanHistory[0])));
            return new Promise((resolve, reject) => { settle = { resolve, reject }; });
        }
    } as any;
});

afterEach(() => {
    vi.useRealTimers();
    firebaseState.fb = savedFb;
    firebaseState.db = savedDb;
    settle = null;
    delete (window as any).ZoeErrors;
});

describe('Locker ៖ ការកំណត់ទីតាំងចុះយឺតក្រោយប្តូរ session', () => {
    it('ចុះយឺតក្រោយប្តូរ Database ➜ មិនកែទីតាំងក្នុង session ថ្មី · គ្មាន ✅', async () => {
        await startHungAssignment();
        switchSession();
        settle!.resolve({ committed: true, snapshot: { val: () => null } });
        await vi.advanceTimersByTimeAsync(10);
        expect(liveLocker()).toBeUndefined();
        expect(toasts().some((m) => m.indexOf('✅') !== -1)).toBe(false);
    });

    it('បរាជ័យយឺតក្រោយចាកចេញ ➜ គ្មាន ❌ ក្នុង session ថ្មី · គ្មាន Sentry', async () => {
        await startHungAssignment();
        firebaseState.authGeneration++;
        seed();
        settle!.reject(new Error('permission_denied'));
        await vi.advanceTimersByTimeAsync(10);
        expect(toasts().some((m) => m.indexOf('❌') !== -1)).toBe(false);
        expect((window as any).ZoeErrors.capture).not.toHaveBeenCalled();
    });

    it('ទិសផ្ទុយ ៖ session ដដែល ➜ ចុះយឺត ✅ · ទីតាំងក្នុងអង្គចងចាំ = L-02', async () => {
        await startHungAssignment();
        settle!.resolve({ committed: true, snapshot: { val: () => null } });
        await vi.advanceTimersByTimeAsync(10);
        expect(liveLocker()).toBe('L-02');
        expect(toasts().some((m) => m.indexOf('✅ ទីតាំង L-02 បានចុះយឺត') !== -1)).toBe(true);
    });

    it('ទិសផ្ទុយ ៖ session ដដែល ➜ បរាជ័យយឺត ❌', async () => {
        await startHungAssignment();
        settle!.reject(new Error('permission_denied'));
        await vi.advanceTimersByTimeAsync(10);
        expect(toasts().some((m) => m.indexOf('❌') !== -1)).toBe(true);
    });
});
