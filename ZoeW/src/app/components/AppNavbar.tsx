import { onAct } from '../actions';

/** របាខាងលើ — ⛔ មិនលាក់តាមទិសរមូរ */
export function AppNavbar() {
    return (
        <header className="app-navbar">
            <button
                type="button"
                className="nav-menu-btn"
                id="navMenuBtn"
                title="ម៉ឺនុយ"
                aria-label="ម៉ឺនុយ"
                onClick={onAct("openSideDrawer")}
            >
                ☰
            </button>
            <div className="app-brand">
                <div className="brand-logo">Zoe</div>
                <div className="brand-info">
                    <h1>ប្រព័ន្ធគ្រប់គ្រងអីវ៉ាន់</h1>
                    <span>
                        <div className="status-dot offline" id="statusDot"></div>
                        {' '}
                        <span id="firebaseStatusText">ក្រៅបណ្ដាញ</span>
                    </span>
                </div>
            </div>
            <div className="nav-right-actions">
                <div className="credit-tag">Powered By ZoeW</div>
            </div>
        </header>
    );
}
