/**
 * ⛔ លើ Android native App ទទួលសញ្ញា «ចាកចេញ» **២ ផ្លូវ** ៖ `pause` របស់
 *    Activity និង `visibilitychange` របស់ WebView។ ការលើកលែង (ការខល · Share ·
 *    ជីវមាត្រ) ត្រូវប្រើ **តែម្តង** ➜ បើការហៅទី ២ ឆ្លងកាត់ នោះវាឃើញការលើកលែង
 *    ដែលត្រូវស៊ីរួច ហើយ **ចាក់សោខុស** ក្រោយការខលនីមួយៗ។
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { securityState } from '../../src/core/state';
import { appLocalStore } from '../../src/core/storage';
import { noteAppLockAway, noteAppLockExcuse, relockAppAfterAway } from '../../src/features/app-lock';

beforeEach(() => {
    appLocalStore.setItem('zoew_security_pin_hash', 'test-hash');
    securityState.appIsLocked = false;
    securityState.appLockVeiled = false;
    securityState.appLockAwayNoted = false;
    securityState.appLockExcuseAt = 0;
    document.body.classList.remove('app-locked');
});

afterEach(() => {
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
        noteAppLockAway();
        noteAppLockAway();
        expect(securityState.appLockVeiled).toBe(true);
        expect(document.body.classList.contains('app-locked')).toBe(true);
        relockAppAfterAway();
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
