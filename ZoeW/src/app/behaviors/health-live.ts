import { captureConnectionOperation } from '../../services/connection-flow';
import { createLifecycleScope } from '../lifecycle/scope';
import { firebaseState, lookupState, securityState, uiState } from '../../core/state';
import { viewState } from '../../core/view-state';
import { appLocalStore, safeStoreGet } from '../../core/storage';
import { modalIsOpen } from '../../core/modals';
import { buildHealthAdvice } from '../../features/health-advice';
import { healthPendingRow } from '../components/health/model';
import { healthCheckResultIsCurrent, healthClockRow, healthDatabaseRow, healthDatabaseWriteRow, healthNetworkRow, runHealthCheck } from '../../features/health-check';

export function watchHealthCheck() {
    const scope = createLifecycleScope();
    let stopped = false;
    let dirty = false;
    let nextAutomaticAt = 0;
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
    let owner = captureConnectionOperation();
    const available = () => !stopped && modalIsOpen('healthCheckModal') && !document.hidden;
    const clear = () => { if (timer !== null) clearTimeout(timer); timer = null; };
    const schedule = (ms: number) => {
        clear();
        if (available()) timer = setTimeout(tick, Math.max(ms, nextAutomaticAt - performance.now()));
    };
    const invalidate = () => {
        ++uiState.healthRunSeq;
        uiState.healthRows = [(navigator.onLine as boolean) === false ? healthNetworkRow() : healthPendingRow()];
        uiState.healthAdvice = null;
    };
    const changed = () => {
        if (!available()) return;
        dirty = true;
        invalidate();
        schedule(250);
    };
    const tick = () => {
        timer = null;
        if (!available()) return;
        if (!dirty && viewState.healthRecheckBusy) { schedule(30000); return; }
        if (!dirty) { changed(); return; }
        if (viewState.healthRecheckBusy) return;
        dirty = false;
        nextAutomaticAt = performance.now() + 30000;
        void runHealthCheck().finally(() => {
            nextAutomaticAt = performance.now() + 30000;
            if (available()) schedule(dirty ? 250 : 30000);
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
        if (current === previous && owner.current()) return;
        previous = current;
        owner = captureConnectionOperation();
        changed();
    };
    const visibility = () => {
        if (document.hidden) { clear(); invalidate(); dirty = true; }
        else changed();
    };
    const storage = (event: StorageEvent) => {
        if (event.storageArea && event.storageArea !== appLocalStore) return;
        if (event.key !== null && !['zoew_firebase_config', 'zoew_lookup_api_config', 'zoe_license_activation_ZOE',
            'zoe_license_device_id', 'zoew-sb-auth', 'zoew-sb-account', 'zoew-sb-auth-owner'].includes(event.key)) return;
        changed();
    };
    const offs = [firebaseState, lookupState, securityState].map((store) => store.subscribe(stateChanged));
    offs.push(viewState.subscribe(() => {
        if (wasBusy && !viewState.healthRecheckBusy) nextAutomaticAt = performance.now() + 30000;
        wasBusy = viewState.healthRecheckBusy;
        stateChanged();
        if (dirty && !viewState.healthRecheckBusy) {
            if (healthCheckResultIsCurrent()) { dirty = false; schedule(30000); }
            else schedule(250);
        }
    }));
    window.addEventListener('online', changed);
    window.addEventListener('offline', changed);
    window.addEventListener('storage', storage);
    document.addEventListener('visibilitychange', visibility);
    const workers = navigator.serviceWorker;
    if (typeof workers?.addEventListener === 'function') scope.listen(workers, 'controllerchange', changed);
    schedule(30000);
    return () => {
        stopped = true;
        clear();
        ++uiState.healthRunSeq;
        offs.forEach((off) => off());
        window.removeEventListener('online', changed);
        window.removeEventListener('offline', changed);
        window.removeEventListener('storage', storage);
        document.removeEventListener('visibilitychange', visibility);
        scope.dispose();
    };
}
