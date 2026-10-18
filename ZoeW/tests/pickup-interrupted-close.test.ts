/**
 * ⛔ A225 ៖ ការបិទ/បើកមួយសរសេរ ២ ដងដាច់ពីគ្នា — ស្ថិតិយក (`zoew_daily_pickup_cod_dod/<ថ្ងៃ>`, មុន) និងកញ្ចប់ (`zoew_scan_history_cod_dod/<id>`) —
 *    ហើយការត្រឡប់វិញ (`revertPickupMarks` · `reapplyPickupMarks`) រស់តែក្នុងទំព័រ។ ទំព័រស្លាប់ (reload · បិទ App · ថ្មអស់) ចន្លោះការសរសេរទាំង ២
 *    ➜ ស្ថិតិ «យករួច» ខុសជារៀងរហូត ៖ CI `supabase-money-multishop` ហាង ០ `packagesPickedUp` ៣ ⟷ barcode បិទ ១ (លុយត្រឹមត្រូវ)។
 *    `planPickupLedgerRepair()` ជួសតែពេលចំនួនស្មើ (រក្សា Reset) ➜ ចំនួនលើស/ខ្វះមិនជាសះស្បើយ។
 *    ច្បាប់ ៖ ប្រតិបត្តិការដែលត្រូវរំខានត្រូវបញ្ចប់នៅជុំក្រោយ ដោយយកស្ថានភាព barcode ពិតលើ server (ដូច journal ការសម្អាត ៨ ថ្ងៃ)
 *    ➜ ទិសទាំង ២ ៖ ស្ថិតិសរសេររួច history មិនទាន់ (លើស) · history សរសេររួច ស្ថិតិមិនទាន់ (ខ្វះ)។
 *    ទិសផ្ទុយ ៖ Reset (`{ packagesPickedUp: 0 }`) មិនកើតឡើងវិញ · ប្រតិបត្តិការដែលនៅរស់មិនត្រូវប៉ះ · ហាងផ្សេង / ទិដ្ឋភាពមិនទាន់ស្រស់ ➜ មិនសរសេរ។
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dataState, firebaseState, uiState } from '../src/core/state';
import { appLocalStore } from '../src/core/storage';
import { dbListenerFailedPaths, dbListenerPendingPaths } from '../src/core/text';
import { getZoneDateKey } from '../src/core/timezone';
import { barcodeRegistryKey } from '../src/domain/registry';
import * as cleanup from '../src/domain/cleanup';
import { runScheduledCleanup, resumeInterruptedCleanups } from '../src/domain/cleanup';
import * as pickup from '../src/domain/pickup';
import { toggleCloseStatus } from '../src/features/entry-ops';
import { revertPickupMarks } from '../src/domain/collected';
import { applyBarcodeCloseChange } from '../src/features/barcode-ops';

const HISTORY = 'zoew_scan_history_cod_dod';
const PICKUP = 'zoew_daily_pickup_cod_dod';
const H = 60 * 60 * 1000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const lab = { store: {} as Record<string, any>, hang: '' as string, writes: [] as string[] };

function getPath(path: string) {
    let cur: any = lab.store;
    for (const p of path.split('/').filter(Boolean)) {
        if (!cur || typeof cur !== 'object' || !(p in cur)) return null;
        cur = cur[p];
    }
    return cur === undefined ? null : JSON.parse(JSON.stringify(cur));
}
function setPath(path: string, value: any) {
    const parts = path.split('/').filter(Boolean);
    let cur: any = lab.store;
    if (value === null || value === undefined) {
        for (let i = 0; i < parts.length - 1; i++) {
            if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object') return;
            cur = cur[parts[i]];
        }
        delete cur[parts[parts.length - 1]];
        return;
    }
    for (let i = 0; i < parts.length - 1; i++) {
        if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
        cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = JSON.parse(JSON.stringify(value));
}
const hangs = (path: string) => !!lab.hang && path.indexOf(lab.hang) === 0;
function makeFb() {
    return {
        getIdTokenResult: async () => ({ token: 't' }),
        ref: (_db: unknown, path: string) => ({ path }),
        get: async (ref: any) => { await sleep(2); const v = getPath(ref.path); return { val: () => v, exists: () => v !== null }; },
        update: async (ref: any, payload: any) => {
            await sleep(2);
            for (const k of Object.keys(payload)) setPath(ref.path + '/' + k, payload[k]);
            return true;
        },
        set: async (ref: any, value: any) => { await sleep(2); setPath(ref.path, value); return true; },
        runTransaction: (ref: any, fn: any) => {
            if (hangs(ref.path)) return new Promise(() => {});
            return sleep(2).then(() => {
                const cur = getPath(ref.path);
                const next = fn(cur);
                if (next === undefined) return { committed: false, snapshot: { val: () => cur } };
                setPath(ref.path, next);
                lab.writes.push(ref.path);
                const v = getPath(ref.path);
                return { committed: true, snapshot: { val: () => v } };
            });
        },
        onValue: () => () => {},
        off: () => {},
        increment: (n: number) => n
    };
}
const NOW = Date.UTC(2026, 9, 5, 9, 30, 0);
const DAY = getZoneDateKey(NOW - H, 0);
const SHOP_CONFIG = JSON.stringify({ apiKey: 'k', databaseURL: 'https://pickup-a225-default-rtdb.firebaseio.com', projectId: 'p' });

function seedItem(id: string, codes: string[], closed: string[]) {
    const barcodes = codes.map((code) => {
        const b: any = { code, isClosed: closed.includes(code), cod: 4, dod: 0, isDeducted: false, isFromDeletion: false, createdAt: NOW - 2 * H, time: '15:30:00' };
        if (b.isClosed) b.closedAt = NOW - H;
        return b;
    });
    const item: any = { id, phone: '0960007345', scanDate: DAY, isClosed: barcodes.every((b: any) => b.isClosed), createdAt: NOW - 2 * H,
        cod: 4 * codes.length, dod: 0, price: 4 * codes.length, count: codes.length, barcode: codes[0], time: '15:30:00 (' + DAY + ')', barcodes };
    if (item.isClosed) item.closedAt = NOW - H;
    setPath(HISTORY + '/' + id, item);
    codes.forEach((code) => setPath('zoew_barcode_registry/' + barcodeRegistryKey(code), true));
}
function pickupSet(keys: string[]) {
    if (!keys.length) return;
    const set: Record<string, string> = {};
    keys.forEach((code) => { set[barcodeRegistryKey(code)] = '0960007345'; });
    setPath(PICKUP + '/' + DAY, { packagesPickedUp: keys.length, pickedUpPhones: { '0960007345': keys.length }, pickedUpBarcodes: set });
}
function loadViewsFromServer() {
    const hist = getPath(HISTORY) || {};
    dataState.scanHistory = Object.keys(hist).map((k) => Object.assign({ id: k }, hist[k]));
    const trash = getPath('zoew_recently_deleted_cod_dod') || {};
    dataState.deletedItems = Object.keys(trash).map((k) => Object.assign({ id: k }, trash[k]));
    dataState.dailyPickupData = getPath(PICKUP) || {};
}
function newPage() {
    firebaseState.authGeneration++;
    (pickup as any).pickupIntentsLive?.clear();
    cleanup.cleanupJournalLive.clear();
    lab.hang = '';
    loadViewsFromServer();
}
function closedOnServer() {
    let n = 0;
    const hist = getPath(HISTORY) || {};
    Object.keys(hist).forEach((id) => (hist[id].barcodes || []).forEach((b: any) => { if (hist[id].scanDate === DAY && b.isClosed) n++; }));
    return n;
}
const journal = () => { try { return JSON.parse(appLocalStore.getItem('zoew_pickup_journal_v1') || '[]'); } catch { return ['unreadable']; } };
const recorded = () => { const r = getPath(PICKUP + '/' + DAY); return r ? r.packagesPickedUp : 0; };
async function doors() {
    runScheduledCleanup();
    await resumeInterruptedCleanups();
    await sleep(60);
}

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(NOW));
    lab.store = {};
    lab.hang = '';
    lab.writes = [];
    appLocalStore.clear();
    appLocalStore.setItem('zoew_firebase_config', SHOP_CONFIG);
    dbListenerPendingPaths.clear();
    dbListenerFailedPaths.clear();
    dataState.scanHistory = [];
    dataState.deletedItems = [];
    dataState.dailyRevenueData = {};
    dataState.monthlyRevenueData = {};
    dataState.dailyCollectedData = {};
    dataState.dailyPickupData = {};
    dataState.pickupLedgerRepairDone = false;
    dataState.pickupLedgerRepairRunning = false;
    uiState.toasts = [];
    (pickup as any).pickupIntentsLive?.clear();
    cleanup.cleanupJournalLive.clear();
    firebaseState.authGeneration++;
    firebaseState.auth = { currentUser: { uid: 'pickup-a225' } } as any;
    firebaseState.db = { a225: true } as any;
    firebaseState.isDatabaseInitialized = true;
    firebaseState.dbListenersFailed = false;
    firebaseState.isDatabaseConnected = true;
    firebaseState.serverClockTrusted = true;
    firebaseState.serverTimeOffsetMs = 0;
    firebaseState.fb = makeFb() as any;
    for (const [name, path] of [['dbRefHistory', HISTORY], ['dbRefDeleted', 'zoew_recently_deleted_cod_dod'],
        ['dbRefDailyRevenue', 'zoew_daily_revenue_cod_dod'], ['dbRefMonthlyRevenue', 'zoew_monthly_revenue_cod_dod'],
        ['dbRefDailyCollected', 'zoew_daily_collected_cod_dod'], ['dbRefDailyPickup', PICKUP],
        ['dbRefRegistry', 'zoew_barcode_registry']] as const) {
        (firebaseState as any)[name] = { path };
    }
    firebaseState.dbLivenessProbe = Promise.resolve(null) as any;
    vi.stubGlobal('confirm', () => true);
    vi.stubGlobal('alert', () => undefined);
    (window as any).ZoeErrors = { capture: () => {} };
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete (window as any).ZoeErrors;
    firebaseState.dbLivenessProbe = null as any;
    firebaseState.serverClockTrusted = false;
    firebaseState.isDatabaseConnected = false;
    firebaseState.isDatabaseInitialized = false;
    appLocalStore.clear();
});

it.each([['whole', true], ['barcode', true], ['whole', false], ['barcode', false]])('មិនដាក់ pickup ចាស់វិញ ពេល %s បើកកញ្ចប់ដែលឧបករណ៍ផ្សេងដករួច (listener ថ្មី %s)', async (kind, listenerFresh) => {
    const code = 'PICKUPRACE01';
    seedItem('race', [code], [code]);
    pickupSet([code]);
    loadViewsFromServer();
    const trash = getPath(HISTORY + '/race');
    trash.id = 'race-trash'; trash.isClosed = false; delete trash.closedAt;
    trash.barcodes.forEach((b: any) => { b.isClosed = false; delete b.closedAt; });
    setPath(HISTORY + '/race', null);
    setPath('zoew_recently_deleted_cod_dod/race-trash', trash);
    setPath(PICKUP + '/' + DAY, { packagesPickedUp: 0 });
    const fb = firebaseState.fb as any;
    const transact = fb.runTransaction;
    vi.spyOn(fb, 'runTransaction').mockImplementation((ref: any, updater: any) => {
        if (listenerFresh && ref.path === HISTORY + '/race') {
            dataState.scanHistory = [];
            dataState.deletedItems = [structuredClone(trash)];
        }
        return transact(ref, updater);
    });
    const saved = kind === 'whole' ? await toggleCloseStatus('race')
        : await applyBarcodeCloseChange('race', code, false, { silent: true, showModal: false });
    await sleep(15);
    expect(saved).toBe(false);
    expect(recorded()).toBe(0);
    expect(getPath('zoew_recently_deleted_cod_dod/race-trash').barcodes[0].isClosed).toBe(false);
});

it.each(['whole', 'barcode'])('rollback %s ក្រោយ Reset មិនបង្កើត pickup ចាស់ឡើងវិញ', async (kind) => {
    const code = 'PICKUPRESET01';
    seedItem('reset', [code], [code]);
    loadViewsFromServer();
    const fb = firebaseState.fb as any;
    const transact = fb.runTransaction;
    vi.spyOn(fb, 'runTransaction').mockImplementation((ref: any, updater: any) => {
        if (ref.path === HISTORY + '/reset') return Promise.resolve({ committed: false, snapshot: { val: () => getPath(ref.path) } });
        return transact(ref, updater);
    });
    const saved = kind === 'whole' ? await toggleCloseStatus('reset')
        : await applyBarcodeCloseChange('reset', code, false, { silent: true, showModal: false });
    await sleep(20);
    expect(saved).toBe(false);
    expect(recorded()).toBe(0);
});

it('rollback read បរាជ័យរក្សា journal ហើយស្តារតាម Server ពេល listener មកដល់', async () => {
    const code = 'PICKUPREAD01';
    seedItem('read', [code], [code]);
    pickupSet([code]);
    loadViewsFromServer();
    const id = pickup.beginPickupIntent(DAY, [barcodeRegistryKey(code)]);
    const applied = pickup.markPickupBarcodes(DAY, [{ key: barcodeRegistryKey(code), phoneKey: '0960007345', closed: false }], null);
    await applied.commit;
    const broken = vi.spyOn(firebaseState.fb as any, 'get').mockRejectedValue(new Error('offline'));
    const reverted = revertPickupMarks(applied, null, true);
    pickup.endPickupIntent(id, reverted.commit);
    await sleep(15);
    expect(journal()).toHaveLength(1);
    expect(recorded()).toBe(0);
    broken.mockRestore();
    loadViewsFromServer();
    await doors();
    expect(recorded()).toBe(1);
    expect(journal()).toEqual([]);
});

it('journal retry ក្រោយ read បរាជ័យ មិនទុកចិត្ត listener ចាស់', async () => {
    const code = 'PICKUPDELAYRETRY01';
    seedItem('delayed-retry', [code], [code]);
    pickupSet([code]);
    loadViewsFromServer();
    const trash = getPath(HISTORY + '/delayed-retry');
    trash.id = 'delayed-trash'; trash.isClosed = false; delete trash.closedAt;
    trash.barcodes.forEach((b: any) => { b.isClosed = false; delete b.closedAt; });
    setPath(HISTORY + '/delayed-retry', null);
    setPath('zoew_recently_deleted_cod_dod/delayed-trash', trash);
    setPath(PICKUP + '/' + DAY, { packagesPickedUp: 0 });
    const broken = vi.spyOn(firebaseState.fb as any, 'get').mockRejectedValue(new Error('offline'));
    expect(await toggleCloseStatus('delayed-retry')).toBe(false);
    await sleep(15);
    expect(journal()).toHaveLength(1);
    broken.mockRestore();
    await pickup.resumePickupIntents();
    expect(recorded()).toBe(0);
    expect(journal()).toEqual([]);
});

it('Firebase rollback អាន REST no-store ជំនួស SDK cache ចាស់', async () => {
    const code = 'PICKUPREST01';
    seedItem('rest', [code], [code]);
    pickupSet([code]);
    loadViewsFromServer();
    const applied = pickup.markPickupBarcodes(DAY, [{ key: barcodeRegistryKey(code), phoneKey: '0960007345', closed: false }], null);
    await applied.commit;
    const fb = firebaseState.fb as any;
    firebaseState.firebaseConfig = JSON.parse(SHOP_CONFIG);
    firebaseState.auth.currentUser.getIdToken = async () => 'fake-test-token';
    vi.spyOn(fb, 'ref').mockImplementation((_db: any, path: any) => ({ path, toString: () => JSON.parse(SHOP_CONFIG).databaseURL + '/' + path }));
    const cached = vi.spyOn(fb, 'get').mockRejectedValue(new Error('must not read cached SDK snapshot'));
    const fetch = vi.fn(async (url: string, init: any) => {
        expect(init.cache).toBe('no-store');
        expect(init.credentials).toBe('omit');
        const parsed = new URL(url);
        expect(parsed.searchParams.get('auth')).toBe('fake-test-token');
        return new Response(JSON.stringify(getPath(parsed.pathname.slice(1).replace(/\.json$/, ''))), { status: 200 });
    });
    vi.stubGlobal('fetch', fetch);
    const reverted = revertPickupMarks(applied, null, true);
    expect(await reverted.commit).toBe(true);
    expect(recorded()).toBe(1);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(cached).not.toHaveBeenCalled();
});

it('rollback read មកយឺតក្រោយប្ដូរ session មិនសរសេរទៅ database ថ្មី', async () => {
    const code = 'PICKUPSWITCH01';
    seedItem('switch', [code], [code]);
    pickupSet([code]);
    loadViewsFromServer();
    const applied = pickup.markPickupBarcodes(DAY, [{ key: barcodeRegistryKey(code), phoneKey: '0960007345', closed: false }], null);
    await applied.commit;
    const releases: Array<() => void> = [];
    vi.spyOn(firebaseState.fb as any, 'get').mockImplementation((ref: any) => new Promise((resolve) => {
        const raw = getPath(ref.path);
        releases.push(() => resolve({ val: () => raw }));
    }));
    const writesBefore = lab.writes.length;
    const reverted = revertPickupMarks(applied, null, true);
    firebaseState.authGeneration++;
    firebaseState.db = { nextShop: true } as any;
    releases.forEach((release) => release());
    expect(await reverted.commit).toBeNull();
    expect(lab.writes).toHaveLength(writesBefore);
});

it('pickup commit បរាជ័យរក្សា journal ដើម្បីស្តារជុំក្រោយ ដោយមិនរាយថា sync ចប់', async () => {
    seedItem('retry', ['PICKUPRETRY01'], ['PICKUPRETRY01']);
    loadViewsFromServer();
    const id = pickup.beginPickupIntent(DAY, [barcodeRegistryKey('PICKUPRETRY01')]);
    pickup.endPickupIntent(id, Promise.resolve(null));
    await sleep(5);
    expect(journal()).toHaveLength(1);
    expect(pickup.pickupIntentsLive.has(id)).toBe(false);
    await pickup.resumePickupIntents();
    expect(recorded()).toBe(1);
    expect(journal()).toEqual([]);
});

describe('A225 ៖ ការបិទ/បើកដែលទំព័រស្លាប់ចន្លោះ «ស្ថិតិយក» និង «កញ្ចប់» ➜ ជុំក្រោយបញ្ចប់តាមស្ថានភាពពិត', () => {
    it('⛔ បិទកញ្ចប់ ៖ ស្ថិតិសរសេររួច · កញ្ចប់មិនទាន់ ➜ ទំព័រស្លាប់ ➜ ជុំក្រោយ packagesPickedUp = barcode បិទ (មិនលើស)', async () => {
        seedItem('it1', ['A2250001', 'A2250002'], []);
        loadViewsFromServer();
        lab.hang = HISTORY;
        void toggleCloseStatus('it1');
        await sleep(40);
        expect(recorded(), 'លក្ខខណ្ឌមុន ៖ ស្ថិតិសរសេររួច ២').toBe(2);
        expect(closedOnServer(), 'លក្ខខណ្ឌមុន ៖ កញ្ចប់នៅបើក').toBe(0);
        newPage();
        await doors();
        expect(recorded(), 'ស្ថិតិយក = barcode បិទលើ server').toBe(closedOnServer());
    });

    it('⛔ បិទ barcode ៖ កញ្ចប់សរសេររួច · ស្ថិតិមិនទាន់ (ព្យួរ) ➜ ទំព័រស្លាប់ ➜ ជុំក្រោយ packagesPickedUp = barcode បិទ (មិនខ្វះ)', async () => {
        seedItem('it2', ['A2250011', 'A2250012'], []);
        loadViewsFromServer();
        lab.hang = PICKUP;
        void applyBarcodeCloseChange('it2', 'A2250011', true, { silent: true, showModal: false });
        await sleep(40);
        expect(closedOnServer(), 'លក្ខខណ្ឌមុន ៖ barcode បិទលើ server').toBe(1);
        expect(recorded(), 'លក្ខខណ្ឌមុន ៖ ស្ថិតិមិនទាន់សរសេរ').toBe(0);
        newPage();
        await doors();
        expect(recorded(), 'ស្ថិតិយក = barcode បិទលើ server').toBe(closedOnServer());
    });

    it('⛔ បើកវិញ ៖ ស្ថិតិលុបរួច · កញ្ចប់មិនទាន់ ➜ ទំព័រស្លាប់ ➜ ជុំក្រោយ ស្ថិតិត្រឡប់មកវិញ (barcode នៅបិទ)', async () => {
        seedItem('it3', ['A2250021'], ['A2250021']);
        pickupSet(['A2250021']);
        loadViewsFromServer();
        lab.hang = HISTORY;
        void applyBarcodeCloseChange('it3', 'A2250021', false, { silent: true, showModal: false });
        await sleep(40);
        expect(recorded(), 'លក្ខខណ្ឌមុន ៖ ស្ថិតិលុបរួច').toBe(0);
        newPage();
        await doors();
        expect(recorded()).toBe(closedOnServer());
        expect(closedOnServer()).toBe(1);
    });

    it('ទិសផ្ទុយ ៖ ប្រតិបត្តិការនៅរស់ក្នុងទំព័រនេះ ➜ ជុំមិនប៉ះ (រង់ចាំវាបញ្ចប់ខ្លួនឯង) · ពេលវាបញ្ចប់ ➜ journal ទទេ', async () => {
        seedItem('it4', ['A2250031'], []);
        loadViewsFromServer();
        lab.hang = HISTORY;
        void toggleCloseStatus('it4');
        await sleep(40);
        lab.writes = [];
        await doors();
        expect(lab.writes.filter((p) => p.indexOf(PICKUP) === 0), 'ប្រតិបត្តិការរស់ ➜ គ្មានការសរសេរស្ថិតិ').toEqual([]);
        expect(recorded()).toBe(1);
    });

    it('ទិសផ្ទុយ ៖ ប្រតិបត្តិការធម្មតា (គ្មានការរំខាន) ➜ journal ទទេក្រោយបញ្ចប់ · Reset ចំនួនយករួច មិនកើតឡើងវិញ', async () => {
        seedItem('it5', ['A2250041', 'A2250042'], []);
        loadViewsFromServer();
        await toggleCloseStatus('it5');
        await sleep(40);
        expect(recorded()).toBe(2);
        expect(journal(), 'បញ្ចប់ធម្មតា ➜ journal ទទេ').toEqual([]);
        setPath(PICKUP + '/' + DAY, { packagesPickedUp: 0 });
        newPage();
        await doors();
        expect(recorded(), 'Reset ➜ នៅ ០ (barcode បិទ ២ មិនត្រូវរាប់ឡើងវិញ)').toBe(0);
    });

    it('ទិសផ្ទុយ ៖ entry ហាងផ្សេង ឬទិដ្ឋភាពមិនទាន់ស្រស់ ➜ មិនសរសេរ · entry នៅរក្សា', async () => {
        seedItem('it6', ['A2250051'], []);
        loadViewsFromServer();
        lab.hang = HISTORY;
        void toggleCloseStatus('it6');
        await sleep(40);
        newPage();
        dbListenerPendingPaths.add('history');
        lab.writes = [];
        await doors();
        expect(lab.writes.filter((p) => p.indexOf(PICKUP) === 0), 'ទិដ្ឋភាពមិនស្រស់ ➜ មិនសរសេរ').toEqual([]);
        expect(journal().length).toBe(1);
        dbListenerPendingPaths.clear();
        appLocalStore.setItem('zoew_firebase_config', JSON.stringify({ apiKey: 'k', databaseURL: 'https://other-shop-default-rtdb.firebaseio.com', projectId: 'q' }));
        await doors();
        expect(lab.writes.filter((p) => p.indexOf(PICKUP) === 0), 'ហាងផ្សេង ➜ មិនសរសេរ').toEqual([]);
        expect(journal().length).toBe(1);
        appLocalStore.setItem('zoew_firebase_config', SHOP_CONFIG);
        await doors();
        expect(recorded()).toBe(closedOnServer());
        expect(journal()).toEqual([]);
    });

    it('ទិសផ្ទុយ ៖ tab ផ្សេងនៃទូរស័ព្ទដដែលនៅកាន់ប្រតិបត្តិការ (Web Lock) ➜ tab នេះមិនបញ្ចប់វាជំនួស · lock រលត់ ➜ បញ្ចប់', async () => {
        const held = new Set<string>();
        const fakeLocks = {
            request: (name: string, opts: any, cb?: any) => {
                const fn = typeof opts === 'function' ? opts : cb;
                if (opts && opts.ifAvailable && held.has(name)) return Promise.resolve(fn(null));
                held.add(name);
                return Promise.resolve(fn({ name })).finally(() => held.delete(name));
            }
        };
        Object.defineProperty(navigator, 'locks', { configurable: true, value: fakeLocks });
        try {
            seedItem('it7', ['A2250061'], []);
            loadViewsFromServer();
            lab.hang = HISTORY;
            void toggleCloseStatus('it7');
            await sleep(40);
            const id = journal()[0] && journal()[0].id;
            expect(held.has('zoew-cleanup-live-' + id), 'tab ដើមកាន់ lock').toBe(true);
            (pickup as any).pickupIntentsLive.clear();
            cleanup.cleanupJournalLive.clear();
            lab.hang = '';
            loadViewsFromServer();
            lab.writes = [];
            await doors();
            expect(lab.writes.filter((p) => p.indexOf(PICKUP) === 0), 'tab ផ្សេងកាន់ lock ➜ មិនសរសេរ').toEqual([]);
            expect(journal().length).toBe(1);
            held.clear();
            await doors();
            expect(recorded()).toBe(closedOnServer());
            expect(journal()).toEqual([]);
        } finally {
            delete (navigator as any).locks;
        }
    });
});
