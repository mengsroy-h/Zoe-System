import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { dataState, firebaseState, securityState, uiState } from '../../../../ZoeW/src/core/state';
import { appLocalStore, appSessionStore } from '../../../../ZoeW/src/core/storage';
import { registerModalMeta, setModalDisplay, unregisterModalMeta } from '../../../../ZoeW/src/core/modals';
import { dbListenerFailedPaths, dbListenerPendingPaths } from '../../../../ZoeW/src/core/text';
import { forgetAppLockPin, noteAppLockAway, showAppLockScreen } from '../../../../ZoeW/src/features/app-lock';
import { loginBackendScope } from '../../../../ZoeW/src/features/login-memory';
import { localLogoutIntent } from '../../../../ZoeW/src/services/local-logout-intent';
import { detachDatabaseListeners, initDatabaseListeners } from '../../../../ZoeW/src/services/db-listeners';
import { createSupabaseDatabase, SbNetworkError, SbRpcError } from '../../../../ZoeW/src/services/supabase-rtdb';
import { createModeStorage, createSupabaseTransport, SB_AUTH_OWNER_KEY, SB_AUTH_STORAGE_KEY } from '../../../../ZoeW/src/services/supabase-transport';
import { viewState } from '../../../../ZoeW/src/core/view-state';
import { acceptFixtureSession, configureFixtureBackend } from './helpers/accepted-session';

const deferred = <T>() => {
    let resolve!: (v: T) => void;
    let reject!: (e: Error) => void;
    const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
};
const turns = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };

beforeEach(() => {
    appLocalStore.clear();
    appSessionStore.clear();
    dbListenerPendingPaths.clear();
    dbListenerFailedPaths.clear();
    configureFixtureBackend('wave3-fixture');
    dataState.scanHistory = [];
    dataState.deletedItems = [];
    dataState.dailyRevenueData = {};
    dataState.monthlyRevenueData = {};
    dataState.dailyPickupData = {};
    dataState.dailyCollectedData = {};
    Object.assign(securityState, { appIsLocked: false, appLockVeiled: false, appLockBusy: false });
    Object.assign(viewState, { appLockOpen: false, appLockMessage: '', recentlyDeletedRows: [] });
    vi.stubGlobal('confirm', () => true);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    unregisterModalMeta('recentlyDeletedModal');
    unregisterModalMeta('loginModal');
});

it('M-04a៖ forgetAppLockPin ត្រូវកត់ localLogoutIntent និងសម្អាត signed-in data (មិនបន្សល់ session ពុលពេល setItem ធ្លាក់ · មិនកុហកថាបានលុប PIN ពេល removeItem ធ្លាក់)', async () => {
    registerModalMeta('loginModal', {});
    setModalDisplay('loginModal', 'none');
    appLocalStore.setItem('zoew_security_pin_hash', 'pin:123456');
    firebaseState.authGeneration++;
    firebaseState.auth = { currentUser: { uid: 'u-lock-quota' } } as any;
    firebaseState.db = { name: 'lock-db' } as any;
    const quotaFailSignOut = deferred<void>();
    firebaseState.fb = { signOut: vi.fn(() => quotaFailSignOut.promise), off: vi.fn() } as any;
    firebaseState.isDatabaseInitialized = true;
    firebaseState.sessionExpiryCheck = 'live';
    acceptFixtureSession();
    dataState.scanHistory = [{ id: 'secret1', phone: '012345678', barcodes: [{ code: 'SEC1' }] }];
    dataState.deletedItems = [{ id: 'trash1', phone: '012345678', barcodes: [{ code: 'TR1' }] }];

    const origSet = appLocalStore.setItem.bind(appLocalStore);
    const setSpy = vi.spyOn(appLocalStore, 'setItem').mockImplementation((k: string, v: string) => {
        if (k.includes('zoew_local_logout_v1:')) throw new Error('quota-exceeded');
        return origSet(k, v);
    });
    showAppLockScreen();
    forgetAppLockPin();
    await turns();
    expect(localLogoutIntent.blocked(loginBackendScope(), 'u-lock-quota')).toBe(true);
    expect(firebaseState.sessionExpiryCheck).toBe('signed-out');
    expect(dataState.scanHistory).toEqual([]);
    expect(dataState.deletedItems).toEqual([]);
    expect(appLocalStore.getItem('zoew_security_pin_hash')).toBe('pin:123456');
    expect(firebaseState.fb.signOut).toHaveBeenCalledTimes(1);
    quotaFailSignOut.reject(new Error('offline-signout-failed'));
    await turns();
    expect(appLocalStore.getItem('zoew_security_pin_hash')).toBe('pin:123456');
    expect(securityState.appIsLocked).toBe(true);

    const quotaOkSignOut = deferred<void>();
    firebaseState.fb = { signOut: vi.fn(() => quotaOkSignOut.promise), off: vi.fn() } as any;
    forgetAppLockPin();
    await turns();
    firebaseState.auth.currentUser = null;
    quotaOkSignOut.resolve();
    await turns();
    setSpy.mockRestore();
    expect(appLocalStore.getItem('zoew_security_pin_hash')).toBeNull();
    expect(securityState.appIsLocked).toBe(false);

    firebaseState.authGeneration++;
    firebaseState.auth = { currentUser: { uid: 'u-lock-remove-fail' } } as any;
    const secondSignOut = deferred<void>();
    firebaseState.fb = { signOut: vi.fn(() => secondSignOut.promise), off: vi.fn() } as any;
    firebaseState.sessionExpiryCheck = 'live';
    acceptFixtureSession();
    appLocalStore.setItem('zoew_security_pin_hash', 'pin:654321');
    dataState.scanHistory = [{ id: 'secret2', phone: '012345678', barcodes: [{ code: 'SEC2' }] }];
    uiState.toasts = [];
    const origRemove = appLocalStore.removeItem.bind(appLocalStore);
    const removeSpy = vi.spyOn(appLocalStore, 'removeItem').mockImplementation((k: string) => {
        if (k === 'zoew_security_pin_hash') throw new Error('storage-remove-denied');
        return origRemove(k);
    });
    showAppLockScreen();
    forgetAppLockPin();
    await turns();
    noteAppLockAway();
    expect(localLogoutIntent.blocked(loginBackendScope(), 'u-lock-remove-fail')).toBe(true);
    expect(dataState.scanHistory).toEqual([]);
    expect(firebaseState.fb.signOut).toHaveBeenCalledTimes(1);
    firebaseState.auth.currentUser = null;
    secondSignOut.resolve();
    await turns();
    removeSpy.mockRestore();
    expect(securityState.appIsLocked).toBe(false);
    expect(uiState.toasts.some((t: any) => String(t.msg || t).includes('បានលុប PIN'))).toBe(false);
    expect(uiState.toasts.some((t: any) => String(t.msg || t).includes('មិនអាចលុប PIN'))).toBe(true);
});

it('M-04b៖ Supabase transport.signOut ត្រូវលុប session ក្នុង storage ភ្លាមៗមុនរង់ចាំ network /auth/v1/logout', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('BroadcastChannel', undefined);
    const url = 'https://wave3authprojabcdef.supabase.co';
    const localRows = new Map<string, string>([
        [SB_AUTH_STORAGE_KEY, JSON.stringify({ access_token: 'tok-live', refresh_token: 'ref-live', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: 'u1', aud: 'authenticated', email: 'u1@users.zoew.invalid' } })],
        [SB_AUTH_OWNER_KEY, url]
    ]);
    const store = { getItem: (k: string) => localRows.get(k) ?? null, setItem: (k: string, v: string) => { localRows.set(k, v); }, removeItem: (k: string) => { localRows.delete(k); } };
    const empty = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
    const hangLogout = deferred<Response>();
    let logoutStarted = false;
    const transport = createSupabaseTransport({ supabaseUrl: url, supabaseKey: 'sb_publishable_test' }, {
        localStorage: store, sessionStorage: empty, eventTarget: new EventTarget(),
        fetch: async (u: any) => {
            if (String(u).includes('/auth/v1/logout')) { logoutStarted = true; return hangLogout.promise; }
            return new Response(null, { status: 204 });
        }
    });
    await transport.restoreSession();
    const out = transport.signOut();
    await turns();
    expect(logoutStarted).toBe(true);
    expect(localRows.get(SB_AUTH_STORAGE_KEY)).toBeUndefined();
    hangLogout.resolve(new Response(null, { status: 204 }));
    await out;
    transport.close();
});

it('M-14៖ createModeStorage ត្រូវគោរព setMode(session) ទោះ key មានស្រាប់ក្នុង localStorage', () => {
    const localMap = new Map<string, string>([[SB_AUTH_STORAGE_KEY, 'old-local-session']]);
    const sessMap = new Map<string, string>();
    const makeStore = (m: Map<string, string>) => ({
        getItem: (k: string) => m.get(k) ?? null,
        setItem: (k: string, v: string) => { m.set(k, v); },
        removeItem: (k: string) => { m.delete(k); }
    });
    const modeStore = createModeStorage(makeStore(localMap), makeStore(sessMap));
    modeStore.setMode('session');
    modeStore.setItem(SB_AUTH_STORAGE_KEY, 'new-ephemeral-session');
    expect(sessMap.get(SB_AUTH_STORAGE_KEY)).toBe('new-ephemeral-session');
    expect(localMap.has(SB_AUTH_STORAGE_KEY)).toBe(false);

    const passiveLocal = new Map<string, string>([['k1', 'v1']]);
    const passiveSess = new Map<string, string>([['k2', 'v2']]);
    const passive = createModeStorage(makeStore(passiveLocal), makeStore(passiveSess));
    passive.setItem('k2', 'v2-refreshed');
    expect(passiveSess.get('k2')).toBe('v2-refreshed');
    expect(passiveLocal.has('k2')).toBe(false);
});

it('M-09a/b៖ Supabase runTransaction មិនត្រូវ resend zoe_write ក្រោយ SB_OP_REPLAY_SAFE_MS (sync តាម runSync មិន race pullStage) និងត្រូវត្រឡប់ not-applied តែលើ zoe_write refusal', async () => {
    vi.useFakeTimers();
    const wait = (ms: number) => vi.advanceTimersByTimeAsync(ms);
    const HOUR = 60 * 60 * 1000;
    let mode: 'ok' | 'drop' | 'down' | 'tenant-mismatch' | 'pull-refuse' = 'ok';
    let seq = 1;
    let docVal: any = { codDollar: 100 };
    const appliedOps: string[] = [];
    let pullCalls = 0;
    let concurrentPulls = 0;
    let maxConcurrentPulls = 0;
    let holdResetPullPage2 = false;
    let releasePullPage2: (() => void) | null = null;
    const transport = {
        rpc: async (fn: string, args: any) => {
            if (fn === 'zoe_pull' || fn === 'zoe_pull_delta') {
                pullCalls++;
                concurrentPulls++;
                maxConcurrentPulls = Math.max(maxConcurrentPulls, concurrentPulls);
                try {
                    if (mode === 'down') throw new SbNetworkError('down');
                    if (mode === 'pull-refuse') throw new SbRpcError('permission_denied', '42501', 403, '');
                    if (holdResetPullPage2 && args.p_since === 0) {
                        return { seq: 1, more: true, reset: true, head: seq, tenant: 't1', now: Date.now(), rows: [{ r: 'other', k: 'k1', v: { ok: 1 }, s: 1 }] };
                    }
                    if (holdResetPullPage2 && args.p_since > 0) {
                        await new Promise<void>((r) => { releasePullPage2 = r; });
                        holdResetPullPage2 = false;
                        return { seq, more: false, reset: false, head: seq, tenant: 't1', now: Date.now(), rows: [{ r: 'ledger', k: 'd1', v: docVal, s: seq }] };
                    }
                    return { seq, more: false, reset: true, head: seq, tenant: 't1', now: Date.now(), rows: [{ r: 'other', k: 'k1', v: { ok: 1 }, s: 1 }, { r: 'ledger', k: 'd1', v: docVal, s: seq }] };
                } finally {
                    concurrentPulls--;
                }
            }
            if (fn === 'zoe_now') {
                if (mode === 'down') throw new SbNetworkError('down');
                return Date.now();
            }
            if (fn === 'zoe_write_v2') {
                if (mode === 'down') throw new SbNetworkError('down');
                if (mode === 'tenant-mismatch') throw new SbRpcError('permission_denied', '42501', 403, '');
                const op = args.p_ops[0];
                if (JSON.stringify(op.x) !== JSON.stringify(docVal)) return { ok: false, conflict: true, now: Date.now(), value: docVal };
                seq++;
                docVal = op.v;
                appliedOps.push(args.p_op_id);
                if (mode === 'drop') throw new SbNetworkError('timeout');
                return { ok: true, seq, now: Date.now(), docs: [{ r: 'ledger', k: 'd1', v: docVal, s: seq }] };
            }
            throw new Error('unexpected ' + fn);
        },
        ping: async () => true,
        subscribe: () => () => {}
    };
    const unknownPaths: string[] = [];
    const db = createSupabaseDatabase(transport, {
        onListenerError: () => {}, onSynced: () => {}, onForbidden: () => {},
        onTxOutcomeUnknown: (p: string[]) => { unknownPaths.push(p.join('/')); }
    }, { retryStepsMs: [50, 100, 600000], pollFallbackMs: 600000, rpcTimeoutMs: 1000 });
    db.setTenantTopic('zoe:t1');
    db.setAuthed(true, 'scope');
    let ready = false;
    db.onValue(db.ref('ledger'), () => { ready = true; });
    for (let i = 0; i < 40 && !ready; i++) await wait(5);
    expect(ready).toBe(true);

    mode = 'drop';
    let abaResult: any = 'pending';
    db.runTransaction(db.ref('ledger/d1'), (cur: any) => ({ codDollar: (cur?.codDollar || 0) - 5 }))
        .then((r: any) => { abaResult = r; }, (e: any) => { abaResult = e; });
    await wait(30);
    expect(appliedOps).toHaveLength(1);
    expect(docVal).toEqual({ codDollar: 95 });

    mode = 'down';
    docVal = { codDollar: 100 };
    seq++;
    await wait(72 * HOUR);
    const pullsBefore = pullCalls;
    holdResetPullPage2 = true;
    mode = 'ok';
    await wait(1200000);
    if (releasePullPage2) releasePullPage2();
    await wait(100);
    expect(appliedOps).toHaveLength(1);
    expect(docVal).toEqual({ codDollar: 100 });
    expect(maxConcurrentPulls).toBe(1);
    expect(abaResult?.txOutcome).toBe('unknown');
    expect(unknownPaths).toContain('ledger/d1');
    expect(db.snapshotState().docs['other/k1']?.v).toEqual({ ok: 1 });
    expect(pullCalls).toBeGreaterThan(pullsBefore);

    mode = 'drop';
    let pullRefusedResult: any = 'pending';
    db.runTransaction(db.ref('ledger/d1'), (cur: any) => ({ codDollar: (cur?.codDollar || 0) - 5 }))
        .then((r: any) => { pullRefusedResult = r; }, (e: any) => { pullRefusedResult = e; });
    await wait(30);
    mode = 'down';
    await wait(72 * HOUR);
    mode = 'pull-refuse';
    await wait(1200000);
    expect(pullRefusedResult?.txOutcome).toBe('unknown');
    mode = 'ok';
    db.goOnline();
    await wait(50);

    mode = 'drop';
    let refusedResult: any = 'pending';
    db.runTransaction(db.ref('ledger/d1'), (cur: any) => ({ codDollar: (cur?.codDollar || 0) - 5 }))
        .then((r: any) => { refusedResult = r; }, (e: any) => { refusedResult = e; });
    await wait(30);
    mode = 'tenant-mismatch';
    await wait(1200000);
    expect(refusedResult?.txOutcome).toBe('not-applied');
    db.close('test');
});

it('M-18a/b/c៖ db-listeners ដាក់ទិន្នន័យមុន noteDbListenerAlive + refresh trash modal និង supabase-transport/sdk ការពារ clock-skew, null token និង token refresh', async () => {
    const callbacks: Record<string, (snap: any) => void> = {};
    firebaseState.db = { name: 'm18-db' } as any;
    firebaseState.fb = {
        onValue: (ref: any, cb: (s: any) => void) => { callbacks[ref.path] = cb; return () => {}; },
        off: () => {}
    } as any;
    firebaseState.dbRefExchangeRate = { path: 'exchange' } as any;
    firebaseState.dbRefDailyRevenue = { path: 'daily' } as any;
    firebaseState.dbRefMonthlyRevenue = { path: 'monthly' } as any;
    firebaseState.dbRefDailyPickup = { path: 'pickup' } as any;
    firebaseState.dbRefDailyCollected = { path: 'collected' } as any;
    firebaseState.dbRefHistory = { path: 'history' } as any;
    firebaseState.dbRefDeleted = { path: 'deleted' } as any;
    registerModalMeta('recentlyDeletedModal', {});
    setModalDisplay('recentlyDeletedModal', 'flex');
    initDatabaseListeners();

    callbacks.deleted({ val: () => ({ t1: { id: 't1', phone: '012', createdAt: 1000, deletedAt: 2000, trashReason: 'delete', barcodes: [{ code: 'D1' }] } }) });
    expect(dataState.deletedItems).toHaveLength(1);
    expect(uiState.trashView.rows.length).toBe(1);
    detachDatabaseListeners();

    vi.stubGlobal('BroadcastChannel', undefined);
    const url = 'https://wave3m18projabcdefg.supabase.co';
    const pastExp = Math.floor(Date.now() / 1000) - 7200;
    const localRows = new Map<string, string>([
        [SB_AUTH_STORAGE_KEY, JSON.stringify({ access_token: 'skew-tok', refresh_token: 'r1', token_type: 'bearer', expires_in: 3600, expires_at: pastExp, user: { id: 'u1', aud: 'authenticated', email: 'u1@users.zoew.invalid' } })],
        [SB_AUTH_OWNER_KEY, url]
    ]);
    const store = { getItem: (k: string) => localRows.get(k) ?? null, setItem: (k: string, v: string) => { localRows.set(k, v); }, removeItem: (k: string) => { localRows.delete(k); } };
    const empty = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
    let fetchedObs = false;
    const transport = createSupabaseTransport({ supabaseUrl: url, supabaseKey: 'sb_publishable_test' }, {
        localStorage: store, sessionStorage: empty, eventTarget: new EventTarget(),
        fetch: async (u: any) => {
            if (String(u).includes('/rest/v1/rpc/zoe_read')) { fetchedObs = true; return new Response(JSON.stringify({ ok: true }), { status: 200 }); }
            return new Response(JSON.stringify({ error: 'service-unavailable' }), { status: 503 });
        }
    });
    await transport.restoreSession();
    await expect(transport.rpc('zoe_read', { p_root: 'x', p_key: 'y' }, 2000, { observational: true, current: () => true, deadline: performance.now() + 2000 })).rejects.toThrow();
    expect(fetchedObs).toBe(false);

    const emptyTransport = createSupabaseTransport({ supabaseUrl: url, supabaseKey: 'sb_publishable_test' }, {
        localStorage: empty, sessionStorage: empty, eventTarget: new EventTarget(),
        fetch: async () => new Response(null, { status: 204 })
    });
    const statuses: string[] = [];
    const unsub = emptyTransport.subscribe('zoe:t1', () => {}, (s) => statuses.push(s));
    await turns();
    expect(statuses).toContain('CHANNEL_ERROR');
    unsub();
    emptyTransport.close();
    transport.close();
});
