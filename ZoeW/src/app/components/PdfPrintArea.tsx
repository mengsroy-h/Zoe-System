import { uiState } from '../../core/state';
import { labelMoneyText, type LabelLayout, type LabelPrintView } from '../../features/label-print';
import { useStore } from '../hooks/useStore';
import { Code128Svg } from './zto/Code128Svg';

export interface PdfTableView {
    title: string;
    headers: string[];
    rows: string[][];
    totalRow: { cells: string[]; spans?: (number | undefined)[] };
    footer: React.ReactNode;
}

const LABEL_SHEET_CLASS: Record<LabelLayout, string> = {
    '50x30': 'label-sheet layout-50x30',
    '40x30': 'label-sheet layout-40x30',
    '60x40': 'label-sheet layout-60x40',
    'single': 'label-sheet layout-single',
    'a4-3': 'label-sheet layout-a4-3',
    'a4-2': 'label-sheet layout-a4-2'
};

function labelFitStyle(phone: string, money: string, code: string): React.CSSProperties {
    return { ['--label-phone-chars' as string]: Math.max(1, String(phone).length), ['--label-money-chars' as string]: Math.max(1, money.length),
        ['--label-code-chars' as string]: Math.max(1, String(code).length) } as React.CSSProperties;
}

export function LabelSheet({ view }: { view: LabelPrintView }) {
    const o = view.options;
    return (
        <div className={LABEL_SHEET_CLASS[o.layout] || LABEL_SHEET_CLASS['50x30']} data-label-count={view.labels.length}>
            {view.labels.map((row, i) => {
                const money = o.money ? labelMoneyText(row) : '';
                return (
                    <div className="label" key={row.barcode + '~' + i} style={labelFitStyle(row.phone, money, row.barcode)}>
                        <div className="label-phone">{row.phone}</div>
                        <div className="label-bc"><Code128Svg code={row.barcode} /></div>
                        <div className="label-code">{row.barcode}</div>
                        {money ? <div className="label-money">{money}</div> : null}
                        {(o.date && row.date) || (o.locker && row.locker) ? (
                            <div className="label-meta">
                                {o.date && row.date ? <span className="label-date">{row.date}</span> : null}
                                {o.locker && row.locker ? <span className="label-locker">{row.locker}</span> : null}
                            </div>
                        ) : null}
                    </div>
                );
            })}
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
