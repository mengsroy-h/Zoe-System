import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { appLocalStore, appSessionStore } from '../src/core/storage';
import { firebaseState, securityState } from '../src/core/state';
import { viewState } from '../src/core/view-state';
import { modalIsOpen, modalMeta, registerModalMeta, setModalDisplay, unregisterModalMeta } from '../src/core/modals';
import { refTo, setFieldValue } from '../src/app/refs';
import { act as reactAct, createElement, Fragment } from 'react';
import { mount, step, unmount } from './native/react-harness';
import { AppLockScreen } from '../src/app/components/AppLockScreen';
import { LoginModal } from '../src/app/components/modals/LoginModal';
import { DocumentEffects } from '../src/app/components/shell/DocumentEffects';
import { dismissModal } from '../src/ui/modal-stack';
import { modalBackdropTarget } from '../src/app/lifecycle/layers';
import { APP_LOCK_SESSION_KEY } from '../src/core/storage-keys';

const cryptoCalls = vi.hoisted(() => ({ derive: vi.fn(), remember: vi.fn() }));
vi.mock('../src/services/crypto', async original => ({ ...await original<any>(),
    deriveLookupSecretKey: cryptoCalls.derive, rememberLookupSecretKey: cryptoCalls.remember,
    forgetStoredLookupSecretKey: vi.fn(async () => true), verifyStoredPin: vi.fn(async (pin, hash) => hash === 'pin:' + pin)
}));
vi.mock('../src/features/session', async original => ({ ...await original<any>(),
    clearRememberedSession: vi.fn(), showLoginModalWithPrefill: () => setModalDisplay('loginModal', 'flex')
}));
import { completeAppUnlock, forgetAppLockPin, noteAppLockAway, noteAppLockExcuse, relockAppAfterAway, showAppLockScreen, verifyAppLockPin } from '../src/features/app-lock';

function deferred<T>() { let resolve!: (v: T) => void; let reject!: (e: Error) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
const turns = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
beforeEach(() => {
    appLocalStore.clear(); appSessionStore.clear();
    appLocalStore.setItem('zoew_security_pin_hash', 'pin:482915');
    Object.assign(securityState, { appIsLocked: false, appLockVeiled: false, appLockAwayNoted: false, appLockBusy: false, appLockExcuseAt: 0, lookupSecretKey: null });
    Object.assign(viewState, { appLockOpen: false, appLockMessage: '' });
    firebaseState.authGeneration++; firebaseState.auth = { currentUser: { uid: 'shop-a' } } as any;
    firebaseState.fb = { signOut: vi.fn(async () => { firebaseState.auth.currentUser = null; }) } as any;
    refTo('appLockPinInput')(document.createElement('input')); registerModalMeta('loginModal', {}); setModalDisplay('loginModal', 'none');
    cryptoCalls.derive.mockReset().mockResolvedValue({ type: 'secret' });
    cryptoCalls.remember.mockReset().mockResolvedValue(true); vi.stubGlobal('confirm', () => true);
});
afterEach(() => { unmount(); refTo('appLockPinInput')(null); setModalDisplay('loginModal', 'none'); unregisterModalMeta('loginModal'); vi.unstubAllGlobals(); });

it.each(['success', 'failure'])('F01៖ ភ្លេច PIN រក្សាស្រទាប់គ្រប រហូត logout %s', async outcome => {
    const pending = deferred<void>(); firebaseState.fb.signOut = vi.fn(() => pending.promise);
    showAppLockScreen(); forgetAppLockPin(); await turns();
    expect(securityState.appIsLocked || modalIsOpen('loginModal')).toBe(true);
    expect(viewState.appLockOpen || modalIsOpen('loginModal')).toBe(true);
    if (outcome === 'success') { firebaseState.auth.currentUser = null; pending.resolve(); } else pending.reject(new Error('synthetic logout failure'));
    await turns();
    expect(modalIsOpen('loginModal')).toBe(outcome === 'success');
    expect(securityState.appIsLocked).toBe(outcome !== 'success');
    expect(securityState.appLockBusy).toBe(false);
});
it('F01៖ callback ចាស់មិនបិទសោថ្មី ក្រោយ auth ផ្លាស់', async () => {
    const pending = deferred<void>(); firebaseState.fb.signOut = vi.fn(() => pending.promise);
    showAppLockScreen(); forgetAppLockPin();
    firebaseState.authGeneration++; firebaseState.auth = { currentUser: { uid: 'shop-b' } } as any;
    appLocalStore.setItem('zoew_security_pin_hash', 'pin:current'); showAppLockScreen();
    pending.resolve(); await turns(); expect(securityState.appIsLocked).toBe(true); expect(modalIsOpen('loginModal')).toBe(false);
});
it.each([
    { session: 'replacement', outcome: 'success' }, { session: 'replacement', outcome: 'failure' },
    { session: 'generation', outcome: 'success' }, { session: 'generation', outcome: 'failure' }
])('F01 integration៖ $session / old $outcome មិនទប់ logout ថ្មី ឬបិទសោរបស់វា', async ({ session, outcome }) => {
    const old = deferred<void>(), next = deferred<void>();
    const confirmPinRemoval = vi.fn(() => true); vi.stubGlobal('confirm', confirmPinRemoval);
    const oldSignOut = vi.fn().mockImplementationOnce(() => old.promise).mockImplementation(() => next.promise); firebaseState.fb.signOut = oldSignOut;
    const nextAuth = session === 'replacement' ? { currentUser: { uid: 'shop-b' } as any } : firebaseState.auth;
    const nextSignOut = session === 'replacement' ? vi.fn(() => next.promise) : oldSignOut;
    try {
        showAppLockScreen(); forgetAppLockPin(); await turns(); forgetAppLockPin(); await turns();
        expect(oldSignOut).toHaveBeenCalledOnce(); expect(confirmPinRemoval).toHaveBeenCalledOnce();
        firebaseState.authGeneration++;
        if (session === 'replacement') { firebaseState.auth = nextAuth as any; firebaseState.fb = { signOut: nextSignOut } as any; }
        appLocalStore.setItem('zoew_security_pin_hash', 'pin:replacement'); showAppLockScreen(); forgetAppLockPin(); await turns();
        const expectedCalls = session === 'replacement' ? 1 : 2;
        expect(nextSignOut).toHaveBeenCalledTimes(expectedCalls); expect(nextSignOut).toHaveBeenLastCalledWith(nextAuth); expect(confirmPinRemoval).toHaveBeenCalledTimes(2);
        expect(appLocalStore.getItem('zoew_security_pin_hash')).toBeNull(); expect(securityState.appLockBusy).toBe(true);
        if (outcome === 'success') old.resolve(); else old.reject(new Error('synthetic old-session signout failure'));
        await turns();
        expect(securityState.appIsLocked).toBe(true); expect(viewState.appLockOpen).toBe(true); expect(modalIsOpen('loginModal')).toBe(false);
        expect(securityState.appLockBusy).toBe(true); forgetAppLockPin(); await turns(); expect(nextSignOut).toHaveBeenCalledTimes(expectedCalls);
        nextAuth.currentUser = null; next.resolve(); await turns();
        expect(modalIsOpen('loginModal')).toBe(true); expect(securityState.appIsLocked).toBe(false); expect(securityState.appLockBusy).toBe(false);
    } finally { old.resolve(); next.resolve(); await turns(); }
});
it('F01 integration control៖ same UID/user object ថ្មី នៅ epoch ដដែល មិនបង្កើត logout ស្ទួន', async () => {
    const pending = deferred<void>(), signOut = vi.fn(() => pending.promise); firebaseState.fb.signOut = signOut;
    const confirmPinRemoval = vi.fn(() => true); vi.stubGlobal('confirm', confirmPinRemoval);
    try {
        showAppLockScreen(); forgetAppLockPin(); await turns();
        firebaseState.auth.currentUser = { uid: firebaseState.auth.currentUser.uid };
        forgetAppLockPin(); await turns(); expect(signOut).toHaveBeenCalledOnce(); expect(confirmPinRemoval).toHaveBeenCalledOnce();
        firebaseState.auth.currentUser = null; pending.resolve(); await turns(); expect(modalIsOpen('loginModal')).toBe(true);
    } finally { pending.resolve(); await turns(); }
});
it.each(['success', 'failure'])('F01 integration៖ same UID/user object ថ្មី នៅ epoch ដដែល បញ្ចប់ $0 រួចអាច retry ក្រោម veil', async outcome => {
    const pending = deferred<void>(), signOut = vi.fn(() => pending.promise); firebaseState.fb.signOut = signOut;
    try {
        showAppLockScreen(); forgetAppLockPin(); await turns();
        firebaseState.auth.currentUser = { uid: firebaseState.auth.currentUser.uid };
        forgetAppLockPin(); await turns(); expect(signOut).toHaveBeenCalledOnce();
        if (outcome === 'success') pending.resolve(); else pending.reject(new Error('synthetic same-session signout failure'));
        await turns();
        expect(securityState.appLockBusy).toBe(false); expect(securityState.appIsLocked).toBe(true);
        expect(viewState.appLockOpen).toBe(true); expect(viewState.appLockMessage).not.toBe(''); expect(modalIsOpen('loginModal')).toBe(false);
        const retry = deferred<void>(); firebaseState.fb.signOut = vi.fn(() => retry.promise);
        try {
            forgetAppLockPin(); await turns(); expect(firebaseState.fb.signOut).toHaveBeenCalledOnce(); expect(securityState.appLockBusy).toBe(true);
        } finally { retry.resolve(); await turns(); }
    } finally { pending.resolve(); await turns(); }
});
it('F01 integration control៖ signed-out null និង epoch ថ្មី អនុញ្ញាត safe login handoff', async () => {
    const pending = deferred<void>(); firebaseState.fb.signOut = vi.fn(() => pending.promise);
    try {
        showAppLockScreen(); forgetAppLockPin(); await turns();
        firebaseState.authGeneration++; firebaseState.auth.currentUser = null; pending.resolve(); await turns();
        expect(modalIsOpen('loginModal')).toBe(true); expect(securityState.appIsLocked).toBe(false); expect(securityState.appLockBusy).toBe(false);
    } finally { pending.resolve(); await turns(); }
});
it.each(['uid', 'generation'])('F01 integration control៖ active session %s ថ្មី មិនទទួលសារបរាជ័យរបស់ logout ចាស់', async change => {
    const pending = deferred<void>(); firebaseState.fb.signOut = vi.fn(() => pending.promise);
    try {
        showAppLockScreen(); forgetAppLockPin(); await turns();
        if (change === 'uid') firebaseState.auth.currentUser = { uid: 'replacement-account' }; else firebaseState.authGeneration++;
        showAppLockScreen(true); expect(viewState.appLockMessage).toBe('');
        pending.reject(new Error('synthetic old-session logout failure')); await turns();
        expect(viewState.appLockMessage).toBe(''); expect(securityState.appIsLocked).toBe(true);
        expect(securityState.appLockBusy).toBe(false); expect(modalIsOpen('loginModal')).toBe(false);
    } finally { pending.resolve(); await turns(); }
});
it.each(['correct', 'wrong'])('F08 control៖ PIN %s គោរពសោ', async kind => {
    showAppLockScreen(); setFieldValue('appLockPinInput', kind === 'correct' ? '482915' : '000000');
    expect(await verifyAppLockPin()).toBe(kind === 'correct'); expect(securityState.appIsLocked).toBe(kind !== 'correct');
});
it.each(['derive', 'remember'])('F08៖ ចាកចេញពេល %s រង់ចាំ មិនអាចដោះសោពីសំណើចាស់', async stage => {
    const pending = deferred<any>(); cryptoCalls[stage].mockReturnValueOnce(pending.promise);
    showAppLockScreen(); setFieldValue('appLockPinInput', '482915'); const work = verifyAppLockPin();
    await vi.waitFor(() => expect(cryptoCalls[stage]).toHaveBeenCalled()); noteAppLockAway();
    pending.resolve(stage === 'derive' ? { type: 'secret' } : true); await work; relockAppAfterAway();
    expect(securityState.appIsLocked).toBe(true); expect(appSessionStore.getItem(APP_LOCK_SESSION_KEY)).toBeNull(); expect(securityState.lookupSecretKey).toBeNull();
});
it('F08 control៖ intentional exit exemption អនុញ្ញាត unlock ដដែល', async () => {
    const pending = deferred<any>(); cryptoCalls.derive.mockReturnValueOnce(pending.promise);
    showAppLockScreen(); setFieldValue('appLockPinInput', '482915'); const work = verifyAppLockPin();
    await vi.waitFor(() => expect(cryptoCalls.derive).toHaveBeenCalled()); noteAppLockExcuse(); noteAppLockAway();
    pending.resolve({ type: 'secret' }); expect(await work).toBe(true); relockAppAfterAway(); expect(securityState.appIsLocked).toBe(false);
});

it('F08 integration៖ App មិនដោះសោពេលគ្មាន saved PIN', async () => {
    showAppLockScreen(); appLocalStore.removeItem('zoew_security_pin_hash');
    appLocalStore.setItem('zoew_pin_fail_count', '3');
    expect(await completeAppUnlock('482915')).toBe(false);
    expect(cryptoCalls.derive).not.toHaveBeenCalled(); expect(cryptoCalls.remember).not.toHaveBeenCalled();
    expect(securityState.appIsLocked).toBe(true); expect(appSessionStore.getItem(APP_LOCK_SESSION_KEY)).toBeNull();
    expect(appLocalStore.getItem('zoew_pin_fail_count')).toBe('3');
});
it.each(['derive', 'remember'])('F08 integration៖ PIN ប្ដូរពេល %s រង់ចាំ រក្សាសោ និងចំនួនខុស', async stage => {
    const pending = deferred<any>(); cryptoCalls[stage].mockReturnValueOnce(pending.promise);
    appLocalStore.setItem('zoew_pin_fail_count', '3');
    showAppLockScreen(); setFieldValue('appLockPinInput', '482915'); const work = verifyAppLockPin();
    await vi.waitFor(() => expect(cryptoCalls[stage]).toHaveBeenCalled());
    appLocalStore.setItem('zoew_security_pin_hash', 'pin:replacement');
    pending.resolve(stage === 'derive' ? { type: 'secret' } : true);
    expect(await work).toBe(false); expect(securityState.appIsLocked).toBe(true);
    expect(appSessionStore.getItem(APP_LOCK_SESSION_KEY)).toBeNull(); expect(appLocalStore.getItem('zoew_pin_fail_count')).toBe('3');
});
it('F08 integration៖ ចាកចេញនៅ microtask ក្រោយ shared key completion មិនបិទសោ ឬលុបចំនួនខុស', async () => {
    cryptoCalls.remember.mockImplementationOnce(() => {
        const done = Promise.resolve(true);
        void done.then(() => queueMicrotask(() => noteAppLockAway()));
        return done;
    });
    appLocalStore.setItem('zoew_pin_fail_count', '3');
    showAppLockScreen(); setFieldValue('appLockPinInput', '482915');
    expect(await verifyAppLockPin()).toBe(false); expect(securityState.appIsLocked).toBe(true);
    expect(securityState.lookupSecretKey).toBeNull(); expect(appSessionStore.getItem(APP_LOCK_SESSION_KEY)).toBeNull();
    expect(appLocalStore.getItem('zoew_pin_fail_count')).toBe('3');
});

it.each(['success','failure'])('F01៖ ភ្លេច PIN → ចាកចេញ → logout %s → ត្រឡប់ នៅមានផ្លូវចេញដោយសុវត្ថិភាព',async outcome=>{
    const pending=deferred<void>();firebaseState.fb.signOut=vi.fn(()=>pending.promise);
    mount(createElement(Fragment,null,createElement(DocumentEffects),createElement(AppLockScreen),createElement(LoginModal),createElement('div',{id:'privateBusiness'},'synthetic cached customer')));
    step(()=>showAppLockScreen());
    const forgotten=document.querySelector('.app-lock-forgot') as HTMLButtonElement;
    step(()=>forgotten.click());step(()=>noteAppLockAway());
    expect(appLocalStore.getItem('zoew_security_pin_hash')).toBeNull();expect(document.body.classList.contains('app-locked')).toBe(true);
    await reactAct(async()=>{
        if(outcome==='success'){firebaseState.auth.currentUser=null;pending.resolve();}else pending.reject(new Error('synthetic retained local session'));
        await turns();
    });step(()=>relockAppAfterAway());
    if(outcome==='failure'){
        expect(document.getElementById('privateBusiness')?.textContent).toBe('synthetic cached customer');
        expect(document.body.classList.contains('app-locked')).toBe(true);expect(document.querySelector('#appLockScreen.is-open')).not.toBeNull();
        expect(securityState.appLockBusy).toBe(false);expect(forgotten.disabled).toBe(false);
        firebaseState.fb.signOut=vi.fn(async()=>{firebaseState.auth.currentUser=null;});await reactAct(async()=>{forgotten.click();await turns();});
    }
    expect(modalIsOpen('loginModal')).toBe(true);expect(modalMeta('loginModal')?.noDismiss).toBe(true);
    const backdrop=modalBackdropTarget(document.getElementById('loginModal'));step(()=>dismissModal(backdrop));expect(modalIsOpen('loginModal')).toBe(true);step(()=>dismissModal('loginModal'));expect(modalIsOpen('loginModal')).toBe(true);
    expect(securityState.appIsLocked).toBe(false);expect(securityState.appLockBusy).toBe(false);
});
