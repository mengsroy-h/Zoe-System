import { lookupAction } from './action-registry';
import { firebaseState } from './state';
import { ACTION_ALLOWLIST } from './runtime';
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

export function readActionArgs(el, event) {
    const raw = el.getAttribute('data-args');
    let args = [];
    if (raw) {
        try { args = JSON.parse(raw); } catch (e) { args = []; }
        if (!Array.isArray(args)) args = [args];
    } else {
        const a1 = el.getAttribute('data-a1');
        const a2 = el.getAttribute('data-a2');
        if (a1 !== null) args.push(a1);
        if (a2 !== null) args.push(a2);
    }
    if (el.getAttribute('data-evt')) args.unshift(event);
    if (el.getAttribute('data-self')) args.unshift(el);
    return args;
}

export function runElementAction(el, event) {
    const name = el.getAttribute('data-act');
    if (!name || ACTION_ALLOWLIST.indexOf(name) === -1) return;
    const fn = lookupAction(name);
    if (!fn) return;
    fn.apply(null, readActionArgs(el, event));
}

export function setupActionDelegation() {
    ['click', 'change', 'input', 'submit'].forEach((type) => {
        document.addEventListener(type, (event) => {
            const el = event.target && event.target.closest ? event.target.closest('[data-act]') : null;
            if (!el) return;
            const want = el.getAttribute('data-on') || 'click';
            if (want !== type) return;
            runElementAction(el, event);
        });
    });
}

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

export function drawerGroupIsEmpty(group) {
    const items = group.querySelectorAll('.drawer-group-body .drawer-item');
    for (let i = 0; i < items.length; i++) {
        if (!items[i].classList.contains('hidden')) return false;
    }
    return true;
}

export function applyDrawerGroupState(group, open) {
    group.classList.toggle('is-open', open);
    const head = group.querySelector('.drawer-group-head');
    if (head) head.setAttribute('aria-expanded', open ? 'true' : 'false');
}

export function refreshDrawerGroups() {
    const open = openDrawerGroupKeys();
    document.querySelectorAll('#sideDrawer .drawer-group').forEach((group) => {
        const empty = drawerGroupIsEmpty(group);
        group.classList.toggle('hidden', empty);
        applyDrawerGroupState(group, !empty && open.indexOf(group.id) !== -1);
    });
}

export function toggleDrawerGroup(el?) {
    const group = el && el.closest ? el.closest('.drawer-group') : null;
    if (!group || !group.id) return;
    const open = openDrawerGroupKeys();
    const at = open.indexOf(group.id);
    if (at === -1) open.push(group.id);
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
    document.querySelectorAll('[data-app-version]').forEach((el) => {
        el.textContent = 'កំណែប្រព័ន្ធ: ' + APP_VERSION;
    });
}
