import { createRequire } from 'node:module';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { appLocalStore } from '../src/core/storage';
import { dataState, firebaseState, uiState, ztoState } from '../src/core/state';
import { clearCustomerDataTableCache } from '../src/features/customer-table';
import { clearZtoPickupStatusStore, runZtoStatusSweep, ztoAbandonCleanupIsHeld } from '../src/features/zto-status';

const require = createRequire(import.meta.url);
const fn = require('../netlify/functions/_shared/zto-order-detail-core.cjs');
const { tokenForSite, withCerts, TEST_PROJECT } = require('../../audit-tools/idtoken-fixture.js');
const NOW = Date.UTC(2026, 9, 31, 4), KEY = 'synthetic-proxy-key-0123456789abcdef';
const CODE = 'SYNTHETIC0001', OTHER = 'SYNTHETIC0002';
type Mode = 'cookie' | 'palm';
type Page = { rows: unknown[]; pages?: number; total?: number; pageSize?: number };
type Request = { mode: Mode; page: number; signed: boolean; site: string };
const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
const signedRow = (mode: Mode, code = OTHER) => mode === 'palm' ? { billCode: code, billStatus: '5' }
    : { scanBillCode: code, scanTypeCode: '05', scanTypeDesc: 'ចុះហត្ថលេខា', scanTime: '2026-10-31 10:00:00' };
const otherRow = (mode: Mode) => mode === 'palm' ? { billCode: OTHER, billStatus: '3' }
    : { scanBillCode: OTHER, scanTypeCode: '03', scanTypeDesc: 'អីវ៉ាន់មកដល់', scanTime: '2026-10-31 10:00:00' };
const missingCode = (mode: Mode) => mode === 'palm' ? { billStatus: '5' }
    : { scanTypeCode: '05', scanTypeDesc: 'ចុះហត្ថលេខា', scanTime: '2026-10-31 10:00:00' };

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    Object.entries({ ZTO_PROXY_KEY: KEY, ZTO_PALM_SESSION_SECRET: 'x'.repeat(40), ZTO_PALM_SIGN_KEY: 'synthetic-sign-key',
        ZTO_PALM_PASSWORD_KEY: 'zoew-test-aes-16', ZTO_COOKIE: 'BOS-MAN-SESSION=synthetic-cookie-12345',
        ZTO_CACHE_TTL_MS: '0', ZTO_LIST_CACHE_TTL_MS: '0', ZTO_UPSTREAM_RETRIES: '0', ZTO_DETAIL_IDENTITY: '',
        ZTO_DETAIL_BRANCH_PATHS: '', FIREBASE_PROJECT_IDS: TEST_PROJECT }).forEach(([key, value]) => vi.stubEnv(key, value));
    fn.resetCachesForTests();
    fn.setBlobsModuleForTests(null);
    appLocalStore.clear();
    clearCustomerDataTableCache();
    clearZtoPickupStatusStore();
    uiState.isModalOpen = true;
    firebaseState.serverClockTrusted = true;
    firebaseState.serverTimeOffsetMs = 0;
    firebaseState.isInitializingFirebase = false;
    dataState.scanHistory = [{ id: 'synthetic-row', phone: '012345678', createdAt: NOW - 8 * 86400000, scanDate: '2026-10-23',
        count: 1, cod: 5, dod: 0, isClosed: false, barcodes: [{ code: CODE, isClosed: false, createdAt: NOW - 8 * 86400000, cod: 5, dod: 0 }] }];
    dataState.deletedItems = [];
});

afterEach(() => {
    clearZtoPickupStatusStore();
    clearCustomerDataTableCache();
    fn.resetCachesForTests();
    fn.setBlobsModuleForTests(null);
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.useRealTimers();
});

async function fixture(mode: Mode, pageOf: (request: Request) => Page, provider = 'firebase') {
    const token = tokenForSite('12345');
    const options = provider === 'firebase' ? { databaseURL: 'https://audit.firebaseio.com' } : { supabaseUrl: 'https://audit.invalid' };
    appLocalStore.setItem('zoew_firebase_config', JSON.stringify(options));
    firebaseState.auth = { currentUser: { uid: 'synthetic-user' }, app: { options } } as any;
    firebaseState.db = { app: { options } } as any;
    firebaseState.fb = { getIdTokenResult: async () => ({ token }), tenantScope: provider === 'supabase' ? () => 'tenant-a' : undefined } as any;
    let session = '';
    const answers: any[] = [];
    const requests: Request[] = [];
    const call = async (query: Record<string, string>, method = 'GET', body?: unknown) => {
        const out = await fn.handler({ httpMethod: method, headers: { 'x-zoe-proxy-key': KEY, 'x-zoe-id-token': token,
            ...(session ? { 'x-zoe-palm-token': session } : {}) }, queryStringParameters: query, body: body ? JSON.stringify(body) : '' });
        answers.push({ status: out.statusCode, body: JSON.parse(out.body) });
        return out;
    };
    vi.stubGlobal('fetch', vi.fn(withCerts(async (target: any, init: any) => {
        const url = new URL(String(target));
        if (url.pathname === '/.netlify/functions/zto-order-detail') {
            const out = await call(Object.fromEntries(url.searchParams));
            return new Response(out.body, { status: out.statusCode });
        }
        if (url.pathname === '/zto/system/v1/doLogin') return json({ status: true, result: { token: 'synthetic-palm-token', countryCode: 'KH', siteCode: '12345' } });
        const sent = JSON.parse(String(init?.body || '{}'));
        const isPalm = url.pathname === '/zto/dispatch/v1/queryDispatchList';
        const request: Request = { mode: isPalm ? 'palm' : 'cookie', page: sent.pageNum || 1,
            signed: isPalm || sent.condition?.scanTypeCode === '05', site: sent.condition?.scanSiteCode || '12345' };
        requests.push(request);
        const page = pageOf(request);
        const metadata = { pages: page.pages ?? 1, total: page.total ?? page.rows.length, ...(page.pageSize ? { pageSize: page.pageSize } : {}) };
        return isPalm ? json({ status: true, result: { list: page.rows, ...metadata } })
            : json({ code: '0', data: { records: page.rows, ...metadata } });
    })));
    if (mode === 'palm') {
        const login = await call({ palm: 'login' }, 'POST', { username: 'synthetic', password: 'synthetic', deviceSn: 'zoew-test-device' });
        expect(login.statusCode).toBe(200);
        session = JSON.parse(login.body).sessionToken;
    }
    const cfg = { enabled: true, fastMode: true, url: window.location.origin + '/.netlify/functions/zto-order-detail?'
        + (mode === 'palm' ? 'palm=1&' : '') + 'barcode={barcode}',
    ...(mode === 'palm' ? { palmShared: true, palmAccount: { siteCode: '12345' } } : {}) };
    appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify(cfg));
    return { answers, requests, call: (query: Record<string, string>) => call({ ...(mode === 'palm' ? { palm: '1' } : {}), ...query }) };
}

const profiles = ['cookie', 'palm'].flatMap((mode) => ['firebase', 'supabase'].flatMap((provider) =>
    ['empty', 'null-row', 'missing-code'].map((shape) => ({ mode: mode as Mode, provider, shape }))));

it.each(profiles)('F04 $mode/$provider/$shape រក្សា completeness តាមគុណភាព raw list', async ({ mode, provider, shape }) => {
    const world = await fixture(mode, () => ({ rows: shape === 'empty' ? [] : shape === 'null-row' ? [null] : [missingCode(mode)] }), provider);
    expect(ztoAbandonCleanupIsHeld(NOW - 1)).toBe(true);
    await runZtoStatusSweep(false);
    expect(ztoAbandonCleanupIsHeld(NOW - 1)).toBe(shape !== 'empty');
    expect(ztoState.ztoSignedCompleteAt > 0).toBe(shape === 'empty');
    expect(world.requests.some((request) => request.signed)).toBe(true);
    expect(dataState.scanHistory[0]).toMatchObject({ count: 1, cod: 5, dod: 0, isClosed: false });
});

it.each(['cookie', 'palm'] as const)('F04 %s valid Signed និង identified non-Sign នៅតែពេញលេញ', async (mode) => {
    const world = await fixture(mode, () => ({ rows: [signedRow(mode), otherRow(mode)] }));
    const out = await world.call({ list: '1', signed: '1', exact: '1', page: '1', from: '2026-10-30', to: '2026-10-31' });
    expect(out.statusCode).toBe(200);
    expect(JSON.parse(out.body)).toMatchObject({ signedOk: true, signed: [OTHER], signedScans: 1, otherScans: 1 });
});

it.each((['cookie', 'palm'] as const).flatMap((mode) => ['array', 'primitive', 'empty-object', 'invalid-code', 'mixed'].map((shape) => ({ mode, shape }))))('F04 $mode/$shape មិនលាក់ malformed row ក្នុង empty success', async ({ mode, shape }) => {
    const invalid = shape === 'array' ? [] : shape === 'primitive' ? 'unidentified' : shape === 'empty-object' ? {}
        : shape === 'invalid-code' ? { ...signedRow(mode), billCode: 'invalid code', scanBillCode: 'invalid code' } : null;
    const rows = shape === 'mixed' ? [signedRow(mode), invalid] : [invalid];
    const world = await fixture(mode, () => ({ rows }));
    const out = await world.call({ list: '1', signed: '1', exact: '1', page: '1', from: '2026-10-30', to: '2026-10-31' });
    expect.soft(out.statusCode).toBeGreaterThanOrEqual(400);
    expect.soft(JSON.parse(out.body).signedOk).not.toBe(true);
    expect(out.body).not.toContain('unidentified');
});

it.each(['scanBillCode', 'billCode', 'waybillNo', 'waybillCode', 'mailNo', 'barcode'])('F04 Cookie alias %s រក្សាអត្តសញ្ញាណដែលគាំទ្រដើម', async (key) => {
    const world = await fixture('cookie', () => ({ rows: [{ ...missingCode('cookie'), [key]: OTHER }] }));
    const out = await world.call({ list: '1', signed: '1', exact: '1', page: '1', from: '2026-10-30', to: '2026-10-31' });
    expect(out.statusCode).toBe(200);
    expect(JSON.parse(out.body)).toMatchObject({ signedOk: true, signed: [OTHER] });
});

it.each(['cookie', 'palm'] as const)('F04 %s malformed later page មិន advance public completeAt', async (mode) => {
    const world = await fixture(mode, ({ page }) => ({ rows: page === 1 ? [signedRow(mode)] : [null], pages: 2, total: 2, pageSize: 1 }));
    await runZtoStatusSweep(false);
    expect(world.requests.some((request) => request.page === 2)).toBe(true);
    expect(ztoState.ztoSignedCompleteAt).toBe(0);
    expect(ztoAbandonCleanupIsHeld(NOW - 1)).toBe(true);
});

it('F04 Cookie malformed withSigned companion មិនលុប arrival ឬអះអាង Signed ពេញលេញ', async () => {
    const world = await fixture('cookie', ({ signed }) => ({ rows: signed ? [null] : [{ ...otherRow('cookie'), consigneeMobile: '012345678' }] }));
    const out = await world.call({ list: '1', withSigned: '1', page: '1', from: '2026-10-30', to: '2026-10-31' });
    expect(out.statusCode).toBe(200);
    const body = JSON.parse(out.body);
    expect(body.rows).toHaveLength(1);
    expect(body.signedOk).toBe(false);
});

it('F04 Cookie malformed sibling មិនក្លាយជាបញ្ជីពេញលេញទូទាំងហាង', async () => {
    vi.stubEnv('FIREBASE_PROJECT_IDS', TEST_PROJECT + ':12345|67890');
    const world = await fixture('cookie', ({ site }) => ({ rows: site === '67890' ? [null] : [] }));
    const out = await world.call({ list: '1', signed: '1', exact: '1', page: '1', from: '2026-10-30', to: '2026-10-31' });
    expect(world.requests.map((request) => request.site).sort()).toEqual(['12345', '67890']);
    expect(out.statusCode).toBeGreaterThanOrEqual(400);
    expect(JSON.parse(out.body).signedOk).not.toBe(true);
});
