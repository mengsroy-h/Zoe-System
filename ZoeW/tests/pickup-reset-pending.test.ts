import { createHash } from 'node:crypto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { dataState, firebaseState, uiState } from '../src/core/state';
import { appLocalStore } from '../src/core/storage';
import * as storage from '../src/core/storage';
import { dbListenerFailedPaths, dbListenerPendingPaths } from '../src/core/text';
import { resetPickupStats } from '../src/domain/collected';
import { pickupResetAppliedReceipt } from '../src/domain/pickup-reset-proof';

const DAY = '2026-10-30', PREFIX = 'zoew_pickup_reset_pending_v2:';
const clone = (value: any) => value == null ? value : structuredClone(value);
let server: any, calls: number, mode: string, retry: boolean, replies: (() => void)[], unknownOwners: Set<string>;
const markers = () => Object.keys(appLocalStore).filter(key => key.startsWith(PREFIX) && !JSON.parse(appLocalStore.getItem(key)!).settled);
const flush = async () => { for (let index = 0; index < 100; index++) await Promise.resolve(); };
beforeEach(() => {
    vi.useFakeTimers(); vi.setSystemTime(Date.UTC(2026, 9, 30, 9)); appLocalStore.clear();
    appLocalStore.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: 'https://reset-pending.invalid' }));
    server = { pickupRevision: 3, pickupResetEpoch: 1, packagesPickedUp: 1, pickedUpBarcodes: { RESET_A: '000000001' }, pickedUpPhones: { '000000001': 1 } };
    calls = 0; mode = 'normal'; retry = false; replies = []; unknownOwners = new Set();
    vi.stubGlobal('crypto', { subtle: { digest: async (_algorithm: string, bytes: Uint8Array) => new Uint8Array(createHash('sha256').update(bytes).digest()).buffer } });
    vi.stubGlobal('navigator', { locks: { request: async (_name: string, _options: any, action: (lock: object) => any) => action({}) } });
    firebaseState.authGeneration++; firebaseState.auth = { currentUser: { uid: 'reset-owner' } } as any;
    firebaseState.db = { app: { options: { databaseURL: 'https://reset-pending.invalid', projectId: 'reset-pending-project' } } } as any;
    firebaseState.isInitializingFirebase = false; firebaseState.isDatabaseInitialized = true; firebaseState.isDatabaseConnected = true;
    firebaseState.dbListenersFailed = false; firebaseState.dbRefDailyPickup = { path: 'zoew_daily_pickup_cod_dod' } as any;
    firebaseState.fb = {
        ref: (_db: any, path: string) => ({ path }),
        get: async () => ({ val: () => clone(server) }),
        pickupResetStatus: async () => ({ outcome: 'unknown', pickupReset: null }),
        executePickupReset: (_ref: any, request: any, current: () => boolean) => {
            calls++;
            if (mode === 'reject') return Promise.reject(Object.assign(new Error('permission_denied'), { txOutcome: 'not-applied' }));
            if (mode === 'unknown' || unknownOwners.has(request.context.scope + '|' + request.actorUid)) return Promise.reject(Object.assign(new Error('disconnect'), { txOutcome: 'unknown' }));
            if (retry) { current(); current(); }
            const cas = JSON.parse(request.casText), receipt = pickupResetAppliedReceipt(request.tenant, request.actorUid, request.context, request.attemptId, request.casText, 'native-day');
            const commit = () => {
                const accepted = current() && JSON.stringify(server ?? null) === JSON.stringify(cas.x);
                if (accepted) server = { ...cas.v, pickupResetApplied: receipt };
                const saved = clone(server); return { committed: accepted, ...(accepted ? { pickupReset: receipt } : {}), snapshot: { val: () => clone(saved) } };
            };
            if (mode === 'hold-before') return new Promise(resolve => replies.push(() => resolve(commit())));
            const result = commit();
            if (mode === 'lost-ack') return new Promise(resolve => replies.push(() => resolve(result)));
            return Promise.resolve(result);
        }
    } as any;
    dbListenerFailedPaths.clear(); dbListenerPendingPaths.clear(); dataState.dailyPickupData = { [DAY]: clone(server) };
    dataState.dailyRevenueData = { [DAY]: { codDollar: 12, dodDollar: 3, totalCount: 2 } };
    dataState.scanHistory = []; dataState.deletedItems = []; dataState.pickupResetInFlight = false; uiState.currentFilterMode = 'all'; uiState.toasts = [];
    vi.stubGlobal('confirm', () => true);
});
afterEach(async () => { replies.splice(0).forEach(resolve => resolve()); await flush(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); appLocalStore.clear(); });

it.each([false, true])('ACK ធម្មតាដោះ marker របស់ខ្លួន និងមិនប៉ះប្រាក់ (ownership callback repeat=%s)', async (profile) => {
    retry = profile; const money = clone(dataState.dailyRevenueData); await resetPickupStats();
    expect(server.packagesPickedUp).toBe(0); expect(server.pickupResetEpoch).toBe(2); expect(markers()).toEqual([]);
    expect(dataState.dailyRevenueData).toEqual(money); expect(uiState.toasts.some(toast => toast.msg.includes('✅'))).toBe(true);
});
it.each([false, true])('commit មុន ACK timeout រក្សា HOLD ទប់ retry និងមិនជាន់ newer pickup view (ownership callback repeat=%s)', async (profile) => {
    retry = profile; mode = 'lost-ack'; const running = resetPickupStats(); await flush(); await vi.advanceTimersByTimeAsync(15001); await running;
    expect(server.pickupResetEpoch).toBe(2); expect(server.packagesPickedUp).toBe(0);
    expect.soft(markers()).toHaveLength(1); expect.soft(uiState.toasts.map(toast => toast.msg).join(' ')).not.toContain('Reset មិនបានទេ');
    expect.soft(uiState.toasts.some(toast => toast.msg.includes('⏳'))).toBe(true);
    mode = 'normal'; await resetPickupStats(); expect.soft(calls).toBe(1);
    server = { ...server, pickupRevision: server.pickupRevision + 1, packagesPickedUp: 1, pickedUpBarcodes: { NEW_AFTER_RESET: '000000002' }, pickedUpPhones: { '000000002': 1 } };
    dataState.dailyPickupData = { [DAY]: clone(server) }; const newer = clone(dataState.dailyPickupData);
    replies.shift()!(); await flush(); expect(markers()).toEqual([]); expect(dataState.dailyPickupData).toEqual(newer);
});
it('storage write denial មុន effects មិនផ្ញើ Reset', async () => {
    const original = storage.safeStoreSet;
    vi.spyOn(storage, 'safeStoreSet').mockImplementation((store, key, value) => key.startsWith(PREFIX) ? false : original(store, key, value));
    await resetPickupStats(); expect(calls).toBe(0); expect(server.packagesPickedUp).toBe(1); expect(markers()).toEqual([]);
});
it('definitive rejection ដោះតែ marker របស់ operation នោះ និងអាចស្នើ Reset ថ្មី', async () => {
    mode = 'reject'; await resetPickupStats(); expect(markers()).toEqual([]); expect(server.packagesPickedUp).toBe(1);
    mode = 'normal'; await resetPickupStats(); expect(calls).toBe(2); expect(server.packagesPickedUp).toBe(0);
});
it('unknown rejection នៅ HOLD ទោះ live promise បាន reject រួច', async () => {
    mode = 'unknown'; await resetPickupStats(); expect.soft(markers()).toHaveLength(1);
    await resetPickupStats(); expect.soft(calls).toBe(1);
});
it.each(['https://RESET-PENDING.invalid/', 'https://reset-pending.invalid////'])('ហាងដដែលប្តូរតែទម្រង់ URL នៅតែរារាំង Reset ថ្មី (%s)', async (databaseURL) => {
    mode = 'unknown'; await resetPickupStats(); expect(markers()).toHaveLength(1);
    appLocalStore.setItem('zoew_firebase_config', JSON.stringify({ databaseURL }));
    mode = 'normal'; await resetPickupStats(); expect(calls).toBe(1); expect(markers()).toHaveLength(1);
});
it('storage settlement denial មិនលុប HOLD ឬអះអាងបញ្ចប់ journal', async () => {
    const original = storage.safeStoreSet;
    vi.spyOn(storage, 'safeStoreSet').mockImplementation((store, key, value) => key.startsWith(PREFIX) && JSON.parse(String(value)).settled ? false : original(store, key, value));
    await resetPickupStats(); expect(server.packagesPickedUp).toBe(0); expect(markers()).toHaveLength(1);
    expect(uiState.toasts.some(toast => toast.msg.includes('⏳'))).toBe(true);
    dataState.dailyPickupData[DAY].packagesPickedUp = 1; await resetPickupStats(); expect(calls).toBe(1);
});
it('partial batch ACK timeout មិនបន្តថ្ងៃដែលមិនទាន់ផ្ញើពេល ACK មកយឺត', async () => {
    const days = [DAY, '2026-10-31', '2026-11-01']; const records = Object.fromEntries(days.map(day => [day, clone(server)]));
    dataState.dailyPickupData = clone(records);
    firebaseState.fb.get = async (ref: any) => ({ val: () => clone(records[ref.path.split('/').at(-1)]) });
    firebaseState.fb.executePickupReset = ((ref: any, request: any, current: () => boolean) => {
        calls++; const day = ref.path.split('/').at(-1), cas = JSON.parse(request.casText);
        const proof = pickupResetAppliedReceipt(request.tenant, request.actorUid, request.context, request.attemptId, request.casText, 'native-day');
        const accepted = current() && JSON.stringify(records[day]) === JSON.stringify(cas.x);
        if (accepted) records[day] = { ...cas.v, pickupResetApplied: proof };
        const saved = clone(records[day]);
        const result = { committed: accepted, ...(accepted ? { pickupReset: proof } : {}), snapshot: { val: () => clone(saved) } };
        return day === days[1] ? new Promise(resolve => replies.push(() => resolve(result))) : Promise.resolve(result);
    }) as any;
    const running = resetPickupStats(); await flush(); await vi.advanceTimersByTimeAsync(15001); await running;
    expect(calls).toBe(2); expect(records[days[2]].packagesPickedUp).toBe(1); expect(markers()).toHaveLength(1);
    replies.shift()!(); await flush(); expect(calls).toBe(2); expect(records[days[2]].packagesPickedUp).toBe(1); expect(markers()).toEqual([]);
});
it('ACK ចាស់មិនដោះ marker/busy ឬទិដ្ឋភាពរបស់ actor ថ្មី', async () => {
    mode = 'lost-ack'; const old = resetPickupStats(); await flush(); await vi.advanceTimersByTimeAsync(15001); await old; const oldReply = replies.shift()!;
    firebaseState.authGeneration++; firebaseState.auth = { currentUser: { uid: 'new-reset-owner' } } as any;
    server = { ...server, pickupRevision: server.pickupRevision + 1, packagesPickedUp: 1, pickedUpBarcodes: { NEW_A: '000000002' }, pickedUpPhones: { '000000002': 1 } };
    dataState.dailyPickupData = { [DAY]: clone(server) }; const newer = clone(dataState.dailyPickupData);
    mode = 'hold-before'; const current = resetPickupStats(); await flush(); const currentMarkers = markers().filter(key => key.includes('new-reset-owner'));
    expect(currentMarkers).toHaveLength(1); oldReply(); await flush();
    expect(dataState.pickupResetInFlight).toBe(true); expect(dataState.dailyPickupData).toEqual(newer);
    expect(markers()).toEqual(currentMarkers); replies.shift()!(); await current; expect(markers()).toEqual([]);
});
it('restart ដែលបាត់ live promise មិនបង្កើត Reset ថ្មីលើ unknown marker', async () => {
    mode = 'lost-ack'; const running = resetPickupStats(); await flush(); await vi.advanceTimersByTimeAsync(15001); await running;
    expect(markers()).toHaveLength(1);
    vi.resetModules(); const freshState = await import('../src/core/state'); const fresh = await import('../src/domain/collected');
    for (const key of ['authGeneration', 'auth', 'db', 'fb', 'dbRefDailyPickup', 'isInitializingFirebase', 'isDatabaseInitialized', 'isDatabaseConnected', 'dbListenersFailed']) (freshState.firebaseState as any)[key] = (firebaseState as any)[key];
    freshState.dataState.dailyPickupData = { [DAY]: { ...clone(server), packagesPickedUp: 1 } }; freshState.uiState.currentFilterMode = 'all'; freshState.uiState.toasts = [];
    await fresh.resetPickupStats(); expect(calls).toBe(1); expect(markers()).toHaveLength(1);
    expect(freshState.uiState.toasts.some(toast => toast.msg.includes('⏳'))).toBe(true);
});
it.each([
    { name: 'same scope/uid', otherScope: false, otherUid: false, blocked: true },
    { name: 'different scope', otherScope: true, otherUid: false, blocked: false },
    { name: 'different uid', otherScope: false, otherUid: true, blocked: false }
])('confirmation window ពិនិត្យ marker មុន effects (%s)', async ({ otherScope, otherUid, blocked }) => {
    vi.resetModules(); const peerState = await import('../src/core/state'); const peer = await import('../src/domain/collected');
    for (const key of ['authGeneration', 'auth', 'db', 'fb', 'dbRefDailyPickup', 'isInitializingFirebase', 'isDatabaseInitialized', 'isDatabaseConnected', 'dbListenersFailed']) (peerState.firebaseState as any)[key] = (firebaseState as any)[key];
    const peerUrl = otherScope ? 'https://other-reset.invalid' : 'https://reset-pending.invalid';
    peerState.firebaseState.db = { app: { options: { databaseURL: peerUrl, projectId: otherScope ? 'other-reset-project' : 'reset-pending-project' } } } as any;
    peerState.firebaseState.auth = { currentUser: { uid: otherUid ? 'other-confirm-owner' : 'reset-owner' } } as any;
    peerState.dataState.dailyPickupData = { [DAY]: clone(server) }; peerState.uiState.currentFilterMode = 'all';
    const storedConfig = appLocalStore.getItem('zoew_firebase_config'); let peerRun: Promise<void> | undefined, nested = false;
    vi.stubGlobal('confirm', () => {
        if (!nested) {
            nested = true; appLocalStore.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: peerUrl }));
            unknownOwners.add(peerUrl + '|' + peerState.firebaseState.auth.currentUser.uid); peerRun = peer.resetPickupStats();
            appLocalStore.setItem('zoew_firebase_config', storedConfig!);
        }
        return true;
    });
    await resetPickupStats(); await peerRun; expect(markers()).toHaveLength(1);
    expect(calls).toBe(blocked ? 1 : 2); expect(server.packagesPickedUp).toBe(blocked ? 1 : 0); expect(markers()).toHaveLength(1);
});
it.each([false, true])('pending copy បែងចែក persisted evidence ពី unreadable storage (enumeration denied=%s)', async (denied) => {
    if (denied) vi.spyOn(appLocalStore, 'key').mockImplementation(() => { throw new DOMException('enumeration denied', 'SecurityError'); });
    mode = 'unknown'; await resetPickupStats(); const messages = uiState.toasts.map(toast => toast.msg).join(' ');
    if (denied) {
        expect(calls).toBe(0); expect(markers()).toEqual([]);
        expect.soft(messages).not.toContain('ភស្តុតាងការងារត្រូវបានរក្សាទុក'); expect.soft(messages).toContain('មិនអាចពិនិត្យ');
    } else {
        expect(calls).toBe(1); expect(markers()).toHaveLength(1); expect(messages).toContain('ភស្តុតាងការងារត្រូវបានរក្សាទុក');
    }
});
