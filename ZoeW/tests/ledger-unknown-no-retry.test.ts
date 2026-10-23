import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dataState, firebaseState } from '../src/core/state';
import { addRevenueToDailyAndMonthlyRecord, correctRevenueLedgerToActual, ledgerServerVerdict } from '../src/domain/ledger';

vi.mock('../src/ui/toast', () => ({ showToast: vi.fn() }));
vi.mock('../src/ui/history-refresh', () => ({ refreshCurrentHistoryView: vi.fn() }));

const day = '2026-10-23';
const month = '2026-10';
const dailyPath = 'zoew_daily_revenue_cod_dod/' + day;
const monthlyPath = 'zoew_monthly_revenue_cod_dod';
type Outcome = 'ok' | 'failed' | 'applied-unknown' | 'lost-unknown';
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const base = { codDollar: 100, dodDollar: 10, totalCount: 20 };
let server: Record<string, any>;
let plans: Record<string, Outcome[]>;
let writes: any[];

beforeEach(() => {
    vi.useFakeTimers();
    firebaseState.authGeneration++;
    firebaseState.db = {} as any;
    firebaseState.dbRefDailyRevenue = { path: 'zoew_daily_revenue_cod_dod' } as any;
    firebaseState.dbRefMonthlyRevenue = { path: monthlyPath } as any;
    dataState.dailyRevenueData = { [day]: clone(base) };
    dataState.monthlyRevenueData = { [month]: clone(base) };
    server = { [dailyPath]: clone(base), [monthlyPath]: { [month]: clone(base) } };
    plans = { [dailyPath]: [], [monthlyPath]: [] };
    writes = [];
    firebaseState.fb = {
        ref: (_db: any, path: string) => ({ path }),
        runTransaction: async (ref: any, update: any) => {
            const next = update(clone(server[ref.path]));
            const outcome = plans[ref.path].shift() || 'ok';
            writes.push({ path: ref.path, outcome, next });
            if (outcome === 'ok' || outcome === 'applied-unknown') server[ref.path] = next;
            if (outcome.endsWith('unknown')) throw Object.assign(new Error('disconnect'), { txOutcome: 'unknown' });
            return { committed: outcome === 'ok', snapshot: { val: () => clone(server[ref.path]) } };
        }
    } as any;
});

afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

function expectTotals(path: string, cod: number, dod: number, count: number) {
    expect(path === dailyPath ? server[path] : server[path][month]).toMatchObject({
        codDollar: base.codDollar + cod, dodDollar: base.dodDollar + dod, totalCount: base.totalCount + count
    });
}

describe('ledger ៖ លទ្ធផលមិនដឹងច្បាស់មិនបង្កើត delta ទាយថ្មី', () => {
    for (const sign of [1, -1]) {
        for (const where of ['daily', 'monthly', 'both']) {
            for (const outcome of ['applied-unknown', 'lost-unknown'] as const) {
                it(`${sign > 0 ? 'បូក' : 'ដក'} COD/DOD/ចំនួន · ${where} · ${outcome} ➜ រក្សាភស្តុតាងនិងមិនសរសេរបន្ថែម`, async () => {
                    if (where !== 'monthly') plans[dailyPath] = [outcome];
                    if (where !== 'daily') plans[monthlyPath] = [outcome];
                    const applied = addRevenueToDailyAndMonthlyRecord(day, sign * 5, sign * 0.25, sign);
                    const status = await correctRevenueLedgerToActual(day, applied, sign * 5, sign * 0.25, sign);
                    expect(status).toMatchObject({ ok: false, stale: false });
                    expect(status.monthly.unknown).toBe(true);
                    if (where !== 'monthly') expect(status.daily.unknown).toBe(true);
                    expect(writes).toHaveLength(2);
                    const dailySign = where !== 'monthly' && outcome === 'lost-unknown' ? 0 : sign;
                    const monthlySign = where !== 'daily' && outcome === 'lost-unknown' ? 0 : sign;
                    expectTotals(dailyPath, dailySign * 5, dailySign * 0.25, dailySign);
                    expectTotals(monthlyPath, monthlySign * 5, monthlySign * 0.25, monthlySign);
                });
            }
        }
    }

    for (const sign of [1, -1]) {
        for (const path of [dailyPath, monthlyPath]) {
            for (const outcome of ['applied-unknown', 'lost-unknown'] as const) {
                it(`ការកែ ${sign} · ${path} · ${outcome} ➜ មិនតម្រឹមបន្ថែមក្រោយ ACK មិនច្បាស់`, async () => {
                    const applied = addRevenueToDailyAndMonthlyRecord(day, sign * 2, sign * 0.1, sign);
                    await Promise.all([applied.dailyServer, applied.monthlyServer]);
                    plans[path] = [outcome];
                    const status = await correctRevenueLedgerToActual(day, applied, sign * 5, sign * 0.25, sign * 2);
                    expect(status).toMatchObject({ ok: false, stale: false });
                    expect((path === dailyPath ? status.daily : status.monthly).unknown).toBe(true);
                    expect(writes).toHaveLength(4);
                    for (const bucket of [dailyPath, monthlyPath]) {
                        const lost = bucket === path && outcome === 'lost-unknown';
                        expectTotals(bucket, sign * (lost ? 2 : 5), sign * (lost ? 0.1 : 0.25), sign * (lost ? 1 : 2));
                    }
                });
            }
        }
    }

    it('promise បដិសេធ unknown ➜ មិនប្រែជាសូន្យដែលគេចាត់ថាច្បាស់', async () => {
        const error = Object.assign(new Error('disconnect'), { txOutcome: 'unknown' });
        expect(await ledgerServerVerdict(Promise.reject(error))).toEqual({ cod: 0, dod: 0, count: 0, unknown: true });
        const status = await correctRevenueLedgerToActual(day, {
            dailyServer: Promise.reject(error), monthlyServer: Promise.resolve({ cod: 5, dod: 0, count: 1 })
        }, 5, 0, 1);
        expect(status.ok).toBe(false);
        expect(status.daily.unknown).toBe(true);
        expect(writes).toHaveLength(0);
    });

    for (const sign of [1, -1]) {
        for (const outcome of ['applied-unknown', 'lost-unknown'] as const) {
            it(`ការតម្រឹមខែ ${sign} · ${outcome} ➜ ការកែបន្ទាប់មិនសាកឡើងវិញ`, async () => {
                plans[monthlyPath] = ['failed', outcome];
                const applied = addRevenueToDailyAndMonthlyRecord(day, sign * 5, sign * 0.25, sign);
                const status = await correctRevenueLedgerToActual(day, applied, sign * 5, sign * 0.25, sign);
                expect(status.ok).toBe(false);
                expect(status.monthly.unknown).toBe(true);
                expect(writes).toHaveLength(3);
                expectTotals(dailyPath, sign * 5, sign * 0.25, sign);
                const appliedSign = outcome === 'applied-unknown' ? sign : 0;
                expectTotals(monthlyPath, appliedSign * 5, appliedSign * 0.25, appliedSign);
            });
        }
    }

    for (const path of [dailyPath, monthlyPath]) {
        it(`ទិសផ្ទុយ ៖ ${path} មិនបានអនុវត្តច្បាស់ ➜ កែបាន`, async () => {
            plans[path] = ['failed'];
            const applied = addRevenueToDailyAndMonthlyRecord(day, -5, -0.25, -1);
            const status = await correctRevenueLedgerToActual(day, applied, -5, -0.25, -1);
            expect(status.ok).toBe(true);
            expectTotals(dailyPath, -5, -0.25, -1);
            expectTotals(monthlyPath, -5, -0.25, -1);
        });
    }

    it('ទិសផ្ទុយ ៖ ការកែដែលច្បាស់ទាំងពីរ ➜ ត្រឹមត្រូវ', async () => {
        const applied = addRevenueToDailyAndMonthlyRecord(day, 2, 0.1, 1);
        const status = await correctRevenueLedgerToActual(day, applied, 5, 0.25, 2);
        expect(status.ok).toBe(true);
        expectTotals(dailyPath, 5, 0.25, 2);
        expectTotals(monthlyPath, 5, 0.25, 2);
    });

    it('ទិសផ្ទុយ ៖ ថ្ងៃមានលុយតិចជាងការដក ➜ កំណត់សូន្យនិងខែតម្រឹមតាមចំនួនពិត', async () => {
        server[dailyPath] = { codDollar: 3, dodDollar: 0.1, totalCount: 1 };
        dataState.dailyRevenueData[day] = clone(server[dailyPath]);
        const applied = addRevenueToDailyAndMonthlyRecord(day, -5, -0.25, -2);
        const status = await correctRevenueLedgerToActual(day, applied, -5, -0.25, -2);
        expect(status.ok).toBe(false);
        expect(status.daily.unknown).toBeUndefined();
        expect(server[dailyPath]).toMatchObject({ codDollar: 0, dodDollar: 0, totalCount: 0 });
        expectTotals(monthlyPath, -3, -0.1, -1);
    });
});
