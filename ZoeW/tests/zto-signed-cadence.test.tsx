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
import {
    ZTO_SIGNED_SWEEP_ACTIVE_MS, ZTO_SIGNED_SWEEP_FAIL_MAX_MS, ZTO_SIGNED_SWEEP_GAP_MS, ZTO_SIGNED_SWEEP_VISIBLE_MS,
    clearZtoPickupStatusStore, noteZtoUserActivity, runZtoStatusSweep, scheduleZtoStatusSweep
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
