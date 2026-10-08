/**
 * ⛔ លើ Android native App ទទួលសញ្ញា «ចាកចេញ» **២ ផ្លូវ** ៖ `pause` របស់
 *    Activity និង `visibilitychange` របស់ WebView។ ការលើកលែង (ការខល · Share ·
 *    ជីវមាត្រ) ត្រូវប្រើ **តែម្តង** ➜ បើការហៅទី ២ ឆ្លងកាត់ នោះវាឃើញការលើកលែង
 *    ដែលត្រូវស៊ីរួច ហើយ **ចាក់សោខុស** ក្រោយការខលនីមួយៗ។
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { securityState } from '../../src/core/state';
import { appLocalStore } from '../../src/core/storage';
import { noteAppLockAway, noteAppLockExcuse, relockAppAfterAway } from '../../src/features/app-lock';
import { closeConfigQrScanner, openConfigQrScanner } from '../../src/features/config-qr';
import { DocumentEffects } from '../../src/app/components/shell/DocumentEffects';
import { AppLockScreen } from '../../src/app/components/AppLockScreen';
import { byId, mount, step, unmount } from './react-harness';

beforeEach(() => {
    appLocalStore.setItem('zoew_security_pin_hash', 'test-hash');
    securityState.appIsLocked = false;
    securityState.appLockVeiled = false;
    securityState.appLockAwayNoted = false;
    securityState.appLockExcuseAt = 0;
    mount(<><DocumentEffects /><AppLockScreen /></>);
});

afterEach(() => {
    unmount();
    appLocalStore.removeItem('zoew_security_pin_hash');
    securityState.appIsLocked = false;
    securityState.appLockVeiled = false;
    securityState.appLockAwayNoted = false;
});

describe('សោ App ៖ សញ្ញាចាកចេញស្ទួន', () => {
    it('ការខល (លើកលែង) ➜ pause + visibilitychange ➜ មិនចាក់សោ', () => {
        noteAppLockExcuse();
        noteAppLockAway();
        noteAppLockAway();
        expect(securityState.appLockVeiled).toBe(false);
        expect(securityState.appIsLocked).toBe(false);
        relockAppAfterAway();
        relockAppAfterAway();
        expect(securityState.appIsLocked).toBe(false);
    });

    it('ចាកចេញធម្មតា ➜ គ្រប (veil) ម្តង ➜ ត្រឡប់មក ➜ ចាក់សោម្តង', () => {
        step(() => { noteAppLockAway(); noteAppLockAway(); });
        expect(securityState.appLockVeiled).toBe(true);
        // ⛔ គ្រប **ពិត** ៖ class លើ `<body>` (DocumentEffects) និងអេក្រង់សោ (AppLockScreen) ដែល React គូរ
        expect(document.body.classList.contains('app-locked')).toBe(true);
        expect(byId('appLockScreen').classList.contains('is-open')).toBe(true);
        step(() => relockAppAfterAway());
        expect(securityState.appLockVeiled).toBe(false);
        expect(securityState.appIsLocked).toBe(true);
    });

    it('ការចាកចេញលើកក្រោយ (ក្រោយត្រឡប់មក) នៅតែត្រូវវាស់', () => {
        noteAppLockExcuse();
        noteAppLockAway();
        relockAppAfterAway();
        expect(securityState.appIsLocked).toBe(false);
        noteAppLockAway();
        expect(securityState.appLockVeiled).toBe(true);
    });
});

/**
 * ⛔ NATIVE-1 ៖ ប្រអប់សុំសិទ្ធិរបស់ Android (កាមេរ៉ាសម្រាប់ QR Setup Link · ការជូនដំណឹង) ផ្អាក Activity ➜ `pause`/`visibilitychange` ➜
 *    App ចាក់សោពេលត្រឡប់ពីប្រអប់ ➜ អ្នកប្រើវាយ PIN ម្តងទៀតក្រោយចុច «អនុញ្ញាត»។ ការសុំសិទ្ធិត្រូវជាការចាកចេញដែលលើកលែង (`noteAppLockExcuse()` មុនប្រអប់)។
 */
describe('NATIVE-1 ៖ ប្រអប់សុំសិទ្ធិ ≠ ការចាកចេញពី App', () => {
    afterEach(() => {
        closeConfigQrScanner();
        delete (globalThis as any).ZXingWASM;
        delete (navigator as any).mediaDevices;
    });

    it('⛔ QR Setup Link ៖ ប្រអប់សិទ្ធិកាមេរ៉ា (pause ➜ resume ក្នុង getUserMedia) ➜ មិនចាក់សោ', async () => {
        (globalThis as any).ZXingWASM = { readBarcodes: async () => [] };
        const getUserMedia = vi.fn(async () => {
            noteAppLockAway();
            relockAppAfterAway();
            throw Object.assign(new Error('Permission denied'), { name: 'NotAllowedError' });
        });
        Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } });
        await openConfigQrScanner();
        expect(getUserMedia).toHaveBeenCalled();
        expect(securityState.appLockVeiled).toBe(false);
        expect(securityState.appIsLocked).toBe(false);
    });

    it('ទិសផ្ទុយ ៖ ចាកចេញពិត (គ្មានប្រអប់សិទ្ធិ) ➜ ចាក់សោដដែល', () => {
        noteAppLockAway();
        relockAppAfterAway();
        expect(securityState.appIsLocked).toBe(true);
    });
});

