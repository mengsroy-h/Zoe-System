'use strict';

const crypto = require('node:crypto');
const FORMAT = 'zoe-supabase-tenant';
const FORMAT_VERSION = 2;
const AUDIT_FORMAT = 'zoe-business-audit';
const AUDIT_VERSION = 1;
const MAX_AUDIT_ARCHIVE_EVENTS = 20000;
const MAX_AUDIT_ARCHIVE_BYTES = 32 * 1024 * 1024;
const AUDIT_EVENT_KEYS = ['event_id', 'schema_version', 'tenant_id', 'origin_tenant_id', 'operation_id', 'seq', 'actor_uid', 'actor_kind',
    'origin', 'root', 'record_key', 'action', 'reason', 'status_source', 'previous_status', 'new_status', 'before_value', 'after_value',
    'changed_fields', 'changed_fields_truncated', 'summary_unchanged', 'projection_scope', 'committed_at'].sort();
const AUDIT_ROOTS = new Set(['zoew_scan_history_cod_dod', 'zoew_recently_deleted_cod_dod', 'zoew_daily_revenue_cod_dod', 'zoew_monthly_revenue_cod_dod',
    'zoew_daily_pickup_cod_dod', 'zoew_daily_collected_cod_dod', 'zoew_scan_operations', 'zoew_trash_consumptions', 'zoew_restore_finalizations', 'zoew_registry_releases']);
const AUDIT_SUMMARY_KEYS = new Set(('id sourceId targetId restoreClaimId restoreSourceId restorePendingClaimId restoreSourceGeneration code barcode cod dod price count codDollar dodDollar totalCount packagesPickedUp pickupRevision pickupResetEpoch trashGeneration generation birth rowBirth createdAt deletedAt claimedAt finalizedAt closedAt restoredAt ztoSignedAt ztoSignedExact ztoReturnedAt ztoSentOutAt ztoMisplacedAt isClosed isDeducted restoreBlocked isFromDeletion isCalled trashReason trashMode phase kind c d exists location barcodes collected pickedUpPhoneCount pickedUpBarcodes opsCount dedCount backCount undoCount restoreClaim claimCorrelationHash restoreAddedCodes total sampleLimit truncated sample sha256 closed deducted signed returnEvidence returned entryKey entryKeyTruncated length malformed zoewClosed barcodeCount closedCount deductedCount observedSignedCount effectiveReturnedCount observedReturnEvidenceCount').split(' '));
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
                    redirect: 'error',
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
            if (Buffer.byteLength(text) > MAX_RESPONSE_BYTES) throw Object.assign(new Error(fn + ' reply exceeds the response byte limit.'), { retryable: false });
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

function object(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function stableJson(value) {
    return JSON.stringify(value, (_key, found) => {
        if (!object(found)) return found;
        const sorted = Object.create(null);
        for (const key of Object.keys(found).sort()) putOwn(sorted, key, found[key]);
        return sorted;
    });
}

function auditDigest(events) {
    auditBudget(events);
    return crypto.createHash('sha256').update(stableJson(events)).digest('hex');
}

function auditLimits(options) {
    const opts = options || {};
    const events = opts.maxAuditEvents === undefined ? MAX_AUDIT_ARCHIVE_EVENTS : opts.maxAuditEvents;
    const bytes = opts.maxAuditBytes === undefined ? MAX_AUDIT_ARCHIVE_BYTES : opts.maxAuditBytes;
    if (!Number.isInteger(events) || events < 1 || events > MAX_AUDIT_ARCHIVE_EVENTS
        || !Number.isInteger(bytes) || bytes < 2 || bytes > MAX_AUDIT_ARCHIVE_BYTES) throw new Error('Audit archive aggregate budget is invalid.');
    return { events, bytes };
}

function auditJsonBytes(value, limit) {
    let bytes = 0;
    const add = size => {
        bytes += size;
        if (bytes > limit) throw new Error('Audit archive aggregate byte budget exceeded; no history was truncated. This history requires a segmented archive implementation before the full backup/import can continue.');
    };
    const string = text => {
        add(2);
        for (let index = 0; index < text.length; index++) {
            const code = text.charCodeAt(index);
            if (code < 32) add(6);
            else if (code === 34 || code === 92) add(2);
            else if (code < 128) add(1);
            else if (code < 2048) add(2);
            else if (code >= 0xd800 && code <= 0xdbff && text.charCodeAt(index + 1) >= 0xdc00 && text.charCodeAt(index + 1) <= 0xdfff) { add(4); index++; }
            else add(code >= 0xd800 && code <= 0xdfff ? 6 : 3);
        }
    };
    const walk = (found, depth) => {
        if (depth > 32) throw new Error('Audit archive JSON nesting exceeds its bounded schema.');
        if (found === null) add(4);
        else if (typeof found === 'boolean') add(found ? 4 : 5);
        else if (typeof found === 'string') string(found);
        else if (typeof found === 'number' && Number.isFinite(found)) add(String(found).length);
        else if (Array.isArray(found)) {
            add(2 + Math.max(0, found.length - 1));
            for (const child of found) walk(child, depth + 1);
        } else if (object(found)) {
            const keys = Object.keys(found);
            add(2 + Math.max(0, keys.length - 1));
            for (const key of keys) { string(key); add(1); walk(found[key], depth + 1); }
        } else throw new Error('Audit archive contains a non-JSON value.');
    };
    walk(value, 0);
    return bytes;
}

function auditBudget(events, options) {
    const limits = auditLimits(options);
    if (!Array.isArray(events) || events.length > limits.events) throw new Error('Audit archive aggregate event budget exceeded; no history was truncated. This history requires a segmented archive implementation before the full backup/import can continue.');
    return auditJsonBytes(events, limits.bytes);
}

function assertAuditMergeBudget(existing, incoming) {
    const limits = auditLimits();
    let count = existing.length, bytes = auditBudget(existing);
    const ids = new Set(existing.map(event => event.event_id));
    for (const event of incoming) {
        if (ids.has(event.event_id)) continue;
        if (count >= limits.events) throw new Error('Merged audit history exceeds the aggregate event budget before import; no document writes were started.');
        bytes += (count ? 1 : 0) + auditJsonBytes(event, limits.bytes - bytes - (count ? 1 : 0));
        ids.add(event.event_id); count++;
    }
}

function decimal(value, zero = true) {
    return typeof value === 'string' && (zero ? /^(0|[1-9][0-9]*)$/ : /^[1-9][0-9]*$/).test(value)
        && value.length <= 19 && BigInt(value) <= 9223372036854775807n;
}

function uuid(value) {
    return typeof value === 'string' && TENANT_ID_RE.test(value) && value === value.toLowerCase();
}

function jsonSafe(value, depth = 0) {
    if (depth > 32) return false;
    if (value === null || typeof value === 'boolean') return true;
    if (typeof value === 'number') return Number.isFinite(value) && (!Number.isInteger(value) || Number.isSafeInteger(value));
    if (typeof value === 'string') return !/[\u0000]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(value);
    if (!object(value) && !Array.isArray(value)) return false;
    return Object.entries(value).every(([key, child]) => jsonSafe(key, depth + 1) && jsonSafe(child, depth + 1));
}

function auditSummary(value) {
    if (!object(value) || typeof value.exists !== 'boolean' || !['absent', 'history', 'trash', 'business_record'].includes(value.location) || !jsonSafe(value)) return false;
    const pending = [value];
    while (pending.length) {
        const node = pending.pop();
        if (Array.isArray(node)) { pending.push(...node); continue; }
        if (!object(node)) continue;
        for (const [key, child] of Object.entries(node)) {
            if (!AUDIT_SUMMARY_KEYS.has(key) && !(key.endsWith('Bounds') && AUDIT_SUMMARY_KEYS.has(key.slice(0, -6)))) return false;
            pending.push(child);
        }
    }
    return true;
}

function auditTimestamp(value) {
    if (typeof value !== 'string' || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{6}Z$/.test(value) || Number(value.slice(0, 4)) < 1) return false;
    const epoch = Date.parse(value);
    return Number.isFinite(epoch) && new Date(epoch).toISOString().slice(0, 19) === value.slice(0, 19);
}

function validateAuditEvent(event, tenant) {
    const text = value => typeof value === 'string' && value.length > 0 && Buffer.byteLength(value) <= 768 && jsonSafe(value);
    if (!object(event) || stableJson(Object.keys(event).sort()) !== stableJson(AUDIT_EVENT_KEYS)
        || event.schema_version !== 1 || !uuid(event.event_id) || event.tenant_id !== tenant || !uuid(event.origin_tenant_id)
        || !decimal(event.seq, false) || typeof event.operation_id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(event.operation_id)
        || event.actor_uid !== null && !uuid(event.actor_uid) || !['user', 'admin', 'system'].includes(event.actor_kind)
        || !['app_engine', 'admin_engine', 'direct_sql'].includes(event.origin) || !AUDIT_ROOTS.has(event.root)
        || !text(event.record_key) || /[.#$/[\]\u0000-\u001f\u007f]/.test(event.record_key)
        || !['create', 'update', 'delete', 'remove', 'cleanup', 'restore', 'purge', 'observed_zto_sign', 'observed_zto_return'].includes(event.action)
        || !['record_created', 'record_removed', 'stored_fields_changed', 'delete', 'remove', 'pickup', 'returned', 'stored_consumption', 'stored_positive_sign_mark', 'stored_positive_return_mark'].includes(event.reason)
        || event.actor_kind === 'user' && event.actor_uid === null || event.actor_kind === 'system' && event.actor_uid !== null
        || event.origin === 'app_engine' && event.actor_kind !== 'user' || event.origin === 'admin_engine' && event.actor_kind !== 'admin'
        || event.status_source !== 'stored_business_state' || event.projection_scope !== 'bounded_business_fields'
        || !['previous_status', 'new_status', 'before_value', 'after_value'].every(key => auditSummary(event[key]))
        || !Array.isArray(event.changed_fields) || event.changed_fields.length > 32 || !event.changed_fields.every(text)
        || new Set(event.changed_fields).size !== event.changed_fields.length
        || !event.changed_fields.every(key => Object.prototype.hasOwnProperty.call(event.before_value, key) || Object.prototype.hasOwnProperty.call(event.after_value, key))
        || typeof event.changed_fields_truncated !== 'boolean' || typeof event.summary_unchanged !== 'boolean'
        || !auditTimestamp(event.committed_at)
        || Buffer.byteLength(JSON.stringify(event.before_value)) + Buffer.byteLength(JSON.stringify(event.after_value)) > 131072) {
        throw new Error('Audit archive contains an unsupported, corrupt or incorrectly scoped event.');
    }
    return event;
}

function validateAuditEnvelope(audit, tenant) {
    if (!object(audit) || stableJson(Object.keys(audit).sort()) !== stableJson(['events', 'format', 'tenant', 'through', 'version'])
        || audit.format !== AUDIT_FORMAT || audit.version !== AUDIT_VERSION || !uuid(tenant) || audit.tenant !== tenant
        || !decimal(audit.through) || !Array.isArray(audit.events)) throw new Error('Unsupported or corrupt audit archive envelope.');
    auditBudget(audit.events);
    const ids = new Set();
    for (const event of audit.events) {
        validateAuditEvent(event, tenant);
        if (ids.has(event.event_id)) throw new Error('Audit archive contains duplicate event IDs.');
        ids.add(event.event_id);
    }
    return audit;
}

async function exportAudit(client, tenantId, options) {
    const opts = options || {};
    const limit = opts.auditPageRows || 200, maxBytes = opts.auditPageBytes || DEFAULT_PAGE_BYTES;
    if (!Number.isInteger(limit) || limit < 1 || limit > 500 || !Number.isInteger(maxBytes) || maxBytes < 65536 || maxBytes > 4194304) {
        throw new Error('Audit export page bounds are invalid.');
    }
    let after = '0', through = null;
    const limits = auditLimits(opts);
    let bytes = 2;
    const events = [], ids = new Set();
    for (let page = 0; page < MAX_EXPORT_PAGES; page++) {
        const res = await client.rpc('zoe_admin_audit_export', { p_tenant: tenantId, p_after: after, p_through: through, p_limit: limit, p_max_bytes: maxBytes });
        if (!object(res) || res.v !== 1 || res.tenant !== tenantId || !decimal(res.through) || !Array.isArray(res.rows)
            || res.rows.length > limit || typeof res.more !== 'boolean' || through !== null && res.through !== through) {
            throw new Error('Audit export returned an invalid or changing snapshot ceiling.');
        }
        through = res.through;
        for (const event of res.rows) {
            if (events.length >= limits.events) throw new Error('Audit archive aggregate event budget exceeded; no history was truncated. This history requires a segmented archive implementation before the full backup/import can continue.');
            bytes += (events.length ? 1 : 0) + auditJsonBytes(event, limits.bytes - bytes - (events.length ? 1 : 0));
            validateAuditEvent(event, tenantId);
            if (ids.has(event.event_id)) throw new Error('Audit export returned duplicate event IDs.');
            ids.add(event.event_id); events.push(event);
        }
        if (!res.more) {
            if (res.next !== null) throw new Error('Audit export returned an invalid final cursor.');
            return validateAuditEnvelope({ format: AUDIT_FORMAT, version: AUDIT_VERSION, tenant: tenantId, through, events }, tenantId);
        }
        if (!res.rows.length || !decimal(res.next, false) || BigInt(res.next) <= BigInt(after) || BigInt(res.next) > BigInt(through)) {
            throw new Error('Audit export paging did not advance within its snapshot.');
        }
        after = res.next;
    }
    throw new Error('Audit export paging did not finish.');
}

async function listTenants(client, options) {
    const out = [];
    let after = null;
    for (let page = 0; page < MAX_TENANT_PAGES; page += 1) {
        const res = await client.rpc('zoe_admin_tenants', { p_after: after, p_limit: TENANT_PAGE_ROWS });
        if (!res || !Array.isArray(res.tenants) || typeof res.more !== 'boolean') throw new Error('zoe_admin_tenants returned an unexpected reply.');
        for (const tenant of res.tenants) {
            if (!tenant || !TENANT_ID_RE.test(String(tenant.id))) throw new Error('zoe_admin_tenants returned an invalid tenant id.');
            out.push(tenant);
        }
        if (!res.more) {
            if (!options || options.includeAudit !== true) return out;
            const owners = new Set(out.map(tenant => tenant.id)), seen = new Set();
            let cursor = null;
            for (let auditPage = 0; auditPage < MAX_TENANT_PAGES; auditPage++) {
                const audit = await client.rpc('zoe_admin_audit_tenants', { p_after: cursor, p_limit: TENANT_PAGE_ROWS });
                if (!object(audit) || !Array.isArray(audit.tenants) || audit.tenants.length > TENANT_PAGE_ROWS || typeof audit.more !== 'boolean') throw new Error('Audit tenant enumeration returned an unexpected reply.');
                let last = cursor;
                for (const id of audit.tenants) {
                    if (!uuid(id) || seen.has(id) || last && id <= last) throw new Error('Audit tenant enumeration returned an invalid or repeated owner.');
                    seen.add(id);
                    last = id;
                    if (!owners.has(id)) { owners.add(id); out.push({ id, audit_only: true }); }
                }
                if (!audit.more) return out.sort((a, b) => a.id.localeCompare(b.id));
                if (!audit.tenants.length || !uuid(audit.next) || audit.next !== last || cursor && audit.next <= cursor) throw new Error('Audit tenant enumeration did not advance.');
                cursor = audit.next;
            }
            throw new Error('Audit tenant enumeration did not finish.');
        }
        if (!TENANT_ID_RE.test(String(res.next)) || res.next === after) throw new Error('zoe_admin_tenants did not advance.');
        after = res.next;
    }
    throw new Error('zoe_admin_tenants paging did not finish within ' + MAX_TENANT_PAGES + ' pages.');
}

async function exportTenant(client, tenantId, options) {
    const o = options || {};
    if (!TENANT_ID_RE.test(String(tenantId))) throw new Error('Tenant id must be a UUID.');
    if (o.auditOnly === true) return { data: Object.create(null), seq: 0, rows: 0, pages: 0, tombstonesAfter: 0, changes: [], audit: await exportAudit(client, tenantId, o) };
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
    return { data, seq: head, rows, pages, tombstonesAfter: threshold, changes, ...(o.includeAudit === false ? {} : { audit: await exportAudit(client, tenantId, o) }) };
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
    const audit = validateAuditEnvelope(exported.audit, tenant.id);
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
            audit: { version: AUDIT_VERSION, events: audit.events.length, sha256: auditDigest(audit.events) },
            ...(tenant.audit_only === true || counts.docs === 0 && audit.events.length > 0 ? { audit_only: true } : {}),
            exported_at: new Date().toISOString(),
            source: { kind: 'supabase', host }
        },
        data: exported.data,
        audit
    };
}

function isArchive(value) {
    return !!value && typeof value === 'object' && value.format === FORMAT && [1, FORMAT_VERSION].includes(value.version)
        && !!value.manifest && typeof value.manifest === 'object' && !!value.data && typeof value.data === 'object' && !Array.isArray(value.data);
}

function validateArchive(value) {
    if (!isArchive(value)) throw new Error('Unsupported or malformed Supabase archive (supported versions: 1 and 2).');
    if (value.version === 1) {
        if (Object.prototype.hasOwnProperty.call(value, 'audit') || Object.prototype.hasOwnProperty.call(value.manifest, 'audit')) {
            throw new Error('Audit history requires a version 2 archive; legacy audit fields cannot be ignored.');
        }
        return null;
    }
    if (stableJson(Object.keys(value).sort()) !== stableJson(['audit', 'data', 'format', 'manifest', 'version'])) throw new Error('Audit archive contains unsupported envelope fields.');
    const audit = validateAuditEnvelope(value.audit, value.manifest.tenant && value.manifest.tenant.id);
    const summary = value.manifest.audit;
    if (!object(summary) || stableJson(Object.keys(summary).sort()) !== stableJson(['events', 'sha256', 'version']) || summary.version !== AUDIT_VERSION || summary.events !== audit.events.length
        || summary.sha256 !== auditDigest(audit.events) || value.manifest.audit_only !== undefined && typeof value.manifest.audit_only !== 'boolean'
        || value.manifest.audit_only === true && Object.keys(value.data).length) throw new Error('Audit archive manifest or integrity digest is corrupt.');
    return audit;
}

module.exports = {
    FORMAT,
    FORMAT_VERSION,
    TENANT_ID_RE,
    AUDIT_FORMAT,
    AUDIT_VERSION,
    MAX_AUDIT_ARCHIVE_EVENTS,
    MAX_AUDIT_ARCHIVE_BYTES,
    auditDigest,
    assertAuditMergeBudget,
    buildArchive,
    createClient,
    exportTenant,
    exportAudit,
    isArchive,
    listTenants,
    normalizeSupabaseUrl,
    rootCounts,
    validateSecretKey,
    validateArchive,
    validateAuditEnvelope
};
