// @vitest-environment node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '../../../..');
const tool = path.join(root, 'tools/firebase-provision/stage-business-audit.js');
const temporary: string[] = [];
const target = ['--project', 'zoe-audit-test', '--instance', 'zoe-audit-test-default-rtdb', '--branch', 'QA_001', '--region', 'asia-southeast1'];

function fixture() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zoe-audit-stage-'));
    temporary.push(dir);
    fs.copyFileSync(tool, path.join(dir, 'stage-business-audit.js'));
    const runtime = path.join(dir, 'business-audit-functions');
    fs.mkdirSync(runtime);
    for (const [name, contents] of Object.entries({
        'index.cjs': 'exports.audit = () => true;\n',
        'business-audit.cjs': 'module.exports = {};\n',
        'package.json': JSON.stringify({ name: 'audit-fixture', main: 'index.cjs', engines: { node: '22' } }),
        'package-lock.json': JSON.stringify({ name: 'audit-fixture', lockfileVersion: 3 }),
        'firebase.json': JSON.stringify({ functions: { source: '.' } })
    })) fs.writeFileSync(path.join(runtime, name), contents);
    fs.writeFileSync(path.join(dir, 'deny-network.cjs'), `const Module = require('node:module'); const load = Module._load; Module._load = function(name, ...args) { if (['http','https','net','dns','tls','child_process'].some(value => name === value || name === 'node:' + value)) throw new Error('forbidden-network-or-process'); return load.call(this, name, ...args); }; globalThis.fetch = () => { throw new Error('forbidden-fetch'); };`);
    return { dir, runtime, destination: path.join(dir, 'staged') };
}

function run(f: ReturnType<typeof fixture>, args: string[]) {
    return spawnSync(process.execPath, [path.join(f.dir, 'stage-business-audit.js'), ...args], {
        cwd: f.dir, encoding: 'utf8', timeout: 10000,
        env: { ...process.env, NODE_OPTIONS: '--require=' + path.join(f.dir, 'deny-network.cjs') }
    });
}

afterEach(() => { for (const dir of temporary.splice(0)) fs.rmSync(dir, { recursive: true, force: true }); });

it('Firebase audit៖ default plan ជាក់លាក់ មិនបង្កើត file ឬ network/process call', () => {
    const f = fixture(), before = fs.readdirSync(f.dir);
    const result = run(f, target);
    expect(result.status, result.stderr).toBe(0);
    const plan = JSON.parse(result.stdout);
    expect(plan.action).toBe('plan');
    expect(plan.target).toEqual({ project: 'zoe-audit-test', instance: 'zoe-audit-test-default-rtdb', branch: 'QA_001', region: 'asia-southeast1' });
    expect(plan.deploymentPerformed).toBe(false);
    expect(plan.networkPerformed).toBe(false);
    expect(fs.readdirSync(f.dir)).toEqual(before);
});

it.each(['--project', '--instance', '--branch', '--region'])('Firebase audit៖ គ្មាន %s មិនសន្មត target', flag => {
    const f = fixture(), index = target.indexOf(flag), args = target.filter((_value, position) => position !== index && position !== index + 1);
    const result = run(f, [...args, '--stage-dir', f.destination]);
    expect(result.status).toBe(1);
    expect(fs.existsSync(f.destination)).toBe(false);
});

it.each([
    ['--project', 'bad.project'], ['--project', 'Uppercase-project'], ['--project', 'abc'],
    ['--instance', 'https://example.invalid'], ['--instance', '../another'],
    ['--branch', '../branch'], ['--branch', 'branch\nSECRET=1'],
    ['--region', 'https://asia-southeast1'], ['--region', 'asia-southeast1\nOTHER=1']
])('Firebase audit៖ បដិសេធ target មិនត្រឹមត្រូវ %s', (flag, value) => {
    const f = fixture(), args = target.slice(); args[args.indexOf(flag) + 1] = value;
    const result = run(f, [...args, '--stage-dir', f.destination]);
    expect(result.status).toBe(1); expect(fs.existsSync(f.destination)).toBe(false);
});

it.each([['--project', 'another-project'], ['--token', 'synthetic-secret'], ['--deploy'], ['stage']])('Firebase audit៖ flags ស្ទួន/មិនស្គាល់ និង stage គ្មាន destination បរាជ័យ %j', (...extra: string[]) => {
    const f = fixture(), result = run(f, [...target, ...extra]);
    expect(result.status).toBe(1);
    expect(result.stdout + result.stderr).not.toContain('synthetic-secret');
});

it('Firebase audit៖ explicit stage បង្កើត candidate តែមួយ និង nonsecret env0600', () => {
    const f = fixture();
    fs.mkdirSync(path.join(f.runtime, 'node_modules'));
    fs.writeFileSync(path.join(f.runtime, 'node_modules', 'omit.txt'), 'not staged');
    const result = run(f, ['stage', ...target, '--stage-dir', f.destination]);
    expect(result.status, result.stderr).toBe(0);
    const report = JSON.parse(result.stdout);
    expect(report.action).toBe('stage'); expect(report.deploymentPerformed).toBe(false);
    expect(report.networkPerformed).toBe(false);
    const config = JSON.parse(fs.readFileSync(path.join(f.destination, 'firebase.json'), 'utf8'));
    expect(config.functions).toEqual({ source: 'functions', codebase: 'zoe-business-audit', runtime: 'nodejs22' });
    const envPath = path.join(f.destination, 'functions', '.env.zoe-audit-test');
    expect(fs.readFileSync(envPath, 'utf8')).toBe('ZOE_AUDIT_PROJECT_ID=zoe-audit-test\nZOE_AUDIT_DATABASE_INSTANCE=zoe-audit-test-default-rtdb\nZOE_AUDIT_BRANCH_ID=QA_001\nZOE_AUDIT_REGION=asia-southeast1\n');
    for (const name of ['index.cjs', 'business-audit.cjs', 'package.json', 'package-lock.json']) {
        expect(fs.readFileSync(path.join(f.destination, 'functions', name))).toEqual(fs.readFileSync(path.join(f.runtime, name)));
    }
    expect(fs.existsSync(path.join(f.destination, 'functions', 'node_modules'))).toBe(false);
    expect(fs.statSync(envPath).mode & 0o777).toBe(0o600);
    expect(fs.statSync(path.join(f.destination, 'firebase.json')).mode & 0o777).toBe(0o600);
    expect(run(f, [...target, '--stage-dir', f.destination]).status).toBe(1);
    expect(fs.readFileSync(envPath, 'utf8')).toContain('BRANCH_ID=QA_001');
});

it('Firebase audit៖ stage destination symlink និង ancestor symlink មិនសរសេរតាម link', () => {
    const f = fixture(), other = path.join(f.dir, 'other'), link = path.join(f.dir, 'linked');
    fs.mkdirSync(other); fs.symlinkSync(other, link, 'dir');
    expect(run(f, [...target, '--stage-dir', link]).status).toBe(1);
    expect(run(f, [...target, '--stage-dir', path.join(link, 'nested')]).status).toBe(1);
    expect(fs.readdirSync(other)).toEqual([]);
});

it.each(['missing-runtime-file', 'runtime-symlink', 'runtime-secret-env'])('Firebase audit៖ source %s មិនបង្កើត candidate ពាក់កណ្តាល', kind => {
    const f = fixture();
    if (kind === 'missing-runtime-file') fs.unlinkSync(path.join(f.runtime, 'index.cjs'));
    if (kind === 'runtime-symlink') { fs.unlinkSync(path.join(f.runtime, 'index.cjs')); fs.symlinkSync(path.join(f.runtime, 'business-audit.cjs'), path.join(f.runtime, 'index.cjs')); }
    if (kind === 'runtime-secret-env') fs.writeFileSync(path.join(f.runtime, '.env.secret'), 'SECRET=must-not-copy');
    const result = run(f, [...target, '--stage-dir', f.destination]);
    expect(result.status).toBe(1); expect(fs.existsSync(f.destination)).toBe(false);
    expect(result.stdout + result.stderr).not.toContain('must-not-copy');
});

it('Firebase audit៖ normal provisioning មិននាំចូល ឬរត់ staging helper', () => {
    const source = fs.readFileSync(path.join(root, 'tools/firebase-provision/provision.js'), 'utf8');
    expect(source).not.toContain('stage-business-audit');
    expect(source).not.toContain('business-audit-functions');
});
