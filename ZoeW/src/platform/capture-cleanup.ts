import { isNativeAndroid } from './native';

export const CAPTURE_CLEANUP_PLUGIN_NAME = 'ZoeCaptureCleanup';

type CaptureCleanupPlugin = { release(options: { name: string; before: number }): Promise<{ removed?: number }> };

let captureCleanupPlugin: CaptureCleanupPlugin | null = null;
let cameraReads = 0;

export async function releaseCameraCaptures(name = ''): Promise<number> {
    if (!isNativeAndroid()) return 0;
    const before = cameraReads > 0 ? 0 : Date.now();
    try {
        if (!captureCleanupPlugin) {
            const { registerPlugin } = await import('@capacitor/core');
            captureCleanupPlugin = registerPlugin<CaptureCleanupPlugin>(CAPTURE_CLEANUP_PLUGIN_NAME);
        }
        const result = await captureCleanupPlugin.release({ name: typeof name === 'string' ? name : '', before });
        return typeof result?.removed === 'number' ? result.removed : 0;
    } catch { return 0; }
}

export async function readCameraCapture<T>(file: File, read: () => Promise<T>): Promise<T> {
    cameraReads++;
    try { return await read(); }
    finally {
        cameraReads--;
        void releaseCameraCaptures(typeof file?.name === 'string' ? file.name : '');
    }
}
