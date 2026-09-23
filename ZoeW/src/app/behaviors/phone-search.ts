import { uiState } from '../../core/state';
import { applyPhoneSuggestion, hidePhoneSuggestions, searchByPhone, setPhoneSuggestActive, showPhoneSuggestions } from '../../features/phone-suggest';
import { showAppChrome } from '../../ui/chrome-autohide';
import { commitNow } from '../flush';
import { elementOf } from '../refs';
import { syncHistoryExpandedLock } from './panels';

/**
 * ⛔ **តំបន់ហាមចូល** (`CLAUDE.md` ៖ «Auto pull up») — ប្រអប់ស្វែងរកទាញឡើង និង
 * ទីតាំងប្រអប់ណែនាំលេខ។ តក្កវិជ្ជាដូចដើមបេះបិទ ៖ `.search-focus` · `.show`
 * ជា state ដែលចុះ DOM ភ្លាម មុនការវាស់។ ទីតាំងប្រអប់ (`style.top/left/width`)
 * គណនាពីការវាស់រាល់ស៊ុម ➜ សរសេរតាម ref (React មិនគ្រប់គ្រង `style` របស់វា)។
 */

export function scrollPhoneSuggestRowIntoView(index) {
    commitNow();
    const box = elementOf('phoneSuggestBox');
    const row = box ? box.children[index] : null;
    if (row) row.scrollIntoView({ block: 'nearest' });
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

export function setupPhoneSuggestions() {
    const phoneInput = elementOf<HTMLInputElement>('searchPhoneInput');
    const box = elementOf('phoneSuggestBox');
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
        const target = e.target as any;
        const row = target && target.closest ? target.closest('.phone-suggest-item') : null;
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
