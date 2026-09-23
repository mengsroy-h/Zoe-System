import { byId } from '../core/dom';
import { firebaseState, uiState } from '../core/state';
import { getServerNow } from '../core/clock';
import { DB_LISTENER_KEY_HISTORY, sanitizePhoneNumber } from '../core/text';
import { safeFocusScanner } from '../core/timezone';
import { barcodeEntriesOf, normalizeBarcodesOf } from '../domain/barcode';
import { findLockerOccupant, getEntryCurrentLocker, isValidLockerName, lockerCodeKey, lockerErrorFeedback, lockerSuccessFeedback, openLockerPicker } from './locker';
import { dbListenerViewIsStale } from '../services/db-listeners';
import { withTimeout } from '../services/network';
import { renderLockerList } from '../ui/entry-list';
import { refreshCurrentHistoryView } from '../ui/history-refresh';
import { closeModal, openModalHelper } from '../ui/modal';
import { showToast } from '../ui/toast';

export function handleLockerScan(code) {
    const key = lockerCodeKey(code);
    if (!key) return;
    if (!isValidLockerName(uiState.activeLocker)) {
        lockerErrorFeedback();
        showToast('⚠️ សូមជ្រើសរើសទីតាំង Locker សិន!');
        openLockerPicker();
        return;
    }
    if (dbListenerViewIsStale(DB_LISTENER_KEY_HISTORY)) {
        lockerErrorFeedback();
        showToast(`⚠️ ទិន្នន័យកញ្ចប់មិនទាន់ Sync គ្រប់ — មិនអាចបញ្ជាក់ទីតាំង Barcode "${key}" បានទេ។ សូមរង់ចាំ ហើយស្កេនម្តងទៀត។`);
        safeFocusScanner();
        return;
    }
    const entry = uiState.lockerBarcodeIndex[key];
    if (!entry) {
        lockerErrorFeedback();
        showToast(`❌ រកមិនឃើញ Barcode "${key}" ក្នុងប្រព័ន្ធ! សូមបញ្ចូលកញ្ចប់នេះជាមុនសិន។`);
        safeFocusScanner();
        return;
    }
    const currentLocker = getEntryCurrentLocker(entry);
    const hasLocker = !!(currentLocker && currentLocker !== 'N/A');

    if (hasLocker && currentLocker === uiState.activeLocker) {
        lockerSuccessFeedback();
        showToast(`✅ កញ្ចប់នេះស្ថិតនៅ ${uiState.activeLocker} រួចហើយ`);
        safeFocusScanner();
        return;
    }

    if (hasLocker) {
        lockerErrorFeedback();
        uiState.pendingLockerCode = key;
        const phoneRaw = entry.item.phone ? sanitizePhoneNumber(entry.item.phone) : '';
        const who = phoneRaw ? ` (${phoneRaw})` : '';
        let msg = `កញ្ចប់ "${key}"${who} កំពុងស្ថិតនៅទីតាំង ${currentLocker} ។ តើអ្នកចង់ផ្លាស់ទីកញ្ចប់នេះទៅ ${uiState.activeLocker} មែនទេ?`;
        const occupant = findLockerOccupant(uiState.activeLocker, key, entry.itemId);
        if (occupant) {
            const occPhoneRaw = occupant.entry.item.phone ? sanitizePhoneNumber(occupant.entry.item.phone) : '';
            const occWho = occPhoneRaw ? ` (${occPhoneRaw})` : '';
            msg += ` (ចំណាំ៖ ទីតាំង ${uiState.activeLocker} មានកញ្ចប់ "${occupant.code}"${occWho} ស្ថិតនៅរួចហើយ)`;
        }
        const warnText = byId('locationWarningText');
        if (warnText) warnText.innerText = msg;
        openModalHelper('locationWarningModal');
        return;
    }

    assignLockerToEntry(key);
}

export function cancelLocationChange() {
    uiState.pendingLockerCode = null;
    closeModal('locationWarningModal');
    safeFocusScanner();
}

export function confirmLocationChange() {
    const code = uiState.pendingLockerCode;
    uiState.pendingLockerCode = null;
    closeModal('locationWarningModal');
    if (code) assignLockerToEntry(code);
}

export async function assignLockerToEntry(code) {
    const key = lockerCodeKey(code);
    const entry = uiState.lockerBarcodeIndex[key];
    if (!entry) {
        lockerErrorFeedback();
        showToast(`❌ Barcode "${key}" លែងមានក្នុងប្រព័ន្ធទៀតហើយ! សូមស្កេនម្តងទៀត`);
        return;
    }
    const targetLocker = uiState.activeLocker;
    if (!isValidLockerName(targetLocker)) {
        lockerErrorFeedback();
        showToast('⚠️ សូមជ្រើសរើសទីតាំង Locker ពិតប្រាកដសិន។');
        openLockerPicker();
        return;
    }
    if (!firebaseState.db || !firebaseState.fb) {
        lockerErrorFeedback();
        showToast('⚠️ មិនទាន់ភ្ជាប់ Firebase ទេ! សូមសាកល្បងម្តងទៀត។');
        return;
    }
    const itemId = entry.itemId;
    if (!/^[a-zA-Z0-9_-]+$/.test(String(itemId || ''))) {
        lockerErrorFeedback();
        showToast('⚠️ លេខសម្គាល់កញ្ចប់មិនត្រឹមត្រូវទេ!');
        return;
    }

    const ts = getServerNow();
    const updatedBy = (firebaseState.auth && firebaseState.auth.currentUser && (firebaseState.auth.currentUser.email || firebaseState.auth.currentUser.uid)) || '';
    const previousLocker = getEntryCurrentLocker(entry);
    const phoneRaw = entry.item.phone ? sanitizePhoneNumber(entry.item.phone) : '';
    const who = phoneRaw ? ` (${phoneRaw})` : '';
    const successMsg = (previousLocker && previousLocker !== 'N/A' && previousLocker !== targetLocker)
        ? `✅ ផ្លាស់ទីកញ្ចប់${who} ពី ${previousLocker} ➜ ${targetLocker}`
        : `✅ បានកំណត់ទីតាំង ${targetLocker}${who}`;

    const myGeneration = ++uiState.lockerAssignGeneration;
    let applied = false;
    let reported = false;

    const applyLockerTo = (item) => {
        const entries = barcodeEntriesOf(item.barcodes).filter((e) => e.barcode && typeof e.barcode === 'object');
        if (entries.length) {
            const match = entries.find((e) => lockerCodeKey(e.barcode.code) === key);
            if (!match) return item;
            normalizeBarcodesOf(item);
            const target = item.barcodes.find((b) => lockerCodeKey(b.code) === key);
            if (!target) return item;
            target.locker = targetLocker;
            target.lockerUpdatedAt = ts;
            if (updatedBy) target.lockerUpdatedBy = updatedBy;
            applied = true;
            return item;
        }
        if (lockerCodeKey(item.barcode) !== key) return item;
        item.locker = targetLocker;
        item.lockerUpdatedAt = ts;
        if (updatedBy) item.lockerUpdatedBy = updatedBy;
        applied = true;
        return item;
    };

    const patchLocalEntry = () => {
        const liveEntry = uiState.lockerBarcodeIndex[key];
        if (!liveEntry || liveEntry.itemId !== itemId) return;
        if (liveEntry.barcodeIdx !== null) {
            const barcode = Array.isArray(liveEntry.item.barcodes) ? liveEntry.item.barcodes[liveEntry.barcodeIdx] : null;
            if (!barcode) return;
            barcode.locker = targetLocker;
            barcode.lockerUpdatedAt = ts;
            if (updatedBy) barcode.lockerUpdatedBy = updatedBy;
            return;
        }
        liveEntry.item.locker = targetLocker;
        liveEntry.item.lockerUpdatedAt = ts;
        if (updatedBy) liveEntry.item.lockerUpdatedBy = updatedBy;
    };

    const reportResult = (result, late) => {
        if (reported) return;
        reported = true;
        if (!result || !result.committed || !applied) {
            lockerErrorFeedback();
            showToast('⚠️ កញ្ចប់នេះបានផ្លាស់ប្តូរពីឧបករណ៍ផ្សេងរួចហើយ។ សូមស្កេនម្តងទៀត។');
            return;
        }
        patchLocalEntry();
        renderLockerList();
        refreshCurrentHistoryView();
        if (myGeneration === uiState.lockerAssignGeneration) lockerSuccessFeedback();
        showToast(late ? `✅ ទីតាំង ${targetLocker} បានចុះយឺត ប៉ុន្តែជោគជ័យ! មិនបាច់ស្កេនម្តងទៀតទេ។` : successMsg);
        safeFocusScanner();
    };

    const reportFailure = (err) => {
        if (reported) return;
        reported = true;
        console.error('Locker assignment failed: ', err);
        if (window.ZoeErrors) ZoeErrors.capture(err, { zone: 'data', context: 'assignLockerToEntry' });
        lockerErrorFeedback();
        showToast('❌ មានបញ្ហា! មិនអាចរក្សាទុកទីតាំងបានទេ សូមព្យាយាមម្តងទៀត');
    };

    const writePromise = firebaseState.fb.runTransaction(firebaseState.fb.ref(firebaseState.db, `zoew_scan_history_cod_dod/${itemId}`), (currentItem) => {
        applied = false;
        if (!currentItem || typeof currentItem !== 'object') return currentItem;
        if (currentItem.clearClaim) return currentItem;
        return applyLockerTo({ ...currentItem });
    });

    try {
        const result = await withTimeout(writePromise, 12000, 'Save timed out');
        reportResult(result, false);
    } catch (err) {
        if (err && err.message === 'Save timed out') {
            writePromise.then((result) => reportResult(result, true), reportFailure);
            showToast('⏳ កំពុងរក្សាទុកទីតាំង… សូមកុំស្កេន Barcode នេះម្ដងទៀត។');
            return;
        }
        reportFailure(err);
    }
}
