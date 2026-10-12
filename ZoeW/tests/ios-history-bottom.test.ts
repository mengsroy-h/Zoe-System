import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { drawsOwnScrollThumb, pullToRefreshSupported } from '../src/platform/native';

afterEach(() => {
    delete (window.navigator as any).standalone;
    delete (window as any).Capacitor;
    document.body.classList.remove('chrome-hidden');
    document.body.innerHTML = '';
});

describe('iOS PWA ៖ ប្រវត្តិបំពេញបាតក្រោយ keyboard និងប្រអប់បញ្ជី', () => {
    it('របា Tab លាក់ ខណៈផ្ទាំងស្វែងរកនៅបើក ➜ ទុកតែចន្លោះ safe-area', () => {
        (window as any).happyDOM.setWindowSize({ width: 412, height: 780 });
        document.documentElement.style.setProperty('--chrome-bottom', '96px');
        document.documentElement.style.setProperty('--page-extension', '34px');
        const source = readFileSync(path.join(__dirname, '../src/styles/app.css'), 'utf8');
        const start = source.indexOf('@supports (-webkit-touch-callout: none) {');
        let depth = 0;
        const open = source.indexOf('{', start);
        let end = open;
        for (let i = open; i < source.length; i++) {
            if (source[i] === '{') depth++;
            if (source[i] === '}' && --depth === 0) { end = i; break; }
        }
        const style = document.createElement('style');
        style.textContent = source.slice(open + 1, end);
        document.body.append(style);
        const pages = document.createElement('div');
        pages.className = 'app-pages';
        pages.innerHTML = '<div class="app-page active"><div class="page-side search-focus"></div><div class="page-main"></div></div>';
        document.body.append(pages);
        const shown = window.getComputedStyle(pages).paddingBottom;
        expect(shown).toBe('calc(96px + 8px)');
        document.body.classList.add('chrome-hidden');
        const hidden = window.getComputedStyle(pages).paddingBottom;
        expect(hidden).toBe('calc(34px + 8px)');
    });

    it('iOS standalone ៖ ប្រើ scrollbar របស់ប្រព័ន្ធតែមួយ · PTR នៅបើក', () => {
        Object.defineProperty(window.navigator, 'standalone', { configurable: true, value: true });
        expect(pullToRefreshSupported()).toBe(true);
        expect(drawsOwnScrollThumb()).toBe(false);
    });

    it('APK Android ៖ ខ្សែ scrollbar របស់ App នៅដដែល', () => {
        (window as any).Capacitor = { isNativePlatform: () => true, getPlatform: () => 'android' };
        expect(drawsOwnScrollThumb()).toBe(true);
    });
});
