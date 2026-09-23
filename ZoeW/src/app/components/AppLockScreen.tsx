import { securityState } from '../../core/state';
import { viewState } from '../../core/view-state';
import { onAct } from '../actions';
import { useStoreValue } from '../hooks/useStore';
import { refTo } from '../refs';
import { BiometricLabel } from './shell/BiometricLabel';

/** អេក្រង់ចាក់សោលើឧបករណ៍ — បើក/បិទ · សារ · ប៊ូតុង គូរពី `viewState` */
export function AppLockScreen() {
    const open = useStoreValue(viewState, (s) => s.appLockOpen);
    const message = useStoreValue(viewState, (s) => s.appLockMessage);
    const biometricVisible = useStoreValue(viewState, (s) => s.appLockBiometricVisible);
    const busy = useStoreValue(securityState, (s) => s.appLockBusy);
    return (
        <div className={open ? 'app-lock is-open' : 'app-lock'} id="appLockScreen" aria-hidden={open ? 'false' : 'true'}>
            <div className="app-lock-card">
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
