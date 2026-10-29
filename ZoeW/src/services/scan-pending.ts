import { firebaseState } from '../core/state';
import { appLocalStore } from '../core/storage';
import { liveShopScope } from '../core/shop-scope';
import { getFormattedDate } from '../core/timezone';
import { getServerNow } from '../core/clock';
import { createScanEvidenceJournal } from './scan-evidence';
import { showToast } from '../ui/toast';

const scanEvidenceLive = new Set<string>();
let scanEvidenceNotice = '';

export function pendingScanScope() {
    const uid = firebaseState.auth && firebaseState.auth.currentUser && firebaseState.auth.currentUser.uid;
    const target = liveShopScope();
    return uid && target ? JSON.stringify([String(target), String(uid)]) : '';
}

export function preparePendingScan(barcode, cod, dod, stampMs = 0, mode = 'direct') {
    const scope = pendingScanScope();
    if (!scope || !firebaseState.db || !firebaseState.fb) throw Object.assign(new Error('Scan evidence scope unavailable'), { code: 'scan_evidence_unavailable' });
    const createdAt = Number(stampMs) > 0 ? Number(stampMs) : getServerNow();
    const record = createScanEvidenceJournal(appLocalStore).prepare(scope, {
        barcode, createdAt, cod, dod, scanDate: getFormattedDate(createdAt as any), mode
    });
    scanEvidenceLive.add(record.id);
    return { record, db: firebaseState.db, auth: firebaseState.authGeneration };
}

export function pendingScanIsCurrent(handle) {
    return !!handle && handle.db === firebaseState.db && handle.auth === firebaseState.authGeneration && handle.record.scope === pendingScanScope();
}

export function notePendingScan(handle, phase, itemId?) {
    if (!pendingScanIsCurrent(handle)) throw new Error('Scan evidence session changed');
    createScanEvidenceJournal(appLocalStore).append(handle.record, { phase, ...(itemId ? { itemId } : {}) });
    if (phase === 'claimed') handle.claimed = true;
}

export function releasePendingScan(handle) {
    if (handle && handle.record) scanEvidenceLive.delete(handle.record.id);
}

export function finishPendingScan(handle, proof) {
    if (!pendingScanIsCurrent(handle)) return false;
    try {
        const finished = createScanEvidenceJournal(appLocalStore).finish(handle.record, proof);
        releasePendingScan(handle);
        return finished === true;
    } catch (e) {
        releasePendingScan(handle);
        return false;
    }
}

export function settlePendingScanRelease(handle, compensation, released) {
    if (pendingScanIsCurrent(handle)) showToast(`⏳ (${handle.record.barcode}) មិនបានរក្សាទុក។ កំពុងផ្ទៀងការសងប្រាក់ និងដោះសោ Barcode — សូមកុំស្កេនម្ដងទៀត។`);
    return Promise.all([compensation, released]).then(([money, registry]) => {
        if (money === true && registry === true && finishPendingScan(handle, 'compensated-and-release-confirmed')) {
            showToast(`⚠️ (${handle.record.barcode}) មិនបានរក្សាទុក។ ស្ថិតិប្រាក់បានផ្ទៀង និងសោ Barcode បានដោះរួច — អាចស្កេនម្ដងទៀត។`);
            return true;
        }
        return false;
    }, () => false).finally(() => releasePendingScan(handle));
}

export function warnPendingScans() {
    const scope = pendingScanScope();
    if (!scope) return;
    let pending;
    try { pending = createScanEvidenceJournal(appLocalStore).list(scope).filter((entry) => !scanEvidenceLive.has(entry.id)); }
    catch (e) { pending = [{ id: 'unreadable' }]; }
    if (!pending.length) { scanEvidenceNotice = ''; return; }
    const signature = scope + '|' + pending.map((entry) => entry.id).sort().join('|');
    if (scanEvidenceNotice === signature) return;
    scanEvidenceNotice = signature;
    const codes = pending.slice(0, 3).map((entry) => entry.barcode || entry.id).join(', ');
    showToast(`⏳ ការស្កេន ${pending.length} មិនទាន់មានភស្តុតាងបញ្ចប់៖ ${codes}។ វាអាចកំពុងរក្សាទុកក្នុងផ្ទាំងផ្សេង។ កុំស្កេនម្ដងទៀត រហូតដល់ផ្ទៀងប្រាក់ និងបញ្ជីបាន។ បើបិទ App រួច សូមឱ្យ Admin ពិនិត្យ។`);
    if (window.ZoeErrors) ZoeErrors.capture(new Error('Unresolved scan evidence retained'), { zone: 'money', context: 'scan evidence pending', count: pending.length });
}
