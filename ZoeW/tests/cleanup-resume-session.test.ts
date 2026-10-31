import { allocateTrashGeneration, captureTrashGenerationOwner } from '../src/services/trash-generation';
import { cleanupServerRead } from './helpers/cleanup-server-read';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { dataState, firebaseState, uiState } from '../src/core/state';
import { getServerNow } from '../src/core/clock';
import { dbListenerFailedPaths, dbListenerPendingPaths } from '../src/core/text';
import { cleanupHistoryForRecovery, cleanupInFlight, cleanupJournalLive, markCleanupJournalLive, noteCleanupJournalEntry, readCleanupJournal, releaseCleanupJournalLive, resumeCleanupJournalEntry, resumeInterruptedCleanups } from '../src/domain/cleanup';
import { trashRestoreBlockOf } from '../src/features/zto-final-marks';

// ⛔ ការបន្តការសម្អាតដែលត្រូវរំខាន (`resumeCleanupJournalEntry()`) ពិនិត្យ scope របស់ journal តែនៅដើម ៖ ការចាកចេញ/ប្តូរ Config **កណ្តាលផ្លូវ**
//    (ក្រោយការអានធុងសំរាម · ក្រោយជំហាន ledger ខែ · ក្រោយការរកឃើញ slot) មិនត្រូវឲ្យជំហានបន្ទាប់សរសេរធុងសំរាម ឬកាត់ប្រាក់ក្នុងហាងថ្មីទេ
//    (Firebase ៖ Database ថ្មី · Supabase ៖ គណនីថ្មីក្នុង Project ដដែល)។ journal នៅសម្រាប់ហាងដើម។
const HISTORY = 'zoew_scan_history_cod_dod';
const TRASH = 'zoew_recently_deleted_cod_dod';
const DAILY = 'zoew_daily_revenue_cod_dod';
const MONTHLY = 'zoew_monthly_revenue_cod_dod';
const DAY = '2026-09-20';
const MONTH = '2026-09';
const ID = 'id_1758000000000_bbbb2';
const DB_A = { name: 'shop-a' };
const DB_B = { name: 'shop-b' };
const URL_A = 'https://shop-a.firebaseio.com';
const URL_B = 'https://shop-b.firebaseio.com';

type Hook = (info: { kind: 'get' | 'tx' | 'update'; path: string }) => void;
const lab = { store: {} as Record<string, any>, writes: [] as { db: any; path: string }[], hook: null as Hook | null, validateSignedTrash: false };
const signedRule = JSON.parse(readFileSync(path.join(__dirname, '..', '..', 'firebase-database.rules.json'), 'utf8'))
    .rules.zoew_recently_deleted_cod_dod.$itemId.barcodes.$idx.ztoSignedAt['.validate'];
const validateSignedAt = new Function('newData', 'return (' + signedRule + ');');

function signedTrashWriteAllowed(item: any) {
    const snapshot = (parts: string[]): any => {
        const val = () => parts.reduce((value, key) => value?.[key], item) ?? null;
        return { val, exists: () => val() !== null, isNumber: () => typeof val() === 'number', parent: () => snapshot(parts.slice(0, -1)), child: (key: string) => snapshot([...parts, key]) };
    };
    return Object.entries(item?.barcodes || {}).every(([key, barcode]: [string, any]) => barcode?.ztoSignedAt == null
        || validateSignedAt(snapshot(['barcodes', key, 'ztoSignedAt'])));
}

function checkSignedTrashWrite(target: string, item: any) {
    if (lab.validateSignedTrash && target.startsWith(TRASH + '/') && !signedTrashWriteAllowed(item)) {
        throw Object.assign(new Error('permission_denied'), { noRetry: true });
    }
}

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
    return { db, path: p, key: split(p).pop() || null, toString: () => URL_A + '/' + p };
}
function snap(ref: any, value: any) {
    return { key: ref && ref.key, ref, val: () => clone(value), exists: () => value !== null && value !== undefined };
}
function makeFb() {
    return {
        ref: (db: any, path = '') => makeRef(db, path),
        increment: (n: number) => ({ __inc__: n }),
        get: async (ref: any) => {
            const value = getAt(ref.path);
            if (lab.hook) lab.hook({ kind: 'get', path: ref.path });
            return snap(ref, value);
        },
        update: async (ref: any, updates: any) => {
            for (const key of Object.keys(updates)) {
                const path = [ref.path, key].filter(Boolean).join('/');
                checkSignedTrashWrite(path, updates[key]);
                lab.writes.push({ db: ref.db, path });
                setAt(path, updates[key]);
                if (lab.hook) lab.hook({ kind: 'update', path });
            }
        },
        runTransaction: async (ref: any, updater: any) => {
            const prior = getAt(ref.path);
            const proposed = updater(clone(prior));
            if (proposed === undefined) return { committed: false, snapshot: snap(ref, prior) };
            checkSignedTrashWrite(ref.path, proposed);
            lab.writes.push({ db: ref.db, path: ref.path });
            setAt(ref.path, proposed);
            if (lab.hook) lab.hook({ kind: 'tx', path: ref.path });
            return { committed: true, snapshot: snap(ref, getAt(ref.path)) };
        },
        onValue: () => () => {},
        off: () => {}
    };
}
function attachShop(db: any, url: string) {
    firebaseState.db = db as any;
    localStorage.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: url }));
    firebaseState.firebaseConfig = { databaseURL: url } as any;
    firebaseState.dbRefHistory = makeRef(db, HISTORY) as any;
    firebaseState.dbRefDeleted = makeRef(db, TRASH) as any;
    firebaseState.dbRefDailyRevenue = makeRef(db, DAILY) as any;
    firebaseState.dbRefMonthlyRevenue = makeRef(db, MONTHLY) as any;
    firebaseState.dbRefDailyPickup = makeRef(db, 'zoew_daily_pickup_cod_dod') as any;
    firebaseState.dbRefDailyCollected = makeRef(db, 'zoew_daily_collected_cod_dod') as any;
}
function switchToShopB() {
    firebaseState.authGeneration++;
    dataState.cleanupResumeInFlight = false;
    attachShop(DB_B, URL_B);
    dataState.scanHistory = [];
    dataState.deletedItems = [];
}
function trashItemOf() {
    const deletedAt = getServerNow() - 60000;
    const c = { code: 'C', time: '08:00:00 (' + DAY + ')', cod: 7, dod: 0, locker: 'N/A', isClosed: false, isDeducted: false, isFromDeletion: false, createdAt: deletedAt - 9 * 86400000 };
    return { id: ID, phone: '012', scanDate: DAY, time: c.time, createdAt: c.createdAt, count: 1, cod: 7, dod: 0, price: 7, isClosed: false, barcode: 'C', barcodes: [c],
        deletedAt, isFromDeletion: false, trashReason: 'returned' };
}
async function install(stage: string, trashPresent: boolean, extra: any = {}, modern = true) {
    const trashItem = trashItemOf();
    lab.store = {
        [DAILY]: { [DAY]: { codDollar: 100, dodDollar: 0, totalCount: 10 } },
        [MONTHLY]: { [MONTH]: { codDollar: 100, dodDollar: 0, totalCount: 10 } }
    };
    if (trashPresent) lab.store[TRASH] = { [ID]: clone(trashItem) };
    firebaseState.fb = makeFb() as any;
    firebaseState.auth = { currentUser: { uid: 'u1', getIdToken: async () => 'tok' } } as any;
    firebaseState.isDatabaseInitialized = true;
    firebaseState.isDatabaseConnected = true;
    firebaseState.serverClockTrusted = true;
    firebaseState.hasEverConnectedToDatabase = true;
    attachShop(DB_A, URL_A);
    if (modern) {
        const generation = await allocateTrashGeneration(ID, captureTrashGenerationOwner()!);
        expect(generation, 'new fixture intent captures the actual next generation before its journal').toBe(1);
        Object.assign(trashItem, { trashGeneration: generation });
        if (trashPresent) lab.store[TRASH][ID] = clone(trashItem);
    }
    dataState.scanHistory = [];
    dataState.deletedItems = trashPresent ? [clone(trashItem)] : [];
    dataState.dailyRevenueData = clone(lab.store[DAILY]);
    dataState.monthlyRevenueData = clone(lab.store[MONTHLY]);
    dataState.dailyPickupData = {};
    dataState.dailyCollectedData = {};
    noteCleanupJournalEntry(Object.assign({ id: ID, reason: 'abandon', journalAt: trashItem.deletedAt, stage, trashItem,
        revenue: { scanDate: DAY, cod: 7, dod: 0, count: 1 } }, extra));
    return trashItem;
}
const writesTo = (db: any) => lab.writes.filter((w) => w.db === db).map((w) => w.path);
const switchOnce = (when: (info: { kind: string; path: string }) => boolean) => {
    let done = false;
    lab.hook = (info) => { if (!done && when(info)) { done = true; switchToShopB(); } };
};

beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(cleanupServerRead(getAt, (path) => lab.hook?.({ kind: 'get', path }))));
    lab.writes = [];
    lab.hook = null;
    lab.validateSignedTrash = false;
    uiState.toasts = [];
    try { localStorage.clear(); } catch {}
    (window as any).ZoeErrors = { capture: vi.fn() };
    cleanupInFlight.clear();
    cleanupJournalLive.clear();
    dbListenerPendingPaths.clear();
    dbListenerFailedPaths.clear();
    firebaseState.authGeneration++;
});

afterEach(() => {
    delete (window as any).ZoeErrors;
    vi.unstubAllGlobals();
});

describe('resume ការសម្អាតដែលត្រូវរំខាន ៖ ប្តូរ session កណ្តាលផ្លូវ', () => {

    it.each([['slot', false], ['moved', false], ['slot', true], ['moved', true]] as const)('journal Sign គ្មាន policy stamp · %s · modern=%s ➜ legacy គ្មាន source នៅ HOLD · modern មាន generation ស្តារ', async (stage, modern) => {
        const original = await install(stage, false, { reason: 'close', revenue: null }, modern);
        const signedAt = original.deletedAt - 3 * 3600000;
        const trash = { ...original, trashReason: 'pickup', isFromDeletion: true, isClosed: true,
            barcodes: original.barcodes.map((barcode) => ({ ...barcode, isClosed: true, ztoSignedAt: signedAt, isFromDeletion: true })) };
        const entry = { ...readCleanupJournal()[0], trashItem: trash };
        noteCleanupJournalEntry(entry);
        const beforeMoney = { daily: getAt(DAILY), monthly: getAt(MONTHLY) };
        expect(signedTrashWriteAllowed(trash), '⛔ rule ពិតបដិសេធ payload គ្មាន trashMode ដែលគ្មាន restoreBlocked (Phase B ៖ គ្មាន compat មុន launch)').toBe(false);
        expect(signedTrashWriteAllowed({ ...trash, trashMode: 'local' }), 'payload មាន trashMode តែគ្មាន restoreBlocked ➜ rule ពិតបដិសេធ').toBe(false);
        expect(signedTrashWriteAllowed({ ...trash, restoreBlocked: true }), 'rule ពិតទទួល stamp').toBe(true);
        lab.validateSignedTrash = true;
        if (!modern) {
            const pending = clone(readCleanupJournal());
            expect(await resumeCleanupJournalEntry(ID)).toBe('');
            expect(readCleanupJournal()).toEqual(pending);
            expect(getAt(TRASH + '/' + ID)).toBeNull();
            expect({ daily: getAt(DAILY), monthly: getAt(MONTHLY) }).toEqual(beforeMoney);
            return;
        }
        expect(await resumeCleanupJournalEntry(ID)).toBe('restored');
        expect(getAt(HISTORY + '/' + ID)).toBeNull();
        const saved = getAt(TRASH + '/' + ID);
        expect(saved).toMatchObject({ trashMode: 'local', restoreBlocked: true, barcodes: [{ code: 'C', ztoSignedAt: signedAt }] });
        expect(trashRestoreBlockOf(saved)).toBe('signed');
        expect({ daily: getAt(DAILY), monthly: getAt(MONTHLY) }).toEqual(beforeMoney);
        expect(readCleanupJournal()).toEqual([]);
        await resumeCleanupJournalEntry(ID);
        expect(getAt(TRASH + '/' + ID)).toEqual(saved);
        expect({ daily: getAt(DAILY), monthly: getAt(MONTHLY) }).toEqual(beforeMoney);
    });

    it('journal កំណែចាស់កាត់លុយរួច · signed trash មានស្រាប់មិនទាន់ flip ➜ stamp និង flip ដោយមិនកាត់ម្ដងទៀត', async () => {
        const original = await install('flip', true);
        const trash = { ...original, trashReason: 'remove', barcodes: original.barcodes.map((barcode) => ({ ...barcode, ztoSignedAt: original.deletedAt - 3600000 })) };
        setAt(TRASH + '/' + ID, trash);
        dataState.deletedItems = [clone(trash)];
        setAt(DAILY + '/' + DAY, { codDollar: 93, dodDollar: 0, totalCount: 9 });
        setAt(MONTHLY + '/' + MONTH, { codDollar: 93, dodDollar: 0, totalCount: 9 });
        dataState.dailyRevenueData = getAt(DAILY);
        dataState.monthlyRevenueData = getAt(MONTHLY);
        noteCleanupJournalEntry({ ...readCleanupJournal()[0], reason: 'remove', trashItem: trash });
        const beforeMoney = { daily: getAt(DAILY), monthly: getAt(MONTHLY) };
        lab.validateSignedTrash = true;
        await resumeCleanupJournalEntry(ID);
        expect(readCleanupJournal()).toEqual([]);
        expect(getAt(TRASH + '/' + ID)).toMatchObject({ restoreBlocked: true, barcodes: [{ code: 'C', isDeducted: true }] });
        expect(getAt(HISTORY + '/' + ID)).toBeNull();
        expect({ daily: getAt(DAILY), monthly: getAt(MONTHLY) }).toEqual(beforeMoney);
        await resumeCleanupJournalEntry(ID);
        expect({ daily: getAt(DAILY), monthly: getAt(MONTHLY) }).toEqual(beforeMoney);
    });

    it.each([['moved', false], ['slot', false], ['ledger', false], ['moved', true], ['slot', true], ['ledger', true]] as const)('peer Restore មុន recovery អាន trash ចុងក្រោយ · stage=%s · merge target=%s · view ចាស់ ➜ មិនស្តារ trash ឬកាត់ប្រាក់វិញ', async (stage, merged) => {
        const trash = await install(stage, stage === 'slot', stage === 'ledger' ? { ledger: 'keyed' } : {});
        const targetId = merged ? ID + '_peer' : ID;
        const sdk = firebaseState.fb as any;
        const get = sdk.get;
        const restore = () => {
            const restored = { ...clone(trash), restoredAt: getServerNow() };
            restored.barcodes = restored.barcodes.map((b: any) => ({ ...b, restoredAt: restored.restoredAt, isDeducted: false }));
            delete restored.deletedAt; delete restored.trashReason; delete restored.isFromDeletion;
            restored.id = targetId;
            setAt(HISTORY + '/' + targetId, restored); setAt(TRASH + '/' + ID, null);
            setAt('zoew_restore_finalizations/' + ID, { token: 'peer_restore_token', targetId, finalizedAt: getServerNow() });
        };
        if (stage === 'moved') restore();
        else {
            let reads = 0;
            sdk.get = async (ref: any) => {
                const snapshot = await get(ref);
                if (ref.path === TRASH + '/' + ID && ++reads === 1) restore();
                return snapshot;
            };
        }
        dataState.scanHistory = []; dataState.deletedItems = [];
        await resumeCleanupJournalEntry(ID);
        expect(getAt(TRASH + '/' + ID)).toBeNull();
        expect(getAt(HISTORY + '/' + targetId).barcodes[0].code).toBe('C');
        expect(getAt(DAILY + '/' + DAY).codDollar).toBe(100);
        expect(getAt(MONTHLY + '/' + MONTH).codDollar).toBe(100);
        if (stage === 'ledger') {
            expect(readCleanupJournal()).toHaveLength(1);
            expect(readCleanupJournal()[0].stage).toBe('undo');
            await resumeCleanupJournalEntry(ID);
            expect(readCleanupJournal()).toHaveLength(1);
            expect(getAt(DAILY + '/' + DAY).codDollar).toBe(100);
            expect(getAt(MONTHLY + '/' + MONTH).codDollar).toBe(100);
        } else expect(readCleanupJournal()).toEqual([]);
    });

    it.each([undefined, null, NaN, {}, []])('recovery source id មិនត្រឹមត្រូវ %s ➜ រង់ចាំ និងមិនប៉ះ backend', async (id) => {
        await install('moved', false);
        const sdk = firebaseState.fb as any;
        sdk.get = vi.fn(sdk.get);
        expect(await cleanupHistoryForRecovery(id)).toBeNull();
        expect(sdk.get).not.toHaveBeenCalled();
        expect(lab.writes).toEqual([]);
    });

    it.each(['zoew_restore_finalizations/' + ID, HISTORY + '/' + ID + '_peer'])('ប្តូរហាងពេលអាន %s ➜ ផ្អាក recovery ហើយរក្សា journal ដើម', async (path) => {
        const trash = await install('moved', false);
        setAt('zoew_restore_finalizations/' + ID, { token: 'peer_restore_token', targetId: ID + '_peer', finalizedAt: getServerNow() });
        setAt(HISTORY + '/' + ID + '_peer', { ...trash, id: ID + '_peer', barcodes: trash.barcodes.map((b: any) => ({ ...b, restoredAt: getServerNow() })) });
        switchOnce((i) => i.kind === 'get' && i.path === path);
        await resumeCleanupJournalEntry(ID);
        expect(writesTo(DB_B)).toEqual([]);
        expect(readCleanupJournal()).toHaveLength(1);
    });

    it('finalization target ជា hint ចាស់ · Server មានតែកូដផ្សេង ➜ នៅតែស្តារ trash និងកាត់តែម្តង', async () => {
        const trash = await install('moved', false);
        const targetId = ID + '_peer';
        const old = { ...trash, id: targetId, barcodes: trash.barcodes.map((b: any) => ({ ...b, restoredAt: getServerNow() })) };
        dataState.scanHistory = [clone(old)];
        setAt('zoew_restore_finalizations/' + ID, { token: 'old_restore_token', targetId, finalizedAt: getServerNow() - 86400000 });
        setAt(HISTORY + '/' + targetId, { ...old, barcode: 'D', barcodes: old.barcodes.map((b: any) => ({ ...b, code: 'D' })) });
        await resumeCleanupJournalEntry(ID);
        expect(getAt(TRASH + '/' + ID).barcodes[0].code).toBe('C');
        expect(getAt(DAILY + '/' + DAY).codDollar).toBe(93);
        expect(getAt(MONTHLY + '/' + MONTH).codDollar).toBe(93);
        expect(readCleanupJournal()).toEqual([]);
    });

    it.each([false, true])('server commit=%s · history view ចាស់ផ្ទុយពី Server ➜ recovery ផ្ទៀងម្ចាស់មុនសរសេរ trash ឬកែប្រាក់', async (committed) => {
        const item = await install('slot', false);
        if (!committed) setAt(HISTORY + '/' + ID, item);
        dataState.scanHistory = committed ? [clone(item)] : [];
        markCleanupJournalLive(ID);
        await resumeInterruptedCleanups();
        releaseCleanupJournalLive(ID);
        await vi.waitFor(() => expect(readCleanupJournal()).toEqual([]));
        expect(getAt(TRASH + '/' + ID) !== null).toBe(committed);
        expect(getAt(DAILY + '/' + DAY).codDollar).toBe(committed ? 93 : 100);
        expect(getAt(MONTHLY + '/' + MONTH).codDollar).toBe(committed ? 93 : 100);
    });

    it.each([false, true])('Web Lock មិនទាន់ដោះពិត · ប្តូរ session=%s ➜ រង់ចាំ lock settled និងរក្សាហាងដើម', async (switchSession) => {
        await install('moved', false);
        let unlock = () => {};
        const released = new Promise<void>((resolve) => { unlock = resolve; });
        vi.stubGlobal('navigator', { locks: { request: async (_name: string, options: any, callback?: any) => {
            if (typeof options === 'function') { await options(); await released; }
            else await callback({ name: _name });
        } } });
        markCleanupJournalLive(ID);
        await resumeInterruptedCleanups();
        releaseCleanupJournalLive(ID);
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(lab.writes).toEqual([]);
        expect(readCleanupJournal()).toHaveLength(1);
        if (switchSession) switchToShopB();
        unlock();
        if (switchSession) {
            await new Promise((resolve) => setTimeout(resolve, 30));
            expect(writesTo(DB_B)).toEqual([]);
            expect(readCleanupJournal()).toHaveLength(1);
        } else {
            await vi.waitFor(() => expect(readCleanupJournal()).toEqual([]));
            expect(getAt(DAILY + '/' + DAY).codDollar).toBe(93);
        }
    });

    it('reconnect មកពេលម្ចាស់ដើមនៅកាន់សោ ➜ ដោះសោហើយបន្ត journal ដែលនៅសល់ដោយខ្លួនឯង ម្តងគត់', async () => {
        await install('moved', false);
        markCleanupJournalLive(ID);
        await resumeInterruptedCleanups();
        expect(readCleanupJournal()).toHaveLength(1);
        expect(lab.writes).toEqual([]);
        releaseCleanupJournalLive(ID);
        await vi.waitFor(() => expect(readCleanupJournal()).toEqual([]));
        expect(getAt(DAILY + '/' + DAY).codDollar).toBe(93);
        expect(getAt(MONTHLY + '/' + MONTH).codDollar).toBe(93);
        expect(getAt(TRASH + '/' + ID).barcodes[0].isDeducted).toBe(true);
        releaseCleanupJournalLive(ID);
        await resumeInterruptedCleanups();
        expect(getAt(DAILY + '/' + DAY).codDollar).toBe(93);
    });

    it('ដោះសោពេល recovery ផ្សេងកំពុងអាន ➜ រង់ចាំ pass នោះ រួចបន្ត intent ដែលបានរំលង', async () => {
        await install('moved', false);
        markCleanupJournalLive(ID);
        const second = clone(readCleanupJournal()[0]);
        second.id = ID + '_2'; second.trashItem.id = second.id;
        second.trashItem.barcode = 'D'; second.trashItem.barcodes[0].code = 'D';
        noteCleanupJournalEntry(second);
        const sdk = firebaseState.fb as any;
        const get = sdk.get;
        let reading = false;
        let release = () => {};
        const gate = new Promise<void>((resolve) => { release = resolve; });
        sdk.get = async (ref: any) => {
            if (ref.path === TRASH + '/' + second.id) { reading = true; await gate; }
            return get(ref);
        };
        const recovering = resumeInterruptedCleanups();
        await vi.waitFor(() => expect(reading).toBe(true));
        releaseCleanupJournalLive(ID);
        release();
        await recovering;
        await vi.waitFor(() => expect(readCleanupJournal()).toEqual([]));
        expect(getAt(DAILY + '/' + DAY).codDollar).toBe(86);
        expect(getAt(MONTHLY + '/' + MONTH).codDollar).toBe(86);
    });

    it('ប្តូរហាងមុនដោះសោ ➜ មិនចាប់ recovery ក្នុងហាងថ្មី និងរក្សា journal ហាងដើម', async () => {
        await install('moved', false);
        markCleanupJournalLive(ID);
        switchToShopB();
        releaseCleanupJournalLive(ID);
        await new Promise((resolve) => setTimeout(resolve, 30));
        expect(writesTo(DB_B)).toEqual([]);
        expect(readCleanupJournal()).toHaveLength(1);
    });

    it('១. stage moved ៖ ប្តូរទៅហាង B ពេលអានធុងសំរាម ➜ មិនសរសេរធុងសំរាម · មិនកាត់ប្រាក់ក្នុង B', async () => {
        await install('moved', false);
        switchOnce((i) => i.kind === 'get' && i.path === TRASH + '/' + ID);
        await resumeCleanupJournalEntry(ID);
        await new Promise((resolve) => setTimeout(resolve, 50));
        expect(writesTo(DB_B)).toEqual([]);
    }, 20000);

    it('២. stage moved (ធុងសំរាមមានក្នុង A) ៖ ប្តូរទៅហាង B ក្រោយជំហាន ledger ខែ ➜ ជំហានថ្ងៃ · flip មិនសរសេរក្នុង B', async () => {
        await install('moved', true);
        switchOnce((i) => i.kind === 'tx' && i.path === MONTHLY);
        await resumeCleanupJournalEntry(ID);
        await new Promise((resolve) => setTimeout(resolve, 50));
        expect(writesTo(DB_A)).toEqual([MONTHLY]);
        expect(writesTo(DB_B)).toEqual([]);
    }, 20000);

    it('៣. stage slot ៖ ប្តូរទៅហាង B ពេលអាន slot ➜ មិនទាមទារ slot · មិនកាត់ប្រាក់ក្នុង B', async () => {
        await install('slot', false);
        switchOnce((i) => i.kind === 'get' && i.path === TRASH + '/' + ID);
        await resumeCleanupJournalEntry(ID);
        await new Promise((resolve) => setTimeout(resolve, 50));
        expect(writesTo(DB_B)).toEqual([]);
    }, 20000);

    it('៤. stage moved ៖ ប្តូរទៅហាង B ក្រោយសរសេរធុងសំរាមឡើងវិញក្នុង A ➜ មិនកាត់ប្រាក់ក្នុង B · journal នៅសម្រាប់ A', async () => {
        await install('moved', false);
        switchOnce((i) => i.kind === 'update' && i.path === TRASH + '/' + ID);
        await resumeCleanupJournalEntry(ID);
        await new Promise((resolve) => setTimeout(resolve, 50));
        expect(writesTo(DB_A)).toEqual([TRASH + '/' + ID]);
        expect(writesTo(DB_B)).toEqual([]);
        expect(readCleanupJournal().length).toBe(1);
    }, 20000);

    it('៥. ទិសផ្ទុយ ៖ session ដដែល ➜ stage moved សរសេរធុងសំរាម · កាត់ ៧ · flip · journal ទទេ', async () => {
        await install('moved', false);
        await resumeCleanupJournalEntry(ID);
        expect(writesTo(DB_B)).toEqual([]);
        expect(getAt(TRASH + '/' + ID).barcodes[0].isDeducted).toBe(true);
        expect(getAt(DAILY + '/' + DAY).codDollar).toBe(93);
        expect(getAt(MONTHLY + '/' + MONTH).codDollar).toBe(93);
        expect(readCleanupJournal().length).toBe(0);
    }, 20000);
});
