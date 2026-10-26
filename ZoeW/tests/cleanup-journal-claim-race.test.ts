import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dataState, firebaseState } from '../src/core/state';
import { getServerNow } from '../src/core/clock';
import { dbListenerFailedPaths, dbListenerPendingPaths } from '../src/core/text';
import { claimAndCleanupItem, cleanupInFlight, cleanupJournalLive, cleanupOperationOwners, clearCleanupJournalEntry, finishCleanupCollected, markCleanupJournalStage, noteCleanupJournalEntry, patchCleanupJournalEntry, readCleanupJournal, releaseCleanupJournalLive } from '../src/domain/cleanup';
import { LOCK_STALL_RELEASE_MS } from '../src/services/network';

const ID = 'id_journal_race';
const HISTORY = 'zoew_scan_history_cod_dod/' + ID;
const TRASH = 'zoew_recently_deleted_cod_dod/';
const clone = <T>(value: T): T => value === undefined ? value : JSON.parse(JSON.stringify(value));
const flush = async () => { for (let i = 0; i < 80; i++) await Promise.resolve(); };
const rows = new Map<string, any>();
const snapshot = (value: any) => ({ val: () => clone(value), exists: () => value !== null });
let hook: ((path: string, result: any) => Promise<any> | undefined) | null;

function seed(code: string) {
    const now = getServerNow();
    const barcode = { code, cod: 10, dod: 2, isClosed: true, isDeducted: false,
        createdAt: now - 4 * 3600000, closedAt: now - 3 * 3600000 };
    const item = { id: ID, phone: '012', scanDate: '2026-10-26', createdAt: barcode.createdAt,
        closedAt: barcode.closedAt, isClosed: true, count: 1, cod: 10, dod: 2, price: 12,
        barcode: code, barcodes: [barcode] };
    rows.set(HISTORY, clone(item));
    dataState.scanHistory = [clone(item)] as any;
}

beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    rows.clear(); hook = null;
    cleanupInFlight.clear(); cleanupOperationOwners.clear(); cleanupJournalLive.clear();
    dbListenerPendingPaths.clear(); dbListenerFailedPaths.clear();
    firebaseState.authGeneration++;
    firebaseState.db = { name: 'journal-race' } as any;
    firebaseState.firebaseConfig = { databaseURL: 'https://journal-race.firebaseio.com' } as any;
    firebaseState.auth = { currentUser: { uid: 'u1' } } as any;
    firebaseState.isDatabaseInitialized = true;
    firebaseState.isDatabaseConnected = true;
    firebaseState.serverClockTrusted = true;
    firebaseState.hasEverConnectedToDatabase = true;
    const ref = (_db: any, path: string) => ({ path, key: path.split('/').pop(), toString: () => 'https://journal-race.firebaseio.com/' + path });
    firebaseState.fb = {
        ref,
        get: async (r: any) => snapshot(rows.get(r.path) ?? null),
        runTransaction: async (r: any, update: any) => {
            const prior = clone(rows.get(r.path) ?? null);
            const next = update(prior);
            if (next === undefined) return { committed: false, snapshot: snapshot(prior) };
            rows.set(r.path, clone(next));
            const result = { committed: true, snapshot: snapshot(next) };
            return hook?.(r.path, result) ?? result;
        }
    } as any;
    dataState.deletedItems = [];
    dataState.dailyCollectedData = {};
    dataState.dailyPickupData = {};
    dataState.dailyRevenueData = { '2026-10-26': { codDollar: 20, dodDollar: 4, totalCount: 2 } } as any;
    dataState.monthlyRevenueData = { '2026-10': { codDollar: 20, dodDollar: 4, totalCount: 2 } } as any;
    (window as any).ZoeErrors = { capture: vi.fn() };
});

afterEach(async () => {
    firebaseState.authGeneration++;
    firebaseState.db = null;
    for (const id of cleanupJournalLive.keys()) releaseCleanupJournalLive(id);
    await flush();
    vi.useRealTimers();
    delete (window as any).ZoeErrors;
});

describe('a late cleanup may only clear its own durable claim', () => {
    it.each([false, true])('old trash ACK after the timeout cannot erase a newer claim for the same history id (same timestamp=%s)', async (sameTimestamp) => {
        seed('A');
        const initialClock = Date.now();
        let releaseOld!: () => void;
        let releaseNext!: () => void;
        let holdingOld = false;
        let holdingNext = false;
        hook = (path, result) => {
            if (path === TRASH + ID && !holdingOld) {
                holdingOld = true;
                return new Promise(resolve => { releaseOld = () => resolve(result); });
            }
        };
        const old = claimAndCleanupItem(ID, 'close');
        await flush();
        expect(holdingOld).toBe(true);
        expect(rows.get(HISTORY)).toBeNull();
        expect(rows.get(TRASH + ID).barcode).toBe('A');
        await vi.advanceTimersByTimeAsync(LOCK_STALL_RELEASE_MS + 1);
        await old;
        expect(cleanupInFlight.has(ID)).toBe(false);

        // A peer reuses the emptied parent for another barcode while the old ACK is delayed.
        // Both history transactions are sequential, so adapter path serialization permits this.
        if (sameTimestamp) vi.setSystemTime(initialClock);
        seed('B');
        hook = (path, result) => {
            if (path === HISTORY) {
                holdingNext = true;
                return new Promise(resolve => { releaseNext = () => resolve(result); });
            }
        };
        const next = claimAndCleanupItem(ID, 'close');
        await flush();
        expect(holdingNext).toBe(true);
        expect(rows.get(HISTORY)).toBeNull();
        expect(readCleanupJournal()[0].trashItem.barcode).toBe('B');
        const nextJournal = clone(readCleanupJournal());
        const money = clone([dataState.dailyRevenueData, dataState.monthlyRevenueData]);
        releaseOld();
        await flush();
        try {
            expect(readCleanupJournal()).toEqual(nextJournal);
            expect(rows.get(TRASH + ID).barcode).toBe('A');
            expect([dataState.dailyRevenueData, dataState.monthlyRevenueData]).toEqual(money);
            expect(cleanupInFlight.has(ID)).toBe(true);
        } finally {
            // Stop the pending new callback as a logout would; its journal must survive a restart.
            firebaseState.authGeneration++;
            releaseNext();
            await next;
        }
    });

    it.each(['deletedAt', 'code', 'closedAt', 'restoredAt'])('a stale %s witness cannot clear or advance its successor journal', (changed) => {
        seed('A');
        const original = { ...clone(rows.get(HISTORY)), deletedAt: getServerNow() };
        const successor = clone(original);
        if (changed === 'deletedAt') successor.deletedAt++;
        else if (changed === 'code') successor.barcodes[0].code = 'B';
        else successor.barcodes[0][changed] = (successor.barcodes[0][changed] || 0) + 1;
        noteCleanupJournalEntry({ id: ID, reason: 'close', stage: 'slot', trashItem: successor });
        const journal = clone(readCleanupJournal());
        expect(patchCleanupJournalEntry(ID, { switchReported: true }, original)).toBe(false);
        markCleanupJournalStage(ID, 'flip', original);
        clearCleanupJournalEntry(ID, original);
        expect(readCleanupJournal()).toEqual(journal);

        expect(patchCleanupJournalEntry(ID, { switchReported: true }, successor)).toBe(true);
        markCleanupJournalStage(ID, 'flip', successor);
        expect(readCleanupJournal()[0]).toMatchObject({ stage: 'flip', switchReported: true });
        clearCleanupJournalEntry(ID, successor);
        expect(readCleanupJournal()).toEqual([]);
    });

    it('an ordinary current cleanup still moves the barcode and clears its completed journal', async () => {
        seed('A');
        const money = clone([dataState.dailyRevenueData, dataState.monthlyRevenueData]);
        await claimAndCleanupItem(ID, 'close');
        expect(rows.get(HISTORY)).toBeNull();
        expect(rows.get(TRASH + ID).barcode).toBe('A');
        expect(readCleanupJournal()).toEqual([]);
        expect([dataState.dailyRevenueData, dataState.monthlyRevenueData]).toEqual(money);
    });

    it.each(['barcode', 'closedAt', 'restoredAt'])('a legacy item without a barcode array still distinguishes a new %s lifecycle', (changed) => {
        seed('A');
        const original = { ...clone(rows.get(HISTORY)), deletedAt: getServerNow() };
        delete original.barcodes;
        const successor = clone(original);
        successor[changed] = changed === 'barcode' ? 'B' : (successor[changed] || 0) + 1;
        noteCleanupJournalEntry({ id: ID, reason: 'close', stage: 'slot', trashItem: successor });
        const journal = clone(readCleanupJournal());
        expect(patchCleanupJournalEntry(ID, { switchReported: true }, original)).toBe(false);
        markCleanupJournalStage(ID, 'flip', original);
        clearCleanupJournalEntry(ID, original);
        expect(readCleanupJournal()).toEqual(journal);
        clearCleanupJournalEntry(ID, successor);
        expect(readCleanupJournal()).toEqual([]);
    });

    it.each([false, true])('an old-session history reply (committed=%s) cannot change an identical claim in a different shop', async (committed) => {
        localStorage.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: 'https://shop-a.firebaseio.com' }));
        seed('A');
        let abort!: () => void;
        firebaseState.fb.runTransaction = ((_ref: any, update: any) => {
            const prior = clone(rows.get(HISTORY));
            update(prior);
            return new Promise(resolve => { abort = () => resolve({ committed, snapshot: snapshot(prior) }); });
        }) as any;
        const old = claimAndCleanupItem(ID, 'close');
        const captured = readCleanupJournal()[0];
        expect(captured.scope).toBe('https://shop-a.firebaseio.com');
        firebaseState.authGeneration++;
        firebaseState.db = { name: 'shop-b' } as any;
        localStorage.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: 'https://shop-b.firebaseio.com' }));
        noteCleanupJournalEntry(captured);
        const successor = clone(readCleanupJournal());
        expect(successor[0].scope).toBe('https://shop-b.firebaseio.com');
        abort();
        await old;
        expect(readCleanupJournal()).toEqual(successor);
    });

    it('a collected recovery resumed after logout cannot clear or advance another shop journal', async () => {
        seed('A');
        const trashItem = { ...clone(rows.get(HISTORY)), deletedAt: getServerNow() };
        const captured = { id: ID, reason: 'close', stage: 'collected', scope: 'https://shop-a.firebaseio.com', trashItem };
        localStorage.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: 'https://shop-b.firebaseio.com' }));
        noteCleanupJournalEntry(captured);
        const successor = clone(readCleanupJournal());
        await finishCleanupCollected(captured, '', () => false);
        expect(readCleanupJournal()).toEqual(successor);
    });
});
