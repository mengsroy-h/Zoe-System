import { dataState, firebaseState } from '../core/state';
import { getServerNow } from '../core/clock';
import { elapsedSince } from '../core/elapsed';
import { appLocalStore } from '../core/storage';
import { DB_LISTENER_KEYS, DB_LISTENER_KEY_DAILY_COLLECTED, DB_LISTENER_KEY_DAILY_REVENUE, DB_LISTENER_KEY_DELETED, DB_LISTENER_KEY_HISTORY, DB_LISTENER_KEY_MONTHLY_REVENUE, VIEW_NOT_MEASURABLE_NOTICE, dbListenerFailedPaths, dbListenerPendingPaths } from '../core/text';
import { generateUniqueId, normalizeBarcodesOf, parseTimestampFromId } from '../domain/barcode';
import { runAutomaticDeletedCleanup } from '../domain/cleanup';
import { flushPendingRegistryReleases } from '../domain/registry';
import { RECENT_PHONES_MAX, collectPhoneSuggestions } from '../features/phone-suggest';
import { DB_LISTENER_PROGRESS_GRACE_MS, DB_LISTENER_RETRY_MIN_GAP_MS, LISTENER_RECOVERY_STEPS_MS, clearInfoListenerRecovery, clearReconnectWatchdog, renderConnectionStatus } from './connection';
import { debouncedRenderAfterHistorySync } from './network';
import { rawSnapshotToItemList } from '../ui/modal-stack';
import { refreshLiveToasts, showToast } from '../ui/toast';

export function detachDatabaseListeners() {
    firebaseState.dbListenerGeneration++;
    if (!firebaseState.fb) return;
    [firebaseState.dbRefDailyRevenue, firebaseState.dbRefMonthlyRevenue, firebaseState.dbRefDailyPickup, firebaseState.dbRefDailyCollected, firebaseState.dbRefHistory, firebaseState.dbRefDeleted, firebaseState.dbRefExchangeRate]
        .forEach((ref) => { if (ref) { try { firebaseState.fb.off(ref); } catch (e) {} } });
}

export function clearDbListenerRecovery() {
    if (firebaseState.dbListenerRecoveryTimer) {
        clearTimeout(firebaseState.dbListenerRecoveryTimer);
        firebaseState.dbListenerRecoveryTimer = null;
    }
    firebaseState.dbListenerRecoveryAttempt = 0;
}

export function dbListenerViewIsStale(pathKey) {
    return dbListenerPendingPaths.has(pathKey) || dbListenerFailedPaths.has(pathKey);
}

export function anyDbListenerViewIsStale(pathKeys) {
    if (!Array.isArray(pathKeys)) return false;
    for (let i = 0; i < pathKeys.length; i++) {
        if (dbListenerViewIsStale(pathKeys[i])) return true;
    }
    return false;
}

export function emptyViewMessage(pathKeys, emptyText) {
    return anyDbListenerViewIsStale(pathKeys) ? VIEW_NOT_MEASURABLE_NOTICE : emptyText;
}

export function noteDbListenerAlive(pathKey) {
    const wasPending = dbListenerPendingPaths.delete(pathKey);
    dbListenerFailedPaths.delete(pathKey);
    flushPendingRegistryReleases();
    if (wasPending) {
        firebaseState.dbListenerProgressAt = Date.now();
        firebaseState.dbListenerPendingSeen = dbListenerPendingPaths.size;
    }
    if (wasPending && !dbListenerPendingPaths.size) refreshLiveToasts();
    if (!firebaseState.dbListenersFailed || dbListenerPendingPaths.size || dbListenerFailedPaths.size) return;
    firebaseState.dbListenersFailed = false;
    firebaseState.dbListenerOutageNoticeShown = false;
    clearDbListenerRecovery();
    renderConnectionStatus();
    showToast('✅ ទិន្នន័យភ្ជាប់មកវិញហើយ — តារាងទាន់សម័យវិញហើយ');
}

export function dbListenerResyncIsProgressing() {
    if (!dbListenerPendingPaths.size) return false;
    return elapsedSince(firebaseState.dbListenerProgressAt) < DB_LISTENER_PROGRESS_GRACE_MS;
}

export function attemptDbListenerRecovery() {
    firebaseState.dbListenerRecoveryTimer = null;
    if (!firebaseState.dbListenersFailed) return;
    if (!firebaseState.db || !firebaseState.fb || !firebaseState.auth || !firebaseState.auth.currentUser) { scheduleDbListenerRecovery(); return; }
    if ((navigator.onLine as boolean) === false) { scheduleDbListenerRecovery(); return; }
    if (dbListenerResyncIsProgressing()) { scheduleDbListenerRecovery(); return; }
    const sinceLastAttempt = elapsedSince(firebaseState.lastDbListenerAttemptAt);
    if (sinceLastAttempt < DB_LISTENER_RETRY_MIN_GAP_MS) {
        firebaseState.dbListenerRecoveryTimer = setTimeout(attemptDbListenerRecovery, DB_LISTENER_RETRY_MIN_GAP_MS - sinceLastAttempt);
        return;
    }
    firebaseState.lastDbListenerAttemptAt = Date.now();
    initDatabaseListeners();
    scheduleDbListenerRecovery();
}

export function scheduleDbListenerRecovery() {
    if (firebaseState.dbListenerRecoveryTimer || !firebaseState.dbListenersFailed) return;
    const step = LISTENER_RECOVERY_STEPS_MS[Math.min(firebaseState.dbListenerRecoveryAttempt, LISTENER_RECOVERY_STEPS_MS.length - 1)];
    firebaseState.dbListenerRecoveryAttempt++;
    firebaseState.dbListenerRecoveryTimer = setTimeout(attemptDbListenerRecovery, step);
}

export function resetDbListenerHealthState() {
    firebaseState.sdkUnavailableNoticeShown = false;
    dataState.pickupLedgerRepairDone = false;
    dataState.pickupLedgerRepairRunning = false;
    clearInfoListenerRecovery();
    firebaseState.dbListenersFailed = false;
    firebaseState.dbListenerOutageNoticeShown = false;
    dbListenerPendingPaths.clear();
    dbListenerFailedPaths.clear();
    firebaseState.dbListenerPendingSeen = 0;
    firebaseState.dbListenerProgressAt = 0;
    firebaseState.lastDbListenerAttemptAt = 0;
    clearDbListenerRecovery();
    clearReconnectWatchdog();
}

export function retryFailedDbListenersNow() {
    if (!firebaseState.dbListenersFailed) return;
    clearDbListenerRecovery();
    attemptDbListenerRecovery();
}

export function handleDbListenerError(err, pathKey) {
    console.error('Firebase listener error:', err);
    if (window.ZoeErrors) ZoeErrors.capture(err, { context: 'Firebase listener error' });
    if (pathKey) dbListenerFailedPaths.add(pathKey);
    firebaseState.dbListenersFailed = true;
    renderConnectionStatus();
    if (!firebaseState.dbListenerOutageNoticeShown) {
        firebaseState.dbListenerOutageNoticeShown = true;
        showToast('⚠️ ដាចការទាញយកទិន្នន័យពី Server — តារាងអាចមិនទាន់សម័យ។ កំពុងព្យាយាមភ្ជាប់ឡើងវិញ...');
    }
    scheduleDbListenerRecovery();
}

export function initDatabaseListeners() {
    if (!firebaseState.db || !firebaseState.fb) return false;

    detachDatabaseListeners();
    const listenerGeneration = ++firebaseState.dbListenerGeneration;
    dbListenerPendingPaths.clear();
    dbListenerFailedPaths.clear();
    const listenerRefs = {
        exchangeRate: firebaseState.dbRefExchangeRate,
        dailyRevenue: firebaseState.dbRefDailyRevenue,
        monthlyRevenue: firebaseState.dbRefMonthlyRevenue,
        dailyPickup: firebaseState.dbRefDailyPickup,
        dailyCollected: firebaseState.dbRefDailyCollected,
        history: firebaseState.dbRefHistory,
        deleted: firebaseState.dbRefDeleted
    };
    DB_LISTENER_KEYS.forEach((key) => { if (listenerRefs[key]) dbListenerPendingPaths.add(key); });
    firebaseState.dbListenerPendingSeen = dbListenerPendingPaths.size;
    firebaseState.dbListenerProgressAt = 0;

    if (firebaseState.dbRefExchangeRate) {
        firebaseState.fb.onValue(firebaseState.dbRefExchangeRate, (snapshot) => {
            if (listenerGeneration !== firebaseState.dbListenerGeneration) return;
            noteDbListenerAlive('exchangeRate');
            const val = snapshot.val();
            if (val && !isNaN(val)) {
                dataState.exchangeRateRiel = parseFloat(val);
                try { appLocalStore.setItem('zoew_exchange_rate', dataState.exchangeRateRiel); } catch (e) {}
                debouncedRenderAfterHistorySync();
            }
        }, (err) => {
            if (listenerGeneration !== firebaseState.dbListenerGeneration) return;
            handleDbListenerError(err, 'exchangeRate');
        });
    }

    if (firebaseState.dbRefDailyRevenue) {
        firebaseState.fb.onValue(firebaseState.dbRefDailyRevenue, (snapshot) => {
            if (listenerGeneration !== firebaseState.dbListenerGeneration) return;
            noteDbListenerAlive(DB_LISTENER_KEY_DAILY_REVENUE);
            dataState.dailyRevenueData = snapshot.val() || {};
            debouncedRenderAfterHistorySync();
        }, (err) => {
            if (listenerGeneration !== firebaseState.dbListenerGeneration) return;
            handleDbListenerError(err, DB_LISTENER_KEY_DAILY_REVENUE);
        });
    }

    if (firebaseState.dbRefMonthlyRevenue) {
        firebaseState.fb.onValue(firebaseState.dbRefMonthlyRevenue, (snapshot) => {
            if (listenerGeneration !== firebaseState.dbListenerGeneration) return;
            noteDbListenerAlive(DB_LISTENER_KEY_MONTHLY_REVENUE);
            dataState.monthlyRevenueData = snapshot.val() || {};
        }, (err) => {
            if (listenerGeneration !== firebaseState.dbListenerGeneration) return;
            handleDbListenerError(err, DB_LISTENER_KEY_MONTHLY_REVENUE);
        });
    }

    if (firebaseState.dbRefDailyPickup) {
        firebaseState.fb.onValue(firebaseState.dbRefDailyPickup, (snapshot) => {
            if (listenerGeneration !== firebaseState.dbListenerGeneration) return;
            noteDbListenerAlive('dailyPickup');
            dataState.dailyPickupData = snapshot.val() || {};
            debouncedRenderAfterHistorySync();
        }, (err) => {
            if (listenerGeneration !== firebaseState.dbListenerGeneration) return;
            handleDbListenerError(err, 'dailyPickup');
        });
    }

    if (firebaseState.dbRefDailyCollected) {
        firebaseState.fb.onValue(firebaseState.dbRefDailyCollected, (snapshot) => {
            if (listenerGeneration !== firebaseState.dbListenerGeneration) return;
            noteDbListenerAlive(DB_LISTENER_KEY_DAILY_COLLECTED);
            dataState.dailyCollectedData = snapshot.val() || {};
            debouncedRenderAfterHistorySync();
        }, (err) => {
            if (listenerGeneration !== firebaseState.dbListenerGeneration) return;
            handleDbListenerError(err, DB_LISTENER_KEY_DAILY_COLLECTED);
        });
    }

    if (firebaseState.dbRefHistory) {
    firebaseState.fb.onValue(firebaseState.dbRefHistory, (snapshot) => {
        if (listenerGeneration !== firebaseState.dbListenerGeneration) return;
        const data = snapshot.val();
        dataState.scanHistory = rawSnapshotToItemList(data);

        dataState.scanHistory.forEach(item => {
            if(!item.id) item.id = generateUniqueId();
            if (!item.createdAt) {
                item.createdAt = parseTimestampFromId(item.id) || getServerNow();
            }

            if (item.cod === undefined) {
                item.cod = item.price !== undefined ? parseFloat(item.price) || 0 : 0;
            } else {
                item.cod = parseFloat(item.cod) || 0;
            }

            if (item.dod === undefined) {
                item.dod = 0;
            } else {
                item.dod = parseFloat(item.dod) || 0;
            }

            item.price = Math.round((item.cod + item.dod) * 100) / 100;

            if (Array.isArray(item.barcodes) || (item.barcodes && typeof item.barcodes === 'object')) {
                normalizeBarcodesOf(item);
                if (item.barcodes.length) item.count = item.barcodes.length;
            }

            if (item.barcodes && Array.isArray(item.barcodes)) {
                item.barcodes.forEach(b => {
                    if (!b || typeof b !== 'object') return;
                    b.cod = parseFloat(b.cod) || 0;
                    b.dod = parseFloat(b.dod) || 0;
                    if (b.isDeducted === undefined) b.isDeducted = false;
                    if (b.isFromDeletion === undefined) b.isFromDeletion = false;
                });
            }
        });

        noteDbListenerAlive('history');
        debouncedRenderAfterHistorySync();
    }, (err) => {
        if (listenerGeneration !== firebaseState.dbListenerGeneration) return;
        handleDbListenerError(err, DB_LISTENER_KEY_HISTORY);
    });
    }

    if (firebaseState.dbRefDeleted) {
    firebaseState.fb.onValue(firebaseState.dbRefDeleted, (snapshot) => {
        if (listenerGeneration !== firebaseState.dbListenerGeneration) return;
        const data = snapshot.val();
        dataState.deletedItems = rawSnapshotToItemList(data);

        dataState.deletedItems.forEach(item => {
            if(!item.id) item.id = generateUniqueId();
            if (!item.createdAt) {
                item.createdAt = parseTimestampFromId(item.id) || getServerNow();
            }
            normalizeBarcodesOf(item);
        });
        noteDbListenerAlive('deleted');
        runAutomaticDeletedCleanup();
    }, (err) => {
        if (listenerGeneration !== firebaseState.dbListenerGeneration) return;
        handleDbListenerError(err, DB_LISTENER_KEY_DELETED);
    });
    }

    firebaseState.isDatabaseInitialized = true;
    return true;
}

export function updateRecentPhonesList() {
    const entries = collectPhoneSuggestions('', RECENT_PHONES_MAX);
    const signature = entries.map(entry => entry.phone).join('\u0001');
    if (dataState.recentPhonesSignature !== null && signature === dataState.recentPhonesSignature) return;
    dataState.recentPhonesSignature = signature;
    dataState.recentPhonesOptions = entries.map((entry) => entry.phone);
    dataState.touch();
}
