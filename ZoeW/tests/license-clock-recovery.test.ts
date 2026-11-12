import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { firebaseState, uiState } from '../src/core/state';
import { viewState } from '../src/core/view-state';
import { modalIsOpen } from '../src/core/modals';
import * as license from '../src/features/license';
const effects = vi.hoisted(() => ({ init: vi.fn(), signed: vi.fn(), arm: vi.fn() }));
vi.mock('../src/features/exchange-rate', async () => {
    const { readFileSync } = await import('node:fs'); const { firebaseState } = await import('../src/core/state');
    const src = readFileSync('src/features/exchange-rate.ts', 'utf8');
    const body = src.slice(src.indexOf('export function captureAuthDatabaseGuard('), src.indexOf('export async function saveExchangeRate(')).replace('export ', '');
    return { captureAuthDatabaseGuard: new Function('firebaseState', body + '; return captureAuthDatabaseGuard;')(firebaseState) };
});
vi.mock('../src/services/network', async () => {
    const { readFileSync } = await import('node:fs'); const src = readFileSync('src/services/network.ts', 'utf8');
    const body = src.slice(src.indexOf('export function withTimeout('), src.indexOf('export const DB_OP_TIMEOUT_MS')).replace('export ', '');
    return { withTimeout: new Function(body + '; return withTimeout;')() };
});
vi.mock('../src/features/auth', () => ({ updateAuthButton: effects.signed }));
vi.mock('../src/features/customer-table', () => ({ prefetchCustomerDataTableRowsIfConfigured: vi.fn() }));
vi.mock('../src/features/lookup-config', () => ({ refreshShopBoundUi: vi.fn() }));
vi.mock('../src/features/session', () => ({ armSessionExpiryCheck: effects.arm }));
vi.mock('../src/features/pin', () => ({ requestPinBeforeConfig: vi.fn(() => { throw new Error('ការសង្គ្រោះម៉ោងមិនត្រូវបើក PIN'); }) }));
vi.mock('../src/domain/cleanup', () => ({ resumeInterruptedCleanups: vi.fn() }));
vi.mock('../src/services/db-listeners', () => ({ dbListenersBelongToSession: () => firebaseState.isDatabaseInitialized, initDatabaseListeners: effects.init }));
vi.mock('../src/core/timezone', () => ({ safeFocusScanner: vi.fn() }));
vi.mock('../src/app/refs', () => ({ fieldValue: vi.fn(() => ''), focusField: vi.fn(), setFieldValue: vi.fn() }));
vi.mock('../src/ui/modal', () => ({
    openModalHelper: (id: string) => { uiState.modalDisplay[id] = 'flex'; uiState.isModalOpen = true; },
    closeModal: (id: string) => { uiState.modalDisplay[id] = 'none'; uiState.isModalOpen = Object.values(uiState.modalDisplay).includes('flex'); }
}));
vi.mock('../src/ui/toast', () => ({ showLiveToast: vi.fn(), showToast: vi.fn() }));
const T = Date.UTC(2026, 10, 8, 12), DAY = 86400000;
const user = { uid: 'clock-recovery-user' };
const KEY = 'zoe_license_activation_ZOE';
let net: { clockReady: boolean; revoked: boolean; calls: number; gate: null | Promise<void> };
let store: Map<string, string>;
let api: any;
async function drain() { for (let i = 0; i < 50; i++) await Promise.resolve(); }
function recover() { return (license as any).retryPendingActivation?.() ?? Promise.resolve(false); }
beforeEach(() => {
    vi.useFakeTimers(); vi.setSystemTime(T); vi.clearAllMocks();
    Object.assign(firebaseState, { authGeneration: 71, auth: { currentUser: user }, db: {}, isDatabaseInitialized: false, licenseRecheckInFlight: false });
    uiState.modalDisplay = {}; uiState.isModalOpen = false; viewState.backendKind = 'firebase'; viewState.activationBusy = false;
    effects.init.mockImplementation(() => { firebaseState.isDatabaseInitialized = true; return true; });
    net = { clockReady: false, revoked: false, calls: 0, gate: null }; store = new Map();
    const payload = { a: 'ZOE', id: 'CLOCKRECOVERY', iat: T / 1000, exp: (T + 30 * DAY) / 1000 };
    store.set(KEY, JSON.stringify({ keyString: 'ZOEKEY-' + Buffer.from(JSON.stringify(payload)).toString('base64url') + '.AA', ...payload, activatedAt: T, lastOnlineCheck: T, seenMax: T, onlineExp: T + 30 * DAY, releaseEpoch: 0 }));
    store.set('zoe_license_device_id', 'SYNTHETICDEVICE1234567890');
    const ctx: any = { Date, performance: { now: () => Date.now() - T + 1000 }, console, Promise, Error, Number, String, Object, Array, Math, Map, Set, RegExp, Uint8Array, TextEncoder, TextDecoder, AbortController, isFinite, isNaN, setTimeout, clearTimeout,
        navigator: { onLine: true }, crypto: { getRandomValues: (a: Uint8Array<ArrayBuffer>) => webcrypto.getRandomValues(a), subtle: { importKey: async () => ({}), verify: async () => true } },
        atob: (s: string) => Buffer.from(s, 'base64').toString('binary'), btoa: (s: string) => Buffer.from(s, 'binary').toString('base64'),
        localStorage: { getItem: (k: string) => store.get(k) || null, setItem: (k: string, v: string) => store.set(k, v), removeItem: (k: string) => store.delete(k) },
        fetch: async (url: string) => { net.calls++; if (net.gate) await net.gate;
            if (url.includes('/server-time') && !net.clockReady) throw Error('synthetic clock offline');
            const body = url.includes('/server-time') ? { nonce: new URL(url).searchParams.get('nonce'), now: Date.now() } : url.includes('/license_keys/') ? { expiresAt: T + 30 * DAY, revoked: net.revoked, maxDevices: 1 } : { d1: { device: 'SYNTHETICDEVICE1234567890', at: T, releaseEpoch: 0 } };
            return { ok: true, status: 200, redirected: false, headers: { get: (n: string) => n === 'Content-Type' ? 'application/json' : null }, json: async () => body };
        } };
    ctx.ZoeSeatConfig = { legacyProtocolEnabled: true }; ctx.window = ctx; vm.runInNewContext(readFileSync('public/license-verify.js', 'utf8'), ctx); api = ctx.ZoeLicense; vi.stubGlobal('ZoeLicense', api);
});
afterEach(() => { license.cancelActivationRetry(); vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); firebaseState.authGeneration++; });

describe('License ដែលរក្សាទុកសង្គ្រោះក្រោយម៉ោង Server ត្រឡប់', () => {
    it('clock-unverified ធម្មតាសាកម្តងទៀត ហើយបិទប្រអប់ដោយមិនបញ្ចូល Key ឡើងវិញ', async () => {
        await license.proceedAfterLogin(user, 71); expect(modalIsOpen('activationModal')).toBe(true); expect(store.has(KEY)).toBe(true); expect(effects.init).not.toHaveBeenCalled();
        net.clockReady = true; await vi.advanceTimersByTimeAsync(license.ACTIVATION_RETRY_STEPS_MS[0]); await drain();
        expect(effects.init).toHaveBeenCalledOnce(); expect(modalIsOpen('activationModal')).toBe(false); expect(store.has(KEY)).toBe(true);
    });
    it('ពិនិត្យតាមកាលកំណត់អាចសង្គ្រោះមុនមាន listener ទោះប្រអប់ Activation បើក', async () => {
        await license.proceedAfterLogin(user, 71); net.clockReady = true; await license.runPeriodicLicenseCheck();
        expect(effects.init).toHaveBeenCalledOnce(); expect(modalIsOpen('activationModal')).toBe(false);
    });
    it('ពេលថ្មីអាចសង្គ្រោះបន្ទាប់ពីជណ្តើរសាកអស់', async () => {
        await license.proceedAfterLogin(user, 71);
        for (const step of license.ACTIVATION_RETRY_STEPS_MS) { await vi.advanceTimersByTimeAsync(step); await drain(); }
        const before = net.calls; await vi.advanceTimersByTimeAsync(180000); expect(net.calls).toBe(before);
        net.clockReady = true; expect(await recover()).toBe(true); expect(effects.init).toHaveBeenCalledOnce(); expect(modalIsOpen('activationModal')).toBe(false);
    });
    it.each(['auth', 'database', 'user'])('លទ្ធផលថ្មីមិនសង្គ្រោះវគ្គចាស់ពេល %s ប្ដូរ', async change => {
        await license.proceedAfterLogin(user, 71); const before = net.calls; net.clockReady = true;
        if (change === 'auth') firebaseState.authGeneration++; else if (change === 'database') firebaseState.db = {} as any; else firebaseState.auth.currentUser = { uid: 'other' } as any;
        expect(await recover()).toBe(false); expect(net.calls).toBe(before); expect(effects.init).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(license.ACTIVATION_RETRY_STEPS_MS[0]); expect(effects.init).not.toHaveBeenCalled();
    });
    it('សាលក្រម revoked នៅតែបដិសេធ ហើយឈប់សាកដោយស្វ័យប្រវត្តិ', async () => {
        await license.proceedAfterLogin(user, 71); net.clockReady = true; net.revoked = true; expect(await recover()).toBe(false);
        expect(store.has(KEY)).toBe(false); expect(effects.init).not.toHaveBeenCalled(); const before = net.calls;
        await vi.advanceTimersByTimeAsync(180000); expect(net.calls).toBe(before); expect(await recover()).toBe(false);
    });
    it.each(['busy', 'other-modal'])('មិនជាន់ការងារអ្នកប្រើ %s', async reason => {
        await license.proceedAfterLogin(user, 71); net.clockReady = true; const before = net.calls;
        if (reason === 'busy') viewState.activationBusy = true; else uiState.modalDisplay.configModal = 'flex';
        expect(await recover()).toBe(false); expect(net.calls).toBe(before); expect(effects.init).not.toHaveBeenCalled();
        viewState.activationBusy = false; uiState.modalDisplay.configModal = 'none'; expect(await recover()).toBe(true); expect(effects.init).toHaveBeenCalledOnce();
    });
    it('ប្ដូរ Database ខណៈសង្គ្រោះកំពុងរង់ចាំ មិនបិទប្រអប់ ឬភ្ជាប់ listener', async () => {
        await license.proceedAfterLogin(user, 71); net.clockReady = true; let release!: () => void; net.gate = new Promise<void>(r => { release = r; });
        const pending = recover(); await drain(); firebaseState.db = {} as any; release(); expect(await pending).toBe(false);
        expect(effects.init).not.toHaveBeenCalled(); expect(effects.signed).not.toHaveBeenCalled(); expect(modalIsOpen('activationModal')).toBe(true);
    });
    it('សង្គ្រោះវគ្គថ្មីមិនរង់ចាំលទ្ធផលវគ្គចាស់ដែលនៅ pending', async () => {
        await license.proceedAfterLogin(user, 71); net.clockReady = true; let release!: () => void; net.gate = new Promise<void>(r => { release = r; });
        const old = recover(); await drain(); firebaseState.db = {} as any;
        api.getStatus = async () => ({ state: 'offline-grace-exceeded', reason: 'clock-unverified' }); await license.ensureAppActivated();
        api.getStatus = async () => ({ state: 'active' }); const current = recover(); await drain(); const started = effects.init.mock.calls.length;
        release(); const results = await Promise.all([old, current]); expect(started).toBe(1); expect(results).toEqual([false, true]); expect(effects.init).toHaveBeenCalledOnce();
    });
    it('ការសង្គ្រោះដំណាលគ្នាចាប់ listener តែម្តង', async () => {
        await license.proceedAfterLogin(user, 71); net.clockReady = true; let release!: () => void; net.gate = new Promise<void>(r => { release = r; });
        const a = recover(), b = recover(); await drain(); release(); await Promise.all([a, b]); expect(effects.init).toHaveBeenCalledOnce(); expect(effects.signed).toHaveBeenCalledOnce();
    });
});
