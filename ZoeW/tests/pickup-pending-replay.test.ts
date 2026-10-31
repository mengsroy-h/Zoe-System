import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { dataState, firebaseState, uiState, ztoState } from '../src/core/state';
import { appLocalStore } from '../src/core/storage';
import { dbListenerFailedPaths, dbListenerPendingPaths } from '../src/core/text';
import { toggleCloseStatus } from '../src/features/entry-ops';
import { restoreInFlight, activeRestoreClaims } from '../src/features/restore';
import { applyBarcodeCloseChange } from '../src/features/barcode-ops';
import { pickupIntentsLive, patchPickupJournalEntry, readPickupJournal, resumePickupIntents } from '../src/domain/pickup';

const NOW = Date.UTC(2026, 9, 30, 9), DAY = '2026-10-30';
const HISTORY = 'zoew_scan_history_cod_dod', PICKUP = 'zoew_daily_pickup_cod_dod';
const clone = (value: any) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
let tree: Record<string, any>, writes: string[], gate: null | (() => Promise<void>);
function get(path: string) { let current: any = tree; for (const part of path.split('/').filter(Boolean)) current = current?.[part]; return clone(current ?? null); }
function put(path: string, value: any) {
    const parts = path.split('/').filter(Boolean); let current = tree;
    for (const part of parts.slice(0, -1)) current = current[part] ||= {};
    if (value == null) delete current[parts.at(-1)!]; else current[parts.at(-1)!] = clone(value);
}
function load() {
    dataState.scanHistory = Object.values(clone(tree[HISTORY] || {}));
    dataState.deletedItems = Object.values(clone(tree.zoew_recently_deleted_cod_dod || {}));
    dataState.dailyPickupData = clone(tree[PICKUP] || {});
    dataState.dailyCollectedData = clone(tree.zoew_daily_collected_cod_dod || {});
}
function seed(codes = ['ONE']) {
    const barcodes = codes.map(code => ({ code, cod: 12.5, dod: 0, createdAt: NOW - 3600000, isClosed: false, isDeducted: false, locker: 'A1' }));
    tree = { [HISTORY]: { target: { id: 'target', phone: '012345678', scanDate: DAY, createdAt: NOW - 3600000, isClosed: false, barcodes,
        count: codes.length, cod: 12.5 * codes.length, dod: 0, price: 12.5 * codes.length, barcode: codes[0], time: 't' } },
        zoew_barcode_registry: Object.fromEntries(codes.map(code => [code, true])),
        zoew_daily_revenue_cod_dod: { [DAY]: { codDollar: 12.5 * codes.length, dodDollar: 0, totalCount: codes.length } },
        zoew_monthly_revenue_cod_dod: { '2026-10': { codDollar: 12.5 * codes.length, dodDollar: 0, totalCount: codes.length } } };
    load();
}

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(NOW);
    appLocalStore.clear(); appLocalStore.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: 'https://proof-test.firebaseio.com' }));
    writes = []; gate = null; pickupIntentsLive.clear(); restoreInFlight.clear(); activeRestoreClaims.clear();
    ztoState.ztoTrashMode = { state: 'off', palmAt: 0, cookieAt: 0, failedAt: 0, stamps: {}, shop: 'https://proof-test.firebaseio.com' }; dbListenerFailedPaths.clear(); dbListenerPendingPaths.clear();
    firebaseState.authGeneration++;
    firebaseState.auth = { currentUser: { uid: 'proof-user' } } as any;
    firebaseState.db = { app: { options: { databaseURL: 'https://proof-test.firebaseio.com' } } } as any;
    firebaseState.isInitializingFirebase = false; firebaseState.isDatabaseInitialized = true; firebaseState.isDatabaseConnected = true;
    firebaseState.dbListenersFailed = false; firebaseState.serverClockTrusted = true; firebaseState.serverTimeOffsetMs = 0;
    firebaseState.fb = {
        ref: (_db: any, path = '') => ({ path }), get: async (ref: any) => ({ val: () => get(ref.path), exists: () => get(ref.path) !== null }),
        update: async (ref: any, values: Record<string, any>) => { for (const [key, value] of Object.entries(values)) put(ref.path + '/' + key, value); writes.push(ref.path); },
        runTransaction: async (ref: any, update: (value: any) => any) => {
            const next = update(get(ref.path));
            if (next === undefined) return { committed: false, snapshot: { val: () => get(ref.path) } };
            put(ref.path, next); writes.push(ref.path);
            const saved = get(ref.path);
            if (gate && ref.path === HISTORY + '/target') await gate();
            return { committed: true, snapshot: { val: () => saved } };
        }
    } as any;
    for (const [field, path] of Object.entries({ dbRefHistory: HISTORY, dbRefDeleted: 'zoew_recently_deleted_cod_dod', dbRefDailyPickup: PICKUP,
        dbRefDailyCollected: 'zoew_daily_collected_cod_dod', dbRefDailyRevenue: 'zoew_daily_revenue_cod_dod', dbRefMonthlyRevenue: 'zoew_monthly_revenue_cod_dod' })) (firebaseState as any)[field] = { path };
    uiState.toasts = []; dataState.dailyRevenueData = {}; dataState.monthlyRevenueData = {}; dataState.pickupResumeInFlight = false;
    vi.stubGlobal('confirm', () => true); vi.stubGlobal('alert', () => undefined);
    seed();
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); appLocalStore.clear(); });

async function offlineClose(kind = 'whole', reopen = false, landed = false) {
    if (reopen) {
        tree[HISTORY].target.isClosed = true; tree[HISTORY].target.closedAt = NOW - 10000;
        tree[HISTORY].target.barcodes.forEach((barcode: any) => { barcode.isClosed = true; barcode.closedAt = NOW - 10000; });
    }
    tree[PICKUP] ||= { [DAY]: { pickupRevision: 1, pickupResetEpoch: 0, packagesPickedUp: reopen ? 1 : 0,
        ...(reopen ? { pickedUpBarcodes: { ONE: '012345678' }, pickedUpPhones: { '012345678': 1 } } : {}) } };
    load();
    const api = firebaseState.fb as any, transact = api.runTransaction;
    let reached!: () => void, release!: () => void, originalUpdater: any;
    const entered = new Promise<void>(resolve => { reached = resolve; });
    const held = new Promise<void>(resolve => { release = resolve; });
    api.runTransaction = async (ref: any, updater: any) => {
        if (ref.path.startsWith(PICKUP)) return new Promise(() => {});
        if (ref.path !== HISTORY + '/target') return transact(ref, updater);
        originalUpdater = updater;
        const proposed = updater(get(ref.path));
        if (landed && proposed !== undefined) { put(ref.path, proposed); writes.push(ref.path); }
        reached(); await held;
        return { committed: landed, snapshot: { val: () => get(ref.path) } };
    };
    const pending = kind === 'whole' ? toggleCloseStatus('target') : applyBarcodeCloseChange('target', 'ONE', !reopen, { silent: true, showModal: false });
    await entered;
    const entry = clone(readPickupJournal()[0]); expect(entry.stage).toBe('started');
    firebaseState.authGeneration++; release(); await pending;
    api.runTransaction = transact; pickupIntentsLive.clear(); load();
    return { entry, originalUpdater };
}


function marker(kind: string) {
    if (kind === 'scan') return { intent: 'scan_' + 'a'.repeat(32), actorUid: 'proof-user', code: 'ONE', slot: '0', birth: NOW - 3600000, payloadHash: 'b'.repeat(64) };
    if (kind === 'malformed-scan') return false;
    if (kind === 'malformed-price') return { phase: 'settled', outcome: 'committed' };
    return { token: 'price_' + 'a'.repeat(32), actorUid: 'proof-user', code: 'ONE', slot: '0', birth: NOW - 3600000, rowBirth: NOW - 3600000,
        scanDate: DAY, priorCod: 12.5, priorDod: 0, wantCod: 12.5, wantDod: 0, phase: kind === 'settled' ? 'settled' : 'admitted', ...(kind === 'settled' ? { outcome: 'committed' } : {}) };
}
function holdRow(kind: string, row = tree[HISTORY].target) { row[kind.endsWith('scan') ? 'scanPending' : 'pricePending'] = marker(kind); }
async function parked(receipt: string) {
    await offlineClose('whole', false, receipt !== 'absent');
    if (receipt === 'confirmed') patchPickupJournalEntry(readPickupJournal()[0].id, { transitionKnown: true, allowedAddKeys: ['ONE'] });
    writes = [];
}

for (const receipt of ['absent', 'receipt', 'confirmed']) {
    it.each(['scan', 'price', 'malformed-scan', 'malformed-price'])('pending replay '+receipt+' ៖ %s ត្រូវ HOLD មុន history/pickup/mirror', async kind => {
        await parked(receipt); const original = clone(readPickupJournal()[0]);
        holdRow(kind); const before = clone(tree);
        await resumePickupIntents(); await resumePickupIntents();
        expect(tree).toEqual(before); expect(writes).toEqual([]);
        expect(readPickupJournal()).toEqual([expect.objectContaining({ id: original.id, closePlan: original.closePlan, stage: 'started', hold: 'recovery-pending' })]);
        expect(readPickupJournal()[0].transitionKnown).toBe(original.transitionKnown);
        expect(readPickupJournal()[0].collectedTries).toBeUndefined();
    });
}

for (const receipt of ['absent', 'receipt']) {
    it.each(['scan', 'price'])('pending replay '+receipt+' ៖ %s មិន initialize pickup bucket ដែលបាត់', async kind => {
        await parked(receipt); delete tree[PICKUP]; holdRow(kind); const before = clone(tree);
        await resumePickupIntents(); expect(tree).toEqual(before); expect(writes).toEqual([]);
        expect(readPickupJournal()).toHaveLength(1);
    });
    it.each(['settled', 'null', 'absent'])('pending replay '+receipt+' ៖ %s អនុញ្ញាតបញ្ចប់ផែនការដដែល', async kind => {
        await parked(receipt);
        if (kind === 'settled') holdRow(kind);
        else if (kind === 'null') { tree[HISTORY].target.scanPending = null; tree[HISTORY].target.pricePending = null; }
        await resumePickupIntents();
        expect(tree[HISTORY].target.barcodes[0].isClosed).toBe(true);
        expect(tree[PICKUP][DAY].pickedUpBarcodes).toEqual({ ONE: '012345678' });
        expect(tree.zoew_daily_collected_cod_dod[DAY].ONE).toEqual({ c: 12.5, d: 0 });
        expect(readPickupJournal()).toEqual([]);
    });
}

it('pending replay ៖ row មិនពាក់ព័ន្ធមានសោ មិនបង្ខំ HOLD ទាំង journal', async () => {
    await parked('absent');
    tree[HISTORY].other = { ...clone(tree[HISTORY].target), id: 'other', barcodes: [{ ...tree[HISTORY].target.barcodes[0], code: 'OTHER' }], scanPending: {} };
    const other = clone(tree[HISTORY].other);
    await resumePickupIntents(); expect(readPickupJournal()).toEqual([]); expect(tree[HISTORY].other).toEqual(other);
    expect(tree[PICKUP][DAY].pickedUpBarcodes).toEqual({ ONE: '012345678' });
});

it('pending replay ៖ សោមកខណៈ capture រង់ចាំ ត្រូវផ្ទៀង fresh truth មុន effects', async () => {
    await parked('receipt'); const getOriginal = firebaseState.fb.get;
    firebaseState.fb.get = (async (ref: any) => { const value = await getOriginal(ref); if (ref.path === PICKUP + '/' + DAY) holdRow('price'); return value; }) as any;
    await resumePickupIntents();
    expect(writes).toEqual([]); expect(tree.zoew_daily_collected_cod_dod).toBeUndefined();
    expect(readPickupJournal()).toHaveLength(1);
});

it('pending replay ៖ សោមកនៅ retryable callback មិនលុបដោយ ClosePlan ចាស់', async () => {
    await parked('absent'); const transact = firebaseState.fb.runTransaction;
    firebaseState.fb.runTransaction = (async (ref: any, updater: any) => { if (ref.path === HISTORY + '/target') holdRow('scan'); return transact(ref, updater); }) as any;
    await resumePickupIntents();
    expect(writes).toEqual([]); expect(tree[HISTORY].target.barcodes[0].isClosed).toBe(false);
    expect(tree.zoew_daily_collected_cod_dod).toBeUndefined(); expect(readPickupJournal()).toHaveLength(1);
});

for (const location of ['history', 'trash']) {
    it.each(['scan', 'price'])('pending replay ៖ receipt ផ្លាស់ទៅ '+location+' មាន %s នៅតែ HOLD', async kind => {
        await parked('receipt');
        const holder = { ...clone(tree[HISTORY].target), id: 'moved', ...(location === 'trash' ? { trashReason: 'pickup' } : {}) };
        delete tree[HISTORY].target;
        const path = location === 'trash' ? 'zoew_recently_deleted_cod_dod' : HISTORY;
        tree[path] ||= {}; tree[path].moved = holder; holdRow(kind, holder);
        const before = clone(tree);
        await resumePickupIntents(); expect(tree).toEqual(before); expect(writes).toEqual([]);
        expect(readPickupJournal()).toHaveLength(1); expect(readPickupJournal()[0].hold).toBe('recovery-pending');
    });
}

it.each(['unknown', 'session'])('pending replay ៖ authoritative preflight %s មិន initialize pickup ឬលុប intent', async kind => {
    await parked('receipt'); delete tree[PICKUP]; const before = clone(tree); const original = firebaseState.fb.get;
    firebaseState.fb.get = (async (ref: any) => {
        if (ref.path === HISTORY) {
            if (kind === 'unknown') throw new Error('disconnect');
            firebaseState.authGeneration++;
        }
        return original(ref);
    }) as any;
    await resumePickupIntents(); expect(tree).toEqual(before); expect(writes).toEqual([]); expect(readPickupJournal()).toHaveLength(1);
});

it('pending replay ៖ history ACK មាន receipt តែ lock មកក្រោយ មិនផ្ញើ pickup/mirror', async () => {
    await parked('absent'); const transact = firebaseState.fb.runTransaction;
    firebaseState.fb.runTransaction = (async (ref: any, updater: any) => {
        const result = await transact(ref, updater);
        if (ref.path === HISTORY + '/target') holdRow('price');
        return result;
    }) as any;
    await resumePickupIntents();
    expect(writes).toEqual([HISTORY + '/target']); expect(tree[HISTORY].target.barcodes[0].isClosed).toBe(true);
    expect(tree[PICKUP][DAY].packagesPickedUp).toBe(0); expect(tree.zoew_daily_collected_cod_dod).toBeUndefined();
    expect(readPickupJournal()).toHaveLength(1); expect(readPickupJournal()[0].hold).toBe('recovery-pending');
});
