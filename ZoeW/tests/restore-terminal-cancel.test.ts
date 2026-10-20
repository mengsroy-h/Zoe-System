import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dataState, firebaseState, securityState, uiState, ztoState } from '../src/core/state';
import { getServerNow } from '../src/core/clock';
import { dbListenerFailedPaths, dbListenerPendingPaths } from '../src/core/text';
import { clearStaleRestoreMarkers, runAutomaticDeletedCleanup } from '../src/domain/cleanup';
import { activeRestoreClaims, applyClaimedRestoreToHistory, cancelBlockedRestore, claimDeletedItemForRestore, executeRestoreItem, promptHeldRestoreRecovery, recoverHeldRestore, releaseStaleRestoreClaimForPurge, restoreCancellationInFlight, restoreInFlight, restoreRecoveryHolds, resumeBlockedRestoreCancellations, storedRestoreClaims, RESTORE_HELD_MANUAL_TEXT, RESTORE_HELD_NONE_TEXT, RESTORE_HELD_PENDING_TEXT, RESTORE_HELD_RELEASED_TEXT } from '../src/features/restore';
import { buildTrashRowModel, trashRestoreHalf, trashRestoreHeld } from '../src/app/components/trash/model';
import { resetZtoFinalMarks } from '../src/features/zto-final-marks';
import { applyBarcodeCloseChange } from '../src/features/barcode-ops';
import { toggleCloseStatus } from '../src/features/entry-ops';
import { RESTORE_IN_PROGRESS_CLOSE_TEXT } from '../src/core/text';
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
const toasts = () => (uiState.toasts || []).map((t: any) => String(t.msg || ''));
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
    it('skips the retention purge of a source whose expired restore is still prepared (no error toast, nothing deleted)', async () => {
        prepared(); delete store[T].source.restoreBlocked;
        store[T].source.deletedAt = getServerNow() - 31 * 24 * 60 * 60 * 1000;
        dataState.deletedItems = [clone(store[T].source)];
        const before = money(), target = at(`${H}/neighbor`), source = at(`${T}/source`);
        expect(await releaseStaleRestoreClaimForPurge('source')).toBe(false);
        await runAutomaticDeletedCleanup();
        expect(at(`${T}/source`)).toEqual(source); expect(at(`${H}/neighbor`)).toEqual(target); expect(money()).toEqual(before);
        expect((uiState.toasts || []).map((t: any) => String(t.msg || '')).join(' ')).not.toContain('បរាជ័យ');
        store[H].neighbor = item('neighbor', 'D', 3); delete store[T].source.restoreAddedCodes;
        expect(await releaseStaleRestoreClaimForPurge('source'), 'target no longer prepared ➜ the stale claim is released').toBe(true);
        expect(at(`${T}/source`).restoreClaim).toBeUndefined();
    });
    it('releases the stale claim of legacy signed trash by stamping the permanent block the rules require', async () => {
        const claim = { token: 'old_token', targetId: 'neighbor', claimedAt: getServerNow() - 120001 };
        store[T].source.restoreClaim = claim; store[T].source.barcodes[0].ztoSignedAt = getServerNow() - 5000;
        delete store[T].source.trashMode;
        dataState.deletedItems = [clone(store[T].source)];
        const api: any = firebaseState.fb, plain = api.runTransaction;
        api.runTransaction = async (r: any, update: any) => plain(r, (value: any) => {
            const next = update(value);
            if (r.path.startsWith(T + '/') && next && (next.barcodes || []).some((b: any) => b && b.ztoSignedAt > 0) && next.restoreBlocked !== true) throw Object.assign(new Error('PERMISSION_DENIED'), { code: 'PERMISSION_DENIED' });
            return next;
        });
        const before = money();
        expect(await releaseStaleRestoreClaimForPurge('source')).toBe(true);
        const after = at(`${T}/source`);
        expect(after.restoreClaim).toBeUndefined(); expect(after.restoreBlocked).toBe(true); expect(after.trashMode).toBeUndefined();
        expect(at(`${H}/neighbor`)).toEqual(store[H].neighbor); expect(money()).toEqual(before);
    });
    it.each([undefined, 'not json'])('holds legacy or malformed provenance (%s) even after lease expiry', async provenance => {
        const token = prepared(provenance); if (provenance === undefined) delete store[H].neighbor.restoreAddedCodes;
        const before = money(), target = at(`${H}/neighbor`);
        expect(await cancelBlockedRestore('source', token)).toBe('recovery-required');
        await releaseStaleRestoreClaimForPurge('source');
        await clearStaleRestoreMarkers(clone(target));
        expect(at(`${H}/neighbor`)).toEqual(target); expect(at(`${T}/source`).restoreClaim.token).toBe(token); expect(money()).toEqual(before);
    });
    it('a source already frozen for recovery is not rewritten on every recovery pass', async () => {
        const token = prepared(undefined); delete store[H].neighbor.restoreAddedCodes;
        const writes: string[] = []; hook = (path) => writes.push(path);
        expect(await cancelBlockedRestore('source', token)).toBe('recovery-required');
        expect(await cancelBlockedRestore('source', token)).toBe('recovery-required');
        expect(writes, 'ការ freeze ដែលមិនប្តូរអ្វី ➜ គ្មានការសរសេរ').toEqual([]);
        expect(at(`${T}/source`).restoreClaim.token).toBe(token); expect(at(`${T}/source`).restoreBlocked).toBe(true);
        delete store[T].source.restoreBlocked; signed();
        expect(await cancelBlockedRestore('source', token)).toBe('recovery-required');
        expect(writes, 'ប្រភពមិនទាន់ freeze ➜ សរសេរ restoreBlocked ១ ដង').toEqual([`${T}/source`]);
        expect(at(`${T}/source`).restoreBlocked).toBe(true);
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
    it.each(['same token', 'takeover'])('finishes a legacy prepared restore (%s) with a fresh age clock on the restored barcode', async mode => {
        const token = prepared(); delete store[T].source.restoreBlocked; delete store[H].neighbor.restoreAddedCodes;
        const parentAge = getServerNow() - 9 * 24 * 60 * 60 * 1000;
        store[H].neighbor.createdAt = parentAge;
        store[H].neighbor.barcodes.forEach((b: any) => { b.createdAt = parentAge; delete b.restoredAt; });
        dataState.deletedItems = [clone(store[T].source)]; dataState.scanHistory = [at(`${H}/neighbor`)];
        if (mode === 'same token') activeRestoreClaims.set('source', { token, targetId: 'neighbor' });
        const startedAt = getServerNow();
        await restore();
        expect(at(`${T}/source`)).toBeNull();
        const row = at(`${H}/neighbor`);
        expect(row.barcodes.map((b: any) => b.code)).toEqual(['D', 'C']);
        expect(row.restoreClaimId).toBeUndefined(); expect(row.restoreAddedCodes).toBeUndefined();
        expect(row.barcodes.find((b: any) => b.code === 'C').restoredAt).toBeGreaterThanOrEqual(startedAt);
        expect(row.barcodes.find((b: any) => b.code === 'D').restoredAt).toBeUndefined();
        expect(at(`${D}/${DAY}/codDollar`)).toBe(100); expect(at(`${D}/${DAY}/totalCount`)).toBe(10);
    });
    it('keeps the prepared target address atomically when reclaiming an expired restore token', async () => {
        prepared(); delete store[T].source.restoreBlocked;
        await claimDeletedItemForRestore('source', 'new_token', 'different_target');
        expect(at(`${T}/source`).restoreClaim).toMatchObject({ token: 'new_token', targetId: 'neighbor' });
        expect(at(`${H}/neighbor`).restoreClaimId).toBe('source');
    });
    it('cancels a prepare whose takeover re-token never landed once Sign arrives (no permanent hold)', async () => {
        prepared(); delete store[T].source.restoreBlocked;
        const before = money();
        await claimDeletedItemForRestore('source', 'takeover_token', 'neighbor');
        expect(at(`${T}/source`).restoreClaim.token).toBe('takeover_token');
        expect(at(`${H}/neighbor`).restoreClaimToken).toBe('old_token');
        dataState.deletedItems = [at(`${T}/source`)]; dataState.scanHistory = [at(`${H}/neighbor`)];
        signed();
        await restore();
        expect(toasts().join(' ')).not.toContain('Admin');
        expect(at(`${H}/neighbor`).barcodes.map((b: any) => b.code)).toEqual(['D']);
        expect(at(`${H}/neighbor`).restoreClaimId).toBeUndefined();
        expect(at(`${T}/source`)).toMatchObject({ restoreBlocked: true }); expect(at(`${T}/source`).restoreClaim).toBeUndefined();
        expect(money()).toEqual(before); expect(at(F)).toBeNull();
    });
    it('refuses to close or reopen a barcode of a row that is mid-restore, so a later cancellation never strips a closed barcode', async () => {
        const token = prepared(); delete store[T].source.restoreBlocked;
        dataState.scanHistory = [at(`${H}/neighbor`)];
        const before = clone(store);
        expect(await applyBarcodeCloseChange('neighbor', 'C', true, { silent: true, showModal: false })).toBe(false);
        await toggleCloseStatus('neighbor');
        for (let i = 0; i < 10; i++) await new Promise(resolve => setTimeout(resolve, 0));
        expect(toasts()).toContain(RESTORE_IN_PROGRESS_CLOSE_TEXT);
        expect(at(H)).toEqual(before[H]); expect(at(T)).toEqual(before[T]); expect(money()).toEqual({ daily: before[D], monthly: before[M] });
        expect(at('zoew_daily_collected_cod_dod')).toBeNull();
        signed(); expect(await cancelBlockedRestore('source', token)).toBe('cancelled');
        expect(at(`${H}/neighbor`).barcodes.map((b: any) => b.code)).toEqual(['D']);
        expect(at(`${H}/neighbor`).barcodes.every((b: any) => b.isClosed === false)).toBe(true);
    });
    it('stops the recovery pass when the account changes during the first cancellation', async () => {
        prepared();
        const other = { ...clone(store[T].source), id: 'other', restoreClaim: { token: 'other_token', targetId: 'other_target', claimedAt: getServerNow() } };
        store[T].other = other; dataState.deletedItems.push(clone(other));
        const writes: string[] = [];
        hook = (path) => {
            writes.push(path);
            if (writes.length === 1) {
                firebaseState.authGeneration++;
                firebaseState.db = { name: 'another-shop' } as any;
            }
        };
        await resumeBlockedRestoreCancellations();
        expect(writes, "ការសរសេរដំបូងប្តូរគណនី ➜ គ្មានការសរសេរបន្ទាប់").toHaveLength(1);
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

describe('RST-2 · a merge row prepared by another source is never taken over', () => {
    it('restoring X while the same customer row holds Y\'s prepared restore binds a fresh row and leaves Y\'s markers intact', async () => {
        const other = { ...item('other', 'E', 4), deletedAt: getServerNow() - 400, trashReason: 'remove', trashMode: 'local', isFromDeletion: false,
            restoreClaim: { token: 'tokY', targetId: 'neighbor', claimedAt: getServerNow() - 1000 } };
        other.barcodes[0].isDeducted = true;
        store[T].other = clone(other);
        const neighbor = store[H].neighbor;
        neighbor.barcodes.push({ ...clone(other.barcodes[0]), isDeducted: false });
        neighbor.count = 2; neighbor.cod = 7; neighbor.price = 7;
        neighbor.restoreClaimId = 'other'; neighbor.restoreClaimToken = 'tokY'; neighbor.restoreAddedCodes = '["E"]';
        dataState.deletedItems = [clone(store[T].source), clone(store[T].other)]; dataState.scanHistory = [clone(neighbor)];
        const before = clone(neighbor);
        await restore();
        expect(at(`${H}/neighbor`), 'Y\'s prepared row untouched').toEqual(before);
        expect(at(`${T}/source`), 'X left the trash').toBeNull();
        const rows = Object.values(at(H) as Record<string, any>);
        const xRow = rows.find((r: any) => r.id !== 'neighbor');
        expect(xRow?.barcodes.map((b: any) => b.code)).toEqual(['C']);
        expect(xRow?.restoreClaimId).toBeUndefined();
        expect(at(`${D}/${DAY}`)).toMatchObject({ codDollar: 100, totalCount: 10 });
        expect(at(`${T}/other`).restoreClaim.token).toBe('tokY');
    });
});

describe('owner releases a held restore from 🗑️ (🛠️ · PIN)', () => {
    let updates: any[] = [], restReads: string[] = [], beforeUpdate: (() => void) | null = null, afterUpdate: (() => void) | null = null;
    beforeEach(() => {
        updates = []; restReads = []; beforeUpdate = null; afterUpdate = null;
        const sdk: any = firebaseState.fb, plainUpdate = sdk.update;
        sdk.update = async (r: any, patch: any) => {
            beforeUpdate?.(); updates.push({ path: r.path, patch: clone(patch) });
            await plainUpdate(r, patch); afterUpdate?.();
        };
        vi.stubGlobal('fetch', async (url: string) => {
            const path = decodeURIComponent(new URL(url).pathname.replace(/^\/+/, '').replace(/\.json$/, ''));
            restReads.push(path);
            return { ok: true, status: 200, json: async () => at(path) } as any;
        });
    });
    async function release() { uiState.pendingHeldRestoreId = 'source'; await recoverHeldRestore(); }
    const neighborCodes = () => (at(`${H}/neighbor`)?.barcodes || []).map((b: any) => b.code);
    const legacy = (provenance: string | undefined = undefined) => {
        const token = prepared(provenance); if (provenance === undefined) delete store[H].neighbor.restoreAddedCodes;
        store[H].neighbor.barcodes[1].restoredAt = getServerNow();
        return token;
    };
    const captured = (context: string) => vi.mocked((window as any).ZoeErrors.capture).mock.calls.find((c: any[]) => c[1]?.context === context);
    it.each([undefined, 'not json'])('legacy provenance (%s) ➜ only the copy stamped by the prepare leaves, markers and claim go in ONE write, money and trash stay', async (provenance) => {
        legacy(provenance);
        store[H].neighbor.restoreClaimToken = 'legacy_other_token';
        const before = money();
        await release();
        const row = at(`${H}/neighbor`);
        expect(neighborCodes()).toEqual(['D']);
        expect(row).toMatchObject({ count: 1, cod: 3, price: 3, barcode: 'D', isClosed: false });
        expect(row.restoreClaimId).toBeUndefined(); expect(row.restoreClaimToken).toBeUndefined(); expect(row.restoreAddedCodes).toBeUndefined();
        expect(at(`${T}/source`).restoreClaim).toBeUndefined(); expect(at(`${T}/source`).restoreBlocked).toBe(true);
        expect(at(`${T}/source`).barcodes.map((b: any) => b.code)).toEqual(['C']); expect(at(`${T}/source`).barcodes[0].isDeducted).toBe(true);
        expect(money()).toEqual(before); expect(at(F)).toBeNull();
        expect(updates, 'the row rewrite and the claim release land together').toHaveLength(1);
        expect(Object.keys(updates[0].patch).sort()).toEqual([`${T}/source/restoreClaim`, `${H}/neighbor`]);
        expect(restReads, 'the row is read fresh from the server').toContain(`${H}/neighbor`);
        expect(toasts()).toContain(RESTORE_HELD_RELEASED_TEXT);
        expect(captured('recoverHeldRestore')?.[1]).toMatchObject({ zone: 'money', itemId: 'source', targetId: 'neighbor', removedCount: 1, removedBarcodes: 'C',
            removedCod: '7.00', keptCount: 1, keptClosedCount: 0, keptUncertainCount: 0, rowDeleted: false, legacy: true, untouched: false });
        expect(restoreRecoveryHolds.has('source')).toBe(false); expect(storedRestoreClaims().source).toBeUndefined(); expect(activeRestoreClaims.has('source')).toBe(false);
    });
    it('the background pass alone never removes legacy codes (only the owner decides)', async () => {
        legacy();
        const target = at(`${H}/neighbor`);
        await resumeBlockedRestoreCancellations();
        expect(at(`${H}/neighbor`)).toEqual(target);
    });
    it('declining the confirmation writes nothing', async () => {
        legacy();
        vi.stubGlobal('confirm', () => false);
        const before = clone(store);
        await release();
        expect(store).toEqual(before); expect(updates).toHaveLength(0);
    });
    it('a barcode scanned into the row after the prepare stays · a row whose rest is closed closes at its latest stamp', async () => {
        legacy();
        const stampD = getServerNow() - 9000, stampE = getServerNow() - 4000;
        const row = store[H].neighbor;
        row.barcodes[0] = { ...row.barcodes[0], isClosed: true, closedAt: stampD };
        row.barcodes.push({ code: 'E', cod: 2, dod: 0, isClosed: true, closedAt: stampE, isDeducted: false, isFromDeletion: false });
        await release();
        expect(neighborCodes()).toEqual(['D', 'E']);
        expect(at(`${H}/neighbor`)).toMatchObject({ isClosed: true, closedAt: stampE, count: 2, cod: 5 });
    });
    it('a row holding only the restored copy is deleted in the same write as the release', async () => {
        legacy();
        store[H].neighbor.barcodes = store[H].neighbor.barcodes.filter((b: any) => b.code === 'C');
        await release();
        expect(at(`${H}/neighbor`)).toBeNull();
        expect(at(`${T}/source`).restoreClaim).toBeUndefined();
        expect(updates[0].patch[`${H}/neighbor`]).toBeNull();
    });
    it('a closed copy of the source code stays in the row (its pickup and collected marks stay true) and is reported', async () => {
        legacy();
        const copy = store[H].neighbor.barcodes[1];
        Object.assign(copy, { isClosed: true, closedAt: getServerNow() }); delete copy.restoredAt;
        const before = money();
        await release();
        expect(neighborCodes()).toEqual(['D', 'C']);
        expect(at(`${H}/neighbor`).restoreClaimId).toBeUndefined();
        expect(at(`${T}/source`).restoreClaim).toBeUndefined();
        expect(money()).toEqual(before);
        expect(captured('recoverHeldRestore')?.[1]).toMatchObject({ removedCount: 0, keptClosedCount: 1, keptUncertainCount: 0, rowDeleted: false });
    });
    it('an open copy without the prepare stamp (a live copy, e.g. a stale trash slot) is kept for manual review', async () => {
        legacy();
        delete store[H].neighbor.barcodes[1].restoredAt;
        const stale = { ...clone(store[H].neighbor.barcodes[1]), restoredAt: getServerNow() - 60000 };
        await release();
        expect(neighborCodes()).toEqual(['D', 'C']);
        expect(captured('recoverHeldRestore')?.[1]).toMatchObject({ removedCount: 0, keptUncertainCount: 1, keptUncertainBarcodes: 'C' });
        install(); legacy(); store[H].neighbor.barcodes[1] = { ...stale, restoredAt: store[T].source.deletedAt - 1 };
        await release();
        expect(neighborCodes(), 'stamped before the trash entry existed ➜ not this prepare').toEqual(['D', 'C']);
    });
    it('reverse ៖ a modern prepare is cancelled from its provenance · a source with no hold is left alone', async () => {
        prepared('["C"]');
        await release();
        expect(neighborCodes()).toEqual(['D']); expect(at(`${T}/source`).restoreClaim).toBeUndefined();
        install(); uiState.toasts = []; updates = [];
        const plain = clone(store);
        await release();
        expect(store).toEqual(plain); expect(toasts()).toContain(RESTORE_HELD_NONE_TEXT); expect(updates).toHaveLength(0);
    });
    it('a target that no longer points at the source is left untouched and only the claim is released', async () => {
        legacy();
        store[H].neighbor.restoreClaimId = 'other_source';
        const target = at(`${H}/neighbor`);
        await release();
        expect(at(`${H}/neighbor`)).toEqual(target);
        expect(at(`${T}/source`).restoreClaim).toBeUndefined();
        expect(Object.keys(updates[0].patch)).toEqual([`${T}/source/restoreClaim`]);
        expect(captured('recoverHeldRestore')?.[1]).toMatchObject({ targetId: 'neighbor', untouched: true, removedCount: 0 });
    });
    it('an item-level legacy row cannot be rebuilt ➜ nothing written, manual text and a money event', async () => {
        legacy();
        const row = store[H].neighbor; delete row.barcodes; row.barcode = 'C';
        const before = clone(store[H]);
        await release();
        expect(at(H)).toEqual(before); expect(updates).toHaveLength(0);
        expect(toasts()).toContain(RESTORE_HELD_MANUAL_TEXT);
        expect(captured('recoverHeldRestore manual')?.[1]).toMatchObject({ zone: 'money', itemId: 'source' });
    });
    it('🛠️ goes through the PIN gate ➜ nothing is written until the PIN target runs · a hostile id is refused', async () => {
        legacy();
        localStorage.setItem('zoew_security_pin_hash', 'hash');
        const before = clone(store);
        promptHeldRestoreRecovery('source');
        expect(uiState.pendingHeldRestoreId).toBe('source');
        expect(securityState.pinTargetAction).toBe(recoverHeldRestore);
        expect(store).toEqual(before);
        await (securityState.pinTargetAction as any)();
        expect(neighborCodes()).toEqual(['D']); expect(uiState.pendingHeldRestoreId).toBeNull();
        uiState.pendingHeldRestoreId = null;
        promptHeldRestoreRecovery('../x');
        expect(uiState.pendingHeldRestoreId).toBeNull();
        uiState.pendingHeldRestoreId = '../x'; await recoverHeldRestore();
        expect(uiState.pendingHeldRestoreId).toBeNull();
    });
    it.each([
        ['offline', () => { firebaseState.isDatabaseConnected = false; }],
        ['already running', () => { restoreCancellationInFlight.add('source'); }],
        ['server read fails', () => { vi.stubGlobal('fetch', async () => ({ ok: false, status: 503, json: async () => null })); }]
    ])('%s ➜ ⏳ and nothing written', async (_label, arrange) => {
        legacy(); arrange();
        const before = clone(store);
        await release();
        expect(store).toEqual(before); expect(updates).toHaveLength(0);
        expect(toasts()).toContain(RESTORE_HELD_PENDING_TEXT);
    });
    it('an account switch during the fresh reads writes nothing', async () => {
        legacy();
        const before = clone(store);
        vi.stubGlobal('fetch', async (url: string) => {
            firebaseState.authGeneration++; firebaseState.db = { name: 'another-shop' } as any;
            const path = decodeURIComponent(new URL(url).pathname.replace(/^\/+/, '').replace(/\.json$/, ''));
            return { ok: true, status: 200, json: async () => at(path) } as any;
        });
        await release();
        expect(store).toEqual(before); expect(updates).toHaveLength(0);
        expect(toasts()).not.toContain(RESTORE_HELD_RELEASED_TEXT);
    });
    it('a switch right after the atomic write ➜ no ✅ in the new session and a money event for the late write', async () => {
        legacy();
        afterUpdate = () => { firebaseState.authGeneration++; firebaseState.db = { name: 'another-shop' } as any; };
        await release();
        expect(neighborCodes(), 'the write itself landed in the shop that started it').toEqual(['D']);
        expect(toasts()).not.toContain(RESTORE_HELD_RELEASED_TEXT);
        expect(captured('cancelBlockedRestore session switch')?.[1]).toMatchObject({ zone: 'money', itemId: 'source' });
    });
    it('a lost acknowledgement ➜ ⏳ · the write is whole (both halves landed) · a retry finds nothing held', async () => {
        legacy();
        const before = money();
        afterUpdate = () => { afterUpdate = null; throw Object.assign(new Error('disconnect'), { code: 'disconnect' }); };
        await release();
        expect(toasts()).toContain(RESTORE_HELD_PENDING_TEXT);
        expect(neighborCodes()).toEqual(['D']); expect(at(`${T}/source`).restoreClaim).toBeUndefined();
        uiState.toasts = [];
        await release();
        expect(toasts()).toContain(RESTORE_HELD_NONE_TEXT); expect(money()).toEqual(before);
    });
    it('🗑️ shows 🛠️ on a held row and keeps 🔒 for a blocked row with no claim', () => {
        prepared(undefined);
        const held = at(`${T}/source`); held.id = 'source';
        expect(trashRestoreHeld(held)).toBe(true);
        const model = buildTrashRowModel({ key: 'k', reason: 'remove', phone: '012', items: [held], codes: ['C'], count: 1, total: 7, deletedAt: held.deletedAt }, new Set());
        expect(model.singleHeld).toBe(true);
        const { restoreClaim: _claim, ...settled } = held;
        expect(trashRestoreHeld(settled)).toBe(false);
        expect(trashRestoreHalf(held), 'a frozen claim is held, not half-restored').toBe(false);
        const half = { ...held, restoreBlocked: undefined };
        expect(trashRestoreHalf(half), 'MX-2 ៖ a claim on a restorable item marks the row ⏳🔄').toBe(true);
        expect(buildTrashRowModel({ key: 'k', reason: 'remove', phone: '012', items: [half], codes: ['C'], count: 1, total: 7, deletedAt: held.deletedAt }, new Set()).singleHalf).toBe(true);
    });
});
