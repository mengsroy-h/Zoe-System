import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dataState, firebaseState, securityState, uiState, ztoState } from '../src/core/state';
import { appLocalStore } from '../src/core/storage';
import { getZoneDateKey } from '../src/core/timezone';
import { clearCustomerDataTableCache } from '../src/features/customer-table';
import { autoLookupInFlight, ZTO_AUTO_LOOKUP_TIMEOUT_MS } from '../src/features/auto-lookup';
import { clearZtoPickupStatusStore, runZtoStatusSweep, ztoPickupStatus } from '../src/features/zto-status';

const lab = vi.hoisted(() => ({ reads: [] as string[], writes: [] as string[], activeReads: 0, maxReads: 0,
    activeWrites: 0, maxWrites: 0, ledger: 0, signed: [] as string[], reject: '', hang: '',
    answers: {} as Record<string, boolean | null>, afterWrite: null as null | (() => void) }));

vi.mock('../src/features/barcode-ops', () => ({
    openViewListModal: () => {}, removeSingleBarcode: async () => 'failed', toggleIndividualBarcodeClose: async () => false,
    openEditBarcodePriceModal: () => {}, closeEditBarcodeModal: () => {}, saveEditedBarcodePrice: () => {},
    applyBarcodeCloseChange: async (itemId: string, code: string) => {
        lab.activeWrites++;
        lab.maxWrites = Math.max(lab.maxWrites, lab.activeWrites);
        const before = lab.ledger;
        await new Promise((resolve) => setTimeout(resolve, 5));
        const item = dataState.scanHistory.find((v) => v.id === itemId);
        const barcode = item?.barcodes.find((v) => v.code === code);
        if (barcode) {
            barcode.isClosed = true;
            lab.ledger = before + barcode.cod;
        }
        lab.writes.push(code);
        lab.activeWrites--;
        lab.afterWrite?.();
        return true;
    }
}));

const NOW = Date.UTC(2026, 9, 24, 3);
const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
const online = (value: boolean) => Object.defineProperty(navigator, 'onLine', { configurable: true, value });

function seed(count = 10) {
    const barcodes = Array.from({ length: count }, (_, i) => ({ code: 'ZTOSW' + String(i).padStart(4, '0'), cod: i + 1,
        dod: 0, isClosed: false, createdAt: NOW - 10000 }));
    dataState.scanHistory = [{ id: 'same-customer', phone: '012345678', scanDate: getZoneDateKey(NOW, 0),
        createdAt: NOW - 10000, cod: barcodes.reduce((n, b) => n + b.cod, 0), dod: 0, count, barcodes }] as any;
    return barcodes.map((v) => v.code);
}

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    appLocalStore.clear();
    appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify({ enabled: true, fastMode: true,
        url: window.location.origin + '/.netlify/functions/zto-order-detail?barcode={barcode}' }));
    clearCustomerDataTableCache();
    clearZtoPickupStatusStore();
    Object.assign(lab, { reads: [], writes: [], activeReads: 0, maxReads: 0, activeWrites: 0, maxWrites: 0,
        ledger: 0, signed: [], reject: '', hang: '', answers: {}, afterWrite: null });
    dataState.scanHistory = [];
    dataState.deletedItems = [];
    ztoState.ztoStatusInFlight = false;
    ztoState.ztoStatusLastSweepAt = 0;
    ztoState.ztoStatusSweepCursor = 0;
    ztoState.ztoStatusFailStreak = 0;
    ztoState.ztoSignedSweepAt = NOW;
    ztoState.ztoSignedSweepWaitMs = 30 * 60 * 1000;
    uiState.isModalOpen = false;
    uiState.toasts = [];
    firebaseState.authGeneration++;
    firebaseState.auth = { currentUser: { uid: 'sweep-prefetch-test' } } as any;
    firebaseState.db = { name: 'sweep-prefetch-test' } as any;
    firebaseState.fb = { getIdTokenResult: async () => ({ token: 'synthetic-token' }) } as any;
    securityState.lookupSecretKey = null;
    autoLookupInFlight.clear();
    online(true);
    vi.stubGlobal('fetch', vi.fn(async (target, init) => {
        const url = new URL(String(target));
        if (url.searchParams.has('list')) {
            return json({ success: true, list: true, enabled: true, kind: 'signed', page: 1, pages: 1,
                rows: [], signed: lab.signed, signedOk: true });
        }
        const code = url.searchParams.get('barcode') || '';
        lab.reads.push(code);
        lab.activeReads++;
        lab.maxReads = Math.max(lab.maxReads, lab.activeReads);
        try {
            if (code === lab.hang) {
                await new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(new Error('synthetic timeout')), { once: true }));
            } else await new Promise((resolve) => setTimeout(resolve, 80));
            if (code === lab.reject || lab.reject === '*') throw new Error('synthetic failure');
            return json({ ztoClosed: code in lab.answers ? lab.answers[code] : true });
        } finally {
            lab.activeReads--;
        }
    }));
});

afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    autoLookupInFlight.clear();
    online(true);
    appLocalStore.clear();
});

async function complete(ms = 1500) {
    let finishedAt = 0;
    const running = runZtoStatusSweep(false).then((measured) => { finishedAt = Date.now(); return measured; });
    await vi.advanceTimersByTimeAsync(ms);
    return { measured: await running, elapsed: finishedAt - NOW };
}

describe('ZTO ៖ ទាញស្ថានភាពស្របគ្នាមានពិដាន និងរក្សាការសរសេរតាមលំដាប់', () => {
    it('ទាញបីម្តង ហើយបិទដប់កញ្ចប់របស់អតិថិជនម្នាក់តាមលំដាប់', async () => {
        const codes = seed();
        const result = await complete();
        console.info('sweep actual-source synthetic', JSON.stringify({ ...result, maxReads: lab.maxReads, maxWrites: lab.maxWrites, ledger: lab.ledger }));
        expect(lab.reads).toEqual(codes);
        expect(lab.writes).toEqual(codes);
        expect(lab.maxReads).toBe(3);
        expect(lab.maxWrites).toBe(1);
        expect(lab.ledger).toBe(55);
        expect(result.measured).toBe(10);
        expect(result.elapsed).toBeLessThan(500);
        expect(lab.activeReads).toBe(0);
        expect(ztoState.ztoStatusSweepCursor).toBe(10);
        expect(ztoState.ztoStatusInFlight).toBe(false);
    });

    for (const stop of ['session', 'offline', 'scanning'] as const) {
        it('ឈប់ចាប់ផ្តើមសំណើ និងមិនយកចម្លើយយឺតក្រោយ ' + stop, async () => {
            seed();
            const running = runZtoStatusSweep(false);
            await vi.advanceTimersByTimeAsync(20);
            if (stop === 'session') firebaseState.authGeneration++;
            if (stop === 'offline') online(false);
            if (stop === 'scanning') autoLookupInFlight.set('synthetic-scan', {});
            await vi.advanceTimersByTimeAsync(1000);
            await running;
            expect(lab.reads).toHaveLength(3);
            expect(lab.writes).toHaveLength(0);
            expect(ztoPickupStatus.size).toBe(0);
            expect(lab.activeReads).toBe(0);
            expect(ztoState.ztoStatusSweepCursor).toBe(stop === 'session' ? 0 : 1);
        });
    }

    for (const stop of ['offline', 'scanning', 'modal'] as const) {
        it('មិនចាប់ផ្តើមសំណើពេលជាប់លក្ខខណ្ឌ ' + stop, async () => {
            seed();
            if (stop === 'offline') online(false);
            if (stop === 'scanning') autoLookupInFlight.set('synthetic-scan', {});
            if (stop === 'modal') uiState.isModalOpen = true;
            expect(await runZtoStatusSweep(false)).toBe(0);
            expect(lab.reads).toHaveLength(0);
            expect(lab.writes).toHaveLength(0);
        });
    }

    it('ឈប់យកចម្លើយដែលទាញទុក ពេលអ្នកប្រើចាប់ផ្តើមស្កេនកំពុងបិទកញ្ចប់ទីមួយ', async () => {
        const codes = seed();
        lab.afterWrite = () => autoLookupInFlight.set('synthetic-scan', {});
        await complete();
        expect(lab.reads).toEqual(codes.slice(0, 3));
        expect(lab.writes).toEqual(codes.slice(0, 1));
        expect(lab.ledger).toBe(1);
        expect(ztoPickupStatus.size).toBe(1);
        expect(ztoState.ztoStatusSweepCursor).toBe(1);
        expect(lab.activeReads).toBe(0);
    });

    it('ទទួលបរាជ័យនៃសំណើមួយ ហើយរក្សាកញ្ចប់ផ្សេង និង cursor ត្រឹមត្រូវ', async () => {
        const codes = seed();
        lab.reject = codes[0];
        const result = await complete();
        expect(result.measured).toBe(9);
        expect(lab.reads).toEqual(codes);
        expect(lab.writes).toEqual(codes.slice(1));
        expect(lab.maxWrites).toBe(1);
        expect(lab.ledger).toBe(54);
        expect(lab.activeReads).toBe(0);
        expect(ztoState.ztoStatusSweepCursor).toBe(10);
    });

    it('សំណើព្យួរឈប់តាម timeout ដើម ហើយបញ្ចប់ការងារដែលនៅសល់', async () => {
        const codes = seed();
        lab.hang = codes[0];
        const result = await complete(ZTO_AUTO_LOOKUP_TIMEOUT_MS + 1500);
        expect(result.measured).toBe(9);
        expect(lab.reads).toEqual(codes);
        expect(lab.writes).toEqual(codes.slice(1));
        expect(lab.maxReads).toBe(3);
        expect(lab.activeReads).toBe(0);
        expect(ztoState.ztoStatusInFlight).toBe(false);
    });

    it('រក្សា failure backoff ហើយបង្វិល cursor ហួស batch ដែលបរាជ័យទាំងមូល', async () => {
        const codes = seed(13);
        lab.reject = '*';
        expect((await complete()).measured).toBe(0);
        expect(lab.reads).toEqual(codes.slice(0, 10));
        expect(ztoState.ztoStatusFailStreak).toBe(1);
        expect(ztoState.ztoStatusSweepCursor).toBe(10);
        if (ztoState.ztoStatusSweepTimer) clearTimeout(ztoState.ztoStatusSweepTimer);
        ztoState.ztoStatusSweepTimer = null;
        ztoState.ztoStatusLastSweepAt = 0;
        lab.reject = '';
        const priorReads = lab.reads.length;
        expect((await complete()).measured).toBe(10);
        expect(lab.reads.slice(priorReads)).toEqual(codes.slice(10).concat(codes.slice(0, 7)));
        expect(new Set(lab.reads).size).toBe(13);
        expect(lab.maxReads).toBe(3);
        expect(lab.maxWrites).toBe(1);
        expect(ztoState.ztoStatusFailStreak).toBe(0);
        expect(ztoState.ztoStatusSweepCursor).toBe(20);
    });

    it('រំលងលេខដែលបញ្ជីចុះហត្ថលេខាបញ្ជាក់ និងលេខស្ទួនមុនទាញស្ថានភាព', async () => {
        const codes = seed(5);
        dataState.scanHistory[0].barcodes.push({ ...dataState.scanHistory[0].barcodes[2] });
        ztoState.ztoSignedSweepAt = 0;
        lab.signed = [codes[0], codes[3]];
        const result = await complete();
        expect(result.measured).toBe(5);
        expect(lab.reads).toEqual([codes[1], codes[2], codes[4]]);
        expect(new Set(lab.writes).size).toBe(5);
        expect(lab.writes).toHaveLength(5);
        expect(lab.ledger).toBe(15);
        expect(lab.maxWrites).toBe(1);
        // ធាតុដែលបញ្ជី Sign សម្រេចរួចក៏រាប់ថាបានដើរកាត់ដែរ ➜ ធាតុនោះមិនរារាំង cursor (`zto-recheck-bar-first` G)
        expect(ztoState.ztoStatusSweepCursor).toBe(5);
    });

    it('false និង null មិនបិទកញ្ចប់ ហើយមិនបម្លែង unknown ទៅជា signed', async () => {
        const codes = seed(3);
        lab.answers[codes[0]] = false;
        lab.answers[codes[1]] = null;
        expect((await complete()).measured).toBe(2);
        expect(lab.reads).toEqual(codes);
        expect(lab.writes).toEqual([codes[2]]);
        expect(lab.ledger).toBe(3);
        expect(ztoPickupStatus.get(codes[0]).closed).toBe(false);
        expect(ztoPickupStatus.get(codes[1]).closed).toBeNull();
        expect(ztoPickupStatus.get(codes[2]).closed).toBe(true);
    });
});
