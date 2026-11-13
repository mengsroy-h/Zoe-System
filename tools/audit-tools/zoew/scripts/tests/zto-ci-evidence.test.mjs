import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { selectTests, validateReport, requireSuccessfulRun, evidenceSourceRoot } from '../zto-ci-evidence.mjs';

const files = ['../tools/audit-tools/zoew/tests/native/zto-cors.test.ts', '../tools/audit-tools/zoew/tests/zto-signed-sync.test.tsx'];
function report() {
    return {
        success: true, numTotalTests: 2, numPassedTests: 2, numFailedTests: 0,
        numPendingTests: 0, numTodoTests: 0,
        testResults: files.map(name => ({ name, status: 'passed', assertionResults: [{ status: 'passed' }] }))
    };
}
test('ជ្រើស ZTO និង native ទាំងអស់ ដកតែសោ', () => {
    assert.deepEqual(selectTests([...files, '../tools/audit-tools/zoew/tests/zto-lock.test.ts', '../tools/audit-tools/zoew/tests/plain.test.ts',
        '../tools/audit-tools/zoew/tests/ledger-native-retry.test.ts', '../tools/audit-tools/zoew/tests/native/platform.test.ts', '../tools/audit-tools/zoew/tests/zto-helper.ts', '../tools/audit-tools/zoew/tests/audit-lookup-retry-session.test.ts', '../tools/audit-tools/zoew/tests/retry-operation-owner.test.ts']),
    ['../tools/audit-tools/zoew/tests/audit-lookup-retry-session.test.ts', '../tools/audit-tools/zoew/tests/ledger-native-retry.test.ts', '../tools/audit-tools/zoew/tests/native/platform.test.ts', files[0], '../tools/audit-tools/zoew/tests/retry-operation-owner.test.ts', files[1]]);
});
test('មិនខកខាន Palm Sign និងអ្នកយាមម្ចាស់សំណើ ទោះឈ្មោះគ្មាន ZTO', () => {
    const ownership = [
        '../tools/audit-tools/zoew/tests/app-lock-ownership-fixes.test.ts',
        '../tools/audit-tools/zoew/tests/connection-request-owner.test.ts',
        '../tools/audit-tools/zoew/tests/palm-sign-outbox-status-requestid.test.ts',
        '../tools/audit-tools/zoew/tests/palm-sign-outbox.test.tsx',
        '../tools/audit-tools/zoew/tests/palm-sign-reservation.test.ts',
        '../tools/audit-tools/zoew/tests/push-identity-ownership-fixes.test.ts',
        '../tools/audit-tools/zoew/tests/scan-evidence-owner-exit-provable.test.ts',
        '../tools/audit-tools/zoew/tests/scan-evidence-owner-exit.test.tsx',
        '../tools/audit-tools/zoew/tests/session-switch-fuzz.test.ts'
    ];
    assert.deepEqual(selectTests([...ownership].reverse().concat('../tools/audit-tools/zoew/tests/palm-sign-helper.ts')), ownership);
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
    ['unexpected', r => { r.testResults[1].name = '../tools/audit-tools/zoew/tests/zto-lock.test.ts'; }],
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


test('root វាស់ត្រូវប្រើប្រភព repo ពិត មិនយក tree វាស់ជាប្រភព Vitest', () => {
    const script = pathToFileURL(path.resolve('synthetic/measure-root/tools/audit-tools/zoew/scripts/zto-ci-evidence.mjs'));
    assert.equal(evidenceSourceRoot('synthetic/source', script), path.resolve('synthetic/source/ZoeW'));
    assert.equal(evidenceSourceRoot('', script), path.resolve('synthetic/measure-root/ZoeW'));
});


test('CLI ពិតរក្សា exit 1 រហូតដល់ child និងរបាយការណ៍ត្រូវទាំងពីរ', () => {
    const source = readFileSync(new URL('../zto-ci-evidence.mjs', import.meta.url), 'utf8');
    const marker = "if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {";
    assert.ok(source.includes(marker));
    const body = source.slice(source.indexOf(marker) + marker.length).replace(/}\s*$/, '');
    for (const [childStatus, validReport] of [[0, true], [1, true], [0, false]]) {
        const writes = [];
        const fakeProcess = { env: {}, execPath: 'synthetic-node', exitCode: 86 };
        const data = report();
        if (!validReport) data.success = false;
        const context = { path, assert, JSON, process: fakeProcess, console: { log() {} }, evidenceSourceRoot: () => '/synthetic/source/ZoeW',
            mkdirSync() {}, rmSync() {}, walk: () => files, selectTests, requireSuccessfulRun, validateReport,
            spawnSync: () => ({ status: childStatus, signal: null }), readFileSync: () => JSON.stringify(data),
            writeFileSync: (file) => writes.push(file) };
        if (childStatus === 0 && validReport) {
            runInNewContext(body, context);
            assert.equal(fakeProcess.exitCode, 0);
            assert.ok(writes.some(file => file.endsWith('/summary.json')));
        } else {
            assert.throws(() => runInNewContext(body, context));
            assert.equal(fakeProcess.exitCode, 1);
            assert.equal(writes.some(file => file.endsWith('/summary.json')), false);
        }
    }
});
