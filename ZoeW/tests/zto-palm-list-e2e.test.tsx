/**
 * ⛔ សំណើម្ចាស់គម្រោង (PR #328) ៖ «login palm ទាញបញ្ជី ZTO មិនបាន … ធ្វើឲ្យការទាញរបស់ Palm mode ដូច Cookie 100% មានទាំងប្រភព
 *    និងព័ត៌មានទិន្នន័យបិទរួចឬនៅ» ខណៈ «បិទតាម ZTO» និងរបាររំលឹក (ពិនិត្យកញ្ចប់ម្តងមួយ) ដំណើរការល្អ។
 *    Cookie ទាញបញ្ជីមកដល់ពី ZTO ដោយសំណើពីរបី ។ Palm គ្មានបញ្ជីស្កេនមកដល់ ➜ អានបេក្ខភាពពី `queryDispatchList` រួចអាន
 *    `queryTrackInfo` ម្តងមួយកញ្ចប់ ➜ សំណើ ZTO រាប់សិប/រាប់រយក្នុងការទាញមួយ។ កូដមុនកែគ្មានការសាកម្តងទៀតណាមួយ ហើយ track
 *    មួយកញ្ចប់ដែលខុសទម្រង់ ឬបរាជ័យ ធ្វើឲ្យបញ្ជីទាំងមូលធ្លាក់ ➜ សំណើបរាជ័យម្តងម្កាលរបស់ ZTO តែមួយ = «ទាញបញ្ជីមិនបាន»។
 *    App ពិត (`runZtoListSyncPreview`) + Function ពិត (`zto-order-detail.js` ➜ `_shared/zto-palm.js`) + ZTO Palm ក្លែង។
 */
import { webcrypto } from 'node:crypto';
import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { refTo } from '../src/app/refs';
import { dataState, firebaseState, securityState, uiState, ztoState } from '../src/core/state';
import { appLocalStore } from '../src/core/storage';
import { clearCustomerDataTableCache } from '../src/features/customer-table';
import { runZtoListSyncPreview } from '../src/features/zto-list-sync';
import { clearZtoPickupStatusStore } from '../src/features/zto-status';
import { viewState } from '../src/core/view-state';
import { encryptLookupSecret } from '../src/services/crypto';

vi.mock('../src/features/barcode-ops', () => ({
    openViewListModal: () => {},
    removeSingleBarcode: async () => 'failed',
    toggleIndividualBarcodeClose: async () => false,
    openEditBarcodePriceModal: () => {},
    closeEditBarcodeModal: () => {},
    saveEditedBarcodePrice: () => {},
    applyBarcodeCloseChange: async () => true
}));

const req = createRequire(import.meta.url);
const fn = req('../netlify/functions/zto-order-detail.js');
const fx = req('../../audit-tools/idtoken-fixture.js');
const KEY = 'palm-e2e-proxy-key-0123456789';
const NOW = Date.UTC(2026, 9, 6, 3, 0, 0);
const SITE = 'KH001';
const PALM_URL = window.location.origin + '/.netlify/functions/zto-order-detail?palm=1&barcode={barcode}';
const CN = 'ZTO ឃ្លាំងក្វាងចូវអន្តរជាតិ';
const VN = 'Shopee SHPE';

type Scan = { action: string; siteCode: string; time: string; mailNo?: string; msgLoc?: string; siteName?: string };
type Parcel = { tab: '1' | '4' | '5'; isSign: number | null; scans: Scan[] };

let parcels: Record<string, Parcel> = {};
let faults: Map<string, number> = new Map();
let always: Set<string> = new Set();
let authDead = '';
let multi = false;
let inFlight = 0;
let peakTracks = 0;
let functionCalls = 0;
const zto: string[] = [];
const palm = req('../netlify/functions/_shared/zto-palm.js');

const at = (day: string, time = '09:00:00') => '2026-10-' + day + ' ' + time;
const pickup = (origin: string): Scan => ({ action: '1', siteCode: 'ORIGIN', time: at('01', '08:00:00'), msgLoc: '【' + origin + '】បានស្កែនទទួល' });
const transit = (day: string): Scan => ({ action: '2', siteCode: 'HUB', time: at(day, '07:00:00') });
const arrive = (day: string, time?: string): Scan => ({ action: '3', siteCode: SITE, time: at(day, time) });
const sign = (day: string, time = '15:30:00'): Scan => ({ action: '5', siteCode: SITE, time: at(day, time) });

function dataset(bulk = 0) {
    const out: Record<string, Parcel> = {};
    for (let i = 1; i <= bulk; i++) out['KH90000' + String(i).padStart(5, '0')] = { tab: '4', isSign: 0, scans: [pickup(CN), transit('05')] };
    for (let i = 1; i <= 8; i++) out['KH10000000' + String(i).padStart(2, '0')] = { tab: '4', isSign: 0,
        scans: [pickup(i % 2 ? CN : VN), transit('02'), arrive(String(2 + Math.min(i, 4)).padStart(2, '0'))] };
    for (let i = 1; i <= 5; i++) out['KH20000000' + String(i).padStart(2, '0')] = { tab: '4', isSign: 0, scans: [pickup(CN), transit('05')] };
    out.KH3000000001 = { tab: '4', isSign: 0, scans: [pickup(VN), arrive('01')] };
    out.KH4000000001 = { tab: '4', isSign: 0, scans: [{ ...pickup(CN), mailNo: 'CN7788990011' }, pickup(CN), arrive('05')] };
    out.KH5000000001 = { tab: '4', isSign: 0, scans: [pickup(VN), arrive('04')] };
    out.KH6000000001 = { tab: '4', isSign: 0, scans: [pickup(VN)] };
    out.KH7000000001 = { tab: '5', isSign: 1, scans: [pickup(CN), arrive('03'), sign('04')] };
    out.KH7000000002 = { tab: '5', isSign: 1, scans: [pickup(VN), arrive('05'), sign('06', '09:10:00')] };
    out.KH7000000003 = { tab: '5', isSign: 1, scans: [pickup(CN), arrive('01'), sign('04')] };
    out.KH7000000004 = { tab: '5', isSign: 1, scans: [pickup(VN), arrive('04'), sign('05')] };
    out.KH8000000001 = { tab: '1', isSign: 0, scans: [pickup(CN), arrive('05')] };
    return out;
}

function respond(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function fault(keys: string[]) {
    if (keys.some((key) => always.has(key))) return respond({ message: 'gateway' }, 502);
    const hit = keys.filter((key) => (faults.get(key) || 0) > 0);
    if (!hit.length) return null;
    hit.forEach((key) => faults.set(key, (faults.get(key) || 0) - 1));
    return hit[0].startsWith('list:5') ? respond({ status: false, statusCode: 'SYS_BUSY', message: 'busy' }) : respond({ message: 'gateway' }, 503);
}

function dispatchList(body: any) {
    const tab = String(body.billStatus);
    let codes = Object.keys(parcels).filter((code) => parcels[code].tab === tab);
    if (tab === '5') {
        codes = codes.filter((code) => parcels[code].scans.some((s) => s.action === '5'
            && s.time >= body.signSiteDateFrom && s.time <= body.signSiteDateTo));
    }
    const size = Number(body.pageSize) || 20;
    const pages = Math.ceil(codes.length / size);
    const list = codes.slice((body.pageNum - 1) * size, body.pageNum * size)
        .map((billCode) => ({ billCode, billStatus: parcels[billCode].tab, consigneeMobile: '0960007345', cod: '3.5', dod: '0', dispEmpDate: at('02') }));
    return respond({ status: true, statusCode: 'SYS000', result: { list, pageNum: body.pageNum, pageSize: size, pages, total: codes.length } });
}

function trackGroup(code: string) {
    const parcel = parcels[code];
    if (!parcel || !parcel.scans.length) return null;
    const mail: Record<string, unknown> = { mailNo: code };
    if (parcel.isSign !== null) mail.isSign = parcel.isSign;
    return { mail, tracks: parcel.scans.map((s) => ({ mailNo: code, actionName: 'scan', ...s })).sort((a, b) => b.time.localeCompare(a.time)) };
}

function trackInfo(codes: string[]) {
    if (codes.length > 1 && !multi) return respond({ status: true, statusCode: 'SYS000', result: [] });
    return respond({ status: true, statusCode: 'SYS000', result: codes.map(trackGroup).filter(Boolean) });
}

async function palmUpstream(href: string, init: any) {
    const path = new URL(href).pathname;
    const body = JSON.parse(String(init.body));
    if (path === '/zto/system/v1/doLogin') {
        return respond({ status: true, result: { token: 'synthetic-palm-token', countryCode: 'KH', siteCode: SITE, siteName: 'Test branch' } });
    }
    if (path === '/zto/dispatch/v1/queryDispatchList') {
        const key = 'list:' + body.billStatus + ':' + body.pageNum;
        zto.push(key);
        return fault([key]) || dispatchList(body);
    }
    if (path === '/zto/locus/v1/queryTrackInfo') {
        expect(typeof body.mailNos).toBe('string');
        const codes = String(body.mailNos).split(',');
        zto.push('track:' + body.mailNos);
        if (authDead && codes.includes(authDead)) return respond({ status: false, statusCode: 'token_expired' });
        inFlight++;
        peakTracks = Math.max(peakTracks, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 2));
        inFlight--;
        return fault(codes.map((code) => 'track:' + code)) || trackInfo(codes);
    }
    return respond({}, 500);
}

async function palmSession() {
    const res = await fn.handler({ httpMethod: 'POST', headers: { 'x-zoe-proxy-key': KEY }, queryStringParameters: { palm: 'login' },
        body: JSON.stringify({ username: 'palm-user', password: 'palm-pass', deviceSn: 'zoew-e2e-device' }) });
    expect(res.statusCode).toBe(200);
    return JSON.parse(res.body).sessionToken as string;
}

beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(NOW));
    vi.stubGlobal('crypto', webcrypto);
    process.env.ZTO_PROXY_KEY = KEY;
    process.env.ZTO_PALM_SESSION_SECRET = 'synthetic-e2e-session-secret-at-least-32-characters';
    process.env.ZTO_PALM_SIGN_KEY = 'synthetic-palm-sign-key';
    process.env.ZTO_PALM_PASSWORD_KEY = 'zoew-test-aes-16';
    process.env.FIREBASE_PROJECT_IDS = fx.TEST_PROJECT;
    if (fn.resetCachesForTests) fn.resetCachesForTests();
    palm.resetPalmForTests();
    parcels = dataset();
    faults = new Map();
    always = new Set();
    authDead = '';
    multi = false;
    inFlight = 0;
    peakTracks = 0;
    functionCalls = 0;
    zto.length = 0;
    vi.stubGlobal('fetch', vi.fn(async (u: any, init: any) => {
        const href = String(u);
        if (href.includes(fx.CERTS_HOST)) return respond({ [fx.TEST_KID]: fx.TEST_CERT_PEM });
        if (href.startsWith('https://aargus-api.ztoglobal.net/')) return palmUpstream(href, init);
        if (href.startsWith(window.location.origin + '/.netlify/functions/zto-order-detail')) {
            const q: any = {};
            new URL(href).searchParams.forEach((v, k) => { q[k] = v; });
            const h: any = {};
            Object.entries((init && init.headers) || {}).forEach(([k, v]) => { h[k.toLowerCase()] = String(v); });
            if (q.list === '1') functionCalls++;
            const r = await fn.handler({ httpMethod: 'GET', headers: h, queryStringParameters: q });
            return new Response(r.body, { status: r.statusCode });
        }
        throw new Error('unexpected fetch ' + href);
    }));
    const session = await palmSession();
    appLocalStore.clear();
    securityState.lookupSecretKey = await webcrypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']) as any;
    appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify({ enabled: true, fastMode: true, url: PALM_URL,
        headerName: 'X-Zoe-Proxy-Key', headerValueEnc: await encryptLookupSecret(KEY), palmTokenEnc: await encryptLookupSecret(session),
        palmAccount: { siteCode: SITE, siteName: 'Test branch' } }));
    appLocalStore.setItem('zoew_zto_listsync_v1', '1');
    clearCustomerDataTableCache();
    clearZtoPickupStatusStore();
    ztoState.ztoListSyncInFlight = false;
    ztoState.ztoListSyncResult = null;
    ztoState.ztoStatusInFlight = false;
    dataState.scanHistory = [];
    dataState.deletedItems = [];
    uiState.isModalOpen = false;
    uiState.toasts = [];
    firebaseState.authGeneration++;
    firebaseState.auth = { currentUser: { uid: 'audit-user' } } as any;
    firebaseState.db = { audit: true } as any;
    const token = fx.tokenForSite('001');
    firebaseState.fb = { getIdTokenResult: async () => ({ token }), ref: (_db: unknown, path: string) => ({ path }) } as any;
    for (const name of ['ztoListSyncFrom', 'ztoListSyncTo'] as const) {
        const input = document.createElement('input');
        input.value = name === 'ztoListSyncFrom' ? '2026-10-03' : '2026-10-06';
        refTo(name)(input);
    }
});

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    appLocalStore.clear();
    securityState.lookupSecretKey = null;
    refTo('ztoListSyncFrom')(null);
    refTo('ztoListSyncTo')(null);
    for (const k of ['ZTO_PALM_SESSION_SECRET', 'ZTO_PALM_SIGN_KEY', 'ZTO_PALM_PASSWORD_KEY']) delete process.env[k];
});

const ARRIVED = ['KH1000000001', 'KH1000000002', 'KH1000000003', 'KH1000000004', 'KH1000000005', 'KH1000000006', 'KH1000000007',
    'KH1000000008', 'KH4000000001', 'KH5000000001', 'KH7000000001', 'KH7000000002', 'KH7000000004', 'KH8000000001'];

function rowsByCode() {
    const result = ztoState.ztoListSyncResult;
    const map = new Map<string, any>();
    for (const row of result ? result.rows : []) map.set(row.barcode, row);
    return map;
}

const TAB4_ARRIVED = ['KH1000000001', 'KH1000000002', 'KH1000000003', 'KH1000000004', 'KH1000000005', 'KH1000000006', 'KH1000000007',
    'KH1000000008', 'KH4000000001', 'KH5000000001'];

describe.each([['ZTO អាន track ម្តងមួយលេខ', false], ['ZTO អាន track ច្រើនលេខក្នុងសំណើតែមួយ', true]])('ZTO Palm ៖ ទាញបញ្ជីមកដល់ដូច Cookie (%s)', (_label, supportsMulti) => {
    beforeEach(() => { multi = supportsMulti; });

    it('ZTO បរាជ័យម្តងម្កាល (503 · SYS_BUSY) ➜ បញ្ជីពេញ · ម៉ោងមកដល់ · ប្រភព · បិទរួច/មិនទាន់ ដូច Cookie', async () => {
        for (const key of ['list:5:1', 'track:KH1000000003', 'track:KH7000000002', 'track:KH2000000002']) faults.set(key, 1);
        faults.set('list:4:1', 2);
        faults.set('track:KH1000000006', 3);
        await runZtoListSyncPreview();
        expect(viewState.ztoListSyncNote, viewState.ztoListSyncNote).not.toContain('ទាញបញ្ជីពី ZTO មិនបាន');
        const rows = rowsByCode();
        expect([...rows.keys()].sort()).toEqual(ARRIVED.slice().sort());
        expect(rows.get('KH1000000001')).toMatchObject({ phone: '0960007345', cod: 3.5, dod: 0, at: '2026-10-03 09:00:00', ztoClosed: false, from: CN });
        expect(rows.get('KH1000000002')).toMatchObject({ at: '2026-10-04 09:00:00', ztoClosed: false, from: VN });
        expect(rows.get('KH7000000001')).toMatchObject({ at: '2026-10-03 09:00:00', ztoClosed: true, from: CN });
        expect(rows.get('KH7000000002')).toMatchObject({ at: '2026-10-05 09:00:00', ztoClosed: true, from: VN });
        const signedRows = new Map((ztoState.ztoListSyncResult.signedRows as any[]).map((r) => [r.barcode, r]));
        expect(signedRows.get('KH7000000003')).toMatchObject({ at: '2026-10-04 15:30:00', from: CN });
        expect(signedRows.get('KH7000000002')).toMatchObject({ at: '2026-10-06 09:10:00', from: VN });
        const shown = new Map<string, any>();
        for (const group of ztoState.ztoListPreview.groups) for (const row of group.rows) shown.set(row.barcode, row);
        expect(shown.get('KH7000000001').origin).toBe('🇨🇳 ចិន · ' + CN);
        expect(shown.get('KH7000000001').notes).toEqual(expect.arrayContaining(['📥 មកដល់ ៖ 2026-10-03 09:00:00',
            '✍️ ZTO ចុះហត្ថលេខា (បិទ) ៖ 2026-10-04 15:30:00', '🔒 ZTO បិទបញ្ជីរួច ➜ បញ្ចូលជា «យករួច»']));
        expect(shown.get('KH1000000002').origin).toBe('🇻🇳 វៀតណាម · ' + VN);
        expect(shown.get('KH1000000002').notes).toEqual(['📥 មកដល់ ៖ 2026-10-04 09:00:00']);
        expect(viewState.ztoListSyncNote).toContain('🔒 ថ្មីដែល ZTO បិទរួច 3');
        expect(viewState.ztoListSyncNote).toContain('✍️ ZTO ចុះហត្ថលេខាក្នុងចន្លោះ តែមកដល់មុនថ្ងៃ 2026-10-03 ៖ 1');
        expect(viewState.ztoListSyncNote).toContain('⏱ Palm ៖ ផ្ទៀង ' + Object.keys(parcels).length + ' កញ្ចប់');
    });

    it('track ដែលមិនមែនរបស់ Barcode នេះ (ឧ. លេខជើងដំបូង) មិនធ្វើឲ្យបញ្ជីទាំងមូលធ្លាក់ ហើយមិនក្លាយជាភស្តុតាង', async () => {
        await runZtoListSyncPreview();
        expect(viewState.ztoListSyncNote, viewState.ztoListSyncNote).not.toContain('ទាញបញ្ជីពី ZTO មិនបាន');
        expect(rowsByCode().get('KH4000000001')).toMatchObject({ at: '2026-10-05 09:00:00', ztoClosed: false, from: CN });
    });

    it('track មួយកញ្ចប់បរាជ័យរហូត ➜ បញ្ជីនៅតែមក · Barcode នោះប្រាប់ច្បាស់ថាផ្ទៀងមិនបាន (មិនបាត់ស្ងាត់)', async () => {
        always.add('track:KH1000000005');
        await runZtoListSyncPreview();
        expect(viewState.ztoListSyncNote, viewState.ztoListSyncNote).not.toContain('ទាញបញ្ជីពី ZTO មិនបាន');
        const rows = rowsByCode();
        expect(rows.has('KH1000000005')).toBe(false);
        expect([...rows.keys()].sort()).toEqual(ARRIVED.filter((c) => c !== 'KH1000000005').sort());
        expect(ztoState.ztoListSyncResult.unverified).toEqual(['KH1000000005']);
        expect(viewState.ztoListSyncNote).toContain('KH1000000005');
        expect(viewState.ztoListSyncNote).toContain('⚠️ ZTO មិនឆ្លើយ track 1 កញ្ចប់');
        expect(zto.filter((k) => k === 'track:KH1000000005').length, 'សាកម្តងទៀតមានព្រំដែន').toBeLessThanOrEqual(6);
    });

    it('ទំព័របេក្ខភាពមួយ ZTO មិនឆ្លើយរហូត ➜ ទំព័រផ្សេងនៅមក · ប្រាប់ថាបញ្ជីមិនទាន់ពេញ (មិនមែនបាត់ស្ងាត់ ឬធ្លាក់ទាំងអស់)', async () => {
        parcels = dataset(150);
        always.add('list:4:2');
        await runZtoListSyncPreview();
        expect(viewState.ztoListSyncNote, viewState.ztoListSyncNote).not.toContain('ទាញបញ្ជីពី ZTO មិនបាន');
        expect(ztoState.ztoListSyncResult.failedPages).toEqual([2]);
        expect(viewState.ztoListSyncNote).toContain('⚠️ ទាញមិនបាន 1 ទំព័រ');
        expect([...rowsByCode().keys()].sort(), 'កញ្ចប់ tab «បញ្ជូន» ទំព័រ ២ មិនទាន់មាន').toEqual(ARRIVED.filter((c) => !TAB4_ARRIVED.includes(c)).sort());
        expect(zto.filter((k) => k === 'list:4:2').length, 'សាកម្តងទៀតមានព្រំដែន').toBeLessThanOrEqual(6);
    });

    it('Session Palm ផុតកំណត់ពាក់កណ្តាល ➜ បញ្ឈប់ ហើយប្រាប់ឲ្យ Login Palm ម្តងទៀត (មិនលាក់ជា «ផ្ទៀងមិនបាន»)', async () => {
        authDead = 'KH1000000004';
        await runZtoListSyncPreview();
        expect(ztoState.ztoListSyncResult).toBeNull();
        expect(viewState.ztoListSyncNote).toContain('Login ZTO Palm');
    });

    it('⏱ ល្បឿន (ម្ចាស់គម្រោង ៖ Palm ១–២ នាទី · Cookie ប៉ុន្មានវិនាទី) ៖ បញ្ជី ១០០ ក្នុងមួយទំព័រ · track ជាក្រុមស្របគ្នា · មិនស្ទួន', async () => {
        parcels = dataset(150);
        const total = Object.keys(parcels).length;
        await runZtoListSyncPreview();
        expect([...rowsByCode().keys()].sort()).toEqual(ARRIVED.slice().sort());
        const lists = zto.filter((k) => k.startsWith('list:')).sort();
        expect(lists, 'tab នីមួយៗអានម្តង ១០០ ជួរ · tab ដែលអស់ទំព័រមិនអានស្ទួន').toEqual(['list:1:1', 'list:4:1', 'list:4:2', 'list:5:1']);
        expect(functionCalls, 'សំណើទៅ Function ៖ ទំព័របេក្ខភាព ២ + track ' + Math.ceil(total / 30)).toBe(2 + Math.ceil(total / 30));
        const tracks = zto.filter((k) => k.startsWith('track:'));
        if (supportsMulti) {
            expect(tracks.length, 'track ច្រើនលេខ ៖ ≤ ១០ Barcode ក្នុងមួយសំណើ').toBeLessThanOrEqual(Math.ceil(total / 10) + Math.ceil(total / 30));
        } else {
            expect(tracks.filter((k) => !k.includes(',')).length, 'track ម្តងមួយ Barcode').toBe(total);
            expect(peakTracks, 'track ស្របគ្នា ≥ 16').toBeGreaterThanOrEqual(16);
        }
        expect(peakTracks, 'មានព្រំដែន ៖ ≤ 4 សំណើ × 8').toBeLessThanOrEqual(32);
        expect(viewState.ztoListSyncNote).toContain('(សំណើ track ' + tracks.length + ')');
    });
});
