/**
 * ចង្វាក់ស៊ុមសម្រប ១០–១២០Hz ↔ អេក្រង់ LTPO (សំណើម្ចាស់គម្រោង ៖ «ពិនិត្យមើល adaptive refresh rate 10-120hz មើលដំណើរការទេ និងអោយវា
 * វៃឆ្លាតស្គាល់ device ណាដែល refresh rate ខ្ពស់»)។ rAF ក្លែងដែលកំណត់ចន្លោះស៊ុមនីមួយៗ ➜ `setupAdaptivePerformance()` ពិត ៖
 *   ⛔ មុនកែ ៖ វាស់ Hz ក្នុងបង្អួចមួយ (១២០) ហើយស៊ុមកកក្នុងបង្អួចបន្ទាប់ (អេក្រង់ចុះ ៦០) ➜ ស៊ុម ៦០Hz ធម្មតារាប់ជា «កក» ➜ perf-lite ខុស ·
 *      ឧបករណ៍យឺតពិត (៤៥% ស៊ុម ៥០ms) ➜ «អេក្រង់ 20Hz» ➜ មិនដែល perf-lite។
 *   ✅ ក្រោយកែ ៖ Hz និងស៊ុមកកវាស់ក្នុងបង្អួចតែមួយ · Hz ខ្ពស់បំផុតរៀនពីការរមូរពិត ចងចាំតាមឧបករណ៍ · ≥ HIGH_REFRESH_HZ ➜ មិន perf-lite។
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { uiState } from '../src/core/state';
import { viewState } from '../src/core/view-state';
import { DISPLAY_HZ_PEAK_KEY } from '../src/core/storage-keys';
import {
    HIGH_REFRESH_HZ, SCROLL_HZ_GAP_MS, DISPLAY_HZ_SAMPLES, deviceIsHighRefresh, noteDisplayHzPeak, rememberedDisplayHzPeak,
    sampleScrollHz, scrollHzSampler, setupAdaptivePerformance
} from '../src/ui/perf';

function frames(intervalFor: (n: number) => number) {
    let now = 0;
    let n = 0;
    const queue: Array<(t: number) => void> = [];
    vi.stubGlobal('requestAnimationFrame', (fn: (t: number) => void) => { queue.push(fn); return queue.length; });
    return () => {
        for (let guard = 0; guard < 20000; guard++) {
            if (queue.length) { const fn = queue.shift()!; now += intervalFor(n++); fn(now); continue; }
            if (!vi.getTimerCount()) break;
            vi.advanceTimersToNextTimer();
        }
    };
}

const HZ120 = 1000 / 120;
const HZ60 = 1000 / 60;

function adaptive(intervalFor: (n: number) => number) {
    vi.useFakeTimers();
    const run = frames(intervalFor);
    setupAdaptivePerformance();
    run();
    return { lite: viewState.perfLite, hz: uiState.displayHz, pending: uiState.perfSamplePending };
}

beforeEach(() => {
    localStorage.clear();
    uiState.displayHzPeak = 0;
    uiState.displayHz = 60;
    uiState.perfSamplePending = false;
    viewState.perfLite = false;
    scrollHzSampler.sampling = false;
    scrollHzSampler.lastAt = 0;
});

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('ចង្វាក់ស៊ុមសម្រប ↔ LTPO · ស្គាល់ឧបករណ៍ Hz ខ្ពស់', () => {
    it('អេក្រង់ ១២០ ថេរ · ៦០ ថេរ ➜ វាស់ត្រូវ · មិន perf-lite', () => {
        expect(adaptive(() => HZ120)).toEqual({ lite: false, hz: 120, pending: false });
        uiState.perfSamplePending = false;
        expect(adaptive(() => HZ60)).toEqual({ lite: false, hz: 60, pending: false });
    });

    it('⛔ LTPO ៖ ស៊ុមដំបូង ១២០ (ការប៉ះ) រួចចុះ ៦០ ពេលស្ងៀម ➜ ស៊ុម ៦០Hz មិនមែន «កក» ➜ មិន perf-lite', () => {
        const r = adaptive((n) => ((n % 115) < 25 ? HZ120 : HZ60));
        expect(r.lite).toBe(false);
        expect(r.pending).toBe(false);
    });

    it('⛔ ឧបករណ៍យឺតពិត (៤៥% ស៊ុម ៥០ms លើអេក្រង់ ៦០) ទាំង ២ ជុំ ➜ perf-lite · Hz = ៦០ (មិនមែន ២០)', () => {
        const r = adaptive((n) => (n % 20 < 9 ? 50 : HZ60));
        expect(r).toEqual({ lite: true, hz: 60, pending: false });
    });

    it('រវល់តែពេល boot (ជុំទី ១) ➜ ជុំទី ២ ស្រួល ➜ មិន perf-lite', () => {
        expect(adaptive((n) => (n < 91 && n % 2 ? 50 : HZ60)).lite).toBe(false);
    });

    it('រមូរពិត ➜ រៀន Hz ខ្ពស់បំផុត · ចងចាំក្នុងឧបករណ៍ · ម្តងក្នុង SCROLL_HZ_GAP_MS · មិនធ្លាក់', () => {
        vi.useFakeTimers();
        vi.setSystemTime(1_000_000);
        let hz = HZ120;
        const run = frames(() => hz);
        sampleScrollHz();
        sampleScrollHz();
        run();
        expect(uiState.displayHzPeak).toBe(120);
        expect(localStorage.getItem(DISPLAY_HZ_PEAK_KEY)).toBe('120');
        expect(deviceIsHighRefresh()).toBe(true);
        hz = HZ60;
        sampleScrollHz();
        run();
        expect(scrollHzSampler.sampling).toBe(false);
        vi.setSystemTime(1_000_000 + SCROLL_HZ_GAP_MS + 1);
        sampleScrollHz();
        run();
        expect(uiState.displayHzPeak).toBe(120);
        expect(DISPLAY_HZ_SAMPLES).toBeGreaterThan(10);
    });

    it('ឧបករណ៍ដែលធ្លាប់រមូរ ≥ HIGH_REFRESH_HZ (ចងចាំពីលើកមុន) ➜ មិន perf-lite ទោះស៊ុមពេល boot កក · perf-lite ដែលដាក់រួចត្រូវដក', () => {
        localStorage.setItem(DISPLAY_HZ_PEAK_KEY, String(HIGH_REFRESH_HZ));
        expect(adaptive((n) => (n % 20 < 9 ? 50 : HZ60)).lite).toBe(false);
        uiState.displayHzPeak = 0;
        viewState.perfLite = true;
        noteDisplayHzPeak(HIGH_REFRESH_HZ - 1);
        expect(viewState.perfLite).toBe(true);
        noteDisplayHzPeak(120);
        expect(viewState.perfLite).toBe(false);
    });

    it('តម្លៃចងចាំខូច ➜ ០ · តម្លៃធំពេក ➜ ១២០ · storage បិទ/បោះ ➜ មិនបោះ', () => {
        for (const [raw, want] of [['abc', 0], ['5', 0], ['', 0], ['999', 120], ['90', 90]] as Array<[string, number]>) {
            localStorage.setItem(DISPLAY_HZ_PEAK_KEY, raw);
            expect(rememberedDisplayHzPeak()).toBe(want);
        }
        vi.spyOn(localStorage, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
        vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
        expect(rememberedDisplayHzPeak()).toBe(0);
        expect(() => noteDisplayHzPeak(120)).not.toThrow();
        expect(uiState.displayHzPeak).toBe(120);
        for (const bad of [NaN, -1, 0, Infinity, undefined, null]) expect(() => noteDisplayHzPeak(bad as any)).not.toThrow();
    });

    it('rAF បោះ ➜ ការវាស់ពេលរមូរមិនជាប់ «កំពុងវាស់»', () => {
        vi.stubGlobal('requestAnimationFrame', () => { throw new Error('no raf'); });
        expect(() => sampleScrollHz()).not.toThrow();
        expect(scrollHzSampler.sampling).toBe(false);
    });
});
