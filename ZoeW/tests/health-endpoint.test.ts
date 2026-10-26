// @vitest-environment node
import { expect, it } from 'vitest';
import fs from 'node:fs';

it('endpoint ផ្ទៀងបណ្ដាញឆ្លើយ nonce ត្រឹមត្រូវ មិន cache និងមិនទទួលការសរសេរ', async () => {
    const path = new URL('../netlify/functions/health.mjs', import.meta.url);
    expect(fs.existsSync(path)).toBe(true);
    const { default: handler } = await import(/* @vite-ignore */ path.href);
    const nonce = 'a'.repeat(32);
    const res = await handler(new Request('https://audit.invalid/.netlify/functions/health?nonce=' + nonce));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ nonce });
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
    for (const origin of ['https://localhost', 'http://localhost', 'capacitor://localhost']) {
        const reply = await handler(new Request('https://audit.invalid/?nonce=' + nonce, { headers: { Origin: origin } }));
        expect(reply.headers.get('access-control-allow-origin')).toBe(origin);
        expect(reply.headers.get('access-control-allow-credentials')).toBeNull();
        expect(reply.headers.get('vary')).toBe('Origin');
    }
    for (const origin of ['null', 'https://other.invalid', 'https://localhost.other.invalid']) {
        const reply = await handler(new Request('https://audit.invalid/?nonce=' + nonce, { headers: { Origin: origin } }));
        expect(reply.headers.get('access-control-allow-origin')).toBeNull();
    }
    for (const value of ['', 'x', 'a'.repeat(100), '<script>']) {
        expect((await handler(new Request('https://audit.invalid/?nonce=' + encodeURIComponent(value)))).status).toBe(400);
    }
    expect((await handler(new Request('https://audit.invalid/?nonce=' + nonce, { method: 'POST' }))).status).toBe(405);
});
