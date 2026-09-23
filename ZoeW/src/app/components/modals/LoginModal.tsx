import { onAct } from '../../actions';

export function LoginModal() {
    return (
        <div id="loginModal" className="modal" style={{ display: "none" }} data-nodismiss="true">
            <div className="modal-content">
                <h3>🔐 ចូលប្រើប្រាស់ប្រព័ន្ធ</h3>
                <p>សូមបញ្ចូល អ៊ីមែល/User ID និង ពាក្យសម្ងាត់</p>
                <form onSubmit={onAct("submitLoginForm", { evt: true })}>
                    <input
                        type="email"
                        id="loginEmailInput"
                        placeholder="អ៊ីមែល ឬ User ID"
                        required
                        autoComplete="username"
                    />
                    <input
                        type="password"
                        id="loginPasswordInput"
                        placeholder="ពាក្យសម្ងាត់"
                        required
                        autoComplete="current-password"
                    />
                    <label className="remember-container">
                        <input type="checkbox" id="rememberMeCheckbox" checked />
                        <span>ចងចាំគណនី និងចូលប្រព័ន្ធស្វ័យប្រវត្តិរយៈពេល ៤ ម៉ោង</span>
                    </label>
                    <div className="modal-btns">
                        <button type="submit" className="btn-confirm" id="loginBtn">ចូលប្រព័ន្ធ</button>
                    </div>
                </form>
                <a
                    className="app-version-line"
                    data-app-version=""
                    href="./guide.html"
                    target="_self"
                    rel="noopener"
                    aria-label="បើកសៀវភៅណែនាំ ZoeW"
                ></a>
            </div>
        </div>
    );
}
