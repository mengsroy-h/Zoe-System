/**
 * ⛔ រាយការណ៍ម្ចាស់គម្រោង ៖ «iphone នៅតែដូចមុន ធ្លាក់ទំព័រពេល ចុច ប្រអប់វាយបញ្ចូល barcode ពេល keyboard លោតមក តែម្តងម្កាលទេ មិនមែនលោតរាល់ពេលចុច»។
 *    Chromium មិនមាន WebKit ➜ ផ្លូវដែលទំព័រធ្លាក់មិនអាចវាស់នៅទីនេះ ➜ វាស់លើ iPhone ពិត ៖ ចុចកន្លែងវាយ Barcode (ស្លាក · ⚡) លើ iOS standalone ➜ កត់ផ្លូវ
 *    (`caught` · `moved` · `slow` · `focused-tapped` · `focused-keyboard` · `covered` · `refused` · `multi` · …) + លេខ (dx · dy · ms · ទីតាំងប្រអប់ · keyboard ដែលចាំ) ➜
 *    ក្នុង PAGE_TAP_PROBE_MS ក្រោយលែងដៃ ដោយគ្មានម្រាមដៃលើអេក្រង់ ៖ document · visual viewport · #appPages រំកិល ➜ Sentry ម្តង / ផ្លូវ / ទំព័រ (`zone: 'ui'` · លេខតែប៉ុណ្ណោះ)។
 *    ទិសផ្ទុយ ៖ ម្រាមដៃនៅលើអេក្រង់ (អ្នកប្រើរំកិល) · ក្រោយពិដាន · មិនរំកិល · Android · ប្រអប់បើក · ធាតុផ្សេង ➜ មិនផ្ញើ · ZoeErrors គ្មាន ➜ មិនបោះ។
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { uiState } from '../src/core/state';
import * as modalKeyboard from '../src/app/behaviors/modal-keyboard';
import { refTo } from '../src/app/refs';

const listeners: Array<[EventTarget, string, any, any]> = [];
const disposers: Array<() => void> = [];
let vv: EventTarget & { height: number; offsetTop: number };
let capture: ReturnType<typeof vi.fn>;
let box: HTMLElement;
let scanner: HTMLInputElement;
let label: HTMLElement;
let pages: HTMLElement;
let other: HTMLElement;

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

type Pt = { x: number; y: number; t: number };

function touch(type: string, target: EventTarget, p: Pt, active: number) {
    const ev = new Event(type, { bubbles: true, cancelable: true });
    const t = { identifier: 1, clientX: p.x, clientY: p.y, target };
    Object.defineProperty(ev, 'touches', { value: Array.from({ length: active }, () => t) });
    Object.defineProperty(ev, 'changedTouches', { value: [t] });
    Object.defineProperty(ev, 'timeStamp', { value: p.t });
    target.dispatchEvent(ev);
    return ev;
}

function tap(target: EventTarget, from: Pt, to: Pt) {
    touch('touchstart', target, from, 1);
    return touch('touchend', target, to, 0);
}

function scrollDocument(y: number) {
    Object.defineProperty(window, 'scrollY', { configurable: true, value: y });
    document.dispatchEvent(new Event('scroll'));
}

function panViewport(top: number) {
    vv.offsetTop = top;
    vv.dispatchEvent(new Event('scroll'));
}

function scrollPages(top: number) {
    pages.scrollTop = top;
    pages.dispatchEvent(new Event('scroll'));
}

function contexts() {
    return capture.mock.calls.map((c) => c[1].context);
}

beforeEach(() => {
    try { localStorage.removeItem('zoew_keyboard_inset_v1'); } catch {}
    Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: 844 });
    vv = Object.assign(new EventTarget(), { height: 844, offsetTop: 0 });
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: vv });
    setIOSStandalone(true);
    uiState.isModalOpen = false;
    capture = vi.fn();
    (window as any).ZoeErrors = { capture };
    box = document.createElement('div');
    box.innerHTML = '<div id="appPages"><label for="hwScannerInput" id="hardwareScannerLabel">ស្កេន Barcode</label>' +
        '<div class="scanner-input-wrapper"><span class="icon">⚡</span><input type="text" id="hwScannerInput"><button type="button">បញ្ជូន</button></div>' +
        '<button id="probeOther" type="button">ផ្សេង</button></div>';
    document.body.append(box);
    scanner = box.querySelector('#hwScannerInput') as HTMLInputElement;
    label = box.querySelector('#hardwareScannerLabel') as HTMLElement;
    pages = box.querySelector('#appPages') as HTMLElement;
    other = box.querySelector('#probeOther') as HTMLElement;
    scanner.getBoundingClientRect = () => rect(290, 30);
    refTo('hwScannerInput')(scanner);
    refTo('appPages')(pages);
    modalKeyboard.listenModalKeyboard(scope());
});

afterEach(() => {
    disposers.splice(0).forEach((fn) => fn());
    listeners.splice(0).forEach(([t, type, h, o]) => t.removeEventListener(type, h, o));
    refTo('hwScannerInput')(null);
    refTo('appPages')(null);
    box.remove();
    setIOSStandalone(false);
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
    Object.defineProperty(window.navigator, 'userAgentData', { configurable: true, value: undefined });
    delete (window as any).ZoeErrors;
    uiState.isModalOpen = false;
    vi.restoreAllMocks();
});

describe('iPhone ៖ ចុចកន្លែងវាយ Barcode ➜ ទំព័ររំកិល ➜ Sentry (ផ្លូវ + លេខ) ដើម្បីរកផ្លូវដែលទំព័រធ្លាក់ម្តងម្កាល', () => {
    it('⛔ ចាប់ (caught) ហើយ document រំកិល ➜ ផ្ញើម្តង ៖ zone ui · context «iosPageTap caught document» · លេខ (dx · dy · ms · ទីតាំងប្រអប់ · scrollY) · គ្មានអត្ថបទអ្នកប្រើ', () => {
        scanner.value = '0123456789';
        expect(tap(scanner, { x: 50, y: 305, t: 0 }, { x: 52, y: 306, t: 90 }).defaultPrevented).toBe(true);
        scrollDocument(48);
        scrollDocument(60);
        expect(capture).toHaveBeenCalledTimes(1);
        const [err, extra] = capture.mock.calls[0];
        expect(String(err.message)).toBe('iOS page moved after a barcode field tap');
        expect(extra).toMatchObject({ zone: 'ui', context: 'iosPageTap caught document', dx: 2, dy: 1, ms: 90, fieldTop: 290, fieldBottom: 320, innerHeight: 844, scrollY: 48, viewportTop: 0, focused: 0, tapped: 0, keyboard: 0,
            viewportHeight: 844, stillFocused: 1 });
        expect(extra.afterMs).toBeGreaterThanOrEqual(0);
        expect(extra.afterMs).toBeLessThanOrEqual(modalKeyboard.PAGE_TAP_PROBE_MS);
        expect(typeof extra.docHeight).toBe('number');
        for (const value of Object.values(extra)) expect(['string', 'number']).toContain(typeof value);
        expect(JSON.stringify(extra)).not.toContain('0123456789');
    });

    it('⛔ ផ្លូវដែល iOS ធ្វើខ្លួនឯង ៖ អូស (moved) ➜ visual viewport រំកិល · ចុចយូរ (slow) ➜ #appPages · ចុចម្តងទៀតពេលប្រអប់ focus រួច (focused-tapped) ➜ document ៖ ផ្លូវនីមួយៗផ្ញើម្តង', () => {
        expect(tap(label, { x: 60, y: 280, t: 0 }, { x: 60, y: 300, t: 80 }).defaultPrevented).toBe(false);
        panViewport(64);
        panViewport(0);
        expect(tap(scanner, { x: 50, y: 305, t: 200 }, { x: 50, y: 305, t: 900 }).defaultPrevented).toBe(false);
        scrollPages(120);
        expect(tap(scanner, { x: 50, y: 305, t: 1000 }, { x: 50, y: 305, t: 1080 }).defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(scanner);
        expect(tap(scanner, { x: 50, y: 305, t: 1200 }, { x: 50, y: 305, t: 1260 }).defaultPrevented).toBe(false);
        scrollDocument(30);
        expect(contexts()).toEqual(['iosPageTap moved viewport', 'iosPageTap slow pages', 'iosPageTap focused-tapped document']);
        expect(capture.mock.calls[0][1]).toMatchObject({ dy: 20, viewportTop: 64 });
        expect(capture.mock.calls[1][1]).toMatchObject({ ms: 700, pagesMoved: 120 });
        expect(capture.mock.calls[2][1]).toMatchObject({ focused: 1, tapped: 1 });
        scanner.blur();
        Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
        tap(label, { x: 60, y: 280, t: 1400 }, { x: 60, y: 300, t: 1480 });
        panViewport(64);
        expect(capture).toHaveBeenCalledTimes(3);
    });

    it('ទិសផ្ទុយ ៖ ម្រាមដៃនៅលើអេក្រង់ (អ្នកប្រើរំកិល) · ក្រោយ PAGE_TAP_PROBE_MS · មិនរំកិល · ធាតុផ្សេង ➜ មិនផ្ញើ', () => {
        tap(scanner, { x: 50, y: 305, t: 0 }, { x: 50, y: 305, t: 60 });
        touch('touchstart', other, { x: 100, y: 500, t: 100 }, 1);
        scrollDocument(40);
        touch('touchend', other, { x: 100, y: 400, t: 300 }, 0);
        scrollDocument(0);
        scrollPages(0);
        panViewport(0);
        scanner.blur();
        const now = performance.now();
        const clock = vi.spyOn(performance, 'now').mockReturnValue(now);
        tap(scanner, { x: 50, y: 305, t: 400 }, { x: 50, y: 305, t: 460 });
        clock.mockReturnValue(now + modalKeyboard.PAGE_TAP_PROBE_MS + 1);
        scrollDocument(40);
        clock.mockRestore();
        Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
        tap(other, { x: 100, y: 500, t: 600 }, { x: 100, y: 500, t: 660 });
        scrollDocument(40);
        expect(capture).not.toHaveBeenCalled();
    });

    it('ទិសផ្ទុយ ៖ Android · មិនមែន standalone · ប្រអប់ (modal) បើក ➜ មិនកត់ · ZoeErrors គ្មាន ➜ មិនបោះ', () => {
        setIOSStandalone(false);
        Object.defineProperty(window.navigator, 'userAgentData', { configurable: true, value: { platform: 'Android' } });
        tap(scanner, { x: 50, y: 305, t: 0 }, { x: 50, y: 305, t: 60 });
        scrollDocument(40);
        Object.defineProperty(window.navigator, 'userAgentData', { configurable: true, value: undefined });
        setIOSStandalone(true);
        scanner.blur();
        Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
        uiState.isModalOpen = true;
        tap(scanner, { x: 50, y: 305, t: 200 }, { x: 50, y: 305, t: 260 });
        scrollDocument(40);
        uiState.isModalOpen = false;
        expect(capture).not.toHaveBeenCalled();
        Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
        delete (window as any).ZoeErrors;
        scanner.blur();
        tap(scanner, { x: 50, y: 305, t: 400 }, { x: 50, y: 305, t: 460 });
        expect(() => scrollDocument(40)).not.toThrow();
    });
});

describe('⛔ Sentry iosPageTap «caught document» (scrollY ២៣០ · visual viewport ២៧៧) ៖ ចុចកន្លែងវាយ Barcode ដែលចាប់បាន ➜ document រំកិលដោយ WebKit ពេល keyboard លោត ➜ ត្រឡប់ ០', () => {
    let scrollTo: ReturnType<typeof vi.spyOn>;
    beforeEach(() => {
        scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    });

    it('⛔ ចាប់ (focus preventScroll) ➜ document រំកិល ២៣០ (scroll · visual viewport scroll) ➜ scrollTo(0, 0) · នៅ focus · ០ ➜ មិនហៅម្តងទៀត', () => {
        expect(tap(scanner, { x: 50, y: 305, t: 0 }, { x: 50, y: 305, t: 59 }).defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(scanner);
        scrollDocument(230);
        expect(scrollTo).toHaveBeenCalledWith(0, 0);
        const calls = scrollTo.mock.calls.length;
        vv.offsetTop = 277;
        vv.dispatchEvent(new Event('scroll'));
        expect(scrollTo.mock.calls.length).toBe(calls + 1);
        Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
        document.dispatchEvent(new Event('scroll'));
        expect(scrollTo.mock.calls.length).toBe(calls + 1);
        expect(document.activeElement).toBe(scanner);
    });

    it('ទិសផ្ទុយ ៖ keyboard នឹងបាំងប្រអប់ (iOS ត្រូវបង្ហាញ ៖ មិនចាប់) · ប្រអប់ blur · ប្រអប់ (modal) បើក · Android ➜ មិនប៉ះ document', () => {
        scanner.getBoundingClientRect = () => rect(700, 30);
        expect(tap(scanner, { x: 50, y: 715, t: 0 }, { x: 50, y: 715, t: 60 }).defaultPrevented).toBe(false);
        scanner.focus();
        scrollDocument(230);
        scanner.blur();
        scanner.getBoundingClientRect = () => rect(290, 30);
        Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
        expect(tap(scanner, { x: 50, y: 305, t: 200 }, { x: 50, y: 305, t: 260 }).defaultPrevented).toBe(true);
        scanner.blur();
        scrollDocument(230);
        Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
        expect(tap(scanner, { x: 50, y: 305, t: 400 }, { x: 50, y: 305, t: 460 }).defaultPrevented).toBe(true);
        uiState.isModalOpen = true;
        scrollDocument(230);
        uiState.isModalOpen = false;
        scanner.blur();
        Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
        setIOSStandalone(false);
        Object.defineProperty(window.navigator, 'userAgentData', { configurable: true, value: { platform: 'Android' } });
        expect(tap(scanner, { x: 50, y: 305, t: 600 }, { x: 50, y: 305, t: 660 }).defaultPrevented).toBe(true);
        scrollDocument(230);
        expect(scrollTo).not.toHaveBeenCalled();
    });
});
