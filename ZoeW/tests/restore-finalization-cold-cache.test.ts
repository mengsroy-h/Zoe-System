import { beforeEach, describe, expect, it, vi } from 'vitest';
import { firebaseState } from '../src/core/state';
import { clearRestoreFinalization } from '../src/features/restore';

const clone = (value: any) => JSON.parse(JSON.stringify(value));
const receipt = { token: 'owned', targetId: 'target', finalizedAt: 1234 };
let server: any;
let current: boolean;
let beforeRetry: (() => void) | undefined;
let attempts: any[];
let transaction: ReturnType<typeof vi.fn>;

beforeEach(() => {
    server = clone(receipt);
    current = true;
    beforeRetry = undefined;
    attempts = [];
    transaction = vi.fn(async (_ref, updater) => {
        attempts.push(null);
        const speculative = updater(null);
        if (speculative === undefined) return { committed: false, snapshot: { val: () => null } };
        beforeRetry?.();
        attempts.push(clone(server));
        const next = updater(clone(server));
        if (next === undefined) return { committed: false, snapshot: { val: () => clone(server) } };
        server = next;
        return { committed: true, snapshot: { val: () => clone(server) } };
    });
    firebaseState.db = {} as any;
    firebaseState.fb = { ref: (_db, path) => ({ path }), runTransaction: transaction } as any;
});

describe('Restore finalization cleanup with a cold transaction cache', () => {
    it('reaches authoritative matching receipt instead of treating speculative null as absence', async () => {
        await clearRestoreFinalization('source', 'owned', () => current);
        expect(attempts).toEqual([null, receipt]);
        expect(server).toBeNull();
    });

    it('does not delete a different token discovered on server retry', async () => {
        server = { ...receipt, token: 'foreign' };
        await clearRestoreFinalization('source', 'owned', () => current);
        expect(attempts).toHaveLength(2);
        expect(server).toEqual({ ...receipt, token: 'foreign' });
    });

    it('retains a replacement receipt arriving between speculative and server callbacks', async () => {
        beforeRetry = () => { server = { ...receipt, token: 'replacement', finalizedAt: 2345 }; };
        await clearRestoreFinalization('source', 'owned', () => current);
        expect(server).toEqual({ ...receipt, token: 'replacement', finalizedAt: 2345 });
    });

    it('does not clear after ownership changes before the server retry', async () => {
        beforeRetry = () => { current = false; };
        await expect(clearRestoreFinalization('source', 'owned', () => current)).rejects.toThrow('RESTORE_SESSION_SWITCHED');
        expect(server).toEqual(receipt);
    });

    it('accepts actual absence after the authoritative retry', async () => {
        server = null;
        await clearRestoreFinalization('source', 'owned', () => current);
        expect(attempts).toEqual([null, null]);
        expect(server).toBeNull();
    });

    it('does not delete malformed authoritative state', async () => {
        server = false;
        await clearRestoreFinalization('source', 'owned', () => current);
        expect(server).toBe(false);
    });

    it('does not start when session ownership is already lost', async () => {
        current = false;
        await expect(clearRestoreFinalization('source', 'owned', () => current)).rejects.toThrow('RESTORE_SESSION_SWITCHED');
        expect(transaction).not.toHaveBeenCalled();
    });
});
