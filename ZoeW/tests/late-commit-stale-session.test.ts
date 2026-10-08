import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dataState, firebaseState, uiState } from '../src/core/state';
import { getServerNow } from '../src/core/clock';
import { claimAndCleanupItem, cleanupInFlight, cleanupJournalLive } from '../src/domain/cleanup';
import { deleteSingleItem } from '../src/features/entry-ops';
import { runTransactionResolved } from '../src/services/tx-outcome';
import { dbListenerFailedPaths, dbListenerPendingPaths } from '../src/core/text';
import { ABANDON_AGE_MS } from '../src/features/session';

const HISTORY = 'zoew_scan_history_cod_dod';
const TRASH = 'zoew_recently_deleted_cod_dod';
const DAILY = 'zoew_daily_revenue_cod_dod';
const MONTHLY = 'zoew_monthly_revenue_cod_dod';
const DAY = '2026-09-20';
const MONTH = '2026-09';
const ID = 'id_x';
const FIREBASE_HOST = 'https://shop.firebaseio.com';

type TxHook = (info: { path: string; prior: any; proposed: any; apply: () => void }) => any;
const lab = { store: {} as Record<string, any>, tx: [] as { path: string; prior: any; proposed: any }[], updates: [] as string[], hook: null as TxHook | null, refScheme: 'firebase' as 'firebase' | 'supabase', historyGate: null as Promise<void> | null, trashGate: null as Promise<void> | null };

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
    return { path: p, key: split(p).pop() || null, toString: () => (lab.refScheme === 'supabase' ? 'supabase:' + p : FIREBASE_HOST + '/' + p) };
}
function snap(ref: any, value: any) {
    return { key: ref && ref.key, ref, val: () => clone(value), exists: () => value !== null && value !== undefined };
}
function makeFb() {
    return {
        ref: (db: any, path = '') => makeRef((db && db.name === 'B' ? 'B/' : '') + path),
        increment: (n: number) => ({ [INC]: n }),
        get: async (ref: any) => snap(ref, getAt(ref.path)),
        update: async (ref: any, updates: any) => {
            if (lab.trashGate && split(ref.path)[0] === TRASH) await lab.trashGate;
            for (const key of Object.keys(updates)) {
                const path = [ref.path, key].filter(Boolean).join('/');
                let value = updates[key];
                if (value && typeof value === 'object' && value[INC] !== undefined) value = (Number(getAt(path)) || 0) + value[INC];
                setAt(path, value);
                lab.updates.push(path);
            }
        },
        runTransaction: async (ref: any, updater: any) => {
            if (lab.historyGate && split(ref.path)[0] === HISTORY) await lab.historyGate;
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
function seedItem() {
    const now = getServerNow();
    const createdAt = now - ABANDON_AGE_MS - 3600000;
    const barcode: any = { code: 'A', time: '08:00:00 (' + DAY + ')', cod: 10, dod: 0, locker: 'N/A', isClosed: false, isDeducted: false, isFromDeletion: false, createdAt };
    return { id: ID, phone: '012', scanDate: DAY, time: barcode.time, createdAt, count: 1, cod: 10, dod: 0, price: 10, isClosed: false, isCalled: false, barcode: 'A', barcodes: [barcode] };
}
const ledgerNode = () => ({ [DAY]: { codDollar: 100, dodDollar: 0, totalCount: 10 } });
const monthNode = () => ({ [MONTH]: { codDollar: 100, dodDollar: 0, totalCount: 10 } });
function pointAt(shop: 'A' | 'B') {
    const p = shop === 'B' ? 'B/' : '';
    firebaseState.db = { name: shop } as any;
    firebaseState.dbRefHistory = makeRef(p + HISTORY) as any;
    firebaseState.dbRefDeleted = makeRef(p + TRASH) as any;
    firebaseState.dbRefDailyRevenue = makeRef(p + DAILY) as any;
    firebaseState.dbRefMonthlyRevenue = makeRef(p + MONTHLY) as any;
    firebaseState.dbRefDailyPickup = makeRef(p + 'zoew_daily_pickup_cod_dod') as any;
    firebaseState.dbRefDailyCollected = makeRef(p + 'zoew_daily_collected_cod_dod') as any;
}
function install() {
    const item = seedItem();
    lab.store = {
        [HISTORY]: { [ID]: clone(item) },
        [DAILY]: ledgerNode(),
        [MONTHLY]: monthNode(),
        B: { [HISTORY]: { other: { id: 'other', phone: '099', scanDate: DAY, count: 1, cod: 1, dod: 0, price: 1, barcodes: [{ code: 'Z', cod: 1, dod: 0 }] } }, [DAILY]: ledgerNode(), [MONTHLY]: monthNode() }
    };
    firebaseState.fb = makeFb() as any;
    firebaseState.firebaseConfig = { databaseURL: FIREBASE_HOST } as any;
    firebaseState.auth = { currentUser: { uid: 'u1', getIdToken: async () => 'tok' } } as any;
    firebaseState.isDatabaseInitialized = true;
    firebaseState.isDatabaseConnected = true;
    firebaseState.serverClockTrusted = true;
    firebaseState.hasEverConnectedToDatabase = true;
    pointAt('A');
    dataState.scanHistory = [clone(item)];
    dataState.deletedItems = [];
    dataState.dailyRevenueData = ledgerNode();
    dataState.monthlyRevenueData = monthNode();
    dataState.dailyPickupData = {};
    dataState.dailyCollectedData = {};
}
function switchToShopB() {
    firebaseState.authGeneration++;
    pointAt('B');
    dataState.scanHistory = [];
    dataState.deletedItems = [];
    dataState.dailyRevenueData = ledgerNode();
    dataState.monthlyRevenueData = monthNode();
}
function gate() {
    let open!: () => void;
    const promise = new Promise<void>((resolve) => { open = resolve; });
    return { promise, open };
}
const flush = async (n = 40) => { for (let i = 0; i < n; i++) await new Promise((resolve) => setTimeout(resolve, 0)); };
const captures = () => ((window as any).ZoeErrors.capture as any).mock.calls.map((c: any[]) => ({ message: String(c[0] && c[0].message), ...(c[1] || {}) }));

beforeEach(() => {
    lab.tx = [];
    lab.updates = [];
    lab.hook = null;
    lab.historyGate = null;
    lab.trashGate = null;
    lab.refScheme = 'firebase';
    uiState.toasts = [];
    try { localStorage.clear(); } catch {}
    (window as any).ZoeErrors = { capture: vi.fn() };
    cleanupInFlight.clear();
    cleanupJournalLive.clear();
    dbListenerPendingPaths.clear();
    dbListenerFailedPaths.clear();
    vi.stubGlobal('confirm', () => true);
    firebaseState.authGeneration++;
});

afterEach(() => {
    vi.unstubAllGlobals();
    delete (window as any).ZoeErrors;
});

describe('late work after a switch to another shop never writes into the new shop (RACES-2)', () => {
    it('1. outcome resolver ៖ the session switches while the REST read is in flight ➜ never «applied»', async () => {
        install();
        const ref = makeRef(HISTORY + '/' + ID);
        const sdk = {
            runTransaction: async (_ref: any, updater: any) => {
                updater(null);
                throw new Error('disconnect');
            }
        };
        vi.stubGlobal('fetch', vi.fn(async () => {
            switchToShopB();
            return new Response(JSON.stringify({ ok: 1 }), { status: 200 });
        }));
        const out: any = await runTransactionResolved(sdk, ref, () => ({ ok: 1 })).then((r: any) => ({ resolved: r }), (e: any) => ({ rejected: e }));
        expect(out.resolved).toBeUndefined();
        expect(out.rejected && out.rejected.txOutcome).not.toBe('applied');
    });

    it('2. cleanup claim commits after the switch ➜ shop B trash and ledger untouched · Sentry money', async () => {
        install();
        const g = gate();
        lab.historyGate = g.promise;
        const run = claimAndCleanupItem(ID, 'abandon');
        await flush(5);
        switchToShopB();
        lab.historyGate = null;
        g.open();
        await run;
        await flush();
        expect(getAt('B/' + TRASH)).toBeNull();
        expect(getAt('B/' + DAILY + '/' + DAY).codDollar).toBe(100);
        expect(getAt('B/' + MONTHLY + '/' + MONTH).codDollar).toBe(100);
        expect(captures().some((c: any) => c.zone === 'money' && /switch/i.test(c.message + ' ' + (c.context || '')))).toBe(true);
    }, 20000);

    it('3. the switch lands while the trash write hangs ➜ the ledger step never runs in shop B', async () => {
        install();
        const g = gate();
        lab.trashGate = g.promise;
        const run = claimAndCleanupItem(ID, 'abandon');
        await flush(10);
        switchToShopB();
        lab.trashGate = null;
        g.open();
        await run;
        await flush();
        expect(getAt('B/' + DAILY + '/' + DAY).codDollar).toBe(100);
        expect(getAt('B/' + DAILY + '/' + DAY).totalCount).toBe(10);
        expect(getAt('B/' + MONTHLY + '/' + MONTH).codDollar).toBe(100);
        expect(getAt('B/' + TRASH)).toBeNull();
    }, 20000);

    it('4. delete whose claim commits after the switch ➜ shop B trash untouched', async () => {
        install();
        const g = gate();
        lab.historyGate = g.promise;
        const run = deleteSingleItem(ID);
        await flush(5);
        switchToShopB();
        lab.historyGate = null;
        g.open();
        await run;
        await flush();
        expect(getAt('B/' + TRASH)).toBeNull();
        expect(dataState.deletedItems.length).toBe(0);
    }, 20000);

    it('5. reverse ៖ no switch ➜ trash and one deduction land in shop A', async () => {
        install();
        await claimAndCleanupItem(ID, 'abandon');
        await flush();
        expect(getAt(HISTORY + '/' + ID)).toBeNull();
        expect(getAt(TRASH + '/' + ID)).not.toBeNull();
        expect(getAt(DAILY + '/' + DAY).codDollar).toBe(90);
        expect(getAt('B/' + DAILY + '/' + DAY).codDollar).toBe(100);
    }, 20000);
});
