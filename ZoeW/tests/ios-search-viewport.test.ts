/**
 * ⛔ រាយការណ៍ម្ចាស់គម្រោង (វីដេអូ IMG_1101 · iPhone PWA · Android PWA មិនអី) ៖ ស្វែងរកលេខ ➜ ចុច «⋯» ➜ ចុចស្វែងរកម្តងទៀត ➜ ទំព័រលោតឡើង
 *    (navbar បាត់ · បញ្ជីលេខទូរស័ព្ទជាន់ម៉ោង · keyboard បើក) ហើយនៅដដែលរហូតបិទ keyboard · ម្តងទៀតលោតចុះ (ចន្លោះទទេខាងលើ)។
 *    Chromium (touch) ៖ ស្ថានភាព App ដូចគ្នាបេះបិទរវាងការចុចធម្មតា និងការចុចក្រោយ «⋯» ➜ មូលហេតុនៅ iOS ៖ keyboard រំកិល document
 *    (`window.scrollY` ≠ ០) ដើម្បីបង្ហាញប្រអប់តាមទីតាំង *មុន* ការទាញឡើង ➜ App កែតែពេល `visualViewport` `resize` ➜ ការរំកិលដែលមកក្រោយ resize នៅជាប់។
 * ⛔ ច្បាប់ ៖ iOS standalone (`html.ios-standalone` ចាក់សោ root ➜ `#appPages` ជាអ្នករមូរតែមួយ ➜ document រំកិល = artifact របស់ keyboard) ·
 *    ពេលប្រអប់ស្វែងរកលេខទាញឡើង (`dataPanelSearchFocus`) ➜ document រំកិល (`scroll` លើ window · `visualViewport`) ➜ ត្រឡប់ ០ ·
 *    ទិសផ្ទុយ ៖ Android/web ធម្មតា · ប្រអប់ផ្សេង (iOS ត្រូវរំកិលដើម្បីបង្ហាញវា) · document មិនរំកិល · ការរមូរខាងក្នុង (`#appPages`) ➜ មិនប៉ះ។
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { uiState } from '../src/core/state';
import * as iosViewport from '../src/app/behaviors/ios-viewport';

let scrollY = 0;
let scrollCalls: any[] = [];
let vv: EventTarget;
const listeners: Array<[EventTarget, string, any]> = [];

function scope() {
    return {
        disposed: false,
        listen(target: EventTarget | null | undefined, type: string, handler: any, options?: any) {
            if (!target) return;
            target.addEventListener(type, handler, options);
            listeners.push([target, type, handler]);
        },
        every() {}, onLoad() {}, onDispose() {}, dispose() {}
    } as any;
}

function setIOSStandalone(on: boolean) {
    Object.defineProperty(window.navigator, 'standalone', { configurable: true, value: on ? true : undefined });
    Object.defineProperty(window, 'CSS', { configurable: true, value: { supports: (p: string, v: string) => on && p === '-webkit-touch-callout' && v === 'none' } });
}

beforeEach(() => {
    scrollY = 0;
    scrollCalls = [];
    vv = new EventTarget();
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: vv });
    Object.defineProperty(window, 'scrollY', { configurable: true, get: () => scrollY });
    window.scrollTo = ((x: any, y: any) => { scrollCalls.push([x, y]); scrollY = typeof y === 'number' ? y : 0; }) as any;
    setIOSStandalone(true);
    uiState.dataPanelSearchFocus = true;
    (iosViewport as any).listenIOSDocumentScroll(scope());
});

afterEach(() => {
    listeners.splice(0).forEach(([t, type, h]) => t.removeEventListener(type, h));
    uiState.dataPanelSearchFocus = false;
    vi.restoreAllMocks();
});

const pan = (target: EventTarget, y: number) => { scrollY = y; target.dispatchEvent(new Event('scroll')); };

describe('iOS PWA ៖ keyboard រំកិល document ខណៈស្វែងរកលេខ ➜ ត្រឡប់ ០', () => {
    it('⛔ document រំកិល ២៥០px ក្រោយ keyboard (scroll លើ window) ➜ scrollTo(0, 0)', () => {
        pan(window, 250);
        expect(scrollCalls).toEqual([[0, 0]]);
        expect(scrollY).toBe(0);
    });

    it('⛔ visualViewport រំកិល (keyboard បញ្ចប់ចលនា) ➜ ត្រឡប់ ០', () => {
        pan(vv, 180);
        expect(scrollCalls).toEqual([[0, 0]]);
    });

    it('⛔ ខ្សែភ្ជាប់ ៖ boot ចង listener នេះ (មិនត្រឹម visualViewport resize)', () => {
        const boot = readFileSync(path.join(__dirname, '..', 'src', 'app', 'lifecycle', 'boot.ts'), 'utf8');
        expect(boot).toMatch(/listenIOSDocumentScroll\(scope\)/);
    });

    it('ទិសផ្ទុយ ៖ Android/web (មិនមែន iOS standalone) ➜ មិនប៉ះ', () => {
        setIOSStandalone(false);
        pan(window, 250);
        expect(scrollCalls).toEqual([]);
    });

    it('ទិសផ្ទុយ ៖ ប្រអប់ស្វែងរកមិនទាញឡើង (ប្រអប់ផ្សេងដែល iOS ត្រូវរំកិលដើម្បីបង្ហាញ) ➜ មិនប៉ះ', () => {
        uiState.dataPanelSearchFocus = false;
        pan(window, 250);
        expect(scrollCalls).toEqual([]);
    });

    it('ទិសផ្ទុយ ៖ document មិនរំកិល · ការរមូរខាងក្នុង (#appPages) ➜ មិនហៅ scrollTo', () => {
        pan(window, 0);
        const inner = document.createElement('div');
        document.body.appendChild(inner);
        scrollY = 0;
        inner.dispatchEvent(new Event('scroll'));
        expect(scrollCalls).toEqual([]);
        inner.remove();
    });
});
