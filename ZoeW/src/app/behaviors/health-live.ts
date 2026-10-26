import { captureConnectionOperation } from '../../services/connection-flow';
import { createLifecycleScope } from '../lifecycle/scope';
import { firebaseState, lookupState, securityState, uiState } from '../../core/state';
import { viewState } from '../../core/view-state';
import { appLocalStore, safeStoreGet } from '../../core/storage';
import { modalIsOpen } from '../../core/modals';
import { healthPendingRow } from '../components/health/model';
import { healthCheckResultIsCurrent, healthClockRow, healthDatabaseRow, healthDatabaseWriteRow, healthNetworkRow, runHealthCheck } from '../../features/health-check';

export function watchHealthCheck() {
    const scope = createLifecycleScope();
    let stopped = false;
    let dirty = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const signature = () => JSON.stringify([
        firebaseState.authGeneration, firebaseState.auth?.currentUser?.uid,
        firebaseState.auth?._account, firebaseState.auth?._accountUnverified,
        healthDatabaseRow(), healthDatabaseWriteRow(), healthClockRow(),
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
        if (available()) timer = setTimeout(tick, ms);
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
        void runHealthCheck().finally(() => { if (available()) schedule(dirty ? 250 : 30000); });
    };
    const stateChanged = () => {
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
    const offs = [firebaseState, lookupState, securityState].map((store) => store.subscribe(stateChanged));
    offs.push(viewState.subscribe(() => {
        stateChanged();
        if (dirty && !viewState.healthRecheckBusy) {
            if (healthCheckResultIsCurrent()) { dirty = false; schedule(30000); }
            else schedule(250);
        }
    }));
    window.addEventListener('online', changed);
    window.addEventListener('offline', changed);
    window.addEventListener('storage', changed);
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
        window.removeEventListener('storage', changed);
        document.removeEventListener('visibilitychange', visibility);
        scope.dispose();
    };
}
