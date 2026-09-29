import { Fragment, useEffect, useRef } from 'react';
import { uiState } from '../../../core/state';
import { useStoreFields } from '../../hooks/useStore';
import { act, onAct } from '../../actions';
import type { TrashRowModel, TrashView } from './model';

const TRASH_VIEW_FIELDS = ['trashView'] as const;

function RowActions({ id }: { id: string }) {
    return (
        <div className="trash-row-actions">
            <button className="btn-sm trash-restore-btn" title="ស្តារមកវិញ" onClick={onAct('promptRestoreDeletedItem', { args: [id] })}>🔄</button>
            <button className="btn-sm trash-purge-btn" title="លុបជាអចិន្ត្រៃយ៍" onClick={onAct('promptPermanentDelete', { args: [id] })}>✖️</button>
        </div>
    );
}

function GroupRow({ row }: { row: TrashRowModel }) {
    return (
        <tr className="trash-group-row">
            <td>
                <div className="trash-cust">
                    <strong>{row.phone}</strong>
                    <span className={`trash-tag ${row.metaCls}`}>{row.metaLabel}</span>
                </div>
                <div className="trash-when">🕒 {row.whenText}</div>
                <div className="trash-codes">
                    {row.codes.map((code, i) => (
                        <Fragment key={code + i}>{i > 0 ? ' ' : null}<span className="barcode-tag">{code}</span></Fragment>
                    ))}
                    {row.moreCodes > 0 ? <span className="trash-more-codes">+{row.moreCodes}</span> : null}
                </div>
            </td>
            <td>
                <div><span className="count-badge">📦 {row.count}</span></div>
                <div className="trash-money">${row.total.toFixed(2)}</div>
                <div className="trash-riel">{row.riel.toLocaleString()} ៛</div>
            </td>
            <td style={{ textAlign: 'center' }}>
                {row.singleId
                    ? <RowActions id={row.singleId} />
                    : <button className="btn-sm trash-expand-btn" title="បង្ហាញធាតុនីមួយៗ"
                        onClick={onAct('toggleTrashGroup', { args: [row.key] })}>{row.expanded ? '▲' : '▼'} {row.itemCount}</button>}
            </td>
        </tr>
    );
}

export function TrashTableBody() {
    const view = useStoreFields(uiState, TRASH_VIEW_FIELDS).trashView as TrashView | null;
    if (!view) return null;

    if (view.empty !== null) {
        return (
            <tr><td colSpan={3} style={{ textAlign: 'center', color: '#888', padding: '14px' }}>{view.empty}</td></tr>
        );
    }

    return (
        <>
            {view.rows.map((row) => (
                <ObservedGroup key={row.key} row={row} />
            ))}
            {view.more > 0 ? <TrashMoreRow more={view.more} shown={view.rows.length} /> : null}
            {view.overflow > 0 && (
                <tr>
                    <td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '8px' }}>
                        ... និងមាន {view.overflow} ជួរទៀត (ផុតកំណត់ ៨ថ្ងៃ៖ ២ ថ្ងៃ · ប្រភេទផ្សេង៖ ៣០ ថ្ងៃ)
                    </td>
                </tr>
            )}
        </>
    );
}

function TrashMoreRow({ more, shown }: { more: number; shown: number }) {
    const ref = useRef<HTMLTableRowElement | null>(null);
    useEffect(() => {
        const el = ref.current;
        if (!el || typeof IntersectionObserver !== 'function') return;
        const root = el.closest('.trash-table-wrap');
        let fired = false;
        const io = new IntersectionObserver((entries) => {
            if (fired || !entries.some((e) => e.isIntersecting)) return;
            fired = true;
            act('showMoreTrashRows');
        }, { root, rootMargin: '0px 0px 240px 0px' });
        io.observe(el);
        return () => io.disconnect();
    }, [shown]);
    return (
        <tr className="trash-more-row" ref={ref}>
            <td colSpan={3} style={{ textAlign: 'center', padding: '8px' }}>
                <button type="button" className="btn-sm trash-more-btn" onClick={onAct('showMoreTrashRows')}>⬇️ បង្ហាញ {more} ក្រុមទៀត</button>
            </td>
        </tr>
    );
}

function ObservedGroup({ row }: { row: TrashRowModel }) {
    return (
        <>
            <GroupRow row={row} />
            {row.subRows.map((sub) => (
                <tr className="trash-sub-row" key={sub.id}>
                    <td>
                        {sub.codes.length
                            ? sub.codes.map((code, i) => (
                                <Fragment key={code + i}>{i > 0 ? ' ' : null}<span className="barcode-tag">{code}</span></Fragment>
                            ))
                            : <span className="trash-more-codes">គ្មាន Barcode</span>}
                    </td>
                    <td>
                        <span className="count-badge">📦 {sub.count}</span>{' '}
                        <span className="trash-money">${sub.total.toFixed(2)}</span>
                    </td>
                    <td style={{ textAlign: 'center' }}><RowActions id={sub.id} /></td>
                </tr>
            ))}
        </>
    );
}
