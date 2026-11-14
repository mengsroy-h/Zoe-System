import { webcrypto } from 'node:crypto';
import { afterEach, expect, it, vi } from 'vitest';

vi.mock('../../../../ZoeW/src/features/license', async original => ({ ...await original<any>(), proceedAfterLogin: vi.fn(async () => false) }));

const disk = new Map<string, any>();
let refuseRemoval = false;
class RecoveryPersistence {
    type = 'LOCAL';
    _shouldAllowMigration = false;
    async _isAvailable() { return true; }
    async _get(key: string) { return disk.has(key) ? structuredClone(disk.get(key)) : null; }
    async _set(key: string, value: any) { disk.set(key, structuredClone(value)); }
    async _remove(key: string) {
        if (refuseRemoval && key.includes('authUser')) throw new Error('Synthetic persistence removal refused');
        disk.delete(key);
    }
    _addListener() {}
    _removeListener() {}
}
const uid = 'native-recovery-user';
const config = { apiKey: 'synthetic-native-recovery-key', projectId: 'native-recovery-probe', authDomain: 'native-recovery.invalid', databaseURL: 'https://native-recovery.firebaseio.com' };
const appName = 'native-recovery-probe';
const dayPath = 'zoew_daily_revenue_cod_dod/day';
const turn = async () => { for (let n = 0; n < 100; n++) await Promise.resolve(); };
const records = () => Object.fromEntries(Object.keys(localStorage).filter(key => key.startsWith('zoew_connection_writes_v1:')).map(key => [key, localStorage.getItem(key)!]));
const cleanups: (() => Promise<any> | void)[] = [];
afterEach(async () => {
    refuseRemoval = false;
    for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
    vi.unstubAllGlobals(); vi.restoreAllMocks();
});

it('actual Firebase Auth reload holds the production native journal until owned login and recovery admit its original operation once', async () => {
    vi.stubGlobal('crypto', webcrypto);
    localStorage.clear(); sessionStorage.clear(); disk.clear();
    const server: Record<string, any> = {};
    const nativeReads: string[] = [];
    let loginRequests = 0;
    const token = () => {
        const now = Math.floor(Date.now() / 1000);
        return btoa(JSON.stringify({ alg: 'none' })) + '.' + btoa(JSON.stringify({ sub: uid, user_id: uid, aud: config.projectId,
            iss: 'https://securetoken.google.com/' + config.projectId, iat: now, exp: now + 3600, auth_time: now })) + '.synthetic';
    };
    vi.stubGlobal('fetch', async (input: any) => {
        const url = String(input);
        if (url.includes('signInWithPassword')) {
            loginRequests++;
            return Response.json({ localId: uid, idToken: token(), refreshToken: 'synthetic-refresh', expiresIn: '3600' });
        }
        if (url.includes('accounts:lookup')) return Response.json({ users: [{ localId: uid, email: 'native@example.invalid', emailVerified: false }] });
        if (url.startsWith(config.databaseURL + '/')) {
            const path = decodeURIComponent(new URL(url).pathname.slice(1).replace(/\.json$/, ''));
            nativeReads.push(path);
            return Response.json(server[path] ?? null);
        }
        throw new Error('Unexpected synthetic endpoint');
    });
    let apps = await import('firebase/app');
    let native = await import('firebase/auth');
    let app = apps.initializeApp(config, appName);
    let auth = native.initializeAuth(app, { persistence: RecoveryPersistence as any });
    await auth.authStateReady();
    native.connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    await native.signInWithEmailAndPassword(auth, 'native@example.invalid', 'synthetic-password');
    expect(auth.currentUser?.uid).toBe(uid);
    let releaseOld!: () => void;
    const oldReply = new Promise<void>(resolve => { releaseOld = resolve; });
    cleanups.push(() => releaseOld());
    async function bindSdk(hold: boolean) {
        const db = { app };
        const writes: Record<string, any>[] = [];
        const raw = { ...native, browserLocalPersistence: RecoveryPersistence, browserSessionPersistence: RecoveryPersistence,
            getDatabase: () => db, ref: (_db: any, path = '') => ({ path, toString: () => config.databaseURL + '/' + path }),
            get: vi.fn(async () => ({ val: () => null })),
            update: vi.fn(async (_ref: any, values: Record<string, any>) => {
                writes.push(structuredClone(values));
                if (hold) return oldReply;
                Object.assign(server, structuredClone(values));
            }), runTransaction: vi.fn(), deleteApp: apps.deleteApp };
        const { withTransactionOutcomeResolution } = await import('../../../../ZoeW/src/services/tx-outcome');
        const sdk = withTransactionOutcomeResolution(raw);
        sdk.getAuth(app); sdk.getDatabase(app);
        const { firebaseState } = await import('../../../../ZoeW/src/core/state');
        const { appLocalStore } = await import('../../../../ZoeW/src/core/storage');
        appLocalStore.setItem('zoew_firebase_config', JSON.stringify(config));
        Object.assign(firebaseState, { fb: sdk, db, auth, firebaseConfig: config, authLoginOperation: null,
            isInitializingFirebase: false, firebaseSdkUnavailable: false, sessionExpiryCheck: 'live',
            isDatabaseConnected: true, isDatabaseInitialized: true, dbListenersFailed: false });
        const { acceptServerClockOffset, resetServerClock } = await import('../../../../ZoeW/src/core/clock');
        resetServerClock();
        expect(acceptServerClockOffset(0, { epochMs: Date.now(), wallMs: Date.now(), monotonicMs: performance.now() }, false)).toBe(true);
        return { sdk, raw, db, writes, state: firebaseState };
    }
    const first = await bindSdk(true);
    const firstAuth = await import('../../../../ZoeW/src/features/auth');
    firstAuth.setupAuthListener();
    await vi.waitFor(() => expect(first.state.sessionExpiryCheck).toBe('live'));
    const pending = first.sdk.set(first.sdk.ref(first.db, dayPath), { codDollar: 10, totalCount: 1 });
    pending.catch(() => {});
    await vi.waitFor(() => expect(first.writes).toHaveLength(1));
    const journalBefore = records();
    expect(Object.keys(journalBefore)).toHaveLength(1);
    const original = JSON.parse(Object.values(journalBefore)[0]);
    expect(original.ops).toEqual([{ k: 'set', p: dayPath.split('/'), v: { codDollar: 10, totalCount: 1 } }]);
    expect(first.writes[0]['zoew_write_receipts/' + original.opId].hash).toBe(original.hash);
    refuseRemoval = true;
    await firstAuth.logoutApp();
    expect([...disk.entries()].some(([key, value]) => key.includes('authUser') && value.uid === uid)).toBe(true);
    first.state.authUnsubscribe?.(); first.state.authUnsubscribe = null;
    await first.sdk.deleteApp(app);
    refuseRemoval = false;
    vi.resetModules();
    apps = await import('firebase/app'); native = await import('firebase/auth');
    app = apps.initializeApp(config, appName);
    auth = native.initializeAuth(app, { persistence: RecoveryPersistence as any });
    cleanups.push(async () => { await apps.deleteApp(app); });
    await auth.authStateReady();
    expect(auth.currentUser?.uid).toBe(uid);
    nativeReads.length = 0;
    const restored = await bindSdk(false);
    const { setupAuthListener, performLogin } = await import('../../../../ZoeW/src/features/auth');
    setupAuthListener();
    cleanups.push(() => { restored.state.authUnsubscribe?.(); restored.state.authUnsubscribe = null; });
    await vi.waitFor(() => expect(restored.state.sessionExpiryCheck).toBe('signed-out'));
    const blockedRetry = restored.sdk.retryWriteRecovery(restored.db);
    const { nativeWriteRecoveryState } = await import('../../../../ZoeW/src/services/native-write-recovery');
    await vi.waitFor(() => expect(nativeWriteRecoveryState(restored.db).recovering).toBe(false));
    await turn();
    expect(records()).toEqual(journalBefore);
    expect(restored.raw.update).not.toHaveBeenCalled();
    expect(restored.raw.runTransaction).not.toHaveBeenCalled();
    expect(restored.raw.get).not.toHaveBeenCalled();
    expect(nativeReads).toEqual([]);
    expect(server).toEqual({});
    await blockedRetry;
    await performLogin('native@example.invalid', 'synthetic-password', false, false);
    await vi.waitFor(() => expect(restored.state.sessionExpiryCheck).toBe('live'));
    await restored.sdk.retryWriteRecovery(restored.db);
    await vi.waitFor(() => expect(Object.keys(records())).toHaveLength(0));
    expect(restored.writes.filter(values => dayPath in values)).toHaveLength(1);
    expect(restored.writes[0]['zoew_write_receipts/' + original.opId].hash).toBe(original.hash);
    expect(server[dayPath]).toEqual({ codDollar: 10, totalCount: 1 });
    await restored.sdk.retryWriteRecovery(restored.db); await turn();
    expect(restored.writes.filter(values => dayPath in values)).toHaveLength(1);
    expect(loginRequests).toBe(2);
    releaseOld(); await pending;
});
