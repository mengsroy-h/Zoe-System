import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dataState, firebaseState, uiState, ztoState } from '../src/core/state';
import { appLocalStore } from '../src/core/storage';
import { autoLookupInFlight } from '../src/features/auto-lookup';
import { clearCustomerDataTableCache } from '../src/features/customer-table';
import { clearZtoPickupStatusStore, loadZtoPickupStatusOnce, runZtoStatusSweep, setZtoPickupVerdict, ztoPickupStatus } from '../src/features/zto-status';
import { collectZtoFinalTargets } from '../src/features/zto-final-marks';

const T0 = Date.UTC(2026, 9, 6, 3, 0, 0);
const HOUR = 3600000;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
let detailCalls: string[] = [];
let answer: any = null;

function closedItem(id: string, code: string) {
    return { id, phone: '0960007345', scanDate: '2026-10-06', isClosed: true, closedAt: T0 - 60000, createdAt: T0 - HOUR,
        barcodes: [{ code, isClosed: true, closedAt: T0 - 60000, cod: 1, dod: 0, createdAt: T0 - HOUR }] };
}

function setup(url: string, fastMode: boolean) {
    appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify({ enabled: true, fastMode, url: window.location.origin + url }));
    vi.stubGlobal('fetch', vi.fn(async (u: string) => {
        const parsed = new URL(String(u));
        if (parsed.searchParams.get('list') === '1') return json({ success: false, list: true, enabled: false, code: 'ZTO_LIST_NOT_CONFIGURED', reason: 'idtoken:project-unset' });
        detailCalls.push(String(u));
        return json(answer);
    }));
}

async function hourlySweeps(hours: number) {
    for (let i = 1; i <= hours; i++) {
        vi.setSystemTime(new Date(T0 + i * HOUR));
        ztoState.ztoStatusLastSweepAt = 0;
        ztoState.ztoSignedSweepAt = 0;
        await runZtoStatusSweep(false);
    }
}

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(T0));
    appLocalStore.clear();
    clearCustomerDataTableCache();
    clearZtoPickupStatusStore();
    detailCalls = [];
    autoLookupInFlight.clear();
    ztoState.ztoStatusInFlight = false;
    ztoState.ztoStatusLastSweepAt = 0;
    ztoState.ztoStatusFailStreak = 0;
    dataState.scanHistory = [];
    dataState.deletedItems = [];
    uiState.isModalOpen = false;
    firebaseState.serverTimeOffsetMs = 0;
    firebaseState.db = { evidence: true } as any;
    firebaseState.authGeneration++;
});

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); appLocalStore.clear(); });

describe('ZTO Sign evidence keeps flowing to the pickup cleanup', () => {
    it.each([false, true])('Cookie (Fast Mode %s, sign list off): a closed barcode answered «not signed» is asked again hourly, so a later Sign is stamped', async (fastMode) => {
        setup('/.netlify/functions/zto-order-detail?barcode={barcode}', fastMode);
        dataState.scanHistory = [closedItem('a', 'ZTC0000001')];
        answer = { success: true, found: true, barcode: 'ZTC0000001', ztoClosed: false };
        await runZtoStatusSweep(false);
        expect(ztoPickupStatus.get('ZTC0000001')).toMatchObject({ closed: false });
        answer = { success: true, found: true, barcode: 'ZTC0000001', ztoClosed: true };
        const before = detailCalls.length;
        await hourlySweeps(3);
        expect(detailCalls.length - before, 'hourly recheck, bounded').toBeGreaterThanOrEqual(1);
        expect(detailCalls.length - before).toBeLessThanOrEqual(3);
        expect(ztoPickupStatus.get('ZTC0000001')).toMatchObject({ closed: true });
        expect(collectZtoFinalTargets().map((t: any) => t.path)).toEqual(['zoew_scan_history_cod_dod/a']);
    });

    it('Palm: an inconclusive Sign-time probe never erases a confirmed Sign verdict', async () => {
        setup('/.netlify/functions/zto-order-detail?palm=1&barcode={barcode}', true);
        dataState.scanHistory = [closedItem('p', 'ZTP0000001')];
        setZtoPickupVerdict('ZTP0000001', true);
        const confirmed = ztoPickupStatus.get('ZTP0000001');
        expect(collectZtoFinalTargets()).toHaveLength(1);
        answer = { success: true, found: true, barcode: 'ZTP0000001', provider: 'zto-palm', ztoClosed: null, ztoSignedAt: null };
        vi.setSystemTime(new Date(T0 + 30000));
        await runZtoStatusSweep(false);
        expect(detailCalls.length, 'the probe really ran').toBe(1);
        expect(ztoPickupStatus.get('ZTP0000001')).toMatchObject({ closed: true, signedAt: confirmed.signedAt });
        expect(collectZtoFinalTargets()).toHaveLength(1);
        answer = { success: true, found: true, barcode: 'ZTP0000001', provider: 'zto-palm', ztoClosed: false };
        await hourlySweeps(2);
        expect(ztoPickupStatus.get('ZTP0000001')).toMatchObject({ closed: true });
        answer = { success: true, found: true, barcode: 'ZTP0000001', provider: 'zto-palm', ztoClosed: true, ztoSignedAt: '2026-10-06 09:30:00' };
        await hourlySweeps(2);
        expect(ztoPickupStatus.get('ZTP0000001')).toMatchObject({ closed: true, signedAtExact: true });
    });

    it('reloading stored verdicts before the server clock is known keeps an exact Sign time', () => {
        const signed = T0 - 5 * 60000;
        appLocalStore.setItem('zoew_zto_pickup_status_v1', JSON.stringify({ ZTX0000001: { closed: true, at: T0 - 40 * 60000, signedAt: signed, signedAtExact: true },
            ZTX0000002: { closed: true, at: T0 - 40 * 60000 } }));
        ztoState.ztoStatusLoaded = false;
        ztoPickupStatus.clear();
        vi.setSystemTime(new Date(T0 - 30 * 60000));
        firebaseState.serverTimeOffsetMs = 0;
        firebaseState.isDatabaseConnected = false;
        firebaseState.hasEverConnectedToDatabase = false;
        loadZtoPickupStatusOnce();
        expect(ztoPickupStatus.get('ZTX0000001')).toMatchObject({ closed: true, signedAt: signed, signedAtExact: true });
        expect(ztoPickupStatus.get('ZTX0000002').signedAt, 'no device-clock guess before the server offset').toBeFalsy();
    });

    function openItem(id: string, code: string) {
        return { id, phone: '0960007345', scanDate: '2026-10-06', isClosed: false, createdAt: T0 - HOUR,
            barcodes: [{ code, isClosed: false, cod: 1, dod: 0, createdAt: T0 - HOUR }] };
    }

    async function minuteSweeps(fromMs: number, minutes: number) {
        for (let m = 0; m < minutes; m++) {
            vi.setSystemTime(new Date(fromMs + m * 61000));
            await runZtoStatusSweep(false);
        }
    }

    it('ZS-4 · closed barcode «not signed»: sweeps every 61 s ask ZTO exactly once per hour', async () => {
        setup('/.netlify/functions/zto-order-detail?barcode={barcode}', true);
        dataState.scanHistory = [closedItem('a', 'ZTC0000002')];
        answer = { success: true, found: true, barcode: 'ZTC0000002', ztoClosed: false };
        await minuteSweeps(T0, 58);
        expect(detailCalls.length, 'first hour').toBe(1);
        await minuteSweeps(T0 + 61 * 60000, 3);
        expect(detailCalls.length, 'one more after the hour').toBe(2);
    });

    it('ZS-1 · an open barcode holding a cached «signed» verdict (its close failed) is asked once per hour, not every sweep', async () => {
        setup('/.netlify/functions/zto-order-detail?barcode={barcode}', true);
        dataState.scanHistory = [openItem('o', 'ZTO0000003')];
        vi.setSystemTime(new Date(T0 - 2 * HOUR));
        setZtoPickupVerdict('ZTO0000003', true);
        answer = { success: true, found: true, barcode: 'ZTO0000003', ztoClosed: false };
        await minuteSweeps(T0, 58);
        expect(detailCalls.length).toBeLessThanOrEqual(1);
        expect(ztoPickupStatus.get('ZTO0000003')).toMatchObject({ closed: false });
    });

    it('ZS-2 · a closed «not signed» barcode stays in the not-closed bar through a transient unclear answer, and a later Sign is still stamped', async () => {
        setup('/.netlify/functions/zto-order-detail?barcode={barcode}', true);
        dataState.scanHistory = [closedItem('b', 'ZTC0000004')];
        answer = { success: true, found: true, barcode: 'ZTC0000004', ztoClosed: false };
        await runZtoStatusSweep(false);
        expect(ztoPickupStatus.get('ZTC0000004')).toMatchObject({ closed: false });
        answer = { success: false, found: false, barcode: 'ZTC0000004', code: 'ZTO_NOT_FOUND', cached: false };
        vi.setSystemTime(new Date(T0 + HOUR + 60000));
        ztoState.ztoStatusLastSweepAt = 0;
        await runZtoStatusSweep(false);
        expect(detailCalls.length).toBe(2);
        expect(ztoPickupStatus.get('ZTC0000004'), 'unclear answer keeps «not signed»').toMatchObject({ closed: false });
        answer = { success: true, found: true, barcode: 'ZTC0000004', ztoClosed: true };
        vi.setSystemTime(new Date(T0 + 2 * HOUR + 2 * 60000));
        ztoState.ztoStatusLastSweepAt = 0;
        await runZtoStatusSweep(false);
        expect(ztoPickupStatus.get('ZTC0000004')).toMatchObject({ closed: true });
        expect(collectZtoFinalTargets().map((t: any) => t.path)).toEqual(['zoew_scan_history_cod_dod/b']);
    });

    it('ZS-3 · saving another verdict before the server clock is known keeps an exact Sign time that is newer than the device clock', () => {
        const signed = T0 - 5 * 60000;
        appLocalStore.setItem('zoew_zto_pickup_status_v1', JSON.stringify({ ZTX0000005: { closed: true, at: T0 - 40 * 60000, signedAt: signed, signedAtExact: true } }));
        ztoState.ztoStatusLoaded = false;
        ztoPickupStatus.clear();
        vi.setSystemTime(new Date(T0 - 30 * 60000));
        firebaseState.isDatabaseConnected = false;
        firebaseState.hasEverConnectedToDatabase = false;
        loadZtoPickupStatusOnce();
        setZtoPickupVerdict('ZTX0000009', false);
        const stored = JSON.parse(appLocalStore.getItem('zoew_zto_pickup_status_v1')!);
        expect(stored.ZTX0000005).toMatchObject({ signedAt: signed, signedAtExact: true });
    });
});
