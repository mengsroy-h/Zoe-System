import { viewState } from '../core/view-state';
import { elapsedSince } from '../core/elapsed';
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

export const DISPLAY_RATE_SAMPLES = 30;

export const DISPLAY_RATE_MAX_HZ = 240;

let displayRateSampling = false;

export function engineLabel(ua) {
    const text = String(ua || '');
    const chrome = text.match(/Chrome\/(\d+)/);
    if (chrome) return (/;\s*wv\)/.test(text) ? 'WebView ' : 'Chrome ') + chrome[1];
    const safari = text.match(/Version\/(\d+)[^)]*Safari/) || text.match(/Version\/(\d+)/);
    if (safari && /AppleWebKit/.test(text)) return 'Safari ' + safari[1];
    return '';
}

export function frameRateText(hz) {
    return Math.max(DISPLAY_HZ_MIN, Math.min(DISPLAY_RATE_MAX_HZ, Math.round(hz))) + 'fps';
}

export function displayRateLabel(hz, engine, scrollHz?) {
    const parts = [];
    if (isFinite(hz) && hz > 0) parts.push('ស៊ុម App ' + frameRateText(hz));
    if (isFinite(scrollHz) && scrollHz > 0) parts.push('ពេលរមូរ ' + frameRateText(scrollHz));
    if (engine) parts.push(engine);
    return parts.join(' · ');
}

export function medianFrameRate(gaps) {
    const sorted = (Array.isArray(gaps) ? gaps : []).filter((g) => isFinite(g) && g > 0).sort((a, b) => a - b);
    return sorted.length ? 1000 / sorted[sorted.length >> 1] : NaN;
}

export const SCROLL_RATE_SAMPLES = 20;

export const SCROLL_RATE_GAP_MS = 5000;

export const scrollFrameRate = { peak: 0, sampling: false, lastAt: 0 };

export function noteScrollFrameRate() {
    if (scrollFrameRate.sampling) return;
    if (elapsedSince(scrollFrameRate.lastAt) < SCROLL_RATE_GAP_MS) return;
    scrollFrameRate.sampling = true;
    scrollFrameRate.lastAt = Date.now();
    const gaps = [];
    let last = 0;
    const tick = (timestamp) => {
        if (last && timestamp > last) gaps.push(timestamp - last);
        last = timestamp;
        if (gaps.length < SCROLL_RATE_SAMPLES) {
            try { requestAnimationFrame(tick); } catch (e) { scrollFrameRate.sampling = false; }
            return;
        }
        scrollFrameRate.sampling = false;
        const hz = medianFrameRate(gaps);
        if (isFinite(hz) && hz > scrollFrameRate.peak) scrollFrameRate.peak = hz;
    };
    try {
        requestAnimationFrame(tick);
    } catch (e) {
        scrollFrameRate.sampling = false;
    }
}

export function measureDisplayRateForDrawer() {
    if (displayRateSampling || typeof requestAnimationFrame !== 'function') return;
    displayRateSampling = true;
    const gaps = [];
    let last = 0;
    const tick = (timestamp) => {
        if (last && timestamp > last) gaps.push(timestamp - last);
        last = timestamp;
        if (gaps.length < DISPLAY_RATE_SAMPLES) { requestAnimationFrame(tick); return; }
        displayRateSampling = false;
        const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
        viewState.displayRateText = displayRateLabel(medianFrameRate(gaps), engineLabel(ua), scrollFrameRate.peak);
    };
    try {
        requestAnimationFrame(tick);
    } catch (e) {
        displayRateSampling = false;
    }
}

export const JANK_WINDOW_MS = 5 * 60 * 1000;

export const JANK_BUFFER_MAX = 300;

export const JANK_ENTRY_TYPES = ['long-animation-frame', 'longtask'];

export const jankMonitor: { type: string; started: boolean; entries: Array<{ at: number; ms: number }> } = {
    type: '',
    started: false,
    entries: []
};

export function pickJankEntryType(supported) {
    const list = Array.isArray(supported) ? supported : [];
    return JANK_ENTRY_TYPES.find((type) => list.indexOf(type) !== -1) || '';
}

export function noteJankEntries(list) {
    if (!Array.isArray(list)) return;
    for (const entry of list) {
        const at = Number(entry && entry.startTime);
        const ms = Number(entry && entry.duration);
        if (!isFinite(at) || !isFinite(ms) || ms <= 0) continue;
        jankMonitor.entries.push({ at: at, ms: ms });
    }
    const extra = jankMonitor.entries.length - JANK_BUFFER_MAX;
    if (extra > 0) jankMonitor.entries.splice(0, extra);
}

export function startJankMonitor() {
    if (jankMonitor.started) return;
    jankMonitor.started = true;
    try {
        const Observer: any = typeof PerformanceObserver === 'function' ? PerformanceObserver : null;
        const type = Observer ? pickJankEntryType(Observer.supportedEntryTypes) : '';
        if (!type) return;
        const observer = new Observer((list) => {
            try { noteJankEntries(list.getEntries()); } catch (e) {}
        });
        observer.observe({ type: type, buffered: true });
        jankMonitor.type = type;
    } catch (e) {}
}

export function jankSummary(entries, now, windowMs) {
    let count = 0;
    let maxMs = 0;
    for (const entry of Array.isArray(entries) ? entries : []) {
        const age = now - Number(entry && entry.at);
        if (!(age >= 0 && age <= windowMs)) continue;
        count++;
        if (entry.ms > maxMs) maxMs = entry.ms;
    }
    return { count: count, maxMs: maxMs };
}

export function jankLabel(type, summary) {
    if (!type || !summary) return '';
    const count = Math.max(0, Math.floor(Number(summary.count) || 0));
    let text = 'ស៊ុមកក ' + Math.round(JANK_WINDOW_MS / 60000) + ' នាទីចុងក្រោយ ៖ ' + count + ' ដង';
    const maxMs = Number(summary.maxMs);
    if (count > 0 && isFinite(maxMs) && maxMs > 0) text += ' · យូរបំផុត ' + Math.round(maxMs) + 'ms';
    return text;
}

export function refreshJankText() {
    let now = NaN;
    try { now = performance.now(); } catch (e) { now = NaN; }
    viewState.jankText = isFinite(now) ? jankLabel(jankMonitor.type, jankSummary(jankMonitor.entries, now, JANK_WINDOW_MS)) : '';
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
