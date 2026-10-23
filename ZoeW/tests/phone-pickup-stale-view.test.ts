import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const form = vi.hoisted(() => ({ phone: '0961111111' }));
vi.mock('../src/app/refs', async (original) => {
    const real: any = await original();
    return { ...real, fieldValue: (name: string) => name === 'editPhoneInput' ? form.phone : '', setFieldValue: () => {}, focusField: () => {} };
});

import { dataState, firebaseState, uiState } from '../src/core/state';
import { saveEditedPhone } from '../src/features/entry-ops';
import { DB_OP_TIMEOUT_MS } from '../src/services/network';

const DAY = '2026-10-23';
const PHONE_A = '0961111111';
const PHONE_B = '0972222222';
const clone = (value: any) => value === undefined ? undefined : structuredClone(value);
const savedFb = firebaseState.fb;
let serverHistory: any;
let serverPickup: any;
let pickupWrites: number;
let held: { update: (value: any) => any; resolve: (value: any) => void } | null;
let holdHistory: boolean;
let refuseHistory: boolean;

const flush = async () => { for (let i = 0; i < 8; i++) await vi.advanceTimersByTimeAsync(0); };
const row = (id: string, code: string, phone: string) => ({ id, phone, scanDate: DAY, count: 1, isClosed: true, closedAt: 1,
    cod: 5, dod: 0, price: 5, barcodes: [{ code, cod: 5, dod: 0, isClosed: true, closedAt: 1 }] });

function commit(update: (value: any) => any) {
    const next = update(clone(serverHistory));
    if (next !== undefined) serverHistory = clone(next);
    return { committed: next !== undefined, snapshot: { val: () => clone(serverHistory) } };
}

beforeEach(() => {
    vi.useFakeTimers();
    form.phone = PHONE_A;
    holdHistory = false;
    refuseHistory = false;
    held = null;
    pickupWrites = 0;
    firebaseState.authGeneration++;
    firebaseState.db = { name: 'phone-pickup' } as any;
    firebaseState.dbRefHistory = { path: 'zoew_scan_history_cod_dod' } as any;
    firebaseState.dbRefDailyPickup = { path: 'zoew_daily_pickup_cod_dod' } as any;
    firebaseState.dbLivenessProbe = Promise.resolve(null) as any;
    dataState.scanHistory = [row('item1', 'PARCEL_A', PHONE_A), row('item2', 'PARCEL_B', PHONE_B)] as any;
    dataState.deletedItems = [];
    serverHistory = row('item1', 'PARCEL_A', PHONE_B);
    serverPickup = { packagesPickedUp: 2, pickedUpPhones: { [PHONE_B]: 2 }, pickedUpBarcodes: { PARCEL_A: PHONE_B, PARCEL_B: PHONE_B } };
    dataState.dailyPickupData = { [DAY]: clone(serverPickup) };
    uiState.toasts = [];
    uiState.editingItemId = 'item1';
    firebaseState.fb = {
        ref: (_db: any, path: string) => ({ path }),
        get: async (ref: any) => ({ val: () => ref.path === 'zoew_scan_history_cod_dod' ? { item1: clone(serverHistory), item2: row('item2', 'PARCEL_B', PHONE_B) } : null }),
        runTransaction: (ref: any, update: (value: any) => any) => {
            if (ref.path === 'zoew_scan_history_cod_dod/item1') {
                if (holdHistory) return new Promise((resolve) => { held = { update, resolve }; });
                if (refuseHistory) return Promise.resolve({ committed: false, snapshot: { val: () => clone(serverHistory) } });
                return Promise.resolve(commit(update));
            }
            expect(ref.path).toBe('zoew_daily_pickup_cod_dod/' + DAY);
            const next = update(clone(serverPickup));
            if (next !== undefined) { serverPickup = clone(next); pickupWrites++; }
            return Promise.resolve({ committed: next !== undefined, snapshot: { val: () => clone(serverPickup) } });
        }
    } as any;
});

afterEach(() => {
    firebaseState.fb = savedFb;
    firebaseState.dbLivenessProbe = null as any;
    vi.clearAllTimers();
    vi.useRealTimers();
});

describe('កែទូរស័ព្ទពីទិដ្ឋភាពចាស់៖ ស្ថិតិអតិថិជនត្រូវតាមតម្លៃដែល server រក្សាទុក', () => {
    for (const late of [false, true]) {
        it(`លេខក្នុងទម្រង់មិនប្រែ តែឧបករណ៍ផ្សេងបានកែ៖ ${late ? 'ចម្លើយយឺត' : 'ចម្លើយភ្លាម'} រក្សា ២ កញ្ចប់ និងផ្ទេរម្ចាស់ key`, async () => {
            holdHistory = late;
            expect(dataState.scanHistory[0].phone).toBe(form.phone);
            expect(serverHistory.phone).toBe(PHONE_B);
            const saving = saveEditedPhone();
            if (late) {
                await flush();
                expect(held).not.toBeNull();
                await vi.advanceTimersByTimeAsync(DB_OP_TIMEOUT_MS + 5);
                expect(await saving).toBe('pending');
                const pending = held!;
                pending.resolve(commit(pending.update));
            } else await saving;
            await flush();
            expect(serverHistory.phone).toBe(PHONE_A);
            expect(serverPickup).toEqual({ packagesPickedUp: 2, pickedUpPhones: { [PHONE_A]: 1, [PHONE_B]: 1 }, pickedUpBarcodes: { PARCEL_A: PHONE_A, PARCEL_B: PHONE_B } });
            expect(pickupWrites).toBe(1);
        });
    }

    it('ទិសផ្ទុយ៖ ទាំងសតិ និង server មានលេខដដែល ហើយ Reset រួច៖ ការរក្សាទុកដដែលមិនបង្កើត pickup ឡើងវិញ', async () => {
        serverHistory.phone = PHONE_A;
        serverPickup = { packagesPickedUp: 0 };
        dataState.dailyPickupData = { [DAY]: clone(serverPickup) };
        await saveEditedPhone();
        await flush();
        expect(serverPickup).toEqual({ packagesPickedUp: 0 });
        expect(pickupWrites).toBe(0);
    });

    for (const late of [false, true]) {
        it(`កែទូរស័ព្ទបរាជ័យ ${late ? 'ក្រោយ timeout' : 'ភ្លាម'}៖ ស្តារ pickup តាមម្ចាស់លើ server មិនមែនលេខចាស់ក្នុងសតិ`, async () => {
            form.phone = '0983333333';
            dataState.dailyPickupData = { [DAY]: { packagesPickedUp: 2, pickedUpPhones: { [PHONE_A]: 1, [PHONE_B]: 1 }, pickedUpBarcodes: { PARCEL_A: PHONE_A, PARCEL_B: PHONE_B } } };
            holdHistory = late;
            refuseHistory = true;
            expect(serverHistory.phone).toBe(PHONE_B);
            const saving = saveEditedPhone();
            expect(serverPickup.pickedUpBarcodes.PARCEL_A).toBe(form.phone);
            if (late) {
                await flush();
                await vi.advanceTimersByTimeAsync(DB_OP_TIMEOUT_MS + 5);
                expect(await saving).toBe('pending');
                held!.resolve({ committed: false, snapshot: { val: () => clone(serverHistory) } });
            } else expect(await saving).toBe(false);
            await flush();
            expect(serverHistory.phone).toBe(PHONE_B);
            expect(serverPickup).toEqual({ packagesPickedUp: 2, pickedUpPhones: { [PHONE_B]: 2 }, pickedUpBarcodes: { PARCEL_A: PHONE_B, PARCEL_B: PHONE_B } });
        });
    }
});
