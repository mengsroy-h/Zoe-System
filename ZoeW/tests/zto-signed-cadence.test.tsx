/**
 * ⛔ ល្បឿន និងស្ថេរភាពនៃ «បិទតាម ZTO ស្វ័យប្រវត្តិ» (របាយការណ៍ម្ចាស់គម្រោង ៖ «sync យឺត អត់ស្ថេរភាព» · ជម្រើស «ឆ្លាតវៃ»)។
 *
 * វាស់មុនកែ (timer ក្លែង · ជុំ ៦០ វិ. ពិត) ៖ App ទំនេរ ➜ ZTO ចុះហត្ថលេខា ➜ ZoeW បិទក្នុង ៩២ វិ. · **កំពុងស្កេន (ប្រអប់បើក ២៥ វិ. ក្នុង ៣០ វិ.) ➜
 * មិនដែលបិទក្នុង ៤៥ នាទី** (ជុំទាំងមូលរំលងពេលប្រអប់បើក ហើយមិនតាំងម៉ោងឡើងវិញ) · ZTO ធ្លាក់ ៣៥ នាទី ➜ ១៤៤២ វិ. (ចន្លោះទ្វេ ៣០ នាទី)។
 *
 * ឥឡូវ ៖ ការអានបញ្ជី «ចុះហត្ថលេខា» (១ សំណើ) ដើរទោះប្រអប់បើក (`ztoSignedNetworkAllowed()` ៖ ក្រៅបណ្តាញ · Data Saver · Lookup កំពុងរត់ ➜ ឈប់) ·
 * ល្បឿនតាមសកម្មភាព (កូតា Netlify) ៖ កំពុងប្រើ (≤ ZTO_USER_ACTIVE_WINDOW_MS) ➜ ZTO_SIGNED_SWEEP_ACTIVE_MS · បើកទុកចោល ➜ ZTO_SIGNED_SWEEP_VISIBLE_MS ·
 * លាក់ ➜ ZTO_SIGNED_SWEEP_GAP_MS · timer ខ្លួនឯងតែពេលកុងតាក់បើក + មានកញ្ចប់បើក · ចន្លោះទ្វេពេលធ្លាក់មិនត្រូវល្បឿននេះជាន់ · ពិដាន ZTO_SIGNED_SWEEP_FAIL_MAX_MS។
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dataState, firebaseState, uiState, ztoState } from '../src/core/state';
import { appLocalStore } from '../src/core/storage';
import { autoLookupInFlight } from '../src/features/auto-lookup';
import { clearCustomerDataTableCache } from '../src/features/customer-table';
import { getZoneDateKey } from '../src/core/timezone';
import {
    ZTO_SIGNED_SWEEP_ACTIVE_MS, ZTO_SIGNED_SWEEP_FAIL_MAX_MS, ZTO_SIGNED_SWEEP_GAP_MS, ZTO_SIGNED_SWEEP_LOOKBACK_DAYS, ZTO_SIGNED_SWEEP_VISIBLE_MS,
    clearZtoPickupStatusStore, noteZtoUserActivity, runZtoStatusSweep, scheduleZtoStatusSweep, setZtoPickupVerdict, ztoAbandonCleanupIsHeld,
    ztoStatusPendingCodes, ztoStatusUnmeasuredCount
} from '../src/features/zto-status';

const h = vi.hoisted(() => ({ closes: [] as any[] }));
vi.mock('../src/features/barcode-ops', () => ({
    openViewListModal: () => {},
    removeSingleBarcode: async () => 'failed',
    toggleIndividualBarcodeClose: async () => false,
    openEditBarcodePriceModal: () => {},
    closeEditBarcodeModal: () => {},
    saveEditedBarcodePrice: () => {},
    applyBarcodeCloseChange: async (itemId: string, code: string, closed: boolean) => {
        h.closes.push({ code, at: Date.now() });
        const item = dataState.scanHistory.find((i: any) => i.id === itemId);
        const b = item && item.barcodes.find((x: any) => x.code === code);
        if (b) { b.isClosed = closed; b.closedAt = Date.now(); item.isClosed = item.barcodes.every((x: any) => x.isClosed); }
        return true;
    }
}));

const T0 = Date.UTC(2026, 9, 6, 3, 0, 0);
const MIN = 60 * 1000;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

type World = { signedAt: Record<string, number>, signedFails?: (now: number) => boolean, modal?: (now: number) => boolean,
    active?: boolean, lookup?: (now: number) => boolean, detailFails?: boolean };
let signedCalls: number[] = [];
let detailCalls: { at: number, modal: boolean }[] = [];

function openItem(id: string, code: string) {
    return { id, phone: '0963897345', scanDate: '2026-10-06', isClosed: false, createdAt: T0 - 3600000,
        barcodes: [{ code, isClosed: false, cod: 1, dod: 0 }] };
}

function install(w: World) {
    vi.stubGlobal('fetch', vi.fn(async (u: string) => {
        const url = new URL(String(u));
        const now = Date.now();
        if (url.searchParams.get('signed') === '1') {
            signedCalls.push(now);
            if (w.signedFails && w.signedFails(now)) return json({ error: 'down' }, 502);
            const codes = Object.keys(w.signedAt).filter((c) => w.signedAt[c] <= now);
            return json({ success: true, list: true, enabled: true, kind: 'signed', page: 1, pages: 1, total: codes.length, rows: [], signed: codes, signedOk: true });
        }
        detailCalls.push({ at: now, modal: !!uiState.isModalOpen });
        if (w.detailFails) return json({ error: 'ZTO HTTP 502', code: 'ZTO_UPSTREAM_UNAVAILABLE' }, 502);
        return json({ success: true, found: true, ztoClosed: null });
    }));
}

async function runApp(ms: number, w: World) {
    const start = Date.now();
    while (Date.now() - start < ms) {
        const now = Date.now();
        uiState.isModalOpen = w.modal ? w.modal(now) : false;
        if (w.lookup && w.lookup(now)) autoLookupInFlight.set('SCAN', {}); else autoLookupInFlight.delete('SCAN');
        if (w.active && (now - T0) % (30 * 1000) === 0) noteZtoUserActivity();
        if ((now - T0) % MIN === 0) scheduleZtoStatusSweep();
        await vi.advanceTimersByTimeAsync(1000);
    }
}

async function closeLatency(w: World, signAfterMs = 30 * 1000, runMs = 20 * MIN) {
    dataState.scanHistory = [openItem('a', 'ZTC0000001')];
    w.signedAt = { ZTC0000001: T0 + signAfterMs };
    install(w);
    scheduleZtoStatusSweep(1500);
    await runApp(runMs, w);
    const close = h.closes.find((c) => c.code === 'ZTC0000001');
    return close ? close.at - (T0 + signAfterMs) : Infinity;
}

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(T0));
    appLocalStore.clear();
    appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify({ enabled: true, fastMode: true,
        url: 'https://example.invalid/.netlify/functions/zto-order-detail?barcode={barcode}' }));
    clearCustomerDataTableCache();
    clearZtoPickupStatusStore();
    h.closes.length = 0;
    signedCalls = [];
    detailCalls = [];
    autoLookupInFlight.clear();
    ztoState.ztoStatusInFlight = false;
    if (ztoState.ztoStatusSweepTimer) clearTimeout(ztoState.ztoStatusSweepTimer);
    ztoState.ztoStatusSweepTimer = null;
    ztoState.ztoStatusLastSweepAt = 0;
    ztoState.ztoStatusFailStreak = 0;
    ztoState.ztoUserActiveAt = 0;
    dataState.scanHistory = [];
    dataState.deletedItems = [];
    uiState.isModalOpen = false;
    uiState.toasts = [];
    firebaseState.authGeneration++;
    firebaseState.auth = { currentUser: { uid: 'u' } } as any;
    firebaseState.fb = { getIdTokenResult: async () => ({ token: 't' }) } as any;
});

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    autoLookupInFlight.clear();
    appLocalStore.clear();
    delete (document as any).hidden;
    delete (navigator as any).connection;
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true });
});

function closedItem(id: string, code: string) {
    return { id, phone: '0963897346', scanDate: '2026-10-06', isClosed: true, closedAt: T0 - 60000, createdAt: T0 - 3600000,
        barcodes: [{ code, isClosed: true, closedAt: T0 - 60000, cod: 1, dod: 0 }] };
}

async function oneSweepTimer(items: any[]) {
    dataState.scanHistory = items;
    install({ signedAt: {} });
    noteZtoUserActivity();
    await runZtoStatusSweep(false);
    return !!ztoState.ztoStatusSweepTimer;
}

describe('ល្បឿន «បិទតាម ZTO» ៖ ពេលស្កេន · តាមសកម្មភាព · ពេលលាក់ · ពេលធ្លាក់', () => {
    it('⛔ កំពុងស្កេន (ប្រអប់បើក ២៥ វិ. ក្នុង ៣០ វិ.) ➜ នៅតែបិទតាម ZTO (មុនកែ ៖ មិនដែល)', async () => {
        const lat = await closeLatency({ signedAt: {}, modal: (now) => ((now - T0) % 30000) < 25000 });
        expect(lat).toBeLessThanOrEqual(ZTO_SIGNED_SWEEP_VISIBLE_MS + 5000);
        expect(detailCalls.filter((c) => c.modal), '⛔ /detail មិនហៅពេលប្រអប់បើក').toEqual([]);
    });

    it('កំពុងប្រើ (សកម្មភាពក្នុង ៥ នាទី) ➜ អានរៀងរាល់ ZTO_SIGNED_SWEEP_ACTIVE_MS · បិទក្នុង ≤ ២៥ វិ.', async () => {
        const lat = await closeLatency({ signedAt: {}, active: true }, 30 * 1000, 3 * MIN);
        expect(lat).toBeLessThanOrEqual(ZTO_SIGNED_SWEEP_ACTIVE_MS + 5000);
        expect(detailCalls.length, 'ទិសផ្ទុយ ៖ គ្មានប្រអប់ ➜ /detail នៅដើរ').toBeGreaterThan(0);
        const gaps = signedCalls.slice(1).map((t, i) => t - signedCalls[i]);
        expect(Math.min(...gaps)).toBeGreaterThanOrEqual(ZTO_SIGNED_SWEEP_ACTIVE_MS);
    });

    it('បើកទុកចោល (គ្មានសកម្មភាព) ➜ ZTO_SIGNED_SWEEP_VISIBLE_MS (សន្សំកូតា Netlify · មិនមែន ២០ វិ.)', async () => {
        dataState.scanHistory = [openItem('a', 'ZTC0000002')];
        install({ signedAt: {} });
        scheduleZtoStatusSweep(1500);
        await runApp(6 * MIN, { signedAt: {} });
        expect(signedCalls.length).toBeGreaterThanOrEqual(5);
        expect(signedCalls.length).toBeLessThanOrEqual(7);
        const gaps = signedCalls.slice(1).map((t, i) => t - signedCalls[i]);
        expect(Math.min(...gaps)).toBeGreaterThanOrEqual(ZTO_SIGNED_SWEEP_VISIBLE_MS);
    });

    it('សកម្មភាពចាស់លើស ៥ នាទី ➜ ត្រឡប់ទៅ ZTO_SIGNED_SWEEP_VISIBLE_MS', async () => {
        dataState.scanHistory = [openItem('a', 'ZTC0000003')];
        install({ signedAt: {} });
        noteZtoUserActivity();
        scheduleZtoStatusSweep(1500);
        await runApp(10 * MIN, { signedAt: {} });
        const early = signedCalls.filter((t) => t < T0 + 4 * MIN);
        expect(Math.max(...early.slice(1).map((t, i) => t - early[i]))).toBeLessThan(ZTO_SIGNED_SWEEP_VISIBLE_MS);
        const late = signedCalls.filter((t) => t > T0 + 6 * MIN);
        const gaps = late.slice(1).map((t, i) => t - late[i]);
        expect(gaps.length).toBeGreaterThan(0);
        expect(Math.min(...gaps)).toBeGreaterThanOrEqual(ZTO_SIGNED_SWEEP_VISIBLE_MS);
    });

    it('App លាក់ ➜ មិនលឿនជាង ZTO_SIGNED_SWEEP_GAP_MS (ទោះមានសកម្មភាព)', async () => {
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
        dataState.scanHistory = [openItem('a', 'ZTC0000004')];
        install({ signedAt: {} });
        noteZtoUserActivity();
        scheduleZtoStatusSweep(1500);
        await runApp(7 * MIN, { signedAt: {} });
        const gaps = signedCalls.slice(1).map((t, i) => t - signedCalls[i]);
        expect(signedCalls.length).toBeGreaterThanOrEqual(2);
        expect(Math.min(...gaps)).toBeGreaterThanOrEqual(ZTO_SIGNED_SWEEP_GAP_MS);
    });

    it('ទិសផ្ទុយ ៖ គ្មានកញ្ចប់បើក ➜ មិនសួរបញ្ជីចុះហត្ថលេខាសោះ (ទោះកំពុងប្រើ)', async () => {
        dataState.scanHistory = [];
        install({ signedAt: {} });
        scheduleZtoStatusSweep(1500);
        await runApp(5 * MIN, { signedAt: {}, active: true });
        expect(signedCalls).toEqual([]);
    });

    it('ទិសផ្ទុយ ៖ កុងតាក់ «បិទតាម ZTO» បិទ ➜ មិនសួរ', async () => {
        appLocalStore.setItem('zoew_zto_autoclose_v1', '0');
        dataState.scanHistory = [openItem('a', 'ZTC0000005')];
        install({ signedAt: {} });
        scheduleZtoStatusSweep(1500);
        await runApp(5 * MIN, { signedAt: {}, active: true });
        expect(signedCalls).toEqual([]);
    });

    it('Lookup កំពុងរត់ ➜ ការអានរង់ចាំ (មិនប្រជែង) រួចដើរវិញ', async () => {
        const lat = await closeLatency({ signedAt: {}, active: true, lookup: (now) => now < T0 + 2 * MIN }, 30 * 1000, 5 * MIN);
        expect(signedCalls.filter((t) => t > T0 + 2000 && t < T0 + 2 * MIN)).toEqual([]);
        expect(lat).toBeLessThanOrEqual(2 * MIN - 30 * 1000 + ZTO_SIGNED_SWEEP_ACTIVE_MS + 25000);
    });

    it('⛔ ការធ្លាក់ ➜ ចន្លោះទ្វេ (មិនត្រូវល្បឿន ២០ វិ. ជាន់) · ពិដាន ZTO_SIGNED_SWEEP_FAIL_MAX_MS', async () => {
        const lat = await closeLatency({ signedAt: {}, active: true, signedFails: (now) => now < T0 + 35 * MIN }, 34 * MIN, 60 * MIN);
        const failing = signedCalls.filter((t) => t < T0 + 35 * MIN);
        const gaps = failing.slice(2).map((t, i) => t - failing[i + 1]);
        expect(Math.min(...gaps)).toBeGreaterThanOrEqual(2 * ZTO_SIGNED_SWEEP_GAP_MS);
        expect(lat, 'ZTO ធ្លាក់ ៣៥ នាទី ➜ ស្តារក្នុងពិដាន (មុនកែ ៖ ១៤៤២ វិ.)').toBeLessThanOrEqual(ZTO_SIGNED_SWEEP_FAIL_MAX_MS + 2 * MIN);
    });

    it('⛔ ក្រៅបណ្តាញ · Data Saver ➜ មិនសួរបញ្ជីចុះហត្ថលេខា (ទោះប្រអប់បិទ) · ទិសផ្ទុយ ៖ បណ្តាញធម្មតា ➜ សួរ', async () => {
        dataState.scanHistory = [openItem('a', 'ZTC0000006')];
        install({ signedAt: {} });
        Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
        await runZtoStatusSweep(false);
        expect(signedCalls, 'ក្រៅបណ្តាញ').toEqual([]);
        Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true });
        Object.defineProperty(navigator, 'connection', { configurable: true, value: { saveData: true } });
        await runZtoStatusSweep(false);
        expect(signedCalls, 'Data Saver').toEqual([]);
        delete (navigator as any).connection;
        await runZtoStatusSweep(false);
        expect(signedCalls.length, 'ទិសផ្ទុយ').toBe(1);
    });

    it('timer ខ្លួនឯង ៖ តែពេលមើលឃើញ + កុងតាក់បើក + មានកញ្ចប់បើក + ចន្លោះធម្មតា (មិនដាស់ App ឥតប្រយោជន៍)', async () => {
        expect(await oneSweepTimer([openItem('a', 'ZTC0000007')]), 'ទិសផ្ទុយ ៖ មានកញ្ចប់បើក ➜ មាន timer').toBe(true);
        clearTimeout(ztoState.ztoStatusSweepTimer); ztoState.ztoStatusSweepTimer = null; clearZtoPickupStatusStore();
        expect(await oneSweepTimer([closedItem('c', 'ZTC0000008')]), 'គ្មានកញ្ចប់បើក').toBe(false);
        clearZtoPickupStatusStore();
        appLocalStore.setItem('zoew_zto_autoclose_v1', '0');
        expect(await oneSweepTimer([openItem('a', 'ZTC0000009'), closedItem('c', 'ZTC0000010')]), 'កុងតាក់បិទ').toBe(false);
        appLocalStore.removeItem('zoew_zto_autoclose_v1');
        clearZtoPickupStatusStore();
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
        expect(await oneSweepTimer([openItem('a', 'ZTC0000011')]), 'App លាក់').toBe(false);
        delete (document as any).hidden;
        clearZtoPickupStatusStore();
        dataState.scanHistory = [openItem('a', 'ZTC0000012')];
        install({ signedAt: {}, signedFails: () => true });
        await runZtoStatusSweep(false);
        expect(ztoState.ztoSignedSweepWaitMs).toBeGreaterThan(ZTO_SIGNED_SWEEP_GAP_MS);
        expect(!!ztoState.ztoStatusSweepTimer, 'កំពុងចន្លោះទ្វេ (ធ្លាក់)').toBe(false);
    });

    it('⛔ ការអានញឹក (២០ វិ.) មិនធ្វើឲ្យការសួរម្តងមួយកញ្ចប់ (/detail) ដែលកំពុងចន្លោះទ្វេ ស្រេកឃ្លាន', async () => {
        dataState.scanHistory = [openItem('a', 'ZTC0000013')];
        const w: World = { signedAt: {}, active: true, detailFails: true };
        install(w);
        scheduleZtoStatusSweep(1500);
        await runApp(20 * MIN, w);
        expect(detailCalls.length).toBeGreaterThanOrEqual(3);
        expect(signedCalls.length).toBeGreaterThan(20);
    });

    it('ប្រអប់បើកជាប់ + Lookup កំពុងរត់ ➜ តាំងម៉ោងសាកឡើងវិញ (មិនរង់ចាំជុំ ៦០ វិ.)', async () => {
        dataState.scanHistory = [openItem('a', 'ZTC0000014')];
        const w: World = { signedAt: {}, active: true, modal: () => true, lookup: (now) => now < T0 + 30 * 1000 };
        install(w);
        scheduleZtoStatusSweep(1500);
        await runApp(2 * MIN, w);
        expect(signedCalls.length).toBeGreaterThan(0);
        expect(signedCalls[0] - T0).toBeLessThan(MIN - 5000);
    });

    it('E6 ៖ របា «ZTO មិនទាន់បិទ» (បិទក្នុង ZoeW មុន ZTO Palm) រលត់តាមល្បឿនសកម្ម (timer ខ្លួនឯង · មិនរង់ចាំជុំ ៦០ វិ.)', async () => {
        dataState.scanHistory = [closedItem('c', 'ZTC0000031')];
        setZtoPickupVerdict('ZTC0000031', false);
        const w: World = { signedAt: { ZTC0000031: T0 + 70 * 1000 }, active: true };
        install(w);
        scheduleZtoStatusSweep(1500);
        let flippedAt = 0;
        const start = Date.now();
        while (Date.now() - start < 4 * MIN && !flippedAt) {
            await runApp(1000, w);
            if (ztoStatusPendingCodes().length === 0) flippedAt = Date.now();
        }
        expect(flippedAt, 'G6 ៖ របាត្រូវរលត់ពិត (sentinel 0 មិនឆ្លង)').toBeGreaterThan(0);
        expect(flippedAt - (T0 + 70 * 1000)).toBeLessThanOrEqual(ZTO_SIGNED_SWEEP_ACTIVE_MS + 5000);
        expect(detailCalls).toEqual([]);
    });

    it('⛔ ប្រអប់បើកយូរ មិនកត់ «បានសួរ /detail» ក្លែង ➜ បិទប្រអប់ ➜ /detail ដែលកំពុងចន្លោះទ្វេ ដើរវិញភ្លាម', async () => {
        dataState.scanHistory = [openItem('a', 'ZTC0000021')];
        const closeAt = 20 * MIN;
        const w: World = { signedAt: {}, active: true, detailFails: true, modal: (now) => now >= T0 + 5 * MIN && now < T0 + closeAt };
        install(w);
        scheduleZtoStatusSweep(1500);
        await runApp(closeAt + 12 * MIN, w);
        expect(detailCalls.filter((c) => c.modal)).toEqual([]);
        const first = detailCalls.find((c) => c.at >= T0 + closeAt);
        expect(first && first.at - (T0 + closeAt)).toBeLessThanOrEqual(ZTO_SIGNED_SWEEP_ACTIVE_MS + 5000);
    });
});

describe('ការផ្ទៀងផ្ទាត់ឡើងវិញ ៖ quota និងល្បឿនដែលឯកសារសន្យា', () => {
    function rangeServer(opts: { mismatch?: number, detailClosed?: boolean | null, detailFails?: (now: number) => boolean } = {}) {
        const signed: { at: number, from: string, to: string }[] = [];
        const detail: number[] = [];
        vi.stubGlobal('fetch', vi.fn(async (u: string) => {
            const url = new URL(String(u));
            const now = Date.now();
            if (url.searchParams.get('signed') === '1') {
                signed.push({ at: now, from: String(url.searchParams.get('from')), to: String(url.searchParams.get('to')) });
                return json({ success: true, list: true, enabled: true, kind: 'signed', page: 1, pages: 1, total: 0, rows: [],
                    signed: [], signedOk: true, signedMismatch: opts.mismatch || 0 });
            }
            detail.push(now);
            if (opts.detailFails && opts.detailFails(now)) return json({ error: 'ZTO HTTP 502', code: 'ZTO_UPSTREAM_UNAVAILABLE' }, 502);
            return json({ success: true, found: true, ztoClosed: opts.detailClosed === undefined ? null : opts.detailClosed });
        }));
        return { signed, detail };
    }
    const dayKey = (back: number) => getZoneDateKey(T0, -back);

    it('Q1 ៖ ជួរ «ចុះហត្ថលេខា» ផ្ទុយមួយ មិនធ្វើឲ្យជួរអានជាប់ ៨ ថ្ងៃរៀងរាល់ ២០ វិ. ទៀតទេ (ជួរបង្រួម · តែការរង់ចាំលុយនៅ)', async () => {
        dataState.scanHistory = [openItem('a', 'ZTC0000041')];
        const srv = rangeServer({ mismatch: 1 });
        scheduleZtoStatusSweep(1500);
        await runApp(3 * MIN, { signedAt: {}, active: true });
        expect(srv.signed.length, 'លក្ខខណ្ឌចាំបាច់ ៖ អានច្រើនជុំ').toBeGreaterThanOrEqual(4);
        expect(srv.signed[0].from, 'ជុំដំបូងអានជួរវែង').toBe(dayKey(ZTO_SIGNED_SWEEP_LOOKBACK_DAYS));
        expect(srv.signed.slice(1).every((c) => c.from === dayKey(1)), '⛔ ជុំបន្ទាប់អានតែម្សិលមិញ ➜ ថ្ងៃនេះ').toBe(true);
        expect(ztoAbandonCleanupIsHeld(T0 - 60000), 'ទិសផ្ទុយ ៖ ជួរផ្ទុយនៅរក្សាការរង់ចាំលុយ (មិន «ពេញលេញ»)').toBe(true);
    });

    it('Q4 ៖ កញ្ចប់បិទច្រើនជាង ZTO_STATUS_MAX ➜ /detail សួរម្តងក្នុងមួយកញ្ចប់ (មិនវិលជុំគ្មានទីបញ្ចប់ពេល verdict ត្រូវបណ្តេញ)', async () => {
        const items: any[] = [];
        for (let i = 0; i < 400; i++) items.push(closedItem('c' + i, 'ZTQ' + String(4000000 + i)));
        dataState.scanHistory = items;
        const srv = rangeServer({ detailClosed: true });
        scheduleZtoStatusSweep(1500);
        await runApp(30 * MIN, { signedAt: {} });
        expect(srv.detail.length, 'លក្ខខណ្ឌចាំបាច់ ៖ សួរគ្រប់កញ្ចប់').toBeGreaterThanOrEqual(400);
        expect(srv.detail.length, '⛔ គ្មានការសួរម្តងទៀតព្រោះ verdict ត្រូវបណ្តេញ (មុនកែ ៖ ~៣០/នាទី ជារៀងរហូត)').toBeLessThanOrEqual(400 + 10);
    });

    it('T3 ៖ ទុកចោល ➜ ចាប់ផ្តើមប្រើ ➜ ការអានបន្ទាប់តាមល្បឿនសកម្ម (មិនរង់ចាំ timer ១ នាទីដែលតាំងរួច)', async () => {
        dataState.scanHistory = [openItem('a', 'ZTC0000042')];
        const srv = rangeServer();
        scheduleZtoStatusSweep(1500);
        await runApp(3 * MIN, { signedAt: {} });
        await vi.advanceTimersByTimeAsync(25 * 1000);
        const last = srv.signed[srv.signed.length - 1].at;
        const tapAt = Date.now();
        expect(tapAt - last, 'លក្ខខណ្ឌចាំបាច់ ៖ ប៉ះក្រោយការអានចុងក្រោយលើស ២០ វិ. (timer ១ នាទីនៅរង់ចាំ)').toBeGreaterThan(ZTO_SIGNED_SWEEP_ACTIVE_MS);
        expect(tapAt - last).toBeLessThan(ZTO_SIGNED_SWEEP_VISIBLE_MS - 10 * 1000);
        noteZtoUserActivity();
        await runApp(70 * 1000, { signedAt: {}, active: true });
        const next = srv.signed.find((c) => c.at > tapAt);
        expect(next, 'មានការអានក្រោយប៉ះ').toBeTruthy();
        expect(next!.at - Math.max(tapAt, last + ZTO_SIGNED_SWEEP_ACTIVE_MS), '⛔ តាមល្បឿនសកម្ម (មុនកែ ៖ រហូតដល់ ៦០ វិ.)').toBeLessThanOrEqual(2000);
        expect(next!.at - last, 'មិនលឿនជាងល្បឿនសកម្ម').toBeGreaterThanOrEqual(ZTO_SIGNED_SWEEP_ACTIVE_MS);
    });

    it('T3 ទិសផ្ទុយ ៖ ប៉ះភ្លាមក្រោយការអាន ➜ ការអានបន្ទាប់នៅតែរង់ចាំល្បឿនសកម្មពីការអានចុងក្រោយ (មិនលឿនជាង)', async () => {
        dataState.scanHistory = [openItem('a', 'ZTC0000048')];
        const srv = rangeServer();
        scheduleZtoStatusSweep(1500);
        await runApp(3 * MIN, { signedAt: {} });
        await vi.advanceTimersByTimeAsync(10 * 1000);
        const last = srv.signed[srv.signed.length - 1].at;
        expect(Date.now() - last, 'លក្ខខណ្ឌចាំបាច់ ៖ ប៉ះក្នុង ២០ វិ. ក្រោយការអាន').toBeLessThan(ZTO_SIGNED_SWEEP_ACTIVE_MS);
        noteZtoUserActivity();
        await runApp(40 * 1000, { signedAt: {}, active: true });
        const next = srv.signed.find((c) => c.at > last);
        expect(next, 'មានការអានបន្ទាប់').toBeTruthy();
        expect(next!.at - last, '⛔ មិនលឿនជាងល្បឿនសកម្ម').toBeGreaterThanOrEqual(ZTO_SIGNED_SWEEP_ACTIVE_MS);
        expect(next!.at - last, 'ហើយមិនរង់ចាំ timer ១ នាទី').toBeLessThanOrEqual(ZTO_SIGNED_SWEEP_ACTIVE_MS + 2000);
    });

    it('Q4 (កញ្ចប់បើក) ៖ កញ្ចប់បើកច្រើនជាង ZTO_STATUS_MAX ➜ /detail សួរម្តងក្នុងមួយម៉ោង (verdict ដែលត្រូវបណ្តេញ មិនធ្វើឲ្យសួរវិលជុំ)', async () => {
        const items: any[] = [];
        for (let i = 0; i < 400; i++) items.push(openItem('o' + i, 'ZTO' + String(5000000 + i)));
        dataState.scanHistory = items;
        const srv = rangeServer({ detailClosed: null });
        scheduleZtoStatusSweep(1500);
        await runApp(30 * MIN, { signedAt: {} });
        expect(srv.detail.length, 'លក្ខខណ្ឌចាំបាច់ ៖ សួរគ្រប់កញ្ចប់').toBeGreaterThanOrEqual(400);
        expect(srv.detail.length, '⛔ គ្មានការសួរម្តងទៀតក្នុងម៉ោងតែមួយ').toBeLessThanOrEqual(400 + 10);
    });

    it('T4 ៖ /detail ចន្លោះទ្វេ ១០ នាទី + Lookup កំពុងរត់ ➜ ការអានបញ្ជីចុះហត្ថលេខាដើរវិញតាមល្បឿនសកម្ម (មិនជាប់ ៦២០ វិ.)', async () => {
        dataState.scanHistory = [openItem('a', 'ZTC0000043')];
        const srv = rangeServer({ detailFails: () => true });
        const w: World = { signedAt: {}, active: true, lookup: (now) => now >= T0 + 15 * MIN && now < T0 + 15 * MIN + 20 * 1000 };
        scheduleZtoStatusSweep(1500);
        await runApp(25 * MIN, w);
        expect(ztoState.ztoStatusFailStreak, 'លក្ខខណ្ឌចាំបាច់ ៖ /detail ចន្លោះទ្វេធំ').toBeGreaterThanOrEqual(3);
        const after = srv.signed.filter((c) => c.at >= T0 + 15 * MIN);
        expect(after.length).toBeGreaterThan(0);
        expect(after[0].at - (T0 + 15 * MIN + 20 * 1000), '⛔ ក្រោយ Lookup ចប់ ➜ ≤ ល្បឿនសកម្ម').toBeLessThanOrEqual(ZTO_SIGNED_SWEEP_ACTIVE_MS + 2000);
        const gaps = after.slice(1).map((c, i) => c.at - after[i].at);
        expect(Math.max(...gaps)).toBeLessThanOrEqual(ZTO_SIGNED_SWEEP_ACTIVE_MS + 2000);
    });

    it('T4 ៖ App លាក់ + /detail ចន្លោះទ្វេ ១០ នាទី ➜ ការអានបញ្ជីចុះហត្ថលេខានៅ ~២ នាទី (មិនជាប់ ៦៦០ វិ.)', async () => {
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
        dataState.scanHistory = [openItem('a', 'ZTC0000044')];
        const srv = rangeServer({ detailFails: () => true });
        scheduleZtoStatusSweep(1500);
        await runApp(45 * MIN, { signedAt: {} });
        expect(ztoState.ztoStatusFailStreak).toBeGreaterThanOrEqual(3);
        const late = srv.signed.filter((c) => c.at >= T0 + 15 * MIN);
        const gaps = late.slice(1).map((c, i) => c.at - late[i].at);
        expect(gaps.length).toBeGreaterThan(5);
        expect(Math.max(...gaps), '⛔ ≤ ZTO_SIGNED_SWEEP_GAP_MS + ជុំ ៦០ វិ.').toBeLessThanOrEqual(ZTO_SIGNED_SWEEP_GAP_MS + MIN + 2000);
        expect(Math.min(...gaps), 'មិនលឿនជាង ZTO_SIGNED_SWEEP_GAP_MS').toBeGreaterThanOrEqual(ZTO_SIGNED_SWEEP_GAP_MS);
    });

    it('G2 ៖ /detail ធ្លាក់ ➜ ចន្លោះទ្វេពិត (ការអាន ២០ វិ. មិនបង្ខំ /detail រៀងរាល់ជុំ)', async () => {
        dataState.scanHistory = [openItem('a', 'ZTC0000045')];
        const srv = rangeServer({ detailFails: () => true });
        scheduleZtoStatusSweep(1500);
        await runApp(20 * MIN, { signedAt: {}, active: true });
        expect(srv.signed.length).toBeGreaterThan(20);
        expect(srv.detail.length, '⛔ ២០ វិ. ➜ ៦០ ➜ ១៨០ ➜ ៦០០ វិ. ➜ ≤ ៦ ក្នុង ២០ នាទី').toBeLessThanOrEqual(6);
    });

    it('G3 ៖ ជួរអានដំបូងរំលងកញ្ចប់ដែលបិទទាំងស្រុង (កញ្ចប់បិទចាស់ ២៥ ថ្ងៃ មិនពង្រីកជួរ)', async () => {
        const old = closedItem('old', 'ZTC0000046');
        old.createdAt = T0 - 25 * 24 * 3600000;
        dataState.scanHistory = [old, openItem('a', 'ZTC0000047')];
        setZtoPickupVerdict('ZTC0000046', true);
        const srv = rangeServer();
        await runZtoStatusSweep(false);
        expect(srv.signed.length).toBe(1);
        expect(srv.signed[0].from).toBe(dayKey(ZTO_SIGNED_SWEEP_LOOKBACK_DAYS));
    });
});

describe('ការពិនិត្យប្រឆាំង ៖ សារពិត · timer /detail', () => {
    function detailServer(closed: boolean | null) {
        const detail: number[] = [];
        vi.stubGlobal('fetch', vi.fn(async (u: string) => {
            const url = new URL(String(u));
            if (url.searchParams.get('signed') === '1') return json({ success: true, list: true, enabled: true, kind: 'signed', page: 1, pages: 1, rows: [], signed: [], signedOk: true });
            detail.push(Date.now());
            return json({ success: true, found: true, ztoClosed: closed });
        }));
        return detail;
    }

    it('Q4 ៖ «កំពុងពិនិត្យបន្ត N» រាប់តែកញ្ចប់ដែលការបោសនឹងសួរពិត (verdict ដែលត្រូវបណ្តេញ ហើយមិនសួរម្តងទៀត មិនរាប់)', async () => {
        const items: any[] = [];
        for (let i = 0; i < 401; i++) items.push(closedItem('u' + i, 'ZTU' + String(6000000 + i)));
        dataState.scanHistory = items;
        detailServer(true);
        scheduleZtoStatusSweep(1500);
        await runApp(25 * MIN, { signedAt: {} });
        expect(ztoStatusUnmeasuredCount(), '⛔ គ្មានការសួរបន្ត ➜ មិនប្រាប់ថា «កំពុងពិនិត្យ»').toBe(0);
    });

    it('T3 ៖ ប៉ះក្រោយទុកចោល មិនបោះ timer បន្តរបស់ /detail (កុងតាក់បិទតាម ZTO បិទ)', async () => {
        appLocalStore.setItem('zoew_zto_autoclose_v1', '0');
        const items: any[] = [];
        for (let i = 0; i < 60; i++) items.push(closedItem('t' + i, 'ZTT' + String(7000000 + i)));
        dataState.scanHistory = items;
        const detail = detailServer(null);
        scheduleZtoStatusSweep(1500);
        await vi.advanceTimersByTimeAsync(3000);
        expect(detail.length, 'លក្ខខណ្ឌចាំបាច់ ៖ ជុំដំបូង ១០').toBe(10);
        noteZtoUserActivity();
        await vi.advanceTimersByTimeAsync(2000);
        expect(!!ztoState.ztoStatusSweepTimer, '⛔ timer បន្តនៅ').toBe(true);
        await vi.advanceTimersByTimeAsync(21 * 1000);
        expect(detail.length, '⛔ ជុំទី ២ តាមពេល (មិនរង់ចាំជុំ ៦០ វិ.)').toBe(20);
    });
});
