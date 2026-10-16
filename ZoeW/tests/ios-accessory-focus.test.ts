/**
 * ⛔ រាយការណ៍ម្ចាស់គម្រោង (iPhone App លើ Home Screen) ៖ «ពេលចុចសញ្ញា ចុះមកប្រអប់បន្ទាប់របស់ keyboard PgUp/PgDn លោតទំព័រ» —
 *    ទំព័រស្កេន (Barcode) · ផ្ទាំងលេខទូរស័ព្ទ/COD · ផ្ទាំងផ្សេង។
 *    WebKit ៖ ∨/∧ លើរបារពីលើ keyboard (`accessoryTab:` ➜ `WebPage::focusNextFocusedElement`) ហៅ `element->focus()` **គ្មាន preventScroll** ➜
 *    `_zoomToRevealFocusedElement` (iPhone ៖ `forceScroll:[self requiresAccessoryView]`) រំកិលទំព័រជានិច្ច ទោះប្រអប់មើលឃើញរួចក៏ដោយ ➜ App ទាញត្រឡប់ ➜ លោត។
 *    ព័ត៌មាន focus ដែលផ្ញើទៅ UI process (`PendingFocusedElementUpdate.options.preventScroll`) យកពីការហៅ `elementDidFocus` ដំបូងរបស់ធាតុនោះ ៖
 *    ព្រឹត្តិការណ៍ `focus` រត់មុនជូនដំណឹង client (`DispatchFocusEventBeforeNotifyingClient`) ➜ `focus({ preventScroll: true })` ក្នុងព្រឹត្តិការណ៍ `focus`
 *    (`elementDidRefocus`) ក្លាយជាព័ត៌មាននោះ ហើយការជូនដំណឹងដើម (គ្មាន preventScroll) ត្រូវបោះចោល (`m_focusedElement == element` + keyboard បង្ហាញ)។
 *    តេស្តនេះក្លែងច្បាប់នោះ (`wk`) លើ App ពិត ៖ ∨/∧ ពេល keyboard បង្ហាញ ➜ preventScroll ទៅដល់ WebKit ➜ ទំព័រមិនរំកិល។
 *    ទិសផ្ទុយ ៖ គ្មាន keyboard (keyboard រឹង ៖ Tab) · ចុចផ្ទាល់ (iOS បង្ហាញប្រអប់ដែលគ្របដោយ keyboard) · ម្រាមដៃនៅលើអេក្រង់ · ប្រអប់ក្រោយ keyboard ដែលមិនផ្លាស់ទី
 *    (ត្រូវឲ្យ iOS រំកិលបង្ហាញ) · Android · ធាតុមិនមែនកន្លែងវាយ ➜ មិនប៉ះ។ ព្រឹត្តិការណ៍ focus/blur មិនកើនឡើង · caret មិនផ្លាស់ទី។
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { scanState, uiState } from '../src/core/state';
import * as modalKeyboard from '../src/app/behaviors/modal-keyboard';
import { refTo } from '../src/app/refs';

const listeners: Array<[EventTarget, string, any, any]> = [];
const disposers: Array<() => void> = [];
const realFocus = HTMLElement.prototype.focus;
let box: HTMLElement;
let vv: EventTarget & { height: number; offsetTop: number };
let clock = 10000;
const wk: { focused: Element | null; pending: { id: string; preventScroll: boolean } | null } = { focused: null, pending: null };
let focusEvents = 0;

function scope() {
    return {
        disposed: false,
        listen(target: EventTarget | null | undefined, type: string, handler: any, options?: any) {
            if (!target) return;
            target.addEventListener(type, handler, options);
            listeners.push([target, type, handler, options]);
        },
        every() {}, onLoad() {}, onDispose(fn: () => void) { disposers.push(fn); }, dispose() {}
    } as any;
}

function rect(top: number, height: number) {
    return { top, bottom: top + height, left: 0, right: 300, width: 300, height, x: 0, y: top, toJSON() {} } as DOMRect;
}

function setIOSStandalone(on: boolean) {
    Object.defineProperty(window.navigator, 'standalone', { configurable: true, value: on ? true : undefined });
    Object.defineProperty(window, 'CSS', { configurable: true, value: { supports: (p: string, v: string) => on && p === '-webkit-touch-callout' && v === 'none' } });
}

function keyboard(px: number) {
    vv.height = 844 - px;
    vv.dispatchEvent(new Event('resize'));
}

function installWebKitFocusModel() {
    HTMLElement.prototype.focus = function (this: HTMLElement, options?: FocusOptions) {
        const preventScroll = !!(options && options.preventScroll);
        if (document.activeElement === this) {
            if (wk.focused !== this) {
                wk.focused = this;
                wk.pending = { id: this.id, preventScroll };
            }
            return realFocus.call(this, options);
        }
        realFocus.call(this, options);
        if (document.activeElement === this && wk.focused !== this) {
            wk.focused = this;
            wk.pending = { id: this.id, preventScroll };
        }
    };
    document.addEventListener('focusout', forgetWebKitFocus, true);
    document.addEventListener('focus', countFocus, true);
}

function forgetWebKitFocus(e: Event) {
    if (wk.focused === e.target) wk.focused = null;
}

function countFocus() {
    focusEvents++;
}

function accessoryTo(el: HTMLElement) {
    clock += 2000;
    wk.pending = null;
    el.focus();
    return wk.pending as { id: string; preventScroll: boolean } | null;
}

function touch(type: string, target: EventTarget, active: number, y = 50) {
    const ev = new Event(type, { bubbles: true, cancelable: true });
    const t = { identifier: 1, clientX: 50, clientY: y, target };
    Object.defineProperty(ev, 'touches', { value: Array.from({ length: active }, () => t) });
    Object.defineProperty(ev, 'changedTouches', { value: [t] });
    Object.defineProperty(ev, 'timeStamp', { value: clock });
    target.dispatchEvent(ev);
}

const el = <T extends HTMLElement = HTMLInputElement>(id: string) => box.querySelector('#' + id) as T;

beforeEach(() => {
    clock = 10000;
    vi.spyOn(performance, 'now').mockImplementation(() => clock);
    try { localStorage.removeItem('zoew_keyboard_inset_v1'); } catch {}
    Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: 844 });
    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 390 });
    vv = Object.assign(new EventTarget(), { height: 844, offsetTop: 0 });
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: vv });
    setIOSStandalone(true);
    uiState.isModalOpen = false;
    uiState.modalDisplay = {};
    uiState.currentAppPage = 'entry';
    uiState.entryPanelCollapsed = false;
    scanState.isCameraScanning = false;
    scanState.isCameraStarting = false;
    wk.focused = null;
    wk.pending = null;
    focusEvents = 0;
    box = document.createElement('div');
    box.innerHTML =
        '<div id="appPages"><div id="entrySideSection"><input type="text" id="hwScannerInput"><button type="button" id="sendBtn">បញ្ជូន</button></div>' +
        '<div id="entryMainSection"><input type="search" id="entryListSearchInput"></div></div>' +
        '<div class="modal" id="phoneModal"><div class="modal-content">' +
        '<input type="tel" id="phoneInput" value="012000111"><input type="text" id="lockerInput"><input type="number" id="codInput"><input type="number" id="dodInput">' +
        '<input type="checkbox" id="fastCheck"></div></div>';
    document.body.append(box);
    el('hwScannerInput').getBoundingClientRect = () => rect(290, 30);
    el('entryListSearchInput').getBoundingClientRect = () => rect(700, 36);
    for (const [i, id] of ['phoneInput', 'lockerInput', 'codInput', 'dodInput'].entries()) el(id).getBoundingClientRect = () => rect(200 + i * 50, 40);
    refTo('hwScannerInput')(el('hwScannerInput'));
    refTo('entryListSearchInput')(el('entryListSearchInput'));
    refTo('appPages')(el('appPages'));
    installWebKitFocusModel();
    modalKeyboard.listenModalKeyboard(scope());
});

afterEach(() => {
    disposers.splice(0).forEach((fn) => fn());
    listeners.splice(0).forEach(([t, type, h, o]) => t.removeEventListener(type, h, o));
    HTMLElement.prototype.focus = realFocus;
    document.removeEventListener('focusout', forgetWebKitFocus, true);
    document.removeEventListener('focus', countFocus, true);
    refTo('hwScannerInput')(null);
    refTo('entryListSearchInput')(null);
    refTo('appPages')(null);
    box.remove();
    setIOSStandalone(false);
    Object.defineProperty(window.navigator, 'userAgentData', { configurable: true, value: undefined });
    uiState.isModalOpen = false;
    uiState.modalDisplay = {};
    vi.restoreAllMocks();
});

function openPhoneModal() {
    uiState.modalDisplay = { phoneModal: 'flex' };
    uiState.isModalOpen = true;
}

describe('iPhone ៖ ∨/∧ លើ keyboard (ប្រអប់បន្ទាប់/មុន) ➜ WebKit ទទួល preventScroll ➜ ទំព័រមិនរំកិល', () => {
    it('⛔ ផ្ទាំងលេខទូរស័ព្ទ/COD ៖ លេខ ➜ Locker ➜ COD ➜ DOD ➜ ត្រឡប់ ∧ ៖ រាល់ការប្តូរ ➜ preventScroll · ព្រឹត្តិការណ៍ focus ម្តង/ការប្តូរ · caret ដដែល', () => {
        openPhoneModal();
        el('phoneInput').focus({ preventScroll: true });
        keyboard(336);
        const order = ['lockerInput', 'codInput', 'dodInput', 'codInput', 'lockerInput', 'phoneInput'];
        const seen = order.map((id) => {
            focusEvents = 0;
            const caret = el(id).selectionStart;
            const pending = accessoryTo(el(id));
            return { id, pending, events: focusEvents, active: document.activeElement === el(id), caret: el(id).selectionStart === caret };
        });
        for (const s of seen) {
            expect(s.active).toBe(true);
            expect(s.pending).toEqual({ id: s.id, preventScroll: true });
            expect(s.events).toBe(1);
            expect(s.caret).toBe(true);
        }
    });

    it('⛔ ទំព័រស្កេន ៖ កន្លែងវាយ Barcode (ពីលើ keyboard) ⇄ ស្វែងរកក្នុងបញ្ជី (ផ្ទាំងបង្រួម ➜ ឡើងលើ) ៖ preventScroll ទាំងពីរទិស', () => {
        el('hwScannerInput').focus({ preventScroll: true });
        keyboard(403);
        expect(accessoryTo(el('entryListSearchInput'))).toEqual({ id: 'entryListSearchInput', preventScroll: true });
        expect(accessoryTo(el('hwScannerInput'))).toEqual({ id: 'hwScannerInput', preventScroll: true });
        uiState.entryPanelCollapsed = true;
        expect(accessoryTo(el('entryListSearchInput'))).toEqual({ id: 'entryListSearchInput', preventScroll: true });
    });
});

describe('ទិសផ្ទុយ ៖ ករណីដែល iOS ត្រូវបង្ហាញប្រអប់ខ្លួនឯង ឬគ្មាន ∨/∧ ➜ App មិនប៉ះ', () => {
    it('គ្មាន keyboard លើអេក្រង់ (keyboard រឹង ៖ Tab) ➜ មិនប៉ះ', () => {
        openPhoneModal();
        el('phoneInput').focus({ preventScroll: true });
        expect(accessoryTo(el('lockerInput'))).toEqual({ id: 'lockerInput', preventScroll: false });
    });

    it('ចុចផ្ទាល់ដែល App មិនចាប់ (អូស ➜ iOS focus ក្រោយលែងម្រាមដៃ) · ម្រាមដៃនៅលើអេក្រង់ ➜ មិនប៉ះ (iOS បង្ហាញប្រអប់ដែល keyboard គ្រប)', () => {
        openPhoneModal();
        el('phoneInput').focus({ preventScroll: true });
        keyboard(336);
        touch('touchstart', el('codInput'), 1, 50);
        touch('touchend', el('codInput'), 0, 90);
        clock += 120;
        wk.pending = null;
        el('codInput').focus();
        expect(wk.pending).toEqual({ id: 'codInput', preventScroll: false });
        clock += 2000;
        touch('touchstart', el('lockerInput'), 1);
        wk.pending = null;
        el('dodInput').focus();
        expect(wk.pending).toEqual({ id: 'dodInput', preventScroll: false });
        touch('touchend', el('lockerInput'), 0);
    });

    it('ស្វែងរកក្នុងបញ្ជីក្រោយ keyboard ពេលកាមេរ៉ាស្កេន (មិនឡើងលើ) ➜ iOS រំកិលបង្ហាញ · កន្លែងវាយ Barcode ក្រោយ keyboard ➜ iOS', () => {
        el('hwScannerInput').focus({ preventScroll: true });
        keyboard(403);
        scanState.isCameraScanning = true;
        expect(accessoryTo(el('entryListSearchInput'))).toEqual({ id: 'entryListSearchInput', preventScroll: false });
        scanState.isCameraScanning = false;
        el('hwScannerInput').getBoundingClientRect = () => rect(430, 30);
        expect(accessoryTo(el('hwScannerInput'))).toEqual({ id: 'hwScannerInput', preventScroll: false });
    });

    it('Android (Chrome · APK) · iOS មិនមែន standalone ➜ មិនប៉ះ', () => {
        setIOSStandalone(false);
        Object.defineProperty(window.navigator, 'userAgentData', { configurable: true, value: { platform: 'Android', mobile: true } });
        openPhoneModal();
        el('phoneInput').focus({ preventScroll: true });
        keyboard(330);
        expect(accessoryTo(el('lockerInput'))).toEqual({ id: 'lockerInput', preventScroll: false });
    });

    it('ធាតុមិនមែនកន្លែងវាយ (checkbox · ប៊ូតុង) ➜ គ្មាន focus បន្ថែម', () => {
        openPhoneModal();
        el('phoneInput').focus({ preventScroll: true });
        keyboard(336);
        expect(accessoryTo(el('fastCheck'))).toEqual({ id: 'fastCheck', preventScroll: false });
        expect(accessoryTo(el<HTMLElement>('sendBtn'))).toEqual({ id: 'sendBtn', preventScroll: false });
    });
});
