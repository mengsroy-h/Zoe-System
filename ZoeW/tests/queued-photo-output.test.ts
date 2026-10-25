import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { saveOriginalQueuedPhoto } from '../src/platform/queued-photo-output';
const mocks = vi.hoisted(() => ({ native: false, download: vi.fn(), excuse: vi.fn(), write: vi.fn(), remove: vi.fn(), share: vi.fn(), stat: vi.fn(), uri: vi.fn(), read: vi.fn() }));
vi.mock('../src/platform/native', () => ({ isNativeApp: () => mocks.native }));
vi.mock('../src/platform/document-io', () => ({ downloadObjectUrl: mocks.download }));
vi.mock('../src/features/app-lock', () => ({ noteAppLockExcuse: mocks.excuse }));
vi.mock('@capacitor/filesystem', () => ({ Filesystem: { writeFile: mocks.write, deleteFile: mocks.remove, stat: mocks.stat, getUri: mocks.uri, readFile: mocks.read }, Directory: { Cache: 'CACHE' } }));
vi.mock('@capacitor/share', () => ({ Share: { share: mocks.share } }));
const bytes = new Uint8Array([255, 216, 255, 225, 0, 255, 128, 1, 255, 217]);
const photo = btoa(String.fromCharCode(...bytes));
beforeEach(() => {
    vi.resetAllMocks(); mocks.native = false;
    vi.stubGlobal('crypto', webcrypto);
    mocks.stat.mockRejectedValue({ code: 'OS-PLUG-FILE-0008' });
    mocks.uri.mockResolvedValue({ uri: 'file:///synthetic/cache/photo.jpg' });
    mocks.read.mockResolvedValue({ data: photo });
    mocks.write.mockResolvedValue({ uri: 'file:///synthetic/cache/photo.jpg' });
    mocks.remove.mockResolvedValue(undefined); mocks.share.mockResolvedValue({});
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:synthetic');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn(() => { throw new Error('network forbidden'); }));
});
afterEach(() => vi.unstubAllGlobals());
it('ទាញយក JPEG ដើមដោយរក្សា bytes និងឈ្មោះ មិនប្រើបណ្ដាញ ឬ native', async () => {
    expect(await saveOriginalQueuedPhoto(photo, 'queue-SYNTHETIC-A.jpg', () => true)).toBe('saved');
    const blob = vi.mocked(URL.createObjectURL).mock.calls[0][0] as Blob;
    expect(blob.type).toBe('image/jpeg');
    expect(new Uint8Array(await blob.arrayBuffer())).toEqual(bytes);
    expect(mocks.download).toHaveBeenCalledWith('blob:synthetic', 'queue-SYNTHETIC-A.jpg');
    expect(mocks.write).not.toHaveBeenCalled(); expect(mocks.share).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
});
it('បដិសេធម្ចាស់ផ្លាស់ប្តូរ និងរូបមិនត្រឹមត្រូវមុនចេញឯកសារ', async () => {
    expect(await saveOriginalQueuedPhoto(photo, 'queue-A.jpg', () => false)).toBe('stale');
    await expect(saveOriginalQueuedPhoto('invalid', 'queue-A.jpg', () => true)).rejects.toThrow();
    expect(mocks.download).not.toHaveBeenCalled(); expect(mocks.write).not.toHaveBeenCalled();
});
it('Android បើកតែផ្ទាំងជ្រើសរើសដោយអ្នកប្រើ រូបដើម និងទុកច្បាប់ចម្លងឱ្យកម្មវិធីទទួលអាន', async () => {
    mocks.native = true;
    expect(await saveOriginalQueuedPhoto(photo, 'queue-SYNTHETIC-B.jpg', () => true)).toBe('shared');
    expect(mocks.write).toHaveBeenCalledWith(expect.objectContaining({ data: photo, directory: 'CACHE' }));
    expect(mocks.share).toHaveBeenCalledWith({ title: 'queue-SYNTHETIC-B.jpg', files: ['file:///synthetic/cache/photo.jpg'], dialogTitle: 'រក្សាទុករូបដើម · ជ្រើសរើសទីតាំងដោយខ្លួនឯង' });
    expect(mocks.remove).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
});
it('Android ម្ចាស់ប្តូរពេលសរសេរ មិនបង្ហាញ share និងលុបច្បាប់ចម្លង', async () => {
    mocks.native = true; let current = true;
    mocks.write.mockImplementation(async () => { current = false; return { uri: 'file:///synthetic/cache/photo.jpg' }; });
    expect(await saveOriginalQueuedPhoto(photo, 'queue-A.jpg', () => current)).toBe('stale');
    expect(mocks.share).not.toHaveBeenCalled(); expect(mocks.excuse).not.toHaveBeenCalled(); expect(mocks.remove).toHaveBeenCalledOnce();
});
it('Android បោះបង់ និងប្តូរម្ចាស់ក្រោយ share មិនលុបច្បាប់ចម្លងដែលបានប្រគល់', async () => {
    mocks.native = true;
    mocks.share.mockRejectedValueOnce(new Error('User cancelled'));
    expect(await saveOriginalQueuedPhoto(photo, 'queue-A.jpg', () => true)).toBe('cancelled');
    let current = true; mocks.share.mockImplementation(async () => { current = false; });
    expect(await saveOriginalQueuedPhoto(photo, 'queue-B.jpg', () => current)).toBe('stale');
    expect(mocks.remove).not.toHaveBeenCalled();
    expect(mocks.write.mock.calls[0][0].path).not.toBe(mocks.write.mock.calls[1][0].path);
});
it('Android ផ្លាស់ម្ចាស់ពេល import មិនសរសេរឯកសារ', async () => {
    mocks.native = true; let checks = 0;
    expect(await saveOriginalQueuedPhoto(photo, 'queue-A.jpg', () => ++checks < 3)).toBe('stale');
    expect(mocks.write).not.toHaveBeenCalled(); expect(mocks.share).not.toHaveBeenCalled();
});
it('Android ផ្លាស់ម្ចាស់ពេលសម្អាត មិនរាយការណ៍ជោគជ័យ និងការសម្អាតបរាជ័យមិនលាក់', async () => {
    mocks.native = true; let current = true;
    mocks.write.mockImplementationOnce(async () => { current = false; return { uri: 'file:///synthetic/cache/photo.jpg' }; });
    expect(await saveOriginalQueuedPhoto(photo, 'queue-A.jpg', () => current)).toBe('stale');
    mocks.write.mockImplementationOnce(async () => { throw new Error('write failed'); });
    mocks.remove.mockRejectedValueOnce(new Error('cache cleanup failed'));
    await expect(saveOriginalQueuedPhoto(photo, 'queue-B.jpg', () => true)).rejects.toThrow('cache cleanup failed');
});
it('ចុចទាញយកម្ដងទៀត សម្អាត object URL ទាំងពីរ', async () => {
    vi.useFakeTimers();
    try {
        vi.mocked(URL.createObjectURL).mockReturnValueOnce('blob:first').mockReturnValueOnce('blob:second');
        await saveOriginalQueuedPhoto(photo, 'queue-A.jpg', () => true);
        await saveOriginalQueuedPhoto(photo, 'queue-A.jpg', () => true);
        expect(mocks.download).toHaveBeenCalledTimes(2);
        await vi.runAllTimersAsync();
        expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:first');
        expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:second');
        expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
    } finally { vi.useRealTimers(); }
});

it('កម្មវិធីទទួលអានក្រោយ share promise រួច ហើយរូបដដែលប្រើ path ដដែល', async () => {
    mocks.native = true; const files = new Map<string, string>();
    mocks.stat.mockImplementation(async ({ path }) => { if (!files.has(path)) throw { code: 'OS-PLUG-FILE-0008' }; return { type: 'file' }; });
    mocks.uri.mockImplementation(async ({ path }) => ({ uri: path }));
    mocks.write.mockImplementation(async ({ path, data }) => { files.set(path, data); return { uri: path }; });
    mocks.remove.mockImplementation(async ({ path }) => { files.delete(path); });
    await saveOriginalQueuedPhoto(photo, 'queue-A.jpg', () => true);
    const firstPath = mocks.share.mock.calls[0][0].files[0];
    expect(files.get(firstPath)).toBe(photo);
    await saveOriginalQueuedPhoto(photo, 'queue-A.jpg', () => true);
    expect(mocks.share.mock.calls[1][0].files[0]).toBe(firstPath);
    expect(files.size).toBe(1); expect(mocks.write).toHaveBeenCalledTimes(1);
});
it('ច្បាប់ចម្លងធ្លាប់ប្រគល់ មិនសរសេរ ឬលុបពេលសម័យប្តូរ', async () => {
    mocks.native = true; let current = true;
    mocks.stat.mockResolvedValue({ type: 'file' });
    mocks.uri.mockImplementation(async () => { current = false; return { uri: 'file:///synthetic/cache/photo.jpg' }; });
    expect(await saveOriginalQueuedPhoto(photo, 'queue-A.jpg', () => current)).toBe('stale');
    expect(mocks.write).not.toHaveBeenCalled(); expect(mocks.remove).not.toHaveBeenCalled(); expect(mocks.share).not.toHaveBeenCalled();
});

it('cache រូបខូច ឬសរសេរមិនចប់ មិនចែករំលែក មិនសរសេរជាន់ និងមិនលុប', async () => {
    mocks.native = true; mocks.stat.mockResolvedValue({ type: 'file' });
    mocks.read.mockResolvedValue({ data: btoa('truncated') });
    await expect(saveOriginalQueuedPhoto(photo, 'queue-A.jpg', () => true)).rejects.toThrow('photo:cache');
    expect(mocks.uri).not.toHaveBeenCalled(); expect(mocks.share).not.toHaveBeenCalled();
    expect(mocks.write).not.toHaveBeenCalled(); expect(mocks.remove).not.toHaveBeenCalled();
});
it('ម្ចាស់ប្តូរពេលផ្ទៀង cache មិនប្រគល់រូបទៅ OS', async () => {
    mocks.native = true; let current = true; mocks.stat.mockResolvedValue({ type: 'file' });
    mocks.read.mockImplementation(async () => { current = false; return { data: photo }; });
    expect(await saveOriginalQueuedPhoto(photo, 'queue-A.jpg', () => current)).toBe('stale');
    expect(mocks.uri).not.toHaveBeenCalled(); expect(mocks.share).not.toHaveBeenCalled(); expect(mocks.remove).not.toHaveBeenCalled();
});

it('សរសេររូបថ្មីមិនពេញ មិនប្រគល់ ហើយសម្អាតច្បាប់ចម្លងថ្មី', async () => {
    mocks.native = true; mocks.read.mockResolvedValue({ data: btoa('partial') });
    await expect(saveOriginalQueuedPhoto(photo, 'queue-A.jpg', () => true)).rejects.toThrow('photo:cache');
    expect(mocks.share).not.toHaveBeenCalled(); expect(mocks.remove).toHaveBeenCalledTimes(1);
});
it('ម្ចាស់ចាស់កំពុងសរសេរ ម្ចាស់ថ្មីមិនសរសេរជាន់ path ដដែល', async () => {
    mocks.native = true; let current = true; let finish!: () => void;
    mocks.write.mockImplementationOnce(() => new Promise((resolve) => { finish = () => resolve({ uri: 'file:///synthetic/cache/photo.jpg' }); }));
    const first = saveOriginalQueuedPhoto(photo, 'queue-A.jpg', () => current);
    await vi.waitFor(() => expect(mocks.write).toHaveBeenCalledTimes(1)); current = false;
    expect(await saveOriginalQueuedPhoto(photo, 'queue-A.jpg', () => true)).toBe('stale');
    expect(mocks.write).toHaveBeenCalledTimes(1); finish(); await first;
    expect(mocks.share).not.toHaveBeenCalled(); expect(mocks.remove).toHaveBeenCalledTimes(1);
    expect(await saveOriginalQueuedPhoto(photo, 'queue-A.jpg', () => true)).toBe('shared');
});
