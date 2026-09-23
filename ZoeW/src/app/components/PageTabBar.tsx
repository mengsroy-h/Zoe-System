import { onAct } from '../actions';

/** របា Tab ខាងក្រោម */
export function PageTabBar() {
    return (
        <nav className="page-tabbar" id="pageTabBar">
            <button
                type="button"
                className="page-tab active"
                id="pageTabData"
                onClick={onAct("switchAppPage", { args: ["data"] })}
            >
                <span className="tab-ico">📋</span>
                <span>ទិន្នន័យ</span>
            </button>
            <button
                type="button"
                className="page-tab"
                id="pageTabEntry"
                onClick={onAct("switchAppPage", { args: ["entry"] })}
            >
                <span className="tab-ico">📷</span>
                <span>ស្កេន</span>
            </button>
        </nav>
    );
}
