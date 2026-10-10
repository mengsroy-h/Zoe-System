import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dataState, firebaseState, uiState } from '../src/core/state';
import { getServerNow } from '../src/core/clock';
import { dbListenerFailedPaths, dbListenerPendingPaths } from '../src/core/text';
import { clearHistory } from '../src/features/clear-history';
import { activeClearHistoryClaims } from '../src/ui/history-render';

// ⛔ «លុបទាំងអស់» ធាតុដែល id របស់វាត្រូវបានបង្កើតឡើងវិញ ខណៈ trash/<id> នៅកាន់ច្បាប់ចម្លងនៃជីវិតមុន ៖ ច្បាប់ RTDB ពិត
//    (`zoew_clear_history_finalizations/$itemId` ទាមទារ `!root.child('zoew_recently_deleted_cod_dod').child($itemId).exists()`) បដិសេធការ finalize
//    គ្រប់ដង ➜ កូដមុនកែ ៖ សរសេរបរាជ័យ ៣ ដង · «លុបមិនបានជោគជ័យ» · `clearClaim` នៅជាប់ (cleanup · ដក · លុប រំលងធាតុនោះ)។
//    ឥឡូវ ៖ ដោះ `clearClaim` ខ្លួនឯង ហើយលុបតាមផ្លូវ «លុប» ធម្មតា (slot ផ្លាស់) ➜ ច្បាប់ចម្លងចាស់នៅដដែល · ធាតុថ្មីចូលធុងសំរាម «លុប»។
const HISTORY = 'zoew_scan_history_cod_dod';
const TRASH = 'zoew_recently_deleted_cod_dod';
const FINAL = 'zoew_clear_history_finalizations';
const DAILY = 'zoew_daily_revenue_cod_dod';
const DAY = '2026-09-20';
const ID = 'id_1758000000000_old0x';
const ID2 = 'id_1758000000001_free0';
const HOST = 'https://shop.firebaseio.com';

const lab = { store: {} as Record<string, any>, rejects: [] as string[] };

function clone<T>(value: T): T {
    return value === undefined ? value : JSON.parse(JSON.stringify(value));
}
function split(path: string) {
    return String(path || '').split('/').filter(Boolean);
}
function getAt(path: string) {
    let cur: any = lab.store;
    for (const key of split(path)) {
        if (cur === null || cur === undefined || typeof cur !== 'object') return null;
        cur = cur[key];
    }
    return cur === undefined ? null : clone(cur);
}
function setAt(path: string, value: any) {
    const parts = split(path);
    let cur: any = lab.store;
    for (let i = 0; i < parts.length - 1; i++) {
        if (cur[parts[i]] === null || cur[parts[i]] === undefined || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
        cur = cur[parts[i]];
    }
    if (value === null || value === undefined) delete cur[parts[parts.length - 1]]; else cur[parts[parts.length - 1]] = clone(value);
}
function makeRef(path = '') {
    const p = split(path).join('/');
    return { path: p, key: split(p).pop() || null, toString: () => HOST + '/' + p };
}
function snap(ref: any, value: any) {
    return { key: ref && ref.key, ref, val: () => clone(value), exists: () => value !== null && value !== undefined };
}
function denied(where: string) {
    lab.rejects.push(where);
    return Promise.reject(Object.assign(new Error('permission_denied'), { code: 'PERMISSION_DENIED' }));
}
function historyDeleteAllowed(id: string, next: Record<string, any>) {
    const prior = getAt(HISTORY + '/' + id);
    if (!prior || !prior.clearClaim) return true;
    const witness = next[FINAL + '/' + id] !== undefined ? next[FINAL + '/' + id] : getAt(FINAL + '/' + id);
    return !!(witness && witness.token === prior.clearClaim.token);
}
function makeFb() {
    return {
        ref: (_db: any, path = '') => makeRef(path),
        get: async (ref: any) => snap(ref, getAt(ref.path)),
        update: async (ref: any, updates: any) => {
            const next: Record<string, any> = {};
            for (const key of Object.keys(updates)) next[[ref.path, key].filter(Boolean).join('/')] = updates[key];
            for (const path of Object.keys(next)) {
                const m = new RegExp('^' + FINAL + '/([^/]+)$').exec(path);
                if (m && next[path] !== null) {
                    const id = m[1];
                    const history = getAt(HISTORY + '/' + id);
                    const nextTrash = next[TRASH + '/' + id];
                    if (!history || !history.clearClaim || history.clearClaim.token !== next[path].token || getAt(TRASH + '/' + id)
                        || next[HISTORY + '/' + id] !== null || !nextTrash || nextTrash.id !== id || nextTrash.isFromDeletion !== true) return denied('finalize ' + id);
                }
                const h = new RegExp('^' + HISTORY + '/([^/]+)$').exec(path);
                if (h && next[path] === null && !historyDeleteAllowed(h[1], next)) return denied('history delete ' + h[1]);
            }
            for (const path of Object.keys(next)) setAt(path, next[path]);
        },
        runTransaction: async (ref: any, updater: any) => {
            const prior = getAt(ref.path);
            const proposed = updater(clone(prior));
            if (proposed === undefined) return { committed: false, snapshot: snap(ref, prior) };
            const h = new RegExp('^' + HISTORY + '/([^/]+)$').exec(ref.path);
            if (h && proposed === null && !historyDeleteAllowed(h[1], {})) return denied('history tx delete ' + h[1]);
            setAt(ref.path, proposed);
            return { committed: true, snapshot: snap(ref, getAt(ref.path)) };
        },
        onValue: () => () => {},
        off: () => {}
    };
}

function barcodeOf(code: string, cod: number, createdAt: number, deducted = false) {
    return { code, time: '08:00:00 (' + DAY + ')', cod, dod: 0, locker: 'N/A', isClosed: false, isDeducted: deducted, isFromDeletion: false, createdAt };
}
function itemOf(id: string, code: string, cod: number) {
    const now = getServerNow();
    const b = barcodeOf(code, cod, now - 3600000);
    return { id, phone: '012', scanDate: DAY, time: b.time, createdAt: b.createdAt, count: 1, cod, dod: 0, price: cod, isClosed: false, isCalled: false, barcode: code, barcodes: [b] };
}
function oldExpiredCopy() {
    const at = getServerNow() - 3 * 3600000;
    const a = barcodeOf('A', 10, at - 3600000, true);
    return { id: ID, phone: '012', scanDate: DAY, time: a.time, createdAt: a.createdAt, count: 1, cod: 10, dod: 0, price: 10, barcode: 'A', barcodes: [a],
        isClosed: false, deletedAt: at, isFromDeletion: false, trashReason: 'expired' };
}
function install(items: any[], trash: Record<string, any>) {
    lab.store = {
        [HISTORY]: Object.fromEntries(items.map((it) => [it.id, clone(it)])),
        [TRASH]: clone(trash),
        [DAILY]: { [DAY]: { codDollar: 100, dodDollar: 0, totalCount: 10 } }
    };
    firebaseState.db = { name: 'test-db' } as any;
    firebaseState.fb = makeFb() as any;
    firebaseState.firebaseConfig = { databaseURL: HOST } as any;
    firebaseState.isDatabaseInitialized = true;
    firebaseState.isDatabaseConnected = true;
    firebaseState.serverClockTrusted = true;
    firebaseState.dbRefHistory = makeRef(HISTORY) as any;
    firebaseState.dbRefDeleted = makeRef(TRASH) as any;
    dataState.scanHistory = items.map((it) => clone(it));
    dataState.deletedItems = Object.values(clone(trash));
    uiState.currentFilterMode = 'all';
}
const trashCopiesOf = (code: string): any[] => Object.values(getAt(TRASH) || {}).filter((t: any) => t && Array.isArray(t.barcodes) && t.barcodes.some((b: any) => b && b.code === code));
const claimsLeft = () => Object.values(getAt(HISTORY) || {}).filter((it: any) => it && it.clearClaim).length;
const toastTexts = () => (uiState.toasts || []).map((t: any) => String(t && t.msg || t));

beforeEach(() => {
    lab.rejects = [];
    uiState.toasts = [];
    dataState.clearHistoryInFlight = false;
    activeClearHistoryClaims.clear();
    dbListenerPendingPaths.clear();
    dbListenerFailedPaths.clear();
    (window as any).ZoeErrors = { capture: vi.fn() };
    vi.stubGlobal('confirm', () => true);
    firebaseState.authGeneration++;
});

afterEach(() => {
    vi.unstubAllGlobals();
    delete (window as any).ZoeErrors;
});

describe('«លុបទាំងអស់» ៖ slot ធុងសំរាមរបស់ id កាន់ជីវិតមុន', () => {
    it('១. trash/<id> = ច្បាប់ចម្លង «ផុតកំណត់» ចាស់ ➜ ធាតុថ្មីចូលធុងសំរាម «លុប» ក្បែរវា · ច្បាប់ចម្លងចាស់នៅដដែល · គ្មាន clearClaim · ✅', async () => {
        const old = oldExpiredCopy();
        install([itemOf(ID, 'C', 7)], { [ID]: old });
        await clearHistory();
        expect(getAt(HISTORY + '/' + ID)).toBeNull();
        expect(getAt(TRASH + '/' + ID)).toEqual(old);
        const copies = trashCopiesOf('C');
        expect(copies.length).toBe(1);
        expect(copies[0].id).not.toBe(ID);
        expect(copies[0].trashReason).toBe('delete');
        expect(copies[0].isFromDeletion).toBe(true);
        expect(copies[0].barcodes[0].isFromDeletion).toBe(true);
        expect(copies[0].clearClaim).toBeUndefined();
        expect(claimsLeft()).toBe(0);
        expect(activeClearHistoryClaims.size).toBe(0);
        expect(getAt(FINAL)).toBeNull();
        expect(getAt(DAILY + '/' + DAY).codDollar).toBe(100);
        expect(toastTexts().some((t) => t.startsWith('✅ បានលុបទិន្នន័យ'))).toBe(true);
        expect(toastTexts().some((t) => t.startsWith('✅ បានលុបទៅធុងសំរាម'))).toBe(false);
    }, 30000);

    it('២. ធាតុពីរ ៖ មួយ slot ជាប់ · មួយ slot ទំនេរ ➜ លុបទាំងពីរ · slot ទំនេរនៅតាមផ្លូវ finalize (trash/<id> ផ្ទាល់)', async () => {
        const old = oldExpiredCopy();
        install([itemOf(ID, 'C', 7), itemOf(ID2, 'E', 4)], { [ID]: old });
        await clearHistory();
        expect(Object.keys(getAt(HISTORY) || {})).toEqual([]);
        expect(getAt(TRASH + '/' + ID)).toEqual(old);
        expect(getAt(TRASH + '/' + ID2).trashReason).toBe('delete');
        expect(trashCopiesOf('C').length).toBe(1);
        expect(claimsLeft()).toBe(0);
        expect(toastTexts().some((t) => t.indexOf('ចំនួន 2 ធាតុ') !== -1)).toBe(true);
    }, 30000);

    it('៣. ទិសផ្ទុយ ៖ slot ទំនេរ ➜ ផ្លូវ finalize ដើម (គ្មានការបដិសេធ · trash/<id>)', async () => {
        install([itemOf(ID, 'C', 7)], {});
        await clearHistory();
        expect(lab.rejects).toEqual([]);
        expect(getAt(HISTORY + '/' + ID)).toBeNull();
        expect(getAt(TRASH + '/' + ID).trashReason).toBe('delete');
        expect(trashCopiesOf('C').length).toBe(1);
    }, 30000);
});
