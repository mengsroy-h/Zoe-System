/**
 * ⛔ ការជាសះស្បើយតែមួយ ➜ សារ ✅ តែមួយ ៖ toast បណ្តាញរស់ («🔄 ភ្ជាប់ Server វិញ — កំពុងទាញទិន្នន័យ...») ប្តូរខ្លួនឯងជា «✅ … ទិន្នន័យទាន់សម័យ»
 *    ពេល listener ដែលងាប់រស់វិញ ➜ សារ «✅ ទិន្នន័យភ្ជាប់មកវិញហើយ» របស់ `noteDbListenerAlive()` ក្នុងពេលដដែល = ✅ ២ និយាយរឿងដដែល។
 *    ទិសផ្ទុយ ៖ គ្មាន toast រស់ (listener ងាប់ខណៈបណ្តាញនៅល្អ) ➜ សារ «ទិន្នន័យភ្ជាប់មកវិញហើយ» នៅតែលេច (វាជាដំណឹងតែមួយ)។
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { firebaseState, uiState } from '../src/core/state';
import { viewState } from '../src/core/view-state';
import { dbListenerFailedPaths, dbListenerPendingPaths } from '../src/core/text';
import { noteDbListenerAlive } from '../src/services/db-listeners';
import { showLiveToast } from '../src/ui/toast';

const okToasts = () => uiState.toasts.map((t: any) => t.msg).filter((m: string) => /^✅/.test(m));

beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => true);
    uiState.toasts = [];
    firebaseState.auth = { currentUser: { uid: 'u' } } as any;
    firebaseState.sessionExpiryCheck = 'live' as any;
    firebaseState.firebaseSdkUnavailable = false;
    firebaseState.reconnectWatchdogAttempt = 99;
    firebaseState.isDatabaseConnected = true;
    firebaseState.dbListenersFailed = true;
    firebaseState.dbListenerOutageNoticeShown = true;
    dbListenerPendingPaths.clear();
    dbListenerFailedPaths.clear();
    dbListenerFailedPaths.add('history');
    viewState.connectionStatus = null;
    viewState.backendKind = 'firebase';
});

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    dbListenerPendingPaths.clear();
    dbListenerFailedPaths.clear();
    firebaseState.dbListenersFailed = false;
    uiState.toasts = [];
});

describe('ការជាសះស្បើយរបស់ listener ↔ toast បណ្តាញរស់', () => {
    it('toast បណ្តាញរស់កំពុងបង្ហាញ ➜ listener រស់វិញ ➜ ✅ តែមួយ (toast រស់ប្តូរខ្លួនឯង)', () => {
        showLiveToast('network');
        expect(uiState.toasts.map((t: any) => t.msg)[0]).toMatch(/^🔄 .*កំពុងទាញទិន្នន័យ/);
        noteDbListenerAlive('history');
        expect(firebaseState.dbListenersFailed).toBe(false);
        expect(okToasts().length).toBe(1);
        expect(okToasts()[0]).toMatch(/ទិន្នន័យទាន់សម័យ/);
    });

    it('ទិសផ្ទុយ ៖ គ្មាន toast រស់ ➜ សារ «ទិន្នន័យភ្ជាប់មកវិញហើយ» លេចម្តង', () => {
        noteDbListenerAlive('history');
        expect(okToasts()).toEqual(['✅ ទិន្នន័យភ្ជាប់មកវិញហើយ — តារាងទាន់សម័យវិញហើយ']);
    });

    it('toast រស់ផុតពិដានរួច (⚠️ យូរជាងធម្មតា) ➜ listener រស់វិញ ➜ ✅ តែមួយ', () => {
        showLiveToast('network');
        vi.advanceTimersByTime(25000);
        noteDbListenerAlive('history');
        expect(okToasts().length).toBe(1);
    });
});
