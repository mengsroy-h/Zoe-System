import { uiState } from '../../../core/state';
import { useStore } from '../../hooks/useStore';

export interface MonthlyTile {
    tone: string;
    label: string;
    value: string;
    sub: string;
    pending?: string;
}

export interface MonthlyMismatch { cod: string; dod: string; count: string }

export interface MonthlyReportView {
    empty: string | null;
    tiles: MonthlyTile[];
    mismatch: MonthlyMismatch | null;
    headers: string[];
    rows: {
        date: string; count: string; collectedCod: string; collectedDod: string;
        collectedTotal: string; pendingTotal: string; total: string; picked: string; customers: string;
    }[];
}

export function MonthlyReportBody() {
    useStore(uiState);
    const view = uiState.monthlyReportView as MonthlyReportView | null;
    if (!view) return null;

    if (view.empty !== null) return <p className="mrep-empty">{view.empty}</p>;

    return (
        <>
            <div className="mrep-sum">
                {view.tiles.map((t) => (
                    <div className={`mrep-tile ${t.tone}`} key={t.label}>
                        <span className="mrep-tile-label">{t.label}</span>
                        <b>{t.value}</b>
                        <span className="mrep-tile-sub">{t.sub}</span>
                        {t.pending ? <span className="mrep-tile-sub mrep-money-pending">{t.pending}</span> : null}
                    </div>
                ))}
            </div>
            {view.mismatch ? (
                <p className="mrep-note">⚠️ លេខសរុបប្រចាំខែក្នុង Database (COD ${view.mismatch.cod}
                    {' '}· DOD ${view.mismatch.dod} · {view.mismatch.count} កញ្ចប់)
                    មិនត្រូវនឹងផលបូកតាមថ្ងៃទេ។ របាយការណ៍នេះប្រើ <b>លេខតាមថ្ងៃ</b> ជាមូលដ្ឋាន
                    ព្រោះវាជាកំណត់ត្រាដែលរក្សាទុករាល់ថ្ងៃ។</p>
            ) : null}
            <div className="mrep-table-wrap">
                <table className="mrep-table">
                    <thead><tr>{view.headers.map((h) => <th key={h}>{h}</th>)}</tr></thead>
                    <tbody>
                        {view.rows.map((d) => (
                            <tr key={d.date}>
                                <td>{d.date}</td>
                                <td>{d.count}</td>
                                <td className="money-collected">{d.collectedCod}</td>
                                <td className="money-collected">{d.collectedDod}</td>
                                <td className="money-collected">{d.collectedTotal}</td>
                                <td className="money-pending">{d.pendingTotal}</td>
                                <td className="money-total">{d.total}</td>
                                <td>{d.picked}</td>
                                <td>{d.customers}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </>
    );
}
