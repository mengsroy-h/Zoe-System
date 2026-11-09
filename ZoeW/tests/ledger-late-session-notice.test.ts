import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dataState, firebaseState, uiState } from '../src/core/state';
import { commitDailyRevenueDelta, commitMonthlyRevenueDelta } from '../src/domain/ledger';

vi.mock('../src/ui/history-refresh', () => ({ refreshCurrentHistoryView: vi.fn() }));
const DAY = '2026-11-09';
const MONTH = '2026-11';
const original = { codDollar: 15, dodDollar: 1, totalCount: 2 };
const fresh = { codDollar: 99, dodDollar: 4, totalCount: 9 };
let finish: (value: any) => void;
let fail: (reason: any) => void;
let update: (value: any) => any;
const buckets = ['daily', 'monthly'] as const;
const outcomes = ['reject', 'not-committed'] as const;

beforeEach(() => {
  vi.useFakeTimers();
  uiState.toasts = [];
  firebaseState.db = { name: 'shop-A' } as any;
  firebaseState.authGeneration = 10;
  firebaseState.dbRefDailyRevenue = { path: 'daily' } as any;
  firebaseState.dbRefMonthlyRevenue = { path: 'monthly' } as any;
  dataState.dailyRevenueData = { [DAY]: { ...original } };
  dataState.monthlyRevenueData = { [MONTH]: { ...original } };
  firebaseState.fb = {
    ref: (db: any, path: string) => ({ db, path }),
    runTransaction: (_ref: any, fn: any) => {
      update = fn;
      return new Promise((resolve, reject) => { finish = resolve; fail = reject; });
    }
  } as any;
});
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

function start(bucket: typeof buckets[number]) {
  return bucket === 'daily'
    ? commitDailyRevenueDelta(DAY, 5, 0, 1, { cod: 5, dod: 0, count: 1 })
    : commitMonthlyRevenueDelta(MONTH, 5, 0, 1, { cod: 5, dod: 0, count: 1 });
}
function settle(outcome: typeof outcomes[number], bucket: typeof buckets[number]) {
  if (outcome === 'reject') fail(Object.assign(new Error('permission_denied'), { code: 'PERMISSION_DENIED' }));
  else {
    const current = bucket === 'daily' ? { codDollar: 10, dodDollar: 1, totalCount: 1 }
      : { [MONTH]: { codDollar: 10, dodDollar: 1, totalCount: 1 } };
    update(structuredClone(current));
    finish({ committed: false, snapshot: { val: () => current } });
  }
}

describe('ការឆ្លើយតប ledger ចាស់មិនបង្ហាញសារក្នុងវគ្គថ្មី', () => {
  for (const bucket of buckets) for (const outcome of outcomes) for (const switched of ['database', 'auth'] as const) {
    it(`${bucket} · ${outcome} · ${switched} ប្ដូរ៖ រក្សាទិដ្ឋភាព និងស្ងាត់`, async () => {
      const pending = start(bucket);
      if (switched === 'database') firebaseState.db = { name: 'shop-B' } as any;
      else firebaseState.authGeneration++;
      dataState.dailyRevenueData = { [DAY]: { ...fresh } };
      dataState.monthlyRevenueData = { [MONTH]: { ...fresh } };
      settle(outcome, bucket);
      await pending;
      expect(dataState.dailyRevenueData[DAY]).toEqual(fresh);
      expect(dataState.monthlyRevenueData[MONTH]).toEqual(fresh);
      expect(uiState.toasts.map(toast => toast.msg)).toEqual([]);
    });
  }
  for (const bucket of buckets) for (const outcome of outcomes) {
    it(`${bucket} · ${outcome} · វគ្គដដែល៖ ប្រាប់បរាជ័យ និងបញ្ច្រាស local delta`, async () => {
      const pending = start(bucket);
      settle(outcome, bucket);
      await pending;
      const record = bucket === 'daily' ? dataState.dailyRevenueData[DAY] : dataState.monthlyRevenueData[MONTH];
      expect(record).toEqual({ codDollar: 10, dodDollar: 1, totalCount: 1 });
      expect(uiState.toasts.map(toast => toast.msg)).toEqual([expect.stringContaining(bucket === 'daily' ? 'Save Daily Revenue' : 'Save Monthly Revenue')]);
    });
  }
});
