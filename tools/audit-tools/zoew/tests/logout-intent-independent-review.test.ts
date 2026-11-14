import { beforeEach, expect, it, vi } from 'vitest';
import { appLocalStore, appSessionStore } from '../../../../ZoeW/src/core/storage';
import { dataState, firebaseState, uiState } from '../../../../ZoeW/src/core/state';
import { acceptServerClockOffset, resetServerClock } from '../../../../ZoeW/src/core/clock';
import { sessionUserActionAllowed, sessionVerificationRequired } from '../../../../ZoeW/src/core/session-verification';
import { captureConnectionOperation, connectionFlowSnapshot, withConnectionOwnership } from '../../../../ZoeW/src/services/connection-flow';
import { acceptLocalAuthSession, createLocalLogoutIntentStore, localLogoutIntent, LOCAL_LOGOUT_INTENT_PREFIX } from '../../../../ZoeW/src/services/local-logout-intent';

import { forceExpireSession } from '../../../../ZoeW/src/features/session';
import { captureAuthDatabaseGuard } from '../../../../ZoeW/src/features/exchange-rate';
import { modalIsOpen, registerModalMeta, unregisterModalMeta } from '../../../../ZoeW/src/core/modals';

vi.mock('../../../../ZoeW/src/features/license', async original => ({ ...await original<any>(), proceedAfterLogin: vi.fn(async () => false) }));

const config = { databaseURL: 'https://independent-tab.firebaseio.com' };
let uid = 'independent-second-tab';
let scenario = 0;
function ownSessionStore() {
    const values = new Map<string, string>();
    return { get length() { return values.size; }, key: (i: number) => [...values.keys()][i] ?? null,
        getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
}
beforeEach(() => {
    uid = 'independent-second-tab-' + (++scenario);
    appLocalStore.clear(); appSessionStore.clear(); resetServerClock();
    Object.assign(firebaseState, { firebaseConfig: config, fb: {}, db: {}, auth: { currentUser: { uid } },
        sessionExpiryCheck: 'live', authLoginOperation: null, isInitializingFirebase: false,
        firebaseSdkUnavailable: false, isDatabaseConnected: true, isDatabaseInitialized: true, dbListenersFailed: false });
    expect(acceptLocalAuthSession(firebaseState.auth, 'fb:' + config.databaseURL, firebaseState.auth.currentUser)).toBe(true);
    expect(acceptServerClockOffset(0, Object.freeze({ source: 'nonce', generation: 1, monotonicMs: performance.now(),
        wallMs: Date.now(), epochMs: Date.now(), uncertaintyMs: 0 }), true)).toBe(true);
    firebaseState.sessionExpiryCheck = 'live';
});
function logoutFromOtherTab() {
    const other = createLocalLogoutIntentStore(appLocalStore, ownSessionStore());
    expect(other.note('fb:' + config.databaseURL, uid)).toBe(true);
    expect(firebaseState.sessionExpiryCheck).toBe('live');
    expect(connectionFlowSnapshot().canWrite).toBe(false);
}
it('same-origin other-tab logout blocks UI business actions as well as database writes', () => {
    expect(sessionUserActionAllowed('openZtoPalmSign')).toBe(true);
    logoutFromOtherTab();
    expect(sessionUserActionAllowed('openZtoPalmSign')).toBe(false);
});
it('same-origin other-tab logout invalidates already-captured authenticated request leases', () => {
    const lease = captureConnectionOperation();
    expect(lease.current()).toBe(true);
    logoutFromOtherTab();
    expect(lease.current()).toBe(false);
});

it('same-origin other-tab logout stops previously attached data listener delivery', () => {
    const app = {}, auth = { app, currentUser: { uid } }, db = { app };
    let deliver!: (snapshot: any) => void;
    const off = vi.fn();
    const raw = { getAuth: () => auth, getDatabase: () => db, ref: (_db: any, path: string) => ({ path }),
        onValue: (_ref: any, callback: any) => { deliver = callback; return off; } };
    const sdk = withConnectionOwnership(raw); sdk.getAuth(app); sdk.getDatabase(app);
    Object.assign(firebaseState, { fb: sdk, auth, db });
    expect(acceptLocalAuthSession(auth, 'fb:' + config.databaseURL, auth.currentUser)).toBe(true);
    const received = vi.fn();
    const stop = sdk.onValue(sdk.ref(db, 'zoew_scan_history_cod_dod'), received);
    try {
        deliver({ val: () => 'before-logout' });
        expect(received).toHaveBeenCalledOnce();
        logoutFromOtherTab();
        deliver({ val: () => 'after-logout-private-row' });
        expect(received).toHaveBeenCalledOnce();
    } finally { stop(); }
});

it('expiry remains visually covered while SDK sign-out is pending', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    registerModalMeta('loginModal', { noDismiss: true });
    Object.assign(uiState, { modalDisplay: {}, modalStack: [], isModalOpen: false });
    dataState.scanHistory = [{ id: 'private-old-row', phone: 'synthetic-old', barcodes: [{ code: 'PRIVATE' }] }];
    firebaseState.fb = { signOut: () => new Promise<void>(() => {}) };
    try {
        forceExpireSession();
        expect(firebaseState.sessionExpiryCheck).toBe('expired');
        expect(sessionVerificationRequired() || modalIsOpen('loginModal') && dataState.scanHistory.length === 0).toBe(true);
    } finally { unregisterModalMeta('loginModal'); vi.clearAllTimers(); vi.useRealTimers(); }
});

it('acknowledging logout in another tab never revives the old authenticated lease', () => {
    const lease = captureConnectionOperation();
    expect(lease.current()).toBe(true);
    const otherTab = createLocalLogoutIntentStore(appLocalStore, ownSessionStore());
    expect(otherTab.note('fb:' + config.databaseURL, uid)).toBe(true);
    expect(lease.current()).toBe(false);
    expect(otherTab.acknowledge('fb:' + config.databaseURL, uid, otherTab.capture('fb:' + config.databaseURL))).toBe(true);
    expect(connectionFlowSnapshot().canWrite).toBe(false);
    expect(lease.current()).toBe(false);
});

it('an accepted old tab cannot admit new actions or leases after foreign logout and acknowledgement before storage delivery', async () => {
    let publishAuth!: (user: any) => void;
    firebaseState.fb = {
        onAuthStateChanged: (_auth, callback) => { publishAuth = callback; return () => {}; },
        getIdTokenResult: async () => ({ authTime: new Date().toISOString() })
    };
    const { setupAuthListener } = await import('../../../../ZoeW/src/features/auth');
    setupAuthListener();
    try {
        publishAuth(firebaseState.auth.currentUser);
        for (let i = 0; i < 40; i++) await Promise.resolve();
        expect(firebaseState.sessionExpiryCheck).toBe('live');
        expect(connectionFlowSnapshot().canWrite).toBe(true);
        const generation = firebaseState.authGeneration;
        const otherTab = createLocalLogoutIntentStore(appLocalStore, ownSessionStore());
        expect(otherTab.note('fb:' + config.databaseURL, uid)).toBe(true);
        expect(connectionFlowSnapshot().canWrite).toBe(false);
        expect(otherTab.acknowledge('fb:' + config.databaseURL, uid, otherTab.capture('fb:' + config.databaseURL))).toBe(true);
        expect(firebaseState.authGeneration).toBe(generation);
        expect(connectionFlowSnapshot().canWrite).toBe(false);
        expect(sessionUserActionAllowed('openZtoPalmSign')).toBe(false);
        expect(captureConnectionOperation().current()).toBe(false);
        expect(captureAuthDatabaseGuard()()).toBe(false);
        publishAuth(firebaseState.auth.currentUser);
        for (let i = 0; i < 40; i++) await Promise.resolve();
        expect(connectionFlowSnapshot().canWrite).toBe(false);
        expect(firebaseState.sessionExpiryCheck).toBe('signed-out');
    } finally { firebaseState.authUnsubscribe?.(); firebaseState.authUnsubscribe = null; }
});

it('a delayed logout storage event cannot cancel an explicit login begun after that intent', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const auth = firebaseState.auth;
    firebaseState.fb = {
        onAuthStateChanged: () => () => {}, setPersistence: async () => {},
        signInWithEmailAndPassword: async () => ({ user: auth.currentUser }),
        getIdTokenResult: async () => ({ authTime: new Date().toISOString() })
    };
    resetServerClock();
    expect(acceptServerClockOffset(0, Object.freeze({ source: 'nonce', generation: 1, monotonicMs: performance.now(), wallMs: Date.now(), epochMs: Date.now(), uncertaintyMs: 0 }), true)).toBe(true);
    firebaseState.sessionExpiryCheck = 'live';
    const { setupAuthListener, performLogin } = await import('../../../../ZoeW/src/features/auth');
    setupAuthListener();
    try {
        const otherTab = createLocalLogoutIntentStore(appLocalStore, ownSessionStore());
        expect(otherTab.note('fb:' + config.databaseURL, uid)).toBe(true);
        const key = LOCAL_LOGOUT_INTENT_PREFIX + JSON.stringify('fb:' + config.databaseURL) + ':' + JSON.stringify(uid);
        const newValue = appLocalStore.getItem(key);
        await performLogin('new@example.invalid', 'synthetic-password', false, false);
        for (let i = 0; i < 40; i++) await Promise.resolve();
        expect(localLogoutIntent.blocked('fb:' + config.databaseURL, uid)).toBe(false);
        expect(firebaseState.sessionExpiryCheck).toBe('live');
        window.dispatchEvent(new StorageEvent('storage', { key, oldValue: null, newValue, storageArea: appLocalStore }));
        expect(firebaseState.sessionExpiryCheck).toBe('live');
    } finally { firebaseState.authUnsubscribe?.(); firebaseState.authUnsubscribe = null; vi.clearAllTimers(); vi.useRealTimers(); }
});

it('auth listener replacement and teardown remove every owned storage observer and recovery timer', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const add = vi.spyOn(window, 'addEventListener'), remove = vi.spyOn(window, 'removeEventListener');
    const stopSdk = vi.fn();
    firebaseState.fb = { onAuthStateChanged: () => stopSdk };
    const { setupAuthListener } = await import('../../../../ZoeW/src/features/auth');
    try {
        for (let i = 0; i < 20; i++) setupAuthListener();
        expect(stopSdk).toHaveBeenCalledTimes(19);
        firebaseState.authUnsubscribe?.(); firebaseState.authUnsubscribe = null;
        expect(stopSdk).toHaveBeenCalledTimes(20);
        const added = add.mock.calls.filter(([event]) => String(event) === 'storage').map(([, callback]) => callback);
        const removed = remove.mock.calls.filter(([event]) => String(event) === 'storage').map(([, callback]) => callback);
        expect(added).toHaveLength(20);
        expect(removed).toEqual(added);
        expect(vi.getTimerCount()).toBe(0);
        const generation = firebaseState.authGeneration;
        const otherTab = createLocalLogoutIntentStore(appLocalStore, ownSessionStore());
        otherTab.note('fb:' + config.databaseURL, uid);
        const key = LOCAL_LOGOUT_INTENT_PREFIX + JSON.stringify('fb:' + config.databaseURL) + ':' + JSON.stringify(uid);
        window.dispatchEvent(new StorageEvent('storage', { key, oldValue: null, newValue: appLocalStore.getItem(key), storageArea: appLocalStore }));
        expect(firebaseState.authGeneration).toBe(generation);
    } finally { firebaseState.authUnsubscribe?.(); firebaseState.authUnsubscribe = null; add.mockRestore(); remove.mockRestore(); vi.clearAllTimers(); vi.useRealTimers(); }
});

it('active auth observer ignores foreign backend and UID logout markers', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    firebaseState.fb = { onAuthStateChanged: () => () => {} };
    const { setupAuthListener } = await import('../../../../ZoeW/src/features/auth');
    setupAuthListener();
    try {
        const generation = firebaseState.authGeneration;
        const otherTab = createLocalLogoutIntentStore(appLocalStore, ownSessionStore());
        for (const [scope, who] of [['fb:https://foreign.firebaseio.com', uid], ['fb:' + config.databaseURL, 'foreign-uid']]) {
            otherTab.note(scope, who);
            const key = LOCAL_LOGOUT_INTENT_PREFIX + JSON.stringify(scope) + ':' + JSON.stringify(who);
            window.dispatchEvent(new StorageEvent('storage', { key, oldValue: null, newValue: appLocalStore.getItem(key), storageArea: appLocalStore }));
            expect(firebaseState.authGeneration).toBe(generation);
            expect(firebaseState.sessionExpiryCheck).toBe('live');
        }
    } finally { firebaseState.authUnsubscribe?.(); firebaseState.authUnsubscribe = null; vi.clearAllTimers(); vi.useRealTimers(); }
});

for (const expiry of [false, true]) it((expiry ? 'expiry' : 'manual logout') + ' warns honestly when both intent stores reject actual writes', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    let denied = 0;
    const spies = [appLocalStore, appSessionStore].map(area => {
        const original = area.setItem;
        return vi.spyOn(area, 'setItem').mockImplementation((key, value) => {
            if (String(key).startsWith(LOCAL_LOGOUT_INTENT_PREFIX)) { denied++; throw new Error('synthetic quota refusal'); }
            return original.call(area, key, value);
        });
    });
    firebaseState.fb = { signOut: async () => { throw new Error('synthetic SDK persistence refusal'); } };
    uiState.toasts = [];
    try {
        if (expiry) { forceExpireSession(); for (let i = 0; i < 40; i++) await Promise.resolve(); }
        else { const { logoutApp } = await import('../../../../ZoeW/src/features/auth'); await logoutApp(); }
        expect(denied).toBe(2);
        expect(localLogoutIntent.blocked('fb:' + config.databaseURL, uid)).toBe(true);
        expect(connectionFlowSnapshot().canWrite).toBe(false);
        expect(uiState.toasts.some(toast => toast.msg.includes('កុំបិទ ឬ Refresh'))).toBe(true);
        expect(uiState.toasts.some(toast => toast.msg === '✅ បានចាកចេញពីប្រព័ន្ធ!')).toBe(false);
    } finally { spies.forEach(spy => spy.mockRestore()); vi.clearAllTimers(); vi.useRealTimers(); }
});
