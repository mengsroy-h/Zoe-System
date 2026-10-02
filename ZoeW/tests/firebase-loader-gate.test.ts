/**
 * ⛔ ហាង Supabase មិនត្រូវទាញ SDK Firebase ពេលបើក App (មិនត្រូវការ) — តែ loader ត្រូវ fail-open ៖ Config Firebase · គ្មាន Config ·
 *    storage បោះ ➜ ទាញដូចធម្មតា។ ទិសផ្ទុយ ៖ ប្តូរ Config ទៅ Firebase ក្នុងវគ្គដដែល ➜ `waitForFirebaseSDK()` ទាញវាពេលត្រូវការ (មិនរង់ចាំ
 *    ការផ្ទុកដែលមិនដែលចាប់ផ្តើម)។
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { waitForFirebaseSDK } from '../src/services/network';

const LOADER = fs.readFileSync(path.join(__dirname, '..', 'public', 'firebase-loader.js'), 'utf8');

function runLoader(storage: 'supabase' | 'firebase' | 'none' | 'throws') {
    const imports: string[] = [];
    const store: Record<string, string> = {};
    if (storage === 'supabase') store.zoew_firebase_config = JSON.stringify({ supabaseUrl: 'https://abc.supabase.co', supabaseKey: 'sb_publishable_x' });
    if (storage === 'firebase') store.zoew_firebase_config = JSON.stringify({ databaseURL: 'https://x.firebaseio.com', apiKey: 'k' });
    const win: any = {
        dispatchEvent: () => true,
    };
    Object.defineProperty(win, 'localStorage', {
        get() {
            if (storage === 'throws') throw new Error('SecurityError');
            return { getItem: (k: string) => (k in store ? store[k] : null) };
        },
    });
    const ctx = vm.createContext({
        window: win,
        Event: class { constructor(public type: string) {} },
        Promise,
        JSON,
        __imp: (url: string) => { imports.push(url); return new Promise(() => {}); },
    });
    vm.runInContext(LOADER.replace(/\bimport\(/g, '__imp('), ctx);
    return { win, imports };
}

afterEach(() => {
    delete (window as any).loadFirebaseSDK;
    delete (window as any).firebaseSDK;
});

describe('firebase-loader ៖ ទាញ SDK Firebase តែពេលត្រូវការ', () => {
    it('Config Supabase ➜ មិនទាញ SDK Firebase ពេលបើក App', () => {
        const { imports, win } = runLoader('supabase');
        expect(imports).toEqual([]);
        expect(typeof win.loadFirebaseSDK).toBe('function');
    });

    it('Config Firebase ➜ ទាញ app · auth · database ពេលបើក App', () => {
        const { imports } = runLoader('firebase');
        expect(imports.length).toBe(3);
        expect(imports.every((u) => u.startsWith('https://www.gstatic.com/firebasejs/'))).toBe(true);
    });

    it('fail-open ៖ គ្មាន Config ឬ storage បោះ ➜ ទាញដូចធម្មតា', () => {
        expect(runLoader('none').imports.length).toBe(3);
        expect(runLoader('throws').imports.length).toBe(3);
    });

    it('Config Supabase ➜ loadFirebaseSDK() ទាញម្តងគត់ ទោះហៅច្រើនដង', () => {
        const { imports, win } = runLoader('supabase');
        win.loadFirebaseSDK();
        win.loadFirebaseSDK();
        expect(imports.length).toBe(3);
    });

    it('ទិសផ្ទុយ ៖ waitForFirebaseSDK() ហៅ loadFirebaseSDK() ពេល SDK មិនទាន់មាន ហើយ resolve ពេល SDK មកដល់', async () => {
        const sdk = { initializeApp: () => null };
        (window as any).loadFirebaseSDK = vi.fn(() => {
            (window as any).firebaseSDK = sdk;
            window.dispatchEvent(new Event('firebasesdkready'));
        });
        await expect(waitForFirebaseSDK(1000)).resolves.toBe(sdk);
        expect((window as any).loadFirebaseSDK).toHaveBeenCalledTimes(1);
    });

    it('SDK មានរួច ➜ មិនហៅ loadFirebaseSDK() ទៀត', async () => {
        const sdk = { initializeApp: () => null };
        (window as any).firebaseSDK = sdk;
        (window as any).loadFirebaseSDK = vi.fn();
        await expect(waitForFirebaseSDK(1000)).resolves.toBe(sdk);
        expect((window as any).loadFirebaseSDK).not.toHaveBeenCalled();
    });
});
