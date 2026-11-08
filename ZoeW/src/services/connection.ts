import { viewState } from '../core/view-state';
import { documentIsHidden, onDocumentVisibilityChange } from '../platform/document-io';
import { dataState, firebaseState, ztoState } from '../core/state';
import { acceptServerClockOffset, serverClockIsTrustworthy, setServerClockRefresh } from '../core/clock';
import { elapsedSince } from '../core/elapsed';
import { CLEANUP_JOURNAL_KEY, CLEANUP_LEGACY_JOURNAL_KEY, PICKUP_JOURNAL_KEY } from '../core/storage-keys';
import { flushPendingRegistryReleases } from '../domain/registry';
import { resumeZtoStatusSweep } from '../features/zto-status';
import { retryFailedDbListenersNow } from './db-listeners';
import { firebaseSdkNeedsRefresh, followStoredFirebaseConfig, retryFirebaseSdkNow } from './firebase-sdk';
import { flushPendingHistoryPatches } from './history-write';
import { noteConnectionTransition, refreshLiveToasts } from '../ui/toast';
import { dbListenerPendingPaths } from '../core/text';
import { resumePendingScanOperations } from './scan-operation';
import { resumePriceOperations } from './price-operation';
import { runSessionExpiryCheck } from '../features/session';
import { retryPendingActivation } from '../features/license';
import { connectionFlowSnapshot } from './connection-flow';
import { watchFirebaseWebsocket, firebaseWebsocketIsBlocked, FIREBASE_WEBSOCKET_BLOCKED_TEXT } from './firebase-websocket-observation';

export const RECONNECT_FORCE_MIN_GAP_MS = 3000;

export const RECONNECT_WATCHDOG_STEPS_MS = [5000, 10000, 20000, 40000, 60000];

export const LISTENER_RECOVERY_STEPS_MS = [2000, 5000, 10000, 20000, 30000];

export const INFO_LISTENER_RECOVERY_STEPS_MS = [2000, 5000, 10000, 20000, 30000];

export const INFO_LISTENER_KEY_CONNECTED = 'connected';

export const INFO_LISTENER_KEY_OFFSET = 'serverTimeOffset';

export const infoListenerFailedPaths = new Set();

export const CONNECTING_GRACE_ATTEMPTS = 3;

export const DB_LISTENER_RETRY_MIN_GAP_MS = 3000;

export const DB_LISTENER_PROGRESS_GRACE_MS = 20000;

export const DB_LIVENESS_PROBE_PATH = 'zoew_barcode_registry/__zoew_liveness__';

export const DB_LIVENESS_PROBE_TIMEOUT_MS = 10000;

export const DB_LIVENESS_IDLE_MS = 55000;

export const DB_LIVENESS_RESUME_HIDDEN_MS = 30000;

export const DB_LIVENESS_CYCLE_MIN_GAP_MS = 30000;

export function connectionLooksOnline() {
    return firebaseState.isDatabaseConnected && (navigator.onLine as boolean) !== false && !firebaseState.dbListenersFailed;
}

export function connectionIsSettlingIn() {
    if (firebaseState.isDatabaseConnected || (navigator.onLine as boolean) === false) return false;
    if (firebaseState.firebaseSdkUnavailable) return false;
    return firebaseState.reconnectWatchdogAttempt < CONNECTING_GRACE_ATTEMPTS;
}

export function renderConnectionStatus() {
    watchFirebaseWebsocket(renderConnectionStatus);
    viewState.connectionPhase = connectionFlowSnapshot().phase;
    const transportOnline = connectionLooksOnline() && viewState.connectionPhase !== 'unavailable';
    const pendingData = transportOnline && ['syncing', 'recovering', 'blocked'].includes(viewState.connectionPhase);
    const online = transportOnline && !pendingData;
    const reconnecting = !online && firebaseState.isDatabaseConnected && firebaseState.dbListenersFailed && (navigator.onLine as boolean) !== false;
    const settling = !online && !reconnecting && connectionIsSettlingIn();
    const prevStatus = viewState.connectionStatus;
    viewState.connectionStatus = online ? 'online' : ((reconnecting || settling || pendingData) ? 'connecting' : 'offline');
    viewState.connectionText = online
        ? "ភ្ជាប់ Server រួចរាល់"
        : (reconnecting
            ? "កំពុងភ្ជាប់ឡើងវិញ..."
            : (settling ? "កំពុងភ្ជាប់..." : (firebaseSdkNeedsRefresh() ? "សូម Refresh ទំព័រ" : "ក្រៅបណ្ដាញ")));
    if (viewState.connectionPhase === 'blocked') viewState.connectionText = 'មានការសរសេរមិនទាន់ផ្ទៀងផ្ទាត់ — សូមពិនិត្យទិន្នន័យ ឬលុបវាតាម ☰ ឧបករណ៍';
    else if (firebaseWebsocketIsBlocked()) viewState.connectionText = FIREBASE_WEBSOCKET_BLOCKED_TEXT;
    else if (pendingData) viewState.connectionText = viewState.connectionPhase === 'syncing' ? 'កំពុងទាញទិន្នន័យ...' : 'កំពុងផ្ទៀងផ្ទាត់ការសរសេរ...';
    refreshLiveToasts();
    noteConnectionTransition(prevStatus, viewState.connectionStatus);
}

export function clearReconnectWatchdog() {
    if (firebaseState.reconnectWatchdogTimer) {
        clearTimeout(firebaseState.reconnectWatchdogTimer);
        firebaseState.reconnectWatchdogTimer = null;
    }
    firebaseState.reconnectWatchdogAttempt = 0;
}

export function canCycleDatabaseConnection() {
    return firebaseState.hasEverConnectedToDatabase || firebaseState.networkJustReturned;
}

export function forceDatabaseReconnect() {
    if (!firebaseState.fb || !firebaseState.db || typeof firebaseState.fb.goOnline !== 'function') return false;
    if (elapsedSince(firebaseState.lastForcedReconnectAt) < RECONNECT_FORCE_MIN_GAP_MS) return false;
    firebaseState.lastForcedReconnectAt = Date.now();
    try {
        if (canCycleDatabaseConnection() && typeof firebaseState.fb.goOffline === 'function') {
            firebaseState.networkJustReturned = false;
            firebaseState.fb.goOffline(firebaseState.db);
        }
    } catch (e) {}
    try { firebaseState.fb.goOnline(firebaseState.db); } catch (e) { return false; }
    return true;
}

export function scheduleReconnectWatchdog() {
    if (firebaseState.reconnectWatchdogTimer) return;
    if (!firebaseState.fb || !firebaseState.db) return;
    const step = RECONNECT_WATCHDOG_STEPS_MS[Math.min(firebaseState.reconnectWatchdogAttempt, RECONNECT_WATCHDOG_STEPS_MS.length - 1)];
    firebaseState.reconnectWatchdogTimer = setTimeout(() => {
        firebaseState.reconnectWatchdogTimer = null;
        if (firebaseState.isDatabaseConnected || (navigator.onLine as boolean) === false) { clearReconnectWatchdog(); return; }
        firebaseState.reconnectWatchdogAttempt++;
        renderConnectionStatus();
        forceDatabaseReconnect();
        scheduleReconnectWatchdog();
    }, step);
}

export function nudgeDatabaseConnection() {
    if (!firebaseState.fb || !firebaseState.db || typeof firebaseState.fb.goOnline !== 'function') return;
    if (firebaseState.isDatabaseConnected) { try { firebaseState.fb.goOnline(firebaseState.db); } catch (e) {} return; }
    if ((navigator.onLine as boolean) === false) return;
    forceDatabaseReconnect();
    scheduleReconnectWatchdog();
}

export function databaseLivenessProbeAllowed() {
    if (!firebaseState.fb || !firebaseState.db || typeof firebaseState.fb.get !== 'function' || typeof firebaseState.fb.ref !== 'function') return false;
    if (!firebaseState.isDatabaseConnected || (navigator.onLine as boolean) === false) return false;
    return !dbListenerPendingPaths.size;
}

export function noteDatabaseLinkUnresponsive(reason?) {
    if (!firebaseState.isDatabaseConnected || (navigator.onLine as boolean) === false) return false;
    if (elapsedSince(firebaseState.lastDbLivenessCycleAt) < DB_LIVENESS_CYCLE_MIN_GAP_MS) return false;
    if (!canCycleDatabaseConnection() || !forceDatabaseReconnect()) return false;
    firebaseState.lastDbLivenessCycleAt = Date.now();
    renderConnectionStatus();
    scheduleReconnectWatchdog();
    if (window.ZoeErrors) ZoeErrors.capture(new Error('Database link unresponsive'), { zone: 'network', context: 'probeDatabaseLiveness ' + (reason || '') });
    return true;
}

export function probeDatabaseLiveness(reason?) {
    if (firebaseState.dbLivenessProbe) return firebaseState.dbLivenessProbe;
    if (!databaseLivenessProbeAllowed()) return Promise.resolve(null);
    const probeDb = firebaseState.db;
    const probeSdk = firebaseState.fb;
    const probeConnectionRef = firebaseState.dbRefConnected;
    const probeTransportEpoch = typeof probeSdk.connectionEpoch === 'function' ? probeSdk.connectionEpoch(probeConnectionRef) : null;
    const probeAuthEpoch = firebaseState.authGeneration;
    const generation = firebaseState.infoListenerGeneration;
    const probe = new Promise((resolve) => {
        const timer = setTimeout(() => resolve(false), DB_LIVENESS_PROBE_TIMEOUT_MS);
        const answered = (alive) => { clearTimeout(timer); resolve(alive); };
        let started = null;
        try { started = probeSdk.get(probeSdk.ref(probeDb, DB_LIVENESS_PROBE_PATH)); } catch (e) { answered(null); return; }
        Promise.resolve(started).then(() => answered(true), (error) => answered(
            /^(?:database\/)?permission_denied$/i.test(String(error && (error.code || error.message) || '')) ? true : null
        ));
    }).then((alive) => {
        if (firebaseState.dbLivenessProbe === probe) firebaseState.dbLivenessProbe = null;
        if (firebaseState.db !== probeDb || firebaseState.fb !== probeSdk || firebaseState.infoListenerGeneration !== generation || firebaseState.authGeneration !== probeAuthEpoch) return null;
        if (probeTransportEpoch !== null && probeSdk.connectionEpoch(probeConnectionRef) !== probeTransportEpoch) return null;
        if (alive === null) return null;
        if (alive) {
            firebaseState.lastDbLivenessOkAt = Date.now();
            return true;
        }
        if (dbListenerPendingPaths.size) return null;
        noteDatabaseLinkUnresponsive(reason);
        return false;
    });
    firebaseState.dbLivenessProbe = probe;
    return probe;
}

export function probeDatabaseLivenessIfIdle() {
    if (documentIsHidden()) return null;
    if (elapsedSince(firebaseState.lastDbLivenessOkAt) < DB_LIVENESS_IDLE_MS) return null;
    return probeDatabaseLiveness('idle');
}

let connectionRecoveryCleanup: (() => void) | null = null;

export function setupConnectionRecovery() {
    if (connectionRecoveryCleanup) connectionRecoveryCleanup();
    const onOnline = () => {
        firebaseState.networkJustReturned = true;
        resumePendingScanOperations();
        renderConnectionStatus();
        retryFirebaseSdkNow();
        nudgeDatabaseConnection();
        retryFailedDbListenersNow();
        ztoState.ztoStatusFailStreak = 0;
        resumeZtoStatusSweep();
        if (window.ZoeLicense && typeof ZoeLicense.syncServerTime === 'function') {
            ZoeLicense.syncServerTime().catch(() => {});
        }
    };
    const onOffline = () => {
        clearReconnectWatchdog();
        renderConnectionStatus();
    };
    const onStorage = (event) => {
        followStoredFirebaseConfig(event);
        if (event.key === null || event.key === PICKUP_JOURNAL_KEY || event.key === CLEANUP_LEGACY_JOURNAL_KEY || event.key?.startsWith(CLEANUP_JOURNAL_KEY) || event.key?.startsWith('zoew_pickup_journal_v2:')) dataState.pickupPendingVersion++;
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    window.addEventListener('storage', onStorage);
    const offVisible = onDocumentVisibilityChange(() => {
        if (documentIsHidden()) {
            firebaseState.documentHiddenAt = Date.now();
            return;
        }
        const hiddenFor = firebaseState.documentHiddenAt ? elapsedSince(firebaseState.documentHiddenAt) : 0;
        firebaseState.documentHiddenAt = 0;
        renderConnectionStatus();
        retryFirebaseSdkNow();
        nudgeDatabaseConnection();
        retryFailedDbListenersNow();
        if (hiddenFor >= DB_LIVENESS_RESUME_HIDDEN_MS) probeDatabaseLiveness('resume');
    });
    let active = true;
    const cleanup = () => {
        if (!active) return;
        active = false;
        window.removeEventListener('online', onOnline);
        window.removeEventListener('offline', onOffline);
        window.removeEventListener('storage', onStorage);
        offVisible();
        if (connectionRecoveryCleanup === cleanup) connectionRecoveryCleanup = null;
    };
    connectionRecoveryCleanup = cleanup;
    return cleanup;
}

export function scheduleInfoListenerRecovery() {
    if (firebaseState.infoListenerRecoveryTimer) return;
    const step = INFO_LISTENER_RECOVERY_STEPS_MS[Math.min(firebaseState.infoListenerRecoveryAttempt, INFO_LISTENER_RECOVERY_STEPS_MS.length - 1)];
    firebaseState.infoListenerRecoveryAttempt++;
    firebaseState.infoListenerRecoveryTimer = setTimeout(() => {
        firebaseState.infoListenerRecoveryTimer = null;
        if (!firebaseState.infoListenersFailed) return;
        if (!firebaseState.db || !firebaseState.fb) { scheduleInfoListenerRecovery(); return; }
        attachInfoListeners();
        scheduleInfoListenerRecovery();
    }, step);
}

export function clearInfoListenerRecovery() {
    if (firebaseState.infoListenerRecoveryTimer) {
        clearTimeout(firebaseState.infoListenerRecoveryTimer);
        firebaseState.infoListenerRecoveryTimer = null;
    }
    firebaseState.infoListenerRecoveryAttempt = 0;
    firebaseState.infoListenersFailed = false;
    infoListenerFailedPaths.clear();
}

export function noteInfoListenerAlive(pathKey) {
    if (pathKey) infoListenerFailedPaths.delete(pathKey);
    if (infoListenerFailedPaths.size) return;
    clearInfoListenerRecovery();
}

export function handleInfoListenerError(err, pathKey) {
    if (pathKey) infoListenerFailedPaths.add(pathKey);
    firebaseState.infoListenersFailed = true;
    if (!pathKey || pathKey === INFO_LISTENER_KEY_CONNECTED) firebaseState.isDatabaseConnected = false;
    renderConnectionStatus();
    if ((navigator.onLine as boolean) !== false) scheduleReconnectWatchdog();
    scheduleInfoListenerRecovery();
}

export function detachInfoListeners() {
    firebaseState.infoListenerGeneration++;
    if (!firebaseState.fb) return;
    if (firebaseState.dbRefConnected) { try { firebaseState.fb.off(firebaseState.dbRefConnected); } catch (e) {} }
    if (firebaseState.dbRefServerTimeOffset) { try { firebaseState.fb.off(firebaseState.dbRefServerTimeOffset); } catch (e) {} }
}

export function attachInfoListeners() {
    detachInfoListeners();
    if (!firebaseState.db || !firebaseState.fb || !firebaseState.dbRefConnected || !firebaseState.dbRefServerTimeOffset) return false;
    const listenerGeneration = ++firebaseState.infoListenerGeneration;
    const database = firebaseState.db;
    const sdk = firebaseState.fb;
    const native = sdk.__supabase !== true;
    let timeSyncPending = false;
    let activationClockSample = null;
    const retryActivationWithSample = (sample) => {
        if (sample === activationClockSample) return;
        activationClockSample = sample;
        void retryPendingActivation();
    };
    const current = () => listenerGeneration === firebaseState.infoListenerGeneration && database === firebaseState.db && sdk === firebaseState.fb;
    const acceptVerifiedTime = (library) => {
        if (!current() || library !== window.ZoeLicense || typeof library?.getServerTimeSample !== 'function'
            || typeof library.getServerTimeGeneration !== 'function') return false;
        const sample = library.getServerTimeSample();
        if (!sample || !Object.isFrozen(sample) || !['nonce', 'http-date'].includes(sample.source)
            || !Number.isSafeInteger(sample.generation) || sample.generation < 0
            || sample.generation !== library.getServerTimeGeneration()
            || !Number.isSafeInteger(sample.observation) || sample.observation <= 0
            || !Number.isFinite(sample.uncertaintyMs) || sample.uncertaintyMs < 0) return false;
        if (!acceptServerClockOffset(sample.epochMs - sample.wallMs, sample, false)) return false;
        retryActivationWithSample(sample);
        if (firebaseState.sessionExpiryCheck === 'unverified') void runSessionExpiryCheck();
        return true;
    };
    const syncVerifiedTime = async () => {
        const library = window.ZoeLicense;
        if (!current() || timeSyncPending || typeof library?.syncServerTime !== 'function'
            || typeof library.getServerTimeGeneration !== 'function') return;
        timeSyncPending = true;
        try {
            library.getServerTimeGeneration();
            const synced = await library.syncServerTime({ priority: true });
            if (!synced || !current() || library !== window.ZoeLicense) return;
            acceptVerifiedTime(library);
        } catch (e) {} finally { timeSyncPending = false; }
    };
    const observeNativeTime = () => {
        try { acceptVerifiedTime(window.ZoeLicense); } catch (e) {}
        serverClockIsTrustworthy();
    };
    setServerClockRefresh(() => {
        if (!current() || (navigator.onLine as boolean) === false) return;
        if (native) void syncVerifiedTime();
        else forceDatabaseReconnect();
    });
    infoListenerFailedPaths.clear();
    infoListenerFailedPaths.add(INFO_LISTENER_KEY_CONNECTED);
    infoListenerFailedPaths.add(INFO_LISTENER_KEY_OFFSET);

    firebaseState.fb.onValue(firebaseState.dbRefConnected, (snap) => {
        if (!current()) return;
        noteInfoListenerAlive(INFO_LISTENER_KEY_CONNECTED);
        firebaseState.isDatabaseConnected = snap.val() === true;
        if (firebaseState.isDatabaseConnected) {
            firebaseState.hasEverConnectedToDatabase = true;
            if (native) observeNativeTime();
            firebaseState.lastDbLivenessOkAt = Date.now();
            clearReconnectWatchdog();
            retryFailedDbListenersNow();
            flushPendingHistoryPatches();
            flushPendingRegistryReleases();
            resumePendingScanOperations();
            resumePriceOperations();
        } else if ((navigator.onLine as boolean) !== false) {
            scheduleReconnectWatchdog();
        }
        renderConnectionStatus();
    }, (err) => {
        if (!current()) return;
        handleInfoListenerError(err, INFO_LISTENER_KEY_CONNECTED);
    });

    firebaseState.fb.onValue(firebaseState.dbRefServerTimeOffset, (snap) => {
        if (!current()) return;
        noteInfoListenerAlive(INFO_LISTENER_KEY_OFFSET);
        if (native) { observeNativeTime(); return; }
        const val = snap.val();
        if (!snap.serverClockSample || !acceptServerClockOffset(val, snap.serverClockSample, false)) return;
        if (typeof window.ZoeLicense?.setServerTimeSample === 'function') window.ZoeLicense.setServerTimeSample(snap.serverClockSample);
        retryActivationWithSample(snap.serverClockSample);
        if (firebaseState.sessionExpiryCheck === 'unverified') void runSessionExpiryCheck();
    }, (err) => {
        if (!current()) return;
        handleInfoListenerError(err, INFO_LISTENER_KEY_OFFSET);
    });

    if (native) observeNativeTime();
    return true;
}
