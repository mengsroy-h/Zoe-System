import { dataState, firebaseState } from '../core/state';
import { dbListenerPendingPaths } from '../core/text';
import { getFormattedDate } from '../core/timezone';
import { ledgerNumber } from './ledger';
import { barcodeRegistryKey } from './registry';
import { dbOp } from '../services/network';
import { showToast } from '../ui/toast';

export const PICKUP_LEGACY_KEY_PREFIX = '_lg_';

export const PICKUP_LEGACY_PLACEHOLDER_MAX = 20000;

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

export function legacyPickupPlaceholders(record) {
    const recorded = Math.min(PICKUP_LEGACY_PLACEHOLDER_MAX,
        Math.max(0, Math.round(ledgerNumber(record && record.packagesPickedUp))));
    const phones = (record && record.pickedUpPhones && typeof record.pickedUpPhones === 'object') ? record.pickedUpPhones : {};
    const phoneKeys = Object.keys(phones);
    const out = {};
    let made = 0;
    phoneKeys.forEach((phone) => {
        const times = Math.max(0, Math.round(ledgerNumber(phones[phone])));
        for (let i = 1; i <= times && made < recorded; i++) {
            out[PICKUP_LEGACY_KEY_PREFIX + phone + '_' + i] = phone;
            made++;
        }
    });
    if (made < recorded && phoneKeys.length) {
        const phone = phoneKeys[0];
        let extra = 1;
        while (made < recorded) {
            const key = PICKUP_LEGACY_KEY_PREFIX + phone + '_x' + extra;
            if (!out[key]) { out[key] = phone; made++; }
            extra++;
        }
    }
    return out;
}

export function pickupSetFromRecord(record, seed) {
    if (record && record.pickedUpBarcodes && typeof record.pickedUpBarcodes === 'object') return { ...record.pickedUpBarcodes };
    const recorded = Math.max(0, Math.round(ledgerNumber(record && record.packagesPickedUp)));
    if (seed && typeof seed === 'object' && pickupSetSize(seed) === recorded) return { ...seed };
    return legacyPickupPlaceholders(record);
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

export function applyPickupMarksToSet(set, marks) {
    (marks || []).forEach((mark) => {
        if (!mark || !mark.key) return;
        if (mark.closed) {
            if (typeof mark.phoneKey === 'string' && mark.phoneKey) set[mark.key] = mark.phoneKey;
        } else delete set[mark.key];
    });
    return set;
}

export function collectPickupMarks(item, closed?, phoneKey?) {
    if (!item) return [];
    const owner = phoneKey || getPickupPhoneKey(item);
    const entries = (item.barcodes && Array.isArray(item.barcodes)) ? item.barcodes : null;
    const marks = [];
    if (entries) {
        entries.forEach((b) => {
            if (!b) return;
            const key = pickupBarcodeKey(b.code);
            if (key) marks.push({ key: key, phoneKey: owner, closed: closed === undefined ? !!b.isClosed : !!closed });
        });
        return marks;
    }
    const key = pickupBarcodeKey(item.barcode);
    if (key) marks.push({ key: key, phoneKey: owner, closed: closed === undefined ? !!item.isClosed : !!closed });
    return marks;
}

export function reconstructPickupSet(dateKey) {
    const set = {};
    const collect = (list) => {
        (list || []).forEach((item) => {
            if (!item || item.scanDate !== dateKey) return;
            collectPickupMarks(item).forEach((mark) => {
                if (mark.closed) set[mark.key] = mark.phoneKey;
            });
        });
    };
    collect(dataState.scanHistory);
    collect(dataState.deletedItems);
    return set;
}

export function planPickupLedgerRepair(ledger, historyItems, trashItems) {
    const plans = [];
    if (!ledger) return plans;
    const byDate = {};
    const collect = (list) => {
        (list || []).forEach((item) => {
            if (!item || !item.scanDate) return;
            const set = byDate[item.scanDate] || (byDate[item.scanDate] = {});
            collectPickupMarks(item).forEach((mark) => {
                if (mark.closed) set[mark.key] = mark.phoneKey;
            });
        });
    };
    collect(historyItems);
    collect(trashItems);

    Object.keys(ledger).forEach((date) => {
        const record = ledger[date];
        if (!record || typeof record !== 'object') return;
        const recorded = Math.max(0, Math.round(ledgerNumber(record.packagesPickedUp)));
        const set = byDate[date] || {};
        if (pickupSetSize(set) !== recorded) return;
        const current = (record.pickedUpBarcodes && typeof record.pickedUpBarcodes === 'object') ? record.pickedUpBarcodes : null;
        if (!current && !recorded) return;
        if (current) {
            const keys = Object.keys(set);
            if (keys.length === Object.keys(current).length && keys.every((k) => current[k] === set[k])) return;
        }
        plans.push({ date: date, pickedUpBarcodes: set });
    });
    return plans;
}

export async function repairPickupLedgerOnce() {
    if (dataState.pickupLedgerRepairDone || dataState.pickupLedgerRepairRunning) return;
    if (!firebaseState.db || !firebaseState.fb || !firebaseState.auth || !firebaseState.auth.currentUser) return;
    if (dbListenerPendingPaths.size || firebaseState.dbListenersFailed) return;
    dataState.pickupLedgerRepairRunning = true;
    const repairDb = firebaseState.db;
    const repairGeneration = firebaseState.authGeneration;
    const repairIsCurrent = () => firebaseState.db === repairDb && firebaseState.authGeneration === repairGeneration;
    try {
        const plans = planPickupLedgerRepair(dataState.dailyPickupData, dataState.scanHistory, dataState.deletedItems);
        for (const plan of plans) {
            if (!repairIsCurrent()) return;
            if (!/^[0-9-]+$/.test(plan.date)) continue;
            const dayRef = firebaseState.fb.ref(repairDb, `zoew_daily_pickup_cod_dod/${plan.date}`);
            await dbOp(firebaseState.fb.runTransaction(dayRef, (record) => {
                if (!record) return record;
                const recorded = Math.max(0, Math.round(ledgerNumber(record.packagesPickedUp)));
                if (pickupSetSize(plan.pickedUpBarcodes) !== recorded) return record;
                return buildPickupRecordFromSet(plan.pickedUpBarcodes);
            })).catch(() => {});
        }
        if (!repairIsCurrent()) return;
        dataState.pickupLedgerRepairDone = true;
    } catch (e) {
        if (window.ZoeErrors) ZoeErrors.capture(e, { zone: 'money', context: 'repairPickupLedgerOnce' });
    } finally {
        dataState.pickupLedgerRepairRunning = false;
    }
}

export function applyPickupMarksInMemory(scanDateStr, marks, seed) {
    const set = pickupSetFromRecord(dataState.dailyPickupData[scanDateStr] || null, seed);
    const previous = (marks || []).filter((m) => m && m.key).map((m) => ({
        key: m.key,
        phoneKey: typeof set[m.key] === 'string' ? set[m.key] : null,
        closed: Object.prototype.hasOwnProperty.call(set, m.key)
    }));
    applyPickupMarksToSet(set, marks);
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

export function commitPickupMarks(scanDateStr, marks, seed) {
    if (!firebaseState.dbRefDailyPickup || !firebaseState.db || !firebaseState.fb) return Promise.resolve(null);
    const dateRef = firebaseState.fb.ref(firebaseState.db, `zoew_daily_pickup_cod_dod/${scanDateStr}`);
    return firebaseState.fb.runTransaction(dateRef, (current) => {
        const set = pickupSetFromRecord((current && typeof current === 'object') ? current : null, seed);
        applyPickupMarksToSet(set, marks);
        return buildPickupRecordFromSet(set);
    }).then((result) => (result && result.committed) ? true : null, () => {
        showToast("⚠️ បរាជ័យក្នុងការ Save Daily Pickup!");
        return null;
    });
}

export function markPickupBarcodes(scanDateStr, marks, seed) {
    if (!scanDateStr) scanDateStr = getFormattedDate();
    const list = (marks || []).filter((m) => m && m.key);
    if (!list.length) return null;
    const applied = applyPickupMarksInMemory(scanDateStr, list, seed);
    commitPickupMarks(scanDateStr, list, seed);
    return { scanDate: scanDateStr, marks: list, seed: seed || null, previous: applied.previous, changed: applied.changed };
}
