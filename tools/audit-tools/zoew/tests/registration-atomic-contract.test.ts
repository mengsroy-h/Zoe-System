import { describe, expect, it, vi } from 'vitest';
import { adminDeps } from '../../../../supabase/functions/_shared/admin-deps';
import { handleRegister } from '../../../../supabase/functions/_shared/account-core';
const ready = { protocol: 'zoe-registration-v1', ready: true };
const context = { username: 'fixture_user', codeHash: 'a'.repeat(64) };
const email = 'fixture_user@users.zoew.invalid';
function fixture(data: unknown = ready, error: unknown = null) {
    const createUser = vi.fn(async (_body: unknown) => ({ data: { user: { id: 'fixture-id' } }, error: null }));
    const rpc = vi.fn(async (_name: string) => ({ data, error }));
    return { createUser, rpc, deps: adminDeps({ rpc, auth: { admin: { createUser } } } as any) };
}
describe('atomic registration admission contract', () => {
    it('fails closed before Auth when capability RPC is missing', async () => {
        const f = fixture(null, { code: 'PGRST202' });
        const r = await f.deps.createUser(email, 'fixture-password', context);
        expect(r).toEqual({ ok: false, reason: 'unavailable' });
        expect(f.createUser).not.toHaveBeenCalled();
    });
    for (const data of [null, true, {}, { protocol: 'old', ready: true }, { protocol: 'zoe-registration-v1', ready: 'true' }, { protocol: 'zoe-registration-v1', ready: false }]) {
        it('rejects absent, malformed, paused or incompatible capability ' + JSON.stringify(data), async () => {
            const f = fixture(data);
            expect(await f.deps.createUser(email, 'fixture-password', context)).toEqual({ ok: false, reason: 'unavailable' });
            expect(f.createUser).not.toHaveBeenCalled();
        });
    }
    it('checks capability for every attempt and sends only server-derived trusted metadata', async () => {
        const f = fixture();
        await f.deps.createUser(email, 'fixture-password', context);
        await f.deps.createUser(email, 'fixture-password', context);
        expect(f.rpc.mock.calls).toEqual([['registration_capability_v1'], ['registration_capability_v1']]);
        expect(f.createUser).toHaveBeenCalledWith({ email, password: 'fixture-password', email_confirm: true,
            app_metadata: { zoe_registration: { version: 1, username: context.username, invite_code_hash: context.codeHash } } });
    });
    it('refuses missing or inconsistent server context before any Auth call', async () => {
        for (const value of [undefined, { ...context, username: 'other' }, { ...context, codeHash: 'bad' }]) {
            const f = fixture();
            expect(await f.deps.createUser(email, 'fixture-password', value as any)).toEqual({ ok: false, reason: 'unavailable' });
            expect(f.createUser).not.toHaveBeenCalled();
        }
    });
    it('passes normalized registration context without allowing caller-selected tenant metadata', async () => {
        const createUser = vi.fn(async () => ({ ok: true as const, userId: 'fixture-id' }));
        const deleteUser = vi.fn(async () => true);
        const deps = { loginDomain: 'users.zoew.invalid', inviteIsUsable: async () => true, createUser,
            finishRegistration: async () => ({ ok: false as const, reason: 'username-taken' as const }),
            spentInviteMember: async () => null, passwordUserId: async () => null, deleteUser,
            diagnoseRegistration: async () => 'unknown' as const };
        const r = await handleRegister({ username: ' FIXTURE_USER ', password: 'fixture-password', invite: 'AAAAAAAAAAAAAAAAAAAA', app_metadata: { tenant: 'attacker' } }, deps);
        expect(r.status).toBe(409);
        expect(createUser).toHaveBeenCalledWith(email, 'fixture-password', { username: context.username, codeHash: expect.stringMatching(/^[0-9a-f]{64}$/) });
        expect(deleteUser).not.toHaveBeenCalled();
    });
});

function registrationDeps(over: Record<string, unknown> = {}) {
    return {
        loginDomain: 'users.zoew.invalid',
        inviteIsUsable: async () => true,
        spentInviteMember: async () => null,
        createUser: async () => ({ ok: false as const, reason: 'unavailable' as const }),
        finishRegistration: async () => ({ ok: false as const, reason: 'unavailable' as const }),
        deleteUser: async () => true,
        diagnoseRegistration: async () => 'unknown' as const,
        passwordUserId: async () => null,
        ...over
    } as any;
}

describe('registration create-failure diagnosis', () => {
    const body = { invite: 'AAAAAAAAAAAAAAAAAAAA', username: 'fixture_user', password: 'fixture-password' };
    it('reports a taken username instead of an auth outage once the database confirms it', async () => {
        const finishRegistration = vi.fn();
        const r = await handleRegister(body, registrationDeps({ finishRegistration, diagnoseRegistration: async () => 'username-taken' }));
        expect(r).toEqual({ status: 409, body: { ok: false, code: 'username-taken' } });
        expect(finishRegistration).not.toHaveBeenCalled();
    });
    it('reports an unusable invite instead of an auth outage once the database confirms it', async () => {
        const r = await handleRegister(body, registrationDeps({ diagnoseRegistration: async () => 'invite-invalid' }));
        expect(r).toEqual({ status: 403, body: { ok: false, code: 'invite-invalid' } });
    });
    for (const [label, diagnosis] of [['unknown', 'unknown'], ['unavailable', null]] as const) {
        it('reports an unclear result, not an auth outage, when diagnosis is ' + label, async () => {
            const r = await handleRegister(body, registrationDeps({ diagnoseRegistration: async () => diagnosis }));
            expect(r).toEqual({ status: 502, body: { ok: false, code: 'registration-unknown' } });
            expect(r.body.code).not.toBe('auth-unavailable');
        });
    }
    it('recovers the registration when the same credentials prove the account exists', async () => {
        const finishRegistration = vi.fn(async () => ({ ok: true as const, tenantId: 'fixture-tenant', role: 'member' }));
        const r = await handleRegister(body, registrationDeps({ passwordUserId: async () => 'fixture-user', finishRegistration }));
        expect(r).toEqual({ status: 200, body: { ok: true, code: 'registered', tenantId: 'fixture-tenant', role: 'member' } });
        expect(finishRegistration).toHaveBeenCalledWith({ userId: 'fixture-user', codeHash: expect.stringMatching(/^[0-9a-f]{64}$/), username: 'fixture_user' });
    });
    it('reports an unclear result instead of an auth outage when a retry cannot verify the password', async () => {
        const r = await handleRegister(body, registrationDeps({
            createUser: async () => ({ ok: false as const, reason: 'exists' as const }),
            passwordUserId: async () => undefined
        }));
        expect(r).toEqual({ status: 502, body: { ok: false, code: 'registration-unknown' } });
    });
    it('reports an unclear result instead of an auth outage when a spent invite cannot verify the password', async () => {
        const r = await handleRegister(body, registrationDeps({
            inviteIsUsable: async () => false,
            spentInviteMember: async () => ({ userId: 'fixture-user', tenantId: 'fixture-tenant', role: 'member' }),
            passwordUserId: async () => undefined
        }));
        expect(r).toEqual({ status: 502, body: { ok: false, code: 'registration-unknown' } });
    });
});
