// @vitest-environment node
import { spawnSync } from 'node:child_process';
import { cp, lstat, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { listFunctions, zipFunctions, type FunctionResult, type ListedFunction } from '@netlify/zip-it-and-ship-it';

const require = createRequire(import.meta.url);
const app = resolve(dirname(fileURLToPath(import.meta.url)), '../../../ZoeW');
const repository = resolve(app, '..');
const keygen = join(repository, 'ZoeKeyGen');
const functions = join(keygen, 'netlify/functions');
const config = { '*': { nodeVersion: '24.x' } };
let scratch: string;
let artifact: string;
let dependency: string;
let listed: ListedFunction[];
let emitted: FunctionResult[];

const runner = String.raw`
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { registerHooks, syncBuiltinESMExports } from 'node:module';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import tls from 'node:tls';
import { dirname, sep } from 'node:path';
import { Writable } from 'node:stream';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
let outsideModules = 0;
let actualNetworkAttempts = 0;
let phase = 'load';
let businessCalls = 0;
const denyNetwork = () => { actualNetworkAttempts++; throw new Error('artifact:actual-network-denied'); };
for (const transport of [http, https]) { transport.request = denyNetwork; transport.get = denyNetwork; }
net.connect = denyNetwork;
net.createConnection = denyNetwork;
net.Socket.prototype.connect = denyNetwork;
tls.connect = denyNetwork;
syncBuiltinESMExports();
globalThis.fetch = denyNetwork;
registerHooks({ resolve(specifier, context, nextResolve) {
    const resolved = nextResolve(specifier, context);
    if (resolved.url.startsWith('file:') && !fileURLToPath(resolved.url).startsWith(root + sep)) {
        outsideModules++;
        throw new Error('artifact:outside-module');
    }
    return resolved;
} });
globalThis.awslambda = {
    streamifyResponse: handler => handler,
    HttpResponseStream: { from(stream, metadata) { stream.metadata = metadata; return stream; } }
};
try {
    const { handler } = await import(pathToFileURL(root + '/___netlify-entry-point.mjs').href);
    phase = 'load-handler';
    const nonce = '0123456789abcdef0123456789abcdef';
    async function call(origin, target, method = 'GET', query = '?nonce=' + nonce) {
        const chunks = [];
        const stream = new Writable({ write(chunk, _encoding, done) { chunks.push(Buffer.from(chunk)); done(); } });
        const headers = { 'x-nf-site-id': 'artifact-site', 'x-nf-deploy-id': 'artifact-deploy', 'x-nf-request-id': randomUUID() };
        if (origin !== null) headers.origin = origin;
        await handler({ rawUrl: target + '/.netlify/functions/server-time' + query, path: '/.netlify/functions/server-time', httpMethod: method, headers, isBase64Encoded: false },
            stream, { awsRequestId: randomUUID(), getRemainingTimeInMillis: () => 60000 });
        phase = 'behavior';
        businessCalls++;
        return { status: stream.metadata.statusCode, headers: stream.metadata.multiValueHeaders, data: JSON.parse(Buffer.concat(chunks).toString()) };
    }
    const accepted = [];
    for (const origin of ['https://deploy-preview-400--zoekeygen.netlify.app', 'https://deploy-preview-27--zoew.netlify.app']) {
        const before = Date.now();
        const response = await call(origin, origin);
        assert.equal(response.status, 200);
        assert.equal(response.data.nonce, nonce);
        assert.ok(Number.isFinite(response.data.now) && response.data.now >= before && response.data.now <= Date.now());
        assert.deepEqual(response.headers['access-control-allow-origin'], [origin]);
        assert.equal(response.headers['access-control-allow-credentials'], undefined);
        for (const name of ['cache-control', 'cdn-cache-control', 'netlify-cdn-cache-control']) assert.deepEqual(response.headers[name], ['no-store']);
        accepted.push(response.status);
    }
    const preview = 'https://deploy-preview-400--zoekeygen.netlify.app';
    const rejected = [];
    for (const [origin, target] of [
        [preview, 'https://zoew.netlify.app'],
        [preview, 'https://deploy-preview-401--zoekeygen.netlify.app'],
        [preview, 'https://deploy-preview-400--zoew.netlify.app'],
        ['https://deploy-preview-0--zoekeygen.netlify.app', 'https://deploy-preview-0--zoekeygen.netlify.app'],
        ['https://deploy-preview-400--unowned.netlify.app', 'https://deploy-preview-400--unowned.netlify.app'],
        ['https://deploy-preview-400--zoekeygen.netlify.app.evil.invalid', preview]
    ]) {
        const response = await call(origin, target);
        assert.equal(response.status, 403);
        assert.equal(response.headers['access-control-allow-origin'], undefined);
        assert.deepEqual(response.data, {});
        rejected.push(response.status);
    }
    const withoutOrigin = await call(null, preview);
    assert.equal(withoutOrigin.status, 200);
    assert.equal(withoutOrigin.data.nonce, nonce);
    assert.equal(withoutOrigin.headers['access-control-allow-origin'], undefined);
    const invalidNonces = [];
    for (const query of ['', '?nonce=invalid', '?nonce=' + nonce + '&nonce=' + nonce]) {
        const response = await call(preview, preview, 'GET', query);
        assert.equal(response.status, 400);
        assert.deepEqual(response.data, {});
        invalidNonces.push(response.status);
    }
    const method = await call(preview, preview, 'POST');
    assert.equal(method.status, 405);
    assert.deepEqual(method.headers.allow, ['GET']);
    assert.deepEqual(method.data, {});
    assert.equal(outsideModules, 0);
    assert.equal(actualNetworkAttempts, 0);
    console.log(JSON.stringify({ passed: true, phase, accepted, rejected, invalidNonces, method: method.status, withoutOrigin: withoutOrigin.status, businessCalls, outsideModules, actualNetworkAttempts }));
} catch (error) {
    console.log(JSON.stringify({ passed: false, phase, errorCode: error.code || '', errorName: error.name, businessCalls, outsideModules, actualNetworkAttempts }));
    process.exitCode = 1;
}
`;

beforeAll(async () => {
    await readFile(join(functions, 'server-time.mjs'));
    scratch = await mkdtemp(join(tmpdir(), 'zoe-time-artifact-'));
    listed = await listFunctions(functions, { parseISC: true, config });
    emitted = await zipFunctions(functions, scratch, {
        archiveFormat: 'none', basePath: keygen, repositoryRoot: repository, config,
        manifest: join(scratch, 'manifest.json')
    });
    artifact = join(scratch, 'server-time');
    dependency = 'server-time.mjs';
    await writeFile(join(artifact, 'server-time-artifact-runner.mjs'), runner);
}, 60000);
afterAll(async () => { if (scratch) await rm(scratch, { recursive: true, force: true }); });

function run(directory = artifact) {
    const output = spawnSync(process.execPath, [join(directory, 'server-time-artifact-runner.mjs')], {
        cwd: directory, env: { TZ: 'UTC' }, timeout: 15000, encoding: 'utf8', maxBuffer: 1024 * 1024
    });
    expect(output.error).toBeUndefined();
    expect(output.signal).toBeNull();
    const result = JSON.parse(output.stdout.trim().split('\n').at(-1)!);
    return { status: output.status, result };
}

it('KeyGen បញ្ចេញ server-time តែមួយជា API2 ដោយមិនភ្ជាប់ ZTO', async () => {
    expect(listed.map(entry => entry.name)).toEqual(['server-time']);
    expect(listed[0]).toMatchObject({ extension: '.mjs', runtimeAPIVersion: 2, inputModuleFormat: 'esm', routes: [], excludedRoutes: [] });
    expect(emitted.map(entry => entry.name)).toEqual(['server-time']);
    expect(emitted[0]).toMatchObject({ runtimeAPIVersion: 2, invocationMode: 'stream', bundler: 'nft', bundlerReason: 'v2-nft', entryFilename: '___netlify-entry-point.mjs' });
    const manifest = JSON.parse(await readFile(join(scratch, 'manifest.json'), 'utf8'));
    expect(manifest.functions).toEqual([expect.objectContaining({ name: 'server-time', buildData: { runtimeAPIVersion: 2 }, invocationMode: 'stream' })]);
});

it('artifact ផ្ទុក handler ដែល bundle ពី ZoeW និង runtime ពិតដោយគ្មាន symlink', async () => {
    expect((await readFile(join(functions, 'server-time.mjs'), 'utf8')).trim()).toBe("export { default } from '../../../ZoeW/netlify/functions/server-time.mjs';");
    const bundled = await readFile(join(artifact, dependency), 'utf8');
    expect(bundled).toContain('function serverTime(request)');
    expect(bundled).toContain('serverTime as default');
    expect(await readFile(join(artifact, '___netlify-bootstrap.mjs'))).toEqual(await readFile(require.resolve('@netlify/serverless-functions-api')));
    expect(await readFile(join(artifact, '___netlify-entry-point.mjs'), 'utf8')).toContain("bootstrap.getLambdaHandler('./server-time.mjs')");
    async function physical(directory: string) {
        for (const name of await readdir(directory)) {
            const path = join(directory, name), stat = await lstat(path);
            expect(stat.isSymbolicLink(), path).toBe(false);
            expect(name.toLowerCase()).not.toContain('zto');
            if (stat.isDirectory()) await physical(path);
        }
    }
    await physical(artifact);
});

it('runtime ពិតទទួល preview ខ្លួនឯង និងរក្សា Origin nonce method ដោយគ្មាន network ឬ source fallback', () => {
    const evidence = run();
    expect(evidence).toEqual({ status: 0, result: {
        passed: true, phase: 'behavior', accepted: [200, 200], rejected: [403, 403, 403, 403, 403, 403],
        invalidNonces: [400, 400, 400], method: 405, withoutOrigin: 200, businessCalls: 13, outsideModules: 0, actualNetworkAttempts: 0
    } });
    console.log(JSON.stringify({ artifact: 'KeyGen/server-time', ...evidence }));
});

it('ដក handler ក្នុង artifact បង្ហាញ missing dependency មុនចូល behavior និងមិនអាច fallback ទៅ source', async () => {
    const copy = join(scratch, 'missing-handler');
    const original = await readFile(join(artifact, dependency));
    await cp(artifact, copy, { recursive: true });
    try {
        await rm(join(copy, dependency));
        const evidence = run(copy);
        expect(evidence).toEqual({ status: 1, result: {
            passed: false, phase: 'load-handler', errorCode: 'ERR_MODULE_NOT_FOUND', errorName: 'Error',
            businessCalls: 0, outsideModules: 0, actualNetworkAttempts: 0
        } });
        console.log(JSON.stringify({ control: 'missing-packaged-handler', ...evidence }));
    } finally {
        await rm(copy, { recursive: true, force: true });
    }
    expect(await readFile(join(artifact, dependency))).toEqual(original);
});
