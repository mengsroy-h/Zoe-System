/**
 * ⛔ ប្រភពកញ្ចប់ ៖ ការ «បញ្ចូល» បញ្ជី ZTO ទុកប្រភព (`from` = `recSite`) ចូលប្រវត្តិ (`<id>/origins/<key>`) — កញ្ចប់ថ្មីដែលរក្សាទុកបាន
 * និងកញ្ចប់ដែលមានក្នុង ZoeW រួច (បំពេញ) · ការសរសេរប្រភពដាច់ពីការរក្សាទុកកញ្ចប់ ➜ rules ចាស់បដិសេធ ➜ ការបញ្ចូលនៅជោគជ័យដដែល ·
 * ⛔ ការមើលបញ្ជី (preview) មិនសរសេរអ្វីទាំងអស់។
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { refTo } from '../src/app/refs';
import { dataState, firebaseState, uiState, ztoState } from '../src/core/state';
import { viewState } from '../src/core/view-state';
import { appLocalStore } from '../src/core/storage';
import { clearCustomerDataTableCache } from '../src/features/customer-table';
import { importZtoListRows, runZtoListSyncPreview } from '../src/features/zto-list-sync';
import { clearZtoPickupStatusStore } from '../src/features/zto-status';

const h = vi.hoisted(() => ({ saves: [] as any[], tx: [] as any[], reject: false }));
vi.mock('../src/features/barcode-ops', () => ({
    openViewListModal: () => {},
    removeSingleBarcode: async () => 'failed',
    toggleIndividualBarcodeClose: async () => false,
    openEditBarcodePriceModal: () => {},
    closeEditBarcodeModal: () => {},
    saveEditedBarcodePrice: () => {},
    applyBarcodeCloseChange: async () => true
}));
vi.mock('../src/features/scan-action', () => ({
    triggerScanAction: () => {},
    confirmPhone: async () => {},
    dropOptimisticBarcode: () => {},
    addOrUpdateEntry: async (barcode: string, phone: string, cod: number, dod: number) => {
        h.saves.push({ barcode, phone, cod, dod });
        dataState.scanHistory = dataState.scanHistory.concat([{ id: 'it' + barcode, phone, scanDate: '2026-10-05', isClosed: false,
            createdAt: 1, barcodes: [{ code: barcode, isClosed: false, cod, dod, createdAt: 1 }] }]);
        return true;
    }
}));

const NOW = Date.UTC(2026, 9, 6, 3, 0, 0);
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const row = (barcode: string, from?: string) => ({ barcode, phone: '0960007345', cod: 2.5, dod: 0, at: '2026-10-05 09:00:00',
    ztoClosed: null, skip: '', from });
const listReply = (rows: any[]) => vi.fn(async () => json({ success: true, list: true, enabled: true, pages: 1, total: rows.length,
    rows, signed: [], signedOk: true, signedPages: 1 }));

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(NOW));
    appLocalStore.clear();
    appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify({ enabled: true, fastMode: true,
        url: 'https://example.invalid/.netlify/functions/zto-order-detail?barcode={barcode}' }));
    appLocalStore.setItem('zoew_zto_listsync_v1', '1');
    clearCustomerDataTableCache();
    clearZtoPickupStatusStore();
    h.saves.length = 0;
    h.tx.length = 0;
    h.reject = false;
    ztoState.ztoListSyncInFlight = false;
    ztoState.ztoListSyncResult = null;
    ztoState.ztoOriginRefusedDb = null;
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
        runTransaction: async (ref: any, fn: (cur: any) => any) => {
            if (!ref || !/^zoew_scan_history_cod_dod\//.test(ref.path)) return { committed: true, txOutcome: 'committed' };
            if (h.reject) throw Object.assign(new Error('PERMISSION_DENIED'), { code: 'PERMISSION_DENIED' });
            const id = ref.path.split('/')[1];
            const cur = dataState.scanHistory.find((i: any) => i.id === id);
            const next = fn(cur ? JSON.parse(JSON.stringify(cur)) : null);
            if (next === undefined) return { committed: false };
            h.tx.push({ path: ref.path, origins: next.origins });
            return { committed: true };
        }
    } as any;
    for (const name of ['ztoListSyncFrom', 'ztoListSyncTo'] as const) {
        const input = document.createElement('input');
        input.value = name === 'ztoListSyncFrom' ? '2026-10-03' : '2026-10-06';
        refTo(name)(input);
    }
    vi.stubGlobal('confirm', () => true);
});

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    appLocalStore.clear();
    refTo('ztoListSyncFrom')(null);
    refTo('ztoListSyncTo')(null);
});

async function settle() {
    for (let i = 0; i < 10; i++) await Promise.resolve();
}

describe('ប្រភពកញ្ចប់ ៖ ការបញ្ចូលបញ្ជី ZTO ➜ ប្រវត្តិ', () => {
    it('កញ្ចប់ថ្មីដែលរក្សាទុក + កញ្ចប់មានរួច ➜ ១ ការសរសេរ `origins` · ⛔ preview មិនសរសេរ', async () => {
        dataState.scanHistory = [{ id: 'old1', phone: '0960007345', scanDate: '2026-10-05', isClosed: false, createdAt: 1,
            barcodes: [{ code: 'ZT0000000901', isClosed: false, cod: 1, dod: 0 }] }];
        vi.stubGlobal('fetch', listReply([row('ZT0000000901', 'Shopee SHPE'), row('ZT0000000902', 'ZTO ឃ្លាំងក្វាងចូវអន្តរជាតិ'), row('ZT0000000903')]));
        await runZtoListSyncPreview();
        expect(h.tx, '⛔ preview មិនសរសេរ').toEqual([]);
        await importZtoListRows();
        await settle();
        expect(h.saves.map((s) => s.barcode)).toEqual(['ZT0000000902', 'ZT0000000903']);
        expect(h.tx).toEqual([
            { path: 'zoew_scan_history_cod_dod/old1', origins: { ZT0000000901: 'Shopee SHPE' } },
            { path: 'zoew_scan_history_cod_dod/itZT0000000902', origins: { ZT0000000902: 'ZTO ឃ្លាំងក្វាងចូវអន្តរជាតិ' } }
        ]);
    });

    it('គ្មានកញ្ចប់ថ្មី · មានតែកញ្ចប់មានរួចដែលខ្វះប្រភព ➜ បំពេញប្រភព (គ្មានប្រអប់សួរ) · toast ប្រាប់ចំនួន', async () => {
        dataState.scanHistory = [{ id: 'old2', phone: '0960007345', scanDate: '2026-10-05', isClosed: false, createdAt: 1,
            barcodes: [{ code: 'ZT0000000911', isClosed: false, cod: 1, dod: 0 }] }];
        const asked: string[] = [];
        vi.stubGlobal('confirm', (q: string) => { asked.push(q); return true; });
        vi.stubGlobal('fetch', listReply([row('ZT0000000911', 'Shopee SHPE')]));
        await runZtoListSyncPreview();
        await importZtoListRows();
        expect(asked).toEqual([]);
        expect(h.tx).toHaveLength(1);
        expect(uiState.toasts.map((t: any) => String(t && t.msg)).join(' | ')).toContain('📍 បំពេញប្រភព 1 កញ្ចប់');
    });

    it('⛔ rules ចាស់បដិសេធប្រភព ➜ ការបញ្ចូលកញ្ចប់នៅជោគជ័យ (✅ បញ្ចូល) · គ្មាន toast កំហុស', async () => {
        h.reject = true;
        vi.stubGlobal('fetch', listReply([row('ZT0000000921', 'Shopee SHPE')]));
        await runZtoListSyncPreview();
        await importZtoListRows();
        await settle();
        expect(h.saves.map((s) => s.barcode)).toEqual(['ZT0000000921']);
        const toasts = uiState.toasts.map((t: any) => String(t && t.msg)).join(' | ');
        expect(toasts).toContain('✅ បញ្ចូល 1 កញ្ចប់');
        expect(toasts).not.toContain('⚠️');
    });

    it('ទិសផ្ទុយ ៖ គ្មានប្រភពពី ZTO ➜ មិនសរសេរ', async () => {
        vi.stubGlobal('fetch', listReply([row('ZT0000000931')]));
        await runZtoListSyncPreview();
        await importZtoListRows();
        await settle();
        expect(h.saves).toHaveLength(1);
        expect(h.tx).toEqual([]);
    });
});
