import { downloadObjectUrl } from './document-io';
import { noteAppLockExcuse } from '../features/app-lock';
import { isNativeApp } from './native';
import { isMobileDevice } from '../core/timezone';

export function saveWorkbook(wb: any, filename: string): Promise<void> | void {
    if (!isNativeApp()) {
        XLSX.writeFile(wb, filename, { bookSST: true });
        return;
    }
    const base64 = XLSX.write(wb, { bookType: 'xlsx', type: 'base64', bookSST: true });
    return shareNativeFile(filename, base64);
}

export function saveTextFile(text: string, filename: string, mimeType: string): Promise<void> | void {
    if (!isNativeApp()) {
        const blob = new Blob([text], { type: mimeType });
        const url = URL.createObjectURL(blob);
        downloadObjectUrl(url, filename);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        return;
    }
    return shareNativeFile(filename, utf8ToBase64(text));
}

export const PRINT_RETURNED_EVENT = 'zoew-print-returned';

export function printCurrentView(jobName: string): Promise<void> | void {
    if (!isNativeApp()) {
        window.print();
        return;
    }
    return Promise.all([import('@capgo/capacitor-printer'), import('@capacitor/app')])
        .then(async ([{ Printer }, { App }]) => {
            const resumed = await App.addListener('resume', () => {
                resumed.remove();
                window.dispatchEvent(new Event(PRINT_RETURNED_EVENT));
            });
            noteAppLockExcuse();
            try {
                await Printer.printWebView({ name: jobName });
            } catch (e) {
                resumed.remove();
                window.dispatchEvent(new Event(PRINT_RETURNED_EVENT));
                throw e;
            }
        });
}

function utf8ToBase64(text: string): string {
    const bytes = new TextEncoder().encode(text);
    let binary = '';
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
        binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)));
    }
    return btoa(binary);
}

export type ShareImagesResult = 'shared' | 'saved' | 'cancelled';

function dataUrlBase64(dataUrl: string): string {
    const i = dataUrl.indexOf(',');
    return i >= 0 ? dataUrl.slice(i + 1) : '';
}

function dataUrlToBlob(dataUrl: string): Blob {
    const binary = atob(dataUrlBase64(dataUrl));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: 'image/png' });
}

function imageShareSheetPreferred(): boolean {
    const nav = window.navigator as any;
    return isMobileDevice() || (Number(nav.maxTouchPoints) > 1 && /Macintosh/.test(String(nav.userAgent || '')));
}

export function shareImageFiles(files: Array<{ name: string; dataUrl: string }>, title: string): Promise<ShareImagesResult> {
    if (isNativeApp()) return shareNativeImages(files, title);
    const blobs = files.map((f) => ({ name: f.name, blob: dataUrlToBlob(f.dataUrl) }));
    const download = (): ShareImagesResult => {
        blobs.forEach((b) => {
            const url = URL.createObjectURL(b.blob);
            downloadObjectUrl(url, b.name);
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        });
        return 'saved';
    };
    const nav = window.navigator as any;
    if (imageShareSheetPreferred()) {
        try {
            const list = blobs.map((b) => new File([b.blob], b.name, { type: 'image/png' }));
            if (typeof nav.share === 'function' && typeof nav.canShare === 'function' && nav.canShare({ files: list })) {
                return Promise.resolve(nav.share({ files: list, title })).then(() => 'shared' as ShareImagesResult, (e) => {
                    if (e && e.name === 'AbortError') return 'cancelled' as ShareImagesResult;
                    return download();
                });
            }
        } catch {}
    }
    return Promise.resolve(download());
}

async function shareNativeImages(files: Array<{ name: string; dataUrl: string }>, title: string): Promise<ShareImagesResult> {
    const [{ Filesystem, Directory }, { Share }] = await Promise.all([
        import('@capacitor/filesystem'),
        import('@capacitor/share')
    ]);
    const uris: string[] = [];
    for (const f of files) {
        const written = await Filesystem.writeFile({ path: 'labels/' + f.name, data: dataUrlBase64(f.dataUrl), directory: Directory.Cache, recursive: true });
        uris.push(written.uri);
    }
    noteAppLockExcuse();
    try {
        await Share.share({ title, files: uris, dialogTitle: 'រក្សាទុក ឬផ្ញើរូបភាពស្លាក' });
        return 'shared';
    } catch (e) {
        const message = String((e && (e as any).message) || '');
        if (/cancel/i.test(message)) return 'cancelled';
        throw e;
    }
}

async function shareNativeFile(filename: string, base64: string): Promise<void> {
    const [{ Filesystem, Directory }, { Share }] = await Promise.all([
        import('@capacitor/filesystem'),
        import('@capacitor/share')
    ]);
    const written = await Filesystem.writeFile({
        path: 'exports/' + filename,
        data: base64,
        directory: Directory.Cache,
        recursive: true
    });
    noteAppLockExcuse();
    try {
        await Share.share({ title: filename, files: [written.uri], dialogTitle: 'រក្សាទុក ឬផ្ញើឯកសារ' });
    } catch (e) {
        const message = String((e && (e as any).message) || '');
        if (/cancel/i.test(message)) return;
        throw e;
    }
}
