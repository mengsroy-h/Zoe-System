import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const workflow = readFileSync(path.resolve(process.cwd(), '../.github/workflows/audit.yml'), 'utf8');
const steps = workflow.match(/^ {6}-[^\n]*(?:\n(?! {6}-)[^\n]*)*/gm) || [];
const step = steps.find(value => /- name: run-all\.sh \(ផ្នែក/.test(value)) || '';
const block = step.match(/^ {8}run: \|\r?\n([\s\S]*)/m)?.[1] || '';
const script = block.split('\n').map(line => line.replace(/^ {10}/, '')).join('\n');

it.each([0, 7, 124])('CI រក្សា stdout/stderr ដោយមិនប្ដូរសាលក្រម %s', status => {
    const dir = mkdtempSync(path.join(tmpdir(), 'zoe-audit-log-'));
    const log = path.join(dir, 'audit evidence.log');
    try {
        expect(script).not.toBe('');
        const result = spawnSync('bash', ['-e', '-c',
            `bash() { printf 'checker stdout\n'; printf 'checker stderr\n' >&2; return ${status}; }\n${script}`], {
            cwd: dir, encoding: 'utf8', timeout: 10000,
            env: { ...process.env, ZOE_MULTISHOP_SCALE: 'false', AUDIT_LOG: log }
        });
        expect(result.error).toBeUndefined();
        expect(result.signal).toBeNull();
        expect(result.status).toBe(status);
        expect(readFileSync(log, 'utf8')).toBe('checker stdout\nchecker stderr\n');
        expect(result.stdout).toBe('checker stdout\nchecker stderr\n');
    } finally { rmSync(dir, { recursive: true, force: true }); }
});

it('CI មិនអាចបៃតងពេលការរក្សា log ធ្លាក់', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'zoe-audit-log-fail-'));
    try {
        const result = spawnSync('bash', ['-e', '-c',
            'bash() { printf "checker stdout\n"; }\n' + script], {
            cwd: dir, encoding: 'utf8', timeout: 10000,
            env: { ...process.env, ZOE_MULTISHOP_SCALE: 'false', AUDIT_LOG: dir }
        });
        expect(result.error).toBeUndefined();
        expect(result.signal).toBeNull();
        expect(result.status).not.toBe(0);
    } finally { rmSync(dir, { recursive: true, force: true }); }
});

it('CI artifact អាន log ដូចគ្នា ហើយរត់ក្រោយ verdict ក្រហម', () => {
    const destination = step.match(/^ {10}AUDIT_LOG: (.+)$/m)?.[1];
    expect(destination).toBeTruthy();
    expect(destination).toContain('${{ runner.temp }}');
    const uploads = steps.filter(value => /uses: actions\/upload-artifact@/.test(value)
        && value.match(/^ {10}path: (.+)$/m)?.[1] === destination);
    expect(uploads).toHaveLength(1);
    expect(uploads[0]).toMatch(/^ {8}if: always\(\)/m);
    expect(uploads[0]).toContain('${{ matrix.shard }}');
    expect(uploads[0]).toMatch(/^ {10}retention-days: 14$/m);
});
