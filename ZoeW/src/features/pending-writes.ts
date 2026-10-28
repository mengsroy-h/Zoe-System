import { firebaseState } from '../core/state';
import { requestPinBeforeConfig } from './pin';
import { drawerAction } from '../ui/page-nav';
import { showToast } from '../ui/toast';
import { withTimeout } from '../services/network';
import { DB_LIVENESS_PROBE_TIMEOUT_MS, renderConnectionStatus } from '../services/connection';
import { connectionFlowSnapshot } from '../services/connection-flow';

export const PENDING_WRITES_DISCARD_PATHS_MAX = 20;

export function drawerDiscardPendingWritesFlow() {
    drawerAction(function () { requestPinBeforeConfig(discardPendingWrites, 'discardPendingWrites'); });
}

export async function discardPendingWrites() {
    const sdk = firebaseState.fb;
    const database = firebaseState.db;
    if (!sdk || !database || typeof sdk.discardPendingWrites !== 'function') {
        showToast('⚠️ មិនទាន់ភ្ជាប់ហាង — មិនអាចលុបការសរសេររង់ចាំបានទេ');
        return false;
    }
    if (connectionFlowSnapshot().phase !== 'blocked') {
        showToast('ℹ️ គ្មានការសរសេររង់ចាំដែលរារាំងទេ');
        return false;
    }
    if (!confirm('លុបការសរសេររង់ចាំដែលផ្ទៀងផ្ទាត់មិនបាន?\n\n· ការសរសេរទាំងនោះមិនត្រូវអនុវត្តឡើងវិញទេ\n· សូមពិនិត្យកញ្ចប់ និងចំណូលថ្ងៃនេះដោយដៃក្រោយលុប\n· ការសរសេរថ្មីដំណើរការបន្តដូចធម្មតា')) return false;
    const generationAtStart = firebaseState.authGeneration;
    const result = (await sdk.discardPendingWrites(database)) || { count: 0, paths: [] };
    if (window.ZoeErrors) {
        ZoeErrors.capture(new Error('Pending writes discarded by the owner'), { zone: 'money', context: 'discardPendingWrites',
            count: result.count, paths: result.paths.slice(0, PENDING_WRITES_DISCARD_PATHS_MAX).join(' · ') });
    }
    if (firebaseState.authGeneration !== generationAtStart || firebaseState.db !== database || firebaseState.fb !== sdk) return false;
    try { await withTimeout(sdk.retryWriteRecovery(database), DB_LIVENESS_PROBE_TIMEOUT_MS, 'Write verification timed out'); } catch (e) {}
    if (firebaseState.authGeneration !== generationAtStart || firebaseState.db !== database || firebaseState.fb !== sdk) return false;
    renderConnectionStatus();
    showToast(result.count
        ? '✅ បានលុបការសរសេររង់ចាំ ' + result.count + ' — សូមផ្ទៀងផ្ទាត់កញ្ចប់ និងចំណូលដោយដៃ'
        : 'ℹ️ គ្មានការសរសេររង់ចាំទេ');
    return true;
}
