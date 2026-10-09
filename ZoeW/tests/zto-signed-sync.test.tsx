/**
 * ⛔ ZTO ៖ ការទាញបញ្ជីលឿន · ភស្តុតាង «ចុះហត្ថលេខា» (ZTO Palm) · បិទដូចបិទដោយដៃ · ឈ្មោះសាខា (សំណើម្ចាស់គម្រោង)។
 *
 * ១. **លឿន** ៖ ទំព័រ 2..N ត្រូវចេញ **ស្របគ្នា** ក្រោយទំព័រ ១ (មុនកែ ៖ មួយៗ ➜ ពេលសរុប = ផលបូក) ·
 *    ការសួរ `/detail` សម្រាប់ជួរដេកចាស់ក៏ស្របគ្នាដែរ (ពិដាន `ZTO_LIST_PROBE_CONCURRENCY`)។
 * ២. **ភស្តុតាងបិទ** ៖ សំណើទំព័រ ១ សុំ `withSigned=1` ➜ Function ទាញស្កេន «ចុះហត្ថលេខា» (05) ស្របគ្នា ➜ barcode ក្នុង `signed`
 *    = ZTO បិទរួច ➜ ជួរដេកថ្មី **គ្រប់អាយុ** បញ្ចូលជា «យករួច» (មុនកែ ៖ តែជួរដេកចាស់) ➜ ស្ថិតិយកតាម `applyBarcodeCloseChange()`
 *    (ទ្វារដដែលនឹងការបិទដោយដៃ)។ ⛔ គ្មានភស្តុតាង ≠ បិទរួច ➜ នៅបើក។
 * ៣. **បិទតាម ZTO ស្វ័យប្រវត្តិ (ZTO Palm)** ៖ ជុំពិនិត្យសួរបញ្ជី «ចុះហត្ថលេខា» ១ សំណើ ជំនួសការសួរ barcode ម្តងមួយ ➜ បិទកញ្ចប់បើក
 *    ដែលមានក្នុងបញ្ជី ➜ គោរពកុងតាក់ · ចន្លោះ `ZTO_SIGNED_SWEEP_GAP_MS` · Server មិនកំណត់ ➜ សម្រាក `ZTO_SIGNED_SWEEP_IDLE_MS`។
 * ៤. **ឈ្មោះសាខា** (`scanSite`) បង្ហាញក្នុងប្រអប់បញ្ជី ZTO · ចាកចេញ ➜ សម្អាត។
 */
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { refTo, setFieldValue } from '../src/app/refs';
import { dataState, firebaseState, uiState, ztoState } from '../src/core/state';
import { viewState } from '../src/core/view-state';
import { appLocalStore } from '../src/core/storage';
import { clearCustomerDataTableCache } from '../src/features/customer-table';
import { clearSensitiveModalFields } from '../src/features/session';
import {
    ZTO_LIST_PROBE_CONCURRENCY, classifyZtoListRows, importZtoListRows, resolveZtoListSignedVerdicts,
    runZtoListSyncPreview, ztoListSignedEvidence, ztoListSignedProbe, ztoListSignedVerdict
} from '../src/features/zto-list-sync';
import {
    ZTO_SIGNED_SWEEP_GAP_MS, ZTO_SIGNED_SWEEP_IDLE_MS, ZTO_STATUS_SWEEP_GAP_MS, clearZtoPickupStatusStore, runZtoStatusSweep, setZtoPickupVerdict,
    ztoPickupStatus
} from '../src/features/zto-status';
import { ZtoListSyncModal } from '../src/app/components/modals/ZtoListSyncModal';
import { mount, step, unmount } from './native/react-harness';

const h = vi.hoisted(() => ({ calls: [] as any[], ok: true, saves: [] as any[], confirms: [] as string[] }));
vi.mock('../src/features/barcode-ops', () => ({
    openViewListModal: () => {},
    removeSingleBarcode: async () => 'failed',
    toggleIndividualBarcodeClose: async () => false,
    openEditBarcodePriceModal: () => {},
    closeEditBarcodeModal: () => {},
    saveEditedBarcodePrice: () => {},
    applyBarcodeCloseChange: async (itemId: string, code: string, closed: boolean, opts: any) => {
        h.calls.push({ itemId, code, closed, opts });
        return h.ok;
    }
}));

vi.mock('../src/features/scan-action', () => ({
    triggerScanAction: () => {},
    confirmPhone: async () => {},
    dropOptimisticBarcode: () => {},
    addOrUpdateEntry: async (barcode: string, phone: string, cod: number, dod: number, locker: string, stampMs: number, closedAtMs: number) => {
        h.saves.push({ barcode, phone, cod, dod, locker, stampMs, closedAtMs });
        const at = Date.UTC(2026, 9, 6, 3, 0, 0) - 3600000;
        dataState.scanHistory = dataState.scanHistory.concat([{ id: 'it-' + barcode, phone, scanDate: '2026-10-05', isClosed: !!closedAtMs,
            createdAt: at, barcodes: [{ code: barcode, isClosed: !!closedAtMs, cod, dod, createdAt: at }] }]);
        return true;
    }
}));

const NOW = Date.UTC(2026, 9, 6, 3, 0, 0);
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((yes) => { resolve = yes; });
    return { promise, resolve };
}

function row(barcode: string, extra: any = {}) {
    return Object.assign({ barcode, phone: '0960007345', cod: 2.5, dod: 0, at: '2026-10-05 09:00:00', ztoClosed: null, skip: '' }, extra);
}

function openItem(id: string, code: string) {
    return { id, phone: '0960007345', scanDate: '2026-10-05', isClosed: false, createdAt: NOW - 3600000,
        barcodes: [{ code, isClosed: false, cod: 1, dod: 0, createdAt: NOW - 3600000 }] };
}

function closedItem(id: string, code: string) {
    return { id, phone: '0960007345', scanDate: '2026-10-05', isClosed: true, createdAt: NOW - 3600000,
        barcodes: [{ code, isClosed: true, closedAt: NOW - 60000, cod: 1, dod: 0, createdAt: NOW - 3600000 }] };
}

function urlOf(call: any[]) {
    return new URL(String(call[0]));
}

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(NOW));
    appLocalStore.clear();
    appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify({ enabled: true, fastMode: true,
        url: 'https://example.invalid/.netlify/functions/zto-order-detail?barcode={barcode}' }));
    appLocalStore.setItem('zoew_zto_listsync_v1', '1');
    clearCustomerDataTableCache();
    clearZtoPickupStatusStore();
    h.calls.length = 0;
    h.ok = true;
    ztoState.ztoStatusInFlight = false;
    ztoState.ztoListSyncInFlight = false;
    ztoState.ztoListSyncResult = null;
    dataState.scanHistory = [];
    dataState.deletedItems = [];
    uiState.isModalOpen = false;
    uiState.toasts = [];
    viewState.ztoListSyncNote = '';
    firebaseState.authGeneration++;
    firebaseState.auth = { currentUser: { uid: 'audit-user' } } as any;
    firebaseState.db = { audit: true } as any;
    firebaseState.fb = {
        getIdTokenResult: async () => ({ token: 'audit-token' }),
        ref: (_db: unknown, path: string) => ({ path }),
        runTransaction: async () => ({ committed: true, txOutcome: 'committed' })
    } as any;
    h.saves.length = 0;
    h.confirms.length = 0;
    for (const name of ['ztoListSyncFrom', 'ztoListSyncTo'] as const) {
        const input = document.createElement('input');
        input.value = name === 'ztoListSyncFrom' ? '2026-10-03' : '2026-10-06';
        refTo(name)(input);
    }
    vi.stubGlobal('confirm', (q: string) => { h.confirms.push(String(q)); return true; });
});

afterEach(() => {
    unmount();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    appLocalStore.clear();
    refTo('ztoListSyncFrom')(null);
    refTo('ztoListSyncTo')(null);
});

describe('ទាញបញ្ជីលឿន ៖ ទំព័រស្របគ្នា', () => {
    it('ទំព័រ 2..N ចេញទាំងអស់មុនទំព័រណាមួយឆ្លើយ (មិនមែនមួយៗ)', async () => {
        const later = [deferred<Response>(), deferred<Response>()];
        const fetch = vi.fn((url: string) => {
            const page = Number(new URL(url).searchParams.get('page'));
            if (page === 1) return Promise.resolve(json({ success: true, list: true, enabled: true, rows: [row('ZT0000000001')], pages: 3, total: 3 }));
            return later[page - 2].promise;
        });
        vi.stubGlobal('fetch', fetch);
        const running = runZtoListSyncPreview();
        await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(3));
        later[0].resolve(json({ success: true, list: true, enabled: true, rows: [row('ZT0000000002')], pages: 3, total: 3 }));
        later[1].resolve(json({ success: true, list: true, enabled: true, rows: [row('ZT0000000003')], pages: 3, total: 3 }));
        await running;
        expect(fetch.mock.calls.map((c) => urlOf(c).searchParams.get('page')).sort()).toEqual(['1', '2', '3']);
        expect(ztoState.ztoListSyncResult.rows.map((r: any) => r.barcode)).toEqual(['ZT0000000001', 'ZT0000000002', 'ZT0000000003']);
    });

    it('ទំព័រ ១ សុំភស្តុតាងចុះហត្ថលេខា (`withSigned=1`) ក្នុងសំណើដដែល', async () => {
        const fetch = vi.fn(async () => json({ success: true, list: true, enabled: true, rows: [row('ZT0000000001')], pages: 1, total: 1 }));
        vi.stubGlobal('fetch', fetch);
        await runZtoListSyncPreview();
        expect(fetch).toHaveBeenCalledTimes(1);
        expect(urlOf(fetch.mock.calls[0] as any[]).searchParams.get('withSigned')).toBe('1');
    });

    it('ការសួរ `/detail` សម្រាប់ជួរដេកចាស់ចេញស្របគ្នា (≤ ZTO_LIST_PROBE_CONCURRENCY)', async () => {
        let live = 0;
        let peak = 0;
        const fetch = vi.fn(async () => {
            live++;
            peak = Math.max(peak, live);
            await new Promise((r) => setTimeout(r, 5));
            live--;
            return json({ found: true, ztoClosed: true });
        });
        vi.stubGlobal('fetch', fetch);
        const old = [];
        for (let i = 0; i < 9; i++) old.push(row('ZT00000009' + String(i).padStart(2, '0'), { at: '2026-09-27 08:00:00' }));
        const measured = await resolveZtoListSignedVerdicts(JSON.parse(appLocalStore.getItem('zoew_lookup_api_config')!), old);
        expect(measured).toBe(9);
        expect(ZTO_LIST_PROBE_CONCURRENCY).toBeGreaterThan(1);
        expect(peak).toBeGreaterThan(1);
        expect(peak).toBeLessThanOrEqual(ZTO_LIST_PROBE_CONCURRENCY);
    });
});

describe('ភស្តុតាង «ចុះហត្ថលេខា» ➜ បញ្ចូលជា «យករួច» គ្រប់អាយុ', () => {
    it('barcode ក្នុង `signed` ➜ ជួរដេកក្មេងសម្គាល់ `closedAtZto` · ក្រៅបញ្ជី ➜ នៅបើក', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => json({
            success: true, list: true, enabled: true, pages: 1, total: 2,
            rows: [row('ZT0000000101'), row('ZT0000000102')],
            signed: ['ZT0000000101'], signedOk: true, signedPages: 1
        })));
        await runZtoListSyncPreview();
        const groups = classifyZtoListRows(ztoState.ztoListSyncResult.rows, [], []);
        const byCode = (code: string) => groups.fresh.find((r: any) => r.barcode === code);
        expect(byCode('ZT0000000101').closedAtZto).toBe(true);
        expect(byCode('ZT0000000102').closedAtZto).toBe(false);
        expect(viewState.ztoListSyncNote).toContain('🔒');
    });

    it('⛔ ភស្តុតាងចុះហត្ថលេខា ឈ្នះ `ztoClosed: false` ពីជួរដេក (ចុះហត្ថលេខា = យករួច) · ទិសផ្ទុយ ៖ `false`/`null` + គ្មានភស្តុតាង ➜ មិនបិទ', () => {
        ztoListSignedEvidence.clear();
        ztoListSignedEvidence.add('ZT0000000201');
        const groups = classifyZtoListRows([row('ZT0000000201', { ztoClosed: false }), row('ZT0000000202'), row('ZT0000000203', { ztoClosed: false })], [], []);
        const by = (code: string) => groups.fresh.find((r: any) => r.barcode === code);
        expect(by('ZT0000000201').closedAtZto).toBe(true);
        expect(by('ZT0000000202').closedAtZto).toBe(false);
        expect(by('ZT0000000203').closedAtZto).toBe(false);
    });

    it('កញ្ចប់មានក្នុង ZoeW ហើយនៅបើក + ZTO ចុះហត្ថលេខា ➜ «បញ្ចូល» បិទវាតាម `applyBarcodeCloseChange()` (ដូចបិទដោយដៃ)', async () => {
        dataState.scanHistory = [openItem('it1', 'ZT0000000301'), closedItem('it2', 'ZT0000000302'), openItem('it3', 'ZT0000000303')];
        vi.stubGlobal('fetch', vi.fn(async () => json({
            success: true, list: true, enabled: true, pages: 1, total: 3,
            rows: [row('ZT0000000301'), row('ZT0000000302'), row('ZT0000000303')],
            signed: ['ZT0000000301', 'ZT0000000302'], signedOk: true, signedPages: 1
        })));
        await runZtoListSyncPreview();
        expect(h.calls).toHaveLength(0);
        await importZtoListRows();
        expect(h.calls).toEqual([{ itemId: 'it1', code: 'ZT0000000301', closed: true, opts: { silent: true, showModal: false } }]);
        expect(ztoPickupStatus.get('ZT0000000301')).toMatchObject({ closed: true });
    });

    it('ទិសផ្ទុយ ៖ បិទកុងតាក់ «បិទតាម ZTO ស្វ័យប្រវត្តិ» ➜ «បញ្ចូល» មិនបិទកញ្ចប់ដែលមានស្រាប់', async () => {
        appLocalStore.setItem('zoew_zto_autoclose_v1', '0');
        dataState.scanHistory = [openItem('it1', 'ZT0000000301')];
        vi.stubGlobal('fetch', vi.fn(async () => json({
            success: true, list: true, enabled: true, pages: 1, total: 1,
            rows: [row('ZT0000000301')], signed: ['ZT0000000301'], signedOk: true, signedPages: 1
        })));
        await runZtoListSyncPreview();
        await importZtoListRows();
        expect(h.calls).toHaveLength(0);
    });
});

describe('បិទតាម ZTO ស្វ័យប្រវត្តិ ៖ បញ្ជី «ចុះហត្ថលេខា» (ZTO Palm)', () => {
    const signedOnly = (codes: string[]) => vi.fn(async (url: string) => {
        const u = new URL(url);
        if (u.searchParams.get('signed') === '1') {
            return json({ success: true, list: true, enabled: true, kind: 'signed', rows: [], pages: 1, total: codes.length, signed: codes, signedOk: true });
        }
        return json({ found: true, ztoClosed: null });
    });

    it('កញ្ចប់បើកដែលមានក្នុងបញ្ជីចុះហត្ថលេខា ➜ បិទ · កញ្ចប់ផ្សេង ➜ មិនបិទ', async () => {
        const items = [openItem('a1', 'ZT0000000401'), openItem('a2', 'ZT0000000402')];
        const fetch = signedOnly(['ZT0000000401', 'ZT0000009999']);
        vi.stubGlobal('fetch', fetch);
        const measured = await runZtoStatusSweep(true, items, []);
        const signedCalls = fetch.mock.calls.filter((c) => urlOf(c).searchParams.get('signed') === '1');
        expect(signedCalls).toHaveLength(1);
        expect(new Headers((signedCalls[0] as any[])[1].headers).get('X-Zoe-Id-Token')).toBe('audit-token');
        expect(h.calls.map((c) => c.code)).toEqual(['ZT0000000401']);
        expect(h.calls[0]).toMatchObject({ itemId: 'a1', closed: true, opts: { silent: true, showModal: false } });
        expect(measured).toBeGreaterThanOrEqual(1);
        const detailCodes = fetch.mock.calls.map((c) => urlOf(c).searchParams.get('barcode')).filter(Boolean);
        expect(detailCodes).not.toContain('ZT0000000401');
    });

    it('ចន្លោះ ៖ ជុំទី ២ មុន ZTO_SIGNED_SWEEP_GAP_MS មិនសួរបញ្ជីម្តងទៀត · ក្រោយចន្លោះ ➜ សួរ', async () => {
        const items = [openItem('a1', 'ZT0000000501')];
        const fetch = signedOnly([]);
        vi.stubGlobal('fetch', fetch);
        await runZtoStatusSweep(true, items, []);
        ztoState.ztoStatusLastSweepAt = 0;
        await runZtoStatusSweep(false, items, []);
        const count = () => fetch.mock.calls.filter((c) => urlOf(c).searchParams.get('signed') === '1').length;
        expect(count()).toBe(1);
        vi.setSystemTime(new Date(NOW + ZTO_SIGNED_SWEEP_GAP_MS + 1000));
        ztoState.ztoStatusLastSweepAt = 0;
        await runZtoStatusSweep(false, items, []);
        expect(count()).toBe(2);
    });

    it('Server មិនកំណត់មុខងារបញ្ជី ➜ សម្រាក ZTO_SIGNED_SWEEP_IDLE_MS (មិនសួររាល់ ២ នាទី)', async () => {
        const items = [openItem('a1', 'ZT0000000601')];
        const fetch = vi.fn(async (url: string) => (new URL(url).searchParams.get('signed') === '1'
            ? json({ success: false, list: true, enabled: false, code: 'ZTO_LIST_NOT_CONFIGURED', reason: 'site:no-account' })
            : json({ found: true, ztoClosed: null })));
        vi.stubGlobal('fetch', fetch);
        await runZtoStatusSweep(true, items, []);
        vi.setSystemTime(new Date(NOW + ZTO_SIGNED_SWEEP_GAP_MS + 1000));
        ztoState.ztoStatusLastSweepAt = 0;
        await runZtoStatusSweep(false, items, []);
        const count = () => fetch.mock.calls.filter((c) => urlOf(c).searchParams.get('signed') === '1').length;
        expect(count()).toBe(1);
        vi.setSystemTime(new Date(NOW + ZTO_SIGNED_SWEEP_IDLE_MS + 1000));
        ztoState.ztoStatusLastSweepAt = 0;
        await runZtoStatusSweep(false, items, []);
        expect(count()).toBe(2);
        expect(h.calls).toHaveLength(0);
    });

    it('ការបិទព្យួរ (`undefined` = commit យឺត) ➜ ជុំឈប់ភ្លាម មិនរង់ចាំពិដានលើកញ្ចប់បន្ទាប់', async () => {
        (h as any).ok = undefined;
        vi.stubGlobal('fetch', signedOnly(['ZT0000000901', 'ZT0000000902']));
        await runZtoStatusSweep(true, [openItem('a1', 'ZT0000000901'), openItem('a2', 'ZT0000000902')], []);
        expect(h.calls.map((c) => c.code)).toEqual(['ZT0000000901']);
    });

    it('ពិដាន ១០/ជុំ ៖ ១២ កញ្ចប់ ➜ ជុំ ១ បិទ ១០ · ជុំបន្ទាប់បិទ ២ ដែលនៅសល់', async () => {
        const codes: string[] = [];
        const items: any[] = [];
        for (let i = 0; i < 12; i++) {
            const code = 'ZT00000013' + String(i).padStart(2, '0');
            codes.push(code);
            items.push(openItem('c' + i, code));
        }
        vi.stubGlobal('fetch', signedOnly(codes));
        await runZtoStatusSweep(true, items, []);
        expect(h.calls).toHaveLength(10);
        items.forEach((it) => { if (h.calls.some((c) => c.itemId === it.id)) it.barcodes[0].isClosed = true; });
        vi.setSystemTime(new Date(NOW + ZTO_STATUS_SWEEP_GAP_MS + 1000));
        ztoState.ztoStatusLastSweepAt = 0;
        await runZtoStatusSweep(false, items, []);
        expect(h.calls.map((c) => c.code).slice(10).sort()).toEqual(codes.slice(10));
    });

    it('⛔ ការបិទដែលបរាជ័យជានិច្ច មិនត្រូវទប់កញ្ចប់ផ្សេង (ជួរមិនអត់ឃ្លាន · មិនសាកឡើងវិញរាល់ ២០ វិ.)', async () => {
        (h as any).ok = false;
        const codes: string[] = [];
        const items: any[] = [];
        for (let i = 0; i < 12; i++) {
            const code = 'ZT00000014' + String(i).padStart(2, '0');
            codes.push(code);
            items.push(openItem('s' + i, code));
        }
        vi.stubGlobal('fetch', signedOnly(codes));
        await runZtoStatusSweep(true, items, []);
        expect(h.calls).toHaveLength(10);
        vi.setSystemTime(new Date(NOW + ZTO_STATUS_SWEEP_GAP_MS + 1000));
        ztoState.ztoStatusLastSweepAt = 0;
        await runZtoStatusSweep(false, items, []);
        const second = h.calls.slice(10).map((c) => c.code).sort();
        expect(second).toEqual(codes.slice(10));
    });

    it('ជួរថ្ងៃ ៖ លើកដំបូង ៧ ថ្ងៃ · ក្រោយជោគជ័យ ១ ថ្ងៃ (ចប់ថ្ងៃនេះជានិច្ច)', async () => {
        const fetch = signedOnly([]);
        vi.stubGlobal('fetch', fetch);
        const items = [openItem('w1', 'ZT0000001501')];
        await runZtoStatusSweep(true, items, []);
        vi.setSystemTime(new Date(NOW + ZTO_SIGNED_SWEEP_GAP_MS + 1000));
        ztoState.ztoStatusLastSweepAt = 0;
        await runZtoStatusSweep(false, items, []);
        const ranges = fetch.mock.calls.map((c) => urlOf(c)).filter((u) => u.searchParams.get('signed') === '1')
            .map((u) => u.searchParams.get('from') + '>' + u.searchParams.get('to'));
        expect(ranges).toEqual(['2026-09-29>2026-10-06', '2026-10-05>2026-10-06']);
    });

    it('បណ្តាញធ្លាក់ ➜ ចន្លោះទ្វេ (មិនសួររាល់ ២ នាទី) · ក្រោយចន្លោះទ្វេ ➜ សួរម្តងទៀត', async () => {
        const fetch = vi.fn(async (url: string) => (new URL(url).searchParams.get('signed') === '1'
            ? json({ error: 'down' }, 502)
            : json({ found: true, ztoClosed: null })));
        vi.stubGlobal('fetch', fetch);
        const items = [openItem('b1', 'ZT0000001601')];
        const count = () => fetch.mock.calls.filter((c) => urlOf(c).searchParams.get('signed') === '1').length;
        await runZtoStatusSweep(true, items, []);
        vi.setSystemTime(new Date(NOW + ZTO_SIGNED_SWEEP_GAP_MS + 1000));
        ztoState.ztoStatusLastSweepAt = 0;
        await runZtoStatusSweep(false, items, []);
        expect(count()).toBe(1);
        vi.setSystemTime(new Date(NOW + 2 * ZTO_SIGNED_SWEEP_GAP_MS + 1000));
        ztoState.ztoStatusLastSweepAt = 0;
        await runZtoStatusSweep(false, items, []);
        expect(count()).toBe(2);
    });

    it('⛔ ទំព័របញ្ជីចុះហត្ថលេខាបន្ទាប់ធ្លាក់ ➜ ភស្តុតាងទំព័រ ១ នៅតែបិទ (មិនបោះចោលទាំងអស់) · មិនរាប់ជាការវាស់គ្រប់ (ជួរ ៧ ថ្ងៃនៅ)', async () => {
        const fetch = vi.fn(async (url: string) => {
            const u = new URL(url);
            if (u.searchParams.get('signed') === '1') {
                if (u.searchParams.get('page') === '1') {
                    return json({ success: true, list: true, enabled: true, kind: 'signed', rows: [], pages: 2, total: 150, signed: ['ZT0000001701'], signedOk: true });
                }
                return json({ error: 'ZTO rejected the request (HTTP 200)', code: 'ZTO_UPSTREAM_REJECTED' }, 502);
            }
            return json({ found: true, ztoClosed: null });
        });
        vi.stubGlobal('fetch', fetch);
        await runZtoStatusSweep(true, [openItem('p1', 'ZT0000001701'), openItem('p2', 'ZT0000001702')], []);
        const signedPages = fetch.mock.calls.map((c) => urlOf(c)).filter((u) => u.searchParams.get('signed') === '1')
            .map((u) => u.searchParams.get('page')).sort();
        expect(signedPages).toEqual(['1', '2']);
        expect(h.calls.map((c) => c.code)).toEqual(['ZT0000001701']);
        expect(ztoState.ztoSignedSweepOkAt).toBe(0);
        expect(ztoState.ztoSignedSweepWaitMs).toBeGreaterThanOrEqual(2 * ZTO_SIGNED_SWEEP_GAP_MS);
    });

    it('⛔ ចន្លោះទ្វេក្រោយជុំ «នៅសល់» ៖ ការធ្លាក់បន្ទាប់ពីជុំដែលនៅសល់កញ្ចប់ មិនត្រូវក្លាយជាចន្លោះប៉ុន្មាន ms (សួររាល់ជុំ)', async () => {
        const codes: string[] = [];
        const items: any[] = [];
        for (let i = 0; i < 12; i++) {
            const code = 'ZT00000018' + String(i).padStart(2, '0');
            codes.push(code);
            items.push(openItem('m' + i, code));
        }
        let signedCalls = 0;
        vi.stubGlobal('fetch', vi.fn(async (url: string) => {
            if (new URL(url).searchParams.get('signed') === '1') {
                signedCalls++;
                return signedCalls === 1
                    ? json({ success: true, list: true, enabled: true, kind: 'signed', rows: [], pages: 1, total: 12, signed: codes, signedOk: true })
                    : json({ error: 'down' }, 502);
            }
            return json({ found: true, ztoClosed: null });
        }));
        await runZtoStatusSweep(true, items, []);
        expect(h.calls).toHaveLength(10);
        vi.setSystemTime(new Date(NOW + ZTO_STATUS_SWEEP_GAP_MS + 1000));
        ztoState.ztoStatusLastSweepAt = 0;
        await runZtoStatusSweep(false, items, []);
        expect(signedCalls).toBe(2);
        expect(ztoState.ztoSignedSweepWaitMs).toBeGreaterThanOrEqual(2 * ZTO_SIGNED_SWEEP_GAP_MS);
        vi.setSystemTime(new Date(NOW + 2 * (ZTO_STATUS_SWEEP_GAP_MS + 1000)));
        ztoState.ztoStatusLastSweepAt = 0;
        await runZtoStatusSweep(false, items, []);
        expect(signedCalls).toBe(2);
    });

    it('ទិសផ្ទុយ ៖ កុងតាក់បិទ ➜ មិនសួរបញ្ជីចុះហត្ថលេខា · មិនបិទ', async () => {
        appLocalStore.setItem('zoew_zto_autoclose_v1', '0');
        const fetch = signedOnly(['ZT0000000701']);
        vi.stubGlobal('fetch', fetch);
        await runZtoStatusSweep(true, [openItem('a1', 'ZT0000000701')], []);
        expect(fetch.mock.calls.filter((c) => urlOf(c).searchParams.get('signed') === '1')).toHaveLength(0);
        expect(h.calls).toHaveLength(0);
    });
});

describe('ការប្រណាំង ៖ វគ្គចាស់ · ការបើកវិញដោយដៃ', () => {
    it('⛔ ចម្លើយយឺតរបស់វគ្គចាស់ (ក្រោយចាកចេញ) មិនត្រូវដាក់ភស្តុតាង «បិទរួច» ចូលការទាញរបស់វគ្គថ្មី', async () => {
        const old = deferred<Response>();
        const next = deferred<Response>();
        const fetch = vi.fn().mockImplementationOnce(() => old.promise).mockImplementationOnce(() => next.promise);
        vi.stubGlobal('fetch', fetch);
        const oldRun = runZtoListSyncPreview();
        await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
        clearSensitiveModalFields();
        setFieldValue('ztoListSyncFrom', '2026-10-03');
        setFieldValue('ztoListSyncTo', '2026-10-06');
        const nextRun = runZtoListSyncPreview();
        await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
        old.resolve(json({ success: true, list: true, enabled: true, pages: 1, total: 1,
            rows: [row('ZT0000001001')], signed: ['ZT0000001001'], signedOk: true, signedPages: 1 }));
        await oldRun;
        next.resolve(json({ success: true, list: true, enabled: true, pages: 1, total: 1,
            rows: [row('ZT0000001001')], signed: [], signedOk: true, signedPages: 1 }));
        await nextRun;
        expect(ztoListSignedEvidence.has('ZT0000001001')).toBe(false);
        const groups = classifyZtoListRows(ztoState.ztoListSyncResult.rows, [], []);
        expect(groups.fresh[0].closedAtZto).toBe(false);
    });

    it('⛔ កញ្ចប់ដែលអ្នកប្រើទើបបើកវិញ (សាលក្រម «បិទរួច» ថ្មី) ➜ ជុំធម្មតាមិនបិទវាវិញក្នុង ZTO_OPEN_RECHECK_MS · ការចុច «ពិនិត្យម្តងទៀត» ➜ បិទ', async () => {
        setZtoPickupVerdict('ZT0000001101', true);
        const items = [openItem('r1', 'ZT0000001101')];
        vi.stubGlobal('fetch', vi.fn(async (url: string) => (new URL(url).searchParams.get('signed') === '1'
            ? json({ success: true, list: true, enabled: true, kind: 'signed', rows: [], pages: 1, total: 1, signed: ['ZT0000001101'], signedOk: true })
            : json({ found: true, ztoClosed: true }))));
        await runZtoStatusSweep(false, items, []);
        expect(h.calls).toHaveLength(0);
        await runZtoStatusSweep(true, items, []);
        expect(h.calls.map((c) => c.code)).toEqual(['ZT0000001101']);
    });

    it('ទិសផ្ទុយ ៖ សាលក្រម «មិនទាន់បិទ» ថ្មី + ស្កេនចុះហត្ថលេខាថ្មី (អតិថិជនទើបយក) ➜ ជុំធម្មតាបិទ (មិនរង់ចាំ ១ ម៉ោង)', async () => {
        setZtoPickupVerdict('ZT0000001201', false);
        vi.stubGlobal('fetch', vi.fn(async (url: string) => (new URL(url).searchParams.get('signed') === '1'
            ? json({ success: true, list: true, enabled: true, kind: 'signed', rows: [], pages: 1, total: 1, signed: ['ZT0000001201'], signedOk: true })
            : json({ found: true, ztoClosed: null }))));
        await runZtoStatusSweep(false, [openItem('f1', 'ZT0000001201')], []);
        expect(h.calls.map((c) => c.code)).toEqual(['ZT0000001201']);
    });
});

describe('ឈ្មោះសាខាក្នុងប្រអប់បញ្ជី ZTO', () => {
    it('`siteName` + `site` ➜ បង្ហាញ «🏢 សាខា ៖ Mer SorChrey · 100200» · ចាកចេញ ➜ បាត់', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => json({
            success: true, list: true, enabled: true, pages: 1, total: 1, rows: [row('ZT0000000801')],
            site: '100200', siteName: 'Mer SorChrey', signed: [], signedOk: true, signedPages: 1
        })));
        mount(<ZtoListSyncModal />);
        setFieldValue('ztoListSyncFrom', '2026-10-03');
        setFieldValue('ztoListSyncTo', '2026-10-06');
        expect(document.getElementById('ztoListSyncSite')).toBeNull();
        await act(async () => { await runZtoListSyncPreview(); });
        expect(viewState.ztoListSyncSite).toBe('Mer SorChrey · 100200');
        step(() => {});
        expect(document.getElementById('ztoListSyncSite')!.textContent).toBe('🏢 សាខា ៖ Mer SorChrey · 100200');
        step(() => { clearSensitiveModalFields(); });
        expect(document.getElementById('ztoListSyncSite')).toBeNull();
        expect(ztoListSignedEvidence.size).toBe(0);
    });
});

const E2_YOUNG = '2026-10-05 09:00:00';
const E2_OLD = '2026-09-27 08:00:00';
const E2_PURGED = '2026-08-20 08:00:00';
function e2Server(code: string, rowClosed: boolean | null, detailClosed: boolean | null, signed: string[], at = E2_YOUNG) {
    return vi.fn(async (u: string) => {
        const url = new URL(String(u));
        if (url.searchParams.get('signed') === '1') {
            return json({ success: true, list: true, enabled: true, kind: 'signed', rows: [], pages: 1, total: signed.length, signed, signedOk: true });
        }
        if (url.searchParams.get('list') === '1') {
            return json({ success: true, list: true, enabled: true, pages: 1, total: 1,
                rows: [row(code, { ztoClosed: rowClosed, at })], signed, signedOk: true, signedPages: 1 });
        }
        return json({ found: true, ztoClosed: detailClosed });
    });
}

describe('⛔ ទ្វារបញ្ចូល = ទ្វារបិទស្វ័យប្រវត្តិ ៖ ភស្តុតាង ➜ /detail ➜ ជួរដេក', () => {
    it('1. លំដាប់ ៖ ភស្តុតាង ➜ /detail ➜ ជួរដេក ➜ null', () => {
        ztoListSignedEvidence.clear();
        ztoListSignedProbe.clear();
        ztoListSignedEvidence.add('ZT0000003001');
        expect(ztoListSignedVerdict({ ztoClosed: false }, 'ZT0000003001')).toBe(true);
        ztoListSignedProbe.set('ZT0000003001', false);
        expect(ztoListSignedVerdict({ ztoClosed: null }, 'ZT0000003001')).toBe(true);
        ztoListSignedProbe.set('ZT0000003002', false);
        expect(ztoListSignedVerdict({ ztoClosed: true }, 'ZT0000003002')).toBe(false);
        ztoListSignedProbe.set('ZT0000003003', true);
        expect(ztoListSignedVerdict({ ztoClosed: false }, 'ZT0000003003')).toBe(true);
        expect(ztoListSignedVerdict({ ztoClosed: false }, 'ZT0000003004')).toBe(false);
        expect(ztoListSignedVerdict({ ztoClosed: null }, 'ZT0000003004')).toBe(null);
        expect(ztoListSignedVerdict(null, '')).toBe(null);
    });

    it('2. ជួរដេកក្មេង false + ភស្តុតាង ➜ កើតមកជា «យករួច» · ចំណាំមើលជាមុនរាប់ 🔒', async () => {
        vi.stubGlobal('fetch', e2Server('ZT0000003101', false, false, ['ZT0000003101']));
        await runZtoListSyncPreview();
        expect(viewState.ztoListSyncNote).toContain('🔒 ថ្មីដែល ZTO បិទរួច 1');
        await importZtoListRows();
        expect(h.saves).toHaveLength(1);
        expect(h.saves[0].closedAtMs).toBe(NOW);
        expect(h.calls.map((c) => c.code)).toEqual(['ZT0000003101']);
    });

    it('3. មានក្នុង ZoeW (បើក) + false + ភស្តុតាង ➜ «បញ្ចូល» បិទ (ដូចជុំស្វ័យប្រវត្តិ)', async () => {
        dataState.scanHistory = [openItem('ex1', 'ZT0000003201')];
        vi.stubGlobal('fetch', e2Server('ZT0000003201', false, false, ['ZT0000003201']));
        await runZtoListSyncPreview();
        expect(viewState.ztoListSyncNote).toContain('🔒 មានក្នុង ZoeW តែ ZTO បិទរួច 1');
        await importZtoListRows();
        expect(h.calls).toEqual([{ itemId: 'ex1', code: 'ZT0000003201', closed: true, opts: { silent: true, showModal: false } }]);
        expect(h.saves).toHaveLength(0);
        h.calls.length = 0;
        ztoState.ztoListSyncResult = null;
        dataState.scanHistory = [openItem('ex2', 'ZT0000003202')];
        vi.stubGlobal('fetch', e2Server('ZT0000003202', false, false, []));
        await runZtoListSyncPreview();
        await importZtoListRows();
        expect(h.calls).toEqual([]);
    });

    it('4. អាយុ ៖ ចាស់ + false + ភស្តុតាង ➜ ថ្មី «យករួច» · ទិសផ្ទុយ ៖ គ្មានភស្តុតាង ➜ too-old-open · ហួសធុងសំរាម ➜ too-old-purged ទោះមានភស្តុតាង', () => {
        ztoListSignedEvidence.clear();
        ztoListSignedProbe.clear();
        ztoListSignedEvidence.add('ZT0000003301');
        ztoListSignedEvidence.add('ZT0000003303');
        const g = classifyZtoListRows([
            row('ZT0000003301', { at: E2_OLD, ztoClosed: false }),
            row('ZT0000003302', { at: E2_OLD, ztoClosed: false }),
            row('ZT0000003303', { at: E2_PURGED, ztoClosed: false }),
            row('ZT0000003304', { at: E2_OLD, ztoClosed: null })
        ], [], []);
        expect(g.fresh.map((r: any) => [r.barcode, r.closedAtZto])).toEqual([['ZT0000003301', true]]);
        expect(g.skipped.map((r: any) => [r.barcode, r.skip])).toEqual([
            ['ZT0000003302', 'too-old-open'], ['ZT0000003303', 'too-old-purged'], ['ZT0000003304', 'too-old-unknown']
        ]);
    });

    it('5. ទ្វារទាំង ២ សម្រេចដូចគ្នាលើ server ដដែល (មានភស្តុតាង ➜ បិទ · គ្មាន ➜ បើក)', async () => {
        const outcome = async (signed: string[]) => {
            h.calls.length = 0;
            h.saves.length = 0;
            dataState.scanHistory = [];
            ztoState.ztoListSyncResult = null;
            vi.stubGlobal('fetch', e2Server('ZT0000003401', false, false, signed));
            await runZtoListSyncPreview();
            await importZtoListRows();
            const importDoor = h.saves.length === 1 && h.saves[0].closedAtMs > 0;
            h.calls.length = 0;
            clearZtoPickupStatusStore();
            await runZtoStatusSweep(true, [openItem('a1', 'ZT0000003401')], []);
            const autoDoor = h.calls.some((c) => c.code === 'ZT0000003401');
            return { importDoor, autoDoor };
        };
        expect(await outcome(['ZT0000003401'])).toEqual({ importDoor: true, autoDoor: true });
        expect(await outcome([])).toEqual({ importDoor: false, autoDoor: false });
    });
});
