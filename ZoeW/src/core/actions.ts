import { firebaseState } from './state';
import { viewState } from './view-state';
import { appLocalStore, safeStoreGet, safeStoreSet } from './storage';
import { DRAWER_GROUP_KEY } from './storage-keys';
import { APP_VERSION } from './version';
import { loginWithFirebase, logoutApp } from '../features/auth';
import { toggleBiometricUnlock } from '../features/biometric';
import { openLockerSettingsModal } from '../features/locker';
import { openCustomerDataTableModal } from '../features/lookup-api';
import { openLookupApiConfigModal } from '../features/lookup-config';
import { requestPinBeforeConfig } from '../features/pin';
import { showLoginModalWithPrefill } from '../features/session';
import { closeModal, openModalHelper } from '../ui/modal';
import { drawerAction } from '../ui/page-nav';

export function submitLoginForm(event?) {
    if (event) event.preventDefault();
    loginWithFirebase();
}

export function drawerConfigFlow() {
    drawerAction(function () { requestPinBeforeConfig(null, 'config'); });
}

export function drawerLockerSettingsFlow() {
    drawerAction(function () { requestPinBeforeConfig(openLockerSettingsModal, 'locker'); });
}

export function drawerLookupApiFlow() {
    drawerAction(function () { requestPinBeforeConfig(openLookupApiConfigModal, 'lookupApi'); });
}

export function drawerCustomerTableFlow() {
    drawerAction(openCustomerDataTableModal);
}

export function drawerBiometricFlow() {
    drawerAction(toggleBiometricUnlock);
}

export function openDrawerGroupKeys() {
    const raw = safeStoreGet(appLocalStore, DRAWER_GROUP_KEY);
    if (!raw) return [];
    return String(raw).split(',').map((k) => k.trim()).filter(Boolean);
}

export function rememberDrawerGroups(keys) {
    safeStoreSet(appLocalStore, DRAWER_GROUP_KEY, keys.join(','));
}

/**
 * ធាតុដែលអាចលាក់បាន ក្នុង Category នីមួយៗ ➜ Category ដែលធាតុទាំងអស់លាក់
 * ត្រូវលាក់ទាំងក្បាល (`CLAUDE.md` ៖ «របា Slide ៖ Category បត់បាន»)។
 * Category ដែលមិនមានក្នុងតារាងនេះ មិនដែលទទេទេ។
 */
export const DRAWER_GROUP_TOGGLES: Record<string, ReadonlyArray<'ztoAutoCloseVisible' | 'ztoListSyncDrawerVisible'>> = {
    drawerGroupZto: ['ztoAutoCloseVisible', 'ztoListSyncDrawerVisible']
};

export function drawerGroupIsEmpty(group) {
    const keys = DRAWER_GROUP_TOGGLES[group];
    if (!keys) return false;
    for (let i = 0; i < keys.length; i++) {
        if (viewState[keys[i]]) return false;
    }
    return true;
}

export function applyDrawerGroupState(group, open) {
    const at = viewState.drawerGroupsOpen.indexOf(group);
    if (open && at === -1) viewState.drawerGroupsOpen = viewState.drawerGroupsOpen.concat([group]);
    else if (!open && at !== -1) viewState.drawerGroupsOpen = viewState.drawerGroupsOpen.filter((g) => g !== group);
}

export function refreshDrawerGroups() {
    viewState.drawerGroupsHidden = Object.keys(DRAWER_GROUP_TOGGLES).filter((key) => drawerGroupIsEmpty(key));
    viewState.drawerGroupsOpen = openDrawerGroupKeys().filter((key) => !drawerGroupIsEmpty(key));
}

export function toggleDrawerGroup(group?) {
    if (!group) return;
    const open = openDrawerGroupKeys();
    const at = open.indexOf(group);
    if (at === -1) open.push(group);
    else open.splice(at, 1);
    rememberDrawerGroups(open);
    applyDrawerGroupState(group, at === -1);
}

export function drawerAuthFlow() {
    drawerAction(firebaseState.authButtonIsLoggedIn ? promptLogout : showLoginModalWithPrefill);
}

export function promptLogout() {
    openModalHelper('logoutConfirmModal');
}

export function cancelLogout() {
    closeModal('logoutConfirmModal');
}

export function confirmLogout() {
    closeModal('logoutConfirmModal');
    logoutApp();
}

export function renderAppVersionLabels() {
    viewState.appVersionLabel = 'កំណែប្រព័ន្ធ: ' + APP_VERSION;
}
