/**
 * ⛔ ZTO-E12 ៖ កញ្ចប់ «ចុះហត្ថលេខា» (05) ដែលគ្មានស្កេនមកដល់ក្នុងចន្លោះ ➜ បញ្ចូលជា «យករួច» លើថ្ងៃ ZTO ស្កេនចុះហត្ថលេខា (សំណើម្ចាស់គម្រោង ៖
 * «បញ្ចូលតែកញ្ចប់ 03 ហើយកញ្ចប់ 05 ក៏ទាញបានតែត្រូវចូលជាកញ្ចប់បិទរួច» · «ថ្ងៃ ZTO ស្កេនចុះហត្ថលេខា» · «អោយប្រាប់ថាកញ្ចប់មកដល់ថ្ងៃណា និងបិទថ្ងៃណា»)។
 *
 * មុនកែ ៖ Function ផ្ញើតែលេខ barcode របស់ជួរ 05 (`signed`) ➜ ជួរទាំងនោះគ្រាន់តែជាភស្តុតាងសម្រាប់ជួរមកដល់ ➜ កញ្ចប់ដែលមកដល់មុនចន្លោះ (ឬ ZoeW
 * មិនដែលស្កេន) តែចុះហត្ថលេខាក្នុងចន្លោះ មិនដែលចូល ZoeW ➜ ស្ថិតិប្រាក់ និងស្ថិតិយក ខ្វះ។
 *
 * ១. `fetchZtoListAllPages()` ប្រមូល `signedRows` ពីគ្រប់ចម្លើយ (`withSigned` · `signed`)។
 * ២. `classifyZtoListRows(rows, history, trash, signedRows, range)` ៖ ជួរ 05 ដែល barcode មិននៅក្នុងបញ្ជីមកដល់ ហើយថ្ងៃចុះហត្ថលេខាក្នុងចន្លោះ
 *    ➜ ថ្មី = «យករួច» (`closedAtZto`) · ម៉ោង = ម៉ោងចុះហត្ថលេខា · មានក្នុង ZoeW ➜ «មានរួច» (បិទបើនៅបើក) · គ្មានលេខទូរស័ព្ទ ➜ រំលង ·
 *    ចាស់ជាងអាយុធុងសំរាម ➜ `too-old-purged` (ការពារលុយស្ទួន) · ក្រៅចន្លោះ ➜ មិនរាប់ · ជួរមកដល់ ➜ ផ្លូវដើម (+ ថ្ងៃចុះហត្ថលេខា)។
 * ៣. «បញ្ចូល» ៖ `addOrUpdateEntry(…, stampMs = ម៉ោងចុះហត្ថលេខា, closedAt)` ➜ ស្ថិតិយកតាម `applyBarcodeCloseChange()` ·
 *    បញ្ជីមកដល់ទទេ តែមានជួរ 05 ក៏បញ្ចូលបាន។
 * ៤. ជួរនីមួយៗក្នុងប្រអប់ ៖ «📥 មកដល់ ៖ …» និង «✍️ ZTO ចុះហត្ថលេខា (បិទ) ៖ …»។
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { refTo } from '../src/app/refs';
import { ztoListGroupModel } from '../src/app/components/zto/model';
import { dataState, firebaseState, uiState, ztoState } from '../src/core/state';
import { viewState } from '../src/core/view-state';
import { appLocalStore } from '../src/core/storage';
import { ztoScanStampMillis } from '../src/core/timezone';
import { clearCustomerDataTableCache } from '../src/features/customer-table';
import { classifyZtoListRows, fetchZtoListAllPages, importZtoListRows, runZtoListSyncPreview } from '../src/features/zto-list-sync';
import { clearZtoPickupStatusStore } from '../src/features/zto-status';

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
        dataState.scanHistory = dataState.scanHistory.concat([{ id: 'it-' + barcode, phone, scanDate: '2026-10-05', isClosed: !!closedAtMs,
            createdAt: stampMs, barcodes: [{ code: barcode, isClosed: !!closedAtMs, cod, dod, createdAt: stampMs }] }]);
        return true;
    }
}));

const NOW = Date.UTC(2026, 9, 6, 3, 0, 0);
const RANGE = { from: '2026-10-03', to: '2026-10-06' };
const CFG = { enabled: true, fastMode: true, url: 'https://example.invalid/.netlify/functions/zto-order-detail?barcode={barcode}' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

function row(barcode: string, extra: any = {}) {
    return Object.assign({ barcode, phone: '0963897345', cod: 2.5, dod: 0, at: '2026-10-05 09:00:00', ztoClosed: null, skip: '' }, extra);
}

function signedRow(barcode: string, at: string, extra: any = {}) {
    return Object.assign({ barcode, phone: '0977000111', cod: 4.25, dod: 1, at, from: 'taobao' }, extra);
}

function listBody(extra: any) {
    return Object.assign({ success: true, list: true, enabled: true, rows: [], pages: 1, total: 0, otherScans: 0, signedScans: 0, signed: [], signedOk: true }, extra);
}

function openItem(id: string, code: string) {
    return { id, phone: '0963897345', scanDate: '2026-10-01', isClosed: false, createdAt: NOW - 5 * 86400000,
        barcodes: [{ code, isClosed: false, cod: 1, dod: 0, createdAt: NOW - 5 * 86400000 }] };
}

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(NOW));
    appLocalStore.clear();
    appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify(CFG));
    appLocalStore.setItem('zoew_zto_listsync_v1', '1');
    clearCustomerDataTableCache();
    clearZtoPickupStatusStore();
    h.calls.length = 0;
    h.saves.length = 0;
    h.confirms.length = 0;
    ztoState.ztoListSyncInFlight = false;
    ztoState.ztoListSyncResult = null;
    dataState.scanHistory = [];
    dataState.deletedItems = [];
    uiState.isModalOpen = false;
    uiState.toasts = [];
    viewState.ztoListSyncNote = '';
    firebaseState.authGeneration++;
    firebaseState.auth = { currentUser: { uid: 'audit-user' } } as any;
    firebaseState.db = { audit: true } as any;
    firebaseState.fb = {
        getIdTokenResult: async () => ({ token: 'audit-token' }),
        ref: (_db: unknown, path: string) => ({ path }),
        runTransaction: async () => ({ committed: true, txOutcome: 'committed' })
    } as any;
    for (const name of ['ztoListSyncFrom', 'ztoListSyncTo'] as const) {
        const input = document.createElement('input');
        input.value = name === 'ztoListSyncFrom' ? RANGE.from : RANGE.to;
        refTo(name)(input);
    }
    vi.stubGlobal('confirm', (q: string) => { h.confirms.push(String(q)); return true; });
});

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    appLocalStore.clear();
    refTo('ztoListSyncFrom')(null);
    refTo('ztoListSyncTo')(null);
});

describe('`fetchZtoListAllPages()` ប្រមូល `signedRows`', () => {
    it('ពីទំព័រ ១ (`withSigned`) និងទំព័រ «ចុះហត្ថលេខា» បន្ថែម (`signed`) · ធាតុខូចរំលង', async () => {
        vi.stubGlobal('fetch', vi.fn(async (url: string) => {
            const u = new URL(url);
            const page = Number(u.searchParams.get('page'));
            if (u.searchParams.get('signed') === '1') {
                return json(listBody({ kind: 'signed', page, pages: 2, signed: ['ZT0000000502'], signedRows: [signedRow('ZT0000000502', '2026-10-05 10:00:00')] }));
            }
            return json(listBody({ page, pages: 1, total: 1, rows: [row('ZT0000000001')], signedPages: 2, signed: ['ZT0000000501'],
                signedRows: [signedRow('ZT0000000501', '2026-10-04 08:30:00'), null, 'x', 7] }));
        }));
        const out: any = await fetchZtoListAllPages(CFG, RANGE.from, RANGE.to);
        expect(out.signedRows.map((r: any) => r.barcode)).toEqual(['ZT0000000501', 'ZT0000000502']);
    });
});

describe('`classifyZtoListRows()` ៖ ជួរ 05 ដែលគ្មានស្កេនមកដល់ក្នុងចន្លោះ', () => {
    it('ថ្មី ➜ «យករួច» លើម៉ោងចុះហត្ថលេខា · មានក្នុង ZoeW ➜ «មានរួច» · ក្រៅចន្លោះ ➜ មិនរាប់ · ជួរមកដល់ ➜ ផ្លូវដើម + ថ្ងៃចុះហត្ថលេខា', () => {
        const history = [openItem('h1', 'ZT0000000603')];
        const groups: any = classifyZtoListRows(
            [row('ZT0000000601')],
            history, [],
            [
                signedRow('ZT0000000601', '2026-10-05 16:00:00'),
                signedRow('ZT0000000602', '2026-10-04 08:30:00'),
                signedRow('ZT0000000603', '2026-10-05 11:00:00'),
                signedRow('ZT0000000604', '2026-10-07 09:00:00'),
                signedRow('ZT0000000605', '2026-10-02 23:59:59')
            ],
            RANGE);
        const fresh = (code: string) => groups.fresh.find((r: any) => r.barcode === code);
        expect(groups.fresh.map((r: any) => r.barcode).sort()).toEqual(['ZT0000000601', 'ZT0000000602']);
        expect(fresh('ZT0000000601').signedOnly).toBeFalsy();
        expect(fresh('ZT0000000601').at).toBe('2026-10-05 09:00:00');
        expect(fresh('ZT0000000601').signedAt).toBe('2026-10-05 16:00:00');
        const only = fresh('ZT0000000602');
        expect(only.signedOnly).toBe(true);
        expect(only.closedAtZto).toBe(true);
        expect(only.at).toBe('2026-10-04 08:30:00');
        expect(only.stampMs).toBe(ztoScanStampMillis('2026-10-04 08:30:00'));
        expect(only.signedAt).toBe('2026-10-04 08:30:00');
        expect(only.phone).toBe('0977000111');
        expect(only.cod).toBe(4.25);
        expect(only.dod).toBe(1);
        expect(only.from).toBe('taobao');
        expect(groups.existing.map((r: any) => r.barcode)).toEqual(['ZT0000000603']);
        expect(groups.existing[0].ztoClosed).toBe(true);
        const all = [].concat(groups.fresh, groups.existing, groups.duplicate, groups.skipped).map((r: any) => r.barcode);
        expect(all).not.toContain('ZT0000000604');
        expect(all).not.toContain('ZT0000000605');
    });

    it('⛔ គ្មានលេខទូរស័ព្ទ ➜ រំលង · ចាស់ជាងអាយុធុងសំរាម ➜ `too-old-purged` · ចាស់ ៨–៣០ ថ្ងៃ (ZTO បិទរួច) ➜ បញ្ចូលបាន · ម៉ោងគ្មាន ➜ មិនរាប់ · ស្ទួន ➜ ម៉ោងចុងក្រោយ', () => {
        const wide = { from: '2026-09-04', to: '2026-10-06' };
        const groups: any = classifyZtoListRows([], [], [], [
            signedRow('ZT0000000701', '2026-10-05 08:00:00', { phone: '' }),
            signedRow('ZT0000000702', '2026-09-04 08:00:00'),
            signedRow('ZT0000000703', '2026-09-25 08:00:00'),
            signedRow('ZT0000000704', ''),
            signedRow('ZT0000000705', '2026-10-04 08:00:00'),
            signedRow('ZT0000000705', '2026-10-05 07:00:00', { cod: 9 })
        ], wide);
        const skipped = (code: string) => groups.skipped.find((r: any) => r.barcode === code);
        expect(skipped('ZT0000000701')).toBeTruthy();
        expect(skipped('ZT0000000702').skip).toBe('too-old-purged');
        expect(groups.fresh.map((r: any) => r.barcode).sort()).toEqual(['ZT0000000703', 'ZT0000000705']);
        expect(groups.fresh.find((r: any) => r.barcode === 'ZT0000000705').cod).toBe(9);
        const all = [].concat(groups.fresh, groups.existing, groups.duplicate, groups.skipped).map((r: any) => r.barcode);
        expect(all).not.toContain('ZT0000000704');
    });

    it('ទិសផ្ទុយ ៖ គ្មាន `signedRows` / `range` (អ្នកហៅចាស់) ➜ លទ្ធផលដូចមុនបេះបិទ', () => {
        const a: any = classifyZtoListRows([row('ZT0000000801'), row('ZT0000000802', { phone: '' })], [], []);
        const b: any = classifyZtoListRows([row('ZT0000000801'), row('ZT0000000802', { phone: '' })], [], [], [signedRow('ZT0000000809', '2026-10-05 08:00:00')]);
        expect(b.fresh.map((r: any) => r.barcode)).toEqual(a.fresh.map((r: any) => r.barcode));
        expect(b.skipped.map((r: any) => r.barcode)).toEqual(a.skipped.map((r: any) => r.barcode));
    });
});

describe('មើលជាមុន និង «បញ្ចូល»', () => {
    it('បញ្ជីមកដល់ទទេ តែមានជួរ 05 ក្នុងចន្លោះ ➜ មើលជាមុនរាប់ · «បញ្ចូល» ➜ `addOrUpdateEntry` លើម៉ោងចុះហត្ថលេខា + បិទ ➜ ស្ថិតិយក', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => json(listBody({ total: 0, rows: [], signedPages: 1, signed: ['ZT0000000901'],
            signedRows: [signedRow('ZT0000000901', '2026-10-04 08:30:00')] }))));
        await runZtoListSyncPreview();
        expect(String(viewState.ztoListSyncNote)).toContain('✍️');
        expect(String(viewState.ztoListSyncNote)).toContain('មុនថ្ងៃ 2026-10-03 ៖ 1 កញ្ចប់ ➜');
        await importZtoListRows();
        expect(h.confirms.length).toBe(1);
        expect(h.confirms[0]).toContain('ចុះហត្ថលេខា');
        expect(h.saves.length).toBe(1);
        expect(h.saves[0].barcode).toBe('ZT0000000901');
        expect(h.saves[0].stampMs).toBe(ztoScanStampMillis('2026-10-04 08:30:00'));
        expect(h.saves[0].closedAtMs).toBeGreaterThan(0);
        expect(h.saves[0].cod).toBe(4.25);
        expect(h.calls.map((c) => [c.code, c.closed])).toEqual([['ZT0000000901', true]]);
        expect(String(viewState.ztoListSyncNote)).toContain('2026-10-04');
    });
});

describe('ជួរក្នុងប្រអប់ ៖ ថ្ងៃមកដល់ និងថ្ងៃបិទ', () => {
    it('ជួរមកដល់ + ចុះហត្ថលេខា ➜ «📥 មកដល់ ៖ …» + «✍️ ZTO ចុះហត្ថលេខា (បិទ) ៖ …» · ជួរ 05 តែម្យ៉ាង ➜ «មកដល់ ៖ មុនថ្ងៃ …» · គ្មានចុះហត្ថលេខា ➜ ថ្ងៃមកដល់តែម្យ៉ាង', () => {
        const groups: any = classifyZtoListRows([row('ZT0000001001'), row('ZT0000001002')], [], [],
            [signedRow('ZT0000001001', '2026-10-05 16:00:00'), signedRow('ZT0000001003', '2026-10-04 08:30:00')], RANGE);
        const model = ztoListGroupModel('🆕', groups.fresh, 'zto-list-fresh');
        const notesOf = (code: string) => model.rows.find((r) => r.barcode === code)!.notes.join(' | ');
        expect(notesOf('ZT0000001001')).toContain('📥 មកដល់ ៖ 2026-10-05 09:00:00');
        expect(notesOf('ZT0000001001')).toContain('✍️ ZTO ចុះហត្ថលេខា (បិទ) ៖ 2026-10-05 16:00:00');
        expect(notesOf('ZT0000001003')).toContain('📥 មកដល់ ៖ មុនថ្ងៃ 2026-10-03');
        expect(notesOf('ZT0000001003')).toContain('✍️ ZTO ចុះហត្ថលេខា (បិទ) ៖ 2026-10-04 08:30:00');
        expect(notesOf('ZT0000001002')).toContain('📥 មកដល់ ៖ 2026-10-05 09:00:00');
        expect(notesOf('ZT0000001002')).not.toContain('✍️');
    });
});
