import { afterEach, expect, it } from 'vitest';
import { firebaseState } from '../src/core/state';
import { commitDailyRevenueDelta } from '../src/domain/ledger';

const saved = firebaseState.fb;
afterEach(() => { firebaseState.fb = saved; });
it('a native SDK retry against its own committed operation does not deduct twice', async () => {
  let value: any = { codDollar: 24, dodDollar: 0, totalCount: 1, op: 'op_prior_token', ops: { op_prior_token: 1 } };
  firebaseState.dbRefDailyRevenue = {} as any;
  firebaseState.fb = { ref: () => ({}), runTransaction: async (_ref: any, update: any) => {
    value = update(structuredClone(value));
    value = update(structuredClone(value));
    return { committed: true, snapshot: { val: () => value } };
  } } as any;
  const delta = await commitDailyRevenueDelta('2026-10-13', -10, 0, 0, null, true);
  expect(value.codDollar).toBe(14); expect(delta.cod).toBe(-10);
});
