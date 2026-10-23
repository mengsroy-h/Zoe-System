import { uiState } from '../../core/state';
import { viewState } from '../../core/view-state';
import { armToastDismiss, showToast } from '../../ui/toast';
import type { LifecycleScope } from '../lifecycle/scope';
import { elementOf } from '../refs';
import { ENTRY_SEARCH_FIELDS } from './entry-search';
import { iosPageTapFieldOf, keyboardVisibleViewport, modalTapFocusedField, modalTapRefused, pageFieldRaiseFor, pageFieldStaysAboveKeyboard, rememberedKeyboardInset } from './modal-keyboard';
import { panelIsCollapsed, usesIOSPanelHandoff } from './panels';

export const PUSH_PROBE_MIN_PX = 12;
export const PUSH_PROBE_REST_PX = 4;
export const PUSH_PROBE_STEP_PX = 24;
export const PUSH_PROBE_SETTLE_MS = 400;
export const PUSH_PROBE_TAPE_MAX = 12;
export const PUSH_PROBE_TOAST_MS = 30000;
const PUSH_PROBE_HOST = /^deploy-preview-\d+--zoew\.netlify\.app$/i;
const PUSH_PROBE_RUNS = new Set(['kb', 'vs', 'ws']);

interface PushProbeEntry { at: number; kind: string; text: string; from: number }
interface PushProbeView { top: number; y: number; inset: number }
interface PushProbePan { at: number; max: number; reported: number; timer: ReturnType<typeof setTimeout> | null }

let pushProbe: {
    tape: PushProbeEntry[];
    fingers: number;
    touch: { stamp: number; x: number; y: number } | null;
    barcode: { at: number; text: string } | null;
    seen: PushProbeView;
    pan: PushProbePan | null;
} | null = null;

export function pushProbeEnabled(): boolean {
    return usesIOSPanelHandoff() && PUSH_PROBE_HOST.test(String((window.location && window.location.hostname) || ''));
}

function pushProbeView(): PushProbeView {
    const vv = window.visualViewport;
    return {
        top: vv ? Math.round(vv.offsetTop) : 0,
        y: Math.round(window.scrollY || 0),
        inset: vv ? Math.max(0, Math.round(window.innerHeight - vv.height)) : 0
    };
}

function pushProbeName(target: EventTarget | null): string {
    if (target === window) return 'win';
    const el = target as HTMLElement | null;
    if (!el || typeof el.closest !== 'function') return target === document ? 'doc' : '?';
    const scanner = elementOf('hwScannerInput');
    if (scanner && el === scanner) return 'bc';
    if (scanner && iosPageTapFieldOf(el) === scanner) return 'bc~';
    if (ENTRY_SEARCH_FIELDS.some((name) => elementOf(name) === el)) return 'sr';
    if (elementOf('searchPhoneInput') === el) return 'ph';
    return String(el.tagName || '?').toLowerCase() + (el.id ? '#' + el.id.slice(0, 18) : '');
}

function pushProbeNote(kind: string, text: string, from = NaN): PushProbeEntry | null {
    const probe = pushProbe;
    if (!probe) return null;
    const last = probe.tape[probe.tape.length - 1];
    if (last && last.kind === kind && PUSH_PROBE_RUNS.has(kind)) {
        last.text = kind + ':' + last.from + '→' + text;
        return last;
    }
    const entry = { at: performance.now(), kind, text: PUSH_PROBE_RUNS.has(kind) ? kind + ':' + from + '→' + text : text, from };
    probe.tape = probe.tape.concat(entry).slice(-PUSH_PROBE_TAPE_MAX);
    return entry;
}

function notePushProbePrevented(entry: PushProbeEntry | null, e: Event): void {
    if (entry) setTimeout(() => { entry.text += ' p' + (e.defaultPrevented ? 1 : 0); }, 0);
}

function pushProbeFlag(on: boolean): number {
    return on ? 1 : 0;
}

function pushProbeBarcodeState(field: HTMLElement): string {
    const box = field.getBoundingClientRect();
    const mode = viewState.entryModeShown === 'remove' ? 'r' : viewState.entryModeShown === 'locker' ? 'l' : 'p';
    return 'បាកូដ m' + mode + ' f' + pushProbeFlag(document.activeElement === field) + ' k' + pushProbeFlag(!!keyboardVisibleViewport()) +
        ' t' + pushProbeFlag(modalTapFocusedField() === field) + ' r' + pushProbeFlag(modalTapRefused()) + ' o' + pushProbeFlag(uiState.isModalOpen) +
        ' c' + pushProbeFlag(panelIsCollapsed('entry')) + ' a' + pushProbeFlag(pageFieldStaysAboveKeyboard(field)) + ' u' + pageFieldRaiseFor(field) +
        ' s' + rememberedKeyboardInset(field) + ' b' + Math.round(box.bottom) + '/' + Math.round(window.innerHeight);
}

function notePushProbeTouchStart(e: TouchEvent): void {
    const probe = pushProbe;
    if (!probe) return;
    probe.fingers = e.touches ? e.touches.length : 0;
    const t = e.changedTouches && e.changedTouches[0];
    if (t) probe.touch = { stamp: e.timeStamp, x: t.clientX, y: t.clientY };
    const name = pushProbeName(e.target);
    pushProbeNote('ts', 'ts:' + name + (probe.fingers > 1 ? '×' + probe.fingers : '') + (e.cancelable ? '' : ' c0'));
    const scanner = name === 'bc' || name === 'bc~' ? elementOf('hwScannerInput') : null;
    if (scanner) probe.barcode = { at: performance.now(), text: pushProbeBarcodeState(scanner) };
}

function notePushProbeTouchEnd(e: TouchEvent): void {
    const probe = pushProbe;
    if (!probe) return;
    probe.fingers = e.touches ? e.touches.length : 0;
    const start = probe.touch;
    const t = e.changedTouches && e.changedTouches[0];
    let text = e.type === 'touchcancel' ? 'tc' : 'te';
    if (start && t) text += ':' + Math.round(e.timeStamp - start.stamp) + 'ms Δ' + Math.round(t.clientX - start.x) + ',' + Math.round(t.clientY - start.y);
    if (!probe.fingers) probe.touch = null;
    notePushProbePrevented(pushProbeNote('te', text + ' c' + pushProbeFlag(e.cancelable)), e);
}

function notePushProbeMouse(e: MouseEvent): void {
    notePushProbePrevented(pushProbeNote('ms', (e.type === 'mousedown' ? 'md:' : 'ck:') + pushProbeName(e.target)), e);
}

function notePushProbeFocus(e: FocusEvent): void {
    pushProbeNote('fo', (e.type === 'focus' ? 'fo:' : 'bl:') + pushProbeName(e.target));
}

function reportPushProbe(episode: PushProbePan): void {
    const probe = pushProbe;
    if (!probe || probe.pan !== episode) return;
    episode.timer = null;
    const now = pushProbeView();
    const pan = Math.max(now.top, now.y);
    episode.reported = Math.max(episode.max, pan);
    if (pan < PUSH_PROBE_REST_PX) probe.pan = null;
    const rel = (at: number) => '[' + Math.round(at - episode.at) + '] ';
    const parts = ['🔬 ទំព័ររុញ ' + episode.max + 'pt (ឥឡូវ vv ' + now.top + ' · doc ' + now.y + ' · kb ' + now.inset + ' · ' + uiState.currentAppPage + ')'];
    if (probe.barcode) parts.push(rel(probe.barcode.at) + probe.barcode.text);
    parts.push(probe.tape.map((entry) => rel(entry.at) + entry.text).join(' · '));
    armToastDismiss(showToast(parts.join(' │ '), 'info'), PUSH_PROBE_TOAST_MS);
}

function notePushProbeView(): void {
    const probe = pushProbe;
    if (!probe) return;
    const now = pushProbeView();
    const seen = probe.seen;
    if (now.inset !== seen.inset) pushProbeNote('kb', String(now.inset), seen.inset);
    if (now.top !== seen.top) pushProbeNote('vs', String(now.top), seen.top);
    if (now.y !== seen.y) pushProbeNote('ws', String(now.y), seen.y);
    probe.seen = now;
    const pan = Math.max(now.top, now.y);
    const episode = probe.pan;
    if (episode) episode.max = Math.max(episode.max, pan);
    if (pan < PUSH_PROBE_REST_PX) {
        if (episode && episode.timer === null) probe.pan = null;
        return;
    }
    if (uiState.isModalOpen || probe.fingers > 0 || (episode && episode.timer !== null)) return;
    const reported = episode ? episode.reported : 0;
    if (pan < (reported ? reported + PUSH_PROBE_STEP_PX : PUSH_PROBE_MIN_PX)) return;
    const next: PushProbePan = { at: performance.now(), max: pan, reported, timer: null };
    next.timer = setTimeout(() => reportPushProbe(next), PUSH_PROBE_SETTLE_MS);
    probe.pan = next;
}

function stopPushProbe(): void {
    const probe = pushProbe;
    pushProbe = null;
    if (probe && probe.pan && probe.pan.timer !== null) clearTimeout(probe.pan.timer);
}

export function listenIOSPushProbe(scope: LifecycleScope): void {
    stopPushProbe();
    if (!pushProbeEnabled()) return;
    pushProbe = { tape: [], fingers: 0, touch: null, barcode: null, seen: pushProbeView(), pan: null };
    scope.listen(window, 'touchstart', notePushProbeTouchStart, { capture: true, passive: true });
    scope.listen(window, 'touchend', notePushProbeTouchEnd, { capture: true, passive: true });
    scope.listen(window, 'touchcancel', notePushProbeTouchEnd, { capture: true, passive: true });
    scope.listen(window, 'mousedown', notePushProbeMouse, { capture: true, passive: true });
    scope.listen(window, 'click', notePushProbeMouse, { capture: true, passive: true });
    scope.listen(window, 'focus', notePushProbeFocus, { capture: true });
    scope.listen(window, 'blur', notePushProbeFocus, { capture: true });
    scope.listen(window, 'scroll', notePushProbeView, { passive: true });
    const vv = window.visualViewport;
    if (vv) {
        scope.listen(vv, 'scroll', notePushProbeView, { passive: true });
        scope.listen(vv, 'resize', notePushProbeView, { passive: true });
    }
    scope.onDispose(stopPushProbe);
}
