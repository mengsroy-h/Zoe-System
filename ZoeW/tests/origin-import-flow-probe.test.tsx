import { createScanMemorySdk } from './helpers/scan-memory-sdk';
/**
 * ⛔ ប្រភពកញ្ចប់ ៖ ការ «បញ្ចូល» បញ្ជី ZTO ទុកប្រភព (`from` = `recSite`) ចូលប្រវត្តិ (`<id>/origins/<key>`) — កញ្ចប់ថ្មីដែលរក្សាទុកបាន
 * កញ្ចប់មានរួចដែលគ្មានភស្តុតាងដើមនៅ unresolved · ការសរសេរប្រភពដាច់ពីការរក្សាទុកកញ្ចប់ ➜ rules ចាស់បដិសេធ ➜ ការបញ្ចូលនៅជោគជ័យដដែល ·
 * ⛔ ការមើលបញ្ជី (preview) មិនសរសេរអ្វីទាំងអស់។
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { refTo } from '../src/app/refs';
import { dataState, firebaseState, uiState, ztoState } from '../src/core/state';
import { viewState } from '../src/core/view-state';
import { appLocalStore } from '../src/core/storage';
import { clearCustomerDataTableCache } from '../src/features/customer-table';
import { importZtoListRows, runZtoListSyncPreview } from '../src/features/zto-list-sync';
import { makeFreshOriginEntry, saveBarcodeOrigins } from '../src/features/barcode-origin';
import { getFormattedClockTime } from '../src/core/timezone';
import { barcodeRegistryKey } from '../src/domain/registry';
import { clearZtoPickupStatusStore } from '../src/features/zto-status';

const h = vi.hoisted(() => ({ saves: [] as any[], tx: [] as any[], reject: false, probe: '', staged: null as any, op: null as any, holdOrigin: false, resumeOrigin: null as any, started: [] as string[], entry: null as any, operations: {} as Record<string, any> }));
vi.mock('../src/features/barcode-ops', () => ({
    openViewListModal: () => {},
    removeSingleBarcode: async () => 'failed',
    toggleIndividualBarcodeClose: async () => false,
    openEditBarcodePriceModal: () => {},
    closeEditBarcodeModal: () => {},
    saveEditedBarcodePrice: () => {},
    applyBarcodeCloseChange: async () => true
}));
vi.mock('../src/features/scan-action', () => ({
    triggerScanAction: () => {},
    confirmPhone: async () => {},
    dropOptimisticBarcode: () => {},
    addOrUpdateEntry: async (barcode: string, phone: string, cod: number, dod: number, _locker: any, stampMs: number, _closed: any, handle: any) => {
        h.saves.push({ barcode, phone, cod, dod });
        const record = handle.record;
        const item: any = { id: 'it' + barcode, phone, scanDate: record.scanDate, isClosed: false,
            createdAt: stampMs, barcodes: [{ code: barcode, isClosed: false, cod, dod, createdAt: stampMs,
                scanIntent: record.id, time: getFormattedClockTime(stampMs) + ' (' + record.scanDate + ')' }] };
        h.op = { id: record.id, scope: record.scope, barcode: record.barcode, birth: record.createdAt };
        h.entry = makeFreshOriginEntry(barcode, 'synthetic-origin', handle, () => true);
        const [scope, actorUid] = JSON.parse(record.scope);
        h.operations[record.id] = { v: 2, id: record.id, actorUid, scope, code: barcode, registryKey: barcodeRegistryKey(barcode),
            birth: record.createdAt, scanDate: record.scanDate, month: record.scanDate.slice(0, 7), cod, dod, count: 1,
            monthToken: 'op_m' + record.id.slice(5), phase: 'committed', targetId: item.id,
            payloadHash: 'a'.repeat(64), phone, locker: 'N/A', closedAt: 0 };
        if (h.probe === 'locked') item.scanPending = { intent: handle.record.id };
        if (h.probe === 'absent') h.staged = item;
        else dataState.scanHistory = dataState.scanHistory.concat([item]);
        return true;
    }
}));

const NOW = Date.UTC(2026, 9, 6, 3, 0, 0);
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const row = (barcode: string, from?: string) => ({ barcode, phone: '0960007345', cod: 2.5, dod: 0, at: '2026-10-05 09:00:00',
    ztoClosed: null, skip: '', from });
const listReply = (rows: any[]) => vi.fn(async () => json({ success: true, list: true, enabled: true, pages: 1, total: rows.length,
    rows, signed: [], signedOk: true, signedPages: 1 }));

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(NOW));
    appLocalStore.clear();
    appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify({ enabled: true, fastMode: true,
        url: window.location.origin + '/.netlify/functions/zto-order-detail?barcode={barcode}' }));
    appLocalStore.setItem('zoew_zto_listsync_v1', '1');
    clearCustomerDataTableCache();
    clearZtoPickupStatusStore();
    h.saves.length = 0;
    h.tx.length = 0;
    h.reject = false;
    h.probe = '';
    h.staged = null;
    h.op = null;
    h.holdOrigin = false;
    h.resumeOrigin = null;
    h.started.length = 0;
    h.entry = null;
    h.operations = {};
    ztoState.ztoListSyncInFlight = false;
    ztoState.ztoListSyncResult = null;
    ztoState.ztoOriginRefusedDb = null;
    dataState.scanHistory = [];
    dataState.deletedItems = [];
    uiState.isModalOpen = false;
    uiState.toasts = [];
    viewState.ztoListSyncNote = '';
    firebaseState.authGeneration++;
    const options = { databaseURL: 'https://origin-import-fixture.firebaseio.com' };
    firebaseState.auth = { currentUser: { uid: 'audit-user' }, app: { options } } as any;
    firebaseState.db = { audit: true, app: { options } } as any;
    firebaseState.isInitializingFirebase = false;
    appLocalStore.setItem('zoew_firebase_config', JSON.stringify(options));
    const native = createScanMemorySdk('audit-token').sdk;
    firebaseState.fb = {
        ...native,
        getIdTokenResult: async () => ({ token: 'audit-token' }),
        ref: (_db: unknown, path = '') => ({ path }),
        get: async (ref: any) => {
            if (ref.path.startsWith('zoew_scan_operations/') && h.operations[ref.path.split('/')[1]]) return { val: () => h.operations[ref.path.split('/')[1]] };
            if (ref.path.startsWith('zoew_scan_history_cod_dod/')) return { val: () => dataState.scanHistory.find((i: any) => i.id === ref.path.split('/')[1]) ?? null };
            return native.get(ref);
        },
        runTransaction: async (ref: any, fn: (cur: any) => any) => {
            if (!ref || !/^zoew_scan_history_cod_dod\//.test(ref.path)) return native.runTransaction(ref, fn);
            if (h.reject) throw Object.assign(new Error('PERMISSION_DENIED'), { code: 'PERMISSION_DENIED' });
            h.started.push(ref.path);
            if (h.holdOrigin) {
                h.holdOrigin = false;
                await new Promise<void>((resolve) => { h.resumeOrigin = resolve; });
            }
            const id = ref.path.split('/')[1];
            const cur = dataState.scanHistory.find((i: any) => i.id === id);
            const next = fn(cur ? JSON.parse(JSON.stringify(cur)) : null);
            if (next === undefined) return { committed: false };
            h.tx.push({ path: ref.path, origins: next.origins });
            return { committed: true, snapshot: { val: () => JSON.parse(JSON.stringify(next)) } };
        }
    } as any;
    for (const name of ['ztoListSyncFrom', 'ztoListSyncTo'] as const) {
        const input = document.createElement('input');
        input.value = name === 'ztoListSyncFrom' ? '2026-10-03' : '2026-10-06';
        refTo(name)(input);
    }
    vi.stubGlobal('confirm', () => true);
});

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    appLocalStore.clear();
    refTo('ztoListSyncFrom')(null);
    refTo('ztoListSyncTo')(null);
});

async function settle() {
    for (let i = 0; i < 10; i++) await Promise.resolve();
}

describe('ប្រភពកញ្ចប់ ៖ ការបញ្ចូលបញ្ជី ZTO ➜ ប្រវត្តិ', () => {
    it('probe: import returns while the bound fresh origin write is in flight; legacy remains unresolved', async () => {
        h.holdOrigin = true;
        dataState.scanHistory = [{ id: 'existing-synthetic', phone: '00000000', scanDate: '2026-10-05', isClosed: false, createdAt: 1,
            barcodes: [{ code: 'SYNTH000', isClosed: false, cod: 1, dod: 0 }] }];
        vi.stubGlobal('fetch', listReply([row('SYNTH000', 'synthetic-origin'), row('SYNTH003', 'synthetic-origin')]));
        await runZtoListSyncPreview();
        await importZtoListRows();
        expect(h.saves).toHaveLength(1);
        await settle();
        expect(h.started).toEqual(['zoew_scan_history_cod_dod/itSYNTH003']);
        expect(h.tx).toHaveLength(0);
        expect(typeof h.resumeOrigin).toBe('function');
        h.resumeOrigin();
        await settle();
        expect(h.started).toHaveLength(1);
        expect(h.tx).toEqual([{ path: 'zoew_scan_history_cod_dod/itSYNTH003', origins: { SYNTH003: 'synthetic-origin' } }]);
        expect((dataState.scanHistory[0] as any).origins).toBeUndefined();
    });
    it('probe: successful mocked scan still has same-op local lock at one-shot origin write', async () => {
        h.probe = 'locked';
        vi.stubGlobal('fetch', listReply([row('SYNTH001', 'synthetic-origin')]));
        await runZtoListSyncPreview();
        await importZtoListRows();
        await settle();
        expect(h.saves).toHaveLength(1);
        expect(h.op.id).toMatch(/^scan_[a-f0-9]{32}$/);
        expect(h.op.barcode).toBe('SYNTH001');
        expect(h.op.birth).toBeGreaterThan(0);
        expect(h.op.scope).toContain('audit-user');
        expect((dataState.scanHistory[0] as any).barcodes[0].createdAt).toBe(h.op.birth);
        expect((dataState.scanHistory[0] as any).barcodes[0].scanIntent).toBe(h.op.id);
        expect((dataState.scanHistory[0] as any).scanPending.intent).toBe(h.op.id);
        expect(h.tx).toEqual([]);
        delete (dataState.scanHistory[0] as any).scanPending;
        await settle();
        expect(h.tx).toEqual([]);
        expect(await saveBarcodeOrigins([h.entry])).toEqual({ applied: 1, unchanged: 0, unresolved: 0, unknown: 0 });
        expect(h.tx).toHaveLength(1);
    });

    it('probe: successful mocked scan not yet in listener view is omitted from one-shot origin write', async () => {
        h.probe = 'absent';
        vi.stubGlobal('fetch', listReply([row('SYNTH002', 'synthetic-origin')]));
        await runZtoListSyncPreview();
        await importZtoListRows();
        await settle();
        expect(h.saves).toHaveLength(1);
        expect(h.op.id).toMatch(/^scan_[a-f0-9]{32}$/);
        expect(h.op.barcode).toBe('SYNTH002');
        expect(h.op.scope).toContain('audit-user');
        expect(h.staged.barcodes[0].createdAt).toBe(h.op.birth);
        expect(h.staged.barcodes[0].scanIntent).toBe(h.op.id);
        expect(h.tx).toEqual([]);
        dataState.scanHistory = [h.staged];
        await settle();
        expect(h.tx).toEqual([]);
        expect(await saveBarcodeOrigins([h.entry])).toEqual({ applied: 1, unchanged: 0, unresolved: 0, unknown: 0 });
        expect(h.tx).toHaveLength(1);
    });
    it('fresh parcel origin is saved; existing unbound parcel remains unresolved · preview never writes', async () => {
        dataState.scanHistory = [{ id: 'old1', phone: '0960007345', scanDate: '2026-10-05', isClosed: false, createdAt: 1,
            barcodes: [{ code: 'ZT0000000901', isClosed: false, cod: 1, dod: 0 }] }];
        vi.stubGlobal('fetch', listReply([row('ZT0000000901', 'Shopee SHPE'), row('ZT0000000902', 'ZTO ឃ្លាំងក្វាងចូវអន្តរជាតិ'), row('ZT0000000903')]));
        await runZtoListSyncPreview();
        expect(h.tx, '⛔ preview មិនសរសេរ').toEqual([]);
        expect(viewState.ztoListSyncNote, 'សំណើម្ចាស់គម្រោង ៖ មើលជាមុនគ្មាន emoji ភ្នែក').toMatch(/ · មើលជាមុន$/);
        expect(viewState.ztoListSyncNote).not.toContain('👁');
        await importZtoListRows();
        await settle();
        expect(h.saves.map((s) => s.barcode)).toEqual(['ZT0000000902', 'ZT0000000903']);
        expect(h.tx).toEqual([
            { path: 'zoew_scan_history_cod_dod/itZT0000000902', origins: { ZT0000000902: 'ZTO ឃ្លាំងក្វាងចូវអន្តរជាតិ' } }
        ]);
    });

    it('legacy existing-only origin remains unresolved without original binding · no confirmation', async () => {
        dataState.scanHistory = [{ id: 'old2', phone: '0960007345', scanDate: '2026-10-05', isClosed: false, createdAt: 1,
            barcodes: [{ code: 'ZT0000000911', isClosed: false, cod: 1, dod: 0 }] }];
        const asked: string[] = [];
        vi.stubGlobal('confirm', (q: string) => { asked.push(q); return true; });
        vi.stubGlobal('fetch', listReply([row('ZT0000000911', 'Shopee SHPE')]));
        await runZtoListSyncPreview();
        await importZtoListRows();
        expect(asked).toEqual([]);
        expect(h.tx).toHaveLength(0);
        expect((dataState.scanHistory[0] as any).origins).toBeUndefined();
        expect(uiState.toasts.map((t: any) => String(t && t.msg)).join(' | ')).toContain('មិនអាចផ្ទៀងប្រភព 1');
    });

    it('⛔ origin permission error after dispatch ➜ scan succeeds and outcome is unknown', async () => {
        h.reject = true;
        vi.stubGlobal('fetch', listReply([row('ZT0000000921', 'Shopee SHPE')]));
        await runZtoListSyncPreview();
        await importZtoListRows();
        await settle();
        expect(h.saves.map((s) => s.barcode)).toEqual(['ZT0000000921']);
        const toasts = uiState.toasts.map((t: any) => String(t && t.msg)).join(' | ');
        expect(toasts).toContain('✅ បញ្ចូល 1 កញ្ចប់');
        expect(toasts).toContain('⏳ លទ្ធផលប្រភពមិនទាន់ច្បាស់ 1');
        expect(h.tx).toEqual([]);
    });

    it('ទិសផ្ទុយ ៖ គ្មានប្រភពពី ZTO ➜ មិនសរសេរ', async () => {
        vi.stubGlobal('fetch', listReply([row('ZT0000000931')]));
        await runZtoListSyncPreview();
        await importZtoListRows();
        await settle();
        expect(h.saves).toHaveLength(1);
        expect(h.tx).toEqual([]);
    });
});
