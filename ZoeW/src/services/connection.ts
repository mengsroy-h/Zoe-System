import { viewState } from '../core/view-state';
import { documentIsHidden, onDocumentVisibilityChange } from '../platform/document-io';
import { firebaseState, ztoState } from '../core/state';
import { serverClockOffsetIsFromServer } from '../core/clock';
import { elapsedSince } from '../core/elapsed';
import { flushPendingRegistryReleases } from '../domain/registry';
import { resumeZtoStatusSweep } from '../features/zto-status';
import { retryFailedDbListenersNow } from './db-listeners';
import { firebaseSdkNeedsRefresh, retryFirebaseSdkNow } from './firebase-sdk';
import { flushPendingHistoryPatches } from './history-write';
import { noteConnectionTransition, refreshLiveToasts } from '../ui/toast';
import { dbListenerPendingPaths } from '../core/text';

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
    const online = connectionLooksOnline();
    const reconnecting = !online && firebaseState.isDatabaseConnected && firebaseState.dbListenersFailed && (navigator.onLine as boolean) !== false;
    const settling = !online && !reconnecting && connectionIsSettlingIn();
    const prevStatus = viewState.connectionStatus;
    viewState.connectionStatus = online ? 'online' : ((reconnecting || settling) ? 'connecting' : 'offline');
    viewState.connectionText = online
        ? "ភ្ជាប់ Server រួចរាល់"
        : (reconnecting
            ? "កំពុងភ្ជាប់ឡើងវិញ..."
            : (settling ? "កំពុងភ្ជាប់..." : (firebaseSdkNeedsRefresh() ? "សូម Refresh ទំព័រ" : "ក្រៅបណ្ដាញ")));
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
    const generation = firebaseState.infoListenerGeneration;
    const probe = new Promise((resolve) => {
        const timer = setTimeout(() => resolve(false), DB_LIVENESS_PROBE_TIMEOUT_MS);
        const answered = () => { clearTimeout(timer); resolve(true); };
        let started = null;
        try { started = firebaseState.fb.get(firebaseState.fb.ref(probeDb, DB_LIVENESS_PROBE_PATH)); } catch (e) { started = null; }
        Promise.resolve(started).then(answered, answered);
    }).then((alive) => {
        firebaseState.dbLivenessProbe = null;
        if (firebaseState.db !== probeDb || firebaseState.infoListenerGeneration !== generation) return null;
        if (alive) {
            firebaseState.lastDbLivenessOkAt = Date.now();
            return true;
        }
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

export function setupConnectionRecovery() {
    window.addEventListener('online', () => {
        firebaseState.networkJustReturned = true;
        renderConnectionStatus();
        retryFirebaseSdkNow();
        nudgeDatabaseConnection();
        retryFailedDbListenersNow();
        ztoState.ztoStatusFailStreak = 0;
        resumeZtoStatusSweep();
        if (window.ZoeLicense && typeof ZoeLicense.syncServerTime === 'function') {
            ZoeLicense.syncServerTime().catch(() => {});
        }
    });
    window.addEventListener('offline', () => {
        clearReconnectWatchdog();
        renderConnectionStatus();
    });
    onDocumentVisibilityChange(() => {
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
    infoListenerFailedPaths.clear();
    infoListenerFailedPaths.add(INFO_LISTENER_KEY_CONNECTED);
    infoListenerFailedPaths.add(INFO_LISTENER_KEY_OFFSET);

    firebaseState.fb.onValue(firebaseState.dbRefConnected, (snap) => {
        if (listenerGeneration !== firebaseState.infoListenerGeneration) return;
        noteInfoListenerAlive(INFO_LISTENER_KEY_CONNECTED);
        firebaseState.isDatabaseConnected = snap.val() === true;
        if (firebaseState.isDatabaseConnected) {
            firebaseState.hasEverConnectedToDatabase = true;
            firebaseState.lastDbLivenessOkAt = Date.now();
            clearReconnectWatchdog();
            retryFailedDbListenersNow();
            flushPendingHistoryPatches();
            flushPendingRegistryReleases();
        } else if ((navigator.onLine as boolean) !== false) {
            scheduleReconnectWatchdog();
        }
        renderConnectionStatus();
    }, (err) => {
        if (listenerGeneration !== firebaseState.infoListenerGeneration) return;
        handleInfoListenerError(err, INFO_LISTENER_KEY_CONNECTED);
    });

    firebaseState.fb.onValue(firebaseState.dbRefServerTimeOffset, (snap) => {
        if (listenerGeneration !== firebaseState.infoListenerGeneration) return;
        noteInfoListenerAlive(INFO_LISTENER_KEY_OFFSET);
        const val = snap.val();
        if (typeof val !== 'number') return;
        firebaseState.serverTimeOffsetMs = val;
        if (!serverClockOffsetIsFromServer(val)) return;
        firebaseState.serverClockTrusted = true;
        if (window.ZoeLicense) window.ZoeLicense.setServerTimeOffset(val);
    }, (err) => {
        if (listenerGeneration !== firebaseState.infoListenerGeneration) return;
        handleInfoListenerError(err, INFO_LISTENER_KEY_OFFSET);
    });

    return true;
}
