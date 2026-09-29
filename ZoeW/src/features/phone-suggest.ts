import { positionPhoneSuggestBox, scrollPhoneSuggestRowIntoView } from '../app/behaviors/phone-search';
import { fieldValue, isFieldFocused, setFieldValue } from '../app/refs';
import { dataState, uiState } from '../core/state';
import { sanitizePhoneNumber } from '../core/text';
import { parseTimestampFromId } from '../domain/barcode';
import { decodeBarcodeFromImageDataUrl } from '../domain/registry';
import { updateDailyScheduleStats } from './daily-stats';
import { applyCurrentFilter } from './monthly-report';
import { renderHistory } from '../ui/history-render';
import { showToast } from '../ui/toast';

export const PHONE_SUGGEST_MAX = 12;

export const RECENT_PHONES_MAX = 300;

export function normalizePhoneDigits(value) {
    return String(value === null || value === undefined ? '' : value).replace(/[^0-9]/g, '');
}

export function collectPhoneSuggestions(rawQuery, limit?) {
    const queryDigits = normalizePhoneDigits(rawQuery);
    const byPhone = new Map();
    dataState.scanHistory.forEach((item) => {
        if (!item || !item.phone || item.phone === "គ្មានលេខ") return;
        const digits = normalizePhoneDigits(item.phone);
        if (!digits) return;
        if (queryDigits && digits.indexOf(queryDigits) === -1) return;
        const stamp = item.createdAt || parseTimestampFromId(item.id) || 0;
        const packages = (item.barcodes && item.barcodes.length) ? item.barcodes.length : 1;
        const found = byPhone.get(item.phone);
        if (found) {
            found.packages += packages;
            if (stamp > found.stamp) found.stamp = stamp;
        } else {
            byPhone.set(item.phone, { phone: item.phone, digits: digits, packages: packages, stamp: stamp });
        }
    });
    const rankOf = (digits) => {
        if (!queryDigits) return 1;
        if (digits.endsWith(queryDigits)) return 0;
        if (digits.startsWith(queryDigits)) return 1;
        return 2;
    };
    return Array.from(byPhone.values()).sort((a, b) => {
        const rankA = rankOf(a.digits);
        const rankB = rankOf(b.digits);
        if (rankA !== rankB) return rankA - rankB;
        return b.stamp - a.stamp;
    }).slice(0, limit || PHONE_SUGGEST_MAX);
}

export function renderPhoneSuggestions(matches) {
    uiState.phoneSuggestItems = matches;
    uiState.phoneSuggestActiveIndex = -1;
    uiState.touch();
}

export function showPhoneSuggestions() {
    if (uiState.phoneSuggestHideTimer) { clearTimeout(uiState.phoneSuggestHideTimer); uiState.phoneSuggestHideTimer = null; }
    if (!isFieldFocused('searchPhoneInput')) return;
    const matches = collectPhoneSuggestions(fieldValue('searchPhoneInput'));
    if (!matches.length) {
        hidePhoneSuggestions();
        return;
    }
    renderPhoneSuggestions(matches);
    uiState.phoneSuggestOpen = true;
    positionPhoneSuggestBox();
}

export function hidePhoneSuggestions() {
    if (uiState.phoneSuggestHideTimer) { clearTimeout(uiState.phoneSuggestHideTimer); uiState.phoneSuggestHideTimer = null; }
    uiState.phoneSuggestItems = [];
    uiState.phoneSuggestActiveIndex = -1;
    uiState.phoneSuggestOpen = false;
}

export function setPhoneSuggestActive(index) {
    const count = uiState.phoneSuggestItems.length;
    if (!count) return;
    let target = index;
    if (target < 0) target = count - 1;
    if (target >= count) target = 0;
    uiState.phoneSuggestActiveIndex = target;
    scrollPhoneSuggestRowIntoView(target);
}

export function applyPhoneSuggestion(phone) {
    setFieldValue('searchPhoneInput', phone);
    hidePhoneSuggestions();
    searchByPhone();
}

export function searchByPhone() {
    let phoneQuery = sanitizePhoneNumber(fieldValue('searchPhoneInput'));
    if (!phoneQuery) {
        applyCurrentFilter();
        return;
    }
    const queryDigits = normalizePhoneDigits(phoneQuery);
    let searched = dataState.scanHistory.filter(item => {
        if (!item.phone) return false;
        if (!queryDigits) return item.phone.includes(phoneQuery);
        return normalizePhoneDigits(item.phone).indexOf(queryDigits) !== -1;
    });
    renderHistory(searched, 'search|' + (queryDigits || phoneQuery));
    updateDailyScheduleStats(searched, true);
}

export function decodeImageFile(e?) {
    if (!e.target.files || e.target.files.length === 0) return;
    const f = e.target.files[0];
    setFieldValue('fileInput', '');
    const reader = new FileReader();
    reader.onload = function(evt) {
        decodeBarcodeFromImageDataUrl(evt.target.result);
    };
    reader.onerror = function() {
        showToast("❌ មិនអាចអានរូបភាពនេះបានទេ។ សូមសាកល្បងរូបភាពផ្សេង។");
    };
    reader.readAsDataURL(f);
}
