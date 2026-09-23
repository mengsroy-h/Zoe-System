import { onAct } from '../../actions';

export function PinModal() {
    return (
        <div id="pinModal" className="modal" data-close="cancelPinEntryFlow">
            <div className="modal-content">
                <h3>🔒 បញ្ចូល Security PIN</h3>
                <p id="pinModalDesc">សូមវាយលេខកូដសុវត្ថិភាពដើម្បី Config ឬ Reconfig</p>
                <input type="password" id="securityPinInput" placeholder="លេខកូដ PIN (ឧ. 0000)" autoComplete="off" />
                <button
                    type="button"
                    className="btn-biometric"
                    id="pinBiometricBtn"
                    style={{ display: "none" }}
                    onClick={onAct("runBiometricUnlock")}
                >
                    <span className="bio-ico" aria-hidden="true">🫆</span>
                    <span className="bio-label">ស្កេនក្រយៅដៃ ឬមុខ</span>
                </button>
                <div className="modal-btns">
                    <div className="modal-btns-row">
                        <button className="btn-confirm" id="pinConfirmBtn" onClick={onAct("verifySecurityPin")}>ផ្ទៀងផ្ទាត់</button>
                        <button className="btn-cancel" onClick={onAct("cancelPinEntryFlow")}>បោះបង់</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
