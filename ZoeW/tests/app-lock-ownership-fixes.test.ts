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
import { forgetAppLockPin, noteAppLockAway, noteAppLockExcuse, relockAppAfterAway, showAppLockScreen, verifyAppLockPin } from '../src/features/app-lock';

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
