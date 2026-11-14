// @vitest-environment node
import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const audit = require('../../../firebase-provision/business-audit-functions/business-audit.cjs');
const H = 'zoew_scan_history_cod_dod', T = 'zoew_recently_deleted_cod_dod';
const config = { projectId: 'zoe-audit-test', runtimeProjectId: 'zoe-audit-test', instance: 'zoe-audit-test-default-rtdb', branchId: 'QA_001', region: 'asia-southeast1' };
const copy = <T>(value: T): T => value === undefined ? value : structuredClone(value);
function context(root = H, id = 'row1', eventId = 'provider-event-001', extra = {}) {
    return { eventId, timestamp: '2026-11-14T06:00:00.123Z', authType: 'USER', auth: { uid: 'actual-server-user', token: { secret: 'must-never-copy-token' } },
        resource: { service: 'firebaseio.com', name: `projects/_/instances/${config.instance}/refs/${root}/${id}` }, params: { recordId: id }, ...extra };
}
const barcode = (code = 'QA000001', extra: { ztoSignedAt?: number; [key: string]: unknown } = {}) => ({ code, cod: 7, dod: 2, isClosed: false, isDeducted: false, ...extra });
const row = (extra = {}) => ({ id: 'row1', cod: 7, dod: 2, count: 1, barcodes: [barcode()], ...extra });
function memory() {
    const data = new Map<string, any>(), loaded = new Set<string>(); let tail = Promise.resolve(), writes = 0, calls = 0;
    const faults = { before: 0, after: 0, coldFailureTransactions: false, offline: false, failureReads: 0 };
    const root = { toString: () => `https://${config.instance}.firebaseio.com/`, child(path: string) {
        return { async get() {
            if (faults.offline || faults.failureReads-- > 0) throw new Error('synthetic read unavailable');
            loaded.add(path); const value = copy(data.get(path) ?? null); return { val: () => copy(value), exists: () => value !== null };
        },
            async transaction(update: (current: any) => any) {
            const prior = tail; let release!: () => void; tail = new Promise<void>(resolve => { release = resolve; }); await prior;
            try {
                if (faults.offline) throw new Error('synthetic database unavailable');
                calls++;
                const current = faults.coldFailureTransactions && path.startsWith(audit.FAILURE_ROOT + '/') && !loaded.has(path)
                    ? null : copy(data.get(path) ?? null);
                const next = update(current);
                if (next === undefined) return { committed: false, snapshot: { val: () => copy(current) } };
                if (path.startsWith(audit.AUDIT_ROOT + '/') && faults.before > 0) { faults.before--; throw new Error('private transport failure before commit'); }
                data.set(path, copy(next));
                if (path.startsWith(audit.AUDIT_ROOT + '/')) {
                    writes++;
                    if (faults.after > 0) { faults.after--; throw new Error('private transport failure after commit'); }
                }
                return { committed: true, snapshot: { val: () => copy(next) } };
            } finally { release(); }
        } };
    } };
    return { data, faults, root, writes: () => writes, calls: () => calls,
        change(before: any, after: any) { return { before: { val: () => copy(before) }, after: { val: () => copy(after), ref: { root } } }; } };
}

describe('trusted Firebase business audit projection', () => {
    it.each(['zoew_settings', 'auth', 'sessions', audit.AUDIT_ROOT, audit.FAILURE_ROOT, 'unknown_root'])('allowlist refuses %s before reading any snapshot', root => {
        expect(() => audit.createHandler(root, config)).toThrow('AUDIT_ROOT_REFUSED');
        expect(() => audit.buildEvent(root, 'row1', null, { token: 'private' }, context(root), config)).toThrow('AUDIT_ROOT_REFUSED');
    });
    it('binds configured project and provider instance/path before reading data', async () => {
        expect(() => audit.createHandler(H, { ...config, runtimeProjectId: 'another-project' })).toThrow('AUDIT_TARGET_CONFIG');
        const handler = audit.createHandler(H, config), change = { before: { val: () => { throw new Error('snapshot must not be read'); } } };
        await expect(handler(change, context(H, 'row1', 'event', { resource: { service: 'firebaseio.com', name: 'projects/_/instances/foreign/refs/' + H + '/row1' } }))).rejects.toThrow('AUDIT_PROVIDER_CONTEXT');
    });
    it('uses server identity/time, emits no customer/credential/freeform data and does not copy ledger maps', () => {
        const secret = 'PRIVATE_CANARY_DO_NOT_COPY';
        const value = row({ actorUid: 'forged-user', phone: secret, name: secret, address: secret, cookie: secret, token: secret,
            photo: secret, trashReason: secret, trashMode: secret, restoreClaim: { token: 'known-business-attempt', targetId: 'target' }, settings: { password: secret },
            barcodes: [barcode('QA000001', { phone: secret, photo: secret, cookie: secret })] });
        const event = audit.buildEvent(T, 'row1', null, value, context(T), config);
        expect(event.actor).toEqual({ kind: 'user', uid: 'actual-server-user' });
        expect(event.committedAt).toBe('2026-11-14T06:00:00.123Z');
        expect(event.statusProvenance).toBe('stored_business_state');
        expect(JSON.stringify(event)).not.toContain(secret); expect(JSON.stringify(event)).not.toContain('must-never-copy-token');
        expect(JSON.stringify(event)).not.toContain('known-business-attempt');
        const ledger = audit.buildEvent('zoew_daily_revenue_cod_dod', '2026-11-14', null,
            { codDollar: 10, dodDollar: 2, totalCount: 1, ded: { secret }, ops: { secret }, password: secret }, context('zoew_daily_revenue_cod_dod', '2026-11-14'), config);
        expect(ledger.after.money).toEqual({ codDollar: 10, dodDollar: 2, totalCount: 1 });
        expect(JSON.stringify(ledger)).not.toContain(secret);
    });
    it.each([['ADMIN', 'admin'], ['UNAUTHENTICATED', 'unauthenticated'], [undefined, 'unknown']])('keeps truthful %s provenance without inventing a UID', (authType, kind) => {
        const event = audit.buildEvent(H, 'row1', null, row(), context(H, 'row1', 'event', { authType, auth: undefined }), config);
        expect(event.actor).toEqual({ kind });
    });
    it('does not equate ZoeW close, Palm pickup, or restoreBlocked with actual Sign evidence', () => {
        const event = audit.buildEvent(T, 'row1', null, row({ isClosed: true, trashMode: 'palm', trashReason: 'pickup', restoreBlocked: true,
            barcodes: [barcode('QA000001', { isClosed: true })] }), context(T), config);
        expect(event.after.ztoStatus).toBe('unknown'); expect(event.after.barcodes.signed).toBe(0);
        expect(event.action).not.toBe('zto.sign.observed');
    });
    it.each(['sent', 'misplaced'])('return-compatible %s stamp is not a genuine return event', kind => {
        const marked = barcode('QA000001', { ztoReturnedAt: 200, [kind === 'sent' ? 'ztoSentOutAt' : 'ztoMisplacedAt']: 200 });
        const event = audit.buildEvent(T, 'row1', row({ trashReason: 'returned' }), row({ trashReason: 'returned', barcodes: [marked] }), context(T), config);
        expect(event.after.ztoStatus).toBe(kind); expect(event.after.barcodes.returned).toBe(0);
        expect(event.action).not.toBe('zto.return.observed');
    });
    it.each(['sent', 'misplaced'])('a newer genuine return supersedes the older %s evidence', kind => {
        const marked = barcode('QA000001', { createdAt: 100, ztoReturnedAt: 300, [kind === 'sent' ? 'ztoSentOutAt' : 'ztoMisplacedAt']: 200 });
        const event = audit.buildEvent(T, 'row1', row({ trashReason: 'returned' }), row({ trashReason: 'returned', barcodes: [marked] }), context(T), config);
        expect(event.after.ztoStatus).toBe('returned'); expect(event.after.barcodes.returned).toBe(1);
    });
    it.each(['ztoReturnedAt', 'ztoSentOutAt', 'ztoMisplacedAt'])('stale %s before current barcode incarnation is evidence, not current status', field => {
        const event = audit.buildEvent(T, 'row1', null, row({ barcodes: [barcode('QA000001', { createdAt: 100, restoredAt: 400, [field]: 300 })] }), context(T), config);
        expect(event.after.ztoStatus).toBe('unknown'); expect(event.after.barcodes.unknown).toBe(1);
        expect(event.after.barcodes.samples[0][field]).toBe(300);
    });
    it('closed barcode return stamp remains raw evidence rather than current return eligibility', () => {
        const event = audit.buildEvent(T, 'row1', null, row({ barcodes: [barcode('QA000001', { createdAt: 100, isClosed: true, ztoReturnedAt: 300 })] }), context(T), config);
        expect(event.after.ztoStatus).toBe('unknown'); expect(event.after.barcodes.returned).toBe(0);
        expect(event.after.barcodes.samples[0].ztoReturnedAt).toBe(300);
    });
    it('retains bounded samples and exact all-barcode totals/digest without a functional document cap', () => {
        const entries = Array.from({ length: 257 }, (_, index) => barcode('QA' + String(index).padStart(6, '0')));
        const before = audit.projectRecord(H, row({ barcodes: entries }));
        entries[256].ztoSignedAt = 1234;
        const after = audit.projectRecord(H, row({ barcodes: entries }));
        expect(after.barcodes.total).toBe(257); expect(after.barcodes.samples).toHaveLength(20); expect(after.barcodes.sampleTruncated).toBe(true);
        expect(after.barcodes.cod).toBe(1799); expect(after.barcodes.dod).toBe(514); expect(after.barcodes.signed).toBe(1);
        expect(after.barcodes.digest).not.toBe(before.barcodes.digest);
    });
    it('retains create/delete previous/new status and explicit reason without inferring restore from history marker removal', () => {
        const before = row({ restoreClaimId: 'source', restoreClaimToken: 'known-business-attempt', restoreAddedCodes: '["QA000001"]' });
        const event = audit.buildEvent(H, 'row1', before, row(), context(), config);
        expect(event).not.toBeNull(); expect(event.action).toBe('history.update');
        expect(event.before.restore?.attemptHash).toMatch(/^[a-f0-9]{64}$/); expect(event.after.restore).toBeUndefined();
        const removed = audit.buildEvent(T, 'row1', row({ trashReason: 'remove' }), null, context(T), config);
        expect(removed.previousStatus).toBe('trash'); expect(removed.newStatus).toBe('absent'); expect(removed.reason).toBe('remove');
        expect(removed.action).not.toBe('restore.commit');
    });
    it('correlates claim, prepare and committed consumption with one hashed business attempt without raw tokens', () => {
        const token = 'restore_private_business_attempt';
        const claim = audit.buildEvent(T, 'source', row({ id: 'source' }), row({ id: 'source', restoreClaim: { token, targetId: 'row1' } }), context(T, 'source', 'claim'), config);
        const prepare = audit.buildEvent(H, 'row1', row(), row({ restoreClaimId: 'source', restoreClaimToken: token }), context(H, 'row1', 'prepare'), config);
        const consumeRoot = 'zoew_trash_consumptions';
        const consume = audit.buildEvent(consumeRoot, 'source', null, { kind: 'restore', sourceId: 'source', generation: 2, token, targetId: 'row1' }, context(consumeRoot, 'source', 'commit'), config);
        expect(claim).not.toBeNull(); expect(prepare).not.toBeNull(); expect(consume.action).toBe('restore.commit');
        expect(claim.logicalOperationId).toBe(prepare.logicalOperationId); expect(prepare.logicalOperationId).toBe(consume.logicalOperationId);
        expect(JSON.stringify([claim, prepare, consume])).not.toContain(token);
    });
    it('uses provider record paths rather than optional stale row IDs for restore provenance', () => {
        const token = 'restore_known_attempt';
        const claim = audit.buildEvent(T, 'actual_source', null, row({ id: 'wrong_optional_id', restoreClaim: { token, targetId: 'actual_target' } }), context(T, 'actual_source'), config);
        const prepare = audit.buildEvent(H, 'actual_target', null, row({ id: 'wrong_optional_id', restoreClaimId: 'actual_source', restoreClaimToken: token }), context(H, 'actual_target'), config);
        expect(claim.after.restore).toMatchObject({ sourceId: 'actual_source', targetId: 'actual_target' });
        expect(prepare.after.restore).toMatchObject({ sourceId: 'actual_source', targetId: 'actual_target' });
    });
    it('captures actual finalization create and proof cleanup while preserving original restore timestamp and attempt', () => {
        const root = 'zoew_restore_finalizations', token = 'restore_private_business_attempt';
        const proof = { token, targetId: 'target1', finalizedAt: 1234567 };
        const created = audit.buildEvent(root, 'source1', null, proof, context(root, 'source1', 'finalize'), config);
        const removed = audit.buildEvent(root, 'source1', proof, null, context(root, 'source1', 'clear-proof'), config);
        expect(created.action).toBe('restore.finalization.create'); expect(removed.action).toBe('restore.finalization.delete');
        expect(created.after.proof).toMatchObject({ sourceId: 'source1', targetId: 'target1', finalizedAt: 1234567 });
        expect(removed.before.proof).toEqual(created.after.proof); expect(removed.newStatus).toBe('absent');
        expect(created.logicalOperationId).toBe(removed.logicalOperationId); expect(created.logicalOperationId).toMatch(/^restore:[a-f0-9]{64}$/);
        expect(JSON.stringify([created, removed])).not.toContain(token);
    });
    it('explicitly reports changed-field truncation rather than silently claiming a complete diff', () => {
        const before = Object.fromEntries(Array.from({ length: 70 }, (_, i) => ['field' + i, 1]));
        const after = Object.fromEntries(Array.from({ length: 70 }, (_, i) => ['field' + i, 2]));
        const result = audit.changedFields(before, after);
        expect(result.fields).toHaveLength(32); expect(result.total).toBe(70); expect(result.truncated).toBe(true);
    });
    it('same-count pickup barcode reassignment changes the full key digest without copying phone values', () => {
        const root = 'zoew_daily_pickup_cod_dod', before = { packagesPickedUp: 1, pickedUpBarcodes: { QA000001: 'PRIVATE_PHONE_A' }, pickedUpPhones: { PRIVATE_PHONE_A: 1 } };
        const after = { packagesPickedUp: 1, pickedUpBarcodes: { QA000002: 'PRIVATE_PHONE_B' }, pickedUpPhones: { PRIVATE_PHONE_B: 1 } };
        const event = audit.buildEvent(root, '2026-11-14', before, after, context(root, '2026-11-14'), config);
        expect(event).not.toBeNull(); expect(event.before.pickup.barcodeDigest).not.toBe(event.after.pickup.barcodeDigest);
        expect(event.after.pickup.barcodeSamples).toEqual([{ code: 'QA000002' }]);
        expect(JSON.stringify(event)).not.toContain('PRIVATE_PHONE');
    });
    it('same-barcode phone reassignment is explicitly recorded as redacted ownership change', () => {
        const root = 'zoew_daily_pickup_cod_dod';
        const event = audit.buildEvent(root, '2026-11-14', { pickedUpBarcodes: { QA000001: 'PRIVATE_A' } }, { pickedUpBarcodes: { QA000001: 'PRIVATE_B' } }, context(root, '2026-11-14'), config);
        expect(event).not.toBeNull(); expect(event.redactedOwnershipChanged).toBe(true);
        expect(event.changedFields).toContain('pickup.redactedOwnership');
        expect(JSON.stringify(event)).not.toContain('PRIVATE_');
    });
});

describe('trusted Firebase business audit delivery', () => {
    it('replay and concurrent duplicate provider deliveries have exactly one immutable DB effect', async () => {
        const db = memory(), handler = audit.createHandler(H, config), change = db.change(null, row());
        const replies = await Promise.all(Array.from({ length: 12 }, () => handler(change, context())));
        expect(db.writes()).toBe(1); expect(replies.filter(reply => !reply.duplicate)).toHaveLength(1);
        expect([...db.data.keys()].filter(key => key.startsWith(audit.AUDIT_ROOT + '/'))).toHaveLength(1);
        const stored = copy([...db.data.values()][0]); await handler(change, context());
        expect([...db.data.values()][0]).toEqual(stored); expect(db.writes()).toBe(1);
    });
    it.each(['before', 'after'])('failed %s-commit delivery is retained and same provider event retries to one effect', async fault => {
        const db = memory(), handler = audit.createHandler(H, config), change = db.change(null, row());
        db.faults[fault] = 1;
        db.faults.coldFailureTransactions = true;
        await expect(handler(change, context())).rejects.toThrow('AUDIT_WRITE_RETRY_REQUIRED');
        const failures = [...db.data.entries()].filter(([key]) => key.startsWith(audit.FAILURE_ROOT + '/'));
        expect(failures).toHaveLength(1); expect(failures[0][1]).toMatchObject({ status: 'retry_required', attempts: 1, candidateEvent: { providerEventId: 'provider-event-001' } });
        await handler(change, context());
        expect(db.writes()).toBe(1);
        expect(db.data.get(failures[0][0]).status).toBe('resolved');
    });
    it('same provider ID with different business content fails closed, preserving original and retained collision evidence', async () => {
        const db = memory(), handler = audit.createHandler(H, config);
        await handler(db.change(null, row()), context());
        const stored = copy([...db.data.values()][0]);
        await expect(handler(db.change(null, row({ cod: 9 })), context())).rejects.toThrow('AUDIT_EVENT_COLLISION');
        expect([...db.data.values()][0]).toEqual(stored); expect(db.writes()).toBe(1);
        const failed = [...db.data.entries()].find(([key]) => key.startsWith(audit.FAILURE_ROOT + '/'))![1];
        expect(failed).toMatchObject({ status: 'collision', failureCode: 'AUDIT_EVENT_COLLISION' });
        expect(failed.candidateEvent.after.money.codDollar).toBe(9);
    });
    it('a total database outage never turns failed event/failure retention into a successful acknowledgement', async () => {
        const db = memory(), handler = audit.createHandler(H, config), change = db.change(null, row());
        db.faults.offline = true;
        await expect(handler(change, context())).rejects.toThrow('AUDIT_WRITE_RETRY_REQUIRED');
        expect(db.data.size).toBe(0); expect(db.writes()).toBe(0);
        db.faults.offline = false;
        await handler(change, context());
        expect(db.writes()).toBe(1); expect([...db.data.values()][0].providerEventId).toBe('provider-event-001');
    });
    it('unavailable failure-resolution read retains retry after audit commit and never causes a second event', async () => {
        const db = memory(), handler = audit.createHandler(H, config), change = db.change(null, row());
        db.faults.failureReads = 1;
        await expect(handler(change, context())).rejects.toThrow('AUDIT_WRITE_RETRY_REQUIRED');
        expect(db.writes()).toBe(1);
        await handler(change, context());
        expect(db.writes()).toBe(1);
        const failures = [...db.data.entries()].filter(([key]) => key.startsWith(audit.FAILURE_ROOT + '/'));
        expect(failures).toHaveLength(1); expect(failures[0][1].status).toBe('resolved');
    });
    it('delayed/out-of-order events preserve each provider before/after rather than rewriting latest state', async () => {
        const db = memory(), handler = audit.createHandler(H, config), open = row(), closed = row({ barcodes: [barcode('QA000001', { isClosed: true })] });
        await handler(db.change(open, closed), context(H, 'row1', 'newer', { timestamp: '2026-11-14T06:02:00Z' }));
        await handler(db.change(null, open), context(H, 'row1', 'older', { timestamp: '2026-11-14T06:01:00Z' }));
        expect(db.writes()).toBe(2);
        const entries = [...db.data.entries()].filter(([key]) => key.startsWith(audit.AUDIT_ROOT + '/')).map(([, value]) => value);
        expect(entries.find(value => value.providerEventId === 'newer').previousStatus).toBe('open');
        expect(entries.find(value => value.providerEventId === 'newer').newStatus).toBe('closed');
        expect(entries.find(value => value.providerEventId === 'older').previousStatus).toBe('absent');
    });
    it('foreign SDK reference cannot receive an audit write', async () => {
        const db = memory(), handler = audit.createHandler(H, config), change = db.change(null, row());
        change.after.ref.root.toString = () => 'https://foreign-default-rtdb.firebaseio.com/';
        await expect(handler(change, context())).rejects.toThrow('AUDIT_PROVIDER_INSTANCE'); expect(db.calls()).toBe(0);
    });
    it('matching instance prefix on a foreign domain is refused', async () => {
        const db = memory(), handler = audit.createHandler(H, config), change = db.change(null, row());
        change.after.ref.root.toString = () => `https://${config.instance}.foreign.invalid/`;
        await expect(handler(change, context())).rejects.toThrow('AUDIT_PROVIDER_INSTANCE'); expect(db.calls()).toBe(0);
    });
    it('real Functions emulator default app URL does not override the verified per-reference namespace', async () => {
        const db = memory(), configEmulator = { ...config, emulatorHost: '127.0.0.1:9000' };
        db.root.toString = () => 'http://127.0.0.1:9000/';
        Object.assign(db.root, { database: { app: { options: { projectId: config.projectId, databaseURL: 'http://127.0.0.1:9000/?ns=' + config.projectId } } } });
        const verifyEmulatorRoot = vi.fn((actual: unknown, target: any) => actual === db.root && target.instance === config.instance);
        const handler = audit.createHandler(H, configEmulator, { verifyEmulatorRoot });
        await handler(db.change(null, row()), context());
        expect(verifyEmulatorRoot).toHaveBeenCalled(); expect(db.writes()).toBe(1);
    });
    it('expected emulator SDK URL exactly matches the official provider namespace form rather than a canonical alias', () => {
        expect(audit.emulatorDatabaseUrl({ ...config, emulatorHost: '127.0.0.1:15900' }))
            .toBe('http://127.0.0.1:15900/?ns=' + config.instance);
    });
    it('matching app default target never authorizes a foreign SDK namespace on the same loopback endpoint', async () => {
        const db = memory(), configEmulator = { ...config, emulatorHost: '127.0.0.1:9000' };
        db.root.toString = () => 'http://127.0.0.1:9000/';
        Object.assign(db.root, { database: { app: { options: { projectId: config.projectId, databaseURL: 'https://' + config.instance + '.firebaseio.com' } } } });
        const handler = audit.createHandler(H, configEmulator, { verifyEmulatorRoot: () => false });
        await expect(handler(db.change(null, row()), context())).rejects.toThrow('AUDIT_PROVIDER_INSTANCE'); expect(db.writes()).toBe(0);
    });
    it('sensitive-only changes retain a truthful omission event without exposing values or pretending a status change', async () => {
        const db = memory(), handler = audit.createHandler(H, config);
        await handler(db.change(row({ phone: 'PRIVATE_A' }), row({ phone: 'PRIVATE_B' })), context());
        const event = [...db.data.values()][0];
        expect(event.unrepresentedChange).toBe(true); expect(event.changedFields).toEqual(['unrepresented_or_redacted']);
        expect(event.previousStatus).toBe(event.newStatus); expect(event.actor.uid).toBe('actual-server-user');
        expect(JSON.stringify(event)).not.toContain('PRIVATE_'); expect(db.writes()).toBe(1);
    });
    it('an actual unchanged row is ignored without a false audit event', async () => {
        const db = memory(), handler = audit.createHandler(H, config), source = row();
        await expect(handler(db.change(source, source), context())).resolves.toEqual({ ignored: true });
        expect(db.calls()).toBe(0); expect(db.data.size).toBe(0);
    });
});
