import { Modal } from './Modal';
import { viewState } from '../../../core/view-state';
import { onAct } from '../../actions';
import { useStoreFields } from '../../hooks/useStore';
import { refTo } from '../../refs';
import { SellerTelegramLink } from '../shell/SellerTelegramLink';

export function ActivationModal() {
    const v = useStoreFields(viewState, ['backendKind', 'invitationCode', 'invitationBusy', 'invitationMessage', 'invitationVerificationCode', 'activationMessage', 'activationBusy', 'seatEnrollmentBusy', 'seatEnrollmentOnly', 'seatEnrollmentJson', 'seatEnrollmentFingerprint', 'seatEnrollmentMessage']);
    return (
        <Modal id="activationModal" style={{ display: "none" }} noDismiss>
            <div className="modal-content">
                <h3>{v.seatEnrollmentOnly ? '🔐 ចុះឈ្មោះឧបករណ៍' : '🔑 ត្រូវការ Activation Key'}</h3>
                <p id="activationModalMsg">{v.activationMessage}</p>
                <section aria-label="ដាក់ Key ដោយដៃ">
                <textarea
                    id="activationKeyInput"
                    ref={refTo('activationKeyInput')}
                    onChange={onAct('clearSeatEnrollment')}
                    placeholder="ZOEKEY-..."
                    style={{ minHeight: "70px", fontFamily: "monospace", fontSize: "calc(11 * var(--fs-unit))" }}
                ></textarea>
                <div className="modal-btns">
                    <button className="btn-confirm" id="activationSubmitBtn" disabled={v.activationBusy || v.seatEnrollmentBusy || v.invitationBusy} onClick={onAct("submitActivationKey")}>{v.activationBusy ? 'កំពុងផ្ទៀងផ្ទាត់...' : 'ដាក់ Active'}</button>
                    <button className="btn-confirm" id="seatEnrollmentPrepareBtn" disabled={v.activationBusy || v.seatEnrollmentBusy || v.invitationBusy} onClick={onAct('prepareSeatEnrollment')}>{v.seatEnrollmentBusy ? 'កំពុងរៀបចំ...' : 'ចុះឈ្មោះឧបករណ៍'}</button>
                    <button className="btn-cancel" id="seatIdentityRepairBtn" disabled={v.activationBusy || v.seatEnrollmentBusy || v.invitationBusy} onClick={onAct('repairSeatEnrollmentIdentity')}>ជួសជុលកូនសោឧបករណ៍ដែលខូច</button>
                    {v.seatEnrollmentBusy && <button className="btn-cancel" onClick={onAct('clearSeatEnrollment')}>បោះបង់</button>}
                    {v.seatEnrollmentOnly && <button className="btn-cancel" onClick={onAct('closeSeatEnrollment')}>បិទ</button>}

                </div>
                <p role="status">{v.seatEnrollmentMessage}</p>
                {v.seatEnrollmentJson && <div>
                    <label htmlFor="seatEnrollmentFingerprint">Fingerprint</label>
                    <textarea id="seatEnrollmentFingerprint" readOnly value={v.seatEnrollmentFingerprint} aria-label="Fingerprint" />
                    <label htmlFor="seatEnrollmentJson">សំណើចុះឈ្មោះឧបករណ៍</label>
                    <textarea id="seatEnrollmentJson" readOnly value={v.seatEnrollmentJson} style={{ minHeight: '110px', fontFamily: 'monospace' }} />
                    <p>បើកូនសោឧបករណ៍បាត់ ឬខូច សូមឱ្យអ្នកលក់ដោះកៅអីចាស់ ហើយចុះឈ្មោះឡើងវិញ។ កុំលុប Storage ដើម្បីដោះស្រាយ។</p>
                </div>}
                </section>
                {v.backendKind !== 'supabase' && <details open={!!v.invitationCode || !!v.invitationMessage || v.invitationBusy} aria-label="ការអញ្ជើញឧបករណ៍">
                    <summary>ជម្រើសបន្ថែម · មានលេខកូដអញ្ជើញពីអ្នកលក់</summary>
                    <p>ប្រើតែពេលអ្នកលក់បានបើកសេវាអញ្ជើញ។ បើមិនទាន់បើក សូមដាក់ Key នៅខាងលើ។</p>
                    <label htmlFor="licenseInvitationCode">លេខកូដអញ្ជើញពីអ្នកលក់</label>
                    <input id="licenseInvitationCode" value={v.invitationCode} onChange={onAct('editLicenseInvitation', { self: true })} autoComplete="off" autoCapitalize="characters" spellCheck={false} />
                    <p>បើកក្នុង PWA ដែលបានដំឡើង ឬបិទភ្ជាប់លេខកូដនៅក្នុង APK។ កុំផ្ញើ Activation Key ឬទិន្នន័យ JSON។</p>
                    <div className="modal-btns">
                        <button className="btn-confirm" disabled={v.invitationBusy || v.activationBusy || v.seatEnrollmentBusy} onClick={onAct('submitLicenseInvitation')}>{v.invitationBusy ? 'កំពុងពិនិត្យ...' : 'ស្នើសុំ / ពិនិត្យម្ដងទៀត'}</button>
                        <button className="btn-cancel" onClick={onAct('cancelLicenseInvitation')}>បោះបង់ការរង់ចាំ</button>
                    </div>
                    <p role="status">{v.invitationMessage}</p>
                    {v.invitationVerificationCode && <p>លេខផ្ទៀងផ្ទាត់ជាមួយអ្នកលក់៖ <strong>{v.invitationVerificationCode}</strong></p>}
                </details>}
                <div className="modal-btns">
                    <button className="btn-cancel" id="activationLogoutBtn" onClick={onAct("promptLogout")}>ចាកចេញ</button>
                </div>
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
