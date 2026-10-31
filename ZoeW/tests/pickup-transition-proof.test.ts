import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { dataState, firebaseState, uiState, ztoState } from '../src/core/state';
import { appLocalStore } from '../src/core/storage';
import { dbListenerFailedPaths, dbListenerPendingPaths } from '../src/core/text';
import { toggleCloseStatus } from '../src/features/entry-ops';
import { executeRestoreItem, restoreInFlight, activeRestoreClaims } from '../src/features/restore';
import { applyBarcodeCloseChange } from '../src/features/barcode-ops';
import { pickupIntentsLive, pickupResetRecord, patchPickupJournalEntry, preparePickupClose, readPickupJournal, resumePickupIntents } from '../src/domain/pickup';

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
async function interrupted(kind = 'whole') {
    let hit!: () => void, release!: () => void;
    const landed = new Promise<void>(resolve => { hit = resolve; });
    const held = new Promise<void>(resolve => { release = resolve; });
    gate = async () => { gate = null; hit(); await held; };
    const pending = kind === 'whole' ? toggleCloseStatus('target') : applyBarcodeCloseChange('target', 'ONE', true, { silent: true, showModal: false });
    await landed;
    const journal = readPickupJournal();
    expect(journal).toHaveLength(1); expect(journal[0].transitionKnown).not.toBe(true);
    firebaseState.authGeneration++;
    release(); await pending; pickupIntentsLive.clear(); load();
    return journal[0];
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

it.each(['whole', 'barcode'])('history commit មុន local permission៖ %s សង្គ្រោះតាម receipt ពិត', async kind => {
    const entry = await interrupted(kind);
    expect(tree[HISTORY].target.barcodes[0].pickupTransition).toMatchObject({ intent: entry.id, actorUid: 'proof-user', epoch: 0, closed: true, changes: 1 });
    await resumePickupIntents();
    expect(tree[PICKUP][DAY].pickedUpBarcodes).toEqual({ ONE: '012345678' });
    expect(tree[PICKUP][DAY].packagesPickedUp).toBe(1); expect(readPickupJournal()).toEqual([]);
    expect(tree.zoew_daily_revenue_cod_dod[DAY]).toEqual({ codDollar: 12.5, dodDollar: 0, totalCount: 1 });
    expect(tree.zoew_barcode_registry).toEqual({ ONE: true });
});

it.each(['intent', 'actorUid', 'scope', 'scanDate', 'itemId', 'code', 'epoch', 'birth', 'restored', 'closed', 'closedAt', 'changes'])('មិនទទួល receipt ផ្ទុយនឹង %s', async field => {
    await interrupted();
    const proof = tree[HISTORY].target.barcodes[0].pickupTransition;
    proof[field] = typeof proof[field] === 'number' ? proof[field] + 1 : typeof proof[field] === 'boolean' ? !proof[field] : 'other';
    await resumePickupIntents();
    expect(tree[PICKUP][DAY].packagesPickedUp).toBe(0); expect(readPickupJournal()).toHaveLength(1);
    expect(readPickupJournal()[0].hold).toBe('recovery-pending');
});

it('whole close គ្រាន់តែអនុញ្ញាត barcode ដែលប្ដូរពិត មិនរស់ឡើងវិញក្រោយ Reset', async () => {
    seed(['ONE', 'TWO', 'ALREADY']);
    const prior = tree[HISTORY].target.barcodes[2]; prior.isClosed = true; prior.closedAt = NOW - 1000;
    tree[PICKUP] = { [DAY]: { pickupRevision: 4, pickupResetEpoch: 3, packagesPickedUp: 0 } }; load();
    await interrupted();
    expect(tree[HISTORY].target.barcodes.map((barcode: any) => barcode.pickupTransition?.changes)).toEqual([2, 2, undefined]);
    await resumePickupIntents();
    expect(tree[PICKUP][DAY].packagesPickedUp).toBe(2);
    expect(tree[PICKUP][DAY].pickedUpBarcodes).toEqual({ ONE: '012345678', TWO: '012345678' });
    expect(readPickupJournal()).toEqual([]);
});

it.each(['missing', 'overwritten', 'duplicate'])('proof គ្រប់ changed keys ត្រូវមាន មិនទាយពេល %s', async kind => {
    seed(['ONE', 'TWO']); await interrupted();
    if (kind === 'missing') delete tree[HISTORY].target.barcodes[1].pickupTransition;
    if (kind === 'overwritten') tree[HISTORY].target.barcodes[1].pickupTransition.intent = 'different-operation';
    if (kind === 'duplicate') tree.zoew_recently_deleted_cod_dod = { copy: { ...clone(tree[HISTORY].target), id: 'copy', trashReason: 'pickup' } };
    await resumePickupIntents();
    expect(tree[PICKUP][DAY].packagesPickedUp).toBe(0); expect(readPickupJournal()).toHaveLength(1);
});

it('history→trash pickup រក្សាភស្តុតាង និងគណនាម្ដង', async () => {
    await interrupted();
    tree.zoew_recently_deleted_cod_dod = { moved: { ...tree[HISTORY].target, id: 'moved', trashReason: 'pickup', deletedAt: NOW + 1 } };
    delete tree[HISTORY].target; load();
    await resumePickupIntents(); await resumePickupIntents();
    expect(tree[PICKUP][DAY].packagesPickedUp).toBe(1); expect(readPickupJournal()).toEqual([]);
});

it('Reset ក្រោយ history commit ឈ្នះ receipt ហើយមិនបន្ថែម pickup ចាស់', async () => {
    await interrupted(); tree[PICKUP][DAY] = pickupResetRecord(tree[PICKUP][DAY]);
    await resumePickupIntents();
    expect(tree[PICKUP][DAY].packagesPickedUp).toBe(0); expect(tree[PICKUP][DAY].pickupResetEpoch).toBe(1);
    expect(readPickupJournal()).toEqual([]);
    expect(tree.zoew_daily_collected_cod_dod[DAY].ONE).toEqual({ c: 12.5, d: 0 });
});

it('Reset ចូលចន្លោះ truth read និង pickup CAS មិនត្រូវបានជាន់', async () => {
    await interrupted();
    const api = firebaseState.fb as any, read = api.get;
    let reset = false;
    api.get = async (ref: any) => {
        const snapshot = await read(ref);
        if (!reset && ref.path === HISTORY) { reset = true; tree[PICKUP][DAY] = pickupResetRecord(tree[PICKUP][DAY]); }
        return snapshot;
    };
    await resumePickupIntents();
    expect(tree[PICKUP][DAY].packagesPickedUp).toBe(0);
    api.get = read; await resumePickupIntents();
    expect(tree[PICKUP][DAY].packagesPickedUp).toBe(0); expect(readPickupJournal()).toEqual([]);
});

it('callback speculative មិនបង្កើតភស្តុតាង server ឬអនុញ្ញាត pickup', async () => {
    const api = firebaseState.fb as any, transact = api.runTransaction;
    api.runTransaction = async (ref: any, update: any) => {
        if (ref.path !== HISTORY + '/target') return transact(ref, update);
        const discarded = update(get(ref.path));
        expect(discarded.barcodes[0].pickupTransition).toBeTruthy();
        expect(readPickupJournal()[0].transitionKnown).not.toBe(true);
        return { committed: false, snapshot: { val: () => get(ref.path) } };
    };
    await toggleCloseStatus('target');
    expect(tree[HISTORY].target.barcodes[0].isClosed).toBe(false);
    expect(tree[HISTORY].target.barcodes[0].pickupTransition).toBeUndefined();
    expect(tree[PICKUP][DAY].packagesPickedUp).toBe(0);
});

it.each(['missing-birth', 'oversize-code', 'no-change'])('legacy/no-op %s មិនផលិត permission ពីស្មាន', async kind => {
    if (kind === 'missing-birth') delete tree[HISTORY].target.barcodes[0].createdAt;
    if (kind === 'oversize-code') tree[HISTORY].target.barcodes[0].code = 'X'.repeat(2049);
    if (kind !== 'no-change') load();
    else { delete dataState.scanHistory[0].barcodes[0].createdAt; tree[HISTORY].target.isClosed = true; tree[HISTORY].target.closedAt = NOW - 1000; tree[HISTORY].target.barcodes[0].isClosed = true; tree[HISTORY].target.barcodes[0].closedAt = NOW - 1000; }
    await interrupted();
    expect(tree[HISTORY].target.barcodes[0].pickupTransition).toBeUndefined();
    await resumePickupIntents();
    expect(tree[PICKUP][DAY].packagesPickedUp).toBe(0); expect(readPickupJournal()).toHaveLength(1);
});

it('ស្តារ lifecycle ថ្មីដក receipt ចាស់ ទោះ closedAt ថ្មីស្មើត្រាចាស់', async () => {
    await interrupted(); await resumePickupIntents();
    const oldProof = clone(tree[HISTORY].target.barcodes[0].pickupTransition);
    tree.zoew_recently_deleted_cod_dod = { source: { ...clone(tree[HISTORY].target), id: 'source', trashMode: 'local', trashReason: 'delete', deletedAt: NOW, isFromDeletion: true } };
    delete tree[HISTORY].target; load();
    uiState.pendingRestoreId = 'source'; await executeRestoreItem();
    const history = Object.values(tree[HISTORY] || {}) as any[];
    expect(history).toHaveLength(1);
    expect(history[0].barcodes[0].closedAt).toBe(oldProof.closedAt);
    expect(history[0].barcodes[0].pickupTransition).toBeUndefined();
    expect(tree.zoew_recently_deleted_cod_dod.source).toBeUndefined();
});

it('reopen commit មុន permission៖ receipt បើកវិញមិនបន្ថែម pickup', async () => {
    const barcode = tree[HISTORY].target.barcodes[0]; barcode.isClosed = true; barcode.closedAt = NOW - 1000;
    tree[HISTORY].target.isClosed = true; tree[HISTORY].target.closedAt = NOW - 1000;
    tree[PICKUP] = { [DAY]: { pickupRevision: 1, pickupResetEpoch: 0, packagesPickedUp: 1, pickedUpBarcodes: { ONE: '012345678' }, pickedUpPhones: { '012345678': 1 } } }; load();
    await interrupted();
    expect(tree[HISTORY].target.barcodes[0].pickupTransition).toMatchObject({ closed: false, closedAt: 0, changes: 1 });
    await resumePickupIntents();
    expect(tree[PICKUP][DAY].packagesPickedUp).toBe(0); expect(readPickupJournal()).toEqual([]);
});

it('កែ phone/locker មិនបំផ្លាញ receipt និងប្រើម្ចាស់ phone ថ្មីពី truth', async () => {
    await interrupted();
    const proof = clone(tree[HISTORY].target.barcodes[0].pickupTransition);
    tree[HISTORY].target.phone = '098765432'; tree[HISTORY].target.barcodes[0].locker = 'B7';
    await resumePickupIntents();
    expect(tree[HISTORY].target.barcodes[0].pickupTransition).toEqual(proof);
    expect(tree[PICKUP][DAY].pickedUpBarcodes).toEqual({ ONE: '098765432' }); expect(readPickupJournal()).toEqual([]);
});

it('receipt ក្នុង removed trash មិនធ្វើឲ្យ pickup ដែលដករួចត្រឡប់មកវិញ', async () => {
    await interrupted();
    tree.zoew_recently_deleted_cod_dod = { moved: { ...tree[HISTORY].target, id: 'moved', trashReason: 'remove', deletedAt: NOW + 1 } };
    tree.zoew_recently_deleted_cod_dod.moved.barcodes[0].isDeducted = true;
    delete tree[HISTORY].target; load();
    await resumePickupIntents();
    expect(tree[PICKUP][DAY].packagesPickedUp).toBe(0); expect(readPickupJournal()).toEqual([]);
});

it('receipt អនុញ្ញាតថ្មីមិនអាចប្រើ pickupDone ពី no-op មុន permission ជាភស្តុតាងរួចរាល់', async () => {
    const entry = await interrupted();
    expect(patchPickupJournalEntry(entry.id, { pickupDone: true })).toBe(true);
    expect(tree[PICKUP][DAY].packagesPickedUp).toBe(0);
    await resumePickupIntents();
    expect(tree[PICKUP][DAY].pickedUpBarcodes).toEqual({ ONE: '012345678' });
    expect(tree[PICKUP][DAY].packagesPickedUp).toBe(1); expect(readPickupJournal()).toEqual([]);
    const settled = clone(tree); await resumePickupIntents(); expect(tree).toEqual(settled);
});

it.each([null, undefined])('preflight រក្សាអវត្តមាន row %s ដាច់ពីការបដិសេធ', item => {
    expect(preparePickupClose(item, DAY)).toEqual({ item, restoreHeld: false });
    expect(writes).toEqual([]);
});

it('preflight ជោគជ័យ normalize barcode object នៅមុនចាប់ផ្ដើម close', () => {
    const item: any = { scanDate: DAY, barcodes: { 2: { code: 'ONE', isClosed: false } } };
    expect(preparePickupClose(item, DAY)).toEqual({ item, restoreHeld: false });
    expect(item.barcodes).toEqual([{ code: 'ONE', isClosed: false }]);
    expect(writes).toEqual([]);
});

it.each(['claim', 'date', 'restore'])('preflight %s មិន normalize ឬប៉ះ row ដែលត្រូវរង់ចាំ', kind => {
    const item: any = { id: 'guard', scanDate: DAY, barcodes: { 2: { code: 'ONE', isClosed: false } } };
    if (kind === 'claim') item.clearClaim = { token: 'pending' };
    if (kind === 'date') item.scanDate = '2026-10-29';
    if (kind === 'restore') { item.restoreClaimId = 'source'; item.restoreClaimToken = 'token'; activeRestoreClaims.set('source', 'token'); }
    const before = clone(item);
    expect(preparePickupClose(item, DAY)).toEqual({ item: undefined, restoreHeld: kind === 'restore' });
    expect(item).toEqual(before); expect(writes).toEqual([]);
});
