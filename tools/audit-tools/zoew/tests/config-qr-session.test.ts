import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const { video, frames, decode, connect, toast } = vi.hoisted(() => ({
    video: { srcObject: null as any, pause: vi.fn(), play: vi.fn(), readyState: 2, HAVE_CURRENT_DATA: 2, videoWidth: 640, videoHeight: 480 },
    frames: [] as Array<() => void>, decode: vi.fn(), connect: vi.fn(), toast: vi.fn()
}));
vi.mock('../../../../ZoeW/src/app/refs', () => ({ videoElement: () => video, setFieldValue: vi.fn() }));
vi.mock('../../../../ZoeW/src/features/app-lock', () => ({ noteAppLockExcuse: vi.fn() }));
vi.mock('../../../../ZoeW/src/features/config', () => ({ connectSetupPayload: connect, parseSetupLinkText: () => ({ parsed: { config: 'old' } }) }));
vi.mock('../../../../ZoeW/src/ui/modal', () => ({ openModalHelper: vi.fn(), closeModal: vi.fn() }));
vi.mock('../../../../ZoeW/src/ui/toast', () => ({ showToast: toast }));
vi.mock('../../../../ZoeW/src/platform/document-io', () => ({ createScratchCanvas: () => ({ width: 0, height: 0, getContext: () => ({ drawImage: vi.fn() }) }), loadScratchImage: vi.fn() }));
vi.mock('../../../../ZoeW/src/services/scan-engine', () => ({
    scanEngineReady: () => true, buildReaderOptions: () => ({}), CONFIG_QR_FORMAT_NAMES: [], CONFIG_QR_SCAN_WIDTH: 640,
    decodeBarcodeFromCanvasManual: decode, scheduleScanFrame: (_video: unknown, fn: () => void) => frames.push(fn)
}));
import { securityState, scanState, uiState } from '../../../../ZoeW/src/core/state';
import { openConfigQrScanner, closeConfigQrScanner, decodeConfigQrImage } from '../../../../ZoeW/src/features/config-qr';

function deferred<T>() {
    let resolve!: (value: T) => void, reject!: (error: Error) => void;
    const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
}
function stream() { const stop = vi.fn(); return { getTracks: () => [{ stop }], stop }; }
const turn = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
beforeEach(() => {
    closeConfigQrScanner();
    vi.clearAllMocks(); frames.length = 0;
    scanState.isCameraScanning = false; scanState.isCameraStarting = false;
    video.play.mockReset().mockResolvedValue(undefined);
    decode.mockReset().mockResolvedValue('');
});
afterEach(() => { closeConfigQrScanner(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
function camera(request: (...args: any[]) => any) { vi.stubGlobal('navigator', { userAgent: '', mediaDevices: { getUserMedia: request } }); }

it('បិទពេលសុំសិទ្ធិ ➜ បញ្ឈប់កាមេរ៉ាដែលមកយឺត', async () => {
    const permission = deferred<any>(), old = stream(); camera(() => permission.promise);
    const opening = openConfigQrScanner();
    expect(securityState.configQrScanActive).toBe(true);
    closeConfigQrScanner(); permission.resolve(old); await opening;
    expect(old.stop).toHaveBeenCalledOnce();
    expect(securityState.configQrStream).toBeNull();
    expect(video.play).not.toHaveBeenCalled();
    expect(frames).toHaveLength(0);
});
for (const rejects of [false, true]) {
    it('បិទហើយបើកថ្មី ➜ សិទ្ធិចាស់មិនប៉ះកាមេរ៉ាថ្មី ' + rejects, async () => {
        const permission = deferred<any>(), old = stream(), fresh = stream();
        camera(vi.fn().mockReturnValueOnce(permission.promise).mockResolvedValueOnce(fresh));
        const opening = openConfigQrScanner(); closeConfigQrScanner(); await openConfigQrScanner();
        expect(securityState.configQrStream).toBe(fresh);
        vi.spyOn(console, 'error').mockImplementation(() => {});
        if (rejects) permission.reject(new Error('old camera')); else permission.resolve(old);
        await opening;
        expect(securityState.configQrScanActive).toBe(true);
        expect(securityState.configQrStream).toBe(fresh);
        expect(video.srcObject).toBe(fresh);
        expect(fresh.stop).not.toHaveBeenCalled();
        expect(old.stop).toHaveBeenCalledTimes(rejects ? 0 : 1);
        expect(toast).not.toHaveBeenCalled();
    });
}
for (const rejects of [false, true]) {
    it('play ចាស់បញ្ចប់ក្រោយបើកថ្មី ➜ មិនបង្កើត loop ឬបិទថ្មី ' + rejects, async () => {
        const play = deferred<void>(), old = stream(), fresh = stream();
        camera(vi.fn().mockResolvedValueOnce(old).mockResolvedValueOnce(fresh));
        video.play.mockReturnValueOnce(play.promise).mockResolvedValueOnce(undefined);
        const opening = openConfigQrScanner(); await turn();
        expect(video.srcObject).toBe(old);
        closeConfigQrScanner(); await openConfigQrScanner();
        const count = frames.length;
        vi.spyOn(console, 'error').mockImplementation(() => {});
        if (rejects) play.reject(new Error('old play')); else play.resolve();
        await opening;
        expect(old.stop).toHaveBeenCalledOnce();
        expect(fresh.stop).not.toHaveBeenCalled();
        expect(securityState.configQrScanActive).toBe(true);
        expect(frames).toHaveLength(count);
        expect(toast).not.toHaveBeenCalled();
    });
}
it('decode ចាស់មកក្រោយបើកថ្មី ➜ មិនភ្ជាប់ហាង និងមិនបិទថ្មី', async () => {
    const decoded = deferred<string>(), old = stream(), fresh = stream();
    decode.mockReturnValueOnce(decoded.promise);
    camera(vi.fn().mockResolvedValueOnce(old).mockResolvedValueOnce(fresh));
    await openConfigQrScanner(); frames.shift()!();
    expect(decode).toHaveBeenCalledOnce();
    const oldFrame = frames.shift()!;
    closeConfigQrScanner(); await openConfigQrScanner();
    const count = frames.length;
    oldFrame(); decoded.resolve('old setup link'); await turn();
    expect(connect).not.toHaveBeenCalled();
    expect(securityState.configQrScanActive).toBe(true);
    expect(securityState.configQrStream).toBe(fresh);
    expect(fresh.stop).not.toHaveBeenCalled();
    expect(frames).toHaveLength(count);
});
it('decode បច្ចុប្បន្ន ➜ បញ្ឈប់កាមេរ៉ា ហើយភ្ជាប់', async () => {
    const live = stream(); camera(async () => live); decode.mockResolvedValueOnce('current setup');
    await openConfigQrScanner(); frames.shift()!(); await turn();
    expect(connect).toHaveBeenCalledOnce();
    expect(live.stop).toHaveBeenCalledOnce();
    expect(securityState.configQrScanActive).toBe(false);
});
it('កាមេរ៉ាបច្ចុប្បន្នបរាជ័យ ➜ ប្រាប់កំហុស ហើយបិទ', async () => {
    camera(async () => { throw new Error('camera failed'); });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await openConfigQrScanner();
    expect(toast).toHaveBeenCalledOnce();
    expect(securityState.configQrScanActive).toBe(false);
    expect(securityState.configQrStream).toBeNull();
    expect(frames).toHaveLength(0);
});


it('ជ្រើសរូប QR ថ្មី៖ FileReader ចាស់មកយឺតមិនភ្ជាប់ម្ដងទៀត', async () => {
    const readers: any[] = [];
    vi.stubGlobal('FileReader', class {
        onload: any;
        readAsDataURL() { readers.push(this); }
    });
    uiState.modalDisplay = { configModal: 'flex' };
    const { loadScratchImage } = await import('../../../../ZoeW/src/platform/document-io');
    vi.mocked(loadScratchImage).mockImplementation((_url: any, loaded: any) => {
        const img = { naturalWidth: 640, naturalHeight: 480 } as HTMLImageElement; loaded(img); return img;
    });
    const newerDecode = deferred<string>();
    decode.mockReturnValueOnce(newerDecode.promise).mockResolvedValueOnce('old setup');
    decodeConfigQrImage({ target: { files: [new Blob(['old'])] } });
    decodeConfigQrImage({ target: { files: [new Blob(['new'])] } });
    readers[1].onload({ target: { result: 'new-image' } }); await turn();
    expect(connect).not.toHaveBeenCalled();
    readers[0].onload({ target: { result: 'old-image' } }); await turn();
    expect(connect).not.toHaveBeenCalled();
    newerDecode.resolve('new setup'); await turn();
    expect(connect).toHaveBeenCalledOnce();
    uiState.modalDisplay = {};
});


it.each(['current', 'closed', 'stale-error'] as const)('រូប QR៖ %s រក្សាម្ចាស់សំណើអានឯកសារ', async mode => {
    const readers: any[] = [];
    vi.stubGlobal('FileReader', class { onload: any; onerror: any; readAsDataURL() { readers.push(this); } });
    uiState.modalDisplay = { configModal: 'flex' };
    const { loadScratchImage } = await import('../../../../ZoeW/src/platform/document-io');
    vi.mocked(loadScratchImage).mockImplementation((_url: any, loaded: any) => { const img = { naturalWidth: 640, naturalHeight: 480 } as HTMLImageElement; loaded(img); return img; });
    decode.mockResolvedValue('valid setup');
    decodeConfigQrImage({ target: { files: [new Blob(['first'])] } });
    if (mode === 'closed') uiState.modalDisplay = {};
    if (mode === 'stale-error') {
        decodeConfigQrImage({ target: { files: [new Blob(['second'])] } });
        readers[0].onerror(); await turn();
        expect(toast).not.toHaveBeenCalled();
        readers[1].onload({ target: { result: 'second-image' } });
    } else readers[0].onload({ target: { result: 'first-image' } });
    await turn();
    expect(connect).toHaveBeenCalledTimes(mode === 'closed' ? 0 : 1);
    if (mode === 'closed') expect(decode).not.toHaveBeenCalled();
    uiState.modalDisplay = {};
});
