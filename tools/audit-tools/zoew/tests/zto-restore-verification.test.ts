import { createRequire } from 'node:module';
import { createRestoreAttestationFixture } from './helpers/restore-attestation';
import { liveShopScope } from '../../../../ZoeW/src/core/shop-scope';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { acceptFixtureSession, configureFixtureBackend } from './helpers/accepted-session';
import { appLocalStore } from '../../../../ZoeW/src/core/storage';
import { dataState, firebaseState, securityState, uiState, ztoState } from '../../../../ZoeW/src/core/state';
import { sealLookupHeader } from './helpers/sealed-lookup';
import { autoLookupInFlight } from '../../../../ZoeW/src/features/auto-lookup';
import { verifyZtoRestoreStatus as actualVerifyZtoRestoreStatus } from '../../../../ZoeW/src/features/zto-restore-status';
import { runZtoStatusSweep, setZtoPickupVerdict, ztoPickupStatus, ztoStatusPendingCodes } from '../../../../ZoeW/src/features/zto-status';
import { collectZtoFinalTargets } from '../../../../ZoeW/src/features/zto-final-marks';

const req = createRequire(import.meta.url);
const proxy = req('../../../../ZoeW/netlify/functions/_shared/zto-order-detail-core.cjs');
const fx = req('../../idtoken-fixture.js');
const code = '77130500000012';
const key = 'restore-proof-key-0123456789abcdef';
let fixture: ReturnType<typeof createRestoreAttestationFixture>;
let nodes: Record<string, any>;
const source = () => fixture.source({ trashMode: 'cookie', barcodes: [{ code }] });
const verify = (item: any) => actualVerifyZtoRestoreStatus(fixture.source(item, item.id || (item.trashMode === 'local' ? 'local_source' : 'restore_source')), fixture.operation());
const grant = () => fixture.get('zoew_restore_attestations/restore_source');
const installProvider = (provider: any) => vi.stubGlobal('fetch', vi.fn(async (input: any, init: any) => {
    if (new URL(String(input)).pathname.endsWith('/zto-restore-proof')) return fixture.route(input, init);
    const body = init?.body && typeof init.body === 'string' ? JSON.parse(init.body) : null;
    if (body?.condition) return Response.json({ success: true, data: { result: [], total: 0, pages: 0, pageNum: 1, pageSize: 100 } });
    return provider(input, init);
}));
const proof = (patch = {}) => ({ success: true, found: true, barcode: code, ztoClosed: false, cached: false, verifiedForRestore: true, restoreTransitionsVerified: true, ...patch });
const order = (signed: boolean): any => ({ success: true, data: { billCode: code, consigneePhone: '0970000000', agentAmount: 7, arrivalServiceCharge: 1, signed: signed ? '1' : '0', dispSiteCode: '12345' } });
const call = async (restore = false) => {
    const response = await proxy.handler({ httpMethod: 'GET', headers: { 'x-zoe-proxy-key': key }, queryStringParameters: { barcode: code, ...(restore ? { restore: '1' } : {}) } });
    return { status: response.statusCode, body: JSON.parse(response.body) };
};

beforeEach(async () => {
    appLocalStore.clear();
    configureFixtureBackend('zto-restore-verification');
    appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify(await sealLookupHeader({ enabled: true, url: window.location.origin + '/.netlify/functions/zto-order-detail?barcode={barcode}', headerName: 'X-Zoe-Proxy-Key' }, key)));
    firebaseState.auth = { currentUser: { uid: 'restore-user' } } as any;
    nodes = {};
    firebaseState.db = { restoreProof: true } as any;
    firebaseState.fb = { getIdTokenResult: async () => ({ token: 'restore-id-token' }),
        ref: (_db: unknown, path: string) => ({ path }), get: async (ref: any) => ({ val: () => structuredClone(nodes[ref.path] ?? null) }) } as any;
    fixture = createRestoreAttestationFixture({ get: path => nodes[path] ?? null, set: (path, value) => { nodes[path] = value; },
        policy: { v: 1, mode: 'cookie', scope: liveShopScope(), branch: '12345', epoch: 1 } });
    firebaseState.authGeneration++;
    acceptFixtureSession();
    ztoPickupStatus.clear();
    ztoState.ztoStatusLoaded = true;
    vi.stubEnv('ZTO_PROXY_KEY', key);
    vi.stubEnv('ZTO_API_URL', 'https://aargus-api.ztoglobal.com/new-data/order-detail');
    vi.stubEnv('ZTO_API_METHOD', 'POST');
    vi.stubEnv('ZTO_FIELD_BARCODE', 'billCode');
    vi.stubEnv('ZTO_COOKIE', 'BOS-MAN-SESSION=restore-proof-test');
    vi.stubEnv('ZTO_CACHE_TTL_MS', '60000');
    vi.stubEnv('ZTO_UPSTREAM_RETRIES', '0');
    vi.stubEnv('ZTO_DETAIL_IDENTITY', 'off');
    vi.stubEnv('ZTO_FIELD_SIGNED', 'signed');
    vi.stubEnv('ZTO_DETAIL_BRANCH_PATHS', 'dispSiteCode');
    vi.stubEnv('ZTO_SIGNED_VALUES', '1');
    proxy.resetCachesForTests();
});

afterEach(() => {
    securityState.lookupSecretKey = null;
    vi.useRealTimers();
    appLocalStore.clear();
    ztoPickupStatus.clear();
    dataState.scanHistory = [];
    dataState.deletedItems = [];
    firebaseState.auth = null as any;
    firebaseState.fb = null as any;
    proxy.resetCachesForTests();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
});

it('policy epoch 9007199254740991 មិនមានសុពលភាព ហើយមិនអនុញ្ញាត HTTP ឬ claim', async () => {
    fixture.set('zoew_restore_policy/shop', { v: 1, mode: 'cookie', scope: liveShopScope(), branch: '12345', epoch: 9007199254740991 });
    installProvider(vi.fn(() => { throw new Error('invalid epoch must stop before transport'); }));
    await expect(verify(source())).rejects.toThrow('RESTORE_SHOP_MODE_UNSYNCED');
    expect(fetch).not.toHaveBeenCalled();
    expect(fixture.get('zoew_recently_deleted_cod_dod/restore_source')).not.toHaveProperty('restoreClaim');
    expect(grant()).toBeNull();
});

it('policy epoch 9007199254740990 អនុញ្ញាត fresh issuer និង DB seal ត្រឹមត្រូវ', async () => {
    fixture.set('zoew_restore_policy/shop', { v: 1, mode: 'cookie', scope: liveShopScope(), branch: '12345', epoch: 9007199254740990 });
    installProvider(vi.fn(async () => Response.json(order(false))));
    await expect(verify(source())).resolves.toMatchObject({ kind: 'allow' });
    expect(grant()).toMatchObject({ policyEpoch: 9007199254740990, status: 'allow', verdict: 'allow' });
    expect(fixture.get('zoew_recently_deleted_cod_dod/restore_source')).toHaveProperty('restoreAttestationId', grant().id);
    expect(ztoPickupStatus.get(code)).toMatchObject({ closed: false });
});

it('ស្តារប្រើ Function ពិតផ្ទៀង unsigned ហើយចាប់ Sign ថ្មីដោយមិនជឿ cache', async () => {
    let signed = false;
    installProvider( vi.fn(async (input: any, options: any) => {
        const url = new URL(String(input));
        if (url.pathname === '/.netlify/functions/zto-order-detail') {
            const result = await proxy.handler({ httpMethod: 'GET', headers: Object.fromEntries(new Headers(options.headers)), queryStringParameters: Object.fromEntries(url.searchParams) });
            return new Response(result.body, { status: result.statusCode });
        }
        return Response.json(order(signed), { status: 200 });
    }));
    await verify(source());
    expect(grant()).toMatchObject({ status: 'allow', verdict: 'allow' });
    expect(ztoPickupStatus.get(code)).toMatchObject({ closed: false });
    signed = true;
    await expect(verify(source())).rejects.toThrow('RESTORE_ZTO_FINAL');
    expect(grant()).toMatchObject({ status: 'deny', verdict: 'signed' });
    expect(ztoPickupStatus.get(code), 'server DENY does not invent a runtime Signed observation').toMatchObject({ closed: false });
});

it.each([
    [{ cached: true }, 'RESTORE_ZTO_UNCONFIRMED'], [{ barcode: '77130500000999' }, 'RESTORE_ZTO_UNCONFIRMED'],
    [{ verifiedForRestore: undefined }, 'RESTORE_ZTO_UNCONFIRMED'], [{ ztoClosed: null }, 'RESTORE_ZTO_UNCONFIRMED'],
    [{ found: false }, 'RESTORE_ZTO_UNCONFIRMED'], [{ found: false, success: false, code: 'ZTO_OTHER_BRANCH' }, 'RESTORE_ZTO_UNCONFIRMED'],
    [{ success: false }, 'RESTORE_ZTO_UNCONFIRMED']
])('ភស្តុតាងមិនពេញលេញមិនអនុញ្ញាតស្តារ (%j)', async (patch, reason) => {
    fixture.setLookup(async () => Response.json(proof(patch)));
    installProvider(vi.fn(() => { throw new Error('no upstream transport in projected negative case'); }));
    await expect(verify(source())).rejects.toThrow(reason);
    expect(ztoPickupStatus.size).toBe(0);
});

it('ZTO_NOT_FOUND ថ្មីមិនបញ្ជាក់ unsigned ហើយ cache ឬ barcode ខុសមិនអាចផ្តល់ភស្តុតាង', async () => {
    const notFound = (patch = {}) => ({ success: false, found: false, barcode: code, code: 'ZTO_NOT_FOUND', cached: false, ...patch });
    const fetcher = vi.fn(async () => Response.json(notFound()));
    fixture.setLookup(fetcher);
    installProvider(vi.fn(() => { throw new Error('projected lookup uses the issuer seam'); }));
    await expect(verify(source())).rejects.toThrow('RESTORE_ZTO_UNCONFIRMED');
    expect(ztoPickupStatus.size).toBe(0);
    expect((vi.mocked(fetch).mock.calls[0] as any)[1]?.cache, 'Function request keeps the CORS preflight cache (no no-store)').toBeUndefined();
    fixture.setLookup(async () => Response.json(notFound({ cached: true })));
    await expect(verify(source())).rejects.toThrow('RESTORE_ZTO_UNCONFIRMED');
    fixture.setLookup(async () => Response.json(notFound({ barcode: '77130500000999' })));
    await expect(verify(source())).rejects.toThrow('RESTORE_ZTO_UNCONFIRMED');
    fixture.setLookup(async () => Response.json(notFound(), { status: 503 }));
    await expect(verify(source())).rejects.toThrow('RESTORE_ZTO_UNCONFIRMED');
    expect(grant()).toMatchObject({ status: 'hold', verdict: 'unconfirmed' });
});

it.each([null, {}, { signed: '1' }])('Function ពិត ៖ upstream data %j ដែលគ្មានអត្តសញ្ញាណ barcode មិនបញ្ជាក់ថាមិនមែន ZTO ឬមិនទាន់ Sign', async data => {
    installProvider( vi.fn(async (input: any, options: any) => {
        const url = new URL(String(input));
        if (url.pathname === '/.netlify/functions/zto-order-detail') {
            const result = await proxy.handler({ httpMethod: 'GET', headers: Object.fromEntries(new Headers(options.headers)), queryStringParameters: Object.fromEntries(url.searchParams) });
            return new Response(result.body, { status: result.statusCode });
        }
        return Response.json({ success: true, data }, { status: 200 });
    }));
    expect((await call(true)).body).toMatchObject({ found: false, code: 'ZTO_NOT_FOUND', cached: false });
    await expect(verify(source())).rejects.toThrow('RESTORE_ZTO_UNCONFIRMED');
    expect(ztoPickupStatus.size).toBe(0);
});

it('ស្តារ Cookie ក្រៅបណ្ដាញ និងបិទការភ្ជាប់ ZTO មិនរំលងការផ្ទៀង', async () => {
    const fetcher = vi.fn();
    installProvider( fetcher);
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    await expect(verify(source())).rejects.toThrow('RESTORE_ZTO_UNVERIFIED');
    online.mockRestore();
    appLocalStore.removeItem('zoew_lookup_api_config');
    await expect(verify(source())).rejects.toThrow('RESTORE_ZTO_NEEDS_LOOKUP');
    fixture.set('zoew_restore_policy/shop', { v: 1, mode: 'local', scope: liveShopScope(), branch: '', epoch: 2 });
    await verify({ barcodes: [{ code }], trashMode: 'local' });
    expect(fetcher).not.toHaveBeenCalled();
});

it('ចម្លើយយឺតក្រោយប្ដូរគណនីមិនកត់ទៅ cache គណនីថ្មី', async () => {
    installProvider( vi.fn(async () => {
        firebaseState.authGeneration++;
        return Response.json(proof({ ztoClosed: true }));
    }));
    await expect(verify(source())).rejects.toThrow('RESTORE_SESSION_SWITCHED');
    expect(ztoPickupStatus.size).toBe(0);
});

it('ពិដានសំណើស្តារ ៣ និងភស្តុតាង Sign មានអាទិភាពលើការខ្វះចម្លើយផ្សេង', async () => {
    let active = 0;
    let peak = 0;
    const fetcher = vi.fn(async (event: any) => {
        active++;
        peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, 5));
        active--;
        const barcode = event.queryStringParameters.barcode;
        if (barcode === code + '3') throw new Error('offline');
        return Response.json(proof({ barcode, ztoClosed: barcode === code }));
    });
    fixture.setLookup(fetcher);
    installProvider(vi.fn(() => { throw new Error('projected concurrency lookup uses the issuer seam'); }));
    await expect(verify({ trashMode: 'cookie', barcodes: [code, code, code + '3', code + '1', code + '2'].map((code) => ({ code })) })).rejects.toThrow('RESTORE_ZTO_FINAL');
    expect(peak).toBe(3);
    expect(active).toBe(0);
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(grant()).toMatchObject({ status: 'deny', verdict: 'signed' });
    expect(ztoPickupStatus.size, 'server terminal proof remains separate from client verdict cache').toBe(0);
});

it('ស្តារ Cookie ត្រូវសួរ ZTO ថ្មី ទោះ cache មុន Sign នៅមានសុពលភាព', async () => {
    let signed = false;
    const upstream = vi.fn(async () => Response.json(order(signed), { status: 200 }));
    installProvider( upstream);
    expect((await call()).body).toMatchObject({ ztoClosed: false, cached: false });
    signed = true;
    expect((await call()).body).toMatchObject({ ztoClosed: false, cached: true });
    expect((await call(true)).body).toMatchObject({ ztoClosed: true, cached: false, verifiedForRestore: true });
    expect(upstream).toHaveBeenCalledTimes(2);
});

it('សំណើស្តារមិនចូលរួម lookup ចាស់ដែលមិនទាន់ទទួល ACK', async () => {
    let startOld: () => void;
    let releaseOld: () => void;
    const started = new Promise<void>((resolve) => { startOld = resolve; });
    const gate = new Promise<void>((resolve) => { releaseOld = resolve; });
    const upstream = vi.fn(async () => {
        if (upstream.mock.calls.length === 1) {
            startOld();
            await gate;
            return Response.json(order(false), { status: 200 });
        }
        return Response.json(order(true), { status: 200 });
    });
    installProvider( upstream);
    const ordinary = call();
    await started;
    const checked = call(true);
    try { await vi.waitFor(() => expect(upstream).toHaveBeenCalledTimes(2), { timeout: 1000 }); }
    finally { releaseOld(); }
    expect((await ordinary).body.ztoClosed).toBe(false);
    expect((await checked).body).toMatchObject({ ztoClosed: true, cached: false, verifiedForRestore: true });
});


it('Function មិនបញ្ជាក់ស្តារពេល upstream barcode បាត់ តែ ordinary lookup រក្សា legacy fallback', async () => {
    installProvider( vi.fn(async () => {
        const upstream = order(false);
        delete upstream.data.billCode;
        return Response.json(upstream, { status: 200 });
    }));
    const result = await call(true);
    expect(result.status).toBe(200);
    expect(result.body.verifiedForRestore).not.toBe(true);
    const ordinary = await call();
    expect(ordinary.status).toBe(200);
    expect(ordinary.body.found).toBe(true);
});

it('Function បដិសេធ foreign upstream barcode ក្នុង restore និង ordinary lookup ដោយគ្មាន customer/status fields', async () => {
    installProvider( vi.fn(async () => {
        const upstream = order(false);
        upstream.data.billCode = '77130500000999';
        return Response.json(upstream, { status: 200 });
    }));
    for (const restore of [true, false]) {
        const result = await call(restore);
        expect(result.body.verifiedForRestore).not.toBe(true);
        expect(result.status).toBe(502);
        expect(result.body).toEqual({ error: expect.any(String), code: 'ZTO_INVALID_RESPONSE' });
    }
});

it.each([[true, 'RESTORE_ZTO_FINAL'], [false, null]])('ZS-5 · Function ៖ record ZTO ដែលគ្មានលេខអតិថិជន/COD/DOD ប្រាប់ verdict Sign ពេលស្តារ (signed=%s) មិនមែន «រកមិនឃើញ»', async (signed, reason) => {
    const bare = { success: true, data: { billCode: code, consigneePhone: '0', agentAmount: '', arrivalServiceCharge: '', signed: signed ? '1' : '0', dispSiteCode: '12345' } };
    installProvider( vi.fn(async (input: any, options: any) => {
        const url = new URL(String(input));
        if (url.pathname === '/.netlify/functions/zto-order-detail') {
            const result = await proxy.handler({ httpMethod: 'GET', headers: Object.fromEntries(new Headers(options.headers)), queryStringParameters: Object.fromEntries(url.searchParams) });
            return new Response(result.body, { status: result.statusCode });
        }
        return Response.json(bare, { status: 200 });
    }));
    const checked = await call(true);
    expect(checked.body).toMatchObject({ found: false, code: 'ZTO_NO_CUSTOMER_DATA', ztoClosed: signed, cached: false });
    expect((await call()).body.code, 'ordinary lookup unchanged').toBe('ZTO_NOT_FOUND');
    if (reason) await expect(verify(source())).rejects.toThrow(reason);
    else await verify(source());
    expect(grant()).toMatchObject({ status: signed ? 'deny' : 'allow', verdict: signed ? 'signed' : 'allow' });
    if (signed) expect(ztoPickupStatus.size).toBe(0);
    else expect(ztoPickupStatus.get(code)).toMatchObject({ closed: false });
});

const viaFunction = (upstream: () => unknown, seen: string[] = []) => vi.fn(async (input: any, options: any) => {
    const href = String(input);
    if (href.includes(fx.CERTS_HOST)) return Response.json({ [fx.TEST_KID]: fx.TEST_CERT_PEM }, { status: 200 });
    const url = new URL(href);
    if (url.pathname === '/.netlify/functions/zto-order-detail') {
        seen.push(url.search);
        const result = await proxy.handler({ httpMethod: 'GET', headers: Object.fromEntries(new Headers(options && options.headers)), queryStringParameters: Object.fromEntries(url.searchParams) });
        return new Response(result.body, { status: result.statusCode });
    }
    return Response.json(upstream(), { status: 200 });
});

it('ZS-A1 · record គ្មានទិន្នន័យអតិថិជន ៖ ក្រោយការផ្ទៀងស្តារកត់ «មិនទាន់ Sign» ហើយ ZTO Sign ➜ ការពិនិត្យស្ថានភាពប្រចាំម៉ោងឃើញ Sign (របារលត់ · ត្រា Sign ចេញ) ទោះបញ្ជី Sign មិនដំណើរការ', async () => {
    const T0 = Date.UTC(2026, 9, 6, 3, 0, 0);
    const HOUR = 3600000;
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(T0));
    appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify(await sealLookupHeader({ enabled: true, fastMode: true, url: window.location.origin + '/.netlify/functions/zto-order-detail?barcode={barcode}', headerName: 'X-Zoe-Proxy-Key' }, key)));
    firebaseState.db = { restoreBare: true } as any;
    firebaseState.serverTimeOffsetMs = 0;
    ztoState.ztoStatusInFlight = false;
    ztoState.ztoStatusLastSweepAt = 0;
    autoLookupInFlight.clear();
    uiState.isModalOpen = false;
    let signed = false;
    const seen: string[] = [];
    const trustedLookup = proxy.createTrustedRestoreHandler({ getStore: () => null });
    fixture.setLookup((event, identity) => {
        seen.push('?' + new URLSearchParams(event.queryStringParameters).toString());
        return trustedLookup(event, identity);
    });
    installProvider( viaFunction(() => ({ success: true, data: { billCode: code, consigneePhone: '0', signed: signed ? '1' : '0', dispSiteCode: '12345' } }), seen));
    await verify(source());
    expect(grant()).toMatchObject({ status: 'allow', verdict: 'allow' });
    expect(ztoPickupStatus.get(code)).toMatchObject({ closed: false });
    dataState.scanHistory = [{ id: 'bare1', phone: '0960007345', scanDate: '2026-10-06', isClosed: true, closedAt: T0, createdAt: T0 - HOUR,
        barcodes: [{ code, isClosed: true, closedAt: T0, cod: 1, dod: 0, createdAt: T0 - HOUR }] }] as any;
    dataState.deletedItems = [];
    const initialStatus = await proxy.handler({ httpMethod: 'GET', headers: { 'x-zoe-proxy-key': key },
        queryStringParameters: { barcode: code, status: '1' } });
    const initialVerdict = JSON.parse(initialStatus.body);
    expect(initialVerdict).toMatchObject({ code: 'ZTO_NO_CUSTOMER_DATA', cached: false, ztoClosed: false });
    setZtoPickupVerdict(code, initialVerdict.ztoClosed);
    expect(ztoPickupStatus.get(code)).toMatchObject({ closed: false });
    expect(ztoStatusPendingCodes()).toEqual([code]);
    signed = true;
    for (let h = 1; h <= 3; h++) {
        vi.setSystemTime(new Date(T0 + h * HOUR + 60000));
        ztoState.ztoStatusLastSweepAt = 0;
        await runZtoStatusSweep(false);
    }
    expect(seen.filter((q) => !/list=1/.test(q)).length, 'the hourly status check really asked the Function').toBeGreaterThanOrEqual(2);
    expect(ztoPickupStatus.get(code)).toMatchObject({ closed: true });
    expect(ztoStatusPendingCodes()).toEqual([]);
    expect(collectZtoFinalTargets().map((t: any) => t.path)).toEqual(['zoew_scan_history_cod_dod/bare1']);
    proxy.resetCachesForTests();
    expect((await call()).body.code, 'an ordinary scan lookup still answers «not found» for a record without customer data').toBe('ZTO_NOT_FOUND');
    const status = await proxy.handler({ httpMethod: 'GET', headers: { 'x-zoe-proxy-key': key }, queryStringParameters: { barcode: code, status: '1' } });
    expect(JSON.parse(status.body), 'a cached «not found» of a scan never hides the record from the status check').toMatchObject({ code: 'ZTO_NO_CUSTOMER_DATA', ztoClosed: true, cached: false });
});

it.each([
    ['សាខាផ្សេង', { dispSiteCode: '99999' }, 'branch:other'],
    ['គ្មានវាលសាខា', {}, 'branch:missing']
])('ZS-A3 · record គ្មានទិន្នន័យអតិថិជន ឆ្លងការត្រួតសាខា `ZTO_DETAIL_BRANCH_PATHS` ដូច /detail (%s ➜ ZTO_OTHER_BRANCH គ្មាន verdict)', async (_label, branch, reason) => {
    vi.stubEnv('ZTO_DETAIL_IDENTITY', 'require');
    vi.stubEnv('ZTO_DETAIL_BRANCH_PATHS', 'dispSiteCode');
    vi.stubEnv('FIREBASE_PROJECT_IDS', fx.TEST_PROJECT + ':12345');
    const token = fx.tokenForSite('12345');
    let record: any = { billCode: code, consigneePhone: '0', signed: '1', ...branch };
    installProvider( viaFunction(() => ({ success: true, data: record })));
    for (const extra of [{ restore: '1' }, { status: '1' }]) {
        proxy.resetCachesForTests();
        const response = await proxy.handler({ httpMethod: 'GET', headers: { 'x-zoe-proxy-key': key, 'x-zoe-id-token': token }, queryStringParameters: { barcode: code, ...extra } });
        const body = JSON.parse(response.body);
        expect(body, JSON.stringify(extra)).toMatchObject({ success: false, found: false, code: 'ZTO_OTHER_BRANCH', reason });
        expect(body, JSON.stringify(extra)).not.toHaveProperty('ztoClosed');
    }
    proxy.resetCachesForTests();
    firebaseState.fb = { ...firebaseState.fb, getIdTokenResult: async () => ({ token }) } as any;
    firebaseState.authGeneration++;
    await expect(verify(source())).rejects.toThrow('RESTORE_ZTO_UNCONFIRMED');
    expect(ztoPickupStatus.size).toBe(0);
    record = { billCode: code, consigneePhone: '0', signed: '1', dispSiteCode: '12345' };
    for (const extra of [{ restore: '1' }, { status: '1' }]) {
        proxy.resetCachesForTests();
        const response = await proxy.handler({ httpMethod: 'GET', headers: { 'x-zoe-proxy-key': key, 'x-zoe-id-token': token }, queryStringParameters: { barcode: code, ...extra } });
        expect(JSON.parse(response.body), 'own branch keeps its verdict').toMatchObject({ found: false, code: 'ZTO_NO_CUSTOMER_DATA', ztoClosed: true, cached: false });
    }
});

beforeEach(() => { firebaseState.serverClockTrusted = true; firebaseState.sessionExpiryCheck = 'live'; });
