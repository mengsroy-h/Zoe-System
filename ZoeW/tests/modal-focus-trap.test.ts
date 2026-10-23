/**
 * ⛔ ពិនិត្យសុវត្ថិភាព (សំណើម្ចាស់គម្រោង ៖ «ពិនិត្យប្រព័ន្ធសុវត្ថិភាពក្រែងក្រោយកែ modal ច្រើនដងអាចបង្ករចន្លោះ អាច bypass pin ឬ activate key») ៖
 *    browser ពិត (Laptop) ៖ ផ្ទាំង PIN · ផ្ទាំង Activate បើក ➜ Tab ផ្លាស់ focus ទៅ ☰ (navMenuBtn) · 🔔 · «ថ្ងៃនេះ» · កាលបរិច្ឆេទ ខាងក្រោយផ្ទាំង
 *    ➜ Enter បើក ☰ ឬប៊ូតុងទំព័រ ខណៈ Key ត្រូវដកហូត (ទិន្នន័យនៅលើទំព័រ) — កណ្តុរ/ចុចមិនបាន (ផ្ទាំងគ្របគ្រប់ចំណុច) តែ keyboard បាន។
 * ⛔ ច្បាប់ ៖ ពេលផ្ទាំងបើក focus នៅក្នុងផ្ទាំងខាងលើបង្អស់ (`focusTrapLayer()`) · App ចាក់សោ ➜ ផ្ទាំងចាក់សោ · focus ចេញ ➜ ត្រឡប់ចូលធាតុដំបូង
 *    (Shift+Tab ➜ ធាតុចុងក្រោយ) ដោយ preventScroll · toast ក្រៅផ្ទាំងអនុញ្ញាត · គ្មានផ្ទាំង ➜ មិនប៉ះ។
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { securityState, uiState } from '../src/core/state';
import { keepFocusInLayer, listenModalFocusTrap } from '../src/app/behaviors/modal-focus-trap';
import { refTo } from '../src/app/refs';

vi.mock('../src/app/lifecycle/layers', () => ({ topmostModal: () => (uiStateRef().isModalOpen ? 'activationModal' : null) }));
vi.mock('../src/app/components/modals/Modal', () => ({ modalElement: (id: string) => document.getElementById(id) }));

function uiStateRef() {
    return uiState;
}

const listeners: Array<[EventTarget, string, any, any]> = [];
let box: HTMLElement;
let modal: HTMLElement;

function scope() {
    return {
        disposed: false,
        listen(target: EventTarget | null | undefined, type: string, handler: any, options?: any) {
            if (!target) return;
            target.addEventListener(type, handler, options);
            listeners.push([target, type, handler, options]);
        },
        every() {}, onLoad() {}, onDispose() {}, dispose() {}
    } as any;
}

function visible(...els: HTMLElement[]) {
    for (const el of els) el.getClientRects = () => [{ width: 10, height: 10 }] as unknown as DOMRectList;
}

const byId = (id: string) => document.getElementById(id) as HTMLElement;

beforeEach(() => {
    box = document.createElement('div');
    box.innerHTML = '<nav><button id="navMenuBtn">☰</button><button id="navNotifyBtn">🔔</button></nav>' +
        '<main><button id="btnFilterToday">ថ្ងៃនេះ</button><input id="hwScannerInput"></main>' +
        '<div class="modal" id="activationModal" style="display:flex;z-index:1100"><div class="modal-content"><input id="activationKeyInput"><button id="activateBtn">Activate</button></div></div>' +
        '<div class="app-lock" id="appLockScreen"><input id="appLockPinInput"><button id="appLockSubmitBtn">ដោះសោ</button></div>' +
        '<div class="toast-container"><button id="toastAction">↩️</button></div>';
    document.body.append(box);
    modal = byId('activationModal');
    visible(...Array.from(box.querySelectorAll<HTMLElement>('input, button')));
    refTo('appLockPinInput')(byId('appLockPinInput'));
    uiState.modalStack = ['activationModal'];
    uiState.isModalOpen = true;
    uiState.modalDisplay = { activationModal: 'flex' };
    securityState.appIsLocked = false;
    listenModalFocusTrap(scope());
});

afterEach(() => {
    listeners.splice(0).forEach(([t, type, h, o]) => t.removeEventListener(type, h, o));
    refTo('appLockPinInput')(null);
    box.remove();
    uiState.modalStack = [];
    uiState.isModalOpen = false;
    uiState.modalDisplay = {};
    securityState.appIsLocked = false;
});

describe('⛔ ផ្ទាំងបើក ➜ focus មិនចេញទៅប៊ូតុងទំព័រខាងក្រោយ (Tab · keyboard · ម៉ាស៊ីនស្កេន)', () => {
    it('⛔ Tab ពីធាតុចុងក្រោយ ➜ ត្រឡប់ធាតុដំបូង មុន browser យក focus ទៅរបាអាសយដ្ឋាន', () => {
        byId('activateBtn').focus();
        const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
        byId('activateBtn').dispatchEvent(event);
        expect(event.defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(byId('activationKeyInput'));
    });

    it('⛔ Shift+Tab ពីធាតុដំបូង ➜ ទៅធាតុចុងក្រោយដោយមិនចេញពី App', () => {
        byId('activationKeyInput').focus();
        const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true });
        byId('activationKeyInput').dispatchEvent(event);
        expect(event.defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(byId('activateBtn'));
    });

    it('ទិសផ្ទុយ ៖ Tab នៅកណ្តាលប្រអប់ ឬព្រឹត្តិការណ៍ដែលបានដោះស្រាយរួច ➜ ទុកឥរិយាបថធម្មតា', () => {
        byId('activationKeyInput').focus();
        const forward = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
        byId('activationKeyInput').dispatchEvent(forward);
        expect(forward.defaultPrevented).toBe(false);
        expect(document.activeElement).toBe(byId('activationKeyInput'));
        byId('activateBtn').focus();
        const handled = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
        handled.preventDefault();
        byId('activateBtn').dispatchEvent(handled);
        expect(document.activeElement).toBe(byId('activateBtn'));
    });

    it('⛔ មានធាតុប្រើបានតែមួយ ➜ Tab ទាំងពីរទិសនៅក្នុងប្រអប់ (ប៊ូតុងបិទមិនរាប់)', () => {
        (byId('activateBtn') as HTMLButtonElement).disabled = true;
        for (const shiftKey of [false, true]) {
            byId('activationKeyInput').focus();
            const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, cancelable: true });
            byId('activationKeyInput').dispatchEvent(event);
            expect(event.defaultPrevented).toBe(true);
            expect(document.activeElement).toBe(byId('activationKeyInput'));
        }
    });

    it('⛔ ផ្ទាំងចាក់សោនៅលើ modal ➜ Tab នៅតែវិលក្នុងផ្ទាំងចាក់សោ', () => {
        securityState.appIsLocked = true;
        byId('appLockSubmitBtn').focus();
        const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
        byId('appLockSubmitBtn').dispatchEvent(event);
        expect(event.defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(byId('appLockPinInput'));
    });

    it('ទិសផ្ទុយ ៖ toast និងទំព័រគ្មាន modal ➜ Tab មិនត្រូវបានទប់', () => {
        byId('toastAction').focus();
        const toastTab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
        byId('toastAction').dispatchEvent(toastTab);
        expect(toastTab.defaultPrevented).toBe(false);
        uiState.isModalOpen = false;
        byId('navMenuBtn').focus();
        const pageTab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
        byId('navMenuBtn').dispatchEvent(pageTab);
        expect(pageTab.defaultPrevented).toBe(false);
    });

    it('⛔ Tab ទៅ ☰ ➜ focus ត្រឡប់ទៅធាតុដំបូងក្នុងផ្ទាំង Activate', () => {
        byId('activationKeyInput').focus();
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        byId('navMenuBtn').focus();
        expect(modal.contains(document.activeElement)).toBe(true);
        expect(document.activeElement && document.activeElement.id).toBe('activationKeyInput');
    });

    it('⛔ Shift+Tab ទៅ «ថ្ងៃនេះ» ➜ focus ទៅធាតុចុងក្រោយក្នុងផ្ទាំង', () => {
        byId('activationKeyInput').focus();
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }));
        byId('btnFilterToday').focus();
        expect(document.activeElement && document.activeElement.id).toBe('activateBtn');
    });

    it('⛔ App ចាក់សោ ➜ focus ចេញពីផ្ទាំងចាក់សោ ➜ ត្រឡប់ចូលផ្ទាំងចាក់សោ', () => {
        securityState.appIsLocked = true;
        byId('appLockPinInput').focus();
        byId('hwScannerInput').focus();
        expect(byId('appLockScreen').contains(document.activeElement)).toBe(true);
    });

    it('ទិសផ្ទុយ ៖ ធាតុក្នុងផ្ទាំង · toast ➜ មិនប៉ះ · គ្មានផ្ទាំង ➜ ទំព័រ focus ធម្មតា', () => {
        byId('activateBtn').focus();
        expect(document.activeElement && document.activeElement.id).toBe('activateBtn');
        byId('toastAction').focus();
        expect(document.activeElement && document.activeElement.id).toBe('toastAction');
        uiState.modalStack = [];
        uiState.isModalOpen = false;
        uiState.modalDisplay = {};
        byId('navMenuBtn').focus();
        expect(document.activeElement && document.activeElement.id).toBe('navMenuBtn');
    });

    it('ទិសផ្ទុយ ៖ ព្រឹត្តិការណ៍ focusin ដែលគ្មានគោលដៅ ➜ មិនបោះកំហុស', () => {
        expect(() => keepFocusInLayer(new FocusEvent('focusin'))).not.toThrow();
    });
});
