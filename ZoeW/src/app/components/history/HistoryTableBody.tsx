import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
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
import { elementOf, setElementScrollTop } from '../../refs';
import { isNativeAndroid } from '../../../platform/native';

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

const HISTORY_VIEW_FIELDS = ['historyView', 'historyRenderSeq', 'historyRenderLimit', 'historyViewKey'] as const;

export function HistoryTableBody() {
    useStore(dataState, firebaseState);
    const history = useStoreFields(uiState, HISTORY_VIEW_FIELDS);
    const view = history.historyView;
    const native = isNativeAndroid();
    const shown = Math.min(view?.length ?? 0, historyRenderCap());
    const [headerHeight, setHeaderHeight] = useState(0);
    const getItemKey = useCallback((index: number) => view?.[view.length - index - 1]?.id ?? index, [view, history.historyRenderSeq]);
    const virtualizer = useVirtualizer<HTMLDivElement, HTMLTableRowElement>({
        enabled: native && shown > 0,
        count: shown,
        getScrollElement: () => elementOf('tableResponsive') as HTMLDivElement | null,
        getItemKey,
        estimateSize: () => 160,
        overscan: 10,
        scrollMargin: headerHeight,
        useAnimationFrameWithResizeObserver: true,
        scrollToFn: (offset, { adjustments }, instance) => setElementScrollTop(instance.scrollElement, offset + (adjustments ?? 0))
    });
    useLayoutEffect(() => {
        if (!native) return;
        const header = elementOf('tableResponsive')?.querySelector('thead');
        if (!header) return;
        const measure = () => setHeaderHeight(header.getBoundingClientRect().height);
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(header);
        return () => observer.disconnect();
    }, [native]);
    useLayoutEffect(() => {
        if (native) virtualizer.scrollToOffset(0);
    }, [native, history.historyViewKey, virtualizer]);
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
    const virtualRows = native ? virtualizer.getVirtualItems() : [];
    const first = native ? virtualRows[0]?.index ?? 0 : 0;
    const end = native ? (virtualRows[virtualRows.length - 1]?.index ?? -1) + 1 : shown;
    if (native && virtualRows.length) rows.push(<HistorySpacer key="history-before" height={virtualRows[0].start - headerHeight} />);
    for (let index = first; index < end; index++) {
        const i = view.length - index - 1;
        const item = view[i];
        const itemAgeTime = item.createdAt || parseTimestampFromId(item.id) || now;
        const isOld = (now - itemAgeTime) > TWENTY_FOUR_HOURS_MS;
        const needsRecall = (item.callMark === 'no-answer' || item.callMark === 'no-connect') &&
            item.callMarkTime && (now - item.callMarkTime) >= FOUR_HOURS_MS;
        const model = buildHistoryRowModel(item, i + 1, isOld, !!needsRecall);
        rows.push(
            <tr key={item.id} data-id={item.id} data-index={native ? index : undefined} ref={native ? virtualizer.measureElement : undefined} className={model.isClosedRow ? 'closed-row' : ''}>
                <HistoryRow row={model} />
            </tr>
        );
    }
    if (native && virtualRows.length) rows.push(<HistorySpacer key="history-after" height={virtualizer.getTotalSize() - (virtualRows[virtualRows.length - 1].end - headerHeight)} />);
    if (stop > 0) rows.push(<HistoryMoreRow key="history-more" more={stop} shown={view.length - stop} />);
    return <>{rows}</>;
}

function HistorySpacer({ height }: { height: number }) {
    if (!(height > 0)) return null;
    return <tr aria-hidden="true" className="history-virtual-spacer"><td colSpan={4} style={{ height, padding: 0, border: 0 }} /></tr>;
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
