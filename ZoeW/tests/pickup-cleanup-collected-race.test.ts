import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dataState, firebaseState, uiState } from '../src/core/state';
import { getServerNow } from '../src/core/clock';
import { appLocalStore } from '../src/core/storage';
import { dbListenerFailedPaths, dbListenerPendingPaths } from '../src/core/text';
import { cleanupInFlight, claimAndCleanupItem } from '../src/domain/cleanup';
import { pickupBarcodeKey } from '../src/domain/pickup';
import { applyBarcodeCloseChange } from '../src/features/barcode-ops';
import { toggleCloseStatus } from '../src/features/entry-ops';
import { resetZtoTrashMode } from '../src/services/zto-trash-mode';

const H = 'zoew_scan_history_cod_dod', T = 'zoew_recently_deleted_cod_dod', C = 'zoew_daily_collected_cod_dod';
const DAY = '2026-10-20';
const db = { name: 'collected-race' };
let store: Record<string, any>, held: { path: string; release: Promise<void> } | null, onHeld: (() => void) | null;
let lost: { path: string; landed: boolean } | null = null;
let afterUpdate: (() => void) | null = null;
const clone = <V>(value: V): V => value === undefined ? value : JSON.parse(JSON.stringify(value));
const at = (path: string) => clone(path.split('/').filter(Boolean).reduce((v: any, k) => v?.[k], store) ?? null);
function put(path: string, value: any) {
    const keys = path.split('/').filter(Boolean); let node = store;
    for (const key of keys.slice(0, -1)) node = node[key] ||= {};
    if (value == null) delete node[keys.at(-1)!]; else node[keys.at(-1)!] = clone(value);
}
const snap = (value: any) => ({ val: () => clone(value), exists: () => value != null });
const ref = (_db: any, path = '') => ({ db: _db, path, key: path.split('/').at(-1), toString: () => `https://race.firebaseio.com/${path}` });
function fb() {
    return {
        ref, increment: (n: number) => ({ inc: n }),
        get: async (r: any) => snap(at(r.path)),
        runTransaction: async (r: any, update: any) => {
            const next = update(at(r.path));
            if (next === undefined) return { committed: false, snapshot: snap(at(r.path)) };
            if (lost && lost.path === r.path) {
                const landed = lost.landed; lost = null;
                if (landed) put(r.path, next);
                throw Object.assign(new Error('disconnect'), { txOutcome: 'unknown', txServerUnread: false });
            }
            put(r.path, next);
            if (held && held.path === r.path) { const wait = held.release; held = null; onHeld?.(); await wait; }
            return { committed: true, snapshot: snap(at(r.path)) };
        },
        update: async (r: any, patch: any) => {
            for (const [key, value] of Object.entries(patch)) {
                const path = [r.path, key].filter(Boolean).join('/');
                put(path, value && typeof value === 'object' && 'inc' in (value as any) ? Number(at(path) || 0) + Number((value as any).inc) : value);
            }
            if (afterUpdate && r.path === C) { const run = afterUpdate; afterUpdate = null; run(); }
        },
        set: async (r: any, value: any) => { put(r.path, value); },
        onValue: () => () => {}, off: () => {}
    };
}
function barcode(code: string, cod: number) {
    const createdAt = getServerNow() - 60 * 60 * 1000;
    return { code, cod, dod: 0, time: `08:00:00 (${DAY})`, locker: 'A1', createdAt, isClosed: false, isFromDeletion: false, isDeducted: false };
}
function install(codes: string[]) {
    const createdAt = getServerNow() - 60 * 60 * 1000;
    const item = { id: 'item1', phone: '012000111', scanDate: DAY, time: `08:00:00 (${DAY})`, createdAt, count: codes.length,
        cod: codes.length * 5, dod: 0, price: codes.length * 5, isClosed: false, isCalled: false, barcode: codes[0], barcodes: codes.map((c) => barcode(c, 5)) };
    store = { [H]: { item1: item }, [T]: {}, [C]: {} };
    firebaseState.db = db as any; firebaseState.fb = fb() as any;
    firebaseState.firebaseConfig = { databaseURL: 'https://race.firebaseio.com' } as any;
    firebaseState.auth = { currentUser: { uid: 'u1', getIdToken: async () => 'tok' } } as any;
    firebaseState.isDatabaseInitialized = true; firebaseState.isDatabaseConnected = true; firebaseState.serverClockTrusted = true;
    firebaseState.hasEverConnectedToDatabase = true;
    firebaseState.dbRefHistory = ref(db, H) as any; firebaseState.dbRefDeleted = ref(db, T) as any;
    firebaseState.dbRefDailyRevenue = ref(db, 'zoew_daily_revenue_cod_dod') as any; firebaseState.dbRefMonthlyRevenue = ref(db, 'zoew_monthly_revenue_cod_dod') as any;
    firebaseState.dbRefDailyPickup = ref(db, 'zoew_daily_pickup_cod_dod') as any; firebaseState.dbRefDailyCollected = ref(db, C) as any;
    dataState.scanHistory = [clone(item)]; dataState.deletedItems = [];
    dataState.dailyRevenueData = {}; dataState.monthlyRevenueData = {}; dataState.dailyPickupData = {}; dataState.dailyCollectedData = {};
    appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify({ enabled: true, fastMode: true, url: window.location.origin + '/.netlify/functions/zto-order-detail?barcode={barcode}' }));
}
function collectedDaysOf(code: string) {
    const key = pickupBarcodeKey(code);
    return Object.keys(store[C] || {}).filter((day) => store[C][day] && store[C][day][key]);
}
function signLocally(codes: string[]) {
    const signedAt = getServerNow() - 1000;
    const item = store[H].item1;
    item.barcodes.forEach((b: any) => { if (codes.includes(b.code)) { b.ztoSignedAt = signedAt; b.ztoSignedExact = true; } });
    dataState.scanHistory = [clone(item)];
}
async function settle() { for (let i = 0; i < 30; i++) await new Promise((r) => setTimeout(r, 0)); }

beforeEach(() => {
    appLocalStore.clear(); uiState.toasts = []; firebaseState.authGeneration++; firebaseState.dbListenerGeneration++;
    cleanupInFlight.clear(); dbListenerPendingPaths.clear(); dbListenerFailedPaths.clear();
    held = null; onHeld = null; lost = null; afterUpdate = null;
    vi.stubGlobal('confirm', () => true); vi.stubGlobal('alert', vi.fn());
    (window as any).ZoeErrors = { capture: vi.fn() };
    resetZtoTrashMode();
});
afterEach(() => { vi.unstubAllGlobals(); resetZtoTrashMode(); appLocalStore.clear(); });

describe('Cookie immediate pickup cleanup never outruns the close that writes the collected record', () => {
    it('a barcode closed on a slow ack, signed and swept meanwhile, still gets its daily-collected record and then leaves as pickup', async () => {
        install(['X1', 'Y1']);
        let ack!: () => void;
        held = { path: `${H}/item1`, release: new Promise<void>((resolve) => { ack = resolve; }) };
        let closing = false; onHeld = () => { closing = true; };
        const close = applyBarcodeCloseChange('item1', 'X1', true, { silent: true, showModal: false });
        await vi.waitFor(() => expect(closing).toBe(true));
        signLocally(['X1']);
        await claimAndCleanupItem('item1', 'close');
        ack();
        expect(await close).toBe(true);
        await settle();
        expect(collectedDaysOf('X1'), 'the close wrote the collected record for X1').toHaveLength(1);
        await claimAndCleanupItem('item1', 'close');
        await settle();
        expect(at(`${H}/item1`).barcodes.map((b: any) => b.code)).toEqual(['Y1']);
        const trash = Object.values(store[T] || {}) as any[];
        expect(trash.flatMap((t) => (t.barcodes || []).map((b: any) => b.code))).toEqual(['X1']);
        expect(trash[0].trashReason).toBe('pickup');
        expect(collectedDaysOf('X1'), 'pickup cleanup keeps the collected record').toHaveLength(1);
    });

    it.each([['pickup', 1], ['remove', 0]])('another device moved the barcode to %s trash before the ack ➜ the record follows that trash copy (%i)', async (reason, expected) => {
        install(['X4', 'Y4']);
        let ack!: () => void;
        held = { path: `${H}/item1`, release: new Promise<void>((resolve) => { ack = resolve; }) };
        let closing = false; onHeld = () => { closing = true; };
        const close = applyBarcodeCloseChange('item1', 'X4', true, { silent: true, showModal: false });
        await vi.waitFor(() => expect(closing).toBe(true));
        const item = store[H].item1;
        const moved = item.barcodes.find((b: any) => b.code === 'X4');
        item.barcodes = item.barcodes.filter((b: any) => b.code !== 'X4'); item.count = 1; item.cod = 5; item.price = 5; item.barcode = 'Y4';
        const copy = { ...clone(item), id: 'id_1760000000000_other', barcodes: [{ ...moved, ztoSignedAt: getServerNow() - 500 }], isFromDeletion: reason === 'pickup',
            trashReason: reason, deletedAt: getServerNow(), trashMode: 'cookie', restoreBlocked: true };
        store[T][copy.id] = clone(copy); dataState.deletedItems = [clone(copy)];
        ack();
        await close; await settle();
        expect(collectedDaysOf('X4')).toHaveLength(expected);
    });

    it('control: without a sweep during the ack the close writes the record (the harness can measure it)', async () => {
        install(['X3', 'Y3']);
        expect(await applyBarcodeCloseChange('item1', 'X3', true, { silent: true, showModal: false })).toBe(true);
        await settle();
        expect(collectedDaysOf('X3')).toHaveLength(1);
        expect(collectedDaysOf('Y3')).toHaveLength(0);
    });

    it('closing the whole parcel on a slow ack keeps the collected records of every barcode', async () => {
        install(['X2', 'Y2']);
        let ack!: () => void;
        held = { path: `${H}/item1`, release: new Promise<void>((resolve) => { ack = resolve; }) };
        let closing = false; onHeld = () => { closing = true; };
        const close = toggleCloseStatus('item1');
        await vi.waitFor(() => expect(closing).toBe(true));
        signLocally(['X2']);
        await claimAndCleanupItem('item1', 'close');
        ack();
        await close;
        await settle();
        expect(collectedDaysOf('X2')).toHaveLength(1);
        expect(collectedDaysOf('Y2')).toHaveLength(1);
    });
});

describe('a close whose reply was lost (outcome unknown) reconciles the collected mirror from the server', () => {
    it.each([[true, 1], [false, 0]])('one barcode · landed on the server %s ➜ %i record', async (landed, expected) => {
        install(['X5', 'Y5']);
        lost = { path: `${H}/item1`, landed };
        expect(await applyBarcodeCloseChange('item1', 'X5', true, { silent: true, showModal: false })).toBe(false);
        await settle();
        expect(!!at(`${H}/item1`).barcodes.find((b: any) => b.code === 'X5').isClosed).toBe(landed);
        expect(collectedDaysOf('X5')).toHaveLength(expected);
        expect(collectedDaysOf('Y5')).toHaveLength(0);
    });

    it.each([[true, 1], [false, 0]])('whole row · landed on the server %s ➜ %i record per barcode', async (landed, expected) => {
        install(['X6', 'Y6']);
        lost = { path: `${H}/item1`, landed };
        await toggleCloseStatus('item1');
        await settle();
        expect(collectedDaysOf('X6')).toHaveLength(expected);
        expect(collectedDaysOf('Y6')).toHaveLength(expected);
    });
});

describe('the verification read after the collected write follows a barcode another device moved to pickup trash', () => {
    it('no false «not synced» warning and the record stays', async () => {
        install(['X7', 'Y7']);
        afterUpdate = () => {
            const item = store[H].item1;
            const moved = item.barcodes.find((b: any) => b.code === 'X7');
            item.barcodes = item.barcodes.filter((b: any) => b.code !== 'X7'); item.count = 1; item.barcode = 'Y7';
            const copy = { ...clone(item), id: 'id_1760000000000_late', barcodes: [{ ...moved, ztoSignedAt: getServerNow() - 500 }], isFromDeletion: true,
                trashReason: 'pickup', deletedAt: getServerNow(), trashMode: 'cookie', restoreBlocked: true };
            store[T][copy.id] = clone(copy); dataState.deletedItems = [clone(copy)];
        };
        expect(await applyBarcodeCloseChange('item1', 'X7', true, { silent: false, showModal: false })).toBe(true);
        await settle();
        expect(collectedDaysOf('X7')).toHaveLength(1);
        const messages = (uiState.toasts || []).map((t: any) => String(t.msg || ''));
        expect(messages.join(' ')).not.toContain('មិនទាន់ Sync');
        expect(messages.join(' ')).toContain('✅');
    });
});
