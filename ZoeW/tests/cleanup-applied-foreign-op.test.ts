// A transaction whose reply is lost is resolved from the REST value (runTransactionResolved): "equals what this device
// sent" proves ownership only when the other writer used the same trash slot. A manual Remove, a Delete and the cleanup
// claims meet at different slots ➜ an unproven `applied` claim (no txProven) reads every trash slot of the item on the
// server (the item id + one `$key` range over `id_<stamp>_`: reason ids · `|slot` moves · Delete): the live paths read
// twice, CLEANUP_UNPROVEN_RECHECK_MS apart (cleanupUnprovenOwnership), the journal resume once (resolveCleanupSlot, time has
// passed): another lifecycle-current copy ➜ the claim was not ours (no trash write · no deduction · journal cleared);
// unreadable ➜ wait (journal kept, resume re-checks). On the live paths the read after the delay decides, whether the
// first one was clean or unreadable, so a claim handed to the resume is at least that old.
// The live Delete takes the same check. A definitive `not-applied` clears the prepared journal entry, so no resume
// deducts what the live path refused. Here the recheck delay runs at 0 ms; a held trash write released by the first read
// models another device's write that lands while this device waits.
import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const delays = vi.hoisted(() => ({ hook: null as null | ((ms: number) => Promise<void>) }));
vi.mock('../src/services/tx-outcome', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../src/services/tx-outcome')>();
    return { ...actual, txDelay: (ms: number) => (delays.hook ? delays.hook(ms) : actual.txDelay(0)) };
});
import { cleanupServerRead } from './helpers/cleanup-server-read';
import { dataState, firebaseState, uiState } from '../src/core/state';
import { appLocalStore } from '../src/core/storage';
import { dbListenerFailedPaths, dbListenerPendingPaths } from '../src/core/text';
import { getFormattedDate } from '../src/core/timezone';
import { CLEANUP_UNPROVEN_RECHECK_MS, claimAndCleanupItem, cleanupInFlight, cleanupJournalLive, readCleanupJournal, resumeCleanupJournalEntry } from '../src/domain/cleanup';
import { removeSingleBarcode } from '../src/features/barcode-ops';
import { deleteSingleItem } from '../src/features/entry-ops';
import { activeRestoreClaims, restoreInFlight } from '../src/features/restore';
import { runTransactionResolved } from '../src/services/tx-outcome';
import { noteZtoTrashMode, resetZtoTrashMode } from '../src/services/zto-trash-mode';

const H = 'zoew_scan_history_cod_dod', T = 'zoew_recently_deleted_cod_dod', D = 'zoew_daily_revenue_cod_dod', M = 'zoew_monthly_revenue_cod_dod';
const HOST = 'https://audit-applied.firebaseio.com';
const NOW = Date.UTC(2026, 9, 24, 2);
const DAYS9 = 9 * 86400000;
const CODE = '77130500000091', OTHER = '77130500000092';
const lab = { store: {} as any, stale: null as null | { path: string; value: any }, notApplied: null as null | { path: string; value: any }, lostAfterCommit: '' as string, writes: [] as any[], seeded: null as any,
    holdTrash: null as null | Promise<void>, afterRead: null as null | ((path: string) => void), failReads: 0, onFail: null as null | (() => void) };
const clone = <V,>(v: V): V => (v === undefined ? v : JSON.parse(JSON.stringify(v)));
const parts = (p: string) => p.split('/').filter(Boolean);
const getAt = (p: string) => clone(parts(p).reduce((n: any, k) => n?.[k], lab.store) ?? null);
function setAt(p: string, v: any) {
    const segs = parts(p); const leaf = segs.pop()!; let node = lab.store;
    for (const s of segs) node = node[s] ||= {};
    if (v === null || v === undefined) delete node[leaf]; else node[leaf] = clone(v);
}
const ref = (p = '') => ({ path: p, key: parts(p).at(-1) || null, toString: () => HOST + '/' + p });
const snap = (r: any, v: any) => ({ ref: r, key: r.key, val: () => clone(v), exists: () => v !== null && v !== undefined });
function rawSdk() {
    return {
        ref: (_db: any, p = '') => ref(p), increment: (n: number) => ({ __inc: n }),
        get: async (r: any) => snap(r, getAt(r.path)),
        set: async (r: any, v: any) => { lab.writes.push({ kind: 'put', path: r.path, value: clone(v) }); setAt(r.path, v); },
        update: async (r: any, ups: any) => {
            lab.writes.push({ kind: 'patch', path: r.path, value: Object.fromEntries(Object.entries(ups).map(([k, v]: any) => [k, v?.__inc !== undefined ? { '.sv': { increment: v.__inc } } : clone(v)])) });
            for (const [k, v] of Object.entries(ups)) {
                const p = [r.path, k].filter(Boolean).join('/');
                setAt(p, (v as any)?.__inc !== undefined ? (Number(getAt(p)) || 0) + (v as any).__inc : v);
            }
        },
        runTransaction: async (r: any, change: (v: any) => any) => {
            if (lab.holdTrash && r.path.startsWith(T + '/')) {
                const gate = lab.holdTrash; lab.holdTrash = null;
                await gate;
            }
            if (lab.notApplied && lab.notApplied.path === r.path) {
                // Supabase: the resend of a lost CAS conflicts inside SB_OP_REPLAY_SAFE_MS ➜ txOutcome 'not-applied'
                // (Firebase reaches the same journal state with 'unknown' when the REST value equals neither side).
                const cached = lab.notApplied.value; lab.notApplied = null;
                change(clone(cached));
                throw Object.assign(new Error('Supabase CAS resend conflicted after a lost reply'), { code: 'DISCONNECT', txOutcome: 'not-applied' });
            }
            if (lab.stale && lab.stale.path === r.path) {
                // Firebase runs the updater on its local cache first; the CAS put is in flight when the socket drops:
                // the SDK rejects with Error('disconnect') (cancelSentTransactions_). The put never landed.
                const cached = lab.stale.value; lab.stale = null;
                change(clone(cached));
                throw new Error('disconnect');
            }
            if (lab.lostAfterCommit && lab.lostAfterCommit === r.path) {
                lab.lostAfterCommit = '';
                const landed = change(clone(getAt(r.path)));
                if (landed !== undefined) { lab.writes.push({ kind: 'put', path: r.path, value: clone(landed) }); setAt(r.path, landed); }
                throw new Error('disconnect');
            }
            const prior = getAt(r.path); const next = change(clone(prior));
            if (next === undefined) return { committed: false, snapshot: snap(r, prior) };
            lab.writes.push({ kind: 'put', path: r.path, value: clone(next) });
            setAt(r.path, next); return { committed: true, snapshot: snap(r, getAt(r.path)) };
        },
        onValue: () => () => {}, off: () => {}
    };
}
function sdk() {
    const raw = rawSdk();
    return { ...raw, runTransaction: (r: any, up: any, opts?: any) => runTransactionResolved(raw, r, up, opts) };
}
const SCAN_DAY = () => getFormattedDate(new Date(NOW - DAYS9));
function item(id: string, codes: string[]) {
    const at = NOW - DAYS9;
    const barcodes = codes.map((code) => ({ code, time: '08:00:00 (' + SCAN_DAY() + ')', cod: 10, dod: 2, locker: 'N/A', isClosed: false, isDeducted: false, isFromDeletion: false, createdAt: at }));
    return { id, phone: '012345678', scanDate: SCAN_DAY(), time: barcodes[0].time, createdAt: at, count: codes.length, cod: 10 * codes.length, dod: 2 * codes.length,
        price: 12 * codes.length, isClosed: false, isCalled: false, barcode: codes[0], locker: 'N/A', barcodes };
}
function seed(codes: string[]) {
    const id = 'id_' + (NOW - DAYS9) + '_aud1';
    lab.store = {
        [H]: { [id]: item(id, codes) },
        [D]: { [SCAN_DAY()]: { codDollar: 100 + 10 * codes.length, dodDollar: 20 + 2 * codes.length, totalCount: 10 + codes.length } },
        [M]: { [SCAN_DAY().slice(0, 7)]: { codDollar: 100 + 10 * codes.length, dodDollar: 20 + 2 * codes.length, totalCount: 10 + codes.length } }
    };
    sync(); lab.seeded = clone(lab.store); lab.writes = [];
    return id;
}
function sync() {
    dataState.scanHistory = Object.values(getAt(H) || {});
    dataState.deletedItems = Object.values(getAt(T) || {});
    dataState.dailyRevenueData = getAt(D) || {}; dataState.monthlyRevenueData = getAt(M) || {};
    dataState.dailyPickupData = {}; dataState.dailyCollectedData = {};
}
const money = () => [getAt(D + '/' + SCAN_DAY()), getAt(M + '/' + SCAN_DAY().slice(0, 7))].map((r) => [r.codDollar, r.dodDollar, r.totalCount]);
const trashCopiesOf = (code: string) => (Object.values(getAt(T) || {}) as any[]).filter((t) => (t.barcodes || []).some((b: any) => b.code === code));
const historyCopiesOf = (code: string) => (Object.values(getAt(H) || {}) as any[]).filter((t) => (t.barcodes || []).some((b: any) => b.code === code));

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(NOW);
    vi.stubGlobal('crypto', webcrypto); vi.stubGlobal('confirm', () => true); vi.stubGlobal('alert', vi.fn());
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    lab.store = {}; lab.stale = null; lab.holdTrash = null; lab.afterRead = null; lab.failReads = 0; lab.onFail = null; delays.hook = null;
    appLocalStore.clear(); activeRestoreClaims.clear(); restoreInFlight.clear(); cleanupInFlight.clear(); cleanupJournalLive.clear();
    dbListenerPendingPaths.clear(); dbListenerFailedPaths.clear();
    firebaseState.authGeneration++; firebaseState.db = { name: 'audit-db' } as any; firebaseState.fb = sdk() as any;
    firebaseState.auth = { currentUser: { uid: 'audit-user', getIdToken: async () => 'synthetic-id' } } as any;
    firebaseState.firebaseConfig = { databaseURL: HOST } as any;
    firebaseState.isDatabaseInitialized = true; firebaseState.isDatabaseConnected = true; firebaseState.hasEverConnectedToDatabase = true;
    firebaseState.serverClockTrusted = true; firebaseState.serverTimeOffsetMs = 0;
    firebaseState.dbRefHistory = ref(H) as any; firebaseState.dbRefDeleted = ref(T) as any; firebaseState.dbRefDailyRevenue = ref(D) as any; firebaseState.dbRefMonthlyRevenue = ref(M) as any;
    firebaseState.dbRefDailyPickup = ref('zoew_daily_pickup_cod_dod') as any; firebaseState.dbRefDailyCollected = ref('zoew_daily_collected_cod_dod') as any;
    appLocalStore.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: HOST }));
    resetZtoTrashMode(); noteZtoTrashMode(null);
    uiState.toasts = [];
    const serverRead = cleanupServerRead(getAt, (path) => lab.afterRead?.(path));
    vi.stubGlobal('fetch', vi.fn(async (input: any, init?: any) => {
        if (lab.failReads > 0 && decodeURIComponent(new URL(String(input)).pathname).startsWith('/' + T)) { lab.failReads--; const failed = lab.onFail; lab.onFail = null; failed?.(); throw new TypeError('Failed to fetch'); }
        return serverRead(input, init);
    }));
    (window as any).ZoeErrors = { capture: vi.fn() };
});
afterEach(() => {
    lab.seeded = null;
    firebaseState.authGeneration++;
    vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); delete (window as any).ZoeErrors;
});

describe('an unproven applied claim proves its ownership on the server before writing trash or deducting (Firebase REST resolver)', () => {
    it('control: the stale whole abandon after another device\'s whole abandon meets the same slot and does not deduct twice', async () => {
        const id = seed([CODE]); const stale = getAt(H + '/' + id);
        await claimAndCleanupItem(id, 'abandon'); sync();
        expect(money()).toEqual([[100, 20, 10], [100, 20, 10]]);
        dataState.scanHistory = [clone(stale)]; dataState.deletedItems = [];
        lab.stale = { path: H + '/' + id, value: stale };
        await claimAndCleanupItem(id, 'abandon'); sync();
        expect(money()).toEqual([[100, 20, 10], [100, 20, 10]]);
        expect(trashCopiesOf(CODE)).toHaveLength(1);
    });

    it('own claim: the 8-day abandon lands but its reply is lost ➜ resolved applied, no foreign copy ➜ deducted exactly once', async () => {
        const id = seed([CODE]);
        lab.lostAfterCommit = H + '/' + id;
        await claimAndCleanupItem(id, 'abandon'); sync();
        expect({ money: money(), trashCopies: trashCopiesOf(CODE).length, history: historyCopiesOf(CODE).length, journal: readCleanupJournal().length })
            .toEqual({ money: [[100, 20, 10], [100, 20, 10]], trashCopies: 1, history: 0, journal: 0 });
    });

    it('own Remove: the claim lands but its reply is lost ➜ resolved applied, no foreign copy ➜ done and deducted exactly once', async () => {
        const id = seed([CODE]);
        lab.lostAfterCommit = H + '/' + id;
        expect(await removeSingleBarcode(id, CODE)).toBe('done'); sync();
        expect({ money: money(), trashCopies: trashCopiesOf(CODE).length, journal: readCleanupJournal().length })
            .toEqual({ money: [[100, 20, 10], [100, 20, 10]], trashCopies: 1, journal: 0 });
    });

    it('A: device B removes the only barcode · device A (stale cache) runs the 8-day abandon whose reply is lost ➜ deducted once', async () => {
        const id = seed([CODE]); const stale = getAt(H + '/' + id);
        expect(await removeSingleBarcode(id, CODE)).toBe('done'); sync();
        expect(money()).toEqual([[100, 20, 10], [100, 20, 10]]);
        dataState.scanHistory = [clone(stale)]; dataState.deletedItems = [];
        lab.stale = { path: H + '/' + id, value: stale };
        await claimAndCleanupItem(id, 'abandon'); sync();
        expect({ money: money(), trashCopies: trashCopiesOf(CODE).length, journal: readCleanupJournal().length })
            .toEqual({ money: [[100, 20, 10], [100, 20, 10]], trashCopies: 1, journal: 0 });
    });

    it('B: device A abandons the only barcode · device B (stale cache) presses Remove whose reply is lost ➜ deducted once', async () => {
        const id = seed([CODE]); const stale = getAt(H + '/' + id);
        await claimAndCleanupItem(id, 'abandon'); sync();
        expect(money()).toEqual([[100, 20, 10], [100, 20, 10]]);
        dataState.scanHistory = [clone(stale)]; dataState.deletedItems = [];
        lab.stale = { path: H + '/' + id, value: stale };
        const outcome = await removeSingleBarcode(id, CODE); sync();
        expect({ outcome, money: money(), trashCopies: trashCopiesOf(CODE).length })
            .toEqual({ outcome: 'missing', money: [[100, 20, 10], [100, 20, 10]], trashCopies: 1 });
    });

    it('C: device A deletes the row (money kept) · device B (stale cache) presses Remove whose reply is lost ➜ money untouched', async () => {
        const id = seed([CODE]); const stale = getAt(H + '/' + id);
        expect(await deleteSingleItem(id, { confirmed: true, quiet: true })).toBe('deleted'); sync();
        expect(money()).toEqual([[110, 22, 11], [110, 22, 11]]);
        dataState.scanHistory = [clone(stale)]; dataState.deletedItems = [];
        lab.stale = { path: H + '/' + id, value: stale };
        const outcome = await removeSingleBarcode(id, CODE); sync();
        expect({ outcome, money: money(), trashCopies: trashCopiesOf(CODE).length, historyCopies: historyCopiesOf(CODE).length })
            .toEqual({ outcome: 'missing', money: [[110, 22, 11], [110, 22, 11]], trashCopies: 1, historyCopies: 0 });
    });

    it('E: device B removes a closed barcode · device A (stale cache) runs the 2h pickup cleanup, reply lost ➜ one trash copy; a restore must not leave a counted parcel with deducted money', async () => {
        const id = seed([CODE]); const closedAt = NOW - 3 * 3600000;
        setAt(H + '/' + id + '/barcodes/0/isClosed', true); setAt(H + '/' + id + '/barcodes/0/closedAt', closedAt);
        setAt(H + '/' + id + '/isClosed', true); setAt(H + '/' + id + '/closedAt', closedAt); lab.seeded = clone(lab.store); sync();
        const stale = getAt(H + '/' + id);
        expect(await removeSingleBarcode(id, CODE)).toBe('done'); sync();
        expect(money()).toEqual([[100, 20, 10], [100, 20, 10]]);
        dataState.scanHistory = [clone(stale)]; dataState.deletedItems = [];
        lab.stale = { path: H + '/' + id, value: stale };
        await claimAndCleanupItem(id, 'close'); sync();
        const copies = trashCopiesOf(CODE).map((t) => t.trashReason).sort();
        expect({ money: money(), copies }).toEqual({ money: [[100, 20, 10], [100, 20, 10]], copies: ['remove'] });
    });

    it('F: device A abandons the only barcode · device B (stale views) presses Remove whose lost reply resolves not-applied ➜ the orphan journal resume must not deduct again', async () => {
        const id = seed([CODE]); const stale = getAt(H + '/' + id);
        await claimAndCleanupItem(id, 'abandon'); sync();
        expect(money()).toEqual([[100, 20, 10], [100, 20, 10]]);
        dataState.scanHistory = [clone(stale)]; dataState.deletedItems = [];
        lab.notApplied = { path: H + '/' + id, value: stale };
        const outcome = await removeSingleBarcode(id, CODE);
        expect(outcome).toBe('failed');
        await vi.waitFor(() => expect(readCleanupJournal()).toHaveLength(0), { timeout: 4000 });
        expect({ money: money(), trashCopies: trashCopiesOf(CODE).length })
            .toEqual({ money: [[100, 20, 10], [100, 20, 10]], trashCopies: 1 });
    });

    it('G: device B removes the only barcode · device A (stale views) runs the abandon whose lost reply resolves not-applied ➜ the orphan journal resume must not deduct again', async () => {
        const id = seed([CODE]); const stale = getAt(H + '/' + id);
        expect(await removeSingleBarcode(id, CODE)).toBe('done'); sync();
        expect(money()).toEqual([[100, 20, 10], [100, 20, 10]]);
        dataState.scanHistory = [clone(stale)]; dataState.deletedItems = [];
        lab.notApplied = { path: H + '/' + id, value: stale };
        await claimAndCleanupItem(id, 'abandon');
        await vi.waitFor(() => expect(readCleanupJournal()).toHaveLength(0), { timeout: 4000 });
        expect({ money: money(), trashCopies: trashCopiesOf(CODE).length })
            .toEqual({ money: [[100, 20, 10], [100, 20, 10]], trashCopies: 1 });
    });

    it('D: partial row (2 barcodes) · device B removes one · device A (stale cache + stale trash view) abandons it, reply lost ➜ deducted once', async () => {
        const id = seed([CODE, OTHER]); const stale = getAt(H + '/' + id);
        // OTHER is restored recently so only CODE is ripe for the 8-day rule (partial claim).
        stale.barcodes[1].restoredAt = NOW - 3600000; setAt(H + '/' + id + '/barcodes/1/restoredAt', NOW - 3600000); lab.seeded = clone(lab.store); sync();
        expect(await removeSingleBarcode(id, CODE)).toBe('done'); sync();
        expect(money()).toEqual([[110, 22, 11], [110, 22, 11]]);
        dataState.scanHistory = [clone(stale)]; dataState.deletedItems = [];
        lab.stale = { path: H + '/' + id, value: stale };
        await claimAndCleanupItem(id, 'abandon'); sync();
        expect({ money: money(), trashCopies: trashCopiesOf(CODE).length })
            .toEqual({ money: [[110, 22, 11], [110, 22, 11]], trashCopies: 1 });
    });
});

describe('foreign row moves the first read cannot see yet (review R1–R3)', () => {
    const holdBTrash = () => {
        let release!: () => void;
        lab.holdTrash = new Promise<void>((resolve) => { release = resolve; });
        return () => release();
    };
    const releaseOnFirstRangeRead = (release: () => void) => {
        lab.afterRead = (path) => { if (path === T) { lab.afterRead = null; release(); } };
    };

    it('R1: B\'s Remove history move landed, its trash write lands while A re-reads ➜ A\'s lost-reply abandon does not deduct a second time', async () => {
        const id = seed([CODE]); const stale = getAt(H + '/' + id);
        const releaseB = holdBTrash();
        const bRemove = removeSingleBarcode(id, CODE);
        await vi.waitFor(() => expect(getAt(H + '/' + id)).toBeNull(), { timeout: 4000 });
        expect(trashCopiesOf(CODE), 'B has not written its trash copy yet').toHaveLength(0);

        cleanupInFlight.delete(id);
        dataState.scanHistory = [clone(stale)]; dataState.deletedItems = [];
        lab.stale = { path: H + '/' + id, value: stale };
        releaseOnFirstRangeRead(releaseB);
        await claimAndCleanupItem(id, 'abandon');
        await bRemove; sync();
        expect({ money: money(), copies: trashCopiesOf(CODE).map((t) => t.trashReason) })
            .toEqual({ money: [[100, 20, 10], [100, 20, 10]], copies: ['remove'] });
        expect(readCleanupJournal(), 'A keeps no journal entry').toEqual([]);
    }, 20000);

    const partialPair = () => {
        const id = seed([CODE, OTHER]);
        const fresh = { ...getAt(H + '/' + id) };
        fresh.barcodes = fresh.barcodes.map((b: any) => (b.code === OTHER ? { ...b, restoredAt: NOW - 86400000 } : b));
        setAt(H + '/' + id, fresh); sync(); lab.seeded = clone(lab.store);
        return { id, stale: getAt(H + '/' + id) };
    };

    it('R1 (unreadable first read): A\'s first ownership read fails · B\'s trash write lands while A waits ➜ the later read decides, no second deduction', async () => {
        const { id, stale } = partialPair();
        const releaseB = holdBTrash();
        const bRemove = removeSingleBarcode(id, CODE);
        await vi.waitFor(() => expect(getAt(H + '/' + id).barcodes.map((b: any) => b.code)).toEqual([OTHER]), { timeout: 4000 });

        cleanupInFlight.delete(id);
        dataState.scanHistory = [clone(stale)]; dataState.deletedItems = [];
        lab.stale = { path: H + '/' + id, value: stale };
        lab.failReads = 2;
        const waited: number[] = [];
        delays.hook = async (ms) => { waited.push(ms); releaseB(); await new Promise((resolve) => setTimeout(resolve, 0)); };
        await claimAndCleanupItem(id, 'abandon');
        expect(waited, 'the read after the delay decides an unreadable first read').toEqual([CLEANUP_UNPROVEN_RECHECK_MS]);
        releaseB();
        await bRemove; sync();
        expect({ money: money(), copies: trashCopiesOf(CODE).map((t) => t.trashReason), journal: readCleanupJournal() })
            .toEqual({ money: [[110, 22, 11], [110, 22, 11]], copies: ['remove'], journal: [] });
    }, 20000);

    it('R1 (resume): both reads fail ➜ the partial claim waits for the resume ➜ B\'s trash write lands ➜ the resume finds it, no second deduction', async () => {
        const { id, stale } = partialPair();
        const releaseB = holdBTrash();
        const bRemove = removeSingleBarcode(id, CODE);
        await vi.waitFor(() => expect(getAt(H + '/' + id).barcodes.map((b: any) => b.code)).toEqual([OTHER]), { timeout: 4000 });

        cleanupInFlight.delete(id);
        dataState.scanHistory = [clone(stale)]; dataState.deletedItems = [];
        lab.stale = { path: H + '/' + id, value: stale };
        lab.failReads = 4;
        await claimAndCleanupItem(id, 'abandon');
        expect(readCleanupJournal().map((e) => e.reason).sort(), 'B\'s live Remove · A\'s unverified partial claim waits for the resume').toEqual(['abandon', 'remove']);
        expect(money(), 'nothing deducted yet (B\'s trash write is held · A waits)').toEqual([[120, 24, 12], [120, 24, 12]]);

        const aEntry = readCleanupJournal().find((e) => e.reason === 'abandon')!;
        dataState.scanHistory = [getAt(H + '/' + id)]; dataState.deletedItems = [];
        releaseB();
        await bRemove;
        await resumeCleanupJournalEntry(aEntry.trashItem.id);
        sync();
        expect({ money: money(), copies: trashCopiesOf(CODE).map((t) => t.trashReason), journal: readCleanupJournal() })
            .toEqual({ money: [[110, 22, 11], [110, 22, 11]], copies: ['remove'], journal: [] });
    }, 20000);

    it('R1 residual (A355): B\x27s trash write lands after both of A\x27s reads ➜ two trash copies, the money still deducted once (per-barcode claim)', async () => {
        const id = seed([CODE]); const stale = getAt(H + '/' + id);
        const releaseB = holdBTrash();
        const bRemove = removeSingleBarcode(id, CODE);
        await vi.waitFor(() => expect(getAt(H + '/' + id)).toBeNull(), { timeout: 4000 });

        cleanupInFlight.delete(id);
        dataState.scanHistory = [clone(stale)]; dataState.deletedItems = [];
        lab.stale = { path: H + '/' + id, value: stale };
        await claimAndCleanupItem(id, 'abandon');
        releaseB();
        await bRemove; sync();
        expect({ money: money(), copies: trashCopiesOf(CODE).map((t) => t.trashReason).sort() })
            .toEqual({ money: [[100, 20, 10], [100, 20, 10]], copies: ['remove', 'returned'] });
    }, 20000);

    it('R2: fresh lifecycle under a reused id · B Deletes (trash moves to its delete|slot id) · A\'s lost-reply abandon ➜ money untouched, one copy', async () => {
        const id = seed([CODE]);
        const oldCopy = { ...item(id, [OTHER]), createdAt: NOW - DAYS9 - 86400000, deletedAt: NOW - DAYS9 + 3600000, trashReason: 'delete', isFromDeletion: true };
        setAt(T + '/' + id, oldCopy); sync();
        const stale = getAt(H + '/' + id);

        expect(await deleteSingleItem(id, { confirmed: true, quiet: true })).toBe('deleted'); sync();
        expect(money(), 'Delete keeps the money').toEqual([[110, 22, 11], [110, 22, 11]]);
        expect(trashCopiesOf(CODE).map((t) => t.id), 'the Delete copy moved off the taken slot').not.toContain(id);

        cleanupInFlight.delete(id);
        dataState.scanHistory = [clone(stale)]; dataState.deletedItems = [clone(oldCopy)];
        lab.stale = { path: H + '/' + id, value: stale };
        await claimAndCleanupItem(id, 'abandon'); sync();
        expect({ money: money(), copies: trashCopiesOf(CODE).map((t) => t.trashReason) })
            .toEqual({ money: [[110, 22, 11], [110, 22, 11]], copies: ['delete'] });
    }, 20000);

    it('R3: B removes the only barcode · A (stale cache) presses Delete whose reply is lost ➜ the parcel never lands in trash twice', async () => {
        const id = seed([CODE]); const stale = getAt(H + '/' + id);
        expect(await removeSingleBarcode(id, CODE)).toBe('done'); sync();
        expect(money()).toEqual([[100, 20, 10], [100, 20, 10]]);

        cleanupInFlight.delete(id);
        dataState.scanHistory = [clone(stale)]; dataState.deletedItems = [];
        lab.stale = { path: H + '/' + id, value: stale };
        expect(await deleteSingleItem(id, { confirmed: true, quiet: true })).toBe('missing'); sync();
        expect({ money: money(), copies: trashCopiesOf(CODE).map((t) => t.trashReason), journal: readCleanupJournal() })
            .toEqual({ money: [[100, 20, 10], [100, 20, 10]], copies: ['remove'], journal: [] });
    }, 20000);

    it('control (R3): A\'s own Delete lands but its reply is lost ➜ resolved applied, no foreign copy ➜ deleted once, money kept', async () => {
        const id = seed([CODE]);
        lab.lostAfterCommit = H + '/' + id;
        expect(await deleteSingleItem(id, { confirmed: true, quiet: true })).toBe('deleted'); sync();
        expect({ money: money(), copies: trashCopiesOf(CODE).map((t) => t.trashReason), history: historyCopiesOf(CODE).length })
            .toEqual({ money: [[110, 22, 11], [110, 22, 11]], copies: ['delete'], history: 0 });
    }, 20000);
});
