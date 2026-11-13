import { expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { runInNewContext } from 'node:vm';

const root = path.resolve(__dirname, '../../..');
const hash = (file: string) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const ids = [
    'native-strict-cas-cold', 'ui-pending-first-snapshot', 'ready-service-positive', 'positive-conflict-explicit',
    'same-intent-changed-body', 'lost-ack-readonly-later-pickup', 'public-unknown-manual-resume', 'ordinary-pickup-preserves',
    'native-drop-proof-rejected', 'native-malformed-proof-rejected', 'old-client-failclosed-after-proof', 'legacy-unreceipted-hold',
    'receipt-replacement-HOLD', 'concurrent-reset', 'old-session-receipt-only', 'public-storage-denied',
    'paired-native-archive-actor-preservation', 'independent-context-fixed-cas', 'independent-context-unknown-restart'
];

it('paired Reset Web Locks fixture keeps ordinary writers exclusive and try-lock recovery nonblocking', async () => {
    const source = fs.readFileSync(path.join(root, 'audit-tools/supabase-pickup-reset-paired-sdk-test.cjs'), 'utf8');
    const start = source.indexOf('function locks() {'), end = source.indexOf('\nfunction requestHttp(', start);
    expect(start).toBeGreaterThanOrEqual(0); expect(end).toBeGreaterThan(start);
    const coordinator = runInNewContext(source.slice(start, end) + '\nlocks()');
    expect(await coordinator.api.request('overload', () => 'ordinary')).toBe('ordinary');
    const events: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const first = coordinator.api.request('same', async (lock: { name: string; mode: string }) => {
        expect(lock).toEqual({ name: 'same', mode: 'exclusive' }); events.push('first'); await gate; events.push('released'); return 1;
    });
    const second = coordinator.api.request('same', {}, async () => { events.push('second'); return 2; });
    const third = coordinator.api.request('same', async () => { events.push('third'); return 3; });
    expect(await coordinator.api.request('same', { ifAvailable: true }, (lock: null) => { expect(lock).toBeNull(); return 'busy'; })).toBe('busy');
    expect(await coordinator.api.request('other', () => 'independent')).toBe('independent');
    expect(events).toEqual(['first']); expect(coordinator.held.has('same')).toBe(true);
    release(); expect(await Promise.all([first, second, third])).toEqual([1, 2, 3]);
    expect(events).toEqual(['first', 'released', 'second', 'third']); expect(coordinator.held.size).toBe(0);
    await expect(coordinator.api.request('failure', () => { throw new Error('synthetic callback failure'); })).rejects.toThrow('synthetic callback failure');
    expect(await coordinator.api.request('failure', { ifAvailable: true }, (lock: unknown) => !!lock)).toBe(true);
    let rejectHolder!: (error: Error) => void;
    const rejected = coordinator.api.request('rejected', () => new Promise((_resolve, reject) => { rejectHolder = reject; }));
    const observed = expect(rejected).rejects.toThrow('synthetic rejected holder');
    const successor = coordinator.api.request('rejected', () => 'successor');
    rejectHolder(new Error('synthetic rejected holder')); await observed;
    expect(await successor).toBe('successor'); expect(coordinator.held.size).toBe(0);
    await expect(coordinator.api.request('unsupported', { mode: 'shared' }, () => true)).rejects.toThrow();
});

it('Supabase SDK ៖ paired Reset19 ប្រើ native seed ដូចគ្នា និង authoritative SQL outcomes', () => {
    const driver = path.join(root, 'audit-tools/supabase-pickup-reset-paired-sdk-test.cjs');
    const native = path.join(root, 'audit-tools/emu/pickup-reset-applied-sdk-test.js');
    const preserved = [path.join(root, 'audit-tools/supabase-pickup-reset-applied-test.cjs'), path.join(__dirname, 'supabase-pickup-reset-applied.pg.test.ts')];
    const before = preserved.map(file => [file, hash(file)]);
    const migrationDir = path.join(root, 'supabase/migrations');
    const files = fs.readdirSync(migrationDir).filter(name => /^\d{14}_[a-z0-9_]+\.sql$/.test(name)).sort()
        .map(name => ({ name, sha256: hash(path.join(migrationDir, name)) }));
    const first62Hash = createHash('sha256').update(JSON.stringify(files.slice(0, 62).map(file => [file.name, file.sha256]))).digest('hex');
    expect(files.length).toBeGreaterThanOrEqual(62);
    expect(first62Hash).toBe('c4f2eb06b4d6b0f43e9a23ae5d955445b7b01eca8d1838ed2ecf89a85c9a3aa2');
    expect(files.map(file => file.name)).toContain('20261109122019_zoe_rules.sql');
    const manifest = { count: files.length, latest: files.at(-1)!.name, latestRules: files.filter(file => file.name.endsWith('_zoe_rules.sql')).at(-1)!.name, first62Hash, files };
    const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'zoe-paired-reset19-'));
    const resultFile = path.join(scratch, 'result.json');
    let passed = false;
    try {
        if (process.env.F09_PAIRED_SDK_EVIDENCE_FILE) {
            for (const suffix of ['', '.stdout.log', '.stderr.log']) fs.rmSync(process.env.F09_PAIRED_SDK_EVIDENCE_FILE + suffix, { force: true });
        }
        const run = spawnSync(process.execPath, [driver], { cwd: scratch, encoding: 'utf8', timeout: 170000, maxBuffer: 8 * 1024 * 1024,
            env: { ...process.env, SUPABASE_RESET_PAIRED_APP_DIR: root, ZOE_REPO_ROOT: root, SUPABASE_RESET_PAIRED_OUT: scratch,
                SUPABASE_RESET_PAIRED_RESULT: resultFile, SUPABASE_RESET_PAIRED_CASE: '' } });
        let output = String(run.stdout || '') + String(run.stderr || '');
        if (process.env.F09_PAIRED_SDK_EVIDENCE_FILE) {
            const evidence = process.env.F09_PAIRED_SDK_EVIDENCE_FILE;
            if (fs.existsSync(resultFile)) fs.copyFileSync(resultFile, evidence);
            fs.writeFileSync(evidence + '.stdout.log', String(run.stdout || ''));
            fs.writeFileSync(evidence + '.stderr.log', String(run.stderr || ''));
        }
        if (run.status !== 0 && fs.existsSync(resultFile)) {
            try {
                const failed = JSON.parse(fs.readFileSync(resultFile, 'utf8'));
                output += '\n' + JSON.stringify({ errors: failed.errors, cleanupErrors: failed.cleanupErrors });
            } catch { output += '\nOwned driver result could not be parsed: ' + resultFile; }
        }
        expect(run.error, output).toBeUndefined(); expect(run.signal, output).toBeNull(); expect(run.status, output).toBe(0);
        expect(output).not.toMatch(/^\s*(?:FAIL|SKIP|SKIPPED)\b/m);
        const result = JSON.parse(fs.readFileSync(resultFile, 'utf8'));
        expect(result).toMatchObject({ status: 'PASS_ACTUAL_SDK_HTTP_PG_19_SCENARIOS_18_COMPARABLE_1_SDK_SPECIFIC', full: true, fail: 0, errors: [], cleanupErrors: [], outboundViolations: [], inputDrift: [],
            driverHash: hash(driver), nativeSourceHash: hash(native), sharedFixtureHash: hash(path.join(root, 'audit-tools/fixtures/pickup-reset-parity-fixture.cjs')), nativeEngine: 'UNRUN_BY_THIS_CHECKER', migrationCount: manifest.count, authPasswordOrRevocationMutation: false });
        expect(result.migrationManifest).toEqual(manifest);
        expect(result.migrationRules).toMatchObject({ canonicalSha256: hash(path.join(root, 'firebase-database.rules.json')),
            compilerSha256: hash(path.join(root, 'supabase/scripts/rtdb-rules.mjs')), expressionSha256: hash(path.join(root, 'supabase/scripts/rtdb-expression.cjs')),
            latestRulesSha256: hash(path.join(migrationDir, manifest.latestRules)), latestRulesSqlFresh: true,
            restoreGuardPresent: true, dayValidationReferencesGuard: true, installedCanonicalEqual: true });
        expect(result.migrationRules.compiledSha256).toMatch(/^[a-f0-9]{64}$/);
        expect(result.comparison).toEqual({ comparableScenarios: 18, providerSpecificScenarios: ['native-strict-cas-cold'], identicalOutcomeClaim: false });
        expect(result.cases.filter((row: { sharedFixture: { profile: string } }) => row.sharedFixture.profile === 'imported-native-day').map((row: { id: string }) => row.id))
            .toEqual(['native-drop-proof-rejected', 'native-malformed-proof-rejected', 'old-client-failclosed-after-proof']);
        expect(result.selectedCases).toEqual(ids); expect(result.expectedCases).toEqual(ids);
        expect(result.cases.map((row: { id: string }) => row.id)).toEqual(ids);
        expect(new Set(result.cases.map((row: { id: string }) => row.id)).size).toBe(19);
        expect(result.cases.every((row: { status: string; assertions: string[] }) => row.status === 'PASS' && row.assertions.length > 0)).toBe(true);
        expect(result.assertions.length).toBe(result.pass);
        expect(new Set(result.assertions.map((row: { id: string }) => row.id)).size).toBe(result.pass);
        expect(result.assertions.every((row: { pass: boolean }) => row.pass === true)).toBe(true);
        expect(result.fixtureControls.map((row: { id: string }) => row.id)).toEqual(['wrong-packages', 'missing-tail', 'wrong-money', 'missing-month', 'wrong-history-count']);
        expect(result.fixtureControls.every((row: { pass: boolean; resetRpcCalls: number }) => row.pass === true && row.resetRpcCalls === 0)).toBe(true);
        expect(result.commonSeed).toEqual({
            zoew_daily_pickup_cod_dod: Object.fromEntries(['2026-11-01', '2026-10-31', '2026-11-02'].map(day => [day, {
                pickupRevision: 5, pickupResetEpoch: 2, packagesPickedUp: 2, pickedUpPhones: { PHONE: 2 }, pickedUpBarcodes: { CODE_A: 'PHONE', CODE_B: 'PHONE' }
            }])),
            zoew_daily_revenue_cod_dod: { '2026-11-01': { codDollar: 37, dodDollar: 5, totalCount: 11 } },
            zoew_monthly_revenue_cod_dod: { '2026-11': { codDollar: 37, dodDollar: 5, totalCount: 11 } },
            zoew_scan_history_cod_dod: { retained: { id: 'retained', isClosed: true, count: 1, cod: 37, dod: 5 } }
        });
        expect(result.cleanup).toMatchObject({ frames: 0, httpTasks: 0, sockets: 0, pgStopRequested: true });
        expect(result.cleanup.ownedPgChildren.length).toBeGreaterThan(0);
        expect(result.cleanup.ownedPgChildren.every((row: { exitCode: number | null; signalCode: string | null }) => row.exitCode !== null || row.signalCode !== null)).toBe(true);
        for (const [file, expected] of Object.entries(result.sourceFiles)) expect(hash(file)).toBe(expected);
        expect(preserved.map(file => [file, hash(file)])).toEqual(before);
        passed = true;
    } finally {
        if (passed) fs.rmSync(scratch, { recursive: true, force: true });
        else console.error('Failed paired Reset evidence preserved:', scratch);
    }
}, 175000);
