export const INVITE_CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const INVITE_CODE_LENGTH = 20;
export const INVITE_CODE_INPUT_MAX = 64;
const INVITE_HASH_PREFIX = 'zoe-invite:';

export function normalizeInviteCode(raw: unknown): string | null {
    if (typeof raw !== 'string' || raw.length > INVITE_CODE_INPUT_MAX) return null;
    const cleaned = raw.replace(/[^0-9A-Za-z]/g, '').toUpperCase().replace(/O/g, '0').replace(/[IL]/g, '1');
    if (cleaned.length !== INVITE_CODE_LENGTH) return null;
    for (const ch of cleaned) {
        if (!INVITE_CODE_ALPHABET.includes(ch)) return null;
    }
    return cleaned;
}

export async function inviteCodeHash(normalized: string): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(INVITE_HASH_PREFIX + normalized));
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
