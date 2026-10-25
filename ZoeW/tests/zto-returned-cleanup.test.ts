/**
 * ↩️ ម្ចាស់គម្រោង ៖ «អីវ៉ាន់ដែល ត្រលប់ អោយដកចេញពី ZoeW អោយដូច ផុតកំណត់ដែរទៅ … មិនបាច់មានច្បាប់ដក ថ្ងៃទី8 ក៏បាន … ដកលុយដូចគ្នា» ·
 * «ដកវាចេញភ្លាមទៅធុងសំរាម ស្លាក "ត្រឡប់" … ដកលុយដកចំនួនកញ្ចប់ … ដូចកញ្ចប់ផុតកំណត់បេះបិទ» · «ដកមុខងារ ផុតកំណត់ចេញ ព្រោះវាជា ត្រឡប់»។
 * «ដាក់ returned ទៅ ខ្ញុំចូលចិត្ត ពិតពិត» · «កែអោយស្អាតទៅ គ្មានទិន្នន័យអតិថិជនណាមួយឡើយ» ➜ ថ្នាក់តែមួយ ៖ ច្បាប់ ៨ ថ្ងៃ និង ZTO ស្កេនត្រឡប់
 * សរសេរ **`trashReason: 'returned'`** (ស្លាក «ត្រឡប់») · គ្មាន `expired` · ដកលុយ និងចំនួនកញ្ចប់ (journal · ledger keyed · flip · ២ ថ្ងៃ · ស្តារ) ·
 * តែដកតែ barcode បើកដែលបានប្រាប់ ដោយមិនរង់ចាំអាយុ · barcode បិទ ឬមិនបានប្រាប់ មិនប៉ះ ·
 * `removeReturnedZtoBarcodes()` ៖ ស្កេន «ត្រឡប់» ក្រោយ barcode ចូល ZoeW (`createdAt` · `restoredAt`) · កុងតាក់ «បិទតាម ZTO ស្វ័យប្រវត្តិ» · នាឡិកា server + ហាងដឹង។
 */
import { cleanupServerRead } from './helpers/cleanup-server-read';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import { refTo } from '../src/app/refs';
import { dataState, firebaseState, uiState, ztoState } from '../src/core/state';
import { getServerNow } from '../src/core/clock';
import { appLocalStore } from '../src/core/storage';
import { dbListenerFailedPaths, dbListenerPendingPaths } from '../src/core/text';
import { CLEANUP_KEY_SWEEP_GRACE_MS, claimAndCleanupItem, cleanupInFlight, cleanupJournalLive, runCleanupLedgerKeySweep, trashRetentionMs } from '../src/domain/cleanup';
import { RETURNED_TRASH_RETENTION_MS } from '../src/features/session';
import { TRASH_REASON_META, buildTrashGroups, trashDisplayReasonOf, trashReasonOf } from '../src/features/trash';
import { removedParcelsView } from '../src/features/notifications';
import { activeRestoreClaims, restoreLedgerKeyFor } from '../src/features/restore';
import { removeReturnedZtoBarcodes } from '../src/features/zto-returned';
import { trashRestoreBlockOf } from '../src/features/zto-final-marks';
import { runZtoListSyncPreview } from '../src/features/zto-list-sync';
import { clearZtoPickupStatusStore, runZtoStatusSweep } from '../src/features/zto-status';
import { ztoListGroupModel } from '../src/app/components/zto/model';

const req = createRequire(import.meta.url);
const fn = req('../netlify/functions/zto-order-detail.js');
const fx = req('../../audit-tools/idtoken-fixture.js');
const KEY = 'ret-clean-proxy-key';

const HISTORY = 'zoew_scan_history_cod_dod';
const TRASH = 'zoew_recently_deleted_cod_dod';
const DAILY = 'zoew_daily_revenue_cod_dod';
const MONTHLY = 'zoew_monthly_revenue_cod_dod';
const DAY = '2026-09-20';
const MONTH = '2026-09';
const ID = 'id_x';
const HOST = 'https://shop.firebaseio.com';

type TxHook = (info: { path: string; prior: any; proposed: any; apply: () => void }) => any;
const lab = {
    store: {} as Record<string, any>,
    tx: [] as { path: string; prior: any; proposed: any }[],
    hook: null as TxHook | null,
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
            lab.tx.push({ path: ref.path, prior: clone(prior), proposed: clone(proposed) });
            if (proposed === undefined) return { committed: false, snapshot: snap(ref, prior) };
            const apply = () => setAt(ref.path, proposed);
            if (lab.hook) {
                const out = lab.hook({ path: ref.path, prior, proposed, apply });
                if (out !== undefined) return out;
            }
            apply();
            return { committed: true, snapshot: snap(ref, getAt(ref.path)) };
        },
        onValue: () => () => {},
        off: () => {}
    };
}
const flush = async (n = 40) => { for (let i = 0; i < n; i++) await new Promise((resolve) => setTimeout(resolve, 0)); };

function barcode(code: string, cod: number, createdAt: number) {
    return { code, time: '08:00:00 (' + DAY + ')', cod, dod: 0, locker: 'N/A', isClosed: false, isDeducted: false, isFromDeletion: false, createdAt };
}
function seed(items: any[]) {
    lab.store = {
        [HISTORY]: Object.fromEntries(items.map((it) => [it.id, clone(it)])),
        [TRASH]: {},
        [DAILY]: { [DAY]: { codDollar: 100, dodDollar: 0, totalCount: 10 } },
        [MONTHLY]: { [MONTH]: { codDollar: 100, dodDollar: 0, totalCount: 10 } }
    };
    firebaseState.db = { name: 'test-db' } as any;
    firebaseState.fb = makeFb() as any;
    firebaseState.firebaseConfig = { databaseURL: HOST } as any;
    firebaseState.auth = { currentUser: { uid: 'u1', getIdToken: async () => 'tok' } } as any;
    firebaseState.isDatabaseInitialized = true;
    firebaseState.isDatabaseConnected = true;
    firebaseState.serverClockTrusted = true;
    firebaseState.hasEverConnectedToDatabase = true;
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
const ledger = () => getAt(DAILY + '/' + DAY);
const month = () => getAt(MONTHLY + '/' + MONTH);
const DAY_MS = 86400000;
const NOW_AGE = () => getServerNow() - 2 * DAY_MS;
const ztoStamp = (ms: number) => new Date(ms + 7 * 3600000).toISOString().replace('T', ' ').slice(0, 19);
function youngItem(codes: Array<[string, number, boolean?]>, id = ID) {
    const at = NOW_AGE();
    const barcodes = codes.map(([code, cod, closed]) => (closed
        ? { ...barcode(code, cod, at), isClosed: true, closedAt: getServerNow() - 600000 }
        : barcode(code, cod, at)));
    const cod = barcodes.reduce((sum, b) => sum + b.cod, 0);
    return { id, phone: '012', scanDate: DAY, time: barcodes[0].time, createdAt: at, count: barcodes.length, cod, dod: 0, price: cod,
        isClosed: barcodes.every((b: any) => b.isClosed), isCalled: false, barcode: barcodes[0].code, barcodes };
}
const trashItems = () => Object.values(getAt(TRASH) || {}) as any[];
const historyCodes = (id = ID) => ((getAt(HISTORY + '/' + id) || {}).barcodes || []).map((b: any) => b.code);

beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(cleanupServerRead(getAt)));
    lab.tx = [];
    lab.hook = null;
    lab.beforeTx = null;
    uiState.toasts = [];
    try { localStorage.clear(); } catch {}
    appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify({ enabled: true, fastMode: true, headerName: 'X-Zoe-Proxy-Key', headerValue: 'k',
        url: 'https://zoew.example/.netlify/functions/zto-order-detail?barcode={barcode}' }));
    cleanupInFlight.clear();
    cleanupJournalLive.clear();
    activeRestoreClaims.clear();
    clearZtoPickupStatusStore();
    ztoState.ztoReturnedSweepAt = 0;
    ztoState.ztoStatusInFlight = false;
    ztoState.ztoListSyncInFlight = false;
    ztoState.ztoStatusLastSweepAt = 0;
    dbListenerPendingPaths.clear();
    dbListenerFailedPaths.clear();
    (window as any).ZoeErrors = { capture: vi.fn() };
    firebaseState.authGeneration++;
});

afterEach(() => {
    vi.unstubAllGlobals();
    delete (window as any).ZoeErrors;
});

describe('↩️ ដកកញ្ចប់ត្រឡប់ដូចច្បាប់ ៨ ថ្ងៃ ៖ `claimAndCleanupItem(id, \'abandon\', { codes })`', () => {
    it('កញ្ចប់ក្មេង (២ ថ្ងៃ) ៖ ដកតែ barcode បើកដែលប្រាប់ ➜ ធុងសំរាម «ត្រឡប់» · លុយ និងចំនួនកញ្ចប់ដក · barcode បើកផ្សេង និងបិទ នៅដដែល · គ្មានស្លាក «ផុតកំណត់»', async () => {
        seed([youngItem([['A', 10], ['B', 5], ['C', 3, true]])]);
        await claimAndCleanupItem(ID, 'abandon', { codes: ['A', 'C'] });
        await flush();
        expect(historyCodes()).toEqual(['B', 'C']);
        const trash = trashItems();
        expect(trash).toHaveLength(1);
        expect(trash[0].trashReason).toBe('returned');
        const meta: any = (TRASH_REASON_META as any)[trashReasonOf(trash[0])];
        expect(meta).toMatchObject({ label: 'ត្រឡប់', deducted: true });
        expect(Object.values(TRASH_REASON_META).map((m: any) => m.label), 'ម្ចាស់គម្រោង ៖ «ដកមុខងារ ផុតកំណត់ចេញ»').not.toContain('ផុតកំណត់');
        expect(trash[0].isFromDeletion).toBe(false);
        expect(trash[0].barcodes.map((b: any) => b.code)).toEqual(['A']);
        expect(trash[0].barcodes[0].isDeducted, 'flag ធុងសំរាមតាមលុយ').toBe(true);
        expect(ledger().codDollar).toBe(90);
        expect(ledger().totalCount, 'ចំនួនកញ្ចប់ដក').toBe(9);
        expect(month().codDollar).toBe(90);
        expect(month().totalCount).toBe(9);
        expect(trashRetentionMs(trash[0]), 'លុបអចិន្ត្រៃយ៍ក្រោយ ២ ថ្ងៃ ដូចច្បាប់ ៨ ថ្ងៃ').toBe(RETURNED_TRASH_RETENTION_MS);
    });

    it('barcode បើកទាំងអស់ត្រឡប់ ➜ ធុងសំរាមទាំងកញ្ចប់ (id ដដែល) · ដកលុយទាំងអស់', async () => {
        seed([youngItem([['A', 10], ['B', 5]])]);
        await claimAndCleanupItem(ID, 'abandon', { codes: ['A', 'B'] });
        await flush();
        expect(getAt(HISTORY + '/' + ID)).toBeNull();
        expect(getAt(TRASH + '/' + ID).trashReason).toBe('returned');
        expect(ledger().codDollar).toBe(85);
        expect(ledger().totalCount).toBe(8);
    });

    it('ទិសផ្ទុយ ៖ គ្មាន `codes` ➜ កញ្ចប់ក្មេងមិនប៉ះ (ច្បាប់ ៨ ថ្ងៃដដែល) · `codes` តែ barcode បិទ ➜ មិនប៉ះ', async () => {
        seed([youngItem([['A', 10], ['C', 3, true]])]);
        await claimAndCleanupItem(ID, 'abandon');
        await flush();
        await claimAndCleanupItem(ID, 'abandon', { codes: ['C', 'Z'] });
        await flush();
        expect(historyCodes()).toEqual(['A', 'C']);
        expect(trashItems()).toHaveLength(0);
        expect(ledger().codDollar).toBe(100);
    });
});

describe('↩️ `removeReturnedZtoBarcodes()` ៖ ស្គាល់ថាត្រឡប់ ➜ ដកភ្លាម', () => {
    it('ស្កេនត្រឡប់ក្រោយ barcode ចូល ZoeW ➜ ដក · ត្រឡប់មុនចូល (វដ្តចាស់) ➜ ទុក', async () => {
        seed([youngItem([['A', 10], ['B', 5]])]);
        const queued = removeReturnedZtoBarcodes([
            { barcode: 'A', at: ztoStamp(getServerNow() - DAY_MS) },
            { barcode: 'B', at: ztoStamp(getServerNow() - 3 * DAY_MS) }
        ]);
        expect(queued).toBe(1);
        await flush();
        expect(historyCodes()).toEqual(['B']);
        expect(trashItems().map((t: any) => t.barcodes.map((b: any) => b.code))).toEqual([['A']]);
        expect(ledger().codDollar).toBe(90);
    });

    it('📍 ខុសទីតាំង (ZTO ស្កេនបញ្ជូនចេញក្រោយមកដល់) ➜ ដកដូចត្រឡប់ (ធុងសំរាម returned · លុយដក) · 🔔 និងធុងសំរាមស្លាក «ខុសទីតាំង»', async () => {
        seed([youngItem([['A', 10], ['B', 5]])]);
        const queued = removeReturnedZtoBarcodes([{ barcode: 'A', at: ztoStamp(getServerNow() - DAY_MS), misplaced: true }]);
        expect(queued).toBe(1);
        await flush();
        expect(historyCodes()).toEqual(['B']);
        const trash = trashItems();
        expect(trash.map((t: any) => t.trashReason)).toEqual(['returned']);
        expect(ledger().codDollar).toBe(90);
        expect(trashReasonOf(trash[0])).toBe('returned');
        expect(trashDisplayReasonOf(trash[0])).toBe('misplaced');
        const view = removedParcelsView(trash, getServerNow(), false, []);
        expect(view.rows.map((r: any) => r.misplaced)).toEqual([true]);
    });

    it('📤 បញ្ជូនចេញ (គ្មានស្កេនបញ្ហា «ទីតាំងមិនត្រឹមត្រូវ») ➜ ដកដូចត្រឡប់ · 🔔 និងធុងសំរាមស្លាក «បញ្ជូនចេញ» · មិនទាន់ពិនិត្យស្កេនបញ្ហា ➜ «ត្រឡប់»', async () => {
        seed([youngItem([['A', 10], ['B', 5], ['C', 3]])]);
        const at = ztoStamp(getServerNow() - DAY_MS);
        expect(removeReturnedZtoBarcodes([{ barcode: 'A', at, sentOut: true }])).toBe(1);
        await flush();
        expect(removeReturnedZtoBarcodes([{ barcode: 'B', at, sentOut: true, sentUnverified: true }])).toBe(1);
        await flush();
        expect(historyCodes()).toEqual(['C']);
        const trash = trashItems();
        expect(trash.map((t: any) => t.trashReason)).toEqual(['returned', 'returned']);
        expect(ledger().codDollar).toBe(85);
        const byCode = (code: string) => trash.find((t: any) => t.barcodes[0].code === code);
        expect([trashDisplayReasonOf(byCode('A')), trashDisplayReasonOf(byCode('B'))]).toEqual(['sent', 'returned']);
        expect([trashRestoreBlockOf(byCode('A')), trashRestoreBlockOf(byCode('B'))]).toEqual(['', '']);
        const view = removedParcelsView([byCode('A'), byCode('B')], getServerNow(), false, []);
        expect(view.rows.map((r: any) => [r.key === byCode('A').id, r.sentOut, r.misplaced]).sort()).toEqual([[false, false, false], [true, true, false]]);
    });

    it('ZTO ចុះហត្ថលេខា (បញ្ជីចុះហត្ថលេខា) ➜ មិនដកជាត្រឡប់', async () => {
        seed([youngItem([['A', 10]])]);
        expect(removeReturnedZtoBarcodes([{ barcode: 'A', at: ztoStamp(getServerNow() - DAY_MS) }], dataState.scanHistory, ['A'])).toBe(0);
        await flush();
        expect(historyCodes()).toEqual(['A']);
        expect(ledger().codDollar).toBe(100);
    });

    it('ម្ចាស់គម្រោងស្តារពីធុងសំរាមក្រោយការត្រឡប់ (`restoredAt` ក្រោយ) ➜ មិនដកម្តងទៀត', async () => {
        const item: any = youngItem([['A', 10]]);
        item.barcodes[0].restoredAt = getServerNow() - 3600000;
        seed([item]);
        expect(removeReturnedZtoBarcodes([{ barcode: 'A', at: ztoStamp(getServerNow() - DAY_MS) }])).toBe(0);
        await flush();
        expect(historyCodes()).toEqual(['A']);
    });

    it('view ក្នុងទូរស័ព្ទចាស់ (មិនទាន់ឃើញការស្តារ) ៖ Server មាន `restoredAt` ក្រោយការត្រឡប់ ➜ transaction មិនដកម្តងទៀត · លុយមិនដក', async () => {
        const item: any = youngItem([['A', 10], ['B', 5]]);
        seed([item]);
        setAt(HISTORY + '/' + ID + '/barcodes/0/restoredAt', getServerNow() - 3600000);
        expect(dataState.scanHistory[0].barcodes[0].restoredAt, 'លក្ខខណ្ឌ ៖ view ក្នុងទូរស័ព្ទមិនទាន់ឃើញការស្តារ').toBeUndefined();
        expect(removeReturnedZtoBarcodes([{ barcode: 'A', at: ztoStamp(getServerNow() - DAY_MS) }]), 'view ចាស់ស្នើដក').toBe(1);
        await flush();
        expect(historyCodes()).toEqual(['A', 'B']);
        expect(trashItems()).toHaveLength(0);
        expect(ledger().codDollar).toBe(100);
        expect(ledger().totalCount).toBe(10);
    });

    it('ទិសផ្ទុយ ៖ Server គ្មានការស្តារ ➜ transaction ដកតាមម៉ោងត្រឡប់ពិត', async () => {
        seed([youngItem([['A', 10], ['B', 5]])]);
        expect(removeReturnedZtoBarcodes([{ barcode: 'A', at: ztoStamp(getServerNow() - DAY_MS) }])).toBe(1);
        await flush();
        expect(historyCodes()).toEqual(['B']);
        expect(ledger().codDollar).toBe(90);
    });

    it('កុងតាក់ «បិទតាម ZTO ស្វ័យប្រវត្តិ» បិទ · នាឡិកា server មិនទុកចិត្ត ➜ មិនដក', async () => {
        seed([youngItem([['A', 10]])]);
        const back = [{ barcode: 'A', at: ztoStamp(getServerNow() - DAY_MS) }];
        appLocalStore.setItem('zoew_zto_autoclose_v1', '0');
        expect(removeReturnedZtoBarcodes(back)).toBe(0);
        appLocalStore.removeItem('zoew_zto_autoclose_v1');
        firebaseState.serverClockTrusted = false;
        expect(removeReturnedZtoBarcodes(back)).toBe(0);
        await flush();
        expect(historyCodes()).toEqual(['A']);
        expect(ledger().codDollar).toBe(100);
    });
});

const dk = (back: number) => new Date(Date.now() + 7 * 3600000 - back * DAY_MS).toISOString().slice(0, 10);
function zto(returns: Array<{ code: string; at: string }>, detail?: (code: string) => any, signs: Array<{ code: string; at: string }> = [],
    sends: Array<{ code: string; at: string }> = [], problems: Array<{ code: string; at: string; reason?: string }> = []) {
    process.env.ZTO_PROXY_KEY = KEY;
    process.env.ZTO_AUTHORIZATION = 'Bearer t';
    process.env.FIREBASE_PROJECT_IDS = fx.TEST_PROJECT;
    if (fn.resetCachesForTests) fn.resetCachesForTests();
    appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify({ enabled: true, fastMode: true, headerName: 'X-Zoe-Proxy-Key', headerValue: KEY,
        url: window.location.origin + '/.netlify/functions/zto-order-detail?barcode={barcode}' }));
    const token = fx.tokenForSite('777001');
    (firebaseState.fb as any).getIdTokenResult = async () => ({ token });
    const calls: Array<Record<string, string>> = [];
    vi.stubGlobal('fetch', vi.fn(async (u: any, init: any) => {
        const href = String(u);
        if (href.startsWith(HOST + '/')) return cleanupServerRead(getAt)(u, init);
        if (href.includes(fx.CERTS_HOST)) return new Response(JSON.stringify({ [fx.TEST_KID]: fx.TEST_CERT_PEM }), { status: 200 });
        if (href.startsWith(window.location.origin + '/.netlify/functions/zto-order-detail')) {
            const q: Record<string, string> = {};
            new URL(href).searchParams.forEach((v, k) => { q[k] = v; });
            calls.push(q);
            if (!q.list) return new Response(JSON.stringify(detail ? detail(q.barcode) : { found: true, ztoClosed: false }), { status: 200 });
            const h: Record<string, string> = {};
            Object.entries((init && init.headers) || {}).forEach(([k, v]) => { h[k.toLowerCase()] = String(v); });
            const r = await fn.handler({ httpMethod: 'GET', headers: h, queryStringParameters: q });
            return new Response(r.body, { status: r.statusCode });
        }
        const b = JSON.parse(String(init.body));
        const c = b.condition;
        if (c.scanTypeCode === '05' && (globalThis as any).__signFail) return new Response('{}', { status: 502 });
        const rows = c.scanTypeCode === '-710' ? returns.filter((r) => r.at >= c.scanStartTime && r.at <= c.scanEndTime).map((r) => ({ scanBillCode: r.code,
            consigneeMobile: '855977000111', scanTypeCode: '-710', scanTypeDesc: 'ត្រឡប់ការស្កេន', scanTime: r.at, scanSite: 'S', agentAmount: 0, fcAmount: 0 }))
            : (c.scanTypeCode === '05' ? signs.filter((r) => r.at >= c.scanStartTime && r.at <= c.scanEndTime).map((r) => ({ scanBillCode: r.code,
                consigneeMobile: '855977000111', scanTypeCode: '05', scanTime: r.at, scanSite: 'S', agentAmount: 0, fcAmount: 0 }))
            : (c.scanTypeCode === '02' ? sends.filter((r) => r.at >= c.scanStartTime && r.at <= c.scanEndTime).map((r) => ({ scanBillCode: r.code,
                consigneeMobile: '855977000111', scanTypeCode: '02', scanTime: r.at, scanSite: 'S', agentAmount: 0, fcAmount: 0 }))
            : (c.scanTypeCode === '30' ? problems.filter((r) => r.at >= c.scanStartTime && r.at <= c.scanEndTime).map((r) => ({ scanBillCode: r.code,
                consigneeMobile: '855977000111', scanTypeCode: '30', scanTime: r.at, scanSite: 'S', agentAmount: 0, fcAmount: 0,
                problemReason: r.reason || 'ទីតាំងមិនត្រឹមត្រូវ' })) : [])));
        return new Response(JSON.stringify({ success: true, error: null,
            data: { pageNum: b.pageNum, pages: rows.length ? 1 : 0, total: rows.length, result: rows } }), { status: 200 });
    }));
    return calls;
}
function setRange(from: string, to: string) {
    for (const [name, value] of [['ztoListSyncFrom', from], ['ztoListSyncTo', to]] as const) {
        const input = document.createElement('input');
        input.value = value;
        refTo(name)(input);
    }
}

describe('↩️ ទ្វារដែល App ដឹងថាកញ្ចប់ត្រឡប់', () => {
    afterEach(() => {
        refTo('ztoListSyncFrom')(null);
        refTo('ztoListSyncTo')(null);
        delete process.env.ZTO_PROXY_KEY;
        delete process.env.ZTO_AUTHORIZATION;
        delete process.env.FIREBASE_PROJECT_IDS;
    });

    it('ទាញបញ្ជី (Cookie) ៖ កញ្ចប់បើកក្នុង ZoeW ដែលសាខាស្កេនត្រឡប់ ➜ ធុងសំរាម «ត្រឡប់» · ដកលុយ', async () => {
        seed([youngItem([['ZTRET0000001', 10], ['ZTKEEP000001', 5]])]);
        zto([{ code: 'ZTRET0000001', at: ztoStamp(getServerNow() - 3600000) }]);
        setRange(dk(3), dk(0));
        await runZtoListSyncPreview();
        await flush();
        expect(historyCodes()).toEqual(['ZTKEEP000001']);
        expect(trashItems().map((t: any) => [t.trashReason, t.barcodes.map((b: any) => b.code)])).toEqual([['returned', ['ZTRET0000001']]]);
        expect(ledger().codDollar).toBe(90);
    });

    it('ទាញបញ្ជី (Cookie) ៖ អានបញ្ជីចុះហត្ថលេខាមិនបាន ➜ មិនដកជាត្រឡប់ (ហត្ថលេខាឈ្នះ · មិនដឹងថាចុះហត្ថលេខាឬអត់) · ប្រអប់មិនប្រាប់ថានឹងដក', async () => {
        seed([youngItem([['ZTRET0000001', 10], ['ZTKEEP000001', 5]])]);
        zto([{ code: 'ZTRET0000001', at: ztoStamp(getServerNow() - 3600000) }]);
        (globalThis as any).__signFail = true;
        try {
            setRange(dk(3), dk(0));
            await runZtoListSyncPreview();
            await flush();
        } finally {
            delete (globalThis as any).__signFail;
        }
        expect(ztoState.ztoListSyncResult && ztoState.ztoListSyncResult.signedState, 'លក្ខខណ្ឌ ៖ បញ្ជីចុះហត្ថលេខាមិនបាន').not.toBe('ok');
        expect(historyCodes()).toEqual(['ZTRET0000001', 'ZTKEEP000001']);
        expect(trashItems()).toHaveLength(0);
        expect(ledger().codDollar).toBe(100);
        const returnedGroup = (ztoState.ztoListPreview as any).groups.flatMap((g: any) => g.rows || []).filter((r: any) => r.removeInZoew);
        expect(returnedGroup, 'ប្រអប់មិនប្រាប់ «🗑️ ដក» ពេលមិនដក').toHaveLength(0);
    });

    it('ពិនិត្យនៅខាងក្រោយ (Cookie) ៖ អានបញ្ជីត្រឡប់ ➜ ដក · ≤ ម្តងក្នុងមួយម៉ោង', async () => {
        seed([youngItem([['ZTRET0000001', 10], ['ZTKEEP000001', 5]])]);
        const calls = zto([{ code: 'ZTRET0000001', at: ztoStamp(getServerNow() - 3600000) }]);
        await runZtoStatusSweep(true, dataState.scanHistory, []);
        await flush();
        expect(historyCodes()).toEqual(['ZTKEEP000001']);
        expect(ledger().codDollar).toBe(90);
        expect(calls.filter((q) => q.returned === '1')).toHaveLength(1);
        await runZtoStatusSweep(true, dataState.scanHistory, []);
        expect(calls.filter((q) => q.returned === '1'), 'ម្តងក្នុងមួយម៉ោង').toHaveLength(1);
    });

    it('📍 ពិនិត្យនៅខាងក្រោយ (Cookie) ៖ «ទីតាំងមិនត្រឹមត្រូវ» ➜ បញ្ជូនចេញ 02 ➜ «ខុសទីតាំង» · 02 តែម្យ៉ាង ➜ «បញ្ជូនចេញ» ស្តារបាន · ដកលុយ · ត្រឡប់ + បញ្ជូនចេញ ➜ «ត្រឡប់»', async () => {
        seed([youngItem([['ZTMIS0000001', 10]], 'id_mis'), youngItem([['ZTRET0000001', 5]], 'id_ret'), youngItem([['ZTKEEP000001', 5]], 'id_keep'),
            youngItem([['ZTMIX0000001', 1], ['ZTMIX0000002', 1]], 'id_mix'), youngItem([['ZTSENT000001', 3]], 'id_sent')]);
        const at = ztoStamp(getServerNow() - 3600000);
        const calls = zto([{ code: 'ZTRET0000001', at }, { code: 'ZTMIX0000002', at }], undefined, [],
            [{ code: 'ZTMIS0000001', at }, { code: 'ZTRET0000001', at }, { code: 'ZTMIX0000001', at }, { code: 'ZTSENT000001', at }],
            [{ code: 'ZTMIS0000001', at }, { code: 'ZTSENT000001', at, reason: 'ទាក់ទងអតិថិជនមិនបាន' }]);
        await runZtoStatusSweep(true, dataState.scanHistory, []);
        await flush();
        expect(historyCodes('id_keep')).toEqual(['ZTKEEP000001']);
        expect(['id_mis', 'id_ret', 'id_mix', 'id_sent'].map((id) => historyCodes(id))).toEqual([[], [], [], []]);
        expect(ledger().codDollar, 'លុយដក ១០ + ៥ + ២ + ៣').toBe(80);
        expect(calls.filter((q) => q.sent === '1')).toHaveLength(1);
        expect(calls.filter((q) => q.problem === '1')).toHaveLength(1);
        const labels = buildTrashGroups(trashItems()).flatMap((g: any) => g.codes.map((code: string) => code + ':' + g.reason)).sort();
        expect(labels, 'ជួរតែមួយមានទាំងត្រឡប់ និងខុសទីតាំង ➜ «ត្រឡប់» (ព្រំដែនទទួលស្គាល់)')
            .toEqual(['ZTMIS0000001:misplaced', 'ZTMIX0000001:returned', 'ZTMIX0000002:returned', 'ZTRET0000001:returned', 'ZTSENT000001:sent']);
        expect(trashItems().every((t: any) => t.trashReason === 'returned')).toBe(true);
        const sent = trashItems().find((t: any) => t.barcodes[0].code === 'ZTSENT000001');
        expect(trashRestoreBlockOf(sent), '📤 បញ្ជូនចេញ (មិនមែន -710) ➜ ស្តារបាន').toBe('');
        expect(trashRestoreBlockOf(trashItems().find((t: any) => t.barcodes[0].code === 'ZTRET0000001'))).toBe('returned');
    });

    it('ពិនិត្យនៅខាងក្រោយ (Cookie) ៖ «ទីតាំងមិនត្រឹមត្រូវ» មុនកញ្ចប់ចូល ZoeW (វដ្តមុន) ➜ «បញ្ជូនចេញ» ស្តារបាន មិនមែន «ខុសទីតាំង»', async () => {
        const entered = getServerNow() - 3 * 3600000;
        const young = youngItem([['ZTCYCLE00001', 4]], 'id_cycle');
        seed([{ ...young, createdAt: entered, barcodes: young.barcodes.map((b: any) => ({ ...b, createdAt: entered })) }]);
        const send = ztoStamp(getServerNow() - 3600000);
        const before = ztoStamp(getServerNow() - 4 * 3600000);
        const calls = zto([], undefined, [], [{ code: 'ZTCYCLE00001', at: send }], [{ code: 'ZTCYCLE00001', at: before }]);
        await runZtoStatusSweep(true, dataState.scanHistory, []);
        expect(calls.filter((q) => q.problem === '1'), 'លក្ខខណ្ឌ ៖ អានស្កេនបញ្ហា').toHaveLength(1);
        await flush();
        expect(historyCodes('id_cycle')).toEqual([]);
        expect(buildTrashGroups(trashItems()).map((g: any) => g.reason)).toEqual(['sent']);
        expect(trashRestoreBlockOf(trashItems()[0])).toBe('');
    });

    it('ពិនិត្យនៅខាងក្រោយ (Cookie) ៖ ចន្លោះបញ្ជីត្រឡប់តូច (ម្សិលមិញ ➜ ថ្ងៃនេះ) តែ «ទីតាំងមិនត្រឹមត្រូវ» ស្កេនមុននោះ ក្រោយកញ្ចប់ចូល ZoeW ➜ អានបញ្ជី 30 ពីថ្ងៃកញ្ចប់បើកចាស់បំផុត ➜ «ខុសទីតាំង»', async () => {
        const entered = getServerNow() - 4 * 24 * 3600000;
        const young = youngItem([['ZTLONG000001', 4]], 'id_long');
        seed([{ ...young, createdAt: entered, barcodes: young.barcodes.map((b: any) => ({ ...b, createdAt: entered })) }]);
        const send = ztoStamp(getServerNow() - 3600000);
        const wrong = ztoStamp(getServerNow() - 3 * 24 * 3600000);
        const calls = zto([], undefined, [], [{ code: 'ZTLONG000001', at: send }], [{ code: 'ZTLONG000001', at: wrong }]);
        await runZtoStatusSweep(true, dataState.scanHistory, []);
        await flush();
        const sent = calls.find((q) => q.sent === '1');
        const problem = calls.find((q) => q.problem === '1');
        expect(sent && sent.from, 'លក្ខខណ្ឌ ៖ ចន្លោះតូច (ម្សិលមិញ)').toBe(dk(1));
        expect(problem && problem.from, 'បញ្ជី 30 ពីថ្ងៃកញ្ចប់បើកចាស់បំផុត').toBe(dk(4));
        expect(historyCodes('id_long')).toEqual([]);
        expect(buildTrashGroups(trashItems()).map((g: any) => g.reason)).toEqual(['misplaced']);
    });

    it('ពិនិត្យនៅខាងក្រោយ (Cookie) ៖ ZTO ចុះហត្ថលេខា + ស្កេនត្រឡប់ ➜ ហត្ថលេខាឈ្នះ ទោះបិទមិនទាន់ដល់ (លើស batch មួយជុំ) ➜ មិនដក · លុយមិនដក', async () => {
        const codes = Array.from({ length: 11 }, (_, i) => 'ZTSIGN' + String(i).padStart(6, '0'));
        const items = codes.map((code, i) => youngItem([[code, 1]], 'id_s' + String(i).padStart(2, '0')));
        seed(items);
        const at = ztoStamp(getServerNow() - 3600000);
        const last = codes[codes.length - 1];
        const calls = zto([{ code: last, at }], undefined, codes.map((code) => ({ code, at })));
        await runZtoStatusSweep(true, dataState.scanHistory, []);
        await flush();
        expect(calls.filter((q) => q.returned === '1'), 'លក្ខខណ្ឌ ៖ ទាញបញ្ជីត្រឡប់ក្នុងជុំនេះ').toHaveLength(1);
        expect(historyCodes('id_s10'), 'barcode ទី ១១ នៅបើក (ជុំក្រោយបិទតាមហត្ថលេខា)').toEqual([last]);
        expect(trashItems().filter((t: any) => t.trashReason === 'returned')).toHaveLength(0);
        expect(ledger().codDollar).toBe(100);
        expect(ledger().totalCount).toBe(10);
    });

    it('ពិនិត្យនៅខាងក្រោយ (Cookie) ៖ អានបញ្ជីចុះហត្ថលេខាមិនបាន ➜ មិនដកជាត្រឡប់ជុំនោះ (មិនដឹងថាចុះហត្ថលេខាឬអត់)', async () => {
        seed([youngItem([['ZTRET0000001', 10]])]);
        const calls = zto([{ code: 'ZTRET0000001', at: ztoStamp(getServerNow() - 3600000) }]);
        const real = (globalThis.fetch as any);
        vi.stubGlobal('fetch', vi.fn(async (u: any, init: any) => {
            const q = new URL(String(u), window.location.origin).searchParams;
            if (q.get('list') && q.get('signed')) return new Response(JSON.stringify({ error: 'boom', code: 'ZTO_UPSTREAM_ERROR' }), { status: 502 });
            return real(u, init);
        }));
        await runZtoStatusSweep(true, dataState.scanHistory, []);
        await flush();
        expect(historyCodes()).toEqual(['ZTRET0000001']);
        expect(ledger().codDollar).toBe(100);
        expect(calls.filter((q) => q.returned === '1')).toHaveLength(0);
    });

    it('ពិនិត្យនៅខាងក្រោយ (Cookie) ៖ ចាកចេញ · ប្តូរហាង · ប្តូរ Config (`clearZtoPickupStatusStore()`) ➜ វគ្គថ្មីអានបញ្ជីត្រឡប់ភ្លាម (មិនរង់ចាំ ១ ម៉ោងរបស់វគ្គមុន)', async () => {
        seed([youngItem([['ZTKEEP000001', 5]])]);
        const calls = zto([]);
        await runZtoStatusSweep(true, dataState.scanHistory, []);
        expect(calls.filter((q) => q.returned === '1'), 'លក្ខខណ្ឌ ៖ វគ្គមុនអានរួច').toHaveLength(1);
        clearZtoPickupStatusStore();
        seed([youngItem([['ZTRET0000001', 10]])]);
        const next = zto([{ code: 'ZTRET0000001', at: ztoStamp(getServerNow() - 3600000) }]);
        await runZtoStatusSweep(true, dataState.scanHistory, []);
        await flush();
        expect(next.filter((q) => q.returned === '1')).toHaveLength(1);
        expect(trashItems().map((t: any) => t.trashReason)).toEqual(['returned']);
        expect(ledger().codDollar).toBe(90);
    });

    it('ពិនិត្យនៅខាងក្រោយ ៖ ចម្លើយ `ztoClosed: true` + `ztoReturnedAt` ➜ មិនដកជាត្រឡប់ · លុយមិនដក', async () => {
        seed([youngItem([['ZTRET0000001', 10]])]);
        zto([], () => ({ found: true, ztoClosed: true, ztoReturnedAt: ztoStamp(getServerNow() - 3600000) }));
        ztoState.ztoReturnedSweepAt = Date.now();
        await runZtoStatusSweep(true, dataState.scanHistory, []);
        await flush();
        expect(trashItems()).toHaveLength(0);
        expect(ledger().codDollar).toBe(100);
    });

    it('ពិនិត្យនៅខាងក្រោយ ៖ ចម្លើយ Barcode មួយមាន `ztoReturnedAt` (Palm status=1) ➜ ដក', async () => {
        seed([youngItem([['ZTRET0000001', 10], ['ZTKEEP000001', 5]])]);
        zto([], (code) => (code === 'ZTRET0000001'
            ? { found: true, ztoClosed: false, ztoReturnedAt: ztoStamp(getServerNow() - 3600000) }
            : { found: true, ztoClosed: false }));
        ztoState.ztoReturnedSweepAt = Date.now();
        await runZtoStatusSweep(true, dataState.scanHistory, []);
        await flush();
        expect(historyCodes()).toEqual(['ZTKEEP000001']);
        expect(ledger().codDollar).toBe(90);
    });
});

describe('↩️ ប្រអប់បញ្ជី ZTO ៖ កញ្ចប់ត្រឡប់ដែលនៅបើកក្នុង ZoeW ប្រាប់ការពិត', () => {
    const notes = (row: any) => ztoListGroupModel('t', [{ barcode: 'R1', phone: '012', at: '2026-10-17 08:00:00', returnedAt: '2026-10-17 09:00:00', ...row }], 'x').rows[0].notes;
    it('ដក ➜ 🗑️ · កុងតាក់បិទ ➜ 📌 កុងតាក់ · បញ្ជីចុះហត្ថលេខាមិនគ្រប់ ➜ 📌 មិនទាន់ដក (មិនមែន «កុងតាក់បិទ»)', () => {
        expect(notes({ openInZoew: true, removeInZoew: true, removeHeld: '' }).join(' ')).toContain('🗑️');
        const off = notes({ openInZoew: true, removeInZoew: false, removeHeld: 'switch' }).join(' ');
        expect(off).toContain('«បិទតាម ZTO ស្វ័យប្រវត្តិ» បិទ');
        const held = notes({ openInZoew: true, removeInZoew: false, removeHeld: 'signed' }).join(' ');
        expect(held).toContain('អានបញ្ជីចុះហត្ថលេខាមិនគ្រប់');
        expect(held).not.toContain('«បិទតាម ZTO ស្វ័យប្រវត្តិ» បិទ');
        expect(notes({ openInZoew: false, removeInZoew: false, removeHeld: '' }).join(' ')).not.toContain('📌');
    });

    it('🗑️ ឈ្មោះធុងសំរាមតាមប្រភេទ ៖ ត្រឡប់ -710 · ខុសទីតាំង · បញ្ជូនចេញ · បញ្ជូនចេញមិនទាន់ពិនិត្យស្កេនបញ្ហា ➜ «ត្រឡប់»', () => {
        const bin = (row: any) => notes({ openInZoew: true, removeInZoew: true, removeHeld: '', ...row }).join(' ');
        expect(bin({})).toContain('ធុងសំរាម «ត្រឡប់»');
        expect(bin({ misplaced: true })).toContain('ធុងសំរាម «ខុសទីតាំង»');
        expect(bin({ sentOut: true })).toContain('ធុងសំរាម «បញ្ជូនចេញ»');
        expect(bin({ sentOut: true, sentUnverified: true })).toContain('ធុងសំរាម «ត្រឡប់»');
    });
});

describe('↩️ ធុងសំរាម «ត្រឡប់» ៖ ច្បាប់ ៨ ថ្ងៃ និង ZTO ស្កេនត្រឡប់ ជាថ្នាក់តែមួយ', () => {
    const DEL_AT = () => getServerNow() - CLEANUP_KEY_SWEEP_GRACE_MS - 60000;
    function returnedTrash(id: string) {
        return { id, phone: '012', scanDate: DAY, time: '08:00:00 (' + DAY + ')', createdAt: NOW_AGE(), count: 1, cod: 10, dod: 0, price: 10,
            isClosed: false, isFromDeletion: false, trashReason: 'returned', deletedAt: DEL_AT(), barcode: 'R1',
            barcodes: [{ ...barcode('R1', 10, NOW_AGE()), isDeducted: false }] };
    }

    it('ច្បាប់ ៨ ថ្ងៃ (គ្មាន `codes`) ៖ `returned` ដដែល ➜ ស្លាក «ត្រឡប់» · លុយ និងចំនួនកញ្ចប់ដក', async () => {
        const old: any = youngItem([['A', 10]]);
        const at = getServerNow() - 8 * DAY_MS;
        old.createdAt = at;
        old.barcodes[0].createdAt = at;
        seed([old]);
        await claimAndCleanupItem(ID, 'abandon');
        await flush();
        const trash = getAt(TRASH + '/' + ID);
        expect(trash.trashReason).toBe('returned');
        expect((TRASH_REASON_META as any)[trashReasonOf(trash)].label).toBe('ត្រឡប់');
        expect(ledger().codDollar).toBe(90);
        expect(ledger().totalCount).toBe(9);
    });

    it('តម្លៃតែមួយ `returned` ៖ ស្លាក «ត្រឡប់» · ២ ថ្ងៃ · គ្មាន `expired` ក្នុង App និង rules (ម្ចាស់គម្រោង ៖ «កែអោយស្អាត»)', () => {
        expect(Object.keys(TRASH_REASON_META).sort()).toEqual(['delete', 'misplaced', 'pickup', 'remove', 'returned', 'sent']);
        expect(trashReasonOf({ trashReason: 'misplaced' })).toBe('remove');
        expect(trashReasonOf({ trashReason: 'sent' })).toBe('remove');
        expect(trashRetentionMs({ trashReason: 'returned' })).toBe(RETURNED_TRASH_RETENTION_MS);
        const rules = JSON.parse(readFileSync(path.join(__dirname, '..', '..', 'firebase-database.rules.json'), 'utf8'));
        const check = rules.rules.zoew_recently_deleted_cod_dod.$itemId.trashReason['.validate'];
        expect(check).toContain("'returned'");
        expect(check).not.toContain("'expired'");
        expect(check).not.toContain("'misplaced'");
        expect(check).not.toContain("'sent'");
    });

    it('sweep កូនសោ ledger ៖ ធុងសំរាម «ត្រឡប់» ដែល flag មិនទាន់ flip ➜ flip', async () => {
        seed([]);
        const item = returnedTrash('id_r');
        setAt(TRASH + '/id_r', item);
        dataState.deletedItems = [clone(item)];
        dataState.dailyRevenueData = { [DAY]: { codDollar: 90, dodDollar: 0, totalCount: 9, ded: { id_r: { at: item.deletedAt, cod: 10, dod: 0, count: 1 } } } };
        runCleanupLedgerKeySweep();
        await flush();
        expect(getAt(TRASH + '/id_r').barcodes[0].isDeducted).toBe(true);
    });

    it('ស្តារ ៖ ធុងសំរាម «ត្រឡប់» ដែលមានកូនសោ ledger ➜ បូកវិញតាមកូនសោ', async () => {
        seed([]);
        const item = returnedTrash('id_r');
        dataState.dailyRevenueData = { [DAY]: { codDollar: 90, dodDollar: 0, totalCount: 9, ded: { id_r: { at: item.deletedAt, cod: 10, dod: 0, count: 1 } } } };
        const deltas: any[] = [];
        const proof = { at: item.deletedAt, cod: 10, dod: 0, count: 1 };
        setAt(DAILY + '/' + DAY + '/ded/id_r', proof);
        setAt(MONTHLY + '/' + MONTH + '/ded/id_r', proof);
        expect(await restoreLedgerKeyFor({ ...item, modern: true }, 'id_r', deltas)).toEqual([
            { path: DAILY + '/' + DAY + '/ded/id_r', value: { ...proof, back: true } },
            { path: MONTHLY + '/' + MONTH + '/ded/id_r', value: { ...proof, back: true } }
        ]);
        expect(deltas).toEqual(['daily', 'monthly'].map(bucket => ({ scanDate: DAY, bucket, cod: 10, dod: 0, count: 1 })));
    });

    it.each(['daily', 'monthly'])('ស្តារ ៖ ខ្វះភស្តុតាង server %s ទោះ listener មាន ➜ HOLD មិនបូកប្រាក់', async (missing) => {
        seed([]);
        const item = returnedTrash('id_r');
        const proof = { at: item.deletedAt, cod: 10, dod: 0, count: 1 };
        dataState.dailyRevenueData = { [DAY]: { ded: { id_r: proof } } };
        dataState.monthlyRevenueData = { [MONTH]: { ded: { id_r: proof } } };
        if (missing !== 'daily') setAt(DAILY + '/' + DAY + '/ded/id_r', proof);
        if (missing !== 'monthly') setAt(MONTHLY + '/' + MONTH + '/ded/id_r', proof);
        const before = clone(lab.store);
        const deltas: any[] = [];
        await expect(restoreLedgerKeyFor({ ...item, modern: true }, 'id_r', deltas)).rejects.toThrow('RESTORE_LEDGER_PROOF_REQUIRED');
        expect(deltas).toEqual([]);
        expect(lab.store).toEqual(before);
        expect(lab.tx).toEqual([]);
    });

    it('🔔 «📤 កញ្ចប់ដែលដករួច» ៖ រាប់ធុងសំរាម «ត្រឡប់» · ប្រភេទផ្សេងមិនរាប់', () => {
        const now = getServerNow();
        const view = removedParcelsView([
            { ...returnedTrash('id_r'), deletedAt: now - 3600000 },
            { id: 'id_p', phone: '014', trashReason: 'pickup', isFromDeletion: true, deletedAt: now, barcodes: [{ code: 'P1' }] },
            { id: 'id_d', phone: '015', trashReason: 'remove', isFromDeletion: false, deletedAt: now, barcodes: [{ code: 'D1' }] }
        ], now, false, []);
        expect(view.packages).toBe(1);
        expect(view.rows.map((r: any) => r.key)).toEqual(['id_r']);
        expect(trashRetentionMs({ trashReason: 'returned' })).toBe(RETURNED_TRASH_RETENTION_MS);
    });
});
