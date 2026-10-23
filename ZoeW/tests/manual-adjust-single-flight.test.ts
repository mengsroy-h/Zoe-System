import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fields = vi.hoisted(() => ({} as Record<string, string>));
vi.mock('../src/app/refs', async (original) => {
    const real: any = await original();
    return { ...real, fieldValue: (name: string) => fields[name] || '', setFieldValue: (name: string, value: string) => { fields[name] = value; }, focusField: () => {} };
});

import { dataState, firebaseState, uiState } from '../src/core/state';
import { viewState } from '../src/core/view-state';
import { openManualAdjustModal, submitManualAdjustment } from '../src/features/stats-modals';
import { clearSensitiveModalFields } from '../src/features/session';

const DAY = '2026-10-23';
const MONTH = DAY.slice(0, 7);
const DAILY = 'zoew_daily_revenue_cod_dod/' + DAY;
const MONTHLY = 'zoew_monthly_revenue_cod_dod';
type Pending = { path: string; update: (value: any) => any; resolve: (value: any) => void };
let pending: Pending[];
let server: Record<string, any>;
const savedFb = firebaseState.fb;
const clone = (value: any) => value === undefined ? undefined : structuredClone(value);
const flush = async () => { for (let i = 0; i < 12; i++) await vi.advanceTimersByTimeAsync(0); };

function fill() {
    fields.manualDateInput = DAY;
    fields.manualCodChangeInput = '5';
    fields.manualDodChangeInput = '1.25';
    fields.manualCountChangeInput = '1';
}

function commit(batch = pending.splice(0)) {
    batch.forEach(({ path, update, resolve }) => {
        const next = update(clone(server[path]));
        if (next !== undefined) server[path] = clone(next);
        resolve({ committed: next !== undefined, snapshot: { val: () => clone(server[path]) } });
    });
}

beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('alert', vi.fn());
    vi.stubGlobal('confirm', () => true);
    pending = [];
    server = { [DAILY]: { codDollar: 10, dodDollar: 2, totalCount: 2 }, [MONTHLY]: { [MONTH]: { codDollar: 10, dodDollar: 2, totalCount: 2 } } };
    firebaseState.authGeneration++;
    firebaseState.db = { name: 'manual-adjust' } as any;
    firebaseState.dbRefDailyRevenue = { path: DAILY.split('/')[0] } as any;
    firebaseState.dbRefMonthlyRevenue = { path: MONTHLY } as any;
    firebaseState.fb = {
        ref: (_db: any, path: string) => ({ path }),
        runTransaction: (ref: any, update: (value: any) => any) => new Promise((resolve) => { pending.push({ path: ref.path, update, resolve }); })
    } as any;
    dataState.dailyRevenueData = { [DAY]: clone(server[DAILY]) };
    dataState.monthlyRevenueData = clone(server[MONTHLY]);
    uiState.toasts = [];
    viewState.manualAdjustBusy = false;
    openManualAdjustModal();
    fill();
});

afterEach(() => {
    firebaseState.fb = savedFb;
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe('កែស្ថិតិដោយដៃ៖ មួយប្រតិបត្តិការកំពុងរង់ចាំ', () => {
    it('ចុចស្ទួន និងបើក modal ឡើងវិញ ខណៈបណ្តាញយឺត៖ ប្រាក់/ចំនួនបូកតែម្តង', async () => {
        submitManualAdjustment();
        submitManualAdjustment();
        expect(pending).toHaveLength(2);
        expect(viewState.manualAdjustBusy).toBe(true);
        openManualAdjustModal();
        fill();
        submitManualAdjustment();
        expect(viewState.manualAdjustBusy).toBe(true);
        expect(pending).toHaveLength(2);
        commit();
        await flush();
        expect(server[DAILY]).toMatchObject({ codDollar: 15, dodDollar: 3.25, totalCount: 3 });
        expect(server[MONTHLY][MONTH]).toMatchObject({ codDollar: 15, dodDollar: 3.25, totalCount: 3 });
        expect(viewState.manualAdjustBusy).toBe(false);
    });

    it('ប្រតិបត្តិការចប់៖ អាចចាប់ផ្តើមការកែថ្មីបាន', async () => {
        submitManualAdjustment();
        commit();
        await flush();
        expect(viewState.manualAdjustBusy).toBe(false);
        openManualAdjustModal();
        fill();
        submitManualAdjustment();
        expect(pending).toHaveLength(2);
        commit();
        await flush();
        expect(server[DAILY]).toMatchObject({ codDollar: 20, dodDollar: 4.5, totalCount: 4 });
    });

    it('ប្តូរវគ្គ៖ ដោះ busy ចាស់ តែចម្លើយចាស់មិនដោះ busy របស់ការកែថ្មី', async () => {
        submitManualAdjustment();
        const old = pending.splice(0);
        firebaseState.authGeneration++;
        clearSensitiveModalFields();
        expect(viewState.manualAdjustBusy).toBe(false);
        openManualAdjustModal();
        fill();
        submitManualAdjustment();
        expect(pending).toHaveLength(2);
        commit(old);
        await flush();
        expect(viewState.manualAdjustBusy).toBe(true);
        expect(uiState.toasts.some((toast: any) => /^✅/.test(toast.msg))).toBe(false);
        commit();
        await flush();
        expect(viewState.manualAdjustBusy).toBe(false);
    });

    it('ថ្ងៃបានបូក តែខែបដិសេធគ្រប់លើក៖ សារមិនណែនាំឱ្យបូកប្រតិបត្តិការដដែលម្តងទៀត', async () => {
        submitManualAdjustment();
        const first = pending.splice(0);
        commit(first.filter((operation) => operation.path === DAILY));
        first.filter((operation) => operation.path === MONTHLY).forEach(({ resolve }) => resolve({ committed: false }));
        for (let i = 0; i < 6; i++) {
            await flush();
            pending.splice(0).forEach(({ path, resolve }) => {
                expect(path).toBe(MONTHLY);
                resolve({ committed: false });
            });
        }
        await flush();
        expect(viewState.manualAdjustBusy).toBe(false);
        expect(server[DAILY]).toMatchObject({ codDollar: 15, dodDollar: 3.25, totalCount: 3 });
        expect(server[MONTHLY][MONTH]).toMatchObject({ codDollar: 10, dodDollar: 2, totalCount: 2 });
        const warning = uiState.toasts.find((toast: any) => toast.msg.includes('ការកែប្រែមិនទាន់រក្សាទុកពេញលេញ'));
        expect(warning).toBeDefined();
        expect(warning!.msg).not.toContain('សាកល្បងម្ដងទៀត');
        expect(uiState.toasts.some((toast: any) => /^✅/.test(toast.msg))).toBe(false);
    });

    for (const [field, value] of [
        ['manualCodChangeInput', '1e309'],
        ['manualDodChangeInput', '-1e309'],
        ['manualCodChangeInput', '100000000000000'],
        ['manualCountChangeInput', '1.5'],
        ['manualCountChangeInput', '9007199254740992']
    ]) {
        it(`លេខមិនអាចគណនាបានត្រឹមត្រូវ ${field}=${value}៖ បដិសេធមុនសរសេរ`, () => {
            fields[field] = value;
            submitManualAdjustment();
            expect(pending).toHaveLength(0);
            expect(viewState.manualAdjustBusy).toBe(false);
            expect(alert).toHaveBeenCalledTimes(1);
            expect(dataState.dailyRevenueData[DAY]).toEqual({ codDollar: 10, dodDollar: 2, totalCount: 2 });
        });
    }

    it('ចំនួនតាមទម្រង់ដែល input number ទទួល៖ 1e2 មានន័យថា ១០០ កញ្ចប់', async () => {
        fields.manualCountChangeInput = '1e2';
        submitManualAdjustment();
        commit();
        await flush();
        expect(server[DAILY]).toMatchObject({ totalCount: 102 });
        expect(server[MONTHLY][MONTH]).toMatchObject({ totalCount: 102 });
    });
});
