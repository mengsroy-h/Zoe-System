import { Modal } from './Modal';
import { viewState } from '../../../core/view-state';
import { onAct } from '../../actions';
import { useStoreFields } from '../../hooks/useStore';
import { refTo } from '../../refs';

function AccountLinks({ busy }: { busy: boolean }) {
    return (
        <div className="login-alt-links">
            <button type="button" className="login-alt-btn" onClick={onAct("openRegisterForm")} disabled={busy}>📝 ចុះឈ្មោះដោយកូដអញ្ជើញ</button>
            <button type="button" className="login-alt-btn" onClick={onAct("openResetPasswordForm")} disabled={busy}>🔑 ភ្លេចពាក្យសម្ងាត់?</button>
        </div>
    );
}

function RegisterForm({ busy }: { busy: boolean }) {
    return (
        <>
            <h3>📝 ចុះឈ្មោះគណនីថ្មី</h3>
            <p>បញ្ចូលកូដអញ្ជើញដែលអ្នកលក់ផ្តល់ឲ្យ រួចបង្កើតឈ្មោះគណនី និងពាក្យសម្ងាត់។ កូដនេះចងគណនីនឹងហាង (សាខា) របស់អ្នកដោយស្វ័យប្រវត្តិ។</p>
            <form onSubmit={onAct("submitRegisterForm", { evt: true })}>
                <input
                    type="text"
                    id="registerInviteInput"
                    ref={refTo('registerInviteInput')}
                    placeholder="កូដអញ្ជើញ (XXXX-XXXX-XXXX-XXXX-XXXX)"
                    required
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                />
                <input
                    type="text"
                    id="registerUsernameInput"
                    ref={refTo('registerUsernameInput')}
                    placeholder="ឈ្មោះគណនី (a–z 0–9 . _ ៣–៣២ តួ)"
                    required
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                />
                <input
                    type="password"
                    id="registerPasswordInput"
                    ref={refTo('registerPasswordInput')}
                    placeholder="ពាក្យសម្ងាត់ (យ៉ាងតិច ៨ តួ)"
                    required
                    autoComplete="new-password"
                />
                <input
                    type="password"
                    id="registerPasswordConfirmInput"
                    ref={refTo('registerPasswordConfirmInput')}
                    placeholder="វាយពាក្យសម្ងាត់ម្តងទៀត"
                    required
                    autoComplete="new-password"
                />
                <div className="modal-btns">
                    <button type="button" className="btn-cancel" onClick={onAct("backToLoginForm")} disabled={busy}>ត្រឡប់</button>
                    <button type="submit" className="btn-confirm" id="registerBtn" disabled={busy}>{busy ? 'កំពុងចុះឈ្មោះ...' : 'ចុះឈ្មោះ'}</button>
                </div>
            </form>
        </>
    );
}

function ResetForm({ busy }: { busy: boolean }) {
    return (
        <>
            <h3>🔑 ប្តូរពាក្យសម្ងាត់</h3>
            <p>សុំ «កូដប្តូរពាក្យសម្ងាត់» ពីអ្នកលក់ រួចបញ្ចូលវាជាមួយពាក្យសម្ងាត់ថ្មី។</p>
            <form onSubmit={onAct("submitResetPasswordForm", { evt: true })}>
                <input
                    type="text"
                    id="resetUsernameInput"
                    ref={refTo('resetUsernameInput')}
                    placeholder="ឈ្មោះគណនី"
                    required
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                />
                <input
                    type="text"
                    id="resetCodeInput"
                    ref={refTo('resetCodeInput')}
                    placeholder="កូដប្តូរពាក្យសម្ងាត់"
                    required
                    autoComplete="one-time-code"
                    autoCapitalize="characters"
                    spellCheck={false}
                />
                <input
                    type="password"
                    id="resetPasswordInput"
                    ref={refTo('resetPasswordInput')}
                    placeholder="ពាក្យសម្ងាត់ថ្មី (យ៉ាងតិច ៨ តួ)"
                    required
                    autoComplete="new-password"
                />
                <input
                    type="password"
                    id="resetPasswordConfirmInput"
                    ref={refTo('resetPasswordConfirmInput')}
                    placeholder="វាយពាក្យសម្ងាត់ថ្មីម្តងទៀត"
                    required
                    autoComplete="new-password"
                />
                <div className="modal-btns">
                    <button type="button" className="btn-cancel" onClick={onAct("backToLoginForm")} disabled={busy}>ត្រឡប់</button>
                    <button type="submit" className="btn-confirm" id="resetPasswordBtn" disabled={busy}>{busy ? 'កំពុងប្តូរ...' : 'ប្តូរពាក្យសម្ងាត់'}</button>
                </div>
            </form>
        </>
    );
}

export function LoginModal() {
    const v = useStoreFields(viewState, ['appVersionLabel', 'loginBusy', 'backendKind', 'loginMode']);
    const supabase = v.backendKind === 'supabase';
    const mode = supabase ? v.loginMode : 'login';
    return (
        <Modal id="loginModal" style={{ display: "none" }} noDismiss>
            <div className="modal-content">
                {mode === 'register' ? <RegisterForm busy={v.loginBusy} /> : mode === 'reset' ? <ResetForm busy={v.loginBusy} /> : (
                    <>
                        <h3>🔐 ចូលប្រើប្រាស់ប្រព័ន្ធ</h3>
                        <p>{supabase ? 'សូមបញ្ចូល ឈ្មោះគណនី និង ពាក្យសម្ងាត់' : 'សូមបញ្ចូល អ៊ីមែល/User ID និង ពាក្យសម្ងាត់'}</p>
                        <form onSubmit={onAct("submitLoginForm", { evt: true })}>
                            <input
                                type={supabase ? "text" : "email"}
                                id="loginEmailInput"
                                ref={refTo('loginEmailInput')}
                                placeholder={supabase ? "ឈ្មោះគណនី" : "អ៊ីមែល ឬ User ID"}
                                required
                                autoComplete="username"
                                autoCapitalize={supabase ? "none" : undefined}
                                spellCheck={supabase ? false : undefined}
                            />
                            <input
                                type="password"
                                id="loginPasswordInput"
                                ref={refTo('loginPasswordInput')}
                                placeholder="ពាក្យសម្ងាត់"
                                required
                                autoComplete="current-password"
                            />
                            <label className="remember-container">
                                <input type="checkbox" id="rememberMeCheckbox" ref={refTo('rememberMeCheckbox')} defaultChecked />
                                <span>ចងចាំគណនី និងចូលប្រព័ន្ធស្វ័យប្រវត្តិរយៈពេល ៤ ម៉ោង</span>
                            </label>
                            <label className="remember-container remember-password">
                                <input
                                    type="checkbox"
                                    id="rememberPasswordCheckbox"
                                    ref={refTo('rememberPasswordCheckbox')}
                                    defaultChecked
                                    onChange={onAct("toggleRememberPassword", { self: true })}
                                />
                                <span>ចងចាំពាក្យសម្ងាត់លើឧបករណ៍នេះ (ដកធីក ➜ លុបពាក្យសម្ងាត់ដែលចងចាំ)</span>
                            </label>
                            <div className="modal-btns">
                                <button type="submit" className="btn-confirm" id="loginBtn" disabled={v.loginBusy}>{v.loginBusy ? 'កំពុងចូល...' : 'ចូលប្រព័ន្ធ'}</button>
                            </div>
                        </form>
                        {supabase ? <AccountLinks busy={v.loginBusy} /> : null}
                    </>
                )}
                <a
                    className="app-version-line"
                    data-app-version=""
                    href="./guide.html"
                    target="_self"
                    rel="noopener"
                    aria-label="បើកសៀវភៅណែនាំ ZoeW"
                >{v.appVersionLabel}</a>
            </div>
        </Modal>
    );
}
