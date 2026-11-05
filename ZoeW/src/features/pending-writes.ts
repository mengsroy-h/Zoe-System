import { firebaseState } from '../core/state';
import { requestPinBeforeConfig } from './pin';
import { drawerAction } from '../ui/page-nav';
import { showToast } from '../ui/toast';
import { withTimeout } from '../services/network';
import { DB_LIVENESS_PROBE_TIMEOUT_MS, renderConnectionStatus } from '../services/connection';
import { connectionFlowSnapshot } from '../services/connection-flow';
import { resolveRetainedScanEvidence } from '../services/scan-operation';
import { pendingScanScope, retainedPendingScans, SCAN_EVIDENCE_EXIT_LABEL } from '../services/scan-pending';
import { ownPriceOperations, settleStuckPriceOperations } from '../services/price-operation';
import { PRICE_EXIT_LABEL } from '../core/text';
import { viewState } from '../core/view-state';

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
        ZoeErrors.capture(new Error(result.failed ? 'Pending writes could not be discarded' : 'Pending writes discarded by the owner'), { zone: 'money', context: 'discardPendingWrites',
            count: result.count, failed: result.failed || 0, paths: result.paths.slice(0, PENDING_WRITES_DISCARD_PATHS_MAX).join(' · ') });
    }
    if (firebaseState.authGeneration !== generationAtStart || firebaseState.db !== database || firebaseState.fb !== sdk) return false;
    if (result.failed) {
        renderConnectionStatus();
        showToast('⚠️ មិនអាចបញ្ជាក់ការលុបការសរសេររង់ចាំ ' + result.failed + ' — រក្សាភស្តុតាង និងផ្ទៀងផ្ទាត់មុនបន្ត');
        return false;
    }
    try { await withTimeout(sdk.retryWriteRecovery(database), DB_LIVENESS_PROBE_TIMEOUT_MS, 'Write verification timed out'); } catch (e) {}
    if (firebaseState.authGeneration !== generationAtStart || firebaseState.db !== database || firebaseState.fb !== sdk) return false;
    renderConnectionStatus();
    showToast(result.count
        ? '✅ បានលុបការសរសេររង់ចាំ ' + result.count + ' — សូមផ្ទៀងផ្ទាត់កញ្ចប់ និងចំណូលដោយដៃ'
        : 'ℹ️ គ្មានការសរសេររង់ចាំទេ');
    return true;
}

export function drawerResolveScanEvidenceFlow() {
    drawerAction(function () { requestPinBeforeConfig(resolveScanEvidence, 'resolveScanEvidence'); });
}

export function drawerResolvePriceOperationsFlow() {
    drawerAction(function () { requestPinBeforeConfig(resolvePriceOperations, 'resolvePriceOperations'); });
}

export async function resolvePriceOperations() {
    if (!firebaseState.db || !firebaseState.fb) {
        showToast('⚠️ មិនទាន់ភ្ជាប់ហាង — មិនអាច' + PRICE_EXIT_LABEL + 'បានទេ');
        return false;
    }
    const count = viewState.priceOperationsStuck;
    if (!count || !ownPriceOperations().length) {
        showToast('ℹ️ គ្មានការកែតម្លៃដែលជាប់ទេ');
        return false;
    }
    if (!firebaseState.isDatabaseConnected || (navigator.onLine as boolean) === false) {
        showToast('⚠️ ត្រូវភ្ជាប់ Server មុន ដើម្បីអានការកែតម្លៃដែលជាប់ — សូមភ្ជាប់បណ្តាញ រួចសាកម្ដងទៀត');
        return false;
    }
    if (!confirm(PRICE_EXIT_LABEL + ' ' + count + '?\n\n· ការកែដែលមានភស្តុតាងលើ Server ៖ App បញ្ចប់ ឬបោះបង់វាតាមភស្តុតាងនោះ (ប្រាក់ត្រូវតែម្តង)\n· ការកែដែលគ្មានភស្តុតាងប្រាក់ ៖ មិនទាន់រក្សាទុកតម្លៃថ្មី ➜ រក្សាតម្លៃចាស់ · រក្សាទុករួច ➜ បញ្ចប់ — App មិនកែប្រាក់ទេ ព្រោះគ្មានភស្តុតាងថាប្រាក់ចូលស្ថិតិឬនៅ\n· សូមប្រាកដថាគ្មានទូរស័ព្ទណាកំពុងកែកញ្ចប់ទាំងនោះ ហើយពិនិត្យចំណូលថ្ងៃរបស់វាដោយដៃក្រោយបញ្ចប់')) return false;
    const generationAtStart = firebaseState.authGeneration;
    const result = await settleStuckPriceOperations();
    if (firebaseState.authGeneration !== generationAtStart) return false;
    showToast(result.kept
        ? '⚠️ បានបញ្ចប់ ' + result.settled + ' · នៅសល់ ' + result.kept + ' (កំពុងដំណើរការ ឬអាន Server មិនបាន) — សូមសាកម្ដងទៀត'
        : '✅ បានបញ្ចប់ការកែតម្លៃដែលជាប់ ' + result.settled + ' — សូមពិនិត្យចំណូលថ្ងៃរបស់កញ្ចប់ទាំងនោះដោយដៃ');
    return result.settled > 0;
}

export async function resolveScanEvidence() {
    if (!firebaseState.db || !firebaseState.fb || !pendingScanScope()) {
        showToast('⚠️ មិនទាន់ភ្ជាប់ហាង — មិនអាច' + SCAN_EVIDENCE_EXIT_LABEL + 'បានទេ');
        return false;
    }
    let count = 0;
    try { count = retainedPendingScans().length; } catch (e) { count = 1; }
    if (!count) {
        showToast('ℹ️ គ្មានភស្តុតាងស្កេនរង់ចាំទេ');
        return false;
    }
    if (!firebaseState.isDatabaseConnected || (navigator.onLine as boolean) === false) {
        showToast('⚠️ ត្រូវភ្ជាប់ Server មុន ដើម្បីអានលទ្ធផលពិតនៃការស្កេនរង់ចាំ — សូមភ្ជាប់បណ្តាញ រួចសាកម្ដងទៀត');
        return false;
    }
    if (!confirm(SCAN_EVIDENCE_EXIT_LABEL + ' ' + count + '?\n\n· App អាន Server ម្ដងទៀត ហើយបញ្ចប់ការស្កេនដែល Server បញ្ជាក់លទ្ធផល\n· ភស្តុតាងដែលនៅតែផ្ទៀងមិនបាន ត្រូវលុបចេញពីឧបករណ៍នេះ — មិនប៉ះប្រាក់ កញ្ចប់ ឬស្ថិតិលើ Server ទេ\n· សូមពិនិត្យកញ្ចប់ និងចំណូលរបស់ Barcode ទាំងនោះដោយដៃក្រោយបញ្ចប់')) return false;
    const generationAtStart = firebaseState.authGeneration;
    const result = await resolveRetainedScanEvidence();
    if (firebaseState.authGeneration !== generationAtStart) return false;
    if (result.status === 'busy') {
        showToast('⏳ App កំពុងផ្ទៀងភស្តុតាងស្កេន — សូមរង់ចាំបន្តិច រួចសាកម្ដងទៀត');
        return false;
    }
    if (result.status !== 'done') {
        showToast('⚠️ មិនអាចអានលទ្ធផលពី Server ឥឡូវនេះទេ — គ្មានភស្តុតាងត្រូវបានលុប សូមសាកម្ដងទៀត');
        return false;
    }
    const kept = result.kept ? ' · រក្សាទុក ' + result.kept + ' (កំពុងដំណើរការ ឬអាន Server មិនបាន)' : '';
    showToast(result.dropped
        ? '✅ បានបញ្ចប់ ' + result.finished + ' · លុបភស្តុតាងដែលផ្ទៀងមិនបាន ' + result.dropped + kept + ' — សូមពិនិត្យកញ្ចប់ និងចំណូលរបស់ Barcode ទាំងនោះដោយដៃ'
        : '✅ បានបញ្ចប់ការស្កេនដែល Server បញ្ជាក់ ' + result.finished + kept);
    return true;
}
