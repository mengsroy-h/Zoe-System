/**
 * ⛔ audit សុវត្ថិភាព (សំណើម្ចាស់គម្រោង ៖ «audit ... ពិនិត្យ ក្រែងមានលេចធ្លាយ secret និងការវាយប្រហារផ្សេង» · ម្ចាស់គម្រោងអនុញ្ញាតកែតំបន់ចាក់សោ ZTO) ៖
 *    `X-Zoe-Id-Token` (Firebase ID token / JWT Supabase របស់គណនីហាង) ផ្តល់សិទ្ធិអាន/សរសេរទិន្នន័យហាងទាំងមូល។ មុនកែ App ផ្ញើវាទៅ URL Lookup
 *    ណាក៏ដោយដែលផ្លូវមាន `/.netlify/functions/zto-order-detail` (មិនពិនិត្យ host) ➜ Setup Link ក្លែង (PIN + កូដ) ➜ token ទៅ server ខ្មាំង
 *    រាល់ការស្កេន · ការបិទស្វ័យប្រវត្តិ · ទាញបញ្ជី។
 * ⛔ ច្បាប់ ៖ token ទៅតែ origin របស់ ZoeW (web · CSP `connect-src 'self'`) ឬ origin Netlify របស់ APK (`VITE_NATIVE_WEB_ORIGIN`)
 *    (`ztoIdentityTargetTrusted()`) · host ផ្សេង ➜ សំណើ `/detail` ចេញដោយគ្មាន token (Function សម្រេច) · ទាញបញ្ជី ➜ បដិសេធមុនចេញ (`host:untrusted`)។
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { firebaseState, securityState } from '../src/core/state';
import { encryptLookupSecret } from '../src/services/crypto';
import { addZtoIdentityHeader } from '../src/features/lookup-api';
import { fetchZtoListPage } from '../src/features/zto-list-sync';
import { ztoIdentityTargetTrusted } from '../src/platform/native';

const ID_TOKEN = 'synthetic-zto-id-token-for-tests';
const PATH = '/.netlify/functions/zto-order-detail?barcode={barcode}';
const HOSTILE = ['https://evil.example' + PATH, 'https://abcdefghijklmnopqrst.supabase.co/functions/v1/x' + PATH, 'http://' + window.location.host + '.evil.example' + PATH];

function cfg(url: string) {
    return { enabled: true, fastMode: true, url, headerName: 'X-Zoe-Proxy-Key' };
}

beforeEach(() => {
    firebaseState.auth = { currentUser: { uid: 'u1' } };
    firebaseState.fb = { getIdTokenResult: async () => ({ token: ID_TOKEN }) };
});

afterEach(() => {
    firebaseState.auth = null;
    firebaseState.fb = null;
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    delete (window as any).Capacitor;
    securityState.lookupSecretKey = null;
    vi.restoreAllMocks();
});

it.each([false, true])('Cookie/Palm %s ៖ list រៀបចំ credential និង identity ព្រមគ្នា រក្សា token ពិតចុងក្រោយ', async (palm) => {
    vi.stubGlobal('crypto', webcrypto);
    securityState.lookupSecretKey = await webcrypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']) as any;
    const config = { ...cfg(window.location.origin + PATH + (palm ? '&palm=1' : '')),
        headerName: 'X-Zoe-Id-Token', headerValueEnc: await encryptLookupSecret('untrusted-config-token'),
        ...(palm ? { palmTokenEnc: await encryptLookupSecret('synthetic-session') } : {}) };
    const original = webcrypto.subtle.decrypt.bind(webcrypto.subtle);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const decrypt = vi.spyOn(webcrypto.subtle, 'decrypt').mockImplementation(async (...args) => {
        await gate;
        return original(...args);
    });
    const identity = vi.fn(async () => ({ token: ID_TOKEN }));
    firebaseState.fb = { getIdTokenResult: identity } as any;
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ success: true, rows: [], pages: 1 }))));
    const work = fetchZtoListPage(config, '2026-10-01', '2026-10-02', 1);
    try {
        await vi.waitFor(() => expect(decrypt).toHaveBeenCalled());
        expect(identity).toHaveBeenCalledOnce();
        expect(fetch).not.toHaveBeenCalled();
    } finally {
        release();
        await work;
    }
    expect(vi.mocked(fetch).mock.calls[0][1]?.headers).toMatchObject({ 'X-Zoe-Id-Token': ID_TOKEN,
        ...(palm ? { 'X-Zoe-Palm-Token': 'synthetic-session' } : {}) });
});

describe('⛔ token គណនីហាង ទៅតែ origin ZoeW', () => {
    it('host ខ្មាំង (ផ្លូវដូច Function ZTO) ➜ គ្មាន X-Zoe-Id-Token', async () => {
        for (const url of HOSTILE) {
            const headers: Record<string, string> = {};
            const out = await addZtoIdentityHeader(cfg(url), headers);
            expect(headers['X-Zoe-Id-Token'], url).toBeUndefined();
            expect(out, url).toBe('none');
            expect(ztoIdentityTargetTrusted(url), url).toBe(false);
        }
    });

    it('ទាញបញ្ជី ZTO ពី host ខ្មាំង ➜ បដិសេធមុនចេញ (គ្មាន fetch · host:untrusted)', async () => {
        const fetchSpy = vi.fn(async () => new Response('{}', { status: 200 }));
        vi.stubGlobal('fetch', fetchSpy);
        let err: any = null;
        try { await fetchZtoListPage(cfg(HOSTILE[0]), '2026-10-01', '2026-10-02', 1); } catch (e) { err = e; }
        expect(err && err.listReason).toBe('host:untrusted');
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('ទិសផ្ទុយ ៖ origin ZoeW ➜ token ទៅ · ទាញបញ្ជីផ្ញើ token', async () => {
        const own = window.location.origin + PATH;
        const headers: Record<string, string> = {};
        expect(await addZtoIdentityHeader(cfg(own), headers)).toBe('sent');
        expect(headers['X-Zoe-Id-Token']).toBe(ID_TOKEN);
        const seen: any[] = [];
        vi.stubGlobal('fetch', vi.fn(async (_url: string, init: any) => {
            seen.push(init && init.headers);
            return new Response(JSON.stringify({ ok: true, rows: [], pages: 1 }), { status: 200 });
        }));
        await fetchZtoListPage(cfg(own), '2026-10-01', '2026-10-02', 1).catch(() => null);
        expect(seen.length).toBeGreaterThan(0);
        expect(seen[0]['X-Zoe-Id-Token']).toBe(ID_TOKEN);
    });

    it('APK ៖ origin Netlify (`VITE_NATIVE_WEB_ORIGIN`) ➜ ទុកចិត្ត · host ផ្សេង ➜ មិនទុកចិត្ត · web មិនទុកចិត្ត origin នោះ', () => {
        vi.stubEnv('VITE_NATIVE_WEB_ORIGIN', 'https://zoew.netlify.app');
        expect(ztoIdentityTargetTrusted('https://zoew.netlify.app' + PATH)).toBe(false);
        (window as any).Capacitor = { isNativePlatform: () => true };
        expect(ztoIdentityTargetTrusted('https://zoew.netlify.app' + PATH)).toBe(true);
        expect(ztoIdentityTargetTrusted('https://zoew.netlify.app.evil.example' + PATH)).toBe(false);
        expect(ztoIdentityTargetTrusted('https://')).toBe(false);
        expect(ztoIdentityTargetTrusted('javascript:alert(1)')).toBe(false);
        expect(ztoIdentityTargetTrusted(PATH), 'ផ្លូវ relative = origin ខ្លួនឯង').toBe(true);
        expect(ztoIdentityTargetTrusted(undefined)).toBe(false);
    });
});
