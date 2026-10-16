import { act } from 'react';
import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount, unmount } from './native/react-harness';
import { LookupApiConfigModal } from '../src/app/components/modals/LookupApiConfigModal';
import { PhoneModal } from '../src/app/components/modals/PhoneModal';
import { fieldValue, setFieldChecked, setFieldValue } from '../src/app/refs';
import { firebaseState, scanState, securityState, uiState } from '../src/core/state';
import { viewState } from '../src/core/view-state';
import { appLocalStore } from '../src/core/storage';
import { getLookupApiConfig, openLookupApiConfigModal, saveLookupApiConfig } from '../src/features/lookup-config';
import { cancelZtoPalmLogin, disconnectZtoPalm, submitZtoPalmLogin } from '../src/features/zto-palm-login';
import { buildLookupRequestHeaders } from '../src/features/lookup-api';
import { encryptLookupSecret, decryptLookupSecret } from '../src/services/crypto';
import { closeModal } from '../src/ui/modal';
import { attemptAutoLookup } from '../src/features/auto-lookup';
import { clearCustomerDataTableCache } from '../src/features/customer-table';
import { ztoFastModeIsOn, ztoStatusFeatureConfig } from '../src/features/zto-status';
import { clearSensitiveModalFields } from '../src/features/session';

const PROXY_KEY = 'synthetic-client-proxy-0123456789abcdef';
const SESSION = 'synthetic-opaque-server-palm-session';
const PASSWORD = 'synthetic-login-password';
let initialConfig = '';

function response(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function success() {
    return response({ success: true, sessionToken: SESSION, expiresAt: Date.now() + 8 * 3600000, account: { userName: 'palm-user', siteCode: 'KH001', siteName: 'Test branch' } });
}

function credentials() {
    setFieldValue('ztoPalmUsernameInput', 'palm-user');
    setFieldValue('ztoPalmPasswordInput', PASSWORD);
}

async function signIn() {
    credentials();
    vi.stubGlobal('fetch', vi.fn(async () => success()));
    await act(async () => { await submitZtoPalmLogin(); });
    expect(viewState.palmLoginConnected).toBe(true);
    return getLookupApiConfig();
}

beforeEach(async () => {
    vi.stubGlobal('crypto', webcrypto);
    vi.stubGlobal('alert', vi.fn());
    appLocalStore.clear();
    appLocalStore.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: 'https://palm-shop.firebaseio.com' }));
    firebaseState.authGeneration++;
    firebaseState.auth = null;
    firebaseState.fb = null;
    securityState.lookupSecretKey = await webcrypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']) as any;
    initialConfig = JSON.stringify({ enabled: true, url: window.location.origin + '/.netlify/functions/zto-order-detail?barcode={barcode}',
        headerName: 'X-Zoe-Proxy-Key', headerValueEnc: await encryptLookupSecret(PROXY_KEY), shop: 'https://palm-shop.firebaseio.com' });
    appLocalStore.setItem('zoew_lookup_api_config', initialConfig);
    clearCustomerDataTableCache();
    mount(<><LookupApiConfigModal /><PhoneModal /></>);
    act(() => openLookupApiConfigModal());
});

afterEach(() => {
    act(() => { cancelZtoPalmLogin(); clearCustomerDataTableCache(); });
    unmount();
    securityState.lookupSecretKey = null;
    uiState.isModalOpen = false;
    uiState.modalDisplay = {};
    scanState.pendingBarcode = '';
    vi.unstubAllGlobals(); vi.unstubAllEnvs();
    delete (window as any).Capacitor;
    appLocalStore.clear();
});

describe('Palm login UI and existing lookup flow', () => {
    it('renders the login fields and stores only PIN-encrypted secrets', async () => {
        const cfg = await signIn();
        expect(fieldValue('ztoPalmPasswordInput')).toBe('');
        const stored = appLocalStore.getItem('zoew_lookup_api_config')!;
        for (const secret of [PASSWORD, SESSION, PROXY_KEY]) expect(stored).not.toContain(secret);
        expect(await decryptLookupSecret(cfg.palmTokenEnc)).toBe(SESSION);
        expect(await decryptLookupSecret(cfg.headerValueEnc)).toBe(PROXY_KEY);
        expect(cfg).toMatchObject({ enabled: true, fastMode: true, provider: 'zto-palm', phoneField: 'phone', codField: 'cod', dodField: 'dod' });
        expect(cfg.url).toContain('palm=1&barcode={barcode}');
        expect(viewState.palmLoginStatus).toContain('Test branch');
    });

    it('wires form submission to login and sends credentials only to its own Function', async () => {
        credentials();
        vi.stubGlobal('fetch', vi.fn(async () => success()));
        const form = document.getElementById('ztoPalmUsernameInput')!.closest('form')!;
        await act(async () => {
            form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
            await vi.waitFor(() => expect(viewState.palmLoginConnected).toBe(true));
        });
        expect(vi.mocked(fetch).mock.calls[0][0]).toBe(window.location.origin + '/.netlify/functions/zto-order-detail?palm=login');
    });

    it('fills the existing phone/COD/DOD scan form using the encrypted Palm session', async () => {
        await signIn();
        scanState.pendingBarcode = '77130500000012';
        scanState.phoneModalTyped = false;
        uiState.isModalOpen = true;
        viewState.phoneModalBusy = false;
        vi.stubGlobal('fetch', vi.fn(async () => response({ success: true, found: true, phone: '012345678', cod: 6.55, dod: 1.25 })));
        await act(async () => { await attemptAutoLookup('77130500000012'); });
        expect(fieldValue('modalPhoneInput')).toBe('012345678');
        expect(fieldValue('modalCodInput')).toBe('6.55');
        expect(fieldValue('modalDodInput')).toBe('1.25');
        expect(vi.mocked(fetch).mock.calls[0][1]?.headers).toMatchObject({ 'X-Zoe-Proxy-Key': PROXY_KEY, 'X-Zoe-Palm-Token': SESSION });
        expect(viewState.lookupStatus.kind).toBe('lookup-status-success');
    });

    it.each(['close', 'shop', 'config', 'pin'])('ignores a late login response after %s changes', async (change) => {
        let complete!: (res: Response) => void;
        vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => { complete = resolve; })));
        credentials();
        const task = submitZtoPalmLogin();
        await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
        if (change === 'close') closeModal('lookupApiConfigModal');
        if (change === 'shop') { appLocalStore.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: 'https://other-shop.firebaseio.com' })); firebaseState.authGeneration++; }
        if (change === 'config') appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify({ enabled: false }));
        if (change === 'pin') securityState.lookupSecretKey = null;
        const before = appLocalStore.getItem('zoew_lookup_api_config');
        complete(success());
        await act(async () => { await task; });
        expect(appLocalStore.getItem('zoew_lookup_api_config')).toBe(before);
        expect(fieldValue('ztoPalmPasswordInput')).toBe('');
    });

    it('keeps the old configuration after login failure', async () => {
        credentials();
        vi.stubGlobal('fetch', vi.fn(async () => response({ code: 'ZTO_PALM_LOGIN_REJECTED' }, 401)));
        await act(async () => { await submitZtoPalmLogin(); });
        expect(appLocalStore.getItem('zoew_lookup_api_config')).toBe(initialConfig);
        expect(viewState.palmLoginStatus).toContain('មិនត្រឹមត្រូវ');
    });

    it('refuses login when PIN encryption is locked', async () => {
        securityState.lookupSecretKey = null;
        credentials();
        vi.stubGlobal('fetch', vi.fn());
        await act(async () => { await submitZtoPalmLogin(); });
        expect(fetch).not.toHaveBeenCalled();
        expect(fieldValue('ztoPalmPasswordInput')).toBe('');
    });

    it('clears Palm credentials and account details on logout', () => {
        credentials();
        viewState.palmLoginConnected = true;
        viewState.palmLoginStatus = 'Test branch';
        act(() => clearSensitiveModalFields());
        expect(fieldValue('ztoPalmPasswordInput')).toBe('');
        expect(fieldValue('ztoPalmUsernameInput')).toBe('');
        expect(viewState.palmLoginConnected).toBe(false);
        expect(viewState.palmLoginStatus).toBe('');
    });

    it('does not send the Palm session to an untrusted lookup host', async () => {
        const cfg = await signIn();
        const hostile = { ...cfg, url: 'https://evil.example/.netlify/functions/zto-order-detail?palm=1&barcode={barcode}' };
        await expect(buildLookupRequestHeaders(hostile)).rejects.toThrow('not trusted');
    });

    it('preserves the session when saving lookup preferences', async () => {
        const cfg = await signIn();
        act(() => { setFieldChecked('lookupApiAutoSubmitCheckbox', true); });
        await act(async () => { await saveLookupApiConfig(); });
        expect(getLookupApiConfig().palmTokenEnc).toEqual(cfg.palmTokenEnc);
        expect(getLookupApiConfig().autoSubmit).toBe(true);
    });

    it('disconnects Palm and clears its lookup cache and session', async () => {
        await signIn();
        expect(ztoFastModeIsOn()).toBe(false);
        expect(ztoStatusFeatureConfig()).toBeNull();
        act(() => disconnectZtoPalm());
        expect(getLookupApiConfig()).toMatchObject({ enabled: false });
        expect(getLookupApiConfig().palmTokenEnc).toBeUndefined();
        expect(viewState.palmLoginConnected).toBe(false);
        expect(getLookupApiConfig().url).not.toContain('palm=1');
    });

    it('uses the configured web origin for Android login', async () => {
        vi.stubEnv('VITE_NATIVE_WEB_ORIGIN', 'https://palm-zoew.netlify.app');
        (window as any).Capacitor = { isNativePlatform: () => true, getPlatform: () => 'android' };
        await signIn();
        expect(vi.mocked(fetch).mock.calls[0][0]).toBe('https://palm-zoew.netlify.app/.netlify/functions/zto-order-detail?palm=login');
    });
});
