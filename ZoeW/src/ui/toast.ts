import { uiState } from '../core/state';

// ── ស្ថានភាព toast ៖ បញ្ជីរស់នៅ «uiState.toasts» · timer រស់នៅទីនេះ ──
// ⛔ timer **មិនមែន** ស្ថានភាពគូរ ➜ វាមិនត្រូវចូល store (ការដាក់វាចូល
//    នឹងធ្វើឲ្យរាល់ setTimeout កេះការគូរឡើងវិញដោយឥតប្រយោជន៍)។
let toastSeq = 0;
const toastTimers = new Map();

/** ទទួលទាំង id និងវត្ថុធាតុ ➜ ត្រឡប់ធាតុ **រស់** ក្នុងបញ្ជី (ឬ null) */
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
    const next = uiState.toasts.filter((t) => t.id !== id);
    if (next.length === uiState.toasts.length) return;
    uiState.toasts = next;
}

import { byId } from '../core/dom';
import { firebaseState } from '../core/state';
import { dbListenerPendingPaths } from '../core/text';
import { SESSION_EXPIRED_TOAST, SESSION_SIGNED_OUT_TOAST } from '../features/session';

export const TOAST_LIFETIME_MS = 3000;

export const TOAST_LIVE_LIMIT_MS = 20000;

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
    item.kind = TOAST_CLASSES[kind] ? kind : toastKindOf(msg);
    item.msg = msg;
    uiState.touch();
}

export function armToastDismiss(el, delay) {
    const item = toastItem(el);
    if (!item) return;
    clearToastTimer(item.id);
    toastTimers.set(item.id, setTimeout(() => {
        toastTimers.delete(item.id);
        const live = toastItem(item.id);
        if (!live) return;
        live.show = false;
        uiState.touch();
        // ⛔ ៣០០ ms ដដែលនឹងដើម ៖ វាជារយៈពេលនៃ transition ក្នុង `style.css`
        //    ➜ ការដកធាតុមុននោះ លុបចលនាបាត់។
        setTimeout(() => removeToastItem(item.id), 300);
    }, delay));
}

export function dropOldestToast(_container?) {
    const list = uiState.toasts;
    let victim = null;
    for (let i = 0; i < list.length; i++) {
        if (list[i].live !== null) continue;
        victim = list[i];
        break;
    }
    if (!victim) victim = list[0];
    if (!victim) return;
    clearToastTimer(victim.id);
    removeToastItem(victim.id);
}

export function showToast(msg, kind?) {
    while (uiState.toasts.length >= 4) dropOldestToast();
    const id = ++toastSeq;
    uiState.toasts = uiState.toasts.concat([{
        id: id,
        msg: msg,
        kind: TOAST_CLASSES[kind] ? kind : toastKindOf(msg),
        show: false,
        live: null
    }]);
    // ⛔ ស៊ុមបន្ទាប់ទើបដាក់ `.show` — ដូច `appendChild` រួច `rAF`
    //    របស់ដើម ៖ ធាតុត្រូវចុះក្នុង DOM **មុន** class ចលនាចូល បើមិនដូច្នេះ
    //    browser មិនដំណើរការ transition ទេ។
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

export function showLiveToast(key) {
    const state = liveToastState(key);
    if (!state) return null;
    const id = showToast(state.msg, state.kind);
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
        if (state.settled) settleLiveToast(el.id);
    }
}

export function liveToastState(key) {
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
