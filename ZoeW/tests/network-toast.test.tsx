/**
 * ⛔ toast «បណ្តាញ» រស់ (សំណើម្ចាស់គម្រោង ៖ «toast realtime») ៖ ពេល App ដែលកំពុងចូលប្រព័ន្ធ ធ្លាក់ពី «ភ្ជាប់» ទៅ «ក្រៅបណ្ដាញ»
 *    toast តែមួយលេចឡើង ហើយ **ប្តូរខ្លួនឯង** តាមស្ថានភាពពិត (ក្រៅបណ្ដាញ ➜ កំពុងភ្ជាប់ ➜ កំពុងទាញទិន្នន័យ ➜ ✅) — មិនមែន toast ថ្មីរាល់ការប្តូរ។
 *    ⛔ «✅ ទាន់សម័យ» តែពេល Database ភ្ជាប់ **និង** គ្មាន listener ដែលកំពុងទាញ/ងាប់ · ⛔ ការភ្លាត់ «connecting» ខ្លី (grace) មិនលេច toast ·
 *    ⛔ មិនទាន់ចូលប្រព័ន្ធ ➜ គ្មាន toast · ⛔ toast ផុតពេល (២០ វិ.) ហើយបណ្តាញមកវិញ ➜ សារ ✅ លេចម្តងទៀត (អ្នកប្រើដឹងថាស្តារ)។
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { firebaseState, uiState } from '../src/core/state';
import { viewState } from '../src/core/view-state';
import { dbListenerPendingPaths } from '../src/core/text';
import { renderConnectionStatus } from '../src/services/connection';
import { TOAST_LIVE_LIMIT_MS } from '../src/ui/toast';

const live = () => uiState.toasts.filter((t: any) => t.live === 'network');
const texts = () => uiState.toasts.map((t: any) => t.msg);
let online = true;

function setNet(o: { online?: boolean; db?: boolean; failed?: boolean; pending?: boolean }) {
    if (o.online !== undefined) online = o.online;
    if (o.db !== undefined) firebaseState.isDatabaseConnected = o.db;
    if (o.failed !== undefined) firebaseState.dbListenersFailed = o.failed;
    if (o.pending !== undefined) { dbListenerPendingPaths.clear(); if (o.pending) dbListenerPendingPaths.add('history'); }
    renderConnectionStatus();
}

beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => online);
    online = true;
    uiState.toasts = [];
    firebaseState.auth = { currentUser: { uid: 'u' } } as any;
    firebaseState.sessionExpiryCheck = 'live' as any;
    firebaseState.firebaseSdkUnavailable = false;
    firebaseState.reconnectWatchdogAttempt = 99;
    dbListenerPendingPaths.clear();
    firebaseState.isDatabaseConnected = true;
    firebaseState.dbListenersFailed = false;
    viewState.connectionStatus = null;
    renderConnectionStatus();
    uiState.toasts = [];
});

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    dbListenerPendingPaths.clear();
});

describe('toast បណ្តាញរស់', () => {
    it('ភ្ជាប់ ➜ ក្រៅបណ្ដាញ ➜ toast តែមួយ ប្តូរតាមស្ថានភាព ➜ ✅ តែពេលទិន្នន័យទាន់សម័យ', () => {
        setNet({ online: false, db: false });
        expect(viewState.connectionStatus).toBe('offline');
        expect(live().length).toBe(1);
        expect(live()[0].msg).toMatch(/^⚠️ .*ក្រៅបណ្ដាញ/);
        setNet({ online: true });
        expect(live().length).toBe(1);
        expect(live()[0].msg).toMatch(/កំពុងភ្ជាប់/);
        setNet({ db: true, pending: true });
        expect(live().length).toBe(1);
        expect(live()[0].msg).toMatch(/កំពុងទាញទិន្នន័យ/);
        expect(texts().some((t) => /^✅/.test(t))).toBe(false);
        setNet({ pending: false });
        expect(uiState.toasts.length).toBe(1);
        expect(uiState.toasts[0].msg).toMatch(/^✅ .*ទាន់សម័យ/);
        expect(uiState.toasts[0].live).toBe(null);
    });

    it('listener ងាប់ក្រោយភ្ជាប់វិញ ➜ មិនរាយ ✅', () => {
        setNet({ online: false, db: false });
        setNet({ online: true, db: true, failed: true });
        expect(live()[0].msg).not.toMatch(/^✅/);
        setNet({ failed: false });
        expect(uiState.toasts[0].msg).toMatch(/^✅/);
    });

    it('ដាច់យឺតៗ ៖ ភ្ជាប់ ➜ កំពុងភ្ជាប់ (grace) ➜ ក្រៅបណ្ដាញ ➜ toast លេច', () => {
        firebaseState.reconnectWatchdogAttempt = 0;
        setNet({ db: false });
        expect(viewState.connectionStatus).toBe('connecting');
        expect(uiState.toasts).toEqual([]);
        firebaseState.reconnectWatchdogAttempt = 99;
        setNet({ db: false });
        expect(viewState.connectionStatus).toBe('offline');
        expect(live().length).toBe(1);
    });

    it('ចូលប្រព័ន្ធខណៈមិនដែលភ្ជាប់ ➜ កំពុងភ្ជាប់ ➜ ក្រៅបណ្ដាញ ➜ គ្មាន toast បណ្តាញ (toast ចូលប្រព័ន្ធប្រាប់រួច)', () => {
        firebaseState.auth = { currentUser: null } as any;
        setNet({ online: false, db: false });
        firebaseState.auth = { currentUser: { uid: 'u' } } as any;
        firebaseState.reconnectWatchdogAttempt = 0;
        setNet({ online: true, db: false });
        expect(viewState.connectionStatus).toBe('connecting');
        firebaseState.reconnectWatchdogAttempt = 99;
        setNet({ db: false });
        expect(viewState.connectionStatus).toBe('offline');
        expect(uiState.toasts).toEqual([]);
    });

    it('ការភ្លាត់ខ្លី (connecting · grace) មិនលេច toast', () => {
        firebaseState.reconnectWatchdogAttempt = 0;
        setNet({ db: false });
        expect(viewState.connectionStatus).toBe('connecting');
        setNet({ db: true });
        expect(uiState.toasts).toEqual([]);
    });

    it('toast ចូលប្រព័ន្ធ/Config រស់រួច ➜ មិនលេច toast បណ្តាញស្ទួន', async () => {
        const { showLiveToast } = await import('../src/ui/toast');
        setNet({ online: false, db: false });
        uiState.toasts = [];
        firebaseState.isDatabaseConnected = false;
        showLiveToast('signin');
        expect(uiState.toasts.length).toBe(1);
        setNet({ online: true, db: true, pending: true });
        expect(uiState.toasts.length).toBe(1);
        expect(uiState.toasts[0].live).toBe('signin');
        setNet({ pending: false });
        expect(uiState.toasts.length).toBe(1);
        expect(uiState.toasts[0].msg).toMatch(/^✅ ចូលប្រព័ន្ធជោគជ័យ/);
    });

    it('មិនទាន់ចូលប្រព័ន្ធ ➜ គ្មាន toast', () => {
        firebaseState.auth = { currentUser: null } as any;
        setNet({ online: false, db: false });
        setNet({ online: true, db: true });
        expect(uiState.toasts).toEqual([]);
    });

    it('toast ផុតពេលខណៈនៅក្រៅបណ្ដាញ ➜ ពេលភ្ជាប់វិញ សារ ✅ លេចម្តងទៀត · មិនស្ទួន', () => {
        setNet({ online: false, db: false });
        vi.advanceTimersByTime(TOAST_LIVE_LIMIT_MS + 1000);
        expect(live().length).toBe(0);
        setNet({ online: false, db: false });
        expect(uiState.toasts.length).toBe(0);
        setNet({ online: true, db: true });
        expect(uiState.toasts.filter((t: any) => /^✅/.test(t.msg)).length).toBe(1);
        setNet({ db: true });
        expect(uiState.toasts.filter((t: any) => /^✅/.test(t.msg)).length).toBe(1);
    });

    it('ក្រៅបណ្ដាញម្តងទៀតក្រោយ ✅ ➜ toast ថ្មី (វគ្គថ្មី)', () => {
        setNet({ online: false, db: false });
        setNet({ online: true, db: true });
        vi.advanceTimersByTime(5000);
        setNet({ online: false, db: false });
        expect(live().length).toBe(1);
    });
});
