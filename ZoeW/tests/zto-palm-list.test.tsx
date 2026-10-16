/**
 * Palm ៖ URL/session ត្រូវសាខា · បញ្ជីមកដល់ផ្ទៀង track · ទំព័រពេញ · បិទតាម ZTO និងរបាររំលឹក។
 */
import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { refTo } from '../src/app/refs';
import { registerModalMeta, unregisterModalMeta } from '../src/core/modals';
import { dataState, firebaseState, lookupState, securityState, uiState, ztoState } from '../src/core/state';
import { appLocalStore } from '../src/core/storage';
import { clearCustomerDataTableCache } from '../src/features/customer-table';
import { buildZtoListApiUrl, drawerZtoListSyncFlow, openZtoListSyncModal, refreshZtoListSyncUi, runZtoListSyncPreview, ztoListSyncEnabled } from '../src/features/zto-list-sync';
import { viewState } from '../src/core/view-state';
import { checkZtoStatusForBarcode, clearZtoPickupStatusStore, runZtoStatusSweep, ztoAutoCloseEnabled, ztoFastModeIsOn, ztoStatusFeatureConfig } from '../src/features/zto-status';
import { encryptLookupSecret } from '../src/services/crypto';
import { warmZtoLookupProxyIfConfigured } from '../src/features/customer-table-prefetch';
import { getLookupApiConfig } from '../src/features/lookup-config';

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
const SESSION = 'synthetic-sealed-palm-session-for-list';
const PROXY = 'synthetic-palm-list-proxy-0123456789';
const PALM_URL = window.location.origin + '/.netlify/functions/zto-order-detail?palm=1&barcode={barcode}';
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const openItem = (id: string, code: string) => ({ id, phone: '0960007345', scanDate: '2026-10-05', isClosed: false, createdAt: NOW - 3600000,
    barcodes: [{ code, isClosed: false, cod: 1, dod: 0, createdAt: NOW - 3600000 }] });

beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(NOW));
    vi.stubGlobal('crypto', webcrypto);
    appLocalStore.clear();
    securityState.lookupSecretKey = await webcrypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']) as any;
    appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify({ enabled: true, fastMode: true, url: PALM_URL,
        headerName: 'X-Zoe-Proxy-Key', headerValueEnc: await encryptLookupSecret(PROXY), palmTokenEnc: await encryptLookupSecret(SESSION),
        palmAccount: { siteCode: 'KH001', siteName: 'Test branch' } }));
    appLocalStore.setItem('zoew_zto_listsync_v1', '1');
    clearCustomerDataTableCache();
    clearZtoPickupStatusStore();
    h.calls.length = 0;
    ztoState.ztoStatusInFlight = false;
    ztoState.ztoListSyncInFlight = false;
    ztoState.ztoListSyncResult = null;
    dataState.scanHistory = [];
    dataState.deletedItems = [];
    uiState.isModalOpen = false;
    uiState.toasts = [];
    firebaseState.authGeneration++;
    firebaseState.auth = { currentUser: { uid: 'audit-user' } } as any;
    firebaseState.db = { audit: true } as any;
    firebaseState.fb = { getIdTokenResult: async () => ({ token: 'audit-token' }), ref: (_db: unknown, path: string) => ({ path }),
        runTransaction: async () => ({ committed: true, txOutcome: 'committed' }) } as any;
    for (const name of ['ztoListSyncFrom', 'ztoListSyncTo'] as const) {
        const input = document.createElement('input');
        input.value = name === 'ztoListSyncFrom' ? '2026-10-03' : '2026-10-06';
        refTo(name)(input);
    }
});

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    appLocalStore.clear();
    securityState.lookupSecretKey = null;
    refTo('ztoListSyncFrom')(null);
    refTo('ztoListSyncTo')(null);
});

describe('ZTO Palm ៖ ចុះហត្ថលេខា · បិទស្វ័យប្រវត្តិ', () => {
    it('ពិនិត្យ Barcode Palm ➜ status=1 និង session · ចម្លើយដូច Cookie', async () => {
        const fetch = vi.fn(async (_url: string, _init?: RequestInit) => json({ found: true, ztoClosed: false }));
        vi.stubGlobal('fetch', fetch);
        expect(await checkZtoStatusForBarcode(getLookupApiConfig(), 'KH0000000401')).toEqual({ closed: false });
        const [url, init] = fetch.mock.calls[0];
        const u = new URL(url);
        expect(u.searchParams.get('palm')).toBe('1');
        expect(u.searchParams.get('status')).toBe('1');
        expect(init?.headers).toMatchObject({ 'X-Zoe-Palm-Token': SESSION, 'X-Zoe-Id-Token': 'audit-token' });
    });

    it('Palm បិទក្នុង ZoeW តែ ZTO មិនទាន់បិទ ➜ របារលេច ហើយរលត់ក្រោយចុះហត្ថលេខា', async () => {
        const item = openItem('a1', 'KH0000000401');
        item.isClosed = true;
        item.barcodes[0].isClosed = true;
        let closed = false;
        const fetch = vi.fn(async (url: string, _init?: RequestInit) => {
            const u = new URL(url);
            if (u.searchParams.get('list') === '1') return json({ success: true, list: true, enabled: true, kind: 'signed',
                rows: [], pages: 1, total: 0, signed: [], signedOk: true, signedRows: [] });
            expect(u.searchParams.get('status')).toBe('1');
            return json({ success: true, found: true, ztoClosed: closed });
        });
        vi.stubGlobal('fetch', fetch);
        expect(await runZtoStatusSweep(true, [item], [])).toBe(1);
        expect(ztoState.ztoBannerView?.headline).toContain('1 កញ្ចប់');
        closed = true;
        expect(await runZtoStatusSweep(true, [item], [])).toBeGreaterThan(0);
        expect(ztoState.ztoBannerView).toBeNull();
        expect(h.calls).toEqual([]);
    });

    it('Palm config ➜ «បិទតាម ZTO» បើក ដូចរបៀប Argus', () => {
        expect(ztoFastModeIsOn()).toBe(true);
        expect(ztoStatusFeatureConfig()).toMatchObject({ url: PALM_URL });
        expect(ztoAutoCloseEnabled()).toBe(true);
    });

    it('URL បញ្ជីចុះហត្ថលេខារក្សា palm=1 ➜ Function អានបញ្ជី Palm (មិនមែន Argus)', () => {
        const url = new URL(buildZtoListApiUrl({ url: PALM_URL }, '2026-10-03', '2026-10-06', 1, 'signedExact'));
        expect(url.searchParams.get('palm')).toBe('1');
        expect(url.searchParams.get('list')).toBe('1');
        expect(url.searchParams.get('signed')).toBe('1');
        expect(url.searchParams.get('exact')).toBe('1');
        const argus = new URL(buildZtoListApiUrl({ url: window.location.origin + '/.netlify/functions/zto-order-detail?barcode={barcode}' }, '2026-10-03', '2026-10-06', 1));
        expect(argus.searchParams.get('palm')).toBeNull();
    });

    it('Palm បញ្ជីចុះហត្ថលេខាបរាជ័យ ➜ ពិនិត្យ track មួយកញ្ចប់ និងបិទដូច Cookie', async () => {
        vi.stubGlobal('fetch', vi.fn(async (url: string) => {
            const u = new URL(url);
            if (u.searchParams.get('list') === '1') return json({ error: 'temporary' }, 502);
            expect(u.searchParams.get('status')).toBe('1');
            return json({ found: true, ztoClosed: true });
        }));
        await runZtoStatusSweep(true, [openItem('fallback', 'KH0000000403')], []);
        expect(h.calls).toHaveLength(1);
        expect(h.calls[0]).toMatchObject({ itemId: 'fallback', code: 'KH0000000403', closed: true });
    });

    it('បិទតាម ZTO ៖ បញ្ជី Palm បិទកញ្ចប់ដែលមាន ហើយពិនិត្យ track សម្រាប់កញ្ចប់នៅសល់', async () => {
        const fetch = vi.fn(async (url: string, _init?: RequestInit) => {
            const u = new URL(url);
            if (u.searchParams.get('list') === '1' && u.searchParams.get('signed') === '1') {
                return json({ success: true, list: true, enabled: true, kind: 'signed', rows: [], pages: 1, total: 1, signed: ['KH0000000401'], signedOk: true, signedRows: [] });
            }
            return json({ found: true, ztoClosed: null });
        });
        vi.stubGlobal('fetch', fetch);
        await runZtoStatusSweep(true, [openItem('a1', 'KH0000000401'), openItem('a2', 'KH0000000402')], []);
        const urls = fetch.mock.calls.map((c) => new URL(String(c[0])));
        expect(urls.length).toBeGreaterThan(0);
        for (const u of urls) {
            expect(u.searchParams.get('palm')).toBe('1');
            expect(u.searchParams.get('list') === '1' || u.searchParams.get('status') === '1').toBe(true);
        }
        expect(urls.filter((u) => u.searchParams.get('status') === '1').map((u) => u.searchParams.get('barcode'))).toEqual(['KH0000000402']);
        const headers = (fetch.mock.calls[0] as any[])[1].headers;
        expect(headers).toMatchObject({ 'X-Zoe-Palm-Token': SESSION, 'X-Zoe-Proxy-Key': PROXY, 'X-Zoe-Id-Token': 'audit-token' });
        expect(h.calls.map((c) => c.code)).toEqual(['KH0000000401']);
        expect(h.calls[0]).toMatchObject({ itemId: 'a1', closed: true });
    });

});

describe('Palm ៖ ទាញបញ្ជី ZTO ដូច Cookie ដោយ track ផ្ទៀងមកដល់', () => {
    it('កុងតាក់ និងប៊ូតុង 📥 Palm បើក និងអាចបិទ/បើកវិញ', () => {
        expect(ztoListSyncEnabled()).toBe(true);
        refreshZtoListSyncUi();
        expect(viewState.ztoListSyncBtnVisible).toBe(true);
        expect(viewState.ztoListSyncDrawerVisible).toBe(true);
        expect(ztoAutoCloseEnabled()).toBe(true);
        drawerZtoListSyncFlow();
        expect(appLocalStore.getItem('zoew_zto_listsync_v1')).toBe('0');
        drawerZtoListSyncFlow();
        expect(ztoListSyncEnabled()).toBe(true);
    });

    it('Palm អានគ្រប់ទំព័រ រួមទំព័រទទេក្រោយច្រោះ និងទំព័រលើសពិដាន Cookie', async () => {
        const fetch = vi.fn(async (url: string, _init?: RequestInit) => {
            const page = Number(new URL(url).searchParams.get('page'));
            return json({ success: true, list: true, enabled: true, kind: 'arrival', page, pages: 5,
                total: page === 5 ? 1 : 0, pageTotal: true, site: 'KH001', rows: page === 5
                    ? [{ barcode: 'KH0000000501', phone: '0960007345', cod: 2.5, dod: 0, at: '2026-10-05 09:00:00', ztoClosed: false, skip: '', from: '' }] : [],
                signed: [], signedOk: true, signedPages: 1, signedRows: [] });
        });
        vi.stubGlobal('fetch', fetch);
        await runZtoListSyncPreview();
        expect(fetch).toHaveBeenCalledTimes(5);
        expect(fetch.mock.calls.map((c) => Number(new URL(c[0]).searchParams.get('page'))).sort()).toEqual([1, 2, 3, 4, 5]);
        expect(ztoState.ztoListSyncResult).toMatchObject({ total: 1, truncated: false });
        expect(ztoState.ztoListSyncResult.rows.map((r: any) => r.barcode)).toEqual(['KH0000000501']);
    });

    it('បើកប្រអប់បញ្ជី Palm ➜ ដំណើរការដូច Cookie', () => {
        registerModalMeta('ztoListSyncModal', { close: 'closeZtoListSyncModal' });
        try {
            openZtoListSyncModal();
            expect(uiState.modalDisplay.ztoListSyncModal).toBe('flex');
        } finally { unregisterModalMeta('ztoListSyncModal'); }
    });
});

describe('Palm warms the Function like Cookie mode (owner report: Palm lookup slower than Cookie)', () => {
    it('Palm ➜ OPTIONS with palm=1 (the Function skips the Argus Cookie read) · no proxy key · no session', async () => {
        lookupState.ztoWarmupAt = 0;
        lookupState.ztoWarmupInFlight = false;
        const fetch = vi.fn(async (_url: string, _init?: RequestInit) => new Response(null, { status: 204 }));
        vi.stubGlobal('fetch', fetch);
        expect(warmZtoLookupProxyIfConfigured(getLookupApiConfig())).toBe(true);
        await vi.waitFor(() => expect(lookupState.ztoWarmupInFlight).toBe(false));
        expect(fetch).toHaveBeenCalledTimes(1);
        const [url, init] = fetch.mock.calls[0] as any[];
        const u = new URL(String(url), window.location.href);
        expect(u.pathname).toBe('/.netlify/functions/zto-order-detail');
        expect(u.searchParams.get('palm')).toBe('1');
        expect(u.searchParams.get('barcode')).toBeNull();
        expect(init.method).toBe('OPTIONS');
        expect(JSON.stringify(init.headers || {})).not.toContain(SESSION);
        expect(JSON.stringify(init.headers || {})).not.toContain(PROXY);
        expect(warmZtoLookupProxyIfConfigured(getLookupApiConfig())).toBe(false);
    });

    it('reverse: Cookie (Argus) mode warms without palm=1, so the Function still reads its Cookie ahead', async () => {
        lookupState.ztoWarmupAt = 0;
        lookupState.ztoWarmupInFlight = false;
        const fetch = vi.fn(async (_url: string, _init?: RequestInit) => new Response(null, { status: 204 }));
        vi.stubGlobal('fetch', fetch);
        const cfg = { ...getLookupApiConfig(), url: window.location.origin + '/.netlify/functions/zto-order-detail?barcode={barcode}' };
        expect(warmZtoLookupProxyIfConfigured(cfg)).toBe(true);
        await vi.waitFor(() => expect(lookupState.ztoWarmupInFlight).toBe(false));
        const u = new URL(String((fetch.mock.calls[0] as any[])[0]), window.location.href);
        expect(u.pathname).toBe('/.netlify/functions/zto-order-detail');
        expect(u.search).toBe('');
    });
});
