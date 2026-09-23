import { Modal } from './Modal';
import { onAct } from '../../actions';

export function LogoutConfirmModal() {
    return (
        <Modal
            id="logoutConfirmModal"
            style={{ zIndex: "1060" }}
            close="cancelLogout"
        >
            <div className="modal-content">
                <h3>🚪 ចាកចេញពីប្រព័ន្ធ</h3>
                <p>តើអ្នកពិតជាចង់ចាកចេញមែនទេ? អ្នកនឹងត្រូវចូលប្រព័ន្ធម្តងទៀតដើម្បីបន្តការងារ។</p>
                <div className="modal-btns" style={{ marginTop: "10px" }}>
                    <div className="modal-btns-row">
                        <button className="btn-confirm" id="logoutConfirmBtn" onClick={onAct("confirmLogout")}>យល់ព្រម</button>
                        <button className="btn-cancel" onClick={onAct("cancelLogout")}>បោះបង់</button>
                    </div>
                </div>
            </div>
        </Modal>
    );
}
