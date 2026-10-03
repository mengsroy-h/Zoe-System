// @vitest-environment node
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function worker(app: string, fetch: ReturnType<typeof vi.fn>, abort: typeof AbortController | null = AbortController) {
    const source = fs.readFileSync(new URL(app === 'ZoeW' ? '../src/sw/sw.ts' : '../../ZoeKeyGen/sw.js', import.meta.url), 'utf8');
    const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None } }).outputText;
    const context = vm.createContext({
        __CACHE_VERSION__: 'zoew-probe-v1', __CORE_SHELL__: ['./index.html', './app.js'], __OPTIONAL_SHELL__: [], __BACKEND_SHELL__: [],
        self: { location: new URL('https://audit.invalid/sw.js'), addEventListener() {} },
        navigator: { onLine: true }, URL, Request, Response, AbortController: abort,
        fetch, setTimeout, clearTimeout, Date
    });
    vm.runInContext(js + '\nglobalThis.probe = { shellDeployIsCurrent, revalidateShell, timeout: REVALIDATE_TIMEOUT_MS, version: CACHE_VERSION };', context);
    return context.probe;
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
        void probe.revalidateShell({ put: vi.fn() }, new Request('https://audit.invalid/app.js'), '/app.js').then(() => { settled = true; });
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
        void probe.revalidateShell(cache, new Request('https://audit.invalid/app.js'), '/app.js').then(() => { settled = true; });
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
