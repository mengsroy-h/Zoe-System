// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { describe, expect, it } from 'vitest';

const DAY = 86400000;
const T = Date.UTC(2026, 10, 8, 12);
const RECORD = 'zoe_license_activation_ZOE';
const DEVICE = 'SYNTHETICDEVICE1234567890';
const ROOT = process.env.LICENSECLOCK_APP_DIR || resolve(import.meta.dirname, '../..');
const paths = ['ZoeW/public/license-verify.js', 'ZoeKeyGen/license-verify.js'];
function harness(file: string) {
    const time = { wall: T, mono: 1000 };
    class FakeDate extends Date { constructor(...args: any[]) { super(...(args.length ? args : [time.wall]) as [number]); } static now() { return time.wall; } }
    const store = new Map<string, string>();
    const timers = new Map<number, () => void>(); let timerId = 0;
    const ctx: any = { console, Promise, Error, JSON, Object, Array, Number, String, Boolean, Math, Map, Set, RegExp, Uint8Array, TextEncoder, TextDecoder, AbortController, isNaN, isFinite,
        Date: FakeDate, performance: { now: () => time.mono }, navigator: { onLine: true },
        crypto: { getRandomValues: (a: Uint8Array<ArrayBuffer>) => webcrypto.getRandomValues(a), subtle: { importKey: async () => ({}), verify: async () => true } },
        atob: (s: string) => Buffer.from(s, 'base64').toString('binary'), btoa: (s: string) => Buffer.from(s, 'binary').toString('base64'),
        localStorage: { getItem: (k: string) => store.get(k) || null, setItem: (k: string, v: string) => store.set(k, v), removeItem: (k: string) => store.delete(k) },
        setTimeout: (f: () => void) => { timers.set(++timerId, f); return timerId; }, clearTimeout: (id: number) => timers.delete(id),
        fetch: async () => { throw Error('បណ្ដាញក្លែងមិនបានរៀបចំ'); } };
    ctx.ZoeSeatConfig = { legacyProtocolEnabled: true }; ctx.window = ctx; vm.createContext(ctx); vm.runInContext(readFileSync(resolve(ROOT, file), 'utf8'), ctx);
    const payload = { a: 'ZOE', id: 'SYNTHETICKEY', iat: T / 1000, exp: (T + 30 * DAY) / 1000 };
    const key = 'ZOEKEY-' + Buffer.from(JSON.stringify(payload)).toString('base64url') + '.AA';
    const record = { keyString: key, ...payload, activatedAt: T, lastOnlineCheck: T, onlineExp: T + 30 * DAY, seenMax: T, releaseEpoch: 0 };
    store.set(RECORD, JSON.stringify(record)); store.set('zoe_license_device_id', DEVICE);
    const res = (body: any, date: number | null = T): any => ({ ok: true, status: 200, redirected: false, headers: { get: (n: string) => n === 'Date' ? (date === null ? null : new Date(date).toUTCString()) : n === 'Content-Type' ? 'application/json' : null }, json: async () => body });
    function route(opts: { date?: number | null, life?: number, bodyDelay?: number, seatShift?: number, revoked?: boolean, seatDenied?: boolean } = {}) {
        ctx.fetch = async (url: string) => {
            if (url.includes('/license_keys/')) { const r = res({ expiresAt: T + (opts.life ?? 30 * DAY), maxDevices: 1, revoked: !!opts.revoked }, opts.date === undefined ? T : opts.date); if (opts.bodyDelay) { const json = r.json; r.json = async () => { advance(opts.bodyDelay!); return json(); }; } return r; }
            if (url.includes('/license_seats/')) { if (opts.seatShift) time.wall += opts.seatShift; const r = res({ d1: { device: DEVICE, at: T, releaseEpoch: 0 } }); if (opts.seatDenied) { r.ok = false; r.status = 403; } return r; }
            throw Error('បណ្ដាញក្លែងមិនមានផ្លូវនេះ');
        };
    }
    function advance(ms: number) { time.wall += ms; time.mono += ms; }
    return { ctx, api: ctx.ZoeLicense, time, store, record, res, route, advance };
}

describe.each(paths)('License នាឡិកា %s', file => {
    it('ម៉ោងល្អ និងកៅអីត្រឹមត្រូវនៅសកម្ម', async () => { const h = harness(file); h.route(); expect(await h.api.getStatus('ZOE')).toMatchObject({ state: 'active' }); });
    it('នាឡិកាលោតក្រោយ sync ហើយ Date មិនអាចអាន មិនលុប Activation', async () => { const h = harness(file); h.api.setServerTimeOffset(0); h.time.wall += 400 * DAY; h.route({ date: null }); expect((await h.api.getStatus('ZOE')).state).not.toBe('active'); expect(h.store.has(RECORD)).toBe(true); });
    it('នាឡិកាលោតនៅពេលរង់ចាំកៅអី មិនលុប Activation', async () => { const h = harness(file); h.route({ seatShift: 400 * DAY }); expect((await h.api.getStatus('ZOE')).state).not.toBe('active'); expect(h.store.has(RECORD)).toBe(true); });
    it('Date មកជាមួយ body យឺត មិនផ្ដល់ License ដែលផុតកំណត់', async () => { const h = harness(file); h.route({ life: DAY / 24, bodyDelay: 2 * DAY / 24 }); expect((await h.api.getStatus('ZOE')).state).not.toBe('active'); expect(h.store.has(RECORD)).toBe(true); });
    it.each(['both', 'wall'])('nonce ក្រោយផ្អាកមួយថ្ងៃត្រូវបដិសេធ %s', async kind => { const h = harness(file); h.ctx.fetch = async (url: string) => { const r = h.res(null); r.json = async () => { if (kind === 'both') h.advance(DAY); else h.time.wall += DAY; return { nonce: new URL(url).searchParams.get('nonce'), now: T }; }; return r; }; expect(await h.api.syncServerTime()).toBe(false); expect(h.api.getServerTimeOffset()).toBe(null); });
    it('nonce ស្រស់ផ្ទៀងម៉ោងខុសបាន', async () => { const h = harness(file); h.time.wall -= 400 * DAY; h.ctx.fetch = async (url: string) => h.res({ nonce: new URL(url).searchParams.get('nonce'), now: T }, null); expect(await h.api.syncServerTime()).toBe(true); expect(h.api.getServerNow()).toBe(T); });
    it.each([Infinity, -Infinity, NaN, undefined, null, {}, []])('តម្លៃមិនមែនម៉ោងមិនអាច sync %s', value => { const h = harness(file); h.api.setServerTimeOffset(value); expect(h.api.getServerTimeOffset()).toBe(null); });
    it('ក្រៅបណ្ដាញរយៈពេលខ្លីក្នុងវគ្គដែលមានម៉ោងត្រឹមត្រូវនៅសកម្ម', async () => { const h = harness(file); h.api.setServerTimeOffset(0); h.advance(DAY); h.ctx.navigator.onLine = false; expect((await h.api.getStatus('ZOE')).state).toBe('active'); });
    it('ក្រៅបណ្ដាញបួនថ្ងៃមិនសកម្ម ហើយមិនលុប Activation', async () => { const h = harness(file); h.api.setServerTimeOffset(0); h.advance(4 * DAY); h.ctx.navigator.onLine = false; expect((await h.api.getStatus('ZOE')).state).not.toBe('active'); expect(h.store.has(RECORD)).toBe(true); });
    it('បង្វិលនាឡិកាថយក្រោយមិនពន្យារការអនុគ្រោះ', async () => { const h = harness(file); h.api.setServerTimeOffset(0); h.time.wall -= 7 * DAY; h.advance(4 * DAY); h.ctx.navigator.onLine = false; expect((await h.api.getStatus('ZOE')).state).not.toBe('active'); expect(h.store.has(RECORD)).toBe(true); });
    it('បើកវគ្គថ្មីក្រៅបណ្ដាញមិនទុកចិត្តនាឡិកាឧបករណ៍ តែរក្សា Activation', async () => { const h = harness(file); h.ctx.navigator.onLine = false; expect((await h.api.getStatus('ZOE')).state).not.toBe('active'); expect(h.store.has(RECORD)).toBe(true); });
    it('បដិសេធពិតពី Server នៅតែលុប Activation', async () => { const h = harness(file); h.route({ revoked: true, date: null }); expect(await h.api.getStatus('ZOE')).toMatchObject({ state: 'required', reason: 'revoked' }); expect(h.store.has(RECORD)).toBe(false); });
    it('ម៉ោងស្រស់ពី Server អាចផ្ទៀងការផុតកំណត់', async () => { const h = harness(file); h.route({ life: -DAY }); expect((await h.api.getStatus('ZOE')).state).toBe('required'); expect(h.store.has(RECORD)).toBe(false); });
    it('Date ស្រស់អាចសង្គ្រោះនាឡិកាដែលលោត', async () => { const h = harness(file); h.api.setServerTimeOffset(0); h.time.wall += 400 * DAY; h.route(); expect((await h.api.getStatus('ZOE')).state).toBe('active'); expect(h.api.getServerNow()).toBe(T); });
    it('ភាពមិនច្បាស់ជិតពេលផុតកំណត់មិនផ្ដល់សិទ្ធិ និងមិនលុប', async () => { const h = harness(file); h.route({ life: 500 }); expect((await h.api.getStatus('ZOE')).state).not.toBe('active'); expect(h.store.has(RECORD)).toBe(true); });
    it('ម៉ោង monotonic មិនមាន ឬខូច មិនអាចបង្កើតទំនុកចិត្ត', () => { const h = harness(file); h.ctx.performance.now = () => NaN; h.api.setServerTimeOffset(0); expect(h.api.getServerTimeOffset()).toBe(null); delete h.ctx.performance; h.api.setServerTimeOffset(0); expect(h.api.getServerTimeOffset()).toBe(null); });
    it('ជំនាន់ចាស់បាត់សិទ្ធិបន្ទាប់ពីនាឡិកាខូច ទោះ sync ថ្មីបាន', () => { const h = harness(file); h.api.setServerTimeOffset(0); const before = h.api.getServerTimeGeneration(); h.time.wall += DAY; expect(h.api.getTrustedServerNow()).toBe(null); h.api.setServerTimeOffset(-DAY); expect(h.api.getTrustedServerNow()).toBe(T); expect(h.api.getServerTimeGeneration()).not.toBe(before); });
    it('sample ថ្មីធម្មតាមិនប្ដូរជំនាន់ប្រតិបត្តិការ', () => { const h = harness(file); h.api.setServerTimeOffset(0); const before = h.api.getServerTimeGeneration(); h.advance(1000); h.api.setServerTimeOffset(0); expect(h.api.getServerTimeGeneration()).toBe(before); expect(h.api.getTrustedServerNow()).toBe(T + 1000); });
    it.each(['reset', 'sample'])('nonce ចាស់មិនអាចស្ដារទំនុកចិត្តក្រោយ %s', async action => { const h = harness(file); let resolveReply!: (reply: any) => void; let requestNonce = ''; h.ctx.fetch = (url: string) => { requestNonce = new URL(url).searchParams.get('nonce')!; return new Promise(r => { resolveReply = r; }); }; const pending = h.api.syncServerTime(); if (action === 'reset') h.api.resetServerTime(); else h.api.setServerTimeOffset(60000); resolveReply(h.res({ nonce: requestNonce, now: T })); expect(await pending).toBe(false); expect(h.api.getTrustedServerNow()).toBe(action === 'reset' ? null : T + 60000); });
    it('sync ដំណាលគ្នាចែករំលែកការអាន និងលទ្ធផល', async () => { const h = harness(file); let calls = 0; h.ctx.fetch = async (url: string) => { calls++; return h.res({ nonce: new URL(url).searchParams.get('nonce'), now: T }); }; expect(await Promise.all([h.api.syncServerTime(), h.api.syncServerTime()])).toEqual([true, true]); expect(calls).toBe(1); });
    it('sample បង្ហាញប្រភព និងមិនអាចកែបាន', async () => { const h = harness(file); h.ctx.fetch = async (url: string) => h.res({ nonce: new URL(url).searchParams.get('nonce'), now: T }); expect(await h.api.syncServerTime()).toBe(true); const sample = h.api.getServerTimeSample(); expect(sample).toMatchObject({ epochMs: T, wallMs: T, monotonicMs: 1000, uncertaintyMs: 0, source: 'nonce' }); expect(Object.isFrozen(sample)).toBe(true); expect(h.api.getServerTimeSample()).toBe(sample); h.api.resetServerTime(); expect(h.api.getServerTimeSample()).toBe(null); });
    it('ហត្ថលេខាពិតយកម៉ោងដែលប្រតិបត្តិការចាប់ទុក ទោះនាឡិកាលោត', async () => { const h = harness(file); h.ctx.crypto.subtle = webcrypto.subtle; const pair = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']); const jwk = await webcrypto.subtle.exportKey('jwk', pair.privateKey); h.time.wall += 400 * DAY; const signed = await h.api.signNewKey(jwk, { appCode: 'ZOE', days: 30, issuedAt: T }); expect(signed.payload.iat * 1000).toBe(T); expect(signed.payload.exp * 1000).toBe(T + 30 * DAY); const parsed = h.api.parseKeyString(signed.keyString); expect(await webcrypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pair.publicKey, parsed.sigBytes, new TextEncoder().encode(parsed.payloadB64))).toBe(true); });
    it('ភាពខុសគ្នាតូចរវាងនាឡិកាមិនអាចលុប License នៅរស់', async () => { const h = harness(file); h.route({ life: 750 }); const fetch = h.ctx.fetch; h.ctx.fetch = async (url: string) => { const r = await fetch(url); if (url.includes('/license_keys/')) { const json = r.json; r.json = async () => { h.advance(1000); h.time.wall -= 500; return json(); }; } return r; }; expect((await h.api.getStatus('ZOE')).state).not.toBe('active'); expect(h.store.has(RECORD)).toBe(true); });
    it('ការកែម៉ោង Server ធំធ្វើឲ្យជំនាន់ប្រតិបត្តិការចាស់អស់សិទ្ធិ', () => { const h = harness(file); h.api.setServerTimeOffset(0); const before = h.api.getServerTimeGeneration(); h.api.setServerTimeOffset(DAY); expect(h.api.getTrustedServerNow()).toBe(T + DAY); expect(h.api.getServerTimeGeneration()).not.toBe(before); });
    it('អានកៅអីបរាជ័យ មិនអាចរំកិលពេលអនុគ្រោះ', async () => { const h = harness(file); h.api.setServerTimeOffset(0); h.advance(DAY); h.route({ date: T + DAY, seatDenied: true }); await h.api.getStatus('ZOE'); expect(JSON.parse(h.store.get(RECORD)!).lastOnlineCheck).toBe(T); });
    it('sample Supabase រក្សា receipt ដើម និងភាពមិនច្បាស់', () => {
        const h = harness(file);
        const sample = Object.freeze({ epochMs: T, uncertaintyMs: 9000, monotonicMs: 1000, wallMs: T, source: 'supabase-rpc' });
        h.advance(1000);
        expect(h.api.setServerTimeSample(sample)).toBe(true);
        const saved = h.api.getServerTimeSample();
        expect(saved).toMatchObject({ epochMs: T, uncertaintyMs: 9000, monotonicMs: 1000, wallMs: T, source: 'supabase-rpc' });
        expect(h.api.getTrustedServerNow()).toBe(T + 1000);
        expect(h.api.setServerTimeSample(sample)).toBe(true);
        expect(h.api.getServerTimeSample()).toBe(saved);
        h.api.resetServerTime();
        expect(h.api.setServerTimeSample(sample)).toBe(false);
        expect(h.api.getTrustedServerNow()).toBe(null);
    });
    it('sample Supabase ចាស់មិនបង្កើត trust ក្រោយការផ្អាក', () => {
        const h = harness(file);
        const sample = Object.freeze({ epochMs: T, uncertaintyMs: 500, monotonicMs: 1000, wallMs: T, source: 'supabase-rpc' });
        h.time.wall += DAY;
        expect(h.api.setServerTimeSample(sample)).toBe(false);
        expect(h.api.getTrustedServerNow()).toBe(null);
    });
    it.each([null, {}, [], Object.freeze({}), Object.freeze({ epochMs: T, uncertaintyMs: NaN, monotonicMs: 1000, wallMs: T, source: 'supabase-rpc' }), Object.freeze({ epochMs: T, uncertaintyMs: -1, monotonicMs: 1000, wallMs: T, source: 'supabase-rpc' })])('metadata Supabase មិនត្រឹមត្រូវមិនបើក trust %s', sample => {
        const h = harness(file);
        expect(h.api.setServerTimeSample(sample)).toBe(false);
        expect(h.api.getTrustedServerNow()).toBe(null);
    });
    it('sample Supabase ចាស់ជាង receipt ថ្មី មិនជំនួស anchor', () => {
        const h = harness(file);
        const old = Object.freeze({ epochMs: T, uncertaintyMs: 9000, monotonicMs: 1000, wallMs: T, source: 'supabase-rpc' });
        h.advance(1000);
        const fresh = Object.freeze({ epochMs: T + 1000, uncertaintyMs: 0, monotonicMs: 2000, wallMs: T + 1000, source: 'supabase-rpc' });
        expect(h.api.setServerTimeSample(fresh)).toBe(true);
        expect(h.api.setServerTimeSample(old)).toBe(false);
        expect(h.api.getTrustedServerNow()).toBe(T + 1000);
    });
    it('sample Supabase ថ្មីដែល interval ត្រួតគ្នា មិនបោះបង់ lease', () => {
        const h = harness(file);
        expect(h.api.setServerTimeSample(Object.freeze({ epochMs: T, uncertaintyMs: 9000, monotonicMs: 1000, wallMs: T, source: 'supabase-rpc' }))).toBe(true);
        const generation = h.api.getServerTimeGeneration();
        h.advance(1000);
        expect(h.api.setServerTimeSample(Object.freeze({ epochMs: T + 10000, uncertaintyMs: 0, monotonicMs: 2000, wallMs: T + 1000, source: 'supabase-rpc' }))).toBe(true);
        expect(h.api.getServerTimeGeneration()).toBe(generation);
    });

});
