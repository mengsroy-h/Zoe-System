import { viewState } from '../../../core/view-state';
import { useStoreValue } from '../../hooks/useStore';
import { refTo } from '../../refs';
import { Modal } from './Modal';
import { onAct } from '../../actions';

export function ManualAdjustModal() {
    const busy = useStoreValue(viewState, (st) => st.manualAdjustBusy);
    return (
        <Modal id="manualAdjustModal">
            <div className="modal-content">
                <h3>⚙️ កែប្រែ COD, DOD & កញ្ចប់ដោយដៃ</h3>
                <p>ជ្រើសរើសកាលបរិច្ឆេទ (YYYY-MM-DD) និងចំនួនដែលចង់កែប្រែ</p>
                <label
                    style={{ fontSize: "calc(10 * var(--fs-unit))", fontWeight: "600", color: "var(--text-muted)", display: "block", textAlign: "left", marginBottom: "2px" }}
                >
                    កាលបរិច្ឆេទ (YYYY-MM-DD):
                </label>
                <input type="text" id="manualDateInput" ref={refTo('manualDateInput')} placeholder="ឧ. 2026-06-05" />
                <label
                    style={{ fontSize: "calc(10 * var(--fs-unit))", fontWeight: "600", color: "var(--text-muted)", display: "block", textAlign: "left", marginBottom: "2px" }}
                >
                    ទឹកប្រាក់ COD ($) [+ បន្ថែម, - ដកចេញ]:
                </label>
                <input type="number" id="manualCodChangeInput" ref={refTo('manualCodChangeInput')} placeholder="ឧ. -5.00 ឬ 10.00" step={0.01} />
                <label
                    style={{ fontSize: "calc(10 * var(--fs-unit))", fontWeight: "600", color: "var(--text-muted)", display: "block", textAlign: "left", marginBottom: "2px" }}
                >
                    ទឹកប្រាក់ DOD ($) [+ បន្ថែម, - ដកចេញ]:
                </label>
                <input type="number" id="manualDodChangeInput" ref={refTo('manualDodChangeInput')} placeholder="ឧ. -2.00 ឬ 5.00" step={0.01} />
                <label
                    style={{ fontSize: "calc(10 * var(--fs-unit))", fontWeight: "600", color: "var(--text-muted)", display: "block", textAlign: "left", marginBottom: "2px" }}
                >
                    ចំនួនកញ្ចប់ [+ បន្ថែម, - ដកចេញ]:
                </label>
                <input type="number" id="manualCountChangeInput" ref={refTo('manualCountChangeInput')} placeholder="ឧ. -2 ឬ 1" step={1} />
                <div className="modal-btns" style={{ marginTop: "6px" }}>
                    <div className="modal-btns-row">
                        <button
                            className="btn-confirm btn-warning"
                            id="manualAdjustSubmitBtn"
                            disabled={busy}
                            onClick={onAct("submitManualAdjustment")}
                        >
                            បញ្ជាក់ការកែប្រែ
                        </button>
                        <button className="btn-cancel" onClick={onAct("closeModal", { args: ["manualAdjustModal"] })}>បោះបង់</button>
                    </div>
                </div>
            </div>
        </Modal>
    );
}
