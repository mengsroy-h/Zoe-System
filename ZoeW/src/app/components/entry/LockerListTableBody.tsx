import { memo } from 'react';
import { uiState } from '../../../core/state';
import { useStoreFields } from '../../hooks/useStore';

const LOCKER_LIST_FIELDS = ['lockerListView'] as const;

export interface LockerListRow {
    n: number;
    phone: string;
    lockerText: string;
}

export interface LockerListView {
    rows: LockerListRow[];
    overflow: number;
}

export function LockerListTableBody() {
    const view = useStoreFields(uiState, LOCKER_LIST_FIELDS).lockerListView as LockerListView | null;
    if (!view || !view.rows.length) return null;
    return (
        <>
            {view.rows.map((r) => (
                <tr key={r.n}>
                    <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--text-muted)' }}>{r.n}</td>
                    <td>
                        {r.phone
                            ? <span className="phone-cell">{r.phone}</span>
                            : <span className="phone-empty">គ្មានលេខ</span>}
                    </td>
                    <td><span className="locker-badge">{r.lockerText}</span></td>
                </tr>
            ))}
            {view.overflow > 0 && (
                <tr>
                    <td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '8px' }}>
                        ... និងមាន {view.overflow} ជួរដេកទៀត (សូមស្វែងរក ឬច្រោះតាមទីតាំង)
                    </td>
                </tr>
            )}
        </>
    );
}

export const MemoLockerListTableBody = memo(LockerListTableBody);
