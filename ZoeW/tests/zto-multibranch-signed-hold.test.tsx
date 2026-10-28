/**
 * ⛔ ZTO-E14 (A161 · audit ZTO · ម្ចាស់គម្រោងជ្រើស «(ក) កែ Function») ៖ គម្រោង Firebase មួយចងសាខាច្រើន
 *    (`FIREBASE_PROJECT_IDS=zoew-v1:101|102` — `ZTO-SETUP-KH.md` ផ្នែក ៤គ គាំទ្រ) ➜ ប្រវត្តិ **តែមួយ** កាន់កញ្ចប់នៃសាខាទាំង ២។
 *    Function អានបញ្ជី «ចុះហត្ថលេខា» តែ **សាខារបស់គណនី** (`scanSiteCode` = សាខាក្នុង email) ➜ ឧបករណ៍សាខា 101 អានបញ្ជី 101 «ពេញលេញ»
 *    ➜ `ztoAbandonCleanupIsHeld()` លែងរង់ចាំ (ហើយសញ្ញាហាង `completeAt` ក៏ដោះឧបករណ៍ផ្សេងដែរ) ➜ ការសម្អាត ៨ ថ្ងៃដកលុយកញ្ចប់សាខា 102
 *    ដែល ZTO ចុះហត្ថលេខារួច (ជា «ត្រឡប់») ខណៈឧបករណ៍សាខា 102 មិនទាន់អានបញ្ជីរបស់វា។ `/detail` (ទ្វារបម្រុង) ក្រោម
 *    `ZTO_DETAIL_IDENTITY=require` + `ZTO_DETAIL_BRANCH_PATHS` (ការកំណត់ដែលម្ចាស់គម្រោងគ្រោងបើក) ឆ្លើយ `ZTO_OTHER_BRANCH` ➜ គ្មានទ្វារណាបិទវា។
 *    ច្បាប់ (CLAUDE.md «7-day cleanup ↔ ZTO signed list») ៖ «so signed parcels close as pickup instead of expiring (deduct)»។
 *    ឥឡូវ ៖ ការអាន `signed=1&exact=1` (ជុំបិទតាម ZTO) នៃគម្រោងដែលចងសាខាច្រើន អានបញ្ជីចុះហត្ថលេខា **គ្រប់សាខាដែលចង** (barcode តែប៉ុណ្ណោះ ·
 *    ហាងដដែល) ហើយឆ្លើយជោគជ័យតែពេលគ្រប់សាខាឆ្លើយ ➜ «ពេញលេញ» គ្របហាងទាំងមូល · បញ្ជីមកដល់ (`?list=1` ធម្មតា · លេខទូរស័ព្ទ) នៅតែសាខាខ្លួន។
 *    Function ពិត + client ពិត + ZTO ក្លែង (ដូច `zto-pages-unknown.test.tsx`) · ID token ចុះហត្ថលេខាពិត (`audit-tools/idtoken-fixture.js`)។
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import { dataState, firebaseState, securityState, uiState, ztoState } from '../src/core/state';
import { sealLookupHeader } from './helpers/sealed-lookup';
import { appLocalStore } from '../src/core/storage';
import { getZoneDateKey } from '../src/core/timezone';
import { cleanupInFlight, runAutomaticCleanupRules } from '../src/domain/cleanup';
import { clearCustomerDataTableCache } from '../src/features/customer-table';
import { clearZtoPickupStatusStore, runZtoStatusSweep } from '../src/features/zto-status';

const h = vi.hoisted(() => ({ calls: [] as any[] }));
vi.mock('../src/features/barcode-ops', () => ({
    openViewListModal: () => {},
    removeSingleBarcode: async () => 'failed',
    toggleIndividualBarcodeClose: async () => false,
    openEditBarcodePriceModal: () => {},
    closeEditBarcodeModal: () => {},
    saveEditedBarcodePrice: () => {},
    applyBarcodeCloseChange: async (itemId: string, code: string, closed: boolean) => {
        h.calls.push({ itemId, code, closed });
        const item = dataState.scanHistory.find((i: any) => i && i.id === itemId);
        const b = item && item.barcodes.find((x: any) => x.code === code);
        if (b) {
            b.isClosed = closed;
            b.closedAt = Date.now();
            item.isClosed = item.barcodes.every((x: any) => x.isClosed);
            if (item.isClosed) item.closedAt = Date.now();
        }
        return true;
    }
}));

const req = createRequire(import.meta.url);
const fn = req('../netlify/functions/_shared/zto-order-detail-core.cjs');
const fx = req('../../audit-tools/idtoken-fixture.js');
const KEY = 'e14-proxy-key-0123456789';
const NOW = Date.UTC(2026, 9, 6, 3, 0, 0);
const DAY = 86400000;
const BASE_CFG = { enabled: true, fastMode: true, headerName: 'X-Zoe-Proxy-Key',
    url: window.location.origin + '/.netlify/functions/zto-order-detail?barcode={barcode}' };
let CFG: any = BASE_CFG;
const dk = (back: number) => new Date(NOW + 7 * 3600000 - back * DAY).toISOString().slice(0, 10);

let signs: Array<{ code: string; site: string; at: string }> = [];
let detailBranch: Record<string, string> = {};
let tx: string[] = [];
let failSite = '';
const listSites: string[] = [];

function openItem(id: string, code: string, ageMs: number) {
    return { id, phone: '0960007345', scanDate: getZoneDateKey(NOW - ageMs, 0), isClosed: false, createdAt: NOW - ageMs,
        cod: 3, dod: 0, count: 1, barcode: code, barcodes: [{ code, isClosed: false, cod: 3, dod: 0 }] };
}

function cleanupNow() {
    cleanupInFlight.clear();
    runAutomaticCleanupRules();
}

const abandoned = (id: string) => tx.includes('zoew_scan_history_cod_dod/' + id);

function setup(projectIds: string, site: string) {
    process.env.FIREBASE_PROJECT_IDS = projectIds;
    const token = fx.tokenForSite(site);
    firebaseState.fb = {
        ref: (_db: unknown, path: string) => ({ path }),
        runTransaction: (ref: { path: string }) => {
            tx.push(ref.path);
            return Promise.reject(Object.assign(new Error('audit: not applied'), { txOutcome: 'not-applied' }));
        },
        getIdTokenResult: async () => ({ token })
    } as any;
}

beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(NOW));
    process.env.ZTO_PROXY_KEY = KEY;
    process.env.ZTO_AUTHORIZATION = 'Bearer t';
    process.env.ZTO_DETAIL_IDENTITY = 'require';
    process.env.ZTO_DETAIL_BRANCH_PATHS = 'siteCode';
    process.env.ZTO_FIELD_SIGNED = 'billStatus';
    process.env.ZTO_SIGNED_VALUES = '5';
    if (fn.resetCachesForTests) fn.resetCachesForTests();
    appLocalStore.clear();
    CFG = await sealLookupHeader(BASE_CFG, KEY);
    appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify(CFG));
    clearCustomerDataTableCache();
    clearZtoPickupStatusStore();
    h.calls.length = 0;
    tx = [];
    listSites.length = 0;
    signs = [];
    detailBranch = {};
    failSite = '';
    ztoState.ztoSignedCompleteAt = 0;
    ztoState.ztoSignedCompleteServerAt = 0;
    ztoState.ztoSignedSweepAt = 0;
    ztoState.ztoSignedSweepOkAt = 0;
    ztoState.ztoSignedSweepWaitMs = 0;
    ztoState.ztoSignedOff = false;
    ztoState.ztoAbandonHoldSince = 0;
    ztoState.ztoAbandonCheckedAt = 0;
    ztoState.ztoStatusLastSweepAt = 0;
    cleanupInFlight.clear();
    ztoState.ztoStatusInFlight = false;
    dataState.scanHistory = [];
    dataState.deletedItems = [];
    uiState.isModalOpen = false;
    uiState.toasts = [];
    firebaseState.authGeneration++;
    firebaseState.serverTimeOffsetMs = 0;
    firebaseState.serverClockTrusted = true;
    firebaseState.isDatabaseConnected = true;
    firebaseState.auth = { currentUser: { uid: 'audit-user' } } as any;
    firebaseState.db = { name: 'audit-db' } as any;
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn(async (u: any, init: any) => {
        const href = String(u);
        if (href.includes(fx.CERTS_HOST)) return new Response(JSON.stringify({ [fx.TEST_KID]: fx.TEST_CERT_PEM }), { status: 200 });
        if (href.startsWith(window.location.origin + '/.netlify/functions/zto-order-detail')) {
            const q: any = {};
            new URL(href).searchParams.forEach((v, k) => { q[k] = v; });
            const hd: any = {};
            Object.entries((init && init.headers) || {}).forEach(([k, v]) => { hd[k.toLowerCase()] = String(v); });
            const r = await fn.handler({ httpMethod: 'GET', headers: hd, queryStringParameters: q });
            return new Response(r.body, { status: r.statusCode });
        }
        const b = JSON.parse(String(init.body));
        if (href.includes('/scan/get/order/detail')) {
            const code = String(b.billCode);
            if (!detailBranch[code]) return new Response(JSON.stringify({ success: true, data: null }), { status: 200 });
            const signed = signs.some((s) => s.code === code);
            return new Response(JSON.stringify({ success: true, data: { billCode: code, consigneeMobile: '855977000111', agentAmount: 3,
                fcAmount: 0, siteCode: detailBranch[code], billStatus: signed ? 5 : 1 } }), { status: 200 });
        }
        const c = b.condition;
        listSites.push(c.scanSiteCode + ':' + c.scanTypeCode);
        if (failSite && c.scanSiteCode === failSite) return new Response('{}', { status: 503 });
        const rows = c.scanTypeCode === '05'
            ? signs.filter((s) => s.site === c.scanSiteCode && s.at >= c.scanStartTime && s.at <= c.scanEndTime)
                .map((s) => ({ scanBillCode: s.code, scanTypeCode: '05', scanTypeDesc: 'ចុះហត្ថលេខា', scanTime: s.at, scanSite: 'S' + s.site }))
            : [];
        return new Response(JSON.stringify({ success: true, data: { pageNum: b.pageNum, pages: 1, total: rows.length, result: rows } }), { status: 200 });
    }));
});

afterEach(() => {
    securityState.lookupSecretKey = null;
    vi.useRealTimers();
    vi.unstubAllGlobals();
    appLocalStore.clear();
    for (const k of ['ZTO_DETAIL_IDENTITY', 'ZTO_DETAIL_BRANCH_PATHS', 'ZTO_FIELD_SIGNED', 'ZTO_SIGNED_VALUES']) delete process.env[k];
    firebaseState.db = null as any;
    firebaseState.fb = null as any;
    firebaseState.serverClockTrusted = false;
    firebaseState.isDatabaseConnected = false;
});

describe('ZTO-E14 ៖ គម្រោងតែមួយ សាខាច្រើន ៖ ការអានបញ្ជីចុះហត្ថលេខារបស់សាខាមួយ ≠ ពេញលេញទូទាំងហាង', () => {
    it('⛔ ឧបករណ៍សាខា 101 អានបញ្ជី 101 ➜ កញ្ចប់សាខា 102 ដែល ZTO ចុះហត្ថលេខារួច មិនត្រូវដកលុយជា «ត្រឡប់»', async () => {
        setup(fx.TEST_PROJECT + ':101|102', '101');
        dataState.scanHistory = [openItem('p102', 'ZTM1020001', 8 * DAY)];
        signs = [{ code: 'ZTM1020001', site: '102', at: dk(3) + ' 18:00:00' }];
        detailBranch = { ZTM1020001: '102' };
        cleanupNow();
        expect(abandoned('p102'), 'មុនអានបញ្ជី ➜ រង់ចាំ').toBe(false);
        await runZtoStatusSweep(false);
        expect(listSites.filter((s) => s.endsWith(':05')).sort(), 'Function អានបញ្ជីចុះហត្ថលេខាគ្រប់សាខាដែលចង').toEqual(['101:05', '102:05']);
        expect(listSites.filter((s) => !s.endsWith(':05')).sort(), 'បញ្ជីត្រឡប់ (-710) និងបញ្ជូនចេញ (02) អានតែសាខាខ្លួន · គ្មានបញ្ជូនចេញ ➜ មិនអានស្កេនបញ្ហា (30)').toEqual(['101:-710', '101:02'].sort());
        expect(h.calls.map((c) => c.code), 'កញ្ចប់សាខា 102 ក្នុងបញ្ជីចុះហត្ថលេខា ➜ បិទ «យករួច»').toEqual(['ZTM1020001']);
        cleanupNow();
        expect(abandoned('p102'), 'កញ្ចប់ចុះហត្ថលេខានៅសាខា 102 ➜ មិនត្រូវ abandon (ដកលុយ)').toBe(false);
    });

    it('⛔ សាខាមួយអានមិនបាន (ZTO 503) ➜ មិនពេញលេញ ➜ នៅរង់ចាំ (មិនដកលុយ) · គ្មានការបិទពាក់កណ្តាលដែលរាយថាពេញលេញ', async () => {
        setup(fx.TEST_PROJECT + ':101|102', '101');
        dataState.scanHistory = [openItem('f102', 'ZTM1020002', 8 * DAY)];
        signs = [{ code: 'ZTM1020002', site: '102', at: dk(3) + ' 18:00:00' }];
        detailBranch = { ZTM1020002: '102' };
        failSite = '102';
        await runZtoStatusSweep(false);
        cleanupNow();
        expect(abandoned('f102'), 'បញ្ជីសាខា 102 មិនបានវាស់ ➜ ការរង់ចាំនៅដដែល').toBe(false);
        expect(ztoState.ztoSignedCompleteAt, 'មិនត្រូវកត់ «ពេញលេញ»').toBe(0);
    });

    it('ទិសផ្ទុយ ៖ គម្រោងសាខាច្រើន · កញ្ចប់មិនចុះហត្ថលេខានៅសាខាណាទាំងអស់ ➜ «ត្រឡប់» ធម្មតា (ការរង់ចាំមិនជាប់)', async () => {
        setup(fx.TEST_PROJECT + ':101|102', '101');
        dataState.scanHistory = [openItem('n102', 'ZTM1020003', 8 * DAY)];
        detailBranch = { ZTM1020003: '102' };
        await runZtoStatusSweep(false);
        cleanupNow();
        expect(abandoned('n102')).toBe(true);
    });

    it('ទិសផ្ទុយ ៖ បញ្ជីមកដល់ (លេខទូរស័ព្ទ · ផ្ទាំង «ទាញបញ្ជី») នៅតែសាខាគណនី', async () => {
        setup(fx.TEST_PROJECT + ':101|102', '101');
        const token = fx.tokenForSite('101');
        const r = await fn.handler({ httpMethod: 'GET', headers: { 'x-zoe-proxy-key': KEY, 'x-zoe-id-token': token },
            queryStringParameters: { list: '1', from: dk(1), to: dk(0), page: '1', withSigned: '1' } });
        expect(r.statusCode).toBe(200);
        expect(listSites.slice().sort()).toEqual(['101:03', '101:05']);
    });

    it('ទិសផ្ទុយ ៖ គម្រោងសាខាតែមួយ ➜ កញ្ចប់ចុះហត្ថលេខា ➜ បិទ «យករួច» · កញ្ចប់មិនចុះហត្ថលេខា ➜ «ត្រឡប់» ធម្មតា', async () => {
        setup(fx.TEST_PROJECT + ':101', '101');
        dataState.scanHistory = [openItem('s1', 'ZTM1010001', 8 * DAY), openItem('s2', 'ZTM1010002', 8 * DAY)];
        signs = [{ code: 'ZTM1010001', site: '101', at: dk(3) + ' 18:00:00' }];
        detailBranch = { ZTM1010001: '101', ZTM1010002: '101' };
        cleanupNow();
        await runZtoStatusSweep(false);
        expect(h.calls.map((c) => c.code)).toEqual(['ZTM1010001']);
        cleanupNow();
        expect(abandoned('s1')).toBe(false);
        expect(abandoned('s2'), 'ការរង់ចាំមិនជាប់ ➜ «ត្រឡប់» ធម្មតា').toBe(true);
    });

    it('ទិសផ្ទុយ ៖ គម្រោងសាខាច្រើន · កញ្ចប់សាខាខ្លួនឯងចុះហត្ថលេខា ➜ បិទ «យករួច»', async () => {
        setup(fx.TEST_PROJECT + ':101|102', '101');
        dataState.scanHistory = [openItem('o1', 'ZTM1010003', 8 * DAY)];
        signs = [{ code: 'ZTM1010003', site: '101', at: dk(2) + ' 18:00:00' }];
        detailBranch = { ZTM1010003: '101' };
        await runZtoStatusSweep(false);
        cleanupNow();
        expect(h.calls.map((c) => c.code)).toEqual(['ZTM1010003']);
        expect(abandoned('o1')).toBe(false);
    });
});
