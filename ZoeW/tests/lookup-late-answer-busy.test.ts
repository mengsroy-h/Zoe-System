import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
    toasts: [] as string[],
    saves: [] as any[],
    claims: [] as string[],
    claim: null as any,
    save: null as any,
    ledgerOk: true,
}));

vi.mock('../src/ui/toast', async (orig) => ({ ...(await orig<any>()), showToast: (m: string) => { h.toasts.push(String(m)); } }));
vi.mock('../src/services/history-write', async (orig) => ({
    ...(await orig<any>()),
    playBeep: () => {},
    saveSingleHistoryItemToFirebase: (item: any) => {
        h.saves.push(JSON.parse(JSON.stringify(item)));
        return h.save ? h.save.promise.then(() => item) : Promise.resolve(item);
    },
    mergeBarcodeIntoHistoryItem: (_id: string, merge: (t: any) => any, item: any) => (h.save ? h.save.promise : Promise.resolve()).then(() => {
        const serverCopy = JSON.parse(JSON.stringify(item));
        return merge(serverCopy);
    }),
}));
vi.mock('../src/domain/registry', async (orig) => ({
    ...(await orig<any>()),
    isBarcodeAlreadyUsed: () => false,
    claimBarcodeInRegistry: (code: string) => {
        const first = !h.claims.includes(code);
        h.claims.push(code);
        return first ? h.claim.promise : h.claim.promise.then(() => 'taken');
    },
    releaseBarcodesInRegistry: () => {},
    releaseLateBarcodeClaim: () => {},
}));
vi.mock('../src/domain/ledger', async (orig) => ({
    ...(await orig<any>()),
    addRevenueToDailyAndMonthlyRecord: () => ({ isCurrent: () => true }),
    correctRevenueLedgerToActual: () => Promise.resolve({ ok: h.ledgerOk }),
    revertRevenueLedgerDelta: () => {},
}));

import { refTo, fieldValue, setFieldValue } from '../src/app/refs';
import { dataState, firebaseState, scanState, uiState } from '../src/core/state';
import { viewState } from '../src/core/view-state';
import { appLocalStore } from '../src/core/storage';
import { triggerScanAction, confirmPhone } from '../src/features/scan-action';
import { autoLookupFailureAt, autoLookupInFlight, lookupAnswersHeldWhileSaving, lookupFastCache } from '../src/features/auto-lookup';
import { clearCustomerDataTableCache } from '../src/features/customer-table';
import { clearSensitiveModalFields } from '../src/features/session';
import { closeModal } from '../src/ui/modal';

function deferred<T>() {
    let resolve!: (v: T) => void;
    let reject!: (e: any) => void;
    const promise = new Promise<T>((a, b) => { resolve = a; reject = b; });
    return { promise, resolve, reject };
}

let fakeTimers = false;
async function flush(n = 40) {
    for (let i = 0; i < n; i++) await Promise.resolve();
    if (fakeTimers) await vi.advanceTimersByTimeAsync(1);
    else await new Promise((r) => setTimeout(r, 0));
    for (let i = 0; i < n; i++) await Promise.resolve();
}

const REJECT_TEXT = 'ត្រូវបានបញ្ចូលរួចហើយ';
const FILL_TOAST = '✅ បានទាញយកទិន្នន័យអតិថិជនស្វ័យប្រវត្តិ!';
const AUTO_SAVE_TOAST = '⏳ បានរកឃើញអតិថិជន — កំពុងរក្សាទុកស្វ័យប្រវត្តិ...';
const isMoneyWarning = (t: string) => t.includes('ZTO') && t.includes('«កែតម្លៃកញ្ចប់»');

let fetchGate: any;
let seq = 0;

function useConfig(autoSubmit: boolean) {
    appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify({
        enabled: true, autoSubmit, fastMode: false,
        url: 'https://shop.example/.netlify/functions/zto-order-detail?barcode={barcode}',
        phoneField: 'phone', codField: 'cod', dodField: 'dod'
    }));
}

const answer = (body: any) => fetchGate.resolve({ ok: true, status: 200, json: async () => body });

beforeEach(() => {
    h.toasts.length = 0; h.saves.length = 0; h.claims.length = 0;
    h.claim = deferred<any>(); h.save = null; h.ledgerOk = true;
    for (const n of ['modalPhoneInput', 'modalLockerInput', 'modalCodInput', 'modalDodInput'] as const) {
        const el = document.createElement('input');
        document.body.appendChild(el);
        refTo(n)(el);
    }
    dataState.scanHistory = []; dataState.deletedItems = [];
    firebaseState.db = { name: 'db' + (++seq) } as any;
    firebaseState.authGeneration++;
    firebaseState.fb = { ref: (db: any, p: string) => ({ db, p }) } as any;
    clearCustomerDataTableCache();
    autoLookupInFlight.clear(); autoLookupFailureAt.clear(); lookupFastCache.clear();
    fetchGate = deferred<any>();
    vi.stubGlobal('fetch', vi.fn(() => fetchGate.promise));
    useConfig(false);
});

afterEach(() => {
    if (fakeTimers) { vi.clearAllTimers(); vi.useRealTimers(); fakeTimers = false; }
    vi.unstubAllGlobals();
    try { closeModal('phoneModal'); } catch { void 0; }
    appLocalStore.clear();
    viewState.phoneModalBusy = false;
});

describe('ចម្លើយ ZTO មកដល់ពេល dialog លេខទូរស័ព្ទកំពុងរក្សាទុក', () => {
    it('autoSubmit ៖ ចុច រំលង ហើយចម្លើយមកយឺត ➜ claim តែម្ដង · គ្មានសារបដិសេធ · គ្មាន ✅ · ព្រមានលុយ ZTO ម្ដង', async () => {
        useConfig(true);
        const bc = 'ZTK6' + String(100000 + (++seq));
        triggerScanAction(bc);
        const pressed = confirmPhone(true);
        expect(viewState.phoneModalBusy).toBe(true);
        answer({ found: true, phone: '012345678', cod: 5, dod: 1 });
        await flush();
        expect(h.claims).toEqual([bc]);
        expect(uiState.isModalOpen).toBe(true);
        expect(scanState.pendingBarcode).toBe(bc);
        expect(fieldValue('modalPhoneInput')).toBe('');
        expect(fieldValue('modalCodInput')).toBe('');
        expect(h.toasts.filter((t) => t.includes(REJECT_TEXT))).toEqual([]);
        expect(h.toasts).not.toContain(AUTO_SAVE_TOAST);
        expect(h.toasts).not.toContain(FILL_TOAST);
        h.claim.resolve('claimed');
        await pressed; await flush();
        expect(h.claims).toEqual([bc]);
        expect(h.saves.map((s) => [s.phone, s.cod, s.dod])).toEqual([['គ្មានលេខ', 0, 0]]);
        expect(h.toasts.filter((t) => t.includes(REJECT_TEXT))).toEqual([]);
        expect(h.toasts).not.toContain(FILL_TOAST);
        const warnings = h.toasts.filter(isMoneyWarning);
        expect(warnings.length).toBe(1);
        expect(warnings[0]).toContain('COD 5');
        expect(warnings[0]).toContain('DOD 1');
        expect(warnings[0]).toContain(bc);
        expect(lookupAnswersHeldWhileSaving.size).toBe(0);
    });

    it('គ្មាន autoSubmit ៖ ចុច យល់ព្រម ហើយចម្លើយមកយឺត ➜ form មិនប្ដូរ · គ្មាន ✅ · ព្រមានលុយ ZTO ម្ដង', async () => {
        const bc = 'ZTK7' + String(100000 + (++seq));
        triggerScanAction(bc);
        setFieldValue('modalPhoneInput', '098765432');
        const pressed = confirmPhone(false);
        answer({ found: true, phone: '012345678', cod: 7.5, dod: 2 });
        await flush();
        expect(fieldValue('modalCodInput')).toBe('');
        expect(fieldValue('modalDodInput')).toBe('');
        expect(fieldValue('modalPhoneInput')).toBe('098765432');
        expect(h.toasts).not.toContain(FILL_TOAST);
        h.claim.resolve('claimed');
        await pressed; await flush();
        expect(h.saves.map((s) => [s.phone, s.cod, s.dod])).toEqual([['098765432', 0, 0]]);
        expect(h.toasts).not.toContain(FILL_TOAST);
        const warnings = h.toasts.filter(isMoneyWarning);
        expect(warnings.length).toBe(1);
        expect(warnings[0]).toContain('COD 7.5');
        expect(warnings[0]).toContain('DOD 2');
        expect(uiState.isModalOpen).toBe(false);
    });

    it('លុយ ZTO ស្មើលុយដែលរក្សាទុក ឬសូន្យ ➜ គ្មានសារព្រមាន', async () => {
        const bc = 'ZTEQ' + String(100000 + (++seq));
        triggerScanAction(bc);
        setFieldValue('modalPhoneInput', '098765432');
        setFieldValue('modalCodInput', '7.5');
        setFieldValue('modalDodInput', '2');
        const pressed = confirmPhone(false);
        answer({ found: true, phone: '012345678', cod: '7.50', dod: 2 });
        await flush();
        h.claim.resolve('claimed');
        await pressed; await flush();
        expect(h.saves.map((s) => [s.cod, s.dod])).toEqual([[7.5, 2]]);
        expect(h.toasts.filter(isMoneyWarning)).toEqual([]);

        h.claim = deferred<any>(); fetchGate = deferred<any>(); h.toasts.length = 0;
        const bc2 = 'ZTZERO' + String(100000 + (++seq));
        triggerScanAction(bc2);
        setFieldValue('modalCodInput', '3');
        const pressed2 = confirmPhone(true);
        answer({ found: true, phone: '012345678', cod: 0, dod: 0 });
        await flush();
        h.claim.resolve('claimed');
        await pressed2; await flush();
        expect(h.saves.slice(-1).map((s) => [s.cod, s.dod])).toEqual([[3, 0]]);
        expect(h.toasts.filter(isMoneyWarning)).toEqual([]);

        h.claim = deferred<any>(); fetchGate = deferred<any>(); h.toasts.length = 0;
        const bc3 = 'ZTPART' + String(100000 + (++seq));
        triggerScanAction(bc3);
        setFieldValue('modalCodInput', '5');
        setFieldValue('modalDodInput', '2');
        const pressed3 = confirmPhone(true);
        answer({ found: true, phone: '012345678', cod: 5 });
        await flush();
        h.claim.resolve('claimed');
        await pressed3; await flush();
        expect(h.saves.slice(-1).map((s) => [s.cod, s.dod])).toEqual([[5, 2]]);
        expect(h.toasts.filter(isMoneyWarning)).toEqual([]);
    });

    it('claim បរាជ័យ ➜ dialog នៅបើក · ចម្លើយដែលទុកចូល form ទទេ · ចុចម្ដងទៀតរក្សាទុកលុយ ZTO', async () => {
        useConfig(true);
        const bc = 'ZTFAIL' + String(100000 + (++seq));
        triggerScanAction(bc);
        setFieldValue('modalCodInput', '');
        const pressed = confirmPhone(true);
        answer({ found: true, phone: '012345678', cod: 7.5, dod: 2 });
        await flush();
        expect(fieldValue('modalCodInput')).toBe('');
        h.claim.reject(new Error('net'));
        await pressed; await flush();
        expect(uiState.isModalOpen).toBe(true);
        expect(viewState.phoneModalBusy).toBe(false);
        expect(fieldValue('modalPhoneInput')).toBe('012345678');
        expect(fieldValue('modalCodInput')).toBe('7.5');
        expect(fieldValue('modalDodInput')).toBe('2');
        expect(h.claims).toEqual([bc]);
        expect(h.saves.length).toBe(0);
        expect(h.toasts).not.toContain(FILL_TOAST);
        expect(h.toasts).not.toContain(AUTO_SAVE_TOAST);
        expect(lookupAnswersHeldWhileSaving.size).toBe(0);

        h.claim = deferred<any>(); h.claims.length = 0;
        const retry = confirmPhone(false);
        h.claim.resolve('claimed');
        await retry; await flush();
        expect(h.saves.map((s) => [s.phone, s.cod, s.dod])).toEqual([['012345678', 7.5, 2]]);
        expect(h.toasts.filter(isMoneyWarning)).toEqual([]);
    });

    it('claim បរាជ័យ ➜ មិនសរសេរពីលើលេខដែលអ្នកប្រើវាយរួច', async () => {
        const bc = 'ZTKEEP' + String(100000 + (++seq));
        triggerScanAction(bc);
        setFieldValue('modalPhoneInput', '098765432');
        setFieldValue('modalCodInput', '3');
        const pressed = confirmPhone(false);
        answer({ found: true, phone: '012345678', cod: 7.5, dod: 2 });
        await flush();
        h.claim.reject(new Error('net'));
        await pressed; await flush();
        expect(fieldValue('modalPhoneInput')).toBe('098765432');
        expect(fieldValue('modalCodInput')).toBe('3');
        expect(fieldValue('modalDodInput')).toBe('2');
    });

    it('រក្សាទុករួច តែស្ថិតិប្រាក់មិនទាន់ Sync ➜ នៅតែព្រមានលុយ ZTO ម្ដង', async () => {
        h.ledgerOk = false;
        const bc = 'ZTLEDGER' + String(100000 + (++seq));
        triggerScanAction(bc);
        setFieldValue('modalPhoneInput', '098765432');
        const pressed = confirmPhone(false);
        answer({ found: true, phone: '012345678', cod: 6, dod: 0 });
        await flush();
        h.claim.resolve('claimed');
        await pressed; await flush();
        expect(h.saves.length).toBe(1);
        expect(uiState.isModalOpen).toBe(false);
        const warnings = h.toasts.filter(isMoneyWarning);
        expect(warnings.length).toBe(1);
        expect(warnings[0]).toContain('COD 6');
    });

    it('save អស់ពេល ➜ ព្រមានលុយ ZTO តែពេល save មកដល់ជោគជ័យ', async () => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
        fakeTimers = true;
        h.save = deferred<any>();
        const bc = 'ZTSLOW' + String(100000 + (++seq));
        triggerScanAction(bc);
        setFieldValue('modalPhoneInput', '098765432');
        const pressed = confirmPhone(false);
        answer({ found: true, phone: '012345678', cod: 4, dod: 0 });
        await flush();
        h.claim.resolve('claimed');
        await flush();
        await vi.advanceTimersByTimeAsync(15001);
        await pressed; await flush();
        expect(uiState.isModalOpen).toBe(false);
        expect(h.toasts.some((t) => t.startsWith('⏳ កំពុងរក្សាទុក'))).toBe(true);
        expect(h.toasts.filter(isMoneyWarning)).toEqual([]);
        h.save.resolve(true);
        await flush();
        const warnings = h.toasts.filter(isMoneyWarning);
        expect(warnings.length).toBe(1);
        expect(warnings[0]).toContain('COD 4');
    });

    it('save អស់ពេល ហើយបរាជ័យពេលក្រោយ ➜ គ្មានសារព្រមានលុយ', async () => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
        fakeTimers = true;
        h.save = deferred<any>();
        h.save.promise.catch(() => {});
        const bc = 'ZTSLOWF' + String(100000 + (++seq));
        triggerScanAction(bc);
        setFieldValue('modalPhoneInput', '098765432');
        const pressed = confirmPhone(false);
        answer({ found: true, phone: '012345678', cod: 4, dod: 0 });
        await flush();
        h.claim.resolve('claimed');
        await flush();
        await vi.advanceTimersByTimeAsync(15001);
        await pressed; await flush();
        h.save.reject(new Error('late fail'));
        await flush();
        expect(h.toasts.filter(isMoneyWarning)).toEqual([]);
    });

    it('save អស់ពេល ហើយមកដល់ពេលក្រោយ (ស្ថិតិប្រាក់មិនទាន់ Sync) ➜ នៅតែព្រមានលុយ ZTO', async () => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
        fakeTimers = true;
        h.save = deferred<any>();
        h.ledgerOk = false;
        const bc = 'ZTSLOWL' + String(100000 + (++seq));
        triggerScanAction(bc);
        setFieldValue('modalPhoneInput', '098765432');
        const pressed = confirmPhone(false);
        answer({ found: true, phone: '012345678', cod: 4, dod: 0 });
        await flush();
        h.claim.resolve('claimed');
        await flush();
        await vi.advanceTimersByTimeAsync(15001);
        await pressed; await flush();
        h.save.resolve(true);
        await flush();
        expect(h.toasts.filter(isMoneyWarning).length).toBe(1);
    });

    it('Barcode មានក្នុងកញ្ចប់នៅ Server រួច (save ឆ្លើយ null) ➜ គ្មានសារព្រមានលុយ ទាំងលឿន និងយឺត', async () => {
        const today = () => dataState.scanHistory.find((i: any) => i.phone === '098765432');
        const bc = 'ZTDUP' + String(100000 + (++seq));
        triggerScanAction('ZTSEED' + seq);
        setFieldValue('modalPhoneInput', '098765432');
        const seed = confirmPhone(false);
        h.claim.resolve('claimed');
        await seed; await flush();
        expect(today()).toBeTruthy();

        h.claim = deferred<any>(); h.claims.length = 0; fetchGate = deferred<any>(); h.toasts.length = 0;
        triggerScanAction(bc);
        setFieldValue('modalPhoneInput', '098765432');
        const pressed = confirmPhone(false);
        answer({ found: true, phone: '012345678', cod: 8, dod: 0 });
        await flush();
        h.claim.resolve('claimed');
        await pressed; await flush();
        expect(h.toasts.some((t) => t.includes('មានក្នុងប្រព័ន្ធរួចហើយ'))).toBe(true);
        expect(h.toasts.filter(isMoneyWarning)).toEqual([]);

        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
        fakeTimers = true;
        h.save = deferred<any>();
        h.claim = deferred<any>(); h.claims.length = 0; fetchGate = deferred<any>(); h.toasts.length = 0;
        const bcLate = 'ZTDUPL' + String(100000 + (++seq));
        triggerScanAction(bcLate);
        setFieldValue('modalPhoneInput', '098765432');
        const pressedLate = confirmPhone(false);
        answer({ found: true, phone: '012345678', cod: 8, dod: 0 });
        await flush();
        h.claim.resolve('claimed');
        await flush();
        await vi.advanceTimersByTimeAsync(15001);
        await pressedLate; await flush();
        h.save.resolve(true);
        await flush();
        expect(h.toasts.some((t) => t.includes('មានក្នុងប្រព័ន្ធរួចហើយ'))).toBe(true);
        expect(h.toasts.filter(isMoneyWarning)).toEqual([]);
    });

    it('ចម្លើយពី session ចាស់មិនចូល form ក្រោយប្ដូរ session', async () => {
        const bc = 'ZTSESS' + String(100000 + (++seq));
        triggerScanAction(bc);
        setFieldValue('modalPhoneInput', '098765432');
        const pressed = confirmPhone(false);
        answer({ found: true, phone: '012345678', cod: 9, dod: 3 });
        await flush();
        firebaseState.authGeneration++;
        viewState.phoneModalBusy = false;
        h.claim.resolve('claimed');
        await pressed; await flush();
        expect(uiState.isModalOpen).toBe(true);

        h.claim = deferred<any>(); h.claims.length = 0;
        const retry = confirmPhone(false);
        h.claim.reject(new Error('net'));
        await retry; await flush();
        expect(fieldValue('modalCodInput')).toBe('');
        expect(fieldValue('modalDodInput')).toBe('');
    });

    it('ចុចពីរដងពេលកំពុងរក្សាទុក ➜ claim តែម្ដង', async () => {
        const bc = 'ZTTWICE' + String(100000 + (++seq));
        triggerScanAction(bc);
        setFieldValue('modalPhoneInput', '098765432');
        const first = confirmPhone(false);
        const second = confirmPhone(true);
        h.claim.resolve('claimed');
        await first; await second; await flush();
        expect(h.claims).toEqual([bc]);
        expect(h.saves.length).toBe(1);
        expect(h.toasts.filter((t) => t.includes(REJECT_TEXT))).toEqual([]);
    });

    it('ទិសផ្ទុយ ៖ ចម្លើយមកមុនចុច + autoSubmit ➜ រក្សាទុកម្ដងជាមួយតម្លៃ ZTO', async () => {
        useConfig(true);
        const bc = 'ZTEARLY' + String(100000 + (++seq));
        triggerScanAction(bc);
        answer({ found: true, phone: '012345678', cod: 5, dod: 1 });
        await flush();
        expect(h.toasts).toContain(AUTO_SAVE_TOAST);
        expect(viewState.phoneModalBusy).toBe(true);
        h.claim.resolve('claimed');
        await flush();
        expect(h.claims).toEqual([bc]);
        expect(h.saves.map((s) => [s.phone, s.cod, s.dod])).toEqual([['012345678', 5, 1]]);
        expect(h.toasts.filter(isMoneyWarning)).toEqual([]);
        expect(h.toasts.filter((t) => t.includes(REJECT_TEXT))).toEqual([]);
    });

    it('ទិសផ្ទុយ ៖ ចម្លើយមកមុនចុច គ្មាន autoSubmit ➜ បំពេញ form + ✅ ហើយមិនរក្សាទុកខ្លួនឯង', async () => {
        const bc = 'ZTFILL' + String(100000 + (++seq));
        triggerScanAction(bc);
        answer({ found: true, phone: '012345678', cod: 5, dod: 1 });
        await flush();
        expect(fieldValue('modalPhoneInput')).toBe('012345678');
        expect(fieldValue('modalCodInput')).toBe('5');
        expect(fieldValue('modalDodInput')).toBe('1');
        expect(h.toasts).toContain(FILL_TOAST);
        expect(h.claims).toEqual([]);
        expect(viewState.phoneModalBusy).toBe(false);
    });

    it('ចម្លើយដែលទុកមិនឆ្លង barcode ឬ session ៖ បិទ dialog · ស្កេនថ្មី · ចាកចេញ សម្អាតវា', async () => {
        const bc = 'ZTLEAK' + String(100000 + (++seq));
        triggerScanAction(bc);
        setFieldValue('modalPhoneInput', '098765432');
        const pressed = confirmPhone(false);
        answer({ found: true, phone: '012345678', cod: 9, dod: 3 });
        await flush();
        expect(lookupAnswersHeldWhileSaving.size).toBe(1);
        closeModal('phoneModal');
        expect(lookupAnswersHeldWhileSaving.size).toBe(0);
        h.claim.resolve('taken');
        await pressed; await flush();

        lookupAnswersHeldWhileSaving.set(bc.toUpperCase(), { phone: '012345678', cod: 9, dod: 3 });
        h.claim = deferred<any>(); h.claims.length = 0; fetchGate = deferred<any>(); h.toasts.length = 0;
        const next = 'ZTNEXT' + String(100000 + (++seq));
        triggerScanAction(next);
        expect(lookupAnswersHeldWhileSaving.size).toBe(0);
        expect(fieldValue('modalCodInput')).toBe('');
        setFieldValue('modalPhoneInput', '098765432');
        const pressedNext = confirmPhone(false);
        h.claim.resolve('claimed');
        await pressedNext; await flush();
        expect(h.toasts.filter(isMoneyWarning)).toEqual([]);

        lookupAnswersHeldWhileSaving.set('ZTANY', { phone: '1', cod: 1, dod: 1 });
        clearSensitiveModalFields();
        expect(lookupAnswersHeldWhileSaving.size).toBe(0);
    });
});
