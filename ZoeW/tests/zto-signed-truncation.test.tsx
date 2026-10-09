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
import * as ztoListSyncModule from '../src/features/zto-list-sync';
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
    return { id, phone: '0960007345', scanDate: getZoneDateKey(NOW - ageMs, 0), isClosed: false, createdAt: NOW - ageMs,
        barcodes: [{ code, isClosed: false, cod: 1, dod: 0 }] };
}

function signedServer(byDay: Record<string, string[]>, opts: { wholePages?: number | ((from: string, to: string) => number), dayPages?: Record<string, number>, failDay?: string, failDayPage?: { day: string, page: number }, mismatch?: Record<string, number> } = {}) {
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
        if (opts.failDayPage && from === to && from === opts.failDayPage.day && page === opts.failDayPage.page) return json({ error: 'down' }, 503);
        const days = Object.keys(byDay).filter((d) => from <= d && d <= to).sort().reverse();
        const codes = days.reduce((all: string[], d) => all.concat(byDay[d]), []);
        const pages = from === to ? ((opts.dayPages || {})[from] || 1)
            : (typeof opts.wholePages === 'function' ? opts.wholePages(from, to) : (opts.wholePages || 1));
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

describe('ការផ្ទៀងផ្ទាត់ឡើងវិញ ៖ ផ្លូវអានតាមថ្ងៃ (quota · វគ្គ · អ្នកយាមដែលខ្វះ)', () => {
    it('G0 ៖ ថ្ងៃមួយវាស់បាន តែទំព័រ ២ ធ្លាក់ ➜ លទ្ធផលរួម `partial` (មិន «ពេញលេញ» ➜ មិនដោះលែងការរង់ចាំ ៧ ថ្ងៃ)', async () => {
        const srv = signedServer({ [d(0)]: ['ZTE3000071'], [d(2)]: ['ZTE3000072', 'ZTE3000073', 'ZTE3000074'] },
            { wholePages: 9, dayPages: { [d(2)]: 2 }, failDayPage: { day: d(2), page: 2 } });
        vi.stubGlobal('fetch', srv.fetch);
        const out = await fetchZtoSignedCodes(CFG, d(3), d(0));
        expect(srv.requests.some((r) => r.from === d(2) && r.to === d(2) && r.page === 2), 'លក្ខខណ្ឌចាំបាច់ ៖ ទំព័រ ២ នៃថ្ងៃនោះត្រូវបានសួរ').toBe(true);
        expect(out.measured).toBe(true);
        expect(out.partial, '⛔ ថ្ងៃខ្វះទំព័រ ➜ partial').toBe(true);
    });

    it('G4 ៖ ការអានតាមថ្ងៃព្រមគ្នាមិនលើស ៣ (ពិដានជាលេខ ៖ ការអានថេរខ្លួនឯងមិនមែនអ្នកយាម)', async () => {
        const byDay: Record<string, string[]> = {};
        for (let back = 0; back < 10; back++) byDay[d(back)] = ['ZTE30001' + String(10 + back)];
        const srv = signedServer(byDay, { wholePages: 9 });
        vi.stubGlobal('fetch', srv.fetch);
        const out = await fetchZtoSignedCodes(CFG, d(9), d(0));
        expect(out.partial).toBe(false);
        expect(srv.requests.filter((r) => r.from === r.to).length, 'លក្ខខណ្ឌចាំបាច់ ៖ អាន ១០ ថ្ងៃ').toBe(10);
        expect(srv.peak()).toBeLessThanOrEqual(3);
        expect(ZTO_SIGNED_DAY_CONCURRENCY).toBeLessThanOrEqual(3);
    });

    it('G5 ៖ ថ្ងៃដែលធ្លាក់មិនលុបភស្តុតាងដែលការអានទាំងមូលបានរួច (ទំព័រ ១–៣)', async () => {
        const srv = signedServer({ [d(0)]: ['ZTE3000081', 'ZTE3000082'] }, { wholePages: 9, failDay: d(0) });
        vi.stubGlobal('fetch', srv.fetch);
        const out = await fetchZtoSignedCodes(CFG, d(2), d(0));
        expect(out.partial).toBe(true);
        expect(out.codes, 'ភស្តុតាងពីទំព័រ ១ នៃការអានទាំងមូលនៅដដែល').toContain('ZTE3000081');
    });

    it('Q2 ៖ បញ្ជីវែង ➜ ការអានបន្ទាប់ក្នុង ZTO_SIGNED_SPLIT_MEMO_MS ទៅតាមថ្ងៃភ្លាម (មិនអានទំព័រ ១–៣ ទាំងមូលម្តងទៀត) · ផុតពេល ➜ សាកទាំងមូលវិញ', async () => {
        const memo = (ztoListSyncModule as any).ZTO_SIGNED_SPLIT_MEMO_MS;
        expect(typeof memo === 'number' && memo > 0, 'ZTO_SIGNED_SPLIT_MEMO_MS ត្រូវមាន').toBe(true);
        const srv = signedServer({ [d(0)]: ['ZTE3000091'], [d(1)]: ['ZTE3000092'] }, { wholePages: 9 });
        vi.stubGlobal('fetch', srv.fetch);
        const whole = () => srv.requests.filter((r) => r.from !== r.to).length;
        await fetchZtoSignedCodes(CFG, d(1), d(0));
        const first = whole();
        expect(first, 'លក្ខខណ្ឌចាំបាច់ ៖ ការអានដំបូងអានទាំងមូល ៣ ទំព័រ').toBe(3);
        for (let i = 0; i < 5; i++) {
            vi.setSystemTime(new Date(Date.now() + 20 * 1000));
            const out = await fetchZtoSignedCodes(CFG, d(1), d(0));
            expect(out.codes).toContain('ZTE3000092');
            expect(out.partial).toBe(false);
        }
        expect(whole() - first, '⛔ ក្នុងពេលចងចាំ ➜ គ្មានការអានទាំងមូលម្តងទៀត').toBe(0);
        vi.setSystemTime(new Date(Date.now() + memo));
        await fetchZtoSignedCodes(CFG, d(1), d(0));
        expect(whole() - first, 'ផុតពេល ➜ សាកទាំងមូលវិញ (បញ្ជីអាចខ្លីវិញ)').toBe(3);
    });

    it('Q2 ទិសផ្ទុយ ៖ ផ្លូវតាមថ្ងៃដែលចងចាំ ឃើញ Server បិទបញ្ជី (`measured: false` គ្រប់ថ្ងៃ) ➜ `measured: false` (មិនមែន partial រហូត)', async () => {
        const srv = signedServer({ [d(0)]: ['ZTE3000095'] }, { wholePages: 9 });
        vi.stubGlobal('fetch', srv.fetch);
        await fetchZtoSignedCodes(CFG, d(1), d(0));
        vi.stubGlobal('fetch', vi.fn(async () => json({ success: true, list: true, enabled: true, kind: 'signed', page: 1, pages: 1,
            rows: [], signedOk: false, signed: null })));
        const out = await fetchZtoSignedCodes(CFG, d(1), d(0));
        expect(out && out.measured).toBe(false);
    });

    it('Q3 ៖ ចាកចេញ/ប្តូរគណនីកណ្តាលការអានតាមថ្ងៃ ➜ worker ឈប់ (មិនផ្ញើថ្ងៃដែលនៅសល់ដោយ token គណនីថ្មី)', async () => {
        const byDay: Record<string, string[]> = {};
        for (let back = 0; back < 10; back++) byDay[d(back)] = ['ZTE30002' + String(10 + back)];
        const srv = signedServer(byDay, { wholePages: 9 });
        let switchedAt = -1;
        const fetch = vi.fn(async (u: string) => {
            const url = new URL(String(u));
            const dayRequest = url.searchParams.get('from') === url.searchParams.get('to');
            if (dayRequest && switchedAt === -1) {
                switchedAt = srv.requests.length;
                firebaseState.authGeneration++;
            }
            return srv.fetch(u);
        });
        vi.stubGlobal('fetch', fetch);
        const out = await fetchZtoSignedCodes(CFG, d(9), d(0));
        const dayRequests = srv.requests.filter((r) => r.from === r.to).length;
        expect(switchedAt, 'លក្ខខណ្ឌចាំបាច់ ៖ ប្តូរគណនីពេលការអានតាមថ្ងៃចាប់ផ្តើម').toBeGreaterThan(-1);
        expect(dayRequests, '⛔ ក្រោយប្តូរ ➜ តែសំណើដែលកំពុងហោះ (≤ ZTO_SIGNED_DAY_CONCURRENCY) មិនមែន ១០ ថ្ងៃ').toBeLessThanOrEqual(ZTO_SIGNED_DAY_CONCURRENCY);
        expect(out.partial).toBe(true);
    });
});

describe('ការពិនិត្យប្រឆាំង ៖ ការចងចាំ «អានតាមថ្ងៃ» មិនបង្កើនការហៅ', () => {
    it('ជួរដែលបង្រួម (ម្សិលមិញ ➜ ថ្ងៃនេះ) ក្រោយការអានជួរវែងដែលលើសពិដាន ➜ សាកការអានទាំងមូលសិន (១ សំណើ) មិនមែនតាមថ្ងៃ', async () => {
        const srv = signedServer({ [d(0)]: ['ZTE3000301'], [d(5)]: ['ZTE3000305'] },
            { wholePages: (from) => (from <= d(3) ? 9 : 1) });
        vi.stubGlobal('fetch', srv.fetch);
        await fetchZtoSignedCodes(CFG, d(7), d(0));
        expect(srv.requests.some((r) => r.from === r.to), 'លក្ខខណ្ឌចាំបាច់ ៖ ជួរវែងលើសពិដាន ➜ អានតាមថ្ងៃ').toBe(true);
        const before = srv.requests.length;
        vi.setSystemTime(new Date(Date.now() + 20 * 1000));
        const out = await fetchZtoSignedCodes(CFG, d(1), d(0));
        const after = srv.requests.slice(before);
        expect(out.partial).toBe(false);
        expect(after.map((r) => r.from + '..' + r.to), '⛔ ជួរតូចជាងជួរដែលចងចាំ ➜ ការអានទាំងមូលតែមួយ').toEqual([d(1) + '..' + d(0)]);
        vi.setSystemTime(new Date(Date.now() + 20 * 1000));
        const before2 = srv.requests.length;
        await fetchZtoSignedCodes(CFG, d(7), d(0));
        expect(srv.requests.slice(before2).every((r) => r.from === r.to), 'ទិសផ្ទុយ ៖ ជួរវែងដដែលក្នុងពេលចងចាំ ➜ តាមថ្ងៃភ្លាម').toBe(true);
    });

    it('ផ្លូវចងចាំ ៖ ZTO ធ្លាក់ ➜ ឈប់ក្រោយរលកដំបូង (≤ ZTO_SIGNED_DAY_CONCURRENCY) ហើយបោះកំហុសដូចផ្លូវទាំងមូល (មិនមែន «partial» រាល់ថ្ងៃ)', async () => {
        const srv = signedServer({ [d(0)]: ['ZTE3000311'] }, { wholePages: 9 });
        vi.stubGlobal('fetch', srv.fetch);
        await fetchZtoSignedCodes(CFG, d(9), d(0));
        let calls = 0;
        vi.stubGlobal('fetch', vi.fn(async () => { calls++; return json({ error: 'ZTO HTTP 502' }, 502); }));
        vi.setSystemTime(new Date(Date.now() + 20 * 1000));
        await expect(fetchZtoSignedCodes(CFG, d(9), d(0)), '⛔ គ្មានថ្ងៃណាវាស់បាន ➜ កំហុស (ចន្លោះទ្វេ)').rejects.toBeTruthy();
        expect(calls, '⛔ មិនសួរគ្រប់ ១០ ថ្ងៃពេល ZTO ធ្លាក់').toBeLessThanOrEqual(ZTO_SIGNED_DAY_CONCURRENCY);
    });

    it('ផ្លូវចងចាំ ៖ Server បិទបញ្ជីច្បាស់លាស់ (`enabled: false`) ➜ កំហុស notConfigured ឡើងដល់អ្នកហៅ (`ztoSignedOff` ភ្លាម មិនមែន ៣០ នាទីក្រោយ)', async () => {
        const srv = signedServer({ [d(0)]: ['ZTE3000321'] }, { wholePages: 9 });
        vi.stubGlobal('fetch', srv.fetch);
        await fetchZtoSignedCodes(CFG, d(9), d(0));
        vi.stubGlobal('fetch', vi.fn(async () => json({ success: true, list: true, enabled: false, reason: 'list-off' })));
        vi.setSystemTime(new Date(Date.now() + 20 * 1000));
        let err: any = null;
        try { await fetchZtoSignedCodes(CFG, d(9), d(0)); } catch (e) { err = e; }
        expect(err && err.notConfigured, '⛔ notConfigured មិនត្រូវលេប').toBe(true);
        expect(err && err.listReason).toBe('list-off');
    });
});

describe('ការពិនិត្យប្រឆាំង (អ្នកយាម) ៖ ការចងចាំមិនឆ្លងវគ្គ', () => {
    it('ចាកចេញ/ចូលវិញ ខណៈការអានទាំងមូលដែលលើសពិដានកំពុងហោះ ➜ វគ្គថ្មីមិនទទួលការចងចាំ «តាមថ្ងៃ»', async () => {
        const { clearZtoPickupStatusStore: clearStore } = await import('../src/features/zto-status');
        let release: (v: any) => void = () => {};
        const gate = new Promise((r) => { release = r; });
        let long = true;
        const srv = signedServer({ [d(0)]: ['ZTE3000401'] }, { wholePages: () => (long ? 9 : 1) });
        let first = true;
        vi.stubGlobal('fetch', vi.fn(async (u: string) => {
            if (first) { first = false; await gate; }
            return srv.fetch(u);
        }));
        const pending = fetchZtoSignedCodes(CFG, d(7), d(0));
        await new Promise((r) => setTimeout(r, 0));
        clearStore();
        firebaseState.authGeneration++;
        release(null);
        await pending;
        long = false;
        const before = srv.requests.length;
        await fetchZtoSignedCodes(CFG, d(7), d(0));
        expect(srv.requests.slice(before).map((r) => r.from + '..' + r.to), '⛔ វគ្គថ្មី ៖ បញ្ជីខ្លី ➜ ការអានទាំងមូលតែមួយ (មិនមែនការចងចាំពីវគ្គចាស់)').toEqual([d(7) + '..' + d(0)]);
    });
});
