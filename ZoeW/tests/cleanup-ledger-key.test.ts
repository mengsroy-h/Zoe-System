/**
 * ⛔ Task #16 (KC-15) ៖ ការដកលុយនៃការសម្អាត ៧ ថ្ងៃ (`expired`) ត្រូវចុះ **តែម្តង** ទោះ App ស្លាប់ពាក់កណ្តាលការដក (reload · deploy)។
 *    ហាង KC-15 ៖ ការដក ៣ កញ្ចប់ត្រូវកាត់នៅ stage `ledger` ➜ ការស្តារពី journal រាយការណ៍ «unverified» ហើយមិនដក ➜ «ស្កេនតាមថ្ងៃ» ≠ យករួច + នៅសល់។
 *    ច្បាប់ ៖ ការដកជា transaction ២ ជំហាន (ខែ ➜ ថ្ងៃ) ដែលផ្ទុក token កំណត់ពី (trashId · deletedAt) ក្នុង ring `ops` · ថ្ងៃផ្ទុកសោ
 *    `ded/<trashId>` ➜ ការរត់ម្តងទៀត (journal · tab ផ្សេង) ឃើញសោ/token ➜ «រួចហើយ» · token ដែលមានមុនការដកនៅតែមាន ➜ មិនទាន់ចុះ ➜ ដក ·
 *    សម្រេចមិនបាន ➜ មិនប៉ះលុយ + ប្រាប់។ សោក៏ជាភស្តុតាងសម្រាប់ការស្តារ (បូកវិញតាមសោ) និងអ្នកបោសសម្អាតធុងសំរាម (flip ពេលគ្មាន journal)។
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dataState, firebaseState, uiState } from '../src/core/state';
import { getServerNow } from '../src/core/clock';
import { CLEANUP_JOURNAL_KEY } from '../src/core/storage-keys';
import { dbListenerFailedPaths, dbListenerPendingPaths } from '../src/core/text';
import { claimAndCleanupItem, cleanupInFlight, cleanupJournalLive, readCleanupJournal, resumeCleanupJournalEntry, runScheduledCleanup } from '../src/domain/cleanup';
import { activeRestoreClaims, executeRestoreItem } from '../src/features/restore';
import { ABANDON_AGE_MS } from '../src/features/session';

const HISTORY = 'zoew_scan_history_cod_dod';
const TRASH = 'zoew_recently_deleted_cod_dod';
const DAILY = 'zoew_daily_revenue_cod_dod';
const MONTHLY = 'zoew_monthly_revenue_cod_dod';
const DAY = '2026-09-20';
const MONTH = '2026-09';
const ID = 'id_x';
const HOST = 'https://shop.firebaseio.com';

type Mode = 'hang' | 'applyHang' | 'reject' | 'rejectDed' | 'rejectDedApplyHang' | 'rejectRing';
type Kind = 'daily' | 'monthly' | 'flip';
const lab = {
    store: {} as Record<string, any>,
    plan: {} as Partial<Record<Kind, Mode>>,
    beforeTx: null as ((path: string) => void) | null
};

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
function prune(node: any): any {
    if (node === null || node === undefined) return null;
    if (typeof node !== 'object') return node;
    const out: any = Array.isArray(node) ? [] : {};
    let keys = 0;
    for (const key of Object.keys(node)) {
        const value = prune(node[key]);
        if (value === null || value === undefined) continue;
        out[key] = value;
        keys++;
    }
    return keys ? out : null;
}
function setAt(path: string, value: any) {
    const parts = split(path);
    if (!parts.length) { lab.store = prune(clone(value)) || {}; return; }
    let cur: any = lab.store;
    for (let i = 0; i < parts.length - 1; i++) {
        if (cur[parts[i]] === null || cur[parts[i]] === undefined || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
        cur = cur[parts[i]];
    }
    const next = prune(clone(value));
    if (next === null) delete cur[parts[parts.length - 1]]; else cur[parts[parts.length - 1]] = next;
    lab.store = prune(lab.store) || {};
}
const INC = '__inc__';
function makeRef(path = '') {
    const p = split(path).join('/');
    return { path: p, key: split(p).pop() || null, toString: () => HOST + '/' + p };
}
function snap(ref: any, value: any) {
    return { key: ref && ref.key, ref, val: () => clone(value), exists: () => value !== null && value !== undefined };
}
const denied = () => Promise.reject(Object.assign(new Error('PERMISSION_DENIED: Permission denied'), { code: 'PERMISSION_DENIED' }));
const hung = () => new Promise(() => {});
function kindOf(path: string): Kind | null {
    if (path === MONTHLY) return 'monthly';
    if (path.startsWith(DAILY + '/')) return 'daily';
    if (path.startsWith(TRASH + '/') && journalStage() === 'flip') return 'flip';
    return null;
}
function carriesDed(proposed: any) {
    return !!(proposed && typeof proposed === 'object' && proposed.ded);
}
function carriesRing(path: string, proposed: any) {
    if (!proposed || typeof proposed !== 'object') return false;
    if (path === MONTHLY) return Object.values(proposed).some((m: any) => m && typeof m === 'object' && m.ops);
    return !!proposed.ops;
}
function makeFb() {
    return {
        ref: (_db: any, path = '') => makeRef(path),
        increment: (n: number) => ({ [INC]: n }),
        get: async (ref: any) => snap(ref, getAt(ref.path)),
        update: async (ref: any, updates: any) => {
            for (const key of Object.keys(updates)) {
                const path = [ref.path, key].filter(Boolean).join('/');
                let value = updates[key];
                if (value && typeof value === 'object' && value[INC] !== undefined) value = (Number(getAt(path)) || 0) + value[INC];
                setAt(path, value);
            }
        },
        set: async (ref: any, value: any) => { setAt(ref.path, value); },
        runTransaction: async (ref: any, updater: any) => {
            if (lab.beforeTx) lab.beforeTx(ref.path);
            const prior = getAt(ref.path);
            const proposed = updater(clone(prior));
            if (proposed === undefined) return { committed: false, snapshot: snap(ref, prior) };
            const apply = () => setAt(ref.path, proposed);
            const kind = kindOf(ref.path);
            const mode = kind ? lab.plan[kind] : undefined;
            if (mode === 'hang') return hung();
            if (mode === 'applyHang') { apply(); return hung(); }
            if (mode === 'reject') return denied();
            if (mode === 'rejectDed' && carriesDed(proposed)) return denied();
            if (mode === 'rejectDedApplyHang') {
                if (carriesDed(proposed)) return denied();
                apply();
                return hung();
            }
            if (mode === 'rejectRing' && carriesRing(ref.path, proposed)) return denied();
            apply();
            return { committed: true, snapshot: snap(ref, getAt(ref.path)) };
        },
        onValue: () => () => {},
        off: () => {}
    };
}
const flush = async (n = 60) => { for (let i = 0; i < n; i++) await new Promise((resolve) => setTimeout(resolve, 0)); };

function barcode(code: string, cod: number, createdAt: number) {
    return { code, time: '08:00:00 (' + DAY + ')', cod, dod: 0, locker: 'N/A', isClosed: false, isDeducted: false, isFromDeletion: false, createdAt };
}
function seed(items: any[]) {
    lab.store = {
        [HISTORY]: Object.fromEntries(items.map((it) => [it.id, clone(it)])),
        [TRASH]: {},
        [DAILY]: { [DAY]: { codDollar: 100, dodDollar: 0, totalCount: 10, op: 'op_seeddaily01', ops: { op_seeddaily01: 1 } } },
        [MONTHLY]: { [MONTH]: { codDollar: 100, dodDollar: 0, totalCount: 10, op: 'op_seedmonth01', ops: { op_seedmonth01: 1 } } }
    };
    firebaseState.db = { name: 'test-db' } as any;
    firebaseState.fb = makeFb() as any;
    firebaseState.firebaseConfig = { databaseURL: HOST } as any;
    firebaseState.auth = { currentUser: { uid: 'u1', getIdToken: async () => 'tok' } } as any;
    firebaseState.isDatabaseInitialized = true;
    firebaseState.isDatabaseConnected = true;
    firebaseState.serverClockTrusted = true;
    firebaseState.hasEverConnectedToDatabase = true;
    firebaseState.dbListenersFailed = false;
    firebaseState.serverTimeOffsetMs = 0;
    firebaseState.dbRefHistory = makeRef(HISTORY) as any;
    firebaseState.dbRefDeleted = makeRef(TRASH) as any;
    firebaseState.dbRefDailyRevenue = makeRef(DAILY) as any;
    firebaseState.dbRefMonthlyRevenue = makeRef(MONTHLY) as any;
    firebaseState.dbRefDailyPickup = makeRef('zoew_daily_pickup_cod_dod') as any;
    firebaseState.dbRefDailyCollected = makeRef('zoew_daily_collected_cod_dod') as any;
    dataState.scanHistory = items.map((it) => clone(it));
    dataState.deletedItems = [];
    dataState.dailyRevenueData = clone(lab.store[DAILY]);
    dataState.monthlyRevenueData = clone(lab.store[MONTHLY]);
    dataState.dailyPickupData = {};
    dataState.dailyCollectedData = {};
}
function expiredItem(id = ID, cod = 10) {
    const old = getServerNow() - ABANDON_AGE_MS - 3600000;
    const a = barcode('A', cod, old);
    return { id, phone: '012', scanDate: DAY, time: a.time, createdAt: old, count: 1, cod, dod: 0, price: cod, isClosed: false, isCalled: false, barcode: 'A', barcodes: [a] };
}
function syncLocalViewsFromServer() {
    dataState.scanHistory = Object.values(getAt(HISTORY) || {}).map((v: any) => clone(v));
    dataState.deletedItems = Object.values(getAt(TRASH) || {}).map((v: any) => clone(v));
    dataState.dailyRevenueData = clone(getAt(DAILY) || {});
    dataState.monthlyRevenueData = clone(getAt(MONTHLY) || {});
}
function reloadPage() {
    lab.plan = {};
    lab.beforeTx = null;
    firebaseState.authGeneration++;
    cleanupInFlight.clear();
    cleanupJournalLive.clear();
    dataState.cleanupResumeInFlight = false;
    syncLocalViewsFromServer();
}
async function restoreOnOtherDevice(trashId: string) {
    syncLocalViewsFromServer();
    uiState.pendingRestoreId = trashId;
    await executeRestoreItem();
    await flush();
}
const ledger = () => getAt(DAILY + '/' + DAY) || {};
const month = () => getAt(MONTHLY + '/' + MONTH) || {};
const money = () => ({ day: [ledger().codDollar, ledger().totalCount], month: [month().codDollar, month().totalCount] });
const journalStage = () => (readCleanupJournal()[0] || {}).stage;
const trashFlags = (id = ID) => ((getAt(TRASH + '/' + id) || {}).barcodes || []).map((b: any) => b.isDeducted);

beforeEach(() => {
    lab.plan = {};
    lab.beforeTx = null;
    uiState.toasts = [];
    try { localStorage.clear(); } catch {}
    cleanupInFlight.clear();
    cleanupJournalLive.clear();
    activeRestoreClaims.clear();
    dbListenerPendingPaths.clear();
    dbListenerFailedPaths.clear();
    dataState.cleanupResumeInFlight = false;
    (window as any).ZoeErrors = { capture: vi.fn() };
    vi.stubGlobal('confirm', () => true);
    firebaseState.authGeneration++;
});

afterEach(() => {
    vi.unstubAllGlobals();
    delete (window as any).ZoeErrors;
});

async function cutAtLedger(plan: Partial<Record<Kind, Mode>>) {
    seed([expiredItem()]);
    lab.plan = plan;
    claimAndCleanupItem(ID, 'abandon');
    await flush();
    expect(journalStage()).toBe('ledger');
    expect(trashFlags()).toEqual([false]);
    const raw = localStorage.getItem(CLEANUP_JOURNAL_KEY) as string;
    reloadPage();
    return raw;
}

describe('KC-15 ៖ App ស្លាប់ពាក់កណ្តាលការដក (stage ledger) ➜ ការស្តារបញ្ចប់ការដកតែម្តង', () => {
    it('១. ការដកមិនដល់ server សោះ (KC-15 ពិត) ➜ ការស្តារដក ១០ (ថ្ងៃ · ខែ) · flip · journal ទទេ · គ្មាន «unverified»', async () => {
        await cutAtLedger({ daily: 'hang', monthly: 'hang' });
        expect(money()).toEqual({ day: [100, 10], month: [100, 10] });
        const outcome = await resumeCleanupJournalEntry(ID);
        await flush();
        expect(outcome).not.toBe('unverified');
        expect(money()).toEqual({ day: [90, 9], month: [90, 9] });
        expect(trashFlags()).toEqual([true]);
        expect(readCleanupJournal().length).toBe(0);
    }, 20000);

    it('២ក. ខែចុង · ថ្ងៃចុះតែចម្លើយបាត់ ➜ ការស្តារមិនដកលើកទី ២ (៩០ មិនមែន ៨០) · flip', async () => {
        await cutAtLedger({ daily: 'applyHang' });
        expect(money()).toEqual({ day: [90, 9], month: [90, 9] });
        const outcome = await resumeCleanupJournalEntry(ID);
        await flush();
        expect(outcome).not.toBe('unverified');
        expect(money()).toEqual({ day: [90, 9], month: [90, 9] });
        expect(trashFlags()).toEqual([true]);
        expect(readCleanupJournal().length).toBe(0);
    }, 20000);

    it('២ខ. ចម្លើយបាត់គ្រប់ការសរសេរ ledger ➜ ការស្តារបញ្ចប់តែផ្នែកដែលនៅខ្វះ · គ្មានផ្នែកណាដកពីរដង', async () => {
        await cutAtLedger({ daily: 'applyHang', monthly: 'applyHang' });
        await resumeCleanupJournalEntry(ID);
        await flush();
        expect(money()).toEqual({ day: [90, 9], month: [90, 9] });
        expect(trashFlags()).toEqual([true]);
    }, 20000);

    it('៣. ខែចុះ ថ្ងៃមិនដល់ ➜ ថ្ងៃដកតែម្តង · ខែមិនដកលើកទី ២', async () => {
        await cutAtLedger({ monthly: 'applyHang', daily: 'hang' });
        await resumeCleanupJournalEntry(ID);
        await flush();
        expect(money()).toEqual({ day: [90, 9], month: [90, 9] });
        expect(trashFlags()).toEqual([true]);
    }, 20000);

    it('៤. ថ្ងៃចុះ ខែមិនដល់ ➜ ខែដកតែម្តង · ថ្ងៃមិនដកលើកទី ២', async () => {
        await cutAtLedger({ daily: 'applyHang', monthly: 'hang' });
        await resumeCleanupJournalEntry(ID);
        await flush();
        expect(money()).toEqual({ day: [90, 9], month: [90, 9] });
        expect(trashFlags()).toEqual([true]);
    }, 20000);

    it('៥. ទិសផ្ទុយ ៖ journal ចាស់ (stage ledger) ត្រឡប់មកវិញក្រោយការដកបញ្ចប់ ➜ រត់ម្តងទៀតគ្មានការដកលើកទី ២', async () => {
        const raw = await cutAtLedger({ daily: 'applyHang' });
        await resumeCleanupJournalEntry(ID);
        await flush();
        expect(money()).toEqual({ day: [90, 9], month: [90, 9] });
        localStorage.setItem(CLEANUP_JOURNAL_KEY, raw);
        reloadPage();
        await resumeCleanupJournalEntry(ID);
        await flush();
        expect(money()).toEqual({ day: [90, 9], month: [90, 9] });
        expect(trashFlags()).toEqual([true]);
    }, 20000);

    it('៦. ⛔ token ដែលមានមុនការដកបាត់ (ring ពេញ · App ចាស់លុប ring) ➜ សម្រេចមិនបាន ➜ មិនប៉ះលុយ · ប្រាប់ · journal ទទេ', async () => {
        await cutAtLedger({ daily: 'hang', monthly: 'hang' });
        const ring: Record<string, number> = {};
        for (let i = 0; i < 12; i++) ring['op_other' + String(i).padStart(4, '0')] = 10 + i;
        setAt(DAILY + '/' + DAY, { codDollar: 100, dodDollar: 0, totalCount: 10, op: 'op_other0011', ops: ring });
        setAt(MONTHLY + '/' + MONTH, { codDollar: 100, dodDollar: 0, totalCount: 10, op: 'op_other0011', ops: ring });
        syncLocalViewsFromServer();
        const outcome = await resumeCleanupJournalEntry(ID);
        await flush();
        expect(outcome).toBe('unverified');
        expect(money()).toEqual({ day: [100, 10], month: [100, 10] });
        expect(trashFlags()).toEqual([false]);
        expect(readCleanupJournal().length).toBe(0);
    }, 20000);
});

describe('App កំណែចាស់សរសេរ record ថ្ងៃដោយគ្មានសោ ➜ token ក្នុង ring នៅតែជាភស្តុតាង', () => {
    it('៧. ការដកចុះ (ចម្លើយបាត់) ➜ ឧបករណ៍កំណែចាស់សរសេរ record ថ្ងៃ (លុប `ded` · រក្សា ring) ➜ ការស្តារមិនដកលើកទី ២ · flip', async () => {
        await cutAtLedger({ daily: 'applyHang' });
        const day = getAt(DAILY + '/' + DAY);
        const ops = { ...(day.ops || {}) };
        const top = Object.values(ops).reduce((m: number, v: any) => Math.max(m, Number(v) || 0), 0) as number;
        ops.op_oldwriter01 = top + 1;
        setAt(DAILY + '/' + DAY, { codDollar: day.codDollar, dodDollar: day.dodDollar, totalCount: day.totalCount, op: 'op_oldwriter01', ops });
        syncLocalViewsFromServer();
        await resumeCleanupJournalEntry(ID);
        await flush();
        expect(money()).toEqual({ day: [90, 9], month: [90, 9] });
        expect(trashFlags()).toEqual([true]);
    }, 20000);
});

describe('ការស្តារ ៖ បូកវិញតាមសោ · មិនបូកវិញពីរដង', () => {
    it('៨. flip ចុះ តែ App ស្លាប់មុនសម្អាត journal ➜ ស្តារ (+១០ តាម flag) ➜ journal រត់ម្តងទៀតមិនបូកវិញលើកទី ២ (១០០ មិនមែន ១១០)', async () => {
        seed([expiredItem()]);
        let flipJournal: string | null = null;
        lab.beforeTx = (path) => {
            if (!flipJournal && path === TRASH + '/' + ID && journalStage() === 'flip') flipJournal = localStorage.getItem(CLEANUP_JOURNAL_KEY);
        };
        await claimAndCleanupItem(ID, 'abandon');
        await flush();
        expect(flipJournal).not.toBeNull();
        expect(trashFlags()).toEqual([true]);
        expect(money()).toEqual({ day: [90, 9], month: [90, 9] });
        localStorage.setItem(CLEANUP_JOURNAL_KEY, flipJournal as string);
        reloadPage();
        await restoreOnOtherDevice(ID);
        expect(getAt(TRASH + '/' + ID)).toBeNull();
        expect(money()).toEqual({ day: [100, 10], month: [100, 10] });
        syncLocalViewsFromServer();
        await resumeCleanupJournalEntry(ID);
        await flush();
        expect(money()).toEqual({ day: [100, 10], month: [100, 10] });
        expect(readCleanupJournal().length).toBe(0);
    }, 20000);

    it('៩. ការដកចុះ · flip មិនដល់ · ឧបករណ៍ស្លាប់ (journal បាត់) ➜ ការស្តារលើឧបករណ៍ផ្សេងបូក ១០ វិញតាមសោ', async () => {
        seed([expiredItem()]);
        lab.plan = { flip: 'hang' };
        claimAndCleanupItem(ID, 'abandon');
        await flush();
        expect(journalStage()).toBe('flip');
        expect(money()).toEqual({ day: [90, 9], month: [90, 9] });
        expect(trashFlags()).toEqual([false]);
        localStorage.clear();
        reloadPage();
        await restoreOnOtherDevice(ID);
        expect(getAt(TRASH + '/' + ID)).toBeNull();
        expect(money()).toEqual({ day: [100, 10], month: [100, 10] });
    }, 20000);

    it('៩ខ. ដូចគ្នា តែ journal នៅរស់ ➜ ស្តារតាមសោ ➜ journal រត់ក្រោយ មិនបូកវិញលើកទី ២', async () => {
        seed([expiredItem()]);
        lab.plan = { flip: 'hang' };
        claimAndCleanupItem(ID, 'abandon');
        await flush();
        reloadPage();
        await restoreOnOtherDevice(ID);
        expect(money()).toEqual({ day: [100, 10], month: [100, 10] });
        syncLocalViewsFromServer();
        await resumeCleanupJournalEntry(ID);
        await flush();
        expect(money()).toEqual({ day: [100, 10], month: [100, 10] });
        expect(readCleanupJournal().length).toBe(0);
    }, 20000);

    it('១០. ការស្តារមិនឃើញសោ (ទិដ្ឋភាពចាស់) ➜ journal បូកវិញ ➜ ខែត្រូវកាត់ពាក់កណ្តាល ➜ ការរត់ម្តងទៀតបញ្ចប់ខែតែម្តង (១០០)', async () => {
        seed([expiredItem()]);
        lab.plan = { flip: 'hang' };
        claimAndCleanupItem(ID, 'abandon');
        await flush();
        reloadPage();
        dataState.dailyRevenueData = { [DAY]: { codDollar: 100, dodDollar: 0, totalCount: 10 } };
        uiState.pendingRestoreId = ID;
        dataState.scanHistory = Object.values(getAt(HISTORY) || {}).map((v: any) => clone(v));
        dataState.deletedItems = Object.values(getAt(TRASH) || {}).map((v: any) => clone(v));
        await executeRestoreItem();
        await flush();
        expect(getAt(TRASH + '/' + ID)).toBeNull();
        expect(money()).toEqual({ day: [90, 9], month: [90, 9] });
        syncLocalViewsFromServer();
        lab.plan = { monthly: 'hang' };
        resumeCleanupJournalEntry(ID);
        await flush();
        reloadPage();
        await resumeCleanupJournalEntry(ID);
        await flush();
        expect(money()).toEqual({ day: [100, 10], month: [100, 10] });
        expect(readCleanupJournal().length).toBe(0);
    }, 20000);

    it('១១. ទិសផ្ទុយ ៖ ស្តារ ➜ កញ្ចប់ដដែល (id ដដែល) ផុតកំណត់ម្តងទៀត ➜ ដកម្តងទៀត (សោចាស់មិនរារាំង)', async () => {
        seed([expiredItem()]);
        await claimAndCleanupItem(ID, 'abandon');
        await flush();
        expect(money()).toEqual({ day: [90, 9], month: [90, 9] });
        await restoreOnOtherDevice(ID);
        expect(money()).toEqual({ day: [100, 10], month: [100, 10] });
        const item = getAt(HISTORY + '/' + ID);
        expect(item).not.toBeNull();
        const old = getServerNow() - ABANDON_AGE_MS - 3600000;
        item.createdAt = old;
        item.barcodes = item.barcodes.map((b: any) => ({ ...b, createdAt: old, restoredAt: old }));
        setAt(HISTORY + '/' + ID, item);
        syncLocalViewsFromServer();
        firebaseState.serverTimeOffsetMs = 5000;
        await claimAndCleanupItem(ID, 'abandon');
        await flush();
        expect(money()).toEqual({ day: [90, 9], month: [90, 9] });
        expect(trashFlags()).toEqual([true]);
    }, 20000);
});

describe('អ្នកបោសធុងសំរាម ៖ សោក្នុង ledger ថ្ងៃ ➜ flip កញ្ចប់ផុតកំណត់ដែលគ្មាន journal', () => {
    it('១២. ការដកចុះ · flip មិនដល់ · ឧបករណ៍ស្លាប់ ➜ ឧបករណ៍ផ្សេង flip តាមសោ · លុយមិនប្រែ', async () => {
        seed([expiredItem()]);
        lab.plan = { flip: 'hang' };
        claimAndCleanupItem(ID, 'abandon');
        await flush();
        expect(trashFlags()).toEqual([false]);
        localStorage.clear();
        reloadPage();
        firebaseState.serverTimeOffsetMs = 30 * 60 * 1000;
        runScheduledCleanup();
        await flush();
        expect(trashFlags()).toEqual([true]);
        expect(money()).toEqual({ day: [90, 9], month: [90, 9] });
    }, 20000);

    it('១២ខ. ទិសផ្ទុយ ៖ គ្មានសោ (ការដកមិនដល់ ឬកំណែចាស់) ➜ អ្នកបោសមិនដក មិន flip', async () => {
        seed([expiredItem()]);
        lab.plan = { daily: 'hang', monthly: 'hang' };
        claimAndCleanupItem(ID, 'abandon');
        await flush();
        localStorage.clear();
        reloadPage();
        firebaseState.serverTimeOffsetMs = 30 * 60 * 1000;
        runScheduledCleanup();
        await flush();
        expect(trashFlags()).toEqual([false]);
        expect(money()).toEqual({ day: [100, 10], month: [100, 10] });
    }, 20000);
});

describe('rules មិនទាន់ Publish', () => {
    it('១៣. rules បដិសេធ `ded` ➜ ការដកនៅតែចុះ (token ក្នុង ring) · flip', async () => {
        seed([expiredItem()]);
        lab.plan = { daily: 'rejectDed' };
        await claimAndCleanupItem(ID, 'abandon');
        await flush();
        expect(money()).toEqual({ day: [90, 9], month: [90, 9] });
        expect(trashFlags()).toEqual([true]);
        expect(readCleanupJournal().length).toBe(0);
    }, 20000);

    it('១៣ខ. rules បដិសេធ `ded` · ការដកដោយ token ចុះ តែចម្លើយបាត់ ➜ ការស្តារមិនដកលើកទី ២', async () => {
        await cutAtLedger({ daily: 'rejectDedApplyHang' });
        await resumeCleanupJournalEntry(ID);
        await flush();
        expect(money()).toEqual({ day: [90, 9], month: [90, 9] });
        expect(trashFlags()).toEqual([true]);
    }, 20000);

    it('១៣គ. rules ចាស់ជាង ring ➜ ថយទៅ `op` ➜ ការដកនៅតែចុះ · flip', async () => {
        seed([expiredItem()]);
        lab.plan = { daily: 'rejectRing', monthly: 'rejectRing' };
        await claimAndCleanupItem(ID, 'abandon');
        await flush();
        expect(money()).toEqual({ day: [90, 9], month: [90, 9] });
        expect(trashFlags()).toEqual([true]);
    }, 20000);
});
