import { dismissModal, topmostModal } from '../../ui/modal-stack';
import { closeGlobalMoreMenu } from '../../ui/more-menu';
import { closeSideDrawer, isSideDrawerOpen } from '../../ui/page-nav';

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
    if (options.includeMoreMenu) {
        const menu = document.getElementById('globalMoreMenu');
        if (menu && menu.classList.contains('show')) {
            closeGlobalMoreMenu();
            return true;
        }
    }
    const openModals = Array.from(document.querySelectorAll('.modal')).filter((m: any) => m.style.display === 'flex');
    const openModalEl = topmostModal(openModals);
    if (openModalEl) {
        dismissModal(openModalEl);
        return true;
    }
    if (isSideDrawerOpen()) {
        closeSideDrawer();
        return true;
    }
    return false;
}
