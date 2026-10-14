import { uiState } from '../../core/state';
import { labelMoneyText, type LabelPrintView } from '../../features/label-print';
import { useStore } from '../hooks/useStore';
import { Code128Svg } from './zto/Code128Svg';

export interface PdfTableView {
    title: string;
    headers: string[];
    rows: string[][];
    totalRow: { cells: string[]; spans?: (number | undefined)[] };
    footer: React.ReactNode;
}

export function LabelSheet({ view }: { view: LabelPrintView }) {
    const o = view.options;
    return (
        <div className={'label-sheet layout-' + o.layout} data-label-count={view.labels.length}>
            {view.labels.map((row, i) => (
                <div className="label" key={row.barcode + '~' + i}>
                    <div className="label-phone">{row.phone}</div>
                    <div className="label-bc"><Code128Svg code={row.barcode} /></div>
                    <div className="label-code">{row.barcode}</div>
                    {o.money && labelMoneyText(row) ? <div className="label-money">{labelMoneyText(row)}</div> : null}
                    {(o.date && row.date) || (o.locker && row.locker) ? (
                        <div className="label-meta">
                            {o.date && row.date ? <span className="label-date">{row.date}</span> : null}
                            {o.locker && row.locker ? <span className="label-locker">{row.locker}</span> : null}
                        </div>
                    ) : null}
                </div>
            ))}
        </div>
    );
}

export function PdfPrintArea() {
    useStore(uiState);
    const view = uiState.pdfExportView as PdfTableView | LabelPrintView | null;
    if (!view) return null;
    if ((view as LabelPrintView).kind === 'labels') return <LabelSheet view={view as LabelPrintView} />;
    const table = view as PdfTableView;
    return (
        <>
            <h2>{table.title}</h2>
            <table>
                <thead><tr>{table.headers.map((h) => <th key={h}>{h}</th>)}</tr></thead>
                <tbody>
                    {table.rows.map((cells, i) => (
                        <tr key={i}>{cells.map((c, j) => <td key={j}>{c}</td>)}</tr>
                    ))}
                    <tr className="export-total-row">
                        {table.totalRow.cells.map((c, j) => (
                            <td key={j} colSpan={table.totalRow.spans ? table.totalRow.spans[j] : undefined}>{c}</td>
                        ))}
                    </tr>
                </tbody>
            </table>
            <p className="export-footer">{table.footer}</p>
        </>
    );
}
