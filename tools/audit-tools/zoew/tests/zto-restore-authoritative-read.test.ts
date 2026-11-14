import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { appLocalStore } from '../../../../ZoeW/src/core/storage';
import { firebaseState, securityState } from '../../../../ZoeW/src/core/state';
import { liveShopScope } from '../../../../ZoeW/src/core/shop-scope';
import { requestRestoreAuthorization } from '../../../../ZoeW/src/features/zto-restore-status';
import { setZtoPickupVerdict, ztoPickupStatus } from '../../../../ZoeW/src/features/zto-status';
import { ztoReturnedEvidence } from '../../../../ZoeW/src/features/zto-final-marks';
import { createSupabaseDatabase } from '../../../../ZoeW/src/services/supabase-rtdb';
import { TX_OUTCOME_READ_TIMEOUT_MS, txRestUrl } from '../../../../ZoeW/src/services/tx-outcome';
import { acceptFixtureSession, configureFixtureBackend } from './helpers/accepted-session';
import { createRestoreAttestationFixture } from './helpers/restore-attestation';
import { sealLookupHeader } from './helpers/sealed-lookup';

const sourcePath = 'zoew_recently_deleted_cod_dod/authoritative_source';
const code = 'RESTORE000001';
let fixture: ReturnType<typeof createRestoreAttestationFixture>;
let source: any;
let staleSource: any;
let nodes: Record<string, any>;
let nativeRef: boolean;
let staleSdk: boolean;
let origin: string;
let restCalls: { url: URL; init: RequestInit }[];
let restReply: (value: any) => Response | Promise<Response>;
let get: ReturnType<typeof vi.fn>;

beforeEach(async () => {
    appLocalStore.clear();
    const config = configureFixtureBackend('restore-authoritative-read');
    origin = config.databaseURL;
    const app = { options: config };
    firebaseState.db = { app } as any;
    firebaseState.auth = { app, currentUser: { uid: 'restore-read-user', getIdToken: async () => 'server-read-token' } } as any;
    appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify(await sealLookupHeader({ enabled: true,
        url: window.location.origin + '/.netlify/functions/zto-order-detail?barcode={barcode}', headerName: 'X-Zoe-Proxy-Key' }, 'restore-authoritative-proxy-key')));
    nodes = {};
    nativeRef = true;
    staleSdk = true;
    restCalls = [];
    restReply = value => Response.json(value);
    get = vi.fn(async (ref: any) => ({ val: () => structuredClone(ref.path === sourcePath && staleSdk ? staleSource : nodes[ref.path] ?? null) }));
    firebaseState.fb = { getIdTokenResult: async () => ({ token: 'fixture-id-token' }), get,
        ref: (_db: any, path: string) => ({ path, toString: () => nativeRef ? origin + '/' + path : '[object Object]' }) } as any;
    fixture = createRestoreAttestationFixture({ get: path => nodes[path] ?? null, set: (path, value) => { nodes[path] = value; },
        policy: { v: 1, mode: 'cookie', scope: liveShopScope(), branch: '12345', epoch: 1 },
        lookup: async () => Response.json({ success: true, found: true, barcode: code, cached: false,
            verifiedForRestore: true, restoreTransitionsVerified: true, ztoClosed: false }) });
    source = fixture.source({ id: 'authoritative_source', trashMode: 'cookie', trashGeneration: 2,
        barcodes: [{ code, cod: 7, dod: 2, isDeducted: true }] });
    staleSource = structuredClone(source);
    firebaseState.authGeneration++;
    acceptFixtureSession();
    ztoPickupStatus.clear();
    ztoReturnedEvidence.clear();
    vi.stubGlobal('fetch', vi.fn(async (input: any, init: any) => {
        const url = new URL(String(input));
        if (url.pathname.endsWith('/zto-restore-proof')) return fixture.route(input, init);
        if (url.origin === origin && url.pathname === '/' + sourcePath + '.json') {
            restCalls.push({ url, init });
            return restReply(structuredClone(nodes[sourcePath] ?? null));
        }
        throw new Error('Unexpected fixture transport');
    }));
});

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    securityState.lookupSecretKey = null;
    appLocalStore.clear();
    ztoPickupStatus.clear();
    ztoReturnedEvidence.clear();
    firebaseState.auth = null as any;
    firebaseState.db = null as any;
    firebaseState.fb = null as any;
});

it('native issuer commit is verified through REST while the active SDK query still contains the unsealed source', async () => {
    const operation = fixture.operation();
    const result = await requestRestoreAuthorization(source, operation);
    expect(fixture.answers).toHaveLength(1);
    expect(fixture.answers[0].status).toBe(200);
    expect(nodes[sourcePath]).toMatchObject({ restoreAttestationId: result.attestationId,
        restoreClaim: { token: operation.token, targetId: operation.targetId } });
    expect(staleSource).not.toHaveProperty('restoreAttestationId');
    expect(result).toMatchObject({ kind: 'allow', source: nodes[sourcePath] });
    expect(get.mock.calls.filter(([ref]) => ref.path === sourcePath)).toHaveLength(0);
    expect(restCalls).toHaveLength(1);
    expect(restCalls[0].url.searchParams.get('auth')).toBe('server-read-token');
    expect(restCalls[0].init).toMatchObject({ cache: 'no-store', credentials: 'omit' });
});

it('refresh verifies the current server seal without reusing the old SDK query or retrying authorization', async () => {
    const operation = fixture.operation();
    await requestRestoreAuthorization(source, operation);
    const result = await requestRestoreAuthorization(source, { ...operation, action: 'refresh' });
    expect(result).toMatchObject({ kind: 'allow', source: nodes[sourcePath] });
    expect(fixture.requests.map(request => request.action)).toEqual(['authorize', 'refresh']);
    expect(restCalls).toHaveLength(2);
    expect(get.mock.calls.filter(([ref]) => ref.path === sourcePath)).toHaveLength(0);
});

it.each([
    ['seal', (value: any) => ({ ...value, restoreAttestationId: 'different_seal' }), 'RESTORE_ZTO_UNCONFIRMED'],
    ['token', (value: any) => ({ ...value, restoreClaim: { ...value.restoreClaim, token: 'different_token' } }), 'RESTORE_ZTO_UNCONFIRMED'],
    ['target', (value: any) => ({ ...value, restoreClaim: { ...value.restoreClaim, targetId: 'different_target' } }), 'RESTORE_ZTO_UNCONFIRMED'],
    ['generation', (value: any) => ({ ...value, trashGeneration: 3 }), 'RESTORE_GENERATION_HOLD'],
    ['missing source', () => null, 'RESTORE_GENERATION_HOLD']
])('an issuer ALLOW cannot override an authoritative %s mismatch', async (_name, wrong, reason) => {
    restReply = value => Response.json(wrong(value));
    await expect(requestRestoreAuthorization(source, fixture.operation())).rejects.toThrow(reason);
    expect(fixture.answers[0].body.kind).toBe('allow');
    expect(fixture.requests).toHaveLength(1);
    expect(restCalls).toHaveLength(1);
    expect(get.mock.calls.filter(([ref]) => ref.path === sourcePath)).toHaveLength(0);
});

it.each([403, 503])('HTTP %s during source confirmation holds without SDK fallback or another issuer request', async status => {
    restReply = () => Response.json({ error: 'unavailable' }, { status });
    await expect(requestRestoreAuthorization(source, fixture.operation())).rejects.toThrow('RESTORE_ZTO_UNVERIFIED');
    expect(fixture.requests).toHaveLength(1);
    expect(restCalls).toHaveLength(1);
    expect(get.mock.calls.filter(([ref]) => ref.path === sourcePath)).toHaveLength(0);
});

it('an authoritative-read timeout aborts and holds the same claim without SDK fallback', async () => {
    vi.useFakeTimers();
    let started!: () => void;
    const readStarted = new Promise<void>(resolve => { started = resolve; });
    restReply = () => { started(); return new Promise<Response>(() => {}); };
    const pending = requestRestoreAuthorization(source, fixture.operation()).catch(error => error);
    await readStarted;
    await vi.advanceTimersByTimeAsync(TX_OUTCOME_READ_TIMEOUT_MS);
    expect(await pending).toMatchObject({ message: 'RESTORE_ZTO_UNVERIFIED' });
    expect(restCalls[0].init.signal?.aborted).toBe(true);
    expect(fixture.requests).toHaveLength(1);
    expect(get.mock.calls.filter(([ref]) => ref.path === sourcePath)).toHaveLength(0);
});

it('a session switch while a correct server answer arrives never accepts that answer', async () => {
    restReply = value => { firebaseState.authGeneration++; return Response.json(value); };
    await expect(requestRestoreAuthorization(source, fixture.operation())).rejects.toThrow('RESTORE_SESSION_SWITCHED');
    expect(restCalls).toHaveLength(1);
    expect(fixture.requests).toHaveLength(1);
});

it('a database switch while the REST token is pending prevents the old request from being sent', async () => {
    let tokenReady!: () => void, resolveToken!: (token: string) => void;
    const readingToken = new Promise<void>(resolve => { tokenReady = resolve; });
    firebaseState.auth.currentUser.getIdToken = () => { tokenReady(); return new Promise<string>(resolve => { resolveToken = resolve; }); };
    const pending = requestRestoreAuthorization(source, fixture.operation()).catch(error => error);
    await readingToken;
    firebaseState.db = { other: true } as any;
    resolveToken('late-old-token');
    expect(await pending).toMatchObject({ message: 'RESTORE_SESSION_SWITCHED' });
    expect(restCalls).toHaveLength(0);
    expect(fixture.requests).toHaveLength(1);
});

it('expiry is checked after the authoritative read completes', async () => {
    vi.useFakeTimers();
    restReply = value => { vi.setSystemTime(Date.now() + 120001); return Response.json(value); };
    await expect(requestRestoreAuthorization(source, fixture.operation())).rejects.toThrow('RESTORE_ZTO_UNCONFIRMED');
    expect(restCalls).toHaveLength(1);
});

it('runtime Sign observed during the authoritative read still outranks the issuer ALLOW', async () => {
    restReply = value => { setZtoPickupVerdict(code, true); return Response.json(value); };
    await expect(requestRestoreAuthorization(source, fixture.operation())).rejects.toThrow('RESTORE_ZTO_FINAL');
    expect(fixture.answers[0].body.kind).toBe('allow');
    expect(ztoPickupStatus.get(code)).toMatchObject({ closed: true });
});

it('terminal DENY reads the current server-owned source and preserves its bound cancellation evidence', async () => {
    fixture.setLookup(async () => Response.json({ success: true, found: true, barcode: code, cached: false,
        verifiedForRestore: true, restoreTransitionsVerified: true, ztoClosed: true }));
    const error = await requestRestoreAuthorization(source, fixture.operation()).catch(error => error);
    expect(error).toMatchObject({ message: 'RESTORE_ZTO_FINAL', source: nodes[sourcePath], attestedTerminal: true });
    expect(nodes[sourcePath].restoreBlocked).toBe(true);
    expect(restCalls).toHaveLength(1);
});

it('release is confirmed against the unsealed server source even while the SDK snapshot is obsolete', async () => {
    const operation = fixture.operation();
    await requestRestoreAuthorization(source, operation);
    staleSource = structuredClone(nodes[sourcePath]);
    const result = await requestRestoreAuthorization(source, { ...operation, action: 'release' });
    expect(result).toMatchObject({ kind: 'released', source: nodes[sourcePath] });
    expect(nodes[sourcePath]).not.toHaveProperty('restoreAttestationId');
    expect(nodes[sourcePath]).not.toHaveProperty('restoreClaim');
    expect(staleSource).toHaveProperty('restoreAttestationId');
    expect(restCalls).toHaveLength(2);
});

it('unmodeled references retain their actual get path without trusting the issuer response alone', async () => {
    nativeRef = false;
    staleSdk = false;
    expect(await requestRestoreAuthorization(source, fixture.operation())).toMatchObject({ kind: 'allow', source: nodes[sourcePath] });
    expect(get.mock.calls.filter(([ref]) => ref.path === sourcePath)).toHaveLength(1);
    expect(restCalls).toHaveLength(0);
});

it('the actual Supabase adapter get performs a fresh zoe_read even after its prior snapshot populated cache', async () => {
    let serverValue = staleSource, seq = 0;
    const rpc = vi.fn(async (name: string, args: any) => {
        if (name !== 'zoe_read') throw new Error('Unexpected RPC');
        return { now: Date.now(), docs: [{ r: args.p_root, k: args.p_key, v: structuredClone(serverValue), s: ++seq }] };
    });
    const db = createSupabaseDatabase({ rpc, ping: async () => true, subscribe: () => () => {} },
        { onListenerError: () => {}, onSynced: () => {}, onForbidden: () => {} });
    try {
        const ref = db.ref(sourcePath);
        expect(txRestUrl(ref)).toBe('');
        expect((await db.get(ref)).val()).toEqual(staleSource);
        serverValue = { ...staleSource, restoreAttestationId: 'committed_server_seal', restoreClaim: { token: 'own', targetId: 'target' } };
        expect((await db.get(ref)).val()).toEqual(serverValue);
        expect(rpc.mock.calls.map(([name]) => name)).toEqual(['zoe_read', 'zoe_read']);
    } finally { db.close('test'); }
});
