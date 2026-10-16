/**
 * ⛔ វីដេអូម្ចាស់គម្រោង (iPhone · App លើ Home Screen · ស្កេនដក) ៖ «ពេលកំពុង focus នៅកន្លែងវាយបញ្ចូល តែខ្ញុំសាកចុចក្នុងប្រអប់ស្វែងរក
 *    វាកាន់តែរុញទំព័រទៅលើ បាត់ navbar · ios មិនជាប់ល្អដូច android សោះ»។
 *    វាស់ពីវីដេអូ ៖ របៀបដក ប្រអប់វាយ Barcode ចប់ ៥២% នៃអេក្រង់ (ក្រោម banner ដក) ➜ keyboard ពិតបាំង ➜ App ទុកឲ្យ iOS ➜ iOS រំកិល **document**
 *    ១៤៦pt (ប្រអប់នៅកណ្តាល · navbar ចេញពីអេក្រង់) ➜ ចុចស្វែងរក ➜ ផ្ទាំងបង្រួមលើ document ដែលនៅរំកិល ➜ ប្រអប់ស្វែងរកនៅក្រោមរបាស្ថានភាព (១៥០pt)។
 *    Android ៖ ផ្ទៃ WebView បង្រួម ➜ Chromium រំកិល `#appPages` (ធុងរមូរខាងក្នុង) ➜ navbar នៅនឹងកន្លែង។
 *    snap ៖ `#appPages` មាន `scroll-snap-type: y proximity` ➜ browser ពិត (Chromium វាស់ក្នុង device-test) ទាញ scrollTop ១៨ ត្រឡប់ ០ ភ្លាម ·
 *    ពេល snap ផ្អាក (`panel-gliding`) ➜ នៅ ១៨ · snap បើកវិញ ➜ ០ ➜ គំរូខាងក្រោម ៖ snap បើក ➜ ទីតាំងជិតបំផុត ០ ឬ `.page-main`។
 * ⛔ ច្បាប់ (iOS standalone · ទូរស័ព្ទ < 992 · គ្មានប្រអប់) ៖ ចុចប្រអប់វាយ Barcode ដែល keyboard នឹងបាំង ➜ App ចាប់ (preventDefault + focus({ preventScroll }))
 *    ហើយលើក **`#appPages`** ឡើងត្រឹមតែត្រូវការ (បាតប្រអប់ + គម្លាត ≤ បន្ទាត់ keyboard ដែលធ្លាប់វាស់) ➜ document នៅ ០ · navbar នៅនឹង ·
 *    keyboard ស្ងប់ខ្ពស់ជាងការប៉ាន់ ➜ លើកបន្ថែម (មិនចុះ) · ចុច ✓/blur ➜ `#appPages` ចុះវិញត្រឹមចំនួនដែលលើក · ចុចស្វែងរក ➜ ផ្ទាំងបង្រួម (scrollTop ០) ➜ App
 *    មិនសរសេរ scroll ទៀត · គ្មានចន្លោះលើក (ប្រអប់នឹងឡើងក្រោម navbar · ធុងរមូរមិនគ្រប់) ➜ ទុកឲ្យ iOS ដូចមុន · Android មិនប៉ះ។
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { uiState } from '../src/core/state';
import * as modalKeyboard from '../src/app/behaviors/modal-keyboard';
import { listenIOSSearchFocus } from '../src/app/behaviors/ios-viewport';
import { listenEntrySearchPanel } from '../src/app/behaviors/entry-search';
import { refTo } from '../src/app/refs';

const NAV_BOTTOM = 110;
const SIDE_H = 400;
const FIELD_AT = 300;
const FIELD_H = 33;
const VIEW_H = 682;
const W = 393;
const H = 852;

const listeners: Array<[EventTarget, string, any, any]> = [];
const disposers: Array<() => void> = [];
let vv: EventTarget & { height: number; offsetTop: number; scale: number };
let box: HTMLElement;
let pages: HTMLElement;
let side: HTMLElement;
let main: HTMLElement;
let scanner: HTMLInputElement;
let search: HTMLInputElement;
let label: HTMLElement;
let st = 0;
let writes = 0;
let written: number[] = [];
let clock = 10000;
let scrollTo: ReturnType<typeof vi.spyOn>;

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
    return { top, bottom: top + height, left: 0, right: W, width: W, height, x: 0, y: top, toJSON() {} } as DOMRect;
}

const sideH = () => (uiState.entryPanelCollapsed ? 0 : SIDE_H);
const maxScroll = () => sideH();

function setIOSStandalone(on: boolean) {
    Object.defineProperty(window.navigator, 'standalone', { configurable: true, value: on ? true : undefined });
    Object.defineProperty(window, 'CSS', { configurable: true, value: { supports: (p: string, v: string) => on && p === '-webkit-touch-callout' && v === 'none' } });
}

function setAndroid(on: boolean) {
    Object.defineProperty(window.navigator, 'userAgentData', { configurable: true, value: on ? { mobile: true, platform: 'Android', brands: [] } : undefined });
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

function tap(target: EventTarget, y = 400) {
    touch('touchstart', target, y, 1);
    clock += 80;
    return touch('touchend', target, y, 0);
}

function keyboard(inset: number) {
    vv.height = H - inset;
    vv.dispatchEvent(new Event('resize'));
}

function remember(inset: number) {
    localStorage.setItem('zoew_keyboard_inset_v1', JSON.stringify({ [W + 'x' + H + '|text']: inset }));
}

const fieldBottom = () => scanner.getBoundingClientRect().bottom;

beforeEach(() => {
    vi.useFakeTimers();
    clock = 10000;
    st = 0;
    writes = 0;
    written = [];
    vi.spyOn(performance, 'now').mockImplementation(() => clock);
    try { localStorage.removeItem('zoew_keyboard_inset_v1'); } catch {}
    Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: H });
    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: W });
    vv = Object.assign(new EventTarget(), { height: H, offsetTop: 0, scale: 1 });
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: vv });
    scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    setIOSStandalone(true);
    setAndroid(false);
    uiState.isModalOpen = false;
    uiState.modalDisplay = {};
    uiState.currentAppPage = 'entry';
    uiState.entryPanelCollapsed = false;
    uiState.entrySearchActive = false;
    box = document.createElement('div');
    box.innerHTML = '<div id="appPages"><section id="entrySideSection"><label for="hwScannerInput" id="hardwareScannerLabel">ស្កេន Barcode ដែលត្រូវដក</label>' +
        '<div class="scanner-input-wrapper"><span class="icon">⚡</span><input type="text" id="hwScannerInput"></div></section>' +
        '<section id="entryMainSection"><input type="text" id="entryListSearchInput"></section></div>';
    document.body.append(box);
    pages = box.querySelector('#appPages') as HTMLElement;
    side = box.querySelector('#entrySideSection') as HTMLElement;
    main = box.querySelector('#entryMainSection') as HTMLElement;
    scanner = box.querySelector('#hwScannerInput') as HTMLInputElement;
    search = box.querySelector('#entryListSearchInput') as HTMLInputElement;
    label = box.querySelector('#hardwareScannerLabel') as HTMLElement;
    const snap = (v: number) => (uiState.panelGliding ? v : (Math.abs(sideH() - v) < v ? sideH() : 0));
    Object.defineProperty(pages, 'scrollTop', {
        configurable: true,
        get() { st = snap(Math.min(Math.max(0, st), maxScroll())); return st; },
        set(v: number) { writes++; written.push(Number(v)); st = snap(Math.min(Math.max(0, Number(v) || 0), maxScroll())); }
    });
    Object.defineProperty(pages, 'clientHeight', { configurable: true, get: () => VIEW_H });
    Object.defineProperty(pages, 'scrollHeight', { configurable: true, get: () => sideH() + VIEW_H });
    pages.getBoundingClientRect = () => rect(NAV_BOTTOM, VIEW_H);
    side.getBoundingClientRect = () => rect(NAV_BOTTOM - pages.scrollTop, sideH());
    main.getBoundingClientRect = () => rect(NAV_BOTTOM + sideH() - pages.scrollTop, VIEW_H);
    scanner.getBoundingClientRect = () => (uiState.entryPanelCollapsed ? rect(0, 0) : rect(NAV_BOTTOM + FIELD_AT - pages.scrollTop, FIELD_H));
    search.getBoundingClientRect = () => rect(main.getBoundingClientRect().top + 40, 40);
    for (const el of [side, main]) {
        (el as any).animate = () => ({ finished: Promise.resolve(), playState: 'running', pause() {}, play() {}, cancel() {} });
    }
    refTo('appPages')(pages);
    refTo('entrySideSection')(side);
    refTo('entryMainSection')(main);
    refTo('hwScannerInput')(scanner);
    refTo('entryListSearchInput')(search);
    modalKeyboard.listenModalKeyboard(scope());
    listenEntrySearchPanel(scope());
    listenIOSSearchFocus(scope());
});

afterEach(() => {
    disposers.splice(0).forEach((fn) => fn());
    listeners.splice(0).forEach(([t, type, h, o]) => t.removeEventListener(type, h, o));
    for (const name of ['appPages', 'entrySideSection', 'entryMainSection', 'hwScannerInput', 'entryListSearchInput'] as const) refTo(name)(null);
    box.remove();
    setIOSStandalone(false);
    setAndroid(false);
    uiState.currentAppPage = 'data';
    uiState.entryPanelCollapsed = false;
    uiState.entrySearchActive = false;
    try { localStorage.removeItem('zoew_keyboard_inset_v1'); } catch {}
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe('⛔ iPhone standalone ៖ ប្រអប់វាយ Barcode ដែល keyboard នឹងបាំង ➜ លើក #appPages (navbar នៅនឹង · document ០)', () => {
    it('⛔ keyboard ធ្លាប់វាស់ ៤២០ ➜ ប្រអប់ចប់ ៤៤៣ > បន្ទាត់ ៤៣២ ➜ ចាប់ · focus({ preventScroll }) · #appPages ឡើង ១៩ · document មិនប៉ះ', () => {
        remember(420);
        const line = H - 420;
        expect(fieldBottom() + modalKeyboard.MODAL_KEYBOARD_GAP_PX).toBeGreaterThan(line);
        const focus = vi.spyOn(scanner, 'focus');
        const end = tap(scanner);
        expect(end.defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(scanner);
        expect(focus).toHaveBeenCalledWith({ preventScroll: true });
        expect(pages.scrollTop).toBe(NAV_BOTTOM + FIELD_AT + FIELD_H + modalKeyboard.MODAL_KEYBOARD_GAP_PX - line);
        expect(scanner.getBoundingClientRect().top).toBeGreaterThanOrEqual(NAV_BOTTOM);
        keyboard(420);
        vi.advanceTimersByTime(modalKeyboard.IOS_KEYBOARD_SETTLE_MS + 50);
        expect(fieldBottom() + modalKeyboard.MODAL_KEYBOARD_GAP_PX).toBeLessThanOrEqual(line);
        vi.advanceTimersByTime(5000);
        expect(uiState.panelGliding).toBe(true);
        expect(fieldBottom() + modalKeyboard.MODAL_KEYBOARD_GAP_PX).toBeLessThanOrEqual(line);
        expect(scrollTo).not.toHaveBeenCalled();
    });

    it('⛔ ចុចស្លាក «ស្កេន Barcode…» ➜ ចាប់ដូចចុចប្រអប់ · លើក #appPages', () => {
        remember(420);
        const end = tap(label);
        expect(end.defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(scanner);
        expect(pages.scrollTop).toBeGreaterThan(0);
        expect(scrollTo).not.toHaveBeenCalled();
    });

    it('⛔ ✓ (blur) ➜ #appPages ចុះវិញត្រឹមចំនួនដែលលើក · keyboard បាត់ ➜ document ០ ម្តង (settleDocumentScroll)', () => {
        remember(420);
        tap(scanner);
        keyboard(420);
        vi.advanceTimersByTime(modalKeyboard.IOS_KEYBOARD_SETTLE_MS + 50);
        expect(pages.scrollTop).toBeGreaterThan(0);
        scanner.blur();
        expect(pages.scrollTop).toBe(0);
        keyboard(0);
        expect(pages.scrollTop).toBe(0);
        vi.advanceTimersByTime(2000);
        expect(uiState.panelGliding).toBe(false);
        expect(scrollTo).not.toHaveBeenCalled();
        modalKeyboard.settleDocumentScroll();
        expect(scrollTo).toHaveBeenCalledTimes(1);
    });

    it('⛔ keyboard ស្ងប់ខ្ពស់ជាងការប៉ាន់ (ធ្លាប់វាស់ ៤០០ · ពិត ៤៣០) ➜ ក្រោយ IOS_KEYBOARD_SETTLE_MS លើកបន្ថែមឲ្យប្រអប់នៅពីលើ keyboard · មិនដែលចុះ', () => {
        remember(400);
        const end = tap(scanner);
        expect(end.defaultPrevented).toBe(true);
        const first = pages.scrollTop;
        keyboard(380);
        keyboard(470);
        keyboard(430);
        expect(pages.scrollTop).toBe(first);
        vi.advanceTimersByTime(modalKeyboard.IOS_KEYBOARD_SETTLE_MS + 50);
        expect(fieldBottom() + modalKeyboard.MODAL_KEYBOARD_GAP_PX).toBeLessThanOrEqual(H - 430);
        const raised = pages.scrollTop;
        keyboard(400);
        vi.advanceTimersByTime(modalKeyboard.IOS_KEYBOARD_SETTLE_MS + 50);
        expect(pages.scrollTop).toBe(raised);
        expect(scrollTo).not.toHaveBeenCalled();
    });

    it('⛔ វីដេអូ ៖ ប្រអប់វាយ focus (លើករួច) ➜ ចុចប្រអប់ស្វែងរក ➜ ផ្ទាំងបង្រួម · #appPages ០ · document មិនប៉ះ · App មិនសរសេរ scroll ក្រោយការបង្រួម', () => {
        remember(420);
        tap(scanner);
        keyboard(420);
        vi.advanceTimersByTime(modalKeyboard.IOS_KEYBOARD_SETTLE_MS + 50);
        expect(pages.scrollTop).toBeGreaterThan(0);
        const end = tap(search, 600);
        expect(end.defaultPrevented).toBe(true);
        expect(uiState.entryPanelCollapsed).toBe(true);
        expect(document.activeElement).toBe(search);
        const after = writes;
        expect(pages.scrollTop).toBe(0);
        vi.advanceTimersByTime(1000);
        keyboard(421);
        vi.advanceTimersByTime(modalKeyboard.IOS_KEYBOARD_SETTLE_MS + 50);
        expect(written.slice(after).every((v) => v === 0)).toBe(true);
        expect(pages.scrollTop).toBe(0);
        expect(search.getBoundingClientRect().top).toBeGreaterThanOrEqual(NAV_BOTTOM);
        expect(scrollTo).not.toHaveBeenCalled();
    });

    it('⛔ លើករួច ➜ ប្តូរទំព័រ (blur គ្មានការរអិល) ➜ snap ត្រឡប់ភ្លាម (PTR រស់ · មិនរង់ចាំពិដាន PAGE_RAISE_HOLD_MAX_MS) · មិនរំកិលទំព័រផ្សេង', async () => {
        remember(420);
        tap(scanner);
        keyboard(420);
        vi.advanceTimersByTime(2000);
        await Promise.resolve();
        expect(uiState.panelGliding).toBe(true);
        const dataSide = document.createElement('section');
        const dataMain = document.createElement('section');
        dataSide.getBoundingClientRect = () => rect(NAV_BOTTOM - pages.scrollTop, SIDE_H);
        dataMain.getBoundingClientRect = () => rect(NAV_BOTTOM + SIDE_H - pages.scrollTop, VIEW_H);
        refTo('dataSideSection')(dataSide);
        refTo('dataMainSection')(dataMain);
        uiState.currentAppPage = 'data';
        const before = writes;
        scanner.blur();
        vi.advanceTimersByTime(50);
        refTo('dataSideSection')(null);
        refTo('dataMainSection')(null);
        expect(uiState.panelGliding).toBe(false);
        expect(writes).toBe(before);
    });

    it('⛔ លើករួច ➜ ផ្ទាំងបើក (ឧ. ផ្ទាំងបញ្ជាក់ការដក) ➜ blur ➜ #appPages ចុះវិញក្រោមផ្ទាំង (មិនទុកឲ្យ snap លោត)', () => {
        remember(420);
        tap(scanner);
        keyboard(420);
        vi.advanceTimersByTime(modalKeyboard.IOS_KEYBOARD_SETTLE_MS + 50);
        expect(pages.scrollTop).toBeGreaterThan(0);
        uiState.isModalOpen = true;
        scanner.blur();
        expect(written[written.length - 1]).toBe(0);
        vi.advanceTimersByTime(2000);
        expect(uiState.panelGliding).toBe(false);
        uiState.isModalOpen = false;
    });

    it('ទិសផ្ទុយ ៖ ប្រអប់នៅពីលើ keyboard (ធ្លាប់វាស់ ៣៦៥) ➜ ចាប់ដូចមុន · #appPages មិនរំកិល', () => {
        remember(365);
        const end = tap(scanner);
        expect(end.defaultPrevented).toBe(true);
        keyboard(365);
        vi.advanceTimersByTime(modalKeyboard.IOS_KEYBOARD_SETTLE_MS + 50);
        expect(pages.scrollTop).toBe(0);
        expect(writes).toBe(0);
    });

    it('ទិសផ្ទុយ ៖ គ្មានចន្លោះលើក (ប្រអប់នឹងឡើងក្រោម navbar) ➜ ទុកឲ្យ iOS ដូចមុន (មិនចាប់ · មិនរំកិល #appPages)', () => {
        remember(700);
        const end = tap(scanner);
        expect(end.defaultPrevented).toBe(false);
        expect(pages.scrollTop).toBe(0);
        expect(writes).toBe(0);
    });

    it('ទិសផ្ទុយ ៖ ការលើកនឹងដាក់ប្រអប់ក្រោម navbar (ប្រអប់ខ្ពស់ · keyboard ធំ) ➜ ទុកឲ្យ iOS', () => {
        scanner.getBoundingClientRect = () => rect(NAV_BOTTOM + 40 - pages.scrollTop, FIELD_H);
        remember(H - 160);
        const end = tap(scanner, 170);
        expect(end.defaultPrevented).toBe(false);
        expect(writes).toBe(0);
    });

    it('ទិសផ្ទុយ ៖ ការលើកនឹងចូលជិត `.page-main` (snap proximity របស់ WebKit) ➜ ទុកឲ្យ iOS (WebKit នឹង re-snap ➜ ប្រអប់ឡើងក្រោម navbar)', () => {
        remember(650);
        const end = tap(scanner);
        expect(end.defaultPrevented).toBe(false);
        expect(writes).toBe(0);
    });

    it('ទិសផ្ទុយ ៖ Android (Chrome) ➜ មិនប៉ះ ៖ keyboard នឹងបាំង ➜ ទុកឲ្យ Chromium · #appPages មិនរំកិលដោយ App', () => {
        setIOSStandalone(false);
        setAndroid(true);
        remember(420);
        const end = tap(scanner);
        expect(end.defaultPrevented).toBe(false);
        keyboard(420);
        vi.advanceTimersByTime(modalKeyboard.IOS_KEYBOARD_SETTLE_MS + 50);
        expect(writes).toBe(0);
    });

    it('ទិសផ្ទុយ ៖ ប្រអប់បើក (ផ្ទាំង) ➜ ប្រអប់វាយ Barcode ទំព័រមិនចាប់ · #appPages មិនរំកិល', () => {
        remember(420);
        uiState.isModalOpen = true;
        const end = tap(scanner);
        expect(end.defaultPrevented).toBe(false);
        expect(writes).toBe(0);
    });
});
