import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { dataState, firebaseState, scanState, uiState, ztoState } from '../../../../ZoeW/src/core/state';
import { viewState } from '../../../../ZoeW/src/core/view-state';
import { resetServerClock, pendingRegistryReleases } from '../../../../ZoeW/src/core/clock';
import { dbListenerFailedPaths, dbListenerPendingPaths } from '../../../../ZoeW/src/core/text';
import { getFormattedDate } from '../../../../ZoeW/src/core/timezone';
import { ledgerOpRing, ledgerTokenSeen } from '../../../../ZoeW/src/domain/ledger';
import { addOrUpdateEntry } from '../../../../ZoeW/src/features/scan-action';
import { clearZtoPickupStatusStore } from '../../../../ZoeW/src/features/zto-status';
import { createScanEvidenceJournal } from '../../../../ZoeW/src/services/scan-evidence';
import { pendingScanScope } from '../../../../ZoeW/src/services/scan-pending';
import { resolveRetainedScanEvidence, resumePendingScanOperations } from '../../../../ZoeW/src/services/scan-operation';
import { txResolvingPaths, withTransactionOutcomeResolution } from '../../../../ZoeW/src/services/tx-outcome';
import { nativeWriteRecoveryState } from '../../../../ZoeW/src/services/native-write-recovery';

/**
 * ស្កេន v2 ៖ commit ត្រូវការ token ខែ (`op_m…`) ក្នុង ring `ops` របស់ខែ (rules ពិនិត្យ root)។ ring រក្សាតែ LEDGER_OP_RING_MAX
 * អ្នកសរសេរចុងក្រោយ ➜ ស្កេន ឬ ledger write ១២ ផ្សេងទៀតក្នុងខែដដែល (ឧបករណ៍ផ្សេង · import ច្រើន lane) រុញ token ចេញ។
 * មុនកែ ៖ ជួរដែល stage រួច (scanPending) មិនដែល commit ឬ cancel បាន ➜ ប្រាក់មិនចូល ledger · registry ជាប់ · ជួរបដិសេធ
 * បិទ/ដក/លុប ជារៀងរហូត។ ឥឡូវ finalize រៀប month ឡើងវិញ (idempotent · តែក្នុងបង្អួច ៣ ខែចុងក្រោយ) មុន commit ហើយ receipt
 * prepared ➜ committed ការពារការបូកពីរដង។
 */

const H = 'zoew_scan_history_cod_dod';
const D = 'zoew_daily_revenue_cod_dod';
const M = 'zoew_monthly_revenue_cod_dod';
const R = 'zoew_barcode_registry';
const OPS = 'zoew_scan_operations';
const HOST = 'https://scan-finalize-month-ring.firebaseio.com';
const CODE = 'RINGSCAN0001';
const NOW = Date.UTC(2026, 9, 24, 2);
const copy = <T,>(value: T): T => value === undefined ? value : JSON.parse(JSON.stringify(value));
const parts = (path: string) => path.split('/').filter(Boolean);
let server: any;
let holdFinalize = false;
let heldFinalize: ((error: Error) => void)[] = [];
let finalizeAttempts = 0;
let refusedFinalize = 0;
let churnAfterStage = 0;
let churnSeq = 0;
let holdMonth: '' | 'after' | 'before' = '';
let heldMonth = 0;
let applications: { sdk: any; db: any; app: any }[] = [];
const day = () => getFormattedDate(new Date(NOW));
const month = () => day().slice(0, 7);
const get = (path: string) => copy(parts(path).reduce((node, key) => node?.[key], server) ?? null);
const money = () => [get(D + '/' + day()), get(M + '/' + month())]
    .map(row => [row?.codDollar ?? 0, row?.dodDollar ?? 0, row?.totalCount ?? 0]);
const evidence = () => ([1, 2] as const).flatMap(version => createScanEvidenceJournal(localStorage, version).list(pendingScanScope()));
const operation = () => Object.values(get(OPS) || {})[0] as any;
const holders = () => Object.values(get(H) || {}).filter((row: any) => Object.values(row.barcodes || {}).some((barcode: any) => barcode?.code === CODE)) as any[];
const flush = async () => { for (let n = 0; n < 25; n++) await new Promise(resolve => setTimeout(resolve, 0)); };

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

function churnMonthRing(count: number, key = month()) {
    for (let i = 0; i < count; i++) {
        const bucket = get(M + '/' + key);
        const token = 'op_churn' + String(++churnSeq).padStart(6, '0');
        put(M + '/' + key, { ...bucket, op: token, ops: ledgerOpRing(bucket, token) });
    }
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
        get: async (ref: any) => snapshot(ref, get(ref.path)),
        update: async (ref: any, updates: any) => {
            const writes = Object.entries(updates).map(([key, value]) => ({ path: [ref.path, key].filter(Boolean).join('/'), value: value as any }));
            const commit = writes.find(write => new RegExp('^' + OPS + '/[^/]+$').test(write.path) && write.value?.phase === 'committed');
            if (commit) {
                finalizeAttempts++;
                if (holdFinalize) return new Promise<void>((_resolve, reject) => { heldFinalize.push(reject); });
                const seq = get(M + '/' + commit.value.month + '/ops/' + commit.value.monthToken);
                if (!(typeof seq === 'number' && seq >= 1)) {
                    refusedFinalize++;
                    throw Object.assign(new Error('permission_denied'), { code: 'PERMISSION_DENIED' });
                }
            }
            for (const write of writes) put(write.path, write.value);
        },
        set: async (ref: any, value: any) => put(ref.path, value),
        runTransaction: async (ref: any, update: any) => {
            if (ref.path === M && holdMonth) {
                const next = update(copy(get(M)));
                if (holdMonth === 'after' && next !== undefined) put(M, next);
                holdMonth = ''; heldMonth++;
                return new Promise((_resolve, reject) => { heldFinalize.push(reject); });
            }
            const previous = get(ref.path);
            const next = update(copy(previous));
            if (next === undefined) return { committed: false, snapshot: snapshot(ref, previous) };
            put(ref.path, next);
            if (churnAfterStage && ref.path.startsWith(H + '/') && next?.scanPending) {
                const count = churnAfterStage; churnAfterStage = 0;
                churnMonthRing(count);
            }
            return { committed: true, snapshot: snapshot(ref, get(ref.path)) };
        },
        onValue: () => () => {},
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
    firebaseState.dbRefDailyCollected = sdk.ref(db, 'zoew_daily_collected_cod_dod');
    firebaseState.dbRefDailyPickup = sdk.ref(db, 'zoew_daily_pickup_cod_dod');
    const result = { sdk, db, app };
    applications.push(result);
    return result;
}

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(NOW);
    vi.stubGlobal('crypto', webcrypto);
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    localStorage.clear(); pendingRegistryReleases.clear(); clearZtoPickupStatusStore();
    dbListenerFailedPaths.clear(); dbListenerPendingPaths.clear(); txResolvingPaths.clear();
    localStorage.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: HOST }));
    holdFinalize = false; heldFinalize = []; finalizeAttempts = 0; refusedFinalize = 0; churnAfterStage = 0; churnSeq = 0; holdMonth = ''; heldMonth = 0; applications = [];
    const old = { id: 'existing-row', phone: '012000111', scanDate: day(), time: '09:00:00 (' + day() + ')',
        createdAt: NOW - 60000, count: 1, cod: 10, dod: 0, price: 10, isClosed: false, isCalled: false,
        barcode: 'EXISTING0001', barcodes: [{ code: 'EXISTING0001', cod: 10, dod: 0, createdAt: NOW - 60000,
            isClosed: false, isDeducted: false, isFromDeletion: false }] };
    server = { [H]: { [old.id]: old }, [D]: { [day()]: { codDollar: 10, dodDollar: 0, totalCount: 1 } },
        [M]: { [month()]: { codDollar: 10, dodDollar: 0, totalCount: 1 } }, [R]: { EXISTING0001: true } };
    dataState.scanHistory = [copy(old)]; dataState.deletedItems = [];
    dataState.dailyRevenueData = get(D); dataState.monthlyRevenueData = get(M);
    dataState.dailyCollectedData = {}; dataState.dailyPickupData = {};
    scanState.pendingBarcode = ''; scanState.pendingScanSession = null;
    viewState.phoneModalBusy = false; uiState.modalDisplay = {}; uiState.isModalOpen = false; uiState.toasts = [];
    ztoState.ztoListSyncInFlight = false; ztoState.ztoListSyncResult = null;
    firebaseState.authGeneration++;
    vi.stubGlobal('fetch', vi.fn(async (url: any) => {
        const path = decodeURIComponent(new URL(String(url)).pathname).replace(/^\//, '').replace(/\.json$/, '');
        return new Response(JSON.stringify(get(path)), { status: 200, headers: { 'content-type': 'application/json' } });
    }));
    (window as any).ZoeErrors = { capture: vi.fn() };
});

afterEach(async () => {
    firebaseState.authGeneration++;
    for (const reject of heldFinalize) reject(new Error('test finished'));
    heldFinalize = [];
    for (const app of applications) await app.sdk.deleteApp(app.app);
    vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers();
    delete (window as any).ZoeErrors;
});

async function crashAfterStage() {
    const first = makeNative();
    holdFinalize = true;
    void addOrUpdateEntry(CODE, '012345678', 5, 0, 'A', NOW, 0).catch(() => {});
    await vi.waitFor(() => expect(finalizeAttempts).toBe(1), { timeout: 2000 });
    await flush();
    expect(operation()?.phase, 'operation នៅ prepared ពេល App ត្រូវបិទ').toBe('prepared');
    expect(holders(), 'ជួរ stage រួចមាន scanPending').toHaveLength(1);
    expect(holders()[0].scanPending?.intent).toBe(operation().id);
    expect(money(), 'មុន commit ប្រាក់មិនទាន់ចូល ledger').toEqual([[10, 0, 1], [10, 0, 1]]);
    expect(evidence()).toHaveLength(1);
    await first.sdk.deleteApp(first.app);
    firebaseState.authGeneration++; txResolvingPaths.clear();
    holdFinalize = false;
}

async function reboot() {
    const second = makeNative();
    await second.sdk.retryWriteRecovery(second.db);
    dataState.scanHistory = Object.values(get(H));
    dataState.dailyRevenueData = get(D); dataState.monthlyRevenueData = get(M);
    return second;
}

it('reboot ក្រោយ ring ខែ churn ១២ ដង ៖ ស្កេនដែល stage រួចត្រូវ commit ម្ដង (មិនជាប់ HOLD ជារៀងរហូត)', async () => {
    await crashAfterStage();
    const token = operation().monthToken;
    churnMonthRing(12);
    expect(ledgerTokenSeen(get(M + '/' + month()), token), 'ring ១២ write ផ្សេងរុញ token ស្កេនចេញ').toBe(false);
    await reboot();
    await resumePendingScanOperations();
    await flush();
    expect(operation().phase).toBe('committed');
    expect(money(), 'ប្រាក់ និងចំនួនកញ្ចប់ចូល ledger ម្ដង').toEqual([[15, 0, 2], [15, 0, 2]]);
    expect(holders()).toHaveLength(1);
    expect(holders()[0].scanPending, 'ជួរលែងជាប់ scanPending').toBeUndefined();
    expect(get(R + '/' + CODE)).toEqual(expect.objectContaining({ v: 2, intent: operation().id, actorUid: 'scan-owner', birth: NOW }));
    expect(evidence(), 'ភស្តុតាងបញ្ចប់ក្រោយ receipt committed').toEqual([]);
    const settled = copy(server);
    await resumePendingScanOperations();
    await flush();
    expect(server, 'ការស្តារម្ដងទៀតមិនបូកប្រាក់ ឬសរសេរ ring ម្ដងទៀត').toEqual(settled);
});

it('live save ៖ ring churn ចន្លោះ stage និង finalize ➜ save ចប់ដោយបូកប្រាក់ម្ដង', async () => {
    makeNative();
    churnAfterStage = 12;
    const result = await addOrUpdateEntry(CODE, '012345678', 5, 0, 'A', NOW, 0);
    expect(churnAfterStage, 'ring ត្រូវបាន churn ក្រោយ stage ពិត').toBe(0);
    expect(result).toBe(true);
    expect(operation().phase).toBe('committed');
    expect(refusedFinalize, 'finalize មិនផ្ញើ commit ដែល rules បដិសេធ').toBe(0);
    expect(money()).toEqual([[15, 0, 2], [15, 0, 2]]);
    expect(holders()).toHaveLength(1);
    expect(holders()[0].scanPending).toBeUndefined();
    expect(evidence()).toEqual([]);
});

it('control ៖ ខែចេញក្រៅបង្អួច ៣ ខែចុងក្រោយ ➜ មិនរៀបខែឡើងវិញ មិនបូកប្រាក់ ភស្តុតាងនៅ HOLD', async () => {
    await crashAfterStage();
    churnMonthRing(12);
    for (const later of ['2026-11', '2026-12', '2027-01']) put(M + '/' + later, { codDollar: 1, dodDollar: 0, totalCount: 1 });
    await reboot();
    const before = copy(server);
    await resumePendingScanOperations();
    await flush();
    expect(server, 'ខែចាស់មិនត្រូវបង្កើត witness ឬបូកប្រាក់ ហើយខែថ្មីមិនប៉ះ').toEqual(before);
    expect(operation().phase).toBe('prepared');
    expect(evidence()).toHaveLength(1);
});

const journalKeys = () => Object.keys(localStorage).filter(key => key.startsWith('zoew_connection_writes_v1:'));

it.each(['after', 'before'] as const)('Firebase parity (A498) ៖ App ត្រូវបិទពេល CAS token ខែ (root ខែទាំងមូល · គ្មាន intent) កំពុងរង់ចាំចម្លើយ (ចុះ ៖ %s) ➜ boot សម្រេចតាមតម្លៃ ហើយទម្លាក់ជួរ (មិន block) ➜ ស្កេន commit ម្ដង', async (landed) => {
    await crashAfterStage();
    churnMonthRing(12);
    const second = await reboot();
    holdMonth = landed;
    void resumePendingScanOperations();
    await vi.waitFor(() => expect(heldMonth).toBe(1), { timeout: 2000 });
    await flush();
    const crashed = journalKeys().map(key => [key, localStorage.getItem(key)!] as const);
    const monthRows = crashed.map(([, text]) => JSON.parse(text)).filter(row => row.ops?.[0]?.p?.join('/') === M);
    expect(monthRows, 'ជួរ CAS token ខែពិតនៅក្នុង journal Firebase ពេល App ត្រូវបិទ').toHaveLength(1);
    expect(monthRows[0].intent, 'CAS token ខែគ្មាន connectionIntent').toBeUndefined();
    expect(Object.values(monthRows[0].ops[0].v).some((record: any) => typeof record?.op === 'string'), 'token នៅក្រោមកូនសោខែ').toBe(true);
    expect(ledgerTokenSeen(get(M + '/' + month()), operation().monthToken)).toBe(landed === 'after');
    await second.sdk.deleteApp(second.app);
    firebaseState.authGeneration++; txResolvingPaths.clear();
    for (const [key, text] of crashed) localStorage.setItem(key, text);
    const third = await reboot();
    expect({ blocked: nativeWriteRecoveryState(third.db).blocked, rows: journalKeys().length }).toEqual({ blocked: 0, rows: 0 });
    await resumePendingScanOperations();
    await flush();
    expect(operation().phase).toBe('committed');
    expect(money(), 'ប្រាក់ និងចំនួនកញ្ចប់ចូល ledger ម្ដង ទោះ CAS ដែលបាត់ចម្លើយបានចុះ ឬមិនបានចុះ').toEqual([[15, 0, 2], [15, 0, 2]]);
    expect(evidence()).toEqual([]);
});


it.each(['untrusted', 'replaced-during-read'] as const)('[audit-recovery-clock] %s៖ រក្សា staged scan ហើយបន្តក្រោយ clock ថ្មី', async mode => {
    await crashAfterStage();
    churnMonthRing(12);
    await reboot();
    const before = copy(server);
    const token = operation().monthToken;
    let invalidated = false;
    const fetchBefore = globalThis.fetch;
    if (mode === 'untrusted') firebaseState.serverClockTrusted = false;
    else vi.stubGlobal('fetch', async (...args: Parameters<typeof fetch>) => {
        const result = await fetchBefore(...args);
        if (!invalidated) {
            invalidated = true;
            resetServerClock();
            firebaseState.serverClockTrusted = true;
        }
        return result;
    });
    await resumePendingScanOperations(); await flush();
    expect(mode === 'untrusted' || invalidated).toBe(true);
    expect(server).toEqual(before);
    expect(operation().phase).toBe('prepared');
    expect(ledgerTokenSeen(get(M + '/' + month()), token)).toBe(false);
    expect(evidence()).toHaveLength(1);
    firebaseState.serverClockTrusted = true;
    vi.stubGlobal('fetch', fetchBefore);
    await resumePendingScanOperations(); await flush();
    expect(operation().phase).toBe('committed');
    expect(money()).toEqual([[15, 0, 2], [15, 0, 2]]);
    expect(holders()[0].scanPending).toBeUndefined();
    expect(evidence()).toEqual([]);
    const settled = copy(server);
    await resumePendingScanOperations(); await flush();
    expect(server).toEqual(settled);
});

it('[audit-recovery-clock] ផ្លូវម្ចាស់បញ្ចប់ staged scan ដោយ receipt មិនទម្លាក់ evidence មុន commit', async () => {
    await crashAfterStage(); churnMonthRing(12); await reboot();
    const result = await resolveRetainedScanEvidence();
    expect(result).toMatchObject({ finished: 1, dropped: 0, kept: 0 });
    expect(operation().phase).toBe('committed');
    expect(money()).toEqual([[15, 0, 2], [15, 0, 2]]);
    expect(holders()[0].scanPending).toBeUndefined();
    expect(evidence()).toEqual([]);
});
