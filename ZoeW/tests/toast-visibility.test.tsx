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
import { ToastList } from '../src/app/components/toast/ToastList';
import { firebaseState, securityState, uiState } from '../src/core/state';
import { dbListenerPendingPaths } from '../src/core/text';
import { hideAppLockScreen, showAppLockScreen } from '../src/features/app-lock';
import { TOAST_LIFETIME_MS, TOAST_LIVE_LIMIT_MS, showLiveToast, showToast } from '../src/ui/toast';

let host: HTMLElement;
let root: any;

function step(fn: () => void) {
    reactAct(() => { fn(); uiState.flush(); });
}

const texts = () => Array.from(host.querySelectorAll('.toast')).map((t) => t.textContent);

beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '';
    host = document.createElement('div');
    host.className = 'toast-container';
    document.body.appendChild(host);
    root = createRoot(host);
    reactAct(() => { root.render(<ToastList />); });
    securityState.appIsLocked = false;
    reactAct(() => { uiState.toasts = []; uiState.flush(); });
});

afterEach(() => {
    securityState.appIsLocked = false;
    reactAct(() => { vi.runOnlyPendingTimers(); uiState.flush(); });
    reactAct(() => { root.unmount(); });
    vi.useRealTimers();
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
        firebaseState.auth = { currentUser: { uid: 'u' } } as any;
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
