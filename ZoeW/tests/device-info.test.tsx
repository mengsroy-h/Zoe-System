/**
 * ⛔ សំណើម្ចាស់គម្រោង ៖ ស្គាល់ model ទូរស័ព្ទ និង «serial» ទាំង APK និង PWA ➜ បង្ហាញលើទូរស័ព្ទ (🩺 · ☰) ហើយកត់ចូលកៅអី Key ➜ ZoeKeyGen
 *    ឃើញថាកៅអីណាជាទូរស័ព្ទណា។ ការសម្រេចម្ចាស់គម្រោង ៖ serial = **Android ID** លើ APK (ស្ថិតស្ថេរលើទូរស័ព្ទនោះ · នៅដដែលពេលដំឡើង App
 *    ឡើងវិញ) · **ID App** (`ZoeLicense.getDeviceId()`) លើ PWA/iPhone/កុំព្យូទ័រ — serial ពិតរបស់ hardware អានមិនបាន (Android 10+ ហាម ·
 *    browser មិនផ្តល់)។
 * ⛔ APK ៖ plugin ក្នុង App `ZoeDevice` (`DeviceInfoPlugin.java`) · plugin ជា Proxy thenable ➜ មិន resolve promise ទៅ plugin ·
 *    PWA Android ៖ UA ត្រូវកាត់ (`Android 10; K`) ➜ model ពី `userAgentData.getHighEntropyValues()` (ពិដាន `DEVICE_INFO_TIMEOUT_MS`) ·
 *    iPhone ៖ ត្រឹម «iPhone» + កំណែ iOS · បរាជ័យ ➜ ធ្លាក់ទៅ UA មិនគាំង។
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
        step(() => { uiState.deviceInfo = { state: 'ready', model: 'iPhone', platform: 'iOS 17.5', serial: APP_SERIAL, serialKind: 'app-id' }; });
        expect(document.getElementById('testDeviceInfo')!.textContent).toContain('ID App');
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
