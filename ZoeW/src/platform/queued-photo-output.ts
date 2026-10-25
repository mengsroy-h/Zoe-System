import { downloadObjectUrl } from './document-io';
import { isNativeApp } from './native';
import { noteAppLockExcuse } from '../features/app-lock';

const nativePaths = new Set<string>();

export type QueuedPhotoOutputResult = 'saved' | 'shared' | 'cancelled' | 'stale';

export async function saveOriginalQueuedPhoto(base64: string, filename: string, isCurrent: () => boolean): Promise<QueuedPhotoOutputResult> {
    if (!isCurrent()) return 'stale';
    if (!/^[A-Za-z0-9_-]+\.jpg$/.test(filename) || typeof base64 !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) throw new Error('photo:invalid');
    const binary = atob(base64);
    if (binary.length < 4 || binary.charCodeAt(0) !== 255 || binary.charCodeAt(1) !== 216 || binary.charCodeAt(2) !== 255) throw new Error('photo:invalid');
    if (!isCurrent()) return 'stale';
    if (!isNativeApp()) {
        const bytes = Uint8Array.from(binary, (value) => value.charCodeAt(0));
        const url = URL.createObjectURL(new Blob([bytes], { type: 'image/jpeg' }));
        try {
            if (!isCurrent()) return 'stale';
            downloadObjectUrl(url, filename);
            return isCurrent() ? 'saved' : 'stale';
        } finally {
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        }
    }
    const [{ Filesystem, Directory }, { Share }] = await Promise.all([
        import('@capacitor/filesystem'), import('@capacitor/share')
    ]);
    if (!isCurrent()) return 'stale';
    const digest = await crypto.subtle.digest('SHA-256', Uint8Array.from(binary, (value) => value.charCodeAt(0)));
    if (!isCurrent()) return 'stale';
    const hash = Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join('');
    const path = 'queue-photo/' + hash + '/' + filename;
    if (nativePaths.has(path)) return 'stale';
    nativePaths.add(path);
    try {
        let exists = false;
        try { await Filesystem.stat({ path, directory: Directory.Cache }); exists = true; }
        catch (error) { if ((error as { code?: string })?.code !== 'OS-PLUG-FILE-0008') throw error; }
        if (!isCurrent()) return 'stale';
        if (exists) {
            const cached = await Filesystem.readFile({ path, directory: Directory.Cache });
            if (!isCurrent()) return 'stale';
            if (typeof cached.data !== 'string' || atob(cached.data) !== binary) throw new Error('photo:cache');
        }
        let handedOff = false;
        let result: QueuedPhotoOutputResult = 'stale';
        try {
            const written = exists ? await Filesystem.getUri({ path, directory: Directory.Cache })
                : await Filesystem.writeFile({ path, data: base64, directory: Directory.Cache, recursive: true });
            if (!exists && isCurrent()) {
                const cached = await Filesystem.readFile({ path, directory: Directory.Cache });
                if (isCurrent() && (typeof cached.data !== 'string' || atob(cached.data) !== binary)) throw new Error('photo:cache');
            }
            if (isCurrent()) {
                noteAppLockExcuse();
                if (isCurrent()) {
                    try {
                        handedOff = true;
                        await Share.share({ title: filename, files: [written.uri], dialogTitle: 'រក្សាទុករូបដើម · ជ្រើសរើសទីតាំងដោយខ្លួនឯង' });
                        result = isCurrent() ? 'shared' : 'stale';
                    } catch (error) {
                        if (!isCurrent()) result = 'stale';
                        else if (/cancel/i.test(String((error as { message?: unknown })?.message || ''))) result = 'cancelled';
                        else throw error;
                    }
                }
            }
        } finally {
            if (!exists && !handedOff) await Filesystem.deleteFile({ path, directory: Directory.Cache });
        }
        return isCurrent() ? result : 'stale';
    } finally { nativePaths.delete(path); }
}
