import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dataState, firebaseState, securityState, uiState, ztoState } from '../src/core/state';
import { appLocalStore } from '../src/core/storage';
import { getZoneDateKey } from '../src/core/timezone';
import { cleanupInFlight, runAutomaticCleanupRules } from '../src/domain/cleanup';
import { clearCustomerDataTableCache } from '../src/features/customer-table';
import { ZTO_ABANDON_HOLD_MAX_MS, clearZtoPickupStatusStore, runZtoStatusSweep, scheduleZtoStatusSweep } from '../src/features/zto-status';
import { linkIsFrugal } from '../src/services/network';

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
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
let tx: string[] = [];
let updates: { path: string; patch: any }[] = [];

function openItem(id: string, code: string, ageMs: number) {
    return { id, phone: '0963897345', scanDate: getZoneDateKey(NOW - ageMs, 0), isClosed: false, createdAt: NOW - ageMs,
        cod: 1, dod: 0, count: 1, barcode: code, barcodes: [{ code, isClosed: false, cod: 1, dod: 0 }] };
}
function signedPage(codes: string[]) {
    return json({ success: true, list: true, enabled: true, kind: 'signed', page: 1, pages: 1, total: codes.length,
        rows: [], otherScans: 0, signedScans: codes.length, signed: codes, signedOk: true });
}
const abandoned = (id: string) => tx.includes('zoew_scan_history_cod_dod/' + id);
function cleanupNow() {
    cleanupInFlight.clear();
    runAutomaticCleanupRules();
}
function advance(ms: number) {
    vi.setSystemTime(new Date(Date.now() + ms));
}
function setLink(value: any) {
    Object.defineProperty(navigator, 'connection', { value, configurable: true, writable: true });
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
    updates = [];
    cleanupInFlight.clear();
    ztoState.ztoStatusInFlight = false;
    ztoState.ztoStatusSweepTimer = null;
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
    (firebaseState as any).dbRefZtoSignedSweep = { path: 'zoew_settings/zto_signed_sweep' };
    firebaseState.fb = {
        ref: (_db: unknown, path: string) => ({ path }),
        runTransaction: (ref: { path: string }) => {
            tx.push(ref.path);
            return Promise.reject(Object.assign(new Error('audit: not applied'), { txOutcome: 'not-applied' }));
        },
        update: async (ref: { path: string }, patch: any) => {
            updates.push({ path: ref.path, patch });
            return true;
        },
        onValue: () => () => {},
        off: () => {},
        getIdTokenResult: async () => ({ token: 'audit-token' })
    } as any;
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    securityState.lookupSecretKey = null;
    ztoState.ztoAbandonHoldSince = 0;
    ztoState.ztoAbandonCheckedAt = 0;
    ztoState.ztoSignedSweepAt = 0;
    ztoState.ztoSignedCompleteAt = 0;
});

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    setLink(undefined);
    appLocalStore.clear();
    firebaseState.db = null as any;
    firebaseState.fb = null as any;
    firebaseState.serverClockTrusted = false;
    firebaseState.isDatabaseConnected = false;
});

async function runCycleMinutes(ms: number, abandonedAtStart = -1) {
    let abandonedAtMin = abandonedAtStart;
    for (let m = 1; m * 60000 <= ms; m++) {
        advance(60000);
        scheduleZtoStatusSweep();
        await runZtoStatusSweep(false);
        cleanupNow();
        if (abandonedAtMin < 0 && abandoned('sig1')) abandonedAtMin = m;
    }
    return abandonedAtMin;
}


const LOCKED_CFG = JSON.stringify({ enabled: true, fastMode: true, headerName: 'X-Zoe-Proxy-Key', headerValueEnc: 'enc',
    url: 'https://example.invalid/.netlify/functions/zto-order-detail?barcode={barcode}' });

describe('7-day cleanup on a device whose sign-list read is blocked (ZTO-1)', () => {
    for (const [label, link] of [['Data Saver', { saveData: true, effectiveType: '4g' }], ['2g link', { saveData: false, effectiveType: '2g' }]] as const) {
        it('1. ' + label + ' ៖ a ripe parcel ZTO signed is read during the hold and closed as pickup ➜ never abandoned in 45 min', async () => {
            setLink(link);
            expect(linkIsFrugal()).toBe(true);
            dataState.scanHistory = [openItem('sig1', 'ZTE1000001', 8 * DAY)];
            const fetchSpy = vi.fn(async () => signedPage(['ZTE1000001']));
            vi.stubGlobal('fetch', fetchSpy);
            cleanupNow();
            const abandonedAtMin = await runCycleMinutes(45 * 60000);
            expect(fetchSpy.mock.calls.length).toBeGreaterThan(0);
            expect(h.calls.map((c) => c.code)).toContain('ZTE1000001');
            expect(abandonedAtMin).toBe(-1);
        });
    }

    it('2. reverse ៖ Data Saver with only young open parcels ➜ no sign-list read (Data Saver respected)', async () => {
        setLink({ saveData: true, effectiveType: '4g' });
        dataState.scanHistory = [openItem('young', 'ZTE1000002', 1 * DAY)];
        const fetchSpy = vi.fn(async () => signedPage([]));
        vi.stubGlobal('fetch', fetchSpy);
        cleanupNow();
        await runCycleMinutes(10 * 60000);
        expect(fetchSpy.mock.calls.length).toBe(0);
    });

    it('3. secret locked (no PIN since reload) ៖ the hold clock waits while the device cannot read ➜ not abandoned in 45 min ➜ PIN ➜ read ➜ closed as pickup', async () => {
        setLink(undefined);
        appLocalStore.setItem('zoew_lookup_api_config', LOCKED_CFG);
        dataState.scanHistory = [openItem('sig1', 'ZTE1000001', 8 * DAY)];
        const fetchSpy = vi.fn(async () => signedPage(['ZTE1000001']));
        vi.stubGlobal('fetch', fetchSpy);
        cleanupNow();
        const lockedAbandon = await runCycleMinutes(45 * 60000);
        expect(fetchSpy.mock.calls.length).toBe(0);
        expect(lockedAbandon).toBe(-1);
        securityState.lookupSecretKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
        const after = await runCycleMinutes(10 * 60000);
        expect(h.calls.map((c) => c.code)).toContain('ZTE1000001');
        expect(after).toBe(-1);
    });

    it('4. reverse (never stuck) ៖ secret unlocked, ZTO has not signed the parcel ➜ abandoned within the normal hold', async () => {
        setLink(undefined);
        appLocalStore.setItem('zoew_lookup_api_config', LOCKED_CFG);
        dataState.scanHistory = [openItem('sig1', 'ZTE1000001', 8 * DAY)];
        vi.stubGlobal('fetch', vi.fn(async () => signedPage([])));
        cleanupNow();
        await runCycleMinutes(20 * 60000);
        expect(abandoned('sig1')).toBe(false);
        securityState.lookupSecretKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
        const at = await runCycleMinutes(ZTO_ABANDON_HOLD_MAX_MS + 5 * 60000);
        expect(at).toBeGreaterThan(0);
    });
});
