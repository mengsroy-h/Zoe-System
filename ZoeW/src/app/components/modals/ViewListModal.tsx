import { viewState } from '../../../core/view-state';
import { useStoreFields } from '../../hooks/useStore';
import { Modal } from './Modal';
import { onAct } from '../../actions';
import { BarcodeListContainer } from '../barcode/BarcodeListContainer';

export function ViewListModal() {
    const v = useStoreFields(viewState, ['listModalPhoneText']);
    return (
        <Modal id="viewListModal">
            <div className="modal-content">
                <h3>📦 បញ្ជីអីវ៉ាន់ទាំងអស់</h3>
                <p style={{ marginBottom: "6px" }}>
                    លេខទូរស័ព្ទ៖{' '}
                    <strong
                        id="listModalPhoneText"
                        style={{ color: "var(--primary)", fontSize: "calc(12 * var(--fs-unit))" }}
                    >{v.listModalPhoneText}</strong>
                </p>
                <div
                    className="table-responsive"
                    style={{ maxHeight: "280px", marginBottom: "8px", border: "1px solid var(--border-color)", borderRadius: "var(--radius-md)" }}
                >
                    <div id="barcodeListContainer">
                        <BarcodeListContainer />
                    </div>
                </div>
                <div className="modal-btns">
                    <button className="btn-cancel" onClick={onAct("closeModal", { args: ["viewListModal"] })}>បិទ</button>
                </div>
            </div>
        </Modal>
    );
}
