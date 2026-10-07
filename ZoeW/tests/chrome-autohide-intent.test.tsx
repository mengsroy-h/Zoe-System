/**
 * ⛔ របា Tab ផ្លាស់ទីតែពេលអ្នកប្រើរមូរ (របាយការណ៍ម្ចាស់គម្រោង ៖ វីដេអូ APK «ញ៉ាក់» · «របា tap glitch»)
 *    វីដេអូ (~៩០fps) ៖ ក្រោយលើកម្រាមដៃ បញ្ជីនៅស្ងៀម (០px) តែរបាលាក់/លេចរៀងរាល់ ១–២ ស៊ុមរាប់វិនាទី ➜ ព្រឹត្តិការណ៍ `scroll` ដែលមិនមែន
 *    មកពីអ្នកប្រើ (ការកែទីតាំងរបស់បញ្ជីបង្ហាញតាមទីតាំងរមូរ · clamp ពេល padding បញ្ជីប្តូរតាមរបា) ត្រូវ `processScroll()` យល់ថាជាការរមូរ ➜
 *    របាប្តូរ ➜ ប្លង់ប្តូរ ➜ `scroll` ម្តងទៀត ➜ រង្វង់។ ច្បាប់ ៖ (១) នับតែ scroll ពេលប៉ះ/អូស ឬក្រោយ input ≤ CHROME_SCROLL_INTENT_MS
 *    (momentum) (២) ក្រោយ input ចុងក្រោយ របាប្តូរបាន ១ ដងប៉ុណ្ណោះ (៣) ក្រោយរបាប្តូរ មិនរាប់ scroll CHROME_FLIP_SETTLE_MS ·
 *    ការរមូរដល់កំពូលនៅបង្ហាញរបាដដែល។
 */
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { uiState } from '../src/core/state';
import { refTo } from '../src/app/refs';
import { CHROME_FLIP_SETTLE_MS, CHROME_SCROLL_INTENT_MS, setupChromeAutoHide } from '../src/app/behaviors/chrome-autohide';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function fakeScroller(parent: HTMLElement) {
    const el = document.createElement('div');
    el.style.overflowY = 'auto';
    let top = 0;
    Object.defineProperty(el, 'scrollHeight', { configurable: true, get: () => 8000 });
    Object.defineProperty(el, 'clientHeight', { configurable: true, get: () => 600 });
    Object.defineProperty(el, 'scrollTop', { configurable: true, get: () => top, set: (v) => { top = v; } });
    parent.appendChild(el);
    return el;
}

let list: HTMLElement;

function touch(type: string, active: boolean) {
    const event = new Event(type, { bubbles: true });
    Object.defineProperty(event, 'touches', { value: active ? [{}] : [] });
    list.dispatchEvent(event);
}

async function programmaticScroll(top: number) {
    list.scrollTop = top;
    list.dispatchEvent(new Event('scroll'));
    await wait(40);
}

async function userDrag(tops: number[]) {
    touch('touchstart', true);
    for (const top of tops) {
        touch('touchmove', true);
        await programmaticScroll(top);
    }
    touch('touchend', false);
}

async function settleAt(top: number) {
    await wait(CHROME_SCROLL_INTENT_MS + 20);
    await programmaticScroll(top);
    await wait(CHROME_FLIP_SETTLE_MS + 20);
}

function countFlips() {
    let flips = 0;
    let seen = uiState.chromeHidden;
    const off = uiState.subscribe(() => {
        if (uiState.chromeHidden === seen) return;
        seen = uiState.chromeHidden;
        flips++;
    });
    return { get: () => flips, off };
}

describe('របា Tab ↔ ការរមូររបស់អ្នកប្រើ', () => {
    beforeAll(() => {
        Object.defineProperty(window, 'innerWidth', { configurable: true, value: 412 });
        const pages = document.createElement('div');
        const navbar = document.createElement('nav');
        const tabbar = document.createElement('div');
        document.body.append(navbar, pages, tabbar);
        refTo('appPages')(pages);
        refTo('navbar')(navbar);
        refTo('pageTabBar')(tabbar);
        list = fakeScroller(pages);
        setupChromeAutoHide();
    });

    afterEach(async () => {
        await wait(CHROME_SCROLL_INTENT_MS + 20);
        await programmaticScroll(0);
        uiState.chromeHidden = false;
        uiState.flush();
        await wait(CHROME_FLIP_SETTLE_MS + 20);
    });

    it('អ្នកប្រើអូសចុះ ➜ លាក់ · អូសឡើង ➜ លេច (ការលាក់តាមទិសរមូរនៅដដែល)', async () => {
        await settleAt(1000);
        await userDrag([1100, 1200]);
        expect(uiState.chromeHidden).toBe(true);
        await wait(CHROME_FLIP_SETTLE_MS + 20);
        await userDrag([1150, 1080]);
        expect(uiState.chromeHidden).toBe(false);
    });

    it('⛔ scroll ដោយកម្មវិធី គ្មាន input ➜ មិនលាក់', async () => {
        await settleAt(1000);
        await programmaticScroll(1300);
        await programmaticScroll(1600);
        expect(uiState.chromeHidden).toBe(false);
    });

    it('⛔ រង្វង់ឧបករណ៍ ៖ របាប្តូរ ➜ ប្លង់ឆ្លើយតបដោយ scroll បញ្ច្រាស ➜ ក្រោយលើកម្រាមដៃ របាលែងលោត', async () => {
        await settleAt(1000);
        await userDrag([1100, 1200, 1300]);
        expect(uiState.chromeHidden).toBe(true);
        await wait(CHROME_FLIP_SETTLE_MS + 20);
        let busy = false;
        const feedback = uiState.subscribe(() => {
            if (busy) return;
            busy = true;
            const hidden = uiState.chromeHidden;
            setTimeout(async () => {
                for (const step of [1, 2, 3]) await programmaticScroll(list.scrollTop + (hidden ? -30 : 30) * step);
                busy = false;
            }, 5);
        });
        const flips = countFlips();
        await programmaticScroll(list.scrollTop - 70);
        await wait(900);
        feedback();
        flips.off();
        expect(flips.get()).toBeLessThanOrEqual(1);
    });

    it('momentum ក្រោយលើកម្រាមដៃ ➜ ប្តូរបាន ១ ដង · ផុត CHROME_SCROLL_INTENT_MS ➜ មិនប្តូរ', async () => {
        await settleAt(1000);
        await userDrag([1010]);
        expect(uiState.chromeHidden).toBe(false);
        await programmaticScroll(1060);
        expect(uiState.chromeHidden).toBe(true);
        await wait(CHROME_FLIP_SETTLE_MS + 20);
        await programmaticScroll(900);
        expect(uiState.chromeHidden).toBe(true);
        await wait(CHROME_SCROLL_INTENT_MS);
        touch('touchmove', true);
        await programmaticScroll(800);
        expect(uiState.chromeHidden).toBe(false);
    });

    it('ម្រាមដៃសង្កត់ស្ងៀម (គ្មាន touchmove) + scroll ដោយកម្មវិធី ➜ ប្តូរយ៉ាងច្រើន ១ ដង', async () => {
        await settleAt(1000);
        touch('touchstart', true);
        const flips = countFlips();
        for (let i = 0; i < 10; i++) {
            await programmaticScroll(1000 + (i % 2 ? 0 : 80));
            await wait(CHROME_FLIP_SETTLE_MS / 2);
        }
        uiState.flush();
        flips.off();
        touch('touchend', false);
        expect(flips.get()).toBeLessThanOrEqual(1);
    });

    it('ការរមូរដល់កំពូល (ឧ. ប្តូរតម្រង) ➜ បង្ហាញរបា ទោះគ្មាន input', async () => {
        await settleAt(1000);
        await userDrag([1100, 1200]);
        expect(uiState.chromeHidden).toBe(true);
        await wait(CHROME_SCROLL_INTENT_MS + 20);
        await programmaticScroll(20);
        expect(uiState.chromeHidden).toBe(false);
    });
});
