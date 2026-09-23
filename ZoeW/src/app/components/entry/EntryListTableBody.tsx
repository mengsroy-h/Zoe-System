import { uiState } from '../../../core/state';
import { useStore } from '../../hooks/useStore';

export interface EntryListRow {
    n: number;
    phone: string;
    time: string;
    codeText: string;
    total: string;
}

/** បញ្ជីកញ្ចប់ដែលស្កេនថ្ងៃនេះ (ទំព័រស្កេន ➜ ផ្ទាំងកញ្ចប់)។ */
export function EntryListTableBody() {
    useStore(uiState);
    const rows = uiState.entryListView as EntryListRow[] | null;
    if (!rows || !rows.length) return null;
    return (
        <>
            {rows.map((r) => (
                <tr key={r.n}>
                    <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--text-muted)' }}>{r.n}</td>
                    <td>
                        {r.phone
                            ? <span className="phone-cell">{r.phone}</span>
                            : <span className="phone-empty">គ្មានលេខ</span>}
                        <div className="scan-time-tag">{r.time}</div>
                    </td>
                    <td><span className="barcode-tag">{r.codeText}</span></td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>${r.total}</td>
                </tr>
            ))}
        </>
    );
}
