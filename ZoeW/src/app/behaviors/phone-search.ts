import { uiState } from '../../core/state';
import { applyPhoneSuggestion, hidePhoneSuggestions, searchByPhone, setPhoneSuggestActive, showPhoneSuggestions } from '../../features/phone-suggest';
import { showAppChrome } from '../../ui/chrome-autohide';
import { commitNow } from '../flush';
import { animateElement, elementOf, fieldValue, isFieldFocused, scrollChildIntoView } from '../refs';
import { PANEL_SEARCH_GLIDE, panelGlideFrom, panelMotionAllowed, type PanelGlide } from './panel-motion';
import { syncHistoryExpandedLock } from './panels';

export function scrollPhoneSuggestRowIntoView(index) {
    scrollChildIntoView('phoneSuggestBox', index);
}

export function cssPx(value) {
    return (Math.round(value * 1000) / 1000) + 'px';
}

export const PHONE_SUGGEST_DROP_MS = 180;

export const PHONE_SUGGEST_DROP_EASING = 'cubic-bezier(0.2, 0, 0, 1)';

let phoneSearchGlide: PanelGlide | null = null;

export function phoneSearchGlideRunning() {
    return !!(phoneSearchGlide && phoneSearchGlide.running());
}

export function dropPhoneSuggestBox() {
    if (!uiState.phoneSuggestOpen || !panelMotionAllowed()) return;
    animateElement(elementOf('phoneSuggestBox'), [
        { opacity: 0, transform: 'translate3d(0,-10px,0)' },
        { opacity: 1, transform: 'translate3d(0,0,0)' }
    ], { duration: PHONE_SUGGEST_DROP_MS, easing: PHONE_SUGGEST_DROP_EASING });
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

export function glidePhoneSearchPulledUp(on) {
    if (uiState.dataPanelSearchFocus === !!on) return;
    commitNow();
    const card = elementOf('dataSearchCard');
    const main = elementOf('dataMainSection');
    const cardTop = card ? card.getBoundingClientRect().top : NaN;
    const mainTop = main ? main.getBoundingClientRect().top : NaN;
    setPhoneSearchPulledUp(on);
    commitNow();
    const glide = panelGlideFrom(card, cardTop, PANEL_SEARCH_GLIDE);
    phoneSearchGlide = glide;
    panelGlideFrom(main, mainTop, PANEL_SEARCH_GLIDE);
    if (!on || !glide) return;
    hidePhoneSuggestions();
    glide.settled().then((done) => {
        if (!done || phoneSearchGlide !== glide || !isFieldFocused('searchPhoneInput')) return;
        showPhoneSuggestions();
        dropPhoneSuggestBox();
    });
}

export function phoneSearchFocused() {
    glidePhoneSearchPulledUp(true);
    showPhoneSuggestions();
}

export function phoneSearchBlurred() {
    if (uiState.phoneSuggestHideTimer) clearTimeout(uiState.phoneSuggestHideTimer);
    uiState.phoneSuggestHideTimer = setTimeout(() => {
        hidePhoneSuggestions();
        if (!fieldValue('searchPhoneInput').trim()) glidePhoneSearchPulledUp(false);
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
