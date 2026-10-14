/**
 * ⛔ toast រស់ (បណ្តាញ · ចូលប្រព័ន្ធ) និយាយតាម **ដំណាក់កាល connection ពិត** (សំណើម្ចាស់គម្រោង ៖ «real live toast») ៖
 *    (១) ការសរសេររង់ចាំកំពុងផ្ទៀងផ្ទាត់ (`recovering` — Firebase journal · Supabase replay) ➜ toast «🔄 … កំពុងផ្ទៀងផ្ទាត់ការសរសេររង់ចាំ»
 *        ⛔ មិនមែន «✅ ទិន្នន័យទាន់សម័យ» ខណៈរបាខាងលើប្រាប់ «កំពុងផ្ទៀងផ្ទាត់ការសរសេរ...» (toast និងរបាមិនត្រូវផ្ទុយគ្នា)
 *    (២) ការសរសេរ **blocked** ➜ toast ⚠️ ប្រាប់ផ្លូវចេញ (☰ ឧបករណ៍) ហើយបញ្ចប់ — មិនដែល ✅
 *    (៣) listener មិនទាន់ភ្ជាប់ (`syncing` · `isDatabaseInitialized` នៅ false) ➜ «🔄 … កំពុងទាញទិន្នន័យ» មិនមែន ✅
 *    (៤) Supabase ៖ `db.recoveryState().recovering` ចូលដំណាក់កាល `recovering` ដូច Firebase (របា «កំពុងផ្ទៀងផ្ទាត់ការសរសេរ...»)
 *    (៥) ពេលផ្ទៀងផ្ទាត់ចប់ ➜ ✅ លេច **ម្តង**។
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { firebaseState, uiState } from '../src/core/state';
import { viewState } from '../src/core/view-state';
import { dbListenerPendingPaths } from '../src/core/text';
import { renderConnectionStatus } from '../src/services/connection';
import { connectionFlowSnapshot } from '../src/services/connection-flow';
import { showLiveToast } from '../src/ui/toast';

const native = vi.hoisted(() => ({ state: { blocked: 0, recovering: false, deferred: false, external: 0, pending: 0 } }));
vi.mock('../src/services/native-write-recovery', async (importOriginal) => {
    const mod = await importOriginal<any>();
    return { ...mod, nativeWriteRecoveryState: () => native.state };
});

const texts = () => uiState.toasts.map((t: any) => t.msg);
const live = () => uiState.toasts.filter((t: any) => t.live !== null);
const okCount = () => texts().filter((t) => /^✅/.test(t)).length;
let online = true;
let recovery = { blocked: 0, recovering: false, pending: 0 };

function setNet(o: { online?: boolean; db?: boolean }) {
    if (o.online !== undefined) online = o.online;
    if (o.db !== undefined) firebaseState.isDatabaseConnected = o.db;
    renderConnectionStatus();
}

beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => online);
    online = true;
    recovery = { blocked: 0, recovering: false, pending: 0 };
    native.state = { blocked: 0, recovering: false, deferred: false, external: 0, pending: 0 };
    uiState.toasts = [];
    dbListenerPendingPaths.clear();
    Object.assign(firebaseState, {
        fb: {}, db: { recoveryState: () => recovery }, auth: { currentUser: { uid: 'u' } },
        isInitializingFirebase: false, firebaseSdkUnavailable: false, authLoginOperation: null,
        sessionExpiryCheck: 'live', isDatabaseConnected: true, isDatabaseInitialized: true,
        dbListenersFailed: false, reconnectWatchdogAttempt: 99
    });
    viewState.connectionStatus = null;
    viewState.backendKind = 'firebase';
    renderConnectionStatus();
    uiState.toasts = [];
});

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    dbListenerPendingPaths.clear();
    uiState.toasts = [];
    Object.assign(firebaseState, { fb: null, db: null, auth: null });
});

describe('toast រស់ ↔ ដំណាក់កាល connection', () => {
    it('Supabase ៖ replay ការសរសេរ ➜ ដំណាក់កាល recovering · របា «កំពុងផ្ទៀងផ្ទាត់ការសរសេរ...» · toast បណ្តាញមិន ✅ · ចប់ ➜ ✅ ម្តង', () => {
        setNet({ online: false, db: false });
        expect(live().length).toBe(1);
        recovery = { blocked: 0, recovering: true, pending: 1 };
        setNet({ online: true, db: true });
        expect(connectionFlowSnapshot().phase).toBe('recovering');
        expect(viewState.connectionStatus).toBe('connecting');
        expect(viewState.connectionText).toMatch(/ផ្ទៀងផ្ទាត់ការសរសេរ/);
        expect(live().length).toBe(1);
        expect(live()[0].msg).toMatch(/^🔄 .*ផ្ទៀងផ្ទាត់ការសរសេរ/);
        expect(okCount()).toBe(0);
        recovery = { blocked: 0, recovering: false, pending: 0 };
        renderConnectionStatus();
        expect(okCount()).toBe(1);
        expect(uiState.toasts[0].msg).toMatch(/^✅ .*ទាន់សម័យ/);
        expect(uiState.toasts[0].live).toBe(null);
        renderConnectionStatus();
        expect(okCount()).toBe(1);
    });

    it('Firebase ៖ journal ការសរសេរកំពុងផ្ទៀងផ្ទាត់ ➜ toast ចូលប្រព័ន្ធ «🔄 … ផ្ទៀងផ្ទាត់ការសរសេររង់ចាំ» · ចប់ ➜ «✅ ចូលប្រព័ន្ធជោគជ័យ» ម្តង', () => {
        native.state = { blocked: 0, recovering: true, deferred: false, external: 0, pending: 2 };
        renderConnectionStatus();
        expect(connectionFlowSnapshot().phase).toBe('recovering');
        showLiveToast('signin');
        expect(uiState.toasts.length).toBe(1);
        expect(uiState.toasts[0].live).toBe('signin');
        expect(uiState.toasts[0].msg).toMatch(/^🔄 ចូលប្រព័ន្ធរួច.*ផ្ទៀងផ្ទាត់ការសរសេរ/);
        native.state = { blocked: 0, recovering: false, deferred: false, external: 0, pending: 0 };
        renderConnectionStatus();
        expect(uiState.toasts.length).toBe(1);
        expect(uiState.toasts[0].msg).toMatch(/^✅ ចូលប្រព័ន្ធជោគជ័យ/);
        expect(uiState.toasts[0].live).toBe(null);
    });

    it('ការសរសេរ blocked ➜ toast ⚠️ ប្រាប់ផ្លូវចេញ (☰ ឧបករណ៍) · បញ្ចប់ · មិនដែល ✅', () => {
        recovery = { blocked: 2, recovering: false, pending: 0 };
        renderConnectionStatus();
        expect(connectionFlowSnapshot().phase).toBe('blocked');
        showLiveToast('signin');
        expect(uiState.toasts.length).toBe(1);
        expect(uiState.toasts[0].kind).toBe('warn');
        expect(uiState.toasts[0].msg).toMatch(/^⚠️ .*មិនទាន់ផ្ទៀងផ្ទាត់.*ឧបករណ៍/);
        expect(uiState.toasts[0].live).toBe(null);
        renderConnectionStatus();
        expect(okCount()).toBe(0);
        uiState.toasts = [];
        setNet({ online: false, db: false });
        setNet({ online: true, db: true });
        expect(okCount()).toBe(0);
        expect(texts().some((t) => /^⚠️ .*មិនទាន់ផ្ទៀងផ្ទាត់/.test(t))).toBe(true);
    });

    it('listener មិនទាន់ភ្ជាប់ (syncing) ➜ «🔄 … កំពុងទាញទិន្នន័យ» · ភ្ជាប់រួច ➜ ✅ ម្តង', () => {
        setNet({ online: false, db: false });
        firebaseState.isDatabaseInitialized = false;
        setNet({ online: true, db: true });
        expect(connectionFlowSnapshot().phase).toBe('syncing');
        expect(live().length).toBe(1);
        expect(live()[0].msg).toMatch(/^🔄 .*កំពុងទាញទិន្នន័យ/);
        expect(okCount()).toBe(0);
        firebaseState.isDatabaseInitialized = true;
        renderConnectionStatus();
        expect(okCount()).toBe(1);
    });

    it('ក្រៅបណ្ដាញ និង listener ងាប់ នៅតែឈ្នះដំណាក់កាលសរសេរ (សារដែលពិតជាង)', () => {
        recovery = { blocked: 0, recovering: true, pending: 1 };
        setNet({ online: false, db: false });
        expect(live()[0].msg).toMatch(/^⚠️ .*ក្រៅបណ្ដាញ/);
        firebaseState.dbListenersFailed = true;
        setNet({ online: true, db: true });
        expect(live()[0].msg).not.toMatch(/ផ្ទៀងផ្ទាត់ការសរសេរ/);
        expect(okCount()).toBe(0);
    });
});
