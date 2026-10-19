import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dataState, firebaseState, uiState, ztoState } from '../src/core/state';
import { getServerNow } from '../src/core/clock';
import { dbListenerFailedPaths, dbListenerPendingPaths } from '../src/core/text';
import { clearStaleRestoreMarkers } from '../src/domain/cleanup';
import { activeRestoreClaims, applyClaimedRestoreToHistory, cancelBlockedRestore, claimDeletedItemForRestore, executeRestoreItem, releaseStaleRestoreClaimForPurge, restoreCancellationInFlight, restoreInFlight, restoreRecoveryHolds, resumeBlockedRestoreCancellations, storedRestoreClaims } from '../src/features/restore';
import { resetZtoFinalMarks } from '../src/features/zto-final-marks';
import { ztoPickupStatus } from '../src/features/zto-status';

const H = 'zoew_scan_history_cod_dod', T = 'zoew_recently_deleted_cod_dod', F = 'zoew_restore_finalizations';
const D = 'zoew_daily_revenue_cod_dod', M = 'zoew_monthly_revenue_cod_dod', DAY = '2026-10-19';
const db = { name: 'terminal-cancel' };
let store: Record<string, any>, hook: ((path: string, after: any) => void) | null;
const clone = <T>(value: T): T => value === undefined ? value : JSON.parse(JSON.stringify(value));
function at(path: string) { return clone(path.split('/').filter(Boolean).reduce((v, k) => v?.[k], store) ?? null); }
function put(path: string, value: any) {
    const keys = path.split('/').filter(Boolean); let node = store;
    for (const key of keys.slice(0, -1)) node = node[key] ||= {};
    if (value == null) delete node[keys.at(-1)!]; else node[keys.at(-1)!] = clone(value);
}
const ref = (_db: any, path = '') => ({ db: _db, path, key: path.split('/').at(-1), toString: () => `https://cancel.firebaseio.com/${path}` });
const snap = (value: any) => ({ val: () => clone(value), exists: () => value != null });
function fb() {
    return {
        ref, increment: (n: number) => ({ inc: n }),
        get: async (r: any) => snap(at(r.path)),
        runTransaction: async (r: any, update: any) => {
            const next = update(at(r.path));
            if (next === undefined) return { committed: false, snapshot: snap(at(r.path)) };
            put(r.path, next); hook?.(r.path, clone(next));
            return { committed: true, snapshot: snap(at(r.path)) };
        },
        update: async (r: any, patch: any) => {
            for (const [key, value] of Object.entries(patch)) {
                const path = [r.path, key].filter(Boolean).join('/');
                put(path, value && typeof value === 'object' && 'inc' in value ? Number(at(path) || 0) + Number(value.inc) : value);
            }
        }, onValue: () => () => {}, off: () => {}
    };
}
function item(id: string, code: string, cod: number) {
    const createdAt = getServerNow() - 1000;
    return { id, phone: '012', scanDate: DAY, time: `08:00:00 (${DAY})`, createdAt, count: 1, cod, dod: 0, price: cod,
        isClosed: false, isCalled: false, barcode: code,
        barcodes: [{ code, cod, dod: 0, time: `08:00:00 (${DAY})`, locker: 'N/A', createdAt, isClosed: false, isFromDeletion: false, isDeducted: false }] };
}
function install() {
    const source = { ...item('source', 'C', 7), deletedAt: getServerNow() - 500, trashReason: 'remove', trashMode: 'local', isFromDeletion: false };
    source.barcodes[0].isDeducted = true;
    store = { [T]: { source }, [H]: { neighbor: item('neighbor', 'D', 3) }, [D]: { [DAY]: { codDollar: 93, dodDollar: 0, totalCount: 9 } }, [M]: { '2026-10': { codDollar: 93, dodDollar: 0, totalCount: 9 } } };
    firebaseState.db = db as any; firebaseState.fb = fb() as any;
    firebaseState.firebaseConfig = { databaseURL: 'https://cancel.firebaseio.com' } as any;
    firebaseState.auth = { currentUser: { uid: 'u1', getIdToken: async () => 'tok' } } as any;
    firebaseState.isDatabaseInitialized = true; firebaseState.isDatabaseConnected = true; firebaseState.serverClockTrusted = true;
    firebaseState.hasEverConnectedToDatabase = true;
    firebaseState.dbRefHistory = ref(db, H) as any; firebaseState.dbRefDeleted = ref(db, T) as any;
    firebaseState.dbRefDailyRevenue = ref(db, D) as any; firebaseState.dbRefMonthlyRevenue = ref(db, M) as any;
    firebaseState.dbRefDailyPickup = ref(db, 'zoew_daily_pickup_cod_dod') as any; firebaseState.dbRefDailyCollected = ref(db, 'zoew_daily_collected_cod_dod') as any;
    dataState.scanHistory = [clone(store[H].neighbor)]; dataState.deletedItems = [clone(source)];
    dataState.dailyRevenueData = clone(store[D]); dataState.monthlyRevenueData = clone(store[M]);
    dataState.dailyPickupData = {}; dataState.dailyCollectedData = {};
}
function signed() { ztoPickupStatus.set('C', { closed: true, signedAt: getServerNow(), signedAtExact: true, checkedAt: getServerNow() }); }
const money = () => ({ daily: at(D), monthly: at(M) });
async function restore() { uiState.pendingRestoreId = 'source'; await executeRestoreItem(); }
function prepared(provenance: string | undefined = '["C"]') {
    const token = 'old_token'; const claim = { token, targetId: 'neighbor', claimedAt: getServerNow() - 120001 };
    store[T].source.restoreBlocked = true; store[T].source.restoreClaim = claim;
    const target = store[H].neighbor;
    target.barcodes.push({ ...clone(store[T].source.barcodes[0]), isDeducted: false });
    target.count = 2; target.cod = 10; target.price = 10; target.restoreClaimId = 'source'; target.restoreClaimToken = token;
    if (provenance !== undefined) target.restoreAddedCodes = provenance;
    dataState.deletedItems = [clone(store[T].source)]; dataState.scanHistory = [clone(target)];
    return token;
}
beforeEach(() => {
    localStorage.clear(); hook = null; uiState.toasts = []; firebaseState.authGeneration++;
    activeRestoreClaims.clear(); restoreInFlight.clear(); restoreCancellationInFlight.clear(); restoreRecoveryHolds.clear();
    ztoPickupStatus.clear(); resetZtoFinalMarks(); ztoState.ztoStatusLoaded = true;
    dbListenerPendingPaths.clear(); dbListenerFailedPaths.clear();
    vi.stubGlobal('alert', vi.fn()); vi.stubGlobal('confirm', () => true);
    (window as any).ZoeErrors = { capture: vi.fn() }; install();
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('terminal ZTO proof during restore cancels without credit', () => {
    it.each(['claim', 'prepare'])('cancels after %s ACK and persists the block for another device', async stage => {
        const before = money(), neighbor = at(`${H}/neighbor`); let observed = false;
        hook = (path, value) => {
            if (observed) return;
            if (stage === 'claim' ? path === `${T}/source` && value?.restoreClaim : path === `${H}/neighbor` && value?.restoreClaimId) {
                if (stage === 'prepare') expect(value.restoreAddedCodes).toBe('["C"]');
                observed = true; signed();
            }
        };
        await restore(); expect(observed).toBe(true);
        expect(at(`${T}/source`).restoreBlocked).toBe(true);
        expect(at(`${T}/source`).restoreClaim).toBeUndefined();
        expect(at(`${T}/source`).barcodes[0].isDeducted).toBe(true);
        expect(at(`${H}/neighbor`)).toEqual(neighbor); expect(money()).toEqual(before); expect(at(F)).toBeNull();
        expect(storedRestoreClaims().source).toBeUndefined();
        ztoPickupStatus.clear(); activeRestoreClaims.clear(); await restore();
        expect(at(`${H}/neighbor`)).toEqual(neighbor); expect(money()).toEqual(before); expect(at(F)).toBeNull();
    });
    it('preserves an overlapping preexisting code rather than guessing it was inserted', async () => {
        const old = { ...store[H].neighbor.barcodes[0], code: 'C', cod: 23, restoredAt: 5 };
        store[H].neighbor.barcodes.push(old); store[H].neighbor.count = 2; store[H].neighbor.cod = 26; store[H].neighbor.price = 26;
        const neighbor = at(`${H}/neighbor`), before = money();
        hook = (path, value) => { if (path === `${H}/neighbor` && value?.restoreClaimId) { expect(value.restoreAddedCodes).toBe('[]'); signed(); } };
        await restore(); expect(at(`${H}/neighbor`)).toEqual(neighbor); expect(money()).toEqual(before);
        expect(at(`${T}/source`).restoreBlocked).toBe(true); expect(at(`${T}/source`).restoreClaim).toBeUndefined();
    });
    it('preserves the original call status when terminal proof cancels a prepared merge', async () => {
        Object.assign(store[T].source, { isCalled: true, callMark: 'called', callMarkTime: 200 });
        Object.assign(store[H].neighbor, { isCalled: false, callMark: 'retry', callMarkTime: 100 });
        const neighbor = at(`${H}/neighbor`), before = money();
        hook = (path, value) => { if (path === `${H}/neighbor` && value?.restoreClaimId) signed(); };
        await restore(); expect(at(`${H}/neighbor`)).toEqual(neighbor); expect(money()).toEqual(before);
    });
    it('commits the newer call status only with successful restore finalization', async () => {
        Object.assign(store[T].source, { isCalled: true, callMark: 'called', callMarkTime: 200 });
        Object.assign(store[H].neighbor, { isCalled: false, callMark: 'retry', callMarkTime: 100 });
        let observed = false;
        hook = (path, value) => {
            if (path === `${H}/neighbor` && value?.restoreClaimId) {
                observed = true; expect(value.callMark).toBe('retry'); expect(value.callMarkTime).toBe(100);
            }
        };
        await restore(); expect(observed).toBe(true);
        expect(at(`${T}/source`)).toBeNull();
        expect(at(`${H}/neighbor`).callMark).toBe('called'); expect(at(`${H}/neighbor`).callMarkTime).toBe(200);
        expect(at(`${H}/neighbor`).restoreAddedCodes).toBeUndefined();
        expect(at(`${D}/${DAY}/codDollar`)).toBe(100); expect(at(`${D}/${DAY}/totalCount`)).toBe(10);
    });
    it.each([undefined, 'different_row'])('uses the source path when optional row id is %s', async rowId => {
        if (rowId === undefined) delete store[T].source.id; else store[T].source.id = rowId;
        signed(); const before = money(); await restore();
        expect(at(`${T}/source`).restoreBlocked).toBe(true); expect(at(`${T}/source`).restoreClaim).toBeUndefined();
        expect(at(`${T}/different_row`)).toBeNull(); expect(money()).toEqual(before);
    });
    it.each([undefined, 'not json'])('holds legacy or malformed provenance (%s) even after lease expiry', async provenance => {
        const token = prepared(provenance); if (provenance === undefined) delete store[H].neighbor.restoreAddedCodes;
        const before = money(), target = at(`${H}/neighbor`);
        expect(await cancelBlockedRestore('source', token)).toBe('recovery-required');
        await releaseStaleRestoreClaimForPurge('source');
        await clearStaleRestoreMarkers(clone(target));
        expect(at(`${H}/neighbor`)).toEqual(target); expect(at(`${T}/source`).restoreClaim.token).toBe(token); expect(money()).toEqual(before);
    });
    it('holds an occupied source-ID target that cannot merge instead of altering its close metadata', async () => {
        const occupied = { ...item('source', 'D', 3), phone: 'different', isClosed: true, closedAt: 42 };
        occupied.barcodes[0].isClosed = true;
        store[H] = { source: occupied };
        const merge = vi.fn((target) => ({ ...target, isClosed: false }));
        const before = clone(store[H]);
        const result = await applyClaimedRestoreToHistory('source', 'source', 'token', clone(store[T].source), merge);
        expect(result.targetChanged).toBe(true); expect(merge).not.toHaveBeenCalled(); expect(store[H]).toEqual(before);
    });
    it('restores a removed barcode into a fresh target when its original sibling closed meanwhile', async () => {
        const sibling = { ...item('source', 'D', 3), isClosed: true, closedAt: 42 };
        sibling.barcodes[0].isClosed = true;
        store[H] = { source: sibling };
        await restore();
        expect(at(`${H}/source`)).toEqual(sibling); expect(at(`${T}/source`)).toBeNull();
        const restored = Object.values(store[H]).filter((row: any) => row.id !== 'source') as any[];
        expect(restored).toHaveLength(1); expect(restored[0].barcodes.map((b: any) => b.code)).toEqual(['C']);
        expect(restored[0].restoreClaimId).toBeUndefined(); expect(restored[0].restoreAddedCodes).toBeUndefined();
        expect(at(`${D}/${DAY}/codDollar`)).toBe(100); expect(at(`${D}/${DAY}/totalCount`)).toBe(10);
    });
    it('retains expired prepared markers until terminal proof can cancel their exact additions', async () => {
        const token = prepared(); delete store[T].source.restoreBlocked;
        dataState.deletedItems = [clone(store[T].source)];
        clearStaleRestoreMarkers(at(`${H}/neighbor`));
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(at(`${H}/neighbor`).restoreClaimId).toBe('source');
        signed(); expect(await cancelBlockedRestore('source', token)).toBe('cancelled');
        expect(at(`${H}/neighbor`).barcodes.map((b: any) => b.code)).toEqual(['D']);
        expect(at(`${D}/${DAY}/codDollar`)).toBe(93); expect(at(`${T}/source`).restoreClaim).toBeUndefined();
    });
    it('keeps the prepared target address atomically when reclaiming an expired restore token', async () => {
        prepared(); delete store[T].source.restoreBlocked;
        await claimDeletedItemForRestore('source', 'new_token', 'different_target');
        expect(at(`${T}/source`).restoreClaim).toMatchObject({ token: 'new_token', targetId: 'neighbor' });
        expect(at(`${H}/neighbor`).restoreClaimId).toBe('source');
    });
    it('stops the recovery pass when the account changes during the first cancellation', async () => {
        prepared();
        const other = { ...clone(store[T].source), id: 'other', restoreClaim: { token: 'other_token', targetId: 'other_target', claimedAt: getServerNow() } };
        store[T].other = other; dataState.deletedItems.push(clone(other));
        const writes: string[] = [];
        hook = (path) => {
            writes.push(path);
            if (path === `${T}/source`) {
                firebaseState.authGeneration++;
                firebaseState.db = { name: 'another-shop' } as any;
            }
        };
        await resumeBlockedRestoreCancellations();
        expect(writes).toEqual([`${T}/source`]);
        expect(at(`${T}/other`).restoreClaim.token).toBe('other_token');
    });
    it('recovers a lost history cancellation ACK after restart without crediting', async () => {
        const token = prepared(), before = money(); let lost = false;
        hook = (path, value) => { if (!lost && path === `${H}/neighbor` && !value?.restoreClaimId) { lost = true; throw new Error('lost cancellation ACK'); } };
        expect(await cancelBlockedRestore('source', token)).toBe('pending'); expect(lost).toBe(true);
        expect(at(`${T}/source`).restoreClaim.token).toBe(token); expect(at(`${H}/neighbor`).barcodes.map((b: any) => b.code)).toEqual(['D']);
        dataState.deletedItems = [at(`${T}/source`)]; await resumeBlockedRestoreCancellations(); await resumeBlockedRestoreCancellations();
        expect(at(`${T}/source`).restoreClaim).toBeUndefined(); expect(at(`${H}/neighbor`).restoreAddedCodes).toBeUndefined(); expect(money()).toEqual(before); expect(at(F)).toBeNull();
    });
});
