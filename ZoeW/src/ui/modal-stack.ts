import { lookupAction } from '../core/action-registry';
import { dataState } from '../core/state';
import { safeFocusScanner } from '../core/timezone';
import { sanitizeInput } from '../domain/barcode';
import { collectedMoneyText, collectedRielText } from '../features/export';
import { closeModal } from './modal';
import { showToast } from './toast';

export function topmostModal(openModals) {
    let top = null;
    let topZ = -Infinity;
    openModals.forEach((m) => {
        const parsed = parseInt(window.getComputedStyle(m).zIndex, 10);
        const z = isNaN(parsed) ? 0 : parsed;
        if (z >= topZ) { topZ = z; top = m; }
    });
    return top;
}

export function dismissModal(modalEl) {
    if (!modalEl || modalEl.hasAttribute('data-nodismiss')) return;
    const fnName = modalEl.getAttribute('data-close');
    const closer = fnName ? lookupAction(fnName) : null;
    if (closer) {
        closer();
    } else {
        closeModal(modalEl.id);
    }
}

export function buildStatCardItem(label, key, cod, dod, count, collectedValue, measurable) {
    // ⛔ ឥឡូវវាត្រឡប់ **model** — React គូរ (`DailyStatsCards`)។ រូបមន្ត
    //   នៅដដែល ៖ `collectedValue` ត្រូវគណនារួចដោយកន្លែងហៅ (កម្រិតបូក
    //   ជាការសម្រេចរបស់កន្លែងហៅ) ហើយ `pending` clamp ត្រឹម ០។
    const totalD = Math.round((cod + dod) * 100) / 100;
    const collected = (collectedValue && typeof collectedValue === 'object')
        ? collectedValue : { cod: 0, dod: 0, total: 0 };
    const pending = Math.round(Math.max(0, totalD - collected.total) * 100) / 100;
    return {
        label: label,
        key: key,
        count: count,
        codText: collectedMoneyText(collected.cod, measurable),
        dodText: collectedMoneyText(collected.dod, measurable),
        collectedText: collectedMoneyText(collected.total, measurable),
        collectedRielText: collectedRielText(collected.total, measurable),
        totalText: totalD.toFixed(2),
        pendingText: collectedMoneyText(pending, measurable)
    };
}

export function buildCollectedCardItem(day, totals) {
    const sums = (totals && typeof totals === 'object')
        ? totals : { cod: 0, dod: 0, total: 0, count: 0 };
    return {
        day: day,
        count: sums.count,
        cod: sums.cod.toFixed(2),
        dod: sums.dod.toFixed(2),
        total: sums.total.toFixed(2),
        riel: Math.round(sums.total * dataState.exchangeRateRiel).toLocaleString()
    };
}

export function rejectScanAndRefocus(message) {
    closeModal('phoneModal');
    showToast(message);
    if (navigator.vibrate) navigator.vibrate([100, 60, 100]);
    safeFocusScanner();
}

export function rawSnapshotToItemList(data) {
    if (!data) return [];
    if (Array.isArray(data)) return data.filter(item => item !== null);
    return Object.keys(data).map(key => { const v = data[key]; if (v && !v.id) v.id = key; return v; });
}

export function recalcItemMoneyFromBarcodes(target) {
    target.cod = Math.round(target.barcodes.reduce((sum, b) => sum + (parseFloat(b.cod) || 0), 0) * 100) / 100;
    target.dod = Math.round(target.barcodes.reduce((sum, b) => sum + (parseFloat(b.dod) || 0), 0) * 100) / 100;
    target.price = Math.round((target.cod + target.dod) * 100) / 100;
}
