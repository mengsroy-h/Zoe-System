/**
 * ⛔ ZTO-F1 (ការផ្ទៀងផ្ទាត់ឡើងវិញ) ៖ ប្រអប់បញ្ជី ZTO ពេល «ដល់ថ្ងៃ» < ថ្ងៃនេះ។ ទំព័រ ១ (`withSigned=1`) អានបញ្ជី «ចុះហត្ថលេខា» ពី `from` ដល់ **ថ្ងៃនេះ**
 * (`listSignedRange()`) ហើយរាយ `signedPages` ➜ ទំព័រ «ចុះហត្ថលេខា» បន្ថែម (`signed=1`) ត្រូវអាន **បញ្ជីដដែល** (ជួរដដែល)។ មុនកែ ៖ E3 ប្តូរ `signed=1`
 * ឲ្យគោរពជួរដែលសុំ ➜ ទំព័រ ២–៣ អានបញ្ជីផ្សេង (`from..to`) ➜ ភស្តុតាងដែលក្រោយ `to` បាត់ស្ងាត់ (`signedState: 'ok'`) ➜ កញ្ចប់ដែលយករួចចូលជា «មិនទាន់យក»។
 * ការអានតាមថ្ងៃរបស់ E3 (`fetchZtoSignedPages`) សុំជួរពិតតាម `exact=1`។ Function ពិត + client ពិត + ZTO ក្លែងដែលបែងចែកទំព័រតាម `scanStartTime..scanEndTime`។
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import { dataState, firebaseState, uiState, ztoState } from '../src/core/state';
import { appLocalStore } from '../src/core/storage';
import { clearCustomerDataTableCache } from '../src/features/customer-table';
import { classifyZtoListRows, fetchZtoListAllPages, fetchZtoSignedCodes, noteZtoListSignedCodes, resolveZtoListSignedVerdicts } from '../src/features/zto-list-sync';

const req = createRequire(import.meta.url);
const fn = req('../netlify/functions/zto-order-detail.js');
const fx = req('../../audit-tools/idtoken-fixture.js');
const KEY = 'f1-proxy-key';
const DAY = 86400000;
const dk = (back: number) => new Date(Date.now() + 7 * 3600000 - back * DAY).toISOString().slice(0, 10);
const CFG = { enabled: true, fastMode: true, headerName: 'X-Zoe-Proxy-Key', headerValue: KEY,
    url: 'https://fn.invalid/.netlify/functions/zto-order-detail?barcode={barcode}' };
let rowsUp: any[] = [];
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
        upstream.push([c.scanTypeCode, c.scanStartTime.slice(0, 10), c.scanEndTime.slice(0, 10), b.pageNum].join(' '));
        const all = rowsUp.filter((r) => r.type === c.scanTypeCode && r.at >= c.scanStartTime && r.at <= c.scanEndTime);
        const res = all.slice((b.pageNum - 1) * b.pageSize, b.pageNum * b.pageSize).map((r) => ({ scanBillCode: r.code,
            consigneeMobile: '855977000111', scanTypeCode: r.type, scanTypeDesc: r.desc, agentAmount: 2, fcAmount: 0, scanTime: r.at, scanSite: 'S' }));
        return new Response(JSON.stringify({ success: true, error: null,
            data: { pageNum: b.pageNum, pages: Math.ceil(all.length / b.pageSize), total: all.length, result: res } }), { status: 200 });
    }));
});

afterEach(() => vi.unstubAllGlobals());

const arrival = (code: string, back: number) => ({ code, type: '03', desc: 'អីវ៉ាន់មកដល់', at: dk(back) + ' 08:00:00' });
const sign = (code: string, back: number, hour = '18') => ({ code, type: '05', desc: 'ចុះហត្ថលេខា', at: dk(back) + ' ' + hour + ':00:00' });
const rangesOf = (type: string) => upstream.filter((c) => c.startsWith(type + ' ')).map((c) => c.split(' ').slice(1, 3).join('..'));

describe('ZTO-F1 ៖ ប្រអប់បញ្ជី «ដល់ថ្ងៃ» < ថ្ងៃនេះ មិនបាត់ភស្តុតាងចុះហត្ថលេខា', () => {
    it('បញ្ជី 05 វែងជាងបញ្ជីមកដល់ ➜ ទំព័រ 05 ទាំងអស់អានជួរដដែលនឹង companion · X (ចុះហត្ថលេខាក្រោយ `to`) ឃើញ ➜ កើតមកជា «យករួច»', async () => {
        rowsUp = [];
        for (let i = 0; i < 150; i++) rowsUp.push(arrival('ZTA' + String(1000000 + i), 4));
        for (let i = 0; i < 230; i++) rowsUp.push(sign('ZTQ' + String(2000000 + i), 4));
        for (let i = 0; i < 60; i++) rowsUp.push(sign('ZTR' + String(3000000 + i), 1, '10'));
        rowsUp.push(sign('ZTA1000149', 1, '11'));
        const out: any = await fetchZtoListAllPages(CFG, dk(5), dk(3));
        expect(out.rows.length, 'លក្ខខណ្ឌចាំបាច់ ៖ បញ្ជីមកដល់ ២ ទំព័រ').toBe(150);
        const signedRanges = rangesOf('05');
        expect(signedRanges.length, 'លក្ខខណ្ឌចាំបាច់ ៖ បញ្ជី 05 ៣ ទំព័រ (ច្រើនជាងទំព័រមកដល់)').toBe(3);
        expect(new Set(signedRanges), '⛔ ទំព័រ 05 ទាំងអស់ក្នុងការទាញមួយអានជួរដដែល (ដល់ថ្ងៃនេះ)').toEqual(new Set([dk(5) + '..' + dk(0)]));
        expect(out.signedState).toBe('ok');
        expect(out.signed.length).toBe(291);
        expect(out.signed).toContain('ZTA1000149');
        noteZtoListSignedCodes(out.signed);
        await resolveZtoListSignedVerdicts(CFG, out.rows);
        const groups: any = classifyZtoListRows(out.rows, [], []);
        const x = groups.fresh.find((r: any) => r.barcode === 'ZTA1000149');
        expect(x && x.closedAtZto, '⛔ X ចូលជា «យករួច»').toBe(true);
    });

    it('ទិសផ្ទុយ (E3) ៖ ការអានតាមថ្ងៃរបស់ជុំបិទតាម ZTO សុំជួរពិត (`exact=1`) ➜ ថ្ងៃនីមួយៗអានតែថ្ងៃនោះ · គ្រប់ភស្តុតាង', async () => {
        rowsUp = [];
        for (let back = 3; back >= 0; back--) {
            for (let i = 0; i < 95; i++) rowsUp.push(sign('ZTD' + back + String(100000 + i), back));
        }
        const got: any = await fetchZtoSignedCodes(CFG, dk(3), dk(0));
        expect(got && got.measured).toBe(true);
        expect(got.truncated).toBe(false);
        expect(new Set(got.codes).size).toBe(380);
        const ranges = rangesOf('05');
        for (let back = 3; back >= 0; back--) {
            expect(ranges, 'ថ្ងៃ ' + dk(back) + ' អានតែថ្ងៃនោះ').toContain(dk(back) + '..' + dk(back));
        }
        expect(ranges.filter((r) => r !== dk(3) + '..' + dk(0)).every((r) => r.split('..')[0] === r.split('..')[1]),
            'ការអានតាមថ្ងៃមិនពង្រីកដល់ថ្ងៃនេះ').toBe(true);
    });
});
