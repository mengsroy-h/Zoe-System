import { byId } from '../core/dom';
import { scanState, uiState } from '../core/state';
import { elapsedSince } from '../core/elapsed';
import { searchByPhone } from '../features/phone-suggest';
import { triggerScanAction } from '../features/scan-action';
import { getCoverCropRect } from './camera';

export const SCAN_FORMAT_NAMES = ['Code128'];

export const CONFIG_QR_FORMAT_NAMES = ['QRCode'];

export const CONFIG_QR_SCAN_WIDTH = 640;

export const NATIVE_SCAN_FORMAT_NAMES = ['code_128'];

export const LIVE_SCAN_WIDTH_STEPS = [640, 800, 1024, 1280];

export const LIVE_SCAN_MAX_DIM = 1280;

export const LIVE_SCAN_MAX_BAND_PX = 240;

export const LIVE_SCAN_MAX_FPS = 120;

export const LIVE_SCAN_MIN_FPS = 10;

export const LIVE_SCAN_MIN_INTERVAL_MS = Math.round(1000 / LIVE_SCAN_MAX_FPS);

export const LIVE_SCAN_MAX_INTERVAL_MS = Math.round(1000 / LIVE_SCAN_MIN_FPS);

export const LIVE_SCAN_BACKOFF = 1.6;

export const LIVE_SCAN_SLOW_MS = 22;

export const LIVE_SCAN_FAST_MS = 9;

export const FRESH_FRAME_GIVE_UP = 20;

export const SCAN_CONFIRM_REPEATS = 2;

export const SCAN_CONFIRM_WINDOW_MS = 1500;

export function liveScanTargetWidth() {
    if (scanState.liveScanWidthIndex < 0) scanState.liveScanWidthIndex = LIVE_SCAN_WIDTH_STEPS.length - 1;
    return Math.min(LIVE_SCAN_MAX_DIM, LIVE_SCAN_WIDTH_STEPS[scanState.liveScanWidthIndex]);
}

export function noteLiveScanCost(ms) {
    if (!isFinite(ms) || ms < 0) return;
    scanState.liveScanCostEma = scanState.liveScanCostEma ? (scanState.liveScanCostEma * 0.7 + ms * 0.3) : ms;
    if (scanState.liveScanCostEma > LIVE_SCAN_SLOW_MS && scanState.liveScanWidthIndex > 0) {
        scanState.liveScanWidthIndex--;
        scanState.liveScanCostEma = 0;
    } else if (scanState.liveScanCostEma < LIVE_SCAN_FAST_MS && scanState.liveScanWidthIndex < LIVE_SCAN_WIDTH_STEPS.length - 1) {
        scanState.liveScanWidthIndex++;
        scanState.liveScanCostEma = 0;
    }
}

export function resetLiveScanQuality() {
    scanState.liveScanWidthIndex = LIVE_SCAN_WIDTH_STEPS.length - 1;
    scanState.liveScanCostEma = 0;
    scanState.lastDecodedVideoTime = -1;
    scanState.staleFrameStreak = 0;
    scanState.freshFrameGateUsable = true;
}

export function liveScanFrameSize(crop) {
    const targetWidth = Math.max(1, Math.min(crop.sWidth, liveScanTargetWidth()));
    const scale = targetWidth / (crop.sWidth || 1);
    const targetHeight = Math.max(1, Math.min(Math.round(crop.sHeight * scale), LIVE_SCAN_MAX_BAND_PX));
    return { width: Math.round(targetWidth), height: targetHeight };
}

export function takeFreshVideoFrame(videoElement) {
    if (!videoElement) return false;
    if (!scanState.freshFrameGateUsable) return true;
    const stamp = videoElement.currentTime;
    if (stamp !== scanState.lastDecodedVideoTime) {
        scanState.lastDecodedVideoTime = stamp;
        scanState.staleFrameStreak = 0;
        return true;
    }
    scanState.staleFrameStreak++;
    if (scanState.staleFrameStreak >= FRESH_FRAME_GIVE_UP) {
        scanState.freshFrameGateUsable = false;
        scanState.staleFrameStreak = 0;
        return true;
    }
    return false;
}

export function scheduleScanFrame(videoElement, fn) {
    if (videoElement && typeof videoElement.requestVideoFrameCallback === 'function') {
        try {
            videoElement.requestVideoFrameCallback((now) => fn(now));
            return;
        } catch (e) {}
    }
    requestAnimationFrame(fn);
}

export function scanEngineReady() {
    return typeof ZXingWASM !== 'undefined' && typeof ZXingWASM.readBarcodes === 'function';
}

export function buildReaderOptions(tryHarder, formats?) {
    return {
        formats: formats || SCAN_FORMAT_NAMES,
        tryHarder: !!tryHarder,
        tryRotate: !!tryHarder,
        tryInvert: !!tryHarder,
        tryDownscale: !!tryHarder,
        maxNumberOfSymbols: 1
    };
}

export function initScanEngine() {
    if (!scanEngineReady()) return;
    try {
        ZXingWASM.prepareZXingModule({
            overrides: {
                locateFile: (file, prefix) => (file.endsWith('.wasm') ? './vendor/' + file : prefix + file)
            },
            fireImmediately: true
        });
        scanState.codeReader = buildReaderOptions(true);
        scanState.liveScanCodeReader = buildReaderOptions(false);
    } catch (e) {
        console.error("Scan engine initialization error: ", e);
        if (window.ZoeErrors) ZoeErrors.capture(e, { context: "Scan engine initialization error: " });
    }
}

export function resetScanConfirm() {
    scanState.scanConfirmCode = '';
    scanState.scanConfirmCount = 0;
    scanState.scanConfirmAt = 0;
}

export function confirmLiveScan(code) {
    const text = String(code || '').trim();
    if (!text) return '';
    const now = Date.now();
    if (text !== scanState.scanConfirmCode || elapsedSince(scanState.scanConfirmAt) > SCAN_CONFIRM_WINDOW_MS) {
        scanState.scanConfirmCode = text;
        scanState.scanConfirmCount = 1;
        scanState.scanConfirmAt = now;
        return '';
    }
    scanState.scanConfirmAt = now;
    scanState.scanConfirmCount++;
    if (scanState.scanConfirmCount < SCAN_CONFIRM_REPEATS) return '';
    resetScanConfirm();
    return text;
}

export function decodeBarcodeFromCanvasManual(options, canvas) {
    if (!scanEngineReady() || !options) return Promise.resolve('');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return Promise.resolve('');
    let imageData;
    try {
        imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    } catch (e) {
        return Promise.resolve('');
    }
    return ZXingWASM.readBarcodes(imageData, options).then(readResultText, () => '');
}

export function readResultText(results) {
    if (!results || !results.length) return '';
    const first = results[0];
    if (!first || first.isValid === false) return '';
    return String(first.text || '');
}

export function decodeLiveFrame(canvas) {
    if (!scanState.liveScanCodeReader) return Promise.resolve('');
    return decodeBarcodeFromCanvasManual(scanState.liveScanCodeReader, canvas);
}

export function startZxingVideoScan(videoElement) {
    scanState.zxingLoopActive = true;
    const container = byId('video-container');

    if (!scanState.ownCaptureCanvas) {
        scanState.ownCaptureCanvas = document.createElement('canvas');
        scanState.ownCaptureCtx = scanState.ownCaptureCanvas.getContext('2d', { willReadFrequently: true });
    }

    let lastCheck = 0;
    let nextDelay = LIVE_SCAN_MIN_INTERVAL_MS;
    let liveDecodeBusy = false;
    function loop(timestamp) {
        if (!scanState.currentStream || !scanState.isCameraScanning || !scanState.zxingLoopActive) return;
        if (timestamp - lastCheck > nextDelay) {
            if (!liveDecodeBusy && !uiState.isModalOpen && videoElement && videoElement.readyState >= videoElement.HAVE_CURRENT_DATA && videoElement.videoWidth > 0 && takeFreshVideoFrame(videoElement)) {
                lastCheck = timestamp;
                const startedAt = (window.performance && performance.now) ? performance.now() : Date.now();
                const settleDecode = () => {
                    liveDecodeBusy = false;
                    const now = (window.performance && performance.now) ? performance.now() : Date.now();
                    const spent = now - startedAt;
                    noteLiveScanCost(spent);
                    nextDelay = Math.min(LIVE_SCAN_MAX_INTERVAL_MS, Math.max(LIVE_SCAN_MIN_INTERVAL_MS, Math.round(spent * LIVE_SCAN_BACKOFF)));
                };

                try {
                    const crop = getCoverCropRect(videoElement, container);
                    const size = liveScanFrameSize(crop);
                    if (scanState.ownCaptureCanvas.width !== size.width) scanState.ownCaptureCanvas.width = size.width;
                    if (scanState.ownCaptureCanvas.height !== size.height) scanState.ownCaptureCanvas.height = size.height;
                    scanState.ownCaptureCtx.drawImage(videoElement, crop.sx, crop.sy, crop.sWidth, crop.sHeight, 0, 0, size.width, size.height);

                    liveDecodeBusy = true;
                    decodeLiveFrame(scanState.ownCaptureCanvas).then((text) => {
                        settleDecode();
                        const confirmed = confirmLiveScan(text);
                        if (confirmed && !uiState.isModalOpen) {
                            processScannedCode(confirmed);
                        }
                    }, settleDecode);
                } catch (e) {
                    settleDecode();
                }
            }
        }
        if (scanState.currentStream && scanState.isCameraScanning && scanState.zxingLoopActive) {
            scheduleScanFrame(videoElement, loop);
        }
    }
    scheduleScanFrame(videoElement, loop);
}

export function processScannedCode(code) {
    if (uiState.isModalOpen || !code) return;
    let currentTime = Date.now();
    if (code !== scanState.lastScannedCode || elapsedSince(scanState.lastScanTime) > 2500) {
        scanState.lastScannedCode = code;
        scanState.lastScanTime = currentTime;
        triggerScanAction(code);
    }
}

export function debouncedSearchByPhone() {
    if (uiState.searchTimer) clearTimeout(uiState.searchTimer);
    uiState.searchTimer = setTimeout(() => {
        searchByPhone();
    }, 300);
}
