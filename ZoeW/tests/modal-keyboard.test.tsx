/**
 * ⛔ សំណើម្ចាស់គម្រោង ៖ «modal ណាដែលមានប្រអប់វាយបញ្ចូលអក្សរឬលេខ ឆ្លាតវៃ ចេះរំកិលពេលបាំង keyboard» ហើយបន្ទាប់មក ៖ «កុំអោយរំកិលឡើង
 *    ទាំងមូល ព្រោះ modal ខ្លះវែងអាចផុត (ឧ. API ស្វែងរកអតិថិជន) អោយរំកិលកុំអោយបាំងតែកន្លែងបញ្ចូលអក្សរឬលេខបានហើយ» · «ផ្ទៃថ្លាពីលើ keyboard
 *    ពណ៌ពីរខុសគ្នា»។ iPhone មិនបង្រួម layout viewport ពេល keyboard បើក ➜ `.modal` (fixed · ១០០%) នៅកណ្តាលអេក្រង់ពេញ។
 * ⛔ ច្បាប់ ៖ ប្រអប់បើក + `innerHeight - visualViewport.height` ≥ `KEYBOARD_MIN_INSET_PX` ➜ `uiState.modalViewportTop/Height` (ផ្ទៃមើលឃើញ) ·
 *    `body.modal-keyboard` · `--modal-kb-pan` · `--modal-kb-line` ➜ backdrop `.modal` ពេញ + `::after` ស្រទាប់ស្រអាប់ពណ៌តែមួយពីបន្ទាត់ keyboard ចុះក្រោម ·
 *    ប្រអប់ខាងលើគេដែលបាតនៅក្រោយ keyboard ➜ `uiState.modalKeyboardFit` ➜ `.modal-kb` ៖ ប្រអប់ខ្លីឡើងតែល្មមឲ្យបាតត្រឹម keyboard
 *    (`MODAL_KEYBOARD_GAP_PX`) ➜ ឃើញទាំងមូល (រូបថតម្ចាស់គម្រោង ៖ ប៊ូតុង PIN ត្រូវកាត់) · ប្រអប់វែងជាងផ្ទៃពីលើ keyboard ➜ កំពូលនៅកំពូលផ្ទៃមើលឃើញ
 *    (padding · ក្រោម status bar `--modal-safe-top` + គម្លាត ⛔ មិនដែលផុតអេក្រង់) ហើយរមូរក្នុងខ្លួន · ប្រអប់វាយដែល focus រមូរចូលមើលឃើញ
 *    (`revealFocusedModalField()` ៖ គម្លាត ≤ `MODAL_FIELD_MARGIN_PX`) · APK (viewport បង្រួម) ➜ គ្មានការប្តូរប្លង់ តែ `resize` បង្ហាញប្រអប់វាយ ·
 *    iPhone standalone ៖ ចុចប្រអប់វាយ (មិនទាន់ focus) ក្នុងប្រអប់ ➜ `focus({ preventScroll: true })` (caret នៅចុង) ➜ iOS មិនរំកិលទំព័រទាំងមូល។
 *    browser ពិតគ្រប់ប្រអប់ ៖ `audit-tools/modal-keyboard-test.js` ។
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { uiState } from '../src/core/state';
import { KEYBOARD_MIN_INSET_PX } from '../src/app/behaviors/chrome-autohide';
import * as modalKeyboard from '../src/app/behaviors/modal-keyboard';
import { Modal } from '../src/app/components/modals/Modal';
import { DocumentEffects } from '../src/app/components/shell/DocumentEffects';
import { commitNow } from '../src/app/flush';
import { focusField, refTo } from '../src/app/refs';
import { BatchScanModal } from '../src/app/components/modals/BatchScanModal';
import { openBatchScanModal } from '../src/features/batch-scan';
import { closeModal, openModalHelper } from '../src/ui/modal';
import { byId, mount, unmount } from './native/react-harness';

const listeners: Array<[EventTarget, string, any, any]> = [];
const disposers: Array<() => void> = [];
const realInnerHeight = window.innerHeight;
let vv: EventTarget & { height: number; offsetTop: number };
let fakeScope: any;

function scope() {
    fakeScope = {
        disposed: false,
        listen(target: EventTarget | null | undefined, type: string, handler: any, options?: any) {
            if (!target) return;
            target.addEventListener(type, handler, options);
            listeners.push([target, type, handler, options]);
        },
        every() {}, onLoad() {}, onDispose(fn: () => void) { disposers.push(fn); }, dispose() {}
    };
    return fakeScope;
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

function box(el: HTMLElement, top: number, height: number) {
    el.getBoundingClientRect = () => rect(top, height);
    Object.defineProperty(el, 'offsetHeight', { configurable: true, value: height });
}

async function settle() {
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    commitNow();
}

function TwoModals() {
    return (
        <>
            <Modal id="manualAdjustModal" style={{ paddingTop: '12px' }}>
                <div className="modal-content" id="mkContent">
                    <input id="mkTop" type="text" />
                    <div id="mkScroll">
                        <input id="mkField" type="tel" />
                        <input id="mkDate" type="date" />
                        <input id="mkCheck" type="checkbox" />
                        <input id="mkReadonly" type="text" readOnly />
                        <textarea id="mkArea" defaultValue="abc" />
                    </div>
                </div>
            </Modal>
            <Modal id="editPhoneModal" style={{ paddingTop: '12px' }}>
                <div className="modal-content" id="mkContent2">
                    <input id="mkPhone" type="tel" />
                </div>
            </Modal>
        </>
    );
}

function setIOSStandalone(on: boolean) {
    Object.defineProperty(window.navigator, 'standalone', { configurable: true, value: on ? true : undefined });
    Object.defineProperty(window, 'CSS', { configurable: true, value: { supports: (p: string, v: string) => on && p === '-webkit-touch-callout' && v === 'none' } });
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
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = false;
    Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: 844 });
    vv = Object.assign(new EventTarget(), { height: 844, offsetTop: 0 });
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: vv });
    setIOSStandalone(false);
    uiState.modalViewportTop = 0;
    uiState.modalViewportHeight = 0;
    uiState.modalKeyboardFit = null;
    uiState.keyboardCover = 0;
});

afterEach(() => {
    disposers.splice(0).forEach((fn) => fn());
    listeners.splice(0).forEach(([t, type, h, o]) => t.removeEventListener(type, h, o));
    ['manualAdjustModal', 'editPhoneModal', 'batchScanModal'].forEach((id) => closeModal(id));
    commitNow();
    unmount();
    uiState.isModalOpen = false;
    uiState.modalViewportTop = 0;
    uiState.modalViewportHeight = 0;
    uiState.modalKeyboardFit = null;
    uiState.keyboardCover = 0;
    setIOSStandalone(false);
    Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: realInnerHeight });
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
});

describe('ប្រអប់ ⟷ keyboard ៖ ផ្ទៃមើលឃើញ (visualViewport)', () => {
    it('⛔ ប្រអប់បើក + keyboard បាំង ≥ KEYBOARD_MIN_INSET_PX ➜ ផ្ទៃមើលឃើញ (top · height) · គម្លាតតូចជាង · ប្រអប់បិទ · គ្មាន visualViewport ➜ null', () => {
        uiState.isModalOpen = true;
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

    it('ទិសផ្ទុយ ៖ តម្លៃខុស (NaN · ០ · អវិជ្ជមាន) មិនបោះ ហើយមិនប្តូរ · offsetTop NaN ➜ ០ · APK (innerHeight = visualViewport) ➜ null', () => {
        uiState.isModalOpen = true;
        for (const bad of [NaN, 0, -10, Infinity]) {
            vv.height = bad;
            expect(() => modalKeyboard.modalKeyboardViewport()).not.toThrow();
            expect(modalKeyboard.modalKeyboardViewport()).toBeNull();
        }
        vv.height = 500;
        vv.offsetTop = NaN;
        expect(modalKeyboard.modalKeyboardViewport()).toEqual({ top: 0, height: 500 });
        Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: 508 });
        vv.height = 508;
        expect(modalKeyboard.modalKeyboardViewport()).toBeNull();
    });
});

describe('ប្រអប់ ⟷ keyboard ៖ ការតម្រូវ (modalKeyboardFitFor)', () => {
    const GAP = modalKeyboard.MODAL_KEYBOARD_GAP_PX;

    it('⛔ ប្រអប់នៅពីលើ keyboard រួច (គ្មានការរំកិល) ➜ null (មិនប្តូរអ្វីទាំងអស់)', () => {
        expect(modalKeyboard.modalKeyboardFitFor({ top: 100, height: 300, pad: 12, cap: 717 }, { top: 0, height: 508 })).toBeNull();
        expect(modalKeyboard.modalKeyboardFitFor({ top: 100, height: 508 - GAP - 100, pad: 12, cap: 717 }, { top: 0, height: 508 })).toBeNull();
    });

    it('⛔ ប្រអប់ខ្លី (PIN · កែលេខ) ដែល keyboard បាំង ➜ ឡើងតែល្មមឲ្យបាតត្រឹម keyboard ➜ ឃើញទាំងមូល (ប៊ូតុងមិនកាត់) · រូបថត iPhone 393×852 · keyboard ៤០០', () => {
        const pin = modalKeyboard.modalKeyboardFitFor({ top: 312, height: 228, pad: 12, cap: 724, safe: 47 }, { top: 0, height: 452 });
        expect(pin).toEqual({ top: 452 - GAP - 228, max: 228, shift: 452 - GAP - 228 - 12 });
        expect(pin!.max).toBeGreaterThanOrEqual(228);
        expect(modalKeyboard.modalKeyboardFitFor({ top: 400, height: 200, pad: 12, cap: 717 }, { top: 0, height: 508 }))
            .toEqual({ top: 300, max: 200, shift: 288 });
    });

    it('⛔ ប្រអប់វែងជាងផ្ទៃពីលើ keyboard ➜ កំពូលនៅកំពូលផ្ទៃមើលឃើញ (padding · ក្រោម status bar + គម្លាត) ⛔ មិនដែលផុតអេក្រង់ · បាតត្រឹម keyboard · រមូរក្នុងខ្លួន', () => {
        expect(modalKeyboard.modalKeyboardFitFor({ top: 63, height: 717, pad: 12, cap: 717 }, { top: 0, height: 508 }))
            .toEqual({ top: 12, max: 508 - GAP - 12, shift: 0 });
        expect(modalKeyboard.modalKeyboardFitFor({ top: 221, height: 410, pad: 12, cap: 724, safe: 47 }, { top: 0, height: 452 }))
            .toEqual({ top: 47 + GAP, max: 452 - GAP - 47 - GAP, shift: 47 + GAP - 12 });
        expect(modalKeyboard.modalKeyboardFitFor({ top: 30, height: 1000, pad: 12, cap: 300 }, { top: 0, height: 700 }))
            .toEqual({ top: 12, max: 300, shift: 0 });
    });

    it('⛔ iOS រំកិល visual viewport (offsetTop) ➜ ប្រអប់ខ្លីនៅទីតាំងលើអេក្រង់ដដែល (កំពូល layout = ដើម + offsetTop) · ប្រអប់វែងនៅកំពូលផ្ទៃមើលឃើញ', () => {
        expect(modalKeyboard.modalKeyboardFitFor({ top: 63, height: 717, pad: 12, cap: 717 }, { top: 140, height: 508 }))
            .toEqual({ top: 152, max: 508 - GAP - 12, shift: 140 });
        const small = modalKeyboard.modalKeyboardFitFor({ top: 100, height: 200, pad: 12, cap: 717 }, { top: 140, height: 508 });
        expect(small).toEqual({ top: 240, max: 140 + 508 - GAP - 240, shift: 228 });
        expect(small!.max).toBeGreaterThanOrEqual(200);
    });

    it('ទិសផ្ទុយ ៖ គ្មាន safe (Android · web) ➜ កំពូលអប្បបរមា = padding · តម្លៃខុសមិនបោះ', () => {
        expect(modalKeyboard.modalKeyboardFitFor({ top: 150, height: 300, pad: 12, cap: 717 }, { top: 0, height: 150 }))
            .toEqual({ top: 12, max: 150 - GAP - 12, shift: 0 });
        expect(modalKeyboard.modalKeyboardFitFor({ top: 150, height: 300, pad: 12, cap: 717, safe: NaN }, { top: 0, height: 150 }))
            .toEqual({ top: 12, max: 150 - GAP - 12, shift: 0 });
        expect(() => modalKeyboard.modalKeyboardFitFor({ top: NaN, height: NaN, pad: NaN, cap: Infinity }, { top: 0, height: 500 })).not.toThrow();
    });
});

describe('ប្រអប់ ⟷ keyboard ៖ listener · state · DOM (Modal ពិត)', () => {
    function openLong(): { modal: HTMLElement; content: HTMLElement } {
        mount(<><DocumentEffects /><TwoModals /></>);
        modalKeyboard.listenModalKeyboard(scope());
        openModalHelper('manualAdjustModal');
        commitNow();
        const modal = byId('manualAdjustModal');
        const content = byId('mkContent');
        box(modal, 0, 844);
        box(content, 63, 717);
        return { modal, content };
    }

    it('⛔ keyboard បើក ➜ body.modal-keyboard · .modal-kb + --modal-kb-shift/max លើប្រអប់នោះ · --modal-kb-pan តាម offsetTop · keyboard បិទ ➜ ដក', async () => {
        const { modal } = openLong();
        await settle();
        byId('mkField').focus();
        keyboard(336);
        expect(uiState.modalViewportHeight).toBe(508);
        expect(document.body.classList.contains('modal-keyboard')).toBe(true);
        expect(uiState.modalKeyboardFit).toEqual({ id: 'manualAdjustModal', top: 12, max: 508 - modalKeyboard.MODAL_KEYBOARD_GAP_PX - 12, shift: 0 });
        expect(modal.classList.contains('modal-kb')).toBe(true);
        expect(modal.style.getPropertyValue('--modal-kb-shift')).toBe('0px');
        expect(modal.style.getPropertyValue('--modal-kb-max')).toBe((508 - modalKeyboard.MODAL_KEYBOARD_GAP_PX - 12) + 'px');
        expect(document.documentElement.style.getPropertyValue('--modal-kb-pan')).toBe('0px');
        expect(document.documentElement.style.getPropertyValue('--modal-kb-line')).toBe('508px');
        vv.offsetTop = 120;
        vv.dispatchEvent(new Event('scroll'));
        expect(uiState.modalViewportTop).toBe(120);
        expect(uiState.modalKeyboardFit!.top).toBe(132);
        expect(document.documentElement.style.getPropertyValue('--modal-kb-pan')).toBe('120px');
        expect(document.documentElement.style.getPropertyValue('--modal-kb-line')).toBe('628px');
        keyboard(0);
        expect(uiState.modalViewportHeight).toBe(0);
        expect(uiState.modalKeyboardFit).toBeNull();
        expect(document.body.classList.contains('modal-keyboard')).toBe(false);
        expect(modal.classList.contains('modal-kb')).toBe(false);
        expect(modal.style.getPropertyValue('--modal-kb-shift')).toBe('');
        expect(document.documentElement.style.getPropertyValue('--modal-kb-pan')).toBe('0px');
        expect(document.documentElement.style.getPropertyValue('--modal-kb-line')).toBe('100%');
    });

    it('⛔ ទីតាំងដើមវាស់ពេលមិនទាន់តម្រូវ ហើយរក្សាទុក (keyboard ប្តូរកម្ពស់មិនវាស់ប្រអប់ដែលបានតម្រូវ) · ប្រអប់ដែលនៅពីលើ keyboard ➜ គ្មាន .modal-kb', async () => {
        const { content } = openLong();
        await settle();
        byId('mkField').focus();
        keyboard(336);
        box(content, 63, 437);
        keyboard(300);
        expect(uiState.modalKeyboardFit).toEqual({ id: 'manualAdjustModal', top: 12, max: 844 - 300 - modalKeyboard.MODAL_KEYBOARD_GAP_PX - 12, shift: 0 });
        keyboard(0);
        box(content, 300, 150);
        keyboard(336);
        expect(uiState.modalViewportHeight).toBe(508);
        expect(uiState.modalKeyboardFit).toBeNull();
        expect(byId('manualAdjustModal').classList.contains('modal-kb')).toBe(false);
    });

    it('⛔ ប្រអប់បិទ (keyboard នៅបើក) ➜ ០ · បើកប្រអប់ខណៈ keyboard បើក ➜ វាស់ក្រោយ React គូរ (microtask) · ជាន់ប្រអប់ ➜ តម្រូវតែប្រអប់ខាងលើគេ (ប្រអប់ដែលមើលឃើញ)', async () => {
        openLong();
        await settle();
        byId('mkField').focus();
        keyboard(336);
        expect(uiState.modalKeyboardFit!.id).toBe('manualAdjustModal');
        openModalHelper('editPhoneModal');
        commitNow();
        box(byId('editPhoneModal'), 0, 844);
        box(byId('mkContent2'), 400, 200);
        await settle();
        expect(uiState.modalKeyboardFit!.id).toBe('editPhoneModal');
        expect(byId('manualAdjustModal').classList.contains('modal-kb')).toBe(false);
        expect(byId('editPhoneModal').classList.contains('modal-kb')).toBe(true);
        closeModal('editPhoneModal');
        await settle();
        expect(uiState.modalKeyboardFit!.id).toBe('manualAdjustModal');
        closeModal('manualAdjustModal');
        await settle();
        expect(uiState.modalViewportHeight).toBe(0);
        expect(uiState.modalKeyboardFit).toBeNull();
        expect(document.body.classList.contains('modal-keyboard')).toBe(false);
        openModalHelper('editPhoneModal');
        await settle();
        expect(uiState.modalViewportHeight).toBe(508);
        expect(uiState.modalKeyboardFit!.id).toBe('editPhoneModal');
    });

    it('⛔ ប្រអប់វាយនៅក្រោមផ្ទៃរមូរ ➜ រមូរឡើងឲ្យឃើញ (គម្លាត MODAL_FIELD_MARGIN_PX) · នៅខាងលើ ➜ រមូរចុះ · មើលឃើញហើយ ➜ មិនប៉ះ', async () => {
        const { content } = openLong();
        await settle();
        scrollable(content, 900, 400);
        content.scrollTop = 0;
        box(content, 50, 400);
        let fieldTop = 600;
        const field = byId('mkField');
        field.getBoundingClientRect = () => rect(fieldTop - content.scrollTop, 40);
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

    it('⛔ អ្នករមូរតូច (ទាបជាងប្រអប់វាយ + គម្លាតពីរ) ➜ គម្លាតបង្រួម ប្រអប់វាយនៅក្នុង · ប្រអប់វាយខ្ពស់ជាងផ្ទៃ ➜ ផ្នែកខាងលើនៅកំពូលផ្ទៃ', async () => {
        const { content } = openLong();
        await settle();
        const inner = byId('mkScroll');
        scrollable(inner, 300, 53);
        inner.scrollTop = 0;
        inner.getBoundingClientRect = () => rect(170, 53);
        const field = byId('mkField');
        field.getBoundingClientRect = () => rect(260 - inner.scrollTop, 46);
        field.focus();
        modalKeyboard.revealFocusedModalField();
        const r = field.getBoundingClientRect();
        expect(r.top).toBeGreaterThanOrEqual(170);
        expect(r.bottom).toBeLessThanOrEqual(223);
        scrollable(content, 900, 300);
        content.scrollTop = 0;
        box(content, 50, 300);
        const area = byId('mkArea');
        area.getBoundingClientRect = () => rect(500 - content.scrollTop, 400);
        area.focus();
        modalKeyboard.revealFocusedModalField();
        expect(area.getBoundingClientRect().top).toBe(50);
    });

    it('⛔ រូបថត iPhone ៖ ប្រអប់ PIN ខ្លី (៣៩៣×៨៥២ · keyboard ៤០០) ➜ ឡើងល្មម ឃើញទាំងមូល · ប្រអប់វែង + status bar (--modal-safe-top) ➜ កំពូលក្រោម status bar + គម្លាត', async () => {
        mount(<><DocumentEffects /><TwoModals /></>);
        modalKeyboard.listenModalKeyboard(scope());
        Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: 852 });
        vv.height = 852;
        openModalHelper('editPhoneModal');
        commitNow();
        const modal = byId('editPhoneModal');
        box(modal, 0, 852);
        box(byId('mkContent2'), 312, 228);
        await settle();
        byId('mkPhone').focus();
        keyboard(400);
        const GAP = modalKeyboard.MODAL_KEYBOARD_GAP_PX;
        expect(uiState.modalKeyboardFit).toEqual({ id: 'editPhoneModal', top: 452 - GAP - 228, max: 228, shift: 452 - GAP - 228 - 12 });
        keyboard(0);
        expect(uiState.modalKeyboardFit).toBeNull();
        box(byId('mkContent2'), 221, 410);
        modal.style.setProperty('--modal-safe-top', '47px');
        keyboard(400);
        expect(uiState.modalKeyboardFit).toEqual({ id: 'editPhoneModal', top: 47 + GAP, max: 452 - GAP - 47 - GAP, shift: 47 + GAP - 12 });
        keyboard(0);
        expect(uiState.modalKeyboardFit).toBeNull();
    });

    it('⛔ APK ៖ WebView បង្រួម (គ្មាន inset) ➜ គ្មាន .modal-kb · resize ➜ ប្រអប់វាយដែល focus រមូរមកមើលឃើញ · focus ក្រៅប្រអប់ ➜ មិនរមូរ', async () => {
        const { content } = openLong();
        await settle();
        scrollable(content, 900, 400);
        content.scrollTop = 0;
        box(content, 30, 400);
        const field = byId('mkField');
        field.getBoundingClientRect = () => rect(700 - content.scrollTop, 40);
        field.focus();
        Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: 508 });
        vv.height = 508;
        vv.dispatchEvent(new Event('resize'));
        window.dispatchEvent(new Event('resize'));
        expect(uiState.modalViewportHeight).toBe(0);
        expect(uiState.modalKeyboardFit).toBeNull();
        expect(content.scrollTop).toBe(700 + 40 - (430 - modalKeyboard.MODAL_FIELD_MARGIN_PX));
        const outside = document.createElement('input');
        document.body.appendChild(outside);
        outside.focus();
        content.scrollTop = 0;
        window.dispatchEvent(new Event('resize'));
        expect(content.scrollTop).toBe(0);
        outside.remove();
    });

    it('ទិសផ្ទុយ ៖ focus ក្រៅប្រអប់ (ឧ. ប្រអប់ស្វែងរក) ➜ មិនរមូរ · dispose ➜ ០ ហើយ listener ដក', async () => {
        const { content } = openLong();
        await settle();
        const outside = document.createElement('input');
        document.body.appendChild(outside);
        scrollable(content, 900, 400);
        outside.focus();
        keyboard(336);
        expect(content.scrollTop).toBe(0);
        disposers.splice(0).forEach((fn) => fn());
        listeners.splice(0).forEach(([t, type, h, o]) => t.removeEventListener(type, h, o));
        expect(uiState.modalViewportHeight).toBe(0);
        expect(uiState.modalKeyboardFit).toBeNull();
        keyboard(300);
        expect(uiState.modalViewportHeight).toBe(0);
        outside.remove();
    });
});

describe('iPhone standalone ៖ ចុចប្រអប់វាយក្នុងប្រអប់ ➜ focus ដោយគ្មានការរំកិលទំព័រ', () => {
    let focusCalls: Array<{ id: string; options: any; caret: number | null }>;
    let refuse: boolean;

    function setup(ios = true) {
        setIOSStandalone(ios);
        mount(<TwoModals />);
        modalKeyboard.listenModalKeyboard(scope());
        openModalHelper('manualAdjustModal');
        commitNow();
        focusCalls = [];
        refuse = false;
        const realFocus = HTMLElement.prototype.focus;
        for (const id of ['mkField', 'mkArea', 'mkDate', 'mkCheck', 'mkReadonly', 'mkTop']) {
            const el = byId(id) as HTMLInputElement;
            el.focus = function (this: HTMLInputElement, options?: any) {
                let caret: number | null;
                try { caret = this.selectionStart; } catch { caret = null; }
                focusCalls.push({ id, options, caret });
                if (!refuse) realFocus.call(this, options);
            } as any;
        }
    }

    it('⛔ ចុច (មិនអូស · ម្រាមដៃមួយ) ប្រអប់វាយដែលមិនទាន់ focus ➜ touchend preventDefault · focus({ preventScroll: true }) · caret នៅចុង', () => {
        setup();
        const area = byId('mkArea') as HTMLTextAreaElement;
        const end = tap(area, { x: 50, y: 300, t: 0 }, { x: 52, y: 303, t: 120 });
        expect(end.defaultPrevented).toBe(true);
        expect(focusCalls).toEqual([{ id: 'mkArea', options: { preventScroll: true }, caret: 3 }]);
        expect(document.activeElement).toBe(area);
        expect(area.selectionStart).toBe(3);
        expect(area.selectionEnd).toBe(3);
        const field = byId('mkField');
        const second = tap(field, { x: 50, y: 200, t: 1000 }, { x: 50, y: 200, t: 1100 });
        expect(second.defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(field);
    });

    it('ទិសផ្ទុយ ៖ ប្រអប់វាយដែល focus រួច · អូស · សង្កត់យូរ · ម្រាមដៃពីរ · date · checkbox · readonly ➜ iOS ធ្វើខ្លួនឯង', () => {
        setup();
        const field = byId('mkField');
        field.focus();
        focusCalls = [];
        expect(tap(field, { x: 50, y: 200, t: 0 }, { x: 50, y: 200, t: 80 }).defaultPrevented).toBe(false);
        field.blur();
        expect(tap(field, { x: 50, y: 200, t: 0 }, { x: 50, y: 200 + modalKeyboard.MODAL_TAP_SLOP_PX + 1, t: 80 }).defaultPrevented).toBe(false);
        expect(tap(field, { x: 50, y: 200, t: 0 }, { x: 50, y: 200, t: modalKeyboard.MODAL_TAP_MAX_MS + 1 }).defaultPrevented).toBe(false);
        expect(tap(field, { x: 50, y: 200, t: 0 }, { x: 50, y: 200, t: 80 }, 2).defaultPrevented).toBe(false);
        for (const id of ['mkDate', 'mkCheck', 'mkReadonly']) {
            expect(tap(byId(id), { x: 50, y: 200, t: 0 }, { x: 50, y: 200, t: 80 }).defaultPrevented).toBe(false);
        }
        expect(focusCalls).toEqual([]);
    });

    it('ទិសផ្ទុយ ៖ មិនមែន iOS standalone (Android · web) ➜ មិនប៉ះ · ប្រអប់បិទ ➜ មិនប៉ះ · ប្រអប់វាយក្រៅប្រអប់ ➜ មិនប៉ះ', () => {
        setup(false);
        expect(tap(byId('mkField'), { x: 50, y: 200, t: 0 }, { x: 50, y: 200, t: 80 }).defaultPrevented).toBe(false);
        setIOSStandalone(true);
        const outside = document.createElement('input');
        document.body.appendChild(outside);
        expect(tap(outside, { x: 50, y: 200, t: 0 }, { x: 50, y: 200, t: 80 }).defaultPrevented).toBe(false);
        outside.remove();
        closeModal('manualAdjustModal');
        commitNow();
        expect(tap(byId('mkField'), { x: 50, y: 200, t: 0 }, { x: 50, y: 200, t: 80 }).defaultPrevented).toBe(false);
        expect(focusCalls).toEqual([]);
    });

    it('⛔ focus មិនជាប់ ➜ ការចុចបន្ទាប់ទុកឲ្យ iOS (fail-open ៖ វាយបានជានិច្ច)', () => {
        setup();
        refuse = true;
        const field = byId('mkField');
        expect(tap(field, { x: 50, y: 200, t: 0 }, { x: 50, y: 200, t: 80 }).defaultPrevented).toBe(true);
        expect(document.activeElement).not.toBe(field);
        refuse = false;
        expect(tap(field, { x: 50, y: 200, t: 1000 }, { x: 50, y: 200, t: 1080 }).defaultPrevented).toBe(false);
        expect(focusCalls.length).toBe(1);
    });
});

describe('toast ⟷ keyboard ៖ ផ្ទៃដែល keyboard បាំង (keyboardCover · --keyboard-cover)', () => {
    function mountEffects() {
        mount(<DocumentEffects />);
        modalKeyboard.listenModalKeyboard(scope());
        commitNow();
    }
    const cssVar = () => document.documentElement.style.getPropertyValue('--keyboard-cover');

    it('⛔ keyboard បើក (គ្មានប្រអប់ក៏ដោយ) ➜ keyboardCover = innerHeight − (offsetTop + height) · --keyboard-cover · បិទ ➜ ០', () => {
        mountEffects();
        expect(uiState.isModalOpen).toBe(false);
        expect(uiState.keyboardCover).toBe(0);
        expect(cssVar()).toBe('0px');
        keyboard(336);
        commitNow();
        expect(uiState.keyboardCover).toBe(336);
        expect(cssVar()).toBe('336px');
        keyboard(336, 140);
        commitNow();
        expect(uiState.keyboardCover).toBe(196);
        expect(cssVar()).toBe('196px');
        keyboard(0);
        commitNow();
        expect(uiState.keyboardCover).toBe(0);
        expect(cssVar()).toBe('0px');
    });

    it('⛔ ប្រអប់បើក + keyboard ➜ toast គ្របដូចគ្នា (ផ្ទៃស្រទាប់ ::after ចាប់ពី --modal-kb-line)', () => {
        mount(<><DocumentEffects /><TwoModals /></>);
        modalKeyboard.listenModalKeyboard(scope());
        openModalHelper('manualAdjustModal');
        commitNow();
        keyboard(336, 120);
        commitNow();
        expect(document.documentElement.style.getPropertyValue('--modal-kb-line')).toBe((120 + 844 - 336) + 'px');
        expect(uiState.keyboardCover).toBe(844 - (120 + 844 - 336));
    });

    it('ទិសផ្ទុយ ៖ គម្លាតតូចជាង KEYBOARD_MIN_INSET_PX · APK (innerHeight = visualViewport) · តម្លៃខុស · គ្មាន visualViewport ➜ ០ មិនបោះ', () => {
        mountEffects();
        keyboard(KEYBOARD_MIN_INSET_PX - 1);
        expect(uiState.keyboardCover).toBe(0);
        keyboard(KEYBOARD_MIN_INSET_PX);
        expect(uiState.keyboardCover).toBe(KEYBOARD_MIN_INSET_PX);
        Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: 508 });
        vv.height = 508;
        vv.offsetTop = 0;
        vv.dispatchEvent(new Event('resize'));
        expect(uiState.keyboardCover).toBe(0);
        for (const bad of [NaN, 0, -10, Infinity]) {
            vv.height = bad;
            expect(() => vv.dispatchEvent(new Event('resize'))).not.toThrow();
            expect(uiState.keyboardCover).toBe(0);
        }
        Object.defineProperty(window, 'visualViewport', { configurable: true, value: undefined });
        expect(() => modalKeyboard.measureKeyboardCover()).not.toThrow();
        expect(uiState.keyboardCover).toBe(0);
    });

    it('⛔ dispose ➜ ០ · listen ម្តងទៀតចាប់ផ្តើមពី ០ ហើយវាស់ភ្លាម (keyboard បើករួច)', () => {
        mountEffects();
        keyboard(336);
        expect(uiState.keyboardCover).toBe(336);
        disposers.splice(0).forEach((fn) => fn());
        listeners.splice(0).forEach(([t, type, h, o]) => t.removeEventListener(type, h, o));
        expect(uiState.keyboardCover).toBe(0);
        modalKeyboard.listenModalKeyboard(scope());
        expect(uiState.keyboardCover).toBe(336);
    });
});

describe('ប្រអប់ ⟷ keyboard ៖ focus ដោយកូដមិនរំកិលទំព័រ (រាយការណ៍ម្ចាស់គម្រោង ៖ «បញ្ចូលច្រើន» ពេលខ្លះទំព័ររអិលឡើង navbar បាត់)', () => {
    it('⛔ focusField() លើប្រអប់វាយក្នុង .modal ➜ focus({ preventScroll: true }) ជានិច្ច (iOS មិនរំកិល document) · ក្រៅប្រអប់ ➜ options ដដែល', () => {
        mount(<><BatchScanModal /><input id="mkOutside" ref={refTo('hwScannerInput')} /></>);
        openModalHelper('batchScanModal');
        commitNow();
        const calls: Array<{ id: string; options: any }> = [];
        const spy = vi.spyOn(HTMLElement.prototype, 'focus').mockImplementation(function (this: HTMLElement, options?: any) { calls.push({ id: this.id, options }); });
        focusField('batchBarcodeInput');
        focusField('batchBarcodeInput', { focusVisible: true } as any);
        focusField('hwScannerInput');
        focusField('hwScannerInput', { preventScroll: false });
        spy.mockRestore();
        expect(calls).toEqual([
            { id: 'batchBarcodeInput', options: { preventScroll: true } },
            { id: 'batchBarcodeInput', options: { focusVisible: true, preventScroll: true } },
            { id: 'mkOutside', options: undefined },
            { id: 'mkOutside', options: { preventScroll: false } }
        ]);
    });

    it('⛔ openBatchScanModal() (focus ក្រោយ ១៥០ms ដើម្បីម៉ាស៊ីនស្កេន) ➜ preventScroll', () => {
        vi.useFakeTimers();
        try {
            mount(<BatchScanModal />);
            uiState.entryScanMode = 'parcel';
            const calls: any[] = [];
            const spy = vi.spyOn(HTMLElement.prototype, 'focus').mockImplementation(function (this: HTMLElement, options?: any) { calls.push([this.id, options]); });
            openBatchScanModal();
            vi.advanceTimersByTime(200);
            spy.mockRestore();
            expect(calls).toEqual([['batchBarcodeInput', { preventScroll: true }]]);
        } finally {
            closeModal('batchScanModal');
            vi.useRealTimers();
        }
    });
});

describe('ខ្សែភ្ជាប់', () => {
    it('⛔ boot ចាក់ listenModalKeyboard · react-root.css ៖ backdrop ::after (safe-area · keyboard ➜ ស្រទាប់ពណ៌តែមួយពី --modal-kb-line ចុះក្រោម) · .modal-kb កំពូល/max-height ពីអថេរ · DocumentEffects', () => {
        const root = path.resolve(__dirname, '..');
        const boot = readFileSync(path.join(root, 'src/app/lifecycle/boot.ts'), 'utf8');
        expect(/listenModalKeyboard\(scope\)/.test(boot)).toBe(true);
        const css = readFileSync(path.join(root, 'src/styles/react-root.css'), 'utf8');
        expect(/\.modal::after \{ content: ''; position: absolute; left: 0; right: 0; top: 100%; height: env\(safe-area-inset-bottom, 0px\); background: inherit;/.test(css)).toBe(true);
        expect(/body\.modal-keyboard \.modal::after \{ top: var\(--modal-kb-line, 100%\); height: auto; bottom: calc\(0px - var\(--modal-kb-pan, 0px\) - env\(safe-area-inset-bottom, 0px\)\); background: linear-gradient\(rgba\(15, 23, 42, 0\.6\), rgba\(15, 23, 42, 0\.6\)\), var\(--body-bg\);/.test(css)).toBe(true);
        expect(/\.modal\.modal-kb \{ align-items: flex-start; \}/.test(css)).toBe(true);
        expect(/\.modal\.modal-kb > \.modal-content \{ margin-top: var\(--modal-kb-shift, 0px\); max-height: var\(--modal-kb-max, 85vh\); \}/.test(css)).toBe(true);
        expect(/--modal-vv-/.test(css)).toBe(false);
        expect(/@property --modal-safe-top \{\s*syntax: '<length>';\s*inherits: false;\s*initial-value: 0px;\s*\}/.test(css)).toBe(true);
        expect(/\.modal \{ --modal-safe-top: env\(safe-area-inset-top, 0px\); \}/.test(css)).toBe(true);
        const fx = readFileSync(path.join(root, 'src/app/components/shell/DocumentEffects.tsx'), 'utf8');
        expect(/useBodyClass\('modal-keyboard', modalViewportHeight > 0\)/.test(fx)).toBe(true);
        expect(/useHtmlVar\('--modal-kb-pan', modalViewportHeight > 0 \? modalViewportTop \+ 'px' : '0px'\)/.test(fx)).toBe(true);
        expect(/useHtmlVar\('--modal-kb-line', modalViewportHeight > 0 \? \(modalViewportTop \+ modalViewportHeight\) \+ 'px' : '100%'\)/.test(fx)).toBe(true);
        expect(/useHtmlVar\('--keyboard-cover', keyboardCover > 0 \? keyboardCover \+ 'px' : '0px'\)/.test(fx)).toBe(true);
        expect(/\.toast-container \{ bottom: calc\(24px \+ max\(env\(safe-area-inset-bottom, 0px\), var\(--keyboard-cover, 0px\)\)\); \}/.test(css)).toBe(true);
    });
});
