import { inviteCodeHash, normalizeInviteCode, resetCodeHash } from './invite-code.ts';

export const USERNAME_RE = /^[a-z0-9_.]{3,32}$/;
export const PASSWORD_MIN_CHARS = 8;
export const PASSWORD_MAX_BYTES = 72;
export const FINISH_REASONS = ['invite-invalid', 'username-taken', 'account-exists', 'account-invalid', 'user-mismatch'] as const;

export type FinishReason = typeof FINISH_REASONS[number] | 'unavailable';
export type RegistrationDiagnosis = 'username-taken' | 'invite-invalid' | 'unknown';
export type RegistrationContext = { username: string; codeHash: string };
export type CreateUserResult = { ok: true; userId: string } | { ok: false; reason: 'exists' | 'weak' | 'unavailable' };
export type FinishResult = { ok: true; tenantId: string; role: string } | { ok: false; reason: FinishReason };
export type UpdatePasswordResult = 'ok' | 'weak' | 'unavailable';
export type SpentInviteMember = { userId: string; tenantId: string; role: string };

export interface HandlerResult {
    status: number;
    body: { ok: boolean; code: string; tenantId?: string; role?: string; protocol?: string; ready?: boolean };
}

export interface RegisterDeps {
    registrationReady?(): Promise<boolean | null>;
    inviteIsUsable(codeHash: string): Promise<boolean | null>;
    spentInviteMember(codeHash: string, username: string): Promise<SpentInviteMember | null | undefined>;
    createUser(email: string, password: string, registration: RegistrationContext): Promise<CreateUserResult>;
    finishRegistration(input: { userId: string; codeHash: string; username: string }): Promise<FinishResult>;
    deleteUser(userId: string): Promise<boolean>;
    diagnoseRegistration(codeHash: string, username: string): Promise<RegistrationDiagnosis | null>;
    passwordUserId(email: string, password: string): Promise<string | null | undefined>;
    loginDomain: string;
}

export interface ResetDeps {
    claimResetCode(username: string, codeHash: string, claimId: string): Promise<string | null | undefined>;
    updatePassword(userId: string, password: string): Promise<UpdatePasswordResult>;
    settleResetCode(username: string, codeHash: string, claimId: string, consumed: boolean): Promise<boolean>;
    revokeSessions(userId: string): Promise<boolean>;
}

const FINISH_REPLY: Record<FinishReason, [number, string]> = {
    'invite-invalid': [403, 'invite-invalid'],
    'username-taken': [409, 'username-taken'],
    'account-exists': [500, 'internal'],
    'account-invalid': [400, 'account-invalid'],
    'user-mismatch': [500, 'internal'],
    unavailable: [502, 'registration-unknown']
};

function reply(status: number, code: string, extra: { tenantId?: string; role?: string } = {}): HandlerResult {
    return { status, body: { ok: status === 200, code, ...extra } };
}

export function normalizeUsername(raw: unknown): string | null {
    if (typeof raw !== 'string' || raw.length > 64) return null;
    const username = raw.trim().toLowerCase();
    return USERNAME_RE.test(username) ? username : null;
}

export function passwordProblem(raw: unknown): 'password-short' | 'password-long' | null {
    if (typeof raw !== 'string' || Array.from(raw).length < PASSWORD_MIN_CHARS) return 'password-short';
    if (new TextEncoder().encode(raw).length > PASSWORD_MAX_BYTES) return 'password-long';
    return null;
}

export function loginEmail(username: string, loginDomain: string): string {
    return username + '@' + loginDomain;
}

function fields(input: unknown): Record<string, unknown> | null {
    return input !== null && typeof input === 'object' && !Array.isArray(input) ? input as Record<string, unknown> : null;
}

type Failed<T extends { ok: boolean }> = Extract<T, { ok: false }>;

function failureOf<T extends { ok: boolean }>(result: T): Failed<T> | null {
    return result.ok ? null : result as Failed<T>;
}

async function finishWithRetry(deps: RegisterDeps, request: { userId: string; codeHash: string; username: string }): Promise<FinishResult> {
    const first = await deps.finishRegistration(request);
    if (failureOf(first)?.reason === 'unavailable') return deps.finishRegistration(request);
    return first;
}

async function registeredBySpentInvite(deps: RegisterDeps, email: string, password: string, codeHash: string, username: string, provenUserId?: string): Promise<HandlerResult> {
    const member = await deps.spentInviteMember(codeHash, username);
    if (member === undefined) return reply(502, 'db-unavailable');
    if (member === null) return reply(403, 'invite-invalid');
    const proven = provenUserId ?? await deps.passwordUserId(email, password);
    if (proven === undefined) return reply(502, 'registration-unknown');
    if (proven !== member.userId) return reply(403, 'invite-invalid');
    return reply(200, 'registered', { tenantId: member.tenantId, role: member.role });
}

async function finishProvenRegistration(deps: RegisterDeps, email: string, password: string, codeHash: string, username: string, userId: string): Promise<HandlerResult> {
    const finished = await finishWithRetry(deps, { userId, codeHash, username });
    if (finished.ok) return reply(200, 'registered', { tenantId: finished.tenantId, role: finished.role });
    const reason = failureOf(finished)?.reason ?? 'unavailable';
    if (reason === 'invite-invalid') return registeredBySpentInvite(deps, email, password, codeHash, username, userId);
    return reply(...FINISH_REPLY[reason]);
}

async function resumeRegistration(deps: RegisterDeps, email: string, password: string, codeHash: string, username: string): Promise<HandlerResult> {
    const userId = await deps.passwordUserId(email, password);
    if (userId === undefined) return reply(502, 'registration-unknown');
    if (userId === null) return reply(409, 'username-taken');
    return finishProvenRegistration(deps, email, password, codeHash, username, userId);
}

async function diagnoseCreateFailure(deps: RegisterDeps, email: string, password: string, codeHash: string, username: string): Promise<HandlerResult> {
    const userId = await deps.passwordUserId(email, password);
    if (userId) return finishProvenRegistration(deps, email, password, codeHash, username, userId);
    const diagnosis = await deps.diagnoseRegistration(codeHash, username);
    if (diagnosis === 'username-taken') return reply(409, 'username-taken');
    if (diagnosis === 'invite-invalid') return reply(403, 'invite-invalid');
    return reply(502, 'registration-unknown');
}

export async function handleRegister(input: unknown, deps: RegisterDeps): Promise<HandlerResult> {
    const body = fields(input);
    if (!body) return reply(400, 'bad-request');
    if ('registrationProtocol' in body) {
        if (body.registrationProtocol !== 'zoe-registration-v1' || Object.keys(body).length !== 1) return reply(400, 'bad-request');
        try {
            const ready = await deps.registrationReady?.();
            if (typeof ready !== 'boolean') return reply(503, 'db-unavailable');
            return { status: 200, body: { ok: true, code: 'registration-protocol', protocol: 'zoe-registration-v1', ready } };
        } catch {
            return reply(503, 'db-unavailable');
        }
    }
    const invite = normalizeInviteCode(body.invite);
    if (!invite) return reply(400, 'invite-invalid');
    if (body.check === true) {
        const usableNow = await deps.inviteIsUsable(await inviteCodeHash(invite));
        if (usableNow === null) return reply(502, 'db-unavailable');
        return usableNow ? reply(200, 'invite-usable') : reply(403, 'invite-invalid');
    }
    const username = normalizeUsername(body.username);
    if (!username) return reply(400, 'username-invalid');
    const passwordIssue = passwordProblem(body.password);
    if (passwordIssue) return reply(400, passwordIssue);
    const password = body.password as string;
    const codeHash = await inviteCodeHash(invite);
    const usable = await deps.inviteIsUsable(codeHash);
    if (usable === null) return reply(502, 'db-unavailable');
    const email = loginEmail(username, deps.loginDomain);
    if (!usable) return registeredBySpentInvite(deps, email, password, codeHash, username);
    const created = await deps.createUser(email, password, { username, codeHash });
    if (!created.ok) {
        const createFailure = failureOf(created)?.reason ?? 'unavailable';
        if (createFailure === 'exists') return resumeRegistration(deps, email, password, codeHash, username);
        if (createFailure === 'weak') return reply(400, 'password-weak');
        return diagnoseCreateFailure(deps, email, password, codeHash, username);
    }
    const finished = await finishWithRetry(deps, { userId: created.userId, codeHash, username });
    if (finished.ok) return reply(200, 'registered', { tenantId: finished.tenantId, role: finished.role });
    return reply(...FINISH_REPLY[failureOf(finished)?.reason ?? 'unavailable']);
}

export async function handleResetPassword(input: unknown, deps: ResetDeps): Promise<HandlerResult> {
    const body = fields(input);
    if (!body) return reply(400, 'bad-request');
    const code = normalizeInviteCode(body.resetCode);
    if (!code) return reply(400, 'reset-code-invalid');
    const username = normalizeUsername(body.username);
    if (!username) return reply(400, 'username-invalid');
    const passwordIssue = passwordProblem(body.password);
    if (passwordIssue) return reply(400, passwordIssue);
    const codeHash = await resetCodeHash(code);
    const claimId = crypto.randomUUID();
    let userId = await deps.claimResetCode(username, codeHash, claimId);
    if (userId === undefined) userId = await deps.claimResetCode(username, codeHash, claimId);
    if (userId === undefined) return reply(502, 'db-unavailable');
    if (userId === null) return reply(403, 'reset-code-invalid');
    const updated = await deps.updatePassword(userId, body.password as string);
    if (updated === 'weak') {
        const released = (await deps.settleResetCode(username, codeHash, claimId, false)) || (await deps.settleResetCode(username, codeHash, claimId, false));
        return released ? reply(400, 'password-weak') : reply(502, 'password-reset-unknown');
    }
    if (updated !== 'ok') return reply(502, 'password-reset-unknown');
    const consumed = (await deps.settleResetCode(username, codeHash, claimId, true)) || (await deps.settleResetCode(username, codeHash, claimId, true));
    const revoked = (await deps.revokeSessions(userId)) || (await deps.revokeSessions(userId));
    return reply(200, consumed && revoked ? 'password-reset' : 'password-reset-incomplete');
}
