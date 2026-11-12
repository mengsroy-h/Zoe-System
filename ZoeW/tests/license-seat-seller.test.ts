import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';

const source = readFileSync(resolve(__dirname, '../../ZoeKeyGen/app.js'), 'utf8');
const begin = source.indexOf('function seatSellerContext()');
const end = source.indexOf('async function toggleRevokeKey(', begin);
if (begin < 0 || end < 0) throw new Error('រកមិនឃើញកូដគ្រប់គ្រងសោ');
async function harness() {
    const pair = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    const privateKey = await webcrypto.subtle.exportKey('jwk', pair.privateKey);
    const state = { schema: 1, revision: 1, releaseEpoch: 0, mode: 'active', seats: { d1: {} }, maxDevices: 1, licenseExpiresAt: 5000000, revoked: false };
    let current = true;
    let row: Record<string, unknown> = { seatProtocol: 2, maxDevices: 1, expiresAt: 5000000, revoked: false };
    const commands: any[] = [];
    const ctx: any = {
        TextEncoder, TextDecoder, Uint8Array, crypto: webcrypto, btoa, atob,
        signingPrivateKeyJwk: privateKey, db: {},
        captureSensitiveSession: () => ({}), adminOperationIsCurrent: () => current, isSensitiveSessionCurrent: () => current,
        captureKeygenClock: () => ({ now: 1000000, generation: 1 }), keygenClockIsCurrent: () => true, getTrustedServerNow: () => 1000000,
        databaseUrlOf: () => 'https://example.firebaseio.com', isFirebaseDatabaseHost: () => true,
        confirm: vi.fn(() => true), prompt: vi.fn(() => null), alert: vi.fn(), showToast: vi.fn(), refreshKeyList: vi.fn(), closeModal: vi.fn(),
        fb: { runTransaction: vi.fn(), ref: (_db: unknown, path: string) => path }, withTimeout: (p: unknown) => p,
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
    ctx.fb.runTransaction.mockImplementation(async (_ref: unknown, update: any) => { const next = update(row); if (next) row = next; return { committed: !!next }; });
    vm.createContext(ctx);
    vm.runInContext(source.slice(begin, end), ctx);
    return { ctx, commands, state, pair, setCurrent: (value: boolean) => { current = value; }, setRow: (value: Record<string, unknown>) => { row = value; } };
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
