'use strict';

process.exitCode = 1;
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');
const zlib = require('node:zlib');
const ROOT = process.env.SBAUDITARCHIVE_APP_DIR ? path.resolve(process.env.SBAUDITARCHIVE_APP_DIR) : path.resolve(__dirname, '../..');
const supabase = require(path.join(ROOT, 'tools/firebase-backup/supabase.js'));
const SOURCE = '11111111-1111-4111-8111-111111111111';
const TARGET = '22222222-2222-4222-8222-222222222222';
const DOCS = { zoew_barcode_registry: { PARCEL_A: true } };
const cli = path.join(ROOT, 'tools/supabase-migrate/migrate.js');
const STARTED = Date.now();
let passed = 0;
let failed = 0;
async function scenario(label, action) {
    try { await action(); passed++; console.log('PASS ' + label); }
    catch (error) { failed++; console.error('FAIL ' + label + ': ' + error.message); }
}
function event(index = 1) {
    return { event_id: 'aaaaaaaa-aaaa-4aaa-8aaa-' + String(index).padStart(12, '0'), schema_version: 1,
        tenant_id: SOURCE, origin_tenant_id: SOURCE, operation_id: 'archive_operation_' + index, seq: String(index),
        actor_uid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', actor_kind: 'user', origin: 'app_engine',
        root: 'zoew_scan_history_cod_dod', record_key: 'parcel_' + index, action: 'create', reason: 'record_created',
        status_source: 'stored_business_state', previous_status: { exists: false, location: 'absent' }, new_status: { exists: true, location: 'history' }, before_value: { exists: false, location: 'absent' },
        after_value: { exists: true, location: 'history', cod: 5, count: 1 }, changed_fields: ['cod', 'count', 'exists', 'location'],
        changed_fields_truncated: false, summary_unchanged: false, projection_scope: 'bounded_business_fields',
        committed_at: '2026-11-14T01:02:03.123456Z' };
}
function fixtureClient(change) {
    const calls = [];
    return { host: 'synthetic.supabase.co', calls, async rpc(fn, args) {
        calls.push({ fn, args });
        if (change) { const reply = change(fn, args); if (reply !== undefined) return reply; }
        if (fn === 'zoe_admin_tenants') return { tenants: [{ id: SOURCE, name: 'Synthetic', branch_code: 'fixture' }], more: false, next: null };
        if (fn === 'zoe_admin_audit_tenants') return { tenants: [SOURCE, TARGET], more: false, next: null };
        if (fn === 'zoe_admin_export') return { rows: [{ r: 'zoew_barcode_registry', k: 'PARCEL_A', v: true, s: 1 }], more: false, tombstones_after: 0, head: 1, purged: 0 };
        if (fn === 'zoe_admin_audit_export') return args.p_after === '0' || args.p_after === 0
            ? { v: 1, tenant: SOURCE, through: '9007199254740993', rows: [event(1)], more: true, next: '9007199254740992' }
            : { v: 1, tenant: SOURCE, through: '9007199254740993', rows: [event(2)], more: false, next: null };
        throw new Error('Unexpected RPC ' + fn);
    } };
}
function dryRun(value, options = []) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zoe-audit-input-'));
    try {
        const input = path.join(dir, 'input.json');
        fs.writeFileSync(input, JSON.stringify(value), { mode: 0o600 });
        return cp.spawnSync(process.execPath, [cli, input, ...options], { cwd: ROOT, encoding: 'utf8', timeout: 15000, env: { ...process.env, ZOE_SUPABASE_URL: '', ZOE_SUPABASE_SECRET_KEY: '' } });
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
function archive(events = [event()], data = DOCS, auditOnly = false) {
    return supabase.buildArchive({ id: SOURCE, ...(auditOnly ? { audit_only: true } : {}) }, {
        data, seq: 1, audit: { format: 'zoe-business-audit', version: 1, tenant: SOURCE, through: '2', events }
    }, 'synthetic.supabase.co');
}
async function unitScenarios() {
    await scenario('new backup exports a v2 audit envelope with original event identity and bigint cursor precision', async () => {
        const client = fixtureClient();
        const exported = await supabase.exportTenant(client, SOURCE);
        const archive = supabase.buildArchive({ id: SOURCE }, exported, client.host);
        assert.equal(archive.version, 2);
        assert.deepEqual(JSON.parse(JSON.stringify(archive.data)), DOCS);
        assert.deepEqual(archive.audit.events, [event(1), event(2)]);
        assert.equal(archive.audit.through, '9007199254740993');
        assert.equal(archive.manifest.audit.events, 2);
        const requests = client.calls.filter(call => call.fn === 'zoe_admin_audit_export');
        assert.equal(requests.length, 2);
        assert.equal(requests[1].args.p_after, '9007199254740992');
        assert.equal(requests[1].args.p_through, '9007199254740993');
    });
    await scenario('backup includes deleted audit owners without inventing live branch metadata', async () => {
        const tenants = await supabase.listTenants(fixtureClient(), { includeAudit: true });
        assert.deepEqual(tenants.map(tenant => tenant.id).sort(), [SOURCE, TARGET]);
        assert.equal(tenants.find(tenant => tenant.id === TARGET).audit_only, true);
    });
    await scenario('a changing audit snapshot ceiling fails closed', async () => {
        const client = fixtureClient((fn, args) => fn === 'zoe_admin_audit_export' && String(args.p_after) !== '0'
            ? { v: 1, tenant: SOURCE, through: '9007199254740994', rows: [event(2)], more: false, next: null } : undefined);
        await assert.rejects(supabase.exportTenant(client, SOURCE), /audit|snapshot|through/i);
    });
    await scenario('duplicate audit event IDs never disappear through deduplication', async () => {
        const client = fixtureClient((fn, args) => fn === 'zoe_admin_audit_export' && String(args.p_after) !== '0'
            ? { v: 1, tenant: SOURCE, through: '9007199254740993', rows: [event(1)], more: false, next: null } : undefined);
        await assert.rejects(supabase.exportTenant(client, SOURCE), /audit|duplicate/i);
    });
    await scenario('legacy v1 without audit remains readable without fabricated history', () => {
        const result = dryRun({ format: 'zoe-supabase-tenant', version: 1, manifest: {}, data: DOCS });
        assert.equal(result.status, 0, result.stderr);
    });
    await scenario('audit in a legacy envelope cannot be silently ignored', () => {
        const result = dryRun({ format: 'zoe-supabase-tenant', version: 1, manifest: {}, data: DOCS, audit: { events: [event()] } }, ['--skip-invalid']);
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, /audit|archive/i);
    });
    for (const namespace of ['zoew_business_audit_v1', 'zoew_business_audit_failures_v1']) await scenario('Firebase ' + namespace + ' requires explicit supported provenance conversion', () => {
        const result = dryRun({ ...DOCS, [namespace]: { synthetic: event() } }, ['--skip-invalid']);
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, /audit|provenance|unsupported/i);
    });
    await scenario('valid v2 and immutable historical timestamps remain readable', () => {
        const input = archive();
        const before = JSON.stringify(input.audit.events);
        assert.equal(dryRun(input).status, 0);
        assert.equal(JSON.stringify(input.audit.events), before);
    });
    for (const fault of ['digest', 'count', 'event-version', 'source', 'duplicate', 'hidden-order', 'sequence-number', 'timestamp', 'private-field']) await scenario('corrupt present audit is refused before writes: ' + fault, () => {
        const input = archive();
        if (fault === 'digest') input.manifest.audit.sha256 = '0'.repeat(64);
        if (fault === 'count') input.manifest.audit.events++;
        if (fault === 'event-version') input.audit.events[0].schema_version = 2;
        if (fault === 'source') input.audit.events[0].tenant_id = TARGET;
        if (fault === 'duplicate') input.audit.events.push(structuredClone(input.audit.events[0]));
        if (fault === 'hidden-order') input.audit.events[0].archive_seq = '1';
        if (fault === 'sequence-number') input.audit.events[0].seq = 9007199254740992;
        if (fault === 'timestamp') input.audit.events[0].committed_at = '2026-02-31T01:02:03.123456Z';
        if (fault === 'private-field') input.audit.events[0].after_value.phone = 'synthetic-private-field';
        if (!['digest', 'count'].includes(fault)) {
            input.manifest.audit.sha256 = supabase.auditDigest(input.audit.events);
            input.manifest.audit.events = input.audit.events.length;
        }
        const result = dryRun(input, ['--skip-invalid', '--apply', '--replace']);
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, /audit|archive/i);
    });
    await scenario('empty audited input cannot turn replace into a whole-shop deletion', () => {
        const result = dryRun(archive([], {}, true), ['--apply', '--replace']);
        assert.notEqual(result.status, 0);
        assert.match(result.stdout, /no record/i);
    });
    await scenario('audit batching enforces actual PostgreSQL JSONB byte and row bounds', () => {
        const migrate = require(cli);
        const batches = migrate.makeAuditBatches([event(1), event(2), event(3)], 2, 65536);
        assert.deepEqual(batches.map(batch => batch.length), [2, 1]);
        for (const batch of batches) assert.ok(migrate.jsonbTextBytes(batch) <= 65536);
        const large = event(); large.after_value.sample = ['x'.repeat(70000)];
        assert.throws(() => migrate.makeAuditBatches([large], 2, 65536), /batch-bytes/i);
    });
    await scenario('aggregate event budget rejects the next page before inspecting or retaining its event', async () => {
        let inspected = 0;
        const poison = event(2);
        Object.defineProperty(poison, 'before_value', { enumerable: true, get() { inspected++; throw new Error('event inspected before count budget'); } });
        const client = fixtureClient((fn, args) => fn === 'zoe_admin_audit_export' && String(args.p_after) !== '0'
            ? { v: 1, tenant: SOURCE, through: '9007199254740993', rows: [poison], more: false, next: null } : undefined);
        await assert.rejects(supabase.exportTenant(client, SOURCE, { maxAuditEvents: 1 }), /aggregate event budget/i);
        assert.equal(inspected, 0);
    });
    await scenario('aggregate byte budget stops later individually valid pages without truncating history', async () => {
        const exactOne = Buffer.byteLength(JSON.stringify([event(1)]));
        await assert.rejects(supabase.exportTenant(fixtureClient(), SOURCE, { maxAuditBytes: exactOne }), /aggregate byte budget/i);
    });
    await scenario('oversized imported event arrays fail before digest serialization', () => {
        let inspected = 0;
        const poison = { get value() { inspected++; throw new Error('serialized oversized input'); } };
        assert.throws(() => supabase.auditDigest(Array(supabase.MAX_AUDIT_ARCHIVE_EVENTS + 1).fill(poison)), /aggregate event budget/i);
        assert.equal(inspected, 0);
    });
    await scenario('hard audit budgets cannot be raised through caller options', async () => {
        await assert.rejects(supabase.exportTenant(fixtureClient(), SOURCE, { maxAuditEvents: supabase.MAX_AUDIT_ARCHIVE_EVENTS + 1 }), /budget is invalid/i);
    });
    await scenario('a live empty tenant with nonempty history produces an explicitly restorable audit-only archive', () => {
        const input = archive([event()], {});
        assert.equal(input.manifest.audit_only, true);
        assert.equal(dryRun(input).status, 0);
    });
    await scenario('oversized backup keeps the previous published file and creates no partial archive', async () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zoe-audit-capacity-'));
        try {
            const key = 'sb_secret_' + crypto.randomBytes(24).toString('hex');
            fs.writeFileSync(path.join(dir, 'secret.key'), key, { mode: 0o600 });
            const folder = path.join(dir, 'backups/audit', SOURCE); fs.mkdirSync(folder, { recursive: true, mode: 0o700 });
            const previous = zlib.gzipSync(JSON.stringify({ format: 'zoe-supabase-tenant', version: 1, manifest: {}, data: DOCS }));
            fs.writeFileSync(path.join(folder, 'previous.json.gz'), previous, { mode: 0o600 });
            let auditPages = 0;
            const fetchImpl = async (url, init) => {
                const fn = url.split('/').pop(), args = JSON.parse(init.body);
                let result;
                if (fn === 'zoe_admin_tenants') result = { tenants: [{ id: SOURCE }], more: false };
                else if (fn === 'zoe_admin_audit_tenants') result = { tenants: [SOURCE], more: false, next: null };
                else if (fn === 'zoe_admin_export') result = { rows: [{ r: 'zoew_barcode_registry', k: 'PARCEL_A', v: true, s: 1 }], head: 1, tombstones_after: 0, more: false };
                else if (fn === 'zoe_admin_audit_export') {
                    auditPages++;
                    const start = Number(args.p_after), rows = Array.from({ length: args.p_limit }, (_unused, index) => {
                        const row = event(start + index + 1); row.after_value.sample = ['x'.repeat(8192)]; return row;
                    });
                    result = { v: 1, tenant: SOURCE, through: '1000000000', rows, more: true, next: String(start + rows.length) };
                } else throw new Error('Unexpected capacity fixture RPC');
                return { ok: true, status: 200, headers: { get: () => null }, text: async () => JSON.stringify(result) };
            };
            const result = await require(path.join(ROOT, 'tools/firebase-backup/backup.js')).backupSupabase({ name: 'audit', url: 'https://synthetic.supabase.co', secretKeyPath: 'secret.key' }, {
                backupRoot: path.join(dir, 'backups'), configDir: dir, keepCount: 1, network: { timeoutMs: 1000, retryCount: 0, retryDelayMs: 0 }
            }, { fetchImpl });
            assert.deepEqual(result.files, []); assert.equal(result.failed.length, 1);
            assert.match(result.failed[0], /aggregate byte budget/i); assert.ok(auditPages > 1);
            assert.deepEqual(fs.readdirSync(folder), ['previous.json.gz']);
            assert.ok(fs.readFileSync(path.join(folder, 'previous.json.gz')).equals(previous));
        } finally { fs.rmSync(dir, { recursive: true, force: true }); }
    });
}

function runChild(script, args, env) {
    return new Promise((resolve, reject) => {
        const child = cp.spawn(process.execPath, [script, ...args], { cwd: ROOT, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
        let stdout = '', stderr = '';
        const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('Archive CLI exceeded its unchanged 30-second test ceiling.')); }, 30000);
        child.stdout.on('data', chunk => { stdout += chunk; }); child.stderr.on('data', chunk => { stderr += chunk; });
        child.once('error', error => { clearTimeout(timer); reject(error); });
        child.once('close', (code, signal) => { clearTimeout(timer); resolve({ code, signal, stdout, stderr }); });
    });
}

async function integrationScenarios() {
    const { createPgHarness } = require('./supabase-pg.js');
    const repo = process.env.ZOE_REPO_ROOT ? path.resolve(process.env.ZOE_REPO_ROOT) : path.resolve(__dirname, '../..');
    const H = createPgHarness({ depsDirs: [path.join(ROOT, 'supabase/node_modules'), path.join(repo, 'supabase/node_modules')], shimDir: path.join(__dirname, 'supabase-shim'), wantMajor: 17 });
    if (H.unavailableReason()) throw new Error('Required real PostgreSQL archive integration unavailable: ' + H.unavailableReason());
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zoe-audit-archive-pg-'));
    const secret = 'sb_secret_' + crypto.randomBytes(24).toString('hex');
    const passphrase = 'synthetic-audit-archive-passphrase';
    const ORPHAN = '33333333-3333-4333-8333-333333333333';
    const LEGACY = '44444444-4444-4444-8444-444444444444';
    let c, pool, fake;
    const transcripts = [];
    try {
        await H.start();
        const database = await H.freshDb('no-default-grants'); c = database.c;
        const migrationDir = path.join(ROOT, 'supabase/migrations');
        const migrations = fs.readdirSync(migrationDir).filter(file => /^\d{14}_[a-z0-9_]+\.sql$/.test(file)).sort();
        await c.query(migrations.map(file => fs.readFileSync(path.join(migrationDir, file), 'utf8')).join('\n;\n'));
        for (const id of [SOURCE, TARGET, ORPHAN, LEGACY]) await c.query("insert into public.tenants(id,name,branch_code,expires_at) values($1,$2,$3,'2099-01-01')", [id, 'Synthetic archive branch', 'arc_' + id.slice(0, 8)]);
        const docs = { ...DOCS, zoew_daily_revenue_cod_dod: { '2026-11-14': { codDollar: 5, dodDollar: 0, totalCount: 1 } },
            zoew_monthly_revenue_cod_dod: { '2026-11': { codDollar: 5, dodDollar: 0, totalCount: 1 } } };
        const ops = Object.entries(docs).flatMap(([root, values]) => Object.entries(values).map(([key, value]) => ({ k: 'set', p: [root, key], v: value })));
        for (const tenant of [SOURCE, ORPHAN]) {
            const result = await H.as(c, { role: 'service_role' }, 'select public.zoe_admin_write($1,$2,$3::jsonb,false) as r', [tenant, 'archive_seed_' + tenant.slice(0, 8), JSON.stringify(ops)]);
            assert.equal(result.rows?.[0]?.r?.ok, true, JSON.stringify(result.error));
        }
        await c.query("update public.zoe_business_audit set seq=9007199254740993,committed_at='2026-11-14T01:02:03.123456Z' where tenant_id=$1", [SOURCE]);
        await c.query('delete from public.tenants where id=$1', [ORPHAN]);
        pool = new H.PG.Pool({ host: '127.0.0.1', port: c.connectionParameters.port, user: 'postgres', database: database.name, max: 5 });
        fake = await require('./supabase-fake-server.js').startFakeSupabase({ pool, secretKey: secret });
        const client = supabase.createClient({ url: fake.url, key: secret, timeoutMs: 1000, retryCount: 1, retryDelayMs: 10 });
        let sourceArchive, orphanArchive, encryptedInput;
        const importFile = async (file, tenant = TARGET, extra = []) => {
            const result = await runChild(cli, [file, '--tenant', tenant, '--apply', '--url', fake.url, '--retries', '1', '--retry-delay-ms', '10', '--timeout-ms', '1000', ...extra],
                { ZOE_SUPABASE_SECRET_KEY: secret, ZOE_BACKUP_PASSPHRASE: passphrase });
            transcripts.push(result.stdout + result.stderr);
            return result;
        };
        const writeInput = value => { const file = path.join(dir, crypto.randomUUID() + '.json'); fs.writeFileSync(file, JSON.stringify(value), { mode: 0o600 }); return file; };
        await scenario('real PostgreSQL service role has no direct audit table SELECT', async () => {
            const result = await H.as(c, { role: 'service_role' }, 'select * from public.zoe_business_audit');
            assert.equal(result.error?.code, '42501');
        });
        await scenario('real RPC pages preserve bigint sequence, UTC microseconds and original historical payload', async () => {
            const exported = await supabase.exportTenant(client, SOURCE, { auditPageRows: 1 });
            sourceArchive = supabase.buildArchive({ id: SOURCE }, exported, client.host);
            assert.equal(sourceArchive.audit.events.length, 2);
            for (const row of sourceArchive.audit.events) {
                assert.equal(row.seq, '9007199254740993');
                assert.equal(row.committed_at, '2026-11-14T01:02:03.123456Z');
                assert.equal(row.origin_tenant_id, SOURCE);
                assert.equal(row.actor_kind, 'admin');
                assert.equal(row.actor_uid, null);
                assert.ok(!('archive_seq' in row) && !('archive_imported_at' in row));
            }
            assert.deepEqual(JSON.parse(JSON.stringify(exported.data)), docs);
        });
        await scenario('actual backup writer retains orphan audit owners and private compressed v2 archives', async () => {
            fs.writeFileSync(path.join(dir, 'secret.key'), secret, { mode: 0o600 });
            const backup = require(path.join(ROOT, 'tools/firebase-backup/backup.js'));
            const result = await backup.backupSupabase({ name: 'audit', url: fake.url, secretKeyPath: 'secret.key' }, {
                backupRoot: path.join(dir, 'backups'), configDir: dir, network: { timeoutMs: 1000, retryCount: 1, retryDelayMs: 10 }, keepCount: 2
            });
            assert.deepEqual(result.failed, []); assert.equal(result.files.length, 4);
            for (const file of result.files) {
                const value = JSON.parse(zlib.gunzipSync(fs.readFileSync(file)));
                assert.equal(value.version, 2);
                if (process.platform !== 'win32') assert.equal(fs.statSync(file).mode & 0o777, 0o600);
                if (value.manifest.tenant.id === ORPHAN) {
                    orphanArchive = value;
                    assert.equal(value.manifest.audit_only, true);
                    assert.deepEqual(value.data, {}); assert.ok(value.audit.events.length >= 2);
                }
            }
            assert.ok(orphanArchive);
            const crypt = require(path.join(ROOT, 'tools/firebase-backup/crypt.js'));
            encryptedInput = path.join(dir, 'source.json.gz.enc');
            fs.writeFileSync(encryptedInput, crypt.encryptBuffer(zlib.gzipSync(JSON.stringify(sourceArchive)), passphrase), { mode: 0o600 });
        });
        await scenario('retargeted encrypted restore survives committed audit response loss with one historical effect', async () => {
            let dropped = false;
            fake.setRpcHook(async request => request.fn === 'zoe_admin_audit_restore' && request.phase === 'after' && !dropped ? (dropped = true, 'drop') : null);
            const result = await importFile(encryptedInput);
            fake.setRpcHook(null);
            assert.equal(result.code, 0, result.stderr); assert.equal(dropped, true);
            const target = await supabase.exportTenant(client, TARGET);
            assert.deepEqual(JSON.parse(JSON.stringify(target.data)), docs);
            assert.equal(require(cli).verifyAudit(sourceArchive.audit, target.audit, TARGET).equal, true);
            for (const historical of sourceArchive.audit.events) {
                const found = target.audit.events.find(row => row.event_id === historical.event_id);
                assert.deepEqual(found, { ...historical, tenant_id: TARGET });
            }
            assert.equal(target.audit.events.length, 4);
        });
        await scenario('replaying the same archive duplicates neither history nor money/count effects', async () => {
            const before = await supabase.exportTenant(client, TARGET);
            const result = await importFile(encryptedInput);
            assert.equal(result.code, 0, result.stderr);
            const after = await supabase.exportTenant(client, TARGET);
            assert.deepEqual(after.data, before.data); assert.deepEqual(after.audit.events, before.audit.events);
            assert.equal(after.seq, before.seq);
        });
        await scenario('event-ID payload conflict refuses document replacement before any writes', async () => {
            const corrupt = structuredClone(sourceArchive);
            corrupt.audit.events[0].after_value.codDollar = 999;
            corrupt.manifest.audit.sha256 = supabase.auditDigest(corrupt.audit.events);
            corrupt.data.zoew_daily_revenue_cod_dod['2026-11-14'].codDollar = 777;
            const before = await supabase.exportTenant(client, TARGET);
            const result = await importFile(writeInput(corrupt), TARGET, ['--replace']);
            assert.notEqual(result.code, 0); assert.match(result.stderr, /conflict/i);
            const after = await supabase.exportTenant(client, TARGET);
            assert.deepEqual(after.data, before.data); assert.deepEqual(after.audit.events, before.audit.events);
        });
        await scenario('audit-only orphan archive appends provenance and preserves target documents even with replace', async () => {
            const before = await supabase.exportTenant(client, TARGET);
            const result = await importFile(writeInput(orphanArchive), TARGET, ['--replace']);
            assert.equal(result.code, 0, result.stderr);
            const after = await supabase.exportTenant(client, TARGET);
            assert.deepEqual(after.data, before.data); assert.equal(after.seq, before.seq);
            assert.equal(require(cli).verifyAudit(orphanArchive.audit, after.audit, TARGET).equal, true);
            assert.equal(after.audit.events.length, before.audit.events.length + orphanArchive.audit.events.length);
        });
        await scenario('legacy archive restores documents without invented historical audit events', async () => {
            const before = fake.requests.filter(request => request.fn === 'zoe_admin_audit_restore').length;
            const result = await importFile(writeInput({ format: 'zoe-supabase-tenant', version: 1, manifest: {}, data: DOCS }), LEGACY);
            assert.equal(result.code, 0, result.stderr);
            const after = await supabase.exportTenant(client, LEGACY);
            assert.deepEqual(JSON.parse(JSON.stringify(after.data)), DOCS);
            assert.deepEqual(after.audit.events, []);
            assert.equal(fake.requests.filter(request => request.fn === 'zoe_admin_audit_restore').length, before);
        });
        await scenario('missing audit RPC fails the backup explicitly instead of writing a document-only archive', async () => {
            const unsupported = { ...client, rpc: async (fn, args) => {
                if (fn === 'zoe_admin_audit_export') throw new Error('Audit RPC migration unavailable');
                return client.rpc(fn, args);
            } };
            await assert.rejects(supabase.exportTenant(unsupported, SOURCE), /audit.*unavailable/i);
        });
        await scenario('service credential never appears in CLI output or generated archives', () => {
            assert.ok(transcripts.length >= 4);
            assert.ok(transcripts.every(output => !output.includes(secret)));
            assert.ok(!JSON.stringify(sourceArchive).includes(secret) && !JSON.stringify(orphanArchive).includes(secret));
        });
        console.log('REAL POSTGRESQL: ' + migrations.length + ' migrations, random local port, source/retarget/orphan/legacy scopes; no hosted writes.');
    } finally {
        if (fake) await fake.close();
        if (pool) await pool.end();
        if (c) await c.end();
        await H.stop();
        fs.rmSync(dir, { recursive: true, force: true });
    }
}
async function mutationScenarios() {
    const files = ['tools/firebase-backup/backup.js', 'tools/firebase-backup/supabase.js', 'tools/firebase-backup/crypt.js', 'tools/supabase-migrate/migrate.js',
        'supabase/scripts/rtdb-expression.cjs', 'supabase/scripts/rtdb-canonical-key.cjs', 'firebase-database.rules.json'];
    for (const fault of ['drop-events', 'ignore-legacy-audit', 'ignore-event-budget']) await scenario('isolated ' + fault + ' mutation is caught by its business assertion', async () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zoe-audit-archive-mutant-'));
        try {
            for (const relative of files) {
                const target = path.join(dir, relative); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.copyFileSync(path.join(ROOT, relative), target);
            }
            const target = path.join(dir, 'tools/firebase-backup/supabase.js');
            const source = fs.readFileSync(target, 'utf8');
            const from = fault === 'drop-events' ? '        audit\n    };\n}\n\nfunction isArchive'
                : fault === 'ignore-event-budget' ? 'if (events.length >= limits.events)'
                    : "if (Object.prototype.hasOwnProperty.call(value, 'audit') || Object.prototype.hasOwnProperty.call(value.manifest, 'audit'))";
            const to = fault === 'drop-events' ? '        audit: { ...audit, events: [] }\n    };\n}\n\nfunction isArchive' : 'if (false)';
            assert.equal(source.split(from).length - 1, 1);
            fs.writeFileSync(target, source.replace(from, to));
            const result = await runChild(__filename, ['--unit'], { SBAUDITARCHIVE_APP_DIR: dir, RUNALL_STRICT: '0', SUPABASE_STRICT: '0' });
            assert.notEqual(result.code, 0);
            const expected = fault === 'drop-events' ? 'FAIL new backup exports a v2 audit envelope'
                : fault === 'ignore-event-budget' ? 'FAIL aggregate event budget rejects the next page' : 'FAIL audit in a legacy envelope cannot be silently ignored';
            assert.ok((result.stdout + result.stderr).includes(expected), result.stderr);
        } finally { fs.rmSync(dir, { recursive: true, force: true }); }
    });
}
async function main() {
    if (process.argv.slice(2).some(argument => argument !== '--unit')) throw new Error('Unsupported archive checker option.');
    await unitScenarios();
    const unitOnly = process.argv.includes('--unit');
    if (!unitOnly) { await integrationScenarios(); await mutationScenarios(); }
    const minimum = unitOnly ? 26 : 39;
    if (passed + failed < minimum) throw new Error('Archive assertion scenarios did not reach their required coverage floor.');
    console.log((unitOnly ? failed ? 'FAIL UNIT DIAGNOSTIC; PostgreSQL not run: ' : 'PARTIAL PASS (unit diagnostic only; PostgreSQL not run): ' : 'FULL ARCHIVE VERIFICATION: ') + passed + ' pass, ' + failed + ' fail.');
    console.log('ARCHIVE ELAPSED: ' + ((Date.now() - STARTED) / 1000).toFixed(1) + ' seconds.');
    const strictUnit = unitOnly && (process.env.RUNALL_STRICT === '1' || process.env.SUPABASE_STRICT === '1');
    if (strictUnit) console.error('FAIL strict archive verification requires the real PostgreSQL phase; remove --unit.');
    process.exitCode = failed || strictUnit ? 1 : 0;
}
main().catch(error => { console.error('FAIL archive suite: ' + error.message); process.exitCode = 1; });
