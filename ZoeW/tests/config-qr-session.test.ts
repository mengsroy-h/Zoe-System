import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const { video, frames, decode, connect, toast } = vi.hoisted(() => ({
    video: { srcObject: null as any, pause: vi.fn(), play: vi.fn(), readyState: 2, HAVE_CURRENT_DATA: 2, videoWidth: 640, videoHeight: 480 },
    frames: [] as Array<() => void>, decode: vi.fn(), connect: vi.fn(), toast: vi.fn()
}));
vi.mock('../src/app/refs', () => ({ videoElement: () => video, setFieldValue: vi.fn() }));
vi.mock('../src/features/app-lock', () => ({ noteAppLockExcuse: vi.fn() }));
vi.mock('../src/features/config', () => ({ connectSetupPayload: connect, parseSetupLinkText: () => ({ parsed: { config: 'old' } }) }));
vi.mock('../src/ui/modal', () => ({ openModalHelper: vi.fn(), closeModal: vi.fn() }));
vi.mock('../src/ui/toast', () => ({ showToast: toast }));
vi.mock('../src/platform/document-io', () => ({ createScratchCanvas: () => ({ width: 0, height: 0, getContext: () => ({ drawImage: vi.fn() }) }), loadScratchImage: vi.fn() }));
vi.mock('../src/services/scan-engine', () => ({
    scanEngineReady: () => true, buildReaderOptions: () => ({}), CONFIG_QR_FORMAT_NAMES: [], CONFIG_QR_SCAN_WIDTH: 640,
    decodeBarcodeFromCanvasManual: decode, scheduleScanFrame: (_video: unknown, fn: () => void) => frames.push(fn)
}));
import { securityState, scanState } from '../src/core/state';
import { openConfigQrScanner, closeConfigQrScanner } from '../src/features/config-qr';

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
