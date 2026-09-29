import { uiState } from '../core/state';
import { viewState } from '../core/view-state';
import { dataState } from '../core/state';
import { getServerNow } from '../core/clock';
import { DB_LISTENER_KEY_HISTORY } from '../core/text';
import { FOUR_HOURS_MS } from '../features/session';
import { renderZtoSyncViews, scheduleZtoStatusSweep } from '../features/zto-status';
import { emptyViewMessage } from '../services/db-listeners';

export function renderHistory(dataToRender = dataState.scanHistory) {
    viewState.historyCountText = String(dataToRender.length);

    uiState.historyView = dataToRender;
    uiState.historyRenderSeq = uiState.historyRenderSeq + 1;

    if (dataToRender.length === 0) return;

    renderZtoSyncViews();
    scheduleZtoStatusSweep();
}

export const CLEAR_HISTORY_CLAIM_LEASE_MS = 2 * 60 * 1000;

export const activeClearHistoryClaims = new Map();
