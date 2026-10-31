import { DB_OP_TIMEOUT_MS } from '../src/services/network';
import { pendingHistoryPatches } from '../src/core/clock';
import { flushPendingHistoryPatches, queueHistoryPatchRetry } from '../src/services/history-write';
import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { refTo } from '../src/app/refs';
import { dataState, firebaseState, uiState } from '../src/core/state';
import { getFormattedDate } from '../src/core/timezone';
import { applyBarcodeCloseChange, removeSingleBarcode } from '../src/features/barcode-ops';
import { deleteSingleItem, saveEditedPhone, setCallMark, toggleCloseStatus } from '../src/features/entry-ops';
import { assignLockerToEntry } from '../src/features/locker-assign';
import { buildLockerBarcodeIndex } from '../src/features/locker';
import { saveBarcodeOrigins } from '../src/features/barcode-origin';
import { clearHistory, claimHistoryItemForClear, resetClearHistoryOperationState } from '../src/features/clear-history';
import { applyClaimedRestoreToHistory, findRestoreTargetId } from '../src/features/restore';
import { claimTrashBarcodes, releaseTrashClaims, trashClaimOwner } from '../src/domain/trash-claim';
import { cleanupInFlight, cleanupJournalLive, claimAndCleanupItem } from '../src/domain/cleanup';
import { dbListenerFailedPaths, dbListenerPendingPaths } from '../src/core/text';
import { buildHistoryRowModel } from '../src/app/components/history/rowModel';

const H = 'zoew_scan_history_cod_dod', D = 'zoew_daily_revenue_cod_dod', M = 'zoew_monthly_revenue_cod_dod';
const HOST = 'https://m3-unknown.firebaseio.com';
const NOW = Date.UTC(2026, 9, 24, 2);
const lab = { writes: [] as string[], store: {} as any, fault: '' as '' | 'landed' | 'lost' | 'gone', readFails: false, intents: [] as any[] };
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
const unknown = () => Object.assign(new Error('disconnect'), { txOutcome: 'unknown' });
const DAY = () => getFormattedDate(new Date(NOW));
const settle = async () => { for (let i = 0; i < 30; i++) await new Promise((r) => setTimeout(r, 0)); };

function input(id: 'editBcCodInput' | 'editBcDodInput' | 'editPhoneInput', value: string) {
    const el = document.createElement('input');
    el.value = value;
    refTo(id)(el);
}

beforeEach(() => {
    localStorage.clear(); localStorage.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: HOST }));
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(NOW);
    vi.stubGlobal('crypto', webcrypto);
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    pendingHistoryPatches.clear(); dataState.historyPatchFlushInFlight = false;
    lab.fault = ''; lab.readFails = false; lab.intents = []; lab.writes = [];
    dbListenerFailedPaths.clear(); dbListenerPendingPaths.clear(); cleanupInFlight.clear(); cleanupJournalLive.clear(); resetClearHistoryOperationState();
    vi.stubGlobal('confirm', () => true);
    uiState.toasts = []; uiState.currentFilterMode = 'all'; uiState.activeLocker = 'L-02';
    firebaseState.isInitializingFirebase = false; dataState.clearHistoryInFlight = false;
    lab.store = {
        [H]: { itemI: { id: 'itemI', phone: '012000111', scanDate: DAY(), time: '08:00:00 (' + DAY() + ')', createdAt: NOW - 3600000, count: 1, cod: 10, dod: 0, price: 10,
            isClosed: false, isCalled: false, barcode: 'A100000001', barcodes: [{ code: 'A100000001', cod: 10, dod: 0, createdAt: NOW - 60000, isClosed: false, isDeducted: false, isFromDeletion: false }] } },
        [D]: { [DAY()]: { codDollar: 10, dodDollar: 0, totalCount: 1 } },
        [M]: { [DAY().slice(0, 7)]: { codDollar: 10, dodDollar: 0, totalCount: 1 } }
    };
    dataState.scanHistory = Object.values(clone(lab.store[H])); dataState.deletedItems = []; dataState.dailyPickupData = {};
    lab.store.zoew_daily_pickup_cod_dod = { [DAY()]: { pickupRevision: 1, pickupResetEpoch: 0, packagesPickedUp: 0 } };
    firebaseState.dbRefDailyPickup = ref('zoew_daily_pickup_cod_dod') as any;
    firebaseState.dbRefDeleted = ref('zoew_recently_deleted_cod_dod') as any;
    dataState.dailyRevenueData = clone(lab.store[D]); dataState.monthlyRevenueData = clone(lab.store[M]);
    firebaseState.authGeneration++; firebaseState.db = { name: 'm3' } as any;
    firebaseState.auth = { currentUser: { uid: 'u', getIdToken: async () => 'tok' } } as any;
    firebaseState.firebaseConfig = { databaseURL: HOST } as any;
    firebaseState.dbRefDailyCollected = ref('zoew_daily_collected_cod_dod') as any;
    dataState.dailyCollectedData = {};
    firebaseState.dbRefHistory = ref(H) as any; firebaseState.dbRefDailyRevenue = ref(D) as any; firebaseState.dbRefMonthlyRevenue = ref(M) as any;
    firebaseState.fb = {
        ref: (_db: any, p = '') => ref(p),
        increment: (n: number) => ({ __inc: n }),
        get: async (r: any) => snap(r, getAt(r.path)),
        update: async (r: any, ups: any) => { lab.writes.push(r.path); for (const [k, v] of Object.entries(ups)) setAt([r.path, k].filter(Boolean).join('/'), v); },
        set: async (r: any, v: any) => { lab.writes.push(r.path); setAt(r.path, v); },
        runTransaction: async (r: any, fn: any) => {
            if (fn && fn.connectionIntent) lab.intents.push(clone(fn.connectionIntent));
            const prior = getAt(r.path); const next = fn(clone(prior));
            if (next === undefined) return { committed: false, snapshot: snap(r, prior) };
            if (r.path === H + '/itemI' && lab.fault === 'lost') throw unknown();
            lab.writes.push(r.path); setAt(r.path, next);
            if (r.path === H + '/itemI' && lab.fault) {
                if (lab.fault === 'gone') setAt(r.path, null);
                else { const row = getAt(r.path); row.isCalled = true; setAt(r.path, row); }
                throw unknown();
            }
            return { committed: true, snapshot: snap(r, getAt(r.path)) };
        },
        onValue: () => () => {}, off: () => {}
    } as any;
    vi.stubGlobal('fetch', vi.fn(async (inputUrl: any) => {
        if (lab.readFails) throw new TypeError('Failed to fetch');
        const path = decodeURIComponent(new URL(String(inputUrl)).pathname).replace(/^\//, '').replace(/\.json$/, '');
        return new Response(JSON.stringify(getAt(path)), { status: 200, headers: { 'content-type': 'application/json' } });
    }));
    (window as any).ZoeErrors = { capture: vi.fn() };
    uiState.activeParentItemId = 'itemI'; uiState.activeEditingBarcode = 'A100000001';
    input('editBcCodInput', '20'); input('editBcDodInput', '0');
});
afterEach(() => {
    firebaseState.authGeneration++;
    vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); delete (window as any).ZoeErrors;
});



const row = () => getAt(H + '/itemI');
function lock(kind: 'scanPending' | 'pricePending', local = true) {
    const value = row(); value[kind] = kind === 'scanPending' ? { phase: 'staged', id: 'scan_' + 'a'.repeat(32) }
        : { token: 'price_' + 'a'.repeat(32), actorUid: 'u', code: 'A100000001', slot: '0', birth: NOW - 60000,
            rowBirth: NOW - 3600000, scanDate: DAY(), priorCod: 10, priorDod: 0, wantCod: 20, wantDod: 0, phase: 'admitted' };
    setAt(H + '/itemI', value);
    if (local) dataState.scanHistory = [clone(value)];
    buildLockerBarcodeIndex();
}
const routes = [
    { name: 'call mark', run: () => { uiState.markingItemId = 'itemI'; return setCallMark('no-answer'); } },
    { name: 'phone', run: () => { uiState.editingItemId = 'itemI'; input('editPhoneInput', '012999888'); return saveEditedPhone(); } },
    { name: 'locker', run: () => assignLockerToEntry('A100000001') },
    { name: 'origin', run: () => saveBarcodeOrigins([{ code: 'A100000001', from: 'ភ្នំពេញ' }]) },
    { name: 'Delete', run: () => deleteSingleItem('itemI', { confirmed: true }) },
    { name: 'Remove', run: () => removeSingleBarcode('itemI', 'A100000001') },
    { name: 'row close', run: () => toggleCloseStatus('itemI') },
    { name: 'barcode close', run: () => applyBarcodeCloseChange('itemI', 'A100000001', true, {}) },
    { name: 'clear batch', run: () => clearHistory() }
];

describe('pending row ៖ ទ្វារសាធារណៈមិនកែជួរដែលកំពុងផ្ទៀងប្រាក់', () => {
    it.each(['scanPending', 'pricePending'] as const)('សោ %s រារាំង claim Trash មុនចាប់ផ្ដើម Remove/Delete/Cleanup', async (kind) => {
        lock(kind, false); const before = clone(lab.store);
        const result = await claimTrashBarcodes('itemI', 'other_claim', () => ['A100000001']);
        expect(result.state).toBe('busy');
        expect(lab.store).toEqual(before);
        expect(lab.writes).toEqual([]);
    });

    for (const kind of ['scanPending', 'pricePending'] as const) {
        it.each(routes)('$name មិនមាន optimistic ឬ server effect ពេល '+kind+' បង្ហាញរួច', async ({ run }) => {
            lock(kind); const before = clone(lab.store); const local = clone(dataState.scanHistory);
            await run(); await settle();
            expect(lab.store).toEqual(before);
            expect(dataState.scanHistory).toEqual(local);
            expect(lab.writes).toEqual([]);
            expect(uiState.toasts.some((toast: any) => String(toast.msg).startsWith('✅'))).toBe(false);
        });
    }

    it.each(['scanPending', 'pricePending'] as const)('Clear claim មិនប៉ះ authoritative %s ទោះ local view មិនទាន់ឃើញ', async (kind) => {
        lock(kind, false); const before = clone(lab.store);
        await expect(claimHistoryItemForClear('itemI', 'other_clear')).rejects.toThrow();
        expect(lab.store).toEqual(before);
        expect(lab.writes).toEqual([]);
    });

    it.each(['scanPending', 'pricePending'] as const)('Restore មិនប្តូរ target ទៅ row ថ្មីដើម្បីគេច %s', async (kind) => {
        lock(kind, false);
        const source = { ...row(), id: 'trashSource', barcode: 'RESTORE001', barcodes: [{ code: 'RESTORE001', cod: 3, dod: 0, createdAt: NOW - 90000 }] };
        delete source.scanPending; delete source.pricePending;
        await expect(findRestoreTargetId(source)).rejects.toThrow('ROW_OPERATION_BUSY');
        expect(lab.writes).toEqual([]);
    });

    it.each(['scanPending', 'pricePending'] as const)('Restore callback មិន merge ចូល authoritative %s', async (kind) => {
        lock(kind, false); const before = clone(lab.store);
        const source = { id: 'trashSource', phone: row().phone, scanDate: DAY(), barcodes: [{ code: 'RESTORE001', cod: 3, dod: 0, createdAt: NOW - 90000 }] };
        await expect(applyClaimedRestoreToHistory('itemI', 'trashSource', 'restore_token', source, (target) => ({ ...target, barcodes: target.barcodes.concat(source.barcodes) }))).rejects.toThrow('ROW_OPERATION_BUSY');
        expect(lab.store).toEqual(before);
        expect(lab.writes).toEqual([]);
    });

    it.each(['scanPending', 'pricePending'] as const)('Cleanup មិន claim authoritative %s ដែល local view ចាស់', async (kind) => {
        const value = row(); value.createdAt = NOW - 10 * 86400000; value.barcodes[0].createdAt = value.createdAt;
        setAt(H + '/itemI', value); dataState.scanHistory = [clone(value)]; lock(kind, false);
        const before = clone(lab.store);
        await claimAndCleanupItem('itemI', 'abandon'); await settle();
        expect(lab.store).toEqual(before);
        expect(lab.writes).toEqual([]);
    });

    for (const kind of ['scanPending', 'pricePending'] as const) {
        it.each(routes.filter(route => route.name !== 'clear batch'))('authoritative $name មិនកែជួរដែល local មិនទាន់ឃើញ '+kind, async ({ run }) => {
            lock(kind, false); const before = row(); const day = getAt(D); const month = getAt(M);
            await run(); await settle();
            expect(row()).toEqual(before);
            expect(getAt(D)).toEqual(day);
            expect(getAt(M)).toEqual(month);
            const pickup = getAt('zoew_daily_pickup_cod_dod/' + DAY());
            expect(pickup.packagesPickedUp || 0).toBe(0);
            expect(Object.keys(pickup.pickedUpBarcodes || {})).toEqual([]);
            expect(uiState.toasts.some((toast: any) => String(toast.msg).startsWith('✅'))).toBe(false);
        });
    }

    it('Clear batch ចម្រុះរាយការណ៍ជាផ្នែក និងទុក row មានសោដដែល', async () => {
        const unblocked = { ...row(), id: 'itemFree', phone: '012123456', barcode: 'B200000002', barcodes: [{ ...row().barcodes[0], code: 'B200000002' }] };
        setAt(H + '/itemFree', unblocked); lock('scanPending', false);
        dataState.scanHistory = Object.values(clone(lab.store[H]));
        const blocked = row();
        await clearHistory(); await settle();
        expect(row()).toEqual(blocked);
        expect(getAt(H + '/itemFree')).toBeNull();
        expect(getAt('zoew_recently_deleted_cod_dod/itemFree')).not.toBeNull();
        expect(uiState.toasts.some((toast: any) => String(toast.msg).startsWith('✅'))).toBe(false);
        expect(uiState.toasts.some((toast: any) => String(toast.msg).startsWith('⚠️ បានលុប 1'))).toBe(true);
    });

    it('busy state នៅក្នុង row model សម្រាប់បង្ហាញ និងបិទ action ប៉ុណ្ណោះ មិនលាក់ទឹកប្រាក់', () => {
        lock('scanPending');
        const model: any = buildHistoryRowModel(dataState.scanHistory[0], 1, false, false);
        expect(model.operationBusy).toBe(true);
        expect(model.money.cod).toBe(10);
    });

    it('ទិសផ្ទុយ ៖ metadata route លើ row ធម្មតារក្សាឥរិយាបថ', async () => {
        buildLockerBarcodeIndex(); uiState.markingItemId = 'itemI'; setCallMark('no-answer'); await settle();
        expect(row().callMark).toBe('no-answer');
        await saveBarcodeOrigins([{ code: 'A100000001', from: 'ភ្នំពេញ' }]);
        expect(Object.values(row().origins)).toContain('ភ្នំពេញ');
    });
});


it.each([true, false])('pending queue ៖ metadata intent រង់ចាំសោ local=%s ដោយមិនបាត់ ឬប្រើ retry budget', async (local) => {
    queueHistoryPatchRetry('itemI', { callMark: 'no-answer' }, { callMark: undefined }, '✅ បានរក្សាទុក', false);
    const before = clone(pendingHistoryPatches.get('itemI'));
    lock('scanPending', local);
    flushPendingHistoryPatches(); await settle();
    expect(pendingHistoryPatches.get('itemI')).toEqual(before);
    expect(lab.writes).toEqual([]);
    expect(dataState.historyPatchFlushInFlight).toBe(false);
    expect(uiState.toasts.some((toast: any) => String(toast.msg).startsWith('✅'))).toBe(false);
    const unlocked = row(); delete unlocked.scanPending; setAt(H + '/itemI', unlocked); dataState.scanHistory = [clone(unlocked)];
    flushPendingHistoryPatches(); await settle();
    expect(row().callMark).toBe('no-answer');
    expect(pendingHistoryPatches.size).toBe(0);
});

it.each(['scanPending', 'pricePending'] as const)('pending queue ៖ releaseTrashClaims មិនប៉ះ active ឬ malformed %s', async (kind) => {
    const value = row(); value.barcodes[0].trashClaim = 'original_claim'; setAt(H + '/itemI', value);
    lock(kind, false);
    const before = row();
    expect(await releaseTrashClaims('itemI', 'original_claim')).toBe(false);
    expect(row()).toEqual(before);
    expect(lab.writes).toEqual([]);
});

it('pending queue ៖ terminal price ត្រឹមត្រូវអនុញ្ញាត release ដើម ហើយ owner ចាស់ត្រូវបដិសេធ', async () => {
    lock('pricePending', false); const value = row();
    value.pricePending.phase = 'settled'; value.pricePending.outcome = 'committed'; value.barcodes[0].trashClaim = 'original_claim'; setAt(H + '/itemI', value);
    const owner = trashClaimOwner(); firebaseState.authGeneration++;
    expect(await releaseTrashClaims('itemI', 'original_claim', owner)).toBe(false);
    expect(lab.writes).toEqual([]);
    expect(await releaseTrashClaims('itemI', 'original_claim')).toBe(true);
    expect(row().barcodes[0].trashClaim).toBeUndefined();
    expect(row().pricePending).toEqual(value.pricePending);
});


it.each(['busy', 'unknown', 'stale', 'empty', 'malformed'])('pending late queue ៖ ចម្លើយ %s ក្រោយ ceiling មិនទាយ intent ថ្មី', async (outcome) => {
    vi.useFakeTimers();
    const flush = async () => { for (let i = 0; i < 8; i++) await vi.advanceTimersByTimeAsync(0); };
    queueHistoryPatchRetry('itemI', { callMark: 'no-answer' }, { callMark: undefined }, '✅ បានរក្សាទុក', false);
    const before = clone(pendingHistoryPatches.get('itemI'));
    const realTransaction = firebaseState.fb.runTransaction;
    let finish: ((outcome: string) => void) | null = null;
    firebaseState.fb.runTransaction = vi.fn((target: any, updater: any) => {
        if (target.path !== H + '/itemI') return realTransaction(target, updater);
        return new Promise((resolve, reject) => { finish = (result) => {
            const authoritative = row(); const next = updater(clone(authoritative));
            expect(next).toBeUndefined();
            if (result === 'unknown') reject(unknown());
            else resolve(result === 'empty' ? undefined : result === 'malformed' ? { snapshot: snap(target, authoritative) } : { committed: false, snapshot: snap(target, authoritative) });
        }; });
    }) as any;
    flushPendingHistoryPatches(); await flush();
    expect(finish).not.toBeNull();
    await vi.advanceTimersByTimeAsync(DB_OP_TIMEOUT_MS + 1); await flush();
    expect(pendingHistoryPatches.size).toBe(0);
    expect(dataState.historyPatchFlushInFlight).toBe(false);
    lock('scanPending', false);
    if (outcome === 'stale') firebaseState.authGeneration++;
    finish!(outcome); await flush();
    expect(lab.writes).toEqual([]);
    expect(uiState.toasts.some((toast: any) => String(toast.msg).startsWith('✅'))).toBe(false);
    if (outcome === 'busy') {
        expect(pendingHistoryPatches.get('itemI')).toEqual(before);
        await vi.advanceTimersByTimeAsync(DB_OP_TIMEOUT_MS * 2); await flush();
        expect(pendingHistoryPatches.get('itemI')).toEqual(before);
        expect(vi.mocked(firebaseState.fb.runTransaction).mock.calls.filter(([target]: any) => target.path === H + '/itemI')).toHaveLength(1);
        const unlocked = row(); delete unlocked.scanPending; setAt(H + '/itemI', unlocked); dataState.scanHistory = [clone(unlocked)];
        firebaseState.fb.runTransaction = realTransaction;
        flushPendingHistoryPatches(); await flush();
        expect(row().callMark).toBe('no-answer');
        expect(pendingHistoryPatches.size).toBe(0);
    } else expect(pendingHistoryPatches.size).toBe(0);
});
