import { onAct } from '../actions';

/** អេក្រង់ចាក់សោលើឧបករណ៍ */
export function AppLockScreen() {
    return (
        <div className="app-lock" id="appLockScreen" aria-hidden="true">
            <div className="app-lock-card">
                <div className="app-lock-icon">🔒</div>
                <h2 className="app-lock-title">ZoeW ត្រូវបានចាក់សោ</h2>
                <p className="app-lock-note">សូមវាយលេខកូដ PIN ឬស្កេនក្រយៅដៃ/មុខ ដើម្បីបន្តប្រើប្រាស់។ ការចងចាំការចូលប្រព័ន្ធ ៤ ម៉ោង នៅដដែល។</p>
                <form onSubmit={onAct("submitAppLockForm", { evt: true })}>
                    <input
                        type="password"
                        id="appLockPinInput"
                        inputMode="numeric"
                        autoComplete="off"
                        placeholder="លេខកូដ PIN"
                        aria-label="លេខកូដ PIN"
                    />
                    <button type="submit" className="app-lock-submit" id="appLockSubmitBtn">ដោះសោ</button>
                </form>
                <button
                    type="button"
                    className="btn-biometric app-lock-biometric hidden"
                    id="appLockBiometricBtn"
                    onClick={onAct("runAppLockBiometric")}
                >
                    <span className="bio-ico" aria-hidden="true">🫆</span>
                    <span className="bio-label">ស្កេនក្រយៅដៃ ឬមុខ</span>
                </button>
                <div className="app-lock-msg" id="appLockMsg"></div>
                <button type="button" className="app-lock-forgot" onClick={onAct("forgetAppLockPin")}>ភ្លេច PIN? — ចាកចេញ រួចចូលប្រព័ន្ធសាជាថ្មី</button>
            </div>
        </div>
    );
}
