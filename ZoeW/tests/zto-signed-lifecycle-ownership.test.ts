// សាកល្បង read-only លើ source ពិត៖ បញ្ជី Sign មុនស្តារ មិនត្រូវជាន់ភស្តុតាងផ្ទៀងស្តារថ្មី។
// ក្លែងតែ upstream និង SDK data semantics; Delete និង Restore ប្រើផ្លូវពិត។
import { it, expect, vi, afterEach } from 'vitest';
import { webcrypto } from 'node:crypto';
import { createScanMemorySdk } from './helpers/scan-memory-sdk';
import { dataState, firebaseState, uiState, ztoState } from '../src/core/state';
import { appLocalStore } from '../src/core/storage';
import { dbListenerFailedPaths, dbListenerPendingPaths } from '../src/core/text';
import { clearCustomerDataTableCache } from '../src/features/customer-table';
import { clearZtoPickupStatusStore, runZtoStatusSweep, collectOpenBarcodesForZtoStatus, closeZtoSignedBarcodes, setZtoPickupVerdict, ztoPickupStatus } from '../src/features/zto-status';
import { deleteSingleItem } from '../src/features/entry-ops';
import { executeRestoreItem } from '../src/features/restore';
import { trashRestoreBlockOf } from '../src/features/zto-final-marks';
const lane = vi.hoisted(() => ({ started: null as any, resume: null as any, gate: null as any }));
vi.mock('../src/services/zto-sweep-lane', async (importOriginal) => {
    const actual = await importOriginal<any>();
    return { ...actual, ztoSweepLaneTurn: () => ({mode:'claim',waitMs:1}),
        claimZtoSweepLane: async () => { lane.started(); return await lane.gate; } };
});
vi.mock('../src/services/tx-outcome', async (importOriginal) => {
    const actual = await importOriginal<any>();
    return { ...actual, txRestUrl: () => null,
        txReadServerValue: () => { throw new Error('ការសាកនេះមិនអនុញ្ញាត provider REST read'); },
        withTransactionOutcomeResolution: () => { throw new Error('ការសាកនេះមិនអនុញ្ញាត protected wrapper'); } };
});
const NOW = Date.UTC(2026, 9, 31, 4), H = 'zoew_scan_history_cod_dod', T = 'zoew_recently_deleted_cod_dod';
afterEach(() => { clearZtoPickupStatusStore(); vi.useRealTimers(); vi.unstubAllGlobals(); });
it.each(['firebase', 'supabase'].flatMap((provider) => ['unchanged', 'open-restored', 'metadata', 'newer-verdict', 'stale-newer', 'stale-moved', 'duplicate', 'session'].map((mode) => [provider, mode])))('វគ្គ Cookie ពិត ខណៈបញ្ជី Sign យឺត៖ %s %s', async (provider, mode) => {
    vi.stubGlobal('crypto', webcrypto);
    vi.stubGlobal('confirm', () => true);
    vi.stubGlobal('alert', () => { });
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    appLocalStore.clear();
    const options = provider === 'firebase' ? { databaseURL: 'https://audit.firebaseio.com' } : { supabaseUrl: 'https://audit.invalid' };
    const scope = provider === 'firebase' ? 'https://audit.firebaseio.com' : 'https://audit.invalid#tenant-a';
    appLocalStore.setItem('zoew_firebase_config', JSON.stringify(options));
    appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify({ enabled: true, fastMode: true, url: window.location.origin + '/.netlify/functions/zto-order-detail?barcode={barcode}' }));
    clearCustomerDataTableCache();
    clearZtoPickupStatusStore();
    dbListenerPendingPaths.clear();
    dbListenerFailedPaths.clear();
    const mem = createScanMemorySdk();
    if (provider === 'supabase') (mem.sdk as any).tenantScope = () => 'tenant-a';
    firebaseState.auth = { currentUser: { uid: 'test' }, app: { options } } as any;
    firebaseState.db = { name: 'test', app: { options } } as any;
    firebaseState.fb = mem.sdk as any;
    firebaseState.serverTimeOffsetMs = 0;
    firebaseState.serverClockTrusted = true;
    firebaseState.isDatabaseConnected = true;
    firebaseState.isDatabaseInitialized = true;
    firebaseState.isInitializingFirebase = false;
    for (const [key, path] of Object.entries({ dbRefHistory: H, dbRefDeleted: T, dbRefDailyRevenue: 'zoew_daily_revenue_cod_dod', dbRefMonthlyRevenue: 'zoew_monthly_revenue_cod_dod', dbRefDailyPickup: 'zoew_daily_pickup_cod_dod', dbRefDailyCollected: 'zoew_daily_collected_cod_dod', dbRefRegistry: 'zoew_barcode_registry' }))
        (firebaseState as any)[key] = mem.sdk.ref(firebaseState.db, path);
    ztoState.ztoTrashMode = { state: 'ok', palmAt: 0, cookieAt: NOW, shop: scope } as any;
    uiState.isModalOpen = false;
    uiState.toasts = [];
    dataState.deletedItems = [];
    dataState.dailyPickupData = {};
    dataState.dailyCollectedData = {};
    dataState.dailyRevenueData = { '2026-10-31': { codDollar: 5, dodDollar: 0, totalCount: 1 } } as any;
    dataState.monthlyRevenueData = { '2026-10': { codDollar: 5, dodDollar: 0, totalCount: 1 } } as any;
    mem.put('zoew_daily_revenue_cod_dod', dataState.dailyRevenueData);
    mem.put('zoew_monthly_revenue_cod_dod', dataState.monthlyRevenueData);
    const code = 'TEST123456';
    const seed = { id: 'row', scanDate: '2026-10-31', phone: '012345678', createdAt: NOW - 5000, time: '11:00', isClosed: false, count: 1, cod: 5, dod: 0, price: 5, barcodes: [{ code, cod: 5, dod: 0, isClosed: false, isDeducted: false, createdAt: NOW - 5000, time: '11:00' }] };
    if (mode === 'stale-newer' || mode === 'stale-moved') {
        seed.isClosed = true;
        Object.assign(seed.barcodes[0], { isClosed: true, closedAt: NOW - 1000 });
        setZtoPickupVerdict(code, false);
    }
    mem.put(H + '/row', seed);
    dataState.scanHistory = [structuredClone(seed)] as any;
    const sync = () => { dataState.scanHistory = Object.entries(mem.get(H) || {}).map(([id, v]: any) => ({ ...v, id })); dataState.deletedItems = Object.entries(mem.get(T) || {}).map(([id, v]: any) => ({ ...v, id })); dataState.dailyPickupData = mem.get('zoew_daily_pickup_cod_dod') || {}; dataState.dailyCollectedData = mem.get('zoew_daily_collected_cod_dod') || {}; };
    ztoState.ztoSignedSweepAt = NOW;
    ztoState.ztoSignedSweepWaitMs = 0;
    ztoState.ztoReturnedSweepAt = NOW;
    let answer: any;
    let started: any;
    const ready = new Promise(r => started = r);
    let restoreChecks = 0;
    vi.stubGlobal('fetch', async (target) => {
        const url = new URL(String(target));
        if (url.searchParams.has('restore')) {
            restoreChecks++;
            return new Response(JSON.stringify({ barcode: code, cached: false, found: true, success: true, verifiedForRestore: true, ztoClosed: false }), { status: 200 });
        }
        if (url.searchParams.get('signed') === '1') { started(); return await new Promise(r => answer = r); }
        throw new Error('Unexpected request ' + target);
    });
    const entries = collectOpenBarcodesForZtoStatus();
    expect(entries).toHaveLength(mode.startsWith('stale-') ? 0 : 1);
    const oldBasis = entries[0]?.since;
    const running = runZtoStatusSweep(true);
    await ready;
    if (mode === 'metadata') {
        const prior = dataState.scanHistory[0];
        await mem.sdk.update(mem.sdk.ref(firebaseState.db, H + '/row'), { phone: '098000001', locker: 'B2' });
        sync();
        expect(dataState.scanHistory[0]).not.toBe(prior);
    }
    if (mode === 'newer-verdict' || mode === 'stale-newer') {
        vi.setSystemTime(NOW + 1000);
        setZtoPickupVerdict(code, false);
    }
    if (mode === 'stale-moved') {
        expect(await deleteSingleItem('row', { confirmed: true, quiet: true })).toBe('deleted');
        sync();
        expect(dataState.scanHistory).toHaveLength(0);
        expect(dataState.deletedItems).toHaveLength(1);
    }
    if (mode === 'duplicate') {
        mem.put(H + '/duplicate', { ...seed, id: 'duplicate' });
        sync();
        expect(dataState.scanHistory).toHaveLength(2);
    }
    if (mode === 'session') firebaseState.authGeneration++;
    if (mode === 'open-restored') {
        expect(await deleteSingleItem('row', { confirmed: true, quiet: true })).toBe('deleted');
        sync();
        const trashId = dataState.deletedItems[0].id;
        vi.setSystemTime(NOW + 1000);
        uiState.pendingRestoreId = trashId;
        await executeRestoreItem();
        sync();
        expect(restoreChecks).toBe(1);
        expect(dataState.deletedItems).toHaveLength(0);
        expect(dataState.scanHistory).toHaveLength(1);
        const item = dataState.scanHistory[0];
        expect(item.barcodes[0].restoredAt).toBe(NOW + 1000);
    }
    const restored = mode === 'open-restored' ? dataState.scanHistory[0].barcodes[0].restoredAt : 0;
    vi.setSystemTime(NOW + 2000);
    answer(new Response(JSON.stringify({ success: true, list: true, enabled: true, kind: 'signed', page: 1, pages: 1, rows: [], signed: [code], signedRows: [{ barcode: code, at: '2026-10-31 10:59:59' }], signedOk: true }), { status: 200 }));
    const outcome = await running;
    sync();
    if (mode === 'stale-moved') {
        expect(dataState.scanHistory).toHaveLength(0);
        expect(ztoPickupStatus.get(code)).toEqual({ closed: false, at: NOW });
        expect(trashRestoreBlockOf(dataState.deletedItems[0], true)).toBe('');
        expect(mem.get('zoew_daily_revenue_cod_dod')['2026-10-31']).toMatchObject({ codDollar: 5, totalCount: 1 });
        return;
    }
    if (mode === 'duplicate' || mode === 'session') {
        expect(dataState.scanHistory.every((item) => item.barcodes.every((barcode) => !barcode.isClosed))).toBe(true);
        expect(ztoPickupStatus.get(code)).toBeUndefined();
        return;
    }
    const current = dataState.scanHistory[0];
    const verdict = ztoPickupStatus.get(code);
    const restoreBlock = trashRestoreBlockOf({ ...current, trashReason: 'manual' }, true);
    console.log(JSON.stringify({ provider, mode, restoreBlock, oldBasis, restored, currentId: current.id, currentClosed: current.barcodes[0].isClosed, verdict, measured: outcome }));
    expect(current.barcodes[0].isClosed).toBe(['unchanged', 'metadata', 'stale-newer'].includes(mode));
    if (mode === 'newer-verdict' || mode === 'stale-newer') expect(verdict).toEqual({ closed: false, at: NOW + 1000 });
    if (mode === 'metadata') expect(current.phone).toBe('098000001');
    if (mode === 'open-restored') {
        expect.soft(verdict).toEqual({ closed: false, at: NOW + 1000 });
        expect.soft(restoreBlock).toBe('');
        expect(await deleteSingleItem(current.id, { confirmed: true, quiet: true })).toBe('deleted');
        sync();
        expect(dataState.deletedItems).toHaveLength(1);
        uiState.pendingRestoreId = dataState.deletedItems[0].id;
        await executeRestoreItem();
        sync();
        console.log(JSON.stringify({ provider, mode, secondRestoreChecks: restoreChecks, finalHistory: dataState.scanHistory.length, finalTrash: dataState.deletedItems.length, restoreBlocked: dataState.deletedItems[0]?.restoreBlocked }));
        expect.soft(restoreChecks).toBe(2);
        expect(dataState.scanHistory).toHaveLength(1);
    }
});

it('បញ្ជីទទេពិតលើក្រុមធំ មិនបង្កការស្វែងរក owner ជាចំនួនការ៉េ', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    appLocalStore.clear();
    clearZtoPickupStatusStore();
    const cfg = { enabled: true, fastMode: true, url: window.location.origin + '/.netlify/functions/zto-order-detail?barcode={barcode}' };
    appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify(cfg));
    clearCustomerDataTableCache();
    firebaseState.fb = createScanMemorySdk().sdk as any;
    firebaseState.auth = { currentUser: { uid: 'fixture' } } as any;
    firebaseState.db = {} as any;
    firebaseState.serverClockTrusted = true;
    firebaseState.serverTimeOffsetMs = 0;
    const size = 1000;
    let reads = 0;
    dataState.scanHistory = Array.from({ length: size }, (_, index) => ({ id: 'row' + index, scanDate: '2026-10-31', createdAt: NOW - 5000,
        barcodes: [{ get code() { reads++; return 'TEST' + index; }, createdAt: NOW - 5000, isClosed: false }] }));
    dataState.deletedItems = [];
    const entries = Array.from({ length: size }, (_, index) => ({ key: 'TEST' + index, code: 'TEST' + index, itemId: 'row' + index, open: true, since: 0 }));
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ success: true, list: true, enabled: true, kind: 'signed', page: 1, pages: 1,
        total: 0, rows: [], signed: [], signedRows: [], signedOk: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetcher);
    const result = await closeZtoSignedBarcodes(cfg, entries, dataState.scanHistory, true);
    expect(fetcher).toHaveBeenCalled();
    expect(result.signedCodes).toEqual([]);
    expect(result.closed).toBe(0);
    expect(reads).toBeLessThanOrEqual(size * 4);
});

it.each([['firebase', 'unchanged'], ['firebase', 'open-restored'], ['supabase', 'unchanged'], ['supabase', 'open-restored']] as const)('F02៖ original lifecycle ចាប់មុន lane claim await៖ %s %s', async (provider, mode) => {
    vi.stubGlobal('crypto', webcrypto);
    vi.stubGlobal('confirm', () => true);
    vi.stubGlobal('alert', () => { });
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    appLocalStore.clear();
    const options = provider === 'firebase' ? { databaseURL: 'https://audit.firebaseio.com' } : { supabaseUrl: 'https://audit.invalid' };
    const scope = provider === 'firebase' ? 'https://audit.firebaseio.com' : 'https://audit.invalid#tenant-a';
    appLocalStore.setItem('zoew_firebase_config', JSON.stringify(options));
    appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify({ enabled: true, fastMode: true, url: window.location.origin + '/.netlify/functions/zto-order-detail?barcode={barcode}' }));
    clearCustomerDataTableCache();
    clearZtoPickupStatusStore();
    dbListenerPendingPaths.clear();
    dbListenerFailedPaths.clear();
    const mem = createScanMemorySdk();
    if (provider === 'supabase') (mem.sdk as any).tenantScope = () => 'tenant-a';
    firebaseState.auth = { currentUser: { uid: 'test' }, app: { options } } as any;
    firebaseState.db = { name: 'test', app: { options } } as any;
    firebaseState.fb = mem.sdk as any;
    firebaseState.serverTimeOffsetMs = 0;
    firebaseState.serverClockTrusted = true;
    firebaseState.isDatabaseConnected = true;
    firebaseState.isDatabaseInitialized = true;
    firebaseState.isInitializingFirebase = false;
    for (const [key, path] of Object.entries({ dbRefHistory: H, dbRefDeleted: T, dbRefDailyRevenue: 'zoew_daily_revenue_cod_dod', dbRefMonthlyRevenue: 'zoew_monthly_revenue_cod_dod', dbRefDailyPickup: 'zoew_daily_pickup_cod_dod', dbRefDailyCollected: 'zoew_daily_collected_cod_dod', dbRefRegistry: 'zoew_barcode_registry' }))
        (firebaseState as any)[key] = mem.sdk.ref(firebaseState.db, path);
    ztoState.ztoTrashMode = { state: 'ok', palmAt: 0, cookieAt: NOW, shop: scope } as any;
    uiState.isModalOpen = false;
    uiState.toasts = [];
    dataState.deletedItems = [];
    dataState.dailyPickupData = {};
    dataState.dailyCollectedData = {};
    dataState.dailyRevenueData = { '2026-10-31': { codDollar: 5, dodDollar: 0, totalCount: 1 } } as any;
    dataState.monthlyRevenueData = { '2026-10': { codDollar: 5, dodDollar: 0, totalCount: 1 } } as any;
    mem.put('zoew_daily_revenue_cod_dod', dataState.dailyRevenueData);
    mem.put('zoew_monthly_revenue_cod_dod', dataState.monthlyRevenueData);
    const code = 'TEST123456';
    const seed = { id: 'row', scanDate: '2026-10-31', phone: '012345678', createdAt: NOW - 5000, time: '11:00', isClosed: false, count: 1, cod: 5, dod: 0, price: 5, barcodes: [{ code, cod: 5, dod: 0, isClosed: false, isDeducted: false, createdAt: NOW - 5000, time: '11:00' }] };
    mem.put(H + '/row', seed);
    dataState.scanHistory = [structuredClone(seed)] as any;
    const sync = () => { dataState.scanHistory = Object.entries(mem.get(H) || {}).map(([id, v]: any) => ({ ...v, id })); dataState.deletedItems = Object.entries(mem.get(T) || {}).map(([id, v]: any) => ({ ...v, id })); dataState.dailyPickupData = mem.get('zoew_daily_pickup_cod_dod') || {}; dataState.dailyCollectedData = mem.get('zoew_daily_collected_cod_dod') || {}; };
    ztoState.ztoSignedSweepAt = 0;
    ztoState.ztoSignedSweepWaitMs = 0;
    ztoState.ztoReturnedSweepAt = NOW;
    let answer: any;
    let started: any;
    const ready = new Promise(r => started = r);
    let restoreChecks = 0;
    vi.stubGlobal('fetch', async (target) => {
        const url = new URL(String(target));
        if (url.searchParams.has('restore')) {
            restoreChecks++;
            return new Response(JSON.stringify({ barcode: code, cached: false, found: true, success: true, verifiedForRestore: true, ztoClosed: false }), { status: 200 });
        }
        if (url.searchParams.get('signed') === '1') { started(); return await new Promise(r => answer = r); }
        throw new Error('Unexpected request ' + target);
    });
    const entries = collectOpenBarcodesForZtoStatus();
    expect(entries).toHaveLength(1);
    const oldBasis = entries[0].since;
    let laneStarted: any;
    const laneReady = new Promise(r => laneStarted = r);
    lane.started = laneStarted;
    lane.gate = new Promise(r => lane.resume = r);
    const running = runZtoStatusSweep(false);
    await laneReady;
    if (mode === 'open-restored') {
        expect(await deleteSingleItem('row', { confirmed: true, quiet: true })).toBe('deleted');
        sync();
        const trashId = dataState.deletedItems[0].id;
        vi.setSystemTime(NOW + 1000);
        uiState.pendingRestoreId = trashId;
        await executeRestoreItem();
        sync();
        expect(restoreChecks).toBe(1);
        expect(dataState.deletedItems).toHaveLength(0);
        expect(dataState.scanHistory).toHaveLength(1);
        const item = dataState.scanHistory[0];
        expect(item.barcodes[0].restoredAt).toBe(NOW + 1000);
    }
    const restored = mode === 'open-restored' ? dataState.scanHistory[0].barcodes[0].restoredAt : 0;
    lane.resume('own');
    await ready;
    vi.setSystemTime(NOW + 2000);
    answer(new Response(JSON.stringify({ success: true, list: true, enabled: true, kind: 'signed', page: 1, pages: 1, rows: [], signed: [code], signedRows: [{ barcode: code, at: '2026-10-31 10:59:59' }], signedOk: true }), { status: 200 }));
    const outcome = await running;
    sync();
    const current = dataState.scanHistory[0];
    const verdict = ztoPickupStatus.get(code);
    const restoreBlock = trashRestoreBlockOf({ ...current, trashReason: 'manual' }, true);
    console.log(JSON.stringify({ provider, mode, restoreBlock, oldBasis, restored, currentId: current.id, currentClosed: current.barcodes[0].isClosed, verdict, measured: outcome }));
    expect(current.barcodes[0].isClosed).toBe(mode === 'unchanged');
    if (mode === 'open-restored') {
        expect.soft(verdict).toEqual({ closed: false, at: NOW + 1000 });
        expect.soft(restoreBlock).toBe('');
        expect(await deleteSingleItem(current.id, { confirmed: true, quiet: true })).toBe('deleted');
        sync();
        expect(dataState.deletedItems).toHaveLength(1);
        uiState.pendingRestoreId = dataState.deletedItems[0].id;
        await executeRestoreItem();
        sync();
        console.log(JSON.stringify({ provider, mode, secondRestoreChecks: restoreChecks, finalHistory: dataState.scanHistory.length, finalTrash: dataState.deletedItems.length, restoreBlocked: dataState.deletedItems[0]?.restoreBlocked }));
        expect.soft(restoreChecks).toBe(2);
        expect(dataState.scanHistory).toHaveLength(1);
    }
});
