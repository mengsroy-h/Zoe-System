/**
 * ⛔ ZTO-M2 (លុយ) ៖ ការរង់ចាំបញ្ជី «ចុះហត្ថលេខា» មុនសម្អាត ៧ ថ្ងៃ ត្រូវជាច្បាប់ **ទូទាំងហាង** មិនមែនតែឧបករណ៍ដែលបើក ZTO។
 *
 * មុនកែ ៖ ការកំណត់ ZTO (Lookup · Fast Mode · កុងតាក់បិទស្វ័យប្រវត្តិ) នៅក្នុង localStorage របស់ឧបករណ៍នីមួយៗ ➜ ឧបករណ៍ A (ZTO) រង់ចាំ
 * ប៉ុន្តែឧបករណ៍ B (ទូរស័ព្ទបុគ្គលិក គ្មាន ZTO) រត់ `runAutomaticCleanupRules()` លើទិន្នន័យរួមដដែល ➜ ដកលុយកញ្ចប់ដែលអតិថិជនយករួច
 * (ចុះហត្ថលេខាក្នុង ZTO Palm) មុន A អានបញ្ជី។
 *
 * ច្បាប់ ៖ ឧបករណ៍ ZTO សរសេរសញ្ញាហាង `zoew_settings/zto_signed_sweep` = `{ activeAt, completeAt }` (ម៉ោង Server · រៀងរាល់
 * `ZTO_SHOP_SWEEP_MARK_GAP_MS` យ៉ាងច្រើនម្តង) ក្រោយការអានដែលវាស់បាន · `completeAt` = ពេលចាប់ផ្តើមការអានពេញលេញ។ ឧបករណ៍គ្មាន ZTO
 * រង់ចាំ ពេលសញ្ញាសកម្ម (`activeAt` ក្នុង `ZTO_SHOP_SWEEP_ACTIVE_MS`) ហើយ `completeAt` មុនពេលកញ្ចប់ផុតកំណត់ ➜ ≤ `ZTO_ABANDON_HOLD_MAX_MS`
 * ក្នុងមួយវគ្គ (មិនជាប់រហូត)។ គ្មានសញ្ញា · សញ្ញាចាស់ · rules មិនទាន់ Publish (`permission_denied`) ➜ សម្អាតធម្មតា។
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dataState, firebaseState, uiState, ztoState } from '../src/core/state';
import { appLocalStore } from '../src/core/storage';
import { getZoneDateKey } from '../src/core/timezone';
import { cleanupInFlight, runAutomaticCleanupRules } from '../src/domain/cleanup';
import { clearCustomerDataTableCache } from '../src/features/customer-table';
import * as zto from '../src/features/zto-status';
import { detachDatabaseListeners, initDatabaseListeners } from '../src/services/db-listeners';
import * as shop from '../src/services/zto-shop-sweep';

const h = vi.hoisted(() => ({ ok: true as any }));
vi.mock('../src/features/barcode-ops', () => ({
    openViewListModal: () => {},
    removeSingleBarcode: async () => 'failed',
    toggleIndividualBarcodeClose: async () => false,
    openEditBarcodePriceModal: () => {},
    closeEditBarcodeModal: () => {},
    saveEditedBarcodePrice: () => {},
    applyBarcodeCloseChange: async (itemId: string, code: string, closed: boolean) => {
        if (h.ok !== true) return h.ok;
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
const DAY = 24 * 60 * 60 * 1000;
const MIN = 60 * 1000;
const PATH = 'zoew_settings/zto_signed_sweep';
const ZTO_CFG = JSON.stringify({ enabled: true, fastMode: true, url: 'https://example.invalid/.netlify/functions/zto-order-detail?barcode={barcode}' });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const M = shop as any;
const HOLD_MAX = zto.ZTO_ABANDON_HOLD_MAX_MS;

let tx: string[] = [];
let shared: any = null;
let updates: any[] = [];
let listeners: Record<string, { ok: (s: any) => void; fail: (e: any) => void }[]> = {};
let denyMarker = false;
let queueDelivery = false;

function openItem(id: string, code: string, ageMs: number) {
    return { id, phone: '0963897345', scanDate: getZoneDateKey(NOW - ageMs, 0), isClosed: false, createdAt: NOW - ageMs,
        cod: 1, dod: 0, count: 1, barcode: code, barcodes: [{ code, isClosed: false, cod: 1, dod: 0 }] };
}

function signedPage(codes: string[]) {
    return json({ success: true, list: true, enabled: true, kind: 'signed', page: 1, pages: 1, total: codes.length,
        rows: [], otherScans: 0, signedScans: codes.length, signed: codes, signedOk: true });
}

const abandoned = (id: string) => tx.includes('zoew_scan_history_cod_dod/' + id);
const advance = (ms: number) => vi.setSystemTime(new Date(Date.now() + ms));
const flush = async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); };

function cleanupNow() {
    cleanupInFlight.clear();
    runAutomaticCleanupRules();
}

function deliver(path: string) {
    (listeners[path] || []).forEach((l) => l.ok({ val: () => (shared ? JSON.parse(JSON.stringify(shared)) : null) }));
}

function asDeviceA() {
    appLocalStore.setItem('zoew_lookup_api_config', ZTO_CFG);
    clearCustomerDataTableCache();
    zto.clearZtoPickupStatusStore();
}

function asDeviceB() {
    appLocalStore.removeItem('zoew_lookup_api_config');
    clearCustomerDataTableCache();
    zto.clearZtoPickupStatusStore();
}

async function sweepA(codes: string[], readMs = 0) {
    asDeviceA();
    vi.stubGlobal('fetch', vi.fn(async () => { if (readMs) advance(readMs); return signedPage(codes); }));
    ztoState.ztoStatusInFlight = false;
    await zto.runZtoStatusSweep(false);
    await flush();
}

function attach() {
    firebaseState.dbRefZtoSignedSweep = firebaseState.fb.ref(firebaseState.db, PATH);
    initDatabaseListeners();
}

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(NOW));
    appLocalStore.clear();
    clearCustomerDataTableCache();
    zto.clearZtoPickupStatusStore();
    tx = [];
    shared = null;
    updates = [];
    listeners = {};
    denyMarker = false;
    queueDelivery = false;
    h.ok = true;
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
    ['dbRefDailyRevenue', 'dbRefMonthlyRevenue', 'dbRefDailyPickup', 'dbRefDailyCollected', 'dbRefHistory', 'dbRefDeleted', 'dbRefExchangeRate']
        .forEach((k) => { (firebaseState as any)[k] = null; });
    firebaseState.fb = {
        ref: (_db: unknown, path: string) => ({ path }),
        onValue: (ref: { path: string }, ok: (s: any) => void, fail: (e: any) => void) => {
            (listeners[ref.path] = listeners[ref.path] || []).push({ ok, fail });
            if (ref.path === PATH && denyMarker) fail(Object.assign(new Error('permission_denied at /' + PATH), { code: 'PERMISSION_DENIED' }));
        },
        off: (ref: { path: string }) => { delete listeners[ref.path]; },
        update: async (ref: { path: string }, patch: any) => {
            updates.push({ path: ref.path, patch: Object.assign({}, patch) });
            if (ref.path === PATH) {
                shared = Object.assign({}, shared || {}, patch);
                if (!queueDelivery) deliver(PATH);
            }
        },
        runTransaction: (ref: { path: string }) => {
            tx.push(ref.path);
            return Promise.reject(Object.assign(new Error('audit: not applied'), { txOutcome: 'not-applied' }));
        },
        getIdTokenResult: async () => ({ token: 'audit-token' })
    } as any;
    vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
    try { detachDatabaseListeners(); } catch { }
    vi.useRealTimers();
    vi.unstubAllGlobals();
    appLocalStore.clear();
    firebaseState.dbRefZtoSignedSweep = null;
    firebaseState.db = null as any;
    firebaseState.fb = null as any;
    firebaseState.serverClockTrusted = false;
    firebaseState.isDatabaseConnected = false;
});

describe('ZTO-M2 ៖ ឧបករណ៍គ្មាន ZTO រង់ចាំការអានបញ្ជីចុះហត្ថលេខារបស់ឧបករណ៍ ZTO ក្នុងហាងដដែល', () => {
    it('A (ZTO) អានពេញលេញមុនកញ្ចប់ផុតកំណត់ ➜ B (គ្មាន ZTO) មិនដកលុយ · A អានម្តងទៀតក្រោយផុតកំណត់ (មិនចុះហត្ថលេខា) ➜ B ដកធម្មតា', async () => {
        dataState.scanHistory = [openItem('x', 'ZTM2000001', 7 * DAY - 10 * MIN)];
        attach();
        deliver(PATH);
        await sweepA([]);
        expect(shared && shared.completeAt, 'A សរសេរ completeAt = ពេលចាប់ផ្តើមការអាន (ម៉ោង Server)').toBe(NOW);
        expect(shared.activeAt).toBe(NOW);
        asDeviceB();
        advance(20 * MIN);
        cleanupNow();
        expect(abandoned('x'), '⛔ B មិនត្រូវដកលុយ ខណៈ A សកម្ម ហើយមិនទាន់អានក្រោយពេលកញ្ចប់ផុតកំណត់').toBe(false);
        await sweepA([]);
        expect(shared.completeAt, 'ការអានក្រោយផុតកំណត់ ➜ completeAt ថ្មី').toBe(NOW + 20 * MIN);
        asDeviceB();
        cleanupNow();
        expect(abandoned('x'), 'ការអានគ្រប ➜ B ដកធម្មតា (កញ្ចប់មិនចុះហត្ថលេខា)').toBe(true);
    });

    it('A រកឃើញក្នុងបញ្ជីចុះហត្ថលេខា ➜ បិទ «យករួច» ➜ B មិនដែលដកលុយ', async () => {
        dataState.scanHistory = [openItem('s', 'ZTM2000002', 7 * DAY - 10 * MIN)];
        attach();
        deliver(PATH);
        await sweepA([]);
        asDeviceB();
        advance(20 * MIN);
        cleanupNow();
        expect(abandoned('s')).toBe(false);
        await sweepA(['ZTM2000002']);
        expect(dataState.scanHistory[0].isClosed, 'A បិទ «យករួច»').toBe(true);
        asDeviceB();
        for (let i = 0; i < 40; i++) { advance(MIN); cleanupNow(); }
        expect(abandoned('s'), '⛔ កញ្ចប់ដែលយករួចមិនដែលដកលុយ').toBe(false);
    });

    it('A មិនត្រឡប់មកវិញ ➜ B រង់ចាំ ≤ ZTO_ABANDON_HOLD_MAX_MS ហើយដកធម្មតា (មិនជាប់រហូត)', async () => {
        dataState.scanHistory = [openItem('y', 'ZTM2000003', 7 * DAY - 10 * MIN)];
        attach();
        deliver(PATH);
        await sweepA([]);
        asDeviceB();
        advance(20 * MIN);
        cleanupNow();
        expect(abandoned('y')).toBe(false);
        for (let left = HOLD_MAX - MIN; left > 0; left -= MIN) { advance(MIN); cleanupNow(); }
        expect(abandoned('y'), 'នៅក្នុងពិដាន ➜ នៅរង់ចាំ').toBe(false);
        advance(2 * MIN);
        cleanupNow();
        expect(abandoned('y'), 'ហួសពិដាន ➜ ដកធម្មតា').toBe(true);
    });

    it('A បិទតាមបញ្ជីបរាជ័យ (ជុំមិនពេញលេញ) ➜ សញ្ញាសកម្ម តែ completeAt មិនឡើង ➜ B នៅរង់ចាំ', async () => {
        dataState.scanHistory = [openItem('f', 'ZTM2000012', 7 * DAY - 10 * MIN)];
        attach();
        deliver(PATH);
        await sweepA([]);
        advance(20 * MIN);
        h.ok = false;
        await sweepA(['ZTM2000012']);
        expect(dataState.scanHistory[0].isClosed, 'លក្ខខណ្ឌចាំបាច់ ៖ ការបិទបរាជ័យ').toBe(false);
        expect(shared.activeAt, 'ការអានវាស់បាន ➜ activeAt ឡើង').toBe(NOW + 20 * MIN);
        expect(shared.completeAt, '⛔ ជុំមិនពេញលេញ ➜ completeAt មិនឡើង').toBe(NOW);
        asDeviceB();
        cleanupNow();
        expect(abandoned('f'), '⛔ B មិនដកលុយកញ្ចប់ដែល ZTO ចុះហត្ថលេខា ខណៈ A សាកបិទម្តងទៀត').toBe(false);
    });

    it('វគ្គរង់ចាំថ្មីក្រោយ completeAt ឡើង ៖ កញ្ចប់ដែលទុំបន្ទាប់បានរង់ចាំពេញពិដាន', async () => {
        dataState.scanHistory = [openItem('x', 'ZTM2000013', 7 * DAY - 10 * MIN), openItem('y', 'ZTM2000014', 7 * DAY - 32 * MIN)];
        attach();
        deliver(PATH);
        await sweepA([]);
        asDeviceB();
        advance(11 * MIN);
        for (let i = 0; i < 18; i++) { advance(MIN); cleanupNow(); }
        expect(abandoned('x'), 'លក្ខខណ្ឌចាំបាច់ ៖ x រង់ចាំ ១៨ នាទី').toBe(false);
        const since = ztoState.ztoAbandonHoldSince;
        const checked = ztoState.ztoAbandonCheckedAt;
        expect(since > 0, 'លក្ខខណ្ឌចាំបាច់ ៖ B មានវគ្គរង់ចាំ').toBe(true);
        queueDelivery = true;
        await sweepA([]);
        appLocalStore.removeItem('zoew_lookup_api_config');
        clearCustomerDataTableCache();
        ztoState.ztoAbandonHoldSince = since;
        ztoState.ztoAbandonCheckedAt = checked;
        queueDelivery = false;
        deliver(PATH);
        cleanupNow();
        expect(abandoned('x'), 'ការអានគ្រប x ➜ ដក').toBe(true);
        for (let i = 0; i < 16; i++) { advance(MIN); cleanupNow(); }
        expect(abandoned('y'), '⛔ y (ទុំក្រោយការអាន) បានវគ្គរង់ចាំថ្មី មិនមែនសល់ពីវគ្គចាស់').toBe(false);
    });

    it('ទិសផ្ទុយ ៖ ហាងគ្មានឧបករណ៍ ZTO (គ្មានសញ្ញា) ➜ B ដកភ្លាម', async () => {
        dataState.scanHistory = [openItem('n', 'ZTM2000004', 8 * DAY)];
        attach();
        deliver(PATH);
        asDeviceB();
        cleanupNow();
        expect(abandoned('n')).toBe(true);
    });

    it('ទិសផ្ទុយ ៖ សញ្ញាចាស់ជាង ZTO_SHOP_SWEEP_ACTIVE_MS ➜ B ដកភ្លាម · ក្នុងពិដាន ➜ រង់ចាំ', async () => {
        const active = M.ZTO_SHOP_SWEEP_ACTIVE_MS;
        expect(typeof active === 'number' && active > 0, 'ZTO_SHOP_SWEEP_ACTIVE_MS ត្រូវមាន').toBe(true);
        dataState.scanHistory = [openItem('o', 'ZTM2000005', 8 * DAY)];
        attach();
        shared = { activeAt: NOW - active - MIN, completeAt: NOW - active - MIN };
        deliver(PATH);
        asDeviceB();
        cleanupNow();
        expect(abandoned('o'), 'សញ្ញាចាស់ ➜ ដកភ្លាម').toBe(true);
        dataState.scanHistory = [openItem('p', 'ZTM2000006', 8 * DAY)];
        shared = { activeAt: NOW - active + MIN, completeAt: NOW - 8 * DAY };
        deliver(PATH);
        asDeviceB();
        cleanupNow();
        expect(abandoned('p'), 'សញ្ញាក្នុងពិដាន ➜ រង់ចាំ').toBe(false);
    });

    it('rules មិនទាន់ Publish (`permission_denied`) ➜ B ដកធម្មតា (គ្មាន toast ដាច់ · គ្មានការរង់ចាំ)', async () => {
        dataState.scanHistory = [openItem('d', 'ZTM2000007', 8 * DAY)];
        denyMarker = true;
        attach();
        asDeviceB();
        cleanupNow();
        expect(abandoned('d')).toBe(true);
        expect(firebaseState.dbListenersFailed, 'សញ្ញាហាងមិនមែន listener ទិន្នន័យ ➜ មិនប្រកាសដាច់').toBe(false);
    });

    it('សញ្ញាមិនទាន់មកដល់ (listener រង់ចាំ) ➜ រង់ចាំ · មកដល់ទទេ ➜ ដក', async () => {
        dataState.scanHistory = [openItem('w', 'ZTM2000008', 8 * DAY)];
        attach();
        asDeviceB();
        cleanupNow();
        expect(abandoned('w'), 'មិនទាន់ដឹងថាហាងប្រើ ZTO ➜ រង់ចាំ').toBe(false);
        deliver(PATH);
        advance(MIN);
        cleanupNow();
        expect(abandoned('w')).toBe(true);
    });

    it('callback ចាស់ក្រោយ detach (ចាកចេញ · ប្តូរ database) មិនសរសេរស្ថានភាព', async () => {
        dataState.scanHistory = [openItem('g', 'ZTM2000009', 8 * DAY)];
        attach();
        const old = listeners[PATH][0];
        detachDatabaseListeners();
        expect(listeners[PATH], '⛔ detach ដក listener សញ្ញាហាង (fb.off · គ្មាន listener កើនរាល់ការភ្ជាប់វិញ)').toBeUndefined();
        firebaseState.dbRefZtoSignedSweep = null;
        old.ok({ val: () => ({ activeAt: NOW, completeAt: NOW - 8 * DAY }) });
        asDeviceB();
        cleanupNow();
        expect(abandoned('g'), 'គ្មាន listener (ចាកចេញ) ➜ snapshot ចាស់មិនបង្កើតការរង់ចាំ').toBe(true);
    });
});

describe('ការពិនិត្យប្រឆាំង ៖ សញ្ញាហាងមិនពន្យារការផុតកំណត់យូរ', () => {
    it('ZTO_SHOP_SWEEP_ACTIVE_MS ៖ ការរង់ចាំតែពេលឧបករណ៍ ZTO អានថ្មីៗ (≥ ពិដានវគ្គ + ចន្លោះសរសេរ · ≤ ២ ម៉ោង ➜ ឧបករណ៍ ZTO បាត់ មិនពន្យាររាប់ថ្ងៃ)', () => {
        expect(M.ZTO_SHOP_SWEEP_ACTIVE_MS).toBeGreaterThanOrEqual(HOLD_MAX + M.ZTO_SHOP_SWEEP_MARK_GAP_MS);
        expect(M.ZTO_SHOP_SWEEP_ACTIVE_MS).toBeLessThanOrEqual(2 * 60 * MIN);
    });

    it('ឧបករណ៍ ZTO មិនអានជាង ២ ម៉ោង ហើយ B បើក App ខ្លីៗរៀងរាល់ម៉ោង ➜ ដក (មិនរង់ចាំរាប់ថ្ងៃ)', async () => {
        dataState.scanHistory = [openItem('s', 'ZTM2000020', 7 * DAY - 10 * MIN)];
        attach();
        deliver(PATH);
        await sweepA([]);
        asDeviceB();
        let hours = 0;
        while (!abandoned('s') && hours < 4) {
            advance(40 * MIN);
            for (let i = 0; i < 20; i++) { advance(MIN); cleanupNow(); }
            hours++;
        }
        expect(abandoned('s'), '⛔ ដកក្នុង ≤ ៤ ម៉ោង').toBe(true);
    });

    it('listener ភ្ជាប់ឡើងវិញ (initDatabaseListeners) មិនចាប់វគ្គរង់ចាំថ្មី', async () => {
        dataState.scanHistory = [openItem('r', 'ZTM2000021', 7 * DAY - 10 * MIN)];
        attach();
        deliver(PATH);
        await sweepA([]);
        asDeviceB();
        advance(11 * MIN);
        for (let i = 0; i < 20; i++) { advance(MIN); cleanupNow(); }
        expect(abandoned('r'), 'លក្ខខណ្ឌចាំបាច់ ៖ កំពុងរង់ចាំ').toBe(false);
        initDatabaseListeners();
        deliver(PATH);
        for (let i = 0; i < 12; i++) { advance(MIN); cleanupNow(); }
        expect(abandoned('r'), '⛔ ការភ្ជាប់ឡើងវិញមិនបន្តពិដានវគ្គ').toBe(true);
    });
});

describe('ZTO-M2 ៖ ឧបករណ៍ ZTO សរសេរសញ្ញាហាង', () => {
    it('សរសេរ ≤ ១ ដងក្នុង ZTO_SHOP_SWEEP_MARK_GAP_MS ទោះជុំអានរៀងរាល់ ២ នាទី · completeAt ជាម៉ោង Server ពេលចាប់ផ្តើមអាន', async () => {
        const gap = M.ZTO_SHOP_SWEEP_MARK_GAP_MS;
        expect(typeof gap === 'number' && gap >= 2 * MIN, 'ZTO_SHOP_SWEEP_MARK_GAP_MS ត្រូវមាន').toBe(true);
        firebaseState.serverTimeOffsetMs = 3 * 60 * MIN;
        dataState.scanHistory = [openItem('a', 'ZTM2000010', 2 * DAY)];
        attach();
        deliver(PATH);
        for (let i = 0; i < 15; i++) {
            await sweepA([], 4000);
            advance(zto.ZTO_SIGNED_SWEEP_GAP_MS);
        }
        const marks = updates.filter((u) => u.path === PATH);
        expect(marks.length, 'ជុំ ១៥ ក្នុង ៣០ នាទី ➜ សរសេរ ≤ ៣០/gap + ១').toBeLessThanOrEqual(Math.floor(30 * MIN / gap) + 1);
        expect(marks.length).toBeGreaterThanOrEqual(2);
        expect(marks[0].patch.completeAt, 'ម៉ោង Server (offset +៣ ម៉ោង) ពេលចាប់ផ្តើមអាន (មិនមែនពេលអានចប់)').toBe(NOW + 3 * 60 * MIN);
        expect(Object.keys(shared).sort()).toEqual(['activeAt', 'completeAt']);
    });

    it('ការអានបរាជ័យ ➜ មិនសរសេរ · គ្មាន ZTO ➜ មិនសរសេរ', async () => {
        dataState.scanHistory = [openItem('f', 'ZTM2000011', 2 * DAY)];
        attach();
        deliver(PATH);
        asDeviceA();
        vi.stubGlobal('fetch', vi.fn(async () => json({ error: 'busy' }, 503)));
        await zto.runZtoStatusSweep(false);
        await flush();
        asDeviceB();
        await zto.runZtoStatusSweep(false);
        await flush();
        expect(updates.filter((u) => u.path === PATH).length).toBe(0);
    });
});
