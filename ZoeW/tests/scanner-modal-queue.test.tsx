/**
 * ⛔ សំណើម្ចាស់គម្រោង ៖ «អោយការស្កេនដោយម៉ាស៊ីនស្កេន … ពិនិត្យផ្លូវ Auto save ពេលស្គាល់លេខទូរស័ព្ទពី lookup ផង ក្រែងកែរួចវាប្រជែងគ្នាជាមួយការបន្ថែមថ្មី»
 *    · «បើកន្លែងណាប៉ះតំបន់លុយ សូមសាងអ្នកយាមមុនកែកូដ»។
 *    វាស់លើកូដមុនកែ ៖ ផ្ទាំង «🎉 ស្កេនបានជោគជ័យ!» របស់ A បើក (lookup កំពុងរក) ➜ ម៉ាស៊ីនស្កេនស្កេន B ➜ លេខ B ចូលប្រអប់ដែល focus ៖
 *    COD ➜ Auto save រក្សាទុក A ជាមួយ COD = លេខ B (លុយខុស) · លេខទូរស័ព្ទ ➜ lookup មិនបំពេញ ➜ គ្មាន Auto save · ប្រអប់ Barcode នៅក្រោយផ្ទាំង ➜
 *    B នៅជាប់ក្នុងប្រអប់ ➜ ការស្កេនបន្ទាប់ក្លាយជា «BC» · ប៊ូតុង «🗑️ បញ្ជាក់ដក» ដែល focus ➜ Enter របស់ម៉ាស៊ីនស្កេនចុចវា (កាត់លុយ) · B បាត់។
 * ⛔ ច្បាប់ ៖ ពេលផ្ទាំង (មិនមែន «📋 បញ្ចូលច្រើន») បើក ការស្កេន (≥ SCANNER_MIN_CHARS គ្រាប់លឿន + Enter/Tab) មិនដែលចូលប្រអប់ ឬចុចប៊ូតុង ៖
 *    គ្រាប់ចុចត្រូវទប់ (ប្រអប់ផ្ទាំងលេខទូរស័ព្ទ · ប្រអប់ Barcode · គ្មានប្រអប់វាយ focus) ➜ ការស្កេនចូលជួរ ➜ បើកតាមលំដាប់ក្រោយផ្ទាំងបិទ
 *    (ផ្លូវស្កេនធម្មតា `triggerScanAction` · របៀបស្កេនដដែល) · ការវាយដោយមនុស្ស (យឺត) ចូលប្រអប់ដូចដើម · Auto save អានតម្លៃស្អាត។
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
    toasts: [] as string[],
    saves: [] as any[],
    used: new Set<string>(),
}));

vi.mock('../src/services/history-write', async (orig) => ({
    ...(await orig<any>()),
    playBeep: () => {},
    saveSingleHistoryItemToFirebase: (item: any) => {
        h.saves.push(JSON.parse(JSON.stringify(item)));
        return Promise.resolve(item);
    },
    mergeBarcodeIntoHistoryItem: (_id: string, merge: (t: any) => any, item: any) => Promise.resolve().then(() => merge(JSON.parse(JSON.stringify(item)))),
}));
vi.mock('../src/domain/registry', async (orig) => ({
    ...(await orig<any>()),
    isBarcodeAlreadyUsed: (code: string) => h.used.has(String(code).toUpperCase()),
    claimBarcodeInRegistry: () => Promise.resolve('claimed'),
    releaseBarcodesInRegistry: () => {},
    releaseLateBarcodeClaim: () => {},
}));
vi.mock('../src/domain/ledger', async (orig) => ({
    ...(await orig<any>()),
    addRevenueToDailyAndMonthlyRecord: () => ({ isCurrent: () => true }),
    correctRevenueLedgerToActual: () => Promise.resolve({ ok: true }),
    revertRevenueLedgerDelta: () => {},
}));

import { triggerScanAction } from '../src/features/scan-action';
import * as scanRemove from '../src/features/scan-remove';
import * as toast from '../src/ui/toast';
import { fieldValue, setFieldValue } from '../src/app/refs';
import { dataState, firebaseState, scanState, securityState, uiState } from '../src/core/state';
import { viewState } from '../src/core/view-state';
import { appLocalStore } from '../src/core/storage';
import { autoLookupFailureAt, autoLookupInFlight, lookupFastCache } from '../src/features/auto-lookup';
import { clearCustomerDataTableCache } from '../src/features/customer-table';
import { resetBatchScan, startBatchScan, stopBatchScan } from '../src/features/batch-scan';
import { noteScannerKeyDown, SCANNER_KEY_GAP_MS } from '../src/app/behaviors/scanner-input';
import { AppPages } from '../src/app/components/AppPages';
import { BatchScanModal } from '../src/app/components/modals/BatchScanModal';
import { PhoneModal } from '../src/app/components/modals/PhoneModal';
import { ScanRemoveModal } from '../src/app/components/modals/ScanRemoveModal';
import { closeModal, openModalHelper } from '../src/ui/modal';
import '../src/app/flush';
import { byId, mount, step, unmount } from './native/react-harness';

function deferred<T>() {
    let resolve!: (v: T) => void;
    const promise = new Promise<T>((a) => { resolve = a; });
    return { promise, resolve };
}

let clock = 50000;
let fetchGates: ReturnType<typeof deferred<any>>[];
let seq = 0;

async function settle(ms = 1) {
    for (let i = 0; i < 30; i++) await Promise.resolve();
    await vi.advanceTimersByTimeAsync(ms);
    for (let i = 0; i < 30; i++) await Promise.resolve();
    step(() => {});
}

function wait(ms: number) {
    clock += ms;
    vi.advanceTimersByTime(ms);
}

function press(k: string, extra: Partial<KeyboardEventInit> = {}) {
    const target = (document.activeElement || document.body) as HTMLElement;
    const code = /^[0-9]$/.test(k) ? 'Digit' + k : (/^[A-Za-z]$/.test(k) ? 'Key' + k.toUpperCase() : k);
    const ev = new KeyboardEvent('keydown', Object.assign({ key: k, code, bubbles: true, cancelable: true }, extra));
    Object.defineProperty(ev, 'timeStamp', { value: clock });
    target.dispatchEvent(ev);
    if (ev.defaultPrevented) return ev;
    if ((target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) && k.length === 1) {
        target.value += k;
        target.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (k === 'Enter' && target instanceof HTMLButtonElement) step(() => target.click());
    if (k === 'Enter' && target === byId('hwScannerInput')) {
        target.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', code: 'Enter', charCode: 13, keyCode: 13, bubbles: true, cancelable: true }));
    }
    return ev;
}

function scan(code: string, suffix = 'Enter', gap = 8) {
    for (const c of code) {
        press(c, { shiftKey: /[A-Z]/.test(c) });
        wait(gap);
    }
    const end = press(suffix);
    step(() => {});
    return end;
}

function humanType(text: string, gap = 110) {
    for (const c of text) {
        press(c, { shiftKey: /[A-Z]/.test(c) });
        wait(gap);
    }
}

function focus(id: string) {
    step(() => byId(id).focus());
}

const answer = (body: any) => fetchGates.shift()!.resolve({ ok: true, status: 200, json: async () => body });

function useLookup(autoSubmit: boolean) {
    appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify({
        enabled: true, autoSubmit, fastMode: false,
        url: 'https://shop.example/.netlify/functions/zto-order-detail?barcode={barcode}',
        phoneField: 'phone', codField: 'cod', dodField: 'dod'
    }));
}

function openScan(code: string) {
    step(() => triggerScanAction(code));
}

const phoneModalOpen = () => (uiState.modalStack || []).includes('phoneModal');

beforeEach(() => {
    vi.useFakeTimers();
    clock = 50000 + (++seq) * 100000;
    h.toasts.length = 0; h.saves.length = 0; h.used.clear();
    dataState.scanHistory = []; dataState.deletedItems = [];
    firebaseState.db = { name: 'db' + seq } as any;
    firebaseState.authGeneration++;
    firebaseState.fb = { ref: (db: any, p: string) => ({ db, p }) } as any;
    clearCustomerDataTableCache();
    autoLookupInFlight.clear(); autoLookupFailureAt.clear(); lookupFastCache.clear();
    fetchGates = [];
    vi.stubGlobal('fetch', vi.fn(() => { const gate = deferred<any>(); fetchGates.push(gate); return gate.promise; }));
    vi.spyOn(toast, 'showToast').mockImplementation((m: any) => { h.toasts.push(String(m)); return 0; });
    useLookup(true);
    mount(<><AppPages /><BatchScanModal /><PhoneModal /><ScanRemoveModal /></>);
    step(() => {
        uiState.modalDisplay = {};
        uiState.modalStack = [];
        uiState.isModalOpen = false;
        uiState.drawerOpen = false;
        uiState.notifyDrawerOpen = false;
        uiState.keyboardOpen = false;
        uiState.currentAppPage = 'entry';
        uiState.entryScanMode = 'parcel';
        uiState.pendingScannedRemoval = null;
        uiState.scanRemoveInFlight = null;
        securityState.appIsLocked = false;
        scanState.pendingBarcode = '';
    });
    document.addEventListener('keydown', noteScannerKeyDown, true);
});

afterEach(() => {
    document.removeEventListener('keydown', noteScannerKeyDown, true);
    resetBatchScan();
    step(() => { for (const id of (uiState.modalStack || []).slice()) closeModal(id); });
    unmount();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    appLocalStore.clear();
    viewState.phoneModalBusy = false;
});

describe('ម៉ាស៊ីនស្កេន ពេលផ្ទាំងលេខទូរស័ព្ទបើក ៖ Auto save ពី lookup អានតម្លៃស្អាត · ការស្កេនចូលជួរ', () => {
    for (const field of ['modalCodInput', 'modalPhoneInput', 'modalDodInput', 'modalLockerInput']) {
        it('⛔ លុយ ៖ focus ' + field + ' ➜ ស្កេន B + Enter ➜ ប្រអប់នៅស្អាត · focus មិនរំកិល ➜ lookup Auto save រក្សាទុក A តាម lookup ➜ B បើកបន្ទាប់', async () => {
            const a = 'ZTQA' + seq + '0001';
            const b = '7810' + seq + '22334455';
            openScan(a);
            await settle();
            focus(field);
            const fields = ['modalPhoneInput', 'modalLockerInput', 'modalCodInput', 'modalDodInput'] as const;
            const before = fields.map((n) => fieldValue(n));
            scan(b);
            await settle();
            expect(fields.map((n) => fieldValue(n))).toEqual(before);
            expect(document.activeElement && document.activeElement.id).toBe(field);
            expect(scanState.pendingBarcode).toBe(a);
            answer({ found: true, phone: '012345678', cod: 5, dod: 1 });
            await settle(50);
            await settle(50);
            expect(h.saves.map((s) => [s.phone, s.cod, s.dod])).toEqual([['012345678', 5, 1]]);
            expect(h.saves[0].barcodes.map((x: any) => x.code)).toEqual([a]);
            await settle(50);
            expect(scanState.pendingBarcode).toBe(b);
            expect(phoneModalOpen()).toBe(true);
            expect(fieldValue('modalCodInput')).toBe('');
            expect(fieldValue('hwScannerInput')).toBe('');
        });
    }

    it('⛔ ប្រអប់ Barcode focus នៅក្រោយផ្ទាំង ៖ ស្កេន B · C ➜ ប្រអប់ Barcode នៅទទេ (មិនក្លាយ «BC») ➜ បោះបង់ A ➜ B ➜ បោះបង់ B ➜ C', async () => {
        const a = 'ZTQH' + seq + '0001';
        const b = 'ZTQH' + seq + '0002';
        const c = 'ZTQH' + seq + '0003';
        openScan(a);
        await settle();
        focus('hwScannerInput');
        scan(b);
        wait(400);
        scan(c, 'Tab');
        await settle();
        expect(fieldValue('hwScannerInput')).toBe('');
        expect(scanState.pendingBarcode).toBe(a);
        step(() => closeModal('phoneModal'));
        await settle();
        expect(scanState.pendingBarcode).toBe(b);
        expect(phoneModalOpen()).toBe(true);
        step(() => closeModal('phoneModal'));
        await settle();
        expect(scanState.pendingBarcode).toBe(c);
        step(() => closeModal('phoneModal'));
        await settle();
        expect(phoneModalOpen()).toBe(false);
        expect(viewState.batchScanStatus).toBe('');
        expect(h.saves).toEqual([]);
    });

    it('⛔ ការស្កេនកំពុងវាយ ហើយផ្ទាំងបិទពាក់កណ្តាល ➜ Barcode ពេញ (មិនកាត់) បើកបន្ទាប់', async () => {
        const a = 'ZTQS' + seq + '0001';
        const b = '7710' + seq + '00308751';
        openScan(a);
        await settle();
        focus('modalCodInput');
        for (const ch of b.slice(0, 6)) { press(ch); wait(8); }
        step(() => closeModal('phoneModal'));
        for (const ch of b.slice(6)) { press(ch); wait(8); }
        press('Enter');
        await settle();
        expect(scanState.pendingBarcode).toBe(b);
        expect(phoneModalOpen()).toBe(true);
        expect(fieldValue('hwScannerInput')).toBe('');
        expect(fieldValue('modalCodInput')).toBe('');
    });

    it('ផ្ទាំងបើកពាក់កណ្តាលការស្កេនលើទំព័រ ➜ Barcode កាត់មិនចូលជួរ · ប្រអប់ Barcode សម្អាត · ប្រាប់ឲ្យស្កេនម្ដងទៀត', async () => {
        const b = 'ZTQC' + seq + '00012345';
        focus('hwScannerInput');
        for (const ch of b.slice(0, 5)) { press(ch, { shiftKey: /[A-Z]/.test(ch) }); wait(8); }
        expect(fieldValue('hwScannerInput')).toBe(b.slice(0, 5));
        step(() => openModalHelper('scanRemoveModal'));
        for (const ch of b.slice(5)) { press(ch); wait(8); }
        press('Enter');
        await settle();
        expect(fieldValue('hwScannerInput')).toBe('');
        expect(viewState.batchScanStatus).toBe('');
        expect(h.toasts.some((t) => t.startsWith('⚠️') && t.includes('ស្កេនម្ដងទៀត'))).toBe(true);
    });

    it('ទំព័រទិន្នន័យ ៖ ផ្ទាំងបើក · ប៊ូតុង focus ➜ ការស្កេនមិនចុចប៊ូតុង · មិនចូលជួរ · ប្រាប់ឲ្យស្កេននៅទំព័រស្កេន', async () => {
        const clicked: string[] = [];
        step(() => {
            uiState.currentAppPage = 'data';
            uiState.entryScanMode = 'remove';
            uiState.pendingScannedRemoval = { itemId: 'item-d', barcodeCode: 'ZTQE' + seq + '0001' };
            openModalHelper('scanRemoveModal');
        });
        byId('scanRemoveConfirmBtn').addEventListener('click', () => clicked.push('confirm'));
        focus('scanRemoveConfirmBtn');
        scan('ZTQE' + seq + '0002');
        await settle();
        expect(clicked).toEqual([]);
        expect(viewState.batchScanStatus).toBe('');
        expect(h.toasts.some((t) => t.startsWith('⚠️') && t.includes('ទំព័រស្កេន'))).toBe(true);
    });

    it('ស្កេន A ម្តងទៀតពេលផ្ទាំង A បើក (អានពីរដង) ➜ មិនចូលជួរ · ប្រាប់', async () => {
        const a = 'ZTQD' + seq + '0001';
        openScan(a);
        await settle();
        scan(a);
        await settle();
        expect(viewState.batchScanStatus).toBe('');
        expect(h.toasts.some((t) => t.includes(a) && t.startsWith('ℹ️'))).toBe(true);
        step(() => closeModal('phoneModal'));
        await settle();
        expect(phoneModalOpen()).toBe(false);
    });

    it('«📋 បញ្ចូលច្រើន» កំពុងរត់ ➜ ការស្កេនថ្មីបន្ថែមចុងជួរ ➜ លំដាប់ X · Y · C', async () => {
        useLookup(false);
        const x = 'ZTQB' + seq + '0001';
        const y = 'ZTQB' + seq + '0002';
        const c = 'ZTQB' + seq + '0003';
        step(() => { setFieldValue('batchBarcodeInput', x + '\n' + y); startBatchScan(); });
        await settle(200);
        expect(scanState.pendingBarcode).toBe(x);
        focus('modalPhoneInput');
        scan(c);
        await settle();
        expect(fieldValue('modalPhoneInput')).toBe('');
        expect(viewState.batchScanStatus).toContain('/3');
        const order = [scanState.pendingBarcode];
        for (let i = 0; i < 3; i++) {
            step(() => closeModal('phoneModal'));
            await settle(200);
            if (phoneModalOpen()) order.push(scanState.pendingBarcode);
        }
        expect(order).toEqual([x, y, c]);
        expect(viewState.batchScanStatus).toBe('');
    });

    it('ប្តូរគណនី/ហាង ពេលការស្កេនរង់ចាំ ➜ ទម្លាក់ស្ងាត់ (មិនបើកក្នុងវគ្គថ្មី)', async () => {
        const a = 'ZTQX' + seq + '0001';
        const b = 'ZTQX' + seq + '0002';
        openScan(a);
        await settle();
        scan(b);
        await settle();
        expect(viewState.batchScanStatus).not.toBe('');
        firebaseState.authGeneration++;
        step(() => closeModal('phoneModal'));
        await settle();
        expect(phoneModalOpen()).toBe(false);
        expect(scanState.pendingBarcode).not.toBe(b);
        expect(viewState.batchScanStatus).toBe('');
    });

    it('⏹️ បញ្ឈប់ ➜ ការស្កេនរង់ចាំត្រូវបោះបង់', async () => {
        const a = 'ZTQP' + seq + '0001';
        const b = 'ZTQP' + seq + '0002';
        openScan(a);
        await settle();
        scan(b);
        await settle();
        step(() => stopBatchScan());
        step(() => closeModal('phoneModal'));
        await settle();
        expect(phoneModalOpen()).toBe(false);
        expect(viewState.batchScanStatus).toBe('');
    });
});

describe('ការវាយដោយមនុស្សក្នុងផ្ទាំងលេខទូរស័ព្ទ នៅដូចដើម (ទិសផ្ទុយ)', () => {
    it('វាយលេខទូរស័ព្ទ · Locker · COD ល្បឿនមនុស្ស + Enter ➜ តម្លៃចូលប្រអប់ · Enter ទៅប្រអប់បន្ទាប់ · គ្មានជួរ', async () => {
        useLookup(false);
        openScan('ZTQM' + seq + '0001');
        await settle(200);
        focus('modalPhoneInput');
        humanType('0961234567');
        press('Enter');
        step(() => {});
        expect(fieldValue('modalPhoneInput')).toBe('0961234567');
        expect(document.activeElement && document.activeElement.id).toBe('modalLockerInput');
        humanType('A1', 30);
        wait(SCANNER_KEY_GAP_MS + 5);
        press('Enter');
        step(() => {});
        expect(fieldValue('modalLockerInput')).toBe('A1');
        expect(document.activeElement && document.activeElement.id).toBe('modalCodInput');
        humanType('5');
        press('Enter');
        step(() => {});
        expect(fieldValue('modalCodInput')).toBe('5');
        expect(viewState.batchScanStatus).toBe('');
        expect(h.saves).toEqual([]);
    });

    it('វាយលឿន ៣ តួ (ក្រោម SCANNER_MIN_CHARS) រួចឈប់ ➜ អក្សរមិនបាត់', async () => {
        useLookup(false);
        openScan('ZTQF' + seq + '0001');
        await settle(200);
        focus('modalPhoneInput');
        humanType('096', 20);
        await settle(200);
        expect(fieldValue('modalPhoneInput')).toBe('096');
    });

    it('keyboard លើអេក្រង់ (Android APK keyboardOpen) ➜ គ្រាប់ចុចមិនត្រូវទប់', async () => {
        useLookup(false);
        openScan('ZTQK' + seq + '0001');
        await settle(200);
        focus('modalPhoneInput');
        step(() => { uiState.keyboardOpen = true; });
        press('0');
        expect(fieldValue('modalPhoneInput')).toBe('0');
    });

    it('ផ្ទាំង PIN (ប្រអប់វាយរបស់ផ្ទាំងផ្សេង) ➜ មិនប៉ះ', async () => {
        const pin = document.createElement('input');
        pin.type = 'password';
        document.body.appendChild(pin);
        openScan('ZTQN' + seq + '0001');
        await settle();
        step(() => { uiState.modalStack = uiState.modalStack.concat(['pinModal']); });
        step(() => pin.focus());
        press('1');
        expect(pin.value).toBe('1');
        pin.remove();
    });
});

describe('ផ្ទាំងបញ្ជាក់ «ដក» ៖ Enter របស់ម៉ាស៊ីនស្កេនមិនចុចប៊ូតុង', () => {
    it('⛔ លុយ ៖ ប៊ូតុង «🗑️ បញ្ជាក់ដក» focus ➜ ស្កេន B + Enter ➜ មិនដក · ផ្ទាំងនៅ ➜ បោះបង់ ➜ B ស្កេនក្នុងរបៀបដក', async () => {
        const removeSpy = vi.spyOn(scanRemove, 'confirmScannedRemoval');
        const handled: string[] = [];
        vi.spyOn(scanRemove, 'handleRemoveScan').mockImplementation((code: string) => { handled.push(code); });
        step(() => {
            uiState.entryScanMode = 'remove';
            uiState.pendingScannedRemoval = { itemId: 'item-a', barcodeCode: 'ZTQR' + seq + '0001' };
            openModalHelper('scanRemoveModal');
        });
        focus('scanRemoveConfirmBtn');
        const b = 'ZTQR' + seq + '0002';
        scan(b);
        await settle();
        expect(removeSpy).not.toHaveBeenCalled();
        expect(uiState.pendingScannedRemoval).not.toBe(null);
        expect((uiState.modalStack || []).includes('scanRemoveModal')).toBe(true);
        step(() => scanRemove.cancelScannedRemoval());
        await settle();
        expect(handled).toEqual([b]);
    });
});
