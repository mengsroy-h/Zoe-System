import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dataState, firebaseState, uiState } from '../src/core/state';
import { resetPickupStats } from '../src/domain/collected';
import { resetClearHistoryOperationState } from '../src/features/clear-history';
import { logoutApp } from '../src/features/auth';

const PATH = 'zoew_daily_pickup_cod_dod';
const DAYS = ['2026-10-22', '2026-10-23'];
const A = { name: 'A' }, B = { name: 'B' };
const copy = (value: any) => value === undefined ? undefined : structuredClone(value);
const record = (code: string, phone = '012345678') => ({ packagesPickedUp: 1, pickedUpPhones: { [phone]: 1 }, pickedUpBarcodes: { [code]: phone } });
const ledgers = { '2026-10-22': { codDollar: 10, dodDollar: 2, totalCount: 1 }, '2026-10-23': { codDollar: 7, dodDollar: 1, totalCount: 1 } };
let stores: Map<any, Record<string, any>>;
let calls: { db: any; day: string }[];
let pending: { db: any; day: string; change: (value: any) => any; resolve: (value: any) => void; reject: (error: Error) => void }[];
let paused: boolean;
function commit(job: typeof pending[number]) {
    const bag = stores.get(job.db)!; const next = job.change(copy(bag[job.day]));
    if (next !== undefined) bag[job.day] = copy(next);
    job.resolve({ committed: next !== undefined, snapshot: { val: () => copy(bag[job.day]) } });
    return next;
}
function startB(sameDb = false, sameGeneration = false) {
    if (!sameDb) firebaseState.db = B;
    if (!sameGeneration) firebaseState.authGeneration++;
    resetClearHistoryOperationState();
    dataState.dailyPickupData = Object.fromEntries(DAYS.map((day) => [day, record('B_' + day)]));
    uiState.toasts = [];
}
beforeEach(() => {
    paused = false; calls = []; pending = [];
    stores = new Map([A, B].map((db) => [db, Object.fromEntries(DAYS.map((day) => [day, record(db.name + '_' + day)]))]));
    firebaseState.authGeneration++; firebaseState.db = A;
    firebaseState.dbRefDailyPickup = { path: PATH } as any;
    firebaseState.fb = {
        ref: (db: any, path: string) => ({ db, path }),
        runTransaction: (ref: any, change: (value: any) => any) => new Promise((resolve, reject) => {
            const day = ref.path.slice(PATH.length + 1); calls.push({ db: ref.db, day });
            const job = { db: ref.db, day, change, resolve, reject };
            if (paused) pending.push(job); else commit(job);
        })
    } as any;
    dataState.dailyPickupData = copy(stores.get(A)); dataState.dailyRevenueData = copy(ledgers);
    dataState.monthlyRevenueData = { '2026-10': { codDollar: 17, dodDollar: 3, totalCount: 2 } };
    dataState.scanHistory = [{ id: 'item1', isClosed: true, barcodes: [{ code: 'parcel', isClosed: true }] }]; dataState.deletedItems = [];
    dataState.pickupResetInFlight = false; uiState.currentFilterMode = 'all'; uiState.toasts = [];
    vi.stubGlobal('confirm', () => true); (window as any).ZoeErrors = { capture: vi.fn() };
});
afterEach(() => { vi.unstubAllGlobals(); delete (window as any).ZoeErrors; dataState.pickupResetInFlight = false; firebaseState.auth = null; });

describe('Reset ច្រើនថ្ងៃ៖ រក្សាម្ចាស់ session និងមិនប៉ះ COD/DOD', () => {
    it('session ដដែល៖ Reset គ្រប់ថ្ងៃ រក្សាប្រាក់ និងបញ្ជីបិទដដែល', async () => {
        const history = copy(dataState.scanHistory), month = copy(dataState.monthlyRevenueData);
        await resetPickupStats();
        expect(calls).toEqual(DAYS.map((day) => ({ db: A, day })));
        expect(stores.get(A)).toEqual(Object.fromEntries(DAYS.map((day) => [day, { packagesPickedUp: 0 }])));
        expect(dataState.dailyRevenueData).toEqual(ledgers); expect(dataState.monthlyRevenueData).toEqual(month); expect(dataState.scanHistory).toEqual(history);
        expect(dataState.pickupResetInFlight).toBe(false);
    });

    it.each(['database', 'auth', 'both'] as const)('%s ប្តូរពេល ACK ទីមួយរង់ចាំ៖ មិនសរសេរថ្ងៃទីពីរ ឬជាន់សតិថ្មី', async (kind) => {
        paused = true; const running = resetPickupStats(); expect(pending).toHaveLength(1);
        const old = pending.shift()!; const next = old.change(copy(stores.get(A)![old.day])); stores.get(A)![old.day] = copy(next);
        startB(kind === 'auth', kind === 'database'); const newView = copy(dataState.dailyPickupData); const newServer = copy(stores.get(B));
        paused = false; old.resolve({ committed: true, snapshot: { val: () => copy(next) } }); await running;
        expect(calls).toEqual([{ db: A, day: DAYS[0] }]);
        expect(dataState.dailyPickupData).toEqual(newView); expect(stores.get(B)).toEqual(newServer); expect(uiState.toasts).toEqual([]);
        expect(dataState.dailyRevenueData).toEqual(ledgers);
    });

    it('session ប្តូរមុន updater replay៖ callback ចាស់ត្រូវ abort', async () => {
        paused = true; const running = resetPickupStats(); const old = pending.shift()!; const before = copy(stores.get(A));
        startB(); paused = false;
        expect(commit(old)).toBeUndefined(); await running;
        expect(stores.get(A)).toEqual(before); expect(calls).toHaveLength(1);
    });

    it.each(['success', 'failure'] as const)('logout ពិតកំពុងរង់ចាំ %s៖ owner ចាស់មិនអាច Reset បន្ត', async (outcome) => {
        let finishLogout!: () => void, failLogout!: (error: Error) => void;
        const logoutReply = new Promise<void>((resolve, reject) => { finishLogout = resolve; failLogout = reject; });
        firebaseState.auth = { currentUser: { uid: 'A' } } as any;
        firebaseState.fb.signOut = () => logoutReply;
        paused = true; const running = resetPickupStats(); const old = pending.shift()!;
        const before = copy(stores.get(A)), viewBefore = copy(dataState.dailyPickupData), generation = firebaseState.authGeneration;
        const logout = logoutApp();
        expect(firebaseState.authGeneration).toBeGreaterThan(generation);
        paused = false; const proposed = commit(old); await running;
        expect(proposed).toBeUndefined(); expect(calls).toHaveLength(1);
        expect(stores.get(A)).toEqual(before); expect(dataState.dailyPickupData).toEqual(viewBefore);
        expect(dataState.dailyRevenueData).toEqual(ledgers); expect(uiState.toasts).toEqual([]);
        if (outcome === 'success') finishLogout(); else failLogout(new Error('logout delayed failure'));
        await logout;
        expect(dataState.pickupResetInFlight).toBe(false);
    });

    it.each(['success', 'failure'] as const)('ចម្លើយចាស់ %s មិនដោះ busy flag របស់ Reset ថ្មី', async (outcome) => {
        paused = true; const oldRun = resetPickupStats(); const old = pending.shift()!;
        startB(); const newRun = resetPickupStats(); const fresh = pending.shift()!;
        expect(fresh.db).toBe(B); expect(dataState.pickupResetInFlight).toBe(true);
        paused = false;
        if (outcome === 'failure') old.reject(new Error('permission_denied')); else commit(old);
        await oldRun; expect(dataState.pickupResetInFlight).toBe(true); expect(uiState.toasts).toEqual([]);
        paused = false; commit(fresh); await newRun;
        expect(dataState.pickupResetInFlight).toBe(false); expect(stores.get(B)).toEqual(Object.fromEntries(DAYS.map((day) => [day, { packagesPickedUp: 0 }])));
    });

    it('សញ្ញា reset operation ត្រូវការពារ Reset ថ្មីក្នុង session ដដែលផងដែរ', async () => {
        paused = true; const oldRun = resetPickupStats(); const old = pending.shift()!;
        resetClearHistoryOperationState(); const newRun = resetPickupStats(); const fresh = pending.shift()!;
        paused = false; const proposed = commit(old); await oldRun;
        expect(proposed).toBeUndefined(); expect(dataState.pickupResetInFlight).toBe(true);
        paused = false; commit(fresh); await newRun; expect(dataState.pickupResetInFlight).toBe(false);
    });
});
