import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { scanState } from '../src/core/state';
import { startPalmSignCamera } from '../src/services/palm-sign-camera';
import { attachPalmSignStream, videoElement } from '../src/app/refs';
import { noteAppLockExcuse } from '../src/features/app-lock';
import { createScratchCanvas } from '../src/platform/document-io';
vi.mock('../src/features/app-lock', () => ({ noteAppLockExcuse: vi.fn() }));
vi.mock('../src/services/network', () => ({ withTimeout: (work: Promise<unknown>) => work }));
vi.mock('../src/core/state', () => ({ scanState: { currentStream: null, codeReader: null, nativeDetector: null } }));
vi.mock('../src/app/refs', () => ({ videoElement: vi.fn(), attachPalmSignStream: vi.fn(async () => {}) }));
vi.mock('../src/platform/document-io', () => ({ createScratchCanvas: vi.fn() }));
vi.mock('../src/services/scan-engine', () => ({ initScanEngine: vi.fn(), decodeBarcodeFromCanvasManual: vi.fn(async () => '') }));
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
