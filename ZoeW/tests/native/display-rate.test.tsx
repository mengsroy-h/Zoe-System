/**
 * ⛔ ចង្វាក់អេក្រង់ពិតលើទូរស័ព្ទ ៖ ROM Android ជាច្រើនឲ្យ Chrome រត់ 90/120Hz តែកំណត់ App ផ្សេងត្រឹម 60Hz បើ App មិនស្នើ ➜ APK
 *    មើលទៅមិនរលូនដូច PWA ទោះកូដ JavaScript ដដែល។ ម៉ាស៊ីន audit (Chromium លើ server) វាស់វាមិនបាន ➜ App បង្ហាញលេខ Hz ពិត
 *    (rAF ដែល WebView/Chrome ផ្តល់) និងកំណែម៉ាស៊ីន ក្រោមលេខកំណែក្នុងរបា Slide ➜ ម្ចាស់គម្រោងប្រៀប PWA ធៀប APK លើទូរស័ព្ទបានផ្ទាល់។
 * ⛔ ទិសផ្ទុយ ៖ ការវាស់មិនស្ទួន (ការបើករបាជាប់ៗ) · rAF អវត្តមាន/បោះ ➜ មិនគាំង · តម្លៃខុស ➜ មិនបង្ហាញលេខក្លែង។
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { displayRateLabel, engineLabel, measureDisplayRateForDrawer, noteScrollFrameRate, scrollFrameRate, DISPLAY_RATE_SAMPLES, SCROLL_RATE_GAP_MS, SCROLL_RATE_SAMPLES } from '../../src/ui/perf';
import { openSideDrawer, closeSideDrawer } from '../../src/ui/page-nav';
import { viewState } from '../../src/core/view-state';
import { SideDrawer } from '../../src/app/components/SideDrawer';
import { mount, step, unmount } from './react-harness';

const WEBVIEW_UA = 'Mozilla/5.0 (Linux; Android 14; RMX3761 Build/UP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/140.0.7339.51 Mobile Safari/537.36';
const CHROME_UA = 'Mozilla/5.0 (Linux; Android 14; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36';
const IOS_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';

function fakeFrames(intervalMs: number) {
    const queue: Array<(t: number) => void> = [];
    let now = 1000;
    vi.stubGlobal('requestAnimationFrame', (cb: (t: number) => void) => { queue.push(cb); return queue.length; });
    return {
        calls: () => queue.length,
        run(frames: number) {
            for (let i = 0; i < frames && queue.length; i++) {
                const cb = queue.shift()!;
                now += intervalMs;
                cb(now);
            }
        }
    };
}

afterEach(() => {
    vi.unstubAllGlobals();
    viewState.displayRateText = '';
    scrollFrameRate.peak = 0;
    scrollFrameRate.sampling = false;
    scrollFrameRate.lastAt = 0;
    closeSideDrawer();
});

describe('engineLabel ៖ WebView (APK) ធៀប Chrome (PWA) ធៀប Safari', () => {
    it('WebView មានសញ្ញា «; wv)» ➜ WebView · Chrome ➜ Chrome · iPhone ➜ Safari · ទទេ ➜ ទទេ', () => {
        expect(engineLabel(WEBVIEW_UA)).toBe('WebView 140');
        expect(engineLabel(CHROME_UA)).toBe('Chrome 140');
        expect(engineLabel(IOS_UA)).toBe('Safari 18');
        expect(engineLabel('')).toBe('');
        expect(engineLabel(undefined)).toBe('');
    });
});

describe('displayRateLabel', () => {
    it('បង្គត់ · clamp · តម្លៃខុសមិនបង្ហាញលេខក្លែង', () => {
        expect(displayRateLabel(119.6, 'WebView 140')).toBe('ស៊ុម App 120fps · WebView 140');
        expect(displayRateLabel(60.2, '')).toBe('ស៊ុម App 60fps');
        expect(displayRateLabel(1000, 'Chrome 140')).toBe('ស៊ុម App 240fps · Chrome 140');
        expect(displayRateLabel(60.2, 'Chrome 154', 119.4)).toBe('ស៊ុម App 60fps · ពេលរមូរ 119fps · Chrome 154');
        expect(displayRateLabel(60.2, 'Chrome 154', 0)).toBe('ស៊ុម App 60fps · Chrome 154');
        expect(displayRateLabel(60.2, 'Chrome 154', NaN)).toBe('ស៊ុម App 60fps · Chrome 154');
        expect(displayRateLabel(NaN, 'Chrome 140')).toBe('Chrome 140');
        expect(displayRateLabel(Infinity, '')).toBe('');
    });
});

describe('measureDisplayRateForDrawer ៖ វាស់ពី rAF ពិត', () => {
    it('ចន្លោះ 8.33ms ➜ 120Hz · 16.67ms ➜ 60Hz (median មិនរងឥទ្ធិពលស៊ុមយឺតម្តងម្កាល)', () => {
        vi.stubGlobal('navigator', { userAgent: WEBVIEW_UA });
        const fast = fakeFrames(1000 / 120);
        measureDisplayRateForDrawer();
        fast.run(DISPLAY_RATE_SAMPLES + 2);
        expect(viewState.displayRateText).toBe('ស៊ុម App 120fps · WebView 140');

        vi.unstubAllGlobals();
        vi.stubGlobal('navigator', { userAgent: CHROME_UA });
        const slow = fakeFrames(1000 / 60);
        measureDisplayRateForDrawer();
        slow.run(DISPLAY_RATE_SAMPLES + 2);
        expect(viewState.displayRateText).toBe('ស៊ុម App 60fps · Chrome 140');
    });

    it('ហៅជាប់ៗ ➜ ការវាស់តែមួយ (មិនបង្កើតរង្វិល rAF ស្ទួន)', () => {
        vi.stubGlobal('navigator', { userAgent: CHROME_UA });
        const frames = fakeFrames(1000 / 90);
        measureDisplayRateForDrawer();
        measureDisplayRateForDrawer();
        measureDisplayRateForDrawer();
        expect(frames.calls()).toBe(1);
        frames.run(DISPLAY_RATE_SAMPLES + 2);
        expect(viewState.displayRateText).toBe('ស៊ុម App 90fps · Chrome 140');
    });

    it('rAF បោះ ➜ មិនគាំង ហើយការវាស់លើកក្រោយនៅដើរ', () => {
        vi.stubGlobal('requestAnimationFrame', () => { throw new Error('no frames'); });
        expect(() => measureDisplayRateForDrawer()).not.toThrow();
        vi.unstubAllGlobals();
        vi.stubGlobal('navigator', { userAgent: WEBVIEW_UA });
        const frames = fakeFrames(1000 / 60);
        measureDisplayRateForDrawer();
        frames.run(DISPLAY_RATE_SAMPLES + 2);
        expect(viewState.displayRateText).toBe('ស៊ុម App 60fps · WebView 140');
    });
});

describe('SideDrawer ពិត ៖ បន្ទាត់ក្រោមលេខកំណែ', () => {
    it('មិនទាន់វាស់ ➜ គ្មានបន្ទាត់ · វាស់រួច ➜ លេចអត្ថបទដដែល', () => {
        mount(<SideDrawer />);
        expect(document.getElementById('displayRateLine')).toBeNull();
        step(() => { viewState.displayRateText = 'ស៊ុម App 60fps · WebView 140'; });
        expect(document.getElementById('displayRateLine')!.textContent).toBe('ស៊ុម App 60fps · WebView 140');
        unmount();
    });
});

describe('ការបើករបា Slide កេះការវាស់', () => {
    it('openSideDrawer() ➜ វាស់ ហើយសរសេរ viewState.displayRateText', () => {
        vi.stubGlobal('navigator', { userAgent: WEBVIEW_UA });
        const frames = fakeFrames(1000 / 120);
        openSideDrawer();
        expect(frames.calls()).toBeGreaterThan(0);
        frames.run(DISPLAY_RATE_SAMPLES + 2);
        expect(viewState.displayRateText).toContain('120fps');
    });
});

/**
 * ⛔ អេក្រង់ប្តូរល្បឿន (LTPO · 10–120Hz) ៖ ម្ចាស់គម្រោងឃើញ «60» ក្នុងរបា Slide ខណៈ overlay «Show refresh rate» របស់ Android បង្ហាញ
 *    10–120Hz ➜ ការវាស់ពេលបើករបា (ម្រាមដៃលើករួច) ឃើញតែ ៦០ ➜ ការវាស់ **ពេលរមូរពិត** ជាលេខដែលមានន័យពេលប្រៀប APK និង PWA។
 */
describe('noteScrollFrameRate ៖ ស៊ុមពេលរមូរ', () => {
    it('រមូរ ➜ វាស់ ២០ ស៊ុម ➜ អតិបរមា (peak) ចូលក្នុងស្លាកពេលបើករបា', () => {
        vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (Linux; Android 14; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Mobile Safari/537.36' });
        const fast = fakeFrames(1000 / 120);
        noteScrollFrameRate();
        fast.run(SCROLL_RATE_SAMPLES + 2);
        expect(Math.round(scrollFrameRate.peak)).toBe(120);
        expect(scrollFrameRate.sampling).toBe(false);
        vi.unstubAllGlobals();
        vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (Linux; Android 14; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Mobile Safari/537.36' });
        const idle = fakeFrames(1000 / 60);
        measureDisplayRateForDrawer();
        idle.run(DISPLAY_RATE_SAMPLES + 2);
        expect(viewState.displayRateText).toBe('ស៊ុម App 60fps · ពេលរមូរ 120fps · Chrome 154');
    });

    it('រមូរជាប់ៗ ➜ ការវាស់តែមួយ · ក្នុង ៥ វិ. មិនវាស់ម្តងទៀត · ក្រោយ ៥ វិ. វាស់វិញ · peak មិនធ្លាក់ពេលស៊ុមយឺត', () => {
        const now = vi.spyOn(Date, 'now');
        now.mockReturnValue(1_000_000);
        const f1 = fakeFrames(1000 / 120);
        noteScrollFrameRate();
        noteScrollFrameRate();
        expect(f1.calls()).toBe(1);
        f1.run(SCROLL_RATE_SAMPLES + 2);
        noteScrollFrameRate();
        expect(f1.calls()).toBe(0);
        now.mockReturnValue(1_000_000 + SCROLL_RATE_GAP_MS + 1);
        const f2 = fakeFrames(1000 / 60);
        noteScrollFrameRate();
        expect(f2.calls()).toBe(1);
        f2.run(SCROLL_RATE_SAMPLES + 2);
        expect(Math.round(scrollFrameRate.peak)).toBe(120);
        now.mockRestore();
    });

    it('rAF បោះ ឬអវត្តមាន ➜ មិនគាំង · មិនជាប់ក្នុងស្ថានភាព «កំពុងវាស់»', () => {
        vi.stubGlobal('requestAnimationFrame', () => { throw new Error('no frames'); });
        expect(() => noteScrollFrameRate()).not.toThrow();
        expect(scrollFrameRate.sampling).toBe(false);
        vi.stubGlobal('requestAnimationFrame', undefined);
        scrollFrameRate.lastAt = 0;
        expect(() => noteScrollFrameRate()).not.toThrow();
        expect(scrollFrameRate.sampling).toBe(false);
    });
});
