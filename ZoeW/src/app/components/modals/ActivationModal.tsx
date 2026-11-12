import { Modal } from './Modal';
import { viewState } from '../../../core/view-state';
import { onAct } from '../../actions';
import { useStoreFields } from '../../hooks/useStore';
import { refTo } from '../../refs';
import { SellerTelegramLink } from '../shell/SellerTelegramLink';

export function ActivationModal() {
    const v = useStoreFields(viewState, ['activationMessage', 'activationBusy', 'seatEnrollmentBusy', 'seatEnrollmentOnly', 'seatEnrollmentJson', 'seatEnrollmentFingerprint', 'seatEnrollmentMessage']);
    return (
        <Modal id="activationModal" style={{ display: "none" }} noDismiss>
            <div className="modal-content">
                <h3>{v.seatEnrollmentOnly ? '🔐 ចុះឈ្មោះឧបករណ៍' : '🔑 ត្រូវការ Activation Key'}</h3>
                <p id="activationModalMsg">{v.activationMessage}</p>
                <textarea
                    id="activationKeyInput"
                    ref={refTo('activationKeyInput')}
                    onChange={onAct('clearSeatEnrollment')}
                    placeholder="ZOEKEY-..."
                    style={{ minHeight: "70px", fontFamily: "monospace", fontSize: "calc(11 * var(--fs-unit))" }}
                ></textarea>
                <div className="modal-btns">
                    <button className="btn-confirm" id="activationSubmitBtn" disabled={v.activationBusy || v.seatEnrollmentBusy} onClick={onAct("submitActivationKey")}>{v.activationBusy ? 'កំពុងផ្ទៀងផ្ទាត់...' : 'ដាក់ Active'}</button>
                    <button className="btn-confirm" id="seatEnrollmentPrepareBtn" disabled={v.activationBusy || v.seatEnrollmentBusy} onClick={onAct('prepareSeatEnrollment')}>{v.seatEnrollmentBusy ? 'កំពុងរៀបចំ...' : 'ចុះឈ្មោះឧបករណ៍'}</button>
                    <button className="btn-cancel" id="seatIdentityRepairBtn" disabled={v.activationBusy || v.seatEnrollmentBusy} onClick={onAct('repairSeatEnrollmentIdentity')}>ជួសជុលកូនសោឧបករណ៍ដែលខូច</button>
                    {v.seatEnrollmentBusy && <button className="btn-cancel" onClick={onAct('clearSeatEnrollment')}>បោះបង់</button>}
                    {v.seatEnrollmentOnly && <button className="btn-cancel" onClick={onAct('closeSeatEnrollment')}>បិទ</button>}
                    <button className="btn-cancel" id="activationLogoutBtn" onClick={onAct("logoutApp")}>ចាកចេញ</button>
                </div>
                <p role="status">{v.seatEnrollmentMessage}</p>
                {v.seatEnrollmentJson && <div>
                    <label htmlFor="seatEnrollmentFingerprint">Fingerprint</label>
                    <textarea id="seatEnrollmentFingerprint" readOnly value={v.seatEnrollmentFingerprint} aria-label="Fingerprint" />
                    <label htmlFor="seatEnrollmentJson">សំណើចុះឈ្មោះឧបករណ៍</label>
                    <textarea id="seatEnrollmentJson" readOnly value={v.seatEnrollmentJson} style={{ minHeight: '110px', fontFamily: 'monospace' }} />
                    <p>បើកូនសោឧបករណ៍បាត់ ឬខូច សូមឱ្យអ្នកលក់ដោះកៅអីចាស់ ហើយចុះឈ្មោះឡើងវិញ។ កុំលុប Storage ដើម្បីដោះស្រាយ។</p>
                </div>}
                <p
                    style={{ marginTop: "10px", fontSize: "calc(11.5 * var(--fs-unit))", color: "var(--text-muted)", textAlign: "center" }}
                >
                    មិនទាន់មាន Key? ទាក់ទង{' '}
                    <SellerTelegramLink />
                    {' '}តាម Telegram
                </p>
            </div>
        </Modal>
    );
}
