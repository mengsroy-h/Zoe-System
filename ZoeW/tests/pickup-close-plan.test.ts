import fs from 'node:fs';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { dataState, firebaseState, uiState, ztoState } from '../src/core/state';
import { appLocalStore } from '../src/core/storage';
import { dbListenerFailedPaths, dbListenerPendingPaths } from '../src/core/text';
import { toggleCloseStatus, setCallMark } from '../src/features/entry-ops';
import { restoreInFlight, activeRestoreClaims } from '../src/features/restore';
import { applyBarcodeCloseChange } from '../src/features/barcode-ops';
import { pickupIntentsLive, pickupResetRecord, patchPickupJournalEntry, pickupIntentTracker, readPickupJournal, resumePickupIntents } from '../src/domain/pickup';

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

async function offlineClose(kind = 'whole', reopen = false) {
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
        updater(get(ref.path)); reached(); await held;
        return { committed: false, snapshot: { val: () => get(ref.path) } };
    };
    const pending = kind === 'whole' ? toggleCloseStatus('target') : applyBarcodeCloseChange('target', 'ONE', !reopen, { silent: true, showModal: false });
    await entered;
    const entry = clone(readPickupJournal()[0]); expect(entry.stage).toBe('started');
    firebaseState.authGeneration++; release(); await pending;
    api.runTransaction = transact; pickupIntentsLive.clear(); load();
    return { entry, originalUpdater };
}

it.each([['whole', false], ['barcode', false], ['whole', true]])('offline %s/reopen=%s រួចចាប់ផ្ដើមថ្មី បញ្ចប់តែបំណងដើមដែលបានរក្សាទុក', async (kind, reopen) => {
    await offlineClose(String(kind), Boolean(reopen));
    const money = clone(tree.zoew_daily_revenue_cod_dod), registry = clone(tree.zoew_barcode_registry);
    await resumePickupIntents();
    expect(tree[HISTORY].target.barcodes[0].isClosed).toBe(!reopen);
    expect(tree[PICKUP][DAY].packagesPickedUp).toBe(reopen ? 0 : 1);
    expect(readPickupJournal()).toEqual([]);
    expect(tree.zoew_daily_revenue_cod_dod).toEqual(money); expect(tree.zoew_barcode_registry).toEqual(registry);
    const final = clone(tree); await resumePickupIntents(); expect(tree).toEqual(final);
});

it('Reset មិនលុបបំណង history ប៉ុន្តែមិនបង្កើត pickup ចាស់ឡើងវិញ', async () => {
    await offlineClose(); tree[PICKUP][DAY] = pickupResetRecord(tree[PICKUP][DAY]);
    await resumePickupIntents();
    expect(tree[HISTORY].target.barcodes[0].isClosed).toBe(true);
    expect(tree[PICKUP][DAY].packagesPickedUp).toBe(0); expect(tree[PICKUP][DAY].pickupResetEpoch).toBe(1);
    expect(readPickupJournal()).toEqual([]);
});

it.each(['birth', 'restore', 'membership-add', 'membership-remove', 'duplicate', 'claim', 'trash-claim', 'nonce'])('offline basis %s ប្រែប្រួល ត្រូវ HOLD មិនជាន់ទិន្នន័យថ្មី', async kind => {
    seed(['ONE', 'TWO']); await offlineClose();
    const item = tree[HISTORY].target, barcode = item.barcodes[0];
    if (kind === 'birth') barcode.createdAt++;
    if (kind === 'restore') { barcode.restoredAt = NOW; item.restoringAt = NOW; item.restoringBy = 'other'; }
    if (kind === 'membership-add') item.barcodes.push({ ...barcode, code: 'THREE' });
    if (kind === 'membership-remove') item.barcodes.pop();
    if (kind === 'duplicate') item.barcodes.push(clone(barcode));
    if (kind === 'claim') item.clearClaim = 'other';
    if (kind === 'trash-claim') barcode.trashClaim = 'other';
    if (kind === 'nonce') barcode.pickupTransition = { intent: 'foreign', actorUid: 'proof-user', scope: 'https://proof-test.firebaseio.com', scanDate: DAY, itemId: 'target', code: 'ONE', epoch: 0, birth: barcode.createdAt, restored: 0, closed: false, closedAt: 0, changes: 1 };
    const before = clone(tree); await resumePickupIntents();
    expect(tree[HISTORY]).toEqual(before[HISTORY]); expect(tree[PICKUP][DAY].packagesPickedUp).toBe(0);
    expect(tree.zoew_daily_revenue_cod_dod).toEqual(before.zoew_daily_revenue_cod_dod);
    expect(readPickupJournal()).toHaveLength(1); expect(readPickupJournal()[0].hold).toBe('recovery-pending');
});

it.each(['missing', 'duplicate', 'oversize', 'timestamp', 'prior', 'direction'])('ផែនការខូច %s មិនត្រូវ replay ឬបាត់ពី journal', async kind => {
    const { entry } = await offlineClose(); const plan = entry.closePlan;
    if (kind === 'missing') plan.targets = [];
    if (kind === 'duplicate') plan.targets.push(clone(plan.targets[0]));
    if (kind === 'oversize') plan.targets[0].identity = 'x'.repeat(8193);
    if (kind === 'timestamp') plan.serverTransitionAt = -1;
    if (kind === 'prior') plan.targets[0].prior = '[]';
    if (kind === 'direction') plan.desiredClosed = 'true';
    patchPickupJournalEntry(entry.id, { closePlan: plan });
    await resumePickupIntents();
    expect(tree[HISTORY].target.barcodes[0].isClosed).toBe(false); expect(tree[PICKUP][DAY].packagesPickedUp).toBe(0);
    expect(readPickupJournal()).toHaveLength(1); expect(readPickupJournal()[0].transitionKnown).not.toBe(true);
});

it.each(['uid', 'scope'])('ផែនការមិនអាច replay ដោយ %s ផ្សេង', async kind => {
    await offlineClose();
    if (kind === 'uid') firebaseState.auth.currentUser = { uid: 'other' } as any;
    else appLocalStore.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: 'https://other.firebaseio.com' }));
    const before = clone(tree); await resumePickupIntents(); expect(tree).toEqual(before); expect(readPickupJournal()).toHaveLength(1);
});

it('Sign ដែលមកក្រោយ offline reopen ត្រូវ HOLD ទោះ lifecycle identity ដូចមុន', async () => {
    await offlineClose('whole', true); tree[HISTORY].target.barcodes[0].ztoSignedAt = NOW;
    await resumePickupIntents(); expect(tree[HISTORY].target.barcodes[0].isClosed).toBe(true);
    expect(tree[PICKUP][DAY].packagesPickedUp).toBe(1); expect(readPickupJournal()).toHaveLength(1);
});

it.each(['before', 'during'])('Reset %s replay មិនលុប history intent និងមិនបន្ថែម pickup', async when => {
    await offlineClose();
    const api = firebaseState.fb as any, transact = api.runTransaction;
    if (when === 'before') tree[PICKUP][DAY] = pickupResetRecord(tree[PICKUP][DAY]);
    else api.runTransaction = (ref: any, updater: any) => {
        if (ref.path === HISTORY + '/target') tree[PICKUP][DAY] = pickupResetRecord(tree[PICKUP][DAY]);
        return transact(ref, updater);
    };
    await resumePickupIntents(); api.runTransaction = transact; await resumePickupIntents();
    expect(tree[HISTORY].target.barcodes[0].isClosed).toBe(true); expect(tree[HISTORY].target.barcodes[0].closedAt).toBe(NOW);
    expect(tree[PICKUP][DAY].packagesPickedUp).toBe(0); expect(tree[PICKUP][DAY].pickupResetEpoch).toBe(1);
    expect(tree.zoew_daily_collected_cod_dod[DAY].ONE).toEqual({ c: 12.5, d: 0 }); expect(readPickupJournal()).toEqual([]);
});

it('Reset មិនលុបផែនការដែល basis មិនច្បាស់', async () => {
    await offlineClose(); tree[PICKUP][DAY] = pickupResetRecord(tree[PICKUP][DAY]); tree[HISTORY].target.barcodes[0].createdAt++;
    await resumePickupIntents(); expect(tree[PICKUP][DAY].packagesPickedUp).toBe(0); expect(readPickupJournal()).toHaveLength(1);
    expect(readPickupJournal()[0].transitionKnown).not.toBe(true); expect(tree[HISTORY].target.barcodes[0].isClosed).toBe(false);
});

it('កែ phone/price ពេល offline ប្រើតម្លៃថ្មីពី ACK មិនជាន់ metadata', async () => {
    await offlineClose(); const item = tree[HISTORY].target; item.phone = '098765432'; item.barcodes[0].cod = 20; item.cod = item.price = 20;
    tree.zoew_daily_revenue_cod_dod[DAY].codDollar = 20; tree.zoew_monthly_revenue_cod_dod['2026-10'].codDollar = 20;
    await resumePickupIntents();
    expect(tree[PICKUP][DAY].pickedUpBarcodes).toEqual({ ONE: '098765432' });
    expect(tree.zoew_daily_collected_cod_dod[DAY].ONE).toEqual({ c: 20, d: 0 });
    expect(tree[HISTORY].target.phone).toBe('098765432'); expect(tree.zoew_daily_revenue_cod_dod[DAY].codDollar).toBe(20);
});

it('whole mixed close មិនបន្ថែម already-closed ដែល Reset បានដក', async () => {
    seed(['ONE', 'TWO']); tree[HISTORY].target.barcodes[1].isClosed = true; tree[HISTORY].target.barcodes[1].closedAt = NOW - 1000;
    await offlineClose(); await resumePickupIntents();
    expect(tree[PICKUP][DAY].pickedUpBarcodes).toEqual({ ONE: '012345678' });
    expect(tree[HISTORY].target.barcodes[0].pickupTransition.changes).toBe(1);
    expect(tree[HISTORY].target.barcodes[1].pickupTransition).toBeUndefined(); expect(readPickupJournal()).toEqual([]);
});

it.each([false, true])('live original committed:false ទោះ prior-proposal=%s មិនរក្សា history intent ដែលបដិសេធរួច', async proposed => {
    const api = firebaseState.fb as any, transact = api.runTransaction; let proposals = 0;
    api.runTransaction = async (ref: any, updater: any) => {
        if (ref.path !== HISTORY + '/target') return transact(ref, updater);
        if (proposed && updater(get(ref.path)) !== undefined) proposals++;
        const item = tree[HISTORY].target; item.isClosed = true; item.closedAt = NOW - 1000;
        item.barcodes[0].isClosed = true; item.barcodes[0].closedAt = NOW - 1000;
        expect(updater(get(ref.path))).toBeUndefined();
        return { committed: false, snapshot: { val: () => get(ref.path) } };
    };
    await toggleCloseStatus('target'); for (let i = 0; i < 30; i++) await Promise.resolve();
    expect(proposals).toBe(proposed ? 1 : 0); expect(tree[PICKUP][DAY].packagesPickedUp).toBe(0);
    expect(readPickupJournal()).toHaveLength(0);
});

it.each(['whole', 'barcode'])('original %s close បាន committed:false ក្រោយ proposal និង Delete ត្រូវបញ្ចប់ journal ក្រោយ rollback', async kind => {
    const api = firebaseState.fb as any, transact = api.runTransaction;
    api.runTransaction = async (ref: any, updater: any) => {
        if (ref.path !== HISTORY + '/target') return transact(ref, updater);
        expect(updater(get(ref.path))).toBeDefined();
        tree.zoew_recently_deleted_cod_dod = { deleted: { ...clone(tree[HISTORY].target), trashReason: 'delete', isFromDeletion: true } };
        delete tree[HISTORY].target;
        expect(updater(null)).toBeUndefined();
        return { committed: false, snapshot: { val: () => null } };
    };
    const money = clone(tree.zoew_daily_revenue_cod_dod), registry = clone(tree.zoew_barcode_registry);
    expect(await (kind === 'whole' ? toggleCloseStatus('target') : applyBarcodeCloseChange('target', 'ONE', true, { silent: true, showModal: false }))).toBe(false);
    for (let i = 0; i < 60; i++) await Promise.resolve();
    expect(readPickupJournal()).toEqual([]);
    expect(tree[PICKUP][DAY].packagesPickedUp).toBe(0);
    expect(tree[HISTORY].target).toBeUndefined();
    expect(tree.zoew_recently_deleted_cod_dod.deleted.barcodes[0].isClosed).toBe(false);
    expect(tree.zoew_daily_revenue_cod_dod).toEqual(money); expect(tree.zoew_barcode_registry).toEqual(registry);
    const before = clone(tree); await resumePickupIntents(); expect(tree).toEqual(before);
});

it('ផែនការ និង receipt ខ្លួនឯង idempotent ក្រោយ replay ទោះ original callback មកយឺត', async () => {
    const journal = pickupIntentTracker(() => true, 'target'); await journal.prepare(DAY, ['ONE']);
    expect(journal.startClose(tree[HISTORY].target, true, true)).toBe(true);
    const proposal = journal.applyClose(clone(tree[HISTORY].target)); expect(proposal?.kind).toBe('before');
    tree[HISTORY].target = clone(proposal?.item); const saved = clone(tree[HISTORY].target); vi.setSystemTime(NOW + 5000);
    expect(journal.applyClose(clone(saved))).toMatchObject({ kind: 'applied', item: saved });
    expect(readPickupJournal()[0].transitionKnown).not.toBe(true);
    tree[HISTORY].target.barcodes[0].pickupTransition.intent = 'foreign';
    expect(journal.applyClose(clone(tree[HISTORY].target))?.kind).toBe('conflict'); expect(journal.originalCloseAborted({ committed: true })).toBe(false);
    journal.release();
});

it('storage បដិសេធ plan មុន effects ទាំង history/pickup/collected', async () => {
    tree[PICKUP] = { [DAY]: { pickupRevision: 1, pickupResetEpoch: 0, packagesPickedUp: 0 } }; load();
    const set = appLocalStore.setItem.bind(appLocalStore);
    const spy = vi.spyOn(appLocalStore, 'setItem').mockImplementation((key, value) => {
        if (String(value).includes('"closePlan"')) throw new Error('quota'); set(key, value);
    });
    const before = clone(tree); expect(await toggleCloseStatus('target')).toBe(false); spy.mockRestore();
    expect(tree).toEqual(before); expect(writes).toEqual([]);
});

it('ACK receipt មិនជាន់ foreign receipt ក្នុង local view ទោះ timestamp ដូចគ្នា', async () => {
    const journal = pickupIntentTracker(() => true, 'target'); await journal.prepare(DAY, ['ONE']);
    journal.startClose(tree[HISTORY].target, true, true);
    const proposal = journal.applyClose(clone(tree[HISTORY].target)); const saved = clone(proposal?.item);
    dataState.scanHistory = [clone(saved)]; dataState.scanHistory[0].barcodes[0].pickupTransition.intent = 'foreign';
    const before = clone(dataState.scanHistory[0]);
    expect(journal.acknowledgedClose(saved)).toEqual([{ key: 'ONE', phoneKey: '012345678', closed: true }]);
    expect(dataState.scanHistory[0]).toEqual(before); journal.release();
});

it('barcode close រួច whole close មុន listener ថ្មី រក្សា receipt nonce និងបិទគ្រប់គោលដៅ', async () => {
    seed(['ONE', 'TWO']);
    expect(await applyBarcodeCloseChange('target', 'ONE', true, { silent: true, showModal: false })).toBe(true);
    expect(dataState.scanHistory[0].barcodes[0].pickupTransition).toEqual(tree[HISTORY].target.barcodes[0].pickupTransition);
    expect(await toggleCloseStatus('target')).toBe(true);
    expect(tree[HISTORY].target.barcodes.every((barcode: any) => barcode.isClosed)).toBe(true);
    expect(tree[PICKUP][DAY].packagesPickedUp).toBe(2); expect(readPickupJournal()).toEqual([]);
});

it('legacy journal គ្មានផែនការ នៅ HOLD ដដែល មិនយក row បច្ចុប្បន្នមកទាយ direction', async () => {
    const { entry } = await offlineClose(); patchPickupJournalEntry(entry.id, { closePlan: undefined });
    await resumePickupIntents(); expect(tree[HISTORY].target.barcodes[0].isClosed).toBe(false);
    expect(tree[PICKUP][DAY].packagesPickedUp).toBe(0); expect(readPickupJournal()[0].hold).toBe('recovery-pending');
});

it.each(['whole', 'barcode'])('duplicate local keys បដិសេធ %s មុន optimistic និង history writes', async kind => {
    seed(['ONE', 'ONE']); tree[PICKUP] = { [DAY]: { pickupRevision: 1, pickupResetEpoch: 0, packagesPickedUp: 0 } }; load();
    const before = clone(tree);
    const saved = kind === 'whole' ? await toggleCloseStatus('target') : await applyBarcodeCloseChange('target', 'ONE', true, { silent: true, showModal: false });
    expect(saved).toBe(false); expect(tree).toEqual(before); expect(writes).toEqual([]);
});

it.each([false, true])('prior receipt លំដាប់ properties មិនសំខាន់ ប៉ុន្តែ nonce ប្ដូរ=%s ត្រូវ HOLD', async changed => {
    const barcode = tree[HISTORY].target.barcodes[0];
    barcode.pickupTransition = { intent: 'prior', actorUid: 'proof-user', scope: 'https://proof-test.firebaseio.com', scanDate: DAY, itemId: 'target', code: 'ONE', epoch: 0, birth: barcode.createdAt, restored: 0, closed: false, closedAt: 0, changes: 1 };
    await offlineClose();
    const proof = tree[HISTORY].target.barcodes[0].pickupTransition;
    tree[HISTORY].target.barcodes[0].pickupTransition = Object.fromEntries(Object.entries(proof).reverse());
    if (changed) tree[HISTORY].target.barcodes[0].pickupTransition.intent = 'foreign';
    await resumePickupIntents();
    expect(tree[HISTORY].target.barcodes[0].isClosed).toBe(!changed);
    expect(tree[PICKUP][DAY].packagesPickedUp).toBe(changed ? 0 : 1); expect(readPickupJournal()).toHaveLength(changed ? 1 : 0);
});

it('whole mixed row ត្រូវផ្ទៀងផ្ទាត់ already-closed basis ដែរ មិនគ្រាន់តែ changed keys', async () => {
    seed(['ONE', 'TWO']); const unchanged = tree[HISTORY].target.barcodes[1]; unchanged.isClosed = true; unchanged.closedAt = NOW - 1000;
    await offlineClose(); unchanged.closedAt++;
    await resumePickupIntents(); expect(tree[HISTORY].target.barcodes[0].isClosed).toBe(false);
    expect(tree[PICKUP][DAY].packagesPickedUp).toBe(0); expect(readPickupJournal()).toHaveLength(1);
});

it.each(['local', 'server'])('restoreClaimId/token កំពុងស្តារពិត (%s) រារាំង history/pickup replay និងរក្សាលុយ', async owner => {
    await offlineClose();
    const item = tree[HISTORY].target; item.restoreClaimId = 'source'; item.restoreClaimToken = 'token';
    if (owner === 'local') activeRestoreClaims.set('source', 'token');
    else tree.zoew_recently_deleted_cod_dod = { source: { id: 'source', restoreClaim: { token: 'token', targetId: 'target', claimedAt: NOW }, scanDate: DAY } };
    tree.zoew_daily_collected_cod_dod = { [DAY]: { KEEP: { c: 3, d: 1 } } };
    load(); const before = clone(tree); writes = [];
    const api = firebaseState.fb as any, update = api.update, patches: Record<string, any>[] = [];
    api.update = (ref: any, values: Record<string, any>) => { expect(ref.path).toBe('zoew_daily_collected_cod_dod'); patches.push(clone(values)); return update(ref, values); };
    await resumePickupIntents(); for (let i = 0; i < 20; i++) await Promise.resolve();
    expect(patches.flatMap((patch) => Object.entries(patch)).sort()).toEqual(Array.from({ length: 7 }, (_, index) => [`2026-10-${24 + index}/ONE`, null]));
    for (const root of [HISTORY, PICKUP, 'zoew_recently_deleted_cod_dod', 'zoew_daily_revenue_cod_dod', 'zoew_monthly_revenue_cod_dod', 'zoew_barcode_registry']) expect(tree[root]).toEqual(before[root]);
    expect(writes.every((path) => path === 'zoew_daily_collected_cod_dod')).toBe(true);
    expect(tree.zoew_daily_collected_cod_dod[DAY]).toEqual(before.zoew_daily_collected_cod_dod[DAY]);
    expect(Object.values(tree.zoew_daily_collected_cod_dod).flatMap((day: any) => Object.values(day))).toEqual([{ c: 3, d: 1 }]);
    expect(readPickupJournal()).toHaveLength(1); expect(readPickupJournal()[0].hold).toBe('recovery-pending');
    expect(readPickupJournal()[0].transitionKnown).not.toBe(true);
});


function loadToastFixture() {
    const source = fs.readFileSync('../audit-tools/toast-action-truth-test.js', 'utf8');
    const bootStart = source.indexOf('const BOOT = ') + 'const BOOT = '.length;
    const bootEnd = source.indexOf('\n\nfunction seedData()');
    expect(bootStart).toBeGreaterThan('const BOOT = '.length);
    expect(bootEnd).toBeGreaterThan(bootStart);
    new Function('return ' + source.slice(bootStart, bootEnd))()(tree);
    firebaseState.fb = window.firebaseSDK as any;
    const settle = (...args: any[]) => {
        const settleStart = source.indexOf('const settleHistory = ') + 'const settleHistory = '.length;
        const settleEnd = source.indexOf('\n\n        await clearToasts();', settleStart);
        expect(settleStart).toBeGreaterThan('const settleHistory = '.length);
        expect(settleEnd).toBeGreaterThan(settleStart);
        return new Function('page', 'return ' + source.slice(settleStart, settleEnd))({ evaluate: (fn: any, args: any) => fn(args) })(...args);
    };
    return { sdk: firebaseState.fb as any, control: (window as any).__toastTruthControl, settle };
}

it.each([true, false])('toast fixture៖ call-mark ACK=%s មិនត្រូវ recovery transaction ជាន់', async (accepted) => {
    tree[HISTORY].mark = { ...clone(tree[HISTORY].target), id: 'mark', barcode: 'MARK', barcodes: [{ ...clone(tree[HISTORY].target.barcodes[0]), code: 'MARK' }] };
    const money = clone(tree.zoew_daily_revenue_cod_dod);
    const { sdk, control } = loadToastFixture();
    const paths: string[] = [], transact = sdk.runTransaction;
    sdk.runTransaction = (ref: any, update: any) => { paths.push(ref.path); return transact(ref, update); };
    const flush = async () => { for (let i = 0; i < 100; i++) await Promise.resolve(); };
    const reload = async () => { dataState.scanHistory = Object.values((await sdk.get({ path: HISTORY })).val()); };
    await toggleCloseStatus('target'); await reload();
    control.holdHistory('target');
    const failedClose = toggleCloseStatus('target'); await flush();
    expect(control.resolveHistory(false, 'target')).toBe(true);
    await failedClose; await flush(); await reload();
    expect(readPickupJournal()).toHaveLength(1);
    expect(readPickupJournal()[0].outcome).not.toBe('not-applied');
    expect((await sdk.get({ path: HISTORY + '/target' })).val().isClosed).toBe(true);
    paths.length = 0;
    uiState.markingItemId = 'mark'; uiState.toasts = [];
    control.holdHistory('mark');
    let markResolved = false, recoveryResolved = false;
    const marking = setCallMark('no-answer').then(result => { markResolved = true; return result; });
    const recovering = resumePickupIntents().then(() => { recoveryResolved = true; });
    await flush();
    expect(paths).toContain(HISTORY + '/target');
    expect(markResolved).toBe(false);
    expect(uiState.toasts.some((toast: any) => toast.msg.startsWith('✅'))).toBe(false);
    expect(control.resolveHistory(accepted, 'mark')).toBe(true);
    await flush();
    expect(markResolved).toBe(true);
    expect(recoveryResolved).toBe(true);
    const result = await marking; await recovering;
    const saved = (await sdk.get({ path: HISTORY })).val();
    expect(saved.mark.callMark).toBe(accepted ? 'no-answer' : undefined);
    expect(saved.target.isClosed).toBe(false);
    expect(uiState.toasts.some((toast: any) => toast.msg.startsWith('✅'))).toBe(accepted);
    if (!accepted) expect(result).toBe(false);
    expect((await sdk.get({ path: 'zoew_daily_revenue_cod_dod' })).val()).toEqual(money);
    expect(readPickupJournal()).toEqual([]);
    expect(control.historyError()).toBe('');
});

it('toast fixture៖ ACK ខុសគោលដៅមិនបាត់ promise ហើយ overlap ដែល App ចាប់នៅធ្វើ checker ធ្លាក់', async () => {
    const { sdk, control, settle } = loadToastFixture();
    control.holdHistory('target');
    const pending = sdk.runTransaction({ path: HISTORY + '/target' }, (row: any) => row);
    (window as any).__truthAction = pending;
    expect(control.resolveHistory(true, 'other')).toBe(false);
    expect(control.historyHeld('target')).toBe(true);
    try { sdk.runTransaction({ path: HISTORY + '/target' }, (row: any) => row); } catch { }
    expect(control.historyError()).toMatch(/overlap/);
    await expect(settle('target', true)).rejects.toThrow(/overlap/);
    expect(control.historyHeld('target')).toBe(true);
    expect(control.resolveHistory(true, 'target')).toBe(true);
    expect((await pending).committed).toBe(true);
});

async function foreignCloseWins(kind = 'whole', reopen = false) {
    const { entry } = await offlineClose(kind, reopen);
    firebaseState.auth.currentUser = { uid: 'foreign-user' } as any; firebaseState.authGeneration++; load();
    expect(await applyBarcodeCloseChange('target', 'ONE', !reopen, { silent: true, showModal: false })).toBe(true);
    expect(tree[HISTORY].target.barcodes[0].pickupTransition.actorUid).toBe('foreign-user');
    firebaseState.auth.currentUser = { uid: 'proof-user' } as any; firebaseState.authGeneration++; load();
    return entry;
}

it.each(['whole', 'barcode'])('ប្រកួត close %s៖ foreign receipt និង pickup សម្រេចបំណងរួច ដក journal ដោយគ្មានការសរសេរ history/pickup', async kind => {
    const entry = await foreignCloseWins(kind);
    const before = clone(tree), api = firebaseState.fb as any, transact = api.runTransaction, transactions: string[] = [];
    api.runTransaction = (ref: any, updater: any) => { transactions.push(ref.path); return transact(ref, updater); };
    expect(readPickupJournal()[0].allowedAddKeys).toEqual([]);
    await resumePickupIntents();
    expect(readPickupJournal()).toEqual([]); expect(tree).toEqual(before);
    expect(transactions.filter(path => path.startsWith(HISTORY) || path.startsWith(PICKUP))).toEqual([]);
    expect(tree[HISTORY].target.barcodes[0].pickupTransition.intent).not.toBe(entry.id);
    expect(tree[PICKUP][DAY].pickedUpBarcodes).toEqual({ ONE: '012345678' });
});

it.each(['receipt-missing', 'receipt-epoch', 'receipt-birth', 'receipt-partial', 'receipt-scope', 'duplicate-copy', 'wrong-phone', 'wrong-count', 'wrong-phone-count', 'reset', 'birth', 'restored', 'membership', 'claim', 'legacy-plan'])('foreign completion %s មិនអាចលុប unknown journal ឬផ្ដល់ pickup permission', async kind => {
    const entry = await foreignCloseWins(); const item = tree[HISTORY].target, barcode = item.barcodes[0], day = tree[PICKUP][DAY];
    if (kind === 'receipt-missing') delete barcode.pickupTransition;
    if (kind === 'receipt-epoch') barcode.pickupTransition.epoch++;
    if (kind === 'receipt-birth') barcode.pickupTransition.birth++;
    if (kind === 'receipt-partial') barcode.pickupTransition.changes++;
    if (kind === 'receipt-scope') barcode.pickupTransition.scope = 'https://other.firebaseio.com';
    if (kind === 'duplicate-copy') tree.zoew_recently_deleted_cod_dod = { copy: { ...clone(item), id: 'copy', trashReason: 'pickup' } };
    if (kind === 'wrong-phone') { day.pickedUpBarcodes.ONE = '098765432'; day.pickedUpPhones = { '098765432': 1 }; }
    if (kind === 'wrong-count') day.packagesPickedUp++;
    if (kind === 'wrong-phone-count') day.pickedUpPhones['012345678']++;
    if (kind === 'reset') tree[PICKUP][DAY] = pickupResetRecord(day);
    if (kind === 'birth') barcode.createdAt++;
    if (kind === 'restored') barcode.restoredAt = NOW;
    if (kind === 'membership') item.barcodes.push({ ...clone(barcode), code: 'EXTRA' });
    if (kind === 'claim') item.clearClaim = { token: 'held', claimedAt: NOW };
    if (kind === 'legacy-plan') patchPickupJournalEntry(entry.id, { closePlan: undefined });
    const before = clone(tree); await resumePickupIntents();
    for (const root of [HISTORY, PICKUP, 'zoew_daily_revenue_cod_dod', 'zoew_monthly_revenue_cod_dod', 'zoew_barcode_registry']) expect(tree[root]).toEqual(before[root]);
    expect(readPickupJournal()).toHaveLength(1); expect(readPickupJournal()[0].transitionKnown).not.toBe(true);
    expect(readPickupJournal()[0].allowedAddKeys).toEqual([]);
});

it('foreign reopen ដែលបានបញ្ចប់ និង pickup អវត្តមាន អាចចប់ journal ដោយមិនលុបម្ដងទៀត', async () => {
    await foreignCloseWins('whole', true); const before = clone(tree); writes = [];
    await resumePickupIntents(); expect(readPickupJournal()).toEqual([]); expect(tree).toEqual(before);
    expect(tree[PICKUP][DAY].packagesPickedUp).toBe(0); expect(writes.every(path => path === 'zoew_daily_collected_cod_dod')).toBe(true);
});

it('foreign receipt group ដែលមាន changed key ក្រៅ plan ត្រូវផ្ទៀងផ្ទាត់ទាំងមូល', async () => {
    seed(['ONE', 'TWO']); const { entry } = await offlineClose('barcode');
    firebaseState.auth.currentUser = { uid: 'foreign-user' } as any; firebaseState.authGeneration++; load();
    expect(await toggleCloseStatus('target')).toBe(true);
    firebaseState.auth.currentUser = { uid: 'proof-user' } as any; firebaseState.authGeneration++; load();
    const proof = clone(tree[HISTORY].target.barcodes[1].pickupTransition); delete tree[HISTORY].target.barcodes[1].pickupTransition;
    await resumePickupIntents(); expect(readPickupJournal()).toHaveLength(1); expect(readPickupJournal()[0].id).toBe(entry.id);
    tree[HISTORY].target.barcodes[1].pickupTransition = proof;
    const before = clone(tree); await resumePickupIntents(); expect(readPickupJournal()).toEqual([]); expect(tree).toEqual(before);
});

it('foreign proof ក្នុង day revision ដែលប្រែពេល truth read ត្រូវ HOLD រហូតដល់ការអានថេរ', async () => {
    await foreignCloseWins(); const api = firebaseState.fb as any, read = api.get; let reads = 0;
    api.get = async (ref: any) => {
        const snapshot = await read(ref);
        if (ref.path === HISTORY && ++reads === 2) tree[PICKUP][DAY].pickupRevision++;
        return snapshot;
    };
    await resumePickupIntents(); expect(readPickupJournal()).toHaveLength(1); expect(readPickupJournal()[0].transitionKnown).not.toBe(true);
    api.get = read; await resumePickupIntents(); expect(readPickupJournal()).toEqual([]);
});

it.each(['price', 'phone', 'revision', 'session'])('foreign proof ក្រោយ mirror ACK ប្រែ %s ត្រូវរក្សា journal', async kind => {
    await foreignCloseWins(); const api = firebaseState.fb as any, update = api.update; let changed = false;
    api.update = async (ref: any, patch: any) => {
        await update(ref, patch);
        if (changed || ref.path !== 'zoew_daily_collected_cod_dod') return; changed = true;
        if (kind === 'price') tree[HISTORY].target.barcodes[0].cod++;
        if (kind === 'phone') tree[HISTORY].target.phone = '098765432';
        if (kind === 'revision') tree[PICKUP][DAY].pickupRevision++;
        if (kind === 'session') firebaseState.authGeneration++;
    };
    await resumePickupIntents(); expect(changed).toBe(true); expect(readPickupJournal()).toHaveLength(1);
    expect(readPickupJournal()[0].allowedAddKeys).toEqual([]); expect(readPickupJournal()[0].transitionKnown).not.toBe(true);
});

it('foreign completion មិនលុប journal បើ mirror ACK ត្រូវបដិសេធ', async () => {
    await foreignCloseWins(); const api = firebaseState.fb as any, update = api.update;
    api.update = async () => { throw Object.assign(new Error('permission_denied'), { code: 'permission_denied' }); };
    await resumePickupIntents(); expect(readPickupJournal()).toHaveLength(1); expect(readPickupJournal()[0].allowedAddKeys).toEqual([]);
    api.update = update; await resumePickupIntents(); expect(readPickupJournal()).toEqual([]);
});

it.each(['new', 'legacy'])('timestamp plan %s រក្សាម៉ោង server ដើម ទោះ offset ប្រែក្រោយ reload', async kind => {
    firebaseState.serverTimeOffsetMs = 300000;
    const { entry } = await offlineClose(); expect(entry.at).toBe(NOW); expect(entry.closePlan.serverTransitionAt).toBe(NOW + 300000);
    if (kind === 'legacy') {
        const plan = { ...entry.closePlan, at: entry.closePlan.serverTransitionAt }; delete plan.serverTransitionAt;
        patchPickupJournalEntry(entry.id, { closePlan: plan });
    }
    firebaseState.serverTimeOffsetMs = -600000; vi.setSystemTime(NOW + 1000);
    await resumePickupIntents(); expect(readPickupJournal()).toEqual([]);
    expect(tree[HISTORY].target.barcodes[0].closedAt).toBe(NOW + 300000);
    expect(tree[HISTORY].target.barcodes[0].pickupTransition.closedAt).toBe(NOW + 300000);
});

it.each(['both-equal', 'both-invalid-new', 'neither', 'unknown', 'invalid-new'])('timestamp alias %s មិន fallback ទៅ journal.at ឬម៉ោងថ្មី', async kind => {
    const { entry } = await offlineClose(); const plan = entry.closePlan;
    if (kind === 'both-equal') plan.at = plan.serverTransitionAt;
    if (kind === 'both-invalid-new') { plan.at = plan.serverTransitionAt; plan.serverTransitionAt = -1; }
    if (kind === 'neither') delete plan.serverTransitionAt;
    if (kind === 'unknown') { plan.unknown = plan.serverTransitionAt; delete plan.serverTransitionAt; }
    if (kind === 'invalid-new') plan.serverTransitionAt = -1;
    patchPickupJournalEntry(entry.id, { closePlan: plan }); firebaseState.serverTimeOffsetMs = 300000;
    await resumePickupIntents(); expect(readPickupJournal()).toHaveLength(1);
    expect(tree[HISTORY].target.barcodes[0].isClosed).toBe(false); expect(tree[PICKUP][DAY].packagesPickedUp).toBe(0);
});

it('foreign completion ប្រើ phone/price ថ្មីពី server និងរង់ចាំ mirror តម្លៃថ្មី', async () => {
    await foreignCloseWins(); tree[HISTORY].target.phone = '098765432'; tree[HISTORY].target.barcodes[0].cod = 20;
    tree[HISTORY].target.cod = tree[HISTORY].target.price = 20;
    tree[PICKUP][DAY].pickedUpBarcodes = { ONE: '098765432' }; tree[PICKUP][DAY].pickedUpPhones = { '098765432': 1 };
    tree.zoew_daily_revenue_cod_dod[DAY].codDollar = tree.zoew_monthly_revenue_cod_dod['2026-10'].codDollar = 20;
    const before = clone(tree); writes = []; await resumePickupIntents();
    expect(readPickupJournal()).toEqual([]); expect(tree[HISTORY]).toEqual(before[HISTORY]); expect(tree[PICKUP]).toEqual(before[PICKUP]);
    expect(tree.zoew_daily_collected_cod_dod[DAY].ONE).toEqual({ c: 20, d: 0 });
    expect(writes.every(path => path === 'zoew_daily_collected_cod_dod')).toBe(true);
});

it.each([false, true])('foreign whole mixed completion ផ្ទៀង unchanged target ប្រែ=%s ដោយមិនរស់ pickup Reset ឡើងវិញ', async changed => {
    seed(['ONE', 'TWO']); tree[HISTORY].target.barcodes[1].isClosed = true; tree[HISTORY].target.barcodes[1].closedAt = NOW - 1000;
    await foreignCloseWins(); if (changed) tree[HISTORY].target.barcodes[1].closedAt++;
    const before = clone(tree); await resumePickupIntents(); expect(readPickupJournal()).toHaveLength(changed ? 1 : 0);
    before.zoew_daily_collected_cod_dod[DAY].TWO = { c: 12.5, d: 0 };
    expect(tree).toEqual(before); expect(tree[PICKUP][DAY].pickedUpBarcodes).toEqual({ ONE: '012345678' });
});

it('foreign completion មិនទទួល nonce ដដែលនៃ prior receipt ទោះ result state ស្មើបំណង', async () => {
    const barcode = tree[HISTORY].target.barcodes[0];
    barcode.pickupTransition = { intent: 'prior-open', actorUid: 'foreign-user', scope: 'https://proof-test.firebaseio.com', scanDate: DAY, itemId: 'target', code: 'ONE', epoch: 0, birth: barcode.createdAt, restored: 0, closed: false, closedAt: 0, changes: 1 };
    await foreignCloseWins(); tree[HISTORY].target.barcodes[0].pickupTransition.intent = 'prior-open';
    await resumePickupIntents(); expect(readPickupJournal()).toHaveLength(1); expect(readPickupJournal()[0].allowedAddKeys).toEqual([]);
});

it.each(['restore', 'trash', 'signed-reopen', 'own-partial'])('foreign completion %s ត្រូវ HOLD ដោយគ្មាន permission ថ្មី', async kind => {
    const entry = await foreignCloseWins('whole', kind === 'signed-reopen'); const item = tree[HISTORY].target;
    if (kind === 'restore') { item.restoreClaimId = 'source'; item.restoreClaimToken = 'token'; activeRestoreClaims.set('source', 'token'); }
    if (kind === 'trash') item.barcodes[0].trashClaim = 'foreign-claim';
    if (kind === 'signed-reopen') item.barcodes[0].ztoSignedAt = NOW;
    if (kind === 'own-partial') tree[HISTORY].other = { ...clone(item), id: 'other', barcodes: [{ ...clone(item.barcodes[0]), code: 'OTHER', pickupTransition: { ...item.barcodes[0].pickupTransition, intent: entry.id, code: 'OTHER' } }] };
    const before = clone(tree); await resumePickupIntents();
    expect(tree[HISTORY]).toEqual(before[HISTORY]); expect(tree[PICKUP]).toEqual(before[PICKUP]); expect(readPickupJournal()).toHaveLength(1);
    expect(readPickupJournal()[0].allowedAddKeys).toEqual(entry.allowedAddKeys); expect(readPickupJournal()[0].transitionKnown).not.toBe(true);
});

it('closeTime របស់ present invalid timestamp plan មិន fallback ទៅម៉ោងថ្មី', async () => {
    const journal = pickupIntentTracker(() => true, 'target'); await journal.prepare(DAY, ['ONE']); journal.startClose(tree[HISTORY].target, true, true);
    const entry = readPickupJournal()[0]; patchPickupJournalEntry(entry.id, { closePlan: { ...entry.closePlan, at: entry.closePlan.serverTransitionAt } });
    firebaseState.serverTimeOffsetMs = 300000; expect(journal.closeTime()).toBeUndefined(); journal.release();
});

it.each(['same', 'missing', 'different'])('foreign group មាន duplicate key ក្រៅ loser plan ក្នុង active restore copy receipt %s ត្រូវ HOLD', async kind => {
    seed(['ONE', 'TWO']); await offlineClose('barcode');
    firebaseState.auth.currentUser = { uid: 'foreign-user' } as any; firebaseState.authGeneration++; load();
    expect(await toggleCloseStatus('target')).toBe(true);
    firebaseState.auth.currentUser = { uid: 'proof-user' } as any; firebaseState.authGeneration++; load();
    const item = tree[HISTORY].target;
    tree[HISTORY].restoring = { ...clone(item), id: 'restoring', barcodes: [clone(item.barcodes[1])], restoreClaimId: 'source', restoreClaimToken: 'token' };
    if (kind === 'missing') delete tree[HISTORY].restoring.barcodes[0].pickupTransition;
    if (kind === 'different') tree[HISTORY].restoring.barcodes[0].pickupTransition.intent = 'another-foreign-intent';
    activeRestoreClaims.set('source', 'token');
    const before = clone(tree); await resumePickupIntents();
    expect(readPickupJournal()).toHaveLength(1); expect(readPickupJournal()[0].transitionKnown).not.toBe(true);
    expect(tree).toEqual(before); expect(readPickupJournal()[0].allowedAddKeys).toEqual([]);
});

it.each(['barcodes-true', 'phones-false', 'barcodes-array', 'phones-array'])('foreign reopen ជាមួយ malformed map %s ត្រូវ HOLD មិនយកជាសំណុំទទេ', async kind => {
    await foreignCloseWins('whole', true);
    tree[PICKUP][DAY][kind.startsWith('barcodes') ? 'pickedUpBarcodes' : 'pickedUpPhones'] = kind.endsWith('array') ? [] : kind.endsWith('true');
    const before = clone(tree); await resumePickupIntents();
    expect(readPickupJournal()).toHaveLength(1); expect(readPickupJournal()[0].transitionKnown).not.toBe(true); expect(tree).toEqual(before);
});

it.each(['whole', 'barcode'])('foreign close %s របស់ journal ចាស់មុន gate ដែល changed key មាន add admission ត្រូវរក្សា HOLD សម្រាប់ late pickup packet', async kind => {
    const entry = await foreignCloseWins(kind);
    patchPickupJournalEntry(entry.id, { allowedAddKeys: ['ONE'] });
    expect(readPickupJournal()[0].allowedAddKeys).toEqual(['ONE']);
    tree[HISTORY].target.phone = '098765432'; tree[PICKUP][DAY].pickedUpBarcodes = { ONE: '098765432' };
    tree[PICKUP][DAY].pickedUpPhones = { '098765432': 1 }; const before = clone(tree);
    await resumePickupIntents(); expect(readPickupJournal()).toHaveLength(1); expect(tree).toEqual(before);
    expect(readPickupJournal()[0].transitionKnown).not.toBe(true); expect(readPickupJournal()[0].allowedAddKeys).toEqual(['ONE']);
});

it('foreign completion មិនលុប journal បើ add admission ប្រែក្នុងពេលរង់ចាំ mirror ACK', async () => {
    const entry = await foreignCloseWins(), api = firebaseState.fb as any, update = api.update; let changed = false;
    api.update = async (ref: any, patch: any) => {
        await update(ref, patch);
        if (!changed && ref.path === 'zoew_daily_collected_cod_dod') { changed = true; patchPickupJournalEntry(entry.id, { allowedAddKeys: ['ONE'] }); }
    };
    await resumePickupIntents(); expect(changed).toBe(true); expect(readPickupJournal()).toHaveLength(1);
    expect(readPickupJournal()[0].allowedAddKeys).toEqual(['ONE']); expect(readPickupJournal()[0].transitionKnown).not.toBe(true);
});

it.each(['whole', 'barcode'])('new close %s បដិសេធ OPEN key ដែល pickup server នៅមាន មុន effects រួចអាច retry ក្រោយ prior state settle', async kind => {
    tree[PICKUP] = { [DAY]: { pickupRevision: 1, pickupResetEpoch: 0, packagesPickedUp: 1,
        pickedUpBarcodes: { ONE: '012345678' }, pickedUpPhones: { '012345678': 1 } } }; load();
    const before = clone(tree), memory = clone(dataState.scanHistory);
    const action = () => kind === 'whole' ? toggleCloseStatus('target') : applyBarcodeCloseChange('target', 'ONE', true, { silent: true, showModal: false });
    expect(await action()).toBe(false); expect(tree).toEqual(before); expect(dataState.scanHistory).toEqual(memory); expect(writes).toEqual([]);
    expect(readPickupJournal()).toEqual([]); expect(uiState.toasts.some((toast: any) => /Sync.*Refresh/.test(toast.msg))).toBe(true);
    tree[PICKUP][DAY] = { pickupRevision: 2, pickupResetEpoch: 0, packagesPickedUp: 0 }; load();
    expect(await action()).toBe(true); expect(readPickupJournal()).toEqual([]); expect(tree[PICKUP][DAY].pickedUpBarcodes).toEqual({ ONE: '012345678' });
    expect(tree.zoew_daily_revenue_cod_dod).toEqual(before.zoew_daily_revenue_cod_dod); expect(tree.zoew_barcode_registry).toEqual(before.zoew_barcode_registry);
});

it('new whole close មិនបដិសេធ unchanged CLOSED sibling ដែលនៅមាន pickup', async () => {
    seed(['ONE', 'TWO']); const sibling = tree[HISTORY].target.barcodes[1]; sibling.isClosed = true; sibling.closedAt = NOW - 1000;
    tree[PICKUP] = { [DAY]: { pickupRevision: 1, pickupResetEpoch: 0, packagesPickedUp: 1,
        pickedUpBarcodes: { TWO: '012345678' }, pickedUpPhones: { '012345678': 1 } } }; load();
    expect(await toggleCloseStatus('target')).toBe(true); expect(readPickupJournal()).toEqual([]);
    expect(tree[PICKUP][DAY].packagesPickedUp).toBe(2); expect(tree[HISTORY].target.barcodes[1]).toEqual(sibling);
    expect(tree[HISTORY].target.barcodes[0].pickupTransition.changes).toBe(1);
});

it('new mixed whole close បដិសេធទាំង row បើ OPEN target មួយនៅមាន pickup រួច retry ក្រោយវាបាត់', async () => {
    seed(['ONE', 'TWO']); tree[HISTORY].target.barcodes[1].isClosed = true; tree[HISTORY].target.barcodes[1].closedAt = NOW - 1000;
    tree[PICKUP] = { [DAY]: { pickupRevision: 1, pickupResetEpoch: 0, packagesPickedUp: 2,
        pickedUpBarcodes: { ONE: '012345678', TWO: '012345678' }, pickedUpPhones: { '012345678': 2 } } }; load();
    const before = clone(tree); expect(await toggleCloseStatus('target')).toBe(false); expect(tree).toEqual(before); expect(writes).toEqual([]); expect(readPickupJournal()).toEqual([]);
    tree[PICKUP][DAY] = { pickupRevision: 2, pickupResetEpoch: 0, packagesPickedUp: 1, pickedUpBarcodes: { TWO: '012345678' }, pickedUpPhones: { '012345678': 1 } }; load();
    expect(await toggleCloseStatus('target')).toBe(true); expect(tree[PICKUP][DAY].packagesPickedUp).toBe(2); expect(readPickupJournal()).toEqual([]);
});

it('new admission gate មិនរារាំង reopen ឬ close ថ្មីក្រោយ pickup Reset', async () => {
    tree[HISTORY].target.isClosed = true; tree[HISTORY].target.closedAt = NOW - 1000;
    Object.assign(tree[HISTORY].target.barcodes[0], { isClosed: true, closedAt: NOW - 1000 });
    tree[PICKUP] = { [DAY]: { pickupRevision: 1, pickupResetEpoch: 0, packagesPickedUp: 1,
        pickedUpBarcodes: { ONE: '012345678' }, pickedUpPhones: { '012345678': 1 } } }; load();
    expect(await toggleCloseStatus('target')).toBe(true); expect(tree[PICKUP][DAY].packagesPickedUp).toBe(0); expect(readPickupJournal()).toEqual([]);
    tree[PICKUP][DAY] = pickupResetRecord(tree[PICKUP][DAY]); load();
    expect(await toggleCloseStatus('target')).toBe(true); expect(tree[PICKUP][DAY].pickupResetEpoch).toBe(1); expect(tree[PICKUP][DAY].packagesPickedUp).toBe(1);
});

it('unpromoted pickup អាចបន្ថែមតែ metadata មុន new admission refusal មិនប្ដូរអាជីវកម្ម', async () => {
    tree[PICKUP] = { [DAY]: { packagesPickedUp: 1, pickedUpBarcodes: { ONE: '012345678' }, pickedUpPhones: { '012345678': 1 } } }; load();
    const before = clone(tree); expect(await toggleCloseStatus('target')).toBe(false);
    before[PICKUP][DAY].pickupRevision = 1; before[PICKUP][DAY].pickupResetEpoch = 0;
    expect(tree).toEqual(before); expect(writes).toEqual([PICKUP + '/' + DAY]); expect(readPickupJournal()).toEqual([]);
});

it('legacy barcode គ្មាន birth គ្មាន valid plan នៅរក្សា live ACK compatibility មិនអះអាង admission prevention', async () => {
    delete tree[HISTORY].target.barcodes[0].createdAt;
    tree[PICKUP] = { [DAY]: { pickupRevision: 1, pickupResetEpoch: 0, packagesPickedUp: 1,
        pickedUpBarcodes: { ONE: '012345678' }, pickedUpPhones: { '012345678': 1 } } }; load();
    expect(await toggleCloseStatus('target')).toBe(true); expect(tree[HISTORY].target.barcodes[0].isClosed).toBe(true);
    expect(tree[HISTORY].target.barcodes[0].pickupTransition).toBeUndefined(); expect(tree[PICKUP][DAY].packagesPickedUp).toBe(1); expect(readPickupJournal()).toEqual([]);
});

it('new admission refusal មិនលុប started unknown journal ចាស់ដែលនៅមាន add permission', async () => {
    tree[PICKUP] = { [DAY]: { pickupRevision: 1, pickupResetEpoch: 0, packagesPickedUp: 1,
        pickedUpBarcodes: { ONE: '012345678' }, pickedUpPhones: { '012345678': 1 } } }; load();
    const journal = pickupIntentTracker(() => true, 'target'); await journal.prepare(DAY, ['ONE']); expect(journal.start()).toBe(true);
    const before = clone(readPickupJournal()); expect(journal.startClose(tree[HISTORY].target, true, true)).toBe(false);
    expect(readPickupJournal()).toEqual(before); expect(writes).toEqual([]); journal.release();
});

it('new admission refusal រក្សា prepared journal បើ local remove បរាជ័យ និងមិនចាប់ផ្ដើម effects', async () => {
    tree[PICKUP] = { [DAY]: { pickupRevision: 1, pickupResetEpoch: 0, packagesPickedUp: 1,
        pickedUpBarcodes: { ONE: '012345678' }, pickedUpPhones: { '012345678': 1 } } }; load();
    const before = clone(tree), remove = vi.spyOn(appLocalStore, 'removeItem').mockImplementation(() => { throw new Error('storage unavailable'); });
    try {
        expect(await toggleCloseStatus('target')).toBe(false); expect(tree).toEqual(before); expect(writes).toEqual([]);
        expect(readPickupJournal()).toHaveLength(1); expect(readPickupJournal()[0].stage).toBe('prepared');
    } finally { remove.mockRestore(); }
    await resumePickupIntents(); expect(readPickupJournal()).toEqual([]); expect(tree).toEqual(before);
});

it('new admission cleanup មិនលុប prepared entry ក្រោយ actor generation ផ្លាស់ប្ដូរ', async () => {
    tree[PICKUP] = { [DAY]: { pickupRevision: 1, pickupResetEpoch: 0, packagesPickedUp: 1,
        pickedUpBarcodes: { ONE: '012345678' }, pickedUpPhones: { '012345678': 1 } } }; load();
    const journal = pickupIntentTracker(() => true, 'target'); await journal.prepare(DAY, ['ONE']); const before = clone(readPickupJournal());
    firebaseState.authGeneration++; expect(journal.startClose(tree[HISTORY].target, true, true)).toBe(false);
    expect(readPickupJournal()).toEqual(before); expect(writes).toEqual([]); journal.release();
});

it.each(['unknown', 'applied', 'reopen', 'legacy', 'malformed-plan', 'malformed-admission', 'admitted', 'owner', 'uid', 'scope', 'stage'])('original abort %s មិនផ្ដល់សិទ្ធិលុប journal', async kind => {
    const journal = pickupIntentTracker(() => true, 'target'); await journal.prepare(DAY, ['ONE']);
    if (kind === 'reopen') {
        tree[HISTORY].target.isClosed = true; tree[HISTORY].target.closedAt = NOW - 1000;
        Object.assign(tree[HISTORY].target.barcodes[0], { isClosed: true, closedAt: NOW - 1000 });
    }
    expect(journal.startClose(tree[HISTORY].target, kind !== 'reopen', true)).toBe(true);
    expect(journal.applyClose(clone(tree[HISTORY].target))?.kind).toBe('before');
    const entry = readPickupJournal()[0];
    if (kind === 'legacy') patchPickupJournalEntry(entry.id, { closePlan: undefined });
    if (kind === 'malformed-plan') patchPickupJournalEntry(entry.id, { closePlan: { ...entry.closePlan, targets: [] } });
    if (kind === 'malformed-admission') patchPickupJournalEntry(entry.id, { allowedAddKeys: true });
    if (kind === 'admitted') patchPickupJournalEntry(entry.id, { allowedAddKeys: ['ONE'] });
    if (kind === 'owner') patchPickupJournalEntry(entry.id, { owner: 'foreign' });
    if (kind === 'uid') firebaseState.auth.currentUser = { uid: 'foreign' } as any;
    if (kind === 'scope') appLocalStore.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: 'https://foreign.firebaseio.com' }));
    if (kind === 'stage') patchPickupJournalEntry(entry.id, { stage: 'prepared' });
    expect(journal.originalCloseAborted(kind === 'unknown' ? {} : { committed: kind === 'applied' })).toBe(false);
    expect(readPickupJournal()).toHaveLength(1); journal.release();
});

it.each(['rollback', 'reset', 'context'])('original abort ជាមួយ %s មិនបាត់ journal មុន counter បានផ្ទៀងផ្ទាត់', async kind => {
    tree[PICKUP] = { [DAY]: { pickupRevision: 1, pickupResetEpoch: 0, packagesPickedUp: 0 } }; load();
    const api = firebaseState.fb as any, transact = api.runTransaction;
    let historyAborted = false;
    api.runTransaction = async (ref: any, updater: any) => {
        if (ref.path !== HISTORY + '/target') {
            if (historyAborted && kind === 'rollback') throw new Error('rollback unavailable');
            return transact(ref, updater);
        }
        expect(updater(get(ref.path))).toBeDefined(); delete tree[HISTORY].target;
        expect(updater(null)).toBeUndefined(); historyAborted = true;
        if (kind === 'reset') tree[PICKUP][DAY] = pickupResetRecord(tree[PICKUP][DAY]);
        if (kind === 'context') firebaseState.authGeneration++;
        return { committed: false, snapshot: { val: () => null } };
    };
    expect(await toggleCloseStatus('target')).toBe(false);
    for (let i = 0; i < 60; i++) await Promise.resolve();
    expect(readPickupJournal()).toHaveLength(1);
    expect(tree[PICKUP][DAY].packagesPickedUp).toBe(0);
});

it('whole abort មាន sibling closed ដែលបានរាប់រួច មិនកែ pickup របស់ sibling', async () => {
    seed(['ONE', 'TWO']);
    Object.assign(tree[HISTORY].target.barcodes[1], { isClosed: true, closedAt: NOW - 1000 });
    tree[PICKUP] = { [DAY]: { pickupRevision: 1, pickupResetEpoch: 0, packagesPickedUp: 1,
        pickedUpBarcodes: { TWO: '012345678' }, pickedUpPhones: { '012345678': 1 } } }; load();
    const api = firebaseState.fb as any, transact = api.runTransaction;
    api.runTransaction = async (ref: any, updater: any) => {
        if (ref.path !== HISTORY + '/target') return transact(ref, updater);
        expect(updater(get(ref.path))).toBeDefined();
        tree.zoew_recently_deleted_cod_dod = { deleted: { ...clone(tree[HISTORY].target), trashReason: 'delete', isFromDeletion: true } };
        delete tree[HISTORY].target; expect(updater(null)).toBeUndefined();
        return { committed: false, snapshot: { val: () => null } };
    };
    expect(await toggleCloseStatus('target')).toBe(false);
    for (let i = 0; i < 60; i++) await Promise.resolve();
    expect(readPickupJournal()).toEqual([]);
    expect(tree[PICKUP][DAY].packagesPickedUp).toBe(1);
    expect(tree[PICKUP][DAY].pickedUpBarcodes).toEqual({ TWO: '012345678' });
    expect(tree[PICKUP][DAY].pickedUpPhones).toEqual({ '012345678': 1 });
});

it('original abort ដែល rollback ជាប់ revision ត្រូវរក្សា not-applied ហើយ restart បញ្ចប់ដោយមិន replay history', async () => {
    tree[PICKUP] = { [DAY]: { pickupRevision: 1, pickupResetEpoch: 0, packagesPickedUp: 0 } }; load();
    const api = firebaseState.fb as any, transact = api.runTransaction;
    let aborted = false;
    api.runTransaction = async (ref: any, updater: any) => {
        if (ref.path !== HISTORY + '/target') {
            if (aborted && ref.path.startsWith(PICKUP)) tree[PICKUP][DAY].pickupRevision++;
            return transact(ref, updater);
        }
        expect(updater(get(ref.path))).toBeDefined();
        tree.zoew_recently_deleted_cod_dod = { deleted: { ...clone(tree[HISTORY].target), trashReason: 'delete', isFromDeletion: true } };
        delete tree[HISTORY].target; expect(updater(null)).toBeUndefined(); aborted = true;
        return { committed: false, snapshot: { val: () => null } };
    };
    expect(await toggleCloseStatus('target')).toBe(false);
    for (let i = 0; i < 60; i++) await Promise.resolve();
    expect(readPickupJournal()).toHaveLength(1);
    expect(readPickupJournal()[0]).toMatchObject({ transitionKnown: true, outcome: 'not-applied', hold: 'version-conflict' });
    api.runTransaction = async (ref: any, updater: any) => { expect(ref.path.startsWith(HISTORY)).toBe(false); return transact(ref, updater); };
    pickupIntentsLive.clear(); load(); await resumePickupIntents();
    expect(readPickupJournal()).toEqual([]); expect(tree[PICKUP][DAY].packagesPickedUp).toBe(0);
    expect(tree[HISTORY].target).toBeUndefined();
    const after = clone(tree); await resumePickupIntents(); expect(tree).toEqual(after);
});
