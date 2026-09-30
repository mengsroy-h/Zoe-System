import { inviteCodeHash, normalizeInviteCode } from './invite-code.ts';
import type { PhoneTokenFailure, PhoneTokenVerdict } from './firebase-phone-token.ts';

export const USERNAME_RE = /^[a-z0-9_.]{3,32}$/;
export const PASSWORD_MIN_CHARS = 8;
export const PASSWORD_MAX_BYTES = 72;
export const FINISH_REASONS = ['invite-invalid', 'phone-taken', 'username-taken', 'account-exists', 'account-invalid', 'user-mismatch'] as const;

const ROLLBACK_REASONS: ReadonlySet<FinishReason> = new Set<FinishReason>(['invite-invalid', 'phone-taken', 'username-taken', 'account-invalid']);

export type FinishReason = typeof FINISH_REASONS[number] | 'unavailable';
export type CreateUserResult = { ok: true; userId: string } | { ok: false; reason: 'exists' | 'weak' | 'unavailable' };
export type FinishResult = { ok: true; tenantId: string; role: string } | { ok: false; reason: FinishReason };
export type UpdatePasswordResult = 'ok' | 'weak' | 'unavailable';

export interface HandlerResult {
    status: number;
    body: { ok: boolean; code: string; tenantId?: string; role?: string };
}

export interface RegisterDeps {
    verifyPhoneToken(token: string): Promise<PhoneTokenVerdict>;
    inviteIsUsable(codeHash: string): Promise<boolean | null>;
    createUser(email: string, password: string): Promise<CreateUserResult>;
    finishRegistration(input: { userId: string; codeHash: string; username: string; phone: string }): Promise<FinishResult>;
    deleteUser(userId: string): Promise<boolean>;
    loginDomain: string;
    phonePrefixes: readonly string[];
}

export interface ResetDeps {
    verifyPhoneToken(token: string): Promise<PhoneTokenVerdict>;
    findMember(username: string, phone: string): Promise<string | null | undefined>;
    updatePassword(userId: string, password: string): Promise<UpdatePasswordResult>;
    revokeSessions(userId: string): Promise<boolean>;
}

const FINISH_REPLY: Record<FinishReason, [number, string]> = {
    'invite-invalid': [403, 'invite-invalid'],
    'phone-taken': [409, 'phone-taken'],
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

function otpFailure(reason: PhoneTokenFailure): HandlerResult {
    if (reason === 'keys-unavailable') return reply(503, 'otp-unverifiable');
    if (reason === 'server-unconfigured') return reply(503, 'server-unconfigured');
    if (reason === 'otp-stale') return reply(401, 'otp-stale');
    return reply(401, 'otp-invalid');
}

function fields(input: unknown): Record<string, unknown> | null {
    return input !== null && typeof input === 'object' && !Array.isArray(input) ? input as Record<string, unknown> : null;
}

export async function handleRegister(input: unknown, deps: RegisterDeps): Promise<HandlerResult> {
    const body = fields(input);
    if (!body || typeof body.idToken !== 'string' || body.idToken.length === 0) return reply(400, 'bad-request');
    const invite = normalizeInviteCode(body.invite);
    if (!invite) return reply(400, 'invite-invalid');
    const username = normalizeUsername(body.username);
    if (!username) return reply(400, 'username-invalid');
    const passwordIssue = passwordProblem(body.password);
    if (passwordIssue) return reply(400, passwordIssue);
    const password = body.password as string;
    const otp = await deps.verifyPhoneToken(body.idToken);
    if (!otp.ok) return otpFailure(otp.reason);
    if (!deps.phonePrefixes.some((prefix) => otp.phone.startsWith(prefix))) return reply(403, 'phone-region');
    const codeHash = await inviteCodeHash(invite);
    const usable = await deps.inviteIsUsable(codeHash);
    if (usable === null) return reply(502, 'db-unavailable');
    if (!usable) return reply(403, 'invite-invalid');
    const created = await deps.createUser(loginEmail(username, deps.loginDomain), password);
    if (!created.ok) {
        if (created.reason === 'exists') return reply(409, 'username-taken');
        if (created.reason === 'weak') return reply(400, 'password-weak');
        return reply(502, 'auth-unavailable');
    }
    const request = { userId: created.userId, codeHash, username, phone: otp.phone };
    let finished = await deps.finishRegistration(request);
    if (!finished.ok && finished.reason === 'unavailable') finished = await deps.finishRegistration(request);
    if (finished.ok) return reply(200, 'registered', { tenantId: finished.tenantId, role: finished.role });
    if (!ROLLBACK_REASONS.has(finished.reason)) return reply(...FINISH_REPLY[finished.reason]);
    const removed = (await deps.deleteUser(created.userId)) || (await deps.deleteUser(created.userId));
    if (!removed) return reply(500, 'registration-incomplete');
    return reply(...FINISH_REPLY[finished.reason]);
}

export async function handleResetPassword(input: unknown, deps: ResetDeps): Promise<HandlerResult> {
    const body = fields(input);
    if (!body || typeof body.idToken !== 'string' || body.idToken.length === 0) return reply(400, 'bad-request');
    const username = normalizeUsername(body.username);
    if (!username) return reply(400, 'username-invalid');
    const passwordIssue = passwordProblem(body.password);
    if (passwordIssue) return reply(400, passwordIssue);
    const otp = await deps.verifyPhoneToken(body.idToken);
    if (!otp.ok) return otpFailure(otp.reason);
    const userId = await deps.findMember(username, otp.phone);
    if (userId === undefined) return reply(502, 'db-unavailable');
    if (userId === null) return reply(403, 'account-mismatch');
    const updated = await deps.updatePassword(userId, body.password as string);
    if (updated === 'weak') return reply(400, 'password-weak');
    if (updated !== 'ok') return reply(502, 'auth-unavailable');
    const revoked = (await deps.revokeSessions(userId)) || (await deps.revokeSessions(userId));
    return reply(200, revoked ? 'password-reset' : 'password-reset-sessions-kept');
}
