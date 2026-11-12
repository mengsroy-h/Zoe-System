import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { firebaseState, scanState, securityState, uiState } from '../src/core/state';
import { viewState } from '../src/core/view-state';
import { acceptServerClockOffset, pendingHistoryPatches, pendingRegistryReleases, resetServerClock } from '../src/core/clock';
import { appLocalStore } from '../src/core/storage';
import { armSessionExpiryCheck, FOUR_HOURS_MS, runSessionExpiryCheck } from '../src/features/session';
import { AppLockScreen } from '../src/app/components/AppLockScreen';
import { DocumentEffects } from '../src/app/components/shell/DocumentEffects';
import { act } from '../src/app/actions';
import { handleNativeBack } from '../src/app/lifecycle/native-shell';
import { focusTrapLayer } from '../src/app/behaviors/modal-focus-trap';
import { mount, step, unmount } from './native/react-harness';
import { setupAuthListener } from '../src/features/auth';
import * as license from '../src/features/license';
import * as scanAction from '../src/features/scan-action';
import * as dailyStats from '../src/features/daily-stats';
import { hardwareScannerKeyPress } from '../src/app/behaviors/scanner-input';
import { processScannedCode } from '../src/services/scan-engine';
import { queueScannedCode, resetBatchScan } from '../src/features/batch-scan';
import { DB_OP_TIMEOUT_MS } from '../src/services/network';
import { TOAST_LIFETIME_MS, showToast } from '../src/ui/toast';

const START = Date.UTC(2026, 10, 8, 8);
const HOUR = 3600000;
let elapsed = 0;
let skew = 0;
let token: ReturnType<typeof vi.fn>;
let signOut: ReturnType<typeof vi.fn>;
const turn = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };

it('ផ្ទៀងផ្ទាត់វគ្គពិតរួច ចាប់អាយុសារដែលបានលាក់ដោយស្វ័យប្រវត្តិ', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame'] });
    sample();
    uiState.toasts = [];
    firebaseState.sessionExpiryCheck = 'unverified';
    const id = showToast('⚠️ ការរក្សាទុករង់ចាំផ្ទៀងផ្ទាត់');
    vi.advanceTimersByTime(60000);
    expect(uiState.toasts.some((toast) => toast.id === id)).toBe(true);
    expect(await runSessionExpiryCheck()).toBe(false);
    expect(firebaseState.sessionExpiryCheck).toBe('live');
    vi.advanceTimersByTime(TOAST_LIFETIME_MS - 1);
    expect(uiState.toasts.some((toast) => toast.id === id)).toBe(true);
    vi.advanceTimersByTime(301);
    expect(uiState.toasts.some((toast) => toast.id === id)).toBe(false);
});

function sample() {
    firebaseState.isDatabaseConnected = true;
    expect(acceptServerClockOffset(-skew, { epochMs: START + elapsed, monotonicMs: 100 + elapsed, wallMs: START + elapsed + skew }, false)).toBe(true);
}

beforeEach(() => {
    elapsed = 0; skew = 0;
    vi.spyOn(Date, 'now').mockImplementation(() => START + elapsed + skew);
    vi.spyOn(performance, 'now').mockImplementation(() => 100 + elapsed);
    appLocalStore.clear();
    resetServerClock();
    token = vi.fn(async () => ({ authTime: new Date(START - HOUR).toISOString() }));
    signOut = vi.fn(() => new Promise<void>(() => {}));
    Object.assign(firebaseState, {
        auth: { currentUser: { uid: 'clock-policy' } }, fb: { getIdTokenResult: token, signOut }, db: {},
        firebaseConfig: { databaseURL: 'https://clock-policy.invalid' }, authGeneration: firebaseState.authGeneration + 1,
        authLoginOperation: null, sessionExpiryCheck: 'live', sessionExpiryCheckInFlight: false,
        hasEverConnectedToDatabase: false, isDatabaseConnected: false
    });
    Object.assign(securityState, { appIsLocked: false, appLockVeiled: false });
    Object.assign(viewState, { appLockOpen: false, appLockMessage: '' });
    Object.assign(uiState, { isModalOpen: false, moreMenuOpen: false, modalDisplay: {}, modalStack: [], currentAppPage: 'entry', drawerOpen: false, notifyDrawerOpen: false });
});

afterEach(() => {
    unmount();
    resetBatchScan();
    firebaseState.authUnsubscribe?.(); firebaseState.authUnsubscribe = null;
    pendingHistoryPatches.clear(); pendingRegistryReleases.clear();
    firebaseState.auth = null;
    resetServerClock();
    vi.useRealTimers();
    vi.restoreAllMocks();
    document.body.classList.remove('app-locked');
});

for (const age of [HOUR, FOUR_HOURS_MS, FOUR_HOURS_MS + 1, 5 * HOUR]) {
    it('វគ្គក្រៅបណ្ដាញដែលផ្ទៀងផ្ទាត់ពេលរួច គោរពព្រំដែន ៤ ម៉ោង៖ ' + age, async () => {
        sample(); firebaseState.isDatabaseConnected = false;
        token.mockResolvedValue({ authTime: new Date(START - age).toISOString() });
        expect(await runSessionExpiryCheck()).toBe(age > FOUR_HOURS_MS);
        expect(signOut).toHaveBeenCalledTimes(age > FOUR_HOURS_MS ? 1 : 0);
    });
}

for (const shift of [-24 * HOUR, 0, 24 * HOUR]) {
    it('បើកក្រៅបណ្ដាញដោយគ្មានភស្តុតាងពេល មិនបញ្ចប់វគ្គ ឬអះអាងថាមានសុពលភាព៖ ' + shift, async () => {
        skew = shift;
        token.mockResolvedValue({ authTime: new Date(START - 5 * HOUR).toISOString() });
        armSessionExpiryCheck(firebaseState.auth.currentUser, firebaseState.authGeneration);
        await turn();
        expect(signOut).not.toHaveBeenCalled();
        expect(firebaseState.sessionExpiryCheck).toBe('unverified');
        sample();
        expect(await runSessionExpiryCheck()).toBe(true);
        expect(signOut).toHaveBeenCalledTimes(1);
    });
}

for (const shift of [-24 * HOUR, 24 * HOUR]) {
    it('នាឡិកាប្រែក្រោយផ្ទៀងផ្ទាត់ រង់ចាំភស្តុតាងថ្មីដោយមិនលុបវគ្គ៖ ' + shift, async () => {
        sample();
        skew = shift;
        expect(await runSessionExpiryCheck()).toBe(false);
        expect(firebaseState.sessionExpiryCheck).toBe('unverified');
        expect(signOut).not.toHaveBeenCalled();
        sample();
        expect(await runSessionExpiryCheck()).toBe(false);
        expect(firebaseState.sessionExpiryCheck).toBe('live');
    });
}

it('ភស្តុតាង authTime របស់វគ្គដដែល អាចបញ្ចប់វគ្គក្រៅបណ្ដាញទោះ refresh token បរាជ័យ', async () => {
    sample();
    expect(await runSessionExpiryCheck()).toBe(false);
    firebaseState.isDatabaseConnected = false;
    elapsed = 4 * HOUR;
    token.mockRejectedValue(new Error('offline'));
    expect(await runSessionExpiryCheck()).toBe(true);
    expect(signOut).toHaveBeenCalledTimes(1);
});

it('ភស្តុតាង authTime ចាស់ មិនជំនួសវគ្គថ្មី UID ដដែល', async () => {
    sample();
    expect(await runSessionExpiryCheck()).toBe(false);
    elapsed = 4 * HOUR;
    firebaseState.authGeneration++;
    token.mockRejectedValue(new Error('offline'));
    expect(await runSessionExpiryCheck()).toBe(false);
    expect(firebaseState.sessionExpiryCheck).toBe('unverified');
    expect(signOut).not.toHaveBeenCalled();
});

it('ខ្វះ token ដែលផ្ទៀងផ្ទាត់ មិនទុកសាលក្រម live ហើយអាចសាកម្ដងទៀត', async () => {
    sample(); token.mockRejectedValue(new Error('offline'));
    expect(await runSessionExpiryCheck()).toBe(false);
    expect(firebaseState.sessionExpiryCheck).toBe('unverified');
    expect(firebaseState.sessionExpiryCheckInFlight).toBe(false);
    token.mockResolvedValue({ authTime: new Date(START - HOUR).toISOString() });
    expect(await runSessionExpiryCheck()).toBe(false);
    expect(firebaseState.sessionExpiryCheck).toBe('live');
});

it('ផ្ទាំងផ្ទៀងផ្ទាត់បាំងទិន្នន័យ រក្សាភស្តុតាងរង់ចាំ ហើយ PIN មិនអាចរំលងបាន', async () => {
    firebaseState.sessionExpiryCheck = 'unverified';
    pendingHistoryPatches.set('kept', { id: 'kept' });
    pendingRegistryReleases.set('kept', { id: 'kept' });
    appLocalStore.setItem('zoew_login_time', 'kept');
    mount(<><AppLockScreen /><DocumentEffects /></>);
    expect(document.getElementById('appLockScreen')?.classList.contains('is-open')).toBe(true);
    expect(document.body.classList.contains('app-locked')).toBe(true);
    expect(document.querySelector('[data-session-verification]')).not.toBeNull();
    expect(focusTrapLayer()?.id).toBe('appLockScreen');
    step(() => { securityState.appIsLocked = false; viewState.appLockOpen = false; });
    expect(document.getElementById('appLockScreen')?.classList.contains('is-open')).toBe(true);
    expect(pendingHistoryPatches.has('kept')).toBe(true);
    expect(pendingRegistryReleases.has('kept')).toBe(true);
    expect(appLocalStore.getItem('zoew_login_time')).toBe('kept');
    step(sample);
    await runSessionExpiryCheck();
    step(() => {});
    expect(document.getElementById('appLockScreen')?.classList.contains('is-open')).toBe(false);
    expect(document.body.classList.contains('app-locked')).toBe(false);
});

it('ពេលមិនទាន់ផ្ទៀងផ្ទាត់ សកម្មភាព និង Android Back មិនបើកទិន្នន័យពីក្រោយផ្ទាំង', () => {
    firebaseState.sessionExpiryCheck = 'unverified';
    act('switchAppPage', 'data');
    expect(uiState.currentAppPage).toBe('entry');
    const minimize = vi.fn();
    handleNativeBack(minimize);
    expect(minimize).toHaveBeenCalledTimes(1);
    expect(uiState.currentAppPage).toBe('entry');
});

it('ស្តារគណនីចាប់ផ្ដើមផ្ទៀងផ្ទាត់វគ្គ មុនផ្លូវ License អាចរង់ចាំឬបដិសេធ', async () => {
    sample();
    vi.spyOn(license, 'proceedAfterLogin').mockResolvedValue(undefined);
    let notify = (_user) => {};
    firebaseState.fb.onAuthStateChanged = (_auth, callback) => { notify = callback; return () => {}; };
    setupAuthListener();
    notify(firebaseState.auth.currentUser);
    await turn();
    expect(token).toHaveBeenCalledTimes(1);
    expect(firebaseState.sessionExpiryCheck).toBe('live');
});

it('ផ្លូវចូល និង License arm ជាន់គ្នា ចែកសំណើផ្ទៀងផ្ទាត់វគ្គដដែល', async () => {
    sample();
    let resolve!: (value: any) => void;
    token.mockReturnValue(new Promise(yes => { resolve = yes; }));
    armSessionExpiryCheck(firebaseState.auth.currentUser, firebaseState.authGeneration);
    armSessionExpiryCheck(firebaseState.auth.currentUser, firebaseState.authGeneration);
    expect(token).toHaveBeenCalledTimes(1);
    resolve({ authTime: new Date(START - HOUR).toISOString() });
    await turn();
    expect(firebaseState.sessionExpiryCheck).toBe('live');
});

it('token គាំងត្រូវដោះ pending; ចម្លើយយឺតមិនបើកផ្ទាំង ហើយសំណើថ្មីអាចផ្ទៀងផ្ទាត់', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    sample();
    let resolve!: (value: any) => void;
    token.mockReturnValueOnce(new Promise(yes => { resolve = yes; }));
    armSessionExpiryCheck(firebaseState.auth.currentUser, firebaseState.authGeneration);
    await vi.advanceTimersByTimeAsync(DB_OP_TIMEOUT_MS + 1);
    expect(firebaseState.sessionExpiryCheck).toBe('unverified');
    resolve({ authTime: new Date(START - HOUR).toISOString() }); await turn();
    expect(firebaseState.sessionExpiryCheck).toBe('unverified');
    expect(await runSessionExpiryCheck()).toBe(false);
    expect(firebaseState.sessionExpiryCheck).toBe('live');
});

it('ភាពទុកចិត្តដែលបាត់មុនប្រើសាលក្រម មិនអនុញ្ញាតឲ្យ signOut', async () => {
    sample();
    let resolve!: (value: any) => void;
    token.mockReturnValueOnce(new Promise(yes => { resolve = yes; }));
    const check = runSessionExpiryCheck();
    let queued = false;
    vi.mocked(performance.now).mockImplementation(() => {
        if (!queued) { queued = true; queueMicrotask(() => { firebaseState.serverClockTrusted = false; }); }
        return 100 + elapsed;
    });
    resolve({ authTime: new Date(START - 5 * HOUR).toISOString() });
    expect(await check).toBe(false);
    expect(signOut).not.toHaveBeenCalled();
    expect(firebaseState.sessionExpiryCheck).toBe('unverified');
});

it('hardware និងចម្លើយកាមេរ៉ា/រូបភាព មិនចាប់ផ្ដើមការស្កេនពេលផ្ទៀងផ្ទាត់', () => {
    sample(); firebaseState.sessionExpiryCheck = 'unverified';
    const manual = vi.spyOn(dailyStats, 'submitManualBarcode').mockImplementation(() => {});
    scanState.pendingBarcode = 'kept';
    hardwareScannerKeyPress({ key: 'Enter', preventDefault: vi.fn() });
    processScannedCode('NEW-CAMERA');
    scanAction.triggerScanAction('NEW-IMAGE');
    expect(manual).not.toHaveBeenCalled();
    expect(scanState.pendingBarcode).toBe('kept');
});

it('ជួរស្កេនរង់ចាំផ្ទៀងផ្ទាត់ដោយមិនរំលង Barcode ហើយបន្តក្រោយសុពលភាពត្រឡប់', () => {
    sample(); firebaseState.sessionExpiryCheck = 'live';
    const trigger = vi.spyOn(scanAction, 'triggerScanAction').mockImplementation(barcode => {
        scanState.pendingBarcode = barcode;
        uiState.isModalOpen = true;
    });
    uiState.isModalOpen = true;
    expect(queueScannedCode('KEPT-BARCODE')).toBe(true);
    firebaseState.sessionExpiryCheck = 'unverified';
    uiState.isModalOpen = false;
    uiState.flush(); firebaseState.flush();
    expect(trigger).not.toHaveBeenCalled();
    firebaseState.sessionExpiryCheck = 'live'; firebaseState.flush();
    expect(trigger).toHaveBeenCalledExactlyOnceWith('KEPT-BARCODE');
});

it('ការបញ្ជា arm របស់វគ្គចាស់ មិនដាក់ទង់ pending លើវគ្គថ្មី', () => {
    sample(); firebaseState.sessionExpiryCheck = 'live';
    expect(armSessionExpiryCheck(firebaseState.auth.currentUser, firebaseState.authGeneration - 1)).toBe(false);
    expect(firebaseState.sessionExpiryCheck).toBe('live');
    expect(token).not.toHaveBeenCalled();
});


it.each(['live', 'expired'])('ព្រំដែនវគ្គមិនច្បាស់បិទការប្រើ រហូត sample ស្រស់ផ្ទៀងបាន %s', async expected => {
    token.mockResolvedValue({ authTime: new Date(START - FOUR_HOURS_MS + 500).toISOString() });
    firebaseState.isDatabaseConnected = true;
    expect(acceptServerClockOffset(0, Object.freeze({ epochMs: START, uncertaintyMs: 1000, monotonicMs: 100, wallMs: START }), false)).toBe(true);
    expect(await runSessionExpiryCheck()).toBe(false);
    expect(firebaseState.sessionExpiryCheck).toBe('unverified');
    expect(signOut).not.toHaveBeenCalled();
    const epochMs = expected === 'live' ? START : START + 1000;
    expect(acceptServerClockOffset(epochMs - START, Object.freeze({ epochMs, uncertaintyMs: 0, monotonicMs: 100, wallMs: START }), false)).toBe(true);
    expect(await runSessionExpiryCheck()).toBe(expected === 'expired');
    expect(firebaseState.sessionExpiryCheck).toBe(expected);
    expect(signOut).toHaveBeenCalledTimes(expected === 'expired' ? 1 : 0);
});

it('ផ្ទៀងផ្ទាត់វគ្គដដែលរួច មិនបើកផ្ទាំងឡើងវិញពេល License arm បន្ទាប់', async () => {
    sample();
    armSessionExpiryCheck(firebaseState.auth.currentUser, firebaseState.authGeneration);
    await turn();
    expect(firebaseState.sessionExpiryCheck).toBe('live');
    mount(<AppLockScreen />);
    let resolve!: (value: any) => void;
    token.mockReturnValueOnce(new Promise(yes => { resolve = yes; }));
    step(() => { armSessionExpiryCheck(firebaseState.auth.currentUser, firebaseState.authGeneration); });
    expect(firebaseState.sessionExpiryCheck).toBe('live');
    expect(document.getElementById('appLockScreen')?.classList.contains('is-open')).toBe(false);
    resolve({ authTime: new Date(START - HOUR).toISOString() });
    await turn();
});

it.each(['clock', 'generation', 'expired'])('arm មិនរក្សា live ពេលភស្តុតាងលែងមានសុពលភាព៖ %s', async reason => {
    sample();
    await runSessionExpiryCheck();
    if (reason === 'clock') skew = 24 * HOUR;
    if (reason === 'generation') firebaseState.authGeneration++;
    if (reason === 'expired') elapsed = 4 * HOUR;
    let resolve!: (value: any) => void;
    token.mockReturnValueOnce(new Promise(yes => { resolve = yes; }));
    armSessionExpiryCheck(firebaseState.auth.currentUser, firebaseState.authGeneration);
    expect(firebaseState.sessionExpiryCheck).toBe('pending');
    resolve({ authTime: new Date(START - HOUR).toISOString() });
    await turn();
    expect(firebaseState.sessionExpiryCheck).toBe(reason === 'clock' ? 'unverified' : reason === 'expired' ? 'expired' : 'live');
});

it.each(['auth', 'user', 'sdk', 'database', 'scope', 'generation'])('ចម្លើយ arm ចាស់មិនប្ដូរសាលក្រមវគ្គថ្មីក្រោយប្ដូរ %s', async boundary => {
    sample();
    await runSessionExpiryCheck();
    let oldReply!: (value: any) => void;
    token.mockReturnValueOnce(new Promise(yes => { oldReply = yes; }));
    armSessionExpiryCheck(firebaseState.auth.currentUser, firebaseState.authGeneration);
    expect(firebaseState.sessionExpiryCheck).toBe('live');
    if (boundary === 'auth') firebaseState.auth = { currentUser: firebaseState.auth.currentUser };
    if (boundary === 'user') firebaseState.auth.currentUser = { uid: 'clock-policy' };
    if (boundary === 'sdk') firebaseState.fb = { ...firebaseState.fb };
    if (boundary === 'database') firebaseState.db = {};
    if (boundary === 'scope') firebaseState.firebaseConfig = { databaseURL: 'https://new-clock-policy.invalid' };
    if (boundary === 'generation') firebaseState.authGeneration++;
    let newReply!: (value: any) => void;
    token.mockReturnValueOnce(new Promise(yes => { newReply = yes; }));
    armSessionExpiryCheck(firebaseState.auth.currentUser, firebaseState.authGeneration);
    expect(firebaseState.sessionExpiryCheck).toBe('pending');
    sample();
    newReply({ authTime: new Date(START - HOUR).toISOString() });
    await turn();
    expect(firebaseState.sessionExpiryCheck).toBe('live');
    oldReply({ authTime: new Date(START - 5 * HOUR).toISOString() });
    await turn();
    expect(firebaseState.sessionExpiryCheck).toBe('live');
    expect(signOut).not.toHaveBeenCalled();
});

it.each([true, false])('arm និង periodic ជាន់គ្នាមិនបើកផ្ទាំង និងគោរពផុតកំណត់៖ arm ចប់មុន %s', async armFirst => {
    sample();
    await runSessionExpiryCheck();
    let armReply!: (value: any) => void;
    let periodicReply!: (value: any) => void;
    token.mockReturnValueOnce(new Promise(yes => { armReply = yes; }));
    armSessionExpiryCheck(firebaseState.auth.currentUser, firebaseState.authGeneration);
    token.mockReturnValueOnce(new Promise(yes => { periodicReply = yes; }));
    const periodic = runSessionExpiryCheck();
    expect(firebaseState.sessionExpiryCheck).toBe('live');
    const reply = { authTime: new Date(START - HOUR).toISOString() };
    (armFirst ? armReply : periodicReply)(reply);
    await turn();
    expect(firebaseState.sessionExpiryCheck).toBe('live');
    elapsed = 4 * HOUR;
    (armFirst ? periodicReply : armReply)(reply);
    await periodic;
    await turn();
    expect(firebaseState.sessionExpiryCheck).toBe('expired');
    expect(signOut).toHaveBeenCalledTimes(1);
});
