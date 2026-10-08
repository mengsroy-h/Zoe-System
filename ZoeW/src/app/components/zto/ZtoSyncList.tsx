import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { ztoState } from '../../../core/state';
import { useStoreFields } from '../../hooks/useStore';
import { Code128Svg } from './Code128Svg';
import { code128Bars } from '../../../features/zto-status';

export interface ZtoSyncEntry { code: string; phone: string; locker: string }
export interface ZtoSyncListView { empty: string | null; entries: ZtoSyncEntry[] }

export const ZTO_SYNC_PAGE_ROWS = 20;

const ZTO_SYNC_FIELDS = ['ztoSyncListView'] as const;

function ZtoSyncRow({ entry, no }: { entry: ZtoSyncEntry; no: number }) {
    const meta = (entry.phone || '—') + (entry.locker ? ' · ' + entry.locker : '');
    const drawable = !!code128Bars(entry.code);
    return (
        <div className="zto-sync-item">
            <div className="zto-sync-head">
                <span className="zto-sync-no">{no}</span>
                <span className="zto-sync-body">
                    <span className="zto-sync-code">{entry.code}</span>
                    <span className="zto-sync-meta">{meta}</span>
                </span>
            </div>
            <div className={'zto-sync-bc-wrap' + (drawable ? '' : ' zto-sync-bc-none')}>
                {drawable ? <Code128Svg code={entry.code} /> : '⚠️ លេខនេះគូរជារូប Barcode មិនបាន — សូមវាយដោយដៃ'}
            </div>
        </div>
    );
}

const MemoZtoSyncRow = memo(ZtoSyncRow, (a, b) => a.no === b.no && a.entry.code === b.entry.code
    && a.entry.phone === b.entry.phone && a.entry.locker === b.entry.locker);

function ZtoSyncMore({ remaining, onMore }: { remaining: number; onMore: () => void }) {
    const ref = useRef<HTMLDivElement | null>(null);
    useEffect(() => {
        const el = ref.current;
        if (!el || typeof IntersectionObserver !== 'function') return;
        let fired = false;
        const io = new IntersectionObserver((entries) => {
            if (fired || !entries.some((e) => e.isIntersecting)) return;
            fired = true;
            onMore();
        }, { root: el.closest('.modal-content'), rootMargin: '0px 0px 320px 0px' });
        io.observe(el);
        return () => io.disconnect();
    }, [remaining, onMore]);
    return (
        <div className="zto-sync-more" ref={ref}>
            <button type="button" className="btn-sm zto-sync-more-btn" onClick={onMore}>⬇️ បង្ហាញ {remaining} ទៀត</button>
        </div>
    );
}

export function ZtoSyncList() {
    const view = useStoreFields(ztoState, ZTO_SYNC_FIELDS).ztoSyncListView as ZtoSyncListView | null;
    const [limit, setLimit] = useState(ZTO_SYNC_PAGE_ROWS);
    const more = useCallback(() => setLimit((n) => n + ZTO_SYNC_PAGE_ROWS), []);
    if (!view) return null;
    if (view.empty !== null) return <div className="zto-sync-empty">{view.empty}</div>;
    const shown = view.entries.slice(0, limit);
    const remaining = view.entries.length - shown.length;
    return (
        <>
            {shown.map((entry, idx) => <MemoZtoSyncRow key={entry.code} entry={entry} no={idx + 1} />)}
            {remaining > 0 ? <ZtoSyncMore remaining={remaining} onMore={more} /> : null}
        </>
    );
}
