// @vitest-environment node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const ROOT = process.env.SBPENDING_APP_DIR || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const supabase = require(path.join(ROOT, 'tools/firebase-backup/supabase.js'));
const backup = require(path.join(ROOT, 'tools/firebase-backup/backup.js'));
const migrate = require(path.join(ROOT, 'tools/supabase-migrate/migrate.js'));
const SOURCE = '11111111-1111-4111-8111-111111111111';
const TARGET = '22222222-2222-4222-8222-222222222222';
const TRASH = 'zoew_recently_deleted_cod_dod';
const REGISTRY = 'zoew_barcode_registry';
const directories: string[] = [];
type Tree = Record<string, Record<string, unknown>>;

function syntheticServiceCredential() {
    return ['sb', 'secret', 'synthetic', randomBytes(24).toString('hex')].join('_');
}

function folder() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zoe-pending-archive-test-'));
    fs.chmodSync(dir, 0o700); directories.push(dir); return dir;
}
function trash(sealed = true) {
    return { id: 'trash_fixture', phone: '010000001', createdAt: 1763000000000, deletedAt: 1763000001000,
        scanDate: '2026-11-14', isClosed: true, trashMode: 'palm', trashReason: 'remove',
        ...(sealed ? { restoreAttestationId: 'server_proof_fixture',
            restoreClaim: { token: 'claim_fixture', targetId: 'target_fixture', claimedAt: 1763000002000 } } : {}),
        barcodes: [{ code: 'PARCEL_A', cod: 10, dod: 0, createdAt: 1763000000000, isClosed: true, isDeducted: true }] };
}
function tree(sealed = true): Tree { return { [TRASH]: { trash_fixture: trash(sealed) }, [REGISTRY]: { PARCEL_A: true } }; }
function firebaseAuthorityData(generation = 0): Tree {
    const data = tree(false);
    data.zoew_restore_attestations = { trash_fixture: { v: 1, id: 'returned_fixture_proof', revision: 2,
        sourceId: 'trash_fixture', generation, deletedAt: 1763000001000, rowBirth: 1763000000000,
        token: 'claim_fixture', targetId: 'target_fixture', actorUid: 'synthetic-actor', authTime: 1763000000000,
        scope: 'https://synthetic-backup.firebaseio.com', branch: 'fixture', mode: 'palm', policyEpoch: 1,
        issuedAt: 1763000002000, expiresAt: 1763000122000, status: 'deny', verdict: 'returned',
        sourceHash: 'synthetic-source-hash', codeSetHash: 'synthetic-code-set-hash', snapshot: data[TRASH].trash_fixture,
        codes: {}, allowedTargetSlots: {} } };
    return data;
}
function event() {
    return { event_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', schema_version: 1, tenant_id: SOURCE, origin_tenant_id: SOURCE,
        operation_id: 'archive_fixture_operation', seq: '1', actor_uid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', actor_kind: 'user',
        origin: 'app_engine', root: 'zoew_scan_history_cod_dod', record_key: 'fixture_item', action: 'create', reason: 'record_created',
        status_source: 'stored_business_state', previous_status: { exists: false, location: 'absent' }, new_status: { exists: true, location: 'history' },
        before_value: { exists: false, location: 'absent' }, after_value: { exists: true, location: 'history', cod: 10, count: 1 },
        changed_fields: ['cod', 'count', 'exists', 'location'], changed_fields_truncated: false, summary_unchanged: false,
        projection_scope: 'bounded_business_fields', committed_at: '2026-11-14T01:02:03.123456Z' };
}
function archive(data: Tree, events: ReturnType<typeof event>[] = [], auditOnly = false) {
    return { format: 'zoe-supabase-tenant', version: 2,
        manifest: { tenant: { id: SOURCE, name: 'Synthetic', branch_code: 'fixture' }, seq: 1, docs: supabase.rootCounts(data).docs,
            roots: supabase.rootCounts(data).roots, audit: { version: 1, events: events.length, sha256: supabase.auditDigest(events) },
            ...(auditOnly ? { audit_only: true } : {}), source: { kind: 'supabase', host: 'synthetic.supabase.co' } },
        data, audit: { format: 'zoe-business-audit', version: 1, tenant: SOURCE, through: String(events.length), events } };
}
function transport(sourceData: Tree, initialTarget: Tree = {}) {
    let phase = 'backup', seq = 0;
    let denyDocumentExport = false;
    const targetData: Tree = structuredClone(initialTarget);
    const targetEvents: ReturnType<typeof event>[] = [];
    const calls: { fn: string; args: Record<string, unknown> }[] = [];
    const rows = (data: Tree) => Object.entries(data).flatMap(([r, entries]) => Object.entries(entries).map(([k, v]) => ({ r, k, v, s: seq || 1 })));
    const meta = (id: string) => ({ id, name: 'Synthetic', branch_code: 'fixture', expires_at: '2030-01-01T00:00:00Z', revoked: false, seq, docs: rows(targetData).length });
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const fn = new URL(String(input)).pathname.split('/').pop()!;
        const args = JSON.parse(String(init?.body || '{}'));
        calls.push({ fn, args });
        if (fn === 'zoe_admin_export' && denyDocumentExport) return new Response(JSON.stringify({ code: '55000',
            message: 'Pending private restore authority requires database-level backup' }), { status: 409, headers: { 'content-type': 'application/json' } });
        let reply;
        if (fn === 'zoe_admin_tenants') reply = { tenants: [meta(phase === 'backup' ? SOURCE : TARGET)], more: false, next: null };
        else if (fn === 'zoe_admin_audit_tenants') reply = { tenants: [], more: false, next: null };
        else if (fn === 'zoe_admin_export') reply = { rows: rows(args.p_tenant === SOURCE ? sourceData : targetData), more: false,
            tombstones_after: args.p_tombstones_after ?? 0, head: seq, purged: 0 };
        else if (fn === 'zoe_admin_audit_export') reply = { v: 1, tenant: args.p_tenant, through: String(targetEvents.length),
            rows: args.p_tenant === TARGET ? targetEvents : [], more: false, next: null };
        else if (fn === 'zoe_admin_audit_restore') {
            const added = args.p_events.map((value: ReturnType<typeof event>) => ({ ...value, tenant_id: TARGET }));
            targetEvents.push(...added);
            reply = { v: 1, tenant: TARGET, source_tenant: SOURCE, total: added.length, imported: added.length, replayed: 0 };
        } else if (fn === 'zoe_admin_write') {
            for (const op of args.p_ops) {
                if (op.v === null) { if (targetData[op.p[0]]) delete targetData[op.p[0]][op.p[1]]; }
                else (targetData[op.p[0]] ||= {})[op.p[1]] = op.v;
            }
            reply = { ok: true, seq: ++seq };
        } else throw new Error('Unexpected synthetic RPC ' + fn);
        return new Response(JSON.stringify(reply), { status: 200, headers: { 'content-type': 'application/json' } });
    });
    return { fetchImpl, targetData, targetEvents, calls, importPhase() { phase = 'import'; },
        forbidDocumentExport() { denyDocumentExport = true; },
        writes() { return calls.filter(call => call.fn === 'zoe_admin_write' || call.fn === 'zoe_admin_audit_restore'); } };
}
async function publish(data: Tree) {
    const dir = folder(), wire = transport(data), out = path.join(dir, 'backups/fixture', SOURCE);
    fs.mkdirSync(out, { recursive: true });
    const previous = zlib.gzipSync(JSON.stringify(archive(tree(false))));
    fs.writeFileSync(path.join(out, 'previous.json.gz'), previous, { mode: 0o600 });
    fs.writeFileSync(path.join(dir, 'secret.key'), syntheticServiceCredential(), { mode: 0o600 });
    const result = await backup.backupSupabase({ type: 'supabase', name: 'fixture', url: 'https://synthetic.supabase.co', secretKeyPath: 'secret.key' },
        { backupRoot: path.join(dir, 'backups'), configDir: dir, keepCount: 3, network: { timeoutMs: 1000, retryCount: 0, retryDelayMs: 0 } },
        { fetchImpl: wire.fetchImpl, sleepImpl: async () => {} });
    return { result, out, previous, wire };
}
async function apply(input: unknown, wire = transport({}), flags: string[] = [], replace = true) {
    const dir = folder(), file = path.join(dir, 'input.json');
    fs.writeFileSync(file, JSON.stringify(input), { mode: 0o600 });
    wire.importPhase(); vi.stubGlobal('fetch', wire.fetchImpl);
    const output = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    try {
        const code = await migrate.run([file, '--tenant', TARGET, '--apply', ...(replace ? ['--replace'] : []), ...flags], {
            ZOE_SUPABASE_URL: 'https://synthetic.supabase.co', ZOE_SUPABASE_SECRET_KEY: syntheticServiceCredential() });
        return { code, wire, output: output.mock.calls.map(call => String(call[0])).join('') };
    }
    finally { output.mockRestore(); }
}

afterEach(() => {
    vi.unstubAllGlobals(); vi.restoreAllMocks();
    for (const dir of directories.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe('ordinary Supabase archives preserve pending server restore authority by refusing incomplete transfer', () => {
    it('detects every non-null seal without treating falsy/malformed authority as absence', () => {
        for (const seal of ['proof', '', 0, false, {}, []]) expect(supabase.hasPendingSeal({ [TRASH]: { source: { restoreAttestationId: seal } } })).toBe(true);
        for (const fence of [1, 9007199254740990, 0, false, {}, []]) expect(supabase.hasPendingSeal({ [TRASH]: { source: { restorePublication: fence } } })).toBe(true);
        expect(supabase.hasPendingSeal({ [TRASH]: { source: { restorePublication: null } } })).toBe(false);
        for (const decision of ['signed', 'returned', '', 0, false, {}, []]) expect(supabase.hasPendingSeal({ [TRASH]: { source: { ztoTerminalDecision: decision } } })).toBe(true);
        expect(supabase.hasPendingSeal({ [TRASH]: { source: { ztoTerminalDecision: null } } })).toBe(false);
        for (const value of [undefined, null, {}, { [TRASH]: {} }, { [TRASH]: { source: { restoreAttestationId: null } } }]) expect(supabase.hasPendingSeal(value)).toBe(false);
        expect(supabase.hasPendingSeal(firebaseAuthorityData())).toBe(true);
        expect(supabase.hasPendingSeal(firebaseAuthorityData(1))).toBe(false);
        const sameGeneration = firebaseAuthorityData(1);
        sameGeneration[TRASH].trash_fixture = { ...trash(false), trashGeneration: 1 };
        expect(supabase.hasPendingSeal(sameGeneration)).toBe(true);
        expect(supabase.hasPendingSeal({ zoew_restore_attestations: firebaseAuthorityData().zoew_restore_attestations })).toBe(false);
    });
    it('refuses backup publication and preserves the previous archive bytes with pending source', async () => {
        const { result, out, previous } = await publish(tree());
        expect(result.files).toHaveLength(0); expect(result.failed).toHaveLength(1);
        expect(result.failed[0]).toMatch(/database-level.*private restore grants/i);
        expect(fs.readdirSync(out)).toEqual(['previous.json.gz']);
        expect(fs.readFileSync(path.join(out, 'previous.json.gz'))).toEqual(previous);
    });
    it('keeps ordinary unsealed backup and archive validation working', async () => {
        const { result } = await publish(tree(false));
        expect(result.failed).toHaveLength(0); expect(result.files).toHaveLength(1);
        const saved = JSON.parse(zlib.gunzipSync(fs.readFileSync(result.files[0])).toString('utf8'));
        expect(saved.data).toEqual(tree(false)); expect(supabase.validateArchive(saved).events).toEqual([]);
    });
    for (const kind of ['raw', 'v1', 'v2'] as const) for (const skip of [false, true]) {
        it(`refuses ${kind} sealed input before any target RPC${skip ? ' even with skip-invalid' : ''}`, async () => {
            const data = tree(); const input = kind === 'raw' ? data : kind === 'v1'
                ? { format: 'zoe-supabase-tenant', version: 1, manifest: {}, data } : archive(data, [event()]);
            const wire = transport({});
            await expect(apply(input, wire, skip ? ['--skip-invalid'] : [])).rejects.toThrow(/database-level.*private restore grants/i);
            expect(wire.fetchImpl).not.toHaveBeenCalled(); expect(wire.writes()).toHaveLength(0);
        });
    }
    for (const skip of [false, true]) it('refuses raw unsealed current Returned authority before any RPC' + (skip ? ' even with skip-invalid' : ''), async () => {
        const input = firebaseAuthorityData(); const wire = transport({});
        await expect(apply(input, wire, skip ? ['--skip-invalid'] : [])).rejects.toThrow(/database-level.*private restore grants/i);
        expect(wire.fetchImpl).not.toHaveBeenCalled(); expect(wire.writes()).toHaveLength(0);
    });
    for (const skip of [false, true]) it('refuses a released publication fence even without seal or private grant' + (skip ? ' with skip-invalid' : ''), async () => {
        const input = tree(false); (input[TRASH].trash_fixture as any).restorePublication = 2;
        const wire = transport({});
        await expect(apply(input, wire, skip ? ['--skip-invalid'] : [])).rejects.toThrow(/database-level.*private restore grants/i);
        expect(wire.fetchImpl).not.toHaveBeenCalled(); expect(wire.writes()).toHaveLength(0);
    });
    it('refuses ordinary archive publication of a released fence and preserves the previous backup', async () => {
        const data = tree(false); (data[TRASH].trash_fixture as any).restorePublication = 2;
        const { result, out, previous } = await publish(data);
        expect(result.files).toHaveLength(0); expect(result.failed).toHaveLength(1);
        expect(result.failed[0]).toMatch(/database-level.*private restore grants/i);
        expect(fs.readdirSync(out)).toEqual(['previous.json.gz']);
        expect(fs.readFileSync(path.join(out, 'previous.json.gz'))).toEqual(previous);
    });
    for (const skip of [false, true]) it('refuses a terminal decision without its private authority' + (skip ? ' with skip-invalid' : ''), async () => {
        const input = tree(false); (input[TRASH].trash_fixture as any).ztoTerminalDecision = 'returned';
        const wire = transport({});
        await expect(apply(input, wire, skip ? ['--skip-invalid'] : [])).rejects.toThrow(/database-level.*private restore grants/i);
        expect(wire.fetchImpl).not.toHaveBeenCalled(); expect(wire.writes()).toHaveLength(0);
    });
    it('preserves Firebase full physical backup including unsealed current Returned authority', async () => {
        const dir = folder(), data = firebaseAuthorityData();
        (data[TRASH].trash_fixture as any).restorePublication = 1;
        (data[TRASH].trash_fixture as any).ztoTerminalDecision = 'returned';
        const fx = require(path.join(ROOT, 'tools/audit-tools/idtoken-fixture.js'));
        fs.writeFileSync(path.join(dir, 'service.json'), JSON.stringify({ client_email: 'fixture@synthetic-backup.iam.gserviceaccount.com',
            private_key: fx.TEST_KEY_PEM }), { mode: 0o600 });
        const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            if (String(input) === 'https://oauth2.googleapis.com/token') return new Response(JSON.stringify({ access_token: 'synthetic-access', expires_in: 3600 }));
            expect(String(input)).toBe('https://synthetic-backup.firebaseio.com/.json'); expect(init?.method).toBe('GET');
            return new Response(JSON.stringify(data));
        });
        const saved = await backup.backupOne({ name: 'firebase-physical', serviceAccountPath: 'service.json', databaseURL: 'https://synthetic-backup.firebaseio.com' },
            { backupRoot: path.join(dir, 'backups'), configDir: dir, keepCount: 3, network: { timeoutMs: 1000, retryCount: 0, retryDelayMs: 0 } }, { fetchImpl });
        expect(fetchImpl).toHaveBeenCalledTimes(2);
        expect(JSON.parse(zlib.gunzipSync(fs.readFileSync(saved)).toString('utf8'))).toEqual(data);
    });
    it('imports ordinary unsealed business data and confirms exact canonical values', async () => {
        const wire = transport({}); const result = await apply(archive(tree(false)), wire);
        expect(result.code).toBe(0); expect(wire.writes()).toHaveLength(1);
        expect(migrate.stableJson(wire.targetData)).toBe(migrate.stableJson(migrate.canonValue(tree(false))));
    });
    it('does not downgrade target Palm policy from a local source under replace and preserves every protected target record', async () => {
        const source = tree(false);
        source.zoew_restore_policy = { shop: { v: 1, mode: 'local', scope: 'source', branch: 'source', epoch: 1 } };
        const target: Tree = { [REGISTRY]: { OLD_PARCEL: true },
            zoew_restore_policy: { shop: { v: 1, mode: 'palm', scope: 'target', branch: 'target', epoch: 5 }, future: { preserved: true } },
            zoew_restore_attestations: { old_orphan: { generation: 1, status: 'deny' } } };
        const protectedPolicy = structuredClone(target.zoew_restore_policy), protectedProofs = structuredClone(target.zoew_restore_attestations);
        const wire = transport({}, target), result = await apply(archive(source), wire);
        expect(result.code).toBe(0); expect(wire.targetData.zoew_restore_policy).toEqual(protectedPolicy);
        expect(wire.targetData.zoew_restore_attestations).toEqual(protectedProofs);
        expect(wire.calls.filter(call => call.fn === 'zoe_admin_write').flatMap(call => (call.args.p_ops as { p: string[] }[]))
            .some(op => ['zoew_restore_policy', 'zoew_restore_attestations'].includes(op.p[0]))).toBe(false);
        expect(result.output).toMatch(/source.*configuration.*excluded/i); expect(result.output).toMatch(/target.*configuration.*retain/i);
    });
    it('preserves existing target configuration without requiring replace for new business records', async () => {
        const target: Tree = { zoew_restore_policy: { shop: { v: 1, mode: 'palm', scope: 'target', branch: 'target', epoch: 1 } } };
        const wire = transport({}, target), result = await apply(archive(tree(false)), wire, [], false);
        expect(result.code).toBe(0); expect(wire.targetData.zoew_restore_policy).toEqual(target.zoew_restore_policy);
        expect(wire.targetData[REGISTRY]).toEqual({ PARCEL_A: true });
    });
    it('never provisions missing target policy or copies inactive private grants from an ordinary input', async () => {
        const source = firebaseAuthorityData(1);
        source.zoew_restore_policy = { shop: { v: 1, mode: 'local', scope: 'source', branch: 'source', epoch: 1 } };
        const wire = transport({}), result = await apply(source, wire);
        expect(result.code).toBe(0); expect(wire.targetData.zoew_restore_policy).toBeUndefined();
        expect(wire.targetData.zoew_restore_attestations).toBeUndefined();
        expect(migrate.stableJson(wire.targetData)).toBe(migrate.stableJson(migrate.canonValue(tree(false))));
    });
    it('does not treat protected configuration alone as importable business data', async () => {
        const wire = transport({}), result = await apply({ zoew_restore_policy: { shop: { v: 1, mode: 'local', epoch: 1 } } }, wire);
        expect(result.code).toBe(1); expect(wire.fetchImpl).not.toHaveBeenCalled();
    });
    it('holds a sealed target before either historical audit or business writes and preserves its claim', async () => {
        const wire = transport({}, tree()); const before = structuredClone(wire.targetData);
        const result = await apply(archive(tree(false), [event()]), wire);
        expect(result.code).toBe(1); expect(wire.writes()).toHaveLength(0);
        expect(wire.targetData).toEqual(before); expect(wire.targetEvents).toEqual([]);
    });
    it('allows pure audit-only append while a pending target and its business documents remain byte-identical', async () => {
        const wire = transport({}, tree()); const before = JSON.stringify(wire.targetData);
        wire.forbidDocumentExport();
        const result = await apply(archive({}, [event()], true), wire).catch(() => ({ code: -1, wire }));
        expect(result.code).toBe(0); expect(wire.targetEvents).toEqual([{ ...event(), tenant_id: TARGET }]);
        expect(wire.calls.filter(call => call.fn === 'zoe_admin_export')).toHaveLength(0);
        expect(wire.calls.filter(call => call.fn === 'zoe_admin_write')).toHaveLength(0);
        expect(wire.calls.filter(call => call.fn === 'zoe_admin_audit_restore')).toHaveLength(1);
        expect(JSON.stringify(wire.targetData)).toBe(before);
    });
});
