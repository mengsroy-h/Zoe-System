import { afterEach, describe, expect, it } from 'vitest';
import { applyPickupMarksToSet, beginPickupIntent, commitPickupMarks, countPickedUpCustomers, endPickupIntent, patchPickupJournalEntry, pickupBarcodeKey, readPickupJournal, tallyPickupPhones } from '../../../../ZoeW/src/domain/pickup';
import { dataState, firebaseState } from '../../../../ZoeW/src/core/state';
import { appLocalStore } from '../../../../ZoeW/src/core/storage';
import { liveShopScope } from '../../../../ZoeW/src/core/shop-scope';
import type { PickupDayView } from '../../../../ZoeW/src/domain/statistics';
import { setPartialBackendFixtureValue } from './helpers/backend-fixture';

describe('ការរាប់ម្ចាស់កញ្ចប់តាមកូនសោ', () => {
    it.each(['constructor', 'toString', '__proto__', 'hasOwnProperty'])('កូនសោ %s រាប់ជាម្ចាស់ផ្ទាល់ ដោយចំនួនជាលេខ', phoneKey => {
        const phones = tallyPickupPhones({ FIRST: phoneKey, SECOND: phoneKey, THIRD: '012345678' });
        expect(Object.prototype.hasOwnProperty.call(phones, phoneKey)).toBe(true);
        expect(phones[phoneKey]).toBe(2);
        expect(phones['012345678']).toBe(1);
        expect(Object.values(phones).every(value => typeof value === 'number')).toBe(true);
        expect(countPickedUpCustomers({ pickedUpPhones: phones })).toBe(2);
        expect(JSON.parse(JSON.stringify(phones))).toEqual(Object.fromEntries([[phoneKey, 2], ['012345678', 1]]));
    });

    it('លេខទូរស័ព្ទ និងម្ចាស់ដែលគ្មានលេខរក្សាចំនួនតាមអត្តសញ្ញាណ', () => {
        expect(tallyPickupPhones({ A: '012345678', B: '012345678', C: '__item_row' }))
            .toEqual({ '012345678': 2, __item_row: 1 });
    });

    it('តម្លៃម្ចាស់មិនត្រឹមត្រូវមិនបង្កើតចំនួន', () => {
        expect(tallyPickupPhones({ EMPTY: '', NUMBER: 3, OBJECT: {}, MISSING: undefined, VALID: '012345678' }))
            .toEqual({ '012345678': 1 });
    });

    it.each(['__proto__', 'hasOwnProperty'])('កូនសោកញ្ចប់ %s រក្សាជា own property មុនពេល adapter ពិនិត្យ', key => {
        const set: Record<string, string> = {};
        applyPickupMarksToSet(set, [{ key, phoneKey: '012345678', closed: true }]);
        expect(Object.prototype.hasOwnProperty.call(set, key)).toBe(true);
        expect(set[key]).toBe('012345678');
        expect(JSON.parse(JSON.stringify(set))).toEqual(Object.fromEntries([[key, '012345678']]));
        applyPickupMarksToSet(set, [{ key, phoneKey: '012345678', closed: false }]);
        expect(Object.prototype.hasOwnProperty.call(set, key)).toBe(false);
    });

    it('កូនសោពី barcode ផ្ទាល់ឆ្លង canonical normalization មុនចូល pickup', () => {
        expect(pickupBarcodeKey('__proto__')).toBe('__PROTO__');
        expect(pickupBarcodeKey('hasOwnProperty')).toBe('HASOWNPROPERTY');
    });
});

describe('ការបញ្ជាក់ projection ក្រោយ pickup CAS', () => {
    const day = '2026-11-15';
    afterEach(() => { appLocalStore.clear(); });

    async function run(corrupt: (record: PickupDayView) => void, phase?: 'before-update' | 'before-response', key = 'CODE_A', closed = true) {
        appLocalStore.clear();
        const config = { databaseURL: 'https://pickup-projection.invalid' };
        appLocalStore.setItem('zoew_firebase_config', JSON.stringify(config));
        const db = { app: { name: 'projection', options: config } };
        let saved: PickupDayView = closed ? { packagesPickedUp: 0, pickupRevision: 1, pickupResetEpoch: 0 }
            : { packagesPickedUp: 1, pickupRevision: 1, pickupResetEpoch: 0,
                pickedUpPhones: { '012345678': 1 }, pickedUpBarcodes: { [key]: '012345678' } };
        let writes = 0;
        const sdk = {
            __supabase: true,
            ref: () => ({ path: day }),
            get: async () => ({ val: () => structuredClone(saved) }),
            runTransaction: async (_ref: unknown, updater: (current: PickupDayView) => PickupDayView | undefined) => {
                if (phase === 'before-update') firebaseState.authGeneration++;
                const next = updater(structuredClone(saved));
                if (next === undefined) return { committed: false, snapshot: { val: () => structuredClone(saved) } };
                saved = structuredClone(next); writes++;
                const observed = structuredClone(saved);
                corrupt(observed);
                if (phase === 'before-response') firebaseState.authGeneration++;
                return { committed: true, snapshot: { val: () => observed } };
            }
        };
        firebaseState.db = db;
        setPartialBackendFixtureValue(firebaseState, 'fb', sdk);
        setPartialBackendFixtureValue(firebaseState, 'auth', { currentUser: { uid: 'projection-owner' } });
        firebaseState.authGeneration++;
        firebaseState.isInitializingFirebase = false;
        dataState.dailyPickupData = { [day]: structuredClone(saved) };
        const intent = beginPickupIntent(day, [key]);
        expect(intent).toBeTruthy();
        expect(patchPickupJournalEntry(intent, { stage: 'started', pickupResetEpoch: 0, allowedAddKeys: [key] })).toBe(true);
        const before = readPickupJournal().find(entry => entry.id === intent);
        const owner = { db, sdk, generation: firebaseState.authGeneration, scope: liveShopScope(), uid: 'projection-owner', date: day, revision: 1, epoch: 0, intent };
        const committed = await commitPickupMarks(day, [{ key, phoneKey: '012345678', closed }], false, true, undefined, owner);
        const ended = await endPickupIntent(intent, committed);
        return { committed, ended, writes, saved, before, after: readPickupJournal().find(entry => entry.id === intent), memory: dataState.dailyPickupData[day] };
    }

    it.each(['packages', 'owner-count', 'owner-missing', 'barcode-missing', 'reserved-barcode-missing'])('committed=true ប៉ុន្តែ snapshot %s មិនអាចបញ្ចប់ durable intent', async field => {
        const key = field === 'reserved-barcode-missing' ? '__proto__' : 'CODE_A';
        const result = await run(record => {
            if (field === 'packages') record.packagesPickedUp = 0;
            else if (field === 'owner-count') record.pickedUpPhones = { '012345678': 0 };
            else if (field === 'owner-missing') record.pickedUpPhones = {};
            else record.pickedUpBarcodes = {};
        }, undefined, key);
        expect(result.committed).toBeNull(); expect(result.ended).toBe(false); expect(result.writes).toBe(1);
        expect(result.after).toEqual({ ...result.before, hold: 'recovery-pending' });
        expect(result.memory).toEqual({ packagesPickedUp: 0, pickupRevision: 1, pickupResetEpoch: 0 });
        expect(result.saved.pickedUpBarcodes).toEqual(Object.fromEntries([[key, '012345678']]));
    });

    it.each(['pickedUpPhones', 'pickedUpBarcodes'].flatMap(field => [false, 0, ''].map(value => ({ field, value }))))('ដកកញ្ចប់ចុងក្រោយ៖ ACK $field=$value មិនអាចក្លាយជាភស្តុតាង map ទទេ', async ({ field, value }) => {
        const result = await run(record => { Reflect.set(record, field, value); }, undefined, 'CODE_A', false);
        expect(result.committed).toBeNull(); expect(result.ended).toBe(false); expect(result.writes).toBe(1);
        expect(result.after).toEqual({ ...result.before, hold: 'recovery-pending' });
        expect(result.saved).toEqual({ packagesPickedUp: 0, pickupRevision: 2, pickupResetEpoch: 0, pickedUpPhones: null, pickedUpBarcodes: null });
        expect(result.memory).toEqual({ packagesPickedUp: 1, pickupRevision: 1, pickupResetEpoch: 0,
            pickedUpPhones: { '012345678': 1 }, pickedUpBarcodes: { CODE_A: '012345678' } });
    });

    it.each([null, undefined, {}, []].map(value => ({ value })))('ដកកញ្ចប់ចុងក្រោយ៖ nullish ឬ object ទទេ $value អាចបញ្ជាក់ empty projection', async ({ value }) => {
        const result = await run(record => {
            Reflect.set(record, 'pickedUpPhones', value); Reflect.set(record, 'pickedUpBarcodes', value);
        }, undefined, 'CODE_A', false);
        expect(result.committed).toBe(true); expect(result.ended).toBe(true); expect(result.writes).toBe(1);
        expect(result.after).toBeUndefined(); expect(result.memory?.packagesPickedUp).toBe(0);
    });

    it('sparse array ពី numeric barcode keys រក្សា own-key projection ដដែល', async () => {
        const result = await run(record => {
            const barcodes: string[] = []; barcodes[2] = '012345678';
            Reflect.set(record, 'pickedUpBarcodes', barcodes);
        }, undefined, '2');
        expect(result.committed).toBe(true); expect(result.ended).toBe(true); expect(result.writes).toBe(1);
        expect(result.after).toBeUndefined(); expect(Object.keys(result.memory?.pickedUpBarcodes || {})).toEqual(['2']);
    });

    it.each(['before-update', 'before-response'] as const)('session ប្ដូរ %s មិនអាចផ្សព្វផ្សាយ snapshot ឬកែ intent ចាស់', async phase => {
        const result = await run(() => {}, phase);
        expect(result.committed).toBeNull(); expect(result.ended).toBe(false);
        expect(result.writes).toBe(phase === 'before-update' ? 0 : 1);
        expect(result.after).toEqual(result.before);
        expect(result.memory).toEqual({ packagesPickedUp: 0, pickupRevision: 1, pickupResetEpoch: 0 });
    });
});
