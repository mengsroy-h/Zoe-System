/**
 * ⛔ Scrollbar លើ APK និង iPhone PWA (សំណើម្ចាស់គម្រោង ៖ «PWA Android មានហើយ · ដាក់តូចកុំបាំងអីផ្សេង»)
 *    iOS WebKit មិនគូរ `::-webkit-scrollbar` ➜ App គូរខ្សែស្តើង ៣px ខ្លួនឯង ៖ លេចពេលរមូរបញ្ឈរ · បាត់ក្រោយស្ងៀម ·
 *    `pointer-events: none` · មិនប្តូរ layout · មិនជាន់របា Tab/navbar (លើកលែងក្នុង modal/drawer) ·
 *    ⛔ web/PWA Android/desktop មិនប៉ះ (គ្មាន listener · គ្មានធាតុ)។
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { scrollThumbState, uiState } from '../src/core/state';
import {
    SCROLL_THUMB_IDLE_MS, SCROLL_THUMB_MIN_PX, scrollThumbBand, scrollThumbGeometry, setupScrollThumb
} from '../src/app/behaviors/scroll-thumb';
import { ScrollThumb } from '../src/app/components/shell/ScrollThumb';
import { mount, step, unmount } from './native/react-harness';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function fakeScroller(opts: { scrollHeight: number; clientHeight: number; top: number; rect: { top: number; bottom: number; right: number } }, parent?: HTMLElement) {
    const el = document.createElement('div');
    el.style.overflowY = 'auto';
    let top = opts.top;
    Object.defineProperty(el, 'scrollHeight', { configurable: true, get: () => opts.scrollHeight });
    Object.defineProperty(el, 'clientHeight', { configurable: true, get: () => opts.clientHeight });
    Object.defineProperty(el, 'scrollTop', { configurable: true, get: () => top, set: (v) => { top = v; } });
    el.getBoundingClientRect = () => ({ top: opts.rect.top, bottom: opts.rect.bottom, right: opts.rect.right, left: 0, width: opts.rect.right, height: opts.rect.bottom - opts.rect.top, x: 0, y: opts.rect.top, toJSON() {} }) as DOMRect;
    (parent || document.body).appendChild(el);
    return el;
}

async function scrollTo(el: HTMLElement, top: number) {
    el.scrollTop = top;
    el.dispatchEvent(new Event('scroll'));
    await wait(40);
    step(() => {});
}

describe('ខ្សែ scrollbar ស្តើង (APK · iPhone PWA)', () => {
    it('ធរណីមាត្រ ៖ កម្ពស់សមាមាត្រ · អប្បបរមា ២៤px · ចុង/ដើម · មិនរមូរ ➜ គ្មាន', () => {
        const rect = { top: 100, bottom: 300, right: 380 };
        const band = scrollThumbBand(rect, 800, false, 60, 50)!;
        expect(band).toEqual({ top: 102, bottom: 298 });
        expect(scrollThumbGeometry(rect, band, 400, 1000, 200)).toEqual({ x: 375, y: 181, h: 39 });
        expect(scrollThumbGeometry(rect, band, 0, 1000, 200)!.y).toBe(102);
        expect(scrollThumbGeometry(rect, band, 800, 1000, 200)!.y).toBe(298 - 39);
        expect(scrollThumbGeometry(rect, band, 0, 100000, 200)!.h).toBe(SCROLL_THUMB_MIN_PX);
        expect(scrollThumbGeometry(rect, band, 0, 200, 200)).toBe(null);
        expect(scrollThumbGeometry(rect, null, 0, 1000, 200)).toBe(null);
    });

    it('មិនជាន់ navbar/របា Tab ៖ ផ្ទាំងរមូរពេញអេក្រង់ ➜ ខ្សែនៅចន្លោះ chrome · ក្នុង modal ➜ ពេញអេក្រង់', () => {
        const full = { top: 0, bottom: 800, right: 390 };
        expect(scrollThumbBand(full, 800, false, 60, 50)).toEqual({ top: 62, bottom: 748 });
        expect(scrollThumbBand(full, 800, true, 60, 50)).toEqual({ top: 2, bottom: 798 });
        expect(scrollThumbBand({ top: 790, bottom: 900, right: 390 }, 800, false, 60, 50)).toBe(null);
    });

    it('CSS ពិត ៖ មិនចាប់ការចុច · ទទឹង ៣px · លាក់លំនាំដើម · មិនមាន animation infinite', () => {
        const css = fs.readFileSync(path.join(__dirname, '..', 'src', 'styles', 'react-root.css'), 'utf8');
        const block = (css.match(/\n\.scroll-thumb \{([^}]*)\}/) || [])[1] || '';
        expect(block).toMatch(/pointer-events: none;/);
        expect(block).toMatch(/width: 3px;/);
        expect(block).toMatch(/position: fixed;/);
        expect(block).toMatch(/opacity: 0;/);
        expect(css).not.toMatch(/scroll-thumb[^{]*\{[^}]*infinite/);
    });

    it('⛔ web/PWA Android ៖ មិនដំឡើង · គ្មានធាតុ · ការរមូរមិនប្តូរ state', async () => {
        expect(setupScrollThumb()).toBe(false);
        mount(<ScrollThumb />);
        const el = fakeScroller({ scrollHeight: 1000, clientHeight: 200, top: 0, rect: { top: 100, bottom: 300, right: 380 } });
        await scrollTo(el, 300);
        expect(scrollThumbState.view).toBe(null);
        expect(document.querySelector('.scroll-thumb')).toBe(null);
        unmount();
        el.remove();
    });

    describe('iPhone PWA (navigator.standalone)', () => {
        beforeAll(() => {
            Object.defineProperty(window.navigator, 'standalone', { configurable: true, value: true });
            uiState.chromeTopVar = '60px';
            uiState.tabbarHeightVar = '50px';
            uiState.chromeHidden = false;
            uiState.isModalOpen = false;
            expect(setupScrollThumb()).toBe(true);
            mount(<ScrollThumb />);
        });
        afterAll(() => {
            unmount();
            delete (window.navigator as any).standalone;
        });

        it('រមូរបញ្ឈរ ➜ ខ្សែលេចត្រង់គែមស្តាំ · ស្តើង · មិនចាប់ការចុច', async () => {
            const el = fakeScroller({ scrollHeight: 1000, clientHeight: 200, top: 0, rect: { top: 100, bottom: 300, right: 380 } });
            await scrollTo(el, 400);
            expect(scrollThumbState.view).toEqual({ x: 375, y: 181, h: 39, shown: true });
            const thumb = document.querySelector('.scroll-thumb') as HTMLElement;
            expect(thumb).toBeTruthy();
            expect(thumb.className).toBe('scroll-thumb shown');
            expect(thumb.getAttribute('aria-hidden')).toBe('true');
            expect(thumb.style.transform).toBe('translate3d(375px, 181px, 0)');
            expect(thumb.style.height).toBe('39px');
            el.remove();
        });

        it('ស្ងៀម ➜ បាត់វិញ (ធាតុនៅ តែ opacity 0) · រមូរផ្តេកតែប៉ុណ្ណោះ ➜ មិនលេចឡើងវិញ', async () => {
            const el = fakeScroller({ scrollHeight: 1000, clientHeight: 200, top: 0, rect: { top: 100, bottom: 300, right: 380 } });
            await scrollTo(el, 100);
            expect(scrollThumbState.view!.shown).toBe(true);
            await wait(SCROLL_THUMB_IDLE_MS + 60);
            step(() => {});
            expect(scrollThumbState.view!.shown).toBe(false);
            expect((document.querySelector('.scroll-thumb') as HTMLElement).className).toBe('scroll-thumb');
            el.dispatchEvent(new Event('scroll'));
            await wait(40);
            expect(scrollThumbState.view!.shown).toBe(false);
            el.remove();
        });

        it('ធាតុមិនរមូរ (មាតិកាខ្លី) ➜ មិនលេច', async () => {
            await wait(SCROLL_THUMB_IDLE_MS + 60);
            const before = scrollThumbState.view;
            const el = fakeScroller({ scrollHeight: 200, clientHeight: 200, top: 0, rect: { top: 100, bottom: 300, right: 380 } });
            await scrollTo(el, 0);
            expect(scrollThumbState.view).toBe(before);
            el.remove();
        });

        it('បញ្ជីក្នុង modal ➜ ខ្សែប្រើកម្ពស់ modal ពេញ (មិនកាត់ដោយ chrome)', async () => {
            const modal = document.createElement('div');
            modal.className = 'modal';
            document.body.appendChild(modal);
            const el = fakeScroller({ scrollHeight: 2000, clientHeight: 760, top: 0, rect: { top: 20, bottom: 780, right: 360 } }, modal);
            await scrollTo(el, 1240);
            const v = scrollThumbState.view!;
            expect(v.shown).toBe(true);
            expect(v.y + v.h).toBe(Math.min(780, window.innerHeight) - 2);
            expect(window.innerHeight - 50).toBeLessThan(Math.min(780, window.innerHeight) - 2);
            modal.remove();
        });
    });
});
