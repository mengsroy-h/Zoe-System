import { byId } from '../core/dom';
import { dataState, uiState } from '../core/state';
import { sanitizePhoneNumber } from '../core/text';
import { parseTimestampFromId } from '../domain/barcode';
import { decodeBarcodeFromImageDataUrl } from '../domain/registry';
import { updateDailyScheduleStats } from './daily-stats';
import { applyCurrentFilter } from './monthly-report';
import { showAppChrome } from '../ui/chrome-autohide';
import { renderHistory } from '../ui/history-render';
import { syncHistoryExpandedLock } from '../ui/page-nav';
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
    // ➜ `PhoneSuggestList` (React) គូរ។ ស្ថានភាពសកម្មនៅជា index ក្នុងឃ្លាំង
    //   ➜ `setPhoneSuggestActive()` នៅដើរដដែល។
    uiState.phoneSuggestItems = matches;
    uiState.phoneSuggestActiveIndex = -1;
    uiState.touch();
}

export function cssPx(value) {
    return (Math.round(value * 1000) / 1000) + 'px';
}

export function positionPhoneSuggestBox() {
    const phoneInput = byId('searchPhoneInput');
    const box = byId('phoneSuggestBox');
    if (!phoneInput || !box || !box.classList.contains('show')) return;
    const rect = phoneInput.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > window.innerHeight || (rect.width === 0 && rect.height === 0)) {
        hidePhoneSuggestions();
        return;
    }
    const width = cssPx(rect.width);
    if (box.style.width !== width) box.style.width = width;
    const left = cssPx(rect.left);
    if (box.style.left !== left) box.style.left = left;
    const boxHeight = box.offsetHeight;
    const spaceBelow = window.innerHeight - rect.bottom;
    const top = (spaceBelow < boxHeight + 12 && rect.top > boxHeight + 12) ?
        cssPx(rect.top - boxHeight - 4) : cssPx(rect.bottom + 4);
    if (box.style.top !== top) box.style.top = top;
}

export function showPhoneSuggestions() {
    const phoneInput = byId('searchPhoneInput');
    const box = byId('phoneSuggestBox');
    if (!phoneInput || !box) return;
    if (uiState.phoneSuggestHideTimer) { clearTimeout(uiState.phoneSuggestHideTimer); uiState.phoneSuggestHideTimer = null; }
    if (document.activeElement !== phoneInput) return;
    const matches = collectPhoneSuggestions(phoneInput.value);
    if (!matches.length) {
        hidePhoneSuggestions();
        return;
    }
    renderPhoneSuggestions(matches);
    box.classList.add('show');
    positionPhoneSuggestBox();
}

export function hidePhoneSuggestions() {
    if (uiState.phoneSuggestHideTimer) { clearTimeout(uiState.phoneSuggestHideTimer); uiState.phoneSuggestHideTimer = null; }
    uiState.phoneSuggestItems = [];
    uiState.phoneSuggestActiveIndex = -1;
    const box = byId('phoneSuggestBox');
    if (!box) return;
    box.classList.remove('show');
}

export function setPhoneSuggestActive(index) {
    const box = byId('phoneSuggestBox');
    if (!box) return;
    const rows = box.querySelectorAll('.phone-suggest-item');
    if (!rows.length) return;
    let target = index;
    if (target < 0) target = rows.length - 1;
    if (target >= rows.length) target = 0;
    uiState.phoneSuggestActiveIndex = target;
    rows.forEach((row, i) => {
        if (i === target) row.classList.add('active');
        else row.classList.remove('active');
    });
    rows[target].scrollIntoView({ block: 'nearest' });
}

export function applyPhoneSuggestion(phone) {
    const phoneInput = byId('searchPhoneInput');
    if (!phoneInput) return;
    phoneInput.value = phone;
    hidePhoneSuggestions();
    searchByPhone();
}

export function setPhoneSearchPulledUp(on) {
    const sidebar = byId('dataSideSection');
    if (!sidebar) return;
    if (on && window.innerWidth >= 992) return;
    const already = sidebar.classList.contains('search-focus');
    if (already === !!on) return;
    sidebar.classList.toggle('search-focus', !!on);
    if (on) { showAppChrome(); sidebar.classList.remove('collapsed'); }
    syncHistoryExpandedLock();
    positionPhoneSuggestBox();
    setTimeout(positionPhoneSuggestBox, 180);
    setTimeout(positionPhoneSuggestBox, 340);
}

export function setupPhoneSuggestions() {
    const phoneInput = byId('searchPhoneInput');
    const box = byId('phoneSuggestBox');
    if (!phoneInput || !box) return;
    phoneInput.addEventListener('input', showPhoneSuggestions);
    phoneInput.addEventListener('focus', () => {
        setPhoneSearchPulledUp(true);
        showPhoneSuggestions();
    });
    phoneInput.addEventListener('blur', () => {
        if (uiState.phoneSuggestHideTimer) clearTimeout(uiState.phoneSuggestHideTimer);
        uiState.phoneSuggestHideTimer = setTimeout(() => {
            hidePhoneSuggestions();
            if (!phoneInput.value.trim()) setPhoneSearchPulledUp(false);
        }, 150);
    });
    phoneInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            hidePhoneSuggestions();
            return;
        }
        if (e.key === 'Enter') {
            if (uiState.phoneSuggestActiveIndex >= 0 && uiState.phoneSuggestItems[uiState.phoneSuggestActiveIndex]) {
                e.preventDefault();
                applyPhoneSuggestion(uiState.phoneSuggestItems[uiState.phoneSuggestActiveIndex].phone);
            } else {
                hidePhoneSuggestions();
                searchByPhone();
            }
            return;
        }
        if (!uiState.phoneSuggestItems.length) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setPhoneSuggestActive(uiState.phoneSuggestActiveIndex + 1);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setPhoneSuggestActive(uiState.phoneSuggestActiveIndex - 1);
        }
    });
    box.addEventListener('mousedown', (e) => { e.preventDefault(); });
    box.addEventListener('click', (e) => {
        const row = e.target && e.target.closest ? e.target.closest('.phone-suggest-item') : null;
        if (!row) return;
        const index = parseInt(row.getAttribute('data-index'), 10);
        if (isNaN(index) || !uiState.phoneSuggestItems[index]) return;
        applyPhoneSuggestion(uiState.phoneSuggestItems[index].phone);
    });
    let positionFrame = null;
    const schedulePositionPhoneSuggestBox = () => {
        if (positionFrame !== null) return;
        positionFrame = requestAnimationFrame(() => {
            positionFrame = null;
            positionPhoneSuggestBox();
        });
    };
    window.addEventListener('scroll', schedulePositionPhoneSuggestBox, { capture: true, passive: true });
    window.addEventListener('resize', schedulePositionPhoneSuggestBox);
}

export function searchByPhone() {
    const phoneInput = byId('searchPhoneInput');
    let phoneQuery = sanitizePhoneNumber(phoneInput ? phoneInput.value : '');
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
    renderHistory(searched);
    updateDailyScheduleStats(searched, true);
}

export function decodeImageFile(e?) {
    if (!e.target.files || e.target.files.length === 0) return;
    const f = e.target.files[0];
    e.target.value = '';
    const reader = new FileReader();
    reader.onload = function(evt) {
        decodeBarcodeFromImageDataUrl(evt.target.result);
    };
    reader.onerror = function() {
        showToast("❌ មិនអាចអានរូបភាពនេះបានទេ។ សូមសាកល្បងរូបភាពផ្សេង។");
    };
    reader.readAsDataURL(f);
}
