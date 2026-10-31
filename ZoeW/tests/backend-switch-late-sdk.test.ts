// Deep audit ៩ (network N2 · N3) ៖ a backend switch while signed in, whose new SDK arrives late (or fails), must not wedge the app ៖
//  N2 ➜ the old backend stayed live, every SDK retry door returned early on `isDatabaseInitialized` (the OLD session) so the late SDK
//       was ignored, and the navbar said «ភ្ជាប់ Server រួចរាល់» while the phase was `unavailable` (every write refused).
//  N3 ➜ the Config live toast read the old backend's connection at save time and showed a settled ✅ for a shop that never connected.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { firebaseState, uiState } from '../src/core/state';
import { viewState } from '../src/core/view-state';
import { appLocalStore } from '../src/core/storage';
import { initFirebase } from '../src/services/firebase-init';
import { connectionFlowSnapshot } from '../src/services/connection-flow';
import { renderConnectionStatus } from '../src/services/connection';
import { showLiveToast } from '../src/ui/toast';
function fakeSdk(name: string, supabase: boolean) {
    let apps: any[] = [];
    const sdk: any = { getApps: () => apps, deleteApp: async () => { apps = []; },
        initializeApp: () => { const a = { name, options: {} }; apps.push(a); return a; },
        getAuth: (app: any) => ({ app, currentUser: null, owner: name }), getDatabase: (app: any) => ({ app, name }),
        goOnline() {}, goOffline() {}, off: () => {},
        ref: (db: any, path: string) => ({ owner: name, db, path: path || '', toString: () => 'https://' + name + '.firebaseio.com/' + (path || '') }),
        onValue: () => () => {}, onAuthStateChanged: () => () => {} };
    if (supabase) sdk.__supabase = true;
    return { sdk, seedApp: () => { apps = [{ name, options: {} }]; } };
}
const flush = async () => { for (let i = 0; i < 40; i++) await Promise.resolve(); };
beforeEach(() => { vi.useFakeTimers(); firebaseState.authGeneration++; firebaseState.isInitializingFirebase = false;
    firebaseState.firebaseSdkUnavailable = false; firebaseState.firebaseSdkRetryTimer = null; firebaseState.lateFirebaseSdkListenerArmed = false;
    delete (window as any).firebaseSDK; (window as any).loadFirebaseSDK = () => {}; });
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); delete (window as any).firebaseSDK; delete (window as any).loadFirebaseSDK; appLocalStore.clear(); });
describe('backend switch whose new SDK is late while the old shop is signed in', () => {
    it('the switch completes once the SDK arrives, and nothing says "connected" while writes are refused', async () => {
        const old = fakeSdk('sb-old', true); old.seedApp();
        firebaseState.fb = old.sdk; firebaseState.db = { name: 'old' } as any; firebaseState.auth = { currentUser: { uid: 'u1' } } as any;
        Object.assign(firebaseState, { isDatabaseInitialized: true, isDatabaseConnected: true, hasEverConnectedToDatabase: true, dbListenersFailed: false, sessionExpiryCheck: 'live', authLoginOperation: null });
        appLocalStore.setItem('zoew_firebase_config', JSON.stringify({ apiKey: 'test', databaseURL: 'https://next.firebaseio.com' }));
        uiState.toasts = [];
        const run = initFirebase(); showLiveToast('config'); // same order as saveFirebaseConfig()
        const configToast = uiState.toasts.map((t: any) => t.msg)[0];
        await vi.advanceTimersByTimeAsync(15000);
        expect(await run).toBe(false);
        expect(firebaseState.firebaseSdkUnavailable, 'precondition').toBe(true);
        renderConnectionStatus();
        const visible = { status: viewState.connectionStatus, phase: connectionFlowSnapshot().phase, canWrite: connectionFlowSnapshot().canWrite };
        (window as any).firebaseSDK = fakeSdk('fb-new', false).sdk; window.dispatchEvent(new Event('firebasesdkready'));
        await flush(); await vi.advanceTimersByTimeAsync(60000); await flush();
        expect({ configToastIsSuccess: /^✅/.test(configToast), visible, switched: firebaseState.fb !== old.sdk, stillUnavailable: firebaseState.firebaseSdkUnavailable })
            .toEqual({ configToastIsSuccess: false, visible: { status: 'offline', phase: 'unavailable', canWrite: false }, switched: true, stillUnavailable: false });
    });
    it('control ៖ old shop NOT initialized ➜ the late listener completes the switch', async () => {
        const old = fakeSdk('sb-old', true); old.seedApp();
        firebaseState.fb = old.sdk; firebaseState.db = { name: 'old' } as any; firebaseState.auth = { currentUser: null } as any; firebaseState.isDatabaseInitialized = false;
        appLocalStore.setItem('zoew_firebase_config', JSON.stringify({ apiKey: 'test', databaseURL: 'https://next.firebaseio.com' }));
        const run = initFirebase(); await vi.advanceTimersByTimeAsync(15000); expect(await run).toBe(false);
        (window as any).firebaseSDK = fakeSdk('fb-new', false).sdk; window.dispatchEvent(new Event('firebasesdkready')); await flush();
        expect({ switched: firebaseState.fb !== old.sdk, unavailable: firebaseState.firebaseSdkUnavailable }).toEqual({ switched: true, unavailable: false });
    });
    it('same-kind shop switch ៖ Config toast is not ✅ before B ever connects', async () => {
        const one = fakeSdk('fb', false); one.seedApp(); (window as any).firebaseSDK = one.sdk;
        firebaseState.fb = one.sdk; firebaseState.db = { name: 'A' } as any; firebaseState.auth = { currentUser: { uid: 'u1' } } as any;
        firebaseState.isDatabaseConnected = true; firebaseState.isDatabaseInitialized = true; uiState.toasts = [];
        appLocalStore.setItem('zoew_firebase_config', JSON.stringify({ apiKey: 'test', databaseURL: 'https://typo-shop-b.firebaseio.com' }));
        const run = initFirebase(); showLiveToast('config'); const first = uiState.toasts.map((t: any) => t.msg)[0];
        await run;
        expect({ first: /^✅/.test(first), connectedNow: firebaseState.isDatabaseConnected }).toEqual({ first: false, connectedNow: false });
    });
});
