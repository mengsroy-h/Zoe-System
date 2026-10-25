// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cp, lstat, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { listFunctions, zipFunctions, type FunctionResult, type ListedFunction } from '@netlify/zip-it-and-ship-it';

const require = createRequire(import.meta.url);
const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const functions = join(app, 'netlify/functions');
const config = { '*': { nodeBundler: 'esbuild' as const, nodeVersion: '24.x' } };
let scratch: string;
let artifact: string;
let listed: ListedFunction[];
let emitted: FunctionResult[];

beforeAll(async () => {
    scratch = await mkdtemp(join(tmpdir(), 'zoe-zto-artifact-'));
    listed = await listFunctions(functions, { parseISC: true, config });
    emitted = await zipFunctions(functions, scratch, {
        archiveFormat: 'none', basePath: app, repositoryRoot: resolve(app, '..'), config,
        manifest: join(scratch, 'manifest.json')
    });
    artifact = join(scratch, 'zto-order-detail');
    for (const name of ['zto-artifact-runner.mjs', 'zto-artifact-network.mjs']) {
        await cp(join(app, 'tests/fixtures', name), join(artifact, name));
    }
}, 60000);
afterAll(async () => { if (scratch) await rm(scratch, { recursive: true, force: true }); });

it('ZISI ពិតរក entry តែមួយ API2 ហើយ manifest រក្សា URL Function ដដែល', async () => {
    expect(JSON.parse(await readFile(require.resolve('@netlify/zip-it-and-ship-it/package.json'), 'utf8')).version).toBe('16.5.1');
    const found = listed.filter(f => f.name === 'zto-order-detail');
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ extension: '.mjs', runtimeAPIVersion: 2, inputModuleFormat: 'esm', routes: [], excludedRoutes: [] });
    const built = emitted.filter(f => f.name === 'zto-order-detail');
    expect(built).toHaveLength(1);
    expect(built[0]).toMatchObject({ runtimeAPIVersion: 2, invocationMode: 'stream', bundler: 'nft', bundlerReason: 'v2-nft', entryFilename: '___netlify-entry-point.mjs' });
    const manifest = JSON.parse(await readFile(join(scratch, 'manifest.json'), 'utf8'));
    expect(manifest.functions.filter((f: any) => f.name === 'zto-order-detail')).toEqual([expect.objectContaining({ name: 'zto-order-detail', buildData: { runtimeAPIVersion: 2 }, invocationMode: 'stream' })]);
    expect(manifest.functions.find((f: any) => f.name === 'zto-order-detail').routes ?? []).toEqual([]);
    expect(manifest.functions.find((f: any) => f.name === 'zto-order-detail').excludedRoutes ?? []).toEqual([]);
    expect('/.netlify/functions/' + found[0].name).toBe('/.netlify/functions/zto-order-detail');
});

it('artifact ផ្ទុក runtime ផ្លូវការ និង SDK ពិតដោយគ្មាន symlink ឬ source fallback', async () => {
    const runtime = require.resolve('@netlify/serverless-functions-api');
    expect(JSON.parse(await readFile(require.resolve('@netlify/serverless-functions-api/package.json'), 'utf8')).version).toBe('2.24.0');
    expect(await readFile(join(artifact, '___netlify-bootstrap.mjs'))).toEqual(await readFile(runtime));
    const sdk = join(artifact, 'node_modules/@netlify/blobs');
    expect(JSON.parse(await readFile(join(sdk, 'package.json'), 'utf8')).version).toBe('11.1.3');
    expect(JSON.parse(await readFile(join(artifact, 'node_modules/@netlify/aws-lambda-compat/package.json'), 'utf8')).version).toBe('2.0.3');
    for (const name of ['main.js', 'main.cjs', 'chunk-QDL6ESI2.js']) {
        expect(await readFile(join(sdk, 'dist', name))).toEqual(await readFile(join(app, 'node_modules/@netlify/blobs/dist', name)));
    }
    async function physical(dir: string) {
        for (const name of await readdir(dir)) {
            const path = join(dir, name), stat = await lstat(path);
            expect(stat.isSymbolicLink(), path).toBe(false);
            if (stat.isDirectory()) await physical(path);
        }
    }
    await physical(artifact);
    expect(await readFile(join(artifact, '___netlify-entry-point.mjs'), 'utf8')).toContain("bootstrap.getLambdaHandler('./netlify/functions/zto-order-detail.mjs')");
    console.log(JSON.stringify({ runtime: '@netlify/serverless-functions-api@2.24.0', bootstrapSHA256: createHash('sha256').update(await readFile(runtime)).digest('hex'), sdk: '@netlify/blobs@11.1.3', bundler: '@netlify/zip-it-and-ship-it@16.5.1' }));
});

function run(scenario: string, directory = artifact) {
    const output = execFileSync(process.execPath, [join(directory, 'zto-artifact-runner.mjs'), scenario], {
        cwd: directory, env: { TZ: 'UTC' }, timeout: 25000, encoding: 'utf8', maxBuffer: 1024 * 1024
    });
    const result = JSON.parse(output.trim().split('\n').at(-1)!);
    expect(result).toMatchObject({ scenario, passed: true, outsideModules: 0, actualNetworkAttempts: 0, unexpectedNetwork: 0 });
    return result;
}

it('runtime→compat→SDK→journal ពិត reserve→warning→confirm ផ្ញើរូប និង05តែម្តង', () => {
    const result = run('flow');
    expect(result).toMatchObject({ photos: 1, receipts: 1, staleCachedReads: 0 });
    expect(result.strongJournalReads).toBe(3);
    expect(result.authoritativeCAS).toBeGreaterThanOrEqual(6);
});
it.each(['missing-context', 'missing-uncached'])('runtime %s បិទដោយ503 មុន network', (scenario) => {
    expect(run(scenario).status).toBe(503);
});
it('runtime ជួប authoritative CAS conflict មិនផ្ញើរូបឬ05', () => {
    expect(run('cas-conflict')).toMatchObject({ status: 503, conflicts: 1, photos: 0, receipts: 0 });
});
it('runtime រក្សា auth CORS204 body limit និង binary rejection', () => {
    expect(run('boundaries')).toMatchObject({ statuses: [401, 204, 400, 400, 400, 400], positiveBoundaries: [200, 200], networkCalls: 0 });
});

it('artifact reserve ស្ទួនរក្សា owner ដដែល អាន strong ពីរដង និងបង្កើតជួរតែមួយ', () => {
    expect(run('repeat-reserve')).toMatchObject({
        statuses: [409, 409], reservationReused: true, strongJournalReads: 2, authoritativeCAS: 1,
        conditionalNewWrites: 1, journalRows: 1, staleCachedReads: 0, photos: 0, receipts: 0
    });
});
it('artifact ដែលដក private marker តែមួយ បិទដោយ503 មុន journal HTTP រូបឬ05', async () => {
    const copy = join(scratch, 'marker-mutant');
    await cp(artifact, copy, { recursive: true });
    const relativeMain = join('netlify', 'functions', 'zto-order-detail.mjs');
    const original = await readFile(join(artifact, relativeMain), 'utf8');
    try {
        const factories = [...original.matchAll(/exports\.createModernHandler\s*=\s*function\s+createModernHandler\([^)]*\)\s*\{([\s\S]{0,1800}?)\n {4}\};/g)];
        expect(factories).toHaveLength(1);
        const factory = factories[0][0];
        const sdk = [...factory.matchAll(/\bconst\s+([\w$]+)\s*=\s*Object\.freeze\(\{\s*getStore:\s*[\w$]+\.getStore\s*\}\)/g)];
        const handler = [...factory.matchAll(/return\s+async\s+function\s+modernHandler\(\s*([\w$]+)\s*\)/g)];
        expect(sdk).toHaveLength(1);
        expect(handler).toHaveLength(1);
        const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const marker = new RegExp('\\b([\\w$]+)\\.set\\(\\s*' + escape(handler[0][1]) + '\\s*,\\s*' + escape(sdk[0][1]) + '\\s*\\);', 'g');
        const marks = [...factory.matchAll(marker)];
        expect(marks).toHaveLength(1);
        expect([...original.matchAll(marker)]).toHaveLength(1);
        const declaration = new RegExp('\\b(?:const|let|var)\\s+' + escape(marks[0][1]) + '\\s*=\\s*(?:/\\*[\\s\\S]{0,100}?\\*/\\s*)?new\\s+WeakMap\\(\\)', 'g');
        expect([...original.matchAll(declaration)]).toHaveLength(1);
        const mutated = original.replace(marks[0][0], '');
        expect(mutated).not.toBe(original);
        expect([...mutated.matchAll(marker)]).toHaveLength(0);
        await writeFile(join(copy, relativeMain), mutated);
        expect(await readFile(join(copy, relativeMain), 'utf8')).toBe(mutated);
        expect(await readFile(join(copy, '___netlify-bootstrap.mjs'))).toEqual(await readFile(require.resolve('@netlify/serverless-functions-api')));
        expect(run('missing-marker', copy)).toMatchObject({ status: 503, journalHTTP: 0, photos: 0, receipts: 0 });
    } finally {
        expect(await readFile(join(artifact, relativeMain), 'utf8')).toBe(original);
        await rm(copy, { recursive: true, force: true });
    }
});
