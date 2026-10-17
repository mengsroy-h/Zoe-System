/**
 * ↩️ កញ្ចប់ត្រឡប់ទៅវិញ (សំណើម្ចាស់គម្រោង ៖ «ចង់ឲ្យកញ្ចប់ដែលត្រឡប់ទៅវិញត្រូវលាក់ ឬបង្ហាញសញ្ញាក្នុងបញ្ជី ទាំង Cookie និង palm»)។
 * ភស្តុតាង ៖ សាខាខ្លួនស្កេន «ត្រឡប់ការស្កេន» (Argus `scanTypeCode: "-710"` · payload ពិតដែលម្ចាស់គម្រោងចម្លង) **ក្រោយ** ការមកដល់ចុងក្រោយ ➜
 * ក្រុម «↩️ ត្រឡប់ទៅវិញ» · មិនបញ្ចូល · កញ្ចប់ដែលមានក្នុង ZoeW រួចបង្ហាញសញ្ញា · ZTO បិទរួច (ចុះហត្ថលេខា) ឈ្នះ · ត្រឡប់មុនការមកដល់ថ្មី ➜ មិនមែន។
 * Function ពិត + client ពិត + ZTO ក្លែងដែលឆ្លើយតាម `scanTypeCode`។
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import { dataState, firebaseState, uiState, ztoState } from '../src/core/state';
import { viewState } from '../src/core/view-state';
import { appLocalStore } from '../src/core/storage';
import { clearCustomerDataTableCache } from '../src/features/customer-table';
import { classifyZtoListRows, fetchZtoListAllPages, noteZtoListSignedCodes, renderZtoListSyncPreview } from '../src/features/zto-list-sync';

const req = createRequire(import.meta.url);
const fn = req('../netlify/functions/zto-order-detail.js');
const fx = req('../../audit-tools/idtoken-fixture.js');
const KEY = 'ret-proxy-key';
const DAY = 86400000;
const dk = (back: number) => new Date(Date.now() + 7 * 3600000 - back * DAY).toISOString().slice(0, 10);
const CFG = { enabled: true, fastMode: true, headerName: 'X-Zoe-Proxy-Key', headerValue: KEY,
    url: window.location.origin + '/.netlify/functions/zto-order-detail?barcode={barcode}' };
let rowsUp: any[] = [];
let failType = '';
const upstream: string[] = [];

beforeEach(() => {
    process.env.ZTO_PROXY_KEY = KEY;
    process.env.ZTO_AUTHORIZATION = 'Bearer t';
    process.env.FIREBASE_PROJECT_IDS = fx.TEST_PROJECT;
    delete process.env.ZTO_LIST_RETURN_SCAN_TYPE;
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
    failType = '';
    vi.stubGlobal('fetch', vi.fn(async (u: any, init: any) => {
        const href = String(u);
        if (href.includes(fx.CERTS_HOST)) return new Response(JSON.stringify({ [fx.TEST_KID]: fx.TEST_CERT_PEM }), { status: 200 });
        if (href.startsWith(window.location.origin + '/.netlify/functions/zto-order-detail')) {
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
        if (failType && c.scanTypeCode === failType) return new Response('{}', { status: 500 });
        const all = rowsUp.filter((r) => (r.listed || r.type) === c.scanTypeCode && r.at >= c.scanStartTime && r.at <= c.scanEndTime);
        const res = all.slice((b.pageNum - 1) * b.pageSize, b.pageNum * b.pageSize).map((r) => ({ scanBillCode: r.code,
            consigneeMobile: '855977000111', scanTypeCode: r.type, scanTypeDesc: r.desc, agentAmount: 2, fcAmount: 0, scanTime: r.at,
            scanSite: 'MerSorChrey', isRefund: r.type === '-710' ? 1 : 0 }));
        return new Response(JSON.stringify({ success: true, error: null,
            data: { pageNum: b.pageNum, pages: Math.ceil(all.length / b.pageSize), total: all.length, result: res } }), { status: 200 });
    }));
});

afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.ZTO_LIST_RETURN_SCAN_TYPE;
});

const arrival = (code: string, back: number, hour = '08') => ({ code, type: '03', desc: 'អីវ៉ាន់មកដល់', at: dk(back) + ' ' + hour + ':00:00' });
const sign = (code: string, back: number) => ({ code, type: '05', desc: 'ចុះហត្ថលេខា', at: dk(back) + ' 18:00:00' });
const back = (code: string, back: number, hour = '09') => ({ code, type: '-710', desc: 'ត្រឡប់ការស្កេន', at: dk(back) + ' ' + hour + ':00:00' });
const codesOf = (rows: any[]) => rows.map((row) => row.barcode).sort();
const historyWith = (code: string) => [{ id: 'h1', phone: '0977000111', scanDate: dk(2), createdAt: Date.now() - 2 * DAY,
    barcodes: [{ code, cod: 2, dod: 0, isClosed: false }] }];

describe('↩️ Cookie ៖ កញ្ចប់ដែលសាខាស្កេន «ត្រឡប់» ក្រោយមកដល់', () => {
    it('ក្រុម «↩️ ត្រឡប់ទៅវិញ» · មិនបញ្ចូល · មានក្នុង ZoeW ➜ សញ្ញា · ZTO បិទរួចឈ្នះ · ត្រឡប់មុនមកដល់ថ្មី ➜ ថ្មីធម្មតា', async () => {
        rowsUp = [
            arrival('ZTRET0000001', 2), back('ZTRET0000001', 0),
            arrival('ZTKEEP000001', 2),
            back('ZTAGAIN00001', 3), arrival('ZTAGAIN00001', 2),
            arrival('ZTHAVE000001', 2), back('ZTHAVE000001', 1),
            arrival('ZTSIGN000001', 2), back('ZTSIGN000001', 1), sign('ZTSIGN000001', 0)
        ];
        const out: any = await fetchZtoListAllPages(CFG, dk(3), dk(1));
        expect(out.rows.length, 'លក្ខខណ្ឌចាំបាច់ ៖ ជួរមកដល់ ៥').toBe(5);
        expect(out.returnedState).toBe('ok');
        expect(codesOf(out.returned)).toEqual(['ZTAGAIN00001', 'ZTHAVE000001', 'ZTRET0000001', 'ZTSIGN000001']);
        const retRanges = upstream.filter((c) => c.startsWith('-710 ')).map((c) => c.split(' ').slice(1, 3).join('..'));
        expect(retRanges, 'បញ្ជីត្រឡប់អានពី `from` ដល់ថ្ងៃនេះ (ត្រឡប់កើតក្រោយ `to`)').toEqual([dk(3) + '..' + dk(0)]);
        noteZtoListSignedCodes(out.signed);
        const groups: any = classifyZtoListRows(out.rows, historyWith('ZTHAVE000001'), [], out.signedRows,
            { from: dk(3), to: dk(1), returned: out.returned });
        expect(codesOf(groups.returned)).toEqual(['ZTHAVE000001', 'ZTRET0000001']);
        expect(codesOf(groups.fresh), 'មិនបញ្ចូលកញ្ចប់ត្រឡប់').toEqual(['ZTAGAIN00001', 'ZTKEEP000001', 'ZTSIGN000001']);
        expect(codesOf(groups.existing), 'កញ្ចប់ត្រឡប់ដែលមានក្នុង ZoeW ចេញពីក្រុម «មានរួច» (បិទ ZTO មិនប៉ះ)').toEqual([]);
        const have = groups.returned.find((row: any) => row.barcode === 'ZTHAVE000001');
        const gone = groups.returned.find((row: any) => row.barcode === 'ZTRET0000001');
        expect(have.inZoew).toBe(true);
        expect(gone.inZoew).toBe(false);
        expect(gone.returnedAt).toBe(dk(0) + ' 09:00:00');
        expect(groups.fresh.find((row: any) => row.barcode === 'ZTSIGN000001').closedAtZto, 'ZTO ចុះហត្ថលេខា ➜ «យករួច» ដដែល').toBe(true);
    });

    it('ទំព័របញ្ជីត្រឡប់ ២ ➜ អានគ្រប់ · ZTO បញ្ជីត្រឡប់ធ្លាក់ ➜ ទាញបាន ហើយមិនសម្គាល់ · `off` ➜ មិនសួរ', async () => {
        rowsUp = [arrival('ZTRET0000001', 2)];
        for (let i = 0; i < 120; i++) rowsUp.push(back('ZTX' + String(5000000 + i), 1));
        rowsUp.push(back('ZTRET0000001', 0, '10'));
        const many: any = await fetchZtoListAllPages(CFG, dk(3), dk(1));
        expect(many.returnedState).toBe('ok');
        expect(many.returned.length, 'ទំព័រទី ២ នៃបញ្ជីត្រឡប់ក៏អាន').toBe(121);
        expect(codesOf(classifyZtoListRows(many.rows, [], [], many.signedRows, { from: dk(3), to: dk(1), returned: many.returned }).returned))
            .toEqual(['ZTRET0000001']);

        failType = '-710';
        if (fn.resetCachesForTests) fn.resetCachesForTests();
        const failed: any = await fetchZtoListAllPages(CFG, dk(3), dk(1));
        expect(failed.rows.length, 'បញ្ជីមកដល់នៅតែទាញបាន').toBe(1);
        expect(failed.returnedState).toBe('failed');
        expect(codesOf(classifyZtoListRows(failed.rows, [], [], failed.signedRows, { from: dk(3), to: dk(1), returned: failed.returned }).fresh))
            .toEqual(['ZTRET0000001']);

        failType = '';
        process.env.ZTO_LIST_RETURN_SCAN_TYPE = 'off';
        if (fn.resetCachesForTests) fn.resetCachesForTests();
        upstream.length = 0;
        const off: any = await fetchZtoListAllPages(CFG, dk(3), dk(1));
        expect(off.returnedState).toBe('off');
        expect(upstream.some((c) => c.startsWith('-710 ')), '`off` ➜ គ្មានសំណើ -710').toBe(false);
    });

    it('Function ៖ ជួរក្នុងបញ្ជី -710 ដែលកូដផ្សេង ➜ `otherScans` · រាប់គ្រប់ · ចុងក្រោយក្នុងមួយ Barcode', async () => {
        rowsUp = [back('ZTRET0000001', 1), back('ZTRET0000001', 0, '07'), { ...arrival('ZTODD0000001', 1), listed: '-710' }];
        const h = { 'x-zoe-proxy-key': KEY, 'x-zoe-id-token': fx.tokenForSite('777001') };
        const r = await fn.handler({ httpMethod: 'GET', headers: h,
            queryStringParameters: { list: '1', returned: '1', from: dk(1), to: dk(1), page: '1' } });
        const body = JSON.parse(r.body);
        expect(r.statusCode).toBe(200);
        expect(body.kind).toBe('returned');
        expect(body.returnedOk).toBe(true);
        expect(body.returned).toEqual([{ barcode: 'ZTRET0000001', at: dk(0) + ' 07:00:00' }]);
        expect(body.rows).toEqual([]);
        expect(body.returnedScans + body.otherScans + body.signedScans + body.rows.length, 'រាប់គ្រប់ជួរ upstream').toBe(3);
        expect(body.otherScans).toBe(1);
    });

    it('ប្រអប់ ៖ ក្រុម «↩️ ត្រឡប់ទៅវិញ» ជាមួយម៉ោងត្រឡប់ និង «ដកចេញដូចផុតកំណត់» បើបើកក្នុង ZoeW · អក្សរសង្ខេបរាប់', () => {
        dataState.scanHistory = historyWith('ZTHAVE000001') as any;
        ztoState.ztoListSyncResult = {
            rows: [{ barcode: 'ZTHAVE000001', phone: '0977000111', cod: 2, dod: 0, at: dk(2) + ' 08:00:00', skip: '' },
                { barcode: 'ZTKEEP000001', phone: '0977000111', cod: 2, dod: 0, at: dk(2) + ' 08:00:00', skip: '' }],
            signedRows: [], from: dk(3), to: dk(1), total: 2, returnedState: 'ok',
            returned: [{ barcode: 'ZTHAVE000001', at: dk(1) + ' 09:00:00' }]
        };
        renderZtoListSyncPreview();
        const groups = (ztoState.ztoListPreview as any).groups;
        const ret = groups.find((g: any) => g.tone === 'zto-list-returned');
        expect(ret, 'មានក្រុម «↩️»').toBeTruthy();
        expect(ret.title).toContain('↩️');
        expect(ret.rows.map((r: any) => r.barcode)).toEqual(['ZTHAVE000001']);
        expect(ret.rows[0].notes.join(' ')).toContain(dk(1) + ' 09:00:00');
        expect(ret.rows[0].notes.join(' ')).toContain('ដកចេញដូចផុតកំណត់');
        expect(String(viewState.ztoListSyncNote)).toContain('↩️ ត្រឡប់ទៅវិញ 1');
        expect(String(viewState.ztoListSyncNote)).toContain('🗑️ ដកកញ្ចប់ត្រឡប់ចេញពី ZoeW 1');
    });
});
