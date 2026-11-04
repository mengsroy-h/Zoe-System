import { firebaseState } from '../core/state';
import { appLocalStore } from '../core/storage';
import { liveShopScope } from '../core/shop-scope';
import { getFormattedDate } from '../core/timezone';
import { getServerNow } from '../core/clock';
import { type ScanImportProof } from './scan-import-proof';
import { createScanEvidenceJournal, type ScanEvidenceRecord } from './scan-evidence';

import { showToast } from '../ui/toast';
import { viewState } from '../core/view-state';

export type PendingScanHandle = { record: ScanEvidenceRecord; db: typeof firebaseState.db; auth: number; sdk?: typeof firebaseState.fb; claimed?: boolean; settlement?: Promise<boolean> };

const scanEvidenceLive = new Map<string, PendingScanHandle>();
const scanEvidenceLocks = new Map<string, () => void>();
let scanEvidenceNotice = '';
export const SCAN_EVIDENCE_LOCK_PREFIX = 'zoew-scan-live:';

export function pendingScanScope() {
    const uid = firebaseState.auth && firebaseState.auth.currentUser && firebaseState.auth.currentUser.uid;
    const target = liveShopScope();
    return uid && target ? JSON.stringify([String(target), String(uid)]) : '';
}

function holdScanEvidenceLock(handle: PendingScanHandle) {
    const id = handle.record.id;
    const locks = typeof navigator !== 'undefined' && navigator.locks;
    if (!locks || typeof locks.request !== 'function') return;
    try {
        Promise.resolve(locks.request(SCAN_EVIDENCE_LOCK_PREFIX + id, () => new Promise<void>((resolve) => {
            if (scanEvidenceLive.get(id) !== handle) resolve();
            else scanEvidenceLocks.set(id, resolve);
        }))).catch(() => {});
    } catch (e) {}
}

export function preparePendingScan(barcode, cod, dod, stampMs = 0, mode = 'direct', version: 1 | 2 = 1, importProof?: ScanImportProof, pickupEpoch?: number): PendingScanHandle {
    const scope = pendingScanScope();
    if (!scope || !firebaseState.db || !firebaseState.fb) throw Object.assign(new Error('Scan evidence scope unavailable'), { code: 'scan_evidence_unavailable' });
    const createdAt = Number(stampMs) > 0 ? Number(stampMs) : getServerNow();
    const record = createScanEvidenceJournal(appLocalStore, version).prepare(scope, {
        barcode, createdAt, cod, dod, scanDate: getFormattedDate(createdAt as any), mode, ...(importProof === undefined ? {} : { importProof }),
        ...(pickupEpoch === undefined ? {} : { pickupEpoch })
    });
    const handle = { record, db: firebaseState.db, auth: firebaseState.authGeneration, sdk: firebaseState.fb };
    scanEvidenceLive.set(record.id, handle);
    holdScanEvidenceLock(handle);
    return handle;
}

export function pendingScanIsLive(id: string, handle?: PendingScanHandle) {
    const owner = scanEvidenceLive.get(id);
    return (!handle || owner === handle) && pendingScanIsCurrent(owner);
}

export function pendingScanIsCurrent(handle) {
    return !!handle && handle.db === firebaseState.db && handle.auth === firebaseState.authGeneration && handle.record.scope === pendingScanScope()
        && (handle.record.v !== 2 || handle.sdk === firebaseState.fb);
}

export function notePendingScan(handle, phase, itemId?) {
    if (!pendingScanIsCurrent(handle)) throw new Error('Scan evidence session changed');
    createScanEvidenceJournal(appLocalStore, handle.record.v === 2 ? 2 : 1).appendPhase(handle.record, { phase, ...(itemId ? { itemId } : {}) });
    if (phase === 'claimed') handle.claimed = true;
}

export function releasePendingScan(handle) {
    if (!handle || !handle.record) return;
    scanEvidenceLive.delete(handle.record.id);
    const unlock = scanEvidenceLocks.get(handle.record.id);
    scanEvidenceLocks.delete(handle.record.id);
    if (unlock) unlock();
}

export function finishPendingScan(handle, proof) {
    if (!pendingScanIsCurrent(handle)) return false;
    try {
        const finished = createScanEvidenceJournal(appLocalStore, handle.record.v === 2 ? 2 : 1).finish(handle.record, proof);
        releasePendingScan(handle);
        return finished === true;
    } catch (e) {
        releasePendingScan(handle);
        return false;
    }
}

export function settlePendingScanRelease(handle, compensation, releaseRegistry) {
    if (handle?.settlement) return handle.settlement;
    if (pendingScanIsCurrent(handle)) showToast(`⏳ (${handle.record.barcode}) មិនបានរក្សាទុក។ កំពុងផ្ទៀងការសងប្រាក់ និងដោះសោ Barcode — សូមកុំស្កេនម្ដងទៀត។`);
    const settlement = Promise.resolve(compensation).then(async (money) => {
        if (money !== true || !pendingScanIsCurrent(handle) || typeof releaseRegistry !== 'function') return false;
        const registry = await releaseRegistry();
        if (registry === true && finishPendingScan(handle, 'compensated-and-release-confirmed')) {
            showToast(`⚠️ (${handle.record.barcode}) មិនបានរក្សាទុក។ ស្ថិតិប្រាក់បានផ្ទៀង និងសោ Barcode បានដោះរួច — អាចស្កេនម្ដងទៀត។`);
            return true;
        }
        return false;
    }).catch(() => false).finally(() => releasePendingScan(handle));
    if (handle) handle.settlement = settlement;
    return settlement;
}


export function settlePendingScanClaim(handle, claim, releaseRegistry) {
    const unchanged = () => {
        if (!pendingScanIsCurrent(handle) || handle.claimed) return false;
        try {
            const saved = createScanEvidenceJournal(appLocalStore, handle.record.v === 2 ? 2 : 1).list(handle.record.scope).find((entry) => entry.id === handle.record.id);
            return saved && !saved.corrupt && saved.phase === 'claim-pending'
                && ['barcode', 'createdAt', 'cod', 'dod', 'scanDate', 'itemId', 'mode'].every((key) => saved[key] === handle.record[key]);
        } catch (e) { return false; }
    };
    if (!unchanged()) return Promise.resolve(false);
    if (claim === 'taken') return Promise.resolve(finishPendingScan(handle, 'not-started'));
    if (claim !== 'claimed') return Promise.resolve(false);
    return settlePendingScanRelease(handle, Promise.resolve(true), async () => {
        if (!unchanged()) return false;
        const released = await releaseRegistry();
        return released === true && unchanged();
    });
}

export function retainedPendingScans(scope = pendingScanScope()) {
    if (!scope) return [];
    const seen = new Set<string>();
    return ([1, 2] as const).flatMap((version) => createScanEvidenceJournal(appLocalStore, version).list(scope).map((entry) => ({ ...entry, v: version })))
        .filter((entry) => !pendingScanIsLive(entry.id) && !seen.has(entry.id) && !!seen.add(entry.id));
}

export const SCAN_EVIDENCE_EXIT_LABEL = 'បញ្ចប់ភស្តុតាងស្កេនរង់ចាំ';
export const SCAN_EVIDENCE_EXIT_HINT = 'បើនៅជាប់ សូមឲ្យម្ចាស់ហាងប្រើ ☰ ឧបករណ៍ ➜ «បញ្ចប់ភស្តុតាងស្កេនរង់ចាំ» (PIN)។';

export function scanEvidenceRefusalText(error, importing = false) {
    const after = importing ? ' ការបញ្ចូលត្រូវបានផ្អាក មុនប៉ះប្រាក់។' : '';
    if (error?.code === 'pickup_epoch_unavailable') return '⏳ មិនអាចផ្ទៀងផ្ទាត់ស្ថិតិយកពី server បាន —' + (after || ' មិនទាន់រក្សាទុក។') + ' សូមភ្ជាប់បណ្តាញ រួចសាកម្តងទៀត។';
    if (error?.reason === 'unresolved') return '⚠️ ឧបករណ៍នេះមានការស្កេនមិនទាន់បញ្ចប់ច្រើនពេកសម្រាប់ហាង និងគណនីនេះ — មិនទាន់ទទួលការស្កេនថ្មី។' + after
        + ' App ផ្ទៀងវាម្ដងទៀតពេលភ្ជាប់ Server; ' + SCAN_EVIDENCE_EXIT_HINT;
    return '⚠️ មិនអាចរក្សាទុកភស្តុតាងស្កេនក្នុងឧបករណ៍បាន។' + (after || ' សូមពិនិត្យទំហំផ្ទុក មុនសាកម្ដងទៀត។');
}

export function warnPendingScans() {
    const scope = pendingScanScope();
    if (!scope) { viewState.scanEvidenceRetained = 0; return; }
    let pending;
    try { pending = retainedPendingScans(scope); }
    catch (e) { pending = [{ id: 'unreadable' }]; }
    viewState.scanEvidenceRetained = pending.length;
    if (!pending.length) { scanEvidenceNotice = ''; return; }
    const signature = firebaseState.authGeneration + '|' + scope + '|' + pending.map((entry) => entry.id + ':' + entry.phase).sort().join('|');
    if (scanEvidenceNotice === signature) return;
    scanEvidenceNotice = signature;
    const unconfirmed = pending.filter(entry => entry.phase !== 'collected-pending');
    const codes = unconfirmed.slice(0, 3).map((entry) => entry.barcode || entry.id).join(', ');
    const collected = pending.filter(entry => entry.phase === 'collected-pending');
    if (collected.length) showToast(`⏳ កញ្ចប់ ${collected.length} បានរក្សាទុក និងផ្ទៀងប្រាក់រួច ប៉ុន្តែចំណូលយករួចនៅរង់ចាំផ្ទៀង៖ ${collected.slice(0, 3).map(entry => entry.barcode).join(', ')}។ App ផ្ទៀងម្ដងទៀតពេលភ្ជាប់ Server — ${SCAN_EVIDENCE_EXIT_HINT}`);
    if (unconfirmed.length) showToast(`⏳ ការស្កេន ${unconfirmed.length} មិនទាន់មានភស្តុតាងបញ្ចប់៖ ${codes}។ វាអាចកំពុងរក្សាទុកក្នុងផ្ទាំងផ្សេង។ កុំស្កេនម្ដងទៀត រហូតដល់ផ្ទៀងប្រាក់ និងបញ្ជីបាន។ ${SCAN_EVIDENCE_EXIT_HINT}`);
    if (window.ZoeErrors) ZoeErrors.capture(new Error('Unresolved scan evidence retained'), { zone: 'money', context: 'scan evidence pending', count: pending.length });
}
