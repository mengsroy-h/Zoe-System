'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const path = require('node:path');
const fx = require('../idtoken-fixture.js');

const ATTESTOR_KID = 'money-fixture-v1';
const ATTESTOR_SECRET = 'ab'.repeat(32);

function createMoneyRestoreIssuer({ root, env, lookup, fetchImpl, project, firebasePort, supabaseUrl }) {
    const { createRestoreProofHandler } = require(path.join(root, 'ZoeW/netlify/functions/_shared/zto-restore-proof.cjs'));
    const { createFirebaseBackend } = require(path.join(root, 'ZoeW/netlify/functions/_shared/zto-restore-firebase.cjs'));
    const core = require(path.join(root, 'ZoeW/netlify/functions/_shared/zto-order-detail-core.cjs'));
    const actors = new Map(), scopes = new Set();
    const serviceEmail = project ? 'restore-fixture@' + project + '.iam.gserviceaccount.com' : '';
    const publicKey = crypto.createPublicKey(fx.TEST_KEY_PEM);
    const serviceAccess = 'synthetic-money-restore-service-access';
    function registerFirebaseActor({ uid, email, databaseURL }) {
        const url = new URL(databaseURL);
        assert.equal(url.origin, 'http://127.0.0.1:' + firebasePort);
        assert.equal(url.pathname, '/');
        assert.ok(!url.username && !url.password && !url.hash);
        assert.equal([...url.searchParams.keys()].join(','), 'ns');
        assert.match(url.searchParams.get('ns'), /^[A-Za-z0-9_-]{1,128}$/);
        assert.ok(project && uid && email);
        const old = actors.get(uid);
        if (old) assert.deepEqual(old, { uid, email, databaseURL });
        actors.set(uid, { uid, email, databaseURL }); scopes.add(databaseURL);
    }
    function resolveOrigin(raw, kind) {
        if (kind === 'firebase') { assert.ok(scopes.has(raw), 'issuer ត្រូវប្រើ namespace ដែល fixture កាន់កាប់'); return raw; }
        const url = new URL(raw);
        assert.equal(raw, supabaseUrl);
        assert.equal(url.protocol, 'http:'); assert.equal(url.hostname, '127.0.0.1');
        assert.equal(url.origin, raw); assert.ok(!url.username && !url.password && !url.search && !url.hash);
        return raw;
    }
    // Google Auth ជា fixture; RSA, controller, CAS និង DB commit ប្រើផ្លូវពិត។
    async function serverFetch(raw, init) {
        const url = new URL(raw), headers = new Headers(init.headers);
        if (url.href === 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com') {
            return Response.json({ [fx.TEST_KID]: fx.TEST_CERT_PEM });
        }
        if (url.href === 'https://oauth2.googleapis.com/token') {
            const form = new URLSearchParams(init.body), assertion = String(form.get('assertion')).split('.');
            assert.equal(form.get('grant_type'), 'urn:ietf:params:oauth:grant-type:jwt-bearer');
            assert.equal(assertion.length, 3);
            assert.equal(crypto.verify('RSA-SHA256', Buffer.from(assertion.slice(0, 2).join('.')), publicKey, Buffer.from(assertion[2], 'base64url')), true);
            const claims = JSON.parse(Buffer.from(assertion[1], 'base64url').toString());
            assert.equal(claims.iss, serviceEmail); assert.equal(claims.aud, url.href);
            assert.ok(claims.exp > Date.now() / 1000 && claims.exp - claims.iat <= 300);
            return Response.json({ access_token: serviceAccess, expires_in: 300 });
        }
        if (project && url.href === 'https://identitytoolkit.googleapis.com/v1/projects/' + project + '/accounts:lookup') {
            assert.equal(headers.get('authorization'), 'Bearer ' + serviceAccess);
            const body = JSON.parse(init.body);
            assert.equal(body.localId?.length, 1);
            const actor = actors.get(body.localId[0]);
            return Response.json({ users: actor ? [{ localId: actor.uid, email: actor.email, disabled: false, validSince: '0' }] : [] });
        }
        if (supabaseUrl && url.origin === supabaseUrl) {
            assert.match(url.pathname, /^\/rest\/v1\/rpc\/zoe_restore_(?:context|attest)_v1$/);
            return fetchImpl(raw, init);
        }
        assert.equal(url.origin, 'http://127.0.0.1:' + firebasePort);
        assert.equal([...url.searchParams.keys()].join(','), 'ns');
        assert.ok([...scopes].some(scope => new URL(scope).search === url.search));
        assert.match(url.pathname, /^\/zoew_(?:restore_policy|recently_deleted_cod_dod|scan_history_cod_dod|trash_consumptions|restore_finalizations|restore_attestations)\/.+\.json$/);
        assert.ok(['GET', 'PUT'].includes(init.method));
        assert.equal(headers.get('authorization'), 'Bearer ' + serviceAccess);
        if (init.method === 'PUT') assert.match(headers.get('if-match'), /^(?:[A-Za-z0-9+/_=-]{1,256}|"[A-Za-z0-9+/_=-]{1,256}")$/);
        headers.set('authorization', 'Bearer owner');
        return fetchImpl(raw, { ...init, headers });
    }
    const firebaseBackend = createFirebaseBackend({ verifyActor: core.verifyRestoreFirebaseActor, resolveOrigin });
    const handlers = new Map();
    function handlerFor(databaseURL = '') {
        if (!handlers.has(databaseURL)) handlers.set(databaseURL, createRestoreProofHandler({
            lookup, fetchImpl: serverFetch, resolveOrigin, firebaseBackend,
            env: { ...env, ZOE_ZTO_RESTORE_ATTESTOR_KEY_ID: ATTESTOR_KID, ZOE_ZTO_RESTORE_ATTESTOR_SECRET: ATTESTOR_SECRET,
                ZOE_ZTO_RESTORE_FIREBASE_DATABASE_URL: databaseURL,
                FCM_SERVICE_ACCOUNT: JSON.stringify({ project_id: project, client_email: serviceEmail, private_key: fx.TEST_KEY_PEM }) }
        }));
        return handlers.get(databaseURL);
    }
    return {
        registerFirebaseActor,
        async handle(request) {
            let claims;
            try { claims = JSON.parse(Buffer.from(String(request.headers.get('x-zoe-id-token')).split('.')[1], 'base64url').toString()); } catch (_) { claims = {}; }
            const actor = actors.get(claims.sub);
            return handlerFor(actor?.databaseURL)(request);
        }
    };
}

module.exports = { createMoneyRestoreIssuer, ATTESTOR_KID, ATTESTOR_SECRET };
