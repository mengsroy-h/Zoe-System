import { modalMeta, openModalIds } from '../../core/modals';
import { uiState } from '../../core/state';
import { dismissModal } from '../../ui/modal-stack';
import { closeGlobalMoreMenu } from '../../ui/more-menu';
import { closeSideDrawer, isSideDrawerOpen } from '../../ui/page-nav';
import { modalElement } from '../components/modals/Modal';
import { elementOf } from '../refs';

/**
 * ប្រអប់ខាងលើគេក្នុងចំណោមប្រអប់ដែលបើក ៖ `z-index` **ដែលគណនាពិត** ធំជាងគេ ·
 * ស្មើគ្នា ➜ ប្រអប់ក្រោយក្នុងឯកសារ (ដូចដើម ៖ `forEach` លើ NodeList តាមលំដាប់ឯកសារ)។
 */
export function topmostModal(): string | null {
    let top: string | null = null;
    let topZ = -Infinity;
    openModalIds().forEach((id) => {
        const el = modalElement(id);
        if (!el) return;
        const parsed = parseInt(window.getComputedStyle(el).zIndex, 10);
        const z = isNaN(parsed) ? 0 : parsed;
        if (z >= topZ) { topZ = z; top = id; }
    });
    return top;
}

/**
 * «ស្រទាប់» ដែលអាចបិទបានតាមលំដាប់ពីលើចុះក្រោម ៖ ម៉ឺនុយ (...) ➜ ប្រអប់
 * ខាងលើគេ ➜ របា Slide។ **អ្នកសម្រេចតែមួយ** សម្រាប់ Escape (web) និងប៊ូតុង
 * Back របស់ Android (native) ➜ ច្បាប់ «បិទអ្វីមុន» មិនបែកជា ២។
 *
 * ⛔ ត្រឡប់ `true` ពេល **មានស្រទាប់បើក** ទោះវាមិនព្រមបិទ (`data-nodismiss`) ៖
 *    ប៊ូតុង Back មិនត្រូវរំលងប្រអប់នោះ ហើយធ្វើសកម្មភាពនៅពីក្រោយវា។
 * ⛔ Escape មិនបិទម៉ឺនុយ (...) ទេ (`includeMoreMenu: false`) — ឥរិយាបថ web ដើម។
 */
export function closeTopmostLayer(options: { includeMoreMenu: boolean }): boolean {
    if (options.includeMoreMenu && uiState.moreMenuOpen) {
        closeGlobalMoreMenu();
        return true;
    }
    const top = topmostModal();
    if (top) {
        dismissModal(top);
        return true;
    }
    if (isSideDrawerOpen()) {
        closeSideDrawer();
        return true;
    }
    return false;
}

/** ចុចលើផ្ទៃខ្មៅពីក្រោយប្រអប់ (គោលដៅ = ធាតុ `.modal` ខ្លួនឯង) ➜ បិទប្រអប់នោះ */
export function modalBackdropTarget(target: EventTarget | null): string | null {
    for (const id of openModalIds()) {
        if (modalElement(id) === target) return modalMeta(id) ? id : null;
    }
    return null;
}

/** ចុច/ចាប់ផ្តើមប៉ះខាងក្រៅម៉ឺនុយ (...) ➜ បិទវា (លើកលែងប៊ូតុង (...) ខ្លួនឯង) */
export function dismissGlobalMoreMenuOutside(e) {
    const target = e.target;
    if (target && target.closest) {
        const menu = elementOf('globalMoreMenu');
        if (menu && menu.contains(target)) return;
        if (e.type === 'click' && target.closest('.more-btn, .header-more-btn')) return;
    }
    closeGlobalMoreMenu();
}
