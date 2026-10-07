import { viewState } from '../core/view-state';
import { uiState } from '../core/state';

export const DISPLAY_HZ_MIN = 10;

export const DISPLAY_HZ_MAX = 120;

export const DISPLAY_HZ_SAMPLES = 24;

export const PERF_SAMPLE_FRAMES = 90;

export const PERF_LONG_FRAME_FACTOR = 1.6;

export const PERF_LONG_FRAME_FLOOR_MS = 12;

export const PERF_LITE_RATIO = 0.34;

export const PERF_FIRST_SAMPLE_DELAY_MS = 1500;

export const PERF_SECOND_SAMPLE_DELAY_MS = 8000;

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

export function measureDisplayHz(done) {
    const gaps = [];
    let last = 0;
    function tick(timestamp) {
        if (last && timestamp > last) gaps.push(timestamp - last);
        last = timestamp;
        if (gaps.length < DISPLAY_HZ_SAMPLES) { requestAnimationFrame(tick); return; }
        gaps.sort((a, b) => a - b);
        uiState.displayHz = clampDisplayHz(1000 / gaps[gaps.length >> 1]);
        uiState.displayHzMeasured = true;
        done(uiState.displayHz);
    }
    requestAnimationFrame(tick);
}

export function sampleFramePace(done) {
    const longFrameMs = longFrameThresholdMs();
    let frames = 0;
    let longFrames = 0;
    let last = 0;
    function tick(timestamp) {
        if (last) {
            if (timestamp - last > longFrameMs) longFrames++;
            frames++;
        }
        last = timestamp;
        if (frames < PERF_SAMPLE_FRAMES) { requestAnimationFrame(tick); return; }
        done(longFrames / frames);
    }
    requestAnimationFrame(tick);
}

export function setupAdaptivePerformance() {
    if (uiState.perfSamplePending) return;
    uiState.perfSamplePending = true;
    setTimeout(() => {
        measureDisplayHz(() => {
            sampleFramePace((firstRatio) => {
                if (firstRatio < PERF_LITE_RATIO) { uiState.perfSamplePending = false; return; }
                setTimeout(() => {
                    measureDisplayHz(() => {
                        sampleFramePace((secondRatio) => {
                            uiState.perfSamplePending = false;
                            if (secondRatio >= PERF_LITE_RATIO) viewState.perfLite = true;
                        });
                    });
                }, PERF_SECOND_SAMPLE_DELAY_MS);
            });
        });
    }, PERF_FIRST_SAMPLE_DELAY_MS);
}
