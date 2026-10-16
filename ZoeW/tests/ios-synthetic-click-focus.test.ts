/**
 * ⛔ វីដេអូម្ចាស់គម្រោង (preview 2.50.85 · App លើ Home Screen) ៖ ចុចកន្លែងវាយ Barcode ➜ ទំព័រលោតចុះ ១៣៨–២១៤pt ហើយរអិលត្រឡប់ក្នុង ~២០០ms
 *    (៣ ដងក្នុង ២៥ វិនាទី ៖ ក្រោយស្វែងរក · ក្រោយប្តូររបៀបដក) — ចំនួនស្មើ WebKit `_zoomToFocusRect` ដាក់ប្រអប់នៅកណ្តាលផ្ទៃពីលើ keyboard ពិតៗ។
 *    WebKit ៖ ការចុចដែល App ចាប់ (touchend preventDefault + `focus({ preventScroll: true })`) នៅតែអាចមាន «ចុចសំយោគ» (synthetic click ៖ ព្រឹត្តិការណ៍
 *    touch មិនអាចការពារ ឧ. ចុចភ្លាមក្រោយទំព័រកំពុងរអិល) ➜ `mousedown` ➜ `FocusController::setFocusedElement` លើធាតុដែល focus រួច ➜ `elementDidRefocus`
 *    (ជម្រើសលំនាំដើម ៖ preventScroll = false) ➜ `WebPage::elementDidFocus` សរសេរជាន់ព័ត៌មាន focus ដែលរង់ចាំ (keyboard មិនទាន់បង្ហាញ ៖
 *    `shouldDispatchUpdateAfterFocusingElement`) ➜ `completeSyntheticClick` ផ្ញើ preventScroll = false ➜ iOS ដាក់ប្រអប់នៅកណ្តាល ➜ App ទាញ document ត្រឡប់ ០
 *    ខណៈចលនា keyboard (additive) នៅរត់ ➜ ទំព័រលោតចុះ។ ស្លាក (`label[for]`) ៖ `click` ➜ focus ប្រអប់ដែលភ្ជាប់ ដូចគ្នា។
 *    តេស្តនេះក្លែងច្បាប់នោះ (`wk` ៖ focus/refocus ពេល keyboard មិនទាន់បង្ហាញ ➜ ការចុងក្រោយឈ្នះ) លើ App ពិត ៖ ចុចដែលចាប់ ➜ ចុចសំយោគ ➜ preventScroll នៅ true។
 *    ទិសផ្ទុយ ៖ ចុចដែល App មិនចាប់ (ប្រអប់ក្រោយ keyboard ៖ iOS ត្រូវបង្ហាញ) · Android · ក្រោយពេលកំណត់ · ការចុចថ្មី ➜ មិនប៉ះ។
 *    ទង់ចាស់ ៖ ប្រអប់ដែលចាប់ blur ហើយ ➜ focus ក្រោយ (iOS បង្ហាញ) មិនត្រូវទាញ document ត្រឡប់ទេ (ការទាញនោះជាអ្វីដែលធ្វើឲ្យលោតចុះ)។
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { uiState } from '../src/core/state';
import * as modalKeyboard from '../src/app/behaviors/modal-keyboard';
import { refTo } from '../src/app/refs';

const listeners: Array<[EventTarget, string, any, any]> = [];
const disposers: Array<() => void> = [];
const focusProtos = Array.from(new Set(['input', 'select', 'textarea', 'button'].map((tag) => {
    let proto = Object.getPrototypeOf(document.createElement(tag));
    while (proto && !Object.prototype.hasOwnProperty.call(proto, 'focus')) proto = Object.getPrototypeOf(proto);
    return proto as HTMLElement;
})));
const realFocus = new Map(focusProtos.map((proto) => [proto, proto.focus]));
const wk: { keyboardShown: boolean; pending: { id: string; preventScroll: boolean } | null } = { keyboardShown: false, pending: null };
let vv: EventTarget & { height: number; offsetTop: number };
let box: HTMLElement;
let scanner: HTMLInputElement;
let label: HTMLElement;
let phone: HTMLInputElement;
let clock = 10000;

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

function installWebKitFocusModel() {
    for (const proto of focusProtos) {
        const real = realFocus.get(proto)!;
        proto.focus = function (this: HTMLElement, options?: FocusOptions) {
            real.call(this, options);
            const active = document.activeElement;
            if (active && active.id === this.id && !wk.keyboardShown) wk.pending = { id: this.id, preventScroll: !!(options && options.preventScroll) };
        };
    }
}

function touch(type: string, target: EventTarget, y: number, active: number) {
    const ev = new Event(type, { bubbles: true, cancelable: true });
    const t = { identifier: 1, clientX: 50, clientY: y, target };
    Object.defineProperty(ev, 'touches', { value: Array.from({ length: active }, () => t) });
    Object.defineProperty(ev, 'changedTouches', { value: [t] });
    Object.defineProperty(ev, 'timeStamp', { value: clock });
    target.dispatchEvent(ev);
    return ev;
}

function tap(target: EventTarget, y: number) {
    touch('touchstart', target, y, 1);
    clock += 80;
    return touch('touchend', target, y, 0);
}

function syntheticClick(target: HTMLElement) {
    clock += 40;
    const down = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    const focusOnDown = target.dispatchEvent(down);
    const control = target.closest('input, textarea, select') as HTMLElement | null;
    if (focusOnDown && control) control.focus();
    target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    const activate = target.dispatchEvent(click);
    const forLabel = target.closest('label') as HTMLLabelElement | null;
    const labelled = forLabel && forLabel.htmlFor ? document.getElementById(forLabel.htmlFor) : null;
    if (activate && labelled) labelled.focus();
    return { downPrevented: down.defaultPrevented, clickPrevented: click.defaultPrevented };
}

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
    wk.keyboardShown = false;
    wk.pending = null;
    box = document.createElement('div');
    box.innerHTML = '<div id="appPages"><label for="hwScannerInput" id="hardwareScannerLabel">ស្កេន Barcode</label>' +
        '<div class="scanner-input-wrapper"><span class="icon">⚡</span><input type="text" id="hwScannerInput"></div></div>' +
        '<div class="modal" id="phoneModal"><div class="modal-content"><input type="tel" id="modalPhoneInput"></div></div>';
    document.body.append(box);
    scanner = box.querySelector('#hwScannerInput') as HTMLInputElement;
    label = box.querySelector('#hardwareScannerLabel') as HTMLElement;
    phone = box.querySelector('#modalPhoneInput') as HTMLInputElement;
    scanner.getBoundingClientRect = () => rect(290, 30);
    phone.getBoundingClientRect = () => rect(200, 40);
    refTo('hwScannerInput')(scanner);
    refTo('appPages')(box.querySelector('#appPages') as HTMLElement);
    installWebKitFocusModel();
    modalKeyboard.listenModalKeyboard(scope());
});

afterEach(() => {
    disposers.splice(0).forEach((fn) => fn());
    listeners.splice(0).forEach(([t, type, h, o]) => t.removeEventListener(type, h, o));
    for (const proto of focusProtos) proto.focus = realFocus.get(proto)!;
    refTo('hwScannerInput')(null);
    refTo('appPages')(null);
    box.remove();
    setIOSStandalone(false);
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
    Object.defineProperty(window.navigator, 'userAgentData', { configurable: true, value: undefined });
    uiState.isModalOpen = false;
    uiState.modalDisplay = {};
    vi.restoreAllMocks();
});

describe('iPhone ៖ ចុចដែល App ចាប់ ➜ ចុចសំយោគ (mousedown · click) មិនលុប preventScroll ➜ iOS មិនដាក់ប្រអប់នៅកណ្តាល ➜ ទំព័រមិនលោត', () => {
    it('⛔ កន្លែងវាយ Barcode ៖ ចុចចាប់ ➜ mousedown លើប្រអប់ ➜ preventDefault ➜ ព័ត៌មាន focus នៅ preventScroll', () => {
        expect(tap(scanner, 305).defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(scanner);
        expect(wk.pending).toEqual({ id: 'hwScannerInput', preventScroll: true });
        const click = syntheticClick(scanner);
        expect(click.downPrevented).toBe(true);
        expect(document.activeElement).toBe(scanner);
        expect(wk.pending).toEqual({ id: 'hwScannerInput', preventScroll: true });
    });

    it('⛔ ស្លាក «ស្កេន Barcode» ៖ ចុចចាប់ ➜ click លើស្លាក (focus ប្រអប់ដែលភ្ជាប់) ➜ preventDefault ➜ preventScroll នៅ', () => {
        expect(tap(label, 280).defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(scanner);
        const click = syntheticClick(label);
        expect(click.clickPrevented).toBe(true);
        expect(wk.pending).toEqual({ id: 'hwScannerInput', preventScroll: true });
    });

    it('⛔ ប្រអប់ក្នុងផ្ទាំង (លេខទូរស័ព្ទ) ៖ ចុចចាប់ ➜ ចុចសំយោគ ➜ preventScroll នៅ', () => {
        uiState.modalDisplay = { phoneModal: 'flex' };
        uiState.isModalOpen = true;
        expect(tap(phone, 220).defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(phone);
        expect(syntheticClick(phone).downPrevented).toBe(true);
        expect(wk.pending).toEqual({ id: 'modalPhoneInput', preventScroll: true });
    });
});

describe('ទិសផ្ទុយ ៖ ចុចដែល iOS ត្រូវធ្វើខ្លួនឯង · Android · ក្រោយពេលកំណត់ · ការចុចថ្មី ➜ មិនប៉ះ', () => {
    it('ប្រអប់ក្រោយ keyboard (App មិនចាប់) ➜ mousedown មិន preventDefault ➜ iOS focus ធម្មតា (បង្ហាញប្រអប់)', () => {
        scanner.getBoundingClientRect = () => rect(700, 30);
        expect(tap(scanner, 710).defaultPrevented).toBe(false);
        const click = syntheticClick(scanner);
        expect(click.downPrevented).toBe(false);
        expect(wk.pending).toEqual({ id: 'hwScannerInput', preventScroll: false });
    });

    it('Android (Chrome · APK) ➜ mousedown · click មិន preventDefault', () => {
        setIOSStandalone(false);
        Object.defineProperty(window.navigator, 'userAgentData', { configurable: true, value: { platform: 'Android', mobile: true } });
        tap(scanner, 305);
        const click = syntheticClick(scanner);
        expect(click.downPrevented).toBe(false);
        expect(click.clickPrevented).toBe(false);
    });

    it('ក្រោយពេលកំណត់ (ចុចសំយោគមិនមក) · ការចុចថ្មីចាប់ផ្តើម ➜ mousedown មិន preventDefault', () => {
        tap(scanner, 305);
        clock += 5000;
        expect(syntheticClick(scanner).downPrevented).toBe(false);
        scanner.blur();
        clock += 2000;
        expect(tap(label, 280).defaultPrevented).toBe(true);
        clock += 100;
        touch('touchstart', scanner, 305, 1);
        expect(syntheticClick(scanner).downPrevented).toBe(false);
    });

    it('ធាតុផ្សេង (iPad + mouse ចុចប៊ូតុងក្នុងពេលកំណត់) ➜ mousedown · click មិន preventDefault (ប៊ូតុង submit នៅដំណើរការ)', () => {
        const button = document.createElement('button');
        button.type = 'submit';
        button.id = 'otherButton';
        box.append(button);
        expect(tap(scanner, 305).defaultPrevented).toBe(true);
        const click = syntheticClick(button);
        expect(click.downPrevented).toBe(false);
        expect(click.clickPrevented).toBe(false);
        expect(syntheticClick(scanner).downPrevented).toBe(true);
    });

    it('ការចុចលើប្រអប់ដែល focus រួច ហើយ keyboard បង្ហាញ (Paste/AutoFill) ➜ មិនចាប់ ➜ មិនប៉ះ', () => {
        tap(scanner, 305);
        clock += 2000;
        wk.keyboardShown = true;
        vv.height = 844 - 336;
        vv.dispatchEvent(new Event('resize'));
        expect(tap(scanner, 305).defaultPrevented).toBe(false);
        expect(syntheticClick(scanner).downPrevented).toBe(false);
    });
});

describe('⛔ ទង់ «ប្រអប់ដែលចាប់» មិននៅជាប់ ៖ blur ហើយ ➜ focus ក្រោយ (iOS បង្ហាញខ្លួនឯង) មិនទាញ document ត្រឡប់', () => {
    it('⛔ ចាប់ ➜ document រំកិល ➜ ត្រឡប់ ០ (ដូចមុន) · blur ➜ focus ធម្មតា ➜ document រំកិល ➜ មិនទាញ', () => {
        const scroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
        tap(scanner, 305);
        Object.defineProperty(window, 'scrollY', { configurable: true, value: 40 });
        document.dispatchEvent(new Event('scroll'));
        expect(scroll).toHaveBeenCalledTimes(1);
        scroll.mockClear();
        Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
        scanner.blur();
        clock += 3000;
        scanner.focus();
        Object.defineProperty(window, 'scrollY', { configurable: true, value: 214 });
        document.dispatchEvent(new Event('scroll'));
        expect(scroll).not.toHaveBeenCalled();
    });
});
