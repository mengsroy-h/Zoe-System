/**
 * Deep audit ៩ (owner request · locked `zto-status.ts`) ៖ «🔄 ពិនិត្យម្តងទៀត» on the not-closed bar asks the bar's own parcels first.
 *    A forced round asked only `ZTO_STATUS_SWEEP_BATCH` entries from the session cursor over every closed `null` verdict and every open
 *    barcode ➜ the bar's parcels could be skipped and the toast still said «នៅសល់ N … ZTO មិនទាន់បិទ» or «មិនបាន». The bar's entries
 *    lead a forced round, and the toast names the ones the round could not ask («មិនទាន់ពិនិត្យ — សូមចុចម្តងទៀត»).
 *  ⛔ fairness (measured by the money matrix ៖ a Palm 2-hour cleanup never got its Sign evidence) ៖ the bar's entries go least recently
 *    checked first (a bar longer than one batch is walked by repeated presses), and the queue cursor counts only queue entries ➜ the bar
 *    entries asked first never make the rotation skip the same queue slots every round.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dataState, firebaseState, uiState, ztoState } from '../src/core/state';
import { appLocalStore } from '../src/core/storage';
import { getZoneDateKey } from '../src/core/timezone';
import { clearCustomerDataTableCache } from '../src/features/customer-table';
import {
    clearZtoPickupStatusStore, recheckZtoPickupStatus, renderZtoSyncViews, runZtoStatusSweep, setZtoPickupVerdict, ztoPickupStatus
} from '../src/features/zto-status';

vi.mock('../src/features/barcode-ops', () => ({
    openViewListModal: () => {}, removeSingleBarcode: async () => 'failed', toggleIndividualBarcodeClose: async () => false,
    openEditBarcodePriceModal: () => {}, closeEditBarcodeModal: () => {}, saveEditedBarcodePrice: () => {},
    applyBarcodeCloseChange: async () => true
}));

const NOW = Date.UTC(2026, 9, 28, 3, 0, 0);
const HOUR = 3600000;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

function closedItem(id: string, code: string, ageMs: number) {
    return { id, phone: '0960001234', scanDate: getZoneDateKey(NOW, 0), isClosed: true, closedAt: NOW - ageMs + 1000, createdAt: NOW - ageMs,
        cod: 1, dod: 0, count: 1, barcode: code, barcodes: [{ code, isClosed: true, closedAt: NOW - ageMs + 1000, cod: 1, dod: 0 }] };
}
function openItem(id: string, code: string, ageMs: number) {
    return { id, phone: '0960005678', scanDate: getZoneDateKey(NOW, 0), isClosed: false, createdAt: NOW - ageMs,
        cod: 1, dod: 0, count: 1, barcode: code, barcodes: [{ code, isClosed: false, cod: 1, dod: 0 }] };
}

let detail: string[] = [];
function server(signedInZto: Set<string>, listConfigured: boolean) {
    vi.stubGlobal('fetch', vi.fn(async (u: string) => {
        const url = new URL(String(u));
        if (url.searchParams.get('list') === '1') {
            return listConfigured
                ? json({ success: true, list: true, enabled: true, kind: 'signed', page: 1, pages: 1, rows: [], signed: [...signedInZto], signedOk: true })
                : json({ success: true, list: true, enabled: true, kind: 'signed', page: 1, pages: 1, rows: [], signed: null, signedOk: false });
        }
        const code = String(url.searchParams.get('barcode'));
        detail.push(code);
        if (code.startsWith('XNOTZTO')) return json({ success: false, found: false, barcode: code, code: 'ZTO_NOT_FOUND' });
        return json({ found: true, ztoClosed: signedInZto.has(code) });
    }));
}
const pending = () => [...ztoPickupStatus.entries()].filter(([, v]) => v.closed === false).map(([k]) => k);
const toasts = () => uiState.toasts.map((t: any) => String(t.msg));

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(NOW));
    appLocalStore.clear();
    appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify({ enabled: true, fastMode: true,
        url: window.location.origin + '/.netlify/functions/zto-order-detail?barcode={barcode}' }));
    clearCustomerDataTableCache();
    clearZtoPickupStatusStore();
    detail = [];
    ztoState.ztoStatusInFlight = false;
    dataState.scanHistory = [];
    dataState.deletedItems = [];
    uiState.isModalOpen = false;
    uiState.modalDisplay = {};
    uiState.toasts = [];
    firebaseState.authGeneration++;
    firebaseState.auth = { currentUser: { uid: 'audit' } } as any;
    firebaseState.db = { name: 'audit-db' } as any;
    firebaseState.fb = { getIdTokenResult: async () => ({ token: 't' }) } as any;
    vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    appLocalStore.clear();
    firebaseState.db = null as any;
    firebaseState.fb = null as any;
});

describe('«🔄 ពិនិត្យម្តងទៀត» ៖ កញ្ចប់ក្នុងរបាត្រូវបានសួរមុនគេ', () => {
    it('A ៖ auto-close បិទ · Barcode មិនមែន ZTO (null) ១២ មុនគេ ➜ កញ្ចប់ក្នុងរបា ៣ ត្រូវបានសួរ · toast ត្រឹមត្រូវ', async () => {
        appLocalStore.setItem('zoew_zto_autoclose_v1', '0');
        const nulls = Array.from({ length: 12 }, (_, i) => closedItem('n' + i, 'XNOTZTO' + String(i).padStart(3, '0'), 90 * 60000 - i * 1000));
        const bar = ['ZTF1A00001', 'ZTF1A00002', 'ZTF1A00003'].map((c, i) => closedItem('b' + i, c, 30 * 60000 - i * 1000));
        dataState.scanHistory = [...nulls, ...bar];
        nulls.forEach((it) => setZtoPickupVerdict(it.barcodes[0].code, null));
        bar.forEach((it) => setZtoPickupVerdict(it.barcodes[0].code, false));
        renderZtoSyncViews();
        expect(ztoState.ztoBannerView?.headline).toContain('3 កញ្ចប់');
        server(new Set(bar.map((it) => it.barcodes[0].code)), false);
        await recheckZtoPickupStatus();
        console.info('F1-A detail calls', JSON.stringify(detail), 'toasts', JSON.stringify(toasts()));
        expect(detail.filter((c) => c.startsWith('ZTF1A')), 'bar entries rechecked').toEqual(['ZTF1A00001', 'ZTF1A00002', 'ZTF1A00003']);
    });

    it('B ៖ auto-close បើក · បញ្ជី Sign មិនកំណត់ (server សួរម្តងមួយ) · cursor ក្រោយជុំធម្មតា ➜ កញ្ចប់ក្នុងរបា ២ ត្រូវបានសួរ', async () => {
        const opens = Array.from({ length: 40 }, (_, i) => openItem('o' + i, 'ZTF1BOPEN' + String(i).padStart(3, '0'), 2 * HOUR - i * 1000));
        dataState.scanHistory = [...opens];
        server(new Set(), false);
        await runZtoStatusSweep(false);
        expect(ztoState.ztoStatusSweepCursor, 'ជុំធម្មតាសួរ ១០').toBe(10);
        const bar = ['ZTF1B00001', 'ZTF1B00002'].map((c, i) => closedItem('b' + i, c, 20 * 60000 - i * 1000));
        dataState.scanHistory = [...bar, ...opens];
        bar.forEach((it) => setZtoPickupVerdict(it.barcodes[0].code, false));
        renderZtoSyncViews();
        expect(ztoState.ztoBannerView?.headline).toContain('2 កញ្ចប់');
        detail = [];
        uiState.toasts = [];
        vi.setSystemTime(new Date(NOW + 5 * 60000));
        server(new Set(bar.map((it) => it.barcodes[0].code)), false);
        await recheckZtoPickupStatus();
        console.info('F1-B detail calls', JSON.stringify(detail), 'pending', JSON.stringify(pending()), 'toasts', JSON.stringify(toasts()));
        expect(detail.filter((c) => c.startsWith('ZTF1B0000')), 'bar entries rechecked').toEqual(['ZTF1B00001', 'ZTF1B00002']);
    });

    it('C ៖ របា ១៤ កញ្ចប់ (លើស ១ ជុំ) ➜ ការចុចម្តងទៀតសួរកញ្ចប់ដែលមិនទាន់សួរ មិនមែន ១០ ដដែល', async () => {
        appLocalStore.setItem('zoew_zto_autoclose_v1', '0');
        const bar = Array.from({ length: 14 }, (_, i) => closedItem('c' + i, 'ZTF1C' + String(i).padStart(5, '0'), 40 * 60000 - i * 1000));
        dataState.scanHistory = [...bar];
        vi.setSystemTime(new Date(NOW - 10 * 60000));
        bar.forEach((it) => setZtoPickupVerdict(it.barcodes[0].code, false));
        vi.setSystemTime(new Date(NOW));
        renderZtoSyncViews();
        expect(ztoState.ztoBannerView?.headline).toContain('14 កញ្ចប់');
        server(new Set(), false);
        await recheckZtoPickupStatus();
        vi.setSystemTime(new Date(NOW + 60000));
        await recheckZtoPickupStatus();
        expect(new Set(detail.filter((c) => c.startsWith('ZTF1C'))).size).toBe(14);
    });

    it('D ៖ របា ៤ + ជួរ ១០ ➜ ការចុចបន្តបន្ទាប់សួរគ្រប់កញ្ចប់ក្នុងជួរ (cursor រាប់តែជួរ)', async () => {
        appLocalStore.setItem('zoew_zto_autoclose_v1', '0');
        const nulls = Array.from({ length: 10 }, (_, i) => closedItem('n' + i, 'XNOTZTO' + String(i).padStart(3, '0'), 90 * 60000 - i * 1000));
        const bar = ['ZTF1D00001', 'ZTF1D00002', 'ZTF1D00003', 'ZTF1D00004'].map((c, i) => closedItem('d' + i, c, 30 * 60000 - i * 1000));
        dataState.scanHistory = [...nulls, ...bar];
        nulls.forEach((it) => setZtoPickupVerdict(it.barcodes[0].code, null));
        bar.forEach((it) => setZtoPickupVerdict(it.barcodes[0].code, false));
        server(new Set(), false);
        for (let round = 0; round < 3; round++) {
            vi.setSystemTime(new Date(NOW + round * 60000));
            await recheckZtoPickupStatus();
        }
        expect(new Set(detail.filter((c) => c.startsWith('XNOTZTO'))).size).toBe(10);
    });

    it('E ៖ របា ១២ (≥ ១ ជុំ) + ជួរ ៣ ➜ round បង្ខំនីមួយៗសួរជួរយ៉ាងតិច ១ (ជួរមិនស្រេកឃ្លាន)', async () => {
        appLocalStore.setItem('zoew_zto_autoclose_v1', '0');
        const nulls = Array.from({ length: 3 }, (_, i) => closedItem('q' + i, 'XNOTZTO9' + String(i).padStart(2, '0'), 90 * 60000 - i * 1000));
        const bar = Array.from({ length: 12 }, (_, i) => closedItem('e' + i, 'ZTF1E' + String(i).padStart(5, '0'), 30 * 60000 - i * 1000));
        dataState.scanHistory = [...nulls, ...bar];
        vi.setSystemTime(new Date(NOW - 10 * 60000));
        nulls.forEach((it) => setZtoPickupVerdict(it.barcodes[0].code, null));
        bar.forEach((it) => setZtoPickupVerdict(it.barcodes[0].code, false));
        server(new Set(), false);
        for (let round = 0; round < 3; round++) {
            vi.setSystemTime(new Date(NOW + round * 60000));
            await runZtoStatusSweep(true);
        }
        expect(new Set(detail.filter((c) => c.startsWith('XNOTZTO9'))).size).toBe(3);
    });

    it('F ៖ ជុំបង្ខំបាក់ (បណ្តាញដាច់) ក្រោយធាតុរបា មុនធាតុជួរណាមួយ ➜ ជួរមិនត្រូវរំលងវេន (cursor មិនលោត)', async () => {
        appLocalStore.setItem('zoew_zto_autoclose_v1', '0');
        const queue = Array.from({ length: 12 }, (_, i) => closedItem('f' + i, 'XNOTZTO8' + String(i).padStart(2, '0'), 90 * 60000 - i * 1000));
        const bar = ['ZTF1F00001', 'ZTF1F00002'].map((c, i) => closedItem('g' + i, c, 30 * 60000 - i * 1000));
        dataState.scanHistory = [...queue, ...bar];
        queue.forEach((it) => setZtoPickupVerdict(it.barcodes[0].code, null));
        bar.forEach((it) => setZtoPickupVerdict(it.barcodes[0].code, false));
        ztoState.ztoStatusSweepCursor = 0;
        let online = true;
        let dropOn = 'ZTF1F00001';
        const onLine = vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => online);
        vi.stubGlobal('fetch', vi.fn(async (u: string) => {
            const code = String(new URL(String(u)).searchParams.get('barcode'));
            detail.push(code);
            if (code === dropOn) online = false;
            if (code.startsWith('XNOTZTO')) return json({ success: false, found: false, barcode: code, code: 'ZTO_NOT_FOUND' });
            return json({ found: true, ztoClosed: false });
        }));
        try {
            await runZtoStatusSweep(true);
            expect(online, 'លក្ខខណ្ឌចាំបាច់ ៖ បណ្តាញដាច់ពេលសួរធាតុរបាទី ១').toBe(false);
            online = true;
            dropOn = '';
            detail = [];
            vi.setSystemTime(new Date(NOW + 60000));
            await runZtoStatusSweep(true);
            const asked = [...new Set(detail.filter((c) => c.startsWith('XNOTZTO8')))].sort();
            expect(asked, 'ជួរចាប់ពីក្បាល (ធាតុដែលជុំបាក់មិនបានសួរ)').toEqual(queue.slice(0, 8).map((it) => it.barcodes[0].code));
        } finally {
            onLine.mockRestore();
        }
    });
});
