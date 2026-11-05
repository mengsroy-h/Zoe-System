import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { dataState, firebaseState, uiState } from '../src/core/state';
import { appLocalStore } from '../src/core/storage';
import { executeNativePickupReset, nativePickupResetStatus } from '../src/services/tx-outcome';
import { pickupResetPendingState, resumePickupResetOutcomes, runPickupResetBatch } from '../src/services/pickup-reset';

/**
 * Reset ៖ ការបដិសេធដែលច្បាស់ក្នុងប្រតិបត្តិការផ្ទាល់ (rules · CAS ប៉ះ writer ផ្សេង · មិនទាន់ផ្ញើ) ជា `not-applied` មិនមែន unknown ទេ ➜
 * journal បិទ (settled) · Reset ថ្ងៃផ្សេងនៅធ្វើបាន · គ្មាន HOLD អចិន្ត្រៃយ៍លើឧបករណ៍។
 * ការឆ្លើយបាត់ពិតប្រាកដ (unknown) នៅ HOLD ដដែល (control) ហើយ recovery អានតែ status ៖ គ្មាន receipt ➜ HOLD (CLAUDE.md «Reset recovery reads status only»)។
 */

const DAY = '2026-11-01', SCOPE = 'https://definite-reset.firebaseio.com', TENANT = 'definite-reset', UID = 'reset-owner';
const PREFIX = 'zoew_pickup_reset_pending_v2:';
const clone = (v: any) => v === undefined ? undefined : JSON.parse(JSON.stringify(v));
const record = () => ({ pickupRevision: 4, pickupResetEpoch: 2, packagesPickedUp: 1, pickedUpBarcodes: { RESET_A: '000000001' }, pickedUpPhones: { '000000001': 1 } });
let server: Record<string, any>, raw: any, mode: string, txCalls: number;
const journals = () => Object.keys(appLocalStore).filter(k => k.startsWith(PREFIX)).map(k => JSON.parse(appLocalStore.getItem(k)!));

beforeEach(() => {
    appLocalStore.clear(); appLocalStore.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: SCOPE }));
    vi.stubGlobal('crypto', webcrypto);
    vi.stubGlobal('navigator', { locks: { request: async (_n: any, _o: any, run: any) => run({}) } });
    server = { [DAY]: record() }; mode = 'normal'; txCalls = 0;
    firebaseState.authGeneration++;
    firebaseState.firebaseConfig = { databaseURL: SCOPE } as any;
    firebaseState.auth = { currentUser: { uid: UID, getIdToken: async () => 'synthetic-token' } } as any;
    firebaseState.db = { app: { options: { databaseURL: SCOPE, projectId: TENANT } } } as any;
    firebaseState.isInitializingFirebase = false;
    vi.stubGlobal('fetch', async (url: any) => {
        const day = new URL(String(url)).pathname.split('/').at(-1)!.replace('.json', '');
        return new Response(JSON.stringify(server[day] ?? null), { status: 200 });
    });
    raw = {
        runTransaction: async (ref: any, updater: any) => {
            txCalls++;
            const day = String(ref).split('/').at(-1)!;
            const next = updater(clone(server[day] ?? null));
            if (next === undefined) return { committed: false, snapshot: { val: () => clone(server[day]) } };
            if (mode === 'rules-refuse') throw Object.assign(new Error('permission_denied'), { code: 'PERMISSION_DENIED' });
            if (mode === 'lost') throw Object.assign(new Error('disconnect'), { code: 'DISCONNECT', txOutcome: 'unknown' });
            if (mode === 'race') {
                mode = 'normal';
                server[day] = { ...record(), pickupRevision: 5, packagesPickedUp: 2, pickedUpBarcodes: { RESET_A: '000000001', RESET_B: '000000002' }, pickedUpPhones: { '000000001': 1, '000000002': 1 } };
                const rerun = updater(clone(server[day]));
                if (rerun === undefined) return { committed: false, snapshot: { val: () => clone(server[day]) } };
            }
            server[day] = clone(next);
            return { committed: true, snapshot: { val: () => clone(server[day]) } };
        }
    };
    const owner = { tenant: TENANT, actorUid: UID, tokenRealm: async () => TENANT };
    firebaseState.fb = {
        ref: (_db: any, path: string) => ({ path, toString: () => SCOPE + '/' + path }),
        get: async () => { throw new Error('unused'); },
        executePickupReset: (ref: any, request: any, current: any) => executeNativePickupReset(raw, ref, request, current, owner),
        pickupResetStatus: (ref: any, request: any, current: any) => nativePickupResetStatus(ref, request, current, owner)
    } as any;
    dataState.dailyPickupData = clone(server); uiState.toasts = [];
});
afterEach(() => { vi.unstubAllGlobals(); appLocalStore.clear(); });

it('a rules refusal is a definite failure ➜ no HOLD, the server stays unchanged and a Reset of another day still runs', async () => {
    mode = 'rules-refuse';
    const first = await runPickupResetBatch([DAY]);
    expect(first.status).toBe('partial');
    expect(first.failedCount).toBe(1);
    expect(server[DAY]).toEqual(record());
    expect(pickupResetPendingState(SCOPE, UID)).toBe('');
    mode = 'normal';
    server['2026-11-02'] = record();
    const second = await runPickupResetBatch(['2026-11-02']);
    expect(second.status).toBe('complete');
    expect(server['2026-11-02']).toMatchObject({ packagesPickedUp: 0, pickupResetEpoch: 3 });
});

it('another device changes the day between the read and the CAS ➜ the aborted CAS is retried on the fresh day and applies once', async () => {
    mode = 'race';
    const first = await runPickupResetBatch([DAY]);
    expect(first.status).toBe('complete');
    expect(server[DAY]).toMatchObject({ packagesPickedUp: 0, pickupResetEpoch: 3 });
    expect(pickupResetPendingState(SCOPE, UID)).toBe('');
});

it('the session ends before the CAS is sent ➜ the attempt is not-applied and nothing stays pending for that shop and account', async () => {
    let live = true;
    const realExecute = (firebaseState.fb as any).executePickupReset;
    (firebaseState.fb as any).executePickupReset = (ref: any, request: any, current: any) => { live = false; return realExecute(ref, request, current); };
    await runPickupResetBatch([DAY], () => live);
    live = true;
    expect(txCalls).toBe(0);
    expect(server[DAY]).toEqual(record());
    expect(pickupResetPendingState(SCOPE, UID)).toBe('');
});

it('control ៖ a reply lost after the send stays a HOLD in the live session', async () => {
    mode = 'lost';
    const first = await runPickupResetBatch([DAY]);
    expect(first.status).toBe('hold');
    expect(pickupResetPendingState(SCOPE, UID)).toBe('pending');
    expect(journals()).toHaveLength(1);
});

it('control ៖ recovery reads status only ➜ a lost reply without this attempt\'s receipt stays HOLD even while the epoch is still at the basis', async () => {
    mode = 'lost';
    await runPickupResetBatch([DAY]);
    expect(pickupResetPendingState(SCOPE, UID)).toBe('pending');
    mode = 'normal';
    const calls = txCalls;
    const recovery = await resumePickupResetOutcomes();
    expect(recovery.held).toBe(true);
    expect(pickupResetPendingState(SCOPE, UID)).toBe('pending');
    expect(txCalls).toBe(calls);
    expect(server[DAY]).toEqual(record());
});

it('the read-only status never reports not-applied ៖ an attempt that never ran reads unknown', async () => {
    const realExecute = (firebaseState.fb as any).executePickupReset;
    let captured: any = null;
    (firebaseState.fb as any).executePickupReset = (ref: any, request: any, current: any) => { captured = { ref, request, current }; return realExecute(ref, request, current); };
    mode = 'rules-refuse';
    await runPickupResetBatch([DAY]);
    expect(captured).not.toBeNull();
    const status = await nativePickupResetStatus(captured.ref, captured.request, () => true,
        { tenant: TENANT, actorUid: UID, tokenRealm: async () => TENANT });
    expect(status).toEqual({ outcome: 'unknown', pickupReset: null });
});

it('control ៖ recovery keeps a HOLD when the epoch moved on without this attempt\'s receipt', async () => {
    mode = 'lost';
    await runPickupResetBatch([DAY]);
    server[DAY] = { ...record(), pickupRevision: 6, pickupResetEpoch: 3, packagesPickedUp: 0, pickedUpBarcodes: null, pickedUpPhones: null };
    mode = 'normal';
    const recovery = await resumePickupResetOutcomes();
    expect(recovery.held).toBe(true);
    expect(pickupResetPendingState(SCOPE, UID)).toBe('pending');
});
