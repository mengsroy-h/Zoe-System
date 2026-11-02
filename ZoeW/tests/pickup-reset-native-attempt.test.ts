import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { firebaseState } from '../src/core/state';
import { pickupResetAttemptId, pickupResetBatchHash, pickupResetCasText, pickupResetAppliedReceipt } from '../src/domain/pickup-reset-proof';
import { executeNativePickupReset, nativePickupResetStatus, withTransactionOutcomeResolution } from '../src/services/tx-outcome';

const day = '2026-11-01';
const tenant = 'demo-reset-project';
const actorUid = 'native-owner';
const scope = 'https://demo-reset-project.firebaseio.com';
const copy = (value) => JSON.parse(JSON.stringify(value));
const basis = () => ({ packagesPickedUp: 1, pickedUpPhones: { synthetic: 1 }, pickedUpBarcodes: { SYNTHETIC_1: 'synthetic' }, pickupRevision: 4, pickupResetEpoch: 2 });
const desired = () => ({ packagesPickedUp: 0, pickedUpPhones: null, pickedUpBarcodes: null, pickupRevision: 5, pickupResetEpoch: 3 });
const ref = { toString: () => scope + '/zoew_daily_pickup_cod_dod/' + day };
const owner = { tenant, actorUid, tokenRealm: async () => tenant };

async function request() {
    const batchId = 'synthetic-batch';
    const context = { v: 1, scope, batchId, batchHash: await pickupResetBatchHash(tenant, scope, actorUid, batchId, [day]), dayId: batchId + ':' + day, day, nonce: 'synthetic-nonce' };
    const casText = pickupResetCasText(day, basis(), desired());
    return { tenant, actorUid, context, casText, attemptId: await pickupResetAttemptId(tenant, actorUid, context, casText) };
}

let server;
let current;
let raw;
let reads;
beforeEach(() => {
    vi.stubGlobal('crypto', webcrypto);
    server = basis(); current = true;
    firebaseState.firebaseConfig = { databaseURL: scope };
    firebaseState.auth = { currentUser: { uid: actorUid, getIdToken: vi.fn(async () => 'synthetic-token') } };
    reads = vi.fn(async () => new Response(JSON.stringify(server), { status: 200 }));
    vi.stubGlobal('fetch', reads);
    raw = { runTransaction: vi.fn(async (_ref, updater, options) => {
        expect(options).toEqual({ applyLocally: false });
        const next = updater(copy(server));
        if (next === undefined) return { committed: false, snapshot: { val: () => copy(server) } };
        server = copy(next);
        return { committed: true, snapshot: { val: () => copy(server) } };
    }) };
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('native pickup reset fixed-attempt boundary', () => {
    it('exposes dedicated execute and read-only status without generic replay', () => {
        const sdk = withTransactionOutcomeResolution({ runTransaction() {} });
        expect(typeof sdk.executePickupReset).toBe('function');
        expect(typeof sdk.pickupResetStatus).toBe('function');
    });
    it('commits one original fixed CAS with its exact APPLIED receipt', async () => {
        const original = await request();
        const result = await executeNativePickupReset(raw, ref, original, () => current, owner);
        expect(result.committed).toBe(true);
        expect(result.pickupReset).toMatchObject({ attemptId: original.attemptId, actorUid, tenant, beforeRevision: 4, afterRevision: 5, beforeEpoch: 2, afterEpoch: 3 });
        expect(server).toEqual({ ...desired(), pickupResetApplied: result.pickupReset });
        expect(raw.runTransaction).toHaveBeenCalledTimes(1);
        expect(reads).not.toHaveBeenCalled();
    });
    it('does not recapture a changed basis inside speculative SDK retries', async () => {
        const original = await request();
        server.pickupRevision++;
        const before = copy(server);
        expect((await executeNativePickupReset(raw, ref, original, () => current, owner)).committed).toBe(false);
        expect(server).toEqual(before);
        expect(raw.runTransaction).toHaveBeenCalledTimes(1);
    });
    it.each(['tenant', 'actorUid', 'attemptId', 'casText', 'nonce'])('refuses malformed or foreign %s before effects', async (field) => {
        const original = await request();
        if (field === 'nonce') original.context.nonce += '-changed';
        else original[field] += '-changed';
        await expect(executeNativePickupReset(raw, ref, original, () => current, owner)).rejects.toMatchObject({ txOutcome: 'not-applied' });
        expect(raw.runTransaction).not.toHaveBeenCalled();
        expect(reads).not.toHaveBeenCalled();
    });
    it('refuses a token from another project before native dispatch', async () => {
        await expect(executeNativePickupReset(raw, ref, await request(), () => current, { ...owner, tokenRealm: async () => 'foreign-project' })).rejects.toMatchObject({ txOutcome: 'not-applied' });
        expect(raw.runTransaction).not.toHaveBeenCalled();
        expect(reads).not.toHaveBeenCalled();
    });
    it('keeps missing token-project evidence UNKNOWN for status', async () => {
        expect(await nativePickupResetStatus(ref, await request(), () => current, { ...owner, tokenRealm: undefined })).toEqual({ outcome: 'unknown', pickupReset: null });
        expect(raw.runTransaction).not.toHaveBeenCalled();
        expect(reads).not.toHaveBeenCalled();
    });
    it('refuses a different physical day path before any write', async () => {
        await expect(executeNativePickupReset(raw, { toString: () => scope + '/zoew_daily_pickup_cod_dod/2026-11-02' }, await request(), () => current, owner)).rejects.toMatchObject({ txOutcome: 'not-applied' });
        expect(raw.runTransaction).not.toHaveBeenCalled();
    });
    it('refuses a stale owner before dispatch', async () => {
        const original = await request(); current = false;
        await expect(executeNativePickupReset(raw, ref, original, () => current, owner)).rejects.toMatchObject({ txOutcome: 'not-applied' });
        expect(raw.runTransaction).not.toHaveBeenCalled();
    });
    it('resolves lost ACK only through exact read-only retained proof', async () => {
        const original = await request();
        raw.runTransaction.mockImplementationOnce(async (_ref, updater) => { server = updater(copy(server)); throw new Error('disconnect'); });
        const result = await executeNativePickupReset(raw, ref, original, () => current, owner);
        expect(result.committed).toBe(true);
        expect(result.pickupReset.attemptId).toBe(original.attemptId);
        expect(result.snapshot).toBeUndefined();
        expect(raw.runTransaction).toHaveBeenCalledTimes(1);
        expect(reads).toHaveBeenCalledTimes(1);
    });
    it.each(['absent', 'replaced', 'malformed', 'refused'])('keeps %s proof UNKNOWN without repeating the Reset', async (fault) => {
        const original = await request();
        raw.runTransaction.mockImplementationOnce(async (_ref, updater) => {
            server = updater(copy(server));
            if (fault === 'absent') delete server.pickupResetApplied;
            if (fault === 'replaced') server.pickupResetApplied = { ...server.pickupResetApplied, nonce: 'another-attempt' };
            if (fault === 'malformed') server.pickupResetApplied = { v: 1 };
            if (fault === 'refused') reads.mockImplementation(async () => new Response('', { status: 403 }));
            throw new Error('disconnect');
        });
        await expect(executeNativePickupReset(raw, ref, original, () => current, owner)).rejects.toMatchObject({ txOutcome: 'unknown' });
        expect(raw.runTransaction).toHaveBeenCalledTimes(1);
    });
    it('treats SDK false after a proposal as APPLIED only with authoritative retained proof', async () => {
        const original = await request();
        raw.runTransaction.mockImplementationOnce(async (_ref, updater) => {
            server = updater(copy(server));
            return { committed: false, snapshot: { val: () => copy(server) } };
        });
        const result = await executeNativePickupReset(raw, ref, original, () => current, owner);
        expect(result.committed).toBe(true);
        expect(result.pickupReset.attemptId).toBe(original.attemptId);
        expect(result.snapshot).toBeUndefined();
        expect(reads).toHaveBeenCalledTimes(1);
        expect(raw.runTransaction).toHaveBeenCalledTimes(1);
    });
    it('keeps SDK false after an offered proposal UNKNOWN when authoritative proof is absent', async () => {
        const original = await request();
        raw.runTransaction.mockImplementationOnce(async (_ref, updater) => {
            updater(copy(server));
            return { committed: false, snapshot: { val: () => copy(server) } };
        });
        await expect(executeNativePickupReset(raw, ref, original, () => current, owner)).rejects.toMatchObject({ txOutcome: 'unknown' });
        expect(reads).toHaveBeenCalledTimes(1);
        expect(raw.runTransaction).toHaveBeenCalledTimes(1);
    });
    it('keeps same-session durable-owner cancellation UNKNOWN after effects', async () => {
        const original = await request();
        raw.runTransaction.mockImplementationOnce(async (_ref, updater) => {
            server = updater(copy(server)); current = false;
            return { committed: true, snapshot: { val: () => copy(server) } };
        });
        await expect(executeNativePickupReset(raw, ref, original, () => current, { ...owner, sessionCurrent: () => true })).rejects.toMatchObject({ txOutcome: 'unknown' });
        expect(reads).not.toHaveBeenCalled();
    });
    it('retains exact old ACK proof after session ends without a snapshot or another read', async () => {
        const original = await request();
        raw.runTransaction.mockImplementationOnce(async (_ref, updater) => {
            server = updater(copy(server)); current = false;
            return { committed: true, snapshot: { val: () => copy(server) } };
        });
        const result = await executeNativePickupReset(raw, ref, original, () => current, owner);
        expect(result).toEqual({ committed: true, pickupReset: server.pickupResetApplied, txOutcome: 'applied' });
        expect(result.snapshot).toBeUndefined();
        expect(raw.runTransaction).toHaveBeenCalledTimes(1);
        expect(reads).not.toHaveBeenCalled();
    });
    it('status preserves pickup after the proven Reset and never returns a historical snapshot', async () => {
        const original = await request();
        const receipt = pickupResetAppliedReceipt(tenant, actorUid, original.context, original.attemptId, original.casText, 'native-day');
        server = { ...desired(), pickupResetApplied: receipt, pickupRevision: 6, packagesPickedUp: 1, pickedUpPhones: { newer: 1 }, pickedUpBarcodes: { SYNTHETIC_NEW: 'newer' } };
        const before = copy(server);
        expect(await nativePickupResetStatus(ref, original, () => current, owner)).toEqual({ outcome: 'applied', pickupReset: receipt });
        expect(server).toEqual(before);
        expect(raw.runTransaction).not.toHaveBeenCalled();
    });
    it.each(['stale', 'invalid', 'wrong-day'])('status %s preflight never proves NOT_APPLIED', async (fault) => {
        const original = await request();
        if (fault === 'stale') current = false;
        if (fault === 'invalid') original.context.nonce += '-changed';
        const statusRef = fault === 'wrong-day' ? { toString: () => scope + '/zoew_daily_pickup_cod_dod/2026-11-02' } : ref;
        expect(await nativePickupResetStatus(statusRef, original, () => current, owner)).toEqual({ outcome: 'unknown', pickupReset: null });
        expect(raw.runTransaction).not.toHaveBeenCalled();
    });
});
