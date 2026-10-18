import { noteAppLockExcuse } from '../features/app-lock';
import { attachPalmSignStream, videoElement } from '../app/refs';
import { scanState } from '../core/state';
import { createScratchCanvas, loadScratchImage } from '../platform/document-io';
import { withTimeout } from './network';
import { buildReaderOptions, initScanEngine, readCanvasSymbols } from './scan-engine';

export const PALM_SIGN_FORMAT_NAMES = ['Code128', 'QRCode'];

export const PALM_SIGN_NATIVE_FORMATS = ['code_128', 'qr_code'];

export const PALM_SIGN_MAX_SYMBOLS = 4;

export const PALM_SIGN_PHOTO_MAX_DIM = 1280;

export const PALM_SIGN_LIVE_FAST_DIM = 960;

export const PALM_SIGN_LIVE_GAP_MS = 60;

export const PALM_SIGN_LIVE_DEEP_EVERY = 4;

export const PALM_SIGN_IMAGE_DIMS = [1600, 2600];

export const PALM_SIGN_IMAGE_TIMEOUT_MS = 10000;

export type PalmSignMatch = (text: string) => string;

function palmSignReader(deep: boolean) {
    return { ...buildReaderOptions(deep, PALM_SIGN_FORMAT_NAMES), maxNumberOfSymbols: PALM_SIGN_MAX_SYMBOLS };
}

export function palmSignPickCode(results, match: PalmSignMatch) {
    const valid = (Array.isArray(results) ? results : []).filter((r) => r && r.isValid !== false && String(r.text || '').trim());
    for (const r of valid) {
        const known = match(String(r.text).trim());
        if (known) return known;
    }
    const linear = valid.find((r) => r.format !== 'QRCode');
    return linear ? String(linear.text).trim() : '';
}

function drawScaled(source, width: number, height: number, maxDim: number) {
    const canvas = createScratchCanvas();
    const scale = Math.min(1, maxDim / Math.max(width, height));
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context || !canvas.width || !canvas.height) return null;
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
    return canvas;
}

function frame() {
    const video = videoElement('palmSignVideo');
    if (!video || video.readyState < 2 || !video.videoWidth || !video.videoHeight) return null;
    return drawScaled(video, video.videoWidth, video.videoHeight, PALM_SIGN_PHOTO_MAX_DIM);
}

export function palmSignFramePhoto(canvas = frame()) {
    if (!canvas) return '';
    let photo = canvas.toDataURL('image/jpeg', 0.82);
    if (photo.length > 1200000) photo = canvas.toDataURL('image/jpeg', 0.6);
    return photo.startsWith('data:image/jpeg;base64,') && photo.length <= 1200000 ? photo.split(',')[1] : '';
}

let palmSignDetector: { base: unknown; ready: Promise<any> } | null = null;

export function palmSignNativeDetector() {
    const base = scanState.nativeDetector;
    if (palmSignDetector && palmSignDetector.base === base) return palmSignDetector.ready;
    const Detector = (globalThis as any).BarcodeDetector;
    const ready = !base || typeof Detector !== 'function' ? Promise.resolve(base || null)
        : Promise.resolve(typeof Detector.getSupportedFormats === 'function' ? Detector.getSupportedFormats() : [])
            .then((formats) => {
                const wanted = PALM_SIGN_NATIVE_FORMATS.filter((name) => Array.isArray(formats) && formats.includes(name));
                return wanted.includes('qr_code') ? new Detector({ formats: wanted }) : base;
            })
            .catch(() => base);
    palmSignDetector = { base, ready };
    return ready;
}

async function nativeCode(canvas, ms: number, match: PalmSignMatch) {
    const detector = await palmSignNativeDetector();
    if (!detector) return '';
    const found = await withTimeout(detector.detect(canvas), ms, 'Palm scan timeout');
    return palmSignPickCode((Array.isArray(found) ? found : []).map((r) => ({ format: r && r.format === 'qr_code' ? 'QRCode' : 'Code128', text: r && r.rawValue })), match);
}

async function readCode(canvas, deep: boolean, match: PalmSignMatch, ms: number) {
    return palmSignPickCode(await withTimeout(readCanvasSymbols(palmSignReader(deep), canvas), ms, 'Palm scan timeout'), match);
}

export async function palmSignDecodeImage(img: HTMLImageElement, match: PalmSignMatch) {
    const width = img.naturalWidth;
    const height = img.naturalHeight;
    const photoCanvas = drawScaled(img, width, height, PALM_SIGN_PHOTO_MAX_DIM);
    if (!photoCanvas) throw new Error('canvas');
    let code = '';
    try { code = await nativeCode(photoCanvas, PALM_SIGN_IMAGE_TIMEOUT_MS, match); } catch {}
    for (const dim of PALM_SIGN_IMAGE_DIMS) {
        if (code && match(code)) break;
        if (dim !== PALM_SIGN_IMAGE_DIMS[0] && Math.max(width, height) <= PALM_SIGN_IMAGE_DIMS[0]) break;
        const canvas = drawScaled(img, width, height, dim);
        if (!canvas) break;
        try { code = await readCode(canvas, true, match, PALM_SIGN_IMAGE_TIMEOUT_MS) || code; } catch {}
    }
    return { canvas: photoCanvas, code };
}

export async function palmSignPhotoFromFile(file: File, match: PalmSignMatch) {
    if (!file.type.startsWith('image/') || file.size > 20000000) throw new Error('image');
    const url = URL.createObjectURL(file);
    try {
        const img = await new Promise<HTMLImageElement>((resolve, reject) => loadScratchImage(url, resolve, reject));
        const decoded = await palmSignDecodeImage(img, match);
        const data = palmSignFramePhoto(decoded.canvas);
        if (!data) throw new Error('size');
        return { data, barcode: decoded.code };
    } finally { URL.revokeObjectURL(url); }
}

export function startPalmSignCamera(onScan: (code: string, photo: string) => void, onError: () => void, wants: (code: string) => boolean = () => true,
    match: PalmSignMatch = (text) => text) {
    let cancelled = false;
    let stream: MediaStream | null = null;
    let owned = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let round = 0;
    const active = () => !cancelled && !!videoElement('palmSignVideo');
    const scan = async () => {
        if (!active()) return;
        try {
            const canvas = frame();
            if (canvas) {
                let code = '';
                if (scanState.nativeDetector) code = await nativeCode(canvas, 2000, match);
                if (!code) {
                    const deep = ++round % PALM_SIGN_LIVE_DEEP_EVERY === 0;
                    const target = deep ? canvas : drawScaled(canvas, canvas.width, canvas.height, PALM_SIGN_LIVE_FAST_DIM);
                    if (target) code = await readCode(target, deep, match, 2000);
                }
                if (code && active() && wants(code)) {
                    const photo = palmSignFramePhoto(canvas);
                    if (photo) onScan(code, photo);
                }
            }
        } catch {}
        if (active()) timer = setTimeout(() => void scan(), PALM_SIGN_LIVE_GAP_MS);
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
