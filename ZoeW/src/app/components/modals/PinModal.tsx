import { Modal } from './Modal';
import { viewState } from '../../../core/view-state';
import { onAct } from '../../actions';
import { useStoreValue } from '../../hooks/useStore';
import { refTo } from '../../refs';
import { BiometricLabel } from '../shell/BiometricLabel';

export function PinModal() {
    const desc = useStoreValue(viewState, (s) => s.pinPromptVerifyText);
    const biometricVisible = useStoreValue(viewState, (s) => s.pinBiometricVisible);
    const biometricBusy = useStoreValue(viewState, (s) => s.pinBiometricBusy);
    return (
        <Modal id="pinModal" close="cancelPinEntryFlow">
            <div className="modal-content">
                <h3>🔒 បញ្ចូល Security PIN</h3>
                <p id="pinModalDesc">{desc}</p>
                <input type="password" id="securityPinInput" ref={refTo('securityPinInput')} placeholder="លេខកូដ PIN (ឧ. 0000)" autoComplete="off" />
                <button
                    type="button"
                    className="btn-biometric"
                    id="pinBiometricBtn"
                    style={biometricVisible ? undefined : { display: "none" }}
                    disabled={biometricBusy}
                    onClick={onAct("runBiometricUnlock")}
                >
                    <BiometricLabel busy={biometricBusy} />
                </button>
                <div className="modal-btns">
                    <div className="modal-btns-row">
                        <button className="btn-confirm" id="pinConfirmBtn" onClick={onAct("verifySecurityPin")}>ផ្ទៀងផ្ទាត់</button>
                        <button className="btn-cancel" onClick={onAct("cancelPinEntryFlow")}>បោះបង់</button>
                    </div>
                </div>
            </div>
        </Modal>
    );
}
