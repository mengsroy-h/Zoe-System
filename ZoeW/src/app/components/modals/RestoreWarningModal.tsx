import { Modal } from './Modal';
import { onAct } from '../../actions';

export function RestoreWarningModal() {
    return (
        <Modal
            id="restoreWarningModal"
            style={{ zIndex: "1060" }}
            close="cancelRestoreItem"
        >
            <div className="modal-content">
                <h3 style={{ color: "var(--warning)" }}>⚠️ បញ្ជាក់ការស្តារទិន្នន័យ</h3>
                <p>តើអ្នកពិតជាចង់ស្តារទិន្នន័យកញ្ចប់អីវ៉ាន់នេះពីធុងសំរាមមែនទេ?</p>
                <div className="modal-btns" style={{ marginTop: "10px" }}>
                    <div className="modal-btns-row">
                        <button
                            className="btn-confirm btn-success"
                            id="restoreConfirmBtn"
                            onClick={onAct("executeRestoreItem")}
                        >
                            យល់ព្រមស្តារ
                        </button>
                        <button className="btn-cancel" onClick={onAct("cancelRestoreItem")}>បោះបង់</button>
                    </div>
                </div>
            </div>
        </Modal>
    );
}
