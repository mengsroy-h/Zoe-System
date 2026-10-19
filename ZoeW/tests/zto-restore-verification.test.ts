import { createRequire } from 'node:module';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { appLocalStore } from '../src/core/storage';
import { firebaseState, ztoState } from '../src/core/state';
import { verifyZtoRestoreStatus } from '../src/features/zto-restore-status';
import { ztoPickupStatus } from '../src/features/zto-status';

const req = createRequire(import.meta.url);
const proxy = req('../netlify/functions/zto-order-detail.js');
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
    appLocalStore.clear();
    ztoPickupStatus.clear();
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
    { cached: true }, { verifiedForRestore: undefined }, { ztoClosed: null },
    { found: false }, { success: false }, { barcode: '77130500000999' }
])('ភស្តុតាងមិនពេញលេញមិនអនុញ្ញាតស្តារ (%j)', async (patch) => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(proof(patch)))));
    await expect(verifyZtoRestoreStatus(source())).rejects.toThrow('RESTORE_ZTO_UNVERIFIED');
    expect(ztoPickupStatus.size).toBe(0);
});

it('ស្តារ Cookie ក្រៅបណ្ដាញ និងបិទការភ្ជាប់ ZTO មិនរំលងការផ្ទៀង', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    await expect(verifyZtoRestoreStatus(source())).rejects.toThrow('RESTORE_ZTO_UNVERIFIED');
    online.mockRestore();
    appLocalStore.removeItem('zoew_lookup_api_config');
    await expect(verifyZtoRestoreStatus(source())).rejects.toThrow('RESTORE_ZTO_UNVERIFIED');
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
