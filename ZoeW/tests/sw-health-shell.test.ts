// @vitest-environment node
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';

function worker(missing = '', backend = false, rejects = false, exists = true, htmlScript = false, redirected = false, redirectOrigin = 'https://audit.invalid') {
    const handlers: Record<string, (event: any) => void> = {};
    const source = fs.readFileSync(new URL('../src/sw/sw.ts', import.meta.url), 'utf8');
    const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None } }).outputText;
    const match = vi.fn(async (input: string, options: { cacheName: string }) => {
        expect(options.cacheName).toBe('health-v1');
        const key = '.' + new URL(input).pathname;
        if (!exists) return undefined;
        if (rejects) throw new Error('denied');
        if (key === missing) return undefined;
        if (key === './__zoew-backend-used') return backend ? new Response('1') : undefined;
        const response = new Response('ok', { headers: { 'content-type': key.endsWith('.js') && !htmlScript ? 'text/javascript' : 'text/html' } });
        if (redirected && key.endsWith('.html')) {
            Object.defineProperty(response, 'redirected', { value: true });
            Object.defineProperty(response, 'url', { value: redirectOrigin + '/' });
        }
        return response;
    });
    const open = vi.fn(async () => ({ match }));
    const fetch = vi.fn();
    vm.runInNewContext(js, {
        __CACHE_VERSION__: 'health-v1', __CORE_SHELL__: ['./index.html', './app.js'], __OPTIONAL_SHELL__: ['./optional.js'], __BACKEND_SHELL__: ['./firebase.js'],
        self: { location: new URL('https://audit.invalid/sw.js'), addEventListener(type: string, cb: any) { handlers[type] = cb; } },
        caches: { match, open }, URL, Response, fetch, setTimeout, clearTimeout
    });
    return { handlers, match, open, fetch };
}

async function request(w: ReturnType<typeof worker>) {
    const replies: unknown[] = [];
    let pending: Promise<unknown> | undefined;
    expect(w.handlers.message).toBeTypeOf('function');
    w.handlers.message({ data: { type: 'ZOEW_HEALTH_SHELL' }, ports: [{ postMessage: (x: unknown) => replies.push(x) }], waitUntil: (p: Promise<unknown>) => { pending = p; } });
    await pending;
    expect(w.fetch).not.toHaveBeenCalled();
    expect(w.open).not.toHaveBeenCalled();
    return replies[0];
}

describe('SW ផ្ទៀងសំបកដោយអាន cache ពិត', () => {
    it('គ្រប់ core ➜ ready មិនតម្រូវ optional', async () => {
        expect(await request(worker('./optional.js'))).toEqual({ type: 'ZOEW_HEALTH_SHELL', version: 'health-v1', ready: true });
    });
    it.each(['./index.html', './app.js'])('ខ្វះ %s ➜ មិន ready', async (missing) => {
        expect(await request(worker(missing))).toMatchObject({ ready: false });
    });
    it('Firebase ដែលប្រើរួចត្រូវមានសំបក backend', async () => {
        expect(await request(worker('./firebase.js', true))).toMatchObject({ ready: false });
    });
    it('Supabase មិនត្រូវទាមទារ Firebase ដែលមិនបានប្រើ', async () => {
        expect(await request(worker('./firebase.js', false))).toMatchObject({ ready: true });
    });
    it('cache អានមិនបាន ➜ មិន ready', async () => {
        expect(await request(worker('', false, true))).toMatchObject({ ready: false });
    });
});

it('cache គ្មាន ➜ មិនបង្កើត cache ថ្មី', async () => {
    const w = worker('', false, false, false);
    expect(await request(w)).toMatchObject({ ready: false });
    expect(w.open).not.toHaveBeenCalled();
});
it('JS ត្រូវបានជំនួសដោយ HTML ➜ មិនបៃតង', async () => {
    expect(await request(worker('', false, false, true, true))).toMatchObject({ ready: false });
});

it('HTML ដែល install ទទួលក្រោយ canonical redirect នៅក្នុង cache ➜ មិនព្រមានខុស', async () => {
    expect(await request(worker('', false, false, true, false, true))).toMatchObject({ ready: true });
});

it('HTML redirect ទៅ origin ផ្សេង ➜ មិនបៃតង', async () => {
    expect(await request(worker('', false, false, true, false, true, 'https://other.invalid'))).toMatchObject({ ready: false });
});
