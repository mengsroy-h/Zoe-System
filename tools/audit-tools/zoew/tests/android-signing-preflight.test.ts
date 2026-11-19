// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '../../../..');
const require = createRequire(import.meta.url);
const helperPath = path.join(root, 'tools/audit-tools/android-signing-preflight.cjs');
const { signingTarget, verifyProtection, preflight, SECRET_NAMES } = require(helperPath);
const workflow = fs.readFileSync(path.join(root, '.github/workflows/android-release.yml'), 'utf8');
const apk = workflow.match(/^ {2}apk:\n([\s\S]*?)(?=^ {2}[a-z][a-z-]*:|$(?![\s\S]))/m)?.[1] || '';
const environment = apk.match(/^ {4}environment: \$\{\{ (.*?) \}\}$/m)?.[1] || '';

describe('ការចុះហត្ថលេខា APK ចូល environment ដែលមានការការពារ', () => {
    it('GITHUB_TOKEN អាន protection metadata បានទោះ source repo ជា private', () => {
        expect(workflow.match(/^permissions:\n((?: {2}[^\n]+\n)+)/m)?.[1]).toMatch(/^ {2}actions: read$/m);
    });

    it('main ជ្រើស signing environment សម្រាប់ main តែប៉ុណ្ណោះ', () => {
        expect(environment).not.toBe('');
        expect(vm.runInNewContext(environment, { github: { ref: 'refs/heads/main' } })).toBe('android-signing');
    });

    it('branch សាកចូល preview environment ដែលត្រូវការម្ចាស់អនុម័ត', () => {
        expect(environment).not.toBe('');
        expect(vm.runInNewContext(environment, { github: { ref: 'refs/heads/codex/approved-preview' } })).toBe('android-signing-preview');
    });

    it('ផ្ទៀងការការពារ មុន step ដំបូងដែលអាន signing/release secrets', () => {
        const steps = apk.match(/^ {6}-[^\n]*(?:\n(?! {6}-)[^\n]*)*/gm) || [];
        const preflight = steps.findIndex(step => step.includes('node tools/audit-tools/android-signing-preflight.cjs'));
        const firstSecret = steps.findIndex(step => /secrets\.(?:ZOEW_KEYSTORE_|ZOEW_KEY_ALIAS|ZOEW_KEY_PASSWORD|ZOE_RELEASES_TOKEN)/.test(step));
        expect(preflight).toBeGreaterThanOrEqual(0);
        expect(firstSecret).toBeGreaterThan(preflight);
        expect(steps[preflight]).toContain('GH_TOKEN: ${{ github.token }}');
        expect(steps[preflight]).not.toMatch(/continue-on-error|secrets\./);
        expect(apk.slice(0, apk.indexOf('    steps:'))).not.toMatch(/secrets\./);
    });
});

function protectedEnvironment(preview = false) {
    return {
        id: 123,
        name: preview ? 'android-signing-preview' : 'android-signing',
        can_admins_bypass: false,
        deployment_branch_policy: { protected_branches: false, custom_branch_policies: true },
        protection_rules: preview ? [{ type: 'required_reviewers', prevent_self_review: false,
            reviewers: [{ type: 'User', reviewer: { id: 313065015, login: 'mengsroy-h' } }] }] : []
    };
}

function branchPolicies(branch = 'main') {
    return { total_count: 1, branch_policies: [{ name: branch, type: 'branch' }] };
}

describe('ការការពារពី GitHub ត្រូវផ្ទៀងពិត មុនយក keystore', () => {
    const main = { branch: 'main', environment: 'android-signing' };
    const preview = { branch: 'codex/approved-preview', environment: 'android-signing-preview' };

    it('main ដែលមាន policy ចាក់សោ main តែមួយ មិនត្រូវការអនុម័តបន្ថែម', () => {
        expect(verifyProtection(main, protectedEnvironment(), branchPolicies())).toEqual(main);
    });

    it('branch សាកដែលបានកំណត់ជាក់លាក់ និងមានម្ចាស់ជាអ្នកអនុម័ត ទទួលបាន', () => {
        expect(verifyProtection(preview, protectedEnvironment(true), branchPolicies(preview.branch))).toEqual(preview);
    });

    it.each([
        ['environment ដែល GitHub បង្កើតទទេ', { ...protectedEnvironment(), protection_rules: [], deployment_branch_policy: null }, branchPolicies()],
        ['environment ខុសឈ្មោះ', { ...protectedEnvironment(), name: 'unprotected' }, branchPolicies()],
        ['environment ID មិនត្រឹមត្រូវ', { ...protectedEnvironment(), id: 0 }, branchPolicies()],
        ['admin អាចរំលង', { ...protectedEnvironment(), can_admins_bypass: true }, branchPolicies()],
        ['គ្មានភស្តុតាង bypass', { ...protectedEnvironment(), can_admins_bypass: undefined }, branchPolicies()],
        ['គ្រប់ protected branch ប្រើសោ main បាន', { ...protectedEnvironment(), deployment_branch_policy: { protected_branches: true, custom_branch_policies: false } }, branchPolicies()],
        ['មិនទាន់អាន policies គ្រប់', protectedEnvironment(), { ...branchPolicies(), total_count: 2 }],
        ['គ្មាន branch policy', protectedEnvironment(), { total_count: 0, branch_policies: [] }],
        ['wildcard អនុញ្ញាត branch ផ្សេង', protectedEnvironment(), branchPolicies('*')],
        ['tag policy មិនមែន branch', protectedEnvironment(), { total_count: 1, branch_policies: [{ name: 'main', type: 'tag' }] }],
        ['main environment មាន branch បន្ថែម', protectedEnvironment(), { total_count: 2, branch_policies: [{ name: 'main', type: 'branch' }, { name: 'feature', type: 'branch' }] }]
    ])('បដិសេធ %s', (_label, environmentState, policies) => {
        expect(() => verifyProtection(main, environmentState, policies)).toThrow();
    });

    it.each([
        ['មិនមាន reviewer', { ...protectedEnvironment(true), protection_rules: [] }, branchPolicies(preview.branch)],
        ['reviewer មិនមែនម្ចាស់', { ...protectedEnvironment(true), protection_rules: [{ type: 'required_reviewers', reviewers: [{ type: 'User', reviewer: { id: 999, login: 'other' } }] }] }, branchPolicies(preview.branch)],
        ['reviewer ប្រើ ID ម្ចាស់ តែឈ្មោះផ្សេង', { ...protectedEnvironment(true), protection_rules: [{ type: 'required_reviewers', reviewers: [{ type: 'User', reviewer: { id: 313065015, login: 'other' } }] }] }, branchPolicies(preview.branch)],
        ['reviewer ជា Team', { ...protectedEnvironment(true), protection_rules: [{ type: 'required_reviewers', reviewers: [{ type: 'Team', reviewer: { id: 313065015, login: 'mengsroy-h' } }] }] }, branchPolicies(preview.branch)],
        ['មាន reviewer បន្ថែមដែលអាចអនុម័តជំនួសម្ចាស់', { ...protectedEnvironment(true), protection_rules: [{ type: 'required_reviewers', reviewers: [{ type: 'User', reviewer: { id: 313065015, login: 'mengsroy-h' } }, { type: 'User', reviewer: { id: 999, login: 'other' } }] }] }, branchPolicies(preview.branch)],
        ['branch មិនទាន់បានអនុញ្ញាត', protectedEnvironment(true), branchPolicies('codex/another-preview')],
        ['preview environment អនុញ្ញាត main', protectedEnvironment(true), { total_count: 2, branch_policies: [...branchPolicies(preview.branch).branch_policies, { name: 'main', type: 'branch' }] }]
    ])('branch សាកបដិសេធ %s', (_label, environmentState, policies) => {
        expect(() => verifyProtection(preview, environmentState, policies)).toThrow();
    });

    it('configuration artifact រក្សា main ស្វ័យប្រវត្តិ និង preview បិទរហូតជ្រើស branch', () => {
        const plan = JSON.parse(fs.readFileSync(path.join(root, 'tools/audit-tools/android-signing-environments.json'), 'utf8'));
        expect(plan.repository).toBe('mengsroy-h/Zoe-System');
        expect(plan.secretNames).toEqual(SECRET_NAMES);
        expect(plan.removeRepositorySecretsOnlyAfterEnvironmentReadback).toBe(true);
        expect(plan.environments[0].secretNames).toEqual(SECRET_NAMES);
        expect(plan.environments[1].secretNames).toEqual(SECRET_NAMES.filter((name: string) => name !== 'ZOE_RELEASES_TOKEN'));
        for (const [index, target] of [main, preview].entries()) {
            const item = plan.environments[index];
            const remote = { id: 123, name: item.name, ...item.configuration,
                protection_rules: item.configuration.reviewers.length ? [{ type: 'required_reviewers', reviewers: item.configuration.reviewers.map((reviewer: { type: string; id: number }) => ({ type: reviewer.type, reviewer: { id: reviewer.id, login: 'mengsroy-h' } })) }] : [] };
            const policies = { total_count: item.deployment_branch_policies.length, branch_policies: item.deployment_branch_policies };
            if (index === 0) expect(verifyProtection(target, remote, policies)).toEqual(main);
            else {
                expect(() => verifyProtection(target, remote, policies)).toThrow('branch-policy-incomplete');
                expect(verifyProtection(target, remote, branchPolicies(preview.branch))).toEqual(preview);
            }
        }
    });
});

describe('preflight អានតែ metadata ហើយបដិសេធបញ្ហាបណ្ដាញ', () => {
    const env = { GITHUB_REPOSITORY: 'mengsroy-h/Zoe-System', GITHUB_REF: 'refs/heads/main', GITHUB_EVENT_NAME: 'push', GH_TOKEN: 'SYNTHETIC_TOKEN_NEVER_LOG' };

    it('អាន GitHub environment និង policies ដោយមិនធ្វើ mutation ឬ redirect', async () => {
        const calls: Array<{ url: string; options: RequestInit }> = [];
        const fetcher = async (url: string, options: RequestInit) => {
            calls.push({ url, options });
            return new Response(JSON.stringify(calls.length === 1 ? protectedEnvironment() : branchPolicies()));
        };
        await expect(preflight(env, fetcher)).resolves.toEqual({ branch: 'main', environment: 'android-signing' });
        expect(calls.map(call => call.url)).toEqual([
            'https://api.github.com/repos/mengsroy-h/Zoe-System/environments/android-signing',
            'https://api.github.com/repos/mengsroy-h/Zoe-System/environments/android-signing/deployment-branch-policies?per_page=100'
        ]);
        for (const { options } of calls) {
            expect(options.method).toBeUndefined();
            expect(options.body).toBeUndefined();
            expect(options.redirect).toBe('error');
            expect(options.signal).toBeInstanceOf(AbortSignal);
        }
    });

    it.each([
        ['fork', { GITHUB_REPOSITORY: 'other/Zoe-System' }],
        ['tag', { GITHUB_REF: 'refs/tags/v1' }],
        ['PR', { GITHUB_EVENT_NAME: 'pull_request' }],
        ['branch push', { GITHUB_REF: 'refs/heads/feature' }],
        ['token បាត់', { GH_TOKEN: '' }],
        ['origin ខុស', { GITHUB_API_URL: 'https://untrusted.example' }]
    ])('បដិសេធ %s មុន network', async (_label, change) => {
        let calls = 0;
        await expect(preflight({ ...env, ...change }, async () => { calls++; })).rejects.toThrow();
        expect(calls).toBe(0);
    });

    it.each([
        ['HTTP 404', async () => new Response('{}', { status: 404 }), 'github-read-refused'],
        ['network', async () => { throw new Error('Bearer SYNTHETIC_TOKEN_NEVER_LOG'); }, 'github-read-failed'],
        ['JSON ខូច', async () => new Response('{'), 'github-response-invalid'],
        ['response ធំជាងពិដាន', async () => new Response(' '.repeat(262145)), 'github-response-invalid']
    ])('បដិសេធ %s ដោយមិនបង្ហាញសោ', async (_label, fetcher, expected) => {
        await expect(preflight(env, fetcher)).rejects.toThrow(expected);
        try { await preflight(env, fetcher); } catch (error) {
            expect(String(error)).not.toContain(env.GH_TOKEN);
        }
    });

    it('workflow_dispatch អនុញ្ញាត branch តែការផ្ទៀង policy នៅត្រូវធ្វើ', () => {
        expect(signingTarget(env.GITHUB_REPOSITORY, 'refs/heads/codex/approved-preview', 'workflow_dispatch')).toEqual({ branch: 'codex/approved-preview', environment: 'android-signing-preview' });
    });

    it('CLI កំណត់ exit code បរាជ័យ ពេលមិនអាចផ្ទៀង និងមិនបង្ហាញ token', async () => {
        const module = { exports: {} };
        const process = { env: { ...env, GITHUB_REPOSITORY: 'other/Zoe-System' }, exitCode: 0 };
        const stdout: string[] = [], stderr: string[] = [];
        vm.runInNewContext(fs.readFileSync(helperPath, 'utf8'), { module, require: { main: module }, process,
            console: { log: (message: string) => stdout.push(message), error: (message: string) => stderr.push(message) }, Buffer, AbortSignal });
        await new Promise(resolve => setImmediate(resolve));
        expect(process.exitCode).toBe(1);
        expect(stderr.join('\n')).toContain('repository-untrusted');
        expect(stdout.join('\n') + stderr.join('\n')).not.toContain(env.GH_TOKEN);
    });
});


function workflowSteps() {
    return apk.match(/^ {6}-[^\n]*(?:\n(?! {6}-)[^\n]*)*/gm) || [];
}

function stepScript(step: string) {
    return (step.match(/^ {8}run: \|\n([\s\S]*)$/m)?.[1] || '')
        .split('\n').map(line => line.replace(/^ {10}/, '')).join('\n');
}

function releaseFixture(test = false) {
    const suffix = test ? '-test.abcdef1' : '';
    const file = `ZoeW-9.8.7${suffix}.apk`;
    return { tagName: `zoew-android-v9.8.7${suffix}`, isDraft: false, isPrerelease: test,
        assets: [file, `${file}.sha256`].map(name => ({ name, state: 'uploaded', size: 123 })) };
}

function releaseInspection(source: unknown, mirror: unknown, test = false) {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'zoe-release-inspect-'));
    try {
        const bin = path.join(temp, 'bin');
        fs.mkdirSync(bin);
        fs.mkdirSync(path.join(temp, 'ZoeW/src/core'), { recursive: true });
        fs.writeFileSync(path.join(temp, 'ZoeW/src/core/version.ts'), "export const APP_VERSION = '9.8.7';\n");
        fs.writeFileSync(path.join(bin, 'cygpath'), '#!/bin/sh\nshift\nprintf "%s\\n" "$1"\n', { mode: 0o755 });
        fs.writeFileSync(path.join(bin, 'gh'), `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
fs.appendFileSync(process.env.GH_CALLS, JSON.stringify(args) + '\\n');
if (args[0] !== 'release' || args[1] !== 'view') process.exit(87);
const raw = args.includes(process.env.ZOE_RELEASES_REPO) ? process.env.GH_MIRROR : process.env.GH_SOURCE;
if (raw === 'null') process.exit(1);
if (args.includes('--json')) process.stdout.write(raw);
`, { mode: 0o755 });
        const output = path.join(temp, 'output');
        fs.writeFileSync(output, '');
        const env: NodeJS.ProcessEnv = { ...process.env, PATH: bin + path.delimiter + process.env.PATH,
            GITHUB_OUTPUT: output, GITHUB_REF: test ? 'refs/heads/feature' : 'refs/heads/main',
            GITHUB_SHA: 'abcdef1234567890', GITHUB_REPOSITORY: 'mengsroy-h/Zoe-System',
            GH_TOKEN: 'SYNTHETIC_SOURCE_TOKEN', RELEASES_TOKEN: 'SYNTHETIC_RELEASE_TOKEN',
            ZOE_RELEASES_REPO: 'mengsroy-h/Zoe-System-releases', GH_CALLS: path.join(temp, 'calls'),
            GH_SOURCE: JSON.stringify(source), GH_MIRROR: JSON.stringify(mirror) };
        const outputs: Record<string, string> = {};
        const expressions: Record<string, string> = { 'github.token': env.GH_TOKEN!,
            'github.repository': env.GITHUB_REPOSITORY!, 'secrets.ZOE_RELEASES_TOKEN': env.RELEASES_TOKEN! };
        let status: number | null = 0, text = '';
        const fill = (value: string) => value.replace(/\$\{\{\s*([^}]+?)\s*\}\}/g, (_, key) => expressions[key] ?? '');
        for (const name of ['កំណែ និងស្លាក Release', 'ពិនិត្យ token របស់ repo Release', 'ផ្ទៀង Release ដែលមានរួច']) {
            if (test && name === 'ពិនិត្យ token របស់ repo Release') continue;
            const step = workflowSteps().find(item => item.includes('- name: ' + name));
            if (!step) continue;
            const stepEnv = { ...env };
            const envBlock = step.match(/^ {8}env:\n((?: {10}[^\n]+\n)+)/m)?.[1] || '';
            for (const entry of envBlock.matchAll(/^ {10}(\w+): (.+)$/gm)) stepEnv[entry[1]] = fill(entry[2]);
            const result = spawnSync('bash', ['-eo', 'pipefail', '-c', fill(stepScript(step))], {
                cwd: temp, env: stepEnv, encoding: 'utf8', timeout: 10000
            });
            status = result.status;
            text += result.stdout + result.stderr;
            for (const line of fs.readFileSync(output, 'utf8').split('\n').filter(Boolean)) {
                const at = line.indexOf('=');
                outputs[line.slice(0, at)] = line.slice(at + 1);
            }
            for (const [key, value] of Object.entries(outputs)) {
                expressions[`steps.${key === 'mirrored' ? 'releases' : 'meta'}.outputs.${key}`] = value;
            }
            if (status !== 0) break;
        }
        return { status, text, outputs, calls: fs.existsSync(env.GH_CALLS!) ? fs.readFileSync(env.GH_CALLS!, 'utf8') : '' };
    } finally { fs.rmSync(temp, { recursive: true, force: true }); }
}

describe('Release ដែលមានរួចត្រូវមាន APK និង checksum ពេញលេញ', () => {
    it('main ដែល source និង public ពេញលេញ អាចរំលង build', () => {
        const out = releaseInspection(releaseFixture(), releaseFixture());
        expect(out.status, out.text).toBe(0);
        expect(out.outputs.exists).toBe('true');
        expect(out.outputs.mirrored).toBe('true');
    });

    it('source ពេញលេញ តែ public មិនទាន់មាន នៅតែអាចចម្លង', () => {
        const out = releaseInspection(releaseFixture(), null);
        expect(out.status, out.text).toBe(0);
        expect(out.outputs.mirrored).toBe('false');
    });

    it('មិនទាន់មាន Release នៅតែអាច build ហើយ APK សាកពេញលេញមិនចូល public', () => {
        expect(releaseInspection(null, null).status).toBe(0);
        const out = releaseInspection(releaseFixture(true), null, true);
        expect(out.status, out.text).toBe(0);
        expect(out.calls).not.toContain('Zoe-System-releases');
    });

    const complete = releaseFixture();
    const broken = [
        ['draft', { ...complete, isDraft: true }],
        ['prerelease ខុស', { ...complete, isPrerelease: true }],
        ['tag ខុស', { ...complete, tagName: 'different' }],
        ['គ្មាន APK', { ...complete, assets: complete.assets.slice(1) }],
        ['គ្មាន checksum', { ...complete, assets: complete.assets.slice(0, 1) }],
        ['checksum ខុសឈ្មោះ', { ...complete, assets: [complete.assets[0], { ...complete.assets[1], name: 'other.sha256' }] }],
        ['asset មិនទាន់ upload ចប់', { ...complete, assets: complete.assets.map(item => ({ ...item, state: 'starter' })) }],
        ['asset ទទេ', { ...complete, assets: complete.assets.map(item => ({ ...item, size: 0 })) }],
        ['asset ស្ទួន', { ...complete, assets: [...complete.assets, complete.assets[0]] }],
        ['metadata ខ្វះ', {}]
    ];
    for (const [label, value] of broken) {
        it(`source ${label} ត្រូវធ្លាក់ មិនអះអាងថាបានបញ្ចប់`, () => {
            const out = releaseInspection(value, null);
            expect(out.status, out.text).toBe(1);
            expect(out.text).toContain('::error::');
            expect(out.calls).not.toContain('"create"');
        });
        it(`public ${label} ត្រូវធ្លាក់ មិនអះអាងថាចម្លងរួច`, () => {
            const out = releaseInspection(complete, value);
            expect(out.status, out.text).toBe(1);
            expect(out.text).toContain('::error::');
            expect(out.calls).not.toContain('"create"');
        });
    }

    it('ការផ្ទៀងនៅមុន mirror/build ហើយមិនបន្ថែម full audit gate', () => {
        const steps = workflowSteps();
        const inspect = steps.findIndex(step => step.includes('- name: ផ្ទៀង Release ដែលមានរួច'));
        expect(inspect).toBeGreaterThan(0);
        expect(inspect).toBeLessThan(steps.findIndex(step => step.includes('- name: ចម្លង Release ដែលមានរួចទៅ repo Release')));
        expect(inspect).toBeLessThan(steps.findIndex(step => step.includes('- name: ពិនិត្យ secret របស់ keystore')));
        expect(steps[inspect]).not.toMatch(/continue-on-error|^ {8}if:/m);
        expect(apk.match(/^ {4}needs: (.+)$/m)?.[1]).toBe('ci-config');
        expect(workflow).not.toMatch(/workflow_run|gh run watch/);
    });
});

describe('mirror ទាញនិងចម្លងតែឯកសារគូដែលត្រូវការ', () => {
    it.each(['complete', 'missing-apk', 'missing-checksum', 'empty-apk'])('%s មិនចេញ Release ខ្វះឯកសារ', (mode) => {
        const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'zoe-release-mirror-'));
        try {
            const bin = path.join(temp, 'bin');
            fs.mkdirSync(bin);
            fs.writeFileSync(path.join(bin, 'gh'), `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
fs.appendFileSync(process.env.GH_CALLS, JSON.stringify(args) + '\\n');
if (args[0] !== 'release') process.exit(87);
if (args[1] === 'download') {
  const file = 'ZoeW-9.8.7.apk';
  if (process.env.FIXTURE_MODE !== 'missing-apk') fs.writeFileSync('mirror/' + file, process.env.FIXTURE_MODE === 'empty-apk' ? '' : 'fixture-apk');
  if (process.env.FIXTURE_MODE !== 'missing-checksum') fs.writeFileSync('mirror/' + file + '.sha256', 'fixture-checksum');
  fs.writeFileSync('mirror/unrelated.apk', 'unrelated');
} else if (args[1] === 'view') process.stdout.write('fixture-notes');
else if (args[1] !== 'create') process.exit(87);
`, { mode: 0o755 });
            const step = workflowSteps().find(item => item.includes('- name: ចម្លង Release ដែលមានរួចទៅ repo Release')) || '';
            const values: Record<string, string> = { tag: 'zoew-android-v9.8.7', file: 'ZoeW-9.8.7.apk', version: '9.8.7' };
            const script = stepScript(step).replace(/\$\{\{\s*steps\.meta\.outputs\.(\w+)\s*\}\}/g, (_, key) => values[key]);
            const callsFile = path.join(temp, 'calls');
            const out = spawnSync('bash', ['-eo', 'pipefail', '-c', script], { cwd: temp, encoding: 'utf8', timeout: 10000,
                env: { ...process.env, PATH: bin + path.delimiter + process.env.PATH, FIXTURE_MODE: mode,
                    GH_CALLS: callsFile, GH_TOKEN: 'fixture-source', RELEASES_TOKEN: 'fixture-public', ZOE_RELEASES_REPO: 'owner/releases' } });
            const calls: string[][] = fs.readFileSync(callsFile, 'utf8').trim().split('\n').map(line => JSON.parse(line));
            const downloads = calls.filter(args => args[1] === 'download');
            expect(downloads).toEqual([['release', 'download', values.tag, '--dir', 'mirror', '--pattern', values.file, '--pattern', values.file + '.sha256']]);
            const creates = calls.filter(args => args[1] === 'create');
            if (mode === 'complete') {
                expect(out.status, out.stdout + out.stderr).toBe(0);
                expect(creates).toHaveLength(1);
                expect(creates[0].slice(0, 5)).toEqual(['release', 'create', values.tag, 'mirror/' + values.file, 'mirror/' + values.file + '.sha256']);
                expect(creates[0]).not.toContain('mirror/unrelated.apk');
            } else {
                expect(out.status).toBe(1);
                expect(creates).toHaveLength(0);
                expect(out.stdout).toContain('::error::');
            }
        } finally { fs.rmSync(temp, { recursive: true, force: true }); }
    });
});

function runFcm(value: string) {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'zoe-fcm-json-'));
    try {
        fs.mkdirSync(path.join(temp, 'ZoeW/android/app'), { recursive: true });
        const step = workflowSteps().find(item => item.includes('- name: google-services.json')) || '';
        expect(stepScript(step)).not.toBe('');
        const out = spawnSync('bash', ['-eo', 'pipefail', '-c', stepScript(step)], {
            cwd: temp, env: { ...process.env, GSJ: value }, encoding: 'utf8', timeout: 10000
        });
        const target = path.join(temp, 'ZoeW/android/app/google-services.json');
        return { status: out.status, text: out.stdout + out.stderr,
            file: fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : null };
    } finally { fs.rmSync(temp, { recursive: true, force: true }); }
}

describe('FCM config អាន JSON និង base64 ដោយមិនបង្ហាញ secret', () => {
    const config = { client: [{ client_info: { android_client_info: { package_name: 'com.zoesystem.zoew' } } }],
        fixture: 'SYNTHETIC_FCM_SECRET_NEVER_LOG' };
    const json = JSON.stringify(config);
    it.each([['raw', json], ['whitespace', ' \t\r\n' + json + '\n'], ['base64', Buffer.from(json).toString('base64')]])('អាន %s បាន', (_label, input) => {
        const out = runFcm(input);
        expect(out.status, out.text).toBe(0);
        expect(JSON.parse(out.file!)).toEqual(config);
        expect(out.text).not.toContain(config.fixture);
    });
    it('secret អវត្តមាននៅតែស្រេចចិត្ត', () => {
        const out = runFcm('');
        expect(out.status).toBe(0);
        expect(out.file).toBeNull();
        expect(out.text).toContain('::warning::');
    });
    it.each([
        ['JSON ខូច', '{"fixture":"SYNTHETIC_FCM_SECRET_NEVER_LOG"'],
        ['base64 JSON ខូច', Buffer.from('{"fixture":"SYNTHETIC_FCM_SECRET_NEVER_LOG"').toString('base64')],
        ['base64 ខូច', '!' + Buffer.from(json).toString('base64')],
        ['package ខុស', json.replace('com.zoesystem.zoew', 'com.other.app')],
        ['shape ខុស', '{"client":{},"fixture":"SYNTHETIC_FCM_SECRET_NEVER_LOG"}'],
        ['null', 'null']
    ])('បដិសេធ %s ដោយមិនបង្ហាញខ្លឹមសារ', (_label, input) => {
        const out = runFcm(input);
        expect(out.status).toBe(1);
        expect(out.text).not.toContain(config.fixture);
        expect(out.file).toBeNull();
    });
});

describe('android:check ផ្ទៀង FCM package តាម workflow ពិត', () => {
    const checker = fs.readFileSync(path.join(root, 'tools/audit-tools/zoew/scripts/android-check.mjs'), 'utf8');
    const guard = checker.slice(checker.indexOf('const gsjAt = '), checker.indexOf("ok('FCM ៖ vite"));
    function verdict(releaseWf: string) {
        const results: boolean[] = [];
        expect(guard).toContain('webBuildAt > gsjAt');
        vm.runInNewContext(guard, { releaseWf, ok: (_label: string, valid: boolean) => results.push(valid) });
        expect(results).toHaveLength(1);
        return results[0];
    }
    it('ទទួល optional chaining និង strict package ដែល workflow ប្រើ', () => {
        expect(verdict(workflow)).toBe(true);
        expect(verdict(workflow.replace("package_name === 'com.zoesystem.zoew'", "package_name  ===  'com.zoesystem.zoew'"))).toBe(true);
    });
    it.each([
        ['package ខុស', "package_name === 'com.zoesystem.zoew'", "package_name === 'com.other.app'"],
        ['path ខុស', 'client?.client_info?.android_client_info?.package_name', 'client?.package_name'],
        ['loose comparison', 'package_name ===', 'package_name =='],
        ['បញ្ច្រាស comparison', 'package_name ===', 'package_name !=='],
        ['គ្មាន config file', 'ZoeW/android/app/google-services.json', 'ZoeW/android/app/other.json']
    ])('បដិសេធ %s', (_label, before, after) => {
        expect(workflow).toContain(before);
        expect(verdict(workflow.replace(before, after))).toBe(false);
    });
});
