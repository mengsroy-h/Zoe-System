import { setFieldValue, videoElement } from '../app/refs';
import { createScratchCanvas, loadScratchImage } from '../platform/document-io';
import { scanState, securityState } from '../core/state';
import { noteAppLockExcuse } from './app-lock';
import { connectSetupPayload, parseSetupLinkText } from './config';
import { modalIsOpen } from '../core/modals';
import { CONFIG_QR_FORMAT_NAMES, CONFIG_QR_SCAN_WIDTH, buildReaderOptions, decodeBarcodeFromCanvasManual, scanEngineReady, scheduleScanFrame } from '../services/scan-engine';
import { closeModal, openModalHelper } from '../ui/modal';
import { showToast } from '../ui/toast';

export function isInAppBrowser() {
    return /FBAN|FBAV|Instagram|Messenger|MicroMessenger|Line\//i.test(navigator.userAgent);
}

export function describeCameraError(err) {
    const name = err && err.name;
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') return '🚫 កាមេរ៉ាត្រូវបានបិទសិទ្ធិ! សូមអនុញ្ញាតកាមេរ៉ាក្នុង Browser Settings រួចសាកល្បងម្តងទៀត';
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') return '🚫 រកមិនឃើញកាមេរ៉ានៅលើឧបករណ៍នេះទេ';
    if (name === 'NotReadableError' || name === 'TrackStartError') return '🚫 កាមេរ៉ាកំពុងប្រើដោយកម្មវិធីផ្សេង — សូមបិទកម្មវិធីនោះសិន';
    if (name === 'OverconstrainedError') return '🚫 កាមេរ៉ារបស់ឧបករណ៍នេះមិនគាំទ្រការកំណត់ដែលត្រូវការទេ';
    if (name === 'SecurityError') return '🚫 ត្រូវបើកតាម HTTPS ទើបប្រើកាមេរ៉ាបាន';
    return '❌ មិនអាចបើក Camera បានទេ! សូមអនុញ្ញាត Camera Permission';
}

export function closeConfigQrScanner() {
    securityState.configQrScanActive = false;
    if (securityState.configQrStream) {
        try { securityState.configQrStream.getTracks().forEach((t) => t.stop()); } catch (e) {}
        securityState.configQrStream = null;
    }
    const video = videoElement('configQrVideo');
    if (video) { try { video.pause(); } catch (e) {} video.srcObject = null; }
    securityState.configQrReader = null;
    closeModal('configQrScanModal');
}

export async function openConfigQrScanner() {
    if (securityState.configQrScanActive) return;
    if (scanState.isCameraScanning || scanState.isCameraStarting) {
        showToast("⚠️ សូមបិទកាមេរ៉ាស្កេនបាកូដសិន មុននឹងស្កេន QR Setup Link");
        return;
    }
    if (!scanEngineReady()) {
        showToast("❌ Camera Scanner មិនទាន់ផ្ទុករួចទេ! សូមរង់ចាំបន្តិចទៀត");
        return;
    }
    if (isInAppBrowser()) {
        showToast('⚠️ សូមបើកតាម Browser ធម្មតា (Chrome/Safari) ដើម្បីប្រើកាមេរ៉ា — ក្នុង App ដូចជា Facebook/Messenger កាមេរ៉ាអាចប្រើមិនបាន');
    }
    openModalHelper('configQrScanModal');
    securityState.configQrScanActive = true;
    try {
        securityState.configQrReader = buildReaderOptions(false, CONFIG_QR_FORMAT_NAMES);
        noteAppLockExcuse();
        securityState.configQrStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' }, audio: false
        });
        const video = videoElement('configQrVideo');
        if (!video) throw new Error('configQrVideo missing');
        video.srcObject = securityState.configQrStream;
        await video.play();
        runConfigQrLoop(video);
    } catch (e) {
        console.error('Config QR scanner error:', e);
        if (window.ZoeErrors) ZoeErrors.capture(e, { context: 'openConfigQrScanner' });
        showToast(describeCameraError(e));
        closeConfigQrScanner();
    }
}

export function runConfigQrLoop(videoElement) {
    let busy = false;
    let canvas = null;
    let ctx = null;
    const loop = () => {
        if (!securityState.configQrScanActive) return;
        if (!busy && videoElement.readyState >= videoElement.HAVE_CURRENT_DATA && videoElement.videoWidth > 0) {
            if (!canvas) {
                canvas = createScratchCanvas();
                ctx = canvas.getContext('2d', { willReadFrequently: true });
            }
            const width = Math.min(CONFIG_QR_SCAN_WIDTH, videoElement.videoWidth);
            const height = Math.round(videoElement.videoHeight * (width / videoElement.videoWidth));
            if (canvas.width !== width) canvas.width = width;
            if (canvas.height !== height) canvas.height = height;
            ctx.drawImage(videoElement, 0, 0, width, height);
            busy = true;
            decodeBarcodeFromCanvasManual(securityState.configQrReader, canvas).then((text) => {
                busy = false;
                if (text && securityState.configQrScanActive) handleConfigQrResult(text);
            }, () => { busy = false; });
        }
        if (securityState.configQrScanActive) scheduleScanFrame(videoElement, loop);
    };
    scheduleScanFrame(videoElement, loop);
}

export function handleConfigQrResult(text) {
    if (!securityState.configQrScanActive) return;
    const result: any = parseSetupLinkText(text);
    if (result.error === 'not-link') {
        showToast("❌ QR នេះមិនមែនជា Setup Link ត្រឹមត្រូវទេ!");
        return;
    }
    if (!result.parsed) {
        showToast("❌ QR Setup Link មិនត្រឹមត្រូវទេ!");
        return;
    }

    closeConfigQrScanner();
    connectSetupPayload(result.parsed, 'QR');
}

export const CONFIG_QR_IMAGE_MAX_DIM = 1600;

export function decodeConfigQrImage(e?) {
    const files = e && e.target && e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    setFieldValue('configQrImageInput', '');
    if (!modalIsOpen('configModal')) return;
    if (!scanEngineReady()) {
        showToast("❌ Camera Scanner មិនទាន់ផ្ទុករួចទេ! សូមរង់ចាំបន្តិចទៀត");
        return;
    }
    const reader = new FileReader();
    reader.onload = (evt) => decodeConfigQrDataUrl(evt.target.result);
    reader.onerror = () => showToast("❌ មិនអាចអានរូបភាពនេះបានទេ។ សូមសាកល្បងរូបភាពផ្សេង។");
    reader.readAsDataURL(file);
}

let configQrImageSeq = 0;

export function decodeConfigQrDataUrl(dataUrl) {
    const seq = ++configQrImageSeq;
    const current = () => seq === configQrImageSeq && modalIsOpen('configModal');
    const notFound = () => { if (current()) showToast("⚠️ រកមិនឃើញ QR Setup Link ក្នុងរូបភាពនេះទេ។ សូមប្រើរូបថតអេក្រង់ QR ដែលច្បាស់ ឬបិទភ្ជាប់ Link ផ្ទាល់។"); };
    loadScratchImage(dataUrl, async (img) => {
        if (!current()) return;
        const scale = Math.min(1, CONFIG_QR_IMAGE_MAX_DIM / Math.max(img.naturalWidth, img.naturalHeight));
        const canvas = createScratchCanvas();
        canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) { notFound(); return; }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        let text = '';
        try {
            text = await decodeBarcodeFromCanvasManual(buildReaderOptions(true, CONFIG_QR_FORMAT_NAMES), canvas);
        } catch (err) {
            text = '';
        }
        if (!current()) return;
        if (!text) { notFound(); return; }
        const result: any = parseSetupLinkText(text);
        if (!result.parsed) {
            showToast(result.error === 'not-link' ? "❌ QR នេះមិនមែនជា Setup Link ត្រឹមត្រូវទេ!" : "❌ QR Setup Link មិនត្រឹមត្រូវទេ!");
            return;
        }
        connectSetupPayload(result.parsed, 'QR ពីរូបភាព');
    }, notFound);
}
