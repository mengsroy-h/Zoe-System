import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { firebaseState } from '../src/core/state';
import { viewState } from '../src/core/view-state';
import { appLocalStore, appSessionStore } from '../src/core/storage';
import { REMEMBERED_LOGIN_KEY, rememberLogin } from '../src/features/login-memory';
import { performLogin, logoutApp, setupAuthListener } from '../src/features/auth';
import { proceedAfterLogin } from '../src/features/license';
import { setFieldValue } from '../src/app/refs';
import { showLoginModalWithPrefill, clearRememberedSession } from '../src/features/session';

vi.mock('../src/features/license', () => ({ proceedAfterLogin: vi.fn() }));
vi.mock('../src/features/session', () => ({
  showLoginModalWithPrefill: vi.fn(),
  clearRememberedSession: vi.fn(() => appLocalStore.removeItem('remembered_email'))
}));
vi.mock('../src/features/password-memory', () => ({
  rememberPasswordPrefIsOff: () => true, setRememberPasswordPref: vi.fn(),
  rememberLoginPassword: vi.fn(), forgetLoginPassword: vi.fn()
}));
vi.mock('../src/features/app-lock', () => ({ clearAppUnlockedForSession: vi.fn() }));
vi.mock('../src/features/config', () => ({ checkPinAndOpenConfig: vi.fn() }));
vi.mock('../src/features/account', () => ({ clearPendingInvite: vi.fn() }));
vi.mock('../src/features/clear-history', () => ({ resetClearHistoryOperationState: vi.fn() }));
vi.mock('../src/features/customer-table', () => ({ clearCustomerDataTableCache: vi.fn() }));
vi.mock('../src/features/monthly-report', () => ({ applyCurrentFilter: vi.fn() }));
vi.mock('../src/features/trash', () => ({ renderRecentlyDeleted: vi.fn() }));
vi.mock('../src/services/db-listeners', () => ({ detachDatabaseListeners: vi.fn(), resetDbListenerHealthState: vi.fn(), updateRecentPhonesList: vi.fn() }));
vi.mock('../src/ui/toast', () => ({ showToast: vi.fn() }));
vi.mock('../src/app/refs', () => ({ setFieldValue: vi.fn() }));

const turn = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
const deferred = <T>() => {
  let resolve!: (value: T) => void, reject!: (error: Error) => void;
  const promise = new Promise<T>((a, b) => { resolve = a; reject = b; });
  return { promise, resolve, reject };
};
function attach(name: string) {
  firebaseState.firebaseConfig = { databaseURL: 'https://shop-' + name + '.firebaseio.com' };
  firebaseState.auth = { currentUser: null } as any;
  firebaseState.db = { shop: name } as any;
  return firebaseState.auth;
}
beforeEach(() => {
  vi.useFakeTimers(); vi.clearAllMocks(); appLocalStore.clear(); appSessionStore.clear();
  firebaseState.authGeneration++;
  firebaseState.isInitializingFirebase = false; firebaseState.firebaseSdkUnavailable = false;
  firebaseState.authUnsubscribe = null; firebaseState.authRecoveryTimeout = null;
  viewState.loginBusy = false;
  vi.stubGlobal('alert', vi.fn());
  attach('A');
});
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('login/logout callbacks own their actual App auth and backend', () => {
  it('control: a current login remembers its scoped account and completes once', async () => {
    const user = { uid: 'A' };
    firebaseState.fb = { setPersistence: () => Promise.resolve(), signInWithEmailAndPassword: async () => ({ user }) } as any;
    performLogin('a@example.invalid', 'test-password', true, false);
    await turn();
    expect(appLocalStore.getItem(REMEMBERED_LOGIN_KEY)).toBe('a@example.invalid');
    expect(proceedAfterLogin).toHaveBeenCalledOnce();
    expect(viewState.loginBusy).toBe(false);
  });
  for (const mode of ['initializing', 'auth-app-mismatch', 'stored-config-mismatch']) {
    it('never sends credentials while backend ownership is incoherent: ' + mode, async () => {
      const signin = vi.fn(async () => ({ user: { uid: 'wrong-backend' } }));
      firebaseState.fb = { setPersistence: async () => {}, signInWithEmailAndPassword: signin } as any;
      if (mode === 'initializing') firebaseState.isInitializingFirebase = true;
      if (mode === 'auth-app-mismatch') (firebaseState.auth as any).app = { options: { databaseURL: 'https://different-shop.firebaseio.com' } };
      if (mode === 'stored-config-mismatch') appLocalStore.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: 'https://different-shop.firebaseio.com' }));
      performLogin('user@example.invalid', 'test-secret', true, false); await turn();
      expect(signin).not.toHaveBeenCalled();
      expect(appLocalStore.getItem(REMEMBERED_LOGIN_KEY)).toBeNull();
    });
  }
  it('changing Config during persistence must never send A credentials to auth B', async () => {
    const persistence = deferred<void>();
    const signIn = vi.fn(async () => ({ user: { uid: 'unexpected' } }));
    firebaseState.fb = { setPersistence: () => persistence.promise, signInWithEmailAndPassword: signIn } as any;
    performLogin('a@example.invalid', 'test-password-A', true, false);
    await turn();
    const authB = attach('B'); firebaseState.authGeneration++;
    persistence.resolve(); await turn();
    expect(signIn.mock.calls.some((args: any[]) => args[0] === authB)).toBe(false);
    expect(signIn).not.toHaveBeenCalled();
  });
  it('a late successful login A cannot replace remembered B or clear B password field', async () => {
    const reply = deferred<any>();
    firebaseState.fb = { setPersistence: () => Promise.resolve(), signInWithEmailAndPassword: () => reply.promise } as any;
    performLogin('a@example.invalid', 'test-password-A', true, false);
    await turn();
    attach('B'); firebaseState.authGeneration++;
    rememberLogin('b@example.invalid');
    reply.resolve({ user: { uid: 'A' } }); await turn();
    expect(appLocalStore.getItem(REMEMBERED_LOGIN_KEY)).toBe('b@example.invalid');
    expect(setFieldValue).not.toHaveBeenCalled();
    expect(proceedAfterLogin).not.toHaveBeenCalled();
  });
  it('late login errors from A do not alert the newly configured B', async () => {
    const reply = deferred<any>();
    firebaseState.fb = { setPersistence: () => Promise.resolve(), signInWithEmailAndPassword: () => reply.promise } as any;
    performLogin('a@example.invalid', 'test-password-A', true, false); await turn();
    attach('B'); firebaseState.authGeneration++;
    reply.reject(new Error('network-A')); await turn();
    expect(alert).not.toHaveBeenCalled();
  });
  for (const rejects of [false, true]) {
    it('late logout A ' + (rejects ? 'failure' : 'success') + ' cannot erase or reopen login over B', async () => {
      const reply = deferred<void>();
      firebaseState.fb = { signOut: () => reply.promise } as any;
      logoutApp(); attach('B'); firebaseState.authGeneration++;
      rememberLogin('b@example.invalid');
      if (rejects) reply.reject(new Error('logout-A')); else reply.resolve();
      await turn();
      expect(clearRememberedSession).not.toHaveBeenCalled();
      expect(showLoginModalWithPrefill).not.toHaveBeenCalled();
      expect(appLocalStore.getItem(REMEMBERED_LOGIN_KEY)).toBe('b@example.invalid');
    });
    it('late logout preserves a new login that reuses the same user object: ' + rejects, async () => {
      const reply = deferred<void>();
      const user = { uid: 'same-user' };
      firebaseState.auth.currentUser = user as any;
      firebaseState.fb = { signOut: () => reply.promise } as any;
      logoutApp(); await turn();
      firebaseState.authGeneration++;
      rememberLogin('new@example.invalid');
      if (rejects) reply.reject(new Error('old logout')); else reply.resolve();
      await turn();
      expect(appLocalStore.getItem(REMEMBERED_LOGIN_KEY)).toBe('new@example.invalid');
      expect(clearRememberedSession).not.toHaveBeenCalled();
    });
  }
  it('requesting logout immediately invalidates previously captured App generations', async () => {
    const reply = deferred<void>();
    firebaseState.fb = { signOut: () => reply.promise } as any;
    const generation = firebaseState.authGeneration;
    logoutApp(); const after = firebaseState.authGeneration;
    reply.resolve(); await turn();
    expect(after).toBeGreaterThan(generation);
  });
  it('a callback queued before auth listener replacement cannot advance B auth generation', () => {
    const callbacks: any[] = [];
    firebaseState.fb = { onAuthStateChanged: (_: any, cb: any) => { callbacks.push(cb); return vi.fn(); } } as any;
    setupAuthListener(); attach('B'); setupAuthListener();
    const generationB = firebaseState.authGeneration;
    callbacks[0]({ uid: 'A' });
    expect(firebaseState.authGeneration).toBe(generationB);
    expect(proceedAfterLogin).not.toHaveBeenCalled();
    const userB = { uid: 'B' };
    firebaseState.auth.currentUser = userB as any;
    callbacks[1](userB);
    expect(proceedAfterLogin).toHaveBeenCalledOnce();
  });
  it('unsubscribe and reattach on the same auth also fences old queued callbacks', () => {
    const callbacks: any[] = [];
    firebaseState.fb = { onAuthStateChanged: (_: any, cb: any) => { callbacks.push(cb); return vi.fn(); } } as any;
    setupAuthListener(); setupAuthListener();
    const generation = firebaseState.authGeneration;
    callbacks[0]({ uid: 'old' });
    expect(firebaseState.authGeneration).toBe(generation);
  });
  it('a queued A user snapshot cannot be accepted when the same auth now owns B', () => {
    let callback: any;
    firebaseState.fb = { onAuthStateChanged: (_: any, cb: any) => { callback = cb; return vi.fn(); } } as any;
    setupAuthListener();
    firebaseState.auth.currentUser = { uid: 'B' } as any;
    const generation = firebaseState.authGeneration;
    callback({ uid: 'A' });
    expect(firebaseState.authGeneration).toBe(generation);
    expect(proceedAfterLogin).not.toHaveBeenCalled();
  });
  it('a storage recovery already awaiting IndexedDB stops when auth becomes ready', async () => {
    const databases = deferred<any[]>(); const deleted = vi.fn(() => {
      const req: any = {}; Promise.resolve().then(() => req.onsuccess?.()); return req;
    });
    const enumerate = vi.fn(() => databases.promise);
    vi.stubGlobal('indexedDB', { databases: enumerate, deleteDatabase: deleted });
    vi.spyOn(window.location, 'reload').mockImplementation(() => {});
    let callback: any;
    firebaseState.fb = { onAuthStateChanged: (_: any, cb: any) => { callback = cb; return vi.fn(); } } as any;
    setupAuthListener(); await vi.advanceTimersByTimeAsync(8000);
    expect(enumerate).toHaveBeenCalledOnce();
    const user = { uid: 'ready-user' }; firebaseState.auth.currentUser = user as any; callback(user);
    databases.resolve([{ name: 'firebaseLocalStorageDb' }]); await turn();
    expect(deleted).not.toHaveBeenCalled();
    expect(window.location.reload).not.toHaveBeenCalled();
  });
  it('a hidden tab never deletes the shared auth storage ➜ the stuck-auth recovery waits until the tab is visible', async () => {
    const deleted = vi.fn(() => { const req: any = {}; Promise.resolve().then(() => req.onsuccess?.()); return req; });
    vi.stubGlobal('indexedDB', { databases: vi.fn(async () => [{ name: 'firebaseLocalStorageDb' }]), deleteDatabase: deleted });
    vi.spyOn(window.location, 'reload').mockImplementation(() => {});
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    try {
      firebaseState.fb = { onAuthStateChanged: () => vi.fn() } as any;
      setupAuthListener(); await vi.advanceTimersByTimeAsync(8000); await turn();
      expect({ deleted: deleted.mock.calls.length, reloaded: (window.location.reload as any).mock.calls.length }).toEqual({ deleted: 0, reloaded: 0 });
      hidden.mockReturnValue(false);
      document.dispatchEvent(new Event('visibilitychange'));
      await turn(); await turn();
      expect(deleted).toHaveBeenCalled();
    } finally {
      hidden.mockRestore();
    }
  });
});
