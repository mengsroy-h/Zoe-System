import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dataState, firebaseState, lookupState, ztoState } from '../src/core/state';
import { appLocalStore } from '../src/core/storage';
import { resetZtoFinalMarks, syncZtoFinalMarks } from '../src/features/zto-final-marks';
import { setZtoPickupVerdict, ztoPickupStatus } from '../src/features/zto-status';

const PATH = 'zoew_scan_history_cod_dod/mark-session';
const CODE = 'KH1000000099';
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

function deferred() {
    let resolve!: () => void;
    const promise = new Promise<void>((done) => { resolve = done; });
    return { promise, resolve };
}

let server: any;
let transaction: ReturnType<typeof vi.fn>;

function installDeferredTransaction() {
    const gate = deferred();
    const firstProposal: any[] = [];
    transaction.mockImplementationOnce(async (ref: any, update: any) => {
        expect(ref.path).toBe(PATH);
        firstProposal.push(update(clone(server)));
        await gate.promise;
        const next = update(clone(server));
        if (next !== undefined) server = next;
        return { committed: next !== undefined, snapshot: { val: () => clone(server) } };
    });
    return { gate, firstProposal };
}

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-26T03:00:00Z'));
    appLocalStore.clear();
    resetZtoFinalMarks();
    ztoState.ztoFinalInFlight = false;
    ztoState.ztoStatusLoaded = true;
    ztoPickupStatus.clear();
    firebaseState.authGeneration++;
    firebaseState.db = { name: 'final-mark-db' } as any;
    server = { id: 'mark-session', phone: '081000001', createdAt: 1, isClosed: true,
        barcodes: [{ code: CODE, createdAt: 1, isClosed: true, closedAt: 5, cod: 3, dod: 1 }] };
    dataState.scanHistory = [clone(server)];
    dataState.deletedItems = [];
    transaction = vi.fn(async (_ref: any, update: any) => {
        const next = update(clone(server));
        if (next !== undefined) server = next;
        return { committed: next !== undefined, snapshot: { val: () => clone(server) } };
    });
    firebaseState.fb = { ref: (_db: unknown, path: string) => ({ path }), runTransaction: transaction } as any;
    setZtoPickupVerdict(CODE, true, Date.now() - 1000);
});

afterEach(() => {
    resetZtoFinalMarks();
    vi.clearAllTimers();
    vi.useRealTimers();
    appLocalStore.clear();
});

describe('ត្រា ZTO ៖ transaction យឺត និងវគ្គថ្មី', () => {
    it('CAS សាកម្តងទៀតក្នុងវគ្គដដែល ➜ កត់ Sign ម្តង និងរក្សាលុយ', async () => {
        const { gate, firstProposal } = installDeferredTransaction();
        const running = syncZtoFinalMarks();
        expect(firstProposal[0].barcodes[0].ztoSignedAt).toBeGreaterThan(0);
        gate.resolve();
        expect(await running).toBe(1);
        expect(server.barcodes[0]).toMatchObject({ ztoSignedExact: true, cod: 3, dod: 1, closedAt: 5 });
        expect(transaction).toHaveBeenCalledOnce();
    });

    it.each(['auth', 'lookup', 'reset'])('CAS សាកម្តងទៀតក្រោយ %s ប្តូរ ➜ មិនយកភស្តុតាងចាស់ទៅកត់ DB', async (change) => {
        const { gate, firstProposal } = installDeferredTransaction();
        const before = clone(server);
        const running = syncZtoFinalMarks();
        expect(firstProposal[0].barcodes[0].ztoSignedAt).toBeGreaterThan(0);
        expect(server).toEqual(before);
        if (change === 'auth') firebaseState.authGeneration++;
        else if (change === 'lookup') lookupState.customerDataTableSessionGeneration++;
        else resetZtoFinalMarks();
        gate.resolve();
        expect(await running).toBe(0);
        expect(server).toEqual(before);
    });

    it('reset អនុញ្ញាតវគ្គថ្មី · ចម្លើយចាស់មិនដោះសោការកត់ថ្មី', async () => {
        const old = installDeferredTransaction();
        const oldRun = syncZtoFinalMarks();
        expect(old.firstProposal).toHaveLength(1);
        firebaseState.authGeneration++;
        resetZtoFinalMarks();
        const next = installDeferredTransaction();
        const nextRun = syncZtoFinalMarks();
        expect(next.firstProposal, 'វគ្គថ្មីមិនរង់ចាំ timeout របស់វគ្គចាស់').toHaveLength(1);
        old.gate.resolve();
        expect(await oldRun).toBe(0);
        expect(ztoState.ztoFinalInFlight).toBe(true);
        expect(await syncZtoFinalMarks()).toBe(0);
        expect(transaction).toHaveBeenCalledTimes(2);
        next.gate.resolve();
        expect(await nextRun).toBe(1);
        expect(ztoState.ztoFinalInFlight).toBe(false);
    });
});
