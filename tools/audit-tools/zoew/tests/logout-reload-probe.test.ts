import { afterEach, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const Buffer = require('node:buffer').Buffer;

vi.mock('../../../../ZoeW/src/features/license', async original => ({
    ...await original<any>(), proceedAfterLogin: vi.fn(async () => false)
}));

const disk = new Map<string, any>();
let refuseRemoval = false;
class SyntheticPersistence {
    type = 'LOCAL';
    _shouldAllowMigration = false;
    async _isAvailable() { return true; }
    async _get(key: string) { return disk.has(key) ? structuredClone(disk.get(key)) : null; }
    async _set(key: string, value: any) { disk.set(key, structuredClone(value)); }
    async _remove(key: string) {
        if (refuseRemoval && key.includes('authUser')) throw new Error('Synthetic persistence transaction rejected');
        disk.delete(key);
    }
    _addListener() {}
    _removeListener() {}
}
let loginRequests = 0;
let lookupRequests = 0;
const uid = 'synthetic-restored-user';
const config = { apiKey: 'synthetic-audit-key', projectId: 'audit-logout-reload', authDomain: 'audit-logout-reload.invalid',
    databaseURL: 'https://audit-logout-reload.firebaseio.com' };
const appName = 'audit-logout-reload';
const turn = async () => { for (let i = 0; i < 50; i++) await Promise.resolve(); };
function token() {
    const now = Math.floor(Date.now() / 1000);
    return Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url') + '.'
        + Buffer.from(JSON.stringify({ sub: uid, user_id: uid, aud: config.projectId, iss: 'https://securetoken.google.com/' + config.projectId,
            iat: now, exp: now + 3600, auth_time: now })).toString('base64url') + '.synthetic-signature';
}
let cleanup: (() => Promise<void>) | null = null;
afterEach(async () => { if (cleanup) await cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it('Firebase Auth ពិត៖ persistence បរាជ័យរក្សា local logout ពេលបើក App ឡើងវិញ', async () => {
    vi.stubGlobal('fetch', async (url: any) => {
        if (String(url).includes('signInWithPassword')) {
            loginRequests++;
            return new Response(JSON.stringify({ localId: uid, idToken: token(), refreshToken: 'synthetic-refresh', expiresIn: '3600' }), { status: 200 });
        }
        if (String(url).includes('accounts:lookup')) {
            lookupRequests++;
            return new Response(JSON.stringify({ users: [{ localId: uid, email: 'synthetic@example.invalid', emailVerified: false }] }), { status: 200 });
        }
        throw new Error('Unexpected synthetic Firebase Auth endpoint');
    });
    let apps = await import('firebase/app');
    let native = await import('firebase/auth');
    let app = apps.initializeApp(config, appName);
    let auth = native.initializeAuth(app, { persistence: SyntheticPersistence as any });
    await auth.authStateReady();
    native.connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    await native.signInWithEmailAndPassword(auth, 'synthetic@example.invalid', 'synthetic-password');
    expect(auth.currentUser?.uid).toBe(uid);
    await apps.deleteApp(app);
    app = apps.initializeApp(config, appName);
    auth = native.initializeAuth(app, { persistence: SyntheticPersistence as any });
    await auth.authStateReady();
    expect(auth.currentUser?.uid).toBe(uid);
    const state = (await import('../../../../ZoeW/src/core/state')).firebaseState;
    const firstAuth = await import('../../../../ZoeW/src/features/auth');
    const { logoutApp } = firstAuth;
    Object.assign(state, { auth, fb: native, db: {}, firebaseConfig: config,
        isInitializingFirebase: false, authLoginOperation: null, isDatabaseConnected: true, isDatabaseInitialized: true, dbListenersFailed: false });
    const firstClock = await import('../../../../ZoeW/src/core/clock');
    expect(firstClock.acceptServerClockOffset(0, Object.freeze({ source: 'nonce', generation: 1, monotonicMs: performance.now(),
        wallMs: Date.now(), epochMs: Date.now(), uncertaintyMs: 0 }), true)).toBe(true);
    firstAuth.setupAuthListener(); await turn();
    expect(state.sessionExpiryCheck).toBe('live');
    const firstLicense = await import('../../../../ZoeW/src/features/license');
    expect(firstLicense.proceedAfterLogin).toHaveBeenCalledOnce();
    expect((await import('../../../../ZoeW/src/services/connection-flow')).connectionFlowSnapshot().canWrite).toBe(true);
    vi.mocked(firstLicense.proceedAfterLogin).mockClear();
    refuseRemoval = true;
    await logoutApp();
    const samePageState = state.sessionExpiryCheck;
    const persistedAfterFailure = [...disk.entries()].some(([key, value]) => key.includes('authUser') && value.uid === uid);
    expect(samePageState).toBe('signed-out');
    expect(persistedAfterFailure).toBe(true);
    expect(auth.currentUser).toBeNull();
    state.authUnsubscribe?.();
    await apps.deleteApp(app);
    refuseRemoval = false;
    vi.resetModules();
    apps = await import('firebase/app'); native = await import('firebase/auth');
    app = apps.initializeApp(config, appName);
    auth = native.initializeAuth(app, { persistence: SyntheticPersistence as any });
    cleanup = () => apps.deleteApp(app);
    await auth.authStateReady();
    expect(auth.currentUser?.uid).toBe(uid);
    const reloaded = (await import('../../../../ZoeW/src/core/state')).firebaseState;
    const { setupAuthListener } = await import('../../../../ZoeW/src/features/auth');
    const { connectionFlowSnapshot } = await import('../../../../ZoeW/src/services/connection-flow');
    const { acceptServerClockOffset } = await import('../../../../ZoeW/src/core/clock');
    const { proceedAfterLogin } = await import('../../../../ZoeW/src/features/license');
    const defaultState = reloaded.sessionExpiryCheck;
    Object.assign(reloaded, { auth, fb: native, db: {}, firebaseConfig: config, isInitializingFirebase: false,
        isDatabaseConnected: true, isDatabaseInitialized: true, dbListenersFailed: false });
    expect(acceptServerClockOffset(0, Object.freeze({ source: 'nonce', generation: 1, monotonicMs: performance.now(),
        wallMs: Date.now(), epochMs: Date.now(), uncertaintyMs: 0 }), true)).toBe(true);
    setupAuthListener(); await turn();
    const evidence = { sdk: 'Firebase Auth 12.19.0', samePageState, persistedAfterFailure, sdkUserAfterFailedLogout: null,
        restoredUid: auth.currentUser?.uid ?? null, defaultState, stateAfterAuthListener: reloaded.sessionExpiryCheck,
        loginRequests, automaticallyProceeded: vi.mocked(proceedAfterLogin).mock.calls.length,
        canWriteAfterReload: connectionFlowSnapshot().canWrite };
    fs.writeFileSync(process.env.PROBE_EVIDENCE_PATH || '/tmp/zoe-logout-reload-probe-evidence.json', JSON.stringify(evidence, null, 2));
    expect(evidence.canWriteAfterReload).toBe(false);
    expect(evidence.automaticallyProceeded).toBe(0);
    expect(lookupRequests).toBeGreaterThanOrEqual(2);
    const { performLogin } = await import('../../../../ZoeW/src/features/auth');
    await performLogin('synthetic@example.invalid', 'synthetic-password', true, false);
    await turn();
    expect(loginRequests).toBe(2);
    expect(reloaded.sessionExpiryCheck).toBe('live');
    expect(connectionFlowSnapshot().canWrite).toBe(true);
    const { localLogoutIntent } = await import('../../../../ZoeW/src/services/local-logout-intent');
    expect(localLogoutIntent.blocked('fb:' + config.databaseURL, uid)).toBe(false);
    reloaded.authUnsubscribe?.();
});
