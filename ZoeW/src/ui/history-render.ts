import { uiState } from '../core/state';
import { byId } from '../core/dom';
import { dataState } from '../core/state';
import { getServerNow } from '../core/clock';
import { DB_LISTENER_KEY_HISTORY } from '../core/text';
import { parseTimestampFromId, sanitizeInput } from '../domain/barcode';
import { FOUR_HOURS_MS } from '../features/session';
import { renderZtoSyncViews, scheduleZtoStatusSweep } from '../features/zto-status';
import { emptyViewMessage } from '../services/db-listeners';
import { buildHistoryRowHtml } from './history-row';

export function renderHistory(dataToRender = dataState.scanHistory) {
    const tbody = byId('historyTableBody');
    const countSpan = byId('count');
    if (!tbody || !countSpan) return;
    countSpan.innerText = dataToRender.length;

    // ➜ `HistoryTableBody` (React) ជាអ្នកគូរជួរដេកឥឡូវនេះ។
    //   `touch()` ចាំបាច់ព្រោះកន្លែងហៅជាច្រើនកែ *វត្ថុខាងក្នុង* ដោយ
    //   មិនប្តូរ reference នៃ array ➜ Proxy មើលមិនឃើញ។
    uiState.historyView = dataToRender;
    uiState.touch();

    // ⛔ ផ្លូវចេញមុនត្រូវរក្សា **ដូចដើមបេះបិទ** ៖ បញ្ជីទទេ ➜ ជុំបោស ZTO
    //   មិនរត់ (បើរត់ វានឹងបាញ់សំណើលើអេក្រង់ទទេ)។
    if (dataToRender.length === 0) return;

    renderZtoSyncViews();
    scheduleZtoStatusSweep();
}

export const CLEAR_HISTORY_CLAIM_LEASE_MS = 2 * 60 * 1000;

export const activeClearHistoryClaims = new Map();
