/**
 * ⛔ សំណើម្ចាស់គម្រោង ៖ «lock កុំអោយផ្តេកបានលើទូរស័ព្ទទាំងអស់ តែសម្រាប់ tablet អោយផ្តេកបាន»។
 *    ទូរស័ព្ទ = ទទឹងតូចបំផុតរបស់អេក្រង់ < TABLET_MIN_WIDTH_PX (600 · ស្តង់ដារ Android sw600dp) ➜ បញ្ឈរ · tablet (≥ 600 · foldable ពេលបើក) ➜ បង្វិលបាន។
 *    APK ៖ `MainActivity` (`orientationFor()` ក្នុង onCreate និង onConfigurationChanged) · PWA Android ដែលដំឡើង (standalone/fullscreen) ៖
 *    `screen.orientation.lock()` (manifest `portrait-primary` ចាក់សោទូរស័ព្ទរួចហើយ ➜ tablet សុំ `any`) · Browser tab · iPhone · iPad · កុំព្យូទ័រ ➜
 *    មិនហៅទេ (Apple មិនឲ្យ web app ចាក់សោទិស · tab មិនមែន fullscreen) · lock បដិសេធ ឬគ្មាន ➜ មិនបោះ (fail-open)។
 */
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Mod = typeof import('../src/platform/orientation');

let calls: string[];
let lockImpl: ((o: string) => unknown) | null;
let displayMode: string;

function setScreen(width: number, height: number) {
    Object.defineProperty(window, 'screen', {
        configurable: true,
        value: {
            width,
            height,
            orientation: lockImpl === null ? {} : { type: 'portrait-primary', lock: (o: string) => { calls.push(o); return lockImpl!(o); } }
        }
    });
}

async function load(): Promise<Mod> {
    vi.resetModules();
    return import('../src/platform/orientation');
}

beforeEach(() => {
    calls = [];
    lockImpl = () => Promise.resolve();
    displayMode = 'standalone';
    Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        value: (q: string) => ({ matches: q === '(display-mode: ' + displayMode + ')' })
    });
    Object.defineProperty(window.navigator, 'userAgentData', { configurable: true, value: { platform: 'Android' } });
    (window as any).Capacitor = undefined;
});

afterEach(() => {
    Object.defineProperty(window.navigator, 'userAgentData', { configurable: true, value: undefined });
    (window as any).Capacitor = undefined;
});

describe('ទិសអេក្រង់ ៖ ទូរស័ព្ទចាក់សោបញ្ឈរ · tablet បង្វិលបាន', () => {
    it('⛔ PWA Android ទូរស័ព្ទ (412×915 · ផ្តេក 915×412) ➜ lock(portrait-primary) ម្តង · resize មិនហៅម្តងទៀត · foldable បើក (673×841) ➜ any', async () => {
        const m = await load();
        setScreen(412, 915);
        m.applyOrientationLock();
        m.applyOrientationLock();
        expect(calls).toEqual(['portrait-primary']);
        setScreen(915, 412);
        m.applyOrientationLock();
        expect(calls).toEqual(['portrait-primary']);
        setScreen(673, 841);
        m.applyOrientationLock();
        expect(calls).toEqual(['portrait-primary', 'any']);
        setScreen(360, 780);
        m.applyOrientationLock();
        expect(calls).toEqual(['portrait-primary', 'any', 'portrait-primary']);
    });

    it('⛔ PWA Android tablet (800×1280 · 1280×800 · 600×960) ➜ any · fullscreen ក៏ដូចគ្នា · ទូរស័ព្ទធំ 599 ➜ បញ្ឈរ', async () => {
        for (const [w, h, want] of [[800, 1280, 'any'], [1280, 800, 'any'], [600, 960, 'any'], [599, 900, 'portrait-primary']] as const) {
            const m = await load();
            calls = [];
            setScreen(w, h);
            expect(m.orientationLockFor()).toBe(want);
            m.applyOrientationLock();
            expect(calls).toEqual([want]);
        }
        displayMode = 'fullscreen';
        const m = await load();
        calls = [];
        setScreen(412, 915);
        m.applyOrientationLock();
        expect(calls).toEqual(['portrait-primary']);
    });

    it('ទិសផ្ទុយ ៖ Browser tab · APK (Java ចាក់សោ) · iPhone · iPad · កុំព្យូទ័រ ➜ មិនហៅ lock', async () => {
        setScreen(412, 915);
        displayMode = 'browser';
        let m = await load();
        expect(m.orientationLockFor()).toBeNull();
        m.applyOrientationLock();
        displayMode = 'standalone';
        (window as any).Capacitor = { isNativePlatform: () => true, getPlatform: () => 'android' };
        m = await load();
        expect(m.orientationLockFor()).toBeNull();
        m.applyOrientationLock();
        (window as any).Capacitor = undefined;
        for (const platform of ['iOS', 'macOS', 'Windows']) {
            Object.defineProperty(window.navigator, 'userAgentData', { configurable: true, value: { platform } });
            m = await load();
            expect(m.orientationLockFor()).toBeNull();
            m.applyOrientationLock();
        }
        expect(calls).toEqual([]);
    });

    it('ទិសផ្ទុយ ៖ lock បដិសេធ · បោះ · គ្មាន lock · គ្មាន matchMedia · ទំហំខុស ➜ មិនបោះ · មិនហៅម្តងហើយម្តងទៀត', async () => {
        lockImpl = () => Promise.reject(new DOMException('not allowed', 'NotSupportedError'));
        let m = await load();
        setScreen(412, 915);
        expect(() => m.applyOrientationLock()).not.toThrow();
        m.applyOrientationLock();
        await Promise.resolve();
        expect(calls).toEqual(['portrait-primary']);
        lockImpl = () => { throw new Error('boom'); };
        m = await load();
        setScreen(412, 915);
        expect(() => m.applyOrientationLock()).not.toThrow();
        lockImpl = null;
        m = await load();
        setScreen(412, 915);
        expect(() => m.applyOrientationLock()).not.toThrow();
        lockImpl = () => Promise.resolve();
        for (const [w, h] of [[NaN, 915], [0, 0], [-5, 800]]) {
            m = await load();
            setScreen(w, h);
            expect(m.orientationLockFor()).toBeNull();
        }
        Object.defineProperty(window, 'matchMedia', { configurable: true, value: undefined });
        m = await load();
        setScreen(412, 915);
        expect(m.orientationLockFor()).toBeNull();
    });

    it('⛔ ព្រំដែនតែមួយ ៖ TABLET_MIN_WIDTH_PX (PWA) = TABLET_MIN_WIDTH_DP (MainActivity) · APK onCreate (មុន super) និង onConfigurationChanged ចាក់សោ · AndroidManifest គ្មាន screenOrientation · manifest PWA portrait-primary · boot ហៅ + resize', async () => {
        const m = await load();
        const root = path.resolve(__dirname, '..');
        const java = fs.readFileSync(path.join(root, 'android/app/src/main/java/com/zoesystem/zoew/MainActivity.java'), 'utf8');
        expect(Number((java.match(/TABLET_MIN_WIDTH_DP = (\d+);/) || [])[1])).toBe(m.TABLET_MIN_WIDTH_PX);
        expect(java).toMatch(/lockPhoneToPortrait\(\);\s*super\.onCreate\(savedInstanceState\);/);
        expect(java).toMatch(/onConfigurationChanged\(Configuration newConfig\) \{\s*super\.onConfigurationChanged\(newConfig\);\s*lockPhoneToPortrait\(\);/);
        expect(java).toMatch(/smallestWidthDp > 0 && smallestWidthDp < TABLET_MIN_WIDTH_DP\s*\?\s*ActivityInfo\.SCREEN_ORIENTATION_PORTRAIT\s*:\s*ActivityInfo\.SCREEN_ORIENTATION_UNSPECIFIED/);
        expect(fs.readFileSync(path.join(root, 'android/app/src/main/AndroidManifest.xml'), 'utf8')).not.toMatch(/screenOrientation/);
        expect(JSON.parse(fs.readFileSync(path.join(root, 'public/manifest.json'), 'utf8')).orientation).toBe('portrait-primary');
        const boot = fs.readFileSync(path.join(root, 'src/app/lifecycle/boot.ts'), 'utf8');
        expect(boot).toMatch(/applyOrientationLock\(\);\s*scope\.listen\(window, 'resize', applyOrientationLock\);/);
    });
});
