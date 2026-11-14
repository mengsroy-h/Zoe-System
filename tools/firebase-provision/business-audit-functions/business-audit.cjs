'use strict';

const { createHash } = require('node:crypto');
const { isDeepStrictEqual } = require('node:util');

const AUDIT_ROOT = 'zoew_business_audit_v1';
const FAILURE_ROOT = 'zoew_business_audit_failures_v1';
const SAMPLE_LIMIT = 20;
const CHANGED_FIELDS_LIMIT = 32;
const BUSINESS_ROOTS = Object.freeze([
    'zoew_scan_history_cod_dod', 'zoew_recently_deleted_cod_dod',
    'zoew_daily_revenue_cod_dod', 'zoew_monthly_revenue_cod_dod',
    'zoew_daily_pickup_cod_dod', 'zoew_daily_collected_cod_dod',
    'zoew_scan_operations', 'zoew_trash_consumptions', 'zoew_registry_releases', 'zoew_restore_finalizations'
]);
const REASONS = new Set(['delete', 'remove', 'pickup', 'returned']);
const MODES = new Set(['local', 'sheet', 'cookie', 'palm']);
const PHASES = new Set(['admitted', 'prepared', 'committed', 'cancelled']);
const plain = value => !!value && typeof value === 'object' && !Array.isArray(value);
const number = value => typeof value === 'number' && Number.isFinite(value) ? value : undefined;
const integer = value => Number.isSafeInteger(value) && value >= 0 ? value : undefined;
const digest = value => createHash('sha256').update(typeof value === 'string' ? value : stable(value)).digest('hex');

function compact(value) {
    if (value === null || value === undefined) return undefined;
    if (Array.isArray(value)) {
        const entries = value.map(compact).filter(entry => entry !== undefined);
        return entries.length ? entries : undefined;
    }
    if (plain(value)) {
        const out = {};
        for (const key of Object.keys(value).sort()) {
            const entry = compact(value[key]);
            if (entry !== undefined) out[key] = entry;
        }
        return Object.keys(out).length ? out : undefined;
    }
    return value;
}

function stable(value) { return JSON.stringify(compact(value)); }

function businessId(value) {
    return typeof value === 'string' && value.length > 0 && value.length <= 2048 ? value : undefined;
}

function code(value) {
    if (typeof value !== 'string' || !value) return {};
    return value.length <= 2048 ? { code: value } : { codePrefix: value.slice(0, 2048), codeDigest: digest(value), codeTruncated: true };
}

function barcodeSummary(value, parent) {
    const summary = { ...code(value.code), cod: number(value.cod), dod: number(value.dod),
        closed: value.isClosed === true, deducted: value.isDeducted === true };
    for (const field of ['createdAt', 'restoredAt', 'closedAt', 'ztoSignedAt', 'ztoReturnedAt', 'ztoSentOutAt', 'ztoMisplacedAt']) {
        if (number(value[field]) > 0) summary[field] = value[field];
    }
    if (value.ztoSignedExact === true) summary.ztoSignedExact = true;
    const returnBasis = Math.max(number(value.createdAt) || number(parent?.createdAt) || 0, number(value.restoredAt) || 0, number(parent?.restoredAt) || 0);
    const signBasis = Math.max(number(value.restoredAt) || 0, number(parent?.restoredAt) || 0);
    const signed = number(value.ztoSignedAt) > 0 && value.ztoSignedAt >= signBasis ? value.ztoSignedAt : 0;
    const returned = value.isClosed !== true && number(value.ztoReturnedAt) > 0 && value.ztoReturnedAt >= returnBasis ? value.ztoReturnedAt : 0;
    const sent = number(value.ztoSentOutAt) > 0 && value.ztoSentOutAt >= returnBasis ? value.ztoSentOutAt : 0;
    const misplaced = number(value.ztoMisplacedAt) > 0 && value.ztoMisplacedAt >= returnBasis ? value.ztoMisplacedAt : 0;
    summary.effectiveZtoState = signed ? 'signed' : returned > Math.max(sent, misplaced) ? 'returned'
        : sent && sent >= misplaced ? 'sent' : misplaced ? 'misplaced' : 'unknown';
    summary.returnBasis = returnBasis; summary.signBasis = signBasis;
    return compact(summary);
}

function barcodesOf(value) {
    const source = value.barcodes;
    if (source && typeof source === 'object') return Object.keys(source).sort().map(key => source[key]).filter(plain);
    return typeof value.barcode === 'string' && value.barcode ? [{ code: value.barcode, isClosed: value.isClosed, isDeducted: value.isDeducted }] : [];
}

function summarizeBarcodes(value) {
    const entries = barcodesOf(value), hash = createHash('sha256'), samples = [];
    const counts = { total: entries.length, closed: 0, deducted: 0, signed: 0, returned: 0, sent: 0, misplaced: 0, unknown: 0 };
    let codCents = 0, dodCents = 0;
    for (const barcode of entries) {
        const selected = barcodeSummary(barcode, value);
        hash.update(stable(selected)); hash.update('\n');
        if (samples.length < SAMPLE_LIMIT) samples.push(selected);
        if (barcode.isClosed === true) counts.closed++;
        if (barcode.isDeducted === true) counts.deducted++;
        counts[selected.effectiveZtoState]++;
        codCents += Math.round((number(barcode.cod) || 0) * 100);
        dodCents += Math.round((number(barcode.dod) || 0) * 100);
    }
    const aggregateMoneyExact = Number.isSafeInteger(codCents) && Number.isSafeInteger(dodCents);
    return compact({ ...counts, samples, sampleLimit: SAMPLE_LIMIT, sampleTruncated: entries.length > SAMPLE_LIMIT,
        digest: hash.digest('hex'), aggregateMoneyExact,
        cod: aggregateMoneyExact ? codCents / 100 : undefined, dod: aggregateMoneyExact ? dodCents / 100 : undefined });
}

function logicalOperation(value, root) {
    if (!plain(value)) return undefined;
    const sourceId = businessId(value.sourceId), targetId = businessId(value.targetId);
    if (value.kind === 'restore' && sourceId && targetId && businessId(value.token) && integer(value.generation) !== undefined) {
        return 'restore:' + digest(value.token);
    }
    if (root === 'zoew_restore_finalizations' && businessId(value.token) && targetId) return 'restore:' + digest(value.token);
    const restoreToken = businessId(value.restoreClaim?.token) || businessId(value.restoreClaimToken);
    if (restoreToken) return 'restore:' + digest(restoreToken);
    if (businessId(value.id) && /^scan_[a-f0-9]{32}$/.test(value.id)) return value.id;
    if (businessId(value.scanIntent) && /^scan_[a-f0-9]{32}$/.test(value.scanIntent)) return value.scanIntent;
    return undefined;
}

function projectRecord(root, value, recordId) {
    if (value === null || value === undefined) return { exists: false, status: 'absent' };
    if (!plain(value)) return { exists: true, status: 'invalid_business_shape', omitted: true };
    const out = { exists: true, status: 'present', statusProvenance: 'stored_business_state' };
    const money = root.includes('revenue')
        ? { codDollar: number(value.codDollar), dodDollar: number(value.dodDollar), totalCount: number(value.totalCount) }
        : { codDollar: number(value.cod), dodDollar: number(value.dod), totalCount: number(value.count) };
    out.money = compact(money);
    if (root === 'zoew_scan_history_cod_dod' || root === 'zoew_recently_deleted_cod_dod') {
        out.barcodes = summarizeBarcodes(value);
        out.status = root === 'zoew_recently_deleted_cod_dod' ? 'trash'
            : out.barcodes.total && out.barcodes.closed === out.barcodes.total ? 'closed'
                : out.barcodes.closed ? 'mixed' : 'open';
        const ztoStates = ['signed', 'returned', 'sent', 'misplaced', 'unknown'].filter(state => out.barcodes[state] > 0);
        out.ztoStatus = ztoStates.length > 1 ? 'mixed' : ztoStates[0] || 'unknown';
        out.trash = compact({ reason: REASONS.has(value.trashReason) ? value.trashReason : undefined,
            mode: MODES.has(value.trashMode) ? value.trashMode : undefined, generation: integer(value.trashGeneration),
            deletedAt: number(value.deletedAt), restoreBlocked: value.restoreBlocked === true });
        const token = businessId(value.restoreClaim?.token) || businessId(value.restoreClaimToken);
        if (token) out.restore = compact({ sourceId: root === 'zoew_recently_deleted_cod_dod'
            ? businessId(recordId) || businessId(value.id) : businessId(value.restoreClaimId),
            targetId: root === 'zoew_scan_history_cod_dod'
                ? businessId(recordId) || businessId(value.id) : businessId(value.restoreClaim?.targetId),
            attemptHash: digest(token), phase: value.restoreClaim ? 'claimed' : 'prepared' });
    } else if (root === 'zoew_daily_pickup_cod_dod') {
        const keys = plain(value.pickedUpBarcodes) ? Object.keys(value.pickedUpBarcodes).sort() : [];
        out.pickup = compact({ packagesPickedUp: number(value.packagesPickedUp), revision: integer(value.pickupRevision),
            resetEpoch: integer(value.pickupResetEpoch),
            barcodeCount: keys.length, barcodeDigest: digest(keys), barcodeSamples: keys.slice(0, SAMPLE_LIMIT).map(code),
            barcodeSampleLimit: SAMPLE_LIMIT, barcodeSampleTruncated: keys.length > SAMPLE_LIMIT,
            phoneCount: plain(value.pickedUpPhones) ? Object.keys(value.pickedUpPhones).length : 0 });
    } else if (root === 'zoew_daily_collected_cod_dod') {
        const hash = createHash('sha256'), samples = []; let total = 0, codCents = 0, dodCents = 0;
        for (const key of Object.keys(value).sort()) {
            const row = value[key];
            if (!plain(row) || number(row.c) === undefined || number(row.d) === undefined) continue;
            const selected = { ...code(key), cod: row.c, dod: row.d };
            hash.update(stable(selected)); hash.update('\n'); total++;
            codCents += Math.round(row.c * 100); dodCents += Math.round(row.d * 100);
            if (samples.length < SAMPLE_LIMIT) samples.push(selected);
        }
        const aggregateMoneyExact = Number.isSafeInteger(codCents) && Number.isSafeInteger(dodCents);
        out.collected = compact({ total, samples, sampleLimit: SAMPLE_LIMIT, sampleTruncated: total > SAMPLE_LIMIT,
            digest: hash.digest('hex'), aggregateMoneyExact, cod: aggregateMoneyExact ? codCents / 100 : undefined,
            dod: aggregateMoneyExact ? dodCents / 100 : undefined });
    } else if (root === 'zoew_scan_operations') {
        out.operation = compact({ ...code(value.code), phase: PHASES.has(value.phase) ? value.phase : undefined,
            targetId: businessId(value.targetId), birth: number(value.birth), logicalOperationId: logicalOperation(value, root) });
        if (PHASES.has(value.phase)) out.status = value.phase;
    } else if (root === 'zoew_trash_consumptions' || root === 'zoew_registry_releases') {
        out.operation = compact({ kind: ['restore', 'purge', 'scan', 'legacy'].includes(value.kind) ? value.kind : undefined,
            sourceId: businessId(value.sourceId || value.trashId), targetId: businessId(value.targetId),
            generation: integer(value.generation), deletedAt: number(value.deletedAt), rowBirth: number(value.rowBirth),
            ...code(value.code), logicalOperationId: logicalOperation(value, root) });
        if (value.kind === 'restore' || value.kind === 'purge') out.status = value.kind === 'restore' ? 'restored' : 'purged';
    } else if (root === 'zoew_restore_finalizations') {
        out.proof = compact({ kind: 'restore_finalization', sourceId: businessId(recordId), targetId: businessId(value.targetId),
            finalizedAt: number(value.finalizedAt), attemptHash: businessId(value.token) ? digest(value.token) : undefined });
        out.status = 'finalized';
    }
    const logicalOperationId = logicalOperation(value, root);
    if (logicalOperationId) out.logicalOperationId = logicalOperationId;
    return compact(out);
}

function changedFields(before, after) {
    const all = [];
    const visit = (left, right, path) => {
        if (stable(left) === stable(right)) return;
        if (plain(left) && plain(right)) {
            for (const key of [...new Set([...Object.keys(left), ...Object.keys(right)])].sort()) visit(left[key], right[key], path ? path + '.' + key : key);
        } else all.push(path || '$');
    };
    visit(before, after, '');
    return { fields: all.slice(0, CHANGED_FIELDS_LIMIT), total: all.length, truncated: all.length > CHANGED_FIELDS_LIMIT };
}

function classify(root, before, after) {
    const movement = !before.exists ? 'create' : !after.exists ? 'delete' : 'update';
    if (root === 'zoew_trash_consumptions' && after.exists && ['restore', 'purge'].includes(after.operation?.kind)) return after.operation.kind + '.commit';
    if (root === 'zoew_scan_operations' && after.operation?.phase) return 'scan.' + after.operation.phase;
    if (root.includes('revenue')) return 'money.' + movement;
    if (root === 'zoew_daily_pickup_cod_dod') return 'pickup.' + movement;
    if (root === 'zoew_daily_collected_cod_dod') return 'collected.' + movement;
    if (root === 'zoew_registry_releases') return 'registry_release.' + movement;
    if (root === 'zoew_restore_finalizations') return 'restore.finalization.' + movement;
    if (movement === 'update') {
        if ((after.barcodes?.signed || 0) > (before.barcodes?.signed || 0)) return 'zto.sign.observed';
        if ((after.barcodes?.returned || 0) > (before.barcodes?.returned || 0)) return 'zto.return.observed';
    }
    return (root === 'zoew_recently_deleted_cod_dod' ? 'trash.' : 'history.') + movement;
}

function validateConfig(config) {
    if (!config || !/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(config.projectId || '')
        || !/^[a-zA-Z0-9-]{1,100}$/.test(config.instance || '') || !/^[A-Za-z0-9_-]{1,128}$/.test(config.branchId || '')
        || !/^[a-z]+-[a-z]+[1-9][0-9]*$/.test(config.region || '') || config.runtimeProjectId !== config.projectId
        || config.emulatorHost && !/^(?:127\.0\.0\.1|localhost):[0-9]{1,5}$/.test(config.emulatorHost)) throw new Error('AUDIT_TARGET_CONFIG');
    return Object.freeze({ ...config });
}

function emulatorDatabaseUrl(config) {
    validateConfig(config);
    if (!config.emulatorHost) throw new Error('AUDIT_TARGET_CONFIG');
    return 'http://' + config.emulatorHost + '/?ns=' + config.instance;
}

function providerRootMatches(endpoint, config, dbRoot, verifyEmulatorRoot) {
    if (config.emulatorHost && endpoint.protocol === 'http:' && endpoint.host === config.emulatorHost
        && (!endpoint.searchParams.has('ns') || endpoint.searchParams.get('ns') === config.instance)) {
        const app = dbRoot.database?.app;
        try {
            return !!app && (!app.options?.projectId || app.options.projectId === config.projectId)
                && typeof verifyEmulatorRoot === 'function' && verifyEmulatorRoot(dbRoot, config) === true;
        } catch (_) { return false; }
    }
    return endpoint.protocol === 'https:' && (endpoint.hostname === config.instance + '.firebaseio.com'
        || new RegExp('^' + config.instance + '\\.[a-z]+-[a-z]+[0-9]+\\.firebasedatabase\\.app$').test(endpoint.hostname));
}

function validateProvider(root, recordId, context, config) {
    if (typeof recordId !== 'string' || !recordId || recordId.length > 768 || /[.#$\[\]/]/.test(recordId)) throw new Error('AUDIT_RECORD_REFUSED');
    const expected = `projects/_/instances/${config.instance}/refs/${root}/${recordId}`;
    if (context?.resource?.name !== expected || context?.resource?.service !== 'firebaseio.com'
        || typeof context.eventId !== 'string' || !context.eventId || context.eventId.length > 2048
        || typeof context.timestamp !== 'string' || !Number.isFinite(Date.parse(context.timestamp))) throw new Error('AUDIT_PROVIDER_CONTEXT');
}

function buildEvent(root, recordId, beforeValue, afterValue, context, config) {
    validateConfig(config);
    if (!BUSINESS_ROOTS.includes(root)) throw new Error('AUDIT_ROOT_REFUSED');
    validateProvider(root, recordId, context, config);
    const before = projectRecord(root, beforeValue, recordId), after = projectRecord(root, afterValue, recordId), changes = changedFields(before, after);
    const priorAssignments = beforeValue?.pickedUpBarcodes, nextAssignments = afterValue?.pickedUpBarcodes;
    const redactedOwnershipChanged = root === 'zoew_daily_pickup_cod_dod' && plain(priorAssignments) && plain(nextAssignments)
        && [...new Set([...Object.keys(priorAssignments), ...Object.keys(nextAssignments)])].some(key => priorAssignments[key] !== nextAssignments[key]);
    if (redactedOwnershipChanged) {
        changes.total++;
        if (changes.fields.length < CHANGED_FIELDS_LIMIT) changes.fields.push('pickup.redactedOwnership'); else changes.truncated = true;
    }
    const unrepresentedChange = !changes.total && !isDeepStrictEqual(beforeValue, afterValue);
    if (unrepresentedChange) { changes.fields.push('unrepresented_or_redacted'); changes.total++; }
    if (!changes.total) return null;
    const actor = context.authType === 'USER' && businessId(context.auth?.uid)
        ? { kind: 'user', uid: context.auth.uid }
        : { kind: context.authType === 'ADMIN' ? 'admin' : context.authType === 'UNAUTHENTICATED' ? 'unauthenticated' : 'unknown' };
    const logicalOperationId = after.logicalOperationId || before.logicalOperationId;
    const action = classify(root, before, after);
    const reason = after.trash?.reason || before.trash?.reason || after.operation?.kind || before.operation?.kind || after.proof?.kind || before.proof?.kind
        || (!before.exists ? 'record_created' : !after.exists ? 'record_deleted' : unrepresentedChange ? 'unrepresented_or_redacted_change' : 'selected_fields_changed');
    const eventId = digest([config.projectId, config.instance, context.eventId, root, recordId]);
    const event = compact({ schemaVersion: 1, backend: 'firebase', eventId, providerEventId: context.eventId,
        correlationId: context.eventId, logicalOperationId, projectId: config.projectId, instance: config.instance,
        branchId: config.branchId, root, recordId, actor, action, reason,
        committedAt: new Date(context.timestamp).toISOString(), timestampSource: 'provider_event',
        previousStatus: before.status, newStatus: after.status, statusProvenance: 'stored_business_state',
        before, after, changedFields: changes.fields, changedFieldsTotal: changes.total, changedFieldsTruncated: changes.truncated,
        redactedOwnershipChanged: redactedOwnershipChanged || undefined,
        unrepresentedChange: unrepresentedChange || undefined,
        projection: { version: 1, barcodeSampleLimit: SAMPLE_LIMIT, changedFieldsLimit: CHANGED_FIELDS_LIMIT,
            omittedFields: ['customer_identity', 'phone', 'photo', 'freeform_text', 'credentials', 'settings', 'ledger_operation_maps'] } });
    event.fingerprint = digest(event);
    return event;
}

function auditError(code) { return Object.assign(new Error(code), { code }); }

function createHandler(root, config, dependencies = {}) {
    validateConfig(config);
    if (!BUSINESS_ROOTS.includes(root)) throw auditError('AUDIT_ROOT_REFUSED');
    return async (change, context) => {
        const recordId = context?.params?.recordId;
        validateProvider(root, recordId, context, config);
        const before = change.before.val(), after = change.after.val();
        const event = buildEvent(root, recordId, before, after, context, config);
        if (!event) return { ignored: true };
        const dbRoot = change.after.ref.root;
        const endpoint = new URL(dbRoot.toString());
        if (!providerRootMatches(endpoint, config, dbRoot, dependencies.verifyEmulatorRoot)) throw auditError('AUDIT_PROVIDER_INSTANCE');
        const ref = dbRoot.child(AUDIT_ROOT + '/' + event.eventId);
        const failure = dbRoot.child(FAILURE_ROOT + '/' + event.eventId + '/' + event.fingerprint);
        try {
            let collision = false;
            const result = await ref.transaction(current => {
                if (current === null) return event;
                if (stable(current) === stable(event)) return;
                collision = true;
                return;
            }, undefined, false);
            if (collision) throw auditError('AUDIT_EVENT_COLLISION');
            if (!result?.snapshot || stable(result.snapshot.val()) !== stable(event)) throw auditError('AUDIT_EVENT_UNPROVEN');
            const failureSnapshot = await failure.get();
            if (failureSnapshot.exists()) {
                const retainedFailure = failureSnapshot.val();
                await failure.transaction(current => ({ ...retainedFailure, ...(current || {}), status: 'resolved', resolutionEventId: event.eventId }), undefined, false);
            }
            return { eventId: event.eventId, duplicate: !result.committed };
        } catch (error) {
            const failureCode = error?.code === 'AUDIT_EVENT_COLLISION' ? 'AUDIT_EVENT_COLLISION' : 'AUDIT_WRITE_RETRY_REQUIRED';
            try {
                await failure.transaction(current => ({ schemaVersion: 1, eventId: event.eventId, fingerprint: event.fingerprint,
                    status: failureCode === 'AUDIT_EVENT_COLLISION' ? 'collision' : 'retry_required', failureCode,
                    attempts: Math.min(Number.isSafeInteger(current?.attempts) ? current.attempts + 1 : 1, Number.MAX_SAFE_INTEGER),
                    candidateEvent: event }), undefined, false);
            } catch (_) {}
            throw auditError(failureCode);
        }
    };
}

module.exports = { AUDIT_ROOT, FAILURE_ROOT, BUSINESS_ROOTS, SAMPLE_LIMIT, CHANGED_FIELDS_LIMIT,
    projectRecord, changedFields, buildEvent, validateConfig, emulatorDatabaseUrl, createHandler, stable };
