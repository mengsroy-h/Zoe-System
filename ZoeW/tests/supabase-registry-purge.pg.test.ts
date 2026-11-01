import { expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const root = path.resolve(__dirname, '../..');
const migration = '20261101123154_zoe_atomic_registry_purge.sql';
const hash = (file: string) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');

it('Supabase ៖ purge ពេញលេញចង original tenant និង source ដោយ atomic receipts និងការស្តារភស្តុតាង', () => {
    const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'zoe-purge-pg-'));
    const driver = path.join(root, 'audit-tools/supabase-purge-atomic-test.cjs');
    const migrationFile = path.join(root, 'supabase/migrations', migration);
    const driverHash = hash(driver), sourceHash = hash(migrationFile);
    const resultFile = path.join(scratch, 'result.json');
    try {
        const run = spawnSync(process.execPath, [driver], {
            cwd: scratch,
            encoding: 'utf8',
            timeout: 105000,
            maxBuffer: 4 * 1024 * 1024,
            env: { ...process.env, SUPABASE_PURGE_APP_DIR: root, ZOE_REPO_ROOT: root, SUPABASE_PURGE_RESULT: resultFile }
        });
        const output = String(run.stdout || '') + String(run.stderr || '');
        expect(run.error, output).toBeUndefined();
        expect(run.signal, output).toBeNull();
        expect(run.status, output).toBe(0);
        expect(output).not.toMatch(/^\s*(?:FAIL|SKIP|SKIPPED)\b/m);
        const summary = JSON.parse(String(run.stdout).trim().split('\n').at(-1)!);
        expect(summary).toMatchObject({ pass: 93, fail: 0, skipped: 0, infrastructureFailures: 0, migration, sourceHash, driverHash });
        expect(summary.cases).toHaveLength(93);
        expect(new Set(summary.cases.map((entry: { label: string }) => entry.label)).size).toBe(93);
        expect(summary.cases.every((entry: { pass: boolean; kind: string }) => entry.pass === true && entry.kind === 'behavior')).toBe(true);
        for (const count of [1, 2, 249, 250, 251]) {
            expect(summary.cases.some((entry: { label: string }) => entry.label.startsWith('N=' + count + ' ៖ full packet execute applied'))).toBe(true);
        }
        for (const label of ['server source/member authority rejects wrong registry key pair',
            'full locked source membership cannot trust privileged source.count mirror',
            'exact4MiB+1 SQL-expanded packet rejected with zero persistence']) {
            expect(summary.cases.some((entry: { label: string }) => entry.label === label)).toBe(true);
        }
        expect(JSON.parse(fs.readFileSync(resultFile, 'utf8'))).toEqual(summary);
        expect(hash(driver)).toBe(driverHash);
        expect(hash(migrationFile)).toBe(sourceHash);
        if (process.env.F03_PG_EVIDENCE_FILE) fs.writeFileSync(process.env.F03_PG_EVIDENCE_FILE, JSON.stringify(summary, null, 2) + '\n');
    } finally {
        fs.rmSync(scratch, { recursive: true, force: true });
    }
}, 110000);
