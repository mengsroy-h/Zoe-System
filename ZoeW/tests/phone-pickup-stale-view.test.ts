import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const form = vi.hoisted(() => ({ phone: '0961111111' }));
vi.mock('../src/app/refs', async (original) => {
    const real: any = await original();
    return { ...real, fieldValue: (name: string) => name === 'editPhoneInput' ? form.phone : '', setFieldValue: () => {}, focusField: () => {} };
});

import { dataState, firebaseState, uiState } from '../src/core/state';
import { saveEditedPhone } from '../src/features/entry-ops';
import { resetPickupStats } from '../src/domain/collected';
import { DB_OP_TIMEOUT_MS } from '../src/services/network';
import { pickupIntentsLive, readPickupJournal } from '../src/domain/pickup';

const DAY = '2026-10-23';
const PHONE_A = '0961111111';
const PHONE_B = '0972222222';
const clone = (value: any) => value === undefined ? undefined : structuredClone(value);
const metadata = { pickupRevision: 5, pickupResetEpoch: 2 };
const resetRecord = () => ({ packagesPickedUp: 0, pickupRevision: (serverPickup?.pickupRevision || 0) + 1, pickupResetEpoch: (serverPickup?.pickupResetEpoch || 0) + 1 });
const savedFb = firebaseState.fb;
let serverHistory: any;
let serverPickup: any;
let pickupWrites: number;
let pickupSnapshots: any[];
let held: { update: (value: any) => any; resolve: (value: any) => void } | null;
let holdHistory: boolean;
let refuseHistory: boolean;
let resetDuringPickupRetry: boolean;

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
    localStorage.clear();
    localStorage.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: 'https://phone-pickup.invalid' }));
    pickupIntentsLive.clear();
    form.phone = PHONE_A;
    holdHistory = false;
    refuseHistory = false;
    held = null;
    pickupWrites = 0;
    pickupSnapshots = [];
    resetDuringPickupRetry = false;
    firebaseState.authGeneration++;
    firebaseState.auth = { currentUser: { uid: 'phone-owner' } };
    firebaseState.isInitializingFirebase = false;
    firebaseState.db = { name: 'phone-pickup' } as any;
    firebaseState.dbRefHistory = { path: 'zoew_scan_history_cod_dod' } as any;
    firebaseState.dbRefDailyPickup = { path: 'zoew_daily_pickup_cod_dod' } as any;
    firebaseState.dbLivenessProbe = Promise.resolve(null) as any;
    dataState.scanHistory = [row('item1', 'PARCEL_A', PHONE_A), row('item2', 'PARCEL_B', PHONE_B)] as any;
    dataState.deletedItems = [];
    serverHistory = row('item1', 'PARCEL_A', PHONE_B);
    serverPickup = { ...metadata, packagesPickedUp: 2, pickedUpPhones: { [PHONE_B]: 2 }, pickedUpBarcodes: { PARCEL_A: PHONE_B, PARCEL_B: PHONE_B } };
    dataState.dailyPickupData = { [DAY]: clone(serverPickup) };
    uiState.toasts = [];
    uiState.editingItemId = 'item1';
    firebaseState.fb = {
        ref: (_db: any, path: string) => ({ path }),
        get: async (ref: any) => ({ val: () => ref.path === 'zoew_daily_pickup_cod_dod/' + DAY ? clone(serverPickup)
            : ref.path === 'zoew_scan_history_cod_dod/item1' ? clone(serverHistory)
                : ref.path === 'zoew_scan_history_cod_dod' ? { item1: clone(serverHistory), item2: row('item2', 'PARCEL_B', PHONE_B) } : null }),
        runTransaction: (ref: any, update: (value: any) => any) => {
            if (ref.path === 'zoew_scan_history_cod_dod/item1') {
                if (holdHistory) return new Promise((resolve) => { held = { update, resolve }; });
                if (refuseHistory) return Promise.resolve({ committed: false, snapshot: { val: () => clone(serverHistory) } });
                return Promise.resolve(commit(update));
            }
            expect(ref.path).toBe('zoew_daily_pickup_cod_dod/' + DAY);
            let next = update(clone(serverPickup));
            if (resetDuringPickupRetry) {
                resetDuringPickupRetry = false;
                serverPickup = resetRecord();
                next = update(clone(serverPickup));
            }
            if (next !== undefined) {
                serverPickup = Object.fromEntries(Object.entries(clone(next)).filter(([, value]) => value !== null));
                pickupWrites++;
                pickupSnapshots.push(clone(serverPickup));
            }
            return Promise.resolve({ committed: next !== undefined, snapshot: { val: () => clone(serverPickup) } });
        }
    } as any;
});

describe('កែទូរស័ព្ទក្រោយ Reset៖ ផ្ទេរតែអត្តសញ្ញាណ pickup ដែលនៅមាន', () => {
    function expectResetKept() {
        expect(serverPickup.packagesPickedUp).toBe(0);
        expect(Object.keys(serverPickup.pickedUpPhones || {})).toEqual([]);
        expect(Object.keys(serverPickup.pickedUpBarcodes || {})).toEqual([]);
    }
    for (const stale of [false, true]) for (const late of [false, true]) {
        it(`ប្តូរលេខក្រោយ Reset៖ view ${stale ? 'ចាស់' : 'ថ្មី'} · ACK ${late ? 'យឺត' : 'ភ្លាម'} មិនបង្កើតកញ្ចប់ឡើងវិញ`, async () => {
            serverHistory.phone = PHONE_A; form.phone = PHONE_B; serverPickup = resetRecord();
            if (!stale) dataState.dailyPickupData = { [DAY]: clone(serverPickup) };
            holdHistory = late; const saving = saveEditedPhone();
            if (late) {
                await flush(); await vi.advanceTimersByTimeAsync(DB_OP_TIMEOUT_MS + 5); expect(await saving).toBe('pending');
                held!.resolve(commit(held!.update));
            } else await saving;
            await flush(); expectResetKept(); expect(serverHistory.phone).toBe(PHONE_B);
            expect(serverHistory.barcodes[0]).toMatchObject({ code: 'PARCEL_A', cod: 5, dod: 0, isClosed: true });
        });
    }

    it('ឧបករណ៍ផ្សេង Reset ចន្លោះ updater និង retry៖ server set ទទេនៅតែទទេ', async () => {
        serverHistory.phone = PHONE_A; form.phone = PHONE_B; resetDuringPickupRetry = true;
        await saveEditedPhone(); await flush();
        expectResetKept(); expect(serverHistory.phone).toBe(PHONE_B);
    });

    for (const late of [false, true]) {
        it(`Save បរាជ័យ ${late ? 'យឺត' : 'ភ្លាម'} ក្រោយ Reset៖ rollback មិនបង្កើត key ដែលបានលុប`, async () => {
            form.phone = '0983333333'; serverPickup = resetRecord();
            refuseHistory = true; holdHistory = late;
            const saving = saveEditedPhone();
            if (late) {
                await flush(); await vi.advanceTimersByTimeAsync(DB_OP_TIMEOUT_MS + 5); expect(await saving).toBe('pending');
                held!.resolve({ committed: false, snapshot: { val: () => clone(serverHistory) } });
            } else expect(await saving).toBe(false);
            await flush(); expectResetKept(); expect(serverHistory.phone).toBe(PHONE_B);
        });
    }

    it('Reset មកក្រោយផ្ទេរ pickup តែមុនចម្លើយ History បរាជ័យ៖ rollback រក្សា Reset', async () => {
        form.phone = '0983333333'; holdHistory = true;
        const saving = saveEditedPhone(); await flush();
        expect(serverPickup.pickedUpBarcodes.PARCEL_A).toBe(form.phone);
        serverPickup = resetRecord();
        await vi.advanceTimersByTimeAsync(DB_OP_TIMEOUT_MS + 5); expect(await saving).toBe('pending');
        held!.resolve({ committed: false, snapshot: { val: () => clone(serverHistory) } });
        await flush(); expectResetKept();
    });

    it('history ពីរកញ្ចប់ តែ pickup នៅសល់មួយ៖ ផ្ទេរមួយ មិនបូក key ដែលបាន Reset', async () => {
        form.phone = '0983333333';
        const item = { ...row('item1', 'PARCEL_A', PHONE_A), count: 2, barcodes: [row('item1', 'PARCEL_A', PHONE_A).barcodes[0], row('item1', 'PARCEL_B', PHONE_A).barcodes[0]] };
        serverHistory = clone(item); dataState.scanHistory = [clone(item)];
        serverPickup = { ...metadata, packagesPickedUp: 1, pickedUpPhones: { [PHONE_A]: 1 }, pickedUpBarcodes: { PARCEL_B: PHONE_A } };
        dataState.dailyPickupData = { [DAY]: clone(serverPickup) };
        await saveEditedPhone(); await flush();
        expect(serverPickup).toEqual({ pickupRevision: 7, pickupResetEpoch: 2, packagesPickedUp: 1, pickedUpPhones: { [form.phone]: 1 }, pickedUpBarcodes: { PARCEL_B: form.phone } });
    });

    it('server pickup គ្មាន node៖ seed ពី history បិទមិនបង្កើតអត្តសញ្ញាណថ្មី', async () => {
        form.phone = '0983333333'; serverPickup = null;
        await saveEditedPhone(); await flush(); expectResetKept();
    });

    it('ហៅ Reset ពិតរួចកែលេខពិត៖ ចំនួននៅ 0 និង COD/DOD នៅដដែល', async () => {
        vi.stubGlobal('confirm', () => true); uiState.currentFilterMode = 'all'; dataState.pickupResetInFlight = false;
        dataState.dailyRevenueData = { [DAY]: { codDollar: 10, dodDollar: 2, totalCount: 2 } };
        dataState.monthlyRevenueData = { '2026-10': { codDollar: 10, dodDollar: 2, totalCount: 2 } };
        const daily = clone(dataState.dailyRevenueData), monthly = clone(dataState.monthlyRevenueData);
        try {
            await resetPickupStats(); expectResetKept();
            form.phone = '0983333333'; await saveEditedPhone(); await flush(); expectResetKept();
            expect(dataState.dailyRevenueData).toEqual(daily); expect(dataState.monthlyRevenueData).toEqual(monthly);
        } finally { vi.unstubAllGlobals(); }
    });
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
            expect(serverPickup).toEqual({ pickupRevision: 6, pickupResetEpoch: 2, packagesPickedUp: 2, pickedUpPhones: { [PHONE_A]: 1, [PHONE_B]: 1 }, pickedUpBarcodes: { PARCEL_A: PHONE_A, PARCEL_B: PHONE_B } });
            expect(pickupWrites).toBe(1);
        });
    }

    it('ទិសផ្ទុយ៖ ទាំងសតិ និង server មានលេខដដែល ហើយ Reset រួច៖ ការរក្សាទុកដដែលមិនបង្កើត pickup ឡើងវិញ', async () => {
        serverHistory.phone = PHONE_A;
        serverPickup = resetRecord();
        dataState.dailyPickupData = { [DAY]: clone(serverPickup) };
        await saveEditedPhone();
        await flush();
        expect(serverPickup).toEqual({ packagesPickedUp: 0, pickupRevision: 6, pickupResetEpoch: 3 });
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
            await flush();
            expect(pickupSnapshots[0].pickedUpBarcodes.PARCEL_A).toBe(form.phone);
            if (late) {
                await flush();
                await vi.advanceTimersByTimeAsync(DB_OP_TIMEOUT_MS + 5);
                expect(await saving).toBe('pending');
                held!.resolve({ committed: false, snapshot: { val: () => clone(serverHistory) } });
            } else expect(await saving).toBe(false);
            await flush();
            expect(serverHistory.phone).toBe(PHONE_B);
            expect(serverPickup).toEqual({ pickupRevision: 7, pickupResetEpoch: 2, packagesPickedUp: 2, pickedUpPhones: { [PHONE_B]: 2 }, pickedUpBarcodes: { PARCEL_A: PHONE_B, PARCEL_B: PHONE_B } });
            expect(pickupSnapshots.map(snapshot => snapshot.pickedUpBarcodes.PARCEL_A)).toEqual([form.phone, PHONE_B]);
        });
    }
});


describe('កែទូរស័ព្ទកញ្ចប់បើក៖ បញ្ចប់តែមានភស្តុតាង commit និងគ្មាន pickup ផ្លាស់ប្តូរ', () => {
    function openParcel() {
        serverHistory = row('item1', 'PARCEL_A', PHONE_A);
        serverHistory.createdAt = Date.now();
        serverHistory.isClosed = false;
        serverHistory.barcodes[0].isClosed = false;
        dataState.scanHistory = [clone(serverHistory)] as any;
        serverPickup = { ...metadata, packagesPickedUp: 0 };
        dataState.dailyPickupData = { [DAY]: clone(serverPickup) };
        form.phone = PHONE_B;
        holdHistory = true;
    }
    const success = () => uiState.toasts.some((toast) => toast.msg.startsWith('✅'));

    for (const late of [false, true]) {
        it(`កញ្ចប់បើក ACK ${late ? 'យឺត' : 'ភ្លាម'}៖ journal ចប់ និង success ក្រោយ commit ប៉ុណ្ណោះ`, async () => {
            openParcel();
            const saving = saveEditedPhone(); await flush();
            expect(held).not.toBeNull();
            expect(readPickupJournal()).toHaveLength(1);
            expect(success()).toBe(false);
            if (late) {
                await vi.advanceTimersByTimeAsync(DB_OP_TIMEOUT_MS + 5);
                expect(await saving).toBe('pending');
                expect(readPickupJournal()).toHaveLength(1);
                expect(success()).toBe(false);
            }
            held!.resolve(commit(held!.update));
            await saving; await flush();
            expect(serverHistory.phone).toBe(PHONE_B);
            expect(serverHistory.cod).toBe(5);
            expect(serverHistory.barcodes[0]).toMatchObject({ code: 'PARCEL_A', cod: 5, dod: 0, isClosed: false });
            expect(pickupWrites).toBe(0);
            expect(serverPickup).toEqual({ ...metadata, packagesPickedUp: 0 });
            expect(readPickupJournal()).toEqual([]);
            expect(success()).toBe(true);
        });
    }

    it('Sign ពី upstream តែ barcode នៅបើក៖ ACK រួចគ្មាន pickup បង្កើត និង journal ចប់', async () => {
        openParcel();
        serverHistory.barcodes[0].ztoSignedAt = Date.now();
        serverHistory.barcodes[0].ztoSignedExact = true;
        dataState.scanHistory = [clone(serverHistory)] as any;
        const saving = saveEditedPhone(); await flush();
        expect(success()).toBe(false);
        held!.resolve(commit(held!.update));
        await saving; await flush();
        expect(serverHistory.barcodes[0].isClosed).toBe(false);
        expect(pickupWrites).toBe(0);
        expect(serverPickup.packagesPickedUp).toBe(0);
        expect(readPickupJournal()).toEqual([]);
        expect(success()).toBe(true);
    });

    it('គ្មាន ACK៖ journal នៅ pending និងគ្មាន success ទោះកញ្ចប់បើក', async () => {
        openParcel();
        const saving = saveEditedPhone(); await flush();
        await vi.advanceTimersByTimeAsync(DB_OP_TIMEOUT_MS + 5);
        expect(await saving).toBe('pending');
        expect(readPickupJournal()).toHaveLength(1);
        expect(readPickupJournal()[0].transitionKnown).not.toBe(true);
        expect(success()).toBe(false);
        expect(serverHistory.phone).toBe(PHONE_A);
        expect(pickupWrites).toBe(0);
    });

    for (const changed of ['birth', 'closed']) {
        it(`committed snapshot ${changed} មិនអាចបញ្ជាក់ no-op៖ journal នៅរង់ចាំ`, async () => {
            openParcel();
            const saving = saveEditedPhone(); await flush();
            const result = commit(held!.update);
            const snapshot = result.snapshot.val();
            if (changed === 'birth') snapshot.createdAt++;
            else snapshot.barcodes[0].isClosed = true;
            held!.resolve({ committed: true, snapshot: { val: () => snapshot } });
            await saving; await flush();
            expect(readPickupJournal()).toHaveLength(1);
            expect(success()).toBe(false);
            expect(pickupWrites).toBe(0);
        });
    }

    it('pickup write ដែលចាប់ផ្តើមហើយបរាជ័យ មិនក្លាយជា no-op ទោះ ACK បង្ហាញកញ្ចប់បើក', async () => {
        openParcel();
        dataState.scanHistory[0].isClosed = true;
        dataState.scanHistory[0].barcodes[0].isClosed = true;
        let attempted = 0;
        const transaction = firebaseState.fb.runTransaction;
        firebaseState.fb.runTransaction = ((ref: any, updater: any) => {
            if (ref.path.startsWith('zoew_daily_pickup_cod_dod/')) {
                attempted++;
                return Promise.reject(new Error('permission_denied'));
            }
            return transaction(ref, updater);
        }) as any;
        const saving = saveEditedPhone(); await flush();
        held!.resolve(commit(held!.update));
        await saving; await flush();
        expect(attempted).toBeGreaterThan(0);
        expect(serverHistory.phone).toBe(PHONE_B);
        expect(readPickupJournal()).toHaveLength(1);
        expect(success()).toBe(false);
        expect(pickupWrites).toBe(0);
    });

    it('សតិថាបើក តែ server បិទ៖ pickup write បរាជ័យត្រូវ HOLD', async () => {
        openParcel();
        serverHistory.isClosed = true;
        serverHistory.barcodes[0].isClosed = true;
        const transaction = firebaseState.fb.runTransaction;
        let attempted = 0;
        firebaseState.fb.runTransaction = ((ref: any, updater: any) => {
            if (ref.path.startsWith('zoew_daily_pickup_cod_dod/')) {
                attempted++;
                return Promise.reject(new Error('permission_denied'));
            }
            return transaction(ref, updater);
        }) as any;
        const saving = saveEditedPhone(); await flush();
        held!.resolve(commit(held!.update));
        await saving; await flush();
        expect(attempted).toBeGreaterThan(0);
        expect(readPickupJournal()).toHaveLength(1);
        expect(success()).toBe(false);
    });

    it('វគ្គ auth ប្តូរមុន ACK៖ មិនបញ្ចប់ journal ចាស់ ឬប្រកាស success', async () => {
        openParcel();
        const saving = saveEditedPhone(); await flush();
        const result = commit(held!.update);
        firebaseState.authGeneration++;
        held!.resolve(result);
        expect(await saving).toBe(false); await flush();
        expect(readPickupJournal()).toHaveLength(1);
        expect(success()).toBe(false);
        expect(pickupWrites).toBe(0);
    });

    it('ACK គ្មាន committed snapshot៖ មិនយក speculative updater ជាភស្តុតាង no-op', async () => {
        openParcel();
        const saving = saveEditedPhone(); await flush();
        commit(held!.update);
        held!.resolve({ committed: true });
        await saving; await flush();
        expect(serverHistory.phone).toBe(PHONE_B);
        expect(pickupWrites).toBe(0);
        expect(readPickupJournal()).toHaveLength(1);
        expect(success()).toBe(false);
    });
});
