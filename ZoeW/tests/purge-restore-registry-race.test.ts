import { webcrypto } from 'node:crypto';
import { DB_OP_TIMEOUT_MS } from '../src/services/network';
import { withTransactionOutcomeResolution } from '../src/services/tx-outcome';
import { TRASH_CONSUMPTIONS_ROOT, trashConsumptionOf } from '../src/domain/trash-generation';
import { purgeTrashWithRegistry } from '../src/services/registry-purge';
import { runAutomaticDeletedCleanup } from '../src/domain/cleanup';
import { liveShopScope } from '../src/core/shop-scope';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { dataState, firebaseState, uiState, ztoState } from '../src/core/state';
import { pendingRegistryReleases } from '../src/core/clock';
import { dbListenerFailedPaths, dbListenerPendingPaths } from '../src/core/text';
import { activeRestoreClaims, releaseStaleRestoreClaimForPurge, executePermanentDelete, executeRestoreItem, restoreCancellationInFlight, restoreInFlight, restoreRecoveryHolds, storedRestoreClaims } from '../src/features/restore';
import { resetZtoFinalMarks } from '../src/features/zto-final-marks';
import { ztoPickupStatus } from '../src/features/zto-status';
import { cleanupServerRead } from './helpers/cleanup-server-read';

const H = 'zoew_scan_history_cod_dod', T = 'zoew_recently_deleted_cod_dod', R = 'zoew_barcode_registry';
const D = 'zoew_daily_revenue_cod_dod', M = 'zoew_monthly_revenue_cod_dod';
const NOW = Date.UTC(2026, 9, 30, 9), DAY = '2026-10-30', CODE = 'PURGE000001', BIRTH = NOW - 3600000;
const HOST = 'https://purge-restore.firebaseio.com';
const clone = <T,>(value: T): T => value === undefined ? value : JSON.parse(JSON.stringify(value));
let store: Record<string, any>, events: { kind: string; path: string; value?: any }[];
let readHook: null | ((path: string) => void), beforeWrite: null | ((target: any, patch: any) => Promise<void> | void), afterWrite: null | ((target: any, patch: any) => void);
let batches: any[];
let purgeGate: null | { entered: () => void; wait: Promise<void> };
function at(path: string): any { return clone(path.split('/').filter(Boolean).reduce((value, key) => value?.[key], store) ?? null); }
function put(path: string, value: any) {
    const keys = path.split('/').filter(Boolean); let target = store;
    for (const key of keys.slice(0, -1)) target = target[key] ||= {};
    if (value == null) delete target[keys.at(-1)!]; else target[keys.at(-1)!] = clone(value);
}
const ref = (_db: any, path = '') => ({ path, key: path.split('/').at(-1), toString: () => HOST + '/' + path });
const snap = (value: any) => ({ val: () => clone(value), exists: () => value != null });
const money = () => ({ daily: at(D), monthly: at(M) });
function deferred() { let resolve!: () => void; const promise = new Promise<void>(yes => { resolve = yes; }); return { promise, resolve }; }

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(NOW);
    localStorage.clear(); localStorage.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: HOST }));
    events = []; purgeGate = null; readHook = null; beforeWrite = null; afterWrite = null; batches = []; pendingRegistryReleases.clear();
    activeRestoreClaims.clear(); restoreInFlight.clear(); restoreCancellationInFlight.clear(); restoreRecoveryHolds.clear();
    ztoPickupStatus.clear(); resetZtoFinalMarks(); dbListenerPendingPaths.clear(); dbListenerFailedPaths.clear();
    ztoState.ztoStatusLoaded = true;
    ztoState.ztoTrashMode = { state: 'off', palmAt: 0, cookieAt: 0, failedAt: 0, stamps: {}, shop: HOST };
    const source = { id: 'source', phone: '012345678', scanDate: DAY, time: '08:00:00 (' + DAY + ')', createdAt: BIRTH,
        count: 1, cod: 7, dod: 0, price: 7, isClosed: false, isCalled: false, barcode: CODE,
        deletedAt: NOW - 1000, trashReason: 'delete', trashMode: 'local', isFromDeletion: true,
        barcodes: [{ code: CODE, cod: 7, dod: 0, time: '08:00:00 (' + DAY + ')', locker: 'N/A', createdAt: BIRTH, isClosed: false, isFromDeletion: true, isDeducted: false }] };
    store = { [H]: {}, [T]: { source }, [R]: { [CODE]: true }, [D]: { [DAY]: { codDollar: 7, dodDollar: 0, totalCount: 1 } }, [M]: { '2026-10': { codDollar: 7, dodDollar: 0, totalCount: 1 } } };
    firebaseState.authGeneration++;
    firebaseState.db = { app: { options: { databaseURL: HOST } } } as any;
    firebaseState.firebaseConfig = { databaseURL: HOST } as any;
    firebaseState.auth = { currentUser: { uid: 'purge-user', getIdToken: async () => 'synthetic-token' } } as any;
    firebaseState.isInitializingFirebase = false; firebaseState.isDatabaseInitialized = true; firebaseState.isDatabaseConnected = true;
    firebaseState.serverClockTrusted = true; firebaseState.serverTimeOffsetMs = 0; firebaseState.hasEverConnectedToDatabase = true;
    firebaseState.fb = {
        ref, increment: (n: number) => ({ inc: n }), get: async (target: any) => snap(at(target.path)),
        runTransaction: async (target: any, update: any) => {
            const value = update(at(target.path));
            if (value === undefined) return { committed: false, snapshot: snap(at(target.path)) };
            events.push({ kind: 'transaction', path: target.path, value: clone(value) }); put(target.path, value);
            return { committed: true, snapshot: snap(at(target.path)) };
        },
        update: async (target: any, patch: Record<string, any>) => {
            if (Object.keys(patch).some(path => path.startsWith('zoew_registry_releases/'))) batches.push(clone(patch));
            await beforeWrite?.(target, patch);
            if (purgeGate && (target.path === T && patch.source === null || target.path === '' && patch[T + '/source'] === null && Object.keys(patch).some(path => path.startsWith('zoew_registry_releases/')))) {
                events.push({ kind: 'purge-issued', path: T + '/source', value: at(T + '/source') });
                purgeGate.entered(); await purgeGate.wait;
                events.push({ kind: 'purge-before-commit', path: T + '/source', value: at(T + '/source') });
            }
            const receipts = Object.entries(patch).filter(([path]) => path.startsWith('zoew_registry_releases/'));
            for (const [path, receipt] of receipts) {
                const source = at(T + '/' + receipt.trashId), barcode = source?.barcodes?.[receipt.slot];
                if (target.path !== '' || at(path) !== null || !source || source.restoreClaim || source.deletedAt !== receipt.deletedAt
                    || (source.createdAt || 0) !== receipt.rowBirth || source.count !== receipt.rowCount || !barcode || barcode.code !== receipt.code
                    || (barcode.createdAt || 0) !== receipt.birth || patch[T + '/' + receipt.trashId] !== null || patch[R + '/' + receipt.registryKey] !== null)
                    throw Object.assign(new Error('PERMISSION_DENIED'), { code: 'PERMISSION_DENIED' });
                const registry = at(R + '/' + receipt.registryKey);
                if (receipt.kind === 'legacy' ? Object.prototype.hasOwnProperty.call(barcode, 'scanIntent') || registry !== true && registry !== null
                    : barcode.scanIntent !== receipt.id || JSON.stringify(registry) !== JSON.stringify({ v: 2, intent: receipt.id, actorUid: receipt.actorUid, birth: receipt.birth }))
                    throw Object.assign(new Error('PERMISSION_DENIED'), { code: 'PERMISSION_DENIED' });
            }
            for (const [key, value] of Object.entries(patch)) {
                const path = [target.path, key].filter(Boolean).join('/');
                events.push({ kind: 'update', path, value: clone(value) });
                put(path, value && typeof value === 'object' && 'inc' in value ? Number(at(path) || 0) + Number(value.inc) : value);
            }
            afterWrite?.(target, patch);
        }, onValue: () => () => {}, off: () => {}
    } as any;
    for (const [field, path] of Object.entries({ dbRefHistory: H, dbRefDeleted: T, dbRefDailyRevenue: D, dbRefMonthlyRevenue: M,
        dbRefDailyPickup: 'zoew_daily_pickup_cod_dod', dbRefDailyCollected: 'zoew_daily_collected_cod_dod' })) (firebaseState as any)[field] = ref(firebaseState.db, path);
    dataState.scanHistory = []; dataState.deletedItems = [clone(source)]; dataState.dailyRevenueData = clone(store[D]); dataState.monthlyRevenueData = clone(store[M]);
    dataState.dailyPickupData = {}; dataState.dailyCollectedData = {}; dataState.pickupResumeInFlight = false; dataState.registryReleaseFlushInFlight = false; dataState.deletedCleanupInFlight = false;
    uiState.toasts = []; uiState.pendingPermanentDeleteId = null; uiState.pendingRestoreId = null;
    vi.stubGlobal('fetch', cleanupServerRead(at, path => readHook?.(path))); vi.stubGlobal('confirm', () => true); vi.stubGlobal('alert', vi.fn());
    (window as any).ZoeErrors = { capture: vi.fn() };
});
afterEach(() => { firebaseState.authGeneration++; vi.useRealTimers(); vi.unstubAllGlobals(); delete (window as any).ZoeErrors; });

it('purge/Restore ៖ Delete រួចមិនដកប្រាក់ ហើយ purge ធម្មតាដោះ registry ដើមបាន', async () => {
    const before = money(); uiState.pendingPermanentDeleteId = 'source';
    await executePermanentDelete();
    await vi.waitFor(() => expect(at(R + '/' + CODE)).toBeNull());
    expect(at(T + '/source')).toBeNull(); expect(at(H)).toEqual({}); expect(money()).toEqual(before);
    expect(events.some(event => event.path === R + '/' + CODE && event.value === null)).toBe(true);
});

it('purge/Restore ៖ null ACK មកក្រោយ Restore ជីវិតដើម មិនអាចដោះ registry របស់ history ដែលស្តាររួច', async () => {
    const before = money(); const source = at(T + '/source');
    expect(source.trashReason).toBe('delete'); expect(source.isFromDeletion).toBe(true); expect(source.barcodes[0].isDeducted).toBe(false);
    const entered = deferred(), released = deferred(); purgeGate = { entered: entered.resolve, wait: released.promise };
    uiState.pendingPermanentDeleteId = 'source'; const purge = executePermanentDelete();
    await entered.promise;
    expect(dataState.deletedItems).toEqual([source]); expect(at(T + '/source')).toEqual(source); expect(at(R + '/' + CODE)).toBe(true);
    dataState.deletedItems = [clone(at(T + '/source'))];
    events.push({ kind: 'device-b-view', path: T + '/source', value: at(T + '/source') });
    uiState.pendingRestoreId = 'source'; await executeRestoreItem();
    const restored = at(H + '/source');
    expect(restored.barcodes).toEqual([expect.objectContaining({ code: CODE, createdAt: BIRTH, cod: 7, dod: 0, isDeducted: false, isFromDeletion: false })]);
    expect(restored.restoreClaimId).toBeUndefined(); expect(restored.restoreClaimToken).toBeUndefined();
    expect(at(T + '/source')).toBeNull(); expect(at('zoew_restore_finalizations/source')).toBeNull(); expect(money()).toEqual(before);
    expect(at(R + '/' + CODE)).toBe(true);
    released.resolve(); await purge;
    for (let i = 0; i < 20; i++) await Promise.resolve();
    expect(events.find(event => event.kind === 'purge-before-commit')?.value).toBeNull();
    expect(at(H + '/source')).toEqual(restored); expect(money()).toEqual(before);
    expect(at(R + '/' + CODE), JSON.stringify({ events: events.map(({ kind, path, value }) => ({ kind, path, absent: value === null })),
        restoredBirth: restored.barcodes[0].createdAt, moneyBefore: before, moneyAfter: money(), registry: at(R + '/' + CODE) })).toBe(true);
});


const source = () => clone(at(T + '/source'));
const receipts = () => Object.values(at('zoew_registry_releases') || {}) as any[];
function addCode(code: string) {
    const row = store[T].source;
    row.barcodes.push({ ...clone(row.barcodes[0]), code }); row.count = row.barcodes.length; row.cod = row.price = 7 * row.count;
    store[R][code] = true;
}
function makeScan(index = 0, actorUid = 'original-member') {
    const barcode = store[T].source.barcodes[index], id = 'scan_' + (index + 1).toString(16).padStart(32, '0');
    barcode.scanIntent = id;
    store.zoew_scan_operations ||= {};
    store.zoew_scan_operations[id] = { v: 2, id, actorUid, scope: liveShopScope(), code: barcode.code, registryKey: barcode.code, birth: barcode.createdAt,
        scanDate: DAY, month: DAY.slice(0, 7), cod: barcode.cod, dod: 0, count: 1, monthToken: 'op_m' + id.slice(5), phase: 'committed',
        targetId: 'original-history', payloadHash: 'a'.repeat(64), phone: '012345678', locker: 'N/A', closedAt: 0 };
    store[R][barcode.code] = { v: 2, intent: id, actorUid, birth: barcode.createdAt };
    return id;
}
function expectedScanReceipt(index = 0) {
    const row = source(), barcode = row.barcodes[index], operation = store.zoew_scan_operations[barcode.scanIntent];
    return { v: 2, generation: row.trashGeneration ?? 0, id: operation.id, kind: 'scan', actorUid: operation.actorUid, releasedBy: 'purge-user', scope: liveShopScope(), code: barcode.code,
        registryKey: barcode.code, birth: barcode.createdAt, trashId: 'source', slot: String(index), deletedAt: row.deletedAt, rowBirth: row.createdAt, rowCount: row.count };
}

it('atomic purge ៖ sparse server slot ត្រូវបានដោះតាមអត្តសញ្ញាណ មិនយក local index', async () => {
    const captured = source(); store[T].source.barcodes = { 7: clone(captured.barcodes[0]) };
    expect(await purgeTrashWithRegistry(captured)).toBe(true);
    expect(receipts()).toEqual([expect.objectContaining({ slot: '7', code: CODE, birth: BIRTH })]);
    expect(Object.keys(batches[0])).toHaveLength(4);
    expect(at(TRASH_CONSUMPTIONS_ROOT + '/source')).toMatchObject({ kind: 'purge', generation: 0, sourceId: 'source' });
});

it.each(['missing', 'zero', 'mismatch'])('atomic purge ៖ count %s មិនទាយចំនួនចេញពី array', async kind => {
    if (kind === 'missing') delete store[T].source.count;
    else store[T].source.count = kind === 'zero' ? 0 : 2;
    const before = clone(store); expect(await purgeTrashWithRegistry(source())).toBe(false);
    expect(store).toEqual(before); expect(batches).toEqual([]);
});

it.each(['missing', 'zero'])('atomic purge ៖ legacy birth %s ជាមួយ count ពិតអនុញ្ញាត', async kind => {
    if (kind === 'missing') { delete store[T].source.createdAt; delete store[T].source.barcodes[0].createdAt; }
    else { store[T].source.createdAt = 0; store[T].source.barcodes[0].createdAt = 0; }
    expect(await purgeTrashWithRegistry(source())).toBe(true); expect(receipts()[0]).toMatchObject({ kind: 'legacy', birth: 0, rowBirth: 0 });
});

it('atomic purge ៖ legacy និង v2 ចម្រុះក្នុង batch តែមួយ រក្សា original actor និង releasedBy', async () => {
    addCode('SCAN000002'); makeScan(1);
    const before = money(); expect(await purgeTrashWithRegistry(source())).toBe(true);
    expect(batches).toHaveLength(1); expect(Object.keys(batches[0])).toHaveLength(6); expect(at(T + '/source')).toBeNull();
    expect(receipts().find(receipt => receipt.kind === 'scan')).toMatchObject({ actorUid: 'original-member', releasedBy: 'purge-user', code: 'SCAN000002' });
    expect(money()).toEqual(before); expect(at(R + '/' + CODE)).toBeNull(); expect(at(R + '/SCAN000002')).toBeNull();
});

it.each([null, '', false, 'scan_bad', 'legacy'])('atomic purge ៖ scanIntent %s ខូចមិន downgrade ជា legacy', async value => {
    store[T].source.barcodes[0].scanIntent = value;
    const before = clone(store); expect(await purgeTrashWithRegistry(source())).toBe(false); expect(store).toEqual(before); expect(batches).toEqual([]);
});

it.each(['birth', 'code', 'scanIntent', 'deletedAt', 'rowBirth', 'count', 'duplicate'])('atomic purge ៖ captured %s ប្រែប្រួលត្រូវ HOLD', async kind => {
    const captured = source();
    if (kind === 'birth') store[T].source.barcodes[0].createdAt++;
    if (kind === 'code') store[T].source.barcodes[0].code = 'NEWCODE';
    if (kind === 'scanIntent') makeScan();
    if (kind === 'deletedAt') store[T].source.deletedAt++;
    if (kind === 'rowBirth') store[T].source.createdAt++;
    if (kind === 'count') store[T].source.count++;
    if (kind === 'duplicate') addCode(' ' + CODE.toLowerCase() + ' ');
    const before = clone(store); expect(await purgeTrashWithRegistry(captured)).toBe(false); expect(store).toEqual(before); expect(batches).toEqual([]);
});

it.each(['scanPending', 'pricePending', 'restoreClaim', 'clearClaim'])('atomic purge ៖ authoritative %s មិនមាន side effect', async field => {
    const captured = source(); store[T].source[field] = { phase: 'settled' };
    const before = clone(store); expect(await purgeTrashWithRegistry(captured)).toBe(false); expect(store).toEqual(before); expect(batches).toEqual([]);
});

it.each(['history', 'trash'])('atomic purge ៖ duplicate holder នៅ %s ត្រូវ HOLD', async location => {
    const copy = { ...source(), id: 'other' }; store[location === 'history' ? H : T].other = copy;
    const before = clone(store); expect(await purgeTrashWithRegistry(source())).toBe(false); expect(store).toEqual(before); expect(batches).toEqual([]);
});

it.each(['partial', 'mismatch'])('atomic purge ៖ receipt %s មិនអាចចាប់ផ្ដើម batch ថ្មី', async kind => {
    addCode('SCAN000002'); const first = makeScan(0); makeScan(1);
    store.zoew_registry_releases = { [first]: { ...expectedScanReceipt(0), ...(kind === 'mismatch' ? { deletedAt: 1 } : {}) } };
    const before = clone(store); expect(await purgeTrashWithRegistry(source())).toBe(false); expect(store).toEqual(before); expect(batches).toEqual([]);
});

it.each(['lost-ack', 'unknown', 'wrong-receipt', 'receipt-read-fails'])('atomic purge ៖ %s ត្រូវបែងចែកពីភស្តុតាង receipt ពិត', async kind => {
    const captured = source(), before = money();
    if (kind === 'unknown') beforeWrite = () => { throw new Error('disconnect'); };
    else afterWrite = () => {
        if (kind === 'wrong-receipt') Object.values(store.zoew_registry_releases).forEach((receipt: any) => receipt.birth++);
        if (kind === 'receipt-read-fails') readHook = path => { if (path.startsWith('zoew_registry_releases/')) throw new Error('disconnect'); };
        if (kind === 'lost-ack') { store[R][CODE] = { v: 2, intent: 'scan_' + 'f'.repeat(32), actorUid: 'new-user', birth: NOW }; throw new Error('disconnect'); }
    };
    expect(await purgeTrashWithRegistry(captured)).toBe(kind === 'lost-ack'); expect(batches).toHaveLength(1); expect(money()).toEqual(before);
    if (kind === 'lost-ack') expect(at(R + '/' + CODE)).toMatchObject({ actorUid: 'new-user', birth: NOW });
    if (kind === 'unknown') { expect(at(T + '/source')).toEqual(captured); expect(receipts()).toEqual([]); }
});

it.each(['db', 'sdk', 'uid', 'scope', 'generation'])('atomic purge ៖ owner %s ប្រែខណៈ read មិនចាប់ផ្ដើម write', async kind => {
    const captured = source(), before = clone(store);
    readHook = () => {
        readHook = null;
        if (kind === 'db') firebaseState.db = { name: 'other' } as any;
        if (kind === 'sdk') firebaseState.fb = { ...firebaseState.fb };
        if (kind === 'uid') firebaseState.auth.currentUser.uid = 'other';
        if (kind === 'scope') localStorage.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: 'https://other.firebaseio.com' }));
        if (kind === 'generation') firebaseState.authGeneration++;
    };
    expect(await purgeTrashWithRegistry(captured)).toBe(false); expect(store).toEqual(before); expect(batches).toEqual([]);
});

it.each([249, 250, 251])('atomic purge ៖ full bounded group %s ចប់ដោយ update តែមួយ និងភស្តុតាងពេញលេញ', async count => {
    const barcode = source().barcodes[0];
    store[T].source.barcodes = Array.from({ length: count }, (_, index) => ({ ...barcode, code: 'CAP' + index }));
    Object.assign(store[T].source, { count, cod: 7 * count, dod: 0, price: 7 * count, trashGeneration: 1 });
    store[R] = Object.fromEntries(store[T].source.barcodes.map((entry: any) => [entry.code, true]));
    store[D][DAY] = { codDollar: 7 * count, dodDollar: 0, totalCount: count };
    store[M]['2026-10'] = { codDollar: 7 * count, dodDollar: 0, totalCount: count };
    dataState.dailyRevenueData = clone(store[D]); dataState.monthlyRevenueData = clone(store[M]);
    const captured = source(), beforeMoney = money();
    const expectedConsumption = trashConsumptionOf(captured, 'purge', { uid: 'purge-user', scope: HOST });
    const update = vi.spyOn(firebaseState.fb, 'update');
    expect(await purgeTrashWithRegistry(captured)).toBe(true);
    expect(update).toHaveBeenCalledTimes(1); expect(update.mock.calls[0][0]).toMatchObject({ path: '' });
    expect(batches).toHaveLength(1); expect(at(T + '/source')).toBeNull();
    expect(at(TRASH_CONSUMPTIONS_ROOT + '/source')).toEqual(expectedConsumption);
    const released = receipts(), byCode = new Map(released.map(receipt => [receipt.code, receipt]));
    expect(released).toHaveLength(count); expect(byCode.size).toBe(count);
    expect(new Set(released.map(receipt => receipt.id)).size).toBe(count);
    for (const [index, entry] of captured.barcodes.entries()) {
        const receipt = byCode.get(entry.code);
        expect(at(R + '/' + entry.code)).toBeNull();
        expect(receipt?.id).toMatch(/^release_[a-f0-9]{32}$/);
        expect(receipt).toEqual({ v: 2, generation: 1, id: receipt.id, kind: 'legacy', actorUid: 'purge-user', releasedBy: 'purge-user',
            scope: HOST, code: entry.code, registryKey: entry.code, birth: entry.createdAt, trashId: captured.id, slot: String(index),
            deletedAt: captured.deletedAt, rowBirth: captured.createdAt, rowCount: count });
    }
    expect(Object.keys(batches[0]).sort()).toEqual([T + '/source', TRASH_CONSUMPTIONS_ROOT + '/source', ...captured.barcodes.flatMap((entry: any) =>
        [R + '/' + entry.code, 'zoew_registry_releases/' + byCode.get(entry.code).id])].sort());
    expect(Object.keys(batches[0])).toHaveLength(2 + 2 * count);
    expect(events.filter(event => event.kind === 'update')).toHaveLength(2 + 2 * count);
    expect(money()).toEqual(beforeMoney);
});

it('atomic purge ៖ automatic cleanup ដាច់តាម row រក្សា held row ហើយមិន release ប្រាក់មុន receipts', async () => {
    store[T].source.deletedAt = NOW - 31 * 86400000;
    store[T].blocked = { ...source(), id: 'blocked', barcodes: [{ ...source().barcodes[0], code: 'BLOCKED', scanIntent: 'bad' }] };
    store[R].BLOCKED = true; dataState.deletedItems = Object.values(clone(store[T]));
    const before = money(); await runAutomaticDeletedCleanup();
    expect(at(T + '/source')).toBeNull(); expect(at(T + '/blocked')).not.toBeNull(); expect(at(R + '/BLOCKED')).toBe(true);
    expect(dataState.deletedItems.map(item => item.id)).toEqual(['blocked']); expect(batches).toHaveLength(1); expect(money()).toEqual(before);
    expect(uiState.toasts.some((toast: any) => String(toast.msg).startsWith('✅'))).toBe(false);
});

it.each(['phase', 'actor', 'birth', 'scope', 'registry-legacy', 'registry-foreign', 'scan-birth-zero'])('atomic purge ៖ v2 %s ខុសមិន release owner', async kind => {
    const id = makeScan(), operation = store.zoew_scan_operations[id];
    if (kind === 'phase') operation.phase = 'prepared';
    if (kind === 'actor') operation.actorUid = 'another-member';
    if (kind === 'birth') operation.birth++;
    if (kind === 'scope') operation.scope = 'other-shop';
    if (kind === 'registry-legacy') store[R][CODE] = true;
    if (kind === 'registry-foreign') store[R][CODE].intent = 'scan_' + 'f'.repeat(32);
    if (kind === 'scan-birth-zero') store[T].source.barcodes[0].createdAt = 0;
    const before = clone(store); expect(await purgeTrashWithRegistry(source())).toBe(false); expect(store).toEqual(before); expect(batches).toEqual([]);
});

it('atomic purge ៖ ACK បាត់ក្រោយ receipt ទាំងអស់មិនប៉ះ registry owner ថ្មី', async () => {
    makeScan(); const captured = source();
    const newer = { v: 2, intent: 'scan_' + 'f'.repeat(32), actorUid: 'new-member', birth: NOW };
    afterWrite = () => { store[R] ||= {}; store[R][CODE] = clone(newer); throw new Error('ACK unavailable'); };
    expect(await purgeTrashWithRegistry(captured)).toBe(true);
    expect(at(T + '/source')).toBeNull(); expect(at(R + '/' + CODE)).toEqual(newer); expect(batches).toHaveLength(1);
});

it('atomic purge ៖ source generation ដែលបាន consume រួចមិនយក receipt ចាស់ដើម្បីលាក់ច្បាប់ចាស់', async () => {
    const id = makeScan(); store.zoew_registry_releases = { [id]: expectedScanReceipt() };
    store[TRASH_CONSUMPTIONS_ROOT] = { source: trashConsumptionOf(source(), 'purge', { uid: 'purge-user', scope: liveShopScope() }) };
    store[R][CODE] = { v: 2, intent: 'scan_' + 'f'.repeat(32), actorUid: 'new-member', birth: NOW };
    const before = clone(store); expect(await purgeTrashWithRegistry(source())).toBe(false); expect(store).toEqual(before); expect(batches).toEqual([]);
});

it('atomic purge ៖ context ប្រែក្រោយ request ចេញមិនអះអាង receipt ជា current success', async () => {
    afterWrite = () => { firebaseState.authGeneration++; };
    expect(await purgeTrashWithRegistry(source())).toBe(false);
    expect(batches).toHaveLength(1); expect(receipts()).toHaveLength(1); expect(at(T + '/source')).toBeNull();
});

it.each(['known', 'unknown'])('atomic purge ៖ auto %s ដោះ ledger key តែក្រោយ receipts', async kind => {
    store[T].source.deletedAt = NOW - 31 * 86400000; store[T].source.trashReason = 'returned'; store[T].source.isFromDeletion = false;
    store[T].source.barcodes[0].isDeducted = true;
    for (const path of [D + '/' + DAY, M + '/2026-10']) put(path, { codDollar: 0, dodDollar: 0, totalCount: 0, ded: { source: { at: store[T].source.deletedAt, cod: 7, dod: 0, count: 1 } } });
    dataState.dailyRevenueData = clone(store[D]); dataState.monthlyRevenueData = clone(store[M]); dataState.deletedItems = [source()];
    if (kind === 'unknown') beforeWrite = (_target, patch) => { if (Object.keys(patch).some(path => path.startsWith('zoew_registry_releases/'))) throw new Error('disconnect'); };
    await runAutomaticDeletedCleanup();
    expect(at(D + '/' + DAY + '/codDollar')).toBe(0);
    if (kind === 'known') { expect(at(D + '/' + DAY + '/ded/source')).toBeNull(); expect(at(T + '/source')).toBeNull(); }
    else { expect(at(D + '/' + DAY + '/ded/source')).not.toBeNull(); expect(at(T + '/source')).not.toBeNull(); }
});

it('atomic purge ៖ auto completion ចាស់មិនដោះ inFlight របស់ owner ថ្មី', async () => {
    store[T].source.deletedAt = NOW - 31 * 86400000;
    store[T].second = { ...source(), id: 'second', barcodes: [{ ...source().barcodes[0], code: 'SECOND0001' }] }; store[R].SECOND0001 = true;
    const enteredA = deferred(), enteredB = deferred(), releaseA = deferred(), releaseB = deferred();
    beforeWrite = async (_target, patch) => {
        if (!Object.keys(patch).some(path => path.startsWith('zoew_registry_releases/'))) return;
        if (patch[T + '/source'] === null) { enteredA.resolve(); await releaseA.promise; }
        if (patch[T + '/second'] === null) { enteredB.resolve(); await releaseB.promise; }
    };
    dataState.deletedItems = [source()]; const first = runAutomaticDeletedCleanup(); await enteredA.promise;
    firebaseState.authGeneration++; dataState.deletedItems = [clone(store[T].second)];
    const second = runAutomaticDeletedCleanup(); await enteredB.promise;
    releaseA.resolve(); await first;
    expect(dataState.deletedCleanupInFlight).toBe(true); expect(at(T + '/second')).not.toBeNull();
    releaseB.resolve(); await second; expect(dataState.deletedCleanupInFlight).toBe(false); expect(at(T + '/second')).toBeNull();
});

it('atomic purge ៖ manual HOLD refresh ប្រើ id ផ្លូវ និង normalize barcode map', async () => {
    const visible = source(); store[T].source.id = 'wrong-id'; store[T].source.barcodes = { 9: clone(visible.barcodes[0]) };
    store[T].source.restoreClaim = { token: 'held', targetId: 'history', claimedAt: NOW };
    dataState.deletedItems = [visible]; uiState.pendingPermanentDeleteId = 'source'; await executePermanentDelete();
    expect(dataState.deletedItems).toHaveLength(1); expect(dataState.deletedItems[0].id).toBe('source');
    expect(Array.isArray(dataState.deletedItems[0].barcodes)).toBe(true); expect(dataState.deletedItems[0].barcodes[0].code).toBe(CODE); expect(batches).toEqual([]);
});

it('atomic purge ៖ manual unknown read រក្សា source ដែលបង្ហាញ និងសាររង់ចាំ', async () => {
    const visible = clone(dataState.deletedItems); readHook = () => { throw new Error('disconnect'); };
    uiState.pendingPermanentDeleteId = 'source'; await executePermanentDelete();
    expect(dataState.deletedItems).toEqual(visible); expect(batches).toEqual([]);
    expect(uiState.toasts.some((toast: any) => String(toast.msg).includes('មិនទាន់បានផ្ទៀងបញ្ចប់'))).toBe(true);
});


it.each(['scope', 'uid', 'sdk'])('atomic purge ៖ auto មិនដោះ ledger key ក្រោយ %s ប្រែនៅ microtask', async kind => {
    store[T].source.deletedAt = NOW - 31 * 86400000; store[T].source.trashReason = 'returned';
    store[T].source.isFromDeletion = false; store[T].source.barcodes[0].isDeducted = true;
    put(D + '/' + DAY + '/ded/source', { at: store[T].source.deletedAt, cod: 7, dod: 0, count: 1 });
    dataState.dailyRevenueData = clone(store[D]); dataState.deletedItems = [source()];
    let switched = false, staleWrites = 0;
    const originalScope = liveShopScope();
    const unsubscribe = dataState.subscribe(() => {
        if (switched || dataState.deletedItems.length || !receipts().length) return;
        if (kind === 'scope') {
            (firebaseState.db as any).app.options.databaseURL = HOST + '/other';
            localStorage.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: HOST + '/other' }));
        }
        if (kind === 'uid') (firebaseState.auth.currentUser as any).uid = 'other-member';
        if (kind === 'sdk') firebaseState.fb = { ...firebaseState.fb } as any;
        switched = true;
    });
    beforeWrite = (_target, patch) => { if (switched && patch[D + '/' + DAY + '/ded/source'] === null) staleWrites++; };
    try { await runAutomaticDeletedCleanup(); } finally { unsubscribe(); }
    expect(switched).toBe(true);
    if (kind === 'scope') expect(liveShopScope()).not.toBe(originalScope);
    expect(staleWrites).toBe(0);
    expect(receipts()).toHaveLength(1); expect(at(T + '/source')).toBeNull();
    expect(at(D + '/' + DAY + '/ded/source')).not.toBeNull();
});

it('atomic purge ៖ sparse mixed slots ប្រើគ្រប់អត្តសញ្ញាណចាប់យក មិនចម្លង local slot', async () => {
    addCode('SCAN000002'); makeScan(1); const captured = source();
    store[T].source.barcodes = { 3: captured.barcodes[1], 8: captured.barcodes[0] };
    expect(await purgeTrashWithRegistry(captured)).toBe(true);
    expect(receipts().map(receipt => [receipt.code, receipt.slot]).sort()).toEqual([[CODE, '8'], ['SCAN000002', '3']]);
});

it.each(['duplicate-code', 'duplicate-intent', 'empty', 'bad-slot'])('atomic purge ៖ source %s មិនចាប់ផ្តើម batch', async kind => {
    if (kind === 'duplicate-code') addCode(' ' + CODE.toLowerCase() + ' ');
    if (kind === 'duplicate-intent') { addCode('SCAN000002'); makeScan(0); store[T].source.barcodes[1].scanIntent = store[T].source.barcodes[0].scanIntent; }
    if (kind === 'empty') { store[T].source.count = 0; store[T].source.barcodes = []; }
    if (kind === 'bad-slot') store[T].source.barcodes = { '01': source().barcodes[0] };
    const before = clone(store); expect(await purgeTrashWithRegistry(source())).toBe(false);
    expect(store).toEqual(before); expect(batches).toEqual([]);
});

it.each(['append', 'remove', 'reborn', 'claim'])('atomic purge ៖ authoritative source %s ក្រោយ read ដំបូងត្រូវ HOLD', async kind => {
    const captured = source();
    readHook = path => {
        if (path !== T + '/source') return;
        readHook = null;
        if (kind === 'append') addCode('NEW000002');
        if (kind === 'remove') delete store[T].source;
        if (kind === 'reborn') store[T].source.barcodes[0].createdAt++;
        if (kind === 'claim') store[T].source.barcodes[0].trashClaim = 'other-operation';
    };
    expect(await purgeTrashWithRegistry(captured)).toBe(false); expect(batches).toEqual([]); expect(at(R + '/' + CODE)).toBe(true);
});

it.each(['settled', 'null'])('atomic purge ៖ price marker %s មិនរារាំង purge ដែលរួចត្រឹមត្រូវ', async kind => {
    store[T].source.pricePending = kind === 'null' ? null : { token: 'price_' + 'a'.repeat(32), actorUid: 'member', code: CODE, slot: '0', birth: BIRTH,
        rowBirth: BIRTH, scanDate: DAY, priorCod: 7, priorDod: 0, wantCod: 7, wantDod: 0, phase: 'settled', outcome: 'committed' };
    expect(await purgeTrashWithRegistry(source())).toBe(true); expect(receipts()).toHaveLength(1); expect(at(T + '/source')).toBeNull();
});


it.each(['ack', 'unknown', 'native-proof'])('Restore final %s ៖ consumption មិនជំនួស financial ACK ហើយមិនបូកម្ដងទៀត', async mode => {
    const row = store[T].source;
    row.trashReason = 'remove'; row.isFromDeletion = false; row.barcodes[0].isDeducted = true;
    row.trashGeneration = 1;
    for (const [root, bucket] of [[D, DAY], [M, DAY.slice(0, 7)]]) store[root][bucket] = {
        codDollar: 0, dodDollar: 0, totalCount: 0, ded: { source: { at: row.deletedAt, cod: 7, dod: 0, count: 1 } }
    };
    dataState.deletedItems = [clone(row)]; dataState.dailyRevenueData = clone(store[D]); dataState.monthlyRevenueData = clone(store[M]);
    let finalWrites = 0;
    afterWrite = (_target, patch) => {
        if (patch[TRASH_CONSUMPTIONS_ROOT + '/source']?.kind !== 'restore') return;
        finalWrites++;
        if (mode !== 'ack') throw new Error('final ACK unavailable');
    };
    let sdk: any = null;
    if (mode === 'native-proof') {
        vi.stubGlobal('crypto', webcrypto);
        const db = firebaseState.db, auth = firebaseState.auth;
        const raw = { ...firebaseState.fb, getAuth: () => auth, getDatabase: () => db, deleteApp: async () => {} };
        sdk = withTransactionOutcomeResolution(raw); sdk.getAuth(db.app); sdk.getDatabase(db.app); firebaseState.fb = sdk;
    }
    try {
        uiState.pendingRestoreId = 'source'; await executeRestoreItem();
        expect(finalWrites).toBe(1);
        expect(at(T + '/source')).toBeNull();
        expect(at(TRASH_CONSUMPTIONS_ROOT + '/source')).toMatchObject({ kind: 'restore', generation: 1 });
        expect(at(H + '/source').trashGeneration).toBeUndefined();
        for (const [root, bucket] of [[D, DAY], [M, DAY.slice(0, 7)]]) {
            expect(at(root + '/' + bucket).codDollar).toBe(7); expect(at(root + '/' + bucket).totalCount).toBe(1);
        }
        expect(uiState.toasts.some(toast => /បានស្តារទិន្នន័យ/.test(toast.msg))).toBe(mode !== 'unknown');
        expect(Boolean(storedRestoreClaims().source)).toBe(mode === 'unknown');
        const before = money(); uiState.pendingRestoreId = 'source'; await executeRestoreItem();
        expect(money()).toEqual(before); expect(finalWrites).toBe(1);
    } finally { if (sdk) await sdk.deleteApp(firebaseState.db.app); }
});


it.each([undefined, null, false, '1', -1, 9007199254740991])('purge local generation %s ខូចមិនលុប field ដើម្បីប្ដូរជា legacy0', async generation => {
    const captured = source(); captured.trashGeneration = generation;
    const before = clone(store); expect(await purgeTrashWithRegistry(captured)).toBe(false);
    expect(store).toEqual(before); expect(batches).toEqual([]);
});

it.each(['claim', 'history', 'bind', 'final'].flatMap(phase => ['uid', 'sdk', 'scope'].map(owner => [phase, owner])))('Restore callback %s ៖ owner %s ប្រែមុន updater មិនបង្កើត proposal ថ្មី', async (phase, owner) => {
    const reached = deferred(), released = deferred();
    const original = firebaseState.fb, run = original.runTransaction;
    let held = false, trashCalls = 0, targetChanged = false;
    original.runTransaction = async (target, updater, options) => {
        if (target.path === T + '/source') trashCalls++;
        if (phase === 'bind' && target.path === H + '/source' && !targetChanged) {
            targetChanged = true;
            store[H].source = { id: 'source', phone: '099999999', scanDate: DAY, createdAt: BIRTH, count: 1,
                barcodes: [{ code: 'FOREIGN000002', createdAt: BIRTH, cod: 0, dod: 0, isClosed: false }] };
        }
        const selected = phase === 'claim' ? target.path === T + '/source' && trashCalls === 1
            : phase === 'history' ? target.path === H + '/source'
                : phase === 'bind' ? target.path === T + '/source' && trashCalls === 2
                    : target.path === 'zoew_restore_finalizations/source';
        if (!held && selected) {
            held = true; reached.resolve(); await released.promise;
        }
        return run(target, updater, options);
    };
    uiState.pendingRestoreId = 'source'; const restoring = executeRestoreItem();
    await reached.promise; expect(held).toBe(true);
    const before = clone(store), scope = liveShopScope(), eventCount = events.length;
    if (owner === 'uid') firebaseState.auth.currentUser.uid = 'next-user';
    if (owner === 'sdk') firebaseState.fb = { ...original };
    if (owner === 'scope') {
        firebaseState.db.app.options.databaseURL = 'https://next-shop.firebaseio.com';
        expect(liveShopScope()).not.toBe(scope);
    }
    released.resolve(); await restoring;
    expect(store).toEqual(before);
    expect(events.slice(eventCount)).toEqual([]);
    expect(uiState.toasts.some(toast => /បានស្តារទិន្នន័យ/.test(toast.msg))).toBe(false);
});


it('auto purge៖ ពិដានទាំងជុំដោះសោ ហើយកុំចាប់កញ្ចប់បន្ទាប់ក្រោយផុតម្ចាស់', async () => {
    vi.useFakeTimers(); vi.setSystemTime(NOW);
    store[T].source.deletedAt = NOW - 31 * 86400000;
    store[T].second = { ...source(), id: 'second', barcodes: [{ ...source().barcodes[0], code: 'SECOND0001' }] }; store[R].SECOND0001 = true;
    dataState.deletedItems = [source(), clone(store[T].second)];
    const entered = deferred(), release = deferred();
    beforeWrite = async (_target, patch) => { if (patch[T + '/source'] === null) { entered.resolve(); await release.promise; } };
    let finished = false; const operation = runAutomaticDeletedCleanup().then(() => { finished = true; });
    await entered.promise; await vi.advanceTimersByTimeAsync(DB_OP_TIMEOUT_MS + 1);
    const bounded = finished && !dataState.deletedCleanupInFlight;
    release.resolve(); await vi.advanceTimersByTimeAsync(1); await operation;
    expect(bounded).toBe(true); expect(batches).toHaveLength(1);
    expect(at(T + '/source')).toBeNull(); expect(at(T + '/second')).not.toBeNull();
    expect(receipts()).toHaveLength(1); expect(at(R + '/SECOND0001')).toBe(true);
});

it('auto purge៖ ម្ចាស់ចាស់ផុតពិដាន ហើយចម្លើយយឺតមិនដោះសោម្ចាស់ថ្មី', async () => {
    vi.useFakeTimers(); vi.setSystemTime(NOW);
    store[T].source.deletedAt = NOW - 31 * 86400000;
    store[T].second = { ...source(), id: 'second', barcodes: [{ ...source().barcodes[0], code: 'SECOND0001' }] }; store[R].SECOND0001 = true;
    const enteredA = deferred(), enteredB = deferred(), releaseA = deferred(), releaseB = deferred();
    beforeWrite = async (_target, patch) => {
        if (patch[T + '/source'] === null) { enteredA.resolve(); await releaseA.promise; }
        if (patch[T + '/second'] === null) { enteredB.resolve(); await releaseB.promise; }
    };
    dataState.deletedItems = [source()]; let ended = false;
    const first = runAutomaticDeletedCleanup().then(() => { ended = true; }); await enteredA.promise;
    await vi.advanceTimersByTimeAsync(DB_OP_TIMEOUT_MS + 1);
    const bounded = ended;
    if (!bounded) { releaseA.resolve(); await vi.advanceTimersByTimeAsync(1); await first; expect(bounded, 'ម្ចាស់ត្រូវចប់នៅពិដានដើម').toBe(true); return; }
    dataState.deletedItems = [clone(store[T].second)]; const second = runAutomaticDeletedCleanup(); await enteredB.promise;
    releaseA.resolve(); await vi.advanceTimersByTimeAsync(1);
    expect(dataState.deletedCleanupInFlight).toBe(true); expect(at(T + '/second')).not.toBeNull();
    releaseB.resolve(); await second; expect(dataState.deletedCleanupInFlight).toBe(false);
    expect(at(T + '/second')).toBeNull(); expect(receipts()).toHaveLength(2);
});

it.each([0, 1, 2])('stale Restore release៖ owner អស់នៅ read ទី %s មិនចេញសំណើបន្ទាប់', async stopAt => {
    store[T].source.restoreClaim = { token: 'old', targetId: 'history', claimedAt: NOW - 3600000 };
    let current = stopAt !== 0, reads = 0, writes = 0;
    const sdk = firebaseState.fb as any, originalGet = sdk.get, originalTx = sdk.runTransaction;
    sdk.get = async (target: any) => { const result = await originalGet(target); if (++reads === stopAt) current = false; return result; };
    sdk.runTransaction = (...args: any[]) => { writes++; return originalTx(...args); };
    const result = await releaseStaleRestoreClaimForPurge('source', () => current);
    expect(result).toBe(false); expect(reads).toBe(stopAt); expect(writes).toBe(0);
    expect(store[T].source.restoreClaim.token).toBe('old');
});

it('stale Restore release៖ updater យឺតក្រោយ owner អស់ មិនលុប claim', async () => {
    store[T].source.restoreClaim = { token: 'old', targetId: 'history', claimedAt: NOW - 3600000 };
    let current = true;
    const sdk = firebaseState.fb as any, originalTx = sdk.runTransaction;
    sdk.runTransaction = (target: any, updater: any) => { current = false; return originalTx(target, updater); };
    expect(await releaseStaleRestoreClaimForPurge('source', () => current)).toBe(false);
    expect(store[T].source.restoreClaim.token).toBe('old');
});


it.each([0, 1, 2, 4])('purge owner អស់ក្រោយ read ទី %s មិនចេញសំណើបន្ត ឬប្ដូរប្រាក់', async stopAt => {
    let current = stopAt !== 0, reads = 0;
    const before = clone(store);
    readHook = () => { if (++reads === stopAt) current = false; };
    expect(await purgeTrashWithRegistry(source(), () => current)).toBe(false);
    expect(reads).toBe(stopAt); expect(batches).toEqual([]); expect(store).toEqual(before);
});

it('auto purge៖ ប្រភពដំបូងព្យួររាល់ជុំ មិនទប់ប្រភពបន្ទាប់ដែលមានភស្តុតាងល្អ', async () => {
    vi.useFakeTimers(); vi.setSystemTime(NOW);
    store[T].source.deletedAt = NOW - 31 * 86400000;
    store[T].second = { ...source(), id: 'second', barcodes: [{ ...source().barcodes[0], code: 'SECOND0001' }] }; store[R].SECOND0001 = true;
    dataState.deletedItems = [source(), clone(store[T].second)];
    beforeWrite = async (_target, patch) => { if (patch[T + '/source'] === null) await new Promise(() => {}); };
    const beforeMoney = money();
    for (let round = 0; round < 2; round++) {
        const sweep = runAutomaticDeletedCleanup();
        await vi.advanceTimersByTimeAsync(DB_OP_TIMEOUT_MS + 1); await sweep;
    }
    expect(at(T + '/second'), 'healthy tail must not starve behind a perpetually hanging head').toBeNull();
    expect(at(T + '/source')).not.toBeNull(); expect(at(R + '/' + CODE)).toBe(true);
    expect(money()).toEqual(beforeMoney);
});

it.each(['generation', 'db', 'sdk', 'uid', 'scope'])('auto purge៖ cursor មិនឆ្លងម្ចាស់ %s ថ្មីដែលមាន id ដូចគ្នា', async change => {
    vi.useFakeTimers(); vi.setSystemTime(NOW);
    store[T].source.deletedAt = NOW - 31 * 86400000;
    store[T].second = { ...source(), id: 'second', barcodes: [{ ...source().barcodes[0], code: 'SECOND0001' }] }; store[R].SECOND0001 = true;
    dataState.deletedItems = [source(), clone(store[T].second)];
    beforeWrite = async (_target, patch) => { if (patch[T + '/source'] === null) await new Promise(() => {}); };
    let sweep = runAutomaticDeletedCleanup(); await vi.advanceTimersByTimeAsync(DB_OP_TIMEOUT_MS + 1); await sweep;
    if (change === 'generation') firebaseState.authGeneration++;
    if (change === 'db') firebaseState.db = {} as any;
    if (change === 'sdk') firebaseState.fb = { ...firebaseState.fb } as any;
    if (change === 'uid') (firebaseState.auth as any).currentUser.uid = 'other-fixture-user';
    if (change === 'scope') {
        const other = 'https://other-purge-restore.firebaseio.com';
        (firebaseState.db as any).app.options.databaseURL = other;
        localStorage.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: other }));
    }
    sweep = runAutomaticDeletedCleanup(); await vi.advanceTimersByTimeAsync(DB_OP_TIMEOUT_MS + 1); await sweep;
    expect(batches).toHaveLength(2); expect(batches.every(patch => patch[T + '/source'] === null)).toBe(true);
    expect(at(T + '/second')).not.toBeNull(); expect(receipts()).toHaveLength(0);
});

it('auto purge៖ cursor ដែល source បាត់ អាចចាប់ candidate ថ្មីដោយមិនទាយ proof', async () => {
    vi.useFakeTimers(); vi.setSystemTime(NOW);
    store[T].source.deletedAt = NOW - 31 * 86400000;
    dataState.deletedItems = [source()];
    beforeWrite = async (_target, patch) => { if (patch[T + '/source'] === null) await new Promise(() => {}); };
    const first = runAutomaticDeletedCleanup(); await vi.advanceTimersByTimeAsync(DB_OP_TIMEOUT_MS + 1); await first;
    store[T].second = { ...source(), id: 'second', barcodes: [{ ...source().barcodes[0], code: 'SECOND0001' }] }; store[R].SECOND0001 = true;
    dataState.deletedItems = [clone(store[T].second)];
    await runAutomaticDeletedCleanup();
    expect(at(T + '/second')).toBeNull(); expect(at(T + '/source')).not.toBeNull();
    expect(receipts()).toHaveLength(1); expect(at(R + '/' + CODE)).toBe(true);
});

it('auto purge៖ callback ចាស់មិនបង្វិល cursor របស់ជុំថ្មីត្រឡប់ក្រោយ', async () => {
    vi.useFakeTimers(); vi.setSystemTime(NOW);
    store[T].source.deletedAt = NOW - 31 * 86400000;
    for (const id of ['second', 'third']) {
        store[T][id] = { ...source(), id, barcodes: [{ ...source().barcodes[0], code: id.toUpperCase() + '0001' }] };
        store[R][id.toUpperCase() + '0001'] = true;
    }
    dataState.deletedItems = [source(), clone(store[T].second), clone(store[T].third)];
    const releaseA = deferred(), enteredB = deferred();
    beforeWrite = async (_target, patch) => {
        if (patch[T + '/source'] === null) await releaseA.promise;
        if (patch[T + '/second'] === null) { enteredB.resolve(); await new Promise(() => {}); }
    };
    const first = runAutomaticDeletedCleanup(); await vi.advanceTimersByTimeAsync(DB_OP_TIMEOUT_MS + 1); await first;
    const second = runAutomaticDeletedCleanup(); await enteredB.promise;
    releaseA.resolve(); await vi.advanceTimersByTimeAsync(1);
    expect(dataState.deletedCleanupInFlight).toBe(true);
    await vi.advanceTimersByTimeAsync(DB_OP_TIMEOUT_MS); await second;
    const third = runAutomaticDeletedCleanup(); await vi.advanceTimersByTimeAsync(DB_OP_TIMEOUT_MS + 1); await third;
    expect(at(T + '/third')).toBeNull(); expect(at(T + '/second')).not.toBeNull();
    expect(batches[2][T + '/third']).toBeNull();
});
