import { noteAppLockExcuse } from '../features/app-lock';
import { attachPalmSignStream, videoElement } from '../app/refs';
import { getServerNow } from '../core/clock';
import { elapsedSince } from '../core/elapsed';
import { scanState } from '../core/state';
import { appZoneParts } from '../core/timezone';
import { createScratchCanvas, loadScratchImage } from '../platform/document-io';
import { withTimeout } from './network';
import { initScanEngine, readCanvasSymbols } from './scan-engine';
import { nativeScanResults, scanQrReader } from './scan-formats';

export const PALM_SIGN_PHOTO_MAX_DIM = 1280;

export const PALM_SIGN_LIVE_FAST_DIM = 960;

export const PALM_SIGN_LIVE_GAP_MS = 60;

export const PALM_SIGN_LIVE_DEEP_EVERY = 4;

export const PALM_SIGN_IMAGE_DIMS = [1600, 2600];

export const PALM_SIGN_IMAGE_TIMEOUT_MS = 10000;

export const PALM_SIGN_FIX_MAX_AGE_MS = 2 * 60 * 1000;

export const PALM_SIGN_FIX_MAX_ACCURACY_M = 1000;

export const PALM_SIGN_STAMP_COLOR = '#ff4444';

export const PALM_SIGN_STAMP_SIZE = 0.035;

export type PalmSignMatch = (text: string) => string;

export type PalmSignFix = { lat: number; lng: number; at: number };

export const palmSignLocation: { fix: PalmSignFix | null; watch: number | null; users: number } = { fix: null, watch: null, users: 0 };

export function notePalmSignPosition(position) {
    const c = position && position.coords;
    const lat = c ? Number(c.latitude) : NaN;
    const lng = c ? Number(c.longitude) : NaN;
    const accuracy = c ? Number(c.accuracy) : NaN;
    if (!isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return;
    if (isFinite(accuracy) && accuracy > PALM_SIGN_FIX_MAX_ACCURACY_M) return;
    palmSignLocation.fix = { lat, lng, at: Date.now() };
}

export function palmSignCurrentFix() {
    const fix = palmSignLocation.fix;
    return fix && elapsedSince(fix.at) <= PALM_SIGN_FIX_MAX_AGE_MS ? fix : null;
}

async function locationNeedsPrompt() {
    try {
        const status = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
        return status.state !== 'granted';
    } catch { return true; }
}

export function startPalmSignLocation() {
    let stopped = false;
    palmSignLocation.users++;
    const geo = typeof navigator !== 'undefined' ? navigator.geolocation : null;
    if (geo && typeof geo.watchPosition === 'function' && palmSignLocation.watch === null && palmSignLocation.users === 1) {
        void (async () => {
            if (await locationNeedsPrompt()) noteAppLockExcuse();
            if (stopped || palmSignLocation.watch !== null) return;
            try {
                palmSignLocation.watch = geo.watchPosition(notePalmSignPosition, () => {}, { enableHighAccuracy: true, maximumAge: 30000, timeout: 30000 });
            } catch {}
        })();
    }
    return () => {
        if (stopped) return;
        stopped = true;
        palmSignLocation.users = Math.max(0, palmSignLocation.users - 1);
        if (palmSignLocation.users || palmSignLocation.watch === null) return;
        try { geo?.clearWatch(palmSignLocation.watch); } catch {}
        palmSignLocation.watch = null;
    };
}

export function palmSignStampLines(ms: number, fix: PalmSignFix | null) {
    const p = appZoneParts(ms);
    const lines = [p.year + '-' + p.month + '-' + p.day + ' ' + p.hour + ':' + p.minute + ':' + p.second];
    if (fix) lines.push(fix.lat.toFixed(5) + ', ' + fix.lng.toFixed(5));
    return lines;
}

export function stampPalmSignPhoto(canvas, lines: string[]) {
    try {
        return drawPalmSignStamp(canvas, lines);
    } catch { return false; }
}

function drawPalmSignStamp(canvas, lines: string[]) {
    const context = canvas && canvas.getContext ? canvas.getContext('2d') : null;
    if (!context || !canvas.width || !canvas.height || !lines.length) return false;
    const size = Math.max(12, Math.round(Math.min(canvas.width, canvas.height) * PALM_SIGN_STAMP_SIZE));
    const pad = Math.round(size * 0.5);
    context.save();
    context.font = '400 ' + size + 'px sans-serif';
    context.textBaseline = 'bottom';
    context.fillStyle = PALM_SIGN_STAMP_COLOR;
    context.shadowColor = 'rgba(0, 0, 0, 0.35)';
    context.shadowBlur = Math.max(1, Math.round(size / 12));
    lines.forEach((line, i) => {
        const y = canvas.height - pad - (lines.length - 1 - i) * Math.round(size * 1.45);
        context.fillText(line, pad, y);
    });
    context.restore();
    return true;
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
    try { stampPalmSignPhoto(canvas, palmSignStampLines(getServerNow(), palmSignCurrentFix())); } catch {}
    let photo = canvas.toDataURL('image/jpeg', 0.82);
    if (photo.length > 1200000) photo = canvas.toDataURL('image/jpeg', 0.6);
    return photo.startsWith('data:image/jpeg;base64,') && photo.length <= 1200000 ? photo.split(',')[1] : '';
}

async function nativeCode(canvas, ms: number, match: PalmSignMatch) {
    if (!scanState.nativeDetector) return '';
    return palmSignPickCode(nativeScanResults(await withTimeout(scanState.nativeDetector.detect(canvas), ms, 'Palm scan timeout')), match);
}

async function readCode(canvas, deep: boolean, match: PalmSignMatch, ms: number) {
    return palmSignPickCode(await withTimeout(readCanvasSymbols(scanQrReader(deep), canvas), ms, 'Palm scan timeout'), match);
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
