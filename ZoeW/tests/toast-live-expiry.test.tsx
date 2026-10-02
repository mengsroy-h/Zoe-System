/**
 * ⛔ toast រស់ (Config · ចូលប្រព័ន្ធ · បណ្តាញ) ត្រូវ **បញ្ចប់ដោយការពិត** (សំណើម្ចាស់គម្រោង ៖ «toast realtime · កុំនិយាយមិនពិត») ៖
 *    (១) ផុតពិដាន ២០ វិ. ខណៈនៅ «🔄 កំពុង…» ➜ មិនបាត់ស្ងាត់ (អ្នកប្រើគិតថាវានៅតែកំពុងដើរ) ➜ ប្តូរជា «⚠️ … យូរជាងធម្មតា» រួចទើបបាត់
 *    (២) បន្ទាប់មកជោគជ័យយឺត ➜ ✅ លេច **ម្តង** (អ្នកប្រើដឹងថាស្តារ) · (៣) សារ ⚠️ ក្រៅបណ្ដាញ ផុតពេល ➜ បាត់ដូចដើម (វាប្រាប់ស្ថានភាពរួច)
 *    (៤) ផុតពេលក្រោយ ✅ (settled) ➜ គ្មានសារ «យូរជាងធម្មតា» ក្លែង។
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { firebaseState, uiState } from '../src/core/state';
import { viewState } from '../src/core/view-state';
import { dbListenerPendingPaths } from '../src/core/text';
import { renderConnectionStatus } from '../src/services/connection';
import { TOAST_LIFETIME_MS, TOAST_LIVE_LIMIT_MS, TOAST_STALLED_MS, showLiveToast } from '../src/ui/toast';

const texts = () => uiState.toasts.map((t: any) => t.msg);
let online = true;

beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => online);
    online = true;
    uiState.toasts = [];
    firebaseState.auth = { currentUser: { uid: 'u' } } as any;
    firebaseState.sessionExpiryCheck = 'live' as any;
    firebaseState.firebaseSdkUnavailable = false;
    firebaseState.reconnectWatchdogAttempt = 99;
    firebaseState.dbListenersFailed = false;
    dbListenerPendingPaths.clear();
    firebaseState.isDatabaseConnected = false;
    viewState.connectionStatus = null;
    viewState.backendKind = 'firebase';
});

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    dbListenerPendingPaths.clear();
    uiState.toasts = [];
});

describe('toast រស់ផុតពិដាន', () => {
    it('Config ៖ «🔄 កំពុងតភ្ជាប់» ២០ វិ. ➜ «⚠️ … យូរជាងធម្មតា (ពិនិត្យ Config)» ➜ បាត់ ➜ ភ្ជាប់យឺត ➜ ✅ ម្តង', () => {
        showLiveToast('config');
        expect(texts()[0]).toMatch(/^🔄 /);
        vi.advanceTimersByTime(TOAST_LIVE_LIMIT_MS + 10);
        expect(uiState.toasts.length).toBe(1);
        expect(texts()[0]).toMatch(/^⚠️ .*យូរជាងធម្មតា.*Config/);
        expect(uiState.toasts[0].kind).toBe('warn');
        expect(uiState.toasts[0].live).toBe(null);
        vi.advanceTimersByTime(TOAST_STALLED_MS + 400);
        expect(uiState.toasts.length).toBe(0);
        firebaseState.isDatabaseConnected = true;
        renderConnectionStatus();
        expect(texts().filter((t) => /^✅ ភ្ជាប់ Server រួចរាល់/.test(t)).length).toBe(1);
        renderConnectionStatus();
        expect(texts().filter((t) => /^✅/.test(t)).length).toBe(1);
    });

    it('ចូលប្រព័ន្ធ ៖ ទិន្នន័យមកយឺត ➜ ⚠️ យូរជាងធម្មតា ➜ ទិន្នន័យមកដល់ ➜ «✅ ចូលប្រព័ន្ធជោគជ័យ» ម្តង', () => {
        firebaseState.isDatabaseConnected = true;
        dbListenerPendingPaths.add('history');
        showLiveToast('signin');
        expect(texts()[0]).toMatch(/កំពុងទាញទិន្នន័យ/);
        vi.advanceTimersByTime(TOAST_LIVE_LIMIT_MS + 10);
        expect(texts()[0]).toMatch(/^⚠️ .*យូរជាងធម្មតា/);
        dbListenerPendingPaths.clear();
        renderConnectionStatus();
        expect(texts().filter((t) => /^✅ ចូលប្រព័ន្ធជោគជ័យ/.test(t)).length).toBe(1);
    });

    it('ទិសផ្ទុយ ៖ ⚠️ ក្រៅបណ្ដាញ ផុតពេល ➜ បាត់ធម្មតា (គ្មានសារ «យូរជាងធម្មតា»)', () => {
        online = false;
        showLiveToast('config');
        vi.advanceTimersByTime(TOAST_LIVE_LIMIT_MS + 10);
        expect(texts().some((t) => /យូរជាងធម្មតា/.test(t))).toBe(false);
        vi.advanceTimersByTime(400);
        expect(uiState.toasts.length).toBe(0);
    });

    it('ទិសផ្ទុយ ៖ ✅ រួចមុនពិដាន ➜ បាត់តាម TOAST_LIFETIME_MS · គ្មានសារក្លែង · គ្មាន ✅ ស្ទួនពេលក្រោយ', () => {
        showLiveToast('config');
        firebaseState.isDatabaseConnected = true;
        renderConnectionStatus();
        expect(texts()[0]).toMatch(/^✅/);
        vi.advanceTimersByTime(TOAST_LIFETIME_MS + 400);
        expect(uiState.toasts.length).toBe(0);
        vi.advanceTimersByTime(TOAST_LIVE_LIMIT_MS);
        renderConnectionStatus();
        expect(uiState.toasts.length).toBe(0);
    });

    it('ចាកចេញក្រោយផុតពេល ➜ មិនរាយ ✅ ក្លែង', () => {
        firebaseState.isDatabaseConnected = true;
        dbListenerPendingPaths.add('history');
        showLiveToast('signin');
        vi.advanceTimersByTime(TOAST_LIVE_LIMIT_MS + TOAST_STALLED_MS + 500);
        firebaseState.auth = { currentUser: null } as any;
        dbListenerPendingPaths.clear();
        renderConnectionStatus();
        expect(texts().some((t) => /^✅/.test(t))).toBe(false);
    });
});
