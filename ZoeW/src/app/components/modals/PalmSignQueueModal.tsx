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
    const retainedView = v.recoveryRows.length > 0 && (retained || !v.rows.length);
    const rows = retainedView ? v.recoveryRows : v.rows;
    return <div className="modal-content palm-sign-content">
        <h3>ការងារ Sign</h3>
        {!locked ? <>
            <div className="sign-queue-tabs" role="group" aria-label="បញ្ជីការងារ">
                {v.rows.length > 0 ? <button type="button" aria-pressed={!retainedView} onClick={() => setRetained(false)}>{'រង់ចាំ ' + v.rows.length}</button> : null}
                {v.recoveryRows.length > 0 ? <button type="button" aria-pressed={retainedView} onClick={() => setRetained(true)}>{'សង្គ្រោះ ' + v.recoveryRows.length}</button> : null}
            </div>
            {v.message ? <p role="alert">{v.message}</p> : null}
            {retainedView ? <p className="sign-queue-hint">រូបនៅឧបករណ៍នេះ · មិនផ្ញើស្វ័យប្រវត្តិ</p> : null}
            {!rows.length ? <p className="sign-queue-empty" role="status">{retainedView ? 'គ្មានការងារត្រូវពិនិត្យ។' : 'គ្មានការងារ Sign រង់ចាំ។'}</p> : null}
            {rows.map(row => <SignQueueItem key={row.id} row={row} />)}
            {retainedView ? <p className="sign-queue-hint">Sign ដែល ZTO បញ្ជាក់រួចលុបអចិន្ត្រៃយ៍ក្រោយ 24 ម៉ោង។ ការងារមិនទាន់បញ្ជាក់រក្សាទុករហូតដល់អ្នកបន្ត ឬបញ្ជាក់លុប។ ការលុបមិនអាចស្តារបាន។</p> : null}
        </> : null}
        <div className="modal-btns sign-queue-close"><button type="button" className="btn-cancel" onClick={() => closeModal('palmSignQueueModal')}>បិទ</button></div>
    </div>;
}

function queueStatus(row: SignQueueView) {
    if (row.busy) return 'កំពុងផ្ទៀងការងារ…';
    const previous = row.statusUnavailable ? 'លើកមុន៖ ' : '';
    if (row.signed) return previous + (row.photoVerified ? 'Sign រួច · រូបបានផ្ទៀង' : 'Sign រួច · រូបមិនទាន់ផ្ទៀង');
    if (row.signed === false) return previous + 'ZTO មិនទាន់ Sign';
    if (row.statusUnavailable) return 'ពិនិត្យស្ថានភាព ZTO មិនបាន';
    return row.recovery || row.phase === 'action' ? 'មិនទាន់ដឹងស្ថានភាព Sign' : 'ការងារកំពុងរង់ចាំ';
}

function SignQueueItem({ row }: { row: SignQueueView }) {
    return <section className={row.warning ? 'palm-sign-confirmation' : 'palm-sign-code'}>
        <h4>{row.code}</h4>
        <p className={'sign-queue-status' + (row.signed ? ' is-signed' : '')} role="status">{queueStatus(row)}</p>
        {!row.busy && row.statusUnavailable && row.signed !== undefined ? <p className="sign-queue-hint">ពិនិត្យ ZTO ថ្មីមិនបាន</p> : null}
        <p role={row.warning ? 'alert' : undefined}>{row.message}</p>
        {row.cleanupAt ? <p className="sign-queue-hint">{'លុបអចិន្ត្រៃយ៍៖ ' + new Date(row.cleanupAt).toLocaleString('km-KH')}</p> : null}
        <div className="sign-queue-actions">
            <button type="button" className={row.warning ? 'sign-queue-secondary' : 'btn-confirm'} onClick={() => void exportQueuedSignPhoto(row.id, row.code)}>💾 រក្សាទុករូបដើម</button>
            {row.recovery ? <button type="button" className="sign-queue-secondary" disabled={row.busy} onClick={() => void actOnQueuedSign(row.id, 'recover')}>ពិនិត្យ (មិនផ្ញើ Sign)</button>
                : row.phase === 'action' && !row.verificationRequired ? row.warning ? <>
                    <button type="button" className="btn-confirm" disabled={row.busy} onClick={() => void actOnQueuedSign(row.id, 'approve')}>បញ្ជាក់ និងបន្ត</button>
                    <button type="button" className="sign-queue-secondary" disabled={row.busy} onClick={() => void actOnQueuedSign(row.id, 'cancel')}>បោះបង់ការងារមិនទាន់ផ្ញើ និងលុបរូបដើម</button>
                </> : <button type="button" className="sign-queue-secondary" disabled={row.busy} onClick={() => void actOnQueuedSign(row.id, 'retry')}>ពិនិត្យ (មិនផ្ញើ Sign)</button> : null}
        </div>
        <div className="sign-queue-actions">
            {row.recoveryContinuation || !row.recovery && row.continuationAllowed && !row.warning ? <button type="button" className="btn-confirm" disabled={row.busy} onClick={() => void actOnQueuedSign(row.id, row.recovery ? 'resume' : 'continue')}>បន្ត Sign តាមសំណើដើម</button> : null}
            <button type="button" className="sign-queue-secondary" disabled={row.busy} onClick={() => void actOnQueuedSign(row.id, 'delete')}>លុបអចិន្ត្រៃយ៍</button>
        </div>
        <details className="sign-queue-details">
            <summary>ព័ត៌មានលម្អិត</summary>
            {row.signMan ? <p>{'អ្នកទទួល៖ ' + row.signMan}</p> : null}
            <p>ការលុបការងារក្នុងឧបករណ៍មិនបោះបង់សំណើដែលបានទៅ ZTO និងមិនលុបកំណត់ត្រាលុយទេ។ Server ត្រូវផ្ទៀងសំណើចាស់មុនអនុញ្ញាត Sign ថ្មី។</p>
        </details>
    </section>;
}
