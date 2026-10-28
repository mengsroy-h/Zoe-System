/**
 * ↩️ កញ្ចប់ត្រឡប់ទៅវិញ (សំណើម្ចាស់គម្រោង ៖ «ចង់ឲ្យកញ្ចប់ដែលត្រឡប់ទៅវិញត្រូវលាក់ ឬបង្ហាញសញ្ញាក្នុងបញ្ជី ទាំង Cookie និង palm»)។
 * ភស្តុតាង ៖ សាខាខ្លួនស្កេន «ត្រឡប់ការស្កេន» (Argus `scanTypeCode: "-710"` · payload ពិតដែលម្ចាស់គម្រោងចម្លង) **ក្រោយ** ការមកដល់ចុងក្រោយ ➜
 * ក្រុម «↩️ ត្រឡប់ទៅវិញ» · មិនបញ្ចូល · កញ្ចប់ដែលមានក្នុង ZoeW រួចបង្ហាញសញ្ញា · ZTO បិទរួច (ចុះហត្ថលេខា) ឈ្នះ · ត្រឡប់មុនការមកដល់ថ្មី ➜ មិនមែន។
 * Function ពិត + client ពិត + ZTO ក្លែងដែលឆ្លើយតាម `scanTypeCode`។
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import { dataState, firebaseState, securityState, uiState, ztoState } from '../src/core/state';
import { sealLookupHeader } from './helpers/sealed-lookup';
import { viewState } from '../src/core/view-state';
import { appLocalStore } from '../src/core/storage';
import { clearCustomerDataTableCache } from '../src/features/customer-table';
import { classifyZtoListRows, fetchZtoListAllPages, noteZtoListSignedCodes, renderZtoListSyncPreview } from '../src/features/zto-list-sync';
import { ztoReturnedKindOf } from '../src/features/zto-returned';

const req = createRequire(import.meta.url);
const fn = req('../netlify/functions/_shared/zto-order-detail-core.cjs');
const fx = req('../../audit-tools/idtoken-fixture.js');
const KEY = 'ret-proxy-key';
const DAY = 86400000;
const dk = (back: number) => new Date(Date.now() + 7 * 3600000 - back * DAY).toISOString().slice(0, 10);
const BASE_CFG = { enabled: true, fastMode: true, headerName: 'X-Zoe-Proxy-Key',
    url: window.location.origin + '/.netlify/functions/zto-order-detail?barcode={barcode}' };
let CFG: any = BASE_CFG;
let rowsUp: any[] = [];
let failType = '';
const upstream: string[] = [];

beforeEach(async () => {
    process.env.ZTO_PROXY_KEY = KEY;
    process.env.ZTO_AUTHORIZATION = 'Bearer t';
    process.env.FIREBASE_PROJECT_IDS = fx.TEST_PROJECT;
    delete process.env.ZTO_LIST_RETURN_SCAN_TYPE;
    delete process.env.ZTO_LIST_SEND_SCAN_TYPE;
    delete process.env.ZTO_LIST_PROBLEM_SCAN_TYPE;
    delete process.env.ZTO_LIST_MISPLACED_REASONS;
    if (fn.resetCachesForTests) fn.resetCachesForTests();
    appLocalStore.clear();
    CFG = await sealLookupHeader(BASE_CFG, KEY);
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
            scanSite: 'MerSorChrey', isRefund: r.type === '-710' ? 1 : 0, ...(r.raw || {}) }));
        return new Response(JSON.stringify({ success: true, error: null,
            data: { pageNum: b.pageNum, pages: Math.ceil(all.length / b.pageSize), total: all.length, result: res } }), { status: 200 });
    }));
});

afterEach(() => {
    securityState.lookupSecretKey = null;
    vi.unstubAllGlobals();
    delete process.env.ZTO_LIST_RETURN_SCAN_TYPE;
    delete process.env.ZTO_LIST_SEND_SCAN_TYPE;
    delete process.env.ZTO_LIST_PROBLEM_SCAN_TYPE;
    delete process.env.ZTO_LIST_MISPLACED_REASONS;
});

const arrival = (code: string, back: number, hour = '08') => ({ code, type: '03', desc: 'អីវ៉ាន់មកដល់', at: dk(back) + ' ' + hour + ':00:00' });
const sign = (code: string, back: number) => ({ code, type: '05', desc: 'ចុះហត្ថលេខា', at: dk(back) + ' 18:00:00' });
const back = (code: string, back: number, hour = '09') => ({ code, type: '-710', desc: 'ត្រឡប់ការស្កេន', at: dk(back) + ' ' + hour + ':00:00' });
const send = (code: string, back: number, hour = '10') => ({ code, type: '02', desc: 'អីវ៉ាន់ផ្ញើរចេញ', at: dk(back) + ' ' + hour + ':00:00' });
const problem = (code: string, back: number, hour = '12', reason = 'ទីតាំងមិនត្រឹមត្រូវ') => ({ code, type: '30', desc: 'ការចុះឈ្មោះបញ្ហា',
    at: dk(back) + ' ' + hour + ':00:00', raw: { problemReason: reason } });
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
        expect(upstream.some((c) => c.startsWith('30 ')), 'គ្មានបញ្ជូនចេញ ➜ មិនអានស្កេនបញ្ហា (សន្សំការហៅ Netlify)').toBe(false);
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

    it('ប្រអប់ ៖ ក្រុម «↩️ មានក្នុងបញ្ជី តែស្កេនត្រឡប់រួច» ជាមួយម៉ោងត្រឡប់ និង «ធុងសំរាម «ត្រឡប់»» បើបើកក្នុង ZoeW · អក្សរសង្ខេបរាប់ (ម្ចាស់គម្រោង ៖ «ប្រាប់កញ្ចប់នោះមានក្នុងបញ្ជីតែត្រូវបានស្កេនត្រឡប់»)', () => {
        dataState.scanHistory = historyWith('ZTHAVE000001') as any;
        ztoState.ztoListSyncResult = {
            rows: [{ barcode: 'ZTHAVE000001', phone: '0977000111', cod: 2, dod: 0, at: dk(2) + ' 08:00:00', skip: '' },
                { barcode: 'ZTKEEP000001', phone: '0977000111', cod: 2, dod: 0, at: dk(2) + ' 08:00:00', skip: '' }],
            signedRows: [], from: dk(3), to: dk(1), total: 2, returnedState: 'ok', signedState: 'ok',
            returned: [{ barcode: 'ZTHAVE000001', at: dk(1) + ' 09:00:00' }]
        };
        renderZtoListSyncPreview();
        const groups = (ztoState.ztoListPreview as any).groups;
        const ret = groups.find((g: any) => g.tone === 'zto-list-returned');
        expect(ret, 'មានក្រុម «↩️»').toBeTruthy();
        expect(ret.title).toBe('↩️ មានក្នុងបញ្ជី តែស្កេនត្រឡប់រួច (រំលង · មិនបញ្ចូល) (1)');
        expect(ret.rows.map((r: any) => r.barcode)).toEqual(['ZTHAVE000001']);
        expect(ret.rows[0].notes.join(' ')).toContain(dk(1) + ' 09:00:00');
        expect(ret.rows[0].notes.join(' ')).toContain('ធុងសំរាម «ត្រឡប់» (ដកលុយ និងចំនួនកញ្ចប់)');
        expect(String(viewState.ztoListSyncNote)).toContain('↩️ ស្កេនត្រឡប់រួច 1 ➜ រំលង');
        expect(String(viewState.ztoListSyncNote)).toContain('🗑️ ដកចេញពី ZoeW 1 (ធុងសំរាម «ត្រឡប់» · ដកលុយ)');
    });
});

describe('📍 Cookie ៖ កញ្ចប់ខុសទីតាំង (ស្កេនបញ្ហា `30` «ទីតាំងមិនត្រឹមត្រូវ» ➜ បញ្ជូនចេញ `02`) ដូច ZTO Palm · អានតែប៉ុណ្ណោះ', () => {
    it('`30` «ទីតាំងមិនត្រឹមត្រូវ» មុន `02` ➜ `misplaced` · `02` គ្មានមូលហេតុនោះ ➜ `sentOut` · ត្រឡប់ + បញ្ជូនចេញ ➜ ត្រឡប់ឈ្នះ · មិនបញ្ចូល', async () => {
        rowsUp = [
            arrival('ZTMIS0000001', 1, '08'), problem('ZTMIS0000001', 1, '12'), send('ZTMIS0000001', 1, '13'),
            arrival('ZTSENT000001', 1, '08'), send('ZTSENT000001', 1, '14'),
            arrival('ZTPHONE00001', 1, '08'), problem('ZTPHONE00001', 1, '09', 'ទាក់ទងអតិថិជនមិនបាន'), send('ZTPHONE00001', 1, '15'),
            arrival('ZTLATE000001', 1, '08'), send('ZTLATE000001', 1, '10'), problem('ZTLATE000001', 1, '11'),
            arrival('ZTRET0000001', 2), problem('ZTRET0000001', 1, '08'), back('ZTRET0000001', 1, '09'), send('ZTRET0000001', 1, '10'),
            arrival('ZTKEEP000001', 1), problem('ZTKEEP000001', 1, '12')
        ];
        const out: any = await fetchZtoListAllPages(CFG, dk(3), dk(1));
        expect(out.returnedState).toBe('ok');
        expect(out.sentState).toBe('ok');
        expect(out.returned.map((r: any) => [r.barcode, r.misplaced === true, r.sentOut === true]).sort()).toEqual([
            ['ZTLATE000001', false, true], ['ZTMIS0000001', true, false], ['ZTPHONE00001', false, true],
            ['ZTRET0000001', false, false], ['ZTSENT000001', false, true]]);
        expect(upstream.some((c) => c.startsWith('02 ')), 'អានបញ្ជី 02').toBe(true);
        expect(upstream.some((c) => c.startsWith('30 ')), 'អានបញ្ជី 30').toBe(true);
        const groups: any = classifyZtoListRows(out.rows, [], [], out.signedRows, { from: dk(3), to: dk(1), returned: out.returned });
        expect(codesOf(groups.returned)).toEqual(['ZTLATE000001', 'ZTMIS0000001', 'ZTPHONE00001', 'ZTRET0000001', 'ZTSENT000001']);
        expect(codesOf(groups.fresh), 'ស្កេនបញ្ហាតែម្យ៉ាង (កញ្ចប់នៅហាង) ➜ ថ្មីធម្មតា').toEqual(['ZTKEEP000001']);
        const row = (code: string) => groups.returned.find((r: any) => r.barcode === code);
        expect([row('ZTMIS0000001').misplaced, row('ZTMIS0000001').sentOut]).toEqual([true, false]);
        expect([row('ZTSENT000001').misplaced, row('ZTSENT000001').sentOut]).toEqual([false, true]);
        expect([row('ZTRET0000001').misplaced, row('ZTRET0000001').sentOut]).toEqual([false, false]);
    });

    it('`ZTO_LIST_SEND_SCAN_TYPE=off` ➜ មិនសួរ 02 · បញ្ជី 02 ធ្លាក់ ➜ `sentState` failed · បញ្ជី 30 ធ្លាក់ ឬ `off` ➜ ដកដដែល ជាបញ្ជូនចេញ (មិនលាក់)', async () => {
        rowsUp = [arrival('ZTMIS0000001', 1, '08'), problem('ZTMIS0000001', 1, '12'), send('ZTMIS0000001', 1, '13')];
        process.env.ZTO_LIST_SEND_SCAN_TYPE = 'off';
        if (fn.resetCachesForTests) fn.resetCachesForTests();
        const off: any = await fetchZtoListAllPages(CFG, dk(3), dk(1));
        expect(off.sentState).toBe('off');
        expect(off.returned).toEqual([]);
        expect(upstream.some((c) => c.startsWith('02 '))).toBe(false);
        delete process.env.ZTO_LIST_SEND_SCAN_TYPE;
        if (fn.resetCachesForTests) fn.resetCachesForTests();
        failType = '02';
        const failed: any = await fetchZtoListAllPages(CFG, dk(3), dk(1));
        expect(failed.returnedState).toBe('ok');
        expect(failed.sentState).toBe('failed');
        expect(failed.returned).toEqual([]);
        failType = '30';
        if (fn.resetCachesForTests) fn.resetCachesForTests();
        const noProblem: any = await fetchZtoListAllPages(CFG, dk(3), dk(1));
        expect(noProblem.sentState, 'បញ្ជី 30 ធ្លាក់ ➜ ⚠️ មិនគ្រប់').toBe('partial');
        expect(noProblem.returned, 'មិនដឹងថាមានស្កេនបញ្ហាឬអត់ ➜ `sentUnverified` (គ្មានត្រា «បញ្ជូនចេញ»)')
            .toEqual([{ barcode: 'ZTMIS0000001', at: dk(1) + ' 13:00:00', sentOut: true, sentUnverified: true }]);
        expect(ztoReturnedKindOf(noProblem.returned[0])).toBe('left');
        expect(ztoReturnedKindOf({ ...noProblem.returned[0], sentUnverified: undefined })).toBe('sent');
        failType = '';
        process.env.ZTO_LIST_PROBLEM_SCAN_TYPE = 'off';
        if (fn.resetCachesForTests) fn.resetCachesForTests();
        upstream.length = 0;
        const problemOff: any = await fetchZtoListAllPages(CFG, dk(3), dk(1));
        expect(problemOff.sentState).toBe('ok');
        expect(problemOff.returned).toEqual([{ barcode: 'ZTMIS0000001', at: dk(1) + ' 13:00:00', sentOut: true, sentUnverified: true }]);
        const view: any = classifyZtoListRows([{ barcode: 'ZTMIS0000001', phone: '012000111', cod: 1, dod: 0, at: dk(1) + ' 08:00:00' }], [], [], [],
            { from: dk(3), to: dk(1), returned: problemOff.returned });
        expect([view.returned[0].sentOut, view.returned[0].sentUnverified]).toEqual([true, true]);
        expect(upstream.some((c) => c.startsWith('30 ')), '`off` ➜ គ្មានសំណើ 30').toBe(false);
    });

    it('Z2 ៖ បញ្ជី -710 ធ្លាក់ ខណៈ 02 ឆ្លើយ ➜ ការបញ្ជូនចេញរង់ចាំ (មិនដឹងថាត្រឡប់មុនឬអត់) · បញ្ជីគ្រប់ ➜ ត្រឡប់ 🔒 · បញ្ជូនចេញ', async () => {
        rowsUp = [
            arrival('ZTRETSEND001', 2), back('ZTRETSEND001', 1, '09'), send('ZTRETSEND001', 1, '10'),
            arrival('ZTSENTONLY01', 2), send('ZTSENTONLY01', 1, '11')
        ];
        failType = '-710';
        const failed: any = await fetchZtoListAllPages(CFG, dk(3), dk(1));
        expect(failed.returnedState).toBe('failed');
        expect(failed.sentState, 'បញ្ជីត្រឡប់មិនគ្រប់ ➜ ⚠️ ការបញ្ជូនចេញមិនគ្រប់').toBe('partial');
        expect(failed.returned, 'គ្មានការបញ្ជូនចេញដែលមិនទាន់ដឹងថាត្រឡប់មុនឬអត់').toEqual([]);
        failType = '';
        if (fn.resetCachesForTests) fn.resetCachesForTests();
        const whole: any = await fetchZtoListAllPages(CFG, dk(3), dk(1));
        const kinds = whole.returned.map((r: any) => [r.barcode, ztoReturnedKindOf(r)]).sort();
        expect(kinds).toEqual([['ZTRETSEND001', 'returned'], ['ZTSENTONLY01', 'sent']]);
    });

    it('«ទីតាំងមិនត្រឹមត្រូវ» នៃវដ្តមុន (មុនការមកដល់ចុងក្រោយ) ➜ 📤 បញ្ជូនចេញ មិនមែន «ខុសទីតាំង»', async () => {
        rowsUp = [
            arrival('ZTCYCLE00001', 3, '08'), problem('ZTCYCLE00001', 3, '09'), send('ZTCYCLE00001', 3, '10'),
            arrival('ZTCYCLE00001', 1, '08'), send('ZTCYCLE00001', 1, '15')
        ];
        const out: any = await fetchZtoListAllPages(CFG, dk(3), dk(1));
        expect(out.returned, 'ស្កេនបញ្ហា ≤ បញ្ជូនចេញចុងក្រោយ ➜ សញ្ញាជាមួយម៉ោងស្កេនបញ្ហា').toEqual([
            { barcode: 'ZTCYCLE00001', at: dk(1) + ' 15:00:00', misplaced: true, problemAt: dk(3) + ' 09:00:00' }]);
        const groups: any = classifyZtoListRows(out.rows, [], [], out.signedRows, { from: dk(3), to: dk(1), returned: out.returned });
        expect(groups.returned.map((r: any) => [r.barcode, r.misplaced, r.sentOut])).toEqual([['ZTCYCLE00001', false, true]]);
    });

    it('Function ៖ `problem=1` ➜ តែស្កេនបញ្ហាមូលហេតុ «ទីតាំងមិនត្រឹមត្រូវ» (៣ ភាសា · តួអក្សរមើលមិនឃើញ) · ចុងក្រោយក្នុងមួយ Barcode · រាប់គ្រប់', async () => {
        rowsUp = [
            problem('ZTMIS0000001', 1, '09'), problem('ZTMIS0000001', 1, '11'),
            problem('ZTMIS0000002', 1, '09', 'ទីតាំង​មិន​ត្រឹមត្រូវ'), problem('ZTMIS0000003', 1, '09', 'Incorrect location'),
            problem('ZTMIS0000004', 1, '09', '地址不详'), problem('ZTPHONE00001', 1, '09', 'ទាក់ទងអតិថិជនមិនបាន'),
            { code: 'ZTOTHER00001', type: '31', listed: '30', desc: 'x', at: dk(1) + ' 09:00:00', raw: { problemReason: 'ទីតាំងមិនត្រឹមត្រូវ' } }
        ];
        const h = { 'x-zoe-proxy-key': KEY, 'x-zoe-id-token': fx.tokenForSite('777001') };
        const ask = async () => fn.handler({ httpMethod: 'GET', headers: h, queryStringParameters: { list: '1', problem: '1', from: dk(3), to: dk(1), page: '1' } });
        const r = await ask();
        const body = JSON.parse(r.body);
        expect(r.statusCode).toBe(200);
        expect(body.kind).toBe('problem');
        expect(body.problemOk).toBe(true);
        expect(body.problem.map((p: any) => [p.barcode, p.at]).sort()).toEqual([['ZTMIS0000001', dk(1) + ' 11:00:00'],
            ['ZTMIS0000002', dk(1) + ' 09:00:00'], ['ZTMIS0000003', dk(1) + ' 09:00:00'], ['ZTMIS0000004', dk(1) + ' 09:00:00']]);
        expect(body.problemScans).toBe(6);
        expect(body.otherScans).toBe(1);
        expect(body.rows.length + body.otherScans + body.signedScans + body.problemScans).toBe(7);
        process.env.ZTO_LIST_MISPLACED_REASONS = 'off';
        if (fn.resetCachesForTests) fn.resetCachesForTests();
        const off = JSON.parse((await ask()).body);
        expect(off).toMatchObject({ kind: 'problem', problem: null, problemOk: false, reason: 'problem:reasons-off' });
    });
});

describe('📍 Cookie ៖ រាងជួរ Argus ពិត (ម្ចាស់គម្រោង inspect ៖ 03 ➜ 04 ➜ 30 «ទីតាំងមិនត្រឹមត្រូវ» ➜ 02 «អីវ៉ាន់ផ្ញើរចេញ» · លេខសំយោគ)', () => {
    const real = (code: string, type: string, desc: string, time: string, extra: Record<string, unknown> = {}) => ({ code, type, desc, at: dk(0) + ' ' + time,
        raw: { action: null, agentAmount: 0.0, barScannerId: '744', consigneeMobile: '+855-086000244', consigneeName: 'KC-15', customerCode: '20000',
            customerCodeDesc: null, dataFrom: 'Astra-VN-IOS', destinationOutletName: 'Mer SorChrey', fcAmount: 1.75, goodsType: 'របស់របរទូទៅ',
            isRefund: 0, isRefundDesc: 'ទេ', packageQty: 1, preOrNextStationCode: null, problemReason: '', recSite: 'សែនសុខ', remark: 'KH',
            scanMan: 'ស្រីអូន', scanSite: 'Mer SorChrey', scanSiteCode: '881859', signMan: '', signedBillCode: '', updateTime: dk(0) + ' ' + time, ...extra } });
    const CODE = 'ZTMIS0000002';
    it('ស្កេនបញ្ហា 30 តែម្យ៉ាង ➜ មិនមែនខុសទីតាំង · 30 «ទីតាំងមិនត្រឹមត្រូវ» ➜ 02 ក្រោយមកដល់ ➜ `misplaced` · រាងវាលពិតអានបាន', async () => {
        rowsUp = [
            real(CODE, '03', 'អីវ៉ាន់មកដល់', '13:25:26'),
            real(CODE, '04', 'ការចែកចាយអីវ៉ាន់', '13:33:04'),
            real(CODE, '30', 'ការចុះឈ្មោះបញ្ហា', '13:34:12', { problemReason: 'ទីតាំងមិនត្រឹមត្រូវ', dataFrom: 'Z10-KH-PDA' })
        ];
        const only: any = await fetchZtoListAllPages(CFG, dk(1), dk(0));
        expect(only.rows.map((r: any) => r.barcode)).toEqual([CODE]);
        expect(only.returned, 'ស្កេនបញ្ហា (30) មិនមែនភស្តុតាង').toEqual([]);
        rowsUp.push(real(CODE, '02', 'អីវ៉ាន់ផ្ញើរចេញ', '13:34:40', { preOrNextStationCode: 'ក្រុងកំពង់ចាម KC-01' }));
        if (fn.resetCachesForTests) fn.resetCachesForTests();
        const out: any = await fetchZtoListAllPages(CFG, dk(1), dk(0));
        expect(out.sentState).toBe('ok');
        expect(out.returned).toEqual([{ barcode: CODE, at: dk(0) + ' 13:34:40', misplaced: true, problemAt: dk(0) + ' 13:34:12' }]);
        const groups: any = classifyZtoListRows(out.rows, [], [], out.signedRows, { from: dk(1), to: dk(0), returned: out.returned });
        expect(codesOf(groups.returned)).toEqual([CODE]);
        expect(groups.returned[0]).toMatchObject({ misplaced: true, returnedAt: dk(0) + ' 13:34:40', cod: 0, dod: 1.75, from: 'សែនសុខ' });
        expect(groups.fresh).toEqual([]);
    });
});
