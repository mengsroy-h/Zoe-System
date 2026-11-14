// @vitest-environment node
import { generateKeyPairSync, sign, verify } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const root = resolve(import.meta.dirname, '../../../..');
const core = require(resolve(root, 'ZoeW/netlify/functions/_shared/zto-order-detail-core.cjs'));
const { createFirebaseBackend, allowedTargetSlots, sameTerminalBusiness } = require(resolve(root, 'ZoeW/netlify/functions/_shared/zto-restore-firebase.cjs'));
const { terminalEnrichmentCases }: { terminalEnrichmentCases: () => Array<{ name: string; expected: boolean;
    sourceId: string; before: Record<string, any>; after: Record<string, any> }> } = require(resolve(root, 'tools/audit-tools/fixtures/restore-terminal-enrichment.cjs'));
const { createRestoreProofHandler } = require(resolve(root, 'ZoeW/netlify/functions/_shared/zto-restore-proof.cjs'));
const { deadlineBudget } = require(resolve(root, 'ZoeW/netlify/functions/_shared/zto-restore-http.cjs'));
const pair = generateKeyPairSync('rsa', { modulusLength: 2048 });
const pem = pair.publicKey.export({ type: 'spki', format: 'pem' });
const db = 'https://restore-proof-test-default-rtdb.asia-southeast1.firebasedatabase.app';
const sourcePath = 'zoew_recently_deleted_cod_dod/trash-source';
const proofPath = 'zoew_restore_attestations/trash-source';
const input = { v: 1, action: 'authorize', sourceId: 'trash-source', token: 'stable-attempt', targetId: 'history-target', expectedGeneration: 0 };
const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');

function world({ project = 'restore-proof-test', branch = '001', disabled = false, revoked = false, databaseURL = db, rawEtags = false, tokenLifetimeSeconds = 3600 } = {}) {
    const authTime = Math.floor(Date.now() / 1000) - 60;
    const claims = { aud: project, iss: 'https://securetoken.google.com/' + project, sub: 'owned-user', email: 'test@zoew' + branch + '.com',
        exp: Math.floor(Date.now() / 1000) + tokenLifetimeSeconds, iat: Math.floor(Date.now() / 1000), auth_time: authTime };
    const content = encode({ alg: 'RS256', kid: 'test-key' }) + '.' + encode(claims);
    const token = content + '.' + sign('RSA-SHA256', Buffer.from(content), pair.privateKey).toString('base64url');
    const actors = new Map<string, any>([['owned-user', claims]]);
    const nodes = new Map<string, any>([
        ['zoew_restore_policy/shop', { v: 1, mode: 'palm', scope: databaseURL, branch: '001', epoch: 1 }],
        [sourcePath, { id: input.sourceId, phone: 'synthetic-test', scanDate: '2026-11-14', createdAt: Date.now() - 10000,
            deletedAt: Date.now() - 1000, trashMode: 'palm', barcodes: [{ code: 'TEST0001', cod: 10, dod: 2 }] }]
    ]);
    const versions = new Map<string, number>();
    const etag = (path: string) => rawEtags ? Buffer.from('version=' + (versions.get(path) || 0)).toString('base64') : '"' + (versions.get(path) || 0) + '"';
    const writes: Array<{ path: string; value: any }> = [];
    const calls: string[] = [];
    let beforePut: ((path: string, value: any) => void | Promise<void>) | undefined;
    let afterPut: ((path: string, value: any) => void) | undefined;
    let beforeGet: ((path: string) => void) | undefined;
    let revokeDuring = false;
    let conflicts = 0;
    const issuers: string[] = [];
    const env: Record<string, string> = { FIREBASE_PROJECT_IDS: 'restore-proof-test:001', ZOE_ZTO_RESTORE_FIREBASE_DATABASE_URL: databaseURL,
        FCM_SERVICE_ACCOUNT: JSON.stringify({ project_id: 'restore-proof-test', client_email: 'restore@restore-proof-test.iam.gserviceaccount.com',
            private_key: pair.privateKey.export({ type: 'pkcs8', format: 'pem' }) }) };
    const fetchImpl = async (raw: string, init: any) => {
        const url = new URL(raw);
        calls.push(url.origin + url.pathname);
        expect(init.redirect).toBe('error');
        if (url.hostname === 'www.googleapis.com') return Response.json({ 'test-key': pem });
        if (url.hostname === 'oauth2.googleapis.com') {
            const body = new URLSearchParams(init.body);
            const assertion = body.get('assertion')!.split('.');
            expect(verify('RSA-SHA256', Buffer.from(assertion.slice(0, 2).join('.')), pair.publicKey, Buffer.from(assertion[2], 'base64url'))).toBe(true);
            issuers.push(JSON.parse(Buffer.from(assertion[1], 'base64url').toString()).iss);
            return Response.json({ access_token: 'synthetic-access', expires_in: 300 });
        }
        if (url.hostname === 'identitytoolkit.googleapis.com') {
            expect(url.pathname).toBe('/v1/projects/' + project + '/accounts:lookup');
            const ids = JSON.parse(init.body).localId;
            expect(ids).toHaveLength(1);
            const current = actors.get(ids[0]);
            return Response.json({ users: current ? [{ localId: current.sub, email: current.email, disabled,
                validSince: String(revoked || revokeDuring ? current.auth_time + 1 : 0) }] : [] });
        }
        expect(url.origin).toBe(databaseURL);
        expect(url.search).toBe('');
        expect(init.headers.Authorization).toBe('Bearer synthetic-access');
        const path = url.pathname.slice(1, -5);
        if (init.method === 'GET') { beforeGet?.(path); return Response.json(nodes.get(path) ?? null, { headers: { ETag: etag(path) } }); }
        expect(init.method).toBe('PUT');
        const value = JSON.parse(init.body);
        await beforePut?.(path, value);
        if (init.headers['if-match'] !== etag(path)) { conflicts++; return Response.json({ error: 'conflict' }, { status: 412 }); }
        versions.set(path, (versions.get(path) || 0) + 1);
        nodes.set(path, value);
        writes.push({ path, value });
        afterPut?.(path, value);
        return Response.json(value);
    };
    const open = () => createFirebaseBackend({ verifyActor: core.verifyRestoreFirebaseActor })({ env, token, claims, budget: deadlineBudget(), fetchImpl });
    const openAs = (uid: string) => {
        const current = { ...claims, sub: uid, email: uid + '@zoew' + branch + '.com', auth_time: authTime - 30 };
        actors.set(uid, current);
        const payload = encode({ alg: 'RS256', kid: 'test-key' }) + '.' + encode(current);
        const currentToken = payload + '.' + sign('RSA-SHA256', Buffer.from(payload), pair.privateKey).toString('base64url');
        return createFirebaseBackend({ verifyActor: core.verifyRestoreFirebaseActor })({ env, token: currentToken,
            claims: current, budget: deadlineBudget(), fetchImpl });
    };
    return { open, openAs, nodes, versions, writes, calls, env, claims, issuers, get conflicts() { return conflicts; }, setBeforePut(fn: typeof beforePut) { beforePut = fn; },
        setAfterPut(fn: typeof afterPut) { afterPut = fn; },
        setBeforeGet(fn: typeof beforeGet) { beforeGet = fn; }, revoke() { revokeDuring = true; },
        handler: (lookup: any) => createRestoreProofHandler({ env, fetchImpl, lookup, firebaseBackend: createFirebaseBackend({ verifyActor: core.verifyRestoreFirebaseActor }) }),
        request: (body = input) => new Request('https://app.invalid/.netlify/functions/zto-restore-proof', { method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-zoe-id-token': token }, body: JSON.stringify(body) }) };
}

it('actual RSA actor + OAuth assertion + revocation lookup reserve proof before exact-source ETag seal', async () => {
    const w = world();
    const backend = await w.open();
    const context = await backend.context(input);
    const source = structuredClone(w.nodes.get(sourcePath));
    const result = await backend.apply(input, context, 'allow', 'server-proof-1');
    expect(result.kind).toBe('allow');
    expect(w.writes.map(write => write.path)).toEqual([proofPath, sourcePath]);
    expect(w.nodes.get(proofPath)).toMatchObject({ v: 1, id: 'server-proof-1', revision: 1, status: 'allow',
        actorUid: 'owned-user', authTime: w.claims.auth_time * 1000, sourceId: input.sourceId, scope: db,
        codes: { TEST0001: true }, allowedTargetSlots: { '0': 'TEST0001' }, snapshot: source });
    expect(w.nodes.get(sourcePath)).toEqual({ ...source, restorePublication: 1, restoreAttestationId: 'server-proof-1',
        restoreClaim: { token: input.token, targetId: input.targetId, claimedAt: result.source.restoreClaim.claimedAt } });
    expect(JSON.stringify(w.nodes.get(proofPath))).not.toContain('synthetic-access');
    expect(w.writes.every(write => write.path === sourcePath || write.path === proofPath)).toBe(true);
    expect(w.issuers).toEqual(['restore@restore-proof-test.iam.gserviceaccount.com']);
});
it.each([{ project: 'foreign-project' }, { branch: '002' }, { disabled: true }, { revoked: true }])('rejects foreign business identity/branch or revoked account %j', async options => {
    const w = world(options);
    await expect(w.open()).rejects.toMatchObject({ code: 'ZTO_RESTORE_AUTH_REQUIRED' });
    expect(w.writes).toHaveLength(0);
});
it('rechecks account revocation after upstream reads and writes no grant when revoked', async () => {
    const w = world();
    const backend = await w.open();
    const context = await backend.context(input);
    w.revoke();
    await expect(backend.apply(input, context, 'allow', 'server-proof-1')).rejects.toMatchObject({ code: 'ZTO_RESTORE_AUTH_REQUIRED' });
    expect(w.writes).toHaveLength(0);
});
it('source changes after verification lose the source CAS, leaving an unusable unsealed reservation', async () => {
    const w = world();
    const backend = await w.open();
    const context = await backend.context(input);
    w.versions.set(sourcePath, 1);
    await expect(backend.apply(input, context, 'allow', 'server-proof-1')).rejects.toBeTruthy();
    expect(w.writes.map(write => write.path)).toEqual([proofPath]);
    expect(w.nodes.get(sourcePath)).not.toHaveProperty('restoreAttestationId');
});
it.each([false, true])('a pending reservation cannot be replaced by another operation before its source seal commits (foreign actor=%s)', async foreign => {
    const w = world({ rawEtags: true });
    const a = await w.open(), b = foreign ? await w.openAs('other-user') : await w.open();
    const otherInput = { ...input, token: 'other-attempt', targetId: 'other-target' };
    const contextA = await a.context(input);
    let reached!: () => void, resume!: () => void;
    const reachedSource = new Promise<void>(resolve => { reached = resolve; });
    const releaseSource = new Promise<void>(resolve => { resume = resolve; });
    w.setBeforePut(async (path, value) => {
        if (path === sourcePath && value.restoreAttestationId === 'owner-proof-1') {
            reached(); await releaseSource;
        } else if (path === proofPath && value.id === 'other-proof-2') {
            resume(); await aResult;
        }
    });
    const aResult = a.apply(input, contextA, 'allow', 'owner-proof-1');
    await reachedSource;
    const error = await b.context(otherInput).then(context => b.apply(otherInput, context, 'allow', 'other-proof-2'))
        .then(() => null, error => error);
    resume();
    expect((await aResult).kind).toBe('allow');
    expect(w.nodes.get(proofPath).id).toBe(w.nodes.get(sourcePath).restoreAttestationId);
    expect(w.nodes.get(proofPath)).toMatchObject({ id: 'owner-proof-1', token: input.token,
        targetId: input.targetId, actorUid: 'owned-user' });
    expect(error).toMatchObject({ code: 'ZTO_RESTORE_IN_PROGRESS' });
    expect(w.writes.filter(write => write.path === proofPath)).toHaveLength(1);
});
it('a retry after proof reservation committed but source publication crashed retains the original proof id', async () => {
    const w = world();
    const backend = await w.open();
    w.setBeforePut(path => { if (path === sourcePath) throw new Error('crash after private reservation'); });
    await expect(backend.apply(input, await backend.context(input), 'allow', 'owner-proof-1')).rejects.toBeTruthy();
    expect(w.nodes.get(sourcePath)).not.toHaveProperty('restoreAttestationId');
    expect(w.nodes.get(proofPath).id).toBe('owner-proof-1');
    w.setBeforePut(undefined);
    const retry = await backend.context(input);
    expect(retry.reservedAttestationId).toBe('owner-proof-1');
    const result = await backend.apply(input, retry, 'allow', retry.reservedAttestationId);
    expect(result.kind).toBe('allow');
    expect(w.nodes.get(sourcePath).restoreAttestationId).toBe('owner-proof-1');
    expect(w.nodes.get(proofPath)).toMatchObject({ id: 'owner-proof-1', token: input.token, revision: 2 });
});
it('a terminal observer preserves a takeover reservation while its previous source claim is still sealed', async () => {
    vi.useFakeTimers();
    try {
        const w = world();
        const a = await w.open();
        await a.apply(input, await a.context(input), 'allow', 'owner-proof-1');
        await vi.advanceTimersByTimeAsync(120001);
        const b = await w.openAs('next-user'), observer = await w.openAs('observer-user');
        const takeover = { ...input, token: 'next-attempt', targetId: 'next-target' };
        const seen = { ...input, token: 'observer-attempt', targetId: 'observer-target' };
        const context = await b.context(takeover);
        let denied: any, held = false;
        w.setBeforePut(async (path, value) => {
            if (path === sourcePath && value.restoreClaim?.token === takeover.token && !held) {
                held = true;
                const foreign = await observer.context(seen);
                await expect(observer.apply(seen, foreign, 'allow', 'foreign-proof')).rejects.toMatchObject({ code: 'ZTO_RESTORE_IN_PROGRESS' });
                denied = await observer.apply(seen, await observer.context(seen), 'signed', 'observer-proof');
            }
        });
        await expect(b.apply(takeover, context, 'allow', 'owner-proof-1')).rejects.toBeTruthy();
        expect(denied).toMatchObject({ kind: 'deny', code: 'ZTO_RESTORE_TERMINAL_SIGNED' });
        expect(w.nodes.get(proofPath)).toMatchObject({ id: 'owner-proof-1', actorUid: 'next-user',
            token: takeover.token, targetId: takeover.targetId, status: 'deny', verdict: 'signed' });
        expect(w.nodes.get(sourcePath)).toMatchObject({ restorePublication: 2, restoreBlocked: true,
            restoreClaim: { token: takeover.token, targetId: takeover.targetId } });
    } finally { vi.useRealTimers(); }
});
it('an old terminal source read cannot overwrite a newer generation proof read in the same context refresh', async () => {
    const w = world(), a = await w.open();
    const old = await a.context(input), oldSource = structuredClone(w.nodes.get(sourcePath)), oldProof = w.nodes.get(proofPath) ?? null;
    const oldSourceVersion = w.versions.get(sourcePath) || 0, oldProofVersion = w.versions.get(proofPath) || 0;
    await a.apply(input, old, 'allow', 'owner-proof-1');
    const nextSource = { ...oldSource, trashGeneration: 1, deletedAt: oldSource.deletedAt + 1000 };
    delete nextSource.restoreAttestationId; delete nextSource.restoreClaim; delete nextSource.restorePublication;
    w.nodes.set(sourcePath, nextSource);
    w.nodes.set('zoew_trash_consumptions/' + input.sourceId, { v: 1, kind: 'restore', sourceId: input.sourceId,
        generation: 0, token: input.token, targetId: input.targetId, actorUid: 'owned-user', scope: db,
        deletedAt: oldSource.deletedAt, rowBirth: oldSource.createdAt });
    const b = await w.openAs('next-user'), next = { ...input, expectedGeneration: 1, token: 'next-attempt', targetId: 'next-target' };
    await b.apply(next, await b.context(next), 'allow', 'next-proof-2');
    const publishedSource = structuredClone(w.nodes.get(sourcePath)), publishedProof = structuredClone(w.nodes.get(proofPath));
    const sourceVersion = w.versions.get(sourcePath)!, proofVersion = w.versions.get(proofPath)!, before = w.writes.length;
    w.nodes.set(sourcePath, oldSource); w.nodes.set(proofPath, oldProof);
    w.versions.set(sourcePath, oldSourceVersion); w.versions.set(proofPath, oldProofVersion);
    let advanced = false;
    w.setBeforeGet(path => {
        if (path === proofPath && !advanced) {
            advanced = true;
            w.nodes.set(sourcePath, publishedSource); w.nodes.set(proofPath, publishedProof);
            w.versions.set(sourcePath, sourceVersion); w.versions.set(proofPath, proofVersion);
        }
    });
    await expect(a.apply(input, old, 'signed', 'stale-proof')).rejects.toMatchObject({ code: 'ZTO_RESTORE_SOURCE_CHANGED' });
    expect(w.nodes.get(sourcePath)).toEqual(publishedSource);
    expect(w.nodes.get(proofPath)).toEqual(publishedProof);
    expect(w.writes).toHaveLength(before);
});
it('the real controller rechecks providers and reuses its reserved id after an interrupted source publication', async () => {
    const w = world();
    const lookup = vi.fn(async (event: any) => ({ statusCode: 200, body: JSON.stringify({ success: true, found: true, barcode: event.queryStringParameters.barcode,
        cached: false, verifiedForRestore: true, restoreTransitionsVerified: true, ztoClosed: false }) }));
    const handler = w.handler(lookup);
    w.setBeforePut(path => { if (path === sourcePath) throw new Error('crash after proof'); });
    expect((await handler(w.request())).status).toBe(503);
    const reservedId = w.nodes.get(proofPath).id;
    expect(w.nodes.get(sourcePath)).not.toHaveProperty('restoreAttestationId');
    w.setBeforePut(undefined);
    const response = await handler(w.request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ kind: 'allow', attestationId: reservedId });
    expect(lookup).toHaveBeenCalledTimes(2);
    expect(w.nodes.get(sourcePath)).toMatchObject({ restoreAttestationId: reservedId, restorePublication: 1 });
});
it('expired unchanged reservations settle as expired HOLD before a new actor may obtain fresh authority', async () => {
    vi.useFakeTimers();
    try {
        const w = world();
        const a = await w.open();
        w.setBeforePut(path => { if (path === sourcePath) throw new Error('crash after proof'); });
        await expect(a.apply(input, await a.context(input), 'allow', 'owner-proof-1')).rejects.toBeTruthy();
        const reserved = structuredClone(w.nodes.get(proofPath));
        await vi.advanceTimersByTimeAsync(120001);
        w.setBeforePut(undefined);
        const b = await w.openAs('next-user'), nextInput = { ...input, token: 'next-attempt', targetId: 'next-target' };
        const context = await b.context(nextInput);
        expect(context.source).toMatchObject({ restorePublication: 1, restoreAttestationId: reserved.id,
            restoreClaim: { token: reserved.token, targetId: reserved.targetId, claimedAt: reserved.issuedAt } });
        expect(w.nodes.get(proofPath)).toMatchObject({ status: 'hold', verdict: 'unconfirmed', id: reserved.id,
            actorUid: reserved.actorUid, authTime: reserved.authTime, issuedAt: reserved.issuedAt, expiresAt: reserved.expiresAt,
            recovery: { state: 'recovering', actorUid: 'next-user' } });
        expect(w.nodes.get(proofPath).expiresAt).toBeLessThanOrEqual(Date.now());
        const restored = await b.apply(nextInput, context, 'allow', context.source.restoreAttestationId);
        expect(restored.kind).toBe('allow');
        expect(w.nodes.get(sourcePath)).toMatchObject({ restorePublication: 2,
            restoreClaim: { token: nextInput.token, targetId: nextInput.targetId } });
        expect(w.nodes.get(proofPath)).toMatchObject({ status: 'allow', actorUid: 'next-user', token: nextInput.token });
        expect(w.nodes.get(proofPath)).not.toHaveProperty('recovery');
    } finally { vi.useRealTimers(); }
});
it('a crash after the recovery HOLD latch resumes only settlement and fences an old ALLOW context', async () => {
    vi.useFakeTimers();
    try {
        const w = world();
        const a = await w.open(), old = await a.context(input);
        w.setBeforePut(path => { if (path === sourcePath) throw new Error('crash before seal'); });
        await expect(a.apply(input, old, 'allow', 'owner-proof-1')).rejects.toBeTruthy();
        await vi.advanceTimersByTimeAsync(120001);
        const b = await w.openAs('next-user'), next = { ...input, token: 'next-attempt', targetId: 'next-target' };
        await expect(b.context(next)).rejects.toBeTruthy();
        const held = structuredClone(w.nodes.get(proofPath));
        expect(held).toMatchObject({ id: 'owner-proof-1', status: 'hold', recovery: { state: 'recovering' } });
        await expect((await w.open()).apply(input, old, 'allow', 'old-proof')).rejects.toBeTruthy();
        expect(w.nodes.get(proofPath)).toEqual(held);
        w.setBeforePut(undefined);
        const context = await b.context(next);
        expect(context.source).toMatchObject({ restorePublication: 1, restoreAttestationId: 'owner-proof-1' });
        expect(w.nodes.get(proofPath)).toEqual(held);
        expect(w.writes.filter(write => write.path === proofPath)).toHaveLength(2);
    } finally { vi.useRealTimers(); }
});
it.each(['business', 'policy'])('expired orphan recovery holds when the %s differs from its verified reservation', async change => {
    vi.useFakeTimers();
    try {
        const w = world(), a = await w.open();
        w.setBeforePut(path => { if (path === sourcePath) throw new Error('crash before seal'); });
        await expect(a.apply(input, await a.context(input), 'allow', 'owner-proof-1')).rejects.toBeTruthy();
        await vi.advanceTimersByTimeAsync(120001);
        if (change === 'business') w.nodes.get(sourcePath).barcodes[0].cod++;
        else w.nodes.get('zoew_restore_policy/shop').epoch++;
        const before = structuredClone([...w.nodes]);
        w.setBeforePut(undefined);
        const b = await w.openAs('next-user');
        await expect(b.context({ ...input, token: 'next-attempt' })).rejects.toBeTruthy();
        expect([...w.nodes]).toEqual(before);
    } finally { vi.useRealTimers(); }
});
it('the persistent publication fence rejects an old source PUT during a new reservation after release', async () => {
    const w = world(), a = await w.open();
    const old = await a.context(input);
    let ready!: () => void, resume!: () => void;
    const reached = new Promise<void>(resolve => { ready = resolve; }), release = new Promise<void>(resolve => { resume = resolve; });
    let first = true;
    w.setBeforePut(async (path, value) => {
        if (path === sourcePath && value.restoreAttestationId === 'owner-proof-1' && first) { first = false; ready(); await release; }
    });
    const pending = a.apply(input, old, 'allow', 'owner-proof-1').catch(error => error);
    await reached;
    const retry = await a.context(input);
    await a.apply(input, retry, 'allow', retry.reservedAttestationId);
    const drop = { ...input, action: 'release' };
    await a.apply(drop, await a.context(drop), 'unconfirmed', 'owner-proof-1');
    expect(w.nodes.get(sourcePath)).toMatchObject({ restorePublication: 2 });
    expect(w.nodes.get(sourcePath)).not.toHaveProperty('restoreAttestationId');
    const b = await w.openAs('next-user'), next = { ...input, token: 'next-attempt', targetId: 'next-target' };
    const nextContext = await b.context(next);
    w.setBeforePut(async path => { if (path === sourcePath) { resume(); expect((await pending).code).toBe('ZTO_RESTORE_SOURCE_CHANGED'); } });
    await b.apply(next, nextContext, 'allow', 'next-proof-2');
    expect(w.nodes.get(sourcePath)).toMatchObject({ restorePublication: 3, restoreAttestationId: 'next-proof-2',
        restoreClaim: { token: next.token, targetId: next.targetId } });
    expect(w.nodes.get(proofPath)).toMatchObject({ id: 'next-proof-2', actorUid: 'next-user', token: next.token });
});
it.each([0, -1, 1.5, '1', null, 9007199254740991])('invalid persisted publication %j fails closed before authority writes', async value => {
    const w = world(), a = await w.open();
    w.nodes.get(sourcePath).restorePublication = value;
    await expect(a.context(input)).rejects.toBeTruthy();
    expect(w.writes).toHaveLength(0);
});
it('publication MAX never wraps or writes a fresh ALLOW', async () => {
    const w = world(), a = await w.open();
    w.nodes.get(sourcePath).restorePublication = 9007199254740990;
    await expect(a.apply(input, await a.context(input), 'allow', 'owner-proof-1')).rejects.toBeTruthy();
    expect(w.nodes.get(sourcePath).restorePublication).toBe(9007199254740990);
    expect(w.writes).toHaveLength(0);
});
it('a legacy published source upgrades its absent publication fence on a fresh owned refresh', async () => {
    const w = world(), a = await w.open();
    await a.apply(input, await a.context(input), 'allow', 'owner-proof-1');
    delete w.nodes.get(sourcePath).restorePublication;
    const refresh = { ...input, action: 'refresh' }, context = await a.context(refresh);
    expect(context).not.toHaveProperty('reservedAttestationId');
    await a.apply(refresh, context, 'allow', 'owner-proof-1');
    expect(w.nodes.get(sourcePath)).toMatchObject({ restorePublication: 1, restoreAttestationId: 'owner-proof-1' });
});
it('a pending legacy refresh is not mistaken for a published expired source claim', async () => {
    vi.useFakeTimers();
    try {
        const w = world(), a = await w.open();
        await a.apply(input, await a.context(input), 'allow', 'owner-proof-1');
        delete w.nodes.get(sourcePath).restorePublication;
        await vi.advanceTimersByTimeAsync(120001);
        const b = await w.openAs('next-user'), other = { ...input, token: 'next-attempt', targetId: 'next-target' };
        let held = false;
        w.setBeforePut(async (path, value) => {
            if (path === sourcePath && !held) {
                held = true;
                const context = await b.context(other);
                await expect(b.apply(other, context, 'allow', 'other-proof')).rejects.toMatchObject({ code: 'ZTO_RESTORE_IN_PROGRESS' });
                expect(w.nodes.get(proofPath).token).toBe(input.token);
                expect(value.restorePublication).toBe(1);
            }
        });
        const current = await w.open();
        await current.apply(input, await current.context(input), 'allow', 'owner-proof-1');
        expect(w.nodes.get(sourcePath).restorePublication).toBe(1);
        expect(w.nodes.get(proofPath).id).toBe(w.nodes.get(sourcePath).restoreAttestationId);
    } finally { vi.useRealTimers(); }
});
it('an old source publication may win recovery settlement only with the same id and expired HOLD authority', async () => {
    vi.useFakeTimers();
    try {
        const w = world(), a = await w.open();
        let ready!: () => void, resume!: () => void;
        const reached = new Promise<void>(resolve => { ready = resolve; }), released = new Promise<void>(resolve => { resume = resolve; });
        let first = true;
        w.setBeforePut(async path => { if (path === sourcePath && first) { first = false; ready(); await released; } });
        const old = a.apply(input, await a.context(input), 'allow', 'owner-proof-1').catch(error => error);
        await reached;
        await vi.advanceTimersByTimeAsync(120001);
        const b = await w.openAs('next-user'), next = { ...input, token: 'next-attempt', targetId: 'next-target' };
        let committed!: () => void;
        const sourceCommitted = new Promise<void>(resolve => { committed = resolve; });
        w.setAfterPut(path => { if (path === sourcePath) committed(); });
        w.setBeforePut(async path => { if (path === sourcePath) { resume(); await sourceCommitted; } });
        const settled = await b.context(next);
        expect((await old).code).toBe('ZTO_RESTORE_TIMEOUT');
        expect(settled.source).toMatchObject({ restorePublication: 1, restoreAttestationId: 'owner-proof-1',
            restoreClaim: { token: input.token, targetId: input.targetId } });
        expect(w.conflicts).toBe(1);
        expect(w.nodes.get(proofPath)).toMatchObject({ status: 'hold', verdict: 'unconfirmed', token: input.token });
        expect(w.nodes.get(proofPath).expiresAt).toBeLessThanOrEqual(Date.now());
        expect(w.writes.filter(write => write.path === sourcePath)).toHaveLength(1);
    } finally { vi.useRealTimers(); }
});
it('recovery CAS conflicts stop after the bounded budget and retain HOLD for a later settlement', async () => {
    vi.useFakeTimers();
    try {
        const w = world(), a = await w.open();
        w.setBeforePut(path => { if (path === sourcePath) throw new Error('crash before seal'); });
        await expect(a.apply(input, await a.context(input), 'allow', 'owner-proof-1')).rejects.toBeTruthy();
        await vi.advanceTimersByTimeAsync(120001);
        w.setBeforePut(path => { if (path === sourcePath) w.versions.set(path, (w.versions.get(path) || 0) + 1); });
        const b = await w.openAs('next-user'), next = { ...input, token: 'next-attempt', targetId: 'next-target' };
        await expect(b.context(next)).rejects.toMatchObject({ code: 'ZTO_RESTORE_IN_PROGRESS' });
        expect(w.conflicts).toBe(3);
        expect(w.nodes.get(proofPath)).toMatchObject({ status: 'hold', recovery: { state: 'recovering' } });
        expect(w.nodes.get(sourcePath)).not.toHaveProperty('restoreAttestationId');
        expect(w.writes.filter(write => write.path === proofPath)).toHaveLength(2);
        w.setBeforePut(undefined);
        expect((await b.context(next)).source.restorePublication).toBe(1);
        expect(w.nodes.get(proofPath).status).toBe('hold');
    } finally { vi.useRealTimers(); }
});
it.each(['signed', 'returned'])('a released %s denial remains repeatable without recreating a source claim', async verdict => {
    const w = world(), a = await w.open();
    await a.apply(input, await a.context(input), verdict, 'owner-proof-1');
    const release = { ...input, action: 'release' };
    await a.apply(release, await a.context(release), 'unconfirmed', 'owner-proof-1');
    for (let attempt = 0; attempt < 2; attempt++) {
        expect((await a.apply(input, await a.context(input), verdict, 'owner-proof-1')).kind).toBe('deny');
        expect(w.nodes.get(sourcePath)).not.toHaveProperty('restoreAttestationId');
        expect(w.nodes.get(sourcePath)).not.toHaveProperty('restoreClaim');
        expect(w.nodes.get(proofPath)).toMatchObject({ status: 'deny', verdict });
    }
    expect(w.nodes.get(sourcePath).restorePublication).toBe(4);
});
it.each(['signed', 'returned'])('a fresh %s observed after an unsigned release persists a sticky terminal denial', async verdict => {
    const w = world(), a = await w.open();
    await a.apply(input, await a.context(input), 'allow', 'owner-proof-1');
    const release = { ...input, action: 'release' };
    await a.apply(release, await a.context(release), 'unconfirmed', 'owner-proof-1');
    expect(w.nodes.get(proofPath).status).toBe('hold');
    const observer = await w.openAs('observer-user'), seen = { ...input, token: 'observer-attempt', targetId: 'observer-target' };
    const denied = await observer.apply(seen, await observer.context(seen), verdict, 'observer-proof');
    expect(denied).toMatchObject({ kind: 'deny', code: 'ZTO_RESTORE_TERMINAL_' + verdict.toUpperCase() });
    expect(w.nodes.get(proofPath)).toMatchObject({ status: 'deny', verdict, actorUid: 'owned-user', id: 'owner-proof-1' });
    expect(w.nodes.get(sourcePath)).toMatchObject({ restorePublication: 3 });
    expect(w.nodes.get(sourcePath)).not.toHaveProperty('restoreAttestationId');
    expect(w.nodes.get(sourcePath)).not.toHaveProperty('restoreClaim');
    expect((await observer.apply(seen, await observer.context(seen), 'allow', 'unused-proof')).kind).toBe('deny');
});
it('a late allow cannot overwrite a newer HOLD or DENY revision', async () => {
    const w = world();
    const backend = await w.open();
    const late = await backend.context(input);
    const current = await backend.context(input);
    await backend.apply(input, current, 'unconfirmed', 'server-proof-1');
    await expect(backend.apply(input, late, 'allow', 'server-proof-2')).rejects.toBeTruthy();
    expect(w.nodes.get(proofPath).status).toBe('hold');
    expect(w.nodes.get(proofPath).revision).toBe(1);
    expect(w.writes).toHaveLength(2);
});
it('terminal return denies without fabricating a provider timestamp or Signed flag', async () => {
    const w = world();
    const backend = await w.open();
    await backend.apply(input, await backend.context(input), 'returned', 'server-proof-1');
    expect(w.nodes.get(proofPath)).toMatchObject({ status: 'deny', verdict: 'returned' });
    expect(w.nodes.get(sourcePath)).not.toHaveProperty('restoreBlocked');
    expect(w.nodes.get(sourcePath).barcodes[0]).not.toHaveProperty('ztoReturnedAt');
    expect(w.nodes.get(sourcePath).barcodes[0]).not.toHaveProperty('ztoSignedAt');
});
it.each(['remove', 'delete', 'pickup'].flatMap(reason => ['signed', 'returned'].map(verdict => [reason, verdict])))('terminal %s trash retains its financial reason while publishing the %s decision', async (reason, verdict) => {
    const w = world();
    w.nodes.get('zoew_restore_policy/shop').mode = 'cookie';
    Object.assign(w.nodes.get(sourcePath), { trashMode: 'cookie', trashReason: reason, cod: 10, dod: 2, count: 1, price: 12 });
    Object.assign(w.nodes.get(sourcePath).barcodes[0], { isDeducted: reason === 'remove', isFromDeletion: reason !== 'remove' });
    const original = structuredClone(w.nodes.get(sourcePath)), a = await w.open();
    const response = await a.apply(input, await a.context(input), verdict, 'owner-proof-1');
    expect(response.kind).toBe('deny');
    expect(w.nodes.get(sourcePath)).toMatchObject({ ztoTerminalDecision: verdict, restorePublication: 1,
        trashReason: reason, cod: original.cod, dod: original.dod, count: original.count, price: original.price });
    expect(w.nodes.get(sourcePath).barcodes).toEqual(original.barcodes);
    expect(w.nodes.get(proofPath).snapshot).toEqual(original);
    expect(w.nodes.get(proofPath).snapshot).not.toHaveProperty('ztoTerminalDecision');
    const release = { ...input, action: 'release' };
    await a.apply(release, await a.context(release), 'unconfirmed', 'owner-proof-1');
    expect(w.nodes.get(sourcePath)).toMatchObject({ ztoTerminalDecision: verdict, trashReason: reason, restorePublication: 2 });
    expect(w.nodes.get(sourcePath)).not.toHaveProperty('restoreClaim');
    expect(w.nodes.get(sourcePath).barcodes).toEqual(original.barcodes);
});
it.each(terminalEnrichmentCases())('terminal enrichment parity: $name', ({ before, after, sourceId, expected }) => {
    expect(sameTerminalBusiness(before, after, sourceId)).toBe(expected);
});
it('a released returned decision accepts real Sign timestamp enrichment and promotes its source and private verdict', async () => {
    const w = world(), a = await w.open();
    w.nodes.get(sourcePath).trashReason = 'remove';
    await a.apply(input, await a.context(input), 'returned', 'owner-proof-1');
    const release = { ...input, action: 'release' };
    await a.apply(release, await a.context(release), 'unconfirmed', 'owner-proof-1');
    const source = w.nodes.get(sourcePath);
    source.barcodes[0].ztoSignedAt = Date.now() - 1000;
    source.barcodes[0].ztoSignedExact = true;
    source.restoreBlocked = true;
    const raw = structuredClone(source);
    const observer = await w.openAs('observer-user'), seen = { ...input, token: 'observer-attempt', targetId: 'observer-target' };
    const response = await observer.apply(seen, await observer.context(seen), 'returned', 'unused-proof');
    expect(response).toMatchObject({ kind: 'deny', code: 'ZTO_RESTORE_TERMINAL_SIGNED' });
    expect(w.nodes.get(sourcePath)).toMatchObject({ ztoTerminalDecision: 'signed', restoreBlocked: true,
        restorePublication: 3, trashReason: 'remove' });
    expect(w.nodes.get(sourcePath).barcodes).toEqual(raw.barcodes);
    expect(w.nodes.get(sourcePath)).not.toHaveProperty('restoreClaim');
    expect(w.nodes.get(proofPath)).toMatchObject({ verdict: 'signed', actorUid: 'owned-user', token: input.token, snapshot: raw });
});
it('a pending ALLOW still requires the full raw snapshot after otherwise valid terminal enrichment', async () => {
    const w = world(), a = await w.open();
    w.setBeforePut(path => { if (path === sourcePath) throw new Error('crash before source publication'); });
    await expect(a.apply(input, await a.context(input), 'allow', 'owner-proof-1')).rejects.toBeTruthy();
    w.setBeforePut(undefined);
    w.nodes.get(sourcePath).barcodes[0].ztoReturnedAt = Date.now() - 1000;
    const proof = structuredClone(w.nodes.get(proofPath));
    const context = await a.context(input);
    await expect(a.apply(input, context, 'allow', 'owner-proof-1')).rejects.toMatchObject({ code: 'ZTO_RESTORE_IN_PROGRESS' });
    expect(w.nodes.get(proofPath)).toEqual(proof);
    expect(w.nodes.get(sourcePath)).not.toHaveProperty('restoreAttestationId');
});
it.each([null, false, 0, 'unknown', 'Signed'])('native malformed terminal marker %j cannot create authority', async marker => {
    const w = world(), a = await w.open();
    w.nodes.get(sourcePath).ztoTerminalDecision = marker;
    await expect(a.context(input)).rejects.toMatchObject({ code: 'ZTO_RESTORE_UNCONFIRMED' });
    expect(w.writes).toHaveLength(0);
});
it('lost source-ACK retries retain the original logical attempt and proof ID', async () => {
    const w = world();
    const backend = await w.open();
    await backend.apply(input, await backend.context(input), 'allow', 'server-proof-1');
    const restored = await backend.context(input);
    expect(restored.source.restoreClaim.token).toBe(input.token);
    expect(restored.source.restoreAttestationId).toBe('server-proof-1');
    const again = await backend.apply(input, restored, 'allow', 'server-proof-1');
    expect(again.source.restoreAttestationId).toBe('server-proof-1');
    expect(w.nodes.get(proofPath).revision).toBe(2);
    expect(w.writes.filter(write => write.path === sourcePath)).toHaveLength(2);
});
it('release catches history prepared just before durable HOLD and retains the seal', async () => {
    const w = world();
    const backend = await w.open();
    await backend.apply(input, await backend.context(input), 'allow', 'server-proof-1');
    const release = { ...input, action: 'release' };
    const context = await backend.context(release);
    w.setBeforePut((path, value) => {
        if (path === proofPath && value.status === 'hold') {
            w.nodes.set('zoew_scan_history_cod_dod/' + input.targetId, { id: input.targetId, restoreClaimId: input.sourceId, restoreClaimToken: input.token });
        }
    });
    await expect(backend.apply(release, context, 'unconfirmed', 'server-proof-1')).rejects.toMatchObject({ code: 'ZTO_RESTORE_IN_PROGRESS' });
    expect(w.nodes.get(proofPath).status).toBe('hold');
    expect(w.nodes.get(sourcePath).restoreAttestationId).toBe('server-proof-1');
});
it('target positions preserve exact raw codes while provider normalization remains separate', () => {
    const source = { id: input.sourceId, barcodes: [{ code: 'test0001' }, { code: 'TEST0002' }] };
    expect(allowedTargetSlots(source, { barcodes: [{ code: 'EXIST001' }] })).toEqual({ '0': 'EXIST001', '1': 'test0001', '2': 'TEST0002' });
});
it.each(['foreign', 'partial', 'unbound-own'])('refuses a compatible target with %s restore markers', async state => {
    const w = world();
    const source = w.nodes.get(sourcePath);
    w.nodes.set('zoew_scan_history_cod_dod/' + input.targetId, { id: input.targetId, phone: source.phone, scanDate: source.scanDate,
        isClosed: false, barcodes: [{ code: 'EXIST001' }],
        ...(state === 'foreign' ? { restoreClaimId: 'foreign-source', restoreClaimToken: 'foreign-token', restoreAddedCodes: '[]' }
            : state === 'partial' ? { restoreClaimToken: 'foreign-token' }
                : { restoreClaimId: input.sourceId, restoreClaimToken: input.token }) });
    const backend = await w.open();
    const rejected = await backend.context(input).then(() => false, () => true);
    expect(rejected).toBe(true);
    expect(w.writes).toHaveLength(0);
});
it('refresh preserves a prepared subset without reinserting a lost source barcode', async () => {
    const w = world();
    w.nodes.get(sourcePath).barcodes.push({ code: 'TEST0002', cod: 3, dod: 1 });
    const backend = await w.open();
    await backend.apply(input, await backend.context(input), 'allow', 'server-proof-1');
    const source = w.nodes.get(sourcePath);
    w.nodes.set('zoew_scan_history_cod_dod/' + input.targetId, { id: input.targetId, phone: source.phone, scanDate: source.scanDate,
        restoreClaimId: input.sourceId, restoreClaimToken: input.token, restoreAddedCodes: '["TEST0001","TEST0002"]',
        barcodes: [{ code: 'TEST0001', cod: 10, dod: 2 }] });
    const refresh = { ...input, action: 'refresh' };
    const result = await backend.apply(refresh, await backend.context(refresh), 'allow', 'server-proof-1');
    expect(result.kind).toBe('allow');
    expect(w.nodes.get(proofPath).codes).toEqual({ TEST0001: true, TEST0002: true });
    expect(w.nodes.get(proofPath).allowedTargetSlots).toEqual({ '0': 'TEST0001' });
    expect(w.nodes.get('zoew_scan_history_cod_dod/' + input.targetId).barcodes.map((row: any) => row.code)).toEqual(['TEST0001']);
});
it('normalizes an existing sparse unverified neighbor without granting an arbitrary substitute', async () => {
    const w = world();
    const source = w.nodes.get(sourcePath);
    w.nodes.set('zoew_scan_history_cod_dod/' + input.targetId, { id: input.targetId, phone: source.phone, scanDate: source.scanDate,
        barcodes: { '3': { code: 'OLD_B' } } });
    const backend = await w.open();
    const result = await backend.apply(input, await backend.context(input), 'allow', 'server-proof-1');
    expect(result.kind).toBe('allow');
    expect(w.nodes.get(proofPath).codes).toEqual({ TEST0001: true });
    expect(w.nodes.get(proofPath).allowedTargetSlots).toEqual({ '0': 'OLD_B', '1': 'TEST0001' });
    expect(Object.values(w.nodes.get(proofPath).allowedTargetSlots)).not.toContain('NEW_C');
    expect(w.nodes.get('zoew_scan_history_cod_dod/' + input.targetId).barcodes).toEqual({ '3': { code: 'OLD_B' } });
});
it('canonicalizes an absent legacy nested id only during the exact raw-source CAS freeze', async () => {
    const w = world();
    delete w.nodes.get(sourcePath).id;
    const before = structuredClone(w.nodes.get(sourcePath));
    const backend = await w.open();
    const context = await backend.context(input);
    expect(context.source).toEqual(before);
    const response = await backend.apply(input, context, 'allow', 'server-proof-1');
    expect(w.nodes.get(proofPath).snapshot).toEqual(before);
    expect(w.nodes.get(proofPath).snapshot).not.toHaveProperty('id');
    expect(response.source.id).toBe(input.sourceId);
    expect(w.nodes.get(sourcePath).id).toBe(input.sourceId);
});
it('never repairs a conflicting present source id into a different record', async () => {
    const w = world();
    w.nodes.get(sourcePath).id = 'foreign-source';
    const backend = await w.open();
    await expect(backend.context(input)).rejects.toMatchObject({ code: 'ZTO_RESTORE_SOURCE_CHANGED' });
    expect(w.writes).toHaveLength(0);
});
it('accepts a compatible id-less legacy target at its verified key without rewriting its business data', async () => {
    const w = world();
    const source = w.nodes.get(sourcePath);
    const target = { phone: source.phone, scanDate: source.scanDate, barcodes: [{ code: 'EXIST001' }] };
    w.nodes.set('zoew_scan_history_cod_dod/' + input.targetId, target);
    const backend = await w.open();
    const context = await backend.context(input);
    expect(context.target).toEqual(target);
    const result = await backend.apply(input, context, 'allow', 'server-proof-1');
    expect(result.kind).toBe('allow');
    expect(w.nodes.get(proofPath).allowedTargetSlots).toEqual({ '0': 'EXIST001', '1': 'TEST0001' });
    expect(w.nodes.get('zoew_scan_history_cod_dod/' + input.targetId)).toEqual(target);
});
it('rejects a conflicting present target id despite compatible phone and date', async () => {
    const w = world();
    const source = w.nodes.get(sourcePath);
    w.nodes.set('zoew_scan_history_cod_dod/' + input.targetId, { id: 'foreign-target', phone: source.phone, scanDate: source.scanDate, barcodes: [] });
    const backend = await w.open();
    await expect(backend.context(input)).rejects.toMatchObject({ code: 'ZTO_RESTORE_TARGET_CHANGED' });
    expect(w.writes).toHaveLength(0);
});
it('uses real Firebase unquoted ETags exactly for proof and source conditional writes', async () => {
    const w = world({ rawEtags: true });
    const backend = await w.open();
    const context = await backend.context(input);
    expect(context.sourceEtag).toBe(Buffer.from('version=0').toString('base64'));
    const result = await backend.apply(input, context, 'allow', 'server-proof-1');
    expect(result.kind).toBe('allow');
    expect(w.writes.map(write => write.path)).toEqual([proofPath, sourcePath]);
});
it('unquoted source ETag conflicts still reject the write and leave the changed source unsealed', async () => {
    const w = world({ rawEtags: true });
    const backend = await w.open();
    const context = await backend.context(input);
    w.versions.set(sourcePath, 1);
    await expect(backend.apply(input, context, 'allow', 'server-proof-1')).rejects.toBeTruthy();
    expect(w.writes.map(write => write.path)).toEqual([proofPath]);
    expect(w.nodes.get(sourcePath)).not.toHaveProperty('restoreAttestationId');
});
it.each(['*', 'one,two', 'W/"weak"', 'invalid\r\nheader'])('rejects non-exact conditional tag %j', async tag => {
    const w = world();
    const backend = await w.open();
    const context = await backend.context(input);
    context.attestationEtag = tag;
    await expect(backend.apply(input, context, 'allow', 'server-proof-1')).rejects.toMatchObject({ code: 'ZTO_RESTORE_SOURCE_CHANGED' });
    expect(w.writes).toHaveLength(0);
});
it('token expiry during the final policy read writes neither grant nor source claim', async () => {
    vi.useFakeTimers();
    try {
        const w = world({ tokenLifetimeSeconds: 1 });
        const backend = await w.open();
        const context = await backend.context(input);
        w.setBeforeGet(path => { if (path === 'zoew_restore_policy/shop') vi.advanceTimersByTime(1500); });
        const error = await backend.apply(input, context, 'allow', 'server-proof-1').then(() => null, (error: any) => error);
        expect(error?.code).toBe('ZTO_RESTORE_AUTH_REQUIRED');
        expect(w.writes).toHaveLength(0);
    } finally { vi.useRealTimers(); }
});
it.each([false, true])('a terminal proof ETag conflict revokes the winning allow and preserves its owner (foreign observer=%s)', async foreign => {
    const w = world({ rawEtags: true });
    const a = await w.open(), b = foreign ? await w.openAs('observer-user') : await w.open();
    const observerInput = { ...input, token: 'observer-attempt', targetId: 'observer-target' };
    const contextA = await a.context(input), contextB = await b.context(observerInput);
    let installed = false, owner: any;
    w.setBeforePut(async (path, value) => {
        if (path === proofPath && value.status === 'deny' && !installed) {
            installed = true;
            await a.apply(input, contextA, 'allow', 'owner-proof-1');
            owner = structuredClone(w.nodes.get(proofPath));
        }
    });
    const denied = await b.apply(observerInput, contextB, 'signed', 'observer-proof-2');
    expect(w.conflicts).toBeGreaterThanOrEqual(1);
    expect(denied.kind).toBe('deny');
    expect(denied.code).toBe('ZTO_RESTORE_TERMINAL_SIGNED');
    expect(w.nodes.get(proofPath)).toMatchObject({ status: 'deny', verdict: 'signed', id: owner.id, actorUid: owner.actorUid,
        authTime: owner.authTime, token: owner.token, targetId: owner.targetId });
    expect(w.nodes.get(sourcePath).restoreAttestationId).toBe(owner.id);
    expect(w.nodes.get(sourcePath).restoreClaim.token).toBe(owner.token);
    expect(w.nodes.get(sourcePath).restoreBlocked).toBe(true);
    const protectedProof = structuredClone(w.nodes.get(proofPath));
    await expect(a.apply(input, contextA, 'allow', 'late-allow-proof')).rejects.toBeTruthy();
    expect(w.nodes.get(proofPath)).toEqual(protectedProof);
});
it('terminal verification during the reserved-allow-before-source window binds and denies the reserved owner', async () => {
    const w = world({ rawEtags: true });
    const a = await w.open(), b = await w.openAs('observer-user');
    const observerInput = { ...input, token: 'observer-attempt', targetId: 'observer-target' };
    const contextA = await a.context(input), contextB = await b.context(observerInput);
    let denied: any, intercepted = false, reserved: any;
    w.setBeforePut(async (path, value) => {
        if (path === sourcePath && value.restoreAttestationId === 'owner-proof-1' && !intercepted) {
            intercepted = true;
            reserved = structuredClone(w.nodes.get(proofPath));
            denied = await b.apply(observerInput, contextB, 'returned', 'observer-proof-2');
        }
    });
    await expect(a.apply(input, contextA, 'allow', 'owner-proof-1')).rejects.toBeTruthy();
    expect(denied.kind).toBe('deny');
    expect(w.nodes.get(proofPath)).toMatchObject({ id: reserved.id, actorUid: reserved.actorUid, authTime: reserved.authTime,
        token: reserved.token, targetId: reserved.targetId, status: 'deny', verdict: 'returned' });
    expect(w.nodes.get(sourcePath).restoreClaim.token).toBe(reserved.token);
    expect(w.nodes.get(sourcePath).restoreAttestationId).toBe(reserved.id);
    expect(w.nodes.get(sourcePath)).not.toHaveProperty('restoreBlocked');
});
it('a late Sign promotes returned denial while a late Return never downgrades Sign', async () => {
    const w = world();
    const a = await w.open(), b = await w.openAs('observer-user');
    const context = await a.context(input), observer = await b.context(input);
    await a.apply(input, context, 'returned', 'owner-proof-1');
    expect((await b.apply(input, observer, 'signed', 'observer-proof-2')).code).toBe('ZTO_RESTORE_TERMINAL_SIGNED');
    expect(w.nodes.get(proofPath).verdict).toBe('signed');
    expect((await a.apply(input, await a.context(input), 'returned', 'owner-proof-1')).code).toBe('ZTO_RESTORE_TERMINAL_SIGNED');
    expect(w.nodes.get(sourcePath).restoreBlocked).toBe(true);
});
it('terminal rebase refuses changed business content instead of signing a different source', async () => {
    const w = world();
    const a = await w.open(), b = await w.openAs('observer-user');
    const context = await a.context(input), observer = await b.context(input);
    await a.apply(input, context, 'allow', 'owner-proof-1');
    w.nodes.get(sourcePath).barcodes[0].cod = 99;
    w.versions.set(sourcePath, (w.versions.get(sourcePath) || 0) + 1);
    const before = structuredClone(w.nodes.get(proofPath));
    await expect(b.apply(input, observer, 'signed', 'observer-proof-2')).rejects.toBeTruthy();
    expect(w.nodes.get(proofPath)).toEqual(before);
    expect(w.nodes.get(sourcePath).barcodes[0].cod).toBe(99);
});
it('a source ETag conflict after durable denial retries without changing its current owner claim', async () => {
    const w = world();
    const a = await w.open(), b = await w.openAs('observer-user');
    const oldA = await a.context(input), oldB = await b.context(input);
    await a.apply(input, oldA, 'allow', 'owner-proof-1');
    const owner = structuredClone(w.nodes.get(sourcePath).restoreClaim);
    let changed = false;
    w.setBeforePut((path, value) => {
        if (path === sourcePath && value.restoreBlocked && !changed) {
            changed = true;
            w.nodes.get(sourcePath).restoreBlocked = true;
            w.versions.set(sourcePath, (w.versions.get(sourcePath) || 0) + 1);
        }
    });
    expect((await b.apply(input, oldB, 'signed', 'observer-proof-2')).kind).toBe('deny');
    expect(w.conflicts).toBeGreaterThanOrEqual(1);
    expect(w.nodes.get(sourcePath).restoreClaim).toEqual(owner);
    expect(w.nodes.get(proofPath)).toMatchObject({ status: 'deny', verdict: 'signed', actorUid: 'owned-user', id: 'owner-proof-1' });
});
it('persistent terminal CAS conflicts remain an explicit failure, never a false revocation confirmation', async () => {
    const w = world();
    const a = await w.open(), b = await w.openAs('observer-user');
    const oldA = await a.context(input), oldB = await b.context(input);
    await a.apply(input, oldA, 'allow', 'owner-proof-1');
    const owner = structuredClone(w.nodes.get(proofPath));
    w.setBeforePut((path, value) => {
        if (path === proofPath && value.status === 'deny') w.versions.set(proofPath, (w.versions.get(proofPath) || 0) + 1);
    });
    await expect(b.apply(input, oldB, 'signed', 'observer-proof-2')).rejects.toMatchObject({ code: 'ZTO_RESTORE_SOURCE_CHANGED' });
    expect(w.conflicts).toBe(3);
    expect(w.nodes.get(proofPath)).toEqual(owner);
    expect(w.nodes.get(proofPath).status).toBe('allow');
    expect(w.nodes.get(sourcePath)).not.toHaveProperty('restoreBlocked');
});
it('a retained signed denial stamps the source before an owned release unseals it', async () => {
    const w = world();
    const a = await w.open(), b = await w.openAs('observer-user');
    const oldA = await a.context(input), oldB = await b.context(input);
    await a.apply(input, oldA, 'allow', 'owner-proof-1');
    w.setBeforePut((path, value) => {
        if (path === sourcePath && value.restoreBlocked) w.versions.set(sourcePath, (w.versions.get(sourcePath) || 0) + 1);
    });
    await expect(b.apply(input, oldB, 'signed', 'observer-proof-2')).rejects.toBeTruthy();
    expect(w.nodes.get(proofPath)).toMatchObject({ status: 'deny', verdict: 'signed', actorUid: 'owned-user' });
    expect(w.nodes.get(sourcePath)).not.toHaveProperty('restoreBlocked');
    w.setBeforePut(undefined);
    const release = { ...input, action: 'release' };
    const released = await a.apply(release, await a.context(release), 'unconfirmed', 'owner-proof-1');
    expect(released.kind).toBe('released');
    expect(w.nodes.get(sourcePath).restoreBlocked).toBe(true);
    expect(w.nodes.get(sourcePath)).not.toHaveProperty('restoreAttestationId');
    expect(w.nodes.get(sourcePath)).not.toHaveProperty('restoreClaim');
});

function targetAccount(project: string) {
    return { project_id: project, client_email: 'restore@' + project + '.iam.gserviceaccount.com',
        private_key: pair.privateKey.export({ type: 'pkcs8', format: 'pem' }) };
}
it.each(['restore-proof-test', 'second-proof-test'])('selects only the authenticated business project target %s', async project => {
    const targetURL = 'https://' + project + '-default-rtdb.asia-southeast1.firebasedatabase.app';
    const w = world({ project, databaseURL: targetURL });
    w.env.FIREBASE_PROJECT_IDS = 'restore-proof-test:001,second-proof-test:001';
    w.env.ZOE_ZTO_RESTORE_FIREBASE_DATABASE_URL = 'https://legacy-fallback.firebaseio.com';
    for (const target of ['restore-proof-test', 'second-proof-test']) w.env['ZOE_ZTO_RESTORE_FIREBASE_TARGET_' + target.replace(/-/g, '_').toUpperCase()] =
        JSON.stringify({ databaseURL: 'https://' + target + '-default-rtdb.asia-southeast1.firebasedatabase.app', serviceAccount: targetAccount(target) });
    const backend = await w.open();
    const context = await backend.context(input);
    expect(context.scope).toBe(targetURL);
    expect(w.issuers).toEqual(['restore@' + project + '.iam.gserviceaccount.com']);
    expect(w.calls.some(url => url.startsWith('https://legacy-fallback.firebaseio.com'))).toBe(false);
});
it.each(['malformed', 'foreign-account', 'unsafe-url', 'unknown-field'])('configured project target %s never falls back to the legacy credential', async broken => {
    const w = world();
    const target = { databaseURL: db, serviceAccount: targetAccount('restore-proof-test') } as any;
    if (broken === 'foreign-account') target.serviceAccount = targetAccount('other-project');
    if (broken === 'unsafe-url') target.databaseURL = 'https://foreign.invalid/steal';
    if (broken === 'unknown-field') target.urlFromRequest = true;
    w.env.ZOE_ZTO_RESTORE_FIREBASE_TARGET_RESTORE_PROOF_TEST = broken === 'malformed' ? '{invalid' : JSON.stringify(target);
    await expect(w.open()).rejects.toMatchObject({ code: 'ZTO_RESTORE_NOT_CONFIGURED' });
    expect(w.issuers).toHaveLength(0);
    expect(w.writes).toHaveLength(0);
});
