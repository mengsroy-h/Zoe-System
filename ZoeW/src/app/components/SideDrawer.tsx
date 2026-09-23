import { onAct } from '../actions';

/** របា Slide (ម៉ឺនុយ) */
export function SideDrawer() {
    return (
        <aside className="side-drawer" id="sideDrawer" aria-hidden="true">
            <div className="drawer-head">
                <div className="drawer-title">⚙️ ការកំណត់</div>
                <button
                    type="button"
                    className="drawer-close"
                    title="បិទ"
                    aria-label="បិទ"
                    onClick={onAct("closeSideDrawer")}
                >
                    ✖
                </button>
            </div>
            <div className="drawer-body">
                <section className="drawer-group" id="drawerGroupConnect">
                    <button
                        type="button"
                        className="drawer-group-head"
                        id="drawerGroupHeadConnect"
                        aria-expanded="false"
                        aria-controls="drawerGroupBodyConnect"
                        onClick={onAct("toggleDrawerGroup", { self: true })}
                    >
                        <span className="ico">🔗</span>
                        <span className="drawer-group-label">ការតភ្ជាប់ និងទិន្នន័យ</span>
                        <span className="drawer-group-arrow" aria-hidden="true">↓</span>
                    </button>
                    <div
                        className="drawer-group-body"
                        id="drawerGroupBodyConnect"
                        role="group"
                        aria-labelledby="drawerGroupHeadConnect"
                    >
                        <button type="button" className="drawer-item" onClick={onAct("drawerConfigFlow")}>
                            <span className="ico">⚙️</span>
                            <span>Config / Reconfig</span>
                        </button>
                        <button type="button" className="drawer-item" onClick={onAct("drawerLookupApiFlow")}>
                            <span className="ico">🔌</span>
                            <span>API ស្វែងរកអតិថិជន</span>
                        </button>
                        <button type="button" className="drawer-item" onClick={onAct("drawerCustomerTableFlow")}>
                            <span className="ico">📊</span>
                            <span>តារាងអតិថិជន</span>
                        </button>
                        <button type="button" className="drawer-item" onClick={onAct("drawerSheetImportFlow")}>
                            <span className="ico">📥</span>
                            <span>នាំចូល Excel ទៅ Sheet</span>
                        </button>
                    </div>
                </section>
                <section className="drawer-group" id="drawerGroupZto">
                    <button
                        type="button"
                        className="drawer-group-head"
                        id="drawerGroupHeadZto"
                        aria-expanded="false"
                        aria-controls="drawerGroupBodyZto"
                        onClick={onAct("toggleDrawerGroup", { self: true })}
                    >
                        <span className="ico">🚚</span>
                        <span className="drawer-group-label">ZTO</span>
                        <span className="drawer-group-arrow" aria-hidden="true">↓</span>
                    </button>
                    <div
                        className="drawer-group-body"
                        id="drawerGroupBodyZto"
                        role="group"
                        aria-labelledby="drawerGroupHeadZto"
                    >
                        <button
                            type="button"
                            className="drawer-item drawer-toggle hidden"
                            id="ztoAutoCloseBtn"
                            onClick={onAct("drawerZtoAutoCloseFlow")}
                        >
                            <span className="ico">🔄</span>
                            <span className="drawer-toggle-label">បិទតាម ZTO ស្វ័យប្រវត្តិ</span>
                            <span className="drawer-toggle-state" id="ztoAutoCloseState">បើក</span>
                        </button>
                        <button
                            type="button"
                            className="drawer-item drawer-toggle hidden"
                            id="ztoListSyncDrawerBtn"
                            onClick={onAct("drawerZtoListSyncFlow")}
                        >
                            <span className="ico">📥</span>
                            <span className="drawer-toggle-label">ទាញបញ្ជីកញ្ចប់ពី ZTO</span>
                            <span className="drawer-toggle-state" id="ztoListSyncState">បិទ</span>
                        </button>
                    </div>
                </section>
                <section className="drawer-group" id="drawerGroupLock">
                    <button
                        type="button"
                        className="drawer-group-head"
                        id="drawerGroupHeadLock"
                        aria-expanded="false"
                        aria-controls="drawerGroupBodyLock"
                        onClick={onAct("toggleDrawerGroup", { self: true })}
                    >
                        <span className="ico">🔒</span>
                        <span className="drawer-group-label">ចាក់សោ និងសុវត្ថិភាព</span>
                        <span className="drawer-group-arrow" aria-hidden="true">↓</span>
                    </button>
                    <div
                        className="drawer-group-body"
                        id="drawerGroupBodyLock"
                        role="group"
                        aria-labelledby="drawerGroupHeadLock"
                    >
                        <button
                            type="button"
                            className="drawer-item drawer-toggle"
                            id="appLockToggleBtn"
                            onClick={onAct("drawerAppLockFlow")}
                        >
                            <span className="ico">🔒</span>
                            <span className="drawer-toggle-label">ចាក់សោពេលបើក App</span>
                            <span className="drawer-toggle-state" id="appLockToggleState">បិទ</span>
                        </button>
                        <button
                            type="button"
                            className="drawer-item drawer-toggle"
                            id="biometricToggleBtn"
                            onClick={onAct("drawerBiometricFlow")}
                        >
                            <span className="ico">🔐</span>
                            <span className="drawer-toggle-label">ចូលដោយក្រយៅដៃ ឬមុខ</span>
                            <span className="drawer-toggle-state" id="biometricToggleState">បិទ</span>
                        </button>
                    </div>
                </section>
                <section className="drawer-group" id="drawerGroupTools">
                    <button
                        type="button"
                        className="drawer-group-head"
                        id="drawerGroupHeadTools"
                        aria-expanded="false"
                        aria-controls="drawerGroupBodyTools"
                        onClick={onAct("toggleDrawerGroup", { self: true })}
                    >
                        <span className="ico">🧰</span>
                        <span className="drawer-group-label">ឧបករណ៍</span>
                        <span className="drawer-group-arrow" aria-hidden="true">↓</span>
                    </button>
                    <div
                        className="drawer-group-body"
                        id="drawerGroupBodyTools"
                        role="group"
                        aria-labelledby="drawerGroupHeadTools"
                    >
                        <button type="button" className="drawer-item" onClick={onAct("drawerLockerSettingsFlow")}>
                            <span className="ico">🗄️</span>
                            <span>កំណត់ទូ Locker</span>
                        </button>
                        <button type="button" className="drawer-item" onClick={onAct("openHealthCheck")}>
                            <span className="ico">🩺</span>
                            <span>ពិនិត្យសុខភាពប្រព័ន្ធ</span>
                        </button>
                    </div>
                </section>
            </div>
            <div className="drawer-foot">
                <button
                    type="button"
                    className="drawer-item drawer-auth"
                    id="navAuthBtn"
                    onClick={onAct("drawerAuthFlow")}
                >
                    <span className="ico">🔑</span>
                    <span className="drawer-auth-label">ចូល</span>
                </button>
                <a
                    className="app-version-line"
                    data-app-version=""
                    href="./guide.html"
                    target="_self"
                    rel="noopener"
                    aria-label="បើកសៀវភៅណែនាំ ZoeW"
                ></a>
                <div className="app-copyright-line">រក្សាសិទ្ធិគ្រប់យ៉ាង © 2026 ហ៊ុន ម៉េង ស្រូយ (MENGSROY HEN)</div>
                <div className="app-copyright-line app-copyright-en">Copyright © 2026 MENGSROY HEN. All rights reserved.</div>
            </div>
        </aside>
    );
}
