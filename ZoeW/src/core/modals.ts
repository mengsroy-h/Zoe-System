import { uiState } from './state';

/**
 * ស្ថានភាពប្រអប់ (modal) ជា **state** ➜ `<Modal>` គូរ `display` ពីវា។
 *
 * ⛔ តម្លៃ ៣ ដូច DOM របស់ App ដើមបេះបិទ ៖ គ្មានកូនសោ = មិនដែលបើក (CSS
 *    `.modal { display: none }`) · `'flex'` = បើក · `'none'` = បិទវិញ។
 * ⛔ ការបើក/បិទដែលមាន **ផលរំខាន** (focus ម៉ាស៊ីនស្កេន · សម្អាត barcode ·
 *    ចាក់សោការរមូរ) ឆ្លងកាត់ `openModalHelper()`/`closeModal()` ក្នុង
 *    `ui/modal.ts`។ `setModalDisplay()` ខាងក្រោមជាការប្តូរ **ត្រង់ៗ** ដូច
 *    `el.style.display = …` ដើម។
 */
export type ModalDisplay = 'flex' | 'none';

/** ប្រអប់ទាំងអស់ តាម **លំដាប់ក្នុងឯកសារ** (`AppShell`) — ប្រើពេលស្មើ z-index */
export const MODAL_IDS = [
    'pinModal',
    'pinSetupModal',
    'configModal',
    'configQrScanModal',
    'lookupApiConfigModal',
    'sheetImportModal',
    'exchangeRateModal',
    'loginModal',
    'manualAdjustModal',
    'phoneModal',
    'scanRemoveModal',
    'ztoSyncModal',
    'ztoListSyncModal',
    'editPhoneModal',
    'callMarkModal',
    'editBarcodePriceModal',
    'viewListModal',
    'dailyStatsModal',
    'collectedStatsModal',
    'customerDataTableModal',
    'recentlyDeletedModal',
    'restoreWarningModal',
    'logoutConfirmModal',
    'permanentDeleteWarningModal',
    'exportDataModal',
    'monthlyReportModal',
    'activationModal',
    'healthCheckModal',
    'lockerPickerModal',
    'lockerSettingsModal',
    'locationWarningModal',
] as const;

export type ModalId = (typeof MODAL_IDS)[number];

export interface ModalMeta {
    /** សកម្មភាពដែលរត់ពេលអ្នកប្រើបិទដោយចុចខាងក្រៅ · Escape · Back (`data-close`) */
    close?: string;
    /** មិនបិទពេលចុចខាងក្រៅ (`data-nodismiss`) */
    noDismiss?: boolean;
}

const meta = new Map<string, ModalMeta>();

/** `<Modal>` ចុះឈ្មោះ meta របស់ខ្លួនពេល mount */
export function registerModalMeta(id: string, value: ModalMeta): void {
    meta.set(id, value);
}

export function unregisterModalMeta(id: string): void {
    meta.delete(id);
}

export function modalMeta(id: string): ModalMeta | null {
    return meta.get(id) ?? null;
}

export function modalIsMounted(id: string): boolean {
    return meta.has(id);
}

export function modalDisplay(id: string): ModalDisplay | undefined {
    return uiState.modalDisplay[id];
}

export function setModalDisplay(id: string | null | undefined, display: ModalDisplay): void {
    if (!id || !modalIsMounted(id)) return;
    if (uiState.modalDisplay[id] === display) return;
    uiState.modalDisplay = Object.assign({}, uiState.modalDisplay, { [id]: display });
}

export function modalIsOpen(id: string): boolean {
    return uiState.modalDisplay[id] === 'flex';
}

/** ប្រអប់ដែលបើក តាមលំដាប់ក្នុងឯកសារ */
export function openModalIds(): ModalId[] {
    return MODAL_IDS.filter((id) => modalIsOpen(id));
}
