import { uiState } from './state';

export type ModalDisplay = 'flex' | 'none';

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

export const BACKDROP_KEEP_MODALS: readonly ModalId[] = ['configModal', 'lookupApiConfigModal', 'sheetImportModal'];

export const ROOT_SCREEN_MODALS: readonly string[] = ['loginModal', 'activationModal'];

export interface ModalMeta {
    close?: string;
    noDismiss?: boolean;
}

const meta = new Map<string, ModalMeta>();

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

export const MODAL_BASE_Z = 1000;

export function noteModalStack(id: string, open: boolean): void {
    const stack = uiState.modalStack;
    if (open) {
        if (stack[stack.length - 1] !== id) uiState.modalStack = stack.filter((m) => m !== id).concat(id);
    } else if (stack.includes(id)) {
        uiState.modalStack = stack.filter((m) => m !== id);
    }
}

export function modalStackZ(state: { modalStack: string[]; modalDisplay: Record<string, string> }, id: string): number | null {
    const open = state.modalStack.filter((m) => state.modalDisplay[m] === 'flex');
    if (open.length < 2) return null;
    const rank = open.indexOf(id);
    return rank < 0 ? null : MODAL_BASE_Z + 1 + rank;
}

export function setModalDisplay(id: string | null | undefined, display: ModalDisplay): void {
    if (!id || !modalIsMounted(id)) return;
    noteModalStack(id, display === 'flex');
    if (uiState.modalDisplay[id] === display) return;
    uiState.modalDisplay = Object.assign({}, uiState.modalDisplay, { [id]: display });
}

export function modalIsOpen(id: string): boolean {
    return uiState.modalDisplay[id] === 'flex';
}

export function openModalIds(): ModalId[] {
    return MODAL_IDS.filter((id) => modalIsOpen(id));
}
