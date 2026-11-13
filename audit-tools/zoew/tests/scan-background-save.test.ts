import { performance as realPerformance } from 'node:perf_hooks';
import { setTimeout as realDelay } from 'node:timers/promises';
import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { refTo, setFieldValue } from '../../../ZoeW/src/app/refs';
import { confirmPhone, triggerScanAction } from '../../../ZoeW/src/features/scan-action';
import { dataState, firebaseState, scanState, uiState, ztoState } from '../../../ZoeW/src/core/state';
import { viewState } from '../../../ZoeW/src/core/view-state';
import { pendingRegistryReleases } from '../../../ZoeW/src/core/clock';
import { dbListenerFailedPaths, dbListenerPendingPaths } from '../../../ZoeW/src/core/text';
import { getFormattedDate } from '../../../ZoeW/src/core/timezone';
import { clearZtoPickupStatusStore } from '../../../ZoeW/src/features/zto-status';
import { createScanEvidenceJournal } from '../../../ZoeW/src/services/scan-evidence';
import { pendingScanScope } from '../../../ZoeW/src/services/scan-pending';
import { txResolvingPaths, withTransactionOutcomeResolution } from '../../../ZoeW/src/services/tx-outcome';

const H = 'zoew_scan_history_cod_dod';
const D = 'zoew_daily_revenue_cod_dod';
const M = 'zoew_monthly_revenue_cod_dod';
const R = 'zoew_barcode_registry';
const HOST = 'https://scan-background-save.firebaseio.com';
const NOW = Date.UTC(2026, 9, 24, 2);
const fields = ['modalPhoneInput', 'modalLockerInput', 'modalCodInput', 'modalDodInput'] as const;
const copy = <T,>(value: T): T => value === undefined ? value : JSON.parse(JSON.stringify(value));
const parts = (path: string) => path.split('/').filter(Boolean);
let server: any;
let monthGate: null | Promise<void> = null;
const historyGates = new Map<string, { reached: boolean; wait: Promise<void>; release: () => void }>();
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
            if (ref.path.startsWith(H + '/')) {
                const pending = copy(get(ref.path));
                const staged = update(copy(pending));
                const gate = staged && historyGates.get(staged.phone);
                if (gate) { gate.reached = true; await gate.wait; }
            }
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
        serverClockTrusted: true, sessionExpiryCheck: 'live', authLoginOperation: null, dbLivenessProbe: Promise.resolve(null) });
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
    monthGate=null; monthStarts=0; monthFailure=false; historyGates.clear();
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




const DOC = `/**
 * A527 · ជម្រើស (ក) របស់ម្ចាស់ ៖ ប្រអប់ស្កេនបិទភ្លាមក្រោយ registry claim ('claimed') និងភស្តុតាងស្កេន durable ('claimed') ➜
 * protocol ស្កេន v2 (prepare · stage ជួរ · finalize ledger) បន្តក្នុង background · ✅ តែក្រោយ commit ·
 * ស្កេនអតិថិជនដដែល (លេខ · ថ្ងៃ) ជាប់គ្នាត្រូវរង់ចាំការរក្សាទុកមុន ➜ ចូលជួរតែមួយ (មិនបោះបង់ មិនបង្កើតជួរទីពីរ) ·
 * អតិថិជនផ្សេងគ្នាមិនរង់ចាំគ្នា។
 */`;
void DOC;

function gate(phone: string) {
    let release!: () => void;
    const entry = { reached: false, wait: new Promise<void>(resolve => release = resolve), release: () => release() };
    historyGates.set(phone, entry);
    return entry;
}

function scan(code: string, phone: string, cod: number) {
    triggerScanAction(code);
    expect(uiState.isModalOpen).toBe(true); expect(scanState.pendingBarcode).toBe(code);
    setFieldValue('modalPhoneInput', phone); setFieldValue('modalCodInput', String(cod)); setFieldValue('modalDodInput', '0');
    return confirmPhone();
}

const rowsOf = (phone: string) => Object.values(server[H] || {}).filter((row: any) => row.phone === phone) as any[];
const toastTexts = () => uiState.toasts.map((toast: any) => String(toast.msg ?? toast));

it('closes the scan modal and frees the next scan after the claim while the save continues; ✅ only after commit', async () => {
    makeNative();
    const held = gate('0911111111');
    const running = scan('BGSAVE0001', '0911111111', 3);
    await waitForRealCondition(() => held.reached, 'history staging reached');
    expect(uiState.isModalOpen).toBe(false);
    expect(viewState.phoneModalBusy).toBe(false);
    expect(scanState.pendingBarcode).toBe('');
    expect(toastTexts().some(text => text.includes('រក្សាទុកបានជោគជ័យ'))).toBe(false);
    expect(evidence().map(record => record.barcode)).toEqual(['BGSAVE0001']);
    expect(get(R + '/BGSAVE0001')).toEqual(expect.objectContaining({ v: 2 }));
    held.release();
    await running;
    expect(rowsOf('0911111111')).toHaveLength(1);
    expect(rowsOf('0911111111')[0].barcodes.map((b: any) => b.code)).toEqual(['BGSAVE0001']);
    expect(money()).toEqual([[13, 0, 2], [13, 0, 2]]);
    expect(evidence()).toHaveLength(0);
    expect(monthStarts).toBe(1);
    expect(toastTexts().some(text => text.includes('✅ (BGSAVE0001) រក្សាទុកបានជោគជ័យ!'))).toBe(true);
});

it('two quick scans of one customer wait for each other and merge into one row (never cancelled, never a second row)', async () => {
    makeNative();
    const held = gate('0922222222');
    const first = scan('BGSAME0001', '0922222222', 1);
    await waitForRealCondition(() => held.reached, 'first staging reached');
    historyGates.delete('0922222222');
    const second = scan('BGSAME0002', '0922222222', 2);
    await flush();
    expect(uiState.isModalOpen).toBe(false);
    expect(evidence().map(record => record.barcode).sort()).toEqual(['BGSAME0001', 'BGSAME0002']);
    held.release();
    await Promise.all([first, second]);
    const rows = rowsOf('0922222222');
    expect(rows).toHaveLength(1);
    expect(rows[0].barcodes.map((b: any) => b.code).sort()).toEqual(['BGSAME0001', 'BGSAME0002']);
    expect(rows[0].count).toBe(2);
    expect(money()).toEqual([[13, 0, 3], [13, 0, 3]]);
    expect(evidence()).toHaveLength(0);
    expect(toastTexts().some(text => text.includes('មិនបានរក្សាទុក'))).toBe(false);
});

it('scans of different customers do not wait for one another', async () => {
    makeNative();
    const held = gate('0933333333');
    const slow = scan('BGDIFF0001', '0933333333', 1);
    await waitForRealCondition(() => held.reached, 'slow customer staging reached');
    await scan('BGDIFF0002', '0944444444', 2);
    expect(rowsOf('0944444444')).toHaveLength(1);
    expect(rowsOf('0933333333')).toHaveLength(0);
    held.release();
    await slow;
    expect(rowsOf('0933333333')).toHaveLength(1);
    expect(money()).toEqual([[13, 0, 3], [13, 0, 3]]);
    expect(evidence()).toHaveLength(0);
});
