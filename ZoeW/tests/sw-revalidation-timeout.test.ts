// @vitest-environment node
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function worker(app: string, fetch: ReturnType<typeof vi.fn>, abort: typeof AbortController | null = AbortController, cache?: unknown, skipWaiting = vi.fn(async () => {})) {
    const handlers: Record<string, (event: any) => void> = {};
    const source = fs.readFileSync(new URL(app === 'ZoeW' ? '../src/sw/sw.ts' : '../../ZoeKeyGen/sw.js', import.meta.url), 'utf8');
    const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None } }).outputText;
    const context = vm.createContext({
        __CACHE_VERSION__: 'zoew-probe-v1', __CORE_SHELL__: ['./index.html', './app.js', './style.css', './engine.wasm'], __OPTIONAL_SHELL__: ['./manifest.json', './icon-512.png'], __BACKEND_SHELL__: [],
        self: { location: new URL('https://audit.invalid/sw.js'), addEventListener(type: string, handler: (event: any) => void) { handlers[type] = handler; }, skipWaiting },
        caches: { open: async () => cache },
        navigator: { onLine: true }, URL,
        Request: class extends Request {
            constructor(input: RequestInfo | URL, init?: RequestInit) {
                super(typeof input === 'string' ? new URL(input, 'https://audit.invalid/sw.js') : input, init);
            }
        },
        Response, AbortController: abort,
        fetch, setTimeout, clearTimeout, Date
    });
    vm.runInContext(js + '\nglobalThis.probe = { shellDeployIsCurrent, revalidateShell, timeout: REVALIDATE_TIMEOUT_MS, version: CACHE_VERSION };', context);
    return Object.assign(context.probe, { handlers });
}

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

for (const app of ['ZoeW', 'ZoeKeyGen']) describe(app + ' SW ៖ ការធ្វើឲ្យស្រស់មានពិដានពិត', () => {
    for (const hasAbort of [true, false]) {
        it(`probe ព្យួរ ទោះ abort ${hasAbort ? 'មាន' : 'អវត្តមាន'} ➜ បញ្ចប់ក្នុងពិដាន`, async () => {
            const fetch = vi.fn(() => new Promise(() => {}));
            const probe = worker(app, fetch, hasAbort ? AbortController : null);
            let result: boolean | undefined;
            void probe.shellDeployIsCurrent().then((same: boolean) => { result = same; });
            await vi.advanceTimersByTimeAsync(probe.timeout + 1);
            expect(result).toBe(false);
        });
    }

    it('body របស់ probe ព្យួរ ➜ មិនចាក់សោ waitUntil', async () => {
        const fetch = vi.fn(async () => ({ ok: true, text: () => new Promise(() => {}) }));
        const probe = worker(app, fetch);
        let settled = false;
        void probe.revalidateShell({ put: vi.fn() }, new Request('https://audit.invalid/icon-512.png'), '/icon-512.png').then(() => { settled = true; });
        await vi.advanceTimersByTimeAsync(probe.timeout + 1);
        expect(settled).toBe(true);
    });

    it('asset មកក្រោយ timeout ➜ មិនសរសេរ cache យឺត', async () => {
        let resolve!: (value: Response) => void;
        const pending = new Promise<Response>((yes) => { resolve = yes; });
        const fetch = vi.fn().mockImplementationOnce(async () => new Response('const CACHE_VERSION = "' + probe.version + '";')).mockImplementationOnce(() => pending);
        const probe = worker(app, fetch);
        const cache = { put: vi.fn(async () => {}) };
        let settled = false;
        void probe.revalidateShell(cache, new Request('https://audit.invalid/icon-512.png'), '/icon-512.png').then(() => { settled = true; });
        await vi.advanceTimersByTimeAsync(probe.timeout + 1);
        resolve(new Response('late asset'));
        await vi.advanceTimersByTimeAsync(0);
        expect(settled).toBe(true);
        expect(cache.put).not.toHaveBeenCalled();
    });

    it('HTML ដែល cache រួចមិនត្រូវលាយជាមួយ deploy ថ្មី ក្នុងអាយុ probe ចាស់', async () => {
        const fetch = vi.fn(async (url: string) => new Response(String(url).endsWith('sw.js')
            ? 'const CACHE_VERSION = "' + probe.version + '";' : '<script src="./assets/new-deploy.js"></script>'));
        const probe = worker(app, fetch);
        expect(await probe.shellDeployIsCurrent()).toBe(true);
        const cache = { put: vi.fn(async () => {}) };
        await probe.revalidateShell(cache, new Request('https://audit.invalid/'), './index.html');
        expect(cache.put).not.toHaveBeenCalled();
    });
});

for (const app of ['ZoeW', 'ZoeKeyGen']) describe(app + ' SW ៖ install មិនទុក HTML ក្រោម key asset', () => {
    for (const invalid of [true, false]) it(`CORE app.js ជា ${invalid ? 'HTML' : 'JavaScript'} ➜ install ${invalid ? 'បដិសេធ' : 'ជោគជ័យ'}`, async () => {
        const cache = {
            addAll: vi.fn(async () => {}), add: vi.fn(async () => {}),
            match: vi.fn(async (url: string) => new Response('asset', { headers: { 'content-type': invalid && url.endsWith('app.js') ? 'text/html' : 'application/javascript' } })),
            put: vi.fn(async () => {}), delete: vi.fn(async () => true)
        };
        const skipWaiting = vi.fn(async () => {});
        const fetch = vi.fn(async () => new Response('const CACHE_VERSION = "' + probe.version + '";'));
        const probe = worker(app, fetch, AbortController, cache, skipWaiting);
        let installed!: Promise<unknown>;
        probe.handlers.install({ waitUntil(value: Promise<unknown>) { installed = value; } });
        expect(cache.addAll).not.toHaveBeenCalled();
        if (invalid) await expect(installed).rejects.toThrow('Shell deploy changed during install: ./app.js');
        else await expect(installed).resolves.toBeUndefined();
        expect(skipWaiting).toHaveBeenCalledTimes(invalid ? 0 : 1);
    });

    it('optional icon ឆ្លើយ HTML ➜ លុប cache asset នោះ ហើយ install នៅបញ្ចប់', async () => {
        const cache = {
            addAll: vi.fn(async () => {}), add: vi.fn(async () => {}),
            match: vi.fn(async (url: string) => new Response('asset', { headers: { 'content-type': url.endsWith('icon-512.png') ? 'text/html' : 'application/javascript' } })),
            put: vi.fn(async () => {}), delete: vi.fn(async () => true)
        };
        const skipWaiting = vi.fn(async () => {});
        const fetch = vi.fn(async () => new Response('const CACHE_VERSION = "' + probe.version + '";'));
        const probe = worker(app, fetch, AbortController, cache, skipWaiting);
        let installed!: Promise<unknown>;
        probe.handlers.install({ waitUntil(value: Promise<unknown>) { installed = value; } });
        await expect(installed).resolves.toBeUndefined();
        expect(cache.delete).toHaveBeenCalledExactlyOnceWith('./icon-512.png');
        expect(skipWaiting).toHaveBeenCalledOnce();
    });
});

for (const app of ['ZoeW', 'ZoeKeyGen']) describe(app + ' SW ៖ ទ្វារ revalidate មិនផ្ទុក HTML (Netlify `/* ➜ /index.html 200`) ក្រោម key របស់ asset', () => {
    for (const [type, puts] of [['text/html; charset=UTF-8', 0], ['image/png', 1]] as const) {
        it(`asset ចាស់ក្នុង cache ➜ server ឆ្លើយ ${type} ➜ cache.put ${puts} ដង`, async () => {
            const fetch = vi.fn(async (url: string) => (String(url).endsWith('sw.js')
                ? new Response('const CACHE_VERSION = "' + probe.version + '";')
                : new Response(puts ? 'export {};' : '<!doctype html><title>ZoeW</title>', { headers: { 'content-type': type } })));
            const probe = worker(app, fetch);
            const cache = { put: vi.fn(async () => {}) };
            await probe.revalidateShell(cache, new Request('https://audit.invalid/icon-512.png'), '/icon-512.png');
            expect(fetch.mock.calls.some(([u]: any[]) => String(u).includes('icon-512.png'))).toBe(true);
            expect(cache.put).toHaveBeenCalledTimes(puts);
        });
    }
});

for (const app of ['ZoeW', 'ZoeKeyGen']) describe(app + ' SW ៖ asset ដែល cache មិនទាន់មាន ទាមទារប្រភេទ response ត្រឹមត្រូវមុនរក្សាទុក', () => {
    for (const [type, puts] of [['text/html; charset=UTF-8', 0], ['application/javascript', 1]] as const) {
        it(`app.js មិនទាន់នៅក្នុង cache · HTTP 200 ${type} ➜ cache.put ${puts} ដង`, async () => {
            const cache = { match: vi.fn(async () => undefined), put: vi.fn(async () => {}) };
            const isWorkerScript = (input: any) => /\/sw\.js/.test(String(input && input.url ? input.url : input));
            const fetch = vi.fn(async (input: any) => (isWorkerScript(input)
                ? new Response("const CACHE_VERSION = '" + probe.version + "';")
                : new Response(puts ? 'export {};' : '<!doctype html><title>App</title>', { headers: { 'content-type': type } })));
            const probe: any = worker(app, fetch, AbortController, cache);
            let reply!: Promise<Response>;
            const waits: Promise<any>[] = [];
            probe.handlers.fetch({ request: new Request('https://audit.invalid/app.js'), respondWith(value: Promise<Response>) { reply = value; }, waitUntil(value: Promise<any>) { waits.push(value); } });
            const response = await reply;
            await vi.advanceTimersByTimeAsync(0);
            await Promise.all(waits);
            expect(response.status).toBe(200);
            expect(fetch.mock.calls.filter(([input]: any) => !isWorkerScript(input))).toHaveLength(1);
            expect(cache.put).toHaveBeenCalledTimes(puts);
        });
    }
});


for (const app of ['ZoeW', 'ZoeKeyGen']) describe(app + ' Deep audit ៖ activate ខណៈ Cache API បរាជ័យ', () => {
    for (const mode of ['keys', 'delete']) it(mode + ' បដិសេធ ➜ នៅ claim ឧបករណ៍ និងបញ្ចប់ activate', async () => {
        const handlers: Record<string, (event: any) => void> = {};
        const claim = vi.fn(async () => {});
        const source = fs.readFileSync(new URL(app === 'ZoeW' ? '../src/sw/sw.ts' : '../../ZoeKeyGen/sw.js', import.meta.url), 'utf8');
        const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None } }).outputText;
        const ctx = vm.createContext({
            __CACHE_VERSION__: 'zoew-probe-v1', __CORE_SHELL__: [], __OPTIONAL_SHELL__: [], __BACKEND_SHELL__: [],
            self: { location: new URL('https://audit.invalid/sw.js'), addEventListener(type: string, fn: any) { handlers[type] = fn; }, clients: { claim } },
            caches: { keys: async () => { if (mode === 'keys') throw new Error('SecurityError'); return [app === 'ZoeW' ? 'zoew-old' : 'zoekeygen-old']; }, delete: async () => { throw new Error('QuotaExceededError'); } },
            navigator: { onLine: true }, URL, Request, Response, setTimeout, clearTimeout, Date
        });
        vm.runInContext(js, ctx);
        let finished!: Promise<unknown>;
        handlers.activate({ waitUntil(value: Promise<unknown>) { finished = value; } });
        await expect(finished).resolves.toBeUndefined();
        expect(claim).toHaveBeenCalledOnce();
    });
});

for (const app of ['ZoeW', 'ZoeKeyGen']) describe(app + ' SW ៖ សំបកកំណែដដែលមិនលាយកូដ deploy ថ្មី', () => {
    for (const file of (app === 'ZoeW' ? ['app.js', 'style.css', 'engine.wasm'] : ['app.js', 'style.css'])) {
        it(file + ' នៅជាមួយ HTML ចាស់ ទោះ probe កំណែចាស់នៅស្រស់', async () => {
            let changed = false;
            const oldHtml = '<script src="./app.js"></script><link rel="stylesheet" href="./style.css">';
            const entries = new Map([['./index.html', oldHtml], ['/' + file, 'old code']]);
            const cache = {
                match: vi.fn(async (key: string) => entries.has(key) ? new Response(entries.get(key)) : undefined),
                put: vi.fn(async (key: string, value: Response) => { entries.set(key, await value.text()); })
            };
            const fetch = vi.fn(async (url: string) => new Response(String(url).endsWith('sw.js')
                ? 'const CACHE_VERSION = "' + (changed ? 'new-deploy-v9999' : probe.version) + '";'
                : 'new code', { headers: { 'content-type': file.endsWith('.css') ? 'text/css' : 'application/javascript' } }));
            const probe = worker(app, fetch, AbortController, cache);
            expect(await probe.shellDeployIsCurrent()).toBe(true);
            changed = true;
            fetch.mockClear();
            const read = async () => {
                let reply!: Promise<Response>;
                const background: Promise<unknown>[] = [];
                probe.handlers.fetch({ request: new Request('https://audit.invalid/' + file),
                    respondWith(value: Promise<Response>) { reply = value; },
                    waitUntil(value: Promise<unknown>) { background.push(value); } });
                const response = await reply;
                await Promise.all(background);
                return response.text();
            };
            expect(await read()).toBe('old code');
            expect(await read()).toBe('old code');
            expect(fetch).not.toHaveBeenCalled();
            expect(entries.get('./index.html')).toBe(oldHtml);
            expect(cache.put).not.toHaveBeenCalled();
        });
    }
});
