import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { registerHooks, syncBuiltinESMExports } from 'node:module';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import tls from 'node:tls';
import { dirname, sep } from 'node:path';
import { Writable } from 'node:stream';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createNetwork } from './zto-artifact-network.mjs';

const root = dirname(fileURLToPath(import.meta.url));
let outsideModules = 0;
let actualNetworkAttempts = 0;
const denyNetwork = () => { actualNetworkAttempts++; throw new Error('artifact:actual-network-denied'); };
for (const transport of [http, https]) { transport.request = denyNetwork; transport.get = denyNetwork; }
net.connect = denyNetwork;
net.createConnection = denyNetwork;
net.Socket.prototype.connect = denyNetwork;
tls.connect = denyNetwork;
syncBuiltinESMExports();
registerHooks({ resolve(specifier, context, nextResolve) {
    const resolved = nextResolve(specifier, context);
    if (resolved.url.startsWith('file:') && !fileURLToPath(resolved.url).startsWith(root + sep)) {
        outsideModules++;
        throw new Error('artifact:outside-module:' + resolved.url);
    }
    return resolved;
} });
const network = createNetwork();
globalThis.fetch = network.fetch;
globalThis.awslambda = {
    streamifyResponse: handler => handler,
    HttpResponseStream: { from(stream, metadata) { stream.metadata = metadata; return stream; } }
};
Object.assign(process.env, {
    ZTO_PROXY_KEY: 'artifact-proxy-key-0123456789', ZTO_PROXY_KEYS_JSON: '',
    ZTO_PALM_SESSION_SECRET: 'artifact-session-secret-at-least-32-characters', ZTO_PALM_SIGN_KEY: 'synthetic-sign-key',
    ZTO_PALM_PASSWORD_KEY: 'zoew-test-aes-16', ZTO_DETAIL_IDENTITY: 'off', ZTO_DETAIL_BRANCH_PATHS: ''
});
const { handler } = await import(pathToFileURL(root + '/___netlify-entry-point.mjs').href);
const blobEnvelope = { url: 'https://cached.blobs.invalid', url_uncached: 'https://strong.blobs.invalid', token: 'synthetic-blob-token' };
const encode = object => Buffer.from(JSON.stringify(object)).toString('base64');
const key = process.env.ZTO_PROXY_KEY;
const photo = '/9j/AAECAwQF/9k=';
const barcode = '77130500000012';
let session = '';

async function call(palm, body, options = {}) {
    const chunks = [];
    const stream = new Writable({ write(chunk, _encoding, done) { chunks.push(Buffer.from(chunk)); done(); } });
    const headers = {
        'content-type': 'application/json', 'x-nf-site-id': 'artifact-site', 'x-nf-deploy-id': 'artifact-deploy',
        'x-nf-request-id': randomUUID(), 'x-zoe-proxy-key': key, ...options.headers
    };
    if (session) headers['x-zoe-palm-token'] = session;
    const event = {
        rawUrl: 'https://zoew.invalid/.netlify/functions/zto-order-detail?palm=' + palm,
        path: '/.netlify/functions/zto-order-detail', httpMethod: options.method || 'POST', headers,
        body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
        isBase64Encoded: false, blobs: encode(options.blobs === undefined ? blobEnvelope : options.blobs)
    };
    if (options.noBlobs) { delete event.blobs; delete process.env.NETLIFY_BLOBS_CONTEXT; }
    await handler(event, stream, { awsRequestId: randomUUID(), getRemainingTimeInMillis: () => 60000 });
    const text = Buffer.concat(chunks).toString();
    return { status: stream.metadata.statusCode, headers: stream.metadata.multiValueHeaders, text, data: text ? JSON.parse(text) : null };
}
async function prepare() {
    const login = await call('login', { username: 'artifact-operator', password: 'synthetic-password', deviceSn: 'artifact-device' });
    assert.equal(login.status, 200);
    session = login.data.sessionToken;
    assert.equal(typeof session, 'string');
    const requestId = randomUUID();
    const input = { photoProtocol: 'original-sha256-v1', originalSHA256: createHash('sha256').update(Buffer.from(photo, 'base64')).digest('hex'), barcode, signMan: 'សុខា', photo, requestId, stage: 'dispatch' };
    const dispatch = await call('sign', input);
    assert.equal(dispatch.status, 200);
    assert.equal(dispatch.data.success, true);
    const receipt = { ...input, stage: 'receipt', dispatchProof: dispatch.data.dispatchProof,
        reservationProtocol: 'original-reservation-v1', refreshRequestId: randomUUID(),
        originalFingerprint: createHash('sha256').update(JSON.stringify([barcode, requestId, input.signMan, photo])).digest('hex') };
    return receipt;
}
async function reserve(body) {
    const response = await call('sign', { ...body, stage: 'receipt-status', photo: undefined, signMan: undefined });
    assert.equal(response.status, 409, response.text);
    assert.equal(response.data.code, 'ZTO_PALM_SIGN_RESUME_READY');
    return { ...body, reservationOwner: response.data.reservationOwner, reservationToken: response.data.reservationToken };
}
const counts = () => ({
    photos: network.calls.filter(c => c.url.endsWith('/saveBillPic')).length,
    receipts: network.calls.filter(c => c.url.endsWith('/saveScanInfo') && c.payload?.[0]?.scanTypeCode === '05').length,
    strongJournalReads: network.calls.filter(c => c.method === 'GET' && c.url.includes('strong.blobs.invalid') && c.url.includes('palm-sign-v1')).length,
    staleCachedReads: network.calls.filter(c => c.method === 'GET' && c.url.includes('cached.blobs.invalid') && c.url.includes('palm-sign-v1')).length,
    authoritativeCAS: network.calls.filter(c => c.method === 'PUT' && c.url.includes('palm-sign-v1') && (c.headers['if-match'] || c.headers['if-none-match'] === '*')).length
});
const scenario = process.argv[2];
let result;
if (scenario === 'flow') {
    network.state.staleCached = true;
    const body = await reserve(await prepare());
    const warning = await call('sign', body);
    assert.equal(warning.status, 409);
    assert.equal(warning.data.code, 'ZTO_PALM_SIGN_CONFIRM_REQUIRED');
    assert.equal(typeof warning.data.confirmationToken, 'string');
    assert.equal(counts().photos, 0);
    assert.equal(counts().receipts, 0);
    const accepted = await call('sign', { ...body, confirmationToken: warning.data.confirmationToken });
    assert.equal(accepted.status, 200);
    assert.equal(accepted.data.scanCompleted, true);
    assert.equal(accepted.data.ztoClosed, true);
    const replay = await call('sign', { ...body, confirmationToken: warning.data.confirmationToken });
    assert.equal(replay.status, 200);
    assert.equal(replay.data.scanCompleted, true);
    result = counts();
    assert.equal(result.photos, 1);
    assert.equal(result.receipts, 1);
    assert.equal(result.staleCachedReads, 0);
    assert.equal(network.calls.filter(c => c.journal && c.method === 'PUT').length, result.authoritativeCAS);
    for (const request of network.calls.filter(c => c.journal)) assert.equal(request.headers.authorization, 'Bearer synthetic-blob-token');
} else if (scenario === 'repeat-reserve') {
    const body = await prepare();
    assert.equal([...network.rows.keys()].filter(key => key.includes('/palm-sign-v1/')).length, 0);
    const status = { ...body, stage: 'receipt-status', photo: undefined, signMan: undefined };
    const first = await call('sign', status);
    const second = await call('sign', status);
    for (const response of [first, second]) {
        assert.equal(response.status, 409);
        assert.equal(response.data.code, 'ZTO_PALM_SIGN_RESUME_READY');
        assert.equal(typeof response.data.reservationOwner, 'string');
        assert.notEqual(response.data.reservationOwner, '');
    }
    assert.equal(first.data.reservationOwner, second.data.reservationOwner);
    const journalRows = [...network.rows.keys()].filter(key => key.includes('/palm-sign-v1/')).length;
    const journalWrites = network.calls.filter(c => c.journal && c.method === 'PUT');
    assert.equal(journalRows, 1);
    assert.equal(journalWrites.length, 1);
    assert.equal(journalWrites[0].headers['if-none-match'], '*');
    result = { ...counts(), journalRows, conditionalNewWrites: journalWrites.length, reservationReused: true, statuses: [first.status, second.status] };
    assert.equal(result.strongJournalReads, 2);
    assert.equal(result.authoritativeCAS, 1);
    assert.equal(result.staleCachedReads, 0);
    assert.equal(result.photos, 0);
    assert.equal(result.receipts, 0);
} else if (scenario === 'missing-marker') {
    const body = await prepare();
    const before = network.calls.length;
    const response = await call('sign', { ...body, stage: 'receipt-status', photo: undefined, signMan: undefined });
    assert.equal(response.status, 503);
    assert.equal(response.data.code, 'ZTO_PALM_SIGN_STORE_UNAVAILABLE');
    assert.equal(network.calls.length, before);
    result = { status: response.status, journalHTTP: network.calls.filter(c => c.journal).length, ...counts() };
    assert.equal(result.journalHTTP, 0);
    assert.equal(result.photos, 0);
    assert.equal(result.receipts, 0);
} else if (scenario === 'missing-context' || scenario === 'missing-uncached') {
    const body = await prepare();
    const before = network.calls.length;
    const options = scenario === 'missing-context' ? { noBlobs: true } : { blobs: { url: blobEnvelope.url, token: blobEnvelope.token } };
    const response = await call('sign', { ...body, stage: 'receipt-status', photo: undefined, signMan: undefined }, options);
    assert.equal(response.status, 503);
    assert.equal(response.data.code, 'ZTO_PALM_SIGN_STORE_UNAVAILABLE');
    assert.equal(network.calls.length, before);
    result = { status: response.status };
} else if (scenario === 'cas-conflict') {
    const body = await reserve(await prepare());
    network.state.conflict = true;
    const response = await call('sign', body);
    assert.equal(response.status, 503);
    assert.equal(response.data.code, 'ZTO_PALM_SIGN_STORE_UNAVAILABLE');
    result = { status: response.status, conflicts: network.calls.filter(c => c.journal && c.status === 412).length, ...counts() };
    assert.equal(result.photos, 0);
    assert.equal(result.receipts, 0);
} else if (scenario === 'boundaries') {
    const statuses = [];
    statuses.push((await call('login', {}, { headers: { 'x-zoe-proxy-key': 'invalid' } })).status);
    const cors = await call('sign', undefined, { method: 'OPTIONS', headers: { origin: 'https://localhost', 'access-control-request-method': 'POST', 'access-control-request-headers': 'content-type,x-zoe-palm-token' } });
    statuses.push(cors.status);
    assert.equal(cors.text, '');
    assert.deepEqual(cors.headers['access-control-allow-origin'], ['https://localhost']);
    assert.match(cors.headers['access-control-allow-methods'][0], /POST/);
    assert.equal(network.calls.length, 0);
    function padded(input, bytes) {
        const base = JSON.stringify({ ...input, padding: '' });
        const text = JSON.stringify({ ...input, padding: 'x'.repeat(bytes - Buffer.byteLength(base)) });
        assert.equal(Buffer.byteLength(text), bytes);
        return text;
    }
    const loginInput = { username: 'artifact-operator', password: 'synthetic-password', deviceSn: 'artifact-device' };
    const maxLogin = await call('login', padded(loginInput, 4096));
    assert.equal(maxLogin.status, 200);
    session = maxLogin.data.sessionToken;
    const statusInput = { barcode, requestId: randomUUID(), stage: 'status' };
    const maxSign = await call('sign', padded(statusInput, 1250000));
    assert.equal(maxSign.status, 200);
    assert.equal(maxSign.data.success, true);
    network.calls.length = 0;
    statuses.push((await call('login', padded(loginInput, 4097))).status);
    statuses.push((await call('login', JSON.stringify(loginInput), { headers: { 'content-type': 'application/octet-stream' } })).status);
    statuses.push((await call('sign', padded(statusInput, 1250001))).status);
    statuses.push((await call('sign', JSON.stringify(statusInput), { headers: { 'content-type': 'application/octet-stream' } })).status);
    assert.deepEqual(statuses, [401, 204, 400, 400, 400, 400]);
    assert.equal(network.calls.length, 0);
    result = { statuses, positiveBoundaries: [maxLogin.status, maxSign.status], networkCalls: network.calls.length };
} else throw new Error('artifact:unknown-scenario');
assert.equal(network.calls.filter(c => c.status === undefined).length, 0);
assert.equal(outsideModules, 0);
assert.equal(actualNetworkAttempts, 0);
console.log(JSON.stringify({ scenario, passed: true, outsideModules, actualNetworkAttempts, unexpectedNetwork: network.calls.filter(c => c.status === undefined).length, ...result }));
