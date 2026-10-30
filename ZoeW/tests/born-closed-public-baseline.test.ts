import { webcrypto } from 'node:crypto';
import { afterEach, expect, it, vi } from 'vitest';
import { dataState, firebaseState, uiState, ztoState } from '../src/core/state';
import * as clock from '../src/core/clock';
import { dbListenerFailedPaths, dbListenerPendingPaths } from '../src/core/text';
import { importZtoListRows } from '../src/features/zto-list-sync';
import { clearZtoPickupStatusStore, loadZtoPickupStatusOnce, getZtoPickupVerdict, ztoVerdictCandidate, ztoPickupStatus } from '../src/features/zto-status';
import { withTransactionOutcomeResolution } from '../src/services/tx-outcome';

const H = 'zoew_scan_history_cod_dod', D = 'zoew_daily_revenue_cod_dod', M = 'zoew_monthly_revenue_cod_dod';
const P = 'zoew_daily_pickup_cod_dod', C = 'zoew_daily_collected_cod_dod';
const HOST = 'https://born-closed-baseline.firebaseio.com', DAY = '2026-10-30', NOW = Date.UTC(2026, 9, 30, 2), CODE = 'BORNBASE0001';
const copy = <T,>(value: T): T => value === undefined ? value : JSON.parse(JSON.stringify(value));
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); delete (window as any).ZoeErrors; });

it('ផ្លូវ import born-closed ពិត៖ វាស់ pickup មុននិងក្រោយ audit ដោយ fixture ដូចគ្នា', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(NOW); vi.spyOn(clock, 'getServerNow').mockReturnValue(NOW);
    vi.stubGlobal('crypto', webcrypto); vi.stubGlobal('confirm', () => true);
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    localStorage.clear(); localStorage.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: HOST }));
    clearZtoPickupStatusStore(); dbListenerFailedPaths.clear(); dbListenerPendingPaths.clear();
    const tree: Record<string, any> = {};
    const get = (path: string) => copy(path.split('/').filter(Boolean).reduce((node, key) => node?.[key], tree) ?? null);
    const put = (path: string, value: any) => {
        const keys = path.split('/').filter(Boolean), last = keys.pop()!; let node = tree;
        for (const key of keys) node = node[key] ||= {};
        if (value === null) delete node[last];
        else if (typeof value?.['.sv']?.increment === 'number') node[last] = (Number(node[last]) || 0) + value['.sv'].increment;
        else if (value?.['.sv'] === 'timestamp') node[last] = NOW;
        else node[last] = copy(value);
    };
    const reference = (path = '') => ({ path, key: path.split('/').at(-1) || null, toString: () => HOST + '/' + path });
    const snapshot = (ref: any) => ({ ref, key: ref.key, exists: () => get(ref.path) !== null, val: () => get(ref.path) });
    const app = { options: { databaseURL: HOST } }, db = { app };
    const auth = { app, currentUser: { uid: 'born-user', getIdToken: async () => 'fixture-token' } };
    const raw = { getAuth: () => auth, getDatabase: () => db, deleteApp: async () => {}, ref: (_db: any, path = '') => reference(path),
        increment: (amount: number) => ({ '.sv': { increment: amount } }), get: async (ref: any) => snapshot(ref),
        set: async (ref: any, value: any) => put(ref.path, value),
        update: async (ref: any, patch: any) => { for (const [key, value] of Object.entries(patch)) put([ref.path, key].filter(Boolean).join('/'), value); },
        runTransaction: async (ref: any, update: any) => {
            const next = update(get(ref.path)); if (next === undefined) return { committed: false, snapshot: snapshot(ref) };
            put(ref.path, next); return { committed: true, snapshot: snapshot(ref) };
        }, onValue: () => () => {}, off: () => {} };
    vi.stubGlobal('fetch', async (url: any) => Response.json(get(decodeURIComponent(new URL(String(url)).pathname).replace(/^\//, '').replace(/\.json$/, ''))));
    (window as any).ZoeErrors = { capture: vi.fn() };
    const sdk = withTransactionOutcomeResolution(raw); sdk.getAuth(app); sdk.getDatabase(app);
    Object.assign(firebaseState, { firebaseConfig: app.options, fb: sdk, auth, db, isDatabaseInitialized: true,
        isInitializingFirebase: false, firebaseSdkUnavailable: false, isDatabaseConnected: true, sessionExpiryCheck: 'live', authLoginOperation: null });
    firebaseState.authGeneration++;
    for (const [field, path] of Object.entries({ dbRefHistory: H, dbRefDailyRevenue: D, dbRefMonthlyRevenue: M, dbRefDailyPickup: P, dbRefDailyCollected: C })) (firebaseState as any)[field] = sdk.ref(db, path);
    dataState.scanHistory = []; dataState.deletedItems = []; dataState.dailyRevenueData = {}; dataState.monthlyRevenueData = {};
    dataState.dailyPickupData = {}; dataState.dailyCollectedData = {}; uiState.toasts = [];
    ztoState.ztoListSyncInFlight = false;
    ztoState.ztoListSyncResult = { verifiedAt: NOW, verifiedServerAt: NOW, rows: [{ barcode: CODE, phone: '012999888', cod: 5, dod: 0, at: '2026-10-30 09:00:00',
        ztoClosed: true, skip: '', from: 'fixture' }], signedRows: [], from: DAY, to: DAY, total: 1 } as any;
    try {
        await importZtoListRows();
        const item: any = Object.values(get(H) || {}).find((row: any) => Object.values(row.barcodes || {}).some((barcode: any) => barcode.code === CODE));
        const barcode: any = Object.values(item?.barcodes || {}).find((row: any) => row.code === CODE);
        expect(barcode?.isClosed).toBe(true);
        expect(get(D + '/' + DAY)).toEqual(expect.objectContaining({ codDollar: 5, dodDollar: 0, totalCount: 1 }));
        expect(get(M + '/2026-10')).toEqual(expect.objectContaining({ codDollar: 5, dodDollar: 0, totalCount: 1 }));
        ztoPickupStatus.clear(); ztoState.ztoStatusLoaded = false; loadZtoPickupStatusOnce();
        const proof = { pickup: get(P), collected: get(C), verdict: getZtoPickupVerdict(CODE, ztoVerdictCandidate(item, barcode)), cod: get(D + '/' + DAY)?.codDollar, count: get(D + '/' + DAY)?.totalCount };
        console.log('BORN_CLOSED_BASELINE', JSON.stringify(proof));
        expect(get(P + '/' + DAY)?.packagesPickedUp || 0).toBe(0);
        expect(getZtoPickupVerdict(CODE, ztoVerdictCandidate(item, barcode))?.closed).toBe(true);
        expect(ztoPickupStatus.get(CODE)).toBeUndefined();
    } finally { await sdk.deleteApp(app); firebaseState.authGeneration++; }
}, 15000);
