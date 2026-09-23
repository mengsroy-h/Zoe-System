import { dataState, firebaseState, uiState } from '../core/state';
import { pendingHistoryPatches } from '../core/clock';
import { appLocalStore, safeStoreGet } from '../core/storage';
import { setupAuthListener } from '../features/auth';
import { checkPinAndOpenConfig } from '../features/config';
import { attachInfoListeners, detachInfoListeners, renderConnectionStatus } from './connection';
import { detachDatabaseListeners, resetDbListenerHealthState } from './db-listeners';
import { armLateFirebaseSdkListener, resetFirebaseSdkRetryHealth, scheduleFirebaseSdkRetry } from './firebase-sdk';
import { preconnectToDatabaseHost, waitForFirebaseSDK } from './network';
import { showToast } from '../ui/toast';

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
        preconnectToDatabaseHost(firebaseState.firebaseConfig);
        firebaseState.fb = await waitForFirebaseSDK();
        firebaseState.firebaseSdkUnavailable = false;
        firebaseState.sdkUnavailableNoticeShown = false;
        resetFirebaseSdkRetryHealth();

        const existingApps = firebaseState.fb.getApps();
        if (existingApps.length) {
            firebaseState.authGeneration++;
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
            if (typeof firebaseState.fb.deleteApp === 'function') {
                await Promise.all(existingApps.map(a => firebaseState.fb.deleteApp(a).catch(() => {})));
            }
        }

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
