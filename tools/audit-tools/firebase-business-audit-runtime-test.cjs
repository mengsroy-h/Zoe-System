'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createRequire } = require('node:module');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '../..');
const runtime = path.resolve(process.env.ZOE_AUDIT_RUNTIME_DIR || path.join(ROOT, 'tools/firebase-provision/business-audit-functions'));
const expectedRoots = ['zoew_scan_history_cod_dod', 'zoew_recently_deleted_cod_dod', 'zoew_daily_revenue_cod_dod',
    'zoew_monthly_revenue_cod_dod', 'zoew_daily_pickup_cod_dod', 'zoew_daily_collected_cod_dod',
    'zoew_scan_operations', 'zoew_trash_consumptions', 'zoew_registry_releases', 'zoew_restore_finalizations'];

function verify() {
    const pkg = JSON.parse(fs.readFileSync(path.join(runtime, 'package.json'), 'utf8'));
    const requireRuntime = createRequire(path.join(runtime, 'package.json'));
    assert.equal(pkg.engines.node, '22');
    const functionsPackage = JSON.parse(fs.readFileSync(path.join(runtime, 'node_modules/firebase-functions/package.json'), 'utf8'));
    const adminPackage = JSON.parse(fs.readFileSync(path.join(runtime, 'node_modules/firebase-admin/package.json'), 'utf8'));
    assert.equal(functionsPackage.version, '7.4.0'); assert.equal(adminPackage.version, '14.5.1');
    assert.equal(pkg.dependencies['firebase-functions'], functionsPackage.version);
    assert.equal(pkg.dependencies['firebase-admin'], adminPackage.version);
    process.env.ZOE_AUDIT_PROJECT_ID = 'zoe-audit-sdk-test';
    process.env.GCLOUD_PROJECT = 'zoe-audit-sdk-test';
    process.env.ZOE_AUDIT_DATABASE_INSTANCE = 'zoe-audit-sdk-test-default-rtdb';
    process.env.ZOE_AUDIT_BRANCH_ID = 'QA_001';
    process.env.ZOE_AUDIT_REGION = 'asia-southeast1';
    process.env.FIREBASE_CONFIG = '{"projectId":"zoe-audit-sdk-test"}';
    for (const name of ['node:http', 'node:https']) {
        const transport = require(name);
        for (const method of ['request', 'get']) transport[method] = () => { throw new Error('AUDIT_RUNTIME_NETWORK_FORBIDDEN'); };
    }
    globalThis.fetch = () => { throw new Error('AUDIT_RUNTIME_NETWORK_FORBIDDEN'); };
    const definitions = requireRuntime('./index.cjs');
    assert.equal(Object.keys(definitions).length, expectedRoots.length);
    for (const root of expectedRoots) {
        const exported = definitions['audit_' + root.replace(/^zoew_/, '')];
        assert.equal(typeof exported, 'function');
        assert.equal(exported.__endpoint.platform, 'gcfv1');
        assert.equal(exported.__endpoint.eventTrigger.retry, true);
        assert.deepEqual(exported.__trigger.failurePolicy, { retry: {} });
        assert.equal(exported.__trigger.eventTrigger.service, 'firebaseio.com');
        assert.equal(exported.__trigger.eventTrigger.eventType, 'providers/google.firebase.database/eventTypes/ref.write');
        assert.equal(exported.__trigger.eventTrigger.resource, 'projects/_/instances/zoe-audit-sdk-test-default-rtdb/refs/' + root + '/{recordId}');
        assert.deepEqual(exported.__trigger.regions, ['asia-southeast1']);
        assert.equal(exported.__trigger.timeout, '120s');
    }
    const types = fs.readFileSync(path.join(runtime, 'node_modules/firebase-functions/lib/v1/cloud-functions.d.ts'), 'utf8');
    assert.match(types, /authType\?: "ADMIN" \| "USER" \| "UNAUTHENTICATED"/);
    for (const fragment of ['eventId: string', 'timestamp: string', 'resource: Resource', 'uid: string']) assert.ok(types.includes(fragment));
    return { definitions: expectedRoots.length, firebaseFunctions: functionsPackage.version, firebaseAdmin: adminPackage.version,
        node: process.version, deployment: 'BLOCKED_TARGET_PLAN', networkCalls: 0 };
}

function controls() {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'zoe-business-audit-sdk-'));
    const result = [];
    try {
        const index = fs.readFileSync(path.join(runtime, 'index.cjs'), 'utf8');
        for (const [name, source, withDependencies] of [
            ['empty_exports', 'module.exports = {};\n', true],
            ['retry_disabled', index.replace('failurePolicy: true', 'failurePolicy: false'), true],
            ['foreign_instance', index.replace('.database.instance(config.instance)', ".database.instance('foreign-default-rtdb')"), true],
            ['missing_dependencies', index, false]
        ]) {
            const dir = path.join(base, name); fs.mkdirSync(dir);
            for (const file of ['package.json', 'business-audit.cjs']) fs.copyFileSync(path.join(runtime, file), path.join(dir, file));
            fs.writeFileSync(path.join(dir, 'index.cjs'), source);
            if (withDependencies) fs.symlinkSync(path.join(runtime, 'node_modules'), path.join(dir, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
            const child = spawnSync(process.execPath, [__filename, '--verify-only'], { encoding: 'utf8', timeout: 20000,
                env: { ...process.env, ZOE_AUDIT_RUNTIME_DIR: dir } });
            assert.equal(child.signal, null, name + ' must fail by assertion, not timeout/signal');
            assert.equal(child.status, 1, name + ' must fail closed');
            result.push({ name, rejected: true, exitCode: child.status });
        }
    } finally { fs.rmSync(base, { recursive: true, force: true }); }
    return result;
}

try {
    if (process.argv.slice(2).some(argument => argument !== '--verify-only')) throw new Error('AUDIT_RUNTIME_ARGUMENT');
    const evidence = verify();
    if (!process.argv.includes('--verify-only')) evidence.controls = controls();
    process.stdout.write(JSON.stringify({ status: 'PASS', ...evidence }) + '\n');
} catch (error) {
    process.stderr.write('FIREBASE_AUDIT_RUNTIME_FAILED:' + (error?.code || error?.name || 'Error') + '\n');
    process.exitCode = 1;
}
