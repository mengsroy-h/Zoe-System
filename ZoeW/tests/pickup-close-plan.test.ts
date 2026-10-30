import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { dataState, firebaseState, uiState, ztoState } from '../src/core/state';
import { appLocalStore } from '../src/core/storage';
import { dbListenerFailedPaths, dbListenerPendingPaths } from '../src/core/text';
import { toggleCloseStatus } from '../src/features/entry-ops';
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
    if (kind === 'timestamp') plan.at = -1;
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

it.each([false, true])('live first-abort និង prior-proposal=%s ត្រូវចែកដាច់ពីគ្នា', async proposed => {
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
    expect(readPickupJournal()).toHaveLength(proposed ? 1 : 0);
    if (proposed) { expect(readPickupJournal()[0].transitionKnown).not.toBe(true); expect(readPickupJournal()[0].allowedAddKeys).toEqual([]); }
});

it('ផែនការ និង receipt ខ្លួនឯង idempotent ក្រោយ replay ទោះ original callback មកយឺត', async () => {
    const journal = pickupIntentTracker(() => true, 'target'); await journal.prepare(DAY, ['ONE']);
    expect(journal.startClose(tree[HISTORY].target, true, true)).toBe(true);
    const proposal = journal.applyClose(clone(tree[HISTORY].target)); expect(proposal?.kind).toBe('before');
    tree[HISTORY].target = clone(proposal?.item); const saved = clone(tree[HISTORY].target); vi.setSystemTime(NOW + 5000);
    expect(journal.applyClose(clone(saved))).toMatchObject({ kind: 'applied', item: saved });
    expect(readPickupJournal()[0].transitionKnown).not.toBe(true);
    tree[HISTORY].target.barcodes[0].pickupTransition.intent = 'foreign';
    expect(journal.applyClose(clone(tree[HISTORY].target))?.kind).toBe('conflict'); expect(journal.firstCloseAbort()).toBe(false);
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
