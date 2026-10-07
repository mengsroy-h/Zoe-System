import { viewState } from '../core/view-state';
import { uiState } from '../core/state';
import { elapsedSince } from '../core/elapsed';
import { appLocalStore, safeStoreGet, safeStoreSet } from '../core/storage';
import { DISPLAY_HZ_PEAK_KEY } from '../core/storage-keys';

export const DISPLAY_HZ_MIN = 10;

export const DISPLAY_HZ_MAX = 120;

export const PERF_SAMPLE_FRAMES = 90;

export const PERF_LONG_FRAME_FACTOR = 1.6;

export const PERF_LONG_FRAME_FLOOR_MS = 12;

export const PERF_LITE_RATIO = 0.34;

export const PERF_FIRST_SAMPLE_DELAY_MS = 1500;

export const PERF_SECOND_SAMPLE_DELAY_MS = 8000;

export const HIGH_REFRESH_HZ = 90;

export const DISPLAY_HZ_SAMPLES = 24;

export const SCROLL_HZ_GAP_MS = 5000;

export function displayFrameBudgetMs() {
    return 1000 / uiState.displayHz;
}

export function longFrameThresholdMs() {
    return Math.max(PERF_LONG_FRAME_FLOOR_MS, Math.round(displayFrameBudgetMs() * PERF_LONG_FRAME_FACTOR));
}

export function clampDisplayHz(hz) {
    if (!isFinite(hz) || hz <= 0) return DISPLAY_HZ_MIN;
    return Math.max(DISPLAY_HZ_MIN, Math.min(DISPLAY_HZ_MAX, Math.round(hz)));
}

function medianGap(gaps) {
    const sorted = gaps.slice().sort((a, b) => a - b);
    return sorted[sorted.length >> 1];
}

export function sampleFramePace(done) {
    const gaps = [];
    let last = 0;
    function tick(timestamp) {
        if (last && timestamp > last) gaps.push(timestamp - last);
        last = timestamp;
        if (gaps.length < PERF_SAMPLE_FRAMES) { requestAnimationFrame(tick); return; }
        uiState.displayHz = clampDisplayHz(1000 / medianGap(gaps));
        uiState.displayHzMeasured = true;
        const longFrameMs = longFrameThresholdMs();
        done(gaps.filter((gap) => gap > longFrameMs).length / gaps.length);
    }
    requestAnimationFrame(tick);
}

export function rememberedDisplayHzPeak() {
    const stored = Number(safeStoreGet(appLocalStore, DISPLAY_HZ_PEAK_KEY));
    return isFinite(stored) && stored >= DISPLAY_HZ_MIN ? clampDisplayHz(stored) : 0;
}

export function deviceIsHighRefresh() {
    return uiState.displayHzPeak >= HIGH_REFRESH_HZ;
}

export function noteDisplayHzPeak(hz) {
    if (!isFinite(hz) || hz <= 0) return;
    const next = clampDisplayHz(hz);
    if (next <= uiState.displayHzPeak) return;
    uiState.displayHzPeak = next;
    safeStoreSet(appLocalStore, DISPLAY_HZ_PEAK_KEY, next);
    if (deviceIsHighRefresh()) viewState.perfLite = false;
}

export const scrollHzSampler = { sampling: false, lastAt: 0 };

export function sampleScrollHz() {
    if (scrollHzSampler.sampling) return;
    if (elapsedSince(scrollHzSampler.lastAt) < SCROLL_HZ_GAP_MS) return;
    scrollHzSampler.sampling = true;
    scrollHzSampler.lastAt = Date.now();
    const gaps = [];
    let last = 0;
    const tick = (timestamp) => {
        if (last && timestamp > last) gaps.push(timestamp - last);
        last = timestamp;
        if (gaps.length < DISPLAY_HZ_SAMPLES) {
            try { requestAnimationFrame(tick); } catch (e) { scrollHzSampler.sampling = false; }
            return;
        }
        scrollHzSampler.sampling = false;
        noteDisplayHzPeak(1000 / medianGap(gaps));
    };
    try {
        requestAnimationFrame(tick);
    } catch (e) {
        scrollHzSampler.sampling = false;
    }
}

export function setupAdaptivePerformance() {
    if (uiState.perfSamplePending) return;
    uiState.perfSamplePending = true;
    noteDisplayHzPeak(rememberedDisplayHzPeak());
    setTimeout(() => {
        sampleFramePace((firstRatio) => {
            if (firstRatio < PERF_LITE_RATIO || deviceIsHighRefresh()) { uiState.perfSamplePending = false; return; }
            setTimeout(() => {
                sampleFramePace((secondRatio) => {
                    uiState.perfSamplePending = false;
                    if (secondRatio >= PERF_LITE_RATIO && !deviceIsHighRefresh()) viewState.perfLite = true;
                });
            }, PERF_SECOND_SAMPLE_DELAY_MS);
        });
    }, PERF_FIRST_SAMPLE_DELAY_MS);
}
