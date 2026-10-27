import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dataState, firebaseState, uiState, ztoState } from '../src/core/state';
import { appLocalStore } from '../src/core/storage';
import { getZoneDateKey } from '../src/core/timezone';
import { cleanupInFlight, runAutomaticCleanupRules } from '../src/domain/cleanup';
import { pickupBarcodeKey } from '../src/domain/pickup';
import { clearCustomerDataTableCache } from '../src/features/customer-table';
import { clearZtoPickupStatusStore, runZtoStatusSweep, setZtoPickupVerdict, ztoPickupStatus } from '../src/features/zto-status';

// A barcode ZTO reports signed but that is still open in ZoeW (a close that failed, or a person reopened it) must never
// be removed by the 8-day rule as «ត្រឡប់» (money deducted): the sign round closes it as pickup once its abandon is ripe
// (devices without ZTO Lookup trust the shop marker of that round), and the device that holds the `true` verdict skips
// the abandon claim of that barcode meanwhile (only that barcode: an unsigned ripe sibling leaves at once, and with
// auto-close off nothing on this device closes it, so it holds nothing). A verdict of an earlier lifecycle (signed before
// the restore) never holds the abandon.

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

function openItem(id: string, code: string, ageMs: number, extra: Record<string, unknown> = {}) {
    return { id, phone: '0960007345', scanDate: getZoneDateKey(NOW - ageMs, 0), isClosed: false, createdAt: NOW - ageMs,
        cod: 5, dod: 0, count: 1, barcode: code, barcodes: [{ code, isClosed: false, cod: 5, dod: 0, ...extra }] };
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

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(NOW));
    appLocalStore.clear();
    appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify({ enabled: true, fastMode: true,
        url: window.location.origin + '/.netlify/functions/zto-order-detail?barcode={barcode}' }));
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
    firebaseState.auth = { currentUser: { uid: 'guard-user' } } as any;
    firebaseState.db = { name: 'guard-db' } as any;
    firebaseState.fb = {
        ref: (_db: unknown, path: string) => ({ path }),
        runTransaction: (ref: { path: string }) => {
            tx.push(ref.path);
            return Promise.reject(Object.assign(new Error('guard: not applied'), { txOutcome: 'not-applied' }));
        },
        getIdTokenResult: async () => ({ token: 'guard-token' })
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

describe('8-day rule vs a ZTO-signed barcode that is still open', () => {
    it('control: signed and closed by the sign round ➜ pickup, never abandoned', async () => {
        dataState.scanHistory = [openItem('ok1', 'ZTG1000001', 8 * DAY)];
        vi.stubGlobal('fetch', vi.fn(async () => signedPage(['ZTG1000001'])));
        await runZtoStatusSweep(false);
        expect(h.calls.map((c) => c.code)).toEqual(['ZTG1000001']);
        cleanupNow();
        expect(abandoned('ok1')).toBe(false);
    });

    it('a recent `true` verdict on an abandon-ripe barcode no longer holds the close ➜ the sign round closes it as pickup', async () => {
        dataState.scanHistory = [openItem('held1', 'ZTG2000001', 8 * DAY)];
        setZtoPickupVerdict('ZTG2000001', true);
        vi.stubGlobal('fetch', vi.fn(async () => signedPage(['ZTG2000001'])));
        await runZtoStatusSweep(false);
        expect(h.calls.map((c) => c.code), 'ZTO evidence beats the reopen hold once the 8-day rule would act').toEqual(['ZTG2000001']);
        expect(dataState.scanHistory[0].barcodes[0].isClosed).toBe(true);
        cleanupNow();
        expect(abandoned('held1')).toBe(false);
    });

    it('a recent `true` verdict on a barcode that is not abandon-ripe keeps the reopen hold', async () => {
        dataState.scanHistory = [openItem('young1', 'ZTG3000001', 3 * DAY)];
        setZtoPickupVerdict('ZTG3000001', true);
        vi.stubGlobal('fetch', vi.fn(async () => signedPage(['ZTG3000001'])));
        await runZtoStatusSweep(false);
        expect(h.calls, 'held for the hour after a manual reopen').toEqual([]);
        expect(dataState.scanHistory[0].barcodes[0].isClosed).toBe(false);
    });

    it('/detail says signed but the close fails ➜ this device never abandons it; the next sign round closes it', async () => {
        dataState.scanHistory = [openItem('fail1', 'ZTG4000001', 8 * DAY)];
        h.ok = false;
        vi.stubGlobal('fetch', vi.fn(async (u: string) => (new URL(String(u)).searchParams.get('signed') === '1'
            ? signedPage([])
            : json({ success: true, found: true, ztoClosed: true }))));
        await runZtoStatusSweep(false);
        expect(h.calls.map((c) => c.code), '/detail tried to close').toEqual(['ZTG4000001']);
        expect(ztoPickupStatus.get(pickupBarcodeKey('ZTG4000001'))?.closed).toBe(true);
        cleanupNow();
        expect(abandoned('fail1'), 'ZTO says signed ➜ never deducted as «ត្រឡប់»').toBe(false);
        h.calls.length = 0;
        h.ok = true;
        vi.stubGlobal('fetch', vi.fn(async () => signedPage(['ZTG4000001'])));
        vi.setSystemTime(new Date(NOW + 3 * 60 * 1000));
        await runZtoStatusSweep(false);
        expect(h.calls.map((c) => c.code)).toEqual(['ZTG4000001']);
        cleanupNow();
        expect(abandoned('fail1')).toBe(false);
    });

    it('a sign verdict older than the barcode\'s restore never holds the abandon of the restored lifecycle', () => {
        const restoredAt = NOW - 8 * DAY;
        dataState.scanHistory = [openItem('old1', 'ZTG5000001', 20 * DAY, { restoredAt })];
        ztoPickupStatus.set(pickupBarcodeKey('ZTG5000001'), { closed: true, at: Date.now(), signedAt: restoredAt - 60000, signedAtExact: true });
        appLocalStore.setItem('zoew_zto_autoclose_v1', '0');
        cleanupNow();
        expect(abandoned('old1')).toBe(true);
    });

    const claimedRows = () => {
        const out: any[] = [];
        const calls: Record<string, number> = {};
        (firebaseState.fb as any).runTransaction = (ref: { path: string }, updater: (v: any) => any) => {
            tx.push(ref.path);
            const row = dataState.scanHistory.find((i: any) => 'zoew_scan_history_cod_dod/' + i.id === ref.path);
            const next = updater(JSON.parse(JSON.stringify(row)));
            const call = calls[ref.path] = (calls[ref.path] || 0) + 1;
            if (call > 2) return Promise.resolve({ committed: false, snapshot: { val: () => row } });
            if (call === 1) {
                if (next === undefined) return Promise.resolve({ committed: false, snapshot: { val: () => row } });
                dataState.scanHistory = dataState.scanHistory.map((i: any) => (i === row ? next : i));
                return Promise.resolve({ committed: true, snapshot: { val: () => JSON.parse(JSON.stringify(next)) } });
            }
            out.push(next === null ? null : next && next.barcodes.map((b: any) => b.code));
            return Promise.reject(Object.assign(new Error('guard: not applied'), { txOutcome: 'not-applied' }));
        };
        return out;
    };
    const signedAndPlain = (id: string) => ({ ...openItem(id, 'ZTG7000001', 8 * DAY), count: 2, cod: 10,
        barcodes: [{ code: 'ZTG7000001', isClosed: false, cod: 5, dod: 0 }, { code: 'ZTG7000002', isClosed: false, cod: 5, dod: 0 }] });

    it('a signed-open barcode holds only itself: its unsigned ripe sibling leaves at once (partial claim)', async () => {
        dataState.scanHistory = [signedAndPlain('pair1')];
        h.ok = false;
        vi.stubGlobal('fetch', vi.fn(async (u: string) => {
            const url = new URL(String(u));
            if (url.searchParams.get('signed') === '1') return signedPage([]);
            return json({ success: true, found: true, ztoClosed: url.searchParams.get('barcode') === 'ZTG7000001' });
        }));
        await runZtoStatusSweep(false);
        expect(ztoPickupStatus.get(pickupBarcodeKey('ZTG7000001'))?.closed, '/detail: signed, its close failed').toBe(true);
        const rows = claimedRows();
        cleanupNow();
        expect(abandoned('pair1'), 'the unsigned sibling does not wait for the signed one').toBe(true);
        await vi.waitFor(() => expect(rows, 'the claim leaves the signed barcode in history').toEqual([['ZTG7000001']]));
    });

    it('auto-close off: nothing on this device closes the signed barcode ➜ no hold (the 8-day rule runs as configured)', async () => {
        dataState.scanHistory = [signedAndPlain('pair2')];
        setZtoPickupVerdict('ZTG7000001', true);
        appLocalStore.setItem('zoew_zto_autoclose_v1', '0');
        const rows = claimedRows();
        cleanupNow();
        await vi.waitFor(() => expect(rows, 'the whole row leaves').toEqual([null]));
    });

    it('control: an unsigned abandon-ripe barcode is still removed by the 8-day rule', () => {
        dataState.scanHistory = [openItem('plain1', 'ZTG6000001', 8 * DAY)];
        appLocalStore.setItem('zoew_zto_autoclose_v1', '0');
        cleanupNow();
        expect(abandoned('plain1')).toBe(true);
    });
});
