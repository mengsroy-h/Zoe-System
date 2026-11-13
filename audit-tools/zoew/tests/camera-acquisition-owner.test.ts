import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const { video, warm } = vi.hoisted(() => ({
    video: {
        srcObject: null as any, muted: false, readyState: 4,
        pause: vi.fn(), play: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn()
    },
    warm: vi.fn()
}));
vi.mock('../../../ZoeW/src/app/refs', async (importOriginal) => ({
    ...await importOriginal<typeof import('../../../ZoeW/src/app/refs')>(), videoElement: () => video
}));
vi.mock('../../../ZoeW/src/features/lookup-api', async (importOriginal) => ({
    ...await importOriginal<typeof import('../../../ZoeW/src/features/lookup-api')>(), warmZtoLookupProxyNow: warm
}));

import { scanState } from '../../../ZoeW/src/core/state';
import { viewState } from '../../../ZoeW/src/core/view-state';
import { closeCameraManually, stopCurrentStream } from '../../../ZoeW/src/features/daily-stats';
import { requestCameraPermission } from '../../../ZoeW/src/services/camera';

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
