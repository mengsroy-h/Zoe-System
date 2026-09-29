import { memo, useEffect, useRef } from 'react';
import { dataState, firebaseState, uiState } from '../../../core/state';
import { getServerNow } from '../../../core/clock';
import { parseTimestampFromId } from '../../../domain/barcode';
import { emptyViewMessage } from '../../../services/db-listeners';
import { DB_LISTENER_KEY_HISTORY } from '../../../core/text';
import { FOUR_HOURS_MS } from '../../../features/session';
import { useStore, useStoreFields } from '../../hooks/useStore';
import { act, onAct } from '../../actions';
import { HISTORY_PAGE_ROWS, historyRenderCap } from '../../../ui/history-render';
import { buildHistoryRowModel } from './rowModel';
import { HistoryRow } from './HistoryRow';

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

const HISTORY_VIEW_FIELDS = ['historyView', 'historyRenderSeq', 'historyRenderLimit'] as const;

export function HistoryTableBody() {
    useStore(dataState, firebaseState);
    const view = useStoreFields(uiState, HISTORY_VIEW_FIELDS).historyView;
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
    const stop = Math.max(0, view.length - historyRenderCap());
    for (let i = view.length - 1; i >= stop; i--) {
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
    if (stop > 0) rows.push(<HistoryMoreRow key="history-more" more={stop} shown={view.length - stop} />);
    return <>{rows}</>;
}

function HistoryMoreRow({ more, shown }: { more: number; shown: number }) {
    const ref = useRef<HTMLTableRowElement | null>(null);
    useEffect(() => {
        const el = ref.current;
        if (!el || typeof IntersectionObserver !== 'function') return;
        let fired = false;
        const io = new IntersectionObserver((entries) => {
            if (fired || !entries.some((e) => e.isIntersecting)) return;
            fired = true;
            act('showMoreHistoryRows');
        }, { root: el.closest('.table-responsive'), rootMargin: '0px 0px 600px 0px' });
        io.observe(el);
        return () => io.disconnect();
    }, [shown]);
    return (
        <tr className="history-more-row" ref={ref}>
            <td colSpan={4} style={{ textAlign: 'center', padding: '10px' }}>
                <button type="button" className="btn-sm history-more-btn" onClick={onAct('showMoreHistoryRows')}>⬇️ បង្ហាញ {Math.min(more, HISTORY_PAGE_ROWS)} ជួរទៀត (នៅសល់ {more})</button>
            </td>
        </tr>
    );
}

export const MemoHistoryTableBody = memo(HistoryTableBody);
