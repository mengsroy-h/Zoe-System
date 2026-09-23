import { onAct } from '../../actions';

export function PinSetupModal() {
    return (
        <div id="pinSetupModal" className="modal" data-close="cancelPinSetupFlow">
            <div className="modal-content">
                <h3>⚙️ កំណត់ Security PIN ថ្មី</h3>
                <p id="pinSetupModalDesc">សូមកំណត់លេខកូដ PIN សម្រាប់ការពារការ Config លើកក្រោយ</p>
                <input type="password" id="newSecurityPinInput" placeholder="លេខកូដ PIN ថ្មី" autoComplete="off" />
                <div className="modal-btns">
                    <button className="btn-cancel" onClick={onAct("cancelPinSetupFlow")}>បោះបង់</button>
                    <button className="btn-confirm" id="pinSetupSaveBtn" onClick={onAct("saveNewSecurityPin")}>រក្សាទុក PIN</button>
                </div>
            </div>
        </div>
    );
}
