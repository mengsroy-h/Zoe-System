import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { dataState, firebaseState } from '../src/core/state';
import { appLocalStore } from '../src/core/storage';
import { applyPickupMarksInMemory, buildPickupRecordFromSet, commitPickupMarks, pickupResetRecord } from '../src/domain/pickup';

const DAY = '2026-10-30', SCOPE = 'https://f09-preservation.invalid', UID = 'f09-owner';
const receipt = () => ({ v: 1, outcome: 'applied', proof: 'native-day', tenant: 'f09-project', actorUid: UID, scope: SCOPE,
    batchId: 'batch-original', batchHash: 'b'.repeat(64), dayId: 'batch-original:' + DAY, day: DAY, nonce: 'attempt-original',
    attemptId: 'a'.repeat(64), intentHash: 'a'.repeat(64), beforeRevision: 3, beforeEpoch: 1, afterRevision: 4, afterEpoch: 2 });
const record = () => ({ pickupRevision: 8, pickupResetEpoch: 2, packagesPickedUp: 1,
    pickedUpBarcodes: { BEFORE: '000000001' }, pickedUpPhones: { '000000001': 1 }, pickupResetApplied: receipt() });
const mark = { key: 'AFTER', phoneKey: '000000002', closed: true };
let server: any, writes: any[];
beforeEach(() => {
    appLocalStore.clear(); appLocalStore.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: SCOPE }));
    server = record(); writes = []; firebaseState.authGeneration++;
    firebaseState.db = { app: { options: { databaseURL: SCOPE } } } as any;
    firebaseState.auth = { currentUser: { uid: UID } } as any; firebaseState.isInitializingFirebase = false;
    firebaseState.fb = { ref: (_db: any, path: string) => ({ path }), get: async () => ({ val: () => structuredClone(server) }),
        runTransaction: async (_ref: any, updater: any) => {
            const next = updater(structuredClone(server));
            if (next !== undefined) { server = structuredClone(next); writes.push(structuredClone(next)); }
            return { committed: next !== undefined, snapshot: { val: () => structuredClone(server) } };
        } } as any;
    dataState.dailyPickupData = { [DAY]: structuredClone(server) };
    (window as any).ZoeErrors = { capture: vi.fn() };
});
afterEach(() => { appLocalStore.clear(); vi.restoreAllMocks(); delete (window as any).ZoeErrors; });
const context = () => ({ date: DAY, db: firebaseState.db, sdk: firebaseState.fb, generation: firebaseState.authGeneration,
    scope: SCOPE, uid: UID, revision: 8, epoch: 2 });

it('F09 ordinary set builder រក្សា exact latest APPLIED proof ដោយមិនប្ដូរប្រភព', () => {
    const prior = record(), before = structuredClone(prior);
    const next = buildPickupRecordFromSet({ AFTER: '000000002' }, { revision: 9, epoch: 2 }, prior);
    expect(next.pickupResetApplied).toEqual(receipt()); expect(prior).toEqual(before);
    expect(next.packagesPickedUp).toBe(1); expect(next.pickedUpBarcodes).toEqual({ AFTER: '000000002' });
});
it('F09 optimistic pickup view រក្សា original receipt និងកំណត់អតិថិជន/កញ្ចប់ត្រឹមត្រូវ', () => {
    applyPickupMarksInMemory(DAY, [mark]);
    expect(dataState.dailyPickupData[DAY].pickupResetApplied).toEqual(receipt());
    expect(dataState.dailyPickupData[DAY].packagesPickedUp).toBe(2);
    expect(dataState.dailyPickupData[DAY].pickedUpBarcodes).toEqual({ BEFORE: '000000001', AFTER: '000000002' });
});
it('F09 actual ordinary pickup transaction រក្សា receipt នៅ server និង view', async () => {
    expect(await commitPickupMarks(DAY, [mark], false, false, undefined, context())).toBe(true);
    expect(writes).toHaveLength(1); expect(server.pickupResetApplied).toEqual(receipt());
    expect(dataState.dailyPickupData[DAY].pickupResetApplied).toEqual(receipt());
    expect(server.pickupRevision).toBe(9); expect(server.pickupResetEpoch).toBe(2); expect(server.packagesPickedUp).toBe(2);
});
it.each([null, {}, { ...receipt(), outcome: 'unknown' }, { ...receipt(), extra: true }, { ...receipt(), afterEpoch: 3 }])(
    'F09 malformed existing proof មិនត្រូវ silently drop ក្នុង local ordinary writer (%j)', proof => {
        dataState.dailyPickupData[DAY] = { ...record(), pickupResetApplied: proof }; const before = structuredClone(dataState.dailyPickupData);
        expect(() => applyPickupMarksInMemory(DAY, [mark])).toThrow('PICKUP_RESET_PROOF_INVALID');
        expect(dataState.dailyPickupData).toEqual(before);
    });
it('F09 malformed server proof រក្សា HOLD មិន apply ordinary pickup', async () => {
    server.pickupResetApplied = { ...receipt(), intentHash: 'c'.repeat(64) }; const before = structuredClone(server);
    expect(await commitPickupMarks(DAY, [mark], false, true, undefined, context())).not.toBe(true);
    expect(server).toEqual(before); expect(writes).toEqual([]);
});
it('F09 legacy record គ្មាន proof នៅតែធ្វើ ordinary pickup ដដែល', async () => {
    delete server.pickupResetApplied; dataState.dailyPickupData[DAY] = structuredClone(server);
    expect(await commitPickupMarks(DAY, [mark], false, false, undefined, context())).toBe(true);
    expect(server.packagesPickedUp).toBe(2); expect(server).not.toHaveProperty('pickupResetApplied');
});
it('F09 Reset builder នៅជា BASE គ្មាន stale/new receipt រហូត physical CAS ភ្ជាប់ proof ថ្មី', () => {
    expect(pickupResetRecord(record())).toEqual({ pickupRevision: 9, pickupResetEpoch: 3,
        packagesPickedUp: 0, pickedUpPhones: null, pickedUpBarcodes: null });
});
