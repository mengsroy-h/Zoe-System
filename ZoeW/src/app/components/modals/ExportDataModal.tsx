import { viewState } from '../../../core/view-state';
import { useStoreFields } from '../../hooks/useStore';
import { Modal } from './Modal';
import { onAct } from '../../actions';

export function ExportDataModal() {
    const v = useStoreFields(viewState, ['exportFilterLabel']);
    return (
        <Modal id="exportDataModal">
            <div className="modal-content">
                <h3>📤 Export ទិន្នន័យ</h3>
                <p>
                    Export ទិន្នន័យប្រវត្តិដែលកំពុងបង្ហាញ (តាមតម្រង «
                    <span id="exportFilterLabel">{v.exportFilterLabel}</span>
                    ») ចេញជាឯកសារ
                </p>
                <div className="modal-btns" style={{ flexDirection: "column", gap: "8px" }}>
                    <button
                        className="btn-confirm"
                        style={{ background: "#1d6f42" }}
                        onClick={onAct("exportDataAsExcel")}
                    >
                        📗 Excel (.xlsx)
                    </button>
                    <button
                        className="btn-confirm"
                        style={{ background: "#b91c1c" }}
                        onClick={onAct("exportDataAsPDF")}
                    >
                        📕 PDF (.pdf)
                    </button>
                    <button
                        className="btn-confirm"
                        style={{ background: "#137333" }}
                        onClick={onAct("exportDataAsCsvForSheets")}
                    >
                        📊 Google Sheet (.csv)
                    </button>
                    <button className="btn-cancel" onClick={onAct("closeModal", { args: ["exportDataModal"] })}>បោះបង់</button>
                </div>
            </div>
        </Modal>
    );
}
