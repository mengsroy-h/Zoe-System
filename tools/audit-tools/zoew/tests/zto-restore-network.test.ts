// @vitest-environment node
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { afterEach, expect, it, vi } from 'vitest';

const root = resolve(import.meta.dirname, '../../../..');
const require = createRequire(import.meta.url);
const palmPath = resolve(root, 'ZoeW/netlify/functions/_shared/zto-palm.js');
const core = require(resolve(root, 'ZoeW/netlify/functions/_shared/zto-order-detail-core.cjs'));
function palmContext(extra = '') {
    const module = { exports: {} as any };
    const context = vm.createContext({ require: createRequire(palmPath), module, exports: module.exports,
        Buffer, URL, URLSearchParams, AbortController, Response, Date, setTimeout, clearTimeout, fetch: globalThis.fetch });
    vm.runInContext(readFileSync(palmPath, 'utf8') + '\n' + extra, context);
    return module.exports;
}
afterEach(() => { core.resetCachesForTests(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

it('trusted Cookie proof rejects an oversized streamed upstream detail before status authorization', async () => {
    for (const [key, value] of Object.entries({ ZTO_PROXY_KEY: 'synthetic-proxy-key-12345678', ZTO_COOKIE: 'synthetic_cookie=value',
        ZTO_DETAIL_IDENTITY: 'off', ZTO_DETAIL_BRANCH_PATHS: 'branchCode', ZTO_FIELD_SIGNED: 'signed', ZTO_SIGNED_VALUES: '1', ZTO_UPSTREAM_RETRIES: '0' })) vi.stubEnv(key, value);
    vi.stubGlobal('fetch', vi.fn(async (_url, init) => {
        const body = JSON.parse(init.body || '{}');
        if (body.condition) return Response.json({ success: true, data: { result: [], total: 0, pages: 0, pageNum: 1, pageSize: 100 } });
        return Response.json({ success: true, data: { billCode: 'TEST0001', consigneePhone: 'synthetic-test',
            signed: '0', branchCode: '001', padding: 'x'.repeat(4 * 1024 * 1024 + 1) } });
    }));
    const response = await core.createTrustedRestoreHandler({ getStore: () => null })({ httpMethod: 'GET',
        headers: { 'x-zoe-proxy-key': 'synthetic-proxy-key-12345678' }, queryStringParameters: { barcode: 'TEST0001', restore: '1' }
    }, { uid: 'actor', scope: 'https://synthetic.firebaseio.com', branch: '001', basis: Date.now() - 1000, expiresAt: Date.now() + 40000 });
    expect(response.statusCode).toBeGreaterThanOrEqual(400);
    expect(JSON.parse(response.body).restoreTransitionsVerified).not.toBe(true);
});

it('trusted Palm tracking rejects a body above its proof response budget', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ status: true, result: [{ mail: { mailNo: 'TEST0001', isSign: 0 },
        tracks: [{ mailNo: 'TEST0001', siteCode: '001', action: '3', time: '2026-11-14 10:00:00' }] }],
        padding: 'x'.repeat(4 * 1024 * 1024 + 1) })));
    const palm = palmContext('module.exports.tracking = palmTracking;');
    const rejected = await palm.tracking('TEST0001', { token: 'synthetic-token', site: '001' }, { sign: 'synthetic-sign' },
        { trustedRestore: true, upstreamMs: () => 1000 }).then(() => false, () => true);
    expect(rejected).toBe(true);
});
it('a cancelled trusted Cookie request schedules no additional transition reads or proof marker', async () => {
    const abort = new AbortController();
    let scans = 0;
    for (const [key, value] of Object.entries({ ZTO_PROXY_KEY: 'synthetic-proxy-key-12345678', ZTO_COOKIE: 'synthetic_cookie=value',
        ZTO_DETAIL_IDENTITY: 'off', ZTO_DETAIL_BRANCH_PATHS: 'branchCode', ZTO_FIELD_SIGNED: 'signed', ZTO_SIGNED_VALUES: '1', ZTO_UPSTREAM_RETRIES: '0' })) vi.stubEnv(key, value);
    vi.stubGlobal('fetch', vi.fn(async (_url, init) => {
        const body = JSON.parse(init.body || '{}');
        if (body.condition) {
            scans++;
            if (scans === 1) abort.abort();
            return Response.json({ success: true, data: { result: [], total: 0, pages: 0, pageNum: 1, pageSize: 100 } });
        }
        return Response.json({ success: true, data: { billCode: 'TEST0001', consigneePhone: 'synthetic-test', signed: '0', branchCode: '001' } });
    }));
    const response = await core.createTrustedRestoreHandler({ getStore: () => null })({ httpMethod: 'GET',
        headers: { 'x-zoe-proxy-key': 'synthetic-proxy-key-12345678' }, queryStringParameters: { barcode: 'TEST0001', restore: '1' }
    }, { uid: 'actor', scope: 'https://synthetic.firebaseio.com', branch: '001', basis: Date.now() - 1000,
        expiresAt: Date.now() + 40000, signal: abort.signal });
    expect(scans).toBe(1);
    expect(response.statusCode).toBeGreaterThanOrEqual(400);
    expect(JSON.parse(response.body).restoreTransitionsVerified).not.toBe(true);
});

function renewalProbe(trusted: boolean, rejected: boolean) {
    const palm = palmContext(`module.exports.probe = async (trusted, rejected) => {
        let renewals = 0, reads = 0;
        branchDeps = (_proxy, _keys, deps) => deps;
        palmGet = async () => { reads++; return rejected && reads === 1
            ? json(401, { code: 'ZTO_AUTH_EXPIRED' }) : json(200, { success: true }); };
        renewShared = async () => { renewals++; return { session: { token: 'new-synthetic-token', site: '001' } }; };
        await palmGetShared({}, { session: { source: 'shared', token: 'old-synthetic-token', site: '001',
            loginAt: Date.now() - SHARED_RENEW_AGE_MS - 1 }, slot: 'owned/001' }, 'proxy', {},
            { trustedRestore: trusted, remainingMs: () => 10000 }, {});
        return { renewals, reads };
    };`);
    return palm.probe(trusted, rejected);
}
it('trusted restore performs no age-only background credential renewal after a successful read', async () => {
    expect(await renewalProbe(true, false)).toEqual({ renewals: 0, reads: 1 });
});
it('ordinary lookups retain their existing age-based refresh behavior', async () => {
    expect(await renewalProbe(false, false)).toEqual({ renewals: 1, reads: 1 });
});
it('trusted restore still awaits an auth-rejected session renewal and verifies the renewed token', async () => {
    expect(await renewalProbe(true, true)).toEqual({ renewals: 1, reads: 2 });
});
