import { uiState } from '../../core/state';
import { onAct } from '../actions';
import { useStoreValue } from '../hooks/useStore';
import { refTo } from '../refs';

/** របា Tab ខាងក្រោម — `active` តាម `uiState.currentAppPage` */
export function PageTabBar() {
    const page = useStoreValue(uiState, (s) => s.currentAppPage);
    return (
        <nav className="page-tabbar" id="pageTabBar" ref={refTo('pageTabBar')}>
            <button
                type="button"
                className={page === 'data' ? 'page-tab active' : 'page-tab'}
                id="pageTabData"
                onClick={onAct("switchAppPage", { args: ["data"] })}
            >
                <span className="tab-ico">📋</span>
                <span>ទិន្នន័យ</span>
            </button>
            <button
                type="button"
                className={page === 'entry' ? 'page-tab active' : 'page-tab'}
                id="pageTabEntry"
                onClick={onAct("switchAppPage", { args: ["entry"] })}
            >
                <span className="tab-ico">📷</span>
                <span>ស្កេន</span>
            </button>
        </nav>
    );
}
