import { dataState, firebaseState, uiState } from '../core/state';
import { viewState } from '../core/view-state';
import { pendingHistoryPatches, pendingRegistryReleases } from '../core/clock';
import { appLocalStore, safeStoreGet } from '../core/storage';
import { setupAuthListener } from '../features/auth';
import { clearCustomerDataTableCache } from '../features/customer-table';
import { refreshShopBoundUi } from '../features/lookup-config';
import { noteShopDevice } from '../features/shop-device';
import { resetZtoFinalMarks } from '../features/zto-final-marks';
import { clearZtoPickupStatusStore } from '../features/zto-status';
import { ZTO_SHOP_SWEEP_PATH } from './zto-shop-sweep';
import { ZTO_TRASH_MODE_PATH } from './zto-trash-mode';
import { ZTO_SWEEP_LANE_PATH } from './zto-sweep-lane';
import { checkPinAndOpenConfig } from '../features/config';
import { clearSensitiveModalFields, endScanFlow } from '../features/session';
import { applyCurrentFilter } from '../features/monthly-report';
import { renderRecentlyDeleted } from '../features/trash';
import { attachInfoListeners, detachInfoListeners, renderConnectionStatus } from './connection';
import { detachDatabaseListeners, initDatabaseListeners, resetDbListenerHealthState, updateRecentPhonesList } from './db-listeners';
import { FIREBASE_SDK_REFRESH_TEXT, armLateFirebaseSdkListener, firebaseSdkNeedsRefresh, resetFirebaseSdkRetryHealth, scheduleFirebaseSdkRetry } from './firebase-sdk';
import { preconnectToDatabaseHost, waitForFirebaseSDK } from './network';
import { noteTxOutcomeUnknown, withTransactionOutcomeResolution } from './tx-outcome';
import { isSupabaseConfig } from './supabase-config';
import { showToast } from '../ui/toast';
import { withConnectionOwnership } from './connection-flow';
import { ledgerCompanionCopyState, ledgerCompanionState, ledgerJournalUpdate, ledgerJournalWitness } from '../domain/ledger';

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
        onTenantChanged: (before, after) => {
            if (before && after && before !== after) {
                firebaseState.authGeneration++;
                const initialized = firebaseState.isDatabaseInitialized;
                detachDatabaseListeners();
                resetDbListenerHealthState();
                firebaseState.isDatabaseInitialized = false;
                dataState.scanHistory = [];
                dataState.deletedItems = [];
                dataState.dailyRevenueData = {};
                dataState.monthlyRevenueData = {};
                dataState.dailyPickupData = {};
                dataState.dailyCollectedData = {};
                uiState.lockerBarcodeIndex = {};
                clearCustomerDataTableCache();
                clearSensitiveModalFields();
                applyCurrentFilter();
                renderRecentlyDeleted();
                updateRecentPhonesList();
                if (initialized && firebaseState.db && firebaseState.fb) initDatabaseListeners();
            }
            refreshShopBoundUi();
            noteShopDevice();
        },
        onSessionEnded: (message) => {
            showToast('⚠️ ' + message);
        },
        onClockSkew: (message) => {
            showToast('⚠️ ' + message);
        },
        onTxOutcomeUnknown: (segs, scope) => {
            noteTxOutcomeUnknown(scope, '/' + (Array.isArray(segs) ? segs.join('/') : String(segs || '')), 'supabaseTransaction');
        },
        onWriteRecovery: () => renderConnectionStatus(),
        ledgerCompanion: { state: ledgerCompanionState, copy: ledgerCompanionCopyState, witness: ledgerJournalWitness, update: ledgerJournalUpdate }
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

async function tearDownBackend(existingApps) {
    if (firebaseState.authUnsubscribe) {
        try { firebaseState.authUnsubscribe(); } catch (e) {}
        firebaseState.authUnsubscribe = null;
    }
    if (firebaseState.authRecoveryTimeout) {
        clearTimeout(firebaseState.authRecoveryTimeout);
        firebaseState.authRecoveryTimeout = null;
    }
    firebaseState.authGeneration++;
    endScanFlow();
    pendingRegistryReleases.clear();
    dataState.registryReleaseFlushInFlight = false;
    clearCustomerDataTableCache();
    clearZtoPickupStatusStore();
    resetZtoFinalMarks();
    pendingHistoryPatches.clear();
    dataState.historyPatchFlushInFlight = false;
    dataState.exchangeRateSaveInFlight = false;
    detachDatabaseListeners();
    detachInfoListeners();
    firebaseState.isDatabaseInitialized = false;
    firebaseState.isDatabaseConnected = false;
    firebaseState.hasEverConnectedToDatabase = false;
    firebaseState.serverClockTrusted = false;
    firebaseState.serverTimeOffsetMs = 0;
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
    applyCurrentFilter();
    renderRecentlyDeleted();
    updateRecentPhonesList();
    await Promise.all(existingApps.map(([owner, a]) => (typeof owner.deleteApp === 'function' ? owner.deleteApp(a).catch(() => {}) : null)));
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
        if (previousFb && !!previousFb.__supabase !== useSupabase && typeof previousFb.getApps === 'function') {
            const previousApps = previousFb.getApps().map((a) => [previousFb, a]);
            if (previousApps.length) await tearDownBackend(previousApps);
        }
        let nextFb;
        if (useSupabase) {
            nextFb = withConnectionOwnership(await loadSupabaseFb());
        } else {
            preconnectToDatabaseHost(firebaseState.firebaseConfig);
            nextFb = withTransactionOutcomeResolution(await waitForFirebaseSDK());
        }
        viewState.backendKind = useSupabase ? 'supabase' : 'firebase';
        firebaseState.firebaseSdkUnavailable = false;
        firebaseState.sdkUnavailableNoticeShown = false;
        resetFirebaseSdkRetryHealth();

        const staleApps = nextFb.getApps().map((a) => [nextFb, a]);
        if (staleApps.length) await tearDownBackend(staleApps);
        firebaseState.fb = nextFb;
        if (typeof nextFb.setConnectionFlowReporter === 'function') nextFb.setConnectionFlowReporter(renderConnectionStatus);

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
        firebaseState.dbRefZtoTrashMode = firebaseState.fb.ref(firebaseState.db, ZTO_TRASH_MODE_PATH);
        firebaseState.dbRefZtoSweepLane = firebaseState.fb.ref(firebaseState.db, ZTO_SWEEP_LANE_PATH);
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
                showToast(firebaseSdkNeedsRefresh() ? FIREBASE_SDK_REFRESH_TEXT : '⚠️ ភ្ជាប់ Server មិនបានទេ — សូមពិនិត្យបណ្តាញ។ កំពុងព្យាយាមម្តងទៀត...');
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
