import { viewState } from '../../core/view-state';
import { onAct } from '../actions';
import { useStoreFields } from '../hooks/useStore';
import { refTo } from '../refs';

function statusClasses(status: 'online' | 'connecting' | 'offline' | null) {
    if (status === null) return { dot: 'status-dot offline', text: undefined };
    if (status === 'online') return { dot: 'status-dot', text: 'is-online' };
    if (status === 'connecting') return { dot: 'status-dot offline connecting', text: 'is-connecting' };
    return { dot: 'status-dot offline', text: 'is-offline' };
}

export function AppNavbar() {
    const v = useStoreFields(viewState, ['connectionStatus', 'connectionText']);
    const cls = statusClasses(v.connectionStatus);
    return (
        <header className="app-navbar" ref={refTo('navbar')}>
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
                        <div className={cls.dot} id="statusDot"></div>
                        {' '}
                        <span id="firebaseStatusText" className={cls.text}>{v.connectionText}</span>
                    </span>
                </div>
            </div>
            <div className="nav-right-actions">
                <div className="credit-tag">Powered By ZoeW</div>
            </div>
        </header>
    );
}
