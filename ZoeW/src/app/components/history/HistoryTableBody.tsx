import { dataState, uiState } from '../../../core/state';
import { getServerNow } from '../../../core/clock';
import { parseTimestampFromId } from '../../../domain/barcode';
import { emptyViewMessage } from '../../../services/db-listeners';
import { DB_LISTENER_KEY_HISTORY } from '../../../core/text';
import { FOUR_HOURS_MS } from '../../../features/session';
import { useStore } from '../../hooks/useStore';
import { buildHistoryRowModel } from './rowModel';
import { HistoryRow } from './HistoryRow';

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export function HistoryTableBody() {
    useStore(dataState, uiState);

    const view = uiState.historyView;
    if (view === null || view === undefined) return null;

    if (view.length === 0) {
        return (
            <tr>
                <td colSpan={4} style={{ textAlign: 'center', color: '#888', padding: '16px' }}>
                    {emptyViewMessage([DB_LISTENER_KEY_HISTORY], '📦 គ្មានទិន្នន័យបង្ហាញទេ')}
                </td>
            </tr>
        );
    }

    const now = getServerNow();
    const rows = [];
    for (let i = view.length - 1; i >= 0; i--) {
        const item = view[i];
        const itemAgeTime = item.createdAt || parseTimestampFromId(item.id) || now;
        const isOld = (now - itemAgeTime) > TWENTY_FOUR_HOURS_MS;
        const needsRecall = (item.callMark === 'no-answer' || item.callMark === 'no-connect') &&
            item.callMarkTime && (now - item.callMarkTime) >= FOUR_HOURS_MS;
        const model = buildHistoryRowModel(item, i + 1, isOld, !!needsRecall);
        rows.push(
            <tr key={item.id} data-id={item.id} className={model.isClosedRow ? 'closed-row' : ''}>
                <HistoryRow row={model} />
            </tr>
        );
    }
    return <>{rows}</>;
}
