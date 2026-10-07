import { uiState } from '../core/state';
import { viewState } from '../core/view-state';
import { dataState } from '../core/state';
import { getServerNow } from '../core/clock';
import { DB_LISTENER_KEY_HISTORY } from '../core/text';
import { FOUR_HOURS_MS } from '../features/session';
import { renderZtoSyncViews, scheduleZtoStatusSweep } from '../features/zto-status';
import { emptyViewMessage } from '../services/db-listeners';
import { isAndroidDevice } from '../platform/native';

export const HISTORY_PAGE_ROWS = 50;

export function historyRenderCap() {
    const limit = Number(uiState.historyRenderLimit);
    return Number.isFinite(limit) && limit > HISTORY_PAGE_ROWS ? Math.floor(limit) : HISTORY_PAGE_ROWS;
}

export function historyRowsWindowed(): boolean {
    return isAndroidDevice();
}

export function showMoreHistoryRows() {
    const total = Array.isArray(uiState.historyView) ? uiState.historyView.length : 0;
    const cap = historyRenderCap();
    if (cap >= total) return;
    uiState.historyRenderLimit = cap + HISTORY_PAGE_ROWS;
}

export function renderHistory(dataToRender = dataState.scanHistory, viewKey = '') {
    if (viewKey !== uiState.historyViewKey) {
        uiState.historyViewKey = viewKey;
        uiState.historyRenderLimit = HISTORY_PAGE_ROWS;
    }
    viewState.historyCountText = String(dataToRender.length);

    uiState.historyView = dataToRender;
    uiState.historyRenderSeq = uiState.historyRenderSeq + 1;

    if (dataToRender.length === 0) return;

    renderZtoSyncViews();
    scheduleZtoStatusSweep();
}

export const CLEAR_HISTORY_CLAIM_LEASE_MS = 2 * 60 * 1000;

export const activeClearHistoryClaims = new Map();
