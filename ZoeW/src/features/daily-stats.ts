import { byId } from '../core/dom';
import { dataState, scanState, securityState, uiState } from '../core/state';
import { isMobileDevice } from '../core/timezone';
import { countPickedUpCustomers, getPickupPhoneKey } from '../domain/pickup';
import { closeConfigQrScanner } from './config-qr';
import { getFilterTargetDateKey } from './export';
import { triggerScanAction } from './scan-action';
import { resetLiveScanQuality, resetScanConfirm } from '../services/scan-engine';
import { onScanVideoPause } from '../ui/modal';

export function updateDailyScheduleStats(filteredList, isSearchScoped = false) {
    let selectedAllPackages = 0;
    let selectedClosedCount = 0;
    let selectedPackagesPickedUpCount = 0;
    let codTotal = 0;
    let dodTotal = 0;

    const targetDateKey = getFilterTargetDateKey();

    if (!isSearchScoped && targetDateKey && dataState.dailyRevenueData[targetDateKey]) {
        selectedAllPackages = parseFloat(dataState.dailyRevenueData[targetDateKey].totalCount) || 0;
    } else if (!isSearchScoped && uiState.currentFilterMode === 'all') {
        selectedAllPackages = Object.values(dataState.dailyRevenueData).reduce((sum, d) => sum + (parseFloat(d.totalCount) || 0), 0);
    } else {
        selectedAllPackages = filteredList.reduce((sum, item) => {
            if (item.barcodes && Array.isArray(item.barcodes)) {
                return sum + item.barcodes.length;
            }
            return sum + (parseFloat(item.count) || 1);
        }, 0);
    }

    if (!isSearchScoped && targetDateKey && dataState.dailyPickupData[targetDateKey]) {
        selectedClosedCount = countPickedUpCustomers(dataState.dailyPickupData[targetDateKey]);
        selectedPackagesPickedUpCount = parseFloat(dataState.dailyPickupData[targetDateKey].packagesPickedUp) || 0;
    } else if (!isSearchScoped && uiState.currentFilterMode === 'all') {
        selectedClosedCount = Object.values(dataState.dailyPickupData).reduce((sum, d) => sum + countPickedUpCustomers(d), 0);
        selectedPackagesPickedUpCount = Object.values(dataState.dailyPickupData).reduce((sum, d) => sum + (parseFloat(d.packagesPickedUp) || 0), 0);
    } else {
        selectedClosedCount = new Set(filteredList.filter(item => item.isClosed).map(item => getPickupPhoneKey(item))).size;
        selectedPackagesPickedUpCount = filteredList.reduce((sum, item) => {
            if (!item.isClosed) return sum;
            if (item.barcodes && Array.isArray(item.barcodes)) {
                return sum + item.barcodes.length;
            }
            return sum + (parseFloat(item.count) || 1);
        }, 0);
    }

    codTotal = filteredList.reduce((sum, item) => {
        if (item.barcodes && Array.isArray(item.barcodes)) {
            return sum + item.barcodes.filter(b => !b.isClosed).reduce((bSum, b) => bSum + (parseFloat(b.cod) || 0), 0);
        }
        return sum + (!item.isClosed ? (parseFloat(item.cod) || 0) : 0);
    }, 0);

    dodTotal = filteredList.reduce((sum, item) => {
        if (item.barcodes && Array.isArray(item.barcodes)) {
            return sum + item.barcodes.filter(b => !b.isClosed).reduce((bSum, b) => bSum + (parseFloat(b.dod) || 0), 0);
        }
        return sum + (!item.isClosed ? (parseFloat(item.dod) || 0) : 0);
    }, 0);

    codTotal = Math.round(codTotal * 100) / 100;
    dodTotal = Math.round(dodTotal * 100) / 100;

    let combinedTotalDollar = Math.round((codTotal + dodTotal) * 100) / 100;
    let codRiel = Math.round(codTotal * dataState.exchangeRateRiel);
    let dodRiel = Math.round(dodTotal * dataState.exchangeRateRiel);
    let totalRiel = Math.round(combinedTotalDollar * dataState.exchangeRateRiel);

    let filteredRemainingCount = filteredList.reduce((sum, item) => {
        if (item.barcodes && Array.isArray(item.barcodes)) {
            return sum + item.barcodes.filter(b => !b.isClosed).length;
        }
        return sum + (!item.isClosed ? (parseFloat(item.count) || 1) : 0);
    }, 0);

    const safeSetText = (id, text) => {
        const el = byId(id);
        if(el) el.innerText = text;
    };

    safeSetText('grandTotalCount', filteredRemainingCount);
    safeSetText('todayTotalCount', selectedAllPackages);
    safeSetText('todayClosedCount', selectedClosedCount);
    safeSetText('todayPackagesPickedUpCount', selectedPackagesPickedUpCount);

    safeSetText('summaryCodDollar', `$${codTotal.toFixed(2)}`);
    safeSetText('summaryCodRiel', `${codRiel.toLocaleString()} ៛`);
    safeSetText('summaryDodDollar', `$${dodTotal.toFixed(2)}`);
    safeSetText('summaryDodRiel', `${dodRiel.toLocaleString()} ៛`);
    safeSetText('summaryTotalDollar', `$${combinedTotalDollar.toFixed(2)}`);
    safeSetText('summaryTotalRiel', `${totalRiel.toLocaleString()} ៛`);
}

export function setupHardwareScanner() {
    const hwInput = byId('hwScannerInput');

    document.addEventListener('click', (e) => {
        const clickTarget = e.target as any;
        if (!uiState.isModalOpen && clickTarget.tagName !== 'INPUT' && clickTarget.tagName !== 'TEXTAREA' && clickTarget.tagName !== 'SELECT' && clickTarget.tagName !== 'BUTTON' && clickTarget.tagName !== 'A' && !isMobileDevice()) {
            if (hwInput) hwInput.focus();
        }
    });

    if (hwInput) {
        hwInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                submitManualBarcode();
            }
        });
    }
}

export function submitManualBarcode() {
    if (uiState.isModalOpen) return;
    const hwInput = byId('hwScannerInput');
    if(!hwInput) return;
    let scannedCode = hwInput.value.trim();
    if (scannedCode) {
        hwInput.value = '';
        triggerScanAction(scannedCode);
    }
}

export function stopCurrentStream() {
    scanState.cameraRequestId++;
    scanState.isCameraScanning = false;
    scanState.nativeLoopActive = false;
    scanState.zxingLoopActive = false;
    if (scanState.pendingLoadedMetadataHandler) {
        const pendingVideoEl = byId('video');
        if (pendingVideoEl) pendingVideoEl.removeEventListener('loadedmetadata', scanState.pendingLoadedMetadataHandler);
        scanState.pendingLoadedMetadataHandler = null;
    }
    if (scanState.currentStream) {
        scanState.currentStream.getTracks().forEach(track => {
            track.stop();
            track.enabled = false;
        });
        scanState.currentStream = null;
    }
    scanState.currentVideoTrack = null;
    scanState.torchOn = false;
    const overlay = byId('videoControlsOverlay');
    if (overlay) overlay.style.display = 'none';
    if (scanState.scanVideoResumeTimer) {
        clearTimeout(scanState.scanVideoResumeTimer);
        scanState.scanVideoResumeTimer = null;
    }
    resetScanConfirm();
    resetLiveScanQuality();
    const videoElement = byId('video');
    if (videoElement) {
        videoElement.removeEventListener('pause', onScanVideoPause);
        videoElement.pause();
        videoElement.srcObject = null;
    }
    if (scanState.codeReader && typeof scanState.codeReader.reset === 'function') {
        try {
            scanState.codeReader.reset();
        } catch(e) {}
    }
}

export function showCameraClosedBox() {
    const permBox = byId('permission-box');
    const vidContainer = byId('video-container');
    if (vidContainer) vidContainer.style.display = 'none';
    if (!permBox) return;
    const msgEl = permBox.querySelector('p');
    const btnEl = permBox.querySelector('button');
    if (msgEl) msgEl.textContent = '📷 កាមេរ៉ាបានបិទ';
    if (btnEl) btnEl.textContent = '🔓 បើកកាមេរ៉ាម្តងទៀត';
    permBox.style.display = 'block';
}

export function closeCameraManually() {
    stopCurrentStream();
    showCameraClosedBox();
}

export function setupVisibilityHandling() {
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && securityState.configQrScanActive) closeConfigQrScanner();
        if (document.hidden && scanState.isCameraScanning) {
            stopCurrentStream();
            showCameraClosedBox();
        }
    });
}
