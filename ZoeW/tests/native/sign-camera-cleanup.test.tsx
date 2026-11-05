import { act } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ release: vi.fn(), register: vi.fn(), read: vi.fn(), accept: vi.fn(), order: [] as string[] }));
vi.mock('@capacitor/core', () => ({ registerPlugin: (name: string) => { h.register(name); return { release: h.release }; } }));
vi.mock('../../src/services/palm-sign-camera', () => ({
    palmSignLocation: { status: 'ready' }, subscribePalmSignLocation: () => () => {}, startPalmSignLocation: () => () => {},
    startPalmSignCamera: () => () => {}, capturePalmSignPhoto: async () => 'photo', palmSignPhotoFromFile: h.read
}));
vi.mock('../../src/features/zto-palm-sign', async (original) => ({ ...await original<any>(), acceptPalmSignBarcode: h.accept }));

import { ZtoPalmSignModal } from '../../src/app/components/modals/ZtoPalmSignModal';
import { uiState } from '../../src/core/state';
import { mount, unmount } from './react-harness';

const SHOT = 'JPEG_20261103_101010_8211938443127743161.jpg';

function deferred<T>() {
    let resolve!: (value: T) => void; let reject!: (error: unknown) => void;
    const promise = new Promise<T>((ok, fail) => { resolve = ok; reject = fail; });
    return { promise, resolve, reject };
}
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
function choose(id: string, file: File) {
    const input = document.getElementById(id) as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    act(() => { input.dispatchEvent(new Event('change', { bubbles: true })); });
}
const shot = (name = SHOT) => new File([new Uint8Array([255, 216, 255, 224])], name, { type: 'image/jpeg' });
const apk = (platform = 'android') => { (window as any).Capacitor = { isNativePlatform: () => true, getPlatform: () => platform }; };

beforeEach(() => {
    h.order.length = 0;
    h.release.mockReset().mockImplementation(async (options) => { h.order.push('release:' + options.name); return { removed: 1 }; });
    h.register.mockClear();
    h.accept.mockReset().mockImplementation(() => { h.order.push('accept'); });
    h.read.mockReset();
    uiState.modalDisplay = { ztoPalmSignModal: 'flex' };
    mount(<ZtoPalmSignModal />);
});
afterEach(() => { unmount(); delete (window as any).Capacitor; uiState.modalDisplay = {}; });

it('APK 📷 ៖ លុបឯកសារបណ្ដោះអាសន្នរបស់កាមេរ៉ាតែក្រោយ App អានរូបចប់ មិនមុន', async () => {
    apk();
    const read = deferred<any>();
    h.read.mockImplementation((file: File) => { h.order.push('read:' + file.name); return read.promise; });
    choose('palmSignPhotoInput', shot());
    await flush();
    expect(h.read).toHaveBeenCalledOnce();
    expect(h.release).not.toHaveBeenCalled();
    await act(async () => { read.resolve({ data: 'photo', barcode: '77130500000012', stampSource: 'photo' }); await flush(); });
    await vi.waitFor(() => expect(h.release).toHaveBeenCalledOnce());
    expect(h.register).toHaveBeenCalledWith('ZoeCaptureCleanup');
    expect(h.order).toEqual(['read:' + SHOT, 'accept', 'release:' + SHOT]);
    const options = h.release.mock.calls[0][0];
    expect(options.name).toBe(SHOT);
    expect(options.before).toBeGreaterThan(0);
});

it('APK 📷 អានរូបបរាជ័យ ៖ App លែងប្រើឯកសារ ➜ លុបក្រោយការអានចប់ · អ្នកប្រើទទួលសារថតម្ដងទៀត', async () => {
    apk();
    const read = deferred<any>();
    h.read.mockImplementation(() => read.promise);
    choose('palmSignPhotoInput', shot());
    await flush();
    expect(h.release).not.toHaveBeenCalled();
    await act(async () => { read.reject(new Error('image')); await flush(); });
    await vi.waitFor(() => expect(h.release).toHaveBeenCalledOnce());
    expect(h.release.mock.calls[0][0].name).toBe(SHOT);
    expect(document.body.textContent).toContain('បើករូបភាពមិនបាន');
});

it('APK 📷 បោះបង់កាមេរ៉ា ៖ សម្អាតឯកសារទទេដែលកាមេរ៉ាបង្កើត', async () => {
    apk();
    const input = document.getElementById('palmSignPhotoInput') as HTMLInputElement;
    const before = Date.now();
    act(() => { input.dispatchEvent(new Event('cancel')); });
    await vi.waitFor(() => expect(h.release).toHaveBeenCalledOnce());
    expect(h.release.mock.calls[0][0].name).toBe('');
    expect(h.release.mock.calls[0][0].before).toBeGreaterThanOrEqual(before);
});

it('APK 🖼 Gallery ៖ មិនលុបឯកសារដែលអ្នកប្រើជ្រើស (មិនមែនឯកសារកាមេរ៉ា)', async () => {
    apk();
    h.read.mockResolvedValue({ data: 'photo', barcode: '77130500000012', stampSource: 'photo' });
    choose('palmSignGalleryInput', shot('IMG_20261103_101010.jpg'));
    await vi.waitFor(() => expect(h.accept).toHaveBeenCalledOnce());
    await flush();
    act(() => { document.getElementById('palmSignGalleryInput')!.dispatchEvent(new Event('cancel')); });
    await flush();
    expect(h.release).not.toHaveBeenCalled();
});

it.each(['web', 'ios'])('%s ៖ គ្មាន plugin ឬការលុបឯកសារ', async (platform) => {
    if (platform === 'ios') apk('ios');
    h.read.mockResolvedValue({ data: 'photo', barcode: '77130500000012', stampSource: 'photo' });
    choose('palmSignPhotoInput', shot());
    await vi.waitFor(() => expect(h.accept).toHaveBeenCalledOnce());
    act(() => { document.getElementById('palmSignPhotoInput')!.dispatchEvent(new Event('cancel')); });
    await flush();
    expect(h.register).not.toHaveBeenCalled();
    expect(h.release).not.toHaveBeenCalled();
});

it('APK ចាស់គ្មាន plugin ៖ ការលុបបរាជ័យមិនរារាំងរូប Sign', async () => {
    apk();
    h.release.mockRejectedValue(new Error('not implemented'));
    h.read.mockResolvedValue({ data: 'photo', barcode: '77130500000012', stampSource: 'photo' });
    choose('palmSignPhotoInput', shot());
    await vi.waitFor(() => expect(h.release).toHaveBeenCalledOnce());
    expect(h.accept).toHaveBeenCalledWith('77130500000012', 'photo', true);
    await flush();
    expect(document.body.textContent).not.toContain('បើករូបភាពមិនបាន');
});

it('ការអានរូបកាមេរ៉ាមួយនៅដំណើរការ ៖ ការសម្អាតផ្សេងលុបតែឈ្មោះជាក់លាក់ មិនបោសឯកសារចាស់', async () => {
    apk();
    const { readCameraCapture, releaseCameraCaptures } = await import('../../src/platform/capture-cleanup');
    const read = deferred<string>();
    const reading = readCameraCapture(shot(), () => read.promise);
    await releaseCameraCaptures('');
    expect(h.release).toHaveBeenLastCalledWith({ name: '', before: 0 });
    read.resolve('done');
    await expect(reading).resolves.toBe('done');
    await vi.waitFor(() => expect(h.release).toHaveBeenCalledTimes(2));
    expect(h.release.mock.calls[1][0].name).toBe(SHOT);
    expect(h.release.mock.calls[1][0].before).toBeGreaterThan(0);
});
