import { downloadObjectUrl } from './document-io';
import { noteAppLockExcuse } from '../features/app-lock';
import { isNativeApp } from './native';

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

export function printCurrentView(jobName: string): Promise<void> | void {
    if (!isNativeApp()) {
        window.print();
        return;
    }
    return Promise.all([import('@capgo/capacitor-printer'), import('@capacitor/app')])
        .then(async ([{ Printer }, { App }]) => {
            const resumed = await App.addListener('resume', () => {
                resumed.remove();
                window.dispatchEvent(new Event('afterprint'));
            });
            noteAppLockExcuse();
            try {
                await Printer.printWebView({ name: jobName });
            } catch (e) {
                resumed.remove();
                window.dispatchEvent(new Event('afterprint'));
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
