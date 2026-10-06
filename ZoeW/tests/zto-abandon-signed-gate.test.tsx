/**
 * ⛔ ZTO-E1 (លុយ) ៖ ការសម្អាត ៧ ថ្ងៃ (`claimAndCleanupItem('abandon')` ➜ `expired` ➜ **ដកលុយ**) ត្រូវរង់ចាំការអានបញ្ជី
 * «ចុះហត្ថលេខា» (ZTO Palm) ដែលពេញលេញ មុនដកកញ្ចប់ដែលអតិថិជនយករួច។
 *
 * មុនកែ ៖ បើក App ក្រោយបិទច្រើនថ្ងៃ ➜ snapshot ប្រវត្តិមកដល់ ➜ `runAutomaticCleanupRules()` រត់ភ្លាម (debounce 120ms) ➜ កញ្ចប់អាយុ ៨ ថ្ងៃ
 * ដែល ZTO ចុះហត្ថលេខារួចត្រូវដកលុយ មុនជុំបិទតាម ZTO (`closeZtoSignedBarcodes()` ក្រោយ 1.5 វិ.) បានអានបញ្ជី ➜ ជុំបិទមិនប៉ះធុងសំរាម។
 *
 * ច្បាប់ ៖ កុងតាក់ «បិទតាម ZTO ស្វ័យប្រវត្តិ» បើក + ZTO កំណត់រួច ➜ `abandon` រង់ចាំជុំអានបញ្ជីចុះហត្ថលេខាដែល **ពេញលេញ** (វាស់បាន · មិនខ្វះទំព័រ ·
 * គ្មានកញ្ចប់ត្រូវគ្នាដែលនៅរង់ចាំបិទ) ថ្មីៗ ➜ កញ្ចប់ក្នុងបញ្ជី ➜ បិទ «យករួច» (លុយមិនដក) · ក្រៅបញ្ជី ➜ ផុតកំណត់ធម្មតា។ ZTO មិនឆ្លើយ ➜ រង់ចាំ
 * ≤ `ZTO_ABANDON_HOLD_MAX_MS` ក្នុងមួយវគ្គ (មិនជាប់រហូត)។ ⛔ ការសម្អាត ២ ម៉ោងមិនរង់ចាំ · ⛔ ថេរ `ABANDON_AGE_MS` និង `>` មិនប្រែ។
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dataState, firebaseState, uiState, ztoState } from '../src/core/state';
import { appLocalStore } from '../src/core/storage';
import { getZoneDateKey } from '../src/core/timezone';
import { cleanupInFlight, runAutomaticCleanupRules } from '../src/domain/cleanup';
import { clearCustomerDataTableCache } from '../src/features/customer-table';
import {
    ZTO_ABANDON_HOLD_MAX_MS, ZTO_SIGNED_FRESH_MS, ZTO_SIGNED_SWEEP_MAX_DAYS, ZTO_STATUS_SWEEP_BATCH, ZTO_STATUS_SWEEP_GAP_MS,
    clearZtoPickupStatusStore, runZtoStatusSweep, ztoAbandonCleanupIsHeld, ztoSignedSweepIsDue
} from '../src/features/zto-status';
import * as ztoStatusModule from '../src/features/zto-status';

const h = vi.hoisted(() => ({ calls: [] as any[], ok: true as any }));
vi.mock('../src/features/barcode-ops', () => ({
    openViewListModal: () => {},
    removeSingleBarcode: async () => 'failed',
    toggleIndividualBarcodeClose: async () => false,
    openEditBarcodePriceModal: () => {},
    closeEditBarcodeModal: () => {},
    saveEditedBarcodePrice: () => {},
    applyBarcodeCloseChange: async (itemId: string, code: string, closed: boolean, opts: any) => {
        h.calls.push({ itemId, code, closed, opts });
        if (h.ok === true) {
            const item = dataState.scanHistory.find((i: any) => i && i.id === itemId);
            const b = item && item.barcodes.find((x: any) => x.code === code);
            if (b) {
                b.isClosed = closed;
                b.closedAt = Date.now();
                item.isClosed = item.barcodes.every((x: any) => x.isClosed);
                if (item.isClosed) item.closedAt = Date.now();
            }
        }
        return h.ok;
    }
}));

const NOW = Date.UTC(2026, 9, 6, 3, 0, 0);
const DAY = 24 * 60 * 60 * 1000;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

let tx: string[] = [];

function openItem(id: string, code: string, ageMs: number) {
    return { id, phone: '0963897345', scanDate: getZoneDateKey(NOW - ageMs, 0), isClosed: false, createdAt: NOW - ageMs,
        cod: 1, dod: 0, count: 1, barcode: code, barcodes: [{ code, isClosed: false, cod: 1, dod: 0 }] };
}

function closedItem(id: string, code: string, closedAgoMs: number) {
    return { id, phone: '0963897345', scanDate: getZoneDateKey(NOW, 0), isClosed: true, closedAt: NOW - closedAgoMs, createdAt: NOW - DAY,
        cod: 1, dod: 0, count: 1, barcode: code, barcodes: [{ code, isClosed: true, closedAt: NOW - closedAgoMs, cod: 1, dod: 0 }] };
}

function signedPage(codes: string[], extra: any = {}) {
    return json(Object.assign({ success: true, list: true, enabled: true, kind: 'signed', page: 1, pages: 1, total: codes.length,
        rows: [], otherScans: 0, signedScans: codes.length, signed: codes, signedOk: true }, extra));
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

function runMinutes(ms: number) {
    for (let left = ms; left > 0; left -= 60000) {
        advance(Math.min(60000, left));
        cleanupNow();
    }
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
    h.ok = true;
    tx = [];
    cleanupInFlight.clear();
    ztoState.ztoStatusInFlight = false;
    dataState.scanHistory = [];
    dataState.deletedItems = [];
    uiState.isModalOpen = false;
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

describe('ZTO-E1 ៖ ការសម្អាត ៧ ថ្ងៃរង់ចាំបញ្ជី «ចុះហត្ថលេខា»', () => {
    it('បើក App ក្រោយបិទ ៨ ថ្ងៃ ៖ កញ្ចប់ក្នុងបញ្ជីចុះហត្ថលេខា ➜ បិទ «យករួច» (មិនដកលុយ) · កញ្ចប់ក្រៅបញ្ជី ➜ ផុតកំណត់ធម្មតា', async () => {
        dataState.scanHistory = [openItem('sig1', 'ZTE1000001', 8 * DAY), openItem('old1', 'ZTE1000002', 8 * DAY)];
        cleanupNow();
        expect(abandoned('sig1'), 'snapshot ដំបូងមិនត្រូវដកលុយមុនអានបញ្ជីចុះហត្ថលេខា').toBe(false);
        expect(abandoned('old1')).toBe(false);
        vi.stubGlobal('fetch', vi.fn(async () => signedPage(['ZTE1000001'])));
        await runZtoStatusSweep(false);
        expect(h.calls.map((c) => c.code)).toEqual(['ZTE1000001']);
        cleanupNow();
        expect(abandoned('sig1'), 'កញ្ចប់ដែល ZTO ចុះហត្ថលេខា ➜ បិទ មិនមែន expired').toBe(false);
        expect(abandoned('old1'), 'កញ្ចប់ក្រៅបញ្ជី ➜ ផុតកំណត់ធម្មតា').toBe(true);
    });

    it('កញ្ចប់ត្រូវគ្នាលើស ១ ជុំ (> ZTO_STATUS_SWEEP_BATCH) ៖ ការរង់ចាំនៅដដែលរហូតបិទគ្រប់', async () => {
        const n = ZTO_STATUS_SWEEP_BATCH + 2;
        const codes = Array.from({ length: n }, (_, i) => 'ZTE2' + String(i).padStart(6, '0'));
        dataState.scanHistory = codes.map((code, i) => openItem('b' + i, code, 9 * DAY));
        vi.stubGlobal('fetch', vi.fn(async () => signedPage(codes)));
        await runZtoStatusSweep(false);
        expect(h.calls.length).toBe(ZTO_STATUS_SWEEP_BATCH);
        cleanupNow();
        expect(codes.filter((_, i) => abandoned('b' + i)), 'ជួរនៅសល់ (more) មិនត្រូវដកលុយ').toEqual([]);
        advance(ZTO_STATUS_SWEEP_GAP_MS + 1000);
        await runZtoStatusSweep(false);
        expect(h.calls.length).toBe(n);
        cleanupNow();
        expect(codes.filter((_, i) => abandoned('b' + i))).toEqual([]);
    });

    it('ជួរថ្ងៃមិនរួមតូចមុនជុំពេញលេញ ៖ កញ្ចប់ដែលចុះហត្ថលេខាចាស់ (ក្រៅ ១ ថ្ងៃ) នៅជុំបន្ទាប់ (more) មិនត្រូវដកលុយ', async () => {
        const n = ZTO_STATUS_SWEEP_BATCH + 2;
        const codes = Array.from({ length: n }, (_, i) => 'ZTE2R' + String(i).padStart(5, '0'));
        const signedOn = getZoneDateKey(NOW - 9 * DAY, 0);
        dataState.scanHistory = codes.map((code, i) => openItem('rb' + i, code, 10 * DAY));
        const ranges: string[] = [];
        vi.stubGlobal('fetch', vi.fn(async (u: string) => {
            const url = new URL(String(u));
            const from = String(url.searchParams.get('from'));
            const to = String(url.searchParams.get('to'));
            ranges.push(from + '..' + to);
            return signedPage(from <= signedOn && signedOn <= to ? codes : []);
        }));
        await runZtoStatusSweep(false);
        expect(h.calls.length).toBe(ZTO_STATUS_SWEEP_BATCH);
        advance(ZTO_STATUS_SWEEP_GAP_MS + 1000);
        await runZtoStatusSweep(false);
        cleanupNow();
        expect(codes.filter((_, i) => abandoned('rb' + i)), 'ជុំទី ២ ត្រូវអានជួរដដែល ➜ បិទ ២ ដែលនៅសល់ (មិនដកលុយ) · ជួរ ៖ ' + ranges.join(' | ')).toEqual([]);
        expect(h.calls.length).toBe(n);
    });

    it('ZTO ធ្លាក់ ៖ រង់ចាំមិនលើស ZTO_ABANDON_HOLD_MAX_MS ហើយដើរធម្មតា (មិនជាប់រហូត)', async () => {
        dataState.scanHistory = [openItem('f1', 'ZTE3000001', 8 * DAY)];
        vi.stubGlobal('fetch', vi.fn(async () => json({ error: 'down' }, 503)));
        cleanupNow();
        await runZtoStatusSweep(false);
        expect(h.calls).toEqual([]);
        runMinutes(ZTO_ABANDON_HOLD_MAX_MS - 60000);
        expect(abandoned('f1'), 'នៅក្នុងពិដាន ➜ នៅរង់ចាំ (ការសម្អាតរត់រៀងរាល់នាទី)').toBe(false);
        runMinutes(2 * 60000);
        expect(abandoned('f1'), 'ហួសពិដាន ➜ ផុតកំណត់ធម្មតា').toBe(true);
    });

    it('ZTO ព្យួរ (fetch មិនឆ្លើយ) ៖ ការសម្អាតដើរវិញក្រោយពិដាន', async () => {
        dataState.scanHistory = [openItem('hang1', 'ZTE3000002', 8 * DAY)];
        vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
        cleanupNow();
        void runZtoStatusSweep(false);
        await Promise.resolve();
        cleanupNow();
        expect(abandoned('hang1')).toBe(false);
        runMinutes(ZTO_ABANDON_HOLD_MAX_MS + 60000);
        expect(abandoned('hang1')).toBe(true);
    });

    it('ទិសផ្ទុយ ៖ កុងតាក់ «បិទតាម ZTO» បិទ ➜ មិនរង់ចាំ', () => {
        appLocalStore.setItem('zoew_zto_autoclose_v1', '0');
        dataState.scanHistory = [openItem('off1', 'ZTE4000001', 8 * DAY)];
        cleanupNow();
        expect(abandoned('off1')).toBe(true);
    });

    it('ទិសផ្ទុយ ៖ Fast Mode បិទ (កុងតាក់ ZTO លាក់) ➜ មិនរង់ចាំ', () => {
        appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify({ enabled: true, fastMode: false,
            url: 'https://example.invalid/.netlify/functions/zto-order-detail?barcode={barcode}' }));
        dataState.scanHistory = [openItem('off2', 'ZTE4000002', 8 * DAY)];
        cleanupNow();
        expect(abandoned('off2')).toBe(true);
    });

    it('ទិសផ្ទុយ ៖ Lookup មិនមែន ZTO ➜ មិនរង់ចាំ', () => {
        appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify({ enabled: true, fastMode: true,
            url: 'https://script.google.com/macros/s/x/exec?code={barcode}' }));
        dataState.scanHistory = [openItem('off3', 'ZTE4000003', 8 * DAY)];
        cleanupNow();
        expect(abandoned('off3')).toBe(true);
    });

    it('⛔ ការសម្អាត ២ ម៉ោង (pickup) មិនរង់ចាំ', () => {
        dataState.scanHistory = [closedItem('c1', 'ZTE5000001', 3 * 60 * 60 * 1000), openItem('o1', 'ZTE5000002', 8 * DAY)];
        cleanupNow();
        expect(abandoned('c1'), 'pickup ២ ម៉ោងដើរភ្លាម').toBe(true);
        expect(abandoned('o1')).toBe(false);
    });

    it('ផុតកំណត់ ៖ ការអានពេញលេញចាស់ (App ដេកក្នុង background ច្រើនថ្ងៃ) ➜ រង់ចាំការអានថ្មី', async () => {
        dataState.scanHistory = [openItem('s1', 'ZTE6000001', 3 * DAY)];
        vi.stubGlobal('fetch', vi.fn(async () => signedPage([])));
        await runZtoStatusSweep(false);
        expect(ztoAbandonCleanupIsHeld()).toBe(false);
        advance(ZTO_SIGNED_FRESH_MS + 60000);
        expect(ztoAbandonCleanupIsHeld(), 'ការអានហួស ZTO_SIGNED_FRESH_MS ➜ រង់ចាំម្តងទៀត').toBe(true);
        advance(6 * DAY);
        dataState.scanHistory = [openItem('s2', 'ZTE6000002', 8 * DAY)];
        cleanupNow();
        expect(abandoned('s2'), 'ភ្ញាក់ពី background ➜ វគ្គថ្មី ➜ រង់ចាំ').toBe(false);
    });

    it('វគ្គដែលហួសពិដានរួច មិនដោះលែងវគ្គក្រោយ (App ដេកច្រើនថ្ងៃ)', async () => {
        dataState.scanHistory = [openItem('r1', 'ZTE6100001', 8 * DAY)];
        vi.stubGlobal('fetch', vi.fn(async () => json({ error: 'down' }, 503)));
        cleanupNow();
        runMinutes(ZTO_ABANDON_HOLD_MAX_MS + 60000);
        expect(abandoned('r1')).toBe(true);
        tx = [];
        advance(8 * DAY);
        dataState.scanHistory = [openItem('r2', 'ZTE6100002', 8 * DAY)];
        cleanupNow();
        expect(abandoned('r2'), 'ភ្ញាក់ក្រោយ ៨ ថ្ងៃ ➜ វគ្គថ្មី ➜ រង់ចាំម្តងទៀត').toBe(false);
    });

    it('ចាកចេញ/ប្តូរ Config ៖ ការរង់ចាំកំណត់ឡើងវិញ (វគ្គថ្មី)', async () => {
        dataState.scanHistory = [openItem('l1', 'ZTE7000001', 3 * DAY)];
        vi.stubGlobal('fetch', vi.fn(async () => signedPage([])));
        await runZtoStatusSweep(false);
        expect(ztoAbandonCleanupIsHeld()).toBe(false);
        clearZtoPickupStatusStore();
        expect(ztoAbandonCleanupIsHeld()).toBe(true);
    });

    it('ចាកចេញក្រោយវគ្គហួសពិដាន ៖ គណនីបន្ទាប់ចាប់ផ្តើមវគ្គរង់ចាំថ្មី', () => {
        dataState.scanHistory = [openItem('l2', 'ZTE7000002', 8 * DAY)];
        vi.stubGlobal('fetch', vi.fn(async () => json({ error: 'down' }, 503)));
        cleanupNow();
        runMinutes(ZTO_ABANDON_HOLD_MAX_MS + 60000);
        expect(abandoned('l2')).toBe(true);
        clearZtoPickupStatusStore();
        tx = [];
        cleanupNow();
        expect(abandoned('l2'), 'វគ្គថ្មីក្រោយចាកចេញ ➜ រង់ចាំម្តងទៀត').toBe(false);
    });

    it('ការអានពេញលេញបើកវគ្គថ្មី ៖ ពេលវាចាស់ម្តងទៀត ការរង់ចាំចាប់ផ្តើមពីសូន្យ (មិនយកពិដានវគ្គមុន)', async () => {
        dataState.scanHistory = [openItem('e1', 'ZTE7100001', 8 * DAY)];
        vi.stubGlobal('fetch', vi.fn(async () => json({ error: 'down' }, 503)));
        cleanupNow();
        runMinutes(ZTO_ABANDON_HOLD_MAX_MS + 60000);
        expect(abandoned('e1'), 'វគ្គទី ១ ហួសពិដាន ➜ ដើរ (tx មិន apply ➜ កញ្ចប់នៅ ➜ ពិនិត្យរៀងរាល់នាទី)').toBe(true);
        vi.stubGlobal('fetch', vi.fn(async () => signedPage([])));
        await runZtoStatusSweep(true);
        expect(ztoAbandonCleanupIsHeld()).toBe(false);
        runMinutes(ZTO_SIGNED_FRESH_MS + 60000);
        tx = [];
        runMinutes(5 * 60000);
        expect(abandoned('e1'), 'ការអានចាស់ម្តងទៀត ➜ វគ្គរង់ចាំថ្មីពីសូន្យ').toBe(false);
    });

    it('ការអានមិនពេញលេញ (ទំព័រធ្លាក់) មិនដោះលែងការរង់ចាំ', async () => {
        dataState.scanHistory = [openItem('p1', 'ZTE8000001', 8 * DAY)];
        vi.stubGlobal('fetch', vi.fn(async (url: string) => {
            const page = Number(new URL(url).searchParams.get('page'));
            return page === 1 ? signedPage(['ZTE9999999'], { pages: 2 }) : json({ error: 'down' }, 503);
        }));
        await runZtoStatusSweep(false);
        cleanupNow();
        expect(abandoned('p1')).toBe(false);
    });

    it('ការបិទដែលព្យួរ (commit យឺត) មិនដោះលែងការរង់ចាំ', async () => {
        dataState.scanHistory = [openItem('u1', 'ZTE8100001', 8 * DAY), openItem('u2', 'ZTE8100002', 8 * DAY)];
        h.ok = undefined;
        vi.stubGlobal('fetch', vi.fn(async () => signedPage(['ZTE8100001'])));
        await runZtoStatusSweep(false);
        cleanupNow();
        expect(abandoned('u1')).toBe(false);
        expect(abandoned('u2')).toBe(false);
    });

    it('Server បិទបញ្ជីចុះហត្ថលេខា (`signed: null`) ➜ គ្មានអ្វីត្រូវរង់ចាំ ➜ ដើរធម្មតាភ្លាម', async () => {
        dataState.scanHistory = [openItem('n1', 'ZTE8200001', 8 * DAY)];
        vi.stubGlobal('fetch', vi.fn(async () => signedPage([], { signed: null, signedOk: false, reason: 'signed:off' })));
        await runZtoStatusSweep(false);
        cleanupNow();
        expect(abandoned('n1')).toBe(true);
        clearZtoPickupStatusStore();
        expect(ztoAbandonCleanupIsHeld(), 'ចាកចេញ ➜ វគ្គថ្មី ➜ វាស់ម្តងទៀត').toBe(true);
    });

    it('Server បើកបញ្ជីចុះហត្ថលេខាវិញ ៖ ការអានដែលវាស់បានលុបសាលក្រម «បិទ» ➜ ការរង់ចាំត្រឡប់មកវិញពេលការអានចាស់', async () => {
        dataState.scanHistory = [openItem('n2', 'ZTE8200002', 3 * DAY)];
        vi.stubGlobal('fetch', vi.fn(async () => signedPage([], { signed: null, signedOk: false, reason: 'signed:off' })));
        await runZtoStatusSweep(false);
        expect(ztoAbandonCleanupIsHeld()).toBe(false);
        dataState.scanHistory = [openItem('n3', 'ZTE8200003', 7 * DAY - ZTO_SIGNED_FRESH_MS - 60000)];
        vi.stubGlobal('fetch', vi.fn(async () => signedPage([])));
        await runZtoStatusSweep(true);
        runMinutes(ZTO_SIGNED_FRESH_MS + 2 * 60000);
        expect(abandoned('n3'), 'បញ្ជីដើរវិញ ➜ ការអានចាស់ ➜ រង់ចាំ').toBe(false);
    });

    it('បណ្តាញដាច់ចំពេលបិទ ៖ ជុំមិនពេញលេញ ➜ នៅរង់ចាំ', async () => {
        dataState.scanHistory = [openItem('o1', 'ZTE8500001', 8 * DAY), openItem('o2', 'ZTE8500002', 8 * DAY)];
        const online = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(navigator), 'onLine');
        vi.stubGlobal('fetch', vi.fn(async () => {
            Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
            return signedPage(['ZTE8500001']);
        }));
        try {
            await runZtoStatusSweep(false);
        } finally {
            delete (navigator as any).onLine;
            if (online && !Object.getOwnPropertyDescriptor(Object.getPrototypeOf(navigator), 'onLine')) {
                Object.defineProperty(Object.getPrototypeOf(navigator), 'onLine', online);
            }
        }
        expect(navigator.onLine).not.toBe(false);
        expect(h.calls).toEqual([]);
        cleanupNow();
        expect(abandoned('o1')).toBe(false);
        expect(abandoned('o2')).toBe(false);
    });

    it('⛔ E4 ៖ បញ្ជីមានជួរ «ចុះហត្ថលេខា» អត្ថបទផ្ទុយ (`signedMismatch`) ➜ ភស្តុតាងមិនច្បាស់ ➜ មិនដោះលែងការរង់ចាំ (មិនដកលុយកញ្ចប់ដែលប្រហែលយករួច)', async () => {
        dataState.scanHistory = [openItem('m1', 'ZTE8500001', 8 * DAY)];
        vi.stubGlobal('fetch', vi.fn(async () => signedPage(['ZTE9999997'], { signedMismatch: 2 })));
        await runZtoStatusSweep(false);
        cleanupNow();
        expect(ztoState.ztoSignedCompleteAt).toBe(0);
        expect(abandoned('m1')).toBe(false);
        vi.stubGlobal('fetch', vi.fn(async () => signedPage(['ZTE9999997'], { signedMismatch: 0 })));
        vi.setSystemTime(new Date(Date.now() + 10 * 60 * 1000));
        ztoState.ztoStatusLastSweepAt = 0;
        await runZtoStatusSweep(true);
        cleanupNow();
        expect(ztoState.ztoSignedCompleteAt, 'ទិសផ្ទុយ ៖ គ្មានជួរផ្ទុយ ➜ ពេញលេញ').toBeGreaterThan(0);
        expect(abandoned('m1'), 'ទិសផ្ទុយ ៖ ពេញលេញ ➜ ផុតកំណត់ធម្មតា').toBe(true);
    });

    it('បញ្ជីវែងលើសពិដានទំព័រ (truncated) មិនដោះលែងការរង់ចាំ', async () => {
        dataState.scanHistory = [openItem('t1', 'ZTE8400001', 8 * DAY)];
        vi.stubGlobal('fetch', vi.fn(async () => signedPage(['ZTE9999998'], { pages: 9 })));
        await runZtoStatusSweep(false);
        cleanupNow();
        expect(abandoned('t1')).toBe(false);
    });

    it('Server មិនកំណត់មុខងារបញ្ជីសម្រាប់គណនីនេះ (`site:*`) ➜ ដើរធម្មតាភ្លាម · ការផ្ទៀងគណនីបរាជ័យបណ្តោះអាសន្ន ➜ នៅរង់ចាំ', async () => {
        dataState.scanHistory = [openItem('m1', 'ZTE8300001', 8 * DAY)];
        vi.stubGlobal('fetch', vi.fn(async () => json({ success: false, list: true, enabled: false, code: 'ZTO_LIST_NOT_CONFIGURED', reason: 'idtoken:supabase-unreachable' })));
        await runZtoStatusSweep(false);
        cleanupNow();
        expect(abandoned('m1'), 'បរាជ័យបណ្តោះអាសន្ន ➜ នៅរង់ចាំ').toBe(false);
        clearZtoPickupStatusStore();
        vi.stubGlobal('fetch', vi.fn(async () => json({ success: false, list: true, enabled: false, code: 'ZTO_LIST_NOT_CONFIGURED', reason: 'site:no-account' })));
        await runZtoStatusSweep(false);
        cleanupNow();
        expect(abandoned('m1'), 'មិនកំណត់ពិត ➜ ដើរធម្មតា').toBe(true);
    });

    it('ជួរថ្ងៃ ៖ ការអានដំបូងគ្របដល់ថ្ងៃបង្កើតកញ្ចប់បើកចាស់បំផុត (ពិដាន ZTO_SIGNED_SWEEP_MAX_DAYS)', async () => {
        dataState.scanHistory = [openItem('w1', 'ZTE9000001', 12 * DAY), openItem('w2', 'ZTE9000002', 2 * DAY)];
        const fetch = vi.fn(async () => signedPage([]));
        vi.stubGlobal('fetch', fetch);
        await runZtoStatusSweep(false);
        const first = new URL(String((fetch.mock.calls[0] as any[])[0]));
        expect(first.searchParams.get('from')).toBe(getZoneDateKey(NOW - 12 * DAY, 0));
        expect(first.searchParams.get('to')).toBe(getZoneDateKey(NOW, 0));
        clearZtoPickupStatusStore();
        fetch.mockClear();
        dataState.scanHistory = [openItem('w3', 'ZTE9000003', 60 * DAY)];
        await runZtoStatusSweep(false);
        const capped = new URL(String((fetch.mock.calls[0] as any[])[0]));
        expect(capped.searchParams.get('from')).toBe(getZoneDateKey(NOW, -ZTO_SIGNED_SWEEP_MAX_DAYS));
    });
});

describe('ZTO-E1 ការផ្ទៀងផ្ទាត់ឡើងវិញ ៖ ការរង់ចាំមិនដោះលែងមុនភស្តុតាងពិត', () => {
    const SWEEP_AFTER_CLEANUP_MS = 1500;
    const cycle = async (minutes: number, stop: () => boolean = () => false) => {
        for (let i = 0; i < minutes && !stop(); i++) {
            advance(60000 - SWEEP_AFTER_CLEANUP_MS);
            cleanupNow();
            advance(SWEEP_AFTER_CLEANUP_MS);
            if (ztoSignedSweepIsDue(false)) await runZtoStatusSweep(false);
        }
    };

    it('M1 ៖ ការបិទតាមបញ្ជី «ចុះហត្ថលេខា» បរាជ័យម្តង ➜ ជុំមិនពេញលេញ · មិនដកលុយ · សាកបិទម្តងទៀតក្នុងការរង់ចាំ', async () => {
        dataState.scanHistory = [openItem('m1', 'ZTM1000001', 8 * DAY)];
        vi.stubGlobal('fetch', vi.fn(async () => signedPage(['ZTM1000001'])));
        h.ok = false;
        cleanupNow();
        await runZtoStatusSweep(false);
        expect(h.calls.length, 'លក្ខខណ្ឌចាំបាច់ ៖ ការបិទបានសាក ១ ដង (បរាជ័យ)').toBe(1);
        cleanupNow();
        expect(abandoned('m1'), '⛔ ការបិទបរាជ័យមិនមែនភស្តុតាងថាជុំពេញលេញ ➜ មិនដកលុយ').toBe(false);
        h.ok = true;
        await cycle(10, () => h.calls.length >= 2);
        expect(h.calls.length, 'សាកបិទម្តងទៀតក្នុង ១០ នាទី (មិនមែនរង់ចាំ ១ ម៉ោង)').toBe(2);
        cleanupNow();
        expect(abandoned('m1')).toBe(false);
        const item = dataState.scanHistory.find((i: any) => i.id === 'm1');
        expect(item && item.barcodes[0].isClosed, 'បិទ «យករួច»').toBe(true);
    });

    it('M1 ៖ ការបិទដែលបរាជ័យជាប់ៗ មិនសាករាល់ជុំ (មិនអត់ឃ្លានជួរ) · ការរង់ចាំនៅមានពិដាន', async () => {
        dataState.scanHistory = [openItem('m2', 'ZTM1000002', 8 * DAY)];
        vi.stubGlobal('fetch', vi.fn(async () => signedPage(['ZTM1000002'])));
        h.ok = false;
        cleanupNow();
        await runZtoStatusSweep(false);
        await cycle(10);
        expect(h.calls.length, 'បរាជ័យជាប់ៗ ➜ សាកម្តងៗ មិនមែនរាល់ជុំ ២០–៦០ វិ.').toBeLessThanOrEqual(6);
        expect(h.calls.length).toBeGreaterThanOrEqual(2);
        await cycle(Math.ceil(ZTO_ABANDON_HOLD_MAX_MS / 60000) + 2);
        expect(abandoned('m2'), 'ហួសពិដាន ➜ ការសម្អាតដើរ (មិនជាប់រហូត)').toBe(true);
    });

    it('M3 ៖ ការអានពេញលេញ **មុន** កញ្ចប់ «ទុំ» មិនដោះលែងការសម្អាត (ត្រឡប់ពី background ក្នុង ១០ នាទី)', async () => {
        dataState.scanHistory = [openItem('r3', 'ZTM3000001', 7 * DAY - 5 * 60000)];
        vi.stubGlobal('fetch', vi.fn(async () => signedPage([])));
        await runZtoStatusSweep(false);
        expect(ztoState.ztoSignedCompleteAt, 'លក្ខខណ្ឌចាំបាច់ ៖ ការអានពេញលេញ (បញ្ជីមិនទាន់មានកញ្ចប់)').toBeTruthy();
        advance(8 * 60000);
        cleanupNow();
        expect(abandoned('r3'), '⛔ ការអាន ៨ នាទីមុន (មុនពេលទុំ) មិនមែនភស្តុតាង ➜ មិនដកលុយ').toBe(false);
        vi.stubGlobal('fetch', vi.fn(async () => signedPage(['ZTM3000001'])));
        await runZtoStatusSweep(true);
        expect(h.calls.map((c) => c.code)).toEqual(['ZTM3000001']);
        cleanupNow();
        expect(abandoned('r3')).toBe(false);
    });

    it('M3 ៖ វគ្គដែលរត់យូរ (ការរង់ចាំមុនៗផុតយូរហើយ) ៖ កញ្ចប់ដែលទុំក្រោយការអានចុងក្រោយ នៅតែរង់ចាំការអានថ្មី', async () => {
        dataState.scanHistory = [openItem('e0', 'ZTM3100000', 8 * DAY)];
        vi.stubGlobal('fetch', vi.fn(async () => signedPage([])));
        cleanupNow();
        await runZtoStatusSweep(false);
        await cycle(120);
        expect(abandoned('e0'), 'លក្ខខណ្ឌចាំបាច់ ៖ ការអានក្រោយពេលទុំ ➜ ផុតកំណត់').toBe(true);
        tx = [];
        const ripeIn = 10000;
        dataState.scanHistory = [openItem('e1', 'ZTM3100001', NOW - (Date.now() + ripeIn - 7 * DAY))];
        await runZtoStatusSweep(true);
        advance(2 * ripeIn);
        cleanupNow();
        expect(abandoned('e1'), '⛔ ការអានមុនពេលទុំ ➜ រង់ចាំការអានថ្មី (មិនមែនដោះលែងព្រោះការរង់ចាំមុន ២ ម៉ោងហួសពិដាន)').toBe(false);
    });

    it('M3 ៖ ការរង់ចាំវែង (ZTO ធ្លាក់ ២៩ នាទី) ទើបចប់ ➜ កញ្ចប់ដែលទុំបន្ទាប់ទទួលការរង់ចាំថ្មី (មិនប្រើពិដានដែលស្ទើរអស់)', async () => {
        dataState.scanHistory = [openItem('d0', 'ZTM3200000', 8 * DAY)];
        let down = true;
        vi.stubGlobal('fetch', vi.fn(async () => (down ? json({ error: 'down' }, 503) : signedPage(['ZTM3200000']))));
        cleanupNow();
        advance(1500);
        await runZtoStatusSweep(false);
        await cycle(28);
        expect(abandoned('d0'), 'លក្ខខណ្ឌចាំបាច់ ៖ នៅក្នុងពិដាន').toBe(false);
        down = false;
        await runZtoStatusSweep(true);
        cleanupNow();
        expect(abandoned('d0')).toBe(false);
        const ripeIn = 60000;
        dataState.scanHistory = [openItem('d1', 'ZTM3200001', NOW - (Date.now() + ripeIn - 7 * DAY))];
        vi.stubGlobal('fetch', vi.fn(async () => signedPage([])));
        await runZtoStatusSweep(true);
        advance(2 * ripeIn + 30000);
        cleanupNow();
        expect(abandoned('d1'), '⛔ ការអានមុនពេលទុំ ➜ រង់ចាំ (ការរង់ចាំថ្មី មិនមែនពិដានដែលចាប់ផ្តើម ៣០ នាទីមុន)').toBe(false);
    });

    it('M3 ៖ កញ្ចប់មាន barcode ទុំពេលផ្សេងគ្នា (barcode ស្តារ) ➜ ការអានត្រូវក្រោយ barcode ដែលទុំចុងក្រោយ', async () => {
        const item: any = openItem('mx', 'ZTM3300001', 9 * DAY);
        item.barcodes.push({ code: 'ZTM3300002', isClosed: false, cod: 1, dod: 0, restoredAt: Date.now() - 7 * DAY + 5 * 60000 });
        dataState.scanHistory = [item];
        vi.stubGlobal('fetch', vi.fn(async () => signedPage([])));
        await runZtoStatusSweep(false);
        advance(8 * 60000);
        cleanupNow();
        expect(abandoned('mx'), '⛔ ការអានមុនពេល barcode ស្តារទុំ ➜ រង់ចាំ').toBe(false);
    });

    it('M3 ទិសផ្ទុយ ៖ ការអានពេញលេញ **ក្រោយ** ពេលទុំ (មិនមានក្នុងបញ្ជី) ➜ ផុតកំណត់ធម្មតា', async () => {
        dataState.scanHistory = [openItem('r4', 'ZTM3000002', 7 * DAY + 60000)];
        vi.stubGlobal('fetch', vi.fn(async () => signedPage([])));
        await runZtoStatusSweep(false);
        cleanupNow();
        expect(abandoned('r4')).toBe(true);
    });

    it('R1 ៖ ហេតុផលអត្តសញ្ញាណបណ្តោះអាសន្ន (idtoken:expired · idtoken:missing) ➜ សាកឡើងវិញក្នុងការរង់ចាំ ➜ បិទមុនពិដាន (មិនដកលុយ)', async () => {
        for (const reason of ['idtoken:expired', 'idtoken:supabase-unreachable']) {
            clearZtoPickupStatusStore();
            h.calls.length = 0;
            tx = [];
            const id = 'i-' + reason.replace(/[^a-z]/g, '');
            dataState.scanHistory = [openItem(id, 'ZTI100000' + (reason.length % 10), 8 * DAY)];
            let first = true;
            vi.stubGlobal('fetch', vi.fn(async () => {
                if (first) { first = false; return json({ success: true, list: true, enabled: false, reason: reason }); }
                return signedPage([dataState.scanHistory[0].barcodes[0].code]);
            }));
            cleanupNow();
            advance(SWEEP_AFTER_CLEANUP_MS);
            await runZtoStatusSweep(false);
            expect(h.calls, reason + ' ៖ ការអានដំបូងបរាជ័យ').toEqual([]);
            advance(500);
            await cycle(Math.ceil(ZTO_ABANDON_HOLD_MAX_MS / 60000) + 2, () => h.calls.length > 0);
            expect(abandoned(id), '⛔ ' + reason + ' ៖ មិនដកលុយ').toBe(false);
            expect(h.calls.length, reason + ' ៖ បិទ «យករួច» ក្នុងពិដាន').toBe(1);
        }
    });

    it('R1 អចលនៈ ៖ ការរង់ចាំវែងបំផុតតាមផ្លូវបរាជ័យដែលមិនបិទមុខងារ < ZTO_ABANDON_HOLD_MAX_MS', () => {
        expect(ztoStatusModule.ZTO_SIGNED_SWEEP_FAIL_MAX_MS).toBeLessThan(ZTO_ABANDON_HOLD_MAX_MS);
    });
});

describe('ការពិនិត្យប្រឆាំង (លុយ) ៖ ជួរផ្ទុយក្រៅជួរដែលបង្រួម · បញ្ជីបិទ', () => {
    function rangeMismatchServer(state: { mismatchDay: string | null }) {
        const reads: { from: string, to: string, mismatch: number }[] = [];
        vi.stubGlobal('fetch', vi.fn(async (u: string) => {
            const url = new URL(String(u));
            const from = String(url.searchParams.get('from'));
            const to = String(url.searchParams.get('to'));
            const day = state.mismatchDay;
            const mismatch = day && from <= day && day <= to ? 1 : 0;
            reads.push({ from, to, mismatch });
            return signedPage([], { signedMismatch: mismatch });
        }));
        return reads;
    }
    async function round() {
        ztoState.ztoStatusInFlight = false;
        await runZtoStatusSweep(false);
    }

    it('⛔ ជួរផ្ទុយ ៣ ថ្ងៃមុន ៖ ជួរបង្រួម (ម្សិលមិញ ➜ ថ្ងៃនេះ) មិនឃើញវា ➜ នៅតែមិន «ពេញលេញ» ➜ មិនដកលុយក្នុងវគ្គ', async () => {
        const st = { mismatchDay: getZoneDateKey(NOW, -3) as string | null };
        const reads = rangeMismatchServer(st);
        dataState.scanHistory = [openItem('p', 'ZTE1Q10001', 7 * DAY - 10 * 60000)];
        advance(9 * 60000);
        await round();
        expect(reads[0].mismatch, 'លក្ខខណ្ឌចាំបាច់ ៖ ជុំដំបូងឃើញជួរផ្ទុយ').toBe(1);
        advance(3 * 60000);
        cleanupNow();
        expect(abandoned('p')).toBe(false);
        await round();
        expect(reads[reads.length - 1].from, 'លក្ខខណ្ឌចាំបាច់ ៖ ជុំទី ២ (ក្រោយកញ្ចប់ទុំ) អានជួរបង្រួម (quota)').toBe(getZoneDateKey(NOW + 12 * 60000, -1));
        expect(reads[reads.length - 1].mismatch).toBe(0);
        cleanupNow();
        expect(abandoned('p'), '⛔ ជួរផ្ទុយមិនទាន់ដោះស្រាយ ➜ នៅរង់ចាំ').toBe(false);
    });

    it('ជួរផ្ទុយបាត់ (Server កែ) ➜ ការអានជួរវែងម្តងទៀតក្នុង ZTO_SIGNED_FRESH_MS ➜ ពេញលេញ ➜ ដកធម្មតា · ការអានជួរវែង ≤ ១ ក្នុងមួយ ZTO_SIGNED_FRESH_MS', async () => {
        const st = { mismatchDay: getZoneDateKey(NOW, -3) as string | null };
        const reads = rangeMismatchServer(st);
        dataState.scanHistory = [openItem('q', 'ZTE1Q10002', 7 * DAY - 10 * 60000)];
        await round();
        for (let i = 0; i < 9; i++) { advance(2 * 60000); await round(); }
        const wide = reads.filter((r) => r.from <= getZoneDateKey(NOW, -3)).length;
        expect(wide, '⛔ quota ៖ ជួរវែងមិនរាល់ជុំ').toBeLessThanOrEqual(Math.ceil(18 * 60000 / ZTO_SIGNED_FRESH_MS) + 1);
        expect(wide, 'ជួរវែងត្រូវអានម្តងទៀត (ដើម្បីដឹងពេលជួរផ្ទុយបាត់)').toBeGreaterThanOrEqual(2);
        cleanupNow();
        expect(abandoned('q'), 'នៅមានជួរផ្ទុយ ➜ រង់ចាំ').toBe(false);
        st.mismatchDay = null;
        for (let i = 0; i < 6 && !abandoned('q'); i++) { advance(2 * 60000); await round(); cleanupNow(); }
        expect(abandoned('q'), 'ជួរផ្ទុយបាត់ ➜ ការអានជួរវែងស្អាត ➜ ដកធម្មតា').toBe(true);
    });

    it('Server បិទបញ្ជីចុះហត្ថលេខា (`ztoSignedOff`) ➜ មិនរង់ចាំ ទោះសញ្ញាហាងសកម្ម', () => {
        ztoState.ztoSignedOff = true;
        ztoState.ztoShopSweep = { state: 'ok', activeAt: NOW, completeAt: NOW - 8 * DAY, advancedAt: 0 };
        expect(ztoAbandonCleanupIsHeld(NOW - 60000)).toBe(false);
        ztoState.ztoShopSweep = { state: 'off', activeAt: 0, completeAt: 0, advancedAt: 0 };
    });
});
