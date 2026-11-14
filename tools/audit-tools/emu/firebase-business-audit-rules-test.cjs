'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const { emuNamespace } = require('./ns.js');

process.exitCode = 1;
const ROOT = path.resolve(__dirname, '../../..');
const requiredOrigin = 'http://127.0.0.1:9000';
const namespace = emuNamespace('demo-zoe-business-audit');
const report = { status: 'FAIL', scope: 'actual Admin SDK handler/RTDB canonical rules; synthetic provider context; no deployed trigger delivery', checks: [], namespace };
const resultPath = process.env.ZOE_AUDIT_RULES_RESULT || path.join(ROOT, 'tools/audit-tools/zoew/test-results/final-audit/firebase-business-audit-rtdb.json');
let adminApp, db, deleteAdminApp;
let deadline;
let stage = 'admission';

function check(name, condition) { assert.ok(condition, name); report.checks.push({ name, pass: true }); }
async function request(method, node, body, actor = 'admin') {
    const url = new URL(node + '.json', requiredOrigin); url.searchParams.set('ns', namespace);
    const headers = {};
    if (actor !== null) {
        headers.Authorization = 'Bearer owner';
        if (actor !== 'admin') url.searchParams.set('auth_variable_override', JSON.stringify({ uid: actor }));
    }
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const response = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(10000) });
    return { status: response.status, value: await response.json() };
}

const run = async () => {
    assert.equal(process.env.F03_NATIVE_EMULATOR_URL, requiredOrigin, 'must run under owned RTDB command');
    process.env.FIREBASE_DATABASE_EMULATOR_HOST = '127.0.0.1:9000';
    process.env.GCLOUD_PROJECT = 'demo-zoe-audit';
    process.env.FIREBASE_CONFIG = JSON.stringify({ projectId: 'demo-zoe-audit', databaseURL: 'http://127.0.0.1:9000/?ns=demo-zoe-audit' });
    for (const key of ['HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy']) delete process.env[key];
    const runtime = path.join(ROOT, 'tools/firebase-provision/business-audit-functions');
    const requireRuntime = createRequire(path.join(runtime, 'package.json'));
    const { initializeApp, deleteApp } = requireRuntime('firebase-admin/app');
    deleteAdminApp = deleteApp;
    const { getDatabaseWithUrl } = requireRuntime('firebase-admin/database');
    const { DataSnapshot } = requireRuntime('firebase-functions/v1').database;
    const audit = requireRuntime('./business-audit.cjs');
    check('owned-namespace-empty-before-test', (await request('GET', '/')).value === null);
    const rules = JSON.parse(fs.readFileSync(path.join(ROOT, 'firebase-database.rules.json'), 'utf8'));
    check('canonical-rules-loaded', (await request('PUT', '/.settings/rules', rules)).status === 200);
    const config = { projectId: 'demo-zoe-audit', runtimeProjectId: 'demo-zoe-audit', instance: namespace, branchId: 'QA_ONLY', region: 'asia-southeast1', emulatorHost: '127.0.0.1:9000' };
    const providerURL = audit.emulatorDatabaseUrl(config);
    adminApp = initializeApp({ projectId: 'demo-zoe-audit', databaseURL: 'http://127.0.0.1:9000/?ns=demo-zoe-audit' }, namespace);
    db = getDatabaseWithUrl(providerURL, adminApp);
    const root = db.ref(), source = root.child('zoew_scan_history_cod_dod/row1');
    report.sdkReference = { origin: new URL(root.toString()).origin, namespace: new URL(root.toString()).searchParams.get('ns') };
    const before = new DataSnapshot((await source.get()).val(), '/zoew_scan_history_cod_dod/row1', adminApp, providerURL);
    await source.set({ id: 'row1', cod: 7, dod: 2, count: 1, barcodes: [{ code: 'QA_AUDIT_0001', cod: 7, dod: 2, isClosed: false }] });
    const after = new DataSnapshot((await source.get()).val(), '/zoew_scan_history_cod_dod/row1', adminApp, providerURL);
    const verifyEmulatorRoot = (ref, target) => ref.isEqual(getDatabaseWithUrl(audit.emulatorDatabaseUrl(target), ref.database.app).ref());
    const handler = audit.createHandler('zoew_scan_history_cod_dod', config, { verifyEmulatorRoot });
    const context = { eventId: 'synthetic-provider-context-actual-handler-1', timestamp: '2026-11-14T06:00:00.000Z',
        authType: 'USER', auth: { uid: 'synthetic-actor-A' }, params: { recordId: 'row1' },
        resource: { service: 'firebaseio.com', name: 'projects/_/instances/' + namespace + '/refs/zoew_scan_history_cod_dod/row1' } };
    let discard = true;
    const wrappedRoot = { toString: () => root.toString(), database: root.database, isEqual: other => root.isEqual(other), child(node) {
        const ref = root.child(node);
        return { get: () => ref.get(), async transaction(...args) {
            const result = await ref.transaction(...args);
            if (discard && node.startsWith(audit.AUDIT_ROOT + '/')) { discard = false; throw new Error('synthetic ACK loss after actual server commit'); }
            return result;
        } };
    } };
    const change = { before, after: { val: () => after.val(), ref: { root: wrappedRoot } } };
    stage = 'postcommit-lost-ack';
    await assert.rejects(handler(change, context), /AUDIT_WRITE_RETRY_REQUIRED/);
    check('postcommit-lost-ack-propagates-retry', !discard);
    const initialEvents = (await root.child(audit.AUDIT_ROOT).get()).val();
    check('original-audit-committed-once-before-response-loss', Object.keys(initialEvents || {}).length === 1);
    const delivery = await handler({ before, after }, context);
    check('same-provider-ID-recovery-is-duplicate', delivery.duplicate === true);
    const duplicateReplies = await Promise.all(Array.from({ length: 3 }, () => handler({ before, after }, context)));
    check('concurrent-duplicate-event-id-one-effect', duplicateReplies.every(reply => reply.duplicate === true)
        && Object.keys((await root.child(audit.AUDIT_ROOT).get()).val()).length === 1);
    const event = (await root.child(audit.AUDIT_ROOT + '/' + delivery.eventId).get()).val();
    check('server-source-fields-and-status-persist', event.actor.uid === 'synthetic-actor-A' && event.branchId === 'QA_ONLY'
        && event.previousStatus === 'absent' && event.newStatus === 'open' && event.after.money.codDollar === 7
        && event.committedAt === context.timestamp && event.after.barcodes.samples[0].code === 'QA_AUDIT_0001');
    const failures = (await root.child(audit.FAILURE_ROOT + '/' + delivery.eventId).get()).val();
    check('failure-candidate-retained-and-resolved', Object.values(failures).every(value => value.status === 'resolved' && value.candidateEvent.providerEventId === context.eventId));
    await assert.rejects(handler({ before, after: { val: () => ({ ...after.val(), cod: 99 }), ref: { root } } }, context), /AUDIT_EVENT_COLLISION/);
    check('collision-cannot-overwrite-original', audit.stable((await root.child(audit.AUDIT_ROOT + '/' + delivery.eventId).get()).val()) === audit.stable(event));
    check('collision-evidence-retained', Object.values((await root.child(audit.FAILURE_ROOT + '/' + delivery.eventId).get()).val()).some(value => value.status === 'collision'));
    const foreign = getDatabaseWithUrl(audit.emulatorDatabaseUrl({ ...config, instance: namespace + '-foreign' }), adminApp).ref();
    await assert.rejects(handler({ before, after: { val: () => after.val(), ref: { root: foreign } } }, context), /AUDIT_PROVIDER_INSTANCE/);
    check('actual-foreign-SDK-namespace-same-app-and-loopback-denied', true);
    for (const actor of ['synthetic-actor-A', 'foreign-branch-actor-B', null]) {
        for (const namespaceRoot of [audit.AUDIT_ROOT, audit.FAILURE_ROOT]) {
            for (const [method, suffix, body] of [['GET', '', undefined], ['PUT', '/forged', { actor: 'forged' }], ['PATCH', '', { forged: true }], ['DELETE', '', undefined]]) {
                const response = await request(method, '/' + namespaceRoot + suffix, body, actor);
                check('client-' + (actor || 'anonymous') + '-' + namespaceRoot + '-' + method + '-denied', response.status === 401 || response.status === 403);
            }
        }
    }
    check('business-record-not-modified-by-audit', (await source.get()).val().cod === 7);
    await db.ref().set(null);
    check('owned-namespace-cleanup-verified', (await db.ref().get()).val() === null);
    await deleteApp(adminApp); adminApp = null;
    report.status = 'PASS'; report.deployedTriggerDelivery = 'NOT_TESTED';
};
Promise.race([run(), new Promise((_, reject) => { deadline = setTimeout(() => reject(Object.assign(new Error('bounded SDK test deadline'), { code: 'AUDIT_PROOF_DEADLINE' })), 45000); })])
.catch(error => { report.failure = { code: error?.code || error?.name || 'Error', stage,
    actualCode: error?.actual?.code, marker: /AUDIT_[A-Z_]+/.exec(String(error?.message || ''))?.[0] }; }).finally(async () => {
    clearTimeout(deadline);
    if (adminApp) {
        try { if (db) db.goOffline(); await deleteAdminApp(adminApp); } catch (_) { report.cleanupUnproven = true; }
        try {
            const cleared = await request('PUT', '/', null);
            if (cleared.status !== 200 || (await request('GET', '/')).value !== null) report.cleanupUnproven = true;
        } catch (_) { report.cleanupUnproven = true; }
    }
    fs.mkdirSync(path.dirname(resultPath), { recursive: true });
    fs.writeFileSync(resultPath, JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
    process.stdout.write(JSON.stringify({ status: report.status, checks: report.checks.length, evidence: resultPath, scope: report.scope }) + '\n');
    process.exitCode = report.status === 'PASS' && !report.cleanupUnproven ? 0 : 1;
});
