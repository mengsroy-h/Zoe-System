import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { dataState, firebaseState, uiState, ztoState } from '../src/core/state';
import { dbListenerFailedPaths, dbListenerPendingPaths } from '../src/core/text';
import { activeClearHistoryClaims } from '../src/ui/history-render';
import { clearHistory, claimHistoryItemForClear, buildClearHistoryTrashItem, resetClearHistoryOperationState } from '../src/features/clear-history';
import { deleteSingleItem } from '../src/features/entry-ops';
import { removeSingleBarcode } from '../src/features/barcode-ops';
import { claimAndCleanupItem, cleanupInFlight, cleanupJournalLive, cleanupOperationOwners, cleanupPartialTrashId, claimCleanupTrashSlot, resolveCleanupSlot, clearCleanupJournalEntry, noteCleanupJournalEntry, readCleanupJournal, resumeCleanupJournalEntry } from '../src/domain/cleanup';
import { TRASH_CONSUMPTIONS_ROOT } from '../src/domain/trash-generation';
import { cleanupServerRead } from './helpers/cleanup-server-read';

const H = 'zoew_scan_history_cod_dod', T = 'zoew_recently_deleted_cod_dod', D = 'zoew_daily_revenue_cod_dod', M = 'zoew_monthly_revenue_cod_dod';
const NOW = Date.UTC(2026, 9, 30, 9), DAY = '2026-10-30', HOST = 'https://generation.firebaseio.com', ID = 'source';
const copy = <T,>(value: T): T => value === undefined ? value : JSON.parse(JSON.stringify(value));
let store: Record<string, any>, effects: any[], admissions: any[];
let readHook: ((path: string) => void) | null;
let sdkReadHook: ((path: string) => void) | null;
let beforeTransaction: ((path: string, prior: any) => void) | null;
let afterTransaction: ((path: string, value: any) => void) | null;
let afterUpdate: ((updates: any) => Promise<void> | void) | null;
const at = (path: string): any => copy(path.split('/').filter(Boolean).reduce((value, key) => value?.[key], store) ?? null);
function put(path: string, value: any) { const keys = path.split('/').filter(Boolean); let target = store; for (const key of keys.slice(0, -1)) target = target[key] ||= {}; if (value == null) delete target[keys.at(-1)!]; else target[keys.at(-1)!] = copy(value); }
const ref = (_db: any, path = '') => ({ path, toString: () => HOST + '/' + path });
const snap = (value: any) => ({ val: () => copy(value), exists: () => value != null });
const consumption = (id = ID, generation = 0) => ({ v: 1, sourceId: id, generation, kind: 'purge', actorUid: 'member', scope: HOST, deletedAt: NOW - 1000, rowBirth: NOW - 10 * 86400000 });

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(NOW); localStorage.clear(); localStorage.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: HOST }));
    effects = []; admissions = []; readHook = null; sdkReadHook = null; beforeTransaction = null; afterTransaction = null; afterUpdate = null; cleanupInFlight.clear(); cleanupJournalLive.clear(); cleanupOperationOwners.clear(); activeClearHistoryClaims.clear();
    dbListenerFailedPaths.clear(); dbListenerPendingPaths.clear();
    const barcode = { code: 'GEN0001', cod: 7, dod: 0, createdAt: NOW - 10 * 86400000, time: '08:00:00 (' + DAY + ')', locker: 'N/A', isClosed: false, isDeducted: false, isFromDeletion: false };
    const item = { id: ID, createdAt: barcode.createdAt, scanDate: DAY, time: barcode.time, phone: '012', count: 1, cod: 7, dod: 0, price: 7, barcode: barcode.code, barcodes: [barcode], isClosed: false };
    store = { [H]: { [ID]: item }, [T]: {}, [D]: { [DAY]: { codDollar: 7, dodDollar: 0, totalCount: 1 } }, [M]: { '2026-10': { codDollar: 7, dodDollar: 0, totalCount: 1 } } };
    firebaseState.firebaseConfig = { databaseURL: HOST } as any;
    firebaseState.authGeneration++; firebaseState.db = { app: { options: { databaseURL: HOST } } } as any;
    firebaseState.auth = { currentUser: { uid: 'member', getIdToken: async () => 'fixture' } } as any;
    firebaseState.fb = { ref, increment: (value: number) => ({ inc: value }), get: async (target: any) => { const saved = snap(at(target.path)); sdkReadHook?.(target.path); return saved; },
        runTransaction: async (target: any, update: any) => {
            const prior = at(target.path); beforeTransaction?.(target.path, prior); const value = update(copy(prior));
            if (value === undefined) return { committed: false, snapshot: snap(prior) };
            if (target.path === H + '/' + ID && value === null) admissions.push(copy(readCleanupJournal()));
            if (value?.clearClaim) admissions.push(copy(value.clearClaim));
            effects.push([target.path, copy(value)]); put(target.path, value); const acknowledged = snap(at(target.path)); afterTransaction?.(target.path, value); return { committed: true, snapshot: acknowledged };
        }, update: async (target: any, updates: any) => { for (const [key, value] of Object.entries(updates)) { const path = [target.path, key].filter(Boolean).join('/'); effects.push([path, copy(value)]); put(path, (value as any)?.inc !== undefined ? Number(at(path) || 0) + (value as any).inc : value); } await afterUpdate?.(updates); }, onValue: () => () => {}, off: () => {} } as any;
    firebaseState.isDatabaseInitialized = true; firebaseState.isDatabaseConnected = true; firebaseState.isInitializingFirebase = false; firebaseState.serverClockTrusted = true; firebaseState.serverTimeOffsetMs = 0; firebaseState.hasEverConnectedToDatabase = true;
    for (const [field, path] of Object.entries({ dbRefHistory: H, dbRefDeleted: T, dbRefDailyRevenue: D, dbRefMonthlyRevenue: M, dbRefDailyPickup: 'zoew_daily_pickup_cod_dod', dbRefDailyCollected: 'zoew_daily_collected_cod_dod' })) (firebaseState as any)[field] = ref(firebaseState.db, path);
    dataState.scanHistory = [copy(item)]; dataState.deletedItems = []; dataState.dailyRevenueData = copy(store[D]); dataState.monthlyRevenueData = copy(store[M]); dataState.dailyPickupData = {}; dataState.dailyCollectedData = {}; dataState.clearHistoryInFlight = false; dataState.cleanupResumeInFlight = false;
    uiState.currentFilterMode = 'all'; uiState.toasts = []; ztoState.ztoTrashMode = { state: 'off', palmAt: 0, cookieAt: 0, failedAt: 0, stamps: {}, shop: HOST }; ztoState.ztoStatusLoaded = true;
    vi.stubGlobal('fetch', cleanupServerRead(at, path => readHook?.(path))); vi.stubGlobal('confirm', () => true); (window as any).ZoeErrors = { capture: vi.fn() };
});
afterEach(() => { firebaseState.authGeneration++; vi.useRealTimers(); vi.unstubAllGlobals(); delete (window as any).ZoeErrors; });

it.each(['delete', 'remove', 'auto', 'clear'])('generation ៖ %s ថ្មីរក្សា generation1 មុន history ចាកចេញ', async route => {
    if (route === 'delete') await deleteSingleItem(ID, { confirmed: true });
    if (route === 'remove') await removeSingleBarcode(ID, 'GEN0001');
    if (route === 'auto') await claimAndCleanupItem(ID, 'abandon');
    if (route === 'clear') await clearHistory();
    const trash = Object.values(at(T) || {}) as any[];
    expect(trash).toHaveLength(1); expect(trash[0].trashGeneration).toBe(1);
    expect(admissions.length).toBeGreaterThan(0);
    if (route === 'clear') expect(admissions[0]).toMatchObject({ trashGeneration: 1, deletedAt: NOW });
    else expect(admissions[0][0].trashItem).toMatchObject({ trashGeneration: 1, deletedAt: NOW });
});

it.each(['slot', 'moved', 'ledger', 'flip', 'collected', 'undo'])('generation ៖ replay stage %s ដែល consumed មិនបង្កើត source ឬប៉ះ money/mirror', async stage => {
    const trash = { ...at(H + '/' + ID), deletedAt: NOW - 1000, trashReason: 'remove', trashMode: 'local', isFromDeletion: false };
    delete store[H][ID]; dataState.scanHistory = [];
    store[TRASH_CONSUMPTIONS_ROOT] = { [ID]: consumption() };
    noteCleanupJournalEntry({ id: ID, reason: 'remove', stage, trashItem: trash, revenue: null });
    const before = copy(store); await resumeCleanupJournalEntry(ID);
    expect(store).toEqual(before); expect(effects).toEqual([]); expect(readCleanupJournal()).toHaveLength(1);
});


it.each(['delete', 'remove', 'auto', 'clear'])('generation ៖ fresh %s ក្រោយ consumed4 ចាប់យក5 មិនប្រើ receipt ជា money proof', async route => {
    const target = route === 'remove' ? cleanupPartialTrashId(ID, 'remove', at(H + '/' + ID)) : ID;
    store[TRASH_CONSUMPTIONS_ROOT] = { [target]: consumption(target, 4) };
    if (route === 'delete') await deleteSingleItem(ID, { confirmed: true });
    if (route === 'remove') await removeSingleBarcode(ID, 'GEN0001');
    if (route === 'auto') await claimAndCleanupItem(ID, 'abandon');
    if (route === 'clear') await clearHistory();
    expect(at(T + '/' + target)?.trashGeneration).toBe(5);
    expect(at(TRASH_CONSUMPTIONS_ROOT + '/' + target)).toEqual(consumption(target, 4));
});

it('generation ៖ Clear retry ដដែលរក្សា deletedAt/generation ហើយ old incomplete HOLD', async () => {
    const first = await claimHistoryItemForClear(ID, 'clear_one');
    vi.setSystemTime(NOW + 1000);
    const again = await claimHistoryItemForClear(ID, 'clear_one');
    expect(again.clearClaim).toEqual(first.clearClaim);
    expect(buildClearHistoryTrashItem(again, ID)).toMatchObject({ deletedAt: NOW, trashGeneration: 1 });
    store[H][ID].clearClaim = { token: 'clear_old', claimedAt: NOW - 1000 };
    const before = copy(store); await expect(claimHistoryItemForClear(ID, 'clear_old')).rejects.toThrow(); expect(store).toEqual(before);
});

it('generation ៖ unrelated slot ត្រូវជ្រើស fallback មុន destructive CAS', async () => {
    const original = at(H + '/' + ID), foreign = { ...copy(original), deletedAt: NOW - 1000, trashGeneration: 1, barcodes: [{ ...original.barcodes[0], code: 'FOREIGN' }] };
    store[T][ID] = foreign;
    const fallback = cleanupPartialTrashId(ID, 'delete|slot', original);
    await deleteSingleItem(ID, { confirmed: true });
    expect(at(T + '/' + ID)).toEqual(foreign); expect(at(T + '/' + fallback)?.trashGeneration).toBe(1);
    expect(admissions[0][0].trashItem.id).toBe(fallback);
});

it('generation ៖ slot ចូលក្រោយ admission មិន retarget ឬលុប journal', async () => {
    let raced = false;
    beforeTransaction = (path, prior) => {
        if (raced || path !== H + '/' + ID || !prior?.barcodes?.[0]?.trashClaim) return;
        raced = true; store[T][ID] = { ...copy(prior), id: ID, deletedAt: NOW - 1, trashGeneration: 1, barcodes: [{ ...prior.barcodes[0], code: 'FOREIGN' }] };
    };
    await deleteSingleItem(ID, { confirmed: true });
    expect(raced).toBe(true); expect(Object.keys(at(T))).toEqual([ID]); expect(at(T + '/' + ID).barcodes[0].code).toBe('FOREIGN');
    expect(readCleanupJournal()).toHaveLength(1); expect(readCleanupJournal()[0].trashItem.id).toBe(ID);
});

it('generation ៖ deletedAt ដូចគ្នា generation ថ្មីមិនជា slot ours ឬ journal owner ចាស់', async () => {
    const old = { ...at(H + '/' + ID), deletedAt: NOW - 1000, trashGeneration: 1, trashReason: 'delete' };
    const newer = { ...old, trashGeneration: 2 }; store[T][ID] = newer; store[TRASH_CONSUMPTIONS_ROOT] = { [ID]: consumption(ID, 1) };
    noteCleanupJournalEntry({ id: ID, reason: 'delete', stage: 'slot', trashItem: newer, revenue: null });
    clearCleanupJournalEntry(ID, old); expect(readCleanupJournal()).toHaveLength(1);
    expect(await resolveCleanupSlot(old, ID)).toBe('wait'); await expect(claimCleanupTrashSlot(old)).rejects.toThrow('TRASH_GENERATION_HOLD');
    expect(at(T + '/' + ID)).toEqual(newer);
});

it.each(['moved', 'ledger', 'flip', 'collected', 'undo'])('generation ៖ consumed កើតក្រោយ preflight read មិនឱ្យ stage %s បន្ត', async stage => {
    const trash = { ...at(H + '/' + ID), deletedAt: NOW - 1000, trashReason: 'remove', trashMode: 'local', trashGeneration: 1 };
    delete store[H][ID]; store[T][ID] = copy(trash); dataState.scanHistory = []; noteCleanupJournalEntry({ id: ID, reason: 'remove', stage, trashItem: trash, revenue: null });
    readHook = path => { if (path === T + '/' + ID) { readHook = null; delete store[T][ID]; store[TRASH_CONSUMPTIONS_ROOT] = { [ID]: consumption(ID, 1) }; } };
    await resumeCleanupJournalEntry(ID);
    expect(at(T + '/' + ID)).toBeNull(); expect(effects).toEqual([]); expect(readCleanupJournal()).toHaveLength(1);
});

it.each(['delete', 'remove', 'auto', 'clear'])('generation ៖ %s ប្រែ metadata ក្រោយ admission មិនលុប source ហើយ fresh retry រួច', async route => {
    const beforeMoney = { d: at(D), m: at(M) };
    const target = route === 'remove' ? cleanupPartialTrashId(ID, 'remove', at(H + '/' + ID)) : ID;
    let changed = false;
    readHook = path => {
        if (changed || path !== TRASH_CONSUMPTIONS_ROOT + '/' + target) return;
        changed = true; store[H][ID].phone = '999'; store[H][ID].barcodes[0].locker = 'B7';
    };
    const run = () => route === 'delete' ? deleteSingleItem(ID, { confirmed: true }) : route === 'remove' ? removeSingleBarcode(ID, 'GEN0001')
        : route === 'auto' ? claimAndCleanupItem(ID, 'abandon') : clearHistory();
    await run();
    expect(changed).toBe(true); expect(at(H + '/' + ID)?.barcodes[0]).toMatchObject({ code: 'GEN0001', locker: 'B7' });
    expect(at(H + '/' + ID)?.barcodes[0].trashClaim).toBeUndefined(); expect(at(T)).toEqual({});
    expect({ d: at(D), m: at(M) }).toEqual(beforeMoney);
    readHook = null; dataState.scanHistory = [at(H + '/' + ID)];
    for (let index = 0; index < 20; index++) await Promise.resolve();
    await run();
    const trash = Object.values(at(T) || {}) as any[]; expect(trash).toHaveLength(1);
    expect(trash[0]).toMatchObject({ trashGeneration: 1, phone: '999' }); expect(trash[0].barcodes[0].locker).toBe('B7');
});


it.each(['delete', 'remove'])('generation ៖ %s read unknown មិនប៉ះ source/money ហើយប្រាប់ HOLD', async route => {
    const beforeMoney = { d: at(D), m: at(M) };
    readHook = path => { if (path.startsWith(TRASH_CONSUMPTIONS_ROOT + '/')) throw new Error('unknown'); };
    if (route === 'delete') await deleteSingleItem(ID, { confirmed: true }); else await removeSingleBarcode(ID, 'GEN0001');
    expect(at(H + '/' + ID)?.barcodes[0].code).toBe('GEN0001'); expect(at(H + '/' + ID)?.barcodes[0].trashClaim).toBeUndefined();
    expect(at(T)).toEqual({}); expect({ d: at(D), m: at(M) }).toEqual(beforeMoney);
    expect(uiState.toasts.some((toast: any) => String(toast.msg).includes('រង់ចាំ'))).toBe(true);
});

it.each(['slot', 'moved', 'ledger', 'flip', 'collected', 'undo'])('generation ៖ legacy0 stage %s គ្មាន authoritative source ត្រូវ HOLD មិនទាយមុន rollout', async stage => {
    const trash = { ...at(H + '/' + ID), deletedAt: NOW - 1000, trashReason: 'remove', trashMode: 'local' };
    delete store[H][ID]; dataState.scanHistory = [];
    noteCleanupJournalEntry({ id: ID, reason: 'remove', stage, trashItem: trash, revenue: null });
    const before = copy(store); await resumeCleanupJournalEntry(ID);
    expect(store).toEqual(before); expect(effects).toEqual([]); expect(readCleanupJournal()).toHaveLength(1);
});


it('generation ៖ Clear UI retry ក្រោយ initial claim committed/ACK unknown រក្សា token/generation/time ដើម', async () => {
    let dropped = false;
    afterTransaction = (path, value) => {
        if (dropped || path !== H + '/' + ID || !value?.clearClaim) return;
        dropped = true; throw Object.assign(new Error('reply lost'), { txOutcome: 'unknown' });
    };
    await clearHistory();
    const originalClaim = at(H + '/' + ID)?.clearClaim;
    expect(dropped).toBe(true); expect(originalClaim).toMatchObject({ trashGeneration: 1, deletedAt: NOW }); expect(at(T)).toEqual({});
    afterTransaction = null; vi.setSystemTime(NOW + 1000);
    await clearHistory();
    expect(at(T + '/' + ID)).toMatchObject({ trashGeneration: originalClaim.trashGeneration, deletedAt: originalClaim.deletedAt });
    expect(at(H + '/' + ID)).toBeNull();
});


it.each([0, 1])('generation ៖ source ជំនាន់%s រស់ និងមិន consumed អាចបញ្ចប់ stage collected ដែលមិនប៉ះប្រាក់', async generation => {
    const trash = { ...at(H + '/' + ID), deletedAt: NOW - 1000, trashReason: 'delete', trashMode: 'local', trashGeneration: generation };
    delete store[H][ID]; store[T][ID] = copy(trash); dataState.scanHistory = [];
    noteCleanupJournalEntry({ id: ID, reason: 'delete', stage: 'collected', trashItem: trash, revenue: null });
    await resumeCleanupJournalEntry(ID); expect(readCleanupJournal()).toEqual([]); expect(at(T + '/' + ID)).toEqual(trash); expect(effects).toEqual([]);
});

it('generation ៖ journal ថ្មី1 អាចស្តារ source មិនទាន់សរសេរ ដោយមិន allocate ម្ដងទៀត', async () => {
    const trash = { ...at(H + '/' + ID), deletedAt: NOW - 1000, trashReason: 'delete', trashMode: 'local', trashGeneration: 1 };
    delete store[H][ID]; dataState.scanHistory = [];
    noteCleanupJournalEntry({ id: ID, reason: 'delete', stage: 'moved', trashItem: trash, revenue: null });
    await resumeCleanupJournalEntry(ID); expect(at(T + '/' + ID)).toEqual(trash); expect(readCleanupJournal()).toEqual([]);
});


it.each(['uid', 'sdk', 'scope'])('generation ៖ Clear loop មិនបន្ត old IDs ក្រោយ %s ប្ដូរតែ db ដដែល', async kind => {
    store[H].second = { ...at(H + '/' + ID), id: 'second', barcodes: [{ ...at(H + '/' + ID).barcodes[0], code: 'GEN0002' }] };
    dataState.scanHistory = [at(H + '/' + ID), at(H + '/second')]; let switched = false;
    afterUpdate = updates => {
        if (switched || updates[H + '/' + ID] !== null) return;
        switched = true;
        if (kind === 'uid') firebaseState.auth.currentUser.uid = 'other-member';
        if (kind === 'sdk') firebaseState.fb = { ...firebaseState.fb };
        if (kind === 'scope') (firebaseState.db as any).app.options.databaseURL = HOST + '/other';
    };
    await clearHistory();
    expect(switched).toBe(true); expect(at(H + '/second')?.barcodes[0].code).toBe('GEN0002');
    expect(at(T + '/second')).toBeNull();
});


it('generation ៖ Clear finally ចាស់មិនដោះ inFlight របស់ run ថ្មីក្រោយ session reset', async () => {
    const gate = () => { let resolve!: () => void; const promise = new Promise<void>(done => { resolve = done; }); return { promise, resolve }; };
    const enteredA = gate(), enteredB = gate(), releaseA = gate(), releaseB = gate();
    store[H].second = { ...at(H + '/' + ID), id: 'second', barcodes: [{ ...at(H + '/' + ID).barcodes[0], code: 'GEN0002' }] };
    afterUpdate = async updates => {
        if (updates[H + '/' + ID] === null) { enteredA.resolve(); await releaseA.promise; }
        if (updates[H + '/second'] === null) { enteredB.resolve(); await releaseB.promise; }
    };
    const old = clearHistory(); await enteredA.promise;
    firebaseState.authGeneration++; resetClearHistoryOperationState(); dataState.scanHistory = [at(H + '/second')];
    const current = clearHistory(); await enteredB.promise;
    releaseA.resolve(); await old;
    try { expect(dataState.clearHistoryInFlight).toBe(true); } finally { releaseB.resolve(); await current; }
    expect(dataState.clearHistoryInFlight).toBe(false);
});


it.each(['uid', 'sdk', 'scope'])('generation ៖ resume slot មិនយក owner ថ្មីក្រោយ %s ប្ដូរបន្ទាប់ preflight', async kind => {
    const trash = { ...at(H + '/' + ID), deletedAt: NOW - 1000, trashReason: 'delete', trashMode: 'local', trashGeneration: 1 };
    delete store[H][ID]; dataState.scanHistory = [];
    noteCleanupJournalEntry({ id: ID, reason: 'delete', stage: 'slot', trashItem: trash, revenue: null });
    let switched = false;
    sdkReadHook = path => {
        if (switched || path !== T + '/' + ID) return;
        switched = true;
        if (kind === 'uid') firebaseState.auth.currentUser.uid = 'other-member';
        if (kind === 'sdk') firebaseState.fb = { ...firebaseState.fb };
        if (kind === 'scope') (firebaseState.db as any).app.options.databaseURL = HOST + '/other';
    };
    await resumeCleanupJournalEntry(ID);
    expect(switched).toBe(true); expect(at(T + '/' + ID)).toBeNull(); expect(effects).toEqual([]);
});

it('generation ៖ Clear positive abort ដោះតែ token ខ្លួនឯង ហើយ retry ថ្មីបាន', async () => {
    beforeTransaction = (path, prior) => { if (path === H + '/' + ID && prior) prior.phone = 'changed-callback'; };
    await clearHistory();
    expect(activeClearHistoryClaims.has(ID)).toBe(false); expect(at(H + '/' + ID)?.clearClaim).toBeUndefined(); expect(at(T)).toEqual({});
    beforeTransaction = null; await clearHistory();
    expect(at(T + '/' + ID)?.trashGeneration).toBe(1); expect(at(H + '/' + ID)).toBeNull();
});

it('generation ៖ Clear unknown token មិនឆ្លង owner ទោះ db ដដែល', async () => {
    afterTransaction = (path, value) => { if (path === H + '/' + ID && value?.clearClaim) throw Object.assign(new Error('reply lost'), { txOutcome: 'unknown' }); };
    await clearHistory(); const original = at(H + '/' + ID)?.clearClaim;
    expect(activeClearHistoryClaims.get(ID)).toBe(original.token);
    afterTransaction = null; firebaseState.auth.currentUser.uid = 'other-member'; const before = copy(store); effects = [];
    await clearHistory(); expect(store).toEqual(before); expect(effects).toEqual([]); expect(at(T)).toEqual({});
});

it.each(['uid', 'scope'])('generation ៖ Delete មិនបញ្ជូន release claim ចាស់ក្រោយ %s ប្ដូរកណ្ដាល admission read', async kind => {
    let switched = false, afterSwitch = -1;
    readHook = path => {
        if (switched || !path.startsWith(TRASH_CONSUMPTIONS_ROOT + '/')) return;
        switched = true; afterSwitch = effects.length;
        if (kind === 'uid') firebaseState.auth.currentUser.uid = 'other-member';
        else (firebaseState.db as any).app.options.databaseURL = HOST + '/other';
    };
    await deleteSingleItem(ID, { confirmed: true });
    expect(switched).toBe(true); expect(effects.slice(afterSwitch)).toEqual([]);
    expect(at(H + '/' + ID)?.barcodes[0].code).toBe('GEN0001'); expect(at(T)).toEqual({});
});
