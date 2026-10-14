/**
 * ⛔ រាយការណ៍ម្ចាស់គម្រោង ៖ «iOS PTR អត់ញ័រ» (Android ញ័រ)។ WebKit (iOS Safari · PWA) គ្មាន `navigator.vibrate` ➜ `hapticTick()` ធ្លាប់គ្មានអ្វីធ្វើ។
 * ⛔ ច្បាប់ ៖ `hapticTick()` លើ web ៖ `vibrate` មាន ➜ `vibrate` · គ្មាន ➜ `iosHapticSwitchTick()` ៖ `<label><input type="checkbox" switch>` លាក់ក្រៅអេក្រង់
 *    (⛔ មិន `display: none`) សាងម្តងក្នុង `<body>` ➜ `label.click()` ផ្លាស់ switch ➜ Safari 17.4+ លេងញ័រប្រព័ន្ធ · browser គ្មាន IDL `switch` ➜ គ្មានធាតុ · មិន throw។
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const nav = navigator as Navigator & { vibrate?: (pattern: number) => boolean };

function withSwitchSupport(on: boolean) {
    if (on) Object.defineProperty(HTMLInputElement.prototype, 'switch', { configurable: true, writable: true, value: false });
    else delete (HTMLInputElement.prototype as any).switch;
}

async function freshHaptics() {
    vi.resetModules();
    return import('../src/platform/haptics');
}

beforeEach(() => {
    Object.defineProperty(nav, 'vibrate', { configurable: true, writable: true, value: undefined });
    document.querySelectorAll('.haptic-switch').forEach((el) => el.remove());
});

afterEach(() => {
    withSwitchSupport(false);
    delete (nav as any).vibrate;
    document.querySelectorAll('.haptic-switch').forEach((el) => el.remove());
    vi.restoreAllMocks();
});

describe('iPhone PWA ៖ PTR ញ័រតាម <input switch> (WebKit គ្មាន vibrate)', () => {
    it('⛔ គ្មាន vibrate · switch មាន ➜ label + input[type=checkbox][switch] មួយក្នុង body · ចុច ➜ checked ផ្លាស់ · សាងម្តង', async () => {
        withSwitchSupport(true);
        const { hapticTick } = await freshHaptics();
        hapticTick();
        const labels = document.body.querySelectorAll('label.haptic-switch');
        expect(labels.length).toBe(1);
        const input = labels[0].querySelector('input') as HTMLInputElement;
        expect(input.type).toBe('checkbox');
        expect(input.hasAttribute('switch')).toBe(true);
        expect(input.checked).toBe(true);
        hapticTick();
        expect(input.checked).toBe(false);
        expect(document.body.querySelectorAll('label.haptic-switch').length).toBe(1);
        expect(labels[0].closest('#root')).toBeNull();
    });

    it('vibrate មាន (Android web) ➜ ហៅ vibrate · គ្មាន switch', async () => {
        withSwitchSupport(true);
        const vibrate = vi.fn(() => true);
        (nav as any).vibrate = vibrate;
        const { hapticTick, HAPTIC_TICK_MS } = await freshHaptics();
        hapticTick();
        expect(vibrate).toHaveBeenCalledWith(HAPTIC_TICK_MS);
        expect(document.querySelectorAll('.haptic-switch').length).toBe(0);
    });

    it('ទិសផ្ទុយ ៖ browser គ្មាន switch (Chromium · Firefox) ➜ គ្មានធាតុ · មិន throw · សាកម្តងទៀតក៏គ្មាន', async () => {
        const { hapticTick } = await freshHaptics();
        expect(() => { hapticTick(); hapticTick(); }).not.toThrow();
        expect(document.querySelectorAll('.haptic-switch').length).toBe(0);
    });

    it('⛔ ធាតុមិនយកការ focus · aria-hidden', async () => {
        withSwitchSupport(true);
        const { hapticTick } = await freshHaptics();
        hapticTick();
        const label = document.querySelector('label.haptic-switch') as HTMLElement;
        expect(label.getAttribute('aria-hidden')).toBe('true');
        expect((label.querySelector('input') as HTMLInputElement).tabIndex).toBe(-1);
    });

    it('⛔ CSS ៖ .haptic-switch ក្រៅអេក្រង់ · មិន display: none (Safari លេងញ័រតែលើធាតុដែលគូរ)', () => {
        const css = readFileSync(path.join(__dirname, '..', 'src', 'styles', 'react-root.css'), 'utf8');
        const rule = css.match(/\.haptic-switch\s*\{([^}]*)\}/);
        expect(rule).toBeTruthy();
        expect(rule![1]).toMatch(/position:\s*fixed/);
        expect(rule![1]).toMatch(/pointer-events:\s*none/);
        expect(rule![1]).not.toMatch(/display:\s*none/);
    });
});
