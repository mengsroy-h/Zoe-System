import { Modal } from './Modal';
import { onAct } from '../../actions';

export function PermanentDeleteWarningModal() {
    return (
        <Modal
            id="permanentDeleteWarningModal"
            style={{ zIndex: "1060" }}
            close="cancelPermanentDelete"
        >
            <div className="modal-content">
                <h3 style={{ color: "#ef4444" }}>🗑️ លុបជាអចិន្ត្រៃយ៍</h3>
                <p>
                    ទិន្នន័យនេះនឹងបាត់អស់អចិន្ត្រៃយ៍{' '}
                    <strong>មិនអាចស្តារមកវិញបានទៀតទេ!</strong>
                    {' '}តើអ្នកប្រាកដទេ?
                </p>
                <div className="modal-btns" style={{ marginTop: "10px" }}>
                    <div className="modal-btns-row">
                        <button
                            className="btn-confirm btn-danger"
                            id="permanentDeleteConfirmBtn"
                            onClick={onAct("executePermanentDelete")}
                        >
                            លុបជាអចិន្ត្រៃយ៍
                        </button>
                        <button className="btn-cancel" onClick={onAct("cancelPermanentDelete")}>បោះបង់</button>
                    </div>
                </div>
            </div>
        </Modal>
    );
}
