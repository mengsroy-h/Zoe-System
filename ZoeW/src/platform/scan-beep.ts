import { isNativeAndroid } from './native';

type ScanBeepPlugin = { play(): Promise<{ played: boolean }> };

let scanBeepPlugin: ScanBeepPlugin | null = null;

export async function playNativeScanBeep(): Promise<boolean> {
    if (!isNativeAndroid()) return false;
    try {
        if (!scanBeepPlugin) {
            const { registerPlugin } = await import('@capacitor/core');
            scanBeepPlugin = registerPlugin<ScanBeepPlugin>('ZoeScanBeep');
        }
        return (await scanBeepPlugin.play())?.played === true;
    } catch { return false; }
}
