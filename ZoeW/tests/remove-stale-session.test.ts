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

const DAY = '2026-10-07';
type Pending = { fn: any; resolve: (v: any) => void };
let ledgerPending: Pending[];
let capture: ReturnType<typeof vi.fn>;
const savedFb = firebaseState.fb;
const texts = () => uiState.toasts.map((t: any) => t.msg);
const flush = async (n = 8) => { for (let i = 0; i < n; i++) await vi.advanceTimersByTimeAsync(0); };

function commitLedger() {
    const batch = ledgerPending.splice(0);
    batch.forEach((p) => {
        const current = p.fn.monthly
            ? { '2026-10': { codDollar: 8, dodDollar: 0, totalCount: 2 } }
            : { codDollar: 8, dodDollar: 0, totalCount: 2 };
        const value = p.fn(current);
        p.resolve({ committed: true, snapshot: { val: () => value } });
    });
    return batch.length;
}

beforeEach(() => {
    vi.useFakeTimers();
    ledgerPending = [];
    uiState.toasts = [];
    uiState.scanRemoveInFlight = null;
    capture = vi.fn();
    (window as any).ZoeErrors = { capture };
    vi.stubGlobal('confirm', () => true);
    vi.stubGlobal('alert', () => undefined);
    firebaseState.authGeneration = 1;
    firebaseState.db = { name: 'db' } as any;
    firebaseState.dbRefHistory = { path: 'zoew_scan_history_cod_dod' } as any;
    firebaseState.dbRefDeleted = { path: 'zoew_recently_deleted_cod_dod' } as any;
    firebaseState.dbRefDailyRevenue = { path: 'zoew_daily_revenue_cod_dod' } as any;
    firebaseState.dbRefMonthlyRevenue = { path: 'zoew_monthly_revenue_cod_dod' } as any;
    firebaseState.dbRefDailyCollected = { path: 'zoew_daily_collected_cod_dod' } as any;
    firebaseState.dbLivenessProbe = Promise.resolve(null) as any;
    firebaseState.fb = {
        ref: (_db: any, path: string) => ({ path }),
        update: async () => true,
        runTransaction: (ref: any, fn: any) => {
            const path = String(ref.path || '');
            if (path.indexOf('zoew_scan_history_cod_dod/') === 0) {
                const current = dataState.scanHistory.find((i: any) => i.id === path.split('/').pop());
                const value = fn(current ? JSON.parse(JSON.stringify(current)) : null);
                return Promise.resolve({ committed: true, snapshot: { val: () => value } });
            }
            return new Promise((resolve) => {
                const entry: any = { fn, resolve };
                entry.fn.monthly = path.indexOf('zoew_monthly_revenue_cod_dod') === 0;
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
        expect(ledgerPending.length).toBe(2);
        expect(texts().some((m) => m.indexOf('⏳') === 0)).toBe(true);
        firebaseState.authGeneration++;
        commitLedger();
        await flush();
        expect(await run).toBe('done');
        expect(texts().filter((m) => m.indexOf('⚠️') === 0)).toEqual([]);
        expect(texts().some((m) => m.indexOf('✅') === 0)).toBe(false);
        expect(capture).not.toHaveBeenCalled();
    });

    it('ទិសផ្ទុយ ៖ វគ្គដដែល ➜ ✅ កាត់ប្រាក់រួចរាល់', async () => {
        const run = removeSingleBarcode('item1', 'ZTX0001');
        await flush();
        expect(commitLedger()).toBe(2);
        await flush();
        expect(await run).toBe('done');
        expect(texts().some((m) => m.indexOf('✅') === 0 && /កាត់ប្រាក់/.test(m))).toBe(true);
        expect(capture).not.toHaveBeenCalled();
    });

    it('ការសម្អាតស្វ័យប្រវត្តិ ៖ ច្រក ledger ដដែលពិនិត្យ `stale` មុនសារ/Sentry', () => {
        const src = readFileSync(path.join(__dirname, '..', 'src', 'domain', 'cleanup.ts'), 'utf8');
        const start = src.indexOf('const status = await applyCleanupRevenue(itemId, rev, -1);');
        expect(start).toBeGreaterThan(0);
        const verdict = src.slice(start, start + 400);
        expect(verdict.indexOf('status.stale')).toBeGreaterThan(0);
        expect(verdict.indexOf('status.stale')).toBeLessThan(verdict.indexOf('ZoeErrors.capture'));
        const live = src.indexOf('const deduction = await deductCleanupRevenue(id, trashItem, revenue);');
        expect(live).toBeGreaterThan(0);
        const door = src.slice(live, live + 900);
        expect(door.indexOf("deduction === 'stale'")).toBeGreaterThan(0);
        expect(door.indexOf("deduction === 'stale'")).toBeLessThan(door.indexOf('ZoeErrors.capture'));
    });
});
