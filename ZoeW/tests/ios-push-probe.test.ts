/**
 * ⛔ រាយការណ៍ម្ចាស់គម្រោង (iPhone · App លើ Home Screen · រូបថតអេក្រង់ ២) ៖ ទំព័រស្កេន ចុចកន្លែងវាយ Barcode ៤–៥ ដង ➜ ម្តងរុញទំព័រទាំងមូល
 *    (navbar រួម) ឡើង ~១០០pt ហើយប្រអប់នៅកណ្តាលពីលើ keyboard · ចុចប្រអប់ស្វែងរកពេលនោះ ➜ រុញថែម។ ទីតាំងកណ្តាល = WebKit
 *    `_zoomToFocusRect` (iPhone ៖ `forceScroll`) ដែលរត់តែពេល focus គ្មាន `preventScroll` ➜ ផ្លូវណាមួយនៅលេចចេញពីការចាប់របស់ App។
 *    Chromium គ្មាន WebKit ➜ វាស់លើ iPhone ពិត ៖ probe (deploy preview តែប៉ុណ្ណោះ) កត់ ts · te · md · ck · fo · bl · kb · vs · ws
 *    ហើយពេល visual viewport ឬ document រំកិល (គ្មានម្រាមដៃ · គ្មានប្រអប់បើក) ➜ toast 🔬 ដែលម្ចាស់គម្រោងថតអេក្រង់ផ្ញើមក។
 *    តេស្តនេះរត់ជាមួយ `listenModalKeyboard()` ពិត ➜ toast ប្រាប់អ្វីដែល App ធ្វើពិត (ចាប់ p1 · មិនចាប់ p0)។
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { uiState } from '../src/core/state';
import * as modalKeyboard from '../src/app/behaviors/modal-keyboard';
import * as probe from '../src/app/behaviors/ios-push-probe';
import { refTo } from '../src/app/refs';
import { TOAST_LIFETIME_MS } from '../src/ui/toast';

const PREVIEW = 'https://deploy-preview-349--zoew.netlify.app/';
const listeners: Array<[EventTarget, string, any, any]> = [];
const disposers: Array<() => void> = [];
let vv: EventTarget & { height: number; offsetTop: number };
let box: HTMLElement;
let scanner: HTMLInputElement;
let search: HTMLInputElement;
let clock = 10000;
let urlBefore = '';

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

function advance(ms: number) {
    clock += ms;
    vi.advanceTimersByTime(ms);
}

function touch(type: string, target: EventTarget, active: number, opts: { dx?: number; cancelable?: boolean } = {}) {
    const ev = new Event(type, { bubbles: true, cancelable: opts.cancelable !== false });
    const t = { identifier: 1, clientX: 50 + (opts.dx || 0), clientY: 305, target };
    Object.defineProperty(ev, 'touches', { value: Array.from({ length: active }, () => t) });
    Object.defineProperty(ev, 'changedTouches', { value: [t] });
    Object.defineProperty(ev, 'timeStamp', { value: clock });
    target.dispatchEvent(ev);
    return ev;
}

function tap(target: EventTarget, ms: number, opts: { dx?: number; cancelable?: boolean } = {}) {
    touch('touchstart', target, 1);
    advance(ms);
    return touch('touchend', target, 0, opts);
}

function syntheticClick(target: HTMLElement, field: HTMLElement) {
    advance(12);
    const down = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    if (target.dispatchEvent(down)) field.focus();
    target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
    target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    advance(0);
    return down;
}

function keyboard(inset: number, pan: number) {
    vv.height = 844 - inset;
    vv.dispatchEvent(new Event('resize'));
    advance(40);
    vv.offsetTop = pan;
    vv.dispatchEvent(new Event('scroll'));
}

function probeToasts() {
    return uiState.toasts.filter((t: any) => String(t.msg).indexOf('🔬') === 0);
}

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    clock = 10000;
    vi.spyOn(performance, 'now').mockImplementation(() => clock);
    urlBefore = window.location.href;
    (window as any).happyDOM.setURL(PREVIEW);
    try { localStorage.removeItem('zoew_keyboard_inset_v1'); } catch {}
    Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: 844 });
    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 390 });
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
    vv = Object.assign(new EventTarget(), { height: 844, offsetTop: 0 });
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: vv });
    setIOSStandalone(true);
    uiState.isModalOpen = false;
    uiState.modalDisplay = {};
    uiState.toasts = [];
    uiState.currentAppPage = 'entry';
    box = document.createElement('div');
    box.innerHTML = '<div id="appPages"><label for="hwScannerInput" id="hardwareScannerLabel">ស្កេន Barcode</label>' +
        '<div class="scanner-input-wrapper"><span class="icon">⚡</span><input type="text" id="hwScannerInput"></div>' +
        '<input type="text" id="entryListSearchInput"></div>';
    document.body.append(box);
    scanner = box.querySelector('#hwScannerInput') as HTMLInputElement;
    search = box.querySelector('#entryListSearchInput') as HTMLInputElement;
    scanner.getBoundingClientRect = () => rect(290, 30);
    search.getBoundingClientRect = () => rect(560, 40);
    refTo('hwScannerInput')(scanner);
    refTo('entryListSearchInput')(search);
    refTo('appPages')(box.querySelector('#appPages') as HTMLElement);
    modalKeyboard.listenModalKeyboard(scope());
});

afterEach(() => {
    disposers.splice(0).forEach((fn) => fn());
    listeners.splice(0).forEach(([t, type, h, o]) => t.removeEventListener(type, h, o));
    refTo('hwScannerInput')(null);
    refTo('entryListSearchInput')(null);
    refTo('appPages')(null);
    if (document.activeElement && (document.activeElement as HTMLElement).blur) (document.activeElement as HTMLElement).blur();
    box.remove();
    setIOSStandalone(false);
    (window as any).happyDOM.setURL(urlBefore);
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
    uiState.isModalOpen = false;
    uiState.modalDisplay = {};
    uiState.toasts = [];
    uiState.currentAppPage = 'data';
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe('iPhone (deploy preview) ៖ ទំព័ររុញពេល keyboard លោត ➜ toast 🔬 ប្រាប់ផ្លូវពិតដែល App · WebKit ធ្វើ', () => {
    it('⛔ ចុចយូរ (៦៤០ms) ➜ App មិនចាប់ (p0) ➜ mousedown សំយោគ (p0) ➜ focus ➜ keyboard ➜ vv រំកិល ៩៩ ➜ toast មួយ ៖ te · md · fo តាមលំដាប់ · បាកូដ · នៅ ៣០ វិ.', () => {
        probe.listenIOSPushProbe(scope());
        expect(tap(scanner, 640).defaultPrevented).toBe(false);
        expect(syntheticClick(scanner, scanner).defaultPrevented).toBe(false);
        expect(document.activeElement).toBe(scanner);
        keyboard(397, 99);
        expect(probeToasts()).toHaveLength(0);
        advance(probe.PUSH_PROBE_SETTLE_MS);
        const shots = probeToasts();
        expect(shots).toHaveLength(1);
        const msg = String(shots[0].msg);
        expect(msg).toContain('🔬 ទំព័ររុញ 99pt (ឥឡូវ vv 99 · doc 0 · kb 397 · entry)');
        expect(msg).toContain('បាកូដ mp f0 k0 t0 r0 o0 c0 a1 u0 s0 b320/844');
        for (const part of ['ts:bc', 'te:640ms Δ0,0 c1 p0', 'md:bc p0', 'fo:bc', 'ck:bc p0', 'kb:0→397', 'vs:0→99']) expect(msg).toContain(part);
        expect(msg.indexOf('te:640ms')).toBeLessThan(msg.indexOf('md:bc'));
        expect(msg.indexOf('md:bc')).toBeLessThan(msg.indexOf('fo:bc'));
        expect(msg).toMatch(/\[-\d+\] ts:bc/);
        expect(msg).toContain('[0] vs:0→99');
        advance(TOAST_LIFETIME_MS + 1000);
        expect(probeToasts()).toHaveLength(1);
        advance(probe.PUSH_PROBE_TOAST_MS + 400);
        expect(probeToasts()).toHaveLength(0);
    });

    it('⛔ ចុចដែល App ចាប់ (p1 · focus ក្នុង touchend មុន mousedown) ➜ mousedown ត្រូវបោះចោល (p1) ➜ បើទំព័រនៅរុញ ➜ toast ប្រាប់ផ្លូវ «ចាប់» នោះ', () => {
        probe.listenIOSPushProbe(scope());
        expect(tap(scanner, 80).defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(scanner);
        expect(syntheticClick(scanner, scanner).defaultPrevented).toBe(true);
        keyboard(397, 99);
        advance(probe.PUSH_PROBE_SETTLE_MS);
        const msg = String(probeToasts()[0].msg);
        for (const part of ['te:80ms Δ0,0 c1 p1', 'fo:bc', 'md:bc p1', 'ck:bc p1']) expect(msg).toContain(part);
        expect(msg.indexOf('te:80ms')).toBeLessThan(msg.indexOf('fo:bc'));
        expect(msg.indexOf('fo:bc')).toBeLessThan(msg.indexOf('md:bc'));
    });

    it('⛔ ផ្លូវលេចផ្សេងៗ ៖ រំកិល ១៤px (Δ14) · touchend មិន cancelable (c0) · ប្រអប់ដែល keyboard នឹងបាំង (a0) ➜ App មិនចាប់ ➜ toast ប្រាប់លេខនោះ', () => {
        probe.listenIOSPushProbe(scope());
        tap(scanner, 90, { dx: 14 });
        syntheticClick(scanner, scanner);
        keyboard(397, 99);
        advance(probe.PUSH_PROBE_SETTLE_MS);
        expect(String(probeToasts()[0].msg)).toContain('te:90ms Δ14,0 c1 p0');
        scanner.blur();
        keyboard(0, 0);
        advance(probe.PUSH_PROBE_SETTLE_MS);
        expect(tap(scanner, 90, { cancelable: false }).defaultPrevented).toBe(false);
        syntheticClick(scanner, scanner);
        keyboard(397, 99);
        advance(probe.PUSH_PROBE_SETTLE_MS);
        expect(probeToasts()).toHaveLength(2);
        expect(String(probeToasts()[1].msg)).toContain('te:90ms Δ0,0 c0 p0');
        scanner.blur();
        keyboard(0, 0);
        advance(probe.PUSH_PROBE_SETTLE_MS);
        scanner.getBoundingClientRect = () => rect(700, 30);
        expect(tap(scanner, 90).defaultPrevented).toBe(false);
        syntheticClick(scanner, scanner);
        keyboard(397, 140);
        advance(probe.PUSH_PROBE_SETTLE_MS);
        expect(probeToasts()).toHaveLength(3);
        expect(String(probeToasts()[2].msg)).toContain('បាកូដ mp f0 k0 t0 r0 o0 c0 a0 u0 s397 b730/844');
    });

    it('⛔ រុញដដែល ➜ toast ម្តង · ចុចស្វែងរកពេលរុញ ➜ រុញថែម ≥ PUSH_PROBE_STEP_PX ➜ toast ទីពីរ (sr) · ត្រឡប់ ០ ➜ ការរុញលើកក្រោយប្រាប់ម្តងទៀត', () => {
        probe.listenIOSPushProbe(scope());
        tap(scanner, 640);
        syntheticClick(scanner, scanner);
        keyboard(397, 99);
        advance(probe.PUSH_PROBE_SETTLE_MS);
        vv.dispatchEvent(new Event('resize'));
        vv.dispatchEvent(new Event('scroll'));
        advance(probe.PUSH_PROBE_SETTLE_MS);
        expect(probeToasts()).toHaveLength(1);
        tap(search, 70);
        syntheticClick(search, search);
        expect(document.activeElement).toBe(search);
        vv.offsetTop = 99 + probe.PUSH_PROBE_STEP_PX - 1;
        vv.dispatchEvent(new Event('scroll'));
        advance(probe.PUSH_PROBE_SETTLE_MS);
        expect(probeToasts()).toHaveLength(1);
        vv.offsetTop = 150;
        vv.dispatchEvent(new Event('scroll'));
        advance(probe.PUSH_PROBE_SETTLE_MS);
        expect(probeToasts()).toHaveLength(2);
        const second = String(probeToasts()[1].msg);
        expect(second).toContain('🔬 ទំព័ររុញ 150pt');
        expect(second).toContain('ts:sr');
        expect(second).toContain('fo:sr');
        search.blur();
        keyboard(0, 0);
        advance(probe.PUSH_PROBE_SETTLE_MS);
        tap(scanner, 640);
        syntheticClick(scanner, scanner);
        keyboard(397, 99);
        advance(probe.PUSH_PROBE_SETTLE_MS);
        expect(probeToasts()).toHaveLength(3);
    });

    it('ចុចស្លាក · ⚡ (iOS រាប់ជាការចុចប្រអប់) ➜ ts:bc~ + បាកូដ · រុញឡើងជាជំហានខណៈរង់ចាំ ➜ toast មួយ ៖ ពេល [0] = ការរុញដំបូង · ចំនួនខ្ពស់បំផុត', () => {
        probe.listenIOSPushProbe(scope());
        const icon = box.querySelector('.icon') as HTMLElement;
        expect(tap(icon, 80).defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(scanner);
        syntheticClick(icon, scanner);
        vv.height = 844 - 397;
        vv.dispatchEvent(new Event('resize'));
        for (const pan of [30, 60, 99]) {
            advance(16);
            vv.offsetTop = pan;
            vv.dispatchEvent(new Event('scroll'));
        }
        advance(probe.PUSH_PROBE_SETTLE_MS);
        expect(probeToasts()).toHaveLength(1);
        const msg = String(probeToasts()[0].msg);
        expect(msg).toContain('🔬 ទំព័ររុញ 99pt');
        expect(msg).toContain('[0] vs:0→99');
        expect(msg).toContain('ts:bc~');
        expect(msg).toContain('បាកូដ mp f0');
        expect(msg).toContain('te:80ms Δ0,0 c1 p1');
    });

    it('ទំព័ររុញ ១–២ ស៊ុមហើយត្រឡប់ ០ មុនពេលប្រាប់ ➜ toast នៅប្រាប់ចំនួនខ្ពស់បំផុត (ឥឡូវ vv 0)', () => {
        probe.listenIOSPushProbe(scope());
        tap(scanner, 640);
        syntheticClick(scanner, scanner);
        keyboard(397, 120);
        advance(60);
        vv.offsetTop = 0;
        vv.dispatchEvent(new Event('scroll'));
        advance(probe.PUSH_PROBE_SETTLE_MS);
        expect(String(probeToasts()[0].msg)).toContain('🔬 ទំព័ររុញ 120pt (ឥឡូវ vv 0 · doc 0');
    });
});

describe('ទិសផ្ទុយ ៖ probe មិនប្រាប់ · មិនប៉ះការចុច', () => {
    it('host ផលិតកម្ម · មិនមែន App លើ Home Screen ➜ គ្មាន listener · គ្មាន toast', () => {
        (window as any).happyDOM.setURL('https://zoew.netlify.app/');
        const before = listeners.length;
        probe.listenIOSPushProbe(scope());
        expect(listeners.length).toBe(before);
        (window as any).happyDOM.setURL('https://deploy-preview-349--zoekeygen.netlify.app/');
        probe.listenIOSPushProbe(scope());
        expect(listeners.length).toBe(before);
        (window as any).happyDOM.setURL(PREVIEW);
        setIOSStandalone(false);
        probe.listenIOSPushProbe(scope());
        expect(listeners.length).toBe(before);
        setIOSStandalone(true);
        tap(scanner, 640);
        syntheticClick(scanner, scanner);
        keyboard(397, 99);
        advance(probe.PUSH_PROBE_SETTLE_MS);
        expect(probeToasts()).toHaveLength(0);
    });

    it('ម្រាមដៃនៅលើអេក្រង់ (អ្នកប្រើអូស) · ប្រអប់បើក · រំកិលតិចជាង PUSH_PROBE_MIN_PX ➜ គ្មាន toast', () => {
        probe.listenIOSPushProbe(scope());
        touch('touchstart', box, 1);
        vv.offsetTop = 99;
        vv.dispatchEvent(new Event('scroll'));
        advance(probe.PUSH_PROBE_SETTLE_MS);
        touch('touchend', box, 0);
        vv.offsetTop = 0;
        vv.dispatchEvent(new Event('scroll'));
        uiState.isModalOpen = true;
        vv.offsetTop = 99;
        vv.dispatchEvent(new Event('scroll'));
        advance(probe.PUSH_PROBE_SETTLE_MS);
        uiState.isModalOpen = false;
        vv.offsetTop = 0;
        vv.dispatchEvent(new Event('scroll'));
        vv.offsetTop = probe.PUSH_PROBE_MIN_PX - 1;
        vv.dispatchEvent(new Event('scroll'));
        advance(probe.PUSH_PROBE_SETTLE_MS);
        expect(probeToasts()).toHaveLength(0);
    });

    it('probe ស្តាប់តែ passive ➜ មិនដែល preventDefault · dispose ➜ timer ឈប់ · គ្មាន toast', () => {
        const before = listeners.length;
        probe.listenIOSPushProbe(scope());
        const mine = listeners.slice(before);
        expect(mine.length).toBeGreaterThan(0);
        for (const [, type, , options] of mine) {
            if (/^(touch|mouse|click|scroll)/.test(type)) expect(options && options.passive, type).toBe(true);
        }
        const field = document.createElement('input');
        document.body.appendChild(field);
        expect(tap(field, 640).defaultPrevented).toBe(false);
        field.remove();
        keyboard(397, 99);
        disposers.splice(0).forEach((fn) => fn());
        expect(vi.getTimerCount()).toBe(0);
        advance(probe.PUSH_PROBE_SETTLE_MS);
        expect(probeToasts()).toHaveLength(0);
    });
});
