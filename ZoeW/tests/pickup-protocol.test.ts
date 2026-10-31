import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { dataState, firebaseState } from '../src/core/state';
import { appLocalStore } from '../src/core/storage';
import * as storageApi from '../src/core/storage';
import { dbListenerFailedPaths, dbListenerPendingPaths } from '../src/core/text';
import * as pickup from '../src/domain/pickup';
import { reapplyPickupMarks, revertPickupMarks } from '../src/domain/collected';
import { applyBarcodeCloseChange } from '../src/features/barcode-ops';
const DAY = '2026-10-29', PATH = 'zoew_daily_pickup_cod_dod/' + DAY;
const KEY = 'PKPROTO1', PHONE = '0960000001';
const clone = (value: any) => value == null ? value : JSON.parse(JSON.stringify(value));
let historyHookReady = false, historyHookRuns = 0;
let store: Record<string, any>, writes: string[], onHistoryRead: (() => Promise<void>) | null;
const get = (path: string) => clone(store[path] ?? null);
const mark = (closed = true) => ({ key: KEY, phoneKey: PHONE, closed });
function history(closed: boolean) { store.zoew_scan_history_cod_dod = { item1: { id: 'item1', phone: PHONE, scanDate: DAY, barcodes: [{ code: KEY, isClosed: closed, ...(closed ? { closedAt: Date.now() } : {}) }] } }; }
function sdk() {
    return {
        ref: (_db: any, path: string) => ({ path }),
        get: async ({ path }: any) => { const value = get(path); if (path === PATH && onHistoryRead) historyHookReady = true; if (path === 'zoew_scan_history_cod_dod' && onHistoryRead && historyHookReady) { const run = onHistoryRead; onHistoryRead = null; historyHookReady = false; historyHookRuns++; await run(); } return { val: () => value, exists: () => value !== null }; },
        runTransaction: async ({ path }: any, updater: any) => { const next = updater(get(path)); if (next === undefined) return { committed: false, snapshot: { val: () => get(path) } }; store[path] = clone(next); writes.push(path); return { committed: true, snapshot: { val: () => get(path) } }; }
    };
}
async function intent(done = false) { const tracker = pickup.pickupIntentTracker(() => true); const context = await tracker.prepare(DAY, [KEY]); expect(context).toBeTruthy(); expect(tracker.start()).toBe(true); expect(tracker.confirm([KEY])).toBe(true); if (done) pickup.notePickupIntentDone(context.intent); tracker.release(); return context; }
beforeEach(() => {
    store = {}; writes = []; onHistoryRead = null; historyHookReady = false; historyHookRuns = 0; appLocalStore.clear();
    appLocalStore.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: 'https://pickup-protocol.test' }));
    firebaseState.auth = { currentUser: { uid: 'user1' } } as any;
    firebaseState.db = {} as any; firebaseState.fb = sdk() as any; firebaseState.authGeneration++;
    firebaseState.dbRefDailyPickup = { path: PATH } as any;
    dataState.dailyPickupData = {}; dataState.scanHistory = []; dataState.deletedItems = []; dataState.pickupResumeInFlight = false;
    dbListenerFailedPaths.clear(); dbListenerPendingPaths.clear(); pickup.pickupIntentsLive.clear(); vi.stubGlobal('confirm', () => true);
});
afterEach(() => { for (const id of pickup.pickupIntentsLive) pickup.releasePickupIntent(id); vi.restoreAllMocks(); vi.unstubAllGlobals(); appLocalStore.clear(); });
it.each([false, true])('foreign close after truth read survives replay; same-phone ABA=%s', async (samePhone) => {
    history(false); const context = await intent(true);
    if (samePhone) await pickup.commitPickupMarks(DAY, [mark()], false, true, undefined, context);
    vi.resetModules();
    const peerState = await import('../src/core/state');
    Object.assign(peerState.firebaseState, { db: firebaseState.db, fb: firebaseState.fb, auth: firebaseState.auth, authGeneration: firebaseState.authGeneration,
        isInitializingFirebase: false, dbRefDailyPickup: firebaseState.dbRefDailyPickup });
    const peer = await import('../src/domain/pickup');
    let foreignWrite: any = null;
    onHistoryRead = async () => {
        history(true); const revision = get(PATH).pickupRevision, localClock = pickup.pickupAddClockNow();
        const foreign = await peer.capturePickupContext(DAY);
        const saved = await peer.commitPickupMarks(DAY, [mark()], false, true, undefined, foreign);
        foreignWrite = { saved, revisionDelta: get(PATH).pickupRevision - revision, localClockDelta: pickup.pickupAddClockNow() - localClock };
    };
    await pickup.resumePickupIntents();
    expect(historyHookRuns).toBe(1);
    expect(foreignWrite).toEqual({ saved: true, revisionDelta: 1, localClockDelta: 0 });
    expect(get(PATH).pickedUpBarcodes).toEqual({ [KEY]: PHONE }); expect(get(PATH).packagesPickedUp).toBe(1);
    expect(pickup.readPickupJournal()).toHaveLength(1); expect(pickup.readPickupJournal()[0].hold).toBe('version-conflict');
    await pickup.resumePickupIntents(); expect(get(PATH).packagesPickedUp).toBe(1); expect(pickup.readPickupJournal()).toEqual([]);
});
it('optimistic pickup before history; crash after history before reapply repairs within original epoch', async () => {
    history(false); const older = await intent(true), foreign = await intent(false);
    await pickup.commitPickupMarks(DAY, [mark()], false, true, undefined, foreign);
    onHistoryRead = async () => { history(true); }; pickup.pickupIntentsLive.add(foreign.intent);
    await pickup.resumePickupIntents(); expect(historyHookRuns).toBe(1); expect(get(PATH).packagesPickedUp).toBe(0); expect(pickup.readPickupJournal().map(e => e.id)).not.toContain(older.intent);
    pickup.pickupIntentsLive.clear(); await pickup.resumePickupIntents(); expect(get(PATH).pickedUpBarcodes).toEqual({ [KEY]: PHONE }); expect(pickup.readPickupJournal()).toEqual([]);
});
it('Reset between optimistic and authoritative reapply wins; replay/revert preserve original epoch', async () => {
    history(true); const context = await intent(); const applied = pickup.markPickupBarcodes(DAY, [mark()], false, context); await applied.commit;
    store[PATH] = pickup.pickupResetRecord(get(PATH)); const reset = get(PATH);
    expect(await reapplyPickupMarks(applied, [mark()], DAY).commit).toBeNull(); expect(await revertPickupMarks(applied, null, true).commit).toBeNull();
    await pickup.resumePickupIntents(); expect(get(PATH)).toEqual(reset); expect(pickup.readPickupJournal()).toEqual([]);
});
it('delayed pre-Reset updater refuses changed epoch', async () => {
    const context = await intent(); let entered!: () => void, release!: () => void;
    const ready = new Promise<void>(r => entered = r), gate = new Promise<void>(r => release = r); const real = firebaseState.fb.runTransaction;
    firebaseState.fb.runTransaction = (async (ref, updater) => { entered(); await gate; return real(ref, updater); }) as any;
    const pending = pickup.commitPickupMarks(DAY, [mark()], false, true, undefined, context); await ready; store[PATH] = pickup.pickupResetRecord(get(PATH));
    release(); expect(await pending).toBeNull(); expect(get(PATH).packagesPickedUp).toBe(0); expect(get(PATH).pickupResetEpoch).toBe(1);
});
it('legacy promotion preserves counts exactly; v1 bytes remain HOLD without replay', async () => {
    store[PATH] = { packagesPickedUp: 7, pickedUpPhones: { [PHONE]: 7 } };
    const bytes = JSON.stringify([{ id: 'old', scope: 'https://pickup-protocol.test', date: DAY, keys: [KEY], at: 1 }]); appLocalStore.setItem('zoew_pickup_journal_v1', bytes);
    expect((await pickup.capturePickupContext(DAY)).revision).toBe(1);
    expect(get(PATH)).toEqual({ packagesPickedUp: 7, pickedUpPhones: { [PHONE]: 7 }, pickupRevision: 1, pickupResetEpoch: 0 });
    await pickup.resumePickupIntents(); expect(appLocalStore.getItem('zoew_pickup_journal_v1')).toBe(bytes);
    expect(pickup.pickupPendingSummary()).toEqual({ total: 1, held: 1, reasons: ['legacy-proof'] });
});
it('storage failure blocks close before optimistic history or DB effects', async () => {
    const item = { id: 'item1', phone: PHONE, scanDate: DAY, barcodes: [{ code: KEY, isClosed: false }] }; dataState.scanHistory = [item];
    vi.spyOn(storageApi, 'safeStoreSet').mockReturnValue(false);
    expect(await applyBarcodeCloseChange('item1', KEY, true, { silent: true })).toBe(false); expect(item.barcodes[0].isClosed).toBe(false); expect(writes).toEqual([]);
});
it('unresolved v2 entries never age out or evict at capacity', () => {
    for (let i = 0; i < pickup.PICKUP_JOURNAL_MAX; i++) pickup.writePickupJournal([{ id: 'full' + i, protocol: 2, scope: 'https://pickup-protocol.test', uid: 'user1', date: DAY, keys: [KEY], at: 1 }]);
    const before = pickup.readPickupJournal();
    expect(before).toHaveLength(200); expect(before.every(entry => entry.at === 1)).toBe(true);
    expect(pickup.beginPickupIntent(DAY, [KEY])).toBeNull(); expect(pickup.readPickupJournal()).toEqual(before);
});
it('same-phone reapply advances revision with unchanged set', async () => {
    const context = await intent(); const applied = pickup.markPickupBarcodes(DAY, [mark()], false, context); await applied.commit; const before = get(PATH);
    expect(await reapplyPickupMarks(applied, [mark()], DAY).commit).toBe(true); expect(get(PATH).pickupRevision).toBe(before.pickupRevision + 1); expect(get(PATH).pickedUpBarcodes).toEqual(before.pickedUpBarcodes);
});
it('session replacement during authoritative read admits no writes into new backend', async () => {
    const api = firebaseState.fb, original = api.get; api.get = (async (ref) => { const result = await original(ref); firebaseState.db = {} as any; firebaseState.authGeneration++; return result; }) as any;
    expect(await pickup.pickupIntentTracker(() => true).prepare(DAY, [KEY])).toBeNull(); expect(writes).toEqual([]);
});
it('foreign owner without Web Locks remains HOLD', async () => {
    const context = await intent(); pickup.patchPickupJournalEntry(context.intent, { owner: 'other-page' }); history(true); const before = clone(store);
    await pickup.resumePickupIntents(); expect(store).toEqual(before); expect(pickup.readPickupJournal()[0].hold).toBe('recovery-pending');
});
it.each([{ pickupRevision: 1 }, { pickupRevision: 1.5, pickupResetEpoch: 0 }, { pickupRevision: Number.MAX_SAFE_INTEGER, pickupResetEpoch: 0 }])('invalid metadata fails closed: %j', async (metadata) => {
    store[PATH] = { packagesPickedUp: 0, ...metadata }; await expect(pickup.capturePickupContext(DAY)).rejects.toThrow('PICKUP_PROTOCOL_INVALID'); expect(writes).toEqual([]);
});

it('foreign no-lock owner is not stolen by a receiver which has Web Locks', async () => {
    const context = await intent(); pickup.patchPickupJournalEntry(context.intent, { owner: 'other-page', locked: false });
    const request = vi.fn((_name, _options, callback) => Promise.resolve(callback({ name: 'available' })));
    Object.defineProperty(navigator, 'locks', { configurable: true, value: { request } });
    try { history(true); const before = clone(store); await pickup.resumePickupIntents(); expect(store).toEqual(before); expect(request).not.toHaveBeenCalled(); }
    finally { delete (navigator as any).locks; }
});

it('creator obtains ownership before publishing its intent or first database effect', async () => {
    let grant!: () => void;
    Object.defineProperty(navigator, 'locks', { configurable: true, value: { request: (_name, callback) => new Promise(resolve => { grant = () => resolve(callback({})); }) } });
    const tracker = pickup.pickupIntentTracker(() => true);
    try {
        const preparing = tracker.prepare(DAY, [KEY]);
        expect(pickup.readPickupJournal()).toEqual([]); expect(writes).toEqual([]);
        grant(); expect(await preparing).toBeTruthy(); expect(pickup.readPickupJournal()[0].locked).toBe(true);
    } finally { tracker.release(); delete (navigator as any).locks; }
});

it('journal append failure after pickup ACK cannot retire the older durable intent', async () => {
    const tracker = pickup.pickupIntentTracker(() => true), context = await tracker.prepare(DAY, [KEY]); tracker.start(); tracker.confirm([KEY]);
    const applied = pickup.markPickupBarcodes(DAY, [mark()], false, context); tracker.note(applied); await applied.commit;
    const failure = vi.spyOn(storageApi, 'safeStoreSet').mockReturnValue(false);
    expect(tracker.add(DAY, [KEY, 'foreign-new-key'])).toBe(false);
    expect(await tracker.finish(Promise.resolve(true))).toBe(false);
    expect(pickup.readPickupJournal()).toHaveLength(1);
    expect(pickup.pickupPendingSummary().reasons).toContain('storage-unavailable');
    failure.mockRestore();
    expect(await pickup.pickupIntentTracker(() => true).prepare(DAY, ['next-operation'])).toBeTruthy();
});

it('phone-only existingOnly recovery after an earlier Reset does not re-add closed history', async () => {
    history(true); store[PATH] = { packagesPickedUp: 0, pickupRevision: 2, pickupResetEpoch: 1 };
    const tracker = pickup.pickupIntentTracker(() => true); await tracker.prepare(DAY, [KEY], true); tracker.start(); tracker.confirm([]); tracker.release();
    await pickup.resumePickupIntents(); expect(get(PATH).packagesPickedUp).toBe(0); expect(get(PATH).pickedUpBarcodes).toBeNull(); expect(pickup.readPickupJournal()).toEqual([]);
});

it('scope switch after prepare resolution releases the live intent before caller returns', async () => {
    dataState.scanHistory = [{ id: 'item1', phone: PHONE, scanDate: DAY, barcodes: [{ code: KEY, isClosed: false }] }];
    const original = pickup.pickupIntentTracker;
    vi.spyOn(pickup, 'pickupIntentTracker').mockImplementation((...args) => {
        const tracker = original(...args); const prepare = tracker.prepare;
        return { ...tracker, prepare: async (...prepareArgs) => { const context = await prepare(...prepareArgs); queueMicrotask(() => { firebaseState.authGeneration++; }); return context; } };
    });
    expect(await applyBarcodeCloseChange('item1', KEY, true, { silent: true })).toBe(false);
    expect(pickup.pickupIntentsLive.size).toBe(0);
    expect(pickup.readPickupJournal()).toHaveLength(1);
    expect(dataState.scanHistory[0].barcodes[0].isClosed).toBe(false);
});

it('prepared intent abandoned before effects cannot re-add a key cleared by an earlier Reset', async () => {
    history(true); store[PATH] = { packagesPickedUp: 0, pickupRevision: 2, pickupResetEpoch: 1 };
    const tracker = pickup.pickupIntentTracker(() => true); await tracker.prepare(DAY, [KEY]); tracker.release();
    await pickup.resumePickupIntents(); expect(get(PATH).packagesPickedUp).toBe(0); expect(pickup.readPickupJournal()).toEqual([]);
});

it('history committed but final transition permission not persisted stays explicit HOLD', async () => {
    history(true); const tracker = pickup.pickupIntentTracker(() => true);
    await tracker.prepare(DAY, [KEY]); tracker.start(); tracker.release();
    await pickup.resumePickupIntents(); expect(get(PATH).packagesPickedUp).toBe(0);
    expect(pickup.readPickupJournal()).toHaveLength(1); expect(pickup.readPickupJournal()[0].hold).toBe('recovery-pending');
});

it('offline before close refuses effects and cancels the proven not-started intent', async () => {
    dataState.scanHistory = [{ id: 'item1', phone: PHONE, scanDate: DAY, barcodes: [{ code: KEY, isClosed: false }] }];
    firebaseState.fb.get = (() => Promise.reject(new Error('offline'))) as any;
    expect(await applyBarcodeCloseChange('item1', KEY, true, { silent: true })).toBe(false);
    expect(writes).toEqual([]); expect(dataState.scanHistory[0].barcodes[0].isClosed).toBe(false);
    expect(pickup.readPickupJournal()).toEqual([]); expect(pickup.pickupIntentsLive.size).toBe(0);
});


it('backend configuration switch in progress refuses admission without touching either backend', async () => {
    firebaseState.isInitializingFirebase = true;
    try { expect(await pickup.pickupIntentTracker(() => true).prepare(DAY, [KEY])).toBeNull(); expect(writes).toEqual([]); }
    finally { firebaseState.isInitializingFirebase = false; }
});

it('session replacement releases only stale live ownership and preserves its durable pending evidence', async () => {
    const held = new Set<string>();
    Object.defineProperty(navigator, 'locks', { configurable: true, value: { request: (name, options, callback?) => {
        const run = typeof options === 'function' ? options : callback;
        if (options?.ifAvailable && held.has(name)) return Promise.resolve(run(null));
        held.add(name); return Promise.resolve(run({ name })).finally(() => held.delete(name));
    } } });
    const tracker = pickup.pickupIntentTracker(() => true);
    try {
        const context = await tracker.prepare(DAY, [KEY]); tracker.start();
        expect(held.size).toBe(1); expect(pickup.pickupIntentsLive.has(context.intent)).toBe(true);
        firebaseState.authGeneration++;
        await pickup.resumePickupIntents(); await Promise.resolve(); await pickup.resumePickupIntents();
        expect(held.size).toBe(0); expect(pickup.pickupIntentsLive.has(context.intent)).toBe(false);
        expect(pickup.readPickupJournal()).toHaveLength(1); expect(pickup.readPickupJournal()[0].hold).toBe('recovery-pending');
        expect(await pickup.commitPickupMarks(DAY, [mark()], false, true, undefined, context)).toBeNull();
        expect(get(PATH).packagesPickedUp).toBe(0);
    } finally { tracker.release(); delete (navigator as any).locks; }
});

it('an old replay finally cannot release the new session replay owner', async () => {
    history(false); await intent(true);
    const originalGet = firebaseState.fb.get;
    let count = 0;
    const release: Array<() => void> = [], entered: Array<() => void> = [];
    const ready = [0, 1].map((index) => new Promise<void>(resolve => { entered[index] = resolve; }));
    const gates = [0, 1].map((index) => new Promise<void>(resolve => { release[index] = resolve; }));
    firebaseState.fb.get = (async (ref) => {
        if (ref.path === 'zoew_scan_history_cod_dod') { const index = count++; if (index < gates.length) { entered[index](); await gates[index]; } }
        return originalGet(ref);
    }) as any;
    const old = pickup.resumePickupIntents(); await ready[0];
    firebaseState.authGeneration++;
    const current = pickup.resumePickupIntents(); await ready[1];
    release[0](); await old; expect(dataState.pickupResumeInFlight).toBe(true);
    release[1](); await current; expect(dataState.pickupResumeInFlight).toBe(false); expect(pickup.readPickupJournal()).toEqual([]);
});
