/**
 * ⛔ សំណើម្ចាស់គម្រោង ៖ «ពិនិត្យកន្លែងស្វែងរកក្នុង tab ស្កេនផង» (បន្ទាប់ពីរបាយការណ៍ ៖ ចុចស្វែងរកលេខ ➜ ការហូតឡើង និង keyboard មិនរលូន)។
 *    វាស់ក្នុង Chromium (414×896 · `history-window-check`) ៖ ប្រអប់ស្វែងរកក្នុង tab ស្កេន (បញ្ជីកញ្ចប់ · បញ្ជី Locker) នៅ y ៤៣៦ · ៥០៣ ➜
 *    keyboard ~៣៣០px គ្របលទ្ធផលស្ទើរទាំងអស់ ហើយ iOS រំកិល document ដើម្បីបង្ហាញប្រអប់ (ដូចបញ្ហា 2.50.42 · 2.50.45 លើប្រអប់ស្វែងរកលេខ)។
 * ⛔ ច្បាប់ ៖ ទូរស័ព្ទ (< 992px) · focus ប្រអប់ស្វែងរកក្នុង tab ស្កេន ➜ ផ្ទាំងស្កេនបង្រួមដោយរអិល (ដូចអូសឡើង) · ចាកចេញពីប្រអប់ទទេ ➜ បើកវិញ
 *    (តែពេលការ focus ជាអ្នកបង្រួម) · iOS standalone ៖ ការចុច ➜ touchend preventDefault ➜ បង្រួមមុន ➜ `focus({ preventScroll: true })` ·
 *    document រំកិលខណៈប្រអប់ទាំងនេះ focus ➜ ត្រឡប់ ០។ ទិសផ្ទុយ ៖ អេក្រង់ធំ · tab ផ្សេង · ផ្ទាំងបង្រួមដោយដៃមុន ➜ មិនបើកវិញដោយខ្លួនឯង។
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { uiState } from '../src/core/state';
import { refTo } from '../src/app/refs';
import * as iosViewport from '../src/app/behaviors/ios-viewport';
import { entrySearchBlurred, entrySearchFocused } from '../src/app/behaviors/entry-search';

const listeners: Array<[EventTarget, string, any, any]> = [];
let side: HTMLElement;
let main: HTMLElement;
let pages: HTMLElement;
let entryInput: HTMLInputElement;
let lockerInput: HTMLInputElement;
let focusCalls: Array<{ field: string; options: any; collapsed: boolean }>;
const realInnerWidth = window.innerWidth;

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

function setIOSStandalone(on: boolean) {
    Object.defineProperty(window.navigator, 'standalone', { configurable: true, value: on ? true : undefined });
    Object.defineProperty(window, 'CSS', { configurable: true, value: { supports: (p: string, v: string) => on && p === '-webkit-touch-callout' && v === 'none' } });
}

function setWidth(w: number) {
    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: w });
}

function touch(type: string, target: EventTarget, x: number, y: number, t: number, active: number) {
    const ev = new Event(type, { bubbles: true, cancelable: true });
    const p = { identifier: 1, clientX: x, clientY: y, target };
    Object.defineProperty(ev, 'touches', { value: active ? [p] : [] });
    Object.defineProperty(ev, 'changedTouches', { value: [p] });
    Object.defineProperty(ev, 'timeStamp', { value: t });
    target.dispatchEvent(ev);
    return ev;
}

const tap = (target: EventTarget, t: number) => { touch('touchstart', target, 100, 450, t, 1); return touch('touchend', target, 101, 451, t + 100, 0); };

function watchFocus(input: HTMLInputElement, field: string) {
    const realFocus = HTMLElement.prototype.focus;
    input.focus = function (this: HTMLInputElement, options?: any) {
        focusCalls.push({ field, options, collapsed: uiState.entryPanelCollapsed });
        realFocus.call(this, options);
    } as any;
}

beforeEach(() => {
    focusCalls = [];
    setIOSStandalone(true);
    setWidth(390);
    uiState.currentAppPage = 'entry';
    uiState.entryPanelCollapsed = false;
    pages = document.createElement('div');
    side = document.createElement('div');
    main = document.createElement('div');
    entryInput = document.createElement('input');
    lockerInput = document.createElement('input');
    main.append(entryInput, lockerInput);
    pages.append(side, main);
    document.body.appendChild(pages);
    watchFocus(entryInput, 'entryListSearchInput');
    watchFocus(lockerInput, 'lockerListSearchInput');
    refTo('appPages')(pages);
    refTo('entrySideSection')(side);
    refTo('entryMainSection')(main);
    refTo('entryListSearchInput')(entryInput);
    refTo('lockerListSearchInput')(lockerInput);
    (iosViewport as any).listenIOSSearchFocus(scope());
});

afterEach(() => {
    listeners.splice(0).forEach(([t, type, h, o]) => t.removeEventListener(type, h, o));
    ['appPages', 'entrySideSection', 'entryMainSection', 'entryListSearchInput', 'lockerListSearchInput'].forEach((n: any) => refTo(n)(null));
    (document.activeElement as HTMLElement | null)?.blur?.();
    pages.remove();
    uiState.entryPanelCollapsed = false;
    uiState.currentAppPage = 'data';
    setWidth(realInnerWidth);
    setIOSStandalone(false);
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe('tab ស្កេន ៖ ស្វែងរកបញ្ជីកញ្ចប់ · Locker ➜ ផ្ទាំងស្កេនបង្រួម · ប្រអប់ឡើងលើ keyboard', () => {
    it('⛔ iPhone PWA ៖ ចុចប្រអប់ស្វែងរកបញ្ជីកញ្ចប់ ➜ preventDefault · បង្រួមមុន focus · focus({ preventScroll: true })', () => {
        const end = tap(entryInput, 1000);
        expect(end.defaultPrevented).toBe(true);
        expect(focusCalls).toEqual([{ field: 'entryListSearchInput', options: { preventScroll: true }, collapsed: true }]);
        expect(document.activeElement).toBe(entryInput);
    });

    it('⛔ iPhone PWA ៖ ប្រអប់ស្វែងរកបញ្ជី Locker ដូចគ្នា', () => {
        expect(tap(lockerInput, 1000).defaultPrevented).toBe(true);
        expect(focusCalls[0]).toMatchObject({ field: 'lockerListSearchInput', options: { preventScroll: true }, collapsed: true });
    });

    it('⛔ ចាកចេញពីប្រអប់ទទេ ➜ ផ្ទាំងស្កេនបើកវិញ · មានអក្សរ ➜ នៅបង្រួម (មើលលទ្ធផល)', () => {
        vi.useFakeTimers();
        entrySearchFocused();
        expect(uiState.entryPanelCollapsed).toBe(true);
        entryInput.value = '0961';
        entrySearchBlurred();
        vi.advanceTimersByTime(200);
        expect(uiState.entryPanelCollapsed).toBe(true);
        entryInput.value = '';
        entrySearchBlurred();
        vi.advanceTimersByTime(200);
        expect(uiState.entryPanelCollapsed).toBe(false);
    });

    it('ទិសផ្ទុយ ៖ ផ្ទាំងបង្រួមដោយដៃមុន ➜ ចាកចេញពីប្រអប់មិនបើកវិញដោយខ្លួនឯង', () => {
        vi.useFakeTimers();
        uiState.entryPanelCollapsed = true;
        entrySearchFocused();
        entrySearchBlurred();
        vi.advanceTimersByTime(200);
        expect(uiState.entryPanelCollapsed).toBe(true);
    });

    it('ទិសផ្ទុយ ៖ អេក្រង់ធំ (≥ 992px) · tab ផ្សេង ➜ មិនបង្រួម', () => {
        setWidth(1024);
        entrySearchFocused();
        expect(uiState.entryPanelCollapsed).toBe(false);
        setWidth(390);
        uiState.currentAppPage = 'data';
        entrySearchFocused();
        expect(uiState.entryPanelCollapsed).toBe(false);
    });

    it('ទិសផ្ទុយ ៖ Android/web ➜ ការចុចទុកឲ្យ browser (focus ធម្មតា ➜ onFocus បង្រួម)', () => {
        setIOSStandalone(false);
        expect(tap(entryInput, 1000).defaultPrevented).toBe(false);
        expect(focusCalls).toEqual([]);
    });

    it('⛔ iPhone PWA ៖ document រំកិលខណៈប្រអប់ស្វែងរក tab ស្កេន focus ➜ ត្រឡប់ ០ · មិន focus ➜ មិនប៉ះ', () => {
        let y = 240;
        const calls: any[] = [];
        Object.defineProperty(window, 'scrollY', { configurable: true, get: () => y });
        window.scrollTo = ((a: any, b: any) => { calls.push([a, b]); y = 0; }) as any;
        iosViewport.restoreIOSDocumentScroll();
        expect(calls).toEqual([]);
        HTMLElement.prototype.focus.call(entryInput);
        y = 240;
        iosViewport.restoreIOSDocumentScroll();
        expect(calls).toEqual([[0, 0]]);
    });
});
