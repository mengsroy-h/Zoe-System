import type { ReactNode } from 'react';
import { firebaseState, uiState } from '../../core/state';
import { viewState } from '../../core/view-state';
import { onAct } from '../actions';
import { useStoreFields, useStoreValue } from '../hooks/useStore';

interface DrawerGroupProps {
    id: string;
    headId: string;
    bodyId: string;
    icon: string;
    label: string;
    children: ReactNode;
}

function DrawerGroup({ id, headId, bodyId, icon, label, children }: DrawerGroupProps) {
    const v = useStoreFields(viewState, ['drawerGroupsOpen', 'drawerGroupsHidden']);
    const hidden = v.drawerGroupsHidden.indexOf(id) !== -1;
    const open = v.drawerGroupsOpen.indexOf(id) !== -1;
    let className = 'drawer-group';
    if (hidden) className += ' hidden';
    if (open) className += ' is-open';
    return (
        <section className={className} id={id}>
            <button
                type="button"
                className="drawer-group-head"
                id={headId}
                aria-expanded={open ? 'true' : 'false'}
                aria-controls={bodyId}
                onClick={onAct("toggleDrawerGroup", { args: [id] })}
            >
                <span className="ico">{icon}</span>
                <span className="drawer-group-label">{label}</span>
                <span className="drawer-group-arrow" aria-hidden="true">↓</span>
            </button>
            <div
                className="drawer-group-body"
                id={bodyId}
                role="group"
                aria-labelledby={headId}
            >
                {children}
            </div>
        </section>
    );
}

interface DrawerToggleProps {
    id: string;
    stateId: string;
    icon: string;
    label: string;
    action: string;
    on: boolean;
    visible?: boolean;
    extraClass?: string;
    stateText: string;
}

function DrawerToggle({ id, stateId, icon, label, action, on, visible = true, extraClass, stateText }: DrawerToggleProps) {
    let className = 'drawer-item drawer-toggle';
    if (!visible) className += ' hidden';
    if (on) className += ' is-on';
    if (extraClass) className += ' ' + extraClass;
    return (
        <button type="button" className={className} id={id} onClick={onAct(action)}>
            <span className="ico">{icon}</span>
            <span className="drawer-toggle-label">{label}</span>
            <span className="drawer-toggle-state" id={stateId}>{stateText}</span>
        </button>
    );
}

export function SideDrawer() {
    const open = useStoreValue(uiState, (s) => s.drawerOpen);
    const loggedIn = useStoreValue(firebaseState, (s) => s.authButtonIsLoggedIn);
    const versionLabel = useStoreValue(viewState, (s) => s.appVersionLabel);
    const displayRate = useStoreValue(viewState, (s) => s.displayRateText);
    const v = useStoreFields(viewState, ['ztoAutoCloseOn', 'ztoAutoCloseVisible', 'ztoAutoCloseText', 'ztoListSyncOn',
        'ztoListSyncDrawerVisible', 'ztoListSyncText', 'appLockToggleOn', 'appLockToggleText', 'biometricToggleOn',
        'biometricUnsupported', 'biometricToggleText']);
    return (
        <aside className={open ? 'side-drawer open' : 'side-drawer'} id="sideDrawer" aria-hidden={open ? 'false' : 'true'}>
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
                <DrawerGroup id="drawerGroupConnect" headId="drawerGroupHeadConnect" bodyId="drawerGroupBodyConnect" icon="🔗" label="ការតភ្ជាប់ និងទិន្នន័យ">
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
                </DrawerGroup>
                <DrawerGroup id="drawerGroupZto" headId="drawerGroupHeadZto" bodyId="drawerGroupBodyZto" icon="🚚" label="ZTO">
                    <DrawerToggle
                        id="ztoAutoCloseBtn"
                        stateId="ztoAutoCloseState"
                        icon="🔄"
                        label="បិទតាម ZTO ស្វ័យប្រវត្តិ"
                        action="drawerZtoAutoCloseFlow"
                        on={v.ztoAutoCloseOn}
                        visible={v.ztoAutoCloseVisible}
                        stateText={v.ztoAutoCloseText}
                    />
                    <DrawerToggle
                        id="ztoListSyncDrawerBtn"
                        stateId="ztoListSyncState"
                        icon="📥"
                        label="ទាញបញ្ជីកញ្ចប់ពី ZTO"
                        action="drawerZtoListSyncFlow"
                        on={v.ztoListSyncOn}
                        visible={v.ztoListSyncDrawerVisible}
                        stateText={v.ztoListSyncText}
                    />
                </DrawerGroup>
                <DrawerGroup id="drawerGroupLock" headId="drawerGroupHeadLock" bodyId="drawerGroupBodyLock" icon="🔒" label="ចាក់សោ និងសុវត្ថិភាព">
                    <DrawerToggle
                        id="appLockToggleBtn"
                        stateId="appLockToggleState"
                        icon="🔒"
                        label="ចាក់សោពេលបើក App"
                        action="drawerAppLockFlow"
                        on={v.appLockToggleOn}
                        stateText={v.appLockToggleText}
                    />
                    <DrawerToggle
                        id="biometricToggleBtn"
                        stateId="biometricToggleState"
                        icon="🔐"
                        label="ចូលដោយក្រយៅដៃ ឬមុខ"
                        action="drawerBiometricFlow"
                        on={v.biometricToggleOn}
                        extraClass={v.biometricUnsupported ? 'is-unsupported' : undefined}
                        stateText={v.biometricToggleText}
                    />
                </DrawerGroup>
                <DrawerGroup id="drawerGroupTools" headId="drawerGroupHeadTools" bodyId="drawerGroupBodyTools" icon="🧰" label="ឧបករណ៍">
                    <button type="button" className="drawer-item" onClick={onAct("drawerLockerSettingsFlow")}>
                        <span className="ico">🗄️</span>
                        <span>កំណត់ទូ Locker</span>
                    </button>
                    <button type="button" className="drawer-item" onClick={onAct("openHealthCheck")}>
                        <span className="ico">🩺</span>
                        <span>ពិនិត្យសុខភាពប្រព័ន្ធ</span>
                    </button>
                </DrawerGroup>
            </div>
            <div className="drawer-foot">
                <button
                    type="button"
                    className="drawer-item drawer-auth"
                    id="navAuthBtn"
                    onClick={onAct("drawerAuthFlow")}
                >
                    <span className="ico">{loggedIn ? '🚪' : '🔑'}</span>
                    <span className="drawer-auth-label">{loggedIn ? 'ចាកចេញ' : 'ចូល'}</span>
                </button>
                <a
                    className="app-version-line"
                    data-app-version=""
                    href="./guide.html"
                    target="_self"
                    rel="noopener"
                    aria-label="បើកសៀវភៅណែនាំ ZoeW"
                >{versionLabel}</a>
                {displayRate ? <div className="app-copyright-line" id="displayRateLine">{displayRate}</div> : null}
                <div className="app-copyright-line">រក្សាសិទ្ធិគ្រប់យ៉ាង © 2026 ហ៊ុន ម៉េង ស្រូយ (MENGSROY HEN)</div>
                <div className="app-copyright-line app-copyright-en">Copyright © 2026 MENGSROY HEN. All rights reserved.</div>
            </div>
        </aside>
    );
}
