/**
 * ZTO Palm ពេញ (សំណើម្ចាស់គម្រោង) ៖ «ទាញបញ្ជីកញ្ចប់ពី ZTO» និង «បិទតាម ZTO ស្វ័យប្រវត្តិ» ដំណើរការក្នុងរបៀប Palm ៖
 * - URL បញ្ជីរក្សា `palm=1` ➜ Function អាន `queryDispatchList` របស់ Palm (`billStatus` ៤ · ៥) មិនមែន Argus/Cookie
 * - សំណើបញ្ជីផ្ញើ session Palm (`X-Zoe-Palm-Token`) និងគណនី ZoeW (`X-Zoe-Id-Token`)
 * - ជុំបិទតាម ZTO អានបញ្ជី «ចុះហត្ថលេខា» Palm ➜ បិទកញ្ចប់ដែលមាន · ⛔ មិនហៅ `/detail` ម្តងមួយៗ (`billInfoQuery` គ្មានស្ថានភាព)
 */
import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { refTo } from '../src/app/refs';
import { dataState, firebaseState, securityState, uiState, ztoState } from '../src/core/state';
import { appLocalStore } from '../src/core/storage';
import { clearCustomerDataTableCache } from '../src/features/customer-table';
import { buildZtoListApiUrl, runZtoListSyncPreview } from '../src/features/zto-list-sync';
import { clearZtoPickupStatusStore, runZtoStatusSweep, ztoAutoCloseEnabled, ztoFastModeIsOn, ztoStatusFeatureConfig } from '../src/features/zto-status';
import { encryptLookupSecret } from '../src/services/crypto';

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

describe('ZTO Palm ពេញ ៖ បញ្ជី · ចុះហត្ថលេខា · បិទស្វ័យប្រវត្តិ', () => {
    it('Palm config ➜ ☰ ZTO (ទាញបញ្ជី · បិទតាម ZTO) បើក ដូចរបៀប Argus', () => {
        expect(ztoFastModeIsOn()).toBe(true);
        expect(ztoStatusFeatureConfig()).toMatchObject({ url: PALM_URL });
        expect(ztoAutoCloseEnabled()).toBe(true);
    });

    it('URL បញ្ជីរក្សា palm=1 ➜ Function អានបញ្ជី Palm (មិនមែន Argus)', () => {
        const url = new URL(buildZtoListApiUrl({ url: PALM_URL }, '2026-10-03', '2026-10-06', 1, 'withSigned'));
        expect(url.searchParams.get('palm')).toBe('1');
        expect(url.searchParams.get('list')).toBe('1');
        expect(url.searchParams.get('withSigned')).toBe('1');
        const argus = new URL(buildZtoListApiUrl({ url: window.location.origin + '/.netlify/functions/zto-order-detail?barcode={barcode}' }, '2026-10-03', '2026-10-06', 1));
        expect(argus.searchParams.get('palm')).toBeNull();
    });

    it('បិទតាម ZTO ៖ អានបញ្ជីចុះហត្ថលេខា Palm ជាមួយ session ➜ បិទកញ្ចប់ដែលមាន · ⛔ មិនហៅ /detail', async () => {
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
            expect(u.searchParams.get('list')).toBe('1');
            expect(u.searchParams.get('barcode')).toBeNull();
        }
        const headers = (fetch.mock.calls[0] as any[])[1].headers;
        expect(headers).toMatchObject({ 'X-Zoe-Palm-Token': SESSION, 'X-Zoe-Proxy-Key': PROXY, 'X-Zoe-Id-Token': 'audit-token' });
        expect(h.calls.map((c) => c.code)).toEqual(['KH0000000401']);
        expect(h.calls[0]).toMatchObject({ itemId: 'a1', closed: true });
    });

    it('ទាញបញ្ជី ៖ ទំព័រ ១ សុំ withSigned តាម Palm ➜ ជួរមកដល់ចូលលទ្ធផល', async () => {
        const fetch = vi.fn(async (_url: string, _init?: RequestInit) => json({ success: true, list: true, enabled: true, kind: 'arrival', page: 1, pages: 1, total: 1, site: 'KH001',
            rows: [{ barcode: 'KH0000000501', phone: '0960007345', cod: 2.5, dod: 0, at: '2026-10-05 09:00:00', ztoClosed: false, skip: '', from: '' }],
            signed: [], signedOk: true, signedPages: 1, signedRows: [] }));
        vi.stubGlobal('fetch', fetch);
        await runZtoListSyncPreview();
        const u = new URL(String(fetch.mock.calls[0][0]));
        expect(u.searchParams.get('palm')).toBe('1');
        expect(u.searchParams.get('withSigned')).toBe('1');
        expect((fetch.mock.calls[0] as any[])[1].headers).toMatchObject({ 'X-Zoe-Palm-Token': SESSION });
        expect(ztoState.ztoListSyncResult.rows.map((r: any) => r.barcode)).toEqual(['KH0000000501']);
    });
});
