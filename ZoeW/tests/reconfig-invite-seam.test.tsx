/**
 * ⛔ ថ្នេរ App ↔ Edge Function `register` (Deep audit ជុំ ៣ ចំណុច ២) ៖ ហាងដែលចុះឈ្មោះរួច ➜ Reconfig ដោយ Setup Link ដដែល ➜ **ប្រអប់ចូលប្រព័ន្ធ**
 *    (មិនមែនចុះឈ្មោះ) លើ storage លុប · ឧបករណ៍ថ្មី · Link ប្រើរួច · Function ព្យួរ/មិនឆ្លើយ · ប្តូរ Firebase ⇄ Supabase។
 *    ផ្នែក server ជា `handleRegister()` **ពិត** (`supabase/functions/_shared/account-core.ts` + hash កូដពិត) លើ DB ក្នុង memory ➜ កូដឆ្លើយ
 *    (`invite-usable` · `invite-invalid` · `registered` · `db-unavailable`) មកពីកូដ Function ពិត មិនមែនខ្សែអក្សរដែលតេស្តសរសេរ។
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { firebaseState, uiState } from '../src/core/state';
import { viewState } from '../src/core/view-state';
import { appLocalStore } from '../src/core/storage';
import { setFieldValue } from '../src/app/refs';
import { LoginModal } from '../src/app/components/modals/LoginModal';
import { INVITE_UNVERIFIED_TOAST, INVITE_USED_TOAST, clearPendingInvite, hasPendingInvite, rememberSetupInvite, submitRegisterForm } from '../src/features/account';
import { showLoginModalWithPrefill } from '../src/features/session';
import { mount, step, unmount } from './native/react-harness';
import { settleAsync, trackCryptoSubtle } from './async-settle';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const SHARED = path.resolve(__dirname, '..', '..', 'supabase', 'functions', '_shared');
function loadShared(name: string, deps: Record<string, any>): any {
    const source = fs.readFileSync(path.join(SHARED, name), 'utf8');
    const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
    const exports: any = {};
    new Function('exports', 'require', js)(exports, (spec: string) => {
        if (!(spec in deps)) throw new Error('unexpected import ' + spec);
        return deps[spec];
    });
    return exports;
}
const inviteCode = loadShared('invite-code.ts', {});
const { handleRegister } = loadShared('account-core.ts', { './invite-code.ts': inviteCode });
const { inviteCodeHash, normalizeInviteCode } = inviteCode;

const SB_URL = 'https://abcd1234.supabase.co';
const SB = { supabaseUrl: SB_URL, supabaseKey: 'sb_publishable_' + 'k'.repeat(24) };
const FB = { apiKey: 'A', databaseURL: 'https://shop-a.firebaseio.com', projectId: 'p' };
const INVITE = 'abcd-efgh-jkmn-pqrs-tvwx';
const DOMAIN = 'users.zoew.invalid';
const toastTexts = () => uiState.toasts.map((t: any) => t.msg);

trackCryptoSubtle();

function fakeServer() {
    const invites = new Map<string, { uses: number; tenantId: string; role: string; members: string[] }>();
    const users = new Map<string, { id: string; password: string }>();
    const members = new Map<string, { tenantId: string; role: string; username: string; codeHash: string }>();
    let seq = 0;
    let mode: 'up' | 'network' | 'timeout' | 'db-down' | 'gateway' | 'old' = 'up';
    const deps = {
        loginDomain: DOMAIN,
        async inviteIsUsable(codeHash: string) {
            if (mode === 'db-down') return null;
            const inv = invites.get(codeHash);
            return !!inv && inv.uses > 0;
        },
        async spentInviteMember(codeHash: string, username: string) {
            const inv = invites.get(codeHash);
            if (!inv) return null;
            for (const [userId, m] of members) {
                if (m.codeHash === codeHash && m.username === username) return { userId, tenantId: m.tenantId, role: m.role };
            }
            return null;
        },
        async createUser(email: string, password: string) {
            if (users.has(email)) return { ok: false, reason: 'exists' } as const;
            const id = 'u' + (++seq);
            users.set(email, { id, password });
            return { ok: true, userId: id } as const;
        },
        async finishRegistration({ userId, codeHash, username }: { userId: string; codeHash: string; username: string }) {
            const inv = invites.get(codeHash);
            if (!inv || inv.uses <= 0) return { ok: false, reason: 'invite-invalid' } as const;
            inv.uses--;
            members.set(userId, { tenantId: inv.tenantId, role: inv.role, username, codeHash });
            return { ok: true, tenantId: inv.tenantId, role: inv.role } as const;
        },
        async deleteUser(userId: string) {
            for (const [email, u] of users) if (u.id === userId) users.delete(email);
            return true;
        },
        async passwordUserId(email: string, password: string) {
            const u = users.get(email);
            return u && u.password === password ? u.id : null;
        }
    };
    const calls: any[] = [];
    const registerAccount = vi.fn(async (_app: any, body: any) => {
        calls.push(Object.assign({}, body, { password: body.password ? '***' : undefined }));
        if (mode === 'network') throw new TypeError('Failed to fetch');
        if (mode === 'timeout') throw new Error('timeout');
        if (mode === 'gateway') return { status: 504, body: { ok: false, code: 'bad-response' } };
        if (mode === 'old' && body.check === true) return { status: 400, body: { ok: false, code: 'username-invalid' } };
        const r = await handleRegister(body, deps as any);
        return { status: r.status, body: r.body };
    });
    return {
        calls,
        users,
        setMode(m: typeof mode) { mode = m; },
        async issueInvite(code: string, uses = 1) {
            invites.set(await inviteCodeHash(normalizeInviteCode(code)!), { uses, tenantId: 't-A', role: 'owner', members: [] });
        },
        fb: {
            __supabase: true,
            browserLocalPersistence: { type: 'LOCAL' },
            browserSessionPersistence: { type: 'SESSION' },
            registerAccount,
            setPersistence: vi.fn(async () => {}),
            signInWithEmailAndPassword: vi.fn(async (_a: any, login: string) => { calls.push({ signIn: login }); return { user: null }; })
        } as any
    };
}

function selectBackend(kind: 'supabase' | 'firebase', fb?: any) {
    firebaseState.firebaseConfig = kind === 'supabase' ? Object.assign({}, SB) : Object.assign({}, FB);
    firebaseState.fb = fb || null;
    firebaseState.auth = { app: { name: 'x' }, currentUser: null } as any;
    step(() => { viewState.backendKind = kind; });
}

function newDevice() {
    if (appLocalStore) appLocalStore.clear();
    clearPendingInvite();
    uiState.toasts = [];
    step(() => { viewState.loginMode = 'login'; viewState.loginBusy = false; });
}

async function openLinkLoginModal() {
    rememberSetupInvite(INVITE, SB_URL);
    step(() => { showLoginModalWithPrefill(); });
    await settleAsync(6);
}

async function registerAs(username: string, password: string) {
    step(() => {
        setFieldValue('registerInviteInput', INVITE);
        setFieldValue('registerUsernameInput', username);
        setFieldValue('registerPasswordInput', password);
        setFieldValue('registerPasswordConfirmInput', password);
    });
    await submitRegisterForm();
    await settleAsync(6);
}

beforeEach(() => {
    newDevice();
    (window as any).alert = vi.fn();
    mount(<LoginModal />);
});

afterEach(() => {
    unmount();
    step(() => { viewState.backendKind = 'firebase'; viewState.loginMode = 'login'; viewState.loginBusy = false; });
    firebaseState.fb = null;
    firebaseState.auth = null;
    firebaseState.firebaseConfig = null;
    clearPendingInvite();
});

async function ownerRegistered() {
    const server = fakeServer();
    await server.issueInvite(INVITE);
    selectBackend('supabase', server.fb);
    await openLinkLoginModal();
    expect(viewState.loginMode).toBe('register');
    await registerAs('sokha', 'pass-1234');
    expect(server.calls.some((c) => c.signIn === 'sokha')).toBe(true);
    return server;
}

describe('ហាងចុះឈ្មោះរួច ➜ Reconfig ដោយ Setup Link ដដែល ➜ ប្រអប់ចូលប្រព័ន្ធ (server = handleRegister ពិត)', () => {
    it('ឧបករណ៍ដដែល ➜ ចូលប្រព័ន្ធ (ការចងចាំក្នុងឧបករណ៍ · មិនសួរ server)', async () => {
        const server = await ownerRegistered();
        server.calls.length = 0;
        uiState.toasts = [];
        step(() => { viewState.loginMode = 'login'; });
        await openLinkLoginModal();
        expect(viewState.loginMode).toBe('login');
        expect(server.calls).toEqual([]);
        expect(toastTexts()).toContain(INVITE_USED_TOAST);
    });

    it('storage លុប / ឧបករណ៍ថ្មី ➜ server ឆ្លើយ invite-invalid ➜ ចូលប្រព័ន្ធ · ⛔ មិនបង្កើតគណនី', async () => {
        const server = await ownerRegistered();
        newDevice();
        server.calls.length = 0;
        const before = server.users.size;
        await openLinkLoginModal();
        expect(viewState.loginMode).toBe('login');
        expect(server.calls).toEqual([{ invite: INVITE, check: true, password: undefined }]);
        expect(toastTexts()).toContain(INVITE_USED_TOAST);
        expect(hasPendingInvite()).toBe(false);
        expect(server.users.size).toBe(before);
    });

    for (const [mode, label] of [['network', 'បណ្តាញមិនឆ្លើយ (Failed to fetch)'], ['timeout', 'Function ព្យួរ (ពិដាន ២០ វិ.)'],
        ['db-down', 'DB មិនឆ្លើយ (502 db-unavailable)'], ['gateway', 'gateway 504']] as const) {
        it(`ឧបករណ៍ថ្មី + ${label} ➜ ប្រអប់ចូលប្រព័ន្ធ + សារណែនាំ (ចុះឈ្មោះក៏ធ្វើមិនបានពេលនេះដែរ) · កូដនៅចាំសម្រាប់ប៊ូតុងចុះឈ្មោះ`, async () => {
            const server = await ownerRegistered();
            newDevice();
            server.setMode(mode);
            await openLinkLoginModal();
            expect(viewState.loginMode).toBe('login');
            expect(toastTexts()).toContain(INVITE_UNVERIFIED_TOAST);
            expect(hasPendingInvite()).toBe(true);
        });
    }

    it('ទិសផ្ទុយ ៖ ហាងថ្មី · កូដនៅប្រើបាន ➜ ចុះឈ្មោះ (កូដបំពេញស្រាប់)', async () => {
        const server = fakeServer();
        await server.issueInvite(INVITE);
        selectBackend('supabase', server.fb);
        await openLinkLoginModal();
        expect(viewState.loginMode).toBe('register');
        expect(server.users.size).toBe(0);
    });

    it('ទិសផ្ទុយ ៖ Function ចាស់ (មិនស្គាល់ check) ➜ ចុះឈ្មោះ (ការចុះឈ្មោះនៅធ្វើបាន)', async () => {
        const server = fakeServer();
        await server.issueInvite(INVITE);
        server.setMode('old');
        selectBackend('supabase', server.fb);
        await openLinkLoginModal();
        expect(viewState.loginMode).toBe('register');
    });

    it('ចុះឈ្មោះម្តងទៀតដោយឈ្មោះ + ពាក្យសម្ងាត់ដដែល (កូដប្រើរួច) ➜ server ឆ្លើយ registered ➜ ចូលប្រព័ន្ធ (មិនបង្កើតគណនីទី ២)', async () => {
        const server = await ownerRegistered();
        newDevice();
        server.calls.length = 0;
        rememberSetupInvite(INVITE, SB_URL);
        step(() => { viewState.loginMode = 'register'; });
        await registerAs('sokha', 'pass-1234');
        expect(server.calls.some((c) => c.signIn === 'sokha')).toBe(true);
        expect(server.users.size).toBe(1);
    });

    it('ប្តូរ Firebase ⇄ Supabase ៖ Link Supabase (មានកូដ) ➜ Config ជា Firebase ➜ មិនសួរ server · មិនបើកចុះឈ្មោះ ➜ ត្រឡប់ Supabase ➜ ចូលប្រព័ន្ធ', async () => {
        const server = await ownerRegistered();
        newDevice();
        server.calls.length = 0;
        rememberSetupInvite(INVITE, SB_URL);
        selectBackend('firebase', server.fb);
        step(() => { showLoginModalWithPrefill(); });
        await settleAsync(6);
        expect(viewState.loginMode).toBe('login');
        expect(server.calls).toEqual([]);
        selectBackend('supabase', server.fb);
        step(() => { showLoginModalWithPrefill(); });
        await settleAsync(6);
        expect(viewState.loginMode).toBe('login');
        expect(toastTexts()).toContain(INVITE_USED_TOAST);
    });
});
