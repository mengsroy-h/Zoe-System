import { uiState } from '../../core/state';
import { useStore } from '../hooks/useStore';

export interface PdfTableView {
    title: string;
    headers: string[];
    rows: string[][];
    totalRow: { cells: string[]; spans?: (number | undefined)[] };
    footer: React.ReactNode;
}

export function PdfPrintArea() {
    useStore(uiState);
    const view = uiState.pdfExportView as PdfTableView | null;
    if (!view) return null;
    return (
        <>
            <h2>{view.title}</h2>
            <table>
                <thead><tr>{view.headers.map((h) => <th key={h}>{h}</th>)}</tr></thead>
                <tbody>
                    {view.rows.map((cells, i) => (
                        <tr key={i}>{cells.map((c, j) => <td key={j}>{c}</td>)}</tr>
                    ))}
                    <tr className="export-total-row">
                        {view.totalRow.cells.map((c, j) => (
                            <td key={j} colSpan={view.totalRow.spans ? view.totalRow.spans[j] : undefined}>{c}</td>
                        ))}
                    </tr>
                </tbody>
            </table>
            <p className="export-footer">{view.footer}</p>
        </>
    );
}
