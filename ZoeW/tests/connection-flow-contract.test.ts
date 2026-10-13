import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { setupConnectionRecovery, renderConnectionStatus, probeDatabaseLiveness } from '../src/services/connection';
import { firebaseState } from '../src/core/state';
import { viewState } from '../src/core/view-state';
import { dbListenerPendingPaths } from '../src/core/text';
import { withTransactionOutcomeResolution } from '../src/services/tx-outcome';
import { noteDbListenerAlive } from '../src/services/db-listeners';

const online = vi.fn();
beforeEach(() => { vi.useFakeTimers(); online.mockClear(); dbListenerPendingPaths.clear();
  Object.assign(firebaseState, { db: {}, fb: { goOnline: online }, isDatabaseConnected: true, dbListenersFailed: false, firebaseSdkUnavailable: false }); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

it('repeated lifecycle setup keeps one online handler and cleanup removes it', () => {
  const first = setupConnectionRecovery(); const second = setupConnectionRecovery();
  window.dispatchEvent(new Event('online'));
  const calls = online.mock.calls.length;
  if (typeof first === 'function') first(); if (typeof second === 'function') second();
  window.dispatchEvent(new Event('online'));
  expect(calls).toBe(1); expect(online).toHaveBeenCalledTimes(1);
});

it('connected transport with pending data is syncing; only fresh data becomes ready', () => {
  Object.assign(firebaseState, { auth: { currentUser: { uid: 'A' } }, db: {}, fb: {}, isInitializingFirebase: false,
    isDatabaseConnected: true, isDatabaseInitialized: true, dbListenersFailed: false, sessionExpiryCheck: 'live' });
  dbListenerPendingPaths.add('history'); renderConnectionStatus();
  const pendingPhase = (viewState as any).connectionPhase;
  const pendingStatus = viewState.connectionStatus;
  dbListenerPendingPaths.clear(); renderConnectionStatus();
  expect(pendingPhase).toBe('syncing'); expect((viewState as any).connectionPhase).toBe('ready');
  expect(pendingStatus).toBe('connecting'); expect(viewState.connectionStatus).toBe('online');
});

it('the last initial listener snapshot publishes ready without another transport event', () => {
  Object.assign(firebaseState, { auth: { currentUser: { uid: 'A' } }, db: {}, fb: {}, isInitializingFirebase: false,
    isDatabaseConnected: true, isDatabaseInitialized: true, dbListenersFailed: false, sessionExpiryCheck: 'live', authLoginOperation: null });
  dbListenerPendingPaths.add('history'); renderConnectionStatus();
  noteDbListenerAlive('history');
  expect(viewState.connectionPhase).toBe('ready'); expect(viewState.connectionStatus).toBe('online');
});

function sdkLab() {
  const app = { options: { databaseURL: 'https://shop.firebaseio.com' } };
  const auth = { app, currentUser: { uid: 'A' } }; const db = { app };
  const listeners: Array<{ cb: (value: any) => void; off: boolean }> = [];
  let answer!: (value: any) => void;
  const sdk = withTransactionOutcomeResolution({ getAuth: () => auth, getDatabase: () => db,
    ref: (_db: any, path: string) => ({ database: db, toString: () => path }),
    onValue: (_ref: any, cb: any) => { const row = { cb, off: false }; listeners.push(row); return () => { row.off = true; }; },
    off: () => {}, get: () => new Promise(resolve => { answer = resolve; }), runTransaction: vi.fn() });
  sdk.getAuth(app); sdk.getDatabase(app); return { sdk, auth, db, listeners, answer: (v: any) => answer(v) };
}
it('the shared SDK facade owns duplicate subscriptions and blocks callbacks after unsubscribe', () => {
  const l = sdkLab(); const ref = l.sdk.ref(l.db, 'zoew_scan_history_cod_dod'); const seen: any[] = [];
  const callback = (value: any) => seen.push(value);
  const old = l.sdk.onValue(ref, callback); const current = l.sdk.onValue(ref, callback);
  const count = l.listeners.filter(x => !x.off).length;
  old(); l.listeners[0].cb('late-old'); l.listeners.at(-1)!.cb('current'); current(); l.listeners.at(-1)!.cb('late-current');
  expect(count).toBe(1); expect(seen).toEqual(['current']);
});
it('a pending SDK read cannot return the old account snapshot after account replacement', async () => {
  const l = sdkLab(); const read = l.sdk.get(l.sdk.ref(l.db, 'zoew_scan_history_cod_dod')).then(() => 'published', () => 'ended');
  l.auth.currentUser = { uid: 'B' }; l.answer({ private: 'A' });
  expect(await read).toBe('ended');
});
it('an old liveness probe cannot mark a new session healthy', async () => {
  let resolve!: (value: any) => void;
  Object.assign(firebaseState, { dbLivenessProbe: null, lastDbLivenessOkAt: 0, fb: { ref: () => ({}), get: () => new Promise(r => { resolve = r; }) } });
  const probe = probeDatabaseLiveness('test'); firebaseState.authGeneration++; resolve({});
  expect(await probe).toBeNull(); expect(firebaseState.lastDbLivenessOkAt).toBe(0);
});
