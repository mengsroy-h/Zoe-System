import { firebaseState } from '../core/state';
import { appLocalStore, safeStoreGet } from '../core/storage';
import { DB_LIVENESS_PROBE_PATH, DB_LIVENESS_PROBE_TIMEOUT_MS } from '../services/connection';
import { captureConnectionOperation } from '../services/connection-flow';
import { withTimeout } from '../services/network';
import { isSupabaseConfig } from '../services/supabase-config';
import { txReadServerValue, txRestUrl } from '../services/tx-outcome';

export async function healthDatabaseRead(signal?: AbortSignal): Promise<boolean | null> {
    const operation = captureConnectionOperation();
    const current = () => !signal?.aborted && operation.current();
    try {
        const sdk = firebaseState.fb;
        const database = firebaseState.db;
        if (!sdk || !database || typeof sdk.ref !== 'function' || !firebaseState.auth?.currentUser || !current()) return null;
        const config = firebaseState.firebaseConfig || JSON.parse(safeStoreGet(appLocalStore, 'zoew_firebase_config') || 'null');
        const reference = sdk.ref(database, DB_LIVENESS_PROBE_PATH);
        if (isSupabaseConfig(config)) {
            if (typeof sdk.getForHealth !== 'function') return null;
            const snapshot = await withTimeout(Promise.resolve(sdk.getForHealth(reference, DB_LIVENESS_PROBE_TIMEOUT_MS, current, signal)), DB_LIVENESS_PROBE_TIMEOUT_MS, 'Health database read timed out');
            if (!current() || !snapshot || typeof snapshot.val !== 'function') return null;
            const value = snapshot.val();
            return value === null || value === true ? true : null;
        }
        const restUrl = txRestUrl(reference);
        if (!restUrl) return null;
        const value = await txReadServerValue(restUrl, DB_LIVENESS_PROBE_TIMEOUT_MS, current, signal);
        return current() && (value === null || value === true) ? true : null;
    } catch (error) {
        if (!current()) return null;
        return /^(?:Health database read|Transaction outcome (?:token|read)) timed out$/.test(String(error?.message || '')) ? false : null;
    }
}
