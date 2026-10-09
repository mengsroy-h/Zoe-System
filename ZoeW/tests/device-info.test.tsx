/**
 * ⛔ សំណើម្ចាស់គម្រោង ៖ ស្គាល់ model ទូរស័ព្ទ និង «serial» ទាំង APK និង PWA ➜ បង្ហាញលើទូរស័ព្ទ (🩺 · ☰) ហើយកត់ចូលកៅអី Key ➜ ZoeKeyGen
 *    ឃើញថាកៅអីណាជាទូរស័ព្ទណា។ ការសម្រេចម្ចាស់គម្រោង ៖ serial = **Android ID** លើ APK (ស្ថិតស្ថេរលើទូរស័ព្ទនោះ · នៅដដែលពេលដំឡើង App
 *    ឡើងវិញ) · **ID App** (`ZoeLicense.getDeviceId()`) លើ PWA/iPhone/កុំព្យូទ័រ — serial ពិតរបស់ hardware អានមិនបាន (Android 10+ ហាម ·
 *    browser មិនផ្តល់)។
 * ⛔ APK ៖ plugin ក្នុង App `ZoeDevice` (`DeviceInfoPlugin.java`) · plugin ជា Proxy thenable ➜ មិន resolve promise ទៅ plugin ·
 *    PWA Android ៖ UA ត្រូវកាត់ (`Android 10; K`) ➜ model ពី `userAgentData.getHighEntropyValues()` (ពិដាន `DEVICE_INFO_TIMEOUT_MS`) ·
 *    iPhone ៖ Safari មិនប្រាប់ model ➜ ស្គាល់ពីទំហំអេក្រង់ (`screen` ចំណុច) × `devicePixelRatio` × កំណែ iOS (`IPHONE_MODELS`) ·
 *    model ដែលមានអេក្រង់ដូចគ្នា ➜ បង្ហាញជាក្រុម «iPhone 16 Pro / 17 / 17 Pro» (ពិត ៖ web មិនអាចបំបែកបាន) · ទំហំមិនស្គាល់
 *    (Display Zoom · model ថ្មីមិនទាន់ក្នុងតារាង) ➜ «iPhone» ⛔ មិនទាយ · បរាជ័យ ➜ ធ្លាក់ទៅ UA មិនគាំង។
 * ⛔ សំណើម្ចាស់គម្រោង ៖ បន្ទាត់ model និង serial គ្មាន emoji (ZoeW ☰ · 🩺 និង ZoeKeyGen បញ្ជីកៅអី)។
 * ⛔ រាយការណ៍ម្ចាស់គម្រោង ៖ iPhone iOS 26.5 ពិត តែ ZoeW បង្ហាញ «iOS 18.7» ➜ Safari លើ iOS 26 បង្កកលេខ OS ក្នុង UA (18_6 ➜ 18_7) ដោយចេតនា
 *    ហើយ «Version/26.x» នៅតែពិត ➜ អាន Version ពេល ≥ 26 · UA គ្មាន Version (App លើ Home Screen) + OS បង្កក ➜ ពិនិត្យលក្ខណៈ engine Safari 26
 *    (`CSS.supports`) ➜ «iOS 26+» (មិនដឹងលេខរង) · ទិសផ្ទុយ ៖ iOS 18 ពិត · Chrome iOS (OS ពិត) ➜ ដដែល។
 * ⛔ ព័ត៌មាននេះជាការមើលតែប៉ុណ្ណោះ ៖ មិនមែនជួរ ✅/⚠️ របស់ 🩺 (ចំនួនជួរដដែល) · ផ្ញើទៅ License តាម `setDeviceMeta()` តែមួយ។
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
    info: null as null | (() => Promise<any>),
    calls: 0,
    registered: [] as string[]
}));

vi.mock('@capacitor/core', async (orig) => ({
    ...(await orig<any>()),
    registerPlugin: (name: string) => {
        h.registered.push(name);
        const api: any = { info: async () => { h.calls++; return h.info ? h.info() : {}; } };
        return new Proxy(api, {
            get(target, prop) {
                if (prop === '$$typeof') return undefined;
                if (prop === 'toJSON') return () => ({});
                if (typeof prop === 'string' && prop in target) return target[prop];
                return () => Promise.reject(new Error('"' + name + '.' + String(prop) + '()" is not implemented on android'));
            }
        });
    }
}));

import { uiState } from '../src/core/state';
import { DeviceInfoLine } from '../src/app/components/device/DeviceInfoLine';
import { mount, step, unmount } from './native/react-harness';

const SRC = path.join(__dirname, '..', 'src');
const APP_ID = 'E2AVNQR45577765XW83JRMBP';
const APP_SERIAL = createHash('sha256').update('zoew-device-serial:' + APP_ID).digest('hex').slice(0, 16);
const metaCalls: any[] = [];

function setUserAgent(ua: string, uad?: any) {
    Object.defineProperty(window.navigator, 'userAgent', { configurable: true, get: () => ua });
    Object.defineProperty(window.navigator, 'userAgentData', { configurable: true, get: () => uad });
}

function setScreen(width: number, height: number, ratio: number) {
    Object.defineProperty(window.screen, 'width', { configurable: true, get: () => width });
    Object.defineProperty(window.screen, 'height', { configurable: true, get: () => height });
    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, writable: true, value: ratio });
}

function resetScreen() {
    delete (window.screen as any).width;
    delete (window.screen as any).height;
    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, writable: true, value: 1 });
}

const EMOJI_RE = /\p{Extended_Pictographic}/u;
const IOS_175 = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const IOS_265 = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1';
const IOS_HOME_26 = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';

function withCssSupports(features: string[] | null) {
    const value = features ? { supports: (q: string) => features.includes(q) } : { supports: () => { throw new Error('no CSS.supports'); } };
    Object.defineProperty(window, 'CSS', { configurable: true, writable: true, value });
}

function asApk() {
    (window as any).androidBridge = { postMessage() {} };
    (window as any).Capacitor = { isNativePlatform: () => true, getPlatform: () => 'android' };
}

function withLicense() {
    (window as any).ZoeLicense = { getDeviceId: () => APP_ID, setDeviceMeta: (m: any) => { metaCalls.push(m); return m; } };
}

async function freshLoad() {
    vi.resetModules();
    const mod = await import('../src/features/device-info');
    const state = await import('../src/core/state');
    const info = await mod.loadDeviceInfo();
    return { mod, info, state: state.uiState };
}

beforeEach(() => {
    h.info = null;
    h.calls = 0;
    h.registered.length = 0;
    metaCalls.length = 0;
    withLicense();
    setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36', undefined);
});

afterEach(() => {
    vi.useRealTimers();
    unmount();
    document.body.innerHTML = '';
    delete (window as any).Capacitor;
    delete (window as any).androidBridge;
    delete (window as any).ZoeLicense;
    delete (window as any).CSS;
    resetScreen();
});

describe('ស្គាល់ model · serial របស់ឧបករណ៍ (APK · PWA)', () => {
    it('⛔ APK ៖ plugin ZoeDevice ➜ «Samsung SM-A546E» · Android 14 · serial = Android ID · ផ្ញើទៅ License', async () => {
        asApk();
        h.info = async () => ({ manufacturer: 'samsung', brand: 'samsung', model: 'SM-A546E', release: '14', sdk: 34, androidId: '1A2B3C4D5E6F7890' });
        const { info, state } = await freshLoad();
        expect(h.registered).toEqual(['ZoeDevice']);
        expect(info).toEqual({ state: 'ready', model: 'Samsung SM-A546E', platform: 'Android 14', serial: '1a2b3c4d5e6f7890', serialKind: 'android-id' });
        expect(state.deviceInfo).toEqual(info);
        expect(metaCalls).toEqual([{ model: 'Samsung SM-A546E', platform: 'Android 14', serial: '1a2b3c4d5e6f7890' }]);
    });

    it('APK ៖ ឈ្មោះក្រុមហ៊ុនមិនស្ទួន (model ចាប់ផ្តើមដោយក្រុមហ៊ុនរួច) · Pixel', async () => {
        const { nativeModelName } = await import('../src/features/device-info');
        expect(nativeModelName('Xiaomi', 'Xiaomi 13T')).toBe('Xiaomi 13T');
        expect(nativeModelName('Google', 'Pixel 7')).toBe('Google Pixel 7');
        expect(nativeModelName('', 'SM-A546E')).toBe('SM-A546E');
        expect(nativeModelName('OPPO', '')).toBe('OPPO');
        expect(nativeModelName(undefined, null)).toBe('');
    });

    it('⛔ APK ៖ plugin បរាជ័យ ➜ ធ្លាក់ទៅ UA + ID App (មិនគាំង)', async () => {
        asApk();
        setUserAgent('Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 Chrome/129.0 Mobile Safari/537.36', undefined);
        h.info = async () => { throw new Error('"ZoeDevice.info()" is not implemented on android'); };
        const { info } = await freshLoad();
        expect(info.platform).toBe('Android 10');
        expect(info.model).toBe('');
        expect(info.serial).toBe(APP_SERIAL);
        expect(info.serialKind).toBe('app-id');
    });

    it('⛔ PWA Android ៖ UA កាត់ (K) ➜ model ពី userAgentData · Android 14 · serial = ID App', async () => {
        setUserAgent('Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 Chrome/129.0 Mobile Safari/537.36', {
            platform: 'Android',
            getHighEntropyValues: async (hints: string[]) => ({ platform: 'Android', model: hints.includes('model') ? 'SM-A546E' : '', platformVersion: '14.0.0' })
        });
        const { info } = await freshLoad();
        expect(h.calls).toBe(0);
        expect(info).toEqual({ state: 'ready', model: 'SM-A546E', platform: 'Android 14', serial: APP_SERIAL, serialKind: 'app-id' });
        expect(metaCalls).toEqual([{ model: 'SM-A546E', platform: 'Android 14', serial: APP_SERIAL }]);
        expect(JSON.stringify(metaCalls)).not.toContain(APP_ID);
    });

    it('⛔ PWA ៖ userAgentData ជាប់ (hang) ➜ ធ្លាក់ទៅ UA ក្រោយ DEVICE_INFO_TIMEOUT_MS', async () => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
        setUserAgent('Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36', {
            platform: 'Android',
            getHighEntropyValues: () => new Promise(() => {})
        });
        vi.resetModules();
        const mod = await import('../src/features/device-info');
        const pending = mod.loadDeviceInfo();
        await vi.advanceTimersByTimeAsync(mod.DEVICE_INFO_TIMEOUT_MS + 10);
        const info = await pending;
        expect(info.model).toBe('SM-S918B');
        expect(info.platform).toBe('Android 13');
    });

    it('⛔ serial របស់ ID App = ស្នាម SHA-256 ១៦ តួ (ស្ថិតស្ថេរ) · ⛔ មិនមែនលេខសម្គាល់កៅអីពេញ', async () => {
        const { appSerialOf } = await import('../src/features/device-info');
        const a = await appSerialOf(APP_ID);
        expect(a).toBe(APP_SERIAL);
        expect(a).toMatch(/^[0-9a-f]{16}$/);
        expect(await appSerialOf(APP_ID)).toBe(a);
        expect(await appSerialOf('OTHERDEVICE0000000001')).not.toBe(a);
        expect(a).not.toContain(APP_ID.slice(0, 6).toLowerCase());
        expect(await appSerialOf('')).toBe('');
    });

    it('iPhone PWA ៖ «iPhone» + កំណែ iOS · serial = ID App', async () => {
        setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1', undefined);
        const { info } = await freshLoad();
        expect(info.model).toBe('iPhone');
        expect(info.platform).toBe('iOS 17.5');
        expect(info.serial).toBe(APP_SERIAL);
    });

    it('⛔ iPhone iOS 26 ៖ Safari បង្កក «OS 18_7» ក្នុង UA (ចេតនា Apple) ➜ កំណែពិតពី «Version/26.5» មិនមែន 18.7', async () => {
        setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1', undefined);
        const { info } = await freshLoad();
        expect(info.model).toBe('iPhone');
        expect(info.platform).toBe('iOS 26.5');
    });

    it('⛔ iPhone iOS 26 App លើ Home Screen (UA គ្មាន «Version/») ៖ «OS 18_7» បង្កក + engine Safari 26 ➜ «iOS 26+» មិនមែន 18.7', async () => {
        setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148', undefined);
        withCssSupports(['anchor-name: --zoe']);
        const { info } = await freshLoad();
        expect(info.platform).toBe('iOS 26+');
        withCssSupports(['animation-timeline: scroll()']);
        expect((await freshLoad()).info.platform).toBe('iOS 26+');
    });

    it('ទិសផ្ទុយ ៖ iOS 18.7 ពិត (Version/18.7 · ឬគ្មាន Version និង engine មិនទាន់ 26) ➜ «iOS 18.7» · iOS 18.5 មិនបង្កក ➜ ដដែល · Chrome iOS (OS 26_0 ពិត) ➜ «iOS 26.0»', async () => {
        const { deviceFromUserAgent } = await import('../src/features/device-info');
        const safari187 = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7 Mobile/15E148 Safari/604.1';
        const home187 = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';
        const home185 = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';
        const chrome26 = 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/140.0.7339.122 Mobile/15E148 Safari/604.1';
        expect(deviceFromUserAgent(safari187, true).platform).toBe('iOS 18.7');
        expect(deviceFromUserAgent(home187, false).platform).toBe('iOS 18.7');
        expect(deviceFromUserAgent(home187).platform).toBe('iOS 18.7');
        expect(deviceFromUserAgent(home185, true).platform).toBe('iOS 18.5');
        expect(deviceFromUserAgent(chrome26, true).platform).toBe('iOS 26.0');
        expect(deviceFromUserAgent(chrome26, false).model).toBe('iPhone');
        expect(deviceFromUserAgent(home187.replace('Mobile/', 'Version/99999999999999999999.5 Mobile/'), true).platform).toBe('iOS 26+');
        expect(deviceFromUserAgent(safari187.replace('Version/18.7', 'Version/26.5.1'), false).platform).toBe('iOS 26.5');
        expect(deviceFromUserAgent(safari187.replace('Version/18.7', 'Version/18.7.2'), true).platform).toBe('iOS 18.7');
        setUserAgent(home187, undefined);
        withCssSupports([]);
        expect((await freshLoad()).info.platform).toBe('iOS 18.7');
        withCssSupports(null);
        expect((await freshLoad()).info.platform).toBe('iOS 18.7');
    });

    it('⛔ License មិនទាន់ផ្ទុក ➜ គ្មាន serial ហើយការហៅលើកក្រោយសាកម្តងទៀត ➜ ផ្ញើ meta ពេល License មក', async () => {
        delete (window as any).ZoeLicense;
        const { mod, info } = await freshLoad();
        expect(info.serial).toBe('');
        expect(metaCalls).toEqual([]);
        withLicense();
        const again = await mod.loadDeviceInfo();
        expect(again.serial).toBe(APP_SERIAL);
        expect(metaCalls.length).toBe(1);
        const third = await mod.loadDeviceInfo();
        expect(third).toBe(again);
        expect(metaCalls.length).toBe(1);
    });

    it('⛔ iPhone ៖ model ពីទំហំអេក្រង់ × pixel ratio × កំណែ iOS · ក្រុម model អេក្រង់ដូចគ្នា · ទំហំមិនស្គាល់ ➜ «iPhone»', async () => {
        const { iphoneModelFromScreen } = await import('../src/features/device-info');
        expect(iphoneModelFromScreen(402, 874, 3, 'iOS 26.5')).toBe('iPhone 16 Pro / 17 / 17 Pro');
        expect(iphoneModelFromScreen(402, 874, 3, 'iOS 26+')).toBe('iPhone 16 Pro / 17 / 17 Pro / 18 Pro');
        expect(iphoneModelFromScreen(402, 874, 3, 'iOS 27.0')).toBe('iPhone 16 Pro / 17 / 17 Pro / 18 Pro');
        expect(iphoneModelFromScreen(402, 874, 3, 'iOS 18.5')).toBe('iPhone 16 Pro');
        expect(iphoneModelFromScreen(393, 852, 3, 'iOS 17.5')).toBe('iPhone 14 Pro / 15 / 15 Pro');
        expect(iphoneModelFromScreen(393, 852, 3, 'iOS 16.2')).toBe('iPhone 14 Pro');
        expect(iphoneModelFromScreen(393, 852, 3, 'iOS 26+')).toBe('iPhone 14 Pro / 15 / 15 Pro / 16');
        expect(iphoneModelFromScreen(440, 956, 3, 'iOS 26.1')).toBe('iPhone 16 Pro Max / 17 Pro Max');
        expect(iphoneModelFromScreen(430, 932, 3, 'iOS 26+')).toBe('iPhone 14 Pro Max / 15 Plus / 15 Pro Max / 16 Plus');
        expect(iphoneModelFromScreen(428, 926, 3, 'iOS 26+')).toBe('iPhone 12 Pro Max / 13 Pro Max / 14 Plus');
        expect(iphoneModelFromScreen(390, 844, 3, 'iOS 18.2')).toBe('iPhone 12 / 12 Pro / 13 / 13 Pro / 14');
        expect(iphoneModelFromScreen(390, 844, 3, 'iOS 26+')).toBe('iPhone 12 / 12 Pro / 13 / 13 Pro / 14 / 16e / 17e');
        expect(iphoneModelFromScreen(420, 912, 3, 'iOS 26+')).toBe('iPhone Air');
        expect(iphoneModelFromScreen(375, 812, 3, 'iOS 26+')).toBe('iPhone 11 Pro / 12 mini / 13 mini');
        expect(iphoneModelFromScreen(375, 812, 3, 'iOS 16.7')).toBe('iPhone X / XS / 11 Pro / 12 mini / 13 mini');
        expect(iphoneModelFromScreen(360, 780, 3, 'iOS 26+')).toBe('iPhone 12 mini / 13 mini');
        expect(iphoneModelFromScreen(414, 896, 2, 'iOS 18.7')).toBe('iPhone XR / 11');
        expect(iphoneModelFromScreen(414, 896, 2, 'iOS 26+')).toBe('iPhone 11');
        expect(iphoneModelFromScreen(414, 896, 3, 'iOS 26+')).toBe('iPhone 11 Pro Max');
        expect(iphoneModelFromScreen(375, 667, 2, 'iOS 26+')).toBe('iPhone SE (2nd gen) / SE (3rd gen)');
        expect(iphoneModelFromScreen(375, 667, 2, 'iOS 15.8')).toBe('iPhone 6s / 7 / 8 / SE (2nd gen) / SE (3rd gen)');
        expect(iphoneModelFromScreen(874, 402, 3, 'iOS 26.5')).toBe('iPhone 16 Pro / 17 / 17 Pro');
        expect(iphoneModelFromScreen(375, 812, 2.88, 'iOS 26+')).toBe('iPhone 11 Pro / 12 mini / 13 mini');
        expect(iphoneModelFromScreen(320, 693, 3, 'iOS 26+')).toBe('');
        expect(iphoneModelFromScreen(402, 874, 2, 'iOS 26+')).toBe('');
        expect(iphoneModelFromScreen(402, 874, 3, 'iOS 17.5')).toBe('');
        expect(iphoneModelFromScreen(0, 0, 1, 'iOS 26+')).toBe('');
        expect(iphoneModelFromScreen(NaN, undefined, null, undefined)).toBe('');
        expect(iphoneModelFromScreen(-402, -874, 3, 'iOS 26+')).toBe('');
        expect(iphoneModelFromScreen(402, 874, 3, '')).toBe('iPhone 16 Pro / 17 / 17 Pro / 18 Pro');
    });

    it('⛔ ស្លាក model iPhone គ្រប់ទំហំ ≤ ៨០ តួ (ព្រំដែន rules `model` 1–80 ក្នុងកៅអី License) · គ្មានឈ្មោះស្ទួន', async () => {
        const { IPHONE_MODELS, iphoneModelFromScreen } = await import('../src/features/device-info');
        const names = IPHONE_MODELS.map((m) => m.name);
        expect(new Set(names).size).toBe(names.length);
        const screens = new Set(IPHONE_MODELS.flatMap((m) => m.screens.map((s) => s.join('x'))));
        expect(screens.size).toBeGreaterThanOrEqual(12);
        for (const key of screens) {
            const [w, h, r] = key.split('x').map(Number);
            const label = iphoneModelFromScreen(w, h, r, '');
            expect(label.length, key).toBeGreaterThan(0);
            expect(label.length, key).toBeLessThanOrEqual(80);
        }
    });

    it('⛔ iPhone PWA ពិត ៖ loadDeviceInfo ផ្ញើ model ក្រុមទៅ License · Home Screen iOS 26+ · Safari iOS 17.5 · ទំហំមិនស្គាល់ ➜ «iPhone»', async () => {
        setScreen(402, 874, 3);
        setUserAgent(IOS_HOME_26, undefined);
        withCssSupports(['anchor-name: --zoe']);
        let loaded = await freshLoad();
        expect(loaded.info.model).toBe('iPhone 16 Pro / 17 / 17 Pro / 18 Pro');
        expect(loaded.info.platform).toBe('iOS 26+');
        expect(metaCalls[metaCalls.length - 1]).toEqual({ model: 'iPhone 16 Pro / 17 / 17 Pro / 18 Pro', platform: 'iOS 26+', serial: APP_SERIAL });
        setUserAgent(IOS_265, undefined);
        loaded = await freshLoad();
        expect(loaded.info.model).toBe('iPhone 16 Pro / 17 / 17 Pro');
        setScreen(393, 852, 3);
        setUserAgent(IOS_175, undefined);
        loaded = await freshLoad();
        expect(loaded.info.model).toBe('iPhone 14 Pro / 15 / 15 Pro');
        expect(loaded.info.platform).toBe('iOS 17.5');
        setScreen(320, 693, 3);
        loaded = await freshLoad();
        expect(loaded.info.model).toBe('iPhone');
    });

    it('UI ៖ បន្ទាត់ឧបករណ៍បង្ហាញ model · platform · serial (តែពេល ready)', () => {
        step(() => { uiState.deviceInfo = { state: 'checking', model: '', platform: '', serial: '', serialKind: '' }; });
        mount(<DeviceInfoLine id="testDeviceInfo" />);
        expect(document.getElementById('testDeviceInfo')).toBe(null);
        step(() => { uiState.deviceInfo = { state: 'ready', model: 'Samsung SM-A546E', platform: 'Android 14', serial: '1a2b3c4d5e6f7890', serialKind: 'android-id' }; });
        const text = document.getElementById('testDeviceInfo')!.textContent || '';
        expect(text).toContain('Samsung SM-A546E');
        expect(text).toContain('Android 14');
        expect(text).toContain('Android ID');
        expect(text).toContain('1a2b3c4d5e6f7890');
        expect(text, 'ZoeW ៖ បន្ទាត់ model · serial គ្មាន emoji').not.toMatch(EMOJI_RE);
        step(() => { uiState.deviceInfo = { state: 'ready', model: 'iPhone 16 Pro / 17 / 17 Pro', platform: 'iOS 26.5', serial: APP_SERIAL, serialKind: 'app-id' }; });
        const iphoneText = document.getElementById('testDeviceInfo')!.textContent || '';
        expect(iphoneText).toContain('ID App');
        expect(iphoneText).toContain('iPhone 16 Pro / 17 / 17 Pro · iOS 26.5');
        expect(iphoneText).not.toMatch(EMOJI_RE);
    });

    it('⛔ ខ្សែភ្ជាប់ ៖ ☰ footer និង 🩺 គូរបន្ទាត់ឧបករណ៍ · boot · បើក 🩺 ហៅ loadDeviceInfo · ⛔ ផ្លូវ Activation មិនប៉ះ · មិនមែនជួរ 🩺', () => {
        const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), 'utf8');
        expect(read('app/components/SideDrawer.tsx')).toMatch(/<DeviceInfoLine id="drawerDeviceInfo" \/>/);
        expect(read('app/components/modals/HealthCheckModal.tsx')).toMatch(/<DeviceInfoLine id="healthDeviceInfo" \/>/);
        expect(read('app/lifecycle/boot.ts')).toMatch(/loadDeviceInfo\(\);/);
        expect(read('features/license.ts')).not.toMatch(/loadDeviceInfo/);
        expect(read('features/health-check.ts')).toMatch(/export function openHealthCheck\(\) \{[^}]*loadDeviceInfo\(\);/);
        expect(read('app/components/device/DeviceInfoLine.tsx')).not.toMatch(/health-row/);
    });
});
