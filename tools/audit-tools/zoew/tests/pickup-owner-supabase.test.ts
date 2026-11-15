import { afterEach, beforeEach, expect, it } from 'vitest';
import { dataState, firebaseState } from '../../../../ZoeW/src/core/state';
import { appLocalStore } from '../../../../ZoeW/src/core/storage';
import { liveShopScope } from '../../../../ZoeW/src/core/shop-scope';
import { beginPickupIntent, commitPickupMarks, countPickedUpCustomers, endPickupIntent, patchPickupJournalEntry,
    pickupContextIsCurrent, pickupIntentsLive, readPickupJournal } from '../../../../ZoeW/src/domain/pickup';
import { SbRpcError, createSupabaseDatabase } from '../../../../ZoeW/src/services/supabase-rtdb';
import { createSupabaseSdk } from '../../../../ZoeW/src/services/supabase-sdk';
import type { BackendAuth } from '../../../../ZoeW/src/services/backend-types';
import type { PickupDayView, PickupMark } from '../../../../ZoeW/src/domain/statistics';

const ROOT = 'zoew_daily_pickup_cod_dod';
const DAY = '2026-11-15';
const CONFIG = { supabaseUrl: 'https://pickup-owner-fixture.invalid', supabaseKey: 'synthetic-public-key' };
const opened: ReturnType<typeof createSupabaseDatabase>[] = [];

function object(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function decode(text: string): unknown {
    return JSON.parse(text);
}

function jsonCopy(value: unknown): unknown {
    const encoded = JSON.stringify(value);
    if (encoded === undefined) throw new Error('Fixture requires JSON data');
    return decode(encoded);
}

function field(value: unknown, name: string): unknown {
    if (!object(value)) throw new Error('Fixture expected an object');
    return value[name];
}

function server(rejectWrite: boolean) {
    let value: unknown = { packagesPickedUp: 0, pickupRevision: 1, pickupResetEpoch: 0 };
    let seq = 1;
    const calls: { method: string; bytes: string }[] = [];
    const writes: unknown[] = [];
    const docs = () => [{ r: ROOT, k: DAY, s: seq, v: value }];
    const transport = {
        async rpc(method: string, args: unknown): Promise<unknown> {
            const bytes = JSON.stringify(args);
            if (bytes === undefined) throw new Error('Missing RPC args');
            const request = decode(bytes);
            calls.push({ method, bytes });
            if (!object(request)) throw new Error('Invalid RPC args');
            if (method === 'zoe_pull') return jsonCopy({ seq, more: false, reset: true, head: seq, tenant: 't1', now: Date.now(), rows: docs() });
            if (method === 'zoe_read') {
                expect(request).toEqual({ p_root: ROOT, p_key: DAY });
                return jsonCopy({ now: Date.now(), docs: docs() });
            }
            if (method === 'zoe_now') return Date.now();
            if (method !== 'zoe_write_v2') throw new Error('Unexpected RPC: ' + method);
            expect(request.p_expected_tenant).toBe('t1');
            if (!Array.isArray(request.p_ops) || request.p_ops.length !== 1) throw new Error('Expected one CAS operation');
            const operation: unknown = request.p_ops[0];
            if (!object(operation)) throw new Error('Invalid CAS operation');
            expect(operation.k).toBe('cas');
            expect(operation.p).toEqual([ROOT, DAY]);
            expect(operation.x).toEqual(value);
            writes.push(jsonCopy(operation));
            if (rejectWrite) throw new SbRpcError('synthetic permission refusal', '42501', 403, '');
            value = jsonCopy(operation.v);
            seq++;
            return jsonCopy({ ok: true, seq, now: Date.now(), docs: docs() });
        },
        ping: async () => true,
        subscribe: () => () => {}
    };
    return { transport, calls, writes, saved: () => jsonCopy(value) };
}

async function open(rejectWrite = false) {
    const wire = server(rejectWrite);
    const errors: unknown[] = [];
    const db = createSupabaseDatabase(wire.transport, { onListenerError: (error: unknown) => errors.push(error),
        onSynced: () => {}, onForbidden: () => {}, onTxOutcomeUnknown: () => {} },
    { pollFallbackMs: 600000, retryStepsMs: [600000], rpcTimeoutMs: 1000 });
    opened.push(db);
    const sdk = createSupabaseSdk(() => wire.transport, {});
    const auth: BackendAuth = { app: { name: 'pickup-owner-fixture', options: CONFIG },
        currentUser: { uid: 'fixture-owner', email: 'fixture-owner@example.invalid', getIdToken: async () => 'synthetic-token' },
        _account: { tenant_id: 't1' } };
    Object.assign(firebaseState, { db, fb: sdk, auth, firebaseConfig: CONFIG, authGeneration: 1,
        isInitializingFirebase: false, isDatabaseConnected: true });
    appLocalStore.setItem('zoew_firebase_config', JSON.stringify(CONFIG));
    db.setTenantTopic('zoe:t1');
    db.setAuthed(true, 'scope');
    await expect.poll(() => db.isReady()).toBe(true);
    return { ...wire, db, sdk, errors };
}

async function commit(lab: Awaited<ReturnType<typeof open>>, marks: PickupMark[]) {
    const intent = beginPickupIntent(DAY, marks.map(mark => mark.key), 'fixture-row');
    if (!intent) throw new Error('Pickup intent was not prepared');
    expect(patchPickupJournalEntry(intent, { stage: 'started', pickupResetEpoch: 0, allowedAddKeys: marks.map(mark => mark.key) })).toBe(true);
    const owner = { db: lab.db, sdk: lab.sdk, generation: 1, scope: liveShopScope(), uid: 'fixture-owner', date: DAY,
        revision: 1, epoch: 0, intent };
    expect(pickupContextIsCurrent(owner)).toBe(true);
    const committed = await commitPickupMarks(DAY, marks, false, true, undefined, owner);
    const authoritative = (await lab.sdk.get(lab.sdk.ref<PickupDayView>(lab.db, ROOT + '/' + DAY))).val();
    return { committed, authoritative, memory: dataState.dailyPickupData[DAY], intent };
}

function expectDay(value: unknown, keys: string[], phoneKey: string) {
    expect(field(value, 'packagesPickedUp')).toBe(keys.length);
    expect(field(value, 'pickupRevision')).toBe(2);
    expect(field(value, 'pickupResetEpoch')).toBe(0);
    const phones = field(value, 'pickedUpPhones');
    const barcodes = field(value, 'pickedUpBarcodes');
    expect(Object.keys(object(phones) ? phones : {})).toEqual([phoneKey]);
    expect(field(phones, phoneKey)).toBe(keys.length);
    expect(Object.keys(object(barcodes) ? barcodes : {}).sort()).toEqual([...keys].sort());
    for (const key of keys) expect(field(barcodes, key)).toBe(phoneKey);
    expect(countPickedUpCustomers(value)).toBe(1);
}

beforeEach(() => {
    appLocalStore.clear();
    pickupIntentsLive.clear();
    dataState.dailyPickupData = {};
    dataState.pickupPendingVersion = 0;
});

afterEach(() => {
    for (const db of opened.splice(0)) db.close('fixture finished');
    pickupIntentsLive.clear();
    appLocalStore.clear();
});

it.each(['012345678', 'constructor', 'toString', '__proto__', 'hasOwnProperty'])(
    'Supabase adapter ពិត និង JSON RPC៖ owner %s រក្សាអត្តសញ្ញាណ និងចំនួន pickup', async phoneKey => {
        const lab = await open();
        const keys = ['CODE_A', 'CODE_B'];
        const result = await commit(lab, keys.map(key => ({ key, phoneKey, closed: true })));
        expect(result.committed).toBe(true);
        expect(lab.writes).toHaveLength(1);
        for (const value of [lab.saved(), result.authoritative, result.memory]) expectDay(value, keys, phoneKey);
        const write = lab.calls.find(call => call.method === 'zoe_write_v2');
        if (!write) throw new Error('Missing write RPC');
        expect(write.bytes).toContain(JSON.stringify(phoneKey) + ':2');
        expect(lab.errors).toEqual([]);
        expect(await endPickupIntent(result.intent, result.committed)).toBe(true);
        expect(readPickupJournal()).toEqual([]);
    }
);

it.each(['__proto__', 'hasOwnProperty'])(
    'Supabase adapter ពិត និង JSON RPC៖ barcode key %s រក្សាទុកតាម public commit', async key => {
        const lab = await open();
        const result = await commit(lab, [{ key, phoneKey: '012345678', closed: true }]);
        expect(result.committed).toBe(true);
        expect(lab.writes).toHaveLength(1);
        for (const value of [lab.saved(), result.authoritative, result.memory]) expectDay(value, [key], '012345678');
        const write = lab.calls.find(call => call.method === 'zoe_write_v2');
        if (!write) throw new Error('Missing write RPC');
        expect(write.bytes).toContain(JSON.stringify(key) + ':"012345678"');
        expect(await endPickupIntent(result.intent, result.committed)).toBe(true);
        expect(readPickupJournal()).toEqual([]);
    }
);

it.each([
    ...['012345678', 'constructor', 'toString', '__proto__', 'hasOwnProperty'].map(phoneKey => ({ key: 'CODE_A', phoneKey })),
    ...['__proto__', 'hasOwnProperty'].map(key => ({ key, phoneKey: '012345678' }))
])(
    'Supabase adapter ពិត៖ RPC បដិសេធ owner $phoneKey និង barcode $key ទុក intent រង់ចាំ', async ({ key, phoneKey }) => {
        const lab = await open(true);
        const result = await commit(lab, [{ key, phoneKey, closed: true }]);
        expect(result.committed).toBeNull();
        expect(lab.writes).toHaveLength(1);
        expectDay(field(lab.writes[0], 'v'), [key], phoneKey);
        const before = { packagesPickedUp: 0, pickupRevision: 1, pickupResetEpoch: 0 };
        expect(lab.saved()).toEqual(before);
        expect(result.authoritative).toEqual(before);
        expect(result.memory).toBeUndefined();
        expect(await endPickupIntent(result.intent, result.committed)).toBe(false);
        expect(readPickupJournal()).toHaveLength(1);
        expect(readPickupJournal()[0]).toMatchObject({ id: result.intent, stage: 'started', hold: 'recovery-pending' });
    }
);
