/**
 * ⛔ UI-1 ៖ កុំព្យូទ័រ (scanner ដៃ) ៖ បិទប្រអប់ (Escape · Enter · ប៊ូតុង) ខណៈ cursor នៅក្នុងប្រអប់អក្សររបស់ប្រអប់នោះ ➜ `safeFocusScanner()` ឃើញ
 *    `document.activeElement` នៅជាប្រអប់អក្សរ (browser ផ្លាស់ focus ចេញពីធាតុដែលលាក់តែនៅការគូរបន្ទាប់) ➜ ឈប់ ➜ focus ធ្លាក់ទៅ `body` ➜
 *    ការស្កេនបន្ទាប់ពី scanner ដៃបាត់។ ⛔ ប្រអប់អក្សរនៅក្នុងប្រអប់ដែលបិទហើយ មិនមែនជាការវាយរបស់អ្នកប្រើទេ ➜ scanner ត្រូវទទួល focus ·
 *    ទិសផ្ទុយ ៖ ប្រអប់អក្សរខាងក្រៅប្រអប់ (ស្វែងរកលេខ) ឬប្រអប់នៅបើក ➜ មិនលួច focus។
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { securityState, uiState } from '../src/core/state';
import { closeModal, openModalHelper } from '../src/ui/modal';
import { AppPages } from '../src/app/components/AppPages';
import { ExchangeRateModal } from '../src/app/components/modals/ExchangeRateModal';
import { PhoneModal } from '../src/app/components/modals/PhoneModal';
import '../src/app/flush';
import { byId, mount, step, unmount } from './native/react-harness';

beforeEach(() => {
    step(() => {
        uiState.modalDisplay = {};
        uiState.modalStack = [];
        uiState.isModalOpen = false;
        securityState.appIsLocked = false;
    });
    mount(<><AppPages /><ExchangeRateModal /><PhoneModal /></>);
});

afterEach(() => { unmount(); document.body.innerHTML = ''; });

const active = () => (document.activeElement as HTMLElement | null)?.id || '';

describe('UI-1 ៖ បិទប្រអប់ ➜ scanner ដៃទទួល focus វិញ (កុំព្យូទ័រ)', () => {
    it('ជាន់អប្បបរមា ៖ ធាតុពិតត្រូវ React គូរ · scanner ទទួល focus បាន', () => {
        expect(byId('hwScannerInput').tagName).toBe('INPUT');
        expect(byId('exchangeRateInput').tagName).toBe('INPUT');
        byId('hwScannerInput').focus();
        expect(active()).toBe('hwScannerInput');
    });

    it('⛔ cursor នៅក្នុងប្រអប់អក្សររបស់ប្រអប់ ➜ បិទ ➜ scanner ទទួល focus', () => {
        step(() => openModalHelper('exchangeRateModal'));
        byId('exchangeRateInput').focus();
        expect(active()).toBe('exchangeRateInput');
        step(() => closeModal('exchangeRateModal'));
        expect(active()).toBe('hwScannerInput');
    });

    it('ទិសផ្ទុយ ៖ ប្រអប់ពីរ ➜ បិទប្រអប់លើ ➜ ប្រអប់ក្រោមនៅបើក ➜ scanner មិនលួច focus', () => {
        step(() => openModalHelper('phoneModal'));
        step(() => openModalHelper('exchangeRateModal'));
        byId('exchangeRateInput').focus();
        step(() => closeModal('exchangeRateModal'));
        expect(active()).not.toBe('hwScannerInput');
    });

    it('ទិសផ្ទុយ ៖ ប្រអប់អក្សរខាងក្រៅប្រអប់ (អ្នកប្រើកំពុងវាយ) ➜ បិទប្រអប់ ➜ focus នៅដដែល', () => {
        step(() => openModalHelper('exchangeRateModal'));
        const outside = document.querySelector('.page-side input[type="text"], .page-side input[type="search"], .page-side input[type="tel"]') as HTMLElement | null;
        expect(outside).not.toBe(null);
        outside!.focus();
        step(() => closeModal('exchangeRateModal'));
        expect(document.activeElement).toBe(outside);
    });
});
