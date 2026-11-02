import { expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const root = path.resolve(__dirname, '../..');
const hash = (file: string) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const ids = [
    'native-strict-cas-cold', 'ui-pending-first-snapshot', 'ready-service-positive', 'positive-conflict-explicit',
    'same-intent-changed-body', 'lost-ack-readonly-later-pickup', 'public-unknown-manual-resume', 'ordinary-pickup-preserves',
    'native-drop-proof-rejected', 'native-malformed-proof-rejected', 'old-client-failclosed-after-proof', 'legacy-unreceipted-hold',
    'receipt-replacement-HOLD', 'concurrent-reset', 'old-session-receipt-only', 'public-storage-denied',
    'paired-native-archive-actor-preservation', 'independent-context-fixed-cas', 'independent-context-unknown-restart'
];

it('Supabase SDK ៖ paired Reset19 ប្រើ native seed ដូចគ្នា និង authoritative SQL outcomes', () => {
    const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'zoe-paired-reset19-'));
    const driver = path.join(root, 'audit-tools/supabase-pickup-reset-paired-sdk-test.cjs');
    const native = path.join(root, 'audit-tools/emu/pickup-reset-applied-sdk-test.js');
    const preserved = [path.join(root, 'audit-tools/supabase-pickup-reset-applied-test.cjs'), path.join(__dirname, 'supabase-pickup-reset-applied.pg.test.ts')];
    const before = preserved.map(file => [file, hash(file)]);
    const resultFile = path.join(scratch, 'result.json');
    try {
        const run = spawnSync(process.execPath, [driver], { cwd: scratch, encoding: 'utf8', timeout: 170000, maxBuffer: 8 * 1024 * 1024,
            env: { ...process.env, SUPABASE_RESET_PAIRED_APP_DIR: root, ZOE_REPO_ROOT: root, SUPABASE_RESET_PAIRED_OUT: scratch,
                SUPABASE_RESET_PAIRED_RESULT: resultFile, SUPABASE_RESET_PAIRED_CASE: '' } });
        const output = String(run.stdout || '') + String(run.stderr || '');
        expect(run.error, output).toBeUndefined(); expect(run.signal, output).toBeNull(); expect(run.status, output).toBe(0);
        expect(output).not.toMatch(/^\s*(?:FAIL|SKIP|SKIPPED)\b/m);
        const result = JSON.parse(fs.readFileSync(resultFile, 'utf8'));
        expect(result).toMatchObject({ status: 'PASS_ACTUAL_SDK_HTTP_PG_19_SCENARIOS_18_COMPARABLE_1_SDK_SPECIFIC', full: true, fail: 0, errors: [], cleanupErrors: [], outboundViolations: [], inputDrift: [],
            driverHash: hash(driver), nativeSourceHash: hash(native), sharedFixtureHash: hash(path.join(root, 'audit-tools/fixtures/pickup-reset-parity-fixture.cjs')), nativeEngine: 'UNRUN_BY_THIS_CHECKER', migrationCount: 50, authPasswordOrRevocationMutation: false });
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
        if (process.env.F09_PAIRED_SDK_EVIDENCE_FILE) fs.writeFileSync(process.env.F09_PAIRED_SDK_EVIDENCE_FILE, JSON.stringify(result, null, 2) + '\n');
    } finally { fs.rmSync(scratch, { recursive: true, force: true }); }
}, 175000);
