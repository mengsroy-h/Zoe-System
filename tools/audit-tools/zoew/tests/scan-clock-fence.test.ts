import { performance as realPerformance } from 'node:perf_hooks';
import { setTimeout as realDelay } from 'node:timers/promises';
import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { refTo } from '../../../../ZoeW/src/app/refs';
import { dataState, firebaseState, scanState, uiState, ztoState } from '../../../../ZoeW/src/core/state';
import { viewState } from '../../../../ZoeW/src/core/view-state';
import { pendingRegistryReleases } from '../../../../ZoeW/src/core/clock';
import { dbListenerFailedPaths, dbListenerPendingPaths } from '../../../../ZoeW/src/core/text';
import { getFormattedDate } from '../../../../ZoeW/src/core/timezone';
import { clearZtoPickupStatusStore } from '../../../../ZoeW/src/features/zto-status';
import { createScanEvidenceJournal } from '../../../../ZoeW/src/services/scan-evidence';
import { pendingScanScope, preparePendingScan } from '../../../../ZoeW/src/services/scan-pending';
import { claimScanOperation, resumePendingScanOperations, saveScanOperation } from '../../../../ZoeW/src/services/scan-operation';
import { txResolvingPaths, withTransactionOutcomeResolution } from '../../../../ZoeW/src/services/tx-outcome';

const clock = vi.hoisted(() => ({ generation: 0, trusted: true }));
vi.mock('../../../../ZoeW/src/core/clock', async load => ({ ...await load<any>(),
    captureClockOperation: () => { const generation = clock.generation, admitted = clock.trusted; return { current: () => admitted && clock.trusted && generation === clock.generation }; },
    serverClockIsTrustworthy: () => clock.trusted
}));

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
let readGate: Promise<void> | null = null;
let readEntered = false;
let transactionPath = '';
let transactionGate: Promise<void> | null = null;
let transactionEntered = false;
let monthGate: null | Promise<void> = null;
let monthStarts = 0;
let monthFailure = false;
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
            if (readGate) { readEntered = true; await readGate; }
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
            if (ref.path === M) { monthStarts++; if (monthGate) await monthGate; if (monthFailure) { monthFailure=false; throw Object.assign(new Error("permission_denied"),{code:"PERMISSION_DENIED"}); } }
            if (ref.path === transactionPath && transactionGate) { transactionEntered = true; await transactionGate; }
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
    clock.generation++; clock.trusted = true;
    readGate = null; readEntered = false;
    transactionPath = ''; transactionGate = null; transactionEntered = false;
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(NOW);
    vi.stubGlobal('crypto', webcrypto);
    vi.stubGlobal('confirm', () => true);
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    localStorage.clear(); pendingRegistryReleases.clear(); clearZtoPickupStatusStore();
    dbListenerFailedPaths.clear(); dbListenerPendingPaths.clear();
    txResolvingPaths.clear();
    localStorage.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: HOST }));
    heldWrites.clear(); heldAcks.clear(); writesStarted.length = 0; listeners.clear();
    monthGate=null; monthStarts=0; monthFailure=false;
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
        if (readGate) { readEntered = true; await readGate; }
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

it('refuses an uncertain new scan before creating durable evidence', () => {
    makeNative(); clock.trusted = false;
    expect(() => preparePendingScan('CLOCK_NEW', 1, 0, 0, 'direct', 2)).toThrow();
    expect(evidence()).toHaveLength(0);
});

it('a pending monthly updater cannot stage a stale operation after trust recovers', async () => {
    makeNative();
    const handle = await admitted('CLOCK_WAIT');
    let release!: () => void; monthGate = new Promise<void>(resolve => release = resolve);
    const save = saveScanOperation(handle, '0910000001', 'N/A', 0);
    await waitForRealCondition(() => monthStarts === 1, 'monthly updater waiting');
    clock.generation++; clock.trusted = true;
    monthGate = null; release();
    expect(await save).toBe('unknown');
    expect(Object.values(get(H)).some((row: any) => row.barcodes?.some((b: any) => b.code === 'CLOCK_WAIT'))).toBe(false);
    expect(money()).toEqual([[10, 0, 1], [10, 0, 1]]);
    expect(evidence()).toHaveLength(1);
    // The owner and evidence remain usable to establish cancellation; invalidation is not success.
    await resumePendingScanOperations();
    expect(get('zoew_scan_operations/' + handle.record.id)?.phase).toBe('cancelled');
    expect(evidence()).toHaveLength(0);
});

it.each(['registry', 'prepared', 'history'])('invalidates a speculative %s updater without discarding evidence', async (boundary) => {
    makeNative();
    const code = 'CLOCK_RETRY_' + boundary.toUpperCase();
    const handle = preparePendingScan(code, 1, 0, NOW, 'direct', 2);
    if (boundary !== 'registry') expect(await claimScanOperation(handle, code)).toBe('claimed');
    transactionPath = boundary === 'registry' ? R + '/' + code : 'zoew_scan_operations/' + handle.record.id;
    // History target is chosen during preparation, so capture its path from the prepared receipt.
    if (boundary === 'history') {
        let release!: () => void; monthGate = new Promise<void>(resolve => release = resolve);
        const save = saveScanOperation(handle, '012000111', 'N/A', 0);
        await waitForRealCondition(() => monthStarts === 1, 'prepared receipt');
        transactionPath = H + '/' + get('zoew_scan_operations/' + handle.record.id).targetId;
        let transactionRelease!: () => void;
        transactionGate = new Promise<void>(resolve => transactionRelease = resolve);
        monthGate = null; release();
        await waitForRealCondition(() => transactionEntered, 'history updater');
        clock.generation++; transactionRelease();
        expect(await save).toBe('unknown');
    } else {
        let release!: () => void; transactionGate = new Promise<void>(resolve => release = resolve);
        const result = boundary === 'registry' ? claimScanOperation(handle, code) : saveScanOperation(handle, '0910000001', 'N/A', 0);
        await waitForRealCondition(() => transactionEntered, boundary + ' updater');
        clock.generation++; release();
        expect(await result).toBe('unknown');
    }
    expect(Object.values(get(H)).some((row: any) => row.barcodes?.some((b: any) => b.code === code))).toBe(false);
    if (boundary === 'history') {
        expect(get('zoew_scan_operations/' + handle.record.id)?.phase).toBe('cancelled');
        expect(evidence()).toHaveLength(0);
    } else expect(evidence()).toHaveLength(1);
});

it('a read resolving after invalidation cannot admit the captured timestamp', async () => {
    makeNative();
    const handle = preparePendingScan('CLOCK_READ', 1, 0, NOW, 'direct', 2);
    let release!: () => void; readGate = new Promise<void>(resolve => release = resolve);
    const claim = claimScanOperation(handle, handle.record.barcode);
    await waitForRealCondition(() => readEntered, 'admission read');
    clock.generation++; readGate = null; release();
    expect(await claim).toBe('unknown');
    expect(get('zoew_scan_operations/' + handle.record.id)).toBeNull();
    expect(evidence()).toHaveLength(1);
});

it('ការបដិសេធ clock ប្រាប់មូលហេតុត្រឹមត្រូវ មិនបន្ទោសទំហំផ្ទុក', async () => {
    const { scanEvidenceRefusalText } = await import('../../../../ZoeW/src/services/scan-pending');
    const message = scanEvidenceRefusalText({ code: 'clock_uncertain' });
    expect(message).toContain('នាឡិកា');
    expect(message).not.toContain('ទំហំផ្ទុក');
});
