/**
 * Deep audit ជុំ ៥ (Toast ៖ «មិនបាត់ស្ងាត់ · មិនជាប់ចាស់») ៖
 *   ១. ពិដាន ៤ toast ៖ អ្នកបោះយក ✅ មុន ℹ️/⏳ មុន ⚠️ មុន ❌ (ចាស់បំផុតក្នុងថ្នាក់នីមួយៗ) ➜ សារព្រមានលុយ
 *      មិនត្រូវបានរុញចេញដោយ «✅ រក្សាទុកបានជោគជ័យ» ៤ ដងក្នុងការស្កេនជាប់ៗគ្នា។ ទិសផ្ទុយ ៖ មានតែ ⚠️ ➜ ចាស់បំផុតចេញ · toast រស់នៅតែត្រូវរំលង។
 *   ២. សោ App (`body.app-locked` លាក់ `.toast-container`) ៖ toast ដែលលេចពេលជាប់សោ (ការរក្សាទុកយឺតចប់ · ⚠️ លុយ) រង់ចាំរហូតដោះសោ
 *      ទើបរាប់អាយុ ៣ វិ. — មិនផុតពេលស្ងាត់ក្រោយអេក្រង់សោ · toast រស់ (បណ្តាញ) អានស្ថានភាពពិតឡើងវិញពេលដោះសោ (មិនបង្ហាញសារចាស់)។
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act as reactAct } from 'react';
import { ToastList } from '../../../../ZoeW/src/app/components/toast/ToastList';
import { firebaseState, securityState, uiState } from '../../../../ZoeW/src/core/state';
import { dbListenerPendingPaths } from '../../../../ZoeW/src/core/text';
import { hideAppLockScreen, showAppLockScreen } from '../../../../ZoeW/src/features/app-lock';
import { TOAST_LIFETIME_MS, TOAST_LIVE_LIMIT_MS, refreshLiveToasts, showLiveToast, showToast } from '../../../../ZoeW/src/ui/toast';
import { acceptFixtureSession, configureFixtureBackend } from './helpers/accepted-session';

let host: HTMLElement;
let root: any;

function step(fn: () => void) {
    reactAct(() => { fn(); uiState.flush(); });
}

const texts = () => Array.from(host.querySelectorAll('.toast')).map((t) => t.textContent);

function authenticatedUser(uid: string) {
    firebaseState.auth = { currentUser: { uid } } as any;
    acceptFixtureSession();
}

beforeEach(() => {
    vi.useFakeTimers();
    configureFixtureBackend('toast-visibility-fixture');
    Object.assign(firebaseState, { fb: {}, db: {}, isInitializingFirebase: false, isDatabaseInitialized: true, firebaseSdkUnavailable: false, authLoginOperation: null });
    document.body.innerHTML = '';
    host = document.createElement('div');
    host.className = 'toast-container';
    document.body.appendChild(host);
    root = createRoot(host);
    reactAct(() => { root.render(<ToastList />); });
    securityState.appIsLocked = false;
    firebaseState.auth = null;
    firebaseState.serverClockTrusted = true;
    reactAct(() => { uiState.toasts = []; uiState.flush(); });
});

afterEach(() => {
    securityState.appIsLocked = false;
    firebaseState.auth = null;
    refreshLiveToasts();
    reactAct(() => { vi.runOnlyPendingTimers(); uiState.flush(); });
    reactAct(() => { root.unmount(); });
    vi.useRealTimers();
});

describe('សម័យរង់ចាំផ្ទៀងផ្ទាត់ ៖ toast លាក់ត្រូវរក្សាអាយុ', () => {
    for (const state of ['pending', 'unverified', 'expired']) {
        it('សារ ' + state + ' រង់ចាំសម័យច្បាស់ រួចទើបចាប់អាយុពេញ', () => {
            authenticatedUser('held');
            firebaseState.sessionExpiryCheck = state;
            step(() => { showToast('⚠️ ប្រាក់រង់ចាំផ្ទៀងផ្ទាត់'); });
            step(() => { vi.advanceTimersByTime(60000); refreshLiveToasts(); });
            expect(texts()).toEqual(['⚠️ ប្រាក់រង់ចាំផ្ទៀងផ្ទាត់']);
            step(() => {
                if (state === 'expired') firebaseState.auth = null;
                else firebaseState.sessionExpiryCheck = 'live';
                refreshLiveToasts();
            });
            step(() => { vi.advanceTimersByTime(TOAST_LIFETIME_MS - 1); });
            expect(texts()).toEqual(['⚠️ ប្រាក់រង់ចាំផ្ទៀងផ្ទាត់']);
            step(() => { vi.advanceTimersByTime(301); });
            expect(texts()).toEqual([]);
        });
    }

    it('toast មាន timer រួច ប៉ុន្តែនាឡិកាបាត់ទំនុកចិត្ត មិនបាត់ក្រោយវាំងនន', () => {
        authenticatedUser('held');
        firebaseState.sessionExpiryCheck = 'live';
        step(() => { showToast('⚠️ លទ្ធផលរក្សាទុកមិនទាន់ច្បាស់'); });
        step(() => { vi.advanceTimersByTime(1000); });
        firebaseState.serverClockTrusted = false;
        step(() => { vi.advanceTimersByTime(60000); });
        expect(texts()).toEqual(['⚠️ លទ្ធផលរក្សាទុកមិនទាន់ច្បាស់']);
        step(() => { firebaseState.serverClockTrusted = true; refreshLiveToasts(); });
        step(() => { vi.advanceTimersByTime(TOAST_LIFETIME_MS - 1); });
        expect(texts()).toHaveLength(1);
        step(() => { vi.advanceTimersByTime(301); });
        expect(texts()).toEqual([]);
    });

    it('សម័យផ្ទៀងផ្ទាត់រួច តែ PIN នៅជាប់សោ មិនចាប់អាយុមុនពេលដោះ', () => {
        authenticatedUser('held');
        firebaseState.sessionExpiryCheck = 'unverified';
        step(() => { showToast('⚠️ សារដែលត្រូវអាន'); });
        showAppLockScreen(true);
        step(() => { firebaseState.sessionExpiryCheck = 'live'; refreshLiveToasts(); vi.advanceTimersByTime(60000); });
        expect(texts()).toEqual(['⚠️ សារដែលត្រូវអាន']);
        step(() => { hideAppLockScreen(); vi.advanceTimersByTime(TOAST_LIFETIME_MS + 300); });
        expect(texts()).toEqual([]);
    });

    it('toast បណ្តាញរស់រង់ចាំផ្ទៀងផ្ទាត់ ហើយអានភាពជោគជ័យថ្មីមុនចាប់អាយុ', () => {
        vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => true);
        authenticatedUser('held');
        firebaseState.sessionExpiryCheck = 'unverified';
        firebaseState.isDatabaseConnected = false;
        firebaseState.dbListenersFailed = false;
        dbListenerPendingPaths.clear();
        step(() => { showLiveToast('network'); vi.advanceTimersByTime(60000); });
        expect(texts()).toEqual(['🔄 កំពុងភ្ជាប់ Server ឡើងវិញ...']);
        step(() => { firebaseState.sessionExpiryCheck = 'live'; firebaseState.isDatabaseConnected = true; refreshLiveToasts(); });
        expect(texts()).toEqual(['✅ ភ្ជាប់ Server វិញ — ទិន្នន័យទាន់សម័យ']);
        step(() => { vi.advanceTimersByTime(TOAST_LIFETIME_MS + 300); });
        expect(texts()).toEqual([]);
    });

    it('គ្មានអ្នកចូល ទោះស្ថានភាពចាស់មិនទាន់ផ្ទៀងផ្ទាត់ toast នៅផុតតាមអាយុធម្មតា', () => {
        firebaseState.sessionExpiryCheck = 'unverified';
        firebaseState.serverClockTrusted = false;
        step(() => { showToast('⚠️ សូមចូលប្រព័ន្ធ'); vi.advanceTimersByTime(TOAST_LIFETIME_MS + 300); });
        expect(texts()).toEqual([]);
    });
});

describe('ពិដាន ៤ ៖ សារព្រមានមិនត្រូវបានរុញចេញដោយសារធម្មតា', () => {
    it('⚠️ លុយ + ✅/ℹ️ ៤ ➜ ✅ ចាស់បំផុតចេញ · ⚠️ នៅ', () => {
        step(() => {
            showToast('⚠️ កញ្ចប់ (ZT1) បានរក្សាទុក ប៉ុន្តែស្ថិតិប្រាក់មិនទាន់ Sync ពេញលេញទេ!');
            ['✅ ១', '✅ ២', 'ℹ️ ៣', '✅ ៤'].forEach((m) => showToast(m));
        });
        expect(texts()).toEqual(['⚠️ កញ្ចប់ (ZT1) បានរក្សាទុក ប៉ុន្តែស្ថិតិប្រាក់មិនទាន់ Sync ពេញលេញទេ!', '✅ ២', 'ℹ️ ៣', '✅ ៤']);
    });

    it('លំដាប់បោះ ៖ ✅ ➜ ℹ️ ➜ ⚠️ ➜ ❌ (ចាស់បំផុតក្នុងថ្នាក់)', () => {
        step(() => { ['❌ ក', '⚠️ ខ', 'ℹ️ គ', '⚠️ ឃ', '✅ ង'].forEach((m) => showToast(m)); });
        expect(texts()).toEqual(['❌ ក', '⚠️ ខ', '⚠️ ឃ', '✅ ង']);
        step(() => { showToast('⚠️ ច'); });
        expect(texts()).toEqual(['❌ ក', '⚠️ ខ', '⚠️ ឃ', '⚠️ ច']);
        step(() => { showToast('⚠️ ឆ'); });
        expect(texts()).toEqual(['❌ ក', '⚠️ ឃ', '⚠️ ច', '⚠️ ឆ']);
        step(() => { showToast('❌ ជ'); });
        expect(texts()).toEqual(['❌ ក', '⚠️ ច', '⚠️ ឆ', '❌ ជ']);
    });

    it('ទិសផ្ទុយ ៖ មានតែ ⚠️ ➜ ចាស់បំផុតចេញ (ពិដាននៅ ៤) · toast រស់នៅតែត្រូវរំលង', () => {
        step(() => { for (let i = 1; i <= 5; i++) showToast('⚠️ ' + i); });
        expect(texts()).toEqual(['⚠️ 2', '⚠️ 3', '⚠️ 4', '⚠️ 5']);
        step(() => {
            uiState.toasts = [];
            showToast('ℹ️ រស់');
            (uiState.toasts[0] as any).live = 'signin';
            ['❌ ក', '❌ ខ', '❌ គ', '❌ ឃ'].forEach((m) => showToast(m));
        });
        expect(texts()).toEqual(['ℹ️ រស់', '❌ ខ', '❌ គ', '❌ ឃ']);
    });
});

describe('សោ App ៖ toast រង់ចាំដោះសោ', () => {
    it('toast លេចពេលជាប់សោ ➜ មិនផុតពេលស្ងាត់ ➜ ដោះសោ ➜ អាយុ ៣ វិ. ចាប់ផ្តើម', () => {
        showAppLockScreen(true);
        expect(securityState.appIsLocked).toBe(true);
        step(() => { showToast('⚠️ ដកកញ្ចប់ (ZT1) មិនបានជោគជ័យ!'); });
        step(() => { vi.advanceTimersByTime(TOAST_LIFETIME_MS + 300); });
        expect(texts()).toEqual(['⚠️ ដកកញ្ចប់ (ZT1) មិនបានជោគជ័យ!']);
        step(() => { vi.advanceTimersByTime(60000); });
        expect(texts().length).toBe(1);
        step(() => { hideAppLockScreen(); });
        expect(texts().length).toBe(1);
        step(() => { vi.advanceTimersByTime(TOAST_LIFETIME_MS - 1); });
        expect(texts().length).toBe(1);
        step(() => { vi.advanceTimersByTime(1 + 300); });
        expect(texts().length).toBe(0);
    });

    it('ទិសផ្ទុយ ៖ មិនជាប់សោ ➜ ផុតពេលក្រោយ ៣ វិ. ដូចដើម', () => {
        step(() => { showToast('✅ រក្សាទុកបានជោគជ័យ!'); });
        step(() => { vi.advanceTimersByTime(TOAST_LIFETIME_MS + 300); });
        expect(texts().length).toBe(0);
    });

    it('toast បណ្តាញរស់ពេលជាប់សោ ➜ មិនក្លាយជា «យូរជាងធម្មតា» ស្ងាត់ ➜ ដោះសោ ➜ អានស្ថានភាពពិត (✅)', () => {
        vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => true);
        authenticatedUser('u');
        firebaseState.sessionExpiryCheck = 'live' as any;
        firebaseState.isDatabaseConnected = false;
        firebaseState.dbListenersFailed = false;
        dbListenerPendingPaths.clear();
        showAppLockScreen(true);
        step(() => { showLiveToast('network'); });
        expect(texts()).toEqual(['🔄 កំពុងភ្ជាប់ Server ឡើងវិញ...']);
        step(() => { vi.advanceTimersByTime(TOAST_LIVE_LIMIT_MS + 10000); });
        expect(texts()).toEqual(['🔄 កំពុងភ្ជាប់ Server ឡើងវិញ...']);
        expect((uiState.toasts[0] as any).live).toBe('network');
        firebaseState.isDatabaseConnected = true;
        step(() => { hideAppLockScreen(); });
        expect(texts()).toEqual(['✅ ភ្ជាប់ Server វិញ — ទិន្នន័យទាន់សម័យ']);
        expect((uiState.toasts[0] as any).live).toBe(null);
        step(() => { vi.advanceTimersByTime(TOAST_LIFETIME_MS + 300); });
        expect(texts().length).toBe(0);
        firebaseState.auth = null as any;
    });
});
