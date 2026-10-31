import { createScanMemorySdk } from './helpers/scan-memory-sdk';
/**
 * ⛔ ការទាញបញ្ជី ZTO (Cookie) ៖ ជួរចាស់ដែលគ្មានភស្តុតាងចុះហត្ថលេខា ត្រូវបានសួរស្ថានភាព (`resolveZtoListSignedVerdicts()` ➜
 *    `checkZtoStatusForBarcode()`) ជាមួយ `status=1` ➜ Function ពិតឆ្លើយ `ZTO_NO_CUSTOMER_DATA` + `ztoClosed` សម្រាប់ record ZTO
 *    ដែលកាន់ barcode នោះ តែគ្មានលេខ/COD/DOD (មុន ៖ `ZTO_NOT_FOUND` គ្មាន verdict ➜ `too-old-unknown` ជានិច្ច)។
 * ក. ZTO Sign ➜ បញ្ចូលជា «យករួច» (born closed · `closedAtMs > 0` · ស្ថិតិយកតាម `applyBarcodeCloseChange()`)។
 * ខ. ZTO មិនទាន់ Sign + ជួរចាស់ ➜ `too-old-open` ➜ មិនបញ្ចូល។
 * គ. ទិសផ្ទុយ ៖ ចម្លើយគ្មាន verdict (record គ្មានវាល Sign · record របស់ barcode ផ្សេង) ➜ `too-old-unknown` ➜ មិនបញ្ចូល។
 * ការសួរឆ្លងកាត់ Function ពិត (`proxy.handler`) ➜ កិច្ចសន្យា client ↔ Function ត្រូវបានវាស់ មិនមែន stub។
 */
import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { refTo } from '../src/app/refs';
import { dataState, firebaseState, securityState, uiState, ztoState } from '../src/core/state';
import { sealLookupHeader } from './helpers/sealed-lookup';
import { appLocalStore } from '../src/core/storage';
import { ztoScanStampMillis } from '../src/core/timezone';
import { viewState } from '../src/core/view-state';
import { clearCustomerDataTableCache } from '../src/features/customer-table';
import { ZTO_LIST_SKIP_TEXT, classifyZtoListRows, importZtoListRows, runZtoListSyncPreview, ztoListSignedProbe } from '../src/features/zto-list-sync';
import { clearZtoPickupStatusStore, ztoPickupStatus } from '../src/features/zto-status';

const h = vi.hoisted(() => ({ calls: [] as any[], saves: [] as any[], confirms: [] as string[] }));
vi.mock('../src/features/barcode-ops', () => ({
    openViewListModal: () => {},
    removeSingleBarcode: async () => 'failed',
    toggleIndividualBarcodeClose: async () => false,
    openEditBarcodePriceModal: () => {},
    closeEditBarcodeModal: () => {},
    saveEditedBarcodePrice: () => {},
    applyBarcodeCloseChange: async (itemId: string, code: string, closed: boolean, opts: any) => {
        h.calls.push({ itemId, code, closed, opts });
        return true;
    }
}));

vi.mock('../src/features/scan-action', () => ({
    triggerScanAction: () => {},
    confirmPhone: async () => {},
    dropOptimisticBarcode: () => {},
    addOrUpdateEntry: async (barcode: string, phone: string, cod: number, dod: number, locker: string, stampMs: number, closedAtMs: number) => {
        h.saves.push({ barcode, phone, cod, dod, locker, stampMs, closedAtMs });
        dataState.scanHistory = dataState.scanHistory.concat([{ id: 'it-' + barcode, phone, scanDate: '2026-09-27', isClosed: !!closedAtMs,
            createdAt: stampMs, barcodes: [{ code: barcode, isClosed: !!closedAtMs, cod, dod, createdAt: stampMs }] }]);
        return true;
    }
}));

const req = createRequire(import.meta.url);
const proxy = req('../netlify/functions/_shared/zto-order-detail-core.cjs');

const NOW = Date.UTC(2026, 9, 6, 3, 0, 0);
const OLD = '2026-09-27 08:00:00';
const CODE = 'ZT0000004101';
const OTHER = 'ZT0000004999';
const PHONE = '0960007345';
const KEY = 'list-probe-key-0123456789abcdef';
const FUNCTION_PATH = '/.netlify/functions/zto-order-detail';
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

const bare = (fields: Record<string, unknown>) => ({ success: true, data: Object.assign({ billCode: CODE, consigneePhone: '0', agentAmount: '', arrivalServiceCharge: '' }, fields) });

function listReply(url: URL) {
    if (url.searchParams.get('returned') === '1') return json({ success: true, list: true, enabled: true, kind: 'returned', rows: [], returned: null, returnedOk: false });
    if (url.searchParams.get('sent') === '1') return json({ success: true, list: true, enabled: true, kind: 'sent', rows: [], sent: null, sentOk: false });
    if (url.searchParams.get('problem') === '1') return json({ success: true, list: true, enabled: true, kind: 'problem', rows: [], problem: null, problemOk: false });
    return json({ success: true, list: true, enabled: true, pages: 1, total: 1,
        rows: [{ barcode: CODE, phone: PHONE, cod: 2.5, dod: 0, at: OLD, ztoClosed: null, skip: '' }],
        signed: [], signedOk: true, signedPages: 1 });
}

function server(upstream: () => unknown) {
    const probes: any[] = [];
    const fetch = vi.fn(async (input: any, options?: any) => {
        const url = new URL(String(input));
        if (url.pathname !== FUNCTION_PATH) return json(upstream());
        if (url.searchParams.get('list') === '1') return listReply(url);
        const result = await proxy.handler({ httpMethod: 'GET', headers: Object.fromEntries(new Headers(options && options.headers)),
            queryStringParameters: Object.fromEntries(url.searchParams) });
        const body = JSON.parse(result.body);
        probes.push({ barcode: url.searchParams.get('barcode'), status: url.searchParams.get('status'), code: body.code || '',
            ztoClosed: typeof body.ztoClosed === 'boolean' ? body.ztoClosed : null });
        return new Response(result.body, { status: result.statusCode });
    });
    return { fetch, probes };
}

async function pull(upstream: () => unknown) {
    const srv = server(upstream);
    vi.stubGlobal('fetch', srv.fetch);
    await runZtoListSyncPreview();
    expect(ztoState.ztoListSyncResult, 'the pull really finished').toBeTruthy();
    const groups = classifyZtoListRows(ztoState.ztoListSyncResult.rows, dataState.scanHistory, dataState.deletedItems);
    return { probes: srv.probes, groups };
}

function skippedPreviewNotes() {
    const group = ztoState.ztoListPreview.groups.find((g: any) => g.tone === 'zto-list-skip');
    return group ? group.rows.flatMap((r: any) => r.notes) : [];
}

beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(NOW));
    appLocalStore.clear();
    appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify(await sealLookupHeader({ enabled: true, fastMode: true,
        url: window.location.origin + FUNCTION_PATH + '?barcode={barcode}', headerName: 'X-Zoe-Proxy-Key' }, KEY)));
    appLocalStore.setItem('zoew_zto_listsync_v1', '1');
    clearCustomerDataTableCache();
    clearZtoPickupStatusStore();
    ztoListSignedProbe.clear();
    h.calls.length = 0;
    h.saves.length = 0;
    h.confirms.length = 0;
    ztoState.ztoStatusInFlight = false;
    ztoState.ztoListSyncInFlight = false;
    ztoState.ztoListSyncResult = null;
    dataState.scanHistory = [];
    dataState.deletedItems = [];
    uiState.isModalOpen = false;
    uiState.toasts = [];
    viewState.ztoListSyncNote = '';
    firebaseState.serverTimeOffsetMs = 0;
    firebaseState.authGeneration++;
    const options = { databaseURL: 'https://list-probe-fixture.firebaseio.com' };
    firebaseState.auth = { currentUser: { uid: 'list-probe-user' }, app: { options } } as any;
    firebaseState.db = { listProbe: true, app: { options } } as any;
    firebaseState.isInitializingFirebase = false;
    appLocalStore.setItem('zoew_firebase_config', JSON.stringify(options));
    firebaseState.fb = createScanMemorySdk('list-probe-token').sdk as any;
    for (const name of ['ztoListSyncFrom', 'ztoListSyncTo'] as const) {
        const input = document.createElement('input');
        input.value = name === 'ztoListSyncFrom' ? '2026-09-26' : '2026-10-06';
        refTo(name)(input);
    }
    vi.stubGlobal('confirm', (q: string) => { h.confirms.push(String(q)); return true; });
    vi.stubEnv('ZTO_PROXY_KEY', KEY);
    vi.stubEnv('ZTO_COOKIE', 'BOS-MAN-SESSION=list-probe-test');
    vi.stubEnv('ZTO_CACHE_TTL_MS', '60000');
    vi.stubEnv('ZTO_UPSTREAM_RETRIES', '0');
    vi.stubEnv('ZTO_DETAIL_IDENTITY', 'off');
    vi.stubEnv('ZTO_FIELD_SIGNED', 'signed');
    vi.stubEnv('ZTO_SIGNED_VALUES', '1');
    proxy.resetCachesForTests();
});

afterEach(() => {
    securityState.lookupSecretKey = null;
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    proxy.resetCachesForTests();
    appLocalStore.clear();
    clearZtoPickupStatusStore();
    ztoListSignedProbe.clear();
    ztoState.ztoListSyncResult = null;
    dataState.scanHistory = [];
    dataState.deletedItems = [];
    refTo('ztoListSyncFrom')(null);
    refTo('ztoListSyncTo')(null);
});

describe('ទាញបញ្ជី ZTO (Cookie) ៖ ការសួរស្ថានភាព record គ្មានទិន្នន័យអតិថិជន (`status=1`)', () => {
    it('ក. ZTO Sign ➜ ជួរចាស់បញ្ចូលជា «យករួច» (born closed) តាមទ្វារបញ្ចូលពិត', async () => {
        const { probes, groups } = await pull(() => bare({ signed: '1' }));
        expect(probes, 'the probe asks in status mode and the real Function answers the sign verdict').toEqual([
            { barcode: CODE, status: '1', code: 'ZTO_NO_CUSTOMER_DATA', ztoClosed: true }
        ]);
        expect(groups.skipped.map((r: any) => [r.barcode, r.skip])).toEqual([]);
        expect(groups.fresh.map((r: any) => [r.barcode, r.closedAtZto])).toEqual([[CODE, true]]);
        expect(viewState.ztoListSyncNote).toContain('🔒 ZTO បិទរួច 1 ➜ «យករួច»');
        await importZtoListRows();
        expect(h.saves).toEqual([{ barcode: CODE, phone: PHONE, cod: 2.5, dod: 0, locker: 'N/A', stampMs: ztoScanStampMillis(OLD), closedAtMs: NOW }]);
        expect(h.calls).toEqual([{ itemId: 'it-' + CODE, code: CODE, closed: true,
            opts: { silent: true, showModal: false, settlementReport: {}, expectedSignIdentity: JSON.stringify(['2026-09-27', ztoScanStampMillis(OLD), null, null]) } }]);
        expect(ztoPickupStatus.get(CODE)).toMatchObject({ closed: true });
    });

    it('ខ. ZTO មិនទាន់ Sign ➜ ជួរចាស់ `too-old-open` (មិនមែន `too-old-unknown`) ➜ មិនបញ្ចូល', async () => {
        const { probes, groups } = await pull(() => bare({ signed: '0' }));
        expect(probes, 'the probe asks in status mode and the real Function answers «not signed»').toEqual([
            { barcode: CODE, status: '1', code: 'ZTO_NO_CUSTOMER_DATA', ztoClosed: false }
        ]);
        expect(groups.fresh).toEqual([]);
        expect(groups.skipped.map((r: any) => [r.barcode, r.skip])).toEqual([[CODE, 'too-old-open']]);
        expect(skippedPreviewNotes()).toContain(ZTO_LIST_SKIP_TEXT['too-old-open']);
        await importZtoListRows();
        expect(h.confirms).toEqual([]);
        expect(h.saves).toEqual([]);
        expect(h.calls).toEqual([]);
    });

    it.each([
        ['record កាន់ barcode តែគ្មានវាល Sign', () => bare({}), 'ZTO_NO_CUSTOMER_DATA'],
        ['record របស់ barcode ផ្សេង (ទោះ Sign)', () => bare({ billCode: OTHER, signed: '1' }), 'ZTO_NOT_FOUND']
    ])('គ. ទិសផ្ទុយ ៖ %s ➜ ចម្លើយគ្មាន verdict ➜ `too-old-unknown` ➜ មិនបញ្ចូល', async (_label, upstream, code) => {
        const { probes, groups } = await pull(upstream);
        expect(probes, 'the probe asked in status mode, the Function had no verdict to give').toEqual([
            { barcode: CODE, status: '1', code, ztoClosed: null }
        ]);
        expect(groups.fresh).toEqual([]);
        expect(groups.skipped.map((r: any) => [r.barcode, r.skip])).toEqual([[CODE, 'too-old-unknown']]);
        expect(skippedPreviewNotes()).toContain(ZTO_LIST_SKIP_TEXT['too-old-unknown']);
        await importZtoListRows();
        expect(h.confirms).toEqual([]);
        expect(h.saves).toEqual([]);
        expect(h.calls).toEqual([]);
    });
});
