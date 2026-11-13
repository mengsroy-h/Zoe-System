import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { firebaseState, securityState, uiState } from '../../../../ZoeW/src/core/state';
import { viewState } from '../../../../ZoeW/src/core/view-state';
import { appLocalStore } from '../../../../ZoeW/src/core/storage';
import * as invitation from '../../../../ZoeW/src/features/license-invitations';
import { clearSensitiveModalFields } from '../../../../ZoeW/src/features/session';
import { proceedAfterLogin } from '../../../../ZoeW/src/features/license';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { ActivationModal } from '../../../../ZoeW/src/app/components/modals/ActivationModal';
vi.mock('../../../../ZoeW/src/features/license', async importOriginal => ({ ...await importOriginal<any>(), proceedAfterLogin: vi.fn(async () => true) }));
const native = vi.hoisted(() => ({ android: false, native: false }));
vi.mock('../../../../ZoeW/src/platform/native', () => ({ isNativeAndroid: () => native.android, isNativeApp: () => native.native }));
const code = 'ABCDEFGHIJKLMNOP.0123456789ABCDEF';
const enrollment = { payload: 'original-signed-payload', signature: 'original-signature', fingerprint: 'a'.repeat(64) };
const requestId = createHash('sha256').update(JSON.stringify({ payload: enrollment.payload, signature: enrollment.signature })).digest('hex');
const verificationCode = String(BigInt('0x' + requestId) % 100000000n).padStart(8, '0');
let standalone = true;
let seat: any;
let requests: any[];
let response: (body: any) => any;
beforeEach(() => {
    invitation.cancelLicenseInvitation(); invitation.clearLicenseInvitationIntent(); securityState.appIsLocked = false; securityState.pinTargetAction = null; appLocalStore.clear(); vi.clearAllMocks();
    firebaseState.auth = { currentUser: { uid: 'test-user' } } as any;
    firebaseState.authGeneration++; firebaseState.db = {} as any;
    viewState.backendKind = 'firebase'; viewState.activationBusy = false; viewState.seatEnrollmentBusy = false;
    viewState.invitationCode = code; uiState.modalDisplay = { activationModal: 'flex' };
    standalone = true; native.android = false; native.native = false;
    vi.stubGlobal('crypto', { subtle: { digest: async (_algorithm, bytes) => new Uint8Array(createHash('sha256').update(bytes).digest()).buffer } });
    window.matchMedia = vi.fn(() => ({ matches: standalone })) as any;
    seat = { createIdentity: vi.fn(async () => ({})), invitationEnrollmentRequest: vi.fn(async () => enrollment),
        loadIdentity: vi.fn(async () => ({ publicKey: {} })), fingerprint: vi.fn(async () => enrollment.fingerprint),
        signInvitationCommand: vi.fn(async (_app, _key, body) => body) };
    (window as any).ZoeSeatClient = seat;
    vi.stubGlobal('ZoeLicense', { activate: vi.fn(async () => ({ valid: true })), getTrustedServerNow: () => Date.now(), syncServerTime: vi.fn() });
    requests = [];
    response = body => body.action === 'open' ? { scope: { inviteId: code, target: 'pwa', expiresAt: Date.now() + 3600000 } } : { status: 'pending', requestId, verificationCode };
    vi.stubGlobal('fetch', vi.fn(async (_url, options) => {
        const body = JSON.parse(options.body); requests.push(body);
        return { ok: true, json: async () => response(body) };
    }));
});
afterEach(() => { invitation.cancelLicenseInvitation(); vi.useRealTimers(); vi.unstubAllGlobals(); });
describe('ការអញ្ជើញឧបករណ៍អតិថិជន', () => {
    it('បើកតំណមិនបង្កើតកូនសោ ឬភ្ជាប់បណ្ដាញ', () => {
        window.location.hash = '#license-invite=' + code;
        invitation.routeLicenseInvitation();
        expect(fetch).not.toHaveBeenCalled(); expect(seat.createIdentity).not.toHaveBeenCalled();
        expect(viewState.invitationCode).toBe(code);
        window.location.hash = '';
    });
    it('តំណពេលមិនទាន់ Config មិនបិទបាំង PIN ហើយរក្សាលេខរហូតចូលគណនី', () => {
        firebaseState.auth = null;
        uiState.modalDisplay = { pinSetupModal: 'flex' };
        securityState.pinTargetAction = () => {};
        window.location.hash = '#license-invite=' + code;
        invitation.routeLicenseInvitation();
        expect(uiState.modalDisplay.activationModal).not.toBe('flex');
        expect(window.location.hash).toBe('');
        clearSensitiveModalFields();
        clearSensitiveModalFields(true);
        firebaseState.auth = { currentUser: { uid: 'signed-in' } } as any;
        securityState.pinTargetAction = null; uiState.modalDisplay = { loginModal: 'flex' };
        expect(invitation.restoreLicenseInvitationIntent()).toBe(true);
        expect(viewState.invitationCode).toBe(code);
        expect(fetch).not.toHaveBeenCalled(); expect(seat.createIdentity).not.toHaveBeenCalled();
    });
    it('ចាកចេញលុបចេតនាតំណដែលមិនទាន់ប្រើ', () => {
        firebaseState.auth = null; uiState.modalDisplay = {};
        window.location.hash = '#license-invite=' + code; invitation.routeLicenseInvitation();
        invitation.clearLicenseInvitationIntent();
        firebaseState.auth = { currentUser: { uid: 'other' } } as any;
        expect(invitation.restoreLicenseInvitationIntent()).toBe(false);
        expect(viewState.invitationCode).toBe('');
    });
    it.each(['browser', 'apk-mismatch', 'supabase'])('មិនចុះឈ្មោះនៅ %s', async mode => {
        if (mode === 'browser') standalone = false;
        if (mode === 'apk-mismatch') { native.android = true; native.native = true; }
        if (mode === 'supabase') viewState.backendKind = 'supabase';
        await invitation.submitLicenseInvitation();
        expect(seat.createIdentity).not.toHaveBeenCalled();
        expect(requests.some(r => r.action === 'submit')).toBe(false);
    });
    it('HTTP 410 ដែលបញ្ជាក់ការអញ្ជើញលែងមាន បង្ហាញសារច្បាស់ និងផ្អាកការបន្ត', async () => {
        await invitation.submitLicenseInvitation();
        vi.mocked(fetch).mockResolvedValue({ ok: false, status: 410, json: async () => ({ reason: 'invitation-unavailable' }) } as any);
        await invitation.submitLicenseInvitation();
        expect(viewState.invitationMessage).toContain('ផុតកំណត់');
        expect(viewState.invitationMessage).toContain('ស្នើលេខថ្មី');
        const calls = vi.mocked(fetch).mock.calls.length;
        await invitation.resumeLicenseInvitation();
        expect(vi.mocked(fetch)).toHaveBeenCalledTimes(calls);
    });
    it('ខុសប្រភេទ App បង្ហាញការណែនាំ PWA ឬ APK ដោយមិនបង្កើតកូនសោ', async () => {
        native.android = true; native.native = true;
        await invitation.submitLicenseInvitation();
        expect(viewState.invitationMessage).toContain('មិនត្រូវនឹងប្រភេទ App');
        expect(seat.createIdentity).not.toHaveBeenCalled();
    });
    it('APK ប្រើលេខកូដក្នុង App និងផ្លូវ production', async () => {
        native.android = true; native.native = true;
        response = body => body.action === 'open' ? { scope: { inviteId: code, target: 'apk', expiresAt: Date.now() + 3600000 } } : { status: 'pending', requestId, verificationCode };
        await invitation.submitLicenseInvitation();
        expect(seat.invitationEnrollmentRequest).toHaveBeenCalledWith('ZOE', 'ABCDEFGHIJKLMNOP', code, 'apk');
        expect(fetch).toHaveBeenCalledWith('https://zoew.netlify.app/.netlify/functions/license-invitations', expect.objectContaining({ credentials: 'omit' }));
    });
    it('រក្សាសំណើដើមពេលចម្លើយបាត់ មិនបង្កើត nonce ថ្មី', async () => {
        response = body => { if (body.action === 'submit') throw Error('lost'); return { scope: { inviteId: code, target: 'pwa', expiresAt: Date.now() + 3600000 } }; };
        await invitation.submitLicenseInvitation(); await invitation.submitLicenseInvitation();
        expect(seat.invitationEnrollmentRequest).toHaveBeenCalledTimes(1);
        expect(requests.filter(r => r.action === 'submit').map(r => r.enrollment)).toEqual([
            { payload: enrollment.payload, signature: enrollment.signature }, { payload: enrollment.payload, signature: enrollment.signature }
        ]);
        expect(Object.values(appLocalStore).join('')).not.toContain('ZOEKEY-');
    });
    it.each([true, false])('ក្រោយបាត់ចម្លើយ បោះបង់=%s គ្រប់គ្រងការបន្តពេល online', async cancelled => {
        response = body => { if (body.action === 'submit') throw Error('connection-lost'); return { scope: { inviteId: code, target: 'pwa', expiresAt: Date.now() + 3600000 } }; };
        await invitation.submitLicenseInvitation();
        if (cancelled) invitation.cancelLicenseInvitation();
        const count = requests.length;
        await invitation.resumeLicenseInvitation();
        expect(requests.length).toBe(count + (cancelled ? 0 : 1));
        if (cancelled) {
            await invitation.submitLicenseInvitation();
            expect(requests.length).toBe(count + 1);
        }
        expect(seat.invitationEnrollmentRequest).toHaveBeenCalledTimes(1);
    });
    it('បោះបង់ពេលគណនា scope របស់ retry នៅផ្អាកសំណើដើម', async () => {
        response = body => { if (body.action === 'submit') throw Error('connection-lost'); return { scope: { inviteId: code, target: 'pwa', expiresAt: Date.now() + 3600000 } }; };
        await invitation.submitLicenseInvitation();
        const digest = crypto.subtle.digest;
        let release!: (value: ArrayBuffer) => void;
        vi.spyOn(crypto.subtle, 'digest').mockImplementationOnce(() => new Promise<ArrayBuffer>(resolve => { release = resolve; }));
        const retry = invitation.submitLicenseInvitation();
        await vi.waitFor(() => expect(release).toBeTypeOf('function'));
        invitation.cancelLicenseInvitation();
        release(await digest.call(crypto.subtle, 'SHA-256', new Uint8Array()));
        await retry;
        const count = requests.length;
        await invitation.resumeLicenseInvitation();
        expect(requests).toHaveLength(count);
    });
    it('មិនផ្ញើសំណើបើ Storage មិនអាចសរសេរ', async () => {
        const write = vi.spyOn(appLocalStore, 'setItem').mockImplementation(() => { throw Error('quota'); });
        await invitation.submitLicenseInvitation();
        expect(requests.map(r => r.action)).toEqual(['open']); write.mockRestore();
    });
    it.each(['cancel', 'session', 'database', 'modal', 'config', 'identity'])('មិនដាក់ Active ក្រោយ %s ប្ដូរ', async reason => {
        await invitation.submitLicenseInvitation();
        let resolve!: (value: any) => void;
        response = () => new Promise(r => { resolve = r; });
        const checking = invitation.submitLicenseInvitation();
        await vi.waitFor(() => expect(resolve).toBeTypeOf('function'));
        if (reason === 'cancel') invitation.cancelLicenseInvitation();
        if (reason === 'session') firebaseState.authGeneration++;
        if (reason === 'database') firebaseState.db = {} as any;
        if (reason === 'modal') viewState.seatEnrollmentEpoch++;
        if (reason === 'config') appLocalStore.setItem('zoew_firebase_config', '{}');
        if (reason === 'identity') { viewState.seatEnrollmentEpoch++; }
        resolve({ status: 'approved', requestId, verificationCode, keyString: 'ZOEKEY-synthetic' }); await checking;
        expect(ZoeLicense.activate).not.toHaveBeenCalled();
    });
    it('អនុម័តហើយហៅការផ្ទៀងផ្ទាត់ Key និង lifecycle ដើម', async () => {
        await invitation.submitLicenseInvitation();
        response = () => ({ status: 'approved', requestId, verificationCode, keyString: 'ZOEKEY-synthetic' });
        await invitation.submitLicenseInvitation();
        expect(ZoeLicense.activate).toHaveBeenCalledWith('ZOEKEY-synthetic', 'ZOE', expect.any(Function), 2);
        expect(proceedAfterLogin).toHaveBeenCalledTimes(1);
        expect(Object.values(appLocalStore).join('')).not.toContain('ZOEKEY-synthetic');
    });
    it('ពិនិត្យស្វ័យប្រវត្តិមានកំណត់ និងបោះបង់បាន', async () => {
        await invitation.submitLicenseInvitation();
        vi.useFakeTimers();
        await invitation.submitLicenseInvitation();
        for (let i = 0; i < 8; i++) {
            await vi.advanceTimersByTimeAsync(61000);
        }
        expect(requests.filter(r => r.action === 'status').length).toBeLessThanOrEqual(7);
        invitation.cancelLicenseInvitation(); const count = requests.length;
        await vi.advanceTimersByTimeAsync(120000); expect(requests).toHaveLength(count);
        await invitation.resumeLicenseInvitation(); expect(requests).toHaveLength(count);
    });
    it('ចម្លើយ submit បាត់ ហើយអ្នកលក់អនុម័តមុន retry ត្រូវសួរ status មុន Active', async () => {
        response = body => {
            if (body.action === 'open') return { scope: { inviteId: code, target: 'pwa', expiresAt: Date.now() + 3600000 } };
            throw Error('lost-submit-response');
        };
        await invitation.submitLicenseInvitation();
        response = body => ({ status: 'approved', requestId, verificationCode, ...(body.action === 'status' ? { keyString: 'ZOEKEY-synthetic' } : {}) });
        await invitation.submitLicenseInvitation();
        await vi.waitFor(() => expect(proceedAfterLogin).toHaveBeenCalledTimes(1));
        expect(requests.map(r => r.action)).toEqual(['open', 'submit', 'submit', 'status']);
        expect(seat.invitationEnrollmentRequest).toHaveBeenCalledTimes(1);
        expect(ZoeLicense.activate).toHaveBeenCalledTimes(1);
    });
    it('បន្តសំណើដែលរក្សាទុកក្រោយ reload ដោយមិនស្នើ nonce ថ្មី', async () => {
        await invitation.submitLicenseInvitation();
        invitation.cancelLicenseInvitation();
        for (let i = 0; i < appLocalStore.length; i++) {
            const key = appLocalStore.key(i)!;
            const raw = appLocalStore.getItem(key)!;
            if (raw.startsWith('{')) appLocalStore.setItem(key, JSON.stringify({ ...JSON.parse(raw), paused: false }));
        }
        viewState.invitationCode = '';
        await invitation.resumeLicenseInvitation();
        expect(viewState.invitationCode).toBe(code);
        expect(requests.at(-1).action).toBe('status');
        expect(seat.invitationEnrollmentRequest).toHaveBeenCalledTimes(1);
    });
    it('មិនបន្តស្វ័យប្រវត្តិក្រោយបោះបង់', async () => {
        await invitation.submitLicenseInvitation(); invitation.cancelLicenseInvitation();
        const count = requests.length; await invitation.resumeLicenseInvitation();
        expect(requests).toHaveLength(count);
    });
    it('ម៉ោង server ដែលមានប្រភាគបង្កើត deadline ជាចំនួនគត់', async () => {
        const serverNow = Date.now() + 0.25;
        ZoeLicense.getTrustedServerNow = () => serverNow;
        await invitation.submitLicenseInvitation();
        const submitted = requests.find(r => r.action === 'submit');
        expect(submitted).toBeDefined();
        expect(Number.isSafeInteger(submitted.expiresAt)).toBe(true);
        expect(submitted.expiresAt).toBe(Math.floor(serverNow) + 45000);
    });
    it.each([null, NaN, Infinity, -1, Number.MAX_SAFE_INTEGER])('ម៉ោង server មិនអាចប្រើបាន %s មិនផ្ញើសំណើ', async serverNow => {
        ZoeLicense.getTrustedServerNow = () => serverNow;
        await invitation.submitLicenseInvitation();
        expect(fetch).not.toHaveBeenCalled();
    });
    it('មិនប្រើម៉ោងក្នុងគ្រឿងដែលមិនទាន់ផ្ទៀងផ្ទាត់', async () => {
        ZoeLicense.getTrustedServerNow = () => null;
        await invitation.submitLicenseInvitation();
        expect(fetch).not.toHaveBeenCalled(); expect(seat.createIdentity).not.toHaveBeenCalled();
    });
    it('បោះបង់ពេល activate កំពុងរង់ចាំដកសិទ្ធិសរសេរ និងបញ្ឈប់ busy', async () => {
        await invitation.submitLicenseInvitation();
        response = () => ({ status: 'approved', requestId, verificationCode, keyString: 'ZOEKEY-synthetic' });
        let guard!: () => boolean;
        ZoeLicense.activate = vi.fn((_key, _app, current) => { guard = current; return new Promise(() => {}); });
        const task = invitation.submitLicenseInvitation();
        await vi.waitFor(() => expect(guard).toBeTypeOf('function'));
        invitation.cancelLicenseInvitation(); await task;
        expect(guard()).toBe(false); expect(viewState.activationBusy).toBe(false);
        expect(proceedAfterLogin).not.toHaveBeenCalled();
    });
    it('មិនសរសេរជាន់សំណើខូចដោយបង្កើតសំណើថ្មី', async () => {
        await invitation.submitLicenseInvitation(); invitation.cancelLicenseInvitation();
        let pendingKey = '';
        for (let i = 0; i < appLocalStore.length; i++) {
            const key = appLocalStore.key(i)!;
            if (appLocalStore.getItem(key)!.startsWith('{')) pendingKey = key;
        }
        appLocalStore.setItem(pendingKey, '{broken');
        await invitation.submitLicenseInvitation();
        expect(appLocalStore.getItem(pendingKey)).toBe('{broken');
        expect(seat.invitationEnrollmentRequest).toHaveBeenCalledTimes(1);
    });
    it('លាក់សំណើ JSON ថ្មី ហើយរក្សា UI ដាក់ Key ដោយដៃ', () => {
        const html = renderToStaticMarkup(createElement(ActivationModal));
        expect(html).toContain('licenseInvitationCode'); expect(html).toContain('activationKeyInput');
        expect(html).toContain('seatEnrollmentPrepareBtn');
        expect(html).not.toContain(enrollment.payload);
    });
});
