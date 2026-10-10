import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dataState, firebaseState, uiState } from '../src/core/state';
import { getServerNow } from '../src/core/clock';
import { getFormattedDate } from '../src/core/timezone';
import { dbListenerFailedPaths, dbListenerPendingPaths } from '../src/core/text';
import { claimAndCleanupItem, cleanupInFlight, cleanupJournalLive, noteCleanupJournalEntry, resumeCleanupJournalEntry, runAutomaticCleanupRules, runAutomaticDeletedCleanup } from '../src/domain/cleanup';
import { claimBarcodeInRegistry, releaseBarcodesInRegistry } from '../src/domain/registry';
import { repairPickupLedgerOnce } from '../src/domain/pickup';
import { resetPickupStats } from '../src/domain/collected';
import { applyBarcodeCloseChange, removeSingleBarcode, saveEditedBarcodePrice } from '../src/features/barcode-ops';
import { saveExchangeRate } from '../src/features/exchange-rate';
import { saveBarcodeOrigins } from '../src/features/barcode-origin';
import { clearHistory, releaseStaleClearHistoryClaim } from '../src/features/clear-history';
import { deleteSingleItem, saveEditedPhone, setCallMark, toggleCloseStatus } from '../src/features/entry-ops';
import { buildLockerBarcodeIndex } from '../src/features/locker';
import { assignLockerToEntry } from '../src/features/locker-assign';
import { activeRestoreClaims, executePermanentDelete, executeRestoreItem } from '../src/features/restore';
import { addOrUpdateEntry } from '../src/features/scan-action';
import { ABANDON_AGE_MS, TWO_HOURS_MS } from '../src/features/session';
import { activeClearHistoryClaims } from '../src/ui/history-render';

// ⛔ fuzz ប្តូរ session ៖ ប្រតិបត្តិការសរសេរពិតនីមួយៗចាប់ផ្តើមក្នុងហាង A ➜ ចម្លើយនៃការហៅ Firebase ទី k មកដល់ក្រោយ macrotask ដែលប្តូរទៅហាង B
//    (Database ថ្មី + authGeneration ថ្មី · k = ១ … N ៖ គ្រប់ចំណុច await · ការប្តូរកើតតែពេល event loop ទំនេរ ដូចសកម្មភាពអ្នកប្រើពិត) ➜ ដំណើរការ timer រហូត retry · ពិដាន dbOp · late commit អស់ ➜ **គ្មានការសរសេរណាមួយចេញក្រោយការប្តូរ**
//    (Supabase ៖ ការសរសេរដែលចេញក្រោយការប្តូរ = គណនីថ្មីក្នុង Project ដដែល = ហាងផ្សេង មិនថា ref ចាប់មុនឬអត់)។
const HISTORY = 'zoew_scan_history_cod_dod';
const TRASH = 'zoew_recently_deleted_cod_dod';
const DAILY = 'zoew_daily_revenue_cod_dod';
const MONTHLY = 'zoew_monthly_revenue_cod_dod';
const PICKUP = 'zoew_daily_pickup_cod_dod';
const COLLECTED = 'zoew_daily_collected_cod_dod';
const REGISTRY = 'zoew_barcode_registry';
const DB_A = { name: 'shop-a' };
const DB_B = { name: 'shop-b' };
const URL_A = 'https://shop-a.firebaseio.com';
const URL_B = 'https://shop-b.firebaseio.com';
const ID1 = 'id_1758000000001_aaaa1';
const ID2 = 'id_1758000000002_aaaa2';
const ID3 = 'id_1758000000003_aaaa3';
const TID = 'id_1758000000004_tttt1';

const WRITE_METHODS = new Set(['update', 'set', 'runTransaction', 'remove', 'push']);
const lab = {
    store: {} as Record<string, any>,
    calls: 0,
    writes: 0,
    switchAt: Infinity,
    switched: false,
    late: [] as string[],
    day: '',
    rejectWrite: 0,
    writesSeen: 0,
    rejectPending: false
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
function setAt(path: string, value: any) {
    const parts = split(path);
    if (!parts.length) return;
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
    return { key: ref && ref.key, ref, val: () => clone(value), exists: () => value !== null && value !== undefined, forEach: () => false };
}
function noteCall(method: string, path: string): Promise<void> | null {
    lab.calls++;
    if (WRITE_METHODS.has(method)) {
        lab.writes++;
        lab.writesSeen++;
        if (lab.rejectWrite && lab.writesSeen === lab.rejectWrite) lab.rejectPending = true;
    }
    if (lab.switched && WRITE_METHODS.has(method)) lab.late.push(method + ' ' + path);
    if (lab.calls !== lab.switchAt || lab.switched) return null;
    return new Promise((resolve) => setTimeout(() => { switchToShopB(); resolve(); }, 0));
}
function failIfRejected() {
    if (!lab.rejectPending) return;
    lab.rejectPending = false;
    throw new Error('Network error');
}
function makeFb() {
    return {
        ref: (db: any, path = '') => makeRef(db, path),
        increment: (n: number) => ({ __inc__: n }),
        serverTimestamp: () => getServerNow(),
        get: async (ref: any) => {
            { const gate = noteCall('get', ref.path); if (gate) await gate; }
            return snap(ref, getAt(ref.path));
        },
        update: async (ref: any, updates: any) => {
            { const gate = noteCall('update', ref.path); if (gate) await gate; }
            failIfRejected();
            for (const key of Object.keys(updates)) {
                const path = [ref.path, key].filter(Boolean).join('/');
                let value = updates[key];
                if (value && typeof value === 'object' && value.__inc__ !== undefined) value = (Number(getAt(path)) || 0) + value.__inc__;
                setAt(path, value);
            }
        },
        set: async (ref: any, value: any) => {
            { const gate = noteCall('set', ref.path); if (gate) await gate; }
            failIfRejected();
            setAt(ref.path, value);
        },
        remove: async (ref: any) => {
            { const gate = noteCall('remove', ref.path); if (gate) await gate; }
            failIfRejected();
            setAt(ref.path, null);
        },
        runTransaction: async (ref: any, updater: any) => {
            { const gate = noteCall('runTransaction', ref.path); if (gate) await gate; }
            failIfRejected();
            const prior = getAt(ref.path);
            const proposed = updater(clone(prior));
            if (proposed === undefined) return { committed: false, snapshot: snap(ref, prior) };
            setAt(ref.path, proposed);
            return { committed: true, snapshot: snap(ref, getAt(ref.path)) };
        },
        onValue: () => () => {},
        off: () => {}
    };
}
function attachShop(db: any, url: string) {
    firebaseState.db = db as any;
    try { localStorage.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: url })); } catch {}
    firebaseState.firebaseConfig = { databaseURL: url } as any;
    firebaseState.dbRefHistory = makeRef(db, HISTORY) as any;
    firebaseState.dbRefDeleted = makeRef(db, TRASH) as any;
    firebaseState.dbRefDailyRevenue = makeRef(db, DAILY) as any;
    firebaseState.dbRefMonthlyRevenue = makeRef(db, MONTHLY) as any;
    firebaseState.dbRefDailyPickup = makeRef(db, PICKUP) as any;
    firebaseState.dbRefDailyCollected = makeRef(db, COLLECTED) as any;
    (firebaseState as any).dbRefExchangeRate = makeRef(db, 'zoew_settings/exchange_rate') as any;
}
function switchToShopB() {
    lab.switched = true;
    firebaseState.authGeneration++;
    attachShop(DB_B, URL_B);
    dataState.scanHistory = [];
    dataState.deletedItems = [];
    dataState.dailyRevenueData = {};
    dataState.monthlyRevenueData = {};
    dataState.dailyPickupData = {};
    dataState.dailyCollectedData = {};
}
function barcodeOf(code: string, cod: number, createdAt: number, extra: any = {}) {
    return { code, time: '08:00:00 (' + lab.day + ')', cod, dod: 0, locker: 'N/A', isClosed: false, isDeducted: false, isFromDeletion: false, createdAt, ...extra };
}
function seedShopA() {
    const now = getServerNow();
    lab.day = getFormattedDate(now as any);
    const month = lab.day.substring(0, 7);
    const recent = now - 3600000;
    const old = now - ABANDON_AGE_MS - 3600000;
    const closedAt = now - TWO_HOURS_MS - 60000;
    const item1 = { id: ID1, phone: '0960001111', scanDate: lab.day, time: '08:00:00 (' + lab.day + ')', createdAt: recent, count: 2, cod: 10, dod: 0, price: 10,
        isClosed: false, isCalled: false, barcode: 'C', barcodes: [barcodeOf('C', 7, recent), barcodeOf('D', 3, recent)] };
    const item2 = { id: ID2, phone: '0960002222', scanDate: lab.day, time: '08:00:00 (' + lab.day + ')', createdAt: old, count: 1, cod: 5, dod: 0, price: 5,
        isClosed: false, isCalled: false, barcode: 'E', barcodes: [barcodeOf('E', 5, old)] };
    const item3 = { id: ID3, phone: '0960003333', scanDate: lab.day, time: '08:00:00 (' + lab.day + ')', createdAt: recent, count: 1, cod: 4, dod: 0, price: 4,
        isClosed: true, closedAt, isCalled: false, barcode: 'F', barcodes: [barcodeOf('F', 4, recent, { isClosed: true, closedAt })] };
    const trash = { id: TID, phone: '0960004444', scanDate: lab.day, time: '08:00:00 (' + lab.day + ')', createdAt: recent, count: 1, cod: 6, dod: 0, price: 6,
        isClosed: false, barcode: 'G', barcodes: [barcodeOf('G', 6, recent, { isDeducted: true })], deletedAt: now - 60000, isFromDeletion: false, trashReason: 'remove' };
    lab.store = {
        [HISTORY]: { [ID1]: clone(item1), [ID2]: clone(item2), [ID3]: clone(item3) },
        [TRASH]: { [TID]: clone(trash) },
        [DAILY]: { [lab.day]: { codDollar: 100, dodDollar: 0, totalCount: 10 } },
        [MONTHLY]: { [month]: { codDollar: 100, dodDollar: 0, totalCount: 10 } },
        [PICKUP]: { [lab.day]: { packagesPickedUp: 1, pickedUpBarcodes: { F: '0960003333' } } },
        [REGISTRY]: { C: true, D: true, E: true, F: true, G: true }
    };
    firebaseState.fb = makeFb() as any;
    firebaseState.auth = { currentUser: { uid: 'u1', email: 'a@zoew1.com', getIdToken: async () => 'tok' } } as any;
    firebaseState.isDatabaseInitialized = true;
    firebaseState.isDatabaseConnected = true;
    firebaseState.serverClockTrusted = true;
    firebaseState.hasEverConnectedToDatabase = true;
    attachShop(DB_A, URL_A);
    dataState.scanHistory = [clone(item1), clone(item2), clone(item3)];
    dataState.deletedItems = [clone(trash)];
    dataState.dailyRevenueData = clone(lab.store[DAILY]);
    dataState.monthlyRevenueData = clone(lab.store[MONTHLY]);
    dataState.dailyPickupData = clone(lab.store[PICKUP]);
    dataState.dailyCollectedData = {};
    buildLockerBarcodeIndex();
}
function inputValue(id: string, value: string) {
    let el = document.getElementById(id) as HTMLInputElement | null;
    if (!el) {
        el = document.createElement('input');
        el.id = id;
        document.body.appendChild(el);
    }
    el.value = value;
}

type Scenario = { name: string; prepare?: () => void; run: () => Promise<any> | any };
const SCENARIOS: Scenario[] = [
    { name: 'ដក barcode (removeSingleBarcode)', run: () => removeSingleBarcode(ID1, 'C') },
    { name: 'លុប (deleteSingleItem)', run: () => deleteSingleItem(ID1) },
    { name: 'បិទកញ្ចប់ទាំងមូល (toggleCloseStatus)', run: () => toggleCloseStatus(ID1) },
    { name: 'បិទ barcode មួយ (applyBarcodeCloseChange)', run: () => applyBarcodeCloseChange(ID1, 'C', true, {}) },
    { name: 'បើក barcode ឡើងវិញ (applyBarcodeCloseChange)', run: () => applyBarcodeCloseChange(ID3, 'F', false, {}) },
    { name: 'Locker (assignLockerToEntry)', prepare: () => { uiState.activeLocker = 'L-01'; }, run: () => assignLockerToEntry('C') },
    { name: 'សម្អាត ៨ ថ្ងៃ (claimAndCleanupItem abandon)', run: () => claimAndCleanupItem(ID2, 'abandon') },
    { name: 'សម្អាត ២ ម៉ោង (claimAndCleanupItem close)', run: () => claimAndCleanupItem(ID3, 'close') },
    {
        name: 'resume journal (stage moved)',
        prepare: () => {
            const trashItem = { ...clone(lab.store[HISTORY][ID2]), deletedAt: getServerNow() - 60000, isFromDeletion: false, trashReason: 'expired' };
            delete lab.store[HISTORY][ID2];
            dataState.scanHistory = dataState.scanHistory.filter((i: any) => i.id !== ID2);
            noteCleanupJournalEntry({ id: ID2, reason: 'abandon', journalAt: trashItem.deletedAt, stage: 'moved', trashItem, revenue: { scanDate: lab.day, cod: 5, dod: 0, count: 1 } });
        },
        run: () => resumeCleanupJournalEntry(ID2)
    },
    { name: 'ស្តារ (executeRestoreItem)', prepare: () => { uiState.pendingRestoreId = TID; }, run: () => executeRestoreItem() },
    { name: 'លុបអចិន្ត្រៃយ៍ (executePermanentDelete)', prepare: () => { uiState.pendingPermanentDeleteId = TID; }, run: () => executePermanentDelete() },
    { name: 'លុបទាំងអស់ (clearHistory)', prepare: () => { uiState.currentFilterMode = 'all'; }, run: () => clearHistory() },
    { name: 'Reset ចំនួនយករួច (resetPickupStats)', prepare: () => { uiState.currentFilterMode = 'today'; }, run: () => resetPickupStats() },
    { name: 'ស្កេនរក្សាទុក (addOrUpdateEntry)', run: () => addOrUpdateEntry('N1', '0960001111', 2, 0) },
    { name: 'claim registry (claimBarcodeInRegistry)', run: () => claimBarcodeInRegistry('N2') },
    { name: 'ដោះ registry (releaseBarcodesInRegistry)', run: () => releaseBarcodesInRegistry(['C']) },
    { name: 'ប្រភពកញ្ចប់ (saveBarcodeOrigins)', run: () => saveBarcodeOrigins([{ itemId: ID1, code: 'C', from: 'Shenzhen' }]) },
    { name: 'កែលេខទូរស័ព្ទ (saveEditedPhone)', prepare: () => { uiState.editingItemId = ID1; inputValue('editPhoneInput', '0960009999'); }, run: () => saveEditedPhone() },
    { name: 'សម្គាល់ការហៅ (setCallMark)', prepare: () => { uiState.markingItemId = ID1; }, run: () => setCallMark('no-answer') },
    { name: 'purge ធុងសំរាម (runAutomaticDeletedCleanup)', prepare: () => { lab.store[TRASH][TID].deletedAt = getServerNow() - 40 * 86400000; dataState.deletedItems[0].deletedAt = lab.store[TRASH][TID].deletedAt; }, run: () => runAutomaticDeletedCleanup() },
    { name: 'កែតម្លៃ barcode (saveEditedBarcodePrice)', prepare: () => { uiState.activeParentItemId = ID1; uiState.activeEditingBarcode = 'C'; inputValue('editBcCodInput', '9'); inputValue('editBcDodInput', '0'); }, run: () => saveEditedBarcodePrice() },
    { name: 'អត្រាប្រាក់ (saveExchangeRate)', prepare: () => { dataState.exchangeRateSaveInFlight = false; inputValue('exchangeRateInput', '4050'); }, run: () => saveExchangeRate() },
    { name: 'សម្អាតស្វ័យប្រវត្តិទាំងអស់ (runAutomaticCleanupRules)', run: () => runAutomaticCleanupRules() },
    {
        name: 'resume journal (stage ledger keyed)',
        prepare: () => {
            const trashItem = { ...clone(lab.store[HISTORY][ID2]), deletedAt: getServerNow() - 60000, isFromDeletion: false, trashReason: 'expired' };
            delete lab.store[HISTORY][ID2];
            lab.store[TRASH][ID2] = clone(trashItem);
            dataState.scanHistory = dataState.scanHistory.filter((i: any) => i.id !== ID2);
            const month = lab.day.substring(0, 7);
            lab.store[DAILY][lab.day].ops = { p1: 1 };
            lab.store[MONTHLY][month].ops = { p2: 1 };
            noteCleanupJournalEntry({ id: ID2, reason: 'abandon', journalAt: trashItem.deletedAt, stage: 'ledger', ledger: 'keyed', prior: { d: ['p1'], m: ['p2'] }, trashItem,
                revenue: { scanDate: lab.day, cod: 5, dod: 0, count: 1 } });
        },
        run: () => resumeCleanupJournalEntry(ID2)
    },
    {
        name: 'resume journal (stage flip)',
        prepare: () => {
            const trashItem = { ...clone(lab.store[HISTORY][ID2]), deletedAt: getServerNow() - 60000, isFromDeletion: false, trashReason: 'expired' };
            delete lab.store[HISTORY][ID2];
            dataState.scanHistory = dataState.scanHistory.filter((i: any) => i.id !== ID2);
            noteCleanupJournalEntry({ id: ID2, reason: 'abandon', journalAt: trashItem.deletedAt, stage: 'flip', ledger: 'keyed', prior: { d: [], m: [] }, trashItem,
                revenue: { scanDate: lab.day, cod: 5, dod: 0, count: 1 } });
        },
        run: () => resumeCleanupJournalEntry(ID2)
    },
    {
        name: 'ដោះ clearClaim ចាស់ (releaseStaleClearHistoryClaim)',
        prepare: () => { lab.store[HISTORY][ID1].clearClaim = { token: 't', claimedAt: getServerNow() - 10 * 60000 }; dataState.scanHistory[0].clearClaim = clone(lab.store[HISTORY][ID1].clearClaim); },
        run: () => releaseStaleClearHistoryClaim(dataState.scanHistory[0])
    },
    {
        name: 'ជួសជុល pickup (repairPickupLedgerOnce)',
        prepare: () => {
            const yesterday = getFormattedDate((getServerNow() - 86400000) as any);
            const closedAt = getServerNow() - 60000;
            const item4 = { id: 'id_1758000000005_aaaa5', phone: '0960005555', scanDate: yesterday, time: '08:00:00 (' + yesterday + ')', createdAt: closedAt - 3600000, count: 1, cod: 2, dod: 0, price: 2,
                isClosed: true, closedAt, isCalled: false, barcode: 'H', barcodes: [barcodeOf('H', 2, closedAt - 3600000, { isClosed: true, closedAt })] };
            lab.store[HISTORY][item4.id] = clone(item4);
            dataState.scanHistory.push(clone(item4));
            lab.store[PICKUP] = { [lab.day]: { packagesPickedUp: 1, pickedUpBarcodes: { X1: '0' } }, [yesterday]: { packagesPickedUp: 1, pickedUpBarcodes: { X2: '0' } } };
            dataState.dailyPickupData = clone(lab.store[PICKUP]);
            dataState.pickupLedgerRepairDone = false;
            dataState.pickupLedgerRepairRunning = false;
        },
        run: () => repairPickupLedgerOnce()
    }
];

async function drain() {
    for (let i = 0; i < 45; i++) await vi.advanceTimersByTimeAsync(2000);
}
async function runScenario(s: Scenario, switchAt: number, rejectWrite = 0) {
    lab.calls = 0;
    lab.writes = 0;
    lab.writesSeen = 0;
    lab.rejectPending = false;
    lab.rejectWrite = rejectWrite;
    lab.switchAt = switchAt;
    lab.switched = false;
    lab.late = [];
    seedShopA();
    if (s.prepare) s.prepare();
    const running = Promise.resolve().then(() => s.run()).catch(() => {});
    await drain();
    await running;
    return { calls: lab.calls, writes: lab.writes, late: lab.late.slice(), switched: lab.switched };
}

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    try { localStorage.clear(); } catch {}
    (window as any).ZoeErrors = { capture: vi.fn() };
    vi.stubGlobal('confirm', () => true);
    vi.stubGlobal('alert', () => undefined);
    uiState.toasts = [];
    dataState.clearHistoryInFlight = false;
    cleanupInFlight.clear();
    cleanupJournalLive.clear();
    activeRestoreClaims.clear();
    activeClearHistoryClaims.clear();
    dbListenerPendingPaths.clear();
    dbListenerFailedPaths.clear();
    firebaseState.authGeneration++;
});

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    delete (window as any).ZoeErrors;
});

function resetBetweenRuns() {
    cleanupInFlight.clear();
    cleanupJournalLive.clear();
    activeRestoreClaims.clear();
    activeClearHistoryClaims.clear();
    dataState.clearHistoryInFlight = false;
    try { localStorage.clear(); } catch {}
    firebaseState.authGeneration++;
}
async function leaksOf(s: Scenario, rejectWrite = 0) {
    resetBetweenRuns();
    const baseline = await runScenario(s, Infinity, rejectWrite);
    expect(baseline.writes).toBeGreaterThan(0);
    const leaks: string[] = [];
    for (let k = 1; k <= baseline.calls; k++) {
        resetBetweenRuns();
        const r = await runScenario(s, k, rejectWrite);
        if (r.late.length) leaks.push((rejectWrite ? 'w=' + rejectWrite + ' ' : '') + 'k=' + k + '/' + baseline.calls + ' ➜ ' + r.late.join(' · '));
    }
    return leaks;
}

describe('fuzz ប្តូរ session ៖ គ្មានការសរសេរចេញក្រោយការប្តូរហាង', () => {
    for (const s of SCENARIOS) {
        it(s.name, async () => {
            expect(await leaksOf(s)).toEqual([]);
        }, 120000);
    }
});

// ⛔ ផ្លូវ retry ៖ ការសរសេរទី w (w = ១ … ចំនួនការសរសេររបស់ប្រតិបត្តិការ) ធ្លាក់ (បណ្តាញ) ➜ រង្វិលសាកឡើងវិញនៃជំហាននោះ (`retryAsync()` · រង្វិលដោយដៃ ·
//    `pendingHistoryPatches`) ត្រូវចូល ➜ ការប្តូរហាងនៅការហៅទី k ណាមួយ ត្រូវឈប់វា ៖ ការសាកបន្ទាប់មិនត្រូវចេញទៅហាងថ្មីទេ។ ⛔ ធ្លាក់តែការសរសេរទី ១ មិនគ្រប់ ៖
//    ប្រតិបត្តិការច្រើនជំហាន (ស្តារ ៖ claim ➜ សរសេរប្រវត្តិ ➜ finalize) ឈប់នៅជំហានទី ១ ហើយរង្វិល retry ក្រោយៗមិនដែលត្រូវវាស់។
describe('fuzz ប្តូរ session + ការសរសេរមួយធ្លាក់ ៖ ការសាកឡើងវិញមិនចេញទៅហាងថ្មី', () => {
    for (const s of SCENARIOS) {
        it(s.name, async () => {
            resetBetweenRuns();
            const plain = await runScenario(s, Infinity);
            const leaks: string[] = [];
            for (let w = 1; w <= plain.writes; w++) leaks.push(...await leaksOf(s, w));
            expect(leaks).toEqual([]);
        }, 600000);
    }
});
