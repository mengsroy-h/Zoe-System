// Deep audit ៩ (network N1) ៖ the ownership proxy binds every data-listener row to the session it was attached in (uid · auth
// generation · backend). A session that changed without a detach + re-attach left every row dead while the app said «ready» ៖
//  ① Firebase account A ➜ B without a signed-out snapshot (cross-tab persistence sync on a busy or hidden tab).
//  ② The same account signs in again after a sign-out the SDK refused (logout's «⚠️ មិនអាចបញ្ជាក់ថាបានចាកចេញ…» path).
//  ③ Another tab rewrites the stored Config of the same shop (other key order) ➜ the rows compare the raw text, so they died.
//  ④ Another tab saves another shop ➜ this tab stayed on the old one with dead rows.
//  A Config saved in another tab now re-initializes this tab the same way it re-initializes the tab that saved it.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dataState, firebaseState, scanState, uiState } from '../src/core/state';
import { viewState } from '../src/core/view-state';
import { appLocalStore } from '../src/core/storage';
import { withTransactionOutcomeResolution } from '../src/services/tx-outcome';
import { logoutApp, performLogin, setupAuthListener } from '../src/features/auth';
import { loginBackendScope } from '../src/features/login-memory';
import { connectionFlowSnapshot } from '../src/services/connection-flow';
import { renderConnectionStatus, setupConnectionRecovery } from '../src/services/connection';
import { initDatabaseListeners } from '../src/services/db-listeners';
import { dbListenerFailedPaths, dbListenerPendingPaths } from '../src/core/text';

const HISTORY = 'zoew_scan_history_cod_dod';
const SHOP_A = { apiKey: 'k', databaseURL: 'https://shop-a.firebaseio.com' };
const SHOP_B = { apiKey: 'k2', databaseURL: 'https://shop-b.firebaseio.com' };

function fakeFirebase(options: any = SHOP_A) {
    const apps: any[] = [];
    const listeners = new Map<string, Set<any>>();
    const authCbs = new Set<any>();
    const auths = new Map<any, any>();
    const raw: any = {
        getApps: () => apps.slice(),
        initializeApp: (opts: any) => { const a = { name: '[DEFAULT]', options: opts }; apps.push(a); return a; },
        deleteApp: async (a: any) => { const i = apps.indexOf(a); if (i !== -1) apps.splice(i, 1); },
        getAuth: (app: any) => { if (!auths.has(app)) auths.set(app, { app, currentUser: null }); return auths.get(app); },
        getDatabase: (app: any) => ({ app }),
        ref: (db: any, path?: string) => ({ db, path: path || '', toString: () => db.app.options.databaseURL + '/' + (path || '') }),
        onValue: (ref: any, cb: any, err: any) => {
            const key = ref.db.app.options.databaseURL + '|' + ref.path;
            const set = listeners.get(key) || new Set(); const row = { cb, err }; set.add(row); listeners.set(key, set);
            return () => set.delete(row);
        },
        off: (ref: any) => { listeners.delete(ref.db.app.options.databaseURL + '|' + ref.path); },
        onAuthStateChanged: (_a: any, cb: any) => { authCbs.add(cb); return () => authCbs.delete(cb); },
        getIdTokenResult: async () => ({ authTime: new Date().toISOString() }),
        setPersistence: async () => {}, browserLocalPersistence: {}, browserSessionPersistence: {},
        signOut: async () => { throw new Error('persistence refused'); },
        signInWithEmailAndPassword: async (auth: any) => ({ user: auth.currentUser }),
        goOnline() {}, goOffline() {}, get: async () => ({ val: () => null }),
        runTransaction: async () => ({ committed: true, snapshot: { val: () => null } }), set: async () => {}, update: async () => {}
    };
    const app = raw.initializeApp(options);
    return {
        raw, app,
        emitAuth(user: any) { raw.getAuth(apps[0]).currentUser = user; authCbs.forEach((cb) => cb(user)); },
        push(url: string, path: string, value: any) { (listeners.get(url + '|' + path) || new Set()).forEach((l: any) => l.cb({ val: () => value })); }
    };
}
const flush = async () => { for (let i = 0; i < 60; i++) await Promise.resolve(); };
const item = (id: string) => ({ [id]: { id, phone: '012000111', createdAt: 1, barcodes: [{ code: 'ZT' + id, cod: 1, dod: 0 }] } });
const ids = () => dataState.scanHistory.map((i: any) => i.id);

function attach(f: ReturnType<typeof fakeFirebase>, config: any) {
    appLocalStore.setItem('zoew_firebase_config', JSON.stringify(config));
    const sdk = withTransactionOutcomeResolution(f.raw);
    firebaseState.fb = sdk; firebaseState.firebaseConfig = config;
    firebaseState.auth = sdk.getAuth(f.app); firebaseState.db = sdk.getDatabase(f.app);
    firebaseState.dbRefHistory = sdk.ref(firebaseState.db, HISTORY);
    firebaseState.dbRefDeleted = null; firebaseState.dbRefDailyRevenue = null; firebaseState.dbRefMonthlyRevenue = null;
    firebaseState.dbRefDailyPickup = null; firebaseState.dbRefDailyCollected = null; firebaseState.dbRefExchangeRate = null;
    firebaseState.dbRefZtoSignedSweep = null; firebaseState.dbRefZtoTrashMode = null; firebaseState.dbRefZtoSweepLane = null;
    Object.assign(firebaseState, { isDatabaseConnected: true, dbListenersFailed: false, sessionExpiryCheck: 'live', authLoginOperation: null,
        isInitializingFirebase: false, firebaseSdkUnavailable: false });
    return sdk;
}

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    (window as any).ZoeLicense = { getStatus: async () => ({ state: 'active' }) };
    (window as any).ZoeErrors = { capture: vi.fn() };
    viewState.backendKind = 'firebase'; firebaseState.isDatabaseInitialized = false; firebaseState.authGeneration++;
    firebaseState.authUnsubscribe = null; firebaseState.authRecoveryTimeout = null; viewState.loginBusy = false;
    dataState.scanHistory = []; dbListenerPendingPaths.clear(); dbListenerFailedPaths.clear();
});
afterEach(() => {
    if (firebaseState.authUnsubscribe) firebaseState.authUnsubscribe();
    firebaseState.authUnsubscribe = null;
    vi.clearAllTimers(); vi.useRealTimers();
    delete (window as any).ZoeLicense; delete (window as any).firebaseSDK; delete (window as any).loadFirebaseSDK;
    appLocalStore.clear();
});

describe('data listeners follow the session they belong to', () => {
    it('① account A ➜ B without a signed-out snapshot ➜ the view resets and keeps delivering', async () => {
        const f = fakeFirebase();
        attach(f, SHOP_A);
        setupAuthListener();
        f.emitAuth({ uid: 'A' }); await flush();
        expect(firebaseState.isDatabaseInitialized, 'precondition').toBe(true);
        f.push(SHOP_A.databaseURL, HISTORY, item('h1'));
        expect(ids(), 'precondition').toEqual(['h1']);
        scanState.pendingBarcode = 'ZTA0001';
        scanState.pendingScanSession = { db: firebaseState.db, auth: firebaseState.authGeneration };
        f.emitAuth({ uid: 'B' }); await flush();
        expect({ ids: ids(), scan: scanState.pendingBarcode }, 'account A view and scan are gone before B data arrives').toEqual({ ids: [], scan: '' });
        f.push(SHOP_A.databaseURL, HISTORY, { ...item('h1'), ...item('h2') });
        expect({ phase: connectionFlowSnapshot().phase, ids: ids() }).toEqual({ phase: 'ready', ids: ['h1', 'h2'] });
    });

    it('② the same account signs in again after a refused sign-out ➜ listeners re-attach', async () => {
        const f = fakeFirebase();
        attach(f, SHOP_A);
        setupAuthListener();
        f.emitAuth({ uid: 'A' }); await flush();
        f.push(SHOP_A.databaseURL, HISTORY, item('h1'));
        expect(ids(), 'precondition').toEqual(['h1']);
        await logoutApp(); await flush();
        expect(f.raw.getAuth(f.app).currentUser, 'precondition ៖ the SDK kept the user').toEqual({ uid: 'A' });
        expect(firebaseState.isDatabaseInitialized, 'precondition ៖ the refused sign-out kept the dead rows').toBe(true);
        uiState.toasts = [];
        await performLogin('a@zoew1.com', 'pw', false, false); await flush();
        expect(uiState.toasts.filter((t: any) => t.live === 'signin').length, 're-attached session ➜ its live sign-in toast').toBe(1);
        f.push(SHOP_A.databaseURL, HISTORY, { ...item('h1'), ...item('h2') });
        expect({ phase: connectionFlowSnapshot().phase, ids: ids() }).toEqual({ phase: 'ready', ids: ['h1', 'h2'] });
    });

    it('③ another tab rewrites the same shop in another key order ➜ this tab re-initializes and keeps receiving', async () => {
        const f = fakeFirebase();
        (window as any).firebaseSDK = f.raw; (window as any).loadFirebaseSDK = () => {};
        attach(f, SHOP_A);
        setupAuthListener();
        f.emitAuth({ uid: 'A' }); await flush();
        f.push(SHOP_A.databaseURL, HISTORY, item('h1'));
        expect(ids(), 'precondition').toEqual(['h1']);
        const stop = setupConnectionRecovery();
        try {
            const text = JSON.stringify({ databaseURL: SHOP_A.databaseURL, apiKey: SHOP_A.apiKey });
            appLocalStore.setItem('zoew_firebase_config', text);
            window.dispatchEvent(new StorageEvent('storage', { key: 'zoew_firebase_config', newValue: text }));
            await flush(); await vi.advanceTimersByTimeAsync(100); await flush();
            f.push(SHOP_A.databaseURL, '.info/connected', true);
            f.emitAuth({ uid: 'A' }); await flush();
            f.push(SHOP_A.databaseURL, HISTORY, { ...item('h1'), ...item('h2') });
            expect({ historyPending: dbListenerPendingPaths.has('history'), ids: ids() }).toEqual({ historyPending: false, ids: ['h1', 'h2'] });
        } finally { stop(); }
    });

    it('④ another tab saves another shop ➜ this tab follows the stored Config', async () => {
        const f = fakeFirebase();
        (window as any).firebaseSDK = f.raw; (window as any).loadFirebaseSDK = () => {};
        attach(f, SHOP_A);
        firebaseState.auth.currentUser = { uid: 'A' };
        initDatabaseListeners();
        const stop = setupConnectionRecovery();
        try {
            appLocalStore.setItem('zoew_firebase_config', JSON.stringify(SHOP_B));
            window.dispatchEvent(new StorageEvent('storage', { key: 'zoew_firebase_config', newValue: JSON.stringify(SHOP_B) }));
            await flush(); await vi.advanceTimersByTimeAsync(100); await flush();
            const live = firebaseState.db && firebaseState.db.app && firebaseState.db.app.options;
            expect({ scope: loginBackendScope(), live: live && live.databaseURL }).toEqual({ scope: 'fb:https://shop-b.firebaseio.com', live: SHOP_B.databaseURL });
        } finally { stop(); }
    });

    it('④ control ៖ an event carrying the Config this tab already runs ➜ no re-initialization', async () => {
        const f = fakeFirebase();
        (window as any).firebaseSDK = f.raw; (window as any).loadFirebaseSDK = () => {};
        const sdk = attach(f, SHOP_A);
        const stop = setupConnectionRecovery();
        try {
            window.dispatchEvent(new StorageEvent('storage', { key: 'zoew_firebase_config', newValue: JSON.stringify(SHOP_A) }));
            await flush(); await vi.advanceTimersByTimeAsync(100); await flush();
            expect({ same: firebaseState.fb === sdk, initializing: firebaseState.isInitializingFirebase }).toEqual({ same: true, initializing: false });
        } finally { stop(); }
    });

    it('⑤ the SDK cannot load (phase unavailable) ➜ the navbar never says online, even beside a stale connected flag', async () => {
        const f = fakeFirebase();
        attach(f, SHOP_A);
        firebaseState.auth.currentUser = { uid: 'A' };
        firebaseState.isDatabaseInitialized = true;
        renderConnectionStatus();
        expect(viewState.connectionStatus, 'control ៖ ready ➜ online').toBe('online');
        firebaseState.firebaseSdkUnavailable = true;
        renderConnectionStatus();
        expect({ phase: viewState.connectionPhase, status: viewState.connectionStatus }).toEqual({ phase: 'unavailable', status: 'offline' });
        firebaseState.firebaseSdkUnavailable = false;
    });
});
