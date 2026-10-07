import { securityState, uiState } from '../core/state';
import { viewState } from '../core/view-state';

let toastSeq = 0;
const toastTimers = new Map();
const heldToastDelays = new Map();

function toastItem(ref): any {
    if (ref === null || ref === undefined) return null;
    const id = typeof ref === 'object' ? (ref as any).id : ref;
    const list = uiState.toasts;
    for (let i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
}

function clearToastTimer(id) {
    const t = toastTimers.get(id);
    if (t) { clearTimeout(t); toastTimers.delete(id); }
}

function removeToastItem(id) {
    clearToastTimer(id);
    heldToastDelays.delete(id);
    const next = uiState.toasts.filter((t) => t.id !== id);
    if (next.length === uiState.toasts.length) return;
    uiState.toasts = next;
}

import { firebaseState } from '../core/state';
import { dbListenerPendingPaths } from '../core/text';
import { SESSION_EXPIRED_TOAST, SESSION_SIGNED_OUT_TOAST } from '../features/session';

export const TOAST_LIFETIME_MS = 3000;

export const TOAST_LIVE_LIMIT_MS = 20000;

export const TOAST_STALLED_MS = 5000;

export const TOAST_STALLED_SUFFIX = ' — យូរជាងធម្មតា App នៅព្យាយាមបន្ត';

const expiredLiveKeys = new Set();

export function stalledToastText(msg, key?) {
    const text = String(msg || '');
    if (text.indexOf('🔄') !== 0) return '';
    return '⚠️' + text.slice('🔄'.length).replace(/\.\.\.$|…$/, '') + TOAST_STALLED_SUFFIX
        + (key === 'config' ? ' (សូមពិនិត្យ Config ឬអ៊ីនធឺណិត)' : '');
}

export function expireLiveToast(toast) {
    const key = toast.live;
    const state = liveToastState(key);
    toast.live = null;
    if (!state || state.settled) return false;
    if (key !== 'network') expiredLiveKeys.add(key);
    const stalled = stalledToastText(state.msg, key);
    if (!stalled) return false;
    toast.msg = toastBackendText(stalled);
    toast.kind = 'warn';
    toast.show = true;
    uiState.touch();
    armToastDismiss(toast.id, TOAST_STALLED_MS);
    return true;
}

export const TOAST_CLASSES = { info: 'toast-info', success: 'toast-success', warn: 'toast-warn', error: 'toast-error' };

export const TOAST_KIND_MARKS = [
    ['error', ['❌', '⛔', '🚫']],
    ['warn', ['⚠️', '⏱️']],
    ['success', ['✅', '🎉', '🔓']]
];

export function toastKindOf(msg) {
    const text = String(msg === null || msg === undefined ? '' : msg).trim();
    for (let i = 0; i < TOAST_KIND_MARKS.length; i++) {
        const marks = TOAST_KIND_MARKS[i][1];
        for (let j = 0; j < marks.length; j++) {
            if (text.indexOf(marks[j]) === 0) return TOAST_KIND_MARKS[i][0];
        }
    }
    return 'info';
}

export function paintToast(el, msg, kind) {
    const item = toastItem(el);
    if (!item) return;
    msg = toastBackendText(msg);
    item.kind = TOAST_CLASSES[kind] ? kind : toastKindOf(msg);
    item.msg = msg;
    uiState.touch();
}

export function armToastDismiss(el, delay) {
    const item = toastItem(el);
    if (!item) return;
    clearToastTimer(item.id);
    if (securityState.appIsLocked) {
        heldToastDelays.set(item.id, delay);
        return;
    }
    heldToastDelays.delete(item.id);
    toastTimers.set(item.id, setTimeout(() => {
        toastTimers.delete(item.id);
        const live = toastItem(item.id);
        if (!live) return;
        if (live.live !== null && expireLiveToast(live)) return;
        live.show = false;
        uiState.touch();
        setTimeout(() => removeToastItem(item.id), 300);
    }, delay));
}

export function releaseHeldToasts() {
    if (!heldToastDelays.size) return;
    const held = Array.from(heldToastDelays.entries());
    heldToastDelays.clear();
    refreshLiveToasts();
    for (let i = 0; i < held.length; i++) {
        if (toastTimers.has(held[i][0]) || !toastItem(held[i][0])) continue;
        armToastDismiss(held[i][0], held[i][1]);
    }
}

export function dropOldestToast(_container?) {
    const list = uiState.toasts;
    const order = ['success', 'info', 'warn', 'error'];
    let victim = null;
    for (let k = 0; k < order.length && !victim; k++) {
        for (let i = 0; i < list.length; i++) {
            if (list[i].live !== null || list[i].kind !== order[k]) continue;
            victim = list[i];
            break;
        }
    }
    if (!victim) victim = list[0];
    if (!victim) return;
    clearToastTimer(victim.id);
    removeToastItem(victim.id);
}

export const TOAST_BACKEND_WORD = /\bFirebase\b(?!\s*(?:Config|Console|៖))/g;

export function toastBackendText(msg) {
    if (typeof msg !== 'string' || viewState.backendKind !== 'supabase') return msg;
    return msg.replace(TOAST_BACKEND_WORD, 'Supabase');
}

export function showToast(msg, kind?) {
    msg = toastBackendText(msg);
    while (uiState.toasts.length >= 4) dropOldestToast();
    const id = ++toastSeq;
    uiState.toasts = uiState.toasts.concat([{
        id: id,
        msg: msg,
        kind: TOAST_CLASSES[kind] ? kind : toastKindOf(msg),
        show: false,
        live: null
    }]);
    requestAnimationFrame(() => {
        const item = toastItem(id);
        if (!item) return;
        item.show = true;
        uiState.touch();
    });
    armToastDismiss(id, TOAST_LIFETIME_MS);
    return id;
}

export function settleLiveToast(el) {
    const item = toastItem(el);
    if (!item) return;
    item.live = null;
    uiState.touch();
    armToastDismiss(item.id, TOAST_LIFETIME_MS);
}

export function reannounceOrShowToast(msg) {
    msg = toastBackendText(msg);
    const list = uiState.toasts;
    for (let i = 0; i < list.length; i++) {
        if (list[i].msg !== msg) continue;
        list[i].show = true;
        uiState.touch();
        armToastDismiss(list[i].id, TOAST_LIFETIME_MS);
        return list[i].id;
    }
    return showToast(msg);
}

let liveSuccessAnnounced = 0;

export function liveSuccessCount() {
    return liveSuccessAnnounced;
}

export function showLiveToast(key) {
    expiredLiveKeys.delete(key);
    const state = liveToastState(key);
    if (!state) return null;
    const id = showToast(state.msg, state.kind);
    if (id !== null && state.settled && state.kind === 'success') liveSuccessAnnounced++;
    if (id === null || state.settled) return id;
    const item = toastItem(id);
    if (item) { item.live = key; uiState.touch(); }
    armToastDismiss(id, TOAST_LIVE_LIMIT_MS);
    return id;
}

export function refreshLiveToasts() {
    const live = uiState.toasts.filter((t) => t.live !== null);
    for (let i = 0; i < live.length; i++) {
        const el = live[i];
        const state = liveToastState(el.live);
        if (!state) { settleLiveToast(el.id); continue; }
        paintToast(el.id, state.msg, state.kind);
        if (state.settled) {
            if (el.live === 'network') networkToastEpisode = false;
            if (state.kind === 'success') liveSuccessAnnounced++;
            settleLiveToast(el.id);
        }
    }
    expiredLiveKeys.forEach((key) => {
        const state = liveToastState(key);
        if (state && !state.settled) return;
        expiredLiveKeys.delete(key);
        if (state && state.kind === 'success' && showToast(state.msg, 'success') !== null) liveSuccessAnnounced++;
    });
}

let networkToastEpisode = false;
let connectionWasOnline = false;

function signedInForToast() {
    return !!(firebaseState.auth && firebaseState.auth.currentUser) && firebaseState.sessionExpiryCheck !== 'expired';
}

export function noteConnectionTransition(prev, next) {
    if (!signedInForToast()) {
        networkToastEpisode = false;
        connectionWasOnline = next === 'online';
        return;
    }
    if (uiState.toasts.some((t) => t.live !== null && t.live !== 'network')) {
        networkToastEpisode = false;
        if (next === 'online') connectionWasOnline = true;
        return;
    }
    const showing = uiState.toasts.some((t) => t.live === 'network');
    if (next === 'offline' && prev !== 'offline' && connectionWasOnline) {
        networkToastEpisode = true;
        if (!showing) showLiveToast('network');
        return;
    }
    if (next !== 'online') return;
    connectionWasOnline = true;
    if (networkToastEpisode && !showing) {
        const id = showLiveToast('network');
        if (id !== null && !uiState.toasts.some((t) => t.live === 'network')) networkToastEpisode = false;
    }
}

export function liveToastState(key) {
    if (key === 'network') {
        if (!signedInForToast()) return null;
        if ((navigator.onLine as boolean) === false) {
            return { msg: '⚠️ ឧបករណ៍ក្រៅបណ្ដាញ — លេខដែលអ្នកឃើញអាចមិនទាន់សម័យ', kind: 'warn', settled: false };
        }
        if (!firebaseState.isDatabaseConnected) {
            return { msg: '🔄 កំពុងភ្ជាប់ Server ឡើងវិញ...', kind: 'info', settled: false };
        }
        if (firebaseState.dbListenersFailed || dbListenerPendingPaths.size) {
            return { msg: '🔄 ភ្ជាប់ Server វិញ — កំពុងទាញទិន្នន័យ...', kind: 'info', settled: false };
        }
        return { msg: '✅ ភ្ជាប់ Server វិញ — ទិន្នន័យទាន់សម័យ', kind: 'success', settled: true };
    }
    if (key !== 'signin' && key !== 'config') return null;
    if (key === 'signin' && (firebaseState.sessionExpiryCheck === 'expired' || !firebaseState.auth || !firebaseState.auth.currentUser)) {
        return firebaseState.sessionExpiryCheck === 'expired'
            ? { msg: SESSION_EXPIRED_TOAST, kind: 'warn', settled: true }
            : { msg: SESSION_SIGNED_OUT_TOAST, kind: 'warn', settled: true };
    }
    if ((navigator.onLine as boolean) === false) {
        return key === 'signin'
            ? { msg: '⚠️ ចូលប្រព័ន្ធរួច តែឧបករណ៍ក្រៅបណ្ដាញ — លេខដែលអ្នកឃើញមិនទាន់សម័យ', kind: 'warn', settled: false }
            : { msg: '⚠️ រក្សាទុក Config រួច តែឧបករណ៍ក្រៅបណ្ដាញ — មិនទាន់ភ្ជាប់ Server ទេ', kind: 'warn', settled: false };
    }
    if (!firebaseState.isDatabaseConnected) {
        return { msg: '🔄 កំពុងតភ្ជាប់ទៅ Server...', kind: 'info', settled: false };
    }
    if (key === 'config') {
        return { msg: '✅ ភ្ជាប់ Server រួចរាល់!', kind: 'success', settled: true };
    }
    if (firebaseState.dbListenersFailed) {
        return { msg: '⚠️ ចូលប្រព័ន្ធរួច តែការទាញទិន្នន័យដាច់ — កំពុងព្យាយាមឡើងវិញ', kind: 'warn', settled: false };
    }
    if (dbListenerPendingPaths.size) {
        return { msg: '🔄 ចូលប្រព័ន្ធរួច — កំពុងទាញទិន្នន័យ...', kind: 'info', settled: false };
    }
    if (firebaseState.sessionExpiryCheck === 'pending') {
        return { msg: '🔄 ចូលប្រព័ន្ធរួច — កំពុងផ្ទៀងផ្ទាត់វគ្គ...', kind: 'info', settled: false };
    }
    return { msg: '✅ ចូលប្រព័ន្ធជោគជ័យ — ទិន្នន័យទាន់សម័យ', kind: 'success', settled: true };
}
