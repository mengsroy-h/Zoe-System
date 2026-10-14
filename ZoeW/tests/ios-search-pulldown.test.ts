/**
 * ⛔ រាយការណ៍ម្ចាស់គម្រោង (រូបថត iPhone PWA ក្រោយ 2.50.65) ៖ ស្វែងរកលេខ ➜ ចុចបិទ keyboard ➜ ទំព័ររំកិលឡើង ➜ ប្រអប់ស្វែងរកលាក់ក្រោម navbar (Android ត្រឹមត្រូវ ៖
 *    Chromium វាស់បាន `#appPages.scrollTop = 0` ក្រោយទាញចុះ · WebKit ទុកទីតាំងផ្សេង)។
 * ⛔ ច្បាប់ ៖ iOS standalone · ទូរស័ព្ទ ៖ ប្រអប់ស្វែងរកទាញចុះ (`dataPanelSearchFocus` true ➜ false) ➜ `#appPages` ត្រឡប់ ០ (ប្រអប់ស្វែងរកឃើញពេញ) ក្នុង microtask ដដែល
 *    ហើយការរអិលចាប់ផ្តើមឡើងវិញពីទីតាំងដែលឃើញ (`panelGlideFrom` លើកាតស្វែងរក + កាតបញ្ជី · មិនលោត) · ក្រោយ `IOS_SEARCH_PULLDOWN_SETTLE_MS` បើ WebKit រំកិលម្តងទៀត
 *    (keyboard បិទយឺត) ➜ ០ ម្តងទៀត — ⛔ មិនប៉ះពេលមានម្រាមដៃប៉ះក្នុងចន្លោះនោះ · ប្រអប់ទាញឡើងវិញ · ប្រអប់នៅ focus · scrollTop = 0 រួច · Android/web · អេក្រង់ធំ។
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { uiState } from '../src/core/state';
import { refTo } from '../src/app/refs';
import * as panelMotion from '../src/app/behaviors/panel-motion';
import * as iosViewport from '../src/app/behaviors/ios-viewport';

const listeners: Array<[EventTarget, string, any, any]> = [];
const disposers: Array<() => void> = [];
const realInnerWidth = window.innerWidth;
let pages: HTMLElement;
let card: HTMLElement;
let main: HTMLElement;
let input: HTMLInputElement;
let glide: ReturnType<typeof vi.spyOn>;

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

function setWidth(w: number) {
    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: w });
}

function rect(el: HTMLElement, top: number) {
    el.getBoundingClientRect = () => ({ top, bottom: top + 80, left: 0, right: 390, width: 390, height: 80, x: 0, y: top, toJSON() {} }) as DOMRect;
}

function boot() {
    (iosViewport as any).listenIOSKeyboard(scope());
}

function pullUpThenDown(scrollTopAfterLayout: number) {
    uiState.dataPanelSearchFocus = true;
    uiState.flush();
    pages.scrollTop = scrollTopAfterLayout;
    rect(card, -37);
    rect(main, 59);
    uiState.dataPanelSearchFocus = false;
    uiState.flush();
}

beforeEach(() => {
    vi.useFakeTimers();
    setIOSStandalone(true);
    setWidth(390);
    uiState.dataPanelSearchFocus = false;
    pages = document.createElement('div');
    card = document.createElement('div');
    main = document.createElement('div');
    input = document.createElement('input');
    card.appendChild(input);
    pages.append(card, main);
    document.body.appendChild(pages);
    Object.defineProperty(pages, 'scrollTop', { configurable: true, writable: true, value: 0 });
    refTo('appPages')(pages);
    refTo('dataSearchCard')(card);
    refTo('dataMainSection')(main);
    refTo('searchPhoneInput')(input);
    glide = vi.spyOn(panelMotion, 'panelGlideFrom').mockImplementation(() => null);
});

afterEach(() => {
    disposers.splice(0).forEach((fn) => fn());
    listeners.splice(0).forEach(([t, type, h, o]) => t.removeEventListener(type, h, o));
    vi.restoreAllMocks();
    vi.useRealTimers();
    refTo('appPages')(null);
    refTo('dataSearchCard')(null);
    refTo('dataMainSection')(null);
    refTo('searchPhoneInput')(null);
    pages.remove();
    uiState.dataPanelSearchFocus = false;
    setWidth(realInnerWidth);
    setIOSStandalone(false);
});

describe('iPhone PWA ៖ បិទ keyboard ក្រោយស្វែងរក ➜ ប្រអប់ស្វែងរកនៅឃើញ (#appPages ត្រឡប់ ០)', () => {
    it('⛔ ទាញចុះខណៈ #appPages រំកិលរួច ➜ scrollTop 0 ក្នុង flush ដដែល · ការរអិលចាប់ផ្តើមឡើងវិញពីទីតាំងដែលឃើញ (កាតស្វែងរក · កាតបញ្ជី · ចលនាស្វែងរក)', () => {
        boot();
        pullUpThenDown(411);
        expect(pages.scrollTop).toBe(0);
        expect(glide).toHaveBeenCalledTimes(2);
        expect(glide.mock.calls[0]).toEqual([card, -37, panelMotion.PANEL_SEARCH_GLIDE]);
        expect(glide.mock.calls[1]).toEqual([main, 59, panelMotion.PANEL_SEARCH_GLIDE]);
    });

    it('⛔ WebKit រំកិលម្តងទៀតក្រោយការរអិល (keyboard បិទយឺត) ➜ ០ ម្តងទៀតនៅ IOS_SEARCH_PULLDOWN_SETTLE_MS · មិនរអិលទៀត', () => {
        boot();
        pullUpThenDown(0);
        expect(glide).not.toHaveBeenCalled();
        pages.scrollTop = 300;
        vi.advanceTimersByTime(iosViewport.IOS_SEARCH_PULLDOWN_SETTLE_MS - 1);
        expect(pages.scrollTop).toBe(300);
        vi.advanceTimersByTime(1);
        expect(pages.scrollTop).toBe(0);
        expect(glide).not.toHaveBeenCalled();
        expect(iosViewport.IOS_SEARCH_PULLDOWN_SETTLE_MS).toBeGreaterThan(panelMotion.PANEL_SEARCH_GLIDE_MS + panelMotion.PANEL_GLIDE_HOLD_MAX_MS + panelMotion.PANEL_GLIDE_SNAP_GRACE_MS);
    });

    it('ទិសផ្ទុយ ៖ ម្រាមដៃប៉ះក្នុងចន្លោះ (អ្នកប្រើអូសខ្លួនឯង) · ទាញឡើងវិញ · ប្រអប់នៅ focus ➜ ការពិនិត្យយឺតមិនប៉ះ', () => {
        boot();
        pullUpThenDown(0);
        pages.scrollTop = 300;
        const ev = new Event('touchstart', { bubbles: true, cancelable: true });
        Object.defineProperty(ev, 'touches', { value: [{ identifier: 1, clientX: 10, clientY: 10, target: main }] });
        main.dispatchEvent(ev);
        vi.advanceTimersByTime(iosViewport.IOS_SEARCH_PULLDOWN_SETTLE_MS);
        expect(pages.scrollTop).toBe(300);

        pullUpThenDown(0);
        pages.scrollTop = 300;
        uiState.dataPanelSearchFocus = true;
        uiState.flush();
        vi.advanceTimersByTime(iosViewport.IOS_SEARCH_PULLDOWN_SETTLE_MS);
        expect(pages.scrollTop).toBe(300);
        uiState.dataPanelSearchFocus = false;
        uiState.flush();
        expect(pages.scrollTop).toBe(0);

        pullUpThenDown(0);
        pages.scrollTop = 300;
        input.focus();
        vi.advanceTimersByTime(iosViewport.IOS_SEARCH_PULLDOWN_SETTLE_MS);
        expect(pages.scrollTop).toBe(300);
    });

    it('ទិសផ្ទុយ ៖ Android/web (មិនមែន iOS standalone) · អេក្រង់ធំ ➜ scrollTop មិនប៉ះ · គ្មានការរអិល', () => {
        setIOSStandalone(false);
        boot();
        pullUpThenDown(411);
        expect(pages.scrollTop).toBe(411);
        expect(glide).not.toHaveBeenCalled();
        disposers.splice(0).forEach((fn) => fn());
        listeners.splice(0).forEach(([t, type, h, o]) => t.removeEventListener(type, h, o));

        setIOSStandalone(true);
        setWidth(1024);
        boot();
        pullUpThenDown(411);
        expect(pages.scrollTop).toBe(411);
        expect(glide).not.toHaveBeenCalled();
    });

    it('⛔ ខ្សែភ្ជាប់ ៖ ios-viewport.ts សរសេរ scroll តាម refs (setElementScrollTop) · ដាក់ជាប់ក្នុង listenIOSKeyboard (boot)', async () => {
        const { readFileSync } = await import('node:fs');
        const path = await import('node:path');
        const src = readFileSync(path.resolve(__dirname, '../src/app/behaviors/ios-viewport.ts'), 'utf8');
        expect(/setElementScrollTop\(pages, 0\)/.test(src)).toBe(true);
        expect(/\.scrollTop\s*=/.test(src)).toBe(false);
        expect(/function listenIOSKeyboard[\s\S]*noteIOSSearchPullState\(\)/.test(src)).toBe(true);
    });
});
