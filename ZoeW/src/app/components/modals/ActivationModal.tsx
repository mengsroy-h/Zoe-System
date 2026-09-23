import { Modal } from './Modal';
import { viewState } from '../../../core/view-state';
import { onAct } from '../../actions';
import { useStoreFields } from '../../hooks/useStore';
import { refTo } from '../../refs';

export function ActivationModal() {
    const v = useStoreFields(viewState, ['activationMessage', 'activationBusy']);
    return (
        <Modal id="activationModal" style={{ display: "none" }} noDismiss>
            <div className="modal-content">
                <h3>🔑 ត្រូវការ Activation Key</h3>
                <p id="activationModalMsg">{v.activationMessage}</p>
                <textarea
                    id="activationKeyInput"
                    ref={refTo('activationKeyInput')}
                    placeholder="ZOEKEY-..."
                    style={{ minHeight: "70px", fontFamily: "monospace", fontSize: "calc(11 * var(--fs-unit))" }}
                ></textarea>
                <div className="modal-btns">
                    <button className="btn-confirm" id="activationSubmitBtn" disabled={v.activationBusy} onClick={onAct("submitActivationKey")}>{v.activationBusy ? 'កំពុងផ្ទៀងផ្ទាត់...' : 'ដាក់ Active'}</button>
                    <button className="btn-cancel" id="activationLogoutBtn" onClick={onAct("logoutApp")}>ចាកចេញ</button>
                </div>
                <p
                    style={{ marginTop: "10px", fontSize: "calc(11.5 * var(--fs-unit))", color: "var(--text-muted)", textAlign: "center" }}
                >
                    មិនទាន់មាន Key? ទាក់ទង{' '}
                    <a
                        href="https://t.me/mengsroyhun"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "var(--primary)", fontWeight: "600" }}
                    >
                        @mengsroyhun
                    </a>
                    {' '}តាម Telegram
                </p>
            </div>
        </Modal>
    );
}
