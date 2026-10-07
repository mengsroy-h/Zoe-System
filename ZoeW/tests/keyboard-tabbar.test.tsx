/**
 * ⛔ របា Tab មិនលោតឡើងពី keyboard (វីដេអូម្ចាស់គម្រោង ៖ Xiaomi · APK «ពេលបើក keyboard របា tab លោតអត់ smooth ឡើងឈរលើ keyboard»)
 *    វីដេអូ (~៩០fps) ៖ ពេល keyboard ចាប់ផ្តើមបើក WebView រួញភ្លាមក្នុង ១ ស៊ុមទៅកម្ពស់ចុងក្រោយ (ផ្ទៃខ្មៅខាងក្រោម) ➜ របា `position: fixed`
 *    លោតឡើងភ្លាម ខណៈ keyboard ទើបរំកិលឡើងពីក្រោម។ ឥឡូវ (APK Android តែប៉ុណ្ណោះ) ៖ `resize` ដែលធ្វើឲ្យកម្ពស់ថយ ≥ KEYBOARD_MIN_INSET_PX
 *    ពេលវាលវាយអក្សរមាន focus ➜ `uiState.keyboardOpen` ➜ body `keyboard-open` + `chrome-hidden` **ក្នុង handler ដដែល** (មុនស៊ុមថ្មីត្រូវគូរ)
 *    ➜ របាលាក់ (គ្មាន transition) · keyboard បិទ (កម្ពស់ត្រឡប់) ➜ របារអិលឡើងវិញ · ស្ថានភាពលាក់តាមការរមូរ (`uiState.chromeHidden`) មិនប៉ះ ·
 *    web/iOS មិនប្រែ (keyboard គ្របពីលើ មិនប្តូរទំហំប្លង់)។
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { uiState } from '../src/core/state';
import { refTo } from '../src/app/refs';
import { KEYBOARD_MIN_INSET_PX, setupChromeAutoHide } from '../src/app/behaviors/chrome-autohide';
import { DocumentEffects } from '../src/app/components/shell/DocumentEffects';
import { mount, step, unmount } from './native/react-harness';

const FULL = 860;
let input: HTMLInputElement;

function setNative(on: boolean) {
    (window as any).Capacitor = on ? { isNativePlatform: () => true, getPlatform: () => 'android' } : undefined;
}

function resizeTo(width: number, height: number) {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
    window.dispatchEvent(new Event('resize'));
}

const hasClass = (c: string) => document.body.classList.contains(c);

describe('របា Tab ↔ keyboard (APK Android)', () => {
    beforeAll(() => {
        setNative(true);
        resizeTo(412, FULL);
        const pages = document.createElement('div');
        const navbar = document.createElement('nav');
        const tabbar = document.createElement('div');
        input = document.createElement('input');
        input.type = 'tel';
        document.body.append(navbar, pages, tabbar, input);
        refTo('appPages')(pages);
        refTo('navbar')(navbar);
        refTo('pageTabBar')(tabbar);
        mount(<DocumentEffects />);
        setupChromeAutoHide();
    });
    afterEach(() => {
        input.blur();
        setNative(true);
        resizeTo(412, FULL);
        step(() => { uiState.chromeHidden = false; });
    });
    afterAll(() => { unmount(); setNative(false); });

    it('keyboard បើក ➜ របាលាក់ក្នុង resize ដដែល (មុនស៊ុមថ្មី) · បិទ ➜ ត្រឡប់ · ស្ថានភាពរមូរមិនប៉ះ', () => {
        input.focus();
        resizeTo(412, FULL - 320);
        expect(uiState.keyboardOpen).toBe(true);
        expect(hasClass('keyboard-open')).toBe(true);
        expect(hasClass('chrome-hidden')).toBe(true);
        expect(uiState.chromeHidden).toBe(false);
        resizeTo(412, FULL);
        expect(uiState.keyboardOpen).toBe(false);
        expect(hasClass('keyboard-open')).toBe(false);
        expect(hasClass('chrome-hidden')).toBe(false);
    });

    it('keyboard បិទ ក្រោយ blur (focus បាត់មុន resize) ➜ របាត្រឡប់ · ការរួញតូច (< KEYBOARD_MIN_INSET_PX) មិនមែន keyboard', () => {
        input.focus();
        resizeTo(412, FULL - 320);
        input.blur();
        expect(hasClass('chrome-hidden')).toBe(true);
        resizeTo(412, FULL);
        expect(hasClass('chrome-hidden')).toBe(false);
        input.focus();
        resizeTo(412, FULL - (KEYBOARD_MIN_INSET_PX - 10));
        expect(uiState.keyboardOpen).toBe(false);
    });

    it('គ្មានវាលវាយអក្សរ focus (បំបែកអេក្រង់) ➜ មិនលាក់ · ប្តូរទទឹង (បង្វិល) ➜ កម្ពស់គោលថ្មី', () => {
        resizeTo(412, FULL - 320);
        expect(uiState.keyboardOpen).toBe(false);
        resizeTo(412, FULL);
        resizeTo(915, 380);
        input.focus();
        resizeTo(915, 380);
        expect(uiState.keyboardOpen).toBe(false);
        input.blur();
        resizeTo(412, FULL);
    });

    it('របាលាក់ដោយការរមូរមុន keyboard ➜ keyboard បិទ ➜ នៅលាក់ដដែល', () => {
        step(() => { uiState.chromeHidden = true; });
        input.focus();
        resizeTo(412, FULL - 320);
        resizeTo(412, FULL);
        expect(hasClass('keyboard-open')).toBe(false);
        expect(hasClass('chrome-hidden')).toBe(true);
    });

    it('web/PWA (មិនមែន APK) ➜ មិនប្រែ', () => {
        setNative(false);
        input.focus();
        resizeTo(412, FULL - 320);
        expect(uiState.keyboardOpen).toBe(false);
        expect(hasClass('chrome-hidden')).toBe(false);
    });
});
