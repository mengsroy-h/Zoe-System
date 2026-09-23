import { fieldValue, setFieldValue, videoElement } from '../app/refs';
import { viewState } from '../core/view-state';
import { dataState, scanState, securityState, uiState } from '../core/state';
import { countPickedUpCustomers, getPickupPhoneKey } from '../domain/pickup';
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

    viewState.dataSummary = {
        grandTotalCount: String(filteredRemainingCount),
        todayTotalCount: String(selectedAllPackages),
        todayClosedCount: String(selectedClosedCount),
        todayPackagesPickedUpCount: String(selectedPackagesPickedUpCount),
        summaryCodDollar: `$${codTotal.toFixed(2)}`,
        summaryCodRiel: `${codRiel.toLocaleString()} ៛`,
        summaryDodDollar: `$${dodTotal.toFixed(2)}`,
        summaryDodRiel: `${dodRiel.toLocaleString()} ៛`,
        summaryTotalDollar: `$${combinedTotalDollar.toFixed(2)}`,
        summaryTotalRiel: `${totalRiel.toLocaleString()} ៛`
    };
}

export function submitManualBarcode() {
    if (uiState.isModalOpen) return;
    let scannedCode = fieldValue('hwScannerInput').trim();
    if (scannedCode) {
        setFieldValue('hwScannerInput', '');
        triggerScanAction(scannedCode);
    }
}

export function stopCurrentStream() {
    scanState.cameraRequestId++;
    scanState.isCameraScanning = false;
    scanState.nativeLoopActive = false;
    scanState.zxingLoopActive = false;
    if (scanState.pendingLoadedMetadataHandler) {
        const pendingVideoEl = videoElement('video');
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
    viewState.cameraOverlayDisplay = 'none';
    if (scanState.scanVideoResumeTimer) {
        clearTimeout(scanState.scanVideoResumeTimer);
        scanState.scanVideoResumeTimer = null;
    }
    resetScanConfirm();
    resetLiveScanQuality();
    const video = videoElement('video');
    if (video) {
        video.removeEventListener('pause', onScanVideoPause);
        video.pause();
        video.srcObject = null;
    }
    if (scanState.codeReader && typeof scanState.codeReader.reset === 'function') {
        try {
            scanState.codeReader.reset();
        } catch(e) {}
    }
}

export function showCameraClosedBox() {
    viewState.cameraView = 'closed';
}

export function closeCameraManually() {
    stopCurrentStream();
    showCameraClosedBox();
}

