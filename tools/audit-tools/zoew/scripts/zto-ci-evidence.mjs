// ភស្តុតាង ZTO/native ដាច់ពីសោ។ Audit ពេញនៅតែវាស់សោដដែល។
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

// អ្នកយាម ownership ដែលឈ្មោះមិនបង្ហាញ ZTO/lookup ប៉ុន្តែវាស់ credential និងសំណើដដែល។
const OWNERSHIP_TESTS = new Set([
    '../tools/audit-tools/zoew/tests/app-lock-ownership-fixes.test.ts',
    '../tools/audit-tools/zoew/tests/connection-request-owner.test.ts',
    '../tools/audit-tools/zoew/tests/push-identity-ownership-fixes.test.ts',
    '../tools/audit-tools/zoew/tests/retry-operation-owner.test.ts',
    '../tools/audit-tools/zoew/tests/session-switch-fuzz.test.ts'
]);

export function selectTests(files) {
    return files.filter(file => /\.test\.tsx?$/.test(file)
        && (/(?:zto|native|lookup|palm-sign|scan-evidence-owner-exit)/.test(file) || OWNERSHIP_TESTS.has(file))
        && file !== '../tools/audit-tools/zoew/tests/zto-lock.test.ts').sort();
}

export function validateReport(report, files, root) {
    assert.equal(report.success, true, 'Vitest success');
    for (const key of ['numFailedTests', 'numPendingTests', 'numTodoTests']) assert.equal(report[key], 0, key);
    assert.ok(files.length > 0, 'បញ្ជីតេស្តទទេ');
    assert.ok(files.includes('../tools/audit-tools/zoew/tests/zto-signed-sync.test.tsx'), 'ខ្វះ zto-signed-sync');
    const suites = report.testResults;
    assert.ok(Array.isArray(suites), 'ខ្វះ testResults');
    const names = suites.map(suite => path.relative(root, path.resolve(root, suite.name)).split(path.sep).join('/')).sort();
    assert.deepEqual(names, [...files].sort(), 'ត្រូវវាស់គ្រប់ឯកសារដែលបានជ្រើស ម្តងមួយ');
    let count = 0;
    for (const suite of suites) {
        assert.equal(suite.status, 'passed', suite.name);
        assert.ok(suite.assertionResults.length > 0, `តេស្តទទេ៖ ${suite.name}`);
        for (const assertion of suite.assertionResults) {
            assert.equal(assertion.status, 'passed', suite.name);
            count++;
        }
    }
    assert.equal(report.numTotalTests, count, 'numTotalTests');
    assert.equal(report.numPassedTests, count, 'numPassedTests');
    return { files: files.length, tests: count, pending: 0, todo: 0 };
}

export function requireSuccessfulRun(result) {
    assert.ifError(result.error);
    assert.equal(result.signal ?? null, null, 'Vitest signal');
    assert.equal(result.status, 0, 'Vitest exit');
}

function walk(root, dir) {
    return readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap(entry => {
        const file = `${dir}/${entry.name}`;
        return entry.isDirectory() ? walk(root, file) : [file];
    });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../ZoeW');
    const output = path.join(root, 'test-results/zto-ci-evidence');
    mkdirSync(output, { recursive: true });
    // លុបភស្តុតាងចាស់មុនរត់ ដើម្បីមិនយករបាយការណ៍ពីការរត់មុន។
    for (const name of ['vitest.json', 'summary.json', 'selection.json']) rmSync(path.join(output, name), { force: true });
    const files = selectTests(walk(root, '../tools/audit-tools/zoew/tests'));
    assert.ok(files.includes('../tools/audit-tools/zoew/tests/zto-signed-sync.test.tsx'), 'ខ្វះ zto-signed-sync');
    const selection = { commit: process.env.ZTO_EVIDENCE_SHA || null, files, excluded: ['../tools/audit-tools/zoew/tests/zto-lock.test.ts'] };
    writeFileSync(path.join(output, 'selection.json'), JSON.stringify(selection, null, 2) + '\n');
    console.log(JSON.stringify(selection, null, 2));
    const result = spawnSync(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', '--config', '../tools/audit-tools/zoew/vitest.config.mts', ...files,
        '--exclude', '../tools/audit-tools/zoew/tests/zto-lock.test.ts', '--maxWorkers', '2', '--reporter=verbose', '--reporter=json',
        `--outputFile.json=${path.join(output, 'vitest.json')}`], { cwd: root, stdio: 'inherit' });
    requireSuccessfulRun(result);
    const summary = validateReport(JSON.parse(readFileSync(path.join(output, 'vitest.json'), 'utf8')), files, root);
    writeFileSync(path.join(output, 'summary.json'), JSON.stringify({ ...selection, ...summary }, null, 2) + '\n');
    console.log('ZTO/native:', JSON.stringify(summary));
}
