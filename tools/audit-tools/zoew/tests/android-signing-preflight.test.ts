// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
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
