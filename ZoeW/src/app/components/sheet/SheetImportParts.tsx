import { uiState } from '../../../core/state';
import { useStore } from '../../hooks/useStore';
import { SHEET_IMPORT_CHIP_CLASSES, SHEET_IMPORT_MSG_CLASSES } from '../../../features/sheet-import';
import { emptySheetImportView } from './model';

function view(): any {
    return uiState.sheetImportView || emptySheetImportView();
}

function Msg({ host }: { host: string }) {
    useStore(uiState);
    const m = view().msgs[host];
    if (!m || !m.text) return null;
    return <div className={(SHEET_IMPORT_MSG_CLASSES as any)[m.kind] || SHEET_IMPORT_MSG_CLASSES.warn}>{m.text}</div>;
}

export function SiConfigMsg() { return <Msg host="siConfigMsg" />; }
export function SiFileMsg() { return <Msg host="siFileMsg" />; }
export function SiMapMsg() { return <Msg host="siMapMsg" />; }
export function SiActionMsg() { return <Msg host="siActionMsg" />; }
export function SiClearMsg() { return <Msg host="siClearMsg" />; }

export function SiConfigSummary() {
    useStore(uiState);
    const s = view().summary;
    if (!s) return null;
    return (
        <>
            <div className="si-summary-line">{'🔗 ' + s.url}</div>
            <div className="si-summary-note">URL និងពាក្យសម្ងាត់ត្រូវអ៊ិនគ្រីបដោយកូនសោដែលបង្កើតពី Security PIN</div>
        </>
    );
}

export function SiChips() {
    useStore(uiState);
    return (
        <>
            {view().chips.map((c: any, i: number) => (
                <span key={i} className={(SHEET_IMPORT_CHIP_CLASSES as any)[c.kind] || 'si-chip'}>{c.text}</span>
            ))}
        </>
    );
}

export function SiPreviewBody() {
    useStore(uiState);
    return (
        <>
            {view().previewRows.map((r: string[], i: number) => (
                <tr key={i}>
                    {r.map((value, idx) => (
                        <td key={idx} className={idx === 1 || idx === 2 ? 'si-num' : undefined}>{value}</td>
                    ))}
                </tr>
            ))}
        </>
    );
}
