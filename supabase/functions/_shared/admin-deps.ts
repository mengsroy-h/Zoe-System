import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.117.2';
import { FINISH_REASONS } from './account-core.ts';
import type { CreateUserResult, FinishReason, FinishResult, UpdatePasswordResult } from './account-core.ts';
import { withTimeout } from './timeout.ts';

export const ADMIN_CALL_TIMEOUT_MS = 8000;
const EXISTS_CODES = new Set(['email_exists', 'user_already_exists', 'phone_exists']);
const WEAK_CODES = new Set(['weak_password']);

function errorCode(error: unknown): string {
    const code = error !== null && typeof error === 'object' ? (error as Record<string, unknown>).code : undefined;
    return typeof code === 'string' ? code : '';
}

function errorMessage(error: unknown): string {
    const message = error !== null && typeof error === 'object' ? (error as Record<string, unknown>).message : undefined;
    return typeof message === 'string' ? message : '';
}

export function adminDeps(client: SupabaseClient, timeoutMs = ADMIN_CALL_TIMEOUT_MS) {
    return {
        async inviteIsUsable(codeHash: string): Promise<boolean | null> {
            try {
                const { data, error } = await withTimeout(Promise.resolve(client.rpc('invite_is_usable', { p_code_hash: codeHash })), timeoutMs, 'timeout');
                if (error || typeof data !== 'boolean') return null;
                return data;
            } catch {
                return null;
            }
        },
        async createUser(email: string, password: string): Promise<CreateUserResult> {
            try {
                const { data, error } = await withTimeout(client.auth.admin.createUser({ email, password, email_confirm: true }), timeoutMs, 'timeout');
                if (error) {
                    const code = errorCode(error);
                    if (EXISTS_CODES.has(code)) return { ok: false, reason: 'exists' };
                    if (WEAK_CODES.has(code)) return { ok: false, reason: 'weak' };
                    return { ok: false, reason: 'unavailable' };
                }
                const id = data && data.user ? data.user.id : '';
                return id ? { ok: true, userId: id } : { ok: false, reason: 'unavailable' };
            } catch {
                return { ok: false, reason: 'unavailable' };
            }
        },
        async finishRegistration(input: { userId: string; codeHash: string; username: string }): Promise<FinishResult> {
            try {
                const { data, error } = await withTimeout(Promise.resolve(client.rpc('finish_registration', {
                    p_user_id: input.userId,
                    p_code_hash: input.codeHash,
                    p_username: input.username
                })), timeoutMs, 'timeout');
                if (error) {
                    const message = errorMessage(error);
                    const known = (FINISH_REASONS as readonly string[]).includes(message);
                    return { ok: false, reason: known ? message as FinishReason : 'unavailable' };
                }
                const row = Array.isArray(data) ? data[0] : null;
                if (!row || typeof row.tenant_id !== 'string' || typeof row.role !== 'string') return { ok: false, reason: 'unavailable' };
                return { ok: true, tenantId: row.tenant_id, role: row.role };
            } catch {
                return { ok: false, reason: 'unavailable' };
            }
        },
        async deleteUser(userId: string): Promise<boolean> {
            try {
                const { error } = await withTimeout(client.auth.admin.deleteUser(userId), timeoutMs, 'timeout');
                return !error;
            } catch {
                return false;
            }
        },
        async claimResetCode(username: string, codeHash: string, claimId: string): Promise<string | null | undefined> {
            try {
                const { data, error } = await withTimeout(Promise.resolve(client.rpc('claim_reset_code', { p_username: username, p_code_hash: codeHash, p_claim_id: claimId })), timeoutMs, 'timeout');
                if (error) return undefined;
                if (data === null) return null;
                return typeof data === 'string' ? data : undefined;
            } catch {
                return undefined;
            }
        },
        async settleResetCode(username: string, codeHash: string, claimId: string, consumed: boolean): Promise<boolean> {
            try {
                const { data, error } = await withTimeout(Promise.resolve(client.rpc('settle_reset_code', { p_username: username, p_code_hash: codeHash, p_claim_id: claimId, p_consumed: consumed })), timeoutMs, 'timeout');
                return !error && data === true;
            } catch {
                return false;
            }
        },
        async revokeSessions(userId: string): Promise<boolean> {
            try {
                const { data, error } = await withTimeout(Promise.resolve(client.rpc('revoke_user_sessions', { p_user_id: userId })), timeoutMs, 'timeout');
                return !error && typeof data === 'number';
            } catch {
                return false;
            }
        },
        async updatePassword(userId: string, password: string): Promise<UpdatePasswordResult> {
            try {
                const { error } = await withTimeout(client.auth.admin.updateUserById(userId, { password }), timeoutMs, 'timeout');
                if (!error) return 'ok';
                return WEAK_CODES.has(errorCode(error)) ? 'weak' : 'unavailable';
            } catch {
                return 'unavailable';
            }
        }
    };
}
