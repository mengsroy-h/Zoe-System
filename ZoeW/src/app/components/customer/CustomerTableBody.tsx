import { lookupState } from '../../../core/state';
import { useStore } from '../../hooks/useStore';

export interface CustomerTableView {
    empty: string | null;
    rows: { barcode: string; dod: string; cod: string; phone: string }[];
    overflow: number;
}

/** តារាងអតិថិជនដែលទាញពី Lookup API (មើលជាមុន · ស្វែងរកខាងក្នុង)។ */
export function CustomerTableBody() {
    useStore(lookupState);
    const view = lookupState.customerTableView as CustomerTableView | null;
    if (!view) return null;
    if (view.empty !== null) {
        return (
            <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '16px' }}>{view.empty}</td></tr>
        );
    }
    return (
        <>
            {view.rows.map((r, i) => (
                <tr key={r.barcode + '|' + i}>
                    <td>{r.barcode}</td>
                    <td>{r.dod}</td>
                    <td>{r.cod}</td>
                    <td>{r.phone}</td>
                </tr>
            ))}
            {view.overflow > 0 && (
                <tr>
                    <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '8px' }}>
                        ... និងមាន {view.overflow} ជួរដេកទៀត (សូមស្វែងរកឲ្យតូចជាងនេះ)
                    </td>
                </tr>
            )}
        </>
    );
}
