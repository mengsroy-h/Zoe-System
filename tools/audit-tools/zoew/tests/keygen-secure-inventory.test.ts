import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const root = process.env.KEYGEN_INVENTORY_APP_DIR || resolve(__dirname, '../../../..');
const source = readFileSync(resolve(root, 'ZoeKeyGen/app.js'), 'utf8');
const html = readFileSync(resolve(root, 'ZoeKeyGen/index.html'), 'utf8');
const css = readFileSync(resolve(root, 'ZoeKeyGen/style.css'), 'utf8');
const start = source.indexOf('async function secureSeatInventoryRows(');
const end = source.indexOf('async function licenseInvitationCommand(', start);
const keyId = 'ABCDEFGHIJKLMNOP';
function mount() { document.body.innerHTML = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<link\b[^>]*>/gi, ''); }

async function harness() {
    mount();
    const ctx: any = { document, TextEncoder, TextDecoder, Uint8Array, crypto: webcrypto, btoa, atob, setTimeout, clearTimeout };
    ctx.window = ctx;
    vm.createContext(ctx);
    vm.runInContext(readFileSync(resolve(root, 'ZoeW/public/license-seat-client.js'), 'utf8'), ctx);
    vm.runInContext(source.slice(start, end), ctx);
    vm.runInContext('const MODAL_BASE_Z = 1000;\n' + source.slice(source.indexOf('function openModalHelper('), source.indexOf('function setupModalFocusTrap(')), ctx);
    let current = true;
    const pair = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    const publicKey = await webcrypto.subtle.exportKey('jwk', pair.publicKey);
    const state = { revision: 4, mode: 'active', maxDevices: 3, revoked: false, seats: { d1: { publicKey } } };
    ctx.seatSellerContext = () => ({ privateKey: {}, current: () => current });
    ctx.seatSellerRow = vi.fn(async () => ({ seatProtocol: 2, maxDevices: 1 }));
    ctx.seatSellerInspect = vi.fn(async () => ({ state }));
    return { ctx, state, publicKey, changeSession: () => { current = false; } };
}

beforeEach(() => { document.body.replaceChildren(); });

describe('បញ្ជីឧបករណ៍សុវត្ថិភាពរបស់អ្នកលក់', () => {
    it('បង្ហាញ ID ពីស្នាមសោ និងចំនួនពិតពី Server ទោះ marker មានចំនួនផ្សេង', async () => {
        const h = await harness();
        await h.ctx.openSecureSeatInventory(keyId);
        const fingerprint = await h.ctx.ZoeSeatClient.fingerprint(h.publicKey);
        expect(document.querySelector('.secure-seat-count')?.textContent).toContain('1/3');
        expect(document.querySelector('.secure-seat-card h4')?.textContent).toContain('d1 · ID ' + fingerprint.slice(0, 16).match(/.{4}/g)!.join('-'));
        expect(document.querySelector('.secure-seat-card .secure-seat-fingerprint')?.textContent).toBe(fingerprint);
        expect(document.getElementById('secureSeatInventoryList')?.textContent).not.toContain(h.publicKey.x);
        expect(document.querySelector('.secure-seat-card')?.textContent).toContain('មិនទាន់មានព័ត៌មាន');
        expect(h.ctx.seatSellerInspect).toHaveBeenCalledOnce();
    });
    it('បង្ហាញម៉ូដែលនិងប្រព័ន្ធជាអក្សរ មានពិដាន និងមិនយក Serial', async () => {
        const h = await harness();
        Object.assign(h.state.seats.d1, { display: { model: '<b>Pixel</b>', platform: 'Android'.repeat(20), serial: 'PRIVATE-SERIAL' } });
        await h.ctx.openSecureSeatInventory(keyId);
        const card = document.querySelector('.secure-seat-card')!;
        expect(card.querySelector('b')).toBeNull();
        expect(card.textContent).toContain('<b>Pixel</b>');
        expect(card.textContent).not.toContain('PRIVATE-SERIAL');
        expect((await h.ctx.secureSeatInventoryRows(h.state))[0].platform.length).toBe(40);
    });
    it('តម្រៀបតាម slot និងបង្ហាញបញ្ជីទទេតាមស្ថានភាពដែលផ្ទៀងបាន', async () => {
        const h = await harness();
        const pair = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
        const second = await webcrypto.subtle.exportKey('jwk', pair.publicKey);
        (h.state as any).seats = { d3: { publicKey: second }, d1: { publicKey: h.publicKey } };
        await h.ctx.openSecureSeatInventory(keyId);
        expect(Array.from(document.querySelectorAll('.secure-seat-card h4')).map(el => el.textContent!.slice(0, 2))).toEqual(['d1', 'd3']);
        (h.state as any).seats = {};
        await h.ctx.refreshSecureSeatInventory();
        expect(document.querySelector('.secure-seat-count')?.textContent).toContain('0/3');
        expect(document.querySelectorAll('.secure-seat-card')).toHaveLength(0);
    });
    it('បិទផ្ទាំងពេលសំណើរង់ចាំ ហើយចម្លើយយឺតមិនបង្ហាញវិញ', async () => {
        const h = await harness();
        let finish!: (value: any) => void;
        h.ctx.seatSellerInspect = vi.fn(() => new Promise(resolve => { finish = resolve; }));
        const pending = h.ctx.openSecureSeatInventory(keyId);
        await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
        h.ctx.closeModal('secureSeatInventoryModal');
        finish({ state: h.state }); await pending;
        expect(document.getElementById('secureSeatInventoryList')?.textContent).toBe('');
        expect(document.getElementById('secureSeatInventoryId')?.textContent).toBe('');
        expect(document.getElementById('secureSeatInventoryModal')?.classList.contains('active')).toBe(false);
    });
    it('មិនផ្ញើសំណើត្រួតគ្នាពេលចុចម្ដងទៀត ហើយសម្អាតពេលសម័យប្ដូរ', async () => {
        const h = await harness();
        let finish!: (value: any) => void;
        h.ctx.seatSellerInspect = vi.fn(() => new Promise(resolve => { finish = resolve; }));
        const pending = h.ctx.openSecureSeatInventory(keyId);
        await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
        await h.ctx.openSecureSeatInventory(keyId);
        await h.ctx.refreshSecureSeatInventory();
        expect(h.ctx.seatSellerInspect).toHaveBeenCalledOnce();
        h.changeSession(); h.ctx.clearSecureKeySetup();
        finish({ state: h.state }); await pending;
        expect(document.getElementById('secureSeatInventoryList')?.textContent).toBe('');
        expect(document.getElementById('secureSeatInventoryId')?.textContent).toBe('');
    });
    it('បញ្ជីខុសទ្រង់ទ្រាយឬ Server មិនឆ្លើយ មិនបង្ហាញថាទំនេរឬជោគជ័យ', async () => {
        const h = await harness();
        h.state.maxDevices = 0;
        await h.ctx.openSecureSeatInventory(keyId);
        expect(document.querySelector('.secure-seat-count')).toBeNull();
        expect(document.getElementById('secureSeatInventoryStatus')?.textContent).toContain('មិនអាចផ្ទៀង');
        h.state.maxDevices = 3;
        (h.state as any).seats = { d1: null };
        await h.ctx.refreshSecureSeatInventory();
        expect(document.querySelector('.secure-seat-count')).toBeNull();
        h.ctx.seatSellerInspect.mockRejectedValue(Error('offline'));
        await h.ctx.refreshSecureSeatInventory();
        expect(document.querySelector('.secure-seat-count')).toBeNull();
        expect((document.getElementById('secureSeatInventoryRefresh') as HTMLButtonElement).disabled).toBe(false);
    });
    it('មិនប្រើបញ្ជី Firebase សម្រាប់ marker ចាស់ និងបង្ហាញស្ថានភាពមិនទាន់ត្រៀម', async () => {
        const h = await harness();
        h.ctx.seatSellerRow.mockResolvedValue({ seatProtocol: 1 });
        await h.ctx.openSecureSeatInventory(keyId);
        expect(h.ctx.seatSellerInspect).not.toHaveBeenCalled();
        h.ctx.seatSellerRow.mockResolvedValue({ seatProtocol: 2 });
        h.ctx.seatSellerInspect.mockResolvedValue({ state: { revision: 0, seats: {} } });
        await h.ctx.refreshSecureSeatInventory();
        expect(document.getElementById('secureSeatInventoryStatus')?.textContent).toContain('មិនទាន់បានត្រៀម');
        expect(document.querySelector('.secure-seat-count')).toBeNull();
    });
    it('មុខងារថ្មីអានពីគ្រប់គ្រងសោដោយមិនផ្លាស់ប្ដូរសិទ្ធិ', async () => {
        mount();
        const ctx = vm.createContext({ document });
        vm.runInContext(source.slice(source.indexOf('function renderKeyList('), source.indexOf('function seatSellerContext(')), ctx);
        Object.assign(ctx, { keyListCache: [{ id: keyId, paths: ['ZOE'], perApp: { ZOE: { seatProtocol: 2 } }, scope: 'ZOE', seatDevices: [] }], getServerNow: () => 1, APP_LABELS: { ZOE: 'ZoeW' }, escapeHtml: (text: string) => text });
        ctx.renderKeyList();
        expect(document.querySelector('[data-action="secure-inventory"]')?.getAttribute('data-key-id')).toBe(keyId);
        expect(document.querySelector('[data-act="openSetupSeatInventory"]')).not.toBeNull();
    });
});

describe('ពណ៌ និងចន្លោះប៊ូតុង KeyGen', () => {
    it('បែងចែកអនុម័ត ពិនិត្យ បង្កើត និងបិទ ហើយព័ត៌មានបន្ថែមមានចន្លោះ', async () => {
        mount();
        const style = document.createElement('style'); style.textContent = css; document.head.append(style);
        expect(document.getElementById('secureKeyApproveBtn')?.classList.contains('seat-action-success')).toBe(true);
        expect(document.querySelector('[data-act="inspectSecureKeyEnrollment"]')?.classList.contains('seat-action-info')).toBe(true);
        expect(document.querySelector('[data-act="createLicenseInvitation"]')?.classList.contains('btn-primary')).toBe(true);
        const options = document.querySelector('.secure-key-options')!;
        expect(window.getComputedStyle(options).marginTop).toBe('18px');
        expect(window.getComputedStyle(options.querySelector('summary')!).minHeight).toBe('44px');
        expect(options.hasAttribute('open')).toBe(false);
        expect(document.querySelector('#secureKeySetupModal .btn-cancel')?.classList.contains('seat-action-neutral')).toBe(true);
        style.remove();
    });
    it('ប៊ូតុងសំណើអញ្ជើញប្រើបៃតងសម្រាប់អនុម័ត និងក្រហមសម្រាប់បោះបង់', async () => {
        const h = await harness();
        vm.runInContext(source.slice(source.indexOf('async function licenseInvitationCommand('), source.indexOf('async function publishSecureGeneratedKey(')), h.ctx);
        const setup = {};
        h.ctx.secureKeySetupCurrent = () => true;
        h.ctx.secureKeyReceiptReady = async () => {};
        h.ctx.verifyLicenseInvitationRequest = async () => '12345678';
        h.ctx.licenseInvitationCommand = async () => ({ revision: 1, invitations: [{ target: 'pwa', inviteId: keyId + '.0123456789ABCDEF', status: 'open', requests: [{ status: 'pending', verificationCode: '12345678' }] }] });
        await h.ctx.licenseInvitationList(setup);
        const buttons = Array.from(document.querySelectorAll('#licenseInvitationQueue button'));
        expect(buttons).toHaveLength(4);
        expect(buttons.map(button => button.classList.contains('seat-action-info'))).toEqual([true, false, false, false]);
        expect(buttons.map(button => button.classList.contains('seat-action-danger'))).toEqual([false, true, false, true]);
        expect(buttons[2].classList.contains('seat-action-success')).toBe(true);
    });

});
