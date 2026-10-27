import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { firebaseState } from '../src/core/state';
import { txResolveOutcome } from '../src/services/tx-outcome';

// The REST read that resolves a lost reply belongs to the session that sent the transaction: when the account or the
// database changes while that read answers, its value is never a verdict (`unknown`), even when it equals the sent or
// prior value. Two layers enforce it: the session lease on the read (fetchWithTimeout) and the re-check after it.

const URL_A = 'https://shop-a.firebaseio.com/zoew_scan_history_cod_dod/x.json';
let answer: () => unknown = () => null;

beforeEach(() => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    firebaseState.db = { name: 'session-a' } as any;
    firebaseState.auth = { currentUser: { uid: 'u1', getIdToken: async () => 'token-a' } } as any;
    firebaseState.authGeneration++;
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(answer()), { status: 200, headers: { 'Content-Type': 'application/json' } })));
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    firebaseState.db = null as any;
    firebaseState.auth = null as any;
});

describe('txResolveOutcome ↔ session switch during a successful read', () => {
    it('control: the same session reads the sent value ➜ applied', async () => {
        answer = () => ({ v: 2 });
        expect((await txResolveOutcome(URL_A, { v: 2 }, { v: 1 })).outcome).toBe('applied');
    });

    it('the account changes while the read answers with the sent value ➜ unknown, never applied', async () => {
        answer = () => { firebaseState.authGeneration++; return { v: 2 }; };
        expect((await txResolveOutcome(URL_A, { v: 2 }, { v: 1 })).outcome).toBe('unknown');
    });

    it('the database changes while the read answers with the prior value ➜ unknown, never not-applied', async () => {
        answer = () => { firebaseState.db = { name: 'session-b' } as any; return { v: 1 }; };
        expect((await txResolveOutcome(URL_A, { v: 2 }, { v: 1 })).outcome).toBe('unknown');
    });
});
