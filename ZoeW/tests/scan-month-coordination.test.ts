import { performance as realPerformance } from 'node:perf_hooks';
import { setTimeout as realDelay } from 'node:timers/promises';
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
import { claimScanOperation, resumePendingScanOperations, saveScanOperation } from '../src/services/scan-operation';
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
            if (ref.path === M) { monthStarts++; if (monthGate) await monthGate; if (monthFailure) { monthFailure=false; throw Object.assign(new Error("permission_denied"),{code:"PERMISSION_DENIED"}); } }
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

it('monthly reservations never overlap and retain four independent scan intents', async () => {
    makeNative();
    const handles=[];for(let i=0;i<4;i++)handles.push(await admitted('MONTH_FIFO_'+i));
    let release!:()=>void;monthGate=new Promise<void>(resolve=>release=resolve);
    const runs=handles.map((handle,i)=>saveScanOperation(handle,'091000000'+i,'N/A',0));
    await waitForRealCondition(()=>monthStarts>0,'first native monthly transaction');
    await flush();
    expect(monthStarts).toBe(1);
    monthGate=null;release();
    expect(await Promise.all(runs)).toEqual([true,true,true,true]);
    expect(money()).toEqual([[14,0,5],[14,0,5]]);
    expect(evidence()).toHaveLength(0);
});

it('one bounded budget removes queued work but retains a genuinely live native exclusion', async () => {
    makeNative();
    const first=await admitted('MONTH_HUNG_FIRST');const second=await admitted('MONTH_HUNG_WAIT');
    let release!:()=>void;monthGate=new Promise<void>(resolve=>release=resolve);
    vi.useFakeTimers();
    const a=saveScanOperation(first,'0910000001','N/A',0);const b=saveScanOperation(second,'0910000002','N/A',0);
    await waitForRealCondition(()=>monthStarts===1,'hung native reserve');
    await vi.advanceTimersByTimeAsync(DB_OP_TIMEOUT_MS);
    expect(await Promise.all([a,b])).toEqual(['unknown','unknown']);
    expect(monthStarts).toBe(1);expect(money()).toEqual([[10,0,1],[10,0,1]]);
    const third=await admitted('MONTH_HUNG_LATER');const c=saveScanOperation(third,'0910000003','N/A',0);
    await waitForRealCondition(()=>get('zoew_scan_operations/'+third.record.id)?.phase==='prepared','third prepared');
    await vi.advanceTimersByTimeAsync(DB_OP_TIMEOUT_MS);
    expect(await c).toBe('unknown');expect(monthStarts).toBe(1);
    monthGate=null;release();await vi.advanceTimersByTimeAsync(1);
    expect(monthStarts).toBe(1);expect(evidence()).toHaveLength(3);
    expect(Object.values(server[H])).toHaveLength(1);
    await resumePendingScanOperations();
    expect(money()).toEqual([[10,0,1],[10,0,1]]);
});

it('queued old-session mutations never dispatch after the active native call acknowledges', async () => {
    makeNative();const first=await admitted('MONTH_OLD_ACTIVE');const second=await admitted('MONTH_OLD_QUEUED');
    let release!:()=>void;monthGate=new Promise<void>(resolve=>release=resolve);
    const a=saveScanOperation(first,'0910000001','N/A',0);const b=saveScanOperation(second,'0910000002','N/A',0);
    await waitForRealCondition(()=>monthStarts===1,'old active reserve');await flush();
    firebaseState.authGeneration++;
    monthGate=null;release();
    expect(await Promise.all([a,b])).toEqual(['unknown','unknown']);
    expect(monthStarts).toBe(1);expect(money()).toEqual([[10,0,1],[10,0,1]]);
    expect(Object.values(server[H])).toHaveLength(1);
});

it('a new actual database progresses while an old database mutation remains unacknowledged', async () => {
    makeNative();const old=await admitted('MONTH_OLD_DB');let release!:()=>void;monthGate=new Promise<void>(resolve=>release=resolve);
    const oldRun=saveScanOperation(old,'0910000001','N/A',0);
    await waitForRealCondition(()=>monthStarts===1,'old db native reserve');
    monthGate=null;makeNative();
    const next=await admitted('MONTH_NEW_DB');expect(await saveScanOperation(next,'0910000002','N/A',0)).toBe(true);
    release();expect(await oldRun).toBe('unknown');
    expect(money()).toEqual([[11,0,2],[11,0,2]]);expect(monthStarts).toBe(2);
});

it('late committed ACK retains exclusion without double money and recovery uses the receipt', async () => {
    makeNative();const first=await admitted('MONTH_LATE_COMMIT');let release!:()=>void;
    heldAcks.set(first.record.id,new Promise<void>(resolve=>release=resolve));
    vi.useFakeTimers();
    const firstRun=saveScanOperation(first,'0910000001','N/A',0);
    await waitForRealCondition(()=>get('zoew_scan_operations/'+first.record.id)?.phase==='committed','actual committed server receipt');
    const second=await admitted('MONTH_AFTER_COMMIT');
    const secondRun=saveScanOperation(second,'0910000002','N/A',0);
    await waitForRealCondition(()=>get('zoew_scan_operations/'+second.record.id)?.phase==='prepared','queued second prepared');
    await vi.advanceTimersByTimeAsync(DB_OP_TIMEOUT_MS);
    expect(await secondRun).toBe('unknown');expect(monthStarts).toBe(1);
    expect(await firstRun).toBe(true);expect(money()).toEqual([[11,0,2],[11,0,2]]);
    release();await vi.advanceTimersByTimeAsync(1);expect(await firstRun).toBe(true);
    await resumePendingScanOperations();await resumePendingScanOperations();
    expect(money()).toEqual([[11,0,2],[11,0,2]]);
});

it('a wall-clock jump does not expire a still-timely queued mutation', async () => {
    makeNative();const first=await admitted('MONTH_CLOCK_FIRST');const second=await admitted('MONTH_CLOCK_SECOND');
    let release!:()=>void;monthGate=new Promise<void>(resolve=>release=resolve);
    const a=saveScanOperation(first,'0910000001','N/A',0);const b=saveScanOperation(second,'0910000002','N/A',0);
    await waitForRealCondition(()=>monthStarts===1,'clock first native reserve');await flush();
    vi.setSystemTime(NOW+86400000*10);monthGate=null;release();
    expect(await Promise.all([a,b])).toEqual([true,true]);expect(money()).toEqual([[12,0,3],[12,0,3]]);
});

it('a rejected native mutation releases exclusion for the healthy queued intent', async () => {
    makeNative();const first=await admitted('MONTH_REJECTED');const second=await admitted('MONTH_AFTER_REJECTION');
    let release!:()=>void;monthGate=new Promise<void>(resolve=>release=resolve);monthFailure=true;
    const a=saveScanOperation(first,'0910000001','N/A',0);const b=saveScanOperation(second,'0910000002','N/A',0);
    await waitForRealCondition(()=>monthStarts===1,'rejected native mutation entered');await flush();
    monthGate=null;release();
    expect(await a).toBe('unknown');expect(await b).toBe(true);expect(monthStarts).toBe(2);
    expect(money()).toEqual([[11,0,2],[11,0,2]]);
    expect(evidence().some(record=>record.id===first.record.id)).toBe(true);
});

it('a new session on the same database waits for the old native mutation to settle', async () => {
    makeNative();const old=await admitted('MONTH_OLD_SAME_DB');let release!:()=>void;
    monthGate=new Promise<void>(resolve=>release=resolve);const oldRun=saveScanOperation(old,'0910000001','N/A',0);
    await waitForRealCondition(()=>monthStarts===1,'old session native reserve');
    firebaseState.authGeneration++;const fresh=await admitted('MONTH_NEW_SAME_DB');
    const freshRun=saveScanOperation(fresh,'0910000002','N/A',0);await flush();expect(monthStarts).toBe(1);
    monthGate=null;release();expect(await oldRun).toBe('unknown');expect(await freshRun).toBe(true);
    expect(monthStarts).toBe(2);expect(money()).toEqual([[11,0,2],[11,0,2]]);
});
