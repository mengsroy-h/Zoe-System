import { exportQueuedSignPhoto } from '../../../features/queued-sign-photo';
import { palmSignOutboxState, actOnQueuedSign, refreshPalmSignQueue, type SignQueueView } from '../../../features/palm-sign-outbox';
import { securityState } from '../../../core/state';
import { closeModal, openModalHelper } from '../../../ui/modal';
import { useStoreFields, useStoreValue } from '../../hooks/useStore';
import { Modal } from './Modal';

export function PalmSignQueueButton() {
    const v = useStoreFields(palmSignOutboxState, ['rows', 'recoveryRows', 'message']);
    const locked = useStoreValue(securityState, (s) => s.appIsLocked || s.appLockVeiled);
    if (locked || !v.rows.length && !v.recoveryRows.length && !v.message) return null;
    return <button type="button" className="nav-bell-btn" aria-label={'បញ្ជី Sign រង់ចាំ ' + v.rows.length + ' · ត្រូវសង្គ្រោះ ' + v.recoveryRows.length}
        onClick={() => { openModalHelper('palmSignQueueModal'); void refreshPalmSignQueue(); }}>
        <span aria-hidden="true">{v.rows.length ? '✍️' : '🗂️'}</span><span className="nav-bell-badge">{v.rows.length + v.recoveryRows.length || '!'}</span>
    </button>;
}

export function PalmSignQueueModal() {
    const v = useStoreFields(palmSignOutboxState, ['rows', 'recoveryRows', 'message']);
    const locked = useStoreValue(securityState, (s) => s.appIsLocked || s.appLockVeiled);
    return <Modal id="palmSignQueueModal">
        <div className="modal-content palm-sign-content">
            <h3>✍️ បញ្ជី Sign រង់ចាំ</h3>
            <p className="palm-sign-hint">ការងារក្នុងបញ្ជីរង់ចាំអាចបន្តពេល App បើក និងមានបណ្ដាញ។ អ្នកអាចផ្លាស់ការងារដែលផ្អាកទៅបញ្ជីត្រូវសង្គ្រោះ ដោយរក្សារូប និងសំណើដើម។</p>
            <p className="palm-sign-hint">ការរក្សាទុករូបដើម មិនផ្ញើទៅ ZTO មិន Sign និងមិនលុបការងារ។ លើ Android អ្នកជ្រើសទីតាំងរក្សាទុក ឬកម្មវិធីដោយខ្លួនឯងក្នុងផ្ទាំងចែករំលែក។ ច្បាប់ចម្លងរូបដែលបានប្រគល់ទៅផ្ទាំងនេះនៅក្នុង cache របស់ App រហូតដល់ប្រព័ន្ធសម្អាតវា។</p>
            {!locked && v.message ? <p role="alert">{v.message}</p> : null}
            {!locked && !v.rows.length && !v.message ? <p role="status">គ្មានការងារ Sign រង់ចាំ។</p> : null}
            {!locked ? <>
                <h4>{'កំពុងរង់ចាំ ' + v.rows.length}</h4>
                {v.rows.map(row => <SignQueueItem key={row.id} row={row} />)}
                <h4>{'🗂️ ការងារត្រូវសង្គ្រោះ ' + v.recoveryRows.length}</h4>
                <p className="palm-sign-hint">ការងារនៅទីនេះមិនរត់ស្វ័យប្រវត្តិ និងមិនត្រូវបានកត់ថាបញ្ចប់ទេ។ រូប និងសំណើដើមនៅក្នុងឧបករណ៍នេះ; កុំលុបទិន្នន័យ App ឬប្តូរ PIN។</p>
                {v.recoveryRows.map(row => <SignQueueItem key={row.id} row={row} />)}
            </> : null}
            <div className="modal-btns"><button type="button" className="btn-cancel" onClick={() => closeModal('palmSignQueueModal')}>បិទ</button></div>
        </div>
    </Modal>;
}

function SignQueueItem({ row }: { row: SignQueueView }) {
    return <section className={row.warning ? 'palm-sign-confirmation' : 'palm-sign-code'}>
                <div className="palm-sign-code-body">
                    <h4>{row.code}</h4>
                    {row.recovery ? <p>{'អ្នកទទួល៖ ' + row.signMan + ' · រូបការងារនៅឧបករណ៍នេះ'}</p> : null}
                    <button type="button" className="palm-sign-soft" onClick={() => void exportQueuedSignPhoto(row.id, row.code)}>💾 រក្សាទុករូបដើម</button>
                    <p role={row.warning ? 'alert' : 'status'}>{row.message}</p>
                    {!row.recovery && row.phase === 'action' && !row.verificationRequired ? <div className="modal-btns">
                        {row.continuationAllowed && !row.warning ? <button type="button" className="btn-confirm" disabled={row.busy} onClick={() => void actOnQueuedSign(row.id, 'continue')}>បន្ត Sign ក្រោយដោះស្រាយបញ្ហា</button> : null}
                        {row.warning ? <>
                            <button type="button" className="btn-cancel" disabled={row.busy} onClick={() => void actOnQueuedSign(row.id, 'cancel')}>បោះបង់ការងារមិនទាន់ផ្ញើ និងលុបរូបដើម</button>
                            <button type="button" className="btn-confirm" disabled={row.busy} onClick={() => void actOnQueuedSign(row.id, 'approve')}>បញ្ជាក់ និងបន្ត</button>
                        </> : <button type="button" className="palm-sign-soft" disabled={row.busy} onClick={() => void actOnQueuedSign(row.id, 'retry')}>{row.manualReviewReason === 'parent_in_trash' ? '🔄 ផ្ទៀង Sign និងរូបដើម (មិនផ្ញើ Sign)' : '🔄 ពិនិត្យស្ថានភាពឡើងវិញ' + (row.manualReviewReason === 'legacy_journal' ? ' (មិនផ្ញើ Sign)' : '')}</button>}
                    </div> : null}
                    {row.recovery ? <div className="modal-btns">
                        <button type="button" className="palm-sign-soft" disabled={row.busy} onClick={() => void actOnQueuedSign(row.id, 'recover')}>សង្គ្រោះការផ្ញើ៖ ពិនិត្យសិទ្ធិ (មិនផ្ញើ Sign)</button>
                        {row.recoveryContinuation ? <button type="button" className="btn-confirm" disabled={row.busy} onClick={() => void actOnQueuedSign(row.id, 'resume')}>បន្តការផ្ញើដើមដែលបានផ្ទៀងសិទ្ធិ</button> : null}
                    </div> : <button type="button" className="palm-sign-soft" disabled={row.busy} onClick={() => void actOnQueuedSign(row.id, 'archive')}>🗂️ ផ្លាស់ទៅការងារត្រូវសង្គ្រោះ · រក្សារូបដើម</button>}
                </div>
            </section>;
}
