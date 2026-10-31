// A Firebase `set`/`update` goes out as one root update carrying its receipt (`zoew_write_receipts/<opId>`, create-once in the rules).
// When the server applies it but the acknowledgement is lost, the real SDK sends the same update again after reconnecting; the
// rules refuse that second copy (`permission_denied`) because the receipt now exists. That refusal says nothing about the first copy:
// the write is applied when the receipt on the server is ours (uid + payload hash). Deep audit 9 proved it on the real SDK + emulator
// (scan saved on the server, ledger reverted, registry key released). Only an absent receipt is a refusal.
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { firebaseState } from '../src/core/state';
import { withTransactionOutcomeResolution } from '../src/services/tx-outcome';
import { nativeWriteRecoveryState } from '../src/services/native-write-recovery';
import { createLocalWriteJournal } from '../src/services/write-journal';
import { dbListenerPendingPaths } from '../src/core/text';

const host = 'https://shop.firebaseio.com';
const records = () => Object.keys(localStorage).filter(k => k.startsWith('zoew_connection_writes_v1:')).map(k => JSON.parse(localStorage.getItem(k)!));
beforeEach(() => { localStorage.clear(); dbListenerPendingPaths.clear(); firebaseState.authGeneration++; vi.stubGlobal('navigator', { onLine: true }); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function lab(update: any) {
    const app = { options: { databaseURL: host } };
    const auth = { app, currentUser: { uid: 'A', getIdToken: async () => 'fake-token' } };
    const db = { app };
    const raw = { getAuth: () => auth, getDatabase: () => db, ref: (_db: any, path = '') => ({ toString: () => host + '/' + path }),
        update, set: update, runTransaction: vi.fn(), deleteApp: async () => {} };
    const sdk = withTransactionOutcomeResolution(raw); sdk.getAuth(app); sdk.getDatabase(app);
    Object.assign(firebaseState, { firebaseConfig: app.options, fb: sdk, auth, db, isDatabaseInitialized: true,
        isInitializingFirebase: false, firebaseSdkUnavailable: false, isDatabaseConnected: true, sessionExpiryCheck: 'live', authLoginOperation: null });
    return { sdk, db };
}
const verdictOf = (p: Promise<any>) => p.then(() => 'sent', (e: any) => e.code || e.message);
const denied = () => Object.assign(new Error('permission_denied'), { code: 'PERMISSION_DENIED' });

// The server keeps what the first copy wrote; `fetch` answers REST reads of it (the outcome reader's path).
function server() {
    const tree: Record<string, any> = {};
    vi.stubGlobal('fetch', vi.fn(async (input: any) => {
        const path = decodeURIComponent(new URL(String(input)).pathname.replace(/^\//, '').replace(/\.json$/, ''));
        return Response.json(path in tree ? tree[path] : null);
    }));
    return tree;
}
const rowOf = (phone: string) => ({ id: 'row1', phone, barcodes: [{ code: 'Z1', cod: 6, dod: 0 }] });

it('a lost acknowledgement whose resend the receipt rule refuses ➜ the write counts as applied (our receipt is on the server)', async () => {
    const tree = server();
    const native = lab(vi.fn(async (_ref: any, value: any) => {
        for (const [path, v] of Object.entries(value)) tree[path] = path.startsWith('zoew_write_receipts/') ? { ...(v as any), at: 1 } : v;
        throw denied();
    }));
    const verdict = await verdictOf(native.sdk.update(native.sdk.ref(native.db, 'zoew_scan_history_cod_dod'), { row1: rowOf('012000111') }));
    expect({ verdict, rows: records().length, blocked: nativeWriteRecoveryState(native.db).blocked, onServer: tree['zoew_scan_history_cod_dod/row1']?.phone })
        .toEqual({ verdict: 'sent', rows: 0, blocked: 0, onServer: '012000111' });
});

it('control ៖ rules that refuse the receipt (nothing applied) ➜ refused · row dropped · nothing blocked', async () => {
    server();
    const native = lab(vi.fn(async () => { throw denied(); }));
    const verdict = await verdictOf(native.sdk.update(native.sdk.ref(native.db, 'zoew_scan_history_cod_dod'), { row1: rowOf('012000111') }));
    expect({ verdict, rows: records().length, blocked: nativeWriteRecoveryState(native.db).blocked }).toEqual({ verdict: 'PERMISSION_DENIED', rows: 0, blocked: 0 });
});

it('control ៖ a receipt of another payload under the same id is never ours ➜ refused', async () => {
    const tree = server();
    const native = lab(vi.fn(async (_ref: any, value: any) => {
        for (const path of Object.keys(value)) if (path.startsWith('zoew_write_receipts/')) tree[path] = { uid: 'A', at: 1, hash: 'f'.repeat(64) };
        throw denied();
    }));
    const verdict = await verdictOf(native.sdk.update(native.sdk.ref(native.db, 'zoew_scan_history_cod_dod'), { row1: rowOf('012000111') }));
    expect({ verdict, rows: records().length }).toEqual({ verdict: 'PERMISSION_DENIED', rows: 0 });
});

it('a refusal whose receipt read fails on the network ➜ outcome unknown · the row stays for recovery (never a refusal that rolls back an applied write)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    const native = lab(vi.fn(async () => { throw denied(); }));
    const failure = await native.sdk.update(native.sdk.ref(native.db, 'zoew_scan_history_cod_dod'), { row1: rowOf('012000111') }).then(() => null, (e: any) => e);
    expect({ code: failure?.code, txOutcome: failure?.txOutcome, rows: records().length }).toEqual({ code: 'write_outcome_unknown', txOutcome: 'unknown', rows: 1 });
});

// Re-audit (money ①) ៖ the scan save that read its row absent reverts the ledger and releases the registry key; a recovery pass that
// later resent the refused copy (its receipt still absent) landed the parcel without its money. A refused send never lands later.
it('a refusal whose receipt was unreadable, then absent once the network returns ➜ the recovery drops the row (never resends what the server refused)', async () => {
    const tree = server();
    const answer = globalThis.fetch as any;
    let online = false;
    vi.stubGlobal('fetch', vi.fn(async (input: any, init?: any) => { if (!online) throw new TypeError('Failed to fetch'); return answer(input, init); }));
    let sends = 0;
    const native = lab(vi.fn(async (_ref: any, value: any) => {
        sends++;
        if (sends === 1) throw denied();
        for (const [path, v] of Object.entries(value)) tree[path] = path.startsWith('zoew_write_receipts/') ? { ...(v as any), at: 1 } : v;
    }));
    const failure = await native.sdk.update(native.sdk.ref(native.db, 'zoew_scan_history_cod_dod'), { row1: rowOf('012000111') }).then(() => null, (e: any) => e);
    expect({ code: failure?.code, rows: records().length }, 'precondition').toEqual({ code: 'write_outcome_unknown', rows: 1 });
    online = true;
    await native.sdk.retryWriteRecovery(native.db);
    expect({ sends, onServer: tree['zoew_scan_history_cod_dod/row1'] ?? null, rows: records().length, blocked: nativeWriteRecoveryState(native.db).blocked })
        .toEqual({ sends: 1, onServer: null, rows: 0, blocked: 0 });
});

it('control ៖ the same unreadable refusal whose receipt turns out ours (an earlier copy landed) ➜ applied · nothing resent', async () => {
    const tree = server();
    const answer = globalThis.fetch as any;
    let online = false;
    vi.stubGlobal('fetch', vi.fn(async (input: any, init?: any) => { if (!online) throw new TypeError('Failed to fetch'); return answer(input, init); }));
    let sends = 0;
    const native = lab(vi.fn(async (_ref: any, value: any) => {
        sends++;
        for (const [path, v] of Object.entries(value)) tree[path] = path.startsWith('zoew_write_receipts/') ? { ...(v as any), at: 1 } : v;
        throw denied();
    }));
    const failure = await native.sdk.update(native.sdk.ref(native.db, 'zoew_scan_history_cod_dod'), { row1: rowOf('012000111') }).then(() => null, (e: any) => e);
    expect({ code: failure?.code, rows: records().length }, 'precondition').toEqual({ code: 'write_outcome_unknown', rows: 1 });
    online = true;
    await native.sdk.retryWriteRecovery(native.db);
    expect({ sends, onServer: tree['zoew_scan_history_cod_dod/row1']?.phone, rows: records().length, blocked: nativeWriteRecoveryState(native.db).blocked })
        .toEqual({ sends: 1, onServer: '012000111', rows: 0, blocked: 0 });
});

it('control ៖ a row whose send never reached the server (journaled, then the App closed) is still resent while its receipt is absent', async () => {
    const tree = server();
    const native = lab(vi.fn(async (_ref: any, value: any) => {
        for (const [path, v] of Object.entries(value)) tree[path] = path.startsWith('zoew_write_receipts/') ? { ...(v as any), at: 1 } : v;
    }));
    const scope = 'https://shop.firebaseio.com/|A';
    const ops = [{ k: 'set', p: ['zoew_scan_history_cod_dod', 'row9'], v: rowOf('012000999') }];
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(ops)));
    const hash = Array.from(new Uint8Array(bytes), (n) => n.toString(16).padStart(2, '0')).join('');
    expect(records().length, 'precondition').toBe(0);
    expect(createLocalWriteJournal().put({ v: 1, scope, topic: 'firebase', opId: 'native_resend0000000009', sentAfter: 0, stage: 'sent', queuedAt: Date.now(), ops, hash }), 'precondition').toBe(true);
    await native.sdk.retryWriteRecovery(native.db);
    expect({ onServer: tree['zoew_scan_history_cod_dod/row9']?.phone, rows: records().length }).toEqual({ onServer: '012000999', rows: 0 });
});
