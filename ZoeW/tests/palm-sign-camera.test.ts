import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { scanState } from '../src/core/state';
import {
    PALM_SIGN_FIX_MAX_ACCURACY_M, PALM_SIGN_FIX_MAX_AGE_MS, PALM_SIGN_IMAGE_DIMS, PALM_SIGN_LIVE_DEEP_EVERY, PALM_SIGN_STAMP_COLOR, notePalmSignPosition,
    palmSignCurrentFix, palmSignDecodeImage, palmSignLocation, palmSignPickCode, palmSignStampLines, stampPalmSignPhoto, startPalmSignCamera, startPalmSignLocation
} from '../src/services/palm-sign-camera';
import { readCanvasSymbols } from '../src/services/scan-engine';
import { attachPalmSignStream, videoElement } from '../src/app/refs';
import { noteAppLockExcuse } from '../src/features/app-lock';
import { createScratchCanvas } from '../src/platform/document-io';
vi.mock('../src/features/app-lock', () => ({ noteAppLockExcuse: vi.fn() }));
vi.mock('../src/core/clock', () => ({ getServerNow: () => Date.now() }));
vi.mock('../src/services/network', () => ({ withTimeout: (work: Promise<unknown>) => work }));
vi.mock('../src/core/state', () => ({ scanState: { currentStream: null, codeReader: null, nativeDetector: null } }));
vi.mock('../src/app/refs', () => ({ videoElement: vi.fn(), attachPalmSignStream: vi.fn(async () => {}) }));
vi.mock('../src/platform/document-io', () => ({ createScratchCanvas: vi.fn(), loadScratchImage: vi.fn() }));
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
        getContext: () => ({ drawImage: () => {}, save: () => {}, restore: () => {}, strokeText: () => {}, fillText: (t: string) => draws.push(t) }),
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
