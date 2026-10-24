/**
 * ⛔ វាស់លើ iPhone ពិត (probe [2.50.143] · A285 · toast 🔬 ៧ រូប · App លើ Home Screen) ៖ ទំព័ររុញ ១៣៣pt (navbar ចេញ) · ២១៨pt · ៣៤៥pt ➜ គ្រប់ករណី
 *    `ts:div` (ម្រាមដៃប៉ះ div ក្បែរប្រអប់ ៖ `#hardwareScannerBox` · wrapper ⚡) ➜ `te` មិន preventDefault (App មិនចាប់ ព្រោះគោលដៅ touch មិនមែនប្រអប់) ➜
 *    `md:bc~` · `ck:bc~` · `ck:bc` · `fo:bc` (ស្លាក «ស្កេន Barcode») ឬ `md:sr`/`md:ph` · `fo` (ប្រអប់ស្វែងរក) ➜ keyboard ➜ ទំព័ររុញ។ WebKit ៖ touch event ទៅធាតុក្រោមម្រាមដៃ
 *    តែការចុចសំយោគ (mousedown · click) ទៅធាតុដែល «ឆ្លើយការចុច» នៅជិតបំផុត (touch adjustment ៖ ប្រអប់វាយឈ្នះភ្លាម · ស្លាកតូចជាង root) ➜ focus លំនាំដើម
 *    (គ្មាន preventScroll) ➜ iPhone `_zoomToFocusRect` ដាក់ប្រអប់នៅកណ្តាល។
 * ⛔ ច្បាប់ ៖ iOS standalone · mousedown សំយោគ (touch ចប់ក្នុង `CAUGHT_CLICK_MS` · គ្មានម្រាមដៃ · ប៊ូតុងឆ្វេង) លើប្រអប់ដែល App ចាប់ (កន្លែងវាយ Barcode ·
 *    ស្លាក/⚡ · ប្រអប់ក្នុងផ្ទាំង · ប្រអប់ស្វែងរក) ដែលមិនទាន់ focus ➜ preventDefault ➜ focus `preventScroll` (ស្វែងរក ៖ ទាញឡើង/បង្រួមមុន) ➜ click តាមក្រោយ
 *    (ស្លាក) ត្រូវលេប ➜ ការ focus ពេលចុចសំយោគចប់មាន preventScroll។ ទិសផ្ទុយ ៖ iPad + mouse (គ្មាន touch) · ប្រអប់ដែល keyboard នឹងបាំង · Android · ប៊ូតុង ·
 *    ប្រអប់ focus រួច · ម្រាមដៃនៅលើ · ប៊ូតុងកណ្តាល ➜ មិនប៉ះ។ App Lock ៖ toast 🔬 `fo:input#appLockPinInput` ➜ ទំព័ររុញ ១៩៧pt ពេលត្រឡប់ចូល App ➜ PIN focus
 *    `preventScroll` លើ iOS standalone ពេលប្រអប់នៅពីលើ keyboard ដែលរំពឹង។
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { securityState, uiState } from '../src/core/state';
import * as modalKeyboard from '../src/app/behaviors/modal-keyboard';
import * as iosViewport from '../src/app/behaviors/ios-viewport';
import { refTo } from '../src/app/refs';
import * as appLock from '../src/features/app-lock';
import * as flush from '../src/app/flush';

const listeners: Array<[EventTarget, string, any, any]> = [];
const disposers: Array<() => void> = [];
const focusProtos = Array.from(new Set(['input', 'select', 'textarea', 'button'].map((tag) => {
    let proto = Object.getPrototypeOf(document.createElement(tag));
    while (proto && !Object.prototype.hasOwnProperty.call(proto, 'focus')) proto = Object.getPrototypeOf(proto);
    return proto as HTMLElement;
})));
const realFocus = new Map(focusProtos.map((proto) => [proto, proto.focus]));
const wk: { keyboardShown: boolean; pending: { id: string; preventScroll: boolean } | null; pulledUp: boolean | null; calls: Array<{ id: string; preventScroll: boolean }> } = { keyboardShown: false, pending: null, pulledUp: null, calls: [] };
let vv: EventTarget & { height: number; offsetTop: number };
let box: HTMLElement;
let scannerBox: HTMLElement;
let wrapper: HTMLElement;
let scanner: HTMLInputElement;
let label: HTMLElement;
let submit: HTMLButtonElement;
let phoneSearch: HTMLInputElement;
let phoneSearchBox: HTMLElement;
let lockerSearch: HTMLInputElement;
let lockerFilterBar: HTMLElement;
let pin: HTMLInputElement;
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
            wk.calls.push({ id: this.id, preventScroll: !!(options && options.preventScroll) });
            real.call(this, options);
            const active = document.activeElement;
            if (active && active.id === this.id && !wk.keyboardShown) {
                wk.pending = { id: this.id, preventScroll: !!(options && options.preventScroll) };
                if (this.id === 'searchPhoneInput') wk.pulledUp = uiState.dataPanelSearchFocus;
            }
        };
    }
}

function touch(type: string, target: EventTarget, y: number, active: number, cancelable = true) {
    const ev = new Event(type, { bubbles: true, cancelable });
    const t = { identifier: 1, clientX: 50, clientY: y, target };
    Object.defineProperty(ev, 'touches', { value: Array.from({ length: active }, () => t) });
    Object.defineProperty(ev, 'changedTouches', { value: [t] });
    Object.defineProperty(ev, 'timeStamp', { value: clock });
    target.dispatchEvent(ev);
    return ev;
}

function tap(target: EventTarget, y: number, cancelableEnd = true) {
    touch('touchstart', target, y, 1);
    clock += 90;
    return touch('touchend', target, y, 0, cancelableEnd);
}

function syntheticClick(target: HTMLElement, button = 0) {
    clock += 40;
    const down = new MouseEvent('mousedown', { bubbles: true, cancelable: true, button });
    const focusOnDown = target.dispatchEvent(down);
    const control = target.closest('input, textarea, select') as HTMLElement | null;
    if (focusOnDown && control) control.focus();
    target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, button }));
    const click = new MouseEvent('click', { bubbles: true, cancelable: true, button });
    const activate = target.dispatchEvent(click);
    const forLabel = target.closest('label') as HTMLLabelElement | null;
    const labelled = forLabel && forLabel.htmlFor ? document.getElementById(forLabel.htmlFor) : null;
    if (activate && labelled) labelled.focus();
    return { downPrevented: down.defaultPrevented, clickPrevented: click.defaultPrevented };
}

function adjustedTap(touched: HTMLElement, clicked: HTMLElement, y: number) {
    const end = tap(touched, y);
    return { endPrevented: end.defaultPrevented, ...syntheticClick(clicked) };
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
    uiState.dataPanelSearchFocus = false;
    uiState.currentAppPage = 'entry';
    uiState.entryPanelCollapsed = false;
    wk.keyboardShown = false;
    wk.pending = null;
    wk.pulledUp = null;
    wk.calls = [];
    securityState.appIsLocked = false;
    box = document.createElement('div');
    box.innerHTML = '<div id="appPages">' +
        '<div class="hardware-scanner-box" id="hardwareScannerBox"><label for="hwScannerInput" id="hardwareScannerLabel">ស្កេន Barcode</label>' +
        '<div class="scanner-input-wrapper"><span class="icon">⚡</span><input type="text" id="hwScannerInput">' +
        '<button type="button" id="submitBarcodeBtn">បញ្ជូន</button></div></div>' +
        '<div class="page-side" id="dataSideSection"><div class="search-box" id="phoneSearchBox"><input type="tel" id="searchPhoneInput"></div></div>' +
        '<div class="filter-bar" id="lockerFilterBar"><input type="text" id="lockerListSearchInput"></div></div>' +
        '<div class="app-lock is-open" id="appLockScreen"><form><input type="password" inputmode="numeric" id="appLockPinInput"></form></div>' +
        '<div class="modal" id="ztoPalmSignModal"><div class="modal-content palm-sign-content">' +
        '<div class="palm-sign-name"><label for="palmSignName">👤 ឈ្មោះអ្នកទទួល</label><input id="palmSignName"></div>' +
        '<form class="palm-sign-manual"><label for="palmSignBarcode">⌨️ ម៉ាស៊ីនស្កេន ឬវាយ Barcode</label>' +
        '<div class="palm-sign-scan"><input id="palmSignBarcode"><button type="submit" id="palmSignAdd">＋ បន្ថែម</button></div></form>' +
        '<label for="palmSignAgree" id="palmSignAgreeLabel">យល់ព្រម</label><input type="checkbox" id="palmSignAgree"></div></div>';
    document.body.append(box);
    scannerBox = box.querySelector('#hardwareScannerBox') as HTMLElement;
    wrapper = box.querySelector('.scanner-input-wrapper') as HTMLElement;
    scanner = box.querySelector('#hwScannerInput') as HTMLInputElement;
    label = box.querySelector('#hardwareScannerLabel') as HTMLElement;
    submit = box.querySelector('#submitBarcodeBtn') as HTMLButtonElement;
    phoneSearch = box.querySelector('#searchPhoneInput') as HTMLInputElement;
    phoneSearchBox = box.querySelector('#phoneSearchBox') as HTMLElement;
    lockerSearch = box.querySelector('#lockerListSearchInput') as HTMLInputElement;
    lockerFilterBar = box.querySelector('#lockerFilterBar') as HTMLElement;
    pin = box.querySelector('#appLockPinInput') as HTMLInputElement;
    scanner.getBoundingClientRect = () => rect(338, 30);
    pin.getBoundingClientRect = () => rect(420, 46);
    refTo('hwScannerInput')(scanner);
    refTo('appPages')(box.querySelector('#appPages') as HTMLElement);
    refTo('searchPhoneInput')(phoneSearch);
    refTo('dataSideSection')(box.querySelector('#dataSideSection') as HTMLElement);
    refTo('lockerListSearchInput')(lockerSearch);
    refTo('appLockPinInput')(pin);
    installWebKitFocusModel();
    modalKeyboard.listenModalKeyboard(scope());
    iosViewport.listenIOSSearchFocus(scope());
});

afterEach(() => {
    disposers.splice(0).forEach((fn) => fn());
    listeners.splice(0).forEach(([t, type, h, o]) => t.removeEventListener(type, h, o));
    for (const proto of focusProtos) proto.focus = realFocus.get(proto)!;
    (document.activeElement as HTMLElement | null)?.blur?.();
    refTo('hwScannerInput')(null);
    refTo('appPages')(null);
    refTo('searchPhoneInput')(null);
    refTo('dataSideSection')(null);
    refTo('lockerListSearchInput')(null);
    refTo('appLockPinInput')(null);
    box.remove();
    setIOSStandalone(false);
    Object.defineProperty(window.navigator, 'userAgentData', { configurable: true, value: undefined });
    uiState.isModalOpen = false;
    uiState.modalDisplay = {};
    uiState.dataPanelSearchFocus = false;
    uiState.entryPanelCollapsed = false;
    securityState.appIsLocked = false;
    vi.restoreAllMocks();
});

describe('⛔ iPhone ៖ ម្រាមដៃប៉ះ div ក្បែរប្រអប់ ➜ WebKit ផ្ញើចុចសំយោគទៅប្រអប់/ស្លាក ➜ App focus preventScroll ពេល mousedown ➜ ទំព័រមិនរុញ (A285)', () => {
    it('⛔ `ts:div#hardwareScannerBox` ➜ `md:bc~` ស្លាក «ស្កេន Barcode» ➜ mousedown · click ត្រូវលេប ➜ ប្រអប់ focus · preventScroll', () => {
        const r = adjustedTap(scannerBox, label, 330);
        expect(r.endPrevented).toBe(false);
        expect(r.downPrevented).toBe(true);
        expect(r.clickPrevented).toBe(true);
        expect(document.activeElement).toBe(scanner);
        expect(wk.pending).toEqual({ id: 'hwScannerInput', preventScroll: true });
    });

    it('⛔ `ts:div` wrapper ⚡ ➜ mousedown ផ្ទាល់លើប្រអប់ ➜ preventScroll', () => {
        const r = adjustedTap(wrapper, scanner, 350);
        expect(r.endPrevented).toBe(false);
        expect(r.downPrevented).toBe(true);
        expect(document.activeElement).toBe(scanner);
        expect(wk.pending).toEqual({ id: 'hwScannerInput', preventScroll: true });
    });

    it('⛔ touchend មិន cancelable លើប្រអប់ផ្ទាល់ (`te … c0`) ➜ ចាប់ពេល mousedown', () => {
        expect(tap(scanner, 350, false).defaultPrevented).toBe(false);
        expect(syntheticClick(scanner).downPrevented).toBe(true);
        expect(wk.pending).toEqual({ id: 'hwScannerInput', preventScroll: true });
    });

    it('⛔ ទំព័រទិន្នន័យ ៖ `ts:div` ➜ `md:ph` ➜ ទាញប្រអប់ស្វែងរកឡើងមុន focus ➜ preventScroll', () => {
        const r = adjustedTap(phoneSearchBox, phoneSearch, 240);
        expect(r.endPrevented).toBe(false);
        expect(r.downPrevented).toBe(true);
        expect(document.activeElement).toBe(phoneSearch);
        expect(uiState.dataPanelSearchFocus).toBe(true);
        expect(wk.pulledUp).toBe(true);
        expect(wk.pending).toEqual({ id: 'searchPhoneInput', preventScroll: true });
    });

    it('⛔ ទំព័រស្កេន Locker ៖ `ts:div` ➜ `md:sr` ➜ preventScroll', () => {
        const r = adjustedTap(lockerFilterBar, lockerSearch, 860);
        expect(r.endPrevented).toBe(false);
        expect(r.downPrevented).toBe(true);
        expect(document.activeElement).toBe(lockerSearch);
        expect(wk.pending).toEqual({ id: 'lockerListSearchInput', preventScroll: true });
    });

    it('⛔ ប្រអប់ focus ដោយកូដ (គ្មាន keyboard · មិនទាន់ចុច) ➜ ចុចក្បែរ ➜ blur + focus preventScroll ដូចការចាប់ touchend', () => {
        scanner.focus();
        expect(wk.pending).toEqual({ id: 'hwScannerInput', preventScroll: false });
        const r = adjustedTap(scannerBox, label, 330);
        expect(r.downPrevented).toBe(true);
        expect(r.clickPrevented).toBe(true);
        expect(document.activeElement).toBe(scanner);
        expect(wk.pending).toEqual({ id: 'hwScannerInput', preventScroll: true });
    });

    it('ចុចត្រង់ប្រអប់ (App ចាប់ពេល touchend) នៅដដែល ៖ mousedown លេប · preventScroll', () => {
        expect(tap(scanner, 350).defaultPrevented).toBe(true);
        expect(syntheticClick(scanner).downPrevented).toBe(true);
        expect(wk.pending).toEqual({ id: 'hwScannerInput', preventScroll: true });
    });

    it('⛔ ខ្សែភ្ជាប់ ៖ mousedown · click capture លើ document · មិន passive', () => {
        const downs = listeners.filter(([t, type]) => t === document && type === 'mousedown');
        expect(downs.length).toBeGreaterThanOrEqual(2);
        downs.forEach(([, , , o]) => expect(o).toMatchObject({ capture: true }));
        downs.forEach(([, , , o]) => expect(o && o.passive).not.toBe(true));
    });
});

describe('ទិសផ្ទុយ ៖ ចុចសំយោគដែល iOS ត្រូវធ្វើខ្លួនឯង ➜ មិនប៉ះ', () => {
    it('iPad + mouse (គ្មាន touch ថ្មីៗ) ➜ mousedown មិន preventDefault', () => {
        clock += 5000;
        const r = syntheticClick(label);
        expect(r.downPrevented).toBe(false);
        expect(r.clickPrevented).toBe(false);
        expect(wk.pending).toEqual({ id: 'hwScannerInput', preventScroll: false });
    });

    it('touch ចាស់ជាង CAUGHT_CLICK_MS ➜ មិនចាប់', () => {
        tap(scannerBox, 330);
        clock += modalKeyboard.CAUGHT_CLICK_MS + 10;
        expect(syntheticClick(label).downPrevented).toBe(false);
    });

    it('ម្រាមដៃនៅលើអេក្រង់ (touch ថ្មីចាប់ផ្តើម) ➜ មិនចាប់', () => {
        tap(scannerBox, 330);
        touch('touchstart', scannerBox, 330, 1);
        expect(syntheticClick(label).downPrevented).toBe(false);
    });

    it('ប៊ូតុងកណ្តាល/ស្តាំ ➜ មិនចាប់', () => {
        tap(scannerBox, 330);
        expect(syntheticClick(label, 1).downPrevented).toBe(false);
    });

    it('ប្រអប់ដែល keyboard នឹងបាំង (App មិនចាប់) ➜ iOS បង្ហាញប្រអប់ខ្លួនឯង', () => {
        scanner.getBoundingClientRect = () => rect(700, 30);
        const r = adjustedTap(scannerBox, label, 690);
        expect(r.downPrevented).toBe(false);
        expect(r.clickPrevented).toBe(false);
        expect(wk.pending).toEqual({ id: 'hwScannerInput', preventScroll: false });
    });

    it('Android (Chrome · APK) ➜ mousedown · click មិន preventDefault', () => {
        setIOSStandalone(false);
        Object.defineProperty(window.navigator, 'userAgentData', { configurable: true, value: { platform: 'Android', mobile: true } });
        const r = adjustedTap(scannerBox, label, 330);
        expect(r.downPrevented).toBe(false);
        expect(r.clickPrevented).toBe(false);
        const s = adjustedTap(lockerFilterBar, lockerSearch, 860);
        expect(s.downPrevented).toBe(false);
        scanner.blur();
        clock += 2000;
        expect(adjustedTap(wrapper, scanner, 350).downPrevented).toBe(false);
    });

    it('ប៊ូតុង «បញ្ជូន» ក្បែរប្រអប់ ➜ mousedown · click មិន preventDefault', () => {
        const r = adjustedTap(wrapper, submit, 350);
        expect(r.downPrevented).toBe(false);
        expect(r.clickPrevented).toBe(false);
    });

    it('ប្រអប់ focus រួច ហើយ keyboard បង្ហាញ (ប្តូរទីតាំង caret) ➜ មិនចាប់', () => {
        tap(scanner, 350);
        syntheticClick(scanner);
        clock += 2000;
        wk.keyboardShown = true;
        vv.height = 844 - 336;
        vv.dispatchEvent(new Event('resize'));
        const r = adjustedTap(scannerBox, label, 330);
        expect(r.downPrevented).toBe(false);
        expect(r.clickPrevented).toBe(false);
    });

    it('អេក្រង់ធំ (≥ 992px) ៖ ប្រអប់ស្វែងរក ➜ មិនចាប់', () => {
        Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 1024 });
        expect(adjustedTap(phoneSearchBox, phoneSearch, 240).downPrevented).toBe(false);
        expect(uiState.dataPanelSearchFocus).toBe(false);
    });

    it('fail-open ៖ focus មិនជាប់ ➜ ការចុចបន្ទាប់ទុកឲ្យ iOS', () => {
        const proto = focusProtos.find((p) => Object.prototype.isPrototypeOf.call(p, scanner))!;
        const model = proto.focus;
        proto.focus = function () {} as any;
        expect(adjustedTap(scannerBox, label, 330).downPrevented).toBe(true);
        proto.focus = model;
        clock += 2000;
        expect(adjustedTap(scannerBox, label, 330).downPrevented).toBe(false);
    });

    it('fail-open ៖ ប្រអប់ស្វែងរក focus មិនជាប់ ➜ ទាញចុះវិញ · ការចុចបន្ទាប់ទុកឲ្យ iOS', () => {
        const proto = focusProtos.find((p) => Object.prototype.isPrototypeOf.call(p, phoneSearch))!;
        const model = proto.focus;
        proto.focus = function () {} as any;
        expect(adjustedTap(phoneSearchBox, phoneSearch, 240).downPrevented).toBe(true);
        expect(uiState.dataPanelSearchFocus).toBe(false);
        proto.focus = model;
        clock += 2000;
        expect(adjustedTap(phoneSearchBox, phoneSearch, 240).downPrevented).toBe(false);
    });

    it('event ចម្លែក (target null · document · គ្មាន closest) ➜ មិនបោះ error', () => {
        tap(scannerBox, 330);
        expect(() => {
            document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
            window.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
            const text = document.createTextNode('x');
            scannerBox.append(text);
            text.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
        }).not.toThrow();
    });
});

describe('⛔ App Lock ៖ PIN focus ពេលត្រឡប់ចូល App ➜ preventScroll លើ iOS standalone ពេលប្រអប់នៅពីលើ keyboard (toast 🔬 ១៩៧pt)', () => {
    function lastPinFocus(): FocusOptions | undefined | null {
        const calls: Array<FocusOptions | undefined> = [];
        const watch = pin.focus;
        pin.focus = function (this: HTMLInputElement, options?: FocusOptions) { calls.push(options); watch.call(this, options); } as any;
        appLock.setAppLockPinFocusOptions(modalKeyboard.appLockPinFocusOptions);
        appLock.showAppLockScreen(true);
        appLock.hideAppLockScreen();
        pin.focus = watch;
        return calls.length ? calls[calls.length - 1] : null;
    }

    const rememberNumberPad = () => localStorage.setItem('zoew_keyboard_inset_v1', JSON.stringify({ '390x844|numeric': 291 }));

    it('⛔ iPhone ៖ ប្រអប់ PIN នៅពីលើ keyboard លេខដែលចាំ ➜ focus({ preventScroll: true })', () => {
        rememberNumberPad();
        expect(lastPinFocus()).toEqual({ preventScroll: true });
        expect(document.activeElement).toBe(pin);
    });

    it('⛔ iPhone ៖ មិនទាន់ចាំ keyboard ៖ ប្រអប់ PIN ខ្ពស់ជាងសមាមាត្រប៉ាន់ ➜ preventScroll', () => {
        pin.getBoundingClientRect = () => rect(380, 46);
        expect(lastPinFocus()).toEqual({ preventScroll: true });
    });

    it('ទិសផ្ទុយ ៖ keyboard នឹងបាំងប្រអប់ PIN (iPad ផ្តេក · ការប៉ាន់គ្មានការចាំ) ➜ focus ធម្មតា (iOS បង្ហាញប្រអប់)', () => {
        rememberNumberPad();
        pin.getBoundingClientRect = () => rect(560, 46);
        expect(lastPinFocus()).toBeUndefined();
        localStorage.removeItem('zoew_keyboard_inset_v1');
        modalKeyboard.listenModalKeyboard(scope());
        pin.getBoundingClientRect = () => rect(420, 46);
        expect(lastPinFocus()).toBeUndefined();
    });

    it('⛔ វាស់ទីតាំងប្រអប់ PIN ក្រោយ commit (App Lock ទើបបើក ៖ មុន commit ប្រអប់ display none)', () => {
        rememberNumberPad();
        let committed = false;
        vi.spyOn(flush, 'commitNow').mockImplementation(() => { committed = true; });
        pin.getBoundingClientRect = () => (committed ? rect(420, 46) : rect(0, 0));
        expect(lastPinFocus()).toEqual({ preventScroll: true });
    });

    it('ទិសផ្ទុយ ៖ Android · កុំព្យូទ័រ ➜ focus ធម្មតា', () => {
        rememberNumberPad();
        setIOSStandalone(false);
        expect(lastPinFocus()).toBeUndefined();
    });

    it('⛔ ខ្សែភ្ជាប់ ៖ boot ចង appLockPinFocusOptions ទៅ App Lock · ⛔ app-lock.ts មិន import modal-keyboard (រង្វង់ import ៖ panel-motion ➜ … ➜ app-lock)', () => {
        const boot = readFileSync(path.join(__dirname, '..', 'src', 'app', 'lifecycle', 'boot.ts'), 'utf8');
        expect(boot).toMatch(/setAppLockPinFocusOptions\(appLockPinFocusOptions\)/);
        const src = readFileSync(path.join(__dirname, '..', 'src', 'features', 'app-lock.ts'), 'utf8');
        expect(src).not.toMatch(/modal-keyboard/);
        const body = src.slice(src.indexOf('export function showAppLockScreen'), src.indexOf('export function hideAppLockScreen'));
        expect(body).toMatch(/focusField\('appLockPinInput', appLockPinFocus\(\)\)/);
    });
});

describe('⛔ App Lock ៖ ចុចប្រអប់ PIN ដែល focus ដោយកូដ (keyboard មិនទាន់បង្ហាញ) ➜ App ចាប់ ➜ preventScroll (toast 🔬 5:25 ៖ `ts:input#appLockPinInput` · `p0` ➜ ១៩៧pt)', () => {
    const rememberNumberPad = () => localStorage.setItem('zoew_keyboard_inset_v1', JSON.stringify({ '390x844|numeric': 291 }));

    it('⛔ ចាក់សោ · PIN នៅពីលើ keyboard លេខដែលចាំ ➜ touchend preventDefault · focus preventScroll · mousedown លេប', () => {
        rememberNumberPad();
        securityState.appIsLocked = true;
        pin.focus();
        expect(wk.pending).toEqual({ id: 'appLockPinInput', preventScroll: false });
        expect(tap(pin, 440).defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(pin);
        expect(wk.pending).toEqual({ id: 'appLockPinInput', preventScroll: true });
        const click = syntheticClick(pin);
        expect(click.downPrevented).toBe(true);
        expect(wk.pending).toEqual({ id: 'appLockPinInput', preventScroll: true });
    });

    it('ទិសផ្ទុយ ៖ មិនចាក់សោ · keyboard នឹងបាំង PIN · Android ➜ មិនចាប់', () => {
        rememberNumberPad();
        expect(tap(pin, 440).defaultPrevented).toBe(false);
        securityState.appIsLocked = true;
        pin.getBoundingClientRect = () => rect(560, 46);
        clock += 2000;
        expect(tap(pin, 580).defaultPrevented).toBe(false);
        pin.getBoundingClientRect = () => rect(420, 46);
        setIOSStandalone(false);
        Object.defineProperty(window.navigator, 'userAgentData', { configurable: true, value: { platform: 'Android', mobile: true } });
        clock += 2000;
        expect(tap(pin, 440).defaultPrevented).toBe(false);
    });
});

describe('⛔ keyboard ∨ ក្រោយចុចដែល App ចាប់ (ក្នុង NATIVE_TAP_FOCUS_MS) ➜ focus ថ្មីត្រូវ refocus preventScroll (toast 🔬 5:27 ៖ `te p1` · `fo:bc` · `bl:bc` · `fo:sr` ➜ ២៧៧pt)', () => {
    function keyboard(px: number) {
        vv.height = 844 - px;
        vv.dispatchEvent(new Event('resize'));
    }

    it('⛔ ចុច Barcode (ចាប់) ➜ keyboard ➜ ∨ ក្រោយ ៩០០ms ➜ ប្រអប់ស្វែងរក focus ➜ refocus preventScroll ក្នុង focus event', () => {
        expect(tap(scanner, 350).defaultPrevented).toBe(true);
        wk.keyboardShown = true;
        keyboard(403);
        clock += 900;
        wk.calls = [];
        lockerSearch.focus();
        expect(document.activeElement).toBe(lockerSearch);
        expect(wk.calls).toContainEqual({ id: 'lockerListSearchInput', preventScroll: true });
    });

    it('ទិសផ្ទុយ ៖ focus របស់ការចុចខ្លួនឯង (ចុចប្រអប់ផ្សេងពេល keyboard បើក ៖ iOS focus) ➜ មិន refocus', () => {
        const other = document.createElement('input');
        other.id = 'otherField';
        other.getBoundingClientRect = () => rect(120, 30);
        box.append(other);
        tap(scanner, 350);
        wk.keyboardShown = true;
        keyboard(403);
        clock += 2000;
        expect(tap(other, 135).defaultPrevented).toBe(false);
        clock += 40;
        wk.calls = [];
        other.focus();
        expect(document.activeElement).toBe(other);
        expect(wk.calls).toEqual([{ id: 'otherField', preventScroll: false }]);
        clock += 300;
        wk.calls = [];
        lockerSearch.focus();
        expect(wk.calls).toContainEqual({ id: 'lockerListSearchInput', preventScroll: true });
    });

    it('ទិសផ្ទុយ ៖ ម្រាមដៃនៅលើអេក្រង់ ➜ មិន refocus', () => {
        tap(scanner, 350);
        wk.keyboardShown = true;
        keyboard(403);
        clock += 2000;
        touch('touchstart', scannerBox, 330, 1);
        lockerSearch.focus();
        wk.calls = [];
        phoneSearch.focus();
        expect(wk.calls).toEqual([{ id: 'searchPhoneInput', preventScroll: false }]);
    });
});

describe('⛔ ត្រឡប់ចូល App (window blur) ខណៈប្រអប់ Barcode នៅ focus ➜ keyboard បិទ ➜ ការចុចបន្ទាប់ត្រូវចាប់ (toast 🔬 5:28 ៖ `bl:win` · `fo:bc` · `f1 k0 t1` · `te p0` ➜ ១៩៦pt)', () => {
    function keyboard(px: number) {
        vv.height = 844 - px;
        vv.dispatchEvent(new Event('resize'));
    }

    it('⛔ ចុចចាប់ ➜ keyboard ➜ window blur/focus ➜ keyboard បិទ (ប្រអប់នៅ focus) ➜ ចុចប្រអប់ ➜ ចាប់ · preventScroll', () => {
        expect(tap(scanner, 350).defaultPrevented).toBe(true);
        keyboard(403);
        window.dispatchEvent(new FocusEvent('blur'));
        window.dispatchEvent(new FocusEvent('focus'));
        keyboard(0);
        expect(document.activeElement).toBe(scanner);
        clock += 2000;
        expect(tap(scanner, 350).defaultPrevented).toBe(true);
        expect(wk.pending).toEqual({ id: 'hwScannerInput', preventScroll: true });
        expect(syntheticClick(scanner).downPrevented).toBe(true);
    });

    it('ទិសផ្ទុយ ៖ iPad keyboard អណ្តែត (មិនដែលវាស់ឃើញ · គ្មាន window blur) ➜ ចុចប្រអប់ដែលចុចរួច ➜ native (caret)', () => {
        expect(tap(scanner, 350).defaultPrevented).toBe(true);
        clock += 2000;
        expect(tap(scanner, 350).defaultPrevented).toBe(false);
    });

    it('ទិសផ្ទុយ ៖ blur របស់ធាតុ (មិនមែន window) · Android ➜ មិនលុបការចាំ', () => {
        expect(tap(scanner, 350).defaultPrevented).toBe(true);
        const other = document.createElement('input');
        box.append(other);
        other.dispatchEvent(new FocusEvent('blur'));
        clock += 2000;
        expect(tap(scanner, 350).defaultPrevented).toBe(false);
        scanner.blur();
        setIOSStandalone(false);
        Object.defineProperty(window.navigator, 'userAgentData', { configurable: true, value: { platform: 'Android', mobile: true } });
        clock += 2000;
        expect(tap(scanner, 350).defaultPrevented).toBe(true);
        window.dispatchEvent(new FocusEvent('blur'));
        clock += 2000;
        expect(tap(scanner, 350).defaultPrevented).toBe(false);
    });
});

describe('⛔ ផ្ទាំង Sign · ZTO ៖ ស្លាក `label[for]` របស់ប្រអប់វាយក្នុងផ្ទាំង (ចុចលើស្លាក · ចុចក្បែរ ➜ WebKit ផ្ញើទៅស្លាក) ➜ ចាប់ · preventScroll', () => {
    let signName: HTMLInputElement;
    let signBarcode: HTMLInputElement;
    const openSign = () => {
        uiState.modalDisplay = { ztoPalmSignModal: 'flex' };
        uiState.isModalOpen = true;
    };

    beforeEach(() => {
        signName = box.querySelector('#palmSignName') as HTMLInputElement;
        signBarcode = box.querySelector('#palmSignBarcode') as HTMLInputElement;
        signName.getBoundingClientRect = () => rect(420, 46);
        signBarcode.getBoundingClientRect = () => rect(700, 46);
    });

    it('⛔ ចុចស្លាក «👤 ឈ្មោះអ្នកទទួល» ➜ touchend preventDefault · ប្រអប់ឈ្មោះ focus preventScroll · click របស់ស្លាកលេប', () => {
        openSign();
        const label = box.querySelector('label[for="palmSignName"]') as HTMLElement;
        expect(tap(label, 410).defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(signName);
        expect(wk.pending).toEqual({ id: 'palmSignName', preventScroll: true });
        expect(syntheticClick(label).clickPrevented).toBe(true);
        expect(wk.pending).toEqual({ id: 'palmSignName', preventScroll: true });
    });

    it('⛔ ចុចក្បែរប្រអប់ Barcode (div `.palm-sign-scan`) ➜ mousedown លើស្លាក «⌨️» ➜ preventDefault · click លេប · preventScroll', () => {
        openSign();
        const label = box.querySelector('label[for="palmSignBarcode"]') as HTMLElement;
        const r = adjustedTap(box.querySelector('.palm-sign-scan') as HTMLElement, label, 690);
        expect(r.endPrevented).toBe(false);
        expect(r.downPrevented).toBe(true);
        expect(r.clickPrevented).toBe(true);
        expect(document.activeElement).toBe(signBarcode);
        expect(wk.pending).toEqual({ id: 'palmSignBarcode', preventScroll: true });
    });

    it('ទិសផ្ទុយ ៖ ស្លាករបស់ checkbox · ប៊ូតុង «＋ បន្ថែម» · ផ្ទាំងមិនបើក · Android ➜ មិនចាប់', () => {
        openSign();
        expect(adjustedTap(box.querySelector('.palm-sign-content') as HTMLElement, box.querySelector('#palmSignAgreeLabel') as HTMLElement, 800).downPrevented).toBe(false);
        clock += 2000;
        expect(adjustedTap(box.querySelector('.palm-sign-scan') as HTMLElement, box.querySelector('#palmSignAdd') as HTMLElement, 700).downPrevented).toBe(false);
        uiState.modalDisplay = {};
        uiState.isModalOpen = false;
        clock += 2000;
        const label = box.querySelector('label[for="palmSignName"]') as HTMLElement;
        expect(tap(label, 410).defaultPrevented).toBe(false);
        openSign();
        setIOSStandalone(false);
        Object.defineProperty(window.navigator, 'userAgentData', { configurable: true, value: { platform: 'Android', mobile: true } });
        clock += 2000;
        expect(tap(label, 410).defaultPrevented).toBe(false);
    });
});

describe('⛔ ផ្ទាំង Sign ៖ អូសរំកិលផ្ទាំង (មិនមែនចុច) ➜ ∨/∧ ក្នុង NATIVE_TAP_FOCUS_MS ➜ refocus preventScroll (toast 🔬 6:35 ៖ `te … Δ-57,-149 c0` ➜ `bl:sn · fo:sb` ➜ ៦០ · ១១៨pt)', () => {
    let signName: HTMLInputElement;
    let signBarcode: HTMLInputElement;
    let video: HTMLElement;
    function keyboard(px: number) {
        vv.height = 844 - px;
        vv.dispatchEvent(new Event('resize'));
    }
    function drag(target: EventTarget, from: number, dx: number, dy: number, cancelable = false) {
        const start = new Event('touchstart', { bubbles: true, cancelable: true });
        const t0 = { identifier: 3, clientX: 200, clientY: from, target };
        Object.defineProperty(start, 'touches', { value: [t0] });
        Object.defineProperty(start, 'changedTouches', { value: [t0] });
        Object.defineProperty(start, 'timeStamp', { value: clock });
        target.dispatchEvent(start);
        clock += 270;
        const end = new Event('touchend', { bubbles: true, cancelable });
        const t1 = { identifier: 3, clientX: 200 + dx, clientY: from + dy, target };
        Object.defineProperty(end, 'touches', { value: [] });
        Object.defineProperty(end, 'changedTouches', { value: [t1] });
        Object.defineProperty(end, 'timeStamp', { value: clock });
        target.dispatchEvent(end);
    }

    beforeEach(() => {
        signName = box.querySelector('#palmSignName') as HTMLInputElement;
        signBarcode = box.querySelector('#palmSignBarcode') as HTMLInputElement;
        signName.getBoundingClientRect = () => rect(300, 46);
        signBarcode.getBoundingClientRect = () => rect(380, 46);
        video = document.createElement('video');
        video.id = 'palmSignVideo';
        box.querySelector('.palm-sign-content')!.prepend(video);
        uiState.modalDisplay = { ztoPalmSignModal: 'flex' };
        uiState.isModalOpen = true;
    });

    it('⛔ ចុចប្រអប់ឈ្មោះ (ចាប់) ➜ keyboard ➜ អូសលើវីដេអូ ➜ ៩៥០ms ➜ ∨ ➜ ប្រអប់ Barcode focus ➜ refocus preventScroll', () => {
        expect(tap(signName, 320).defaultPrevented).toBe(true);
        wk.keyboardShown = true;
        keyboard(403);
        clock += 1500;
        drag(video, 200, -57, -149);
        clock += 950;
        wk.calls = [];
        signBarcode.focus();
        expect(document.activeElement).toBe(signBarcode);
        expect(wk.calls).toContainEqual({ id: 'palmSignBarcode', preventScroll: true });
    });

    it('⛔ អូសលើស្លាក (`ts:sn~` · Δ-56,-107) ➜ ∨ ក្នុង ៦៤០ms ➜ refocus preventScroll', () => {
        expect(tap(signName, 320).defaultPrevented).toBe(true);
        wk.keyboardShown = true;
        keyboard(403);
        clock += 1500;
        drag(box.querySelector('label[for="palmSignName"]') as HTMLElement, 290, -56, -107);
        clock += 640;
        wk.calls = [];
        signBarcode.focus();
        expect(wk.calls).toContainEqual({ id: 'palmSignBarcode', preventScroll: true });
    });

    it('⛔ រំកិលបញ្ឈរសុទ្ធ (Δ0,-149) ➜ ∨ ➜ refocus preventScroll', () => {
        expect(tap(signName, 320).defaultPrevented).toBe(true);
        wk.keyboardShown = true;
        keyboard(403);
        clock += 1500;
        drag(video, 200, 0, -149);
        clock += 500;
        wk.calls = [];
        signBarcode.focus();
        expect(wk.calls).toContainEqual({ id: 'palmSignBarcode', preventScroll: true });
    });

    it('⛔ touchcancel (iOS យកការប៉ះទៅរំកិល) ➜ ∨ ក្នុង NATIVE_TAP_FOCUS_MS ➜ refocus preventScroll', () => {
        expect(tap(signName, 320).defaultPrevented).toBe(true);
        wk.keyboardShown = true;
        keyboard(403);
        clock += 1500;
        touch('touchstart', video, 200, 1);
        clock += 120;
        touch('touchcancel', video, 200, 0);
        clock += 500;
        wk.calls = [];
        signBarcode.focus();
        expect(wk.calls).toContainEqual({ id: 'palmSignBarcode', preventScroll: true });
    });

    it('ទិសផ្ទុយ ៖ ការចុចដែលរំកិលតិច (≤ TAP_FOCUS_MOVE_MAX_PX ៖ iOS នៅរាប់ជាការចុច) ➜ focus របស់ការចុច ➜ មិន refocus', () => {
        const other = document.createElement('input');
        other.id = 'signOther2';
        other.getBoundingClientRect = () => rect(200, 30);
        box.querySelector('.palm-sign-content')!.append(other);
        expect(tap(signName, 320).defaultPrevented).toBe(true);
        wk.keyboardShown = true;
        keyboard(403);
        clock += 1500;
        drag(other, 200, 0, modalKeyboard.TAP_FOCUS_MOVE_MAX_PX, true);
        clock += 40;
        wk.calls = [];
        other.focus();
        expect(wk.calls).toEqual([{ id: 'signOther2', preventScroll: false }]);
    });

    it('ទិសផ្ទុយ ៖ ចុចប្រអប់ក្នុងផ្ទាំងពេល keyboard បើក (focus របស់ការចុច ៖ មិនរំកិល) ➜ មិន refocus', () => {
        const other = document.createElement('input');
        other.id = 'signOther';
        other.getBoundingClientRect = () => rect(200, 30);
        box.querySelector('.palm-sign-content')!.append(other);
        expect(tap(signName, 320).defaultPrevented).toBe(true);
        wk.keyboardShown = true;
        keyboard(403);
        clock += 1500;
        signName.blur();
        touch('touchstart', other, 215, 1);
        clock += 90;
        touch('touchend', other, 215, 0);
        clock += 40;
        wk.calls = [];
        other.focus();
        expect(wk.calls).toEqual([{ id: 'signOther', preventScroll: false }]);
    });
});
