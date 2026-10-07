/**
 * 🔍 ការវាស់ស៊ុមពេលបើក/បិទ modal · ម៉ឺនុយ (សំណើម្ចាស់គម្រោង ៖ «APK រមូរដល់ចុង បើកធុងសំរាម/បញ្ជី ZTO នៅអាក់ · PWA រលូន»)
 *    Chromium មិនបង្កើតការកកនេះឡើងវិញ ➜ App វាស់លើទូរស័ព្ទពិត ៖ ចន្លោះ rAF យូរបំផុតក្នុង OVERLAY_PROBE_MS ក្រោយការប្តូរ +
 *    long-animation-frame ដែលជាន់បង្អួចនោះ (JS · rAF · layout/គូរ · script ធំបំផុត) ➜ បង្ហាញក្នុងជើងម៉ឺនុយ ☰។
 *    ចន្លោះស៊ុមធំ តែ main thread គ្មានស៊ុមកក ➜ ការកកនៅក្រៅ JS/layout (WebView · Android)។
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { uiState } from '../src/core/state';
import { viewState } from '../src/core/view-state';
import {
    OVERLAY_PROBE_KEEP, OVERLAY_PROBE_MS, loafDetailOf, noteJankEntries, overlayChangeLabel, overlayProbe, overlayProbeLine,
    overlaySignature, startOverlayProbe
} from '../src/ui/perf';

describe('🔍 ការវាស់ស៊ុមពេលបើក/បិទស្រទាប់', () => {
    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
        overlayProbe.frames.length = 0;
        viewState.overlayProbeLines = [];
    });

    it('ហត្ថលេខាស្រទាប់ ៖ modal ដែលបើក (តម្រៀប) · ម៉ឺនុយ · 🔔 · (...)', () => {
        expect(overlaySignature({ modalDisplay: { b: 'flex', a: 'flex', c: 'none' }, drawerOpen: true, notifyDrawerOpen: false, moreMenuOpen: true }))
            .toBe('a,b,drawer,menu');
        expect(overlaySignature({ modalDisplay: {} })).toBe('');
        expect(overlaySignature(null)).toBe('');
        expect(overlayChangeLabel('', 'recentlyDeletedModal')).toBe('បើក recentlyDeletedModal');
        expect(overlayChangeLabel('drawer', '')).toBe('បិទ drawer');
        expect(overlayChangeLabel('menu', 'recentlyDeletedModal')).toBe('បើក recentlyDeletedModal');
        expect(overlayChangeLabel('a', 'a')).toBe('');
    });

    it('long-animation-frame ➜ ចែក JS · rAF · layout/គូរ + script ធំបំផុត · ទិន្នន័យខូចមិនបោះ', () => {
        const d = loafDetailOf({ startTime: 100, duration: 80, renderStart: 140, styleAndLayoutStart: 150,
            scripts: [{ invoker: 'DIV.onclick', duration: 30, forcedStyleAndLayoutDuration: 12 }, { sourceFunctionName: 'openModalHelper', duration: 35 }] })!;
        expect(d).toEqual({ at: 100, ms: 80, task: 40, raf: 10, draw: 30, top: { name: 'openModalHelper', ms: 35, forced: 0 } });
        const noRender = loafDetailOf({ startTime: 0, duration: 60 })!;
        expect(noRender.task).toBe(60);
        expect(noRender.raf + noRender.draw).toBe(0);
        for (const bad of [undefined, null, 5, 'x', [], {}, { startTime: NaN, duration: 9 }, { startTime: 1, duration: 0 }]) {
            expect(loafDetailOf(bad)).toBe(null);
        }
        noteJankEntries([{ startTime: 1, duration: 55 }, null, { startTime: 2 }]);
        expect(overlayProbe.frames.length).toBe(1);
    });

    it('អត្ថបទ ៖ គ្មានស៊ុមកក ➜ ប្រាប់ថា main thread ស្អាត · មានស៊ុម ➜ បូកសរុប + script', () => {
        expect(overlayProbeLine('បើក x', 74.4, [])).toBe('🔍 បើក x ៖ ចន្លោះស៊ុម 74ms · main thread គ្មានស៊ុមកក');
        const line = overlayProbeLine('បើក x', 120, [
            { at: 0, ms: 60, task: 40, raf: 5, draw: 15, top: { name: 'a', ms: 30, forced: 8 } },
            { at: 70, ms: 55, task: 5, raf: 0, draw: 50, top: null }
        ]);
        expect(line).toBe('🔍 បើក x ៖ ចន្លោះស៊ុម 120ms · main 115ms (JS 45 · rAF 5 · layout/គូរ 65) · a 30ms (បង្ខំ layout 8)');
    });

    it('វាស់ក្នុងបង្អួចកំណត់ ៖ ចន្លោះ rAF យូរបំផុត · ស៊ុមដែលជាន់បង្អួច · ឈប់ rAF ក្រោយបង្អួច · រក្សាតែ OVERLAY_PROBE_KEEP បន្ទាត់', () => {
        vi.useFakeTimers();
        let now = 1000;
        const queue: Array<(t: number) => void> = [];
        vi.stubGlobal('performance', { now: () => now });
        vi.stubGlobal('requestAnimationFrame', (fn: (t: number) => void) => { queue.push(fn); return queue.length; });
        overlayProbe.frames.push({ at: 990, ms: 60, task: 50, raf: 0, draw: 10, top: null });
        overlayProbe.frames.push({ at: 100, ms: 60, task: 60, raf: 0, draw: 0, top: null });
        startOverlayProbe('បើក recentlyDeletedModal');
        const steps = [8, 8, 66, 8];
        let ticks = 0;
        while (queue.length && ticks < 500) {
            const fn = queue.shift()!;
            now += steps[ticks] !== undefined ? steps[ticks] : 8;
            ticks++;
            fn(now);
        }
        expect(queue.length).toBe(0);
        expect(ticks).toBeGreaterThan(OVERLAY_PROBE_MS / 10);
        expect(ticks).toBeLessThan(OVERLAY_PROBE_MS / 8 + 10);
        vi.runAllTimers();
        expect(viewState.overlayProbeLines).toEqual(['🔍 បើក recentlyDeletedModal ៖ ចន្លោះស៊ុម 66ms · main 60ms (JS 50 · rAF 0 · layout/គូរ 10)']);
        viewState.overlayProbeLines = ['1', '2', '3', '4'];
        startOverlayProbe('បិទ recentlyDeletedModal');
        while (queue.length) { const fn = queue.shift()!; now += 8; fn(now); }
        vi.runAllTimers();
        expect(viewState.overlayProbeLines.length).toBe(OVERLAY_PROBE_KEEP);
        expect(viewState.overlayProbeLines[OVERLAY_PROBE_KEEP - 1]).toMatch(/^🔍 បិទ recentlyDeletedModal ៖ ចន្លោះស៊ុម 8ms · main thread គ្មានស៊ុមកក$/);
    });

    it('គ្មាន rAF/performance ➜ មិនបោះ', () => {
        vi.stubGlobal('requestAnimationFrame', undefined);
        expect(() => startOverlayProbe('បើក x')).not.toThrow();
        vi.unstubAllGlobals();
        vi.stubGlobal('performance', { now: () => { throw new Error('x'); } });
        expect(() => startOverlayProbe('បើក x')).not.toThrow();
        expect(uiState).toBeTruthy();
    });
});
