import { firebaseState, securityState } from '../../core/state';
import { sessionVerificationRequired } from '../../core/session-verification';
import { viewState } from '../../core/view-state';
import { onAct } from '../actions';
import { useStoreValue } from '../hooks/useStore';
import { refTo } from '../refs';
import { BiometricLabel } from './shell/BiometricLabel';

export function AppLockScreen() {
    const pinOpen = useStoreValue(viewState, (s) => s.appLockOpen);
    const verifying = useStoreValue(firebaseState, sessionVerificationRequired);
    const expired = useStoreValue(firebaseState, (s) => s.sessionExpiryCheck === 'expired');
    const open = pinOpen || verifying;
    const message = useStoreValue(viewState, (s) => s.appLockMessage);
    const biometricVisible = useStoreValue(viewState, (s) => s.appLockBiometricVisible);
    const busy = useStoreValue(securityState, (s) => s.appLockBusy);
    return (
        <div className={open ? 'app-lock is-open' : 'app-lock'} id="appLockScreen" aria-hidden={open ? 'false' : 'true'}>
            {verifying && <div className="app-lock-card" data-session-verification>
                <div className="app-lock-icon">🔒</div>
                <h2 className="app-lock-title">{expired ? 'វគ្គបានផុតកំណត់' : 'ត្រូវផ្ទៀងផ្ទាត់វគ្គ'}</h2>
                <p className="app-lock-note">{expired ? 'កំពុងចាកចេញពីប្រព័ន្ធ។ សូមចូលប្រព័ន្ធម្ដងទៀត។' : 'សូមភ្ជាប់អ៊ីនធឺណិត ដើម្បីផ្ទៀងផ្ទាត់ម៉ោង Server និងសុពលភាពវគ្គ។ ទិន្នន័យ និងការងាររង់ចាំនៅរក្សាទុក។'}</p>
                <button type="button" className="app-lock-submit" disabled={expired} onClick={onAct('retrySessionVerification')}>ផ្ទៀងផ្ទាត់ម្ដងទៀត</button>
                <button type="button" className="app-lock-forgot" onClick={onAct('logoutApp')}>ចាកចេញពីប្រព័ន្ធ</button>
            </div>}
            <div className={verifying ? 'app-lock-card hidden' : 'app-lock-card'}>
                <div className="app-lock-icon">🔒</div>
                <h2 className="app-lock-title">ZoeW ត្រូវបានចាក់សោ</h2>
                <p className="app-lock-note">សូមវាយលេខកូដ PIN ឬស្កេនក្រយៅដៃ/មុខ ដើម្បីបន្តប្រើប្រាស់។ ការចងចាំការចូលប្រព័ន្ធ ៤ ម៉ោង នៅដដែល។</p>
                <form onSubmit={onAct("submitAppLockForm", { evt: true })}>
                    <input
                        type="password"
                        id="appLockPinInput"
                        ref={refTo('appLockPinInput')}
                        inputMode="numeric"
                        autoComplete="off"
                        placeholder="លេខកូដ PIN"
                        aria-label="លេខកូដ PIN"
                    />
                    <button type="submit" className="app-lock-submit" id="appLockSubmitBtn" disabled={busy}>ដោះសោ</button>
                </form>
                <button
                    type="button"
                    className={biometricVisible ? 'btn-biometric app-lock-biometric' : 'btn-biometric app-lock-biometric hidden'}
                    id="appLockBiometricBtn"
                    disabled={busy}
                    onClick={onAct("runAppLockBiometric")}
                >
                    <BiometricLabel busy={busy} />
                </button>
                <div className="app-lock-msg" id="appLockMsg">{message}</div>
                <button type="button" className="app-lock-forgot" onClick={onAct("forgetAppLockPin")}>ភ្លេច PIN? — ចាកចេញ រួចចូលប្រព័ន្ធសាជាថ្មី</button>
            </div>
        </div>
    );
}
