import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import vm from 'node:vm';

const source = readFileSync('../ZoeKeyGen/app.js', 'utf8');
const functions = source.slice(source.indexOf('async function licenseInvitationCommand'), source.indexOf('async function publishSecureGeneratedKey'));
describe('ការអញ្ជើញអ្នកលក់', () => {
    it('ចុះហត្ថលេខាលើវិសាលភាព និងបញ្ឈប់ពេលប្ដូរសម័យ', async () => {
        const pair = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
        const privateKey = await webcrypto.subtle.exportKey('jwk', pair.privateKey);
        const sent: Array<{ payload: string; signature: string }> = [];
        let current = true;
        const context = vm.createContext({
            crypto: webcrypto, TextEncoder, TextDecoder, Uint8Array,
            captureKeygenClock: () => ({ now: 100000 }),
            keygenClockIsCurrent: () => true, getTrustedServerNow: () => 100000,
            secureKeySetupCurrent: () => current, signingPrivateKeyJwk: privateKey,
            seatSellerEncode: (bytes: Uint8Array) => Buffer.from(bytes).toString('base64url'),
            fetchWithTimeout: async (_url: string, options: {body: string}) => {
                sent.push(JSON.parse(options.body)); return { res: { ok: true }, body: { revision: 2 } };
            }
        });
        vm.runInContext(functions, context);
        const setup = { id: 'ABCDEFGHIJKLMNOP', context: { privateKey } };
        await context.licenseInvitationCommand(setup, 'cancel', { inviteId: 'ABCDEFGHIJKLMNOP.0123456789ABCDEF', revision: 1, releaseEpoch: 0 });
        const command = JSON.parse(Buffer.from(sent[0].payload, 'base64url').toString());
        expect(command).toMatchObject({domain: 'zoe-license-invitation-v1', app: 'ZOE', keyId: setup.id, action: 'cancel', revision: 1, expiresAt: 145000});
        expect(await webcrypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pair.publicKey, Buffer.from(sent[0].signature, 'base64url'), new TextEncoder().encode(sent[0].payload))).toBe(true);
        current = false;
        await expect(context.licenseInvitationCommand(setup, 'approve', {})).rejects.toThrow();
        expect(sent).toHaveLength(1);
    });
    it('បិទផ្ទាំងលុបកូដ និងប៊ូតុងសំណើ', () => {
        const elements = new Map<string, {value: string; textContent: string; disabled: boolean; replaceChildren: () => void}>();
        let cleared = false;
        for (const id of ['licenseInvitationQueue', 'licenseInvitationReference', 'secureKeyEnrollmentInput', 'secureKeySetupKey', 'secureKeyFingerprint', 'secureKeySetupStatus', 'secureKeySetupId', 'secureKeyApproveBtn']) {
            elements.set(id, {value: 'secret', textContent: 'secret', disabled: false, replaceChildren: () => { cleared = true; }});
        }
        const context = vm.createContext({document: { getElementById: (id: string) => elements.get(id) }});
        vm.runInContext(source.slice(source.indexOf('let secureKeySetup = null;'), source.indexOf('async function licenseInvitationCommand')), context);
        context.clearSecureKeySetup();
        expect(cleared).toBe(true);
        expect(elements.get('licenseInvitationReference')?.value).toBe('');
        expect(elements.get('secureKeyApproveBtn')?.disabled).toBe(true);
    });
});

function harness() {
    let current = true;
    const elements = new Map<string, any>();
    const element = () => ({ value: '', textContent: '', children: [] as any[], append(...nodes: any[]) { this.children.push(...nodes); }, replaceChildren() { this.children = []; } });
    const document = {
        getElementById(id: string) { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); },
        createElement: element
    };
    document.getElementById('licenseInvitationTarget').value = 'pwa';
    document.getElementById('licenseInvitationHours').value = '24';
    document.getElementById('secureKeySetupKey').value = 'signed-secret';
    const setup: any = { id: 'ABCDEFGHIJKLMNOP', busy: false, context: {} };
    const messages: string[] = [];
    const calls: any[] = [];
    const list: any = { revision: 7, releaseEpoch: 0, receiptKeyFingerprint: 'receipt', invitations: [] };
    const context = vm.createContext({
        crypto: webcrypto, TextEncoder, TextDecoder, Uint8Array, BigInt, atob,
        document, secureKeySetup: setup, secureKeySetupCurrent: (s: any) => s === setup && current,
        getTrustedServerNow: () => 100000,
        secureKeySetupInspect: async () => ({ state: { licenseExpiresAt: 999999999 } }),
        secureKeyReceiptReady: async () => {},
        secureKeySetupMessage: (_s: any, text: string) => messages.push(text),
        confirm: () => true
    });
    vm.runInContext(functions, context);
    context.licenseInvitationCommand = async (_s: any, action: string, fields: any) => { calls.push({action, ...fields}); return list; };
    return { context, setup, calls, list, elements, messages, changeSession: () => { current = false; } };
}

describe('ស្ថានភាពសំណើអ្នកលក់', () => {
    it('រក្សាកូដដដែលពេលបាត់ចម្លើយ ហើយអាន Server មុនបង្កើតម្ដងទៀត', async () => {
        const h = harness();
        let creates = 0;
        h.context.licenseInvitationCommand = async (_s: any, action: string, fields: any) => {
            if (action === 'list') return h.list;
            creates++;
            expect(fields).toMatchObject({ target: 'pwa', invitationExpiresAt: 86440000, revision: 7, releaseEpoch: 0, keyString: 'signed-secret' });
            expect(fields.inviteId).toMatch(/^ABCDEFGHIJKLMNOP\.[0-9A-HJKMNP-TV-Z]{16}$/);
            h.list.invitations.push({ inviteId: fields.inviteId, target: fields.target, status: 'open', requests: [] });
            throw new Error('lost-response');
        };
        await h.context.createLicenseInvitation();
        const id = h.setup.invitationDraft.inviteId;
        expect(h.setup.invitationReference).toBeUndefined();
        expect(h.setup.busy).toBe(false);
        await h.context.createLicenseInvitation();
        expect(creates).toBe(1);
        expect(h.setup.invitationReference.id).toBe(id);
    });

    it.each(['reject', 'cancel'])('ផ្ញើសកម្មភាព %s ជាមួយ revision ថ្មី', async action => {
        const h = harness();
        const request = { requestId: 'hash', enrollmentHash: 'hash', fingerprint: 'fp', verificationCode: '12345678', status: 'pending' };
        const invite = { inviteId: 'ABCDEFGHIJKLMNOP.0123456789ABCDEF', status: 'open', target: 'apk', requests: [request] };
        h.list.invitations.push(invite);
        h.context.verifyLicenseInvitationRequest = async () => '12345678';
        await h.context.actLicenseInvitation(h.setup, invite, action, action === 'reject' ? request : undefined);
        expect(h.calls.find(c => c.action === action)).toMatchObject({ inviteId: invite.inviteId, revision: 7, releaseEpoch: 0 });
        expect(h.setup.busy).toBe(false);
    });

    it('អនុម័តសំណើជាក់លាក់ ប៉ុន្តែមិនផ្ញើពេលម្ចាស់បដិសេធ', async () => {
        const h = harness();
        const request = { requestId: 'hash', enrollmentHash: 'hash', fingerprint: 'fp', verificationCode: '12345678', status: 'pending' };
        const invite = { inviteId: 'ABCDEFGHIJKLMNOP.0123456789ABCDEF', status: 'open', target: 'pwa', requests: [request] };
        h.list.invitations.push(invite);
        h.context.verifyLicenseInvitationRequest = async () => '12345678';
        h.context.confirm = () => false;
        await h.context.actLicenseInvitation(h.setup, invite, 'approve', request);
        expect(h.calls.filter(c => c.action === 'approve')).toHaveLength(0);
        h.context.confirm = () => true;
        await h.context.actLicenseInvitation(h.setup, invite, 'approve', request);
        expect(h.calls.find(c => c.action === 'approve')).toMatchObject({ requestId: 'hash', fingerprint: 'fp', enrollmentHash: 'hash', revision: 7, releaseEpoch: 0, receiptKeyFingerprint: 'receipt' });
    });

    it('ការបរាជ័យមិនអនុម័តឡើងវិញដោយស្វ័យប្រវត្តិ', async () => {
        const h = harness();
        const request = { requestId: 'hash', enrollmentHash: 'hash', fingerprint: 'fp', verificationCode: '12345678', status: 'pending' };
        const invite = { inviteId: 'ABCDEFGHIJKLMNOP.0123456789ABCDEF', status: 'open', target: 'pwa', requests: [request] };
        h.list.invitations.push(invite);
        h.context.verifyLicenseInvitationRequest = async () => '12345678';
        h.context.licenseInvitationCommand = async (_s: any, action: string) => {
            h.calls.push({ action });
            if (action === 'approve') throw new Error('409');
            return h.list;
        };
        await h.context.actLicenseInvitation(h.setup, invite, 'approve', request);
        expect(h.calls.filter(c => c.action === 'approve')).toHaveLength(1);
        expect(h.messages.at(-1)).toContain('មិនទាន់ច្បាស់');
        expect(h.setup.busy).toBe(false);
    });

    it('សំណើគ្មានភស្តុតាងមិនបង្ហាញប៊ូតុងអនុម័ត', async () => {
        const h = harness();
        h.list.invitations.push({ inviteId: 'ABCDEFGHIJKLMNOP.0123456789ABCDEF', status: 'open', target: 'pwa', cipher: 'secret-cipher', requests: [{ status: 'pending', enrollment: { payload: 'secret-json' } }] });
        await expect(h.context.licenseInvitationList(h.setup)).rejects.toThrow();
        expect(h.elements.get('licenseInvitationQueue').children).toHaveLength(0);
    });

    it('សម័យផ្លាស់ប្ដូរក្នុងពេលបញ្ជាក់មិនផ្ញើសកម្មភាព', async () => {
        const h = harness();
        const invite = { inviteId: 'ABCDEFGHIJKLMNOP.0123456789ABCDEF', status: 'open', target: 'pwa', requests: [] };
        h.list.invitations.push(invite);
        h.context.confirm = () => { h.changeSession(); return true; };
        await h.context.actLicenseInvitation(h.setup, invite, 'cancel');
        expect(h.calls.filter(c => c.action === 'cancel')).toHaveLength(0);
    });

    it('អានការអញ្ជើញដែលមានស្រាប់ដោយមិនបង្ហាញសោ ឬ JSON', async () => {
        const h = harness();
        h.list.invitations.push({ inviteId: 'ABCDEFGHIJKLMNOP.0123456789ABCDEF', status: 'open', target: 'apk', cipher: 'secret-cipher', requests: [] });
        await h.context.refreshLicenseInvitations();
        const rendered = JSON.stringify(h.elements.get('licenseInvitationQueue'));
        expect(rendered).toContain('ABCDEFGHIJKLMNOP.0123456789ABCDEF');
        expect(rendered).not.toContain('secret-cipher');
        expect(rendered).not.toContain('signed-secret');
        expect(h.calls.every(c => c.action === 'list')).toBe(true);
    });
});

it('ផ្ទៀងហត្ថលេខា hash និងលេខសំណើពិត ហើយបដិសេធការកែប្រែ', async () => {
    const h = harness();
    const pair = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    const publicKey = await webcrypto.subtle.exportKey('jwk', pair.publicKey);
    const invite = { inviteId: 'ABCDEFGHIJKLMNOP.0123456789ABCDEF', target: 'pwa' };
    const payload = Buffer.from(JSON.stringify({ domain: 'zoe-license-enrollment-v1', audience: 'https://zoew.netlify.app', app: 'ZOE', keyId: h.setup.id, inviteId: invite.inviteId, target: 'pwa', publicKey })).toString('base64url');
    const signature = Buffer.from(await webcrypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, pair.privateKey, new TextEncoder().encode(payload))).toString('base64url');
    const enrollment = {payload, signature};
    const hash = Buffer.from(await webcrypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(enrollment)))).toString('hex');
    const code = String(BigInt('0x' + hash) % 100000000n).padStart(8, '0');
    h.context.window = { ZoeSeatClient: { fingerprint: async () => 'verified-fingerprint' } };
    const request = { enrollment, requestId: hash, enrollmentHash: hash, fingerprint: 'verified-fingerprint', verificationCode: code };
    expect(await h.context.verifyLicenseInvitationRequest(h.setup, invite, request)).toBe(code);
    for (const change of [{ enrollmentHash: 'bad' }, { requestId: 'bad' }, { fingerprint: 'bad' }, { verificationCode: 'bad' }, { enrollment: { payload, signature: signature.slice(1) } }]) {
        await expect(h.context.verifyLicenseInvitationRequest(h.setup, invite, { ...request, ...change })).rejects.toThrow();
    }
    await expect(h.context.verifyLicenseInvitationRequest(h.setup, { ...invite, target: 'apk' }, request)).rejects.toThrow();
    h.changeSession();
    await expect(h.context.verifyLicenseInvitationRequest(h.setup, invite, request)).rejects.toThrow();
});

it('បង្កើតការអញ្ជើញថ្មីក្រោយបានបញ្ជាក់ការអញ្ជើញមុន', async () => {
    const h = harness();
    h.context.licenseInvitationCommand = async (_s: any, action: string, fields: any) => {
        if (action === 'create') {
            h.calls.push(fields);
            h.list.invitations.push({ inviteId: fields.inviteId, target: fields.target, status: 'open', requests: [] });
        }
        return h.list;
    };
    await h.context.createLicenseInvitation();
    expect(h.setup.invitationDraft).toBeNull();
    h.elements.get('licenseInvitationTarget').value = 'apk';
    h.elements.get('licenseInvitationHours').value = '2';
    await h.context.createLicenseInvitation();
    expect(h.calls).toHaveLength(2);
    expect(h.calls[0].inviteId).not.toBe(h.calls[1].inviteId);
    expect(h.calls[1]).toMatchObject({ target: 'apk', invitationExpiresAt: 7240000 });
});
