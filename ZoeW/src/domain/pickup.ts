import { rowOperationActive } from '../services/row-operation-lock';
import { dataState, firebaseState } from '../core/state';
import { liveShopScope, shopScope, shopScopePending } from '../core/shop-scope';
import { appLocalStore, safeStoreGet, safeStoreRemove, safeStoreSet } from '../core/storage';
import { CLEANUP_JOURNAL_KEY, CLEANUP_LEGACY_JOURNAL_KEY, PICKUP_JOURNAL_KEY } from '../core/storage-keys';
import { DB_LISTENER_KEY_DELETED, DB_LISTENER_KEY_HISTORY } from '../core/text';
import { getServerNow } from '../core/clock';
import { getFormattedDate } from '../core/timezone';
import { CLEANUP_LEDGER_RETRY_MAX, cleanupJournalEntryKey, cleanupJournalStorageKeys, readCleanupJournal } from './cleanup';
import { reconcileCollectedHistory } from './collected';
import { applyBarcodeCloseState, barcodeEntriesOf, barcodeSignIdentity, barcodeZtoSigned, dropStaleRestoreMarkers, generateUniqueId, itemHasRestoreMarkers, normalizeBarcodesOf } from './barcode';
import { barcodeRegistryKey } from './registry';
import { restorePendingCode } from '../features/restore';
import { trashReasonDeducted } from '../features/trash';
import { dbListenerViewIsStale } from '../services/db-listeners';
import { dbOp } from '../services/network';
import { TX_ROOT_READ_TIMEOUT_MS, txReadServerValue, txRestUrl, txSameValue } from '../services/tx-outcome';
import { showToast } from '../ui/toast';

export const PICKUP_PHONE_KEY_MAX = 64;

export function getPickupPhoneKey(item) {
    const rawPhone = item && item.phone;
    if (!rawPhone || rawPhone === "គ្មានលេខ") return '__item_' + (item && item.id);
    const safePhone = String(rawPhone).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, PICKUP_PHONE_KEY_MAX);
    return safePhone || ('__item_' + (item && item.id));
}

export function countPickedUpCustomers(record) {
    return record && record.pickedUpPhones ? Object.keys(record.pickedUpPhones).length : 0;
}

export function pickupBarcodeKey(code) {
    const raw = String(code === undefined || code === null ? '' : code).trim();
    return raw ? barcodeRegistryKey(raw) : '';
}

export function pickupSetSize(set) {
    return (set && typeof set === 'object') ? Object.keys(set).length : 0;
}

export function tallyPickupPhones(set) {
    const phones = {};
    Object.keys(set || {}).forEach((key) => {
        const phone = set[key];
        if (typeof phone !== 'string' || !phone) return;
        phones[phone] = (phones[phone] || 0) + 1;
    });
    return phones;
}

export function pickupSetFromRecord(record) {
    return record && record.pickedUpBarcodes && typeof record.pickedUpBarcodes === 'object' ? { ...record.pickedUpBarcodes } : {};
}

export function buildPickupRecordFromSet(set, metadata?) {
    const size = pickupSetSize(set);
    const phones = tallyPickupPhones(set);
    return {
        ...(metadata ? { pickupRevision: metadata.revision, pickupResetEpoch: metadata.epoch } : {}),
        packagesPickedUp: size,
        pickedUpPhones: Object.keys(phones).length ? phones : null,
        pickedUpBarcodes: size ? { ...set } : null
    };
}

export function applyPickupMarksToSet(set, marks, existingOnly = false) {
    (marks || []).forEach((mark) => {
        if (!mark || !mark.key) return;
        if (existingOnly && !Object.prototype.hasOwnProperty.call(set, mark.key)) return;
        if (mark.closed) {
            if (typeof mark.phoneKey === 'string' && mark.phoneKey) set[mark.key] = mark.phoneKey;
        } else delete set[mark.key];
    });
    return set;
}

export function collectPickupMarks(item, closed?, phoneKey?) {
    if (!item) return [];
    const owner = phoneKey || getPickupPhoneKey(item);
    const marks = [];
    (Array.isArray(item.barcodes) ? item.barcodes : []).forEach((b) => {
        if (!b) return;
        const key = pickupBarcodeKey(b.code);
        if (key) marks.push({ key: key, phoneKey: owner, closed: closed === undefined ? !!b.isClosed : !!closed });
    });
    return marks;
}

export function pickupCopyMarks(item, inTrash) {
    if (!item) return [];
    if (inTrash) return collectPickupMarks(item, trashReasonDeducted(item) ? false : undefined);
    const marks = collectPickupMarks(item);
    if (!itemHasRestoreMarkers(item)) return marks;
    const codes = barcodeEntriesOf(item.barcodes).map(({ barcode }) => barcode && barcode.code);
    const pending = new Set(codes.filter((code) => restorePendingCode(item, code)).map(pickupBarcodeKey));
    return marks.filter((mark) => !pending.has(mark.key));
}

export function applyPickupMarksInMemory(scanDateStr, marks, existingOnly = false) {
    const set = pickupSetFromRecord(dataState.dailyPickupData[scanDateStr] || null);
    const previous = (marks || []).filter((m) => m && m.key).map((m) => ({
        key: m.key,
        phoneKey: typeof set[m.key] === 'string' ? set[m.key] : null,
        closed: Object.prototype.hasOwnProperty.call(set, m.key)
    }));
    applyPickupMarksToSet(set, marks, existingOnly);
    const record = dataState.dailyPickupData[scanDateStr];
    const next = buildPickupRecordFromSet(set, record?.pickupRevision ? { revision: record.pickupRevision, epoch: record.pickupResetEpoch } : undefined);
    dataState.dailyPickupData[scanDateStr] = {
        ...next,
        packagesPickedUp: next.packagesPickedUp,
        pickedUpPhones: next.pickedUpPhones || {},
        pickedUpBarcodes: next.pickedUpBarcodes || {}
    };
    const changed = previous.some((p, i) => {
        const mark = marks[i];
        return !!p.closed !== !!mark.closed || (mark.closed && p.phoneKey !== mark.phoneKey);
    });
    return { previous: previous, changed: changed };
}

const PICKUP_KEY_ADD_MAX = 2000;
let pickupAddClock = 0;
const pickupKeyLastAdd = new Map<string, number>();

export function pickupAddClockNow() {
    return pickupAddClock;
}

export function pickupKeyAddedSince(key, since) {
    return (pickupKeyLastAdd.get(key) || 0) > since;
}

function notePickupKeyAdds(marks) {
    (marks || []).forEach((m) => {
        if (!m || !m.key || !m.closed) return;
        pickupKeyLastAdd.delete(m.key);
        pickupKeyLastAdd.set(m.key, ++pickupAddClock);
    });
    for (let excess = pickupKeyLastAdd.size - PICKUP_KEY_ADD_MAX; excess > 0; excess--) {
        pickupKeyLastAdd.delete(pickupKeyLastAdd.keys().next().value);
    }
}

export const PICKUP_PROTOCOL_MAX = 9007199254740990;
export const PICKUP_JOURNAL_V2_PREFIX = 'zoew_pickup_journal_v2:';
export const PICKUP_JOURNAL_MAX = 200;
export const PICKUP_JOURNAL_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
export const pickupIntentsLive = new Set<string>();
let pickupStorageFailure = '';
let pickupReadFailed = false;
const pickupPageOwner = generateUniqueId();
const pickupLocks = new Map<string, () => void>();
const pickupOwners = new Map<string, any>();
let pickupResumeOwner = null;

export function pickupMetadata(record) {
    const revision = record?.pickupRevision;
    const epoch = record?.pickupResetEpoch;
    if (revision === undefined && epoch === undefined) return { revision: 0, epoch: 0 };
    if (!Number.isSafeInteger(revision) || revision < 1 || revision > PICKUP_PROTOCOL_MAX || !Number.isSafeInteger(epoch) || epoch < 0 || epoch > PICKUP_PROTOCOL_MAX) throw new Error('PICKUP_PROTOCOL_INVALID');
    return { revision, epoch };
}

function pickupJournalChanged() {
    dataState.pickupPendingVersion++;
}

export function pickupContextIsCurrent(context) {
    return !!context && !firebaseState.isInitializingFirebase && !shopScopePending() && context.db === firebaseState.db && context.sdk === firebaseState.fb && context.generation === firebaseState.authGeneration
        && context.scope === liveShopScope() && context.uid === firebaseState.auth?.currentUser?.uid;
}

async function readPickupDay(context) {
    const ref = context.sdk.ref(context.db, `zoew_daily_pickup_cod_dod/${context.date}`);
    const url = txRestUrl(ref);
    const raw = url ? await txReadServerValue(url, TX_ROOT_READ_TIMEOUT_MS) : (await dbOp(context.sdk.get(ref))).val();
    if (!pickupContextIsCurrent(context)) throw new Error('PICKUP_CONTEXT_CHANGED');
    return raw;
}

export async function capturePickupContext(date, original?) {
    const context = original || { db: firebaseState.db, sdk: firebaseState.fb, generation: firebaseState.authGeneration,
        scope: liveShopScope(), uid: firebaseState.auth?.currentUser?.uid, date };
    if (!pickupContextIsCurrent(context) || context.date !== date || !context.db || !context.sdk || !context.scope || !context.uid) throw new Error('PICKUP_CONTEXT_CHANGED');
    const ref = context.sdk.ref(context.db, `zoew_daily_pickup_cod_dod/${date}`);
    let raw = await readPickupDay(context);
    if (!pickupContextIsCurrent(context)) throw new Error('PICKUP_CONTEXT_CHANGED');
    let metadata = pickupMetadata(raw);
    if (!metadata.revision) {
        await dbOp(context.sdk.runTransaction(ref, (current) => {
            if (!pickupContextIsCurrent(context)) return;
            const found = pickupMetadata(current);
            if (found.revision) return;
            return { ...(current || { packagesPickedUp: 0 }), pickupRevision: 1, pickupResetEpoch: 0 };
        }));
        raw = await readPickupDay(context);
        if (!pickupContextIsCurrent(context)) throw new Error('PICKUP_CONTEXT_CHANGED');
        metadata = pickupMetadata(raw);
        if (!metadata.revision) throw new Error('PICKUP_FENCE_UNCONFIRMED');
    }
    if (original && metadata.epoch !== original.epoch) {
        if (original.intent) patchPickupJournalEntry(original.intent, { hold: 'reset-conflict' });
        throw new Error('PICKUP_RESET_CHANGED');
    }
    return { ...context, ...metadata, presentKeys: Object.keys(pickupSetFromRecord(raw)) };
}

export function pickupResetRecord(current) {
    const metadata = pickupMetadata(current);
    if (metadata.revision >= PICKUP_PROTOCOL_MAX || metadata.epoch >= PICKUP_PROTOCOL_MAX) return;
    return buildPickupRecordFromSet({}, { revision: metadata.revision + 1, epoch: metadata.epoch + 1 });
}

export async function commitPickupMarks(scanDateStr, marks, existingOnly = false, quiet = false, keep?: (key: string) => boolean, context?, compareRevision = false) {
    notePickupKeyAdds(marks);
    try {
        const owner = context ? await context : await capturePickupContext(scanDateStr);
        if (!pickupContextIsCurrent(owner) || owner.date !== scanDateStr) return null;
        if (owner.intent && readPickupJournal().find((entry) => entry.id === owner.intent)?.stage !== 'started') return null;
        let refusal = 'version-conflict';
        const ref = owner.sdk.ref(owner.db, `zoew_daily_pickup_cod_dod/${scanDateStr}`);
        await dbOp(owner.sdk.get(ref));
        if (!pickupContextIsCurrent(owner)) return null;
        const result = await owner.sdk.runTransaction(ref, (current) => {
            if (!pickupContextIsCurrent(owner)) return;
            const metadata = pickupMetadata(current);
            if (metadata.epoch !== owner.epoch) { refusal = 'reset-conflict'; return; }
            if (compareRevision && metadata.revision !== owner.revision || metadata.revision >= PICKUP_PROTOCOL_MAX) return;
            const set = pickupSetFromRecord(current);
            const proof = owner.intent ? readPickupJournal().find((entry) => entry.id === owner.intent) : null;
            if (owner.intent && proof?.stage !== 'started') return;
            const allowed = (marks || []).filter((mark) => mark && (!keep || keep(mark.key)) && (!mark.closed || !proof || proof.allowedAddKeys?.includes(mark.key)));
            applyPickupMarksToSet(set, allowed, existingOnly);
            return buildPickupRecordFromSet(set, { revision: metadata.revision + 1, epoch: metadata.epoch });
        });
        if (!pickupContextIsCurrent(owner)) return null;
        if (result?.committed) {
            const saved = result.snapshot.val();
            dataState.dailyPickupData[scanDateStr] = { ...saved, pickedUpPhones: saved?.pickedUpPhones || {}, pickedUpBarcodes: saved?.pickedUpBarcodes || {} };
            return true;
        }
        if (owner.intent) patchPickupJournalEntry(owner.intent, { hold: refusal });
    } catch (e) {
        if (!quiet) showToast("⚠️ ស្ថិតិយកកំពុងរង់ចាំផ្ទៀងផ្ទាត់ — សូមរង់ចាំ Sync។");
    }
    return null;
}

export function markPickupBarcodes(scanDateStr, marks, existingOnly = false, context?, compareRevision = false) {
    if (!scanDateStr) scanDateStr = getFormattedDate();
    const list = (marks || []).filter((m) => m && m.key);
    if (!list.length) return null;
    const owner = context || capturePickupContext(scanDateStr);
    const applied = applyPickupMarksInMemory(scanDateStr, list, existingOnly);
    const commit = commitPickupMarks(scanDateStr, list, existingOnly, false, undefined, owner, compareRevision);
    return { scanDate: scanDateStr, marks: list, previous: applied.previous, changed: applied.changed, commit, context: owner, ...(existingOnly ? { existingOnly: true } : {}) };
}

export function readPickupJournal() {
    try {
        if (!appLocalStore) throw new Error('PICKUP_STORAGE_UNAVAILABLE');
        const entries = [];
        for (let i = 0; i < appLocalStore.length; i++) {
            const key = appLocalStore.key(i);
            if (!key?.startsWith(PICKUP_JOURNAL_V2_PREFIX)) continue;
            const entry = JSON.parse(appLocalStore.getItem(key));
            if (!entry || entry.protocol !== 2 || typeof entry.id !== 'string' || key !== PICKUP_JOURNAL_V2_PREFIX + entry.id || typeof entry.date !== 'string' || !/^[0-9-]+$/.test(entry.date) || !Array.isArray(entry.keys)) throw new Error('PICKUP_JOURNAL_INVALID');
            entries.push(entry);
        }
        pickupReadFailed = false;
        return entries;
    } catch (e) {
        pickupStorageFailure = liveShopScope();
        pickupReadFailed = true;
        return [];
    }
}

export function writePickupJournal(entries) {
    let saved = true;
    for (const entry of entries || []) {
        const key = PICKUP_JOURNAL_V2_PREFIX + entry.id;
        const raw = JSON.stringify(entry);
        if (!safeStoreSet(appLocalStore, key, raw) || safeStoreGet(appLocalStore, key) !== raw) saved = false;
    }
    if (!saved) pickupStorageFailure = liveShopScope();
    else pickupStorageFailure = '';
    pickupJournalChanged();
    return saved;
}

function removePickupJournalEntry(id) {
    const key = PICKUP_JOURNAL_V2_PREFIX + id;
    const saved = safeStoreRemove(appLocalStore, key) && safeStoreGet(appLocalStore, key) === null;
    if (!saved) pickupStorageFailure = liveShopScope();
    pickupJournalChanged();
    return saved;
}

function completeResetCancelledPickup(entry, epoch) {
    const prefix = 'zoew_pickup_completed_v2:';
    const key = prefix + entry.id;
    const receipt = JSON.stringify({ id: entry.id, scope: entry.scope, uid: entry.uid, date: entry.date,
        originalResetEpoch: entry.pickupResetEpoch, observedResetEpoch: epoch, outcome: 'reset-cancelled', completedAt: Date.now() });
    if (!safeStoreSet(appLocalStore, key, receipt) || safeStoreGet(appLocalStore, key) !== receipt) {
        pickupStorageFailure = liveShopScope();
        pickupJournalChanged();
        return false;
    }
    try {
        const receipts = [];
        for (let i = 0; i < appLocalStore.length; i++) {
            const storedKey = appLocalStore.key(i);
            if (storedKey?.startsWith(prefix) && storedKey !== key) receipts.push({ key: storedKey, at: JSON.parse(appLocalStore.getItem(storedKey)).completedAt || 0 });
        }
        receipts.sort((a, b) => a.at - b.at).slice(0, Math.max(0, receipts.length - PICKUP_JOURNAL_MAX + 1)).forEach((old) => safeStoreRemove(appLocalStore, old.key));
    } catch (e) {}
    return removePickupJournalEntry(entry.id);
}

export function pickupPendingSummary() {
    const scope = liveShopScope();
    const uid = firebaseState.auth?.currentUser?.uid;
    if (!scope || !uid) return { total: 0, held: 0, reasons: [] };
    const allEntries = readPickupJournal();
    const entries = allEntries.filter((entry) => entry.scope === scope && entry.uid === uid);
    const reasons = new Set<string>(entries.map((entry) => entry.hold || 'recovery-pending'));
    if (allEntries.length >= PICKUP_JOURNAL_MAX) reasons.add('capacity');
    let legacy = 0;
    let cleanupHeld = 0;
    let cleanupPending = 0;
    try {
        const cleanups = readCleanupJournal();
        const valid = new Set(cleanups.map(cleanupJournalEntryKey));
        const prefix = CLEANUP_JOURNAL_KEY + encodeURIComponent(scope) + ':';
        if (cleanupJournalStorageKeys().some((key) => key.startsWith(prefix) && !valid.has(key))) reasons.add('storage-unavailable');
        cleanups.filter((entry) => entry.scope === scope && entry.actorUid === uid && (entry.pickupHold || entry.stage === 'collected' && Number.isSafeInteger(entry.pickupResetEpoch)))
            .forEach((entry) => { cleanupPending++; if (entry.pickupHold) cleanupHeld++; reasons.add(entry.pickupHold || 'recovery-pending'); });
        for (const key of [PICKUP_JOURNAL_KEY, CLEANUP_LEGACY_JOURNAL_KEY]) {
            const old = JSON.parse(safeStoreGet(appLocalStore, key) || '[]');
            if (!Array.isArray(old)) throw new Error('JOURNAL_LEGACY_INVALID');
            legacy += old.filter((entry) => entry && (!entry.scope || entry.scope === scope)).length;
        }
        if (legacy) reasons.add('legacy-proof');
    } catch (e) { reasons.add('storage-unavailable'); }
    if (pickupStorageFailure === scope) reasons.add('storage-unavailable');
    return { total: entries.length + legacy + cleanupPending, held: entries.filter((entry) => !!entry.hold).length + legacy + cleanupHeld, reasons: [...reasons] };
}

export function pickupJournalItemId(value) {
    return typeof value === 'string' && /^[a-zA-Z0-9_-]+$/.test(value) ? value : '';
}

export function beginPickupIntent(scanDateStr, keys, itemId?, ownership?) {
    const list = (keys || []).filter((k) => typeof k === 'string' && k);
    if (!scanDateStr || !/^[0-9-]+$/.test(scanDateStr) || !list.length) return null;
    const prior = readPickupJournal();
    const scope = liveShopScope();
    const uid = firebaseState.auth?.currentUser?.uid;
    if (!scope || !uid || pickupReadFailed || prior.length >= PICKUP_JOURNAL_MAX) {
        showToast('⏳ ស្ថិតិយកមិនទាន់អាចរក្សាទុកការងាររង់ចាំបាន — សូមពិនិត្យ Sync និងទំហំផ្ទុក។');
        return null;
    }
    const id = ownership?.id || 'pk' + generateUniqueId().slice(3);
    if (safeStoreGet(appLocalStore, PICKUP_JOURNAL_V2_PREFIX + id) !== null) return null;
    const entry: any = { id, protocol: 2, stage: 'prepared', owner: pickupPageOwner, locked: ownership?.locked === true, scope, uid, date: scanDateStr, keys: list, at: Date.now() };
    if (pickupJournalItemId(itemId)) entry.item = itemId;
    if (!writePickupJournal([entry])) return null;
    pickupIntentsLive.add(id);
    pickupOwners.set(id, { db: firebaseState.db, sdk: firebaseState.fb, generation: firebaseState.authGeneration, scope, uid, date: scanDateStr });
    return id;
}

export function patchPickupJournalEntry(id, patch) {
    if (!id || !patch) return false;
    const entry = readPickupJournal().find((e) => e.id === id);
    return !!entry && writePickupJournal([{ ...entry, ...patch }]);
}

export function notePickupIntentDone(id) {
    patchPickupJournalEntry(id, { pickupDone: true });
}

export function addPickupIntentKeys(id, keys) {
    const entry = readPickupJournal().find((e) => e.id === id);
    if (!entry) return false;
    return patchPickupJournalEntry(id, { keys: [...new Set([...entry.keys, ...(keys || []).filter((key) => typeof key === 'string' && key)])] });
}

export function releasePickupIntent(id) {
    if (!id) return;
    pickupIntentsLive.delete(id);
    pickupOwners.delete(id);
    pickupLocks.get(id)?.();
    pickupLocks.delete(id);
}

export function endPickupIntent(id, settled) {
    if (!id) return Promise.resolve(true);
    return Promise.resolve(settled === undefined ? true : settled).then((saved) => {
        const done = saved === true && removePickupJournalEntry(id);
        releasePickupIntent(id);
        return done;
    }, () => { releasePickupIntent(id); return false; });
}

async function acquirePickupIntent(id) {
    const locks = typeof navigator !== 'undefined' && navigator.locks;
    if (!locks || typeof locks.request !== 'function') return false;
    let active = true;
    let release = () => {};
    const held = new Promise<void>((resolve) => { release = resolve; });
    try {
        await dbOp(new Promise<void>((resolve, reject) => {
            Promise.resolve(locks.request('zoew-pickup-live:' + id, () => {
                if (!active) return;
                pickupLocks.set(id, release);
                resolve();
                return held;
            })).catch(reject);
        }));
        return true;
    } catch (e) {
        active = false;
        release();
        throw e;
    }
}

async function withPickupIntentOwnership(entry, run) {
    if (entry.owner !== pickupPageOwner && entry.locked !== true) {
        patchPickupJournalEntry(entry.id, { hold: 'recovery-pending' });
        return;
    }
    const locks = typeof navigator !== 'undefined' && navigator.locks;
    if (locks && typeof locks.request === 'function') {
        try { return await locks.request('zoew-pickup-live:' + entry.id, { ifAvailable: true }, (lock) => lock ? run() : undefined); }
        catch (e) { return; }
    }
    if (entry.owner === pickupPageOwner && entry.locked !== true) return run();
    patchPickupJournalEntry(entry.id, { hold: 'recovery-pending' });
}

function pickupTransitionNumber(value, minimum = 0) {
    return Number.isSafeInteger(value) && value >= minimum && value <= PICKUP_PROTOCOL_MAX;
}

function pickupTransitionText(value, maximum) {
    return typeof value === 'string' && value.length > 0 && value.length <= maximum;
}

function pickupTransitionShape(proof) {
    return !!proof && typeof proof === 'object' && !Array.isArray(proof)
        && pickupTransitionText(proof.intent, 128) && pickupTransitionText(proof.actorUid, 2048)
        && pickupTransitionText(proof.scope, 2048) && pickupTransitionText(proof.itemId, 128)
        && pickupTransitionText(proof.code, 2048) && typeof proof.scanDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(proof.scanDate)
        && pickupTransitionNumber(proof.epoch) && pickupTransitionNumber(proof.birth, 1)
        && pickupTransitionNumber(proof.restored) && pickupTransitionNumber(proof.closedAt)
        && pickupTransitionNumber(proof.changes, 1) && typeof proof.closed === 'boolean'
        && (proof.closed ? proof.closedAt > 0 : proof.closedAt === 0);
}

export function stampPickupTransition(item, previousBarcodes, intent) {
    const entry = readPickupJournal().find((candidate) => candidate.id === intent);
    if (!entry || entry.stage !== 'started' || entry.scope !== liveShopScope() || entry.uid !== firebaseState.auth?.currentUser?.uid
        || !item || item.scanDate !== entry.date || !Array.isArray(previousBarcodes)) return false;
    const previous = new Map(previousBarcodes.filter(Boolean).map((barcode) => [barcode.code, barcode]));
    const changed = barcodeEntriesOf(item.barcodes).map(({ barcode }) => ({ barcode, previous: previous.get(barcode?.code) }))
        .filter(({ barcode, previous }) => barcode && previous && (barcode.isClosed === true) !== (previous.isClosed === true));
    changed.forEach(({ barcode }) => { delete barcode.pickupTransition; });
    if (!changed.length) return false;
    const proofs = changed.map(({ barcode }) => ({
        intent: entry.id, actorUid: entry.uid, scope: entry.scope, scanDate: entry.date, itemId: entry.item,
        code: barcode.code, epoch: entry.pickupResetEpoch, birth: barcode.createdAt, restored: barcode.restoredAt ?? 0,
        closed: barcode.isClosed === true, closedAt: barcode.isClosed === true ? barcode.closedAt : 0, changes: changed.length
    }));
    const keys = proofs.map((proof) => pickupBarcodeKey(proof.code));
    if (new Set(keys).size !== keys.length || proofs.some((proof, index) => !pickupTransitionShape(proof) || !entry.keys.includes(keys[index])
        || changed[index].previous.createdAt !== proof.birth || (changed[index].previous.restoredAt ?? 0) !== proof.restored)) return false;
    changed.forEach(({ barcode }, index) => { barcode.pickupTransition = proofs[index]; });
    return true;
}

export function pickupTransitionProofKeys(entry, historyItems, trashItems) {
    const found = new Map<string, any>();
    let changes = 0;
    for (const item of [...(historyItems || []), ...(trashItems || [])]) {
        if (!item || itemHasRestoreMarkers(item)) continue;
        for (const { barcode } of barcodeEntriesOf(item.barcodes)) {
            const proof = barcode?.pickupTransition;
            if (!proof || proof.intent !== entry.id) continue;
            const key = pickupBarcodeKey(barcode.code);
            if (!pickupTransitionShape(proof) || proof.actorUid !== entry.uid || proof.scope !== entry.scope
                || proof.itemId !== entry.item || proof.scanDate !== entry.date || item.scanDate !== entry.date
                || proof.epoch !== entry.pickupResetEpoch || proof.code !== barcode.code || !entry.keys.includes(key)
                || proof.birth !== barcode.createdAt || proof.restored !== (barcode.restoredAt ?? 0)
                || proof.closed !== (barcode.isClosed === true) || proof.closedAt !== (barcode.isClosed === true ? barcode.closedAt : 0)
                || changes && proof.changes !== changes || found.has(key)) return null;
            changes = proof.changes;
            found.set(key, proof);
        }
    }
    return changes && found.size === changes ? [...found].filter(([, proof]) => proof.closed).map(([key]) => key) : null;
}

const PICKUP_TRANSITION_FIELDS = ['intent', 'actorUid', 'scope', 'scanDate', 'itemId', 'code', 'epoch', 'birth', 'restored', 'closed', 'closedAt', 'changes'];

function pickupClosePriorReceipt(value) {
    if (value === undefined || value === null) return null;
    if (!pickupTransitionShape(value) || Object.keys(value).length !== PICKUP_TRANSITION_FIELDS.length) return undefined;
    return JSON.stringify(PICKUP_TRANSITION_FIELDS.map((key) => value[key]));
}

function pickupCloseBasis(item, barcode) {
    const prior = pickupClosePriorReceipt(barcode?.pickupTransition);
    const closed = barcode?.isClosed === true;
    const closedAt = closed ? barcode.closedAt : 0;
    if (!barcode || !pickupTransitionText(barcode.code, 2048) || !pickupTransitionNumber(barcode.createdAt, 1)
        || !pickupTransitionNumber(barcode.restoredAt ?? 0) || !pickupTransitionNumber(closedAt, closed ? 1 : 0)
        || !closed && barcode.closedAt != null || prior === undefined) return null;
    return { key: pickupBarcodeKey(barcode.code), code: barcode.code, birth: barcode.createdAt,
        restored: barcode.restoredAt ?? 0, closed, closedAt, identity: barcodeSignIdentity(item, barcode), prior };
}

function pickupClosePriorValid(prior) {
    if (prior === null) return true;
    if (!pickupTransitionText(prior, 16384)) return false;
    try {
        const values = JSON.parse(prior);
        if (!Array.isArray(values) || values.length !== PICKUP_TRANSITION_FIELDS.length) return false;
        return pickupClosePriorReceipt(Object.fromEntries(PICKUP_TRANSITION_FIELDS.map((key, index) => [key, values[index]]))) === prior;
    } catch (e) { return false; }
}

function pickupCloseBasisSame(a, b) {
    return !!a && !!b && ['key', 'code', 'birth', 'restored', 'closed', 'closedAt', 'identity', 'prior'].every((key) => a[key] === b[key]);
}

function pickupCloseTimestamp(plan) {
    const legacy = !!plan && Object.prototype.hasOwnProperty.call(plan, 'at');
    const current = !!plan && Object.prototype.hasOwnProperty.call(plan, 'serverTransitionAt');
    return legacy === current ? undefined : current ? plan.serverTransitionAt : plan.at;
}

function pickupClosePlanValid(entry) {
    const plan = entry?.closePlan;
    if (!plan || Object.keys(plan).length !== 5 || plan.v !== 1 || typeof plan.desiredClosed !== 'boolean'
        || typeof plan.whole !== 'boolean' || !pickupTransitionNumber(pickupCloseTimestamp(plan), 1) || !Array.isArray(plan.targets) || !plan.targets.length
        || !Array.isArray(entry.keys) || plan.targets.length !== entry.keys.length || !pickupJournalItemId(entry.item)) return false;
    const keys = new Set();
    return plan.targets.every((target) => {
        if (!target || Object.keys(target).length !== 8 || !pickupTransitionText(target.code, 2048)
            || target.key !== pickupBarcodeKey(target.code) || !entry.keys.includes(target.key) || keys.has(target.key)
            || !pickupTransitionNumber(target.birth, 1) || !pickupTransitionNumber(target.restored)
            || typeof target.closed !== 'boolean' || !pickupTransitionNumber(target.closedAt, target.closed ? 1 : 0)
            || !target.closed && target.closedAt !== 0 || !pickupTransitionText(target.identity, 8192)
            || !pickupClosePriorValid(target.prior)) return false;
        keys.add(target.key);
        return true;
    });
}

function createPickupClosePlan(entry, item, desiredClosed, whole) {
    if (!entry || !item || item.scanDate !== entry.date || typeof desiredClosed !== 'boolean') return null;
    const targets = barcodeEntriesOf(item.barcodes).filter(({ barcode }) => entry.keys.includes(pickupBarcodeKey(barcode?.code)))
        .map(({ barcode }) => pickupCloseBasis(item, barcode));
    const plan = { v: 1, desiredClosed, whole: whole === true, serverTransitionAt: getServerNow(), targets };
    return pickupClosePlanValid({ ...entry, closePlan: plan }) ? plan : null;
}

function pickupClosePlanState(entry, item) {
    if (!pickupClosePlanValid(entry) || !item || item.scanDate !== entry.date) return { kind: 'conflict' };
    const plan = entry.closePlan;
    const all = barcodeEntriesOf(item.barcodes).map(({ barcode }) => barcode);
    if (plan.whole && all.length !== plan.targets.length) return { kind: 'conflict' };
    const barcodes = plan.targets.map((target) => all.filter((barcode) => pickupBarcodeKey(barcode?.code) === target.key));
    if (barcodes.some((found) => found.length !== 1)) return { kind: 'conflict' };
    const selected = barcodes.map((found) => found[0]);
    if (selected.some((barcode) => barcode.trashClaim !== undefined || barcode.trashClaimAt !== undefined)) return { kind: 'conflict' };
    if (!plan.desiredClosed && selected.some(barcodeZtoSigned)) return { kind: 'conflict', signed: true };
    const bases = selected.map((barcode) => pickupCloseBasis(item, barcode));
    const changed = plan.targets.filter((target) => target.closed !== plan.desiredClosed);
    const marks = (plan.desiredClosed ? changed : plan.targets).map((target) => ({ key: target.key, phoneKey: getPickupPhoneKey(item), closed: plan.desiredClosed }));
    if (bases.every((basis, index) => pickupCloseBasisSame(basis, plan.targets[index]))) return { kind: 'before', marks, selected };
    const proven = pickupTransitionProofKeys(entry, [item], []);
    if (changed.length && proven && selected.every((barcode, index) => {
        const target = plan.targets[index];
        if (target.closed === plan.desiredClosed) return pickupCloseBasisSame(bases[index], target);
        const proof = barcode.pickupTransition;
        return !!bases[index] && bases[index].birth === target.birth && bases[index].restored === target.restored
            && bases[index].identity === target.identity && proof?.intent === entry.id && proof.changes === changed.length
            && proof.closed === plan.desiredClosed && proof.closedAt === (plan.desiredClosed ? pickupCloseTimestamp(plan) : 0);
    })) return { kind: 'applied', marks, selected };
    return { kind: 'conflict' };
}

function pickupForeignCloseTargets(entry, historyItems, trashItems) {
    if (!pickupClosePlanValid(entry) || !entry.closePlan.targets.some((target) => target.closed !== entry.closePlan.desiredClosed)) return null;
    const item = historyItems.find((item) => item?.id === entry.item);
    if (!item || item.scanDate !== entry.date || item.clearClaim || itemHasRestoreMarkers(item) || rowOperationActive(item)) return null;
    const plan = entry.closePlan;
    const records = [...historyItems, ...trashItems].flatMap((item) => barcodeEntriesOf(item?.barcodes).map(({ barcode }) => ({ item, barcode, key: pickupBarcodeKey(barcode?.code) })));
    const selected = records.filter((record) => entry.keys.includes(record.key));
    if (selected.length !== plan.targets.length || selected.some((record) => record.item !== item)
        || plan.whole && barcodeEntriesOf(item.barcodes).length !== plan.targets.length) return null;
    const groups = new Map<string, any[]>();
    for (const record of records) {
        const id = record.barcode?.pickupTransition?.intent;
        if (id) {
            if (!groups.has(id)) groups.set(id, []);
            groups.get(id).push(record);
        }
    }
    if (groups.has(entry.id)) return null;
    const checked = new Set();
    const targets = [];
    for (const target of plan.targets) {
        const matches = selected.filter((record) => record.key === target.key);
        if (matches.length !== 1) return null;
        const barcode = matches[0].barcode, basis = pickupCloseBasis(item, barcode);
        if (!basis || barcode.trashClaim !== undefined || barcode.trashClaimAt !== undefined
            || basis.closed !== plan.desiredClosed || !plan.desiredClosed && barcodeZtoSigned(barcode)) return null;
        const changed = target.closed !== plan.desiredClosed;
        if (changed && plan.desiredClosed && entry.allowedAddKeys?.includes(target.key)) return null;
        if (!changed) {
            if (!pickupCloseBasisSame(basis, target)) return null;
        } else {
            const proof = barcode.pickupTransition;
            if (!proof || pickupClosePriorReceipt(proof) === undefined || proof.intent === entry.id
                || target.prior !== null && proof.intent === JSON.parse(target.prior)[0]
                || proof.scope !== entry.scope || proof.scanDate !== entry.date || proof.itemId !== entry.item
                || proof.epoch !== entry.pickupResetEpoch || basis.birth !== target.birth || basis.restored !== target.restored || basis.identity !== target.identity) return null;
            if (!checked.has(proof.intent)) {
                const group = groups.get(proof.intent) || [];
                if (group.some(({ key }) => records.filter((record) => record.key === key).length !== 1)
                    || group.some(({ item, barcode }) => item.clearClaim || itemHasRestoreMarkers(item) || rowOperationActive(item) || barcode.trashClaim !== undefined
                        || barcode.trashClaimAt !== undefined || pickupClosePriorReceipt(barcode.pickupTransition) === undefined)) return null;
                const foreign = { ...entry, id: proof.intent, uid: proof.actorUid, keys: group.map((record) => record.key) };
                if (pickupTransitionProofKeys(foreign, [...new Set(group.map((record) => record.item))], []) === null) return null;
                checked.add(proof.intent);
            }
        }
        targets.push({ key: target.key, phoneKey: getPickupPhoneKey(item), closed: plan.desiredClosed, required: changed || !plan.desiredClosed });
    }
    return targets;
}

async function pickupForeignCloseSatisfied(entry, context) {
    if (!pickupContextIsCurrent(context) || !pickupClosePlanValid(entry)) return false;
    const before = await readPickupDay(context), metadata = pickupMetadata(before);
    if (!metadata.revision || metadata.epoch !== entry.pickupResetEpoch) return false;
    const truth = await readPickupTruthViews();
    const after = await readPickupDay(context);
    if (!txSameValue(before, after)) return false;
    const targets = pickupForeignCloseTargets(entry, truth.history, truth.trash);
    if (!targets) return false;
    const set = pickupSetFromRecord(after), phones = tallyPickupPhones(set);
    if ([after?.pickedUpBarcodes, after?.pickedUpPhones].some((map) => map != null && (typeof map !== 'object' || Array.isArray(map)))
        || Object.values(set).some((phone) => typeof phone !== 'string' || !phone)
        || after?.packagesPickedUp !== pickupSetSize(set) || !txSameValue(after?.pickedUpPhones || {}, phones)) return false;
    if (!targets.every((target) => target.closed
        ? (!target.required && !Object.prototype.hasOwnProperty.call(set, target.key) || set[target.key] === target.phoneKey)
        : !Object.prototype.hasOwnProperty.call(set, target.key))) return false;
    const current = readPickupJournal().find((candidate) => candidate.id === entry.id);
    if (!pickupContextIsCurrent(context) || current?.stage !== 'started' || current.transitionKnown === true
        || !['id', 'uid', 'scope', 'date', 'item', 'pickupResetEpoch', 'keys', 'closePlan', 'allowedAddKeys'].every((key) => txSameValue(current[key], entry[key]))) return false;
    return { item: truth.history.find((item) => item.id === entry.item), record: after };
}

type PickupCloseApplication = { kind: string; item?: any; marks?: any[]; signed?: boolean; restoreHeld?: boolean };

function applyPickupClosePlan(entry, item): PickupCloseApplication {
    if (!entry || entry.stage !== 'started' || entry.scope !== liveShopScope() || entry.uid !== firebaseState.auth?.currentUser?.uid) return { kind: 'conflict' };
    const prepared = preparePickupClose(item, entry.date);
    if (!prepared.item) return { kind: 'conflict', restoreHeld: prepared.restoreHeld };
    const state = pickupClosePlanState(entry, item);
    if (state.kind !== 'before') return { ...state, item };
    const previous = state.selected.map((barcode) => ({ ...barcode }));
    const changing = state.selected.filter((barcode) => (barcode.isClosed === true) !== entry.closePlan.desiredClosed);
    changing.forEach((barcode) => applyBarcodeCloseState(barcode, entry.closePlan.desiredClosed, pickupCloseTimestamp(entry.closePlan)));
    const wasClosed = item.isClosed === true && typeof item.closedAt === 'number';
    item.isClosed = barcodeEntriesOf(item.barcodes).every(({ barcode }) => barcode.isClosed);
    if (item.isClosed) { if (changing.length || !wasClosed) item.closedAt = pickupCloseTimestamp(entry.closePlan); }
    else delete item.closedAt;
    if (entry.closePlan.desiredClosed) { delete item.callMark; delete item.callMarkTime; }
    if (changing.length && !stampPickupTransition(item, previous, entry.id)) return { kind: 'conflict' };
    return { ...state, item };
}

function pickupCloseAcknowledgedKeys(entry, item) {
    const state = pickupClosePlanState(entry, item);
    if (state.kind === 'applied') return state.marks.filter((mark) => mark.closed).map((mark) => mark.key);
    if (state.kind === 'before' && entry.closePlan.targets.every((target) => target.closed === entry.closePlan.desiredClosed)) return [];
    return null;
}

async function replayPickupClosePlan(entry, context) {
    const ref = context.sdk.ref(context.db, 'zoew_scan_history_cod_dod/' + entry.item);
    const result = await dbOp(context.sdk.runTransaction(ref, (item) => {
        if (!pickupContextIsCurrent(context)) return;
        const current = readPickupJournal().find((candidate) => candidate.id === entry.id);
        if (!current || JSON.stringify(current.closePlan) !== JSON.stringify(entry.closePlan)) return;
        const applied = applyPickupClosePlan(current, item);
        return applied.kind === 'conflict' ? undefined : applied.item;
    }));
    if (!pickupContextIsCurrent(context) || result?.committed !== true) return null;
    return pickupCloseAcknowledgedKeys(entry, result.snapshot?.val());
}

export function preparePickupClose(item, date) {
    if (!item) return { item, restoreHeld: false };
    if (rowOperationActive(item) || item.clearClaim || (item.scanDate || getFormattedDate()) !== date) return { item: undefined, restoreHeld: false };
    dropStaleRestoreMarkers(item);
    const restoreHeld = itemHasRestoreMarkers(item);
    return { item: restoreHeld ? undefined : normalizeBarcodesOf(item), restoreHeld };
}

export function failPickupClose(journal, error, heal) {
    if (error?.txOutcome === 'not-applied') journal.cancel();
    journal.finish(heal(error));
    showToast("⚠️ បរាជ័យក្នុងការ Save ទៅ Firebase! ស្ថានភាពក្នុង App ត្រូវបានត្រឡប់ដើមវិញ។");
    return false;
}

export function pickupIntentTracker(isCurrent, itemId?) {
    let intent = null;
    let commit = null;
    let pickupCommit = null;
    let context = null;
    let admissionFailed = false;
    let transitionKnown = false;
    let everProposed = false;
    const start = (closePlan?) => {
        const saved = !!context && isCurrent() && patchPickupJournalEntry(intent, { stage: 'started', ...(closePlan ? { closePlan } : {}) });
        if (!saved) admissionFailed = true;
        return saved;
    };
    return {
        context: () => context,
        startClose: (item, desiredClosed, whole = false) => {
            const entry = readPickupJournal().find((entry) => entry.id === intent);
            if (!entry || new Set(entry.keys).size !== entry.keys.length
                || barcodeEntriesOf(item?.barcodes).filter(({ barcode }) => entry.keys.includes(pickupBarcodeKey(barcode?.code))).length > entry.keys.length) return false;
            const plan = createPickupClosePlan(entry, item, desiredClosed, whole);
            if (plan?.desiredClosed && plan.targets.some((target) => !target.closed && entry.allowedAddKeys?.includes(target.key))) {
                if (entry.stage === 'prepared' && entry.owner === pickupPageOwner && context?.intent === entry.id
                    && context.uid === entry.uid && context.scope === entry.scope && pickupContextIsCurrent(context)) removePickupJournalEntry(entry.id);
                showToast('⏳ ស្ថានភាព និងស្ថិតិយកមិនទាន់ត្រូវគ្នា — សូម Sync/Refresh រួចសាកម្ដងទៀត។');
                return false;
            }
            return start(plan);
        },
        applyClose: (item) => {
            const entry = readPickupJournal().find((candidate) => candidate.id === intent);
            if (!entry) return { kind: 'conflict' };
            if (entry.closePlan === undefined) return null;
            if (!isCurrent()) return { kind: 'conflict' };
            const applied = applyPickupClosePlan(entry, item);
            if (applied.kind !== 'conflict') everProposed = true;
            return applied;
        },
        originalCloseAborted: (result) => {
            if (result?.committed !== false || !isCurrent() || !pickupContextIsCurrent(context)) return false;
            const entry = readPickupJournal().find((candidate) => candidate.id === intent);
            if (!entry || entry.stage !== 'started' || entry.owner !== pickupPageOwner || context.intent !== entry.id
                || context.uid !== entry.uid || context.scope !== entry.scope) return false;
            return !everProposed || pickupClosePlanValid(entry) && entry.closePlan.desiredClosed === true
                && Array.isArray(entry.allowedAddKeys)
                && !entry.closePlan.targets.some((target) => !target.closed && entry.allowedAddKeys.includes(target.key));
        },
        closeTime: () => {
            const plan = readPickupJournal().find((entry) => entry.id === intent)?.closePlan;
            return plan === undefined ? getServerNow() : pickupCloseTimestamp(plan);
        },
        acknowledgedClose: (item) => {
            if (!isCurrent() || !pickupContextIsCurrent(context)) return null;
            const entry = readPickupJournal().find((candidate) => candidate.id === intent);
            if (!entry) return null;
            if (entry.closePlan === undefined) return undefined;
            if (pickupCloseAcknowledgedKeys(entry, item) === null) return null;
            const local = dataState.scanHistory.find((candidate) => candidate.id === entry.item);
            for (const { barcode } of barcodeEntriesOf(item?.barcodes)) {
                const target = entry.closePlan.targets.find((target) => target.key === pickupBarcodeKey(barcode?.code));
                const cached = barcodeEntriesOf(local?.barcodes).find(({ barcode: candidate }) => candidate?.code === barcode?.code)?.barcode;
                const actual = pickupCloseBasis(item, barcode), visible = pickupCloseBasis(local, cached);
                if (target && actual && visible && visible.prior === target.prior && pickupCloseBasisSame({ ...visible, prior: actual.prior }, actual)
                    && barcode.pickupTransition?.intent === entry.id) cached.pickupTransition = { ...barcode.pickupTransition };
            }
            return pickupClosePlanState(entry, item).marks;
        },
        stampTransition: (item, previousBarcodes) => isCurrent() && !!context && stampPickupTransition(item, previousBarcodes, intent),
        prepare: async (date, keys, existingOnly = false) => {
            const id = 'pk' + generateUniqueId().slice(3);
            try {
                const locked = await acquirePickupIntent(id);
                if (!isCurrent()) { releasePickupIntent(id); return null; }
                intent = beginPickupIntent(date, keys, itemId, { id, locked });
                if (!intent) { releasePickupIntent(id); return null; }
                const captured = await capturePickupContext(date);
                if (!isCurrent() || !patchPickupJournalEntry(intent, { pickupResetEpoch: captured.epoch, allowedAddKeys: captured.presentKeys.filter((key) => keys.includes(key)), ...(existingOnly ? { existingOnly: true } : {}) })) { removePickupJournalEntry(intent); releasePickupIntent(intent); return null; }
                context = { ...captured, intent };
                return context;
            } catch (e) {
                if (readPickupJournal().find((entry) => entry.id === id)?.stage === 'prepared') removePickupJournalEntry(id);
                releasePickupIntent(id);
                showToast('⏳ មិនអាចផ្ទៀងផ្ទាត់ស្ថិតិយកពី server បាន — សូមភ្ជាប់បណ្តាញ រួចសាកម្តងទៀត។');
                return null;
            }
        },
        start,
        confirm: (keys) => {
            const entry = readPickupJournal().find((e) => e.id === intent);
            const saved = !!entry && patchPickupJournalEntry(intent, { transitionKnown: true, allowedAddKeys: [...new Set([...(entry.allowedAddKeys || []), ...keys])] });
            if (!saved) admissionFailed = true;
            else transitionKnown = true;
            return saved;
        },
        cancel: () => {
            transitionKnown = patchPickupJournalEntry(intent, { transitionKnown: true, outcome: 'not-applied' });
            return transitionKnown;
        },
        setItem: (id) => intent ? patchPickupJournalEntry(intent, { item: id }) : false,
        add: (scanDateStr, keys) => {
            const saved = intent && addPickupIntentKeys(intent, keys);
            if (!saved || context?.date !== scanDateStr) admissionFailed = true;
            return saved && !admissionFailed;
        },
        note: (applied) => {
            if (!applied || !applied.commit) return;
            commit = applied.commit;
            pickupCommit = applied.pickupCommit || applied.commit;
        },
        release: () => {
            if (!intent) return;
            const id = intent;
            intent = null;
            releasePickupIntent(id);
        },
        finish: (collected?) => {
            if (!intent) return Promise.resolve(true);
            const id = intent;
            intent = null;
            if (!isCurrent()) { releasePickupIntent(id); return Promise.resolve(false); }
            else if (collected === undefined) return endPickupIntent(id, admissionFailed || !transitionKnown ? false : commit);
            else {
                const saved = Promise.resolve(pickupCommit || true).then((value) => {
                    if (value === true) notePickupIntentDone(id);
                    return value;
                });
                return endPickupIntent(id, Promise.all([saved, commit || true, collected])
                    .then(([pickupSaved, healed, synced]) => !admissionFailed && transitionKnown && pickupSaved === true && healed === true && synced === true));
            }
        }
    };
}

export async function readPickupTruthViews() {
    const readDb = firebaseState.db;
    const readSdk = firebaseState.fb;
    const readGeneration = firebaseState.authGeneration;
    const read = async (path) => {
        const ref = readSdk.ref(readDb, path);
        const url = txRestUrl(ref);
        if (url) return txReadServerValue(url, TX_ROOT_READ_TIMEOUT_MS);
        const snapshot = await dbOp(readSdk.get(ref));
        return snapshot.val();
    };
    const [history, trash] = await Promise.all([read('zoew_scan_history_cod_dod'), read('zoew_recently_deleted_cod_dod')]);
    if (readDb !== firebaseState.db || readGeneration !== firebaseState.authGeneration) throw new Error('Pickup read context changed');
    const items = (raw) => Object.keys(raw || {}).map((id) => Object.assign({}, raw[id], { id }));
    return { history: items(history), trash: items(trash) };
}

export function pickupTruthMarks(dateKey, keys, historyItems = dataState.scanHistory, trashItems = dataState.deletedItems) {
    const want = {};
    (keys || []).forEach((k) => { want[k] = true; });
    const found = {};
    const collect = (list, inTrash) => {
        (list || []).forEach((item) => {
            if (!item || item.scanDate !== dateKey) return;
            pickupCopyMarks(item, inTrash).forEach((mark) => {
                if (!want[mark.key]) return;
                const prior = found[mark.key];
                if (!prior || (mark.closed && !prior.closed)) found[mark.key] = mark;
            });
        });
    };
    collect(historyItems, false);
    collect(trashItems, true);
    return Object.keys(found).map((k) => found[k]);
}

export function pickupCollectedKeys(itemId, keys, historyItems, trashItems) {
    const holds = (item, key, closedOnly) => !!item && collectPickupMarks(item).some((mark) => mark.key === key && (!closedOnly || mark.closed));
    const holder = (historyItems || []).find((item) => item && item.id === itemId) || (trashItems || []).find((item) => item && item.id === itemId);
    const copies = (trashItems || []).filter((item) => item && item.id !== itemId && item.trashReason === 'pickup');
    return (keys || []).filter((key) => holds(holder, key, false) || copies.some((item) => holds(item, key, true)));
}

export function notePickupCollectedRefused(entry) {
    const tries = (typeof entry.collectedTries === 'number' && isFinite(entry.collectedTries) ? entry.collectedTries : 0) + 1;
    if (tries < CLEANUP_LEDGER_RETRY_MAX) {
        patchPickupJournalEntry(entry.id, { collectedTries: tries });
        return;
    }
    if (tries === CLEANUP_LEDGER_RETRY_MAX && window.ZoeErrors) ZoeErrors.capture(new Error('Pickup journal collected mirror write refused'), { zone: 'data', context: 'resumePickupIntents collected', itemId: pickupJournalItemId(entry.item) || entry.id });
    patchPickupJournalEntry(entry.id, { hold: 'recovery-pending', collectedTries: Math.min(tries, CLEANUP_LEDGER_RETRY_MAX) });
}

function pickupRecoveryRowBusy(entry, truth) {
    return [...truth.history, ...truth.trash].some((item) => rowOperationActive(item)
        && (item.id === entry.item || item.scanDate === entry.date
            && barcodeEntriesOf(item.barcodes).some(({ barcode }) => entry.keys.includes(pickupBarcodeKey(barcode?.code)))));
}

export async function resumePickupIntents() {
    for (const [id, owner] of pickupOwners) {
        if (!pickupContextIsCurrent(owner)) releasePickupIntent(id);
    }
    if (pickupResumeOwner && !pickupContextIsCurrent(pickupResumeOwner.context)) {
        pickupResumeOwner = null;
        dataState.pickupResumeInFlight = false;
    }
    if (dataState.pickupResumeInFlight) return;
    if (!firebaseState.db || !firebaseState.fb || !firebaseState.auth || !firebaseState.auth.currentUser || shopScopePending()) return;
    const views = [DB_LISTENER_KEY_HISTORY, DB_LISTENER_KEY_DELETED, 'dailyPickup'];
    if (views.some((k) => dbListenerViewIsStale(k))) return;
    const scope = shopScope();
    if (!scope) return;
    const journal = readPickupJournal();
    const due = journal.filter((e) => e.scope === scope && e.uid === firebaseState.auth.currentUser.uid && !pickupIntentsLive.has(e.id));
    if (!due.length) return;
    const owner = { context: { db: firebaseState.db, sdk: firebaseState.fb, generation: firebaseState.authGeneration, scope, uid: firebaseState.auth.currentUser.uid } };
    pickupResumeOwner = owner;
    dataState.pickupResumeInFlight = true;
    const resumeDb = firebaseState.db;
    const resumeGeneration = firebaseState.authGeneration;
    const resumeIsCurrent = () => firebaseState.db === resumeDb && firebaseState.authGeneration === resumeGeneration && shopScope() === scope;
    try {
        const since = pickupAddClockNow();
        for (const entry of due) {
            if (!resumeIsCurrent()) return;
            await withPickupIntentOwnership(entry, async () => {
                if (!resumeIsCurrent() || !readPickupJournal().some((e) => e.id === entry.id)) return;
                if (entry.stage === 'prepared') { removePickupJournalEntry(entry.id); return; }
                if (entry.stage !== 'started' || !Array.isArray(entry.allowedAddKeys) || !Number.isSafeInteger(entry.pickupResetEpoch)) {
                    patchPickupJournalEntry(entry.id, { hold: 'legacy-proof' });
                    return;
                }
                let truth = await readPickupTruthViews();
                if (!resumeIsCurrent()) return;
                if (pickupRecoveryRowBusy(entry, truth)) { patchPickupJournalEntry(entry.id, { hold: 'recovery-pending' }); return; }
                const day = await capturePickupContext(entry.date);
                const resetChanged = day.epoch !== entry.pickupResetEpoch;
                if (day.epoch < entry.pickupResetEpoch) { patchPickupJournalEntry(entry.id, { hold: 'reset-conflict' }); return; }
                if (resetChanged) patchPickupJournalEntry(entry.id, { hold: 'reset-conflict' });
                const context = { ...day, intent: entry.id };
                truth = await readPickupTruthViews();
                let stored = readPickupJournal().find((e) => e.id === entry.id);
                if (!resumeIsCurrent() || !stored) return;
                if (pickupRecoveryRowBusy(stored, truth)) { patchPickupJournalEntry(stored.id, { hold: 'recovery-pending' }); return; }
                const foreignSatisfied = !resetChanged && stored.transitionKnown !== true
                    && pickupForeignCloseTargets(stored, truth.history, truth.trash) && await pickupForeignCloseSatisfied(stored, context);
                if (!resumeIsCurrent()) return;
                if (!foreignSatisfied && (!resetChanged || stored.closePlan !== undefined) && stored.transitionKnown !== true) {
                    const items = [...truth.history, ...truth.trash];
                    const planned = stored.closePlan !== undefined;
                    let proven = pickupTransitionProofKeys(stored, truth.history, truth.trash);
                    if (planned && (!pickupClosePlanValid(stored) || !items.some((item) => pickupClosePlanState(stored, item).kind === 'applied'))) proven = null;
                    const ownReceiptSeen = items.some((item) => barcodeEntriesOf(item?.barcodes).some(({ barcode }) => barcode?.pickupTransition?.intent === stored.id));
                    if (proven === null && !ownReceiptSeen && pickupClosePlanValid(stored)) {
                        proven = await replayPickupClosePlan(stored, context);
                        if (!resumeIsCurrent()) return;
                        truth = await readPickupTruthViews();
                        if (!resumeIsCurrent()) return;
                        if (pickupRecoveryRowBusy(stored, truth)) { patchPickupJournalEntry(stored.id, { hold: 'recovery-pending' }); return; }
                    }
                    if (proven && patchPickupJournalEntry(stored.id, { transitionKnown: true, allowedAddKeys: [...new Set([...stored.allowedAddKeys, ...proven])],
                        ...(proven.some((key) => !stored.allowedAddKeys.includes(key)) ? { pickupDone: false } : {}) })) {
                        stored = readPickupJournal().find((e) => e.id === entry.id);
                    }
                }
                if (!resumeIsCurrent() || !stored) return;
                const transitionUnknown = stored.transitionKnown !== true && (!resetChanged || stored.closePlan !== undefined);
                if (transitionUnknown) patchPickupJournalEntry(stored.id, { hold: 'recovery-pending' });
                const marks = pickupTruthMarks(stored.date, stored.keys, truth.history, truth.trash)
                    .filter((mark) => (!mark.closed || stored.allowedAddKeys.includes(mark.key)) && (stored.pickupDone !== true || !mark.closed && !pickupKeyAddedSince(mark.key, since)));
                if (!resetChanged && !transitionUnknown) {
                    const result = await commitPickupMarks(stored.date, marks, stored.existingOnly === true, true, undefined, context, true);
                    if (!resumeIsCurrent() || result !== true) return;
                    notePickupIntentDone(stored.id);
                }
                const itemId = pickupJournalItemId(stored.item);
                const collectedKeys = itemId ? pickupCollectedKeys(itemId, stored.keys, truth.history, truth.trash) : [];
                if (collectedKeys.length) {
                    const report: any = {};
                    const synced = await reconcileCollectedHistory(itemId, collectedKeys, undefined, undefined, true, report);
                    if (!resumeIsCurrent()) return;
                    if (synced !== true) {
                        if (report.refused === true) notePickupCollectedRefused(readPickupJournal().find((e) => e.id === stored.id) || stored);
                        return;
                    }
                }
                if (!resumeIsCurrent()) return;
                if (transitionUnknown) {
                    if (foreignSatisfied) {
                        const verified = await pickupForeignCloseSatisfied(stored, context);
                        if (resumeIsCurrent() && txSameValue(foreignSatisfied, verified)) removePickupJournalEntry(stored.id);
                    }
                    return;
                }
                if (resetChanged) completeResetCancelledPickup(stored, day.epoch);
                else removePickupJournalEntry(stored.id);
            });
        }
    } catch (e) {
        if (window.ZoeErrors) ZoeErrors.capture(e, { zone: 'data', context: 'resumePickupIntents' });
    } finally {
        if (pickupResumeOwner === owner) {
            pickupResumeOwner = null;
            dataState.pickupResumeInFlight = false;
        }
    }
}
