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
const IOS_FROZEN_MAJOR = 18;
const IOS_FROZEN_MINOR = 6;
const IOS_UNFROZEN_MAJOR = 26;
const SAFARI_26_FEATURES = ['anchor-name: --zoe', 'animation-timeline: scroll()'];
const IOS_SUPPORTED = 999;

type IphoneModel = { name: string; screens: Array<[number, number, number]>; ios: [number, number, number] };

export const IPHONE_MODELS: IphoneModel[] = [
    { name: 'iPhone SE (1st gen)', screens: [[320, 568, 2]], ios: [9, 3, 15] },
    { name: 'iPhone 6s', screens: [[375, 667, 2]], ios: [9, 0, 15] },
    { name: 'iPhone 6s Plus', screens: [[414, 736, 3]], ios: [9, 0, 15] },
    { name: 'iPhone 7', screens: [[375, 667, 2]], ios: [10, 0, 15] },
    { name: 'iPhone 7 Plus', screens: [[414, 736, 3]], ios: [10, 0, 15] },
    { name: 'iPhone 8', screens: [[375, 667, 2]], ios: [11, 0, 16] },
    { name: 'iPhone 8 Plus', screens: [[414, 736, 3]], ios: [11, 0, 16] },
    { name: 'iPhone X', screens: [[375, 812, 3]], ios: [11, 0, 16] },
    { name: 'iPhone XS', screens: [[375, 812, 3]], ios: [12, 0, 18] },
    { name: 'iPhone XS Max', screens: [[414, 896, 3]], ios: [12, 0, 18] },
    { name: 'iPhone XR', screens: [[414, 896, 2]], ios: [12, 0, 18] },
    { name: 'iPhone 11', screens: [[414, 896, 2]], ios: [13, 0, IOS_SUPPORTED] },
    { name: 'iPhone 11 Pro', screens: [[375, 812, 3]], ios: [13, 0, IOS_SUPPORTED] },
    { name: 'iPhone 11 Pro Max', screens: [[414, 896, 3]], ios: [13, 0, IOS_SUPPORTED] },
    { name: 'iPhone SE (2nd gen)', screens: [[375, 667, 2]], ios: [13, 4, IOS_SUPPORTED] },
    { name: 'iPhone 12 mini', screens: [[375, 812, 3], [360, 780, 3]], ios: [14, 1, IOS_SUPPORTED] },
    { name: 'iPhone 12', screens: [[390, 844, 3]], ios: [14, 1, IOS_SUPPORTED] },
    { name: 'iPhone 12 Pro', screens: [[390, 844, 3]], ios: [14, 1, IOS_SUPPORTED] },
    { name: 'iPhone 12 Pro Max', screens: [[428, 926, 3]], ios: [14, 1, IOS_SUPPORTED] },
    { name: 'iPhone 13 mini', screens: [[375, 812, 3], [360, 780, 3]], ios: [15, 0, IOS_SUPPORTED] },
    { name: 'iPhone 13', screens: [[390, 844, 3]], ios: [15, 0, IOS_SUPPORTED] },
    { name: 'iPhone 13 Pro', screens: [[390, 844, 3]], ios: [15, 0, IOS_SUPPORTED] },
    { name: 'iPhone 13 Pro Max', screens: [[428, 926, 3]], ios: [15, 0, IOS_SUPPORTED] },
    { name: 'iPhone SE (3rd gen)', screens: [[375, 667, 2]], ios: [15, 4, IOS_SUPPORTED] },
    { name: 'iPhone 14', screens: [[390, 844, 3]], ios: [16, 0, IOS_SUPPORTED] },
    { name: 'iPhone 14 Plus', screens: [[428, 926, 3]], ios: [16, 0, IOS_SUPPORTED] },
    { name: 'iPhone 14 Pro', screens: [[393, 852, 3]], ios: [16, 0, IOS_SUPPORTED] },
    { name: 'iPhone 14 Pro Max', screens: [[430, 932, 3]], ios: [16, 0, IOS_SUPPORTED] },
    { name: 'iPhone 15', screens: [[393, 852, 3]], ios: [17, 0, IOS_SUPPORTED] },
    { name: 'iPhone 15 Plus', screens: [[430, 932, 3]], ios: [17, 0, IOS_SUPPORTED] },
    { name: 'iPhone 15 Pro', screens: [[393, 852, 3]], ios: [17, 0, IOS_SUPPORTED] },
    { name: 'iPhone 15 Pro Max', screens: [[430, 932, 3]], ios: [17, 0, IOS_SUPPORTED] },
    { name: 'iPhone 16', screens: [[393, 852, 3]], ios: [18, 0, IOS_SUPPORTED] },
    { name: 'iPhone 16 Plus', screens: [[430, 932, 3]], ios: [18, 0, IOS_SUPPORTED] },
    { name: 'iPhone 16 Pro', screens: [[402, 874, 3]], ios: [18, 0, IOS_SUPPORTED] },
    { name: 'iPhone 16 Pro Max', screens: [[440, 956, 3]], ios: [18, 0, IOS_SUPPORTED] },
    { name: 'iPhone 16e', screens: [[390, 844, 3]], ios: [18, 3, IOS_SUPPORTED] },
    { name: 'iPhone 17', screens: [[402, 874, 3]], ios: [26, 0, IOS_SUPPORTED] },
    { name: 'iPhone Air', screens: [[420, 912, 3]], ios: [26, 0, IOS_SUPPORTED] },
    { name: 'iPhone 17 Pro', screens: [[402, 874, 3]], ios: [26, 0, IOS_SUPPORTED] },
    { name: 'iPhone 17 Pro Max', screens: [[440, 956, 3]], ios: [26, 0, IOS_SUPPORTED] },
    { name: 'iPhone 17e', screens: [[390, 844, 3]], ios: [26, 0, IOS_SUPPORTED] },
    { name: 'iPhone 18 Pro', screens: [[402, 874, 3]], ios: [27, 0, IOS_SUPPORTED] },
    { name: 'iPhone 18 Pro Max', screens: [[440, 956, 3]], ios: [27, 0, IOS_SUPPORTED] }
];

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

export function webKitAtLeast26(): boolean {
    try {
        const css: any = (window as any).CSS;
        if (!css || typeof css.supports !== 'function') return false;
        return SAFARI_26_FEATURES.some((q) => css.supports(q) === true);
    } catch (e) {
        return false;
    }
}

function applePlatform(ua: string, major: string, minor: string, engine26: boolean): string {
    const safari = /\bVersion\/(\d{1,3})(?:\.(\d{1,3}))?(?:\.\d{1,3})?(?![\d.])/.exec(ua);
    if (safari && Number(safari[1]) >= IOS_UNFROZEN_MAJOR) return 'iOS ' + safari[1] + (safari[2] ? '.' + safari[2] : '');
    const frozen = Number(major) === IOS_FROZEN_MAJOR && Number(minor) >= IOS_FROZEN_MINOR;
    if (frozen && !safari && engine26) return 'iOS ' + IOS_UNFROZEN_MAJOR + '+';
    return 'iOS ' + major + '.' + minor;
}

function iosVersionOf(platform: unknown): { major: number; minor: number; atLeast: boolean } | null {
    const m = /^iOS (\d{1,3})(?:\.(\d{1,3}))?(\+)?$/.exec(typeof platform === 'string' ? platform : '');
    return m ? { major: Number(m[1]), minor: Number(m[2] || 0), atLeast: m[3] === '+' } : null;
}

function iosFitsModel(range: [number, number, number], v: { major: number; minor: number; atLeast: boolean }): boolean {
    if (v.atLeast) return range[2] >= v.major;
    const released = v.major > range[0] || (v.major === range[0] && v.minor >= range[1]);
    return released && v.major <= range[2];
}

export function iphoneModelFromScreen(width: unknown, height: unknown, pixelRatio: unknown, platform: unknown): string {
    const w = Number(width);
    const h = Number(height);
    const ratio = Math.round(Number(pixelRatio));
    if (!(w > 0) || !(h > 0) || !(ratio > 0)) return '';
    const short = Math.round(Math.min(w, h));
    const long = Math.round(Math.max(w, h));
    const ios = iosVersionOf(platform);
    const names = IPHONE_MODELS.filter((m) => m.screens.some((s) => s[0] === short && s[1] === long && s[2] === ratio)
        && (!ios || iosFitsModel(m.ios, ios))).map((m) => m.name);
    return names.map((n, i) => (i === 0 ? n : n.replace(/^iPhone /, ''))).join(' / ');
}

export function deviceFromUserAgent(ua: unknown, engine26 = false): { model: string; platform: string } {
    const s = typeof ua === 'string' ? ua : '';
    const apple = /\b(iPhone|iPad|iPod)\b[^)]*?OS (\d+)[_.](\d+)/.exec(s);
    if (apple) return { model: apple[1], platform: applePlatform(s, apple[2], apple[3], engine26 === true) };
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
    const fromUa = deviceFromUserAgent(nav && nav.userAgent, webKitAtLeast26());
    let model = fromUa.model;
    let platform = fromUa.platform;
    if (model === 'iPhone') {
        const scr: any = window.screen;
        model = iphoneModelFromScreen(scr && scr.width, scr && scr.height, window.devicePixelRatio, platform) || model;
    }
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
