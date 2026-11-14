import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { firebaseState } from '../../../../ZoeW/src/core/state';
import { viewState } from '../../../../ZoeW/src/core/view-state';
import { appLocalStore, appSessionStore } from '../../../../ZoeW/src/core/storage';
import { REMEMBERED_LOGIN_KEY, rememberLogin } from '../../../../ZoeW/src/features/login-memory';
import { performLogin, logoutApp, setupAuthListener } from '../../../../ZoeW/src/features/auth';
import { proceedAfterLogin } from '../../../../ZoeW/src/features/license';
import { setFieldValue } from '../../../../ZoeW/src/app/refs';
import { showLoginModalWithPrefill, clearRememberedSession } from '../../../../ZoeW/src/features/session';
import { loginBackendScope } from '../../../../ZoeW/src/features/login-memory';
import { createLocalLogoutIntentStore, localAuthSessionCurrent, localLogoutIntent } from '../../../../ZoeW/src/services/local-logout-intent';

vi.mock('../../../../ZoeW/src/features/license', () => ({ proceedAfterLogin: vi.fn() }));
vi.mock('../../../../ZoeW/src/features/license-invitations', () => ({
  cancelLicenseInvitation: vi.fn(), clearLicenseInvitationIntent: vi.fn()
}));
vi.mock('../../../../ZoeW/src/features/session', () => ({
  armSessionExpiryCheck: vi.fn(() => true),
  showLoginModalWithPrefill: vi.fn(),
  clearRememberedSession: vi.fn(() => appLocalStore.removeItem('remembered_email'))
}));
vi.mock('../../../../ZoeW/src/features/password-memory', () => ({
  rememberPasswordPrefIsOff: () => true, setRememberPasswordPref: vi.fn(),
  rememberLoginPassword: vi.fn(), forgetLoginPassword: vi.fn()
}));
vi.mock('../../../../ZoeW/src/features/app-lock', () => ({ clearAppUnlockedForSession: vi.fn(), hideAppLockScreen: vi.fn() }));
vi.mock('../../../../ZoeW/src/features/config', () => ({ checkPinAndOpenConfig: vi.fn() }));
vi.mock('../../../../ZoeW/src/features/account', () => ({ clearPendingInvite: vi.fn() }));
vi.mock('../../../../ZoeW/src/features/clear-history', () => ({ resetClearHistoryOperationState: vi.fn() }));
vi.mock('../../../../ZoeW/src/features/customer-table', () => ({ clearCustomerDataTableCache: vi.fn() }));
vi.mock('../../../../ZoeW/src/features/monthly-report', () => ({ applyCurrentFilter: vi.fn() }));
vi.mock('../../../../ZoeW/src/features/trash', () => ({ renderRecentlyDeleted: vi.fn() }));
vi.mock('../../../../ZoeW/src/services/db-listeners', () => ({ detachDatabaseListeners: vi.fn(), resetDbListenerHealthState: vi.fn(), updateRecentPhonesList: vi.fn() }));
vi.mock('../../../../ZoeW/src/ui/toast', () => ({ showToast: vi.fn() }));
vi.mock('../../../../ZoeW/src/app/refs', () => ({ setFieldValue: vi.fn() }));
vi.mock('../../../../ZoeW/src/core/action-registry', () => ({ lookupAction: vi.fn() }));

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
  firebaseState.authUnsubscribe?.();
  vi.useFakeTimers(); vi.clearAllMocks(); appLocalStore.clear(); appSessionStore.clear();
  firebaseState.authGeneration++;
  firebaseState.isInitializingFirebase = false; firebaseState.firebaseSdkUnavailable = false;
  firebaseState.sessionExpiryCheck = 'live';
  firebaseState.authUnsubscribe = null; firebaseState.authRecoveryTimeout = null;
  viewState.loginBusy = false;
  vi.stubGlobal('alert', vi.fn());
  attach('A');
});
afterEach(() => { firebaseState.authUnsubscribe?.(); firebaseState.authUnsubscribe = null; vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('login/logout callbacks own their actual App auth and backend', () => {
  it('internal write recovery resumes only after the current restored SDK session is accepted', () => {
    let callback: any;
    const auth = firebaseState.auth, user = { uid: 'restored-recovery-owner' };
    auth.currentUser = user;
    const resumeAcceptedSession = vi.fn(value => {
      expect(value).toBe(auth);
      expect(localAuthSessionCurrent(auth, loginBackendScope(), user)).toBe(true);
    });
    firebaseState.fb = { onAuthStateChanged: (_auth, listener) => { callback = listener; return () => {}; }, resumeAcceptedSession };
    setupAuthListener();
    expect(resumeAcceptedSession).not.toHaveBeenCalled();
    callback(user);
    expect(resumeAcceptedSession).toHaveBeenCalledOnce();
    resumeAcceptedSession.mockClear();
    localLogoutIntent.note(loginBackendScope(), user.uid);
    callback(user);
    expect(resumeAcceptedSession).not.toHaveBeenCalled();
    expect(firebaseState.sessionExpiryCheck).toBe('signed-out');
  });

  it('owned credential login resumes internal recovery after acknowledging the exact logout intent', async () => {
    const auth = firebaseState.auth, user = { uid: 'credential-recovery-owner' };
    localLogoutIntent.note(loginBackendScope(), user.uid);
    const resumeAcceptedSession = vi.fn(value => {
      expect(value).toBe(auth);
      expect(localLogoutIntent.blocked(loginBackendScope(), user.uid)).toBe(false);
      expect(localAuthSessionCurrent(auth, loginBackendScope(), user)).toBe(true);
    });
    firebaseState.fb = { setPersistence: async () => {}, signInWithEmailAndPassword: async () => {
      auth.currentUser = user; return { user };
    }, resumeAcceptedSession };
    await performLogin('owner@example.invalid', 'synthetic-password', false, false);
    expect(resumeAcceptedSession).toHaveBeenCalledOnce();
    expect(proceedAfterLogin).toHaveBeenCalledOnce();
  });

  it('a stale credential owner cannot resume internal recovery on its replacement backend', async () => {
    const persistence = deferred<void>(), resumeAcceptedSession = vi.fn();
    firebaseState.fb = { setPersistence: () => persistence.promise,
      signInWithEmailAndPassword: vi.fn(), resumeAcceptedSession };
    const running = performLogin('old@example.invalid', 'synthetic-password', false, false);
    await turn();
    attach('replacement'); firebaseState.authGeneration++;
    persistence.resolve(); await running;
    expect(resumeAcceptedSession).not.toHaveBeenCalled();
    expect(proceedAfterLogin).not.toHaveBeenCalled();
  });

  it('an owned credential response cannot adopt a foreign logout revision between its ACK and actual acceptance', async () => {
    const auth = firebaseState.auth, user = { uid: 'original-credential-proof-owner' };
    const session = new Map<string, string>();
    const other = createLocalLogoutIntentStore(appLocalStore, {
      get length() { return session.size; }, key: (i: number) => [...session.keys()][i] ?? null,
      getItem: (key: string) => session.get(key) ?? null, setItem: (key: string, value: string) => { session.set(key, value); }
    });
    const resumeAcceptedSession = vi.fn(), signInWithEmailAndPassword = vi.fn(async () => { auth.currentUser = user; return { user }; });
    let publishAuth: any;
    firebaseState.fb = { setPersistence: async () => {}, signInWithEmailAndPassword, resumeAcceptedSession,
      onAuthStateChanged: (_auth, callback) => { publishAuth = callback; return () => {}; } };
    setupAuthListener();
    const original = localLogoutIntent.acknowledge;
    let interleaved = 0;
    const acknowledge = vi.spyOn(localLogoutIntent, 'acknowledge').mockImplementation((scope, uid, captured) => {
      const accepted = original(scope, uid, captured);
      expect(accepted).toBe(true);
      interleaved++;
      expect(other.note(scope, uid)).toBe(true);
      expect(other.acknowledge(scope, uid, other.capture(scope))).toBe(true);
      return accepted;
    });
    try {
      await performLogin('owner@example.invalid', 'synthetic-password', false, false);
      expect(signInWithEmailAndPassword).toHaveBeenCalledOnce();
      expect(interleaved).toBe(1);
      expect(other.blocked(loginBackendScope(), user.uid)).toBe(false);
      expect(localAuthSessionCurrent(auth, loginBackendScope(), user)).toBe(false);
      publishAuth(user);
      expect(resumeAcceptedSession).not.toHaveBeenCalled();
      expect(localAuthSessionCurrent(auth, loginBackendScope(), user)).toBe(false);
      expect(firebaseState.sessionExpiryCheck).toBe('signed-out');
      expect(localLogoutIntent.blocked(loginBackendScope(), user.uid)).toBe(true);
      expect(resumeAcceptedSession).not.toHaveBeenCalled();
      expect(proceedAfterLogin).not.toHaveBeenCalled();
    } finally { acknowledge.mockRestore(); }
  });

  it('late current-user auth callback cannot reopen a locally closed session without a new login', async () => {
    let callback;
    const user = { uid: 'A' };
    firebaseState.auth.currentUser = user;
    firebaseState.fb = { onAuthStateChanged: (_auth, listener) => { callback = listener; return () => {}; },
      signOut: () => new Promise<void>(() => {}) } as any;
    setupAuthListener(); callback(user); await turn();
    vi.mocked(proceedAfterLogin).mockClear();
    void logoutApp(); await turn();
    const generation = firebaseState.authGeneration;
    callback(user); await turn();
    expect(proceedAfterLogin).not.toHaveBeenCalled();
    expect(firebaseState.sessionExpiryCheck).toBe('signed-out');
    expect(firebaseState.authGeneration).toBe(generation);
    expect(showLoginModalWithPrefill).toHaveBeenCalled();
  });

  it('control: a current login remembers its scoped account and completes once', async () => {
    const user = { uid: 'A' };
    firebaseState.fb = { setPersistence: () => Promise.resolve(), signInWithEmailAndPassword: async () => {
      firebaseState.auth.currentUser = user;
      return { user };
    } } as any;
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
      logoutApp(); await turn(); attach('B'); firebaseState.authGeneration++;
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

  it('ការរង់ចាំ auth ក្នុងផ្ទាំងលាក់ ដក visibility listener ពេល auth រួច ឬបិទវគ្គ រាល់ 30 cycles', async () => {
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    const active = new Set<any>();
    const add = document.addEventListener.bind(document);
    const remove = document.removeEventListener.bind(document);
    const addSpy = vi.spyOn(document, 'addEventListener').mockImplementation((type: any, listener: any, options: any) => {
      if (type === 'visibilitychange') active.add(listener);
      add(type, listener, options);
    });
    const removeSpy = vi.spyOn(document, 'removeEventListener').mockImplementation((type: any, listener: any, options: any) => {
      if (type === 'visibilitychange') active.delete(listener);
      remove(type, listener, options);
    });
    let callback: any;
    firebaseState.fb = { onAuthStateChanged: (_auth: any, cb: any) => { callback = cb; return vi.fn(); } } as any;
    try {
      for (let i = 0; i < 30; i++) {
        setupAuthListener();
        await vi.advanceTimersByTimeAsync(8000);
        expect(active.size).toBe(1);
        if (i % 2) {
          const user = { uid: 'ready-' + i };
          firebaseState.auth.currentUser = user as any;
          callback(user);
        } else {
          firebaseState.authUnsubscribe!();
        }
        expect(active.size).toBe(0);
      }
    } finally {
      firebaseState.authUnsubscribe?.();
      for (const listener of active) remove('visibilitychange', listener);
      addSpy.mockRestore();
      removeSpy.mockRestore();
      hidden.mockRestore();
    }
  });
});


function foreignInitialAuthIntent() {
  const values = new Map<string, string>();
  return createLocalLogoutIntentStore(appLocalStore, {
    get length() { return values.size; }, key: (i: number) => [...values.keys()][i] ?? null,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, String(value)); }
  });
}

it('the initial SDK callback cannot adopt a logout acknowledged after listener registration', () => {
  let publish!: (user: any) => void;
  const auth = firebaseState.auth, user = { uid: 'pending-initial-sdk-owner' }; auth.currentUser = user;
  const resume = vi.fn();
  firebaseState.fb = { onAuthStateChanged: (_auth, cb) => { publish = cb; return () => {}; }, resumeAcceptedSession: resume };
  setupAuthListener();
  const other = foreignInitialAuthIntent(), scope = loginBackendScope();
  expect(other.note(scope, user.uid)).toBe(true);
  expect(other.acknowledge(scope, user.uid, other.capture(scope))).toBe(true);
  publish(user);
  expect(localAuthSessionCurrent(auth, scope, user)).toBe(false);
  expect(resume).not.toHaveBeenCalled(); expect(proceedAfterLogin).not.toHaveBeenCalled();
  expect(firebaseState.sessionExpiryCheck).toBe('signed-out');
  expect(localLogoutIntent.blocked(scope, user.uid)).toBe(true);
});

it('an initial null callback consumes startup proof before a later legitimate SDK signin', () => {
  let publish!: (user: any) => void;
  const auth = firebaseState.auth, user = { uid: 'initial-null-later-sdk-owner' }, resume = vi.fn();
  firebaseState.fb = { onAuthStateChanged: (_auth, cb) => { publish = cb; return () => {}; }, resumeAcceptedSession: resume };
  setupAuthListener(); publish(null);
  const other = foreignInitialAuthIntent(), scope = loginBackendScope();
  expect(other.note(scope, user.uid)).toBe(true);
  expect(other.acknowledge(scope, user.uid, other.capture(scope))).toBe(true);
  auth.currentUser = user; publish(user);
  expect(localAuthSessionCurrent(auth, scope, user)).toBe(true);
  expect(resume).toHaveBeenCalledOnce(); expect(proceedAfterLogin).toHaveBeenCalledOnce();
});

it('owned credential login supersedes startup proof while its initial SDK callback is pending', async () => {
  let publish!: (user: any) => void;
  const auth = firebaseState.auth, user = { uid: 'pending-initial-explicit-owner' }; auth.currentUser = user;
  firebaseState.fb = { onAuthStateChanged: (_auth, cb) => { publish = cb; return () => {}; },
    setPersistence: async () => {}, signInWithEmailAndPassword: async () => ({ user }) };
  setupAuthListener();
  const other = foreignInitialAuthIntent(), scope = loginBackendScope();
  expect(other.note(scope, user.uid)).toBe(true);
  expect(other.acknowledge(scope, user.uid, other.capture(scope))).toBe(true);
  await performLogin('owner@example.invalid', 'synthetic-password', false, false); publish(user);
  expect(localAuthSessionCurrent(auth, scope, user)).toBe(true);
  expect(localLogoutIntent.blocked(scope, user.uid)).toBe(false);
});


it('a changed raw Config cannot refresh a pending initial Auth proof during listener reattachment', () => {
  let publish!: (user: any) => void;
  const auth = firebaseState.auth, user = { uid: 'pending-config-owner' }; auth.currentUser = user;
  appLocalStore.setItem('zoew_firebase_config', JSON.stringify(firebaseState.firebaseConfig));
  firebaseState.fb = { onAuthStateChanged: (_auth, cb) => { publish = cb; return () => {}; } };
  setupAuthListener();
  appLocalStore.setItem('zoew_firebase_config', JSON.stringify({ ...firebaseState.firebaseConfig, syntheticChanged: true }));
  setupAuthListener(); publish(user);
  expect(localAuthSessionCurrent(auth, loginBackendScope(), user)).toBe(false);
  expect(proceedAfterLogin).not.toHaveBeenCalled();
  expect(firebaseState.sessionExpiryCheck).toBe('signed-out');
});


it('an initial unacknowledged logout cannot become implicit admission when a foreign tab only acknowledges its token', () => {
  let publish!: (user: any) => void;
  const auth = firebaseState.auth, user = { uid: 'initial-unacknowledged-owner' }; auth.currentUser = user;
  const resume = vi.fn(), other = foreignInitialAuthIntent(), scope = loginBackendScope();
  expect(other.note(scope, user.uid)).toBe(true);
  firebaseState.fb = { onAuthStateChanged: (_auth, cb) => { publish = cb; return () => {}; }, resumeAcceptedSession: resume };
  setupAuthListener();
  expect(other.acknowledge(scope, user.uid, other.capture(scope))).toBe(true); publish(user);
  expect(localAuthSessionCurrent(auth, scope, user)).toBe(false); expect(resume).not.toHaveBeenCalled();
  expect(proceedAfterLogin).not.toHaveBeenCalled(); expect(firebaseState.sessionExpiryCheck).toBe('signed-out');
});
