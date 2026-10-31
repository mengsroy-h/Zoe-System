// វាស់វដ្ត listener ក្រោម license សកម្មក្លែង៖ មិនផ្ទៀងហត្ថលេខា license ឬ socket ពិតទេ។
import fs from 'node:fs';
import vm from 'node:vm';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { firebaseState } from '../src/core/state';
import { viewState } from '../src/core/view-state';
import { initFirebase } from '../src/services/firebase-init';
import { setupAuthListener } from '../src/features/auth';
import { proceedAfterLogin } from '../src/features/license';
import { dbListenersBelongToSession, detachDatabaseListeners, initDatabaseListeners, resetDbListenerHealthState } from '../src/services/db-listeners';
const source = fs.readFileSync('../audit-tools/listener-leak-test.js', 'utf8');
let fixture: any, checker: any;
const fields = ['dbRefExchangeRate', 'dbRefDailyRevenue', 'dbRefMonthlyRevenue', 'dbRefDailyPickup', 'dbRefDailyCollected', 'dbRefHistory', 'dbRefDeleted'];
beforeEach(() => {
    vi.useFakeTimers(); localStorage.clear();
    const context: any = vm.createContext({ window: { dispatchEvent() {} }, Event, setTimeout });
    vm.runInContext(source.slice(source.indexOf('const FAKE_SDK = function'), source.indexOf('async function boot(')) +
        '\nFAKE_SDK(); globalThis.checker = { TEST_LICENSE, REQUIRED_DATA_PATHS, dataCoverageComplete, requireDataCoverage };', context);
    fixture = context.window; checker = context.checker;
    vm.runInContext(checker.TEST_LICENSE, context);
    vi.stubGlobal('ZoeLicense', fixture.ZoeLicense);
    fixture.__setUser({ uid: 'u1', email: 'a@b.c' });
    const sdk = fixture.firebaseSDK;
    firebaseState.authGeneration++;
    Object.assign(firebaseState, { fb: sdk, db: sdk.getDatabase(), auth: sdk.getAuth(), isDatabaseInitialized: false, isDatabaseConnected: true });
    checker.REQUIRED_DATA_PATHS.forEach((path: string, i: number) => { (firebaseState as any)[fields[i]] = sdk.ref(firebaseState.db, path); });
    viewState.backendKind = 'firebase';
    resetDbListenerHealthState();
});
afterEach(() => {
    firebaseState.authUnsubscribe?.(); firebaseState.authUnsubscribe = null;
    detachDatabaseListeners(); resetDbListenerHealthState(); firebaseState.authGeneration++;
    vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); localStorage.clear();
});
function snapshot() {
    return { fb: fixture.__fbLive(), currentUser: firebaseState.auth.currentUser?.uid === 'u1',
        currentSession: dbListenersBelongToSession(), licenseChecks: fixture.__leakLicenseChecks };
}
it('license សកម្ម ➜ proceedAfterLogin ពិតភ្ជាប់ផ្លូវទាំង ៧ ហើយវដ្តមិនកកកុញ', async () => {
    await proceedAfterLogin(firebaseState.auth.currentUser, firebaseState.authGeneration);
    expect(checker.dataCoverageComplete(snapshot())).toBe(true);
    for (let i = 0; i < 3; i++) {
        detachDatabaseListeners(); firebaseState.authGeneration++; firebaseState.isDatabaseInitialized = false;
        expect(checker.dataCoverageComplete(snapshot())).toBe(false);
        await proceedAfterLogin(firebaseState.auth.currentUser, firebaseState.authGeneration);
        expect(checker.dataCoverageComplete(snapshot())).toBe(true);
    }
    expect(fixture.__leakLicenseChecks).toBe(4);
});
it('license មិនសកម្ម៖ zero attach មិនអាចឆ្លងជាន់អប្បបរមា', async () => {
    fixture.ZoeLicense.getStatus = async () => { fixture.__leakLicenseChecks++; return { state: 'required' }; };
    await proceedAfterLogin(firebaseState.auth.currentUser, firebaseState.authGeneration);
    expect(fixture.__fbLive()).toEqual({});
    expect(checker.dataCoverageComplete(snapshot())).toBe(false);
});
it('license ឆ្លើយយឺតក្រោយ auth ប្តូរ៖ session guard ពិតរារាំង attach', async () => {
    let resolve!: (value: any) => void;
    fixture.ZoeLicense.getStatus = () => { fixture.__leakLicenseChecks++; return new Promise(r => { resolve = r; }); };
    const pending = proceedAfterLogin(firebaseState.auth.currentUser, firebaseState.authGeneration);
    firebaseState.authGeneration++; resolve({ state: 'active' }); await pending;
    expect(fixture.__fbLive()).toEqual({}); expect(checker.dataCoverageComplete(snapshot())).toBe(false);
});
it('ផ្លូវខ្វះ និង duplicate listener ត្រូវបានចាប់ដោយឈ្មោះមិនមែនចំនួនសរុប', async () => {
    await proceedAfterLogin(firebaseState.auth.currentUser, firebaseState.authGeneration);
    const sdk = fixture.firebaseSDK, path = checker.REQUIRED_DATA_PATHS[0];
    sdk.off(sdk.ref(firebaseState.db, path));
    sdk.onValue(sdk.ref(firebaseState.db, 'irrelevant'), () => {});
    expect(Object.keys(fixture.__fbLive())).toHaveLength(7);
    expect(checker.dataCoverageComplete(snapshot())).toBe(false);
    sdk.onValue(sdk.ref(firebaseState.db, path), () => {});
    expect(checker.dataCoverageComplete(snapshot())).toBe(true);
    sdk.onValue(sdk.ref(firebaseState.db, path), () => {});
    expect(checker.dataCoverageComplete(snapshot())).toBe(false);
});
it('mutant off មិនដក listener៖ reconnect ពិតធ្វើឱ្យជាន់អប្បបរមាធ្លាក់', async () => {
    await proceedAfterLogin(firebaseState.auth.currentUser, firebaseState.authGeneration);
    expect(checker.dataCoverageComplete(snapshot())).toBe(true);
    const off = firebaseState.fb.off; firebaseState.fb.off = () => {};
    initDatabaseListeners();
    expect(checker.REQUIRED_DATA_PATHS.every((path: string) => fixture.__fbLive()[path] === 2)).toBe(true);
    expect(checker.dataCoverageComplete(snapshot())).toBe(false);
    firebaseState.fb.off = off;
});
it('current auth និង current ownership ជាលក្ខខណ្ឌចាំបាច់ទោះមាន listeners', async () => {
    await proceedAfterLogin(firebaseState.auth.currentUser, firebaseState.authGeneration);
    fixture.__setUser(null); expect(checker.dataCoverageComplete(snapshot())).toBe(false);
    fixture.__setUser({ uid: 'u1' }); firebaseState.authGeneration++;
    expect(checker.dataCoverageComplete(snapshot())).toBe(false);
});
it('bounded coverage waiter បរាជ័យលើ zero/partial/duplicate ឬ license check ចាស់', async () => {
    await proceedAfterLogin(firebaseState.auth.currentUser, firebaseState.authGeneration);
    const good = snapshot();
    for (const [snap, prior, expected] of [
        [good, 0, true], [good, good.licenseChecks, false],
        [{ ...good, fb: {} }, 0, false],
        [{ ...good, fb: { ...good.fb, [checker.REQUIRED_DATA_PATHS[0]]: 0 } }, 0, false],
        [{ ...good, fb: { ...good.fb, [checker.REQUIRED_DATA_PATHS[0]]: 2 } }, 0, false]
    ] as any[]) {
        let now = 0; const results: boolean[] = [];
        const context: any = vm.createContext({ Date: { now: () => now }, snap: async () => snap, check: (ok: boolean) => results.push(ok) });
        vm.runInContext(source.slice(source.indexOf('const REQUIRED_DATA_PATHS'), source.indexOf('async function boot(')) + '\nglobalThis.run = requireDataCoverage;', context);
        await context.run({ waitForTimeout: async (ms: number) => { now += ms; } }, 'fixture', prior);
        expect(results).toEqual([expected]); expect(now <= 8000).toBe(true);
    }
});

it('auth callback ពិត៖ logout ដកទាំងអស់ ហើយ login ថ្មីផ្ទៀង license និងភ្ជាប់ទាំង ៧', async () => {
    setupAuthListener();
    await vi.advanceTimersByTimeAsync(5);
    expect(checker.dataCoverageComplete(snapshot())).toBe(true);
    const initial = fixture.__leakLicenseChecks;
    for (let i = 0; i < 3; i++) {
        fixture.__setUser(null);
        expect(fixture.__fbLive()).toEqual({});
        expect(checker.dataCoverageComplete(snapshot())).toBe(false);
        fixture.__setUser({ uid: 'u1', email: 'a@b.c' });
        await vi.advanceTimersByTimeAsync(5);
        expect(checker.dataCoverageComplete(snapshot())).toBe(true);
        expect(fixture.__leakLicenseChecks).toBe(initial + i + 1);
    }
});

it('initFirebase ពិតបីវដ្ត៖ license/current auth និង data paths នៅពេញលេញ', async () => {
    localStorage.setItem('zoew_firebase_config', JSON.stringify({ apiKey: 'k', databaseURL: 'https://x.firebaseio.com', projectId: 'p' }));
    vi.stubGlobal('firebaseSDK', fixture.firebaseSDK);
    firebaseState.isInitializingFirebase = false;
    for (let i = 0; i < 3; i++) {
        expect(await initFirebase()).toBe(true);
        await vi.advanceTimersByTimeAsync(10);
        expect(checker.dataCoverageComplete(snapshot())).toBe(true);
        expect(fixture.__leakLicenseChecks).toBe(i + 1);
    }
});
