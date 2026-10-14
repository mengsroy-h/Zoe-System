/**
 * ⛔ សំណើម្ចាស់គម្រោង ៖ «បន្ថែមមុខងារអោយ modal ណាដែលមានប្រអប់វាយបញ្ចូលអក្សរឬលេខឆ្លាតវៃ ចេះរំកិលពេលបាំង keyboard»។
 *    iPhone មិនបង្រួម layout viewport ពេល keyboard បើក ➜ `.modal` (fixed · ១០០%) នៅកណ្តាលអេក្រង់ពេញ ➜ keyboard បាំងពាក់កណ្តាលក្រោម។
 * ⛔ ច្បាប់ ៖ ប្រអប់បើក + `innerHeight - visualViewport.height` ≥ `KEYBOARD_MIN_INSET_PX` ➜ `uiState.modalViewportTop/Height`
 *    = ផ្ទៃមើលឃើញ (`offsetTop` · `height`) ➜ `body.modal-keyboard` + `--modal-vv-top` · `--modal-vv-height` ➜ ប្រអប់ក្នុងផ្ទៃនោះ ·
 *    `.modal-content` max-height 100% · ប្រអប់វាយដែល focus រមូរចូលមើលឃើញក្នុងអ្នករមូររបស់វា (`revealFocusedModalField()` ៖
 *    `setElementScrollTop` · គម្លាត `MODAL_FIELD_MARGIN_PX`) · keyboard បិទ · ប្រអប់បិទ · APK (viewport បង្រួម) ➜ ០ ។
 *    browser ពិតគ្រប់ប្រអប់ ៖ `audit-tools/modal-keyboard-test.js` ។
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { uiState } from '../src/core/state';
import { KEYBOARD_MIN_INSET_PX } from '../src/app/behaviors/chrome-autohide';
import * as modalKeyboard from '../src/app/behaviors/modal-keyboard';
import { DocumentEffects } from '../src/app/components/shell/DocumentEffects';
import { commitNow } from '../src/app/flush';
import { mount, unmount } from './native/react-harness';

const listeners: Array<[EventTarget, string, any, any]> = [];
const disposers: Array<() => void> = [];
const realInnerHeight = window.innerHeight;
let vv: EventTarget & { height: number; offsetTop: number };
let modal: HTMLElement;
let content: HTMLElement;
let field: HTMLInputElement;
let other: HTMLInputElement;

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

function keyboard(inset: number, offsetTop = 0) {
    vv.height = window.innerHeight - inset;
    vv.offsetTop = offsetTop;
    vv.dispatchEvent(new Event('resize'));
}

function scrollable(el: HTMLElement, scrollHeight: number, clientHeight: number) {
    Object.defineProperty(el, 'scrollHeight', { configurable: true, value: scrollHeight });
    Object.defineProperty(el, 'clientHeight', { configurable: true, value: clientHeight });
    el.style.overflowY = 'auto';
}

beforeEach(() => {
    Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: 844 });
    vv = Object.assign(new EventTarget(), { height: 844, offsetTop: 0 });
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: vv });
    modal = document.createElement('div');
    modal.className = 'modal';
    content = document.createElement('div');
    content.className = 'modal-content';
    field = document.createElement('input');
    other = document.createElement('input');
    content.append(other, field);
    modal.appendChild(content);
    document.body.appendChild(modal);
    uiState.isModalOpen = true;
    uiState.modalViewportTop = 0;
    uiState.modalViewportHeight = 0;
});

afterEach(() => {
    disposers.splice(0).forEach((fn) => fn());
    listeners.splice(0).forEach(([t, type, h, o]) => t.removeEventListener(type, h, o));
    unmount();
    modal.remove();
    uiState.isModalOpen = false;
    uiState.modalViewportTop = 0;
    uiState.modalViewportHeight = 0;
    Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: realInnerHeight });
});

describe('ប្រអប់ ⟷ keyboard ៖ ផ្ទៃមើលឃើញ (visualViewport)', () => {
    it('⛔ ប្រអប់បើក + keyboard បាំង ≥ KEYBOARD_MIN_INSET_PX ➜ ផ្ទៃមើលឃើញ (top · height) · គម្លាតតូចជាង · ប្រអប់បិទ · គ្មាន visualViewport ➜ null', () => {
        vv.height = 844 - 336;
        expect(modalKeyboard.modalKeyboardViewport()).toEqual({ top: 0, height: 508 });
        vv.offsetTop = 140;
        expect(modalKeyboard.modalKeyboardViewport()).toEqual({ top: 140, height: 508 });
        vv.offsetTop = 900;
        expect(modalKeyboard.modalKeyboardViewport()).toEqual({ top: 336, height: 508 });
        vv.offsetTop = -40;
        expect(modalKeyboard.modalKeyboardViewport()).toEqual({ top: 0, height: 508 });
        vv.offsetTop = 0;
        vv.height = 844 - (KEYBOARD_MIN_INSET_PX - 1);
        expect(modalKeyboard.modalKeyboardViewport()).toBeNull();
        vv.height = 844 - KEYBOARD_MIN_INSET_PX;
        expect(modalKeyboard.modalKeyboardViewport()).not.toBeNull();
        uiState.isModalOpen = false;
        expect(modalKeyboard.modalKeyboardViewport()).toBeNull();
        uiState.isModalOpen = true;
        Object.defineProperty(window, 'visualViewport', { configurable: true, value: undefined });
        expect(modalKeyboard.modalKeyboardViewport()).toBeNull();
    });

    it('ទិសផ្ទុយ ៖ តម្លៃខុស (NaN · ០ · អវិជ្ជមាន) មិនបោះ ហើយមិនប្តូរ · offsetTop NaN ➜ ០', () => {
        for (const bad of [NaN, 0, -10, Infinity]) {
            vv.height = bad;
            expect(() => modalKeyboard.modalKeyboardViewport()).not.toThrow();
            expect(modalKeyboard.modalKeyboardViewport()).toBeNull();
        }
        vv.height = 500;
        vv.offsetTop = NaN;
        expect(modalKeyboard.modalKeyboardViewport()).toEqual({ top: 0, height: 500 });
    });

    it('⛔ APK ៖ WebView បង្រួម (innerHeight = visualViewport.height) ➜ null', () => {
        Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: 508 });
        vv.height = 508;
        expect(modalKeyboard.modalKeyboardViewport()).toBeNull();
    });
});

describe('ប្រអប់ ⟷ keyboard ៖ listener · state · DOM', () => {
    it('⛔ keyboard បើក ➜ state + body.modal-keyboard + អថេរ CSS · offsetTop តាម scroll · keyboard បិទ ➜ ដក', () => {
        mount(<DocumentEffects />);
        modalKeyboard.listenModalKeyboard(scope());
        keyboard(336);
        expect(uiState.modalViewportHeight).toBe(508);
        expect(document.body.classList.contains('modal-keyboard')).toBe(true);
        expect(document.documentElement.style.getPropertyValue('--modal-vv-height')).toBe('508px');
        expect(document.documentElement.style.getPropertyValue('--modal-vv-top')).toBe('0px');
        vv.offsetTop = 120;
        vv.dispatchEvent(new Event('scroll'));
        commitNow();
        expect(uiState.modalViewportTop).toBe(120);
        expect(document.documentElement.style.getPropertyValue('--modal-vv-top')).toBe('120px');
        keyboard(0);
        commitNow();
        expect(uiState.modalViewportHeight).toBe(0);
        expect(document.body.classList.contains('modal-keyboard')).toBe(false);
        expect(document.documentElement.style.getPropertyValue('--modal-vv-height')).toBe('100%');
    });

    it('⛔ ប្រអប់បិទ (keyboard នៅបើក) ➜ ០ · បើកប្រអប់ខណៈ keyboard បើក ➜ វាស់ភ្លាម (store subscription)', () => {
        modalKeyboard.listenModalKeyboard(scope());
        keyboard(336);
        expect(uiState.modalViewportHeight).toBe(508);
        uiState.isModalOpen = false;
        uiState.flush();
        expect(uiState.modalViewportHeight).toBe(0);
        uiState.isModalOpen = true;
        uiState.flush();
        expect(uiState.modalViewportHeight).toBe(508);
    });

    it('⛔ ប្រអប់វាយនៅក្រោមផ្ទៃរមូរ ➜ រមូរឡើងឲ្យឃើញ (គម្លាត MODAL_FIELD_MARGIN_PX) · នៅខាងលើ ➜ រមូរចុះ · មើលឃើញហើយ ➜ មិនប៉ះ', () => {
        scrollable(content, 900, 400);
        content.scrollTop = 0;
        content.getBoundingClientRect = () => rect(50, 400);
        let fieldTop = 600;
        field.getBoundingClientRect = () => rect(fieldTop - content.scrollTop, 40);
        modalKeyboard.listenModalKeyboard(scope());
        field.focus();
        keyboard(336);
        expect(content.scrollTop).toBe(600 + 40 - (450 - modalKeyboard.MODAL_FIELD_MARGIN_PX));
        const after = content.scrollTop;
        modalKeyboard.revealFocusedModalField();
        expect(content.scrollTop).toBe(after);
        fieldTop = 100;
        content.scrollTop = 300;
        modalKeyboard.revealFocusedModalField();
        expect(content.scrollTop).toBe(300 + (100 - 300) - (50 + modalKeyboard.MODAL_FIELD_MARGIN_PX));
    });

    it('⛔ ប្រអប់វាយខ្ពស់ជាងផ្ទៃ (textarea) ➜ ផ្នែកខាងលើមើលឃើញ (មិនរមូរហួស)', () => {
        scrollable(content, 900, 300);
        content.scrollTop = 0;
        content.getBoundingClientRect = () => rect(50, 300);
        field.getBoundingClientRect = () => rect(500 - content.scrollTop, 400);
        modalKeyboard.listenModalKeyboard(scope());
        field.focus();
        keyboard(336);
        expect(field.getBoundingClientRect().top).toBe(50 + modalKeyboard.MODAL_FIELD_MARGIN_PX);
    });

    it('⛔ ប្តូរ focus ទៅប្រអប់វាយផ្សេង (keyboard នៅបើក · គ្មាន resize) ➜ focusin បង្ហាញប្រអប់ថ្មី · keyboard បិទ ➜ focusin មិនរមូរ', () => {
        scrollable(content, 900, 400);
        content.getBoundingClientRect = () => rect(50, 400);
        other.getBoundingClientRect = () => rect(80 - content.scrollTop, 40);
        field.getBoundingClientRect = () => rect(700 - content.scrollTop, 40);
        modalKeyboard.listenModalKeyboard(scope());
        other.focus();
        keyboard(336);
        expect(content.scrollTop).toBe(0);
        field.focus();
        expect(content.scrollTop).toBeGreaterThan(0);
        keyboard(0);
        content.scrollTop = 0;
        other.blur();
        field.blur();
        field.focus();
        expect(content.scrollTop).toBe(0);
    });

    it('ទិសផ្ទុយ ៖ focus ក្រៅប្រអប់ (ឧ. ប្រអប់ស្វែងរក) ➜ មិនរមូរ · dispose ➜ ០ ហើយ listener ដក', () => {
        const outside = document.createElement('input');
        document.body.appendChild(outside);
        scrollable(content, 900, 400);
        content.getBoundingClientRect = () => rect(50, 400);
        modalKeyboard.listenModalKeyboard(scope());
        outside.focus();
        keyboard(336);
        expect(content.scrollTop).toBe(0);
        disposers.splice(0).forEach((fn) => fn());
        listeners.splice(0).forEach(([t, type, h, o]) => t.removeEventListener(type, h, o));
        expect(uiState.modalViewportHeight).toBe(0);
        keyboard(300);
        expect(uiState.modalViewportHeight).toBe(0);
        outside.remove();
    });

    it('⛔ ខ្សែភ្ជាប់ ៖ boot ចាក់ listenModalKeyboard · react-root.css ដាក់ .modal ក្នុងផ្ទៃមើលឃើញ · .modal-content max-height 100%', () => {
        const root = path.resolve(__dirname, '..');
        const boot = readFileSync(path.join(root, 'src/app/lifecycle/boot.ts'), 'utf8');
        expect(/listenModalKeyboard\(scope\)/.test(boot)).toBe(true);
        const css = readFileSync(path.join(root, 'src/styles/react-root.css'), 'utf8');
        expect(/body\.modal-keyboard \.modal \{ top: var\(--modal-vv-top, 0px\); height: var\(--modal-vv-height, 100%\); \}/.test(css)).toBe(true);
        expect(/body\.modal-keyboard \.modal-content \{ max-height: 100%; \}/.test(css)).toBe(true);
        const fx = readFileSync(path.join(root, 'src/app/components/shell/DocumentEffects.tsx'), 'utf8');
        expect(/useBodyClass\('modal-keyboard', modalViewportHeight > 0\)/.test(fx)).toBe(true);
    });
});
