/**
 * ⛔ សំណើម្ចាស់គម្រោង ៖ «អោយ Palm login នៅ background ខ្លួនឯងពេលបើក app ZoeW ដើម្បីការពារ session»។
 *    App ពិត + Function ពិត + ZTO Palm ក្លែង លើ backend ទាំង ២ ៖ Login ZTO Palm ឡើងវិញដោយ refreshToken ដែល Server បិទ
 *    (ទូរស័ព្ទមិនដែលមានពាក្យសម្ងាត់អានបាន) ពេល session ចាស់ (បើក App · ត្រឡប់មក · PIN · ជុំ 60 វិ) ឬពេល ZTO បដិសេធ session ·
 *    មិនកាត់ការទាញដែលកំពុងរត់ · ចាកចេញ / ប្តូរហាង / Login ដោយដៃ កណ្តាលផ្លូវ ➜ ចម្លើយចាស់បោះចោល · ZTO បដិសេធគណនី ➜ ឈប់សាក ហើយប្រាប់ម្តង។
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { firebaseState, securityState, ztoState } from '../src/core/state';
import { appLocalStore } from '../src/core/storage';
import { viewState } from '../src/core/view-state';
import { getLookupApiConfig } from '../src/features/lookup-config';
import { clearSensitiveModalFields } from '../src/features/session';
import { runZtoListSyncPreview } from '../src/features/zto-list-sync';
import { ztoPickupStatus } from '../src/features/zto-status';
import {
    PALM_REFRESH_AGE_MS, PALM_REFRESH_REJECTED_GAP_MS, PALM_REFRESH_RETRY_MS, disconnectZtoPalm, noteZtoPalmSessionRejected,
    refreshZtoPalmSession, resetZtoPalmRefresh
} from '../src/features/zto-palm-login';
import { decryptLookupSecret, encryptLookupSecret } from '../src/services/crypto';
import {
    ARRIVED, NOW, deferred, identityToken, palmLoginBody, pulledRows, setupWorld, signIn, storePalmConfig, teardownWorld, toastTexts,
    world, type Backend, type IdentityMode
} from './zto-palm-harness';

const BACKENDS: Backend[] = ['firebase', 'supabase'];
const STORE = 'zoew_lookup_api_config';
const stored = () => JSON.parse(String(appLocalStore.getItem(STORE)));

afterEach(() => {
    resetZtoPalmRefresh();
    teardownWorld();
});

async function palmWorld(backend: Backend, mode: IdentityMode = 'off', ageMs = PALM_REFRESH_AGE_MS + 60000) {
    const out = await setupWorld(backend, mode);
    resetZtoPalmRefresh();
    const body = await palmLoginBody('palm-user', mode === 'require' ? identityToken(backend) : '');
    await storePalmConfig(backend, body.sessionToken, undefined, {
        palmRefreshTokenEnc: await encryptLookupSecret(body.refreshToken), palmLoginAt: NOW - ageMs, palmExpiresAt: body.expiresAt
    });
    world.logins.length = 0;
    return { ...out, session: body.sessionToken as string };
}

async function sessionNow() {
    return decryptLookupSecret(stored().palmTokenEnc);
}

describe.each(BACKENDS)('ZTO Palm Login ឡើងវិញនៅ background លើ backend %s', (backend) => {
    it('session ចាស់ (≥ ៤ ម៉ោង) ➜ Login ឡើងវិញស្ងាត់ៗ ៖ session ថ្មីប្រើបាន · គណនីដដែល · មិនលុបសាលក្រម ZTO · មិន toast', async () => {
        const { session } = await palmWorld(backend);
        ztoPickupStatus.set('KH0000000009', { closed: false, at: NOW } as any);
        const before = stored();
        expect(await refreshZtoPalmSession()).toBe('renewed');
        expect(world.logins).toHaveLength(1);
        expect(world.logins[0]).toMatchObject({ userName: 'palm-user', deviceSn: 'zoew-harness-device' });
        const after = stored();
        expect(await sessionNow()).not.toBe(session);
        expect(after.palmRefreshTokenEnc).not.toBe(before.palmRefreshTokenEnc);
        expect(after.palmLoginAt).toBe(NOW);
        for (const name of ['url', 'headerValueEnc', 'palmAccount', 'shop', 'enabled', 'fastMode']) expect(after[name]).toEqual(before[name]);
        expect(ztoPickupStatus.has('KH0000000009'), 'session ថ្មីរបស់គណនីដដែល ➜ មិនសម្អាតសាលក្រម').toBe(true);
        expect(JSON.stringify(after)).not.toContain('palm-pass');
        expect(JSON.stringify(after)).not.toContain('palm-user');
        expect(toastTexts()).toEqual([]);
        await runZtoListSyncPreview();
        expect([...pulledRows().keys()].sort(), 'ទាញបញ្ជីដោយ session ថ្មី').toEqual(ARRIVED.slice().sort());
    });

    it('session ក្មេង (< ៤ ម៉ោង) ➜ មិន Login · config ចាស់ (មុនកំណែនេះ គ្មាន refresh) ➜ មិនសាក', async () => {
        await palmWorld(backend, 'off', 3600000);
        expect(await refreshZtoPalmSession()).toBe('fresh');
        const cfg = stored();
        delete cfg.palmRefreshTokenEnc;
        appLocalStore.setItem(STORE, JSON.stringify({ ...cfg, palmLoginAt: NOW - 9 * 3600000 }));
        expect(await refreshZtoPalmSession()).toBe('skipped');
        expect(world.logins).toHaveLength(0);
    });

    it('ZTO បដិសេធ session កណ្តាលការទាញ ➜ Login ឡើងវិញភ្លាម (ទោះ session ក្មេង) ➜ «✅ Login ZTO Palm ឡើងវិញរួច» ➜ ទាញម្តងទៀតបាន', async () => {
        const { session } = await palmWorld(backend, 'off', 600000);
        for (const token of world.issued) world.deadTokens.add(token);
        await runZtoListSyncPreview();
        expect(ztoState.ztoListSyncResult).toBeNull();
        expect(viewState.ztoListSyncNote).toContain('កំពុង Login ឡើងវិញ');
        expect(viewState.ztoListSyncNote).not.toContain('សូម Login ZTO Palm ម្តងទៀតក្នុង');
        await vi.waitFor(() => expect(world.logins, 'Login ឡើងវិញភ្លាមក្រោយការទាញចប់ (មិនរង់ចាំជុំ 60 វិ)').toHaveLength(1));
        await refreshZtoPalmSession();
        expect(world.logins).toHaveLength(1);
        expect(await sessionNow()).not.toBe(session);
        expect(toastTexts().join(' ')).toContain('✅ Login ZTO Palm ឡើងវិញរួច');
        await runZtoListSyncPreview();
        expect([...pulledRows().keys()].sort(), viewState.ztoListSyncNote).toEqual(ARRIVED.slice().sort());
    });

    it('ZTO បដិសេធគណនី (ប្តូរពាក្យសម្ងាត់) ➜ លុប refresh · ប្រាប់ម្តង · មិនសាកទៀត · session ចាស់នៅដដែល', async () => {
        const { session } = await palmWorld(backend);
        world.loginAnswer = () => new Response(JSON.stringify({ status: false, statusCode: 'login_password_error' }), { status: 200 });
        expect(await refreshZtoPalmSession()).toBe('rejected');
        expect(stored().palmRefreshTokenEnc).toBeUndefined();
        expect(await sessionNow()).toBe(session);
        expect(toastTexts().filter((t) => t.includes('Login ZTO Palm ស្វ័យប្រវត្តិមិនបាន'))).toHaveLength(1);
        expect(await refreshZtoPalmSession()).toBe('skipped');
        expect(noteZtoPalmSessionRejected(getLookupApiConfig())).toBe(false);
        expect(world.logins).toHaveLength(1);
    });

    it('ZTO ស្នើផ្ទៀងផ្ទាត់ (captcha) ➜ ឈប់សាក · ប្រាប់ឲ្យ Login ដោយដៃ', async () => {
        await palmWorld(backend);
        world.loginAnswer = () => new Response(JSON.stringify({ status: false, statusCode: 'risk_control_account_captcha_err' }), { status: 200 });
        expect(await refreshZtoPalmSession()).toBe('rejected');
        expect(toastTexts().join(' ')).toContain('ZTO ស្នើការផ្ទៀងផ្ទាត់បន្ថែម');
        expect(await refreshZtoPalmSession()).toBe('skipped');
        expect(world.logins).toHaveLength(1);
    });

    it('បណ្តាញ/ZTO ខូចបណ្តោះអាសន្ន ➜ រក្សា refresh · រង់ចាំ ២ នាទី ទើបសាកម្តងទៀត', async () => {
        await palmWorld(backend);
        world.loginAnswer = () => new Response('busy', { status: 503 });
        expect(await refreshZtoPalmSession()).toBe('failed');
        expect(stored().palmRefreshTokenEnc).toBeTruthy();
        expect(await refreshZtoPalmSession()).toBe('skipped');
        expect(world.logins).toHaveLength(1);
        world.loginAnswer = null;
        vi.setSystemTime(new Date(NOW + PALM_REFRESH_RETRY_MS + 1000));
        expect(await refreshZtoPalmSession()).toBe('renewed');
        expect(world.logins).toHaveLength(2);
    });

    it('ហៅច្រើនដងក្នុងពេលតែមួយ (បើក App · visibility · PIN · 60 វិ) ➜ Login តែម្តង', async () => {
        await palmWorld(backend);
        const runs = await Promise.all([refreshZtoPalmSession(), refreshZtoPalmSession(), refreshZtoPalmSession(), refreshZtoPalmSession()]);
        expect(new Set(runs)).toEqual(new Set(['renewed']));
        expect(world.logins).toHaveLength(1);
    });

    it('ZTO បដិសេធច្រើនដងជាប់ៗ ➜ Login ឡើងវិញតែម្តងក្នុង ៦០ វិ (ការពារ ZTO risk control)', async () => {
        const { session } = await palmWorld(backend, 'off', 600000);
        const cfg = getLookupApiConfig();
        for (let i = 0; i < 5; i++) noteZtoPalmSessionRejected(cfg);
        await refreshZtoPalmSession();
        for (let i = 0; i < 5; i++) noteZtoPalmSessionRejected(getLookupApiConfig());
        await refreshZtoPalmSession();
        expect(world.logins).toHaveLength(1);
        expect(await sessionNow()).not.toBe(session);
        vi.setSystemTime(new Date(NOW + PALM_REFRESH_REJECTED_GAP_MS + 1000));
        noteZtoPalmSessionRejected(getLookupApiConfig());
        await refreshZtoPalmSession();
        expect(world.logins).toHaveLength(2);
    });

    it('ចម្លើយ 401 ពីសំណើដែលប្រើ session ចាស់ (ក្រោយ Login ឡើងវិញរួច) ➜ មិន Login ម្តងទៀត', async () => {
        await palmWorld(backend);
        const old = getLookupApiConfig();
        expect(await refreshZtoPalmSession()).toBe('renewed');
        expect(noteZtoPalmSessionRejected(old)).toBe(true);
        await refreshZtoPalmSession();
        expect(world.logins).toHaveLength(1);
    });

    it('ZTO_DETAIL_IDENTITY=require ៖ Login ឡើងវិញផ្ញើគណនី ZoeW ដែលកំពុងចូល ហើយជោគជ័យ', async () => {
        await palmWorld(backend, 'require');
        expect(await refreshZtoPalmSession()).toBe('renewed');
        expect(world.logins).toHaveLength(1);
    });

    it('គណនី Palm ក្រោយ Login ឡើងវិញ ជាសាខាផ្សេង ➜ មិនរក្សាទុក · លុប refresh · ប្រាប់ឲ្យ Login ដោយដៃ', async () => {
        const { session } = await palmWorld(backend);
        world.loginAnswer = () => new Response(JSON.stringify({ status: true, result: { token: 'other-branch-token', countryCode: 'KH',
            siteCode: '770022', siteName: 'Other' } }), { status: 200 });
        expect(await refreshZtoPalmSession()).toBe('rejected');
        expect(await sessionNow()).toBe(session);
        expect(stored().palmRefreshTokenEnc).toBeUndefined();
        expect(toastTexts().join(' ')).toContain('សាខាផ្សេង');
    });

    it('កំពុងទាញបញ្ជី ➜ មិន Login ឡើងវិញ (មិនកាត់ការទាញ) · ក្រោយទាញរួច ➜ Login', async () => {
        await palmWorld(backend);
        const reached = deferred();
        const release = deferred();
        let held = false;
        world.gate = async (kind, key) => {
            if (held || kind !== 'list' || key !== 'list:3:1') return;
            held = true;
            reached.resolve();
            await release.promise;
        };
        const pull = runZtoListSyncPreview();
        await reached.promise;
        expect(await refreshZtoPalmSession()).toBe('skipped');
        release.resolve();
        await pull;
        expect([...pulledRows().keys()].sort()).toEqual(ARRIVED.slice().sort());
        expect(await refreshZtoPalmSession()).toBe('renewed');
    });

    it.each(['ចាកចេញ', 'ប្តូរហាង', 'Login ZTO Palm ដោយដៃ'])('%s ពេលកំពុង Login ឡើងវិញ ➜ ចម្លើយចាស់មិនសរសេរ · មិន toast', async (action) => {
        const { session } = await palmWorld(backend);
        const reached = deferred();
        const release = deferred();
        world.gate = async (kind) => {
            if (kind !== 'login') return;
            reached.resolve();
            await release.promise;
        };
        const run = refreshZtoPalmSession();
        await reached.promise;
        let expected = '';
        if (action === 'ចាកចេញ') {
            const key = securityState.lookupSecretKey;
            clearSensitiveModalFields();
            firebaseState.authGeneration++;
            securityState.lookupSecretKey = key;
        } else if (action === 'ប្តូរហាង') {
            signIn(backend === 'firebase' ? 'supabase' : 'firebase', identityToken(backend === 'firebase' ? 'supabase' : 'firebase'));
        } else {
            world.gate = null;
            const manual = await palmLoginBody('palm-user-2');
            const cfg = stored();
            cfg.palmTokenEnc = await encryptLookupSecret(manual.sessionToken);
            appLocalStore.setItem(STORE, JSON.stringify(cfg));
            expected = manual.sessionToken;
        }
        const snapshot = appLocalStore.getItem(STORE);
        release.resolve();
        expect(await run).toBe('skipped');
        expect(appLocalStore.getItem(STORE)).toBe(snapshot);
        if (expected) expect(await sessionNow()).toBe(expected);
        else if (action !== 'ចាកចេញ') expect(await sessionNow()).toBe(session);
        expect(toastTexts().filter((t) => t.includes('Login ZTO Palm'))).toEqual([]);
    });

    it('«ផ្តាច់ Palm» ➜ លុប refresh និងម៉ោង Login', async () => {
        await palmWorld(backend);
        disconnectZtoPalm();
        expect(stored().palmRefreshTokenEnc).toBeUndefined();
        expect(stored().palmLoginAt).toBeUndefined();
        expect(await refreshZtoPalmSession()).toBe('skipped');
        expect(world.logins).toHaveLength(0);
    });
});

describe('ទ្វារចូល ៖ បើក App · ត្រឡប់មក App · ជុំ 60 វិ · ដោះសោ PIN ហៅ Login ឡើងវិញ', () => {
    const src = (rel: string) => readFileSync(path.resolve(__dirname, '..', rel), 'utf8').replace(/\r\n?/g, '\n');

    it('boot ៖ ក្រោយស្តារសោ PIN · visibilitychange · ជុំ 60 វិ', () => {
        const boot = src('src/app/lifecycle/boot.ts');
        const restore = boot.slice(boot.indexOf('restoreLookupSecretKey().then'), boot.indexOf('setupNativeShell(scope)'));
        expect(restore).toContain('refreshZtoPalmSession()');
        const cycleAt = boot.indexOf('scope.every(60000, () => {');
        const visibleAt = boot.indexOf("scope.listen(document, 'visibilitychange'", cycleAt);
        const cycle = boot.slice(cycleAt, visibleAt);
        expect(cycle).toContain('refreshZtoPalmSession()');
        const visible = boot.slice(visibleAt, boot.indexOf('function startScanEngine'));
        expect(visible).toContain('refreshZtoPalmSession()');
    });

    it('PIN ៖ ក្រោយដោះសោ (សោអ៊ិនគ្រីបមានហើយ)', () => {
        const pin = src('src/features/pin.ts');
        const start = pin.indexOf('export async function completePinUnlock');
        const unlock = pin.slice(start, pin.indexOf('(securityState.pinTargetAction', start));
        expect(unlock.indexOf('refreshZtoPalmSession()')).toBeGreaterThan(unlock.indexOf('securityState.lookupSecretKey = await deriveLookupSecretKey'));
    });
});
