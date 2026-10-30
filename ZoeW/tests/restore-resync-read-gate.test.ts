// A failed restore re-reads history and trash from the server and replaces the local views. That read is a second reader of the
// same roots as the listeners, so it must pass through the same read gate (`rawSnapshotToItemList()` · A411): a record without a
// barcode list never enters the views, ids come from the keys, and barcodes are normalized to an array.
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { appLocalStore } from '../src/core/storage';
import { dataState, firebaseState, uiState } from '../src/core/state';
import { executeRestoreItem } from '../src/features/restore';

const H = 'zoew_scan_history_cod_dod';
const T = 'zoew_recently_deleted_cod_dod';
let server: Record<string, any> = {};
let captured: any[] = [];

const clone = (v: any) => (v === undefined ? null : JSON.parse(JSON.stringify(v)));
const at = (path: string) => path.split('/').reduce((node: any, key) => (node == null ? undefined : node[key]), server);

beforeEach(() => {
    appLocalStore.clear();
    appLocalStore.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: 'https://restore-resync.firebaseio.com' }));
    firebaseState.auth = { currentUser: { uid: 'resync-member' } } as any;
    captured = [];
    vi.stubGlobal('alert', vi.fn());
    (window as any).ZoeErrors = { capture: (error: Error, extra: any) => captured.push({ message: error.message, ...extra }) };
    server = {
        [H]: {
            good: { phone: '012000111', scanDate: '2026-10-20', createdAt: 1, barcodes: { 0: { code: 'G1', cod: 3, dod: 1, isDeducted: false } } },
            bare: { phone: '012000222', scanDate: '2026-10-20', createdAt: 1, barcode: 'L1', cod: 5, dod: 0, isClosed: false }
        },
        [T]: {
            kept: { phone: '012000333', scanDate: '2026-10-20', createdAt: 1, trashReason: 'delete', barcodes: [{ code: 'K1', cod: 2, dod: 0 }] },
            bareTrash: { phone: '012000444', scanDate: '2026-10-20', createdAt: 1, barcode: 'O1', cod: 1 }
        }
    };
    dataState.scanHistory = [];
    dataState.deletedItems = [];
    firebaseState.db = { name: 'resync-db' } as any;
    firebaseState.dbRefHistory = { path: H } as any;
    firebaseState.dbRefDeleted = { path: T } as any;
    firebaseState.fb = {
        ref: (_db: unknown, path: string) => ({ path }),
        get: async (ref: any) => {
            const value = clone(at(ref.path));
            return { exists: () => value !== null, val: () => value };
        }
    } as any;
    uiState.pendingRestoreId = 'gone';
});

afterEach(() => {
    vi.unstubAllGlobals();
    delete (window as any).ZoeErrors;
    dataState.scanHistory = [];
    dataState.deletedItems = [];
    firebaseState.auth = null as any;
    firebaseState.db = null as any;
    firebaseState.fb = null as any;
    firebaseState.dbRefHistory = null as any;
    firebaseState.dbRefDeleted = null as any;
    appLocalStore.clear();
});

it('ការស្តារបរាជ័យ ➜ អានឡើងវិញឆ្លងច្រកអានរួម ៖ កំណត់ត្រាគ្មាន barcodes មិនចូលទិដ្ឋភាព · id ពីកូនសោ · barcodes ជា array', async () => {
    await executeRestoreItem();
    expect(dataState.scanHistory.map((item: any) => item.id)).toEqual(['good']);
    expect(dataState.deletedItems.map((item: any) => item.id)).toEqual(['kept']);
    expect(Array.isArray((dataState.scanHistory[0] as any).barcodes)).toBe(true);
    expect((dataState.scanHistory[0] as any).barcodes.map((b: any) => b.code)).toEqual(['G1']);
    expect(captured.filter((event) => event.message === 'Skipped records without barcodes in snapshot').map((event) => event.context))
        .toEqual(['rawSnapshotToItemList history', 'rawSnapshotToItemList deleted']);
    expect(window.alert).toHaveBeenCalledTimes(1);
});

it('control ៖ ទិដ្ឋភាពដែល listener ប្តូររួចកំពុងអាន មិនត្រូវសរសេរជាន់', async () => {
    const live = [{ id: 'live', barcodes: [{ code: 'Z1' }] }];
    const get = firebaseState.fb.get;
    (firebaseState.fb as any).get = async (ref: any) => {
        if (ref.path === H) dataState.scanHistory = live as any;
        return get(ref);
    };
    await executeRestoreItem();
    expect(dataState.scanHistory).toBe(live);
    expect(dataState.deletedItems.map((item: any) => item.id)).toEqual(['kept']);
});
