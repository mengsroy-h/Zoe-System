// @vitest-environment node
import { expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');

it('Supabase ៖ my_account ត្រូវការ session ត្រឹមត្រូវ ហើយបដិសេធ JWT ចាស់ក្រោយដក session', () => {
    const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'zoe-account-session-'));
    try {
        const run = spawnSync(process.execPath, [path.join(root, 'tools/audit-tools/supabase-account-session-test.cjs')], {
            cwd: scratch,
            encoding: 'utf8',
            timeout: 105000,
            env: { ...process.env, SUPABASE_ACCOUNT_SESSION_APP_DIR: root, SUPABASE_ACCOUNT_SESSION_BASELINE: '' }
        });
        const output = String(run.stdout || '') + String(run.stderr || '');
        expect(run.error, output).toBeUndefined();
        expect(run.signal, output).toBeNull();
        expect(run.status, output).toBe(0);
        expect(output).not.toMatch(/\bSKIP\b|FAIL/);
        expect(JSON.parse(String(run.stdout).trim().split('\n').at(-1)!)).toEqual({
            mode: 'candidate', pass: 19, fail: 0, skipped: 0, infrastructureFailures: 0
        });
    } finally {
        fs.rmSync(scratch, { recursive: true, force: true });
    }
}, 110000);
