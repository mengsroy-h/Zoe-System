import { securityState } from '../core/state';
import { appLocalStore, safeStoreGet } from '../core/storage';
import { captureConnectionOperation } from './connection-flow';

export function captureLookupOperation() {
    const connection = captureConnectionOperation();
    const config = safeStoreGet(appLocalStore, 'zoew_lookup_api_config');
    const key = securityState.lookupSecretKey;
    const current = () => connection.current() && config === safeStoreGet(appLocalStore, 'zoew_lookup_api_config')
        && key === securityState.lookupSecretKey;
    return {
        current,
        assertCurrent() {
            if (!current()) throw Object.assign(new Error('Lookup session changed'), { code: 'CONNECTION_SCOPE_CHANGED', noRetry: true });
        }
    };
}
