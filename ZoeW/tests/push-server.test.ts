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
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
    FCM_CHANNEL_ID as SERVER_FCM_CHANNEL, LICENSE_APP_CODE, LICENSE_DB_URL_DEFAULT, LICENSE_KEY_PREFIX, LICENSE_PUBLIC_KEYS_JWK,
    PUSH_EXPIRY_HOUR, PUSH_NOTICE_MAX_AGE_MS, PUSH_OPEN_URL, PUSH_SCHEDULE_MAX_AGE_MS, PUSH_SUBS_PER_KEY_MAX,
    b64urlDecode, b64urlEncode, createPushService, encryptWebPushPayload, handlePushRequest, readPushConfig,
    resetPushStateForTests, runPushCron, vapidAuthorization, webPushEndpointAllowed
} from '../netlify/lib/push-core.mjs';
import { LICENSE_APP_CODE as CLIENT_APP_CODE } from '../src/features/license';
import { FCM_CHANNEL_ID as CLIENT_FCM_CHANNEL, PUSH_OPEN_PARAM } from '../src/features/push';

const LICENSE_SRC = readFileSync(path.resolve(__dirname, '..', 'public', 'license-verify.js'), 'utf8');
const ANDROID_MANIFEST = readFileSync(path.resolve(__dirname, '..', 'android', 'app', 'src', 'main', 'AndroidManifest.xml'), 'utf8');

function makeStore() {
    const data = new Map<string, { value: string; etag: string }>();
    let seq = 0;
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
            const etag = '"e' + (++seq) + '"';
            data.set(key, { value: JSON.stringify(value), etag });
            return { modified: true, etag };
        },
        async delete(key: string) { data.delete(key); },
        async list(opts: any = {}) {
            const prefix = opts.prefix || '';
            return { blobs: [...data.keys()].filter((k) => k.startsWith(prefix)).map((k) => ({ key: k, etag: data.get(k)!.etag })), directories: [] };
        }
    };
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
    push: (url: string, init: any) => { status: number; body?: any };
}

function harness(opts: { env?: any; notices?: Record<string, any> | null; dbDown?: boolean } = {}): Harness {
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
        const r = h.push(url, init);
        return reply(r.status, r.body);
    };
    h.service = createPushService({
        env: opts.env || Object.assign(vapidEnv(), { FCM_SERVICE_ACCOUNT: JSON.stringify(FCM_SA) }),
        store, fetch, now: () => clock.now, publicKeys: [signerJwk]
    });
    return h;
}

function webSub(host = 'fcm.googleapis.com') {
    const ua = uaKeys();
    return { ua, sub: { kind: 'web', endpoint: 'https://' + host + '/fcm/send/' + crypto.randomBytes(8).toString('hex'), keys: { p256dh: ua.p256dh, auth: ua.auth } } };
}

function noticeId(at: number) {
    return 'n' + String(at) + 'abcdef';
}

beforeEach(() => resetPushStateForTests());
afterEach(() => resetPushStateForTests());

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
    it('subscribe ៖ រក្សាទុក · ចងនឹង Key · ចុះម្តងទៀតមិនស្ទួន · ពិដានក្នុងមួយ Key ➜ ទម្លាក់ចាស់ជាងគេ', async () => {
        const h = harness();
        const first = webSub();
        expect(await h.service.subscribe(GOOD, first.sub, 'web')).toMatchObject({ ok: true });
        expect(await h.service.subscribe(GOOD, first.sub, 'web')).toMatchObject({ ok: true });
        const subs = () => [...h.store.data.keys()].filter((k) => k.startsWith('sub/'));
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

    it('unsubscribe ៖ លុបទាំង sub និង index', async () => {
        const h = harness();
        const s = webSub();
        await h.service.subscribe(GOOD, s.sub);
        await h.service.unsubscribe(s.sub);
        expect([...h.store.data.keys()].filter((k) => k.startsWith('sub/'))).toHaveLength(0);
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
        const keys = [...h.store.data.keys()].filter((k) => k.startsWith('sub/'));
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
        const assertion = decodeURIComponent(oauth.init.body).split('assertion=')[1];
        const [hh, pp, ss] = assertion.split('.');
        expect(crypto.verify('RSA-SHA256', Buffer.from(hh + '.' + pp), fcmKey.publicKey, b64urlDecode(ss)!)).toBe(true);
        expect(bodies[0].message.android.notification.channel_id).toBe(CLIENT_FCM_CHANNEL);
        expect(bodies[0].message.notification.title).toBe('📢 សួស្តី');
        expect(bodies[0].message.data.url).toBe(PUSH_OPEN_URL);
        expect([...h.store.data.keys()].filter((k) => k.startsWith('sub/'))).toHaveLength(1);
    });
});

describe('ការរំលឹកកញ្ចប់ជិតផុតកំណត់ (ម៉ោង ៨ ព្រឹក Asia/Phnom_Penh)', () => {
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
        expect(msg.title).toBe('📦 2 កញ្ចប់ជិតផុតកំណត់');
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

    it('ដំណាក់ ២ (ដំណឹង ➜ រំលឹក) ចែកពិដានតែមួយ ៖ ការផ្ញើយឺត ➜ ការរត់ទាំងមូលនៅក្នុង ៣០ វិ. (មិនត្រូវសម្លាប់ក្រោយ ledger ចាក់សោរួច)', async () => {
        const h = harness({ notices: {} });
        h.clock.now = at8 - 3600e3;
        for (let i = 0; i < 4; i++) await h.service.subscribe(GOOD, webSub().sub);
        await h.service.saveSchedule(GOOD, [at8 + 3600e3]);
        h.clock.now = at8;
        await h.service.dispatchNotices();
        h.notices = { [noticeId(at8)]: { kind: 'notice', title: 'ថ្មី', at: at8 } };
        h.push = () => { h.clock.now += 7000; return { status: 201 }; };
        const t0 = h.clock.now;
        const out = await runPushCron(h.service, () => h.clock.now);
        expect(out.notices).toMatchObject({ reason: 'sent' });
        expect(h.clock.now - t0).toBeLessThanOrEqual(NETLIFY_SCHEDULED_LIMIT_MS);
        expect(await h.store.getWithMetadata('state/expiry/' + KEY_ID)).toBeNull();
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
