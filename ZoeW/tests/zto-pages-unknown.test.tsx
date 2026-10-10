/**
 * ⛔ ZTO-E13 (សំណើម្ចាស់គម្រោង ៖ «ZTO កែចុះ») ៖ ZTO ឆ្លើយបញ្ជីដោយ **គ្មាន** `meta.pages`/`total` ៖ Function ធ្លាប់រាយ `pages: 1` ទោះទំព័រពេញ
 * (១០០ ជួរ) ➜ client អានតែទំព័រ ១ ហើយចាត់ទុកថា «ពេញលេញ» ➜ ភស្តុតាងចុះហត្ថលេខានៅទំព័រ ២+ បាត់ ➜ ការសម្អាត ៨ ថ្ងៃលែងរង់ចាំ ➜ កញ្ចប់ដែលយករួចអាច
 * ត្រូវកាត់ប្រាក់ជា «ផុតកំណត់»។ ឥឡូវ ទំព័រពេញ + គ្មាន `pages` = «មិនដឹង» (`pagesUnknown`) ➜ client អានបន្តដល់ពិដាន ហើយនៅតែ «មិនដឹង» ➜ `truncated`។
 * Function ពិត + client ពិត + ZTO ក្លែង (ដូច `zto-signed-past-range.test.tsx`)។
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import { dataState, firebaseState, uiState, ztoState } from '../src/core/state';
import { appLocalStore } from '../src/core/storage';
import { clearCustomerDataTableCache } from '../src/features/customer-table';
import { fetchZtoListAllPages, fetchZtoSignedCodes } from '../src/features/zto-list-sync';

const req = createRequire(import.meta.url);
const fn = req('../netlify/functions/zto-order-detail.js');
const fx = req('../../audit-tools/idtoken-fixture.js');
const KEY = 'e10-proxy-key';
const DAY = 86400000;
const dk = (back: number) => new Date(Date.now() + 7 * 3600000 - back * DAY).toISOString().slice(0, 10);
const CFG = { enabled: true, fastMode: true, headerName: 'X-Zoe-Proxy-Key', headerValue: KEY,
    url: 'https://fn.invalid/.netlify/functions/zto-order-detail?barcode={barcode}' };
let rowsUp: any[] = [];
let withMeta = false;
const upstream: string[] = [];

beforeEach(() => {
    process.env.ZTO_PROXY_KEY = KEY;
    process.env.ZTO_AUTHORIZATION = 'Bearer t';
    process.env.FIREBASE_PROJECT_IDS = fx.TEST_PROJECT;
    if (fn.resetCachesForTests) fn.resetCachesForTests();
    appLocalStore.clear();
    appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify(CFG));
    clearCustomerDataTableCache();
    dataState.scanHistory = [];
    dataState.deletedItems = [];
    uiState.isModalOpen = false;
    ztoState.ztoStatusInFlight = false;
    firebaseState.authGeneration++;
    firebaseState.auth = { currentUser: { uid: 'u' } } as any;
    const token = fx.tokenForSite('777001');
    firebaseState.fb = { getIdTokenResult: async () => ({ token }) } as any;
    upstream.length = 0;
    withMeta = false;
    vi.stubGlobal('fetch', vi.fn(async (u: any, init: any) => {
        const href = String(u);
        if (href.includes(fx.CERTS_HOST)) return new Response(JSON.stringify({ [fx.TEST_KID]: fx.TEST_CERT_PEM }), { status: 200 });
        if (href.includes('fn.invalid')) {
            const q: any = {};
            new URL(href).searchParams.forEach((v, k) => { q[k] = v; });
            const h: any = {};
            Object.entries((init && init.headers) || {}).forEach(([k, v]) => { h[k.toLowerCase()] = String(v); });
            const r = await fn.handler({ httpMethod: 'GET', headers: h, queryStringParameters: q });
            return new Response(r.body, { status: r.statusCode });
        }
        const b = JSON.parse(String(init.body));
        const c = b.condition;
        upstream.push([c.scanTypeCode, b.pageNum].join(' '));
        const all = rowsUp.filter((r) => r.type === c.scanTypeCode && r.at >= c.scanStartTime && r.at <= c.scanEndTime);
        const res = all.slice((b.pageNum - 1) * b.pageSize, b.pageNum * b.pageSize).map((r) => ({ scanBillCode: r.code,
            consigneeMobile: '855977000111', scanTypeCode: r.type, scanTypeDesc: r.desc, agentAmount: 2, fcAmount: 0, scanTime: r.at, scanSite: 'S' }));
        const data: any = { pageNum: b.pageNum, result: res };
        if (withMeta) { data.pages = Math.ceil(all.length / b.pageSize); data.total = all.length; }
        return new Response(JSON.stringify({ success: true, error: null, data }), { status: 200 });
    }));
});

afterEach(() => vi.unstubAllGlobals());

const arrival = (code: string, back: number) => ({ code, type: '03', desc: 'អីវ៉ាន់មកដល់', at: dk(back) + ' 08:00:00' });
const sign = (code: string, back: number) => ({ code, type: '05', desc: 'ចុះហត្ថលេខា', at: dk(back) + ' 18:00:00' });

describe('ZTO-E13 ៖ ZTO គ្មាន `meta.pages`', () => {
    it('⛔ ការអានចុះហត្ថលេខា (ជុំបិទតាម ZTO) ៖ ២៥០ ជួរក្នុងថ្ងៃមួយ ➜ ឃើញទាំង ២៥០ (មិនមែន «ពេញលេញ» ១០០)', async () => {
        rowsUp = [];
        for (let i = 0; i < 250; i++) rowsUp.push(sign('ZTS' + String(1000000 + i), 1));
        const got: any = await fetchZtoSignedCodes(CFG, dk(1), dk(1));
        expect(got && got.measured).toBe(true);
        expect(new Set(got.codes).size).toBe(250);
        expect(got.truncated).toBe(false);
    });

    it('⛔ លើសពិដានទំព័រ (៣៥០ ជួរ · ពិដាន ៣ ទំព័រ) ➜ `truncated` (មិនដែល «ពេញលេញ»)', async () => {
        rowsUp = [];
        for (let i = 0; i < 350; i++) rowsUp.push(sign('ZTT' + String(1000000 + i), 1));
        const got: any = await fetchZtoSignedCodes(CFG, dk(1), dk(1));
        expect(got && got.measured).toBe(true);
        expect(got.truncated).toBe(true);
    });

    it('ទិសផ្ទុយ ៖ ៦០ ជួរ (ទំព័រមិនពេញ) ➜ ពេញលេញ ៦០ · ការហៅ ZTO ១ ដង', async () => {
        rowsUp = [];
        for (let i = 0; i < 60; i++) rowsUp.push(sign('ZTU' + String(1000000 + i), 1));
        const got: any = await fetchZtoSignedCodes(CFG, dk(1), dk(1));
        expect(got.truncated).toBe(false);
        expect(new Set(got.codes).size).toBe(60);
        expect(upstream.filter((c) => c.startsWith('05 ')).length).toBe(1);
    });

    it('ទិសផ្ទុយ ៖ ZTO មាន `meta.pages` ➜ ឥរិយាបថដើម (២៥០ ជួរ · ៣ ទំព័រ)', async () => {
        withMeta = true;
        rowsUp = [];
        for (let i = 0; i < 250; i++) rowsUp.push(sign('ZTV' + String(1000000 + i), 1));
        const got: any = await fetchZtoSignedCodes(CFG, dk(1), dk(1));
        expect(got.truncated).toBe(false);
        expect(new Set(got.codes).size).toBe(250);
    });

    it('⛔ ប្រអប់បញ្ជី ៖ មកដល់ ២៥០ ជួរ ➜ ទាញបានទាំង ២៥០', async () => {
        rowsUp = [];
        for (let i = 0; i < 250; i++) rowsUp.push(arrival('ZTA' + String(1000000 + i), 2));
        const out: any = await fetchZtoListAllPages(CFG, dk(3), dk(2));
        expect(out.rows.length).toBe(250);
        expect(out.pages).toBeLessThanOrEqual(3);
        expect(out.total).toBe(250);
    });

    it('⛔ ប្រអប់បញ្ជី ៖ មកដល់ ៣៥០ ជួរ (លើសពិដាន) ➜ `pages` លើសពិដាន ➜ `truncated` («បញ្ជីវែងជាង ៣ ទំព័រ»)', async () => {
        rowsUp = [];
        for (let i = 0; i < 350; i++) rowsUp.push(arrival('ZTB' + String(1000000 + i), 2));
        const out: any = await fetchZtoListAllPages(CFG, dk(3), dk(2));
        expect(out.rows.length).toBe(300);
        expect(out.pages).toBeGreaterThan(3);
    });

    it('⛔ ប្រអប់បញ្ជី ៖ ភស្តុតាងចុះហត្ថលេខា (companion) ២៥០ ជួរ ➜ ឃើញទាំង ២៥០ · `ok`', async () => {
        rowsUp = [];
        for (let i = 0; i < 40; i++) rowsUp.push(arrival('ZTC' + String(1000000 + i), 2));
        for (let i = 0; i < 250; i++) rowsUp.push(sign('ZTD' + String(1000000 + i), 1));
        const out: any = await fetchZtoListAllPages(CFG, dk(3), dk(1));
        expect(out.rows.length).toBe(40);
        expect(new Set(out.signed).size).toBe(250);
        expect(out.signedState).toBe('ok');
    });

    it('⛔ ប្រអប់បញ្ជី ៖ ភស្តុតាងចុះហត្ថលេខា ៣៥០ ជួរ (លើសពិដាន) ➜ `partial` (មិនមែន `ok`)', async () => {
        rowsUp = [];
        for (let i = 0; i < 40; i++) rowsUp.push(arrival('ZTE' + String(1000000 + i), 2));
        for (let i = 0; i < 350; i++) rowsUp.push(sign('ZTF' + String(1000000 + i), 1));
        const out: any = await fetchZtoListAllPages(CFG, dk(3), dk(1));
        expect(new Set(out.signed).size).toBe(300);
        expect(out.signedState).toBe('partial');
    });

    it('ទិសផ្ទុយ ៖ ZTO មាន `meta.pages` ➜ ប្រអប់បញ្ជីអានដូចដើម (ការហៅ ZTO ដដែល)', async () => {
        withMeta = true;
        rowsUp = [];
        for (let i = 0; i < 250; i++) rowsUp.push(arrival('ZTG' + String(1000000 + i), 2));
        for (let i = 0; i < 150; i++) rowsUp.push(sign('ZTH' + String(1000000 + i), 1));
        const out: any = await fetchZtoListAllPages(CFG, dk(3), dk(1));
        expect(out.rows.length).toBe(250);
        expect(new Set(out.signed).size).toBe(150);
        expect(out.signedState).toBe('ok');
        expect(upstream.filter((c) => c.startsWith('03 ')).sort()).toEqual(['03 1', '03 2', '03 3']);
        expect(upstream.filter((c) => c.startsWith('05 ')).sort()).toEqual(['05 1', '05 2']);
    });
});
