import { uiState } from '../../core/state';
import { applyPhoneSuggestion, hidePhoneSuggestions, searchByPhone, setPhoneSuggestActive, showPhoneSuggestions } from '../../features/phone-suggest';
import { showAppChrome } from '../../ui/chrome-autohide';
import { commitNow } from '../flush';
import { elementOf, fieldValue, scrollChildIntoView } from '../refs';
import { syncHistoryExpandedLock } from './panels';

export function scrollPhoneSuggestRowIntoView(index) {
    scrollChildIntoView('phoneSuggestBox', index);
}

export function cssPx(value) {
    return (Math.round(value * 1000) / 1000) + 'px';
}

export function positionPhoneSuggestBox() {
    commitNow();
    const phoneInput = elementOf('searchPhoneInput');
    const box = elementOf('phoneSuggestBox');
    if (!phoneInput || !box || !uiState.phoneSuggestOpen) return;
    const rect = phoneInput.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > window.innerHeight || (rect.width === 0 && rect.height === 0)) {
        hidePhoneSuggestions();
        return;
    }
    uiState.phoneSuggestWidth = cssPx(rect.width);
    uiState.phoneSuggestLeft = cssPx(rect.left);
    commitNow();
    const boxHeight = box.offsetHeight;
    const spaceBelow = window.innerHeight - rect.bottom;
    uiState.phoneSuggestTop = (spaceBelow < boxHeight + 12 && rect.top > boxHeight + 12) ?
        cssPx(rect.top - boxHeight - 4) : cssPx(rect.bottom + 4);
    commitNow();
}

export function setPhoneSearchPulledUp(on) {
    const sidebar = elementOf('dataSideSection');
    if (!sidebar) return;
    if (on && window.innerWidth >= 992) return;
    const already = uiState.dataPanelSearchFocus;
    if (already === !!on) return;
    uiState.dataPanelSearchFocus = !!on;
    if (on) { showAppChrome(); uiState.dataPanelCollapsed = false; }
    syncHistoryExpandedLock();
    positionPhoneSuggestBox();
    setTimeout(positionPhoneSuggestBox, 180);
    setTimeout(positionPhoneSuggestBox, 340);
}

export function phoneSearchFocused() {
    setPhoneSearchPulledUp(true);
    showPhoneSuggestions();
}

export function phoneSearchBlurred() {
    if (uiState.phoneSuggestHideTimer) clearTimeout(uiState.phoneSuggestHideTimer);
    uiState.phoneSuggestHideTimer = setTimeout(() => {
        hidePhoneSuggestions();
        if (!fieldValue('searchPhoneInput').trim()) setPhoneSearchPulledUp(false);
    }, 150);
}

export function phoneSearchKeyDown(e: { key: string; preventDefault(): void }) {
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
}

export function pickPhoneSuggestion(index: number) {
    if (isNaN(index) || !uiState.phoneSuggestItems[index]) return;
    applyPhoneSuggestion(uiState.phoneSuggestItems[index].phone);
}

export function setupPhoneSuggestions() {
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
