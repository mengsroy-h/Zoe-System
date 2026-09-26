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

export function setModalDisplay(id: string | null | undefined, display: ModalDisplay): void {
    if (!id || !modalIsMounted(id)) return;
    if (uiState.modalDisplay[id] === display) return;
    uiState.modalDisplay = Object.assign({}, uiState.modalDisplay, { [id]: display });
}

export function modalIsOpen(id: string): boolean {
    return uiState.modalDisplay[id] === 'flex';
}

export function openModalIds(): ModalId[] {
    return MODAL_IDS.filter((id) => modalIsOpen(id));
}
