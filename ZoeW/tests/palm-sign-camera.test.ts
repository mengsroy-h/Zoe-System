import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { scanState } from '../src/core/state';
import {
    PALM_SIGN_FIX_MAX_ACCURACY_M, PALM_SIGN_FIX_MAX_AGE_MS, PALM_SIGN_IMAGE_DIMS, PALM_SIGN_LIVE_DEEP_EVERY, PALM_SIGN_STAMP_COLOR, PALM_SIGN_STAMP_SIZE, notePalmSignPosition,
    PALM_SIGN_FRESH_SHOT_MS, palmSignCurrentFix, palmSignDecodeImage, palmSignExifShot, palmSignFileStampLines, palmSignLocation, palmSignPhotoFromFile, palmSignPickCode,
    palmSignStampLines, readPhotoExif,
    capturePalmSignPhoto, loadPalmSignStampFont, stampPalmSignPhoto, startPalmSignCamera, startPalmSignLocation
} from '../src/services/palm-sign-camera';
import { readCanvasSymbols } from '../src/services/scan-engine';
import { attachPalmSignStream, videoElement } from '../src/app/refs';
import { noteAppLockExcuse } from '../src/features/app-lock';
import { createScratchCanvas, loadScratchImage } from '../src/platform/document-io';
vi.mock('../src/features/app-lock', () => ({ noteAppLockExcuse: vi.fn() }));
vi.mock('../src/core/clock', () => ({ getServerNow: () => Date.now() }));
vi.mock('../src/services/network', () => ({ withTimeout: (work: Promise<unknown>) => work }));
vi.mock('../src/core/state', () => ({ scanState: { currentStream: null, codeReader: null, nativeDetector: null } }));
vi.mock('../src/app/refs', () => ({ videoElement: vi.fn(), attachPalmSignStream: vi.fn(async () => {}) }));
vi.mock('../src/platform/document-io', async (actual) => ({ ...(await actual<any>()), createScratchCanvas: vi.fn(), loadScratchImage: vi.fn() }));
vi.mock('../src/services/scan-engine', () => ({ initScanEngine: vi.fn(), readCanvasSymbols: vi.fn(async () => []) }));
let stopTrack: ReturnType<typeof vi.fn>;
let stream: MediaStream;
let frameNumber: number;
beforeEach(() => {
    vi.mocked(noteAppLockExcuse).mockClear();
    stopTrack = vi.fn();
    stream = { getTracks: () => [{ stop: stopTrack }], getVideoTracks: () => [{ readyState: 'live' }] } as any;
    scanState.currentStream = null;
    scanState.codeReader = null;
    scanState.nativeDetector = null;
    frameNumber = 1;
    palmSignLocation.fix = null; palmSignLocation.watch = null; palmSignLocation.users = 0;
    vi.mocked(videoElement).mockReturnValue({ readyState: 2, videoWidth: 1920, videoHeight: 1080 } as any);
    vi.mocked(attachPalmSignStream).mockClear();
    vi.mocked(readCanvasSymbols).mockReset().mockResolvedValue([]);
    vi.mocked(createScratchCanvas).mockImplementation(() => {
        let captured = 0;
        return { width: 0, height: 0, getContext: () => ({ drawImage: () => { captured = frameNumber; } }),
            toDataURL: () => 'data:image/jpeg;base64,frame-' + captured } as any;
    });
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn(async () => stream) } });
});
afterEach(() => { vi.unstubAllGlobals(); scanState.currentStream = null; scanState.nativeDetector = null; });
it('រូបចាប់ពី frame ដដែលនឹង Barcode ទោះ decoder ឆ្លើយក្រោយ camera ប្តូរ frame', async () => {
    let resolve!: (value: unknown) => void;
    scanState.nativeDetector = { detect: vi.fn(() => new Promise((yes) => { resolve = yes; })) };
    const onScan = vi.fn();
    const close = startPalmSignCamera(onScan, vi.fn());
    await vi.waitFor(() => expect(scanState.nativeDetector.detect).toHaveBeenCalledOnce());
    frameNumber = 2;
    resolve([{ rawValue: '77130500000012' }]);
    await vi.waitFor(() => expect(onScan).toHaveBeenCalledWith('77130500000012', 'frame-1'));
    close();
    expect(stopTrack).toHaveBeenCalledOnce();
    expect(attachPalmSignStream).toHaveBeenLastCalledWith(null);
});
it('បិទផ្ទាំងមុន permission ឆ្លើយ ➜ បិទ stream ថ្មី និងមិនស្កេន', async () => {
    let resolve!: (value: MediaStream) => void;
    vi.mocked(navigator.mediaDevices.getUserMedia).mockReturnValue(new Promise((yes) => { resolve = yes; }));
    const onScan = vi.fn();
    const close = startPalmSignCamera(onScan, vi.fn());
    close();
    resolve(stream);
    await vi.waitFor(() => expect(stopTrack).toHaveBeenCalledOnce());
    expect(onScan).not.toHaveBeenCalled();
    expect(attachPalmSignStream).not.toHaveBeenCalledWith(stream);
});
it('ខ្ចី stream កាមេរ៉ាដែលបើករួច ➜ បិទផ្ទាំងមិនសម្លាប់កាមេរ៉ាស្កេនដើម', async () => {
    scanState.currentStream = stream;
    const close = startPalmSignCamera(vi.fn(), vi.fn());
    await vi.waitFor(() => expect(attachPalmSignStream).toHaveBeenCalledWith(stream));
    close();
    expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
    expect(noteAppLockExcuse).not.toHaveBeenCalled();
    expect(stopTrack).not.toHaveBeenCalled();
});
it('Barcode ដដែលនៅមុខកាមេរ៉ា ហើយមានរូបរួច ➜ មិនបង្កើត JPEG ឡើងវិញរៀងរាល់ frame', async () => {
    scanState.nativeDetector = { detect: vi.fn(async () => [{ rawValue: '77130500000012' }]) };
    const encoded = vi.fn(() => 'data:image/jpeg;base64,frame');
    vi.mocked(createScratchCanvas).mockImplementation(() => ({ width: 0, height: 0, getContext: () => ({ drawImage: () => {} }), toDataURL: encoded }) as any);
    const onScan = vi.fn();
    const close = startPalmSignCamera(onScan, vi.fn(), (code) => code !== '77130500000012');
    await vi.waitFor(() => expect(vi.mocked(scanState.nativeDetector.detect).mock.calls.length).toBeGreaterThan(2), { timeout: 3000 });
    close();
    expect(encoded).not.toHaveBeenCalled();
    expect(onScan).not.toHaveBeenCalled();
});

const OWN = '77130500000012';
const known = (text: string) => text === OWN ? OWN : '';
it('⛔ QR ផ្សេងលើបុង (SCAN TO EARN) មិនអើពើ · QR លេខកញ្ចប់ទទួល · Code128 ផ្សេងនៅប្រាប់ «មិនមែនកញ្ចប់នេះ»', () => {
    expect(palmSignPickCode([{ format: 'QRCode', text: 'https://earn.example/app' }], known)).toBe('');
    expect(palmSignPickCode([{ format: 'QRCode', text: 'https://earn.example/app' }, { format: 'QRCode', text: OWN }], known)).toBe(OWN);
    expect(palmSignPickCode([{ format: 'Code128', text: '99990000000001' }, { format: 'QRCode', text: 'promo' }], known)).toBe('99990000000001');
    expect(palmSignPickCode([{ format: 'Code128', text: OWN, isValid: false }], known)).toBe('');
    expect(palmSignPickCode(null, known)).toBe('');
});
it('iOS (គ្មាន BarcodeDetector) ៖ frame ធម្មតាអានលឿន (គ្មាន tryHarder · Code128 + QR · ច្រើននិមិត្ត) · រៀងរាល់ ' + 'N frame អានស៊ីជម្រៅ', async () => {
    const close = startPalmSignCamera(vi.fn(), vi.fn(), () => true, known);
    await vi.waitFor(() => expect(vi.mocked(readCanvasSymbols).mock.calls.length).toBeGreaterThanOrEqual(PALM_SIGN_LIVE_DEEP_EVERY), { timeout: 3000 });
    close();
    const options = vi.mocked(readCanvasSymbols).mock.calls.slice(0, PALM_SIGN_LIVE_DEEP_EVERY).map((call) => call[0] as any);
    expect(options.every((o) => o.formats.join() === 'Code128,QRCode' && o.maxNumberOfSymbols > 1)).toBe(true);
    expect(options.map((o) => o.tryHarder)).toEqual([...Array(PALM_SIGN_LIVE_DEEP_EVERY - 1).fill(false), true]);
});
it('iOS ៖ QR លេខកញ្ចប់ក្នុង frame ➜ onScan ជាមួយលេខកញ្ចប់ និងរូប frame', async () => {
    vi.mocked(readCanvasSymbols).mockResolvedValue([{ format: 'QRCode', text: 'promo' }, { format: 'QRCode', text: OWN }]);
    const onScan = vi.fn();
    const close = startPalmSignCamera(onScan, vi.fn(), () => true, known);
    await vi.waitFor(() => expect(onScan).toHaveBeenCalledWith(OWN, 'frame-1'));
    close();
});
it('រូបពី Gallery ៖ អានជាមួយរូបធំ (≤ ' + PALM_SIGN_IMAGE_DIMS.at(-1) + 'px) នៅពេលទំហំតូចអានមិនឃើញ · រូបផ្ញើ ZTO នៅ ≤ 1280px', async () => {
    const sizes: number[] = [];
    vi.mocked(createScratchCanvas).mockImplementation(() => ({ width: 0, height: 0, getContext: () => ({ drawImage: () => {} }), toDataURL: () => 'data:image/jpeg;base64,x' }) as any);
    vi.mocked(readCanvasSymbols).mockImplementation(async (_o, canvas: any) => { sizes.push(Math.max(canvas.width, canvas.height)); return sizes.length === 2 ? [{ format: 'Code128', text: OWN }] : []; });
    const out = await palmSignDecodeImage({ naturalWidth: 4032, naturalHeight: 3024 } as any, known);
    expect(out.code).toBe(OWN);
    expect(sizes).toEqual(PALM_SIGN_IMAGE_DIMS);
    expect(Math.max(out.canvas.width, out.canvas.height)).toBe(1280);
    sizes.length = 0;
    vi.mocked(readCanvasSymbols).mockImplementation(async (_o, canvas: any) => { sizes.push(Math.max(canvas.width, canvas.height)); return []; });
    expect((await palmSignDecodeImage({ naturalWidth: 1200, naturalHeight: 900 } as any, known)).code).toBe('');
    expect(sizes).toEqual([1200]);
});
it('Android (BarcodeDetector code_128 + qr_code) ៖ QR លេខកញ្ចប់ទទួល · QR ផ្សេងមិនរាប់ · មិនរត់ ZXing', async () => {
    scanState.nativeDetector = { detect: vi.fn(async () => [{ format: 'qr_code', rawValue: 'https://earn.example/app' }, { format: 'qr_code', rawValue: OWN }]) };
    const onScan = vi.fn();
    const close = startPalmSignCamera(onScan, vi.fn(), () => true, known);
    await vi.waitFor(() => expect(onScan).toHaveBeenCalledWith(OWN, 'frame-1'));
    close();
    expect(readCanvasSymbols).not.toHaveBeenCalled();
});
it('📍 រូប Sign មានម៉ោង (Asia/Phnom_Penh) និងកូអរដោនេ ដូច ZTO Palm ៖ ពណ៌ក្រហមនៅជ្រុងក្រោមឆ្វេង · ទីតាំងចាស់/មិនច្បាស់ ➜ តែម៉ោង', () => {
    const at = Date.UTC(2026, 9, 15, 5, 3, 43);
    expect(palmSignStampLines(at, { lat: 12.300114, lng: 105.419213, at: Date.now() })).toEqual(['2026-10-15 12:03:43', '12.30011, 105.41921']);
    expect(palmSignStampLines(at, null)).toEqual(['2026-10-15 12:03:43']);
    palmSignLocation.fix = null;
    notePalmSignPosition({ coords: { latitude: 12.3, longitude: 105.4, accuracy: PALM_SIGN_FIX_MAX_ACCURACY_M + 1 } });
    expect(palmSignCurrentFix()).toBeNull();
    notePalmSignPosition({ coords: { latitude: 95, longitude: 105.4, accuracy: 10 } });
    expect(palmSignCurrentFix()).toBeNull();
    notePalmSignPosition({ coords: { latitude: 12.3, longitude: 105.4, accuracy: 2500 } });
    expect(palmSignCurrentFix(), 'Android «ទីតាំងប្រហាក់ប្រហែល» (≈ ២–៣ គ.ម.) ➜ នៅមានកូអរដោនេ ដូច ZTO Palm').toMatchObject({ lat: 12.3, lng: 105.4 });
    notePalmSignPosition({ coords: { latitude: 12.3, longitude: 105.4, accuracy: 10 } });
    expect(palmSignCurrentFix()).toMatchObject({ lat: 12.3, lng: 105.4 });
    palmSignLocation.fix!.at = Date.now() - PALM_SIGN_FIX_MAX_AGE_MS - 1;
    expect(palmSignCurrentFix()).toBeNull();
    const calls: any[] = [];
    const context = new Proxy({}, { get: (_t, key) => (key in ({} as any) ? undefined : (...args: any[]) => calls.push([key, ...args])), set: (_t, key, value) => { calls.push(['set', key, value]); return true; } });
    const canvas = { width: 1280, height: 960, getContext: () => context };
    expect(stampPalmSignPhoto(canvas, ['2026-10-15 12:03:43', '12.30011, 105.41921'])).toBe(true);
    const texts = calls.filter((c) => c[0] === 'fillText');
    expect(texts.map((c) => c[1])).toEqual(['2026-10-15 12:03:43', '12.30011, 105.41921']);
    expect(texts[0][2]).toBeLessThan(canvas.width / 4);
    expect(texts[1][3]).toBeGreaterThan(canvas.height * 0.85);
    expect(calls).toContainEqual(['set', 'fillStyle', PALM_SIGN_STAMP_COLOR]);
    const font = calls.find((c) => c[0] === 'set' && c[1] === 'font')[2];
    expect(font).toMatch(/^700 \d+(?:\.\d+)?px /);
    expect(Number(/([\d.]+)px/.exec(font)![1])).toBeCloseTo(960 * PALM_SIGN_STAMP_SIZE);
    expect(calls.some((c) => c[0] === 'strokeText')).toBe(false);
    expect(stampPalmSignPhoto({ width: 10, height: 10, getContext: () => ({ drawImage: () => {} }) }, ['x'])).toBe(false);
    expect(stampPalmSignPhoto(null, ['x'])).toBe(false);
});
it('📍 ទីតាំង ៖ watch តែពេលផ្ទាំង Sign បើក · បិទ ➜ clearWatch · មិនទាន់អនុញ្ញាត ➜ លើកលែងការចាក់សោ (Android ផ្អាក Activity ពេលសួរ)', async () => {
    const watchPosition = vi.fn(() => 7);
    const clearWatch = vi.fn();
    vi.stubGlobal('navigator', { geolocation: { watchPosition, clearWatch }, permissions: { query: vi.fn(async () => ({ state: 'prompt' })) } });
    palmSignLocation.watch = null;
    palmSignLocation.users = 0;
    const stop = startPalmSignLocation();
    await vi.waitFor(() => expect(watchPosition).toHaveBeenCalledOnce());
    expect(noteAppLockExcuse).toHaveBeenCalledOnce();
    const second = startPalmSignLocation();
    second();
    expect(clearWatch).not.toHaveBeenCalled();
    stop();
    stop();
    expect(clearWatch).toHaveBeenCalledOnce();
    expect(clearWatch).toHaveBeenCalledWith(7);
    vi.mocked(noteAppLockExcuse).mockClear();
    vi.stubGlobal('navigator', { geolocation: { watchPosition, clearWatch }, permissions: { query: vi.fn(async () => ({ state: 'granted' })) } });
    const again = startPalmSignLocation();
    await vi.waitFor(() => expect(watchPosition).toHaveBeenCalledTimes(2));
    expect(noteAppLockExcuse).not.toHaveBeenCalled();
    again();
    const closedEarly = startPalmSignLocation();
    closedEarly();
    await new Promise((r) => setTimeout(r, 0));
    expect(watchPosition).toHaveBeenCalledTimes(2);
    vi.stubGlobal('navigator', {});
    const none = startPalmSignLocation();
    none();
});
it('📍 រូបពីកាមេរ៉ា ៖ stamp លើ frame មុនអ៊ិនកូដ JPEG', async () => {
    const draws: string[] = [];
    vi.mocked(createScratchCanvas).mockImplementation(() => ({ width: 0, height: 0,
        getContext: () => ({ drawImage: () => {}, save: () => {}, restore: () => {}, fillRect: () => {}, strokeText: () => {}, fillText: (t: string) => draws.push(t) }),
        toDataURL: () => 'data:image/jpeg;base64,stamped' } as any));
    palmSignLocation.fix = { lat: 12.30011, lng: 105.41921, at: Date.now() };
    scanState.nativeDetector = { detect: vi.fn(async () => [{ rawValue: '77130500000012' }]) };
    const onScan = vi.fn();
    const close = startPalmSignCamera(onScan, vi.fn());
    await vi.waitFor(() => expect(onScan).toHaveBeenCalled());
    close();
    expect(draws[0]).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    expect(draws[1]).toBe('12.30011, 105.41921');
});
it('📍 APK ៖ សួរសិទ្ធិទីតាំងតែក្រោយការស្នើកាមេរ៉ាចប់ (Capacitor មាន permissionListener តែមួយ ៖ ស្នើព្រមគ្នា ➜ មួយបាត់)', async () => {
    let grant!: (s: MediaStream) => void;
    const watchPosition = vi.fn(() => 3);
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn(() => new Promise((yes) => { grant = yes; })) },
        geolocation: { watchPosition, clearWatch: vi.fn() }, permissions: { query: vi.fn(async () => ({ state: 'prompt' })) } });
    palmSignLocation.watch = null;
    palmSignLocation.users = 0;
    const stopLocation = startPalmSignLocation();
    const closeCamera = startPalmSignCamera(vi.fn(), vi.fn());
    await new Promise((r) => setTimeout(r, 30));
    expect(watchPosition, 'កាមេរ៉ាកំពុងសួរ ➜ មិនទាន់សួរទីតាំង').not.toHaveBeenCalled();
    grant(stream);
    await vi.waitFor(() => expect(watchPosition).toHaveBeenCalledOnce());
    closeCamera();
    stopLocation();
});
function exifJpeg(o: { time?: string; offset?: string; gps?: [number, number]; little?: boolean; app0?: boolean; pointer?: number } = {}) {
    const le = o.little !== false;
    const tiff: number[] = new Array(198).fill(0);
    const put16 = (at: number, v: number) => { const b = [v & 255, (v >> 8) & 255]; if (!le) b.reverse(); tiff[at] = b[0]; tiff[at + 1] = b[1]; };
    const put32 = (at: number, v: number) => { const b = [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255]; if (!le) b.reverse(); b.forEach((x, i) => { tiff[at + i] = x; }); };
    const entry = (at: number, tag: number, type: number, count: number, value: number) => { put16(at, tag); put16(at + 2, type); put32(at + 4, count); put32(at + 8, value); };
    const text = (at: number, s: string) => { for (let i = 0; i < s.length; i++) tiff[at + i] = s.charCodeAt(i); };
    const rational = (at: number, value: number) => {
        const deg = Math.floor(value);
        const min = Math.floor((value - deg) * 60);
        const sec = Math.round(((value - deg) * 60 - min) * 60 * 10000);
        [[deg, 1], [min, 1], [sec, 10000]].forEach(([n, d], i) => { put32(at + i * 8, n); put32(at + i * 8 + 4, d); });
    };
    text(0, le ? 'II' : 'MM');
    put16(2, 42);
    put32(4, 8);
    put16(8, 2);
    entry(10, 0x8769, o.pointer || 4, 1, 38);
    entry(22, 0x8825, o.pointer || 4, 1, 68);
    put16(38, 2);
    entry(40, 0x9003, 2, 20, 122);
    entry(52, o.offset ? 0x9011 : 0x9999, 2, 7, 142);
    put16(68, 4);
    const [lat, lng] = o.gps || [0, 0];
    entry(70, 1, 2, 2, 0);
    text(78, lat < 0 ? 'S' : 'N');
    entry(82, 2, 5, 3, 150);
    entry(94, 3, 2, 2, 0);
    text(102, lng < 0 ? 'W' : 'E');
    entry(106, 4, 5, 3, 174);
    text(122, o.time || '');
    text(142, o.offset || '');
    rational(150, Math.abs(lat));
    rational(174, Math.abs(lng));
    const app1 = [0xff, 0xe1, ((tiff.length + 8) >> 8) & 255, (tiff.length + 8) & 255, 0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff];
    const app0 = o.app0 ? [0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0] : [];
    return new Uint8Array([0xff, 0xd8, ...app0, ...app1, 0xff, 0xda, 0, 2]).buffer;
}

const palmSignExifStampLines = (exif: any) => palmSignExifShot(exif).lines;

it('🖼 រូបពី Gallery ៖ ស្លាកពីព័ត៌មានក្នុងរូប (EXIF ម៉ោងថត + GPS) មិនមែនម៉ោង/ទីតាំងពេលជ្រើស · គ្មានម៉ោងក្នុងរូប ➜ គ្មានស្លាក (មិនដាក់ម៉ោងខុស)', () => {
    const shot = readPhotoExif(exifJpeg({ time: '2026:10:17 08:15:30', offset: '+07:00', gps: [12.300114, 105.419213], app0: true }));
    expect(shot.time).toBe('2026:10:17 08:15:30');
    expect(shot.offset).toBe('+07:00');
    expect(palmSignExifStampLines(shot)).toEqual(['2026-10-17 08:15:30', '12.30011, 105.41921']);
    expect(palmSignExifStampLines(readPhotoExif(exifJpeg({ time: '2026:10:17 08:15:30', offset: '+00:00', gps: [12.300114, 105.419213], little: false }))),
        'ម៉ោងតំបន់ផ្សេង ➜ ម៉ោងភ្នំពេញ · byte order MM').toEqual(['2026-10-17 15:15:30', '12.30011, 105.41921']);
    expect(palmSignExifStampLines(readPhotoExif(exifJpeg({ time: '2026:10:17 08:15:30', gps: [-33.5, -70.25] }))), 'គ្មាន offset ➜ ម៉ោងនាឡិការូបដដែល · S/W ➜ អវិជ្ជមាន')
        .toEqual(['2026-10-17 08:15:30', '-33.50000, -70.25000']);
    expect(palmSignExifStampLines(readPhotoExif(exifJpeg({ time: '2026:10:17 08:15:30' }))), 'GPS 0,0 (Android/iOS លុបទីតាំង) ➜ តែម៉ោង').toEqual(['2026-10-17 08:15:30']);
    expect(palmSignExifStampLines(readPhotoExif(exifJpeg({ time: '2026:10:17 08:15:30', gps: [12.3, 105.4], pointer: 13 }))), 'pointer ប្រភេទ IFD (13)')
        .toEqual(['2026-10-17 08:15:30', '12.30000, 105.40000']);
    expect(palmSignExifStampLines(readPhotoExif(exifJpeg({ time: '0000:00:00 00:00:00' })))).toEqual([]);
    expect(palmSignExifStampLines(readPhotoExif(exifJpeg({ gps: [12.3, 105.4] }))), 'គ្មានម៉ោង ➜ គ្មានស្លាក').toEqual([]);
    for (const bad of [new ArrayBuffer(0), new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer, exifJpeg({ time: '2026:10:17 08:15:30' }).slice(0, 40), null, undefined, 'x']) {
        expect(palmSignExifStampLines(readPhotoExif(bad as any)), 'ឯកសារខូច ➜ គ្មានស្លាក · មិនបោះកំហុស').toEqual([]);
    }
    const broken = new Uint8Array(exifJpeg({ time: '2026:10:17 08:15:30', gps: [12.3, 105.4] }));
    broken[10 + 8 + 4] = 0xff;
    broken[10 + 8 + 5] = 0xff;
    expect(() => readPhotoExif(broken.buffer)).not.toThrow();
});

it('🖼/📷 ៖ Gallery រក្សា EXIF ពេញលេញ · គ្មាន EXIF ➜ ពេលបញ្ចូល + GPS បច្ចុប្បន្ន · កាមេរ៉ាថ្មី ➜ ពេល/GPS បច្ចុប្បន្ន', async () => {
    const texts: string[] = [];
    const context = new Proxy({}, { get: (_t, key) => (key === 'fillText' ? (s: string) => texts.push(s) : () => {}), set: () => true });
    vi.mocked(createScratchCanvas).mockImplementation(() => ({ width: 0, height: 0, getContext: () => context, toDataURL: () => 'data:image/jpeg;base64,x' }) as any);
    vi.mocked(loadScratchImage).mockImplementation((_url: string, done: any) => done({ naturalWidth: 1200, naturalHeight: 900 }));
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} }));
    palmSignLocation.fix = { lat: 11.55, lng: 104.92, at: Date.now() };
    const file = (bytes: ArrayBuffer) => new File([bytes], 'p.jpg', { type: 'image/jpeg' });
    const shot = exifJpeg({ time: '2026:10:01 09:00:00', offset: '+07:00', gps: [12.300114, 105.419213] });
    await palmSignPhotoFromFile(file(shot), known, 'gallery');
    expect(texts).toEqual(['2026-10-01 09:00:00', '12.30011, 105.41921']);
    texts.length = 0;
    await palmSignPhotoFromFile(file(new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0, 2]).buffer), known, 'gallery');
    expect(texts[0].slice(0, 10), 'Gallery គ្មាន EXIF ➜ ពេលបញ្ចូល').toBe(palmSignStampLines(Date.now(), null)[0].slice(0, 10));
    expect(texts[1]).toBe('11.55000, 104.92000');
    texts.length = 0;
    await palmSignPhotoFromFile(file(new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0, 2]).buffer), known, 'camera');
    expect(texts[0].slice(0, 10), '📷 ថតទើប ➜ ថ្ងៃនេះ (ម៉ោងឥឡូវ)').toBe(palmSignStampLines(Date.now(), null)[0].slice(0, 10));
    texts.length = 0;
    await palmSignPhotoFromFile(file(shot), known, 'camera');
    expect(texts, '📷 ប៉ុន្តែរូបចាស់ (file chooser) ➜ ស្លាក EXIF').toEqual(['2026-10-01 09:00:00', '12.30011, 105.41921']);
    texts.length = 0;
    await palmSignPhotoFromFile(file(new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0, 2]).buffer), known, 'camera');
    expect(texts[1]).toBe('11.55000, 104.92000');
});

it('📷 បើក file chooser (APK គ្មានសិទ្ធិកាមេរ៉ា ➜ Capacitor បើកកម្មវិធីជ្រើសឯកសារ) ៖ រូបចាស់ ➜ ស្លាក EXIF មិនមែនម៉ោងឥឡូវ · រូបថតទើប ➜ ម៉ោងឥឡូវ + ទីតាំងបច្ចុប្បន្ន', async () => {
    const zoneNow = (ms: number) => { const p = palmSignStampLines(ms, null)[0]; return p.slice(0, 10).replace(/-/g, ':') + p.slice(10); };
    const file = (bytes: ArrayBuffer, lastModified = Date.now()) => new File([bytes], 'p.jpg', { type: 'image/jpeg', lastModified });
    const old = exifJpeg({ time: '2026:10:01 09:00:00', offset: '+07:00', gps: [12.300114, 105.419213] });
    expect(await palmSignFileStampLines(file(old), 'camera'), 'រូបចាស់តាម 📷').toEqual(['2026-10-01 09:00:00', '12.30011, 105.41921']);
    const fresh = exifJpeg({ time: zoneNow(Date.now() - 60000), offset: '+07:00', gps: [12.3, 105.4] });
    expect(await palmSignFileStampLines(file(fresh), 'camera'), 'ថតមុន ១ នាទីមាន GPS ➜ រក្សា EXIF ដើម').toEqual(palmSignExifStampLines(readPhotoExif(fresh)));
    const freshNoZone = exifJpeg({ time: zoneNow(Date.now() - 60000) });
    expect(await palmSignFileStampLines(file(freshNoZone), 'camera'), 'គ្មាន offset ➜ យល់ថាម៉ោងភ្នំពេញ').toBeUndefined();
    const plain = new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0, 2]).buffer;
    expect(await palmSignFileStampLines(file(plain, Date.now() - 2 * PALM_SIGN_FRESH_SHOT_MS), 'camera'), 'គ្មាន EXIF · ឯកសារចាស់ ➜ គ្មានស្លាក').toEqual([]);
    expect(await palmSignFileStampLines(file(plain), 'camera'), 'គ្មាន EXIF · ឯកសារថ្មី ➜ ម៉ោងឥឡូវ').toBeUndefined();
    expect(await palmSignFileStampLines(file(fresh), 'gallery'), '🖼 ជានិច្ច EXIF').toEqual(palmSignExifStampLines(readPhotoExif(fresh)));
});

it('📍 ស្កេនលឿនជាង GPS ➜ រង់ចាំ fix ហើយ stamp លើ frame ដើម មុនទទួលរូប', async () => {
    let position!: (p: unknown) => void;
    const watchPosition = vi.fn((success) => { position = success; return 19; });
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn(async () => stream) },
        geolocation: { watchPosition, clearWatch: vi.fn() }, permissions: { query: vi.fn(async () => ({ state: 'granted' })) } });
    const texts: string[] = [];
    vi.mocked(createScratchCanvas).mockImplementation(() => {
        let shot = 0;
        return { width: 0, height: 0, getContext: () => ({ drawImage: () => { shot = frameNumber; }, save() {}, restore() {}, fillRect() {}, fillText: (s: string) => texts.push(s) }),
            toDataURL: () => 'data:image/jpeg;base64,frame-' + shot } as any;
    });
    scanState.nativeDetector = { detect: vi.fn(async () => [{ rawValue: OWN }]) };
    const onScan = vi.fn();
    const stopLocation = startPalmSignLocation();
    const close = startPalmSignCamera(onScan, vi.fn());
    try {
        await vi.waitFor(() => expect(watchPosition).toHaveBeenCalledOnce());
        await vi.waitFor(() => expect(scanState.nativeDetector.detect).toHaveBeenCalled());
        expect(onScan, 'មិនទទួលរូប timestamp តែមួយមុន GPS ឆ្លើយ').not.toHaveBeenCalled();
        frameNumber = 2;
        position({ coords: { latitude: 12.300114, longitude: 105.419213, accuracy: 25 } });
        await vi.waitFor(() => expect(onScan).toHaveBeenCalledWith(OWN, 'frame-1'));
        expect(texts).toContain('12.30011, 105.41921');
    } finally { close(); stopLocation(); }
});
it('📍 Permissions API ព្យួរ មិនត្រូវរារាំង watchPosition ទោះបានអនុញ្ញាត location', async () => {
    const watchPosition = vi.fn(() => 23);
    vi.stubGlobal('navigator', { geolocation: { watchPosition, clearWatch: vi.fn() }, permissions: { query: () => new Promise(() => {}) } });
    const stop = startPalmSignLocation();
    try { await vi.waitFor(() => expect(watchPosition).toHaveBeenCalledOnce(), { timeout: 1500 }); }
    finally { stop(); }
});
it('📍 អ្នកប្រើទី១បិទមុន watch ចាប់ផ្តើម តែទី២នៅបើក ➜ GPS នៅចាប់ផ្តើមតែមួយ', async () => {
    const watchPosition = vi.fn(() => 24);
    const clearWatch = vi.fn();
    vi.stubGlobal('navigator', { geolocation: { watchPosition, clearWatch }, permissions: { query: vi.fn(async () => ({ state: 'granted' })) } });
    const first = startPalmSignLocation(); const second = startPalmSignLocation(); first();
    try { await vi.waitFor(() => expect(watchPosition).toHaveBeenCalledOnce()); expect(clearWatch).not.toHaveBeenCalled(); }
    finally { second(); }
    expect(clearWatch).toHaveBeenCalledWith(24);
});
it('📷 EXIF រូបថតទើបមាន GPS ➜ រក្សាម៉ោង និងកូអរដោនេរូប ទោះ web GPS មិនទាន់ឆ្លើយ', async () => {
    const now = palmSignStampLines(Date.now() - 60000, null)[0];
    const bytes = exifJpeg({ time: now.slice(0, 10).replace(/-/g, ':') + now.slice(10), offset: '+07:00', gps: [12.3, 105.4] });
    const file = new File([bytes], 'fresh.jpg', { type: 'image/jpeg' });
    expect(await palmSignFileStampLines(file, 'camera')).toEqual([now, '12.30000, 105.40000']);
});

it('🖼 font ស្លាកដូច Palm APK ៖ ក្រហមសុទ្ធ និង bold របស់ Android ជាមួយទំហំបង្រួមតាមទទឹងរូប', () => {
    const calls: any[] = [];
    const context = new Proxy({}, { get: (_t, k) => k === 'measureText' ? (s: string) => ({ width: s.length * 40 }) : (...a: any[]) => calls.push([k, ...a]),
        set: (_t, k, v) => { calls.push(['set', k, v]); return true; } });
    expect(stampPalmSignPhoto({ width: 720, height: 1280, getContext: () => context }, ['2026-10-19 09:56:05', '12.30011,105.41921'])).toBe(true);
    expect(calls).toContainEqual(['set', 'fillStyle', '#ff0000']);
    const fonts = calls.filter((c) => c[0] === 'set' && c[1] === 'font').map((c) => c[2]);
    expect(fonts.every((s) => s.startsWith('700 ') && s.includes('ZoePalmStamp'))).toBe(true);
    expect(parseFloat(fonts.at(-1).slice(4))).toBeLessThan(0.045 * 1280);
    expect(calls.some((c) => c[0] === 'strokeText')).toBe(false);
});

it('📍 APK high accuracy អស់ពេល ➜ coarse fallback ទទួលកូអរដោនេមុន capture ចប់', async () => {
    let failed!: (error: { code: number }) => void;
    let coarse!: (position: unknown) => void;
    const watchPosition = vi.fn((_ok: unknown, no: (e: { code: number }) => void, _options: PositionOptions) => { failed = no; return 28; });
    const getCurrentPosition = vi.fn((ok: (p: unknown) => void, _no: unknown, _options: PositionOptions) => { coarse = ok; });
    vi.stubGlobal('navigator', { geolocation: { watchPosition, getCurrentPosition, clearWatch: vi.fn() }, permissions: { query: async () => ({ state: 'granted' }) } });
    const texts: string[] = [];
    const canvas = { width: 720, height: 1280, getContext: () => ({ save() {}, restore() {}, fillRect() {}, fillText: (s: string) => texts.push(s) }), toDataURL: () => 'data:image/jpeg;base64,coarse' };
    const stop = startPalmSignLocation();
    try {
        await vi.waitFor(() => expect(watchPosition).toHaveBeenCalledOnce());
        const pending = capturePalmSignPhoto(canvas as unknown as HTMLCanvasElement);
        failed({ code: 3 });
        expect(getCurrentPosition).toHaveBeenCalledOnce();
        expect(watchPosition.mock.calls[0][2].timeout).toBeLessThan(getCurrentPosition.mock.calls[0][2].timeout);
        coarse({ coords: { latitude: 12.3, longitude: 105.4, accuracy: 2500 } });
        await expect(pending).resolves.toBe('coarse');
        expect(texts).toContain('12.30000, 105.40000');
    } finally { stop(); }
});
it('📍 បដិសេធ location ➜ មិនបង្កើតកូអរដោនេ និងមិនសួរម្តងទៀតពី coarse fallback', async () => {
    let failed!: (error: { code: number }) => void;
    const getCurrentPosition = vi.fn();
    vi.stubGlobal('navigator', { geolocation: { watchPosition: (_ok, no) => { failed = no; return 29; }, getCurrentPosition, clearWatch: vi.fn() }, permissions: { query: async () => ({ state: 'granted' }) } });
    const stop = startPalmSignLocation();
    try {
        await vi.waitFor(() => expect(failed).toBeTypeOf('function'));
        failed({ code: 1 });
        expect(palmSignLocation.status).toBe('denied');
        expect(palmSignCurrentFix()).toBeNull();
        expect(getCurrentPosition).not.toHaveBeenCalled();
    } finally { stop(); }
});
it('🖼 FontFace constructor មិនដំណើរការ ➜ ការដាក់ត្រាមិនបរាជ័យ', async () => {
    vi.stubGlobal('document', { baseURI: 'https://localhost/', fonts: { add: vi.fn() } });
    const made = vi.fn();
    vi.stubGlobal('FontFace', class { constructor() { made(); throw new Error('font unavailable'); } });
    await expect(loadPalmSignStampFont()).resolves.toBeUndefined();
    expect(made).toHaveBeenCalledOnce();
});
