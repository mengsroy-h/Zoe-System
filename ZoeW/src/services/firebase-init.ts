import { dataState, firebaseState, uiState } from '../core/state';
import { viewState } from '../core/view-state';
import { pendingHistoryPatches, pendingRegistryReleases } from '../core/clock';
import { appLocalStore, safeStoreGet } from '../core/storage';
import { setupAuthListener } from '../features/auth';
import { clearCustomerDataTableCache } from '../features/customer-table';
import { clearZtoPickupStatusStore } from '../features/zto-status';
import { ZTO_SHOP_SWEEP_PATH } from './zto-shop-sweep';
import { checkPinAndOpenConfig } from '../features/config';
import { attachInfoListeners, detachInfoListeners, renderConnectionStatus } from './connection';
import { detachDatabaseListeners, resetDbListenerHealthState } from './db-listeners';
import { armLateFirebaseSdkListener, resetFirebaseSdkRetryHealth, scheduleFirebaseSdkRetry } from './firebase-sdk';
import { preconnectToDatabaseHost, waitForFirebaseSDK } from './network';
import { txOutcomeUnknownReported, withTransactionOutcomeResolution } from './tx-outcome';
import { isSupabaseConfig } from './supabase-config';
import { showToast } from '../ui/toast';

let supabaseSdkPromise = null;

function supabaseEnv() {
    return {
        onListenerError: (e) => {
            console.error(e);
            if (window.ZoeErrors) ZoeErrors.capture(e, { context: 'Supabase listener callback' });
        },
        onAccountBlocked: (message) => {
            showToast('⚠️ ' + message);
        },
        onSessionEnded: (message) => {
            showToast('⚠️ ' + message);
        },
        onClockSkew: (message) => {
            showToast('⚠️ ' + message);
        },
        onTxOutcomeUnknown: (segs) => {
            const path = '/' + (Array.isArray(segs) ? segs.join('/') : '');
            if (txOutcomeUnknownReported.has(path)) return;
            txOutcomeUnknownReported.add(path);
            if (window.ZoeErrors) ZoeErrors.capture(new Error('Transaction outcome unknown after disconnect'), { zone: 'money', context: 'supabaseTransaction', path });
        }
    };
}

export function loadSupabaseFb() {
    if (!supabaseSdkPromise) {
        supabaseSdkPromise = import('./supabase-backend').then((m) => m.createZoeSupabaseSdk(supabaseEnv()), (e) => {
            supabaseSdkPromise = null;
            const err: any = new Error('Supabase SDK is not ready');
            err.code = 'SDK_UNAVAILABLE';
            err.cause = e;
            throw err;
        });
    }
    return supabaseSdkPromise;
}

export async function initFirebase() {
    const savedConfig = safeStoreGet(appLocalStore, 'zoew_firebase_config');
    if (!savedConfig) {
        checkPinAndOpenConfig(true);
        return false;
    }

    if (firebaseState.isInitializingFirebase) return false;
    firebaseState.isInitializingFirebase = true;

    try {
        firebaseState.firebaseConfig = JSON.parse(savedConfig);
        const useSupabase = isSupabaseConfig(firebaseState.firebaseConfig);
        const previousFb = firebaseState.fb;
        let nextFb;
        if (useSupabase) {
            nextFb = await loadSupabaseFb();
        } else {
            preconnectToDatabaseHost(firebaseState.firebaseConfig);
            nextFb = withTransactionOutcomeResolution(await waitForFirebaseSDK());
        }
        viewState.backendKind = useSupabase ? 'supabase' : 'firebase';
        firebaseState.firebaseSdkUnavailable = false;
        firebaseState.sdkUnavailableNoticeShown = false;
        resetFirebaseSdkRetryHealth();

        const staleApps = [];
        if (previousFb && !!previousFb.__supabase !== useSupabase && typeof previousFb.getApps === 'function') {
            previousFb.getApps().forEach((a) => staleApps.push([previousFb, a]));
        }
        nextFb.getApps().forEach((a) => staleApps.push([nextFb, a]));
        const existingApps = staleApps;
        if (existingApps.length) {
            if (firebaseState.authUnsubscribe) {
                try { firebaseState.authUnsubscribe(); } catch (e) {}
                firebaseState.authUnsubscribe = null;
            }
            if (firebaseState.authRecoveryTimeout) {
                clearTimeout(firebaseState.authRecoveryTimeout);
                firebaseState.authRecoveryTimeout = null;
            }
            firebaseState.authGeneration++;
            viewState.phoneModalBusy = false;
            pendingRegistryReleases.clear();
            dataState.registryReleaseFlushInFlight = false;
            clearCustomerDataTableCache();
            clearZtoPickupStatusStore();
            pendingHistoryPatches.clear();
            dataState.historyPatchFlushInFlight = false;
            detachDatabaseListeners();
            detachInfoListeners();
            firebaseState.isDatabaseInitialized = false;
            firebaseState.isDatabaseConnected = false;
            firebaseState.hasEverConnectedToDatabase = false;
            firebaseState.networkJustReturned = false;
            resetDbListenerHealthState();
            renderConnectionStatus();
            dataState.scanHistory = [];
            dataState.deletedItems = [];
            dataState.dailyRevenueData = {};
            dataState.monthlyRevenueData = {};
            dataState.dailyPickupData = {};
            dataState.dailyCollectedData = {};
            uiState.lockerBarcodeIndex = {};
            await Promise.all(existingApps.map(([owner, a]) => (typeof owner.deleteApp === 'function' ? owner.deleteApp(a).catch(() => {}) : null)));
        }
        firebaseState.fb = nextFb;

        const firebaseApp = firebaseState.fb.getApps().length ? firebaseState.fb.getApps()[0] : firebaseState.fb.initializeApp(firebaseState.firebaseConfig);
        firebaseState.auth = firebaseState.fb.getAuth(firebaseApp);
        firebaseState.db = firebaseState.fb.getDatabase(firebaseApp);

        try {
            firebaseState.fb.goOnline(firebaseState.db);
        } catch(e) {}

        firebaseState.dbRefHistory = firebaseState.fb.ref(firebaseState.db, 'zoew_scan_history_cod_dod');
        firebaseState.dbRefDeleted = firebaseState.fb.ref(firebaseState.db, 'zoew_recently_deleted_cod_dod');
        firebaseState.dbRefDailyRevenue = firebaseState.fb.ref(firebaseState.db, 'zoew_daily_revenue_cod_dod');
        firebaseState.dbRefMonthlyRevenue = firebaseState.fb.ref(firebaseState.db, 'zoew_monthly_revenue_cod_dod');
        firebaseState.dbRefDailyPickup = firebaseState.fb.ref(firebaseState.db, 'zoew_daily_pickup_cod_dod');
        firebaseState.dbRefDailyCollected = firebaseState.fb.ref(firebaseState.db, 'zoew_daily_collected_cod_dod');
        firebaseState.dbRefExchangeRate = firebaseState.fb.ref(firebaseState.db, 'zoew_settings/exchange_rate');
        firebaseState.dbRefZtoSignedSweep = firebaseState.fb.ref(firebaseState.db, ZTO_SHOP_SWEEP_PATH);
        firebaseState.dbRefConnected = firebaseState.fb.ref(firebaseState.db, '.info/connected');
        firebaseState.dbRefServerTimeOffset = firebaseState.fb.ref(firebaseState.db, '.info/serverTimeOffset');
        attachInfoListeners();

        setupAuthListener();
        return true;
    } catch (e) {
        if (e && e.code === 'SDK_UNAVAILABLE') {
            firebaseState.firebaseSdkUnavailable = true;
            armLateFirebaseSdkListener();
            renderConnectionStatus();
            if (!firebaseState.sdkUnavailableNoticeShown) {
                firebaseState.sdkUnavailableNoticeShown = true;
                showToast('⚠️ ភ្ជាប់ Server មិនបានទេ — សូមពិនិត្យបណ្តាញ។ កំពុងព្យាយាមម្តងទៀត...');
            }
            scheduleFirebaseSdkRetry();
            return false;
        }
        console.error("Invalid Saved Config", e);
        if (window.ZoeErrors) ZoeErrors.capture(e, { context: "Invalid Saved Config" });
        checkPinAndOpenConfig(true);
        return false;
    } finally {
        firebaseState.isInitializingFirebase = false;
        let currentConfig = savedConfig;
        try { currentConfig = appLocalStore.getItem('zoew_firebase_config'); } catch (e) {}
        if (currentConfig !== savedConfig) initFirebase();
    }
}
