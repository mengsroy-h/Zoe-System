import { expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { isDeepStrictEqual } from 'node:util';

const root = path.resolve(__dirname, '../../..');
const migration = '20261101151500_zoe_pickup_reset_applied.sql';
const hash = (file: string) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const require = createRequire(import.meta.url);

it('Supabase ៖ Reset រក្សា original CAS និង proof ដោយ atomic effects និង read-only recovery', () => {
    const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'zoe-reset-applied-pg-'));
    const driver = path.join(root, 'audit-tools/supabase-pickup-reset-applied-test.cjs');
    const migrationFile = path.join(root, 'supabase/migrations', migration);
    const codec = path.join(root, 'ZoeW/src/domain/pickup-reset-proof.ts');
    const migrations = fs.readdirSync(path.join(root, 'supabase/migrations')).filter(name => /^\d{14}_[a-z0-9_]+\.sql$/.test(name)).sort();
    const entries = migrations.map(name => ({ name, sha256: hash(path.join(root, 'supabase/migrations', name)) }));
    const manifest = { count: migrations.length, latest: migrations.at(-1), latestRules: migrations.filter(name => /_zoe_rules\.sql$/.test(name)).at(-1),
        first62Hash: createHash('sha256').update(JSON.stringify(entries.slice(0, 62).map(entry => [entry.name, entry.sha256]))).digest('hex'), files: entries };
    expect(manifest.first62Hash).toBe('c4f2eb06b4d6b0f43e9a23ae5d955445b7b01eca8d1838ed2ecf89a85c9a3aa2');
    expect(migrations).toContain('20261109122019_zoe_rules.sql');
    const sourceFiles = [driver, codec, ...migrations.map(name => path.join(root, 'supabase/migrations', name)),
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
            nativeRules: manifest.latestRules, nativeEngine: 'UNRUN', canonicalGeneratedFresh: true, installedCanonicalEqual: true,
            f03LegacyPolicyHash: '9dacfafd574466ed623c36eaf3b595b182abae648ded6428ef4f2bec5f343e33',
            guardProjection: { legacyPolicyHash: 'c3280874e9c28bb0b01a97b7c82d892c88ce434428fcc4b9142607e1087d2049',
                projectedPolicyHash: 'c3280874e9c28bb0b01a97b7c82d892c88ce434428fcc4b9142607e1087d2049',
                deltaHashesIncludeFoldHints: true, exactLegacyBranches: true, exactLegacyProjection: true, reviewedGuardPresent: true }
        });
        expect(summary.codecEvidence.composition.migrationManifest).toEqual(manifest);
        expect(summary.codecEvidence.composition.migrationCount).toBe(manifest.count);
        expect(summary.codecEvidence.composition.nativeRulesHash).toBe(hash(path.join(root, 'supabase/migrations', manifest.latestRules!)));
        expect(summary.codecEvidence.composition.f09DailyPolicyHash).toMatch(/^[a-f0-9]{64}$/);
        expect(summary.codecEvidence.composition.f09DailyPolicyHash).not.toBe(summary.codecEvidence.composition.guardProjection.legacyPolicyHash);
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

it('F09 projection រក្សា old AST និង hash ដោយដកតែ reviewed restoreGuard delta', () => {
    const source = fs.readFileSync(path.join(root, 'audit-tools/supabase-pickup-reset-applied-test.cjs'), 'utf8');
    const ast = require('acorn').parse(source, { ecmaVersion: 'latest' }) as { body: { type: string; id?: { name: string }; start: number; end: number }[] };
    const helpers = ['f09PolicyHash', 'f09PolicyProjection'].map(name => {
        const node = ast.body.find(entry => entry.type === 'FunctionDeclaration' && entry.id?.name === name);
        if (!node) throw new Error('missing actual driver helper ' + name);
        return source.slice(node.start, node.end);
    }).join('\n');
    const { f09PolicyHash, f09PolicyProjection } = runInNewContext(helpers + '\n({ f09PolicyHash, f09PolicyProjection });', {
        sha: (value: string) => createHash('sha256').update(value).digest('hex'),
        clone: (value: unknown) => JSON.parse(JSON.stringify(value)), isDeepStrictEqual
    });
    const rules = (name: string) => JSON.parse(fs.readFileSync(path.join(root, 'supabase/migrations', name), 'utf8').split('$zoe_rules_json$')[1]).c.zoew_daily_pickup_cod_dod;
    const legacy = rules('20261105010507_zoe_rules.sql'), current = rules('20261109122019_zoe_rules.sql');
    const before = JSON.stringify(current);
    expect(f09PolicyProjection(current, legacy)).toMatchObject({ exactLegacyBranches: true, exactLegacyProjection: true, reviewedGuardPresent: true,
        projectedPolicyHash: 'c3280874e9c28bb0b01a97b7c82d892c88ce434428fcc4b9142607e1087d2049' });
    expect(JSON.stringify(current)).toBe(before);
    const mutations = [
        (value: typeof current) => { value.x.r.v.l = { t: 'l', v: true }; },
        (value: typeof current) => { value.x.r.c.pickedUpBarcodes.x.r.v.l = { t: 'l', v: true }; },
        (value: typeof current) => { value.x.r.w = { t: 'l', v: true }; },
        (value: typeof current) => { value.x.r.c.f = { v: { t: 'l', v: true } }; },
        (value: typeof current) => { value.x.r.v.r.r = { t: 'l', v: true }; },
        (value: typeof current) => { value.x.r.v.r.l.e.o.f = { b: 'R', l: ['unexpected_fold_path'] }; },
        (value: typeof current) => { value.x.r.c.pickedUpBarcodes.x.r.v.r.l = { t: 'l', v: true }; },
        (value: typeof current) => { value.x.r.c.restoreGuard.c.f = { v: { t: 'l', v: true } }; },
        (value: typeof current) => { delete value.x.r.c.restoreGuard; },
        (value: typeof current) => { value.x.r.c.packagesPickedUp.v = { t: 'l', v: true }; }
    ];
    for (const mutate of mutations) {
        const changed = JSON.parse(before); mutate(changed);
        expect(() => f09PolicyProjection(changed, legacy)).toThrow(/F09/);
    }
    const changedLegacy = JSON.parse(JSON.stringify(legacy)), changedCurrent = JSON.parse(before);
    for (const value of [changedLegacy, changedCurrent]) value.x.r.c.f = { v: { t: 'l', v: true } };
    expect(f09PolicyHash(changedLegacy)).not.toBe(f09PolicyHash(legacy));
    expect(() => f09PolicyProjection(changedCurrent, changedLegacy)).toThrow(/immutable legacy policy hash/);
});
