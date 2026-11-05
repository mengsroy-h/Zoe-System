import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { createSupabaseDatabase, SbNetworkError, SbRpcError, SB_OP_REPLAY_SAFE_MS } from '../src/services/supabase-rtdb';
import { createLocalWriteJournal, WRITE_JOURNAL_PREFIX } from '../src/services/write-journal';
import { saveExchangeRate } from '../src/features/exchange-rate';
import { refTo } from '../src/app/refs';
import { discardPendingWrites } from '../src/features/pending-writes';
import { connectionFlowSnapshot } from '../src/services/connection-flow';
import { DB_LIVENESS_PROBE_TIMEOUT_MS } from '../src/services/connection';
import { DB_OP_TIMEOUT_MS } from '../src/services/network';
import { firebaseState, uiState, dataState } from '../src/core/state';
const START = Date.UTC(2026, 9, 30, 9), SCOPE = 'synthetic-project|synthetic-user', TOPIC = 'zoe:synthetic-shop';
const turn = async () => {
    for (let i = 0; i < 160; i++)
        await Promise.resolve();
};
let holdNextClock: boolean, clockEntered: boolean, releaseClock: () => void, clockGate: Promise<void>;
let separateUnsentGate: boolean, releaseUnsent: () => void, unsentGate: Promise<void>;
let holdUnsentResponse: boolean;
let holdLostResponse: boolean;
let applyLostFirst: boolean;
let denyAfterSentStamp: boolean;
let failSentStamp: boolean, sentStampFailures: number, rejectFirst: boolean;
let pausePull: boolean, releasePull: () => void, pullGate: Promise<void>;
let deniedOpId: string | null;
let holdResponse: boolean, releaseResponse: () => void, responseGate: Promise<void>, rejectUncertain: boolean, serverNow: number, loseFirst: boolean, denyRemove: boolean, writes: any[], server: any, receipts: Map<string, any>, databases: any[], denyPut: boolean, pauseClaims: boolean, releaseClaims: () => void, claimGate: Promise<void>;
const journal = createLocalWriteJournal();
function open() {
    const db: any = createSupabaseDatabase({ subscribe: () => () => { }, ping: async () => true, rpc: async (fn: string, args: any) => {
            if (fn === 'zoe_now') {
                if (holdNextClock) { holdNextClock = false; clockEntered = true; await clockGate; }
                return serverNow;
            }
            if (fn === 'zoe_read')
                return { docs: [], now: serverNow };
            if (fn === 'zoe_pull' && pausePull)
                await pullGate;
            if (fn === 'zoe_write_v2') { expect.soft(args.p_expected_tenant).toBe(TOPIC.slice(4));
                writes.push(JSON.parse(JSON.stringify(args)));
                if (holdUnsentResponse) { await (separateUnsentGate ? unsentGate : responseGate); throw new SbNetworkError('synthetic unauthenticated before POST', true); }
                if (loseFirst) {
                    loseFirst = false;
                    if (applyLostFirst)
                        for (const op of args.p_ops)
                            server[op.p.join('/')] = op.v;
                    if (holdLostResponse)
                        await responseGate;
                    throw new SbNetworkError('synthetic lost response');
                }
                if (rejectFirst) {
                    rejectFirst = false;
                    throw new SbRpcError('synthetic definite rejection', '42501', 403, '');
                }
                if (rejectUncertain && writes.length === 2)
                    throw new SbRpcError('synthetic rejection after uncertain send', '42501', 403, '');
                if (receipts.has(args.p_op_id))
                    return { ...receipts.get(args.p_op_id), replayed: true };
                for (const op of args.p_ops)
                    server[op.p.join('/')] = op.v;
                const answer = { ok: true, docs: [], now: serverNow, seq: writes.length + 1 };
                receipts.set(args.p_op_id, answer);
                if (holdResponse)
                    await responseGate;
                return answer;
            }
            return { seq: 1, more: false, reset: true, tenant: 'synthetic-shop', head: 1, now: serverNow, rows: [] };
        } }, { onListenerError: () => { }, onSynced: () => { }, onForbidden: () => { }, onTxOutcomeUnknown: () => { }, onWriteRecovery: () => { } }, { writeJournal: journal, pollFallbackMs: 10 ** 9, retryStepsMs: [1], rpcTimeoutMs: 100 });
    db.setTenantTopic(TOPIC);
    db.setAuthed(true, SCOPE);
    databases.push(db);
    return db;
}
function attach(db: any) { firebaseState.authGeneration++; firebaseState.auth = { currentUser: { uid: 'synthetic-user' } } as any; firebaseState.db = db; firebaseState.fb = { __supabase: true, discardPendingWrites: (d: any) => d.discardPendingWrites(), retryWriteRecovery: (d: any) => d.retryWriteRecovery(), set: (r: any, v: any) => r._db.set(r, v) } as any; firebaseState.isInitializingFirebase = false; firebaseState.firebaseSdkUnavailable = false; firebaseState.sessionExpiryCheck = 'live'; firebaseState.authLoginOperation = null; firebaseState.isDatabaseInitialized = true; firebaseState.isDatabaseConnected = true; firebaseState.dbListenersFailed = false; }
beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(START);
    localStorage.clear();
    serverNow = START;
    holdNextClock = false; clockEntered = false; clockGate = new Promise(r => { releaseClock = r; });
    loseFirst = true;
    applyLostFirst = false;
    holdLostResponse = false; holdUnsentResponse = false; separateUnsentGate = false; unsentGate = new Promise(r => { releaseUnsent = r; });
    rejectUncertain = true;
    holdResponse = false;
    responseGate = new Promise(r => { releaseResponse = r; });
    denyRemove = false;
    writes = [];
    server = {};
    receipts = new Map();
    databases = [];
    denyPut = false;
    denyAfterSentStamp = false;
    failSentStamp = false;
    sentStampFailures = 0;
    rejectFirst = false;
    pausePull = false;
    pullGate = new Promise(r => { releasePull = r; });
    deniedOpId = null;
    pauseClaims = false;
    claimGate = new Promise(r => { releaseClaims = r; });
    uiState.toasts = [];
    dataState.exchangeRateSaveInFlight = false;
    dataState.exchangeRateRiel = 4000;
    dataState.scanHistory = [];
    dataState.deletedItems = [];
    vi.stubGlobal('confirm', () => true);
    const held = new Set<string>();
    vi.stubGlobal('navigator', { onLine: true, locks: { request: async (name: string, options: any, callback?: any) => {
                if (typeof options === 'function') {
                    callback = options;
                    options = {};
                }
                if (options.ifAvailable && pauseClaims)
                    await claimGate;
                if (held.has(name))
                    return callback(null);
                held.add(name);
                try {
                    return await callback({ name });
                }
                finally {
                    held.delete(name);
                }
            } } });
    const set = localStorage.setItem.bind(localStorage);
    vi.spyOn(localStorage, 'setItem').mockImplementation((key: string, value: string) => {
        if (failSentStamp && key.startsWith(WRITE_JOURNAL_PREFIX) && JSON.parse(value).stage === 'sent') {
            sentStampFailures++;
            if (denyAfterSentStamp)
                denyPut = true;
            throw new DOMException('synthetic sent stamp denied', 'QuotaExceededError');
        }
        if (denyPut && key.startsWith(WRITE_JOURNAL_PREFIX) && (!deniedOpId || key.endsWith(deniedOpId)))
            throw new DOMException('synthetic persistence denied', 'QuotaExceededError');
        set(key, value);
    });
    const real = localStorage.removeItem.bind(localStorage);
    vi.spyOn(localStorage, 'removeItem').mockImplementation((key: string) => {
        if (denyRemove && key.startsWith(WRITE_JOURNAL_PREFIX) && (!deniedOpId || key.endsWith(deniedOpId)))
            throw new DOMException('synthetic removal denied', 'SecurityError');
        real(key);
    });
});
afterEach(() => {
    for (const d of databases)
        d.close('synthetic done');
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.clearAllTimers();
    vi.useRealTimers();
    localStorage.clear();
});
async function blocked(failure: boolean, bothDenied = false) {
    const db = open();
    await turn();
    expect(db.isReady()).toBe(true);
    attach(db);
    firebaseState.dbRefExchangeRate = db.ref('zoew_settings/exchange_rate');
    const oldInput = document.createElement('input');
    oldInput.type = 'number';
    oldInput.value = '4200';
    refTo('exchangeRateInput')(oldInput);
    // ការសរសេរ unknown បើក automatic recovery; មិនហៅ retry API ដោយដៃទេ។
    pauseClaims = true;
    const prior = saveExchangeRate();
    await turn();
    await vi.advanceTimersByTimeAsync(10);
    await turn();
    expect(await prior).toBe('pending');
    expect(db.isReady()).toBe(true);
    expect(db.recoveryState().recovering).toBe(true);
    expect(connectionFlowSnapshot().canWrite).toBe(true);
    denyRemove = failure;
    const input = document.createElement('input');
    input.type = 'number';
    input.value = '4300';
    refTo('exchangeRateInput')(input);
    const currentFeature = saveExchangeRate();
    await turn();
    expect(journal.list(SCOPE, TOPIC).some((r: any) => r.ops.some((op: any) => op.v === 4300))).toBe(true);
    denyPut = bothDenied;
    pauseClaims = false;
    releaseClaims();
    await turn();
    expect(await currentFeature).toBe(bothDenied ? 'pending' : 'failed');
    expect(db.recoveryState().blocked).toBeGreaterThan(0);
    expect(journal.list(SCOPE, TOPIC).some((r: any) => r.stage === 'unresolved')).toBe(true);
    expect(connectionFlowSnapshot().phase).toBe('blocked');
    uiState.toasts = [];
    return db;
}
for (const failure of [false, true])
    it(failure ? 'លុប storage បរាជ័យ តែ durable cancellation ទប់ public discard និង restart replay' : 'លុប storage ជោគជ័យ រក្សា foreign scope និងមិន replay', async () => {
        const db = await blocked(failure);
        const rowsBefore = journal.list(SCOPE, TOPIC);
        expect(rowsBefore.length).toBe(failure ? 2 : 1);
        const foreign = { ...rowsBefore[0], scope: 'other-project|other-user', topic: 'zoe:other-shop', opId: 'foreign_owned_1234567890123' };
        expect(journal.put(foreign)).toBe(true);
        const sentBefore = writes.length;
        expect(await discardPendingWrites()).toBe(true);
        await turn();
        expect(journal.list(foreign.scope, foreign.topic)).toHaveLength(1);
        expect(writes.slice(sentBefore), 'ការសរសេរដែលបដិសេធ និង discard មិនត្រូវផ្ញើ').toEqual([]);
        expect(server).toEqual({});
        expect(db.recoveryState()).toMatchObject({ blocked: 0, pending: 0 });
        const retained = journal.list(SCOPE, TOPIC).length;
        for (let retry = 0; retry < 3; retry++)
            await db.retryWriteRecovery();
        expect(journal.list(SCOPE, TOPIC)).toHaveLength(retained);
        expect((await db.discardPendingWrites()).count, 'cancellation ដដែលមិនរាប់ម្ដងទៀត').toBe(0);
        db.close('synthetic restart');
        denyRemove = false;
        const restartAt = writes.length;
        const next = open();
        await turn();
        expect(writes.slice(restartAt), 'restart មិន replay cancelled intent').toEqual([]);
        expect(journal.list(SCOPE, TOPIC)).toEqual([]);
        expect(next.recoveryState().blocked).toBe(0);
        expect(uiState.toasts.some((t: any) => String(t.msg).startsWith('✅ បានលុបការសរសេររង់ចាំ'))).toBe(true);
    });
it('remove និង put បរាជ័យ រក្សា HOLD និងរាយ discard មិនបាន ដោយមិន replay ក្រោយ restart', async () => {
    const db = await blocked(true, true);
    const before = journal.list(SCOPE, TOPIC);
    expect(before).toHaveLength(2);
    const sentBefore = writes.length;
    const discarding = discardPendingWrites();
    await turn();
    await vi.advanceTimersByTimeAsync(DB_LIVENESS_PROBE_TIMEOUT_MS + 1);
    expect(await discarding).toBe(false);
    await turn();
    expect(journal.list(SCOPE, TOPIC).map((r: any) => r.opId)).toEqual(before.map((r: any) => r.opId));
    expect(db.recoveryState().blocked).toBeGreaterThan(0);
    expect(writes.slice(sentBefore)).toEqual([]);
    expect(uiState.toasts.some((t: any) => String(t.msg).startsWith('✅'))).toBe(false);
    db.close('restart after cancellation could not persist');
    denyPut = false;
    denyRemove = false;
    const at = writes.length;
    const next = open();
    await turn();
    expect(writes.slice(at), 'durable admission fence preserves failed enqueue through restart').toEqual([]);
    expect(next.recoveryState().blocked).toBeGreaterThan(0);
    expect(journal.list(SCOPE, TOPIC)).toHaveLength(2);
});
it('journal put បរាជ័យមុន enqueue បដិសេធមុនផ្ញើ', async () => {
    loseFirst = false;
    const db = open();
    await turn();
    denyPut = true;
    const result = await db.set(db.ref('zoew_settings/exchange_rate'), 4300).catch((e: any) => e);
    expect(result).toMatchObject({ code: 'WRITE_JOURNAL_UNAVAILABLE', txOutcome: 'not-applied' });
    expect(writes).toEqual([]);
    expect(journal.list(SCOPE, TOPIC)).toEqual([]);
});
it('queued intent ដែលបាន admit រួចនៅតែ recover ដោយ opId ដើមក្រោយ restart', async () => {
    loseFirst = false;
    const db = open();
    await turn();
    db.goOffline();
    const pending = db.set(db.ref('zoew_settings/exchange_rate'), 4300).catch(() => undefined);
    await turn();
    const [row] = journal.list(SCOPE, TOPIC);
    expect(row.stage).toBe('queued');
    expect(writes).toEqual([]);
    db.close('restart of admitted offline intent');
    await pending;
    expect(writes, 'closed owner មិនផ្ញើ admitted intent ក្រោយ close').toEqual([]);
    const next = open();
    await turn();
    expect(writes.map(w => w.p_op_id)).toEqual([row.opId]);
    expect(server['zoew_settings/exchange_rate']).toBe(4300);
    expect(journal.list(SCOPE, TOPIC)).toEqual([]);
    expect(next.recoveryState().blocked).toBe(0);
});
it('admission put បរាជ័យ រួច remove បាន មិនទុក queued write សម្រាប់ restart', async () => {
    loseFirst = false;
    const db = open();
    await turn();
    const pending = db.set(db.ref('zoew_settings/exchange_rate'), 4300).catch((e: any) => e);
    denyPut = true;
    expect(await pending).toMatchObject({ code: 'WRITE_JOURNAL_UNAVAILABLE', txOutcome: 'not-applied' });
    expect(writes).toEqual([]);
    expect(journal.list(SCOPE, TOPIC)).toEqual([]);
    db.close('restart');
    denyPut = false;
    open();
    await turn();
    expect(writes).toEqual([]);
});
it('public discard ទុក live setting ដែលកាន់ Web Lock រហូត late ACK មកដល់ ហើយមិនបង្កើត opId ថ្មី', async () => {
    loseFirst = false;
    rejectUncertain = false;
    const owner = open();
    await turn();
    holdResponse = true;
    const pending = owner.set(owner.ref('zoew_settings/exchange_rate'), 4300);
    await turn();
    const [live] = journal.list(SCOPE, TOPIC);
    expect(live.stage).toBe('sent');
    expect(server['zoew_settings/exchange_rate']).toBe(4300);
    expect(journal.put({ ...live, stage: 'unresolved', opId: 'closed_owner_12345678901234', ops: [{ k: 'set', p: ['zoew_settings', 'exchange_rate'], v: 4100 }] })).toBe(true);
    const other = open();
    await turn();
    attach(other);
    expect(connectionFlowSnapshot().phase).toBe('blocked');
    expect(await discardPendingWrites()).toBe(true);
    expect(journal.list(SCOPE, TOPIC).map((r: any) => r.opId)).toEqual([live.opId]);
    expect(writes.map(w => w.p_op_id)).toEqual([live.opId]);
    holdResponse = false;
    releaseResponse();
    await pending;
    await turn();
    expect(journal.list(SCOPE, TOPIC)).toEqual([]);
    expect(writes.map(w => w.p_op_id)).toEqual([live.opId]);
});
it.each(['queued', 'cancelled'])('legacy %s intent៖ unsent recover ដោយ ID ដើម · uncertain នៅ HOLD', async (stage) => {
    loseFirst = false;
    rejectUncertain = false;
    const row = { v: 1, scope: SCOPE, topic: TOPIC, stage, uncertain: stage === 'cancelled', opId: 'legacy_intent_12345678901234', sentAfter: stage === 'queued' ? 0 : START - 1000, ops: [{ k: 'set', p: ['zoew_settings', 'exchange_rate'], v: 4200 }] };
    expect(journal.put(row)).toBe(true);
    const db = open();
    await turn();
    if (stage === 'queued') {
        expect(writes.map(w => w.p_op_id)).toEqual([row.opId]);
        expect(server['zoew_settings/exchange_rate']).toBe(4200);
        expect(journal.list(SCOPE, TOPIC)).toEqual([]);
        expect(db.recoveryState()).toMatchObject({ blocked: 0, pending: 0 });
    } else {
        expect(writes).toEqual([]);
        expect(server).toEqual({});
        expect(journal.list(SCOPE, TOPIC)).toEqual([row]);
        expect(db.recoveryState().blocked).toBe(1);
    }
});
it('partial discard រាប់តែ durable cancellation និងរក្សា failed evidence ក្នុង scope ដើម', async () => {
    loseFirst = false;
    rejectUncertain = false;
    const row = { v: 1, writeProtocol: 2, scope: SCOPE, topic: TOPIC, stage: 'unresolved', uncertain: true, opId: 'failed_discard_123456789012', sentAfter: START, ops: [{ k: 'set', p: ['zoew_settings', 'exchange_rate'], v: 4100 }] };
    expect(journal.put(row)).toBe(true);
    expect(journal.put({ ...row, opId: 'success_discard_12345678901' })).toBe(true);
    const db = open();
    await turn();
    expect(db.recoveryState().blocked).toBe(2);
    denyRemove = true;
    denyPut = true;
    deniedOpId = row.opId;
    const result = await db.discardPendingWrites();
    expect(result).toEqual({ count: 1, paths: ['zoew_settings/exchange_rate'], failed: 1 });
    expect(journal.list(SCOPE, TOPIC).map((r: any) => r.opId)).toEqual([row.opId]);
    expect(db.recoveryState().blocked).toBeGreaterThan(0);
    expect(writes).toEqual([]);
});
it('បិទមុន recovery admission រក្សា intent ជា visible HOLD ក្រោយ restart ហើយមិនបោះបង់ស្ងាត់', async () => {
    loseFirst = false;
    rejectUncertain = false;
    pausePull = true;
    const prior = open();
    const outcome = prior.set(prior.ref('zoew_settings/exchange_rate'), 4300).catch((e: any) => e);
    await turn();
    const [row] = journal.list(SCOPE, TOPIC);
    expect(row).toMatchObject({ stage: 'unresolved', awaitingRecovery: true, sentAfter: 0 });
    expect(writes).toEqual([]);
    prior.close('process ends before admission');
    pausePull = false;
    releasePull();
    expect(await outcome).toMatchObject({ code: 'DISCONNECT' });
    const next = open();
    await turn();
    expect(journal.list(SCOPE, TOPIC)).toEqual([row]);
    expect(next.recoveryState().blocked).toBeGreaterThan(0);
    expect(writes).toEqual([]);
    attach(next);
    expect(connectionFlowSnapshot().phase).toBe('blocked');
    expect(await discardPendingWrites()).toBe(true);
    expect(journal.list(SCOPE, TOPIC)).toEqual([]);
    await next.set(next.ref('zoew_settings/exchange_rate'), 4300);
    expect(writes).toHaveLength(1);
    expect(writes[0].p_op_id).not.toBe(row.opId);
});
it('scope ផ្លាស់ពេលរង់ចាំ recovery មិន persist admission ឬ overwrite journal របស់ scope ចាស់', async () => {
    loseFirst = false;
    rejectUncertain = false;
    pausePull = true;
    const db = open();
    const outcome = db.set(db.ref('zoew_settings/exchange_rate'), 4300).catch((e: any) => e);
    await turn();
    const before = journal.list(SCOPE, TOPIC);
    expect(before).toHaveLength(1);
    db.setAuthed(true, 'synthetic-project|other-user');
    pausePull = false;
    releasePull();
    await turn();
    expect(await outcome).toMatchObject({ code: 'PERMISSION_DENIED' });
    expect(journal.list(SCOPE, TOPIC)).toEqual(before);
    expect(journal.list('synthetic-project|other-user', TOPIC)).toEqual([]);
    expect(writes).toEqual([]);
});
it('sent-stamp put បរាជ័យមុន transport និង remove បរាជ័យ រក្សា durable cancellation មិន replay', async () => {
    loseFirst = false;
    rejectUncertain = false;
    const db = open();
    await turn();
    denyRemove = true;
    failSentStamp = true;
    const result = await db.set(db.ref('zoew_settings/exchange_rate'), 4300).catch((e: any) => e);
    expect(result).toMatchObject({ code: 'WRITE_JOURNAL_UNAVAILABLE', txOutcome: 'not-applied' });
    expect(sentStampFailures).toBe(1);
    expect(writes).toEqual([]);
    db.close('restart');
    denyRemove = false;
    const next = open();
    await turn();
    expect(writes).toEqual([]);
    expect(journal.list(SCOPE, TOPIC)).toEqual([]);
    expect(next.recoveryState().blocked).toBe(0);
});
it('definitive non-uncertain rejection និង remove បរាជ័យ មិនទុក failed setting សម្រាប់ replay', async () => {
    loseFirst = false;
    rejectUncertain = false;
    rejectFirst = true;
    const db = open();
    await turn();
    denyRemove = true;
    const result = await db.set(db.ref('zoew_settings/exchange_rate'), 4300).catch((e: any) => e);
    expect(result).toMatchObject({ code: 'PERMISSION_DENIED' });
    expect(writes).toHaveLength(1);
    expect(server).toEqual({});
    db.close('restart');
    denyRemove = false;
    const next = open();
    await turn();
    expect(writes).toHaveLength(1);
    expect(server).toEqual({});
    expect(journal.list(SCOPE, TOPIC)).toEqual([]);
    expect(next.recoveryState().blocked).toBe(0);
});
it('admission រួច storage បដិសេធ put និង remove ប្រាប់ cancellation unknown និងរក្សា evidence', async () => {
    loseFirst = false;
    rejectUncertain = false;
    const db = open();
    await turn();
    denyRemove = true;
    failSentStamp = true;
    denyAfterSentStamp = true;
    const result = await db.set(db.ref('zoew_settings/exchange_rate'), 4300).catch((e: any) => e);
    expect(result).toMatchObject({ txOutcome: 'unknown', noRetry: true });
    expect(sentStampFailures).toBe(1);
    expect(db.recoveryState().blocked).toBeGreaterThan(0);
    expect(writes).toEqual([]);
    expect(journal.list(SCOPE, TOPIC)).toHaveLength(1);
    const [row] = journal.list(SCOPE, TOPIC);
    expect(row.awaitingRecovery).toBe(false);
    attach(db);
    expect(await discardPendingWrites()).toBe(false);
    expect(journal.list(SCOPE, TOPIC).map((r: any) => r.opId)).toEqual([row.opId]);
    expect(uiState.toasts.some((t: any) => String(t.msg).startsWith('✅'))).toBe(false);
});
it('scope ថ្មី blocked ក៏មិនលុប old-scope HOLD ពេល recovery របស់ operation ចាស់បដិសេធ', async () => {
    loseFirst = false;
    rejectUncertain = false;
    const nextScope = 'synthetic-project|other-user';
    const foreign = { v: 1, writeProtocol: 2, scope: nextScope, topic: TOPIC, stage: 'unresolved', opId: 'other_scope_123456789012345', sentAfter: 0, ops: [{ k: 'set', p: ['zoew_settings', 'exchange_rate'], v: 4100 }] };
    expect(journal.put(foreign)).toBe(true);
    pausePull = true;
    const db = open();
    const outcome = db.set(db.ref('zoew_settings/exchange_rate'), 4300).catch((e: any) => e);
    await turn();
    const before = journal.list(SCOPE, TOPIC);
    expect(before).toHaveLength(1);
    db.setAuthed(true, nextScope);
    pausePull = false;
    releasePull();
    await turn();
    expect(await outcome).toMatchObject({ code: 'PERMISSION_DENIED' });
    expect(journal.list(SCOPE, TOPIC)).toEqual(before);
    expect(journal.list(nextScope, TOPIC)).toEqual([foreign]);
    expect(writes).toEqual([]);
});
it('discard រង់ចាំ claim រួច adapter បិទ មិនលុប journal ក្រោយ close', async () => {
    const db = await blocked(false);
    const before = journal.list(SCOPE, TOPIC);
    expect(before).toHaveLength(1);
    claimGate = new Promise(r => { releaseClaims = r; });
    pauseClaims = true;
    const discarding = db.discardPendingWrites();
    await turn();
    db.close('closed while claim delayed');
    pauseClaims = false;
    releaseClaims();
    const result = await discarding;
    expect(result).toMatchObject({ count: 0, failed: 1 });
    expect(journal.list(SCOPE, TOPIC)).toEqual(before);
    expect(writes).toHaveLength(2);
});
it('C08 UI unknown ដែល server បាន apply រក្សា pending អត្រាថ្មី មិនអះអាងមិនបានរក្សាទុក', async () => {
    applyLostFirst = true;
    const db = open();
    await turn();
    attach(db);
    firebaseState.dbRefExchangeRate = db.ref('zoew_settings/exchange_rate');
    const input = document.createElement('input');
    input.type = 'number';
    input.value = '4300';
    refTo('exchangeRateInput')(input);
    const result = saveExchangeRate();
    await turn();
    await vi.advanceTimersByTimeAsync(10);
    await turn();
    expect(await result).toBe('pending');
    expect(server['zoew_settings/exchange_rate']).toBe(4300);
    expect(dataState.exchangeRateRiel).toBe(4300);
    expect(localStorage.getItem('zoew_exchange_rate')).toBe('4300');
    const messages = uiState.toasts.map((t: any) => String(t.msg)).join(' ');
    expect(messages).not.toContain('មិនបានរក្សាទុក');
    expect(messages).not.toContain('✅');
    expect(messages).toContain('⏳');
    expect(journal.list(SCOPE, TOPIC)).toHaveLength(1);
    expect(new Set(writes.map(w => w.p_op_id)).size).toBe(1);
});
it('C08 UI cancellation persist មិនបានក្រោយ admission ប្រាប់ pending និងរក្សា same intent', async () => {
    loseFirst = false;
    rejectUncertain = false;
    const db = open();
    await turn();
    attach(db);
    firebaseState.dbRefExchangeRate = db.ref('zoew_settings/exchange_rate');
    const input = document.createElement('input');
    input.type = 'number';
    input.value = '4300';
    refTo('exchangeRateInput')(input);
    denyRemove = true;
    failSentStamp = true;
    denyAfterSentStamp = true;
    expect(await saveExchangeRate()).toBe('pending');
    expect(sentStampFailures).toBe(1);
    expect(writes).toEqual([]);
    expect(dataState.exchangeRateRiel).toBe(4300);
    expect(journal.list(SCOPE, TOPIC)).toHaveLength(1);
    expect(db.recoveryState().blocked).toBeGreaterThan(0);
    const messages = uiState.toasts.map((t: any) => String(t.msg)).join(' ');
    expect(messages).not.toContain('មិនបានរក្សាទុក');
    expect(messages).not.toContain('✅');
    expect(messages).toContain('⏳');
});
it('C08 UI definitive rejection នៅតែ rollback អត្រាមុន និងប្រាប់ failed', async () => {
    loseFirst = false;
    rejectUncertain = false;
    rejectFirst = true;
    const db = open();
    await turn();
    attach(db);
    firebaseState.dbRefExchangeRate = db.ref('zoew_settings/exchange_rate');
    const input = document.createElement('input');
    input.type = 'number';
    input.value = '4300';
    refTo('exchangeRateInput')(input);
    expect(await saveExchangeRate()).toBe('failed');
    expect(server).toEqual({});
    expect(dataState.exchangeRateRiel).toBe(4000);
    expect(localStorage.getItem('zoew_exchange_rate')).toBe('4000');
    expect(journal.list(SCOPE, TOPIC)).toEqual([]);
    expect(uiState.toasts.map((t: any) => String(t.msg)).join(' ')).toContain('មិនបានរក្សាទុក');
});
it('C08 UI timeout រួច late unknown មិន rollback ឬអះអាងមិនបានរក្សាទុក', async () => {
    applyLostFirst = true;
    holdLostResponse = true;
    const db = open();
    await turn();
    attach(db);
    firebaseState.dbRefExchangeRate = db.ref('zoew_settings/exchange_rate');
    const input = document.createElement('input');
    input.type = 'number';
    input.value = '4300';
    refTo('exchangeRateInput')(input);
    const result = saveExchangeRate();
    await turn();
    expect(server['zoew_settings/exchange_rate']).toBe(4300);
    await vi.advanceTimersByTimeAsync(DB_OP_TIMEOUT_MS + 1);
    expect(await result).toBe('pending');
    expect(dataState.exchangeRateSaveInFlight).toBe(true);
    releaseResponse();
    await turn();
    await vi.advanceTimersByTimeAsync(10);
    await turn();
    expect(dataState.exchangeRateSaveInFlight).toBe(false);
    expect(dataState.exchangeRateRiel).toBe(4300);
    expect(localStorage.getItem('zoew_exchange_rate')).toBe('4300');
    expect(journal.list(SCOPE, TOPIC)).toHaveLength(1);
    expect(new Set(writes.map(w => w.p_op_id)).size).toBe(1);
    const messages = uiState.toasts.map((t: any) => String(t.msg)).join(' ');
    expect(messages).not.toContain('មិនបានរក្សាទុក');
    expect(messages).not.toContain('✅');
    expect(messages).toContain('មិនទាន់ដឹងលទ្ធផល');
});


it('admitted journal រក្សា original ID ពេល transient auth ផ្អាកមុន POST ហើយ same UID/tenant ត្រឡប់', async()=>{
 loseFirst=false;rejectUncertain=false;const db=open();await turn();holdUnsentResponse=true;
 const outcome=db.set(db.ref('zoew_settings/exchange_rate'),4300).then(()=> 'committed',(e:any)=>e);await turn();
 const [row]=journal.list(SCOPE,TOPIC);expect(row.stage).toBe('sent');expect(writes).toHaveLength(1);expect(server).toEqual({});
 db.setAuthed(false);holdUnsentResponse=false;releaseResponse();await turn();
 expect(journal.list(SCOPE,TOPIC),'transient unauthentication មិនលុប admitted consent').toEqual([expect.objectContaining({opId:row.opId,stage:'queued',awaitingRecovery:false})]);
 db.setAuthed(true,SCOPE);await turn();await vi.advanceTimersByTimeAsync(10);await turn();expect(await outcome).toBe('committed');expect(new Set(writes.map(w=>w.p_op_id))).toEqual(new Set([row.opId]));expect(receipts.size).toBe(1);expect(server['zoew_settings/exchange_rate']).toBe(4300);expect(journal.list(SCOPE,TOPIC)).toEqual([]);
});

it('resetForSignOut រក្សា admitted journal សម្រាប់ same UID/tenant ដោយ original ID ម្តង',async()=>{
 loseFirst=false;rejectUncertain=false;const db=open();await turn();db.goOffline();const outcome=db.set(db.ref('zoew_settings/exchange_rate'),4300).then(()=> 'committed',(e:any)=>e);await turn();const [row]=journal.list(SCOPE,TOPIC);expect(row).toMatchObject({stage:'queued',awaitingRecovery:false});expect(writes).toEqual([]);
 db.resetForSignOut();expect(journal.list(SCOPE,TOPIC)).toEqual([row]);db.setTenantTopic(TOPIC);db.setAuthed(true,SCOPE);db.goOnline();await turn();await vi.advanceTimersByTimeAsync(10);await turn();expect(await outcome).toBe('committed');expect(writes.map(w=>w.p_op_id)).toEqual([row.opId]);expect(receipts.size).toBe(1);expect(server['zoew_settings/exchange_rate']).toBe(4300);expect(journal.list(SCOPE,TOPIC)).toEqual([]);
});

it.each([false,true])('public durable cancellation remove-denied=%s ទប់ old live writer ដោយមិន resurrect original ID',async(removeDenied)=>{
 vi.stubGlobal('navigator',{onLine:true});const owner=open();await turn();const other=open();await turn();attach(other);firebaseState.dbRefExchangeRate=other.ref('zoew_settings/exchange_rate');const input=document.createElement('input');input.type='number';input.value='4200';refTo('exchangeRateInput')(input);
 const unknown=saveExchangeRate();await turn();await vi.advanceTimersByTimeAsync(10);await turn();expect(await unknown).toBe('pending');expect(other.recoveryState().blocked).toBeGreaterThan(0);expect(writes).toHaveLength(2);
 rejectUncertain=false;owner.goOffline();const outcome=owner.set(owner.ref('zoew_settings/exchange_rate'),4300).then(()=> 'committed',(e:any)=>e);await turn();const row=journal.list(SCOPE,TOPIC).find((r:any)=>r.ops.some((op:any)=>op.v===4300));expect(row).toMatchObject({stage:'queued',awaitingRecovery:false});
 denyRemove=removeDenied;uiState.toasts=[];expect(connectionFlowSnapshot().phase).toBe('blocked');expect(await discardPendingWrites()).toBe(true);await turn();if(removeDenied)expect(journal.list(SCOPE,TOPIC).every((r:any)=>r.discarded===true)).toBe(true);else expect(journal.list(SCOPE,TOPIC)).toEqual([]);
 const sent=writes.length;owner.goOnline();await turn();await vi.advanceTimersByTimeAsync(10);await turn();expect(await outcome).toMatchObject({txOutcome:'unknown',noRetry:true});expect(writes.slice(sent)).toEqual([]);expect(server).toEqual({});
 owner.close('restart after durable cancellation');other.close('done');denyRemove=false;open();await turn();expect(writes.slice(sent)).toEqual([]);expect(journal.list(SCOPE,TOPIC)).toEqual([]);
});

it.each(['scope','tenant'])('admitted queued setting មិនផ្ញើទៅ owner B បន្ទាប់ពី %s ផ្លាស់',async(mode)=>{
 loseFirst=false;rejectUncertain=false;const db=open();await turn();db.goOffline();const outcome=db.set(db.ref('zoew_settings/exchange_rate'),4300).then(()=> 'committed',(e:any)=>e);await turn();expect(journal.list(SCOPE,TOPIC)).toHaveLength(1);
 if(mode==='scope')db.setAuthed(true,'synthetic-project|other-user');else db.setTenantTopic('zoe:other-shop');db.goOnline();await turn();await vi.advanceTimersByTimeAsync(10);await turn();expect(await outcome).not.toBe('committed');expect(writes).toEqual([]);expect(server).toEqual({});
});

it.each([['unsent control', false], ['lost response remove', false], ['lost response tombstone', true]] as const)('C08 late transport callback ក្រោយ actual public durable cancellation %s',async(kind,removeDenied)=>{
 vi.stubGlobal('navigator',{onLine:true});
 const owner=open();await turn();const other=open();await turn();attach(other);
 firebaseState.dbRefExchangeRate=other.ref('zoew_settings/exchange_rate');
 const input=document.createElement('input');input.type='number';input.value='4200';refTo('exchangeRateInput')(input);
 const first=saveExchangeRate();await turn();await vi.advanceTimersByTimeAsync(10);await turn();
 expect(await first).toBe('pending');expect(other.recoveryState().blocked).toBeGreaterThan(0);expect(writes).toHaveLength(2);
 rejectUncertain=false;
 if(kind==='unsent control'){loseFirst=false;holdUnsentResponse=true;}else{loseFirst=true;holdLostResponse=true;}
 const outcome=owner.set(owner.ref('zoew_settings/exchange_rate'),4300).then(()=> 'committed',(e:any)=>e);
 await turn();const row=journal.list(SCOPE,TOPIC).find((r:any)=>r.ops.some((op:any)=>op.v===4300));
 expect(row).toMatchObject({stage:'sent',awaitingRecovery:false});expect(writes).toHaveLength(3);expect(server).toEqual({});
 denyRemove=removeDenied;expect(connectionFlowSnapshot().phase).toBe('blocked');
 expect(await discardPendingWrites()).toBe(true);await turn();
 if(removeDenied)expect(journal.list(SCOPE,TOPIC).every((r:any)=>r.discarded===true)).toBe(true);else expect(journal.list(SCOPE,TOPIC)).toEqual([]);
 const before=writes.length;holdUnsentResponse=false;releaseResponse();await turn();await vi.advanceTimersByTimeAsync(10);await turn();
 expect(writes.slice(before),'actual public durable cancellation prevents a later transport retry of the original ID').toEqual([]);
 expect(await outcome).toMatchObject({txOutcome:'unknown',noRetry:true});expect(server).toEqual({});
});

it('C08 pre-admission គ្មាន public cancellation រក្សា original intent',async()=>{
 vi.stubGlobal('navigator',{onLine:true});loseFirst=false;rejectUncertain=false;pausePull=true;
 const owner=open();const outcome=owner.set(owner.ref('zoew_settings/exchange_rate'),4300).then(()=> 'committed',(e:any)=>e);
 await turn();const [row]=journal.list(SCOPE,TOPIC);expect(row).toMatchObject({stage:'unresolved',awaitingRecovery:true});expect(writes).toEqual([]);
 pausePull=false;releasePull();await turn();await vi.advanceTimersByTimeAsync(10);await turn();
 expect(await outcome).toBe('committed');expect(writes.map(w=>w.p_op_id)).toEqual([row.opId]);expect(server['zoew_settings/exchange_rate']).toBe(4300);
});

it.each([false,true])('C08 pre-admission actual public discard remove-denied=%s',async(removeDenied)=>{
 vi.stubGlobal('navigator',{onLine:true});const other=open();await turn();attach(other);
 firebaseState.dbRefExchangeRate=other.ref('zoew_settings/exchange_rate');const input=document.createElement('input');input.type='number';input.value='4200';refTo('exchangeRateInput')(input);
 const first=saveExchangeRate();await turn();await vi.advanceTimersByTimeAsync(10);await turn();expect(await first).toBe('pending');expect(other.recoveryState().blocked).toBeGreaterThan(0);expect(writes).toHaveLength(2);
 loseFirst=false;rejectUncertain=false;pausePull=true;const owner=open();
 const outcome=owner.set(owner.ref('zoew_settings/exchange_rate'),4300).then(()=> 'committed',(e:any)=>e);await turn();
 const row=journal.list(SCOPE,TOPIC).find((r:any)=>r.ops.some((op:any)=>op.v===4300));expect(row).toMatchObject({stage:'unresolved',awaitingRecovery:true});expect(writes).toHaveLength(2);
 denyRemove=removeDenied;expect(connectionFlowSnapshot().phase).toBe('blocked');const discarding=discardPendingWrites();await turn();
 if(removeDenied)expect(journal.list(SCOPE,TOPIC).every((r:any)=>r.discarded===true)).toBe(true);else expect(journal.list(SCOPE,TOPIC)).toEqual([]);
 await vi.advanceTimersByTimeAsync(DB_LIVENESS_PROBE_TIMEOUT_MS+1);await turn();expect(await discarding).toBe(true);
 const before=writes.length;pausePull=false;releasePull();await turn();await vi.advanceTimersByTimeAsync(10);await turn();
 expect(writes.slice(before),'publicly cancelled pre-admission row cannot be overwritten by cached admission').toEqual([]);
 expect(await outcome).toMatchObject({txOutcome:'unknown',noRetry:true});expect(server).toEqual({});
});

it.each([['within',SB_OP_REPLAY_SAFE_MS-1],['expired',SB_OP_REPLAY_SAFE_MS+1]] as const)('C08 shared uncertainty age %s',async(kind,age)=>{
 vi.stubGlobal('navigator',{onLine:true});rejectUncertain=false;const owner=open();await turn();owner.goOffline();const outcome=owner.set(owner.ref('zoew_settings/exchange_rate'),4300).then(()=> 'committed',(e:any)=>e);await turn();const [original]=journal.list(SCOPE,TOPIC);expect(original).toMatchObject({stage:'queued',awaitingRecovery:false});expect(writes).toEqual([]);
 const recoverer=open();await turn();expect(writes).toHaveLength(1);const [uncertain]=journal.list(SCOPE,TOPIC);expect(uncertain).toMatchObject({opId:original.opId,stage:'sent',uncertain:true,sentAfter:START});recoverer.close('stop second recovery before its retry');
 serverNow=START+age;vi.setSystemTime(serverNow);const before=writes.length;owner.goOnline();await turn();await vi.advanceTimersByTimeAsync(10);await turn();
 if(kind==='within'){expect(await outcome).toBe('committed');expect(writes.slice(before).map(w=>w.p_op_id)).toEqual([original.opId]);expect(journal.list(SCOPE,TOPIC)).toEqual([]);}
 else{expect(writes.slice(before),'uncertainty created by actual second recovery cannot become a fresh POST outside the replay window').toEqual([]);expect(await outcome).toMatchObject({txOutcome:'unknown'});expect(owner.recoveryState().blocked).toBeGreaterThan(0);expect(journal.list(SCOPE,TOPIC)).toEqual([expect.objectContaining({opId:original.opId,stage:'unresolved',uncertain:true,sentAfter:START})]);}
});


it('C08 shared uncertainty មកកណ្តាល server-clock await ត្រូវពិនិត្យអាយុឡើងវិញមុន POST',async()=>{
 vi.stubGlobal('navigator',{onLine:true});rejectUncertain=false;const owner=open();await turn();owner.goOffline();
 const outcome=owner.set(owner.ref('zoew_settings/exchange_rate'),4300).then(()=> 'committed',(e:any)=>e);await turn();const [original]=journal.list(SCOPE,TOPIC);expect(original).toMatchObject({stage:'queued',awaitingRecovery:false});
 holdNextClock=true;owner.goOnline();await turn();expect(clockEntered).toBe(true);expect(writes).toEqual([]);
 const recoverer=open();await turn();expect(writes).toHaveLength(1);expect(journal.list(SCOPE,TOPIC)).toEqual([expect.objectContaining({opId:original.opId,stage:'sent',uncertain:true,sentAfter:START})]);recoverer.close('stop second recovery before its retry');
 serverNow=START+SB_OP_REPLAY_SAFE_MS+1;vi.setSystemTime(serverNow);const before=writes.length;releaseClock();await turn();await vi.advanceTimersByTimeAsync(10);await turn();
 expect(writes.slice(before),'shared uncertainty arriving during clock await must not pass an unchecked POST').toEqual([]);expect(await outcome).toMatchObject({txOutcome:'unknown'});expect(owner.recoveryState().blocked).toBeGreaterThan(0);expect(journal.list(SCOPE,TOPIC)).toEqual([expect.objectContaining({opId:original.opId,stage:'unresolved',uncertain:true,sentAfter:START})]);
});


it('C08 unknown callback ក្រោយ same-ID known-unsent callback មិនទុក queued uncertainty ឱ្យ restart ផុតអាយុ',async()=>{
 vi.stubGlobal('navigator',{onLine:true});rejectUncertain=false;holdLostResponse=true;const owner=open();await turn();
 const outcome=owner.set(owner.ref('zoew_settings/exchange_rate'),4300).then(()=> 'committed',(e:any)=>e);await turn();const [original]=journal.list(SCOPE,TOPIC);expect(writes.map(w=>w.p_op_id)).toEqual([original.opId]);
 holdUnsentResponse=true;separateUnsentGate=true;const other=open();await turn();expect(writes.map(w=>w.p_op_id)).toEqual([original.opId,original.opId]);
 releaseUnsent();await turn();expect(journal.list(SCOPE,TOPIC)).toEqual([expect.objectContaining({opId:original.opId,stage:'queued',sentAfter:START})]);other.close('stop known-unsent recovery before retry');
 holdUnsentResponse=false;releaseResponse();await turn();expect.soft(journal.list(SCOPE,TOPIC),'real unknown outcome must no longer have a queued stage').toEqual([expect.objectContaining({opId:original.opId,stage:'sent',uncertain:true,sentAfter:START})]);owner.close('restart after unknown callback');
 const before=writes.length;serverNow=START+SB_OP_REPLAY_SAFE_MS+1;vi.setSystemTime(serverNow);const restarted=open();await turn();await vi.advanceTimersByTimeAsync(10);await turn();
 expect(writes.slice(before),'restart must enforce original uncertainty age after competing callbacks').toEqual([]);expect(restarted.recoveryState().blocked).toBeGreaterThan(0);expect(journal.list(SCOPE,TOPIC)).toEqual([expect.objectContaining({opId:original.opId,stage:'sent',uncertain:true,sentAfter:START})]);expect(await outcome).toBeInstanceOf(Error);
});


it.each([['within',SB_OP_REPLAY_SAFE_MS-1],['expired',SB_OP_REPLAY_SAFE_MS+1]] as const)('C04 legacy queued+uncertain setting evidence %s រក្សា HOLD ដោយមិនផ្ញើ',async(_kind,age)=>{
 const row={v:1,scope:SCOPE,topic:TOPIC,opId:'legacy_uncertain_setting_123456789',stage:'queued',uncertain:true,sentAfter:START,ops:[{k:'set',p:['zoew_settings','exchange_rate'],v:4300}]};expect(journal.put(row)).toBe(true);
 serverNow=START+age;vi.setSystemTime(serverNow);loseFirst=false;rejectUncertain=false;const db=open();await turn();
 expect(writes,'legacy uncertain evidence cannot be admitted by a new wire protocol').toEqual([]);expect(server).toEqual({});expect(db.recoveryState().blocked).toBeGreaterThan(0);expect(journal.list(SCOPE,TOPIC)).toEqual([row]);
});
