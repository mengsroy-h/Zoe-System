import { dataState, firebaseState, uiState } from '../core/state';
import { PICKUP_DATE_KEY_PATTERN, cleanupClockIsTrustworthy, getServerNow } from '../core/clock';
import { DB_LISTENER_KEY_DAILY_COLLECTED } from '../core/text';
import { getZoneDateKey } from '../core/timezone';
import { applyPickupMarksInMemory, commitPickupMarks, countPickedUpCustomers, markPickupBarcodes, pickupBarcodeKey } from './pickup';
import { getCurrentFilterLabel, getPickupResetTargetDates } from '../features/export';
import { statsMoney } from '../features/monthly-report';
import { requestPinBeforeConfig } from '../features/pin';
import { dbListenerViewIsStale } from '../services/db-listeners';
import { armLateWrite, dbOp, dbOpStalled } from '../services/network';
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

export function commitCollectedMarks(marks) {
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
        if (collectedAuthGeneration === firebaseState.authGeneration && collectedDatabase === firebaseState.db) showToast("⚠️ បរាជ័យក្នុងការ Save ចំណូលប្រចាំថ្ងៃ!");
        return null;
    });
}

export function markCollectedRevenue(marks) {
    const list = (marks || []).filter((mark) => mark && mark.key && mark.day);
    if (!list.length) return null;
    list.server = commitCollectedMarks(list);
    return list;
}

export function reconcileCollectedPriceState(current, barcodes) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) return current;
    const next = { ...current };
    const days = Object.keys(current).filter((day) => PICKUP_DATE_KEY_PATTERN.test(day)).sort().reverse();
    (Array.isArray(barcodes) ? barcodes : []).forEach((barcode) => {
        const key = pickupBarcodeKey(barcode && barcode.code);
        if (!key) return;
        const heldDays = days.filter((day) => current[day] && typeof current[day] === 'object'
            && Object.prototype.hasOwnProperty.call(current[day], key));
        heldDays.forEach((day, index) => {
            const record = { ...next[day] };
            if (barcode.isClosed && index === 0) record[key] = collectedMarkValueOf(barcode);
            else delete record[key];
            if (Object.keys(record).length) next[day] = record;
            else delete next[day];
        });
    });
    return next;
}

export async function reconcileCollectedHistory(itemId, keys, attemptsLeft?, preserveCollectedDay?) {
    const targetKeys = [...new Set((keys || []).filter(Boolean))];
    if (!targetKeys.length || !firebaseState.dbRefDailyCollected || !firebaseState.db || !firebaseState.fb) return null;
    const attemptLimit = Math.min(3, Math.max(1, attemptsLeft || 3));
    const collectedAuthGeneration = firebaseState.authGeneration;
    const collectedDatabase = firebaseState.db;
    const collectedSdk = firebaseState.fb;
    const collectedRef = firebaseState.dbRefDailyCollected;
    const historyRef = collectedSdk.ref(collectedDatabase, `zoew_scan_history_cod_dod/${itemId}`);
    const isCurrent = () => collectedAuthGeneration === firebaseState.authGeneration && collectedDatabase === firebaseState.db;
    const readState = (snapshot) => {
        const item = snapshot && snapshot.val();
        const barcodes = item && Array.isArray(item.barcodes) ? item.barcodes : item && item.barcode ? [item] : [];
        return targetKeys.map((key) => {
            const barcode = barcodes.find((entry) => entry && pickupBarcodeKey(entry.code) === key);
            return barcode ? { code: barcode.code, cod: statsMoney(barcode.cod), dod: statsMoney(barcode.dod), isClosed: !!barcode.isClosed, closedAt: barcode.closedAt || null } : null;
        });
    };
    const readCurrentState = async () => {
        const history = await dbOp(collectedSdk.get(historyRef));
        if (!isCurrent()) return [];
        if (history && history.val()) return readState(history);
        return readState(await dbOp(collectedSdk.get(collectedSdk.ref(collectedDatabase, `zoew_recently_deleted_cod_dod/${itemId}`))));
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
                const write = collectedSdk.runTransaction(collectedRef, (current) => {
                    if (!isCurrent()) return;
                    return reconcileCollectedPriceState(current, barcodes);
                }, { applyLocally: false });
                applied = { server: write.then((result) => !!(result && result.committed)) };
            } else {
                const days = new Set(Object.keys(dataState.dailyCollectedData || {}).filter((day) => PICKUP_DATE_KEY_PATTERN.test(day)));
                const now = getServerNow();
                for (let index = 0; index < DAILY_COLLECTED_KEEP_DAYS; index++) days.add(getZoneDateKey(now, -index));
                const marks = [];
                barcodes.forEach((barcode) => {
                    const key = pickupBarcodeKey(barcode.code);
                    days.forEach((day) => { marks.push({ key: key, day: day, value: null }); });
                    if (barcode.isClosed) marks.push(...collectedMarksFor(barcode, true, barcode.closedAt));
                });
                applied = markCollectedRevenue(marks);
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
                        return Promise.resolve(reconcileCollectedHistory(itemId, targetKeys, retriesLeft, preserveCollectedDay)).then((saved) => {
                            if (saved === true && isCurrent()) showToast("✅ បណ្តាញត្រឡប់មកវិញ — ចំណូលប្រចាំថ្ងៃបាន Sync រួចរាល់!");
                            return saved;
                        });
                    }, null, 'reconcileCollectedHistory');
                }
                throw error;
            }
            if (!saved || !isCurrent()) return null;
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
        showToast("⏳ ស្ថានភាពបានរក្សាទុក — ចំណូលប្រចាំថ្ងៃនឹង Sync ដោយស្វ័យប្រវត្តិពេលបណ្តាញត្រឡប់មកវិញ។");
        return 'pending';
    }
    showToast(failedText);
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

export function reapplyPickupMarks(applied, marks, scanDateStr, seed) {
    const next = (marks || []).filter((m) => m && m.key);
    const keep = {};
    next.forEach((m) => { keep[m.key] = true; });
    const undo = ((applied && applied.previous) || [])
        .filter((p) => !keep[p.key])
        .map((p) => ({ key: p.key, phoneKey: p.phoneKey, closed: !!p.closed }));
    const all = undo.concat(next);
    if (!all.length) return null;
    return markPickupBarcodes(scanDateStr || (applied && applied.scanDate), all, seed || (applied && applied.seed) || null);
}

export function revertPickupMarks(applied) {
    if (!applied || !applied.scanDate || !applied.previous || !applied.previous.length) return null;
    const marks = applied.previous.map((p) => ({ key: p.key, phoneKey: p.phoneKey, closed: !!p.closed }));
    applyPickupMarksInMemory(applied.scanDate, marks, applied.seed);
    commitPickupMarks(applied.scanDate, marks, applied.seed);
    return applied;
}

export function requestPinBeforeResetPickup() {
    requestPinBeforeConfig(resetPickupStats, 'resetPickup');
}

export async function resetPickupStats() {
    if (dataState.pickupResetInFlight) return;
    const filterLabel = getCurrentFilterLabel();
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

    dataState.pickupResetInFlight = true;
    let doneCount = 0;
    let failedCount = 0;
    let stalled = false;
    try {
        for (const dateKey of targetDates) {
            try {
                await dbOp(firebaseState.fb.runTransaction(firebaseState.fb.ref(firebaseState.db, `zoew_daily_pickup_cod_dod/${dateKey}`), () => ({ packagesPickedUp: 0 })));
                dataState.dailyPickupData[dateKey] = { packagesPickedUp: 0, pickedUpPhones: {}, pickedUpBarcodes: {} };
                doneCount++;
            } catch (e) {
                failedCount++;
                if (window.ZoeErrors) ZoeErrors.capture(e, { zone: 'money', context: 'resetPickupStats', date: dateKey });
                if (dbOpStalled(e)) { stalled = true; break; }
            }
        }
    } finally {
        dataState.pickupResetInFlight = false;
    }

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
