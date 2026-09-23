import { commitNow } from '../app/flush';
import { elementOf, setFieldValue, videoElement as videoRef } from '../app/refs';
import { viewState } from '../core/view-state';
import { scanState, uiState } from '../core/state';
import { noteAppLockExcuse } from '../features/app-lock';
import { showCameraClosedBox, stopCurrentStream } from '../features/daily-stats';
import { warmZtoLookupProxyNow } from '../features/lookup-api';
import { LIVE_SCAN_BACKOFF, LIVE_SCAN_MAX_INTERVAL_MS, LIVE_SCAN_MIN_INTERVAL_MS, confirmLiveScan, processScannedCode, scheduleScanFrame, startZxingVideoScan, takeFreshVideoFrame } from './scan-engine';
import { onScanVideoPause } from '../ui/modal';
import { showToast } from '../ui/toast';

export function requestCameraPermission() {
    noteAppLockExcuse();
    if (scanState.isCameraStarting) return;
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
        showToast('⚠️ កម្មវិធីរុករកនេះមិនអនុញ្ញាតឲ្យប្រើកាមេរ៉ាទេ — សូមបើកតាម HTTPS ឬប្រើម៉ាស៊ីនស្កេន/វាយបញ្ចូលដោយដៃ');
        showCameraClosedBox();
        return;
    }
    warmZtoLookupProxyNow();
    scanState.isCameraStarting = true;

    stopCurrentStream();
    const requestId = scanState.cameraRequestId;

    const constraints = {
        video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 30 }
        }
    };

    navigator.mediaDevices.getUserMedia(constraints)
        .then(stream => {
            if (requestId !== scanState.cameraRequestId) {
                stream.getTracks().forEach(track => track.stop());
                scanState.isCameraStarting = false;
                return;
            }

            scanState.currentStream = stream;
            scanState.isCameraScanning = true;
            scanState.isCameraStarting = false;

            viewState.cameraView = 'live';

            const videoElement = videoRef('video');
            if(!videoElement) return;

            viewState.cameraWebkitInline = true;
            videoElement.muted = true;
            videoElement.srcObject = stream;

            setupTrackCapabilities(stream);

            const beginScanning = () => {
                if (!scanState.currentStream) return;
                videoElement.addEventListener('pause', onScanVideoPause);
                videoElement.play().catch(() => {});
                if (scanState.nativeDetector) {
                    startFastNativeScan(videoElement);
                } else if (scanState.liveScanCodeReader) {
                    startZxingVideoScan(videoElement);
                }
            };

            if (videoElement.readyState >= 1) {
                beginScanning();
            } else {
                scanState.pendingLoadedMetadataHandler = () => {
                    scanState.pendingLoadedMetadataHandler = null;
                    beginScanning();
                };
                videoElement.addEventListener('loadedmetadata', scanState.pendingLoadedMetadataHandler, { once: true });
            }
        })
        .catch(err => {
            scanState.isCameraStarting = false;
            if (requestId !== scanState.cameraRequestId) return;
            let msg = "មិនអាចបើកកាមេរ៉ាបានទេ៖ សូមពិនិត្យមើលសិទ្ធិកាមេរ៉ា ឬ HTTPS ។";
            if (err && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')) {
                msg = "កាមេរ៉ាត្រូវបានបិទសិទ្ធិ! សូមចូលទៅ Settings > Safari (ឬកម្មវិធីនេះ) ហើយអនុញ្ញាតកាមេរ៉ា រួចព្យាយាមម្តងទៀត។";
            } else if (err && err.name === 'NotFoundError') {
                msg = "រកមិនឃើញកាមេរ៉ានៅលើឧបករណ៍នេះទេ។";
            } else if (err && err.name === 'NotReadableError') {
                msg = "កាមេរ៉ាកំពុងប្រើដោយកម្មវិធីផ្សេង។ សូមបិទកម្មវិធីផ្សេងហើយសាកល្បងម្តងទៀត។";
            }
            alert(msg + "\n\n💡 ប្រសិនបើអ្នកកំពុងបើកតាម Facebook / Messenger / TikTok in-app browser សូមចុចបើកជា Safari ឬ Chrome ដោយផ្ទាល់។");
        });
}

export function setupTrackCapabilities(stream) {
    scanState.currentVideoTrack = stream.getVideoTracks()[0] || null;
    scanState.torchOn = false;

    viewState.cameraZoomDisplay = 'none';
    viewState.cameraTorchDisplay = 'none';
    viewState.cameraOverlayDisplay = 'none';

    if (!scanState.currentVideoTrack || typeof scanState.currentVideoTrack.getCapabilities !== 'function') return;

    let caps = null;
    try { caps = scanState.currentVideoTrack.getCapabilities(); } catch (e) {}
    if (!caps) return;

    if (caps.focusMode && caps.focusMode.includes('continuous')) {
        scanState.currentVideoTrack.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }).catch(() => {});
    }

    if (caps.zoom && caps.zoom.max > caps.zoom.min) {
        viewState.cameraZoomRange = { min: caps.zoom.min, max: caps.zoom.max, step: caps.zoom.step || 0.1 };
        let settings: any = {};
        try { settings = scanState.currentVideoTrack.getSettings(); } catch (e) {}
        // ⛔ ព្រំដែនថ្មីត្រូវចុះ DOM **មុន** កំណត់តម្លៃ — បើអត់ browser clamp តម្លៃ
        //    តាមព្រំដែនចាស់ (១..១) ➜ zoom ចាប់ផ្តើមនៅ ១ ជានិច្ច។
        commitNow();
        setFieldValue('zoomSlider', String(settings.zoom || caps.zoom.min));
        viewState.cameraZoomDisplay = 'flex';
    }

    if (caps.torch) {
        viewState.cameraTorchDisplay = 'flex';
    }

    if (viewState.cameraZoomDisplay === 'flex' || viewState.cameraTorchDisplay === 'flex') {
        viewState.cameraOverlayDisplay = 'flex';
    }
}

export function applyCameraZoomFromSlider(value) {
    if (!scanState.currentVideoTrack) return;
    scanState.currentVideoTrack.applyConstraints({ advanced: [{ zoom: parseFloat(value) }] }).catch(() => {});
}

export function toggleTorch() {
    if (!scanState.currentVideoTrack) return;
    const nextState = !scanState.torchOn;
    scanState.currentVideoTrack.applyConstraints({ advanced: [{ torch: nextState }] })
        .then(() => {
            scanState.torchOn = nextState;
        })
        .catch(() => {});
}

export function getCoverCropRect(videoElement, container) {
    const vw = videoElement.videoWidth, vh = videoElement.videoHeight;
    const cw = container ? container.clientWidth : 0, ch = container ? container.clientHeight : 0;
    if (!vw || !vh || !cw || !ch) return { sx: 0, sy: 0, sWidth: vw, sHeight: vh };
    const videoRatio = vw / vh;
    const containerRatio = cw / ch;
    let sWidth, sHeight;
    if (videoRatio > containerRatio) {
        sHeight = vh;
        sWidth = Math.round(vh * containerRatio);
    } else {
        sWidth = vw;
        sHeight = Math.round(vw / containerRatio);
    }
    return { sx: Math.round((vw - sWidth) / 2), sy: Math.round((vh - sHeight) / 2), sWidth, sHeight };
}

export function startFastNativeScan(videoElement) {
    scanState.nativeLoopActive = true;
    const container = elementOf('videoContainer');
    let lastCheck = 0;
    let nextDelay = LIVE_SCAN_MIN_INTERVAL_MS;
    async function renderLoop(timestamp) {
        if (!scanState.currentStream || !scanState.isCameraScanning || !scanState.nativeLoopActive) return;
        if (timestamp - lastCheck > nextDelay) {
            if (!uiState.isModalOpen && videoElement && videoElement.readyState >= videoElement.HAVE_CURRENT_DATA && videoElement.videoWidth > 0 && takeFreshVideoFrame(videoElement)) {
                lastCheck = timestamp;
                const startedAt = (window.performance && performance.now) ? performance.now() : Date.now();
                try {
                    const crop = getCoverCropRect(videoElement, container);
                    const bitmap = await createImageBitmap(videoElement, crop.sx, crop.sy, crop.sWidth, crop.sHeight);
                    try {
                        const barcodes = await scanState.nativeDetector.detect(bitmap);
                        const confirmed = barcodes && barcodes.length > 0 ? confirmLiveScan(barcodes[0].rawValue) : '';
                        if (confirmed && !uiState.isModalOpen && scanState.currentStream && scanState.isCameraScanning && scanState.nativeLoopActive) {
                            processScannedCode(confirmed);
                        }
                    } finally {
                        bitmap.close();
                    }
                } catch (e) {
                } finally {
                    const now = (window.performance && performance.now) ? performance.now() : Date.now();
                    nextDelay = Math.min(LIVE_SCAN_MAX_INTERVAL_MS, Math.max(LIVE_SCAN_MIN_INTERVAL_MS, Math.round((now - startedAt) * LIVE_SCAN_BACKOFF)));
                }
            }
        }
        if (scanState.currentStream && scanState.isCameraScanning && scanState.nativeLoopActive) {
            scheduleScanFrame(videoElement, renderLoop);
        }
    }
    scheduleScanFrame(videoElement, renderLoop);
}
