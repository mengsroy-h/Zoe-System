import { cleanupServerRead } from './helpers/cleanup-server-read';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dataState, firebaseState, uiState } from '../src/core/state';
import { getServerNow } from '../src/core/clock';
import { beginCleanupOperation, releaseCleanupOperation, claimAndCleanupItem, claimCleanupTrashSlot, cleanupInFlight, cleanupJournalLive, cleanupLedgerKeyOf, cleanupPartialTrashId, markCleanupJournalLive, noteCleanupJournalEntry, readCleanupJournal, releaseCleanupJournalLive, resumeCleanupJournalEntry } from '../src/domain/cleanup';
import { dbListenerFailedPaths, dbListenerPendingPaths } from '../src/core/text';
import { ABANDON_AGE_MS, TWO_HOURS_MS } from '../src/features/session';
import { CLEANUP_JOURNAL_KEY } from '../src/core/storage-keys';
import { deleteSingleItem } from '../src/features/entry-ops';
import { removeSingleBarcode } from '../src/features/barcode-ops';

// The second ownership read (CLEANUP_UNPROVEN_RECHECK_MS) runs at 0 ms here.
vi.mock('../src/services/tx-outcome', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../src/services/tx-outcome')>();
    return { ...actual, txDelay: () => actual.txDelay(0) };
});

const HISTORY = 'zoew_scan_history_cod_dod';
const TRASH = 'zoew_recently_deleted_cod_dod';
const DAILY = 'zoew_daily_revenue_cod_dod';
const MONTHLY = 'zoew_monthly_revenue_cod_dod';
const DAY = '2026-09-20';
const MONTH = '2026-09';
const ID = 'id_x';
const FIREBASE_HOST = 'https://shop.firebaseio.com';

type TxHook = (info: { path: string; prior: any; proposed: any; apply: () => void }) => any;
const lab = { store: {} as Record<string, any>, tx: [] as { path: string; prior: any; proposed: any }[], updates: [] as string[], hook: null as TxHook | null, refScheme: 'firebase' as 'firebase' | 'supabase' };

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
        ref: (_db: any, path = '') => makeRef(path),
        increment: (n: number) => ({ [INC]: n }),
        get: async (ref: any) => snap(ref, getAt(ref.path)),
        update: async (ref: any, updates: any) => {
            for (const key of Object.keys(updates)) {
                const path = [ref.path, key].filter(Boolean).join('/');
                let value = updates[key];
                if (value && typeof value === 'object' && value[INC] !== undefined) value = (Number(getAt(path)) || 0) + value[INC];
                setAt(path, value);
                lab.updates.push(path);
            }
        },
        runTransaction: async (ref: any, updater: any) => {
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
const appliedAfterLostReply: TxHook = ({ path, apply }) => {
    if (path !== HISTORY + '/' + ID) return undefined;
    apply();
    return { committed: true, snapshot: { val: () => getAt(path), exists: () => getAt(path) !== null }, txOutcome: 'applied' };
};
function seedItem(reason: 'abandon' | 'close') {
    const now = getServerNow();
    const closed = reason === 'close';
    const createdAt = closed ? now - 3600000 : now - ABANDON_AGE_MS - 3600000;
    const closedAt = closed ? now - TWO_HOURS_MS - 60000 : undefined;
    const barcode: any = { code: 'A', time: '08:00:00 (' + DAY + ')', cod: 10, dod: 0, locker: 'N/A', isClosed: closed, isDeducted: false, isFromDeletion: false, createdAt };
    if (closed) barcode.closedAt = closedAt;
    const item: any = { id: ID, phone: '012', scanDate: DAY, time: barcode.time, createdAt, count: 1, cod: 10, dod: 0, price: 10, isClosed: closed, isCalled: false, barcode: 'A', barcodes: [barcode] };
    if (closed) item.closedAt = closedAt;
    return item;
}
function install(reason: 'abandon' | 'close', scheme: 'firebase' | 'supabase') {
    lab.refScheme = scheme;
    const item = seedItem(reason);
    lab.store = {
        [HISTORY]: { [ID]: clone(item) },
        [TRASH]: {},
        [DAILY]: { [DAY]: { codDollar: 100, dodDollar: 0, totalCount: 10 } },
        [MONTHLY]: { [MONTH]: { codDollar: 100, dodDollar: 0, totalCount: 10 } }
    };
    firebaseState.db = { name: 'test-db' } as any;
    firebaseState.fb = makeFb() as any;
    firebaseState.firebaseConfig = (scheme === 'supabase'
        ? { supabaseUrl: 'https://abc.supabase.co', supabaseKey: 'sb_publishable_x' }
        : { databaseURL: FIREBASE_HOST }) as any;
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
    dataState.scanHistory = [clone(item)];
    dataState.deletedItems = [];
    dataState.dailyRevenueData = clone(lab.store[DAILY]);
    dataState.monthlyRevenueData = clone(lab.store[MONTHLY]);
    dataState.dailyPickupData = {};
    dataState.dailyCollectedData = {};
    return item;
}
const flush = async (n = 30) => { for (let i = 0; i < n; i++) await new Promise((resolve) => setTimeout(resolve, 0)); };
const captures = () => ((window as any).ZoeErrors.capture as any).mock.calls.map((c: any[]) => ({ message: String(c[0] && c[0].message), ...(c[1] || {}) }));
const unverifiedCaptures = () => captures().filter((c: any) => /ownership unverified/.test(c.message));
const fetchSpy = vi.fn(cleanupServerRead(getAt));

beforeEach(() => {
    lab.tx = [];
    lab.updates = [];
    lab.hook = null;
    uiState.toasts = [];
    try { localStorage.clear(); } catch {}
    (window as any).ZoeErrors = { capture: vi.fn() };
    fetchSpy.mockReset();
    fetchSpy.mockImplementation(cleanupServerRead(getAt));
    cleanupInFlight.clear();
    cleanupJournalLive.clear();
    dbListenerPendingPaths.clear();
    dbListenerFailedPaths.clear();
    vi.stubGlobal('fetch', fetchSpy);
    vi.stubGlobal('confirm', () => true);
    firebaseState.authGeneration++;
});

afterEach(() => {
    firebaseState.authGeneration++;
    firebaseState.isDatabaseConnected = false;
    firebaseState.db = null;
    for (const id of cleanupJournalLive.keys()) releaseCleanupJournalLive(id);
    vi.unstubAllGlobals();
    delete (window as any).ZoeErrors;
});

describe('automatic cleanup whose claim reply was lost (txOutcome applied) decides ownership by trash slots: its own (create-if-absent) and, on Firebase, a REST read of the slots of the other row moves', () => {
    it.each(['cleanup', 'delete', 'remove'].flatMap(action => [true, false].map(releaseOld => ({ action, releaseOld }))))('ចម្លើយ $action ក្នុង session ចាស់ (releaseOld=$releaseOld) មិនដោះ live owner និង gate របស់ session ថ្មីដែលប្រើ id ដដែល', async ({ action, releaseOld }) => {
        install('abandon', 'firebase');
        let reply!: (result: any) => void;
        lab.hook = ({ path, apply }) => {
            if (path !== HISTORY + '/' + ID) return undefined;
            apply();
            return new Promise((resolve) => { reply = resolve; });
        };
        const old = action === 'cleanup' ? claimAndCleanupItem(ID, 'abandon') : action === 'delete'
            ? deleteSingleItem(ID, { confirmed: true, quiet: true }) : removeSingleBarcode(ID, 'A');
        const trashId = readCleanupJournal()[0].trashItem.id;
        const firstOwner = cleanupJournalLive.get(trashId);
        expect(firstOwner).toBeTruthy();
        firebaseState.authGeneration++;
        if (releaseOld) releaseCleanupJournalLive(trashId);
        cleanupInFlight.clear();
        const nextOperation = beginCleanupOperation(ID);
        markCleanupJournalLive(trashId, nextOperation);
        const nextOwner = cleanupJournalLive.get(trashId);
        expect(nextOwner).not.toBe(firstOwner);
        reply({ committed: true, snapshot: snap(makeRef(HISTORY + '/' + ID), null) });
        await old;
        expect(cleanupJournalLive.get(trashId)).toBe(nextOwner);
        expect(cleanupInFlight.has(ID)).toBe(true);
        expect(getAt(TRASH + '/' + ID)).toBeNull();
        expect(getAt(DAILY + '/' + DAY).codDollar).toBe(100);
        firebaseState.authGeneration++; releaseCleanupOperation(ID, nextOperation);
    });

    it('1. Supabase · abandon whole item · applied ➜ trash written once · ledger deducted once · journal cleared · no «ownership unverified»', async () => {
        install('abandon', 'supabase');
        lab.hook = appliedAfterLostReply;
        await claimAndCleanupItem(ID, 'abandon');
        await flush();
        expect(getAt(HISTORY + '/' + ID)).toBeNull();
        const trash = getAt(TRASH + '/' + ID);
        expect(trash).not.toBeNull();
        expect(trash.trashReason).toBe('returned');
        expect(trash.barcodes[0].isDeducted).toBe(true);
        expect(getAt(DAILY + '/' + DAY).codDollar).toBe(90);
        expect(getAt(DAILY + '/' + DAY).totalCount).toBe(9);
        expect(getAt(MONTHLY + '/' + MONTH).codDollar).toBe(90);
        expect(readCleanupJournal().length).toBe(0);
        expect(dataState.deletedItems.filter((t) => t && t.id === ID).length).toBe(1);
        expect(unverifiedCaptures().length).toBe(0);
        expect(fetchSpy).not.toHaveBeenCalled();
    }, 20000);

    it('2. Supabase · close (2h) whole item · applied ➜ trash «pickup» written · money untouched · journal cleared', async () => {
        install('close', 'supabase');
        lab.hook = appliedAfterLostReply;
        await claimAndCleanupItem(ID, 'close');
        await flush();
        expect(getAt(HISTORY + '/' + ID)).toBeNull();
        const trash = getAt(TRASH + '/' + ID);
        expect(trash).not.toBeNull();
        expect(trash.trashReason).toBe('pickup');
        expect(trash.isFromDeletion).toBe(true);
        expect(getAt(DAILY + '/' + DAY).codDollar).toBe(100);
        expect(readCleanupJournal().length).toBe(0);
        expect(unverifiedCaptures().length).toBe(0);
    }, 20000);

    it('3. reverse ៖ another device already holds trash/<id> · applied ➜ nothing overwritten · no deduction · journal cleared · no duplicate local copy', async () => {
        install('abandon', 'supabase');
        const foreign = { id: ID, trashReason: 'returned', deletedAt: getServerNow() - 1000, isFromDeletion: false, scanDate: DAY, phone: '012', cod: 10, dod: 0, price: 10, count: 1, barcode: 'A',
            barcodes: [{ code: 'A', cod: 10, dod: 0, isClosed: false, isDeducted: true, isFromDeletion: false, time: '08:00:00 (' + DAY + ')', locker: 'N/A' }] };
        setAt(TRASH + '/' + ID, foreign);
        lab.hook = appliedAfterLostReply;
        await claimAndCleanupItem(ID, 'abandon');
        await flush();
        expect(getAt(TRASH + '/' + ID).deletedAt).toBe(foreign.deletedAt);
        expect(getAt(DAILY + '/' + DAY).codDollar).toBe(100);
        expect(getAt(MONTHLY + '/' + MONTH).codDollar).toBe(100);
        expect(readCleanupJournal().length).toBe(0);
        expect(dataState.deletedItems.filter((t) => t && t.id === ID).length).toBe(0);
        expect(unverifiedCaptures().length).toBe(0);
        expect(lab.updates.filter((p) => p === TRASH + '/' + ID).length).toBe(0);
    }, 20000);

    it('4. Firebase · REST មិនដំណើរការ · trash នៅសល់ · មិនកាត់ប្រាក់ដោយគ្មាន witness', async () => {
        install('abandon', 'firebase');
        fetchSpy.mockRejectedValue(new TypeError('Failed to fetch'));
        lab.hook = appliedAfterLostReply;
        await claimAndCleanupItem(ID, 'abandon');
        await flush();
        expect(getAt(TRASH + '/' + ID)).not.toBeNull();
        expect(getAt(DAILY + '/' + DAY).codDollar).toBe(100);
        expect(readCleanupJournal()).toHaveLength(1);
        expect(readCleanupJournal()[0].stage).toBe('moved');
        expect(fetchSpy).toHaveBeenCalled();
        expect(fetchSpy.mock.calls.every(([url]) => /zoew_(daily|monthly)_revenue_cod_dod|zoew_recently_deleted_cod_dod(\/|\.json\?)/.test(String(url)))).toBe(true);
        expect(fetchSpy.mock.calls.some(([url]) => /zoew_recently_deleted_cod_dod\.json\?.*orderBy/.test(String(url))), 'every trash slot of the item was read (one $key range)').toBe(true);
        expect(unverifiedCaptures().length).toBe(0);
    }, 20000);

    it('5. applied · the trash transaction rejects once (network) then commits ➜ trash once · ledger deducted once', async () => {
        install('abandon', 'supabase');
        let trashAttempts = 0;
        lab.hook = (info) => {
            if (info.path === TRASH + '/' + ID && info.prior === null && trashAttempts++ === 0) throw new Error('disconnect');
            return appliedAfterLostReply(info);
        };
        await claimAndCleanupItem(ID, 'abandon');
        await flush(60);
        expect(trashAttempts).toBe(2);
        expect(getAt(TRASH + '/' + ID)).not.toBeNull();
        expect(lab.tx.filter((t) => t.path === TRASH + '/' + ID && t.prior === null && t.proposed !== undefined).length).toBe(2);
        expect(getAt(TRASH + '/' + ID).barcodes[0].isDeducted).toBe(true);
        expect(getAt(DAILY + '/' + DAY).codDollar).toBe(90);
        expect(getAt(DAILY + '/' + DAY).totalCount).toBe(9);
        expect(readCleanupJournal().length).toBe(0);
    }, 20000);

    it('6. parity ៖ a claim acknowledged normally (no lost reply) writes the trash through the same create-if-absent slot (never a plain overwrite) and deducts once', async () => {
        install('abandon', 'supabase');
        await claimAndCleanupItem(ID, 'abandon');
        await flush();
        expect(getAt(TRASH + '/' + ID)).not.toBeNull();
        expect(lab.updates.filter((p) => p === TRASH + '/' + ID).length).toBe(0);
        expect(lab.tx.filter((t) => t.path === TRASH + '/' + ID && t.prior === null && t.proposed !== undefined).length).toBe(1);
        expect(getAt(TRASH + '/' + ID).barcodes[0].isDeducted).toBe(true);
        expect(getAt(DAILY + '/' + DAY).codDollar).toBe(90);
        expect(readCleanupJournal().length).toBe(0);
    }, 20000);
    it('7. applied · the app dies after the journal is written, before the slot claim lands ➜ the journal says «slot» (ownership unknown), never «moved»', async () => {
        install('abandon', 'supabase');
        lab.hook = (info) => {
            if (info.path === TRASH + '/' + ID) return new Promise(() => {});
            return appliedAfterLostReply(info);
        };
        claimAndCleanupItem(ID, 'abandon');
        await flush();
        const journal = readCleanupJournal();
        expect(journal.length).toBe(1);
        expect(journal[0].stage).toBe('slot');
        expect(getAt(DAILY + '/' + DAY).codDollar).toBe(100);
    }, 20000);

    const slotEntry = (item: any) => {
        const trashItem = { ...clone(item), deletedAt: getServerNow() - 5000, isFromDeletion: false, trashReason: 'returned',
            barcodes: item.barcodes.map((b: any) => ({ ...b, isDeducted: false })) };
        noteCleanupJournalEntry({ id: ID, reason: 'abandon', journalAt: trashItem.deletedAt, stage: 'slot', trashItem,
            revenue: { scanDate: DAY, cod: 10, dod: 0, count: 1 } });
        return trashItem;
    };

    it('8. resume «slot» · another device already holds trash/<id> (its own deletedAt) ➜ no deduction · its copy untouched · journal cleared', async () => {
        const item = install('abandon', 'firebase');
        setAt(HISTORY + '/' + ID, null);
        dataState.scanHistory = [];
        slotEntry(item);
        const foreign = { ...clone(item), deletedAt: getServerNow() - 1000, trashReason: 'returned', isFromDeletion: false,
            barcodes: item.barcodes.map((b: any) => ({ ...b, isDeducted: true })) };
        setAt(TRASH + '/' + ID, foreign);
        expect(await resumeCleanupJournalEntry(ID)).toBe('');
        await flush();
        expect(getAt(DAILY + '/' + DAY).codDollar).toBe(100);
        expect(getAt(TRASH + '/' + ID).deletedAt).toBe(foreign.deletedAt);
        expect(readCleanupJournal().length).toBe(0);
    }, 20000);

    it('9. resume «slot» · our own slot write landed before the app died (same deletedAt) ➜ deducted once · flipped', async () => {
        const item = install('abandon', 'firebase');
        setAt(HISTORY + '/' + ID, null);
        dataState.scanHistory = [];
        const trashItem = slotEntry(item);
        setAt(TRASH + '/' + ID, trashItem);
        await resumeCleanupJournalEntry(ID);
        await flush();
        expect(getAt(DAILY + '/' + DAY).codDollar).toBe(90);
        expect(getAt(DAILY + '/' + DAY).totalCount).toBe(9);
        expect(getAt(TRASH + '/' + ID).barcodes[0].isDeducted).toBe(true);
        expect(readCleanupJournal().length).toBe(0);
    }, 20000);

    it('10. resume «slot» · trash absent and the item is not back in history ➜ slot claimed · deducted once · flipped', async () => {
        const item = install('abandon', 'firebase');
        setAt(HISTORY + '/' + ID, null);
        dataState.scanHistory = [];
        slotEntry(item);
        expect(await resumeCleanupJournalEntry(ID)).toBe('restored');
        await flush();
        expect(getAt(TRASH + '/' + ID).barcodes[0].isDeducted).toBe(true);
        expect(getAt(DAILY + '/' + DAY).codDollar).toBe(90);
        expect(readCleanupJournal().length).toBe(0);
    }, 20000);

    it('11. resume «slot» · the item is back in history under its id ➜ no trash write · no deduction · journal cleared · a stale view waits', async () => {
        const item = install('abandon', 'firebase');
        slotEntry(item);
        dbListenerPendingPaths.add('history');
        expect(await resumeCleanupJournalEntry(ID)).toBe('');
        expect(readCleanupJournal().length).toBe(1);
        dbListenerPendingPaths.clear();
        expect(await resumeCleanupJournalEntry(ID)).toBe('');
        await flush();
        expect(getAt(TRASH + '/' + ID)).toBeNull();
        expect(getAt(DAILY + '/' + DAY).codDollar).toBe(100);
        expect(readCleanupJournal().length).toBe(0);
    }, 20000);
});

// ⛔ ឧបករណ៍ ២ claim barcode ដដែលដែលទុំ ៖ X commit ធម្មតា · Y ផ្ញើពីទិដ្ឋភាពមុន X ហើយចម្លើយបាត់ ➜ ការអាន server ឃើញតម្លៃនៅសល់ដូចដែល Y ផ្ញើ (X សរសេរដូចគ្នា)
//    ➜ `applied` ទោះ Y មិនមែនជាអ្នកដក។ ធុងសំរាមរបស់ X មិនទាន់មកដល់ទិដ្ឋភាព Y ➜ Y សរសេរធុងសំរាមទី ២ + ដកលុយទី ២។ ការ claim ដែលដូចគ្នាត្រូវមាន id ធុងសំរាមតែមួយ
//    (កំណត់ពី item + barcode ដែល claim) ហើយ slot (create-if-absent) ជាអ្នកសម្រេចម្ចាស់ ➜ ដកតែម្តង មិនថាលំដាប់ណា។
const PARTIAL_DAY_COD = 100;
function seedPartial(reason: 'abandon' | 'close') {
    const item = install(reason, 'firebase');
    const now = getServerNow();
    const young: any = { ...clone(item.barcodes[0]), code: 'B', cod: 7 };
    if (reason === 'abandon') young.restoredAt = now - 3600000;
    else { young.closedAt = now - 60000; }
    item.barcodes.push(young);
    item.count = 2;
    item.cod = 17;
    item.price = 17;
    setAt(HISTORY + '/' + ID, item);
    dataState.scanHistory = [clone(item)];
    return item;
}
function canonical(value: any): string {
    if (value === null || value === undefined) return 'null';
    if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
    if (typeof value === 'object') return '{' + Object.keys(value).filter((k) => value[k] !== undefined).sort().map((k) => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
    return JSON.stringify(value);
}
function lateAppliedFrom(seen: any) {
    const realTx = firebaseState.fb.runTransaction;
    let pending = clone(seen);
    const probe = { equal: false, used: false };
    (firebaseState.fb as any).runTransaction = async (ref: any, updater: any) => {
        if (ref.path === HISTORY + '/' + ID && pending) {
            const view = pending;
            pending = null;
            probe.used = true;
            const proposed = updater(clone(view));
            probe.equal = canonical(prune(clone(proposed))) === canonical(getAt(ref.path));
            return { committed: true, snapshot: snap(ref, getAt(ref.path)), txOutcome: 'applied' };
        }
        return realTx(ref, updater);
    };
    return probe;
}
const trashCopiesOf = (code: string): any[] => Object.values(getAt(TRASH) || {}).filter((t: any) => t && Array.isArray(t.barcodes) && t.barcodes.some((b: any) => b && b.code === code));
function holdFirstTrashWrite() {
    const gate: { release: () => void; held: boolean } = { release: () => {}, held: false };
    const opened = new Promise<void>((resolve) => { gate.release = resolve; });
    const fb: any = firebaseState.fb;
    const realUpdate = fb.update;
    const realTx = fb.runTransaction;
    let first = true;
    const isTrash = (path: string) => path === TRASH || path.startsWith(TRASH + '/');
    fb.update = async (ref: any, updates: any) => {
        if (first && isTrash(ref.path)) { first = false; gate.held = true; await opened; }
        return realUpdate(ref, updates);
    };
    fb.runTransaction = async (ref: any, updater: any) => {
        if (first && isTrash(ref.path)) { first = false; gate.held = true; await opened; }
        return realTx(ref, updater);
    };
    return gate;
}

describe('two devices claim the same ripe barcodes · the late one resolves «applied» ➜ one trash copy · one deduction', () => {
    it('12. partial abandon · X finishes first · Y (stale trash view) resolves applied ➜ no second trash · deducted once', async () => {
        const original = seedPartial('abandon');
        await claimAndCleanupItem(ID, 'abandon');
        await flush();
        expect(getAt(DAILY + '/' + DAY).codDollar).toBe(PARTIAL_DAY_COD - 10);
        expect(trashCopiesOf('A').length).toBe(1);
        dataState.deletedItems = [];
        dataState.scanHistory = [clone(original)];
        dataState.dailyRevenueData = clone(getAt(DAILY));
        dataState.monthlyRevenueData = clone(getAt(MONTHLY));
        const probe = lateAppliedFrom(original);
        await claimAndCleanupItem(ID, 'abandon');
        await flush(60);
        expect(probe.used && probe.equal).toBe(true);
        expect(trashCopiesOf('A').length).toBe(1);
        expect(getAt(DAILY + '/' + DAY).codDollar).toBe(PARTIAL_DAY_COD - 10);
        expect(getAt(MONTHLY + '/' + MONTH).codDollar).toBe(PARTIAL_DAY_COD - 10);
        expect(getAt(HISTORY + '/' + ID).barcodes.map((b: any) => b.code)).toEqual(['B']);
        expect(readCleanupJournal().length).toBe(0);
    }, 20000);

    it('13. partial close (2h) · X finishes first · Y resolves applied ➜ one «pickup» trash copy (no duplicate barcode to restore twice)', async () => {
        const original = seedPartial('close');
        await claimAndCleanupItem(ID, 'close');
        await flush();
        expect(trashCopiesOf('A').length).toBe(1);
        dataState.deletedItems = [];
        dataState.scanHistory = [clone(original)];
        const probe = lateAppliedFrom(original);
        await claimAndCleanupItem(ID, 'close');
        await flush(60);
        expect(probe.used && probe.equal).toBe(true);
        expect(trashCopiesOf('A').length).toBe(1);
        expect(getAt(DAILY + '/' + DAY).codDollar).toBe(PARTIAL_DAY_COD);
        expect(readCleanupJournal().length).toBe(0);
    }, 20000);

    it('14. partial abandon · X commits but its trash write is delayed · Y resolves applied and writes first ➜ X never overwrites · deducted once', async () => {
        const original = seedPartial('abandon');
        const gate = holdFirstTrashWrite();
        const xRun = claimAndCleanupItem(ID, 'abandon');
        await flush();
        expect(gate.held).toBe(true);
        expect(getAt(HISTORY + '/' + ID).barcodes.map((b: any) => b.code)).toEqual(['B']);
        const xJournal = localStorage.getItem(CLEANUP_JOURNAL_KEY);
        localStorage.removeItem(CLEANUP_JOURNAL_KEY);
        cleanupInFlight.delete(ID);
        cleanupJournalLive.clear();
        dataState.deletedItems = [];
        dataState.scanHistory = [clone(original)];
        const probe = lateAppliedFrom(original);
        await claimAndCleanupItem(ID, 'abandon');
        await flush(60);
        expect(probe.used && probe.equal).toBe(true);
        if (xJournal !== null) localStorage.setItem(CLEANUP_JOURNAL_KEY, xJournal);
        gate.release();
        await xRun;
        await flush(60);
        expect(trashCopiesOf('A').length).toBe(1);
        expect(getAt(DAILY + '/' + DAY).codDollar).toBe(PARTIAL_DAY_COD - 10);
        expect(getAt(MONTHLY + '/' + MONTH).codDollar).toBe(PARTIAL_DAY_COD - 10);
        expect(trashCopiesOf('A')[0].barcodes.find((b: any) => b.code === 'A').isDeducted).toBe(true);
    }, 20000);

    it('15. whole abandon · X commits but its trash write is delayed · Y resolves applied (sent null · server null) and claims the slot first ➜ X never overwrites · deducted once', async () => {
        const original = install('abandon', 'firebase');
        const gate = holdFirstTrashWrite();
        const xRun = claimAndCleanupItem(ID, 'abandon');
        await flush();
        expect(gate.held).toBe(true);
        expect(getAt(HISTORY + '/' + ID)).toBeNull();
        const xJournal = localStorage.getItem(CLEANUP_JOURNAL_KEY);
        localStorage.removeItem(CLEANUP_JOURNAL_KEY);
        cleanupInFlight.delete(ID);
        cleanupJournalLive.clear();
        dataState.deletedItems = [];
        dataState.scanHistory = [clone(original)];
        const probe = lateAppliedFrom(original);
        await claimAndCleanupItem(ID, 'abandon');
        await flush(60);
        expect(probe.used && probe.equal).toBe(true);
        if (xJournal !== null) localStorage.setItem(CLEANUP_JOURNAL_KEY, xJournal);
        gate.release();
        await xRun;
        await flush(60);
        expect(trashCopiesOf('A').length).toBe(1);
        expect(getAt(DAILY + '/' + DAY).codDollar).toBe(90);
        expect(getAt(MONTHLY + '/' + MONTH).codDollar).toBe(90);
        expect(getAt(TRASH + '/' + ID).barcodes[0].isDeducted).toBe(true);
    }, 20000);
});

describe('ការកាន់កាប់ trash slot ពេលប្ដូរ session', () => {
    it.each(['old', 'new'])('timeout ក្នុង session ដដែល · $0 ចប់មុនមិនដោះ journal របស់ការងារដែលនៅរស់', (firstToFinish) => {
        install('abandon', 'firebase');
        const oldOperation = beginCleanupOperation(ID);
        markCleanupJournalLive(ID, oldOperation);
        releaseCleanupOperation(ID, oldOperation, true);
        const nextOperation = beginCleanupOperation(ID);
        markCleanupJournalLive(ID, nextOperation);
        const owner = cleanupJournalLive.get(ID);
        releaseCleanupOperation(ID, firstToFinish === 'old' ? oldOperation : nextOperation);
        expect(cleanupJournalLive.get(ID)).toBe(owner);
        expect(cleanupInFlight.has(ID)).toBe(firstToFinish === 'old');
        releaseCleanupOperation(ID, firstToFinish === 'old' ? nextOperation : oldOperation);
        expect(cleanupJournalLive.has(ID)).toBe(false);
        expect(cleanupInFlight.has(ID)).toBe(false);
    });

    it('CAS retry ចាស់មិនសរសេរ trash ក្រោយប្ដូរ session', async () => {
        const original = install('abandon', 'firebase');
        const trash = { ...clone(original), deletedAt: getServerNow(), trashReason: 'returned' };
        let retry: any;
        let reply: any;
        firebaseState.fb.runTransaction = vi.fn((_ref, updater) => {
            retry = updater;
            return new Promise(resolve => { reply = resolve; });
        });
        const old = claimCleanupTrashSlot(trash);
        firebaseState.authGeneration++;
        const proposed = retry(null);
        reply({ committed: false, snapshot: snap(makeRef(TRASH + '/' + ID), null) });
        await old;
        expect(proposed).toBeUndefined();
        expect(getAt(DAILY + '/' + DAY).codDollar).toBe(100);
    });

    it('ចម្លើយ slot ចាស់មិនផ្លាស់ journal ឬដោះ owner ថ្មីក្រោយប្ដូរ session', async () => {
        const original = install('abandon', 'firebase');
        const trash = { ...clone(original), deletedAt: getServerNow(), trashReason: 'returned' };
        const operation = beginCleanupOperation(ID);
        markCleanupJournalLive(ID, operation);
        noteCleanupJournalEntry({ id: ID, reason: 'abandon', stage: 'slot', trashItem: trash });
        let reply: any;
        const tx = vi.fn().mockImplementationOnce(() => new Promise(resolve => { reply = resolve; }))
            .mockResolvedValue({ committed: true });
        firebaseState.fb.runTransaction = tx;
        const old = claimCleanupTrashSlot(trash, false, operation);
        firebaseState.authGeneration++;
        const nextOperation = beginCleanupOperation(ID);
        markCleanupJournalLive(ID, nextOperation);
        const nextOwner = cleanupJournalLive.get(ID);
        reply({ committed: false, snapshot: snap(makeRef(TRASH + '/' + ID), {
            id: ID, deletedAt: trash.deletedAt - 10000, barcodes: [{ code: 'OTHER' }]
        }) });
        const outcome = await old;
        expect(outcome).toBe(false);
        expect(trash.id).toBe(ID);
        expect(tx).toHaveBeenCalledTimes(1);
        expect(readCleanupJournal().map(entry => entry.trashItem.id)).toEqual([ID]);
        expect(cleanupJournalLive.get(ID)).toBe(nextOwner);
        expect(cleanupInFlight.has(ID)).toBe(true);
        expect(getAt(DAILY + '/' + DAY).codDollar).toBe(100);
        firebaseState.authGeneration++;
        releaseCleanupOperation(ID, nextOperation);
    });
});

describe('cleanupPartialTrashId ៖ one claim = one trash id on every device · a new lifecycle = a new id', () => {
    const claim = (barcodes: any[], createdAt = 1700000000000) => ({ id: 'id_1700000000000_abc123def', createdAt, barcodes });
    it('16. same item + same barcodes (any order) ➜ same id · fits the keyed-ledger id shape (≤ 64) · parses back to the item timestamp', () => {
        const a = cleanupPartialTrashId('id_1700000000000_abc123def', 'abandon', claim([{ code: 'A' }, { code: 'B', restoredAt: 5 }]));
        const b = cleanupPartialTrashId('id_1700000000000_abc123def', 'abandon', claim([{ code: 'B', restoredAt: 5 }, { code: 'A' }]));
        expect(a).toBe(b);
        expect(/^[a-zA-Z0-9_-]{1,64}$/.test(a)).toBe(true);
        expect(a.split('_')[1]).toBe('1700000000000');
    });
    it('17. a restored barcode (new restoredAt) · a new close stamp · another reason · another set ➜ another id', () => {
        const base = cleanupPartialTrashId('id_1700000000000_abc123def', 'abandon', claim([{ code: 'A' }]));
        expect(cleanupPartialTrashId('id_1700000000000_abc123def', 'abandon', claim([{ code: 'A', restoredAt: 9 }]))).not.toBe(base);
        expect(cleanupPartialTrashId('id_1700000000000_abc123def', 'close', claim([{ code: 'A', closedAt: 9 }]))).not.toBe(base);
        expect(cleanupPartialTrashId('id_1700000000000_abc123def', 'close', claim([{ code: 'A' }]))).not.toBe(base);
        expect(cleanupPartialTrashId('id_1700000000000_abc123def', 'abandon', claim([{ code: 'A' }, { code: 'B' }]))).not.toBe(base);
        expect(cleanupPartialTrashId('id_1700000000001_abc123def', 'abandon', claim([{ code: 'A' }]))).not.toBe(base);
    });
    it('18. a trash id restored into history and claimed again keeps the same length (no growth past the ledger id limit)', () => {
        let id = 'id_1700000000000_abc123def';
        for (let round = 0; round < 6; round++) id = cleanupPartialTrashId(id, 'abandon', claim([{ code: 'A', restoredAt: round }]));
        expect(id.length).toBe(cleanupPartialTrashId('id_1700000000000_abc123def', 'abandon', claim([{ code: 'A' }])).length);
        expect(/^[a-zA-Z0-9_-]{1,64}$/.test(id)).toBe(true);
    });
    it('19. the partial abandon deduction is keyed on the deterministic id (ded/<trashId> with its deletedAt)', async () => {
        seedPartial('abandon');
        await claimAndCleanupItem(ID, 'abandon');
        await flush();
        const trash: any = trashCopiesOf('A')[0];
        expect(trash.id.startsWith('id_')).toBe(true);
        expect(getAt(DAILY + '/' + DAY).ded[trash.id].at).toBe(trash.deletedAt);
        dataState.dailyRevenueData = clone(getAt(DAILY));
        expect(cleanupLedgerKeyOf(trash)).toEqual({ scanDate: DAY });
    }, 20000);
});
