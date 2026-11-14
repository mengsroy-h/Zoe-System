import { afterEach, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { parse } from 'acorn';
import { Buffer } from 'node:buffer';
import { webcrypto } from 'node:crypto';
import ts from 'typescript';
import { createRequire } from 'node:module';

const ROOT = process.env.KEYGEN_LOGOUT_SOURCE_ROOT || path.resolve(__dirname, '../../../..');
const source = fs.readFileSync(ROOT + '/ZoeKeyGen/app.js', 'utf8');
const declarations = new Map<string, string>();
for (const node of parse(source, { ecmaVersion: 'latest' }).body as any[]) {
    if (node.type === 'FunctionDeclaration') declarations.set(node.id.name, source.slice(node.start, node.end));
    if (node.type === 'VariableDeclaration') for (const d of node.declarations) {
        if (d.id.type === 'Identifier') declarations.set(d.id.name, source.slice(node.start, node.end));
    }
}
const disk = new Map<string, any>();
let refuseRemoval = false;
class SyntheticPersistence {
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
function store() {
    const values = new Map<string, string>();
    return { get length() { return values.size; }, key: (index: number) => [...values.keys()][index] ?? null,
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, String(value)), removeItem: (key: string) => values.delete(key) };
}
const uid = 'synthetic-keygen-admin';
const config = { apiKey: 'synthetic-keygen-logout-api', projectId: 'audit-keygen-logout', authDomain: 'audit-keygen-logout.invalid',
    databaseURL: 'https://audit-keygen-logout.firebaseio.com' };
const turn = async () => { for (let i = 0; i < 60; i++) await Promise.resolve(); };
function token() {
    const now = Math.floor(Date.now() / 1000);
    return Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url') + '.' + Buffer.from(JSON.stringify({
        sub: uid, user_id: uid, aud: config.projectId, iss: 'https://securetoken.google.com/' + config.projectId,
        iat: now, exp: now + 3600, auth_time: now
    })).toString('base64url') + '.synthetic-signature';
}
let cleanup: (() => Promise<void>) | null = null;
afterEach(async () => { if (cleanup) await cleanup(); cleanup = null; disk.clear(); refuseRemoval = false; vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

function page(auth: any, sdk: any, local: any, session: any, roleRead?: () => Promise<string>) {
    const calls = { roles: [] as string[], toasts: [] as string[], login: 0, signedIn: false };
    const elements: Record<string, any> = {
        loginEmailInput: { value: 'synthetic-admin@example.invalid' }, loginPasswordInput: { value: 'synthetic-password' },
        rememberMeCheckbox: { checked: false }, loginBtn: { disabled: false, textContent: 'ចូលប្រព័ន្ធ' }
    };
    const events = new Map<string, Set<(event: any) => void>>();
    elements.appContainer = { classList: { add() {}, remove() {} } };
    const ctx = vm.createContext({ console, Promise, Map, Date, crypto: webcrypto, setTimeout, clearTimeout,
        document: { hidden: false, addEventListener() {}, removeEventListener() {}, getElementById: (id: string) => elements[id] },
        window: { addEventListener: (key: string, fn: any) => { if (!events.has(key)) events.set(key, new Set()); events.get(key)!.add(fn); },
            removeEventListener: (key: string, fn: any) => events.get(key)?.delete(fn) },
        auth, fb: sdk, authGeneration: 7, authRecoveryTimeout: null, authUnsubscribe: null,
        pendingRoleRecheck: false, keygenLoginOwner: null, sensitiveSessionGeneration: 3, isInitializingFirebase: false, firebaseSdkUnavailable: false,
        appLocalStore: local, appSessionStore: session, safeStoreGet: (s: any, key: string) => s.getItem(key),
        safeStoreSet: (s: any, key: string, value: string) => { s.setItem(key, value); return true; },
        hasUncopiedKeypair: () => false, confirm: () => true,
        showLoginModalWithPrefill: () => { calls.login++; calls.signedIn = false; ctx.keygenLoginOwner = null; ctx.isSignedInUiActive = false; },
        verifyAdminRoleThenProceed: (user: any) => { calls.roles.push(user.uid); calls.signedIn = true; ctx.isSignedInUiActive = true; },
        updateAuthButton: (value: boolean) => { calls.signedIn = value; }, showToast: (value: string) => calls.toasts.push(value), alert() {},
        readUserRole: roleRead, closeModal() {}, isSignedInUiActive: false, showLiveToast() {},
        requestSessionSigningKeyRestoreIfEligible() {}, refreshKeyList() {}, refreshNoticeList() {}
    });
    const names = ['LOCAL_LOGOUT_INTENT_PREFIX', 'createLocalLogoutIntentStore', 'localLogoutIntent', 'acceptedLogoutIntents', 'initialAuthLogoutIntents', 'captureInitialAuthLogoutIntent', 'keygenLogoutOwner',
        'FIREBASE_CONFIG_KEYS', 'withTimeout', 'keygenAuthScope', 'keygenLoginBackendIsReady', 'enforceSessionOnlyAuthPersistence',
        'keygenSessionIntentCurrent', 'captureSensitiveSession', 'isSensitiveSessionCurrent', 'adminOwnerIsCurrent', 'adminOperationIsCurrent',
        'setupAuthListener', 'logoutApp', 'doLogin'];
    vm.runInContext(names.filter(name => declarations.has(name)).map(name => declarations.get(name)).join('\n'), ctx);
    if (roleRead) vm.runInContext(declarations.get('verifyAdminRoleThenProceed')!, ctx);
    return { ctx, calls, elements, dispose: () => { ctx.authUnsubscribe?.(); }, roles: () => calls.roles.length,
        intent: declarations.has('localLogoutIntent') ? vm.runInContext('localLogoutIntent', ctx) : null, scope: () => ctx.keygenAuthScope(auth),
        storageEvent: (event: any) => { for (const fn of events.get('storage') || []) fn(event); },
        listeners: () => events.get('storage')?.size || 0 };
}

function fake(signOut: (auth: any) => Promise<void> = async () => { throw new Error('Synthetic refusal'); }, roleRead?: () => Promise<string>) {
    const local = store(), session = store(); local.setItem('zoew_firebase_config', JSON.stringify(config));
    const user = { uid }, auth = { app: { options: config }, currentUser: user as any };
    let callback: (user: any) => void = () => {};
    const sdk = { browserSessionPersistence: {}, setPersistence: async () => {}, signOut,
        onAuthStateChanged: (_auth: any, fn: any) => { callback = fn; return () => {}; },
        signInWithEmailAndPassword: async () => { auth.currentUser = user; callback(user); return { user }; } };
    const p = page(auth, sdk, local, session, roleRead);
    return { ...p, local, session, auth, sdk, user, emit: (value = auth.currentUser) => callback(value) };
}

it('KeyGen និង ZoeW ប្រើ factory intent ឥរិយាបថដូចគ្នា ដោយបំបែក prefix តាម App', () => {
    const canonical = fs.readFileSync(ROOT + '/ZoeW/src/services/local-logout-intent.ts', 'utf8');
    const tree = ts.createSourceFile('local-logout-intent.ts', canonical, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const node = tree.statements.find((statement): statement is ts.FunctionDeclaration => ts.isFunctionDeclaration(statement) && statement.name?.text === 'createLocalLogoutIntentStore')!;
    const start = node.getChildren(tree).find(child => child.kind === ts.SyntaxKind.FunctionKeyword)!.getStart(tree);
    expect(declarations.get('createLocalLogoutIntentStore')).toBe(canonical.slice(start, node.end));
    expect(declarations.get('LOCAL_LOGOUT_INTENT_PREFIX')).toContain('zoekeygen_local_logout_v1:');
});

it('KeyGen ៖ signOut throw/resolve មិនត្រូវអះអាង success បើ SDK user នៅសល់; explicit login ជាអ្នកដោះ intent', async () => {
    for (const behavior of ['reject', 'unconfirmed', 'confirmed']) {
        const f = fake(async auth => {
            if (behavior === 'reject') throw new Error('Synthetic failure');
            if (behavior === 'confirmed') auth.currentUser = null;
        });
        await f.ctx.logoutApp();
        expect(f.intent.blocked(f.scope(), uid)).toBe(true);
        expect(f.calls.toasts.some(t => t.startsWith('✅'))).toBe(behavior === 'confirmed');
        f.ctx.setupAuthListener(); f.emit(f.auth.currentUser); await turn();
        expect(f.roles()).toBe(0);
        await f.ctx.doLogin(); await turn();
        expect(f.intent.blocked(f.scope(), uid)).toBe(false);
        expect(f.roles()).toBe(1);
        f.dispose();
    }
});

it('KeyGen ៖ signOut ដែលព្យួរមានពិដាន ហើយ storage បរាជ័យមិនអះអាង logout ដែលអាចរក្សាបាន', async () => {
    vi.useFakeTimers();
    const f = fake(() => new Promise(() => {}));
    f.local.setItem = () => { throw new Error('Synthetic quota'); };
    f.session.setItem = () => { throw new Error('Synthetic quota'); };
    let finished = false;
    const work = f.ctx.logoutApp().then(() => { finished = true; });
    await turn(); expect(f.calls.login).toBe(1); expect(finished).toBe(false);
    await vi.advanceTimersByTimeAsync(15001); await work;
    expect(finished).toBe(true); expect(f.intent.blocked(f.scope(), uid)).toBe(true);
    expect(f.calls.toasts.some(t => t.includes('Storage') && t.includes('Refresh'))).toBe(true);
    expect(f.calls.toasts.some(t => t.startsWith('✅'))).toBe(false);
});

it('KeyGen ៖ sessionStorage តែឯងមិនអះអាងសុវត្ថិភាពក្រោយបិទ tab ឬបើក tab ថ្មី', async () => {
    const f = fake();
    f.local.setItem = () => { throw new Error('Synthetic persistent storage quota'); };
    await f.ctx.logoutApp();
    expect(f.intent.blocked(f.scope(), uid)).toBe(true);
    expect(f.calls.toasts.some(t => t.includes('Storage') && t.includes('tab ថ្មី'))).toBe(true);
    expect(f.calls.toasts.some(t => t.startsWith('✅'))).toBe(false);
});

it('KeyGen ៖ logout ថ្មីកើតកណ្ដាល credential login មិនត្រូវបាន ack ដោយ response ចាស់', async () => {
    const f = fake(); await f.ctx.logoutApp();
    let release!: () => void;
    f.sdk.signInWithEmailAndPassword = async () => { await new Promise<void>(resolve => { release = resolve; }); return { user: f.user }; };
    const work = f.ctx.doLogin(); await turn();
    expect(release).toBeTypeOf('function');
    f.intent.note(f.scope(), uid); release(); await work;
    expect(f.intent.blocked(f.scope(), uid)).toBe(true); expect(f.roles()).toBe(0);
});

it.each(['config', 'uid', 'logout-and-ack'])('KeyGen ៖ role response ចាស់ក្រោយ %s មិនបើក Admin ឡើងវិញ', async change => {
    let release!: (role: string) => void;
    const f = fake(undefined, () => new Promise<string>(resolve => { release = resolve; }));
    const work = f.ctx.verifyAdminRoleThenProceed(f.user, f.ctx.authGeneration); await turn();
    if (change === 'config') f.local.setItem('zoew_firebase_config', JSON.stringify({ ...config, projectId: 'replacement' }));
    if (change === 'uid') f.auth.currentUser = { uid: 'replacement' };
    if (change === 'logout-and-ack') {
        f.intent.note(f.scope(), uid);
        expect(f.intent.acknowledge(f.scope(), uid, f.intent.capture(f.scope()))).toBe(true);
    }
    release('admin'); await work;
    expect(f.calls.signedIn).toBe(false);
});

it('KeyGen ៖ storage event មិនឆ្លង scope/UID ហើយ listener ចេញតាម auth unsubscribe', async () => {
    const f = fake(); f.ctx.setupAuthListener();
    expect(f.listeners()).toBe(1);
    f.storageEvent({ key: 'zoekeygen_local_logout_v1:"other":"uid"', oldValue: null, newValue: 'new', storageArea: f.local });
    expect(f.calls.login).toBe(0);
    f.intent.note(f.scope(), uid);
    const key = [...Array(f.local.length)].map((_, i) => f.local.key(i)).find(key => key?.startsWith('zoekeygen_local_logout_v1:'));
    f.storageEvent({ key, oldValue: null, newValue: f.local.getItem(key!), storageArea: f.local });
    expect(f.calls.login).toBe(1); expect(f.calls.signedIn).toBe(false);
    f.dispose(); expect(f.listeners()).toBe(0);
});

it('KeyGen ៖ foreign logout+ack មិនដោះ tab ចាស់; explicit login ដើមមិនត្រូវបិទដោយ storage event យឺត', async () => {
    const f = fake(); f.ctx.setupAuthListener(); f.emit(); await turn();
    expect(f.roles()).toBe(1);
    const other = f.ctx.createLocalLogoutIntentStore(f.local, store());
    other.note(f.scope(), uid);
    expect(other.acknowledge(f.scope(), uid, other.capture(f.scope()))).toBe(true);
    const key = [...Array(f.local.length)].map((_, i) => f.local.key(i)).find(key => key?.startsWith('zoekeygen_local_logout_v1:') && !key.endsWith(':ack'))!;
    const event = { key, oldValue: null, newValue: f.local.getItem(key), storageArea: f.local };
    f.storageEvent(event); f.emit(); await turn();
    expect(f.calls.signedIn).toBe(false); expect(f.roles()).toBe(1);
    await f.ctx.doLogin(); await turn();
    expect(f.roles()).toBe(2); expect(f.calls.signedIn).toBe(true);
    const hidden = f.calls.login;
    f.storageEvent(event);
    expect(f.calls.login).toBe(hidden); expect(f.calls.signedIn).toBe(true);
    f.dispose();
});

for (const changed of ['logout', 'logout-and-ack']) it.each(['sensitive', 'owner', 'operation'])(`KeyGen ៖ ${changed} មុន storage event បិទ new និង %s lease ចាស់`, async guard => {
    const f = fake(); await f.ctx.doLogin();
    const operation = f.ctx.captureSensitiveSession(true);
    expect(operation).toBeTruthy();
    const current = () => guard === 'sensitive' ? f.ctx.isSensitiveSessionCurrent(operation, true)
        : guard === 'owner' ? f.ctx.adminOwnerIsCurrent(operation) : f.ctx.adminOperationIsCurrent(operation);
    expect(current()).toBe(true);
    const other = f.ctx.createLocalLogoutIntentStore(f.local, store());
    other.note(f.scope(), uid);
    if (changed === 'logout-and-ack') expect(other.acknowledge(f.scope(), uid, other.capture(f.scope()))).toBe(true);
    expect(f.ctx.captureSensitiveSession(true)).toBeNull();
    expect(current()).toBe(false);
});

it('KeyGen ៖ Config ប្រែមុន Auth/backend ចាស់ដកចេញ មិនទទួលសកម្មភាព Admin ចាស់ ឬថ្មី', async () => {
    const f = fake(); await f.ctx.doLogin();
    const operation = f.ctx.captureSensitiveSession(true);
    expect(f.ctx.adminOperationIsCurrent(operation)).toBe(true);
    f.local.setItem('zoew_firebase_config', JSON.stringify({ ...config, projectId: 'replacement' }));
    expect(f.ctx.captureSensitiveSession(true)).toBeNull();
    expect(f.ctx.adminOperationIsCurrent(operation)).toBe(false);
});

it('KeyGen ៖ Firebase SDK persistence._remove បរាជ័យ → reload មិនអាចបើក Admin ឡើងវិញដោយខ្លួនឯង', async () => {
    const local = store(), session = store(); local.setItem('zoew_firebase_config', JSON.stringify(config));
    let loginRequests = 0;
    vi.stubGlobal('fetch', async (url: any) => {
        if (String(url).includes('signInWithPassword')) {
            loginRequests++;
            return new Response(JSON.stringify({ localId: uid, idToken: token(), refreshToken: 'synthetic-refresh', expiresIn: '3600' }));
        }
        return new Response(JSON.stringify({ users: [{ localId: uid, email: 'synthetic-admin@example.invalid', emailVerified: false }] }));
    });
    let apps = await import('firebase/app'), native = await import('firebase/auth');
    let app = apps.initializeApp(config, 'audit-keygen-logout');
    let auth = native.initializeAuth(app, { persistence: SyntheticPersistence as any });
    await auth.authStateReady(); native.connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    await native.signInWithEmailAndPassword(auth, 'synthetic-admin@example.invalid', 'synthetic-password');
    expect(auth.currentUser?.uid).toBe(uid);
    const old = page(auth, native, local, session);
    refuseRemoval = true;
    await old.ctx.logoutApp(); await turn();
    expect(old.calls.signedIn).toBe(false);
    expect([...disk.entries()].some(([key, value]) => key.includes('authUser') && value.uid === uid)).toBe(true);
    expect(auth.currentUser).toBeNull();
    old.dispose(); await apps.deleteApp(app);
    refuseRemoval = false; vi.resetModules();
    apps = await import('firebase/app'); native = await import('firebase/auth');
    app = apps.initializeApp(config, 'audit-keygen-logout');
    auth = native.initializeAuth(app, { persistence: SyntheticPersistence as any });
    let fresh: ReturnType<typeof page> | null = null;
    cleanup = async () => { fresh?.dispose(); await apps.deleteApp(app); };
    await auth.authStateReady(); expect(auth.currentUser?.uid).toBe(uid);
    fresh = page(auth, native, local, session);
    fresh.ctx.setupAuthListener(); await turn();
    const evidence = { sdk: 'Firebase Auth 12.19.0', persistedAfterFailedSignOut: true, restoredUid: auth.currentUser?.uid,
        automaticAdminRoleChecks: fresh.roles(), signedIn: fresh.calls.signedIn, loginRequests };
    fs.writeFileSync(process.env.KEYGEN_LOGOUT_EVIDENCE || '/tmp/keygen-logout-reload-evidence.json', JSON.stringify(evidence, null, 2));
    expect(fresh.roles()).toBe(0); expect(fresh.calls.signedIn).toBe(false);
    await fresh.ctx.doLogin(); await turn();
    expect(loginRequests).toBe(2); expect(fresh.roles()).toBe(1); expect(fresh.calls.signedIn).toBe(true);
});

it('KeyGen credential ACK cannot adopt a foreign logout acknowledged immediately after its own ACK', async () => {
    const f = fake();
    f.ctx.setupAuthListener();
    const other = f.ctx.createLocalLogoutIntentStore(f.local, f.session);
    f.intent.note(f.scope(), uid);
    f.ctx.__foreignCredentialBoundary = () => {
        expect(other.note(f.scope(), uid)).toBe(true);
        expect(other.acknowledge(f.scope(), uid, other.capture(f.scope()))).toBe(true);
    };
    vm.runInContext(`const originalCredentialAcknowledge = localLogoutIntent.acknowledge.bind(localLogoutIntent);
        localLogoutIntent.acknowledge = (...args) => {
            const result = originalCredentialAcknowledge(...args);
            if (result) __foreignCredentialBoundary();
            return result;
        };`, f.ctx);
    await f.ctx.doLogin(); await turn();
    expect(f.roles()).toBe(0);
    expect(f.calls.signedIn).toBe(false);
    expect(f.intent.blocked(f.scope(), uid)).toBe(true);
    f.emit(); await turn();
    expect(f.roles()).toBe(0);
    expect(f.calls.signedIn).toBe(false);
    f.dispose();
});


it('KeyGen initial callback registered before foreign logout/ACK cannot open admin from its old SDK user', async () => {
    const f = fake(undefined, async () => 'admin');
    f.ctx.setupAuthListener();
    const other = vm.runInContext('createLocalLogoutIntentStore', f.ctx)(f.local, store());
    expect(other.note(f.scope(), uid)).toBe(true);
    expect(other.acknowledge(f.scope(), uid, other.capture(f.scope()))).toBe(true);
    f.emit(); await turn();
    expect(f.calls.signedIn).toBe(false); expect(f.ctx.isSignedInUiActive).toBe(false);
    expect(f.intent.blocked(f.scope(), uid)).toBe(true);
    f.dispose();
});

it('KeyGen initial null callback consumes startup proof before a later legitimate SDK signin', async () => {
    const f = fake(undefined, async () => 'admin');
    f.auth.currentUser = null; f.ctx.setupAuthListener(); f.emit(null); await turn();
    const other = vm.runInContext('createLocalLogoutIntentStore', f.ctx)(f.local, store());
    expect(other.note(f.scope(), uid)).toBe(true);
    expect(other.acknowledge(f.scope(), uid, other.capture(f.scope()))).toBe(true);
    f.auth.currentUser = f.user; f.emit(); await turn();
    expect(f.calls.signedIn).toBe(true); expect(f.ctx.isSignedInUiActive).toBe(true);
    f.dispose();
});

it('KeyGen owned credential login supersedes the startup proof while its initial callback is pending', async () => {
    const f = fake(undefined, async () => 'admin');
    f.ctx.setupAuthListener();
    const other = vm.runInContext('createLocalLogoutIntentStore', f.ctx)(f.local, store());
    expect(other.note(f.scope(), uid)).toBe(true);
    expect(other.acknowledge(f.scope(), uid, other.capture(f.scope()))).toBe(true);
    await f.ctx.doLogin(); await turn(); f.emit(); await turn();
    expect(f.calls.signedIn).toBe(true); expect(f.ctx.isSignedInUiActive).toBe(true);
    expect(f.intent.blocked(f.scope(), uid)).toBe(false);
    f.dispose();
});


it.each([false, true])('KeyGen actual initFirebase fences old restore during native setPersistence; initially unacknowledged=%s', async (initiallyUnacknowledged) => {
    const nativeRequire = createRequire(import.meta.url);
    const apps = nativeRequire(ROOT + '/ZoeW/node_modules/firebase/app');
    const native = nativeRequire(ROOT + '/ZoeW/node_modules/@firebase/auth/dist/browser-cjs/index.js');
    class SharedPersistence extends SyntheticPersistence {
        key(key: string) { return key.includes('authUser') ? 'shared-initial-auth-user' : key; }
        async _get(key: string) { return disk.has(this.key(key)) ? structuredClone(disk.get(this.key(key))) : null; }
        async _set(key: string, value: any) { disk.set(this.key(key), structuredClone(value)); }
        async _remove(key: string) { disk.delete(this.key(key)); }
    }
    let logins = 0, holdLookup = false, lookupStarted!: () => void, releaseLookup = () => {};
    const lookupEntered = new Promise<void>(resolve => { lookupStarted = resolve; });
    const sessionToken = () => {
        const parts = token().split('.');
        parts[1] = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(parts[1], 'base64url').toString()), syntheticLogin: logins })).toString('base64url');
        return parts.join('.');
    };
    const syntheticFetch = async (input: any) => {
        if (String(input).includes('signInWithPassword')) { logins++; return new Response(JSON.stringify({ localId: uid, idToken: sessionToken(), refreshToken: 'synthetic-refresh-' + logins, expiresIn: '3600' })); }
        if (String(input).includes('accounts:lookup')) {
            if (holdLookup) { holdLookup = false; lookupStarted(); await new Promise<void>(resolve => { releaseLookup = resolve; }); }
            return new Response(JSON.stringify({ users: [{ localId: uid, email: 'synthetic@example.invalid', emailVerified: false }] }));
        }
        throw new Error('Unexpected endpoint blocked by synthetic initial-auth fixture');
    };
    vi.stubGlobal('fetch', syntheticFetch);
    vi.spyOn(window, 'fetch').mockImplementation(syntheticFetch);
    let oldApp: any = null, otherApp: any = null, oldPage: ReturnType<typeof page> | null = null;
    cleanup = async () => { releaseLookup(); oldPage?.dispose(); if (oldApp) await apps.deleteApp(oldApp); if (otherApp) await apps.deleteApp(otherApp); };
    const seedApp = apps.initializeApp(config, 'audit-initial-seed');
    const seedAuth = native.initializeAuth(seedApp, { persistence: SharedPersistence });
    native.connectAuthEmulator(seedAuth, 'http://127.0.0.1:9099', { disableWarnings: true });
    try { await seedAuth.authStateReady(); await native.signInWithEmailAndPassword(seedAuth, 'synthetic@example.invalid', 'synthetic-password'); }
    finally { await apps.deleteApp(seedApp); }
    holdLookup = true; oldApp = apps.initializeApp(config, 'audit-initial-old');
    const oldAuth = native.initializeAuth(oldApp, { persistence: SharedPersistence });
    native.connectAuthEmulator(oldAuth, 'http://127.0.0.1:9099', { disableWarnings: true });
    let getAuthReached!: () => void; const authReached = new Promise<void>(resolve => { getAuthReached = resolve; });
    const sdk = { ...native, browserSessionPersistence: SharedPersistence, getApps: () => [], initializeApp: () => oldApp,
        getAuth: () => { getAuthReached(); return native.getAuth(oldApp); }, getDatabase: () => ({}), goOnline() {}, ref: () => ({}) };
    const local = store(); local.setItem('zoew_firebase_config', JSON.stringify(config));
    let roleReads = 0; oldPage = page(oldAuth, sdk, local, store(), async () => { roleReads++; return 'admin'; });
    const other = vm.runInContext('createLocalLogoutIntentStore', oldPage.ctx)(local, store()), scope = oldPage.scope();
    const noteAtStart = initiallyUnacknowledged ? other.note(scope, uid) : undefined;
    Object.assign(oldPage.ctx, { auth: null, firebaseConfig: null, isDatabaseInitialized: false, sdkUnavailableNoticeShown: false,
        waitForFirebaseSDK: async () => sdk, invalidateSensitiveSession() {}, resetFirebaseSdkRetryHealth() {}, attachInfoListeners() {}, checkPinAndOpenConfig() {} });
    vm.runInContext(declarations.get('initFirebase')!, oldPage.ctx);
    const initializing = oldPage.ctx.initFirebase(); await Promise.all([lookupEntered, authReached]);
    expect(oldPage.ctx.authUnsubscribe).toBeNull(); expect(oldAuth.currentUser).toBeNull();
    otherApp = apps.initializeApp(config, 'audit-initial-other');
    const otherAuth = native.initializeAuth(otherApp, { persistence: SharedPersistence });
    native.connectAuthEmulator(otherAuth, 'http://127.0.0.1:9099', { disableWarnings: true }); await otherAuth.authStateReady();
    expect(noteAtStart ?? other.note(scope, uid)).toBe(true);
    expect(oldPage.intent.capture(scope).ready).toBe(true); await native.signOut(otherAuth);
    await native.signInWithEmailAndPassword(otherAuth, 'synthetic@example.invalid', 'synthetic-password');
    expect(other.acknowledge(scope, uid, other.capture(scope))).toBe(true);
    releaseLookup(); expect(await initializing).toBe(true); await turn();
    expect(logins).toBe(2); expect(oldAuth.currentUser?.uid).toBe(uid);
    expect(roleReads).toBe(0); expect(oldPage.calls.signedIn).toBe(false);
    expect(oldPage.ctx.isSignedInUiActive).toBe(false); expect(oldPage.intent.blocked(scope, uid)).toBe(true);
});


it('KeyGen pending Auth proof never recaptures changed raw Config on the same SDK owner', async () => {
    const f = fake(undefined, async () => 'admin'); f.ctx.setupAuthListener();
    f.local.setItem('zoew_firebase_config', JSON.stringify({ ...config, syntheticChanged: true }));
    f.ctx.setupAuthListener(); f.emit(); await turn();
    expect(f.calls.signedIn).toBe(false); expect(f.ctx.isSignedInUiActive).toBe(false);
    expect(f.intent.blocked(f.scope(), uid)).toBe(true); f.dispose();
});


it('KeyGen initial unacknowledged intent cannot be cleared implicitly by another tab acknowledging the same nonce', async () => {
    const f = fake(undefined, async () => 'admin');
    const other = vm.runInContext('createLocalLogoutIntentStore', f.ctx)(f.local, store());
    expect(other.note(f.scope(), uid)).toBe(true); f.ctx.setupAuthListener();
    expect(other.acknowledge(f.scope(), uid, other.capture(f.scope()))).toBe(true); f.emit(); await turn();
    expect(f.calls.signedIn).toBe(false); expect(f.ctx.isSignedInUiActive).toBe(false);
    expect(f.intent.blocked(f.scope(), uid)).toBe(true); f.dispose();
});

it('KeyGen new action admission consults pending startup proof even before its first auth callback', () => {
    const f = fake(); f.ctx.setupAuthListener();
    const other = vm.runInContext('createLocalLogoutIntentStore', f.ctx)(f.local, store());
    expect(other.note(f.scope(), uid)).toBe(true);
    expect(other.acknowledge(f.scope(), uid, other.capture(f.scope()))).toBe(true);
    f.ctx.isSignedInUiActive = true;
    expect(f.ctx.captureSensitiveSession(true)).toBeNull(); f.dispose();
});
