/**
 * ឧបករណ៍រួមសម្រាប់តេស្ត ZTO Palm ៖ App ពិត + Function ពិត (`zto-order-detail.js` ➜ `_shared/zto-palm.js`) + ZTO Palm ក្លែង +
 * អត្តសញ្ញាណ backend ទាំង ២ ៖ Firebase (ID token ចុះហត្ថលេខាពិតពី `audit-tools/idtoken-fixture.js`) · Supabase (`my_account()` ក្លែង)។
 * ⛔ ទ្វារដូចផលិតកម្ម ៖ App ហៅ Function តាម `fetch` · Function ហៅ ZTO តាម `fetch` · គ្មាន stub លើមុខងារ App ឬ Function។
 * `world.gate(kind, key)` ឲ្យតេស្ត race ចាប់សំណើ ZTO ណាមួយទុក ហើយធ្វើសកម្មភាព (ចាកចេញ · ប្តូរហាង · Login ម្តងទៀត) មុនដោះលែង។
 */
import { webcrypto } from 'node:crypto';
import { createRequire } from 'node:module';
import { vi } from 'vitest';
import { refTo } from '../src/app/refs';
import { dataState, firebaseState, securityState, uiState, ztoState } from '../src/core/state';
import { appLocalStore } from '../src/core/storage';
import { viewState } from '../src/core/view-state';
import { clearCustomerDataTableCache } from '../src/features/customer-table';
import { clearZtoPickupStatusStore } from '../src/features/zto-status';
import { encryptLookupSecret } from '../src/services/crypto';

const req = createRequire(import.meta.url);
export const fn = req('../netlify/functions/zto-order-detail.js');
export const fx = req('../../audit-tools/idtoken-fixture.js');

export const KEY = 'palm-harness-proxy-key-0123456789';
export const SITE = '881859';
export const OTHER_SITE = '770022';
export const SB_URL = 'https://abcd1234.supabase.co';
export const SB_KEY = 'sb_publishable_' + 'q'.repeat(24);
export const FIREBASE_DB_URL = 'https://' + fx.TEST_PROJECT + '-default-rtdb.firebaseio.com';
export const NOW = Date.UTC(2026, 9, 6, 3, 0, 0);
export const RANGE = { from: '2026-10-03', to: '2026-10-06' };
const PALM_HOST = 'https://aargus-api.ztoglobal.net/';
const CN = 'ZTO ឃ្លាំងក្វាងចូវអន្តរជាតិ';
const VN = 'Shopee SHPE';

export type Backend = 'firebase' | 'supabase';
export type IdentityMode = 'off' | 'optional' | 'require';
type Scan = { action: string; siteCode: string; time: string; mailNo?: string; msgLoc?: string; problemReason?: string };
type Parcel = { tab: '1' | '4' | '5'; isSign: number | null; scans: Scan[] };

const at = (day: string, time = '09:00:00') => '2026-10-' + day + ' ' + time;
const pickup = (origin: string): Scan => ({ action: '1', siteCode: 'ORIGIN', time: at('01', '08:00:00'), msgLoc: '【' + origin + '】បានស្កែនទទួល' });
const arrive = (day: string): Scan => ({ action: '3', siteCode: SITE, time: at(day) });
const sign = (day: string): Scan => ({ action: '5', siteCode: SITE, time: at(day, '15:30:00') });

export function dataset(bulk = 0): Record<string, Parcel> {
    const out: Record<string, Parcel> = {};
    for (let i = 1; i <= bulk; i++) out['KH90000' + String(i).padStart(5, '0')] = { tab: '4', isSign: 0, scans: [pickup(CN)] };
    out.KH1000000001 = { tab: '4', isSign: 0, scans: [pickup(VN), arrive('04')] };
    out.KH1000000002 = { tab: '4', isSign: 0, scans: [pickup(CN), arrive('05')] };
    out.KH2000000001 = { tab: '4', isSign: 0, scans: [pickup(CN)] };
    out.KH7000000001 = { tab: '5', isSign: 1, scans: [pickup(CN), arrive('03'), sign('04')] };
    out.KH7000000003 = { tab: '5', isSign: 1, scans: [pickup(VN), arrive('01'), sign('04')] };
    out.KH8000000001 = { tab: '1', isSign: 0, scans: [pickup(CN), arrive('05')] };
    return out;
}

export const ARRIVED = ['KH1000000001', 'KH1000000002', 'KH7000000001', 'KH8000000001'];
export const SIGNED_ONLY = ['KH7000000003'];

export const world = {
    parcels: {} as Record<string, Parcel>,
    zto: [] as string[],
    functionQueries: [] as Array<Record<string, string>>,
    gate: null as null | ((kind: string, key: string, palmToken: string) => Promise<void> | void),
    sbAccounts: new Map<string, unknown[]>(),
    sbDown: false,
    sbCalls: 0,
    certsDown: false,
    palmSessions: [] as string[],
    logins: [] as Array<Record<string, unknown>>,
    loginAnswer: null as null | ((body: any) => Response | Promise<Response>),
    deadTokens: new Set<string>(),
    issued: [] as string[],
    loginSeq: new Map<string, number>(),
    blobs: null as null | Map<string, { value: string; etag: string }>,
    loginSites: new Map<string, string>(),
    tokenSites: new Map<string, string>()
};

const BLOB_CONTEXT = Buffer.from(JSON.stringify({ url: 'https://blobs.netlify.test', token: 't' })).toString('base64');
let blobSeq = 0;

export function useSharedBlobs() {
    const blobs = new Map<string, { value: string; etag: string }>();
    world.blobs = blobs;
    fn.setBlobsModuleForTests({ connectLambda() {}, getStore() {
        return {
            async getWithMetadata(key: string) { const e = blobs.get(key); return e ? { data: e.value, etag: e.etag, metadata: {} } : null; },
            async set(key: string, value: string, options: any) {
                const e = blobs.get(key);
                if (options && options.onlyIfMatch && (!e || e.etag !== options.onlyIfMatch)) return { modified: false };
                if (options && options.onlyIfNew && e) return { modified: false };
                const etag = '"e' + (++blobSeq) + '"';
                blobs.set(key, { value, etag });
                return { modified: true, etag };
            },
            async delete(key: string) { blobs.delete(key); }
        };
    } });
    return blobs;
}

export function deferred<T = void>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((yes) => { resolve = yes; });
    return { promise, resolve };
}

function respond(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function b64(value: unknown) {
    return Buffer.from(JSON.stringify(value)).toString('base64url');
}

export function supabaseToken(sub: string, extra: Record<string, unknown> = {}) {
    const now = Math.floor(Date.now() / 1000);
    return b64({ alg: 'ES256', typ: 'JWT', kid: 'k1' }) + '.' + b64(Object.assign({
        iss: SB_URL + '/auth/v1', aud: 'authenticated', role: 'authenticated', sub, exp: now + 3600, iat: now
    }, extra)) + '.' + Buffer.from('sig-' + sub).toString('base64url');
}

export function identityToken(backend: Backend, site = SITE, status = 'active') {
    if (backend === 'firebase') return fx.tokenForSite(site);
    const token = supabaseToken('user-' + site + '-' + status);
    world.sbAccounts.set(token, site === '' ? [] : [{ tenant_id: 't-' + site, branch_code: site, status }]);
    return token;
}

function dispatchList(body: any, site: string) {
    const tab = String(body.billStatus);
    let codes = Object.keys(world.parcels).filter((code) => world.parcels[code].tab === tab);
    if (tab === '5') {
        codes = codes.filter((code) => world.parcels[code].scans.some((s) => s.action === '5' && s.siteCode === site
            && s.time >= body.signSiteDateFrom && s.time <= body.signSiteDateTo));
    }
    const size = Number(body.pageSize) || 20;
    const pages = Math.ceil(codes.length / size);
    const list = codes.slice((body.pageNum - 1) * size, body.pageNum * size)
        .map((billCode) => ({ billCode, billStatus: world.parcels[billCode].tab, consigneeMobile: '0960007345', cod: '3.5', dod: '0', dispEmpDate: at('02') }));
    return respond({ status: true, statusCode: 'SYS000', result: { list, pageNum: body.pageNum, pageSize: size, pages, total: codes.length } });
}

function trackGroup(code: string) {
    const parcel = world.parcels[code];
    if (!parcel || !parcel.scans.length) return null;
    const mail: Record<string, unknown> = { mailNo: code };
    if (parcel.isSign !== null) mail.isSign = parcel.isSign;
    return { mail, tracks: parcel.scans.map((s) => ({ mailNo: code, actionName: 'scan', ...s })).sort((a, b) => b.time.localeCompare(a.time)) };
}

export function palmTokenFor(label: string) {
    return ['eyJhbGciOiJSUzI1NiJ9', Buffer.from(JSON.stringify({ sub: JSON.stringify({ accessToken: label + '-sso' }) })).toString('base64url'), 'signature'].join('.');
}
function palmTokenOf(init: any) {
    const headers = init && init.headers || {};
    return String(headers['x-token'] || /(?:^|; )PDA_USER_COOKIE_01=([^;]+)/.exec(String(headers.Cookie || ''))?.[1] || '');
}

async function palmUpstream(href: string, init: any) {
    const path = new URL(href).pathname;
    const body = init.body ? JSON.parse(String(init.body)) : {};
    if (path === '/zto/system/v1/doLogin') {
        world.logins.push(body);
        if (world.gate) await world.gate('login', String(body.userName), '');
        if (world.loginAnswer) return world.loginAnswer(body);
        const seen = (world.loginSeq.get(String(body.userName)) || 0) + 1;
        world.loginSeq.set(String(body.userName), seen);
        const token = palmTokenFor('synthetic-palm-token-' + body.userName + (seen > 1 ? '-r' + seen : ''));
        const site = world.loginSites.get(String(body.userName)) || SITE;
        world.issued.push(token);
        world.tokenSites.set(token, site);
        return respond({ status: true, result: { token, countryCode: 'KH', siteCode: site, siteName: site === SITE ? 'Test branch' : 'Test branch ' + site } });
    }
    if (world.deadTokens.has(palmTokenOf(init))) return new URL(href).hostname.endsWith('.com') ? respond({ success: false }, 401) : respond({ status: false, statusCode: 'token_expired' });
    if (path === '/getUserInfo') return respond({ success: true, data: { siteCode: world.tokenSites.get(palmTokenOf(init)) || SITE } });
    if (path === '/scan/page/scan') {
        const key = 'list:3:' + body.pageNum;
        world.zto.push(key);
        if (world.gate) await world.gate('list', key, palmTokenOf(init));
        const codes = Object.keys(world.parcels).filter((code) => world.parcels[code].scans.some((scan) => scan.action === '3'
            && scan.siteCode === body.condition.scanSiteCode && scan.time >= body.condition.scanStartTime && scan.time <= body.condition.scanEndTime));
        const result = codes.slice((body.pageNum - 1) * body.pageSize, body.pageNum * body.pageSize).map((code) => ({ scanBillCode: code,
            consigneeMobile: '0960007345', agentAmount: 3.5, fcAmount: 0, scanTypeCode: '03', scanSiteCode: body.condition.scanSiteCode,
            scanTime: world.parcels[code].scans.find((scan) => scan.action === '3' && scan.siteCode === body.condition.scanSiteCode)!.time }));
        return respond({ success: true, data: { result, pageNum: body.pageNum, pageSize: body.pageSize, pages: Math.ceil(codes.length / body.pageSize), total: codes.length } });
    }
    if (path === '/zto/dispatch/v1/queryDispatchList') {
        const key = 'list:' + body.billStatus + (body.dispEmpDateFrom ? 'd' : '') + ':' + body.pageNum;
        world.zto.push(key);
        if (world.gate) await world.gate('list', key, palmTokenOf(init));
        return dispatchList(body, world.tokenSites.get(palmTokenOf(init)) || SITE);
    }
    if (path === '/zto/locus/v1/queryTrackInfo') {
        const code = String(body.mailNos);
        world.zto.push('track:' + code);
        if (world.gate) await world.gate('track', code, palmTokenOf(init));
        const group = trackGroup(code);
        return respond({ status: true, statusCode: 'SYS000', result: group ? [group] : [] });
    }
    return respond({}, 500);
}

function supabaseAccount(init: any) {
    world.sbCalls++;
    if (world.sbDown) throw new TypeError('fetch failed');
    const headers = (init && init.headers) || {};
    const token = String(headers.Authorization || '').replace(/^Bearer /, '');
    const rows = headers.apikey === SB_KEY ? world.sbAccounts.get(token) : undefined;
    if (rows === undefined) return respond({ code: 'PGRST301' }, 401);
    return respond(rows);
}

export function installFetch() {
    vi.stubGlobal('fetch', vi.fn(async (u: any, init: any) => {
        const href = String(u);
        if (href.includes(fx.CERTS_HOST)) {
            if (world.certsDown) throw new TypeError('fetch failed');
            return respond({ [fx.TEST_KID]: fx.TEST_CERT_PEM });
        }
        if (href.startsWith(SB_URL + '/rest/v1/rpc/my_account')) return supabaseAccount(init);
        if (href.startsWith(PALM_HOST) || href.startsWith('https://aargus-api.ztoglobal.com/')) return palmUpstream(href, init);
        if (href.startsWith(window.location.origin + '/.netlify/functions/zto-order-detail')) {
            const q: any = {};
            new URL(href).searchParams.forEach((v, k) => { q[k] = v; });
            const h: any = {};
            Object.entries((init && init.headers) || {}).forEach(([k, v]) => { h[k.toLowerCase()] = String(v); });
            if (q.list === '1' || q.status === '1') world.functionQueries.push(q);
            const r = await fn.handler({ httpMethod: init && init.method === 'POST' ? 'POST' : 'GET', headers: h, queryStringParameters: q,
                body: init && init.body, ...(world.blobs ? { blobs: BLOB_CONTEXT } : {}) });
            return new Response(r.body, { status: r.statusCode });
        }
        throw new Error('unexpected fetch ' + href);
    }));
}

export function serverEnv(mode: IdentityMode) {
    process.env.ZTO_PROXY_KEY = KEY;
    process.env.ZTO_PALM_SESSION_SECRET = 'synthetic-harness-session-secret-at-least-32-characters';
    process.env.ZTO_PALM_SIGN_KEY = 'synthetic-palm-sign-key';
    process.env.ZTO_PALM_PASSWORD_KEY = 'zoew-test-aes-16';
    process.env.FIREBASE_PROJECT_IDS = fx.TEST_PROJECT;
    process.env.SUPABASE_URL = SB_URL;
    process.env.SUPABASE_PUBLISHABLE_KEY = SB_KEY;
    if (mode === 'off') delete process.env.ZTO_DETAIL_IDENTITY;
    else process.env.ZTO_DETAIL_IDENTITY = mode;
    if (fn.resetCachesForTests) fn.resetCachesForTests();
}

export function clearServerEnv() {
    for (const k of ['ZTO_PROXY_KEY', 'ZTO_PALM_SESSION_SECRET', 'ZTO_PALM_SIGN_KEY', 'ZTO_PALM_PASSWORD_KEY',
        'FIREBASE_PROJECT_IDS', 'SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'ZTO_DETAIL_IDENTITY']) delete process.env[k];
    if (fn.resetCachesForTests) fn.resetCachesForTests();
}

export async function palmLoginBody(user = 'palm-user', idToken = '') {
    const headers: Record<string, string> = { 'x-zoe-proxy-key': KEY };
    if (idToken) headers['x-zoe-id-token'] = idToken;
    const res = await fn.handler({ httpMethod: 'POST', headers, queryStringParameters: { palm: 'login' },
        body: JSON.stringify({ username: user, password: 'palm-pass', deviceSn: 'zoew-harness-device' }), ...(world.blobs ? { blobs: BLOB_CONTEXT } : {}) });
    if (res.statusCode !== 200) throw new Error('palm login ' + res.statusCode + ' ' + res.body);
    const body = JSON.parse(res.body);
    world.palmSessions.push(body.sessionToken as string);
    return body;
}

export async function palmLogin(user = 'palm-user', idToken = '') {
    return (await palmLoginBody(user, idToken)).sessionToken as string;
}

export function shopOf(backend: Backend, site = SITE) {
    return backend === 'firebase' ? FIREBASE_DB_URL : SB_URL + '#t-' + site;
}

export function signIn(backend: Backend, token: string, site = SITE) {
    firebaseState.authGeneration++;
    firebaseState.db = { shop: shopOf(backend, site) } as any;
    if (backend === 'firebase') {
        appLocalStore.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: FIREBASE_DB_URL, apiKey: 'k', projectId: fx.TEST_PROJECT }));
        firebaseState.auth = { currentUser: { uid: 'firebase-user' } } as any;
        firebaseState.fb = { getIdTokenResult: async () => ({ token }), ref: (_db: unknown, path: string) => ({ path }) } as any;
    } else {
        appLocalStore.setItem('zoew_firebase_config', JSON.stringify({ supabaseUrl: SB_URL, supabaseKey: SB_KEY }));
        firebaseState.auth = { currentUser: { uid: 'supabase-user' }, app: { options: { supabaseUrl: SB_URL } } } as any;
        firebaseState.fb = { getIdTokenResult: async () => ({ token }), tenantScope: () => 't-' + site,
            ref: (_db: unknown, path: string) => ({ path }) } as any;
    }
}

export async function storePalmConfig(backend: Backend, session: string, site = SITE, extra: Record<string, unknown> = {}) {
    appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify({ enabled: true, fastMode: true,
        url: window.location.origin + '/.netlify/functions/zto-order-detail?palm=1&barcode={barcode}',
        headerName: 'X-Zoe-Proxy-Key', headerValueEnc: await encryptLookupSecret(KEY), palmTokenEnc: await encryptLookupSecret(session),
        palmAccount: { siteCode: SITE, siteName: 'Test branch' }, shop: shopOf(backend, site), ...extra }));
    appLocalStore.setItem('zoew_zto_listsync_v1', '1');
}

export async function setupWorld(backend: Backend, mode: IdentityMode, opts: { site?: string; status?: string; bulk?: number } = {}) {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(NOW));
    vi.stubGlobal('crypto', webcrypto);
    world.parcels = dataset(opts.bulk || 0);
    world.zto.length = 0;
    world.functionQueries.length = 0;
    world.gate = null;
    world.sbAccounts.clear();
    world.sbDown = false;
    world.sbCalls = 0;
    world.certsDown = false;
    world.palmSessions.length = 0;
    world.logins.length = 0;
    world.issued.length = 0;
    world.loginSeq.clear();
    world.loginSites.clear();
    world.tokenSites.clear();
    world.loginAnswer = null;
    world.deadTokens.clear();
    serverEnv(mode);
    installFetch();
    appLocalStore.clear();
    securityState.lookupSecretKey = await webcrypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']) as any;
    const site = opts.site === undefined ? SITE : opts.site;
    const token = identityToken(backend, site, opts.status || 'active');
    signIn(backend, token, site || SITE);
    const session = await palmLogin('palm-user', mode === 'require' ? identityToken(backend, SITE) : '');
    await storePalmConfig(backend, session, site || SITE);
    clearCustomerDataTableCache();
    clearZtoPickupStatusStore();
    ztoState.ztoListSyncInFlight = false;
    ztoState.ztoListSyncResult = null;
    ztoState.ztoStatusInFlight = false;
    dataState.scanHistory = [];
    dataState.deletedItems = [];
    uiState.isModalOpen = false;
    uiState.toasts = [];
    viewState.ztoListSyncNote = '';
    setRangeFields();
    return { token, session };
}

export function setRangeFields() {
    for (const name of ['ztoListSyncFrom', 'ztoListSyncTo'] as const) {
        const input = document.createElement('input');
        input.value = name === 'ztoListSyncFrom' ? RANGE.from : RANGE.to;
        refTo(name)(input);
    }
}

export function teardownWorld() {
    if (world.blobs) fn.setBlobsModuleForTests(null);
    world.blobs = null;
    vi.useRealTimers();
    vi.unstubAllGlobals();
    appLocalStore.clear();
    securityState.lookupSecretKey = null;
    world.gate = null;
    world.loginAnswer = null;
    world.deadTokens.clear();
    refTo('ztoListSyncFrom')(null);
    refTo('ztoListSyncTo')(null);
    clearServerEnv();
}

export function pulledRows() {
    const result = ztoState.ztoListSyncResult;
    const map = new Map<string, any>();
    for (const row of result ? result.rows : []) map.set(row.barcode, row);
    return map;
}

export function noteText() {
    return String(viewState.ztoListSyncNote || '');
}

export function toastTexts() {
    return uiState.toasts.map((t: any) => String(t.msg));
}
