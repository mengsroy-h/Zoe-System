import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { scanState } from '../src/core/state';
import { PALM_SIGN_IMAGE_DIMS, PALM_SIGN_LIVE_DEEP_EVERY, palmSignDecodeImage, palmSignNativeDetector, palmSignPickCode, startPalmSignCamera } from '../src/services/palm-sign-camera';
import { readCanvasSymbols } from '../src/services/scan-engine';
import { attachPalmSignStream, videoElement } from '../src/app/refs';
import { noteAppLockExcuse } from '../src/features/app-lock';
import { createScratchCanvas } from '../src/platform/document-io';
vi.mock('../src/features/app-lock', () => ({ noteAppLockExcuse: vi.fn() }));
vi.mock('../src/services/network', () => ({ withTimeout: (work: Promise<unknown>) => work }));
vi.mock('../src/core/state', () => ({ scanState: { currentStream: null, codeReader: null, nativeDetector: null } }));
vi.mock('../src/app/refs', () => ({ videoElement: vi.fn(), attachPalmSignStream: vi.fn(async () => {}) }));
vi.mock('../src/platform/document-io', () => ({ createScratchCanvas: vi.fn(), loadScratchImage: vi.fn() }));
vi.mock('../src/services/scan-engine', () => ({ initScanEngine: vi.fn(), readCanvasSymbols: vi.fn(async () => []),
    buildReaderOptions: (tryHarder: boolean, formats: string[]) => ({ formats, tryHarder, maxNumberOfSymbols: 1 }) }));
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
it('Android (BarcodeDetector) ៖ Sign សួរ code_128 + qr_code ពេលប្រព័ន្ធគាំទ្រ ➜ QR លេខកញ្ចប់ទទួល · QR ផ្សេងមិនរាប់', async () => {
    const formats: string[][] = [];
    const detect = vi.fn(async () => [{ format: 'qr_code', rawValue: 'https://earn.example/app' }, { format: 'qr_code', rawValue: OWN }]);
    class FakeDetector {
        static getSupportedFormats = async () => ['code_128', 'qr_code', 'ean_13'];
        constructor(opts: { formats: string[] }) { formats.push(opts.formats); }
        detect = detect;
    }
    vi.stubGlobal('BarcodeDetector', FakeDetector);
    scanState.nativeDetector = { detect: vi.fn(async () => []) };
    const onScan = vi.fn();
    const close = startPalmSignCamera(onScan, vi.fn(), () => true, known);
    await vi.waitFor(() => expect(onScan).toHaveBeenCalledWith(OWN, 'frame-1'));
    close();
    expect(formats).toEqual([['code_128', 'qr_code']]);
    expect(readCanvasSymbols).not.toHaveBeenCalled();
});
it('Android ប្រព័ន្ធមិនគាំទ្រ qr_code ➜ ប្រើ detector Code128 ដើម (ZXing នៅជួយ QR)', async () => {
    class OldDetector { static getSupportedFormats = async () => ['code_128']; constructor() { throw new Error('must not build'); } }
    vi.stubGlobal('BarcodeDetector', OldDetector);
    const base = { detect: vi.fn(async () => []) };
    scanState.nativeDetector = base;
    expect(await palmSignNativeDetector()).toBe(base);
});
