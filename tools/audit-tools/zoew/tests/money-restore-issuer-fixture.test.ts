// @vitest-environment node
import { createRequire } from 'node:module';
import path from 'node:path';
import { expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url), root = path.resolve(__dirname, '../../../..');
const { createMoneyRestoreIssuer } = require(root + '/tools/audit-tools/fixtures/money-restore-issuer.cjs');
const fx = require(root + '/tools/audit-tools/idtoken-fixture.js');
const project = 'demo-zoe-moneymd', databaseURL = 'http://127.0.0.1:9000?ns=money-fixture-contract';
const input = { v: 1, action: 'authorize', sourceId: 'source', token: 'attempt', targetId: 'target', expectedGeneration: 0 };

// transport ក្នុងសតិប៉ុណ្ណោះ; មិនមែនភស្តុតាង RTDB/Postgres ពិត។
function fixture(verdict: 'allow' | 'signed' | 'unknown' = 'allow', conflict = false, etagFormat: 'quoted' | 'unquoted' = 'quoted') {
    const now = Date.now(), nodes = new Map<string, any>([
        ['zoew_restore_policy/shop', { v: 1, mode: 'cookie', scope: databaseURL, branch: '1', epoch: 1 }],
        ['zoew_recently_deleted_cod_dod/source', { id: 'source', phone: '012345678', scanDate: '2026-11-14',
            createdAt: now - 10000, deletedAt: now - 1000, trashMode: 'cookie', barcodes: [{ code: 'TEST0001', createdAt: now - 10000 }] }]
    ]);
    const versions = new Map<string, number>(), writes: string[] = [], lookups: any[] = [];
    const issuer = createMoneyRestoreIssuer({ root, project, firebasePort: 9000, env: { FIREBASE_PROJECT_IDS: project + ':1' },
        lookup: async (event: any, actor: any) => {
            lookups.push({ event, actor });
            return { statusCode: 200, body: JSON.stringify({ success: true, found: true, barcode: event.queryStringParameters.barcode, cached: false,
                ztoClosed: verdict === 'signed', verifiedForRestore: verdict !== 'unknown', restoreTransitionsVerified: verdict !== 'unknown' }) };
        },
        fetchImpl: async (raw: string, init: any) => {
            const url = new URL(raw), location = url.pathname.slice(1, -5), headers = new Headers(init.headers);
            expect(url.origin + url.search).toBe(databaseURL);
            expect(headers.get('authorization')).toBe('Bearer owner');
            const version = versions.get(location) || 0;
            const tag = etagFormat === 'unquoted' ? Buffer.from('fixture-cas:' + version).toString('base64') : '"' + version + '"';
            if (init.method === 'GET') return Response.json(nodes.get(location) ?? null, { headers: { ETag: tag } });
            expect(init.method).toBe('PUT');
            if (headers.get('if-match') !== tag) return Response.json({ error: 'conflict' }, { status: 412 });
            versions.set(location, (versions.get(location) || 0) + 1);
            const value = JSON.parse(init.body); nodes.set(location, value); writes.push(location);
            if (conflict && location === 'zoew_restore_attestations/source') versions.set('zoew_recently_deleted_cod_dod/source', 1);
            return Response.json(value);
        }
    });
    issuer.registerFirebaseActor({ uid: 'actual-fixture-user', email: 'test@zoew1.com', databaseURL });
    const token = fx.tokenFor('test@zoew1.com', { aud: project, claims: { sub: 'actual-fixture-user', auth_time: Math.floor(now / 1000) - 1 } });
    const send = (idToken = token) => issuer.handle(new Request('http://127.0.0.1:12345/.netlify/functions/zto-restore-proof', {
        method: 'POST', headers: { 'content-type': 'application/json', 'x-zoe-id-token': idToken }, body: JSON.stringify(input)
    }));
    return { issuer, send, nodes, writes, lookups };
}

it.each(['quoted', 'unquoted'] as const)('issuer fixture %s រក្សា RSA actor និង namespace/ETag តាម controller ពិត', async etagFormat => {
    const f = fixture('allow', false, etagFormat), response = await f.send(), result = await response.json();
    expect(response.status).toBe(200); expect(result.kind).toBe('allow');
    expect(f.writes).toEqual(['zoew_restore_attestations/source', 'zoew_recently_deleted_cod_dod/source']);
    expect(f.nodes.get('zoew_restore_attestations/source')).toMatchObject({ status: 'allow', actorUid: 'actual-fixture-user', scope: databaseURL });
    expect(f.nodes.get('zoew_recently_deleted_cod_dod/source')).toMatchObject({ restoreAttestationId: result.attestationId,
        restoreClaim: { token: input.token, targetId: input.targetId } });
    expect(f.lookups).toHaveLength(1); expect(f.lookups[0].actor.scope).toBe(databaseURL);
    expect(() => f.issuer.registerFirebaseActor({ uid: 'remote', email: 'test@zoew1.com', databaseURL: 'https://unowned.invalid' })).toThrow();
    expect(() => f.issuer.registerFirebaseActor({ uid: 'other', email: 'test@zoew1.com', databaseURL: databaseURL + '&auth=owner' })).toThrow();
});

it.each(['signed', 'unknown'] as const)('issuer fixture %s មិនចេញ ALLOW', async verdict => {
    const f = fixture(verdict), response = await f.send(), result = await response.json();
    expect(result.kind).not.toBe('allow');
    expect(f.nodes.get('zoew_restore_attestations/source').status).toBe(verdict === 'signed' ? 'deny' : 'hold');
    expect(f.nodes.get('zoew_recently_deleted_cod_dod/source').restoreBlocked).toBe(verdict === 'signed' ? true : undefined);
});

it('issuer fixture បដិសេធ actor មិនត្រូវ និងរក្សា source ពេល CAS បាត់', async () => {
    const f = fixture('allow', true), response = await f.send();
    expect(response.status).not.toBe(200);
    expect(f.writes).toEqual(['zoew_restore_attestations/source']);
    expect(f.nodes.get('zoew_recently_deleted_cod_dod/source').restoreAttestationId).toBeUndefined();
    const foreign = fixture(), forged = fx.tokenFor('test@zoew1.com', { aud: project, forge: true,
        claims: { sub: 'actual-fixture-user', auth_time: Math.floor(Date.now() / 1000) - 1 } });
    expect((await foreign.send(forged)).status).toBe(401);
    expect(foreign.writes).toEqual([]); expect(foreign.lookups).toEqual([]);
});

it.each(['allow', 'deny'])('proof network gate %s កាន់ ACK តែក្រោយ source commit', async kind => {
    const { networkGate } = require(root + '/tools/audit-tools/money-cookie-blob.js');
    let proofRoute: any;
    const gate = await networkGate({ route: async (_url: RegExp, handler: any) => { proofRoute = handler; }, routeWebSocket: async () => {} },
        'firebase', undefined, { restoreProof: true });
    const source = { id: input.sourceId, restoreClaim: { token: input.token, targetId: input.targetId } };
    const response = { json: async () => ({ success: true, kind, source }) };
    const route = { request: () => ({ postDataJSON: () => input }), fetch: vi.fn(async () => response),
        fulfill: vi.fn(async () => {}), abort: vi.fn(async () => {}), continue: vi.fn(async () => {}) };
    gate.arm('after');
    const sending = proofRoute(route);
    try {
        if (kind === 'allow') {
            await gate.hit();
            expect(route.fulfill).not.toHaveBeenCalled();
            expect(gate.evidence().boundaries).toEqual([{ stage: 'after', operations: [{ path: 'zoew_recently_deleted_cod_dod/source', value: source }] }]);
        } else { await sending; expect(gate.hits).toBe(0); expect(gate.evidence().boundaries).toEqual([]); }
    } finally { gate.release(); await sending; }
    expect(route.fetch).toHaveBeenCalledOnce(); expect(route.fulfill).toHaveBeenCalledOnce();
});
