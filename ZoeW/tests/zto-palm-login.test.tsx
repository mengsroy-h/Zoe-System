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
import { buildZtoListApiUrl } from '../src/features/zto-list-sync';
import { clearSensitiveModalFields } from '../src/features/session';
import { healthLookupRow, ztoUpstreamTimingText } from '../src/features/health-check';
import { buildHealthAdvice } from '../src/features/health-advice';

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
        for (const secret of [PASSWORD, SESSION, PROXY_KEY, 'palm-user']) expect(stored).not.toContain(secret);
        expect(await decryptLookupSecret(cfg.palmTokenEnc)).toBe(SESSION);
        expect(await decryptLookupSecret(cfg.headerValueEnc)).toBe(PROXY_KEY);
        expect(cfg).toMatchObject({ enabled: true, fastMode: true, phoneField: 'phone', codField: 'cod', dodField: 'dod' });
        expect(cfg.provider).toBeUndefined();
        expect(cfg.palmAccount).toEqual({ siteCode: 'KH001', siteName: 'Test branch' });
        act(() => openLookupApiConfigModal());
        expect(fieldValue('ztoPalmUsernameInput')).toBe('');
        expect(viewState.palmLoginStatus).toContain('Test branch');
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
        if (change !== 'close') expect(viewState.palmLoginStatus).toContain('ការកំណត់បានប្តូរ');
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
        expect(ztoFastModeIsOn()).toBe(true);
        expect(ztoStatusFeatureConfig()).toMatchObject({ enabled: true });
        act(() => disconnectZtoPalm());
        expect(ztoStatusFeatureConfig()).toBeNull();
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

    it('sends the signed-in ZoeW account with the login so ZTO_DETAIL_IDENTITY can gate it', async () => {
        firebaseState.auth = { currentUser: { uid: 'palm-shop-user' } } as any;
        firebaseState.fb = { getIdTokenResult: async () => ({ token: 'synthetic-id-token' }) } as any;
        const cfg = await signIn();
        expect(cfg.palmTokenEnc).toBeTruthy();
        expect(vi.mocked(fetch).mock.calls[0][1]?.headers).toMatchObject({ 'X-Zoe-Proxy-Key': PROXY_KEY, 'X-Zoe-Id-Token': 'synthetic-id-token' });
    });

    it('shows the reason ZTO gave when it refuses the login', async () => {
        credentials();
        vi.stubGlobal('fetch', vi.fn(async () => response({ code: 'ZTO_PALM_LOGIN_REJECTED', reason: 'palm:VERSION_TOO_LOW' }, 401)));
        await act(async () => { await submitZtoPalmLogin(); });
        expect(viewState.palmLoginStatus).toContain('palm:VERSION_TOO_LOW');
        vi.stubGlobal('fetch', vi.fn(async () => response({ code: 'ZTO_PALM_NOT_CONFIGURED', reason: 'palm:sign-key' }, 503)));
        credentials();
        await act(async () => { await submitZtoPalmLogin(); });
        expect(viewState.palmLoginStatus).toContain('palm:sign-key');
    });

    it('decides Palm mode from the lookup URL alone (a config without provider still reads ZTO lists through Palm, never the Argus Cookie)', async () => {
        const cfg = { enabled: true, fastMode: true, headerName: 'X-Zoe-Proxy-Key',
            url: window.location.origin + '/.netlify/functions/zto-order-detail?palm=1&barcode={barcode}', shop: 'https://palm-shop.firebaseio.com' };
        appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify(cfg));
        expect(new URL(buildZtoListApiUrl(cfg, '2026-10-01', '2026-10-02', 1, 'signedExact')).searchParams.get('palm')).toBe('1');
        await expect(buildLookupRequestHeaders(cfg)).rejects.toMatchObject({ lookupCode: 'ZTO_AUTH_EXPIRED' });
    });

    it('names the Palm problem in the auto-lookup message (ZTO rejected with a reason · session expired)', async () => {
        await signIn();
        scanState.pendingBarcode = '77130500000012';
        uiState.isModalOpen = true;
        vi.stubGlobal('fetch', vi.fn(async () => response({ code: 'ZTO_UPSTREAM_REJECTED', reason: 'palm:TOKEN_EXPIRE' }, 502)));
        await act(async () => { await attemptAutoLookup('77130500000012'); });
        expect(viewState.lookupStatus.text).toContain('palm:TOKEN_EXPIRE');
        expect(viewState.lookupStatus.text).toContain('Login ZTO Palm');
    });

    it('🩺 tells the owner what to do for a Palm session that is missing, expired or not configured on the server', async () => {
        await signIn();
        vi.stubGlobal('fetch', vi.fn(async () => response({ code: 'ZTO_AUTH_EXPIRED', provider: 'zto-palm' }, 401)));
        const expired: any = await healthLookupRow();
        expect(expired.state).toBe('warn');
        expect(JSON.stringify(expired)).toContain('Login ZTO Palm');
        vi.stubGlobal('fetch', vi.fn(async () => response({ code: 'ZTO_PALM_NOT_CONFIGURED', reason: 'palm:password-key' }, 503)));
        const server: any = await healthLookupRow();
        expect(server.state).toBe('bad');
        expect(JSON.stringify(server)).toContain('palm:password-key');
        expect(JSON.stringify(buildHealthAdvice([server]))).toContain('ZTO_PALM_PASSWORD_KEY');
        vi.stubGlobal('fetch', vi.fn(async () => response({ success: true, provider: 'zto-palm', configured: true, upstreamTiming: {
            detail: { count: 3, timeouts: 0, lastMs: 610, avgMs: 640, maxMs: 700, ageMs: 5 },
            palm: { detail: { count: 2, timeouts: 1, lastMs: 1250, avgMs: 1310, maxMs: 1400, ageMs: 5 } },
            connections: { argus: { count: 0, errors: 0, lastMs: null, avgMs: null, maxMs: null, ageMs: null },
                palm: { count: 2, errors: 0, lastMs: 420, avgMs: 455, maxMs: 490, ageMs: 5 } } } })));
        const timed: any = await healthLookupRow();
        expect(timed.state).toBe('info');
        const timedText = JSON.stringify(timed);
        expect(timedText).toContain('មធ្យម 1.31 វិនាទី');
        expect(timedText).toContain('ចុងក្រោយ 1.25 វិនាទី (2 ដង)');
        expect(timedText).toContain('ហួសពេល 1 ដង');
        expect(timedText).toContain('ភ្ជាប់ថ្មីទៅ ZTO 2 ដង (មធ្យម 0.46 វិនាទី)');
        expect(timedText).not.toContain('0.64');
        vi.stubGlobal('fetch', vi.fn(async () => response({ success: true, provider: 'zto-palm', configured: true })));
        expect(((await healthLookupRow()) as any).state).toBe('info');
        const cfg = getLookupApiConfig();
        delete cfg.palmTokenEnc;
        appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify(cfg));
        vi.stubGlobal('fetch', vi.fn());
        const missing: any = await healthLookupRow();
        expect(missing.state).toBe('warn');
        expect(fetch).not.toHaveBeenCalled();
    });

    it('tells in the Palm form which ZTO lists Palm mode reads, and that the not-signed bar is absent', () => {
        const note = document.getElementById('ztoPalmModeNote');
        expect(note && note.textContent).toContain('«បញ្ជូន»');
        expect(note && note.textContent).toContain('«ចុះហត្ថលេខា»');
        expect(note && note.textContent).toContain('មិនបង្ហាញក្នុងរបៀប Palm');
    });
});

describe('🩺 ZTO response time text (owner report: Palm lookup slower than Cookie)', () => {
    const timing = {
        detail: { count: 4, timeouts: 0, lastMs: 820, avgMs: 760, maxMs: 900, ageMs: 1 },
        palm: { detail: { count: 0, timeouts: 0, lastMs: null, avgMs: null, maxMs: null, ageMs: null } },
        connections: { argus: { count: 1, errors: 0, lastMs: 300, avgMs: 300, maxMs: 300, ageMs: 1 },
            palm: { count: 0, errors: 0, lastMs: null, avgMs: null, maxMs: null, ageMs: null } }
    };

    it('Cookie (Argus) mode reads the /detail meter and the Argus connections; Palm reads its own', () => {
        expect(ztoUpstreamTimingText({ upstreamTiming: timing }, false))
            .toBe(' · ZTO ឆ្លើយពេលស្កេន ៖ មធ្យម 0.76 វិនាទី · ចុងក្រោយ 0.82 វិនាទី (4 ដង) · ភ្ជាប់ថ្មីទៅ ZTO 1 ដង (មធ្យម 0.30 វិនាទី)');
        expect(ztoUpstreamTimingText({ upstreamTiming: timing }, true)).toContain('ស្កេនកញ្ចប់ ១ រួចពិនិត្យម្តងទៀតដើម្បីឃើញ');
    });

    it('splits the scan time by new or reused connection, says how long ZTO keeps it, and where the Function runs', () => {
        const body = { runtime: { region: 'us-east-2' }, upstreamTiming: { ...timing, palm: { detail: { count: 3, timeouts: 0, lastMs: 620, avgMs: 580 } },
            scans: { argus: { fresh: { count: 1, avgMs: 560, lastMs: 560 }, reused: { count: 3, avgMs: 240, lastMs: 230 }, keepAliveSec: 60, closes: 0 },
                palm: { fresh: { count: 3, avgMs: 900, lastMs: 880 }, reused: { count: 0, avgMs: null, lastMs: null }, keepAliveSec: 0, closes: 2 } } } };
        const palm = ztoUpstreamTimingText(body, true);
        expect(palm).toContain('ស្កេនលើការភ្ជាប់ថ្មី មធ្យម 0.90 វិនាទី (3 ដង)');
        expect(palm).not.toContain('ការភ្ជាប់ដែលបើករួច');
        expect(palm).toContain('ZTO បិទការភ្ជាប់ក្រោយឆ្លើយ');
        expect(palm).toContain('Function នៅ us-east-2');
        const argus = ztoUpstreamTimingText(body, false);
        expect(argus).toContain('ស្កេនលើការភ្ជាប់ថ្មី មធ្យម 0.56 វិនាទី (1 ដង)');
        expect(argus).toContain('ស្កេនលើការភ្ជាប់ដែលបើករួច មធ្យម 0.24 វិនាទី (3 ដង)');
        expect(argus).toContain('ZTO ទុកការភ្ជាប់ 60 វិនាទី');
        expect(argus).not.toContain('បិទការភ្ជាប់');
        const silent = ztoUpstreamTimingText({ upstreamTiming: { ...timing, scans: { argus: { fresh: { count: 1, avgMs: 500, lastMs: 500 },
            reused: { count: 0 }, keepAliveSec: 0, closes: 0 } } } }, false);
        expect(silent).toContain('ZTO មិនប្រាប់រយៈទុកការភ្ជាប់');
        expect(silent).not.toContain('Function នៅ');
        expect(ztoUpstreamTimingText({ runtime: { region: '<b>x</b>' }, upstreamTiming: timing }, false)).not.toContain('<b>');
    });

    it('an older Function without the meter, or unreadable values, never print a number', () => {
        expect(ztoUpstreamTimingText({}, true)).toBe('');
        expect(ztoUpstreamTimingText(null, false)).toBe('');
        expect(ztoUpstreamTimingText({ upstreamTiming: { detail: { count: 2, avgMs: 'x', lastMs: -1 } } }, false)).toContain('ស្កេនកញ្ចប់ ១ រួចពិនិត្យម្តងទៀតដើម្បីឃើញ');
        expect(ztoUpstreamTimingText({ upstreamTiming: { palm: null, connections: 'x' } }, true)).toContain('ស្កេនកញ្ចប់ ១ រួចពិនិត្យម្តងទៀតដើម្បីឃើញ');
        expect(ztoUpstreamTimingText({ upstreamTiming: { detail: { count: 1, avgMs: 500, lastMs: 500 }, connections: { argus: { count: 'x' } } } }, false))
            .not.toContain('ភ្ជាប់ថ្មី');
    });
});
