import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('../../../ZoeW/src/services/crypto', async original => ({ ...(await original<any>()),
    verifyStoredPin: async (pin) => pin === '482915', hashPin: async () => 'test-pin-hash',
    deriveLookupSecretKey: async () => ({ type: 'secret' }), rememberLookupSecretKey: async () => true
}));
vi.mock('../../../ZoeW/src/features/biometric', async original => ({ ...(await original<any>()), isBiometricEnabled: () => false, refreshBiometricUi: vi.fn(), clearBiometricRecord: vi.fn() }));
vi.mock('../../../ZoeW/src/features/zto-status', async original => ({ ...(await original<any>()), scheduleZtoStatusSweep: vi.fn() }));
vi.mock('../../../ZoeW/src/features/zto-palm-login', async original => ({ ...(await original<any>()), refreshZtoPalmSession: vi.fn() }));
vi.mock('../../../ZoeW/src/features/auth', async original => ({ ...(await original<any>()), logoutApp: vi.fn() }));
import { refTo, setFieldValue } from '../../../ZoeW/src/app/refs';
import { firebaseState, securityState, uiState } from '../../../ZoeW/src/core/state';
import { viewState } from '../../../ZoeW/src/core/view-state';
import { modalIsOpen, registerModalMeta, unregisterModalMeta } from '../../../ZoeW/src/core/modals';
import { openSeatEnrollment, closeSeatEnrollment } from '../../../ZoeW/src/features/license';
import { cancelPinEntryFlow, cancelPinSetupFlow } from '../../../ZoeW/src/features/config';
import { saveNewSecurityPin, verifySecurityPin } from '../../../ZoeW/src/features/pin';
import { logoutApp } from '../../../ZoeW/src/features/auth';
import { ACTION_NAMES } from '../../../ZoeW/src/core/action-registry';
import { sessionUserActionAllowed } from '../../../ZoeW/src/core/session-verification';
import { SideDrawer } from '../../../ZoeW/src/app/components/SideDrawer';
import { ActivationModal } from '../../../ZoeW/src/app/components/modals/ActivationModal';
import { LogoutConfirmModal } from '../../../ZoeW/src/app/components/modals/LogoutConfirmModal';
import { byId, mount, step, unmount } from './native/react-harness';
const fields = ['securityPinInput', 'newSecurityPinInput'] as const;
beforeEach(() => {
    vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear();
    localStorage.setItem('zoew_security_pin_hash', 'test-pin-hash');
    Object.assign(firebaseState, { auth: { currentUser: { uid: 'owner' } }, db: {}, isDatabaseInitialized: true, authButtonIsLoggedIn: true, serverClockTrusted: true, serverTimeOffsetMs: 0, sessionExpiryCheck: 'live' });
    firebaseState.authGeneration++;
    Object.assign(securityState, { isVerifyingPin: false, pinTargetAction: null, lookupSecretKey: null, appIsLocked: false });
    Object.assign(viewState, { backendKind: 'firebase', seatEnrollmentOnly: false, seatEnrollmentBusy: false, activationBusy: false });
    uiState.modalDisplay = {}; uiState.modalStack = [];
    for (const id of ['pinModal', 'pinSetupModal']) registerModalMeta(id, {});
    for (const field of fields) refTo(field)(document.createElement('input'));
    vi.stubGlobal('alert', vi.fn());
    mount(<><SideDrawer /><ActivationModal /><LogoutConfirmModal /></>);
});
afterEach(() => {
    unmount(); for (const id of ['pinModal', 'pinSetupModal']) unregisterModalMeta(id);
    for (const field of fields) refTo(field)(null);
    localStorage.clear(); sessionStorage.clear(); vi.unstubAllGlobals();
});
it('ប៊ូតុងចុះឈ្មោះនៅជាប់ប៊ូតុងចាកចេញ មុនព័ត៌មានកំណែ', () => {
    expect(byId('navAuthBtn').nextElementSibling).toBe(byId('drawerSeatEnrollment'));
});
it('សុំ PIN មុនបើក ហើយ PIN ខុសមិនបើកប្រអប់', async () => {
    step(() => byId('drawerSeatEnrollment').click());
    expect(modalIsOpen('pinModal')).toBe(true); expect(modalIsOpen('activationModal')).toBe(false);
    expect(viewState.pinPromptVerifyText).toContain('ចុះឈ្មោះឧបករណ៍');
    setFieldValue('securityPinInput', 'wrong'); await verifySecurityPin();
    expect(modalIsOpen('activationModal')).toBe(false);
    setFieldValue('securityPinInput', '482915'); await verifySecurityPin();
    expect(modalIsOpen('activationModal')).toBe(true); expect(viewState.seatEnrollmentOnly).toBe(true);
    step(closeSeatEnrollment); expect(modalIsOpen('activationModal')).toBe(false);
});
it.each([false, true])('បោះបង់ PIN មិនបើកប្រអប់ និងអាចសាកម្ដងទៀត៖ setup=%s', async setup => {
    if (setup) localStorage.clear();
    step(openSeatEnrollment);
    expect(modalIsOpen(setup ? 'pinSetupModal' : 'pinModal')).toBe(true);
    step(setup ? cancelPinSetupFlow : cancelPinEntryFlow);
    expect(modalIsOpen('activationModal')).toBe(false);
    step(openSeatEnrollment);
    setFieldValue(setup ? 'newSecurityPinInput' : 'securityPinInput', '482915');
    await (setup ? saveNewSecurityPin() : verifySecurityPin());
    expect(modalIsOpen('activationModal')).toBe(true);
});
it.each(['generation', 'auth', 'user', 'database', 'backend', 'mandatory'])('PIN ចាស់មិនបើកក្រោយ %s ប្ដូរ', async reason => {
    step(openSeatEnrollment);
    if (reason === 'generation') firebaseState.authGeneration++;
    if (reason === 'auth') firebaseState.auth = { currentUser: { uid: 'owner' } } as any;
    if (reason === 'user') firebaseState.auth.currentUser = { uid: 'other' } as any;
    if (reason === 'database') firebaseState.db = {};
    if (reason === 'backend') viewState.backendKind = 'supabase';
    if (reason === 'mandatory') uiState.modalDisplay.activationModal = 'flex';
    setFieldValue('securityPinInput', '482915'); await verifySecurityPin();
    expect(viewState.seatEnrollmentOnly).toBe(false);
    expect(modalIsOpen('activationModal')).toBe(reason === 'mandatory');
});
it.each([false, true])('ចាកចេញសុំយល់ព្រម និងបោះបង់រក្សាប្រអប់៖ enrollment=%s', enrollment => {
    viewState.seatEnrollmentOnly = enrollment;
    uiState.modalDisplay.activationModal = 'flex'; uiState.modalStack = ['activationModal'];
    firebaseState.sessionExpiryCheck = 'unknown'; firebaseState.serverClockTrusted = false;
    step(() => byId('activationLogoutBtn').click());
    expect(logoutApp).not.toHaveBeenCalled(); expect(modalIsOpen('logoutConfirmModal')).toBe(true);
    expect(Number(byId('logoutConfirmModal').style.zIndex)).toBeGreaterThan(Number(byId('activationModal').style.zIndex));
    step(() => byId('logoutConfirmModal').querySelector<HTMLButtonElement>('.btn-cancel')!.click());
    expect(modalIsOpen('logoutConfirmModal')).toBe(false); expect(modalIsOpen('activationModal')).toBe(true);
    expect(viewState.seatEnrollmentOnly).toBe(enrollment); expect(logoutApp).not.toHaveBeenCalled();
    if (!enrollment) { step(closeSeatEnrollment); expect(modalIsOpen('activationModal')).toBe(true); }
    step(() => byId('activationLogoutBtn').click()); step(() => byId('logoutConfirmBtn').click());
    expect(logoutApp).toHaveBeenCalledOnce(); expect(modalIsOpen('logoutConfirmModal')).toBe(false);
    expect(sessionUserActionAllowed('prepareSeatEnrollment')).toBe(false);
    expect(sessionUserActionAllowed('submitActivationKey')).toBe(false);
});

it('ពេល session មិនទាន់បញ្ជាក់ អនុញ្ញាតតែពិនិត្យឡើងវិញ និងការចាកចេញ', () => {
    firebaseState.sessionExpiryCheck = 'pending'; firebaseState.serverClockTrusted = false;
    expect(ACTION_NAMES.filter(sessionUserActionAllowed).sort()).toEqual([
        'cancelLogout', 'confirmLogout', 'logoutApp', 'promptLogout', 'retrySessionVerification'
    ]);
});
