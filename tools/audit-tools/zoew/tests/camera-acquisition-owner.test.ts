import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const { video, warm } = vi.hoisted(() => ({
    video: {
        srcObject: null as any, muted: false, readyState: 4,
        pause: vi.fn(), play: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn()
    },
    warm: vi.fn()
}));
vi.mock('../../../../ZoeW/src/app/refs', async (importOriginal) => ({
    ...await importOriginal<typeof import('../../../../ZoeW/src/app/refs')>(), videoElement: () => video
}));
vi.mock('../../../../ZoeW/src/features/lookup-api', async (importOriginal) => ({
    ...await importOriginal<typeof import('../../../../ZoeW/src/features/lookup-api')>(), warmZtoLookupProxyNow: warm
}));

import { scanState } from '../../../../ZoeW/src/core/state';
import { viewState } from '../../../../ZoeW/src/core/view-state';
import { closeCameraManually, stopCurrentStream } from '../../../../ZoeW/src/features/daily-stats';
import { setupVisibilityHandling } from '../../../../ZoeW/src/app/behaviors/scanner-input';
import { requestCameraPermission, toggleTorch } from '../../../../ZoeW/src/services/camera';

function deferred<T>() {
    let resolve!: (value: T) => void, reject!: (error: Error) => void;
    const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
}
function stream() {
    const track = { stop: vi.fn(), enabled: true };
    return { getTracks: () => [track], getVideoTracks: () => [], track };
}
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
function camera(getUserMedia: ReturnType<typeof vi.fn>) {
    vi.stubGlobal('navigator', { userAgent: '', mediaDevices: { getUserMedia } });
}

beforeEach(() => {
    stopCurrentStream();
    scanState.isCameraStarting = false;
    scanState.nativeDetector = null;
    scanState.liveScanCodeReader = null;
    video.srcObject = null;
    video.play.mockReset().mockResolvedValue(undefined);
    vi.clearAllMocks();
    vi.stubGlobal('alert', vi.fn());
});
afterEach(() => {
    stopCurrentStream();
    scanState.isCameraStarting = false;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

it('សំណើកាមេរ៉ាកំពុងរង់ចាំ ៖ ចុចស្ទួនមិនបង្កើតសំណើថ្មី', () => {
    const permission = deferred<any>(), getUserMedia = vi.fn(() => permission.promise);
    camera(getUserMedia);
    requestCameraPermission(); requestCameraPermission();
    expect(getUserMedia).toHaveBeenCalledOnce();
    expect(scanState.isCameraStarting).toBe(true);
});

it('បិទសំណើដែលមិនឆ្លើយ ៖ បើកកាមេរ៉ាថ្មីបានដោយមិនចាំសំណើចាស់', () => {
    const first = deferred<any>(), second = deferred<any>();
    const getUserMedia = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    camera(getUserMedia);
    requestCameraPermission(); closeCameraManually();
    expect(viewState.cameraView).toBe('closed');
    expect(scanState.isCameraStarting).toBe(false);
    requestCameraPermission();
    expect(getUserMedia).toHaveBeenCalledTimes(2);
    expect(scanState.isCameraStarting).toBe(true);
});

for (const rejectOld of [false, true]) {
    it('សំណើចាស់បញ្ចប់យឺត មិនដោះសោសំណើថ្មី ' + (rejectOld ? 'បដិសេធ' : 'ជោគជ័យ'), async () => {
        const first = deferred<any>(), second = deferred<any>(), old = stream(), current = stream();
        const getUserMedia = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
        camera(getUserMedia);
        requestCameraPermission(); closeCameraManually(); requestCameraPermission();
        if (rejectOld) first.reject(new Error('old permission')); else first.resolve(old);
        await flush();
        expect(scanState.isCameraStarting).toBe(true);
        expect(scanState.currentStream).toBeNull();
        expect(old.track.stop).toHaveBeenCalledTimes(rejectOld ? 0 : 1);
        expect(alert).not.toHaveBeenCalled();
        requestCameraPermission();
        expect(getUserMedia).toHaveBeenCalledTimes(2);
        second.resolve(current); await flush();
        expect(scanState.isCameraStarting).toBe(false);
        expect(scanState.currentStream).toBe(current);
        expect(current.track.stop).not.toHaveBeenCalled();
        expect(video.srcObject).toBe(current);
        expect(video.play).toHaveBeenCalledOnce();
    });
}

it('សំណើបច្ចុប្បន្នជោគជ័យ ៖ បើក stream ម្តង ហើយបិទដោះធនធាន', async () => {
    const current = stream(), getUserMedia = vi.fn().mockResolvedValue(current);
    camera(getUserMedia);
    requestCameraPermission(); await flush();
    expect(scanState.isCameraStarting).toBe(false);
    expect(scanState.isCameraScanning).toBe(true);
    expect(scanState.currentStream).toBe(current);
    expect(video.srcObject).toBe(current);
    expect(video.play).toHaveBeenCalledOnce();
    closeCameraManually();
    expect(current.track.stop).toHaveBeenCalledOnce();
    expect(current.track.enabled).toBe(false);
    expect(scanState.currentStream).toBeNull();
    expect(scanState.isCameraScanning).toBe(false);
    expect(video.srcObject).toBeNull();
});

it('សំណើបច្ចុប្បន្នបដិសេធ ៖ ប្រាប់ម្តង ហើយចុចសាកឡើងវិញបាន', async () => {
    const current = stream();
    const getUserMedia = vi.fn().mockRejectedValueOnce(Object.assign(new Error('denied'), { name: 'NotAllowedError' })).mockResolvedValueOnce(current);
    camera(getUserMedia);
    requestCameraPermission(); await flush();
    expect(scanState.isCameraStarting).toBe(false);
    expect(scanState.currentStream).toBeNull();
    expect(alert).toHaveBeenCalledOnce();
    requestCameraPermission(); await flush();
    expect(getUserMedia).toHaveBeenCalledTimes(2);
    expect(scanState.currentStream).toBe(current);
    expect(scanState.isCameraStarting).toBe(false);
    expect(alert).toHaveBeenCalledOnce();
});

// Use the real lifecycle handler and real permission ownership/stream cleanup.
setupVisibilityHandling();
function visibility(hidden: boolean) {
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(hidden);
    document.dispatchEvent(new Event('visibilitychange'));
}

for (const rejectOld of [false, true]) {
    it('លាក់កម្មវិធីពេលរង់ចាំសិទ្ធិ ៖ បោះបង់ម្ចាស់សំណើ ហើយមិនបើកកាមេរ៉ាយឺត ' + (rejectOld ? 'បដិសេធ' : 'ជោគជ័យ'), async () => {
        const permission = deferred<any>(), late = stream();
        camera(vi.fn(() => permission.promise));
        requestCameraPermission();
        const requestId = scanState.cameraRequestId;
        visibility(true);
        expect(scanState.cameraRequestId).toBeGreaterThan(requestId);
        expect(scanState.isCameraStarting).toBe(false);
        expect(viewState.cameraView).toBe('closed');
        if (rejectOld) permission.reject(new Error('late denial')); else permission.resolve(late);
        await flush();
        expect(late.track.stop).toHaveBeenCalledTimes(rejectOld ? 0 : 1);
        expect(scanState.currentStream).toBeNull();
        expect(scanState.isCameraScanning).toBe(false);
        expect(video.srcObject).toBeNull();
        expect(video.play).not.toHaveBeenCalled();
        expect(alert).not.toHaveBeenCalled();
    });
}

it('ត្រឡប់មកវិញ ៖ សំណើចាស់មិនប៉ះពាល់ stream ថ្មី ហើយមិនបើកដោយស្វ័យប្រវត្តិ', async () => {
    const first = deferred<any>(), second = deferred<any>(), old = stream(), current = stream();
    const getUserMedia = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    camera(getUserMedia);
    requestCameraPermission();
    visibility(true); visibility(false);
    expect(getUserMedia).toHaveBeenCalledOnce();
    requestCameraPermission();
    expect(getUserMedia).toHaveBeenCalledTimes(2);
    second.resolve(current); await flush();
    first.resolve(old); await flush();
    expect(old.track.stop).toHaveBeenCalledOnce();
    expect(current.track.stop).not.toHaveBeenCalled();
    expect(scanState.currentStream).toBe(current);
    expect(scanState.isCameraScanning).toBe(true);
    expect(video.srcObject).toBe(current);
    expect(video.play).toHaveBeenCalledOnce();
});

it('កាមេរ៉ាបើករួច ៖ លាក់កម្មវិធីបិទ stream ដូចមុន', async () => {
    const current = stream();
    camera(vi.fn().mockResolvedValue(current));
    requestCameraPermission(); await flush();
    visibility(true);
    expect(current.track.stop).toHaveBeenCalledOnce();
    expect(scanState.currentStream).toBeNull();
    expect(scanState.isCameraScanning).toBe(false);
    expect(video.srcObject).toBeNull();
    expect(viewState.cameraView).toBe('closed');
});

it('កម្មវិធីនៅបង្ហាញ ៖ មិនបោះបង់សំណើសិទ្ធិកំពុងរង់ចាំ', async () => {
    const permission = deferred<any>(), current = stream();
    camera(vi.fn(() => permission.promise));
    requestCameraPermission();
    const requestId = scanState.cameraRequestId;
    visibility(false);
    expect(scanState.cameraRequestId).toBe(requestId);
    expect(scanState.isCameraStarting).toBe(true);
    permission.resolve(current); await flush();
    expect(scanState.currentStream).toBe(current);
    expect(current.track.stop).not.toHaveBeenCalled();
});


it.each(['closed', 'replaced', 'generation'] as const)('ភ្លើងកាមេរ៉ា៖ លទ្ធផលយឺតមិនកែស្ថានភាពក្រោយ %s', async change => {
    const pending = deferred<void>();
    const track = { applyConstraints: vi.fn(() => pending.promise) };
    scanState.currentVideoTrack = track as any;
    toggleTorch();
    expect(track.applyConstraints).toHaveBeenCalledWith({ advanced: [{ torch: true }] });
    if (change === 'closed') stopCurrentStream();
    else if (change === 'replaced') scanState.currentVideoTrack = { applyConstraints: vi.fn() } as any;
    else scanState.cameraRequestId++;
    pending.resolve(); await flush();
    expect(scanState.torchOn).toBe(false);
});

it('ភ្លើងកាមេរ៉ា៖ ជំនាន់និង track ដដែល អាចបើក បិទ និងរក្សាស្ថានភាពពេលបរាជ័យ', async () => {
    const track = { applyConstraints: vi.fn().mockResolvedValue(undefined) };
    scanState.currentVideoTrack = track as any;
    toggleTorch(); await flush();
    expect(scanState.torchOn).toBe(true);
    toggleTorch(); await flush();
    expect(scanState.torchOn).toBe(false);
    expect(track.applyConstraints).toHaveBeenLastCalledWith({ advanced: [{ torch: false }] });
    track.applyConstraints.mockRejectedValueOnce(new Error('unsupported'));
    toggleTorch(); await flush();
    expect(scanState.torchOn).toBe(false);
});
