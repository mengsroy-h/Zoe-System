import { uiState } from '../core/state';
import { isNativeAndroid } from '../platform/native';
import { historyRenderCap } from './history-render';

export const OVERLAY_PROBE_MS = 700;

export const OVERLAY_PROBE_SETTLE_MS = 250;

export const OVERLAY_FRAMES_MAX = 60;

export interface LoafDetail {
    at: number;
    ms: number;
    task: number;
    raf: number;
    draw: number;
    top: { name: string; ms: number; forced: number } | null;
}

export interface OverlaySample {
    label: string;
    gapMs: number;
    firstMs: number;
    loafCount: number;
    loafMs: number;
    taskMs: number;
    rafMs: number;
    drawMs: number;
    topScript: string;
    topMs: number;
    forcedMs: number;
}

export const overlayTelemetry: { sig: string; frames: LoafDetail[]; seq: number } = { sig: '', frames: [], seq: 0 };

function finiteOr(value, fallback) {
    const n = Number(value);
    return isFinite(n) ? n : fallback;
}

export function loafDetailOf(entry): LoafDetail | null {
    if (!entry || typeof entry !== 'object') return null;
    const at = finiteOr(entry.startTime, NaN);
    const ms = finiteOr(entry.duration, NaN);
    if (!isFinite(at) || !isFinite(ms) || ms <= 0) return null;
    const end = at + ms;
    const renderStart = finiteOr(entry.renderStart, 0);
    const layoutStart = finiteOr(entry.styleAndLayoutStart, 0);
    const renderAt = renderStart > at ? Math.min(end, renderStart) : end;
    const layoutAt = layoutStart >= renderAt ? Math.min(end, layoutStart) : renderAt;
    let top = null;
    for (const script of Array.isArray(entry.scripts) ? entry.scripts : []) {
        const d = finiteOr(script && script.duration, 0);
        if (!(d > 0) || (top && d <= top.ms)) continue;
        const name = String((script && (script.sourceFunctionName || script.invoker)) || '?').slice(0, 48);
        top = { name: name, ms: d, forced: Math.max(0, finiteOr(script.forcedStyleAndLayoutDuration, 0)) };
    }
    return { at: at, ms: ms, task: renderAt - at, raf: layoutAt - renderAt, draw: end - layoutAt, top: top };
}

export function noteOverlayFrames(list) {
    if (!Array.isArray(list)) return;
    for (const entry of list) {
        const detail = loafDetailOf(entry);
        if (detail) overlayTelemetry.frames.push(detail);
    }
    const extra = overlayTelemetry.frames.length - OVERLAY_FRAMES_MAX;
    if (extra > 0) overlayTelemetry.frames.splice(0, extra);
}

export function overlaySignature(state): string {
    if (!state) return '';
    const shown = state.modalDisplay || {};
    const parts = Object.keys(shown).filter((id) => shown[id] === 'flex').sort();
    if (state.drawerOpen) parts.push('drawer');
    if (state.notifyDrawerOpen) parts.push('notify');
    if (state.moreMenuOpen) parts.push('menu');
    return parts.join(',');
}

export function overlayChangeLabel(prev, next): string {
    const before = prev ? String(prev).split(',') : [];
    const after = next ? String(next).split(',') : [];
    const opened = after.filter((x) => before.indexOf(x) === -1);
    if (opened.length) return 'open ' + opened.join('+');
    const closed = before.filter((x) => after.indexOf(x) === -1);
    return closed.length ? 'close ' + closed.join('+') : '';
}

export function summarizeOverlay(label, gapMs, firstMs, frames): OverlaySample {
    const list = Array.isArray(frames) ? frames : [];
    const sample: OverlaySample = {
        label: String(label), gapMs: Math.round(gapMs), firstMs: Math.round(firstMs), loafCount: list.length,
        loafMs: 0, taskMs: 0, rafMs: 0, drawMs: 0, topScript: '', topMs: 0, forcedMs: 0
    };
    let top = null;
    for (const f of list) {
        sample.loafMs += f.ms; sample.taskMs += f.task; sample.rafMs += f.raf; sample.drawMs += f.draw;
        if (f.top && (!top || f.top.ms > top.ms)) top = f.top;
    }
    sample.loafMs = Math.round(sample.loafMs);
    sample.taskMs = Math.round(sample.taskMs);
    sample.rafMs = Math.round(sample.rafMs);
    sample.drawMs = Math.round(sample.drawMs);
    if (top) {
        sample.topScript = top.name;
        sample.topMs = Math.round(top.ms);
        sample.forcedMs = Math.round(top.forced);
    }
    return sample;
}

export function startOverlayProbe(label, done) {
    if (!label || typeof requestAnimationFrame !== 'function' || typeof done !== 'function') return;
    let startAt = NaN;
    try { startAt = performance.now(); } catch (e) { return; }
    if (!isFinite(startAt)) return;
    let last = startAt;
    let firstMs = -1;
    let maxGap = 0;
    const tick = (timestamp) => {
        if (firstMs < 0) firstMs = Math.max(0, timestamp - startAt);
        if (timestamp > last) maxGap = Math.max(maxGap, timestamp - last);
        last = Math.max(last, timestamp);
        if (timestamp - startAt < OVERLAY_PROBE_MS) {
            try { requestAnimationFrame(tick); } catch (e) {}
            return;
        }
        setTimeout(() => {
            const frames = overlayTelemetry.frames.filter((f) => f.at + f.ms >= startAt - 1 && f.at <= timestamp);
            try { done(summarizeOverlay(label, maxGap, firstMs, frames)); } catch (e) {}
        }, OVERLAY_PROBE_SETTLE_MS);
    };
    try { requestAnimationFrame(tick); } catch (e) {}
}

export function reportOverlaySample(sample: OverlaySample) {
    if (!sample || !window.ZoeErrors) return;
    const view = Array.isArray(uiState.historyView) ? uiState.historyView.length : 0;
    overlayTelemetry.seq++;
    const extra: Record<string, unknown> = Object.assign({} as Record<string, unknown>, sample, {
        zone: 'perf',
        context: 'overlay-frame',
        itemId: String(overlayTelemetry.seq),
        rowsShown: Math.min(view, historyRenderCap()),
        rowsTotal: view,
        chromeHidden: !!uiState.chromeHidden,
        historyExpanded: !!uiState.historyExpanded,
        panelCollapsed: !!uiState.dataPanelCollapsed,
        filter: String(uiState.currentFilterMode || ''),
        page: String(uiState.currentAppPage || ''),
        displayHz: uiState.displayHz
    });
    ZoeErrors.capture(new Error('Perf overlay ' + sample.label), extra);
}

export function overlayTelemetryEnabled(): boolean {
    return import.meta.env.VITE_PERF_TELEMETRY === '1' && isNativeAndroid();
}

export function setupOverlayTelemetry() {
    if (!overlayTelemetryEnabled()) return;
    try {
        const Observer: any = typeof PerformanceObserver === 'function' ? PerformanceObserver : null;
        const types = Observer && Array.isArray(Observer.supportedEntryTypes) ? Observer.supportedEntryTypes : [];
        if (types.indexOf('long-animation-frame') !== -1) {
            new Observer((list) => { try { noteOverlayFrames(list.getEntries()); } catch (e) {} })
                .observe({ type: 'long-animation-frame', buffered: false });
        }
    } catch (e) {}
    overlayTelemetry.sig = overlaySignature(uiState);
    uiState.subscribe(() => {
        const next = overlaySignature(uiState);
        if (next === overlayTelemetry.sig) return;
        const label = overlayChangeLabel(overlayTelemetry.sig, next);
        overlayTelemetry.sig = next;
        startOverlayProbe(label, reportOverlaySample);
    });
}
