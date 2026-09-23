import { Modal } from './Modal';
import { viewState } from '../../../core/view-state';
import { onAct } from '../../actions';
import { useStoreFields } from '../../hooks/useStore';
import { refTo } from '../../refs';

export function LoginModal() {
    const v = useStoreFields(viewState, ['appVersionLabel', 'loginBusy']);
    return (
        <Modal id="loginModal" style={{ display: "none" }} noDismiss>
            <div className="modal-content">
                <h3>🔐 ចូលប្រើប្រាស់ប្រព័ន្ធ</h3>
                <p>សូមបញ្ចូល អ៊ីមែល/User ID និង ពាក្យសម្ងាត់</p>
                <form onSubmit={onAct("submitLoginForm", { evt: true })}>
                    <input
                        type="email"
                        id="loginEmailInput"
                        ref={refTo('loginEmailInput')}
                        placeholder="អ៊ីមែល ឬ User ID"
                        required
                        autoComplete="username"
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
                    <div className="modal-btns">
                        <button type="submit" className="btn-confirm" id="loginBtn" disabled={v.loginBusy}>{v.loginBusy ? 'កំពុងចូល...' : 'ចូលប្រព័ន្ធ'}</button>
                    </div>
                </form>
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
