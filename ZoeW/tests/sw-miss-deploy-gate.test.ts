// @vitest-environment node
// N5 (deep audit 8): a shell file missing from the cache (an OPTIONAL entry that timed out at install) was fetched and
// stored into the current cache without the deploy check that background revalidation runs ➜ an unhashed file of a newer
// deploy lands in the old cache and the shell mixes two deploys. The miss path answers from the network at once and
// stores the answer only while the live `sw.js` still names this `CACHE_VERSION` (`shellDeployIsCurrent()`), both apps.
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';

function worker(app: string, fetch: any, cache: any) {
    const handlers: Record<string, (event: any) => void> = {};
    const source = fs.readFileSync(new URL(app === 'ZoeW' ? '../src/sw/sw.ts' : '../../ZoeKeyGen/sw.js', import.meta.url), 'utf8');
    const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None } }).outputText;
    const context = vm.createContext({
        __CACHE_VERSION__: 'zoew-probe-v1', __CORE_SHELL__: ['./index.html', './app.js', './style.css'], __OPTIONAL_SHELL__: ['./manifest.json', './icon-512.png'], __BACKEND_SHELL__: [],
        self: { location: new URL('https://audit.invalid/sw.js'), addEventListener(type: string, handler: (event: any) => void) { handlers[type] = handler; }, skipWaiting: async () => {}, clients: { claim: async () => {} } },
        caches: { open: async () => cache, keys: async () => [], match: async () => undefined },
        navigator: { onLine: true }, URL,
        Request: class extends Request {
            constructor(input: RequestInfo | URL, init?: RequestInit) {
                super(typeof input === 'string' ? new URL(input, 'https://audit.invalid/sw.js') : input, init);
            }
        },
        Response, AbortController, fetch, setTimeout, clearTimeout, Date
    });
    vm.runInContext(js + '\nglobalThis.probe = { version: CACHE_VERSION };', context);
    return Object.assign(context.probe, { handlers });
}

for (const app of ['ZoeW', 'ZoeKeyGen']) describe(app + ' SW ៖ ការខកខាន cache រក្សាទុកតែពេល deploy នៅដដែល', () => {
    for (const [label, sameDeploy, stored] of [['the live sw.js names another deploy ➜ answered but not stored', false, 0], ['control ៖ same deploy ➜ stored', true, 1]] as const) {
        it(label, async () => {
            const cache = { match: vi.fn(async () => undefined), put: vi.fn(async () => {}) };
            let probe: any;
            const fetch = vi.fn(async (input: any) => {
                const url = String(input && input.url ? input.url : input);
                if (/\/sw\.js/.test(url)) return new Response("const CACHE_VERSION = '" + probe.version + (sameDeploy ? '' : '-next') + "';");
                return new Response('{"name":"ZoeW"}', { status: 200, headers: { 'content-type': 'application/manifest+json' } });
            });
            probe = worker(app, fetch, cache);
            const waits: Promise<any>[] = [];
            let answered: Promise<Response> | null = null;
            probe.handlers.fetch({ request: new Request('https://audit.invalid/manifest.json'), respondWith: (p: Promise<Response>) => { answered = p; }, waitUntil: (p: Promise<any>) => { waits.push(p); } });
            const response = await answered!;
            await Promise.all(waits);
            for (let i = 0; i < 20; i++) await Promise.resolve();
            expect({ ok: response.ok, stored: cache.put.mock.calls.length }).toEqual({ ok: true, stored });
        });
    }
});
