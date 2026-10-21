import { createRequire } from 'node:module';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { appLocalStore } from '../src/core/storage';
import { dataState, firebaseState, uiState, ztoState } from '../src/core/state';
import { autoLookupInFlight } from '../src/features/auto-lookup';
import { verifyZtoRestoreStatus } from '../src/features/zto-restore-status';
import { runZtoStatusSweep, ztoPickupStatus, ztoStatusPendingCodes } from '../src/features/zto-status';
import { collectZtoFinalTargets } from '../src/features/zto-final-marks';

const req = createRequire(import.meta.url);
const proxy = req('../netlify/functions/zto-order-detail.js');
const fx = req('../../audit-tools/idtoken-fixture.js');
const code = '77130500000012';
const key = 'restore-proof-key-0123456789abcdef';
const source = () => ({ trashMode: 'cookie', barcodes: [{ code }] });
const proof = (patch = {}) => ({ success: true, found: true, barcode: code, ztoClosed: false, cached: false, verifiedForRestore: true, ...patch });
const order = (signed: boolean): any => ({ success: true, data: { billCode: code, consigneePhone: '0970000000', agentAmount: 7, arrivalServiceCharge: 1, signed: signed ? '1' : '0' } });
const call = async (restore = false) => {
    const response = await proxy.handler({ httpMethod: 'GET', headers: { 'x-zoe-proxy-key': key }, queryStringParameters: { barcode: code, ...(restore ? { restore: '1' } : {}) } });
    return { status: response.statusCode, body: JSON.parse(response.body) };
};

beforeEach(() => {
    appLocalStore.clear();
    appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify({ enabled: true, url: window.location.origin + '/.netlify/functions/zto-order-detail?barcode={barcode}', headerName: 'X-Zoe-Proxy-Key', headerValue: key }));
    firebaseState.auth = { currentUser: { uid: 'restore-user' } } as any;
    firebaseState.fb = { getIdTokenResult: async () => ({ token: 'restore-id-token' }) } as any;
    firebaseState.authGeneration++;
    ztoPickupStatus.clear();
    ztoState.ztoStatusLoaded = true;
    vi.stubEnv('ZTO_PROXY_KEY', key);
    vi.stubEnv('ZTO_COOKIE', 'BOS-MAN-SESSION=restore-proof-test');
    vi.stubEnv('ZTO_CACHE_TTL_MS', '60000');
    vi.stubEnv('ZTO_UPSTREAM_RETRIES', '0');
    vi.stubEnv('ZTO_DETAIL_IDENTITY', 'off');
    vi.stubEnv('ZTO_FIELD_SIGNED', 'signed');
    vi.stubEnv('ZTO_SIGNED_VALUES', '1');
    proxy.resetCachesForTests();
});

afterEach(() => {
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

it('ស្តារប្រើ Function ពិតផ្ទៀង unsigned ហើយចាប់ Sign ថ្មីដោយមិនជឿ cache', async () => {
    let signed = false;
    vi.stubGlobal('fetch', vi.fn(async (input: any, options: any) => {
        const url = new URL(String(input));
        if (url.pathname === '/.netlify/functions/zto-order-detail') {
            const result = await proxy.handler({ httpMethod: 'GET', headers: Object.fromEntries(new Headers(options.headers)), queryStringParameters: Object.fromEntries(url.searchParams) });
            return new Response(result.body, { status: result.statusCode });
        }
        return new Response(JSON.stringify(order(signed)), { status: 200 });
    }));
    await verifyZtoRestoreStatus(source());
    expect(ztoPickupStatus.get(code)).toMatchObject({ closed: false });
    signed = true;
    await expect(verifyZtoRestoreStatus(source())).rejects.toThrow('RESTORE_ZTO_FINAL');
    expect(ztoPickupStatus.get(code)).toMatchObject({ closed: true });
});

it.each([
    [{ cached: true }, 'RESTORE_ZTO_UNVERIFIED'], [{ barcode: '77130500000999' }, 'RESTORE_ZTO_UNVERIFIED'],
    [{ verifiedForRestore: undefined }, 'RESTORE_ZTO_UNCONFIRMED'], [{ ztoClosed: null }, 'RESTORE_ZTO_UNCONFIRMED'],
    [{ found: false }, 'RESTORE_ZTO_UNCONFIRMED'], [{ found: false, success: false, code: 'ZTO_OTHER_BRANCH' }, 'RESTORE_ZTO_UNCONFIRMED'],
    [{ success: false }, 'RESTORE_ZTO_UNCONFIRMED']
])('ភស្តុតាងមិនពេញលេញមិនអនុញ្ញាតស្តារ (%j)', async (patch, reason) => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(proof(patch)))));
    await expect(verifyZtoRestoreStatus(source())).rejects.toThrow(reason);
    expect(ztoPickupStatus.size).toBe(0);
});

it('កញ្ចប់ដែល ZTO ឆ្លើយថ្មីៗថា «រកមិនឃើញ» (មិនមែនកញ្ចប់ ZTO) មិនអាច Sign ➜ ស្តារបាន · cache ឬ barcode ខុស ➜ មិនទុកចិត្ត', async () => {
    const notFound = (patch = {}) => ({ success: false, found: false, barcode: code, code: 'ZTO_NOT_FOUND', cached: false, ...patch });
    const fetcher = vi.fn(async () => new Response(JSON.stringify(notFound())));
    vi.stubGlobal('fetch', fetcher);
    await verifyZtoRestoreStatus(source());
    expect(ztoPickupStatus.size).toBe(0);
    expect((fetcher.mock.calls[0] as any)[1]?.cache, 'Function request keeps the CORS preflight cache (no no-store)').toBeUndefined();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(notFound({ cached: true })))));
    await expect(verifyZtoRestoreStatus(source())).rejects.toThrow('RESTORE_ZTO_UNVERIFIED');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(notFound({ barcode: '77130500000999' })))));
    await expect(verifyZtoRestoreStatus(source())).rejects.toThrow('RESTORE_ZTO_UNVERIFIED');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(notFound()), { status: 503 })));
    await expect(verifyZtoRestoreStatus(source())).rejects.toThrow('RESTORE_ZTO_UNVERIFIED');
});

it('ស្តារ Cookie ក្រៅបណ្ដាញ និងបិទការភ្ជាប់ ZTO មិនរំលងការផ្ទៀង', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    await expect(verifyZtoRestoreStatus(source())).rejects.toThrow('RESTORE_ZTO_UNVERIFIED');
    online.mockRestore();
    appLocalStore.removeItem('zoew_lookup_api_config');
    await expect(verifyZtoRestoreStatus(source())).rejects.toThrow('RESTORE_ZTO_NEEDS_LOOKUP');
    await verifyZtoRestoreStatus({ barcodes: [{ code }], trashMode: 'local' });
    expect(fetcher).not.toHaveBeenCalled();
});

it('ចម្លើយយឺតក្រោយប្ដូរគណនីមិនកត់ទៅ cache គណនីថ្មី', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
        firebaseState.authGeneration++;
        return new Response(JSON.stringify(proof({ ztoClosed: true })));
    }));
    await expect(verifyZtoRestoreStatus(source())).rejects.toThrow('RESTORE_SESSION_SWITCHED');
    expect(ztoPickupStatus.size).toBe(0);
});

it('ពិដានសំណើស្តារ ៣ និងភស្តុតាង Sign មានអាទិភាពលើការខ្វះចម្លើយផ្សេង', async () => {
    let active = 0;
    let peak = 0;
    const fetcher = vi.fn(async (input: any) => {
        active++;
        peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, 5));
        active--;
        const barcode = new URL(String(input)).searchParams.get('barcode');
        if (barcode === code + '3') throw new Error('offline');
        return new Response(JSON.stringify(proof({ barcode, ztoClosed: barcode === code })));
    });
    vi.stubGlobal('fetch', fetcher);
    await expect(verifyZtoRestoreStatus({ trashMode: 'cookie', barcodes: [code, code, code + '3', code + '1', code + '2'].map((code) => ({ code })) })).rejects.toThrow('RESTORE_ZTO_FINAL');
    expect(peak).toBe(3);
    expect(active).toBe(0);
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(ztoPickupStatus.get(code)).toMatchObject({ closed: true });
});

it('ស្តារ Cookie ត្រូវសួរ ZTO ថ្មី ទោះ cache មុន Sign នៅមានសុពលភាព', async () => {
    let signed = false;
    const upstream = vi.fn(async () => new Response(JSON.stringify(order(signed)), { status: 200 }));
    vi.stubGlobal('fetch', upstream);
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
            return new Response(JSON.stringify(order(false)), { status: 200 });
        }
        return new Response(JSON.stringify(order(true)), { status: 200 });
    });
    vi.stubGlobal('fetch', upstream);
    const ordinary = call();
    await started;
    const checked = call(true);
    try { await vi.waitFor(() => expect(upstream).toHaveBeenCalledTimes(2), { timeout: 1000 }); }
    finally { releaseOld(); }
    expect((await ordinary).body.ztoClosed).toBe(false);
    expect((await checked).body).toMatchObject({ ztoClosed: true, cached: false, verifiedForRestore: true });
});


it.each([undefined, '77130500000999'])('Function មិនបញ្ជាក់ស្តារពេល upstream barcode បាត់ឬខុស (%s)', async (billCode) => {
    vi.stubGlobal('fetch', vi.fn(async () => {
        const upstream = order(false);
        upstream.data.billCode = billCode;
        return new Response(JSON.stringify(upstream), { status: 200 });
    }));
    const result = await call(true);
    expect(result.body.verifiedForRestore).not.toBe(true);
    const ordinary = await call();
    expect(ordinary.body.found).toBe(true);
});

it.each([[true, 'RESTORE_ZTO_FINAL'], [false, null]])('ZS-5 · Function ៖ record ZTO ដែលគ្មានលេខអតិថិជន/COD/DOD ប្រាប់ verdict Sign ពេលស្តារ (signed=%s) មិនមែន «រកមិនឃើញ»', async (signed, reason) => {
    const bare = { success: true, data: { billCode: code, consigneePhone: '0', agentAmount: '', arrivalServiceCharge: '', signed: signed ? '1' : '0' } };
    vi.stubGlobal('fetch', vi.fn(async (input: any, options: any) => {
        const url = new URL(String(input));
        if (url.pathname === '/.netlify/functions/zto-order-detail') {
            const result = await proxy.handler({ httpMethod: 'GET', headers: Object.fromEntries(new Headers(options.headers)), queryStringParameters: Object.fromEntries(url.searchParams) });
            return new Response(result.body, { status: result.statusCode });
        }
        return new Response(JSON.stringify(bare), { status: 200 });
    }));
    const checked = await call(true);
    expect(checked.body).toMatchObject({ found: false, code: 'ZTO_NO_CUSTOMER_DATA', ztoClosed: signed, cached: false });
    expect((await call()).body.code, 'ordinary lookup unchanged').toBe('ZTO_NOT_FOUND');
    if (reason) await expect(verifyZtoRestoreStatus(source())).rejects.toThrow(reason);
    else await verifyZtoRestoreStatus(source());
    expect(ztoPickupStatus.get(code)).toMatchObject({ closed: signed });
});

const viaFunction = (upstream: () => unknown, seen: string[] = []) => vi.fn(async (input: any, options: any) => {
    const href = String(input);
    if (href.includes(fx.CERTS_HOST)) return new Response(JSON.stringify({ [fx.TEST_KID]: fx.TEST_CERT_PEM }), { status: 200 });
    const url = new URL(href);
    if (url.pathname === '/.netlify/functions/zto-order-detail') {
        seen.push(url.search);
        const result = await proxy.handler({ httpMethod: 'GET', headers: Object.fromEntries(new Headers(options && options.headers)), queryStringParameters: Object.fromEntries(url.searchParams) });
        return new Response(result.body, { status: result.statusCode });
    }
    return new Response(JSON.stringify(upstream()), { status: 200 });
});

it('ZS-A1 · record គ្មានទិន្នន័យអតិថិជន ៖ ក្រោយការផ្ទៀងស្តារកត់ «មិនទាន់ Sign» ហើយ ZTO Sign ➜ ការពិនិត្យស្ថានភាពប្រចាំម៉ោងឃើញ Sign (របារលត់ · ត្រា Sign ចេញ) ទោះបញ្ជី Sign មិនដំណើរការ', async () => {
    const T0 = Date.UTC(2026, 9, 6, 3, 0, 0);
    const HOUR = 3600000;
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(T0));
    appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify({ enabled: true, fastMode: true, url: window.location.origin + '/.netlify/functions/zto-order-detail?barcode={barcode}', headerName: 'X-Zoe-Proxy-Key', headerValue: key }));
    firebaseState.db = { restoreBare: true } as any;
    firebaseState.serverTimeOffsetMs = 0;
    ztoState.ztoStatusInFlight = false;
    ztoState.ztoStatusLastSweepAt = 0;
    autoLookupInFlight.clear();
    uiState.isModalOpen = false;
    let signed = false;
    const seen: string[] = [];
    vi.stubGlobal('fetch', viaFunction(() => ({ success: true, data: { billCode: code, consigneePhone: '0', signed: signed ? '1' : '0' } }), seen));
    await verifyZtoRestoreStatus(source());
    expect(ztoPickupStatus.get(code)).toMatchObject({ closed: false });
    dataState.scanHistory = [{ id: 'bare1', phone: '0960007345', scanDate: '2026-10-06', isClosed: true, closedAt: T0, createdAt: T0 - HOUR,
        barcodes: [{ code, isClosed: true, closedAt: T0, cod: 1, dod: 0, createdAt: T0 - HOUR }] }] as any;
    dataState.deletedItems = [];
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
    vi.stubGlobal('fetch', viaFunction(() => ({ success: true, data: record })));
    for (const extra of [{ restore: '1' }, { status: '1' }]) {
        proxy.resetCachesForTests();
        const response = await proxy.handler({ httpMethod: 'GET', headers: { 'x-zoe-proxy-key': key, 'x-zoe-id-token': token }, queryStringParameters: { barcode: code, ...extra } });
        const body = JSON.parse(response.body);
        expect(body, JSON.stringify(extra)).toMatchObject({ success: false, found: false, code: 'ZTO_OTHER_BRANCH', reason });
        expect(body, JSON.stringify(extra)).not.toHaveProperty('ztoClosed');
    }
    proxy.resetCachesForTests();
    firebaseState.fb = { getIdTokenResult: async () => ({ token }) } as any;
    firebaseState.authGeneration++;
    await expect(verifyZtoRestoreStatus(source())).rejects.toThrow('RESTORE_ZTO_UNCONFIRMED');
    expect(ztoPickupStatus.size).toBe(0);
    record = { billCode: code, consigneePhone: '0', signed: '1', dispSiteCode: '12345' };
    for (const extra of [{ restore: '1' }, { status: '1' }]) {
        proxy.resetCachesForTests();
        const response = await proxy.handler({ httpMethod: 'GET', headers: { 'x-zoe-proxy-key': key, 'x-zoe-id-token': token }, queryStringParameters: { barcode: code, ...extra } });
        expect(JSON.parse(response.body), 'own branch keeps its verdict').toMatchObject({ found: false, code: 'ZTO_NO_CUSTOMER_DATA', ztoClosed: true, cached: false });
    }
});
