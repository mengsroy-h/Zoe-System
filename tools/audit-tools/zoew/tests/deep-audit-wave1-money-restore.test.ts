import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { dataState, firebaseState, uiState } from '../../../../ZoeW/src/core/state';
import { appLocalStore } from '../../../../ZoeW/src/core/storage';
import * as storageAdapter from '../../../../ZoeW/src/core/storage';
import { dbListenerFailedPaths, dbListenerPendingPaths } from '../../../../ZoeW/src/core/text';
import { getZoneDateKey } from '../../../../ZoeW/src/core/timezone';
import { barcodeCloseIsRipe, trashZtoFinalBlock } from '../../../../ZoeW/src/domain/barcode';
import { barcodeRegistryKey } from '../../../../ZoeW/src/domain/registry';
import * as cleanup from '../../../../ZoeW/src/domain/cleanup';
import * as pickup from '../../../../ZoeW/src/domain/pickup';
import { healPickupKeysLeftRow } from '../../../../ZoeW/src/domain/collected';
import { removeSingleBarcode, toggleIndividualBarcodeClose } from '../../../../ZoeW/src/features/barcode-ops';
import { deleteSingleItem } from '../../../../ZoeW/src/features/entry-ops';
import { activeRestoreClaims, executeRestoreItem, restoreInFlight } from '../../../../ZoeW/src/features/restore';
import { trashDisplayReasonOf } from '../../../../ZoeW/src/features/trash';
import { applyZtoFinalMarks, collectZtoFinalTargets, noteZtoReturnedEvidence, trashRestoreBlockOf, ztoReturnedEvidence } from '../../../../ZoeW/src/features/zto-final-marks';
import { acceptFixtureSession } from './helpers/accepted-session';
import { capturePriceOperation } from '../../../../ZoeW/src/services/row-operation-lock';
import { commitPriceOperation } from '../../../../ZoeW/src/services/price-operation';
import { captureTrashGenerationOwner } from '../../../../ZoeW/src/services/trash-generation';

const HISTORY = 'zoew_scan_history_cod_dod';
const TRASH = 'zoew_recently_deleted_cod_dod';
const PICKUP = 'zoew_daily_pickup_cod_dod';
const MIRROR = 'zoew_daily_collected_cod_dod';
const DAILY = 'zoew_daily_revenue_cod_dod';
const MONTHLY = 'zoew_monthly_revenue_cod_dod';
const POLICY = 'zoew_restore_policy/shop';
const H = 60 * 60 * 1000;
const NOW = Date.UTC(2026, 9, 5, 9, 30, 0);
const DAY = getZoneDateKey(NOW - 2 * H, 0);
const MONTH = DAY.substring(0, 7);
const PHONE = '0960007345';
const DB = { name: 'wave1-shop' };
const SCOPE = 'https://wave1-shop-default-rtdb.firebaseio.com';
const SHOP_CONFIG = JSON.stringify({ apiKey: 'k', databaseURL: SCOPE, projectId: 'p' });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const key = (code: string) => barcodeRegistryKey(code);

const lab = {
    store: {} as Record<string, any>,
    txHook: null as null | ((path: string, updater: any) => Promise<any> | null),
    updateHook: null as null | ((paths: string[], updates: Record<string, any>) => Promise<void> | null),
    getHook: null as null | ((path: string) => Promise<any> | null)
};

const clone = <T>(value: T): T => (value === undefined ? value : JSON.parse(JSON.stringify(value)));
const split = (path: string) => String(path || '').split('/').filter(Boolean);

function getAt(path: string) {
    let cur: any = lab.store;
    for (const part of split(path)) {
        if (cur === null || cur === undefined || typeof cur !== 'object') return null;
        cur = cur[part];
    }
    return cur === undefined ? null : clone(cur);
}

function setAt(path: string, value: any) {
    const parts = split(path);
    let cur: any = lab.store;
    for (let i = 0; i < parts.length - 1; i++) {
        if (cur[parts[i]] === null || cur[parts[i]] === undefined || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
        cur = cur[parts[i]];
    }
    if (value === null || value === undefined) delete cur[parts[parts.length - 1]];
    else cur[parts[parts.length - 1]] = clone(value);
}

const makeRef = (db: any, path = '') => ({ db, path: split(path).join('/'), key: split(path).pop() || null });
const snap = (ref: any, value: any) => ({ key: ref && ref.key, ref, val: () => clone(value), exists: () => value !== null && value !== undefined });

function makeFb() {
    return {
        ref: (db: any, path = '') => makeRef(db, path),
        increment: (n: number) => ({ __inc__: n }),
        get: async (ref: any) => {
            if (lab.getHook) {
                const custom = await lab.getHook(ref.path);
                if (custom !== null) return custom;
            }
            await sleep(1);
            return snap(ref, getAt(ref.path));
        },
        set: async (ref: any, value: any) => {
            await sleep(1);
            setAt(ref.path, value);
        },
        update: async (ref: any, updates: any) => {
            const keys = Object.keys(updates || {});
            const paths = keys.map((k) => [ref.path, k].filter(Boolean).join('/'));
            if (lab.updateHook) await lab.updateHook(paths, updates);
            await sleep(1);
            paths.forEach((path, i) => {
                let value = updates[keys[i]];
                if (value && typeof value === 'object' && value.__inc__ !== undefined) value = (Number(getAt(path)) || 0) + value.__inc__;
                setAt(path, value);
            });
        },
        runTransaction: (ref: any, updater: any) => {
            if (lab.txHook) {
                const custom = lab.txHook(ref.path, updater);
                if (custom !== null) return custom;
            }
            return sleep(1).then(() => {
                const prior = getAt(ref.path);
                const proposed = updater(clone(prior));
                if (proposed === undefined) return { committed: false, snapshot: snap(ref, prior) };
                setAt(ref.path, proposed);
                return { committed: true, snapshot: snap(ref, getAt(ref.path)) };
            });
        },
        onValue: () => () => {},
        off: () => {}
    };
}

function seedItem(id: string, codes: string[], closed: string[], codEach = 50, dodEach = 2) {
    const barcodes = codes.map((code) => {
        const b: any = { code, isClosed: closed.includes(code), cod: codEach, dod: dodEach, isDeducted: false, isFromDeletion: false, createdAt: NOW - 3 * H, time: '13:30:00', locker: 'A1' };
        if (b.isClosed) b.closedAt = NOW - 2 * H;
        return b;
    });
    const cod = barcodes.reduce((s: number, b: any) => s + b.cod, 0);
    const dod = barcodes.reduce((s: number, b: any) => s + b.dod, 0);
    const item: any = {
        id, phone: PHONE, scanDate: DAY, isClosed: barcodes.every((b: any) => b.isClosed), createdAt: NOW - 3 * H,
        cod, dod, price: cod + dod, count: codes.length, barcode: codes[0], time: '13:30:00 (' + DAY + ')', barcodes
    };
    if (item.isClosed) item.closedAt = NOW - 2 * H;
    setAt(HISTORY + '/' + id, item);
    codes.forEach((code) => setAt('zoew_barcode_registry/' + key(code), true));
    const pickedUp = barcodes.filter((b: any) => b.isClosed);
    pickedUp.forEach((b: any) => setAt(MIRROR + '/' + getZoneDateKey(b.closedAt, 0) + '/' + key(b.code), { c: b.cod, d: b.dod }));
    if (pickedUp.length) {
        const set: Record<string, string> = {};
        pickedUp.forEach((b: any) => { set[key(b.code)] = PHONE; });
        setAt(PICKUP + '/' + DAY, { packagesPickedUp: pickedUp.length, pickedUpPhones: { [PHONE]: pickedUp.length }, pickedUpBarcodes: set, pickupRevision: 1, pickupResetEpoch: 0 });
    }
    setAt(DAILY + '/' + DAY, { codDollar: 200, dodDollar: 20, totalCount: 10 });
    setAt(MONTHLY + '/' + MONTH, { codDollar: 200, dodDollar: 20, totalCount: 10 });
    setAt(POLICY, { v: 1, mode: 'local', scope: SCOPE, branch: '', epoch: 1 });
}

function loadViewsFromServer() {
    const list = (root: string) => {
        const raw = getAt(root) || {};
        return Object.keys(raw).map((k) => Object.assign({ id: k }, raw[k]));
    };
    dataState.scanHistory = list(HISTORY);
    dataState.deletedItems = list(TRASH);
    dataState.dailyPickupData = getAt(PICKUP) || {};
    dataState.dailyCollectedData = getAt(MIRROR) || {};
    dataState.dailyRevenueData = getAt(DAILY) || {};
    dataState.monthlyRevenueData = getAt(MONTHLY) || {};
}

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(NOW));
    lab.store = {};
    lab.txHook = null;
    lab.updateHook = null;
    lab.getHook = null;
    appLocalStore.clear();
    appLocalStore.setItem('zoew_firebase_config', SHOP_CONFIG);
    dbListenerPendingPaths.clear();
    dbListenerFailedPaths.clear();
    dataState.scanHistory = [];
    dataState.deletedItems = [];
    dataState.dailyRevenueData = {};
    dataState.monthlyRevenueData = {};
    dataState.dailyCollectedData = {};
    dataState.dailyPickupData = {};
    dataState.pickupResumeInFlight = false;
    dataState.cleanupResumeInFlight = false;
    uiState.toasts = [];
    uiState.pendingRestoreId = null;
    pickup.pickupIntentsLive.clear();
    cleanup.cleanupJournalLive.clear();
    cleanup.cleanupInFlight.clear();
    cleanup.purgeDeductionWaits.clear();
    activeRestoreClaims.clear();
    restoreInFlight.clear();
    ztoReturnedEvidence.clear();
    firebaseState.authGeneration++;
    firebaseState.auth = { currentUser: { uid: 'wave1-user' } } as any;
    firebaseState.db = DB as any;
    firebaseState.firebaseConfig = { databaseURL: SCOPE } as any;
    firebaseState.isDatabaseInitialized = true;
    firebaseState.dbListenersFailed = false;
    firebaseState.isDatabaseConnected = true;
    firebaseState.hasEverConnectedToDatabase = true;
    firebaseState.serverClockTrusted = true;
    firebaseState.serverTimeOffsetMs = 0;
    firebaseState.fb = makeFb() as any;
    acceptFixtureSession();
    for (const [name, path] of [
        ['dbRefHistory', HISTORY], ['dbRefDeleted', TRASH], ['dbRefDailyRevenue', DAILY],
        ['dbRefMonthlyRevenue', MONTHLY], ['dbRefDailyCollected', MIRROR],
        ['dbRefDailyPickup', PICKUP], ['dbRefRegistry', 'zoew_barcode_registry']
    ] as const) {
        (firebaseState as any)[name] = makeRef(DB, path);
    }
    firebaseState.dbLivenessProbe = Promise.resolve(null) as any;
    vi.stubGlobal('confirm', () => true);
    vi.stubGlobal('alert', vi.fn());
    (window as any).ZoeErrors = { capture: vi.fn() };
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete (window as any).ZoeErrors;
    firebaseState.dbLivenessProbe = null as any;
    firebaseState.serverClockTrusted = false;
    firebaseState.isDatabaseConnected = false;
    firebaseState.isDatabaseInitialized = false;
    appLocalStore.clear();
});

it('M-01៖ បើ post-commit pickup write បរាជ័យ មិនត្រូវ stamp pickupDone=true ពី optimistic write ទទេ — resume ត្រូវសង្គ្រោះ packagesPickedUp', async () => {
    seedItem('m01', ['M01A001', 'M01A002'], []);
    await pickup.capturePickupContext(DAY);
    loadViewsFromServer();
    let pickupTxs = 0;
    lab.txHook = (path, updater) => {
        if (path === HISTORY + '/m01') {
            return sleep(25).then(() => {
                const prior = getAt(path);
                const proposed = updater(clone(prior));
                if (proposed === undefined) return { committed: false, snapshot: snap(makeRef(DB, path), prior) };
                setAt(path, proposed);
                return { committed: true, snapshot: snap(makeRef(DB, path), getAt(path)) };
            });
        }
        if (path === PICKUP + '/' + DAY) {
            pickupTxs++;
            if (pickupTxs >= 2) return Promise.reject(new Error('network drop on post-commit pickup write'));
        }
        return null;
    };
    await toggleIndividualBarcodeClose('m01', 'M01A001');
    await sleep(40);
    expect(pickupTxs).toBeGreaterThanOrEqual(2);
    expect((getAt(PICKUP + '/' + DAY)?.pickedUpBarcodes || {})[key('M01A001')]).toBeUndefined();
    const journal = pickup.readPickupJournal();
    expect(journal).toHaveLength(1);
    expect(journal[0].pickupDone).not.toBe(true);

    lab.txHook = null;
    pickup.pickupIntentsLive.clear();
    loadViewsFromServer();
    await pickup.resumePickupIntents();
    await sleep(40);
    expect(Object.keys(getAt(PICKUP + '/' + DAY)?.pickedUpBarcodes || {})).toEqual([key('M01A001')]);
    expect(getAt(PICKUP + '/' + DAY)?.packagesPickedUp).toBe(1);
    expect(pickup.readPickupJournal()).toEqual([]);
});

it('M-03a៖ removeSingleBarcode ដែល abort (committed:false) ត្រូវលុប cleanup journal — មិនបង្កើតធុងសំរាមខ្មោច ឬកាត់ប្រាក់កញ្ចប់ដែលបានយករួច', async () => {
    seedItem('m03r', ['M03R001', 'M03R002'], [], 50, 2);
    loadViewsFromServer();
    let historyTxs = 0;
    lab.txHook = (path) => {
        if (path === HISTORY + '/m03r') {
            historyTxs++;
            if (historyTxs === 2) {
                const current = getAt(path);
                current.phone = '0969999999';
                setAt(path, current);
            }
        }
        return null;
    };
    const outcome = await removeSingleBarcode('m03r', 'M03R001');
    expect(outcome).toBe('failed');
    expect(cleanup.readCleanupJournal()).toEqual([]);

    setAt(HISTORY + '/m03r', null);
    setAt(TRASH, null);
    lab.txHook = null;
    loadViewsFromServer();
    await cleanup.resumeInterruptedCleanups();
    await sleep(30);
    expect(getAt(TRASH)).toBeNull();
    expect(getAt(DAILY + '/' + DAY)).toEqual({ codDollar: 200, dodDollar: 20, totalCount: 10 });
    expect(getAt(MONTHLY + '/' + MONTH)).toEqual({ codDollar: 200, dodDollar: 20, totalCount: 10 });
});

it('M-03b៖ deleteSingleItem ដែល abort ឬ rollback ត្រូវលុប cleanup journal — មិនសង្គ្រោះជួរដែលបាន purge ត្រឡប់ចូលធុងសំរាម', async () => {
    seedItem('m03d', ['M03D001'], [], 30, 1);
    loadViewsFromServer();
    let historyTxs = 0;
    lab.txHook = (path) => {
        if (path === HISTORY + '/m03d') {
            historyTxs++;
            if (historyTxs === 2) {
                const current = getAt(path);
                current.phone = '0968888888';
                setAt(path, current);
            }
        }
        return null;
    };
    const outcome = await deleteSingleItem('m03d', { confirmed: true, quiet: true });
    expect(outcome).toBe('blocked');
    expect(cleanup.readCleanupJournal()).toEqual([]);

    setAt(HISTORY + '/m03d', null);
    setAt(TRASH, null);
    lab.txHook = null;
    loadViewsFromServer();
    await cleanup.resumeInterruptedCleanups();
    await sleep(30);
    expect(getAt(TRASH)).toBeNull();
});

it('M-11៖ cleanup journal ពហុជំនាន់សម្រាប់ trashItem.id ដូចគ្នា មិនត្រូវឱ្យជំនាន់ចាស់បិទបាំងជំនាន់ថ្មីក្នុង deduct/resume', async () => {
    seedItem('m11', ['M11B001'], [], 25, 1);
    const baseTrash = {
        id: 'm11_slot', phone: PHONE, scanDate: DAY, createdAt: NOW - 3 * H,
        trashReason: 'remove', trashMode: 'local', isFromDeletion: false,
        cod: 25, dod: 1, price: 26, count: 1,
        barcodes: [{ code: 'M11B001', cod: 25, dod: 1, isClosed: false, isDeducted: false, createdAt: NOW - 3 * H }]
    };
    const gen1 = { ...clone(baseTrash), trashGeneration: 1, deletedAt: NOW - 2000 };
    const gen2 = { ...clone(baseTrash), trashGeneration: 2, deletedAt: NOW - 1000 };
    const rev = { scanDate: DAY, cod: 25, dod: 1, count: 1 };
    cleanup.noteCleanupJournalEntry({ id: 'm11', reason: 'remove', journalId: 'j_gen1', journalAt: NOW - 2000, stage: cleanup.CLEANUP_STAGE_COLLECTED, trashItem: gen1, revenue: rev, pickupHold: 'reset-cancelled' });
    cleanup.noteCleanupJournalEntry({ id: 'm11', reason: 'remove', journalId: 'j_gen2', journalAt: NOW - 1000, stage: cleanup.CLEANUP_STAGE_MOVED, trashItem: gen2, revenue: rev });
    setAt(TRASH + '/m11_slot', gen2);
    loadViewsFromServer();
    const state = await cleanup.deductCleanupRevenue('m11', gen2, rev);
    expect(state).toBe('deducted');
    expect(getAt(DAILY + '/' + DAY + '/ded/m11_slot')).toMatchObject({ at: gen2.deletedAt, cod: 25, dod: 1, count: 1 });
});

it('M-12a៖ executeRestoreItem ដែលបរាជ័យមុន applyClaimedRestoreToHistory (RESTORE_IN_PROGRESS) មិនត្រូវបន្សល់ protocol:3 pickup journal ជាប់ recovery-pending ជារៀងរហូត', async () => {
    seedItem('m12a', ['M12A001', 'M12A002'], ['M12A001'], 40, 2);
    loadViewsFromServer();
    expect(await removeSingleBarcode('m12a', 'M12A001')).toBe('done');
    await sleep(30);
    const trashId = Object.keys(getAt(TRASH) || {})[0];
    expect(trashId).toBeTruthy();
    setAt(TRASH + '/' + trashId + '/restoreClaim', { token: 'other-device-token', targetId: 'm12a', claimedAt: NOW });
    loadViewsFromServer();
    uiState.pendingRestoreId = trashId;
    await executeRestoreItem();
    await sleep(30);
    expect(pickup.readPickupJournal()).toEqual([]);

    setAt(TRASH + '/' + trashId + '/restoreClaim', null);
    setAt(DAILY + '/' + DAY, null);
    dataState.dailyRevenueData = {};
    loadViewsFromServer();
    dataState.dailyRevenueData = {};
    uiState.pendingRestoreId = trashId;
    await executeRestoreItem();
    await sleep(30);
    expect(pickup.readPickupJournal()).toEqual([]);
});

it('M-12b៖ restore កញ្ចប់ remove ដែលបិទរួច មិនត្រូវលុប pickup journal មុន reconcileCollectedHistory ជោគជ័យ — resume ត្រូវសង្គ្រោះ daily_collected', async () => {
    seedItem('m12b', ['M12B001', 'M12B002'], ['M12B001'], 45, 3);
    loadViewsFromServer();
    expect(await removeSingleBarcode('m12b', 'M12B001')).toBe('done');
    await sleep(30);
    const trashId = Object.keys(getAt(TRASH) || {})[0];
    expect(getAt(MIRROR + '/' + DAY + '/' + key('M12B001'))).toBeNull();
    let failMirror = true;
    lab.updateHook = async (paths) => {
        if (failMirror && paths.some((p) => p.startsWith(MIRROR + '/'))) throw new Error('collected mirror write dropped');
    };
    loadViewsFromServer();
    uiState.pendingRestoreId = trashId;
    await executeRestoreItem();
    await sleep(30);
    expect(getAt(MIRROR + '/' + DAY + '/' + key('M12B001'))).toBeNull();
    expect(pickup.readPickupJournal()).toHaveLength(1);

    failMirror = false;
    pickup.pickupIntentsLive.clear();
    loadViewsFromServer();
    await pickup.resumePickupIntents();
    await sleep(30);
    expect(getAt(MIRROR + '/' + DAY + '/' + key('M12B001'))).toEqual({ c: 45, d: 3 });
    expect(pickup.readPickupJournal()).toEqual([]);
});

it('M-12c៖ saveRestoreClaim(id, null) បរាជ័យក្រោយ finalizeClaimedRestore commit រួច មិនត្រូវចេញ alert ថាបរាជ័យ', async () => {
    seedItem('m12c', ['M12C001'], [], 20, 1);
    loadViewsFromServer();
    expect(await deleteSingleItem('m12c', { confirmed: true, quiet: true })).toBe('deleted');
    await sleep(20);
    const trashId = Object.keys(getAt(TRASH) || {})[0];
    const origSet = storageAdapter.safeStoreSet;
    vi.spyOn(storageAdapter, 'safeStoreSet').mockImplementation((store, k, v) => {
        if (k === 'zoew_restore_intents_v1' && v === '{}') return false;
        return origSet(store, k, v);
    });
    loadViewsFromServer();
    uiState.pendingRestoreId = trashId;
    await executeRestoreItem();
    await sleep(20);
    expect(getAt(HISTORY + '/m12c')).toBeTruthy();
    expect(getAt(TRASH + '/' + trashId)).toBeNull();
    expect(window.alert).not.toHaveBeenCalled();
});

it('M-13a៖ កញ្ចប់ត្រឡប់ដែលមាន ztoSentOutAt/ztoMisplacedAt ចាស់ និង ztoReturnedAt ថ្មីជាង ត្រូវបិទស្តារ និងបង្ហាញ «ត្រឡប់» ទោះក្រោយ reload គ្រប់ mode (cookie/local/legacy)', () => {
    for (const trashMode of ['cookie', 'local', undefined] as const) {
        const item: any = {
            id: 'm13a_' + String(trashMode || 'legacy'), phone: PHONE, scanDate: DAY, createdAt: NOW - 4 * H, deletedAt: NOW - H,
            trashReason: 'returned', isFromDeletion: false,
            ...(trashMode ? { trashMode } : {}),
            barcodes: [{ code: 'M13A001', createdAt: NOW - 4 * H, ztoSentOutAt: NOW - 3 * H, ztoReturnedAt: NOW - 2 * H, isClosed: false, isDeducted: true }]
        };
        expect(trashRestoreBlockOf(item)).toBe('returned');
        expect(trashDisplayReasonOf(item)).toBe('returned');
    }
});

it('M-13b៖ កញ្ចប់ misplaced (ztoReturnedAt=T1, ztoMisplacedAt=T1) ដែល ZTO ស្កេនត្រឡប់ពិតនៅ T2>T1 ត្រូវអាប់ដេត ztoReturnedAt=T2 លើ server តែម្ដង (មិនប្តូរទៅ T3 ទៀត)', () => {
    const t1 = NOW - 3 * H;
    const t2 = NOW - H;
    const t3 = NOW - 10 * 60 * 1000;
    const item = {
        id: 'm13b', phone: PHONE, scanDate: DAY, createdAt: NOW - 4 * H, deletedAt: t1,
        trashReason: 'returned', trashMode: 'cookie', isFromDeletion: false,
        barcodes: [{ code: 'M13B001', createdAt: NOW - 4 * H, ztoReturnedAt: t1, ztoMisplacedAt: t1, isClosed: false, isDeducted: true }]
    };
    dataState.deletedItems = [clone(item)];
    noteZtoReturnedEvidence('M13B001', t2, 'returned');
    const targets = collectZtoFinalTargets();
    expect(targets).toHaveLength(1);
    const updated = applyZtoFinalMarks(clone(item), targets[0].wanted, true);
    expect(updated).toBeTruthy();
    expect(updated.barcodes[0].ztoReturnedAt).toBe(t2);

    dataState.deletedItems = [clone(updated)];
    noteZtoReturnedEvidence('M13B001', t3, 'returned');
    expect(collectZtoFinalTargets()).toHaveLength(0);
    expect(applyZtoFinalMarks(clone(updated), { [key('M13B001')]: { returned: t3 } }, true)).toBeUndefined();
});

it('M-17a៖ removeSingleBarcode collectedDrop យឺតដែលមកដល់ក្រោយ Restore ត្រូវជួសជុល daily_collected វិញ (មិនលុបប្រាក់ដែលបានស្តារ)', async () => {
    seedItem('m17a', ['M17A001', 'M17A002'], ['M17A001'], 55, 2);
    loadViewsFromServer();
    let releaseSlowCollected!: () => void;
    let collectedDropStarted!: () => void;
    const waitCollectedDrop = new Promise<void>((resolve) => { collectedDropStarted = resolve; });
    let delayedOnce = false;
    lab.updateHook = async (paths, updates) => {
        const target = MIRROR + '/' + DAY + '/' + key('M17A001');
        const matchKey = Object.keys(updates).find((k) => k.endsWith(key('M17A001')));
        if (!delayedOnce && paths.includes(target) && matchKey && updates[matchKey] === null) {
            delayedOnce = true;
            collectedDropStarted();
            await new Promise<void>((resolve) => { releaseSlowCollected = resolve; });
        }
    };
    const removePromise = removeSingleBarcode('m17a', 'M17A001');
    await waitCollectedDrop;
    for (let i = 0; i < 40 && cleanup.readCleanupJournal()[0]?.stage !== 'collected'; i++) await sleep(15);
    const trashId = Object.keys(getAt(TRASH) || {})[0];
    expect(trashId).toBeTruthy();
    loadViewsFromServer();
    uiState.pendingRestoreId = trashId;
    await executeRestoreItem();
    expect(getAt(MIRROR + '/' + DAY + '/' + key('M17A001'))).toEqual({ c: 55, d: 2 });

    releaseSlowCollected();
    await removePromise;
    for (let i = 0; i < 60 && cleanup.readCleanupJournal().length > 0; i++) await sleep(15);
    expect(getAt(MIRROR + '/' + DAY + '/' + key('M17A001'))).toEqual({ c: 55, d: 2 });
    expect(cleanup.readCleanupJournal()).toEqual([]);
});

it('M-17b៖ commitPriceOperation លើខែដែលបាន trim (>3 ខែ) មិនត្រូវបង្កើតខែចាស់ឡើងវិញ ហើយបញ្ចុះតម្លៃមិនត្រូវបដិសេធ underflow', async () => {
    const oldDay = '2026-04-10';
    const oldMonth = '2026-04';
    setAt(DAILY + '/' + oldDay, { codDollar: 100, dodDollar: 10, totalCount: 5 });
    setAt(MONTHLY + '/2026-08', { codDollar: 100, dodDollar: 10, totalCount: 5 });
    setAt(MONTHLY + '/2026-09', { codDollar: 100, dodDollar: 10, totalCount: 5 });
    setAt(MONTHLY + '/2026-10', { codDollar: 100, dodDollar: 10, totalCount: 5 });

    const makeHandle = (id: string, priorCod: number, wantCod: number) => {
        const code = 'M17B_' + id;
        const row: any = {
            id, phone: PHONE, scanDate: oldDay, createdAt: NOW - 10 * H,
            cod: priorCod, dod: 2, price: priorCod + 2, count: 1, barcode: code,
            barcodes: [{ code, cod: priorCod, dod: 2, isClosed: false, isDeducted: false, createdAt: NOW - 10 * H }]
        };
        const handle = capturePriceOperation(row, code, wantCod, 2)!;
        expect(handle).toBeTruthy();
        setAt(HISTORY + '/' + id, { ...row, pricePending: handle.marker });
        return handle;
    };

    const up = await commitPriceOperation(makeHandle('inc', 20, 25), () => true);
    expect(up).toBe('committed');
    expect(getAt(MONTHLY + '/' + oldMonth)).toBeNull();
    expect(getAt(DAILY + '/' + oldDay + '/codDollar')).toBe(105);

    const down = await commitPriceOperation(makeHandle('dec', 20, 15), () => true);
    expect(down).toBe('committed');
    expect(getAt(MONTHLY + '/' + oldMonth)).toBeNull();
    expect(getAt(DAILY + '/' + oldDay + '/codDollar')).toBe(100);
});

it('M-17c៖ sparse-object barcodes (RTDB raw shape) មិនត្រូវបាត់ restore block ឬលុប pickup key ពេល heal', async () => {
    const sparseTrash: any = {
        id: 'm17c_trash', trashReason: 'remove', trashMode: 'cookie', createdAt: NOW - 4 * H, deletedAt: NOW - H,
        barcodes: { '1': { code: 'M17C001', ztoSignedAt: NOW - 2 * H, isClosed: true, isDeducted: true, createdAt: NOW - 4 * H } }
    };
    expect(trashZtoFinalBlock(sparseTrash)).toBe('signed');
    expect(trashRestoreBlockOf(sparseTrash)).toBe('signed');

    const sparseHistory: any = {
        id: 'm17c_hist', phone: PHONE, scanDate: DAY, createdAt: NOW - 3 * H,
        barcodes: { '1': { code: 'M17C002', cod: 10, dod: 1, isClosed: true, closedAt: NOW - H, createdAt: NOW - 3 * H } }
    };
    expect(pickup.collectPickupMarks(sparseHistory)).toHaveLength(1);
    setAt(HISTORY + '/m17c_hist', sparseHistory);
    setAt(PICKUP + '/' + DAY, { packagesPickedUp: 1, pickedUpPhones: { [PHONE]: 1 }, pickedUpBarcodes: { [key('M17C002')]: PHONE }, pickupRevision: 2, pickupResetEpoch: 0 });
    const ctx = await pickup.capturePickupContext(DAY);
    const healed = healPickupKeysLeftRow('m17c_hist', {
        scanDate: DAY, marks: [{ key: key('M17C002'), phoneKey: PHONE, closed: true }],
        previous: [], changed: true, commit: Promise.resolve(true), context: ctx
    });
    expect(await healed.commit).toBe(true);
    expect(Object.keys(getAt(PICKUP + '/' + DAY)?.pickedUpBarcodes || {})).toEqual([key('M17C002')]);
});

it('M-17d៖ settlePurgeDeduction ត្រូវឈប់បើ trash លើ server មាន restoreClaim សកម្ម និង barcodeCloseIsRipe(local) ត្រូវបដិសេធ closedAt=0', async () => {
    expect(barcodeCloseIsRipe({ isClosed: true, closedAt: 0 }, NOW, 'local')).toBe(false);
    const expiredAt = NOW - 4 * 24 * H;
    const trash: any = {
        id: 'm17d', phone: PHONE, scanDate: DAY, createdAt: expiredAt - H, deletedAt: expiredAt,
        trashReason: 'returned', trashMode: 'local', isFromDeletion: false,
        restoreClaim: { token: 'active-token', targetId: 'm17d', claimedAt: NOW },
        cod: 30, dod: 2, price: 32, count: 1,
        barcodes: [{ code: 'M17D001', cod: 30, dod: 2, isClosed: false, isDeducted: false, createdAt: expiredAt - H }]
    };
    setAt(DAILY + '/' + DAY, { codDollar: 200, dodDollar: 20, totalCount: 10 });
    setAt(MONTHLY + '/' + MONTH, { codDollar: 200, dodDollar: 20, totalCount: 10 });
    setAt(TRASH + '/m17d', trash);
    loadViewsFromServer();
    const owner = captureTrashGenerationOwner();
    const settled = await cleanup.settlePurgeDeduction({ id: 'm17d', source: trash }, owner, () => true);
    expect(settled).toBeNull();
    expect(getAt(DAILY + '/' + DAY + '/ded/m17d')).toBeNull();
});

it('M-17e៖ removeSingleBarcode ប្ដូរ session កណ្ដាល await remarkCleanupCollectedKept ត្រូវត្រឡប់ stale ដោយមិនលោត toast ជោគជ័យលើហាងថ្មី', async () => {
    seedItem('m17e', ['M17E001', 'M17E002'], ['M17E001']);
    setAt(DAILY + '/' + DAY, { codDollar: 100, dodDollar: 4, totalCount: 2 });
    setAt(MONTHLY + '/' + MONTH, { codDollar: 100, dodDollar: 4, totalCount: 2 });
    setAt(PICKUP + '/' + DAY, { packagesPickedUp: 1, pickedUpPhones: { [PHONE]: 1 }, pickedUpBarcodes: { [key('M17E001')]: PHONE }, pickupRevision: 2, pickupResetEpoch: 0 });
    setAt(MIRROR + '/' + DAY, { [key('M17E001')]: { c: 50, d: 2 } });
    loadViewsFromServer();
    let switched = false;
    lab.getHook = (path) => {
        const trash = getAt(TRASH);
        const trashItem = trash && Object.values(trash)[0] as any;
        if (!switched && path === PICKUP + '/' + DAY && trashItem?.barcodes?.every((b: any) => b?.isDeducted === true)) {
            switched = true;
            firebaseState.authGeneration++;
            return Promise.resolve(snap(makeRef(DB, path), getAt(path)));
        }
        return null;
    };
    uiState.toasts = [];
    const res = await removeSingleBarcode('m17e', 'M17E001');
    expect(res).toBe('stale');
    expect(uiState.toasts.some((t: any) => String(t.msg || t).includes('បានដកកញ្ចប់អីវ៉ាន់'))).toBe(false);
});

it('M-17f៖ pickupIntentTracker.note ត្រូវជំនួស speculative pre-confirm commit ដោយ post-confirm pickupCommit និងរក្សា confirmed pickupCommit ពី heal note បន្ទាប់ (A461)', async () => {
    setAt(PICKUP + '/' + DAY, { packagesPickedUp: 0, pickupRevision: 1, pickupResetEpoch: 0 });
    const specTracker = pickup.pickupIntentTracker(() => true, 'm17f_spec');
    expect(await specTracker.prepare(DAY, [key('M17F000')])).toBeTruthy();
    expect(specTracker.start()).toBe(true);
    specTracker.note({ marks: [{ key: key('M17F000'), phoneKey: PHONE, closed: true }], commit: Promise.resolve(null) });
    expect(specTracker.confirm([key('M17F000')])).toBe(true);
    specTracker.note({ marks: [{ key: key('M17F000'), phoneKey: PHONE, closed: true }], pickupCommit: Promise.resolve(true), commit: Promise.resolve(true) });
    expect(await specTracker.finish(Promise.resolve(true))).toBe(true);

    const extraTracker = pickup.pickupIntentTracker(() => true, 'm17f_extra');
    expect(await extraTracker.prepare(DAY, [key('M17F002'), key('M17F003')])).toBeTruthy();
    expect(extraTracker.start()).toBe(true);
    expect(extraTracker.confirm([key('M17F002'), key('M17F003')])).toBe(true);
    extraTracker.note({ marks: [{ key: key('M17F002'), phoneKey: PHONE, closed: true }], commit: Promise.resolve(true) });
    extraTracker.note({ marks: [{ key: key('M17F002'), phoneKey: PHONE, closed: true }, { key: key('M17F003'), phoneKey: PHONE, closed: true }], commit: Promise.resolve(null) });
    expect(await extraTracker.finish(Promise.resolve(true))).toBe(false);
    expect(pickup.readPickupJournal().some((entry: any) => entry.item === 'm17f_extra' && entry.pickupDone === true)).toBe(false);

    const phoneTracker = pickup.pickupIntentTracker(() => true, 'm17f_phone');
    expect(await phoneTracker.prepare(DAY, [key('M17F004')])).toBeTruthy();
    expect(phoneTracker.start()).toBe(true);
    expect(phoneTracker.confirm([key('M17F004')])).toBe(true);
    phoneTracker.note({ marks: [{ key: key('M17F004'), phoneKey: '011111111', closed: true }], commit: Promise.resolve(true) });
    phoneTracker.note({ marks: [{ key: key('M17F004'), phoneKey: '022222222', closed: true }], commit: Promise.resolve(null) });
    expect(await phoneTracker.finish(Promise.resolve(true))).toBe(false);
    expect(pickup.readPickupJournal().some((entry: any) => entry.item === 'm17f_phone' && entry.pickupDone === true)).toBe(false);

    const reopenTracker = pickup.pickupIntentTracker(() => true, 'm17f_reopen');
    expect(await reopenTracker.prepare(DAY, [key('M17F005'), key('M17F006')])).toBeTruthy();
    expect(reopenTracker.start()).toBe(true);
    expect(reopenTracker.confirm([key('M17F005'), key('M17F006')])).toBe(true);
    reopenTracker.note({ marks: [{ key: key('M17F005'), phoneKey: PHONE, closed: false }], commit: Promise.resolve(true) });
    reopenTracker.note({ marks: [{ key: key('M17F005'), phoneKey: PHONE, closed: false }, { key: key('M17F006'), phoneKey: PHONE, closed: false }], commit: Promise.resolve(null) });
    expect(await reopenTracker.finish(Promise.resolve(true))).toBe(false);
    expect(pickup.readPickupJournal().some((entry: any) => entry.item === 'm17f_reopen' && entry.pickupDone === true)).toBe(false);

    const existingTracker = pickup.pickupIntentTracker(() => true, 'm17f_existing');
    expect(await existingTracker.prepare(DAY, [key('M17F007')])).toBeTruthy();
    expect(existingTracker.start()).toBe(true);
    expect(existingTracker.confirm([key('M17F007')])).toBe(true);
    existingTracker.note({ existingOnly: true, marks: [{ key: key('M17F007'), phoneKey: PHONE, closed: true }], commit: Promise.resolve(true) });
    existingTracker.note({ marks: [{ key: key('M17F007'), phoneKey: PHONE, closed: true }], commit: Promise.resolve(null) });
    expect(await existingTracker.finish(Promise.resolve(true))).toBe(false);
    expect(pickup.readPickupJournal().some((entry: any) => entry.item === 'm17f_existing' && entry.pickupDone === true)).toBe(false);

    const subsetTracker = pickup.pickupIntentTracker(() => true, 'm17f_subset');
    expect(await subsetTracker.prepare(DAY, [key('M17F008'), key('M17F009')])).toBeTruthy();
    expect(subsetTracker.start()).toBe(true);
    expect(subsetTracker.confirm([key('M17F008'), key('M17F009')])).toBe(true);
    subsetTracker.note({ marks: [{ key: key('M17F008'), phoneKey: PHONE, closed: false }, { key: key('M17F009'), phoneKey: PHONE, closed: false }], commit: Promise.resolve(true) });
    subsetTracker.note({ marks: [{ key: key('M17F008'), phoneKey: PHONE, closed: false }], excludedReverted: true, commit: Promise.resolve(null) });
    expect(await subsetTracker.finish(Promise.resolve(true))).toBe(false);
    expect(pickup.readPickupJournal().some((entry: any) => entry.item === 'm17f_subset' && entry.pickupDone === true)).toBe(false);

    const revertTracker = pickup.pickupIntentTracker(() => true, 'm17f_revert');
    expect(await revertTracker.prepare(DAY, [key('M17F010')])).toBeTruthy();
    expect(revertTracker.start()).toBe(true);
    expect(revertTracker.confirm([key('M17F010')])).toBe(true);
    revertTracker.note({ marks: [{ key: key('M17F010'), phoneKey: PHONE, closed: false }], commit: Promise.resolve(true) });
    revertTracker.note({ marks: undefined, reverted: true, commit: Promise.resolve(null) });
    expect(await revertTracker.finish(Promise.resolve(true))).toBe(false);
    expect(pickup.readPickupJournal().some((entry: any) => entry.item === 'm17f_revert' && entry.pickupDone === true)).toBe(false);

    const tracker = pickup.pickupIntentTracker(() => true, 'm17f');
    const ctx = await tracker.prepare(DAY, [key('M17F001')]);
    expect(ctx).toBeTruthy();
    expect(tracker.start()).toBe(true);
    expect(tracker.confirm([key('M17F001')])).toBe(true);
    tracker.note({ commit: Promise.resolve(true) });
    tracker.note({ commit: Promise.resolve(null) });
    const finished = await tracker.finish(Promise.resolve(true));
    expect(finished).toBe(false);
    expect(pickup.readPickupJournal().some((entry: any) => entry.item === 'm17f' && entry.pickupDone === true)).toBe(true);
});
