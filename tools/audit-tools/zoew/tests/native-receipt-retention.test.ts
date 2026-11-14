import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { firebaseState } from '../../../../ZoeW/src/core/state';
import { acceptServerClockOffset, resetServerClock } from '../../../../ZoeW/src/core/clock';
import { withTransactionOutcomeResolution } from '../../../../ZoeW/src/services/tx-outcome';
import { NATIVE_RECEIPT_PURGE_GAP_MS, NATIVE_RECEIPT_PURGE_MARGIN_MS, NATIVE_RECEIPT_PURGE_MAX, NATIVE_RECEIPT_PURGE_ROUNDS, NATIVE_RECEIPT_PURGE_STAMP_KEY, NATIVE_RECEIPT_RETENTION_MS, NATIVE_WRITE_RECEIPTS, nativeWriteRecoveryState } from '../../../../ZoeW/src/services/native-write-recovery';
import { dbListenerPendingPaths } from '../../../../ZoeW/src/core/text';
import { appLocalStore } from '../../../../ZoeW/src/core/storage';
import { acceptFixtureSession } from './helpers/accepted-session';

const host = 'https://shop.firebaseio.com';
let receiptsOnServer: any = null;
const records = () => Object.keys(localStorage).filter(k => k.startsWith('zoew_connection_writes_v1:')).map(k => JSON.parse(localStorage.getItem(k)!));
beforeEach(() => { localStorage.clear(); dbListenerPendingPaths.clear(); firebaseState.authGeneration++; receiptsOnServer = null; });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function lab(update: any, uid = 'A', get: any = async () => ({ val: () => receiptsOnServer }), extra: any = {}) {
  const app = { options: { databaseURL: host } }; const auth = { app, currentUser: { uid, getIdToken: async () => 'fake-token' } }; const db = { app };
  const raw = { getAuth: () => auth, getDatabase: () => db, ref: (_db: any, path = '') => ({ path, toString: () => host + '/' + path }),
    update, set: update, runTransaction: vi.fn(), deleteApp: async () => {}, get, ...extra };
  const sdk = withTransactionOutcomeResolution(raw); sdk.getAuth(app); sdk.getDatabase(app);
  Object.assign(firebaseState, { firebaseConfig: app.options, fb: sdk, auth, db, isDatabaseInitialized: true,
    isInitializingFirebase: false, firebaseSdkUnavailable: false, isDatabaseConnected: true, sessionExpiryCheck: 'live', authLoginOperation: null });
  appLocalStore.setItem('zoew_firebase_config', JSON.stringify(app.options));
  acceptFixtureSession();
  resetServerClock(); acceptServerClockOffset(0, null, false);
  return { sdk, db, app };
}

it('the rules let a device delete only its own receipts older than the retention window the app purges by', () => {
  let dir = process.cwd();
  while (!existsSync(path.join(dir, 'firebase-database.rules.json')) && path.dirname(dir) !== dir) dir = path.dirname(dir);
  const rules = JSON.parse(readFileSync(path.join(dir, 'firebase-database.rules.json'), 'utf8'));
  const write = rules.rules[NATIVE_WRITE_RECEIPTS].$operation['.write'];
  expect(rules.rules[NATIVE_WRITE_RECEIPTS]['.indexOn']).toEqual(expect.arrayContaining(['uid', 'at']));
  expect(write).toContain("data.exists() && !newData.exists() && data.child('uid').val() === auth.uid && data.child('at').val() < now - " + NATIVE_RECEIPT_RETENTION_MS);
  expect(write).toContain("!data.exists() && newData.exists() && newData.child('uid').val() === auth.uid");
});

it('after a clean recovery the device purges its own expired receipts once, never young ones or another device\'s', async () => {
  const now = Date.now(); const old = now - NATIVE_RECEIPT_RETENTION_MS - NATIVE_RECEIPT_PURGE_MARGIN_MS - 1000;
  receiptsOnServer = { mine_old: { uid: 'A', at: old, hash: 'h' }, mine_young: { uid: 'A', at: now - 1000, hash: 'h' }, mine_margin: { uid: 'A', at: now - NATIVE_RECEIPT_RETENTION_MS - 1000, hash: 'h' }, other_old: { uid: 'B', at: old, hash: 'h' } };
  const reads = vi.fn(async () => Response.json(null));
  vi.stubGlobal('fetch', reads);
  const updates: any[] = []; const native = lab(async (_ref: any, value: any) => { updates.push(value); });
  await native.sdk.set(native.sdk.ref(native.db, 'zoew_settings/exchange_rate'), 4200);
  await vi.waitFor(() => expect(updates.length).toBe(2));
  await native.sdk.set(native.sdk.ref(native.db, 'zoew_settings/exchange_rate'), 4300);
  await new Promise(r => setTimeout(r, 20));
  const purges = updates.filter(u => Object.values(u).some(v => v === null));
  expect(purges).toEqual([{ [NATIVE_WRITE_RECEIPTS + '/mine_old']: null }]);
  expect(reads).not.toHaveBeenCalled();
  expect(NATIVE_RECEIPT_PURGE_MAX).toBeGreaterThan(0);
});

it('a journaled write older than the receipt window is never replayed (its receipt may already be purged) and blocks instead', async () => {
  let resolve!: (v: any) => void; const first = lab(() => new Promise(r => { resolve = r; }));
  const write = first.sdk.set(first.sdk.ref(first.db, 'zoew_settings/exchange_rate'), 4200);
  await vi.waitFor(() => expect(resolve).toBeTypeOf('function'));
  const key = Object.keys(localStorage).find(k => k.startsWith('zoew_connection_writes_v1:'))!;
  const row = JSON.parse(localStorage.getItem(key)!); row.queuedAt = Date.now() - NATIVE_RECEIPT_RETENTION_MS - 60000; localStorage.setItem(key, JSON.stringify(row));
  await first.sdk.deleteApp(first.app);
  const reads = vi.fn(async () => Response.json(null)); vi.stubGlobal('fetch', reads);
  const dispatched = vi.fn(async () => {}); const second = lab(dispatched);
  const verdict = await second.sdk.set(second.sdk.ref(second.db, 'zoew_settings/exchange_rate'), 4300).then(() => 'sent', (e: any) => e.code);
  const left = records(); resolve(undefined); await write;
  expect({ verdict, dispatched: dispatched.mock.calls.length, rows: left.length, blocked: nativeWriteRecoveryState(second.db).blocked }).toEqual({ verdict: 'write_recovery_pending', dispatched: 0, rows: 1, blocked: 1 });
});

const quiet = (ms = 20) => new Promise(r => setTimeout(r, ms));
async function pageLoad(update: any, uid = 'A', get?: any) {
  const native = get ? lab(update, uid, get) : lab(update, uid);
  await native.sdk.set(native.sdk.ref(native.db, 'zoew_settings/exchange_rate'), 4200);
  await quiet();
  await native.sdk.deleteApp(native.app);
}
const expiredAt = () => Date.now() - NATIVE_RECEIPT_RETENTION_MS - NATIVE_RECEIPT_PURGE_MARGIN_MS - 1000;
const purgeWriter = (purges: any[]) => async (_ref: any, value: any) => {
  if (!Object.values(value).some(v => v === null)) return;
  purges.push(value);
  for (const key of Object.keys(value)) delete receiptsOnServer[key.slice(NATIVE_WRITE_RECEIPTS.length + 1)];
};

it('purge reads only the current account through the indexed uid query', async () => {
  receiptsOnServer = {};
  vi.stubGlobal('fetch', vi.fn(async () => Response.json(null)));
  const get = vi.fn(async () => ({ val: () => receiptsOnServer }));
  const query = vi.fn((ref, ...constraints) => ({ ...ref, constraints }));
  const native = lab(async () => {}, 'A', get, { query, orderByChild: (key: string) => ({ orderByChild: key }), equalTo: (value: string) => ({ equalTo: value }) });
  await native.sdk.set(native.sdk.ref(native.db, 'zoew_settings/exchange_rate'), 4200);
  await vi.waitFor(() => expect(get).toHaveBeenCalled());
  expect(query).toHaveBeenCalledWith(expect.objectContaining({ path: NATIVE_WRITE_RECEIPTS }), { orderByChild: 'uid' }, { equalTo: 'A' });
  await native.sdk.deleteApp(native.app);
});

it('reloads within the purge gap download the shared receipts root once per device and account, and again once the gap has passed', async () => {
  const base = Date.now(); let shift = 0;
  vi.spyOn(Date, 'now').mockImplementation(() => base + shift);
  receiptsOnServer = { mine_young: { uid: 'A', at: base - 1000, hash: 'h' } };
  vi.stubGlobal('fetch', vi.fn(async () => Response.json(null)));
  const reads: string[] = [];
  const get = vi.fn(async (ref: any) => { reads.push(ref.path); return { val: () => receiptsOnServer }; });
  for (let load = 0; load < 6; load++) { await pageLoad(async () => {}, 'A', get); shift += 30 * 60000; }
  const sameAccount = reads.length;
  await pageLoad(async () => {}, 'B', get);
  const otherAccount = reads.length - sameAccount;
  shift += NATIVE_RECEIPT_PURGE_GAP_MS;
  await pageLoad(async () => {}, 'A', get);
  expect({ sameAccount, otherAccount, afterGap: reads.length - sameAccount - otherAccount, paths: [...new Set(reads)] })
    .toEqual({ sameAccount: 1, otherAccount: 1, afterGap: 1, paths: [NATIVE_WRITE_RECEIPTS] });
});

it('one purge deletes a backlog larger than one batch in batches of at most NATIVE_RECEIPT_PURGE_MAX, never young or foreign receipts', async () => {
  const old = expiredAt(); const backlog = NATIVE_RECEIPT_PURGE_MAX * 2 + 7;
  receiptsOnServer = { mine_young: { uid: 'A', at: Date.now() - 1000, hash: 'h' }, other_old: { uid: 'B', at: old, hash: 'h' } };
  for (let i = 0; i < backlog; i++) receiptsOnServer['mine_' + i] = { uid: 'A', at: old, hash: 'h' };
  vi.stubGlobal('fetch', vi.fn(async () => Response.json(null)));
  const purges: any[] = [];
  await pageLoad(purgeWriter(purges));
  expect({ deleted: purges.reduce((n, p) => n + Object.keys(p).length, 0), largest: Math.max(...purges.map(p => Object.keys(p).length)), left: Object.keys(receiptsOnServer).length, kept: ['mine_young', 'other_old'].every(k => k in receiptsOnServer) })
    .toEqual({ deleted: backlog, largest: NATIVE_RECEIPT_PURGE_MAX, left: 2, kept: true });
});

it('a purge that stops at its round cap keeps the gap open, so the next load continues the backlog instead of waiting a day', async () => {
  const old = expiredAt(); const backlog = NATIVE_RECEIPT_PURGE_MAX * NATIVE_RECEIPT_PURGE_ROUNDS + 7;
  receiptsOnServer = {};
  for (let i = 0; i < backlog; i++) receiptsOnServer['mine_' + i] = { uid: 'A', at: old, hash: 'h' };
  vi.stubGlobal('fetch', vi.fn(async () => Response.json(null)));
  const purges: any[] = [];
  await pageLoad(purgeWriter(purges));
  const first = purges.reduce((n, p) => n + Object.keys(p).length, 0);
  await pageLoad(purgeWriter(purges));
  const second = purges.reduce((n, p) => n + Object.keys(p).length, 0) - first;
  await pageLoad(purgeWriter(purges));
  expect({ rounds: NATIVE_RECEIPT_PURGE_ROUNDS > 1, first, second, left: Object.keys(receiptsOnServer).length, batches: purges.length })
    .toEqual({ rounds: true, first: NATIVE_RECEIPT_PURGE_MAX * NATIVE_RECEIPT_PURGE_ROUNDS, second: 7, left: 0, batches: NATIVE_RECEIPT_PURGE_ROUNDS + 1 });
});

it('a refused batch ends the purge without retrying it on every reload; unavailable receipt-gap storage purges once per load', async () => {
  const old = expiredAt();
  receiptsOnServer = { mine_old: { uid: 'A', at: old, hash: 'h' } };
  vi.stubGlobal('fetch', vi.fn(async () => Response.json(null)));
  const reads = vi.fn(async () => ({ val: () => receiptsOnServer }));
  let refusals = 0;
  const refuse = async (_ref: any, value: any) => { if (Object.values(value).some(v => v === null)) { refusals++; throw Object.assign(new Error('permission_denied'), { code: 'PERMISSION_DENIED' }); } };
  await pageLoad(refuse, 'A', reads); await pageLoad(refuse, 'A', reads);
  const withStorage = { reads: reads.mock.calls.length, refusals };
  localStorage.clear(); reads.mockClear(); refusals = 0;
  const getItem = localStorage.getItem.bind(localStorage);
  const blocked = vi.spyOn(localStorage, 'getItem').mockImplementation((key: string) => {
    if (key.startsWith('zoew_connection_writes_v1:')) return null;
    if (key.startsWith(NATIVE_RECEIPT_PURGE_STAMP_KEY)) throw new Error('SecurityError');
    return getItem(key);
  });
  await pageLoad(refuse, 'A', reads); await pageLoad(refuse, 'A', reads);
  const refusedReads = blocked.mock.calls.filter(([key]) => String(key).startsWith(NATIVE_RECEIPT_PURGE_STAMP_KEY)).length;
  blocked.mockRestore();
  expect({ withStorage, withoutStorage: { reads: reads.mock.calls.length, refusals, storageRefused: refusedReads > 0 } })
    .toEqual({ withStorage: { reads: 1, refusals: 1 }, withoutStorage: { reads: 2, refusals: 2, storageRefused: true } });
});

it('auth storage ដែលមិនអាចផ្ទៀងផ្ទាត់ មិនអនុញ្ញាត write ឬ purge ដោយសន្មត session នៅរស់', async () => {
  const update = vi.fn(async () => {}), get = vi.fn(async () => ({ val: () => null }));
  const native = lab(update, 'A', get);
  vi.spyOn(localStorage, 'getItem').mockImplementation(() => { throw new Error('SecurityError'); });
  const verdict = await native.sdk.set(native.sdk.ref(native.db, 'zoew_settings/exchange_rate'), 4200).then(() => 'sent', (error: any) => error.code);
  expect(verdict).toBe('CONNECTION_SCOPE_CHANGED');
  expect(update).not.toHaveBeenCalled();
  expect(get).not.toHaveBeenCalled();
  await native.sdk.deleteApp(native.app);
});
