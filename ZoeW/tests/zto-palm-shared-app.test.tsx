/**
 * ⛔ សំណើម្ចាស់គម្រោង ៖ «អោយ ZTO Palm login ដំណើរការដូច Cookie blob 100%» — ផ្លូវ App ពិត លើ backend ទាំង ២។
 *    ទូរស័ព្ទ A ៖ Login ZTO Palm ក្នុង «API ស្វែងរកអតិថិជន» ➜ Server ទុក session របស់ហាង ➜ ទូរស័ព្ទមិនទុក session/refreshToken ឡើយ ·
 *    ទូរស័ព្ទ B ៖ មានតែសោភ្ជាប់ ➜ «ប្រើ Login Palm របស់ហាង» ➜ ទាញបញ្ជី ZTO ដោយមិន Login · ZTO បដិសេធ token ➜ Server Login ឡើងវិញដោយខ្លួនឯង ·
 *    ទូរស័ព្ទកំណែចាស់ (មាន refreshToken) ➜ refresh ➜ ចូលរួម session ហាង ហើយលុប session ផ្ទាល់ ·
 *    ⛔ របាយការណ៍ម្ចាស់គម្រោង (សោដដែល · សាខាតែមួយ · backend តែមួយ) ៖ «ពេលទូរស័ព្ទមួយផ្តាច់ ទូរស័ព្ទមួយទៀតលោត Session ZTO Palm ផុតកំណត់» ➜
 *    «ផ្តាច់ Palm» ផ្តាច់តែទូរស័ព្ទនោះ (Login របស់សាខានៅលើ Server · ទូរស័ព្ទផ្សេងប្រើបានដដែល) · Server គ្មាន Login របស់សាខា ➜ សារប្រាប់មូលហេតុពិត
 *    (មិនមែន «ផុតកំណត់»)។
 *    App ពិត + Function ពិត + Blobs ក្លែង + ZTO Palm ក្លែង (`zto-palm-harness.ts`)។
 */
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount, unmount } from './native/react-harness';
import { LookupApiConfigModal } from '../src/app/components/modals/LookupApiConfigModal';
import { setFieldValue } from '../src/app/refs';
import { uiState } from '../src/core/state';
import { appLocalStore } from '../src/core/storage';
import { viewState } from '../src/core/view-state';
import { openLookupApiConfigModal } from '../src/features/lookup-config';
import { buildLookupRequestHeaders } from '../src/features/lookup-api';
import { runZtoListSyncPreview } from '../src/features/zto-list-sync';
import { attemptAutoLookup } from '../src/features/auto-lookup';
import { scanState } from '../src/core/state';
import { cancelZtoPalmLogin, connectSharedZtoPalm, disconnectZtoPalm, refreshZtoPalmSession, resetZtoPalmRefresh, submitZtoPalmLogin, PALM_REFRESH_AGE_MS } from '../src/features/zto-palm-login';
import { encryptLookupSecret } from '../src/services/crypto';
import { ARRIVED, KEY, NOW, OTHER_SITE, SITE, fn, identityToken, noteText, palmLoginBody, pulledRows, setupWorld, shopOf, signIn, storePalmConfig, teardownWorld, toastTexts, useSharedBlobs, world, type Backend } from './zto-palm-harness';

const BACKENDS: Backend[] = ['firebase', 'supabase'];
const STORE = 'zoew_lookup_api_config';
const stored = () => JSON.parse(String(appLocalStore.getItem(STORE)));
const sessionKeys = () => [...world.blobs!.keys()].filter((key) => key.startsWith('palm-session/'));

afterEach(() => {
    act(() => cancelZtoPalmLogin());
    unmount();
    uiState.modalDisplay = {};
    resetZtoPalmRefresh();
    teardownWorld();
});

async function openModal() {
    mount(<LookupApiConfigModal />);
    act(() => openLookupApiConfigModal());
}

async function proxyOnlyConfig(shop: string) {
    appLocalStore.setItem(STORE, JSON.stringify({ enabled: true, url: window.location.origin + '/.netlify/functions/zto-order-detail?barcode={barcode}',
        headerName: 'X-Zoe-Proxy-Key', headerValueEnc: await encryptLookupSecret(KEY), shop }));
}

function tokensSent() {
    const sent: string[] = [];
    world.gate = (_kind, _key, token) => { sent.push(token); };
    return sent;
}

describe.each(BACKENDS)('ZTO Palm Login ម្តង ➜ គ្រប់ទូរស័ព្ទក្នុងហាង (backend %s)', (backend) => {
    it('A Login ➜ session ហាងលើ Server · ទូរស័ព្ទមិនទុក session · B ប្រើ Login ហាង ➜ ទាញបញ្ជីដោយមិន Login · token ងាប់ ➜ Server Login ឡើងវិញ', async () => {
        await setupWorld(backend, 'off');
        useSharedBlobs();
        const shop = stored().shop;
        await proxyOnlyConfig(shop);
        await openModal();
        world.logins.length = 0;
        setFieldValue('ztoPalmUsernameInput', 'palm-user');
        setFieldValue('ztoPalmPasswordInput', 'palm-pass');
        await act(async () => { await submitZtoPalmLogin(); });
        const a = stored();
        expect(viewState.palmLoginConnected).toBe(true);
        expect(a).toMatchObject({ palmShared: true, palmAccount: { siteCode: '881859' } });
        for (const name of ['palmTokenEnc', 'palmRefreshTokenEnc', 'palmExpiresAt']) expect(a[name], name).toBeUndefined();
        expect(JSON.stringify(a)).not.toContain('palm-pass');
        expect(sessionKeys().length).toBe(1);
        expect(world.logins).toHaveLength(1);

        await proxyOnlyConfig(shop);
        act(() => openLookupApiConfigModal());
        expect(viewState.palmLoginConnected).toBe(false);
        await act(async () => { await connectSharedZtoPalm(); });
        const b = stored();
        expect(b).toMatchObject({ palmShared: true, enabled: true, palmAccount: { siteCode: '881859', siteName: 'Test branch' } });
        expect(b.url).toContain('palm=1');
        expect(b.palmTokenEnc).toBeUndefined();
        expect(await buildLookupRequestHeaders(b)).not.toHaveProperty('X-Zoe-Palm-Token');
        act(() => { uiState.modalDisplay = {}; uiState.isModalOpen = false; });

        const shopToken = world.issued[world.issued.length - 1];
        const sent = tokensSent();
        await runZtoListSyncPreview();
        expect([...pulledRows().keys()].sort()).toEqual(ARRIVED.slice().sort());
        expect(world.logins, 'B មិន Login ZTO').toHaveLength(1);
        expect(new Set(sent)).toEqual(new Set([shopToken]));

        world.deadTokens.add(shopToken);
        sent.length = 0;
        await runZtoListSyncPreview();
        expect([...pulledRows().keys()].sort(), 'ទាញបានបន្ទាប់ពី Server Login ឡើងវិញ').toEqual(ARRIVED.slice().sort());
        expect(world.logins, 'Server Login ឡើងវិញតែម្តង').toHaveLength(2);
        const renewed = world.issued[world.issued.length - 1];
        expect(renewed).not.toBe(shopToken);
        expect(sent.filter((t) => t === renewed).length).toBeGreaterThan(0);
    });

    it('ហាងមិនទាន់ Login ➜ «ប្រើ Login Palm របស់ហាង» ប្រាប់ឲ្យ Login · មិនប្តូរ Config', async () => {
        await setupWorld(backend, 'off');
        useSharedBlobs();
        const shop = stored().shop;
        await proxyOnlyConfig(shop);
        const before = appLocalStore.getItem(STORE);
        await openModal();
        await act(async () => { await connectSharedZtoPalm(); });
        expect(viewState.palmLoginStatus).toContain('មិនទាន់ Login ZTO Palm លើ Server');
        expect(appLocalStore.getItem(STORE)).toBe(before);
    });

    it('ទូរស័ព្ទកំណែចាស់ (មាន refreshToken) ➜ refresh ចូលរួម session ហាង ➜ លុប session ផ្ទាល់ · ស្កេនប្រើ token ហាង', async () => {
        await setupWorld(backend, 'off');
        useSharedBlobs();
        const body = await palmLoginBody('device-user');
        await storePalmConfig(backend, body.sessionToken, undefined, {
            palmRefreshTokenEnc: await encryptLookupSecret(body.refreshToken), palmLoginAt: NOW - PALM_REFRESH_AGE_MS - 1, palmExpiresAt: body.expiresAt
        });
        expect(await refreshZtoPalmSession()).toBe('renewed');
        const cfg = stored();
        expect(cfg.palmShared).toBe(true);
        for (const name of ['palmTokenEnc', 'palmRefreshTokenEnc', 'palmExpiresAt']) expect(cfg[name], name).toBeUndefined();
        expect(sessionKeys().length).toBe(1);
        const sent = tokensSent();
        await runZtoListSyncPreview();
        expect([...pulledRows().keys()].sort()).toEqual(ARRIVED.slice().sort());
        expect(new Set(sent).size).toBe(1);
    });

    it('«ផ្តាច់ Palm» លើទូរស័ព្ទ A ➜ ផ្តាច់តែ A (មិនសួរ · មិនហៅ Server) · Login របស់សាខានៅលើ Server · ទូរស័ព្ទ B ទាញបានដដែល · A ភ្ជាប់វិញដោយមិន Login', async () => {
        await setupWorld(backend, 'off');
        useSharedBlobs();
        const shop = stored().shop;
        await proxyOnlyConfig(shop);
        await openModal();
        world.logins.length = 0;
        setFieldValue('ztoPalmUsernameInput', 'palm-user');
        setFieldValue('ztoPalmPasswordInput', 'palm-pass');
        await act(async () => { await submitZtoPalmLogin(); });
        const phoneA = appLocalStore.getItem(STORE)!;
        await proxyOnlyConfig(shop);
        act(() => openLookupApiConfigModal());
        await act(async () => { await connectSharedZtoPalm(); });
        const phoneB = appLocalStore.getItem(STORE)!;
        expect(JSON.parse(phoneB)).toMatchObject({ palmShared: true });

        appLocalStore.setItem(STORE, phoneA);
        act(() => openLookupApiConfigModal());
        expect(viewState.palmLoginConnected).toBe(true);
        const confirm = vi.fn(() => true);
        vi.stubGlobal('confirm', confirm);
        const calls = vi.mocked(fetch).mock.calls.length;
        await act(async () => { await disconnectZtoPalm(); });
        expect(confirm, 'ផ្តាច់តែទូរស័ព្ទនេះ ➜ មិនសួរបញ្ជាក់').not.toHaveBeenCalled();
        expect(vi.mocked(fetch).mock.calls.slice(calls).map((c) => String(c[0])), 'មិនហៅ Server').toEqual([]);
        expect(sessionKeys().length, 'Login Palm របស់សាខានៅលើ Server').toBe(1);
        expect(new URL(stored().url).searchParams.get('palm')).toBeNull();
        expect(stored().palmShared).toBeUndefined();
        expect(viewState.palmLoginConnected).toBe(false);
        expect(viewState.palmLoginStatus).toContain('ទូរស័ព្ទនេះ');
        const phoneAOff = appLocalStore.getItem(STORE)!;

        appLocalStore.setItem(STORE, phoneB);
        act(() => { uiState.modalDisplay = {}; uiState.isModalOpen = false; });
        await runZtoListSyncPreview();
        expect([...pulledRows().keys()].sort(), 'ទូរស័ព្ទ B ទាញបានក្រោយ A ផ្តាច់').toEqual(ARRIVED.slice().sort());
        expect(noteText()).not.toContain('ផុតកំណត់');
        expect(toastTexts().join(' ')).not.toContain('ផុតកំណត់');

        appLocalStore.setItem(STORE, phoneAOff);
        await openModal();
        await act(async () => { await connectSharedZtoPalm(); });
        expect(stored(), 'A ភ្ជាប់វិញពី Login របស់សាខា').toMatchObject({ palmShared: true, palmAccount: { siteCode: SITE } });
        expect(world.logins, 'គ្មាន Login ZTO ថ្មី').toHaveLength(1);
    });

    it('Server គ្មាន Login Palm របស់សាខា ➜ ទូរស័ព្ទ B ប្រាប់មូលហេតុពិត (ទាញបញ្ជី · ស្កេន) មិនមែន «ផុតកំណត់»', async () => {
        await setupWorld(backend, 'off');
        useSharedBlobs();
        await palmLoginBody('palm-user');
        await proxyOnlyConfig(stored().shop);
        await openModal();
        await act(async () => { await connectSharedZtoPalm(); });
        expect(stored()).toMatchObject({ palmShared: true });
        act(() => { uiState.modalDisplay = {}; uiState.isModalOpen = false; });
        for (const key of sessionKeys()) world.blobs!.delete(key);
        fn.resetCachesForTests();

        await runZtoListSyncPreview();
        expect(pulledRows().size).toBe(0);
        expect(noteText()).toContain('Login ZTO Palm របស់សាខានេះមិនមាននៅលើ Server');
        expect(noteText()).toContain('«API ស្វែងរកអតិថិជន»');
        expect(noteText()).not.toContain('ផុតកំណត់');
        expect(toastTexts().join(' ')).not.toContain('ផុតកំណត់');

        scanState.pendingBarcode = ARRIVED[0];
        scanState.phoneModalTyped = false;
        uiState.isModalOpen = true;
        await act(async () => { await attemptAutoLookup(ARRIVED[0]); });
        expect(viewState.lookupStatus.text).toContain('Login ZTO Palm របស់សាខានេះមិនមាននៅលើ Server');
        expect(viewState.lookupStatus.text).not.toContain('ផុតកំណត់');
    });

    it('សាខា ២ ប្រើសោភ្ជាប់ដដែល ➜ Login Palm នៃសាខានីមួយៗនៅដាច់ពីគ្នា · ទូរស័ព្ទសាខា B ចុច «ប្រើ Login Palm របស់ហាង» ➜ ទទួលសាខា B តាមគណនី ZoeW', async () => {
        await setupWorld(backend, 'off');
        useSharedBlobs();
        world.loginAnswer = (body: any) => new Response(JSON.stringify({ status: true, result: { token: 'token-' + body.userName, countryCode: 'KH',
            siteCode: body.userName === 'branch-b' ? OTHER_SITE : SITE, siteName: body.userName === 'branch-b' ? 'Branch B' : 'Branch A' } }), { status: 200 });
        await palmLoginBody('branch-a');
        await palmLoginBody('branch-b');
        expect(sessionKeys().sort()).toEqual(['palm-session/default/' + OTHER_SITE, 'palm-session/default/' + SITE].sort());
        signIn(backend, identityToken(backend, OTHER_SITE), OTHER_SITE);
        await proxyOnlyConfig(shopOf(backend, OTHER_SITE));
        await openModal();
        await act(async () => { await connectSharedZtoPalm(); });
        expect(stored(), 'គណនី ZoeW សាខា B ➜ Login Palm សាខា B').toMatchObject({ palmShared: true, palmAccount: { siteCode: OTHER_SITE, siteName: 'Branch B' } });
        const headers = await buildLookupRequestHeaders(stored());
        expect(headers).toMatchObject({ 'X-Zoe-Palm-Site': OTHER_SITE });
        expect(headers).not.toHaveProperty('X-Zoe-Palm-Token');
    });
});
