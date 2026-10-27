import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dataState, firebaseState, uiState } from '../src/core/state';
import { getServerNow } from '../src/core/clock';
import { normalizeBarcodesOf } from '../src/domain/barcode';
import { dbListenerFailedPaths, dbListenerPendingPaths } from '../src/core/text';
import { claimAndCleanupItem, cleanupInFlight, cleanupJournalLive, prepareCleanupClaim, readCleanupJournal, resumeCleanupJournalEntry, restoreClaimedItemToScanHistory } from '../src/domain/cleanup';
import { activeRestoreClaims, claimDeletedItemForRestore, executeRestoreItem, findRestoreTargetId, restoreInFlight, restoreLedgerKeyFor, saveRestoreClaim } from '../src/features/restore';
import { removeSingleBarcode, saveEditedBarcodePrice } from '../src/features/barcode-ops';
import { refTo, setFieldValue } from '../src/app/refs';
import { addRevenueToDailyAndMonthlyRecord, commitMonthlyRevenueDelta, ledgerEventDecision, ledgerJournalUpdate } from '../src/domain/ledger';
import { deleteSingleItem } from '../src/features/entry-ops';
import { ABANDON_AGE_MS } from '../src/features/session';

// ⛔ ការសរសេរធុងសំរាមរបស់ ការសម្អាត ៨ ថ្ងៃ · លុប · ដក សាកឡើងវិញ (`retryAsync()` ១,៥ · ៣ · ៦ វិ.) ៖ ការសាកលើកក្រោយដែលកើតក្រោយការចាកចេញ/ប្តូរ Config
//    ជាការសរសេរថ្មីក្រោម session ថ្មី (Supabase ៖ គណនីថ្មី ➜ tenant ផ្សេងក្នុង Project ដដែល · Firebase ៖ Database ថ្មី) ➜ កញ្ចប់របស់ហាង A ចូលធុងសំរាមហាង B។
//    ផ្លូវ «ដក» ៖ ការសរសេរបរាជ័យ ➜ ស្តារ barcode ចូលប្រវត្តិ ➜ ត្រូវតែក្នុង session ដើមដែរ។
const HISTORY = 'zoew_scan_history_cod_dod';
const TRASH = 'zoew_recently_deleted_cod_dod';
const DAILY = 'zoew_daily_revenue_cod_dod';
const MONTHLY = 'zoew_monthly_revenue_cod_dod';
const DAY = '2026-09-20';
const ID = 'id_1758000000000_aaaa1';
const DB_A = { name: 'shop-a' };
const DB_B = { name: 'shop-b' };

const lab = { store: {} as Record<string, any>, writes: [] as { db: any; path: string }[], failFirstTrash: true, onTrashFail: null as null | (() => void) };

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
function makeRef(db: any, path = '') {
    const p = split(path).join('/');
    return { db, path: p, key: split(p).pop() || null, toString: () => 'https://shop.firebaseio.com/' + p };
}
function snap(ref: any, value: any) {
    return { key: ref && ref.key, ref, val: () => clone(value), exists: () => value !== null && value !== undefined };
}
const isTrash = (path: string) => path === TRASH || path.startsWith(TRASH + '/');
function trashFailure() {
    if (!lab.failFirstTrash) return null;
    lab.failFirstTrash = false;
    if (lab.onTrashFail) lab.onTrashFail();
    return Promise.reject(Object.assign(new Error('network error'), { code: 'NETWORK_ERROR' }));
}
function makeFb() {
    return {
        ref: (db: any, path = '') => makeRef(db, path),
        increment: (n: number) => ({ __inc__: n }),
        get: async (ref: any) => snap(ref, getAt(ref.path)),
        update: async (ref: any, updates: any) => {
            for (const key of Object.keys(updates)) {
                const path = [ref.path, key].filter(Boolean).join('/');
                if (isTrash(path)) { const failed = trashFailure(); if (failed) return failed; }
                lab.writes.push({ db: ref.db, path });
                let value = updates[key];
                if (value && typeof value === 'object' && value.__inc__ !== undefined) value = (Number(getAt(path)) || 0) + value.__inc__;
                setAt(path, value);
            }
        },
        runTransaction: async (ref: any, updater: any) => {
            if (isTrash(ref.path)) { const failed = trashFailure(); if (failed) return failed; }
            const prior = getAt(ref.path);
            const proposed = updater(clone(prior));
            if (proposed === undefined) return { committed: false, snapshot: snap(ref, prior) };
            lab.writes.push({ db: ref.db, path: ref.path });
            setAt(ref.path, proposed);
            return { committed: true, snapshot: snap(ref, getAt(ref.path)) };
        },
        onValue: () => () => {},
        off: () => {}
    };
}
function itemOf(createdAt: number) {
    const b = { code: 'C', time: '08:00:00 (' + DAY + ')', cod: 7, dod: 0, locker: 'N/A', isClosed: false, isDeducted: false, isFromDeletion: false, createdAt };
    const d = { ...b, code: 'D', cod: 3 };
    return { id: ID, phone: '012', scanDate: DAY, time: b.time, createdAt, count: 2, cod: 10, dod: 0, price: 10, isClosed: false, isCalled: false, barcode: 'C', barcodes: [b, d] };
}
function install(createdAt: number) {
    const item = itemOf(createdAt);
    lab.store = {
        [HISTORY]: { [ID]: clone(item) },
        [DAILY]: { [DAY]: { codDollar: 100, dodDollar: 0, totalCount: 10 } },
        [MONTHLY]: { '2026-09': { codDollar: 100, dodDollar: 0, totalCount: 10 } }
    };
    firebaseState.db = DB_A as any;
    firebaseState.fb = makeFb() as any;
    firebaseState.firebaseConfig = { databaseURL: 'https://shop.firebaseio.com' } as any;
    firebaseState.auth = { currentUser: { uid: 'u1', getIdToken: async () => 'tok' } } as any;
    firebaseState.isDatabaseInitialized = true;
    firebaseState.isDatabaseConnected = true;
    firebaseState.serverClockTrusted = true;
    firebaseState.hasEverConnectedToDatabase = true;
    firebaseState.dbRefHistory = makeRef(DB_A, HISTORY) as any;
    firebaseState.dbRefDeleted = makeRef(DB_A, TRASH) as any;
    firebaseState.dbRefDailyRevenue = makeRef(DB_A, DAILY) as any;
    firebaseState.dbRefMonthlyRevenue = makeRef(DB_A, MONTHLY) as any;
    firebaseState.dbRefDailyPickup = makeRef(DB_A, 'zoew_daily_pickup_cod_dod') as any;
    firebaseState.dbRefDailyCollected = makeRef(DB_A, 'zoew_daily_collected_cod_dod') as any;
    dataState.scanHistory = [clone(item)];
    dataState.deletedItems = [];
    dataState.dailyRevenueData = clone(lab.store[DAILY]);
    dataState.monthlyRevenueData = clone(lab.store[MONTHLY]);
    dataState.dailyPickupData = {};
    dataState.dailyCollectedData = {};
}
function switchToShopB() {
    firebaseState.authGeneration++;
    firebaseState.db = DB_B as any;
    firebaseState.dbRefHistory = makeRef(DB_B, HISTORY) as any;
    firebaseState.dbRefDeleted = makeRef(DB_B, TRASH) as any;
    firebaseState.dbRefDailyRevenue = makeRef(DB_B, DAILY) as any;
    firebaseState.dbRefMonthlyRevenue = makeRef(DB_B, MONTHLY) as any;
}
const writesTo = (db: any) => lab.writes.filter((w) => w.db === db).map((w) => w.path);
const waitRetries = () => new Promise((resolve) => setTimeout(resolve, 1800));

beforeEach(() => {
    lab.writes = [];
    lab.failFirstTrash = true;
    lab.onTrashFail = null;
    uiState.toasts = [];
    uiState.scanRemoveInFlight = null;
    try { localStorage.clear(); } catch {}
    (window as any).ZoeErrors = { capture: vi.fn() };
    cleanupInFlight.clear();
    cleanupJournalLive.clear();
    activeRestoreClaims.clear();
    restoreInFlight.clear();
    dbListenerPendingPaths.clear();
    dbListenerFailedPaths.clear();
    vi.stubGlobal('confirm', () => true);
    vi.stubGlobal('alert', () => {});
    vi.stubGlobal('fetch', async (url: string) => new Response(JSON.stringify(getAt(new URL(url).pathname.replace(/\.json$/, ''))), { status: 200 }));
    firebaseState.authGeneration++;
});

describe('លុប/ស្តារ ៖ បាត់ ACK និង read ចាស់មកក្រោយ listener', () => {
    it('partial claim ដែលមិនទាន់ដល់ server មិនបង្កើត trash ឬដកប្រាក់ពេលបើក App វិញ', async () => {
        install(getServerNow() - 3600000);
        lab.failFirstTrash = false;
        const item = itemOf(getServerNow() - 3600000);
        const entry = prepareCleanupClaim(ID, 'remove', null, { ...item, barcodes: [item.barcodes[0]] });
        cleanupJournalLive.clear();
        await resumeCleanupJournalEntry(entry.trashItem.id);
        expect(getAt(HISTORY + '/' + ID).barcodes.map((b: any) => b.code)).toEqual(['C', 'D']);
        expect(Object.keys(lab.store[TRASH] || {})).toHaveLength(0);
        expect(getAt(DAILY + '/' + DAY).codDollar).toBe(100);
        expect(getAt(MONTHLY + '/2026-09').codDollar).toBe(100);
        expect(readCleanupJournal()).toEqual([]);
    });
    it('រក្សា before-image មុន server លុប history ហើយអាចរកចូល trash វិញ ដោយមិនកែប្រាក់', async () => {
        install(getServerNow() - 3600000);
        lab.failFirstTrash = false;
        const sdk = firebaseState.fb as any;
        const realTx = sdk.runTransaction;
        let release: (v: any) => void = () => {};
        let heldResult: any;
        sdk.runTransaction = async (ref: any, updater: any) => {
            const result = await realTx(ref, updater);
            if (ref.path === HISTORY + '/' + ID && !heldResult) {
                heldResult = result;
                return new Promise((resolve) => { release = resolve; });
            }
            return result;
        };
        const deleting = deleteSingleItem(ID, { confirmed: true, quiet: true });
        await vi.waitFor(() => expect(heldResult).toBeTruthy());
        expect(getAt(HISTORY + '/' + ID)).toBeNull();
        expect(readCleanupJournal()[0]?.trashItem.barcodes.map((b: any) => b.code)).toEqual(['C', 'D']);
        cleanupInFlight.clear(); cleanupJournalLive.clear(); dataState.scanHistory = [];
        await resumeCleanupJournalEntry(ID);
        expect(getAt(TRASH + '/' + ID).barcodes.map((b: any) => b.code)).toEqual(['C', 'D']);
        expect(getAt(DAILY + '/' + DAY).codDollar).toBe(100);
        release(heldResult); await deleting;
        expect(readCleanupJournal()).toEqual([]);
    });

    it('បើក App វិញ ➜ សាក Restore ដោយ token ដើម មិនជាប់សោខ្លួនឯង', async () => {
        install(getServerNow() - 3600000);
        lab.failFirstTrash = false;
        const item = itemOf(getServerNow() - 3600000);
        const token = 'restore_saved_token';
        setAt(HISTORY + '/' + ID, null);
        setAt(TRASH + '/' + ID, { ...item, trashReason: 'delete', isFromDeletion: true, deletedAt: getServerNow(),
            restoreClaim: { token, targetId: ID, claimedAt: getServerNow() } });
        dataState.scanHistory = []; dataState.deletedItems = [getAt(TRASH + '/' + ID)];
        saveRestoreClaim(ID, { token, targetId: ID });
        activeRestoreClaims.clear(); uiState.pendingRestoreId = ID;
        await executeRestoreItem();
        expect(getAt(TRASH + '/' + ID)).toBeNull();
        expect(getAt(HISTORY + '/' + ID).barcodes.map((b: any) => b.code)).toEqual(['C', 'D']);
        expect(getAt(DAILY + '/' + DAY).codDollar).toBe(100);
    });

    it.each((['resolved', 'rejected'] as const).flatMap(outcome => (['shop', 'same-db-reauth'] as const).map(transition => ({ outcome, transition }))))('resync $outcome $transition ក្រោយប្តូរ session មិនបង្ហាញសារបរាជ័យ ឬប្ដូរទិដ្ឋភាព session ថ្មី', async ({ outcome, transition }) => {
        install(getServerNow() - 3600000);
        const sdk = firebaseState.fb as any;
        const oldTree = clone(lab.store);
        const stale = itemOf(getServerNow() - 3600000);
        const alertSpy = vi.fn(); vi.stubGlobal('alert', alertSpy);
        let release!: (value: any) => void, reject!: (error: Error) => void;
        let reads = 0;
        const pending = new Promise((resolve, fail) => { release = resolve; reject = fail; });
        sdk.get = (r: any) => {
            reads++;
            if (r.path === TRASH + '/' + ID) return Promise.reject(new Error('ALREADY_RESTORED'));
            return pending;
        };
        uiState.pendingRestoreId = ID;
        const restoring = executeRestoreItem();
        await vi.waitFor(() => expect(reads).toBe(3));
        const priorDb = firebaseState.db, priorGeneration = firebaseState.authGeneration;
        if (transition === 'shop') switchToShopB();
        else firebaseState.authGeneration++;
        expect(firebaseState.authGeneration).toBe(priorGeneration + 1);
        if (transition === 'same-db-reauth') expect(firebaseState.db).toBe(priorDb);
        else expect(firebaseState.db).not.toBe(priorDb);
        const history = dataState.scanHistory, trash = dataState.deletedItems;
        if (outcome === 'resolved') release(snap(null, { [ID]: stale }));
        else reject(new Error('old session read refused'));
        await restoring;
        expect.soft(alertSpy).not.toHaveBeenCalled();
        expect.soft(dataState.scanHistory).toBe(history); expect.soft(dataState.deletedItems).toBe(trash);
        expect(lab.store).toEqual(oldTree); expect(writesTo(DB_B)).toEqual([]);
    });

    it('ចម្លើយ resync ចាស់ មិនជាន់ទិដ្ឋភាពថ្មីដែល listener បានផ្តល់ក្នុងពេលរង់ចាំ', async () => {
        install(getServerNow() - 3600000);
        const oldTrash = itemOf(getServerNow() - 3600000);
        dataState.deletedItems = [oldTrash];
        const sdk = firebaseState.fb as any;
        let hist: (v: any) => void = () => {}, trash: (v: any) => void = () => {};
        let reads = 0;
        sdk.get = (ref: any) => {
            reads++;
            if (ref.path === TRASH + '/' + ID) return Promise.reject(new Error('ALREADY_RESTORED'));
            return new Promise((resolve) => { if (ref.path === HISTORY) hist = resolve; else trash = resolve; });
        };
        uiState.pendingRestoreId = ID;
        const restoring = executeRestoreItem();
        await vi.waitFor(() => expect(reads).toBe(3));
        const freshHistory = [itemOf(getServerNow())];
        const freshTrash: any[] = [];
        dataState.scanHistory = freshHistory; dataState.deletedItems = freshTrash;
        hist(snap(null, null)); trash(snap(null, { [ID]: oldTrash }));
        await restoring;
        expect(dataState.scanHistory).toBe(freshHistory);
        expect(dataState.deletedItems).toBe(freshTrash);
    });
});

afterEach(() => {
    refTo('editBcCodInput')(null); refTo('editBcDodInput')(null);
    vi.unstubAllGlobals();
    delete (window as any).ZoeErrors;
});

describe('ការសរសេរធុងសំរាមឡើងវិញក្រោយប្តូរ session', () => {
    it('១. ការសម្អាត ៨ ថ្ងៃ ៖ ការសរសេរលើកទី ១ បរាជ័យ ➜ ប្តូរទៅហាង B ➜ គ្មានការសរសេរណាមួយចូល B · journal នៅសម្រាប់ហាង A', async () => {
        install(getServerNow() - ABANDON_AGE_MS - 3600000);
        lab.onTrashFail = switchToShopB;
        await claimAndCleanupItem(ID, 'abandon');
        await waitRetries();
        expect(writesTo(DB_B)).toEqual([]);
        expect(readCleanupJournal().length).toBe(1);
        expect(readCleanupJournal()[0].stage).toBe('slot');
    }, 20000);

    it('២. លុប ៖ ការសរសេរលើកទី ១ បរាជ័យ ➜ ប្តូរទៅហាង B ➜ គ្មានការសរសេរណាមួយចូល B', async () => {
        install(getServerNow() - 3600000);
        lab.onTrashFail = switchToShopB;
        await deleteSingleItem(ID);
        await waitRetries();
        expect(writesTo(DB_B)).toEqual([]);
    }, 20000);

    it('៣. ដក ៖ ការសរសេរលើកទី ១ បរាជ័យ ➜ ប្តូរទៅហាង B ➜ គ្មានការសរសេរណាមួយចូល B (ធុងសំរាម · ការស្តារ barcode · ledger)', async () => {
        install(getServerNow() - 3600000);
        lab.onTrashFail = switchToShopB;
        await removeSingleBarcode(ID, 'C');
        await waitRetries();
        expect(writesTo(DB_B)).toEqual([]);
    }, 20000);

    it('៥. ការស្តារ barcode ចូលប្រវត្តិ (ក្រោយធុងសំរាមបរាជ័យ) ៖ ការសាកលើកទី ១ បរាជ័យ ➜ ប្តូរទៅហាង B ➜ មិនសរសេរចូល B · ទិសផ្ទុយ ៖ session ដដែល ➜ ស្តារចូល A', async () => {
        for (const switchShop of [true, false]) {
            install(getServerNow() - 3600000);
            lab.writes = [];
            setAt(HISTORY + '/' + ID, null);
            const claimed = itemOf(getServerNow() - 3600000);
            const fb: any = firebaseState.fb;
            const realTx = fb.runTransaction;
            let failed = false;
            fb.runTransaction = (ref: any, updater: any) => {
                if (!failed && ref.path === HISTORY + '/' + ID) {
                    failed = true;
                    if (switchShop) switchToShopB();
                    return Promise.reject(Object.assign(new Error('network error'), { code: 'NETWORK_ERROR' }));
                }
                return realTx(ref, updater);
            };
            let outcome = 'ok';
            try { await restoreClaimedItemToScanHistory(ID, claimed, null); } catch { outcome = 'rejected'; }
            if (switchShop) {
                expect(writesTo(DB_B)).toEqual([]);
                expect(outcome).toBe('rejected');
            } else {
                expect(writesTo(DB_A)).toEqual([HISTORY + '/' + ID]);
                expect(getAt(HISTORY + '/' + ID).barcodes.map((b: any) => b.code)).toEqual(['C', 'D']);
            }
        }
    }, 20000);

    it('៤. ទិសផ្ទុយ ៖ session ដដែល ➜ ការសម្អាត · លុប · ដក សាកឡើងវិញ ហើយសរសេរធុងសំរាមចូលហាង A', async () => {
        install(getServerNow() - ABANDON_AGE_MS - 3600000);
        await claimAndCleanupItem(ID, 'abandon');
        await waitRetries();
        expect(writesTo(DB_A).filter(isTrash).length).toBeGreaterThan(0);
        expect(readCleanupJournal().length).toBe(0);

        lab.writes = [];
        lab.failFirstTrash = true;
        install(getServerNow() - 3600000);
        await deleteSingleItem(ID);
        await waitRetries();
        expect(writesTo(DB_A).filter(isTrash).length).toBe(1);

        lab.writes = [];
        lab.failFirstTrash = true;
        install(getServerNow() - 3600000);
        await removeSingleBarcode(ID, 'C');
        await waitRetries();
        expect(writesTo(DB_A).filter((path) => isTrash(path) && path.split('/').length === 2)).toHaveLength(2);
        expect(Object.keys(lab.store[TRASH])).toHaveLength(1);
        expect(Object.values(lab.store[TRASH]).flatMap((item: any) => item.barcodes).find((b: any) => b.code === 'C').isDeducted).toBe(true);
        expect(getAt(DAILY + '/' + DAY).codDollar).toBe(93);
        expect(getAt(MONTHLY + '/2026-09').codDollar).toBe(93);
        expect(getAt(HISTORY + '/' + ID).barcodes.map((b: any) => b.code)).toEqual(['D']);
    }, 30000);
});


describe('វាស់លុយតាមកញ្ចប់ដោយ seed ៖ លុប/ដក/ស្តារដដែល', () => {
    const seeds = [71027, 902113, 20261025];
    for (const seed of seeds) {
        for (const shape of ['array', 'map', 'legacy']) {
            it(`seed ${seed} · ${shape} · ប្រាក់កញ្ចប់ខ្លួនឯងតែម្តង`, async () => {
                let randomState = seed >>> 0;
                const amount = () => { randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0; return (randomState % 50000) / 100; };
                const sync = () => {
                    dataState.scanHistory = Object.values(getAt(HISTORY) || {}).map((x: any) => normalizeBarcodesOf(x));
                    dataState.deletedItems = Object.values(getAt(TRASH) || {}).map((x: any) => normalizeBarcodesOf(x));
                    dataState.dailyRevenueData = getAt(DAILY) || {};
                    dataState.monthlyRevenueData = getAt(MONTHLY) || {};
                };
                for (let cycle = 0; cycle < 12; cycle++) {
                    localStorage.clear(); activeRestoreClaims.clear(); restoreInFlight.clear(); cleanupInFlight.clear(); cleanupJournalLive.clear();
                    install(getServerNow() - 3600000); lab.failFirstTrash = false;
                    const item: any = getAt(HISTORY + '/' + ID);
                    const cod = cycle % 4 === 0 ? 0 : amount(), dod = cycle % 3 === 0 ? 0 : amount();
                    item.barcodes[0].cod = cod; item.barcodes[0].dod = dod;
                    item.barcodes[1].cod = amount(); item.barcodes[1].dod = amount();
                    item.barcodes[1].isClosed = cycle % 2 === 0;
                    if (item.barcodes[1].isClosed) item.barcodes[1].closedAt = getServerNow() - 30000;
                    if (shape === 'legacy') { item.barcodes = [item.barcodes[0]]; item.count = 1; }
                    item.cod = item.barcodes.reduce((s: number, b: any) => s + b.cod, 0);
                    item.dod = item.barcodes.reduce((s: number, b: any) => s + b.dod, 0); item.price = item.cod + item.dod;
                    let sibling = shape === 'legacy' ? null : clone(item.barcodes[1]);
                    if (shape === 'map') item.barcodes = { 0: item.barcodes[0], 3: item.barcodes[1] };
                    if (shape === 'legacy') delete item.barcodes;
                    setAt(HISTORY + '/' + ID, item);
                    const other = { ...itemOf(getServerNow()), id: 'neighbor', phone: '999', barcode: 'NEIGHBOR', barcodes: [{ ...itemOf(getServerNow()).barcodes[0], code: 'NEIGHBOR', cod: 123.45, dod: 67.89 }] };
                    setAt(HISTORY + '/neighbor', other);
                    const baseline = { codDollar: 10000, dodDollar: 9000, totalCount: 100 };
                    setAt(DAILY + '/' + DAY, baseline); setAt(MONTHLY + '/2026-09', baseline);
                    setAt(DAILY + '/2026-08-31', { codDollar: 71, dodDollar: 19, totalCount: 8 });
                    setAt(MONTHLY + '/2026-08', { codDollar: 71, dodDollar: 19, totalCount: 8 });
                    const money = (removed: boolean) => {
                        for (const path of [DAILY + '/' + DAY, MONTHLY + '/2026-09']) {
                            const record = getAt(path);
                            expect(record.codDollar).toBeCloseTo(10000 - (removed ? cod : 0), 7);
                            expect(record.dodDollar).toBeCloseTo(9000 - (removed ? dod : 0), 7);
                            expect(record.totalCount).toBe(100 - (removed ? 1 : 0));
                        }
                        expect(getAt(HISTORY + '/neighbor')).toEqual(other);
                        expect(getAt(DAILY + '/2026-08-31')).toEqual({ codDollar: 71, dodDollar: 19, totalCount: 8 });
                        expect(getAt(MONTHLY + '/2026-08')).toEqual({ codDollar: 71, dodDollar: 19, totalCount: 8 });
                    };
                    const restore = async (id: string) => {
                        const targetId = await findRestoreTargetId(normalizeBarcodesOf(getAt(TRASH + '/' + id)));
                        const tokenA = `claimA_${seed}_${cycle}_${id}`, tokenB = `claimB_${seed}_${cycle}_${id}`;
                        const claims = await Promise.allSettled([
                            claimDeletedItemForRestore(id, tokenA, targetId),
                            claimDeletedItemForRestore(id, tokenB, targetId)
                        ]);
                        expect(claims.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
                        const loser: any = claims.find((x) => x.status === 'rejected');
                        expect(loser.reason.message).toBe('RESTORE_IN_PROGRESS');
                        saveRestoreClaim(id, { token: claims[0].status === 'fulfilled' ? tokenA : tokenB, targetId });
                        activeRestoreClaims.clear();
                        const sdk = firebaseState.fb as any;
                        const originalUpdate = sdk.update, originalGet = sdk.get;
                        let injected = false, unread = false;
                        sdk.update = async (ref: any, updates: any) => {
                            const final = Object.keys(updates).some((key) => key.startsWith('zoew_restore_finalizations/'));
                            if (!injected && final && cycle % 4 !== 0) {
                                injected = true;
                                if (cycle % 4 !== 1) await originalUpdate(ref, updates);
                                unread = cycle % 4 === 3;
                                throw new Error('disconnect');
                            }
                            return originalUpdate(ref, updates);
                        };
                        sdk.get = async (ref: any) => {
                            if (unread && ref.path === TRASH + '/' + id) { unread = false; throw new Error('offline'); }
                            return originalGet(ref);
                        };
                        sync(); uiState.pendingRestoreId = id;
                        await Promise.all([executeRestoreItem(), executeRestoreItem(), executeRestoreItem()]);
                        sync(); uiState.pendingRestoreId = id; await executeRestoreItem();
                        expect(getAt(TRASH + '/' + id)).toBeNull();
                        expect(injected).toBe(cycle % 4 !== 0);
                        sdk.update = originalUpdate; sdk.get = originalGet;
                    };
                    sync();
                    await Promise.all([deleteSingleItem(ID, { confirmed: true, quiet: true }), deleteSingleItem(ID, { confirmed: true, quiet: true })]);
                    money(false); expect(getAt(HISTORY + '/' + ID)).toBeNull();
                    await restore(ID); money(false);
                    if (sibling) {
                        const restoredSibling = Object.values(getAt(HISTORY) || {}).flatMap((x: any) => x.barcodes || []).find((b: any) => b.code === 'D');
                        expect(restoredSibling).toMatchObject({ code: sibling.code, cod: sibling.cod, dod: sibling.dod, isClosed: sibling.isClosed });
                        sibling = clone(restoredSibling);
                    }
                    for (let repeat = 0; repeat < 3; repeat++) {
                        sync();
                        const live: any = dataState.scanHistory.find((x: any) => (x.barcodes || []).some((b: any) => b.code === 'C') || x.barcode === 'C');
                        expect(live).toBeTruthy();
                        await Promise.all([removeSingleBarcode(live.id, 'C'), removeSingleBarcode(live.id, 'C')]);
                        money(true);
                        const trash: any = Object.values(getAt(TRASH) || {}).find((x: any) => x.barcode === 'C');
                        expect(trash).toBeTruthy(); expect(trash.barcodes[0].isDeducted).toBe(true);
                        if (sibling) expect(Object.values(getAt(HISTORY) || {}).flatMap((x: any) => x.barcodes || []).find((b: any) => b.code === 'D')).toEqual(sibling);
                        await restore(trash.id); money(false);
                        const all = Object.values(getAt(HISTORY) || {}).flatMap((x: any) => x.barcodes || []);
                        expect(all.filter((b: any) => b.code === 'C')).toHaveLength(1);
                        if (sibling) expect(all.find((b: any) => b.code === 'D')).toEqual(sibling);
                    }
                }
            }, 60000);
        }
    }
});

describe('ស្តារតែការដកដែលបានអនុវត្តពិតក្នុងថ្ងៃនិងខែ', () => {
    for (const [daily, monthly] of [[0, 0], [2, 2], [7, 7], [100, 100], [2, 100], [100, 2]]) {
        it(`សង្កេត COD ${daily}/${monthly}`, async () => {
            install(getServerNow() - 3600000); lab.failFirstTrash = false;
            const dayDod = daily === 2 ? 1 : 6, monthDod = monthly === 2 ? 2 : 30;
            const dayCount = daily === 0 ? 0 : 10, monthCount = monthly === 0 ? 0 : 10;
            const item = getAt(HISTORY + '/' + ID); item.barcodes[0].dod = 9; item.dod = 9; item.price += 9; setAt(HISTORY + '/' + ID, item);
            dataState.scanHistory = [clone(item)];
            setAt(DAILY + '/' + DAY, { codDollar: daily, dodDollar: dayDod, totalCount: dayCount });
            setAt(MONTHLY + '/2026-09', { codDollar: monthly, dodDollar: monthDod, totalCount: monthCount });
            dataState.dailyRevenueData = getAt(DAILY); dataState.monthlyRevenueData = getAt(MONTHLY);
            await removeSingleBarcode(ID, 'C');
            const trash: any = Object.values(getAt(TRASH) || {})[0];
            const afterRemove = [getAt(DAILY + '/' + DAY).codDollar, getAt(MONTHLY + '/2026-09').codDollar];
            const receipt = getAt(DAILY + '/' + DAY + '/ded/' + trash.id);
            dataState.scanHistory = Object.values(getAt(HISTORY) || {}) as any;
            dataState.deletedItems = Object.values(getAt(TRASH) || {}) as any;
            dataState.dailyRevenueData = getAt(DAILY); dataState.monthlyRevenueData = getAt(MONTHLY);
            uiState.pendingRestoreId = trash.id; await executeRestoreItem();
            const afterRestore = [getAt(DAILY + '/' + DAY).codDollar, getAt(MONTHLY + '/2026-09').codDollar];
            uiState.pendingRestoreId = trash.id; await executeRestoreItem();
            expect([getAt(DAILY + '/' + DAY).codDollar, getAt(MONTHLY + '/2026-09').codDollar]).toEqual(afterRestore);
            expect(afterRemove).toEqual([Math.max(0, daily - 7), Math.max(0, monthly - 7)]);
            expect(receipt.cod).toBe(Math.min(7, daily));
            expect.soft(afterRestore).toEqual([daily, monthly]);
            expect([getAt(DAILY + '/' + DAY).dodDollar, getAt(MONTHLY + '/2026-09').dodDollar]).toEqual([dayDod, monthDod]);
            expect([getAt(DAILY + '/' + DAY).totalCount, getAt(MONTHLY + '/2026-09').totalCount]).toEqual([dayCount, monthCount]);
            expect.soft(getAt(DAILY + '/' + DAY + '/ded/' + trash.id).cod).toBe(receipt.cod);
        });
    }
});


describe('ភស្តុតាងការដកតាមថ្ងៃនិងខែ', () => {
    const sync = () => {
        dataState.scanHistory = Object.values(getAt(HISTORY) || {}).map((x: any) => normalizeBarcodesOf(x));
        dataState.deletedItems = Object.values(getAt(TRASH) || {}).map((x: any) => normalizeBarcodesOf(x));
        dataState.dailyRevenueData = getAt(DAILY) || {}; dataState.monthlyRevenueData = getAt(MONTHLY) || {};
    };
    const restore = async (id: string) => { sync(); uiState.pendingRestoreId = id; await executeRestoreItem(); };
    for (const missing of ['daily', 'monthly', 'both']) {
        it(`ខ្វះ ${missing} ៖ មិនទាយលុយ មិនស្តារ`, async () => {
            install(getServerNow() - 3600000); lab.failFirstTrash = false;
            await removeSingleBarcode(ID, 'C');
            const trash: any = Object.values(getAt(TRASH) || {})[0];
            if (missing !== 'monthly') setAt(DAILY + '/' + DAY + '/ded/' + trash.id, null);
            if (missing !== 'daily') setAt(MONTHLY + '/2026-09/ded/' + trash.id, null);
            const before = [getAt(DAILY), getAt(MONTHLY), getAt(HISTORY)];
            await restore(trash.id);
            expect(getAt(TRASH + '/' + trash.id)).not.toBeNull();
            expect([getAt(DAILY), getAt(MONTHLY), getAt(HISTORY)]).toEqual(before);
            expect(uiState.toasts.map((t: any) => t.msg).join(' ')).toContain('ខ្វះភស្តុតាង');
        });
    }
    it('ខែចុះ ថ្ងៃបរាជ័យ ➜ ស្តាររង់ចាំ journal ➜ មិនដកឬបូកស្ទួន', async () => {
        install(getServerNow() - 3600000); lab.failFirstTrash = false;
        for (const path of [DAILY + '/' + DAY, MONTHLY + '/2026-09']) setAt(path, { ...getAt(path), op: 'op_seedproof01', ops: { op_seedproof01: 1 } });
        sync();
        const sdk = firebaseState.fb as any, realTx = sdk.runTransaction;
        sdk.runTransaction = (ref: any, update: any) => ref.path === DAILY + '/' + DAY
            ? Promise.reject(new Error('permission_denied')) : realTx(ref, update);
        await removeSingleBarcode(ID, 'C');
        const trash: any = Object.values(getAt(TRASH) || {})[0];
        expect(getAt(MONTHLY + '/2026-09').codDollar).toBe(93);
        expect(getAt(DAILY + '/' + DAY).codDollar).toBe(100);
        await restore(trash.id);
        expect(getAt(TRASH + '/' + trash.id)).not.toBeNull();
        expect(getAt(DAILY + '/' + DAY).codDollar).toBe(100);
        sdk.runTransaction = realTx;
        await resumeCleanupJournalEntry(trash.id);
        expect(getAt(DAILY + '/' + DAY).codDollar).toBe(93);
        await restore(trash.id);
        expect(getAt(DAILY + '/' + DAY).codDollar).toBe(100);
        expect(getAt(MONTHLY + '/2026-09').codDollar).toBe(100);
        await resumeCleanupJournalEntry(trash.id);
        expect(getAt(DAILY + '/' + DAY).codDollar).toBe(100);
        expect(getAt(MONTHLY + '/2026-09').codDollar).toBe(100);
    });
    it('rules ខែមិនទាន់គាំទ្រ ded ➜ មិនដកដោយលុបភស្តុតាង', async () => {
        install(getServerNow() - 3600000); lab.failFirstTrash = false;
        const sdk = firebaseState.fb as any, realTx = sdk.runTransaction;
        let refusals = 0;
        sdk.runTransaction = (ref: any, update: any) => {
            if (ref.path === MONTHLY) {
                const proposed = update(getAt(MONTHLY));
                if (Object.values(proposed || {}).some((x: any) => x.ded)) { refusals++; return Promise.reject(new Error('permission_denied')); }
            }
            return realTx(ref, update);
        };
        await removeSingleBarcode(ID, 'C');
        expect(refusals).toBeGreaterThan(0);
        expect(getAt(DAILY + '/' + DAY).codDollar).toBe(100);
        expect(getAt(MONTHLY + '/2026-09').codDollar).toBe(100);
        expect(readCleanupJournal()).toHaveLength(1);
    });
    it('ការកែប្រាក់ខែ និង connection replay រក្សា ded ក្រោយ ring ប្តូរ', async () => {
        install(getServerNow() - 3600000); lab.failFirstTrash = false;
        await removeSingleBarcode(ID, 'C');
        const trash: any = Object.values(getAt(TRASH) || {})[0];
        const receipt = getAt(MONTHLY + '/2026-09/ded/' + trash.id);
        for (let i = 0; i < 20; i++) await commitMonthlyRevenueDelta('2026-09', 1, 0, 0, null, true);
        expect(getAt(MONTHLY + '/2026-09/ded/' + trash.id)).toEqual(receipt);
        const replay = ledgerJournalUpdate(getAt(MONTHLY), { kind: 'ledger-delta', bucket: 'monthly', key: '2026-09', token: 'op_replay_test01', cod: 2, dod: 0, count: 0 });
        expect(replay['2026-09'].ded[trash.id]).toEqual(receipt);
        setAt(MONTHLY, replay); await restore(trash.id);
        expect(getAt(MONTHLY + '/2026-09').codDollar).toBe(122);
        expect(getAt(MONTHLY + '/2026-09/ded/' + trash.id)).toEqual({ ...receipt, back: true });
    });
    it('កែតម្លៃកញ្ចប់មុនដក ➜ ដក/ស្តារតែតម្លៃថ្មី ខុសពីកញ្ចប់ក្បែរ', async () => {
        install(getServerNow() - 3600000); lab.failFirstTrash = false;
        uiState.activeParentItemId = ID; uiState.activeEditingBarcode = 'C';
        refTo('editBcCodInput')(document.createElement('input')); refTo('editBcDodInput')(document.createElement('input'));
        setFieldValue('editBcCodInput', '17.35'); setFieldValue('editBcDodInput', '4.15');
        saveEditedBarcodePrice();
        await vi.waitFor(() => expect(getAt(HISTORY + '/' + ID).barcodes[0].cod).toBe(17.35));
        await vi.waitFor(() => expect(getAt(DAILY + '/' + DAY).codDollar).toBeCloseTo(110.35, 7));
        const before = [getAt(DAILY + '/' + DAY), getAt(MONTHLY + '/2026-09')];
        sync(); await removeSingleBarcode(ID, 'C');
        const trash: any = Object.values(getAt(TRASH) || {})[0];
        expect(getAt(DAILY + '/' + DAY).codDollar).toBeCloseTo(93, 7);
        expect(getAt(DAILY + '/' + DAY).dodDollar).toBe(0);
        expect(getAt(HISTORY + '/' + ID).barcodes[0].cod).toBe(3);
        await restore(trash.id);
        for (const [i, path] of [DAILY + '/' + DAY, MONTHLY + '/2026-09'].entries()) {
            expect(getAt(path).codDollar).toBeCloseTo(before[i].codDollar, 7);
            expect(getAt(path).dodDollar).toBeCloseTo(before[i].dodDollar, 7);
        }
    });
});


describe('ទិន្នន័យចាស់ និងអត្តសញ្ញាណភស្តុតាង', () => {
    for (const patch of [{ deletedAt: undefined }, { deletedAt: 0 }, { scanDate: 'bad-day' }, { id: 'x'.repeat(65) }, { trashReason: undefined, isFromDeletion: false }]) {
        it(`ទិន្នន័យទំនើបខ្វះភស្តុតាង ${JSON.stringify(patch)}`, async () => {
            install(getServerNow() - 3600000); lab.failFirstTrash = false;
            const item = { modern: true, id: ID, deletedAt: getServerNow(), scanDate: DAY, trashReason: 'remove', ...patch };
            const deltas = [{ scanDate: DAY, cod: 7, dod: 0, count: 1 }];
            await expect(restoreLedgerKeyFor(item, item.id, deltas)).rejects.toThrow('RESTORE_LEDGER_PROOF_REQUIRED');
            expect(deltas).toEqual([{ scanDate: DAY, cod: 7, dod: 0, count: 1 }]);
            expect(getAt(DAILY + '/' + DAY).codDollar).toBe(100);
        });
    }
    it('legacy គ្មាន array រក្សាផ្លូវស្តារចាស់ ដោយមិនអះអាងភស្តុតាងដែលគ្មាន', async () => {
        install(getServerNow() - 3600000); lab.failFirstTrash = false;
        const legacy: any = { ...getAt(HISTORY + '/' + ID), count: 1, cod: 7, dod: 0, price: 7, deletedAt: getServerNow(), trashReason: 'remove', isFromDeletion: false };
        delete legacy.barcodes;
        setAt(HISTORY + '/' + ID, null); setAt(TRASH + '/' + ID, legacy);
        setAt(DAILY + '/' + DAY, { codDollar: 93, dodDollar: 0, totalCount: 9 });
        setAt(MONTHLY + '/2026-09', { codDollar: 93, dodDollar: 0, totalCount: 9 });
        dataState.scanHistory = []; dataState.deletedItems = [clone(legacy)];
        dataState.dailyRevenueData = getAt(DAILY); dataState.monthlyRevenueData = getAt(MONTHLY);
        uiState.pendingRestoreId = ID; await executeRestoreItem();
        expect(getAt(TRASH + '/' + ID)).toBeNull();
        expect(getAt(DAILY + '/' + DAY).codDollar).toBe(100);
        expect(getAt(MONTHLY + '/2026-09').codDollar).toBe(100);
        uiState.pendingRestoreId = ID; await executeRestoreItem();
        expect(getAt(DAILY + '/' + DAY).codDollar).toBe(100);
    });
});


describe('សោ back និង undo ចាស់មិនបង្កើតប្រាក់បន្ថែម', () => {
    for (const completed of ['daily', 'monthly', 'both']) {
        it(`ប្រាក់ ${completed} ត្រឡប់រួច ➜ មិនបូកលើកទី២`, async () => {
            install(getServerNow() - 3600000); lab.failFirstTrash = false;
            await removeSingleBarcode(ID, 'C');
            const trash: any = Object.values(getAt(TRASH) || {})[0];
            for (const [bucket, path] of [['daily', DAILY + '/' + DAY], ['monthly', MONTHLY + '/2026-09']]) {
                if (completed !== 'both' && completed !== bucket) continue;
                const record = getAt(path); record.codDollar += 7; record.totalCount += 1; record.ded[trash.id].back = true; setAt(path, record);
            }
            dataState.scanHistory = Object.values(getAt(HISTORY) || {}) as any; dataState.deletedItems = Object.values(getAt(TRASH) || {}) as any;
            dataState.dailyRevenueData = getAt(DAILY); dataState.monthlyRevenueData = getAt(MONTHLY);
            uiState.pendingRestoreId = trash.id; await executeRestoreItem();
            expect(getAt(TRASH + '/' + trash.id)).toBeNull();
            expect(getAt(DAILY + '/' + DAY).codDollar).toBe(100);
            expect(getAt(MONTHLY + '/2026-09').codDollar).toBe(100);
            expect(getAt(DAILY + '/' + DAY).totalCount).toBe(10);
            expect(getAt(MONTHLY + '/2026-09').totalCount).toBe(10);
        });
    }
    it('undo ខែចាស់ខ្វះ receipt ➜ unknown មិន throw ឬទាយពីថ្ងៃ', () => {
        install(getServerNow() - 3600000);
        expect(ledgerEventDecision(false, 'undo', { codDollar: 0 }, 'old', 1, null, null).state).toBe('unknown');
        expect(ledgerJournalUpdate({ '2026-09': { codDollar: 0 } }, { kind: 'ledger-event', bucket: 'monthly', key: '2026-09', mode: 'undo', trashId: 'old', at: 1, keyed: true, token: 'op_legacyundo01', amounts: { cod: 7, dod: 0, count: 1 } })).toBeUndefined();
    });
});


describe('ការកែ ledger តាម helper ពិត មុនដកនិងស្តារ', () => {
    it('កែ COD 100 ទៅ 2 ➜ ដក C តម្លៃ7 ➜ ស្តារ2 មិនបូក7', async () => {
        install(getServerNow() - 3600000); lab.failFirstTrash = false;
        const adjusted = addRevenueToDailyAndMonthlyRecord(DAY, -98, 0, 0);
        await Promise.all([adjusted.dailyServer, adjusted.monthlyServer]);
        expect(getAt(DAILY + '/' + DAY).codDollar).toBe(2);
        expect(getAt(MONTHLY + '/2026-09').codDollar).toBe(2);
        await removeSingleBarcode(ID, 'C');
        expect(getAt(DAILY + '/' + DAY).codDollar).toBe(0);
        const trash: any = Object.values(getAt(TRASH) || {})[0];
        dataState.scanHistory = Object.values(getAt(HISTORY) || {}) as any; dataState.deletedItems = Object.values(getAt(TRASH) || {}) as any;
        dataState.dailyRevenueData = getAt(DAILY); dataState.monthlyRevenueData = getAt(MONTHLY);
        uiState.pendingRestoreId = trash.id; await executeRestoreItem();
        expect(getAt(DAILY + '/' + DAY).codDollar).toBe(2);
        expect(getAt(MONTHLY + '/2026-09').codDollar).toBe(2);
        expect(Object.values(getAt(HISTORY) || {}).flatMap((x: any) => x.barcodes || []).map((b: any) => [b.code, b.cod]).sort()).toEqual([['C', 7], ['D', 3]]);
    });
});
