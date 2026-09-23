import { byId } from '../core/dom';
import { scanState, securityState } from '../core/state';
import { decodeSetupPayload } from './config';
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
    const video = byId('configQrVideo');
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
        securityState.configQrStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' }, audio: false
        });
        const video = byId('configQrVideo');
        if (!video) throw new Error('configQrVideo missing');
        video.srcObject = securityState.configQrStream;
        video.setAttribute('playsinline', 'true');
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
                canvas = document.createElement('canvas');
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
    let setupParam = null;
    try {
        setupParam = new URL(text).searchParams.get('setup');
    } catch (e) {
        setupParam = null;
    }
    if (!setupParam) {
        showToast("❌ QR នេះមិនមែនជា Setup Link ត្រឹមត្រូវទេ!");
        return;
    }

    let parsed;
    try {
        parsed = decodeSetupPayload(setupParam);
    } catch (e) {
        showToast("❌ QR Setup Link មិនត្រឹមត្រូវទេ!");
        return;
    }

    closeConfigQrScanner();
    const cfgInput = byId('firebaseConfigInput');
    if (cfgInput) cfgInput.value = JSON.stringify(parsed, null, 2);
    showToast('✅ បានស្កេន QR ជោគជ័យ! សូមពិនិត្យ ហើយចុច "រក្សាទុក និងភ្ជាប់"');
}
