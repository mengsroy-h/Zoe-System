/**
 * 🔍 ការវាស់ស៊ុមពេលបើក/បិទ modal · ម៉ឺនុយ ➜ Sentry (បណ្តោះអាសន្ន · សំណើម្ចាស់គម្រោង ៖ «ផ្ញើទៅ Sentry ទៅ»)
 *    APK ៖ «រមូរដល់ចុង បើកធុងសំរាម/បញ្ជី ZTO អាក់ · PWA រលូន» ហើយ Chromium មិនបង្កើតឡើងវិញ ➜ វាស់លើទូរស័ព្ទពិត ៖ ចន្លោះ rAF
 *    យូរបំផុតក្នុង OVERLAY_PROBE_MS + long-animation-frame (JS · rAF · layout/គូរ · script ធំបំផុត) ➜ `ZoeErrors.capture` (`zone: 'perf'`)។
 *    ⛔ មិនបង្ហាញលើអេក្រង់ · តែ App Android · គ្មានទិន្នន័យអតិថិជន។
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { uiState } from '../src/core/state';
import {
    OVERLAY_FRAMES_MAX, OVERLAY_PROBE_MS, loafDetailOf, noteOverlayFrames, overlayChangeLabel, overlaySignature, overlayTelemetry, overlayTelemetryEnabled,
    reportOverlaySample, setupOverlayTelemetry, startOverlayProbe, summarizeOverlay
} from '../src/ui/overlay-telemetry';

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    overlayTelemetry.frames.length = 0;
    delete (window as any).ZoeErrors;
});

describe('🔍 ការវាស់ស៊ុមពេលបើក/បិទស្រទាប់ (Sentry)', () => {
    it('ហត្ថលេខា · ស្លាក', () => {
        expect(overlaySignature({ modalDisplay: { b: 'flex', a: 'flex', c: 'none' }, drawerOpen: true, notifyDrawerOpen: true, moreMenuOpen: true }))
            .toBe('a,b,drawer,notify,menu');
        expect(overlaySignature({ modalDisplay: {} })).toBe('');
        expect(overlaySignature(null)).toBe('');
        expect(overlayChangeLabel('', 'recentlyDeletedModal')).toBe('open recentlyDeletedModal');
        expect(overlayChangeLabel('menu', 'recentlyDeletedModal')).toBe('open recentlyDeletedModal');
        expect(overlayChangeLabel('drawer', '')).toBe('close drawer');
        expect(overlayChangeLabel('a', 'a')).toBe('');
    });

    it('long-animation-frame ➜ JS · rAF · layout/គូរ + script ធំបំផុត · ទិន្នន័យខូចមិនបោះ · buffer មានពិដាន', () => {
        expect(loafDetailOf({ startTime: 100, duration: 80, renderStart: 140, styleAndLayoutStart: 150,
            scripts: [{ invoker: 'DIV.onclick', duration: 30, forcedStyleAndLayoutDuration: 12 }, { sourceFunctionName: 'openModalHelper', duration: 35 }] }))
            .toEqual({ at: 100, ms: 80, task: 40, raf: 10, draw: 30, top: { name: 'openModalHelper', ms: 35, forced: 0 } });
        const noRender = loafDetailOf({ startTime: 0, duration: 60 })!;
        expect([noRender.task, noRender.raf, noRender.draw]).toEqual([60, 0, 0]);
        for (const bad of [undefined, null, 5, 'x', [], {}, { startTime: NaN, duration: 9 }, { startTime: 1, duration: 0 }]) {
            expect(loafDetailOf(bad)).toBe(null);
        }
        noteOverlayFrames(Array.from({ length: OVERLAY_FRAMES_MAX + 7 }, (_, i) => ({ startTime: i, duration: 55 })));
        noteOverlayFrames(null);
        expect(overlayTelemetry.frames.length).toBe(OVERLAY_FRAMES_MAX);
        expect(overlayTelemetry.frames[0].at).toBe(7);
    });

    it('សរុប ៖ បូក JS · rAF · layout/គូរ · script ធំបំផុត', () => {
        expect(summarizeOverlay('open x', 74.4, 8.6, [])).toMatchObject({ label: 'open x', gapMs: 74, firstMs: 9, loafCount: 0, loafMs: 0, topScript: '' });
        expect(summarizeOverlay('open x', 120, 9, [
            { at: 0, ms: 60, task: 40, raf: 5, draw: 15, top: { name: 'a', ms: 30, forced: 8 } },
            { at: 70, ms: 55, task: 5, raf: 0, draw: 50, top: null }
        ])).toEqual({ label: 'open x', gapMs: 120, firstMs: 9, loafCount: 2, loafMs: 115, taskMs: 45, rafMs: 5, drawMs: 65, topScript: 'a', topMs: 30, forcedMs: 8 });
    });

    it('វាស់ក្នុងបង្អួចកំណត់ ៖ ចន្លោះ rAF យូរបំផុត · ស៊ុមដែលជាន់បង្អួច · rAF ឈប់ក្រោយបង្អួច', () => {
        vi.useFakeTimers();
        let now = 1000;
        const queue: Array<(t: number) => void> = [];
        vi.stubGlobal('performance', { now: () => now });
        vi.stubGlobal('requestAnimationFrame', (fn: (t: number) => void) => { queue.push(fn); return queue.length; });
        overlayTelemetry.frames.push({ at: 990, ms: 60, task: 50, raf: 0, draw: 10, top: null });
        overlayTelemetry.frames.push({ at: 100, ms: 60, task: 60, raf: 0, draw: 0, top: null });
        const done = vi.fn();
        startOverlayProbe('open recentlyDeletedModal', done);
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
        expect(done).not.toHaveBeenCalled();
        vi.runAllTimers();
        expect(done).toHaveBeenCalledTimes(1);
        expect(done.mock.calls[0][0]).toMatchObject({ label: 'open recentlyDeletedModal', gapMs: 66, firstMs: 8, loafCount: 1, loafMs: 60, taskMs: 50 });
    });

    it('ផ្ញើទៅ Sentry ៖ zone perf · លេខ + ស្ថានភាពតារាង · គ្មាន ZoeErrors ➜ មិនបោះ', () => {
        const capture = vi.fn();
        (window as any).ZoeErrors = { capture };
        uiState.historyView = new Array(92).fill({});
        uiState.historyRenderLimit = 100;
        uiState.chromeHidden = true;
        reportOverlaySample(summarizeOverlay('open ztoListSyncModal', 80, 9, []));
        expect(capture).toHaveBeenCalledTimes(1);
        const [err, extra] = capture.mock.calls[0];
        expect(err.message).toBe('Perf overlay open ztoListSyncModal');
        expect(extra).toMatchObject({ zone: 'perf', context: 'overlay-frame', gapMs: 80, rowsShown: 92, rowsTotal: 92, chromeHidden: true });
        expect(typeof extra.itemId).toBe('string');
        delete (window as any).ZoeErrors;
        expect(() => reportOverlaySample(summarizeOverlay('close x', 1, 1, []))).not.toThrow();
        uiState.historyView = null;
        uiState.chromeHidden = false;
    });

    it('⛔ APK ផ្លូវការ (គ្មាន VITE_PERF_TELEMETRY) ៖ មិនដំឡើង ទោះជា App Android · APK សាក (=1) ➜ វាស់', () => {
        const capture = vi.fn();
        (window as any).ZoeErrors = { capture };
        const raf = vi.fn();
        vi.stubGlobal('requestAnimationFrame', raf);
        vi.stubGlobal('Capacitor', { isNativePlatform: () => true, getPlatform: () => 'android' });
        expect(overlayTelemetryEnabled()).toBe(false);
        vi.stubEnv('VITE_PERF_TELEMETRY', '0');
        expect(overlayTelemetryEnabled()).toBe(false);
        vi.stubEnv('VITE_PERF_TELEMETRY', '1');
        expect(overlayTelemetryEnabled()).toBe(true);
        vi.unstubAllGlobals();
        expect(overlayTelemetryEnabled()).toBe(false);
        vi.unstubAllEnvs();
    });

    it('⛔ web/PWA ៖ មិនដំឡើង (គ្មាន bridge Capacitor) · គ្មាន rAF/performance ➜ មិនបោះ', () => {
        const capture = vi.fn();
        (window as any).ZoeErrors = { capture };
        const raf = vi.fn();
        vi.stubGlobal('requestAnimationFrame', raf);
        setupOverlayTelemetry();
        uiState.drawerOpen = true;
        uiState.flush();
        uiState.drawerOpen = false;
        uiState.flush();
        expect(raf).not.toHaveBeenCalled();
        expect(capture).not.toHaveBeenCalled();
        vi.stubGlobal('requestAnimationFrame', undefined);
        expect(() => startOverlayProbe('open x', () => {})).not.toThrow();
        vi.unstubAllGlobals();
        vi.stubGlobal('performance', { now: () => { throw new Error('x'); } });
        expect(() => startOverlayProbe('open x', () => {})).not.toThrow();
    });
});
