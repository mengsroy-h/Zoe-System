'use strict';

// ភស្តុតាងសង្កេតក្នុងមន្ទីរពិសោធន៍៖ មិនរក្សាបឋមកថា តួសំណើ token ឬសារកំហុសសេរី។
// មិនស្ទាក់សំណើ ឬជំនួស callback/promise/updater របស់កម្មវិធី។
const { createHmac, randomBytes } = require('node:crypto');
const installed = new WeakMap();
const EVENT_LIMIT = 256, PENDING_LIMIT = 128, SOCKET_LIMIT = 16, FRAME_LIMIT = 1024 * 1024;
const FIXTURE_PATHS = ['zoew_scan_history_cod_dod', 'zoew_recently_deleted_cod_dod'].map(root => root + '/sheet_flow_firebase_0_1');
// សោក្នុង process តែមួយឱ្យ context ទាំងបីប្រៀបធៀបបាន ដោយមិនរក្សាតារាង token ឬសោក្នុងភស្តុតាង។
const digestKey = randomBytes(32);
const canonical = value => value && typeof value === 'object'
    ? (Array.isArray(value) ? '[' + value.map(canonical).join(',') + ']'
        : '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}')
    : JSON.stringify(value);
const digest = (kind, value) => createHmac('sha256', digestKey).update(kind + '\0').update(canonical(value)).digest('hex').slice(0, 32);
const ROOT = /^zoew_(?:scan_history_cod_dod|recently_deleted_cod_dod|daily_pickup_cod_dod|daily_revenue_cod_dod|monthly_revenue_cod_dod|daily_collected_cod_dod|trash_consumptions|write_receipts)(?:\/|$)/;
const safePath = value => {
    if (typeof value !== 'string') return null;
    const path = value.replace(/^\//, '');
    return path.length <= 256 && ROOT.test(path) && /^[a-zA-Z0-9_/%.-]+$/.test(path) ? path : null;
};
const shape = value => {
    if (value === null) return { kind: 'null' };
    if (!value || typeof value !== 'object') return { kind: typeof value };
    const barcodes = value.barcodes && typeof value.barcodes === 'object' ? Object.values(value.barcodes) : [];
    return { kind: Array.isArray(value) ? 'array' : 'object', barcodes: barcodes.length,
        claimed: barcodes.filter(b => b && typeof b.trashClaim === 'string').length,
        deducted: barcodes.filter(b => b && b.isDeducted === true).length,
        restoreMarker: !!(value.restoreClaim || value.restoreClaimToken || value.restoreClaimId) };
};
const fixtureOperations = (wirePath, wireValue, includeMissing = true) => FIXTURE_PATHS.flatMap(target => {
    let path = wirePath, value = wireValue;
    if (path === target || path.startsWith(target + '/')) {
        if (!safePath(path)) return [];
    } else if (!path || target.startsWith(path + '/')) {
        for (const key of target.slice(path ? path.length + 1 : 0).split('/')) {
            const present = value && typeof value === 'object' && Object.hasOwn(value, key);
            if (!present && !includeMissing) return [];
            value = present ? value[key] : null;
        }
        path = target;
    } else return [];
    const relative = path.slice(target.length);
    const barcodes = relative === '' ? value?.barcodes : relative === '/barcodes' ? value : null;
    const tokens = barcodes && typeof barcodes === 'object' ? Object.values(barcodes).map(barcode => barcode?.trashClaim)
        : /^\/barcodes\/[^/]+$/.test(relative) ? [value?.trashClaim]
        : /^\/barcodes\/[^/]+\/trashClaim$/.test(relative) ? [value] : [];
    const aliases = [...new Set(tokens.filter(token => typeof token === 'string').map(token => 'claim-' + digest('claim', token)))];
    return [{ path, shape: shape(value), valueDigest: digest('value', value), claimAliases: aliases.slice(0, 16), truncatedClaims: Math.max(0, aliases.length - 16) }];
});
const wireValues = (path, value, merge) => merge && value && typeof value === 'object'
    ? Object.entries(value).map(([key, child]) => ({ path: [path, key].filter(Boolean).join('/'), value: child }))
    : [{ path, value }];

function installMoneyTransportTrace(ctx) {
    if (ctx && installed.has(ctx)) return installed.get(ctx);
    const events = [], requests = new WeakMap(), pages = new WeakSet(), sockets = new Map();
    let available = false, sequence = 0, requestSequence = 0, socketSequence = 0;
    let droppedEvents = 0, droppedPending = 0, droppedSockets = 0, unparsedFrames = 0, diagnosticErrors = 0;
    let duplicateRequestIds = 0, missingRequestIds = 0;
    const safely = fn => (...args) => { try { fn(...args); } catch (_) { diagnosticErrors++; } };
    const record = fields => {
        events.push({ seq: ++sequence, at: Date.now(), ...fields });
        if (events.length > EVENT_LIMIT) { droppedEvents += events.length - EVENT_LIMIT; events.splice(0, events.length - EVENT_LIMIT); }
    };
    const requestPath = req => {
        const url = new URL(req.url());
        if (!['127.0.0.1', 'localhost'].includes(url.hostname) || !url.pathname.endsWith('.json')) return null;
        return safePath(url.pathname.slice(0, -5));
    };
    const attachSocket = safely(socket => {
        const url = new URL(socket.url());
        if (!['127.0.0.1', 'localhost'].includes(url.hostname) || url.pathname !== '/.ws') return;
        const state = { id: ++socketSequence, pending: new Map(), active: true };
        sockets.set(state.id, state);
        if (sockets.size > SOCKET_LIMIT) {
            const oldest = sockets.get(sockets.keys().next().value);
            droppedPending += oldest.pending.size; droppedSockets++; oldest.active = false; oldest.pending.clear(); sockets.delete(oldest.id);
        }
        const frame = (direction, event) => {
            if (!state.active) return;
            const text = typeof event.payload === 'string' ? event.payload : Buffer.isBuffer(event.payload) ? event.payload.toString('utf8') : '';
            if (!text || text.length > FRAME_LIMIT) { unparsedFrames++; return; }
            if (/^\d+$/.test(text)) { if (text !== '0') unparsedFrames++; return; }
            let message;
            try { message = JSON.parse(text); } catch (_) { unparsedFrames++; return; }
            const d = message && message.t === 'd' && message.d;
            if (!d || typeof d !== 'object') return;
            const hasRequest = Number.isSafeInteger(d.r);
            if (direction === 'sent') {
                // លេខស្ទួនមិនអាចកំណត់ ACK ឱ្យសំណើណាមួយបាន ទោះសំណើទីពីរមិនស្ថិតក្នុងវិសាលភាពដាន។
                const duplicate = hasRequest && state.pending.has(d.r);
                if (duplicate) { state.pending.set(d.r, null); duplicateRequestIds++; }
                if (!['p', 'm'].includes(d.a) || !d.b || typeof d.b.p !== 'string' || !Object.hasOwn(d.b, 'd')) return;
                if (d.a === 'm' && (!d.b.d || typeof d.b.d !== 'object' || Array.isArray(d.b.d))) return;
                const base = d.b.p.replace(/^\//, '');
                const values = wireValues(base, d.b.d, d.a === 'm' || !base);
                const selected = values.filter(op => safePath(op.path));
                const fixture = wireValues(base, d.b.d, d.a === 'm').flatMap(op => fixtureOperations(op.path, op.value));
                if ((!selected.length && !fixture.length) || (!hasRequest && !fixture.length)) return;
                const operations = selected.slice(0, 16).map(op => ({ path: safePath(op.path), shape: shape(op.value) }));
                const entry = { operations, truncatedOperations: Math.max(0, selected.length - operations.length) };
                if (fixture.length) Object.assign(entry, { action: d.a, casHashPresent: Object.hasOwn(d.b, 'h'), casHashEmpty: d.b.h === '',
                    baseHashDigest: typeof d.b.h === 'string' ? digest('base-hash', d.b.h) : null,
                    fixtureOperations: fixture.slice(0, 16), truncatedFixtureOperations: Math.max(0, fixture.length - 16) });
                if (hasRequest && !duplicate) state.pending.set(d.r, entry);
                if (!hasRequest) missingRequestIds++;
                if (state.pending.size > PENDING_LIMIT) { state.pending.delete(state.pending.keys().next().value); droppedPending++; }
                record({ phase: 'ws-write', socket: state.id, request: hasRequest ? d.r : null, ...entry,
                    ...(!hasRequest ? { correlation: 'missing-id' } : duplicate ? { correlation: 'duplicate-id' } : {}) });
            } else {
                if (['d', 'm'].includes(d.a) && d.b && typeof d.b.p === 'string' && Object.hasOwn(d.b, 'd')) {
                    if (d.a === 'm' && (!d.b.d || typeof d.b.d !== 'object' || Array.isArray(d.b.d))) return;
                    const queryTagged = Object.hasOwn(d.b, 't');
                    const fixture = wireValues(d.b.p.replace(/^\//, ''), d.b.d, d.a === 'm').flatMap(op => fixtureOperations(op.path, op.value, !queryTagged));
                    if (fixture.length) record({ phase: 'ws-push', socket: state.id, action: d.a, queryTagged,
                        fixtureOperations: fixture.slice(0, 16), truncatedFixtureOperations: Math.max(0, fixture.length - 16) });
                    return;
                }
                if (!hasRequest || !state.pending.has(d.r) || !d.b || typeof d.b.s !== 'string') return;
                const entry = state.pending.get(d.r);
                state.pending.delete(d.r);
                const status = ['ok', 'datastale', 'permission_denied', 'maxretry', 'error'].includes(d.b.s) ? d.b.s : 'other';
                record({ phase: 'ws-ack', socket: state.id, request: d.r, status, ...(entry || { correlation: 'duplicate-id' }) });
            }
        };
        socket.on('framesent', safely(event => frame('sent', event)));
        socket.on('framereceived', safely(event => frame('received', event)));
        socket.on('close', safely(() => { droppedPending += state.pending.size; state.pending.clear(); state.active = false; sockets.delete(state.id); }));
    });
    const attachPage = safely(page => {
        if (pages.has(page)) return;
        pages.add(page); page.on('websocket', attachSocket);
    });
    const recorder = { snapshot() {
        return JSON.parse(JSON.stringify({ available, scope: 'firebase-emulator', websocketBoundary: 'server-wire-not-app-settlement', limit: EVENT_LIMIT, droppedEvents,
            digestScope: 'node-process', droppedPending, droppedSockets, unparsedFrames, diagnosticErrors, duplicateRequestIds, missingRequestIds,
            pendingRequests: [...sockets.values()].reduce((sum, state) => sum + state.pending.size, 0), events }));
    } };
    if (ctx && (typeof ctx === 'object' || typeof ctx === 'function')) installed.set(ctx, recorder);
    if (!ctx || typeof ctx.on !== 'function') return recorder;
    try {
        ctx.on('request', safely(req => {
            const path = requestPath(req); if (!path) return;
            const rawMethod = req.method(), method = ['GET', 'PUT', 'POST', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].includes(rawMethod) ? rawMethod : 'OTHER';
            const entry = { request: ++requestSequence, path, method }; requests.set(req, entry);
            record({ phase: 'http-start', ...entry });
        }));
        ctx.on('response', safely(res => {
            const req = res.request(), entry = requests.get(req); if (!entry) return;
            requests.delete(req);
            const status = res.status(); record({ phase: 'http-response', ...entry, status: Number.isInteger(status) ? status : null });
        }));
        ctx.on('requestfailed', safely(req => {
            const entry = requests.get(req); if (!entry) return;
            requests.delete(req);
            const error = req.failure()?.errorText;
            record({ phase: 'http-failed', ...entry, failure: typeof error === 'string' && error.length <= 80 && /^net::[A-Z_]+$/.test(error) ? error : 'request-failed' });
        }));
        ctx.on('page', attachPage); available = true;
        if (typeof ctx.pages === 'function') ctx.pages().forEach(attachPage);
    } catch (_) { diagnosticErrors++; }
    return recorder;
}

module.exports = { installMoneyTransportTrace };
