// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '../../../..');
const require = createRequire(import.meta.url);
const candidate = require('../../../firebase-provision/business-audit-functions/business-audit.cjs');
const workflow = fs.readFileSync(path.join(root, '.github/workflows/audit.yml'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'tools/firebase-provision/business-audit-functions/package.json'), 'utf8'));
const lock = JSON.parse(fs.readFileSync(path.join(root, 'tools/firebase-provision/business-audit-functions/package-lock.json'), 'utf8'));
const expectedRoots = ['zoew_scan_history_cod_dod', 'zoew_recently_deleted_cod_dod', 'zoew_daily_revenue_cod_dod', 'zoew_monthly_revenue_cod_dod',
    'zoew_daily_pickup_cod_dod', 'zoew_daily_collected_cod_dod', 'zoew_scan_operations', 'zoew_trash_consumptions', 'zoew_registry_releases', 'zoew_restore_finalizations'];

const guardSource = fs.readFileSync(path.join(root, 'tools/audit-tools/checker-coverage.js'), 'utf8');
const parse = createRequire(path.join(root, 'ZoeW/package.json'))('acorn').parse;
const names = ['ciCheckerNames', 'firebaseAuditCandidateContract', 'ciUnscheduledCheckers'];
const declarations = parse(guardSource, { ecmaVersion: 'latest' }).body.filter((node: any) => node.type === 'FunctionDeclaration' && names.includes(node.id?.name));
expect(declarations.map((node: any) => node.id.name).sort()).toEqual(names.slice().sort());
const guards = vm.runInNewContext(declarations.map((node: any) => guardSource.slice(node.start, node.end)).join('\n') + '\n({ ' + names.join(',') + ' })', { Set, JSON });
const candidateJob = (text: string) => guards.firebaseAuditCandidateContract(text, pkg, lock);

it('supplemental candidate CI actually installs pinned SDKs, audits dependencies and runs nonempty real runtime checks on Node22', () => {
    expect(candidateJob(workflow)).toBe(true);
    expect(candidate.BUSINESS_ROOTS.slice().sort()).toEqual(expectedRoots.slice().sort());
    expect(candidate.BUSINESS_ROOTS).toHaveLength(10);
});

it.each([
    ['missing candidate job', (text: string) => text.replace('firebase-audit-candidate:', 'other-job:')],
    ['wrong Node runtime', (text: string) => text.replace("node-version: '22'", "node-version: '24'")],
    ['missing dependency install', (text: string) => text.replace('npm ci --prefix tools/firebase-provision/business-audit-functions --ignore-scripts --no-fund', 'echo install')],
    ['missing dependency audit', (text: string) => text.replace('npm audit --prefix tools/firebase-provision/business-audit-functions --omit=dev --audit-level=high', 'echo audit')],
    ['missing SDK runtime check', (text: string) => text.replace('node tools/audit-tools/firebase-business-audit-runtime-test.cjs', 'echo fake-green')],
    ['swallowed runtime failure', (text: string) => text.replace('node tools/audit-tools/firebase-business-audit-runtime-test.cjs', 'node tools/audit-tools/firebase-business-audit-runtime-test.cjs || true')],
    ['continued failure', (text: string) => text.replace('name: Firebase audit candidate SDK', 'name: Firebase audit candidate SDK\n    continue-on-error: true')],
    ['unexpected deploy', (text: string) => text.replace('name: Verify real Gen1 definitions and failure controls', 'run: firebase deploy\n      - name: Verify real Gen1 definitions and failure controls')]
])('candidate CI contract catches %s', (_name, mutate: (text: string) => string) => {
    expect(candidateJob(mutate(workflow))).toBe(false);
});

it('default Spark provisioning and app dependency preparation never install or deploy candidate Functions', () => {
    for (const file of ['tools/firebase-provision/provision.js', 'tools/audit-tools/zoew/prepare-dependencies.mjs']) {
        const source = fs.readFileSync(path.join(root, file), 'utf8');
        expect(source).not.toContain('business-audit-functions'); expect(source).not.toContain('stage-business-audit');
    }
});

it('actual checker consumer discovers unknown CI-only CJS and never grants a generic extension exemption', () => {
    const scripts = new Set<string>(guards.ciCheckerNames(workflow)); scripts.delete('firebase-business-audit-runtime-test.cjs');
    expect(guards.ciUnscheduledCheckers(workflow, scripts, pkg, lock)).toEqual([]);
    const unexpected = workflow + '\n  unexpected-cjs:\n    steps:\n      - run: node tools/audit-tools/unknown-candidate.cjs\n';
    expect(guards.ciCheckerNames(unexpected).has('unknown-candidate.cjs')).toBe(true);
    expect(guards.ciUnscheduledCheckers(unexpected, scripts, pkg, lock)).toContain('unknown-candidate.cjs');
    expect(guards.ciUnscheduledCheckers(unexpected, scripts, pkg, lock)).not.toContain('firebase-business-audit-runtime-test.cjs');
});

it('registered foo.js never authorizes a different foo.cjs CI command', () => {
    const scripts = new Set<string>(guards.ciCheckerNames(workflow)); scripts.delete('firebase-business-audit-runtime-test.cjs'); scripts.add('known-tool.js');
    const changed = workflow + '\n  extension-confusion:\n    steps:\n      - run: node tools/audit-tools/known-tool.cjs\n';
    expect(guards.ciUnscheduledCheckers(changed, scripts, pkg, lock)).toContain('known-tool.cjs');
});

it.each(["'node tools/audit-tools/unknown-candidate.cjs'", 'node ./tools/audit-tools/unknown-candidate.cjs'])('actual checker sees alternate unknown CJS invocation %s', command => {
    const scripts = new Set<string>(guards.ciCheckerNames(workflow)); scripts.delete('firebase-business-audit-runtime-test.cjs');
    const changed = workflow + '\n  unknown-command:\n    steps:\n      - run: ' + command + '\n';
    expect(guards.ciCheckerNames(changed).has('unknown-candidate.cjs')).toBe(true);
    expect(guards.ciUnscheduledCheckers(changed, scripts, pkg, lock)).toContain('unknown-candidate.cjs');
});

it.each(['version', 'integrity', 'engine'])('candidate exception requires real pinned lock metadata: %s', fault => {
    const altered = structuredClone(lock);
    if (fault === 'version') altered.packages['node_modules/firebase-functions'].version = '0.0.0';
    if (fault === 'integrity') altered.packages['node_modules/firebase-admin'].integrity = '';
    if (fault === 'engine') altered.packages[''].engines.node = '24';
    expect(guards.firebaseAuditCandidateContract(workflow, pkg, altered)).toBe(false);
});
