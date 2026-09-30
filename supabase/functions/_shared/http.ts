import type { HandlerResult } from './account-core.ts';
import { FIREBASE_PROJECT_ID_RE } from './firebase-phone-token.ts';

export const MAX_BODY_BYTES = 8192;
const LOGIN_DOMAIN_RE = /^(?=.{4,190}$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;
const PHONE_PREFIX_RE = /^\+[1-9][0-9]{0,3}$/;
const DEFAULT_PHONE_PREFIXES = '+855';

export interface FunctionConfig {
    ok: boolean;
    problems: string[];
    supabaseUrl: string;
    secretKey: string;
    otpProjectId: string;
    loginDomain: string;
    allowedOrigins: string[];
    phonePrefixes: string[];
}

function list(raw: string | undefined): string[] {
    return String(raw ?? '').split(',').map((part) => part.trim()).filter((part) => part.length > 0);
}

function exactOrigin(raw: string): boolean {
    try {
        const url = new URL(raw);
        return (url.protocol === 'https:' || (url.protocol === 'http:' && url.hostname === 'localhost')) && url.origin === raw;
    } catch {
        return false;
    }
}

export function readConfig(get: (name: string) => string | undefined): FunctionConfig {
    const problems: string[] = [];
    const supabaseUrl = String(get('SUPABASE_URL') ?? '').trim();
    let urlOk = false;
    try {
        const url = new URL(supabaseUrl);
        urlOk = url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1', 'kong'].includes(url.hostname));
    } catch {
        urlOk = false;
    }
    if (!urlOk) problems.push('SUPABASE_URL');
    const secretKey = String(get('ZOE_SECRET_KEY') || get('SUPABASE_SERVICE_ROLE_KEY') || '').trim();
    if (secretKey.length < 20) problems.push('ZOE_SECRET_KEY');
    const otpProjectId = String(get('ZOE_OTP_FIREBASE_PROJECT_ID') ?? '').trim();
    if (!FIREBASE_PROJECT_ID_RE.test(otpProjectId)) problems.push('ZOE_OTP_FIREBASE_PROJECT_ID');
    const loginDomain = String(get('ZOE_LOGIN_DOMAIN') ?? '').trim().toLowerCase();
    if (!LOGIN_DOMAIN_RE.test(loginDomain) || !loginDomain.endsWith('.invalid')) problems.push('ZOE_LOGIN_DOMAIN');
    const allowedOrigins = list(get('ZOE_ALLOWED_ORIGINS'));
    if (allowedOrigins.length === 0 || !allowedOrigins.every(exactOrigin)) problems.push('ZOE_ALLOWED_ORIGINS');
    const phonePrefixes = list(get('ZOE_PHONE_PREFIXES') ?? DEFAULT_PHONE_PREFIXES);
    if (phonePrefixes.length === 0 || !phonePrefixes.every((p) => PHONE_PREFIX_RE.test(p))) problems.push('ZOE_PHONE_PREFIXES');
    return { ok: problems.length === 0, problems, supabaseUrl, secretKey, otpProjectId, loginDomain, allowedOrigins, phonePrefixes };
}

function json(status: number, body: unknown, headers: Record<string, string>): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
    });
}

export async function handleHttp(
    request: Request,
    config: FunctionConfig,
    allowHeaders: string,
    handler: (body: unknown) => Promise<HandlerResult>
): Promise<Response> {
    const origin = request.headers.get('origin');
    const allowed = origin !== null && config.allowedOrigins.includes(origin);
    const cors: Record<string, string> = allowed
        ? {
            'Access-Control-Allow-Origin': origin,
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': allowHeaders,
            'Access-Control-Max-Age': '7200',
            Vary: 'Origin'
        }
        : { Vary: 'Origin' };
    if (origin !== null && !allowed) return json(403, { ok: false, code: 'origin-denied' }, cors);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return json(405, { ok: false, code: 'method-not-allowed' }, { ...cors, Allow: 'POST, OPTIONS' });
    if (!config.ok) return json(503, { ok: false, code: 'server-unconfigured' }, cors);
    const declared = Number(request.headers.get('content-length') ?? '0');
    if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return json(413, { ok: false, code: 'body-too-large' }, cors);
    let text: string;
    try {
        text = await request.text();
    } catch {
        return json(400, { ok: false, code: 'bad-request' }, cors);
    }
    if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) return json(413, { ok: false, code: 'body-too-large' }, cors);
    let body: unknown;
    try {
        body = JSON.parse(text);
    } catch {
        return json(400, { ok: false, code: 'bad-request' }, cors);
    }
    try {
        const result = await handler(body);
        return json(result.status, result.body, cors);
    } catch {
        return json(500, { ok: false, code: 'internal' }, cors);
    }
}
