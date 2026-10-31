import { performance as realPerformance } from 'node:perf_hooks';
import { setTimeout as realDelay } from 'node:timers/promises';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { attachInfoListeners, setupConnectionRecovery } from '../src/services/connection';
import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { refTo } from '../src/app/refs';
import { dataState, firebaseState, scanState, uiState, ztoState } from '../src/core/state';
import { viewState } from '../src/core/view-state';
import { pendingRegistryReleases } from '../src/core/clock';
import { dbListenerFailedPaths, dbListenerPendingPaths } from '../src/core/text';
import { getFormattedDate } from '../src/core/timezone';
import { clearZtoPickupStatusStore } from '../src/features/zto-status';
import { DB_OP_TIMEOUT_MS } from '../src/services/network';
import { createScanEvidenceJournal } from '../src/services/scan-evidence';
import { pendingScanScope, preparePendingScan } from '../src/services/scan-pending';
import { cancelScanOperation, claimScanOperation, resumePendingScanOperations, saveScanOperation } from '../src/services/scan-operation';
import { txResolvingPaths, withTransactionOutcomeResolution } from '../src/services/tx-outcome';

const H = 'zoew_scan_history_cod_dod';
const D = 'zoew_daily_revenue_cod_dod';
const M = 'zoew_monthly_revenue_cod_dod';
const R = 'zoew_barcode_registry';
const HOST = 'https://scan-reboot-closure.firebaseio.com';
const NOW = Date.UTC(2026, 9, 24, 2);
const fields = ['modalPhoneInput', 'modalLockerInput', 'modalCodInput', 'modalDodInput'] as const;
const copy = <T,>(value: T): T => value === undefined ? value : JSON.parse(JSON.stringify(value));
const parts = (path: string) => path.split('/').filter(Boolean);
let server: any;
const heldWrites = new Map<string, Promise<void>>();
const heldAcks = new Map<string, Promise<void>>();
const writesStarted: string[] = [];
const listeners = new Map<string, (value: any) => void>();
let blockReads = false;
let historyFault = '';
let heldRegistryRelease: null | { reached: () => void; wait: Promise<void> } = null;
let applications: { sdk: any; db: any; app: any }[] = [];
const day = () => getFormattedDate(new Date(NOW));
const get = (path: string) => copy(parts(path).reduce((node, key) => node?.[key], server) ?? null);
const money = () => [get(D + '/' + day()), get(M + '/' + day().slice(0, 7))]
    .map(row => [row?.codDollar ?? 0, row?.dodDollar ?? 0, row?.totalCount ?? 0]);
const evidence = () => ([1, 2] as const).flatMap(version => createScanEvidenceJournal(localStorage, version).list(pendingScanScope()));
const flush = async () => { for (let n = 0; n < 25; n++) await new Promise(resolve => setTimeout(resolve, 0)); };

async function waitForRealCondition(condition: () => boolean, label: string) {
    const deadline = realPerformance.now() + 2000;
    while (!condition()) {
        if (realPerformance.now() >= deadline) throw new Error('Observable completion missing: ' + label);
        await realDelay(0);
    }
}

function put(path: string, value: any) {
    const keys = parts(path);
    const last = keys.pop()!;
    let target = server;
    for (const key of keys) target = target[key] ||= {};
    if (value === null || value === undefined) delete target[last];
    else if (value?.['.sv'] === 'timestamp') target[last] = NOW;
    else if (typeof value?.['.sv']?.increment === 'number') target[last] = (Number(target[last]) || 0) + value['.sv'].increment;
    else target[last] = copy(value);
}

function reference(path = '') {
    return { path, key: parts(path).at(-1) || null, toString: () => HOST + '/' + path };
}

function snapshot(ref: any, value: any) {
    return { ref, key: ref.key, val: () => copy(value), exists: () => value !== null && value !== undefined };
}

function makeNative() {
    const app = { options: { databaseURL: HOST } };
    const auth = { app, currentUser: { uid: 'scan-owner', getIdToken: async () => 'test-token' } };
    const db = { app };
    const raw = {
        getAuth: () => auth,
        getDatabase: () => db,
        deleteApp: async () => {},
        ref: (_db: any, path = '') => reference(path),
        increment: (amount: number) => ({ '.sv': { increment: amount } }),
        get: async (ref: any) => {
            if (blockReads) throw new TypeError('Failed to fetch');
            return snapshot(ref, get(ref.path));
        },
        update: async (ref: any, updates: any) => {
            const writes = Object.entries(updates).map(([key, value]) => ({ path: [ref.path, key].filter(Boolean).join('/'), value }));
            const cancelled = writes.find(write => write.path.startsWith('zoew_scan_operations/') && (write.value as any)?.phase === 'cancelled');
            if (cancelled) {
                const intent = (cancelled.value as any).id;
                writesStarted.push(intent);
                const held = heldWrites.get(intent);
                if (held) await held;
            }
            if (heldRegistryRelease && writes.some(write => write.path.startsWith(R + '/') && write.value === null)) {
                const held = heldRegistryRelease; heldRegistryRelease = null; held.reached(); await held.wait;
            }
            for (const write of writes) {
                const owner = get(write.path);
                if (!write.path.startsWith(R + '/') || write.value !== null || owner?.v !== 2) continue;
                const cancelled = writes.find(entry => entry.path === 'zoew_scan_operations/' + owner.intent)?.value as any;
                const released = writes.find(entry => entry.path === 'zoew_registry_releases/' + owner.intent)?.value as any;
                if (cancelled?.phase !== 'cancelled' && !(released?.kind === 'scan' && released?.id === owner.intent)) {
                    throw Object.assign(new Error('permission_denied'), { code: 'PERMISSION_DENIED' });
                }
            }
            const touchesHistory = writes.some(write => write.path.startsWith(H + '/'));
            if (touchesHistory && historyFault) {
                blockReads = true;
                if (historyFault === 'refused') throw Object.assign(new Error('permission_denied'), { code: 'PERMISSION_DENIED' });
            }
            for (const write of writes) put(write.path, write.value);
            const committed = writes.find(write => write.path.startsWith('zoew_scan_operations/') && (write.value as any)?.phase === 'committed');
            if (committed) await heldAcks.get((committed.value as any).id);
            if (touchesHistory && historyFault === 'lost-ack') throw new Error('disconnect');
        },
        set: async (ref: any, value: any) => put(ref.path, value),
        runTransaction: async (ref: any, update: any) => {
            const previous = get(ref.path);
            const next = update(copy(previous));
            if (next === undefined) return { committed: false, snapshot: snapshot(ref, previous) };
            const touchesHistory = ref.path.startsWith(H + '/');
            if (touchesHistory && historyFault) {
                blockReads = true;
                if (historyFault === 'refused') throw Object.assign(new Error('disconnect'), { txOutcome: 'unknown' });
            }
            put(ref.path, next);
            if (touchesHistory && historyFault === 'lost-ack') throw Object.assign(new Error('disconnect'), { txOutcome: 'unknown' });
            return { committed: true, snapshot: snapshot(ref, get(ref.path)) };
        },
        onValue: (ref: any, callback: any) => { listeners.set(ref.path, callback); return () => listeners.delete(ref.path); },
        off: () => {}
    };
    const sdk = withTransactionOutcomeResolution(raw);
    sdk.getAuth(app); sdk.getDatabase(app);
    Object.assign(firebaseState, { firebaseConfig: app.options, fb: sdk, auth, db, isDatabaseInitialized: true,
        isInitializingFirebase: false, firebaseSdkUnavailable: false, isDatabaseConnected: true,
        sessionExpiryCheck: 'live', authLoginOperation: null, dbLivenessProbe: Promise.resolve(null) });
    firebaseState.dbRefHistory = sdk.ref(db, H);
    firebaseState.dbRefDailyRevenue = sdk.ref(db, D);
    firebaseState.dbRefMonthlyRevenue = sdk.ref(db, M);
    const result = { sdk, db, app };
    applications.push(result);
    return result;
}

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(NOW);
    vi.stubGlobal('crypto', webcrypto);
    vi.stubGlobal('confirm', () => true);
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    localStorage.clear(); pendingRegistryReleases.clear(); clearZtoPickupStatusStore();
    dbListenerFailedPaths.clear(); dbListenerPendingPaths.clear();
    txResolvingPaths.clear();
    localStorage.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: HOST }));
    heldWrites.clear(); heldAcks.clear(); writesStarted.length = 0; listeners.clear();
    blockReads = false; historyFault = ''; heldRegistryRelease = null; applications = [];
    const old = { id: 'existing-row', phone: '012000111', scanDate: day(), time: '09:00:00 (' + day() + ')',
        createdAt: NOW - 60000, count: 1, cod: 10, dod: 0, price: 10, isClosed: false, isCalled: false,
        barcode: 'EXISTING0001', barcodes: [{ code: 'EXISTING0001', cod: 10, dod: 0, createdAt: NOW - 60000,
            isClosed: false, isDeducted: false, isFromDeletion: false }] };
    server = { [H]: { [old.id]: old }, [D]: { [day()]: { codDollar: 10, dodDollar: 0, totalCount: 1 } },
        [M]: { [day().slice(0, 7)]: { codDollar: 10, dodDollar: 0, totalCount: 1 } }, [R]: { EXISTING0001: true } };
    dataState.scanHistory = [copy(old)]; dataState.deletedItems = [];
    dataState.dailyRevenueData = get(D); dataState.monthlyRevenueData = get(M);
    dataState.dailyCollectedData = {}; dataState.dailyPickupData = {};
    scanState.pendingBarcode = ''; scanState.pendingScanSession = null;
    viewState.phoneModalBusy = false; uiState.modalDisplay = {}; uiState.isModalOpen = false; uiState.toasts = [];
    uiState.entryScanMode = 'add'; uiState.lastEnteredLocker = '';
    ztoState.ztoListSyncInFlight = false; ztoState.ztoListSyncResult = null;
    firebaseState.authGeneration++;
    for (const field of fields) refTo(field)(document.createElement('input'));
    vi.stubGlobal('fetch', vi.fn(async (url: any) => {
        if (blockReads) throw new TypeError('Failed to fetch');
        const path = decodeURIComponent(new URL(String(url)).pathname).replace(/^\//, '').replace(/\.json$/, '');
        return new Response(JSON.stringify(get(path)), { status: 200, headers: { 'content-type': 'application/json' } });
    }));
    (window as any).ZoeErrors = { capture: vi.fn() };
});

afterEach(async () => {
    firebaseState.authGeneration++;
    for (const app of applications) await app.sdk.deleteApp(app.app);
    for (const field of fields) refTo(field)(null);
    vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers();
    delete (window as any).ZoeErrors;
});



async function admitted(code: string) {
    const handle = preparePendingScan(code, 1, 0, NOW, 'direct', 2);
    expect(await claimScanOperation(handle, code)).toBe('claimed');
    return handle;
}

it('recovery has a whole-pass ceiling and advances beyond multiple hanging heads', async () => {
    makeNative();
    const heads = [];
    for (let i = 0; i < 3; i++) heads.push(await admitted('AUDIT_HEAD_' + i));
    const tail = await admitted('AUDIT_TAIL');
    const releases: Array<() => void> = [];
    for (const handle of heads) heldWrites.set(handle.record.id, new Promise<void>(resolve => releases.push(resolve)));
    firebaseState.authGeneration++; makeNative();
    const completed: Promise<void>[] = [];
    for (let index = 0; index < heads.length; index++) {
        vi.useFakeTimers();
        let ended = false;
        const pass = resumePendingScanOperations().then(() => { ended = true; }); completed.push(pass);
        await vi.waitFor(() => expect(writesStarted).toHaveLength(index + 1));
        await vi.advanceTimersByTimeAsync(DB_OP_TIMEOUT_MS + 1);
        expect(ended, 'one entire pass must end even though its write remains pending').toBe(true);
        expect(evidence()).toHaveLength(4);
        vi.useRealTimers(); vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(NOW);
    }
    await resumePendingScanOperations();
    expect(get('zoew_scan_operations/' + tail.record.id).phase).toBe('cancelled');
    expect(evidence()).toHaveLength(3);
    expect(writesStarted.filter(id => id !== tail.record.id)).toEqual(heads.map(handle => handle.record.id));
    await resumePendingScanOperations();
    expect(writesStarted).toHaveLength(4);
    releases.forEach(release => release()); await flush();
    expect(evidence()).toHaveLength(0);
    expect(writesStarted).toHaveLength(4);
    expect(money()).toEqual([[10,0,1],[10,0,1]]);
    await Promise.all(completed);
});

it('late ACK cannot dispatch the expired loop or clear a newer global owner', async () => {
    makeNative();
    const first = await admitted('OLD_ATTEMPT');
    const second = await admitted('NEW_ATTEMPT');
    const tail = await admitted('WAITING_TAIL');
    let releaseFirst!: () => void, releaseSecond!: () => void;
    heldWrites.set(first.record.id, new Promise<void>(resolve => releaseFirst = resolve));
    heldWrites.set(second.record.id, new Promise<void>(resolve => releaseSecond = resolve));
    firebaseState.authGeneration++; makeNative(); vi.useFakeTimers();
    const old = resumePendingScanOperations();
    await vi.waitFor(() => expect(writesStarted).toHaveLength(1));
    await vi.advanceTimersByTimeAsync(DB_OP_TIMEOUT_MS + 1); await old;
    const newer = resumePendingScanOperations();
    await vi.waitFor(() => expect(writesStarted).toHaveLength(2));
    const tailReads = () => vi.mocked(globalThis.fetch).mock.calls.filter(([url]) => String(url).includes('/zoew_scan_operations/' + tail.record.id)).length;
    const readsBefore = tailReads();
    releaseFirst();
    await waitForRealCondition(() => !evidence().some(row => row.id === first.record.id), 'first attempt terminal proof');
    for (let i = 0; i < 20; i++) await Promise.resolve();
    expect(tailReads(), 'expired loop must not even dispatch the next proof read').toBe(readsBefore);
    await resumePendingScanOperations();
    expect(writesStarted).toHaveLength(2);
    expect(get('zoew_scan_operations/' + tail.record.id).phase).toBe('admitted');
    await vi.advanceTimersByTimeAsync(DB_OP_TIMEOUT_MS + 1); await newer;
    vi.useRealTimers(); vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(NOW);
    await resumePendingScanOperations();
    expect(get('zoew_scan_operations/' + tail.record.id).phase).toBe('cancelled');
    releaseSecond(); await flush();
    expect(evidence()).toHaveLength(0);
    expect(writesStarted).toHaveLength(3);
});

it('a terminal receipt behind a stalled write finishes without another write', async () => {
    makeNative();
    const first = await admitted('HUNG_A'); const second = await admitted('TERMINAL_B');
    const setItem = localStorage.setItem.bind(localStorage);
    const fault = vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
        if (key.includes(second.record.id) && key.endsWith(':terminal')) throw new Error('storage unavailable');
        setItem(key, value);
    });
    expect(await cancelScanOperation(second)).toBe(false); fault.mockRestore();
    let release!: () => void;
    heldWrites.set(first.record.id, new Promise<void>(resolve => release = resolve));
    writesStarted.length = 0; firebaseState.authGeneration++; makeNative(); vi.useFakeTimers();
    const pass = resumePendingScanOperations();
    await vi.waitFor(() => expect(writesStarted).toHaveLength(1));
    await vi.advanceTimersByTimeAsync(DB_OP_TIMEOUT_MS + 1); await pass;
    await resumePendingScanOperations();
    expect(evidence().map(entry => entry.id)).toEqual([first.record.id]);
    expect(writesStarted).toEqual([first.record.id]);
    release(); await vi.advanceTimersByTimeAsync(1);
    expect(evidence()).toHaveLength(0);
});

it.each(['unauthenticated', 'pending-tenant', 'stale-config'])('recovery does not write under %s context', async kind => {
    makeNative(); await admitted('SCOPED_SCAN');
    firebaseState.authGeneration++;
    const before = copy(server); writesStarted.length = 0;
    if (kind === 'unauthenticated') firebaseState.auth.currentUser = null;
    else if (kind === 'stale-config') localStorage.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: 'https://other.firebaseio.com' }));
    else {
        localStorage.setItem('zoew_firebase_config', JSON.stringify({ supabaseUrl: 'https://pending.supabase.co' }));
        firebaseState.db = { app: { options: { supabaseUrl: 'https://pending.supabase.co' } } } as any;
        firebaseState.auth.app = firebaseState.db.app;
        firebaseState.fb = { ...firebaseState.fb, tenantScope: () => '' };
    }
    await resumePendingScanOperations();
    expect(server).toEqual(before); expect(writesStarted).toEqual([]);
});

it('late old-session ACK retains local proof until the current session verifies it', async () => {
    makeNative(); const handle = await admitted('OLD_SESSION');
    let release!: () => void;
    heldWrites.set(handle.record.id, new Promise<void>(resolve => release = resolve));
    firebaseState.authGeneration++; makeNative(); vi.useFakeTimers();
    const old = resumePendingScanOperations();
    await vi.waitFor(() => expect(writesStarted).toHaveLength(1));
    await vi.advanceTimersByTimeAsync(DB_OP_TIMEOUT_MS + 1); await old;
    firebaseState.authGeneration++; makeNative();
    release(); await vi.advanceTimersByTimeAsync(1);
    expect(evidence()).toHaveLength(1);
    expect(get('zoew_scan_operations/' + handle.record.id).phase).toBe('cancelled');
    await resumePendingScanOperations();
    expect(evidence()).toHaveLength(0);
    expect(money()).toEqual([[10,0,1],[10,0,1]]);
});

it.each(['online', 'database-connected'])('actual %s hook retries with unchanged healthy data listeners', async kind => {
    const native = makeNative(); const handle = await admitted('EVENT_RETRY');
    firebaseState.authGeneration++; makeNative();
    firebaseState.dbListenersFailed = false;
    let dispose = () => {};
    if (kind === 'online') {
        dispose = setupConnectionRecovery();
        window.dispatchEvent(new Event('online'));
    } else {
        firebaseState.dbRefConnected = firebaseState.fb.ref(firebaseState.db, '.info/connected');
        firebaseState.dbRefServerTimeOffset = firebaseState.fb.ref(firebaseState.db, '.info/serverTimeOffset');
        attachInfoListeners();
        listeners.get('.info/connected')!(snapshot(native.sdk.ref(native.db, '.info/connected'), true));
    }
    await vi.waitFor(() => expect(get('zoew_scan_operations/' + handle.record.id).phase).toBe('cancelled'));
    await flush(); dispose();
    expect(evidence()).toHaveLength(0);
});

function periodicHooks() {
    const source = readFileSync('src/app/lifecycle/boot.ts', 'utf8');
    const parsed = ts.createSourceFile('boot.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const node = parsed.statements.find(statement => ts.isFunctionDeclaration(statement) && statement.name?.text === 'startPeriodicTasks');
    if (!node) throw new Error('actual periodic lifecycle function missing');
    const code = ts.transpileModule(node.getText(parsed), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
    const unrelated = ['prefetchCustomerDataTableRowsIfConfigured', 'runSessionExpiryCheck', 'runPeriodicLicenseCheck', 'sweepRecallHighlights',
        'notifyPeriodicTick', 'syncExpirySchedule', 'noteShopDevice', 'retryZtoShopSweepListener', 'retryZtoTrashModeListener', 'retryZtoSweepLaneListener',
        'refreshZtoTrashModeMark', 'runScheduledCleanup', 'resumeInterruptedCleanups', 'scheduleZtoStatusSweep', 'scheduleZtoFinalMarks',
        'refreshZtoPalmSession', 'probeDatabaseLivenessIfIdle', 'resyncPush', 'warmZtoLookupProxyNow'];
    const context = { ...Object.fromEntries(unrelated.map(name => [name, () => {}])), resumePendingScanOperations, document, uiState,
        CUSTOMER_TABLE_CACHE_MS: 1, LICENSE_RECHECK_INTERVAL_MS: 2, NOTIFY_FEED_INTERVAL_MS: 3 };
    const callbacks: Array<{ milliseconds: number; callback: () => void }> = [], events = new Map<string, () => void>();
    const start = vm.runInNewContext(code + '; startPeriodicTasks;', context);
    start({ every: (milliseconds: number, callback: () => void) => callbacks.push({ milliseconds, callback }),
        listen: (_target: any, event: string, callback: () => void) => events.set(event, callback) });
    return { callbacks, events };
}

it.each(['periodic', 'visible'])('actual %s lifecycle callback retries pending scans without data changes', async kind => {
    makeNative(); const handle = await admitted('LIFECYCLE_RETRY'); firebaseState.authGeneration++; makeNative();
    const hooks = periodicHooks();
    if (kind === 'periodic') hooks.callbacks.filter(row => row.milliseconds === 60000).forEach(row => row.callback());
    else { vi.spyOn(document, 'hidden', 'get').mockReturnValue(false); hooks.events.get('visibilitychange')!(); }
    await vi.waitFor(() => expect(get('zoew_scan_operations/' + handle.record.id).phase).toBe('cancelled'));
    await flush(); expect(evidence()).toHaveLength(0);
});

it('cursor advances past recurring slow unresolved heads instead of restarting at the first row', async () => {
    makeNative(); const first = await admitted('SLOW_A'); const second = await admitted('SLOW_B'); const tail = await admitted('FAIR_TAIL');
    firebaseState.authGeneration++; makeNative();
    const originalFetch = globalThis.fetch;
    const slowReads = new Set<string>();
    vi.stubGlobal('fetch', vi.fn(async (url: any, init?: any) => {
        const slowId = [first.record.id, second.record.id].find(id => String(url).includes('/zoew_scan_operations/' + id));
        if (slowId) {
            slowReads.add(slowId);
            await new Promise(resolve => setTimeout(resolve, 10000));
            return new Response('null', { status: 200 });
        }
        return originalFetch(url, init);
    }));
    vi.useFakeTimers();
    const initial = resumePendingScanOperations();
    await waitForRealCondition(() => slowReads.has(first.record.id), 'first slow proof read');
    await vi.advanceTimersByTimeAsync(DB_OP_TIMEOUT_MS + 1); await initial;
    expect(slowReads.has(second.record.id)).toBe(true);
    const next = resumePendingScanOperations();
    await waitForRealCondition(() => get('zoew_scan_operations/' + tail.record.id).phase === 'cancelled', 'healthy tail cancellation without more fake time');
    await vi.advanceTimersByTimeAsync(DB_OP_TIMEOUT_MS + 1); await next;
    expect(get('zoew_scan_operations/' + tail.record.id).phase).toBe('cancelled');
    expect(evidence().map(row => row.id).sort()).toEqual([first.record.id, second.record.id].sort());
    await vi.advanceTimersByTimeAsync(10000);
});

it('late committed scan ACK after session replacement does not replay revenue or erase newer evidence', async () => {
    makeNative(); const handle = await admitted('LATE_COMMIT');
    let release!: () => void;
    heldAcks.set(handle.record.id, new Promise<void>(resolve => release = resolve));
    const saving = saveScanOperation(handle, '012222222', 'A1');
    await vi.waitFor(() => expect(get('zoew_scan_operations/' + handle.record.id).phase).toBe('committed'));
    expect(money()).toEqual([[11,0,2],[11,0,2]]);
    expect(evidence()).toHaveLength(1);
    firebaseState.authGeneration++; makeNative();
    await resumePendingScanOperations(); await resumePendingScanOperations();
    expect(evidence()).toHaveLength(0); expect(money()).toEqual([[11,0,2],[11,0,2]]);
    release(); await saving; await resumePendingScanOperations();
    expect(evidence()).toHaveLength(0); expect(money()).toEqual([[11,0,2],[11,0,2]]);
});

it('recovery releases stale-context bookkeeping across shops and logout without forgetting unknown journals', async () => {
    let attempts: Map<string, any> | undefined;
    const observe = (map: Map<string, any>) => { attempts = map; };
    const mapSet = Map.prototype.set;
    vi.spyOn(Map.prototype, 'set').mockImplementation(function (this: Map<any, any>, key: any, value: any) {
        if (value?.handle?.record?.v === 2 && Object.hasOwn(value, 'promise')) observe(this);
        return mapSet.call(this, key, value);
    });
    const releases: Array<() => void> = [];
    const scopes: string[] = [];
    for (let index = 0; index < 3; index++) {
        makeNative(); firebaseState.auth.currentUser.uid = 'shop-owner-' + index;
        const handle = await admitted('SCOPE_' + index);
        scopes.push(handle.record.scope);
        heldWrites.set(handle.record.id, new Promise<void>(resolve => releases.push(resolve)));
        firebaseState.authGeneration++; makeNative(); firebaseState.auth.currentUser.uid = 'shop-owner-' + index;
        vi.useFakeTimers();
        const pass = resumePendingScanOperations();
        await vi.waitFor(() => expect(writesStarted).toHaveLength(index + 1));
        await vi.advanceTimersByTimeAsync(DB_OP_TIMEOUT_MS + 1); await pass;
        expect(attempts?.size, 'only current-context attempts may remain globally retained').toBe(1);
        expect(attempts?.has(handle.record.id)).toBe(true);
        await resumePendingScanOperations();
        expect(writesStarted).toHaveLength(index + 1);
        expect(attempts?.size, 'same-context timeout must preserve duplicate suppression').toBe(1);
        localStorage.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: 'https://staged.firebaseio.com' }));
        await resumePendingScanOperations();
        expect(attempts?.size, 'staged config alone must not discard the live old-context attempt').toBe(1);
        localStorage.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: HOST }));
        vi.useRealTimers(); vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(NOW);
    }
    firebaseState.auth.currentUser = null;
    await resumePendingScanOperations();
    expect(attempts?.size, 'logout must prune even though recovery cannot start').toBe(0);
    expect(writesStarted).toHaveLength(3);
    expect(scopes.map(scope => createScanEvidenceJournal(localStorage, 2).list(scope).length)).toEqual([1, 1, 1]);
    releases.forEach(release => release());
    await flush();
    expect(attempts?.size).toBe(0);
    expect(scopes.map(scope => createScanEvidenceJournal(localStorage, 2).list(scope).length)).toEqual([1, 1, 1]);
});

it('late old-context completion cannot remove a replacement live attempt for the same intent', async () => {
    let attempts: Map<string, any> | undefined;
    const observe = (map: Map<string, any>) => { attempts = map; };
    const mapSet = Map.prototype.set;
    vi.spyOn(Map.prototype, 'set').mockImplementation(function (this: Map<any, any>, key: any, value: any) {
        if (value?.handle?.record?.v === 2 && Object.hasOwn(value, 'promise')) observe(this);
        return mapSet.call(this, key, value);
    });
    makeNative(); const handle = await admitted('REPLACEMENT');
    let releaseOld!: () => void, releaseNew!: () => void;
    heldWrites.set(handle.record.id, new Promise<void>(resolve => releaseOld = resolve));
    firebaseState.authGeneration++; makeNative(); vi.useFakeTimers();
    const old = resumePendingScanOperations();
    await vi.waitFor(() => expect(writesStarted).toHaveLength(1));
    await vi.advanceTimersByTimeAsync(DB_OP_TIMEOUT_MS + 1); await old;
    const oldAttempt = attempts?.get(handle.record.id);
    firebaseState.authGeneration++; makeNative();
    heldWrites.set(handle.record.id, new Promise<void>(resolve => releaseNew = resolve));
    const newer = resumePendingScanOperations();
    await vi.waitFor(() => expect(writesStarted).toHaveLength(2));
    const replacement = attempts?.get(handle.record.id);
    expect(replacement).not.toBe(oldAttempt);
    releaseOld();
    await oldAttempt.promise;
    expect(attempts?.get(handle.record.id)).toBe(replacement);
    expect(evidence()).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(DB_OP_TIMEOUT_MS + 1); await newer;
    await resumePendingScanOperations();
    expect(writesStarted).toHaveLength(2);
    releaseNew(); await replacement.promise;
    expect(attempts?.size).toBe(0);
    expect(evidence()).toHaveLength(0);
    expect(money()).toEqual([[10,0,1],[10,0,1]]);
});
