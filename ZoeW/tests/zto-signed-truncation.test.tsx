/**
 * ⛔ ZTO-E3 ៖ ពិដានបញ្ជី «ចុះហត្ថលេខា» (ZTO_LIST_CLIENT_MAX_PAGES ទំព័រ × ១០០)។
 *
 * មុនកែ ៖ ជួរ ៧–៣០ ថ្ងៃរបស់សាខារវល់មានស្កេន 05 លើសពិដាន ➜ `fetchZtoSignedCodes()` អានតែទំព័រ ១–៣ (`truncated`) ➜ កញ្ចប់ដែលនៅក្រៅទំព័រ ៣
 * មិនដែលបិទតាម ZTO (ពឹងតែការសួរម្តងមួយកញ្ចប់រៀងរាល់ម៉ោង) ហើយ App មិនប្រាប់។ ឥឡូវ ៖ បញ្ជីវែង ➜ អានម្តងទៀត **តាមថ្ងៃ** (`signed=1&from=d&to=d` ·
 * ≤ ZTO_SIGNED_DAY_CONCURRENCY ព្រមគ្នា) ➜ ថ្ងៃមួយនៅតែលើសពិដាន ➜ `truncated` ➜ មិន «ពេញលេញ» (E1) · ចន្លោះទ្វេ · toast ម្តងក្នុងមួយវគ្គ។
 * ⛔ ការហៅធម្មតា (មិនលើសពិដាន) នៅ ១ សំណើ (មិនបង្កើនការហៅ ZTO)។
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dataState, firebaseState, uiState, ztoState } from '../src/core/state';
import { appLocalStore } from '../src/core/storage';
import { getZoneDateKey } from '../src/core/timezone';
import { clearCustomerDataTableCache } from '../src/features/customer-table';
import { ZTO_SIGNED_DAY_CONCURRENCY, fetchZtoSignedCodes, ztoListDayKeys } from '../src/features/zto-list-sync';
import { ZTO_SIGNED_SWEEP_GAP_MS, clearZtoPickupStatusStore, runZtoStatusSweep } from '../src/features/zto-status';

const h = vi.hoisted(() => ({ calls: [] as any[] }));
vi.mock('../src/features/barcode-ops', () => ({
    openViewListModal: () => {},
    removeSingleBarcode: async () => 'failed',
    toggleIndividualBarcodeClose: async () => false,
    openEditBarcodePriceModal: () => {},
    closeEditBarcodeModal: () => {},
    saveEditedBarcodePrice: () => {},
    applyBarcodeCloseChange: async (itemId: string, code: string, closed: boolean, opts: any) => {
        h.calls.push({ itemId, code, closed, opts });
        return true;
    }
}));

const NOW = Date.UTC(2026, 9, 6, 3, 0, 0);
const DAY = 24 * 60 * 60 * 1000;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const CFG = { enabled: true, fastMode: true, url: 'https://example.invalid/.netlify/functions/zto-order-detail?barcode={barcode}' };

function openItem(id: string, code: string, ageMs: number) {
    return { id, phone: '0963897345', scanDate: getZoneDateKey(NOW - ageMs, 0), isClosed: false, createdAt: NOW - ageMs,
        barcodes: [{ code, isClosed: false, cod: 1, dod: 0 }] };
}

function signedServer(byDay: Record<string, string[]>, opts: { wholePages?: number, dayPages?: Record<string, number>, failDay?: string, mismatch?: Record<string, number> } = {}) {
    const requests: { from: string, to: string, page: number }[] = [];
    let live = 0;
    let peak = 0;
    const fetch = vi.fn(async (u: string) => {
        const url = new URL(String(u));
        if (url.searchParams.get('signed') !== '1') return json({ found: true, ztoClosed: null });
        const from = String(url.searchParams.get('from'));
        const to = String(url.searchParams.get('to'));
        const page = Number(url.searchParams.get('page'));
        requests.push({ from, to, page });
        live++;
        peak = Math.max(peak, live);
        await new Promise((r) => setTimeout(r, 0));
        live--;
        if (from === to && from === opts.failDay) return json({ error: 'down' }, 503);
        const days = Object.keys(byDay).filter((d) => from <= d && d <= to).sort().reverse();
        const codes = days.reduce((all: string[], d) => all.concat(byDay[d]), []);
        const pages = from === to ? ((opts.dayPages || {})[from] || 1) : (opts.wholePages || 1);
        const slice = pages > 1 ? (page === 1 ? codes.slice(0, 2) : []) : codes;
        return json({ success: true, list: true, enabled: true, kind: 'signed', page, pages, total: codes.length,
            rows: [], otherScans: 0, signedScans: slice.length, signed: slice, signedOk: true,
            signedMismatch: from === to ? ((opts.mismatch || {})[from] || 0) : (opts.mismatch && page === 1 ? 1 : 0) });
    });
    return { fetch, requests, peak: () => peak };
}

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(NOW));
    appLocalStore.clear();
    appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify(CFG));
    clearCustomerDataTableCache();
    clearZtoPickupStatusStore();
    h.calls.length = 0;
    ztoState.ztoStatusInFlight = false;
    dataState.scanHistory = [];
    dataState.deletedItems = [];
    uiState.isModalOpen = false;
    uiState.toasts = [];
    firebaseState.authGeneration++;
    firebaseState.auth = { currentUser: { uid: 'audit-user' } } as any;
    firebaseState.fb = { getIdTokenResult: async () => ({ token: 'audit-token' }) } as any;
});

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    appLocalStore.clear();
});

const d = (back: number) => getZoneDateKey(NOW, -back);

describe('ZTO-E3 ៖ បញ្ជី «ចុះហត្ថលេខា» លើសពិដានទំព័រ ➜ អានតាមថ្ងៃ', () => {
    it('ថ្ងៃ ៖ ពី from ដល់ to រាប់ទាំងសងខាង · ទម្រង់ខុស/បញ្ច្រាស ➜ ទទេ · ពិដាន ៣១ ថ្ងៃ', () => {
        expect(ztoListDayKeys('2026-09-29', '2026-10-01')).toEqual(['2026-09-29', '2026-09-30', '2026-10-01']);
        expect(ztoListDayKeys('2026-10-01', '2026-10-01')).toEqual(['2026-10-01']);
        expect(ztoListDayKeys('2026-10-02', '2026-10-01')).toEqual([]);
        expect(ztoListDayKeys('x', '2026-10-01')).toEqual([]);
        expect(ztoListDayKeys(undefined as any, null as any)).toEqual([]);
        expect(ztoListDayKeys('2026-01-01', '2026-12-31').length).toBe(31);
    });

    it('បញ្ជីវែង ➜ អានតាមថ្ងៃ ➜ កញ្ចប់ដែលនៅក្រៅទំព័រ ៣ ត្រូវបានរកឃើញ', async () => {
        const srv = signedServer({ [d(0)]: ['ZTE3000001', 'ZTE3000002'], [d(5)]: ['ZTE3000005'] }, { wholePages: 9 });
        vi.stubGlobal('fetch', srv.fetch);
        const out = await fetchZtoSignedCodes(CFG, d(7), d(0));
        expect(out.codes).toContain('ZTE3000005');
        expect(out.truncated).toBe(false);
        expect(out.partial).toBe(false);
        const dayRequests = srv.requests.filter((r) => r.from === r.to);
        expect(dayRequests.map((r) => r.from).sort()).toEqual(ztoListDayKeys(d(7), d(0)).sort());
        expect(srv.peak()).toBeLessThanOrEqual(ZTO_SIGNED_DAY_CONCURRENCY);
    });

    it('E4 ៖ ជួរ «ចុះហត្ថលេខា» ផ្ទុយ (`signedMismatch`) មិនបាត់លើផ្លូវអានតាមថ្ងៃ (មិនរាប់ស្ទួនជាមួយការអានទាំងមូល)', async () => {
        const srv = signedServer({ [d(0)]: ['ZTE3000061'], [d(3)]: ['ZTE3000062'] }, { wholePages: 9, mismatch: { [d(1)]: 2, [d(3)]: 1 } });
        vi.stubGlobal('fetch', srv.fetch);
        const out = await fetchZtoSignedCodes(CFG, d(4), d(0));
        expect(out.truncated).toBe(false);
        expect(out.signedMismatch).toBe(3);
    });

    it('ទិសផ្ទុយ ៖ មិនលើសពិដាន ➜ ១ សំណើតែប៉ុណ្ណោះ (មិនបង្កើនការហៅ ZTO)', async () => {
        const srv = signedServer({ [d(0)]: ['ZTE3000011'] });
        vi.stubGlobal('fetch', srv.fetch);
        const out = await fetchZtoSignedCodes(CFG, d(7), d(0));
        expect(out.codes).toEqual(['ZTE3000011']);
        expect(srv.requests.length).toBe(1);
    });

    it('ថ្ងៃមួយធ្លាក់ ➜ `partial` (មិនពេញលេញ)', async () => {
        const srv = signedServer({ [d(0)]: ['ZTE3000021'], [d(2)]: ['ZTE3000022'] }, { wholePages: 9, failDay: d(2) });
        vi.stubGlobal('fetch', srv.fetch);
        const out = await fetchZtoSignedCodes(CFG, d(3), d(0));
        expect(out.partial).toBe(true);
    });

    it('ជុំបិទតាម ZTO ៖ កញ្ចប់ចុះហត្ថលេខាក្រៅទំព័រ ៣ ➜ បិទ', async () => {
        dataState.scanHistory = [openItem('a1', 'ZTE3000031', 6 * DAY)];
        const srv = signedServer({ [d(0)]: ['ZTE3000032', 'ZTE3000033'], [d(4)]: ['ZTE3000031'] }, { wholePages: 9 });
        vi.stubGlobal('fetch', srv.fetch);
        await runZtoStatusSweep(false);
        expect(h.calls.map((c) => c.code)).toEqual(['ZTE3000031']);
        expect(ztoState.ztoSignedCompleteAt).toBe(NOW);
    });

    it('ថ្ងៃមួយនៅតែលើសពិដាន ➜ `truncated` ➜ មិនពេញលេញ · ចន្លោះទ្វេ · toast ម្តងក្នុងមួយវគ្គ', async () => {
        dataState.scanHistory = [openItem('b1', 'ZTE3000041', 2 * DAY)];
        const srv = signedServer({ [d(0)]: ['ZTE3000042', 'ZTE3000043'], [d(1)]: ['ZTE3000044'] }, { wholePages: 9, dayPages: { [d(0)]: 9 } });
        vi.stubGlobal('fetch', srv.fetch);
        await runZtoStatusSweep(false);
        expect(ztoState.ztoSignedCompleteAt).toBe(0);
        expect(ztoState.ztoSignedSweepOkAt).toBe(0);
        expect(ztoState.ztoSignedSweepWaitMs).toBeGreaterThan(ZTO_SIGNED_SWEEP_GAP_MS);
        const warned = () => uiState.toasts.filter((t: any) => String(t && t.msg).indexOf('ចុះហត្ថលេខា') !== -1).length;
        expect(warned()).toBe(1);
        vi.setSystemTime(new Date(NOW + ztoState.ztoSignedSweepWaitMs + 60000));
        ztoState.ztoStatusLastSweepAt = 0;
        await runZtoStatusSweep(false);
        expect(warned(), 'toast ម្តងក្នុងមួយវគ្គ').toBe(1);
        clearZtoPickupStatusStore();
        ztoState.ztoStatusLastSweepAt = 0;
        await runZtoStatusSweep(false);
        expect(warned(), 'វគ្គថ្មី ➜ ប្រាប់ម្តងទៀត').toBe(2);
    });
});
