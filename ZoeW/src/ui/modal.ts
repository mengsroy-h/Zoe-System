import { videoElement } from '../app/refs';
import { modalIsOpen, openModalIds, setModalDisplay } from '../core/modals';
import { scanState, uiState } from '../core/state';
import { safeFocusScanner } from '../core/timezone';
import { clearLookupStatus } from '../features/auto-lookup';
import { stopCurrentStream } from '../features/daily-stats';
import { hidePhoneSuggestions } from '../features/phone-suggest';
import { showAppChrome } from './chrome-autohide';

export function openModalHelper(modalId) {
    uiState.isModalOpen = true;
    showAppChrome();
    hidePhoneSuggestions();
    setModalDisplay(modalId, 'flex');
}

export function resumeScanVideo() {
    if (!scanState.currentStream || !scanState.isCameraScanning) return;
    const video = videoElement('video');
    if (!video) return;
    try {
        const playing = video.play();
        if (playing && typeof playing.catch === 'function') playing.catch(() => {});
    } catch (e) {}
}

export function onScanVideoPause() {
    if (!scanState.currentStream || !scanState.isCameraScanning) return;
    if (scanState.scanVideoResumeTimer) return;
    scanState.scanVideoResumeTimer = setTimeout(() => {
        scanState.scanVideoResumeTimer = null;
        const video = videoElement('video');
        if (!video || !video.paused) return;
        resumeScanVideo();
    }, 150);
}

export function closeModal(modalId?) {
    setModalDisplay(modalId, 'none');
    if (modalId === 'phoneModal') clearLookupStatus();
    uiState.isModalOpen = openModalIds().length > 0;
    if (modalId === 'phoneModal' || !uiState.isModalOpen) scanState.pendingBarcode = "";
    if (modalId === 'editPhoneModal' || !uiState.isModalOpen) uiState.editingItemId = null;
    if (modalId === 'callMarkModal' || !uiState.isModalOpen) uiState.markingItemId = null;
    if (!uiState.isModalOpen) {
        safeFocusScanner();
        resumeScanVideo();
    }
}

export function dismissPhoneModal() {
    if (uiState.phoneModalDismissPromptOpen) return;
    if (!modalIsOpen('phoneModal')) return;
    uiState.phoneModalDismissPromptOpen = true;
    setTimeout(() => { uiState.phoneModalDismissPromptOpen = false; }, 0);
    const confirmed = confirm("តើអ្នកពិតជាចង់បោះបង់កញ្ចប់នេះមែនទេ? ព័ត៌មានដែលបានវាយបញ្ចូល (លេខទូរស័ព្ទ, Locker, COD, DOD) នឹងបាត់ ហើយកញ្ចប់នេះនឹងមិនត្រូវបានរក្សាទុកទេ។");
    resumeScanVideo();
    if (!confirmed) return;
    closeModal('phoneModal');
}

export function cleanupResources() {
    stopCurrentStream();
    if (scanState.codeReader && typeof scanState.codeReader.reset === 'function') {
        try {
            scanState.codeReader.reset();
        } catch(e) {}
    }
    if (uiState.globalAudioCtx && uiState.globalAudioCtx.state !== 'closed') {
        try {
            uiState.globalAudioCtx.close();
        } catch(e) {}
        uiState.globalAudioCtx = null;
    }
}
