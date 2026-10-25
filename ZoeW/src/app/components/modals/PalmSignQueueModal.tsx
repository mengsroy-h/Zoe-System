import { exportQueuedSignPhoto } from '../../../features/queued-sign-photo';
import { palmSignOutboxState, actOnQueuedSign, refreshPalmSignQueue } from '../../../features/palm-sign-outbox';
import { securityState } from '../../../core/state';
import { closeModal, openModalHelper } from '../../../ui/modal';
import { useStoreFields, useStoreValue } from '../../hooks/useStore';
import { Modal } from './Modal';

export function PalmSignQueueButton() {
    const v = useStoreFields(palmSignOutboxState, ['rows', 'message']);
    const locked = useStoreValue(securityState, (s) => s.appIsLocked || s.appLockVeiled);
    if (locked || !v.rows.length && !v.message) return null;
    return <button type="button" className="nav-bell-btn" aria-label={'បញ្ជី Sign រង់ចាំ ' + v.rows.length}
        onClick={() => { openModalHelper('palmSignQueueModal'); void refreshPalmSignQueue(); }}>
        <span aria-hidden="true">✍️</span><span className="nav-bell-badge">{v.rows.length || '!'}</span>
    </button>;
}

export function PalmSignQueueModal() {
    const v = useStoreFields(palmSignOutboxState, ['rows', 'message']);
    const locked = useStoreValue(securityState, (s) => s.appIsLocked || s.appLockVeiled);
    return <Modal id="palmSignQueueModal">
        <div className="modal-content palm-sign-content">
            <h3>✍️ បញ្ជី Sign រង់ចាំ</h3>
            <p className="palm-sign-hint">ZoeW ផ្ញើរូប និង Sign ពេល App បើក និងមានបណ្ដាញ។ បើបិទ App ការងារនៅរង់ចាំ ហើយបន្តពេលបើកវិញ។</p>
            <p className="palm-sign-hint">ការរក្សាទុករូបដើម មិនផ្ញើទៅ ZTO មិន Sign និងមិនលុបការងារ។ លើ Android អ្នកជ្រើសទីតាំងរក្សាទុក ឬកម្មវិធីដោយខ្លួនឯងក្នុងផ្ទាំងចែករំលែក។ ច្បាប់ចម្លងរូបដែលបានប្រគល់ទៅផ្ទាំងនេះនៅក្នុង cache របស់ App រហូតដល់ប្រព័ន្ធសម្អាតវា។</p>
            {!locked && v.message ? <p role="alert">{v.message}</p> : null}
            {!locked && !v.rows.length && !v.message ? <p role="status">គ្មានការងារ Sign រង់ចាំ។</p> : null}
            {!locked ? v.rows.map((row) => <section key={row.id} className={row.warning ? 'palm-sign-confirmation' : 'palm-sign-code'}>
                <div className="palm-sign-code-body">
                    <h4>{row.code}</h4>
                    <button type="button" className="palm-sign-soft" onClick={() => void exportQueuedSignPhoto(row.id, row.code)}>💾 រក្សាទុករូបដើម</button>
                    <p role={row.warning ? 'alert' : 'status'}>{row.message}</p>
                    {row.phase === 'action' && !row.verificationRequired ? <div className="modal-btns">
                        {row.warning ? <>
                            <button type="button" className="btn-cancel" disabled={row.busy} onClick={() => void actOnQueuedSign(row.id, 'cancel')}>បោះបង់</button>
                            <button type="button" className="btn-confirm" disabled={row.busy} onClick={() => void actOnQueuedSign(row.id, 'approve')}>បញ្ជាក់ និងបន្ត</button>
                        </> : <button type="button" className="palm-sign-soft" disabled={row.busy} onClick={() => void actOnQueuedSign(row.id, 'retry')}>🔄 ពិនិត្យ និងសាកម្ដងទៀត</button>}
                    </div> : null}
                </div>
            </section>) : null}
            <div className="modal-btns"><button type="button" className="btn-cancel" onClick={() => closeModal('palmSignQueueModal')}>បិទ</button></div>
        </div>
    </Modal>;
}
