'use strict';
process.exitCode = 1;
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const crypto = require('node:crypto');
const { emuNamespace } = require('./ns.js');
const { legacyRestoreVector, attestedRestoreVector, mergedAttestedRestoreVector, invalidGrantMutations, invalidPolicyEpochs } = require('../zto-restore-attestation-cases.cjs');
const ROOT = path.resolve(process.env.ZTOATTEST_APP_DIR || path.join(__dirname, '../../..'));
const PORT = Number(process.env.ZTOATTEST_EMU_PORT || 9000);
if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) throw new Error('Invalid loopback emulator port');
const actor = 'attestation_regular_user';
let namespace, pass = 0, fail = 0;
const observations = [];
function check(value, label, detail) {
    if (value) { pass++; console.log('  ok    ' + label); }
    else { fail++; console.log('  FAIL  ' + label + (detail === undefined ? '' : ' ' + JSON.stringify(detail))); }
}
function request(method, node, body, administrator = false, asAuth) {
    return new Promise((resolve, reject) => {
        const payload = body === undefined ? null : JSON.stringify(body);
        const query = 'ns=' + encodeURIComponent(namespace) + (administrator ? '' : '&auth_variable_override='
            + encodeURIComponent(JSON.stringify(asAuth || { uid: actor })));
        const headers = { Authorization: 'Bearer owner' };
        if (payload !== null) { headers['Content-Type'] = 'application/json'; headers['Content-Length'] = Buffer.byteLength(payload); }
        const req = http.request({ hostname: '127.0.0.1', port: PORT, method, path: node + '.json?' + query,
            headers, agent: false }, response => {
            let text = '';
            response.setEncoding('utf8');
            response.on('data', part => { text += part; });
            response.on('error', reject);
            response.on('end', () => { try { resolve({ status: response.statusCode, value: JSON.parse(text) }); }
                catch { reject(new Error('Invalid emulator response')); } });
        });
        req.setTimeout(5000, () => req.destroy(new Error('EMULATOR_REQUEST_TIMEOUT')));
        req.on('error', reject);
        if (payload !== null) req.write(payload);
        req.end();
    });
}
const equal = require('node:util').isDeepStrictEqual;
function valueAt(tree, key) { return key.split('/').reduce((node, field) => node && node[field], tree) ?? null; }
function inputFingerprints() {
    const files = [__filename, path.join(__dirname, '../zto-restore-attestation-cases.cjs'),
        path.join(__dirname, '../money-cookie-blob.js'), path.join(__dirname, '../fixtures/money-restore-issuer.cjs'),
        path.join(ROOT, 'firebase-database.rules.json'),
        ...['zto-order-detail-core.cjs', 'zto-palm.js', 'zto-restore-proof.cjs', 'zto-restore-http.cjs', 'zto-restore-firebase.cjs']
            .map(file => path.join(ROOT, 'ZoeW/netlify/functions/_shared', file))];
    return Object.fromEntries(files.map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
}

async function localJSON(method, url, body, headers = {}) {
    const target = new URL(url);
    if (target.hostname !== '127.0.0.1' || target.protocol !== 'http:') throw new Error('Only owned loopback HTTP is allowed');
    return new Promise((resolve, reject) => {
        const payload = body === undefined ? null : JSON.stringify(body);
        const req = http.request(target, { method, agent: false, headers: { ...headers,
            ...(payload === null ? {} : { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }) } }, response => {
            let text = '';
            response.setEncoding('utf8'); response.on('data', part => { text += part; });
            response.on('error', reject);
            response.on('end', () => { try { resolve({ status: response.statusCode, value: text ? JSON.parse(text) : null,
                etag: response.headers.etag || null }); } catch (error) { reject(error); } });
        });
        req.setTimeout(10000, () => req.destroy(new Error('LOCAL_REQUEST_TIMEOUT')));
        req.on('error', reject); if (payload !== null) req.write(payload); req.end();
    });
}

async function invalidLocalPolicyCases(rules) {
    namespace = emuNamespace('demo-local-policy-epoch');
    if ((await request('PUT', '/.settings/rules', rules, true)).status !== 200) throw new Error('Local policy rules installation failed');
    const start = pass + fail, cases = [];
    if (invalidPolicyEpochs().length !== 4) throw new Error('All invalid policy epochs must run');
    for (const [index, epoch] of invalidPolicyEpochs().entries()) {
        const vector = legacyRestoreVector('local', 'local_epoch_' + index, actor);
        const zero = { codDollar: 0, dodDollar: 0, totalCount: 0 };
        const seed = { zoew_restore_policy: { shop: { v: 1, mode: 'local', scope: 'qa_restore_attestation', branch: '', epoch } },
            zoew_recently_deleted_cod_dod: { [vector.source.id]: { ...vector.source, restoreClaim: vector.claim } },
            zoew_daily_revenue_cod_dod: { [vector.day]: zero }, zoew_monthly_revenue_cod_dod: { [vector.month]: zero } };
        if ((await request('PUT', '/', seed, true)).status !== 200) throw new Error('Local invalid-policy seed failed');
        const before = (await request('GET', '/', undefined, true)).value;
        const claim = await request('PUT', '/zoew_recently_deleted_cod_dod/' + vector.source.id + '/restoreClaim', vector.claim);
        const prepare = await request('PUT', '/zoew_scan_history_cod_dod/' + vector.claim.targetId, vector.prepared);
        const after = (await request('GET', '/', undefined, true)).value;
        check([401, 403].includes(claim.status) && [401, 403].includes(prepare.status), 'Sheet: invalid policy epoch ' + epoch + ' denies existing-claim and prepare');
        check(equal(before, after), 'Sheet: invalid policy epoch ' + epoch + ' preserves every DB record');
        check(equal(valueAt(after, 'zoew_daily_revenue_cod_dod/' + vector.day), zero)
            && equal(valueAt(after, 'zoew_monthly_revenue_cod_dod/' + vector.month), zero), 'Sheet: invalid epoch keeps money/counts unchanged');
        check(valueAt(after, 'zoew_trash_consumptions/' + vector.source.id) === null
            && valueAt(after, 'zoew_restore_finalizations/' + vector.source.id) === null, 'Sheet: invalid epoch creates no receipts');
        cases.push({ epoch, claimStatus: claim.status, prepareStatus: prepare.status, sourceClaimPreseeded: true });
    }
    return { checks: pass + fail - start, cases };
}

async function attestedFinancialCases(rules) {
    const { cookieFixture } = require('../money-cookie-blob.js');
    const fx = require('../idtoken-fixture.js');
    const project = 'demo-restore-attestation';
    // The fixture captures this loopback transport; barriers delay actual CAS requests,
    // while Google verification, ZTO reads, controller and adapter remain unchanged.
    const realTransport = global.fetch;
    let serviceInterceptor = null;
    global.fetch = (url, init) => serviceInterceptor ? serviceInterceptor(url, init, realTransport) : realTransport(url, init);
    const fixture = cookieFixture(ROOT, { project, firebasePort: PORT });
    const details = [];
    const startChecks = pass + fail;
    const zero = { codDollar: 0, dodDollar: 0, totalCount: 0 };
    const stamp = ms => new Date(ms + 7 * 3600000).toISOString().slice(0, 19).replace('T', ' ');
    let droppedAck = null;
    let droppedProofAck = null;
    const server = http.createServer((req, rsp) => {
        if (req.url === '/drop-proof-ack') {
            req.url = '/.netlify/functions/zto-restore-proof';
            rsp.end = () => {
                droppedProofAck = { injections: (droppedProofAck?.injections || 0) + 1, status: rsp.statusCode };
                rsp.destroy(); return rsp;
            };
            return fixture.serve(req, rsp);
        }
        if (req.url !== '/drop-final-ack') return fixture.serve(req, rsp);
        (async () => {
            let text = ''; for await (const part of req) text += part;
            const incoming = JSON.parse(text);
            const response = await request('PATCH', '/', incoming.packet, false, incoming.auth);
            droppedAck = { injections: (droppedAck?.injections || 0) + 1, status: response.status };
            if (response.status === 200) rsp.destroy();
            else { rsp.writeHead(500); rsp.end(JSON.stringify({ rejected: true })); }
        })().catch(error => { rsp.writeHead(500); rsp.end(JSON.stringify({ error: error.message })); });
    });
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    const origin = 'http://127.0.0.1:' + server.address().port;
    try {
        for (const mode of ['palm', 'cookie']) {
            namespace = emuNamespace('demo-attested-finance-' + mode);
            const scope = 'http://127.0.0.1:' + PORT + '?ns=' + namespace;
            if ((await request('PUT', '/.settings/rules', rules, true)).status !== 200) throw new Error('Financial canonical rules installation failed');
            const uid = 'attestation_financial_' + mode;
            const email = 'fixture@zoew1.com';
            const authTime = Math.floor(Date.now() / 1000) - 1;
            const auth = { uid, token: { auth_time: authTime, email } };
            fixture.registerFirebaseActor({ uid, email, databaseURL: scope });
            const token = fx.tokenFor(email, { aud: project, claims: { sub: uid, auth_time: authTime,
                iat: Math.floor(Date.now() / 1000) } });
            const headers = { 'x-zoe-id-token': token, 'x-zoe-proxy-key': fixture.proxyKey, 'x-zoe-palm-site': '1' };
            if (mode === 'palm') {
                const login = await localJSON('POST', origin + '/.netlify/functions/zto-order-detail?palm=login',
                    { username: 'palm-1', password: 'synthetic-only', deviceSn: 'synthetic-device-001' }, headers);
                if (login.status !== 200 || login.value?.shared !== true) throw new Error('Controlled Palm login did not establish a real sealed shared session');
            }
            const seed = async (id, merge = false) => {
                const vector = merge ? mergedAttestedRestoreVector(mode, id, uid, scope) : attestedRestoreVector(mode, id, uid, scope);
                const code = vector.source.barcodes[0].code.toUpperCase();
                fixture.world.parcels.set(code, { site: '1', phone: vector.source.phone, arrivedAt: stamp(vector.source.createdAt + 1) });
                const data = { zoew_restore_policy: { shop: { v: 1, mode, scope, branch: '1', epoch: 1 } },
                    zoew_recently_deleted_cod_dod: { [id]: vector.source }, zoew_barcode_registry: { [code]: true },
                    ...(merge ? { zoew_scan_history_cod_dod: { [vector.claim.targetId]: vector.neighbor } } : {}),
                    zoew_daily_revenue_cod_dod: { [vector.day]: merge ? vector.initialMoney : zero },
                    zoew_monthly_revenue_cod_dod: { [vector.month]: merge ? vector.initialMoney : zero } };
                if (merge) data.zoew_barcode_registry[vector.neighbor.barcodes[3].code] = true;
                if ((await request('PUT', '/', data, true)).status !== 200) throw new Error('Owned financial fixture seed failed');
                return vector;
            };
            const proof = (vector, action = 'authorize') => localJSON('POST', origin + '/.netlify/functions/zto-restore-proof', {
                v: 1, action, sourceId: vector.source.id, token: vector.claim.token, targetId: vector.claim.targetId, expectedGeneration: 0
            }, headers);
            const dump = async () => (await request('GET', '/', undefined, true)).value;
            const denied = status => status === 401 || status === 403;
            const unchangedMoney = (tree, vector, label) => {
                check(equal(valueAt(tree, 'zoew_daily_revenue_cod_dod/' + vector.day), zero)
                    && equal(valueAt(tree, 'zoew_monthly_revenue_cod_dod/' + vector.month), zero), label + ': money and counts unchanged');
                check(valueAt(tree, 'zoew_trash_consumptions/' + vector.source.id) === null
                    && valueAt(tree, 'zoew_restore_finalizations/' + vector.source.id) === null, label + ': no financial receipts created');
            };
            const issue = async (vector, sourceSlot = 0) => {
                const response = await proof(vector);
                const tree = await dump();
                const grant = valueAt(tree, 'zoew_restore_attestations/' + vector.source.id);
                const source = valueAt(tree, 'zoew_recently_deleted_cod_dod/' + vector.source.id);
                check(response.status === 200 && response.value?.kind === 'allow' && grant?.status === 'allow', mode + ': production controller issued actual ALLOW', response);
                check(source?.restoreAttestationId === grant?.id && source?.restoreClaim?.token === vector.claim.token
                    && source?.restoreClaim?.targetId === vector.claim.targetId && grant?.actorUid === uid
                    && grant?.authTime === authTime * 1000 && grant?.scope === scope
                    && grant?.codes?.[vector.source.barcodes[0].code] === true
                    && grant?.allowedTargetSlots?.[sourceSlot] === vector.source.barcodes[0].code,
                mode + ': actual server claim and grant bind actor, source, target, scope and barcode');
                if (response.status !== 200) {
                    const etagRead = await localJSON('GET', 'http://127.0.0.1:' + PORT + '/zoew_recently_deleted_cod_dod/'
                        + vector.source.id + '.json?ns=' + namespace, undefined, { Authorization: 'Bearer owner', 'X-Firebase-ETag': 'true' });
                    console.error('ATTESTOR_DIAGNOSTIC ' + JSON.stringify({ status: response.status, code: response.value?.code,
                        sourcePresent: !!source, sourceIdMatches: source?.id === vector.source.id,
                        sourceGeneration: source?.trashGeneration ?? 0, sourceBirth: source?.createdAt, sourceDeletedAt: source?.deletedAt,
                        sourceEtag: etagRead.etag, grantPresent: !!grant,
                        upstreamReads: { palm: fixture.world.palmTracks, cookie: fixture.world.details } }));
                }
                if (response.status !== 200 || grant?.status !== 'allow') throw new Error('A genuine ALLOW is required before negative grant controls');
                return { tree, grant, source };
            };

            // All grants come through the production controller + Firebase adapter.
            // Only Google Auth and ZTO are controlled fixtures; ETag CAS and rules writes hit real RTDB.
            const good = await seed('valid_' + mode);
            const authorized = await issue(good);
            const foreign = await request('PUT', '/zoew_scan_history_cod_dod/' + good.claim.targetId, good.prepared, false,
                { uid: 'foreign-user', token: { auth_time: authTime, email } });
            check(denied(foreign.status) && equal(await dump(), authorized.tree), mode + ': genuine grant rejects a different authenticated actor');
            const laterLogin = await request('PUT', '/zoew_scan_history_cod_dod/' + good.claim.targetId, good.prepared, false,
                { uid, token: { auth_time: authTime + 1, email } });
            check(denied(laterLogin.status) && equal(await dump(), authorized.tree), mode + ': grant does not transfer to a different login auth_time');
            const modified = await request('PUT', '/zoew_restore_attestations/' + good.source.id + '/actorUid', 'foreign-user', false, auth);
            check(denied(modified.status), mode + ': ordinary client cannot alter an existing trusted grant');
            check(equal(await dump(), authorized.tree), mode + ': denied grant mutation preserves the whole database');
            const prepared = await request('PUT', '/zoew_scan_history_cod_dod/' + good.claim.targetId, good.prepared, false, auth);
            check(prepared.status === 200, mode + ': valid server-bound claim admits prepared history', prepared);
            const finalized = await request('PATCH', '/', good.finalPacket, false, auth);
            const finalTree = await dump();
            check(finalized.status === 200, mode + ': valid grant finalizes an ordinary authenticated financial write', finalized);
            check(equal(valueAt(finalTree, 'zoew_daily_revenue_cod_dod/' + good.day), good.money)
                && equal(valueAt(finalTree, 'zoew_monthly_revenue_cod_dod/' + good.month), good.money), mode + ': exact daily/monthly money 7/2 and one package');
            check(valueAt(finalTree, 'zoew_recently_deleted_cod_dod/' + good.source.id) === null
                && valueAt(finalTree, 'zoew_scan_history_cod_dod/' + good.claim.targetId + '/barcodes/0/code') === good.source.barcodes[0].code,
            mode + ': one source removed and exactly the verified target barcode retained');
            check(equal(valueAt(finalTree, 'zoew_trash_consumptions/' + good.source.id), good.consumption)
                && equal(valueAt(finalTree, 'zoew_restore_finalizations/' + good.source.id), good.finalization), mode + ': one exact consumption and finalization receipt');
            const replay = await request('PATCH', '/', good.finalPacket, false, auth);
            const afterReplay = await dump();
            check([200, 401, 403].includes(replay.status) && equal(afterReplay, finalTree), mode + ': stale whole-final packet has no second financial/database effect',
                { status: replay.status, databaseChanged: !equal(afterReplay, finalTree) });
            const expiry = await request('PUT', '/zoew_restore_attestations/' + good.source.id + '/expiresAt', Date.now() - 1, true);
            if (expiry.status !== 200) throw new Error('Owned expired-receipt setup failed');
            const expiredState = await dump();
            const receiptReplay = await request('PUT', '/zoew_trash_consumptions/' + good.source.id, good.consumption, false, auth);
            const finalizationReplay = await request('PUT', '/zoew_restore_finalizations/' + good.source.id, good.finalization, false, auth);
            check(valueAt(expiredState, 'zoew_restore_attestations/' + good.source.id + '/expiresAt') < Date.now()
                && receiptReplay.status === 200 && denied(finalizationReplay.status) && equal(expiredState, await dump()),
            mode + ': expired consumption replay is exact and completed finalization rewrite stays denied', [receiptReplay.status, finalizationReplay.status]);

            const invalidResults = [];
            if (invalidGrantMutations().length !== 12) throw new Error('Every invalid-grant control must run');
            for (const [name, mutation] of invalidGrantMutations()) {
                const vector = await seed('invalid_' + mode + '_' + name);
                await issue(vector);
                // Explicit privileged negative setup corrupts a genuinely issued grant; it never represents a successful client grant.
                await request(mutation === null ? 'DELETE' : 'PATCH', '/zoew_restore_attestations/' + vector.source.id, mutation ?? undefined, true);
                const before = await dump();
                const prepare = await request('PUT', '/zoew_scan_history_cod_dod/' + vector.claim.targetId, vector.prepared, false, auth);
                const finalize = await request('PATCH', '/', vector.finalPacket, false, auth);
                const after = await dump();
                check(denied(prepare.status) && denied(finalize.status), mode + '/' + name + ': invalid grant cannot prepare or finalize', [prepare.status, finalize.status]);
                check(equal(before, after), mode + '/' + name + ': rejected writes preserve source, grant and every record');
                unchangedMoney(after, vector, mode + '/' + name);
                invalidResults.push({ name, prepareStatus: prepare.status, finalizeStatus: finalize.status,
                    databaseChanged: !equal(before, after), historyCreated: valueAt(after, 'zoew_scan_history_cod_dod/' + vector.claim.targetId) !== null });
            }
            const invalidPolicies = [];
            for (const [index, epoch] of invalidPolicyEpochs().entries()) {
                const vector = await seed('epoch_' + mode + '_' + index);
                const issued = await issue(vector);
                const changed = await request('PATCH', '/', { 'zoew_restore_policy/shop/epoch': epoch,
                    ['zoew_restore_attestations/' + vector.source.id + '/policyEpoch']: epoch }, true);
                if (changed.status !== 200) throw new Error('Owned invalid-policy setup failed');
                const before = await dump();
                // Both policy and grant carry the SAME bad epoch. The exact
                // existing claim avoids a missing-claim or mismatch false red.
                const claim = await request('PUT', '/zoew_recently_deleted_cod_dod/' + vector.source.id + '/restoreClaim', issued.source.restoreClaim, false, auth);
                const prepare = await request('PUT', '/zoew_scan_history_cod_dod/' + vector.claim.targetId, vector.prepared, false, auth);
                const after = await dump();
                check(denied(claim.status) && denied(prepare.status), mode + ': invalid matching policy/grant epoch ' + epoch + ' denies claim and prepare');
                check(equal(before, after), mode + ': invalid matching epoch preserves full DB state');
                unchangedMoney(after, vector, mode + '/invalid-policy-' + epoch);
                invalidPolicies.push({ epoch, claimStatus: claim.status, prepareStatus: prepare.status, sourceClaimPreseeded: true });
            }

            const frozen = await seed('frozen_' + mode);
            await issue(frozen);
            for (const [field, value] of [['phone', '011000001'], ['createdAt', frozen.source.createdAt + 1], ['barcodes/0/cod', 700], ['barcodes/0/code', 'UNVERIFIED_B']]) {
                const before = await dump();
                const changed = await request('PUT', '/zoew_recently_deleted_cod_dod/' + frozen.source.id + '/' + field, value, false, auth);
                check(denied(changed.status) && equal(before, await dump()), mode + ': sealed source freezes ' + field);
            }
            const injected = structuredClone(frozen.prepared); injected.barcodes[0].code = 'UNVERIFIED_B';
            const beforeUnverified = await dump();
            const inserted = await request('PUT', '/zoew_scan_history_cod_dod/' + frozen.claim.targetId, injected, false, auth);
            check(denied(inserted.status) && equal(beforeUnverified, await dump()), mode + ': grant for A cannot insert unverified B into a new target');
            const ownPrepared = await request('PUT', '/zoew_scan_history_cod_dod/' + frozen.claim.targetId, frozen.prepared, false, auth);
            check(ownPrepared.status === 200, mode + ': verified A prepares before slot-substitution control');
            const beforeSubstitution = await dump();
            const substituted = await request('PUT', '/zoew_scan_history_cod_dod/' + frozen.claim.targetId + '/barcodes/0/code', 'UNVERIFIED_B', false, auth);
            check(denied(substituted.status) && equal(beforeSubstitution, await dump()), mode + ': prepared verified A cannot be replaced by unverified B');
            unchangedMoney(await dump(), frozen, mode + '/unverified-B');

            const merge = await seed('merge_' + mode, true);
            const mergeProof = await issue(merge, 1);
            const oldCode = merge.neighbor.barcodes[3].code;
            check(mergeProof.grant?.allowedTargetSlots?.[0] === oldCode, mode + ': trusted sparse neighbor B is bound to normalized slot0');
            const unknown = structuredClone(merge.prepared); unknown.barcodes[0].code = 'UNVERIFIED_C';
            const beforeUnknown = await dump();
            const wrongNeighbor = await request('PUT', '/zoew_scan_history_cod_dod/' + merge.claim.targetId, unknown, false, auth);
            check(denied(wrongNeighbor.status) && equal(beforeUnknown, await dump()), mode + ': sparse target compaction cannot substitute unverified C');
            const mergePrepare = await request('PUT', '/zoew_scan_history_cod_dod/' + merge.claim.targetId, merge.prepared, false, auth);
            check(mergePrepare.status === 200, mode + ': legitimate Bslot3 to B0 plus verified A1 prepares', mergePrepare);
            const mergeFinalize = await request('PATCH', '/', merge.finalPacket, false, auth);
            const merged = await dump();
            check(mergeFinalize.status === 200, mode + ': legitimate compacted neighbor merge finalizes', mergeFinalize);
            check(equal(valueAt(merged, 'zoew_daily_revenue_cod_dod/' + merge.day), merge.money)
                && equal(valueAt(merged, 'zoew_monthly_revenue_cod_dod/' + merge.month), merge.money), mode + ': merge adds only A money/count to preexisting B');
            check(valueAt(merged, 'zoew_scan_history_cod_dod/' + merge.claim.targetId + '/barcodes/0/code') === oldCode
                && valueAt(merged, 'zoew_scan_history_cod_dod/' + merge.claim.targetId + '/barcodes/1/code') === merge.source.barcodes[0].code
                && valueAt(merged, 'zoew_recently_deleted_cod_dod/' + merge.source.id) === null, mode + ': merge preserves exactly existing B plus verified A');
            check(equal(valueAt(merged, 'zoew_trash_consumptions/' + merge.source.id), merge.consumption)
                && equal(valueAt(merged, 'zoew_restore_finalizations/' + merge.source.id), merge.finalization), mode + ': sparse merge creates one exact receipt pair');

            for (const terminal of ['signed', 'unknown']) {
                const vector = await seed('late_' + mode + '_' + terminal);
                const code = vector.source.barcodes[0].code.toUpperCase();
                const provider = global.fetch;
                let release, reached;
                const barrier = new Promise(resolve => { reached = resolve; });
                const held = new Promise(resolve => { release = resolve; });
                let interceptions = 0;
                global.fetch = async (url, init) => {
                    const target = new URL(String(url));
                    let body; try { body = JSON.parse(init?.body || '{}'); } catch { body = {}; }
                    // Cookie's final transition page is held after the earlier
                    // arrival/sign/return pages were read. The old request has a
                    // complete unsigned snapshot, rather than re-reading Sign.
                    const match = target.hostname === (mode === 'palm' ? 'aargus-api.ztoglobal.net' : 'aargus-api.ztoglobal.com')
                        && (mode === 'palm' ? body.mailNos === code
                            : body.condition?.scanTypeCode === '30' && body.condition?.mailNos?.includes(code));
                    if (match && !interceptions) {
                        interceptions++;
                        const response = await provider(url, init);
                        reached(); await held; return response;
                    }
                    return provider(url, init);
                };
                let late;
                try {
                    late = proof(vector);
                    let timer;
                    try {
                        await Promise.race([barrier, new Promise((_, reject) => {
                            timer = setTimeout(() => reject(new Error('Late-response control did not reach actual provider read')), 10000);
                        })]);
                    } finally { clearTimeout(timer); }
                    if (terminal === 'signed') fixture.world.parcels.get(code).signedAt = stamp(Date.now() - 1);
                    else fixture.world.parcels.delete(code);
                    const current = await proof(vector);
                    const beforeLate = await dump();
                    release();
                    const old = await late;
                    const afterLate = await dump();
                    const authority = valueAt(afterLate, 'zoew_restore_attestations/' + vector.source.id);
                    check(interceptions === 1 && (terminal === 'signed' ? current.status === 200 && current.value?.kind === 'deny' : current.status === 503),
                        mode + '/' + terminal + ': newer actual provider verdict was committed before old response');
                    check(old.status !== 200 && equal(beforeLate, afterLate) && authority?.status === (terminal === 'signed' ? 'deny' : 'hold'),
                        mode + '/' + terminal + ': delayed old ALLOW cannot replace newer DENY/HOLD revision');
                    const deniedFinal = await request('PATCH', '/', vector.finalPacket, false, auth);
                    check(denied(deniedFinal.status), mode + '/' + terminal + ': terminal/unknown authority denies financial finalize');
                    unchangedMoney(await dump(), vector, mode + '/' + terminal);
                } finally { release(); global.fetch = provider; if (late) await late.catch(() => {}); }
            }

            const terminalRaces = [];
            for (const window of ['proof-conflict', 'reserved-source']) {
                for (const actorKind of ['same-actor', 'different-actor']) {
                    const id = 'terminal_' + mode + '_' + window + '_' + actorKind;
                    const vector = await seed(id);
                    const code = vector.source.barcodes[0].code.toUpperCase();
                    const bUid = actorKind === 'same-actor' ? uid : uid + '_terminal';
                    const bEmail = actorKind === 'same-actor' ? email : 'terminal@zoew1.com';
                    fixture.registerFirebaseActor({ uid: bUid, email: bEmail, databaseURL: scope });
                    const bToken = fx.tokenFor(bEmail, { aud: project, claims: { sub: bUid, auth_time: authTime,
                        iat: Math.floor(Date.now() / 1000) } });
                    const bHeaders = { ...headers, 'x-zoe-id-token': bToken };
                    const terminalProof = () => localJSON('POST', origin + '/.netlify/functions/zto-restore-proof', {
                        v: 1, action: 'authorize', sourceId: id, token: 'terminal_token_' + id,
                        targetId: 'terminal_target_' + id, expectedGeneration: 0
                    }, bHeaders);
                    let release, reached, interceptions = 0;
                    const held = new Promise(resolve => { release = resolve; });
                    const barrier = new Promise(resolve => { reached = resolve; });
                    serviceInterceptor = async (url, init, transport) => {
                        const target = new URL(String(url));
                        let body; try { body = JSON.parse(init?.body || '{}'); } catch { body = {}; }
                        const match = init?.method === 'PUT' && (window === 'proof-conflict'
                            ? target.pathname === '/zoew_restore_attestations/' + id + '.json' && body.status === 'deny'
                            : target.pathname === '/zoew_recently_deleted_cod_dod/' + id + '.json'
                                && body.restoreClaim?.token === vector.claim.token && body.restoreBlocked !== true);
                        if (match && !interceptions) { interceptions++; reached(); await held; }
                        return transport(url, init);
                    };
                    const waitForBarrier = async () => {
                        let timer;
                        try { await Promise.race([barrier, new Promise((_, reject) => {
                            timer = setTimeout(() => reject(new Error('Terminal CAS control did not reach ' + window)), 10000);
                        })]); } finally { clearTimeout(timer); }
                    };
                    let aPending, bPending;
                    try {
                        let allowed, aResult, bResult;
                        if (window === 'proof-conflict') {
                            fixture.world.parcels.get(code).signedAt = stamp(Date.now() - 1);
                            bPending = terminalProof();
                            await waitForBarrier();
                            delete fixture.world.parcels.get(code).signedAt;
                            aResult = await proof(vector);
                            allowed = valueAt(await dump(), 'zoew_restore_attestations/' + id);
                            release(); bResult = await bPending;
                        } else {
                            aPending = proof(vector);
                            await waitForBarrier();
                            allowed = valueAt(await dump(), 'zoew_restore_attestations/' + id);
                            fixture.world.parcels.get(code).signedAt = stamp(Date.now() - 1);
                            bResult = await terminalProof();
                            release(); aResult = await aPending;
                        }
                        const label = mode + '/' + window + '/' + actorKind;
                        const ended = await dump(), grant = valueAt(ended, 'zoew_restore_attestations/' + id);
                        const source = valueAt(ended, 'zoew_recently_deleted_cod_dod/' + id);
                        const owner = value => Object.fromEntries(['id', 'token', 'targetId', 'actorUid', 'sessionId', 'authTime']
                            .map(key => [key, value?.[key] ?? null]));
                        check(interceptions === 1 && allowed?.status === 'allow' && allowed?.token === vector.claim.token,
                            label + ': controlled pause reached genuine A ALLOW reservation');
                        check((window === 'proof-conflict' ? aResult.status === 200 && aResult.value?.kind === 'allow'
                            : aResult.status === 409) && bResult.status === 200 && bResult.value?.kind === 'deny'
                            && bResult.value?.code === 'ZTO_RESTORE_TERMINAL_SIGNED', label + ': terminal B wins actual CAS interleaving', { a: aResult, b: bResult });
                        check(equal(owner(grant), owner(allowed)), label + ': terminal rebase retains A id/token/target/UID/authTime');
                        check(source?.restoreAttestationId === allowed?.id && source?.restoreClaim?.token === vector.claim.token
                            && source?.restoreClaim?.targetId === vector.claim.targetId && source?.restoreBlocked === true,
                        label + ': terminal source stays sealed to original A owner');
                        check(grant?.status === 'deny' && grant?.verdict === 'signed' && grant?.revision > allowed?.revision,
                            label + ': terminal proof monotonically supersedes A ALLOW');
                        const stale = await proof(vector);
                        check(stale.status === 200 && stale.value?.kind === 'deny' && stale.value?.code === 'ZTO_RESTORE_TERMINAL_SIGNED',
                            label + ': stale A cannot regain ALLOW after terminal observation', stale);
                        const afterStale = await dump(), afterGrant = valueAt(afterStale, 'zoew_restore_attestations/' + id);
                        check(afterGrant?.status === 'deny' && afterGrant?.verdict === 'signed' && equal(owner(afterGrant), owner(allowed))
                            && valueAt(afterStale, 'zoew_recently_deleted_cod_dod/' + id + '/restoreBlocked') === true,
                        label + ': stale request preserves terminal authority and original owner');
                        const prepare = await request('PUT', '/zoew_scan_history_cod_dod/' + vector.claim.targetId, vector.prepared, false, auth);
                        check(denied(prepare.status) && equal(afterStale, await dump()), label + ': terminal proof denies ordinary prepared write');
                        const final = await request('PATCH', '/', vector.finalPacket, false, auth);
                        check(denied(final.status) && equal(afterStale, await dump()), label + ': terminal proof denies ordinary financial finalize');
                        unchangedMoney(await dump(), vector, label);
                        terminalRaces.push({ window, actorKind, barrierInjections: interceptions, aStatus: aResult.status, bStatus: bResult.status,
                            terminalStatus: grant?.status, terminalVerdict: grant?.verdict, originalOwnerRetained: equal(owner(grant), owner(allowed)) });
                    } finally {
                        release(); serviceInterceptor = null;
                        if (aPending) await aPending.catch(() => {});
                        if (bPending) await bPending.catch(() => {});
                    }
                }
            }

            const reservationStart = pass + fail;
            const reservationRaces = [];
            for (const actorKind of ['same-actor', 'different-actor']) {
                const vector = await seed('resv_' + mode + '_' + actorKind);
                const id = vector.source.id;
                const bUid = actorKind === 'same-actor' ? uid : uid + '_reservation';
                const bEmail = actorKind === 'same-actor' ? email : 'reservation@zoew1.com';
                fixture.registerFirebaseActor({ uid: bUid, email: bEmail, databaseURL: scope });
                const bToken = fx.tokenFor(bEmail, { aud: project, claims: { sub: bUid, auth_time: authTime,
                    iat: Math.floor(Date.now() / 1000) } });
                const bHeaders = { ...headers, 'x-zoe-id-token': bToken };
                const bInput = { v: 1, action: 'authorize', sourceId: id, token: 'foreign_intent_' + id,
                    targetId: 'foreign_target_' + id, expectedGeneration: 0 };
                let release, reached, sourcePauses = 0, foreignPrivateWrites = 0, aPending;
                const held = new Promise(resolve => { release = resolve; });
                const barrier = new Promise(resolve => { reached = resolve; });
                serviceInterceptor = async (url, init, transport) => {
                    const target = new URL(String(url));
                    let body; try { body = JSON.parse(init?.body || '{}'); } catch { body = {}; }
                    if (init?.method === 'PUT' && target.pathname === '/zoew_recently_deleted_cod_dod/' + id + '.json'
                        && body.restoreClaim?.token === vector.claim.token && !sourcePauses) {
                        sourcePauses++; reached(); await held;
                    }
                    if (init?.method === 'PUT' && target.pathname === '/zoew_restore_attestations/' + id + '.json'
                        && body.status === 'allow' && body.token === bInput.token) {
                        foreignPrivateWrites++;
                        // Force B's context to see unsealed source, but its
                        // private write to follow A's actual successful source CAS.
                        release(); await aPending;
                    }
                    return transport(url, init);
                };
                try {
                    aPending = proof(vector);
                    let timer;
                    try { await Promise.race([barrier, new Promise((_, reject) => {
                        timer = setTimeout(() => reject(new Error('Reservation race did not reach actual source CAS')), 10000);
                    })]); } finally { clearTimeout(timer); }
                    const reserved = await dump(), grantA = valueAt(reserved, 'zoew_restore_attestations/' + id);
                    check(sourcePauses === 1 && grantA?.status === 'allow'
                        && valueAt(reserved, 'zoew_recently_deleted_cod_dod/' + id + '/restoreAttestationId') === null,
                    mode + '/' + actorKind + ': A private grant is committed while source publication is paused');
                    const bResult = await localJSON('POST', origin + '/.netlify/functions/zto-restore-proof', bInput, bHeaders);
                    release(); const aResult = await aPending;
                    const settled = await dump(), grant = valueAt(settled, 'zoew_restore_attestations/' + id);
                    const source = valueAt(settled, 'zoew_recently_deleted_cod_dod/' + id);
                    check(aResult.status === 200 && aResult.value?.kind === 'allow', mode + '/' + actorKind + ': original A finishes publication');
                    check(bResult.status === 409 && foreignPrivateWrites === 0,
                        mode + '/' + actorKind + ': B cannot replace an unpublished foreign intent', { status: bResult.status, foreignPrivateWrites });
                    check(grant?.id === grantA?.id && source?.restoreAttestationId === grantA?.id && grant?.token === vector.claim.token
                        && grant?.targetId === vector.claim.targetId && grant?.actorUid === uid && grant?.authTime === authTime * 1000,
                    mode + '/' + actorKind + ': source seal and private authority retain the same original A owner');
                    unchangedMoney(settled, vector, mode + '/' + actorKind + '/pending-reservation');
                    const resumed = await proof(vector);
                    check(resumed.status === 200 && resumed.value?.kind === 'allow' && resumed.value?.attestationId === grantA?.id,
                        mode + '/' + actorKind + ': A resumes its own published intent without permanent HOLD', resumed);
                    const prepared = await request('PUT', '/zoew_scan_history_cod_dod/' + vector.claim.targetId, vector.prepared, false, auth);
                    const finalized = await request('PATCH', '/', vector.finalPacket, false, auth);
                    const final = await dump();
                    check(prepared.status === 200 && finalized.status === 200, mode + '/' + actorKind + ': original intent still completes actual restore');
                    check(equal(valueAt(final, 'zoew_daily_revenue_cod_dod/' + vector.day), vector.money)
                        && equal(valueAt(final, 'zoew_monthly_revenue_cod_dod/' + vector.month), vector.money),
                    mode + '/' + actorKind + ': reservation race credits exact daily/monthly money and one package');
                    check(equal(valueAt(final, 'zoew_trash_consumptions/' + id), vector.consumption)
                        && equal(valueAt(final, 'zoew_restore_finalizations/' + id), vector.finalization)
                        && valueAt(final, 'zoew_scan_history_cod_dod/' + bInput.targetId) === null,
                    mode + '/' + actorKind + ': exactly one A receipt pair and no B target');
                    reservationRaces.push({ actorKind, sourcePauses, foreignPrivateWrites, aStatus: aResult.status, bStatus: bResult.status,
                        resumedStatus: resumed.status, preparedStatus: prepared.status, finalizedStatus: finalized.status });
                } finally {
                    release(); serviceInterceptor = null;
                    if (aPending) await aPending.catch(() => {});
                }
            }

            const finishReservation = async (vector, ownerAuth, label) => {
                const prepared = await request('PUT', '/zoew_scan_history_cod_dod/' + vector.claim.targetId, vector.prepared, false, ownerAuth);
                const finalized = await request('PATCH', '/', vector.finalPacket, false, ownerAuth);
                const final = await dump();
                check(prepared.status === 200 && finalized.status === 200, label + ': admitted owner completes actual prepare and finalize');
                check(equal(valueAt(final, 'zoew_daily_revenue_cod_dod/' + vector.day), vector.money)
                    && equal(valueAt(final, 'zoew_monthly_revenue_cod_dod/' + vector.month), vector.money), label + ': exact daily/monthly money and one package');
                check(equal(valueAt(final, 'zoew_trash_consumptions/' + vector.source.id), vector.consumption)
                    && equal(valueAt(final, 'zoew_restore_finalizations/' + vector.source.id), vector.finalization)
                    && valueAt(final, 'zoew_recently_deleted_cod_dod/' + vector.source.id) === null, label + ': one exact receipt pair consumes source');
                const replay = await request('PATCH', '/', vector.finalPacket, false, ownerAuth);
                check([200, 401, 403].includes(replay.status) && equal(final, await dump()), label + ': final packet replay has no second effect');
            };
            const crashedReservations = [];
            for (const profile of ['owner-resume', 'same-actor', 'different-actor', 'same-intent-new-login', 'latch-loss', 'terminal-after-latch']) {
                const vector = await seed('crash_' + mode + '_' + profile), id = vector.source.id;
                const foreignActor = ['different-actor', 'latch-loss', 'terminal-after-latch'].includes(profile);
                const bUid = foreignActor ? uid + '_reservation' : uid;
                const bEmail = foreignActor ? 'reservation@zoew1.com' : email;
                const bAuthTime = profile === 'same-intent-new-login' ? authTime + 1 : authTime;
                fixture.registerFirebaseActor({ uid: bUid, email: bEmail, databaseURL: scope });
                const bInput = { v: 1, action: 'authorize', sourceId: id,
                    token: profile === 'same-intent-new-login' ? vector.claim.token : 'crash_foreign_' + id,
                    targetId: profile === 'same-intent-new-login' ? vector.claim.targetId : 'crash_foreign_target_' + id, expectedGeneration: 0 };
                const bToken = fx.tokenFor(bEmail, { aud: project, claims: { sub: bUid, auth_time: bAuthTime, iat: Math.floor(Date.now() / 1000) } });
                const bRequest = () => localJSON('POST', origin + '/.netlify/functions/zto-restore-proof', bInput,
                    { ...headers, 'x-zoe-id-token': bToken });
                let lostPrivateResponses = 0, lostHoldResponses = 0, foreignPrivateWrites = 0;
                const holds = [];
                serviceInterceptor = async (url, init, transport) => {
                    let body; try { body = JSON.parse(init?.body || '{}'); } catch { body = {}; }
                    const privatePut = init?.method === 'PUT' && new URL(String(url)).pathname === '/zoew_restore_attestations/' + id + '.json';
                    if (privatePut && body.token === bInput.token && body.authTime === bAuthTime * 1000
                        && (bInput.token !== vector.claim.token || bAuthTime !== authTime)) foreignPrivateWrites++;
                    const response = await transport(url, init);
                    if (privatePut && body.token === vector.claim.token && !lostPrivateResponses && response.status === 200) {
                        lostPrivateResponses++; await response.arrayBuffer();
                        throw new Error('CONTROLLED_PRIVATE_COMMIT_RESPONSE_LOSS');
                    }
                    if (privatePut && body.status === 'hold' && body.recovery?.state === 'recovering' && response.status === 200) {
                        const tree = await dump();
                        holds.push({ grant: valueAt(tree, 'zoew_restore_attestations/' + id), source: valueAt(tree, 'zoew_recently_deleted_cod_dod/' + id),
                            providerReads: fixture.world.details + fixture.world.palmTracks });
                        if (['latch-loss', 'terminal-after-latch'].includes(profile) && !lostHoldResponses) {
                            lostHoldResponses++; await response.arrayBuffer();
                            throw new Error('CONTROLLED_HOLD_LATCH_RESPONSE_LOSS');
                        }
                    }
                    return response;
                };
                try {
                    const lost = await proof(vector), reserved = await dump();
                    const grantA = valueAt(reserved, 'zoew_restore_attestations/' + id);
                    const label = mode + '/crash-recovery/' + profile;
                    check(lost.status === 503 && lostPrivateResponses === 1, label + ': actual private commit loses response before source publication');
                    check(grantA?.status === 'allow' && grantA?.token === vector.claim.token
                        && equal(valueAt(reserved, 'zoew_recently_deleted_cod_dod/' + id), vector.source), label + ': crashed request retains reservation and exact unsealed source');
                    const refused = await bRequest();
                    check(refused.status === 409 && foreignPrivateWrites === 0 && equal(reserved, await dump()),
                        label + ': unexpired reservation never transfers to another intent or auth_time');
                    unchangedMoney(await dump(), vector, label);
                    if ((await request('PUT', '/zoew_restore_attestations/' + id + '/expiresAt', Date.now() - 1, true)).status !== 200)
                        throw new Error('Owned expired reservation setup failed');
                    const readsBefore = fixture.world.details + fixture.world.palmTracks;
                    if (profile === 'owner-resume') {
                        const resumed = await proof(vector), tree = await dump(), grant = valueAt(tree, 'zoew_restore_attestations/' + id);
                        check(resumed.status === 200 && resumed.value?.kind === 'allow' && resumed.value?.attestationId === grantA?.id,
                            label + ': exact owned intent resumes original reservation ID after crash and expiry');
                        check(fixture.world.details + fixture.world.palmTracks > readsBefore, label + ': owner resume verifies fresh provider state');
                        check(grant?.id === grantA?.id && grant?.actorUid === uid && grant?.authTime === authTime * 1000
                            && grant?.expiresAt > Date.now() && valueAt(tree, 'zoew_recently_deleted_cod_dod/' + id + '/restoreAttestationId') === grantA?.id,
                        label + ': recovered source and fresh authority retain original owner');
                        await finishReservation(vector, auth, label);
                    } else {
                        let recovered = await bRequest();
                        const hold = holds[0];
                        if (['latch-loss', 'terminal-after-latch'].includes(profile)) {
                            check(recovered.status === 503 && lostHoldResponses === 1, label + ': committed HOLD latch survives a second response loss');
                            check(hold?.grant?.status === 'hold' && hold?.grant?.id === grantA?.id && hold?.grant?.actorUid === uid
                                && hold?.grant?.authTime === authTime * 1000 && hold?.grant?.token === vector.claim.token
                                && hold?.grant?.recovery?.actorUid === bUid && equal(hold?.source, vector.source),
                            label + ': lost latch cannot transfer old owner or publish ALLOW');
                            if (profile === 'terminal-after-latch') fixture.world.parcels.get(vector.source.barcodes[0].code.toUpperCase()).signedAt = stamp(Date.now() - 1);
                            recovered = await bRequest();
                        } else {
                            check(hold?.grant?.status === 'hold' && hold?.grant?.id === grantA?.id && hold?.grant?.actorUid === uid
                                && hold?.grant?.authTime === authTime * 1000 && hold?.grant?.token === vector.claim.token
                                && hold?.grant?.targetId === vector.claim.targetId && hold?.grant?.recovery?.actorUid === bUid,
                            label + ': expired orphan first commits HOLD retaining original owner and intent');
                            check(equal(hold?.source, vector.source) && hold?.providerReads === readsBefore,
                                label + ': HOLD precedes source publication and new provider verification');
                        }
                        const tree = await dump(), grant = valueAt(tree, 'zoew_restore_attestations/' + id), source = valueAt(tree, 'zoew_recently_deleted_cod_dod/' + id);
                        if (profile === 'terminal-after-latch') {
                            check(recovered.status === 200 && recovered.value?.kind === 'deny' && recovered.value?.code === 'ZTO_RESTORE_TERMINAL_SIGNED',
                                label + ': resumed latch observes actual terminal Sign before any ALLOW');
                            check(grant?.status === 'deny' && grant?.verdict === 'signed' && grant?.id === grantA?.id && grant?.actorUid === uid
                                && grant?.token === vector.claim.token && source?.restoreBlocked === true && source?.restorePublication >= 1,
                            label + ': terminal recovery preserves original grant owner and permanent block');
                            const prepare = await request('PUT', '/zoew_scan_history_cod_dod/' + vector.claim.targetId, vector.prepared, false, auth);
                            const final = await request('PATCH', '/', vector.finalPacket, false, auth);
                            check(denied(prepare.status) && denied(final.status), label + ': even original owner cannot prepare or credit terminal source');
                            unchangedMoney(await dump(), vector, label);
                            const stale = await proof(vector);
                            check(stale.status === 200 && stale.value?.kind === 'deny', label + ': original intent cannot regain ALLOW after latch terminal');
                        } else {
                            check(recovered.status === 200 && recovered.value?.kind === 'allow'
                                && fixture.world.details + fixture.world.palmTracks > readsBefore,
                            label + ': recovery verifies fresh provider state before new owned ALLOW');
                            check(grant?.status === 'allow' && grant?.actorUid === bUid && grant?.authTime === bAuthTime * 1000
                                && grant?.token === bInput.token && grant?.targetId === bInput.targetId && grant?.expiresAt > Date.now()
                                && source?.restoreAttestationId === grant?.id && source?.restorePublication >= 2,
                            label + ': recovered B authority and source agree beyond durable settlement fence');
                            const next = structuredClone(vector);
                            next.claim.token = bInput.token; next.claim.targetId = bInput.targetId;
                            next.prepared.id = bInput.targetId; next.prepared.restoreClaimToken = bInput.token; next.live.id = bInput.targetId;
                            Object.assign(next.consumption, { actorUid: bUid, token: bInput.token, targetId: bInput.targetId });
                            Object.assign(next.finalization, { token: bInput.token, targetId: bInput.targetId });
                            delete next.finalPacket['zoew_scan_history_cod_dod/' + vector.claim.targetId];
                            next.finalPacket['zoew_scan_history_cod_dod/' + bInput.targetId] = next.live;
                            next.finalPacket['zoew_trash_consumptions/' + id] = next.consumption;
                            next.finalPacket['zoew_restore_finalizations/' + id] = next.finalization;
                            await finishReservation(next, { uid: bUid, token: { auth_time: bAuthTime, email: bEmail } }, label);
                        }
                    }
                    crashedReservations.push({ profile, lostPrivateResponses, lostHoldResponses, foreignPrivateWrites, initialStatus: lost.status,
                        unexpiredStatus: refused.status, recoveryLatches: holds.length });
                } finally { serviceInterceptor = null; }
            }

            const issuerLost = await seed('issuer_ack_' + mode);
            const proofPacket = { v: 1, action: 'authorize', sourceId: issuerLost.source.id, token: issuerLost.claim.token,
                targetId: issuerLost.claim.targetId, expectedGeneration: 0 };
            const proofDisconnected = await localJSON('POST', origin + '/drop-proof-ack', proofPacket, headers).then(() => false, () => true);
            const proofCommitted = await dump(), issued = valueAt(proofCommitted, 'zoew_restore_attestations/' + issuerLost.source.id);
            check(proofDisconnected && droppedProofAck?.status === 200 && droppedProofAck?.injections === (mode === 'palm' ? 1 : 2),
                mode + '/issuer-ACK: client socket loses response after actual issuer publication');
            check(issued?.status === 'allow' && issued?.token === issuerLost.claim.token
                && valueAt(proofCommitted, 'zoew_recently_deleted_cod_dod/' + issuerLost.source.id + '/restoreAttestationId') === issued?.id,
            mode + '/issuer-ACK: committed source seal and private proof agree');
            unchangedMoney(proofCommitted, issuerLost, mode + '/issuer-ACK');
            const readsBeforeProofRetry = fixture.world.details + fixture.world.palmTracks;
            const proofRetried = await proof(issuerLost);
            check(proofRetried.status === 200 && proofRetried.value?.kind === 'allow' && proofRetried.value?.attestationId === issued?.id,
                mode + '/issuer-ACK: same owned request recovers original published ID');
            check(fixture.world.details + fixture.world.palmTracks > readsBeforeProofRetry, mode + '/issuer-ACK: recovery rechecks provider instead of replaying old ALLOW');
            await finishReservation(issuerLost, auth, mode + '/issuer-ACK');

            const publicationRaces = [];
            for (const actorKind of ['same-actor', 'different-actor']) {
                const vector = await seed('aba_' + mode + '_' + actorKind), id = vector.source.id;
                const bUid = actorKind === 'same-actor' ? uid : uid + '_reservation';
                const bEmail = actorKind === 'same-actor' ? email : 'reservation@zoew1.com';
                fixture.registerFirebaseActor({ uid: bUid, email: bEmail, databaseURL: scope });
                const bToken = fx.tokenFor(bEmail, { aud: project, claims: { sub: bUid, auth_time: authTime, iat: Math.floor(Date.now() / 1000) } });
                const bVector = structuredClone(vector);
                bVector.claim.token = 'aba_next_' + id; bVector.claim.targetId = 'aba_next_target_' + id;
                bVector.prepared.id = bVector.claim.targetId; bVector.prepared.restoreClaimToken = bVector.claim.token;
                bVector.live.id = bVector.claim.targetId;
                Object.assign(bVector.consumption, { actorUid: bUid, token: bVector.claim.token, targetId: bVector.claim.targetId });
                Object.assign(bVector.finalization, { token: bVector.claim.token, targetId: bVector.claim.targetId });
                delete bVector.finalPacket['zoew_scan_history_cod_dod/' + vector.claim.targetId];
                bVector.finalPacket['zoew_scan_history_cod_dod/' + bVector.claim.targetId] = bVector.live;
                bVector.finalPacket['zoew_trash_consumptions/' + id] = bVector.consumption;
                bVector.finalPacket['zoew_restore_finalizations/' + id] = bVector.finalization;
                let release, reached, releaseNext, reachedNext, sourcePauses = 0, nextSourcePauses = 0, staleSourceStatus = null, aPending, nextPending;
                const held = new Promise(resolve => { release = resolve; });
                const barrier = new Promise(resolve => { reached = resolve; });
                const nextHeld = new Promise(resolve => { releaseNext = resolve; });
                const nextBarrier = new Promise(resolve => { reachedNext = resolve; });
                serviceInterceptor = async (url, init, transport) => {
                    let body; try { body = JSON.parse(init?.body || '{}'); } catch { body = {}; }
                    if (init?.method === 'PUT' && new URL(String(url)).pathname === '/zoew_recently_deleted_cod_dod/' + id + '.json'
                        && body.restoreClaim?.token === vector.claim.token && !sourcePauses) {
                        sourcePauses++; reached(); await held;
                        const response = await transport(url, init); staleSourceStatus = response.status; return response;
                    }
                    if (init?.method === 'PUT' && new URL(String(url)).pathname === '/zoew_recently_deleted_cod_dod/' + id + '.json'
                        && body.restoreClaim?.token === bVector.claim.token && !nextSourcePauses) {
                        nextSourcePauses++; reachedNext(); await nextHeld;
                    }
                    return transport(url, init);
                };
                try {
                    aPending = proof(vector);
                    let timer;
                    try { await Promise.race([barrier, new Promise((_, reject) => {
                        timer = setTimeout(() => reject(new Error('Publication ABA did not reach first source CAS')), 10000);
                    })]); } finally { clearTimeout(timer); }
                    const initial = await dump(), firstGrant = valueAt(initial, 'zoew_restore_attestations/' + id);
                    const label = mode + '/publication-ABA/' + actorKind;
                    check(sourcePauses === 1 && firstGrant?.status === 'allow'
                        && valueAt(initial, 'zoew_recently_deleted_cod_dod/' + id + '/restoreAttestationId') === null,
                    label + ': original source CAS is paused after actual private reservation');
                    const legacyInject = await request('PUT', '/zoew_recently_deleted_cod_dod/' + id + '/restorePublication', 1, false, auth);
                    check(denied(legacyInject.status) && equal(initial, await dump()), label + ': client cannot inject publication into legacy absent-zero source');
                    const own = await proof(vector), published = await dump();
                    const pubA = valueAt(published, 'zoew_recently_deleted_cod_dod/' + id + '/restorePublication');
                    check(own.status === 200 && own.value?.kind === 'allow' && own.value?.attestationId === firstGrant?.id
                        && Number.isSafeInteger(pubA) && pubA >= 1, label + ': owned retry publishes the same reservation with durable counter');
                    const released = await proof(vector, 'release'), releasedTree = await dump();
                    const releasedSource = valueAt(releasedTree, 'zoew_recently_deleted_cod_dod/' + id), pubRelease = releasedSource?.restorePublication;
                    check(released.status === 200 && released.value?.kind === 'released' && Number.isSafeInteger(pubRelease) && pubRelease > pubA
                        && !releasedSource?.restoreClaim && !releasedSource?.restoreAttestationId,
                    label + ': release retains a strictly newer publication fence after removing seal');
                    for (const bad of [(Number.isSafeInteger(pubRelease) ? pubRelease : 0) + 1, null, 0, '1', Number.MAX_SAFE_INTEGER + 1, -1]) {
                        const before = await dump();
                        const tampered = await request('PUT', '/zoew_recently_deleted_cod_dod/' + id + '/restorePublication', bad, false, auth);
                        const whole = { ...releasedSource };
                        if (bad === null) delete whole.restorePublication; else whole.restorePublication = bad;
                        const wholeTampered = await request('PUT', '/zoew_recently_deleted_cod_dod/' + id, whole, false, auth);
                        check(denied(tampered.status) && denied(wholeTampered.status) && equal(before, await dump()),
                            label + ': leaf and whole-row client cannot change/clear publication ' + JSON.stringify(bad));
                    }
                    const unchanged = await request('PUT', '/zoew_recently_deleted_cod_dod/' + id, releasedSource, false, auth);
                    check(unchanged.status === 200 && equal(releasedTree, await dump()), label + ': unchanged released source remains writable without clearing fence');
                    nextPending = localJSON('POST', origin + '/.netlify/functions/zto-restore-proof', { v: 1, action: 'authorize', sourceId: id,
                        token: bVector.claim.token, targetId: bVector.claim.targetId, expectedGeneration: 0 }, { ...headers, 'x-zoe-id-token': bToken });
                    let nextTimer;
                    try { await Promise.race([nextBarrier, nextPending, new Promise((_, reject) => {
                        nextTimer = setTimeout(() => reject(new Error('Next publication did not reach source CAS or return')), 10000);
                    })]); } finally { clearTimeout(nextTimer); }
                    const beforeOld = await dump();
                    release(); const old = await aPending;
                    check(staleSourceStatus === 412 && old.status === 409 && equal(beforeOld, await dump()),
                        label + ': original pre-release source request loses actual ETag CAS and changes nothing');
                    releaseNext(); const next = await nextPending;
                    const afterNext = await dump(), newGrant = valueAt(afterNext, 'zoew_restore_attestations/' + id);
                    const newSource = valueAt(afterNext, 'zoew_recently_deleted_cod_dod/' + id);
                    check(nextSourcePauses === 1 && next.status === 200 && next.value?.kind === 'allow' && newGrant?.token === bVector.claim.token
                        && newGrant?.actorUid === bUid && newSource?.restoreAttestationId === newGrant?.id && newSource?.restorePublication > pubRelease,
                    label + ': next owned intent publishes consistent B authority beyond release fence');
                    const oldRetry = await proof(vector);
                    check(oldRetry.status === 409 && equal(afterNext, await dump()), label + ': stale A cannot rearm after B publication');
                    unchangedMoney(await dump(), vector, label);
                    await finishReservation(bVector, { uid: bUid, token: { auth_time: authTime, email: bEmail } }, label);
                    publicationRaces.push({ actorKind, sourcePauses, firstStatus: own.status, releaseStatus: released.status,
                        nextStatus: next.status, staleSourceStatus, staleIssuerStatus: old.status, publicationA: pubA, publicationRelease: pubRelease,
                        publicationB: newSource?.restorePublication });
                } finally {
                    release(); releaseNext(); serviceInterceptor = null;
                    if (aPending) await aPending.catch(() => {});
                    if (nextPending) await nextPending.catch(() => {});
                }
            }
            const reservationChecks = pass + fail - reservationStart;

            const releasedTerminalStart = pass + fail, releasedTerminalCases = [];
            for (const terminal of ['signed', 'returned']) {
                const vector = await seed('released_' + mode + '_' + terminal), id = vector.source.id;
                const issued = await issue(vector);
                const released = await proof(vector, 'release'), beforeTerminal = await dump();
                const heldGrant = valueAt(beforeTerminal, 'zoew_restore_attestations/' + id);
                const releasedSource = valueAt(beforeTerminal, 'zoew_recently_deleted_cod_dod/' + id);
                const label = mode + '/released-terminal/' + terminal;
                check(released.status === 200 && released.value?.kind === 'released' && heldGrant?.status === 'hold',
                    label + ': unsigned ALLOW releases into actual private HOLD');
                check(!releasedSource?.restoreAttestationId && !releasedSource?.restoreClaim && releasedSource?.restorePublication === 2,
                    label + ': release keeps publication fence without a source claim');
                const code = vector.source.barcodes[0].code.toUpperCase(), eventAt = stamp(Date.now() - 1000);
                const observerUid = uid + '_released', observerEmail = 'released@zoew1.com';
                fixture.registerFirebaseActor({ uid: observerUid, email: observerEmail, databaseURL: scope });
                const observerToken = fx.tokenFor(observerEmail, { aud: project, claims: { sub: observerUid, auth_time: authTime + 1,
                    iat: Math.floor(Date.now() / 1000) } });
                const observedInput = { v: 1, action: 'authorize', sourceId: id, token: 'observed_' + id,
                    targetId: 'observed_target_' + id, expectedGeneration: 0 };
                const observerHeaders = { ...headers, 'x-zoe-id-token': observerToken };
                const observe = (generation = 0) => localJSON('POST', origin + '/.netlify/functions/zto-restore-proof',
                    { ...observedInput, expectedGeneration: generation }, observerHeaders);
                const provider = global.fetch;
                let returnScans = 0;
                if (terminal === 'signed') fixture.world.parcels.get(code).signedAt = eventAt;
                else global.fetch = async (url, init) => {
                    const response = await provider(url, init), target = new URL(String(url));
                    let body; try { body = JSON.parse(init?.body || '{}'); } catch { body = {}; }
                    if (mode === 'palm' && target.hostname === 'aargus-api.ztoglobal.net'
                        && target.pathname === '/zto/locus/v1/queryTrackInfo' && body.mailNos === code) {
                        const data = await response.json();
                        data.result[0].tracks.unshift({ mailNo: code, actionName: 'scan', action: '-710', siteCode: '1', time: eventAt });
                        returnScans++; return Response.json(data, { status: response.status });
                    }
                    if (mode === 'cookie' && target.hostname === 'aargus-api.ztoglobal.com' && body.condition?.scanTypeCode === '-710'
                        && body.condition?.scanSiteCode === '1' && body.condition?.mailNos?.includes(code)) {
                        await response.arrayBuffer(); returnScans++;
                        return Response.json({ success: true, data: { result: [{ scanBillCode: code, scanTypeCode: '-710', scanTime: eventAt,
                            scanSiteCode: '1' }], total: 1, pages: 1, pageNum: 1, pageSize: 100 } });
                    }
                    return response;
                };
                try {
                    const deniedProof = await observe(), terminalTree = await dump();
                    const grant = valueAt(terminalTree, 'zoew_restore_attestations/' + id);
                    const source = valueAt(terminalTree, 'zoew_recently_deleted_cod_dod/' + id);
                    check(deniedProof.status === 200 && deniedProof.value?.kind === 'deny'
                        && deniedProof.value?.code === 'ZTO_RESTORE_TERMINAL_' + terminal.toUpperCase()
                        && (terminal !== 'returned' || returnScans === 1), label + ': fresh raw provider terminal verdict is persisted');
                    check(grant?.status === 'deny' && grant?.verdict === terminal && grant?.id === issued.grant.id
                        && grant?.token === vector.claim.token && grant?.targetId === vector.claim.targetId
                        && grant?.actorUid === uid && grant?.authTime === authTime * 1000,
                    label + ': observer persists DENY under the original owner and intent');
                    check(!source?.restoreAttestationId && !source?.restoreClaim && source?.restorePublication > releasedSource?.restorePublication
                        && (terminal === 'signed' ? source?.restoreBlocked === true : source?.restoreBlocked !== true),
                    label + ': terminal publication advances without recreating a claim or false Sign flag');
                    global.fetch = provider; delete fixture.world.parcels.get(code).signedAt;
                    const readsBefore = fixture.world.details + fixture.world.palmTracks;
                    const repeated = await observe();
                    check(repeated.status === 200 && repeated.value?.kind === 'deny'
                        && repeated.value?.code === 'ZTO_RESTORE_TERMINAL_' + terminal.toUpperCase()
                        && fixture.world.details + fixture.world.palmTracks === readsBefore,
                    label + ': unsigned retry keeps durable terminal denial without a new provider read');
                    const own = await proof(vector), sticky = await dump(), stickyGrant = valueAt(sticky, 'zoew_restore_attestations/' + id);
                    check(own.status === 200 && own.value?.kind === 'deny' && stickyGrant?.id === issued.grant.id
                        && stickyGrant?.actorUid === uid && stickyGrant?.revision > grant?.revision
                        && !valueAt(sticky, 'zoew_recently_deleted_cod_dod/' + id + '/restoreClaim'),
                    label + ': original owner retry cannot remove sticky denial or recreate claim');
                    const wrongGeneration = await observe(1);
                    check(wrongGeneration.status === 409 && equal(sticky, await dump()), label + ': wrong-generation retry cannot mutate terminal source');
                    const prepared = await request('PUT', '/zoew_scan_history_cod_dod/' + vector.claim.targetId, vector.prepared, false, auth);
                    const finalized = await request('PATCH', '/', vector.finalPacket, false, auth);
                    check(denied(prepared.status) && denied(finalized.status) && equal(sticky, await dump()),
                        label + ': ordinary owner cannot prepare or finalize released terminal source');
                    unchangedMoney(await dump(), vector, label);
                    releasedTerminalCases.push({ terminal, releaseStatus: released.status, terminalStatus: deniedProof.status,
                        repeatedStatus: repeated.status, originalRetryStatus: own.status, wrongGenerationStatus: wrongGeneration.status, returnScans });
                } finally { global.fetch = provider; delete fixture.world.parcels.get(code).signedAt; }
            }
            const releasedTerminalChecks = pass + fail - releasedTerminalStart;

            const enumStart = pass + fail, terminalEnumCases = [];
            for (const terminal of ['signed', 'returned']) {
                const vector = await seed('enum_' + mode + '_' + terminal), id = vector.source.id;
                const issued = await issue(vector), code = vector.source.barcodes[0].code.toUpperCase();
                const eventMs = Math.floor((Date.now() - 1000) / 1000) * 1000, eventAt = stamp(eventMs);
                const provider = global.fetch;
                let returnScans = 0;
                if (terminal === 'signed') fixture.world.parcels.get(code).signedAt = eventAt;
                else global.fetch = async (url, init) => {
                    const response = await provider(url, init), target = new URL(String(url));
                    let body; try { body = JSON.parse(init?.body || '{}'); } catch { body = {}; }
                    if (mode === 'palm' && target.hostname === 'aargus-api.ztoglobal.net'
                        && target.pathname === '/zto/locus/v1/queryTrackInfo' && body.mailNos === code) {
                        const data = await response.json();
                        data.result[0].tracks.unshift({ mailNo: code, actionName: 'scan', action: '-710', siteCode: '1', time: eventAt });
                        returnScans++; return Response.json(data, { status: response.status });
                    }
                    if (mode === 'cookie' && target.hostname === 'aargus-api.ztoglobal.com' && body.condition?.scanTypeCode === '-710'
                        && body.condition?.scanSiteCode === '1' && body.condition?.mailNos?.includes(code)) {
                        await response.arrayBuffer(); returnScans++;
                        return Response.json({ success: true, data: { result: [{ scanBillCode: code, scanTypeCode: '-710', scanTime: eventAt,
                            scanSiteCode: '1' }], total: 1, pages: 1, pageNum: 1, pageSize: 100 } });
                    }
                    return response;
                };
                let decision;
                try { decision = await proof(vector, 'refresh'); }
                finally { global.fetch = provider; delete fixture.world.parcels.get(code).signedAt; }
                const decided = await dump(), decidedSource = valueAt(decided, 'zoew_recently_deleted_cod_dod/' + id);
                const label = mode + '/terminal-enum/' + terminal;
                check(decision.status === 200 && decision.value?.kind === 'deny' && decidedSource?.ztoTerminalDecision === terminal
                    && decidedSource?.trashReason === vector.source.trashReason && decidedSource?.cod === vector.source.cod
                    && decidedSource?.dod === vector.source.dod && decidedSource?.count === vector.source.count
                    && decidedSource?.barcodes?.[0]?.isDeducted === true && !decidedSource?.barcodes?.[0]?.ztoSignedAt
                    && !decidedSource?.barcodes?.[0]?.ztoReturnedAt && (terminal !== 'returned' || returnScans === 1),
                label + ': real terminal CAS records status without changing financial reason, money or fabricating provider times');
                const release = await proof(vector, 'release'), releasedTree = await dump();
                let source = valueAt(releasedTree, 'zoew_recently_deleted_cod_dod/' + id);
                check(release.status === 200 && release.value?.kind === 'released' && source?.ztoTerminalDecision === terminal
                    && source?.trashReason === vector.source.trashReason && source?.restorePublication > decidedSource?.restorePublication
                    && !source?.restoreClaim && !source?.restoreAttestationId,
                label + ': explicit terminal release retains status and advances fence without claim');
                const echo = await request('PUT', '/zoew_recently_deleted_cod_dod/' + id, source, false, auth);
                check(echo.status === 200 && equal(releasedTree, await dump()), label + ': unchanged whole-row update preserves enum and remains permitted');
                for (const bad of [terminal === 'signed' ? 'returned' : 'signed', null, 'unknown', '', 0, {}]) {
                    const before = await dump();
                    const leaf = await request('PUT', '/zoew_recently_deleted_cod_dod/' + id + '/ztoTerminalDecision', bad, false, auth);
                    const whole = { ...source };
                    if (bad === null) delete whole.ztoTerminalDecision; else whole.ztoTerminalDecision = bad;
                    const row = await request('PUT', '/zoew_recently_deleted_cod_dod/' + id, whole, false, auth);
                    check(denied(leaf.status) && denied(row.status) && equal(before, await dump()),
                        label + ': ordinary leaf/whole update cannot change or remove terminal enum ' + JSON.stringify(bad));
                }
                // Explicit operator/test setup exercises the LOCAL eligibility branch;
                // the genuine server decision is retained and the whole fixture restored.
                const beforeLocal = await dump();
                if ((await request('PUT', '/zoew_restore_policy/shop/mode', 'local', true)).status !== 200
                    || (await request('PUT', '/zoew_recently_deleted_cod_dod/' + id + '/trashMode', 'local', true)).status !== 200)
                    throw new Error('Owned local-policy terminal setup failed');
                const localBefore = await dump();
                try {
                    const claim = await request('PUT', '/zoew_recently_deleted_cod_dod/' + id + '/restoreClaim', vector.claim, false, auth);
                    const prepare = await request('PUT', '/zoew_scan_history_cod_dod/' + vector.claim.targetId, vector.prepared, false, auth);
                    const final = await request('PATCH', '/', vector.finalPacket, false, auth);
                    check(denied(claim.status) && denied(prepare.status) && denied(final.status) && equal(localBefore, await dump()),
                        label + ': switching to LOCAL cannot claim, prepare or credit an authoritative terminal source');
                } finally {
                    if ((await request('PUT', '/', beforeLocal, true)).status !== 200) throw new Error('Owned local-policy fixture restore failed');
                }
                const enriched = structuredClone(source);
                enriched.barcodes[0][terminal === 'signed' ? 'ztoSignedAt' : 'ztoReturnedAt'] = eventMs;
                if (terminal === 'signed') enriched.restoreBlocked = true;
                const backfill = await request('PUT', '/zoew_recently_deleted_cod_dod/' + id, enriched, false, auth);
                check(backfill.status === 200 && valueAt(await dump(), 'zoew_recently_deleted_cod_dod/' + id + '/ztoTerminalDecision') === terminal,
                    label + ': normal positive status backfill preserves enum and publication');
                const reconciled = await proof(vector), reconciledTree = await dump();
                source = valueAt(reconciledTree, 'zoew_recently_deleted_cod_dod/' + id);
                check(reconciled.status === 200 && reconciled.value?.kind === 'deny' && source?.ztoTerminalDecision === terminal
                    && source?.trashReason === vector.source.trashReason, label + ': real issuer reconciles allowed status enrichment without changing reason');
                const later = structuredClone(source);
                if (terminal === 'signed') later.barcodes[0].ztoReturnedAt = Date.now() - 1;
                else { later.barcodes[0].ztoSignedAt = Date.now() - 1; later.restoreBlocked = true; }
                const laterStatus = await request('PUT', '/zoew_recently_deleted_cod_dod/' + id, later, false, auth);
                check(laterStatus.status === 200 && valueAt(await dump(), 'zoew_recently_deleted_cod_dod/' + id + '/ztoTerminalDecision') === terminal,
                    label + ': later client status preserves the server-owned decision until issuer reconciliation');
                const signed = await proof(vector), signedTree = await dump();
                source = valueAt(signedTree, 'zoew_recently_deleted_cod_dod/' + id);
                check(signed.status === 200 && signed.value?.kind === 'deny' && signed.value?.code === 'ZTO_RESTORE_TERMINAL_SIGNED'
                    && source?.ztoTerminalDecision === 'signed' && source?.trashReason === vector.source.trashReason,
                label + ': Signed outranks later Return and promotes an earlier Returned decision');
                unchangedMoney(signedTree, vector, label);

                // A completed prior purge and a genuinely new package lifecycle are
                // privileged fixture setup, not a claim that this test ran purge UI.
                const born = Math.floor(Date.now() / 1000) * 1000, next = attestedRestoreVector(mode, id, uid, scope);
                const nextCode = 'CYCLE_' + mode + '_' + terminal, nextDeletedAt = Date.now();
                next.source.createdAt = born; next.source.deletedAt = nextDeletedAt; next.source.trashGeneration = 1;
                next.source.barcodes[0].createdAt = born; next.source.barcodes[0].code = nextCode;
                next.claim.token = 'cycle_' + id; next.claim.targetId = 'cycle_target_' + id;
                next.prepared.id = next.claim.targetId; next.prepared.createdAt = born; next.prepared.restoreClaimToken = next.claim.token;
                next.prepared.barcodes[0].createdAt = born; next.prepared.barcodes[0].code = nextCode;
                next.live.id = next.claim.targetId; next.live.createdAt = born; next.live.barcodes[0].createdAt = born; next.live.barcodes[0].code = nextCode;
                Object.assign(next.consumption, { generation: 1, deletedAt: nextDeletedAt, rowBirth: born, token: next.claim.token, targetId: next.claim.targetId });
                Object.assign(next.finalization, { token: next.claim.token, targetId: next.claim.targetId });
                delete next.finalPacket['zoew_scan_history_cod_dod/' + vector.claim.targetId];
                next.finalPacket['zoew_scan_history_cod_dod/' + next.claim.targetId] = next.live;
                next.finalPacket['zoew_trash_consumptions/' + id] = next.consumption;
                next.finalPacket['zoew_restore_finalizations/' + id] = next.finalization;
                const cycleSetup = { ['zoew_recently_deleted_cod_dod/' + id]: next.source,
                    ['zoew_trash_consumptions/' + id]: { v: 1, sourceId: id, generation: 0, kind: 'purge', actorUid: uid, scope,
                        deletedAt: vector.source.deletedAt, rowBirth: vector.source.createdAt },
                    ['zoew_barcode_registry/' + nextCode.toUpperCase()]: true };
                if ((await request('PATCH', '/', cycleSetup, true)).status !== 200) throw new Error('Owned next-cycle fixture setup failed');
                fixture.world.parcels.set(nextCode.toUpperCase(), { site: '1', phone: next.source.phone, arrivedAt: stamp(born) });
                const cycleBefore = await dump(), injectionStatuses = [];
                for (const tag of ['signed', 'returned']) {
                    injectionStatuses.push((await request('PUT', '/zoew_recently_deleted_cod_dod/' + id + '/ztoTerminalDecision', tag, false, auth)).status);
                    injectionStatuses.push((await request('PUT', '/zoew_recently_deleted_cod_dod/' + id, { ...next.source, ztoTerminalDecision: tag }, false, auth)).status);
                }
                check(injectionStatuses.every(denied) && equal(cycleBefore, await dump()), label + ': client cannot inject either server decision into a new lifecycle');
                const newProof = await localJSON('POST', origin + '/.netlify/functions/zto-restore-proof', { v: 1, action: 'authorize', sourceId: id,
                    token: next.claim.token, targetId: next.claim.targetId, expectedGeneration: 1 }, headers);
                const cycleTree = await dump(), cycleSource = valueAt(cycleTree, 'zoew_recently_deleted_cod_dod/' + id);
                check(newProof.status === 200 && newProof.value?.kind === 'allow' && cycleSource?.trashGeneration === 1
                    && !Object.hasOwn(cycleSource, 'ztoTerminalDecision'), label + ': genuine new-generation package does not inherit prior terminal enum');
                const injectedHistory = await request('PUT', '/zoew_scan_history_cod_dod/' + next.claim.targetId,
                    { ...next.prepared, ztoTerminalDecision: 'signed' }, false, auth);
                check(denied(injectedHistory.status) && equal(cycleTree, await dump()), label + ': otherwise-admitted history rejects copied server terminal field');
                const prepared = await request('PUT', '/zoew_scan_history_cod_dod/' + next.claim.targetId, next.prepared, false, auth);
                const finalized = await request('PATCH', '/', next.finalPacket, false, auth), finalTree = await dump();
                check(prepared.status === 200 && finalized.status === 200, label + ': clean new-cycle package restores through real ordinary rules');
                const history = valueAt(finalTree, 'zoew_scan_history_cod_dod/' + next.claim.targetId);
                check(history?.barcodes?.[0]?.code === nextCode && !Object.hasOwn(history, 'ztoTerminalDecision')
                    && !Object.hasOwn(history, 'restorePublication') && equal(valueAt(finalTree, 'zoew_trash_consumptions/' + id), next.consumption)
                    && equal(valueAt(finalTree, 'zoew_restore_finalizations/' + id), next.finalization), label + ': restored history is clean and one exact generation1 receipt pair remains');
                check(equal(valueAt(finalTree, 'zoew_daily_revenue_cod_dod/' + next.day), next.money)
                    && equal(valueAt(finalTree, 'zoew_monthly_revenue_cod_dod/' + next.month), next.money), label + ': new-cycle financial effect is exact and occurs once');
                const replay = await request('PATCH', '/', next.finalPacket, false, auth);
                check([200, 401, 403].includes(replay.status) && equal(finalTree, await dump()), label + ': new-cycle replay has no duplicate status or financial effect');
                terminalEnumCases.push({ terminal, terminalStatus: decision.status, releasedStatus: release.status,
                    enrichedStatus: backfill.status, signedPrecedenceStatus: signed.status, newGenerationStatus: newProof.status,
                    preparedStatus: prepared.status, finalizedStatus: finalized.status });
            }
            const terminalEnumChecks = pass + fail - enumStart;

            const lost = await seed('lost_ack_' + mode);
            await issue(lost);
            const beforeLost = await request('PUT', '/zoew_scan_history_cod_dod/' + lost.claim.targetId, lost.prepared, false, auth);
            if (beforeLost.status !== 200) throw new Error('Lost-ACK setup did not prepare actual history');
            const dropped = await localJSON('POST', origin + '/drop-final-ack', { packet: lost.finalPacket, auth }).then(() => false, () => true);
            const committed = await dump();
            check(dropped && droppedAck?.status === 200 && droppedAck?.injections === (mode === 'palm' ? 1 : 2), mode + ': real client socket lost ACK only after emulator commit');
            const callsBefore = fixture.world.details + fixture.world.palmTracks;
            const recovered = await proof(lost);
            check(recovered.status === 200 && recovered.value?.kind === 'already_applied' && recovered.value?.source === null && equal(committed, await dump())
                && fixture.world.details + fixture.world.palmTracks === callsBefore, mode + ': same operation recovers committed result without upstream or financial replay');
            check(equal(valueAt(committed, 'zoew_daily_revenue_cod_dod/' + lost.day), lost.money)
                && equal(valueAt(committed, 'zoew_monthly_revenue_cod_dod/' + lost.month), lost.money)
                && equal(valueAt(committed, 'zoew_trash_consumptions/' + lost.source.id), lost.consumption)
                && equal(valueAt(committed, 'zoew_restore_finalizations/' + lost.source.id), lost.finalization), mode + ': lost ACK retains one exact money/count/full-receipt effect');
            details.push({ mode, invokedProductionController: true, authentication: 'Controlled Google RSA/OAuth/account lookup; no live credentials',
                upstream: 'Existing controlled Cookie/Palm provider fixture', database: 'Actual owned RTDB emulator with canonical rules',
                invalidGrantCases: invalidResults, invalidPolicyCases: invalidPolicies, terminalRaces, reservationRaces, crashedReservations, publicationRaces,
                reservationChecks, releasedTerminalCases, releasedTerminalChecks, terminalEnumCases, terminalEnumChecks, validFinalizeStatus: finalized.status,
                exactPacketReplay: { status: replay.status, databaseChanged: !equal(afterReplay, finalTree) }, lostAckServerCommit: droppedAck.status });
        }
        return { checks: pass + fail - startChecks, details,
            upstreamReads: { cookie: fixture.world.details, cookieScans: fixture.world.lists, palm: fixture.world.palmTracks },
            droppedAckInjections: droppedAck?.injections || 0, droppedProofAckInjections: droppedProofAck?.injections || 0,
            reservationChecks: details.reduce((sum, detail) => sum + detail.reservationChecks, 0),
            releasedTerminalChecks: details.reduce((sum, detail) => sum + detail.releasedTerminalChecks, 0),
            terminalEnumChecks: details.reduce((sum, detail) => sum + detail.terminalEnumChecks, 0) };
    } finally {
        server.closeAllConnections();
        await new Promise(resolve => server.close(resolve));
        fixture.close();
        global.fetch = realTransport;
    }
}

(async () => {
    const inputs = inputFingerprints();
    const rules = JSON.parse(fs.readFileSync(path.join(ROOT, 'firebase-database.rules.json'), 'utf8'));
    for (const mode of ['palm', 'cookie', 'local']) {
        namespace = emuNamespace('demo-restore-attestation-' + mode);
        const installed = await request('PUT', '/.settings/rules', rules, true);
        if (installed.status !== 200) throw new Error('Canonical rules installation failed');
        const vector = legacyRestoreVector(mode, 'missing_proof_' + mode, actor);
        const zero = { codDollar: 0, dodDollar: 0, totalCount: 0 };
        const seed = { zoew_restore_policy: { shop: { v: 1, mode, scope: 'qa_restore_attestation', branch: '000001', epoch: 1 } },
            zoew_recently_deleted_cod_dod: { [vector.source.id]: vector.source },
            zoew_daily_revenue_cod_dod: { [vector.day]: zero }, zoew_monthly_revenue_cod_dod: { [vector.month]: zero } };
        if ((await request('PUT', '/', seed, true)).status !== 200) throw new Error('Owned fixture seed failed');
        const forged = await request('PUT', '/zoew_restore_attestations/client_forgery', { v: 1, actorUid: actor, allow: true });
        const policyEdit = await request('PUT', '/zoew_restore_policy/shop/mode', 'local');
        check(forged.status === 401 || forged.status === 403, mode + ': ordinary client cannot create a trusted grant', forged.status);
        check(policyEdit.status === 401 || policyEdit.status === 403, mode + ': ordinary client cannot downgrade trusted mode', policyEdit.status);
        // auth_variable_override makes these ordinary authenticated rules requests;
        // administrator writes above never represent the attack or a successful restore.
        const claimed = await request('PUT', '/zoew_recently_deleted_cod_dod/' + vector.source.id + '/restoreClaim', vector.claim);
        const prepared = await request('PUT', '/zoew_scan_history_cod_dod/' + vector.claim.targetId, vector.prepared);
        const finalized = await request('PATCH', '/', vector.finalPacket);
        const tree = (await request('GET', '/', undefined, true)).value;
        const replay = await request('PATCH', '/', vector.finalPacket);
        const treeAfterReplay = (await request('GET', '/', undefined, true)).value;
        const daily = valueAt(tree, 'zoew_daily_revenue_cod_dod/' + vector.day);
        const monthly = valueAt(tree, 'zoew_monthly_revenue_cod_dod/' + vector.month);
        const trash = valueAt(tree, 'zoew_recently_deleted_cod_dod/' + vector.source.id);
        const history = valueAt(tree, 'zoew_scan_history_cod_dod/' + vector.claim.targetId);
        const consumption = valueAt(tree, 'zoew_trash_consumptions/' + vector.source.id);
        const finalization = valueAt(tree, 'zoew_restore_finalizations/' + vector.source.id);
        observations.push({ mode, invokedUpstreamVerifier: false, claimStatus: claimed.status, prepareStatus: prepared.status,
            finalizeStatus: finalized.status, replayStatus: replay.status, daily, monthly, trash, history, consumption, finalization,
            replayChangedDatabase: !equal(tree, treeAfterReplay),
            trustedBusinessAudit: 'Not asserted: optional Firebase audit Functions are not running in this owned rules scope.' });
        check(equal(tree, treeAfterReplay), mode + ': replay has no second database or financial effect');
        if (mode === 'local') {
            check(claimed.status === 200 && prepared.status === 200 && finalized.status === 200,
                'Sheet: explicit trusted local policy preserves existing restore', [claimed.status, prepared.status, finalized.status]);
            check(equal(daily, vector.money) && equal(monthly, vector.money), 'Sheet: exact daily/monthly money and package count');
            check(trash === null && history?.barcodes?.[0]?.code === vector.source.barcodes[0].code, 'Sheet: source removed and target barcode retained');
            check(equal(consumption, vector.consumption) && equal(finalization, vector.finalization), 'Sheet: one exact consumption and finalization receipt');
        } else {
            check(claimed.status === 401 || claimed.status === 403, mode + ': direct client claim without trusted attestation denied', claimed.status);
            check(prepared.status === 401 || prepared.status === 403, mode + ': direct client prepared history without attestation denied', prepared.status);
            check(finalized.status === 401 || finalized.status === 403, mode + ': direct client financial finalize without attestation denied', finalized.status);
            check(equal(trash, vector.source) && history === null, mode + ': denied attempt preserves source and creates no history');
            check(equal(daily, zero) && equal(monthly, zero), mode + ': denied attempt preserves money and package counts', { daily, monthly });
            check(consumption === null && finalization === null, mode + ': denied attempt creates no consumption or finalization');
        }
    }
    const prefix = { checks: pass + fail, pass, fail };
    if (prefix.checks !== 25) throw new Error('Original three-mode missing-proof checks did not all run');
    const localPolicy = await invalidLocalPolicyCases(rules);
    const financial = await attestedFinancialCases(rules);
    if (localPolicy.checks !== 16 || financial.checks !== 822 || financial.reservationChecks !== 294 || financial.releasedTerminalChecks !== 52 || financial.terminalEnumChecks !== 100
        || financial.checks - financial.reservationChecks - financial.releasedTerminalChecks - financial.terminalEnumChecks !== 376
        || financial.details.length !== 2 || financial.details.some(detail => detail.terminalRaces.length !== 4 || detail.reservationRaces.length !== 2
            || detail.crashedReservations.length !== 6 || detail.publicationRaces.length !== 2 || detail.releasedTerminalCases.length !== 2 || detail.terminalEnumCases.length !== 2)
        || financial.droppedAckInjections !== 2 || financial.droppedProofAckInjections !== 2
        || financial.upstreamReads.cookie < 1 || financial.upstreamReads.palm < 1) throw new Error('Financial attestation matrix was incomplete');
    if (!equal(inputs, inputFingerprints())) throw new Error('Attestation input files changed during the actual emulator matrix');
    if (process.env.ZTOATTEST_RESULT) fs.writeFileSync(process.env.ZTOATTEST_RESULT,
        JSON.stringify({ source: ROOT, port: PORT, observations, prefix, localPolicy, financial, inputs, inputDrift: false }, null, 2) + '\n', { mode: 0o600 });
    console.log('\n' + pass + ' ok, ' + fail + ' FAIL');
    process.exitCode = fail ? 1 : 0;
})().catch(error => { console.error('FAIL restore attestation rules: ' + error.message); process.exitCode = 1; });
