/**
 * ⛔ រាយការណ៍ម្ចាស់គម្រោង (វីដេអូ VID_20261008_210711 · iPhone iOS 26.5 · App លើ Home Screen · ក្រោយ 2.50.42) ៖ ចុចស្វែងរកលេខ ➜ navbar
 *    ហាក់ «រមូរពីក្រោមឡើងលើ»។ រូប ៣០ fps ៖ ស៊ុមដំបូង ប្រអប់ទាញឡើងរួច (navbar នៅលើ) ➜ keyboard ចាប់ផ្តើម ➜ ទំព័រទាំងមូល (navbar ផង) ធ្លាក់ចុះ ~១៩០px
 *    ហើយរអិលឡើងវិញក្នុង ~២០០ms (ករណីពីរដូចគ្នា)។ មូលហេតុ ៖ iOS រំកិល document ដើម្បីបង្ហាញប្រអប់តាមទីតាំង *មុន* ការទាញឡើង (focus ពីការចុចធម្មតា)
 *    ហើយរំកិលនោះជាចលនា ➜ `restoreIOSDocumentScroll()` (2.50.42) ត្រឡប់ ០ កណ្តាលចលនា ➜ ឃើញទំព័រធ្លាក់ ហើយរអិលឡើង។
 * ⛔ ច្បាប់ ៖ iOS standalone · ទូរស័ព្ទ (< 992px) · ការចុច (មិនអូស · មិនសង្កត់យូរ · ម្រាមដៃមួយ) លើប្រអប់ស្វែងរកលេខដែលមិនទាន់ focus ➜ `touchend`
 *    `preventDefault()` (iOS មិន focus ខ្លួនឯង) ➜ ទាញប្រអប់ឡើង **មុន** ➜ `focus({ preventScroll: true })` ➜ iOS ឃើញប្រអប់នៅខាងលើរួច ➜ គ្មានហេតុរំកិល។
 *    focus មិនជាប់ ➜ ទាញចុះវិញ ហើយការចុចបន្ទាប់ទុកឲ្យ iOS (fail-open)។ ទិសផ្ទុយ ៖ អូស · សង្កត់យូរ · ម្រាមដៃពីរ · focus រួច · Android/web ·
 *    អេក្រង់ធំ · ធាតុផ្សេង ➜ មិនប៉ះ។ `restoreIOSDocumentScroll()` នៅជាខ្សែការពារទីពីរ។
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { uiState } from '../src/core/state';
import { refTo } from '../src/app/refs';
import * as iosViewport from '../src/app/behaviors/ios-viewport';

const listeners: Array<[EventTarget, string, any, any]> = [];
let input: HTMLInputElement;
let other: HTMLInputElement;
let side: HTMLElement;
let focusCalls: Array<{ options: any; pulledUp: boolean }>;
let refuseFocus = false;
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

type Pt = { x: number; y: number; t: number; id?: number };

function touch(type: string, target: EventTarget, p: Pt, active: number) {
    const ev = new Event(type, { bubbles: true, cancelable: true });
    const t = { identifier: p.id ?? 1, clientX: p.x, clientY: p.y, target };
    const list = Array.from({ length: active }, (_, i) => (i === 0 ? t : { ...t, identifier: 99 + i }));
    Object.defineProperty(ev, 'touches', { value: list });
    Object.defineProperty(ev, 'changedTouches', { value: [t] });
    Object.defineProperty(ev, 'timeStamp', { value: p.t });
    target.dispatchEvent(ev);
    return ev;
}

function tap(target: EventTarget, from: Pt, to: Pt, fingers = 1) {
    touch('touchstart', target, from, fingers);
    return touch('touchend', target, to, 0);
}

beforeEach(() => {
    focusCalls = [];
    refuseFocus = false;
    setIOSStandalone(true);
    setWidth(390);
    uiState.dataPanelSearchFocus = false;
    side = document.createElement('div');
    input = document.createElement('input');
    input.type = 'tel';
    other = document.createElement('input');
    side.append(input, other);
    document.body.appendChild(side);
    const realFocus = HTMLElement.prototype.focus;
    input.focus = function (this: HTMLInputElement, options?: any) {
        focusCalls.push({ options, pulledUp: uiState.dataPanelSearchFocus });
        if (!refuseFocus) realFocus.call(this, options);
    } as any;
    refTo('dataSideSection')(side);
    refTo('searchPhoneInput')(input);
    (iosViewport as any).listenIOSSearchFocus(scope());
});

afterEach(() => {
    listeners.splice(0).forEach(([t, type, h, o]) => t.removeEventListener(type, h, o));
    refTo('searchPhoneInput')(null);
    refTo('dataSideSection')(null);
    side.remove();
    (document.activeElement as HTMLElement | null)?.blur?.();
    uiState.dataPanelSearchFocus = false;
    setWidth(realInnerWidth);
    setIOSStandalone(false);
    vi.restoreAllMocks();
});

describe('iPhone PWA ៖ ចុចស្វែងរកលេខ ➜ ទាញឡើងមុន ហើយ focus មិនរំកិល (គ្មាន navbar ធ្លាក់ ហើយរអិលឡើង)', () => {
    it('⛔ ការចុច ➜ touchend preventDefault · ទាញឡើងមុន focus · focus({ preventScroll: true }) · ប្រអប់ focus ពិត', () => {
        const end = tap(input, { x: 100, y: 450, t: 1000 }, { x: 102, y: 452, t: 1120 });
        expect(end.defaultPrevented).toBe(true);
        expect(focusCalls.length).toBe(1);
        expect(focusCalls[0].options).toEqual({ preventScroll: true });
        expect(focusCalls[0].pulledUp).toBe(true);
        expect(uiState.dataPanelSearchFocus).toBe(true);
        expect(document.activeElement).toBe(input);
    });

    it('⛔ ខ្សែភ្ជាប់ ៖ boot ចង listener · touchend មិន passive (preventDefault បាន) · capture', () => {
        const boot = readFileSync(path.join(__dirname, '..', 'src', 'app', 'lifecycle', 'boot.ts'), 'utf8');
        expect(boot).toMatch(/listenIOSSearchFocus\(scope\)/);
        const end = listeners.find(([, type]) => type === 'touchend');
        expect(end && end[3]).toMatchObject({ capture: true, passive: false });
        expect(listeners.some(([, type]) => type === 'touchcancel')).toBe(true);
    });

    it('ទិសផ្ទុយ ៖ អូស (រំកិលលើស ១០px) ➜ ទុកឲ្យ iOS (រមូរ/អូសផ្ទាំងដដែល)', () => {
        const end = tap(input, { x: 100, y: 450, t: 1000 }, { x: 100, y: 480, t: 1150 });
        expect(end.defaultPrevented).toBe(false);
        expect(focusCalls).toEqual([]);
        expect(uiState.dataPanelSearchFocus).toBe(false);
    });

    it('ទិសផ្ទុយ ៖ សង្កត់យូរ (ម៉ឺនុយបិទភ្ជាប់ · កែវពង្រីក) ➜ ទុកឲ្យ iOS', () => {
        const end = tap(input, { x: 100, y: 450, t: 1000 }, { x: 100, y: 450, t: 1700 });
        expect(end.defaultPrevented).toBe(false);
        expect(focusCalls).toEqual([]);
    });

    it('ទិសផ្ទុយ ៖ ប្រអប់ focus រួច (ចុចប្តូរទីតាំង caret) ➜ ទុកឲ្យ iOS', () => {
        HTMLElement.prototype.focus.call(input);
        const end = tap(input, { x: 100, y: 450, t: 1000 }, { x: 100, y: 450, t: 1100 });
        expect(end.defaultPrevented).toBe(false);
        expect(focusCalls).toEqual([]);
    });

    it('ទិសផ្ទុយ ៖ Android/web · អេក្រង់ធំ (≥ 992px) ➜ មិនប៉ះ', () => {
        setIOSStandalone(false);
        expect(tap(input, { x: 100, y: 450, t: 1000 }, { x: 100, y: 450, t: 1100 }).defaultPrevented).toBe(false);
        setIOSStandalone(true);
        setWidth(1024);
        expect(tap(input, { x: 100, y: 450, t: 2000 }, { x: 100, y: 450, t: 2100 }).defaultPrevented).toBe(false);
        expect(focusCalls).toEqual([]);
    });

    it('ទិសផ្ទុយ ៖ ម្រាមដៃពីរ · touchcancel · ធាតុផ្សេង ➜ មិនប៉ះ', () => {
        expect(tap(input, { x: 100, y: 450, t: 1000 }, { x: 100, y: 450, t: 1100 }, 2).defaultPrevented).toBe(false);
        touch('touchstart', input, { x: 100, y: 450, t: 2000 }, 1);
        touch('touchcancel', input, { x: 100, y: 450, t: 2050 }, 0);
        expect(touch('touchend', input, { x: 100, y: 450, t: 2100 }, 0).defaultPrevented).toBe(false);
        expect(tap(other, { x: 100, y: 500, t: 3000 }, { x: 100, y: 500, t: 3100 }).defaultPrevented).toBe(false);
        expect(focusCalls).toEqual([]);
    });

    it('⛔ fail-open ៖ focus មិនជាប់ ➜ ទាញចុះវិញ · ការចុចបន្ទាប់ទុកឲ្យ iOS (មិនជាប់ប្រអប់គ្មាន keyboard)', () => {
        refuseFocus = true;
        const first = tap(input, { x: 100, y: 450, t: 1000 }, { x: 100, y: 450, t: 1100 });
        expect(first.defaultPrevented).toBe(true);
        expect(uiState.dataPanelSearchFocus).toBe(false);
        const second = tap(input, { x: 100, y: 450, t: 2000 }, { x: 100, y: 450, t: 2100 });
        expect(second.defaultPrevented).toBe(false);
        expect(focusCalls.length).toBe(1);
    });
});
