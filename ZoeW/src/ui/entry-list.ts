import { fieldValue } from '../app/refs';
import { viewState } from '../core/view-state';
import { dataState, uiState } from '../core/state';
import { getServerNow } from '../core/clock';
import { sanitizePhoneNumber } from '../core/text';
import { getFormattedDate } from '../core/timezone';
import { parseTimestampFromId, sanitizeInput } from '../domain/barcode';
import { ENTRY_LIST_MAX_ROWS, LOCKER_LIST_MAX_ROWS, buildLockerBarcodeIndex } from '../features/locker';
import { normalizePhoneDigits } from '../features/phone-suggest';

export function entryPageIsVisible() {
    return uiState.currentAppPage === 'entry';
}

export function refreshEntryPagePanels() {
    if (uiState.currentAppPage !== 'entry' || !entryPageIsVisible()) return;
    if (uiState.entryScanMode === 'locker') {
        buildLockerBarcodeIndex();
        renderLockerList();
        return;
    }
    renderEntryList();
}

export function renderEntryList() {
    const search = fieldValue('entryListSearchInput').trim().toLowerCase();
    const searchDigits = normalizePhoneDigits(search);
    const todayStr = getFormattedDate(new Date(getServerNow()));

    let rows = dataState.scanHistory.filter((it) => it && it.scanDate === todayStr);
    if (search) {
        rows = rows.filter((it) => {
            const phone = sanitizePhoneNumber(it.phone || '');
            if (searchDigits && normalizePhoneDigits(phone).indexOf(searchDigits) !== -1) return true;
            const codes = Array.isArray(it.barcodes) && it.barcodes.length
                ? it.barcodes.map((b) => String((b && b.code) || ''))
                : [String(it.barcode || '')];
            return codes.some((c) => c.toLowerCase().includes(search));
        });
    }
    rows = rows.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    viewState.entryListCountText = String(rows.length);

    if (!rows.length) {
        uiState.entryListView = [];
        uiState.touch();
        viewState.entryListEmpty = true;
        return;
    }
    viewState.entryListEmpty = false;

    // ➜ `EntryListTableBody` (React) គូរជួរដេក
    uiState.entryListView = rows.slice(0, ENTRY_LIST_MAX_ROWS).map((it, i) => {
        const codes = Array.isArray(it.barcodes) && it.barcodes.length
            ? it.barcodes.map((b) => String((b && b.code) || ''))
            : [String(it.barcode || '')];
        const shown = codes.filter(Boolean);
        const total = Math.round(((parseFloat(it.cod) || 0) + (parseFloat(it.dod) || 0)) * 100) / 100;
        return {
            n: i + 1,
            phone: sanitizePhoneNumber(it.phone || ''),
            time: it.time || '',
            codeText: shown.length > 1 ? shown[0] + ' +' + (shown.length - 1) : (shown[0] || '-'),
            total: total.toFixed(2)
        };
    });
    uiState.touch();
}

export function getItemLockerSummary(item) {
    const lockers = [];
    if (Array.isArray(item.barcodes) && item.barcodes.length) {
        item.barcodes.forEach((b) => {
            if (b && b.locker && b.locker !== 'N/A' && lockers.indexOf(b.locker) === -1) lockers.push(b.locker);
        });
    } else if (item.locker && item.locker !== 'N/A') {
        lockers.push(item.locker);
    }
    return lockers;
}

export function getItemLatestLockerTs(item) {
    let ts = 0;
    if (Array.isArray(item.barcodes)) item.barcodes.forEach((b) => { if (b && b.lockerUpdatedAt) ts = Math.max(ts, parseFloat(b.lockerUpdatedAt) || 0); });
    if (item.lockerUpdatedAt) ts = Math.max(ts, parseFloat(item.lockerUpdatedAt) || 0);
    if (ts) return ts;
    const created = parseFloat(item.createdAt);
    if (isFinite(created)) return created;
    return parseTimestampFromId(item.id) || 0;
}

export function renderLockerList() {
    const search = fieldValue('lockerListSearchInput').trim().toLowerCase();

    const allLockers = new Set();
    let assigned = [];
    dataState.scanHistory.forEach((it) => {
        if (!it) return;
        const lockers = getItemLockerSummary(it);
        if (!lockers.length) return;
        lockers.forEach((l) => allLockers.add(l));
        assigned.push({ item: it, lockers: lockers, ts: getItemLatestLockerTs(it) });
    });

    // ➜ `LockerListFilterSelect` (React) គូរជម្រើស។ ⛔ តម្លៃដែលជ្រើស
    //   រស់ក្នុងឃ្លាំង ➜ ការអាន `select.value` (ដែលអាចមកមុនការគូរ) បាត់ទៅ។
    const options = Array.from(allLockers).map(String).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    uiState.lockerFilterOptions = options;
    // ⛔ ទីតាំងដែលលែងមាន ➜ តម្រងត្រូវរលត់ (ដូច browser ធ្វើពេល option បាត់)
    if (uiState.lockerFilterValue && options.indexOf(uiState.lockerFilterValue) === -1) uiState.lockerFilterValue = '';
    const lockerFilter = uiState.lockerFilterValue;

    const searchDigits = normalizePhoneDigits(search);
    if (search) {
        assigned = assigned.filter((row) => {
            const phone = sanitizePhoneNumber(row.item.phone || '');
            if (!searchDigits) return phone.toLowerCase().includes(search);
            return normalizePhoneDigits(phone).indexOf(searchDigits) !== -1;
        });
    }
    if (lockerFilter) assigned = assigned.filter((row) => row.lockers.indexOf(lockerFilter) !== -1);

    assigned.sort((a, b) => b.ts - a.ts);

    if (!assigned.length) {
        uiState.lockerListView = { rows: [], overflow: 0 };
        uiState.touch();
        viewState.lockerListEmpty = true;
        return;
    }
    viewState.lockerListEmpty = false;

    uiState.lockerListView = {
        rows: assigned.slice(0, LOCKER_LIST_MAX_ROWS).map((row, i) => ({
            n: i + 1,
            phone: sanitizePhoneNumber(row.item.phone || ''),
            lockerText: row.lockers.length > 1
                ? row.lockers.join(', ') + ' (' + row.lockers.length + ' កន្លែង)'
                : (row.lockers[0] || '')
        })),
        overflow: Math.max(0, assigned.length - LOCKER_LIST_MAX_ROWS)
    };
    uiState.touch();
}
