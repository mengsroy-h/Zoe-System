// @vitest-environment node
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const root = process.env.KEYGEN_TRANSPORT_SOURCE_ROOT || path.resolve(import.meta.dirname, '../../../..');
const source = fs.readFileSync(path.join(root, 'ZoeKeyGen/app.js'), 'utf8');
const functions = new Map<string, string>();
for (const node of require('acorn').parse(source, { ecmaVersion: 'latest' }).body) {
    if (node.type === 'FunctionDeclaration') functions.set(node.id.name, source.slice(node.start, node.end));
}

function app() {
    const context = vm.createContext({
        fetch, AbortController, setTimeout, clearTimeout, SB_ADMIN_TIMEOUT_MS: 2000
    });
    vm.runInContext(['fetchWithTimeout', 'sbAdminRequest'].map(name => {
        const code = functions.get(name);
        if (!code) throw new Error('Missing production function: ' + name);
        return code;
    }).join('\n'), context);
    return context;
}

async function listen(handler: http.RequestListener) {
    const server = http.createServer(handler);
    await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', resolve);
    });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Missing loopback listener');
    return { server, url: 'http://127.0.0.1:' + address.port };
}

async function close(server: http.Server) {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}

for (const status of [301, 302, 303, 307, 308]) {
    it('Supabase Admin៖ HTTP ' + status + ' មិនបញ្ជូនសោ ឬពាក្យសម្ងាត់ទៅ origin ផ្សេង', async () => {
        let destinationRequests = 0;
        let sourceRequests = 0;
        const destination = await listen(async (request, response) => {
            destinationRequests++;
            for await (const _chunk of request) { /* អាន body សាកល្បងរហូតដល់ចប់។ */ }
            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ access_token: 'synthetic-redirect-token' }));
        });
        const original = await listen(async (request, response) => {
            sourceRequests++;
            for await (const _chunk of request) { /* អានឱ្យចប់មុនឆ្លើយ redirect។ */ }
            response.writeHead(status, { Location: destination.url + '/capture' });
            response.end();
        });
        try {
            await expect(app().sbAdminRequest({ url: original.url, key: 'synthetic-publishable' },
                '/auth/v1/token?grant_type=password', 'POST', {
                    email: 'synthetic@example.invalid', password: 'synthetic-password'
                })).rejects.toThrow();
            expect(sourceRequests).toBe(1);
            expect(destinationRequests).toBe(0);
        } finally {
            await Promise.all([close(original.server), close(destination.server)]);
        }
    });
}

it('Supabase Admin៖ response ផ្ទាល់រក្សា login និងកំហុស authorization', async () => {
    const calls: Array<{ path: string, key?: string, auth?: string, body: string }> = [];
    const original = await listen(async (request, response) => {
        let body = '';
        for await (const chunk of request) body += chunk;
        calls.push({ path: request.url || '', key: request.headers.apikey as string,
            auth: request.headers.authorization, body });
        response.writeHead(request.url === '/allowed' ? 200 : 401, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify(request.url === '/allowed' ? { value: 'synthetic-success' } : { code: 'unauthorized' }));
    });
    try {
        const context = app();
        const session = { url: original.url, key: 'synthetic-publishable', token: 'synthetic-session' };
        const success = await context.sbAdminRequest(session, '/allowed', 'POST', { synthetic: true });
        expect(success).toEqual({ ok: true, status: 200, body: { value: 'synthetic-success' } });
        const denied = await context.sbAdminRequest(session, '/denied', 'GET');
        expect(denied).toEqual({ ok: false, status: 401, body: { code: 'unauthorized' } });
        expect(calls).toEqual([
            { path: '/allowed', key: session.key, auth: 'Bearer ' + session.token, body: '{"synthetic":true}' },
            { path: '/denied', key: session.key, auth: 'Bearer ' + session.token, body: '' }
        ]);
    } finally {
        await close(original.server);
    }
});
