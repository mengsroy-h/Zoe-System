// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { createSeatStageService, seatKeyFingerprint } from '../netlify/lib/license-seat-stage.mjs';

const root = resolve(__dirname, '../..');
const source = readFileSync(process.env.SECURE_ISSUANCE_APP_SOURCE || resolve(root, 'ZoeKeyGen/app.js'), 'utf8');
const id = 'SYNTHETICKEY123456789';
const now = 1800000000000;
async function keys() {
    const pair = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    return { pair, publicKey: await webcrypto.subtle.exportKey('jwk', pair.publicKey), privateKey: await webcrypto.subtle.exportKey('jwk', pair.privateKey) };
}
async function signed(key: webcrypto.CryptoKey, value: any) {
    const payload = Buffer.from(JSON.stringify(value)).toString('base64url');
    const signature = Buffer.from(await webcrypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, Buffer.from(payload))).toString('base64url');
    return { payload, signature };
}
async function harness(receipts = true) {
    const seller = await keys(), receipt = await keys(), device = await keys();
    let current = true, state: any = null, etag = 0;
    let loseAction = '', pauseAction = '';
    let release: (() => void) | undefined;
    const commands: any[] = [], outcomes: any[] = [];
    const records: Record<string, any> = {
        [`license_keys/ZOE/${id}`]: { seatProtocol: 2, expiresAt: now + 86400000, revoked: false, maxDevices: 1 },
        [`license_keys_meta/ZOE/${id}`]: { issuedAt: now, scope: 'ZOE', note: '', createdBy: 'seller', secureIssued: true }
    };
    const store = {
        getWithMetadata: async () => state ? { data: structuredClone(state), etag: String(etag) } : null,
        setJSON: vi.fn(async (_path: string, next: any, options: any) => {
            if (options.onlyIfNew ? state !== null : options.onlyIfMatch !== String(etag)) return { modified: false };
            state = structuredClone(next); etag++; return { modified: true };
        })
    };
    const service = createSeatStageService({ store, enabled: true, publicKeys: [seller.publicKey], now: () => now,
        receiptPrivateJwk: receipts ? receipt.privateKey : null });
    const elements: Record<string, any> = {};
    const element = (name: string) => elements[name] ||= { value: '', textContent: '', disabled: false, style: {}, classList: { add: vi.fn(), remove: vi.fn(), toggle: vi.fn() }, focus: vi.fn() };
    const writes: any[] = [];
    const ctx: any = {
        TextEncoder, TextDecoder, Uint8Array, crypto: webcrypto, btoa, atob, setTimeout, clearTimeout,
        signingPrivateKeyJwk: seller.privateKey, db: {}, secureKeySetup: null, lastGeneratedKey: '',
        console: { error: vi.fn() }, keyListSessionGeneration: 1, seatLimitOf: Number,
        waitForServerTimeSync: async () => true, retryAsync: async (run: any) => run(),
        captureSensitiveSession: () => ({ user: { uid: 'seller' } }), adminOperationIsCurrent: () => current, isSensitiveSessionCurrent: () => current,
        captureKeygenClock: () => ({ now, generation: 1 }), keygenClockIsCurrent: () => true, getTrustedServerNow: () => now,
        databaseUrlOf: () => 'https://fixture.firebaseio.com', isFirebaseDatabaseHost: () => true,
        confirm: vi.fn(() => true), alert: vi.fn(), showToast: vi.fn(), refreshKeyList: vi.fn(), openModalHelper: vi.fn(), closeModal: vi.fn(),
        document: { getElementById: element }, LICENSE_APP_CODE: 'ZOE',
        LICENSE_SEAT_SLOT_NAMES: ['d1', 'd2', 'd3', 'd4', 'd5'],
        fb: { update: vi.fn(async (_ref: any, updates: any) => { writes.push(structuredClone(updates)); Object.assign(records, structuredClone(updates)); }), ref: (_db: unknown, path: string) => path, get: vi.fn(async (path: string) => ({ val: () => structuredClone(records[path]), exists: () => !!records[path] })) },
        fetchWithTimeout: vi.fn(async (url: string, options: any) => {
            if (url.includes('firebaseio')) { const path = new URL(url).pathname.slice(1).replace(/\.json$/, ''); return { body: structuredClone(records[path]), res: { ok: true } }; }
            const envelope = JSON.parse(options.body);
            const command = JSON.parse(Buffer.from(envelope.payload, 'base64url').toString());
            commands.push(command);
            const result = await service.execute(envelope); outcomes.push(result);
            if (command.action === pauseAction) { pauseAction = ''; await new Promise<void>(r => { release = r; }); }
            if (command.action === loseAction) { loseAction = ''; throw new Error('lost response'); }
            return { body: result.body, res: { ok: result.status === 200 } };
        }),
        window: { ZoeSeatConfig: { receiptPublicKeys: receipts ? [receipt.publicKey] : [] } }
    };
    vm.createContext(ctx);
    vm.runInContext(readFileSync(resolve(root, 'ZoeKeyGen/license-seat-client.js'), 'utf8'), ctx);
    vm.runInContext(readFileSync(resolve(root, 'ZoeKeyGen/license-verify.js'), 'utf8'), ctx);
    const begin = source.indexOf('function seatSellerContext()'), end = source.indexOf('async function toggleRevokeKey(', begin);
    vm.runInContext(source.slice(source.indexOf('function withTimeout('), source.indexOf('function retryAsync(')) + source.slice(begin, end), ctx);
    vm.runInContext(source.slice(source.indexOf("let lastGeneratedKey = ''"), source.indexOf('function copyGeneratedKey()')), ctx);
    element('genDaysInput').value = '1'; element('genDevicesInput').value = '1';
    const enrollment = async (who = device, changes = {}) => ({ ...await signed(who.pair.privateKey, {
        domain: 'zoe-license-enrollment-v1', audience: 'https://zoew.netlify.app', app: 'ZOE', keyId: id,
        publicKey: who.publicKey, nonce: '0123456789abcdef0123456789abcdef', ...changes
    }), fingerprint: seatKeyFingerprint(who.publicKey) });
    const inspect = async (request?: any) => {
        element('secureKeyEnrollmentInput').value = JSON.stringify(request || await enrollment());
        await ctx.inspectSecureKeyEnrollment();
    };
    return { ctx, element, records, writes, store, commands, outcomes, service, seller, device, enrollment, inspect,
        state: () => structuredClone(state), setState: (value: any) => { state = structuredClone(value); etag++; },
        setCurrent: (value: boolean) => { current = value; }, lose: (action: string) => { loseAction = action; },
        pause: (action: string) => { pauseAction = action; }, release: () => release?.(), pending: () => !!release };
}

describe('ការចេញសោសុវត្ថិភាព និងការបន្តលទ្ធផលមិនប្រាកដ', () => {
    it('បើកសោថ្មីដោយមិនអនុញ្ញាតឧបករណ៍មុនចុះឈ្មោះ', async () => {
        const h = await harness();
        expect(h.ctx.openSecureKeySetup).toBeTypeOf('function');
        await h.ctx.openSecureKeySetup(id);
        expect(h.state()).toMatchObject({ mode: 'staged', revision: 1, revoked: false, seats: {} });
        expect(h.outcomes.every(result => result.body.grantsLicense === false)).toBe(true);
        expect(h.commands.filter(command => command.action === 'configure')).toHaveLength(1);
        const result = await h.service.execute(await signed(h.device.pair.privateKey, {
            domain: 'zoe-license-seat-stage-v1', audience: 'https://zoew.netlify.app', app: 'ZOE', keyId: id,
            expiresAt: now + 30000, action: 'prove', revision: 1, releaseEpoch: 0, slot: 'd1'
        }));
        expect(result.status).toBe(403); expect(result.body.grantsLicense).toBe(false);
        expect(result.body).not.toHaveProperty('receipt');
    });
});

describe('ការអនុម័តសំណើដែលមានហត្ថលេខាពិត', () => {
    it('រក្សាលេខសោនិងថ្ងៃដើមពេលបើកឡើងវិញ ហើយចុះហត្ថលេខាដែលអាចផ្ទៀងផ្ទាត់បាន', async () => {
        const h = await harness(); await h.ctx.openSecureKeySetup(id);
        const value = h.element('secureKeySetupKey').value;
        const raw = value.slice(h.ctx.window.ZoeLicense.KEY_PREFIX.length);
        const [payload, signature] = raw.split('.');
        expect(JSON.parse(Buffer.from(payload, 'base64url').toString())).toEqual({ a: 'ZOE', id, iat: now / 1000, exp: (now + 86400000) / 1000 });
        expect(await webcrypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, h.seller.pair.publicKey, Buffer.from(signature, 'base64url'), Buffer.from(payload))).toBe(true);
        h.ctx.clearSecureKeySetup(); expect(h.element('secureKeySetupKey').value).toBe('');
        await h.ctx.openSecureKeySetup(id);
        expect(h.commands.filter(command => command.action === 'configure')).toHaveLength(1);
        expect(JSON.stringify(h.records)).not.toContain(value);
    });
    it('អនុម័តតាម fingerprint បន្ទាប់មកចុះឈ្មោះនិងបើក Server ម្តងគត់', async () => {
        const h = await harness(); await h.ctx.openSecureKeySetup(id); await h.inspect();
        const fingerprint = seatKeyFingerprint(h.device.publicKey);
        expect(h.element('secureKeyFingerprint').textContent).toBe(fingerprint);
        expect(h.element('secureKeyApproveBtn').disabled).toBe(false);
        expect(h.state().seats).toEqual({});
        await h.ctx.approveSecureKeyEnrollment();
        expect(h.ctx.confirm).toHaveBeenCalledWith(expect.stringContaining(fingerprint));
        expect(h.state()).toMatchObject({ mode: 'active', revision: 3, releaseEpoch: 0, seats: { d1: { publicKey: { x: h.device.publicKey.x, y: h.device.publicKey.y } } } });
        expect(h.commands.filter(command => command.action !== 'inspect').map(command => command.action)).toEqual(['configure', 'enroll', 'cutover']);
        expect(h.outcomes.every(result => result.status === 200)).toBe(true);
        expect(h.element('secureKeySetupStatus').textContent).toContain('Server សកម្ម');
    });
    it.each(['json', 'signature', 'fingerprint', 'key', 'nonce', 'private'])('បដិសេធសំណើខូច %s ដោយមិនផ្ញើការកែ', async kind => {
        const h = await harness(); await h.ctx.openSecureKeySetup(id);
        let request: any = await h.enrollment();
        if (kind === 'signature') request.signature = 'A'.repeat(86);
        if (kind === 'fingerprint') request.fingerprint = '0'.repeat(64);
        if (kind === 'key') request = await h.enrollment(h.device, { keyId: 'OTHERLICENSE123456789' });
        if (kind === 'nonce') request = await h.enrollment(h.device, { nonce: 'bad' });
        if (kind === 'private') request = await h.enrollment(h.device, { publicKey: h.device.privateKey });
        await h.inspect(request);
        if (kind === 'json') { h.element('secureKeyEnrollmentInput').value = '{'; await h.ctx.inspectSecureKeyEnrollment(); }
        expect(h.element('secureKeyApproveBtn').disabled).toBe(true);
        await h.ctx.approveSecureKeyEnrollment();
        expect(h.ctx.confirm).not.toHaveBeenCalled();
        expect(h.state().seats).toEqual({}); expect(h.store.setJSON).toHaveBeenCalledOnce();
    });
    it('ការបោះបង់មិនចុះឈ្មោះ និងការកែ JSON ទាមទារពិនិត្យថ្មី', async () => {
        const h = await harness(); await h.ctx.openSecureKeySetup(id); await h.inspect();
        h.ctx.confirm.mockReturnValue(false); await h.ctx.approveSecureKeyEnrollment();
        expect(h.state().seats).toEqual({});
        h.ctx.confirm.mockReturnValue(true); h.element('secureKeyEnrollmentInput').value += ' ';
        await h.ctx.approveSecureKeyEnrollment();
        expect(h.ctx.confirm).toHaveBeenCalledOnce(); expect(h.store.setJSON).toHaveBeenCalledOnce();
        expect(h.element('secureKeyApproveBtn').disabled).toBe(true);
    });
    it('មិនយកកន្លែងដែលមានម្ចាស់ និងមិនប្ដូរកូនសោម្ចាស់ដើម', async () => {
        const h = await harness(); await h.ctx.openSecureKeySetup(id);
        const other = await keys(); const saved = { ...h.state(), revision: 2, seats: { d1: { publicKey: other.publicKey } } }; h.setState(saved);
        await h.inspect(); await h.ctx.approveSecureKeyEnrollment();
        expect(h.state()).toEqual(saved); expect(h.store.setJSON).toHaveBeenCalledOnce();
        expect(h.commands.some(command => command.action === 'enroll' || command.action === 'cutover')).toBe(false);
    });
    it('ខ្វះសោ receipt មិនកំណត់ឬបើក Server', async () => {
        const h = await harness(false); await h.ctx.openSecureKeySetup(id); await h.inspect(); await h.ctx.approveSecureKeyEnrollment();
        expect(h.state()).toBeNull(); expect(h.store.setJSON).not.toHaveBeenCalled();
        expect(h.commands.every(command => command.action === 'inspect')).toBe(true);
    });
    it.each(['revoked', 'expired'])('បើកឡើងវិញមិនលុបស្ថានភាព %s នៅ Server', async reason => {
        const h = await harness(); await h.ctx.openSecureKeySetup(id);
        const saved = { ...h.state(), revision: 4, revoked: reason === 'revoked', licenseExpiresAt: reason === 'expired' ? now - 1000 : now + 50000 };
        h.setState(saved); await h.ctx.refreshSecureKeySetup(); await h.inspect(); await h.ctx.approveSecureKeyEnrollment();
        expect(h.state()).toEqual(saved); expect(h.store.setJSON).toHaveBeenCalledOnce();
        expect(h.commands.filter(command => command.action === 'configure')).toHaveLength(1);
    });
});

describe('ការបាត់ចម្លើយ និងសំណើពីប្រអប់ចាស់', () => {
    it.each(['configure', 'enroll', 'cutover'])('បាត់ចម្លើយ %s បន្តពីស្ថានភាព Server ដោយមិនសរសេរត្រួត', async action => {
        const h = await harness(); h.lose(action); await h.ctx.openSecureKeySetup(id);
        if (action !== 'configure') { await h.inspect(); await h.ctx.approveSecureKeyEnrollment(); }
        const saved = h.state(); expect(saved.revision).toBe(action === 'configure' ? 1 : action === 'enroll' ? 2 : 3);
        if (action !== 'configure') {
            expect(h.element('secureKeySetupStatus').textContent).not.toContain('Server សកម្ម');
            const count = h.commands.length;
            await h.ctx.approveSecureKeyEnrollment();
            expect(h.commands).toHaveLength(count);
            expect(h.state()).toEqual(saved);
        }
        await h.ctx.refreshSecureKeySetup(); await h.inspect(); await h.ctx.approveSecureKeyEnrollment();
        expect(h.state()).toMatchObject({ mode: 'active', revision: 3 });
        expect(h.commands.filter(command => command.action !== 'inspect').map(command => command.action)).toEqual(['configure', 'enroll', 'cutover']);
        expect(h.store.setJSON).toHaveBeenCalledTimes(3);
    });
    it.each(['session', 'close', 'reopen'])('លទ្ធផលអនុម័តយឺតមិនបន្តបន្ទាប់ពី %s', async reason => {
        const h = await harness(); await h.ctx.openSecureKeySetup(id); await h.inspect();
        h.pause('enroll'); const pending = h.ctx.approveSecureKeyEnrollment();
        await vi.waitFor(() => expect(h.pending()).toBe(true));
        expect(h.state().revision).toBe(2);
        if (reason === 'session') h.setCurrent(false);
        else h.ctx.clearSecureKeySetup();
        if (reason === 'reopen') await h.ctx.openSecureKeySetup(id);
        const status = h.element('secureKeySetupStatus').textContent;
        h.release(); await pending;
        expect(h.commands.some(command => command.action === 'cutover')).toBe(false);
        expect(h.element('secureKeySetupStatus').textContent).toBe(status);
        expect(h.ctx.refreshKeyList).not.toHaveBeenCalled();
    });
    it('ដោះឧបករណ៍ក្រោយចុះឈ្មោះ មិនបើកសិទ្ធិដោយភស្តុតាងចាស់', async () => {
        const h = await harness(); await h.ctx.openSecureKeySetup(id); await h.inspect();
        h.pause('enroll'); const pending = h.ctx.approveSecureKeyEnrollment();
        await vi.waitFor(() => expect(h.pending()).toBe(true));
        h.setState({ ...h.state(), revision: 3, releaseEpoch: 1, seats: {} });
        h.release(); await pending;
        expect(h.state()).toMatchObject({ mode: 'staged', releaseEpoch: 1, seats: {} });
        expect(h.commands.some(command => command.action === 'cutover')).toBe(false);
        expect(h.element('secureKeySetupStatus').textContent).not.toContain('Server សកម្ម');
    });
    it('មិនបង្ហាញសោចេញដោយគ្មាន marker 2 ឬសម័យបច្ចុប្បន្ន', async () => {
        const h = await harness(); const context = h.ctx.seatSellerContext();
        h.records[`license_keys/ZOE/${id}`].seatProtocol = 1;
        await expect(h.ctx.publishSecureGeneratedKey(context, id, 'credential')).rejects.toThrow('seat-marker-unverified');
        expect(h.element('genResultKey').textContent).toBe('');
        h.records[`license_keys/ZOE/${id}`].seatProtocol = 2; h.setCurrent(false);
        await expect(h.ctx.publishSecureGeneratedKey(context, id, 'credential')).rejects.toThrow('seat-session-changed');
        expect(h.element('genResultKey').textContent).toBe('');
    });
});

describe('ប៊ូតុង Generate Key និងកំណត់ត្រាដែលបិទសិទ្ធិជាមុន', () => {
    it('សរសេរ marker សុវត្ថិភាពនិង metadata ក្នុង atomic update តែមួយ មុនបង្ហាញសោ', async () => {
        const h = await harness(); await h.ctx.generateLicenseKey();
        expect(h.writes).toHaveLength(1);
        const paths = Object.keys(h.writes[0]); expect(paths).toHaveLength(2);
        const rowPath = paths.find(path => path.startsWith('license_keys/'))!;
        const keyId = rowPath.split('/').at(-1);
        expect(h.writes[0][rowPath]).toEqual({ seatProtocol: 2, maxDevices: 1, revoked: false, expiresAt: now + 86400000 });
        expect(h.writes[0][`license_keys_meta/ZOE/${keyId}`]).toEqual({ issuedAt: now, scope: 'ZOE', secureIssued: true, createdBy: 'seller', note: '' });
        expect(h.element('genResultKey').textContent).toContain(h.ctx.window.ZoeLicense.KEY_PREFIX);
        expect(h.element('secureKeySetupKey').value).toBe(h.element('genResultKey').textContent);
        expect(h.state()).toMatchObject({ mode: 'staged', seats: {} });
    });
    it('ការសរសេរបរាជ័យមិនបង្ហាញសោ ឬបើកការចុះឈ្មោះ', async () => {
        const h = await harness(); h.ctx.fb.update.mockRejectedValue(new Error('PERMISSION_DENIED'));
        await h.ctx.generateLicenseKey();
        expect(h.element('genResultKey').textContent).toBe(''); expect(h.state()).toBeNull();
        expect(h.ctx.openModalHelper).not.toHaveBeenCalled(); expect(h.ctx.alert).toHaveBeenCalled();
    });
    it('សរសេរចុះហើយតែអាន marker មិនបាន មិនបង្ហាញសោមុនបញ្ជាក់', async () => {
        const h = await harness(); const fetch = h.ctx.fetchWithTimeout;
        h.ctx.fetchWithTimeout = async (url: string, ...args: any[]) => {
            if (url.includes('firebaseio')) throw new Error('offline read');
            return fetch(url, ...args);
        };
        await h.ctx.generateLicenseKey();
        expect(h.writes).toHaveLength(1); expect(h.element('genResultKey').textContent).toBe('');
        expect(h.state()).toBeNull(); expect(h.ctx.alert).toHaveBeenCalled();
    });
});

it.each(['close', 'reopen', 'session'])('ការអាន metadata ចាស់មិនបង្ហាញសោក្រោយ %s', async reason => {
    const h = await harness();
    let release!: (snapshot: any) => void;
    h.ctx.fb.get.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    const opening = h.ctx.openSecureKeySetup(id);
    await vi.waitFor(() => expect(h.ctx.fb.get).toHaveBeenCalledOnce());
    if (reason === 'session') h.setCurrent(false);
    else h.ctx.clearSecureKeySetup();
    if (reason === 'reopen') await h.ctx.openSecureKeySetup(id);
    const before = h.element('secureKeySetupKey').value;
    const writes = h.store.setJSON.mock.calls.length;
    release({ val: () => h.records[`license_keys_meta/ZOE/${id}`] }); await opening;
    expect(h.element('secureKeySetupKey').value).toBe(before);
    expect(h.store.setJSON).toHaveBeenCalledTimes(writes);
});

it('ការយល់ព្រមដែលបិទប្រអប់មិនចុះឈ្មោះពីសម័យចាស់', async () => {
    const h = await harness(); await h.ctx.openSecureKeySetup(id); await h.inspect();
    h.ctx.confirm.mockImplementation(() => { h.ctx.clearSecureKeySetup(); return true; });
    await h.ctx.approveSecureKeyEnrollment();
    expect(h.state().seats).toEqual({}); expect(h.store.setJSON).toHaveBeenCalledOnce();
});

describe('កិច្ចសន្យា markup និងការបិទប្រអប់ដោយ DOM fixture', () => {
    it('ភ្ជាប់ប៊ូតុងតាម allowlist និងបិទការអនុម័តជាមុន', () => {
        const html = readFileSync(resolve(root, 'ZoeKeyGen/index.html'), 'utf8');
        const modal = html.slice(html.indexOf('<div id="secureKeySetupModal"'), html.indexOf('<div id="secureKeySetupModal"') + 3000);
        const allowlist = JSON.parse(source.slice(source.indexOf('const ACTION_ALLOWLIST = [') + 'const ACTION_ALLOWLIST = '.length, source.indexOf('];', source.indexOf('const ACTION_ALLOWLIST = [')) + 1));
        for (const action of ['inspectSecureKeyEnrollment', 'approveSecureKeyEnrollment', 'refreshSecureKeySetup']) {
            expect(modal).toContain(`data-act="${action}"`); expect(allowlist).toContain(action);
        }
        expect(modal).toMatch(/<textarea[^>]*id="secureKeySetupKey"[^>]*readonly/);
        expect(modal).toMatch(/<textarea[^>]*id="secureKeyEnrollmentInput"[^>]*maxlength="8192"/);
        expect(modal).toMatch(/<button[^>]*id="secureKeyApproveBtn"[^>]*disabled/);
        expect(modal).toContain('data-args=\'["secureKeySetupModal"]\'');
        expect(modal).toMatch(/id="secureKeySetupStatus"[^>]*aria-live="polite"/);
    });
    it('closeModal ពិតសម្អាតសោ សំណើ និងស្នាមសោ ហើយមិនអនុម័តក្រោយបិទ', async () => {
        const h = await harness(); await h.ctx.openSecureKeySetup(id); await h.inspect();
        expect(h.element('secureKeySetupKey').value).not.toBe('');
        expect(h.element('secureKeyEnrollmentInput').value).not.toBe('');
        expect(h.element('secureKeyFingerprint').textContent).not.toBe('');
        Object.assign(h.ctx.document, { documentElement: h.element('documentRoot'), querySelectorAll: () => [] });
        vm.runInContext(source.slice(source.indexOf('function closeModal(id)'), source.indexOf('function setupModalFocusTrap()')), h.ctx);
        h.ctx.closeModal('secureKeySetupModal');
        for (const name of ['secureKeySetupKey', 'secureKeyEnrollmentInput']) expect(h.element(name).value).toBe('');
        for (const name of ['secureKeyFingerprint', 'secureKeySetupStatus', 'secureKeySetupId']) expect(h.element(name).textContent).toBe('');
        expect(h.element('secureKeyApproveBtn').disabled).toBe(true);
        const count = h.commands.length; await h.ctx.approveSecureKeyEnrollment(); expect(h.commands).toHaveLength(count);
    });
});

describe('បន្តសោនិងគ្រប់គ្រងមុនអនុម័តឧបករណ៍', () => {
    it('បាត់លទ្ធផលក្នុងសម័យមុន ចុះហត្ថលេខាឡើងវិញដោយរក្សា claims ដើម', async () => {
        const h = await harness(); await h.ctx.generateLicenseKey();
        const original = h.element('genResultKey').textContent;
        const parsed = h.ctx.window.ZoeLicense.parseKeyString(original);
        const claims = JSON.parse(Buffer.from(parsed.payloadB64, 'base64url').toString());
        h.ctx.clearGeneratedKeyResult(); h.ctx.clearSecureKeySetup();
        await h.ctx.openSecureKeySetup(claims.id);
        const resumed = h.ctx.window.ZoeLicense.parseKeyString(h.element('secureKeySetupKey').value);
        expect(resumed.payloadB64).toBe(parsed.payloadB64);
        const signature = h.element('secureKeySetupKey').value.split('.').at(-1);
        expect(await webcrypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, h.seller.pair.publicKey,
            Buffer.from(signature, 'base64url'), Buffer.from(resumed.payloadB64))).toBe(true);
        expect(h.writes).toHaveLength(1);
        expect(h.commands.filter(command => command.action === 'configure')).toHaveLength(1);
    });
    it.each(['revoke', 'extend', 'release', 'devices'])('revision 0 រារាំង %s និងណែនាំរៀបចំសិន', async action => {
        const h = await harness();
        expect(await h.ctx.routeSecureSeatLifecycle(id, action, 1)).toBe(true);
        expect(h.state()).toBeNull(); expect(h.store.setJSON).not.toHaveBeenCalled();
        expect(h.commands.map(command => command.action)).toEqual(['inspect']);
        expect(h.ctx.alert).toHaveBeenCalledWith(expect.stringContaining('បញ្ចប់ការត្រៀម Server'));
        expect(h.ctx.confirm).not.toHaveBeenCalled(); expect(h.ctx.showToast).not.toHaveBeenCalled();
    });
    it.each(['revoke', 'extend'])('staged ដែលត្រៀមរួចទទួល %s ហើយបើកឡើងវិញរក្សាលទ្ធផល', async action => {
        const h = await harness(); await h.ctx.openSecureKeySetup(id);
        expect(h.state()).toMatchObject({ revision: 1, mode: 'staged' });
        expect(await h.ctx.routeSecureSeatLifecycle(id, action, 2)).toBe(true);
        const changed = h.state();
        expect(changed).toMatchObject({ mode: 'staged', revision: 2, seats: {}, revoked: action === 'revoke',
            licenseExpiresAt: now + (action === 'extend' ? 3 : 1) * 86400000 });
        expect(h.ctx.showToast).toHaveBeenCalledOnce(); expect(h.ctx.alert).not.toHaveBeenCalled();
        await h.ctx.openSecureKeySetup(id);
        expect(h.state()).toEqual(changed); expect(h.store.setJSON).toHaveBeenCalledTimes(2);
    });
});
