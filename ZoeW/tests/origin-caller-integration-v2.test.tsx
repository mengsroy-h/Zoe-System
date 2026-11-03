import { createScanMemorySdk } from './helpers/scan-memory-sdk';
/**
 * ⛔ ប្រភពកញ្ចប់ ៖ ការ «បញ្ចូល» បញ្ជី ZTO ទុកប្រភព (`from` = `recSite`) ចូលប្រវត្តិ (`<id>/origins/<key>`) — កញ្ចប់ថ្មីដែលរក្សាទុកបាន
 * និងកញ្ចប់ដែលមានក្នុង ZoeW រួច (បំពេញ) · ការសរសេរប្រភពដាច់ពីការរក្សាទុកកញ្ចប់ ➜ rules ចាស់បដិសេធ ➜ ការបញ្ចូលនៅជោគជ័យដដែល ·
 * ⛔ ការមើលបញ្ជី (preview) មិនសរសេរអ្វីទាំងអស់។
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { refTo } from '../src/app/refs';
import { dataState, firebaseState, uiState, ztoState } from '../src/core/state';
import { viewState } from '../src/core/view-state';
import { appLocalStore } from '../src/core/storage';
import { clearCustomerDataTableCache } from '../src/features/customer-table';
import { importZtoListRows } from '../src/features/zto-list-sync';
import { clearZtoPickupStatusStore } from '../src/features/zto-status';

const h = vi.hoisted(() => ({ saves: [] as any[], tx: [] as any[], reject: false, probe: '', staged: null as any, op: null as any, holdOrigin: false, resumeOrigin: null as any, started: [] as string[], saveDeferred: null as any }));
const origin = vi.hoisted(() => ({captures: [] as any[], batches: [] as any[], mode: 'normal', result: {applied:0,unchanged:0,unresolved:0,unknown:0}, deferred: null as any}));
vi.mock('../src/features/barcode-origin', async (importOriginal) => ({
    ...(await importOriginal() as any),
    originText: (v: any) => typeof v === 'string' ? v.trim() : '',
    makeFreshOriginEntry: (code: string, from: string, handle: any, sessionCurrent: any) => {
        origin.captures.push({code, from, id: handle?.record?.id, birth: handle?.record?.createdAt, sessionCurrent});
        if (origin.mode === 'throw') throw new Error('synthetic capture failure');
        if (origin.mode === 'null') return null;
        return {code, from, binding: {id: handle?.record?.id, birth: handle?.record?.createdAt}};
    },
    saveBarcodeOrigins: (entries: any[]) => { origin.batches.push(entries); return origin.deferred || Promise.resolve(origin.result); }
}));
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
        if (h.saveDeferred) return await h.saveDeferred;
        const item: any = { id: 'it' + barcode, phone, scanDate: '2026-10-05', isClosed: false,
            createdAt: 1, barcodes: [{ code: barcode, isClosed: false, cod, dod, createdAt: 1 }] };
        if (h.probe) {
            h.op = { id: handle?.record?.id, scope: handle?.record?.scope, barcode: handle?.record?.barcode, birth: handle?.record?.createdAt };
            item.createdAt = stampMs;
            item.barcodes[0].createdAt = stampMs;
            item.barcodes[0].scanIntent = handle.record.id;
        }
        if (h.probe === 'locked') item.scanPending = { intent: handle.record.id };
        if (h.probe === 'absent') h.staged = item;
        else dataState.scanHistory = dataState.scanHistory.concat([item]);
        return true;
    }
}));

const NOW = Date.UTC(2026, 9, 6, 3, 0, 0);
const row = (barcode: string, from?: string) => ({ barcode, phone: '0960007345', cod: 2.5, dod: 0, at: '2026-10-05 09:00:00',
    ztoClosed: null, skip: '', from });

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(NOW));
    appLocalStore.clear();
    appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify({ enabled: true, fastMode: true,
        url: window.location.origin + '/.netlify/functions/zto-order-detail?barcode={barcode}' }));
    appLocalStore.setItem('zoew_zto_listsync_v1', '1');
    clearCustomerDataTableCache();
    clearZtoPickupStatusStore();
    origin.captures.length = 0; origin.batches.length = 0; origin.mode = 'normal'; origin.result = {applied:0,unchanged:0,unresolved:0,unknown:0}; origin.deferred = null;
    h.saves.length = 0;
    h.saveDeferred = null;
    h.tx.length = 0;
    h.reject = false;
    h.probe = '';
    h.staged = null;
    h.op = null;
    h.holdOrigin = false;
    h.resumeOrigin = null;
    h.started.length = 0;
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
            return { committed: true };
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


const toastText = () => uiState.toasts.map((t:any) => String(t?.msg || '')).join(' | ');
function preview(rows: any[], palm = false, signedRows: any[] = []) {
    ztoState.ztoListSyncResult = {rows, signedRows, palm, verifiedAt: NOW, verifiedServerAt: NOW, from:'2026-10-03', to:'2026-10-06'} as any;
}
describe('actual import caller: original origin identity and outcomes', () => {
    for (const palm of [false, true]) {
        it(`${palm ? 'Palm' : 'Cookie'} fresh scan forwards its original handle`, async () => {
            h.probe = 'identity';
            preview([row('SYNTH001','synthetic-origin')],palm);
            await importZtoListRows(); await settle();
            expect(h.saves).toHaveLength(1);
            expect(origin.captures).toHaveLength(1);
            expect(origin.captures[0]).toEqual(expect.objectContaining({code:'SYNTH001', id:h.op.id, birth:h.op.birth, sessionCurrent:expect.any(Function)}));
            expect(origin.batches[0]).toEqual([expect.objectContaining({code:'SYNTH001',binding:expect.objectContaining({id:h.op.id,birth:h.op.birth})})]);
        });
        it(`${palm ? 'Palm' : 'Cookie'} signed fresh scan retains original identity`, async () => {
            h.probe = 'identity';
            preview([{...row('SYNTH007','synthetic-origin'), ztoClosed:true}],palm);
            await importZtoListRows(); await settle();
            expect(h.saves).toHaveLength(1);
            expect(origin.captures[0]).toEqual(expect.objectContaining({id:h.op.id,birth:h.op.birth}));
            expect(origin.batches[0]).toEqual([expect.objectContaining({binding:expect.objectContaining({id:h.op.id,birth:h.op.birth})})]);
        });
    }
    for (const mode of ['throw','null']) {
        it(`optional binding helper ${mode} leaves successful scan intact and reports unbound origin`, async () => {
            origin.mode = mode; origin.result.unresolved = 1;
            preview([row('SYNTH002','synthetic-origin')]);
            await importZtoListRows(); await settle();
            expect(h.saves).toHaveLength(1);
            expect(dataState.scanHistory).toHaveLength(1);
            expect(origin.batches[0]).toEqual([{code:'SYNTH002',from:'synthetic-origin'}]);
            expect(toastText()).toContain('លទ្ធផលប្រភពពីការនាំចូល៖');
        });
    }
    it('existing-only unbound origin reports unresolved rather than no new parcels', async () => {
        dataState.scanHistory = [{id:'old',phone:'0960007345',scanDate:'2026-10-05',createdAt:1,isClosed:false,barcodes:[{code:'SYNTH003',cod:1,dod:0}]}] as any;
        origin.result.unresolved=1;
        preview([row('SYNTH003','synthetic-origin')]);
        await importZtoListRows(); await settle();
        expect(h.saves).toHaveLength(0);
        expect(origin.batches[0]).toEqual([{code:'SYNTH003',from:'synthetic-origin'}]);
        expect(toastText()).not.toContain('គ្មានកញ្ចប់ថ្មីត្រូវបញ្ចូលទេ');
        expect(toastText()).toContain('មិនអាចផ្ទៀងប្រភព 1');
    });
    it('blank origin produces no origin report', async () => {
        preview([row('SYNTH004','')]);
        await importZtoListRows(); await settle();
        expect(h.saves).toHaveLength(1);
        expect(origin.batches[0]).toEqual([]);
        expect(toastText()).not.toContain('លទ្ធផលប្រភពពីការនាំចូល៖');
    });
    it('post-dispatch session switch does not show stale result', async () => {
        let resolve!: (v:any)=>void;
        origin.deferred=new Promise(r=>{resolve=r});
        preview([row('SYNTH005','synthetic-origin')]);
        await importZtoListRows();
        firebaseState.authGeneration++;
        resolve({applied:0,unchanged:0,unresolved:0,unknown:1}); await settle();
        expect(toastText()).not.toContain('លទ្ធផលប្រភពពីការនាំចូល៖');
    });
    it('same-session unknown is reported without changing immediate scan success', async () => {
        origin.result.unknown=1;
        preview([row('SYNTH006','synthetic-origin')]);
        await importZtoListRows(); await settle();
        expect(h.saves).toHaveLength(1);
        expect(toastText()).toContain('✅ បញ្ចូល 1 កញ្ចប់');
        expect(toastText()).toContain('លទ្ធផលប្រភពពីការនាំចូល៖');
        expect(toastText()).toContain('មិនទាន់ច្បាស់');
    });
    for (const status of ['unresolved','unknown']) {
        it(`${status} reports the uncertainty while clearing the stale signed preview`, async () => {
            origin.result[status]=1;
            preview([{...row('SYNTH009','synthetic-origin'), ztoClosed:true}]);
            await importZtoListRows(); await settle();
            expect(h.saves).toHaveLength(1);
            expect(ztoState.ztoListSyncResult).toBeNull();
            expect(toastText()).toContain('លទ្ធផលប្រភពពីការនាំចូល៖');
            dataState.scanHistory=[];
            await importZtoListRows();
            expect(h.saves).toHaveLength(1);
        });
    }
    it('clears the completed signed preview even while origin outcome is pending', async () => {
        let resolve!: (v:any)=>void;
        origin.deferred=new Promise(r=>{resolve=r});
        preview([{...row('SYNTH015','synthetic-origin'),ztoClosed:true}]);
        await importZtoListRows();
        expect(ztoState.ztoListSyncResult).toBeNull();
        dataState.scanHistory=[];
        await importZtoListRows();
        expect(h.saves).toHaveLength(1);
        resolve({applied:0,unchanged:0,unresolved:0,unknown:1}); await settle();
        expect(toastText()).toContain('មិនទាន់ច្បាស់');
    });
    it('a freshly pulled preview can be imported after an earlier unknown', async () => {
        origin.result.unknown=1;
        preview([row('SYNTH018','synthetic-origin')]);
        await importZtoListRows(); await settle();
        preview([row('SYNTH019','synthetic-origin')]);
        await importZtoListRows(); await settle();
        expect(h.saves.map(s=>s.barcode)).toEqual(['SYNTH018','SYNTH019']);
    });
    it.each(['throw','malformed'])('origin %s reports uncertainty and clears stale preview', async(mode)=>{
        if (mode==='throw') { origin.deferred=Promise.reject(new Error('synthetic')); origin.deferred.catch(()=>{}); }
        else origin.deferred=Promise.resolve(null);
        preview([row('SYNTH016','synthetic-origin')]);
        await importZtoListRows(); await settle();
        expect(ztoState.ztoListSyncResult).toBeNull();
        expect(toastText()).toContain('មិនទាន់ច្បាស់');
    });
    it('confirmed origin success clears only its own completed preview', async () => {
        origin.result.applied=1;
        preview([row('SYNTH010','synthetic-origin')]);
        await importZtoListRows(); await settle();
        expect(ztoState.ztoListSyncResult).toBeNull();
    });
    it('late success cannot clear a newer preview', async () => {
        let resolve!: (v:any)=>void;
        origin.deferred=new Promise(r=>{resolve=r});
        preview([row('SYNTH011','synthetic-origin')]);
        await importZtoListRows();
        preview([row('SYNTH012','synthetic-origin')]);
        const newer=ztoState.ztoListSyncResult;
        resolve({applied:1,unchanged:0,unresolved:0,unknown:0}); await settle();
        expect(ztoState.ztoListSyncResult).toBe(newer);
    });
    it('canceling a later import does not hide the earlier unknown outcome', async () => {
        let resolve!: (v:any)=>void;
        origin.deferred=new Promise(r=>{resolve=r});
        preview([row('SYNTH013','synthetic-origin')]);
        await importZtoListRows();
        preview([row('SYNTH014','synthetic-origin')]);
        const newer=ztoState.ztoListSyncResult;
        vi.stubGlobal('confirm', () => false);
        await importZtoListRows();
        resolve({applied:0,unchanged:0,unresolved:0,unknown:1}); await settle();
        expect(ztoState.ztoListSyncResult).toBe(newer);
        expect(toastText()).toContain('លទ្ធផលប្រភពពីការនាំចូល៖');
        expect(toastText()).toContain('មិនទាន់ច្បាស់');
    });
    it('an earlier origin result cannot append to a later import with the same note text', async () => {
        let resolveFirst!: (v:any)=>void, resolveSecond!: (v:any)=>void;
        origin.deferred=new Promise(r=>{resolveFirst=r});
        preview([row('SYNTH022','synthetic-origin')]);
        await importZtoListRows();
        const firstNote=viewState.ztoListSyncNote;
        origin.deferred=new Promise(r=>{resolveSecond=r});
        preview([row('SYNTH023','synthetic-origin')]);
        await importZtoListRows();
        expect(viewState.ztoListSyncNote).toBe(firstNote);
        resolveFirst({applied:0,unchanged:0,unresolved:0,unknown:1}); await settle();
        expect(viewState.ztoListSyncNote).toBe(firstNote);
        expect(toastText()).toContain('លទ្ធផលប្រភពពីការនាំចូល៖');
        resolveSecond({applied:1,unchanged:0,unresolved:0,unknown:0}); await settle();
    });
    it('late scan-save timeout reports origin as unknown', async () => {
        vi.useFakeTimers();
        let resolve!: (v:any)=>void;
        h.saveDeferred=new Promise(r=>{resolve=r});
        preview([row('SYNTH008','synthetic-origin')]);
        const pending=importZtoListRows();
        await vi.advanceTimersByTimeAsync(15001);
        await pending; await settle();
        expect(h.saves).toHaveLength(1);
        expect(toastText()).toContain('មិនទាន់ច្បាស់');
        resolve(true); await settle();
    });
    it('an interrupted import with an untried row retains its existing preview', async () => {
        vi.useFakeTimers();
        let resolve!: (v:any)=>void;
        h.saveDeferred=new Promise(r=>{resolve=r});
        preview([row('SYNTH020','synthetic-origin'),row('SYNTH021','synthetic-origin')]);
        const original=ztoState.ztoListSyncResult;
        const pending=importZtoListRows();
        await vi.advanceTimersByTimeAsync(15001);
        await pending; await settle();
        expect(h.saves).toHaveLength(1);
        expect(ztoState.ztoListSyncResult).toBe(original);
        expect(toastText()).toContain('មិនទាន់បញ្ចូល 1');
        resolve(true); await settle();
    });
});
