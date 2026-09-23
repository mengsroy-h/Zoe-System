import { onAct } from '../../actions';

export function ExportDataModal() {
    return (
        <div id="exportDataModal" className="modal">
            <div className="modal-content">
                <h3>📤 Export ទិន្នន័យ</h3>
                <p>
                    Export ទិន្នន័យប្រវត្តិដែលកំពុងបង្ហាញ (តាមតម្រង «
                    <span id="exportFilterLabel">ថ្ងៃនេះ</span>
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
        </div>
    );
}
