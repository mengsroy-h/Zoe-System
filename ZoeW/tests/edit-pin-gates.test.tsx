import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('../src/services/crypto', async (original) => ({
    ...(await original<any>()), verifyStoredPin: async (pin) => pin === '482915', hashPin: async () => 'test-pin-hash',
    deriveLookupSecretKey: async () => ({ type: 'secret' }), rememberLookupSecretKey: async () => true
}));
vi.mock('../src/features/biometric', async (original) => ({ ...(await original<any>()),
    isBiometricEnabled: () => false, refreshBiometricUi: vi.fn(), clearBiometricRecord: vi.fn()
}));
vi.mock('../src/features/zto-status', async (original) => ({ ...(await original<any>()), scheduleZtoStatusSweep: vi.fn() }));
vi.mock('../src/features/zto-palm-login', async (original) => ({ ...(await original<any>()), refreshZtoPalmSession: vi.fn() }));
import { refTo, setFieldValue, fieldValue } from '../src/app/refs';
import { lookupAction } from '../src/core/action-registry';
import { modalIsOpen, registerModalMeta, setModalDisplay, unregisterModalMeta } from '../src/core/modals';
import { dataState, firebaseState, securityState, uiState } from '../src/core/state';
import { viewState } from '../src/core/view-state';
import { cancelPinEntryFlow } from '../src/features/config';
import { saveNewSecurityPin, verifySecurityPin } from '../src/features/pin';
import { moreMenuEditPhone, moreMenuExchangeRate } from '../src/ui/more-menu';
import { BarcodeListContainer } from '../src/app/components/barcode/BarcodeListContainer';
import { HistoryRow } from '../src/app/components/history/HistoryRow';
import { mount, step, unmount } from './native/react-harness';

const ids = ['pinModal', 'pinSetupModal', 'editPhoneModal', 'editBarcodePriceModal', 'exchangeRateModal', 'viewListModal'];
const fields = ['securityPinInput', 'newSecurityPinInput', 'editPhoneInput', 'editBcCodInput', 'editBcDodInput', 'exchangeRateInput'] as const;
const routes = [
    { name: 'តម្លៃ Barcode', modal: 'editBarcodePriceModal', prompt: 'កែតម្លៃកញ្ចប់', open: () => {
        uiState.viewListView = [{ itemId: 'row', code: 'CODE', index: 1, locker: 'A', time: null, origin: '', moneyClass: '', money: [], sum: null, closed: false, signed: false }];
        mount(<BarcodeListContainer />); step(() => document.querySelector<HTMLButtonElement>('.btn-edit-item-price')!.click());
    } },
    { name: 'លេខទូរស័ព្ទក្នុងម៉ឺនុយ', modal: 'editPhoneModal', prompt: 'កែលេខទូរស័ព្ទ', open: () => moreMenuEditPhone('row') },
    { name: 'លេខខុសក្នុងតារាង', modal: 'editPhoneModal', prompt: 'កែលេខទូរស័ព្ទ', open: () => {
        mount(<table><tbody><tr><HistoryRow row={{ id: 'row', phone: '0970000001', money: {}, callKind: 'fix-phone' } as any} /></tr></tbody></table>);
        step(() => document.querySelector<HTMLButtonElement>('.fix-phone-btn')!.click());
    } },
    { name: 'អត្រាប្រាក់', modal: 'exchangeRateModal', prompt: 'ប្តូរអត្រាប្រាក់', open: moreMenuExchangeRate }
];

beforeEach(() => {
    vi.useFakeTimers(); localStorage.clear(); sessionStorage.clear();
    localStorage.setItem('zoew_security_pin_hash', 'test-pin-hash');
    Object.assign(securityState, { isVerifyingPin: false, pinTargetAction: null, lookupSecretKey: null, appIsLocked: false });
    Object.assign(firebaseState, { db: {}, auth: { currentUser: { uid: 'owner' } }, fb: { set: vi.fn(), runTransaction: vi.fn() } });
    firebaseState.authGeneration++;
    uiState.editingItemId = null; uiState.activeParentItemId = null; uiState.modalDisplay = {}; uiState.modalStack = [];
    dataState.exchangeRateRiel = 4100;
    dataState.scanHistory = [{ id: 'row', barcode: 'CODE', phone: '0970000001', barcodes: [{ code: 'CODE', cod: 3, dod: 1 }] }] as any;
    for (const id of ids) { registerModalMeta(id, {}); setModalDisplay(id, 'none'); }
    for (const field of fields) refTo(field)(document.createElement('input'));
    vi.stubGlobal('alert', vi.fn());
});
afterEach(() => {
    unmount(); for (const id of ids) { setModalDisplay(id, 'none'); unregisterModalMeta(id); }
    for (const field of fields) refTo(field)(null);
    vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); localStorage.clear(); sessionStorage.clear();
});

it.each(routes)('$name ៖ សុំ PIN មុនបើក · PIN ត្រឹមត្រូវបើកគោលដៅដើម', async (route) => {
    route.open();
    expect(modalIsOpen('pinModal')).toBe(true);
    expect(modalIsOpen(route.modal)).toBe(false);
    expect(viewState.pinPromptVerifyText).toContain(route.prompt);
    expect(firebaseState.fb.set).not.toHaveBeenCalled();
    setFieldValue('securityPinInput', '482915'); await verifySecurityPin();
    expect(modalIsOpen('pinModal')).toBe(false);
    expect(modalIsOpen(route.modal)).toBe(true);
    if (route.modal === 'editPhoneModal') expect(fieldValue('editPhoneInput')).toBe('0970000001');
    if (route.modal === 'editBarcodePriceModal') expect(fieldValue('editBcCodInput')).toBe('3');
    if (route.modal === 'exchangeRateModal') expect(fieldValue('exchangeRateInput')).toBe('4100');
});

it.each(routes)('$name ៖ PIN ខុស ឬបោះបង់ មិនបើក editor', async (route) => {
    route.open(); setFieldValue('securityPinInput', 'wrong'); await verifySecurityPin();
    expect(modalIsOpen(route.modal)).toBe(false);
    expect(modalIsOpen('pinModal')).toBe(true);
    cancelPinEntryFlow(); setFieldValue('securityPinInput', '482915'); await verifySecurityPin();
    expect(modalIsOpen(route.modal)).toBe(false);
});

it.each(routes)('$name ៖ គ្មាន PIN ត្រូវកំណត់សិន ហើយបន្តគោលដៅតែម្តង', async (route) => {
    localStorage.removeItem('zoew_security_pin_hash'); route.open();
    expect(modalIsOpen('pinSetupModal')).toBe(true);
    expect(modalIsOpen(route.modal)).toBe(false);
    setFieldValue('newSecurityPinInput', '482915'); await saveNewSecurityPin();
    expect(modalIsOpen(route.modal)).toBe(true);
    expect(modalIsOpen('pinSetupModal')).toBe(false);
});

it.each(routes)('$name ៖ ប្តូរគណនី/ហាងពេលសុំ PIN មិនបើក editor ក្នុង session ថ្មី', async (route) => {
    route.open(); firebaseState.authGeneration++; firebaseState.db = {};
    setFieldValue('securityPinInput', '482915'); await verifySecurityPin();
    expect(modalIsOpen(route.modal)).toBe(false);
});

it('គោលដៅក្រោយ PIN មិនអាចហៅជាប៊ូតុងផ្ទាល់បាន', () => {
    for (const name of ['openEditModal', 'openEditBarcodePriceModal', 'openExchangeRateModal']) expect(lookupAction(name)).toBeNull();
});
