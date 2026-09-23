import { Modal } from './Modal';
import { onAct } from '../../actions';
import { MonthlyReportMonthSelect } from '../reports/MonthlyReportMonthSelect';
import { MonthlyReportBody } from '../reports/MonthlyReportBody';

export function MonthlyReportModal() {
    return (
        <Modal id="monthlyReportModal">
            <div className="modal-content">
                <h3>📈 របាយការណ៍អាជីវកម្មប្រចាំខែ</h3>
                <p>
                    សង្ខេបចំណូល និងកញ្ចប់ក្នុងមួយខែ គិតចេញពី{' '}
                    <b>កំណត់ត្រាប្រចាំថ្ងៃ</b>
                    {' '}ដែលរក្សាទុកជានិច្ចក្នុង Database។{' '}
                    <b>ចំណូល = តម្លៃកញ្ចប់ដែលអតិថិជនយករួច</b>
                    {' '}ប៉ុណ្ណោះ។
                </p>
                <MonthlyReportMonthSelect />
                <div id="monthlyReportBody" className="mrep-body">
                    <MonthlyReportBody />
                </div>
                <p className="mrep-foot">
                    របាយការណ៍នេះ{' '}
                    <b>អានតែប៉ុណ្ណោះ</b>
                    {' '}— វាមិនកែទិន្នន័យ ឬលុយអ្វីទាំងអស់។
                </p>
                <div className="modal-btns" style={{ flexDirection: "column", gap: "8px" }}>
                    <button
                        className="btn-confirm"
                        style={{ background: "#1d6f42" }}
                        onClick={onAct("exportMonthlyReportAsExcel")}
                    >
                        📗 Excel (.xlsx)
                    </button>
                    <button
                        className="btn-confirm"
                        style={{ background: "#b91c1c" }}
                        onClick={onAct("exportMonthlyReportAsPDF")}
                    >
                        📕 PDF (.pdf)
                    </button>
                    <button className="btn-cancel" onClick={onAct("closeModal", { args: ["monthlyReportModal"] })}>បិទ</button>
                </div>
            </div>
        </Modal>
    );
}
