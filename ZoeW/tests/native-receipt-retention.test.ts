import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { firebaseState } from '../src/core/state';
import { withTransactionOutcomeResolution } from '../src/services/tx-outcome';
import { NATIVE_RECEIPT_PURGE_MARGIN_MS, NATIVE_RECEIPT_PURGE_MAX, NATIVE_RECEIPT_RETENTION_MS, NATIVE_WRITE_RECEIPTS, nativeWriteRecoveryState } from '../src/services/native-write-recovery';
import { dbListenerPendingPaths } from '../src/core/text';

const host = 'https://shop.firebaseio.com';
let receiptsOnServer: any = null;
const records = () => Object.keys(localStorage).filter(k => k.startsWith('zoew_connection_writes_v1:')).map(k => JSON.parse(localStorage.getItem(k)!));
beforeEach(() => { localStorage.clear(); dbListenerPendingPaths.clear(); firebaseState.authGeneration++; receiptsOnServer = null; });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function lab(update: any) {
  const app = { options: { databaseURL: host } }; const auth = { app, currentUser: { uid: 'A', getIdToken: async () => 'fake-token' } }; const db = { app };
  const raw = { getAuth: () => auth, getDatabase: () => db, ref: (_db: any, path = '') => ({ toString: () => host + '/' + path }),
    update, set: update, runTransaction: vi.fn(), deleteApp: async () => {}, get: async () => ({ val: () => receiptsOnServer }) };
  const sdk = withTransactionOutcomeResolution(raw); sdk.getAuth(app); sdk.getDatabase(app);
  Object.assign(firebaseState, { firebaseConfig: app.options, fb: sdk, auth, db, isDatabaseInitialized: true,
    isInitializingFirebase: false, firebaseSdkUnavailable: false, isDatabaseConnected: true, sessionExpiryCheck: 'live', authLoginOperation: null });
  return { sdk, db, app };
}

it('the rules let a device delete only its own receipts older than the retention window the app purges by', () => {
  let dir = process.cwd();
  while (!existsSync(path.join(dir, 'firebase-database.rules.json')) && path.dirname(dir) !== dir) dir = path.dirname(dir);
  const rules = JSON.parse(readFileSync(path.join(dir, 'firebase-database.rules.json'), 'utf8'));
  const write = rules.rules[NATIVE_WRITE_RECEIPTS].$operation['.write'];
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
