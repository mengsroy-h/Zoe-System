import { withTimeout } from './timeout.ts';

export const GOOGLE_SECURETOKEN_JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
export const TOKEN_MAX_LENGTH = 4096;
export const DEFAULT_MAX_AUTH_AGE_SECONDS = 300;
export const DEFAULT_CLOCK_SKEW_SECONDS = 60;
export const FIREBASE_PROJECT_ID_RE = /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/;
const E164_RE = /^\+[1-9][0-9]{6,14}$/;
const KID_RE = /^[A-Za-z0-9_-]{1,128}$/;
const B64URL_RE = /^[A-Za-z0-9_-]*$/;

export interface FirebaseJwk {
    kid: string;
    n: string;
    e: string;
}

export type FirebaseKeySource = (refresh: boolean) => Promise<FirebaseJwk[]>;

export type PhoneTokenFailure =
    | 'server-unconfigured'
    | 'token-missing'
    | 'token-malformed'
    | 'token-alg'
    | 'token-kid'
    | 'token-aud'
    | 'token-iss'
    | 'token-expired'
    | 'token-future'
    | 'token-sub'
    | 'otp-stale'
    | 'otp-provider'
    | 'otp-phone'
    | 'token-signature'
    | 'keys-unavailable';

export type PhoneTokenVerdict =
    | { ok: true; uid: string; phone: string; authTime: number }
    | { ok: false; reason: PhoneTokenFailure };

export interface PhoneTokenOptions {
    projectId: string;
    keys: FirebaseKeySource;
    nowSeconds?: number;
    maxAuthAgeSeconds?: number;
    clockSkewSeconds?: number;
}

function b64urlBytes(part: string): Uint8Array<ArrayBuffer> | null {
    if (!B64URL_RE.test(part)) return null;
    try {
        const binary = atob(part.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((part.length + 3) % 4));
        const out = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
        return out;
    } catch {
        return null;
    }
}

function jsonObject(bytes: Uint8Array | null): Record<string, unknown> | null {
    if (!bytes) return null;
    try {
        const value: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
        return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
    } catch {
        return null;
    }
}

function finite(value: unknown): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : NaN;
}

export async function verifyFirebasePhoneToken(token: unknown, options: PhoneTokenOptions): Promise<PhoneTokenVerdict> {
    const fail = (reason: PhoneTokenFailure): PhoneTokenVerdict => ({ ok: false, reason });
    if (!FIREBASE_PROJECT_ID_RE.test(options.projectId || '')) return fail('server-unconfigured');
    if (typeof token !== 'string' || token.length === 0) return fail('token-missing');
    if (token.length > TOKEN_MAX_LENGTH) return fail('token-malformed');
    const parts = token.split('.');
    if (parts.length !== 3) return fail('token-malformed');
    const header = jsonObject(b64urlBytes(parts[0]));
    const payload = jsonObject(b64urlBytes(parts[1]));
    const signature = b64urlBytes(parts[2]);
    if (!header || !payload || !signature || signature.length === 0) return fail('token-malformed');
    if (header.alg !== 'RS256') return fail('token-alg');
    const kid = header.kid;
    if (typeof kid !== 'string' || !KID_RE.test(kid)) return fail('token-kid');
    if (payload.aud !== options.projectId) return fail('token-aud');
    if (payload.iss !== 'https://securetoken.google.com/' + options.projectId) return fail('token-iss');
    const now = options.nowSeconds ?? Math.floor(Date.now() / 1000);
    const skew = options.clockSkewSeconds ?? DEFAULT_CLOCK_SKEW_SECONDS;
    const exp = finite(payload.exp);
    const iat = finite(payload.iat);
    const authTime = finite(payload.auth_time);
    if (!(exp > now)) return fail('token-expired');
    if (!(iat <= now + skew) || !(authTime <= now + skew)) return fail('token-future');
    if (!(now - authTime <= (options.maxAuthAgeSeconds ?? DEFAULT_MAX_AUTH_AGE_SECONDS))) return fail('otp-stale');
    const sub = payload.sub;
    if (typeof sub !== 'string' || sub.length === 0 || sub.length > 128) return fail('token-sub');
    const firebase = payload.firebase;
    if (firebase === null || typeof firebase !== 'object' || (firebase as Record<string, unknown>).sign_in_provider !== 'phone') {
        return fail('otp-provider');
    }
    const phone = payload.phone_number;
    if (typeof phone !== 'string' || !E164_RE.test(phone)) return fail('otp-phone');
    let key: FirebaseJwk | undefined;
    try {
        key = (await options.keys(false)).find((k) => k.kid === kid);
        if (!key) key = (await options.keys(true)).find((k) => k.kid === kid);
    } catch {
        return fail('keys-unavailable');
    }
    if (!key) return fail('token-kid');
    let valid = false;
    try {
        const cryptoKey = await crypto.subtle.importKey('jwk', { kty: 'RSA', n: key.n, e: key.e, alg: 'RS256', ext: true },
            { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
        valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', cryptoKey, signature,
            new TextEncoder().encode(parts[0] + '.' + parts[1]));
    } catch {
        valid = false;
    }
    if (!valid) return fail('token-signature');
    return { ok: true, uid: sub, phone, authTime };
}

export interface KeySourceOptions {
    url?: string;
    ttlMs?: number;
    refreshGapMs?: number;
    timeoutMs?: number;
    now?: () => number;
}

function parseJwks(body: unknown): FirebaseJwk[] {
    const list = body !== null && typeof body === 'object' ? (body as Record<string, unknown>).keys : null;
    if (!Array.isArray(list)) throw new Error('keys-shape');
    const keys: FirebaseJwk[] = [];
    for (const item of list) {
        if (item === null || typeof item !== 'object') continue;
        const k = item as Record<string, unknown>;
        if (k.kty !== 'RSA' || typeof k.kid !== 'string' || typeof k.n !== 'string' || typeof k.e !== 'string') continue;
        if (k.alg !== undefined && k.alg !== 'RS256') continue;
        if (k.use !== undefined && k.use !== 'sig') continue;
        keys.push({ kid: k.kid, n: k.n, e: k.e });
    }
    if (keys.length === 0) throw new Error('keys-empty');
    return keys;
}

export function createCachedKeySource(fetchFn: typeof fetch, options: KeySourceOptions = {}): FirebaseKeySource {
    const url = options.url ?? GOOGLE_SECURETOKEN_JWKS_URL;
    const ttlMs = options.ttlMs ?? 3600000;
    const refreshGapMs = options.refreshGapMs ?? 30000;
    const timeoutMs = options.timeoutMs ?? 3000;
    const now = options.now ?? (() => Date.now());
    let cached: FirebaseJwk[] | null = null;
    let fetchedAt = -Infinity;
    let inFlight: Promise<FirebaseJwk[]> | null = null;
    const load = (): Promise<FirebaseJwk[]> => {
        if (inFlight) return inFlight;
        inFlight = (async () => {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), timeoutMs);
            try {
                const keys = await withTimeout((async () => {
                    const res = await fetchFn(url, { signal: controller.signal, headers: { accept: 'application/json' } });
                    if (!res.ok) throw new Error('keys-http-' + res.status);
                    return parseJwks(await res.json());
                })(), timeoutMs + 500, 'keys-timeout');
                cached = keys;
                fetchedAt = now();
                return keys;
            } catch (error) {
                fetchedAt = now();
                if (cached) return cached;
                throw error;
            } finally {
                clearTimeout(timer);
                inFlight = null;
            }
        })();
        return inFlight;
    };
    return async (refresh: boolean) => {
        const age = now() - fetchedAt;
        if (cached && age < ttlMs && !(refresh && age >= refreshGapMs)) return cached;
        return load();
    };
}
