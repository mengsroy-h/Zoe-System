import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectTests, validateReport, requireSuccessfulRun } from '../zto-ci-evidence.mjs';

const files = ['../audit-tools/zoew/tests/native/zto-cors.test.ts', '../audit-tools/zoew/tests/zto-signed-sync.test.tsx'];
function report() {
    return {
        success: true, numTotalTests: 2, numPassedTests: 2, numFailedTests: 0,
        numPendingTests: 0, numTodoTests: 0,
        testResults: files.map(name => ({ name, status: 'passed', assertionResults: [{ status: 'passed' }] }))
    };
}
test('ជ្រើស ZTO និង native ទាំងអស់ ដកតែសោ', () => {
    assert.deepEqual(selectTests([...files, '../audit-tools/zoew/tests/zto-lock.test.ts', '../audit-tools/zoew/tests/plain.test.ts',
        '../audit-tools/zoew/tests/ledger-native-retry.test.ts', '../audit-tools/zoew/tests/native/platform.test.ts', '../audit-tools/zoew/tests/zto-helper.ts', '../audit-tools/zoew/tests/audit-lookup-retry-session.test.ts', '../audit-tools/zoew/tests/retry-operation-owner.test.ts']),
    ['../audit-tools/zoew/tests/audit-lookup-retry-session.test.ts', '../audit-tools/zoew/tests/ledger-native-retry.test.ts', '../audit-tools/zoew/tests/native/platform.test.ts', files[0], '../audit-tools/zoew/tests/retry-operation-owner.test.ts', files[1]]);
});
test('មិនខកខាន Palm Sign និងអ្នកយាមម្ចាស់សំណើ ទោះឈ្មោះគ្មាន ZTO', () => {
    const ownership = [
        '../audit-tools/zoew/tests/app-lock-ownership-fixes.test.ts',
        '../audit-tools/zoew/tests/connection-request-owner.test.ts',
        '../audit-tools/zoew/tests/palm-sign-outbox-status-requestid.test.ts',
        '../audit-tools/zoew/tests/palm-sign-outbox.test.tsx',
        '../audit-tools/zoew/tests/palm-sign-reservation.test.ts',
        '../audit-tools/zoew/tests/push-identity-ownership-fixes.test.ts',
        '../audit-tools/zoew/tests/scan-evidence-owner-exit-provable.test.ts',
        '../audit-tools/zoew/tests/scan-evidence-owner-exit.test.tsx',
        '../audit-tools/zoew/tests/session-switch-fuzz.test.ts'
    ];
    assert.deepEqual(selectTests([...ownership].reverse().concat('../audit-tools/zoew/tests/palm-sign-helper.ts')), ownership);
});
test('ទទួលតែរបាយការណ៍ពេញ និងបៃតង', () => {
    assert.deepEqual(validateReport(report(), files, process.cwd()), { files: 2, tests: 2, pending: 0, todo: 0 });
});
for (const [label, mutate] of [
    ['failed', r => { r.success = false; }],
    ['pending', r => { r.numPendingTests = 1; }],
    ['todo', r => { r.numTodoTests = 1; }],
    ['empty', r => { r.testResults = []; }],
    ['missing', r => { r.testResults.pop(); }],
    ['duplicate', r => { r.testResults[1].name = r.testResults[0].name; }],
    ['unexpected', r => { r.testResults[1].name = '../audit-tools/zoew/tests/zto-lock.test.ts'; }],
    ['skipped assertion', r => { r.testResults[0].assertionResults[0].status = 'pending'; }],
    ['empty suite', r => { r.testResults[0].assertionResults = []; }],
    ['failed suite', r => { r.testResults[0].status = 'failed'; }],
    ['wrong count', r => { r.numTotalTests = 3; }],
    ['missing count', r => { delete r.numTodoTests; }]
]) test(`បដិសេធ ${label}`, () => {
    const r = report(); mutate(r);
    assert.throws(() => validateReport(r, files, process.cwd()));
});
test('របាយការណ៍បៃតងមិនអាចលាក់ exit ខុស ឬ signal', () => {
    assert.doesNotThrow(() => requireSuccessfulRun({ status: 0, signal: null }));
    for (const result of [{ status: 1 }, { status: null, signal: 'SIGTERM' }, { status: 0, error: new Error('spawn') }]) {
        assert.throws(() => requireSuccessfulRun(result));
    }
});
