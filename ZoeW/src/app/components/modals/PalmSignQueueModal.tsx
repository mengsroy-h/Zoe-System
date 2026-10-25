import { useState } from 'react';
import { exportQueuedSignPhoto } from '../../../features/queued-sign-photo';
import { palmSignOutboxState, actOnQueuedSign, refreshPalmSignQueue, type SignQueueView } from '../../../features/palm-sign-outbox';
import { securityState, uiState } from '../../../core/state';
import { closeModal, openModalHelper } from '../../../ui/modal';
import { useStoreFields, useStoreValue } from '../../hooks/useStore';
import { Modal } from './Modal';

export function PalmSignQueueButton() {
    const v = useStoreFields(palmSignOutboxState, ['rows', 'recoveryRows', 'message']);
    const locked = useStoreValue(securityState, (s) => s.appIsLocked || s.appLockVeiled);
    const attention = v.rows.length + v.recoveryRows.filter(row => !row.dismissed).length;
    if (locked || !v.rows.length && !v.recoveryRows.length && !v.message) return null;
    return <button type="button" className="nav-bell-btn" aria-label={'បញ្ជី Sign រង់ចាំ ' + v.rows.length + ' · រក្សាទុក ' + v.recoveryRows.length}
        onClick={() => { openModalHelper('palmSignQueueModal'); void refreshPalmSignQueue(); }}>
        <span aria-hidden="true">{v.rows.length ? '✍️' : '🗂️'}</span>{attention || v.message ? <span className="nav-bell-badge">{attention || '!'}</span> : null}
    </button>;
}

export function PalmSignQueueModal() {
    const display = useStoreValue(uiState, s => s.modalDisplay.palmSignQueueModal);
    return <Modal id="palmSignQueueModal"><SignQueueContents key={display || 'hidden'} /></Modal>;
}

function SignQueueContents() {
    const v = useStoreFields(palmSignOutboxState, ['rows', 'recoveryRows', 'message']);
    const locked = useStoreValue(securityState, (s) => s.appIsLocked || s.appLockVeiled);
    const [retained, setRetained] = useState(false);
    const [showDismissed, setShowDismissed] = useState(false);
    const dismissed = v.recoveryRows.filter(row => row.dismissed).length;
    const rows = retained ? v.recoveryRows.filter(row => showDismissed || !row.dismissed) : v.rows;
    return <div className="modal-content palm-sign-content">
        <h3>ការងារ Sign</h3>
        {!locked ? <>
            <div className="sign-queue-tabs" role="group" aria-label="បញ្ជីការងារ">
                <button type="button" aria-pressed={!retained} onClick={() => setRetained(false)}>{'រង់ចាំ ' + v.rows.length}</button>
                <button type="button" aria-pressed={retained} onClick={() => setRetained(true)}>{'រក្សាទុក ' + v.recoveryRows.length}</button>
            </div>
            {v.message ? <p role="alert">{v.message}</p> : null}
            {retained ? <p className="sign-queue-hint">រូបនៅឧបករណ៍នេះ · មិនផ្ញើស្វ័យប្រវត្តិ</p> : null}
            {!rows.length ? <p className="sign-queue-empty" role="status">{retained ? 'គ្មានការងារត្រូវពិនិត្យ។' : 'គ្មានការងារ Sign រង់ចាំ។'}</p> : null}
            {rows.map(row => <SignQueueItem key={row.id} row={row} />)}
            {retained && dismissed > 0 ? <button type="button" className="sign-queue-secondary sign-queue-show" aria-pressed={showDismissed} onClick={() => setShowDismissed(!showDismissed)}>{showDismissed ? 'លាក់ការងារដែលដកពីបញ្ជី' : 'បង្ហាញរូបដែលដកពីបញ្ជី (' + dismissed + ')'}</button> : null}
            {retained ? <details className="sign-queue-help"><summary>អំពីរូបដែលរក្សាទុក</summary><p>ពេល ZTO បញ្ជាក់ Sign រួច ការងារបាត់ពីបញ្ជីត្រូវពិនិត្យ។ ការដកដោយខ្លួនឯងមិនកត់ថា Sign រួចទេ; រូប និងប្រវត្តិនៅរក្សាទុក ហើយនៅរាប់ក្នុងពិដាន ៤០។ កុំលុបទិន្នន័យ App ឬប្ដូរ PIN។</p><p>លើ Android ការរក្សាទុករូបបើកផ្ទាំងចែករំលែកឱ្យអ្នកជ្រើសទីតាំង។ ច្បាប់ចម្លងក្នុង cache នៅរហូតដល់ប្រព័ន្ធសម្អាតវា។</p></details> : null}
        </> : null}
        <div className="modal-btns sign-queue-close"><button type="button" className="btn-cancel" onClick={() => closeModal('palmSignQueueModal')}>បិទ</button></div>
    </div>;
}

function queueStatus(row: SignQueueView) {
    if (row.busy) return 'កំពុងផ្ទៀងការងារ…';
    if (row.signed) return row.photoVerified ? 'Sign រួច · រូបបានផ្ទៀង' : 'Sign រួច · រូបមិនទាន់ផ្ទៀង';
    if (row.signed === false) return 'ZTO មិនទាន់ Sign';
    return row.recovery || row.phase === 'action' ? 'មិនទាន់ដឹងស្ថានភាព Sign' : 'ការងារកំពុងរង់ចាំ';
}

function SignQueueItem({ row }: { row: SignQueueView }) {
    const [confirmDismiss, setConfirmDismiss] = useState(false);
    return <section className={row.warning ? 'palm-sign-confirmation' : 'palm-sign-code'}>
        <h4>{row.code}</h4>
        <p className={'sign-queue-status' + (row.signed ? ' is-signed' : '')} role="status">{queueStatus(row)}</p>
        {row.warning ? <p role="alert">{row.message}</p> : null}
        <div className="sign-queue-actions">
            <button type="button" className={row.warning ? 'sign-queue-secondary' : 'btn-confirm'} onClick={() => void exportQueuedSignPhoto(row.id, row.code)}>💾 រក្សាទុករូបដើម</button>
            {row.recovery ? <button type="button" className="sign-queue-secondary" disabled={row.busy} onClick={() => void actOnQueuedSign(row.id, 'recover')}>ពិនិត្យ (មិនផ្ញើ Sign)</button>
                : row.phase === 'action' && !row.verificationRequired ? row.warning ? <>
                    <button type="button" className="btn-confirm" disabled={row.busy} onClick={() => void actOnQueuedSign(row.id, 'approve')}>បញ្ជាក់ និងបន្ត</button>
                    <button type="button" className="sign-queue-secondary" disabled={row.busy} onClick={() => void actOnQueuedSign(row.id, 'cancel')}>បោះបង់ការងារមិនទាន់ផ្ញើ និងលុបរូបដើម</button>
                </> : <button type="button" className="sign-queue-secondary" disabled={row.busy} onClick={() => void actOnQueuedSign(row.id, 'retry')}>ពិនិត្យ (មិនផ្ញើ Sign)</button> : null}
        </div>
        <details className="sign-queue-details">
            <summary>ព័ត៌មានលម្អិត</summary>
            {row.signMan ? <p>{'អ្នកទទួល៖ ' + row.signMan}</p> : null}
            {!row.warning ? <p>{row.message}</p> : null}
            <div className="sign-queue-actions">
                {row.recoveryContinuation || !row.recovery && row.continuationAllowed && !row.warning ? <><p>ការបន្តអាចផ្ញើរូប និង Sign តាមសំណើដើម ក្រោយ Server ផ្ទៀងសិទ្ធិម្ដងទៀត។</p><button type="button" className="sign-queue-secondary" disabled={row.busy} onClick={() => void actOnQueuedSign(row.id, row.recovery ? 'resume' : 'continue')}>បន្តការផ្ញើដើម</button></> : null}
                {row.recovery ? row.dismissed ? <button type="button" className="sign-queue-secondary" disabled={row.busy} onClick={() => void actOnQueuedSign(row.id, 'show')}>ដាក់ក្នុងបញ្ជីពិនិត្យវិញ</button>
                    : confirmDismiss ? <><p>ដកពីបញ្ជីត្រូវពិនិត្យ? រូប និងការងារនៅរក្សាទុក អាចបង្ហាញវិញបាន។ មិនកត់ថា Sign រួច និងមិនលុបរូប។</p><button type="button" className="sign-queue-secondary" disabled={row.busy} onClick={() => void actOnQueuedSign(row.id, 'dismiss')}>បញ្ជាក់ដកពីបញ្ជី</button><button type="button" className="sign-queue-secondary" onClick={() => setConfirmDismiss(false)}>ទុកក្នុងបញ្ជី</button></>
                        : <button type="button" className="sign-queue-secondary" disabled={row.busy} onClick={() => setConfirmDismiss(true)}>ដកពីបញ្ជីត្រូវពិនិត្យ</button>
                    : <><p>ផ្អាកការរត់ក្នុងឧបករណ៍ ហើយរក្សារូប និងសំណើដើមក្នុងផ្នែក «រក្សាទុក»។</p><button type="button" className="sign-queue-secondary" disabled={row.busy} onClick={() => void actOnQueuedSign(row.id, 'archive')}>ផ្អាក ហើយរក្សារូប</button></>}
            </div>
        </details>
    </section>;
}
