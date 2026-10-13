import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { firebaseState, securityState } from '../src/core/state';
import { appLocalStore } from '../src/core/storage';
import { forceExpireSession, runSessionExpiryCheck, FOUR_HOURS_MS } from '../src/features/session';

const turn = async () => { for (let i = 0; i < 15; i++) await Promise.resolve(); };
beforeEach(() => { appLocalStore.clear(); });
afterEach(() => { vi.restoreAllMocks(); });
for (const reject of [false, true]) {
  it('expired A signout ' + (reject ? 'failure' : 'success') + ' cannot clear a new B login', async () => {
    let resolve!: () => void, fail!: (error: Error) => void;
    const promise = new Promise<void>((a, b) => { resolve = a; fail = b; });
    firebaseState.auth = { currentUser: { uid: 'A' } } as any;
    firebaseState.fb = { signOut: () => promise } as any;
    firebaseState.firebaseConfig = { databaseURL: 'https://shop-A.firebaseio.com' };
    forceExpireSession();
    firebaseState.auth = { currentUser: { uid: 'B' } } as any;
    firebaseState.firebaseConfig = { databaseURL: 'https://shop-B.firebaseio.com' };
    firebaseState.authGeneration++;
    appLocalStore.setItem('zoew_login_time', 'B-session');
    const keyB = { scope: 'B' };
    securityState.lookupSecretKey = keyB as any;
    if (reject) fail(new Error('offline')); else resolve();
    await turn();
    expect(appLocalStore.getItem('zoew_login_time')).toBe('B-session');
    expect(securityState.lookupSecretKey).toBe(keyB);
  });
}
for (const reject of [false, true]) {
  it('expiry finish cannot erase a refreshed login on the same auth/user: ' + reject, async () => {
    let resolve!: () => void, fail!: (e: Error) => void;
    const reply = new Promise<void>((a, b) => { resolve = a; fail = b; });
    firebaseState.auth = { currentUser: { uid: 'same-user' } } as any;
    firebaseState.fb = { signOut: () => reply } as any;
    forceExpireSession(); await turn();
    firebaseState.authGeneration++;
    appLocalStore.setItem('zoew_login_time', 'new-session');
    if (reject) fail(new Error('old signout')); else resolve();
    await turn();
    expect(appLocalStore.getItem('zoew_login_time')).toBe('new-session');
  });
}
it('a periodic expiry result for an old token cannot expire a fresh same-UID login', async () => {
  let resolve!: (v: any) => void;
  const reply = new Promise(r => { resolve = r; });
  const signOut = vi.fn(async () => {});
  firebaseState.auth = { currentUser: { uid: 'same-user' } } as any;
  firebaseState.fb = { getIdTokenResult: () => reply, signOut } as any;
  firebaseState.sessionExpiryCheck = 'live'; firebaseState.sessionExpiryCheckInFlight = false;
  const pending = runSessionExpiryCheck(); await turn();
  firebaseState.authGeneration++;
  resolve({ authTime: new Date(Date.now() - FOUR_HOURS_MS - 60000).toISOString() });
  await pending;
  expect(signOut).not.toHaveBeenCalled();
});
