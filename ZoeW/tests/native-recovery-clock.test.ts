import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { firebaseState } from '../src/core/state';
import { acceptServerClockOffset, resetServerClock, serverClockIsTrustworthy } from '../src/core/clock';
import { createNativeWriteRecovery, nativeWriteRecoveryState, NATIVE_RECEIPT_RETENTION_MS, NATIVE_RECEIPT_PURGE_MARGIN_MS } from '../src/services/native-write-recovery';

const lab = vi.hoisted(() => ({ rows: [] as any[], read: vi.fn(), put: vi.fn(), remove: vi.fn() }));
vi.mock('../src/services/write-journal', () => ({ createLocalWriteJournal: () => ({ available: () => true, list: () => lab.rows, put: lab.put, remove: lab.remove }) }));
vi.mock('../src/services/tx-outcome', () => ({ txRestUrl: String, txReadServerValue: (...args: any[]) => lab.read(...args), txReadWasRefused: () => false, txSameValue: (a: any, b: any) => JSON.stringify(a) === JSON.stringify(b) }));
const DAY = 86400000, START = 1800000000000;
let wall: number, mono: number, live: boolean;
const settle = async () => {
  await vi.waitFor(() => expect(nativeWriteRecoveryState(firebaseState.db).recovering).toBe(false));
  await new Promise(r => setTimeout(r, 20));
};
const trust = () => acceptServerClockOffset(0, null, false);
function interval(lower = START - 1000, upper = START + 1000) {
  expect(acceptServerClockOffset(0, Object.freeze({ epochMs: lower, estimateEpochMs: START, uncertaintyMs: upper - lower, wallMs: wall, monotonicMs: mono }), false)).toBe(true);
}
function start(get: any = vi.fn(async () => ({ val: () => ({ fresh: { uid: 'u', at: START } }) })), update = vi.fn(async (..._args: any[]) => {})) {
  const database = firebaseState.db;
  const sdk = { ref: (_db: any, p = '') => 'https://example.test/' + p, get, update, runTransaction: vi.fn() };
  const api = createNativeWriteRecovery(sdk, { currentUser: { uid: 'u' } }, firebaseState.db, () => live && firebaseState.db === database, () => {}, () => ({ watch: () => () => {} }));
  return { api, sdk };
}
async function row(age = DAY) {
  const ops = [{ k: 'set', p: ['business', 'value'], v: 99 }];
  const hash = Buffer.from(await webcrypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(ops)))).toString('hex');
  const entry = { v: 1, scope: 'scope', topic: 'firebase', opId: 'old', hash, ops, queuedAt: START - age };
  lab.rows.push(entry); return entry;
}
beforeEach(() => {
  wall = START; mono = 1000; live = true; localStorage.clear(); vi.clearAllMocks();
  vi.spyOn(Date, 'now').mockImplementation(() => wall); vi.spyOn(performance, 'now').mockImplementation(() => mono);
  vi.stubGlobal('crypto', webcrypto); lab.rows = []; lab.read.mockResolvedValue(null); lab.put.mockReturnValue(true);
  lab.remove.mockImplementation((_scope, _topic, id) => { lab.rows = lab.rows.filter(r => r.opId !== id); });
  firebaseState.db = {} as any; firebaseState.isDatabaseConnected = true; resetServerClock();
});
afterEach(() => { live = false; vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('ចន្លោះម៉ោងកាត់ព្រំ replay ទុកភស្តុតាងរង់ចាំ ហើយបន្តក្រោយផ្ទៀងច្បាស់', async () => {
  interval(); await row(NATIVE_RECEIPT_RETENTION_MS - 500);
  const { sdk, api } = start(); await settle();
  expect(sdk.update).not.toHaveBeenCalled(); expect(lab.rows).toHaveLength(1);
  expect(nativeWriteRecoveryState(firebaseState.db)).toMatchObject({ deferred: true, blocked: 0 });
  interval(START, START); await api.retry(); await settle();
  expect(sdk.update).toHaveBeenCalledTimes(1); expect(lab.rows).toHaveLength(0);
});

it('ព្រំអាយុអប្បបរមាលុប receipt ចាស់ តែរក្សា receipt នៅចន្លោះមិនច្បាស់', async () => {
  interval();
  const at = START - NATIVE_RECEIPT_RETENTION_MS - NATIVE_RECEIPT_PURGE_MARGIN_MS;
  const get = vi.fn(async () => ({ val: () => ({ uncertain: { uid: 'u', at: at - 500 }, old: { uid: 'u', at: at - 1500 } }) }));
  const { sdk } = start(get); await settle();
  expect(sdk.update).toHaveBeenCalledTimes(1);
  expect(sdk.update.mock.calls[0][1]).toEqual({ 'zoew_write_receipts/old': null });
});

it('គ្មាន receipt ក្រោយផ្អាក clock ត្រូវពន្យារ ហើយសាកវិញក្រោយ sample ស្រស់', async () => {
  trust(); await row(); wall += 3 * DAY;
  const { sdk } = start(); await settle();
  expect(serverClockIsTrustworthy()).toBe(false);
  expect(sdk.update).not.toHaveBeenCalled(); expect(lab.rows).toHaveLength(1);
  expect(nativeWriteRecoveryState(firebaseState.db)).toMatchObject({ deferred: true, blocked: 0 });
  // Reanchor at the original epoch so this fixture is genuinely young again.
  wall = START; trust();
  await vi.waitFor(() => expect(sdk.update).toHaveBeenCalledTimes(1), { timeout: 3000 });
  expect(lab.rows).toHaveLength(0);
});
it.each([3 * DAY, 0])('receipt ដែលផ្គូផ្គងបញ្ចប់បាន ដោយមិនពឹងអាយុឬ clock (%s)', async age => {
  const entry = await row(age); if (age === 0) entry.queuedAt = 0;
  lab.read.mockResolvedValue({ uid: 'u', hash: entry.hash });
  const { sdk } = start(); await settle();
  expect(lab.read).toHaveBeenCalled(); expect(lab.rows).toHaveLength(0); expect(sdk.update).not.toHaveBeenCalled();
});
it('clock មិនទាន់ស្គាល់ មិនអាន purge ឬប្រើ stamp និង latch', async () => {
  wall += 365 * DAY;
  const { sdk, api } = start(); await settle();
  expect(sdk.get).not.toHaveBeenCalled(); expect(sdk.update).not.toHaveBeenCalled();
  expect(Object.keys(localStorage).filter(k => k.startsWith('zoew_receipt_purge_v1:'))).toHaveLength(0);
  wall = START; trust(); await api.retry(); await settle(); expect(sdk.get).toHaveBeenCalledTimes(1);
});
it('កុំ replay ពេល clock មិនប្រាកដហើយ sync ឡើងវិញក្នុងការអាន receipt', async () => {
  trust(); await row(); lab.read.mockImplementation(async () => { wall += DAY; serverClockIsTrustworthy(); trust(); return null; });
  const { sdk } = start(); await settle();
  expect(sdk.update).not.toHaveBeenCalled(); expect(lab.rows).toHaveLength(1);
  expect(nativeWriteRecoveryState(firebaseState.db)).toMatchObject({ deferred: true, blocked: 0 });
});
it('កុំ purge ក្រោយ clock មិនប្រាកដក្នុងការអាន ហើយរក្សាសិទ្ធិសាកវិញ', async () => {
  trust(); const get = vi.fn(async () => { wall += 3 * DAY; serverClockIsTrustworthy(); trust(); return { val: () => ({ old: { uid: 'u', at: START - 3 * DAY } }) }; });
  const { sdk } = start(get); await settle(); expect(sdk.update).not.toHaveBeenCalled();
  expect(nativeWriteRecoveryState(firebaseState.db).purged).toBe(false);
  expect(Object.keys(localStorage).filter(k => k.startsWith('zoew_receipt_purge_v1:'))).toHaveLength(0);
});
it('write ដែលអនុញ្ញាតនៅបន្ត តែ clock មិនប្រាកដមិនបង្កើតអាយុ replay', async () => {
  const update = vi.fn(() => new Promise<void>(() => {}));
  const { api } = start(undefined, update); await settle();
  void api.mutate('set', 'https://example.test/business/value', 99); await settle();
  expect(update).toHaveBeenCalledTimes(1); expect(lab.put.mock.calls[0][0].queuedAt).toBe(0);
});
it('clock មិនប្រាកដក្នុង digest ដកសិទ្ធិ queuedAt មិនទម្លាក់ write ដែលអនុញ្ញាត', async () => {
  trust(); const digest = webcrypto.subtle.digest.bind(webcrypto.subtle);
  vi.spyOn(webcrypto.subtle, 'digest').mockImplementation(async (...args) => { wall += DAY; serverClockIsTrustworthy(); trust(); return digest(...args); });
  const update = vi.fn(() => new Promise<void>(() => {}));
  const { api } = start(undefined, update); await settle();
  void api.mutate('set', 'https://example.test/business/value', 99); await settle();
  expect(update).toHaveBeenCalledTimes(1); expect(lab.put.mock.calls[0][0].queuedAt).toBe(0);
});
it('anchor ដែលស្គាល់អនុញ្ញាត replay ដោយមិនទាមទារ cleanup connection ហើយ sample ធម្មតាមិនកាត់', async () => {
  trust(); firebaseState.isDatabaseConnected = false; firebaseState.hasEverConnectedToDatabase = true;
  await row(); lab.read.mockImplementation(async () => { mono += 10; wall += 10; trust(); return null; });
  const { sdk } = start(); await settle();
  expect(sdk.update).toHaveBeenCalledTimes(1); expect(lab.rows).toHaveLength(0);
});
it('queuedAt មិនស្គាល់នៅជាភស្តុតាង មិនមែនសិទ្ធិ replay ក្រោយ sample ថ្មី', async () => {
  trust(); const entry = await row(); entry.queuedAt = 0;
  const { sdk } = start(); await settle();
  expect(sdk.update).not.toHaveBeenCalled(); expect(lab.rows).toHaveLength(1);
  expect(nativeWriteRecoveryState(firebaseState.db)).toMatchObject({ blocked: 1, deferred: false });
});
it('purge ផ្ទៀង lease រវាង batch ហើយដោះ latch និង stamp ពេលមិនប្រាកដ', async () => {
  trust(); const receipts = Object.fromEntries(Array.from({ length: 501 }, (_, i) => [String(i), { uid: 'u', at: START - 3 * DAY }]));
  const update = vi.fn(async () => { wall += DAY; serverClockIsTrustworthy(); trust(); });
  const { sdk } = start(vi.fn(async () => ({ val: () => receipts })), update); await settle();
  expect(sdk.update).toHaveBeenCalledTimes(1);
  expect(nativeWriteRecoveryState(firebaseState.db).purged).toBe(false);
  expect(Object.keys(localStorage).filter(k => k.startsWith('zoew_receipt_purge_v1:'))).toHaveLength(0);
});
