import { uiState } from '../../core/state';
import { viewState } from '../../core/view-state';
import { notifyBadgeCount } from '../../features/notifications';
import { onAct } from '../actions';
import { useStoreFields } from '../hooks/useStore';
import { refTo } from '../refs';
import { AppIconMark } from './shell/AppIconMark';

function statusClasses(status: 'online' | 'connecting' | 'offline' | null) {
    if (status === null) return { dot: 'status-dot offline', text: undefined };
    if (status === 'online') return { dot: 'status-dot', text: 'is-online' };
    if (status === 'connecting') return { dot: 'status-dot offline connecting', text: 'is-connecting' };
    return { dot: 'status-dot offline', text: 'is-offline' };
}

export function AppNavbar() {
    const v = useStoreFields(viewState, ['connectionStatus', 'connectionText']);
    const cls = statusClasses(v.connectionStatus);
    const n = useStoreFields(uiState, ['notifyView', 'notifyFeed', 'notifySeenIds', 'updateReady']);
    const badge = notifyBadgeCount(n.notifyView, n.notifyFeed, n.notifySeenIds) + (n.updateReady ? 1 : 0);
    const bellLabel = badge ? 'ជូនដំណឹង (' + badge + ' ថ្មី)' : 'ជូនដំណឹង';
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
                <div className="brand-logo"><AppIconMark idPrefix="navLogo" /></div>
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
                <button
                    type="button"
                    className={badge ? 'nav-bell-btn has-badge' : 'nav-bell-btn'}
                    id="navNotifyBtn"
                    title={bellLabel}
                    aria-label={bellLabel}
                    onClick={onAct("openNotifyDrawer")}
                >
                    <span aria-hidden="true">🔔</span>
                    {badge ? <span className="nav-bell-badge" id="navNotifyBadge">{badge > 99 ? '99+' : badge}</span> : null}
                </button>
            </div>
        </header>
    );
}
