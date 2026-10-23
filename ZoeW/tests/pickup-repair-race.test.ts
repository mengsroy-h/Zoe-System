import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dataState, firebaseState } from '../src/core/state';
import { dbListenerPendingPaths } from '../src/core/text';
import { planPickupLedgerRepair, repairPickupLedgerOnce } from '../src/domain/pickup';

const DAY = '2026-10-23';
const PHONE_A = '012000111';
const PHONE_B = '012000222';
const clone = (value: any) => JSON.parse(JSON.stringify(value));
const saved = {
    db: firebaseState.db,
    fb: firebaseState.fb,
    auth: firebaseState.auth,
    generation: firebaseState.authGeneration,
    failed: firebaseState.dbListenersFailed,
    history: dataState.scanHistory,
    deleted: dataState.deletedItems,
    pickup: dataState.dailyPickupData,
    done: dataState.pickupLedgerRepairDone,
    running: dataState.pickupLedgerRepairRunning
};
let server: any;
let beforeTransaction: (() => void) | null;
let writes: any[];

function seedLegacy() {
    const record = { packagesPickedUp: 1, pickedUpPhones: { [PHONE_A]: 1, ghost: 1 } };
    dataState.dailyPickupData = { [DAY]: clone(record) };
    dataState.scanHistory = [{ id: 'item-a', scanDate: DAY, phone: PHONE_A, barcodes: [{ code: 'PARCEL_A', isClosed: true }] }];
    server = clone(record);
}

beforeEach(() => {
    firebaseState.db = { name: 'pickup-repair-test' } as any;
    firebaseState.auth = { currentUser: { uid: 'staff' } } as any;
    firebaseState.authGeneration = 1;
    firebaseState.dbListenersFailed = false;
    dbListenerPendingPaths.clear();
    dataState.deletedItems = [];
    dataState.pickupLedgerRepairDone = false;
    dataState.pickupLedgerRepairRunning = false;
    beforeTransaction = null;
    writes = [];
    firebaseState.fb = {
        ref: (_db: unknown, path: string) => ({ path }),
        runTransaction: vi.fn(async (_ref: unknown, update: (record: any) => any) => {
            beforeTransaction?.();
            const proposed = update(clone(server));
            if (proposed !== undefined) {
                server = clone(proposed);
                writes.push(clone(proposed));
            }
            return { committed: proposed !== undefined, snapshot: { val: () => clone(server) } };
        })
    } as any;
    seedLegacy();
});

afterEach(() => {
    firebaseState.db = saved.db;
    firebaseState.fb = saved.fb;
    firebaseState.auth = saved.auth;
    firebaseState.authGeneration = saved.generation;
    firebaseState.dbListenersFailed = saved.failed;
    dataState.scanHistory = saved.history;
    dataState.deletedItems = saved.deleted;
    dataState.dailyPickupData = saved.pickup;
    dataState.pickupLedgerRepairDone = saved.done;
    dataState.pickupLedgerRepairRunning = saved.running;
});

describe('ជួសជុលស្ថិតិយក៖ សំណុំ server មិនត្រូវបាត់ដោយទិដ្ឋភាពចាស់', () => {
    it('ទិដ្ឋភាព history ចាស់៖ សំណុំ barcode ដែលមានរួចមិនត្រូវបានគណនាសរសេរជាន់ឡើងវិញ', async () => {
        const current = { packagesPickedUp: 1, pickedUpPhones: { [PHONE_B]: 1 }, pickedUpBarcodes: { PARCEL_B: PHONE_B } };
        dataState.dailyPickupData = { [DAY]: clone(current) };
        server = clone(current);
        expect(planPickupLedgerRepair(dataState.dailyPickupData, dataState.scanHistory, [])).toEqual([]);
        await repairPickupLedgerOnce();
        expect(server).toEqual(current);
        expect(writes).toEqual([]);
    });

    it('ឧបករណ៍ផ្សេងបើក A ហើយបិទ B មុន transaction៖ ចំនួននៅ ១ តែ B ត្រូវបានរក្សា', async () => {
        const otherDevice = { packagesPickedUp: 1, pickedUpPhones: { [PHONE_B]: 1 }, pickedUpBarcodes: { PARCEL_B: PHONE_B } };
        beforeTransaction = () => { server = clone(otherDevice); };
        await repairPickupLedgerOnce();
        expect(server).toEqual(otherDevice);
        expect(writes).toEqual([]);
    });

    it('ឧបករណ៍ចាស់កែទូរស័ព្ទដោយចំនួនដដែលមុន transaction៖ មិនសរសេរលេខចាស់ត្រឡប់', async () => {
        const otherDevice = { packagesPickedUp: 1, pickedUpPhones: { [PHONE_B]: 1 } };
        beforeTransaction = () => { server = clone(otherDevice); };
        await repairPickupLedgerOnce();
        expect(server).toEqual(otherDevice);
        expect(writes).toEqual([]);
    });

    it('ទិសផ្ទុយ៖ ledger ចាស់មិនបានប្រែ ហើយប្រភពនៅគ្រប់ អាចជួសជុលលេខខ្មោចបាន', async () => {
        await repairPickupLedgerOnce();
        expect(server).toEqual({ packagesPickedUp: 1, pickedUpPhones: { [PHONE_A]: 1 }, pickedUpBarcodes: { PARCEL_A: PHONE_A } });
        expect(writes).toHaveLength(1);
    });

    for (const [label, previousSet] of [
        ['កូនសោជំនួសសុទ្ធ', { _lg_012000111_1: PHONE_A, _lg_012000222_1: PHONE_B }],
        ['កូនសោពិតលាយជាមួយកូនសោជំនួស', { PARCEL_A: PHONE_A, _lg_012000222_1: PHONE_B }],
        ['កូនសោពិតដែលនៅមិនគ្រប់', { PARCEL_A: PHONE_A }]
    ] as const) {
        it(`ទិសផ្ទុយ៖ ${label} នៅអាចផ្លាស់ទៅសំណុំពិតពេលប្រភពគ្រប់`, async () => {
            dataState.scanHistory.push({ id: 'item-b', scanDate: DAY, phone: PHONE_B, barcodes: [{ code: 'PARCEL_B', isClosed: true }] });
            const record = { packagesPickedUp: 2, pickedUpPhones: { [PHONE_A]: 1, [PHONE_B]: 1 }, pickedUpBarcodes: clone(previousSet) };
            dataState.dailyPickupData = { [DAY]: clone(record) };
            server = clone(record);
            await repairPickupLedgerOnce();
            expect(server).toEqual({ packagesPickedUp: 2, pickedUpPhones: { [PHONE_A]: 1, [PHONE_B]: 1 }, pickedUpBarcodes: { PARCEL_A: PHONE_A, PARCEL_B: PHONE_B } });
            expect(writes).toHaveLength(1);
        });
    }

    it('ប្តូរវគ្គមុន callback transaction៖ មិនបញ្ចប់ផែនការរបស់វគ្គចាស់', async () => {
        const original = clone(server);
        beforeTransaction = () => { firebaseState.authGeneration++; };
        await repairPickupLedgerOnce();
        expect(server).toEqual(original);
        expect(writes).toEqual([]);
    });

    it('ទិសផ្ទុយ៖ Reset របស់ឧបករណ៍ផ្សេងមុន transaction នៅតែជា ០', async () => {
        beforeTransaction = () => { server = { packagesPickedUp: 0 }; };
        await repairPickupLedgerOnce();
        expect(server).toEqual({ packagesPickedUp: 0 });
    });
});
