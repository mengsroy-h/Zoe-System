import { noteAppLockExcuse } from '../features/app-lock';
import { attachPalmSignStream, videoElement } from '../app/refs';
import { scanState } from '../core/state';
import { createScratchCanvas } from '../platform/document-io';
import { withTimeout } from './network';
import { decodeBarcodeFromCanvasManual, initScanEngine } from './scan-engine';

function frame() {
    const video = videoElement('palmSignVideo');
    if (!video || video.readyState < 2 || !video.videoWidth || !video.videoHeight) return null;
    const canvas = createScratchCanvas();
    const scale = Math.min(1, 1280 / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return null;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas;
}

export function palmSignFramePhoto(canvas = frame()) {
    if (!canvas) return '';
    let photo = canvas.toDataURL('image/jpeg', 0.82);
    if (photo.length > 1200000) photo = canvas.toDataURL('image/jpeg', 0.6);
    return photo.startsWith('data:image/jpeg;base64,') && photo.length <= 1200000 ? photo.split(',')[1] : '';
}

export function startPalmSignCamera(onScan: (code: string, photo: string) => void, onError: () => void) {
    let cancelled = false;
    let stream: MediaStream | null = null;
    let owned = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const active = () => !cancelled && !!videoElement('palmSignVideo');
    const scan = async () => {
        if (!active()) return;
        try {
            const canvas = frame();
            if (canvas) {
                let code = '';
                if (scanState.nativeDetector) code = (await withTimeout(scanState.nativeDetector.detect(canvas), 2000, 'Palm scan timeout'))[0]?.rawValue || '';
                if (!code && scanState.codeReader) code = await withTimeout(decodeBarcodeFromCanvasManual(scanState.codeReader, canvas), 2000, 'Palm scan timeout') || '';
                if (code && active()) {
                    const photo = palmSignFramePhoto(canvas);
                    if (photo) onScan(code, photo);
                }
            }
        } catch {}
        if (active()) timer = setTimeout(() => void scan(), 150);
    };
    void (async () => {
        try {
            initScanEngine();
            const existing = scanState.currentStream as MediaStream | null;
            if (existing?.getVideoTracks().some((track) => track.readyState === 'live')) stream = existing;
            else {
                owned = true;
                noteAppLockExcuse();
                stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
            }
            if (!active()) { if (owned) stream?.getTracks().forEach((track) => track.stop()); return; }
            await attachPalmSignStream(stream);
            if (active()) void scan();
        } catch { if (owned) stream?.getTracks().forEach((track) => track.stop()); if (active()) onError(); }
    })();
    return () => {
        cancelled = true;
        if (timer) clearTimeout(timer);
        if (owned) stream?.getTracks().forEach((track) => track.stop());
        void attachPalmSignStream(null);
    };
}
