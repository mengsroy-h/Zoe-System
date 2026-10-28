// Two devices move the same barcode out of history (Remove · Delete · 8-day abandon · 2h pickup cleanup) while replies get
// lost and caches are stale. Every move first claims its barcodes inside the history item (`trashClaim` = a token unique to
// the operation, `claimTrashBarcodes()`), then moves only the barcodes carrying its own token. Both steps are transactions on
// the same item path ➜ only the owner of a claim can remove that barcode, and a lost reply is decided by the token on the
// server (present ➜ not moved · absent ➜ moved by us), never by comparing values another device could also have produced.
// The scenarios below must end with one trash copy per barcode and its money deducted at most once, whatever the order of
// the other device's history move and trash write (R1: the foreign trash write lands only after this device finished).
import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dataState, firebaseState, uiState } from '../src/core/state';
import { appLocalStore } from '../src/core/storage';
import { dbListenerFailedPaths, dbListenerPendingPaths } from '../src/core/text';
import { getFormattedDate } from '../src/core/timezone';
import { claimAndCleanupItem, cleanupInFlight, cleanupJournalLive, readCleanupJournal, resumeInterruptedCleanups } from '../src/domain/cleanup';
import { claimTrashBarcodes, liveTrashClaims, newTrashClaimToken, noteTrashClaim, pendingTrashClaims, trashClaimPolicy } from '../src/domain/trash-claim';
import { removeSingleBarcode } from '../src/features/barcode-ops';
import { claimHistoryItemForClear } from '../src/features/clear-history';
import { deleteSingleItem } from '../src/features/entry-ops';
import { activeRestoreClaims, restoreInFlight } from '../src/features/restore';
import { liveShopScope } from '../src/core/shop-scope';
import { runTransactionResolved } from '../src/services/tx-outcome';
import { noteZtoTrashMode, resetZtoTrashMode } from '../src/services/zto-trash-mode';

const H = 'zoew_scan_history_cod_dod', T = 'zoew_recently_deleted_cod_dod', D = 'zoew_daily_revenue_cod_dod', M = 'zoew_monthly_revenue_cod_dod';
const HOST = 'https://audit-applied.firebaseio.com';
const NOW = Date.UTC(2026, 9, 24, 2);
const DAYS9 = 9 * 86400000;
const CODE = '77130500000091', OTHER = '77130500000092';
type Fault = { path: string; on: number; value?: any };
const lab = { store: {} as any, hits: {} as Record<string, number>, localFirst: null as null | Fault, stale: null as null | Fault, notApplied: null as null | Fault, lost: null as null | Fault,
    holdTrash: null as null | Promise<void>, before: null as null | ((path: string, hit: number) => void), writes: [] as any[], seeded: null as any };
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
const due = (fault: Fault | null, path: string, hit: number) => !!fault && fault.path === path && fault.on === hit;
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
            const hit = lab.hits[r.path] = (lab.hits[r.path] || 0) + 1;
            lab.before?.(r.path, hit);
            if (lab.holdTrash && r.path.startsWith(T + '/')) {
                const gate = lab.holdTrash; lab.holdTrash = null;
                await gate;
            }
            if (due(lab.notApplied, r.path, hit)) {
                // Supabase: the resend of a lost CAS conflicts inside SB_OP_REPLAY_SAFE_MS ➜ txOutcome 'not-applied'.
                change(clone(lab.notApplied!.value)); lab.notApplied = null;
                throw Object.assign(new Error('Supabase CAS resend conflicted after a lost reply'), { code: 'DISCONNECT', txOutcome: 'not-applied' });
            }
            if (due(lab.localFirst, r.path, hit)) {
                // Firebase runs the updater on its local cache first and aborts there when it answers undefined; a value goes to
                // the server, which refuses a stale base, and the updater runs again on the server value.
                const local = change(clone(lab.localFirst!.value)); lab.localFirst = null;
                if (local === undefined) return { committed: false, snapshot: snap(r, lab.localFirst) };
            }
            if (due(lab.stale, r.path, hit)) {
                // Firebase runs the updater on its local cache first; the CAS put is in flight when the socket drops: the SDK
                // rejects with Error('disconnect'). The put never landed.
                change(clone(lab.stale!.value)); lab.stale = null;
                throw new Error('disconnect');
            }
            if (due(lab.lost, r.path, hit)) {
                lab.lost = null;
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
    sync(); lab.seeded = clone(lab.store); lab.writes = []; lab.hits = {};
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
const claimsIn = (id: string) => (getAt(H + '/' + id)?.barcodes || []).filter((b: any) => b.trashClaim !== undefined || b.trashClaimAt !== undefined);
const markersInTrash = () => (Object.values(getAt(T) || {}) as any[]).flatMap((t) => t.barcodes || []).filter((b: any) => 'trashClaim' in b || 'trashClaimAt' in b);
const settle = async () => { for (let i = 0; i < 20; i++) await new Promise((resolve) => setTimeout(resolve, 0)); };

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(NOW);
    vi.stubGlobal('crypto', webcrypto); vi.stubGlobal('confirm', () => true); vi.stubGlobal('alert', vi.fn());
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    lab.store = {}; lab.hits = {}; lab.before = null; lab.localFirst = null; lab.stale = null; lab.notApplied = null; lab.lost = null; lab.holdTrash = null;
    appLocalStore.clear(); activeRestoreClaims.clear(); restoreInFlight.clear(); cleanupInFlight.clear(); cleanupJournalLive.clear(); liveTrashClaims.clear();
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
    vi.stubGlobal('fetch', vi.fn(async (input: any) => {
        const path = decodeURIComponent(new URL(String(input)).pathname).replace(/^\//, '').replace(/\.json$/, '');
        return new Response(JSON.stringify(getAt(path)), { status: 200, headers: { 'content-type': 'application/json' } });
    }));
    (window as any).ZoeErrors = { capture: vi.fn() };
});
afterEach(() => {
    lab.seeded = null;
    firebaseState.authGeneration++;
    vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); delete (window as any).ZoeErrors;
});

describe('a stale device whose reply is lost never moves or deducts a barcode another device already moved', () => {
    it('control: the stale whole abandon after another device\'s whole abandon ➜ one copy, deducted once', async () => {
        const id = seed([CODE]); const stale = getAt(H + '/' + id);
        await claimAndCleanupItem(id, 'abandon'); sync();
        expect(money()).toEqual([[100, 20, 10], [100, 20, 10]]);
        dataState.scanHistory = [clone(stale)]; dataState.deletedItems = [];
        lab.stale = { path: H + '/' + id, on: lab.hits[H + '/' + id] + 1, value: stale };
        await claimAndCleanupItem(id, 'abandon'); await settle(); sync();
        expect({ money: money(), copies: trashCopiesOf(CODE).length, markers: markersInTrash() }).toEqual({ money: [[100, 20, 10], [100, 20, 10]], copies: 1, markers: [] });
    });

    it.each([['claim', 1], ['move', 2]])('own abandon: the %s lands but its reply is lost ➜ decided by the token, deducted exactly once', async (_step, on) => {
        const id = seed([CODE]);
        lab.lost = { path: H + '/' + id, on };
        await claimAndCleanupItem(id, 'abandon'); await settle(); sync();
        expect({ money: money(), trashCopies: trashCopiesOf(CODE).length, history: historyCopiesOf(CODE).length, journal: readCleanupJournal().length, markers: markersInTrash() })
            .toEqual({ money: [[100, 20, 10], [100, 20, 10]], trashCopies: 1, history: 0, journal: 0, markers: [] });
    });

    it.each([['claim', 1], ['move', 2]])('own Remove: the %s lands but its reply is lost ➜ done, deducted exactly once', async (_step, on) => {
        const id = seed([CODE]);
        lab.lost = { path: H + '/' + id, on };
        expect(await removeSingleBarcode(id, CODE)).toBe('done'); await settle(); sync();
        expect({ money: money(), trashCopies: trashCopiesOf(CODE).length, journal: readCleanupJournal().length })
            .toEqual({ money: [[100, 20, 10], [100, 20, 10]], trashCopies: 1, journal: 0 });
    });

    it('own Delete: the move lands but its reply is lost ➜ deleted once, money kept', async () => {
        const id = seed([CODE]);
        lab.lost = { path: H + '/' + id, on: 2 };
        expect(await deleteSingleItem(id, { confirmed: true, quiet: true })).toBe('deleted'); await settle(); sync();
        expect({ money: money(), copies: trashCopiesOf(CODE).map((t) => t.trashReason), history: historyCopiesOf(CODE).length })
            .toEqual({ money: [[110, 22, 11], [110, 22, 11]], copies: ['delete'], history: 0 });
    });

    const staleRuns = [
        ['A: B removes · A (stale) abandons', (id: string) => removeSingleBarcode(id, CODE), (id: string) => claimAndCleanupItem(id, 'abandon'), [[100, 20, 10], [100, 20, 10]], ['remove']],
        ['B: A abandons · B (stale) removes', (id: string) => claimAndCleanupItem(id, 'abandon'), (id: string) => removeSingleBarcode(id, CODE), [[100, 20, 10], [100, 20, 10]], ['returned']],
        ['C: A deletes · B (stale) removes', (id: string) => deleteSingleItem(id, { confirmed: true, quiet: true }), (id: string) => removeSingleBarcode(id, CODE), [[110, 22, 11], [110, 22, 11]], ['delete']],
        ['R3: B removes · A (stale) deletes', (id: string) => removeSingleBarcode(id, CODE), (id: string) => deleteSingleItem(id, { confirmed: true, quiet: true }), [[100, 20, 10], [100, 20, 10]], ['remove']]
    ] as const;
    for (const [name, first, second, expected, copies] of staleRuns) {
        it.each([['stale cache + lost reply', 'stale'], ['lost reply resolved not-applied', 'notApplied']])(`${name}: %s ➜ one copy, money once`, async (_label, fault) => {
            const id = seed([CODE]); const stale = getAt(H + '/' + id);
            await first(id); await settle(); sync();
            dataState.scanHistory = [clone(stale)]; dataState.deletedItems = [];
            lab[fault as 'stale' | 'notApplied'] = { path: H + '/' + id, on: lab.hits[H + '/' + id] + 1, value: stale };
            await second(id); await settle(); sync();
            expect({ money: money(), copies: trashCopiesOf(CODE).map((t) => t.trashReason), journal: readCleanupJournal(), claims: claimsIn(id) })
                .toEqual({ money: expected, copies, journal: [], claims: [] });
        });
    }

    it('E: B removes a closed barcode · A (stale) runs the 2h pickup cleanup, reply lost ➜ one trash copy', async () => {
        const id = seed([CODE]); const closedAt = NOW - 3 * 3600000;
        setAt(H + '/' + id + '/barcodes/0/isClosed', true); setAt(H + '/' + id + '/barcodes/0/closedAt', closedAt);
        setAt(H + '/' + id + '/isClosed', true); setAt(H + '/' + id + '/closedAt', closedAt); lab.seeded = clone(lab.store); sync();
        const stale = getAt(H + '/' + id);
        expect(await removeSingleBarcode(id, CODE)).toBe('done'); sync();
        dataState.scanHistory = [clone(stale)]; dataState.deletedItems = [];
        lab.stale = { path: H + '/' + id, on: lab.hits[H + '/' + id] + 1, value: stale };
        await claimAndCleanupItem(id, 'close'); await settle(); sync();
        expect({ money: money(), copies: trashCopiesOf(CODE).map((t) => t.trashReason) }).toEqual({ money: [[100, 20, 10], [100, 20, 10]], copies: ['remove'] });
    });

    it('D: partial row (2 barcodes) · B removes one · A (stale) abandons it, reply lost ➜ deducted once', async () => {
        const id = seed([CODE, OTHER]);
        setAt(H + '/' + id + '/barcodes/1/restoredAt', NOW - 3600000); lab.seeded = clone(lab.store); sync();
        const stale = getAt(H + '/' + id);
        expect(await removeSingleBarcode(id, CODE)).toBe('done'); sync();
        dataState.scanHistory = [clone(stale)]; dataState.deletedItems = [];
        lab.stale = { path: H + '/' + id, on: lab.hits[H + '/' + id] + 1, value: stale };
        await claimAndCleanupItem(id, 'abandon'); await settle(); sync();
        expect({ money: money(), copies: trashCopiesOf(CODE).length, other: historyCopiesOf(OTHER).length, claims: claimsIn(id) })
            .toEqual({ money: [[110, 22, 11], [110, 22, 11]], copies: 1, other: 1, claims: [] });
    });
});

describe('R1: the other device\'s trash write lands only after this device finished', () => {
    const holdTrash = () => {
        let release!: () => void;
        lab.holdTrash = new Promise<void>((resolve) => { release = resolve; });
        return () => release();
    };

    it('B\'s Remove moved the barcode, its trash write is held · A (stale) abandons with a lost reply ➜ A deducts nothing, B deducts once', async () => {
        const id = seed([CODE]); const stale = getAt(H + '/' + id);
        const releaseB = holdTrash();
        const bRemove = removeSingleBarcode(id, CODE);
        await vi.waitFor(() => expect(getAt(H + '/' + id)).toBeNull(), { timeout: 4000 });
        cleanupInFlight.delete(id);
        dataState.scanHistory = [clone(stale)]; dataState.deletedItems = [];
        lab.stale = { path: H + '/' + id, on: lab.hits[H + '/' + id] + 1, value: stale };
        await claimAndCleanupItem(id, 'abandon'); await settle();
        expect({ money: money(), copies: trashCopiesOf(CODE).length }, 'A finished: nothing moved, nothing deducted').toEqual({ money: [[110, 22, 11], [110, 22, 11]], copies: 0 });
        releaseB();
        expect(await bRemove).toBe('done'); await settle(); sync();
        expect({ money: money(), copies: trashCopiesOf(CODE).map((t) => t.trashReason), journal: readCleanupJournal() })
            .toEqual({ money: [[100, 20, 10], [100, 20, 10]], copies: ['remove'], journal: [] });
    }, 20000);

    it('partial row: B removes one barcode (trash held) · A (stale) abandons the same one, lost reply ➜ deducted once, the sibling stays', async () => {
        const id = seed([CODE, OTHER]);
        setAt(H + '/' + id + '/barcodes/1/restoredAt', NOW - 86400000); lab.seeded = clone(lab.store); sync();
        const stale = getAt(H + '/' + id);
        const releaseB = holdTrash();
        const bRemove = removeSingleBarcode(id, CODE);
        await vi.waitFor(() => expect(getAt(H + '/' + id).barcodes.map((b: any) => b.code)).toEqual([OTHER]), { timeout: 4000 });
        cleanupInFlight.delete(id);
        dataState.scanHistory = [clone(stale)]; dataState.deletedItems = [];
        lab.stale = { path: H + '/' + id, on: lab.hits[H + '/' + id] + 1, value: stale };
        await claimAndCleanupItem(id, 'abandon'); await settle();
        releaseB();
        await bRemove; await settle(); sync();
        expect({ money: money(), copies: trashCopiesOf(CODE).map((t) => t.trashReason), other: historyCopiesOf(OTHER).length, journal: readCleanupJournal() })
            .toEqual({ money: [[110, 22, 11], [110, 22, 11]], copies: ['remove'], other: 1, journal: [] });
    }, 20000);
});

describe('per-barcode trash claims', () => {
    it('a live claim of another operation holds every other move: cleanup skips it, Remove and Delete answer busy, Delete all refuses', async () => {
        const id = seed([CODE]);
        const foreign = newTrashClaimToken();
        expect((await claimTrashBarcodes(id, foreign, () => [CODE])).state).toBe('claimed');
        sync();
        await claimAndCleanupItem(id, 'abandon'); await settle();
        expect(await removeSingleBarcode(id, CODE)).toBe('failed');
        expect(await deleteSingleItem(id, { confirmed: true, quiet: true })).toBe('blocked');
        await expect(claimHistoryItemForClear(id, 'clear_token_x')).rejects.toThrow('CLEAR_HISTORY_IN_PROGRESS');
        await settle(); sync();
        expect({ money: money(), copies: trashCopiesOf(CODE).length, claims: claimsIn(id).map((b: any) => b.trashClaim) })
            .toEqual({ money: [[110, 22, 11], [110, 22, 11]], copies: 0, claims: [foreign] });
    });

    it('a claim older than the stale bound is taken over (its owner died) ➜ the move proceeds once', async () => {
        const id = seed([CODE]);
        setAt(H + '/' + id + '/barcodes/0/trashClaim', 'tc_dead_owner_000');
        setAt(H + '/' + id + '/barcodes/0/trashClaimAt', NOW - trashClaimPolicy().staleMs - 1000); sync();
        await claimAndCleanupItem(id, 'abandon'); await settle(); sync();
        expect({ money: money(), copies: trashCopiesOf(CODE).length, markers: markersInTrash() }).toEqual({ money: [[100, 20, 10], [100, 20, 10]], copies: 1, markers: [] });
    });

    it('a claim stamped far in the future is no live claim (a skewed clock never pins a barcode)', async () => {
        const id = seed([CODE]);
        setAt(H + '/' + id + '/barcodes/0/trashClaim', 'tc_future_owner_0');
        setAt(H + '/' + id + '/barcodes/0/trashClaimAt', NOW + trashClaimPolicy().futureMs + 60000); sync();
        expect(await removeSingleBarcode(id, CODE)).toBe('done'); await settle(); sync();
        expect(money()).toEqual([[100, 20, 10], [100, 20, 10]]);
    });

    it('a barcode closed between the claim and the move is not moved, and the move releases its claim in the same write', async () => {
        const id = seed([CODE]);
        lab.before = (path, hit) => {
            if (path !== H + '/' + id || hit !== 2) return;
            setAt(H + '/' + id + '/barcodes/0/isClosed', true); setAt(H + '/' + id + '/barcodes/0/closedAt', NOW - 60000);
        };
        await claimAndCleanupItem(id, 'abandon'); await settle(); sync();
        expect(lab.hits[H + '/' + id], 'claim then move').toBe(2);
        expect({ money: money(), copies: trashCopiesOf(CODE).length, claims: claimsIn(id), pending: pendingTrashClaims(liveShopScope()) })
            .toEqual({ money: [[110, 22, 11], [110, 22, 11]], copies: 0, claims: [], pending: [] });
    });

    it('a claim left by this device when the App closed between claim and move is released on the next resume', async () => {
        const id = seed([CODE]);
        const token = newTrashClaimToken();
        noteTrashClaim(id, token);
        expect((await claimTrashBarcodes(id, token, () => [CODE])).state).toBe('claimed');
        expect(claimsIn(id)).toHaveLength(1);
        await resumeInterruptedCleanups(); await settle();
        expect({ claims: claimsIn(id), pending: pendingTrashClaims(liveShopScope()) }).toEqual({ claims: [], pending: [] });
    });

    it.each(['delete', 'remove', 'abandon'] as const)('this device\'s own dead claim (the App closed while it was on the wire) never blocks its next %s', async (op) => {
        const id = seed([CODE]);
        const dead = newTrashClaimToken();
        noteTrashClaim(id, dead);
        expect((await claimTrashBarcodes(id, dead, () => [CODE])).state).toBe('claimed');
        sync();
        if (op === 'delete') expect(await deleteSingleItem(id, { confirmed: true, quiet: true })).toBe('deleted');
        else if (op === 'remove') expect(await removeSingleBarcode(id, CODE)).toBe('done');
        else await claimAndCleanupItem(id, 'abandon');
        await settle(); sync();
        expect({ copies: trashCopiesOf(CODE).length, markers: markersInTrash(), history: getAt(H + '/' + id) })
            .toEqual({ copies: 1, markers: [], history: null });
        expect(money()).toEqual(op === 'delete' ? [[110, 22, 11], [110, 22, 11]] : [[100, 20, 10], [100, 20, 10]]);
    });

    it('a claim of this device that lands after its local view was read (App closed while it was on the wire) is released through the server, never forgotten from the stale view', async () => {
        const id = seed([CODE]);
        const dead = newTrashClaimToken();
        const stale = getAt(H + '/' + id);
        noteTrashClaim(id, dead);
        expect((await claimTrashBarcodes(id, dead, () => [CODE])).state).toBe('claimed');
        lab.localFirst = { path: H + '/' + id, on: (lab.hits[H + '/' + id] || 0) + 1, value: stale };
        await resumeInterruptedCleanups(); await settle();
        expect({ claims: claimsIn(id), pending: pendingTrashClaims(liveShopScope()) }).toEqual({ claims: [], pending: [] });
    });

    it('a live claim of this session is never released by the resume pass', async () => {
        const id = seed([CODE]);
        const token = newTrashClaimToken();
        noteTrashClaim(id, token); liveTrashClaims.add(token);
        await claimTrashBarcodes(id, token, () => [CODE]);
        await resumeInterruptedCleanups(); await settle();
        expect(claimsIn(id).map((b: any) => b.trashClaim)).toEqual([token]);
    });
});
