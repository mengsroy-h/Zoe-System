import { captureConnectionOperation } from '../../services/connection-flow';
import { createLifecycleScope } from '../lifecycle/scope';
import { firebaseState, lookupState, securityState, uiState } from '../../core/state';
import { viewState } from '../../core/view-state';
import { appLocalStore, safeStoreGet } from '../../core/storage';
import { modalIsOpen } from '../../core/modals';
import { buildHealthAdvice } from '../../features/health-advice';
import { healthPendingRow } from '../components/health/model';
import { healthCheckResultIsCurrent, healthClockRow, healthDatabaseRow, healthDatabaseWriteRow, healthNetworkRow, invalidateHealthCheck, runHealthCheck } from '../../features/health-check';

const HEALTH_POLL_INTERVAL_MS = 30000;
const HEALTH_CHANGE_DEBOUNCE_MS = 250;

export function watchHealthCheck() {
    const scope = createLifecycleScope();
    let stopped = false;
    let dirty = false;
    let nextAutomaticAt = 0;
    let recovering = false;
    let nextRecoveryAt = 0;
    let wasBusy = viewState.healthRecheckBusy;
    let previousClock = JSON.stringify(healthClockRow());
    let timer: ReturnType<typeof setTimeout> | null = null;
    const signature = () => JSON.stringify([
        firebaseState.authGeneration, firebaseState.auth?.currentUser?.uid,
        firebaseState.auth?._account, firebaseState.auth?._accountUnverified,
        healthDatabaseRow(), healthDatabaseWriteRow(),
        lookupState.customerDataTableFetchedAt, lookupState.customerTableIsPartial,
        lookupState.customerDataTableRows?.length, lookupState.sheetScriptVersionSeen,
        !!securityState.lookupSecretKey, safeStoreGet(appLocalStore, 'zoew_lookup_api_config')
    ]);
    let previous = signature();
    let previousSecret = securityState.lookupSecretKey;
    let owner = captureConnectionOperation();
    const available = () => !stopped && modalIsOpen('healthCheckModal') && !document.hidden;
    const clear = () => { if (timer !== null) clearTimeout(timer); timer = null; };
    const schedule = (ms: number) => {
        clear();
        const notBefore = dirty && recovering ? Math.min(nextAutomaticAt, nextRecoveryAt) : nextAutomaticAt;
        if (available()) timer = setTimeout(tick, Math.max(ms, notBefore - performance.now()));
    };
    const invalidate = (clearPalm = false) => {
        invalidateHealthCheck(clearPalm);
        uiState.healthRows = [(navigator.onLine as boolean) === false ? healthNetworkRow() : healthPendingRow()];
        uiState.healthAdvice = null;
    };
    const changed = (clearPalm = false) => {
        if (!available()) return;
        dirty = true;
        recovering ||= viewState.healthRecheckBusy || wasBusy;
        invalidate(clearPalm);
        schedule(HEALTH_CHANGE_DEBOUNCE_MS);
    };
    const tick = () => {
        timer = null;
        if (!available()) return;
        if (!dirty && viewState.healthRecheckBusy) { schedule(HEALTH_POLL_INTERVAL_MS); return; }
        if (!dirty) { dirty = true; schedule(HEALTH_CHANGE_DEBOUNCE_MS); return; }
        if (viewState.healthRecheckBusy) return;
        dirty = false;
        if (recovering) nextRecoveryAt = performance.now() + HEALTH_POLL_INTERVAL_MS;
        recovering = false;
        nextAutomaticAt = performance.now() + HEALTH_POLL_INTERVAL_MS;
        void runHealthCheck(false, false).finally(() => {
            nextAutomaticAt = performance.now() + HEALTH_POLL_INTERVAL_MS;
            if (available()) schedule(dirty ? HEALTH_CHANGE_DEBOUNCE_MS : HEALTH_POLL_INTERVAL_MS);
        });
    };
    const stateChanged = () => {
        const clockRow = healthClockRow();
        const clock = JSON.stringify(clockRow);
        if (clock !== previousClock) {
            previousClock = clock;
            if (available() && uiState.healthRows?.some((row) => row.label === clockRow.label)) {
                uiState.healthRows = uiState.healthRows.map((row) => row.label === clockRow.label ? clockRow : row);
                uiState.healthAdvice = buildHealthAdvice(uiState.healthRows);
            }
        }
        const current = signature();
        if (current === previous && previousSecret === securityState.lookupSecretKey && owner.current()) return;
        previous = current;
        previousSecret = securityState.lookupSecretKey;
        owner = captureConnectionOperation();
        changed();
    };
    const externalChange = () => {
        previous = signature();
        previousSecret = securityState.lookupSecretKey;
        owner = captureConnectionOperation();
        changed(true);
    };
    const visibility = () => {
        if (document.hidden) {
            clear();
            recovering ||= viewState.healthRecheckBusy || wasBusy;
            invalidate(true);
            dirty = true;
        }
        else externalChange();
    };
    const storage = (event: StorageEvent) => {
        if (event.storageArea && event.storageArea !== appLocalStore) return;
        if (event.key !== null && !['zoew_firebase_config', 'zoew_lookup_api_config', 'zoe_license_activation_ZOE',
            'zoe_license_device_id', 'zoew-sb-auth', 'zoew-sb-account', 'zoew-sb-auth-owner'].includes(event.key)) return;
        externalChange();
    };
    const offs = [firebaseState, lookupState, securityState].map((store) => store.subscribe(stateChanged));
    offs.push(viewState.subscribe(() => {
        if (wasBusy && !viewState.healthRecheckBusy) nextAutomaticAt = performance.now() + HEALTH_POLL_INTERVAL_MS;
        wasBusy = viewState.healthRecheckBusy;
        stateChanged();
        if (dirty && !viewState.healthRecheckBusy) {
            if (healthCheckResultIsCurrent()) { dirty = false; recovering = false; schedule(HEALTH_POLL_INTERVAL_MS); }
            else schedule(HEALTH_CHANGE_DEBOUNCE_MS);
        }
    }));
    window.addEventListener('online', externalChange);
    window.addEventListener('offline', externalChange);
    window.addEventListener('storage', storage);
    document.addEventListener('visibilitychange', visibility);
    const workers = navigator.serviceWorker;
    if (typeof workers?.addEventListener === 'function') scope.listen(workers, 'controllerchange', externalChange);
    schedule(HEALTH_POLL_INTERVAL_MS);
    return () => {
        stopped = true;
        clear();
        invalidateHealthCheck(true);
        offs.forEach((off) => off());
        window.removeEventListener('online', externalChange);
        window.removeEventListener('offline', externalChange);
        window.removeEventListener('storage', storage);
        document.removeEventListener('visibilitychange', visibility);
        scope.dispose();
    };
}
