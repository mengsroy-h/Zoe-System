import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { firebaseState, uiState } from '../src/core/state';
import { viewState } from '../src/core/view-state';
import { liveShopScope } from '../src/core/shop-scope';
import { barcodeRegistryKey } from '../src/domain/registry';
import { createScanEvidenceJournal } from '../src/services/scan-evidence';
import { pendingScanScope } from '../src/services/scan-pending';
import { resolveRetainedScanEvidence } from '../src/services/scan-operation';
import { withTransactionOutcomeResolution } from '../src/services/tx-outcome';

const HOST = 'https://scan-exit.firebaseio.com', NOW = Date.UTC(2026, 10, 3, 2), DAY = '2026-11-03';
const copy = <T,>(value: T): T => value === undefined ? value : JSON.parse(JSON.stringify(value));
let tree: Record<string, any> = {};
let held = new Set<string>();
const get = (path: string) => copy(path.split('/').filter(Boolean).reduce((node, key) => node?.[key], tree) ?? null);
const journal = (version: 1 | 2 = 2) => createScanEvidenceJournal(localStorage, version);
const payload = (barcode: string) => ({ barcode, createdAt: NOW, cod: 5, dod: 0, scanDate: DAY, mode: 'direct' });
const receiptOf = (record: any, phase: string) => ({ v: 2, id: record.id, actorUid: 'exit-owner', scope: liveShopScope(), code: record.barcode,
    registryKey: barcodeRegistryKey(record.barcode), birth: record.createdAt, scanDate: DAY, month: DAY.slice(0, 7), cod: 5, dod: 0, count: 1,
    monthToken: 'op_m' + record.id.slice(5), phase });

function connect() {
    const app = { options: { databaseURL: HOST } }, db = { app };
    const auth = { app, currentUser: { uid: 'exit-owner', getIdToken: async () => 'token' } };
    const reference = (path = '') => ({ path, key: path.split('/').at(-1) || null, toString: () => HOST + '/' + path });
    const snapshot = (ref: any) => { const value = get(ref.path); return { ref, key: ref.key, exists: () => value !== null, val: () => copy(value) }; };
    const write = vi.fn(async () => {});
    const raw = { getAuth: () => auth, getDatabase: () => db, deleteApp: async () => {}, ref: (_db: any, path = '') => reference(path),
        get: async (ref: any) => snapshot(ref), set: write, update: write, runTransaction: vi.fn(async (ref: any) => ({ committed: false, snapshot: snapshot(ref) })),
        onValue: () => () => {}, off: () => {} };
    const sdk = withTransactionOutcomeResolution(raw); sdk.getAuth(app); sdk.getDatabase(app);
    Object.assign(firebaseState, { firebaseConfig: app.options, fb: sdk, auth, db, isDatabaseInitialized: true, isInitializingFirebase: false,
        firebaseSdkUnavailable: false, isDatabaseConnected: true, serverClockTrusted: true, sessionExpiryCheck: 'live', authLoginOperation: null });
    firebaseState.authGeneration++;
    return { write, raw };
}

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] }); vi.setSystemTime(NOW);
    vi.stubGlobal('crypto', webcrypto);
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    localStorage.clear(); localStorage.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: HOST }));
    tree = {}; held = new Set(); uiState.toasts = []; viewState.scanEvidenceRetained = 0;
    vi.stubGlobal('fetch', vi.fn(async (url: any) => {
        const path = decodeURIComponent(new URL(String(url)).pathname).replace(/^\//, '').replace(/\.json$/, '');
        await new Promise(resolve => setTimeout(resolve, 6000));
        return Response.json(get(path));
    }));
    Object.defineProperty(navigator, 'locks', { configurable: true, value: { request: async (name: string, options: any, callback?: any) => {
        if (typeof options === 'function') { callback = options; options = {}; }
        return callback(held.has(name) && options.ifAvailable ? null : { name });
    } } });
    (window as any).ZoeErrors = { capture: vi.fn() };
});
afterEach(() => {
    vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers();
    delete (navigator as any).locks; delete (window as any).ZoeErrors;
    firebaseState.authGeneration++;
});


/**
 * ផ្លូវចេញរបស់ម្ចាស់ «🧾 បញ្ចប់ភស្តុតាងស្កេនរង់ចាំ» ៖ កំណត់ត្រានីមួយៗទទួលការសង្គ្រោះផ្ទាល់ខ្លួន (ពិដានផ្ទាល់ខ្លួន) ហើយទម្លាក់តែកំណត់ត្រា
 * ដែលការសង្គ្រោះពេញលេញបញ្ជាក់ថាជាប់ hold ពិត។ មុនកែ ៖ ការសង្គ្រោះតែមួយជុំ (ពិដាន ១៥ វិ.) រួចទម្លាក់អ្វីដែលនៅសល់ ➜ កំណត់ត្រាដែល Server
 * បញ្ជាក់លទ្ធផល (cancelled) តែមិនទាន់ដល់វេន ត្រូវទម្លាក់ (ការអានយឺត ៦ វិ.)។
 */
it('⛔ ការអានយឺត ៖ កំណត់ត្រាដែល Server បញ្ជាក់លទ្ធផល មិនត្រូវទម្លាក់ (បញ្ចប់ ឬរក្សាទុក)', async () => {
    connect();
    const scope = pendingScanScope();
    const ids: string[] = [];
    tree.zoew_scan_operations = {};
    for (const code of ['BUDGET000001', 'BUDGET000002', 'BUDGET000003', 'BUDGET000004', 'BUDGET000005']) {
        const record = journal().prepare(scope, payload(code)); journal().appendPhase(record, { phase: 'claim-pending' });
        tree.zoew_scan_operations[record.id] = receiptOf(record, 'cancelled'); ids.push(record.id);
    }
    vi.stubGlobal('confirm', () => true);
    const done = resolveRetainedScanEvidence();
    for (let i = 0; i < 20; i++) await vi.advanceTimersByTimeAsync(5000);
    await done;
    const dropped = (window as any).ZoeErrors.capture.mock.calls.filter((call: any[]) => call[1]?.context === 'resolveRetainedScanEvidence').map((call: any[]) => call[1]);
    expect(dropped.flatMap((d: any) => d.phases.split(' · ')).filter((p: string) => p.endsWith('/cancelled')), 'កំណត់ត្រាដែល receipt បញ្ជាក់លទ្ធផល មិនត្រូវទម្លាក់').toEqual([]);
});
