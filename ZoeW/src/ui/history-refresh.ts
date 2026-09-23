import { byId } from '../core/dom';
import { dataState, uiState } from '../core/state';
import { getServerNow } from '../core/clock';
import { sanitizePhoneNumber } from '../core/text';
import { applyCurrentFilter } from '../features/monthly-report';
import { searchByPhone } from '../features/phone-suggest';
import { FOUR_HOURS_MS } from '../features/session';

export function scheduleHistoryViewRefresh() {
    if (uiState.pendingHistoryViewRefresh) return;
    uiState.pendingHistoryViewRefresh = setTimeout(() => {
        uiState.pendingHistoryViewRefresh = null;
        refreshCurrentHistoryView();
    }, 0);
}

export function refreshCurrentHistoryView() {
    const phoneInput = byId('searchPhoneInput');
    if (phoneInput && sanitizePhoneNumber(phoneInput.value)) searchByPhone();
    else applyCurrentFilter();
}

export function sweepRecallHighlights() {
    if (!dataState.scanHistory || !dataState.scanHistory.length) return;
    const now = getServerNow();
    let signature = '';
    dataState.scanHistory.forEach((item) => {
        if ((item.callMark === 'no-answer' || item.callMark === 'no-connect') && item.callMarkTime && (now - item.callMarkTime) >= FOUR_HOURS_MS) {
            signature += item.id + ',';
        }
    });
    if (signature === uiState.lastRecallSignature) return;
    uiState.lastRecallSignature = signature;
    refreshCurrentHistoryView();
}
