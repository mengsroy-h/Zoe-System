import { expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

it('Supabase ៖ Admin ត្រូវមាន session ត្រឹមត្រូវ ហើយការដក session បិទសិទ្ធិលើសំណើបន្ទាប់', () => {
    const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'zoe-admin-session-'));
    const resultFile = path.join(scratch, 'result.json');
    try {
        const run = spawnSync(process.execPath, [path.join(root, 'audit-tools/supabase-platform-admin-session-test.cjs')], {
            cwd: scratch,
            encoding: 'utf8',
            timeout: 105000,
            env: { ...process.env, SUPABASE_ADMIN_SESSION_APP_DIR: root, SUPABASE_ADMIN_SESSION_RESULT: resultFile, SUPABASE_ADMIN_SESSION_BASELINE: '' }
        });
        const output = String(run.stdout || '') + String(run.stderr || '');
        expect(run.error, output).toBeUndefined();
        expect(run.signal, output).toBeNull();
        expect(run.status, output).toBe(0);
        expect(output).not.toMatch(/\bSKIP\b|FAIL|harness setup|: infrastructure/);
        const summary = JSON.parse(String(run.stdout).trim().split('\n').at(-1)!);
        expect(summary).toEqual({ mode: 'candidate', pass: 43, fail: 0, skipped: 0, infrastructureFailures: 0 });
        const result = JSON.parse(fs.readFileSync(resultFile, 'utf8'));
        expect(result).toMatchObject(summary);
        expect(result.migration).toBe('20261101071206_zoe_platform_admin_active_session.sql');
        expect(result.cases).toHaveLength(43);
        expect(new Set(result.cases.map((entry: { label: string }) => entry.label)).size).toBe(43);
        expect(result.cases.every((entry: { pass: boolean; kind: string }) => entry.pass === true && entry.kind === 'behavior')).toBe(true);
    } finally {
        fs.rmSync(scratch, { recursive: true, force: true });
    }
}, 110000);
