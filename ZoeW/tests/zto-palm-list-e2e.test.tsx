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
import { decryptLookupSecret, encryptLookupSecret } from '../src/services/crypto';

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
type Parcel = { tab: '1' | '4' | '5'; isSign: number | null; scans: Scan[]; dispEmp?: string; undated?: boolean; awaitingOnly?: boolean };

let parcels: Record<string, Parcel> = {};
const loginSiteName = '';
let faults: Map<string, number> = new Map();
let always: Set<string> = new Set();
let authDead = '';
let slowList: Map<string, number> = new Map();
let listDelayMs = 0;
let firstDispatchPages: number | null = null;
let tracksWhenListDone: Map<string, number> = new Map();
let listsWhenListDone: Map<string, string[]> = new Map();
let trackBatches: number[] = [];
let inFlight = 0;
let peakTracks = 0;
let functionCalls = 0;
let functionInFlight = 0;
let peakFunctions = 0;
const zto: string[] = [];

const at = (day: string, time = '09:00:00') => '2026-10-' + day + ' ' + time;
const pickup = (origin: string): Scan => ({ action: '1', siteCode: 'ORIGIN', time: at('01', '08:00:00'), msgLoc: '【' + origin + '】បានស្កែនទទួល' });
const transit = (day: string): Scan => ({ action: '2', siteCode: 'HUB', siteName: 'មជ្ឈមណ្ឌលដឹកបន្ត', time: at(day, '07:00:00') });
const BRANCH_NAME = 'សាខាភ្នំពេញ ១';
const arrive = (day: string, time?: string): Scan => ({ action: '3', siteCode: SITE, siteName: BRANCH_NAME, time: at(day, time) });
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
    const nativeAwaiting = tab === '4' && body.pageSize === 1000 && body.dispEmpDateFrom === at('03', '00:00:00') && body.dispEmpDateTo === at('06', '23:59:59');
    let codes = Object.keys(parcels).filter((code) => parcels[code].tab === tab && (!parcels[code].awaitingOnly || nativeAwaiting));
    if (tab === '4' && body.dispEmpDateFrom) {
        codes = codes.filter((code) => (parcels[code].dispEmp || at('02')) >= body.dispEmpDateFrom && (parcels[code].dispEmp || at('02')) <= body.dispEmpDateTo);
    } else if (tab === '4') {
        codes = codes.filter((code) => parcels[code].undated !== false);
    }
    if (tab === '5') {
        codes = codes.filter((code) => parcels[code].scans.some((s) => s.action === '5'
            && s.time >= body.signSiteDateFrom && s.time <= body.signSiteDateTo));
    }
    const size = Number(body.pageSize) || 20;
    const pages = tab === '4' && body.pageNum === 1 && firstDispatchPages !== null ? firstDispatchPages : Math.ceil(codes.length / size);
    const list = codes.slice((body.pageNum - 1) * size, body.pageNum * size)
        .map((billCode) => ({ billCode, billStatus: parcels[billCode].tab, consigneeMobile: '0960007345', cod: '3.5', dod: '0', dispEmpDate: parcels[billCode].dispEmp || at('02') }));
    return respond({ status: true, statusCode: 'SYS000', result: { list, pageNum: body.pageNum, pageSize: size, pages, total: Math.min(codes.length, pages * size) } });
}

function trackGroup(code: string) {
    const parcel = parcels[code];
    if (!parcel || !parcel.scans.length) return null;
    const mail: Record<string, unknown> = { mailNo: code };
    if (parcel.isSign !== null) mail.isSign = parcel.isSign;
    return { mail, tracks: parcel.scans.map((s) => ({ mailNo: code, actionName: 'scan', ...s })).sort((a, b) => b.time.localeCompare(a.time)) };
}

function trackInfo(codes: string[]) {
    if (codes.length > 1) return respond({ status: true, statusCode: 'SYS000', result: [] });
    return respond({ status: true, statusCode: 'SYS000', result: codes.map(trackGroup).filter(Boolean) });
}

async function palmUpstream(href: string, init: any) {
    const path = new URL(href).pathname;
    const body = JSON.parse(String(init.body));
    if (path === '/zto/system/v1/doLogin') {
        return respond({ status: true, result: { token: 'synthetic-palm-token', countryCode: 'KH', siteCode: SITE, siteName: loginSiteName } });
    }
    if (path === '/zto/dispatch/v1/queryDispatchList') {
        const key = 'list:' + body.billStatus + (body.dispEmpDateFrom ? (body.pageSize === 1000 ? 'a' : 'd') : '') + ':' + body.pageNum;
        zto.push(key);
        const wait = slowList.get(key) || listDelayMs;
        if (wait) {
            await new Promise((resolve) => setTimeout(resolve, wait));
            tracksWhenListDone.set(key, zto.filter((k) => k.startsWith('track:')).length);
            listsWhenListDone.set(key, zto.filter((k) => k.startsWith('list:')));
        }
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
    parcels = dataset();
    faults = new Map();
    always = new Set();
    authDead = '';
    slowList = new Map();
    listDelayMs = 0;
    firstDispatchPages = null;
    tracksWhenListDone = new Map();
    listsWhenListDone = new Map();
    trackBatches = [];
    inFlight = 0;
    peakTracks = 0;
    functionCalls = 0;
    functionInFlight = 0;
    peakFunctions = 0;
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
            if (q.list === '1' && q.tracks) trackBatches.push(String(q.tracks).split(',').length);
            const tracking = q.list === '1' && !!q.tracks;
            if (tracking) peakFunctions = Math.max(peakFunctions, ++functionInFlight);
            let r;
            try {
                r = await fn.handler({ httpMethod: 'GET', headers: h, queryStringParameters: q });
            } finally {
                if (tracking) functionInFlight--;
            }
            return new Response(r.body, { status: r.statusCode });
        }
        throw new Error('unexpected fetch ' + href);
    }));
    const session = await palmSession();
    appLocalStore.clear();
    securityState.lookupSecretKey = await webcrypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']) as any;
    appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify({ enabled: true, fastMode: true, url: PALM_URL,
        headerName: 'X-Zoe-Proxy-Key', headerValueEnc: await encryptLookupSecret(KEY), palmTokenEnc: await encryptLookupSecret(session),
        palmAccount: { siteCode: SITE, siteName: '' } }));
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

describe('ZTO Palm ៖ ទាញបញ្ជីមកដល់ដូច Cookie', () => {
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
        expect(viewState.ztoListSyncNote).toMatch(new RegExp('^ZTO ' + ARRIVED.length + ' ជួរ · 2026-10-03 ➜ 2026-10-06 · 🔒 ZTO បិទរួច 3 ➜ «យករួច» · '
            + '✍️ ចុះហត្ថលេខា \\(មកដល់មុន 2026-10-03\\) 1 ➜ «យករួច» · ⏱ \\d+\\.\\d វិ · 👁️ មើលជាមុន$'));
    });

    it('📮 ម្ចាស់គម្រោង (2026-10-17 ៖ Cookie ៦១ ⟷ Palm ៤៧ · កញ្ចប់មកដល់រសៀលខ្វះ · App Palm ឃើញវាក្នុង tab «បញ្ជូន») ៖ tab «បញ្ជូន» ដែលគ្មានថ្ងៃមិនឆ្លើយកញ្ចប់ទាំងនោះ ➜ អានតាម `dispEmpDate` ដូច App Palm ផង', async () => {
        parcels.KH9100000001 = { tab: '4', isSign: 0, dispEmp: at('06', '08:30:00'), undated: false, scans: [pickup(VN), arrive('06', '09:30:00')] };
        parcels.KH9100000002 = { tab: '4', isSign: 0, dispEmp: at('05', '13:50:00'), undated: false, scans: [pickup(VN), arrive('05', '14:32:55')] };
        parcels.KH9100000003 = { tab: '4', isSign: 0, dispEmp: at('06', '08:30:00'), undated: false, scans: [pickup(VN), transit('06')] };
        await runZtoListSyncPreview();
        const rows = rowsByCode();
        expect(rows.get('KH9100000001')).toMatchObject({ at: '2026-10-06 09:30:00', ztoClosed: false, from: VN });
        expect(rows.get('KH9100000002')).toMatchObject({ at: '2026-10-05 14:32:55', ztoClosed: false, from: VN });
        expect(rows.has('KH9100000003'), 'នៅតាមផ្លូវ (គ្មានស្កេនមកដល់) ➜ មិនមែនជួរ (ថ្ងៃចាត់ ≠ ថ្ងៃមកដល់)').toBe(false);
        expect([...rows.keys()].sort()).toEqual(ARRIVED.concat(['KH9100000001', 'KH9100000002']).sort());
        expect(zto.some((key) => key.startsWith('list:4d:')), 'អាន tab «បញ្ជូន» តាមថ្ងៃ').toBe(true);
        expect(zto.some((key) => key.startsWith('list:4:')), 'នៅតែអាន tab «បញ្ជូន» គ្មានថ្ងៃ (កញ្ចប់ដែលចាត់មុនចន្លោះ)').toBe(true);
    });

    it('awaiting dispatch ដូច APK ៖ កញ្ចប់មកដល់មុនស្កេនចែកចាយ · មិនមានក្នុងចម្លើយសំណើចាស់ · Palm សុទ្ធ', async () => {
        const pending: string[] = [];
        for (let i = 0; i < 18; i++) {
            const code = 'KH920000' + String(i).padStart(4, '0');
            pending.push(code);
            parcels[code] = { tab: '4', awaitingOnly: true, isSign: 0, dispEmp: at('06'), scans: [pickup(VN), arrive('06')] };
        }
        parcels.KH9200009998 = { tab: '4', awaitingOnly: true, isSign: 0, dispEmp: at('06'), scans: [pickup(VN), transit('06')] };
        parcels.KH9200009999 = { tab: '4', awaitingOnly: true, isSign: 0, dispEmp: at('06'), scans: [pickup(VN), { ...arrive('06'), siteCode: 'OTHER' }] };
        await runZtoListSyncPreview();
        expect([...rowsByCode().keys()].sort()).toEqual(ARRIVED.concat(pending).sort());
        for (const code of pending) expect(rowsByCode().get(code)).toMatchObject({ at: at('06'), ztoClosed: false, from: VN });
        expect(zto.filter((key) => key.startsWith('list:4a:'))).toEqual(['list:4a:1']);
        for (const code of pending) expect(zto.filter((key) => key === 'track:' + code)).toHaveLength(1);
        expect(zto.some((key) => key.includes('save') || key.includes('upload'))).toBe(false);
        expect(ztoState.ztoListSyncResult.failedPages).toEqual([]);
    });

    it('✂️ អក្សរខ្លី (ម្ចាស់គម្រោង ៖ «អក្សរវែងពេក … មិនបាចរាយចិងទៀត») ៖ គ្មានរបាយការណ៍ track · សំណើ · ZTO ឆ្លើយមធ្យម · កញ្ចប់មិនមកដល់', async () => {
        parcels = dataset(150);
        await runZtoListSyncPreview();
        const note = String(viewState.ztoListSyncNote);
        for (const noise of ['track', 'សំណើ', 'ឆ្លើយមធ្យម', 'មិនមានស្កេនមកដល់', 'នៅតាមផ្លូវ', 'ជុំនេះជាការមើលជាមុន', 'ផ្ទៀង ']) expect(note).not.toContain(noise);
        expect(note.length, note).toBeLessThanOrEqual(160);
        expect(note).toContain('⏱ ');
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

    it('⏱ ល្បឿន (ម្ចាស់គម្រោង ៖ Palm ១–២ នាទី · Cookie ប៉ុន្មានវិនាទី) ៖ បញ្ជី ១០០ ក្នុងមួយទំព័រ · track ម្តងមួយ Barcode ស្របគ្នា · ចាប់ផ្ទៀងពេលទំព័រទី ១ មកដល់', async () => {
        parcels = dataset(150);
        slowList.set('list:4:2', 150);
        const total = Object.keys(parcels).length;
        await runZtoListSyncPreview();
        expect([...rowsByCode().keys()].sort()).toEqual(ARRIVED.slice().sort());
        const lists = zto.filter((k) => k.startsWith('list:')).sort();
        expect(lists, 'tab នីមួយៗអានម្តង ១០០ ជួរ · tab ដែលអស់ទំព័រមិនអានស្ទួន').toEqual(['list:1:1', 'list:4:1', 'list:4:2', 'list:4a:1', 'list:4d:1', 'list:5:1']);
        expect(functionCalls, 'សំណើទៅ Function ៖ ទំព័របេក្ខភាព ២ + track ក្រុម ៣០ (+ ចុងបញ្ជីចែកស្មើតាមស្លត)').toBeLessThanOrEqual(2 + Math.ceil(total / 30) + 8);
        expect(Math.max(...trackBatches), 'ក្រុម track ≤ ៣០').toBeLessThanOrEqual(30);
        const tracks = zto.filter((k) => k.startsWith('track:'));
        expect(tracks.filter((k) => k.includes(',')), 'ZTO មិនឆ្លើយ mailNos ច្រើនលេខ ➜ មិនផ្ញើ').toEqual([]);
        expect(tracks.length, 'track ម្តងមួយ Barcode · មិនស្ទួន').toBe(total);
        expect(tracksWhenListDone.get('list:4:2'), 'ផ្ទៀង track ពេលទំព័រទី ២ កំពុងមក (មិនរង់ចាំបញ្ជីគ្រប់ទំព័រ)').toBeGreaterThanOrEqual(60);
        expect(peakTracks, 'track ស្របគ្នា ≥ 16').toBeGreaterThanOrEqual(16);
        expect(peakTracks, 'មានព្រំដែន ៖ ≤ 8 សំណើ × 8').toBeLessThanOrEqual(64);
        expect(viewState.ztoListSyncNote).toMatch(/ · ⏱ \d+\.\d វិ · /);
    });

    it('⏱ ស្របគ្នា 64 (ម្ចាស់គម្រោងជ្រើសក្រោយវាស់ 17.5 វិ) ៖ សំណើ track ទៅ Function ៨ ក្នុងពេលតែមួយ × ៨ ក្នុង Function · មិនលើស', async () => {
        parcels = dataset(400);
        const total = Object.keys(parcels).length;
        await runZtoListSyncPreview();
        expect([...rowsByCode().keys()].sort()).toEqual(ARRIVED.slice().sort());
        expect(ztoState.ztoListSyncResult.unverified).toEqual([]);
        const tracks = zto.filter((k) => k.startsWith('track:'));
        expect(tracks.length, 'track ម្តងមួយ Barcode · មិនស្ទួន').toBe(total);
        expect(peakFunctions, 'សំណើ track ទៅ Function ស្របគ្នា').toBe(8);
        expect(peakTracks, 'track ទៅ ZTO ស្របគ្នាលើស ៣២').toBeGreaterThan(32);
        expect(peakTracks, 'មានព្រំដែន ៖ ≤ 8 សំណើ × 8').toBeLessThanOrEqual(64);
    });

    it('⏱ ចាំចំនួនទំព័រពីការទាញមុន ➜ ស្នើទំព័រ ២.. ជាមួយទំព័រ ១ (មិនរង់ចាំទំព័រ ១) · លទ្ធផលដូចគ្នា', async () => {
        parcels = dataset(400);
        await runZtoListSyncPreview();
        const first = [...rowsByCode().keys()].sort();
        expect(first).toEqual(ARRIVED.slice().sort());
        zto.length = 0;
        slowList.set('list:4:1', 150);
        await runZtoListSyncPreview();
        expect([...rowsByCode().keys()].sort()).toEqual(first);
        const before = listsWhenListDone.get('list:4:1') || [];
        expect(before, 'ទំព័រ ២–៥ នៃ tab «បញ្ជូន» ស្នើមុនទំព័រ ១ ឆ្លើយ').toEqual(expect.arrayContaining(['list:4:2', 'list:4:3', 'list:4:4', 'list:4:5']));
        const lists = zto.filter((k) => k.startsWith('list:'));
        expect(new Set(lists).size, 'ទំព័រនីមួយៗអានម្តង').toBe(lists.length);
        expect(lists.sort()).toEqual(['list:1:1', 'list:4:1', 'list:4:2', 'list:4:3', 'list:4:4', 'list:4:5', 'list:4a:1', 'list:4d:1', 'list:5:1']);
    });

    it('⏱ ការចាំលើស (ZTO មានទំព័រតិចជាងមុន) ➜ ទំព័រទទេពីរបី · បញ្ជីត្រឹមត្រូវ · មិនរាប់ជា «ទាញមិនបាន»', async () => {
        parcels = dataset(400);
        await runZtoListSyncPreview();
        parcels = dataset();
        zto.length = 0;
        await runZtoListSyncPreview();
        expect([...rowsByCode().keys()].sort()).toEqual(ARRIVED.slice().sort());
        expect(ztoState.ztoListSyncResult.failedPages).toEqual([]);
        expect(zto.filter((k) => k.startsWith('list:4:')).length, 'អានលើសត្រឹមចំនួនដែលចាំ').toBeLessThanOrEqual(5);
        zto.length = 0;
        await runZtoListSyncPreview();
        expect(zto.filter((k) => k.startsWith('list:')).sort(), 'ការទាញបន្ទាប់ចាំចំនួនថ្មី').toEqual(['list:1:1', 'list:4:1', 'list:4a:1', 'list:4d:1', 'list:5:1']);
    });

    it.each([0, 950])('⏱ hint ចាស់ 120 ទំព័រ · stock %i ➜ ឈប់ស្នើទំព័រ/tab ដែល Server ថាអស់ ហើយរក្សា track គ្រប់កញ្ចប់', async (bulk) => {
        await runZtoListSyncPreview();
        const key = 'zoew_zto_palm_pages_v1';
        const hint = JSON.parse(String(appLocalStore.getItem(key)));
        hint.pages['4'] = 120; hint.pages['5'] = 120;
        appLocalStore.setItem(key, JSON.stringify(hint));
        parcels = dataset(bulk); zto.length = 0; functionCalls = 0;
        listDelayMs = 20;
        const started = performance.now();
        await runZtoListSyncPreview();
        const ms = performance.now() - started;
        const lists = zto.filter((k) => k.startsWith('list:'));
        const expectedPages = Math.ceil(Object.values(parcels).filter((p) => p.tab === '4').length / 100);
        console.log(JSON.stringify({ probe: 'stale-palm-page-hint', bulk, listCalls: lists.length, functionCalls, elapsedMs: Math.round(ms) }));
        expect([...rowsByCode().keys()].sort()).toEqual(ARRIVED.slice().sort());
        expect(ztoState.ztoListSyncResult.failedPages).toEqual([]);
        expect(ztoState.ztoListSyncResult.unverified).toEqual([]);
        const tracks = zto.filter((k) => k.startsWith('track:')).map((k) => k.slice(6));
        expect(tracks.slice().sort()).toEqual(Object.keys(parcels).sort());
        expect(lists.length, 'ទុកតែ 7 speculative requests ដែលចាប់ផ្តើមរួច និងទំព័រពិតដែលនៅសល់').toBeLessThanOrEqual(5 + 7 * 2 + Math.max(0, expectedPages - 8));
        if (bulk) {
            expect(lists).toContain('list:4:9'); expect(lists).toContain('list:4:10');
            expect(lists).not.toContain('list:5:9'); expect(lists).not.toContain('list:5:10');
        }
    });

    it('⏱ ក្រោយលុប hint លើស · ទំព័រដែលកំពុងអានរាយការណ៍ចំនួនកើនវិញ ➜ អានទំព័រដែលបានដកចេញពីជួររង់ចាំ', async () => {
        await runZtoListSyncPreview();
        const key = 'zoew_zto_palm_pages_v1';
        const hint = JSON.parse(String(appLocalStore.getItem(key)));
        hint.pages['4'] = 120;
        appLocalStore.setItem(key, JSON.stringify(hint));
        parcels = dataset(950); zto.length = 0;
        firstDispatchPages = 2;
        for (let page = 2; page <= 8; page++) slowList.set('list:4:' + page, 50);
        await runZtoListSyncPreview();
        const lists = zto.filter((k) => k.startsWith('list:4:'));
        expect(lists.sort()).toEqual(Array.from({ length: 10 }, (_, i) => 'list:4:' + (i + 1)).sort());
        expect(zto.filter((k) => k.startsWith('track:')).map((k) => k.slice(6)).sort()).toEqual(Object.keys(parcels).sort());
        expect([...rowsByCode().keys()].sort()).toEqual(ARRIVED.slice().sort());
        expect(ztoState.ztoListSyncResult.failedPages).toEqual([]);
        expect(ztoState.ztoListSyncResult.unverified).toEqual([]);
    });

    it('⏱ ការចាំខ្វះ tab (tab «ចុះហត្ថលេខា» មានទំព័រ ២ ថ្មី) ➜ នៅតែអានទំព័រដែលខ្វះ', async () => {
        parcels = dataset(150);
        await runZtoListSyncPreview();
        for (let i = 1; i <= 120; i++) parcels['KH77' + String(i).padStart(8, '0')] = { tab: '5', isSign: 1, scans: [pickup(CN), arrive('04'), sign('05')] };
        zto.length = 0;
        await runZtoListSyncPreview();
        expect(zto.filter((k) => k.startsWith('list:')).sort()).toEqual(['list:1:1', 'list:4:1', 'list:4:2', 'list:4a:1', 'list:4d:1', 'list:5:1', 'list:5:2']);
        expect(rowsByCode().has('KH7700000120')).toBe(true);
        expect(ztoState.ztoListSyncResult.failedPages).toEqual([]);
    });

    it('⏱ ការចាំចងនឹងហាង និងសាខា Palm ៖ សាខាផ្សេង ➜ មិនប្រើ', async () => {
        parcels = dataset(400);
        await runZtoListSyncPreview();
        const cfg = JSON.parse(String(appLocalStore.getItem('zoew_lookup_api_config')));
        appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify({ ...cfg, palmAccount: { siteCode: 'OTHER', siteName: 'x' } }));
        zto.length = 0;
        slowList.set('list:4:1', 100);
        await runZtoListSyncPreview();
        expect(listsWhenListDone.get('list:4:1') || [], 'សាខាផ្សេង ➜ មិនស្នើទំព័រ ២ មុនទំព័រ ១').not.toContain('list:4:2');
    });

    it('⏱ ក្រុម track ≤ ៣០ (ម្ចាស់គម្រោង ៖ ក្រុម ~៥៧ របស់ 2.50.112 «មានអារម្មណ៍ថាយឺតជាងមុន») · បញ្ជីតូច ➜ ចែកស្មើគ្រប់ស្លត', async () => {
        parcels = dataset(400);
        await runZtoListSyncPreview();
        trackBatches = [];
        await runZtoListSyncPreview();
        const total = Object.keys(parcels).length;
        expect(trackBatches.reduce((a, b) => a + b, 0)).toBe(total);
        expect(Math.max(...trackBatches), 'ក្រុម ' + trackBatches.join(',')).toBeLessThanOrEqual(30);
        expect(trackBatches.length, 'វឌ្ឍនភាពឡើងជាជំហានតូចៗ').toBeGreaterThanOrEqual(Math.ceil(total / 30));
        parcels = dataset(40);
        await runZtoListSyncPreview();
        trackBatches = [];
        await runZtoListSyncPreview();
        expect(trackBatches.length, 'កញ្ចប់ ' + Object.keys(parcels).length + ' ➜ ' + trackBatches.join(',')).toBe(8);
        expect(Math.max(...trackBatches) - Math.min(...trackBatches)).toBeLessThanOrEqual(1);
    });

    it('🏢 ឈ្មោះសាខាដូច Cookie ៖ ZTO Login ឆ្លើយ siteName ទទេ ➜ យកពីស្កេនមកដល់សាខាខ្លួន (មិនមែនសាខាដឹកបន្ត) · «ឈ្មោះ · លេខ»', async () => {
        await runZtoListSyncPreview();
        expect(viewState.ztoListSyncSite).toBe(BRANCH_NAME + ' · ' + SITE);
        expect(ztoState.ztoListSyncResult.siteName).toBe(BRANCH_NAME);
        const cfg = JSON.parse(String(appLocalStore.getItem('zoew_lookup_api_config')));
        expect(cfg.palmAccount, 'ស្ថានភាព Login Palm ក៏បង្ហាញឈ្មោះសាខា').toEqual({ siteCode: SITE, siteName: BRANCH_NAME });
        expect(await decryptLookupSecret(cfg.palmTokenEnc), 'session មិនប្រែ').toBeTruthy();
        const named = JSON.stringify({ ...cfg, palmAccount: { siteCode: SITE, siteName: 'ឈ្មោះដែលមានស្រាប់' } });
        appLocalStore.setItem('zoew_lookup_api_config', named);
        await runZtoListSyncPreview();
        expect(appLocalStore.getItem('zoew_lookup_api_config'), 'ឈ្មោះដែលមានស្រាប់មិនត្រូវសរសេរជាន់').toBe(named);
    });
});
