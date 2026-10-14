/**
 * ⛔ រាយការណ៍ម្ចាស់គម្រោង (វីដេអូ VID_20261014_155824 · iPhone PWA · APK និង Android PWA រលូន) ៖ ស្វែងរកលេខ (ប្រអប់ទាញឡើង · keyboard បើក) ➜ អូសលើកាតបញ្ជី
 *    ➜ ទំព័រទាំងមូល (navbar ផង) រំកិលឡើងតាមម្រាមដៃ បង្ហាញចន្លោះទទេដែលនៅក្រោយ keyboard ➜ លែងដៃ ➜ លោតត្រឡប់ ០ ក្នុង ១ ស៊ុម (`restoreIOSDocumentScroll()`)។
 *    មូលហេតុ ៖ iOS មិនបង្រួម viewport ពេល keyboard បើក (Android បង្រួម) ➜ កាតបញ្ជីលាតដល់ក្រោយ keyboard ហើយ iOS អនុញ្ញាតឲ្យអូស document ទាំង root ចាក់សោ។
 * ⛔ ច្បាប់ ៖ iOS standalone · ទូរស័ព្ទ · ប្រអប់ស្វែងរកទាញឡើង (`iosSearchDocumentLocked()`) ៖ (១) `visualViewport` `resize` ➜ `uiState.iosKeyboardInset` =
 *    `innerHeight - visualViewport.height` (≥ `KEYBOARD_MIN_INSET_PX`) ➜ `body.ios-keyboard` + `--ios-keyboard-inset` ➜ `.app-pages` padding-bottom
 *    ➜ កាតបញ្ជីចប់ពីលើ keyboard ដូច Android · ប្រអប់បិទ ➜ ០ · (២) `touchmove` បញ្ឈរក្រៅអ្នករមូរដែលមានកន្លែង ➜ `preventDefault()` (document មិនរំកិល) ·
 *    ក្នុងអ្នករមូរដែលមានកន្លែងក្នុងទិសនោះ · អូសផ្ដេក · ក្នុងប្រអប់អក្សរ · ម្រាមដៃពីរ · Android/web · អេក្រង់ធំ · ប្រអប់មិនទាញឡើង ➜ មិនប៉ះ។
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { uiState } from '../src/core/state';
import * as iosViewport from '../src/app/behaviors/ios-viewport';
import { KEYBOARD_MIN_INSET_PX } from '../src/app/behaviors/chrome-autohide';

const listeners: Array<[EventTarget, string, any, any]> = [];
const disposers: Array<() => void> = [];
let vv: EventTarget & { height: number; offsetTop: number };
const realInnerWidth = window.innerWidth;
const realInnerHeight = window.innerHeight;
let page: HTMLElement;
let scroller: HTMLElement;
let row: HTMLElement;
let input: HTMLInputElement;

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

function setIOSStandalone(on: boolean) {
    Object.defineProperty(window.navigator, 'standalone', { configurable: true, value: on ? true : undefined });
    Object.defineProperty(window, 'CSS', { configurable: true, value: { supports: (p: string, v: string) => on && p === '-webkit-touch-callout' && v === 'none' } });
}

function setSize(w: number, h: number) {
    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: w });
    Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: h });
}

function setScroll(el: HTMLElement, scrollHeight: number, clientHeight: number, scrollTop: number) {
    Object.defineProperty(el, 'scrollHeight', { configurable: true, value: scrollHeight });
    Object.defineProperty(el, 'clientHeight', { configurable: true, value: clientHeight });
    el.scrollTop = scrollTop;
    Object.defineProperty(el, 'scrollTop', { configurable: true, writable: true, value: scrollTop });
}

type Pt = { x: number; y: number; id?: number };

function touch(type: string, target: EventTarget, p: Pt, active: number, cancelable = true) {
    const ev = new Event(type, { bubbles: true, cancelable });
    const t = { identifier: p.id ?? 1, clientX: p.x, clientY: p.y, target };
    const list = Array.from({ length: active }, (_, i) => (i === 0 ? t : { ...t, identifier: 99 + i }));
    Object.defineProperty(ev, 'touches', { value: list });
    Object.defineProperty(ev, 'changedTouches', { value: [t] });
    target.dispatchEvent(ev);
    return ev;
}

function drag(target: EventTarget, from: Pt, to: Pt, fingers = 1) {
    touch('touchstart', target, from, fingers);
    const move = touch('touchmove', target, to, fingers);
    touch('touchend', target, to, 0);
    return move;
}

function keyboard(height: number) {
    vv.height = height;
    vv.dispatchEvent(new Event('resize'));
}

function boot() {
    (iosViewport as any).listenIOSKeyboard(scope());
}

beforeEach(() => {
    vv = Object.assign(new EventTarget(), { height: 844, offsetTop: 0 });
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: vv });
    setIOSStandalone(true);
    setSize(390, 844);
    uiState.dataPanelSearchFocus = true;
    uiState.iosKeyboardInset = 0;
    page = document.createElement('div');
    scroller = document.createElement('div');
    scroller.style.overflowY = 'auto';
    row = document.createElement('div');
    input = document.createElement('input');
    scroller.appendChild(row);
    page.append(input, scroller);
    document.body.appendChild(page);
    setScroll(scroller, 300, 300, 0);
});

afterEach(() => {
    listeners.splice(0).forEach(([t, type, h, o]) => t.removeEventListener(type, h, o));
    disposers.splice(0).forEach((fn) => fn());
    page.remove();
    uiState.dataPanelSearchFocus = false;
    uiState.iosKeyboardInset = 0;
    setSize(realInnerWidth, realInnerHeight);
    setIOSStandalone(false);
});

describe('iPhone PWA ៖ keyboard បើកខណៈស្វែងរកលេខ ➜ កាតបញ្ជីចប់ពីលើ keyboard (ដូច Android)', () => {
    it('⛔ visualViewport ទាបជាង innerHeight ≥ KEYBOARD_MIN_INSET_PX ➜ uiState.iosKeyboardInset = ចំនួនគម្លាត', () => {
        boot();
        keyboard(844 - 336);
        expect(uiState.iosKeyboardInset).toBe(336);
    });

    it('⛔ keyboard បិទ (viewport ពេញ) ➜ ០ · គម្លាតតូចជាងកម្រិត (របា) ➜ ០', () => {
        boot();
        keyboard(844 - 336);
        keyboard(844);
        expect(uiState.iosKeyboardInset).toBe(0);
        keyboard(844 - (KEYBOARD_MIN_INSET_PX - 1));
        expect(uiState.iosKeyboardInset).toBe(0);
    });

    it('⛔ ប្រអប់ស្វែងរកបិទខណៈ keyboard នៅបើក (store ប្រែ) ➜ ០ · ទាញឡើងម្តងទៀត ➜ វាស់ឡើងវិញ', () => {
        boot();
        keyboard(844 - 336);
        uiState.dataPanelSearchFocus = false;
        uiState.flush();
        expect(uiState.iosKeyboardInset).toBe(0);
        uiState.dataPanelSearchFocus = true;
        uiState.flush();
        expect(uiState.iosKeyboardInset).toBe(336);
    });

    it('ទិសផ្ទុយ ៖ ប្រអប់មិនទាញឡើង · អេក្រង់ធំ · Android/web (មិនមែន iOS standalone) ➜ ០ · គ្មាន listener', () => {
        uiState.dataPanelSearchFocus = false;
        boot();
        keyboard(844 - 336);
        expect(uiState.iosKeyboardInset).toBe(0);
        uiState.dataPanelSearchFocus = true;
        setSize(1024, 844);
        keyboard(844 - 336);
        expect(uiState.iosKeyboardInset).toBe(0);
        listeners.splice(0).forEach(([t, type, h, o]) => t.removeEventListener(type, h, o));
        disposers.splice(0).forEach((fn) => fn());
        setSize(390, 844);
        setIOSStandalone(false);
        boot();
        expect(listeners.length).toBe(0);
        keyboard(844 - 336);
        expect(uiState.iosKeyboardInset).toBe(0);
    });

    it('⛔ ខ្សែភ្ជាប់ ៖ boot · DocumentEffects (body.ios-keyboard · --ios-keyboard-inset) · react-root.css (padding-bottom ពី inset · iOS standalone តែប៉ុណ្ណោះ)', () => {
        const root = path.join(__dirname, '..', 'src');
        expect(readFileSync(path.join(root, 'app', 'lifecycle', 'boot.ts'), 'utf8')).toMatch(/listenIOSKeyboard\(scope\)/);
        const effects = readFileSync(path.join(root, 'app', 'components', 'shell', 'DocumentEffects.tsx'), 'utf8');
        expect(effects).toMatch(/useBodyClass\('ios-keyboard', iosKeyboardInset > 0\)/);
        expect(effects).toMatch(/useHtmlVar\('--ios-keyboard-inset'/);
        const css = readFileSync(path.join(root, 'styles', 'react-root.css'), 'utf8');
        const rules = css.match(/html\.ios-standalone body\.ios-keyboard [^{}]*\{[^{}]*\}/g) || [];
        expect(rules.some((r) => /search-focus/.test(r) && /history-expanded/.test(r) && /padding-bottom:\s*calc\(var\(--ios-keyboard-inset, 0px\) \+ 8px\)/.test(r))).toBe(true);
        expect(css.match(/--ios-keyboard-inset/g)!.length).toBe(1);
        expect(/[^.]\bbody\.ios-keyboard/.test(css.replace(/html\.ios-standalone body\.ios-keyboard/g, ''))).toBe(false);
    });
});

describe('iPhone PWA ៖ អូសខណៈស្វែងរកលេខ ➜ document មិនរំកិល (touchmove preventDefault) · ការរមូរក្នុងបញ្ជីនៅដដែល', () => {
    it('⛔ អូសឡើងលើកាតដែលគ្មានអ្នករមូរមានកន្លែង ➜ preventDefault', () => {
        boot();
        expect(drag(row, { x: 100, y: 500 }, { x: 102, y: 420 }).defaultPrevented).toBe(true);
        expect(drag(page, { x: 100, y: 400 }, { x: 100, y: 520 }).defaultPrevented).toBe(true);
    });

    it('⛔ ការសម្រេចចាក់សោក្នុងកាយវិការ ៖ touchmove ទី ២ នៅតែ preventDefault · touchend ➜ កាយវិការថ្មី', () => {
        boot();
        touch('touchstart', row, { x: 100, y: 500 }, 1);
        expect(touch('touchmove', row, { x: 100, y: 480 }, 1).defaultPrevented).toBe(true);
        expect(touch('touchmove', row, { x: 100, y: 440 }, 1).defaultPrevented).toBe(true);
        touch('touchend', row, { x: 100, y: 440 }, 0);
        expect(touch('touchmove', row, { x: 100, y: 400 }, 1).defaultPrevented).toBe(false);
    });

    it('អ្នករមូរមានកន្លែងក្នុងទិសនោះ ➜ មិនប៉ះ · ដល់ចុង ➜ preventDefault · ត្រឡប់ទិស ➜ មិនប៉ះ', () => {
        boot();
        setScroll(scroller, 900, 300, 0);
        expect(drag(row, { x: 100, y: 500 }, { x: 100, y: 420 }).defaultPrevented).toBe(false);
        expect(drag(row, { x: 100, y: 400 }, { x: 100, y: 480 }).defaultPrevented).toBe(true);
        setScroll(scroller, 900, 300, 600);
        expect(drag(row, { x: 100, y: 500 }, { x: 100, y: 420 }).defaultPrevented).toBe(true);
        expect(drag(row, { x: 100, y: 400 }, { x: 100, y: 480 }).defaultPrevented).toBe(false);
    });

    it('ទិសផ្ទុយ ៖ អូសផ្ដេក · ក្នុងប្រអប់អក្សរ · ម្រាមដៃពីរ · event មិន cancelable · ប្រអប់មិនទាញឡើង · អេក្រង់ធំ ➜ មិនប៉ះ', () => {
        boot();
        expect(drag(row, { x: 100, y: 500 }, { x: 180, y: 470 }).defaultPrevented).toBe(false);
        expect(drag(input, { x: 100, y: 100 }, { x: 100, y: 40 }).defaultPrevented).toBe(false);
        expect(drag(row, { x: 100, y: 500 }, { x: 100, y: 420 }, 2).defaultPrevented).toBe(false);
        touch('touchstart', row, { x: 100, y: 500 }, 1);
        expect(touch('touchmove', row, { x: 100, y: 420 }, 1, false).defaultPrevented).toBe(false);
        touch('touchend', row, { x: 100, y: 420 }, 0);
        uiState.dataPanelSearchFocus = false;
        expect(drag(row, { x: 100, y: 500 }, { x: 100, y: 420 }).defaultPrevented).toBe(false);
        uiState.dataPanelSearchFocus = true;
        setSize(1024, 844);
        expect(drag(row, { x: 100, y: 500 }, { x: 100, y: 420 }).defaultPrevented).toBe(false);
    });

    it('⛔ ខ្សែភ្ជាប់ ៖ touchmove នៅ document · capture · មិន passive (preventDefault ដើរ)', () => {
        boot();
        const move = listeners.find(([t, type]) => t === document && type === 'touchmove');
        expect(move).toBeTruthy();
        expect(move![3]).toEqual({ capture: true, passive: false });
    });
});
