/**
 * ⛔ ZTO-E6 ៖ របា «N កញ្ចប់បិទក្នុង ZoeW តែ ZTO មិនទាន់បិទ» ត្រូវរលត់ពេល ZTO ចុះហត្ថលេខា (ZTO Palm) ដោយមិនរង់ចាំការចុច។
 *
 * មុនកែ ៖ សាលក្រម `false` (`zoew_zto_pickup_status_v1`) របស់កញ្ចប់ដែលបិទក្នុង ZoeW នៅជាប់ ទោះ ZTO ចុះហត្ថលេខារួច ព្រោះ
 * `closeZtoSignedBarcodes()` មើលតែកញ្ចប់ **បើក** · ជុំធម្មតាមិនសួរកញ្ចប់បិទដែលមាន `false` ម្តងទៀត (តែការចុច) ·
 * ជុំបញ្ជីចុះហត្ថលេខារត់តែពេលមានកញ្ចប់បើកយ៉ាងហោចណាស់ ១។
 *
 * ច្បាប់ ៖ កញ្ចប់បិទក្នុង ZoeW (ប្រវត្តិ ឬធុងសំរាម «យករួច» ដែល `ztoStatusTrashItemCounts()` រាប់) + `false` + មានក្នុងបញ្ជី
 * ចុះហត្ថលេខាដែលជុំទាញ ➜ កត់ `true` (គ្មានការសួរ `/detail` ថែម) ➜ របា/ប្រអប់គូរឡើងវិញ។ ជុំបញ្ជីរត់ដែរពេលគ្មានកញ្ចប់បើក
 * តែមាន `false` — ក្រោមច្រកទ្វារដដែល (`ztoAutoCloseEnabled()` · ចន្លោះ · `ztoStatusNetworkAllowed()`)។ សាលក្រមនៅតែក្នុង
 * `localStorage` ប៉ុណ្ណោះ (លុយ · `isDeducted` · Firebase មិនប៉ះ)។ ⛔ E1 ៖ ជុំដែលគ្មានកញ្ចប់បើក មិនរាប់ជាការអានពេញលេញ
 * (`ztoSignedCompleteAt` · `ztoSignedSweepOkAt`) ព្រោះសំណុំកញ្ចប់បើកមិនទាន់ត្រូវបានវាស់ (ឧ. ប្រវត្តិមិនទាន់មកដល់)។
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dataState, firebaseState, uiState, ztoState } from '../src/core/state';
import { appLocalStore } from '../src/core/storage';
import { getZoneDateKey } from '../src/core/timezone';
import { cleanupInFlight, runAutomaticCleanupRules } from '../src/domain/cleanup';
import { clearCustomerDataTableCache } from '../src/features/customer-table';
import {
    ZTO_SIGNED_SWEEP_GAP_MS, ZTO_STATUS_SWEEP_GAP_MS, clearZtoPickupStatusStore, closeZtoSignedBarcodes, openZtoSyncModal,
    recheckZtoPickupStatus, renderZtoSyncViews, runZtoStatusSweep, setZtoPickupVerdict, ztoPickupStatus, ztoSyncModalIsOpen
} from '../src/features/zto-status';

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
        const item = dataState.scanHistory.find((i: any) => i && i.id === itemId);
        const b = item && item.barcodes.find((x: any) => x.code === code);
        if (b) {
            b.isClosed = closed;
            b.closedAt = Date.now();
            item.isClosed = item.barcodes.every((x: any) => x.isClosed);
            if (item.isClosed) item.closedAt = Date.now();
        }
        return true;
    }
}));

const NOW = Date.UTC(2026, 9, 6, 3, 0, 0);
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const FAILED_TOAST = '⚠️ ពិនិត្យស្ថានភាពនៅ ZTO មិនបាន';

let tx: string[] = [];

function openItem(id: string, code: string, ageMs: number) {
    return { id, phone: '0963897345', scanDate: getZoneDateKey(NOW - ageMs, 0), isClosed: false, createdAt: NOW - ageMs,
        cod: 1, dod: 0, count: 1, barcode: code, barcodes: [{ code, isClosed: false, cod: 1, dod: 0 }] };
}

function closedItem(id: string, code: string) {
    return { id, phone: '0963897345', scanDate: getZoneDateKey(NOW, 0), isClosed: true, closedAt: NOW - 60000, createdAt: NOW - HOUR,
        cod: 1, dod: 0, count: 1, barcode: code, barcodes: [{ code, isClosed: true, closedAt: NOW - 60000, cod: 1, dod: 0 }] };
}

function pickupTrash(id: string, code: string, deletedAgoMs: number) {
    return Object.assign(closedItem(id, code), { trashReason: 'pickup', isFromDeletion: true, deletedAt: NOW - deletedAgoMs });
}

function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((yes) => { resolve = yes; });
    return { promise, resolve };
}

type SignedSource = string[] | ((from: string, to: string) => string[]);

function server(signed: SignedSource, detail?: (code: string) => Response | Promise<Response>) {
    const log = { signed: [] as string[], detail: [] as string[] };
    const fetch = vi.fn(async (u: string) => {
        const url = new URL(String(u));
        if (url.searchParams.get('signed') === '1') {
            const from = String(url.searchParams.get('from'));
            const to = String(url.searchParams.get('to'));
            log.signed.push(from + '..' + to);
            const codes = typeof signed === 'function' ? signed(from, to) : signed;
            return json({ success: true, list: true, enabled: true, kind: 'signed', page: 1, pages: 1, total: codes.length,
                rows: [], otherScans: 0, signedScans: codes.length, signed: codes, signedOk: true });
        }
        const code = String(url.searchParams.get('barcode'));
        log.detail.push(code);
        return detail ? detail(code) : json({ found: true, ztoClosed: null });
    });
    vi.stubGlobal('fetch', fetch);
    return log;
}

function verdictOf(code: string) {
    const entry = ztoPickupStatus.get(code);
    return entry ? entry.closed : undefined;
}

function bannerHeadline() {
    return ztoState.ztoBannerView ? String(ztoState.ztoBannerView.headline) : '';
}

function abandoned(id: string) {
    return tx.includes('zoew_scan_history_cod_dod/' + id);
}

function cleanupNow() {
    cleanupInFlight.clear();
    runAutomaticCleanupRules();
}

function advance(ms: number) {
    vi.setSystemTime(new Date(Date.now() + ms));
}

function toastTexts() {
    return uiState.toasts.map((t: any) => String(t.msg));
}

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(NOW));
    appLocalStore.clear();
    appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify({ enabled: true, fastMode: true,
        url: 'https://example.invalid/.netlify/functions/zto-order-detail?barcode={barcode}' }));
    clearCustomerDataTableCache();
    clearZtoPickupStatusStore();
    h.calls.length = 0;
    tx = [];
    cleanupInFlight.clear();
    ztoState.ztoStatusInFlight = false;
    dataState.scanHistory = [];
    dataState.deletedItems = [];
    uiState.isModalOpen = false;
    uiState.modalDisplay = {};
    uiState.toasts = [];
    firebaseState.authGeneration++;
    firebaseState.serverTimeOffsetMs = 0;
    firebaseState.serverClockTrusted = true;
    firebaseState.isDatabaseConnected = true;
    firebaseState.auth = { currentUser: { uid: 'audit-user' } } as any;
    firebaseState.db = { name: 'audit-db' } as any;
    firebaseState.fb = {
        ref: (_db: unknown, path: string) => ({ path }),
        runTransaction: (ref: { path: string }) => {
            tx.push(ref.path);
            return Promise.reject(Object.assign(new Error('audit: not applied'), { txOutcome: 'not-applied' }));
        },
        getIdTokenResult: async () => ({ token: 'audit-token' })
    } as any;
    vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    appLocalStore.clear();
    firebaseState.db = null as any;
    firebaseState.fb = null as any;
    firebaseState.serverClockTrusted = false;
    firebaseState.isDatabaseConnected = false;
});

describe('ZTO-E6 ៖ របា «ZTO មិនទាន់បិទ» រលត់ពេលកញ្ចប់មានក្នុងបញ្ជីចុះហត្ថលេខា', () => {
    it('កញ្ចប់បិទក្នុងប្រវត្តិ + false + មានក្នុងបញ្ជី ➜ true · របារលត់ · គ្មាន /detail សម្រាប់វា', async () => {
        dataState.scanHistory = [closedItem('c1', 'ZTE6A00001'), openItem('o1', 'ZTE6A00002', DAY)];
        setZtoPickupVerdict('ZTE6A00001', false);
        renderZtoSyncViews();
        expect(bannerHeadline(), 'លក្ខខណ្ឌចាំបាច់ ៖ របាលេចមុនជុំ').toContain('1 កញ្ចប់');
        const log = server(['ZTE6A00001']);
        await runZtoStatusSweep(false);
        expect(log.signed).toHaveLength(1);
        expect(verdictOf('ZTE6A00001')).toBe(true);
        expect(ztoState.ztoBannerView).toBeNull();
        expect(log.detail).not.toContain('ZTE6A00001');
        expect(h.calls.map((c) => c.code), 'កញ្ចប់បិទរួចមិនត្រូវបិទម្តងទៀត').toEqual([]);
    });

    it('គ្មានកញ្ចប់បើកសោះ (ចុងថ្ងៃ) ៖ ជុំបញ្ជីចុះហត្ថលេខានៅតែរត់សម្រាប់សាលក្រម false', async () => {
        dataState.scanHistory = [closedItem('c1', 'ZTE6B00001')];
        setZtoPickupVerdict('ZTE6B00001', false);
        renderZtoSyncViews();
        expect(bannerHeadline()).toContain('1 កញ្ចប់');
        const log = server(['ZTE6B00001']);
        await runZtoStatusSweep(false);
        expect(log.signed).toHaveLength(1);
        expect(log.detail).toEqual([]);
        expect(verdictOf('ZTE6B00001')).toBe(true);
        expect(ztoState.ztoBannerView).toBeNull();
    });

    it('ធុងសំរាម «យករួច» (≤ ១២ ម៉ោង) ក៏រលត់ដូចគ្នា', async () => {
        dataState.deletedItems = [pickupTrash('t1', 'ZTE6C00001', 3 * HOUR)];
        setZtoPickupVerdict('ZTE6C00001', false);
        renderZtoSyncViews();
        expect(bannerHeadline()).toContain('1 កញ្ចប់');
        const log = server(['ZTE6C00001']);
        await runZtoStatusSweep(false);
        expect(log.signed).toHaveLength(1);
        expect(verdictOf('ZTE6C00001')).toBe(true);
        expect(ztoState.ztoBannerView).toBeNull();
    });

    it('ការចុច «ពិនិត្យម្តងទៀត» ៖ ភស្តុតាងក្នុងបញ្ជីរាប់ជាការវាស់ (គ្មាន /detail ថែម) · ប្រអប់បញ្ជីគូរឡើងវិញ · គ្មាន toast «មិនបាន»', async () => {
        dataState.scanHistory = [closedItem('c1', 'ZTE6D00001'), openItem('o1', 'ZTE6D00002', DAY)];
        setZtoPickupVerdict('ZTE6D00001', false);
        openZtoSyncModal();
        uiState.modalDisplay = Object.assign({}, uiState.modalDisplay, { ztoSyncModal: 'flex' });
        expect(ztoSyncModalIsOpen(), 'លក្ខខណ្ឌចាំបាច់ ៖ ប្រអប់បើក').toBe(true);
        expect(ztoState.ztoSyncListView.entries.map((e: any) => e.code)).toEqual(['ZTE6D00001']);
        const log = server(['ZTE6D00001'], () => json({ error: 'down' }, 503));
        await recheckZtoPickupStatus();
        expect(log.signed).toHaveLength(1);
        expect(log.detail, 'ភស្តុតាងក្នុងបញ្ជីគ្រប់គ្រាន់ ➜ មិនសួរ /detail ម្តងទៀត').not.toContain('ZTE6D00001');
        expect(verdictOf('ZTE6D00001')).toBe(true);
        expect(ztoState.ztoSyncListView.entries).toEqual([]);
        expect(toastTexts().filter((t) => t.indexOf(FAILED_TOAST) === 0)).toEqual([]);
    });

    it('របាគូរឡើងវិញភ្លាមក្រោយជុំបញ្ជី (មិនរង់ចាំ /detail ដែលយឺត)', async () => {
        dataState.scanHistory = [closedItem('c1', 'ZTE6F00001'), closedItem('c2', 'ZTE6F00002')];
        setZtoPickupVerdict('ZTE6F00001', false);
        renderZtoSyncViews();
        expect(bannerHeadline()).toContain('1 កញ្ចប់');
        const slow = deferred<Response>();
        const log = server(['ZTE6F00001'], () => slow.promise);
        const running = runZtoStatusSweep(false);
        await vi.waitFor(() => expect(log.detail).toEqual(['ZTE6F00002']));
        expect(verdictOf('ZTE6F00001')).toBe(true);
        expect(ztoState.ztoBannerView, 'របារលត់មុន /detail ឆ្លើយ').toBeNull();
        slow.resolve(json({ found: true, ztoClosed: true }));
        await running;
        expect(ztoState.ztoBannerView).toBeNull();
    });

    it('ទិសផ្ទុយ ៖ មិនមានក្នុងបញ្ជី ➜ false នៅដដែល · របានៅ', async () => {
        dataState.scanHistory = [closedItem('c1', 'ZTE6G00001')];
        setZtoPickupVerdict('ZTE6G00001', false);
        renderZtoSyncViews();
        server(['ZTE6G99999']);
        await runZtoStatusSweep(false);
        expect(verdictOf('ZTE6G00001')).toBe(false);
        expect(bannerHeadline()).toContain('1 កញ្ចប់');
    });

    it('ចន្លោះ ZTO_SIGNED_SWEEP_GAP_MS គោរពដែរសម្រាប់ជុំដែលមានតែសាលក្រម false', async () => {
        dataState.scanHistory = [closedItem('c1', 'ZTE6H00001')];
        setZtoPickupVerdict('ZTE6H00001', false);
        const log = server([]);
        await runZtoStatusSweep(false);
        expect(log.signed).toHaveLength(1);
        advance(ZTO_STATUS_SWEEP_GAP_MS + 1000);
        await runZtoStatusSweep(false);
        expect(log.signed, 'មុនចន្លោះ ➜ មិនសួរម្តងទៀត').toHaveLength(1);
        advance(ZTO_SIGNED_SWEEP_GAP_MS);
        await runZtoStatusSweep(false);
        expect(log.signed).toHaveLength(2);
        expect(log.detail).toEqual([]);
    });

    it('ទិសផ្ទុយ ៖ កុងតាក់ «បិទតាម ZTO» បិទ ឬ Fast Mode បិទ ➜ មិនសួរបញ្ជី · ការចុចរបានៅសួរ /detail ដដែល', async () => {
        appLocalStore.setItem('zoew_zto_autoclose_v1', '0');
        dataState.scanHistory = [closedItem('c1', 'ZTE6I00001')];
        setZtoPickupVerdict('ZTE6I00001', false);
        const log = server(['ZTE6I00001'], () => json({ found: true, ztoClosed: true }));
        await runZtoStatusSweep(false);
        expect(log.signed).toEqual([]);
        expect(verdictOf('ZTE6I00001')).toBe(false);
        await runZtoStatusSweep(true);
        expect(log.signed).toEqual([]);
        expect(log.detail).toEqual(['ZTE6I00001']);
        expect(verdictOf('ZTE6I00001')).toBe(true);
        appLocalStore.setItem('zoew_zto_autoclose_v1', '1');
        appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify({ enabled: true, fastMode: false,
            url: 'https://example.invalid/.netlify/functions/zto-order-detail?barcode={barcode}' }));
        setZtoPickupVerdict('ZTE6I00001', false);
        ztoState.ztoStatusLastSweepAt = 0;
        await runZtoStatusSweep(false);
        expect(log.signed).toEqual([]);
        expect(verdictOf('ZTE6I00001')).toBe(false);
    });

    it('ទិសផ្ទុយ ៖ ក្រៅបណ្តាញ ➜ ជុំស្វ័យប្រវត្តិមិនសួរបញ្ជី', async () => {
        dataState.scanHistory = [closedItem('c1', 'ZTE6J00001')];
        setZtoPickupVerdict('ZTE6J00001', false);
        const log = server(['ZTE6J00001']);
        const online = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(navigator), 'onLine');
        Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
        try {
            await runZtoStatusSweep(false);
        } finally {
            delete (navigator as any).onLine;
            if (online && !Object.getOwnPropertyDescriptor(Object.getPrototypeOf(navigator), 'onLine')) {
                Object.defineProperty(Object.getPrototypeOf(navigator), 'onLine', online);
            }
        }
        expect(navigator.onLine).not.toBe(false);
        expect(log.signed).toEqual([]);
        expect(verdictOf('ZTE6J00001')).toBe(false);
    });

    it('ប្រអប់បើក (កំពុងស្កេន) ➜ បញ្ជីចុះហត្ថលេខានៅតែអាន (ល្បឿនបិទតាម ZTO) ➜ របារលត់ · /detail មិនហៅ', async () => {
        dataState.scanHistory = [closedItem('c1', 'ZTE6J00002')];
        setZtoPickupVerdict('ZTE6J00002', false);
        const log = server(['ZTE6J00002']);
        uiState.isModalOpen = true;
        try {
            await runZtoStatusSweep(false);
        } finally {
            uiState.isModalOpen = false;
        }
        expect(log.signed.length).toBe(1);
        expect(log.detail).toEqual([]);
        expect(verdictOf('ZTE6J00002')).toBe(true);
    });

    it('closeZtoSignedBarcodes() គ្មានធាតុ (បើក ឬ false) ➜ មិនហៅបណ្តាញ · មិនប៉ះចន្លោះ', async () => {
        const log = server(['ZTE6K00001']);
        const cfg = JSON.parse(appLocalStore.getItem('zoew_lookup_api_config')!);
        const out = await closeZtoSignedBarcodes(cfg, [], [], false, []);
        expect(out.closed).toBe(0);
        const odd = await closeZtoSignedBarcodes(cfg, null, null, false, null);
        expect(odd.closed + odd.flipped).toBe(0);
        expect(log.signed).toEqual([]);
        expect(ztoState.ztoSignedSweepAt).toBe(0);
    });

    it('closeZtoSignedBarcodes() មានតែ false (បញ្ជីបើក null) ➜ កត់ true · មិនបោះ', async () => {
        setZtoPickupVerdict('ZTE6K00002', false);
        const log = server(['ZTE6K00002']);
        const cfg = JSON.parse(appLocalStore.getItem('zoew_lookup_api_config')!);
        const out = await closeZtoSignedBarcodes(cfg, null, null, false, [{ key: 'ZTE6K00002', code: 'ZTE6K00002' }]);
        expect(log.signed).toHaveLength(1);
        expect(out.flipped).toBe(1);
        expect(verdictOf('ZTE6K00002')).toBe(true);
    });

    it('ការកត់ true លើកញ្ចប់បិទ មិនប្តូរការសម្រេចបិទកញ្ចប់បើកក្នុងជុំដដែល (barcode ដដែលស្កេនម្តងទៀតក្រោយយករួច)', async () => {
        const run = async (withTrash: boolean) => {
            clearZtoPickupStatusStore();
            h.calls.length = 0;
            dataState.scanHistory = [openItem('re1', 'ZTE6N00001', HOUR)];
            dataState.deletedItems = withTrash ? [pickupTrash('t1', 'ZTE6N00001', 3 * HOUR)] : [];
            if (withTrash) setZtoPickupVerdict('ZTE6N00001', false);
            server(['ZTE6N00001']);
            await runZtoStatusSweep(false);
            return h.calls.map((c) => c.code);
        };
        const without = await run(false);
        expect(without, 'លក្ខខណ្ឌចាំបាច់ ៖ ជុំធម្មតាបិទកញ្ចប់បើកដែលមានក្នុងបញ្ជី').toEqual(['ZTE6N00001']);
        expect(await run(true)).toEqual(without);
    });

    it('⛔ ចម្លើយយឺតក្រោយចាកចេញ មិនកត់ true ចូលវគ្គថ្មី', async () => {
        dataState.scanHistory = [closedItem('c1', 'ZTE6L00001')];
        setZtoPickupVerdict('ZTE6L00001', false);
        const late = deferred<Response>();
        const fetch = vi.fn(() => late.promise);
        vi.stubGlobal('fetch', fetch);
        const running = runZtoStatusSweep(false);
        await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
        clearZtoPickupStatusStore();
        setZtoPickupVerdict('ZTE6L00001', false);
        late.resolve(json({ success: true, list: true, enabled: true, kind: 'signed', page: 1, pages: 1, total: 1,
            rows: [], otherScans: 0, signedScans: 1, signed: ['ZTE6L00001'], signedOk: true }));
        await running;
        expect(verdictOf('ZTE6L00001')).toBe(false);
    });
});

describe('⛔ E1 ៖ ជុំដែលគ្មានកញ្ចប់បើក មិនមែនជាការអានពេញលេញ', () => {
    it('ប្រវត្តិមិនទាន់មក ៖ ជុំ false-only មិនដោះលែងការរង់ចាំ ៧ ថ្ងៃ និងមិនរួមតូចជួរថ្ងៃ ➜ កញ្ចប់ចាស់ដែលចុះហត្ថលេខាបិទ (មិនដកលុយ)', async () => {
        const signedOn = getZoneDateKey(NOW - 9 * DAY, 0);
        dataState.deletedItems = [pickupTrash('t1', 'ZTE6E00001', HOUR)];
        setZtoPickupVerdict('ZTE6E00001', false);
        const log = server((from, to) => (from <= signedOn && signedOn <= to ? ['ZTE6E00001', 'ZTE6E00002'] : ['ZTE6E00001']));
        await runZtoStatusSweep(false);
        expect(log.signed).toHaveLength(1);
        expect(verdictOf('ZTE6E00001')).toBe(true);
        expect(ztoState.ztoSignedCompleteAt, 'គ្មានកញ្ចប់បើកត្រូវវាស់ ➜ មិនមែនការអានពេញលេញ').toBe(0);
        expect(ztoState.ztoSignedSweepOkAt, 'ជួរថ្ងៃមិនរួមតូច').toBe(0);
        dataState.scanHistory = [openItem('old', 'ZTE6E00002', 10 * DAY)];
        cleanupNow();
        expect(abandoned('old'), 'ប្រវត្តិទើបមក ➜ រង់ចាំជុំបញ្ជី').toBe(false);
        advance(ZTO_SIGNED_SWEEP_GAP_MS + 1000);
        await runZtoStatusSweep(false);
        expect(log.signed).toHaveLength(2);
        expect(h.calls.map((c) => c.code), 'ជួរ ៖ ' + log.signed.join(' | ')).toEqual(['ZTE6E00002']);
        cleanupNow();
        expect(abandoned('old'), 'ចុះហត្ថលេខា ➜ បិទ «យករួច» មិនមែន expired').toBe(false);
    });

    it('ទិសផ្ទុយ ៖ ជុំដែលមានកញ្ចប់បើក ហើយអានពេញលេញ ➜ នៅតែរាប់ជាការអានពេញលេញ (ទោះមាន false ផង)', async () => {
        dataState.scanHistory = [closedItem('c1', 'ZTE6M00001'), openItem('o1', 'ZTE6M00002', DAY)];
        setZtoPickupVerdict('ZTE6M00001', false);
        server(['ZTE6M00001']);
        await runZtoStatusSweep(false);
        expect(verdictOf('ZTE6M00001')).toBe(true);
        expect(ztoState.ztoSignedCompleteAt).toBe(NOW);
        expect(ztoState.ztoSignedSweepOkAt).toBe(NOW);
    });
});
