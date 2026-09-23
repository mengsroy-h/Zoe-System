import { viewState } from '../../../core/view-state';
import { useStoreFields } from '../../hooks/useStore';
import { Modal } from './Modal';
import { onAct } from '../../actions';

export function LocationWarningModal() {
    const v = useStoreFields(viewState, ['locationWarningText']);
    return (
        <Modal
            id="locationWarningModal"
            style={{ zIndex: "1065" }}
            close="cancelLocationChange"
        >
            <div className="modal-content">
                <h3 style={{ color: "var(--warning)" }}>⚠️ កញ្ចប់នេះមានទីតាំងស្រាប់</h3>
                <p id="locationWarningText">{v.locationWarningText}</p>
                <div className="modal-btns" style={{ marginTop: "10px" }}>
                    <div className="modal-btns-row">
                        <button
                            className="btn-confirm btn-warning"
                            id="locationWarningConfirmBtn"
                            onClick={onAct("confirmLocationChange")}
                        >
                            យល់ព្រម ផ្លាស់ទី
                        </button>
                        <button className="btn-cancel" onClick={onAct("cancelLocationChange")}>បោះបង់</button>
                    </div>
                </div>
            </div>
        </Modal>
    );
}
