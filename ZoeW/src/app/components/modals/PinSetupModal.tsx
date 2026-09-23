import { Modal } from './Modal';
import { viewState } from '../../../core/view-state';
import { onAct } from '../../actions';
import { useStoreValue } from '../../hooks/useStore';
import { refTo } from '../../refs';

export function PinSetupModal() {
    const desc = useStoreValue(viewState, (s) => s.pinPromptSetupText);
    return (
        <Modal id="pinSetupModal" close="cancelPinSetupFlow">
            <div className="modal-content">
                <h3>⚙️ កំណត់ Security PIN ថ្មី</h3>
                <p id="pinSetupModalDesc">{desc}</p>
                <input type="password" id="newSecurityPinInput" ref={refTo('newSecurityPinInput')} placeholder="លេខកូដ PIN ថ្មី" autoComplete="off" />
                <div className="modal-btns">
                    <button className="btn-cancel" onClick={onAct("cancelPinSetupFlow")}>បោះបង់</button>
                    <button className="btn-confirm" id="pinSetupSaveBtn" onClick={onAct("saveNewSecurityPin")}>រក្សាទុក PIN</button>
                </div>
            </div>
        </Modal>
    );
}
