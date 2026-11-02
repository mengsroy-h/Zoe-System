import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { dataState, firebaseState, uiState } from '../src/core/state';
import { appLocalStore } from '../src/core/storage';
import * as storage from '../src/core/storage';
import { dbListenerFailedPaths, dbListenerPendingPaths } from '../src/core/text';
import { resetPickupStats } from '../src/domain/collected';
import { pickupResetBoundReceipt } from '../src/domain/pickup-reset-proof';
import { pickupResetPendingState, resumePickupResetOutcomes, runPickupResetBatch } from '../src/services/pickup-reset';

const DAY = '2026-10-30', SCOPE = 'https://f09-client.invalid';
const PREFIX = 'zoew_pickup_reset_pending_v2:';
const clone = <T,>(value: T): T => value === undefined ? value : structuredClone(value);
const record = (count = 1, revision = 3, epoch = 1) => ({ pickupRevision: revision, pickupResetEpoch: epoch, packagesPickedUp: count,
    ...(count ? { pickedUpBarcodes: { RESET_A: '000000001' }, pickedUpPhones: { '000000001': 1 } } : {}) });
let server: Record<string, any>, sends: any[], legacyCalls: number, mode: string;
let beforeRead: null | ((day: string) => void), stopDay: string | null;
const journals = () => Object.keys(appLocalStore).filter(key => key.startsWith(PREFIX)).map(key => ({ key, raw: appLocalStore.getItem(key)!, value: JSON.parse(appLocalStore.getItem(key)!) }));
const retained = () => clone({ daily: dataState.dailyRevenueData, monthly: dataState.monthlyRevenueData,
    collected: dataState.dailyCollectedData, history: dataState.scanHistory, trash: dataState.deletedItems });

beforeEach(() => {
    appLocalStore.clear(); appLocalStore.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: SCOPE }));
    vi.stubGlobal('crypto', webcrypto);
    vi.stubGlobal('navigator', { locks: { request: async (_name: string, _options: any, run: (lock: object) => any) => run({}) } });
    vi.stubGlobal('confirm', () => true);
    server = { [DAY]: record() }; sends = []; legacyCalls = 0; mode = 'normal'; beforeRead = null; stopDay = null;
    firebaseState.authGeneration++; firebaseState.auth = { currentUser: { uid: 'reset-client-owner' } } as any;
    firebaseState.db = { app: { options: { databaseURL: SCOPE, projectId: 'f09-client-project' } } } as any;
    firebaseState.isInitializingFirebase = false; firebaseState.isDatabaseInitialized = true; firebaseState.isDatabaseConnected = true;
    firebaseState.dbListenersFailed = false; firebaseState.dbRefDailyPickup = { path: 'zoew_daily_pickup_cod_dod' } as any;
    firebaseState.fb = {
        ref: (_db: any, path: string) => ({ path }),
        get: async (ref: any) => { const day = ref.path.split('/').at(-1); beforeRead?.(day); return { val: () => clone(server[day]) }; },
        runTransaction: async (ref: any, updater: any) => {
            legacyCalls++; const day = ref.path.split('/').at(-1); const next = updater(clone(server[day]));
            if (next !== undefined) server[day] = clone(next);
            return { committed: next !== undefined, snapshot: { val: () => clone(server[day]) } };
        },
        executePickupReset: async (ref: any, request: any, current = () => true) => {
            const day = ref.path.split('/').at(-1);
            const journal = journals().find(entry => entry.value.id === request.context.batchId);
            sends.push({ day, request: clone(request), journal: clone(journal?.value), current });
            if (!current()) return { committed: false, snapshot: { val: () => clone(server[day]) } };
            if (mode === 'unknown' && (!stopDay || stopDay === day)) throw Object.assign(new Error('lost ACK'), { txOutcome: 'unknown' });
            if (mode === 'reject') throw Object.assign(new Error('permission_denied'), { txOutcome: 'not-applied' });
            if (mode === 'conflict-once' && sends.length === 1) server[day] = record(2, 8, 4);
            const cas = JSON.parse(request.casText);
            if (JSON.stringify(server[day] ?? null) !== JSON.stringify(cas.x)) return { committed: false, snapshot: { val: () => clone(server[day]) } };
            const receipt = await pickupResetBoundReceipt(request.tenant, request.actorUid, request.context, request.attemptId, request.casText, 'native-day');
            server[day] = { ...cas.v, pickupResetApplied: receipt };
            if (mode === 'applied-unknown' && (!stopDay || stopDay === day)) throw Object.assign(new Error('lost ACK'), { txOutcome: 'unknown' });
            if (mode === 'bad-receipt') return { committed: true, pickupReset: { ...receipt, actorUid: 'foreign-actor' }, snapshot: { val: () => clone(server[day]) } };
            return { committed: true, pickupReset: receipt, snapshot: { val: () => clone(server[day]) } };
        },
        pickupResetStatus: vi.fn(async (ref: any) => ({ outcome: 'applied', pickupReset: clone(server[ref.path.split('/').at(-1)]?.pickupResetApplied) }))
    } as any;
    dbListenerFailedPaths.clear(); dbListenerPendingPaths.clear();
    dataState.dailyPickupData = clone(server); dataState.pickupResetInFlight = false;
    dataState.dailyRevenueData = { [DAY]: { codDollar: 37, dodDollar: 5, totalCount: 11 } };
    dataState.monthlyRevenueData = { '2026-10': { codDollar: 37, dodDollar: 5, totalCount: 11 } };
    dataState.dailyCollectedData = { [DAY]: { codDollar: 7, dodDollar: 2 } };
    dataState.scanHistory = [{ id: 'retained-item', isClosed: true, barcodes: [{ code: 'RESET_A', isClosed: true, cod: 7 }] }];
    dataState.deletedItems = []; uiState.currentFilterMode = 'all'; uiState.toasts = [];
});

it('All 32 dates including zero records preserve order, original commitment and money/history', async () => {
    const days = Array.from({ length: 32 }, (_, index) => new Date(Date.UTC(2026, 9, index + 1)).toISOString().slice(0, 10));
    server = Object.fromEntries(days.map((day, index) => [day, record(index === 31 ? 1 : 0)])); dataState.dailyPickupData = clone(server);
    const money = retained(); await resetPickupStats();
    expect(sends.map(sent => sent.day)).toEqual(days); expect(new Set(sends.map(sent => sent.request.context.batchId)).size).toBe(1);
    expect(journals()[0].value.dates).toEqual(days); expect(journals()[0].value.complete).toBe(true);
    expect(journals()[0].value.days).toHaveLength(32); expect(retained()).toEqual(money); expect(legacyCalls).toBe(0);
});

it('pickup after confirmation is included in the latest fresh CAS basis', async () => {
    beforeRead = day => { server[day] = record(2, 8, 4); };
    await resetPickupStats();
    expect(sends).toHaveLength(1); expect(JSON.parse(sends[0].request.casText).x.pickupRevision).toBe(8);
    expect(server[DAY]).toMatchObject({ pickupRevision: 9, pickupResetEpoch: 5, packagesPickedUp: 0 });
});

it('definitive CAS false alone permits a new durably bound attempt on the latest basis', async () => {
    mode = 'conflict-once'; await resetPickupStats();
    expect(sends).toHaveLength(2); expect(sends[0].request.attemptId).not.toBe(sends[1].request.attemptId);
    expect(sends[0].request.context.batchId).toBe(sends[1].request.context.batchId);
    expect(journals()[0].value.days[0].attempts.map((attempt: any) => attempt.outcome)).toEqual(['not-applied', 'applied']);
    expect(sends[1].journal.days[0].attempts[0].outcome).toBe('not-applied');
    expect(server[DAY]).toMatchObject({ pickupRevision: 9, pickupResetEpoch: 5, packagesPickedUp: 0 });
});

it.each(['unknown', 'applied-unknown'])('UNKNOWN (%s) never rebases/retries or sends untouched tail', async kind => {
    const days = [DAY, '2026-10-31', '2026-11-01']; server = Object.fromEntries(days.map(day => [day, record()])); dataState.dailyPickupData = clone(server);
    mode = kind; stopDay = days[1]; const money = retained(); await resetPickupStats();
    expect(sends.map(sent => sent.day)).toEqual(days.slice(0, 2)); expect(server[days[2]]).toEqual(record());
    const value = journals()[0].value; expect(value.days[1].attempts[0].outcome).toBe('pending'); expect(value.days[2].attempts).toEqual([]);
    expect(value.settled).toBe(false); expect(value.owner.ended).toBe(true); expect(retained()).toEqual(money);
    await resetPickupStats(); expect(sends).toHaveLength(2); expect(legacyCalls).toBe(0);
});

it('read-only APPLIED recovery annotates original partial outcome without a tail or snapshot overwrite', async () => {
    const days = [DAY, '2026-10-31', '2026-11-01']; server = Object.fromEntries(days.map(day => [day, record()])); dataState.dailyPickupData = clone(server);
    mode = 'applied-unknown'; stopDay = days[1]; await resetPickupStats();
    const original = journals()[0], descriptor = clone(original.value.days[1].attempts[0]);
    server[days[1]] = { ...record(2, 5, 2), pickupResetApplied: clone(server[days[1]].pickupResetApplied) };
    dataState.dailyPickupData = clone(server); const currentView = clone(dataState.dailyPickupData), money = retained();
    const result = await resumePickupResetOutcomes();
    expect(result).toEqual({ checked: 1, resolved: 1, held: false }); expect(sends).toHaveLength(2);
    expect(firebaseState.fb.pickupResetStatus).toHaveBeenCalledTimes(1);
    expect(firebaseState.fb.pickupResetStatus.mock.calls[0][1]).toEqual(sends[1].request);
    const recovered = journals()[0]; expect(recovered.key).toBe(original.key); expect(recovered.value.id).toBe(original.value.id);
    expect(recovered.value.days[1].attempts[0]).toMatchObject({ ...descriptor, outcome: 'applied' });
    expect(recovered.value.days[2].attempts).toEqual([]); expect(recovered.value.complete).toBe(false); expect(recovered.value.settled).toBe(true);
    expect(dataState.dailyPickupData).toEqual(currentView); expect(retained()).toEqual(money); expect(server[days[2]]).toEqual(record());
    expect(pickupResetPendingState(SCOPE, 'reset-client-owner')).toBe('');
});

it.each(['missing', 'foreign', 'malformed', 'error', 'replaced', 'wrong-kind', 'unknown-envelope'])('status %s cannot resolve original UNKNOWN or authorize replay', async kind => {
    mode = 'unknown'; await resetPickupStats(); const original = journals()[0].value.days[0].attempts[0];
    firebaseState.fb.pickupResetStatus = vi.fn(async () => {
        if (kind === 'error') throw new Error('read denied');
        const proof = await pickupResetBoundReceipt(original.tenant, original.actorUid, original.context, original.attemptId, original.casText, 'native-day');
        if (kind === 'missing') return { outcome: 'unknown', pickupReset: null };
        if (kind === 'unknown-envelope') return { outcome: 'unknown', pickupReset: proof };
        return { outcome: 'applied', pickupReset: kind === 'foreign' ? { ...proof, actorUid: 'other' }
            : kind === 'replaced' ? { ...proof, attemptId: 'a'.repeat(64), intentHash: 'a'.repeat(64) }
                : kind === 'wrong-kind' ? { ...proof, proof: 'operation' } : { v: 1, outcome: 'applied' } };
    });
    const result = await resumePickupResetOutcomes(); expect(result.held).toBe(true); expect(result.resolved).toBe(0);
    expect(journals()[0].value.days[0].attempts[0]).toEqual(original); expect(journals()[0].value.settled).toBe(false);
    await resetPickupStats(); expect(sends).toHaveLength(1);
});

it('explicit APPLIED reply with mismatched receipt is UNKNOWN, never local completion', async () => {
    mode = 'bad-receipt'; const view = clone(dataState.dailyPickupData); await resetPickupStats();
    expect(sends).toHaveLength(1); expect(journals()[0].value.settled).toBe(false);
    expect(dataState.dailyPickupData).toEqual(view); expect(uiState.toasts.some(toast => toast.msg.includes('⏳'))).toBe(true);
});

it.each(['executePickupReset', 'pickupResetStatus'])('missing %s fails closed without legacy fallback', async method => {
    delete firebaseState.fb[method]; await resetPickupStats(); expect(sends).toEqual([]); expect(legacyCalls).toBe(0);
    expect(server[DAY]).toEqual(record()); expect(journals()).toEqual([]);
});

it('native tenant comes only from live app options, never a guessed stored config id', async () => {
    appLocalStore.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: SCOPE, projectId: 'forged-project' }));
    delete firebaseState.db.app.options.projectId; await resetPickupStats(); expect(sends).toEqual([]); expect(legacyCalls).toBe(0);
});

it.each(['db-app', 'auth-app-only'])('Supabase authority uses current tenantScope and operation receipt (options=%s)', async optionsOwner => {
    const tenant = '00000000-0000-4000-8000-000000000001', url = 'https://f09-sb.invalid';
    appLocalStore.setItem('zoew_firebase_config', JSON.stringify({ supabaseUrl: url }));
    const app = { options: { supabaseUrl: url } };
    firebaseState.db = optionsOwner === 'db-app' ? { app } : { _sb: true } as any; firebaseState.auth.app = app;
    if (optionsOwner === 'auth-app-only') expect(firebaseState.db.app).toBeUndefined();
    firebaseState.fb.tenantScope = () => tenant;
    firebaseState.fb.executePickupReset = async (_ref: any, request: any, current: () => boolean) => {
        sends.push({ request: clone(request) }); expect(current()).toBe(true);
        const proof = await pickupResetBoundReceipt(tenant, request.actorUid, request.context, request.attemptId, request.casText, 'operation');
        return { committed: true, pickupReset: proof };
    };
    await resetPickupStats(); expect(sends).toHaveLength(1); expect(sends[0].request.tenant).toBe(tenant);
    expect(journals()[0].value.days[0].attempts[0].receipt.proof).toBe('operation'); expect(journals()[0].value.complete).toBe(true);
});

it.each(['url', 'tenant', 'auth-object', 'db-object'])('Supabase auth-app fallback keeps %s ownership across hash await', async change => {
    const url = 'https://f09-sb.invalid', app = { options: { supabaseUrl: 'https://f09-sb.invalid' } };
    let tenant = '00000000-0000-4000-8000-000000000001';
    appLocalStore.setItem('zoew_firebase_config', JSON.stringify({ supabaseUrl: url }));
    firebaseState.db = { _sb: true } as any; firebaseState.auth.app = app; firebaseState.fb.tenantScope = () => tenant;
    const digest = webcrypto.subtle.digest.bind(webcrypto.subtle); let mutated = false;
    vi.spyOn(webcrypto.subtle, 'digest').mockImplementation((...args: Parameters<typeof digest>) => {
        if (!mutated) {
            mutated = true;
            if (change === 'url') app.options.supabaseUrl = 'https://changed-sb.invalid';
            else if (change === 'tenant') tenant = '00000000-0000-4000-8000-000000000002';
            else if (change === 'auth-object') firebaseState.auth = { ...firebaseState.auth, currentUser: firebaseState.auth.currentUser };
            else firebaseState.db = { _sb: true } as any;
        }
        return digest(...args);
    });
    await resetPickupStats(); expect(mutated).toBe(true); expect(sends).toEqual([]); expect(journals()).toEqual([]); expect(legacyCalls).toBe(0);
});

it.each(['batch', 'attempt'])('durable %s storage failure refuses before execute', async stage => {
    const original = storage.safeStoreSet; let denials = 0;
    vi.spyOn(storage, 'safeStoreSet').mockImplementation((store, key, value) => {
        if (key.startsWith(PREFIX) && (stage === 'batch' || JSON.parse(String(value)).days.some((day: any) => day.attempts.length))) { denials++; return false; }
        return original(store, key, value);
    });
    await resetPickupStats(); expect(denials).toBeGreaterThan(0); expect(sends).toEqual([]); expect(legacyCalls).toBe(0); expect(server[DAY]).toEqual(record());
});

it('failed durable APPLIED annotation retains original pending evidence for status recovery', async () => {
    const original = storage.safeStoreSet; let denials = 0;
    const denied = vi.spyOn(storage, 'safeStoreSet').mockImplementation((store, key, value) => {
        if (key.startsWith(PREFIX) && JSON.parse(String(value)).days.some((day: any) => day.attempts.some((attempt: any) => attempt.outcome === 'applied'))) { denials++; return false; }
        return original(store, key, value);
    });
    await resetPickupStats(); expect(denials).toBeGreaterThan(0); expect(sends).toHaveLength(1); const pending = journals()[0];
    expect(pending.value.days[0].attempts[0].outcome).toBe('pending'); expect(pending.value.settled).toBe(false);
    denied.mockRestore(); const result = await resumePickupResetOutcomes();
    expect(result.resolved).toBe(1); expect(journals()[0].key).toBe(pending.key); expect(journals()[0].value.complete).toBe(true); expect(sends).toHaveLength(1);
});

it('no WebLock keeps normal live Reset compatibility but read-only recovery stays HOLD', async () => {
    vi.stubGlobal('navigator', {}); mode = 'applied-unknown'; await resetPickupStats();
    expect(sends).toHaveLength(1); expect(journals()[0].value.owner).toMatchObject({ locked: false, ended: true });
    expect(await resumePickupResetOutcomes()).toEqual({ checked: 0, resolved: 0, held: true }); expect(firebaseState.fb.pickupResetStatus).not.toHaveBeenCalled();
    vi.stubGlobal('navigator', { locks: { request: async (_name: string, _options: any, run: (lock: object) => any) => run({}) } });
    expect((await resumePickupResetOutcomes()).resolved).toBe(1); expect(sends).toHaveLength(1);
});

it.each(['unavailable', 'denied'])('WebLock %s never enters live effects', async kind => {
    vi.stubGlobal('navigator', { locks: { request: async (_name: string, _options: any, run: (lock: null) => any) => {
        if (kind === 'denied') throw new Error('lock denied'); return run(null);
    } } });
    await resetPickupStats(); expect(sends).toEqual([]); expect(journals()).toEqual([]); expect(legacyCalls).toBe(0);
    expect(uiState.toasts.some(toast => toast.msg.includes('មិនអាចពិនិត្យ'))).toBe(true);
    expect(uiState.toasts.some(toast => toast.msg.includes('ភស្តុតាងការងារត្រូវបានរក្សាទុក'))).toBe(false);
});

it('hash preparation failure refuses without claiming a nonexistent durable journal', async () => {
    vi.spyOn(webcrypto.subtle, 'digest').mockRejectedValue(new Error('crypto unavailable'));
    await resetPickupStats(); expect(sends).toEqual([]); expect(journals()).toEqual([]); expect(legacyCalls).toBe(0);
    expect(uiState.toasts.some(toast => toast.msg.includes('មិនអាចពិនិត្យ'))).toBe(true);
    expect(uiState.toasts.some(toast => toast.msg.includes('ភស្តុតាងការងារត្រូវបានរក្សាទុក'))).toBe(false);
});

it('legacy v1 marker remains HOLD without inferred modern proof or backend call', async () => {
    appLocalStore.setItem('zoew_pickup_reset_pending_v1:' + encodeURIComponent(SCOPE) + ':reset-client-owner:old', JSON.stringify({ id: 'old', dates: [DAY] }));
    await resetPickupStats(); expect((await resumePickupResetOutcomes()).held).toBe(true);
    expect(sends).toEqual([]); expect(firebaseState.fb.pickupResetStatus).not.toHaveBeenCalled(); expect(legacyCalls).toBe(0);
});

it.each(['session', 'journal'])('async hash rechecks %s ownership before any physical execute', async kind => {
    const digest = webcrypto.subtle.digest.bind(webcrypto.subtle); let count = 0;
    vi.spyOn(webcrypto.subtle, 'digest').mockImplementation((...args: Parameters<typeof digest>) => {
        count++;
        if (count === 2) {
            if (kind === 'session') firebaseState.authGeneration++;
            else { const entry = journals()[0]; entry.value.owner.token = 'replacement-owner'; appLocalStore.setItem(entry.key, JSON.stringify(entry.value)); }
        }
        return digest(...args);
    });
    await resetPickupStats(); expect(sends).toEqual([]); expect(legacyCalls).toBe(0); expect(server[DAY]).toEqual(record());
    if (kind === 'journal') expect(journals()[0].value.owner.token).toBe('replacement-owner');
});

it('read-only recovery refuses a crashed unlocked owner with no durable ended fence', async () => {
    mode = 'unknown'; await resetPickupStats(); const entry = journals()[0]; entry.value.owner = { ...entry.value.owner, locked: false, ended: false };
    appLocalStore.setItem(entry.key, JSON.stringify(entry.value));
    expect((await resumePickupResetOutcomes()).held).toBe(true); expect(firebaseState.fb.pickupResetStatus).not.toHaveBeenCalled(); expect(sends).toHaveLength(1);
});

it('backend current callback fences a physical effect after the journal owner is replaced', async () => {
    firebaseState.fb.executePickupReset = async (_ref: any, request: any, current: () => boolean) => {
        sends.push({ request: clone(request) }); const entry = journals()[0]; entry.value.owner.token = 'other-page'; appLocalStore.setItem(entry.key, JSON.stringify(entry.value));
        expect(current()).toBe(false); return { committed: false, snapshot: { val: () => clone(server[DAY]) } };
    };
    await resetPickupStats(); expect(sends).toHaveLength(1); expect(server[DAY]).toEqual(record()); expect(journals()[0].value.owner.token).toBe('other-page');
    expect(journals()[0].value.days[0].attempts[0].outcome).toBe('pending');
});

it('concurrent service admission does not share or replace an unfinished original batch', async () => {
    mode = 'unknown'; const results = await Promise.all([runPickupResetBatch([DAY]), runPickupResetBatch([DAY])]);
    expect(sends).toHaveLength(1); expect(journals()).toHaveLength(1); expect(results.every(result => result.status === 'hold')).toBe(true);
});

it('recovery after module restart performs only original status reads and keeps current pickup view', async () => {
    mode = 'applied-unknown'; await resetPickupStats();
    const original = clone(journals()[0]);
    vi.resetModules(); const freshState = await import('../src/core/state'); const recovery = await import('../src/services/pickup-reset');
    for (const key of ['authGeneration', 'auth', 'db', 'fb', 'isInitializingFirebase']) (freshState.firebaseState as any)[key] = (firebaseState as any)[key];
    freshState.dataState.dailyPickupData = { [DAY]: record(2, 5, 2) }; const current = clone(freshState.dataState.dailyPickupData);
    expect((await recovery.resumePickupResetOutcomes()).resolved).toBe(1); expect(sends).toHaveLength(1);
    expect(journals()[0].key).toBe(original.key); expect(journals()[0].value.days[0].attempts[0].attemptId).toBe(original.value.days[0].attempts[0].attemptId);
    expect(freshState.dataState.dailyPickupData).toEqual(current); expect(journals()[0].value.complete).toBe(true);
});

it.each(['session', 'journal'])('status await rechecks %s ownership before annotating original evidence', async kind => {
    mode = 'applied-unknown'; await resetPickupStats();
    const pending = journals()[0].value.days[0].attempts[0];
    firebaseState.fb.pickupResetStatus = vi.fn(async () => {
        if (kind === 'session') firebaseState.authGeneration++;
        else { const entry = journals()[0]; entry.value.owner.token = 'new-status-owner'; appLocalStore.setItem(entry.key, JSON.stringify(entry.value)); }
        return { outcome: 'applied', pickupReset: clone(server[DAY].pickupResetApplied) };
    });
    expect((await resumePickupResetOutcomes()).held).toBe(true); expect(journals()[0].value.days[0].attempts[0]).toEqual(pending); expect(sends).toHaveLength(1);
    if (kind === 'journal') expect(journals()[0].value.owner.token).toBe('new-status-owner');
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); appLocalStore.clear(); dataState.pickupResetInFlight = false; });

it('F09 original batch and immutable physical CAS attempt are durable before public execute', async () => {
    const money = retained(); await resetPickupStats();
    expect(sends).toHaveLength(1);
    expect(legacyCalls).toBe(0);
    const sent = sends[0];
    expect(sent.request).toEqual({ tenant: 'f09-client-project', actorUid: 'reset-client-owner', context: expect.objectContaining({ day: DAY, batchId: sent.journal.id }),
        attemptId: expect.stringMatching(/^[a-f0-9]{64}$/), casText: expect.any(String) });
    expect(sent.journal.v).toBe(2); expect(sent.journal.dates).toEqual([DAY]);
    expect(sent.journal.days[0].attempts[0]).toMatchObject({ ...sent.request, outcome: 'pending' });
    expect(server[DAY]).toMatchObject({ packagesPickedUp: 0, pickupRevision: 4, pickupResetEpoch: 2 });
    expect(journals()[0].value.complete).toBe(true); expect(retained()).toEqual(money);
});
