import { dataState, firebaseState } from '../core/state';
import { elapsedSince } from '../core/elapsed';
import { liveShopScope, shopScope, shopScopePending } from '../core/shop-scope';
import { appLocalStore, safeStoreGet, safeStoreRemove, safeStoreSet } from '../core/storage';
import { PICKUP_JOURNAL_KEY } from '../core/storage-keys';
import { DB_LISTENER_KEY_DELETED, DB_LISTENER_KEY_HISTORY } from '../core/text';
import { getFormattedDate } from '../core/timezone';
import { CLEANUP_LEDGER_RETRY_MAX, markCleanupJournalLive, releaseCleanupJournalLive, withCleanupEntryOwnership } from './cleanup';
import { reconcileCollectedHistory } from './collected';
import { barcodeEntriesOf, generateUniqueId, itemHasRestoreMarkers } from './barcode';
import { barcodeRegistryKey } from './registry';
import { restorePendingCode } from '../features/restore';
import { trashReasonDeducted } from '../features/trash';
import { dbListenerViewIsStale } from '../services/db-listeners';
import { dbOp } from '../services/network';
import { TX_ROOT_READ_TIMEOUT_MS, txReadServerValue, txRestUrl } from '../services/tx-outcome';
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

export function buildPickupRecordFromSet(set) {
    const size = pickupSetSize(set);
    const phones = tallyPickupPhones(set);
    return {
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
    const next = buildPickupRecordFromSet(set);
    dataState.dailyPickupData[scanDateStr] = {
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

export function commitPickupMarks(scanDateStr, marks, existingOnly = false, quiet = false, keep?: (key: string) => boolean) {
    if (!firebaseState.dbRefDailyPickup || !firebaseState.db || !firebaseState.fb) return Promise.resolve(null);
    notePickupKeyAdds(marks);
    const dateRef = firebaseState.fb.ref(firebaseState.db, `zoew_daily_pickup_cod_dod/${scanDateStr}`);
    return firebaseState.fb.runTransaction(dateRef, (current) => {
        const set = pickupSetFromRecord((current && typeof current === 'object') ? current : null);
        applyPickupMarksToSet(set, keep ? (marks || []).filter((m) => m && keep(m.key)) : marks, existingOnly);
        return buildPickupRecordFromSet(set);
    }).then((result) => (result && result.committed) ? true : null, () => {
        if (!quiet) showToast("⚠️ បរាជ័យក្នុងការ Save Daily Pickup!");
        return null;
    });
}

export function markPickupBarcodes(scanDateStr, marks, existingOnly = false) {
    if (!scanDateStr) scanDateStr = getFormattedDate();
    const list = (marks || []).filter((m) => m && m.key);
    if (!list.length) return null;
    const applied = applyPickupMarksInMemory(scanDateStr, list, existingOnly);
    const commit = commitPickupMarks(scanDateStr, list, existingOnly);
    return { scanDate: scanDateStr, marks: list, previous: applied.previous, changed: applied.changed, commit: commit, ...(existingOnly ? { existingOnly: true } : {}) };
}

export const PICKUP_JOURNAL_MAX = 200;

export const PICKUP_JOURNAL_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export const pickupIntentsLive = new Set<string>();

export function readPickupJournal() {
    try {
        const raw = safeStoreGet(appLocalStore, PICKUP_JOURNAL_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter((e) => e && typeof e === 'object' && typeof e.id === 'string' && typeof e.date === 'string'
            && /^[0-9-]+$/.test(e.date) && Array.isArray(e.keys));
    } catch (e) {
        return [];
    }
}

export function writePickupJournal(entries) {
    const list = Array.isArray(entries) ? entries : [];
    if (!list.length) {
        safeStoreRemove(appLocalStore, PICKUP_JOURNAL_KEY);
        return;
    }
    try {
        safeStoreSet(appLocalStore, PICKUP_JOURNAL_KEY, JSON.stringify(list));
    } catch (e) {}
}

export function pickupJournalItemId(value) {
    return typeof value === 'string' && /^[a-zA-Z0-9_-]+$/.test(value) ? value : '';
}

export function pickupJournalEntryIsFresh(e) {
    return pickupIntentsLive.has(e.id) || elapsedSince(e.at) <= PICKUP_JOURNAL_MAX_AGE_MS;
}

export function trimPickupJournal(list, room) {
    let extra = list.length - Math.max(0, room);
    if (extra <= 0) return list;
    return list.filter((e) => {
        if (extra <= 0 || pickupIntentsLive.has(e.id)) return true;
        extra--;
        return false;
    });
}

export function beginPickupIntent(scanDateStr, keys, itemId?) {
    const list = (keys || []).filter((k) => typeof k === 'string' && k);
    if (!scanDateStr || !/^[0-9-]+$/.test(scanDateStr) || !list.length) return null;
    const id = 'pk' + generateUniqueId().slice(3);
    const kept = trimPickupJournal(readPickupJournal().filter(pickupJournalEntryIsFresh), PICKUP_JOURNAL_MAX - 1);
    const entry: any = { id: id, scope: liveShopScope(), date: scanDateStr, keys: list, at: Date.now() };
    if (pickupJournalItemId(itemId)) entry.item = itemId;
    kept.push(entry);
    pickupIntentsLive.add(id);
    markCleanupJournalLive(id);
    writePickupJournal(kept);
    return id;
}

export function patchPickupJournalEntry(id, patch) {
    if (!id || !patch) return;
    const list = readPickupJournal();
    let changed = false;
    list.forEach((e) => {
        if (e.id !== id) return;
        Object.keys(patch).forEach((k) => {
            if (e[k] === patch[k]) return;
            e[k] = patch[k];
            changed = true;
        });
    });
    if (changed) writePickupJournal(list);
}

export function notePickupIntentDone(id) {
    patchPickupJournalEntry(id, { pickupDone: true });
}

export function addPickupIntentKeys(id, keys) {
    if (!id) return;
    const extra = (keys || []).filter((k) => typeof k === 'string' && k);
    if (!extra.length) return;
    const list = readPickupJournal();
    let changed = false;
    list.forEach((e) => {
        if (e.id !== id) return;
        extra.forEach((k) => { if (e.keys.indexOf(k) === -1) { e.keys.push(k); changed = true; } });
    });
    if (changed) writePickupJournal(list);
}

export function releasePickupIntent(id) {
    if (!id) return;
    pickupIntentsLive.delete(id);
    releaseCleanupJournalLive(id);
}

export function endPickupIntent(id, settled) {
    if (!id) return;
    const finish = () => {
        writePickupJournal(readPickupJournal().filter((e) => e.id !== id));
        releasePickupIntent(id);
    };
    if (settled && typeof settled.then === 'function') settled.then((saved) => {
        if (saved === true) finish();
        else releasePickupIntent(id);
    }, () => releasePickupIntent(id));
    else finish();
}

export function pickupIntentTracker(isCurrent, itemId?) {
    let intent = null;
    let commit = null;
    let pickupCommit = null;
    return {
        add: (scanDateStr, keys) => {
            if (intent) addPickupIntentKeys(intent, keys);
            else intent = beginPickupIntent(scanDateStr, keys, itemId);
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
            if (!intent) return;
            const id = intent;
            intent = null;
            if (!isCurrent()) releasePickupIntent(id);
            else if (collected === undefined) endPickupIntent(id, commit);
            else {
                const saved = Promise.resolve(pickupCommit || true).then((value) => {
                    if (value === true) notePickupIntentDone(id);
                    return value;
                });
                endPickupIntent(id, Promise.all([saved, commit || true, collected])
                    .then(([pickupSaved, healed, synced]) => pickupSaved === true && healed === true && synced === true));
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
    if (window.ZoeErrors) ZoeErrors.capture(new Error('Pickup journal collected mirror write refused'), { zone: 'data', context: 'resumePickupIntents collected', itemId: pickupJournalItemId(entry.item) || entry.id });
    writePickupJournal(readPickupJournal().filter((e) => e.id !== entry.id));
}

export async function resumePickupIntents() {
    if (dataState.pickupResumeInFlight) return;
    if (!firebaseState.db || !firebaseState.fb || !firebaseState.auth || !firebaseState.auth.currentUser || shopScopePending()) return;
    const views = [DB_LISTENER_KEY_HISTORY, DB_LISTENER_KEY_DELETED, 'dailyPickup'];
    if (views.some((k) => dbListenerViewIsStale(k))) return;
    const scope = shopScope();
    if (!scope) return;
    const journal = readPickupJournal();
    const fresh = journal.filter(pickupJournalEntryIsFresh);
    if (fresh.length !== journal.length) writePickupJournal(fresh);
    const due = fresh.filter((e) => e.scope === scope && !pickupIntentsLive.has(e.id));
    if (!due.length) return;
    dataState.pickupResumeInFlight = true;
    const resumeDb = firebaseState.db;
    const resumeGeneration = firebaseState.authGeneration;
    const resumeIsCurrent = () => firebaseState.db === resumeDb && firebaseState.authGeneration === resumeGeneration && shopScope() === scope;
    try {
        const since = pickupAddClockNow();
        for (const entry of due) {
            if (!resumeIsCurrent()) return;
            await withCleanupEntryOwnership(entry.id, async () => {
                if (!resumeIsCurrent() || !readPickupJournal().some((e) => e.id === entry.id)) return;
                const truth = await readPickupTruthViews();
                const stored = readPickupJournal().find((e) => e.id === entry.id);
                if (!resumeIsCurrent() || !stored) return;
                if (stored.pickupDone !== true) {
                    const marks = pickupTruthMarks(stored.date, stored.keys, truth.history, truth.trash);
                    if (marks.length) {
                        const dayRef = firebaseState.fb.ref(resumeDb, `zoew_daily_pickup_cod_dod/${stored.date}`);
                        const result = await dbOp(firebaseState.fb.runTransaction(dayRef, (current) => buildPickupRecordFromSet(
                            applyPickupMarksToSet(pickupSetFromRecord(current && typeof current === 'object' ? current : null), marks)))).catch(() => null);
                        if (!resumeIsCurrent() || !result || !result.committed) return;
                    }
                    notePickupIntentDone(stored.id);
                } else {
                    const drop = pickupTruthMarks(stored.date, stored.keys, truth.history, truth.trash)
                        .filter((mark) => !mark.closed && !pickupKeyAddedSince(mark.key, since));
                    if (drop.length) {
                        const dayRef = firebaseState.fb.ref(resumeDb, `zoew_daily_pickup_cod_dod/${stored.date}`);
                        const result = await dbOp(firebaseState.fb.runTransaction(dayRef, (current) => buildPickupRecordFromSet(applyPickupMarksToSet(
                            pickupSetFromRecord(current && typeof current === 'object' ? current : null),
                            drop.filter((mark) => !pickupKeyAddedSince(mark.key, since)))))).catch(() => null);
                        if (!resumeIsCurrent() || !result || !result.committed) return;
                    }
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
                writePickupJournal(readPickupJournal().filter((e) => e.id !== stored.id));
            });
        }
    } catch (e) {
        if (window.ZoeErrors) ZoeErrors.capture(e, { zone: 'data', context: 'resumePickupIntents' });
    } finally {
        dataState.pickupResumeInFlight = false;
    }
}
