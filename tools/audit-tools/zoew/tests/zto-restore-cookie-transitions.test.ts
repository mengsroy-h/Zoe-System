import { createRequire } from 'node:module';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const req = createRequire(import.meta.url);
const core = req('../../../../ZoeW/netlify/functions/_shared/zto-order-detail-core.cjs');
const code = '11600000000001', branch = '881859', key = 'synthetic-restore-transition-proxy';
let scans: any[] = [], scanBody: (body: any) => any;
const at = () => new Date(Date.now() + 7 * 3600000 - 60000).toISOString().slice(0, 19).replace('T', ' ');
const empty = () => ({ success: true, data: { result: [], total: 0, pages: 0, pageNum: 1, pageSize: 100 } });
beforeEach(() => {
    scans = []; scanBody = empty;
    for (const [name, value] of Object.entries({ ZTO_PROXY_KEY: key, ZTO_COOKIE: 'synthetic_cookie=value',
        ZTO_UPSTREAM_URL: 'https://aargus-api.ztoglobal.com/new-data/order-detail', ZTO_UPSTREAM_METHOD: 'POST',
        ZTO_CACHE_TTL_MS: '0', ZTO_UPSTREAM_RETRIES: '0', ZTO_DETAIL_IDENTITY: 'off', ZTO_DETAIL_BRANCH_PATHS: 'branchCode',
        ZTO_FIELD_SIGNED: 'signed', ZTO_SIGNED_VALUES: '1' })) vi.stubEnv(name, value);
    core.resetCachesForTests();
    vi.stubGlobal('fetch', vi.fn(async (_url: any, options: any) => {
        const body = JSON.parse(options?.body || '{}');
        if (body.condition) { scans.push(body); return Response.json(scanBody(body)); }
        return Response.json({ success: true, data: { billCode: code, consigneePhone: '0970000000',
            agentAmount: 7, signed: '0', branchCode: branch } });
    }));
});
afterEach(() => { core.resetCachesForTests(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

async function read() {
    const handler = core.createTrustedRestoreHandler({ getStore: () => null });
    const response = await handler({ httpMethod: 'GET', headers: { 'x-zoe-proxy-key': key },
        queryStringParameters: { barcode: code, restore: '1' } }, {
        uid: 'actor', scope: 'https://synthetic.firebaseio.com', branch, basis: Date.now() - 86400000, expiresAt: Date.now() + 45000
    });
    return { status: response.statusCode, body: JSON.parse(response.body) };
}

it('trusted Cookie unsigned proof also verifies complete fresh barcode-filtered terminal scan classes', async () => {
    const result = await read();
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ barcode: code, cached: false, ztoClosed: false, verifiedForRestore: true, restoreTransitionsVerified: true });
    expect(scans.map(body => body.condition.scanTypeCode).sort()).toEqual(['03', '-710', '02', '05', '30'].sort());
    expect(scans.every(body => JSON.stringify(body.condition.mailNos) === JSON.stringify([code]) && body.condition.scanSiteCode === branch)).toBe(true);
});

it('fresh return scan cannot hide behind an unsigned Cookie detail response', async () => {
    scanBody = body => body.condition.scanTypeCode === '-710'
        ? { success: true, data: { result: [{ scanBillCode: code, scanTypeCode: '-710', scanTime: at(), scanSiteCode: branch }], total: 1, pages: 1, pageNum: 1, pageSize: 100 } } : empty();
    const result = await read();
    expect(scans.some(body => body.condition.scanTypeCode === '-710')).toBe(true);
    expect(result.body.ztoReturnedAt).toBeGreaterThan(Date.now() - 120000);
    expect(result.body.ztoReturnedAt).not.toBe(result.body.ztoSentOutAt);
    expect(result.body.restoreTransitionsVerified).toBe(true);
});

it('missing pagination proof cannot authorize an unsigned Cookie restore', async () => {
    scanBody = () => ({ success: true, data: { result: [] } });
    const result = await read();
    expect(scans.length).toBeGreaterThan(0);
    expect(result.body.restoreTransitionsVerified).not.toBe(true);
    expect(result.status).toBeGreaterThanOrEqual(400);
});

it.each(['wrong-code', 'wrong-branch', 'missing-branch', 'wrong-type', 'invalid-time', 'future-time', 'contradictory-pages', 'missing-total'])('%s scan evidence remains unknown', async fault => {
    scanBody = body => {
        const row: any = { scanBillCode: code, scanTypeCode: body.condition.scanTypeCode, scanTime: at(), scanSiteCode: branch, problemReason: 'known-other-reason' };
        if (fault === 'wrong-code') row.scanBillCode = '11600000000002';
        if (fault === 'wrong-branch') row.scanSiteCode = 'foreign';
        if (fault === 'missing-branch') delete row.scanSiteCode;
        if (fault === 'wrong-type') row.scanTypeCode = 'foreign';
        if (fault === 'invalid-time') row.scanTime = '2026-02-30 00:00:00';
        if (fault === 'future-time') row.scanTime = new Date(Date.now() + 7 * 3600000 + 60000).toISOString().slice(0, 19).replace('T', ' ');
        const data: any = { result: [row], total: 1, pages: 1, pageNum: body.pageNum, pageSize: 100 };
        if (fault === 'contradictory-pages') data.pages = 2;
        if (fault === 'missing-total') delete data.total;
        return { success: true, data };
    };
    const result = await read();
    expect(scans.length).toBeGreaterThan(0);
    expect(result.status).toBe(503);
    expect(result.body).toMatchObject({ success: false, code: 'ZTO_RESTORE_UNCONFIRMED' });
    expect(result.body.restoreTransitionsVerified).not.toBe(true);
});

it('fresh Sign scan observed after unsigned detail remains terminal', async () => {
    scanBody = body => body.condition.scanTypeCode === '05'
        ? { success: true, data: { result: [{ scanBillCode: code, scanTypeCode: '05', scanTime: at(), scanSiteCode: branch }], total: 1, pages: 1, pageNum: 1, pageSize: 100 } } : empty();
    const result = await read();
    expect(result.body).toMatchObject({ ztoClosed: true, restoreTransitionsVerified: true });
    expect(result.body.ztoSignedAt).toBeGreaterThan(Date.now() - 120000);
});

it('a later fresh arrival excludes a return from the prior upstream cycle', async () => {
    scanBody = body => ['03', '-710'].includes(body.condition.scanTypeCode)
        ? { success: true, data: { result: [{ scanBillCode: code, scanTypeCode: body.condition.scanTypeCode,
            scanTime: body.condition.scanTypeCode === '03' ? new Date(Date.now() + 7 * 3600000 - 30000).toISOString().slice(0, 19).replace('T', ' ') : at(),
            scanSiteCode: branch }], total: 1, pages: 1, pageNum: 1, pageSize: 100 } } : empty();
    const result = await read();
    expect(result.body).toMatchObject({ ztoClosed: false, restoreTransitionsVerified: true });
    expect(result.body.ztoReturnedAt).toBeUndefined();
});

it('incomplete scan metadata on a later page cannot be treated as a complete response', async () => {
    scanBody = body => ({ success: true, data: { result: [{ scanBillCode: code, scanTypeCode: body.condition.scanTypeCode,
        scanTime: at(), scanSiteCode: branch }], total: body.pageNum === 1 ? 2 : 3, pages: 2, pageNum: body.pageNum, pageSize: 1 } });
    const result = await read();
    expect(scans).toHaveLength(2);
    expect(result.status).toBe(503);
    expect(result.body.restoreTransitionsVerified).not.toBe(true);
});
