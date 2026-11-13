import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('../../../../ZoeW/src/features/auth', () => ({ logoutApp: vi.fn(), loginWithFirebase: vi.fn(), updateAuthButton: vi.fn(), performLogin: vi.fn(), setupAuthListener: vi.fn() }));
import { firebaseState, uiState } from '../../../../ZoeW/src/core/state';
import { viewState } from '../../../../ZoeW/src/core/view-state';
import { modalIsOpen } from '../../../../ZoeW/src/core/modals';
import { logoutApp } from '../../../../ZoeW/src/features/auth';
import { ACTION_NAMES } from '../../../../ZoeW/src/core/action-registry';
import { sessionUserActionAllowed } from '../../../../ZoeW/src/core/session-verification';
import { ActivationModal } from '../../../../ZoeW/src/app/components/modals/ActivationModal';
import { LogoutConfirmModal } from '../../../../ZoeW/src/app/components/modals/LogoutConfirmModal';
import { byId, mount, step, unmount } from './native/react-harness';
beforeEach(() => {
    vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear();
    Object.assign(firebaseState, { auth: { currentUser: { uid: 'owner' } }, db: {}, isDatabaseInitialized: true, authButtonIsLoggedIn: true, serverClockTrusted: true, serverTimeOffsetMs: 0, sessionExpiryCheck: 'live' });
    firebaseState.authGeneration++;
    Object.assign(viewState, { backendKind: 'firebase', activationBusy: false });
    uiState.modalDisplay = {}; uiState.modalStack = [];
    mount(<><ActivationModal /><LogoutConfirmModal /></>);
});
afterEach(() => {
    unmount(); localStorage.clear(); sessionStorage.clear();
});
it.each(['unknown', 'pending', 'live'] as const)('ចាកចេញសុំយល់ព្រម និងបោះបង់រក្សាប្រអប់៖ session=%s', session => {
    step(() => {
        uiState.modalDisplay.activationModal = 'flex'; uiState.modalStack = ['activationModal'];
        firebaseState.sessionExpiryCheck = session; firebaseState.serverClockTrusted = session === 'live';
    });
    step(() => byId('activationLogoutBtn').click());
    expect(logoutApp).not.toHaveBeenCalled(); expect(modalIsOpen('logoutConfirmModal')).toBe(true);
    expect(Number(byId('logoutConfirmModal').style.zIndex)).toBeGreaterThan(Number(byId('activationModal').style.zIndex));
    step(() => byId('logoutConfirmModal').querySelector<HTMLButtonElement>('.btn-cancel')!.click());
    expect(modalIsOpen('logoutConfirmModal')).toBe(false); expect(modalIsOpen('activationModal')).toBe(true);
    expect(logoutApp).not.toHaveBeenCalled();
    step(() => byId('activationLogoutBtn').click()); step(() => byId('logoutConfirmBtn').click());
    expect(logoutApp).toHaveBeenCalledOnce(); expect(modalIsOpen('logoutConfirmModal')).toBe(false);
    if (session !== 'live') expect(sessionUserActionAllowed('submitActivationKey')).toBe(false);
});
it('ពេល session មិនទាន់បញ្ជាក់ អនុញ្ញាតតែពិនិត្យឡើងវិញ និងការចាកចេញ', () => {
    step(() => { firebaseState.sessionExpiryCheck = 'pending'; firebaseState.serverClockTrusted = false; });
    expect(ACTION_NAMES.filter(sessionUserActionAllowed).sort()).toEqual([
        'cancelLogout', 'confirmLogout', 'logoutApp', 'promptLogout', 'retrySessionVerification'
    ]);
});
