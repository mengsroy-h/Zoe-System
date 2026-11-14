// @vitest-environment node
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { SB_AUTH_STORAGE_KEY, createSupabaseTransport, sbFetchWithCeiling, sbFetchWithTimeout } from '../../../../ZoeW/src/services/supabase-transport';

let origin: http.Server;
let destination: http.Server;
let originUrl: string;
let destinationUrl: string;
let destinationRequests = 0;
let originRequests = 0;
let healthyRequests = 0;

async function listen(handler: http.RequestListener) {
    const server = http.createServer(handler);
    await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    return { server, url: 'http://127.0.0.1:' + (server.address() as AddressInfo).port };
}

beforeAll(async () => {
    const sink = await listen(async (request, response) => {
        destinationRequests++;
        for await (const chunk of request) void chunk;
        response.setHeader('content-type', 'application/json'); response.end('{"ok":true}');
    });
    destination = sink.server; destinationUrl = sink.url;
    const source = await listen(async (request, response) => {
        originRequests++;
        let body = '';
        for await (const chunk of request) body += String(chunk);
        if (request.url === '/healthy') {
            if (request.headers.apikey === 'synthetic-key' && body === '{"password":"synthetic-only"}') healthyRequests++;
            response.setHeader('content-type', 'application/json'); response.end('{"ok":true}'); return;
        }
        response.writeHead(request.url!.startsWith('/auth/') ? 307 : Number(request.url!.slice(1)), { Location: destinationUrl + '/foreign' }); response.end();
    });
    origin = source.server; originUrl = source.url;
});

afterAll(async () => {
    await Promise.all([origin, destination].filter(Boolean).map(server => new Promise<void>((resolve, reject) => {
        server.closeAllConnections(); server.close(error => error ? reject(error) : resolve());
    })));
});

const options: RequestInit = {
    method: 'POST', redirect: 'follow', headers: { apikey: 'synthetic-key', 'Content-Type': 'application/json' },
    body: '{"password":"synthetic-only"}'
};

for (const [name, request] of [['auth SDK', sbFetchWithCeiling], ['RPC/functions', sbFetchWithTimeout]] as const) {
    describe(name + ' មិនបញ្ជូន credential ទៅ URL ដែល server បង្វែរ', () => {
        for (const status of [301, 302, 303, 307, 308]) it('HTTP ' + status + ' ➜ បដិសេធ ហើយគ្មាន request ទៅគោលដៅផ្សេង', async () => {
            const beforeOrigin = originRequests, beforeDestination = destinationRequests;
            const result = await request(fetch, originUrl + '/' + status, options, 3000)
                .then(() => 'success', () => 'rejected');
            expect(originRequests - beforeOrigin, 'request បានឈានដល់ server ដើមពិត').toBe(1);
            expect(destinationRequests - beforeDestination).toBe(0);
            expect(result).toBe('rejected');
        });

        it('control៖ HTTP 200 នៅគោលដៅដើម នៅបញ្ជូន body/header និងទទួលចម្លើយបាន', async () => {
            const before = healthyRequests;
            const reply = await request(fetch, originUrl + '/healthy', options, 3000);
            expect(reply.status).toBe(200);
            expect(healthyRequests - before).toBe(1);
        });
    });
}

it('supabase-js ពិត៖ login HTTP 307 មិនបញ្ជូន password ឬបង្កើត session តាមគោលដៅបង្វែរ', async () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    const transport = createSupabaseTransport({ supabaseUrl: originUrl, supabaseKey: 'sb_publishable_synthetic' }, {
        fetch, localStorage: storage, sessionStorage: storage, fetchTimeoutMs: 3000
    });
    try {
        const beforeOrigin = originRequests, beforeDestination = destinationRequests;
        await expect(transport.signIn('synthetic@example.invalid', 'synthetic-only')).rejects.toBeInstanceOf(Error);
        expect(originRequests - beforeOrigin).toBe(1);
        expect(destinationRequests - beforeDestination).toBe(0);
        expect(storage.getItem(SB_AUTH_STORAGE_KEY)).toBeNull();
    } finally { transport.close(); logged.mockRestore(); }
});
