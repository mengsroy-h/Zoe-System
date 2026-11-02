import { expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const root = path.resolve(__dirname, '../..');
const migration = '20261101151500_zoe_pickup_reset_applied.sql';
const hash = (file: string) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');

it('Supabase ៖ Reset រក្សា original CAS និង proof ដោយ atomic effects និង read-only recovery', () => {
    const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'zoe-reset-applied-pg-'));
    const driver = path.join(root, 'audit-tools/supabase-pickup-reset-applied-test.cjs');
    const migrationFile = path.join(root, 'supabase/migrations', migration);
    const codec = path.join(root, 'ZoeW/src/domain/pickup-reset-proof.ts');
    const sourceFiles = [driver, codec, ...fs.readdirSync(path.join(root, 'supabase/migrations'))
        .filter(name => /^\d{14}_[a-z0-9_]+\.sql$/.test(name)).sort().map(name => path.join(root, 'supabase/migrations', name)),
        path.join(root, 'firebase-database.rules.json'), path.join(root, 'supabase/scripts/rtdb-rules.mjs'),
        path.join(root, 'supabase/scripts/rtdb-expression.cjs'), path.join(root, 'supabase/scripts/rtdb-canonical-key.cjs')];
    const before = sourceFiles.map(file => [file, hash(file)]);
    const driverHash = hash(driver), sourceHash = hash(migrationFile);
    const resultFile = path.join(scratch, 'result.json');
    let passed = false;
    try {
        const run = spawnSync(process.execPath, [driver], {
            cwd: scratch,
            encoding: 'utf8',
            timeout: 105000,
            maxBuffer: 4 * 1024 * 1024,
            env: { ...process.env, SUPABASE_RESET_APP_DIR: root, ZOE_REPO_ROOT: root, SUPABASE_RESET_RESULT: resultFile, SUPABASE_RESET_BASELINE: '' }
        });
        const output = String(run.stdout || '') + String(run.stderr || '');
        if (process.env.F09_PG_EVIDENCE_FILE && fs.existsSync(resultFile)) fs.copyFileSync(resultFile, process.env.F09_PG_EVIDENCE_FILE);
        expect(run.error, output).toBeUndefined();
        expect(run.signal, output).toBeNull();
        expect(run.status, output).toBe(0);
        expect(output).not.toMatch(/^\s*(?:FAIL|SKIP|SKIPPED)\b/m);
        const summary = JSON.parse(String(run.stdout).trim().split('\n').at(-1)!);
        expect(summary).toMatchObject({ mode: 'current', pass: 75, fail: 0, skipped: 0, infrastructureFailures: 0, migration, sourceHash, driverHash });
        expect(summary.cases).toHaveLength(75);
        expect(new Set(summary.cases.map((entry: { label: string }) => entry.label)).size).toBe(75);
        expect(summary.cases.every((entry: { pass: boolean; kind: string }) => entry.pass === true && entry.kind === 'behavior')).toBe(true);
        expect(createHash('sha256').update(JSON.stringify(summary.cases.slice(0, 68).map((entry: { label: string }) => entry.label))).digest('hex'))
            .toBe('a8a945967a60526608f4d9d8ee9172926450e5ae8208e960c45b0ff8b4d185cf');
        expect(summary.cases.slice(68).map((entry: { label: string }) => entry.label)).toEqual([
            "paired distinct Reset IDs are concurrently blocked before original effects",
            "paired distinct Reset IDs apply one fixed attempt and hold the losing original identity",
            "paired distinct Reset race consumes one epoch sequence and fully charged winner receipt only",
            "paired race winner replays receipt only while losing status stays UNKNOWN without effects",
            "paired old Reset prestate is an actual authenticated receipt-bearing canonical commit",
            "paired old BASE5 epoch Reset cannot erase protected proof or mutate money sequence bytes",
            "paired proof-preserving ordinary writer remains allowed after old Reset refusal"
        ]);
        for (const label of [
            'composition uses all current migrations including native-day compiled preservation',
            'typed SQL Reset atomically composes exact original BASE CAS with new native-day proof',
            'postGC matching embedded day proof NEVER substitutes for missing SQL operation receipt',
            'composed positive receipt growth quota refusal retains old proof and rolls back all effects',
            'supported admin document restore preserves original native-day identity without invented SQL receipt'
        ]) expect(summary.cases.some((entry: { label: string }) => entry.label === label)).toBe(true);
        expect(summary.concurrencyEvidence).toHaveLength(8);
        expect(summary.concurrencyEvidence.slice(0, 6).map((entry: { label: string }) => entry.label)).toEqual([
            "same-attempt waits original tenantstate",
            "original tenant waits privileged member move",
            "status waits pending original state",
            "later move waits original and status member locks",
            "reset waits ordinary pickup state transaction",
            "reset waits uncommitted unique op insertion after CAS effects"
        ]);
        const pairedLocks = summary.concurrencyEvidence.slice(6);
        expect(pairedLocks.map((entry: { label: string }) => entry.label).sort()).toEqual([
            "paired distinct Reset 0 waits original state",
            "paired distinct Reset 1 waits original state"
        ]);
        expect(new Set(pairedLocks.map((entry: { pid: number }) => entry.pid)).size).toBe(2);
        for (const entry of pairedLocks) {
            expect(Number.isSafeInteger(entry.pid)).toBe(true); expect(entry.pid).toBeGreaterThan(0);
            expect(entry.activity).toMatchObject({ wait_event_type: 'Lock' });
            expect(entry.activity.query).toMatch(/^\s*select public\.zoe_pickup_reset_execute_v1\(/);
        }
        expect(summary.codecEvidence.composition).toMatchObject({
            nativeRules: '20261101231537_zoe_rules.sql', nativeEngine: 'UNRUN', canonicalGeneratedFresh: true, installedCanonicalEqual: true,
            f03LegacyPolicyHash: '240c2cac550e3f20988b1e06b3c83339c8be27416e63685ff41448f4a0f98740',
            f09DailyPolicyHash: 'c3280874e9c28bb0b01a97b7c82d892c88ce434428fcc4b9142607e1087d2049'
        });
        expect(summary.codecEvidence.composition.migrationCount).toBe(50);
        expect(summary.codecEvidence.composition.nativeRulesHash).toBe(hash(path.join(root, 'supabase/migrations', '20261101231537_zoe_rules.sql')));
        expect(summary.codecEvidence.sourceHash).toBe(hash(codec));
        expect(summary.codecEvidence.vectors).toHaveLength(3);
        expect(summary.codecEvidence.vectors.map((entry: { name: string; goldenId: string; goldenSQLHash: string; casTextHash: string }) => ({
            name: entry.name, goldenId: entry.goldenId, goldenSQLHash: entry.goldenSQLHash, casTextHash: entry.casTextHash
        }))).toEqual([
            {
                "name": "legacy-ascii",
                "goldenId": "b9da1664a37f020c6fc2b841a54b0fe4428819c59a848d6ae5ba84bfd8b0985f",
                "goldenSQLHash": "b9da1664a37f020c6fc2b841a54b0fe4428819c59a848d6ae5ba84bfd8b0985f",
                "casTextHash": "d75fefeebb714a127e735e2260721ec45fbb6b6d42864ec9841a3e0d882d09ad"
            },
            {
                "name": "unicode-escaped",
                "goldenId": "1a88cdd6c7c0e0ec6e45ab4a2a9e8429c604e461e15cf67b6b8f0ad52844e46d",
                "goldenSQLHash": "1a88cdd6c7c0e0ec6e45ab4a2a9e8429c604e461e15cf67b6b8f0ad52844e46d",
                "casTextHash": "9720dee0b8b7ede303dc95b5d46698a4f0606a6bd2370d6144e3b3bb8ab5bace"
            },
            {
                "name": "exact-cas-number-text",
                "goldenId": "a113402088e6a69f14e1dd3af0be959dc144bf838a565e60f44074cfcde736f6",
                "goldenSQLHash": "a113402088e6a69f14e1dd3af0be959dc144bf838a565e60f44074cfcde736f6",
                "casTextHash": "aab968bb57cf5be2874bec5c0f268524b8ba8644fe4ed4cf58c2c43758b02fab"
            }
        ]);
        expect(summary.codecEvidence.vectors.every((entry: { rebasedApplied: boolean; rebasedAttemptId: string }) =>
            entry.rebasedApplied === true && /^[a-f0-9]{64}$/.test(entry.rebasedAttemptId))).toBe(true);
        expect(summary.callCounts.execute).toBeGreaterThanOrEqual(35);
        expect(summary.callCounts.status).toBeGreaterThanOrEqual(14);
        expect(JSON.parse(fs.readFileSync(resultFile, 'utf8'))).toEqual(summary);
        expect(sourceFiles.map(file => [file, hash(file)])).toEqual(before);
        passed = true;
    } finally {
        if (passed) fs.rmSync(scratch, { recursive: true, force: true });
        else console.error('F09 SQL evidence retained at ' + scratch);
    }
}, 110000);
