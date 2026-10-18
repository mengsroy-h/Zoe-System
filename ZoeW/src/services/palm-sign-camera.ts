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

export const PALM_SIGN_FIX_MAX_ACCURACY_M = 5000;

export const PALM_SIGN_STAMP_COLOR = '#ff4444';

export const PALM_SIGN_LOCATION_WAIT_MS = 8000;

export const PALM_SIGN_STAMP_SIZE = 0.035;

export const PALM_SIGN_EXIF_READ_BYTES = 256 * 1024;

export type PalmSignMatch = (text: string) => string;

export type PalmSignFix = { lat: number; lng: number; at: number };

export const palmSignLocation: { fix: PalmSignFix | null; watch: number | null; users: number } = { fix: null, watch: null, users: 0 };

export const palmSignCameraStart: { settled: Promise<void> } = { settled: Promise.resolve() };

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
            await new Promise((resolve) => setTimeout(resolve, 0));
            let waited: ReturnType<typeof setTimeout> | undefined;
            await Promise.race([palmSignCameraStart.settled, new Promise((resolve) => { waited = setTimeout(resolve, PALM_SIGN_LOCATION_WAIT_MS); })]);
            clearTimeout(waited);
            if (stopped || palmSignLocation.watch !== null) return;
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

export type PalmSignExif = { time: string; offset: string; lat: number; lng: number };

const EXIF_TYPE_BYTES = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };

export function readPhotoExif(buffer): PalmSignExif {
    const out = { time: '', offset: '', lat: NaN, lng: NaN };
    try {
        if (buffer instanceof ArrayBuffer) readJpegExif(new DataView(buffer), out);
    } catch {}
    return out;
}

function readJpegExif(view: DataView, out: PalmSignExif) {
    if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return;
    let pos = 2;
    for (let guard = 0; guard < 64 && pos + 4 <= view.byteLength; guard++) {
        if (view.getUint8(pos) !== 0xff) return;
        const marker = view.getUint8(pos + 1);
        if (marker === 0xda || marker === 0xd9) return;
        const size = view.getUint16(pos + 2);
        if (size < 2) return;
        if (marker === 0xe1 && pos + 10 <= view.byteLength && view.getUint32(pos + 4) === 0x45786966 && view.getUint16(pos + 8) === 0) {
            readTiffExif(view, pos + 10, Math.min(view.byteLength, pos + 2 + size), out);
            return;
        }
        pos += 2 + size;
    }
}

function readTiffExif(view: DataView, start: number, end: number, out: PalmSignExif) {
    const order = start + 2 <= end ? view.getUint16(start) : 0;
    const little = order === 0x4949;
    if (!little && order !== 0x4d4d) return;
    const u16 = (at: number) => (at >= start && at + 2 <= end ? view.getUint16(at, little) : -1);
    const u32 = (at: number) => (at >= start && at + 4 <= end ? view.getUint32(at, little) : -1);
    if (u16(start + 2) !== 42) return;
    const entries = (offset: number) => {
        const map = new Map<number, { type: number; count: number; at: number }>();
        const at = start + offset;
        const count = offset > 0 ? u16(at) : -1;
        for (let i = 0; i < Math.min(count, 256); i++) {
            const entry = at + 2 + i * 12;
            if (entry + 12 > end) break;
            const type = u16(entry + 2);
            const items = u32(entry + 4);
            const bytes = (EXIF_TYPE_BYTES[type] || 0) * Math.max(0, items);
            map.set(u16(entry), { type, count: items, at: bytes <= 4 ? entry + 8 : start + u32(entry + 8) });
        }
        return map;
    };
    const ascii = (entry) => {
        if (!entry || entry.type !== 2) return '';
        let text = '';
        for (let i = 0; i < Math.min(entry.count, 64); i++) {
            const at = entry.at + i;
            if (at < start || at >= end) break;
            const c = view.getUint8(at);
            if (!c) break;
            text += String.fromCharCode(c);
        }
        return text.trim();
    };
    const degrees = (entry) => {
        if (!entry || entry.type !== 5 || entry.count < 3) return NaN;
        let value = 0;
        for (let i = 0; i < 3; i++) {
            const top = u32(entry.at + i * 8);
            const bottom = u32(entry.at + i * 8 + 4);
            if (top < 0 || bottom <= 0) return NaN;
            value += top / bottom / Math.pow(60, i);
        }
        return value;
    };
    const root = entries(u32(start + 4));
    const exifAt = root.get(0x8769);
    if (exifAt && exifAt.type === 4) {
        const exif = entries(u32(exifAt.at));
        out.time = ascii(exif.get(0x9003)) || ascii(exif.get(0x9004));
        out.offset = ascii(exif.get(0x9011)) || ascii(exif.get(0x9012));
    }
    const gpsAt = root.get(0x8825);
    if (gpsAt && gpsAt.type === 4) {
        const gps = entries(u32(gpsAt.at));
        const lat = degrees(gps.get(2)) * (ascii(gps.get(1)) === 'S' ? -1 : 1);
        const lng = degrees(gps.get(4)) * (ascii(gps.get(3)) === 'W' ? -1 : 1);
        if (isFinite(lat) && isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && (lat !== 0 || lng !== 0)) {
            out.lat = lat;
            out.lng = lng;
        }
    }
}

export function palmSignExifStampLines(exif: PalmSignExif) {
    const m = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(exif && typeof exif.time === 'string' ? exif.time : '');
    if (!m) return [];
    const [year, month, day, hour, minute, second] = m.slice(1).map(Number);
    if (year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) return [];
    const fix = isFinite(exif.lat) && isFinite(exif.lng) ? { lat: exif.lat, lng: exif.lng, at: 0 } : null;
    const zone = /^([+-])(\d{2}):(\d{2})$/.exec(typeof exif.offset === 'string' ? exif.offset : '');
    if (zone) {
        const shift = (zone[1] === '-' ? -1 : 1) * (Number(zone[2]) * 60 + Number(zone[3])) * 60000;
        return palmSignStampLines(Date.UTC(year, month - 1, day, hour, minute, second) - shift, fix);
    }
    const lines = [m[1] + '-' + m[2] + '-' + m[3] + ' ' + m[4] + ':' + m[5] + ':' + m[6]];
    if (fix) lines.push(fix.lat.toFixed(5) + ', ' + fix.lng.toFixed(5));
    return lines;
}

async function fileExifStampLines(file: File) {
    try {
        return palmSignExifStampLines(readPhotoExif(await file.slice(0, PALM_SIGN_EXIF_READ_BYTES).arrayBuffer()));
    } catch { return []; }
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

export function palmSignFramePhoto(canvas = frame(), lines?: string[]) {
    if (!canvas) return '';
    try { stampPalmSignPhoto(canvas, lines || palmSignStampLines(getServerNow(), palmSignCurrentFix())); } catch {}
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

export async function palmSignPhotoFromFile(file: File, match: PalmSignMatch, source: 'camera' | 'gallery' = 'camera') {
    if (!file.type.startsWith('image/') || file.size > 20000000) throw new Error('image');
    const lines = source === 'gallery' ? await fileExifStampLines(file) : undefined;
    const url = URL.createObjectURL(file);
    try {
        const img = await new Promise<HTMLImageElement>((resolve, reject) => loadScratchImage(url, resolve, reject));
        const decoded = await palmSignDecodeImage(img, match);
        const data = palmSignFramePhoto(decoded.canvas, lines);
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
    let settle: () => void = () => {};
    palmSignCameraStart.settled = new Promise<void>((resolve) => { settle = resolve; });
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
            settle();
            if (!active()) { if (owned) stream?.getTracks().forEach((track) => track.stop()); return; }
            await attachPalmSignStream(stream);
            if (active()) void scan();
        } catch { settle(); if (owned) stream?.getTracks().forEach((track) => track.stop()); if (active()) onError(); }
    })();
    return () => {
        cancelled = true;
        settle();
        if (timer) clearTimeout(timer);
        if (owned) stream?.getTracks().forEach((track) => track.stop());
        void attachPalmSignStream(null);
    };
}
