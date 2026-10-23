import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { scanState, uiState } from '../src/core/state';
import { stopCurrentStream } from '../src/features/daily-stats';
import { triggerScanAction } from '../src/features/scan-action';
import { startFastNativeScan } from '../src/services/camera';
import { resetLiveScanQuality, resetScanConfirm, startZxingVideoScan } from '../src/services/scan-engine';

vi.mock('../src/features/scan-action', () => ({
    triggerScanAction: vi.fn(), confirmPhone: vi.fn(), addOrUpdateEntry: vi.fn(),
    dropOptimisticBarcode: vi.fn(), notePhoneModalInput: vi.fn()
}));

const CODE = '77130500000012';
const frames: Array<(now: number) => unknown> = [];
const video: any = {
    requestVideoFrameCallback: (callback: (now: number) => unknown) => { frames.push(callback); },
    readyState: 4, HAVE_CURRENT_DATA: 2, videoWidth: 1280, videoHeight: 720, currentTime: 1
};
const canvas: any = {
    width: 1280, height: 240,
    getContext: () => ({ drawImage() {}, getImageData: () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 }) })
};
const stream = () => ({ getTracks: () => [{ stop: vi.fn(), enabled: true }] });
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

beforeEach(() => {
    frames.length = 0;
    vi.mocked(triggerScanAction).mockClear();
    scanState.currentStream = stream() as any;
    scanState.isCameraScanning = true;
    scanState.zxingLoopActive = false;
    scanState.nativeLoopActive = false;
    scanState.lastScannedCode = '';
    scanState.lastScanTime = 0;
    scanState.liveScanRound = 0;
    scanState.scanEngineDown = false;
    scanState.codeReader = {};
    scanState.liveScanCodeReader = {};
    scanState.ownCaptureCanvas = canvas;
    scanState.ownCaptureCtx = canvas.getContext();
    scanState.ownQrCanvas = canvas;
    scanState.ownQrCtx = canvas.getContext();
    video.currentTime = 1;
    uiState.isModalOpen = false;
    resetScanConfirm();
    resetLiveScanQuality();
});

afterEach(() => {
    stopCurrentStream();
    scanState.nativeDetector = null;
    scanState.ownCaptureCanvas = null;
    scanState.ownCaptureCtx = null;
    scanState.ownQrCanvas = null;
    scanState.ownQrCtx = null;
    frames.length = 0;
    vi.unstubAllGlobals();
});

describe.each(['ZXing', 'native'] as const)('កាមេរ៉ា %s ៖ លទ្ធផលពី stream ចាស់', (kind) => {
    function installReader(read: ReturnType<typeof vi.fn>) {
        vi.stubGlobal('ZXingWASM', { readBarcodes: read });
        vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ close: vi.fn() })));
        scanState.nativeDetector = { detect: read };
    }
    const result = () => kind === 'native' ? [{ rawValue: CODE, format: 'code_128' }] : [{ text: CODE, format: 'Code128' }];
    const start = () => kind === 'native' ? startFastNativeScan(video) : startZxingVideoScan(video);

    it('បិទ រួចបើកកាមេរ៉ាវិញ ➜ លទ្ធផលចាស់មកយឺត មិនបញ្ជាក់លេខពី frame ថ្មីតែមួយ', async () => {
        let releaseOld: (value: any[]) => void = () => {};
        const read = vi.fn().mockImplementationOnce(() => new Promise<any[]>((resolve) => { releaseOld = resolve; }))
            .mockImplementation(async () => result());
        installReader(read);
        start();
        expect(frames).toHaveLength(1);
        frames.shift()!(1000);
        await flush();
        expect(read).toHaveBeenCalledTimes(1);
        stopCurrentStream();
        frames.length = 0;
        scanState.currentStream = stream() as any;
        scanState.isCameraScanning = true;
        start();
        frames.shift()!(1100);
        await flush();
        expect(read).toHaveBeenCalledTimes(2);
        expect(scanState.scanConfirmCount).toBe(1);
        expect(triggerScanAction).not.toHaveBeenCalled();
        releaseOld(result());
        await flush();
        expect(triggerScanAction).not.toHaveBeenCalled();
        expect(scanState.scanConfirmCount).toBe(1);
        expect(frames).toHaveLength(1);
    });

    it('ទិសផ្ទុយ ៖ frame ថ្មីពីកាមេរ៉ាបច្ចុប្បន្ន ២ ដង ➜ បញ្ជាក់លេខ និងបើកការស្កេនម្តង', async () => {
        const read = vi.fn(async () => result());
        installReader(read);
        start();
        frames.shift()!(1000);
        await flush();
        expect(triggerScanAction).not.toHaveBeenCalled();
        expect(scanState.scanConfirmCount).toBe(1);
        video.currentTime = 2;
        frames.shift()!(2000);
        await flush();
        expect(read).toHaveBeenCalledTimes(2);
        expect(triggerScanAction).toHaveBeenCalledExactlyOnceWith(CODE);
    });
});
