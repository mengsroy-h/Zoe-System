import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSeatStageService } from '../../../ZoeW/netlify/lib/license-seat-stage.mjs';

const source = readFileSync(resolve(__dirname, '../../../ZoeKeyGen/app.js'), 'utf8');
const begin = source.indexOf('function seatSellerContext()');
const end = source.indexOf('async function toggleRevokeKey(', begin);
if (begin < 0 || end < 0) throw new Error('រកមិនឃើញកូដគ្រប់គ្រងសោ');
async function harness() {
    const pair = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    const privateKey = await webcrypto.subtle.exportKey('jwk', pair.privateKey);
    const state = { schema: 1, revision: 1, releaseEpoch: 0, mode: 'active', seats: { d1: {} }, maxDevices: 1, licenseExpiresAt: 5000000, revoked: false };
    let current = true;
    let row: Record<string, unknown> | null = { seatProtocol: 2, maxDevices: 1, expiresAt: 5000000, revoked: false };
    let cached: Record<string, unknown> | null = null;
    let autoEmit = true;
    let listener: ((snapshot: any) => void) | null = null;
    let cancel: ((error: Error) => void) | null = null;
    const snapshot = (value: unknown) => ({ val: () => structuredClone(value) });
    const emit = (value = row) => { cached = structuredClone(value); listener?.(snapshot(cached)); };
    const unsubscribe = vi.fn(() => { listener = null; cancel = null; cached = null; });
    const commands: any[] = [];
    const ctx: any = {
        TextEncoder, TextDecoder, Uint8Array, crypto: webcrypto, btoa, atob, setTimeout, clearTimeout,
        signingPrivateKeyJwk: privateKey, db: {},
        captureSensitiveSession: () => ({}), adminOperationIsCurrent: () => current, isSensitiveSessionCurrent: () => current,
        captureKeygenClock: () => ({ now: 1000000, generation: 1 }), keygenClockIsCurrent: () => true, getTrustedServerNow: () => 1000000,
        databaseUrlOf: () => 'https://example.firebaseio.com', isFirebaseDatabaseHost: () => true,
        confirm: vi.fn(() => true), prompt: vi.fn(() => null), alert: vi.fn(), showToast: vi.fn(), refreshKeyList: vi.fn(), closeModal: vi.fn(),
        fb: { runTransaction: vi.fn(), ref: vi.fn((_db: unknown, path: string) => path),
            onValue: vi.fn((_ref: unknown, callback: (snapshot: any) => void, onCancel: (error: Error) => void) => {
                listener = callback; cancel = onCancel;
                queueMicrotask(() => { if (listener && autoEmit) emit(); });
                return unsubscribe;
            }) },
        fetchWithTimeout: vi.fn(async (url: string, options: any) => {
            if (url.includes('firebaseio')) return { body: row, res: { ok: true } };
            const envelope = JSON.parse(options.body);
            const command = JSON.parse(Buffer.from(envelope.payload, 'base64url').toString());
            commands.push({ command, envelope });
            if (command.action === 'cutover') state.mode = 'active';
            if (command.action === 'configure') Object.assign(state, { maxDevices: command.maxDevices, licenseExpiresAt: command.licenseExpiresAt, revoked: command.revoked });
            return { res: { ok: true }, body: command.action === 'inspect' ? { state: { ...state }, receiptKeyFingerprint: ctx.receiptKeyFingerprint } : { revision: ++state.revision } };
        }),
        receiptKeyFingerprint: 'a'.repeat(64),
        window: { ZoeSeatConfig: { receiptPublicKeys: [] } }
    };
    ctx.fb.runTransaction.mockImplementation(async (_ref: unknown, update: any) => {
        let next = update(structuredClone(cached));
        if (next === undefined) return { committed: false, snapshot: snapshot(cached) };
        if (JSON.stringify(cached) !== JSON.stringify(row)) next = update(structuredClone(row));
        if (next !== undefined) { row = structuredClone(next); if (listener) emit(); }
        return { committed: next !== undefined, snapshot: snapshot(row) };
    });
    vm.createContext(ctx);
    vm.runInContext(source.slice(source.indexOf('function withTimeout('), source.indexOf('function retryAsync(')) + source.slice(begin, end), ctx);
    return { ctx, commands, state, pair, unsubscribe, snapshot, emit,
        setAutoEmit: (value: boolean) => { autoEmit = value; },
        listenerActive: () => listener !== null, cancelListener: (error: Error) => cancel?.(error),
        row: () => structuredClone(row),
        setCurrent: (value: boolean) => { current = value; },
        setRow: (value: Record<string, unknown> | null, notify = true) => { row = value; if (notify && listener) emit(); } };

}

describe('ការគ្រប់គ្រងឧបករណ៍សុវត្ថិភាពដោយអ្នកលក់', () => {
    it('ចុះហត្ថលេខាលើសំណើពិតដោយវិសាលភាពថេរ និងម៉ោង Server', async () => {
        const h = await harness();
        await h.ctx.seatSellerCommand(h.ctx.seatSellerContext(), 'ABCDEFGHIJKLMNOP', 'inspect', 0, { audience: 'bad', app: 'BAD' });
        const { command, envelope } = h.commands[0];
        expect(command).toMatchObject({ audience: 'https://zoew.netlify.app', app: 'ZOE', expiresAt: 1045000, revision: 0 });
        expect(await webcrypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, h.pair.publicKey, Buffer.from(envelope.signature, 'base64url'), Buffer.from(envelope.payload))).toBe(true);
    });
    it('បដិសេធពេលគ្មានម៉ោងដែលបានផ្ទៀងផ្ទាត់', async () => {
        const h = await harness(); h.ctx.captureKeygenClock = () => null;
        await expect(h.ctx.seatSellerCommand(h.ctx.seatSellerContext(), 'ABCDEFGHIJKLMNOP', 'inspect', 0)).rejects.toThrow();
        expect(h.commands).toHaveLength(0);
    });
    it('ឈប់មុនផ្ញើបើសម័យផ្លាស់ប្ដូរក្រោយ import សោ', async () => {
        const h = await harness();
        h.ctx.crypto = { subtle: { importKey: async (...args: Parameters<typeof webcrypto.subtle.importKey>) => { const key = await (webcrypto.subtle.importKey as any)(...args); h.setCurrent(false); return key; } } };
        await expect(h.ctx.seatSellerCommand(h.ctx.seatSellerContext(), 'ABCDEFGHIJKLMNOP', 'inspect', 0)).rejects.toThrow();
        expect(h.commands).toHaveLength(0);
    });
    it('មិនសរសេរពេលបោះបង់ និងមិនបញ្ជូនទៅការកែ RTDB', async () => {
        const h = await harness(); h.ctx.confirm.mockReturnValue(false);
        expect(await h.ctx.routeSecureSeatLifecycle('ABCDEFGHIJKLMNOP', 'revoke')).toBe(true);
        expect(h.commands.map(x => x.command.action)).toEqual(['inspect']);
        expect(h.ctx.fb.runTransaction).not.toHaveBeenCalled();
    });
    it('marker 2 ប្រើតែ configure ដែលមានហត្ថលេខា', async () => {
        const h = await harness();
        expect(await h.ctx.routeSecureSeatLifecycle('ABCDEFGHIJKLMNOP', 'revoke')).toBe(true);
        expect(h.commands.map(x => x.command.action)).toEqual(['inspect', 'configure', 'inspect']);
        expect(h.commands[1].command.revoked).toBe(true);
        expect(h.ctx.fb.runTransaction).not.toHaveBeenCalled();
    });
    it('រក្សាផ្លូវចាស់តែពេលអាន marker បច្ចុប្បន្នបាន', async () => {
        const h = await harness(); h.setRow({ maxDevices: 1 });
        expect(await h.ctx.routeSecureSeatLifecycle('ABCDEFGHIJKLMNOP', 'release')).toBe(false);
        h.ctx.fetchWithTimeout.mockRejectedValue(new Error('offline'));
        expect(await h.ctx.routeSecureSeatLifecycle('ABCDEFGHIJKLMNOP', 'release')).toBe(true);
        expect(h.commands).toHaveLength(0);
    });
    it('មិនសាកផ្ញើការកែឡើងវិញពេលបាត់ចម្លើយ', async () => {
        const h = await harness(); const fetch = h.ctx.fetchWithTimeout;
        h.ctx.fetchWithTimeout = async (...args: any[]) => {
            const out = await fetch(...args);
            if (h.commands.at(-1)?.command.action === 'configure') throw new Error('lost reply');
            return out;
        };
        await h.ctx.routeSecureSeatLifecycle('ABCDEFGHIJKLMNOP', 'revoke');
        expect(h.commands.map(x => x.command.action)).toEqual(['inspect', 'configure']);
        expect(h.ctx.showToast).not.toHaveBeenCalled();
        expect(h.ctx.alert).toHaveBeenCalledOnce();
    });
    it('មិនប្ដូរស្វ័យប្រវត្តិ និងរារាំងការប្ដូរពេលសោ receipt មិនបានកំណត់', async () => {
        const h = await harness(); h.ctx.prompt.mockReturnValue('4');
        await h.ctx.manageSecureSeats('ABCDEFGHIJKLMNOP');
        expect(h.commands.map(x => x.command.action)).toEqual(['inspect']);
        expect(h.ctx.fb.runTransaction).not.toHaveBeenCalled();
    });
    it('ការត្រួតពិនិត្យ legacy បដិសេធ marker ដែលទើបប្ដូរ', async () => {
        const h = await harness();
        await expect(h.ctx.requireLegacySeat(h.ctx.seatSellerContext(), 'ABCDEFGHIJKLMNOP')).rejects.toThrow('seat-authority-changed');
    });
    it('ប្ដូរ marker តែក្រោយបញ្ជាក់លើកទីពីរ និងអានសកម្មឡើងវិញ', async () => {
        const h = await harness();
        h.state.mode = 'staged'; h.setRow({ maxDevices: 1, expiresAt: 5000000, revoked: false });
        const pub = await webcrypto.subtle.exportKey('jwk', h.pair.publicKey);
        const canonical = { kty: pub.kty, crv: pub.crv, x: pub.x, y: pub.y };
        h.ctx.window.ZoeSeatConfig.receiptPublicKeys = [canonical];
        h.ctx.receiptKeyFingerprint = Buffer.from(await webcrypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(canonical)))).toString('hex');
        h.ctx.prompt.mockReturnValue('4');
        await h.ctx.manageSecureSeats('ABCDEFGHIJKLMNOP');
        expect(h.ctx.confirm).toHaveBeenCalledTimes(2);
        expect(h.commands.map(x => x.command.action)).toEqual(['inspect', 'cutover', 'inspect', 'inspect']);
        expect(h.ctx.fb.runTransaction).toHaveBeenCalledOnce();
        expect((await h.ctx.seatSellerRow(h.ctx.seatSellerContext(), 'ABCDEFGHIJKLMNOP')).seatProtocol).toBe(2);
    });
    it('បោះបង់លើកទីពីរមិនប្ដូរ marker ទោះ Server សកម្ម', async () => {
        const h = await harness();
        h.state.mode = 'staged'; h.setRow({ maxDevices: 1, expiresAt: 5000000, revoked: false });
        const pub = await webcrypto.subtle.exportKey('jwk', h.pair.publicKey);
        const canonical = { kty: pub.kty, crv: pub.crv, x: pub.x, y: pub.y };
        h.ctx.window.ZoeSeatConfig.receiptPublicKeys = [canonical];
        h.ctx.receiptKeyFingerprint = Buffer.from(await webcrypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(canonical)))).toString('hex');
        h.ctx.prompt.mockReturnValue('4'); h.ctx.confirm.mockReturnValueOnce(true).mockReturnValueOnce(false);
        await h.ctx.manageSecureSeats('ABCDEFGHIJKLMNOP');
        expect(h.commands.map(x => x.command.action)).toEqual(['inspect', 'cutover', 'inspect']);
        expect(h.ctx.fb.runTransaction).not.toHaveBeenCalled();
    });

    it('មិនប្រកាសដោះជោគជ័យពី inspect ដែលមិនបញ្ជាក់ការដោះ', async () => {
        const h = await harness(); h.ctx.prompt.mockReturnValue('3');
        await h.ctx.manageSecureSeats('ABCDEFGHIJKLMNOP');
        expect(h.commands.map(x => x.command.action)).toEqual(['inspect', 'release', 'inspect']);
        expect(h.ctx.showToast).not.toHaveBeenCalled();
        expect(h.ctx.alert).toHaveBeenCalledOnce();
    });
    it('តារាង marker 2 មិនបង្ហាញសុពលភាព និងចំនួនឧបករណ៍ចាស់', async () => {
        const h = await harness(); const body = { innerHTML: '' };
        Object.assign(h.ctx, { document: { getElementById: () => body }, getServerNow: () => 1000000,
            keyListCache: [{ id: 'ABCDEFGHIJKLMNOP', paths: ['ZOE'], perApp: { ZOE: { seatProtocol: 2 } }, scope: 'ZOE', expiresAt: 5000000, maxDevices: 5, seatDevices: [], revoked: false }],
            APP_LABELS: { ZOE: 'ZOE' }, escapeHtml: String, seatReadFailed: false });
        const renderer = source.slice(source.indexOf('function renderKeyList()'), begin);
        vm.runInContext(renderer, h.ctx); h.ctx.renderKeyList();
        expect(body.innerHTML).toContain('ពិនិត្យពី Server សុវត្ថិភាព');
        expect(body.innerHTML).not.toContain('badge-active');
        expect(body.innerHTML).not.toContain('0/5');
    });

});

async function renewalHarness(expiresAt = 999999) {
    const h = await harness();
    let saved = { ...h.state, seats: {}, licenseExpiresAt: expiresAt };
    const store = {
        getWithMetadata: async () => ({ data: structuredClone(saved), etag: String(saved.revision) }),
        setJSON: vi.fn(async (_path: string, next: typeof saved, options: any) => {
            if (options.onlyIfMatch !== String(saved.revision)) return { modified: false };
            saved = structuredClone(next);
            return { modified: true };
        })
    };
    const service = createSeatStageService({ store, enabled: true, now: () => 1000000,
        publicKeys: [await webcrypto.subtle.exportKey('jwk', h.pair.publicKey)] });
    h.ctx.captureKeygenClock = () => ({ now: 1000000.75, generation: 1 });
    h.ctx.getTrustedServerNow = () => 1000000.75;
    h.ctx.fetchWithTimeout.mockImplementation(async (url: string, options: any) => {
        if (url.includes('firebaseio')) return { body: { seatProtocol: 2 }, res: { ok: true } };
        const envelope = JSON.parse(options.body);
        const command = JSON.parse(Buffer.from(envelope.payload, 'base64url').toString());
        const result = await service.execute(envelope);
        h.commands.push({ command, envelope, result });
        return { res: { ok: result.status === 200 }, body: result.body };
    });
    return { ...h, store, saved: () => saved };
}

describe('បន្តសុពលភាពសុវត្ថិភាពជាមួយការផ្ទៀងផ្ទាត់ Server ពិត', () => {
    it.each([999999, 1000000, 5000000])('ម៉ោងទសភាគ និងថ្ងៃផុត %s រក្សាចំនួនគត់', async expiresAt => {
        const h = await renewalHarness(expiresAt);
        await h.ctx.routeSecureSeatLifecycle('ABCDEFGHIJKLMNOP', 'extend', 1.5);
        expect(h.commands.map(x => x.command.action)).toEqual(['inspect', 'configure', 'inspect']);
        expect(h.commands.map(x => x.result.status)).toEqual([200, 200, 200]);
        expect(h.saved().licenseExpiresAt).toBe(Math.max(1000000, expiresAt) + 129600000);
        expect(Number.isSafeInteger(h.commands[1].command.licenseExpiresAt)).toBe(true);
        expect(h.store.setJSON).toHaveBeenCalledOnce();
        expect(h.ctx.showToast).toHaveBeenCalledOnce();
        expect(h.ctx.closeModal).toHaveBeenCalledWith('extendModal');
        expect(h.ctx.alert).not.toHaveBeenCalled();
        expect(h.ctx.fb.runTransaction).not.toHaveBeenCalled();
    });
    it.each([undefined, null, NaN, Infinity, 0, -1, '1', {}, []])('ចំនួនថ្ងៃមិនត្រឹមត្រូវ %s មិនកែ Server', async days => {
        const h = await renewalHarness();
        await h.ctx.routeSecureSeatLifecycle('ABCDEFGHIJKLMNOP', 'extend', days);
        expect(h.commands.map(x => x.command.action)).toEqual(['inspect']);
        expect(h.store.setJSON).not.toHaveBeenCalled();
        expect(h.ctx.showToast).not.toHaveBeenCalled();
        expect(h.ctx.alert).toHaveBeenCalledOnce();
    });
    it('គ្មានម៉ោងទុកចិត្ត មិនកែ Server', async () => {
        const h = await renewalHarness(); h.ctx.getTrustedServerNow = () => null;
        await h.ctx.routeSecureSeatLifecycle('ABCDEFGHIJKLMNOP', 'extend', 1);
        expect(h.store.setJSON).not.toHaveBeenCalled();
        expect(h.ctx.showToast).not.toHaveBeenCalled();
        expect(h.ctx.alert).toHaveBeenCalledOnce();
    });
    it('លទ្ធផលលើសចំនួនគត់សុវត្ថិភាព នៅតែត្រូវ Server បដិសេធ', async () => {
        const h = await renewalHarness();
        await h.ctx.routeSecureSeatLifecycle('ABCDEFGHIJKLMNOP', 'extend', Number.MAX_VALUE);
        expect(h.commands.at(-1).result).toMatchObject({ status: 400, body: { reason: 'config-invalid' } });
        expect(h.store.setJSON).not.toHaveBeenCalled();
        expect(h.ctx.showToast).not.toHaveBeenCalled();
        expect(h.ctx.alert).toHaveBeenCalledOnce();
    });
    it('Server នៅតែបដិសេធសំណើថ្ងៃផុតទសភាគដែលចុះហត្ថលេខា', async () => {
        const h = await renewalHarness();
        await expect(h.ctx.seatSellerCommand(h.ctx.seatSellerContext(), 'ABCDEFGHIJKLMNOP', 'configure', 1,
            { maxDevices: 1, licenseExpiresAt: 1000000.75 + 86400000, revoked: false })).rejects.toThrow('seat-outcome-unverified');
        expect(h.commands[0].result).toMatchObject({ status: 400, body: { reason: 'config-invalid' } });
        expect(h.store.setJSON).not.toHaveBeenCalled();
    });
});

async function migrationHarness(expiresAt: unknown = 5000000.75) {
    const h = await harness();
    const publicKey = await webcrypto.subtle.exportKey('jwk', h.pair.publicKey);
    let saved: any = { ...h.state, mode: 'staged', seats: {} };
    const store = {
        getWithMetadata: async () => ({ data: structuredClone(saved), etag: String(saved.revision) }),
        setJSON: vi.fn(async (_path: string, next: any, options: any) => {
            if (options.onlyIfMatch !== String(saved.revision)) return { modified: false };
            saved = structuredClone(next); return { modified: true };
        })
    };
    const service = createSeatStageService({ store, enabled: true, now: () => 1000000,
        publicKeys: [publicKey], receiptPrivateJwk: h.ctx.signingPrivateKeyJwk });
    const originalFetch = h.ctx.fetchWithTimeout;
    h.ctx.fetchWithTimeout = async (url: string, options: any) => {
        if (url.includes('firebaseio')) return originalFetch(url, options);
        const envelope = JSON.parse(options.body);
        const command = JSON.parse(Buffer.from(envelope.payload, 'base64url').toString());
        const result = await service.execute(envelope);
        h.commands.push({ command, envelope, result });
        return { res: { ok: result.status === 200 }, body: result.body };
    };
    h.setRow({ maxDevices: 1, expiresAt, revoked: false });
    h.ctx.window.ZoeSeatConfig.receiptPublicKeys = [publicKey];
    const canonical = { kty: publicKey.kty, crv: publicKey.crv, x: publicKey.x, y: publicKey.y };
    const fingerprint = Buffer.from(await webcrypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(canonical)))).toString('hex');
    const payload = Buffer.from(JSON.stringify({ domain: 'zoe-license-enrollment-v1', audience: 'https://zoew.netlify.app',
        app: 'ZOE', keyId: 'ABCDEFGHIJKLMNOP', publicKey: canonical, nonce: '0123456789abcdef0123456789abcdef' })).toString('base64url');
    const signature = Buffer.from(await webcrypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, h.pair.privateKey,
        Buffer.from(payload))).toString('base64url');
    h.ctx.window.ZoeSeatClient = { fingerprint: async () => fingerprint };
    const choose = async (choice: string) => {
        h.ctx.prompt.mockReturnValueOnce(choice);
        if (choice === '2') h.ctx.prompt.mockReturnValueOnce(JSON.stringify({ payload, signature, fingerprint }));
        await h.ctx.manageSecureSeats('ABCDEFGHIJKLMNOP');
    };
    return { ...h, saved: () => saved, store, choose };
}

describe('ផ្ទេរសុពលភាព legacy ទសភាគទៅ Server សុវត្ថិភាព', () => {
    it.each([5000000, 5000000.75])('ថ្ងៃផុត %s អាច configure ចុះឈ្មោះ និង cutover ដោយហត្ថលេខាពិត', async expiresAt => {
        const h = await migrationHarness(expiresAt);
        await h.choose('1');
        expect(h.commands.map(x => x.result.status)).toEqual([200, 200, 200]);
        expect(h.saved().licenseExpiresAt).toBe(5000000);
        expect(h.ctx.showToast).toHaveBeenCalledOnce();
        expect(h.ctx.fb.runTransaction).not.toHaveBeenCalled();
        await h.choose('2');
        expect(Object.keys(h.saved().seats)).toEqual(['d1']);
        await h.choose('4');
        expect(h.saved().mode).toBe('active');
        expect(h.ctx.alert).not.toHaveBeenCalled();
        expect(h.ctx.showToast).toHaveBeenCalledTimes(3);
        expect(h.ctx.fb.runTransaction).toHaveBeenCalledOnce();
        expect(await h.ctx.seatSellerRow(h.ctx.seatSellerContext(), 'ABCDEFGHIJKLMNOP')).toMatchObject({ seatProtocol: 2, expiresAt });
    });
    it.each([undefined, null, NaN, Infinity, -1, 0, 0.75, '5000000.75', {}, [], Number.MAX_SAFE_INTEGER + 1])('ថ្ងៃផុតមិនត្រឹមត្រូវ %s មិន configure', async expiresAt => {
        const h = await migrationHarness(); h.setRow({ maxDevices: 1, expiresAt, revoked: false });
        await h.choose('1');
        expect(h.store.setJSON).not.toHaveBeenCalled();
        expect(h.ctx.showToast).not.toHaveBeenCalled();
        expect(h.ctx.alert).toHaveBeenCalledOnce();
        expect(h.ctx.fb.runTransaction).not.toHaveBeenCalled();
    });
    it('ការប្ដូរថ្ងៃផុតក្នុងមីលីវិនាទីដូចគ្នាមុន transaction មិនប្ដូរ marker', async () => {
        const h = await migrationHarness();
        await h.choose('1'); await h.choose('2');
        const transaction = h.ctx.fb.runTransaction.getMockImplementation();
        h.ctx.fb.runTransaction.mockImplementation(async (...args: any[]) => {
            h.setRow({ maxDevices: 1, expiresAt: 5000000.875, revoked: false });
            return transaction(...args);
        });
        h.ctx.showToast.mockClear();
        await h.choose('4');
        expect(h.saved().mode).toBe('active');
        expect(h.ctx.fb.runTransaction).toHaveBeenCalledOnce();
        expect((await h.ctx.seatSellerRow(h.ctx.seatSellerContext(), 'ABCDEFGHIJKLMNOP')).seatProtocol).not.toBe(2);
        expect(h.ctx.showToast).not.toHaveBeenCalled();
        expect(h.ctx.alert).toHaveBeenCalledOnce();
    });
});

async function markerHarness() {
    const h = await harness();
    h.setRow({ maxDevices: 1, expiresAt: 5000000, revoked: false, releasedAt: 123, label: 'keep' });
    const pub = await webcrypto.subtle.exportKey('jwk', h.pair.publicKey);
    const canonical = { kty: pub.kty, crv: pub.crv, x: pub.x, y: pub.y };
    h.ctx.window.ZoeSeatConfig.receiptPublicKeys = [canonical];
    h.ctx.receiptKeyFingerprint = Buffer.from(await webcrypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(canonical)))).toString('hex');
    h.ctx.prompt.mockReturnValue('4');
    return { ...h, run: () => h.ctx.manageSecureSeats('ABCDEFGHIJKLMNOP') };
}

describe('marker រង់ចាំ cache SDK និងផ្ទៀងលទ្ធផលដាច់ដោយឡែក', () => {
    afterEach(() => vi.useRealTimers());

    it('REST មិនបំពេញ cache SDK ហើយ listener រស់រហូតអានលទ្ធផលចប់', async () => {
        const h = await markerHarness();
        const events: string[] = [];
        const fetch = h.ctx.fetchWithTimeout.getMockImplementation();
        h.ctx.fetchWithTimeout.mockImplementation(async (...args: any[]) => {
            if (args[0].includes('firebaseio') && h.ctx.fb.runTransaction.mock.calls.length) {
                expect(h.listenerActive()).toBe(true);
                events.push('readback');
            }
            return fetch(...args);
        });
        const transaction = h.ctx.fb.runTransaction.getMockImplementation();
        h.ctx.fb.runTransaction.mockImplementation(async (...args: any[]) => {
            expect(h.listenerActive()).toBe(true);
            events.push('transaction');
            return transaction(...args);
        });
        await h.run();
        expect(h.row()).toEqual({ maxDevices: 1, expiresAt: 5000000, revoked: false, releasedAt: 123, label: 'keep', seatProtocol: 2 });
        expect(h.ctx.showToast).toHaveBeenCalledOnce();
        expect(h.ctx.alert).not.toHaveBeenCalled();
        expect(h.ctx.fb.onValue).toHaveBeenCalledOnce();
        expect(h.ctx.fb.onValue.mock.calls[0][0]).toBe('license_keys/ZOE/ABCDEFGHIJKLMNOP');
        expect(h.ctx.fb.runTransaction).toHaveBeenCalledWith('license_keys/ZOE/ABCDEFGHIJKLMNOP', expect.any(Function), { applyLocally: false });
        expect(events).toEqual(['transaction', 'readback']);
        expect(h.unsubscribe).toHaveBeenCalledOnce();
        expect(h.listenerActive()).toBe(false);
    });

    it('snapshot cache ដំបូងអាចមកភ្លាម មុន onValue ត្រឡប់ unsubscribe', async () => {
        const h = await markerHarness(); h.setAutoEmit(false);
        const listen = h.ctx.fb.onValue.getMockImplementation();
        let returned = false;
        h.ctx.fb.onValue.mockImplementation((...args: any[]) => {
            const stop = listen(...args);
            h.emit();
            returned = true;
            return stop;
        });
        const transaction = h.ctx.fb.runTransaction.getMockImplementation();
        h.ctx.fb.runTransaction.mockImplementation((...args: any[]) => {
            expect(returned).toBe(true);
            return transaction(...args);
        });
        await h.run();
        expect(h.ctx.showToast).toHaveBeenCalledOnce();
        expect(h.row()?.seatProtocol).toBe(2);
        expect(h.unsubscribe).toHaveBeenCalledOnce();
    });

    it('រង់ចាំ snapshot ដំបូង មិនសរសេរពី REST fallback', async () => {
        const h = await markerHarness(); h.setAutoEmit(false);
        const pending = h.ctx.seatSellerMark(h.ctx.seatSellerContext(), 'ABCDEFGHIJKLMNOP', h.state);
        await flushMicrotasks();
        expect(h.ctx.fb.onValue).toHaveBeenCalledOnce();
        expect(h.ctx.fb.runTransaction).not.toHaveBeenCalled();
        h.emit();
        await pending;
        expect(h.row()?.seatProtocol).toBe(2);
        expect(h.unsubscribe).toHaveBeenCalledOnce();
    });

    it.each([null, [], 4, { seatProtocol: 3 }])('snapshot មិនត្រឹមត្រូវ %j បិទដោយមិនសរសេរ', async value => {
        const h = await markerHarness(); h.setAutoEmit(false);
        const pending = expect(h.ctx.seatSellerMark(h.ctx.seatSellerContext(), 'ABCDEFGHIJKLMNOP', h.state)).rejects.toThrow('seat-row-invalid');
        await flushMicrotasks();
        h.emit(value as any);
        await pending;
        expect(h.ctx.fb.runTransaction).not.toHaveBeenCalled();
        expect(h.unsubscribe).toHaveBeenCalledOnce();
    });

    it('permission callback មុន snapshot បញ្ចប់ និងដោះ listener', async () => {
        const h = await markerHarness(); h.setAutoEmit(false);
        const pending = expect(h.ctx.seatSellerMark(h.ctx.seatSellerContext(), 'ABCDEFGHIJKLMNOP', h.state)).rejects.toThrow('PERMISSION_DENIED');
        await flushMicrotasks(); h.cancelListener(new Error('PERMISSION_DENIED')); await pending;
        expect(h.ctx.fb.runTransaction).not.toHaveBeenCalled();
        expect(h.unsubscribe).toHaveBeenCalledOnce();
    });

    it('គ្មាន snapshot ដល់ពិដាន មិនចាប់ផ្ដើម transaction', async () => {
        vi.useFakeTimers();
        const h = await markerHarness(); h.setAutoEmit(false);
        const pending = expect(h.ctx.seatSellerMark(h.ctx.seatSellerContext(), 'ABCDEFGHIJKLMNOP', h.state)).rejects.toThrow('Seat marker read timed out');
        await flushMicrotasks();
        expect(h.ctx.fb.onValue).toHaveBeenCalledOnce();
        expect(h.ctx.fb.runTransaction).not.toHaveBeenCalled();
        await vi.advanceTimersToNextTimerAsync(); await pending;
        expect(h.ctx.fb.runTransaction).not.toHaveBeenCalled();
        expect(h.unsubscribe).toHaveBeenCalledOnce();
        expect(vi.getTimerCount()).toBe(0);
    });

    it.each(['session', 'clock', 'key', 'sdk'])('ប្ដូរ %s ពេលរង់ចាំ snapshot មិនសរសេរ', async change => {
        const h = await markerHarness(); h.setAutoEmit(false);
        const pending = expect(h.ctx.seatSellerMark(h.ctx.seatSellerContext(), 'ABCDEFGHIJKLMNOP', h.state)).rejects.toThrow('seat-session-changed');
        await flushMicrotasks();
        if (change === 'session') h.setCurrent(false);
        if (change === 'clock') h.ctx.keygenClockIsCurrent = () => false;
        if (change === 'key') h.ctx.signingPrivateKeyJwk = {};
        if (change === 'sdk') h.ctx.fb = { ...h.ctx.fb };
        h.emit(); await pending;
        expect(h.ctx.fb.runTransaction).not.toHaveBeenCalled();
        expect(h.unsubscribe).toHaveBeenCalledOnce();
    });

    it.each([
        null,
        { maxDevices: 2, expiresAt: 5000000, revoked: false },
        { maxDevices: 1, expiresAt: 5000000.25, revoked: false },
        { maxDevices: 1, expiresAt: 5000000, revoked: true }
    ])('updater បដិសេធ row ដែលខុស %j មិនយក REST ចាស់មកសរសេរ', async value => {
        const h = await markerHarness();
        h.ctx.fb.runTransaction.mockImplementation(async (_ref: unknown, update: any) => {
            expect(update(value)).toBeUndefined();
            return { committed: false, snapshot: h.snapshot(value) };
        });
        await expect(h.ctx.seatSellerMark(h.ctx.seatSellerContext(), 'ABCDEFGHIJKLMNOP', h.state)).rejects.toThrow('seat-marker-unverified');
        expect(h.row()?.seatProtocol).not.toBe(2);
        expect(h.unsubscribe).toHaveBeenCalledOnce();
    });

    it('SDK retry ផ្ទៀង row បច្ចុប្បន្នឡើងវិញ មិនជាន់ expiresAt ដែលប្រែ', async () => {
        const h = await markerHarness();
        const transaction = h.ctx.fb.runTransaction.getMockImplementation();
        h.ctx.fb.runTransaction.mockImplementation(async (...args: any[]) => {
            h.setRow({ ...h.row(), expiresAt: 5000000.25 }, false);
            return transaction(...args);
        });
        await expect(h.ctx.seatSellerMark(h.ctx.seatSellerContext(), 'ABCDEFGHIJKLMNOP', h.state)).rejects.toThrow('seat-marker-unverified');
        expect(h.row()?.expiresAt).toBe(5000000.25);
        expect(h.row()?.seatProtocol).not.toBe(2);
        expect(h.unsubscribe).toHaveBeenCalledOnce();
    });

    it.each([undefined, { committed: false }, { committed: false, snapshot: { val: () => null } },
        { committed: true, snapshot: { val: () => ({ seatProtocol: 1 }) } }])('មិនទទួលលទ្ធផល transaction មិនបានបញ្ជាក់ %#', async result => {
        const h = await markerHarness();
        h.ctx.fb.runTransaction.mockImplementation(async () => { h.setRow({ ...h.row(), seatProtocol: 2 }); return result; });
        await expect(h.ctx.seatSellerMark(h.ctx.seatSellerContext(), 'ABCDEFGHIJKLMNOP', h.state)).rejects.toThrow('seat-marker-unverified');
        expect(h.ctx.fb.runTransaction).toHaveBeenCalledOnce();
        expect(h.unsubscribe).toHaveBeenCalledOnce();
    });

    it('marker មានរួចក្នុង transaction ត្រូវអាន REST បញ្ជាក់ មិនសរសេរម្ដងទៀត', async () => {
        const h = await markerHarness();
        const transaction = h.ctx.fb.runTransaction.getMockImplementation();
        h.ctx.fb.runTransaction.mockImplementation(async (...args: any[]) => {
            h.setRow({ ...h.row(), seatProtocol: 2 });
            const result = await transaction(...args);
            expect(result.committed).toBe(false);
            return result;
        });
        await h.run();
        expect(h.ctx.showToast).toHaveBeenCalledOnce();
        expect(h.ctx.fb.runTransaction).toHaveBeenCalledOnce();
        expect(h.ctx.fetchWithTimeout.mock.calls.filter(([url]: [string]) => url.includes('firebaseio'))).toHaveLength(3);
        expect(h.unsubscribe).toHaveBeenCalledOnce();
    });

    it.each([true, false])('transaction committed=%s មិនជំនួស REST readback', async committed => {
        const h = await markerHarness();
        h.ctx.fb.runTransaction.mockResolvedValue({ committed, snapshot: h.snapshot({ seatProtocol: 2 }) });
        await h.run();
        expect(h.ctx.showToast).not.toHaveBeenCalled();
        expect(h.ctx.alert).toHaveBeenCalledOnce();
        expect(h.ctx.fb.runTransaction).toHaveBeenCalledOnce();
        expect(h.unsubscribe).toHaveBeenCalledOnce();
    });

    it.each(['confirmed', 'missing', 'unavailable'])('REST marker ដែលមានរួចត្រូវផ្ទៀង readback: %s', async outcome => {
        const h = await markerHarness(); h.setRow({ ...h.row(), seatProtocol: 2 });
        const fetch = h.ctx.fetchWithTimeout.getMockImplementation();
        let reads = 0;
        h.ctx.fetchWithTimeout.mockImplementation(async (...args: any[]) => {
            if (args[0].includes('firebaseio') && ++reads === 3) {
                expect(h.listenerActive()).toBe(true);
                if (outcome === 'unavailable') throw new Error('offline');
                if (outcome === 'missing') return { body: { ...h.row(), seatProtocol: 1 }, res: { ok: true } };
            }
            return fetch(...args);
        });
        await h.run();
        expect(reads).toBe(3);
        expect(h.ctx.fb.runTransaction).not.toHaveBeenCalled();
        expect(h.ctx.showToast).toHaveBeenCalledTimes(outcome === 'confirmed' ? 1 : 0);
        expect(h.unsubscribe).toHaveBeenCalledOnce();
    });

    it('permission callback ពេល transaction កំពុងរង់ចាំ មិនសាកឡើងវិញ', async () => {
        const h = await markerHarness();
        let update: any;
        h.ctx.fb.runTransaction.mockImplementation((_ref: unknown, updater: any) => { update = updater; return new Promise(() => {}); });
        const pending = expect(h.ctx.seatSellerMark(h.ctx.seatSellerContext(), 'ABCDEFGHIJKLMNOP', h.state)).rejects.toThrow('PERMISSION_DENIED');
        await flushMicrotasks();
        expect(h.ctx.fb.runTransaction).toHaveBeenCalledOnce();
        h.cancelListener(new Error('PERMISSION_DENIED')); await pending;
        expect(update(h.row())).toBeUndefined();
        expect(h.unsubscribe).toHaveBeenCalledOnce();
        expect(h.ctx.fb.runTransaction).toHaveBeenCalledOnce();
    });

    it.each(['session', 'clock'])('ប្ដូរ %s ពេល transaction pending បិទ updater និងមិនទទួលចម្លើយយឺត', async change => {
        const h = await markerHarness();
        let finish: any, update: any, proposed: any;
        h.ctx.fb.runTransaction.mockImplementation((_ref: unknown, updater: any) => {
            update = updater; proposed = updater(h.row());
            return new Promise(resolve => { finish = resolve; });
        });
        const pending = expect(h.ctx.seatSellerMark(h.ctx.seatSellerContext(), 'ABCDEFGHIJKLMNOP', h.state)).rejects.toThrow('seat-session-changed');
        await flushMicrotasks();
        expect(proposed.seatProtocol).toBe(2);
        if (change === 'session') h.setCurrent(false);
        else h.ctx.keygenClockIsCurrent = () => false;
        expect(update(h.row())).toBeUndefined();
        h.setRow(proposed);
        finish({ committed: true, snapshot: h.snapshot(proposed) });
        await pending;
        expect(h.unsubscribe).toHaveBeenCalledOnce();
        expect(h.ctx.fb.runTransaction).toHaveBeenCalledOnce();
        expect(h.ctx.showToast).not.toHaveBeenCalled();
    });

    it('បដិសេធ transaction ដោះ listener ហើយមិនសាកផ្ញើឡើងវិញ', async () => {
        const h = await markerHarness(); h.ctx.fb.runTransaction.mockRejectedValue(new Error('PERMISSION_DENIED'));
        await h.run();
        expect(h.ctx.fb.runTransaction).toHaveBeenCalledOnce();
        expect(h.ctx.showToast).not.toHaveBeenCalled();
        expect(h.ctx.alert).toHaveBeenCalledOnce();
        expect(h.unsubscribe).toHaveBeenCalledOnce();
    });

    it('timeout មិនមែនលុប write ដែលផ្ញើរួច ហើយ callback យឺតមិនបញ្ជាក់ជោគជ័យ', async () => {
        vi.useFakeTimers();
        const h = await markerHarness();
        let finish: any, update: any, proposed: any;
        h.ctx.fb.runTransaction.mockImplementation((_ref: unknown, updater: any) => {
            update = updater; proposed = updater(h.row());
            return new Promise(resolve => { finish = resolve; });
        });
        const pending = expect(h.ctx.seatSellerMark(h.ctx.seatSellerContext(), 'ABCDEFGHIJKLMNOP', h.state)).rejects.toThrow('Seat marker outcome unknown');
        await flushMicrotasks();
        expect(proposed.seatProtocol).toBe(2);
        await vi.advanceTimersToNextTimerAsync(); await pending;
        expect(h.unsubscribe).toHaveBeenCalledOnce();
        expect(update(h.row())).toBeUndefined();
        h.setRow(proposed);
        finish({ committed: true, snapshot: h.snapshot(proposed) });
        await flushMicrotasks();
        expect(h.row()?.seatProtocol).toBe(2);
        expect(h.ctx.fb.runTransaction).toHaveBeenCalledOnce();
        expect(h.ctx.showToast).not.toHaveBeenCalled();
        expect(vi.getTimerCount()).toBe(0);
    });

    it.each(['session', 'clock', 'permission'])('ប្ដូរ %s ពេលអាន readback មិនបញ្ជាក់ជោគជ័យ', async change => {
        const h = await markerHarness();
        const fetch = h.ctx.fetchWithTimeout.getMockImplementation();
        h.ctx.fetchWithTimeout.mockImplementation(async (...args: any[]) => {
            if (args[0].includes('firebaseio') && h.ctx.fb.runTransaction.mock.calls.length) {
                expect(h.listenerActive()).toBe(true);
                if (change === 'session') h.setCurrent(false);
                if (change === 'clock') h.ctx.keygenClockIsCurrent = () => false;
                if (change === 'permission') h.cancelListener(new Error('PERMISSION_DENIED'));
            }
            return fetch(...args);
        });
        await h.run();
        expect(h.ctx.showToast).not.toHaveBeenCalled();
        expect(h.unsubscribe).toHaveBeenCalledOnce();
        expect(h.ctx.fb.runTransaction).toHaveBeenCalledOnce();
    });
});

async function flushMicrotasks() {
    for (let i = 0; i < 20; i++) await Promise.resolve();
}
