import { dataState, firebaseState, uiState } from '../core/state';
import { PICKUP_DATE_KEY_PATTERN, cleanupClockIsTrustworthy, getServerNow } from '../core/clock';
import { DB_LISTENER_KEY_DAILY_COLLECTED } from '../core/text';
import { getZoneDateKey } from '../core/timezone';
import { elapsedSince } from '../core/elapsed';
import { barcodeEntriesOf } from './barcode';
import { applyPickupMarksInMemory, commitPickupMarks, countPickedUpCustomers, markPickupBarcodes, pickupAddClockNow, pickupBarcodeKey, pickupCopyMarks, pickupKeyAddedSince, pickupTruthMarks, readPickupTruthViews } from './pickup';
import { getCurrentFilterLabel, getPickupResetTargetDates, pickupStatsAreMeasurable } from '../features/export';
import { statsMoney } from '../features/monthly-report';
import { requestPinBeforeConfig } from '../features/pin';
import { dbListenerViewIsStale } from '../services/db-listeners';
import { armLateWrite, dbOp, dbOpStalled } from '../services/network';
import { txReadServerValue, txRestUrl } from '../services/tx-outcome';
import { refreshCurrentHistoryView } from '../ui/history-refresh';
import { showToast } from '../ui/toast';

export const DAILY_COLLECTED_KEEP_DAYS = 7;

export const DAILY_COLLECTED_DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function collectedSetFromRecord(record) {
    const out = {};
    if (!record || typeof record !== 'object') return out;
    Object.keys(record).forEach((key) => {
        const entry = record[key];
        if (!entry || typeof entry !== 'object') return;
        out[key] = { c: statsMoney(entry.c), d: statsMoney(entry.d) };
    });
    return out;
}

export function collectedMarkValueOf(barcode) {
    return { c: statsMoney(barcode && barcode.cod), d: statsMoney(barcode && barcode.dod) };
}

export function collectedDayOfStamp(stamp) {
    const ms = parseFloat(stamp);
    return isFinite(ms) && ms > 0 ? getZoneDateKey(ms, 0) : '';
}

export function collectedDayHoldingKey(key) {
    if (!key || !dataState.dailyCollectedData || typeof dataState.dailyCollectedData !== 'object') return '';
    const days = Object.keys(dataState.dailyCollectedData).sort().reverse();
    for (let i = 0; i < days.length; i++) {
        const record = dataState.dailyCollectedData[days[i]];
        if (record && typeof record === 'object' && Object.prototype.hasOwnProperty.call(record, key)) return days[i];
    }
    return '';
}

export function collectedMarksFor(barcode, desiredClosed, previousClosedAt) {
    const key = pickupBarcodeKey(barcode && barcode.code);
    if (!key) return [];
    const priorDay = collectedDayHoldingKey(key) || collectedDayOfStamp(previousClosedAt);
    if (!desiredClosed) return priorDay ? [{ key: key, day: priorDay, value: null }] : [];
    const day = collectedDayOfStamp(barcode && barcode.closedAt);
    if (!day) return [];
    const out = [];
    if (priorDay && priorDay !== day) out.push({ key: key, day: priorDay, value: null });
    out.push({ key: key, day: day, value: collectedMarkValueOf(barcode) });
    return out;
}

export function commitCollectedMarks(marks, quiet?) {
    if (!firebaseState.dbRefDailyCollected || !firebaseState.db || !firebaseState.fb || !marks || !marks.length) return Promise.resolve(null);
    const collectedAuthGeneration = firebaseState.authGeneration;
    const collectedDatabase = firebaseState.db;
    const updates = {};
    marks.forEach((mark) => {
        if (!mark || !mark.key || !mark.day) return;
        updates[`${mark.day}/${mark.key}`] = mark.value ? { c: mark.value.c, d: mark.value.d } : null;
    });
    if (!Object.keys(updates).length) return Promise.resolve(null);
    return firebaseState.fb.update(firebaseState.dbRefDailyCollected, updates).then(() => true, () => {
        if (!quiet && collectedAuthGeneration === firebaseState.authGeneration && collectedDatabase === firebaseState.db) showToast("⚠️ បរាជ័យក្នុងការ Save ចំណូលប្រចាំថ្ងៃ!");
        return null;
    });
}

export function markCollectedRevenue(marks, quiet?) {
    const list = (marks || []).filter((mark) => mark && mark.key && mark.day);
    if (!list.length) return null;
    list.server = commitCollectedMarks(list, quiet);
    return list;
}

export function reconcileCollectedPriceState(current, barcode, keep) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) return null;
    return barcode && barcode.isClosed && keep ? collectedMarkValueOf(barcode) : null;
}

export const COLLECTED_SETTLE_HOLD_MS = 2 * 60 * 1000;

export function collectedSettleHolds() {
    const memo: any = collectedSettleHolds;
    if (!(memo.holds instanceof Map)) memo.holds = new Map();
    return memo.holds;
}

export function holdCollectedSettle(itemId) {
    const settles = collectedSettleHolds();
    const token = {};
    let holds = settles.get(itemId);
    if (!holds) settles.set(itemId, holds = new Map());
    holds.set(token, Date.now());
    return () => {
        const current = settles.get(itemId);
        if (!current) return;
        current.delete(token);
        if (!current.size) settles.delete(itemId);
    };
}

export function collectedSettleHeld(itemId) {
    const settles = collectedSettleHolds();
    const holds = settles.get(itemId);
    if (!holds) return false;
    let held = false;
    holds.forEach((at, token) => { if (elapsedSince(at) < COLLECTED_SETTLE_HOLD_MS) held = true; else holds.delete(token); });
    if (!holds.size) settles.delete(itemId);
    return held;
}

export async function reconcileCollectedHistory(itemId, keys, attemptsLeft?, preserveCollectedDay?, quiet?, report?) {
    const targetKeys = [...new Set((keys || []).filter(Boolean))];
    if (!targetKeys.length || !firebaseState.dbRefDailyCollected || !firebaseState.db || !firebaseState.fb) return null;
    const attemptLimit = Math.min(3, Math.max(1, attemptsLeft || 3));
    const collectedAuthGeneration = firebaseState.authGeneration;
    const collectedDatabase = firebaseState.db;
    const collectedSdk = firebaseState.fb;
    const historyRef = collectedSdk.ref(collectedDatabase, `zoew_scan_history_cod_dod/${itemId}`);
    const isCurrent = () => collectedAuthGeneration === firebaseState.authGeneration && collectedDatabase === firebaseState.db;
    const barcodesOf = (item) => (item ? barcodeEntriesOf(item.barcodes).map((entry) => entry.barcode) : []);
    const readState = (snapshot) => {
        const item = snapshot && snapshot.val();
        const barcodes = barcodesOf(item);
        return targetKeys.map((key) => {
            const barcode = barcodes.find((entry) => entry && pickupBarcodeKey(entry.code) === key);
            return barcode ? { code: barcode.code, cod: statsMoney(barcode.cod), dod: statsMoney(barcode.dod), isClosed: !!barcode.isClosed, closedAt: barcode.closedAt || null } : null;
        });
    };
    const readCurrentState = async () => {
        const history = await dbOp(collectedSdk.get(historyRef));
        if (!isCurrent()) return [];
        const state = history && history.val() ? readState(history)
            : readState(await dbOp(collectedSdk.get(collectedSdk.ref(collectedDatabase, `zoew_recently_deleted_cod_dod/${itemId}`))));
        if (!isCurrent()) return [];
        const missing = new Set(targetKeys.filter((key, index) => !state[index]));
        if (!missing.size) return state;
        const copies = (dataState.deletedItems || []).filter((entry) => entry && typeof entry.id === 'string' && entry.id !== itemId && /^[a-zA-Z0-9_-]+$/.test(entry.id)
            && barcodesOf(entry).some((barcode) => barcode && missing.has(pickupBarcodeKey(barcode.code))));
        for (const copy of copies) {
            const snapshot = await dbOp(collectedSdk.get(collectedSdk.ref(collectedDatabase, `zoew_recently_deleted_cod_dod/${copy.id}`)));
            if (!isCurrent()) return [];
            const value = snapshot && snapshot.val();
            if (!value || value.trashReason !== 'pickup') continue;
            readState(snapshot).forEach((entry, index) => { if (!state[index] && entry && entry.isClosed) state[index] = entry; });
            if (state.every(Boolean)) break;
        }
        return state;
    };
    const failedText = "⚠️ ស្ថានភាពបានរក្សាទុក ប៉ុន្តែចំណូលប្រចាំថ្ងៃមិនទាន់ Sync ពេញលេញទេ!";
    let latePending = false;
    try {
        let state = await readCurrentState();
        for (let attempt = 0; attempt < attemptLimit; attempt++) {
            if (!isCurrent()) return null;
            const barcodes = state.filter(Boolean);
            if (!barcodes.length) break;
            let applied;
            if (preserveCollectedDay) {
                const viewDays = new Set(Object.keys(dataState.dailyCollectedData || {}).filter((day) => PICKUP_DATE_KEY_PATTERN.test(day)));
                const now = getServerNow();
                for (let index = 0; index < DAILY_COLLECTED_KEEP_DAYS; index++) viewDays.add(getZoneDateKey(now, -index));
                barcodes.forEach((barcode) => { const day = collectedDayOfStamp(barcode.closedAt); if (day) viewDays.add(day); });
                const days = [...viewDays].sort().reverse();
                const writeLeaf = (day, key, decide) => {
                    let held = false;
                    return collectedSdk.runTransaction(collectedSdk.ref(collectedDatabase, `zoew_daily_collected_cod_dod/${day}/${key}`), (current) => {
                        if (!isCurrent()) return;
                        held = !!(current && typeof current === 'object' && !Array.isArray(current));
                        return decide(current);
                    }, { applyLocally: false }).then((result) => ({ committed: !!(result && result.committed), held: held, day: day }));
                };
                const writeBarcode = async (barcode) => {
                    const key = pickupBarcodeKey(barcode.code);
                    const first = await Promise.all(days.map((day) => writeLeaf(day, key, (current) => reconcileCollectedPriceState(current, barcode, true))));
                    if (first.some((entry) => !entry.committed)) return false;
                    const heldDays = first.filter((entry) => entry.held).map((entry) => entry.day);
                    if (!barcode.isClosed || heldDays.length < 2) return true;
                    const older = await Promise.all(heldDays.slice(1).map((day) => writeLeaf(day, key, (current) => reconcileCollectedPriceState(current, barcode, false))));
                    return older.every((entry) => entry.committed);
                };
                applied = { server: Promise.all(barcodes.map(writeBarcode)).then((results) => results.every(Boolean)) };
            } else {
                const days = new Set(Object.keys(dataState.dailyCollectedData || {}).filter((day) => PICKUP_DATE_KEY_PATTERN.test(day)));
                const now = getServerNow();
                const cutoff = collectedRetentionCutoffKey(now);
                for (let index = 0; index < DAILY_COLLECTED_KEEP_DAYS; index++) days.add(getZoneDateKey(now, -index));
                const marks = [];
                barcodes.forEach((barcode) => {
                    const key = pickupBarcodeKey(barcode.code);
                    days.forEach((day) => { marks.push({ key: key, day: day, value: null }); });
                    if (barcode.isClosed) marks.push(...collectedMarksFor(barcode, true, barcode.closedAt).filter((mark) => !mark.value || mark.day >= cutoff));
                });
                applied = markCollectedRevenue(marks, quiet);
            }
            if (!applied) return null;
            let saved;
            try {
                saved = await dbOp(applied.server);
            } catch (error) {
                if (preserveCollectedDay && error && error.message === 'set' && attempt + 1 < attemptLimit && isCurrent()) {
                    state = await readCurrentState();
                    continue;
                }
                if (dbOpStalled(error) && attempt + 1 < attemptLimit) {
                    const retriesLeft = attemptLimit - attempt - 1;
                    latePending = armLateWrite(applied.server, () => {
                        if (!isCurrent()) return null;
                        return Promise.resolve(reconcileCollectedHistory(itemId, targetKeys, retriesLeft, preserveCollectedDay, quiet)).then((saved) => {
                            if (saved === true && isCurrent() && !quiet) showToast("✅ បណ្តាញត្រឡប់មកវិញ — ចំណូលប្រចាំថ្ងៃបាន Sync រួចរាល់!");
                            return saved;
                        });
                    }, null, 'reconcileCollectedHistory');
                }
                throw error;
            }
            if (!saved || !isCurrent()) {
                if (!saved && report && typeof report === 'object') report.refused = true;
                return null;
            }
            const next = await readCurrentState();
            if (!isCurrent()) return null;
            if (JSON.stringify(next) === JSON.stringify(state)) {
                if (state.some((barcode) => !barcode)) break;
                return true;
            }
            state = next;
        }
    } catch (error) {}
    if (!isCurrent()) return null;
    if (latePending) {
        if (!quiet) showToast("⏳ ស្ថានភាពបានរក្សាទុក — ចំណូលប្រចាំថ្ងៃនឹង Sync ដោយស្វ័យប្រវត្តិពេលបណ្តាញត្រឡប់មកវិញ។");
        return 'pending';
    }
    if (!quiet) showToast(failedText);
    return null;
}

export function syncCollectedValueForBarcode(itemId, barcodeCode) {
    const key = pickupBarcodeKey(barcodeCode);
    if (!key) return null;
    return reconcileCollectedHistory(itemId, [key], undefined, true);
}

export function collectedTotalsOfDay(record) {
    const set = collectedSetFromRecord(record);
    const keys = Object.keys(set);
    let cod = 0;
    let dod = 0;
    keys.forEach((key) => { cod += set[key].c; dod += set[key].d; });
    cod = Math.round(cod * 100) / 100;
    dod = Math.round(dod * 100) / 100;
    return { cod: cod, dod: dod, total: Math.round((cod + dod) * 100) / 100, count: keys.length };
}

export function collectedRetentionCutoffKey(now) {
    return getZoneDateKey(now, -(DAILY_COLLECTED_KEEP_DAYS - 1));
}

export function staleCollectedDays(map, now) {
    const source = (map && typeof map === 'object') ? map : {};
    const cutoff = collectedRetentionCutoffKey(now);
    return Object.keys(source)
        .filter((day) => DAILY_COLLECTED_DAY_PATTERN.test(day) && day < cutoff)
        .sort();
}

export function runAutomaticCollectedCleanup() {
    if (!firebaseState.db || !firebaseState.fb || !firebaseState.dbRefDailyCollected) return;
    if (!cleanupClockIsTrustworthy()) return;
    if (dbListenerViewIsStale(DB_LISTENER_KEY_DAILY_COLLECTED)) return;
    const stale = staleCollectedDays(dataState.dailyCollectedData, getServerNow());
    if (!stale.length) return;
    const collectedAuthGeneration = firebaseState.authGeneration;
    const collectedDatabase = firebaseState.db;
    const payload = {};
    stale.forEach((day) => {
        payload[day] = null;
    });
    dbOp(firebaseState.fb.update(firebaseState.dbRefDailyCollected, payload), 'ការសម្អាតចំណូលប្រចាំថ្ងៃ').catch((error) => {
        if (collectedAuthGeneration !== firebaseState.authGeneration || collectedDatabase !== firebaseState.db) return;
        if (window.ZoeErrors) ZoeErrors.capture(error, { zone: 'data', context: 'runAutomaticCollectedCleanup' });
    });
}

export function reapplyPickupMarks(applied, marks, scanDateStr, existingOnly = false, excludedFromServer = false) {
    const next = (marks || []).filter((m) => m && m.key);
    const keep = {};
    next.forEach((m) => { keep[m.key] = true; });
    const excluded = ((applied && applied.previous) || []).filter((p) => !keep[p.key]);
    const day = scanDateStr || (applied && applied.scanDate);
    const onlyExisting = existingOnly || applied?.existingOnly === true;
    if (excludedFromServer && excluded.length) {
        const requested = new Set(excluded.map((p) => p.key));
        const resolved = revertPickupMarks({ scanDate: day, existingOnly: onlyExisting, previous: excluded,
            marks: ((applied && applied.marks) || []).filter((m) => m && requested.has(m.key)) }, null, true);
        const written = next.length ? markPickupBarcodes(day, next, onlyExisting) : null;
        const commit = Promise.all([resolved.commit, written ? written.commit : true]).then(([truth, saved]) => (truth === true && saved === true ? true : null));
        return { scanDate: day, marks: next, previous: written ? written.previous : [], changed: !!(written && written.changed), commit, ...(onlyExisting ? { existingOnly: true } : {}) };
    }
    const undo = excluded.map((p) => ({ key: p.key, phoneKey: p.phoneKey, closed: !!p.closed }));
    const all = undo.concat(next);
    if (!all.length) return null;
    return markPickupBarcodes(day, all, onlyExisting);
}

export function healPickupKeysLeftRow(itemId, applied) {
    const written = ((applied && applied.marks) || []).filter((m) => m && m.key && m.closed);
    if (!written.length || !applied.commit || !/^[a-zA-Z0-9_-]+$/.test(String(itemId || ''))) return applied;
    const healDb = firebaseState.db;
    const healSdk = firebaseState.fb;
    const healGeneration = firebaseState.authGeneration;
    const since = pickupAddClockNow();
    const current = () => healDb === firebaseState.db && healGeneration === firebaseState.authGeneration;
    const keep = (key) => !pickupKeyAddedSince(key, since);
    const heldInRow = async () => {
        const ref = healSdk.ref(healDb, 'zoew_scan_history_cod_dod/' + itemId);
        const url = txRestUrl(ref);
        const row = url ? await txReadServerValue(url) : (await dbOp(healSdk.get(ref))).val();
        return new Set(pickupCopyMarks(row, false).filter((m) => m.closed).map((m) => m.key));
    };
    const commit = Promise.resolve(applied.commit).then(async (saved) => {
        if (saved !== true || !current() || !healSdk) return saved;
        const held = await heldInRow();
        if (!current()) return null;
        const left = written.filter((m) => !held.has(m.key));
        if (!left.length) return true;
        const views = await readPickupTruthViews();
        if (!current()) return null;
        const truth = new Set(pickupTruthMarks(applied.scanDate, left.map((m) => m.key), views.history, views.trash).filter((m) => m.closed).map((m) => m.key));
        const decided = left.filter((m) => !truth.has(m.key));
        if (!decided.length) return true;
        const heldNow = await heldInRow();
        if (!current()) return null;
        const drop = decided.filter((m) => !heldNow.has(m.key) && keep(m.key)).map((m) => ({ key: m.key, phoneKey: m.phoneKey, closed: false }));
        if (!drop.length) return true;
        applyPickupMarksInMemory(applied.scanDate, drop, applied.existingOnly === true);
        return commitPickupMarks(applied.scanDate, drop, applied.existingOnly === true, true, keep);
    }).catch(() => null);
    return { ...applied, commit, pickupCommit: applied.commit };
}

export function revertPickupMarks(applied, truthMarks?, refreshFromServer = false) {
    if (!applied || !applied.scanDate || !applied.previous || !applied.previous.length) return null;
    if (refreshFromServer) {
        const rollbackDb = firebaseState.db;
        const rollbackGeneration = firebaseState.authGeneration;
        const commit = readPickupTruthViews().then((views) => {
            if (rollbackDb !== firebaseState.db || rollbackGeneration !== firebaseState.authGeneration) return null;
            const marks = pickupTruthMarks(applied.scanDate, applied.previous.map((mark) => mark.key), views.history, views.trash);
            const reverted = revertPickupMarks(applied, marks);
            return reverted ? reverted.commit : null;
        }, () => null);
        return Object.assign({}, applied, { commit });
    }
    const truth = new Map<string, any>();
    (Array.isArray(truthMarks) ? truthMarks : []).forEach((mark) => { if (mark && mark.key) truth.set(mark.key, mark); });
    const wanted = new Map<string, any>();
    (applied.marks || []).forEach((mark) => { if (mark && mark.key) wanted.set(mark.key, mark); });
    const marks = applied.previous.map((p) => {
        const requested = wanted.get(p.key);
        const changed = requested && (!!requested.closed !== !!p.closed || requested.closed && requested.phoneKey !== p.phoneKey);
        const current = changed ? truth.get(p.key) || p : p;
        return { key: p.key, phoneKey: current.phoneKey, closed: !!current.closed };
    });
    applyPickupMarksInMemory(applied.scanDate, marks, applied.existingOnly === true);
    const commit = commitPickupMarks(applied.scanDate, marks, applied.existingOnly === true);
    return Object.assign({}, applied, { commit: commit });
}

export function requestPinBeforeResetPickup() {
    requestPinBeforeConfig(resetPickupStats, 'resetPickup');
}

let pickupResetOwner = null;

export async function resetPickupStats() {
    if (dataState.pickupResetInFlight) return;
    const filterLabel = getCurrentFilterLabel();
    if (!pickupStatsAreMeasurable()) {
        showToast(`⏳ ចំនួន «យករួច» មិនទាន់ Sync — សូមរង់ចាំបន្តិច រួច Reset តម្រង «${filterLabel}» ម្តងទៀត។`);
        return;
    }
    const targetDates = getPickupResetTargetDates();
    if (!targetDates.length) {
        showToast(`⚠️ គ្មានទិន្នន័យ «យករួច» ក្នុងតម្រង «${filterLabel}» ដើម្បី Reset ទេ។`);
        return;
    }
    const currentCustomers = targetDates.reduce((sum, d) => sum + countPickedUpCustomers(dataState.dailyPickupData[d]), 0);
    const currentPackages = targetDates.reduce((sum, d) => sum + (parseFloat((dataState.dailyPickupData[d] || {}).packagesPickedUp) || 0), 0);
    if (!currentCustomers && !currentPackages) {
        showToast(`⚠️ តម្រង «${filterLabel}» មានចំនួនយករួច 0 រួចជាស្រេច — គ្មានអ្វីត្រូវ Reset ទេ។`);
        return;
    }
    const scopeNote = uiState.currentFilterMode === 'all'
        ? `ទិន្នន័យ ${targetDates.length} ថ្ងៃ`
        : `ថ្ងៃផ្សេងមិនប៉ះពាល់ទេ`;
    if (!confirm(`តើអ្នកពិតជាចង់ Reset ចំនួនអតិថិជនយក (${currentCustomers}) និងចំនួនកញ្ចប់យក (${currentPackages}) ក្នុងតម្រង «${filterLabel}» ទៅ 0 មែនទេ?\n\n· ${scopeNote}\n· ទឹកប្រាក់ COD/DOD និងបញ្ជីកញ្ចប់ មិនប្តូរទេ`)) return;
    if (!firebaseState.dbRefDailyPickup || !firebaseState.db || !firebaseState.fb) {
        showToast("⚠️ មិនអាច Reset បានទេ! សូមពិនិត្យការតភ្ជាប់ Firebase ហើយសាកល្បងម្តងទៀត។");
        return;
    }

    const resetDatabase = firebaseState.db;
    const resetAuthGeneration = firebaseState.authGeneration;
    const resetSdk = firebaseState.fb;
    const resetOwner = {};
    pickupResetOwner = resetOwner;
    const resetIsCurrent = () => pickupResetOwner === resetOwner && resetDatabase === firebaseState.db && resetAuthGeneration === firebaseState.authGeneration;
    dataState.pickupResetInFlight = true;
    let doneCount = 0;
    let failedCount = 0;
    let stalled = false;
    try {
        for (const dateKey of targetDates) {
            if (!resetIsCurrent()) return;
            try {
                const result = await dbOp(resetSdk.runTransaction(resetSdk.ref(resetDatabase, `zoew_daily_pickup_cod_dod/${dateKey}`), () => resetIsCurrent() ? { packagesPickedUp: 0 } : undefined));
                if (!resetIsCurrent()) return;
                if (!result?.committed) throw new Error('Pickup reset was not committed');
                dataState.dailyPickupData[dateKey] = { packagesPickedUp: 0, pickedUpPhones: {}, pickedUpBarcodes: {} };
                doneCount++;
            } catch (e) {
                if (!resetIsCurrent()) return;
                failedCount++;
                if (window.ZoeErrors) ZoeErrors.capture(e, { zone: 'money', context: 'resetPickupStats', date: dateKey });
                if (dbOpStalled(e)) { stalled = true; break; }
            }
        }
    } finally {
        if (resetIsCurrent()) dataState.pickupResetInFlight = false;
    }

    if (!resetIsCurrent()) return;
    refreshCurrentHistoryView();
    if (stalled) {
        showToast(doneCount
            ? `⚠️ បណ្តាញឆ្លើយមិនចេញ — Reset បានតែ ${doneCount} ថ្ងៃ។ សូមពិនិត្យអ៊ីនធឺណិត ហើយសាកល្បងម្តងទៀត។`
            : "⚠️ បណ្តាញឆ្លើយមិនចេញ — Reset មិនបានទេ។ សូមពិនិត្យអ៊ីនធឺណិត ហើយសាកល្បងម្តងទៀត។");
    } else if (failedCount && !doneCount) {
        showToast("❌ Reset បរាជ័យទាំងស្រុង! សូមពិនិត្យការតភ្ជាប់ ហើយសាកល្បងម្តងទៀត។");
    } else if (failedCount) {
        showToast(`⚠️ Reset បានតែ ${doneCount} ថ្ងៃ — ${failedCount} ថ្ងៃបរាជ័យ។ សូមសាកល្បងម្តងទៀត។`);
    } else {
        showToast(`✅ Reset ចំនួនអតិថិជន និងកញ្ចប់យករួច ក្នុងតម្រង «${filterLabel}» ជោគជ័យ!`);
    }
}
