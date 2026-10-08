import { uiState } from '../core/state';
import { isNativeAndroid } from '../platform/native';
import { withTimeout } from '../services/network';

export const DEVICE_PLUGIN_NAME = 'ZoeDevice';
export const DEVICE_INFO_TIMEOUT_MS = 4000;

export type DeviceInfo = {
    state: 'idle' | 'checking' | 'ready';
    model: string;
    platform: string;
    serial: string;
    serialKind: 'android-id' | 'app-id' | '';
};

const ANDROID_ID_RE = /^[0-9a-fA-F]{8,32}$/;
const APP_SERIAL_SALT = 'zoew-device-serial:';
const APP_SERIAL_BYTES = 8;
const REDUCED_UA_MODEL = 'K';

let devicePending: Promise<DeviceInfo> | null = null;

function cleanDeviceText(value: unknown, max: number): string {
    if (typeof value !== 'string') return '';
    const text = value.replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028\u2029\u2060\ufeff]/g, '').replace(/\s+/g, ' ').trim();
    return text.length > max ? text.slice(0, max).trim() : text;
}

function titleCase(word: string): string {
    return word ? word.charAt(0).toUpperCase() + word.slice(1) : '';
}

export function nativeModelName(manufacturer: unknown, model: unknown): string {
    const maker = cleanDeviceText(manufacturer, 40);
    const name = cleanDeviceText(model, 80);
    if (!maker) return name;
    if (!name) return titleCase(maker);
    if (name.toLowerCase().indexOf(maker.toLowerCase()) === 0) return name;
    return cleanDeviceText(titleCase(maker) + ' ' + name, 80);
}

export function deviceFromUserAgent(ua: unknown): { model: string; platform: string } {
    const s = typeof ua === 'string' ? ua : '';
    const apple = /\b(iPhone|iPad|iPod)\b[^)]*?OS (\d+)[_.](\d+)/.exec(s);
    if (apple) return { model: apple[1], platform: 'iOS ' + apple[2] + '.' + apple[3] };
    const android = /Android (\d+(?:\.\d+)?)(?:;\s*([^;)]+))?/.exec(s);
    if (android) {
        const name = cleanDeviceText((android[2] || '').replace(/\s*Build\/.*$/, ''), 80);
        return { model: name && name !== REDUCED_UA_MODEL ? name : '', platform: 'Android ' + android[1] };
    }
    if (/Windows NT/.test(s)) return { model: '', platform: 'Windows' };
    if (/CrOS/.test(s)) return { model: '', platform: 'ChromeOS' };
    if (/Mac OS X|Macintosh/.test(s)) return { model: '', platform: 'macOS' };
    if (/Linux/.test(s)) return { model: '', platform: 'Linux' };
    return { model: '', platform: '' };
}

async function webDeviceInfo(): Promise<{ model: string; platform: string }> {
    const nav: any = window.navigator;
    const fromUa = deviceFromUserAgent(nav && nav.userAgent);
    let model = fromUa.model;
    let platform = fromUa.platform;
    const uad = nav && nav.userAgentData;
    if (uad && typeof uad.getHighEntropyValues === 'function') {
        try {
            const hints: any = await withTimeout(Promise.resolve().then(() => uad.getHighEntropyValues(['model', 'platformVersion'])),
                DEVICE_INFO_TIMEOUT_MS, 'Device hints timed out');
            const hintModel = cleanDeviceText(hints && hints.model, 80);
            const hintPlatform = cleanDeviceText((hints && hints.platform) || uad.platform, 40);
            const major = cleanDeviceText(hints && hints.platformVersion, 20).split('.')[0];
            if (hintModel) model = hintModel;
            if (hintPlatform === 'Android' && /^\d+$/.test(major)) platform = 'Android ' + major;
            else if (hintPlatform && !platform) platform = hintPlatform;
        } catch (e) {}
    }
    return { model: model, platform: platform };
}

async function nativeDeviceInfo(): Promise<{ model: string; platform: string; serial: string }> {
    const core = await import('@capacitor/core');
    const ZD: any = core.registerPlugin(DEVICE_PLUGIN_NAME);
    const info: any = await ZD.info();
    const release = cleanDeviceText(info && info.release, 20);
    const androidId = cleanDeviceText(info && info.androidId, 32);
    return {
        model: nativeModelName(info && info.manufacturer, info && info.model),
        platform: release ? 'Android ' + release : 'Android',
        serial: ANDROID_ID_RE.test(androidId) ? androidId.toLowerCase() : ''
    };
}

function licenseDeviceId(): string {
    try {
        const lic: any = window.ZoeLicense;
        if (!lic || typeof lic.getDeviceId !== 'function') return '';
        return cleanDeviceText(lic.getDeviceId(), 64);
    } catch (e) {
        return '';
    }
}

export async function appSerialOf(appId: string): Promise<string> {
    if (!appId) return '';
    try {
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(APP_SERIAL_SALT + appId));
        return Array.from(new Uint8Array(digest).slice(0, APP_SERIAL_BYTES)).map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
        return '';
    }
}

function shareWithLicense(info: DeviceInfo): boolean {
    try {
        const lic: any = window.ZoeLicense;
        if (!lic || typeof lic.setDeviceMeta !== 'function') return false;
        lic.setDeviceMeta({ model: info.model, platform: info.platform, serial: info.serial });
        return true;
    } catch (e) {
        return false;
    }
}

export function loadDeviceInfo(): Promise<DeviceInfo> {
    if (devicePending) return devicePending;
    if (uiState.deviceInfo.state !== 'ready') uiState.deviceInfo = { ...uiState.deviceInfo, state: 'checking' };
    const run = (async (): Promise<DeviceInfo> => {
        let model = '';
        let platform = '';
        let serial = '';
        let serialKind: DeviceInfo['serialKind'] = '';
        if (isNativeAndroid()) {
            try {
                const native = await withTimeout(nativeDeviceInfo(), DEVICE_INFO_TIMEOUT_MS, 'Device info timed out');
                model = native.model;
                platform = native.platform;
                if (native.serial) { serial = native.serial; serialKind = 'android-id'; }
            } catch (e) {}
        }
        if (!model && !platform) {
            const web = await webDeviceInfo();
            model = web.model;
            platform = web.platform;
        }
        const appId = serial ? '' : licenseDeviceId();
        if (appId) {
            serial = await withTimeout(appSerialOf(appId), DEVICE_INFO_TIMEOUT_MS, 'Device serial timed out').catch(() => '');
            if (serial) serialKind = 'app-id';
        }
        const info: DeviceInfo = { state: 'ready', model: model, platform: platform, serial: serial, serialKind: serialKind };
        uiState.deviceInfo = info;
        const licenseLoaded = shareWithLicense(info) || !!window.ZoeLicense;
        if (!licenseLoaded || !serial) devicePending = null;
        return info;
    })();
    devicePending = run;
    return run;
}
