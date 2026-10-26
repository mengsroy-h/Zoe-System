// @vitest-environment node
/**
 * ⛔ Push ពិត (Web Push + FCM) ខាង server ៖ `netlify/lib/push-core.mjs`។
 * ⛔ ការអ៊ិនគ្រីបត្រូវស៊ីនឹង test vector ផ្លូវការរបស់ RFC 8291 §5 បេះបិទ ហើយសារដែលផ្ញើពិតត្រូវ **ឌិគ្រីបវិញបាន** ដោយកូនសោឧបករណ៍
 *    (ការផ្ទៀងផ្ទាត់ពីចុងដល់ចុង មិនមែនត្រឹម «មានការហៅ»)។
 * ⛔ អត្តសញ្ញាណ = Activation Key ៖ ហត្ថលេខា ECDSA ពិត + Revoke/ផុតកំណត់ពី License Project · «ផ្ទៀងផ្ទាត់មិនបាន» (503) ≠ «ខុស» (403)។
 * ⛔ ការបញ្ជូនជា at-most-once តាម ledger ដែលចាក់សោដោយ ETag ៖ cron និង kick ស្របគ្នា ➜ ផ្ញើតែម្តង · លើកដំបូង ➜ មិនផ្ញើដំណឹងចាស់។
 * ⛔ public key · URL License · កូដ App ដេរីវេពី `license-verify.js`/`license.ts` ពិត (មិនមែន literal)។
 */
import crypto from 'node:crypto';
import http from 'node:http';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    FCM_CHANNEL_ID as SERVER_FCM_CHANNEL, LICENSE_APP_CODE, LICENSE_DB_URL_DEFAULT, LICENSE_KEY_PREFIX, LICENSE_PUBLIC_KEYS_JWK,
    PUSH_EXPIRY_HOUR, PUSH_NOTICE_MAX_AGE_MS, PUSH_OPEN_URL, PUSH_SCHEDULE_MAX_AGE_MS, PUSH_SUBS_PER_KEY_MAX, PUSH_SUBS_TOTAL_MAX,
    PUSH_READ_TIMEOUT_MS, PUSH_SEND_TIMEOUT_MS, PUSH_SEND_CONCURRENCY,
    b64urlDecode, b64urlEncode, createPushService, encryptWebPushPayload, handlePushRequest, readPushConfig,
    resetPushStateForTests, runPushCron, subscriptionKey, supabaseTenantKeyId, vapidAuthorization, webPushEndpointAllowed
} from '../netlify/lib/push-core.mjs';
import { LICENSE_APP_CODE as CLIENT_APP_CODE } from '../src/features/license';
import { FCM_CHANNEL_ID as CLIENT_FCM_CHANNEL, PUSH_OPEN_PARAM } from '../src/features/push';

const LICENSE_SRC = readFileSync(path.resolve(__dirname, '..', 'public', 'license-verify.js'), 'utf8');
const ANDROID_MANIFEST = readFileSync(path.resolve(__dirname, '..', 'android', 'app', 'src', 'main', 'AndroidManifest.xml'), 'utf8');

function makeStore() {
    const data = new Map<string, { value: string; etag: string }>();
    return {
        data,
        async getWithMetadata(key: string) {
            const hit = data.get(key);
            return hit ? { data: JSON.parse(hit.value), etag: hit.etag, metadata: {} } : null;
        },
        async setJSON(key: string, value: unknown, opts: any = {}) {
            const hit = data.get(key);
            if (opts.onlyIfNew && hit) return { modified: false };
            if (opts.onlyIfMatch && (!hit || hit.etag !== opts.onlyIfMatch)) return { modified: false };
            const json = JSON.stringify(value);
            const etag = '"' + crypto.createHash('sha256').update(json).digest('hex') + '"';
            data.set(key, { value: json, etag });
            return { modified: true, etag };
        },
        async delete(key: string) { data.delete(key); },
        async list(opts: any = {}) {
            const prefix = opts.prefix || '';
            return { blobs: [...data.keys()].filter((k) => k.startsWith(prefix)).map((k) => ({ key: k, etag: data.get(k)!.etag })), directories: [] };
        }
    };
}

function activeSubscriptionKeys(store: ReturnType<typeof makeStore>) {
    return [...store.data.keys()].filter((key) => key.startsWith('sub/') && ['web', 'fcm'].includes(JSON.parse(store.data.get(key)!.value).kind));
}

const signer = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
const signerJwk = signer.publicKey.export({ format: 'jwk' }) as any;

function licenseKey(payload: any, key = signer.privateKey) {
    const payloadB64 = b64urlEncode(Buffer.from(JSON.stringify(payload)));
    const sig = crypto.sign('sha256', Buffer.from(payloadB64), { key, dsaEncoding: 'ieee-p1363' });
    return LICENSE_KEY_PREFIX + payloadB64 + '.' + b64urlEncode(sig);
}

const NOW = Date.UTC(2026, 8, 29, 1, 0, 0);
const KEY_ID = 'ABCDEFGH12345678JKLM';
const OTHER_KEY = 'ZZZZZZZZ87654321WXYZ';
const GOOD = licenseKey({ a: 'ZOE', id: KEY_ID, iat: NOW / 1000 - 10, exp: NOW / 1000 + 86400 * 30 });
const OTHER = licenseKey({ a: 'ZOE', id: OTHER_KEY, iat: NOW / 1000 - 10, exp: NOW / 1000 + 86400 * 30 });

function vapidEnv() {
    const ecdh = crypto.createECDH('prime256v1');
    ecdh.generateKeys();
    // ⛔ `getPrivateKey()` ត្រឡប់ ៣១ byte ពេល byte ដំបូងជា ០ (~១/២៥៦) ➜ បំពេញឲ្យគ្រប់ ៣២ ដូច `scripts/gen-vapid.mjs` (បើអត់ តេស្តធ្លាក់ដោយចៃដន្យ)
    const priv = ecdh.getPrivateKey();
    return { VAPID_PUBLIC_KEY: b64urlEncode(ecdh.getPublicKey()), VAPID_PRIVATE_KEY: b64urlEncode(Buffer.concat([Buffer.alloc(32 - priv.length), priv])), VAPID_SUBJECT: 'mailto:ops@zoew.test' };
}

const fcmKey = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const FCM_SA = { project_id: 'zoew-z1', client_email: 'push@zoew-z1.iam.gserviceaccount.com', private_key: fcmKey.privateKey.export({ type: 'pkcs8', format: 'pem' }) };

function uaKeys() {
    const ecdh = crypto.createECDH('prime256v1');
    ecdh.generateKeys();
    return { ecdh, p256dh: b64urlEncode(ecdh.getPublicKey()), auth: b64urlEncode(crypto.randomBytes(16)) };
}

function decryptWebPush(body: Buffer, ua: ReturnType<typeof uaKeys>) {
    const salt = body.subarray(0, 16);
    const idlen = body[20];
    const asPublic = body.subarray(21, 21 + idlen);
    const cipherText = body.subarray(21 + idlen);
    const shared = ua.ecdh.computeSecret(asPublic);
    const hmac = (k: Buffer, d: Buffer) => crypto.createHmac('sha256', k).update(d).digest();
    const prkKey = hmac(b64urlDecode(ua.auth)!, shared);
    const ikm = hmac(prkKey, Buffer.concat([Buffer.from('WebPush: info\0'), ua.ecdh.getPublicKey(), asPublic, Buffer.from([1])]));
    const prk = hmac(salt, ikm);
    const cek = hmac(prk, Buffer.concat([Buffer.from('Content-Encoding: aes128gcm\0'), Buffer.from([1])])).subarray(0, 16);
    const nonce = hmac(prk, Buffer.concat([Buffer.from('Content-Encoding: nonce\0'), Buffer.from([1])])).subarray(0, 12);
    const decipher = crypto.createDecipheriv('aes-128-gcm', cek, nonce);
    decipher.setAuthTag(cipherText.subarray(cipherText.length - 16));
    const plain = Buffer.concat([decipher.update(cipherText.subarray(0, cipherText.length - 16)), decipher.final()]);
    expect(plain[plain.length - 1]).toBe(2);
    return JSON.parse(plain.subarray(0, plain.length - 1).toString('utf8'));
}

interface Harness {
    store: ReturnType<typeof makeStore>;
    service: any;
    calls: { url: string; init: any }[];
    clock: { now: number };
    db: Record<string, any>;
    notices: Record<string, any> | null;
    push: (url: string, init: any) => { status: number; body?: any } | Promise<{ status: number; body?: any }>;
}

function harness(opts: { env?: any; notices?: Record<string, any> | null; dbDown?: boolean; sbDown?: boolean } = {}): Harness {
    const store = makeStore();
    const clock = { now: NOW };
    const h: Harness = {
        store, clock, calls: [], service: null,
        db: { [KEY_ID]: { expiresAt: NOW + 86400000 * 30, revoked: false }, [OTHER_KEY]: { expiresAt: NOW + 86400000 * 30, revoked: false } },
        notices: opts.notices === undefined ? null : opts.notices,
        push: () => ({ status: 201 })
    };
    const fetch = async (url: string, init: any = {}) => {
        h.calls.push({ url, init });
        const reply = (status: number, body: any) => ({ status, ok: status >= 200 && status < 300, text: async () => (body === undefined ? '' : JSON.stringify(body)) });
        if (url.startsWith(LICENSE_DB_URL_DEFAULT + '/license_keys/')) {
            if (opts.dbDown) throw new TypeError('Failed to fetch');
            const id = url.split('/').pop()!.replace('.json', '');
            return reply(200, h.db[id] === undefined ? null : h.db[id]);
        }
        if (url.startsWith(LICENSE_DB_URL_DEFAULT + '/license_announcements/')) return reply(200, h.notices);
        if (url === 'https://oauth2.googleapis.com/token') return reply(200, { access_token: 'ya29.test', expires_in: 3600 });
        if (url === SB_URL + '/rest/v1/rpc/my_account') {
            if (opts.sbDown) throw new TypeError('Failed to fetch');
            const auth = String((init.headers || {}).Authorization || '').replace(/^Bearer /, '');
            if ((init.headers || {}).apikey !== SB_KEY) return reply(401, { message: 'bad apikey' });
            const acct = SB_ACCOUNTS[auth];
            return acct === undefined ? reply(401, { message: 'JWT invalid' }) : reply(200, acct === null ? [] : [acct]);
        }
        const r = await h.push(url, init);
        return reply(r.status, r.body);
    };
    h.service = createPushService({
        env: opts.env || Object.assign(vapidEnv(), { FCM_SERVICE_ACCOUNT: JSON.stringify(FCM_SA) }),
        store, fetch, now: () => clock.now, publicKeys: [signerJwk]
    });
    return h;
}

const SB_URL = 'https://abcdefghijklmnopqrst.supabase.co';
const SB_KEY = 'sb_publishable_' + 'k'.repeat(30);
const sbEnv = () => Object.assign(vapidEnv(), { FCM_SERVICE_ACCOUNT: JSON.stringify(FCM_SA), SUPABASE_URL: SB_URL, SUPABASE_PUBLISHABLE_KEY: SB_KEY });
const sbJwt = (sub: string, claims: Record<string, any> = {}) => [{ alg: 'HS256', typ: 'JWT' },
    Object.assign({ iss: SB_URL + '/auth/v1', sub, role: 'authenticated', exp: Math.floor(NOW / 1000) + 3600 }, claims), 'sig']
    .map((x) => (typeof x === 'string' ? x : Buffer.from(JSON.stringify(x)).toString('base64url'))).join('.');
const TENANT_A = '11111111-2222-3333-4444-555555555555';
const TENANT_B = '99999999-8888-7777-6666-555555555555';
const SB_OWNER = sbJwt('u-owner');
const SB_STAFF = sbJwt('u-staff');
const SB_OTHER = sbJwt('u-other');
const SB_EXPIRED_SHOP = sbJwt('u-expired');
const SB_NO_SHOP = sbJwt('u-none');
const SB_ACCOUNTS: Record<string, any> = {
    [SB_OWNER]: { tenant_id: TENANT_A, status: 'active', role: 'owner' },
    [SB_STAFF]: { tenant_id: TENANT_A, status: 'active', role: 'member' },
    [SB_OTHER]: { tenant_id: TENANT_B, status: 'active', role: 'owner' },
    [SB_EXPIRED_SHOP]: { tenant_id: TENANT_B, status: 'expired', role: 'owner' },
    [SB_NO_SHOP]: null
};

function webSub(host = 'fcm.googleapis.com') {
    const ua = uaKeys();
    return { ua, sub: { kind: 'web', endpoint: 'https://' + host + '/fcm/send/' + crypto.randomBytes(8).toString('hex'), keys: { p256dh: ua.p256dh, auth: ua.auth } } };
}

function noticeId(at: number) {
    return 'n' + String(at) + 'abcdef';
}

beforeEach(() => resetPushStateForTests());
afterEach(() => { resetPushStateForTests(); vi.useRealTimers(); });

describe('ការអ៊ិនគ្រីប និង VAPID', () => {
    it('RFC 8291 §5 ៖ test vector ផ្លូវការ ➜ ស៊ីបេះបិទ', () => {
        const out = encryptWebPushPayload(Buffer.from('When I grow up, I want to be a watermelon'),
            'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4', 'BTBZMqHH6r4Tts7J_aSIgg',
            { asPrivateKey: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw', salt: 'DGv6ra1nlYgDCS1FRnbzlw' });
        expect(b64urlEncode(out)).toBe('DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN');
    });

    it('កូនសោឧបករណ៍ខូច ➜ បោះ (មិនផ្ញើសំរាម)', () => {
        expect(() => encryptWebPushPayload(Buffer.from('x'), 'AAAA', 'BTBZMqHH6r4Tts7J_aSIgg')).toThrow();
        expect(() => encryptWebPushPayload(Buffer.from('x'), uaKeys().p256dh, 'AAAA')).toThrow();
    });

    it('VAPID JWT ៖ ES256 ផ្ទៀងបានដោយ public key · aud = origin · exp ≤ 24 ម៉ោង · k = public key', () => {
        const env = vapidEnv();
        const cfg = readPushConfig(env);
        const header = vapidAuthorization('https://web.push.apple.com/QGZx/abc', cfg.vapid, NOW);
        const m = /^vapid t=([^,]+), k=(.+)$/.exec(header)!;
        const [h, p, s] = m[1].split('.');
        const pub = b64urlDecode(env.VAPID_PUBLIC_KEY)!;
        const key = crypto.createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: b64urlEncode(pub.subarray(1, 33)), y: b64urlEncode(pub.subarray(33)) }, format: 'jwk' });
        expect(crypto.verify('sha256', Buffer.from(h + '.' + p), { key, dsaEncoding: 'ieee-p1363' }, b64urlDecode(s)!)).toBe(true);
        const claims = JSON.parse(b64urlDecode(p)!.toString());
        expect(claims.aud).toBe('https://web.push.apple.com');
        expect(claims.exp * 1000 - NOW).toBeLessThanOrEqual(24 * 3600 * 1000);
        expect(claims.sub).toBe('mailto:ops@zoew.test');
        expect(m[2]).toBe(env.VAPID_PUBLIC_KEY);
    });

    it('config ៖ VAPID/FCM ខូច ឬគ្មាន ➜ បិទមុខងារនោះ (មិនបោះ) · subject លំនាំដើមពី URL របស់ Netlify', () => {
        expect(readPushConfig({}).vapid).toBeNull();
        expect(readPushConfig({ VAPID_PUBLIC_KEY: 'x', VAPID_PRIVATE_KEY: 'y' }).reasons).toContain('vapid:invalid');
        const env = vapidEnv();
        delete (env as any).VAPID_SUBJECT;
        expect(readPushConfig(Object.assign({ URL: 'https://zoew.netlify.app' }, env)).vapid!.subject).toBe('https://zoew.netlify.app');
        expect(readPushConfig(env).reasons).toContain('vapid:subject');
        expect(readPushConfig({ FCM_SERVICE_ACCOUNT: Buffer.from(JSON.stringify(FCM_SA)).toString('base64') }).fcm!.projectId).toBe('zoew-z1');
        expect(readPushConfig({ FCM_SERVICE_ACCOUNT: '{"project_id":"x"}' }).reasons).toContain('fcm:invalid');
        expect(readPushConfig({ LICENSE_DB_URL: 'https://evil.example.com' }).licenseDbUrl).toBe(LICENSE_DB_URL_DEFAULT);
    });

    it('⛔ SSRF ៖ endpoint Web Push តែ host របស់សេវា push ពិត', () => {
        for (const ok of ['https://fcm.googleapis.com/fcm/send/x', 'https://web.push.apple.com/x', 'https://updates.push.services.mozilla.com/wpush/v2/x', 'https://wns2-par02p.notify.windows.com/w/?token=x']) {
            expect(webPushEndpointAllowed(ok), ok).toBe(true);
        }
        for (const bad of ['http://fcm.googleapis.com/x', 'https://127.0.0.1/x', 'https://fcm.googleapis.com.evil.com/x', 'https://evil.com/fcm.googleapis.com', 'https://u:p@fcm.googleapis.com/x', 'https://fcm.googleapis.com:8443/x', 'nonsense']) {
            expect(webPushEndpointAllowed(bad), bad).toBe(false);
        }
    });
});

describe('ស្នាមភ្ជាប់ ៖ ដេរីវេពីកូដ App ពិត', () => {
    it('public key · prefix · URL License ស្មើ license-verify.js · កូដ App ស្មើ license.ts · channel/URL បើកស្មើ client · manifest', () => {
        const jwkBlock = LICENSE_SRC.match(/PUBLIC_KEYS_JWK = \[([\s\S]*?)\];/)![1];
        const xs = [...jwkBlock.matchAll(/"x": "([^"]+)"/g)].map((m) => m[1]);
        const ys = [...jwkBlock.matchAll(/"y": "([^"]+)"/g)].map((m) => m[1]);
        expect(LICENSE_PUBLIC_KEYS_JWK.map((k: any) => k.x)).toEqual(xs);
        expect(LICENSE_PUBLIC_KEYS_JWK.map((k: any) => k.y)).toEqual(ys);
        expect(LICENSE_SRC).toContain("const KEY_PREFIX = '" + LICENSE_KEY_PREFIX + "';");
        expect(LICENSE_SRC).toContain("const LICENSE_DB_URL = '" + LICENSE_DB_URL_DEFAULT + "';");
        expect(LICENSE_APP_CODE).toBe(CLIENT_APP_CODE);
        expect(SERVER_FCM_CHANNEL).toBe(CLIENT_FCM_CHANNEL);
        expect(new URL(PUSH_OPEN_URL, 'https://x.invalid/').searchParams.get(PUSH_OPEN_PARAM)).toBe('1');
        expect(ANDROID_MANIFEST).toContain('android.permission.POST_NOTIFICATIONS');
        expect(ANDROID_MANIFEST).toMatch(new RegExp('default_notification_channel_id"\\s+android:value="' + CLIENT_FCM_CHANNEL + '"'));
    });
});

describe('អត្តសញ្ញាណ ៖ Activation Key', () => {
    it('Key ពិត + License Project ល្អ ➜ ទទួល · cache ១០ នាទី', async () => {
        const h = harness();
        expect(await h.service.verifyLicense(GOOD)).toEqual({ ok: true, keyId: KEY_ID });
        await h.service.verifyLicense(GOOD);
        expect(h.calls.filter((c) => c.url.includes('/license_keys/'))).toHaveLength(1);
    });

    it('ហត្ថលេខាក្លែង · App ខុស · ទម្រង់ខុស ➜ 403 មុនហៅបណ្តាញ', async () => {
        const h = harness();
        const forger = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
        expect((await h.service.verifyLicense(licenseKey({ a: 'ZOE', id: KEY_ID, iat: 1, exp: 9e9 }, forger.privateKey))).reason).toBe('license:signature');
        expect((await h.service.verifyLicense(licenseKey({ a: 'ZOW', id: KEY_ID, iat: 1, exp: 9e9 }))).reason).toBe('license:app');
        expect((await h.service.verifyLicense('garbage')).reason).toBe('license:format');
        expect(h.calls).toHaveLength(0);
    });

    it('Revoke · ផុតកំណត់តាម DB · មិនមានក្នុង DB ➜ 403 · Extend ក្នុង DB ឈ្នះ exp ដែល sign', async () => {
        const h = harness();
        h.db[KEY_ID] = { expiresAt: NOW + 1000, revoked: true };
        expect((await h.service.verifyLicense(GOOD)).reason).toBe('license:revoked');
        const h2 = harness();
        h2.db[KEY_ID] = { expiresAt: NOW - 1, revoked: false };
        expect((await h2.service.verifyLicense(GOOD)).reason).toBe('license:expired');
        const h3 = harness();
        delete h3.db[KEY_ID];
        expect((await h3.service.verifyLicense(GOOD)).reason).toBe('license:unknown');
        const h4 = harness();
        h4.db[KEY_ID] = { expiresAt: NOW + 86400000 * 400, revoked: false };
        const extended = licenseKey({ a: 'ZOE', id: KEY_ID, iat: 1, exp: NOW / 1000 - 10 });
        expect((await h4.service.verifyLicense(extended)).ok).toBe(true);
    });

    it('⛔ «ផ្ទៀងផ្ទាត់មិនបាន» (DB ដាច់) = 503 មិនមែន «ខុស» ហើយមិនចងចាំ', async () => {
        const h = harness({ dbDown: true });
        const out = await h.service.verifyLicense(GOOD);
        expect(out).toMatchObject({ ok: false, status: 503, reason: 'license:unverified' });
    });
});

describe('ការចុះឈ្មោះ · កាលវិភាគ', () => {
    it.each(['firebase', 'supabase'])('A292 index ចាស់របស់ %s មិនអាចទម្លាក់ subscription ដែលផ្ទេរទៅហាងថ្មី', async (backend) => {
        const h = harness({ env: sbEnv() });
        const first = backend === 'firebase' ? GOOD : { supabase: SB_STAFF };
        const second = backend === 'firebase' ? OTHER : { supabase: SB_OTHER };
        const oldKey = backend === 'firebase' ? KEY_ID : supabaseTenantKeyId(TENANT_A);
        const newKey = backend === 'firebase' ? OTHER_KEY : supabaseTenantKeyId(TENANT_B);
        const device = webSub();
        const key = subscriptionKey(device.sub);
        expect(await h.service.subscribe(first, device.sub)).toMatchObject({ ok: true });
        const set = h.store.setJSON;
        h.store.setJSON = async (k: string, value: unknown, opts: any = {}) => k === 'bykey/' + oldKey
            ? { modified: false } : set(k, value, opts);
        expect(await h.service.subscribe(second, device.sub)).toMatchObject({ ok: true });
        h.store.setJSON = set;
        for (let i = 0; i < PUSH_SUBS_PER_KEY_MAX; i++) expect(await h.service.subscribe(first, webSub().sub)).toMatchObject({ ok: true });
        expect((await h.store.getWithMetadata(key))?.data).toMatchObject({ kind: 'web', keyId: newKey, endpoint: device.sub.endpoint });
        expect((await h.store.getWithMetadata('bykey/' + newKey))?.data.subs).toContain(key);
        expect(await h.service.sendToKeys([key], { title: 'new shop' }, NOW, newKey)).toMatchObject({ sent: 1 });
    });

    it('A292 victim ពី CAS បរាជ័យមិនត្រូវទម្លាក់ឧបករណ៍ដែល refresh ក្នុងការប្រជែង', async () => {
        const h = harness();
        const devices = Array.from({ length: PUSH_SUBS_PER_KEY_MAX + 1 }, () => webSub());
        for (const device of devices.slice(0, -1)) await h.service.subscribe(GOOD, device.sub);
        const set = h.store.setJSON;
        let injected = false;
        h.store.setJSON = async (key: string, value: unknown, opts: any = {}) => {
            if (!injected && key === 'bykey/' + KEY_ID) {
                injected = true;
                expect(await h.service.subscribe(GOOD, devices[0].sub)).toMatchObject({ ok: true });
            }
            return set(key, value, opts);
        };
        expect(await h.service.subscribe(GOOD, devices.at(-1)!.sub)).toMatchObject({ ok: true });
        const index = (await h.store.getWithMetadata('bykey/' + KEY_ID))!.data.subs;
        expect(index).toContain(subscriptionKey(devices[0].sub));
        expect(index).not.toContain(subscriptionKey(devices[1].sub));
        for (const key of index) expect((await h.store.getWithMetadata(key))?.data.kind).toBe('web');
    });

    it.each(['refresh', 'move'])('A292 %s ក្រោយ index CAS មុនទម្លាក់ victim មិនត្រូវបានលុប', async (change) => {
        const h = harness();
        const devices = Array.from({ length: PUSH_SUBS_PER_KEY_MAX + 1 }, () => webSub());
        for (const device of devices.slice(0, -1)) await h.service.subscribe(GOOD, device.sub);
        const set = h.store.setJSON;
        let injected = false;
        h.store.setJSON = async (key: string, value: unknown, opts: any = {}) => {
            const out = await set(key, value, opts);
            if (!injected && key === 'bykey/' + KEY_ID && out.modified) {
                injected = true;
                expect(await h.service.subscribe(change === 'move' ? OTHER : GOOD, devices[0].sub)).toMatchObject({ ok: true });
            }
            return out;
        };
        expect(await h.service.subscribe(GOOD, devices.at(-1)!.sub)).toMatchObject({ ok: true });
        const owner = change === 'move' ? OTHER_KEY : KEY_ID;
        const key = subscriptionKey(devices[0].sub);
        expect((await h.store.getWithMetadata(key))?.data).toMatchObject({ kind: 'web', keyId: owner });
        expect((await h.store.getWithMetadata('bykey/' + owner))?.data.subs).toContain(key);
        expect(await h.service.sendToKeys([key], { title: 'current device' }, NOW, owner)).toMatchObject({ sent: 1 });
    });

    it.each(['unsubscribe', 'gone'].flatMap((action) => ['before', 'after'].flatMap((phase) =>
        ['refresh', 'move'].map((change) => ({ action, phase, change })))))('A292 $action / $phase index CAS / $change ៖ cleanup ចាស់រក្សា generation ថ្មី', async ({ action, phase, change }) => {
        const h = harness();
        const device = webSub();
        const key = subscriptionKey(device.sub);
        await h.service.subscribe(GOOD, device.sub);
        const set = h.store.setJSON;
        let injected = false;
        const refresh = async () => {
            injected = true;
            expect(await h.service.subscribe(change === 'move' ? OTHER : GOOD, device.sub, 'native')).toMatchObject({ ok: true });
        };
        h.store.setJSON = async (k: string, value: unknown, opts: any = {}) => {
            const inject = !injected && k === 'bykey/' + KEY_ID;
            if (inject && phase === 'before') await refresh();
            const result = await set(k, value, opts);
            if (inject && phase === 'after' && result.modified) await refresh();
            return result;
        };
        if (action === 'unsubscribe') await h.service.unsubscribe(device.sub);
        else {
            h.push = () => ({ status: 410 });
            expect(await h.service.sendToKeys([key], { title: 'old' }, NOW, KEY_ID)).toMatchObject({ gone: 1 });
        }
        expect(injected).toBe(true);
        const owner = change === 'move' ? OTHER_KEY : KEY_ID;
        expect((await h.store.getWithMetadata(key))?.data).toMatchObject({ kind: 'web', keyId: owner, platform: 'native' });
        expect((await h.store.getWithMetadata('bykey/' + owner))?.data.subs).toContain(key);
        h.push = () => ({ status: 201 });
        expect(await h.service.sendToKeys([key], { title: 'fresh' }, NOW, owner)).toMatchObject({ sent: 1 });
    });

    it.each([false, true])('A292 rollback របស់ index បរាជ័យរក្សា owner/refresh ថ្មី (មាន record ចាស់=%s)', async (hadRecord) => {
        const h = harness();
        const device = webSub();
        const key = subscriptionKey(device.sub);
        if (hadRecord) await h.service.subscribe(GOOD, device.sub);
        const failedOwner = hadRecord ? OTHER_KEY : KEY_ID;
        const set = h.store.setJSON;
        let attempts = 0;
        let freshRevision = '';
        h.store.setJSON = async (k: string, value: unknown, opts: any = {}) => {
            if (k !== 'bykey/' + failedOwner) return set(k, value, opts);
            if (++attempts === 4) {
                h.store.setJSON = set;
                expect(await h.service.subscribe(hadRecord ? GOOD : OTHER, device.sub, 'native')).toMatchObject({ ok: true });
                freshRevision = (await h.store.getWithMetadata(key))!.data.revision;
            }
            return { modified: false };
        };
        expect(await h.service.subscribe(hadRecord ? OTHER : GOOD, device.sub)).toMatchObject({ ok: false, reason: 'index:busy' });
        const owner = hadRecord ? KEY_ID : OTHER_KEY;
        expect((await h.store.getWithMetadata(key))?.data).toMatchObject({ kind: 'web', keyId: owner, platform: 'native', revision: freshRevision });
        expect((await h.store.getWithMetadata('bykey/' + owner))?.data.subs).toContain(key);
    });

    it('A292 tombstone គ្មាន endpoint/key/token · មិនផ្ញើ · endpoint អាចចុះឈ្មោះម្តងទៀត', async () => {
        const h = harness();
        const device = webSub();
        const key = subscriptionKey(device.sub);
        await h.service.subscribe(GOOD, device.sub);
        await h.service.unsubscribe(device.sub);
        expect((await h.store.getWithMetadata(key))?.data).toEqual({ retired: true });
        expect(await h.service.sendToKeys([key], { title: 'inactive' }, NOW)).toMatchObject({ sent: 0, skip: 1 });
        expect(await h.service.subscribe(OTHER, device.sub)).toMatchObject({ ok: true });
        expect((await h.store.getWithMetadata(key))?.data).toMatchObject({ kind: 'web', keyId: OTHER_KEY });
        expect(await h.service.sendToKeys([key], { title: 'revived' }, NOW, OTHER_KEY)).toMatchObject({ sent: 1 });
    });

    it('A292 ពិដានរាប់តែ active ទោះមាន tombstone ច្រើនជាង 5000 · slot ទំនេរអាចប្រើឡើងវិញ', async () => {
        const h = harness();
        for (let i = 0; i <= PUSH_SUBS_TOTAL_MAX; i++) await h.store.setJSON('sub/retired-' + i, { retired: true });
        const device = webSub();
        expect(await h.service.subscribe(GOOD, device.sub)).toMatchObject({ ok: true });
        const record = (await h.store.getWithMetadata(subscriptionKey(device.sub)))!.data;
        for (let i = 0; i < PUSH_SUBS_TOTAL_MAX - 1; i++) await h.store.setJSON('sub/active-' + i, record);
        expect(await h.service.subscribe(OTHER, webSub().sub)).toMatchObject({ ok: false, status: 507, reason: 'subs:full' });
        await h.service.unsubscribe(device.sub);
        expect(await h.service.subscribe(OTHER, device.sub)).toMatchObject({ ok: true });
        expect(activeSubscriptionKeys(h.store)).toHaveLength(PUSH_SUBS_TOTAL_MAX);
    });

    it.each(['list', 'record'])('A292 capacity %s ខូច/អានបរាជ័យ ➜ 503 មិនចុះឈ្មោះលើសពិដាន', async (failure) => {
        const h = harness();
        if (failure === 'list') h.store.list = async () => ({ blobs: null } as any);
        else {
            for (let i = 0; i < PUSH_SUBS_TOTAL_MAX; i++) await h.store.setJSON('sub/retired-' + i, { retired: true });
            const get = h.store.getWithMetadata;
            h.store.getWithMetadata = async (key: string) => {
                if (key.startsWith('sub/retired-')) throw new Error('read unavailable');
                return get(key);
            };
        }
        expect(await h.service.subscribe(GOOD, webSub().sub)).toMatchObject({ ok: false, status: 503, reason: 'subs:unverified' });
        expect(activeSubscriptionKeys(h.store)).toEqual([]);
    });

    it('A292 ពិនិត្យ active capacity មិនបាន ➜ 503 · bounded reads មិនបន្តស្កេនក្រោយ timeout', async () => {
        const h = harness();
        for (let i = 0; i < PUSH_SUBS_TOTAL_MAX; i++) await h.store.setJSON('sub/retired-' + i, { retired: true });
        await h.service.verifyLicense(GOOD);
        const get = h.store.getWithMetadata;
        let reads = 0;
        h.store.getWithMetadata = async (key: string) => {
            if (key.startsWith('sub/retired-')) { reads++; return new Promise(() => {}); }
            return get(key);
        };
        vi.useFakeTimers();
        const pending = h.service.subscribe(GOOD, webSub().sub);
        await vi.advanceTimersByTimeAsync(PUSH_READ_TIMEOUT_MS + 1);
        expect(await pending).toMatchObject({ ok: false, status: 503, reason: 'subs:unverified' });
        expect(reads).toBe(PUSH_SEND_CONCURRENCY);
        expect(activeSubscriptionKeys(h.store)).toEqual([]);
        vi.useRealTimers();
    });

    it('subscribe ៖ រក្សាទុក · ចងនឹង Key · ចុះម្តងទៀតមិនស្ទួន · ពិដានក្នុងមួយ Key ➜ ទម្លាក់ចាស់ជាងគេ', async () => {
        const h = harness();
        const first = webSub();
        expect(await h.service.subscribe(GOOD, first.sub, 'web')).toMatchObject({ ok: true });
        expect(await h.service.subscribe(GOOD, first.sub, 'web')).toMatchObject({ ok: true });
        const subs = () => activeSubscriptionKeys(h.store);
        expect(subs()).toHaveLength(1);
        for (let i = 0; i < PUSH_SUBS_PER_KEY_MAX; i++) await h.service.subscribe(GOOD, webSub().sub, 'web');
        expect(subs()).toHaveLength(PUSH_SUBS_PER_KEY_MAX);
        const index = JSON.parse(h.store.data.get('bykey/' + KEY_ID)!.value).subs;
        expect(index).toHaveLength(PUSH_SUBS_PER_KEY_MAX);
        expect(index.every((k: string) => h.store.data.has(k))).toBe(true);
        const stored = JSON.parse(h.store.data.get(index[0])!.value);
        expect(stored.keyId).toBe(KEY_ID);
        expect(JSON.stringify([...h.store.data.values()])).not.toContain(GOOD);
    });

    it('subscribe ៖ endpoint/កូនសោខូច ➜ 400 · VAPID មិនទាន់កំណត់ ➜ 503 vapid:unset · FCM token ខូច ➜ 400', async () => {
        const h = harness();
        expect((await h.service.subscribe(GOOD, { kind: 'web', endpoint: 'https://evil.com/x', keys: webSub().sub.keys })).reason).toBe('sub:endpoint');
        expect((await h.service.subscribe(GOOD, { kind: 'web', endpoint: webSub().sub.endpoint, keys: { p256dh: 'AA', auth: 'BB' } })).reason).toBe('sub:keys');
        expect((await h.service.subscribe(GOOD, { kind: 'fcm', token: 'bad token!' })).reason).toBe('sub:token');
        const off = harness({ env: {} });
        expect(await off.service.subscribe(GOOD, webSub().sub)).toMatchObject({ ok: false, status: 503, reason: 'vapid:unset' });
    });

    it('⛔ index រវល់ (ETag ជាន់គ្នាគ្រប់ដង) ➜ 503 ហើយគ្មាន sub កំព្រា · ចុះឈ្មោះរាប់រយស្របគ្នា ➜ sub ទាំងអស់ក្នុង index ≤ ពិដានក្នុងមួយ Key', async () => {
        const h = harness();
        const subs = () => activeSubscriptionKeys(h.store);
        const realSet = h.store.setJSON;
        h.store.setJSON = async (key: string, value: unknown, opts: any = {}) => (key.startsWith('bykey/') ? { modified: false } : realSet(key, value, opts));
        expect(await h.service.subscribe(GOOD, webSub().sub, 'web')).toMatchObject({ ok: false, status: 503, reason: 'index:busy' });
        expect(subs()).toHaveLength(0);
        h.store.setJSON = realSet;
        const moved = webSub();
        expect(await h.service.subscribe(GOOD, moved.sub, 'web')).toMatchObject({ ok: true });
        h.store.setJSON = async (key: string, value: unknown, opts: any = {}) => (key === 'bykey/' + OTHER_KEY ? { modified: false } : realSet(key, value, opts));
        expect(await h.service.subscribe(OTHER, moved.sub, 'web')).toMatchObject({ ok: false, status: 503 });
        expect(subs()).toHaveLength(1);
        expect(JSON.parse(h.store.data.get(subs()[0])!.value).keyId).toBe(KEY_ID);
        h.store.setJSON = realSet;
        const burst = await Promise.all(Array.from({ length: 120 }, () => h.service.subscribe(OTHER, webSub().sub, 'web')));
        expect(burst.some((r: any) => r.ok)).toBe(true);
        const indexed = new Set<string>([KEY_ID, OTHER_KEY].flatMap((k) => (h.store.data.has('bykey/' + k) ? JSON.parse(h.store.data.get('bykey/' + k)!.value).subs : [])));
        expect(subs().filter((k) => !indexed.has(k))).toEqual([]);
        expect(subs().length).toBeLessThanOrEqual(PUSH_SUBS_PER_KEY_MAX + 1);
    });

    it('unsubscribe ៖ លុបទាំង sub និង index', async () => {
        const h = harness();
        const s = webSub();
        await h.service.subscribe(GOOD, s.sub);
        await h.service.unsubscribe(s.sub);
        expect(activeSubscriptionKeys(h.store)).toHaveLength(0);
        expect(JSON.parse(h.store.data.get('bykey/' + KEY_ID)!.value).subs).toEqual([]);
    });

    it('schedule ៖ រក្សាតែពេលអនាគតក្នុងព្រំដែន · តម្រៀប · លេខខុស ➜ 400 · គ្មាន Key ➜ 403', async () => {
        const h = harness();
        const out = await h.service.saveSchedule(GOOD, [NOW + 5000, NOW - 1, NOW + 1000, NOW + 86400000 * 30]);
        expect(out).toMatchObject({ ok: true, count: 2 });
        expect(JSON.parse(h.store.data.get('sched/' + KEY_ID)!.value).times).toEqual([NOW + 1000, NOW + 5000]);
        expect((await h.service.saveSchedule(GOOD, ['x'])).status).toBe(400);
        expect((await h.service.saveSchedule('nope', [])).status).toBe(403);
    });
});

describe('ការបញ្ជូនដំណឹងពីអ្នកលក់', () => {
    async function withSubs(h: Harness, n: number) {
        const list = [];
        for (let i = 0; i < n; i++) {
            const s = webSub();
            await h.service.subscribe(GOOD, s.sub);
            list.push(s);
        }
        return list;
    }

    it('លើកដំបូង ➜ baseline (មិនផ្ញើដំណឹងចាស់) · ដំណឹងថ្មី ➜ ផ្ញើម្តង ហើយឧបករណ៍ឌិគ្រីបបាន · រត់ម្តងទៀត ➜ គ្មាន', async () => {
        const old = NOW - 3600e3;
        const h = harness({ notices: { [noticeId(old)]: { kind: 'notice', title: 'ចាស់', at: old } } });
        const subs = await withSubs(h, 2);
        const sent: { url: string; body: Buffer; headers: any }[] = [];
        h.push = (url, init) => { sent.push({ url, body: init.body, headers: init.headers }); return { status: 201 }; };
        expect(await h.service.dispatchNotices()).toMatchObject({ reason: 'baseline', sent: 0 });
        expect(sent).toHaveLength(0);
        const fresh = NOW - 60e3;
        h.notices![noticeId(fresh)] = { kind: 'maintenance', title: 'ថែទាំយប់នេះ', body: 'ម៉ោង ៩', at: fresh };
        expect(await h.service.dispatchNotices()).toMatchObject({ reason: 'sent', sent: 2 });
        expect(sent).toHaveLength(2);
        for (const s of subs) {
            const hit = sent.find((x) => x.url === s.sub.endpoint)!;
            expect(hit.headers['Content-Encoding']).toBe('aes128gcm');
            expect(hit.headers.Authorization).toMatch(/^vapid t=/);
            const msg = decryptWebPush(hit.body, s.ua);
            expect(msg).toMatchObject({ title: '🛠️ ថែទាំយប់នេះ', body: 'ម៉ោង ៩', tag: 'notice-' + noticeId(fresh), url: PUSH_OPEN_URL });
        }
        expect(await h.service.dispatchNotices()).toMatchObject({ reason: 'none', sent: 0 });
        expect(sent).toHaveLength(2);
    });

    it('⛔ cron + kick ស្របគ្នា ➜ ផ្ញើតែម្តង (ledger ចាក់សោដោយ ETag)', async () => {
        const h = harness({ notices: {} });
        await withSubs(h, 1);
        await h.service.dispatchNotices();
        const fresh = NOW - 1000;
        h.notices = { [noticeId(fresh)]: { kind: 'notice', title: 'ថ្មី', at: fresh } };
        let count = 0;
        h.push = () => { count++; return { status: 201 }; };
        const [a, b] = await Promise.all([h.service.dispatchNotices(), h.service.dispatchNotices()]);
        expect(count).toBe(1);
        expect([a.reason, b.reason].sort()).toEqual(['race', 'sent']);
    });

    it('ដំណឹងចាស់ជាង ២៤ ម៉ោង (server ដាច់យូរ) ➜ មិនផ្ញើ តែ ledger រំកិល · ការអានធ្លាក់ ➜ មិនប៉ះ ledger', async () => {
        const h = harness({ notices: {} });
        await withSubs(h, 1);
        await h.service.dispatchNotices();
        const stale = NOW - PUSH_NOTICE_MAX_AGE_MS - 1000;
        h.notices = { [noticeId(stale)]: { kind: 'notice', title: 'យូរ', at: stale } };
        expect(await h.service.dispatchNotices()).toMatchObject({ reason: 'stale', sent: 0 });
        expect(JSON.parse(h.store.data.get('state/notices')!.value).lastId).toBe(noticeId(stale));
        h.notices = 'bad' as any;
        expect(await h.service.dispatchNotices()).toMatchObject({ ok: false, reason: 'notices:read' });
    });

    it('410/404 ➜ លុប sub និង index · 5xx ➜ រក្សា', async () => {
        const h = harness({ notices: {} });
        const subs = await withSubs(h, 2);
        await h.service.dispatchNotices();
        h.notices = { [noticeId(NOW - 1000)]: { kind: 'notice', title: 'x', at: NOW - 1000 } };
        h.push = (url) => ({ status: url === subs[0].sub.endpoint ? 410 : 503 });
        const out = await h.service.dispatchNotices();
        expect(out).toMatchObject({ gone: 1, fail: 1 });
        const keys = activeSubscriptionKeys(h.store);
        expect(keys).toHaveLength(1);
        expect(JSON.parse(h.store.data.get('bykey/' + KEY_ID)!.value).subs).toEqual(keys);
    });

    it('FCM ៖ OAuth តែម្តង · សារមាន channel/tag/url · UNREGISTERED ➜ លុប', async () => {
        const h = harness({ notices: {} });
        await h.service.subscribe(GOOD, { kind: 'fcm', token: 'tokA:' + 'x'.repeat(40) });
        await h.service.subscribe(GOOD, { kind: 'fcm', token: 'tokB:' + 'y'.repeat(40) });
        await h.service.dispatchNotices();
        h.notices = { [noticeId(NOW - 1000)]: { kind: 'notice', title: 'សួស្តី', at: NOW - 1000 } };
        const bodies: any[] = [];
        h.push = (url, init) => {
            expect(url).toBe('https://fcm.googleapis.com/v1/projects/zoew-z1/messages:send');
            expect(init.headers.Authorization).toBe('Bearer ya29.test');
            const b = JSON.parse(init.body);
            bodies.push(b);
            return b.message.token.startsWith('tokB') ? { status: 404, body: { error: { status: 'NOT_FOUND', details: [{ errorCode: 'UNREGISTERED' }] } } } : { status: 200, body: {} };
        };
        const out = await h.service.dispatchNotices();
        expect(out).toMatchObject({ sent: 1, gone: 1 });
        expect(h.calls.filter((c) => c.url === 'https://oauth2.googleapis.com/token')).toHaveLength(1);
        const oauth = h.calls.find((c) => c.url === 'https://oauth2.googleapis.com/token')!;
        expect(h.calls.every(call => call.init.redirect === 'error')).toBe(true);
        const assertion = decodeURIComponent(oauth.init.body).split('assertion=')[1];
        const [hh, pp, ss] = assertion.split('.');
        expect(crypto.verify('RSA-SHA256', Buffer.from(hh + '.' + pp), fcmKey.publicKey, b64urlDecode(ss)!)).toBe(true);
        expect(bodies[0].message.android.notification.channel_id).toBe(CLIENT_FCM_CHANNEL);
        expect(bodies[0].message.notification.title).toBe('📢 សួស្តី');
        expect(bodies[0].message.data.url).toBe(PUSH_OPEN_URL);
        expect(activeSubscriptionKeys(h.store)).toHaveLength(1);
    });
});

describe('ការរំលឹកកញ្ចប់ជិតដល់ពេលត្រឡប់ (ម៉ោង ៨ ព្រឹក Asia/Phnom_Penh)', () => {
    const at8 = Date.UTC(2026, 8, 29, PUSH_EXPIRY_HOUR - 7, 2, 0);

    it('រាប់តែ Key ខ្លួនឯង · ក្នុង ២៤ ម៉ោង · ម្តងក្នុងមួយថ្ងៃ · ឧបករណ៍ Key ផ្សេងមិនទទួល', async () => {
        const h = harness();
        h.clock.now = at8 - 3600e3;
        const mine = webSub();
        const other = webSub();
        await h.service.subscribe(GOOD, mine.sub);
        await h.service.subscribe(OTHER, other.sub);
        await h.service.saveSchedule(GOOD, [at8 + 3600e3, at8 + 20 * 3600e3, at8 + 30 * 3600e3]);
        h.clock.now = at8;
        const sent: { url: string; body: Buffer }[] = [];
        h.push = (url, init) => { sent.push({ url, body: init.body }); return { status: 201 }; };
        expect(await h.service.dispatchExpiry()).toMatchObject({ sent: 1, keys: 1 });
        expect(sent.map((s) => s.url)).toEqual([mine.sub.endpoint]);
        const msg = decryptWebPush(sent[0].body, mine.ua);
        expect(msg.title).toBe('📦 2 កញ្ចប់ជិតដល់ពេលត្រឡប់ទៅសាខាកណ្តាលវិញ');
        expect(msg.body).toContain('តាមទិន្នន័យម៉ោង 07:02');
        h.clock.now = at8 + 5 * 60e3;
        expect(await h.service.dispatchExpiry()).toMatchObject({ sent: 0 });
    });

    it('ក្រៅម៉ោង ៨ ➜ គ្មាន · កាលវិភាគចាស់ជាង ៤៨ ម៉ោង ➜ គ្មាន (មិនអះអាងលើទិន្នន័យចាស់) · ចំនួន ០ ➜ គ្មាន', async () => {
        const h = harness();
        h.clock.now = at8 - 3600e3;
        await h.service.subscribe(GOOD, webSub().sub);
        await h.service.saveSchedule(GOOD, [at8 + 3600e3]);
        let count = 0;
        h.push = () => { count++; return { status: 201 }; };
        expect(await h.service.dispatchExpiry()).toMatchObject({ reason: 'not-hour' });
        h.clock.now = at8 + PUSH_SCHEDULE_MAX_AGE_MS;
        expect(await h.service.dispatchExpiry()).toMatchObject({ sent: 0 });
        expect(count).toBe(0);
        const h2 = harness();
        h2.clock.now = at8 - 3600e3;
        await h2.service.subscribe(GOOD, webSub().sub);
        await h2.service.saveSchedule(GOOD, [at8 + 30 * 3600e3]);
        h2.clock.now = at8;
        h2.push = () => { count++; return { status: 201 }; };
        await h2.service.dispatchExpiry();
        expect(count).toBe(0);
    });
});

describe('⛔ cron ៖ ពិដាន ៣០ វិ. របស់ Netlify scheduled function', () => {
    const at8 = Date.UTC(2026, 8, 29, PUSH_EXPIRY_HOUR - 7, 2, 0);
    const NETLIFY_SCHEDULED_LIMIT_MS = 30000;

    it('ដំណាក់ ២ (រំលឹក ➜ ដំណឹង) ចែកពិដានតែមួយ ៖ ការផ្ញើយឺត ➜ ការរត់ទាំងមូលនៅក្នុង ៣០ វិ. · ដំណឹងដែលពិដានអស់មិនចាក់សោ ហើយទៅ run បន្ទាប់', async () => {
        const h = harness({ notices: {} });
        h.clock.now = at8 - 3600e3;
        for (let i = 0; i < 4; i++) await h.service.subscribe(GOOD, webSub().sub);
        await h.service.saveSchedule(GOOD, [at8 + 3600e3]);
        h.clock.now = at8;
        await h.service.dispatchNotices();
        h.notices = { [noticeId(at8)]: { kind: 'notice', title: 'ថ្មី', at: at8 } };
        let sent = 0;
        h.push = () => { sent++; h.clock.now += 7000; return { status: 201 }; };
        const t0 = h.clock.now;
        const out = await runPushCron(h.service, () => h.clock.now);
        expect(out.expiry).toMatchObject({ keys: 1, sent: 4 });
        expect(out.notices).toMatchObject({ reason: 'partial', sent: 0 });
        expect(h.clock.now - t0).toBeLessThanOrEqual(NETLIFY_SCHEDULED_LIMIT_MS);
        expect((await h.store.getWithMetadata('state/notices'))!.data.carry, 'ពិដានអស់មុនចាក់សោដំណឹង ➜ មិនមាន carry').toBeUndefined();
        h.push = () => { sent++; return { status: 201 }; };
        h.clock.now = at8 + 5 * 60e3;
        const next = await runPushCron(h.service, () => h.clock.now);
        expect(next.notices).toMatchObject({ reason: 'sent', sent: 4 });
        expect(next.expiry).toMatchObject({ keys: 0 });
        expect(sent).toBe(8);
    });

    it('⛔ ការអានដំណឹង License ដែលគាំងដល់ពិដានក្នុងម៉ោង ៨ មិនបំបាត់ការរំលឹកកញ្ចប់ជិតត្រឡប់', async () => {
        const h = harness({ notices: {} });
        h.clock.now = at8 - 3600e3;
        await h.service.subscribe(GOOD, webSub().sub);
        await h.service.saveSchedule(GOOD, [at8 + 3600e3]);
        await h.service.dispatchNotices();
        h.clock.now = at8;
        const sentTo: string[] = [];
        h.push = (url: string) => { sentTo.push(url); return { status: 201 }; };
        let hung = 0;
        Object.defineProperty(h, 'notices', { configurable: true, get: () => { hung++; h.clock.now += PUSH_READ_TIMEOUT_MS + 5; throw new TypeError('The operation was aborted'); } });
        for (let k = 0; k < 12; k++) {
            h.clock.now = at8 + k * 5 * 60e3;
            await runPushCron(h.service, () => h.clock.now);
        }
        expect(hung, 'ការអានដំណឹងគាំងគ្រប់ run').toBe(12);
        expect(sentTo.length, 'គ្រប់ run អានដំណឹងគាំង ៤ វិ. ➜ ការរំលឹកនៅតែផ្ញើ ១ ដង').toBe(1);
        expect(await h.store.getWithMetadata('state/expiry/' + KEY_ID)).not.toBeNull();
    });

    it('⛔ ពិដានអស់ក្រោយការអាន ➜ មិនចាក់សោរំលឹកថ្ងៃនេះ (រត់បន្ទាប់ក្នុងម៉ោង ៨ នៅផ្ញើបាន)', async () => {
        const h = harness();
        h.clock.now = at8 - 3600e3;
        await h.service.subscribe(GOOD, webSub().sub);
        await h.service.saveSchedule(GOOD, [at8 + 3600e3]);
        h.clock.now = at8;
        const read = h.store.getWithMetadata.bind(h.store);
        let slow = true;
        h.store.getWithMetadata = async (key: string) => {
            if (slow && key.startsWith('sched/')) h.clock.now += 21000;
            return read(key);
        };
        let sent = 0;
        h.push = () => { sent++; return { status: 201 }; };
        await h.service.dispatchExpiry();
        expect(sent).toBe(0);
        slow = false;
        h.clock.now = at8 + 5 * 60e3;
        await h.service.dispatchExpiry();
        expect(sent).toBe(1);
    });
});

describe('⛔ ហាងច្រើន ៖ ការរំលឹកម៉ោង ៨ ព្រឹកដល់គ្រប់ហាង (ចុងជួរមិនអត់)', () => {
    const at8 = Date.UTC(2026, 8, 29, PUSH_EXPIRY_HOUR - 7, 0, 30);
    // នាឡិកាសាកល្បង ៖ Blobs ៤០ ms · Push ២០០ ms · Promise ត្រួតគ្នាពិត។ វាស់លំហូរបណ្ដាញដែលកំណត់ មិនមែនល្បឿន CPU របស់ម៉ាស៊ីនទេ។
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    function scaledHarness(shops: number) {
        const h = harness();
        vi.useFakeTimers();
        vi.setSystemTime(at8 - 3600e3);
        Object.defineProperty(h.clock, 'now', {
            configurable: true,
            get: () => Date.now(),
            set: (v: number) => vi.setSystemTime(v)
        });
        async function run<T>(pending: Promise<T>): Promise<T> {
            await vi.runAllTimersAsync();
            return pending;
        }
        const store = h.store as any;
        for (const name of ['getWithMetadata', 'setJSON', 'delete', 'list']) {
            const real = store[name].bind(store);
            store[name] = async (...args: any[]) => { await sleep(40); return real(...args); };
        }
        const sent = new Map<string, number>();
        h.push = (url: string) => { sent.set(url, (sent.get(url) || 0) + 1); return { status: 201 }; };
        const realSend = h.push;
        const endpoints: string[] = [];
        return {
            h, sent, endpoints, run,
            async seed() {
                for (let s = 0; s < shops; s++) {
                    const keyId = 'SHOP' + String(s).padStart(16, '0');
                    const ua = uaKeys();
                    const endpoint = 'https://fcm.googleapis.com/fcm/send/shop' + s;
                    const subKey = 'sub/' + crypto.createHash('sha256').update('web|' + endpoint).digest('hex').slice(0, 40);
                    const at = h.clock.now;
                    h.store.data.set(subKey, { value: JSON.stringify({ kind: 'web', endpoint, p256dh: ua.p256dh, auth: ua.auth, keyId, platform: 'web', createdAt: at, seenAt: at }), etag: '"s' + s + '"' });
                    h.store.data.set('bykey/' + keyId, { value: JSON.stringify({ subs: [subKey] }), etag: '"k' + s + '"' });
                    h.store.data.set('sched/' + keyId, { value: JSON.stringify({ times: [at8 + 3600e3], at }), etag: '"t' + s + '"' });
                    endpoints.push(endpoint);
                }
            },
            async cronHour() {
                h.push = async (url: string, init: any) => { await sleep(200); return realSend(url, init); };
                const runs: any[] = [];
                for (let k = 0; k < 12; k++) {
                    h.clock.now = at8 + k * 5 * 60e3;
                    const started = h.clock.now;
                    const out = await run(runPushCron(h.service, () => h.clock.now));
                    runs.push({ out, ms: h.clock.now - started });
                }
                return runs;
            }
        };
    }

    it('⛔ ដំណឹងអ្នកលក់ទៅឧបករណ៍ ៣០០០ ៖ run ដែលអស់ពិដានបន្តនៅ cron បន្ទាប់ ➜ គ្រប់ឧបករណ៍ទទួល ១ ដងគត់ · run នីមួយៗក្នុង ៣០ វិ.', async () => {
        const t = scaledHarness(3000);
        t.h.notices = {};
        await t.seed();
        t.h.clock.now = at8;
        expect(await t.run(t.h.service.dispatchNotices())).toMatchObject({ reason: 'baseline' });
        t.h.notices = { [noticeId(at8 - 60e3)]: { kind: 'maintenance', title: 'ថែទាំយប់នេះ', at: at8 - 60e3 } };
        t.h.push = async (url: string) => { await sleep(200); t.sent.set(url, (t.sent.get(url) || 0) + 1); return { status: 201 }; };
        // ⛔ រត់រហូត run លែង `partial` (ពិដាន ២៤ ម៉ោង = អាយុដំណឹង) ហើយ run `partial` នីមួយៗត្រូវផ្ញើបន្ថែម។ ពេលវេលាមកពីបណ្ដាញសាកល្បងខាងលើ។
        const runs: any[] = [];
        for (let k = 0; k < 288; k++) {
            t.h.clock.now = at8 + 3 * 3600e3 + k * 5 * 60e3;
            const started = t.h.clock.now;
            const before = t.sent.size;
            const out = await t.run<{ reason?: string }>(t.h.service.dispatchNotices(started));
            runs.push({ out, ms: t.h.clock.now - started, added: t.sent.size - before });
            if (out.reason !== 'partial') break;
        }
        const missing = t.endpoints.filter((url) => !t.sent.has(url)).length;
        const twice = t.endpoints.filter((url) => (t.sent.get(url) || 0) > 1).length;
        expect({ missing, twice }).toEqual({ missing: 0, twice: 0 });
        expect(runs.length, 'run ១ មិនគ្រប់ ➜ ការបន្តនៅ cron បន្ទាប់ត្រូវបានវាស់ពិត').toBeGreaterThan(1);
        expect(runs.filter((run) => run.out.reason === 'partial' && !(run.added > 0)), 'run `partial` គ្មានការផ្ញើថ្មី = ជាប់គាំង').toEqual([]);
        expect(Math.max(...runs.map((run) => run.ms))).toBeLessThanOrEqual(30000);
        expect(await t.run(t.h.service.dispatchNotices(t.h.clock.now))).toMatchObject({ reason: 'none' });
    }, 90000);

    it('⛔ ៤០០ ហាង · cron ១២ ដងក្នុងម៉ោង ៨ ➜ គ្រប់ហាងទទួលការរំលឹក ១ ដងគត់ · គ្មាន ledger ចាក់សោដោយមិនបានផ្ញើ · run នីមួយៗក្នុង ៣០ វិ.', async () => {
        const t = scaledHarness(400);
        await t.seed();
        const runs = await t.cronHour();
        const missing = t.endpoints.filter((url) => !t.sent.has(url));
        const twice = t.endpoints.filter((url) => (t.sent.get(url) || 0) > 1);
        const claimedNotSent = [...t.h.store.data.keys()].filter((k) => k.startsWith('state/expiry/SHOP'))
            .filter((k) => !t.sent.has('https://fcm.googleapis.com/fcm/send/shop' + Number(k.slice('state/expiry/SHOP'.length))));
        expect({ missing: missing.length, twice: twice.length, claimedNotSent: claimedNotSent.length })
            .toEqual({ missing: 0, twice: 0, claimedNotSent: 0 });
        expect(runs.every((run) => run.out.expiry && run.out.expiry.ok)).toBe(true);
        expect(Math.max(...runs.map((run) => run.ms))).toBeLessThanOrEqual(30000);
    }, 60000);
});

describe('⛔ អត្តសញ្ញាណ ៖ គណនីហាង Supabase (គ្មាន Activation Key)', () => {
    // ម្ចាស់គម្រោងរាយការណ៍ ៖ ហាង Supabase ចុចបើកការជូនដំណឹង ➜ «ត្រូវការ Activation Key» ខណៈហាង Supabase គ្មាន Key ដោយការរចនា។
    // អត្តសញ្ញាណ = session Supabase ពិត ➜ `my_account()` លើ Project ក្នុង env (ដូច Function ZTO) ➜ កូនសោតាមហាង (tenant) មិនមែនតាមឧបករណ៍
    it('session សកម្ម ➜ ចុះឈ្មោះបាន · ឧបករណ៍ ២ ក្នុងហាងដដែល ➜ index តែមួយ · ហាងផ្សេង ➜ index ផ្សេង', async () => {
        const h = harness({ env: sbEnv() });
        const owner = webSub();
        const staff = webSub();
        const other = webSub();
        expect(await h.service.subscribe({ supabase: SB_OWNER }, owner.sub, 'android')).toMatchObject({ ok: true });
        expect(await h.service.subscribe({ supabase: SB_STAFF }, staff.sub, 'web')).toMatchObject({ ok: true });
        expect(await h.service.subscribe({ supabase: SB_OTHER }, other.sub, 'web')).toMatchObject({ ok: true });
        const idA = supabaseTenantKeyId(TENANT_A);
        const idB = supabaseTenantKeyId(TENANT_B);
        expect(idA).toMatch(/^[0-9A-Z]{16,40}$/);
        expect(idA).not.toBe(idB);
        const indexA = JSON.parse(h.store.data.get('bykey/' + idA)!.value).subs;
        const indexB = JSON.parse(h.store.data.get('bykey/' + idB)!.value).subs;
        expect(indexA).toHaveLength(2);
        expect(indexB).toHaveLength(1);
        const rpc = h.calls.filter((c) => c.url === SB_URL + '/rest/v1/rpc/my_account');
        expect(rpc.length).toBe(3);
        expect(rpc.every((c) => c.init.method === 'POST' && c.init.headers.apikey === SB_KEY)).toBe(true);
        expect(JSON.stringify([...h.store.data.values()])).not.toContain(SB_OWNER);
    });

    it('⛔ ឧបករណ៍ប្តូរហាង ៖ subscription ដដែលចុះឈ្មោះក្រោមហាង B ➜ ចេញពី index ហាង A ➜ ការរំលឹក ៨ ព្រឹករបស់ A លែងមកឧបករណ៍នេះ', async () => {
        const at8 = Date.UTC(2026, 8, 29, PUSH_EXPIRY_HOUR - 7, 2, 0);
        const h = harness({ env: sbEnv() });
        h.clock.now = at8 - 3600e3;
        const device = webSub();
        expect(await h.service.subscribe({ supabase: SB_STAFF }, device.sub, 'web')).toMatchObject({ ok: true });
        expect(await h.service.saveSchedule({ supabase: SB_STAFF }, [at8 + 3600e3])).toMatchObject({ ok: true, count: 1 });
        expect(await h.service.subscribe({ supabase: SB_OTHER }, device.sub, 'web')).toMatchObject({ ok: true });
        expect(JSON.parse(h.store.data.get('bykey/' + supabaseTenantKeyId(TENANT_A))!.value).subs).toEqual([]);
        expect(JSON.parse(h.store.data.get('bykey/' + supabaseTenantKeyId(TENANT_B))!.value).subs).toHaveLength(1);
        h.clock.now = at8;
        const sent: string[] = [];
        h.push = (url) => { sent.push(url); return { status: 201 }; };
        await h.service.dispatchExpiry();
        expect(sent).toEqual([]);
    });

    it('កាលវិភាគ + ការរំលឹកម៉ោង ៨ ៖ តាមហាង · ហាងផ្សេងមិនទទួល', async () => {
        const at8 = Date.UTC(2026, 8, 29, PUSH_EXPIRY_HOUR - 7, 2, 0);
        const h = harness({ env: sbEnv() });
        h.clock.now = at8 - 3600e3;
        const mine = webSub();
        const other = webSub();
        await h.service.subscribe({ supabase: SB_STAFF }, mine.sub);
        await h.service.subscribe({ supabase: SB_OTHER }, other.sub);
        expect(await h.service.saveSchedule({ supabase: SB_OWNER }, [at8 + 3600e3])).toMatchObject({ ok: true, count: 1 });
        h.clock.now = at8;
        const sent: string[] = [];
        h.push = (url) => { sent.push(url); return { status: 201 }; };
        expect(await h.service.dispatchExpiry()).toMatchObject({ sent: 1, keys: 1 });
        expect(sent).toEqual([mine.sub.endpoint]);
    });

    it('ផ្ទៀង ៖ issuer ផ្សេង/ផុត/មិនមែន authenticated ➜ session (មិនហៅ Supabase) · 401 ➜ session · ហាងផុត ➜ inactive · គ្មានហាង ➜ account', async () => {
        const h = harness({ env: sbEnv() });
        const sub = () => webSub().sub;
        expect(await h.service.subscribe({ supabase: sbJwt('x', { iss: 'https://evil.supabase.co/auth/v1' }) }, sub())).toMatchObject({ ok: false, status: 403, reason: 'supabase:session' });
        expect(await h.service.subscribe({ supabase: sbJwt('x', { exp: Math.floor(NOW / 1000) - 10 }) }, sub())).toMatchObject({ reason: 'supabase:session' });
        expect(await h.service.subscribe({ supabase: sbJwt('x', { role: 'anon' }) }, sub())).toMatchObject({ reason: 'supabase:session' });
        expect(await h.service.subscribe({ supabase: 'not-a-jwt' }, sub())).toMatchObject({ reason: 'supabase:session' });
        expect(h.calls.filter((c) => c.url.startsWith(SB_URL)).length).toBe(0);
        expect(await h.service.subscribe({ supabase: sbJwt('forged') }, sub())).toMatchObject({ ok: false, status: 403, reason: 'supabase:session' });
        expect(await h.service.subscribe({ supabase: SB_EXPIRED_SHOP }, sub())).toMatchObject({ ok: false, status: 403, reason: 'supabase:inactive' });
        expect(await h.service.subscribe({ supabase: SB_NO_SHOP }, sub())).toMatchObject({ ok: false, status: 403, reason: 'supabase:account' });
        expect(activeSubscriptionKeys(h.store)).toHaveLength(0);
    });

    it('⛔ «ផ្ទៀងផ្ទាត់មិនបាន» ≠ «ខុស» ៖ Supabase ដាច់ ➜ 503 · env មិនកំណត់ ➜ 503 supabase:unset · Secret key ក្នុង env ➜ មិនប្រើ', async () => {
        const down = harness({ env: sbEnv(), sbDown: true });
        expect(await down.service.subscribe({ supabase: SB_OWNER }, webSub().sub)).toMatchObject({ ok: false, status: 503, reason: 'supabase:unverified' });
        const unset = harness();
        expect(await unset.service.subscribe({ supabase: SB_OWNER }, webSub().sub)).toMatchObject({ ok: false, status: 503, reason: 'supabase:unset' });
        expect(readPushConfig(Object.assign(sbEnv(), { SUPABASE_PUBLISHABLE_KEY: 'sb_secret_' + 'z'.repeat(30) })).supabase).toBeNull();
        expect(readPushConfig(Object.assign(sbEnv(), { SUPABASE_URL: 'http://evil.example.com' })).supabase).toBeNull();
    });

    it('cache ៖ token ដដែលក្នុង ១០ នាទី ➜ ហៅ Supabase ម្តង · Activation Key នៅដើរដូចមុនលើ service ដដែល', async () => {
        const h = harness({ env: sbEnv() });
        await h.service.subscribe({ supabase: SB_OWNER }, webSub().sub);
        await h.service.subscribe({ supabase: SB_OWNER }, webSub().sub);
        expect(h.calls.filter((c) => c.url === SB_URL + '/rest/v1/rpc/my_account').length).toBe(1);
        expect(await h.service.subscribe(GOOD, webSub().sub)).toMatchObject({ ok: true });
        expect(await h.service.subscribe({ license: GOOD }, webSub().sub)).toMatchObject({ ok: true });
    });

    it('HTTP ៖ body `supabase` ➜ អត្តសញ្ញាណហាង · token មិនលេចក្នុងចម្លើយ', async () => {
        const h = harness({ env: sbEnv() });
        const req = (body: string) => new Request('https://zoew.netlify.app/.netlify/functions/push?op=subscribe', { method: 'POST', body, headers: { 'Content-Type': 'text/plain;charset=utf-8' } });
        const ok = await handlePushRequest(req(JSON.stringify({ supabase: SB_OWNER, sub: webSub().sub, platform: 'web' })), h.service);
        expect(ok.status).toBe(200);
        const bad = await handlePushRequest(req(JSON.stringify({ supabase: SB_EXPIRED_SHOP, sub: webSub().sub })), h.service);
        const text = await bad.text();
        expect(bad.status).toBe(403);
        expect(JSON.parse(text)).toMatchObject({ ok: false, reason: 'supabase:inactive' });
        expect(text).not.toContain(SB_EXPIRED_SHOP);
    });
});

describe('HTTP ៖ handlePushRequest', () => {
    function req(method: string, op: string, body?: string) {
        return new Request('https://zoew.netlify.app/.netlify/functions/push?op=' + op, { method, body, headers: body ? { 'Content-Type': 'text/plain;charset=utf-8' } : {} });
    }

    it('OPTIONS/CORS · config បង្ហាញតែ public key · subscribe តាម text/plain · op មិនស្គាល់ ➜ 404', async () => {
        const h = harness();
        const opt = await handlePushRequest(req('OPTIONS', 'subscribe'), h.service);
        expect(opt.status).toBe(204);
        expect(opt.headers.get('Access-Control-Allow-Origin')).toBe('*');
        const cfg = await handlePushRequest(req('GET', 'config'), h.service);
        const cfgText = await cfg.text();
        expect(JSON.parse(cfgText)).toMatchObject({ web: true, fcm: true });
        expect(cfgText).not.toContain(h.service.config.vapid.privateKey);
        expect(cfgText).not.toContain('PRIVATE KEY');
        const sub = await handlePushRequest(req('POST', 'subscribe', JSON.stringify({ license: GOOD, sub: webSub().sub })), h.service);
        expect(sub.status).toBe(200);
        const bad = await handlePushRequest(req('POST', 'subscribe', JSON.stringify({ license: 'x', sub: webSub().sub })), h.service);
        const badText = await bad.text();
        expect(bad.status).toBe(403);
        expect(badText).not.toContain('ZOEKEY');
        expect((await handlePushRequest(req('POST', 'nope', '{}'), h.service)).status).toBe(404);
        expect((await handlePushRequest(req('POST', 'subscribe', 'not json'), h.service)).status).toBe(400);
        expect((await handlePushRequest(req('POST', 'subscribe', 'x'.repeat(70000)), h.service)).status).toBe(413);
    });

    it('kick ៖ រត់ការបញ្ជូន · ដាស់ញឹកពេក ➜ throttle (គ្មានការអាន License បន្ថែម)', async () => {
        const h = harness({ notices: {} });
        const first = await handlePushRequest(req('POST', 'kick'), h.service, () => h.clock.now);
        expect(await first.json()).toMatchObject({ ok: true, reason: 'baseline' });
        const reads = h.calls.length;
        const second = await handlePushRequest(req('POST', 'kick'), h.service, () => h.clock.now + 1000);
        expect(await second.json()).toMatchObject({ reason: 'throttled' });
        expect(h.calls.length).toBe(reads);
    });
});


describe('⛔ ដំណឹង ៖ ព្រំដែនហាង និងការបញ្ឈប់បណ្ដាញពិត', () => {
    const at8 = Date.UTC(2026, 8, 29, PUSH_EXPIRY_HOUR - 7, 2, 0);

    it.each(['firebase', 'supabase'])('index ហាងចាស់នៅសល់ក្រោយប្ដូរហាង %s ➜ ផ្ញើតែការរំលឹកហាងបច្ចុប្បន្ន', async (backend) => {
        const h = harness({ env: sbEnv() });
        const first = backend === 'firebase' ? GOOD : { supabase: SB_STAFF };
        const second = backend === 'firebase' ? OTHER : { supabase: SB_OTHER };
        const oldKey = backend === 'firebase' ? KEY_ID : supabaseTenantKeyId(TENANT_A);
        h.clock.now = at8 - 3600e3;
        const device = webSub();
        expect(await h.service.subscribe(first, device.sub, 'web')).toMatchObject({ ok: true });
        await h.service.saveSchedule(first, [at8 + 3600e3, at8 + 7200e3]);
        const set = h.store.setJSON;
        h.store.setJSON = async (key: string, value: unknown, opts: any = {}) => (
            key === 'bykey/' + oldKey ? { modified: false } : set(key, value, opts)
        );
        expect(await h.service.subscribe(second, device.sub, 'web')).toMatchObject({ ok: true });
        expect((await h.store.getWithMetadata('bykey/' + oldKey))!.data.subs).toHaveLength(1);
        await h.service.saveSchedule(second, [at8 + 3600e3]);
        h.clock.now = at8;
        const messages: any[] = [];
        h.push = (_, init) => { messages.push(decryptWebPush(init.body, device.ua)); return { status: 201 }; };
        const result = await h.service.dispatchExpiry();
        expect(messages.map((message) => message.title)).toEqual(['📦 1 កញ្ចប់ជិតដល់ពេលត្រឡប់ទៅសាខាកណ្តាលវិញ']);
        expect(result).toMatchObject({ sent: 1, skip: 1 });
    });

    it('⛔ អានយឺតមុន claim ហើយ Push ៥ វិ. ➜ អ្នកមិនទាន់បានផ្ញើបន្តនៅ cron បន្ទាប់ មិនបាត់ពី carry', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(NOW);
        const h = harness({ notices: {} });
        Object.defineProperty(h.clock, 'now', { get: () => Date.now(), set: (time: number) => vi.setSystemTime(time) });
        const device = webSub();
        const recipients = Array.from({ length: 32 }, (_, i) => device.sub.endpoint + '/' + i);
        for (const [i, endpoint] of recipients.entries()) {
            await h.store.setJSON('sub/budget' + String(i).padStart(2, '0'), { kind: 'web', endpoint, p256dh: device.ua.p256dh, auth: device.ua.auth, keyId: KEY_ID });
        }
        await h.service.dispatchNotices();
        h.notices = { [noticeId(NOW - 1000)]: { kind: 'notice', title: 'រំលឹក', at: NOW - 1000 } };
        const list = h.store.list;
        let slow = true;
        h.store.list = async (options: any) => {
            if (slow && options.prefix === 'sub/') { slow = false; h.clock.now += 15900; }
            return list(options);
        };
        const sent = new Map<string, number>();
        h.push = (url) => new Promise((resolve) => setTimeout(() => {
            sent.set(url, (sent.get(url) || 0) + 1);
            resolve({ status: 201 });
        }, 5000));
        for (let attempt = 0; attempt < 4; attempt++) {
            const pending = h.service.dispatchNotices();
            await vi.runAllTimersAsync();
            const out = await pending;
            if (out.reason !== 'partial') break;
            h.clock.now += 5 * 60e3;
        }
        expect(recipients.filter((url) => !sent.has(url))).toEqual([]);
        expect([...sent.values()].every((count) => count === 1)).toBe(true);
    });

    it('សំណើ Web Push ជាប់គាំង ➜ abort មុនបើកសំណើបន្ទាប់ ហើយចំនួនសំណើពិតមិនហួសពិដាន', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(NOW);
        const store = makeStore();
        const device = webSub();
        const keys: string[] = [];
        for (let i = 0; i < PUSH_SEND_CONCURRENCY * 2 + 1; i++) {
            const key = 'sub/test' + i;
            keys.push(key);
            await store.setJSON(key, { kind: 'web', endpoint: device.sub.endpoint, p256dh: device.ua.p256dh, auth: device.ua.auth, keyId: KEY_ID });
        }
        let active = 0;
        let peak = 0;
        const signals: AbortSignal[] = [];
        const service = createPushService({ env: vapidEnv(), store, now: () => Date.now(), fetch: (_: string, init: RequestInit) => {
            active++;
            peak = Math.max(peak, active);
            if (init.signal) signals.push(init.signal);
            return new Promise((_, reject) => {
                init.signal?.addEventListener('abort', () => { active--; reject(new DOMException('Aborted', 'AbortError')); }, { once: true });
            });
        } });
        const pending = service.sendToKeys(keys, { title: 'រំលឹក', body: '', tag: 'expiry' }, NOW);
        await vi.advanceTimersByTimeAsync(PUSH_SEND_TIMEOUT_MS * 3 + 1);
        expect(await pending).toMatchObject({ sent: 0, fail: keys.length });
        expect({ peak, active }).toEqual({ peak: PUSH_SEND_CONCURRENCY, active: 0 });
        expect(signals).toHaveLength(keys.length);
        expect(signals.every((signal) => signal.aborted)).toBe(true);
    });

    it.each(['headers', 'body'])('អានអត្តសញ្ញាណជាប់នៅ %s ➜ abort និងឆ្លើយ unverified ទោះ transport មិនបញ្ចប់', async (stage) => {
        vi.useFakeTimers();
        const signals: AbortSignal[] = [];
        const service = createPushService({ env: vapidEnv(), store: makeStore(), now: () => NOW, publicKeys: [signerJwk], fetch: (_: string, init: RequestInit) => {
            if (init.signal) signals.push(init.signal);
            const hanging = new Promise(() => {});
            return stage === 'headers' ? hanging : Promise.resolve({ ok: true, status: 200, text: () => hanging });
        } });
        const pending = service.verifyLicense(GOOD);
        await vi.advanceTimersByTimeAsync(PUSH_READ_TIMEOUT_MS + 1);
        expect(await pending).toMatchObject({ ok: false, status: 503, reason: 'license:unverified' });
        expect(signals).toHaveLength(1);
        expect(signals[0].aborted).toBe(true);
    });
});


it.each([301, 302, 303, 307, 308])('Push ៖ HTTP redirect %s មិនផ្ទៀងអត្តសញ្ញាណតាមគោលដៅថ្មី', async status => {
    let redirected = 0;
    const destination = http.createServer((req, res) => {
        redirected++;
        req.resume(); res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify([{ tenant_id: 'synthetic-tenant', status: 'active' }]));
    });
    await new Promise<void>(resolve => destination.listen(0, '127.0.0.1', resolve));
    const targetPort = (destination.address() as { port: number }).port;
    const source = http.createServer((req, res) => {
        req.resume(); res.writeHead(status, { Location: 'http://127.0.0.1:' + targetPort + '/redirected' }); res.end();
    });
    await new Promise<void>(resolve => source.listen(0, '127.0.0.1', resolve));
    const url = 'http://127.0.0.1:' + (source.address() as { port: number }).port;
    const token = [b64urlEncode(Buffer.from('{}')), b64urlEncode(Buffer.from(JSON.stringify({ iss: url + '/auth/v1', role: 'authenticated', sub: 'synthetic-user', exp: NOW / 1000 + 3600 }))), 'c2ln'].join('.');
    try {
        const service = createPushService({ env: { SUPABASE_URL: url, SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_synthetic' }, store: makeStore(), now: () => NOW });
        expect(await service.verifySupabase(token)).toMatchObject({ ok: false, status: 503, reason: 'supabase:unverified' });
        expect(redirected).toBe(0);
    } finally {
        source.closeAllConnections(); destination.closeAllConnections();
        await Promise.all([new Promise<void>(resolve => source.close(() => resolve())), new Promise<void>(resolve => destination.close(() => resolve()))]);
    }
});
