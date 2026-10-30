/**
 * Deep audit ជុំ ៥ (Toast និយាយការពិត · ផ្លូវលុយ) ៖ «ដក» barcode ➜ ការផ្ទៀងផ្ទាត់ ledger ចប់ **ក្រោយ** ការចាកចេញ/ប្តូរគម្រោង ➜
 *   មុនកែ ៖ «⚠️ បានដកកញ្ចប់ … ប៉ុន្តែស្ថិតិប្រាក់មិនទាន់ Sync ពេញលេញទេ! សូមប្រាប់ Admin។» + Sentry `zone: 'money'` ដល់វគ្គថ្មី (ការជូនដំណឹងលុយក្លែង —
 *   ការផ្ទៀងផ្ទាត់មិនបានវាស់អ្វីទេ · callback ចាស់មិនសរសេរក្រោយការប្តូរ) ➜ ក្រោយកែ ៖ ស្ងាត់។ ទិសផ្ទុយ ៖ វគ្គដដែល ➜ «✅ បានដកកញ្ចប់ … កាត់ប្រាក់ … រួចរាល់!»។
 *   ការសម្អាតស្វ័យប្រវត្តិ (`claimAndCleanupItem`) ប្រើច្រកដដែល ➜ អត្ថបទរបស់វាត្រូវពិនិត្យ `stale` មុនសារ/Sentry (ផ្លូវនេះធ្ងន់ពេកសម្រាប់ harness)។
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dataState, firebaseState, uiState } from '../src/core/state';
import { removeSingleBarcode } from '../src/features/barcode-ops';
import { confirmScannedRemoval } from '../src/features/scan-remove';
import { cleanupInFlight, cleanupJournalLive } from '../src/domain/cleanup';

const DAY = '2026-10-07';
type Pending = { path: string; fn: any; resolve: (v: any) => void };
let ledgerPending: Pending[];
let capture: ReturnType<typeof vi.fn>;
let trashDocs: Record<string, any>;
let ledgerDocs: Record<string, any>;
const savedFb = firebaseState.fb;
const texts = () => uiState.toasts.map((t: any) => t.msg);
const flush = async (n = 8) => { for (let i = 0; i < n; i++) await vi.advanceTimersByTimeAsync(0); };

function commitLedger() {
    const batch = ledgerPending.splice(0);
    batch.forEach((p) => {
        const current = p.path.split('/').reduce((value: any, key: string) => value?.[key], ledgerDocs);
        const value = p.fn(structuredClone(current));
        if (value !== undefined) {
            const parts = p.path.split('/');
            let parent = ledgerDocs;
            for (const key of parts.slice(0, -1)) parent = parent[key] ||= {};
            parent[parts.at(-1)!] = structuredClone(value);
        }
        p.resolve({ committed: value !== undefined, snapshot: { val: () => structuredClone(value === undefined ? current : value) } });
    });
    return batch.length;
}

beforeEach(() => {
    vi.useFakeTimers();
    ledgerPending = [];
    trashDocs = {};
    ledgerDocs = {
        zoew_daily_revenue_cod_dod: { [DAY]: { codDollar: 8, dodDollar: 0, totalCount: 2 } },
        zoew_monthly_revenue_cod_dod: { '2026-10': { codDollar: 8, dodDollar: 0, totalCount: 2 } },
        zoew_daily_pickup_cod_dod: { [DAY]: { packagesPickedUp: 0, pickupRevision: 1, pickupResetEpoch: 0 } }
    };
    localStorage.clear(); cleanupInFlight.clear(); cleanupJournalLive.clear();
    uiState.toasts = [];
    uiState.scanRemoveInFlight = null;
    capture = vi.fn();
    (window as any).ZoeErrors = { capture };
    vi.stubGlobal('confirm', () => true);
    vi.stubGlobal('alert', () => undefined);
    firebaseState.authGeneration = 1;
    const options = { databaseURL: 'https://remove-session.firebaseio.com' };
    firebaseState.db = { name: 'db', app: { options } } as any;
    firebaseState.auth = { currentUser: { uid: 'remove-owner' }, app: { options } } as any;
    localStorage.setItem('zoew_firebase_config', JSON.stringify(options));
    firebaseState.dbRefHistory = { path: 'zoew_scan_history_cod_dod' } as any;
    firebaseState.dbRefDeleted = { path: 'zoew_recently_deleted_cod_dod' } as any;
    firebaseState.dbRefDailyRevenue = { path: 'zoew_daily_revenue_cod_dod' } as any;
    firebaseState.dbRefMonthlyRevenue = { path: 'zoew_monthly_revenue_cod_dod' } as any;
    firebaseState.dbRefDailyCollected = { path: 'zoew_daily_collected_cod_dod' } as any;
    firebaseState.dbLivenessProbe = Promise.resolve(null) as any;
    firebaseState.fb = {
        ref: (_db: any, path: string) => ({ path }),
        get: async (ref: any) => ({ val: () => structuredClone(ref.path.split('/').reduce((value: any, key: string) => value?.[key], ledgerDocs) ?? trashDocs[ref.path] ?? null) }),
        update: async () => true,
        runTransaction: (ref: any, fn: any) => {
            const path = String(ref.path || '');
            if (path.indexOf('zoew_scan_history_cod_dod/') === 0) {
                const current = dataState.scanHistory.find((i: any) => i.id === path.split('/').pop());
                const value = fn(current ? JSON.parse(JSON.stringify(current)) : null);
                if (value === undefined) return Promise.resolve({ committed: false, snapshot: { val: () => current ?? null } });
                dataState.scanHistory = dataState.scanHistory.filter((i: any) => i !== current).concat(value ? [value] : []);
                return Promise.resolve({ committed: true, snapshot: { val: () => value } });
            }
            if (path.indexOf('zoew_recently_deleted_cod_dod/') === 0) {
                const value = fn(trashDocs[path] ? structuredClone(trashDocs[path]) : null);
                if (value !== undefined) trashDocs[path] = structuredClone(value);
                return Promise.resolve({ committed: value !== undefined, snapshot: { val: () => value } });
            }
            if (!/^zoew_(daily|monthly)_revenue_cod_dod(?:\/|$)/.test(path)) throw new Error('សំណើគ្មាន fixture: ' + path);
            return new Promise((resolve) => {
                const entry: Pending = { path, fn, resolve };
                ledgerPending.push(entry);
            });
        }
    } as any;
    dataState.scanHistory = [{
        id: 'item1', phone: '0961111111', scanDate: DAY, time: '10:00:00 (' + DAY + ')', cod: 8, dod: 0, price: 8, count: 2, isClosed: false,
        barcodes: [
            { code: 'ZTX0001', cod: 5, dod: 0, isClosed: false, isDeducted: false, isFromDeletion: false },
            { code: 'ZTX0002', cod: 3, dod: 0, isClosed: false, isDeducted: false, isFromDeletion: false }
        ]
    }] as any;
    dataState.deletedItems = [];
    dataState.dailyRevenueData = { [DAY]: { codDollar: 8, dodDollar: 0, totalCount: 2 } };
    dataState.monthlyRevenueData = { '2026-10': { codDollar: 8, dodDollar: 0, totalCount: 2 } };
});

afterEach(() => {
    firebaseState.fb = savedFb;
    firebaseState.dbLivenessProbe = null as any;
    delete (window as any).ZoeErrors;
    vi.clearAllTimers();
    vi.useRealTimers();
});

describe('ដក barcode ៖ ការផ្ទៀងផ្ទាត់ ledger ចប់ក្រោយការប្តូរវគ្គ', () => {
    it('ចាកចេញមុន ledger ឆ្លើយ ➜ គ្មាន «⚠️ … សូមប្រាប់ Admin» · គ្មាន Sentry លុយ', async () => {
        const run = removeSingleBarcode('item1', 'ZTX0001');
        await flush();
        expect(ledgerPending.map((entry) => entry.path)).toEqual(['zoew_monthly_revenue_cod_dod']);
        expect(texts().some((m) => m.indexOf('⏳') === 0)).toBe(true);
        firebaseState.authGeneration++;
        commitLedger();
        await flush();
        expect(await run).toBe('pending');
        expect(ledgerPending).toHaveLength(0);
        expect(texts().filter((m) => m.indexOf('⚠️') === 0)).toEqual([]);
        expect(texts().some((m) => m.indexOf('✅') === 0)).toBe(false);
        expect(capture).not.toHaveBeenCalled();
    });

    it('ទិសផ្ទុយ ៖ វគ្គដដែល ➜ ✅ កាត់ប្រាក់រួចរាល់', async () => {
        const run = removeSingleBarcode('item1', 'ZTX0001');
        await flush();
        expect(commitLedger()).toBe(1);
        await flush();
        expect(commitLedger()).toBe(1);
        await flush();
        expect(await run).toBe('done');
        expect([ledgerDocs.zoew_daily_revenue_cod_dod[DAY], ledgerDocs.zoew_monthly_revenue_cod_dod['2026-10']])
            .toEqual([expect.objectContaining({ codDollar: 3, dodDollar: 0, totalCount: 1 }), expect.objectContaining({ codDollar: 3, dodDollar: 0, totalCount: 1 })]);
        expect(ledgerDocs.zoew_daily_pickup_cod_dod[DAY]).toEqual({ packagesPickedUp: 0, pickupRevision: 1, pickupResetEpoch: 0 });
        expect(texts().some((m) => m.indexOf('✅') === 0 && /កាត់ប្រាក់/.test(m))).toBe(true);
        expect(capture).not.toHaveBeenCalled();
    });

    it('ការសម្អាតស្វ័យប្រវត្តិ ៖ ច្រក ledger ដដែលពិនិត្យ `stale` មុនសារ/Sentry', () => {
        const src = readFileSync(path.join(__dirname, '..', 'src', 'domain', 'cleanup.ts'), 'utf8');
        expect(src.indexOf('applyCleanupRevenue')).toBe(-1);
        const live = src.indexOf('const deduction = await deductCleanupRevenue(id, trashItem, revenue);');
        expect(live).toBeGreaterThan(0);
        const door = src.slice(live, live + 900);
        expect(door.indexOf("deduction === 'stale'")).toBeGreaterThan(0);
        expect(door.indexOf("deduction === 'stale'")).toBeLessThan(door.indexOf('ZoeErrors.capture'));
    });
});

describe('U1 ៖ remove mode is never left locked by a removal that leaves no late commit behind', () => {
    it('the row is held by a cleanup on this device ➜ ⏳ toast, nothing removed, the scan lock is released', async () => {
        cleanupInFlight.add('item1');
        uiState.pendingScannedRemoval = { itemId: 'item1', barcodeCode: 'ZTX0001' };
        const result = await confirmScannedRemoval();
        expect({ result, lock: uiState.scanRemoveInFlight, kept: dataState.scanHistory[0].barcodes.length }).toEqual({ result: false, lock: null, kept: 2 });
        expect(texts().some((m) => m.indexOf('⏳') === 0)).toBe(true);
    });

    it('the barcode moved but the ledger refused its deduction ➜ the journal finishes it later and the scan lock is released now', async () => {
        const runTransaction = firebaseState.fb.runTransaction;
        firebaseState.fb.runTransaction = (ref: any, fn: any) => (String(ref.path || '').indexOf('zoew_daily_revenue_cod_dod') === 0 || String(ref.path || '').indexOf('zoew_monthly_revenue_cod_dod') === 0
            ? Promise.reject(Object.assign(new Error('PERMISSION_DENIED: refused'), { code: 'PERMISSION_DENIED' }))
            : runTransaction(ref, fn));
        uiState.pendingScannedRemoval = { itemId: 'item1', barcodeCode: 'ZTX0001' };
        const run = confirmScannedRemoval();
        await flush(30);
        const result = await run;
        expect({ result, lock: uiState.scanRemoveInFlight, moved: dataState.scanHistory[0].barcodes.map((b: any) => b.code) })
            .toEqual({ result: true, lock: null, moved: ['ZTX0002'] });
    });
});
