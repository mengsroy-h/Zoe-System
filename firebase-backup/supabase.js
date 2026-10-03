'use strict';

const FORMAT = 'zoe-supabase-tenant';
const FORMAT_VERSION = 1;
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);
const TENANT_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_RESPONSE_BYTES = 64 * 1024 * 1024;
const DEFAULT_PAGE_ROWS = 1000;
const DEFAULT_PAGE_BYTES = 2 * 1024 * 1024;
const TENANT_PAGE_ROWS = 200;
const MAX_EXPORT_PAGES = 100000;
const MAX_TENANT_PAGES = 10000;

function normalizeSupabaseUrl(raw) {
    let parsed;
    try {
        parsed = new URL(String(raw || '').trim());
    } catch (e) {
        throw new Error('Supabase url is not a valid URL.');
    }
    const loopback = parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost';
    const secure = parsed.protocol === 'https:' || (parsed.protocol === 'http:' && loopback);
    if (!secure || parsed.username || parsed.password || parsed.search || parsed.hash
        || (parsed.pathname !== '/' && parsed.pathname !== '')) {
        throw new Error('Supabase url must be the project root over HTTPS (https://<ref>.supabase.co); plain HTTP is allowed only for 127.0.0.1/localhost.');
    }
    return parsed.origin;
}

function jwtRole(token) {
    const parts = String(token).split('.');
    if (parts.length !== 3) return '';
    try {
        return String(JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')).role || '');
    } catch (e) {
        return '';
    }
}

function validateSecretKey(raw) {
    const key = typeof raw === 'string' ? raw.trim() : '';
    if (!key) throw new Error('Supabase secret key is missing.');
    if (/^sb_secret_[A-Za-z0-9_-]{8,}$/.test(key)) return key;
    if (/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(key) && jwtRole(key) === 'service_role') return key;
    if (/^sb_publishable_/.test(key) || jwtRole(key) === 'anon') {
        throw new Error('This is the publishable (anon) key. Backup and migration need a secret key (sb_secret_...).');
    }
    throw new Error('Supabase secret key has an unknown format (expected sb_secret_...).');
}

function authHeaders(key) {
    return /^sb_/.test(key) ? { apikey: key } : { apikey: key, Authorization: 'Bearer ' + key };
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function rpcError(fn, status, body) {
    const code = body && typeof body === 'object' && typeof body.code === 'string' ? body.code : '';
    const message = body && typeof body === 'object' && typeof body.message === 'string' ? body.message.slice(0, 200) : '';
    const error = new Error(fn + ' failed (HTTP ' + status + (code ? ' ' + code : '') + ')' + (message ? ': ' + message : '') + '.');
    error.status = status;
    error.pgCode = code;
    error.pgMessage = message;
    error.retryable = RETRYABLE_STATUS.has(status);
    return error;
}

function createClient(options) {
    const url = normalizeSupabaseUrl(options.url);
    const key = validateSecretKey(options.key);
    const timeoutMs = options.timeoutMs;
    const retryCount = options.retryCount;
    const retryDelayMs = options.retryDelayMs;
    const fetchImpl = options.fetchImpl || globalThis.fetch;
    const sleepImpl = options.sleepImpl || sleep;
    if (typeof fetchImpl !== 'function') throw new Error('Node.js 18 or newer is required (global fetch is unavailable).');
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || !Number.isInteger(retryCount) || retryCount < 0 || !Number.isInteger(retryDelayMs) || retryDelayMs < 0) {
        throw new Error('Supabase client needs whole-number timeoutMs, retryCount and retryDelayMs.');
    }

    async function attempt(fn, args) {
        const controller = new AbortController();
        let timer;
        const deadline = new Promise((resolve, reject) => {
            timer = setTimeout(() => {
                reject(Object.assign(new Error(fn + ' timed out after ' + timeoutMs + ' ms.'), { retryable: true, timedOut: true }));
            }, timeoutMs);
        });
        const call = (async () => {
            let response;
            try {
                response = await fetchImpl(url + '/rest/v1/rpc/' + fn, {
                    method: 'POST',
                    headers: Object.assign({ 'Content-Type': 'application/json', Accept: 'application/json' }, authHeaders(key)),
                    body: JSON.stringify(args),
                    signal: controller.signal
                });
            } catch (e) {
                throw Object.assign(new Error(fn + ' request failed (network error: no reply).'), { retryable: true });
            }
            const length = Number(response.headers && typeof response.headers.get === 'function' ? response.headers.get('content-length') : NaN);
            if (Number.isFinite(length) && length > MAX_RESPONSE_BYTES) {
                throw Object.assign(new Error(fn + ' reply is larger than ' + MAX_RESPONSE_BYTES + ' bytes.'), { retryable: false });
            }
            let text;
            try {
                text = await response.text();
            } catch (e) {
                throw Object.assign(new Error(fn + ' reply was cut off.'), { retryable: true });
            }
            let body = null;
            try {
                body = text ? JSON.parse(text) : null;
            } catch (e) {
                if (response.ok) throw Object.assign(new Error(fn + ' returned invalid JSON.'), { retryable: true });
            }
            if (!response.ok) throw rpcError(fn, response.status, body);
            return body;
        })();
        call.catch(() => {});
        try {
            return await Promise.race([call, deadline]);
        } finally {
            clearTimeout(timer);
            controller.abort();
        }
    }

    async function rpc(fn, args) {
        let lastError = null;
        for (let i = 0; i <= retryCount; i += 1) {
            try {
                return await attempt(fn, args);
            } catch (e) {
                lastError = e;
                if (!e || e.retryable !== true || i >= retryCount) throw e;
                await sleepImpl(retryDelayMs * Math.pow(2, i));
            }
        }
        throw lastError || new Error(fn + ' failed.');
    }

    return { url, host: new URL(url).host, rpc };
}

function putOwn(target, key, value) {
    Object.defineProperty(target, key, { value, enumerable: true, writable: true, configurable: true });
}

async function listTenants(client) {
    const out = [];
    let after = null;
    for (let page = 0; page < MAX_TENANT_PAGES; page += 1) {
        const res = await client.rpc('zoe_admin_tenants', { p_after: after, p_limit: TENANT_PAGE_ROWS });
        if (!res || !Array.isArray(res.tenants) || typeof res.more !== 'boolean') throw new Error('zoe_admin_tenants returned an unexpected reply.');
        for (const tenant of res.tenants) {
            if (!tenant || !TENANT_ID_RE.test(String(tenant.id))) throw new Error('zoe_admin_tenants returned an invalid tenant id.');
            out.push(tenant);
        }
        if (!res.more) return out;
        if (!TENANT_ID_RE.test(String(res.next)) || res.next === after) throw new Error('zoe_admin_tenants did not advance.');
        after = res.next;
    }
    throw new Error('zoe_admin_tenants paging did not finish within ' + MAX_TENANT_PAGES + ' pages.');
}

async function exportTenant(client, tenantId, options) {
    const o = options || {};
    if (!TENANT_ID_RE.test(String(tenantId))) throw new Error('Tenant id must be a UUID.');
    const pageRows = o.pageRows || DEFAULT_PAGE_ROWS;
    const pageBytes = o.pageBytes || DEFAULT_PAGE_BYTES;
    const since = Number.isInteger(o.since) && o.since > 0 ? o.since : 0;
    const data = Object.create(null);
    const changes = [];
    let cursor = { seq: since, root: '', key: '' };
    let threshold = since ? since : null;
    let head = 0;
    let rows = 0;
    let pages = 0;
    for (;;) {
        if (pages >= MAX_EXPORT_PAGES) throw new Error('Export of tenant ' + tenantId + ' did not finish within ' + MAX_EXPORT_PAGES + ' pages.');
        const res = await client.rpc('zoe_admin_export', {
            p_tenant: tenantId,
            p_after_seq: cursor.seq,
            p_after_root: cursor.root,
            p_after_key: cursor.key,
            p_tombstones_after: threshold,
            p_limit: pageRows,
            p_max_bytes: pageBytes
        });
        if (!res || !Array.isArray(res.rows) || typeof res.more !== 'boolean' || !Number.isFinite(Number(res.tombstones_after))) {
            throw new Error('zoe_admin_export returned an unexpected reply.');
        }
        pages += 1;
        if (threshold === null) threshold = Number(res.tombstones_after);
        if (Number(res.purged) > threshold) {
            throw new Error('Export of tenant ' + tenantId + ' overlapped a purge of old deletions; run it again.');
        }
        head = Number(res.head);
        for (const row of res.rows) {
            if (!row || typeof row.r !== 'string' || typeof row.k !== 'string' || !Object.prototype.hasOwnProperty.call(row, 'v')) {
                throw new Error('zoe_admin_export returned a malformed row.');
            }
            if (since && Number(row.s) > since) changes.push({ root: row.r, key: row.k, seq: Number(row.s), deleted: row.v === null });
            if (row.v === null) {
                const bucket = Object.prototype.hasOwnProperty.call(data, row.r) ? data[row.r] : null;
                if (bucket) {
                    delete bucket[row.k];
                    if (!Object.keys(bucket).length) delete data[row.r];
                }
            } else {
                if (!Object.prototype.hasOwnProperty.call(data, row.r)) putOwn(data, row.r, Object.create(null));
                putOwn(data[row.r], row.k, row.v);
            }
            rows += 1;
        }
        if (!res.more) break;
        const next = res.next;
        const moved = next && (Number(next.seq) > cursor.seq || (Number(next.seq) === cursor.seq
            && (String(next.root) !== cursor.root || String(next.key) !== cursor.key)));
        if (!moved || !res.rows.length) throw new Error('zoe_admin_export did not advance.');
        cursor = { seq: Number(next.seq), root: String(next.root), key: String(next.key) };
    }
    return { data, seq: head, rows, pages, tombstonesAfter: threshold, changes };
}

function rootCounts(data) {
    const roots = Object.create(null);
    let docs = 0;
    for (const root of Object.keys(data || {}).sort()) {
        const n = Object.keys(data[root] || {}).length;
        putOwn(roots, root, n);
        docs += n;
    }
    return { roots, docs };
}

function buildArchive(tenant, exported, host) {
    const counts = rootCounts(exported.data);
    return {
        format: FORMAT,
        version: FORMAT_VERSION,
        manifest: {
            tenant: {
                id: tenant.id,
                name: tenant.name,
                branch_code: tenant.branch_code,
                expires_at: tenant.expires_at,
                revoked: tenant.revoked
            },
            seq: exported.seq,
            docs: counts.docs,
            roots: counts.roots,
            exported_at: new Date().toISOString(),
            source: { kind: 'supabase', host }
        },
        data: exported.data
    };
}

function isArchive(value) {
    return !!value && typeof value === 'object' && value.format === FORMAT && value.version === FORMAT_VERSION
        && !!value.manifest && typeof value.manifest === 'object' && !!value.data && typeof value.data === 'object' && !Array.isArray(value.data);
}

module.exports = {
    FORMAT,
    FORMAT_VERSION,
    TENANT_ID_RE,
    buildArchive,
    createClient,
    exportTenant,
    isArchive,
    listTenants,
    normalizeSupabaseUrl,
    rootCounts,
    validateSecretKey
};
